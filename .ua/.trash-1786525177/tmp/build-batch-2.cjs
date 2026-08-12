const fs = require('fs');
const root = process.cwd();
const extracted = JSON.parse(fs.readFileSync('.ua/tmp/ua-file-extract-results-2.json', 'utf8'));
const input = JSON.parse(fs.readFileSync('.ua/tmp/ua-file-analyzer-input-2.json', 'utf8'));
const names = {
  'app.py': ['Streamlit workspace entry point that manages conversations, model selection, live generation, presets, and health status.', ['entry-point','streamlit','chat-interface','orchestration']],
  'pages/1_Memory.py': ['Streamlit page for inspecting, editing, and managing persistent user memories.', ['streamlit','memory','settings','user-interface']],
  'pages/2_Settings.py': ['Streamlit settings page for configuring local storage, model providers, and workspace options.', ['streamlit','configuration','providers','user-interface']],
  'pages/4_Compare.py': ['Streamlit page that runs and presents side-by-side model comparison results.', ['streamlit','model-comparison','providers','user-interface']],
  'src/catalog.py': ['Builds and orders the unified catalog of local and optional cloud language models.', ['model-catalog','selection','utility','data-model']],
  'src/chat_store.py': ['Provides the SQLite persistence layer for conversations, messages, memories, feedback, presets, and exports.', ['sqlite','persistence','chat-history','data-access']],
  'src/config.py': ['Defines application paths and creates local directories used for database, vector store, and uploads.', ['configuration','paths','storage','data-model']],
  'src/files.py': ['Parses uploaded documents and splits extracted text into retrieval-ready chunks.', ['file-processing','document-parsing','chunking','utility']],
  'src/jobs.py': ['Coordinates background streaming chat jobs, attachments, web search, indexing, and post-turn maintenance.', ['background-jobs','streaming','orchestration','chat-service']],
  'src/memory.py': ['Extracts durable user memories from conversations and retrieves relevant memories for prompts.', ['memory','personalization','retrieval','ai-service']],
  'src/model_labels.py': ['Formats model names with capability and size hints for user-facing selection controls.', ['model-catalog','formatting','utility','user-interface']],
  'src/ollama_client.py': ['Wraps the local Ollama API for model discovery, generation, streaming, image description, and embeddings.', ['ollama','ai-client','streaming','embeddings']],
  'src/orchestrator.py': ['Assembles prompt messages from profile, memories, retrieval context, history, and attachments.', ['prompting','orchestration','retrieval','chat-service']],
  'src/personalization.py': ['Maintains a compact user profile derived from conversations and feedback.', ['personalization','memory','profile','ai-service']],
  'src/providers.py': ['Manages BYOK provider credentials, remote model discovery, streaming chat, and OpenRouter authorization.', ['providers','byok','credentials','streaming']],
  'src/rag.py': ['Stores and queries document, chat-history, and memory vectors in ChromaDB.', ['rag','chromadb','embeddings','retrieval']]
};
function complexity(lines) { return lines > 200 ? 'complex' : lines >= 50 ? 'moderate' : 'simple'; }
function fSummary(name, path) {
  const verb = name.startsWith('_') ? 'Internal helper that' : 'Provides an operation that';
  return `${verb} supports ${path === 'src/chat_store.py' ? 'chat workspace persistence' : path === 'src/rag.py' ? 'retrieval and vector storage' : path === 'src/jobs.py' ? 'background chat execution' : path === 'src/providers.py' ? 'provider integration' : 'this module’s workflow'} through ${name.replace(/^_/, '').replace(/_/g, ' ')}.`;
}
const nodes = [], edges = [];
const functionByPathAndName = new Map();
for (const file of extracted.results) {
  const [summary, tags] = names[file.path];
  const fid = `file:${file.path}`;
  nodes.push({id:fid,type:'file',name:file.path.split('/').pop(),filePath:file.path,summary,tags,complexity:complexity(file.nonEmptyLines)});
  for (const c of (file.classes || [])) {
    const id = `class:${file.path}:${c.name}`;
    nodes.push({id,type:'class',name:c.name,filePath:file.path,lineRange:[c.startLine,c.endLine],summary:`Represents ${c.name} data and behavior used by ${file.path}.`,tags:['data-model','class','application-logic'],complexity:complexity(c.endLine-c.startLine+1)});
    edges.push({source:fid,target:id,type:'contains',direction:'forward',weight:1.0});
    if ((file.exports||[]).some(e=>e.name===c.name)) edges.push({source:fid,target:id,type:'exports',direction:'forward',weight:0.8});
  }
  for (const fn of (file.functions || [])) {
    if (!fn.name) continue;
    const id = `function:${file.path}:${fn.name}`;
    functionByPathAndName.set(`${file.path}:${fn.name}`, id);
    nodes.push({id,type:'function',name:fn.name,filePath:file.path,lineRange:[fn.startLine,fn.endLine],summary:fSummary(fn.name,file.path),tags:[fn.name.startsWith('_')?'internal-helper':'service-operation','application-logic','python'],complexity:complexity(fn.endLine-fn.startLine+1)});
    edges.push({source:fid,target:id,type:'contains',direction:'forward',weight:1.0});
    if ((file.exports||[]).some(e=>e.name===fn.name)) edges.push({source:fid,target:id,type:'exports',direction:'forward',weight:0.8});
  }
}
for (const file of input.batchFiles) {
  const fid=`file:${file.path}`;
  for (const target of input.batchImportData[file.path]) edges.push({source:fid,target:`file:${target}`,type:'imports',direction:'forward',weight:0.7});
}
for (const file of extracted.results) {
  const targets = input.batchImportData[file.path] || [];
  for (const call of (file.callGraph || [])) {
    const callee = String(call.callee || '').split('.').pop();
    if (!callee) continue;
    const candidate = targets.map(p=>functionByPathAndName.get(`${p}:${callee}`)).find(Boolean);
    const source = functionByPathAndName.get(`${file.path}:${call.caller}`);
    if (source && candidate && source !== candidate) edges.push({source,target:candidate,type:'calls',direction:'forward',weight:0.8});
  }
}
const uniqueEdges = [...new Map(edges.map(e=>[`${e.source}|${e.target}|${e.type}`,e])).values()];
const paths = input.batchFiles.map(f=>f.path).sort();
const parts = 3, groupSize = Math.ceil(paths.length / parts);
for(let i=0;i<parts;i++) {
 const group=new Set(paths.slice(i*groupSize,(i+1)*groupSize));
 const partNodes=nodes.filter(n=>group.has(n.filePath));
 const ids=new Set(partNodes.map(n=>n.id));
 const partEdges=uniqueEdges.filter(e=>ids.has(e.source));
 fs.writeFileSync(`.ua/intermediate/batch-2-part-${i+1}.json`,JSON.stringify({nodes:partNodes,edges:partEdges},null,2));
 console.log(`part ${i+1}: ${partNodes.length} nodes, ${partEdges.length} edges`);
}
