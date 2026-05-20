import { getJson } from "../../shared/api-client.js";
import { apiBaseUrl } from "../../shared/constants.js";
import type { Diagnosis } from "./types.js";

export const listDiagnoses = () => getJson<Diagnosis[]>(`${apiBaseUrl}/diagnoses`);
