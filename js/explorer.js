/**
 * Windows XP File Explorer
 * Reads folder and file structure from data/file-index.json.
 * Handles folder navigation, history stack (back/forward/up), address bar, item selection,
 * touch single-tap / double-click activation, and launches PDF/CSV viewers.
 */

window.XP = window.XP || {};

(function () {
  let fileIndex = null;
  let history = ['root'];
  let historyIndex = 0;
  let selectedItemIndex = null;

  function loadFileIndex(callback) {
    if (fileIndex) {
      if (callback) callback(null, fileIndex);
      return;
    }

    fetch('data/file-index.json')
      .then(function (res) {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      })
      .then(function (data) {
        fileIndex = data;
        if (callback) callback(null, fileIndex);
      })
      .catch(function (err) {
        if (callback) callback(err, null);
      });
  }

  function getFolderItems(folderKey) {
    if (!fileIndex) return [];
    if (folderKey === 'root') {
      return fileIndex.root || [];
    }
    return (fileIndex.folders && fileIndex.folders[folderKey]) || [];
  }

  function getFolderPathText(folderKey) {
    if (folderKey === 'root') return 'My Portfolio';
    if (folderKey === 'resume') return 'My Portfolio\\Resume';
    if (folderKey === 'datasets') return 'My Portfolio\\Datasets';
    return `My Portfolio\\${folderKey}`;
  }

  function openPDFViewer(filePath, fileName) {
    const cleanId = 'pdf-view-' + fileName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    window.XP.openWindow(cleanId, {
      title: `${fileName} - PDF Viewer`,
      icon: 'assets/icons/pdf.png',
      width: 720,
      height: 520,
      renderContent: function (containerEl) {
        containerEl.innerHTML = '';
        containerEl.style.padding = '0';
        containerEl.style.display = 'flex';
        containerEl.style.flexDirection = 'column';

        const wrapper = document.createElement('div');
        wrapper.className = 'pdf-viewer-container';

        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'pdf-toolbar';

        const metaInfo = document.createElement('div');
        metaInfo.className = 'csv-meta-info';
        const nameSpan = document.createElement('strong');
        nameSpan.textContent = fileName;
        metaInfo.appendChild(nameSpan);
        toolbar.appendChild(metaInfo);

        const actionsDiv = document.createElement('div');
        actionsDiv.style.display = 'flex';
        actionsDiv.style.gap = '8px';

        const openTabLink = document.createElement('a');
        openTabLink.className = 'xp-button';
        openTabLink.href = filePath;
        openTabLink.target = '_blank';
        openTabLink.rel = 'noopener noreferrer';
        openTabLink.textContent = 'Open in New Tab';
        actionsDiv.appendChild(openTabLink);

        const downloadLink = document.createElement('a');
        downloadLink.className = 'xp-button';
        downloadLink.href = filePath;
        downloadLink.setAttribute('download', fileName);
        downloadLink.innerHTML = `<img src="assets/icons/pdf.png" width="16" height="16" alt="" style="vertical-align: middle;"> Download PDF`;
        actionsDiv.appendChild(downloadLink);

        toolbar.appendChild(actionsDiv);
        wrapper.appendChild(toolbar);

        // Frame wrapper
        const frameWrapper = document.createElement('div');
        frameWrapper.className = 'pdf-frame-wrapper';

        const iframe = document.createElement('iframe');
        iframe.className = 'pdf-frame';
        iframe.src = filePath;
        iframe.title = `PDF Document - ${fileName}`;
        frameWrapper.appendChild(iframe);

        wrapper.appendChild(frameWrapper);
        containerEl.appendChild(wrapper);
      }
    });
  }

  function renderExplorer(containerEl) {
    containerEl.innerHTML = '';
    containerEl.style.padding = '0';
    containerEl.style.display = 'flex';
    containerEl.style.flexDirection = 'column';

    const layout = document.createElement('div');
    layout.className = 'explorer-window-layout';

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'explorer-toolbar';

    const backBtn = document.createElement('button');
    backBtn.className = 'explorer-toolbar-btn';
    backBtn.innerHTML = '<img src="assets/icons/back.png" width="16" height="16" alt=""><span>Back</span>';
    backBtn.title = 'Back';
    toolbar.appendChild(backBtn);

    const fwdBtn = document.createElement('button');
    fwdBtn.className = 'explorer-toolbar-btn';
    fwdBtn.innerHTML = '<img src="assets/icons/forward.png" width="16" height="16" alt=""><span>Forward</span>';
    fwdBtn.title = 'Forward';
    toolbar.appendChild(fwdBtn);

    const upBtn = document.createElement('button');
    upBtn.className = 'explorer-toolbar-btn';
    upBtn.innerHTML = '<img src="assets/icons/up.png" width="16" height="16" alt=""><span>Up</span>';
    upBtn.title = 'Up to parent folder';
    toolbar.appendChild(upBtn);

    layout.appendChild(toolbar);

    // Address Bar
    const addressBar = document.createElement('div');
    addressBar.className = 'explorer-address-bar';

    const addrLabel = document.createElement('span');
    addrLabel.className = 'address-label';
    addrLabel.textContent = 'Address';
    addressBar.appendChild(addrLabel);

    const addrBox = document.createElement('div');
    addrBox.className = 'address-input-box';

    const addrIcon = document.createElement('img');
    addrIcon.src = 'assets/icons/folder.png';
    addrIcon.alt = '';
    addrBox.appendChild(addrIcon);

    const addrText = document.createElement('span');
    addrText.className = 'address-text';
    addrBox.appendChild(addrText);

    addressBar.appendChild(addrBox);
    layout.appendChild(addressBar);

    // Main Pane
    const pane = document.createElement('div');
    pane.className = 'explorer-pane';
    layout.appendChild(pane);

    // Status bar
    const statusBar = document.createElement('div');
    statusBar.className = 'window-statusbar';
    const statusCount = document.createElement('div');
    statusCount.className = 'statusbar-panel';
    statusBar.appendChild(statusCount);
    layout.appendChild(statusBar);

    containerEl.appendChild(layout);

    function updateNavState() {
      backBtn.disabled = historyIndex <= 0;
      fwdBtn.disabled = historyIndex >= history.length - 1;
      upBtn.disabled = history[historyIndex] === 'root';
    }

    function renderCurrentFolder() {
      const currentKey = history[historyIndex];
      addrText.textContent = getFolderPathText(currentKey);
      addrIcon.src = currentKey === 'root' ? 'assets/icons/explorer.png' : 'assets/icons/folder-open.png';
      updateNavState();

      pane.innerHTML = '';
      selectedItemIndex = null;

      const items = getFolderItems(currentKey);
      statusCount.textContent = `${items.length} object(s)`;

      if (items.length === 0) {
        pane.innerHTML = '<div style="padding: 20px; color: #666; text-align: center;">This folder is empty.</div>';
        return;
      }

      const grid = document.createElement('div');
      grid.className = 'explorer-grid';

      items.forEach(function (item, idx) {
        const itemBtn = document.createElement('button');
        itemBtn.className = 'explorer-item';
        itemBtn.setAttribute('type', 'button');
        itemBtn.setAttribute('tabindex', '0');
        itemBtn.setAttribute('aria-label', `${item.name} (${item.type})`);

        let iconSrc = 'assets/icons/folder.png';
        if (item.type === 'pdf') iconSrc = 'assets/icons/pdf.png';
        if (item.type === 'csv') iconSrc = 'assets/icons/csv.png';

        itemBtn.innerHTML = `
          <img src="${iconSrc}" width="32" height="32" alt="">
          <span class="explorer-item-name">${item.name}</span>
        `;

        function handleActivate() {
          if (item.type === 'folder') {
            navigateTo(item.path);
          } else if (item.type === 'pdf') {
            openPDFViewer(item.path, item.name);
          } else if (item.type === 'csv') {
            if (window.XP.openCSVViewer) {
              window.XP.openCSVViewer(item.path, item.name);
            }
          }
        }

        // Selection handling
        itemBtn.addEventListener('click', function (e) {
          // Deselect previous
          const currentSelected = grid.querySelector('.explorer-item.selected');
          if (currentSelected) currentSelected.classList.remove('selected');
          itemBtn.classList.add('selected');
          selectedItemIndex = idx;
        });

        // Double click activation for mouse/pen
        itemBtn.addEventListener('dblclick', function (e) {
          e.preventDefault();
          handleActivate();
        });

        // Touch support: single tap activates if touch pointer
        itemBtn.addEventListener('pointerup', function (e) {
          if (e.pointerType === 'touch') {
            handleActivate();
          }
        });

        // Keyboard Enter activation
        itemBtn.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleActivate();
          }
        });

        grid.appendChild(itemBtn);
      });

      pane.appendChild(grid);
    }

    function navigateTo(folderKey) {
      history = history.slice(0, historyIndex + 1);
      history.push(folderKey);
      historyIndex++;
      renderCurrentFolder();
    }

    backBtn.addEventListener('click', function () {
      if (historyIndex > 0) {
        historyIndex--;
        renderCurrentFolder();
      }
    });

    fwdBtn.addEventListener('click', function () {
      if (historyIndex < history.length - 1) {
        historyIndex++;
        renderCurrentFolder();
      }
    });

    upBtn.addEventListener('click', function () {
      if (history[historyIndex] !== 'root') {
        navigateTo('root');
      }
    });

    loadFileIndex(function (err) {
      if (err) {
        pane.innerHTML = `
          <div class="window-state-box">
            <div class="window-error-box">
              <h3>Error loading file index</h3>
              <p>Failed to load data/file-index.json</p>
              <p style="font-size: 11px; margin-top: 6px; color: #666;">${err.message}</p>
            </div>
          </div>
        `;
        return;
      }
      renderCurrentFolder();
    });
  }

  function openExplorer() {
    window.XP.openWindow('explorer', {
      title: 'File Explorer',
      icon: 'assets/icons/explorer.png',
      width: 660,
      height: 460,
      renderContent: function (containerEl) {
        renderExplorer(containerEl);
      }
    });
  }

  window.XP.openExplorer = openExplorer;
  window.XP.openPDFViewer = openPDFViewer;
})();
