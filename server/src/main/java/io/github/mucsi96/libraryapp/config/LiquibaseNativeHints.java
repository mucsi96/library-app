package io.github.mucsi96.libraryapp.config;

import org.springframework.aot.hint.MemberCategory;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;
import org.springframework.beans.factory.annotation.AnnotatedBeanDefinition;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.ImportRuntimeHints;
import org.springframework.core.type.filter.AssignableTypeFilter;

import liquibase.serializer.LiquibaseSerializable;

/**
 * Reachability metadata for Liquibase's changelog model, registered without
 * conditions.
 *
 * Liquibase reads its own model reflectively. A change's parameters are the
 * bean properties {@code Introspector} finds on the change class, and a
 * changeset's checksum is the serialization of those parameters and of nested
 * objects such as {@code ColumnConfig}, whose fields are read with
 * {@code getDeclaredFields()}. The reachability metadata the GraalVM
 * repository ships for liquibase-core was recorded with the tracing agent, so
 * every entry is guarded by a {@code typeReached} condition naming the class
 * that happened to be on the stack when the recording exercised it, and the
 * entry only becomes active once that class is reached at run time. The
 * getters a checksum needs are recorded under {@code UpdateVisitor}, which is
 * the path the recording - and the e2e pod, whose database is always empty -
 * take: nothing has run yet, so validation computes no checksum, and by the
 * time the update marks a changeset as ran, {@code UpdateVisitor} has been
 * reached and the getters are invokable. Against a database that already
 * carries the changelog, {@code ValidatingVisitor} recomputes every applied
 * changeset's checksum to compare it with the stored one before any update
 * visitor exists, and the first getter that is only registered under the
 * update path fails with {@code MissingReflectionRegistrationError}. That is
 * exactly a redeploy of production, and exactly what a fresh test database
 * never exercises; {@code scripts/pod_up.sh} restarts the server once for
 * that reason.
 *
 * Registering the whole serializable model rather than the getters missing
 * today keeps the next change type in the changelog from failing the same
 * way. Every change, precondition, column and constraint config implements
 * {@link LiquibaseSerializable}, so that is what is scanned for. The
 * categories match what Liquibase reads: public methods for
 * {@code Introspector}, declared fields for {@code ReflectionSerializer},
 * and constructors because nested config objects are instantiated
 * reflectively while a changelog is parsed. Abstract classes are included
 * because {@code ReflectionSerializer} walks the superclass chain with
 * {@code getDeclaredFields()}.
 *
 * None of this reproduces on the AOT-on-JVM run described in AGENTS.md -
 * reflection always works there. It only shows up in the native image, and
 * only against a database whose changelog table is already populated.
 */
@Configuration(proxyBeanMethods = false)
@ImportRuntimeHints(LiquibaseNativeHints.Registrar.class)
public class LiquibaseNativeHints {

  static class Registrar implements RuntimeHintsRegistrar {

    private static final String LIQUIBASE_PACKAGE = "liquibase";

    @Override
    public void registerHints(RuntimeHints hints, ClassLoader classLoader) {
      final ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(
          false) {
        @Override
        protected boolean isCandidateComponent(AnnotatedBeanDefinition beanDefinition) {
          return beanDefinition.getMetadata().isIndependent()
              && !beanDefinition.getMetadata().isInterface();
        }
      };
      scanner.addIncludeFilter(new AssignableTypeFilter(LiquibaseSerializable.class));

      for (BeanDefinition definition : scanner.findCandidateComponents(LIQUIBASE_PACKAGE)) {
        hints.reflection().registerTypeIfPresent(classLoader, definition.getBeanClassName(),
            MemberCategory.INVOKE_DECLARED_CONSTRUCTORS, MemberCategory.INVOKE_PUBLIC_METHODS,
            MemberCategory.ACCESS_DECLARED_FIELDS);
      }
    }
  }
}
