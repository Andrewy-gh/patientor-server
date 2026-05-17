# Preparing Patientor For A Frontend

This guide explains how to prepare the Patientor monorepo so a future frontend
can share the public API contract with the server.

The important product outcome is this: the browser should understand the same
request and response shapes as the server, but it should not need to know
anything about Postgres, Kysely, migrations, seed scripts, or database table
names.

If this is your first time adding an API package to a monorepo, think of
`packages/api` as the shared contract folder. It describes what the product API
looks like from the outside. The server uses that contract to implement routes.
The frontend will later use that same contract to call routes safely.

## Target Shape

The target monorepo shape is:

```text
apps/
  server/             # existing backend app
  web/                # add later, when the frontend starts
packages/
  api/                # shared API contract package
```

Use `packages/api` now.

Do not add `packages/db` yet. Add it only if another trusted backend runtime
needs direct database access, such as a worker, admin service, reporting
service, scheduled job app, or second backend API.

## Current Status

The API package foundation is in place:

1. `packages/api` exists.
2. Public diagnosis and patient schemas live in `packages/api/src`.
3. `apps/server` depends on `@patientor/api`.
4. Patient request parsing uses schemas from `@patientor/api`.
5. A server-side type guard checks that API `Gender` and generated DB `Gender`
   stay aligned.

These slices are still future work:

1. Migrating server route wiring from `HttpRouter` to `HttpApiBuilder` using
   `PatientorApi`.
2. Creating `apps/web`.
3. Wiring the frontend to consume `@patientor/api`.
4. Adding `packages/db`, but only if another trusted backend runtime needs
   direct database access.

## Why This Package Exists

Without a shared API package, the frontend has two bad options:

1. Copy TypeScript types from the server by hand.
2. Import backend code directly.

Both options are risky. Hand-copied types can drift from real behavior. Direct
server imports can accidentally pull database code, environment config, or
backend-only dependencies into the browser build.

`packages/api` gives both apps a clean middle ground:

```text
frontend -> imports public API types from packages/api
server   -> imports public API types from packages/api
database -> stays private to apps/server
```

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

For example, this is fine:

```text
API field:      dateOfBirth
Database field: date_of_birth
```

The API shape should stay friendly to frontend code. The database shape should
stay friendly to the database. The server repository is where those two shapes
are translated.

## How The Effect Server Is Composed

The product behavior is simple: the server should start only when every required
piece is available. That includes the public API handlers, database access,
configuration, and the Node HTTP server. Effect makes that startup safety
visible in types.

For a team-friendly visual walkthrough, open
`docs/effect-app-construction-presentation.html`. It covers the same model as a
slide deck for both technical and non-technical reviewers.

Think of the startup files as three different ownership layers:

```text
apps/server/src/layers.ts
  owns app services: config, database, repositories

apps/server/src/http/server.ts
  owns HTTP runtime wiring: routes, Node server, HTTP platform services

apps/server/src/index.ts
  owns the executable boundary: .env, Node services, launch
```

In plain terms:

1. `layers.ts` answers "what backend capabilities does Patientor need?"
2. `server.ts` answers "how do those capabilities become an HTTP server?"
3. `index.ts` answers "how does the process load config and start the app?"

### `layers.ts`: App Capabilities

`layers.ts` should compose domain and infrastructure services that feature code
uses. For Patientor, that means the app config, database connection, and patient
repository.

This is the right kind of shape:

```ts
import { Layer } from "effect";
import { AppConfigLive } from "./config.js";
import { DatabaseLive } from "./db/database.js";
import { PatientRepositoryLive } from "./patients/repository.js";

const DatabaseLayer = DatabaseLive.pipe(Layer.provideMerge(AppConfigLive));

export const AppLive = PatientRepositoryLive.pipe(Layer.provideMerge(DatabaseLayer));
```

Use `provideMerge` when the provided dependency should remain available to other
parts of the app. Here, the database needs config, and the HTTP server also needs
config so it can read the port.

### `server.ts`: HTTP Runtime

