# Windows XP Portfolio - Pratyush Kumar

An interactive personal portfolio website styled to look and feel like classic Windows XP Luna desktop. Built purely with static HTML5, CSS3, and JavaScript, designed for hosting on GitHub Pages without any build steps or external dependencies.

## Features
- **Classic Luna Desktop**: Fullscreen desktop wallpaper with system fallback colors.
- **Interactive Taskbar**: Start button, quick-launch File Explorer, active running window tasks, and live updating system tray clock.
- **Start Menu**: Native XP popup panel featuring shortcuts to About Me, Credibility, Projects, and Contact windows.
- **Draggable Windows**: Window management with cascading placement, maximize/restore, minimize to taskbar, focus layering, and responsive layout.
- **File Explorer**: Browse the virtual `Datasets` folder tree with history navigation (Back, Forward, Up) and address bar.
- **Built-in Document Viewers**:
  - **PDF Viewer**: Embedded PDF viewer with download and new-tab fallback links.
  - **CSV Viewer**: High-performance in-browser CSV parser supporting quotes, commas, CRLF/LF line endings, sticky headers, row/column statistics, and full file downloads.

## Local Development
To serve locally under a sub-path matching GitHub Pages:
```bash
# From the parent directory of this repository:
python -m http.server 8000
# Then visit: http://localhost:8000/portfolio/
```
