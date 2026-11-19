/**
 * Windows XP Picture and Fax Viewer
 * Lightweight viewer for image certificates with zoom, pan, fit, and download controls.
 */

window.XP = window.XP || {};

(function () {
  function renderPictureViewer(containerEl, filePath, fileName) {
    containerEl.innerHTML = '';
    containerEl.style.padding = '0';
    containerEl.style.display = 'flex';
    containerEl.style.flexDirection = 'column';

    const layout = document.createElement('div');
    layout.className = 'picture-viewer-layout';

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'picture-viewer-toolbar';

    let zoomLevel = 1.0;

    const zoomInBtn = document.createElement('button');
    zoomInBtn.className = 'xp-button';
    zoomInBtn.type = 'button';
    zoomInBtn.title = 'Zoom In';
    zoomInBtn.textContent = 'Zoom In (+)';

    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.className = 'xp-button';
    zoomOutBtn.type = 'button';
    zoomOutBtn.title = 'Zoom Out';
    zoomOutBtn.textContent = 'Zoom Out (-)';

    const fitBtn = document.createElement('button');
    fitBtn.className = 'xp-button';
    fitBtn.type = 'button';
    fitBtn.title = 'Best Fit';
    fitBtn.textContent = 'Best Fit';

    const actualBtn = document.createElement('button');
    actualBtn.className = 'xp-button';
    actualBtn.type = 'button';
    actualBtn.title = 'Actual Size';
    actualBtn.textContent = '100%';

    const downloadBtn = document.createElement('a');
    downloadBtn.className = 'xp-button';
    downloadBtn.href = filePath;
    downloadBtn.setAttribute('download', fileName);
    downloadBtn.textContent = 'Download';

    toolbar.appendChild(zoomInBtn);
    toolbar.appendChild(zoomOutBtn);
    toolbar.appendChild(fitBtn);
    toolbar.appendChild(actualBtn);
    toolbar.appendChild(downloadBtn);

    layout.appendChild(toolbar);

    // Canvas
    const canvas = document.createElement('div');
    canvas.className = 'picture-viewer-canvas';

    const img = document.createElement('img');
    img.className = 'picture-viewer-img';
    img.src = filePath;
    img.alt = fileName;

    function applyZoom() {
      img.style.transform = `scale(${zoomLevel})`;
    }

    zoomInBtn.addEventListener('click', function () {
      zoomLevel = Math.min(zoomLevel + 0.25, 4.0);
      applyZoom();
    });

    zoomOutBtn.addEventListener('click', function () {
      zoomLevel = Math.max(zoomLevel - 0.25, 0.25);
      applyZoom();
    });

    fitBtn.addEventListener('click', function () {
      zoomLevel = 1.0;
      img.style.maxWidth = '100%';
      img.style.maxHeight = '100%';
      applyZoom();
    });

    actualBtn.addEventListener('click', function () {
      zoomLevel = 1.0;
      img.style.maxWidth = 'none';
      img.style.maxHeight = 'none';
      applyZoom();
    });

    // Drag to pan
    let isPanning = false;
    let startX = 0;
    let startY = 0;
    let scrollLeft = 0;
    let scrollTop = 0;

    canvas.addEventListener('mousedown', function (e) {
      isPanning = true;
      canvas.classList.add('dragging');
      startX = e.pageX - canvas.offsetLeft;
      startY = e.pageY - canvas.offsetTop;
      scrollLeft = canvas.scrollLeft;
      scrollTop = canvas.scrollTop;
    });

    window.addEventListener('mousemove', function (e) {
      if (!isPanning) return;
      e.preventDefault();
      const x = e.pageX - canvas.offsetLeft;
      const y = e.pageY - canvas.offsetTop;
      const walkX = (x - startX) * 1.5;
      const walkY = (y - startY) * 1.5;
      canvas.scrollLeft = scrollLeft - walkX;
      canvas.scrollTop = scrollTop - walkY;
    });

    window.addEventListener('mouseup', function () {
      isPanning = false;
      canvas.classList.remove('dragging');
    });

    canvas.appendChild(img);
    layout.appendChild(canvas);
    containerEl.appendChild(layout);
  }

  function openImageViewer(filePath, fileName) {
    const cleanId = 'img-view-' + fileName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    window.XP.openWindow(cleanId, {
      title: `${fileName} - Windows Picture and Fax Viewer`,
      icon: 'assets/icons/folder.png',
      width: 720,
      height: 520,
      renderContent: function (containerEl) {
        renderPictureViewer(containerEl, filePath, fileName);
      }
    });
  }

  window.XP.openImageViewer = openImageViewer;
})();
