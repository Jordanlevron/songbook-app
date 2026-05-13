"""
Chord Parser v9s
================
מנתח PDF של שירים ומסווג כל מילה: chord / lyric / structure
שימוש: python3 chord_parser.py <pdf_file> [output.html]
"""

import sys
import pdfplumber
import re
from pathlib import Path

# ══════════════════════════════════════════
# קבועים
# ══════════════════════════════════════════

SYMBOL_MAP = {'\uF066': 'ø', '\uF044': '∆'}

PUNCT = set('.,!?;:\'"…–-()[]')

CHORD_RE = re.compile(
    r'^([A-G][b#]?(maj|Maj|min|Min|m(?!in|aj)|dim|Dim|°|[Oo]|aug|\+|sus(?!\d)|add)?'
    r'(\d{1,2})?([b#]\d)?(sus[24])?(add\d+)?[∆°ø\^\u2206\u00F8]?7?([b#]\d)?'
    r'(\(\+\d+\))?(/[A-G][b#]?)?'          # ← (+5) נוסף
    r'|/[A-G][b#]?'
    r'|[A-G][b#]?/)$'
)

CHORD_NOTES_RE = re.compile(
    r'^[A-G][b#]?[^(]*\([b#]?\d+[-–][b#]?\d+\)$'  # ← b לפני ספרות
)

BARLINE_RE = re.compile(
    r'^(I{1,3}:?|:I{1,3}|:\||\|{1,2}:?:?|x\d+|,)$',  # ← || נוסף
    re.IGNORECASE
)

BARLINE_TOKENS = re.compile(r'^(I{1,3}|,|\|{1,2})$', re.IGNORECASE)

SEP_RE = re.compile(r'^([#*&%@])\1{2,}$')

HEBREW_HYPHEN_RE = re.compile(r'^[-‐‑–—־]$')

SECTION_KW = {
    'intro', 'verse', 'chorus', 'bridge', 'solo', 'interlude', 'outro',
    'coda', 'tag', 'refrain', 'intrld', 'intrlde', 'brdg',
    'hook', 'break', 'chords',
    'פתיחה', 'בית', 'פזמון', 'גשר', 'מעבר', 'סיום',
}

ENGLISH_WORD_RE = re.compile(r"^[a-zA-Z][a-zA-Z']{1,}[a-zA-Z]$|^[a-zA-Z]{2,}$")
# כל טקסט לטיני (גם סלנג, קיצורים, גרש בהתחלה)
LATIN_RE = re.compile(r"[a-zA-Z]")
HEBREW_RE       = re.compile(r'[\u05D0-\u05EA]{2,}')
MUSIC_SYMBOLS   = {'∆', '\u2206', 'ø', '\u00F8'}

# פיצול IC/IIC
SPLIT_IC_RE = re.compile(r'^(I{1,3})([A-G].*)$')
# פיצול AI/BI/GI (אקורד+I בטעות)
SPLIT_AI_RE = re.compile(r'^([A-G][b#]?)(I{1,3})$')
# פיצול אקורדים מודבקים: CG, Am7Em7
SPLIT_CHORDS_RE = re.compile(
    r'[A-G][b#]?(?:maj|Maj|min|Min|m(?!in|aj)|dim|Dim|aug|\+|sus|add|\d+|[∆°ø\^\/])*'
)

# ══════════════════════════════════════════
# פונקציות עזר
# ══════════════════════════════════════════

def is_heb(t):
    return any('\u0590' <= c <= '\u05FF' for c in t)

def fix_parens(t):
    return '(' + t[1:-1] + ')' if t.startswith(')') and t.endswith('(') else t

def smart_flip(text):
    i = 0
    while i < len(text) and text[i] in PUNCT: i += 1
    j = len(text)
    while j > i and text[j-1] in PUNCT: j -= 1
    return text[j:][::-1] + text[i:j][::-1] + text[:i][::-1]

def clean_font(f):
    b = (f or '').split('+')[-1]
    if 'Symbol' in b: return 'Symbol'
    if 'Calibri' in b: return 'Calibri'
    return 'Arial'

