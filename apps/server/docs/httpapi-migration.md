# Migrating Patientor Routes To HttpApi

This migration has happened for the public Patientor routes. Patientor now uses
Effect's schema-first `HttpApi` contract from `@patientor/api`, with old
`HttpRouter` route files kept only as compatibility/reference material.

The user impact should stay boring: the same public paths, status codes, and
JSON shapes should keep working for `curl`, browser `fetch`, Postman, and
non-Effect clients. The product gain is a clearer API contract: request
validation, response schemas, generated OpenAPI, and typed Effect clients can
come from one definition.

## Current Routes

The server currently exposes these public routes:

- `GET /api/v1/ping`
- `GET /api/v1/diagnoses`
- `GET /api/v1/patients`
- `GET /api/v1/patients/:id`
- `POST /api/v1/patients`
- `POST /api/v1/patients/:id/entries`

Keep those paths unchanged unless product explicitly chooses another versioned
URL shape.

## Installed Effect v4 Shape

The package manifests currently request `effect@^4.0.0-beta.65` and
`@effect/platform-node@^4.0.0-beta.65`; the lockfile and installed
`node_modules` currently resolve them to `4.0.0-beta.66`.

Verify exact APIs against `node_modules/effect` before editing code. The
current beta exports `HttpApi` from:

```ts
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiError,
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

## Migration Order

Move one route group at a time:

1. Define the shared API contract and schemas.
2. Migrate diagnoses first because it is read-only.
3. Migrate patient reads.
4. Migrate `POST /api/v1/patients`.
5. Migrate `POST /api/v1/patients/:id/entries`.
6. Keep `GET /api/v1/ping` in the contract so generated docs include it.
7. Wire `HttpApiBuilder.layer(...)` into the server.
8. Remove old `HttpRouter` route files only after regression tests and imports
   prove they are unused.

## 1. Define Shared Schemas

The API contract lives in `packages/api`, not under `apps/server/src/http`.
This keeps the public schema importable by both the server and the frontend.
The files are:

```text
packages/api/src/diagnoses.ts
packages/api/src/patients.ts
packages/api/src/patientor-api.ts
```

```ts
// packages/api/src/patients.ts
import { Schema } from "effect";
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  HttpApiSchema,
  OpenApi,
} from "effect/unstable/httpapi";

export const Diagnosis = Schema.Struct({
  code: Schema.String,
  name: Schema.String,
  latin: Schema.optionalKey(Schema.String),
});

export const Gender = Schema.Union([
  Schema.Literal("female"),
  Schema.Literal("male"),
  Schema.Literal("other"),
]);

export const HealthCheckRating = Schema.Union([
  Schema.Literal(0),
  Schema.Literal(1),
  Schema.Literal(2),
  Schema.Literal(3),
]);

export const Entry = Schema.Union([
  Schema.Struct({
    id: Schema.String,
    description: Schema.String,
    date: Schema.String,
    specialist: Schema.String,
    diagnosisCodes: Schema.optionalKey(Schema.Array(Schema.String)),
    type: Schema.Literal("HealthCheck"),
    healthCheckRating: HealthCheckRating,
  }),
  Schema.Struct({
    id: Schema.String,
    description: Schema.String,
    date: Schema.String,
    specialist: Schema.String,
    diagnosisCodes: Schema.optionalKey(Schema.Array(Schema.String)),
    type: Schema.Literal("Hospital"),
    discharge: Schema.Struct({
      date: Schema.String,
      criteria: Schema.String,
    }),
  }),
  Schema.Struct({
    id: Schema.String,
    description: Schema.String,
    date: Schema.String,
    specialist: Schema.String,
    diagnosisCodes: Schema.optionalKey(Schema.Array(Schema.String)),
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

export const NonSensitivePatient = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  dateOfBirth: Schema.String,
  gender: Gender,
  occupation: Schema.String,
});

export const NonSensitivePatientWithEntries = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  dateOfBirth: Schema.String,
  gender: Gender,
  occupation: Schema.String,
  entries: Schema.Array(Entry),
});

export const CreatedPatient = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  dateOfBirth: Schema.String,
  ssn: Schema.String,
  gender: Gender,
  occupation: Schema.String,
  entries: Schema.Array(Entry),
}).pipe(HttpApiSchema.status("Created"));

const DateOnly = Schema.String.check(
  Schema.makeFilter<string>((value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return "Expected a valid date in YYYY-MM-DD format";
    }

    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      (!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value) ||
      "Expected a valid date in YYYY-MM-DD format"
    );
  }),
);

const Ssn = Schema.String.check(Schema.isPattern(/^\d{6}-[A-Za-z0-9]{3,4}$/));

export const NewPatientInput = Schema.Struct({
  name: Schema.String.check(Schema.isMinLength(1)),
  dateOfBirth: DateOnly,
  ssn: Ssn,
  gender: Gender,
  occupation: Schema.String.check(Schema.isMinLength(1)),
});

export const PatientIdParams = Schema.Struct({
  id: Schema.String.check(Schema.isUUID()),
});

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

