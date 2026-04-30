const fileNameInput = document.getElementById('fileNameInput');
const btnJson = document.getElementById('btnJson');
const btnCsv = document.getElementById('btnCsv');
const statusBar = document.getElementById('statusBar');
const statusText = document.getElementById('statusText');
const resultDiv = document.getElementById('result');
const userCard = document.getElementById('userCard');
const userNameEl = document.getElementById('userName');
const userPlanEl = document.getElementById('userPlan');
const userCycleEl = document.getElementById('userCycle');
const periodInfoEl = document.getElementById('periodInfo');

let cursorTabId = null;
let suggestedStartMs = null;

const FILENAME_PREFIX = 'акк_';

function setStatus(type, text) {
  statusBar.className = 'status-bar status-' + type;
  statusText.textContent = text;
}

function showResult(type, html) {
  resultDiv.classList.remove('hidden');
  resultDiv.className = 'result ' + type;
  resultDiv.innerHTML = html;
}

function hideResult() {
  resultDiv.classList.add('hidden');
}

function updateButtons() {
  const ready = cursorTabId !== null && fileNameInput.value.trim().length > 0;
  btnJson.disabled = !ready;
  btnCsv.disabled = !ready;
}

function sanitizeFilename(name) {
  if (!name) return '';
  return name.trim().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_');
}

function formatDate(value) {
  if (value === null || value === undefined || value === '') return '—';
  let d;
  if (typeof value === 'number') {
    d = new Date(value);
  } else {
    const s = String(value);
    d = /^\d+$/.test(s) ? new Date(Number(s)) : new Date(s);
  }
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

function formatCycle(start, end) {
  if (!start || !end) return '—';
  return formatDate(start) + ' → ' + formatDate(end);
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

  const auth = await sendToContent(cursorTabId, { action: 'checkAuth' });

  if (!auth.ok) {
    setStatus('error', 'Not authenticated on cursor.com');
    updateButtons();
    return;
  }

  setStatus('ok', 'Authenticated');

  const user = auth.user || {};
  const usage = auth.usageSummary || {};
  suggestedStartMs = auth.suggestedStartMs || null;

  userCard.classList.remove('hidden');
  userNameEl.textContent = user.name || user.email || '—';
  const plan = usage.membershipType || (user.email ? 'free' : '—');
  userPlanEl.textContent = String(plan);
  userCycleEl.textContent = formatCycle(usage.billingCycleStart, usage.billingCycleEnd);

  if (suggestedStartMs) {
    periodInfoEl.textContent = formatDate(Number(suggestedStartMs)) + ' → now';
  }

  if (!fileNameInput.value && user.name) {
    fileNameInput.value = FILENAME_PREFIX + sanitizeFilename(user.name);
  }

  updateButtons();
}

fileNameInput.addEventListener('input', updateButtons);

btnJson.addEventListener('click', async () => {
  if (!cursorTabId) return;
  const base = fileNameInput.value.trim();
  if (!base) return;

  const fileName = base + '.json';

  hideResult();
  btnJson.classList.add('loading');
  btnJson.innerHTML = '<span class="spinner"></span> Loading...';

  const result = await sendToContent(cursorTabId, {
    action: 'fetchBundle',
    startMs: suggestedStartMs || undefined,
  });

  btnJson.classList.remove('loading');
  btnJson.innerHTML = '<span class="btn-icon">📊</span> Download JSON (full bundle)';

  if (!result.ok) {
    showResult('error', '❌ ' + (result.error || 'Unknown error'));
    return;
  }

  const blob = new Blob([JSON.stringify(result.data, null, 2)], {
    type: 'application/json',
  });
  const dataUrl = URL.createObjectURL(blob);

  chrome.downloads.download({ url: dataUrl, filename: fileName, saveAs: false }, () => {
    if (chrome.runtime.lastError) {
      showResult('error', '❌ Download error: ' + chrome.runtime.lastError.message);
    } else {
      const period =
        formatDate(result.startMs) + ' → ' + formatDate(result.endMs);
      showResult(
        'success',
        '✅ <b>' + fileName + '</b><br>' +
          'Days: ' + (result.days ?? '?') + ' · ' + period,
      );
    }
  });
});

btnCsv.addEventListener('click', async () => {
  if (!cursorTabId) return;
  const base = fileNameInput.value.trim();
  if (!base) return;

  const fileName = base + '.csv';

  hideResult();
  btnCsv.classList.add('loading');
  btnCsv.innerHTML = '<span class="spinner"></span> Loading...';

  const result = await sendToContent(cursorTabId, {
    action: 'fetchCsv',
    startMs: suggestedStartMs || undefined,
  });

  btnCsv.classList.remove('loading');
  btnCsv.innerHTML = '<span class="btn-icon">📄</span> Download CSV (usage events)';

  if (!result.ok) {
    showResult('error', '❌ ' + (result.error || 'Unknown error'));
    return;
  }

  const blob = new Blob([result.csv], { type: 'text/csv' });
  const dataUrl = URL.createObjectURL(blob);

  chrome.downloads.download({ url: dataUrl, filename: fileName, saveAs: false }, () => {
    if (chrome.runtime.lastError) {
      showResult('error', '❌ Download error: ' + chrome.runtime.lastError.message);
    } else {
      const period =
        formatDate(result.startMs) + ' → ' + formatDate(result.endMs);
      showResult(
        'success',
        '✅ <b>' + fileName + '</b><br>' +
          'Rows: ' + (result.lines ?? '?') + ' · ' + period,
      );
    }
  });
});

init();
