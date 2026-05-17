import axios from "axios";
import type {
  CreatedPatientResponse,
  Patient,
  PatientDetails,
  PatientFormValues,
} from "../types.js";

import { apiBaseUrl } from "../constants.js";

const getAll = async () => {
  const { data } = await axios.get<Patient[]>(`${apiBaseUrl}/patients`);
  return data;
};

const getOnePatient = async (id: string) => {
  const { data } = await axios.get<PatientDetails>(`${apiBaseUrl}/patients/${id}`);
  return data;
};

const create = async (object: PatientFormValues) => {
  const { data } = await axios.post<CreatedPatientResponse>(`${apiBaseUrl}/patients`, object);

  return data;
};

export default {
  getAll,
  getOnePatient,
  create,
};
