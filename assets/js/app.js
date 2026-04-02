window.APP_CONFIG = {
  webhookUrl: "",
  storagePrefix: "adminExpense"
};

const AppUtils = {
  _tesseractLoader: null,

  storageKey(moduleKey) {
    return `${window.APP_CONFIG.storagePrefix}:${moduleKey}`;
  },

  saveRecord(moduleKey, payload) {
    const key = this.storageKey(moduleKey);
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
    const key = this.storageKey(moduleKey);
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
  },

  pad(value, size = 2) {
    return String(value).padStart(size, '0');
  },

  generateRequestNo(moduleLabel, moduleKey, now = new Date()) {
    const year = now.getFullYear();
    const month = this.pad(now.getMonth() + 1);
    const day = this.pad(now.getDate());
    const rows = this.loadRecords(moduleKey);
    const prefix = `${moduleLabel}_${year}/${month}/`;
    const monthlyCount = rows.filter(row => String(row.requestNo || row.caseNo || '').startsWith(prefix)).length + 1;
    return `${moduleLabel}_${year}/${month}/${day}_${this.pad(monthlyCount, 3)}`;
  },

  ensureRequestNo(inputEl, moduleLabel, moduleKey) {
    if (!inputEl) return;
    if (!inputEl.value.trim()) {
      inputEl.value = this.generateRequestNo(moduleLabel, moduleKey);
    }
  },

  setInputValue(inputEl, value) {
    if (!inputEl || value === undefined || value === null || value === '') return false;
    if (inputEl.tagName === 'SELECT') {
      const options = Array.from(inputEl.options);
      const found = options.find(option => option.value === value || option.text === value);
      if (found) {
        inputEl.value = found.value;
        return true;
      }
    }
    inputEl.value = value;
    return true;
  },

  normalizeWhitespace(text) {
    return String(text || '')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{2,}/g, '\n')
      .trim();
  },

  normalizeDateString(value) {
    if (!value) return '';
    const text = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    let match = text.match(/(20\d{2})[年\/.\- ]\s*(\d{1,2})[月\/.\- ]\s*(\d{1,2})日?/);
    if (match) return `${match[1]}-${this.pad(match[2])}-${this.pad(match[3])}`;
    match = text.match(/(\d{1,2})[\/.\- ]\s*(\d{1,2})[\/.\- ]\s*(20\d{2})/);
    if (match) return `${match[3]}-${this.pad(match[2])}-${this.pad(match[1])}`;
    return '';
  },

  extractDates(text) {
    const results = [];
    const regex = /(20\d{2})[年\/.\- ]\s*(\d{1,2})[月\/.\- ]\s*(\d{1,2})日?/g;
    for (const match of text.matchAll(regex)) {
      results.push(`${match[1]}-${this.pad(match[2])}-${this.pad(match[3])}`);
    }
    const regex2 = /(\d{1,2})[\/.\- ]\s*(\d{1,2})[\/.\- ]\s*(20\d{2})/g;
    for (const match of text.matchAll(regex2)) {
      results.push(`${match[3]}-${this.pad(match[2])}-${this.pad(match[1])}`);
    }
    return [...new Set(results)];
  },

  extractMoney(text) {
    const values = [];
    const regex = /\b(HKD|THB|USD|RMB)\s*([\d,]+(?:\.\d{1,2})?)/gi;
    for (const match of text.matchAll(regex)) {
      values.push({ currency: match[1].toUpperCase(), amount: Number(match[2].replaceAll(',', '')), raw: match[0] });
    }
    return values.filter(item => Number.isFinite(item.amount));
  },

  findMoneyByKeywords(text, keywords) {
    const lines = this.normalizeWhitespace(text).split('\n');
    for (const line of lines) {
      const lowered = line.toLowerCase();
      if (keywords.some(keyword => lowered.includes(keyword.toLowerCase()))) {
        const money = this.extractMoney(line);
        if (money.length) return money[money.length - 1];
      }
    }
    return null;
  },

  largestMoney(text) {
    const values = this.extractMoney(text);
    return values.sort((a, b) => b.amount - a.amount)[0] || null;
  },

  parseMrzName(text) {
    const compact = String(text || '').toUpperCase().replace(/[^A-Z<]/g, '');
    const line = compact.match(/P<[A-Z<]{20,}/)?.[0];
    if (!line) return null;
    const payload = line.slice(2);
    if (payload.length < 6) return null;
    const namesPart = payload.slice(3);
    const [surnameRaw = '', givenRaw = ''] = namesPart.split('<<');
    const surname = surnameRaw.replace(/<+/g, ' ').trim();
    const given = givenRaw.replace(/<+/g, ' ').trim();
    const full = `${surname} ${given}`.trim();
    return full || null;
  },

  uniqueBy(items, keyFn) {
    const seen = new Set();
    return items.filter(item => {
      const key = keyFn(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  },

  async ensureTesseract() {
    if (window.Tesseract) return window.Tesseract;
    if (this._tesseractLoader) return this._tesseractLoader;

    this._tesseractLoader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      script.async = true;
      script.onload = () => resolve(window.Tesseract);
      script.onerror = () => reject(new Error('OCR library failed to load'));
      document.head.appendChild(script);
    });

    return this._tesseractLoader;
  },

  async recognizeFiles(files, statusEl, lang = 'eng+chi_tra') {
    if (!files || !files.length) return [];
    const Tesseract = await this.ensureTesseract();
    const results = [];
    for (let i = 0; i < files.length; i += 1) {
      if (statusEl) statusEl.textContent = `正在讀取附件 ${i + 1}/${files.length}...`;
      const result = await Tesseract.recognize(files[i].dataUrl, lang);
      results.push({ name: files[i].name, text: this.normalizeWhitespace(result.data?.text || '') });
    }
    if (statusEl) statusEl.textContent = '讀取完成，請核對自動填寫結果。';
    return results;
  }
};
