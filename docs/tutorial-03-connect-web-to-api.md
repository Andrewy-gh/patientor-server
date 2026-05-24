# Tutorial 03: Connect `apps/web` To `@patientor/api`

This tutorial connects the existing frontend to the shared public API types.

User impact: the frontend can display patients and diagnoses from the backend
without importing server or database code. The browser talks to the public
`/api/v1` routes, while TypeScript keeps the UI aligned with `@patientor/api`.

Prerequisite: finish `docs/tutorial-02-create-web-app.md`.

## Current App Shape

In the current repo, `apps/web` already exists. The important files are:

```text
apps/web/src/shared/constants.ts
apps/web/src/shared/api-client.ts
apps/web/src/features/diagnoses/types.ts
apps/web/src/features/diagnoses/api.ts
apps/web/src/features/patients/types.ts
apps/web/src/features/patients/api.ts
apps/web/src/features/patients/pages/patient-list-page.tsx
apps/web/src/features/patients/pages/patient-page.tsx
apps/web/src/app/app.tsx
```

The frontend currently uses a small typed `fetch` wrapper. It imports public
TypeScript types from `@patientor/api`, but it does not use
`HttpApiClient.make(PatientorApi)` or runtime response decoding in the browser.

## Step 1: Confirm Frontend Dependencies

Open:

```text
apps/web/package.json
```

The dependencies should include the API package, React Router, MUI, React, and
React DOM:

```json
"dependencies": {
  "@emotion/react": "catalog:",
  "@emotion/styled": "catalog:",
  "@mui/icons-material": "catalog:",
  "@mui/material": "catalog:",
  "@patientor/api": "workspace:*",
  "@vitejs/plugin-react": "catalog:",
  "react": "catalog:",
  "react-dom": "catalog:",
  "react-router-dom": "catalog:"
}
```

Do not add a direct `effect` dependency unless the frontend intentionally moves
to Effect's generated HTTP client or runtime schema decoding.

## Step 2: Set The API Base URL

Create or update:

```text
apps/web/src/shared/constants.ts
```

```ts
export const apiBaseUrl = "/api/v1";
```

What you should learn:

1. The server contract prefixes public routes with `/api/v1`.
2. The Vite proxy can still proxy `/api` to the backend because `/api/v1`
   starts with `/api`.
3. Frontend feature clients should build URLs from one shared constant.

## Step 3: Add The Shared Fetch Helpers

Create or update:

```text
apps/web/src/shared/api-client.ts
```

```ts
const throwForBadResponse = async (response: Response) => {
  if (response.ok) {
    return;
  }

  const message = await response.text();
  throw new Error(message || `Request failed with status ${response.status}`);
};

export const getJson = async <ResponseBody>(path: string): Promise<ResponseBody> => {
  const response = await fetch(path);
  await throwForBadResponse(response);
  return (await response.json()) as ResponseBody;
};

export const postJson = async <ResponseBody, RequestBody>(
  path: string,
  body: RequestBody,
): Promise<ResponseBody> => {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  await throwForBadResponse(response);
  return (await response.json()) as ResponseBody;
};
```

This is intentionally plain. The helper centralizes response-status handling,
while each feature decides which public API type it expects.

## Step 4: Re-export Diagnosis Types

Create or update:

```text
apps/web/src/features/diagnoses/types.ts
```

```ts
import type { Diagnosis } from "@patientor/api";

export type { Diagnosis };
```

Then create or update:

```text
apps/web/src/features/diagnoses/api.ts
```

```ts
import { getJson } from "../../shared/api-client.js";
import { apiBaseUrl } from "../../shared/constants.js";
import type { Diagnosis } from "./types.js";

export const listDiagnoses = () => getJson<Diagnosis[]>(`${apiBaseUrl}/diagnoses`);
```

## Step 5: Re-export Patient Types

Create or update:

```text
apps/web/src/features/patients/types.ts
```

```ts
import type {
  Entry,
  Gender as ApiGender,
  HealthCheckRating as ApiHealthCheckRating,
  NewEntryInput,
  NewPatientInput,
  NonSensitivePatient,
  NonSensitivePatientWithEntries,
  Patient as CreatedPatient,
  PatientIdParams,
} from "@patientor/api";

export type { Entry, NewEntryInput, NewPatientInput };

export const Gender = {
  Female: "female",
  Male: "male",
  Other: "other",
} as const satisfies Record<string, ApiGender>;

export type Gender = ApiGender;

export const HealthCheckRating = {
  Healthy: 0,
  LowRisk: 1,
  HighRisk: 2,
  CriticalRisk: 3,
} as const satisfies Record<string, ApiHealthCheckRating>;

export type HealthCheckRating = ApiHealthCheckRating;

export type HospitalEntry = Extract<Entry, { type: "Hospital" }>;

export type OccupationalHealthcareEntry = Extract<Entry, { type: "OccupationalHealthcare" }>;

export type HealthCheckEntry = Extract<Entry, { type: "HealthCheck" }>;

export type Patient = NonSensitivePatient;

export type PatientDetails = NonSensitivePatientWithEntries;

export type PatientFormValues = NewPatientInput;

export type CreatedPatientResponse = CreatedPatient;

export type PatientId = PatientIdParams["id"];
```

