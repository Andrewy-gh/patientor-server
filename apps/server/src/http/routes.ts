import { Layer, type FileSystem, type Path } from "effect";
import type { Etag, HttpPlatform, HttpRouter } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { PatientorApi } from "@patientor/api";
import { DiagnosesApiLive } from "../diagnoses/api.ts";
import { PatientsApiLive } from "../patients/api.ts";
import { HealthApiLive } from "./health-api.ts";
import type { Database } from "../db/database.ts";
import type { PatientRepository } from "../patients/repository.ts";

type HttpRoutesRequirements =
  | Database
  | PatientRepository
  | Etag.Generator
  | FileSystem.FileSystem
  | HttpPlatform.HttpPlatform
  | HttpRouter.HttpRouter
  | Path.Path;

export const HttpRoutes = HttpApiBuilder.layer(PatientorApi, {
  openapiPath: "/openapi.json",
}).pipe(
  Layer.provide(Layer.mergeAll(DiagnosesApiLive, PatientsApiLive, HealthApiLive)),
) as unknown as Layer.Layer<never, never, HttpRoutesRequirements>;