export const UpdatedPatient = NonSensitivePatientWithEntries.pipe(HttpApiSchema.status("Created"));
```

`HttpApiSchema.status("Created")` is for JSON bodies with status `201`.
`HttpApiSchema.Created` is only for an empty `201` response.

## 2. Define The API Contract

Keep `/api/v1` as the public prefix. Group names are typed names, not public path
segments unless a group or endpoint is explicitly prefixed.

```ts
// packages/api/src/patientor-api.ts
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
    error: [HttpApiError.BadRequest, HttpApiError.InternalServerError],
  }),
  HttpApiEndpoint.post("addEntry", "/patients/:id/entries", {
    params: PatientIdParams,
    payload: NewEntryInput,
    success: UpdatedPatient,
    error: [HttpApiError.BadRequest, HttpApiError.NotFound, HttpApiError.InternalServerError],
  }),
) {}

export class HealthApi extends HttpApiGroup.make("health").add(
  HttpApiEndpoint.get("ping", "/ping", {
    success: Schema.String,
  }),
) {}

export class PatientorApi extends HttpApi.make("patientor")
  .add(DiagnosesApi, PatientsApi, HealthApi)
  .prefix("/api/v1")
  .annotateMerge(
    OpenApi.annotations({
      title: "Patientor API",
      version: "1.0.0",
    }),
  ) {}
```

## 3. Implement Diagnoses First

Keep the service function unchanged. The handler maps domain failures to HTTP
errors.

```ts
// src/diagnoses/api.ts
import { Effect } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";
import { PatientorApi } from "@patientor/api";
import { getDiagnoses } from "./service.ts";

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

Behavior to preserve:

- `GET /api/v1/diagnoses` returns JSON.
- read failures return `500`.

## 4. Implement Patient Reads

The path param schema should keep invalid IDs at `400` before the handler
performs a database lookup.

```ts
// src/patients/api.ts
import { Effect } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";
import { PatientorApi } from "@patientor/api";
import { PatientRepository } from "./repository.ts";

export const PatientsApiLive = HttpApiBuilder.group(PatientorApi, "patients", (handlers) =>
  handlers
    .handle("list", () =>
      Effect.gen(function* () {
        const patients = yield* PatientRepository;
        return yield* patients.findNonSensitive();
      }).pipe(
        Effect.catchTag("PatientReadError", (error) =>
          Effect.logError(error).pipe(
            Effect.flatMap(() => Effect.fail(new HttpApiError.InternalServerError({}))),
          ),
        ),
      ),
    )
    .handle("get", ({ params }) =>
      Effect.gen(function* () {
        const patients = yield* PatientRepository;
        const patient = yield* patients.findNonSensitiveById(params.id);

        if (!patient) {
          return yield* new HttpApiError.NotFound({});
        }

        return patient;
      }).pipe(
        Effect.catchTag("PatientReadError", (error) =>
          Effect.logError(error).pipe(
            Effect.flatMap(() => Effect.fail(new HttpApiError.InternalServerError({}))),
          ),
        ),
        Effect.catchTag("InvalidPatientEntry", (error) =>
          Effect.logError(error).pipe(
            Effect.flatMap(() => Effect.fail(new HttpApiError.InternalServerError({}))),
          ),
        ),
      ),
    ),
);
```

Behavior to preserve:

- `GET /api/v1/patients` does not expose `ssn`.
- `GET /api/v1/patients/:id` returns `404` when the patient is missing.
- invalid UUID path params return `400`.
- read failures return `500`.

## 5. Add Patient Creation And Entry Creation

Extend the same `PatientsApiLive` chain with create handlers. The current
server uses `handleRaw` for writes so malformed JSON and schema-invalid JSON
both return `400` through explicit `HttpApiError.BadRequest` mapping.

```ts
import { Effect, Schema } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";
import { NewEntryInput, NewPatientInput } from "@patientor/api";

const decodeJsonPayload =
  <A>(schema: Schema.Schema<A>) =>
  (request: { readonly json: Effect.Effect<unknown, unknown, unknown> }) =>
    Effect.gen(function* () {
      const body = yield* request.json.pipe(
        Effect.catch(() => Effect.fail(new HttpApiError.BadRequest({}))),
      );

      return yield* Schema.decodeUnknownEffect(schema)(body).pipe(
        Effect.catchIf(Schema.isSchemaError, () => Effect.fail(new HttpApiError.BadRequest({}))),
      );
    });

// src/patients/api.ts, inside the same handlers chain
.handleRaw("create", ({ request }) =>
  Effect.gen(function* () {
    const payload = yield* decodeJsonPayload(NewPatientInput)(request);
    const patients = yield* PatientRepository;
    return yield* patients.addPatient(payload);
  }).pipe(
    Effect.catchTag("PatientWriteError", (error) =>
      Effect.logError(error).pipe(
        Effect.flatMap(() =>
          Effect.fail(new HttpApiError.InternalServerError({})),
        ),
      ),
    ),
  ),
)
.handleRaw("addEntry", ({ params, request }) =>
  Effect.gen(function* () {
    const payload = yield* decodeJsonPayload(NewEntryInput)(request);
    const patients = yield* PatientRepository;
    const patient = yield* patients.addEntry(params.id, payload);

    if (!patient) {
      return yield* new HttpApiError.NotFound({});
    }

    return patient;
  }).pipe(
    Effect.catchTag("InvalidPatientEntry", (error) =>
      Effect.logError(error).pipe(
        Effect.flatMap(() =>
          Effect.fail(new HttpApiError.InternalServerError({})),
        ),
      ),
    ),
    Effect.catchTag("PatientWriteError", (error) =>
      Effect.logError(error).pipe(
        Effect.flatMap(() =>
          Effect.fail(new HttpApiError.InternalServerError({})),
        ),
      ),
    ),
  ),
)
```

