/* ============================================================
   RODS Dashboard — rods-dashboard.js
   Retail Operations Decision System
   Pure vanilla JS, no external dependencies
   ============================================================ */

'use strict';

// ============================================================
// STATE
// ============================================================
let rawData = [];
let filters = { grade: 'all', category: 'all', region: 'all' };

// ============================================================
// BOOTSTRAP
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('csv-upload').addEventListener('change', handleCSVUpload);
});

// ============================================================
// DATA ENTRY POINTS
// ============================================================

function handleCSVUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    ingestData(ev.target.result, file.name);
  };
  reader.readAsText(file, 'UTF-8');
  e.target.value = '';
}

function loadSampleData() {
  // Always use embedded data — works with file:// and any server
  ingestData(SAMPLE_CSV, '範例資料');
}

function ingestData(csvText, sourceName) {
  const parsed = parseCSV(csvText);
  if (!parsed || parsed.length === 0) {
    alert('無法解析資料，請確認 CSV 格式是否正確。');
    return;
  }
  rawData = parsed;
  resetFilters(false);            // reset selects but don't re-render yet
  renderAll();                    // initial render
  document.getElementById('data-date').textContent =
    new Date().toLocaleDateString('zh-HK', { year: 'numeric', month: 'long', day: 'numeric' });
  document.getElementById('data-count').textContent = `${rawData.length} 筆資料`;
  document.getElementById('upload-status').textContent = `已載入：${sourceName}`;
  document.getElementById('dashboard').classList.remove('hidden');
}

// ============================================================
// CSV PARSING
// ============================================================

function parseCSV(text) {
  const lines = text.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) return [];

  const headers = splitCSVLine(lines[0]).map(h => h.trim());
  const required = ['Store','Region','StoreGrade','Category','Model',
                    'SalesAmount','SalesQty','InventoryQty','InventoryValue','StockAgeDays'];
  const missing = required.filter(f => !headers.includes(f));
  if (missing.length) {
    alert('CSV 缺少欄位：' + missing.join(', '));
    return [];
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const vals = splitCSVLine(line);
    if (vals.length !== headers.length) continue;

    const row = {};
    headers.forEach((h, idx) => { row[h] = (vals[idx] || '').trim(); });

    row.SalesAmount   = parseFloat(row.SalesAmount)   || 0;
    row.SalesQty      = parseInt(row.SalesQty)         || 0;
    row.InventoryQty  = parseInt(row.InventoryQty)     || 0;
    row.InventoryValue= parseFloat(row.InventoryValue) || 0;
    row.StockAgeDays  = parseInt(row.StockAgeDays)     || 0;

    rows.push(row);
  }
  return rows;
}

function splitCSVLine(line) {
  const result = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += c; }
  }
  result.push(cur);
  return result;
}

// ============================================================
// FILTERS
// ============================================================

function applyFilters() {
  filters.grade    = document.getElementById('filter-grade').value;
  filters.category = document.getElementById('filter-category').value;
  filters.region   = document.getElementById('filter-region').value;
  renderAll();
  updateFilterInfo();
}

function resetFilters(doRender = true) {
  filters = { grade: 'all', category: 'all', region: 'all' };
  document.getElementById('filter-grade').value    = 'all';
  document.getElementById('filter-category').value = 'all';
  document.getElementById('filter-region').value   = 'all';
  document.getElementById('filter-info').textContent = '';
  if (doRender && rawData.length) renderAll();
}

function getFiltered() {
  return rawData.filter(r => {
    if (filters.grade    !== 'all' && r.StoreGrade !== filters.grade)    return false;
    if (filters.category !== 'all' && r.Category   !== filters.category) return false;
    if (filters.region   !== 'all' && r.Region     !== filters.region)   return false;
    return true;
  });
}

function updateFilterInfo() {
  const parts = [];
  if (filters.grade    !== 'all') parts.push('店級：' + filters.grade);
  if (filters.category !== 'all') parts.push('貨類：' + filters.category);
  if (filters.region   !== 'all') parts.push('地區：' + filters.region);
  const d = getFiltered();
  const info = parts.length ? `篩選條件：${parts.join('，')}　顯示 ${d.length} / ${rawData.length} 筆` : '';
  document.getElementById('filter-info').textContent = info;
}

// ============================================================
// MASTER RENDER
// ============================================================

