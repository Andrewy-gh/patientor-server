# 01 — Architecture Slices

Patientor's useful slices are small and should stay small.

## Current slices

```txt
src/config.ts          env-backed app configuration
src/db/database.ts     Kysely/Postgres resource service
src/db/migrate.ts      schema creation script
src/db/seed.ts         deterministic seed script
src/diagnoses/*        diagnosis read API
src/patients/*         patient read/write API
src/http/*             native Effect HTTP server/routes
src/layers.ts          app dependency graph
```

## Best-practice shape for a slice

Each feature slice should have this shape:

```txt
patients/
  types.ts      domain/API DTO types
  service.ts    Effect services/programs that use Database
  http.ts       route-level parsing, status codes, response mapping
```

Keep these responsibilities separate:

- `types.ts`: no IO, no database client
- `service.ts`: owns Kysely queries and converts database rows into API shapes
- `http.ts`: owns HTTP parsing/status decisions, not SQL

## What belongs in Effect

Use Effect when code:

- reads config
- acquires/releases resources
- talks to Postgres
- parses untrusted request input
- can fail in a way routes should handle explicitly
- needs test-time dependency replacement

## What should stay plain TypeScript

Keep these plain unless they need Effect dependencies:

```ts
const toEntry = (entry: EntryRow): Entry => {
  switch (entry.type) {
    case "HealthCheck":
      return { /* ... */ }
    case "Hospital":
      return { /* ... */ }
    case "OccupationalHealthcare":
      return { /* ... */ }
  }
};
```

Pure mapping code is easier to read and test directly. The win is not “more Effect everywhere”; the win is controlled IO and explicit failures.
