# Library App

Track the books and CDs you borrowed from different libraries: see when each
item is due back, and mark items as read or listened so you don't take them
out again. Based on the patterns from
[skeleton-app](https://github.com/mucsi96/skeleton-app).

## Features

- **Loans list** - All borrowed items sorted by due date, with overdue and
  due-soon reminders
- **Read / listened tracking** - Mark a book as read or a CD as listened;
  the flag survives re-imports so you know what not to borrow again
- **HTML import** - Paste the HTML of your library account's loans table
  (rTable markup) to import or refresh your loans; items are matched by
  barcode so re-imports update due dates instead of creating duplicates

## Patterns Covered

- **CI/CD Pipeline** - GitHub Actions with E2E testing and image publishing
- **Deployment** - Docker multi-stage builds with Traefik reverse proxy
- **Client** - Angular with Material UI dark theme
- **Server** - Spring Boot with Java 21
- **Authentication** - Azure AD (MSAL) with conditional mock auth for testing
- **Configuration** - Azure Key Vault + Spring profiles (prod/local/test)
- **Database** - PostgreSQL with Spring Data JPA
- **Testing** - Playwright E2E tests

## Port Mapping

All host-exposed ports use the **xx50–xx59** range for their last two digits to avoid clashes with other local projects.

| Port | Service              | Context                             |
|------|----------------------|-------------------------------------|
| 4250 | Angular dev server   | Local dev                           |
| 5450 | PostgreSQL           | Dev database                        |
| 5451 | PostgreSQL           | Test pod                            |
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
