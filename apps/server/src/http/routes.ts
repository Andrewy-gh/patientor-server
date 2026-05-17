import { Layer } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { PatientorApi } from "@patientor/api";
import { DiagnosesApiLive } from "../diagnoses/api.js";
import { PatientsApiLive } from "../patients/api.js";
import { HealthApiLive } from "./health-api.js";

export const HttpRoutes = HttpApiBuilder.layer(PatientorApi, {
  openapiPath: "/openapi.json",
}).pipe(Layer.provide([DiagnosesApiLive, PatientsApiLive, HealthApiLive]));
