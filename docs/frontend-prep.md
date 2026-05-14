# Preparing Patientor For A Frontend

This guide is for hand-migrating the monorepo so a frontend can share the API
contract without learning anything about the database.

## Target Shape

Use this package layout:

```text
apps/
  server/
  web/                 # add later
packages/
  api/                 # add now
```

Do not add `packages/db` yet. Add it only if another trusted backend runtime
needs direct database access, such as a worker, admin service, reporting
service, scheduled job app, or second backend API.

## Boundary Rules

Follow these rules while moving code:

1. `packages/api` owns public request and response schemas.
2. `apps/server` owns handlers, repositories, database access, migrations, and
   seed scripts.
3. `apps/web` should import from `packages/api`, never from `apps/server`.
4. Database table types must not define public API types.
5. Repositories may accept API input types, but they must convert them to
   database rows locally.

The main goal is to keep browser-facing product shapes separate from storage
shapes.

## Step 1: Create The API Package

Create this folder:

```text
packages/api/
  package.json
  tsconfig.json
  vite.config.ts
  src/
    index.ts
    diagnoses.ts
    patients.ts
    patientor-api.ts
```

Create `packages/api/package.json`:

```json
{
  "name": "@patientor/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./dist/index.mjs",
    "./package.json": "./package.json"
  },
  "scripts": {
    "build": "vp pack",
    "dev": "vp pack --watch",
    "test": "vp test --passWithNoTests",
    "check": "vp check",
    "typecheck": "vp check --no-fmt --no-lint"
  },
  "dependencies": {
    "effect": "^4.0.0-beta.65"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:",
    "vite-plus": "catalog:"
  }
}
```

Create `packages/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "moduleDetection": "force",
    "resolveJsonModule": true,
    "types": ["node"],
    "declaration": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "strict": true,
    "noUnusedLocals": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

Create `packages/api/vite.config.ts`:

```ts
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    dts: {
      tsgo: true,
    },
    exports: true,
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
```

Vite+ uses Oxlint and Oxfmt behind `vp check`, so do not add package-local
ESLint config for this package.

## Step 2: Move Public Schemas First

Move the public schemas from the planned `HttpApi` migration into
`packages/api`.

Put diagnosis schemas in `packages/api/src/diagnoses.ts`.

Put patient, entry, and input schemas in `packages/api/src/patients.ts`.

Put the `HttpApi`, `HttpApiGroup`, and endpoint definitions in
`packages/api/src/patientor-api.ts`.

Export everything from `packages/api/src/index.ts`:

```ts
export * from "./diagnoses.js";
export * from "./patients.js";
export * from "./patientor-api.js";
```

Keep these public paths unchanged:

```text
GET /api/ping
GET /api/diagnoses
GET /api/patients
GET /api/patients/:id
POST /api/patients
POST /api/patients/:id/entries
```

## Step 3: Derive DTO Types From Schemas

In `packages/api`, derive public TypeScript types from schemas instead of
copying interfaces by hand.

Use this pattern:

```ts
import { Schema } from "effect";

export const NonSensitivePatient = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  dateOfBirth: Schema.String,
  gender: Schema.Union([Schema.Literal("female"), Schema.Literal("male"), Schema.Literal("other")]),
  occupation: Schema.String,
});

export type NonSensitivePatient = typeof NonSensitivePatient.Type;
```

Prefer schema-derived types for:

```text
Diagnosis
Entry
NewEntryInput
Patient
NewPatientInput
NonSensitivePatient
NonSensitivePatientWithEntries
```

## Step 4: Remove API Type Dependence On DB Types

Do not keep this pattern:

```ts
import { Patients } from "../db/generated.js";

export type NewPatientInput = Omit<Patients, "id" | "created_at" | "date_of_birth"> & {
  dateOfBirth: string;
};
```

Replace it with schema-derived API types from `@patientor/api`.

The database can still have `date_of_birth`. The API should keep
`dateOfBirth`. Convert between them inside the server repository.

## Step 5: Point The Server At The API Package

Add this dependency to `apps/server/package.json`:

```json
{
  "dependencies": {
    "@patientor/api": "workspace:*"
  }
}
```

Then update server imports:

```ts
import { NewEntryInput, NewPatientInput, PatientorApi } from "@patientor/api";
```

Server files should use shared API types for request and response shapes, while
database files should continue using generated Kysely types.

## Step 6: Keep Database Code In The Server

Keep these files in `apps/server`:

```text
apps/server/src/db/database.ts
apps/server/src/db/generated.ts
apps/server/src/db/migrate.ts
apps/server/src/db/seed.ts
apps/server/src/patients/repository.ts
apps/server/src/diagnoses/service.ts
```

These files are server runtime concerns. They need Postgres, Kysely, app config,
or backend-only business behavior.

## Step 7: Migrate HttpApi Against The Shared Contract

Follow `apps/server/docs/httpapi-migration.md`, but put the contract in
`packages/api` instead of `apps/server/src/http/api.ts`.

Server implementation files should only provide handlers:

```text
apps/server/src/diagnoses/api.ts
apps/server/src/patients/api.ts
apps/server/src/http/health-api.ts
apps/server/src/http/routes.ts
```

The server should import `PatientorApi` from `@patientor/api` when calling
`HttpApiBuilder.group(...)` and `HttpApiBuilder.layer(...)`.

## Step 8: Add Frontend Later

When ready, create:

```text
apps/web/
```

Add this dependency to `apps/web/package.json`:

```json
{
  "dependencies": {
    "@patientor/api": "workspace:*"
  }
}
```

The frontend can then use the shared DTO types and, if desired, a typed client
or generated OpenAPI client.

## Step 9: Verification After Each Slice

After each small migration slice, run:

```bash
pnpm check
pnpm test
pnpm build
```

Before handoff, run the full gate:

```bash
pnpm ready
```

## When To Add `packages/db`

Add `packages/db` only when both are true:

1. There is more than one backend runtime.
2. That runtime needs direct database queries.

Good reasons:

```text
apps/server
apps/worker
apps/admin-api
apps/reporting-service
```

Bad reasons:

```text
apps/web needs types
the repo is a monorepo
Kysely generated types are reusable
```

If `packages/db` is added later, keep it server-only. It can own generated DB
types, Kysely setup, and migration helpers. It should not own product behavior,
HTTP handlers, frontend DTOs, or feature repositories unless multiple backend
apps truly share that behavior.
