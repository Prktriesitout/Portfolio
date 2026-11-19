/**
 * Windows XP "My Certifications" Explorer Controller
 * Implements two-pane Explorer shell, collapsible task panels, thumbnails & details views,
 * live search, category filtering, sortable table, keyboard navigation, and context menus.
 */

window.XP = window.XP || {};

(function () {
  let certManifest = null;

  function loadManifest(callback) {
    if (certManifest) {
      if (callback) callback(null, certManifest);
      return;
    }

    fetch('certifications/manifest.json')
      .then(function (res) {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      })
      .then(function (data) {
        certManifest = data;
        if (callback) callback(null, certManifest);
      })
      .catch(function (err) {
        if (callback) callback(err, null);
      });
  }

  function renderCertifications(containerEl) {
    containerEl.innerHTML = '';
    containerEl.style.padding = '0';
    containerEl.style.display = 'flex';
    containerEl.style.flexDirection = 'column';

    // State
    let currentCategory = 'All';
    let searchQuery = '';
    let viewMode = 'thumbnails'; // 'thumbnails' or 'details'
    let selectedCertId = null;
    let sortColumn = 'date';
    let sortAsc = false; // default newest first
    let history = ['All'];
    let historyIndex = 0;

    // Shell Layout
    const shell = document.createElement('div');
    shell.className = 'cert-explorer-layout';

    // 1. Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'explorer-toolbar';

    const backBtn = document.createElement('button');
    backBtn.className = 'explorer-toolbar-btn';
    backBtn.type = 'button';
    backBtn.innerHTML = '<img src="assets/icons/back.png" width="16" height="16" alt=""><span>Back</span>';
    backBtn.title = 'Back';
    toolbar.appendChild(backBtn);

    const fwdBtn = document.createElement('button');
    fwdBtn.className = 'explorer-toolbar-btn';
    fwdBtn.type = 'button';
    fwdBtn.innerHTML = '<img src="assets/icons/forward.png" width="16" height="16" alt=""><span>Forward</span>';
    fwdBtn.title = 'Forward';
    toolbar.appendChild(fwdBtn);

    const sep1 = document.createElement('div');
    sep1.className = 'toolbar-separator';
    toolbar.appendChild(sep1);

    const viewToggleBtn = document.createElement('button');
    viewToggleBtn.className = 'explorer-toolbar-btn';
    viewToggleBtn.type = 'button';
    viewToggleBtn.innerHTML = '<img src="assets/icons/folder.png" width="16" height="16" alt=""><span>View: Thumbnails</span>';
    viewToggleBtn.title = 'Toggle Views (Thumbnails / Details)';
    toolbar.appendChild(viewToggleBtn);

    // Live Search
    const searchWrapper = document.createElement('div');
    searchWrapper.className = 'cert-search-wrapper';
    searchWrapper.innerHTML = `
      <span style="color:#666; font-size:11px;">🔍</span>
      <input type="text" class="cert-search-input" placeholder="Search certifications..." aria-label="Search certifications">
      <button type="button" class="cert-search-clear" title="Clear search" aria-label="Clear search">&times;</button>
    `;
    toolbar.appendChild(searchWrapper);
    shell.appendChild(toolbar);

    const searchInput = searchWrapper.querySelector('.cert-search-input');
    const searchClear = searchWrapper.querySelector('.cert-search-clear');

    // 2. Address Bar
    const addressBar = document.createElement('div');
    addressBar.className = 'explorer-address-bar';
    addressBar.innerHTML = `
      <span class="address-label">Address</span>
      <div class="address-input-box">
        <img src="assets/icons/folder.png" alt="" width="16" height="16">
        <span class="address-text" id="cert-address-text">C:\\Certifications</span>
      </div>
    `;
    shell.appendChild(addressBar);
    const addressText = addressBar.querySelector('#cert-address-text');

    // 3. Body Layout: Left Task Pane + Main Pane
    const bodyLayout = document.createElement('div');
    bodyLayout.className = 'cert-body-layout';

    // Left Task Pane
    const taskPane = document.createElement('div');
    taskPane.className = 'cert-task-pane';
    bodyLayout.appendChild(taskPane);

    // Main Content Pane
    const mainPane = document.createElement('div');
    mainPane.className = 'cert-main-pane';
    mainPane.setAttribute('tabindex', '0');
    mainPane.setAttribute('role', 'region');
    mainPane.setAttribute('aria-label', 'Certifications List');
    bodyLayout.appendChild(mainPane);

    shell.appendChild(bodyLayout);

    // 4. Status Bar
    const statusBar = document.createElement('div');
    statusBar.className = 'window-statusbar';
    statusBar.innerHTML = `
      <div class="statusbar-panel" id="cert-status-count">Loading objects...</div>
      <div class="statusbar-panel" id="cert-status-detail" style="flex:1;">Select a certificate to view details</div>
    `;
    shell.appendChild(statusBar);
    const statusCount = statusBar.querySelector('#cert-status-count');
    const statusDetail = statusBar.querySelector('#cert-status-detail');

    containerEl.appendChild(shell);

    // Context Menu Container
    let contextMenuEl = null;
    function removeContextMenu() {
      if (contextMenuEl && contextMenuEl.parentNode) {
        contextMenuEl.parentNode.removeChild(contextMenuEl);
        contextMenuEl = null;
      }
    }

    document.addEventListener('click', removeContextMenu);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') removeContextMenu();
    });

    function getSelectedCert() {
      if (!certManifest || !selectedCertId) return null;
      return certManifest.find(function (c) { return c.id === selectedCertId; }) || null;
    }

    function openCertificate(cert) {
      if (!cert) return;
      const fileUrl = encodeURI(cert.file);
      if (cert.type === 'pdf') {
        if (window.XP.openPDFViewer) {
          window.XP.openPDFViewer(fileUrl, cert.title);
        }
      } else {
        if (window.XP.openImageViewer) {
          window.XP.openImageViewer(fileUrl, cert.title);
        }
      }
    }

    function getCategoriesList() {
      if (!certManifest) return [];
      const cats = {};
      certManifest.forEach(function (c) {
        cats[c.category] = (cats[c.category] || 0) + 1;
      });
      return cats;
    }

    function getFilteredCertificates() {
      if (!certManifest) return [];
      let list = certManifest.slice();

      // Category filter
      if (currentCategory !== 'All') {
        list = list.filter(function (c) { return c.category === currentCategory; });
      }

      // Search query filter
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        list = list.filter(function (c) {
          return c.title.toLowerCase().includes(q) ||
                 c.issuer.toLowerCase().includes(q) ||
                 c.category.toLowerCase().includes(q);
        });
      }

      // Sorting
      list.sort(function (a, b) {
        let valA = a[sortColumn] || '';
        let valB = b[sortColumn] || '';
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });

      return list;
    }

    function updateNavState() {
      backBtn.disabled = historyIndex <= 0;
      fwdBtn.disabled = historyIndex >= history.length - 1;
      const catText = currentCategory === 'All' ? '' : `\\${currentCategory}`;
      addressText.textContent = `C:\\Certifications${catText}`;
    }

    function renderTaskPane() {
      taskPane.innerHTML = '';
      const selected = getSelectedCert();

      // Box 1: Certification Tasks
      const tasksBox = document.createElement('div');
      tasksBox.className = 'xp-task-box';
      tasksBox.innerHTML = `
        <div class="xp-task-header" role="button" tabindex="0" aria-label="Toggle Certification Tasks">
          <span>Certification Tasks</span>
          <span class="xp-task-chevron">▲</span>
        </div>
        <div class="xp-task-body">
          <button class="xp-task-link" id="task-open" type="button" ${!selected ? 'disabled' : ''}>
            <span class="xp-task-icon">▶</span>
            <span>Open Certificate</span>
          </button>
          <a class="xp-task-link" id="task-open-tab" ${selected ? `href="${encodeURI(selected.file)}" target="_blank" rel="noopener noreferrer"` : 'style="pointer-events:none; opacity:0.45;"'}>
            <span class="xp-task-icon">↗</span>
            <span>Open in New Tab</span>
          </a>
          <a class="xp-task-link" id="task-download" ${selected ? `href="${encodeURI(selected.file)}" download="${selected.title}"` : 'style="pointer-events:none; opacity:0.45;"'}>
            <span class="xp-task-icon">💾</span>
            <span>Download File</span>
          </a>
          ${selected && selected.credentialUrl ? `
            <a class="xp-task-link" href="${selected.credentialUrl}" target="_blank" rel="noopener noreferrer" style="color:#0055ea; font-weight:bold;">
              <span class="xp-task-icon">✔</span>
              <span>Verify Credential</span>
            </a>
          ` : ''}
        </div>
      `;
      wireCollapsible(tasksBox);
      const openBtn = tasksBox.querySelector('#task-open');
      if (openBtn) {
        openBtn.addEventListener('click', function () {
          if (selected) openCertificate(selected);
        });
      }
      taskPane.appendChild(tasksBox);

      // Box 2: Categories
      const catBox = document.createElement('div');
      catBox.className = 'xp-task-box';
      const catCounts = getCategoriesList();
      let catItemsHtml = `
        <div class="xp-category-item ${currentCategory === 'All' ? 'active' : ''}" data-category="All">
          <span>All Certifications</span>
          <span class="xp-cat-count">${certManifest ? certManifest.length : 0}</span>
        </div>
      `;
      for (const catName in catCounts) {
        catItemsHtml += `
          <div class="xp-category-item ${currentCategory === catName ? 'active' : ''}" data-category="${catName}">
            <span>${catName}</span>
            <span class="xp-cat-count">${catCounts[catName]}</span>
          </div>
        `;
      }

      catBox.innerHTML = `
        <div class="xp-task-header" role="button" tabindex="0" aria-label="Toggle Categories">
          <span>Categories</span>
          <span class="xp-task-chevron">▲</span>
        </div>
        <div class="xp-task-body">${catItemsHtml}</div>
      `;
      wireCollapsible(catBox);

      catBox.querySelectorAll('.xp-category-item').forEach(function (el) {
        el.addEventListener('click', function () {
          const cat = el.getAttribute('data-category');
          if (cat !== currentCategory) {
            history = history.slice(0, historyIndex + 1);
            history.push(cat);
            historyIndex++;
            currentCategory = cat;
            selectedCertId = null;
            renderAll();
          }
        });
      });
      taskPane.appendChild(catBox);

      // Box 3: Details
      const detailsBox = document.createElement('div');
      detailsBox.className = 'xp-task-box secondary';
      let detailsHtml = `
        <div class="xp-task-header" role="button" tabindex="0" aria-label="Toggle Details">
          <span>Details</span>
          <span class="xp-task-chevron">▲</span>
        </div>
        <div class="xp-task-body">
      `;

      if (selected) {
        detailsHtml += `
          <div class="cert-details-card">
            <div class="cert-details-preview">
              ${selected.type === 'image' 
                ? `<img src="${encodeURI(selected.file)}" alt="${selected.title}" loading="lazy">` 
                : `<img src="assets/icons/pdf.png" alt="PDF" width="36" height="36">`
              }
            </div>
            <div class="cert-details-title">${selected.title}</div>
            <div class="cert-details-meta"><strong>Issuer:</strong> ${selected.issuer}</div>
            <div class="cert-details-meta"><strong>Date:</strong> ${selected.date}</div>
            <div class="cert-details-meta"><strong>Category:</strong> ${selected.category}</div>
            <div class="cert-details-meta"><strong>Format:</strong> ${selected.type.toUpperCase()}</div>
            ${selected.credentialUrl ? `
              <a href="${selected.credentialUrl}" target="_blank" rel="noopener noreferrer" class="cert-verify-link">
                ✔ Verify Credential
              </a>
            ` : ''}
          </div>
        `;
      } else {
        detailsHtml += `
          <div style="color: #666; font-style: italic; padding: 4px 0;">
            Click any certificate to preview details, download, or verify credentials.
          </div>
        `;
      }

      detailsHtml += `</div>`;
      detailsBox.innerHTML = detailsHtml;
      wireCollapsible(detailsBox);
      taskPane.appendChild(detailsBox);
    }

    function wireCollapsible(boxEl) {
      const header = boxEl.querySelector('.xp-task-header');
      if (!header) return;
      header.addEventListener('click', function () {
        boxEl.classList.toggle('collapsed');
      });
      header.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          boxEl.classList.toggle('collapsed');
        }
      });
    }

    function showContextMenu(e, cert) {
      e.preventDefault();
      removeContextMenu();

      selectedCertId = cert.id;
      renderAll();

      const menu = document.createElement('div');
      menu.className = 'xp-context-menu';
      menu.style.left = e.clientX + 'px';
      menu.style.top = e.clientY + 'px';

      menu.innerHTML = `
        <button class="xp-context-item" id="ctx-open"><strong>Open</strong></button>
        <button class="xp-context-item" id="ctx-open-tab">Open in New Tab</button>
        <button class="xp-context-item" id="ctx-download">Download</button>
        ${cert.credentialUrl ? `
          <div class="xp-context-separator"></div>
          <button class="xp-context-item" id="ctx-verify" style="color:#0055ea; font-weight:bold;">Verify Credential</button>
        ` : ''}
      `;

      menu.querySelector('#ctx-open').addEventListener('click', function () {
        openCertificate(cert);
        removeContextMenu();
      });

      menu.querySelector('#ctx-open-tab').addEventListener('click', function () {
        window.open(encodeURI(cert.file), '_blank', 'noopener,noreferrer');
        removeContextMenu();
      });

      menu.querySelector('#ctx-download').addEventListener('click', function () {
        const a = document.createElement('a');
        a.href = encodeURI(cert.file);
        a.download = cert.title;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        removeContextMenu();
      });

      if (cert.credentialUrl) {
        menu.querySelector('#ctx-verify').addEventListener('click', function () {
          window.open(cert.credentialUrl, '_blank', 'noopener,noreferrer');
          removeContextMenu();
        });
      }

      document.body.appendChild(menu);
      contextMenuEl = menu;

      // Ensure menu remains in viewport
      const rect = menu.getBoundingClientRect();
      if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 4) + 'px';
      if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 4) + 'px';
    }

    function renderMainPane() {
      mainPane.innerHTML = '';
      const certs = getFilteredCertificates();

      // Update status bar
      statusCount.textContent = `${certs.length} object(s)${searchQuery ? ` (filtered from ${certManifest.length})` : ''}`;
      const selected = getSelectedCert();
      if (selected) {
        statusDetail.textContent = `Selected: ${selected.title} [${selected.type.toUpperCase()}]`;
      } else {
        statusDetail.textContent = 'Select an item to view details';
      }

      if (certs.length === 0) {
        mainPane.innerHTML = `
          <div class="window-state-box" style="padding: 30px; text-align: center; color: #555;">
            <div style="font-size: 24px; margin-bottom: 8px;">📂</div>
            <strong>No certificates found</strong>
            <p style="font-size: 11px; margin-top: 4px; color: #777;">
              ${searchQuery ? `No matches for "${searchQuery}". Try a different search keyword.` : 'This category contains no items.'}
            </p>
          </div>
        `;
        return;
      }

      if (viewMode === 'thumbnails') {
        renderThumbnailsView(certs);
      } else {
        renderDetailsView(certs);
      }
    }

    function renderThumbnailsView(certs) {
      const grid = document.createElement('div');
      grid.className = 'cert-thumbnails-grid';

      certs.forEach(function (cert, idx) {
        const card = document.createElement('div');
        card.className = `cert-card ${cert.id === selectedCertId ? 'selected' : ''}`;
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `${cert.title} by ${cert.issuer}`);

        let thumbHtml = '';
        if (cert.type === 'image') {
          thumbHtml = `<img src="${encodeURI(cert.file)}" alt="${cert.title}" loading="lazy" style="width:100%; height:100%; object-fit:cover;">`;
        } else {
          thumbHtml = `
            <div class="cert-thumb-placeholder">
              <div class="cert-thumb-badge">${cert.issuer}</div>
              <img src="assets/icons/pdf.png" class="cert-thumb-icon" width="28" height="28" alt="PDF">
              <div class="cert-thumb-footer">${cert.date}</div>
            </div>
          `;
        }

        card.innerHTML = `
          <div class="cert-thumb-box">${thumbHtml}</div>
          <div class="cert-card-title">${cert.title}</div>
          <div class="cert-card-issuer">${cert.issuer} &bull; ${cert.date}</div>
        `;

        card.addEventListener('click', function (e) {
          e.stopPropagation();
          selectedCertId = cert.id;
          renderAll();
        });

        card.addEventListener('dblclick', function (e) {
          e.stopPropagation();
          openCertificate(cert);
        });

        card.addEventListener('contextmenu', function (e) {
          showContextMenu(e, cert);
        });

        card.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            openCertificate(cert);
          } else if (e.key === 'ArrowRight' && idx < certs.length - 1) {
            e.preventDefault();
            selectedCertId = certs[idx + 1].id;
            renderAll();
          } else if (e.key === 'ArrowLeft' && idx > 0) {
            e.preventDefault();
            selectedCertId = certs[idx - 1].id;
            renderAll();
          }
        });

        grid.appendChild(card);
      });

      mainPane.appendChild(grid);
    }

    function renderDetailsView(certs) {
      const table = document.createElement('table');
      table.className = 'cert-table';

      const sortArrow = function (col) {
        if (sortColumn !== col) return '';
        return `<span class="sort-indicator">${sortAsc ? '▲' : '▼'}</span>`;
      };

      table.innerHTML = `
        <thead>
          <tr>
            <th data-col="title">Name ${sortArrow('title')}</th>
            <th data-col="issuer" style="width:140px;">Issuer ${sortArrow('issuer')}</th>
            <th data-col="date" style="width:90px;">Date ${sortArrow('date')}</th>
            <th data-col="category" style="width:130px;">Category ${sortArrow('category')}</th>
            <th data-col="type" style="width:60px;">Type ${sortArrow('type')}</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;

      table.querySelectorAll('th').forEach(function (th) {
        th.addEventListener('click', function () {
          const col = th.getAttribute('data-col');
          if (sortColumn === col) {
            sortAsc = !sortAsc;
          } else {
            sortColumn = col;
            sortAsc = true;
          }
          renderMainPane();
        });
      });

      const tbody = table.querySelector('tbody');
      certs.forEach(function (cert, idx) {
        const tr = document.createElement('tr');
        if (cert.id === selectedCertId) tr.className = 'selected';
        tr.setAttribute('tabindex', '0');

        tr.innerHTML = `
          <td><strong>${cert.title}</strong></td>
          <td>${cert.issuer}</td>
          <td>${cert.date}</td>
          <td>${cert.category}</td>
          <td>${cert.type.toUpperCase()}</td>
        `;

        tr.addEventListener('click', function (e) {
          e.stopPropagation();
          selectedCertId = cert.id;
          renderAll();
        });

        tr.addEventListener('dblclick', function (e) {
          e.stopPropagation();
          openCertificate(cert);
        });

        tr.addEventListener('contextmenu', function (e) {
          showContextMenu(e, cert);
        });

        tr.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            openCertificate(cert);
          } else if (e.key === 'ArrowDown' && idx < certs.length - 1) {
            e.preventDefault();
            selectedCertId = certs[idx + 1].id;
            renderAll();
          } else if (e.key === 'ArrowUp' && idx > 0) {
            e.preventDefault();
            selectedCertId = certs[idx - 1].id;
            renderAll();
          }
        });

        tbody.appendChild(tr);
      });

      mainPane.appendChild(table);
    }

    function renderAll() {
      updateNavState();
      renderTaskPane();
      renderMainPane();
    }

    // View Toggle
    viewToggleBtn.addEventListener('click', function () {
      viewMode = viewMode === 'thumbnails' ? 'details' : 'thumbnails';
      viewToggleBtn.querySelector('span').textContent = `View: ${viewMode === 'thumbnails' ? 'Thumbnails' : 'Details'}`;
      renderMainPane();
    });

    // History Navigation
    backBtn.addEventListener('click', function () {
      if (historyIndex > 0) {
        historyIndex--;
        currentCategory = history[historyIndex];
        selectedCertId = null;
        renderAll();
      }
    });

    fwdBtn.addEventListener('click', function () {
      if (historyIndex < history.length - 1) {
        historyIndex++;
        currentCategory = history[historyIndex];
        selectedCertId = null;
        renderAll();
      }
    });

    // Live Search
    searchInput.addEventListener('input', function () {
      searchQuery = searchInput.value;
      if (searchQuery.length > 0) {
        searchClear.classList.add('show');
      } else {
        searchClear.classList.remove('show');
      }
      renderMainPane();
    });

    searchClear.addEventListener('click', function () {
      searchInput.value = '';
      searchQuery = '';
      searchClear.classList.remove('show');
      searchInput.focus();
      renderMainPane();
    });

    // Load Manifest
    loadManifest(function (err) {
      if (err) {
        mainPane.innerHTML = `
          <div class="window-state-box">
            <div class="window-error-box">
              <h3>Error loading certifications manifest</h3>
              <p>Failed to load certifications/manifest.json</p>
              <p style="font-size: 11px; margin-top: 6px; color: #666;">${err.message}</p>
            </div>
          </div>
        `;
        statusCount.textContent = 'Error loading manifest';
        return;
      }
      renderAll();
    });
  }

  window.XP.renderCertifications = renderCertifications;
})();