`server.ts` should take the route layer and provide the Node HTTP server pieces
that Effect's HTTP runtime needs.

Use the installed Effect package as the source of truth. In the current beta,
the helper for turning an effect that returns a layer into a layer is
`Layer.unwrap`.

```ts
import { NodeHttpServer } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { createServer } from "node:http";
import { AppConfigService } from "../config.js";
import { HttpRoutes } from "./routes.js";

const NodeServerLive = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* AppConfigService;
    return NodeHttpServer.layer(createServer, { port: config.port });
  }),
);

export const HttpServerLive = HttpRouter.serve(HttpRoutes).pipe(Layer.provide(NodeServerLive));
```

The important detail is that `NodeHttpServer.layer(...)` provides more than just
the low-level server. It also provides the HTTP platform services that
`HttpRouter.serve(...)` needs while handling requests and responses.

Avoid building only `HttpServer.HttpServer` locally and hiding the rest of the
Node HTTP services inside that private layer. If the outer router still needs
`HttpPlatform` or `Generator`, `Layer.launch(...).pipe(NodeRuntime.runMain)` will
fail typecheck because startup is not fully satisfied.

### `index.ts`: Executable Boundary

`index.ts` should stay small. It loads boundary-level services and launches the
already-composed server.

```ts
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { ConfigProvider, Layer } from "effect";
import { HttpServerLive } from "./http/server.js";
import { AppLive } from "./layers.js";

const DotEnvLive = ConfigProvider.layerAdd(ConfigProvider.fromDotEnv(), {
  asPrimary: true,
});

const MainLive = HttpServerLive.pipe(
  Layer.provide(AppLive),
  Layer.provide(DotEnvLive),
  Layer.provide(NodeServices.layer),
);

Layer.launch(MainLive).pipe(NodeRuntime.runMain);
```

This keeps the decision points clear:

1. Add or change business services in `layers.ts`.
2. Add or change HTTP serving behavior in `http/server.ts`.
3. Add or change process startup concerns in `index.ts`.

If a typecheck error appears in `index.ts`, it often means one of the lower
layers still has an unmet requirement. Read the error as "the app cannot prove
startup has everything it needs yet," then trace which service is still required.

## Step 0: Start From The Repo Root

Run commands from the repository root:

```bash
cd C:\Users\lenny\projects\patientor-server
```

Check that the monorepo already knows about packages:

```bash
type pnpm-workspace.yaml
```

You should see this workspace pattern:

```yaml
packages:
  - apps/*
  - packages/*
  - tools/*
```

That `packages/*` line is what makes `packages/api` discoverable as a workspace
package.

## Step 1: Create The API Package Folder

Create this folder structure:

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

If the folder already exists, use this step as a checklist instead of creating
the files again.

On Windows PowerShell, the folder commands are:

```powershell
New-Item -ItemType Directory -Force packages/api/src
New-Item -ItemType File -Force packages/api/package.json
New-Item -ItemType File -Force packages/api/tsconfig.json
New-Item -ItemType File -Force packages/api/vite.config.ts
New-Item -ItemType File -Force packages/api/src/index.ts
New-Item -ItemType File -Force packages/api/src/diagnoses.ts
New-Item -ItemType File -Force packages/api/src/patients.ts
New-Item -ItemType File -Force packages/api/src/patientor-api.ts
```

Check the result:

```bash
dir packages\api
dir packages\api\src
```

You should see the config files in `packages/api` and the TypeScript source
files in `packages/api/src`.

## Step 2: Add `packages/api/package.json`

Create `packages/api/package.json`:

