#!/usr/bin/env python3
"""
pdf_to_json.py
==============
Wraps chord_parser.py and converts its output to the song JSON format
expected by the Songbook app.

Usage:
    python pdf_to_json.py <pdf_file> [--out-dir DIR] [--title "Title"] [--artist "Artist"]

Each page of the PDF is treated as one song.
Multi-page songs are detected by:
  - Title ending with '#1' (followed by a page whose title ends with '#2', '#3', ...)
  - Continuation page title starting with 'המשך'
"""

import sys, json, re, argparse, io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

PARSER_DIR = Path.home() / "Downloads" / "קבצים לקלוד לאפליקציה"
sys.path.insert(0, str(PARSER_DIR))

from chord_parser import parse_pdf

EH = {'Db':'C#','Eb':'D#','Fb':'E','Gb':'F#','Ab':'G#','Bb':'A#','Cb':'B'}

_CHORD_START  = re.compile(r'^[A-G][b#]?')
_BARLINE_PAT  = re.compile(r'^(I{1,3}:?|:I{1,3}|:\||\|+|x\d+|,)$', re.IGNORECASE)
_STRUCT_WORDS = {
    'intro', 'verse', 'chorus', 'bridge', 'solo', 'interlude', 'outro',
    'coda', 'tag', 'refrain', 'intrld', 'intrlde', 'brdg',
    'part', 'hook', 'break', 'chords',
    'פתיחה', 'בית', 'פזמון', 'גשר', 'מעבר', 'סיום',
}

def _is_real_word(item):
    """True if item is a real word — not a chord, barline, or structure keyword."""
    t = item['text'].strip().rstrip(':')
    if not t:                          return False
    if _CHORD_START.match(t):          return False
    if _BARLINE_PAT.match(t):          return False
    if t.lower() in _STRUCT_WORDS:     return False
    if re.match(r'^[\d|,.:]+$', t):    return False
    return True

def _lines_by_y(items, y_tol=4):
    """Group items into lines sorted by Y (top to bottom)."""
    lines = []
    for it in sorted(items, key=lambda i: i['y']):
        for line in lines:
            if abs(it['y'] - line[0]['y']) <= y_tol:
                line.append(it)
                break
        else:
            lines.append([it])
    return lines


# ── Title detection ────────────────────────────────────────────────────────────

def _ordered_text(items):
    """
    Join item texts in correct reading order.
    Hebrew/mixed lines → sort descending x0 (RTL).
    All-English lines → sort ascending x0 (LTR).
    """
    if not items:
        return ''
    heb_count = sum(1 for it in items if it.get('is_heb', False))
    ascending = (heb_count == 0)
    return ' '.join(it['text'] for it in sorted(items, key=lambda i: i['x0'] if ascending else -i['x0']))


def get_page_raw_title(items, y_tol=4):
    """Return raw title text from a page's items — first line only."""
    if not items:
        return ''
    underlined = [it for it in items if it.get('is_underline')]
    if underlined:
        ref_y = min(it['y'] for it in underlined)
        line  = [it for it in items if it.get('is_underline') and it['y'] <= ref_y + y_tol]
    else:
        min_y = min(it['y'] for it in items)
        line  = [it for it in items if it['y'] <= min_y + y_tol]
    if not line:
        return ''
    return _ordered_text(line)


def strip_part_marker(title):
    """Remove trailing '#1', '#2', ... and leading 'המשך' from a title."""
    t = re.sub(r'\s*#\d+\s*$', '', title.strip()).strip()
    t = re.sub(r'^המשך\s*', '', t).strip()
    return t


def is_continuation(title):
    """True if this page continues the previous song."""
    t = title.strip()
    return t.startswith('המשך') or bool(re.search(r'#[2-9]\d*\s*$', t))


def _title_words_overlap(a, b):
    """True if two title strings share >= 50% of their words (handles partial Piano Man / Billy Joel splits)."""
    wa = set(a.split())
    wb = set(b.split())
    if not wa or not wb:
        return False
    overlap = len(wa & wb)
    return overlap >= max(1, min(len(wa), len(wb)) * 0.5)


# ── Song splitting ─────────────────────────────────────────────────────────────

def split_songs(raw_pages):
    """
    Group PDF pages into per-song lists.
    Continuation rules:
      1. Title starts with 'המשך' or ends with '#2', '#3', etc.
      2. Title (after stripping markers) matches previous page's title exactly.
    """
    groups = []
    current = []
    prev_clean = None

    for pg in raw_pages:
        raw_title = get_page_raw_title(pg['items'])
        t         = raw_title.strip()

        # Use real-word title (same logic as build_song) for accurate comparison
        real_title, _ = detect_title_artist(pg['items'])
        clean = (real_title or '').strip().lower()

        explicit_cont = is_continuation(t)
        same_title    = bool(clean and prev_clean and (
            clean == prev_clean or _title_words_overlap(clean, prev_clean)
        ))

        if (explicit_cont or same_title) and current:
            current.append(pg)
        else:
            if current:
                groups.append(current)
            current = [pg]

        prev_clean = clean

    if current:
        groups.append(current)
    return groups


