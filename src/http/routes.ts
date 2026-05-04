import { Effect } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";
import { getDiagnoses } from "../services/diagnosisService.js";

const pingRoute = HttpRouter.route(
  "GET",
  "/api/ping",
  HttpServerResponse.text("pong"),
);

const diagnosesRoute = HttpRouter.route(
  "GET",
  "/api/diagnoses",
  getDiagnoses.pipe(
    Effect.flatMap((diagnoses) => HttpServerResponse.json(diagnoses)),
    Effect.catchTag("DiagnosisReadError", (error) =>
      Effect.sync(() => {
        console.error(error);
        return HttpServerResponse.empty({ status: 500 });
      }),
    ),
  ),
);

export const HttpRoutes = HttpRouter.addAll([pingRoute, diagnosesRoute]);
