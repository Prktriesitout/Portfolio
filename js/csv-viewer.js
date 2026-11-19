/**
 * Windows XP CSV Viewer
 * Parses CSV (quoted fields, commas, escaped quotes, CRLF/LF) without external libraries.
 * Renders up to 200 rows safely with textContent, displays row/col counts and download button.
 */

window.XP = window.XP || {};

(function () {
  function parseCSV(text) {
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;
    let i = 0;
    const len = text.length;

    while (i < len) {
      const char = text[i];
      const nextChar = i + 1 < len ? text[i + 1] : null;

      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            // Escaped quote: ""
            currentCell += '"';
            i += 2;
            continue;
          } else {
            inQuotes = false;
            i += 1;
            continue;
          }
        } else {
          currentCell += char;
          i += 1;
          continue;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
          i += 1;
          continue;
        } else if (char === ',') {
          currentRow.push(currentCell);
          currentCell = '';
          i += 1;
          continue;
        } else if (char === '\r') {
          if (nextChar === '\n') {
            i += 1;
          }
          currentRow.push(currentCell);
          rows.push(currentRow);
          currentRow = [];
          currentCell = '';
          i += 1;
          continue;
        } else if (char === '\n') {
          currentRow.push(currentCell);
          rows.push(currentRow);
          currentRow = [];
          currentCell = '';
          i += 1;
          continue;
        } else {
          currentCell += char;
          i += 1;
          continue;
        }
      }
    }

    if (currentCell !== '' || currentRow.length > 0) {
      currentRow.push(currentCell);
      rows.push(currentRow);
    }

    // Clean up possible trailing blank row
    if (rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0].trim() === '') {
      rows.pop();
    }

    return rows;
  }

  function renderCSV(containerEl, filePath, fileName) {
    fetch(filePath)
      .then(function (res) {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.text();
      })
      .then(function (rawText) {
        if (!rawText || rawText.trim() === '') {
          containerEl.innerHTML = `
            <div class="window-state-box">
              <p>The CSV file <strong>${fileName}</strong> is empty.</p>
            </div>
          `;
          return;
        }

        const rows = parseCSV(rawText);
        if (rows.length === 0) {
          containerEl.innerHTML = `
            <div class="window-state-box">
              <p>No tabular data found in <strong>${fileName}</strong>.</p>
            </div>
          `;
          return;
        }

        const headers = rows[0];
        const dataRows = rows.slice(1);
        const totalRows = dataRows.length;
        const totalCols = headers.length;
        const rowsToDisplay = dataRows.slice(0, 200);

        containerEl.innerHTML = '';
        containerEl.style.padding = '0';
        containerEl.style.display = 'flex';
        containerEl.style.flexDirection = 'column';

        const wrapper = document.createElement('div');
        wrapper.className = 'csv-viewer-container';

        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'csv-toolbar';

        const metaInfo = document.createElement('div');
        metaInfo.className = 'csv-meta-info';

        const nameSpan = document.createElement('strong');
        nameSpan.textContent = fileName;
        metaInfo.appendChild(nameSpan);

        const rowsBadge = document.createElement('span');
        rowsBadge.className = 'csv-badge';
        rowsBadge.textContent = `${totalRows.toLocaleString()} rows`;
        metaInfo.appendChild(rowsBadge);

        const colsBadge = document.createElement('span');
        colsBadge.className = 'csv-badge';
        colsBadge.textContent = `${totalCols} columns`;
        metaInfo.appendChild(colsBadge);

        toolbar.appendChild(metaInfo);

        const downloadLink = document.createElement('a');
        downloadLink.className = 'xp-button';
        downloadLink.href = filePath;
        downloadLink.setAttribute('download', fileName);
        downloadLink.innerHTML = `<img src="assets/icons/csv.png" width="16" height="16" alt="" style="vertical-align: middle;"> Download CSV`;
        toolbar.appendChild(downloadLink);

        wrapper.appendChild(toolbar);

        // Table Wrapper
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'csv-table-wrapper';

        const table = document.createElement('table');
        table.className = 'csv-table';

        // Table Head
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headers.forEach(function (h) {
          const th = document.createElement('th');
          th.textContent = h;
          headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Table Body
        const tbody = document.createElement('tbody');
        rowsToDisplay.forEach(function (row) {
          const tr = document.createElement('tr');
          for (let c = 0; c < totalCols; c++) {
            const td = document.createElement('td');
            td.textContent = row[c] !== undefined ? row[c] : '';
            tr.appendChild(td);
          }
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);

        tableWrapper.appendChild(table);
        wrapper.appendChild(tableWrapper);

        // Row Note if truncated
        if (totalRows > 200) {
          const note = document.createElement('div');
          note.className = 'csv-row-note';
          note.textContent = `Showing first 200 of ${totalRows.toLocaleString()} rows. Use the Download button above for the full dataset.`;
          wrapper.appendChild(note);
        }

        containerEl.appendChild(wrapper);
      })
      .catch(function (err) {
        containerEl.innerHTML = `
          <div class="window-state-box">
            <div class="window-error-box">
              <h3>Error loading CSV</h3>
              <p>Failed to load ${filePath}</p>
              <p style="font-size: 11px; margin-top: 6px; color: #666;">${err.message}</p>
            </div>
          </div>
        `;
      });
  }

  function openCSVViewer(filePath, fileName) {
    const cleanId = 'csv-view-' + fileName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    window.XP.openWindow(cleanId, {
      title: `${fileName} - CSV Viewer`,
      icon: 'assets/icons/csv.png',
      width: 720,
      height: 480,
      renderContent: function (containerEl) {
        renderCSV(containerEl, filePath, fileName);
      }
    });
  }

  window.XP.openCSVViewer = openCSVViewer;
  window.XP.parseCSV = parseCSV;
})();
