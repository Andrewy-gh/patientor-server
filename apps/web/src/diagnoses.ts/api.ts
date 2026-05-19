import { PatientorApi } from "@patientor/api";
import { HttpApiClient } from "effect/unstable/httpapi";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

export const listDiagnoses = () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const client = yield* HttpApiClient.make(PatientorApi);
      const diagnoses = yield* client.diagnoses.list();
      return diagnoses;
    }).pipe(Effect.provide(FetchHttpClient.layer)),
  );
