# Tutorial 01: Migrate Server Routes To `HttpApiBuilder`

This tutorial moves the server from hand-built `HttpRouter` routes to the
shared `PatientorApi` contract in `@patientor/api`.

User impact: public routes should behave the same. The product gain is that the
server route implementation will be checked against the same contract that a
future frontend can use.

## What You Will Change

You will add new implementation files next to the current HTTP files, then swap
the server over once the new route layer passes checks.

Files to create:

```text
apps/server/src/diagnoses/api.ts
apps/server/src/patients/api.ts
apps/server/src/http/health-api.ts
```

Files to edit:

```text
apps/server/src/http/routes.ts
apps/server/src/http/server.ts
```

Do not edit `packages/api/src/patientor-api.ts` unless the public API contract
itself needs to change.

## Step 1: Read The Contract

Open:

```text
packages/api/src/patientor-api.ts
```

Find these group names:

```ts
HttpApiGroup.make("diagnoses");
HttpApiGroup.make("patients");
HttpApiGroup.make("health");
```

Find these endpoint names:

```text
diagnoses.list
patients.list
patients.get
patients.create
patients.addEntry
health.ping
```

These names are what server handlers must implement.

## Step 2: Create The Diagnoses Handler

Create:

```text
apps/server/src/diagnoses/api.ts
```

Paste this:

```ts
import { Effect } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";
import { PatientorApi } from "@patientor/api";
import { getDiagnoses } from "./service.js";

export const DiagnosesApiLive = HttpApiBuilder.group(PatientorApi, "diagnoses", (handlers) =>
  handlers.handle("list", () =>
    getDiagnoses.pipe(
      Effect.catchTag("DiagnosisReadError", (error) =>
        Effect.logError(error).pipe(
          Effect.flatMap(() => Effect.fail(new HttpApiError.InternalServerError({}))),
        ),
      ),
    ),
  ),
);
```

What you should learn:

1. `HttpApiBuilder.group(...)` connects server behavior to one group in the
   shared API contract.
2. `"diagnoses"` must match the group name in `PatientorApi`.
3. `"list"` must match the endpoint name in the contract.
4. The handler returns plain diagnosis data on success.
5. Domain errors are converted to HTTP errors.

Run:

```powershell
pnpm --filter server typecheck
```

Do not continue until it passes.

## Step 3: Create The Patient Handlers

Create:

```text
apps/server/src/patients/api.ts
```

Paste this:

```ts
import { Effect } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";
import { PatientorApi } from "@patientor/api";
import { PatientRepository } from "./repository.js";

const internalServerError = (error: unknown) =>
  Effect.logError(error).pipe(
    Effect.flatMap(() => Effect.fail(new HttpApiError.InternalServerError({}))),
  );

export const PatientsApiLive = HttpApiBuilder.group(PatientorApi, "patients", (handlers) =>
  handlers
    .handle("list", () =>
      Effect.gen(function* () {
        const patients = yield* PatientRepository;
        return yield* patients.findNonSensitive();
      }).pipe(Effect.catchTag("PatientReadError", internalServerError)),
    )
    .handle("get", ({ params }) =>
      Effect.gen(function* () {
        const patients = yield* PatientRepository;
        const patient = yield* patients.findNonSensitiveById(params.id);

        if (!patient) {
          return yield* Effect.fail(new HttpApiError.NotFound({}));
        }

        return patient;
      }).pipe(
        Effect.catchTag("PatientReadError", internalServerError),
        Effect.catchTag("InvalidPatientEntry", internalServerError),
      ),
    )
    .handle("create", ({ payload }) =>
      Effect.gen(function* () {
        const patients = yield* PatientRepository;
        return yield* patients.addPatient(payload);
      }).pipe(Effect.catchTag("PatientWriteError", internalServerError)),
    )
    .handle("addEntry", ({ params, payload }) =>
      Effect.gen(function* () {
        const patients = yield* PatientRepository;
        const patient = yield* patients.addEntry(params.id, payload);

        if (!patient) {
          return yield* Effect.fail(new HttpApiError.NotFound({}));
        }

        return patient;
      }).pipe(
        Effect.catchTag("InvalidPatientEntry", internalServerError),
        Effect.catchTag("PatientWriteError", internalServerError),
      ),
    ),
);
```

What you should learn:

1. `params` comes from `PatientIdParams` in `@patientor/api`.
2. `payload` comes from `NewPatientInput` or `NewEntryInput` in
   `@patientor/api`.
