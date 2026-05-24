# Patientor Effect Best Practices

This folder documents how to use Effect in **this** app, not in the abstract.

Patientor is a small medical-record API. It exposes diagnoses and patients, stores sensitive patient data in Postgres through Kysely, and returns sanitized patient views to clients. That means the important Effect boundaries are:

- config loading (`PORT`, `DATABASE_URL`, `NODE_ENV`)
- Postgres/Kysely resource lifetime
- HTTP route parsing and response mapping
- validation for untrusted JSON/path params
- typed domain failures for reads/writes
- tests that can replace the database layer

Local source of truth checked while writing these notes:

- package manifests request `effect@^4.0.0-beta.65`
- installed `node_modules` currently resolves Effect packages to `4.0.0-beta.66`
- `@effect/platform-node` and `@effect/vitest` are kept aligned with Effect
- current server code in `apps/server/src/config.ts`, `apps/server/src/db/database.ts`, `apps/server/src/patients/*`, `apps/server/src/diagnoses/*`, and `apps/server/src/http/*`

## Recommended reading order

1. [Architecture slices](./01-architecture-slices.md)
2. [Config and layers](./02-config-and-layers.md)
3. [Database and Kysely](./03-database-and-kysely.md)
4. [Domain errors](./04-domain-errors.md)
5. [Schema validation](./05-schema-validation.md)
6. [HTTP routes](./06-http-routes.md)
7. [Testing](./07-testing.md)
8. [HttpApi decision](./08-httpapi.md)

## Core rule

Use Effect at IO boundaries and domain failure boundaries. Do **not** rewrite every plain mapper into clever Effect code. Patientor still benefits from boring TypeScript for pure transformations like `toEntry` and DTO mapping.
