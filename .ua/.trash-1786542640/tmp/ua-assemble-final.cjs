const fs = require('fs');

const [graphPath, scanPath, layersPath, tourPath, outputPath, gitCommitHash] = process.argv.slice(2);
const fragment = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
const scan = JSON.parse(fs.readFileSync(scanPath, 'utf8'));
let layers = JSON.parse(fs.readFileSync(layersPath, 'utf8'));
let tour = JSON.parse(fs.readFileSync(tourPath, 'utf8'));
layers = Array.isArray(layers) ? layers : layers.layers || [];
tour = Array.isArray(tour) ? tour : tour.steps || [];

const nodeIds = new Set(fragment.nodes.map((node) => node.id));
const prefixes = /^(file|config|document|service|pipeline|table|schema|resource|endpoint):/;
const normalizeId = (value) => prefixes.test(value) ? value : `file:${value}`;

layers = layers.map((layer, index) => ({
  id: layer.id || `layer:${String(layer.name || `layer-${index + 1}`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
  name: layer.name || `Layer ${index + 1}`,
  description: layer.description || 'Project components grouped by responsibility.',
  nodeIds: (layer.nodeIds || layer.nodes || []).map((item) => normalizeId(typeof item === 'string' ? item : item.id)).filter((id) => nodeIds.has(id)),
}));

tour = tour.map((step, index) => ({
  order: Number(step.order || index + 1),
  title: step.title || `Step ${index + 1}`,
  description: step.description || step.whyItMatters || 'Inspect these components to continue the guided tour.',
  nodeIds: (step.nodeIds || step.nodesToInspect || []).map(normalizeId).filter((id) => nodeIds.has(id)),
  ...(typeof step.languageLesson === 'string' ? { languageLesson: step.languageLesson } : {}),
})).sort((a, b) => a.order - b.order);

const graph = {
  version: '1.0.0',
  project: {
    name: scan.name,
    languages: scan.languages,
    frameworks: scan.frameworks,
    description: scan.description,
    analyzedAt: new Date().toISOString(),
    gitCommitHash,
  },
  nodes: fragment.nodes,
  edges: fragment.edges,
  layers,
  tour,
};
fs.writeFileSync(outputPath, JSON.stringify(graph, null, 2));
