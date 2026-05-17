# Tutorial 04: Extract `packages/db` Only When It Is Needed

Do not do this tutorial now unless there is a second trusted backend runtime
that needs direct database access.

Good reasons to do it:

```text
apps/worker
apps/admin-api
apps/reporting-service
apps/scheduler
```

Bad reasons to do it:

```text
apps/web needs types
the repo is a monorepo
Kysely generated types look reusable
```

User impact: this should not change public API behavior. It only moves private
database infrastructure so multiple backend runtimes can share it.

## Target Shape

```text
packages/db/
  package.json
  tsconfig.json
  vite.config.ts
  src/
    index.ts
    database.ts
    generated.ts
    entryTypes.ts
    migrate.ts

apps/server/
  src/
    patients/repository.ts
    diagnoses/service.ts
```

Keep repositories in the app unless multiple backend apps truly share the same
feature behavior.

## Step 1: Confirm The Decision

Before creating `packages/db`, answer these questions in the PR description:

1. What second backend runtime needs direct DB access?
2. Which DB files will it import?
3. Why is calling `apps/server` over HTTP not enough?
4. How will `packages/db` stay unavailable to `apps/web`?

If you cannot answer all four, stop. Keep DB code inside `apps/server`.

## Step 2: Create The Package Folder

Run:

```powershell
New-Item -ItemType Directory -Force packages/db/src
```

## Step 3: Create `packages/db/package.json`

Create:

```text
packages/db/package.json
```

Paste:

```json
{
  "name": "@patientor/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./dist/index.mjs"
    },
    "./package.json": "./package.json"
  },
  "scripts": {
    "build": "vp pack",
    "dev": "vp pack --watch",
    "check": "vp check",
    "typecheck": "vp check --no-fmt --no-lint",
    "test": "vp test --passWithNoTests"
  },
  "dependencies": {
    "effect": "^4.0.0-beta.65",
    "kysely": "^0.28.17",
    "pg": "^8.20.0"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "@types/pg": "^8.20.0",
    "typescript": "catalog:",
    "vite-plus": "catalog:",
    "vitest": "catalog:"
  }
}
```

## Step 4: Create `packages/db/tsconfig.json`

Create:

```text
packages/db/tsconfig.json
```

Paste:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "moduleDetection": "force",
    "resolveJsonModule": true,
    "types": ["node"],
    "declaration": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "strict": true,
    "noUnusedLocals": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

## Step 5: Create `packages/db/vite.config.ts`

Create:

```text
packages/db/vite.config.ts
```

Paste:

```ts
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    dts: true,
    exports: {
      devExports: "types",
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

## Step 6: Move DB Infrastructure Files

Move these files:

```text
apps/server/src/db/database.ts  -> packages/db/src/database.ts
apps/server/src/db/generated.ts -> packages/db/src/generated.ts
apps/server/src/db/entryTypes.ts -> packages/db/src/entryTypes.ts
apps/server/src/db/migrate.ts -> packages/db/src/migrate.ts
```

Do not move:

```text
apps/server/src/db/seed.ts
apps/server/src/patients/repository.ts
apps/server/src/diagnoses/service.ts
```

Reason:

1. `seed.ts` uses app-owned seed data.
2. repositories contain Patientor feature behavior.
3. services contain app behavior, not just database infrastructure.

## Step 7: Create `packages/db/src/index.ts`

Create:

```text
packages/db/src/index.ts
```

Paste:

```ts
export * from "./database.js";
export * from "./generated.js";
```

Do not export migration helpers unless another backend runtime truly needs
them.

## Step 8: Fix Imports Inside `packages/db`

Open:

```text
packages/db/src/database.ts
packages/db/src/migrate.ts
```

Fix imports that still point at `apps/server`.

If `database.ts` imports server config, stop and decide whether config should
also move. Usually the better first design is:

1. Keep app config in each backend app.
2. Export a DB layer factory from `@patientor/db`.
3. Let each backend app pass its own `DATABASE_URL`.

Do not make `@patientor/db` import `apps/server/src/config.ts`.

## Step 9: Add `@patientor/db` To Server

Open:

```text
apps/server/package.json
```

Add:

```json
{
  "dependencies": {
    "@patientor/db": "workspace:*"
  }
}
```

Run:

```powershell
pnpm install
```

## Step 10: Update Server Imports

Replace imports like:

```ts
import { Database } from "../db/database.js";
import type { DB } from "../db/generated.js";
```

with:

```ts
import { Database } from "@patientor/db";
import type { DB } from "@patientor/db";
```

Check all server DB imports:

```powershell
rg -n "src/db|\\.\\./db|\\.\\/db" apps/server/src apps/server/tests
```

Fix each result intentionally.

## Step 11: Protect The Frontend Boundary

Run:

```powershell
rg -n "@patientor/db|packages/db|db/generated" apps/web packages/api
```

Expected result: no matches.

If the frontend or API package imports `@patientor/db`, stop and remove that
import. The DB package is backend-only.

## Step 12: Verify

Run:

```powershell
pnpm --filter @patientor/db check
pnpm --filter @patientor/db build
pnpm --filter server typecheck
pnpm check
```

If tests are working in the repo, also run:

```powershell
pnpm --filter server test
```

## Definition Of Done

You are done when:

1. A second backend runtime imports `@patientor/db`.
2. `apps/web` does not import `@patientor/db`.
3. `packages/api` does not import `@patientor/db`.
4. Server repositories still own feature-specific mapping.
5. `pnpm check` passes.
6. Public HTTP responses are unchanged.
