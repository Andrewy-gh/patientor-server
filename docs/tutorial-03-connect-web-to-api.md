# Tutorial 03: Connect `apps/web` To `@patientor/api`

This tutorial teaches the frontend to use the shared public API types.

User impact: the frontend can safely display patient data without importing
server or database code.

Prerequisite: finish `docs/tutorial-02-create-web-app.md`.

## What You Will Change

Files to create:

```text
apps/web/src/api/patients.ts
apps/web/src/features/patients/PatientList.tsx
```

Files to edit:

```text
apps/web/src/App.tsx
apps/web/src/styles.css
```

## Step 1: Create The API Folder

Run:

```powershell
New-Item -ItemType Directory -Force apps/web/src/api
New-Item -ItemType Directory -Force apps/web/src/features/patients
```

## Step 2: Create A Typed Patient Fetcher

Create:

```text
apps/web/src/api/patients.ts
```

Paste:

```ts
import type { NonSensitivePatient } from "@patientor/api";

export const listPatients = async (): Promise<ReadonlyArray<NonSensitivePatient>> => {
  const response = await fetch("/api/patients");

  if (!response.ok) {
    throw new Error(`Failed to load patients: ${response.status}`);
  }

  return (await response.json()) as ReadonlyArray<NonSensitivePatient>;
};
```

What you should learn:

1. The frontend imports public DTO types from `@patientor/api`.
2. It does not import `apps/server/src/patients/types.ts`.
3. `NonSensitivePatient` intentionally has no `ssn`.

## Step 3: Create A Patient List Component

Create:

```text
apps/web/src/features/patients/PatientList.tsx
```

Paste:

```tsx
import { useEffect, useState } from "react";
import type { NonSensitivePatient } from "@patientor/api";
import { listPatients } from "../../api/patients.js";

type LoadState =
  | { readonly status: "loading" }
  | { readonly status: "loaded"; readonly patients: ReadonlyArray<NonSensitivePatient> }
  | { readonly status: "failed"; readonly message: string };

export const PatientList = () => {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let isCurrent = true;

    listPatients()
      .then((patients) => {
        if (isCurrent) {
          setState({ status: "loaded", patients });
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setState({
            status: "failed",
            message: error instanceof Error ? error.message : "Failed to load patients",
          });
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  if (state.status === "loading") {
    return <p className="status">Loading patients...</p>;
  }

  if (state.status === "failed") {
    return <p className="status statusError">{state.message}</p>;
  }

  return (
    <table className="patientTable">
      <thead>
        <tr>
          <th>Name</th>
          <th>Date of birth</th>
          <th>Gender</th>
          <th>Occupation</th>
        </tr>
      </thead>
      <tbody>
        {state.patients.map((patient) => (
          <tr key={patient.id}>
            <td>{patient.name}</td>
            <td>{patient.dateOfBirth}</td>
            <td>{patient.gender}</td>
            <td>{patient.occupation}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
```

What you should learn:

1. The component cannot read `patient.ssn` because the imported type does not
   include it.
2. The UI has explicit loading, loaded, and failed states.
3. The browser only knows the public API shape.

## Step 4: Render The Patient List

Open:

```text
apps/web/src/App.tsx
```

Replace it with:

```tsx
import { PatientList } from "./features/patients/PatientList.js";

export const App = () => (
  <main className="page">
    <header className="pageHeader">
      <p className="eyebrow">Patientor</p>
      <h1>Patient records</h1>
    </header>

    <PatientList />
  </main>
);
```

## Step 5: Update Styling

Open:

```text
apps/web/src/styles.css
```

Append:

```css
.pageHeader {
  margin-bottom: 32px;
}

.status {
  color: #456179;
  font-size: 16px;
}

.statusError {
  color: #a12622;
}

.patientTable {
  background: #ffffff;
  border-collapse: collapse;
  box-shadow: 0 1px 3px rgb(29 36 51 / 12%);
  font-size: 15px;
  max-width: 980px;
  width: 100%;
}

.patientTable th,
.patientTable td {
  border-bottom: 1px solid #e2e7ee;
  padding: 12px 14px;
  text-align: left;
}

.patientTable th {
  background: #edf2f7;
  color: #2f4357;
  font-size: 13px;
  font-weight: 700;
}
```

## Step 6: Verify Type Safety

In `PatientList.tsx`, temporarily add this inside the table row:

```tsx
<td>{patient.ssn}</td>
```

Run:

```powershell
pnpm --filter web check
```

Expected result: TypeScript should fail because `ssn` is not part of
`NonSensitivePatient`.

Remove the temporary `<td>{patient.ssn}</td>` line.

Run again:

```powershell
pnpm --filter web check
```

Expected result: it passes.

## Step 7: Run Both Apps

Terminal 1:

```powershell
pnpm dev
```

Terminal 2:

```powershell
pnpm --filter web dev
```

Open:

```text
http://localhost:5173
```

Expected result: the page loads patients from `/api/patients`.

If the page shows a failed state, check:

1. The backend is running.
2. The backend port is `3001`.
3. `apps/web/vite.config.ts` proxies `/api` to `http://localhost:3001`.
4. `GET http://localhost:3001/api/patients` works directly.

## Definition Of Done

You are done when:

1. The frontend imports `NonSensitivePatient` from `@patientor/api`.
2. No frontend file imports from `apps/server`.
3. `pnpm --filter web check` passes.
4. `pnpm --filter web build` passes.
5. The browser displays patient rows from the backend.