def strip_outer_parens(text):
    """הסר סוגריים רק אם הם עוטפים את כל המחרוזת."""
    t = text.strip()
    if t.startswith('(') and t.endswith(')') and t.count('(') == 1:
        return t[1:-1]
    return t

def is_chord(text):
    t = strip_outer_parens(text.strip())
    if CHORD_RE.match(t): return True
    if CHORD_NOTES_RE.match(text.strip()): return True
    if BARLINE_RE.match(text.strip()): return True
    # קבוצת סוגריים עם אקורדים: (E4-3 F#ø), (Eb∆7)
    if text.startswith('(') and text.endswith(')'):
        inner = text[1:-1].strip()
        if re.search(r'[A-G]', inner): return True
    # מספר אקורדים מופרדים ברווח: E(4-3) F#ø
    parts = text.strip().split()
    if len(parts) > 1 and all(is_chord(p) for p in parts):
        return True
    # אקורדים מודבקים: CG, Am7Em7
    parts = SPLIT_CHORDS_RE.findall(t)
    if len(parts) > 1 and ''.join(parts) == t and all(CHORD_RE.match(p) for p in parts):
        return True
    # פיצול לפי digit/symbol לפני אות
    parts2 = re.split(r'(?<=[0-9∆°ø\^\u2206])(?=[A-G])', t)
    if len(parts2) > 1 and all(CHORD_RE.match(p) for p in parts2):
        return True
    return False

def is_coherent_word(text):
    t = text.strip()
    if not t: return False
    if HEBREW_RE.search(t): return True
    if LATIN_RE.search(t): return True   # כל טקסט עם אות לטינית
    if is_chord(t): return True
    if SEP_RE.match(t): return True
    if BARLINE_TOKENS.match(t): return True  # | and || barlines
    return False

def has_english_lyrics(line_words):
    for w in line_words:
        t = w['text'].strip().rstrip('.,!?"\',;:()')
        if not LATIN_RE.search(t): continue
        if is_chord(t): continue
        if BARLINE_TOKENS.match(t): continue
        if t.lower() in SECTION_KW: continue
        if len(t) < 2: continue
        return True
    return False

def classify_word(text, heb, line_has_chord=False, line_has_eng_lyrics=False):
    t = text.strip().rstrip(':')
    if not t: return 'empty'
    if not is_coherent_word(t): return 'empty'
    if SEP_RE.match(t): return 'structure'  # decorative section separators (###, ***)

    if heb: return 'lyric'
    if t.lower() in SECTION_KW: return 'structure'
    if BARLINE_RE.match(text.strip()):   # I, II, II:, :II, x2, |, || …
        if line_has_eng_lyrics and not line_has_chord: return 'lyric'
        return 'chord'
    if is_chord(text): return 'chord'
    return 'lyric'

# ══════════════════════════════════════════
# עיבוד מילים
# ══════════════════════════════════════════

def fix_leading_paren(text):
    """
    תקן סוגר פותח לפני שם התו:
    (E4-3      → E(4-3)
    (E4-3 F#ø) → E(4-3) F#ø
    (Eb∆7)     → ללא שינוי (אקורד בסוגריים)
    """
    t = text.strip()
    # מקרה: (E4-3 F#ø) — אקורד+הוראה + אקורד נוסף
    m2 = re.match(r'^\(([A-G][b#]?)(\d+-\d+)\s+(.+)\)$', t)
    if m2:
        return f"{m2.group(1)}({m2.group(2)}) {m2.group(3)}"
    # מקרה: (E4-3 — חסר סוגר סוגר
    m1 = re.match(r'^\(([A-G][b#]?)(\d+-\d+)(.*)$', t)
    if m1:
        rest = m1.group(3).strip()
        return f"{m1.group(1)}({m1.group(2)}){(' ' + rest) if rest else ''}"
    return t


