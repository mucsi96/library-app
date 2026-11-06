# Library App - Development Guidelines

## Code Review Rules

- Review the PR diff for actionable correctness, security, data-loss, and deployment regressions; cite the changed file/line and concrete impact.
- Preserve authentication boundaries, persisted data compatibility, and the project's documented build/test/deploy contracts. Adapt shared patterns to this project's stack.
- Report missing behavioral coverage where it would catch a specific regression; leave formatting and mechanical checks to CI.

## Codex automation

Use native Codex GitHub reviews and `@codex` PR tasks with ChatGPT sign-in.
Setup: https://github.com/mucsi96/skeleton-app/blob/main/docs/codex-automation.md
Skeleton sync: follow `.github/prompts/sync-skeleton.md` in a weekly scheduled task.

## Code Style

- Avoid fallbacks, prefer failing fast.
- Prefer functional patterns and immutable data.
- Rust: use Loco lifecycle/CLI, thin Axum controllers, typed Serde payloads/settings,
  SeaORM models/migrations, typed service errors, and structured tracing.
- TypeScript: use `const`, spreads, functional array methods and string literals over enums.
- React: function components and hooks; TanStack Query for server state.
- Validate API responses with Zod; keep credentials at the gateway and send the
  host-only CSRF proof on same-origin mutations, including photo uploads.
- Use `@mucsi96/react-ui` controls and semantic button tones, colocated CSS Modules
  and public `--bt-*` tokens. Dark theme and skeleton loaders.
- Lazy route components; domain helpers in `client/src/domain`.
- Keep lazy routes inside the route error boundary so a failed bundle download
  offers a document reload (React caches rejected lazy imports) while navigation
  stays usable. Preserve the deep link on reload.
- Verify behavior through Playwright with role/semantic selectors. Do not add Rust
  unit/integration tests or React unit/component tests. Run Rust format, Clippy and build checks.

## Architecture

- `client/`: React 19/Vite SPA with react-ui, gateway cookie authentication.
- `server/`: Rust/Loco REST API, SeaORM/PostgreSQL 17; native distroless container.
- `server/src/controllers/`: HTTP payloads and routes; business logic belongs in services.
- `server/src/services/`: catalog, durable import queue, OpenAI and disk storage.
- `server/src/middleware/`: JWT authorization and host-only double-submit CSRF.
- `server/config/`: development/test/production runtime configuration.
- `server/migration/`: irreversible baseline adopting the existing `library` schema.
- `mock_openai_server/`: Express mock of OpenAI for E2E tests.
- `test/`: Playwright tests; `scripts/`: build/deployment; `.github/workflows/`: CI/CD.

## Business and persistence contracts

- Track books, CDs and DVDs with due dates, overdue and due-soon reminders.
- Status values are `LOANED`, `NOT_STARTED`, `READING`, `READ`, `READ_RETURNED`,
  `UNREAD_RETURNED`; UI wording adapts to reading/listening/watching.
- Quick filters select type, library and status. Narrowing filters removes hidden
  rows from selection. Bulk due-date changes are atomic; unknown IDs produce 404,
  any own item produces 400.
- The detail modal changes status/library. Moving to own removes the due date,
  maps loaned/unread-returned to not-started and read-returned to read. Moving an
  own item to a library starts a fresh 28-day loan and maps not-started to loaned.
- Import source is explicitly picked from predefined libraries (slug IDs) or
  "My own"; never AI-guessed. Two photos are staged, then upload returns 202.
- GPT-5 extracts ISBN/title/author/mediaType. Normalize ISBN-10 to ISBN-13;
  validate the 978/979 prefix and ISBN-13 check digit.
- Missing ISBN parks the job as `NEEDS_ISBN`, retaining extraction and photos.
  Manual entry validates and resumes without another extraction call.
- gpt-image-2 cleans library markings from the front photo. Covers live at
  `thumbnails/{isbn13}.jpg` under `STORAGE_DIRECTORY`, never in the database.
- Imports use `imports/{reference}-front.{ext}` / `-back.{ext}`. Keep photos for
  failures/manual ISBN entry; delete after completion or dismissal.
