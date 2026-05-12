# Songbook App — Claude Instructions

## Session Start
At the beginning of every session, run:
```
git -C C:\Users\User\songbook-app pull origin main
```
This ensures the working copy reflects any changes committed from a previous session.

## Project Overview
Hebrew songbook PWA — React + Vite + Firebase Firestore.
- PDF → JSON pipeline: `scripts/pdf_to_json.py` (runs via Python)
- Chord transposition: `src/lib/transpose.js`
- Main viewer: `src/components/SongViewer.jsx`
- Firebase upload: `scripts/upload_song.js`

## Key Conventions
- PT_TO_PX = 96/72 (PDF points to screen pixels)
- Page layout is RTL (Hebrew); chords inside ChordBoxSection must set `direction: ltr` explicitly
- Chord box sections: all-chord lines with at least one barline item
- `groupLines(items, yTol=8)` merges items within 8pt vertically into one row
- Auto-save hook commits `src/`, `scripts/`, config files — never `.env` or `serviceAccount.json`
