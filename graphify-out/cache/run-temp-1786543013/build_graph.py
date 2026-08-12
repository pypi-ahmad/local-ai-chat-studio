import json
from pathlib import Path

from graphify.analyze import god_nodes, suggest_questions, surprising_connections
from graphify.build import build_from_json
from graphify.cluster import cluster, score_all
from graphify.export import to_json
from graphify.report import generate

extraction = json.loads(Path("graphify-out/.graphify_extract.json").read_text(encoding="utf-8"))
detection = json.loads(Path("graphify-out/.graphify_detect.json").read_text(encoding="utf-8"))
graph = build_from_json(extraction, root=".", directed=False)
if graph.number_of_nodes() == 0:
    raise SystemExit("ERROR: Graph is empty - extraction produced no nodes.")
communities = cluster(graph)
cohesion = score_all(graph, communities)
tokens = {"input": extraction.get("input_tokens", 0), "output": extraction.get("output_tokens", 0)}
gods = god_nodes(graph)
surprises = surprising_connections(graph, communities)
labels = {community: f"Community {community}" for community in communities}
questions = suggest_questions(graph, communities, labels)
if not to_json(graph, communities, "graphify-out/graph.json"):
    raise SystemExit("ERROR: refused to shrink graphify-out/graph.json")
report = generate(graph, communities, cohesion, labels, gods, surprises, detection, tokens, ".", suggested_questions=questions)
Path("graphify-out/GRAPH_REPORT.md").write_text(report, encoding="utf-8")
analysis = {
    "communities": {str(key): value for key, value in communities.items()},
    "cohesion": {str(key): value for key, value in cohesion.items()},
    "gods": gods,
    "surprises": surprises,
    "questions": questions,
}
Path("graphify-out/.graphify_analysis.json").write_text(json.dumps(analysis, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"Graph: {graph.number_of_nodes()} nodes, {graph.number_of_edges()} edges, {len(communities)} communities")