- Jobs are claimed with `FOR UPDATE SKIP LOCKED`; `ai_pacer` throttles starts
  cluster-wide. Retry transient provider errors with exponential backoff and
  Retry-After, up to the configured attempt limit. Sweep stale/expired jobs.
- Reimports upsert on ISBN, refresh due dates and preserve read progress/covers.
  Returned items return to their corresponding active loan status.
- Own items have null library/dueDate and start as `NOT_STARTED`.
- Preserve tables, identifiers, sequences and files on deployment. The baseline
  adopts existing tables; it never reseeds user data. Retain existing Liquibase
  metadata in deployed databases. Do not run destructive Loco database commands.
- Tables: `library.loan_items`, `libraries`, `import_jobs`, `ai_pacer`.
  `import_jobs.reference` is the public UUID, distinct from its internal bigint ID.

## API and authorization

- `/oauth2/*` is gateway-owned; tokens remain server-side.
- `/api/items`: GET list; POST `/import` multipart front/back and optional library;
  PUT `/due-date` with ids/dueDate; PUT `/{id}/status` and `/{id}/library`.
- `/api/libraries`: GET list, POST name, DELETE `/{id}`.
- `/api/import-jobs`: GET visible jobs; GET `/{reference}/photo`, POST
  `/{reference}/retry`, POST `/{reference}/isbn`, DELETE `/{reference}`.
- `/api/thumbnails/{isbn13}`: authenticated JPEG with immutable caching.
- `/healthz`: public database readiness, used by container/Kubernetes probes.
- Require issuer/audience/signature/expiry/nbf, `api-access` scope and `readItems`
  for reads or `writeItems` for mutations. Gateway strips browser credentials and
  supplies the bearer token; the API still validates it.
- Mutations require the `__Host-XSRF-TOKEN` cookie and matching `X-XSRF-TOKEN`
  header even with bearer authentication. No browser token storage or refresh.

## Development and verification

```bash
cd client && npm start
cd client && npm run lint && npm run typecheck && npm run build
cd server && cargo run -- start --environment development
cd server && cargo fmt --all --check
cd server && cargo clippy --workspace --all-targets --locked -- -D warnings
cd server && cargo build --release --locked
scripts/pod_up.sh
scripts/pod_down.sh
scripts/dev_db_up.sh
scripts/dev_db_down.sh
cd test && npm test
```

See README for required runtime variables. Production loads database credentials,
tenant ID, API audience and OpenAI key from Azure Key Vault using workload identity.
One image supports every runtime environment via `LOCO_ENV`; no build-time profiles.
Keep the restart in `scripts/pod_up.sh` to exercise already-migrated startup.

## Release and deployment

- Publish numbered GHCR images only when `get_next_version.outputs.hasNextVersion`
  is true, using its version directly. Job-scoped `packages: write`, `GITHUB_TOKEN`.
  Release tags target `${{ github.sha }}`. The package must allow anonymous pulls.
- Serialize publication/rollout; require numbered tags or digests.
- Production uses rust-app 7.0.0 and static-client-app 5.0.0 with gateway auth
  and `--reset-values`. Keep library-app-pvc, its volume binding and storage mount.
  The nonroot runtime uses fsGroup 65532 for existing writable storage.
- Preserve import memory headroom; a job holds two photos and encoded copies.
- Build/test/archive the static artifact. Deployment rewrites document asset URLs
  to public Azure Blob storage, empties `$web` and `assets`, then uploads assets
  before index HTML. Deployment downtime and removal of old bundles are intentional.
- No client container in production; Nginx serves test artifacts only.
- Faro name `library-client` and same-origin `/_telemetry/collect` are compiled in.
  No runtime config endpoint or document injection.
- Profile comes from `/oauth2/userinfo`; 401 enters gateway login with the deep link.
- E2E fixtures substitute gateway bearer injection/userinfo while retaining API
  JWT/CSRF validation. Shared chart suites cover the gateway itself.
- `test/tests/static-assets.spec.ts` verifies cross-origin lazy routes, CORS,
  credential omission, manifest navigation and same-origin Faro.
- See `docs/gateway-static-hosting.md` for the coordinated p07 rollout.