def merge_paren_groups(words):
    """
    מזג קבוצות שמתחילות ב-( ומסתיימות ב-) באותה שורה.
    (Eb + ∆ + 7) → (Eb∆7)
    """
    from collections import defaultdict
    lines = defaultdict(list)
    for i, w in enumerate(words):
        lines[round(w['top'] / 3) * 3].append((i, w))

    to_merge = {}
    for y_key, line_words in lines.items():
        sorted_line = sorted(line_words, key=lambda x: x[1]['x0'])
        i = 0
        while i < len(sorted_line):
            idx, w = sorted_line[i]
            t = w['text']
            if t.startswith('(') and not t.endswith(')'):
                group_indices = [idx]
                group_texts   = [t]
                j = i + 1
                while j < len(sorted_line):
                    next_idx, next_w = sorted_line[j]
                    group_indices.append(next_idx)
                    group_texts.append(next_w['text'])
                    if next_w['text'].endswith(')') or next_w['text'] == ')':
                        to_merge[group_indices[0]] = (group_indices, group_texts, sorted_line[i][1])
                        i = j
                        break
                    j += 1
            i += 1

    skip = set()
    result = []
    for i, w in enumerate(words):
        if i in skip:
            continue
        if i in to_merge:
            indices, texts, base = to_merge[i]
            merged_text = texts[0]
            for tx in texts[1:]:
                if merged_text and merged_text[-1] not in ('(', ' ') and tx not in (')', '∆', 'ø'):
                    merged_text += ' '
                merged_text += tx
            m = base.copy()
            m['text']    = re.sub(r'([∆ø]) (\d)', r'\1\2', merged_text)
            m['x1']      = words[indices[-1]]['x1']
            result.append(m)
            skip.update(indices[1:])
        else:
            result.append(w)
    return result

def merge_tokens(words):
    result = []
    i = 0
    while i < len(words):
        w = words[i]

        if not w['is_heb']:
            # פיצול IC/IIC
            m = SPLIT_IC_RE.match(w['text'])
            if m and m.group(2):
                for p in [m.group(1), m.group(2)]:
                    pw = w.copy(); pw['text'] = p
                    result.append(pw)
                i += 1
                continue

            # פיצול AI/BI (אקורד+I בטעות הקלדה)
            m2 = SPLIT_AI_RE.match(w['text'])
            if m2:
                for p in [m2.group(1), m2.group(2)]:
                    pw = w.copy(); pw['text'] = p
                    result.append(pw)
                i += 1
                continue

        # מיזוג סימנים מוסיקליים
        merged = w['text']
        x1 = w['x1']
        j = i + 1
        while j < len(words) and not words[j]['is_heb']:
            nw = words[j]
            gap = nw['x0'] - x1
            nt = nw['text']
            if nt in MUSIC_SYMBOLS and gap < 5:
                merged += nt; x1 = nw['x1']; j += 1
            elif re.match(r'^\d$', nt) and merged and merged[-1] in MUSIC_SYMBOLS and gap < 3:
                merged += nt; x1 = nw['x1']; j += 1
            elif nw.get('is_symbol') and gap < 2:
                merged += nt; x1 = nw['x1']; j += 1
            else:
                break

        if j > i + 1:
            m3 = w.copy(); m3['text'] = merged; m3['x1'] = x1
            result.append(m3)
        else:
            result.append(w)

        i = j if j > i + 1 else i + 1
    return result

def merge_hebrew_hyphens(words):
    """
    Merge Hebrew syllables split by hyphens: נו(x=50) + -(x=100) + אר(x=120) + -(x=170) + נש(x=190)
    → one item with text='נש-אר-נו' (assembled in descending-x = RTL reading order).
    The hyphen token itself is dropped by classify_word (not coherent), so merge it first.
    """
    from collections import defaultdict
    by_top = defaultdict(list)
    for i, w in enumerate(words):
        by_top[round(w['top'] * 2) / 2].append((i, w))

    skip = set()
    replacements = {}

    for _, group in by_top.items():
        row = sorted(group, key=lambda x: x[1]['x0'])
        j = 0
        while j < len(row):
            idx, w = row[j]
            if idx in skip or not w['is_heb']:
                j += 1; continue

            chain = [(idx, w)]
            k = j + 1
            while k < len(row) - 1:
                _, hw = row[k]
                _, nw = row[k + 1]
                gap_before = hw['x0'] - chain[-1][1]['x1']
                gap_after  = nw['x0'] - hw['x1']
                if (HEBREW_HYPHEN_RE.match(hw['text'])
                        and nw['is_heb']
                        and gap_before < 10
                        and gap_after  < 10):
                    chain.append((row[k][0], hw))
                    chain.append((row[k + 1][0], nw))
                    k += 2
                else:
                    break

            if len(chain) > 1:
                # RTL reading order = descending x0
                ordered = sorted(chain, key=lambda x: -x[1]['x0'])
                text = ''.join(cw['text'] for _, cw in ordered)
                m = chain[0][1].copy()
                m['text'] = text
                m['x0']   = min(cw['x0'] for _, cw in chain)
                m['x1']   = max(cw['x1'] for _, cw in chain)
                replacements[chain[0][0]] = m
                for ci, _ in chain[1:]:
                    skip.add(ci)
                j = k
            else:
                j += 1

    result = []
    for i, w in enumerate(words):
        if i in skip:
            continue
        result.append(replacements.get(i, w))
    return result


