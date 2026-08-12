const fs = require('fs');

try {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath) throw new Error('Usage: node ua-tour-analyze.cjs <input> <output>');
  const graph = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const byId = new Map(nodes.map(node => [node.id, node]));
  const fanIn = new Map(nodes.map(node => [node.id, 0]));
  const fanOut = new Map(nodes.map(node => [node.id, 0]));
  const next = new Map(nodes.map(node => [node.id, []]));
  for (const edge of edges) {
    if (fanIn.has(edge.target)) fanIn.set(edge.target, fanIn.get(edge.target) + 1);
    if (fanOut.has(edge.source)) fanOut.set(edge.source, fanOut.get(edge.source) + 1);
    if ((edge.type === 'imports' || edge.type === 'calls') && next.has(edge.source) && byId.has(edge.target)) {
      next.get(edge.source).push(edge.target);
    }
  }
  const ranked = (metric, label) => [...nodes]
    .sort((a, b) => metric.get(b.id) - metric.get(a.id) || a.id.localeCompare(b.id))
    .slice(0, 20)
    .map(node => ({ id: node.id, [label]: metric.get(node.id), name: node.name }));
  const fanOutValues = [...fanOut.values()].sort((a, b) => a - b);
  const topDecile = fanOutValues[Math.max(0, Math.ceil(fanOutValues.length * .9) - 1)] || 0;
  const lowQuartile = fanOutValues[Math.min(fanOutValues.length - 1, Math.floor(fanOutValues.length * .25))] || 0;
  const entryPointCandidates = nodes.map(node => {
    const path = node.filePath || '';
    const base = path.split('/').pop() || '';
    let score = 0;
    if (node.type === 'document' && path === 'README.md') score += 5;
    else if (node.type === 'document' && !path.includes('/')) score += 2;
    if (node.type === 'file') {
      if (/^(index|main|app|server|manage|run|wsgi|asgi|__main__)\.(ts|tsx|js|jsx|py|rs|go|java|cs|php|c|cpp)$|^(Application|Main)\.java$|^Program\.cs$|^config\.ru$/.test(base)) score += 3;
      if (path.split('/').length <= 2) score += 1;
      if (fanOut.get(node.id) >= topDecile) score += 1;
      if (fanIn.get(node.id) <= lowQuartile) score += 1;
    }
    return { id: node.id, score, name: node.name, summary: node.summary };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, 5);
  const start = entryPointCandidates.find(item => byId.get(item.id)?.type === 'file');
  const depthMap = {}, byDepth = {}, order = [];
  if (start) {
    const queue = [start.id]; depthMap[start.id] = 0;
    while (queue.length) {
      const current = queue.shift(); order.push(current);
      const depth = depthMap[current]; (byDepth[depth] ||= []).push(current);
      for (const target of next.get(current) || []) if (!(target in depthMap)) { depthMap[target] = depth + 1; queue.push(target); }
    }
  }
  const nonCodeFiles = { documentation: [], infrastructure: [], data: [], config: [] };
  for (const node of nodes) {
    const detail = { id: node.id, name: node.name, type: node.type, summary: node.summary };
    if (node.type === 'document') nonCodeFiles.documentation.push(detail);
    else if (['service', 'pipeline', 'resource'].includes(node.type)) nonCodeFiles.infrastructure.push(detail);
    else if (['table', 'schema', 'endpoint'].includes(node.type)) nonCodeFiles.data.push(detail);
    else if (node.type === 'config') nonCodeFiles.config.push(detail);
  }
  const pairs = new Map();
  for (const edge of edges) if (['imports', 'calls'].includes(edge.type) && byId.has(edge.source) && byId.has(edge.target)) {
    const key = [edge.source, edge.target].sort().join('|'); pairs.set(key, (pairs.get(key) || 0) + 1);
  }
  const clusters = [...pairs.entries()].filter(([, count]) => count >= 2).slice(0, 10).map(([key, edgeCount]) => ({ nodes: key.split('|'), edgeCount }));
  const nodeSummaryIndex = Object.fromEntries(nodes.map(node => [node.id, { name: node.name, type: node.type, summary: node.summary }]));
  fs.writeFileSync(outputPath, JSON.stringify({
    scriptCompleted: true, entryPointCandidates,
    fanInRanking: ranked(fanIn, 'fanIn'), fanOutRanking: ranked(fanOut, 'fanOut'),
    bfsTraversal: { startNode: start?.id || null, order, depthMap, byDepth }, nonCodeFiles, clusters,
    layers: { count: (graph.layers || []).length, list: graph.layers || [] }, nodeSummaryIndex,
    totalNodes: nodes.length, totalEdges: edges.length,
  }, null, 2));
} catch (error) { console.error(error.message); process.exit(1); }
