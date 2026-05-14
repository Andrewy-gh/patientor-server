# 08 - HttpApi Migration

Patientor is moving from plain `HttpRouter` routes to Effect's schema-first
`HttpApi`.

The product behavior should stay boring: the same public HTTP paths, status
codes, and response shapes should keep working for `curl`, browser `fetch`,
Postman, and non-Effect clients. The migration value is a clearer API contract:
request validation, response schemas, generated OpenAPI, and typed Effect
clients can all come from one definition.

## Current direction

Prefer `HttpApi` for new route migration work.

Keep the current feature slice boundaries:

- `types.ts`: domain/API DTO types and pure shape definitions
- `service.ts` or `repository.ts`: database access and domain behavior
- `http.ts` or `api.ts`: request parsing/status mapping and HTTP contract

Do not turn the migration into a broad rewrite. Keep service and repository
behavior stable unless a route needs a product behavior change.

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

Migrate one feature group at a time and keep the public paths unchanged unless
product explicitly chooses versioned URLs.

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

Keep the first migration direct and readable. Add shared helpers only after two
or more migrated route groups clearly need the same behavior.