```json
{
  "name": "@patientor/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./dist/index.mjs"
    },
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

What each important field does:

1. `"name": "@patientor/api"` is the package name other workspaces import.
2. `"private": true` means this package is for this repo, not npm publishing.
3. `"type": "module"` keeps it aligned with modern ESM imports.
4. `"types": "./src/index.ts"` lets TypeScript resolve API types before the
   package has been built.
5. `"exports"` tells runtime code to use the built package, while TypeScript
   can still use the source types through the `"types"` condition.
6. `"build": "vp pack"` uses Vite+ to build this package.
7. `"effect"` is a runtime dependency because the schemas come from Effect.

Keep the `effect` version aligned with `apps/server/package.json`. At the time
of writing, this repo uses `effect@^4.0.0-beta.65`.

After editing package files, refresh workspace installs:

```bash
pnpm install
```

This updates the lockfile and makes `@patientor/api` visible to other workspace
packages.

## Step 3: Add `packages/api/tsconfig.json`

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

The main thing this file does is tell TypeScript that `packages/api/src` is a
strict TypeScript package that emits type declarations during the package build.

If TypeScript complains about import extensions later, check that source imports
use `.js` in local package exports:

```ts
export * from "./patients.js";
```

That looks odd in TypeScript, but it is expected for NodeNext ESM projects.

## Step 4: Add `packages/api/vite.config.ts`

Create `packages/api/vite.config.ts`:

```ts
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    dts: true,
    exports: {
      devExports: "types",
    },
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

Tooling notes for this package:

1. Use `vp pack` for package builds. It reads the `pack` block from
   `vite.config.ts` and uses `tsdown`.
2. Use `pack.dts: true` for declaration files. Declaration files are the
   generated `.d.ts` files that let other packages understand exported types.
3. Use `pack.exports.devExports: "types"` so workspace TypeScript checks read
   `packages/api/src` directly, while runtime imports still point at
   `packages/api/dist`.
4. Do not add `tsgo: true` or `@typescript/native-preview` unless the repo
   intentionally adopts that dependency later.
5. Use `vp check` for formatting, linting, and type checking. Vite+ runs Oxfmt,
   Oxlint, and its TypeScript check path from this command.
6. Do not add package-local ESLint config for this package.

## Step 5: Add The Public Schema Files

Start by putting public API schemas in `packages/api`.

Use this ownership split:

```text
packages/api/src/diagnoses.ts      # diagnosis response shape
packages/api/src/patients.ts       # patient, entry, and input shapes
packages/api/src/patientor-api.ts  # HttpApi groups and endpoint definitions
packages/api/src/index.ts          # public exports
```

Public schemas are the shapes the frontend is allowed to know about. They
should describe product behavior, not database storage.

Good public API fields:

```text
id
name
dateOfBirth
gender
occupation
entries
diagnosisCodes
```

Database-only details that should stay out of the API package:

```text
created_at
updated_at
date_of_birth
database connection settings
Kysely table helper types
migration helpers
seed data scripts
```

For the first pass, yes: you are mostly copy/pasting the public shapes that
already exist in the server, then converting them into Effect schemas.

Use these starting contents exactly, then adjust only if the current server
behavior has intentionally changed.

### `packages/api/src/diagnoses.ts`

This file should contain only the public diagnosis response shape.

Copy the idea from `apps/server/src/diagnoses/types.ts`, but do not import that
server file. The API package should stand on its own.

Paste this into `packages/api/src/diagnoses.ts`:

```ts
import { Schema } from "effect";

export const Diagnosis = Schema.Struct({
  code: Schema.String,
  name: Schema.String,
  latin: Schema.optionalKey(Schema.String),
});

export type Diagnosis = typeof Diagnosis.Type;
```

What this means:

1. `Diagnosis` is the runtime schema used to validate JSON.
2. `type Diagnosis` is the TypeScript type other packages can import.
3. `latin` is optional because some diagnosis rows may not have it.

### `packages/api/src/patients.ts`

This file should contain the public patient, entry, and request-body shapes.

Copy the product concepts from `apps/server/src/patients/types.ts` and the
request validation schemas from `apps/server/src/patients/http.ts`. Do not copy
the database import from `patients/types.ts`.

Paste this into `packages/api/src/patients.ts`:

