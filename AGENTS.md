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

<!-- effect-solutions:start -->
## Effect Best Practices

**IMPORTANT:** This repo uses the published Effect v4 beta. The installed repo
dependency is the source of truth for version-specific API shapes:
`effect@^4.0.0-beta.60`.

Before writing Effect code:

1. Check `apps/server/package.json` / `pnpm-lock.yaml` for the repo's pinned Effect version.
2. Use `apps/server/node_modules/effect` for installed v4 examples and type signatures.
3. Prefer existing repo code patterns and `.best-practices/` over external examples when the local code already has a clear v4 pattern.

Topics: quick-start, project-setup, tsconfig, basics, services-and-layers, data-modeling, error-handling, config, testing, cli.

Never guess at Effect patterns - check the installed v4 package docs/types first.

## Platform note

Some older generated guidance below referenced a Windows-only shared checkout path such as:

`C:\Users\lenny\.local\share\effect-solutions\effect`

Do **not** assume that path exists. The current development environment may be Linux, and the reliable source of truth in this repo is the installed package under `node_modules/effect` plus the Patientor-specific `.best-practices/` files.

If a Windows checkout exists on another machine, treat it as optional background context only. Always verify exact APIs against this repo's installed `node_modules` before editing code.
<!-- effect-solutions:end -->
