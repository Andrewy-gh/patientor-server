import { Effect } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";
import { getDiagnoses } from "./service.js";

const diagnosesRoute = HttpRouter.route(
  "GET",
  "/api/diagnoses",
  getDiagnoses.pipe(
    Effect.flatMap((diagnoses) => HttpServerResponse.json(diagnoses)),
    Effect.catchTag("DiagnosisReadError", (error) =>
      Effect.gen(function* () {
        yield* Effect.logError(error);
        return HttpServerResponse.empty({ status: 500 });
      }),
    ),
  ),
);

export const DiagnosisHttpRoutes = [diagnosesRoute];
