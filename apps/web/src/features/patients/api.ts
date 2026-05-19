import { getJson, postJson } from "../../shared/api-client.js";
import type {
  CreatedPatientResponse,
  NewEntryInput,
  NewPatientInput,
  Patient,
  PatientDetails,
  PatientId,
} from "./types.js";

const patientPath = (id: PatientId) => `/api/patients/${encodeURIComponent(id)}`;

export const listPatients = () => getJson<Patient[]>("/api/patients");

export const getPatient = (id: PatientId) => getJson<PatientDetails>(patientPath(id));

export const createPatient = (newPatientInput: NewPatientInput) =>
  postJson<CreatedPatientResponse, NewPatientInput>("/api/patients", newPatientInput);

export const addPatientEntry = (id: PatientId, newEntryInput: NewEntryInput) =>
  postJson<PatientDetails, NewEntryInput>(`${patientPath(id)}/entries`, newEntryInput);