```ts
import { Schema } from "effect";
import { HttpApiSchema } from "effect/unstable/httpapi";

const isValidDateOnly = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const DateOnly = Schema.String.check(
  Schema.makeFilter<string>(
    (value) => isValidDateOnly(value) || "Expected a valid date in YYYY-MM-DD format",
  ),
);

export const GenderValues = ["female", "male", "other"] as const;

export const Gender = Schema.Literals(GenderValues);

export type Gender = typeof Gender.Type;

export const HealthCheckRating = Schema.Union([
  Schema.Literal(0),
  Schema.Literal(1),
  Schema.Literal(2),
  Schema.Literal(3),
]);

export type HealthCheckRating = typeof HealthCheckRating.Type;

const BaseEntry = {
  id: Schema.String,
  description: Schema.String,
  date: Schema.String,
  specialist: Schema.String,
  diagnosisCodes: Schema.optionalKey(Schema.Array(Schema.String)),
};

export const Entry = Schema.Union([
  Schema.Struct({
    ...BaseEntry,
    type: Schema.Literal("HealthCheck"),
    healthCheckRating: HealthCheckRating,
  }),
  Schema.Struct({
    ...BaseEntry,
    type: Schema.Literal("Hospital"),
    discharge: Schema.Struct({
      date: Schema.String,
      criteria: Schema.String,
    }),
  }),
  Schema.Struct({
    ...BaseEntry,
    type: Schema.Literal("OccupationalHealthcare"),
    employerName: Schema.String,
    sickLeave: Schema.optionalKey(
      Schema.Struct({
        startDate: Schema.String,
        endDate: Schema.String,
      }),
    ),
  }),
]);

export type Entry = typeof Entry.Type;

export const Patient = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  dateOfBirth: Schema.String,
  ssn: Schema.String,
  gender: Gender,
  occupation: Schema.String,
  entries: Schema.optionalKey(Schema.Array(Entry)),
});

export type Patient = typeof Patient.Type;

export const NonSensitivePatient = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  dateOfBirth: Schema.String,
  gender: Gender,
  occupation: Schema.String,
});

export type NonSensitivePatient = typeof NonSensitivePatient.Type;

export const NonSensitivePatientWithEntries = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  dateOfBirth: Schema.String,
  gender: Gender,
  occupation: Schema.String,
  entries: Schema.Array(Entry),
});

export type NonSensitivePatientWithEntries = typeof NonSensitivePatientWithEntries.Type;

export const CreatedPatient = Patient.pipe(HttpApiSchema.status("Created"));

const Ssn = Schema.String.check(Schema.isPattern(/^\d{6}-[A-Za-z0-9]{3,4}$/));

export const NewPatientInput = Schema.Struct({
  name: Schema.String.check(Schema.isMinLength(1)),
  dateOfBirth: DateOnly,
  ssn: Ssn,
  gender: Gender,
  occupation: Schema.String.check(Schema.isMinLength(1)),
});

export type NewPatientInput = typeof NewPatientInput.Type;

export const PatientIdParams = Schema.Struct({
  id: Schema.String.check(Schema.isUUID()),
});

export type PatientIdParams = typeof PatientIdParams.Type;

const BaseEntryInput = {
  description: Schema.String.check(Schema.isMinLength(1)),
  date: DateOnly,
  specialist: Schema.String.check(Schema.isMinLength(1)),
  diagnosisCodes: Schema.optionalKey(Schema.Array(Schema.String)),
};

export const NewEntryInput = Schema.Union([
  Schema.Struct({
    ...BaseEntryInput,
    type: Schema.Literal("HealthCheck"),
    healthCheckRating: HealthCheckRating,
  }),
  Schema.Struct({
    ...BaseEntryInput,
    type: Schema.Literal("Hospital"),
    discharge: Schema.Struct({
      date: DateOnly,
      criteria: Schema.String.check(Schema.isMinLength(1)),
    }),
  }),
  Schema.Struct({
    ...BaseEntryInput,
    type: Schema.Literal("OccupationalHealthcare"),
    employerName: Schema.String.check(Schema.isMinLength(1)),
    sickLeave: Schema.optionalKey(
      Schema.Struct({
        startDate: DateOnly,
        endDate: DateOnly,
      }),
    ),
  }),
]);

export type NewEntryInput = typeof NewEntryInput.Type;

export const UpdatedPatient = NonSensitivePatientWithEntries.pipe(HttpApiSchema.status("Created"));
```

