Andy owns this.

## Repo-local guidance

Before making substantial Effect changes, read the Patientor-specific guidance in `.best-practices/`:

1. `.best-practices/README.md`
2. `.best-practices/01-architecture-slices.md`
3. `.best-practices/02-config-and-layers.md`
4. `.best-practices/03-database-and-kysely.md`
5. `.best-practices/04-domain-errors.md`
6. `.best-practices/05-schema-validation.md`
7. `.best-practices/06-http-routes.md`
8. `.best-practices/07-testing.md`

Those files are the preferred local playbook for this app. They are intentionally Patientor-specific and should win over generic Effect examples unless the installed package types prove otherwise.

## Local Floci spike

For the Floci ECR/ECS local deploy spike, read `docs/floci-ecr-ecs-spike.md`
before changing Docker, ECR, ECS, registry, or LocalStack-replacement setup. The
current Windows Docker Desktop path uses Floci ECR path-style URIs and a small
loopback proxy so Floci's ECR control plane can enumerate images in the registry
sidecar.

## Tooling

This repo uses Vite+ through the `vp` command. Vite+ wraps Oxlint, Oxfmt,
Vitest, and package builds, so do not add ESLint scaffolding to new packages
unless a package has a specific reason to opt out.

- Use `vp check` for formatting, linting, and type checking.
- Use `vp test` or `vp run -r test` for tests.
- Use `vp pack` for buildable library packages under `packages/*`.
- Keep package-level `vite.config.ts` files aligned with Vite+ package config.

<!-- effect-solutions:start -->

## Effect Best Practices

**IMPORTANT:** This repo uses the published Effect v4 beta. The installed repo
dependency is the source of truth for version-specific API shapes. Package
manifests currently request `effect@^4.0.0-beta.65`, while the lockfile and
installed `node_modules` currently resolve Effect packages to `4.0.0-beta.66`.

Before writing Effect code:

1. Check `apps/server/package.json` / `pnpm-lock.yaml` for the repo's pinned Effect version.
2. Use `apps/server/node_modules/effect` for installed v4 examples and type signatures.
3. Prefer existing repo code patterns and `.best-practices/` over external examples when the local code already has a clear v4 pattern.

Topics: quick-start, project-setup, tsconfig, basics, services-and-layers, data-modeling, error-handling, config, testing, cli.

Never guess at Effect patterns - check the installed v4 package docs/types first.

## Platform note

Some older generated guidance below referenced a Windows-only shared checkout path such as:

`C:\Users\lenny\.local\share\effect-solutions\effect`

Do **not** assume that path exists. The current development environment may differ by machine, and the reliable source of truth in this repo is the installed package under `node_modules/effect` plus the Patientor-specific `.best-practices/` files.

If a Windows checkout exists on another machine, treat it as optional background context only. Always verify exact APIs against this repo's installed `node_modules` before editing code.

<!-- effect-solutions:end -->
