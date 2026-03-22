(() => {
  if (document.getElementById('ca-fab')) return;

  const START_MS = '1770940800000';

  const DEVS = [
    { value: 'Alice_Johnson', label: 'Alice Johnson', email: '' },
    { value: 'Bob_Smith', label: 'Bob Smith', email: '' },
  ];

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
    <div class="ca-field">
      <label>Developer</label>
      <select id="ca-dev">
        <option value="">— Select name —</option>
        ${DEVS.map((d) => `<option value="${d.value}">${d.label}</option>`).join('')}
      </select>
    </div>
    <div class="ca-field">
      <label>Period</label>
      <div class="ca-period">Start date — now</div>
    </div>
    <div class="ca-buttons">
      <button id="ca-btn-json" class="ca-btn ca-btn-primary" disabled>📊 Download JSON</button>
      <button id="ca-btn-csv" class="ca-btn ca-btn-secondary" disabled>📄 Download CSV</button>
    </div>
    <div id="ca-result" class="ca-result ca-hidden"></div>
  `;
  document.body.appendChild(panel);

  const devSelect = panel.querySelector('#ca-dev');
  const btnJson = panel.querySelector('#ca-btn-json');
  const btnCsv = panel.querySelector('#ca-btn-csv');
  const resultDiv = panel.querySelector('#ca-result');
  const closeBtn = panel.querySelector('#ca-close');

  let panelOpen = false;

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

  devSelect.addEventListener('change', () => {
    const hasVal = devSelect.value !== '';
    btnJson.disabled = !hasVal;
    btnCsv.disabled = !hasVal;
  });

  fetch('/api/auth/me', { credentials: 'include' })
    .then((r) => r.ok ? r.json() : Promise.reject())
    .then((data) => {
      if (!data?.email) return;
      const match = DEVS.find((d) => d.email === data.email);
      if (match) {
        devSelect.value = match.value;
        devSelect.dispatchEvent(new Event('change'));
      }
    })
    .catch(() => {});

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
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }

  btnJson.addEventListener('click', async () => {
    if (!devSelect.value) return;
    const fileName = devSelect.value + '.json';
    const devLabel = devSelect.options[devSelect.selectedIndex].text;

    btnJson.textContent = '⏳ Loading...';
    btnJson.disabled = true;
    resultDiv.classList.add('ca-hidden');

    try {
      const endMs = String(Date.now());
      const res = await fetch('/api/dashboard/get-user-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ teamId: 0, userId: 0, startDate: START_MS, endDate: endMs }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const days = data?.dailyMetrics?.length || 0;

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      triggerDownload(blob, fileName);
      showResult('success', `✅ <b>${devLabel}</b><br>${fileName} · ${days} days`);
    } catch (err) {
      showResult('error', '❌ ' + err.message);
    }

    btnJson.textContent = '📊 Download JSON';
    btnJson.disabled = false;
  });

  btnCsv.addEventListener('click', async () => {
    if (!devSelect.value) return;
    const fileName = devSelect.value + '.csv';
    const devLabel = devSelect.options[devSelect.selectedIndex].text;

    btnCsv.textContent = '⏳ Loading...';
    btnCsv.disabled = true;
    resultDiv.classList.add('ca-hidden');

    try {
      const endMs = String(Date.now());
      const url = '/api/dashboard/export-usage-events-csv?startDate=' + START_MS + '&endDate=' + endMs + '&strategy=tokens';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const csv = await res.text();
      const lines = csv.trim().split('\n').length;

      const blob = new Blob([csv], { type: 'text/csv' });
      triggerDownload(blob, fileName);
      showResult('success', `✅ <b>${devLabel}</b><br>${fileName} · ${lines} rows`);
    } catch (err) {
      showResult('error', '❌ ' + err.message);
    }

    btnCsv.textContent = '📄 Download CSV';
    btnCsv.disabled = false;
  });
})();
