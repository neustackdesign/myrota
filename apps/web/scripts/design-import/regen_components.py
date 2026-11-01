import re, sys
S = sys.argv[1]
for c in ["RotaMarker", "RotaSpot", "Avatar", "RhythmStrip", "PhotoFrame"]:
    body = re.sub(r'^// ----.*\n', '', open(f"{S}/gen/c/{c}/component.tsx").read(), flags=re.M).strip()
    path = f"components/brand/{c}.tsx"
    lines = open(path).read().split("\n")
    hits = [i for i, l in enumerate(lines) if len(l) > 400 and "<>" in l]
    assert len(hits) == 1, (c, hits)
    l = lines[hits[0]]
    a, b = l.index("<>"), l.rindex("</>") + 3
    lines[hits[0]] = l[:a] + body + l[b:]
    open(path, "w").write("\n".join(lines))
print("ok")
