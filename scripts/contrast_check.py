#!/usr/bin/env python3
import re
import math
from pathlib import Path

def hex_to_rgb(hexstr):
    h = hexstr.lstrip('#')
    if len(h) == 3:
        h = ''.join(ch*2 for ch in h)
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def srgb_to_linear(c):
    c = c / 255.0
    if c <= 0.03928:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4

def relative_luminance(hexstr):
    r, g, b = hex_to_rgb(hexstr)
    R = srgb_to_linear(r)
    G = srgb_to_linear(g)
    B = srgb_to_linear(b)
    return 0.2126 * R + 0.7152 * G + 0.0722 * B

def contrast_ratio(a_hex, b_hex):
    la = relative_luminance(a_hex)
    lb = relative_luminance(b_hex)
    L1 = max(la, lb)
    L2 = min(la, lb)
    return (L1 + 0.05) / (L2 + 0.05)

def parse_vars(css_path):
    text = Path(css_path).read_text()
    # find --var: value; lines within :root
    vars = {}
    pattern = re.compile(r"--([a-z0-9-]+)\s*:\s*([^;\n]+);", re.I)
    for m in pattern.finditer(text):
        name = m.group(1).strip()
        val = m.group(2).strip()
        vars[name] = val
    return vars

def pick_color(value):
    # value may be hex or rgba(...) or var(...)
    if value.startswith('#'):
        return value
    if value.startswith('rgba') or value.startswith('rgb'):
        nums = re.findall(r"[0-9]+\.?[0-9]*", value)
        if len(nums) >= 3:
            r,g,b = map(int, nums[:3])
            return '#%02x%02x%02x' % (r,g,b)
    # try var fallback: we won't resolve var() here
    return None

def main():
    css = 'frontend/src/styles.css'
    vars = parse_vars(css)

    # mapping keys we expect from the Midnight Ocean theme
    lookups = {
        'text-primary': vars.get('text-primary') or vars.get('text_primary') or vars.get('text-primary'),
        'text-secondary': vars.get('text-secondary') or vars.get('text_secondary') or vars.get('text-secondary'),
        'bg': vars.get('bg') or vars.get('color-bg') or vars.get('color_bg'),
        'surface': vars.get('surface') or vars.get('color-surface-1') or vars.get('color_surface_1'),
        'surface-alt': vars.get('surface-alt') or vars.get('color-surface-2') or vars.get('color_surface_2'),
        'accent': vars.get('accent') or vars.get('color-primary') or vars.get('color_primary'),
    }

    # Resolve values to hex where possible
    resolved = {}
    for k,v in lookups.items():
        if not v:
            resolved[k] = None
            continue
        v = v.strip()
        # remove var() wrappers if any
        m = re.match(r"var\(--([a-z0-9-]+)\)", v)
        if m:
            ref = m.group(1)
            v = vars.get(ref, v)
        # clean possible comments
        v = v.split('/*')[0].strip()
        color = pick_color(v)
        resolved[k] = color

    pairs = [
        ('text-primary','surface'),
        ('text-primary','surface-alt'),
        ('text-secondary','surface'),
        ('text-secondary','surface-alt'),
        ('accent','surface'),
        ('accent','surface-alt'),
        ('text-primary','accent'),
    ]

    print('\nWCAG Contrast Report — Midnight Ocean (generated)')
    print('Source CSS:', css)
    print('\nResolved colors:')
    for k,v in resolved.items():
        print(f'  {k}: {v}')

    print('\nPairs: ratio (AA small >=4.5, AA large >=3.0)')
    for a,b in pairs:
        ca = resolved.get(a)
        cb = resolved.get(b)
        if not ca or not cb:
            print(f'  {a} vs {b}: MISSING value (cannot compute)')
            continue
        try:
            ratio = contrast_ratio(ca, cb)
            ok_small = ratio >= 4.5
            ok_large = ratio >= 3.0
            print(f'  {a:15} on {b:15} — {ratio:.2f}: AA_small={ok_small} AA_large={ok_large}')
        except Exception as e:
            print(f'  {a} vs {b}: ERROR {e}')

    print('\nSuggested fixes:')
    print('- If any pair fails AA_small, consider brightening the text or darkening the surface slightly.')

if __name__ == "__main__":
    main()
