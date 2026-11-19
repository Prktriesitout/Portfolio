# Asset Inventory & Mapping

This document maps all original assets found in the repository to their standardized target paths, recording renames, extensions, and resolution statuses.

## 1. Directory Renames
- `Assets/` -> `assets/` (renamed to lowercase for case-sensitive environments)
- `Assets/Wallpaper/` -> `assets/wallpaper/` (renamed to lowercase)

## 2. Wallpaper
- Target Path: `assets/wallpaper/background.jpg`
- Real File Found: `assets/wallpaper/background.jpg` (JPEG, 3840x2160, ~2.00 MB)
- Status: **Found & Valid**. (Note: File is ~2.00 MB. In accordance with constraints, the original has been preserved untouched; user may optionally compress it).

## 3. Required Icons Mapping

| Role | Target File | Real File Path | Dimensions | Status | Notes |
|---|---|---|---|---|---|
| Start Button | `start-button.png` | `assets/icons/start-button.png` | 200x60 | MATCH | Used at 100x30 |
| Explorer (Quick Launch/Title) | `explorer.png` | `assets/icons/explorer.png` | 64x64 | MATCH | Used at 16px/32px |
| Explorer Folder (Closed) | `folder.png` | `assets/icons/folder.png` | 64x64 | MATCH | Used at 32px |
| Explorer Folder (Open) | `folder-open.png` | `assets/icons/folder-open.png` | 64x64 | MATCH | Used at 32px |
| PDF Document | `pdf.png` | `assets/icons/pdf.png` | 64x64 | MATCH | Used at 32px |
| CSV Document | `csv.png` | `assets/icons/csv.png` | 64x64 | MATCH | Used at 32px |
| About Me (Menu & Window) | `about-me.png` | `assets/icons/about-me.png` | 64x64 | MATCH | Used at 32px |
| Credibility (Menu & Window) | `credibility.png` | `assets/icons/credibility.png` | 64x64 | MATCH | Used at 32px |
| Projects (Menu & Window) | `projects.png` | `assets/icons/projects.png` | 64x64 | MATCH | Used at 32px |
| Contact (Menu & Window) | `contact.png` | `assets/icons/contact.png` | 64x64 | MATCH | Used at 32px |
| Tray Volume | `volume.png` | `assets/icons/volume.png` | 32x32 | MATCH | Used at 16px |
| Tray Network | `network.png` | `assets/icons/network.png` | 32x32 | MATCH | Used at 16px |
| Tray Shield | `shield.png` | `assets/icons/shield.png` | 32x32 | MATCH | Used at 16px |
| Explorer Toolbar Back | `back.png` | `assets/icons/back.png` | 32x32 | MATCH | Used at 16px |
| Explorer Toolbar Forward | `forward.png` | `assets/icons/forward.png` | 32x32 | MATCH | Used at 16px |
| Explorer Toolbar Up | `up.png` | `assets/icons/up.png` | 32x32 | MATCH | Used at 16px |
| Favicon | `favicon.png` | `assets/icons/favicon.png` | 32x32 | MATCH | Used at 32px |
| Window Minimize Button | `btn-minimize.png` | `assets/icons/btn-minimize.png` | 42x42 | MATCH | Used at 21px |
| Window Maximize Button | `btn-maximize.png` | `assets/icons/btn-maximize.png` | 42x42 | MATCH | Used at 21px |
| Window Close Button | `btn-close.png` | `assets/icons/btn-close.png` | 42x42 | MATCH | Used at 21px |

## 4. Extra Uploaded Files Preserved
The following files were present in `assets/icons/` and preserved as-is:
- `assets/icons/Documents.ico`
- `assets/icons/Empty Recycle Bin.ico`
- `assets/icons/Full Recycle Bin.ico`
- `assets/icons/My computer.ico`
- `assets/icons/Network.ico`

## 5. Files / Datasets / Resume Renames

| Original Path | Renamed Target Path | Reason |
|---|---|---|
| `files/resume/Pratyush_Kumar.pdf` | `files/resume/pratyush-kumar.pdf` | Lowercase & hyphenated |
| `files/datasets/advertising_data.csv` | `files/datasets/advertising-data.csv` | Hyphenated, no underscore |
| `files/datasets/bedtime_screentime_sleep_debt.csv` | `files/datasets/bedtime-screentime-sleep-debt.csv` | Hyphenated, no underscore |
| `files/datasets/TriHemo-MCV (1).csv` | `files/datasets/trihemo-mcv-1.csv` | Lowercase, hyphens, removed spaces & parentheses |
