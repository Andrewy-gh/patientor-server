import fs from "node:fs";
import path from "node:path";

const assertionMessage =
  "Avoid new `as` type assertions. Prefer inference, narrowing, typed helpers, or schema validation. If this is a necessary boundary cast, add it to the assertion baseline intentionally.";

const unknownMessage =
  "Avoid `unknown` in regular product code. Keep it at route handlers, API boundaries, DB loading boundaries, schema parsing, or other external-data boundaries.";

const baselinePath = path.join(process.cwd(), "tooling", "type-assertion-baseline.json");
const assertionBaseline = new Map(
  Object.entries(JSON.parse(fs.readFileSync(baselinePath, "utf8"))),
);

const normalizeText = (text) => text.replace(/\s+/g, " ").trim();

const toRepoPath = (filename) => {
  const absolutePath = path.isAbsolute(filename) ? filename : path.resolve(process.cwd(), filename);
  return path.relative(process.cwd(), absolutePath).replaceAll(path.sep, "/");
};

const getSourceCode = (context) => context.sourceCode ?? context.getSourceCode();

const getNodeText = (sourceCode, node) => {
  if (Array.isArray(node.range)) {
    return sourceCode.getText().slice(node.range[0], node.range[1]);
  }

  if (typeof node.start === "number" && typeof node.end === "number") {
    return sourceCode.getText().slice(node.start, node.end);
  }

  return sourceCode.getText(node);
};

const noUntrackedTypeAssertions = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow new TypeScript `as` assertions unless tracked in the baseline.",
    },
    schema: [],
  },
  createOnce(context) {
    let sourceCode;
    let filename;
    let seenAssertions;

    return {
      before() {
        sourceCode = getSourceCode(context);
        filename = toRepoPath(context.filename ?? context.getFilename());
        seenAssertions = new Map();
      },
      TSAsExpression(node) {
        const typeText = normalizeText(getNodeText(sourceCode, node.typeAnnotation));

        if (typeText === "const") {
          return;
        }

        const assertionText = normalizeText(getNodeText(sourceCode, node));
        const baselineKey = `${filename}::${assertionText}`;
        const seenCount = (seenAssertions.get(baselineKey) ?? 0) + 1;
        seenAssertions.set(baselineKey, seenCount);

        if (seenCount <= (assertionBaseline.get(baselineKey) ?? 0)) {
          return;
        }

        context.report({
          node,
          message: assertionMessage,
        });
      },
    };
  },
};

const noProductUnknown = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow `unknown` in regular product code.",
    },
    schema: [],
  },
  createOnce(context) {
    return {
      TSUnknownKeyword(node) {
        context.report({
          node,
          message: unknownMessage,
        });
      },
    };
  },
};

export default {
  meta: {
    name: "local",
  },
  rules: {
    "no-untracked-type-assertions": noUntrackedTypeAssertions,
    "no-product-unknown": noProductUnknown,
  },
};
