# HttpApi Migration Status

This migration is **not done** and is **deferred** for now.

Patientor still serves public HTTP endpoints with Effect's `HttpRouter`. That is
the preferred option until the product needs generated OpenAPI, typed Effect
clients, or a single schema-first backend contract.

The current user impact is good enough: `curl`, browser `fetch`, Postman, and
non-Effect clients can already call the same public HTTP paths. Moving to
`HttpApi` should be treated as a contract/documentation investment, not as a
bug fix.

## Current Routes

The server currently exposes these public routes:

- `GET /api/ping`
- `GET /api/diagnoses`
- `GET /api/patients`
- `GET /api/patients/:id`
- `POST /api/patients`
- `POST /api/patients/:id/entries`

The current route implementation lives in:

- `src/http/routes.ts`
- `src/diagnoses/http.ts`
- `src/patients/http.ts`

## Decision

Keep `HttpRouter` now.

Move to `HttpApi` only when at least one of these is an active product or
platform goal:

- generated OpenAPI from the server contract
- typed Effect clients for a frontend or another service
- contract-first request and response schemas
- endpoint-level middleware/security metadata that should appear in API docs

This matches the local playbook in `.best-practices/08-httpapi.md`: do not add
the extra contract layer just because the package supports it.

## Installed Effect v4 Shape

The repo currently uses `effect@4.0.0-beta.65` and
`@effect/platform-node@4.0.0-beta.65`.

The installed `node_modules/effect` package exports `HttpApi` from:

```ts
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  OpenApi,
} from "effect/unstable/httpapi";
```

Useful installed APIs:

- `HttpApi.make("patientor")`
- `HttpApiGroup.make("patients")`
- `HttpApiEndpoint.get(...)`, `post(...)`, `put(...)`, `patch(...)`, `del(...)`
- `HttpApiSchema.status("Created")` for JSON responses with non-200 status
- `HttpApiSchema.Created`, `NoContent`, `Accepted`, and `Empty(status)` for
  empty responses
- `HttpApiBuilder.group(api, "patients", handlers => ...)`
- `HttpApiBuilder.layer(api, { openapiPath: "/openapi.json" })`
- `OpenApi.annotations({ title, version })`

Always verify exact API shapes against the installed package before writing the
migration. The `unstable` import path is part of the current beta surface.

## Future Migration Shape

When the migration becomes valuable, move one route group at a time and keep the
public paths unchanged unless product explicitly chooses a versioned API.

Recommended order:

1. Define API schemas for existing response and request bodies.
2. Add a diagnoses `HttpApiGroup` for `GET /api/diagnoses`.
3. Add patient read endpoints for `GET /api/patients` and
   `GET /api/patients/:id`.
4. Add patient creation for `POST /api/patients`.
5. Add entry creation for `POST /api/patients/:id/entries`.
6. Decide whether `GET /api/ping` belongs in the typed API contract.
7. Register the API with `HttpApiBuilder.layer(...)` and expose OpenAPI only in
   the environments product wants.
8. Remove old `HttpRouter` routes only after regression tests pass.

## Behavior To Preserve

For each migrated route, add or update HTTP regression tests that prove current
behavior did not drift:

- invalid path params return `400`
- malformed or schema-invalid JSON bodies return `400`
- missing patients return `404`
- successful patient and entry creation return `201`
- read/write failures return `500`
- patient list/detail responses do not expose `ssn`
- existing public paths continue to work

## Open Questions Before Starting

- Should the public API remain unversioned at `/api`, or move to `/api/v1`?
- Should `/openapi.json` be public in every environment or development-only?
- Should schema definitions become the source of truth for DTO TypeScript types?
- Should patient creation keep returning the current full patient shape?
- Should `GET /api/ping` be included in generated API docs?