def group_lines(words, tol=4):
    lines = []
    for w in sorted(words, key=lambda x: x['top']):
        placed = False
        for line in lines:
            avg_y = sum(ww['top'] for ww in line) / len(line)
            if abs(w['top'] - avg_y) <= tol:
                line.append(w); placed = True; break
        if not placed:
            lines.append([w])
    return lines

def process_page(raw):
    words = []
    for w in raw:
        font = clean_font(w.get('fontname', ''))
        size = round(w.get('size', 14), 1)
        text = ''.join(SYMBOL_MAP.get(c, c) for c in w['text']) if font == 'Symbol' else w['text']
        text = ''.join(c for c in text if ord(c) < 0xE000 or ord(c) > 0xF8FF)
        if not text.strip(): continue
        heb = is_heb(text)
        if heb: text = smart_flip(text)
        else:
            text = fix_parens(text)
            # Fix reversed inner parens from RTL extraction: F)6-5( → F(6-5)
            if ')' in text and '(' in text:
                rp, lp = text.index(')'), text.rindex('(')
                if rp < lp:
                    text = text[:rp] + '(' + text[rp+1:lp] + ')' + text[lp+1:]
        words.append({
            'text': text, 'x0': w['x0'], 'x1': w['x1'],
            'top': w['top'], 'font': font, 'size_pt': size,
            'is_heb': heb, 'is_symbol': (font == 'Symbol'),
        })

    words = merge_paren_groups(words)
    # תקן סוגריים שהופיעו לפני שם התו
    for w in words:
        if not w['is_heb'] and w['text'].startswith('('):
            w['text'] = fix_leading_paren(w['text'])
    words = merge_tokens(words)
    words = merge_hebrew_hyphens(words)

    items = []
    for line in group_lines(words):
        if not line: continue
        has_chord = any(
            is_chord(w['text']) and not BARLINE_RE.match(w['text'].strip())
            for w in line if not w['is_heb']
        )
        has_eng = has_english_lyrics(line)
        for w in line:
            w['wtype'] = classify_word(w['text'], w['is_heb'], has_chord, has_eng)
        for w in line:
            if w['wtype'] == 'empty': continue
            items.append({
                'type': w['wtype'], 'text': w['text'],
                'x0': w['x0'], 'x1': w['x1'], 'y': w['top'],
                'font_pt': w['size_pt'], 'font': w['font'],
                'is_heb': w['is_heb'],
            })
    return items

# ══════════════════════════════════════════
# רינדור HTML
# ══════════════════════════════════════════

PT_TO_PX  = 96 / 72
PAGE_W    = 540.0
DISPLAY_W = 660
SCALE     = DISPLAY_W / (PAGE_W * PT_TO_PX)

COLORS = {
    'chord':     {'bg': 'rgba(191,219,254,0.85)', 'border': '#2563eb', 'text': '#1e3a8a'},
    'lyric':     {'bg': 'rgba(187,247,208,0.85)', 'border': '#16a34a', 'text': '#14532d'},
    'structure': {'bg': 'rgba(254,215,170,0.9)',  'border': '#ea580c', 'text': '#7c2d12'},
}

