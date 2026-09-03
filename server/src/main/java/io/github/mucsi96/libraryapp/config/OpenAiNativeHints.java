package io.github.mucsi96.libraryapp.config;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.aot.hint.ExecutableMode;
import org.springframework.aot.hint.MemberCategory;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;
import org.springframework.aot.hint.TypeHint;
import org.springframework.aot.hint.TypeReference;
import org.springframework.beans.factory.annotation.AnnotatedBeanDefinition;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.ImportRuntimeHints;
import org.springframework.core.type.filter.TypeFilter;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

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
 * (4.43.0), agent-recorded from its own test-suite, and the build excludes it
 * ({@code --exclude-config} in pom.xml) - not because it is wrong but because
 * of its size. It registers twelve thousand types across every API the SDK
 * has - beta, responses, realtime, admin, evals - with their fields, and each
 * field drags its type along, so the reachable universe grows by tens of
 * thousands of types nothing here can call, and the native-image builder
 * runs out of memory before it has laid the image out. What that file records
 * for the rest of the classpath is still needed, though: the SDK's Jackson
 * mapper instantiates serializers such as {@code NullSerializer}
 * reflectively, and kotlin-reflect reads the Kotlin metadata of every model
 * it maps. So the registrar replays the file, minus the model packages
 * nothing here uses - the SDK maintainers' metadata stays authoritative for
 * everything else, and an SDK upgrade brings its additions along.
 *
 * The recorded entries alone are incomplete for what is used: for many
 * classes they hold only a query on the constructors, which is not enough to
 * invoke one. Whole packages are therefore also registered with their
 * constructors, methods and fields, for the reason given in
 * {@link AzureNativeHints}: the next model the SDK reaches for fails the same
 * way, pointing nowhere near its cause. The scan is limited to what this
 * application can reach - chat completions and the completion usage they
 * carry, images, the shared core and the error models, plus the top-level
 * models (response formats, the model enums) those refer to. The other model
 * packages are four fifths of the SDK's 25k classes, and nothing here calls
 * those APIs; the remaining Spring AI OpenAI auto-configurations (audio,
 * embeddings, moderation, images) are switched off in application.yml so
 * they cannot reach for them either. Reaching for another SDK API means
 * adding its package to {@code USED_MODEL_PACKAGES}.
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

    /** The subpackages of {@code com.openai.models} this application reaches. */
    private static final Set<String> USED_MODEL_PACKAGES = Set.of("chat", "completions", "images");

    private static final List<Scan> SCANS = List.of(
        Scan.wholePackage("com.openai.models.chat"),
        Scan.wholePackage("com.openai.models.completions"),
        Scan.wholePackage("com.openai.models.images"),
        Scan.wholePackage("com.openai.core"),
        Scan.wholePackage("com.openai.errors"),
        Scan.topLevelOnly("com.openai.models"));

    /** Anonymous and lambda classes: a {@code $} followed by a digit. */
    private static final Pattern SYNTHETIC = Pattern.compile("\\$\\d");

    private static final String SDK_REFLECT_CONFIG = "META-INF/native-image/reflect-config.json";

    private static final String SDK_JAR = "openai-java-core";

    private static final Pattern MODEL_SUBPACKAGE = Pattern.compile("^com\\.openai\\.models\\.([^.]+)\\..*");

    /** The flags the recorded config uses, as Spring member categories. */
    @SuppressWarnings("deprecation")
    private static final Map<String, MemberCategory> FLAGS = Map.of(
        "allDeclaredFields", MemberCategory.ACCESS_DECLARED_FIELDS,
        "allPublicFields", MemberCategory.ACCESS_PUBLIC_FIELDS,
        "allDeclaredMethods", MemberCategory.INVOKE_DECLARED_METHODS,
        "allPublicMethods", MemberCategory.INVOKE_PUBLIC_METHODS,
        "allDeclaredConstructors", MemberCategory.INVOKE_DECLARED_CONSTRUCTORS,
        "allPublicConstructors", MemberCategory.INVOKE_PUBLIC_CONSTRUCTORS,
        "queryAllDeclaredMethods", MemberCategory.INTROSPECT_DECLARED_METHODS,
        "queryAllPublicMethods", MemberCategory.INTROSPECT_PUBLIC_METHODS,
        "queryAllDeclaredConstructors", MemberCategory.INTROSPECT_DECLARED_CONSTRUCTORS,
        "queryAllPublicConstructors", MemberCategory.INTROSPECT_PUBLIC_CONSTRUCTORS);

    @Override
    public void registerHints(RuntimeHints hints, ClassLoader classLoader) {
      registerScannedPackages(hints, classLoader);
      replaySdkConfig(hints, classLoader);
    }

    private void registerScannedPackages(RuntimeHints hints, ClassLoader classLoader) {
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

    /**
     * Re-registers what the SDK's own reflect-config records, except the
     * entries for model packages nothing here uses. Failing loudly when the
     * file is not where this expects it is deliberate: a silently skipped
     * replay would only show up as a serializer failing to instantiate at
     * the first AI call in the native image.
     */
    private void replaySdkConfig(RuntimeHints hints, ClassLoader classLoader) {
      final URL config = findSdkConfig(classLoader);
      final JsonNode entries;
      try {
        entries = new ObjectMapper().readTree(config);
      } catch (IOException e) {
        throw new UncheckedIOException("Cannot read " + config, e);
      }

      for (JsonNode entry : entries) {
        final String name = entry.path("name").asText();
        // Array types appear as JVM descriptors ("[Lcom...;"), which the hint
        // API does not accept; they carry no members, and an array class is
        // reachable as soon as its component type is.
        if (name.isEmpty() || name.startsWith("[") || isUnusedModel(name)) {
          continue;
        }
        hints.reflection().registerTypeIfPresent(classLoader, name, hint -> replayEntry(hint, entry));
      }
    }

    private static void replayEntry(TypeHint.Builder hint, JsonNode entry) {
      FLAGS.forEach((flag, category) -> {
        if (entry.path(flag).asBoolean(false)) {
          hint.withMembers(category);
        }
      });

      for (JsonNode method : entry.path("methods")) {
        final List<TypeReference> parameterTypes = new ArrayList<>();
        for (JsonNode parameterType : method.path("parameterTypes")) {
          parameterTypes.add(TypeReference.of(parameterType.asText()));
        }
        final String methodName = method.path("name").asText();
        if ("<init>".equals(methodName)) {
          hint.withConstructor(parameterTypes, ExecutableMode.INVOKE);
        } else {
          hint.withMethod(methodName, parameterTypes, ExecutableMode.INVOKE);
        }
      }

      for (JsonNode field : entry.path("fields")) {
        hint.withField(field.path("name").asText());
      }
    }

    private static boolean isUnusedModel(String className) {
      final Matcher subpackage = MODEL_SUBPACKAGE.matcher(className);
      return subpackage.matches() && !USED_MODEL_PACKAGES.contains(subpackage.group(1));
    }

    private static URL findSdkConfig(ClassLoader classLoader) {
      final List<URL> candidates;
      try {
        candidates = Collections.list(classLoader.getResources(SDK_REFLECT_CONFIG));
      } catch (IOException e) {
        throw new UncheckedIOException("Cannot list " + SDK_REFLECT_CONFIG + " resources", e);
      }

      return candidates.stream()
          .filter(url -> url.toString().contains(SDK_JAR))
          .findFirst()
          .orElseThrow(() -> new IllegalStateException(
              "No " + SDK_REFLECT_CONFIG + " found in the " + SDK_JAR + " jar; the SDK stopped shipping "
                  + "its native-image metadata, so this replay - and the --exclude-config in pom.xml - "
                  + "need revisiting. Candidates: " + candidates));
    }
  }
}
