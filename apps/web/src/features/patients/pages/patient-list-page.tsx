import { useState } from "react";
import { Link, useLoaderData } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { AddRounded, ArrowForwardRounded, PeopleAltRounded } from "@mui/icons-material";

import type { Patient, PatientFormValues } from "../types.js";
import AddPatientModal from "../components/add-patient-modal/index.js";

import HealthRatingBar from "../components/health-rating-bar.js";

import { createPatient, listPatients } from "../api.js";

export const patientListLoader = async () => {
  try {
    return await listPatients();
  } catch {
    return [];
  }
};

const PatientListPage = () => {
  const loadedPatients = useLoaderData() as Patient[];
  const [patients, setPatients] = useState<Patient[]>(loadedPatients);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [error, setError] = useState<string>();

  const openModal = (): void => setModalOpen(true);

  const closeModal = (): void => {
    setModalOpen(false);
    setError(undefined);
  };

  const submitNewPatient = async (values: PatientFormValues) => {
    try {
      const patient = await createPatient(values);
      setPatients(patients.concat(patient));
      setModalOpen(false);
    } catch (error) {
      console.error("Unknown error", error);
      setError("Could not create patient");
    }
  };

  return (
    <Stack spacing={3}>
      <Box className="registry-header">
        <Stack
          alignItems={{ xs: "flex-start", md: "center" }}
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          spacing={2}
        >
          <Stack alignItems="flex-start" spacing={1}>
            <Chip icon={<PeopleAltRounded />} label={`${patients.length} patients`} />
            <Box>
              <Typography variant="h3">Patient registry</Typography>
            </Box>
          </Stack>
          <Button startIcon={<AddRounded />} variant="contained" onClick={() => openModal()}>
            Add patient
          </Button>
        </Stack>
      </Box>

      <TableContainer component={Card} className="soft-card">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Gender</TableCell>
              <TableCell>Occupation</TableCell>
              <TableCell>Health Rating</TableCell>
              <TableCell align="right">Patient Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {patients.map((patient) => (
              <TableRow hover key={patient.id}>
                <TableCell>
                  <Typography fontWeight={700}>{patient.name}</Typography>
                </TableCell>
                <TableCell>
                  <Chip label={patient.gender} size="small" variant="outlined" />
                </TableCell>
                <TableCell>{patient.occupation}</TableCell>
                <TableCell>
                  <HealthRatingBar showText={false} rating={1} />
                </TableCell>
                <TableCell align="right">
                  <Button
                    component={Link}
                    endIcon={<ArrowForwardRounded />}
                    size="small"
                    to={`/patients/${patient.id}`}
                  >
                    View chart
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <AddPatientModal
        modalOpen={modalOpen}
        onSubmit={submitNewPatient}
        error={error}
        onClose={closeModal}
      />
    </Stack>
  );
};

export default PatientListPage;
