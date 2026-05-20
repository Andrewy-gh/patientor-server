import { useState } from "react";
import { Link, useLoaderData } from "react-router-dom";
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

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
    <div className="App">
      <Box>
        <Typography align="center" variant="h6">
          Patient list
        </Typography>
      </Box>
      <Table style={{ marginBottom: "1em" }}>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Gender</TableCell>
            <TableCell>Occupation</TableCell>
            <TableCell>Health Rating</TableCell>
            <TableCell>Patient Details</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {patients.map((patient) => (
            <TableRow key={patient.id}>
              <TableCell>{patient.name}</TableCell>
              <TableCell>{patient.gender}</TableCell>
              <TableCell>{patient.occupation}</TableCell>
              <TableCell>
                <HealthRatingBar showText={false} rating={1} />
              </TableCell>
              {/* Added Link to view Patient's details */}
              <TableCell>
                <Link to={`/patients/${patient.id}`}>
                  {`${patient.name.split(" ")[0]}'s Details`}
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <AddPatientModal
        modalOpen={modalOpen}
        onSubmit={submitNewPatient}
        error={error}
        onClose={closeModal}
      />
      <Button variant="contained" onClick={() => openModal()}>
        Add New Patient
      </Button>
    </div>
  );
};

export default PatientListPage;
