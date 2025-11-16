Tubreeze — Brand Guide

Overview
--------
Tubreeze is a calm, modern brand inspired by gentle airflow. Designed primarily for dark-mode interfaces with soft seafoam and coral accents.

Color Palette
-------------
- Primary: `--accent` = #00c2a8 (Seafoam)
- Secondary: `--surface-1` = #071b22 (Deep Teal)
- Accent: `--accent-2` = #ff7660 (Coral)
- Background: `--bg` = #031018 (Ocean Night)
- Muted text: rgba(230,251,255,0.66)

Example CSS variables
---------------------
:root{
  --bg: #031018;
  --surface-1: #071b22;
  --surface-2: #0b262d;
  --text: #e6fbff;
  --muted: rgba(230,251,255,0.66);
  --accent: #00c2a8;
  --accent-2: #ff7660;
  --accent-contrast: #021a18;
  --radius: 12px;
}

Typography
----------
- Primary UI font: `Inter` (system fallback: system-ui, -apple-system, "Segoe UI", Roboto)
- Display / Logo font suggestion: `Poppins` (clean rounded alternative) or `Montserrat` for geometric simplicity.
- Use a neutral weight (400) for body, 600 for headings.

Spacing & Radius
-----------------
- Base spacing: 8px
- Small gap: 8px
- Medium gap: 16px
- Large gap: 24px
- Card radius: 10–14px (use `--radius: 12px` for calm curves)

Gradients & Backgrounds
------------------------
- Subtle gradient for hero/background: linear-gradient(180deg,#031018 0%, #071b22 100%)
- Soft card surface: use `background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))` over `--surface-1`.

Iconography
-----------
- Keep icons rounded with stroke widths 2–3px
- Breeze icon: soft curves, horizontal flow, minimal details

Accessibility
-------------
- Ensure primary text contrast >= 4.5:1 where possible
- Keep interactive targets >= 44x44px
- Respect `prefers-reduced-motion`

Usage notes
-----------
- On dark backgrounds use `--accent` for CTAs with `--accent-contrast` as text color.
- Use `--accent-2` as secondary highlights for chips and small badges.

Conversion to PNG
-----------------
SVGs are included in `assets/logos/`. Convert to PNG (recommended sizes) with ImageMagick or Inkscape:

ImageMagick (installed):
```
magick convert assets/logos/tubreeze_logo1.svg -background transparent -resize 256x256 assets/logos/tubreeze_logo1.png
```

Inkscape (preferred for sharpness):
```
inkscape assets/logos/tubreeze_logo1.svg --export-type=png --export-filename=assets/logos/tubreeze_logo1.png --export-width=256 --export-height=256
```


