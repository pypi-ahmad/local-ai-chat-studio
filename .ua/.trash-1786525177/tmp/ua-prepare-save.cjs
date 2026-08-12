#!/usr/bin/env node
const fs = require('fs');

const [assembledPath, scanPath, graphOutputPath, fingerprintInputPath, projectRoot, gitCommitHash] = process.argv.slice(2);
const graph = JSON.parse(fs.readFileSync(assembledPath, 'utf8'));
const scan = JSON.parse(fs.readFileSync(scanPath, 'utf8'));
const sourceFilePaths = scan.files.map((file) => file.path);

fs.writeFileSync(graphOutputPath, JSON.stringify(graph, null, 2) + '\n');
fs.writeFileSync(fingerprintInputPath, JSON.stringify({ projectRoot, sourceFilePaths, gitCommitHash }, null, 2) + '\n');
