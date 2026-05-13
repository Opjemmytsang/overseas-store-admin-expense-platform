/**
 * passport-ocr.js
 * 護照 / 旅遊證件 OCR 解析模組
 *
 * 解析策略（依優先順序）：
 *   1. 先從可見文字欄位讀取姓名、證件號碼、國籍、出生日期、到期日
 *   2. 如可見文字不足，fallback 至護照 MRZ 機讀區（P< 開頭行）
 *   3. 最後 fallback 至 AppUtils 的通用日期 / 姓名提取器
 *
 * 對外暴露：window.PassportOcr.parseTravelDocumentText(text) → object
 */
window.PassportOcr = (() => {

  // ── 文字正規化 ──────────────────────────────────────────────────

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function escapeRegex(text) {
    return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ── 年份推算 ────────────────────────────────────────────────────

  function inferCenturyForBirth(yy) {
    const currentYY = new Date().getFullYear() % 100;
    return Number(yy) > currentYY ? '19' : '20';
  }

  function inferCenturyForExpiry() {
    return '20';
  }

  function toIsoDateFromMrz(compactYYMMDD, type) {
    if (!/^\d{6}$/.test(compactYYMMDD)) return '';
    const yy = compactYYMMDD.slice(0, 2);
    const mm = compactYYMMDD.slice(2, 4);
    const dd = compactYYMMDD.slice(4, 6);
    const century = type === 'birth' ? inferCenturyForBirth(yy) : inferCenturyForExpiry();
    return `${century}${yy}-${mm}-${dd}`;
  }

  // ── 可見欄位解析 ────────────────────────────────────────────────

  function parseVisibleField(text, labels, pattern = '([A-Z0-9<\\/\\- ]{2,40})') {
    const escapedLabels = labels.map(escapeRegex).join('|');
    const regex = new RegExp(`(?:${escapedLabels})[\\s:：]*${pattern}`, 'i');
    const match = String(text || '').match(regex);
    return match ? normalizeText(match[1].replace(/</g, ' ')) : '';
  }

  function parseLabeledDate(text, labels) {
    const escapedLabels = labels.map(escapeRegex).join('|');
    const regex = new RegExp(`(?:${escapedLabels})[\\s:：]*([0-9A-Z\\/\\-\\. ]{6,20})`, 'i');
    const match = String(text || '').match(regex);
    if (!match) return '';

    const value = normalizeText(match[1]).replace(/\./g, '/').toUpperCase();

    let token = value.match(/\b(\d{4})[\/\-](\d{2})[\/\-](\d{2})\b/);
    if (token) return `${token[1]}-${token[2]}-${token[3]}`;

    token = value.match(/\b(\d{2})[\/\-](\d{2})[\/\-](\d{4})\b/);
    if (token) return `${token[3]}-${token[2]}-${token[1]}`;

    const months = { JAN:'01', FEB:'02', MAR:'03', APR:'04', MAY:'05', JUN:'06', JUL:'07', AUG:'08', SEP:'09', OCT:'10', NOV:'11', DEC:'12' };
    token = value.match(/\b(\d{1,2})\s*([A-Z]{3})\s*(\d{4})\b/);
    if (token && months[token[2]]) {
      return `${token[3]}-${months[token[2]]}-${String(token[1]).padStart(2, '0')}`;
    }

    return '';
  }

  function parseVisiblePassportFields(text) {
    const normalized = String(text || '').replace(/\r/g, '\n');
    const surname = parseVisibleField(normalized, ['Surname', '姓'], '([A-Z< ]{2,50})');
    const given   = parseVisibleField(normalized, ['Given Names', 'Given Name', '名'], '([A-Z< ]{2,80})');
    let fullName = '';
    if (surname || given) fullName = normalizeText(`${surname} ${given}`);
    if (!fullName) fullName = parseVisibleField(normalized, ['Name', '姓名', 'Holder'], '([A-Z][A-Z< \\/]{4,80})');

    const documentNumber = normalizeCode(
      parseVisibleField(normalized, ['Passport No', 'Passport Number', 'Document No', 'Document Number', '護照號碼', '證件號碼'], '([A-Z0-9<\\- ]{5,20})')
    );
    const nationality = normalizeText(
      parseVisibleField(normalized, ['Nationality', '國籍'], '([A-Z]{3}|[A-Z ]{2,30})')
    ).toUpperCase();

    const birthDate  = parseLabeledDate(normalized, ['Date of Birth', 'Birth Date', 'DOB', '出生日期']);
    const expiryDate = parseLabeledDate(normalized, ['Date of Expiry', 'Expiry Date', 'Expiration Date', 'Date of Expiration', '到期日', '有效期']);

    return {
      travelerEnglishName: fullName,
      documentType: /passport|護照/i.test(normalized) ? '護照' : '',
      documentNumber,
      nationality,
      birthDate,
      expiryDate
    };
  }

  // ── MRZ 機讀區解析 ──────────────────────────────────────────────

  function normalizeMrzDigits(value) {
    return String(value || '')
      .toUpperCase()
      .replace(/O/g, '0').replace(/Q/g, '0')
      .replace(/I/g, '1').replace(/L/g, '1')
      .replace(/Z/g, '2').replace(/S/g, '5')
      .replace(/B/g, '8').replace(/G/g, '6');
  }

  function normalizeMrzNumericField(value) {
    return normalizeMrzDigits(String(value || '').replace(/[^A-Z0-9<]/gi, ''));
  }

  function findMrzLines(text) {
    const compactLines = String(text || '')
      .toUpperCase()
      .split(/\n+/)
      .map(line => line.replace(/\s+/g, '').replace(/[^A-Z0-9<]/g, ''))
      .filter(Boolean);

    const firstLine = compactLines.find(line => line.startsWith('P<') && line.length >= 30);
    if (!firstLine) return { firstLine: '', secondLine: '' };

    const firstIndex = compactLines.indexOf(firstLine);
    const afterFirst = compactLines.slice(firstIndex + 1);
    let secondLine = afterFirst.find(line => line.length >= 24 && /\d{6}/.test(normalizeMrzDigits(line)));

    if (!secondLine && afterFirst.length >= 2) {
      for (let i = 0; i < afterFirst.length - 1; i += 1) {
        const merged = `${afterFirst[i]}${afterFirst[i + 1]}`;
        if (merged.length >= 24 && /\d{6}/.test(normalizeMrzDigits(merged))) {
          secondLine = merged;
          break;
        }
      }
    }

    if (!secondLine) {
      secondLine = compactLines.find(
        line => line !== firstLine && line.length >= 24 && /\d{6}/.test(normalizeMrzDigits(line))
      ) || '';
    }

    return { firstLine, secondLine };
  }

  function parseMrzBlock(text) {
    const { firstLine, secondLine } = findMrzLines(text);
    if (!firstLine || !secondLine) return null;

    const namesPayload = firstLine.slice(5);
    const nameParts = namesPayload.split('<<');
    const surname  = (nameParts[0] || '').replace(/<+/g, ' ').trim();
    const given    = (nameParts[1] || '').replace(/<+/g, ' ').trim();
    const fullName = `${surname} ${given}`.trim();

    const rawSecond    = String(secondLine || '').toUpperCase().replace(/[^A-Z0-9<]/g, '');
    const paddedSecond = `${rawSecond}${'<'.repeat(44)}`.slice(0, 44);

    let documentNumber = paddedSecond.slice(0, 9).replace(/<+/g, '').trim();
    let nationality    = paddedSecond.slice(10, 13).replace(/<+/g, '').trim();
    let birthDate      = toIsoDateFromMrz(normalizeMrzNumericField(paddedSecond.slice(13, 19)), 'birth');
    let expiryDate     = toIsoDateFromMrz(normalizeMrzNumericField(paddedSecond.slice(21, 27)), 'expiry');

    if (!documentNumber || !birthDate || !expiryDate) {
      const pattern = rawSecond.match(/([A-Z0-9<]{7,10})[0-9<]([A-Z<]{3})([0-9OILSQBG]{6})[0-9<][MFX<]([0-9OILSQBG]{6})/);
      if (pattern) {
        if (!documentNumber) documentNumber = pattern[1].replace(/<+/g, '').trim();
        if (!nationality)    nationality    = pattern[2].replace(/<+/g, '').trim();
        if (!birthDate)      birthDate      = toIsoDateFromMrz(normalizeMrzNumericField(pattern[3]), 'birth');
        if (!expiryDate)     expiryDate     = toIsoDateFromMrz(normalizeMrzNumericField(pattern[4]), 'expiry');
      }
    }

    return { travelerEnglishName: fullName, documentType: '護照', documentNumber, nationality, birthDate, expiryDate };
  }

  // ── 主入口 ──────────────────────────────────────────────────────

  function pickFirstValue(...values) {
    return values.find(v => String(v || '').trim()) || '';
  }

  function parseTravelDocumentText(text) {
    const normalized = String(text || '').replace(/\r/g, '\n');
    const visible    = parseVisiblePassportFields(normalized);
    const mrz        = parseMrzBlock(normalized) || {};

    const fallbackDocMatch = normalized.match(/\b([A-Z]\d{6,8}|\d{8,10}[A-Z]?)\b/);
    const fallbackDates    = AppUtils.extractDates(normalized);

    return {
      travelerEnglishName: pickFirstValue(visible.travelerEnglishName, mrz.travelerEnglishName, AppUtils.parseMrzName(normalized)),
      documentType:        pickFirstValue(visible.documentType, mrz.documentType, /identity|hkid|身份證/i.test(normalized) ? '身份證' : ''),
      documentNumber:      pickFirstValue(visible.documentNumber, mrz.documentNumber, fallbackDocMatch ? normalizeCode(fallbackDocMatch[1]) : ''),
      nationality:         pickFirstValue(visible.nationality, mrz.nationality, parseVisibleField(normalized, ['Nationality', '國籍'], '([A-Z]{3}|[A-Z ]{2,30})').toUpperCase()),
      birthDate:           pickFirstValue(visible.birthDate,  mrz.birthDate,  fallbackDates[0] || ''),
      expiryDate:          pickFirstValue(visible.expiryDate, mrz.expiryDate, fallbackDates[1] || '')
    };
  }

  return { parseTravelDocumentText };
})();
