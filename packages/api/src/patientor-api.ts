import { Schema } from "effect";
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  OpenApi,
} from "effect/unstable/httpapi";
import { Diagnosis } from "./diagnoses.js";
import {
  CreatedPatient,
  NewEntryInput,
  NewPatientInput,
  NonSensitivePatient,
  NonSensitivePatientWithEntries,
  PatientIdParams,
  UpdatedPatient,
} from "./patients.js";

export class DiagnosesApi extends HttpApiGroup.make("diagnoses").add(
  HttpApiEndpoint.get("list", "/diagnoses", {
    success: Schema.Array(Diagnosis),
    error: HttpApiError.InternalServerError,
  }),
) {}

export class PatientsApi extends HttpApiGroup.make("patients").add(
  HttpApiEndpoint.get("list", "/patients", {
    success: Schema.Array(NonSensitivePatient),
    error: HttpApiError.InternalServerError,
  }),
  HttpApiEndpoint.get("get", "/patients/:id", {
    params: PatientIdParams,
    success: NonSensitivePatientWithEntries,
    error: [HttpApiError.NotFound, HttpApiError.InternalServerError],
  }),
  HttpApiEndpoint.post("create", "/patients", {
    payload: NewPatientInput,
    success: CreatedPatient,
    error: [HttpApiError.BadRequest, HttpApiError.InternalServerError],
  }),
  HttpApiEndpoint.post("addEntry", "/patients/:id/entries", {
    params: PatientIdParams,
    payload: NewEntryInput,
    success: UpdatedPatient,
    error: [HttpApiError.BadRequest, HttpApiError.NotFound, HttpApiError.InternalServerError],
  }),
) {}

export class HealthApi extends HttpApiGroup.make("health").add(
  HttpApiEndpoint.get("ping", "/ping", {
    success: Schema.String,
  }),
) {}

export class PatientorApi extends HttpApi.make("patientor")
  .add(DiagnosesApi, PatientsApi, HealthApi)
  .prefix("/api/v1")
  .annotateMerge(
    OpenApi.annotations({
      title: "Patientor API",
      version: "1.0.0",
    }),
  ) {}
