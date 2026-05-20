import { Effect, Schema } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";
import { NewEntryInput, NewPatientInput, PatientorApi } from "@patientor/api";
import { PatientRepository } from "./repository.ts";

const internalServerError = (error: unknown) =>
  Effect.logError(error).pipe(
    Effect.flatMap(() => Effect.fail(new HttpApiError.InternalServerError({}))),
  );

const decodeJsonPayload = <A>(schema: Schema.Schema<A>) =>
  (request: { readonly json: Effect.Effect<unknown, unknown, unknown> }) =>
  Effect.gen(function* () {
    const body = yield* request.json.pipe(
      Effect.catch(() => Effect.fail(new HttpApiError.BadRequest({}))),
    );

    return yield* Schema.decodeUnknownEffect(schema)(body).pipe(
      Effect.catchIf(Schema.isSchemaError, () => Effect.fail(new HttpApiError.BadRequest({}))),
    );
  });

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
          return yield* new HttpApiError.NotFound({});
        }

        return patient;
      }).pipe(
        Effect.catchTag("PatientReadError", internalServerError),
        Effect.catchTag("InvalidPatientEntry", internalServerError),
      ),
    )
    .handleRaw("create", ({ request }) =>
      Effect.gen(function* () {
        const payload = yield* decodeJsonPayload(NewPatientInput)(request);
        const patients = yield* PatientRepository;
        return yield* patients.addPatient(payload);
      }).pipe(Effect.catchTag("PatientWriteError", internalServerError)),
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
        Effect.catchTag("InvalidPatientEntry", internalServerError),
        Effect.catchTag("PatientWriteError", internalServerError),
      ),
    ),
);
