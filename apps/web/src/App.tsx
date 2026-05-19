import { createBrowserRouter, Link, Outlet, RouterProvider, useLoaderData } from "react-router-dom";
import { Button, Container, Divider, Typography } from "@mui/material";

import { listDiagnoses } from "./diagnoses.ts/api.js";
import type { Diagnosis } from "./types.js";
import { DiagnosisProvider } from "./contexts/DiagnosisContext.js";

import PatientListPage from "./components/PatientListPage/index.js";
import { patientListLoader } from "./components/PatientListPage/index.js";
import PatientPage from "./components/PatientPage/index.js";
import { patientLoader } from "./components/PatientPage/index.js";

const rootLoader = async () => {
  try {
    return await listDiagnoses();
  } catch {
    return null;
  }
};

const RootLayout = () => {
  const diagnoses = useLoaderData() as Diagnosis[] | null;

  return (
    <DiagnosisProvider diagnoses={diagnoses ?? undefined}>
      <Container className="app-shell">
        <Typography variant="h3" style={{ marginBottom: "0.5em" }}>
          Patientor
        </Typography>
        <Button component={Link} to="/" variant="contained" color="primary">
          Home
        </Button>
        <Divider hidden />
        <Outlet />
      </Container>
    </DiagnosisProvider>
  );
};

const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <RootLayout />,
      loader: rootLoader,
      children: [
        {
          index: true,
          element: <PatientListPage />,
          loader: patientListLoader,
        },
        {
          path: "patients/:id",
          element: <PatientPage />,
          loader: patientLoader,
        },
      ],
    },
  ],
  {
    future: {
      v7_relativeSplatPath: true,
    },
  },
);

const App = () => {
  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
};

export default App;
