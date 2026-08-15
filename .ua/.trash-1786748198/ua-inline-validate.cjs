const fs = require("fs");
const path = require("path");

const root = process.argv[2];
const commit = process.argv[3];
if (!root || !commit) {
  console.error("Usage: node ua-inline-validate.cjs <project-root> <commit>");
  process.exit(1);
}

const ua = path.join(root, ".ua");
const intermediate = path.join(ua, "intermediate");
const graphPath = path.join(intermediate, "assembled-graph.json");
const layersPath = path.join(intermediate, "layers.json");
const tourPath = path.join(intermediate, "tour.json");
const scanPath = path.join(intermediate, "scan-result.json");
const reviewPath = path.join(intermediate, "review.json");

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const writeJson = (file, value) =>
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");

const base = readJson(graphPath);
const scan = readJson(scanPath);
const nodeIds = new Set(base.nodes.map((node) => node.id));
const fileTypes = new Set([
  "file", "config", "document", "service", "pipeline",
  "table", "schema", "resource", "endpoint",
]);
const fileNodeIds = new Set(
  base.nodes.filter((node) => fileTypes.has(node.type)).map((node) => node.id),
);

const rawLayers = readJson(layersPath);
const layerList = Array.isArray(rawLayers) ? rawLayers : rawLayers.layers || [];
const claimed = new Set();
const layers = layerList.map((layer, index) => {
  const sourceIds = layer.nodeIds || layer.nodes || [];
  const nodeIdsForLayer = sourceIds
    .map((value) => (typeof value === "string" ? value : value?.id))
    .map((value) => {
      if (!value || value.includes(":")) return value;
      const match = base.nodes.find((node) => node.filePath === value);
      return match?.id;
    })
    .filter((value) => value && fileNodeIds.has(value) && !claimed.has(value));
  nodeIdsForLayer.forEach((value) => claimed.add(value));
  const name = String(layer.name || `Layer ${index + 1}`);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    id: String(layer.id || `layer:${slug || index + 1}`),
    name,
    description: String(layer.description || `${name} project files.`),
    nodeIds: nodeIdsForLayer,
  };
});

const unassigned = [...fileNodeIds].filter((id) => !claimed.has(id));
if (unassigned.length) {
  layers.push({
    id: "layer:other-project-files",
    name: "Other Project Files",
    description: "Project files that support the application outside the primary architectural groups.",
    nodeIds: unassigned,
  });
}

const normalizedLayers = layers.filter((layer) => layer.nodeIds.length > 0);
writeJson(layersPath, normalizedLayers);

const rawTour = readJson(tourPath);
const stepList = Array.isArray(rawTour) ? rawTour : rawTour.steps || [];
const tour = stepList
  .map((step, index) => {
    const sourceIds = step.nodeIds || step.nodesToInspect || [];
    const validIds = sourceIds
      .map((value) => (typeof value === "string" ? value : value?.id))
      .map((value) => {
        if (!value || value.includes(":")) return value;
        const match = base.nodes.find((node) => node.filePath === value);
        return match?.id;
      })
      .filter((value) => value && nodeIds.has(value));
    const normalized = {
      order: index + 1,
      title: String(step.title || `Step ${index + 1}`),
      description: String(step.description || step.whyItMatters || "Explore this part of the project."),
      nodeIds: [...new Set(validIds)].slice(0, 5),
    };
    if (step.languageLesson) normalized.languageLesson = String(step.languageLesson);
    return normalized;
  })
  .filter((step) => step.nodeIds.length > 0)
  .map((step, index) => ({ ...step, order: index + 1 }));
writeJson(tourPath, tour);

const project = {
  name: scan.name,
  languages: scan.languages,
  frameworks: scan.frameworks,
  description: scan.description,
  analyzedAt: new Date().toISOString(),
  gitCommitHash: commit,
};
const graph = {
  version: "1.0.0",
  project,
  nodes: base.nodes,
  edges: base.edges,
  layers: normalizedLayers,
  tour,
};
writeJson(graphPath, graph);

const issues = [];
const warnings = [];
const seenNodeIds = new Set();
for (const node of graph.nodes) {
  if (!node || typeof node.id !== "string" || !node.id) issues.push("Node missing id");
  if (seenNodeIds.has(node.id)) issues.push(`Duplicate node id: ${node.id}`);
  seenNodeIds.add(node.id);
  if (typeof node.type !== "string" || !node.type) issues.push(`Node ${node.id} missing type`);
  if (typeof node.name !== "string" || !node.name) issues.push(`Node ${node.id} missing name`);
  if (typeof node.summary !== "string" || !node.summary) issues.push(`Node ${node.id} missing summary`);
  if (!Array.isArray(node.tags)) issues.push(`Node ${node.id} missing tags array`);
}
for (const edge of graph.edges) {
  if (!seenNodeIds.has(edge.source)) issues.push(`Dangling edge source: ${edge.source}`);
  if (!seenNodeIds.has(edge.target)) issues.push(`Dangling edge target: ${edge.target}`);
  if (typeof edge.type !== "string" || !edge.type) issues.push("Edge missing type");
}
const layerAssignments = new Map();
for (const layer of graph.layers) {
  if (!layer.id || !layer.name || !layer.description || !layer.nodeIds.length) {
    issues.push(`Invalid layer: ${layer.id || "<missing>"}`);
  }
  for (const id of layer.nodeIds) {
    if (!fileNodeIds.has(id)) issues.push(`Layer references non-file node: ${id}`);
    layerAssignments.set(id, (layerAssignments.get(id) || 0) + 1);
  }
}
for (const id of fileNodeIds) {
  const count = layerAssignments.get(id) || 0;
  if (count !== 1) issues.push(`File node ${id} has ${count} layer assignments`);
}
if (graph.tour.length < 5 || graph.tour.length > 15) issues.push(`Tour has ${graph.tour.length} steps`);
graph.tour.forEach((step, index) => {
  if (step.order !== index + 1) issues.push(`Tour order mismatch at ${step.title}`);
  if (!step.title || !step.description || !step.nodeIds.length) issues.push(`Invalid tour step ${index + 1}`);
  step.nodeIds.forEach((id) => {
    if (!seenNodeIds.has(id)) issues.push(`Tour references missing node: ${id}`);
  });
});

const review = {
  valid: issues.length === 0,
  issues: [...new Set(issues)],
  warnings,
  stats: {
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    fileNodes: fileNodeIds.size,
    layers: graph.layers.length,
    tourSteps: graph.tour.length,
  },
};
writeJson(reviewPath, review);
console.log(JSON.stringify(review));
if (!review.valid) process.exitCode = 1;
