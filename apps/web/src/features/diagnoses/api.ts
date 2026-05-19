import { getJson } from "../../shared/api-client.js";
import type { Diagnosis } from "./types.js";

export const listDiagnoses = () => getJson<Diagnosis[]>("/api/diagnoses");
