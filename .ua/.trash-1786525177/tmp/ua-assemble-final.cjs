#!/usr/bin/env node
const fs = require('fs');

const [graphPath, layersPath, tourPath, scanPath, outputPath, gitCommitHash] = process.argv.slice(2);
const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
const layers = JSON.parse(fs.readFileSync(layersPath, 'utf8'));
const tour = JSON.parse(fs.readFileSync(tourPath, 'utf8'));
const scan = JSON.parse(fs.readFileSync(scanPath, 'utf8'));
const nodeIds = new Set(graph.nodes.map((node) => node.id));

if (!Array.isArray(layers) || !layers.every((layer) =>
  layer && typeof layer.id === 'string' && typeof layer.name === 'string' &&
  typeof layer.description === 'string' && Array.isArray(layer.nodeIds))) {
  throw new Error('layers.json has an invalid shape');
}
if (!Array.isArray(tour) || !tour.every((step) =>
  step && Number.isInteger(step.order) && typeof step.title === 'string' &&
  typeof step.description === 'string' && Array.isArray(step.nodeIds) &&
  (step.languageLesson === undefined || typeof step.languageLesson === 'string'))) {
  throw new Error('tour.json has an invalid shape');
}
for (const layer of layers) {
  for (const id of layer.nodeIds) {
    if (!nodeIds.has(id)) throw new Error(`Layer '${layer.id}' references missing node '${id}'`);
  }
}
for (const step of tour) {
  for (const id of step.nodeIds) {
    if (!nodeIds.has(id)) throw new Error(`Tour step ${step.order} references missing node '${id}'`);
  }
}

const output = {
  version: '1.0.0',
  project: {
    name: scan.name,
    languages: scan.languages,
    frameworks: scan.frameworks,
    description: scan.description,
    analyzedAt: new Date().toISOString(),
    gitCommitHash,
  },
  nodes: graph.nodes,
  edges: graph.edges,
  layers,
  tour,
};
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');
