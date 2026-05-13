---
name: Songbook App — Project Context
description: Full context for the Hebrew/English songbook PWA project — architecture, active bugs, pipeline, and file locations
type: project
originSessionId: 54b90a35-fba5-4161-ad21-b3ce5f06d041
---
Hebrew songbook PWA: React + Vite + Firebase Firestore.
GitHub: https://github.com/Jordanlevron/songbook-app
Local path: ~/songbook-app (Windows: C:\Users\User\songbook-app)

**Why:** Band (תירס חם) has 800+ song chord sheets as PDF. App lets musicians browse, transpose, and read songs on any device.

**Pipeline:** PDF → chord_parser.py (classifies each word as chord/lyric/structure) → pdf_to_json.py (groups pages into songs, writes JSON) → upload_song.py (Firestore) → React app reads from Firestore.

**chord_parser.py is now IN the repo** at `scripts/chord_parser.py` (was previously in Windows Downloads folder — moved during Mac migration session).

**songs_json/** is gitignored — generated data. Re-generate with `python3 scripts/pdf_to_json.py <pdf>`.

**serviceAccount.json** is gitignored — must be manually transferred between machines. Lives in ~/songbook-app/.

**How to apply:** Always pull before starting a session. All architecture decisions are in CLAUDE.md inside the repo.
