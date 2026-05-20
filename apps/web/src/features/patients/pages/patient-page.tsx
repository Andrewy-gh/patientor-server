import type { LoaderFunctionArgs } from "react-router-dom";
import { useState } from "react";
import { useLoaderData } from "react-router-dom";
import { Button } from "@mui/material";
import { addPatientEntry, getPatient } from "../api.js";
import AddEntryModal from "../components/add-entry-modal/index.js";
import Entries from "../components/entries/index.js";
import type { NewEntryInput, PatientDetails } from "../types.js";

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
  const loadedPatient = useLoaderData() as PatientDetails | null;
  const [patient, setPatient] = useState<PatientDetails | null>(loadedPatient);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string>();

  const closeModal = () => {
    setModalOpen(false);
    setError(undefined);
  };

  const submitNewEntry = async (values: NewEntryInput) => {
    if (!patient) {
      return;
    }

    try {
      const updatedPatient = await addPatientEntry(patient.id, values);
      setPatient(updatedPatient);
      closeModal();
    } catch (error) {
      console.error("Unknown error", error);
      setError("Could not create entry");
    }
  };

  if (!patient) return <p>Invalid Patient Id</p>;
  return (
    <section>
      <h1>{patient.name}</h1>
      <div>gender: {patient.gender}</div>
      <div>occupation {patient.occupation}</div>
      <Entries entries={patient.entries} />
      <AddEntryModal
        modalOpen={modalOpen}
        onSubmit={submitNewEntry}
        error={error}
        onClose={closeModal}
      />
      <Button variant="contained" onClick={() => setModalOpen(true)}>
        Add New Entry
      </Button>
    </section>
  );
};

export default PatientPage;
