#!/usr/bin/env node
const fs = require('fs');

const [graphPath, scanPath, metaPath, gitCommitHash] = process.argv.slice(2);
const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
const scan = JSON.parse(fs.readFileSync(scanPath, 'utf8'));
const meta = {
  lastAnalyzedAt: graph.project.analyzedAt,
  gitCommitHash,
  version: '1.0.0',
  analyzedFiles: scan.files.length,
};
fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
