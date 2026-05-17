import { NewEntryInput, NewPatientInput, PatientIdParams } from "@patientor/api";
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

const patientRoute = HttpRouter.route(
  "GET",
  "/api/patients/:id",
  Effect.gen(function* () {
    const { id } = yield* HttpRouter.schemaPathParams(PatientIdParams);
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

const addPatientRoute = HttpRouter.route(
  "POST",
  "/api/patients",
  Effect.gen(function* () {
    const newPatient = yield* HttpServerRequest.schemaBodyJson(NewPatientInput);
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

const addPatientEntryRoute = HttpRouter.route(
  "POST",
  "/api/patients/:id/entries",
  Effect.gen(function* () {
    const { id } = yield* HttpRouter.schemaPathParams(PatientIdParams);
    const newEntry = yield* HttpServerRequest.schemaBodyJson(NewEntryInput);
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
