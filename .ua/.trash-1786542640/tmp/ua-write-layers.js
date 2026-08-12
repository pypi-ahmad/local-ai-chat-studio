const fs = require('fs');

const graph = JSON.parse(fs.readFileSync('.ua/intermediate/assembled-graph.json', 'utf8'));
const fileTypes = new Set(['file', 'config', 'document', 'service', 'pipeline', 'table', 'schema', 'resource', 'endpoint']);
const nodes = graph.nodes.filter((node) => fileTypes.has(node.type));
const byId = new Map(nodes.map((node) => [node.id, node]));
const layers = [
  ['layer:ui', 'User Interface', 'The React single-page client, its reusable interface components, styles, and browser entry point.', []],
  ['layer:api', 'API Layer', 'FastAPI startup and command entry points that expose the local AI workspace over HTTP.', []],
  ['layer:service', 'AI Services', 'Provider integration, chat orchestration, file handling, retrieval, session workflows, and workspace logic.', []],
  ['layer:data', 'Data Layer', 'SQLite-backed conversation persistence and application storage configuration.', []],
  ['layer:types', 'Contract Types', 'Pydantic API contracts and generated TypeScript definitions shared across the API boundary.', []],
  ['layer:test', 'Test Layer', 'Pytest and Vitest coverage plus their shared test setup.', []],
  ['layer:config', 'Configuration', 'Python and frontend manifests, compiler, lint, build, and runtime configuration.', []],
  ['layer:documentation', 'Documentation', 'Project guides, contribution materials, issue templates, and the standalone handbook and documentation pages.', []],
  ['layer:ci-cd', 'CI/CD', 'GitHub Actions automation that checks the backend and frontend.', []],
  ['layer:operations', 'Project Operations', 'The Windows launcher and maintenance tooling that support local development and distribution.', []],
];
const assign = (id, layerId) => {
  const layer = layers.find(([id]) => id === layerId);
  if (!layer) throw new Error(`Unknown layer ${layerId}`);
  layer[3].push(id);
};
for (const node of nodes) {
  const path = node.filePath || '';
  let target;
  if (node.type === 'document' || path.startsWith('docs/') || path.startsWith('tasks/') || path.startsWith('.github/ISSUE_TEMPLATE/') || path === '.github/pull_request_template.md' || path === 'frontend/README.md') target = 'layer:documentation';
  else if (node.type === 'pipeline') target = 'layer:ci-cd';
  else if (path.startsWith('tests/') || path === 'frontend/src/App.test.tsx' || path === 'frontend/src/test/setup.ts') target = 'layer:test';
  else if (path === 'backend/app/contracts.py' || path === 'frontend/src/api/schema.ts') target = 'layer:types';
  else if (path === 'src/chat_store.py' || path === 'src/config.py' || path === 'backend/app/store.py') target = 'layer:data';
  else if (path === 'backend/__init__.py' || path === 'backend/app/__init__.py' || path === 'backend/app/cli.py' || path === 'backend/app/main.py') target = 'layer:api';
  else if (path.startsWith('backend/app/') || path.startsWith('src/') || path === 'scripts/generate_api_types.py' || path === 'frontend/src/api/client.ts') target = 'layer:service';
  else if (path === 'frontend/index.html' || path === 'frontend/src/App.css' || path === 'frontend/src/App.tsx' || path === 'frontend/src/ErrorBoundary.tsx' || path === 'frontend/src/index.css' || path === 'frontend/src/main.tsx' || path.startsWith('frontend/src/components/') || path === 'frontend/src/lib/utils.ts') target = 'layer:ui';
  else if (node.type === 'config' || path === '.python-version' || path === 'frontend/vite.config.ts' || path === 'frontend/vitest.config.ts' || path === 'pyproject.toml') target = 'layer:config';
  else if (path === 'Launch Chat Studio.cmd' || path === '.graphifyignore') target = 'layer:operations';
  else throw new Error(`Unassigned file node: ${node.id} (${path})`);
  assign(node.id, target);
}
const seen = new Set();
for (const [, , , ids] of layers) for (const id of ids) {
  if (!byId.has(id)) throw new Error(`Unknown node ${id}`);
  if (seen.has(id)) throw new Error(`Duplicate node ${id}`);
  seen.add(id);
}
if (seen.size !== nodes.length) throw new Error(`Expected ${nodes.length} nodes, assigned ${seen.size}`);
const output = layers.map(([id, name, description, nodeIds]) => ({ id, name, description, nodeIds }));
fs.writeFileSync('.ua/intermediate/layers.json', JSON.stringify(output, null, 2));
