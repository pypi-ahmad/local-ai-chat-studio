const fs = require('fs');

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  console.error('Usage: node ua-arch-analyze.js <input> <output>');
  process.exit(1);
}

try {
  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const nodes = input.fileNodes || [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const paths = nodes.map((node) => node.filePath || '');
  const pathParts = paths.map((filePath) => filePath.split('/').filter(Boolean));
  const commonPrefix = [];
  for (let index = 0; pathParts.length && pathParts[0][index]; index += 1) {
    const segment = pathParts[0][index];
    if (pathParts.every((parts) => parts[index] === segment)) commonPrefix.push(segment);
    else break;
  }
  const groupFor = (node) => {
    const parts = (node.filePath || '').split('/').filter(Boolean);
    const remaining = parts.slice(commonPrefix.length);
    if (remaining.length <= 1) return 'root';
    return remaining[0];
  };
  const directoryGroups = {};
  const nodeTypeGroups = {};
  for (const node of nodes) {
    const group = groupFor(node);
    (directoryGroups[group] ||= []).push(node.id);
    (nodeTypeGroups[node.type] ||= []).push(node.id);
  }
  const imports = (input.importEdges || []).filter((edge) => nodeById.has(edge.source) && nodeById.has(edge.target));
  const fanIn = Object.fromEntries(nodes.map((node) => [node.id, 0]));
  const fanOut = Object.fromEntries(nodes.map((node) => [node.id, 0]));
  const interGroup = new Map();
  const density = Object.fromEntries(Object.keys(directoryGroups).map((group) => [group, { internalEdges: 0, totalEdges: 0 }]));
  for (const edge of imports) {
    fanOut[edge.source] += 1;
    fanIn[edge.target] += 1;
    const from = groupFor(nodeById.get(edge.source));
    const to = groupFor(nodeById.get(edge.target));
    density[from].totalEdges += 1;
    density[to].totalEdges += 1;
    if (from === to) density[from].internalEdges += 1;
    else interGroup.set(`${from}\u0000${to}`, (interGroup.get(`${from}\u0000${to}`) || 0) + 1);
  }
  for (const values of Object.values(density)) values.density = values.totalEdges ? values.internalEdges / values.totalEdges : 0;
  const patternMap = {
    routes: 'api', api: 'api', controllers: 'api', endpoints: 'api', handlers: 'api', routers: 'api', serializers: 'api', blueprints: 'api', controller: 'api',
    services: 'service', core: 'service', lib: 'service', domain: 'service', logic: 'service', internal: 'service', composables: 'service', signals: 'service', mailers: 'service', jobs: 'service', channels: 'service',
    models: 'data', db: 'data', data: 'data', persistence: 'data', repository: 'data', entities: 'data', migrations: 'data', entity: 'data', sql: 'data', database: 'data', schema: 'data',
    components: 'ui', views: 'ui', pages: 'ui', ui: 'ui', layouts: 'ui', screens: 'ui',
    middleware: 'middleware', plugins: 'middleware', interceptors: 'middleware', guards: 'middleware',
    utils: 'utility', helpers: 'utility', common: 'utility', shared: 'utility', tools: 'utility', pkg: 'utility', templatetags: 'utility',
    config: 'config', constants: 'config', env: 'config', settings: 'config', management: 'config', commands: 'config',
    __tests__: 'test', test: 'test', tests: 'test', spec: 'test', specs: 'test',
    types: 'types', interfaces: 'types', schemas: 'types', contracts: 'types', dtos: 'types', dto: 'types', request: 'types', response: 'types',
    hooks: 'hooks', store: 'state', state: 'state', reducers: 'state', actions: 'state', slices: 'state', assets: 'assets', static: 'assets', public: 'assets',
    docs: 'documentation', documentation: 'documentation', wiki: 'documentation', deploy: 'infrastructure', deployment: 'infrastructure', infra: 'infrastructure', infrastructure: 'infrastructure',
    '.github': 'ci-cd', '.gitlab': 'ci-cd', '.circleci': 'ci-cd', k8s: 'infrastructure', kubernetes: 'infrastructure', helm: 'infrastructure', charts: 'infrastructure', terraform: 'infrastructure', tf: 'infrastructure', docker: 'infrastructure', cmd: 'entry', bin: 'entry'
  };
  const patternMatches = Object.fromEntries(Object.keys(directoryGroups).map((group) => [group, patternMap[group] || (group === 'root' ? 'root' : 'unclassified')]));
  const cross = new Map();
  for (const edge of (input.allEdges || []).filter((edge) => nodeById.has(edge.source) && nodeById.has(edge.target))) {
    const fromType = nodeById.get(edge.source).type;
    const toType = nodeById.get(edge.target).type;
    const key = `${fromType}\u0000${toType}\u0000${edge.type}`;
    cross.set(key, (cross.get(key) || 0) + 1);
  }
  const interGroupImports = [...interGroup.entries()].map(([key, count]) => { const [from, to] = key.split('\u0000'); return { from, to, count }; });
  const dependencyDirection = interGroupImports.filter(({ from, to, count }) => count > (interGroup.get(`${to}\u0000${from}`) || 0)).map(({ from, to }) => ({ dependent: from, dependsOn: to }));
  const infraFiles = nodes.filter((node) => /(^|\/)(Dockerfile|docker-compose[^/]*|.*\.tf(vars)?|.*\.(ya?ml))$/i.test(node.filePath || '') || (node.filePath || '').startsWith('.github/workflows/')).map((node) => node.filePath);
  const byPattern = (pattern) => nodes.filter((node) => pattern.test(node.filePath || '')).map((node) => node.filePath);
  const docGroups = new Set(nodes.filter((node) => node.type === 'document').map(groupFor));
  const results = {
    scriptCompleted: true,
    directoryGroups,
    nodeTypeGroups,
    crossCategoryEdges: [...cross.entries()].map(([key, count]) => { const [fromType, toType, edgeType] = key.split('\u0000'); return { fromType, toType, edgeType, count }; }),
    interGroupImports,
    intraGroupDensity: density,
    patternMatches,
    deploymentTopology: { hasDockerfile: nodes.some((node) => /Dockerfile/i.test(node.filePath || '')), hasCompose: nodes.some((node) => /docker-compose/i.test(node.filePath || '')), hasK8s: nodes.some((node) => /(^|\/)(k8s|kubernetes|helm)\//i.test(node.filePath || '')), hasTerraform: nodes.some((node) => /\.tf(vars)?$/i.test(node.filePath || '')), hasCI: nodes.some((node) => (node.filePath || '').startsWith('.github/workflows/')), infraFiles },
    dataPipeline: { schemaFiles: byPattern(/\.(sql|graphql|gql|proto|prisma)$/i), migrationFiles: byPattern(/(^|\/)migrations?\//i), dataModelFiles: byPattern(/(^|\/)(models?|store|database|db)\.(py|ts|tsx|js)$/i), apiHandlerFiles: byPattern(/(^|\/)(routes?|api|controllers?|main)\.(py|ts|tsx|js)$/i) },
    docCoverage: { groupsWithDocs: docGroups.size, totalGroups: Object.keys(directoryGroups).length, coverageRatio: Object.keys(directoryGroups).length ? docGroups.size / Object.keys(directoryGroups).length : 0, undocumentedGroups: Object.keys(directoryGroups).filter((group) => !docGroups.has(group)) },
    dependencyDirection,
    fileStats: { totalFileNodes: nodes.length, filesPerGroup: Object.fromEntries(Object.entries(directoryGroups).map(([group, ids]) => [group, ids.length])), nodeTypeCounts: Object.fromEntries(Object.entries(nodeTypeGroups).map(([type, ids]) => [type, ids.length])) },
    fileFanIn: fanIn,
    fileFanOut: fanOut
  };
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
