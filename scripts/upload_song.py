#!/usr/bin/env python3
"""
upload_song.py
==============
Upload a song JSON (produced by pdf_to_json.py) to Firestore.

Requirements: pip install firebase-admin
Usage:
    python upload_song.py song.json --creds serviceAccount.json
"""

import json, sys, argparse
from pathlib import Path

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('json_file')
    ap.add_argument('--creds', required=True, help='Firebase service account JSON')
    args = ap.parse_args()

    import firebase_admin
    from firebase_admin import credentials, firestore

    cred = credentials.Certificate(args.creds)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    song = json.loads(Path(args.json_file).read_text(encoding='utf-8'))
    sid = song['id']
    pages = song.pop('pages', [])

    # Write metadata
    db.collection('songs').document(sid).set(song)
    print(f"Wrote metadata for {sid!r}")

    # Write pages as subcollection docs
    for pg in pages:
        db.collection('songs').document(sid) \
          .collection('pages').document(str(pg['page_num'])).set(pg)
    print(f"Wrote {len(pages)} pages")

if __name__ == '__main__':
    main()
