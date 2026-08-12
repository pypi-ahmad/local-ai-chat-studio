import json
from pathlib import Path

from graphify.diagnostics import diagnose_extraction, format_diagnostic_report

extraction = json.loads(Path("graphify-out/.graphify_extract.json").read_text(encoding="utf-8"))
summary = diagnose_extraction(extraction, directed=False, root=".")
print(format_diagnostic_report(summary))
flags = [f"{summary[key]} {label}" for key, label in (
    ("dangling_endpoint_edges", "dangling-endpoint edges"),
    ("missing_endpoint_edges", "missing-endpoint edges"),
    ("self_loop_edges", "self-loop edges"),
    ("directed_same_endpoint_collapsed_edges", "collapsed (directed) edges"),
    ("undirected_same_endpoint_collapsed_edges", "collapsed (undirected) edges"),
) if summary.get(key, 0)]
print("GRAPH HEALTH WARNING: " + "; ".join(flags) + " - graph may be incomplete/corrupt." if flags else "Graph health: OK (no dangling/missing/collapsed edges).")
