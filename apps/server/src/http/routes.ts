import { HttpRouter, HttpServerResponse } from "effect/unstable/http";
import { DiagnosisHttpRoutes } from "../diagnoses/http.js";
import { PatientHttpRoutes } from "../patients/http.js";

const pingRoute = HttpRouter.route(
  "GET",
  "/api/ping",
  HttpServerResponse.text("pong"),
);

export const HttpRoutes = HttpRouter.addAll([
  pingRoute,
  ...DiagnosisHttpRoutes,
  ...PatientHttpRoutes,
]);