3. The repository still owns database translation.
4. The API handler only coordinates request data, repository calls, and HTTP
   errors.

Run:

```powershell
pnpm --filter server typecheck
```

Do not continue until it passes.

## Step 4: Create The Health Handler

Create:

```text
apps/server/src/http/health-api.ts
```

Paste this:

```ts
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { PatientorApi } from "@patientor/api";

export const HealthApiLive = HttpApiBuilder.group(PatientorApi, "health", (handlers) =>
  handlers.handle("ping", () => Effect.succeed("pong")),
);
```

Run:

```powershell
pnpm --filter server typecheck
```

## Step 5: Replace The Route Export

Open:

```text
apps/server/src/http/routes.ts
```

Replace the old `HttpRouter.addAll(...)` route list with:

```ts
import { Layer } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { PatientorApi } from "@patientor/api";
import { DiagnosesApiLive } from "../diagnoses/api.js";
import { PatientsApiLive } from "../patients/api.js";
import { HealthApiLive } from "./health-api.js";

export const HttpRoutes = HttpApiBuilder.layer(PatientorApi, {
  openapiPath: "/openapi.json",
}).pipe(Layer.provide([DiagnosesApiLive, PatientsApiLive, HealthApiLive]));
```

What you should learn:

1. `HttpApiBuilder.layer(...)` turns the shared contract and handlers into a
   server route layer.
2. `/openapi.json` is generated from the same contract.
3. Handler layers are provided to the API layer.

Run:

```powershell
pnpm --filter server typecheck
```

If TypeScript says `HttpRoutes` has the wrong type in `server.ts`, continue to
Step 6.

## Step 6: Adjust Server Wiring If Needed

Open:

```text
apps/server/src/http/server.ts
```

The current file serves an `HttpRouter` value. After Step 5, `HttpRoutes` may be
a layer. If TypeScript asks for a different shape, update the file to follow the
installed Effect v4 types.

Use this as the target shape:

```ts
import { NodeHttpServer } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { HttpServer } from "effect/unstable/http";
import { createServer } from "node:http";
import { AppConfigService } from "../config.js";
import { HttpRoutes } from "./routes.js";

const NodeServerLive = Layer.effect(HttpServer.HttpServer)(
  Effect.gen(function* () {
    const config = yield* AppConfigService;
    return yield* NodeHttpServer.make(createServer, { port: config.port });
  }),
).pipe(Layer.provide(NodeHttpServer.layerHttpServices));

export const HttpServerLive = HttpRoutes.pipe(Layer.provide(NodeServerLive));
```

Important: trust the installed package types over this example. If an API name
differs, inspect:

```powershell
rg -n "HttpApiBuilder.layer|serve" apps/server/node_modules/effect/dist/unstable/httpapi -g "*.d.ts"
```

## Step 7: Run Checks

Run:

```powershell
pnpm --filter server typecheck
pnpm check
```

Then try tests:

```powershell
pnpm --filter server test
```

At the time this tutorial was written, the server test command fails before
running assertions because of an existing Vitest runner setup issue. If that is
still true, record the failure and continue only after product behavior has been
manually smoke-tested.

## Step 8: Smoke Test Manually

Start the server:

```powershell
pnpm dev
```

In another terminal, run:

```powershell
Invoke-RestMethod http://localhost:3001/api/ping
Invoke-RestMethod http://localhost:3001/api/diagnoses
Invoke-RestMethod http://localhost:3001/api/patients
Invoke-RestMethod http://localhost:3001/openapi.json
```

Expected behavior:

1. `/api/ping` returns `pong`.
2. `/api/diagnoses` returns diagnosis JSON.
3. `/api/patients` returns patient JSON without `ssn`.
4. `/openapi.json` returns generated API documentation.

## Step 9: Delete Old Router Files Only After Success

Once the new API layer is working, delete or empty old route exports only when
they are no longer imported:

```text
apps/server/src/diagnoses/http.ts
apps/server/src/patients/http.ts
```

Before deleting, run:

```powershell
rg -n "DiagnosisHttpRoutes|PatientHttpRoutes|diagnoses/http|patients/http" apps/server/src
```

If `rg` finds no active imports, deletion is safe.

## Definition Of Done

You are done when:

1. `pnpm check` passes.
2. `pnpm --filter server typecheck` passes.
3. The manual smoke tests return the same public behavior as before.
4. `/openapi.json` works.
5. `apps/server/src/http/routes.ts` imports `PatientorApi`.
6. No server implementation imports public API types from database-generated
   table types.
