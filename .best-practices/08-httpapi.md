# 08 - HttpApi Decision

Patientor should keep the current `HttpRouter` route style until there is a
clear product need for a schema-first API contract.

## Current preference

Prefer `HttpRouter` for the app today.

That keeps the public behavior easy to reason about: each route parses request
input, calls the feature repository or service, maps known failures to HTTP
status codes, and returns JSON. This matches the current slice shape in
`src/patients/http.ts`, `src/diagnoses/http.ts`, and `src/http/routes.ts`.

Use `HttpApi` later when Patientor needs one of these concrete outcomes:

- generated OpenAPI from the backend contract
- typed Effect clients shared with a frontend or another service
- one schema-first contract for request validation and response encoding
- endpoint-level middleware and documented security behavior

Do not migrate only because `HttpApi` exists. For this small API, the current
router gives the same external HTTP behavior with fewer moving parts.

## Installed API shape

This repo uses `effect@4.0.0-beta.65`. The installed source of truth is
`node_modules/effect`, not older examples.

The installed package exports HttpApi from:

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

The important installed shapes are:

- `HttpApi.make("patientor")` creates the API contract.
- `HttpApiGroup.make("patients")` creates a feature group.
- `HttpApiEndpoint.get(...)`, `post(...)`, `put(...)`, `patch(...)`, and
  `del(...)` define endpoints.
- Endpoint options include `params`, `query`, `headers`, `payload`, `success`,
  and `error`.
- `HttpApiSchema.status("Created")` annotates a JSON success schema with status
  `201`.
- `HttpApiSchema.Created`, `NoContent`, `Accepted`, and `Empty(status)` are for
  empty responses.
- `HttpApiBuilder.group(api, groupName, handlers => ...)` implements a group.
- `HttpApiBuilder.layer(api, { openapiPath })` registers the API with the
  router layer and can expose OpenAPI JSON.
- `OpenApi.annotations({ title, version })` adds generated documentation
  metadata.

## Migration rule

If Patientor moves to `HttpApi`, migrate one feature group at a time and keep
the public paths unchanged unless product explicitly chooses versioned URLs.

Recommended order:

1. `GET /api/diagnoses`
2. `GET /api/patients`
3. `GET /api/patients/:id`
4. `POST /api/patients`
5. `POST /api/patients/:id/entries`
6. `GET /api/ping`, if the health check should remain public

For every migrated route, preserve the current status behavior with regression
tests before removing the old `HttpRouter` route:

- invalid path params or JSON bodies return `400`
- missing patients return `404`
- successful creates return `201`
- internal read/write failures return `500`
- patient list/detail responses do not expose `ssn`

## Where schemas should live

Start with API contract schemas near the HTTP contract, not buried inside the
handler. Once stable, decide whether exported TypeScript DTO types should be
derived from schemas or kept side by side.

Do not add shared abstractions just to prepare for `HttpApi`. Add the contract
files only when the migration actually starts.
