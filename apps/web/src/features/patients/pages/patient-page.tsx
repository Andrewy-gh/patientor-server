import type { LoaderFunctionArgs } from "react-router-dom";
import { useState } from "react";
import { useLoaderData } from "react-router-dom";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { AddRounded, BadgeRounded, PersonRounded, WorkRounded } from "@mui/icons-material";
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
    <Stack component="section" spacing={3}>
      <Box className="patient-chart-header">
        <Stack
          alignItems={{ xs: "flex-start", md: "center" }}
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          spacing={2}
        >
          <Stack alignItems="flex-start" spacing={1}>
            <Chip icon={<BadgeRounded />} label={`${patient.entries.length} entries`} />
            <Typography variant="h3">{patient.name}</Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Chip icon={<PersonRounded />} label={patient.gender} variant="outlined" />
              <Chip icon={<WorkRounded />} label={patient.occupation} variant="outlined" />
            </Stack>
          </Stack>
          <Button startIcon={<AddRounded />} variant="contained" onClick={() => setModalOpen(true)}>
            Add entry
          </Button>
        </Stack>
      </Box>
      <Entries entries={patient.entries} />
      <AddEntryModal
        modalOpen={modalOpen}
        onSubmit={submitNewEntry}
        error={error}
        onClose={closeModal}
      />
    </Stack>
  );
};

export default PatientPage;
