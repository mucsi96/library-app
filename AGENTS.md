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
- Import loans by pasting the HTML of the library account's loans table
  (rTable markup); items are matched by barcode, so re-imports refresh
  loan details without duplicating items or losing the read/listened flag
- Imports look items up on Google Books (client-side, best effort) to pull
  ISBN and cover thumbnail; a stored ISBN is reused for exact lookups and
  never overwritten with nothing, covers are shown in the loans list

## Architecture

- **client/** - Angular SPA with Material UI, MSAL authentication
- **server/** - Spring Boot REST API with PostgreSQL
- **test/** - Playwright E2E tests
- **scripts/** - Build and deployment scripts
- **.github/workflows/** - CI/CD pipelines

## Key Technologies

- Spring Boot 4, Java 21
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
- `POST /api/items/import` - Upsert loan items by barcode (authenticated)
- `PUT /api/items/{id}/completed` - Mark an item as read/listened (authenticated)

## Data Model

- **loan_items** (schema `library`) - One row per borrowed item: barcode
  (unique, import upsert key), media type (BOOK or CD), title, author,
  category, library branch, due date, note, ISBN and cover thumbnail URL
  (from Google Books), and the completed (read/listened) flag

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