function renderAll() {
  const data = getFiltered();
  renderKPIs(data);
  renderStoreTable(data);
  renderTopSellers(data);
  renderSlowMovers(data);
  renderActionList(data);
}

// ============================================================
// KPI SECTION
// ============================================================

function calcKPIs(data) {
  const totalSales     = data.reduce((s, r) => s + r.SalesAmount, 0);
  const totalSalesQty  = data.reduce((s, r) => s + r.SalesQty, 0);
  const totalInvValue  = data.reduce((s, r) => s + r.InventoryValue, 0);
  const totalInvQty    = data.reduce((s, r) => s + r.InventoryQty, 0);
  const totalUnits     = totalSalesQty + totalInvQty;
  const sellThrough    = totalUnits > 0 ? totalSalesQty / totalUnits : 0;
  const highRiskItems  = data.filter(r => r.InventoryQty > 0 && r.StockAgeDays >= 180);
  const highRiskQty    = highRiskItems.reduce((s, r) => s + r.InventoryQty, 0);

  return { totalSales, totalSalesQty, totalInvValue, sellThrough, highRiskQty };
}

function renderKPIs(data) {
  const k = calcKPIs(data);

  document.getElementById('kpi-sales').textContent      = fmtMoney(k.totalSales);
  document.getElementById('kpi-qty').textContent        = fmtNum(k.totalSalesQty);
  document.getElementById('kpi-inventory').textContent  = fmtMoney(k.totalInvValue);
  document.getElementById('kpi-sellthrough').textContent = (k.sellThrough * 100).toFixed(1);
  document.getElementById('kpi-highrisk').textContent   = fmtNum(k.highRiskQty);

  // Sell-through dynamic colour
  const stEl = document.getElementById('kpi-sellthrough');
  stEl.className = 'kpi-value ' + (k.sellThrough >= 0.6 ? 'val-green' : k.sellThrough >= 0.3 ? 'val-yellow' : 'val-red');

  // High-risk colour
  const hrEl = document.getElementById('kpi-highrisk');
  hrEl.className = 'kpi-value ' + (k.highRiskQty === 0 ? 'val-green' : 'val-red');

  // KPI card accent
  const stCard = document.getElementById('kpi-st-card');
  stCard.style.borderTopColor = k.sellThrough >= 0.6 ? 'var(--green-dot)'
                              : k.sellThrough >= 0.3 ? 'var(--yellow-dot)' : 'var(--red-dot)';
}

// ============================================================
// STORE RANKINGS
// ============================================================

function buildStores(data) {
  const map = {};
  data.forEach(r => {
    if (!map[r.Store]) {
      map[r.Store] = {
        store: r.Store, region: r.Region, grade: r.StoreGrade,
        salesAmt: 0, salesQty: 0, invValue: 0, invQty: 0,
        highRiskQty: 0, replenishCount: 0, clearanceCount: 0
      };
    }
    const s = map[r.Store];
    s.salesAmt   += r.SalesAmount;
    s.salesQty   += r.SalesQty;
    s.invValue   += r.InventoryValue;
    s.invQty     += r.InventoryQty;
    if (r.InventoryQty > 0 && r.StockAgeDays >= 180) s.highRiskQty += r.InventoryQty;

    const total = r.SalesQty + r.InventoryQty;
    const st = total > 0 ? r.SalesQty / total : 0;
    if (st >= 0.6 && r.InventoryQty <= 2) s.replenishCount++;
    if (r.StockAgeDays >= 180 && r.InventoryQty > 0) s.clearanceCount++;
  });

  return Object.values(map).map(s => {
    const total = s.salesQty + s.invQty;
    s.sellThrough = total > 0 ? s.salesQty / total : 0;
    s.status      = storeStatus(s);
    s.actionHint  = storeActionHint(s);
    return s;
  }).sort((a, b) => b.salesAmt - a.salesAmt);
}

function storeStatus(s) {
  const hasHighRisk = s.highRiskQty > 0;
  if (s.sellThrough < 0.3 || (hasHighRisk && s.invValue > s.salesAmt)) return 'red';
  if (s.sellThrough < 0.6 || hasHighRisk) return 'yellow';
  return 'green';
}

