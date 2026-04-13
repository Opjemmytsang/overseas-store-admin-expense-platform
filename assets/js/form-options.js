window.FORM_OPTIONS = {
  storeCodes: ['BA3', 'BA5', 'BA8', 'BA9', 'BAA', 'BAB', 'BAC', 'LA1', 'AU4'],
  storeI18n: {
    BA3: { 'zh-Hant': 'BA3 - 曼谷店', 'zh-Hans': 'BA3 - 曼谷店', en: 'BA3 - Bangkok Store' },
    BA5: { 'zh-Hant': 'BA5 - 曼谷店', 'zh-Hans': 'BA5 - 曼谷店', en: 'BA5 - Bangkok Store' },
    BA8: { 'zh-Hant': 'BA8 - 曼谷店', 'zh-Hans': 'BA8 - 曼谷店', en: 'BA8 - Bangkok Store' },
    BA9: { 'zh-Hant': 'BA9 - 曼谷店', 'zh-Hans': 'BA9 - 曼谷店', en: 'BA9 - Bangkok Store' },
    BAA: { 'zh-Hant': 'BAA - 曼谷店', 'zh-Hans': 'BAA - 曼谷店', en: 'BAA - Bangkok Store' },
    BAB: { 'zh-Hant': 'BAB - 曼谷店', 'zh-Hans': 'BAB - 曼谷店', en: 'BAB - Bangkok Store' },
    BAC: { 'zh-Hant': 'BAC - 曼谷店', 'zh-Hans': 'BAC - 曼谷店', en: 'BAC - Bangkok Store' },
    LA1: { 'zh-Hant': 'LA1 - 洛杉磯店', 'zh-Hans': 'LA1 - 洛杉矶店', en: 'LA1 - Los Angeles Store' },
    AU4: { 'zh-Hant': 'AU4 - 澳洲店', 'zh-Hans': 'AU4 - 澳洲店', en: 'AU4 - Australia Store' }
  },
  currencies: ['HKD', 'THB', 'USD', 'RMB'],
  statusGroups: {
    tax: ['待提交', '待核對', '待付款', '已付款', '已完成'],
    flight: ['待提交', '待審批', '待訂票', '已訂票', '已完成'],
    hotel: ['待提交', '待審批', '待預訂', '已預訂', '已完成'],
    expense: ['待提交', '待審批', '待付款', '已付款', '已完成'],
    reimbursement: ['不適用', '待報銷', '待還款', '已報銷', '已還款'],
    paymentOwners: ['公司', '申請人', '其他同事代付']
  }
};

window.FormOptions = {
  localize(value) {
    return window.AppI18n ? window.AppI18n.t(value) : value;
  },

  fillSelect(selectEl, items, options = {}) {
    if (!selectEl) return;
    const { placeholder = null, preserveValue = true } = options;
    const currentValue = preserveValue ? selectEl.value : '';
    selectEl.innerHTML = '';

    if (placeholder !== null) {
      const placeholderOption = document.createElement('option');
      placeholderOption.value = '';
      placeholderOption.textContent = placeholder;
      placeholderOption.dataset.i18nSource = placeholder;
      selectEl.appendChild(placeholderOption);
    }

    items.forEach(item => {
      const option = document.createElement('option');
      option.value = item;
      option.textContent = item;
      option.dataset.i18nSource = item;
      selectEl.appendChild(option);
    });

    if (currentValue && items.includes(currentValue)) {
      selectEl.value = currentValue;
      return;
    }

    if (placeholder !== null) {
      selectEl.value = '';
      return;
    }

    selectEl.value = items[0] || '';
  },

  bindSelects(config = {}) {
    const groups = window.FORM_OPTIONS.statusGroups;

    if (config.statusId && config.statusGroup && groups[config.statusGroup]) {
      this.fillSelect(document.getElementById(config.statusId), groups[config.statusGroup]);
    }

    if (config.storeId) {
      this.fillSelect(document.getElementById(config.storeId), window.FORM_OPTIONS.storeCodes, { placeholder: this.localize('請選擇店舖') });
    }

    if (config.currencyId) {
      this.fillSelect(document.getElementById(config.currencyId), window.FORM_OPTIONS.currencies);
    }

    if (config.reimbursementId) {
      this.fillSelect(document.getElementById(config.reimbursementId), groups.reimbursement);
    }

    if (config.paymentOwnerId) {
      this.fillSelect(document.getElementById(config.paymentOwnerId), groups.paymentOwners);
    }

    if (config.paidById) {
      this.fillSelect(document.getElementById(config.paidById), groups.paymentOwners);
    }
  }
};
