# Migrating Patientor Routes To HttpApi

This migration is happening. Patientor is moving from plain `HttpRouter` routes
to Effect's schema-first `HttpApi`.

The user impact should stay boring: the same public paths, status codes, and
JSON shapes should keep working for `curl`, browser `fetch`, Postman, and
non-Effect clients. The product gain is a clearer API contract: request
validation, response schemas, generated OpenAPI, and typed Effect clients can
come from one definition.

## Current Routes

The server currently exposes these public routes:

- `GET /api/ping`
- `GET /api/diagnoses`
- `GET /api/patients`
- `GET /api/patients/:id`
- `POST /api/patients`
- `POST /api/patients/:id/entries`

Keep those paths unchanged unless product explicitly chooses versioned URLs.

## Installed Effect v4 Shape

The repo currently uses `effect@4.0.0-beta.65` and
`@effect/platform-node@4.0.0-beta.65`.

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
4. Migrate `POST /api/patients`.
5. Migrate `POST /api/patients/:id/entries`.
6. Add `GET /api/ping` to the contract if it should appear in generated docs.
7. Wire `HttpApiBuilder.layer(...)` into the server.
8. Remove old `HttpRouter` routes only after regression tests pass.

## 1. Define Shared Schemas

Create the API contract near the HTTP layer. This example uses one
`src/http/api.ts` file while the migration is small.

```ts
// src/http/api.ts
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

export const NonSensitiveEntry = Schema.Union([
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
  entries: Schema.Array(NonSensitiveEntry),
});

export const CreatedPatient = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  dateOfBirth: Schema.String,
  ssn: Schema.String,
  gender: Gender,
  occupation: Schema.String,
  entries: Schema.Array(NonSensitiveEntry),
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

Keep `/api` as the public prefix. Group names are typed names, not public path
segments unless a group or endpoint is explicitly prefixed.

```ts
// src/http/api.ts, continued
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

## 3. Implement Diagnoses First

Keep the service function unchanged. The handler maps domain failures to HTTP
errors.

```ts
// src/diagnoses/api.ts
import { Effect } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";
import { PatientorApi } from "../http/api.js";
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

Behavior to preserve:

- `GET /api/diagnoses` returns JSON.
- read failures return `500`.

## 4. Implement Patient Reads

The path param schema should keep invalid IDs at `400` before the handler
performs a database lookup.

```ts
// src/patients/api.ts
import { Effect } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";
import { PatientorApi } from "../http/api.js";
import { PatientRepository } from "./repository.js";

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
          return yield* Effect.fail(new HttpApiError.NotFound({}));
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

- `GET /api/patients` does not expose `ssn`.
- `GET /api/patients/:id` returns `404` when the patient is missing.
- invalid UUID path params return `400`.
- read failures return `500`.

## 5. Add Patient Creation And Entry Creation

Extend the same `PatientsApiLive` chain with create handlers.

```ts
// src/patients/api.ts, inside the same handlers chain
.handle("create", ({ payload }) =>
  Effect.gen(function* () {
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
.handle("addEntry", ({ params, payload }) =>
  Effect.gen(function* () {
    const patients = yield* PatientRepository;
    const patient = yield* patients.addEntry(params.id, payload);

    if (!patient) {
      return yield* Effect.fail(new HttpApiError.NotFound({}));
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

Only include this if `/api/ping` should appear in generated docs.

```ts
// src/http/health-api.ts
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { PatientorApi } from "./api.js";

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
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { DiagnosesApiLive } from "../diagnoses/api.js";
import { PatientsApiLive } from "../patients/api.js";
import { PatientorApi } from "./api.js";
import { HealthApiLive } from "./health-api.js";

export const HttpRoutes = HttpApiBuilder.layer(PatientorApi, {
  openapiPath: "/openapi.json",
}).pipe(Layer.provide([DiagnosesApiLive, PatientsApiLive, HealthApiLive]));
```

The current server shape can stay close to the existing `HttpRouter.serve(...)`
setup:

```ts
// src/http/server.ts
import { NodeHttpServer } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import { createServer } from "node:http";
import { AppConfigService } from "../config.js";
import { HttpRoutes } from "./routes.js";

const NodeServerLive = Layer.effect(HttpServer.HttpServer)(
  Effect.gen(function* () {
    const config = yield* AppConfigService;
    return yield* NodeHttpServer.make(createServer, { port: config.port });
  }),
).pipe(Layer.provide(NodeHttpServer.layerHttpServices));

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
    const response = yield* client.get("/api/patients/not-a-uuid");

    assert.strictEqual(response.status, 400);
  }).pipe(Effect.provide(TestServerLive)),
);
```

```ts
it.effect("does not expose ssn in patient list", () =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const response = yield* client.get("/api/patients");
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
    const response = yield* client.post(`/api/patients/${patientId}/entries`, {
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

- Keep `/api` or intentionally introduce `/api/v1`?
- Expose `/openapi.json` in every environment or only development?
- Derive DTO TypeScript types from schemas, or keep types and schemas side by
  side for the first migration?
- Keep `POST /api/patients` returning the current full patient shape?
- Include `GET /api/ping` in generated API docs?
