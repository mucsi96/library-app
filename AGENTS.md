# Library App - Development Guidelines

## General Code Style

- Avoid fallbacks, prefer failing fast
- Prefer functional programming patterns
- Prefer immutable data structures

## Java Style

- Use Lombok annotations (@Data, @Builder, @RequiredArgsConstructor)
- Constructor injection (via @RequiredArgsConstructor)
- Use Stream API for collections
- Use records for DTOs/responses

## TypeScript Style

- Use `const` by default
- Prefer spread operator for object/array operations
- Use functional array methods (map, filter, reduce)
- Use string literals over enums

## Testing Style

- Write tests from user perspective
- Use role-based selectors (getByRole)
- Use semantic selectors (getByText, getByLabel)
- E2E tests with Playwright

## Angular Style

- Use Angular Material components
- Use signals and resources (not rxjs where possible)
- Use string literals over enums
- Standalone components

## Design

- Material UI dark theme
- Skeleton loaders for loading states

## Project Overview

Application for tracking books and CDs borrowed from libraries:
- Loans list with due dates, overdue and due-soon reminders
- Track each item's status (loaned, unread, reading, read, read &
  returned, returned unread - with listening/listened wording for CDs and
  watching/watched wording for DVDs), each shown as a colored tag, so
  finished items aren't borrowed again; the loans list has quick filter
  chips for type, library and status
- A selection mode on the loans list ticks individual rows or every row
  matching the quick filters at once, and a sticky bottom bar sets one new
  due date for the whole selection — the stack renewed at the counter in
  one go. Narrowing a filter drops the rows it hides out of the selection.
  Own items have no deadline, so a selection holding one offers no due
  date change (the server rejects it too)
- A detail modal (large cover, ISBN, status chips) opened by tapping an
  item changes the status, and moves the item to another library or to
  "My own": moving to own drops the due date and keeps only reading
  progress (loaned becomes unread), picking a library for an own item
  starts a fresh loan period (unread becomes loaned)
- Import an item by picking its source explicitly — a library from a
  predefined list managed on the settings page (slug ids derived from the
  name), or "My own" for items the user owns — then photographing its
  front and back (camera capture input, so iPhone opens the photo app);
  GPT-5 extracts ISBN, title, author and media type from the photos (the
  library is never AI-guessed), and the ISBN is validated (ISBN-10
  converted, 978/979 prefix and check digit) server-side
- Own items have no due date, show "My own" instead of a library (with a
  matching filter chip), and only track reading progress
  (unread/reading/read; unlistened/listening/listened for CDs,
  unwatched/watching/watched for DVDs), starting as unread
- Importing is asynchronous: the upload stages both photos and returns
  202 immediately, so the import page clears itself and the next item can
  be captured right away (batch capture at the library counter). A paced
  background worker does the AI work and the client polls for progress,
  shown as "Processing" cards above the loans list that use the user's own
  front photo as the placeholder cover and fill in as each stage
  completes. A failed import can be retried without retaking the photos,
  or dismissed
- When no valid ISBN is readable on the photos the import parks as
  NEEDS_ISBN instead of failing: the processing card asks for the ISBN,
  the typed value goes through the same server-side validation, and the
  job resumes with the staged photos — skipping re-extraction, since the
  extracted fields were kept
- Outbound AI calls are rate-limit safe: jobs are claimed one at a time
  with `FOR UPDATE SKIP LOCKED` and gated by a single-row `ai_pacer`
  table, so no more than one job per `import.min-job-interval` runs across
  all replicas. Rate limits and other transient errors back off
  exponentially (honouring `Retry-After`) and give up after
  `import.max-attempts`; an unreadable ISBN spends no further calls while
  it waits for manual entry
- gpt-image-2 generates a cover thumbnail from the front photo with the
  library markings (stickers, labels, barcodes) removed; it is stored on
  disk as `{isbn13}.jpg`, served from an authenticated endpoint, and shown
  in the loans list
- Items are matched by ISBN, so re-imports refresh the due date without
  duplicating items, losing the read status, or regenerating the existing
  thumbnail; on re-import a returned item goes back on loan (read &
  returned becomes read, returned unread becomes loaned)
