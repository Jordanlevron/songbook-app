#!/usr/bin/env python3
"""מוחק את כל השירים מ-Firestore לצורך העלאה מחדש."""
import argparse, io, sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--creds', required=True)
    args = ap.parse_args()

    import firebase_admin
    from firebase_admin import credentials, firestore

    firebase_admin.initialize_app(credentials.Certificate(args.creds))
    db = firestore.client()

    songs = list(db.collection('songs').stream())
    print(f"מוחק {len(songs)} שירים...")
    for doc in songs:
        # Delete pages subcollection
        for pg in doc.reference.collection('pages').stream():
            pg.reference.delete()
        doc.reference.delete()
        print(f"  נמחק: {doc.id}")
    print("סיום.")

if __name__ == '__main__':
    main()
