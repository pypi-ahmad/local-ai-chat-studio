const fs = require('fs');
const path = require('path');

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) throw new Error('Usage: node ua-arch-analyze.js <input> <output>');
const { fileNodes, importEdges, allEdges } = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const byId = new Map(fileNodes.map(node => [node.id, node]));
const segments = fileNodes.map(node => node.filePath.split('/'));
let prefixLength = 0;
while (segments.every(parts => parts.length > prefixLength && parts[prefixLength] === segments[0][prefixLength])) prefixLength++;
const groupOf = node => {
  const parts = node.filePath.split('/');
  return parts.length > prefixLength + 1 ? parts[prefixLength] : 'root';
};
const directoryGroups = {};
const nodeTypeGroups = {};
for (const node of fileNodes) {
  const group = groupOf(node);
  (directoryGroups[group] ??= []).push(node.id);
  (nodeTypeGroups[node.type] ??= []).push(node.id);
}
const fanIn = Object.fromEntries(fileNodes.map(node => [node.id, 0]));
const fanOut = Object.fromEntries(fileNodes.map(node => [node.id, 0]));
const inter = new Map();
const groupTotals = Object.fromEntries(Object.keys(directoryGroups).map(g => [g, { internalEdges: 0, totalEdges: 0 }]));
for (const edge of importEdges) {
  if (!byId.has(edge.source) || !byId.has(edge.target)) continue;
  fanOut[edge.source]++;
  fanIn[edge.target]++;
  const from = groupOf(byId.get(edge.source)), to = groupOf(byId.get(edge.target));
  const key = from + '\0' + to;
  inter.set(key, (inter.get(key) ?? 0) + 1);
  groupTotals[from].totalEdges++;
  groupTotals[to].totalEdges++;
  if (from === to) groupTotals[from].internalEdges++;
}
const interGroupImports = [...inter].map(([key, count]) => {
  const [from, to] = key.split('\0');
  return { from, to, count };
});
const intraGroupDensity = Object.fromEntries(Object.entries(groupTotals).map(([group, stats]) => [group, {
  ...stats, density: stats.totalEdges ? Number((stats.internalEdges / stats.totalEdges).toFixed(3)) : 0
}]));
const patterns = {
  routes:'api', api:'api', controllers:'api', endpoints:'api', handlers:'api',
  services:'service', core:'service', lib:'service', domain:'service', logic:'service',
  models:'data', db:'data', data:'data', persistence:'data', repository:'data', entities:'data',
  components:'ui', views:'ui', pages:'ui', ui:'ui', layouts:'ui', screens:'ui',
  middleware:'middleware', plugins:'middleware', interceptors:'middleware', guards:'middleware',
  utils:'utility', helpers:'utility', common:'utility', shared:'utility', tools:'utility',
  config:'config', constants:'config', env:'config', settings:'config',
  tests:'test', test:'test', specs:'test', spec:'test',
  types:'types', interfaces:'types', schemas:'types', contracts:'types', dtos:'types',
  hooks:'hooks', store:'state', state:'state', reducers:'state', actions:'state', slices:'state',
  assets:'assets', static:'assets', public:'assets', migrations:'data',
  docs:'documentation', documentation:'documentation', wiki:'documentation',
  '.github':'ci-cd', '.gitlab':'ci-cd', '.circleci':'ci-cd',
  infra:'infrastructure', infrastructure:'infrastructure', docker:'infrastructure',
  k8s:'infrastructure', kubernetes:'infrastructure', helm:'infrastructure',
  terraform:'infrastructure', tf:'infrastructure'
};
const patternMatches = Object.fromEntries(Object.keys(directoryGroups).map(group => [group, patterns[group] ?? 'unclassified']));
const cross = new Map();
for (const edge of allEdges) {
  const source = byId.get(edge.source), target = byId.get(edge.target);
  if (!source || !target) continue;
  const key = [source.type, target.type, edge.type].join('\0');
  cross.set(key, (cross.get(key) ?? 0) + 1);
}
const crossCategoryEdges = [...cross].map(([key, count]) => {
  const [fromType, toType, edgeType] = key.split('\0');
  return { fromType, toType, edgeType, count };
});
const paths = fileNodes.map(n => n.filePath);
const isCI = p => p.startsWith('.github/workflows/') || p === '.gitlab-ci.yml' || p === 'Jenkinsfile';
const deploymentTopology = {
  hasDockerfile: paths.some(p => /(^|\/)Dockerfile/.test(p)),
  hasCompose: paths.some(p => /docker-compose\./.test(p)),
  hasK8s: paths.some(p => /(^|\/)(k8s|kubernetes|helm)\//.test(p)),
  hasTerraform: paths.some(p => /\.tf(vars)?$/.test(p)),
  hasCI: paths.some(isCI),
  infraFiles: paths.filter(p => /Dockerfile|docker-compose|\.tf(vars)?$/.test(p) || isCI(p))
};
const dataPipeline = {
  schemaFiles: paths.filter(p => /\.(graphql|gql|proto|prisma)$/.test(p)),
  migrationFiles: paths.filter(p => /migration|migrations/.test(p) && /\.sql$/.test(p)),
  dataModelFiles: paths.filter(p => /(^|\/)(models|store|db|data)\//.test(p) || /store\.py$/.test(p)),
  apiHandlerFiles: paths.filter(p => /(^|\/)(api|routes|controllers)\//.test(p) || /main\.py$/.test(p))
};
const docGroups = new Set(fileNodes.filter(n => n.type === 'document').map(n => groupOf(n)));
const groupNames = Object.keys(directoryGroups);
const docCoverage = {
  groupsWithDocs: docGroups.size,
  totalGroups: groupNames.length,
  coverageRatio: Number((docGroups.size / groupNames.length).toFixed(3)),
  undocumentedGroups: groupNames.filter(g => !docGroups.has(g))
};
const dependencyDirection = [];
for (const entry of interGroupImports) {
  if (entry.from === entry.to) continue;
  const reverse = inter.get(entry.to + '\0' + entry.from) ?? 0;
  if (entry.count > reverse) dependencyDirection.push({ dependent: entry.from, dependsOn: entry.to });
}
const result = {
  scriptCompleted:true, commonPathPrefix: segments[0].slice(0, prefixLength).join('/'),
  directoryGroups, nodeTypeGroups, crossCategoryEdges, interGroupImports, intraGroupDensity,
  patternMatches, deploymentTopology, dataPipeline, docCoverage, dependencyDirection,
  fileStats:{ totalFileNodes:fileNodes.length, filesPerGroup:Object.fromEntries(groupNames.map(g => [g, directoryGroups[g].length])), nodeTypeCounts:Object.fromEntries(Object.entries(nodeTypeGroups).map(([t, ids]) => [t, ids.length])) },
  fileFanIn:fanIn, fileFanOut:fanOut
};
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');