function storeActionHint(s) {
  const parts = [];
  if (s.replenishCount > 0) parts.push(`補貨 ${s.replenishCount} 款`);
  if (s.clearanceCount > 0) parts.push(`清貨 ${s.clearanceCount} 款`);
  if (s.status === 'red' && parts.length === 0) parts.push('需即時跟進');
  return parts.length ? parts.join('，') : '維持現狀';
}

function renderStoreTable(data) {
  const stores  = buildStores(data);
  const tbody   = document.getElementById('store-tbody');

  if (stores.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="no-data">無符合條件的資料</td></tr>';
    return;
  }

  tbody.innerHTML = stores.map((s, i) => {
    const rank  = i + 1;
    const rk    = rank <= 3 ? `rank-${rank}` : 'rank-n';
    const pct   = (s.sellThrough * 100).toFixed(1);
    const stCls = s.sellThrough >= 0.6 ? 'high' : s.sellThrough >= 0.3 ? 'mid' : 'low';
    const stLbl = s.status === 'green' ? '正常' : s.status === 'yellow' ? '留意' : '跟進';

    return `<tr>
      <td style="text-align:center"><span class="rank ${rk}">${rank}</span></td>
      <td><strong>${esc(s.store)}</strong></td>
      <td>${esc(s.region)}</td>
      <td><span class="grade grade-${esc(s.grade)}">${esc(s.grade)}</span></td>
      <td class="td-num">HK$ ${fmtMoney(s.salesAmt)}</td>
      <td class="td-num">${fmtNum(s.salesQty)}</td>
      <td class="td-num">HK$ ${fmtMoney(s.invValue)}</td>
      <td>
        <div class="st-wrap">
          <div class="st-track"><div class="st-fill ${stCls}" style="width:${Math.min(parseFloat(pct),100)}%"></div></div>
          <span class="st-pct ${stCls}">${pct}%</span>
        </div>
      </td>
      <td style="text-align:center">
        <span class="status-light status-${s.status}">
          <span class="status-dot"></span>${stLbl}
        </span>
      </td>
      <td class="action-hint">${esc(s.actionHint)}</td>
    </tr>`;
  }).join('');
}

// ============================================================
// TOP 10 BEST SELLERS
// ============================================================

function buildTopSellers(data) {
  const map = {};
  data.forEach(r => {
    if (!map[r.Model]) map[r.Model] = { model: r.Model, category: r.Category, salesAmt: 0, salesQty: 0 };
    map[r.Model].salesAmt += r.SalesAmount;
    map[r.Model].salesQty += r.SalesQty;
  });
  return Object.values(map).sort((a, b) => b.salesAmt - a.salesAmt).slice(0, 10);
}

function renderTopSellers(data) {
  const items = buildTopSellers(data);
  const tbody = document.getElementById('sellers-tbody');
  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="no-data">無資料</td></tr>';
    return;
  }
  tbody.innerHTML = items.map((item, i) => {
    const rk = i < 3 ? `rank-${i+1}` : 'rank-n';
    return `<tr>
      <td style="text-align:center"><span class="rank ${rk}">${i+1}</span></td>
      <td><strong>${esc(item.model)}</strong></td>
      <td><span class="cat">${esc(item.category)}</span></td>
      <td class="td-num">HK$ ${fmtMoney(item.salesAmt)}</td>
      <td class="td-num">${fmtNum(item.salesQty)}</td>
    </tr>`;
  }).join('');
}

// ============================================================
// TOP 10 SLOW MOVERS
// ============================================================

function buildSlowMovers(data) {
  const map = {};
  data.forEach(r => {
    if (r.InventoryQty <= 0) return;
    if (!map[r.Model]) {
      map[r.Model] = {
        model: r.Model, category: r.Category,
        invQty: 0, invValue: 0, weightedAge: 0, salesQty: 0
      };
    }
    const m = map[r.Model];
    m.invQty     += r.InventoryQty;
    m.invValue   += r.InventoryValue;
    m.weightedAge += r.StockAgeDays * r.InventoryQty;
    m.salesQty   += r.SalesQty;
  });

  return Object.values(map)
    .map(m => ({ ...m, avgAge: m.invQty > 0 ? Math.round(m.weightedAge / m.invQty) : 0 }))
    .sort((a, b) => (b.avgAge * b.invQty) - (a.avgAge * a.invQty))
    .slice(0, 10);
}

