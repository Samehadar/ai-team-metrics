const FALLBACK_DAYS_BACK = 365 * 2;
const PLUGIN_VERSION = '2.0.0';

async function fetchJsonOrNull(url, init) {
  try {
    const res = await fetch(url, { credentials: 'include', ...(init || {}) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function startMsFromUser(user) {
  if (user?.created_at) {
    const t = Date.parse(user.created_at);
    if (Number.isFinite(t)) {
      return String(Math.max(0, t - 86400000));
    }
  }
  return String(Date.now() - FALLBACK_DAYS_BACK * 86400000);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'checkAuth') {
    (async () => {
      const me = await fetchJsonOrNull('/api/auth/me');
      const usage = await fetchJsonOrNull('/api/usage-summary');
      if (!me) {
        sendResponse({ ok: false });
        return;
      }
      sendResponse({
        ok: true,
        user: me,
        usageSummary: usage || null,
        suggestedStartMs: startMsFromUser(me),
      });
    })();
    return true;
  }

  if (msg.action === 'fetchBundle') {
    (async () => {
      try {
        const me = await fetchJsonOrNull('/api/auth/me');
        const usageSummary = await fetchJsonOrNull('/api/usage-summary');
        const startMs = msg.startMs || startMsFromUser(me);
        const endMs = msg.endMs || String(Date.now());

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

        if (!analytics) {
          sendResponse({ ok: false, error: 'get-user-analytics failed' });
          return;
        }

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
          usageSummary: usageSummary || null,
          meta: {
            exportedAt: new Date().toISOString(),
            requestedRange: { startMs, endMs },
            pluginVersion: PLUGIN_VERSION,
          },
        };

        sendResponse({
          ok: true,
          data: bundle,
          days: bundle.dailyMetrics.length,
          user: me,
          billingCycleStart: usageSummary?.billingCycleStart || null,
          billingCycleEnd: usageSummary?.billingCycleEnd || null,
          startMs,
          endMs,
        });
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
    })();
    return true;
  }

  if (msg.action === 'fetchCsv') {
    (async () => {
      try {
        const me = await fetchJsonOrNull('/api/auth/me');
        const startMs = msg.startMs || startMsFromUser(me);
        const endMs = msg.endMs || String(Date.now());
        const url =
          '/api/dashboard/export-usage-events-csv?startDate=' +
          startMs +
          '&endDate=' +
          endMs +
          '&strategy=tokens';
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) {
          sendResponse({ ok: false, error: 'HTTP ' + res.status });
          return;
        }
        const csv = await res.text();
        const lines = Math.max(0, csv.trim().split('\n').length - 1);
        sendResponse({ ok: true, csv, lines, startMs, endMs });
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
    })();
    return true;
  }
});
