import { Console, Effect, Schema } from "effect";
import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";
import {
  addNewPatient,
  getNonSensitivePatient,
  getNonSensitivePatients,
} from "./service.js";

const patientsRoute = HttpRouter.route(
  "GET",
  "/api/patients",
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

const PatientPathParams = Schema.Struct({
  id: Schema.String.check(Schema.isUUID()),
});

const patientRoute = HttpRouter.route(
  "GET",
  "/api/patients/:id",
  Effect.gen(function* () {
    const { id } = yield* HttpRouter.schemaPathParams(PatientPathParams);

    const patient = yield* getNonSensitivePatient(id);

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
        yield* Console.error(error);
        return HttpServerResponse.empty({ status: 500 });
      }),
    ),
  ),
);

const NewPatientInputSchema = Schema.Struct({
  name: Schema.String.check(Schema.isMinLength(1)),
  dateOfBirth: Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/)),
  ssn: Schema.String.check(Schema.isMinLength(1)),
  gender: Schema.Union([
    Schema.Literal("female"),
    Schema.Literal("male"),
    Schema.Literal("other"),
  ]),
  occupation: Schema.String.check(Schema.isMinLength(1)),
});

const addPatientRoute = HttpRouter.route(
  "POST",
  "/api/patients",
  Effect.gen(function* () {
    const newPatient = yield* HttpServerRequest.schemaBodyJson(
      NewPatientInputSchema,
    );

    const addedPatient = yield* addNewPatient(newPatient);

    return yield* HttpServerResponse.json(addedPatient, { status: 201 });
  }).pipe(
    Effect.catchIf(Schema.isSchemaError, () =>
      Effect.succeed(HttpServerResponse.empty({ status: 400 })),
    ),
    Effect.catchTag("PatientReadError", (error) =>
      Effect.gen(function* () {
        yield* Console.error(error);
        return HttpServerResponse.empty({ status: 500 });
      }),
    ),
  ),
);

export const PatientHttpRoutes = [patientsRoute, patientRoute, addPatientRoute];
