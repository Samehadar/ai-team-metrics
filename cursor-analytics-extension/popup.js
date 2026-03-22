const devSelect = document.getElementById('devSelect');
const btnJson = document.getElementById('btnJson');
const btnCsv = document.getElementById('btnCsv');
const statusBar = document.getElementById('statusBar');
const statusText = document.getElementById('statusText');
const resultDiv = document.getElementById('result');

let cursorTabId = null;

const EMAIL_MAP = {
  // Map Cursor account emails to file name prefixes.
  // Example: 'alice@company.com': 'Alice_Johnson',
};

function setStatus(type, text) {
  statusBar.className = 'status-bar status-' + type;
  statusText.textContent = text;
}

function showResult(type, html) {
  resultDiv.className = 'result ' + type;
  resultDiv.innerHTML = html;
}

function updateButtons() {
  const hasName = devSelect.value !== '';
  const ready = cursorTabId !== null && hasName;
  btnJson.disabled = !ready;
  btnCsv.disabled = !ready;
}

async function getCursorTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab) return null;

  const url = tab.url || '';
  if (url.includes('cursor.com')) return tab.id;
  return null;
}

async function sendToContent(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response || { ok: false, error: 'No response' });
      }
    });
  });
}

async function init() {
  cursorTabId = await getCursorTab();

  if (!cursorTabId) {
    setStatus('error', 'Open cursor.com/dashboard in this tab');
    updateButtons();
    return;
  }

  const authResult = await sendToContent(cursorTabId, { action: 'checkAuth' });

  if (authResult.ok) {
    const email = authResult.email || '';
    const matched = EMAIL_MAP[email];
    if (matched) {
      devSelect.value = matched;
      setStatus('ok', devSelect.options[devSelect.selectedIndex]?.text || email);
    } else {
      setStatus('ok', 'Authenticated' + (email ? ` (${email})` : ''));
    }
  } else {
    setStatus('error', 'Not authenticated on cursor.com');
  }

  updateButtons();
}

devSelect.addEventListener('change', updateButtons);

btnJson.addEventListener('click', async () => {
  if (!cursorTabId || !devSelect.value) return;

  const fileName = devSelect.value + '.json';
  const devLabel = devSelect.options[devSelect.selectedIndex].text;

  btnJson.innerHTML = '<span class="spinner"></span> Loading...';
  btnJson.classList.add('loading');
  resultDiv.classList.add('hidden');

  const result = await sendToContent(cursorTabId, { action: 'fetchAnalytics' });

  btnJson.innerHTML = '<span class="btn-icon">📊</span> Download JSON (API)';
  btnJson.classList.remove('loading');

  if (!result.ok) {
    showResult('error', '❌ Error: ' + (result.error || 'Unknown error'));
    return;
  }

  const blob = new Blob([JSON.stringify(result.data, null, 2)], {
    type: 'application/json',
  });
  const dataUrl = URL.createObjectURL(blob);

  chrome.downloads.download(
    { url: dataUrl, filename: fileName, saveAs: false },
    (downloadId) => {
      if (chrome.runtime.lastError) {
        showResult('error', '❌ Download error: ' + chrome.runtime.lastError.message);
      } else {
        showResult(
          'success',
          '✅ <b>' + devLabel + '</b><br>' +
          'File: ' + fileName + '<br>' +
          'Days with data: ' + (result.days || '?')
        );
      }
    }
  );
});

btnCsv.addEventListener('click', async () => {
  if (!cursorTabId || !devSelect.value) return;

  const fileName = devSelect.value + '.csv';
  const devLabel = devSelect.options[devSelect.selectedIndex].text;

  btnCsv.innerHTML = '<span class="spinner"></span> Loading...';
  btnCsv.classList.add('loading');
  resultDiv.classList.add('hidden');

  const result = await sendToContent(cursorTabId, { action: 'fetchCsv' });

  btnCsv.innerHTML = '<span class="btn-icon">📄</span> Download CSV (export)';
  btnCsv.classList.remove('loading');

  if (!result.ok) {
    showResult('error', '❌ Error: ' + (result.error || 'Unknown error'));
    return;
  }

  const blob = new Blob([result.csv], { type: 'text/csv' });
  const dataUrl = URL.createObjectURL(blob);

  chrome.downloads.download(
    { url: dataUrl, filename: fileName, saveAs: false },
    (downloadId) => {
      if (chrome.runtime.lastError) {
        showResult('error', '❌ Download error: ' + chrome.runtime.lastError.message);
      } else {
        showResult(
          'success',
          '✅ <b>' + devLabel + '</b><br>' +
          'File: ' + fileName + '<br>' +
          'Rows: ' + (result.lines || '?')
        );
      }
    }
  );
});

init();
