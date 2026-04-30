(() => {
  if (document.getElementById('ca-fab')) return;

  const FALLBACK_DAYS_BACK = 365 * 2;
  const FILENAME_PREFIX = 'акк_';

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

  function startMsFromUser(user) {
    if (user?.created_at) {
      const t = Date.parse(user.created_at);
      if (Number.isFinite(t)) return String(Math.max(0, t - 86400000));
    }
    return String(Date.now() - FALLBACK_DAYS_BACK * 86400000);
  }

  async function fetchJsonOrNull(url, init) {
    try {
      const res = await fetch(url, { credentials: 'include', ...(init || {}) });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  const fab = document.createElement('div');
  fab.id = 'ca-fab';
  fab.innerHTML = '⚡';
  document.body.appendChild(fab);

  const panel = document.createElement('div');
  panel.id = 'ca-panel';
  panel.innerHTML = `
    <div class="ca-panel-header">
      <span class="ca-panel-logo">⚡</span>
      <span class="ca-panel-title">AI Team Metrics</span>
      <span id="ca-close" class="ca-close">&times;</span>
    </div>
    <div id="ca-user" class="ca-user ca-hidden"></div>
    <div class="ca-field">
      <label>Filename prefix</label>
      <input id="ca-filename" type="text" placeholder="${FILENAME_PREFIX}Имя_Фамилия" autocomplete="off">
    </div>
    <div class="ca-field">
      <label>Period</label>
      <div id="ca-period" class="ca-period">— → now</div>
    </div>
    <div class="ca-buttons">
      <button id="ca-btn-json" class="ca-btn ca-btn-primary" disabled>📊 Download JSON (bundle)</button>
      <button id="ca-btn-csv" class="ca-btn ca-btn-secondary" disabled>📄 Download CSV</button>
    </div>
    <div id="ca-result" class="ca-result ca-hidden"></div>
  `;
  document.body.appendChild(panel);

  const fileInput = panel.querySelector('#ca-filename');
  const btnJson = panel.querySelector('#ca-btn-json');
  const btnCsv = panel.querySelector('#ca-btn-csv');
  const resultDiv = panel.querySelector('#ca-result');
  const closeBtn = panel.querySelector('#ca-close');
  const userBox = panel.querySelector('#ca-user');
  const periodBox = panel.querySelector('#ca-period');

  let panelOpen = false;
  let cachedUser = null;
  let cachedUsage = null;
  let suggestedStartMs = null;

  fab.addEventListener('click', () => {
    panelOpen = !panelOpen;
    panel.classList.toggle('ca-open', panelOpen);
    fab.classList.toggle('ca-fab-active', panelOpen);
  });

  closeBtn.addEventListener('click', () => {
    panelOpen = false;
    panel.classList.remove('ca-open');
    fab.classList.remove('ca-fab-active');
  });

  function updateButtons() {
    const ready = fileInput.value.trim().length > 0;
    btnJson.disabled = !ready;
    btnCsv.disabled = !ready;
  }
  fileInput.addEventListener('input', updateButtons);

  function showResult(type, html) {
    resultDiv.className = 'ca-result ca-result-' + type;
    resultDiv.innerHTML = html;
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  (async () => {
    const me = await fetchJsonOrNull('/api/auth/me');
    const usage = await fetchJsonOrNull('/api/usage-summary');
    if (!me) return;

    cachedUser = me;
    cachedUsage = usage;
    suggestedStartMs = startMsFromUser(me);

    userBox.classList.remove('ca-hidden');
    const cycle =
      usage?.billingCycleStart && usage?.billingCycleEnd
        ? formatDate(usage.billingCycleStart) + ' → ' + formatDate(usage.billingCycleEnd)
        : '—';
    userBox.innerHTML = `
      <div><span class="ca-k">Account</span><span class="ca-v">${me.name || me.email || '—'}</span></div>
      <div><span class="ca-k">Plan</span><span class="ca-v">${usage?.membershipType || 'free'}</span></div>
      <div><span class="ca-k">Cycle</span><span class="ca-v">${cycle}</span></div>
    `;

    if (!fileInput.value && me.name) {
      fileInput.value = FILENAME_PREFIX + sanitizeFilename(me.name);
    }
    if (suggestedStartMs) {
      periodBox.textContent = formatDate(Number(suggestedStartMs)) + ' → now';
    }
    updateButtons();
  })();

  btnJson.addEventListener('click', async () => {
    const base = fileInput.value.trim();
    if (!base) return;
    const fileName = base + '.json';

    btnJson.textContent = '⏳ Loading...';
    btnJson.disabled = true;
    resultDiv.classList.add('ca-hidden');

    try {
      const startMs = suggestedStartMs || startMsFromUser(cachedUser);
      const endMs = String(Date.now());
      const analytics = await fetchJsonOrNull('/api/dashboard/get-user-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: 0,
          userId: 0,
          startDate: startMs,
          endDate: endMs,
        }),
      });
      if (!analytics) throw new Error('analytics request failed');

      const me = cachedUser;
      const bundle = {
        dailyMetrics: analytics.dailyMetrics || [],
        period: analytics.period || { startDate: startMs, endDate: endMs },
        totalMembersInTeam: analytics.totalMembersInTeam ?? 0,
        userInfo: me
          ? {
              id: me.id,
              sub: me.sub,
              email: me.email,
              name: me.name,
              createdAt: me.created_at,
              updatedAt: me.updated_at,
            }
          : null,
        usageSummary: cachedUsage || null,
        meta: {
          exportedAt: new Date().toISOString(),
          requestedRange: { startMs, endMs },
          pluginVersion: '2.0.0',
        },
      };

      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      triggerDownload(blob, fileName);

      const days = bundle.dailyMetrics.length;
      const period = formatDate(startMs) + ' → ' + formatDate(endMs);
      showResult('success', `✅ <b>${fileName}</b><br>${days} days · ${period}`);
    } catch (err) {
      showResult('error', '❌ ' + err.message);
    }

    btnJson.textContent = '📊 Download JSON (bundle)';
    btnJson.disabled = false;
  });

  btnCsv.addEventListener('click', async () => {
    const base = fileInput.value.trim();
    if (!base) return;
    const fileName = base + '.csv';

    btnCsv.textContent = '⏳ Loading...';
    btnCsv.disabled = true;
    resultDiv.classList.add('ca-hidden');

    try {
      const startMs = suggestedStartMs || startMsFromUser(cachedUser);
      const endMs = String(Date.now());
      const url =
        '/api/dashboard/export-usage-events-csv?startDate=' +
        startMs +
        '&endDate=' +
        endMs +
        '&strategy=tokens';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const csv = await res.text();
      const lines = Math.max(0, csv.trim().split('\n').length - 1);

      const blob = new Blob([csv], { type: 'text/csv' });
      triggerDownload(blob, fileName);

      const period = formatDate(startMs) + ' → ' + formatDate(endMs);
      showResult('success', `✅ <b>${fileName}</b><br>${lines} rows · ${period}`);
    } catch (err) {
      showResult('error', '❌ ' + err.message);
    }

    btnCsv.textContent = '📄 Download CSV';
    btnCsv.disabled = false;
  });
})();
