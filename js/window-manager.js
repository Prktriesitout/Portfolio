/**
 * Windows XP Window Manager
 * Handles window lifecycle: open, focus, drag, minimize, maximize/restore, close, cascade,
 * taskbar sync, and content loading.
 */

window.XP = window.XP || {};

(function () {
  const windows = {};
  let highestZIndex = 100;
  let cascadeX = 30;
  let cascadeY = 25;
  const CASCADE_STEP = 25;

  const WINDOW_CONFIGS = {
    'about-me': {
      title: 'About Me',
      icon: 'assets/icons/about-me.png',
      contentUrl: 'content/about-me.html',
      width: 540,
      height: 460
    },
    'credibility': {
      title: 'Credibility',
      icon: 'assets/icons/credibility.png',
      contentUrl: 'content/credibility.html',
      width: 580,
      height: 480
    },
    'projects': {
      title: 'Projects',
      icon: 'assets/icons/projects.png',
      contentUrl: 'content/projects.html',
      width: 620,
      height: 500
    },
    'contact': {
      title: 'Contact',
      icon: 'assets/icons/contact.png',
      contentUrl: 'content/contact.html',
      width: 440,
      height: 380
    }
  };

  function isNarrowScreen() {
    return window.innerWidth <= 700;
  }

  function getActiveWindowId() {
    let topId = null;
    let maxZ = -1;
    for (const id in windows) {
      const win = windows[id];
      if (!win.isMinimized && win.zIndex > maxZ) {
        maxZ = win.zIndex;
        topId = id;
      }
    }
    return topId;
  }

  function focusWindow(id) {
    const win = windows[id];
    if (!win) return;

    if (win.isMinimized) {
      restoreWindow(id);
    }

    highestZIndex += 1;
    win.zIndex = highestZIndex;
    win.el.style.zIndex = win.zIndex;

    // Update active / inactive styles for all windows
    for (const key in windows) {
      const w = windows[key];
      if (key === id) {
        w.el.classList.remove('inactive');
        if (w.taskbarBtn) w.taskbarBtn.classList.add('active');
      } else {
        w.el.classList.add('inactive');
        if (w.taskbarBtn) w.taskbarBtn.classList.remove('active');
      }
    }
  }

  function minimizeWindow(id) {
    const win = windows[id];
    if (!win) return;

    win.isMinimized = true;
    win.el.classList.add('minimized');
    if (win.taskbarBtn) win.taskbarBtn.classList.remove('active');

    // Focus the next topmost window
    const nextId = getActiveWindowId();
    if (nextId) {
      focusWindow(nextId);
    }
  }

  function restoreWindow(id) {
    const win = windows[id];
    if (!win) return;

    win.isMinimized = false;
    win.el.classList.remove('minimized');
  }

  function toggleMaximize(id) {
    const win = windows[id];
    if (!win) return;

    if (isNarrowScreen()) {
      return; // Always maximized on narrow screen
    }

    if (win.isMaximized) {
      win.el.classList.remove('maximized');
      win.el.style.left = win.prevRect.left;
      win.el.style.top = win.prevRect.top;
      win.el.style.width = win.prevRect.width;
      win.el.style.height = win.prevRect.height;
      win.isMaximized = false;
      const maxBtn = win.el.querySelector('.win-maximize');
      if (maxBtn) maxBtn.setAttribute('title', 'Maximize');
    } else {
      win.prevRect = {
        left: win.el.style.left,
        top: win.el.style.top,
        width: win.el.style.width,
        height: win.el.style.height
      };
      win.el.classList.add('maximized');
      win.isMaximized = true;
      const maxBtn = win.el.querySelector('.win-maximize');
      if (maxBtn) maxBtn.setAttribute('title', 'Restore');
    }
    focusWindow(id);
  }

  function closeWindow(id) {
    const win = windows[id];
    if (!win) return;

    if (win.el && win.el.parentNode) {
      win.el.parentNode.removeChild(win.el);
    }
    if (win.taskbarBtn && win.taskbarBtn.parentNode) {
      win.taskbarBtn.parentNode.removeChild(win.taskbarBtn);
    }

    delete windows[id];

    const nextId = getActiveWindowId();
    if (nextId) {
      focusWindow(nextId);
    }
  }

  function setupDraggable(win, titlebarEl) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initLeft = 0;
    let initTop = 0;

    titlebarEl.addEventListener('pointerdown', function (e) {
      // Don't drag if clicking buttons
      if (e.target.closest('.win-btn')) return;
      if (win.isMaximized || isNarrowScreen()) return;

      focusWindow(win.id);
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initLeft = win.el.offsetLeft;
      initTop = win.el.offsetTop;

      try {
        titlebarEl.setPointerCapture(e.pointerId);
      } catch (err) {
        // Fallback if pointer capture fails
      }
      e.preventDefault();
    });

    titlebarEl.addEventListener('pointermove', function (e) {
      if (!isDragging) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      let newLeft = initLeft + deltaX;
      let newTop = initTop + deltaY;

      const desktop = document.getElementById('desktop');
      const containerWidth = desktop ? desktop.clientWidth : window.innerWidth;
      const containerHeight = desktop ? desktop.clientHeight : window.innerHeight - 30;

      // Keep titlebar reachable, never let it go under taskbar
      // Minimum 60px of titlebar remains visible horizontally
      const minLeft = -win.el.offsetWidth + 60;
      const maxLeft = containerWidth - 60;
      const minTop = 0;
      const maxTop = Math.max(0, containerHeight - 30);

      newLeft = Math.max(minLeft, Math.min(newLeft, maxLeft));
      newTop = Math.max(minTop, Math.min(newTop, maxTop));

      win.el.style.left = newLeft + 'px';
      win.el.style.top = newTop + 'px';
    });

    function stopDrag(e) {
      if (isDragging) {
        isDragging = false;
        try {
          titlebarEl.releasePointerCapture(e.pointerId);
        } catch (err) {}
      }
    }

    titlebarEl.addEventListener('pointerup', stopDrag);
    titlebarEl.addEventListener('pointercancel', stopDrag);

    // Double click on title bar toggles maximize
    titlebarEl.addEventListener('dblclick', function (e) {
      if (e.target.closest('.win-btn')) return;
      toggleMaximize(win.id);
    });
  }

  function createTaskbarButton(win) {
    const taskbarContainer = document.getElementById('taskbar-windows');
    if (!taskbarContainer) return null;

    const btn = document.createElement('button');
    btn.className = 'taskbar-item active';
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-label', `${win.title} window`);
    btn.innerHTML = `<img src="${win.icon}" width="16" height="16" alt=""><span class="taskbar-item-title">${win.title}</span>`;

    btn.addEventListener('click', function () {
      if (win.isMinimized) {
        restoreWindow(win.id);
        focusWindow(win.id);
      } else {
        const activeId = getActiveWindowId();
        if (activeId === win.id) {
          minimizeWindow(win.id);
        } else {
          focusWindow(win.id);
        }
      }
    });

    taskbarContainer.appendChild(btn);
    return btn;
  }

  function calculateWindowPosition(width, height) {
    const desktop = document.getElementById('desktop');
    const screenW = desktop ? desktop.clientWidth : window.innerWidth;
    const screenH = desktop ? desktop.clientHeight : window.innerHeight - 30;

    if (isNarrowScreen()) {
      return { left: 0, top: 0, isMax: true };
    }

    let left = cascadeX;
    let top = cascadeY;

    if (left + width > screenW - 20 || top + height > screenH - 20) {
      cascadeX = 30;
      cascadeY = 25;
      left = cascadeX;
      top = cascadeY;
    }

    cascadeX += CASCADE_STEP;
    cascadeY += CASCADE_STEP;

    return { left, top, isMax: false };
  }

  function createWindowElement(config) {
    const winEl = document.createElement('div');
    winEl.className = 'xp-window';
    winEl.id = `window-${config.id}`;
    winEl.setAttribute('role', 'dialog');
    winEl.setAttribute('aria-label', config.title);

    const winWidth = Math.min(config.width || 560, window.innerWidth - 20);
    const winHeight = Math.min(config.height || 440, (window.innerHeight - 30) - 20);

    const pos = calculateWindowPosition(winWidth, winHeight);

    if (pos.isMax) {
      winEl.classList.add('maximized');
    } else {
      winEl.style.width = winWidth + 'px';
      winEl.style.height = winHeight + 'px';
      winEl.style.left = pos.left + 'px';
      winEl.style.top = pos.top + 'px';
    }

    winEl.innerHTML = `
      <div class="window-titlebar">
        <div class="titlebar-info">
          <img src="${config.icon}" width="16" height="16" class="titlebar-icon" alt="">
          <span class="titlebar-title">${config.title}</span>
        </div>
        <div class="window-controls">
          <button class="win-btn win-minimize" type="button" aria-label="Minimize" title="Minimize">
            <img src="assets/icons/btn-minimize.png" width="21" height="21" alt="">
          </button>
          <button class="win-btn win-maximize" type="button" aria-label="Maximize" title="Maximize">
            <img src="assets/icons/btn-maximize.png" width="21" height="21" alt="">
          </button>
          <button class="win-btn win-close" type="button" aria-label="Close" title="Close">
            <img src="assets/icons/btn-close.png" width="21" height="21" alt="">
          </button>
        </div>
      </div>
      <div class="window-body">
        <div class="window-content" id="content-${config.id}">
          <div class="window-state-box">
            <p>Loading...</p>
          </div>
        </div>
      </div>
    `;

    // Focus on window click
    winEl.addEventListener('pointerdown', function () {
      focusWindow(config.id);
    });

    return winEl;
  }

  function wireContentInteractivity(containerEl) {
    // Copy email button handling
    const copyBtn = containerEl.querySelector('#copy-email-btn');
    const feedback = containerEl.querySelector('#copy-email-feedback');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        const email = copyBtn.getAttribute('data-email') || 'pratyush7340@gmail.com';
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(email).then(showFeedback).catch(fallbackCopy);
        } else {
          fallbackCopy();
        }

        function showFeedback() {
          if (feedback) {
            feedback.classList.add('show');
            setTimeout(function () {
              feedback.classList.remove('show');
            }, 2500);
          }
        }

        function fallbackCopy() {
          try {
            const input = document.createElement('input');
            input.value = email;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            showFeedback();
          } catch (e) {
            alert('Email address: ' + email);
          }
        }
      });
    }
  }

  function loadWindowContent(id, contentUrl, containerEl) {
    if (!contentUrl || !containerEl) return;

    fetch(contentUrl)
      .then(function (response) {
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status} (${response.statusText})`);
        }
        return response.text();
      })
      .then(function (html) {
        containerEl.innerHTML = html;
        wireContentInteractivity(containerEl);
      })
      .catch(function (err) {
        containerEl.innerHTML = `
          <div class="window-state-box">
            <div class="window-error-box">
              <h3>Unable to load content</h3>
              <p>Failed to load ${contentUrl}</p>
              <p style="font-size: 11px; margin-top: 6px; color: #666;">${err.message}</p>
            </div>
          </div>
        `;
      });
  }

  function openWindow(id, customConfig) {
    // If window already open: focus it & restore if minimized
    if (windows[id]) {
      restoreWindow(id);
      focusWindow(id);
      return windows[id];
    }

    const config = Object.assign({}, WINDOW_CONFIGS[id] || {}, customConfig || {}, { id: id });
    if (!config.title) config.title = id;
    if (!config.icon) config.icon = 'assets/icons/explorer.png';

    const winContainer = document.getElementById('window-container');
    if (!winContainer) return null;

    const winEl = createWindowElement(config);
    winContainer.appendChild(winEl);

    const win = {
      id: id,
      title: config.title,
      icon: config.icon,
      el: winEl,
      taskbarBtn: null,
      isMinimized: false,
      isMaximized: winEl.classList.contains('maximized'),
      prevRect: {
        left: winEl.style.left,
        top: winEl.style.top,
        width: winEl.style.width,
        height: winEl.style.height
      },
      zIndex: highestZIndex
    };

    win.taskbarBtn = createTaskbarButton(win);
    windows[id] = win;

    // Window controls wiring
    const titlebarEl = winEl.querySelector('.window-titlebar');
    const minBtn = winEl.querySelector('.win-minimize');
    const maxBtn = winEl.querySelector('.win-maximize');
    const closeBtn = winEl.querySelector('.win-close');

    setupDraggable(win, titlebarEl);

    if (minBtn) {
      minBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        minimizeWindow(id);
      });
    }

    if (maxBtn) {
      maxBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleMaximize(id);
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        closeWindow(id);
      });
    }

    focusWindow(id);

    // If custom render callback is provided, invoke it
    if (config.renderContent) {
      const contentEl = winEl.querySelector(`#content-${id}`);
      config.renderContent(contentEl, win);
    } else if (config.contentUrl) {
      const contentEl = winEl.querySelector(`#content-${id}`);
      loadWindowContent(id, config.contentUrl, contentEl);
    }

    return win;
  }

  window.XP.openWindow = openWindow;
  window.XP.focusWindow = focusWindow;
  window.XP.minimizeWindow = minimizeWindow;
  window.XP.restoreWindow = restoreWindow;
  window.XP.closeWindow = closeWindow;
  window.XP.getOpenWindows = function () { return windows; };
})();
