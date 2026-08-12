const fs = require('fs');
const root = 'D:/AI/Github/local-ai-chat-studio';
const data = JSON.parse(fs.readFileSync('.ua/tmp/ua-file-extract-results-2.json', 'utf8'));
const input = JSON.parse(fs.readFileSync('.ua/tmp/ua-file-analyzer-input-2.json', 'utf8'));
const fileSummary = {
  'backend/app/cli.py': 'Provides the command-line entry point that starts the FastAPI application with Uvicorn.',
  'backend/app/contracts.py': 'Defines Pydantic request and response contracts for chat, providers, memory, workspace, replay, and data-management APIs.',
  'backend/app/main.py': 'Builds the FastAPI application and its HTTP API for conversations, runs, providers, memory, files, and workspace features.',
  'backend/app/memory.py': 'Uses a selected LLM to extract, consolidate, validate, and categorize useful long-term memories from conversation history.',
  'backend/app/providers.py': 'Implements normalized provider adapters and the registry for local Ollama, cloud models, OpenAI-compatible APIs, and OpenCode.',
  'backend/app/runs.py': 'Coordinates asynchronous model runs, their state transitions, event streams, cancellation, and persisted results.',
  'backend/app/sessions.py': 'Stores browser-session identifiers and provider credentials while resolving Anthropic workload-identity configuration.',
  'backend/app/store.py': 'Provides the SQLite persistence layer for conversations, messages, credentials, memory, runs, uploads, and workspace resources.',
  'backend/app/workspace.py': 'Plans safe context assembly from memories, retrieval, uploads, backpacks, and web sources for an individual turn.',
  'scripts/generate_api_types.py': 'Generates the frontend TypeScript API schema from the FastAPI OpenAPI document.',
  'src/files.py': 'Parses uploaded files into safe text previews and chunks them for contextual retrieval.',
  'tests/test_provider_adapters.py': 'Covers normalized provider discovery, Ollama variants, and OpenCode bridge safety behavior.',
  'tests/test_workspace_features.py': 'Exercises workspace, memory, provenance, replay, attachment, privacy, and data-control API workflows end to end.'
};
const fileTags = path => path.startsWith('tests/') ? ['test','api','integration'] : path.startsWith('scripts/') ? ['automation','api-schema','code-generation'] : ['backend','api','python'];
const noun = name => name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^_/, '');
const special = {
  'create_app': 'Constructs the FastAPI application, dependencies, and all public API routes.',
  'extract_memories': 'Extracts concise, user-relevant memory candidates with an LLM and records their provenance.',
  'build_provider_registry': 'Builds the configured provider adapter registry with local and cloud integrations.',
  'build_context_plan': 'Builds a budgeted, safety-reviewed context plan from eligible conversation sources.',
  'assemble_messages': 'Assembles the model message list from the approved context plan and user turn.',
  'parse_upload': 'Validates an uploaded file and extracts a safe text representation for storage.',
  'chunk_text': 'Splits extracted text into bounded chunks for retrieval.'
};
const testSummary = n => `Verifies ${noun(n.replace(/^test_/, '')).toLowerCase()} through the public application contract.`;
const nodes = [];
const edges = [];
for (const result of data.results) {
  const path = result.path;
  nodes.push({id:`file:${path}`,type:'file',name:path.split('/').pop(),filePath:path,summary:fileSummary[path] || `Provides ${path} application behavior.`,tags:fileTags(path),complexity:result.nonEmptyLines > 200 ? 'complex' : result.nonEmptyLines >= 50 ? 'moderate' : 'simple'});
  for (const item of [...(result.functions || []).map(x => ({...x, kind:'function'})), ...(result.classes || []).map(x => ({...x, kind:'class'}))]) {
    const id = `${item.kind}:${path}:${item.name}`;
    const isTest = path.startsWith('tests/') && item.kind === 'function';
    const summary = special[item.name] || (isTest ? testSummary(item.name) : item.kind === 'class' ? `Defines the ${noun(item.name)} Pydantic or application contract used by the backend.` : `Implements ${noun(item.name).toLowerCase()} behavior for this module.`);
    nodes.push({id,type:item.kind,name:item.name,summary,tags:isTest?['test','api','contract']:item.kind === 'class'?['data-model','pydantic','api-contract']:['backend','function','api'],complexity:(item.endLine-item.startLine+1)>80?'complex':(item.endLine-item.startLine+1)>=20?'moderate':'simple',lineRange:[item.startLine,item.endLine]});
    edges.push({source:`file:${path}`,target:id,type:'contains',direction:'forward',weight:1.0});
    if ((result.exports || []).some(e => e.name === item.name)) edges.push({source:`file:${path}`,target:id,type:'exports',direction:'forward',weight:0.8});
  }
  for (const target of input.batchImportData[path] || []) edges.push({source:`file:${path}`,target:`file:${target}`,type:'imports',direction:'forward',weight:0.7});
}
for (const [test, targets] of Object.entries(input.batchImportData)) {
  if (test.startsWith('tests/')) for (const target of targets) edges.push({source:`file:${target}`,target:`file:${test}`,type:'tested_by',direction:'forward',weight:0.5});
}
const files = input.batchFiles.map(x => x.path).sort();
const parts = 5, per = Math.ceil(files.length / parts);
for (let i=0;i<parts;i++) {
  const paths = new Set(files.slice(i*per,(i+1)*per));
  const partNodes = nodes.filter(n => paths.has(n.filePath || n.id.split(':')[1]));
  const ids = new Set(partNodes.map(n=>n.id));
  const partEdges = edges.filter(e => ids.has(e.source));
  fs.writeFileSync(`.ua/intermediate/batch-2-part-${i+1}.json`, JSON.stringify({nodes:partNodes,edges:partEdges},null,2)+'\n');
}
console.log(JSON.stringify({nodes:nodes.length,edges:edges.length,imports:edges.filter(e=>e.type==='imports').length,parts},null,2));
