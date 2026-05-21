import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const repoRoot = process.cwd();
const baselinePath = path.join(repoRoot, "tooling", "type-assertion-baseline.json");
const assertionBaseline = new Map(
  Object.entries(JSON.parse(fs.readFileSync(baselinePath, "utf8"))),
);

const assertionMessage =
  "Avoid new `as` type assertions. Prefer inference, narrowing, typed helpers, or schema validation. If this is a necessary boundary cast, add it to the assertion baseline intentionally.";

const unknownMessage =
  "Avoid `unknown` in regular product code. Keep it at route handlers, API boundaries, DB loading boundaries, schema parsing, or other external-data boundaries.";

const sourceRoots = ["apps/server/src", "apps/web/src", "packages"];
const ignoredDirectories = new Set(["node_modules", "dist", "build", "coverage", ".vite"]);

const normalizeText = (text) => text.replace(/\s+/g, " ").trim();

const toRepoPath = (filename) => path.relative(repoRoot, filename).replaceAll(path.sep, "/");

const isTypeScriptSource = (filename) =>
  (filename.endsWith(".ts") || filename.endsWith(".tsx")) && !filename.endsWith(".d.ts");

const collectFiles = (directory) => {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const files = [];
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...collectFiles(entryPath));
      }
      continue;
    }

    if (entry.isFile() && isTypeScriptSource(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
};

const isTestFile = (repoPath) => /\.test\.[cm]?[jt]sx?$|\.spec\.[cm]?[jt]sx?$/.test(repoPath);

const allowsProductUnknown = (repoPath) => {
  if (isTestFile(repoPath)) {
    return true;
  }

  if (repoPath === "apps/web/src/shared/api-client.ts") {
    return true;
  }

  if (repoPath.startsWith("apps/server/src/db/") || repoPath.startsWith("apps/server/src/http/")) {
    return true;
  }

  if (
    repoPath.startsWith("apps/server/src/") &&
    (repoPath.endsWith("api.ts") ||
      repoPath.endsWith("http.ts") ||
      repoPath.endsWith("repository.ts") ||
      repoPath.endsWith("service.ts"))
  ) {
    return true;
  }

  return false;
};

const checksProductUnknown = (repoPath) =>
  (repoPath.startsWith("apps/web/src/") || repoPath.startsWith("apps/server/src/")) &&
  !allowsProductUnknown(repoPath);

const getLocation = (sourceFile, node) => {
  const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return `${toRepoPath(sourceFile.fileName)}:${location.line + 1}:${location.character + 1}`;
};

const diagnostics = [];
const seenAssertions = new Map();

const visit = (sourceFile, node) => {
  const repoPath = toRepoPath(sourceFile.fileName);

  if (ts.isAsExpression(node)) {
    const typeText = normalizeText(node.type.getText(sourceFile));

    if (typeText !== "const") {
      const assertionText = normalizeText(node.getText(sourceFile));
      const baselineKey = `${repoPath}::${assertionText}`;
      const seenCount = (seenAssertions.get(baselineKey) ?? 0) + 1;
      seenAssertions.set(baselineKey, seenCount);

      if (seenCount > (assertionBaseline.get(baselineKey) ?? 0)) {
        diagnostics.push(`${getLocation(sourceFile, node)} ${assertionMessage}`);
      }
    }
  }

  if (checksProductUnknown(repoPath) && node.kind === ts.SyntaxKind.UnknownKeyword) {
    diagnostics.push(`${getLocation(sourceFile, node)} ${unknownMessage}`);
  }

  ts.forEachChild(node, (child) => visit(sourceFile, child));
};

for (const sourceRoot of sourceRoots) {
  for (const filename of collectFiles(path.join(repoRoot, sourceRoot))) {
    const sourceText = fs.readFileSync(filename, "utf8");
    const sourceKind = filename.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(
      filename,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      sourceKind,
    );
    visit(sourceFile, sourceFile);
  }
}

if (diagnostics.length > 0) {
  console.error(diagnostics.join("\n"));
  process.exitCode = 1;
}
