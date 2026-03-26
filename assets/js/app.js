window.APP_CONFIG = {
  webhookUrl: "",
  storagePrefix: "adminExpense"
};

const AppUtils = {
  saveRecord(moduleKey, payload) {
    const key = `${window.APP_CONFIG.storagePrefix}:${moduleKey}`;
    const rows = JSON.parse(localStorage.getItem(key) || '[]');
    const idKey = payload.caseNo || payload.requestNo || payload.recordNo || payload.id || `${moduleKey}-${Date.now()}`;
    const index = rows.findIndex(row => (row.caseNo || row.requestNo || row.recordNo || row.id) === idKey);
    const nextRow = { ...payload, id: idKey, createdAt: payload.createdAt || new Date().toISOString() };

    if (index >= 0) {
      rows[index] = nextRow;
    } else {
      rows.unshift(nextRow);
    }

    localStorage.setItem(key, JSON.stringify(rows));
    return nextRow;
  },

  loadRecords(moduleKey) {
    const key = `${window.APP_CONFIG.storagePrefix}:${moduleKey}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
  },

  exportCsv(filename, headers, rows) {
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  async postToWebhook(payload) {
    if (!window.APP_CONFIG.webhookUrl) {
      throw new Error('Webhook URL not configured');
    }

    const res = await fetch(window.APP_CONFIG.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return res;
  },

  money(v) {
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return '';
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
};