What you should learn:

1. UI code imports app-friendly names from the feature folder.
2. The source of truth is still `@patientor/api`.
3. `Patient` is non-sensitive, so normal list screens cannot read `ssn`.
4. `PatientDetails` includes entries but still excludes `ssn`.

## Step 6: Add The Patient API Client

Create or update:

```text
apps/web/src/features/patients/api.ts
```

```ts
import { getJson, postJson } from "../../shared/api-client.js";
import { apiBaseUrl } from "../../shared/constants.js";
import type {
  CreatedPatientResponse,
  NewEntryInput,
  NewPatientInput,
  Patient,
  PatientDetails,
  PatientId,
} from "./types.js";

const patientPath = (id: PatientId) => `${apiBaseUrl}/patients/${encodeURIComponent(id)}`;

export const listPatients = () => getJson<Patient[]>(`${apiBaseUrl}/patients`);

export const getPatient = (id: PatientId) => getJson<PatientDetails>(patientPath(id));

export const createPatient = (newPatientInput: NewPatientInput) =>
  postJson<CreatedPatientResponse, NewPatientInput>(`${apiBaseUrl}/patients`, newPatientInput);

export const addPatientEntry = (id: PatientId, newEntryInput: NewEntryInput) =>
  postJson<PatientDetails, NewEntryInput>(`${patientPath(id)}/entries`, newEntryInput);
```

What you should learn:

1. `listPatients` calls `GET /api/v1/patients`.
2. `getPatient` calls `GET /api/v1/patients/:id`.
3. `createPatient` calls `POST /api/v1/patients`.
4. `addPatientEntry` calls `POST /api/v1/patients/:id/entries`.
5. `encodeURIComponent` keeps route parameters safe inside URLs.

## Step 7: Load Patients Through React Router

In the current app, the patient list page owns the list loader:

```text
apps/web/src/features/patients/pages/patient-list-page.tsx
```

The important shape is:

```tsx
import { useLoaderData } from "react-router-dom";
import type { Patient } from "../types.js";
import { listPatients } from "../api.js";

export const patientListLoader = async () => {
  try {
    return await listPatients();
  } catch {
    return [];
  }
};

const PatientListPage = () => {
  const loadedPatients = useLoaderData() as Patient[];
  // render rows from loadedPatients
};

export default PatientListPage;
```

This keeps data loading tied to navigation instead of a component-level
`useEffect`.

## Step 8: Load Patient Details Through React Router

The detail page owns the patient-detail loader:

```text
apps/web/src/features/patients/pages/patient-page.tsx
```

The important shape is:

```tsx
import type { LoaderFunctionArgs } from "react-router-dom";
import { useLoaderData } from "react-router-dom";
import { getPatient } from "../api.js";
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
  const loadedPatient = useLoaderData() as PatientDetails | null;
  // render chart from loadedPatient
};

export default PatientPage;
```

## Step 9: Wire The App Router

Open:

```text
apps/web/src/app/app.tsx
```

The router should import the feature loaders and pages:

```tsx
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import PatientListPage, {
  patientListLoader,
} from "../features/patients/pages/patient-list-page.js";
import PatientPage, { patientLoader } from "../features/patients/pages/patient-page.js";

const router = createBrowserRouter([
  {
    path: "/",
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
]);

const App = () => {
  return <RouterProvider router={router} />;
};

export default App;
```

The actual app can include layout, MUI theme setup, diagnosis context, and
navigation around this route structure.

## Step 10: Verify Type Safety

In `patient-list-page.tsx`, temporarily try to read `patient.ssn` from a list
row.

Run:

```powershell
pnpm --filter web check
```

Expected result: TypeScript should fail because `Patient` is
`NonSensitivePatient` and does not include `ssn`.

Remove the temporary `patient.ssn` access.

Then temporarily call `getPatient()` without an id:

```ts
await getPatient();
```

Run:

```powershell
pnpm --filter web check
```

Expected result: TypeScript should fail because patient detail requests require
a `PatientId`.

Restore the original code and run the check again.

## Step 11: Run Both Apps

Start the backend and frontend together:

```powershell
pnpm dev
```

Or start only the frontend when the backend is already running:

```powershell
pnpm --filter web dev
```

Open:

```text
http://localhost:5173
```

Expected result: the page loads patients from `/api/v1/patients`.

If the page fails to load data, check:

1. The backend is running.
2. The backend port is `3001`.
3. `apps/web/vite.config.ts` proxies `/api` to `http://localhost:3001`.
4. `GET http://localhost:3001/api/v1/patients` works directly.
5. The frontend imports public types from `@patientor/api`, not from
   `apps/server`.

## Definition Of Done

You are done when:

1. The frontend imports public API types from `@patientor/api`.
2. Feature clients call `/api/v1` through `apiBaseUrl`.
3. No frontend file imports from `apps/server`.
4. `pnpm --filter web check` passes.
5. `pnpm --filter web build` passes.
6. The browser displays patient rows from the backend.
