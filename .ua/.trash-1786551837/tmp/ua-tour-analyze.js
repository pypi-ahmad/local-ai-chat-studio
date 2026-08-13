const fs = require('fs');

function fail(message) { console.error(message); process.exit(1); }
const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) fail('Usage: node ua-tour-analyze.js <input> <output>');

try {
  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const nodes = Array.isArray(input.nodes) ? input.nodes : [];
  const edges = Array.isArray(input.edges) ? input.edges : [];
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const inDegree = new Map(nodes.map(node => [node.id, 0]));
  const outDegree = new Map(nodes.map(node => [node.id, 0]));
  for (const edge of edges) {
    if (inDegree.has(edge.target)) inDegree.set(edge.target, inDegree.get(edge.target) + 1);
    if (outDegree.has(edge.source)) outDegree.set(edge.source, outDegree.get(edge.source) + 1);
  }
  const rank = (degree, field) => nodes.map(node => ({ id: node.id, [field]: degree.get(node.id), name: node.name }))
    .sort((a, b) => b[field] - a[field] || a.id.localeCompare(b.id)).slice(0, 20);
  const fanInRanking = rank(inDegree, 'fanIn');
  const fanOutRanking = rank(outDegree, 'fanOut');
  const outputs = [...outDegree.values()].sort((a, b) => a - b);
  const inputs = [...inDegree.values()].sort((a, b) => a - b);
  const outThreshold = outputs[Math.max(0, Math.ceil(outputs.length * .9) - 1)] || 0;
  const inThreshold = inputs[Math.max(0, Math.ceil(inputs.length * .25) - 1)] || 0;
  const filenames = /^(index\.(ts|js)|main\.(ts|js|py|rs|go|cpp|c)|app\.(ts|js|py)|server\.(ts|js)|mod\.rs|manage\.py|wsgi\.py|asgi\.py|run\.py|__main__\.py|Application\.java|Main\.java|Program\.cs|config\.ru|index\.php|App\.swift|Application\.kt)$/;
  const entryPointCandidates = nodes.map(node => {
    const path = node.filePath || '';
    const level = path.split('/').length;
    let score = 0;
    if (node.type === 'file') {
      if (filenames.test(node.name || '')) score += 3;
      if (level <= 2) score += 1;
      if (outDegree.get(node.id) >= outThreshold) score += 1;
      if (inDegree.get(node.id) <= inThreshold) score += 1;
    } else if (node.type === 'document') {
      if (path === 'README.md') score += 5;
      else if (/^[^/]+\.md$/i.test(path)) score += 2;
    }
    return { id: node.id, score, name: node.name, summary: node.summary || '' };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, 5);
  const start = entryPointCandidates.find(item => nodeById.get(item.id)?.type === 'file');
  const adjacency = new Map(nodes.map(node => [node.id, []]));
  for (const edge of edges) if ((edge.type === 'imports' || edge.type === 'calls') && adjacency.has(edge.source) && nodeById.has(edge.target)) adjacency.get(edge.source).push(edge.target);
  const order = [], depthMap = {}, byDepth = {};
  if (start) {
    const queue = [[start.id, 0]], seen = new Set([start.id]);
    while (queue.length) {
      const [id, depth] = queue.shift(); order.push(id); depthMap[id] = depth; (byDepth[depth] ||= []).push(id);
      for (const target of adjacency.get(id).sort()) if (!seen.has(target)) { seen.add(target); queue.push([target, depth + 1]); }
    }
  }
  const nonCodeFiles = { documentation: [], infrastructure: [], data: [], config: [] };
  for (const node of nodes) {
    const item = { id: node.id, name: node.name, type: node.type, summary: node.summary || '' };
    if (node.type === 'document') nonCodeFiles.documentation.push(item);
    if (['service', 'pipeline', 'resource'].includes(node.type)) nonCodeFiles.infrastructure.push(item);
    if (['table', 'schema', 'endpoint'].includes(node.type)) nonCodeFiles.data.push(item);
    if (node.type === 'config') nonCodeFiles.config.push(item);
  }
  const directed = new Set(edges.map(edge => `${edge.source}\u0000${edge.target}\u0000${edge.type}`));
  const pairs = new Map();
  for (const edge of edges) if (['imports', 'calls'].includes(edge.type) && directed.has(`${edge.target}\u0000${edge.source}\u0000${edge.type}`)) {
    const key = [edge.source, edge.target].sort().join('\u0000'); pairs.set(key, (pairs.get(key) || 0) + 1);
  }
  const clusters = [...pairs.keys()].map(key => { const members = key.split('\u0000'); return { nodes: members, edgeCount: edges.filter(edge => members.includes(edge.source) && members.includes(edge.target)).length }; })
    .sort((a, b) => b.edgeCount - a.edgeCount).slice(0, 10);
  const nodeSummaryIndex = Object.fromEntries(nodes.map(node => [node.id, { name: node.name, type: node.type, summary: node.summary || '' }]));
  const result = { scriptCompleted: true, entryPointCandidates, fanInRanking, fanOutRanking, bfsTraversal: { startNode: start?.id || null, order, depthMap, byDepth }, nonCodeFiles, clusters, layers: { count: (input.layers || []).length, list: (input.layers || []).map(({ id, name, description }) => ({ id, name, description })) }, nodeSummaryIndex, totalNodes: nodes.length, totalEdges: edges.length };
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
} catch (error) { fail(error.stack || String(error)); }
