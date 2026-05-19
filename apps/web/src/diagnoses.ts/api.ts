import { getJson } from "../apiClient.js";
import type { Diagnosis } from "../types.js";

export const listDiagnoses = () => getJson<Diagnosis[]>("/api/diagnoses");
