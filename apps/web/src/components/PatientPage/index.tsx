import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import patientService from "../../services/patients.js";
import type { PatientDetails } from "../../types.js";
import Entries from "../Entries/index.js";

const PatientPage = () => {
  const { id } = useParams();
  const [patient, setPatient] = useState<PatientDetails | null>(null);

  useEffect(() => {
    if (!id) {
      setPatient(null);
      return;
    }

    const fetchOnePatient = async (id: string) => {
      try {
        const patient = await patientService.getOnePatient(id);
        setPatient(patient);
      } catch {
        setPatient(null);
      }
    };

    void fetchOnePatient(id);
  }, [id]);

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
