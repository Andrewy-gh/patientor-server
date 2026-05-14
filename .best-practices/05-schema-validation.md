# 05 — Schema Validation

Anything from an HTTP request is untrusted. In Patientor that includes path params, patient creation JSON, and future entry creation JSON.

Effect v4 `Schema` is already used correctly in `apps/server/src/patients/http.ts`.

## Path params

```ts
import { Schema } from "effect";

const PatientPathParams = Schema.Struct({
  id: Schema.String.check(Schema.isUUID()),
});
```

Use it at the route edge:

```ts
const { id } = yield * HttpRouter.schemaPathParams(PatientPathParams);
```

Return `400` for schema errors:

```ts
Effect.catchIf(Schema.isSchemaError, () =>
  Effect.succeed(HttpServerResponse.empty({ status: 400 })),
);
```

For JSON body parsing, distinguish malformed request bodies from schema failures even though both return `400`:

```ts
import { HttpServerError } from "effect/unstable/http";

const isRequestParseError = (error: unknown) =>
  HttpServerError.isHttpServerError(error) && error.reason._tag === "RequestParseError";
```

- `Schema.SchemaError`: valid JSON, but not valid Patientor input
- `RequestParseError`: malformed or unreadable JSON body

## Patient creation body

Current body schema:

```ts
const NewPatientInputSchema = Schema.Struct({
  name: Schema.String.check(Schema.isMinLength(1)),
  dateOfBirth: Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/)),
  ssn: Schema.String.check(Schema.isMinLength(1)),
  gender: Schema.Union([Schema.Literal("female"), Schema.Literal("male"), Schema.Literal("other")]),
  occupation: Schema.String.check(Schema.isMinLength(1)),
});
```

Recommended improvement: encode Patientor domain constraints more tightly.

```ts
const Ssn = Schema.String.check(Schema.isPattern(/^\d{6}-[A-Za-z0-9]{3,4}$/));

const DateOnly = Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/));

const Gender = Schema.Union([
  Schema.Literal("female"),
  Schema.Literal("male"),
  Schema.Literal("other"),
]);

export const NewPatientInputSchema = Schema.Struct({
  name: Schema.String.check(Schema.isMinLength(1)),
  dateOfBirth: DateOnly,
  ssn: Ssn,
  gender: Gender,
  occupation: Schema.String.check(Schema.isMinLength(1)),
});
```

## Entry creation body

When Patientor adds an endpoint like `POST /api/patients/:id/entries`, model the discriminated union directly:

```ts
const BaseEntryInput = {
  description: Schema.String.check(Schema.isMinLength(1)),
  date: DateOnly,
  specialist: Schema.String.check(Schema.isMinLength(1)),
  diagnosisCodes: Schema.optionalKey(Schema.Array(Schema.String)),
};

const HealthCheckEntryInput = Schema.Struct({
  ...BaseEntryInput,
  type: Schema.Literal("HealthCheck"),
  healthCheckRating: Schema.Union([
    Schema.Literal(0),
    Schema.Literal(1),
    Schema.Literal(2),
    Schema.Literal(3),
  ]),
});

const HospitalEntryInput = Schema.Struct({
  ...BaseEntryInput,
  type: Schema.Literal("Hospital"),
  discharge: Schema.Struct({
    date: DateOnly,
    criteria: Schema.String.check(Schema.isMinLength(1)),
  }),
});

const OccupationalHealthcareEntryInput = Schema.Struct({
  ...BaseEntryInput,
  type: Schema.Literal("OccupationalHealthcare"),
  employerName: Schema.String.check(Schema.isMinLength(1)),
  sickLeave: Schema.optionalKey(
    Schema.Struct({
      startDate: DateOnly,
      endDate: DateOnly,
    }),
  ),
});

export const NewEntryInputSchema = Schema.Union([
  HealthCheckEntryInput,
  HospitalEntryInput,
  OccupationalHealthcareEntryInput,
]);
```

Use `Schema.optionalKey(...)` for JSON fields that may be absent. The local Effect source calls out the gotcha: `Schema.optional(...)` allows `undefined`; `optionalKey` better models absent JSON keys.

## Do not trust TypeScript interfaces at runtime

`NewPatientInput` is useful after parsing. It does not validate request JSON. Always parse the request body with `HttpServerRequest.schemaBodyJson(...)` first.