def esc(s):
    return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

def render_page(items, height_pt):
    dh = round(height_pt * PT_TO_PX * SCALE) + 20
    divs = []
    for ln in items:
        t = ln['type']
        c = COLORS.get(t, COLORS['lyric'])
        y_px = ln['y']       * PT_TO_PX * SCALE
        lh   = ln['font_pt'] * PT_TO_PX * SCALE * 1.25
        fs   = ln['font_pt'] * PT_TO_PX * SCALE
        w_px = (ln['x1'] - ln['x0']) * PT_TO_PX * SCALE
        if ln['is_heb']:
            right_css = (PAGE_W - ln['x1']) * PT_TO_PX * SCALE
            divs.append(
                f'<div title="{t}" style="position:absolute;right:{right_css:.1f}px;'
                f'top:{y_px:.1f}px;width:{w_px:.1f}px;height:{lh:.1f}px;'
                f'line-height:{lh:.1f}px;background:{c["bg"]};'
                f'border-bottom:2px solid {c["border"]};color:{c["text"]};'
                f'font-family:{ln["font"]},Arial,sans-serif;font-size:{fs:.1f}px;'
                f'font-weight:bold;white-space:nowrap;padding:0 2px;'
                f'box-sizing:border-box;direction:rtl;">{esc(ln["text"])}</div>'
            )
        else:
            x_px = ln['x0'] * PT_TO_PX * SCALE
            # width=auto כדי שאקורדים עם סוגריים לא ייחתכו
            divs.append(
                f'<div title="{t}" style="position:absolute;left:{x_px:.1f}px;'
                f'top:{y_px:.1f}px;height:{lh:.1f}px;'
                f'line-height:{lh:.1f}px;background:{c["bg"]};'
                f'border-bottom:2px solid {c["border"]};color:{c["text"]};'
                f'font-family:{ln["font"]},Arial,sans-serif;font-size:{fs:.1f}px;'
                f'font-weight:bold;white-space:nowrap;padding:0 3px;'
                f'box-sizing:border-box;direction:ltr;">{esc(ln["text"])}</div>'
            )
    return (
        f'<div style="position:relative;width:{DISPLAY_W}px;height:{dh}px;'
        f'background:white;border-radius:4px;margin-bottom:8px;'
        f'box-shadow:0 4px 20px rgba(0,0,0,.4);">' + ''.join(divs) + '</div>'
    )

def render_html(pages_data, title='Chord Parser'):
    legend = ''.join(
        f'<span style="padding:3px 12px;background:{c["bg"]};'
        f'border:1.5px solid {c["border"]};color:{c["text"]};'
        f'border-radius:6px;font-size:12px;font-family:Arial;'
        f'font-weight:bold;margin:0 3px">{lbl}</span>'
        for lbl, k in [('אקורדים','chord'),('מילים','lyric'),('מבנה','structure')]
        for c in [COLORS[k]]
    )
    slides = ''.join(
        f'<div style="margin-bottom:40px">'
        f'<p style="color:#89b4fa;font-size:12px;font-weight:bold;margin:0 0 6px">'
        f'עמוד {pd["page_num"]}</p>'
        f'{render_page(pd["items"], pd["height_pt"])}</div>'
        for pd in pages_data
    )
    return f'''<!doctype html><html lang="he" dir="rtl">
<head><meta charset="utf-8"><title>{esc(title)}</title>
<style>*{{box-sizing:border-box}}
body{{font-family:Arial;background:#11111b;margin:0;padding:24px 16px;
     color:#cdd6f4;direction:rtl;text-align:right}}
h1{{color:#cba6f7;margin:0 0 4px;font-size:18px}}
.sub{{color:#6c7086;font-size:12px;margin-bottom:16px}}
.leg{{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:24px}}
</style></head><body>
<h1>🎸 {esc(title)}</h1>
<p class="sub">chord · lyric · structure | v9s</p>
<div class="leg">{legend}</div>{slides}</body></html>'''

# ══════════════════════════════════════════
# נקודת כניסה
# ══════════════════════════════════════════

