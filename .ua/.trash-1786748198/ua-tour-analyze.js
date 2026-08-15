const fs = require('fs');

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  console.error('Usage: node ua-tour-analyze.js <input> <output>');
  process.exit(1);
}

try {
  const graph = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const fanIn = new Map(nodes.map((node) => [node.id, 0]));
  const fanOut = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of edges) {
    if (byId.has(edge.source) && byId.has(edge.target)) {
      fanOut.set(edge.source, fanOut.get(edge.source) + 1);
      fanIn.set(edge.target, fanIn.get(edge.target) + 1);
    }
  }
  const ranked = (map, key) => [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 20)
    .map(([id, value]) => ({ id, [key]: value, name: byId.get(id).name }));
  const fileName = (node) => (node.filePath || node.name || '').split('/').pop();
  const candidates = nodes.map((node) => {
    let score = 0;
    const name = fileName(node);
    const path = node.filePath || '';
    if (node.type === 'document' && path === 'README.md') score += 5;
    if (node.type === 'document' && path !== 'README.md' && path.split('/').length === 1 && name.endsWith('.md')) score += 2;
    if (node.type === 'file' && /^(index|main|app|server|mod|manage|run|__main__)\.(ts|tsx|js|jsx|py|rs|go|java|cs|php|swift|kt|cpp|c)$/.test(name)) score += 3;
    if (node.type === 'file' && path.split('/').length <= 2) score += 1;
    return { id: node.id, score, name: node.name, summary: node.summary || '' };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, 5);
  const codeStart = nodes.find((node) => node.id === 'file:frontend/src/main.tsx')?.id || candidates.find((item) => byId.get(item.id)?.type === 'file')?.id || null;
  const adjacency = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges) if ((edge.type === 'imports' || edge.type === 'calls') && adjacency.has(edge.source) && adjacency.has(edge.target)) adjacency.get(edge.source).push(edge.target);
  const order = [], depthMap = {}, byDepth = {};
  if (codeStart) {
    const queue = [[codeStart, 0]], visited = new Set([codeStart]);
    while (queue.length) {
      const [id, depth] = queue.shift(); order.push(id); depthMap[id] = depth; (byDepth[depth] ||= []).push(id);
      for (const target of adjacency.get(id) || []) if (!visited.has(target)) { visited.add(target); queue.push([target, depth + 1]); }
    }
  }
  const nonCodeFiles = { documentation: [], infrastructure: [], data: [], config: [] };
  for (const node of nodes) {
    const item = { id: node.id, name: node.name, type: node.type, summary: node.summary || '' };
    if (node.type === 'document') nonCodeFiles.documentation.push(item);
    else if (['service', 'pipeline', 'resource'].includes(node.type)) nonCodeFiles.infrastructure.push(item);
    else if (['table', 'schema', 'endpoint'].includes(node.type)) nonCodeFiles.data.push(item);
    else if (node.type === 'config') nonCodeFiles.config.push(item);
  }
  const pairCounts = new Map();
  for (const edge of edges) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) continue;
    const reverse = edges.some((other) => other.source === edge.target && other.target === edge.source && other.type === edge.type);
    if (reverse) { const key = [edge.source, edge.target].sort().join('|'); pairCounts.set(key, (pairCounts.get(key) || 0) + 1); }
  }
  const clusters = [...pairCounts.entries()].sort((a,b) => b[1]-a[1]).slice(0,10).map(([key, edgeCount]) => ({ nodes: key.split('|'), edgeCount }));
  const nodeSummaryIndex = Object.fromEntries(nodes.map((node) => [node.id, { name: node.name, type: node.type, summary: node.summary || '' }]));
  fs.writeFileSync(outputPath, JSON.stringify({ scriptCompleted: true, entryPointCandidates: candidates, fanInRanking: ranked(fanIn, 'fanIn'), fanOutRanking: ranked(fanOut, 'fanOut'), bfsTraversal: { startNode: codeStart, order, depthMap, byDepth }, nonCodeFiles, clusters, layers: { count: (graph.layers || []).length, list: graph.layers || [] }, nodeSummaryIndex, totalNodes: nodes.length, totalEdges: edges.length }, null, 2));
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
