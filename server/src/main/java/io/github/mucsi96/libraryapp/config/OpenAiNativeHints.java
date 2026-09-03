package io.github.mucsi96.libraryapp.config;

import java.util.List;
import java.util.regex.Pattern;

import org.springframework.aot.hint.MemberCategory;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;
import org.springframework.beans.factory.annotation.AnnotatedBeanDefinition;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.ImportRuntimeHints;
import org.springframework.core.type.filter.TypeFilter;

/**
 * Reachability metadata for the OpenAI SDK's request and response models.
 *
 * Both AI calls go through the official SDK: Spring AI's OpenAI module builds
 * its chat requests with it, and {@code ThumbnailService} calls its image
 * edit endpoint directly. The SDK is written in Kotlin and serializes its
 * models with its own Jackson {@code ObjectMapper}, which has
 * {@code jackson-module-kotlin} registered. For a Kotlin class that module
 * does not read the constructor with plain Java reflection: it asks
 * {@code ReflectJvmMapping} to map the Kotlin constructor back to a
 * {@code java.lang.reflect.Constructor}. In a native image without metadata
 * that mapping finds nothing, and rather than a missing-reflection error it
 * fails as
 *
 * <pre>
 * KotlinReflectionInternalError: Could not compute caller for function:
 *     fun &lt;init&gt;(JsonField&lt;List&lt;ChatCompletionMessageParam&gt;&gt;, ...)
 * </pre>
 *
 * thrown while serializing the request body - so the symptom is every call to
 * the model failing at request time, with a stack trace naming Kotlin's
 * reflection internals rather than anything that is missing.
 *
 * The SDK does ship a {@code META-INF/native-image/reflect-config.json}
 * (4.43.0), but it is agent-recorded from the SDK's own test-suite, and lists
 * exactly the members those tests touched: the params classes this
 * application sends ({@code ImageEditParams}, {@code ChatCompletionCreateParams})
 * are in it with a single method each. Whole packages are registered here
 * rather than the classes that fail today, for the reason given in
 * {@link AzureNativeHints}: the next model the SDK reaches for fails the same
 * way, pointing nowhere near its cause. The scan is limited to what this
 * application can reach - chat completions, images, the shared core and the
 * error models, plus the top-level models (response formats, the model
 * enums) those refer to. The other model packages (responses, beta,
 * realtime, evals, ...) are four fifths of the SDK's 25k classes, and nothing
 * here calls those APIs.
 *
 * The scan reads bytecode rather than loading classes, and skips anonymous and
 * lambda classes. Both matter: Spring AI's own
 * {@code AiRuntimeHints.findJsonAnnotatedClassesInPackage} helper loads every
 * candidate, and loading one of the SDK's synthetic classes throws
 * "This function has a reified type parameter and thus can only be inlined at
 * compilation time", which fails the build outright.
 *
 * Only the native image needs any of this. The AOT-on-JVM run described in
 * AGENTS.md cannot show the failure - reflection always works there.
 */
@Configuration(proxyBeanMethods = false)
@ImportRuntimeHints(OpenAiNativeHints.Registrar.class)
public class OpenAiNativeHints {

  static class Registrar implements RuntimeHintsRegistrar {

    /** A package and which of the classes under it to register. */
    private record Scan(String basePackage, TypeFilter filter) {

      static Scan wholePackage(String basePackage) {
        return new Scan(basePackage, (metadataReader, metadataReaderFactory) -> true);
      }

      /** The classes directly in the package, none of its subpackages. */
      static Scan topLevelOnly(String basePackage) {
        final Pattern direct = Pattern.compile("^" + Pattern.quote(basePackage) + "\\.[^.]+$");
        return new Scan(basePackage, (metadataReader, metadataReaderFactory) -> direct
            .matcher(metadataReader.getClassMetadata().getClassName()).matches());
      }
    }

    private static final List<Scan> SCANS = List.of(
        Scan.wholePackage("com.openai.models.chat"),
        Scan.wholePackage("com.openai.models.images"),
        Scan.wholePackage("com.openai.core"),
        Scan.wholePackage("com.openai.errors"),
        Scan.topLevelOnly("com.openai.models"));

    /** Anonymous and lambda classes: a {@code $} followed by a digit. */
    private static final Pattern SYNTHETIC = Pattern.compile("\\$\\d");

    @Override
    public void registerHints(RuntimeHints hints, ClassLoader classLoader) {
      for (Scan scan : SCANS) {
        final ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(
            false) {
          @Override
          protected boolean isCandidateComponent(AnnotatedBeanDefinition beanDefinition) {
            // The default rejects abstract types, which is where the SDK puts
            // its unions - ChatCompletionContentPart and friends are needed
            // just as much.
            return true;
          }
        };
        scanner.addIncludeFilter(scan.filter());

        for (BeanDefinition definition : scanner.findCandidateComponents(scan.basePackage())) {
          final String name = definition.getBeanClassName();
          if (name == null || SYNTHETIC.matcher(name).find()) {
            continue;
          }
          hints.reflection().registerTypeIfPresent(classLoader, name,
              MemberCategory.INVOKE_DECLARED_CONSTRUCTORS,
              MemberCategory.INVOKE_DECLARED_METHODS,
              MemberCategory.ACCESS_DECLARED_FIELDS);
        }
      }
    }
  }
}