- The due date is computed as import date + `loan-period-days` (28);
  own items have none

## Architecture

- **client/** - Angular SPA with Material UI, MSAL authentication
- **server/** - Spring Boot REST API with PostgreSQL
- **mock_openai_server/** - Express mock of the OpenAI API for E2E tests
- **test/** - Playwright E2E tests
- **scripts/** - Build and deployment scripts
- **.github/workflows/** - CI/CD pipelines

## Key Technologies

- Spring Boot 4, Java 21 (built into a GraalVM native image)
- Spring AI (GPT-5 vision extraction) + OpenAI Java SDK (gpt-image-2 edits)
- Angular 22
- PostgreSQL 17
- Azure AD (MSAL) authentication
- Azure Key Vault for secrets
- Traefik reverse proxy
- Docker multi-stage builds
- Playwright for E2E testing

## Development Commands

### Frontend
```bash
cd client && npm start        # Start dev server
cd client && npm run build    # Production build
```

### Backend
```bash
cd server && mvn spring-boot:run -Dspring-boot.run.profiles=local  # Start with local profile
```

Local development still runs on a plain JVM. The native image is built only by
the container build - see **Native image and the baked-in Spring profile**
below.

### Podman Development
```bash
scripts/pod_up.sh             # Build images and start test pod
scripts/pod_down.sh           # Stop and clean up test pod
scripts/dev_db_up.sh          # Start development PostgreSQL database
scripts/dev_db_down.sh        # Stop development database
```

### Testing
```bash
cd test && npm test           # Run E2E tests
cd test && npx playwright test --ui  # Interactive test runner
```

## API Routes

- `GET /api/environment` - Client configuration (public)
- `GET /api/items` - List loan items sorted by due date (authenticated)
- `GET /api/libraries` - The predefined library list, sorted by name
  (authenticated)
- `POST /api/libraries` - Add a library by name; the id is a slug of the
  name, duplicates are rejected (authenticated)
- `DELETE /api/libraries/{id}` - Remove a library from the list
  (authenticated)
- `POST /api/items/import` - Multipart upload of `front` and `back` photos
  plus an optional `library` (slug from the predefined list; absent means
  the user's own item); stages the photos, queues an import job and
  returns 202 with the job (authenticated)
- `GET /api/import-jobs` - Imports still in flight, plus recently
  completed ones (authenticated)
- `GET /api/import-jobs/{reference}/photo` - Staged front photo, used as
  the placeholder cover while an import is processed (authenticated)
- `POST /api/import-jobs/{reference}/retry` - Requeue a failed import
  using the staged photos (authenticated)
- `POST /api/import-jobs/{reference}/isbn` - Manually typed ISBN for an
  import waiting in NEEDS_ISBN; validates and resumes the job
  (authenticated)
- `DELETE /api/import-jobs/{reference}` - Dismiss a failed or
  ISBN-waiting import and delete its photos (authenticated)
- `GET /api/thumbnails/{isbn13}` - Cover thumbnail (JPEG, immutable cache,
  authenticated)
- `PUT /api/items/{id}/status` - Set an item's status (LOANED, NOT_STARTED,
  READING, READ, READ_RETURNED or UNREAD_RETURNED) (authenticated)
- `PUT /api/items/{id}/library` - Move an item to a library from the
  predefined list (by slug id) or, with a null library, to "My own";
  moving to own clears the due date and maps the status to reading
  progress, moving an own item to a library starts a fresh loan period
  (authenticated)
- `PUT /api/items/due-date` - Give every item in `ids` the same `dueDate`;
  an unknown id is a 404 and a selection containing an own item is a 400,
  so the change is never applied in part (authenticated)

## Data Model

- **loan_items** (schema `library`) - One row per item: ISBN-13 (unique,
  import upsert key), media type (BOOK, CD or DVD), title, author, library
  branch (null for own items), due date (null for own items), and the
  status (LOANED, NOT_STARTED, READING, READ, READ_RETURNED or
  UNREAD_RETURNED)
- **libraries** (schema `library`) - The predefined list managed on the
  settings page: `id` (slug of the name) and unique `name`
- **import_jobs** (schema `library`) - One row per queued import: public
  `reference` (UUID used in URLs), status (QUEUED, EXTRACTING, NEEDS_ISBN,
  GENERATING_COVER, COMPLETED, FAILED), the library picked at upload (null
  for own items), staged photo paths, the fields extracted so far, the
  resulting `loan_item_id`, a user-facing `error_detail`, and the
  attempt/backoff bookkeeping
- **ai_pacer** (schema `library`) - Single row holding
  `next_call_allowed_at`, the cluster-wide throttle on outbound AI calls
- Cover thumbnails live on disk (`storage.directory`, env
  `STORAGE_DIRECTORY`) as `thumbnails/{isbn13}.jpg`, not in the database
- Uploaded import photos are staged on the same disk as
  `imports/{reference}-front.{ext}` / `-back.{ext}`; they are deleted once
  the import completes or is dismissed, and kept while it is failed or
  waiting for a manual ISBN so a retry needs no new photos

## Authorization

- App role `LibraryUser` plus scopes `readItems` (queries) and `writeItems`
  (import, completion) - enforced via @PreAuthorize on the controllers

## Configuration Patterns

### Spring Profiles
- **prod** - Production with Azure Key Vault and AAD
- **local** - Local development with Podman DB
- **test** - Testing with disabled auth

## Native image and the baked-in Spring profile

The server is compiled ahead of time into a GraalVM native executable linked
against musl, so there is no JRE in the runtime image and startup is in the tens
of milliseconds rather than seconds.

Ahead-of-time processing resolves bean definitions at build time, which means
the active Spring profile is decided by the build, not by the environment:
Spring AOT emits an `EnvironmentPostProcessor` that activates the profile the
image was built with. `SPRING_PROFILES_ACTIVE` is no longer read at runtime, and
`test/test-pod.yaml` no longer sets it. Build one image per profile with the
`SPRING_PROFILE` build argument - `test` for the e2e pod, `prod` for the image
published to Docker Hub:

```bash
podman build --build-arg SPRING_PROFILE=test \
  -t localhost/library-app-server:test server
```

Build-time details that live in `server/pom.xml` and are easy to trip over:

- AOT processing refreshes the application context, so every placeholder an
  auto-configuration condition reads has to resolve during the build. The
  `process-aot` execution supplies build-time stand-ins for them and turns the
  Key Vault property source off, so the build never reaches out to Azure. The
  stand-ins are not baked into the image; they only have to make the same
  conditions match as the real values do at runtime. A new required environment
  placeholder read by a condition means adding it there too. Placeholders that
  are only read while creating beans (`${db-url}`, `${openai-api-key}`,
  `${STORAGE_DIRECTORY}`, the `import.*` timings) are resolved at runtime as
  before and need nothing.
- Spring AOT generates bean-definition classes into the packages of the
  configuration classes it processes, including the signed Spring Cloud Azure
  jars. Mixing generated (unsigned) and signed classes in one package makes the
  native-image builder throw `SecurityException: ... signer information does not
  match`, so the builder is pointed at `server/native-image.security`, which
  disables jar signature verification.
- Jars can ship a `META-INF/native-image/.../native-image.properties` that forces
  classes to build-time initialization. When such a class holds on to objects of
  types that are still initialized at run time, the builder fails with
  `UnsupportedFeatureException: An object of type ... was found in the image
  heap`. `--initialize-at-build-time` in the `native-maven-plugin` config covers
  the Jackson core classes `azure-core` leaves behind that way. Note that a build
  cannot undo such a directive: `exclude-config` does not apply to
  `native-image.properties`, and `initialize-at-run-time` for the same class is
  rejected outright. That is why `azure-core` is pinned ahead of the version the
  Azure BOM selects - the BOM's 1.58.0 forces SLF4J and logback to build-time
  initialization, which is irreconcilable with Spring Boot setting logging up at
  run time. Check this again when the Azure BOM moves.
- The Azure SDK's `ExpandableStringEnum` constants are built by instantiating the
  subclass reflectively, and `fromString` returns `null` rather than failing when
  it cannot. Missing reflection metadata therefore surfaces as every constant of
  a class being `null` and a `NullPointerException` far from the cause.
  `AzureNativeHints` registers the subclasses azure-identity does not ship
  metadata for.
- azure-core decides how to read a response body by asking the model class
  whether it declares the `fromXml` / `fromJson` pair azure-xml and azure-json
  generate, and it asks with `Class.getDeclaredMethods()`. In a native image that
  returns nothing for a class with no reachability metadata, so the answer is
  silently "no" and azure-core falls back to Jackson - for XML that means an
  `XmlMapper`, and jackson-dataformat-xml is not on the classpath, so the call
  dies with a `NoClassDefFoundError`. The SDK ships metadata for most of its
  models but not all. `AzureNativeHints` scans `com.azure` and registers every
  `XmlSerializable`, `JsonSerializable` and `HttpResponseException` instead of
  naming the ones missing today, so an SDK upgrade cannot reintroduce this.
- The Key Vault property source is configured by an `EnvironmentPostProcessor`
  that runs before there is an application context and reads its own settings
  with a plain `Binder` over `AzureKeyVaultSecretProperties`. Nothing in the
  framework infers that, and the auto-configuration that would otherwise
  contribute the binding metadata for that type never matches here - it is
  conditional on `spring.cloud.azure.keyvault[.secret].endpoint`, while this
  application configures the endpoint under `...secret.property-sources[0]`. With
  no members in the image the binder binds nothing, and an absent binding is
  indistinguishable from an empty configuration, so the post-processor quietly
  concludes there is no property source to add. Nothing fails at that point: the
  image starts and then dies much later on the first secret-backed placeholder.
  `KeyVaultPropertySourceNativeHints` supplies the metadata. Only the prod
  profile reads secrets from Key Vault, so no test covers this - after changing
  anything about the Key Vault configuration, check that the generated
  `target/spring-aot/main/resources/META-INF/native-image/**/reachability-metadata.json`
  still carries `AzureKeyVaultSecretProperties` and
  `AzureKeyVaultPropertySourceProperties` with their accessors.
- Both AI calls go through the official OpenAI Java SDK - Spring AI's OpenAI
  module builds its chat requests with it, and `ThumbnailService` calls the
  image edit endpoint on it directly. The SDK is Kotlin, and its Jackson mapper
  reads constructors through `jackson-module-kotlin`, which in a native image
  without reflection metadata fails at request time with
  `KotlinReflectionInternalError: Could not compute caller for function`. The
  SDK ships a recorded `reflect-config.json`, but it registers every model of
  every API the SDK has (twelve thousand types, each field dragging its type
  along), which grows the image by tens of thousands of types nothing here
  calls and runs the native-image builder out of memory - it has roughly 12GB
  on a GitHub runner. The build therefore excludes that one file
  (`--exclude-config` in `server/pom.xml`; the SDK's proxy, resource,
  serialization and JNI metadata stay), and `OpenAiNativeHints` replays it
  minus the unused model packages - what it records for Jackson's serializers
  and Kotlin's reflection is still needed, and dropping it fails the first AI
  call with `NullSerializer has no default (no arg) constructor`. On top of
  that it registers the model packages this application reaches (chat
  completions, completion usage, images, core, errors, the top-level models)
  wholesale, so the next SDK model Spring AI reaches for cannot fail the same
  way. Reaching for another SDK API means adding its package to
  `USED_MODEL_PACKAGES` there, and watching the builder's reachable-types line
  when widening any scan-based hint.
- The reachability metadata the GraalVM repository ships for liquibase-core
  was recorded with the tracing agent, so every entry carries a `typeReached`
  condition naming whichever class was on the stack during the recording, and
  only becomes active once that class is reached at run time. The getters a
  changeset checksum needs are recorded under `UpdateVisitor` - the path a
  first migration takes, and so the only path the e2e pod's empty database
  ever exercised. Against a database that already carries the changelog,
  `ValidatingVisitor` recomputes every applied changeset's checksum before
  any update visitor exists, and the first such getter dies with
  `MissingReflectionRegistrationError` - which is what every production
  redeploy does, and what no fresh database shows. `LiquibaseNativeHints`
  registers the whole serializable model (every `LiquibaseSerializable`:
  changes, preconditions, column and constraint configs) unconditionally, and
  `scripts/pod_up.sh` restarts the server once after the pod is up so the
  e2e run also starts against a migrated database. Keep that restart: it is
  the only check of that path before deploy. This also does not reproduce on
  the AOT-on-JVM run below.
- `ItemExtractionService` binds the model's answer into `ExtractedItem` via
  Spring AI's `BeanOutputConverter`, which reads the record reflectively twice:
  victools walks its components to generate the JSON schema sent with the
  prompt, and Jackson binds the reply through the canonical constructor. The
  framework's AOT processing sees neither, hence the
  `@RegisterReflectionForBinding(ExtractedItem.class)` on the service. A new
  structured-output type needs the same.

Spring Cloud Azure needs one workaround in application code:
`AzureGlobalPropertiesConfiguration` re-declares the `AzureGlobalProperties`
bean. Spring Cloud Azure registers it from an `ImportBeanDefinitionRegistrar`
using a lambda instance supplier, which AOT cannot turn into generated code, so
it drops the bean and the image fails to start with "required a bean of type
AzureGlobalProperties that could not be found". See the class comment for why it
uses its own bean name. That workaround turns on Spring Cloud Azure's
registration order, which is not a public contract, so smoke-test the image
whenever `spring-cloud-azure-dependencies` moves - a change there could drop the
bean again with no compile-time signal.

The image is deliberately not built with `--static`. A fully static binary links
but then segfaults the moment it starts in the container - before GraalVM
installs its own segfault handler, so with no output whatsoever, which looks
exactly like a container that silently never starts.

The executable is started with `-XX:MaxHeapSize=512m` (see `server/Dockerfile`):
an import holds both photos, their base64 copies in the chat request and the
multipart image edit in memory at once, so the cap is sized for that, and the
memory limit in `scripts/deploy.sh` is sized to hold the cap plus the
executable's own footprint. Change the two together.

### Reproducing AOT problems without a native build

Most AOT problems reproduce without waiting for a native compile (which takes
several minutes). Run the AOT-processed application on a normal JVM:

```bash
cd server
mvn -Pnative package -DskipTests -Dapp.profile=test
java -Dspring.aot.enabled=true -jar target/library-app-0.0.1-SNAPSHOT.jar
```

That exercises the generated context - missing bean definitions, profile and
condition mismatches - in seconds. Only class-initialization and reflection
problems need the real `mvn -Pnative native:compile`.

Types that are only ever bound reflectively need explicit hints. Controller
request/response types, JPA entities and Spring Data repositories are covered by
the framework's own AOT processing and need nothing. Types read with a plain
`ObjectMapper` want `@RegisterReflectionForBinding` (see `ExtractedItem`);
types bound by a `Binder` rather than Jackson want
`BindableRuntimeHintsRegistrar`, which registers exactly what `JavaBeanBinder`
looks for over the whole class hierarchy - see
`KeyVaultPropertySourceNativeHints`.

### Release and image publishing

`publish-server` and `publish-client` each ask `mucsi96/get-next-version` for a
version. It answers from the newest `server-N` / `client-N` tag: no changes under
the component's directory since that tag means no version, and every publish step
is skipped. The release step must therefore tag the commit its image was built
from - `target_commitish: ${{ github.sha }}` - because the action otherwise tags
whatever the default branch points at when the release is created, and the
server's native build takes long enough that another push can land first. A tag
left on a commit that was never built makes the next run believe that commit is
already released, so nothing is published for it. That is silent: `deploy`
resolves the newest tag on Docker Hub by `last_updated` and succeeds, deploying
the previous commit's image, so a fix can look deployed while the running image
predates it. When a change does not reach production, check that a release tag
exists on the commit and that `publish-server` did not skip its build steps.

### Environment Config
- Server exposes `/api/environment` endpoint
- Client fetches config before bootstrap
- Conditionally enables MSAL based on `mockAuth` flag
