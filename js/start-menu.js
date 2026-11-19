/**
 * Windows XP Start Menu Controller
 * Handles toggling, opening windows, outside clicks, Escape key, and active button state.
 */

window.XP = window.XP || {};

(function () {
  let startMenuEl = null;
  let startButtonEl = null;

  function isOpen() {
    return startMenuEl && startMenuEl.classList.contains('open');
  }

  function openMenu() {
    if (!startMenuEl || !startButtonEl) return;
    startMenuEl.classList.add('open');
    startButtonEl.classList.add('active');
    startButtonEl.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    if (!startMenuEl || !startButtonEl) return;
    startMenuEl.classList.remove('open');
    startButtonEl.classList.remove('active');
    startButtonEl.setAttribute('aria-expanded', 'false');
  }

  function toggleMenu() {
    if (isOpen()) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  function initStartMenu() {
    startMenuEl = document.getElementById('start-menu');
    startButtonEl = document.getElementById('start-button');

    if (!startMenuEl || !startButtonEl) return;

    // Toggle on start button click
    startButtonEl.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleMenu();
    });

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (isOpen() && !startMenuEl.contains(e.target) && !startButtonEl.contains(e.target)) {
        closeMenu();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) {
        closeMenu();
        startButtonEl.focus();
      }
    });

    // Wire menu item clicks
    const items = startMenuEl.querySelectorAll('.start-menu-item');
    items.forEach(function (button) {
      button.addEventListener('click', function () {
        const windowId = button.getAttribute('data-window');
        closeMenu();
        if (windowId && window.XP.openWindow) {
          window.XP.openWindow(windowId);
        }
      });
    });
  }

  window.XP.initStartMenu = initStartMenu;
  window.XP.closeStartMenu = closeMenu;
  window.XP.openStartMenu = openMenu;
})();
