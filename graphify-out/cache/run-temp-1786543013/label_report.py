import json
from pathlib import Path

from graphify.analyze import suggest_questions
from graphify.build import build_from_json
from graphify.report import generate

extraction = json.loads(Path("graphify-out/.graphify_extract.json").read_text(encoding="utf-8"))
detection = json.loads(Path("graphify-out/.graphify_detect.json").read_text(encoding="utf-8"))
analysis = json.loads(Path("graphify-out/.graphify_analysis.json").read_text(encoding="utf-8"))
labels_raw = json.loads(Path("graphify-out/.graphify_labels.json").read_text(encoding="utf-8"))
labels = {int(key): value for key, value in labels_raw.items()}
communities = {int(key): value for key, value in analysis["communities"].items()}
cohesion = {int(key): value for key, value in analysis["cohesion"].items()}
graph = build_from_json(extraction, root=".", directed=False)
tokens = {"input": extraction.get("input_tokens", 0), "output": extraction.get("output_tokens", 0)}
questions = suggest_questions(graph, communities, labels)
report = generate(graph, communities, cohesion, labels, analysis["gods"], analysis["surprises"], detection, tokens, ".", suggested_questions=questions)
Path("graphify-out/GRAPH_REPORT.md").write_text(report, encoding="utf-8")
analysis["questions"] = questions
Path("graphify-out/.graphify_analysis.json").write_text(json.dumps(analysis, indent=2, ensure_ascii=False), encoding="utf-8")
print("Report updated with 72 community labels")
