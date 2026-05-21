import { createBrowserRouter, Link, Outlet, RouterProvider, useLoaderData } from "react-router-dom";
import { useMemo, useState } from "react";
import {
  AppBar,
  Box,
  Button,
  Container,
  CssBaseline,
  FormControlLabel,
  Switch,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme,
} from "@mui/material";
import { HomeRounded, LocalHospitalRounded } from "@mui/icons-material";

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
  const [darkMode, setDarkMode] = useState(false);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: darkMode ? "dark" : "light",
          primary: {
            main: darkMode ? "#5bb6a8" : "#0f766e",
          },
          secondary: {
            main: darkMode ? "#f0b65f" : "#b45309",
          },
          background: {
            default: darkMode ? "#101716" : "#f5f1ea",
            paper: darkMode ? "#17211f" : "#fffdfa",
          },
        },
        shape: {
          borderRadius: 8,
        },
        typography: {
          fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
          h3: {
            fontWeight: 700,
            letterSpacing: 0,
          },
          h4: {
            fontWeight: 700,
            letterSpacing: 0,
          },
          h5: {
            fontWeight: 700,
            letterSpacing: 0,
          },
          button: {
            fontWeight: 700,
            textTransform: "none",
          },
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 8,
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: "none",
              },
            },
          },
        },
      }),
    [darkMode],
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <DiagnosisProvider diagnoses={diagnoses ?? undefined}>
        <Box className="app-frame">
          <AppBar position="sticky" color="transparent" elevation={0} className="app-nav">
            <Toolbar className="app-toolbar">
              <Box className="brand-lockup">
                <LocalHospitalRounded color="primary" />
                <Box>
                  <Typography variant="h6">Patientor</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Care records workspace
                  </Typography>
                </Box>
              </Box>
              <Box className="nav-actions">
                <Button component={Link} to="/" variant="outlined" startIcon={<HomeRounded />}>
                  Home
                </Button>
                <FormControlLabel
                  control={
                    <Switch
                      checked={darkMode}
                      onChange={({ target }) => setDarkMode(target.checked)}
                      color="primary"
                    />
                  }
                  label={darkMode ? "Night" : "Day"}
                />
              </Box>
            </Toolbar>
          </AppBar>
          <Container className="app-shell" maxWidth="lg">
            <Outlet />
          </Container>
        </Box>
      </DiagnosisProvider>
    </ThemeProvider>
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
