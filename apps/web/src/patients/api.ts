import { NewEntryInput, NewPatientInput, PatientIdParams, PatientorApi } from "@patientor/api";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";

const program = Effect.gen(function* () {
  const client = yield* HttpApiClient.make(PatientorApi);
  return yield* client.patients.list();
});

export const listPatients = () =>
  Effect.runPromise(program.pipe(Effect.provide(FetchHttpClient.layer)));

export const getPatient = (id: string) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const client = yield* HttpApiClient.make(PatientorApi);
      return yield* client.patients.get({ params: { id } });
    }).pipe(Effect.provide(FetchHttpClient.layer)),
  );

export const createPatient = (newPatientInput: NewPatientInput) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const client = yield* HttpApiClient.make(PatientorApi);
      return yield* client.patients.create({ payload: newPatientInput });
    }).pipe(Effect.provide(FetchHttpClient.layer)),
  );

type PatientId = PatientIdParams["id"];

export const addPatientEntry = (id: PatientId, newEntryInput: NewEntryInput) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const client = yield* HttpApiClient.make(PatientorApi);

      switch (newEntryInput.type) {
        case "HealthCheck":
          return yield* client.patients.addEntry({
            params: { id },
            payload: newEntryInput,
          });
        case "Hospital":
          return yield* client.patients.addEntry({
            params: { id },
            payload: newEntryInput,
          });
        case "OccupationalHealthcare":
          return yield* client.patients.addEntry({
            params: { id },
            payload: newEntryInput,
          });
      }
    }).pipe(Effect.provide(FetchHttpClient.layer)),
  );
