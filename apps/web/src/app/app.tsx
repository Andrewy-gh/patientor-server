import { createBrowserRouter, Link, Outlet, RouterProvider, useLoaderData } from "react-router-dom";
import { Button, Container, Divider, Typography } from "@mui/material";

import { listDiagnoses } from "../features/diagnoses/api.js";
import { DiagnosisProvider } from "../features/diagnoses/diagnosis-context.js";
import type { Diagnosis } from "../features/diagnoses/types.js";

import PatientListPage, {
  patientListLoader,
} from "../features/patients/pages/patient-list-page.js";
import PatientPage, { patientLoader } from "../features/patients/pages/patient-page.js";

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
