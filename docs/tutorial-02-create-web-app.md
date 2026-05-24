# Tutorial 02: Create `apps/web`

This tutorial creates the frontend app shell. In the current repo, `apps/web`
already exists and has grown beyond this minimal shell, so use this as the
baseline shape for a fresh checkout or older branch.

User impact: there is no product UI yet. The goal is a clean workspace app that
can later import `@patientor/api` without touching server internals.

## What You Will Create

```text
apps/web/
  package.json
  tsconfig.json
  vite.config.ts
  index.html
  src/
    app/
      app.tsx
    main.tsx
    index.css
```

## Step 1: Create The Folder

From the repo root:

```powershell
New-Item -ItemType Directory -Force apps/web/src
New-Item -ItemType Directory -Force apps/web/src/app
```

## Step 2: Create `apps/web/package.json`

Create:

```text
apps/web/package.json
```

Paste:

```json
{
  "name": "web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "vite build",
    "preview": "vite preview --host 0.0.0.0",
    "check": "vp check",
    "typecheck": "vp check --no-fmt --no-lint",
    "test": "vp test --passWithNoTests"
  },
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
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "typescript": "catalog:",
    "vite": "catalog:",
    "vite-plus": "catalog:",
    "vitest": "catalog:"
  }
}
```

What you should learn:

1. `@patientor/api` is a frontend dependency.
2. The frontend imports from the API package, not from `apps/server`.
3. MUI and React Router are part of the current app shell.
4. The web app does not need a direct `effect` dependency unless it starts
   creating Effect clients or decoding schemas at runtime.

## Step 3: Create `apps/web/tsconfig.json`

Create:

```text
apps/web/tsconfig.json
```

Paste:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "moduleDetection": "force",
    "resolveJsonModule": true,
    "types": ["node", "vite/client"],
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "vite.config.ts"]
}
```

## Step 4: Create `apps/web/vite.config.ts`

Create:

```text
apps/web/vite.config.ts
```

Paste:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
```

What you should learn:

1. The frontend dev server runs on `5173`.
2. Calls to `/api/*` are proxied to the backend on `3001`.
3. Browser code can call `/api/v1/patients` without hardcoding the backend URL.

## Step 5: Create `apps/web/index.html`

Create:

```text
apps/web/index.html
```

Paste:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Patientor</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

## Step 6: Create The React Entry

Create:

```text
apps/web/src/main.tsx
```

Paste:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/app.js";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

## Step 7: Create The First App Screen

Create:

```text
apps/web/src/app/app.tsx
```

Paste:

```tsx
export const App = () => (
  <main className="page">
    <section className="panel">
      <p className="eyebrow">Patientor</p>
      <h1>Patient records</h1>
      <p>
        Frontend shell is ready. The next tutorial connects this screen to the shared API contract.
      </p>
    </section>
  </main>
);
```

## Step 8: Add Minimal Styling

Create:

```text
apps/web/src/index.css
```

Paste:

```css
:root {
  color: #1d2433;
  background: #f6f7f9;
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

body {
  margin: 0;
}

.page {
  min-height: 100vh;
  padding: 48px;
}

.panel {
  max-width: 720px;
}

.eyebrow {
  color: #456179;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0;
  margin: 0 0 8px;
  text-transform: uppercase;
}

h1 {
  font-size: 40px;
  line-height: 1.1;
  margin: 0 0 16px;
}

p {
  font-size: 18px;
  line-height: 1.6;
  margin: 0;
}
```

## Step 9: Install Workspace Dependencies

Run:

```powershell
pnpm install
```

## Step 10: Verify

Run:

```powershell
pnpm --filter web check
pnpm --filter web build
```

Then start the app:

```powershell
pnpm --filter web dev
```

Open:

```text
http://localhost:5173
```

Expected result: a simple Patientor page renders without errors.

## Definition Of Done

You are done when:

1. `apps/web` exists.
2. `apps/web/package.json` depends on `@patientor/api`.
3. `pnpm --filter web check` passes.
4. `pnpm --filter web build` passes.
5. The page renders at `http://localhost:5173`.