What this means:

1. `Patient` includes `ssn`, because creating a patient currently returns the
   full patient shape.
2. `NonSensitivePatient` excludes `ssn` and `entries`, so it is safe for
   `GET /api/patients`.
3. `NonSensitivePatientWithEntries` excludes `ssn` but includes entries, so it
   is safe for `GET /api/patients/:id`.
4. `NewPatientInput` is the `POST /api/patients` request body.
5. `NewEntryInput` is the `POST /api/patients/:id/entries` request body.
6. `PatientIdParams` validates the `:id` path parameter.
7. `CreatedPatient` and `UpdatedPatient` tell HttpApi those successful JSON
   responses should use HTTP `201 Created`.

The biggest change from the old server type file is that this file does not
import `Patients` from `db/generated.ts`. That database type stays private to
the server.

### `packages/api/src/patientor-api.ts`

This file should contain the route contract: method, path, request shape,
success shape, and error shape.

It should not contain handler code. No database calls, no repository calls, and
no `Effect.gen`.

Paste this into `packages/api/src/patientor-api.ts`:

```ts
import { Schema } from "effect";
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  OpenApi,
} from "effect/unstable/httpapi";
import { Diagnosis } from "./diagnoses.js";
import {
  CreatedPatient,
  NewEntryInput,
  NewPatientInput,
  NonSensitivePatient,
  NonSensitivePatientWithEntries,
  PatientIdParams,
  UpdatedPatient,
} from "./patients.js";

export class DiagnosesApi extends HttpApiGroup.make("diagnoses").add(
  HttpApiEndpoint.get("list", "/diagnoses", {
    success: Schema.Array(Diagnosis),
    error: HttpApiError.InternalServerError,
  }),
) {}

export class PatientsApi extends HttpApiGroup.make("patients").add(
  HttpApiEndpoint.get("list", "/patients", {
    success: Schema.Array(NonSensitivePatient),
    error: HttpApiError.InternalServerError,
  }),
  HttpApiEndpoint.get("get", "/patients/:id", {
    params: PatientIdParams,
    success: NonSensitivePatientWithEntries,
    error: [HttpApiError.NotFound, HttpApiError.InternalServerError],
  }),
  HttpApiEndpoint.post("create", "/patients", {
    payload: NewPatientInput,
    success: CreatedPatient,
    error: HttpApiError.InternalServerError,
  }),
  HttpApiEndpoint.post("addEntry", "/patients/:id/entries", {
    params: PatientIdParams,
    payload: NewEntryInput,
    success: UpdatedPatient,
    error: [HttpApiError.NotFound, HttpApiError.InternalServerError],
  }),
) {}

export class HealthApi extends HttpApiGroup.make("health").add(
  HttpApiEndpoint.get("ping", "/ping", {
    success: Schema.String,
  }),
) {}

export class PatientorApi extends HttpApi.make("patientor")
  .add(DiagnosesApi, PatientsApi, HealthApi)
  .prefix("/api")
  .annotateMerge(
    OpenApi.annotations({
      title: "Patientor API",
      version: "1.0.0",
    }),
  ) {}
```

What this means:

1. The route group names, like `"patients"`, are typed names for handlers.
2. The public paths stay `/api/patients`, `/api/diagnoses`, and `/api/ping`.
3. `.prefix("/api")` adds the shared `/api` prefix once.
4. Handler files will later refer to endpoint names like `"list"`, `"get"`,
   `"create"`, and `"addEntry"`.
5. This is where generated OpenAPI documentation can get its route shapes.

Error ownership note:

`patientor-api.ts` declares which errors each endpoint may return. For example,
`GET /patients/:id` and `POST /patients/:id/entries` both allow
`HttpApiError.NotFound` and `HttpApiError.InternalServerError`.

