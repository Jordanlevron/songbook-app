# Songbook App — Claude Instructions

## Session Start
At the beginning of every session:
1. Run `git -C ~/songbook-app pull origin main` to get latest changes
2. Read all files in `.claude/memory/` — they contain project context, user preferences, and design rules that must be followed throughout the session

## Setup (first time on a new machine)

### Prerequisites
```bash
# Node.js (v18+)
node --version

# Python 3.10+
python3 --version

# Python dependencies
pip3 install pdfplumber firebase-admin
```

### Clone and install
```bash
git clone https://github.com/Jordanlevron/songbook-app.git ~/songbook-app
cd ~/songbook-app
npm install
```

### Files NOT in git (must be transferred manually)
- `serviceAccount.json` — Firebase service account key (place in ~/songbook-app/)
- Source PDF files — the main chord-sheet PDF(s) to parse

### Run locally
```bash
cd ~/songbook-app
npm run dev        # dev server at localhost:5173
npm run build      # production build → dist/
```

### Parse PDFs and upload songs
```bash
# Parse a PDF → songs_json/
python3 scripts/pdf_to_json.py /path/to/chords.pdf

# Upload all JSON from songs_json/ to Firestore
python3 scripts/upload_song.py --creds serviceAccount.json
```

## Project Overview
Hebrew songbook PWA — React + Vite + Firebase Firestore.

### Key files
| File | Purpose |
|------|---------|
| `scripts/chord_parser.py` | PDF → items parser. Classifies each word as chord/lyric/structure |
| `scripts/pdf_to_json.py` | Wraps chord_parser, groups pages into songs, writes JSON |
| `scripts/upload_song.py` | Uploads JSON files to Firestore |
| `scripts/delete_all_songs.py` | Wipes Firestore songs collection (use before full re-upload) |
| `src/components/SongViewer.jsx` | Main render component — all PDF layout logic lives here |
| `src/components/TransposeBar.jsx` | Transpose / zoom / color controls |
| `src/pages/SongPage.jsx` | Song page — wires song data to SongViewer + TransposeBar |
| `src/lib/transpose.js` | Chord transposition logic |
| `src/lib/songs.js` | Firestore data access |
| `songs_json/` | Generated JSON files (gitignored — re-generate from PDFs) |

## Key Architecture Decisions

### PT_TO_PX = 96 / 72
PDF points to screen pixels. All x/y coordinates in JSON are in PDF points.

### Two-column layout handling
Songs are formatted in two columns (right column = Hebrew lyrics, left column = chord boxes sharing the same Y coordinates). `splitXClusters(items, minGapPt=45)` in SongViewer.jsx splits items at the same Y into independent clusters when the horizontal gap exceeds 45pt. This prevents left/right column items from being merged into the same render group.

### Chord box detection
`isChordBoxLine(items)` returns true when ALL items in a cluster are type='chord' AND at least one is a barline. These render as `ChordBoxSection` (flex row with absolute positioning). Mixed lines (chords above lyrics) render as `ChordLine` + `Run` components.

### Barlines
`BARLINE_RE = /^(I{1,3}:?|:I{1,3}|:\||\|:?:?|\||x\d+)$/i`
Barlines (I, II, II:, :II, |, ||, x2) are classified as 'chord' type. Normalised on render: II→||, :II→|:, II:→:|. Repeat markers (x2) shown in purple.

### Hebrew RTL
- Hebrew items positioned via `right: (contentW - x1) * scale`
- English/chord items positioned via `left: x0 * scale`
- `direction: ltr` required explicitly on chord-box containers
- `smart_flip()` in chord_parser.py corrects RTL character ordering from the PDF

### Structure markers
`SEP_RE = /^([#*&%@])\1{2,}$/` matches `######`, `*****`, `@@@@@@`, etc.
These are classified as type='structure' (orange) and rendered as `Run` elements. They are meaningful visual separators written by the song arranger — do NOT convert them to horizontal lines or other visual representations. Render them as text exactly as they appear.

### Enclosing rectangles
`page.rects` from pdfplumber are extracted and stored in the JSON as `rects: [{x0, y, x1, y2}]`. SongViewer renders them as absolutely-positioned bordered divs (pointer-events: none) to reconstruct the bracket/box decorations from the original Word document.

### Graphic shapes (arrows, brackets)
`page.lines` and `page.curves` from pdfplumber are extracted by `extract_graphic_shapes()` in chord_parser.py. Line segments spanning > 70% of the page are filtered out (borders/rules). Nearby segments are clustered by proximity (30pt) into shape groups. Each group is stored in the JSON as `shapes: [{x0, y, x1, y2, color, lw, segs: [{k, x0,y0,x1,y1, pts?}]}]`. SongViewer renders each shape as an inline SVG with `<line>` or `<path>` elements at exact position. Color comes from `stroking_color` (supports grayscale, RGB, CMYK).

### Hebrew hyphenated words
`merge_hebrew_hyphens()` in chord_parser.py detects adjacent Hebrew + hyphen + Hebrew token sequences at the same Y (gap < 10pt) and merges them into one item assembled in descending-x (RTL) order. Fixes syllable-split words like `נו-תר-נו` that otherwise lose the hyphen and render with gaps.

## Classifier Rules (chord_parser.py)

```
classify_word(text, heb, line_has_chord, line_has_eng_lyrics):
  → 'empty'     if not coherent (punctuation-only, private-use unicode, etc.)
  → 'structure' if SEP_RE matches (###, ***, @@@, ...)
  → 'lyric'     if Hebrew
  → 'structure' if text.lower() in SECTION_KW
  → 'chord'     if BARLINE_RE matches (unless line has eng lyrics but no chord)
  → 'chord'     if is_chord(text)
  → 'lyric'     otherwise
```

SECTION_KW includes: intro, verse, chorus, bridge, solo, interlude, outro, coda, tag, refrain, intrld, intrlde, brdg, hook, break, chords, פתיחה, בית, פזמון, גשר, מעבר, סיום.
NOTE: 'part' is NOT in SECTION_KW — it is a lyric word. Only 'Cpart'/'C part' are structural.

## Auto-save Hook (Windows only)
The `hooks.Stop` in `~/.claude/settings.json` runs `scripts/git_autosave.ps1` after each Claude session to commit and push changes. This hook is Windows/PowerShell-specific and will not run on Mac.

On Mac, commit and push manually after each session:
```bash
cd ~/songbook-app
git add src/ scripts/ CLAUDE.md
git commit -m "session changes"
git push
```

## Common Commands

```bash
# Re-parse ALL songs from a PDF and upload
python3 scripts/pdf_to_json.py /path/to/songbook.pdf
python3 scripts/upload_song.py --creds serviceAccount.json

# Wipe Firestore and re-upload everything
python3 scripts/delete_all_songs.py --creds serviceAccount.json
python3 scripts/upload_song.py --creds serviceAccount.json

# Build for production
npm run build

# Preview production build locally
npm run preview
```
