import type { LoaderFunctionArgs } from "react-router-dom";
import { useLoaderData } from "react-router-dom";
import { getPatient } from "../api.js";
import Entries from "../components/entries/index.js";
import type { PatientDetails } from "../types.js";

export const patientLoader = async ({ params }: LoaderFunctionArgs) => {
  if (!params.id) {
    return null;
  }

  try {
    return await getPatient(params.id);
  } catch {
    return null;
  }
};

const PatientPage = () => {
  const patient = useLoaderData() as PatientDetails | null;

  if (!patient) return <p>Invalid Patient Id</p>;
  return (
    <section>
      <h1>{patient.name}</h1>
      <div>gender: {patient.gender}</div>
      <div>occupation {patient.occupation}</div>
      <Entries entries={patient.entries} />
    </section>
  );
};

export default PatientPage;
