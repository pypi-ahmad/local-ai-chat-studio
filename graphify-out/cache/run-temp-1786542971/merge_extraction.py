import glob
import json
from pathlib import Path

from graphify.cache import save_semantic_cache

chunks = sorted(glob.glob("graphify-out/.graphify_chunk_*.json"))
nodes, edges, hyperedges = [], [], []
input_tokens = output_tokens = 0
for chunk in chunks:
    data = json.loads(Path(chunk).read_text(encoding="utf-8"))
    nodes.extend(data.get("nodes", []))
    edges.extend(data.get("edges", []))
    hyperedges.extend(data.get("hyperedges", []))
    input_tokens += data.get("input_tokens", 0)
    output_tokens += data.get("output_tokens", 0)
new = {"nodes": nodes, "edges": edges, "hyperedges": hyperedges,
       "input_tokens": input_tokens, "output_tokens": output_tokens}
Path("graphify-out/.graphify_semantic_new.json").write_text(
    json.dumps(new, indent=2, ensure_ascii=False), encoding="utf-8"
)
uncached = [line for line in Path("graphify-out/.graphify_uncached.txt").read_text(encoding="utf-8").splitlines() if line]
saved = save_semantic_cache(nodes, edges, hyperedges, root=".", allowed_source_files=uncached)

cached_path = Path("graphify-out/.graphify_cached.json")
cached = json.loads(cached_path.read_text(encoding="utf-8")) if cached_path.exists() else {
    "nodes": [], "edges": [], "hyperedges": []
}
seen = set()
merged_nodes = []
for node in cached.get("nodes", []) + nodes:
    if node["id"] not in seen:
        seen.add(node["id"])
        merged_nodes.append(node)
semantic = {
    "nodes": merged_nodes,
    "edges": cached.get("edges", []) + edges,
    "hyperedges": cached.get("hyperedges", []) + hyperedges,
    "input_tokens": input_tokens,
    "output_tokens": output_tokens,
}
Path("graphify-out/.graphify_semantic.json").write_text(
    json.dumps(semantic, indent=2, ensure_ascii=False), encoding="utf-8"
)

ast = json.loads(Path("graphify-out/.graphify_ast.json").read_text(encoding="utf-8"))
seen = {node["id"] for node in ast["nodes"]}
all_nodes = list(ast["nodes"])
for node in semantic["nodes"]:
    if node["id"] not in seen:
        seen.add(node["id"])
        all_nodes.append(node)
extraction = {
    "nodes": all_nodes,
    "edges": ast["edges"] + semantic["edges"],
    "hyperedges": semantic["hyperedges"],
    "input_tokens": input_tokens,
    "output_tokens": output_tokens,
}
Path("graphify-out/.graphify_extract.json").write_text(
    json.dumps(extraction, indent=2, ensure_ascii=False), encoding="utf-8"
)
print(f"Cached {saved} files")
print(f"Merged: {len(all_nodes)} nodes, {len(extraction['edges'])} edges ({len(ast['nodes'])} AST + {len(semantic['nodes'])} semantic)")
