/**
 * Windows XP Main Entry Point
 * Boots desktop modules, wires global taskbar shortcuts, and manages window resize sync.
 */

window.XP = window.XP || {};

document.addEventListener('DOMContentLoaded', function () {
  // 1. Initialize System Tray Clock
  if (window.XP.initClock) {
    window.XP.initClock();
  }

  // 2. Initialize Start Menu
  if (window.XP.initStartMenu) {
    window.XP.initStartMenu();
  }

  // 3. Wire Quick-Launch Explorer button
  const quickLaunchExplorer = document.getElementById('quick-launch-explorer');
  if (quickLaunchExplorer) {
    quickLaunchExplorer.addEventListener('click', function () {
      if (window.XP.openExplorer) {
        window.XP.openExplorer();
      }
    });
  }

  // 4. Handle viewport resize (keep maximized windows fitting screen)
  window.addEventListener('resize', function () {
    const isNarrow = window.innerWidth <= 700;
    const openWins = window.XP.getOpenWindows ? window.XP.getOpenWindows() : {};
    
    for (const id in openWins) {
      const win = openWins[id];
      if (isNarrow && !win.isMaximized) {
        win.el.classList.add('maximized');
      } else if (!isNarrow && win.isMaximized && !win.prevRect) {
        // Was opened on mobile, now widened
        win.el.classList.remove('maximized');
      }
    }
  });
});