def _color_to_hex(color):
    """Convert pdfplumber color (None / float / RGB / CMYK tuple) to #rrggbb."""
    if color is None:
        return '#000000'
    try:
        if isinstance(color, (int, float)):
            v = int(min(1.0, float(color)) * 255)
            return f'#{v:02x}{v:02x}{v:02x}'
        c = [min(1.0, float(x)) for x in color]
        if len(c) == 1:
            v = int(c[0] * 255); return f'#{v:02x}{v:02x}{v:02x}'
        if len(c) == 3:
            return '#{:02x}{:02x}{:02x}'.format(*(int(x * 255) for x in c))
        if len(c) == 4:           # CMYK
            cm, m, y, k = c
            return '#{:02x}{:02x}{:02x}'.format(
                int((1 - cm) * (1 - k) * 255),
                int((1 - m)  * (1 - k) * 255),
                int((1 - y)  * (1 - k) * 255),
            )
    except Exception:
        pass
    return '#000000'


def _pts_to_page(pts, page_h):
    """
    Convert a list of (x, y) points to page-space (y=0 at top).
    pdfplumber stores pts in PDF space (y=0 at bottom) for raw line/curve objects.
    We detect which convention is in use by comparing y values to page height.
    """
    ys = [p[1] for p in pts]
    # If all y values are <= page_h they're likely already in page space
    # (pdfplumber may or may not pre-transform depending on version).
    # Safe heuristic: if mean y < page_h/2 AND page_h is plausible for page-space
    # top-origin, trust as-is; otherwise flip.
    mean_y = sum(ys) / len(ys) if ys else 0
    # In PDF space a mid-page value ≈ page_h/2; in page-space also ≈ page_h/2.
    # We rely on pdfplumber having already done the flip (most versions do).
    return [(round(p[0], 1), round(p[1], 1)) for p in pts]


