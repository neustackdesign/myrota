# Design import (Claude Design → TSX)

Reproducible conversion of the packed Claude Design files into the React
components in this repo. The source HTML files are **not committed**: they embed
font binaries, which must not be redistributed. Keep them outside the repo
(e.g. `~/design-intake/`).

```bash
I=~/design-intake            # contains "myrota Landing (1).html", "myrota Prototype (1).html"
python3 -I scripts/design-import/unpack.py "$I/myrota Landing (1).html"   "$I/landing"
python3 -I scripts/design-import/unpack.py "$I/myrota Prototype (1).html" "$I/proto"
# split template → markup.html + logic.js (see docs/NEW_DESIGN_SOURCE_AUDIT.md §Method)
python3 -I scripts/design-import/dc2tsx.py "$I/landing/markup.html" "$I/gen/landing_full" component
python3 -I scripts/design-import/dc2tsx.py "$I/proto/markup.html"   "$I/gen/proto" proto
python3 -I scripts/design-import/build_landing.py "$I/gen/landing_full/component.tsx" components/landing/Landing.tsx
python3 -I scripts/design-import/build_screens.py "$I/gen/proto" components/app/screens.tsx
```

`build_landing.py` and `build_screens.py` apply the documented truthfulness
patches (copy hooks, removed dead links) and assert each one applies exactly
once, so a changed design source fails loudly instead of silently drifting.
