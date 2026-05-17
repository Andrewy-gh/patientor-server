import { useEffect, useState } from "react";
import axios from "axios";
import { BrowserRouter as Router, Link, Route, Routes } from "react-router-dom";
import { Button, Container, Divider, Typography } from "@mui/material";

import { apiBaseUrl } from "./constants.js";
import type { Patient } from "./types.js";

import PatientListPage from "./components/PatientListPage/index.js";
import PatientPage from "./components/PatientPage/index.js";
import patientService from "./services/patients.js";

const App = () => {
  const [patients, setPatients] = useState<Patient[]>([]);

  useEffect(() => {
    void axios.get<void>(`${apiBaseUrl}/ping`).catch(() => undefined);

    const fetchPatientList = async () => {
      try {
        const patients = await patientService.getAll();
        setPatients(patients);
      } catch {
        setPatients([]);
      }
    };
    void fetchPatientList();
  }, []);

  return (
    <Router future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <Container className="app-shell">
        <Typography variant="h3" style={{ marginBottom: "0.5em" }}>
          Patientor
        </Typography>
        <Button component={Link} to="/" variant="contained" color="primary">
          Home
        </Button>
        <Divider hidden />
        <Routes>
          <Route
            path="/"
            element={<PatientListPage patients={patients} setPatients={setPatients} />}
          />
          <Route path="/patients/:id" element={<PatientPage />} />
        </Routes>
      </Container>
    </Router>
  );
};

export default App;
