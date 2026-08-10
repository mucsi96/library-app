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
- Track each item's status (loaned, reading, read, read & returned,
  returned unread - with listening/listened wording for CDs), each shown
  as a colored tag, so finished items aren't borrowed again; the status
  is changed from a detail modal (large cover, ISBN, status chips)
  opened by tapping an item
- Import a borrowed item by photographing its front and back (camera
  capture input, so iPhone opens the photo app); GPT-5 extracts ISBN,
  title, author, media type and library branch from the photos, and the
  ISBN is validated (ISBN-10 converted, 978/979 prefix and check digit)
  server-side
- Importing is asynchronous: the upload stages both photos and returns
  202 immediately, so the import page clears itself and the next item can
  be captured right away (batch capture at the library counter). A paced
  background worker does the AI work and the client polls for progress,
  shown as "Processing" cards above the loans list that use the user's own
  front photo as the placeholder cover and fill in as each stage
  completes. A failed import can be retried without retaking the photos,
  or dismissed
- Outbound AI calls are rate-limit safe: jobs are claimed one at a time
  with `FOR UPDATE SKIP LOCKED` and gated by a single-row `ai_pacer`
  table, so no more than one job per `import.min-job-interval` runs across
  all replicas. Rate limits and other transient errors back off
  exponentially (honouring `Retry-After`) and give up after
  `import.max-attempts`; an unreadable ISBN fails immediately without
  spending further calls
- gpt-image-2 generates a cover thumbnail from the front photo with the
  library markings (stickers, labels, barcodes) removed; it is stored on
  disk as `{isbn13}.jpg`, served from an authenticated endpoint, and shown
  in the loans list
- Items are matched by ISBN, so re-imports refresh the due date without
  duplicating items, losing the read status, or regenerating the existing
  thumbnail; on re-import a returned item goes back on loan (read &
  returned becomes read, returned unread becomes loaned)
- The due date is computed as import date + `loan-period-days` (28)

## Architecture

- **client/** - Angular SPA with Material UI, MSAL authentication
- **server/** - Spring Boot REST API with PostgreSQL
- **mock_openai_server/** - Express mock of the OpenAI API for E2E tests
- **test/** - Playwright E2E tests
- **scripts/** - Build and deployment scripts
- **.github/workflows/** - CI/CD pipelines

## Key Technologies

- Spring Boot 4, Java 21
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
- `POST /api/items/import` - Multipart upload of `front` and `back` photos;
  stages them, queues an import job and returns 202 with the job
  (authenticated)
- `GET /api/import-jobs` - Imports still in flight, plus recently
  completed ones (authenticated)
- `GET /api/import-jobs/{reference}/photo` - Staged front photo, used as
  the placeholder cover while an import is processed (authenticated)
- `POST /api/import-jobs/{reference}/retry` - Requeue a failed import
  using the staged photos (authenticated)
- `DELETE /api/import-jobs/{reference}` - Dismiss a failed import and
  delete its photos (authenticated)
- `GET /api/thumbnails/{isbn13}` - Cover thumbnail (JPEG, immutable cache,
  authenticated)
- `PUT /api/items/{id}/status` - Set an item's status (LOANED, READING,
  READ, READ_RETURNED or UNREAD_RETURNED) (authenticated)

## Data Model

- **loan_items** (schema `library`) - One row per borrowed item: ISBN-13
  (unique, import upsert key), media type (BOOK or CD), title, author,
  library branch, due date, and the status (LOANED, READING, READ,
  READ_RETURNED or UNREAD_RETURNED)
- **import_jobs** (schema `library`) - One row per queued import: public
  `reference` (UUID used in URLs), status (QUEUED, EXTRACTING,
  GENERATING_COVER, COMPLETED, FAILED), staged photo paths, the fields
  extracted so far, the resulting `loan_item_id`, a user-facing
  `error_detail`, and the attempt/backoff bookkeeping
- **ai_pacer** (schema `library`) - Single row holding
  `next_call_allowed_at`, the cluster-wide throttle on outbound AI calls
- Cover thumbnails live on disk (`storage.directory`, env
  `STORAGE_DIRECTORY`) as `thumbnails/{isbn13}.jpg`, not in the database
- Uploaded import photos are staged on the same disk as
  `imports/{reference}-front.{ext}` / `-back.{ext}`; they are deleted once
  the import completes or is dismissed, and kept while it is failed so a
  retry needs no new photos

## Authorization

- App role `LibraryUser` plus scopes `readItems` (queries) and `writeItems`
  (import, completion) - enforced via @PreAuthorize on the controllers

## Configuration Patterns

### Spring Profiles
- **prod** - Production with Azure Key Vault and AAD
- **local** - Local development with Podman DB
- **test** - Testing with disabled auth

### Environment Config
- Server exposes `/api/environment` endpoint
- Client fetches config before bootstrap
- Conditionally enables MSAL based on `mockAuth` flag
