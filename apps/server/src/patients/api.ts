import { Effect } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";
import { PatientorApi } from "@patientor/api";
import { PatientRepository } from "./repository.ts";

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
          return yield* new HttpApiError.NotFound({});
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
          return yield* new HttpApiError.NotFound({});
        }

        return patient;
      }).pipe(
        Effect.catchTag("InvalidPatientEntry", internalServerError),
        Effect.catchTag("PatientWriteError", internalServerError),
      ),
    ),
);
