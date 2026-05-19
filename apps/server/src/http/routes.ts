import { Layer } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { PatientorApi } from "@patientor/api";
import { DiagnosesApiLive } from "../diagnoses/api.ts";
import { PatientsApiLive } from "../patients/api.ts";
import { HealthApiLive } from "./health-api.ts";

export const HttpRoutes = HttpApiBuilder.layer(PatientorApi, {
  openapiPath: "/openapi.json",
}).pipe(Layer.provide([DiagnosesApiLive, PatientsApiLive, HealthApiLive]));
