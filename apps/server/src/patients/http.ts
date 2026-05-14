import { Effect, Schema } from "effect";
import {
  HttpRouter,
  HttpServerError,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";
import { PatientRepository } from "./repository.js";

const isRequestParseError = (error: unknown) =>
  HttpServerError.isHttpServerError(error) && error.reason._tag === "RequestParseError";

const patientsRoute = HttpRouter.route(
  "GET",
  "/api/patients",
  Effect.gen(function* () {
    const patients = yield* PatientRepository;
    const foundPatients = yield* patients.findNonSensitive();

    return yield* HttpServerResponse.json(foundPatients);
  }).pipe(
    Effect.catchTag("PatientReadError", (error) =>
      Effect.gen(function* () {
        yield* Effect.logError(error);
        return HttpServerResponse.empty({ status: 500 });
      }),
    ),
  ),
);

const PatientPathParams = Schema.Struct({
  id: Schema.String.check(Schema.isUUID()),
});

const patientRoute = HttpRouter.route(
  "GET",
  "/api/patients/:id",
  Effect.gen(function* () {
    const { id } = yield* HttpRouter.schemaPathParams(PatientPathParams);
    const patients = yield* PatientRepository;

    const patient = yield* patients.findNonSensitiveById(id);

    if (!patient) {
      return HttpServerResponse.empty({ status: 404 });
    }

    return yield* HttpServerResponse.json(patient);
  }).pipe(
    Effect.catchIf(Schema.isSchemaError, () =>
      Effect.succeed(HttpServerResponse.empty({ status: 400 })),
    ),
    Effect.catchTag("PatientReadError", (error) =>
      Effect.gen(function* () {
        yield* Effect.logError(error);
        return HttpServerResponse.empty({ status: 500 });
      }),
    ),
    Effect.catchTag("InvalidPatientEntry", (error) =>
      Effect.gen(function* () {
        yield* Effect.logError(error);
        return HttpServerResponse.empty({ status: 500 });
      }),
    ),
  ),
);

const isValidDateOnly = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const DateOnly = Schema.String.check(
  Schema.makeFilter<string>(
    (value) => isValidDateOnly(value) || "Expected a valid date in YYYY-MM-DD format",
  ),
);

const NewPatientInputSchema = Schema.Struct({
  name: Schema.String.check(Schema.isMinLength(1)),
  dateOfBirth: DateOnly,
  ssn: Schema.String.check(Schema.isPattern(/^\d{6}-[A-Za-z0-9]{3,4}$/)),
  gender: Schema.Union([Schema.Literal("female"), Schema.Literal("male"), Schema.Literal("other")]),
  occupation: Schema.String.check(Schema.isMinLength(1)),
});

const addPatientRoute = HttpRouter.route(
  "POST",
  "/api/patients",
  Effect.gen(function* () {
    const newPatient = yield* HttpServerRequest.schemaBodyJson(NewPatientInputSchema);
    const patients = yield* PatientRepository;

    const addedPatient = yield* patients.addPatient(newPatient);

    return yield* HttpServerResponse.json(addedPatient, { status: 201 });
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

const BaseEntryInput = {
  description: Schema.String.check(Schema.isMinLength(1)),
  date: DateOnly,
  specialist: Schema.String.check(Schema.isMinLength(1)),
  diagnosisCodes: Schema.optionalKey(Schema.Array(Schema.String)),
};

const NewEntryInputSchema = Schema.Union([
  Schema.Struct({
    ...BaseEntryInput,
    type: Schema.Literal("HealthCheck"),
    healthCheckRating: Schema.Union([
      Schema.Literal(0),
      Schema.Literal(1),
      Schema.Literal(2),
      Schema.Literal(3),
    ]),
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

const addPatientEntryRoute = HttpRouter.route(
  "POST",
  "/api/patients/:id/entries",
  Effect.gen(function* () {
    const { id } = yield* HttpRouter.schemaPathParams(PatientPathParams);
    const newEntry = yield* HttpServerRequest.schemaBodyJson(NewEntryInputSchema);
    const patients = yield* PatientRepository;

    const patient = yield* patients.addEntry(id, newEntry);

    if (!patient) {
      return HttpServerResponse.empty({ status: 404 });
    }

    return yield* HttpServerResponse.json(patient, { status: 201 });
  }).pipe(
    Effect.catchIf(Schema.isSchemaError, () =>
      Effect.succeed(HttpServerResponse.empty({ status: 400 })),
    ),
    Effect.catchIf(isRequestParseError, () =>
      Effect.succeed(HttpServerResponse.empty({ status: 400 })),
    ),
    Effect.catchTag("InvalidPatientEntry", (error) =>
      Effect.gen(function* () {
        yield* Effect.logError(error);
        return HttpServerResponse.empty({ status: 500 });
      }),
    ),
    Effect.catchTag("PatientWriteError", (error) =>
      Effect.gen(function* () {
        yield* Effect.logError(error);
        return HttpServerResponse.empty({ status: 500 });
      }),
    ),
  ),
);

export const PatientHttpRoutes = [
  patientsRoute,
  patientRoute,
  addPatientRoute,
  addPatientEntryRoute,
];
