#!/usr/bin/env python3
"""
pdf_to_json.py
==============
Wraps chord_parser.py and converts its output to the song JSON format
expected by the Songbook app.

Usage:
    python pdf_to_json.py <pdf_file> [--out song.json] [--title "Title"] [--artist "Artist"]

Output JSON shape:
{
  "id":        "slug",
  "title":     "...",
  "artist":    "...",
  "key":       { "detected": "Am", "confidence": null, "manual": null },
  "page_size": { "w": 540, "h": 780 },
  "pages": [
    {
      "page_num": 1,
      "height_pt": 780,
      "items": [
        { "type": "chord", "text": "Am", "x0": 38.7, "x1": 57.7,
          "y": 21.2, "font_pt": 14, "is_heb": false }
      ]
    }
  ]
}
"""

import sys, json, re, argparse
from pathlib import Path

PARSER_DIR = Path.home() / "Downloads" / "קבצים לקלוד לאפליקציה"
sys.path.insert(0, str(PARSER_DIR))

from chord_parser import parse_pdf

NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
EH    = {'Db':'C#','Eb':'D#','Fb':'E','Gb':'F#','Ab':'G#','Bb':'A#','Cb':'B'}

def detect_title_artist(pages_data, y_tol=4):
    """
    מזהה את שורת הכותרת לפי קו תחתון (is_underline).
    אם אין, לוקח את השורה הראשונה.
    מפצל ל-title (קבוצה ימנית, x גדול) ו-artist (קבוצה שמאלית, x קטן).
    """
    if not pages_data or not pages_data[0]['items']:
        return None, None

    items = pages_data[0]['items']

    # עדיפות: שורה עם קו תחתון
    underlined = [it for it in items if it.get('is_underline')]
    if underlined:
        ref_y = min(it['y'] for it in underlined)
        first_line = [it for it in items if it.get('is_underline') and it['y'] <= ref_y + y_tol]
    else:
        # fallback: שורה ראשונה לפי Y
        min_y = min(it['y'] for it in items)
        first_line = [it for it in items if it['y'] <= min_y + y_tol]

    if not first_line:
        return None, None

    first_line.sort(key=lambda it: it['x0'])

    # Find the largest gap between adjacent items to split title from artist
    split_idx = 0
    max_gap = -float('inf')
    for i in range(len(first_line) - 1):
        gap = first_line[i + 1]['x0'] - first_line[i]['x1']
        if gap > max_gap:
            max_gap = gap
            split_idx = i

    # Left group (smaller x) = artist, right group (larger x) = title
    if len(first_line) >= 2:
        artist_items = first_line[:split_idx + 1]
        title_items  = first_line[split_idx + 1:]
    else:
        title_items  = first_line
        artist_items = []

    # RTL reading order: larger x0 = rightmost = first word
    rtl = lambda lst: ' '.join(it['text'] for it in sorted(lst, key=lambda i: -i['x0']))
    return rtl(title_items), rtl(artist_items)


def detect_key(pages_data):
    counts = {}
    for pg in pages_data:
        for it in pg['items']:
            if it['type'] == 'chord':
                m = re.match(r'^([A-G][b#]?)', it['text'])
                if m:
                    note = EH.get(m.group(1), m.group(1))
                    counts[note] = counts.get(note, 0) + 1
    if not counts:
        return None
    return max(counts, key=counts.get)

def slugify(text):
    text = re.sub(r'[^\w\s-]', '', text, flags=re.UNICODE)
    return re.sub(r'[\s]+', '_', text.strip()).lower()[:60]

def convert(pdf_path, title=None, artist=None):
    pdf_path = Path(pdf_path)
    raw_pages = parse_pdf(pdf_path)

    # Build normalized pages
    pages = []
    page_w = 540.0
    for pg in raw_pages:
        items = []
        for it in pg['items']:
            items.append({
                'type':         it['type'],
                'text':         it['text'],
                'x0':           round(it['x0'], 2),
                'x1':           round(it['x1'], 2),
                'y':            round(it['y'],  2),
                'font_pt':      round(it['font_pt'], 1),
                'is_heb':       it['is_heb'],
                'is_underline': it.get('is_underline', False),
            })
        pages.append({
            'page_num':  pg['page_num'],
            'height_pt': round(pg['height_pt'], 1),
            'items':     items,
        })
        if items:
            page_w = max(page_w, max(i['x1'] for i in items))

    detected_key = detect_key(pages)
    detected_title, detected_artist = detect_title_artist(pages)
    song_title  = title  or detected_title  or pdf_path.stem.replace('_', ' ')
    song_artist = artist or detected_artist or ''

    return {
        'id':        slugify(song_title),
        'title':     song_title,
        'artist':    song_artist,
        'key':       {'detected': detected_key, 'confidence': None, 'manual': None},
        'page_size': {'w': round(page_w, 1), 'h': pages[0]['height_pt'] if pages else 780},
        'pages':     pages,
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('pdf')
    ap.add_argument('--out',    default=None, help='output JSON path')
    ap.add_argument('--title',  default=None)
    ap.add_argument('--artist', default=None)
    args = ap.parse_args()

    song = convert(args.pdf, args.title, args.artist)
    out_path = Path(args.out) if args.out else Path(args.pdf).with_suffix('.json')
    out_path.write_text(json.dumps(song, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"Saved: {out_path}  ({len(song['pages'])} pages, id={song['id']!r})")

if __name__ == '__main__':
    main()