function renderSlowMovers(data) {
  const items = buildSlowMovers(data);
  const tbody = document.getElementById('movers-tbody');
  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="no-data">無資料</td></tr>';
    return;
  }
  tbody.innerHTML = items.map((item, i) => {
    const sugCls = item.avgAge >= 180 ? 'suggest-clear' : 'suggest-monitor';
    const sugLbl = item.avgAge >= 180 ? '建議清貨' : '持續監察';
    return `<tr>
      <td style="text-align:center"><span class="rank rank-n">${i+1}</span></td>
      <td><strong>${esc(item.model)}</strong></td>
      <td><span class="cat">${esc(item.category)}</span></td>
      <td class="td-num">${fmtNum(item.invQty)}</td>
      <td class="td-num">HK$ ${fmtMoney(item.invValue)}</td>
      <td class="td-num">${item.avgAge} 日</td>
      <td><span class="suggest ${sugCls}">${sugLbl}</span></td>
    </tr>`;
  }).join('');
}

// ============================================================
// ACTION LIST
// ============================================================

function buildActions(data) {
  // Store-level aggregates for regional manager trigger
  const storeMap = {};
  data.forEach(r => {
    if (!storeMap[r.Store]) {
      storeMap[r.Store] = { store: r.Store, region: r.Region, grade: r.StoreGrade, salesAmt: 0, invValue: 0 };
    }
    storeMap[r.Store].salesAmt  += r.SalesAmount;
    storeMap[r.Store].invValue  += r.InventoryValue;
  });
  const storeList = Object.values(storeMap);
  const avgSales  = storeList.length ? storeList.reduce((s, x) => s + x.salesAmt, 0) / storeList.length : 0;
  const avgInv    = storeList.length ? storeList.reduce((s, x) => s + x.invValue, 0) / storeList.length : 0;

  // 1. Replenishment: sellthrough >= 60% AND InventoryQty <= 2
  const replenish = data
    .filter(r => {
      const total = r.SalesQty + r.InventoryQty;
      const st = total > 0 ? r.SalesQty / total : 0;
      return st >= 0.6 && r.InventoryQty <= 2;
    })
    .map(r => {
      const total = r.SalesQty + r.InventoryQty;
      return { store: r.Store, model: r.Model, category: r.Category,
               invQty: r.InventoryQty, st: total > 0 ? r.SalesQty / total : 0 };
    })
    .sort((a, b) => b.st - a.st);

  // 2. Clearance: StockAgeDays >= 180 AND InventoryQty > 0
  const clearance = data
    .filter(r => r.StockAgeDays >= 180 && r.InventoryQty > 0)
    .map(r => ({ store: r.Store, model: r.Model, category: r.Category,
                 invQty: r.InventoryQty, age: r.StockAgeDays, invValue: r.InventoryValue }))
    .sort((a, b) => b.age - a.age);

  // 3. Regional manager: store salesAmt < avg AND invValue > avg
  const manager = storeList
    .filter(s => s.salesAmt < avgSales && s.invValue > avgInv)
    .sort((a, b) => b.invValue - a.invValue);

  return { replenish, clearance, manager, avgSales, avgInv };
}

function renderActionList(data) {
  const { replenish, clearance, manager } = buildActions(data);

  // Replenishment
  const repDiv = document.getElementById('action-replenish');
  if (replenish.length === 0) {
    repDiv.innerHTML = '<p class="no-data">目前無需補貨</p>';
  } else {
    repDiv.innerHTML = replenish.slice(0, 12).map(x => `
      <div class="action-item">
        <span class="ai-store">${esc(x.store)}</span>
        <span class="ai-detail">
          <span class="cat">${esc(x.category)}</span> ${esc(x.model)}
          &nbsp;｜ 庫存 ${x.invQty} 件 &nbsp;｜ 售罄率 ${(x.st * 100).toFixed(0)}%
        </span>
      </div>`).join('');
  }

  // Clearance
  const clrDiv = document.getElementById('action-clearance');
  if (clearance.length === 0) {
    clrDiv.innerHTML = '<p class="no-data">目前無需清貨</p>';
  } else {
    clrDiv.innerHTML = clearance.slice(0, 12).map(x => `
      <div class="action-item">
        <span class="ai-store">${esc(x.store)}</span>
        <span class="ai-detail">
          <span class="cat">${esc(x.category)}</span> ${esc(x.model)}
          &nbsp;｜ 庫存 ${x.invQty} 件 &nbsp;｜ 庫齡 ${x.age} 日
        </span>
      </div>`).join('');
  }

  // Regional manager
  const mgrDiv = document.getElementById('action-manager');
  if (manager.length === 0) {
    mgrDiv.innerHTML = '<p class="no-data">目前無需跟進</p>';
  } else {
    mgrDiv.innerHTML = manager.map(s => `
      <div class="action-item">
        <span class="ai-store">
          ${esc(s.store)} <span class="grade grade-${esc(s.grade)}">${esc(s.grade)}</span>
        </span>
        <span class="ai-detail">
          ${esc(s.region)}
          &nbsp;｜ 銷售 HK$ ${fmtMoney(s.salesAmt)}
          &nbsp;｜ 庫存 HK$ ${fmtMoney(s.invValue)}
        </span>
      </div>`).join('');
  }
}

