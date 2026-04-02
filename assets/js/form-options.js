window.FORM_OPTIONS = {
  storeCodes: ['BA3', 'BA5', 'BA8', 'BA9', 'BAA', 'BAB', 'BAC', 'LA1', 'AU4'],
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
  fillSelect(selectEl, items, options = {}) {
    if (!selectEl) return;
    const { placeholder = null, preserveValue = true } = options;
    const currentValue = preserveValue ? selectEl.value : '';
    selectEl.innerHTML = '';

    if (placeholder !== null) {
      const placeholderOption = document.createElement('option');
      placeholderOption.value = '';
      placeholderOption.textContent = placeholder;
      selectEl.appendChild(placeholderOption);
    }

    items.forEach(item => {
      const option = document.createElement('option');
      option.value = item;
      option.textContent = item;
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
      this.fillSelect(document.getElementById(config.storeId), window.FORM_OPTIONS.storeCodes, { placeholder: '請選擇店舖' });
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
