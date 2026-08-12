const fs = require('fs');
const path = require('path');

function fail(message) { console.error(message); process.exit(1); }
if (process.argv.length !== 4) fail('Usage: node ua-arch-analyze.js <input> <output>');

try {
  const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const files = input.fileNodes || [];
  const imports = input.importEdges || [];
  const allEdges = input.allEdges || [];
  const byId = new Map(files.map(node => [node.id, node]));
  const normalize = value => (value || '').replace(/\\/g, '/').replace(/^\.\//, '');
  const paths = files.map(node => normalize(node.filePath || node.name));
  const segments = paths.map(p => p.split('/').filter(Boolean));
  let common = segments.length ? segments[0].slice() : [];
  for (const parts of segments.slice(1)) {
    let i = 0; while (i < common.length && i < parts.length && common[i] === parts[i]) i++;
    common = common.slice(0, i);
  }
  if (common.length && common.length === Math.min(...segments.map(x => x.length))) common.pop();
  const groupFor = node => {
    const parts = normalize(node.filePath || node.name).split('/').filter(Boolean);
    const remainder = parts.slice(common.length);
    return remainder.length > 1 ? remainder[0] : 'root';
  };
  const directoryGroups = {}, nodeTypeGroups = {}, patternMatches = {};
  for (const node of files) {
    const group = groupFor(node);
    (directoryGroups[group] ||= []).push(node.id);
    (nodeTypeGroups[node.type] ||= []).push(node.id);
  }
  const patterns = [
    [/^(routes|api|controllers|endpoints|handlers|routers|controller|blueprints|serializers)$/i, 'api'],
    [/^(services|core|lib|domain|logic|internal|composables|mailers|jobs|channels|signals)$/i, 'service'],
    [/^(models|db|data|persistence|repository|entities|migrations|entity|sql|database|schema)$/i, 'data'],
    [/^(components|views|pages|ui|layouts|screens)$/i, 'ui'],
    [/^(middleware|plugins|interceptors|guards)$/i, 'middleware'],
    [/^(utils|helpers|common|shared|tools|pkg|templatetags)$/i, 'utility'],
    [/^(config|constants|env|settings|management|commands)$/i, 'config'],
    [/^(__tests__|test|tests|spec|specs)$/i, 'test'],
    [/^(types|interfaces|schemas|contracts|dtos|dto|request|response)$/i, 'types'],
    [/^hooks$/i, 'hooks'], [/^(store|state|reducers|actions|slices)$/i, 'state'],
    [/^(assets|static|public)$/i, 'assets'], [/^(docs|documentation|wiki)$/i, 'documentation'],
    [/^(deploy|deployment|infra|infrastructure|k8s|kubernetes|helm|charts|terraform|tf|docker)$/i, 'infrastructure'],
    [/^(\.github|\.gitlab|\.circleci)$/i, 'ci-cd'], [/^(cmd|bin)$/i, 'entry']
  ];
  for (const group of Object.keys(directoryGroups)) {
    const hit = patterns.find(([regex]) => regex.test(group));
    if (hit) patternMatches[group] = hit[1];
  }
  const fanIn = Object.fromEntries(files.map(n => [n.id, 0]));
  const fanOut = Object.fromEntries(files.map(n => [n.id, 0]));
  const inter = new Map(), involvement = new Map(), internal = new Map();
  for (const edge of imports) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) continue;
    fanOut[edge.source]++; fanIn[edge.target]++;
    const from = groupFor(byId.get(edge.source)), to = groupFor(byId.get(edge.target));
    const key = `${from}\u0000${to}`; inter.set(key, (inter.get(key) || 0) + 1);
    involvement.set(from, (involvement.get(from) || 0) + 1);
    involvement.set(to, (involvement.get(to) || 0) + 1);
    if (from === to) internal.set(from, (internal.get(from) || 0) + 1);
  }
  const interGroupImports = [...inter].map(([key, count]) => { const [from, to] = key.split('\u0000'); return {from, to, count}; });
  const intraGroupDensity = Object.fromEntries(Object.keys(directoryGroups).map(group => {
    const totalEdges = involvement.get(group) || 0;
    const internalEdges = internal.get(group) || 0;
    return [group, {internalEdges, totalEdges, density: totalEdges ? Number((internalEdges / totalEdges).toFixed(2)) : 0}];
  }));
  const category = new Map();
  for (const edge of allEdges) {
    const a = byId.get(edge.source), b = byId.get(edge.target);
    if (!a || !b) continue;
    const key = `${a.type}\u0000${b.type}\u0000${edge.type}`;
    category.set(key, (category.get(key) || 0) + 1);
  }
  const crossCategoryEdges = [...category].map(([key, count]) => { const [fromType, toType, edgeType] = key.split('\u0000'); return {fromType, toType, edgeType, count}; });
  const filePath = node => normalize(node.filePath || node.name);
  const infraFiles = files.filter(n => /(^|\/)(Dockerfile[^/]*|docker-compose\.(yml|yaml)|.*\.(tf|tfvars)|\.github\/workflows\/.*\.(yml|yaml)|.*\/(k8s|kubernetes|helm)\/.*\.(yml|yaml))$/i.test(filePath(n))).map(filePath);
  const deploymentTopology = {
    hasDockerfile: files.some(n => /(^|\/)Dockerfile/i.test(filePath(n))),
    hasCompose: files.some(n => /docker-compose\.(yml|yaml)$/i.test(filePath(n))),
    hasK8s: files.some(n => /(^|\/)(k8s|kubernetes|helm)\//i.test(filePath(n))),
    hasTerraform: files.some(n => /\.(tf|tfvars)$/i.test(filePath(n))),
    hasCI: files.some(n => /(^|\/)(\.github\/workflows|\.gitlab-ci\.yml|Jenkinsfile)/i.test(filePath(n))),
    infraFiles
  };
  const selectPaths = predicate => files.filter(predicate).map(filePath);
  const dataPipeline = {
    schemaFiles: selectPaths(n => n.type === 'schema' || /\.(sql|graphql|gql|proto|prisma)$/i.test(filePath(n))),
    migrationFiles: selectPaths(n => /(^|\/)migrations?\//i.test(filePath(n))),
    dataModelFiles: selectPaths(n => /(^|\/)(models?|db|data|persistence|repository)\//i.test(filePath(n))),
    apiHandlerFiles: selectPaths(n => /(^|\/)(routes?|api|controllers?|endpoints?|handlers?|routers?)\//i.test(filePath(n)))
  };
  const groupsWithDocs = Object.keys(directoryGroups).filter(group => directoryGroups[group].some(id => /(^|\/)README\.md$/i.test(filePath(byId.get(id)))));
  const docCoverage = { groupsWithDocs: groupsWithDocs.length, totalGroups: Object.keys(directoryGroups).length, coverageRatio: Object.keys(directoryGroups).length ? Number((groupsWithDocs.length / Object.keys(directoryGroups).length).toFixed(2)) : 0, undocumentedGroups: Object.keys(directoryGroups).filter(x => !groupsWithDocs.includes(x)) };
  const dependencyDirection = [];
  const pairs = new Set([...inter.keys()].map(key => key.split('\u0000').sort().join('\u0000')));
  for (const pair of pairs) {
    const [a, b] = pair.split('\u0000'); const ab = inter.get(`${a}\u0000${b}`) || 0; const ba = inter.get(`${b}\u0000${a}`) || 0;
    if (ab > ba) dependencyDirection.push({dependent: a, dependsOn: b});
    else if (ba > ab) dependencyDirection.push({dependent: b, dependsOn: a});
  }
  const result = { scriptCompleted: true, directoryGroups, nodeTypeGroups, crossCategoryEdges, interGroupImports, intraGroupDensity, patternMatches, deploymentTopology, dataPipeline, docCoverage, dependencyDirection, fileStats: {totalFileNodes: files.length, filesPerGroup: Object.fromEntries(Object.entries(directoryGroups).map(([k,v]) => [k,v.length])), nodeTypeCounts: Object.fromEntries(Object.entries(nodeTypeGroups).map(([k,v]) => [k,v.length]))}, fileFanIn: fanIn, fileFanOut: fanOut };
  fs.writeFileSync(process.argv[3], JSON.stringify(result, null, 2) + '\n');
} catch (error) { fail(error.stack || error.message); }
