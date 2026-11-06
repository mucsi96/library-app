# Library App

Track the books and CDs you borrowed from different libraries: see when each
item is due back, and track each item's status (loaned, reading, read,
read & returned, returned unread) so you don't take finished items out
again. Based on the patterns from
[skeleton-app](https://github.com/mucsi96/skeleton-app).

## Features

- **Loans list** - All borrowed items sorted by due date, with overdue and
  due-soon reminders
- **Status tracking** - Each item is loaned, reading, read, read &
  returned or returned unread (listening/listened for CDs), shown as a
  colored tag; tap an item to open its detail modal with the large
  cover, ISBN and status chips. Read progress survives re-imports so you
  know what not to borrow again
- **Photo import** - Photograph the front and back of a borrowed item
  (on iPhone the camera opens directly); GPT-5 reads the ISBN, title,
  author and media type from the photos (the source library is picked explicitly), and gpt-image-2 generates a
  clean cover thumbnail with the library markings removed. Items are
  matched by ISBN so re-imports refresh due dates instead of creating
  duplicates

## Patterns Covered

- **CI/CD Pipeline** - GitHub Actions with E2E testing, native API images and tested static client artifacts
- **Deployment** - Gateway-authenticated Azure static hosting and Traefik API routing
- **Client** - React, Vite and TypeScript with `@mucsi96/react-ui`, TanStack Query, Zod and CSS Modules
- **Server** - Rust/Loco with SeaORM, compiled into a native distroless image
- **Authentication** - Entra/oauth2-proxy HttpOnly sessions with backend JWT/role and CSRF validation
- **Configuration** - Azure Key Vault workload identity + Loco runtime environments
- **Database** - PostgreSQL with SeaORM models and migrations
- **AI integration** - OpenAI GPT-5 (vision) and gpt-image-2 over typed HTTP clients,
  with a mock OpenAI server
  for tests
- **Testing** - Playwright E2E tests

## Backend runtime

One native image serves development, test and production. Loco reads the runtime
environment from `LOCO_ENV` (or `--environment`). Production loads `db-url`,
`db-username`, `db-password`, `tenant-id`, `api-client-id` and `openai-api-key`
from `AZURE_KEYVAULT_ENDPOINT` using Azure workload identity. Existing JDBC-form
PostgreSQL URLs remain supported in Key Vault. Storage uses `STORAGE_DIRECTORY`.

```bash
podman build -t localhost/library-app-server:test server
cd server
cargo fmt --all --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo build --release --locked
```

For local development, set `DATABASE_URL` (for example
`postgresql://postgres:postgres@localhost:5450/library`), `OIDC_ISSUER`,
`API_CLIENT_ID`, `OPENAI_BASE_URL` (normally `https://api.openai.com/v1`),
`OPENAI_API_KEY` and `STORAGE_DIRECTORY`, then run
`cargo run -- start --environment development` from `server/`.
The toolchain is pinned in `server/rust-toolchain.toml`.

`/healthz` reports database readiness. The container also supports `--healthcheck`
for shell-free probes. Production uses rust-app 7.0.0 with the existing
`library-app-pvc` and fsGroup 65532 so the nonroot process can write existing files.
Keep storage mounted at `/app/storage` when upgrading.

The SeaORM baseline creates a fresh database or adopts the deployed `library`
tables without rewriting rows, IDs, sequences or photos. Existing Liquibase
metadata is left intact. Never reset/reseed the production database. Import jobs
retain their UUIDs, staged paths, attempts and extracted fields across upgrades;
interrupted jobs are recovered by the stale-job sweep.

## Port Mapping

All host-exposed ports use the **xx50–xx59** range for their last two digits to avoid clashes with other local projects.

| Port | Service              | Context                             |
|------|----------------------|-------------------------------------|
| 4250 | Vite dev server      | Local dev                           |
| 5450 | PostgreSQL           | Dev database                        |
| 5451 | PostgreSQL           | Test pod                            |
| 3070 | Mock OpenAI server   | Test pod                            |
| 8050 | Mock OAuth2 provider | Test pod                            |
| 8053 | Rust/Loco server     | Local dev (VSCode)                  |
| 8054 | Rust/Loco server     | Test pod (internal, behind Traefik) |
| 8150 | Traefik (web)        | Test pod                            |
| 8151 | Traefik (admin)      | Test pod                            |

## Development Environment

System tooling (rustup, Node, jq, kubectl, helm, azure-cli) is provided by
a Nix flake dev shell:

```bash
nix develop          # enter the dev shell manually
# or, with direnv installed, `direnv allow` once and it loads automatically
```

Then install the per-project dependencies:

```bash
scripts/install_dependencies.sh
```

**Podman** is a distro-level prerequisite and is not managed by the flake
(rootless Podman needs setuid `newuidmap`/`newgidmap` helpers the Nix store
cannot provide). On WSL, enable `systemd=true` in `/etc/wsl.conf` and install it
via your distro, e.g. `apt install podman`.

## Quick Start

The frontend requires Node.js 24 or newer:

```bash
cd client
npm ci
npm start           # Vite on port 4250; API and gateway requests stay same-origin
npm run lint
npm run typecheck
npm run build       # Tested static artifact in client/dist
```

React function components own interaction state; TanStack Query owns API state
and import polling, and Zod validates API responses. Routes (`/`, `/import`,
`/settings`) are lazy-loaded. Domain helpers live in `client/src/domain`, with
component styles colocated as CSS Modules. No frontend unit tests are required:
Playwright covers the user journeys, keyboard/mobile interactions, error recovery,
and real cross-origin static asset loading.

```bash
# Start test stack
scripts/pod_up.sh

# Run E2E tests
cd test && npm test
```

The test fixture supplies gateway identity via the mock OIDC issuer; the test
pod does not run a production OAuth session gateway. For manual local browsing,
use a local gateway session setup rather than placing tokens in browser storage.
Run `node --test scripts/prepare-client.test.mjs` from the repository root to
check client publication preparation.

See [gateway/static hosting](docs/gateway-static-hosting.md) for the architecture
and coordinated infrastructure rollout.