// ============================================================
// FORMATTING HELPERS
// ============================================================

function fmtMoney(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 10000)   return (n / 1000).toFixed(0) + 'K';
  if (n >= 1000)    return (n / 1000).toFixed(1) + 'K';
  return n.toFixed(0);
}

function fmtNum(n) {
  return Number(n).toLocaleString('zh-HK');
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================
// EMBEDDED SAMPLE DATA (fallback — works with file:// protocol)
// Identical to sample_data.csv
// ============================================================
const SAMPLE_CSV = `Store,Region,StoreGrade,Category,Model,SalesAmount,SalesQty,InventoryQty,InventoryValue,StockAgeDays
中環旗艦店,香港,AA,G,G001,288000,36,4,32000,28
中環旗艦店,香港,AA,G,G002,450000,30,3,45000,15
中環旗艦店,香港,AA,G,G003,198000,33,5,30000,40
中環旗艦店,香港,AA,J1,J101,1050000,30,2,70000,22
中環旗艦店,香港,AA,J1,J102,540000,30,3,54000,18
中環旗艦店,香港,AA,J1,J103,1350000,30,1,45000,30
中環旗艦店,香港,AA,J5,J501,195000,30,4,26000,35
中環旗艦店,香港,AA,A1,A001,96000,120,15,12000,20
中環旗艦店,香港,AA,T1,T101,840000,30,2,56000,45
中環旗艦店,香港,AA,T1,T102,555000,30,3,55500,35
尖沙咀店,香港,AA,G,G001,224000,28,5,40000,32
尖沙咀店,香港,AA,G,G002,390000,26,4,60000,20
尖沙咀店,香港,AA,G,G004,137500,25,6,33000,25
尖沙咀店,香港,AA,J1,J101,980000,28,3,105000,28
尖沙咀店,香港,AA,J1,J102,504000,28,4,72000,22
尖沙咀店,香港,AA,J1,J104,616000,28,3,66000,30
尖沙咀店,香港,AA,J5,J501,169000,26,5,32500,38
尖沙咀店,香港,AA,A1,A001,84000,105,18,14400,25
尖沙咀店,香港,AA,T1,T101,756000,27,2,56000,50
尖沙咀店,香港,AA,T1,T102,518000,28,4,74000,40
路氹城店,澳門,AA,G,G001,320000,40,3,24000,15
路氹城店,澳門,AA,G,G002,480000,32,2,30000,10
路氹城店,澳門,AA,G,G003,228000,38,3,18000,20
路氹城店,澳門,AA,J1,J101,1225000,35,2,70000,18
路氹城店,澳門,AA,J1,J102,630000,35,2,36000,15
路氹城店,澳門,AA,J1,J103,1575000,35,1,45000,25
路氹城店,澳門,AA,J5,J502,480000,40,3,36000,20
路氹城店,澳門,AA,A1,A001,120000,150,12,9600,15
路氹城店,澳門,AA,T1,T101,980000,35,2,56000,30
路氹城店,澳門,AA,T1,T102,629000,34,3,55500,25
銅鑼灣店,香港,A,G,G001,192000,24,6,48000,45
銅鑼灣店,香港,A,G,G002,300000,20,5,75000,35
銅鑼灣店,香港,A,G,G003,150000,25,6,36000,55
銅鑼灣店,香港,A,J1,J101,700000,20,4,140000,40
銅鑼灣店,香港,A,J1,J102,360000,20,5,90000,35
銅鑼灣店,香港,A,J5,J501,130000,20,5,32500,60
銅鑼灣店,香港,A,A1,A001,60000,75,20,16000,30
銅鑼灣店,香港,A,T1,T101,560000,20,3,84000,60
銅鑼灣店,香港,A,T1,T102,370000,20,5,92500,45
旺角店,香港,A,G,G001,168000,21,7,56000,50
旺角店,香港,A,G,G002,270000,18,6,90000,40
旺角店,香港,A,G,G003,126000,21,7,42000,60
旺角店,香港,A,J1,J101,630000,18,5,175000,45
旺角店,香港,A,J5,J501,117000,18,6,39000,70
旺角店,香港,A,J5,J502,216000,18,5,60000,55
旺角店,香港,A,A1,A001,54000,67,22,17600,35
旺角店,香港,A,A1,A002,48000,40,15,18000,45
旺角店,香港,A,T1,T102,333000,18,6,111000,50
半島店,澳門,A,G,G001,200000,25,5,40000,30
半島店,澳門,A,G,G002,330000,22,5,75000,25
半島店,澳門,A,J1,J101,770000,22,4,140000,35
半島店,澳門,A,J1,J102,396000,22,4,72000,28
半島店,澳門,A,J5,J501,143000,22,5,32500,40
半島店,澳門,A,A1,A001,66000,82,18,14400,22
半島店,澳門,A,T1,T101,616000,22,3,84000,42
新加坡烏節路店,海外,A,G,G001,176000,22,6,48000,45
新加坡烏節路店,海外,A,G,G002,300000,20,5,75000,40
新加坡烏節路店,海外,A,J1,J101,700000,20,5,175000,50
新加坡烏節路店,海外,A,J1,J104,440000,20,5,110000,45
新加坡烏節路店,海外,A,J5,J503,96000,20,6,28800,55
新加坡烏節路店,海外,A,A1,A002,60000,50,20,24000,40
新加坡烏節路店,海外,A,T1,T102,370000,20,5,92500,50
沙田新城市店,香港,B,G,G001,128000,16,8,64000,60
沙田新城市店,香港,B,G,G003,108000,18,8,48000,75
沙田新城市店,香港,B,G,G004,110000,20,8,44000,65
沙田新城市店,香港,B,J1,J102,288000,16,7,126000,65
沙田新城市店,香港,B,J5,J501,104000,16,8,52000,80
沙田新城市店,香港,B,A1,A001,40000,50,25,20000,45
沙田新城市店,香港,B,A1,A003,30000,50,20,12000,55
屯門市廣場店,香港,B,G,G001,96000,12,10,80000,90
屯門市廣場店,香港,B,G,G004,82500,15,10,55000,120
屯門市廣場店,香港,B,J1,J102,216000,12,8,144000,95
屯門市廣場店,香港,B,J5,J501,78000,12,10,65000,200
屯門市廣場店,香港,B,J5,J503,48000,10,12,57600,210
屯門市廣場店,香港,B,A1,A001,24000,30,30,24000,80
屯門市廣場店,香港,B,A1,A002,24000,20,20,24000,185
屯門市廣場店,香港,B,T1,T102,185000,10,8,148000,110
東京銀座店,海外,B,G,G002,225000,15,8,120000,90
東京銀座店,海外,B,G,G003,126000,21,8,48000,100
東京銀座店,海外,B,J1,J101,525000,15,8,280000,95
東京銀座店,海外,B,J5,J502,180000,15,10,120000,195
東京銀座店,海外,B,J5,J503,72000,15,12,57600,220
東京銀座店,海外,B,A1,A001,24000,30,25,20000,115
東京銀座店,海外,B,T1,T101,420000,15,8,224000,105
元朗廣場店,香港,C,G,G001,56000,7,15,120000,140
元朗廣場店,香港,C,G,G002,90000,6,12,180000,185
元朗廣場店,香港,C,G,G003,48000,8,12,72000,150
元朗廣場店,香港,C,J1,J101,175000,5,12,420000,130
元朗廣場店,香港,C,J1,J102,90000,5,10,180000,195
元朗廣場店,香港,C,J5,J501,45500,7,10,65000,160
元朗廣場店,香港,C,A1,A001,8000,10,35,28000,120
元朗廣場店,香港,C,T1,T102,74000,4,10,185000,155`;
