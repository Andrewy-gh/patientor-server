import { Effect } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";
import { PatientorApi } from "@patientor/api";
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
