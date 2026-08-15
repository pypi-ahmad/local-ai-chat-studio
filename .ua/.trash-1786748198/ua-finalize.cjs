const fs = require("fs");
const path = require("path");

const root = process.argv[2];
const action = process.argv[3];
const commit = process.argv[4];
const ua = path.join(root, ".ua");
const intermediate = path.join(ua, "intermediate");

if (action === "prepare") {
  const graph = fs.readFileSync(path.join(intermediate, "assembled-graph.json"), "utf8");
  fs.writeFileSync(path.join(ua, "knowledge-graph.json"), graph, "utf8");
  const scan = JSON.parse(fs.readFileSync(path.join(intermediate, "scan-result.json"), "utf8"));
  const fingerprintInput = {
    projectRoot: root,
    sourceFilePaths: scan.files.map((file) => file.path),
    gitCommitHash: commit,
  };
  fs.writeFileSync(
    path.join(intermediate, "fingerprint-input.json"),
    `${JSON.stringify(fingerprintInput, null, 2)}\n`,
    "utf8",
  );
  console.log(`Prepared ${fingerprintInput.sourceFilePaths.length} fingerprint paths.`);
} else if (action === "meta") {
  const scan = JSON.parse(fs.readFileSync(path.join(intermediate, "scan-result.json"), "utf8"));
  const meta = {
    lastAnalyzedAt: new Date().toISOString(),
    gitCommitHash: commit,
    version: "1.0.0",
    analyzedFiles: scan.totalFiles,
  };
  fs.writeFileSync(path.join(ua, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  console.log(`Metadata written for ${meta.analyzedFiles} files.`);
} else {
  console.error("Usage: node ua-finalize.cjs <project-root> <prepare|meta> <commit>");
  process.exit(1);
}
