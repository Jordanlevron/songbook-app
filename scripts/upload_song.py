#!/usr/bin/env python3
"""
upload_song.py
==============
Upload a song JSON (produced by pdf_to_json.py) to Firestore.
Clears existing pages subcollection before writing, so re-uploads are clean.

Usage:
    python upload_song.py song.json --creds serviceAccount.json
    python upload_song.py *.json   --creds serviceAccount.json   (multiple files)
"""

import json, sys, argparse, io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


def upload(json_path, db):
    song  = json.loads(Path(json_path).read_text(encoding='utf-8'))
    sid   = song['id']
    pages = song.pop('pages', [])

    doc_ref = db.collection('songs').document(sid)

    # Delete existing pages subcollection before writing new ones
    existing = doc_ref.collection('pages').stream()
    deleted  = 0
    for doc in existing:
        doc.reference.delete()
        deleted += 1

    doc_ref.set(song)

    for pg in pages:
        doc_ref.collection('pages').document(str(pg['page_num'])).set(pg)

    status = f"(מחק {deleted} עמודים ישנים) " if deleted else ""
    print(f"  {status}{song.get('title','?')} — {sid!r}  [{len(pages)} עמודים]")


DEFAULT_JSON_DIR = Path.home() / 'songbook-app' / 'songs_json'

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('json_files', nargs='*',
                    help=f'JSON files or omit to upload all from {DEFAULT_JSON_DIR}')
    ap.add_argument('--creds', required=True)
    ap.add_argument('--dir', default=None,
                    help='directory of JSON files to upload (overrides positional args)')
    args = ap.parse_args()

    import firebase_admin
    from firebase_admin import credentials, firestore

    cred = credentials.Certificate(args.creds)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    if args.dir or not args.json_files:
        src = Path(args.dir) if args.dir else DEFAULT_JSON_DIR
        files = sorted(src.glob('*.json'))
        print(f"טוען מתיקייה: {src}  ({len(files)} קבצים)")
    else:
        files = []
        for pattern in args.json_files:
            matches = list(Path('.').glob(pattern)) if '*' in pattern else [Path(pattern)]
            files.extend(matches)

    print(f"מעלה {len(files)} שירים...")
    for f in files:
        upload(f, db)
    print("סיום.")


if __name__ == '__main__':
    main()
