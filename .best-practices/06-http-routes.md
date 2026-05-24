# 06 — HTTP Routes

Patientor routes should be thin: parse request input, call a service effect, map known failures to HTTP status codes, return JSON.

## Current route pattern

Prefer `HttpApi` for public Patientor routes. The lower-level `HttpRouter`
examples in this file are useful for understanding legacy `http.ts` files,
temporary compatibility routes, or test-only routes.

```ts
const patientsRoute = HttpRouter.route(
  "GET",
  "/api/v1/patients",
  getNonSensitivePatients.pipe(
    Effect.flatMap((patients) => HttpServerResponse.json(patients)),
    Effect.catchTag("PatientReadError", (error) =>
      Effect.gen(function* () {
        yield* Console.error(error);
        return HttpServerResponse.empty({ status: 500 });
      }),
    ),
  ),
);
```

That is good for a first pass. Prefer `Effect.logError` over `Console.error` as the app grows so logging stays inside Effect observability.

## Route template

```ts
import { HttpServerError } from "effect/unstable/http";

const isRequestParseError = (error: unknown) =>
  HttpServerError.isHttpServerError(error) && error.reason._tag === "RequestParseError";

const route = HttpRouter.route(
  "POST",
  "/api/v1/patients",
  Effect.gen(function* () {
    const input = yield* HttpServerRequest.schemaBodyJson(NewPatientInputSchema);
    const added = yield* addNewPatient(input);
    return yield* HttpServerResponse.json(added, { status: 201 });
  }).pipe(
    Effect.catchIf(Schema.isSchemaError, () =>
      Effect.succeed(HttpServerResponse.empty({ status: 400 })),
    ),
    Effect.catchIf(isRequestParseError, () =>
      Effect.succeed(HttpServerResponse.empty({ status: 400 })),
    ),
    Effect.catchTag("PatientWriteError", (error) =>
      Effect.gen(function* () {
        yield* Effect.logError(error);
        return HttpServerResponse.empty({ status: 500 });
      }),
    ),
  ),
);
```

## Sensitive data rule

Never return `ssn` from normal patient list/detail endpoints.

Good route/service names:

- `getNonSensitivePatients`
- `getNonSensitivePatient`

Bad names:

- `getPatients` if it silently strips fields
- `getPatientData` if it is unclear whether SSN is included

## 404 vs undefined

For detail endpoints, either return `undefined` and let the route choose `404`, or fail with `PatientNotFound`. Pick one per service.

Current style:

```ts
const patient = yield * getNonSensitivePatient(id);

if (!patient) {
  return HttpServerResponse.empty({ status: 404 });
}
```

Effect-native alternative:

```ts
const patient =
  yield *
  getNonSensitivePatientOrFail(id).pipe(
    Effect.catchTag("PatientNotFound", () => Effect.succeed(undefined)),
  );

if (!patient) {
  return HttpServerResponse.empty({ status: 404 });
}
```

For Patientor, current `undefined` style is fine. Use tagged `PatientNotFound` when multiple callers need to distinguish not-found from other read failures.

## Route composition

Keep feature route arrays local:

```ts
export const PatientHttpRoutes = [patientsRoute, patientRoute, addPatientRoute];
```

Then compose once:

```ts
export const HttpRoutes = HttpRouter.addAll([
  pingRoute,
  ...DiagnosisHttpRoutes,
  ...PatientHttpRoutes,
]);
```

That legacy shape keeps each feature easy to move or test independently. For
current public routes, compose the shared API contract with
`HttpApiBuilder.layer(PatientorApi, { openapiPath: "/openapi.json" })` and
provide the feature API handler layers.
