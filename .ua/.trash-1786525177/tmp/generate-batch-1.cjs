const fs = require('fs');

const result = JSON.parse(fs.readFileSync('.ua/tmp/ua-file-extract-results-1.json', 'utf8'));
const batch = JSON.parse(fs.readFileSync('.ua/intermediate/batches.json', 'utf8')).batches.find((item) => item.batchIndex === 1);
const nodeId = (path, name) => `function:${path}:${name}`;
const edge = (source, target, type, weight) => ({ source, target, type, direction: 'forward', weight });
const uiSummary = (name) => {
  if (name === 'useIsMobile') return 'Tracks a media-query breakpoint and returns whether the viewport is mobile-sized.';
  if (name === 'cn') return 'Merges conditional class names and resolves conflicting Tailwind utility classes.';
  if (name === 'App') return 'Selects the active workspace and composes the navigation with its page content.';
  if (name === 'Navigation') return 'Renders the primary workspace navigation and reports page selections to the application shell.';
  if (name === 'ConversationHistory') return 'Renders the chat-history pane with a conversation search field and local-first status.';
  if (name === 'ChatWorkspace') return 'Renders the chat workspace, including prompt editing, suggestions, and composer controls.';
  if (name === 'ProvidersPage') return 'Renders the configured provider catalog and its connection states.';
  if (name === 'GenericPage') return 'Displays placeholder content for non-chat workspace pages.';
  if (name.includes('Provider')) return 'Provides the context or root primitive required by the related UI component.';
  if (name.includes('Trigger')) return 'Renders an interactive trigger for the related UI primitive.';
  if (name.includes('Content')) return 'Renders the styled content region for the related UI primitive.';
  if (name.includes('Header') || name.includes('Footer')) return 'Renders a styled structural section for the related UI component.';
  if (name.includes('Label') || name.includes('Title') || name.includes('Description')) return 'Renders styled descriptive text for the related UI component.';
  if (name.includes('Separator')) return 'Renders a styled visual separator for the related UI component.';
  if (name.includes('Overlay')) return 'Renders the backdrop layer for the related overlay component.';
  if (name.includes('Item') || name.includes('Button') || name.includes('Action')) return 'Renders a styled interactive item for the related UI primitive.';
  return 'Renders a composable styled primitive for the application UI.';
};

const nodes = [];
const edges = [];
for (const file of result.results) {
  const path = file.path;
  const base = path.split('/').pop();
  const complexity = file.nonEmptyLines > 200 ? 'complex' : file.nonEmptyLines >= 50 ? 'moderate' : 'simple';
  let summary = 'Provides a reusable React UI primitive used by the frontend workspace.';
  let tags = ['component', 'react', 'ui'];
  if (path === 'frontend/src/App.tsx') {
    summary = 'Implements the interactive local AI studio shell with navigation, chat, provider management, and placeholder workspace pages.';
    tags = ['entry-point', 'component', 'workspace', 'react'];
  } else if (path === 'frontend/src/App.test.tsx') {
    summary = 'Verifies the studio shell exposes its workspace navigation, three-pane chat view, and provider management page.';
    tags = ['test', 'react', 'frontend'];
  } else if (path === 'frontend/src/hooks/use-mobile.ts') {
    summary = 'Provides a React hook that tracks the mobile breakpoint through browser media-query events.';
    tags = ['hook', 'responsive', 'react'];
  } else if (path === 'frontend/src/lib/utils.ts') {
    summary = 'Provides the shared class-name merger used by frontend UI components.';
    tags = ['utility', 'styling', 'tailwind'];
  } else if (path.endsWith('sidebar.tsx')) {
    summary = 'Provides the responsive sidebar context, controls, and composable navigation primitives for the frontend.';
    tags = ['component', 'sidebar', 'responsive', 'react'];
  } else if (path.endsWith('dropdown-menu.tsx')) {
    summary = 'Provides composable, styled dropdown-menu primitives including nested, checkbox, and radio items.';
    tags = ['component', 'menu', 'overlay', 'react'];
  } else if (path.endsWith('dialog.tsx') || path.endsWith('sheet.tsx')) {
    summary = 'Provides composable overlay primitives with styled content, headers, footers, and accessibility controls.';
    tags = ['component', 'overlay', 'dialog', 'react'];
  } else if (path.endsWith('field.tsx')) {
    summary = 'Provides composable form-field layout, label, description, separator, and validation-message primitives.';
    tags = ['component', 'form', 'validation', 'react'];
  }
  nodes.push({ id: `file:${path}`, type: 'file', name: base, filePath: path, summary, tags, complexity });

  const exported = new Set((file.exports || []).map((item) => item.name));
  for (const fn of file.functions || []) {
    const length = fn.endLine - fn.startLine + 1;
    if (length < 10 && !exported.has(fn.name)) continue;
    const id = nodeId(path, fn.name);
    const fnTags = path.includes('/hooks/') ? ['hook', 'responsive', 'react'] : path.includes('/lib/') ? ['utility', 'styling', 'tailwind'] : ['component', 'ui', 'react'];
    nodes.push({ id, type: 'function', name: fn.name, filePath: path, lineRange: [fn.startLine, fn.endLine], summary: uiSummary(fn.name), tags: fnTags, complexity: length >= 50 ? 'moderate' : 'simple' });
    edges.push(edge(`file:${path}`, id, 'contains', 1.0));
    if (exported.has(fn.name)) edges.push(edge(`file:${path}`, id, 'exports', 0.8));
  }
}

for (const file of batch.files) {
  for (const target of batch.batchImportData[file.path]) {
    edges.push(edge(`file:${file.path}`, `file:${target}`, 'imports', 0.7));
  }
}

edges.push(edge('file:frontend/src/App.tsx', 'file:frontend/src/App.test.tsx', 'tested_by', 0.5));

const parts = Math.ceil(Math.max(nodes.length / 60, edges.length / 120));
const files = [...batch.files].sort((a, b) => a.path.localeCompare(b.path));
const size = Math.ceil(files.length / parts);
for (let index = 0; index < parts; index += 1) {
  const paths = new Set(files.slice(index * size, (index + 1) * size).map((file) => file.path));
  const partNodes = nodes.filter((item) => paths.has(item.filePath));
  const ids = new Set(partNodes.map((item) => item.id));
  const partEdges = edges.filter((item) => ids.has(item.source));
  fs.writeFileSync(`.ua/intermediate/batch-1-part-${index + 1}.json`, JSON.stringify({ nodes: partNodes, edges: partEdges }, null, 2) + '\n');
}
console.log(JSON.stringify({ nodes: nodes.length, edges: edges.length, imports: edges.filter((item) => item.type === 'imports').length, parts }));