Those error classes are not defined by Patientor. They come from
`effect/unstable/httpapi`. In plain terms, the API contract says "this endpoint
can return a 404", while the server handler decides when to return it.

In `Effect.gen` handlers, built-in HTTP API errors such as
`HttpApiError.NotFound` are yieldable directly:

```ts
return yield * new HttpApiError.NotFound({});
```

Avoid wrapping that value in `Effect.fail(...)` inside a generator:

```ts
return yield * Effect.fail(new HttpApiError.NotFound({}));
```

That still describes the same product behavior, but Effect's language service
warns because the error value can already be yielded directly.

### `packages/api/src/index.ts`

This file should export the three public modules:

```ts
export * from "./diagnoses.js";
export * from "./patients.js";
export * from "./patientor-api.js";
```

After these four files are filled in, run:

```bash
pnpm --filter @patientor/api check
pnpm --filter @patientor/api build
```

If that passes, you have created the shared contract package. The next step is
updating `apps/server` to import from `@patientor/api` instead of its old local
types and route-local schemas.

## Step 6: Export From `packages/api/src/index.ts`

Export the public modules from `packages/api/src/index.ts`:

```ts
export * from "./diagnoses.js";
export * from "./patients.js";
export * from "./patientor-api.js";
```

This file is the front door for the package. Other workspaces should usually
import from `@patientor/api`, not from deep paths.

Prefer this:

```ts
import { NewPatientInput, PatientorApi } from "@patientor/api";
```

Avoid this:

```ts
import { NewPatientInput } from "@patientor/api/dist/patients.mjs";
```

## Step 7: Derive DTO Types From Schemas

In `packages/api`, derive public TypeScript types from schemas instead of
copying interfaces by hand.

DTO means "data transfer object." In plain terms, it is the shape of data that
crosses an app boundary, such as a JSON request body or JSON response.

Use this pattern:

```ts
import { Schema } from "effect";

export const GenderValues = ["female", "male", "other"] as const;

export const Gender = Schema.Literals(GenderValues);

export const NonSensitivePatient = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  dateOfBirth: Schema.String,
  gender: Gender,
  occupation: Schema.String,
});

export type NonSensitivePatient = typeof NonSensitivePatient.Type;
```

This gives the project one source of truth:

1. The schema validates runtime data.
2. The TypeScript type comes from the schema.
3. The frontend and server import the same public type.

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

## Step 8: Keep The Existing Public Routes Stable

Keep these public paths unchanged:

```text
GET /api/ping
GET /api/diagnoses
GET /api/patients
GET /api/patients/:id
POST /api/patients
POST /api/patients/:id/entries
```

The frontend package preparation should not change product behavior. It should
only move the public contract into a place the frontend can safely import.

If a route changes shape while doing this work, pause and decide whether that is
intentional product behavior or accidental migration drift.

## Step 9: Remove API Type Dependence On DB Types

Do not keep this pattern in public API code:

```ts
import { Patients } from "../db/generated.js";

export type NewPatientInput = Omit<Patients, "id" | "created_at" | "date_of_birth"> & {
  dateOfBirth: string;
};
```

That makes the public API depend on the database table shape.

Replace it with schema-derived API types from `@patientor/api`:

```ts
export const NewPatientInput = Schema.Struct({
  name: Schema.String,
  dateOfBirth: Schema.String,
  ssn: Schema.String,
  gender: Gender,
  occupation: Schema.String,
});

export type NewPatientInput = typeof NewPatientInput.Type;
```

The database can still have `date_of_birth`. The API should keep
`dateOfBirth`. Convert between them inside the server repository.

Add a server-side type guard so storage and API enum-like values cannot drift
quietly:

```ts
import type { Gender as ApiGender } from "@patientor/api";
import type { Gender as DatabaseGender } from "../db/generated.js";

type AssertAssignable<Actual extends Expected, Expected> = Actual;

export type GenderApiMatchesDatabase = AssertAssignable<ApiGender, DatabaseGender>;
export type GenderDatabaseMatchesApi = AssertAssignable<DatabaseGender, ApiGender>;
```

