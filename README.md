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
  author and library branch from the photos, and gpt-image-2 generates a
  clean cover thumbnail with the library markings removed. Items are
  matched by ISBN so re-imports refresh due dates instead of creating
  duplicates

## Patterns Covered

- **CI/CD Pipeline** - GitHub Actions with E2E testing and image publishing
- **Deployment** - Docker multi-stage builds with Traefik reverse proxy
- **Client** - Angular with Material UI dark theme
- **Server** - Spring Boot 4 with Java 21, compiled ahead of time into a GraalVM native image
- **Authentication** - Azure AD (MSAL) with conditional mock auth for testing
- **Configuration** - Azure Key Vault + Spring profiles (prod/local/test)
- **Database** - PostgreSQL with Spring Data JPA
- **AI integration** - OpenAI GPT-5 (vision) via Spring AI and
  gpt-image-2 via the official OpenAI Java SDK, with a mock OpenAI server
  for tests
- **Testing** - Playwright E2E tests

## One image per Spring profile

The server is shipped as a GraalVM native executable. Bean definitions are
resolved during ahead-of-time processing at build time, so the active Spring
profile is baked into the executable and cannot be chosen at startup any more.
The server image is therefore built once per profile, via the `SPRING_PROFILE`
build argument:

```bash
podman build --build-arg SPRING_PROFILE=test -t library-app-server:test server   # e2e pod
podman build --build-arg SPRING_PROFILE=prod -t library-app-server:prod server   # published image
```

`SPRING_PROFILES_ACTIVE` is not read at runtime; the pipeline builds the test
image for the e2e job and the prod image when publishing to Docker Hub. Running
the server on a JVM for local development is unaffected - `mvn spring-boot:run
-Dspring-boot.run.profiles=local` still selects the profile the usual way.

## Port Mapping

All host-exposed ports use the **xx50–xx59** range for their last two digits to avoid clashes with other local projects.

| Port | Service              | Context                             |
|------|----------------------|-------------------------------------|
| 4250 | Angular dev server   | Local dev                           |
| 5450 | PostgreSQL           | Dev database                        |
| 5451 | PostgreSQL           | Test pod                            |
| 3070 | Mock OpenAI server   | Test pod                            |
| 8050 | Mock OAuth2 provider | Test pod                            |
| 8053 | Spring Boot server   | Local dev (VSCode)                  |
| 8054 | Spring Boot server   | Test pod (internal, behind Traefik) |
| 8150 | Traefik (web)        | Test pod                            |
| 8151 | Traefik (admin)      | Test pod                            |
| 8152 | Spring Actuator      | Local dev & test                    |

## Development Environment

System tooling (JDK 21, Maven, Node, jq, kubectl, helm, azure-cli) is provided by
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

```bash
# Start test stack
scripts/pod_up.sh

# Run E2E tests
cd test && npm test
```
