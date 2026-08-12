import json
from pathlib import Path

from graphify.cache import check_semantic_cache

detect = json.loads(Path("graphify-out/.graphify_detect.json").read_text(encoding="utf-8"))
all_files = [
    file_name
    for category in ("document", "paper", "image")
    for file_name in detect["files"].get(category, [])
]
nodes, edges, hyperedges, uncached = check_semantic_cache(all_files, root=".")
cached_path = Path("graphify-out/.graphify_cached.json")
if nodes or edges or hyperedges:
    cached_path.write_text(json.dumps({"nodes": nodes, "edges": edges, "hyperedges": hyperedges}, ensure_ascii=False), encoding="utf-8")
else:
    cached_path.unlink(missing_ok=True)
Path("graphify-out/.graphify_uncached.txt").write_text("\n".join(uncached), encoding="utf-8")
print(f"Cache: {len(all_files) - len(uncached)} files hit, {len(uncached)} files need extraction")
