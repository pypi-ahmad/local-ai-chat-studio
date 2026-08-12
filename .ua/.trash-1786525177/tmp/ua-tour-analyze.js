const fs = require('fs');

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) fail('Usage: node ua-tour-analyze.js <input.json> <output.json>');

try {
  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const nodes = Array.isArray(input.nodes) ? input.nodes : [];
  const edges = Array.isArray(input.edges) ? input.edges : [];
  const layers = Array.isArray(input.layers) ? input.layers : [];
  const byId = new Map(nodes.map(node => [node.id, node]));
  const fanIn = new Map(nodes.map(node => [node.id, 0]));
  const fanOut = new Map(nodes.map(node => [node.id, 0]));
  const forward = new Map(nodes.map(node => [node.id, []]));

  for (const edge of edges) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) continue;
    fanOut.set(edge.source, fanOut.get(edge.source) + 1);
    fanIn.set(edge.target, fanIn.get(edge.target) + 1);
    if (edge.type === 'imports' || edge.type === 'calls') forward.get(edge.source).push(edge.target);
  }

  const ranked = (map, property) => nodes.map(node => ({ id: node.id, [property]: map.get(node.id), name: node.name }))
    .sort((a, b) => b[property] - a[property] || a.id.localeCompare(b.id)).slice(0, 20);
  const topFanOutCutoff = [...fanOut.values()].sort((a, b) => b - a)[Math.max(0, Math.ceil(nodes.length * 0.1) - 1)] ?? 0;
  const lowFanInCutoff = [...fanIn.values()].sort((a, b) => a - b)[Math.max(0, Math.ceil(nodes.length * 0.25) - 1)] ?? 0;
  const basename = node => String(node.filePath || node.name || '').split(/[\\/]/).pop();
  const depth = node => {
    const parts = String(node.filePath || '').split(/[\\/]/).filter(Boolean);
    return parts.length;
  };
  const codeNames = new Set(['index.ts','index.js','main.ts','main.js','app.ts','app.js','server.ts','server.js','mod.rs','main.go','main.py','main.rs','manage.py','app.py','wsgi.py','asgi.py','run.py','__main__.py','Application.java','Main.java','Program.cs','config.ru','index.php','App.swift','Application.kt','main.cpp','main.c']);
  const entryPointCandidates = nodes.map(node => {
    let score = 0;
    if (node.type === 'document') {
      if (String(node.filePath || node.name) === 'README.md') score += 5;
      else if (depth(node) === 1 && basename(node).endsWith('.md')) score += 2;
    } else if (node.type === 'file') {
      if (codeNames.has(basename(node))) score += 3;
      if (depth(node) <= 2) score += 1;
      if (fanOut.get(node.id) >= topFanOutCutoff) score += 1;
      if (fanIn.get(node.id) <= lowFanInCutoff) score += 1;
    }
    return { id: node.id, score, name: node.name, summary: node.summary || '', type: node.type };
  }).filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, 5);

  const bfsStart = entryPointCandidates.find(candidate => candidate.type === 'file')?.id || null;
  const order = [], depthMap = {}, byDepth = {};
  if (bfsStart) {
    const queue = [bfsStart]; depthMap[bfsStart] = 0;
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i], nodeDepth = depthMap[id]; order.push(id);
      (byDepth[nodeDepth] ||= []).push(id);
      for (const target of forward.get(id) || []) if (!(target in depthMap)) { depthMap[target] = nodeDepth + 1; queue.push(target); }
    }
  }

  const categorised = { documentation: [], infrastructure: [], data: [], config: [] };
  for (const node of nodes) {
    const value = { id: node.id, name: node.name, type: node.type, summary: node.summary || '' };
    if (node.type === 'document') categorised.documentation.push(value);
    else if (['service', 'pipeline', 'resource'].includes(node.type)) categorised.infrastructure.push(value);
    else if (['table', 'schema', 'endpoint'].includes(node.type)) categorised.data.push(value);
    else if (node.type === 'config') categorised.config.push(value);
  }

  const pairCounts = new Map();
  for (const edge of edges) if ((edge.type === 'imports' || edge.type === 'calls') && byId.has(edge.source) && byId.has(edge.target)) {
    const key = `${edge.source}\u0000${edge.target}`;
    pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
  }
  const clusters = [];
  const seen = new Set();
  for (const [key] of pairCounts) {
    const [a, b] = key.split('\u0000');
    const reverse = `${b}\u0000${a}`;
    if (!pairCounts.has(reverse)) continue;
    const seed = [a, b].sort(); const signature = seed.join('\u0000');
    if (seen.has(signature)) continue; seen.add(signature);
    const members = new Set(seed);
    let changed = true;
    while (changed && members.size < 5) {
      changed = false;
      for (const candidate of nodes.map(node => node.id)) {
        if (members.has(candidate)) continue;
        let connections = 0;
        for (const member of members) if (pairCounts.has(`${candidate}\u0000${member}`) || pairCounts.has(`${member}\u0000${candidate}`)) connections++;
        if (connections >= 2) { members.add(candidate); changed = true; if (members.size >= 5) break; }
      }
    }
    const memberList = [...members].sort();
    let edgeCount = 0;
    for (const edge of edges) if (members.has(edge.source) && members.has(edge.target)) edgeCount++;
    clusters.push({ nodes: memberList, edgeCount });
  }
  clusters.sort((a, b) => b.edgeCount - a.edgeCount || a.nodes.join(',').localeCompare(b.nodes.join(',')));

  const nodeSummaryIndex = Object.fromEntries(nodes.map(node => [node.id, { name: node.name, type: node.type, summary: node.summary || '' }]));
  const result = {
    scriptCompleted: true, entryPointCandidates,
    fanInRanking: ranked(fanIn, 'fanIn'), fanOutRanking: ranked(fanOut, 'fanOut'),
    bfsTraversal: { startNode: bfsStart, order, depthMap, byDepth },
    nonCodeFiles: categorised, clusters: clusters.slice(0, 10),
    layers: { count: layers.length, list: layers.map(({ id, name, description }) => ({ id, name, description })) },
    nodeSummaryIndex, totalNodes: nodes.length, totalEdges: edges.length
  };
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
} catch (error) { fail(error.stack || String(error)); }
