/**
 * Sakura Translator - PDF Viewer
 * Uses pdf.js to render PDFs with real text layers in the DOM,
 * enabling hover and selection-based translation via the content script.
 */

(() => {
  // ─── State ───
  let pdfDoc = null;
  let currentPage = 1;
  let totalPages = 0;
  let currentScale = 1.0;
  let fitWidthMode = true;
  let renderedPages = new Set();
  let isRendering = false;

  // ─── DOM references ───
  const pagesContainer = document.getElementById('pagesContainer');
  const pageInfo = document.getElementById('pageInfo');
  const fileName = document.getElementById('fileName');
  const zoomLevel = document.getElementById('zoomLevel');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const errorOverlay = document.getElementById('errorOverlay');
  const errorMessage = document.getElementById('errorMessage');

  // ─── Configure pdf.js worker ───
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdfjs/pdf.worker.js');

  // ─── Get PDF URL from query params ───
  const urlParams = new URLSearchParams(window.location.search);
  const pdfUrl = urlParams.get('file');
  const pdfName = urlParams.get('name') || 'PDF Document';

  if (!pdfUrl) {
    showError('No PDF URL provided.');
    throw new Error('No PDF URL provided');
  }

  // Set filename display
  fileName.textContent = pdfName;
  fileName.title = pdfName;
  document.title = pdfName + ' - Sakura PDF Viewer';

  // ─── Load the PDF ───
  loadPDF(pdfUrl);

  async function loadPDF(url) {
    showLoading();
    try {
      const loadingTask = pdfjsLib.getDocument({
        url: url,
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
        cMapPacked: true,
      });

      pdfDoc = await loadingTask.promise;
      totalPages = pdfDoc.numPages;
      updatePageInfo();

      // Calculate initial scale based on viewport width
      await calculateFitWidthScale();

      // Render all pages
      await renderAllPages();

      hideLoading();
    } catch (err) {
      console.error('[Sakura PDF] Failed to load PDF:', err);
      showError(err.message || 'Unknown error loading PDF');
    }
  }

  // ─── Calculate scale to fit viewport width ───
  async function calculateFitWidthScale() {
    if (!pdfDoc) return;

    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 1.0 });
    const containerWidth = pagesContainer.clientWidth - 40; // padding
    currentScale = containerWidth / viewport.width;
    fitWidthMode = true;
    updateZoomDisplay();
  }

  // ─── Render all pages ───
  async function renderAllPages() {
    if (isRendering) return;
    isRendering = true;

    // Clear existing pages
    pagesContainer.innerHTML = '';
    renderedPages.clear();

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const pageContainer = createPageContainer(pageNum);
      pagesContainer.appendChild(pageContainer);
    }

    // Render pages one by one (sequential for memory efficiency)
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (!pdfDoc) break; // PDF was unloaded
      await renderPage(pageNum);
    }

    isRendering = false;
  }

  // ─── Create a page container element ───
  function createPageContainer(pageNum) {
    const wrapper = document.createElement('div');
    wrapper.className = 'pdf-page-wrapper';
    wrapper.id = `page-wrapper-${pageNum}`;

    const container = document.createElement('div');
    container.className = 'pdf-page';
    container.id = `page-${pageNum}`;
    container.dataset.pageNum = pageNum;

    const canvas = document.createElement('canvas');
    canvas.className = 'pdf-canvas';

    const textLayer = document.createElement('div');
    textLayer.className = 'pdf-text-layer';

    container.appendChild(canvas);
    container.appendChild(textLayer);
    wrapper.appendChild(container);

    return wrapper;
  }

  // ─── Render a single page ───
  async function renderPage(pageNum) {
    if (renderedPages.has(pageNum)) return;

    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: currentScale });

      const container = document.getElementById(`page-${pageNum}`);
      if (!container) return;

      const canvas = container.querySelector('.pdf-canvas');
      const textLayerDiv = container.querySelector('.pdf-text-layer');

      // Set canvas dimensions (use device pixel ratio for sharpness)
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      // Set container dimensions
      container.style.width = `${viewport.width}px`;
      container.style.height = `${viewport.height}px`;

      // Set text layer dimensions
      textLayerDiv.style.width = `${viewport.width}px`;
      textLayerDiv.style.height = `${viewport.height}px`;

      // Render canvas with device pixel ratio
      const ctx = canvas.getContext('2d');
      const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null;

      await page.render({
        canvasContext: ctx,
        viewport: viewport,
        transform: transform,
      }).promise;

      // Render text layer
      const textContent = await page.getTextContent();
      renderTextLayer(textLayerDiv, viewport, textContent);

      renderedPages.add(pageNum);
    } catch (err) {
      console.error(`[Sakura PDF] Error rendering page ${pageNum}:`, err);
    }
  }

  // ─── Render text layer for a page ───
  // Creates absolutely positioned <span> elements for each text item.
  // pdf.js text items have a 6-element transform: [scaleX, shearY, shearX, scaleY, tx, ty]
  // in PDF coordinate space (origin bottom-left, Y up). The viewport transform maps
  // this to screen space (origin top-left, Y down).
  function renderTextLayer(container, viewport, textContent) {
    container.innerHTML = '';

    const items = textContent.items;
    if (!items || items.length === 0) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Skip empty items
      if (!item.str || item.str.length === 0) continue;

      // The item.transform is [scaleX, shearY, shearX, scaleY, tx, ty]
      // in PDF user-space coordinates. We need to convert to viewport (screen) coordinates.
      // item.height is the font height in PDF units.
      const fontHeight = item.height;

      // Convert bottom-left corner of the text to viewport coordinates
      const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);

      // Calculate the font size in viewport pixels
      // The font size = item.height * viewport.scale
      const fontSize = fontHeight * currentScale;
      if (fontSize < 1) continue; // Skip tiny/invisible text

      // Calculate the width: item.width is in PDF units
      const width = item.width * currentScale;

      const span = document.createElement('span');
      span.textContent = item.str;

      // In PDF coordinates, (tx, ty) is the baseline origin of the text.
      // After viewport conversion, y is the baseline in screen coords.
      // We need top = y - fontSize (approx ascent).
      span.style.left = `${x}px`;
      span.style.top = `${y - fontSize}px`;
      span.style.fontSize = `${fontSize}px`;
      span.style.fontFamily = 'sans-serif';
      span.style.lineHeight = '1';

      // Set width to match the PDF text extent for accurate selection
      if (width > 0) {
        span.style.width = `${width}px`;
        span.style.display = 'inline-block';
      }

      // Handle text direction (LTR/RTL)
      if (item.dir === 'rtl') {
        span.style.direction = 'rtl';
      }

      container.appendChild(span);
    }
  }

  // ─── Re-render all pages at current scale ───
  async function rerenderAllPages() {
    if (!pdfDoc) return;

    renderedPages.clear();

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const container = document.getElementById(`page-${pageNum}`);
      if (!container) continue;

      const textLayerDiv = container.querySelector('.pdf-text-layer');
      textLayerDiv.innerHTML = '';

      await renderPage(pageNum);
    }
  }

  // ─── Navigation: Previous Page ───
  document.getElementById('prevPage').addEventListener('click', () => {
    if (currentPage <= 1) return;
    currentPage--;
    scrollToPage(currentPage);
    updatePageInfo();
  });

  // ─── Navigation: Next Page ───
  document.getElementById('nextPage').addEventListener('click', () => {
    if (currentPage >= totalPages) return;
    currentPage++;
    scrollToPage(currentPage);
    updatePageInfo();
  });

  // ─── Zoom In ───
  document.getElementById('zoomIn').addEventListener('click', () => {
    currentScale = Math.min(currentScale * 1.2, 5.0);
    fitWidthMode = false;
    updateZoomDisplay();
    rerenderAllPages();
  });

  // ─── Zoom Out ───
  document.getElementById('zoomOut').addEventListener('click', () => {
    currentScale = Math.max(currentScale / 1.2, 0.3);
    fitWidthMode = false;
    updateZoomDisplay();
    rerenderAllPages();
  });

  // ─── Fit Width ───
  document.getElementById('fitWidth').addEventListener('click', async () => {
    await calculateFitWidthScale();
    await rerenderAllPages();
  });

  // ─── Retry button ───
  document.getElementById('retryBtn').addEventListener('click', () => {
    hideError();
    loadPDF(pdfUrl);
  });

  // ─── Track current page on scroll ───
  const scrollObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const pageNum = parseInt(entry.target.dataset.pageNum);
          if (!isNaN(pageNum)) {
            currentPage = pageNum;
            updatePageInfo();
          }
        }
      }
    },
    {
      root: null,
      rootMargin: '-40% 0px -40% 0px',
      threshold: 0,
    }
  );

  // Observe pages after they're created
  const mutationObserver = new MutationObserver(() => {
    document.querySelectorAll('.pdf-page').forEach((page) => {
      if (!page._observed) {
        scrollObserver.observe(page);
        page._observed = true;
      }
    });
  });
  mutationObserver.observe(pagesContainer, { childList: true });

  // ─── Keyboard shortcuts ───
  document.addEventListener('keydown', (e) => {
    // Don't intercept when typing in inputs or when a popup is showing
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.key) {
      case 'ArrowLeft':
      case 'PageUp':
        if (!e.ctrlKey && !e.altKey && !e.shiftKey) {
          if (currentPage > 1) {
            currentPage--;
            scrollToPage(currentPage);
            updatePageInfo();
          }
        }
        break;
      case 'ArrowRight':
      case 'PageDown':
        if (!e.ctrlKey && !e.altKey && !e.shiftKey) {
          if (currentPage < totalPages) {
            currentPage++;
            scrollToPage(currentPage);
            updatePageInfo();
          }
        }
        break;
      case '+':
      case '=':
        if (e.ctrlKey) {
          e.preventDefault();
          currentScale = Math.min(currentScale * 1.2, 5.0);
          fitWidthMode = false;
          updateZoomDisplay();
          rerenderAllPages();
        }
        break;
      case '-':
        if (e.ctrlKey) {
          e.preventDefault();
          currentScale = Math.max(currentScale / 1.2, 0.3);
          fitWidthMode = false;
          updateZoomDisplay();
          rerenderAllPages();
        }
        break;
      case '0':
        if (e.ctrlKey) {
          e.preventDefault();
          calculateFitWidthScale().then(() => rerenderAllPages());
        }
        break;
      case 'Home':
        currentPage = 1;
        scrollToPage(1);
        updatePageInfo();
        break;
      case 'End':
        currentPage = totalPages;
        scrollToPage(totalPages);
        updatePageInfo();
        break;
    }
  });

  // ─── Window resize handler ───
  let resizeTimeout;
  window.addEventListener('resize', () => {
    if (!fitWidthMode) return;
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(async () => {
      await calculateFitWidthScale();
      await rerenderAllPages();
    }, 300);
  });

  // ─── Helpers ───
  function scrollToPage(pageNum) {
    const pageEl = document.getElementById(`page-${pageNum}`);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function updatePageInfo() {
    pageInfo.textContent = `Page ${currentPage} / ${totalPages}`;
  }

  function updateZoomDisplay() {
    zoomLevel.textContent = `${Math.round(currentScale * 100)}%`;
  }

  function showLoading() {
    loadingOverlay.classList.remove('hidden');
    errorOverlay.classList.add('hidden');
  }

  function hideLoading() {
    loadingOverlay.classList.add('hidden');
  }

  function showError(msg) {
    loadingOverlay.classList.add('hidden');
    errorOverlay.classList.remove('hidden');
    errorMessage.textContent = msg;
  }

  function hideError() {
    errorOverlay.classList.add('hidden');
  }
})();
