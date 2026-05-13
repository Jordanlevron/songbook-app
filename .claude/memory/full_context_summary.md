# Full Project Context — Load This If Starting Fresh

## Who I Am
Jordan Levron — musician, band leader (תירס חם). Not primarily a developer.
Working on a Hebrew songbook PWA for the band (~800 chord-sheet songs).
Primary machine: Windows. Secondary: iMac.

## The Project
**Repo:** https://github.com/Jordanlevron/songbook-app  
**Stack:** React + Vite + Firebase Firestore, PWA  
**Purpose:** Parse chord-sheet PDFs → display songs with transposition on any device

## Pipeline
```
PDF → scripts/chord_parser.py → scripts/pdf_to_json.py → songs_json/*.json
                                                        → scripts/upload_song.py → Firestore
                                                                                 → React app
```

## Key Files
- `scripts/chord_parser.py` — PDF parser, classifies each word as chord/lyric/structure
- `scripts/pdf_to_json.py` — wraps parser, groups pages into songs, writes JSON
- `scripts/upload_song.py` — uploads JSON to Firestore (default dir: ~/songbook-app/songs_json)
- `scripts/delete_all_songs.py` — wipes Firestore songs collection
- `src/components/SongViewer.jsx` — all PDF layout rendering logic
- `src/components/TransposeBar.jsx` — transpose / zoom / color controls
- `src/pages/SongPage.jsx` — song page wiring
- `src/lib/transpose.js` — chord transposition
- `serviceAccount.json` — Firebase key, NOT in git, must be in ~/songbook-app/

## Architecture Decisions (do not change without asking)

### Two-column layout
Songs are two-column PDFs (right = Hebrew lyrics, left = chord boxes).
Items in the same row share Y coordinates.
`splitXClusters(items, minGapPt=45)` in SongViewer.jsx splits them into independent clusters when horizontal gap > 45pt.

### Chord box detection
`isChordBoxLine(items)` → true when ALL items are type='chord' AND at least one is a barline.
Renders as `ChordBoxSection`. Mixed lines (chords above lyrics) render as `ChordLine` + `Run`.

### Barlines
`BARLINE_RE = /^(I{1,3}:?|:I{1,3}|:\||\|:?:?|\||x\d+)$/i`
Normalised on render: II→||, :II→|:, II:→:|. Repeat markers (x2) shown in purple.

### Structure markers
`######`, `*****`, `@@@@@@`, etc. → type='structure', render as orange text.
**NEVER convert these to horizontal lines or any other visual.** They are meaningful markers written by the song arranger. Render as text exactly as they appear.

### Hebrew RTL
- Hebrew items: `right: (contentW - x1) * scale`
- English/chord items: `left: x0 * scale`
- `direction: ltr` required explicitly on chord-box containers
- `smart_flip()` in chord_parser.py corrects RTL character ordering from the PDF

### Hebrew hyphenated words
`merge_hebrew_hyphens()` in chord_parser.py merges syllables split by hyphens.
`נו-תר-נו` was rendering as `נו תר נו` (hyphen dropped as 'empty'). Now assembled RTL.

### Enclosing rectangles
`page.rects` from pdfplumber → stored in JSON as `rects: [{x0,y,x1,y2}]`.
SongViewer renders them as bordered divs (pointer-events:none) — the bracket/box decorations from the original Word document.

### Classifier rules (chord_parser.py)
```
classify_word(text, heb, line_has_chord, line_has_eng_lyrics):
  → 'empty'     if not coherent
  → 'structure' if SEP_RE matches (###, ***, @@@...)
  → 'lyric'     if Hebrew
  → 'structure' if text.lower() in SECTION_KW
  → 'chord'     if BARLINE_RE matches
  → 'chord'     if is_chord(text)
  → 'lyric'     otherwise
```

SECTION_KW: intro, verse, chorus, bridge, solo, interlude, outro, coda, tag, refrain,
intrld, intrlde, brdg, hook, break, chords, פתיחה, בית, פזמון, גשר, מעבר, סיום.
NOTE: 'part' is NOT in SECTION_KW — it is a lyric word.

## How Jordan Likes to Work
- Short, direct responses. No long summaries at the end.
- Don't make visual design decisions without asking first.
- Don't process issues one at a time — fix everything visible at once.
- Bias toward action — don't ask for confirmation on straightforward fixes.
- When something requires a visual decision, present the options and ask.

## Common Commands
```bash
# Parse PDF and upload
python3 scripts/pdf_to_json.py /path/to/chords.pdf
python3 scripts/upload_song.py --creds serviceAccount.json

# Wipe and re-upload everything
python3 scripts/delete_all_songs.py --creds serviceAccount.json
python3 scripts/upload_song.py --creds serviceAccount.json

# Dev server
npm run dev

# Build
npm run build
```

## Open Issues (as of last session)
- Hebrew hyphenated words fix and rect rendering are implemented but songs need to be **re-parsed from the source PDF** to reflect parser changes — the existing songs_json/ files were built with the old parser
- `Bm` chord appearing in wrong position in הולכת איתך — suspected old JSON, needs re-parse to confirm
- Chords going slightly off-screen in לבד במדבר — needs re-parse to confirm
