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
- Mark items as read (books) or listened (CDs) so they aren't borrowed again
- Import a borrowed item by photographing its front and back (camera
  capture input, so iPhone opens the photo app); GPT-5 extracts ISBN,
  title, author, media type and library branch from the photos, and the
  ISBN is validated (ISBN-10 converted, 978/979 prefix and check digit)
  server-side
- gpt-image-2 generates a cover thumbnail from the front photo with the
  library markings (stickers, labels, barcodes) removed; it is stored on
  disk as `{isbn13}.jpg`, served from an authenticated endpoint, and shown
  in the loans list
- Items are matched by ISBN, so re-imports refresh the due date without
  duplicating items, losing the read/listened flag, or regenerating the
  existing thumbnail
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
  extracts and validates the ISBN, generates the thumbnail, upserts the
  item by ISBN (authenticated)
- `GET /api/thumbnails/{isbn13}` - Cover thumbnail (JPEG, immutable cache,
  authenticated)
- `PUT /api/items/{id}/completed` - Mark an item as read/listened (authenticated)

## Data Model

- **loan_items** (schema `library`) - One row per borrowed item: ISBN-13
  (unique, import upsert key), media type (BOOK or CD), title, author,
  library branch, due date, and the completed (read/listened) flag
- Cover thumbnails live on disk (`storage.directory`, env
  `STORAGE_DIRECTORY`) as `thumbnails/{isbn13}.jpg`, not in the database

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
