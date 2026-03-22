const START_MS = '1770940800000'; // 13 Feb 2026 00:00 UTC

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'checkAuth') {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => sendResponse({ ok: true, email: data?.email || '' }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg.action === 'fetchAnalytics') {
    const endMs = String(Date.now());
    fetch('/api/dashboard/get-user-analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        teamId: 0,
        userId: 0,
        startDate: START_MS,
        endDate: endMs,
      }),
    })
      .then((r) => {
        if (!r.ok) return Promise.reject(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const days = data?.dailyMetrics?.length || 0;
        sendResponse({ ok: true, data, days });
      })
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  if (msg.action === 'fetchCsv') {
    const endMs = String(Date.now());
    const url =
      '/api/dashboard/export-usage-events-csv?startDate=' +
      START_MS +
      '&endDate=' +
      endMs +
      '&strategy=tokens';
    fetch(url, { credentials: 'include' })
      .then((r) => {
        if (!r.ok) return Promise.reject(`HTTP ${r.status}`);
        return r.text();
      })
      .then((csv) => {
        const lines = csv.trim().split('\n').length;
        sendResponse({ ok: true, csv, lines });
      })
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
});