This still keeps the API package independent from database code. The dependency
points one way: the server can compare public API types with private database
types, but the frontend-safe API package never imports Kysely-generated files.

## Step 10: Add The API Package To The Server

Add this dependency to `apps/server/package.json`:

```json
{
  "dependencies": {
    "@patientor/api": "workspace:*"
  }
}
```

Then run:

```bash
pnpm install
```

The `workspace:*` version means "use the package from this monorepo."

After that, update server imports so request and response types come from the
shared package:

```ts
import { NewEntryInput, NewPatientInput, PatientorApi } from "@patientor/api";
```

Server files should use shared API types for request and response shapes, while
database files should continue using generated Kysely types.

## Step 11: Keep Database Code In The Server

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
or backend-only behavior.

Do not move them into `packages/api`.

## Step 12: Migrate HttpApi Against The Shared Contract

Follow `apps/server/docs/httpapi-migration.md`, but put the contract in
`packages/api` instead of `apps/server/src/http/api.ts`.

The split should look like this:

```text
packages/api/src/patientor-api.ts
  owns HttpApi, HttpApiGroup, and endpoint definitions

apps/server/src/diagnoses/api.ts
apps/server/src/patients/api.ts
apps/server/src/http/health-api.ts
apps/server/src/http/routes.ts
  own route handlers and server wiring
```

The server should import `PatientorApi` from `@patientor/api` when calling
`HttpApiBuilder.group(...)` and `HttpApiBuilder.layer(...)`.

The decision point is simple:

```text
Does this file describe the public API shape?
  Put it in packages/api.

Does this file run backend behavior?
  Keep it in apps/server.
```

## Step 13: Build The API Package By Itself

Before wiring too much server code to the package, make sure the package builds
on its own:

```bash
pnpm --filter @patientor/api build
```

Expected result:

```text
packages/api/dist/
```

The `dist` folder should contain compiled JavaScript and declaration files.

If the build fails, fix the package before updating more server imports. That
keeps the failure surface small.

## Step 14: Verify The Server Can Import It

After adding `@patientor/api` to `apps/server/package.json`, run:

```bash
pnpm --filter server typecheck
```

If the server cannot find `@patientor/api`, check these things:

1. `packages/api/package.json` has `"name": "@patientor/api"`.
2. `pnpm-workspace.yaml` includes `packages/*`.
3. `apps/server/package.json` uses `"@patientor/api": "workspace:*"`.
4. `pnpm install` has been run after changing package files.
5. `packages/api` builds successfully.

## Step 15: Add Frontend Later

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

Then run:

```bash
pnpm install
```

The frontend can then use the shared DTO types and, if desired, a typed client
or generated OpenAPI client.

Frontend code should import only the public contract:

```ts
import type { NonSensitivePatient } from "@patientor/api";
```

It should not import from `apps/server`.

## Verification After Each Slice

After each small migration slice, run the narrowest useful check first.

For only the API package:

```bash
pnpm --filter @patientor/api check
pnpm --filter @patientor/api test
pnpm --filter @patientor/api build
```

For the server after import changes:

```bash
pnpm --filter server typecheck
pnpm --filter server test
```

For the whole repo:

```bash
pnpm check
pnpm test
pnpm build
```

Before handoff, run the full gate when practical:

```bash
pnpm ready
```

## Common Mistakes

Avoid importing server files from the API package:

```ts
import { Patient } from "../../apps/server/src/types.js";
```

Avoid exposing database-generated types as frontend types:

```ts
import type { Patients } from "../../apps/server/src/db/generated.js";
```

Avoid adding a shared package just because a file is reusable. Shared packages
should represent a real boundary that more than one app needs.

Avoid moving repositories into `packages/api`. Repositories talk to storage, so
they belong in backend runtime code.

Avoid changing route behavior while moving types. Keep behavior changes in a
separate, intentional commit when possible.

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
