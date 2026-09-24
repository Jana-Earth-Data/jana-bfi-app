#!/usr/bin/env bash
# Two-pass manual build.
#
# Pass 1 produces a PDF with no page numbers in the Contents. We read the real
# page of each "Part N" heading out of that PDF, then rebuild with the numbers
# baked in. A TableOfContents field would need a word processor to update it,
# which is why v0.1 and v0.2 both shipped a blank Contents page.
set -euo pipefail
DOCS="${1:-/sessions/hopeful-kind-fermi/mnt/Projects/repos/jana-bfi-app/docs}"
BUILDER="$DOCS/build_manual_v03.js"
STEM="Jana_Financed_Emissions_Dashboard_User_Manual_Demo_v0.3"
cd "$(dirname "$BUILDER")"

pass () {  # "$@" = extra args, passed through unsplit (the JSON contains spaces)
  node "$BUILDER" "$DOCS/$STEM.docx" "$@" >/dev/null
  soffice --headless --convert-to pdf --outdir "$DOCS" "$DOCS/$STEM.docx" >/dev/null 2>&1
}

pages () {
python3 - "$DOCS/$STEM.pdf" << 'PY'
import pypdf, re, sys, json
r = pypdf.PdfReader(sys.argv[1]); out = {}
for i, p in enumerate(r.pages):
    for m in re.finditer(r"Part\s+(\d{1,2})\s*\|", p.extract_text() or ""):
        n = m.group(1)
        out.setdefault(n, i + 1)
print(json.dumps(out, separators=(",", ":")))
PY
}

pass
P1=$(pages)
pass --pages "$P1"
P2=$(pages)
if [ "$P1" != "$P2" ]; then pass --pages "$P2"; fi   # pagination shifted; settle it
echo "contents page map: $(pages)"
python3 -c "import pypdf,sys;print('pages:',len(pypdf.PdfReader('$DOCS/$STEM.pdf').pages))"
