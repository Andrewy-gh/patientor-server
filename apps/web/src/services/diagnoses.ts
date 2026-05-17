import axios from "axios";
import type { Diagnosis } from "../types.js";

import { apiBaseUrl } from "../constants.js";

const getDiagnoses = async () => {
  const { data } = await axios.get<Diagnosis[]>(`${apiBaseUrl}/diagnoses`);
  return data;
};

export default { getDiagnoses };
