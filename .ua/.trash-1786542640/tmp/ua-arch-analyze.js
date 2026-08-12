const fs = require('fs');

try {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath) throw new Error('Expected input and output paths');
  const { fileNodes, importEdges, allEdges } = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const ids = new Set(fileNodes.map((node) => node.id));
  const groupFor = (node) => {
    const parts = (node.filePath || '').split('/');
    return parts.length > 1 ? parts[0] : 'root';
  };
  const groups = {};
  const nodeTypes = {};
  const idToGroup = {};
  for (const node of fileNodes) {
    const group = groupFor(node);
    (groups[group] ||= []).push(node.id);
    (nodeTypes[node.type] ||= []).push(node.id);
    idToGroup[node.id] = group;
  }
  const fanIn = Object.fromEntries(fileNodes.map((node) => [node.id, 0]));
  const fanOut = Object.fromEntries(fileNodes.map((node) => [node.id, 0]));
  const pairCounts = new Map();
  const internal = Object.fromEntries(Object.keys(groups).map((group) => [group, 0]));
  const total = Object.fromEntries(Object.keys(groups).map((group) => [group, 0]));
  for (const edge of importEdges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) continue;
    fanOut[edge.source]++;
    fanIn[edge.target]++;
    const from = idToGroup[edge.source], to = idToGroup[edge.target];
    total[from]++; total[to]++;
    if (from === to) internal[from]++;
    const key = `${from}\u0000${to}`;
    pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
  }
  const cross = new Map();
  for (const edge of allEdges) {
    const source = fileNodes.find((node) => node.id === edge.source);
    const target = fileNodes.find((node) => node.id === edge.target);
    if (!source || !target) continue;
    const key = `${source.type}\u0000${target.type}\u0000${edge.type}`;
    cross.set(key, (cross.get(key) || 0) + 1);
  }
  const pattern = (group) => ({
    backend: 'api', frontend: 'ui', src: 'service', tests: 'test', docs: 'documentation',
    '.github': 'ci-cd', scripts: 'utility', tasks: 'documentation', root: 'config',
  }[group] || 'shared');
  const infraFiles = fileNodes.filter((node) => /docker|k8s|terraform|\.github\/workflows/i.test(node.filePath || '')).map((node) => node.filePath);
  const docsGroups = new Set(fileNodes.filter((node) => node.type === 'document').map((node) => groupFor(node)));
  const result = {
    scriptCompleted: true,
    directoryGroups: groups,
    nodeTypeGroups: nodeTypes,
    crossCategoryEdges: [...cross].map(([key, count]) => { const [fromType, toType, edgeType] = key.split('\u0000'); return { fromType, toType, edgeType, count }; }),
    interGroupImports: [...pairCounts].map(([key, count]) => { const [from, to] = key.split('\u0000'); return { from, to, count }; }),
    intraGroupDensity: Object.fromEntries(Object.keys(groups).map((group) => [group, { internalEdges: internal[group], totalEdges: total[group], density: total[group] ? internal[group] / total[group] : 0 }])),
    patternMatches: Object.fromEntries(Object.keys(groups).map((group) => [group, pattern(group)])),
    deploymentTopology: { hasDockerfile: infraFiles.some((path) => /dockerfile/i.test(path)), hasCompose: infraFiles.some((path) => /compose/i.test(path)), hasK8s: infraFiles.some((path) => /k8s|kubernetes/i.test(path)), hasTerraform: infraFiles.some((path) => /terraform|\.tf$/i.test(path)), hasCI: infraFiles.some((path) => /\.github\/workflows/i.test(path)), infraFiles },
    dataPipeline: { schemaFiles: [], migrationFiles: [], dataModelFiles: fileNodes.filter((node) => /store|memory|config/i.test(node.filePath || '')).map((node) => node.filePath), apiHandlerFiles: fileNodes.filter((node) => /backend\/app\/(main|providers|runs|sessions)/.test(node.filePath || '')).map((node) => node.filePath) },
    docCoverage: { groupsWithDocs: docsGroups.size, totalGroups: Object.keys(groups).length, coverageRatio: docsGroups.size / Object.keys(groups).length, undocumentedGroups: Object.keys(groups).filter((group) => !docsGroups.has(group)) },
    dependencyDirection: [...pairCounts].filter(([key]) => { const [from, to] = key.split('\u0000'); return from !== to; }).map(([key]) => { const [dependent, dependsOn] = key.split('\u0000'); return { dependent, dependsOn }; }),
    fileStats: { totalFileNodes: fileNodes.length, filesPerGroup: Object.fromEntries(Object.entries(groups).map(([group, nodes]) => [group, nodes.length])), nodeTypeCounts: Object.fromEntries(Object.entries(nodeTypes).map(([type, nodes]) => [type, nodes.length])) },
    fileFanIn: fanIn,
    fileFanOut: fanOut,
  };
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
