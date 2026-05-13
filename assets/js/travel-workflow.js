/**
 * travel-workflow.js
 * 出差申請兩頁式流程
 *
 * 依賴：
 *   - app.js          → AppUtils（localStorage、OCR、日期 dropdown、webhook）
 *   - form-options.js → FormOptions（select 填充）
 *   - passport-ocr.js → PassportOcr（護照 OCR 解析）
 *
 * 對外暴露：window.TravelWorkflow
 */
window.TravelWorkflow = (() => {
  const MODULE_KEY   = 'travel-requests';
  const MODULE_LABEL = '出差申請';

  const STATUS = {
    DRAFT:     '待提交',
    PENDING:   '待審批',
    RETURNED:  '已退回',
    TO_BOOK:   '待訂購',
    BOOKED:    '已訂票',
    COMPLETED: '已完成'
  };

  const DECISION = {
    APPROVED: 'approved',
    RETURNED: 'returned',
    PENDING:  'pending'
  };

  // ── 工具 ──────────────────────────────────────────────────────

  function qs(id) { return document.getElementById(id); }

  function currentDateTimeLocal() {
    const now = new Date();
    const p = v => AppUtils.pad(v);
    return `${now.getFullYear()}-${p(now.getMonth()+1)}-${p(now.getDate())}T${p(now.getHours())}:${p(now.getMinutes())}`;
  }

  // ── URL 管理 ──────────────────────────────────────────────────

  function getUrlRequestNo() {
    return new URLSearchParams(window.location.search).get('requestNo') || '';
  }

  function setUrlRequestNo(requestNo) {
    const url = new URL(window.location.href);
    url.searchParams.set('requestNo', requestNo);
    history.replaceState({}, '', url.toString());
  }

  function buildPageLink(pageName, requestNo) {
    const url  = new URL(window.location.href);
    const base = url.pathname.replace(/\/[^/]*$/, '/' + pageName);
    return `${url.origin}${base}?requestNo=${encodeURIComponent(requestNo)}`;
  }

  // ── 資料存取 ──────────────────────────────────────────────────

  function loadTravelRequests() {
    return AppUtils.loadRecords(MODULE_KEY);
  }

  function getTravelRequest(requestNo) {
    return loadTravelRequests().find(row => row.requestNo === requestNo) || null;
  }

  function saveTravelRecord(payload) {
    return AppUtils.saveRecord(MODULE_KEY, payload);
  }

  function mergeRecord(existing, patch) {
    return {
      ...existing,
      ...patch,
      approval: { ...(existing.approval || {}), ...(patch.approval || {}) },
      booking:  { ...(existing.booking  || {}), ...(patch.booking  || {}) },
      files:    { ...(existing.files    || {}), ...(patch.files    || {}) },
      updatedAt: new Date().toISOString()
    };
  }

  function baseRecord() {
    return {
      moduleType: MODULE_LABEL,
      requestNo:  '',
      status:     STATUS.DRAFT,
      applicant:  '',
      storeDept:  '',
      origin:     '',
      destination: '',
      departureDate: '',
      hasCheckedBaggage: false,
      purpose:    '',
      travelerEnglishName: '',
      documentType:   '',
      documentNumber: '',
      nationality:    '',
      birthDate:  '',
      expiryDate: '',
      approval: {
        approver:    '',
        approvedAt:  '',
        decision:    DECISION.PENDING,
        comment:     ''
      },
      booking: {
        handler:       '',
        bookingStatus: '',
        selectedType:  '',
        flightSummary: '',
        tripUrl:       '',
        pnr:           '',
        ticketAmount:  0,
        currency:      'HKD',
        bookedAt:      ''
      },
      files: { document: [] }
    };
  }

  // ── 附件 ──────────────────────────────────────────────────────

  function renderPreview(containerEl, files) {
    if (!containerEl) return;
    if (!files.length) {
      containerEl.innerHTML = '<div class="note">未上傳附件</div>';
      return;
    }
    containerEl.innerHTML = files.map(file => {
      if (String(file.type || '').startsWith('image/')) {
        return `<img src="${file.dataUrl}" alt="${AppUtils.escapeHtml(file.name)}">`;
      }
      return `<div class="summary-box"><span>附件</span><strong>${AppUtils.escapeHtml(file.name)}</strong></div>`;
    }).join('');
  }

  // ── Trip.com 查價 ─────────────────────────────────────────────

  function buildSearchUrl(record, mode = 'all') {
    const params = new URLSearchParams();
    if (record.origin)        params.set('from',       record.origin);
    if (record.destination)   params.set('to',         record.destination);
    if (record.departureDate) params.set('departDate', record.departureDate);
    params.set('tripType', '單程');
    params.set('mode', mode);
    return `https://hk.trip.com/flights/?${params.toString()}`;
  }

  function buildSearchSummary(record, mode = 'all') {
    const modeLabel = mode === 'direct' ? '直航' : mode === 'transfer' ? '轉機' : '全部';
    return [
      `查價模式：${modeLabel}`,
      `航線：${record.origin || '未填'} → ${record.destination || '未填'}`,
      `出發日期：${record.departureDate || '未填'}`,
      `寄艙行李：${record.hasCheckedBaggage ? '需要' : '不需要'}`,
      `出差原因：${record.purpose || '未填'}`
    ].join('\n');
  }

  // ── Webhook ───────────────────────────────────────────────────

  function buildWebhookEnvelope(eventType, record, extra = {}) {
    const requestNo = record.requestNo;
    return {
      moduleType:  MODULE_LABEL,
      eventType,
      requestNo,
      status:      record.status,
      eventTime:   new Date().toISOString(),
      applicant:   record.applicant,
      storeDept:   record.storeDept,
      origin:      record.origin,
      destination: record.destination,
      departureDate:       record.departureDate,
      hasCheckedBaggage:   !!record.hasCheckedBaggage,
      purpose:             record.purpose,
      travelerEnglishName: record.travelerEnglishName,
      documentNumber:      record.documentNumber,
      approvalPageUrl: buildPageLink('travel-approval-booking.html', requestNo),
      requestPageUrl:  buildPageLink('travel-request.html', requestNo),
      ...extra
    };
  }

  async function notifyWebhook(eventType, record, extra = {}) {
    const payload = buildWebhookEnvelope(eventType, record, extra);
    try {
      await AppUtils.postToWebhook(payload);
      return { ok: true, payload };
    } catch (error) {
      return { ok: false, error, payload };
    }
  }

  // ── 表單輔助 ──────────────────────────────────────────────────

  function fillForm(record, mapping) {
    Object.entries(mapping).forEach(([key, id]) => {
      const el = qs(id);
      if (!el) return;
      if (el.type === 'checkbox') {
        el.checked = !!record[key];
      } else {
        AppUtils.setInputValue(el, record[key]);
      }
    });
  }

  function setText(id, value, fallback = '—') {
    const el = qs(id);
    if (el) el.textContent = value || fallback;
  }

  function setHtml(id, value) {
    const el = qs(id);
    if (el) el.innerHTML = value;
  }

  function renderRequestTable(tbodyId) {
    const body = qs(tbodyId);
    if (!body) return;
    const rows = loadTravelRequests();
    body.innerHTML = rows.length
      ? rows.map(row => `
        <tr>
          <td>${AppUtils.escapeHtml(row.requestNo)}</td>
          <td>${AppUtils.escapeHtml(row.applicant)}</td>
          <td>${AppUtils.escapeHtml(row.storeDept)}</td>
          <td>${AppUtils.escapeHtml(row.origin)} → ${AppUtils.escapeHtml(row.destination)}</td>
          <td>${AppUtils.escapeHtml(row.departureDate)}</td>
          <td>${row.hasCheckedBaggage ? '需要' : '不需要'}</td>
          <td>${AppUtils.escapeHtml(row.status)}</td>
        </tr>`).join('')
      : '<tr><td colspan="7" class="empty-cell">暫時未有記錄</td></tr>';
  }

  function refreshRequestSummary() {
    setText('summaryApplicant', qs('applicant')?.value.trim(), '未填寫');
    const o = qs('origin')?.value.trim() || '未填';
    const d = qs('destination')?.value.trim() || '未填';
    setText('summaryRoute', (o === '未填' && d === '未填') ? '未填寫' : `${o} → ${d}`);
    setText('summaryDate', qs('departureDate')?.value || '未填寫');
    setText('summaryBaggage', qs('hasCheckedBaggage')?.checked ? '需要寄艙' : '不需要');
  }

  // ── 表單收集 / 驗證 ───────────────────────────────────────────

  function collectRequestForm(fileStore) {
    const requestNoEl = qs('requestNo');
    AppUtils.ensureRequestNo(requestNoEl, MODULE_LABEL, MODULE_KEY);
    AppUtils.syncDateHidden('departure');
    AppUtils.syncDateHidden('birth');
    AppUtils.syncDateHidden('expiry');

    return mergeRecord(baseRecord(), {
      requestNo:   requestNoEl.value.trim(),
      status:      qs('status')?.value || STATUS.DRAFT,
      applicant:   qs('applicant')?.value.trim() || '',
      storeDept:   qs('storeDept')?.value || '',
      origin:      (qs('origin')?.value || '').trim().toUpperCase(),
      destination: (qs('destination')?.value || '').trim().toUpperCase(),
      departureDate:       qs('departureDate')?.value || '',
      hasCheckedBaggage:   !!qs('hasCheckedBaggage')?.checked,
      purpose:             qs('purpose')?.value.trim() || '',
      travelerEnglishName: qs('travelerEnglishName')?.value.trim() || '',
      documentType:        qs('documentType')?.value.trim() || '',
      documentNumber:      qs('documentNumber')?.value.trim() || '',
      nationality:         qs('nationality')?.value.trim() || '',
      birthDate:   qs('birthDate')?.value  || '',
      expiryDate:  qs('expiryDate')?.value || '',
      files: { document: fileStore.document }
    });
  }

  function validateRequest(record) {
    const errors = [];
    if (!record.applicant)    errors.push('申請人');
    if (!record.storeDept)    errors.push('店舖 / 部門');
    if (!record.origin)       errors.push('起點');
    if (!record.destination)  errors.push('終點');
    if (!record.departureDate) errors.push('出發日期');
    if (!record.purpose)      errors.push('出差原因');
    if (!record.files.document.length) errors.push('證件圖片');
    return errors;
  }

  // ── OCR 讀取 ─────────────────────────────────────────────────

  async function recognizeDocumentFiles(fileStore, statusEl) {
    if (!fileStore.document.length) {
      statusEl.textContent = '請先上傳證件圖片。';
      return null;
    }
    const results = await AppUtils.recognizeFiles(fileStore.document, statusEl);
    const text    = results.map(row => row.text).join('\n');
    return PassportOcr.parseTravelDocumentText(text);
  }

  // ── 第一頁：出差申請 ──────────────────────────────────────────

  async function initializeTravelRequestPage() {
    if (!qs('travelRequestPage')) return;

    const requestNoEl    = qs('requestNo');
    const statusEl       = qs('status');
    const statusHintEl   = qs('statusHint');
    const ocrStatusEl    = qs('ocrStatus');
    const webhookStatusEl = qs('webhookStatus');
    const fileInputEl    = qs('documentFile');
    const fileStore      = { document: [] };
    const currentYear    = new Date().getFullYear();

    FormOptions.fillSelect(statusEl, [STATUS.DRAFT, STATUS.PENDING, STATUS.RETURNED, STATUS.TO_BOOK, STATUS.BOOKED, STATUS.COMPLETED]);
    FormOptions.fillSelect(qs('storeDept'), window.FORM_OPTIONS.storeCodes, { placeholder: '請選擇店舖' });
    AppUtils.initDateDropdowns('departure', { startYear: currentYear - 1, endYear: currentYear + 3 });
    AppUtils.initDateDropdowns('birth',     { startYear: currentYear - 100, endYear: currentYear });
    AppUtils.initDateDropdowns('expiry',    { startYear: currentYear - 10,  endYear: currentYear + 20 });

    function applyRecord(record) {
      fillForm(record, {
        requestNo:  'requestNo',
        status:     'status',
        applicant:  'applicant',
        storeDept:  'storeDept',
        origin:     'origin',
        destination: 'destination',
        purpose:    'purpose',
        travelerEnglishName: 'travelerEnglishName',
        documentType:   'documentType',
        documentNumber: 'documentNumber',
        nationality:    'nationality'
      });
      AppUtils.applyDateToDropdowns('departure', record.departureDate || '');
      AppUtils.applyDateToDropdowns('birth',     record.birthDate     || '');
      AppUtils.applyDateToDropdowns('expiry',    record.expiryDate    || '');
      qs('hasCheckedBaggage').checked = !!record.hasCheckedBaggage;
      fileStore.document = record.files?.document || [];
      renderPreview(qs('documentPreview'), fileStore.document);
      refreshRequestSummary();
      statusHintEl.textContent = `目前狀態：${record.status || STATUS.DRAFT}`;
    }

    const existing = getUrlRequestNo() ? getTravelRequest(getUrlRequestNo()) : null;
    if (existing) {
      applyRecord(existing);
    } else {
      AppUtils.ensureRequestNo(requestNoEl, MODULE_LABEL, MODULE_KEY);
      AppUtils.applyDateToDropdowns('departure', '');
      AppUtils.applyDateToDropdowns('birth', '');
      AppUtils.applyDateToDropdowns('expiry', '');
      refreshRequestSummary();
      renderPreview(qs('documentPreview'), []);
    }

    fileInputEl?.addEventListener('change', async event => {
      fileStore.document = await AppUtils.filesToStore(event.target.files);
      renderPreview(qs('documentPreview'), fileStore.document);
    });

    document.querySelectorAll('#travelRequestPage input, #travelRequestPage select, #travelRequestPage textarea').forEach(el => {
      el.addEventListener('input',  refreshRequestSummary);
      el.addEventListener('change', refreshRequestSummary);
    });

    qs('readDocumentBtn')?.addEventListener('click', async () => {
      try {
        const data = await recognizeDocumentFiles(fileStore, ocrStatusEl);
        if (!data) return;
        fillForm(data, {
          travelerEnglishName: 'travelerEnglishName',
          documentType:   'documentType',
          documentNumber: 'documentNumber',
          nationality:    'nationality'
        });
        AppUtils.applyDateToDropdowns('birth',  data.birthDate  || qs('birthDate')?.value  || '');
        AppUtils.applyDateToDropdowns('expiry', data.expiryDate || qs('expiryDate')?.value || '');
        ocrStatusEl.textContent = '已完成讀取證件資料，優先採用可見文字，不足時 fallback 至 MRZ 機讀區。';
      } catch {
        ocrStatusEl.textContent = '未能完成讀取，請手動補回資料。';
      }
    });

    qs('saveDraftBtn')?.addEventListener('click', () => {
      const record = collectRequestForm(fileStore);
      record.status = STATUS.DRAFT;
      saveTravelRecord(record);
      setUrlRequestNo(record.requestNo);
      statusHintEl.textContent = `目前狀態：${record.status}`;
      renderRequestTable('requestRecordsBody');
      alert('已儲存草稿。');
    });

    qs('submitRequestBtn')?.addEventListener('click', async () => {
      const record = collectRequestForm(fileStore);
      const errors = validateRequest(record);
      if (errors.length) {
        alert(`請先補回以下資料：\n- ${errors.join('\n- ')}`);
        return;
      }

      record.status   = STATUS.PENDING;
      record.approval = { approver: '', approvedAt: '', decision: DECISION.PENDING, comment: '' };

      const saved = saveTravelRecord(record);
      setUrlRequestNo(saved.requestNo);
      statusHintEl.textContent = `目前狀態：${saved.status}`;
      renderRequestTable('requestRecordsBody');

      const result = await notifyWebhook('travel.request.submitted', saved);
      webhookStatusEl.textContent = result.ok
        ? '已送出通知到 webhook / 企業微信流程。'
        : '已儲存申請，但 webhook 未成功送出，請檢查 config.js。';

      alert('已提交出差申請。');
    });

    renderRequestTable('requestRecordsBody');
  }

  // ── 第二頁：出差審批及訂購 ────────────────────────────────────

  function renderApprovalSelect(selectId) {
    const selectEl = qs(selectId);
    if (!selectEl) return;
    const rows    = loadTravelRequests();
    const options = rows.map(row => row.requestNo).filter(Boolean);
    FormOptions.fillSelect(selectEl, options, { placeholder: '請選擇申請編號', preserveValue: false });
    const target = getUrlRequestNo();
    if (target) selectEl.value = target;
  }

  function populateApprovalView(record) {
    if (!record) return;

    setText('viewRequestNo',          record.requestNo);
    setText('viewApplicant',          record.applicant);
    setText('viewStoreDept',          record.storeDept);
    setText('viewRoute',              `${record.origin || '—'} → ${record.destination || '—'}`);
    setText('viewDepartureDate',      record.departureDate);
    setText('viewBaggage',            record.hasCheckedBaggage ? '需要寄艙' : '不需要');
    setText('viewPurpose',            record.purpose);
    setText('viewStatus',             record.status);
    setText('viewTravelerEnglishName', record.travelerEnglishName);
    setText('viewDocumentType',       record.documentType);
    setText('viewDocumentNumber',     record.documentNumber);
    setText('viewNationality',        record.nationality);
    setText('viewBirthDate',          record.birthDate);
    setText('viewExpiryDate',         record.expiryDate);
    setText('approvalCurrentStatus',  record.status);

    renderPreview(qs('approvalDocumentPreview'), record.files?.document || []);

    AppUtils.setInputValue(qs('approver'),        record.approval?.approver  || '');
    AppUtils.setInputValue(qs('approvalComment'), record.approval?.comment   || '');

    const bookingVisible = [STATUS.TO_BOOK, STATUS.BOOKED, STATUS.COMPLETED].includes(record.status);
    qs('bookingSection').style.display = bookingVisible ? 'block' : 'none';

    AppUtils.setInputValue(qs('bookingHandler'),  record.booking?.handler       || '');
    AppUtils.setInputValue(qs('selectedType'),    record.booking?.selectedType  || '');
    AppUtils.setInputValue(qs('flightSummary'),   record.booking?.flightSummary || '');
    AppUtils.setInputValue(qs('bookingPnr'),      record.booking?.pnr           || '');
    AppUtils.setInputValue(qs('ticketAmount'),    record.booking?.ticketAmount  || '');
    AppUtils.setInputValue(qs('ticketCurrency'),  record.booking?.currency      || 'HKD');
    AppUtils.setInputValue(qs('bookedAt'),        record.booking?.bookedAt      || currentDateTimeLocal());
    AppUtils.setInputValue(qs('tripUrl'),         record.booking?.tripUrl       || '');
    setText('bookingStatusText', record.booking?.bookingStatus || '未開始訂購');

    setHtml('directCardSummary',   `<pre style="white-space:pre-wrap;margin:0;">${AppUtils.escapeHtml(buildSearchSummary(record, 'direct'))}</pre>`);
    setHtml('transferCardSummary', `<pre style="white-space:pre-wrap;margin:0;">${AppUtils.escapeHtml(buildSearchSummary(record, 'transfer'))}</pre>`);
    AppUtils.setInputValue(qs('directUrl'),   buildSearchUrl(record, 'direct'));
    AppUtils.setInputValue(qs('transferUrl'), buildSearchUrl(record, 'transfer'));
  }

  async function initializeTravelApprovalPage() {
    if (!qs('travelApprovalPage')) return;

    renderApprovalSelect('requestSelector');
    FormOptions.fillSelect(qs('ticketCurrency'), window.FORM_OPTIONS.currencies, { preserveValue: false });
    FormOptions.fillSelect(qs('selectedType'),   ['直航', '轉機'], { placeholder: '請選擇方案', preserveValue: false });

    function currentRecord() {
      const requestNo = qs('requestSelector')?.value || getUrlRequestNo();
      return requestNo ? getTravelRequest(requestNo) : null;
    }

    function refreshApprovalPage(record = currentRecord()) {
      if (!record) {
        setText('viewRequestNo', '');
        qs('bookingSection').style.display = 'none';
        return;
      }
      setUrlRequestNo(record.requestNo);
      populateApprovalView(record);
      renderRequestTable('approvalRecordsBody');
    }

    qs('requestSelector')?.addEventListener('change', () => refreshApprovalPage(currentRecord()));

    const initial = currentRecord();
    if (initial) refreshApprovalPage(initial);
    renderRequestTable('approvalRecordsBody');

    qs('approveBtn')?.addEventListener('click', async () => {
      const record = currentRecord();
      if (!record) return alert('請先選擇申請。');
      const approver = qs('approver')?.value.trim();
      if (!approver)  return alert('請填寫審批人。');

      const next = mergeRecord(record, {
        status: STATUS.TO_BOOK,
        approval: {
          approver,
          approvedAt: new Date().toISOString(),
          decision:   DECISION.APPROVED,
          comment:    qs('approvalComment')?.value.trim() || ''
        }
      });

      const saved  = saveTravelRecord(next);
      const result = await notifyWebhook('travel.request.approved', saved, {
        approver:        saved.approval.approver,
        approvalComment: saved.approval.comment
      });

      qs('approvalActionStatus').textContent = result.ok
        ? '已批准，並已通知跟進訂購。'
        : '已批准，但 webhook 未成功送出。';

      refreshApprovalPage(saved);
      alert('已批准申請。');
    });

    qs('returnBtn')?.addEventListener('click', async () => {
      const record  = currentRecord();
      if (!record)  return alert('請先選擇申請。');
      const approver = qs('approver')?.value.trim();
      const comment  = qs('approvalComment')?.value.trim();
      if (!approver) return alert('請填寫審批人。');
      if (!comment)  return alert('請填寫退回原因。');

      const next = mergeRecord(record, {
        status: STATUS.RETURNED,
        approval: {
          approver,
          approvedAt: new Date().toISOString(),
          decision:   DECISION.RETURNED,
          comment
        }
      });

      const saved  = saveTravelRecord(next);
      const result = await notifyWebhook('travel.request.returned', saved, {
        approver:        saved.approval.approver,
        approvalComment: saved.approval.comment
      });

      qs('approvalActionStatus').textContent = result.ok
        ? '已退回申請，並已通知申請人補資料。'
        : '已退回申請，但 webhook 未成功送出。';

      refreshApprovalPage(saved);
      alert('已退回申請。');
    });

    qs('openDirectBtn')?.addEventListener('click', () => {
      const record = currentRecord();
      if (!record) return alert('請先選擇申請。');
      window.open(buildSearchUrl(record, 'direct'), '_blank');
    });

    qs('openTransferBtn')?.addEventListener('click', () => {
      const record = currentRecord();
      if (!record) return alert('請先選擇申請。');
      window.open(buildSearchUrl(record, 'transfer'), '_blank');
    });

    qs('applyDirectBtn')?.addEventListener('click', () => {
      const record = currentRecord();
      if (!record) return;
      qs('selectedType').value = '直航';
      qs('tripUrl').value      = buildSearchUrl(record, 'direct');
      if (!qs('flightSummary').value.trim()) {
        qs('flightSummary').value = `${record.origin} → ${record.destination}｜直航｜${record.departureDate}`;
      }
    });

    qs('applyTransferBtn')?.addEventListener('click', () => {
      const record = currentRecord();
      if (!record) return;
      qs('selectedType').value = '轉機';
      qs('tripUrl').value      = buildSearchUrl(record, 'transfer');
      if (!qs('flightSummary').value.trim()) {
        qs('flightSummary').value = `${record.origin} → ${record.destination}｜轉機｜${record.departureDate}`;
      }
    });

    qs('saveBookingBtn')?.addEventListener('click', async () => {
      const record = currentRecord();
      if (!record) return alert('請先選擇申請。');

      const handler      = qs('bookingHandler')?.value.trim();
      const selectedType = qs('selectedType')?.value;
      const flightSummary = qs('flightSummary')?.value.trim();
      const pnr          = qs('bookingPnr')?.value.trim();
      const amount       = Number(qs('ticketAmount')?.value || 0);

      if (!handler || !selectedType || !flightSummary || !pnr || amount <= 0) {
        return alert('請填妥訂購人、方案、航班摘要、PNR 及票價。');
      }

      const next = mergeRecord(record, {
        status: STATUS.BOOKED,
        booking: {
          handler,
          bookingStatus: STATUS.BOOKED,
          selectedType,
          flightSummary,
          tripUrl:      qs('tripUrl')?.value.trim() || '',
          pnr,
          ticketAmount: amount,
          currency:     qs('ticketCurrency')?.value || 'HKD',
          bookedAt:     qs('bookedAt')?.value || currentDateTimeLocal()
        }
      });

      const saved  = saveTravelRecord(next);
      const result = await notifyWebhook('travel.booking.completed', saved, {
        bookingHandler: saved.booking.handler,
        bookingType:    saved.booking.selectedType,
        bookingPnr:     saved.booking.pnr,
        ticketAmount:   saved.booking.ticketAmount,
        currency:       saved.booking.currency
      });

      qs('approvalActionStatus').textContent = result.ok
        ? '已記錄訂購結果，並已通知相關人。'
        : '已記錄訂購結果，但 webhook 未成功送出。';

      refreshApprovalPage(saved);
      alert('已儲存訂購結果。');
    });

    qs('markCompletedBtn')?.addEventListener('click', () => {
      const record = currentRecord();
      if (!record) return alert('請先選擇申請。');
      if (record.status !== STATUS.BOOKED) return alert('請先完成訂票，再標記完成。');
      const next  = mergeRecord(record, { status: STATUS.COMPLETED });
      const saved = saveTravelRecord(next);
      qs('approvalActionStatus').textContent = '已標記為完成。';
      refreshApprovalPage(saved);
      alert('已完成整個流程。');
    });
  }

  return {
    STATUS,
    buildWebhookEnvelope,
    initializeTravelRequestPage,
    initializeTravelApprovalPage
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  window.TravelWorkflow.initializeTravelRequestPage();
  window.TravelWorkflow.initializeTravelApprovalPage();
});