Behavior to preserve:

- invalid JSON returns `400`.
- schema-invalid JSON returns `400`.
- valid creation returns `201`.
- missing patient during entry creation returns `404`.
- write failures return `500`.

## 6. Add Health Handler

Keep this because `/api/v1/ping` appears in generated docs.

```ts
// src/http/health-api.ts
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { PatientorApi } from "@patientor/api";

export const HealthApiLive = HttpApiBuilder.group(PatientorApi, "health", (handlers) =>
  handlers.handle("ping", () => Effect.succeed("pong")),
);
```

## 7. Serve The HttpApi

`HttpApiBuilder.layer` registers the typed API with the router layer and can
expose generated OpenAPI JSON.

```ts
// src/http/routes.ts
import { Layer } from "effect";
import type { FileSystem, Path } from "effect";
import type { Etag, HttpPlatform, HttpRouter } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { PatientorApi } from "@patientor/api";
import { DiagnosesApiLive } from "../diagnoses/api.ts";
import { PatientsApiLive } from "../patients/api.ts";
import { HealthApiLive } from "./health-api.ts";
import type { Database } from "../db/database.ts";
import type { PatientRepository } from "../patients/repository.ts";

type HttpRoutesRequirements =
  | Database
  | PatientRepository
  | Etag.Generator
  | FileSystem.FileSystem
  | HttpPlatform.HttpPlatform
  | HttpRouter.HttpRouter
  | Path.Path;

export const HttpRoutes = HttpApiBuilder.layer(PatientorApi, {
  openapiPath: "/openapi.json",
}).pipe(
  Layer.provide(Layer.mergeAll(DiagnosesApiLive, PatientsApiLive, HealthApiLive)),
) as unknown as Layer.Layer<never, never, HttpRoutesRequirements>;
```

The current server shape can stay close to the existing `HttpRouter.serve(...)`
setup:

```ts
// src/http/server.ts
import { NodeHttpServer } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { createServer } from "node:http";
import { AppConfigService } from "../config.ts";
import { HttpRoutes } from "./routes.ts";

const NodeServerLive = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* AppConfigService;
    return NodeHttpServer.layer(createServer, { port: config.port });
  }),
);

export const HttpServerLive = HttpRouter.serve(HttpRoutes).pipe(Layer.provide(NodeServerLive));
```

That is intentionally close to the current server file. If `HttpRoutes` is now
a layer from `HttpApiBuilder.layer(...)`, keep `HttpRouter.serve(HttpRoutes)`
and let TypeScript show any missing services that must be provided.

If a route must temporarily stay on `HttpRouter`, keep that compatibility code
short-lived and delete it as soon as the matching `HttpApi` endpoint passes
tests.

## 8. Regression Tests

Before deleting each old route, add route-level tests that lock the public
behavior.

```ts
it.effect("returns 400 for invalid patient id", () =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const response = yield* client.get("/api/v1/patients/not-a-uuid");

    assert.strictEqual(response.status, 400);
  }).pipe(Effect.provide(TestServerLive)),
);
```

```ts
it.effect("does not expose ssn in patient list", () =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const response = yield* client.get("/api/v1/patients");
    const body = yield* response.json;

    assert.strictEqual(response.status, 200);
    assert.isFalse(JSON.stringify(body).includes("ssn"));
  }).pipe(Effect.provide(TestServerLive)),
);
```

```ts
it.effect("returns 201 when adding a patient entry", () =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const response = yield* client.post(`/api/v1/patients/${patientId}/entries`, {
      body: HttpBody.jsonUnsafe({
        type: "HealthCheck",
        description: "Annual check",
        date: "2026-05-12",
        specialist: "Dr. Smith",
        healthCheckRating: 0,
      }),
    });

    assert.strictEqual(response.status, 201);
  }).pipe(Effect.provide(TestServerLive)),
);
```

Preserve these behaviors:

- invalid path params return `400`
- malformed or schema-invalid JSON bodies return `400`
- missing patients return `404`
- successful patient and entry creation return `201`
- read/write failures return `500`
- patient list/detail responses do not expose `ssn`
- `/openapi.json` returns the generated API contract when enabled

## Open Decisions

- Keep `/api/v1` for the current public API version, or intentionally introduce
  another version?
- Expose `/openapi.json` in every environment or only development?
- Derive DTO TypeScript types from schemas, or keep types and schemas side by
  side for the first migration?
- Keep `POST /api/v1/patients` returning the current full patient shape?
- Keep `GET /api/v1/ping` in generated API docs?