# ── Song building ──────────────────────────────────────────────────────────────

def detect_title_artist(page_items, y_tol=4):
    """
    Find the first line that contains real words, then split into (title, artist).
    Title = rightmost group (larger x in RTL layout), artist = leftmost group.
    Strips part markers (#1, #2, המשך).
    """
    if not page_items:
        return None, None

    # Priority: underlined items
    underlined = [it for it in page_items if it.get('is_underline')]
    if underlined:
        ref_y      = min(it['y'] for it in underlined)
        first_line = [it for it in page_items if it.get('is_underline') and it['y'] <= ref_y + y_tol]
    else:
        # Walk lines top-to-bottom; use first line that has at least one real word
        first_line = None
        for line in _lines_by_y(page_items, y_tol):
            if any(_is_real_word(it) for it in line):
                first_line = line
                break
        if first_line is None:
            return None, None

    if not first_line:
        return None, None

    first_line.sort(key=lambda it: it['x0'])

    # Find largest gap to split right group (title) / left group (artist)
    split_idx, max_gap = 0, -float('inf')
    for i in range(len(first_line) - 1):
        gap = first_line[i + 1]['x0'] - first_line[i]['x1']
        if gap > max_gap:
            max_gap, split_idx = gap, i

    if len(first_line) >= 2:
        right = first_line[split_idx + 1:]   # larger x = title in RTL layout
        left  = first_line[:split_idx + 1]   # smaller x = artist in RTL layout
        right_has = any(_is_real_word(it) for it in right)
        left_has  = any(_is_real_word(it) for it in left)

        if right_has:
            title  = strip_part_marker(_ordered_text(right))
            artist = _ordered_text(left) if left_has else ''
        elif left_has:
            title  = strip_part_marker(_ordered_text(left))
            artist = ''
        else:
            title  = strip_part_marker(_ordered_text(first_line))
            artist = ''
    else:
        title  = strip_part_marker(_ordered_text(first_line))
        artist = ''

    return title or None, artist or None


def detect_key(pages):
    counts = {}
    for pg in pages:
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
    return re.sub(r'\s+', '_', text.strip()).lower()[:60]


def build_song(page_group):
    """Convert a list of raw pages into a song dict."""
    pages  = []
    page_w = 540.0
    for pg in page_group:
        items = [
            {
                'type':         it['type'],
                'text':         it['text'],
                'x0':           round(it['x0'],      2),
                'x1':           round(it['x1'],      2),
                'y':            round(it['y'],        2),
                'font_pt':      round(it['font_pt'],  1),
                'is_heb':       it['is_heb'],
                'is_underline': it.get('is_underline', False),
            }
            for it in pg['items']
        ]
        pages.append({
            'page_num':  pg['page_num'],
            'height_pt': round(pg['height_pt'], 1),
            'items':     items,
            'rects':     pg.get('rects', []),
        })
        if items:
            page_w = max(page_w, max(i['x1'] for i in items))

    detected_title, detected_artist = detect_title_artist(pages[0]['items'])
    song_title  = detected_title  or f"שיר {pages[0]['page_num']}"
    song_artist = detected_artist or ''

    return {
        'id':        slugify(song_title),
        'title':     song_title,
        'artist':    song_artist,
        'key':       {'detected': detect_key(pages), 'confidence': None, 'manual': None},
        'page_size': {'w': round(page_w, 1), 'h': pages[0]['height_pt']},
        'pages':     pages,
    }


# ── Entry point ────────────────────────────────────────────────────────────────

def convert(pdf_path):
    """Parse a PDF and return a list of song dicts (one per song)."""
    raw_pages = parse_pdf(Path(pdf_path))
    groups    = split_songs(raw_pages)
    songs     = [build_song(g) for g in groups]
    return songs


DEFAULT_OUT_DIR = Path.home() / 'songbook-app' / 'songs_json'

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('pdf')
    ap.add_argument('--out-dir', default=None,
                    help=f'output directory (default: {DEFAULT_OUT_DIR})')
    args = ap.parse_args()

    songs   = convert(args.pdf)
    out_dir = Path(args.out_dir) if args.out_dir else DEFAULT_OUT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{len(songs)} שירים זוהו:")
    for song in songs:
        pages_str = f"{len(song['pages'])} עמוד{'ות' if len(song['pages']) > 1 else ''}"
        print(f"  • {song['title']}  ({song['artist'] or '—'})  [{pages_str}]  id={song['id']!r}")
        out_path = out_dir / f"{song['id']}.json"
        out_path.write_text(json.dumps(song, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f"    -> {out_path}")


if __name__ == '__main__':
    main()
