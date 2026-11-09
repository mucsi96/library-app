# Gateway authentication and Azure static hosting

Implements [issue #34](https://github.com/mucsi96/library-app/issues/34), following
[the shared architecture](https://github.com/mucsi96/skeleton-app/issues/105).

The app's document route authenticates through a per-app Entra/oauth2-proxy
session before returning HTML. OAuth tokens stay in the gateway/Redis session;
Angular reads `/oauth2/userinfo` for the avatar. An API 401 re-enters login with
the current path/query. Mutations are never automatically replayed.

The API chart authenticates sessions and strips incoming credentials before
forwarding the verified bearer token. Spring validates issuer/audience,
`api-access`, `readItems` and `writeItems`. Its secure host-only CSRF cookie and
Angular header protect all mutations, including multipart photo import. The
explicit CSRF matcher is necessary because bearer requests normally bypass it.

CI builds the client once, tests that artifact and archives it with the release.
`prepare-client.mjs` rewrites script/link assets to public Blob storage, keeping
the document base and manifest navigation on the application origin. Fonts and
lazy modules are bundled. Assets upload before index; old hashed bundles remain
available. The static-client-app 5.0.0 chart serves documents from Azure's HTTPS
website origin; production has no client Deployment. Faro's app name and
same-origin `/_telemetry/collect` endpoint are compiled in.

## Rollout dependency

The [companion p07 PR #67](https://github.com/mucsi96/p07/pull/67) adds Library's confidential Web registration,
ForwardAuth, Azure storage/CORS/upload grants, deployment configuration secrets
and same-origin Faro route. Provision and verify that infrastructure before
merging this application PR. The legacy SPA registration and its client-id
secret are retained through the rollout window.

Deploy reads `forward-auth-config` and `client-storage-config` from the app vault,
requires the auth Helm release to exist, and uses pinned spring-app 37.0.0 and
static-client-app 5.0.0 charts with `--reset-values`. The API registration,
OpenAI integration, schema/migrations, workload identity, library-app-pvc,
storage mount, heap and memory limits retain their contracts.

After rollout, verify signed-out document redirect/API 401, signed-in deep
links, imports/cover retrieval, status updates and bulk renewal, session expiry,
Blob CORS and Faro 202. Infrastructure apply and live validation are operator
steps; local tests do not claim to verify production sessions.