def extract_graphic_shapes(page):
    """
    Extract line-based shapes (arrows, brackets, decorative marks) that are NOT
    simple rectangles.  Returns a list of shape dicts for SVG rendering.
    """
    page_w = page.width
    page_h = page.height

    raw_segs = []

    # ── pdfplumber line segments ──────────────────────────────────────────────
    for obj in page.lines:
        pts = obj.get('pts')
        if pts and len(pts) >= 2:
            ep = _pts_to_page(pts, page_h)
            x0, y0 = ep[0]
            x1, y1 = ep[-1]
        else:
            x0 = round(obj.get('x0', 0), 1)
            x1 = round(obj.get('x1', 0), 1)
            y0 = round(obj.get('top', 0), 1)
            y1 = round(obj.get('bottom', y0), 1)

        seg_w = abs(x1 - x0)
        seg_h = abs(y1 - y0)
        # Skip page-spanning lines (borders / rules)
        if seg_w > page_w * 0.7 or seg_h > page_h * 0.7:
            continue

        raw_segs.append({
            'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1,
            'color': _color_to_hex(obj.get('stroking_color')),
            'lw': round(obj.get('linewidth', 1) or 1, 1),
            'kind': 'line',
        })

    # ── pdfplumber curves (Bezier paths) ─────────────────────────────────────
    for obj in page.curves:
        pts = obj.get('pts')
        if not pts or len(pts) < 2:
            continue
        ep = _pts_to_page(pts, page_h)
        # Store first and last control point as the effective span
        x0, y0 = ep[0]
        x1, y1 = ep[-1]
        all_x = [p[0] for p in ep]; all_y = [p[1] for p in ep]
        bx0 = min(all_x); bx1 = max(all_x)
        by0 = min(all_y); by1 = max(all_y)

        if (bx1 - bx0) > page_w * 0.7 or (by1 - by0) > page_h * 0.7:
            continue

        raw_segs.append({
            'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1,
            'bx0': bx0, 'by0': by0, 'bx1': bx1, 'by1': by1,
            'color': _color_to_hex(obj.get('stroking_color')),
            'lw': round(obj.get('linewidth', 1) or 1, 1),
            'kind': 'curve',
            'ctrl': [(round(p[0], 1), round(p[1], 1)) for p in ep],
        })

    if not raw_segs:
        return []

    # ── Group nearby segments into shape clusters ─────────────────────────────
    def bbox(s):
        xs = [s['x0'], s['x1']] + ([s['bx0'], s['bx1']] if 'bx0' in s else [])
        ys = [s['y0'], s['y1']] + ([s['by0'], s['by1']] if 'by0' in s else [])
        return min(xs), min(ys), max(xs), max(ys)

    def boxes_close(b1, b2, tol=30):
        dx = max(0, max(b1[0], b2[0]) - min(b1[2], b2[2]))
        dy = max(0, max(b1[1], b2[1]) - min(b1[3], b2[3]))
        return dx < tol and dy < tol

    bboxes = [bbox(s) for s in raw_segs]
    used = [False] * len(raw_segs)
    groups = []

    for i in range(len(raw_segs)):
        if used[i]: continue
        grp = [i]; used[i] = True
        changed = True
        while changed:
            changed = False
            for j in range(len(raw_segs)):
                if used[j]: continue
                if any(boxes_close(bboxes[g], bboxes[j]) for g in grp):
                    grp.append(j); used[j] = True; changed = True
        groups.append(grp)

    # ── Build shape objects ───────────────────────────────────────────────────
    shapes = []
    for grp in groups:
        segs = [raw_segs[i] for i in grp]
        all_x = [v for s in segs for v in [s['x0'], s['x1']] + ([s['bx0'], s['bx1']] if 'bx0' in s else [])]
        all_y = [v for s in segs for v in [s['y0'], s['y1']] + ([s['by0'], s['by1']] if 'by0' in s else [])]
        x0 = min(all_x); x1 = max(all_x)
        y0 = min(all_y); y1 = max(all_y)
        w = x1 - x0; h = y1 - y0

        # Skip if tiny dot or too large
        if w < 3 and h < 3: continue
        if w > page_w * 0.6 or h > page_h * 0.6: continue

        color = segs[0]['color']
        lw    = segs[0]['lw']

        out_segs = []
        for s in segs:
            entry = {
                'x0': round(s['x0'] - x0, 1), 'y0': round(s['y0'] - y0, 1),
                'x1': round(s['x1'] - x0, 1), 'y1': round(s['y1'] - y0, 1),
                'k': s['kind'][0],  # 'l' or 'c'
            }
            if s['kind'] == 'curve':
                # flat list [x0,y0,x1,y1,...] — Firestore forbids nested arrays
                entry['pts'] = [v for p in s['ctrl'] for v in (round(p[0]-x0,1), round(p[1]-y0,1))]
            out_segs.append(entry)

        shapes.append({
            'x0': round(x0, 1), 'y': round(y0, 1),
            'x1': round(x1, 1), 'y2': round(y1, 1),
            'color': color, 'lw': lw,
            'segs': out_segs,
        })

    return shapes


def parse_pdf(pdf_path, output_path=None):
    pdf_path = Path(pdf_path)
    if output_path is None:
        output_path = pdf_path.with_suffix('.html')
    pages_data = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            raw = page.extract_words(
                x_tolerance=1, y_tolerance=3,
                keep_blank_chars=False, extra_attrs=["fontname","size"],
            )
            items = process_page(raw)
            rects = [
                {'x0': round(r['x0'], 1), 'y': round(r['top'], 1),
                 'x1': round(r['x1'], 1), 'y2': round(r['bottom'], 1)}
                for r in page.rects
                if (r['x1'] - r['x0']) > 15 and (r['bottom'] - r['top']) > 8
            ]
            shapes = extract_graphic_shapes(page)
            pages_data.append({'page_num': i+1, 'items': items, 'height_pt': page.height, 'rects': rects, 'shapes': shapes})
            types = {}
            for it in items: types[it['type']] = types.get(it['type'],0)+1
            print(f"  עמוד {i+1}: {sum(types.values())} items — {types}")
    html = render_html(pages_data, title=pdf_path.stem)
    Path(output_path).write_text(html, encoding='utf-8')
    print(f"\nנשמר: {output_path}")
    return pages_data

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("שימוש: python3 chord_parser.py <pdf_file> [output.html]")
        sys.exit(1)
    parse_pdf(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
