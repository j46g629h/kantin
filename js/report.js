/**
 * 回報表單頁邏輯
 */

// ===== 頁面狀態 =====

const state = {
  options:  null,   // 從後端載入的選項清單
  employee: null,   // 驗證成功的員工 { emp_id, emp_name }
  empError: '',     // 工號驗證失敗的原因（i18n key），用來回報正確的錯誤訊息
  category: '',     // 選中的問題分類代碼
  rating:   0,      // 選中的星數
  submitId: newSubmitId(),   // 這次填寫的提交識別碼（防重複用）
};

// ===== 元素 =====

const el = {
  loadingView: document.getElementById('loadingView'),
  formView:    document.getElementById('formView'),
  successView: document.getElementById('successView'),
  form:        document.getElementById('reportForm'),
  empId:       document.getElementById('empId'),
  empStatus:   document.getElementById('empStatus'),
  location:    document.getElementById('location'),
  categoryGrid:document.getElementById('categoryGrid'),
  stars:       document.getElementById('stars'),
  ratingHint:  document.getElementById('ratingHint'),
  description: document.getElementById('description'),
  formError:   document.getElementById('formError'),
  submitBtn:   document.getElementById('submitBtn'),
  caseId:      document.getElementById('caseId'),
  againBtn:    document.getElementById('againBtn'),
};


// ===== 啟動 =====

init();

async function init() {
  bindLanguageButtons();
  renderTexts();

  try {
    state.options = await loadOptions();
  } catch (err) {
    showLoadingError();
    return;
  }

  renderLocations();
  renderCategories();
  renderStars();
  applyLocationFromUrl();

  el.loadingView.classList.add('hidden');
  el.formView.classList.remove('hidden');
}


// ===== 語言 =====

function bindLanguageButtons() {
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      setLang(btn.dataset.lang);
      renderTexts();
      // 選項的顯示文字也要跟著換語言
      if (state.options) {
        renderLocations();
        renderCategories();
        renderStars();
      }
    });
  });
}

/** 把畫面上所有固定文字換成目前語言 */
function renderTexts() {
  document.documentElement.lang = getLang() === 'zh' ? 'zh-Hant' : 'id';

  setText('pageTitle',       t('form.title'));
  setText('labelEmpId',      t('form.empId'));
  setText('labelLocation',   t('form.location'));
  setText('labelCategory',   t('form.category'));
  setText('labelRating',     t('form.rating'));
  setText('labelDescription',t('form.description'));
  setText('loadingText',     t('loading'));
  setText('successTitle',    t('success.title'));
  setText('successThanks',   t('success.thanks'));
  setText('caseLabel',       t('success.caseLabel'));
  setText('caseRemember',    t('success.remember'));
  setText('againBtn',        t('success.again'));
  setText('homeBtn',         t('success.home'));

  el.empId.placeholder       = t('form.empIdPlaceholder');
  el.description.placeholder = t('form.descPlaceholder');
  el.submitBtn.textContent   = t('form.submit');

  // 必填 / 選填標籤
  document.querySelectorAll('.tag-required').forEach((tag) => {
    tag.textContent = t('form.required');
  });
  updateDescriptionTag();
  updateRatingHint();

  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === getLang());
  });
}

function setText(id, text) {
  const node = document.getElementById(id);
  if (node) node.textContent = text;
}


// ===== 選項渲染 =====

function renderLocations() {
  const current = el.location.value;
  el.location.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = t('form.selectPlaceholder');
  el.location.appendChild(placeholder);

  state.options.LOCATION.forEach((opt) => {
    const node = document.createElement('option');
    node.value = opt.code;
    node.textContent = optionLabel(opt);
    el.location.appendChild(node);
  });

  el.location.value = current;
}

function renderCategories() {
  el.categoryGrid.innerHTML = '';

  state.options.CATEGORY.forEach((opt) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'category-btn' + (state.category === opt.code ? ' selected' : '');
    btn.dataset.code = opt.code;
    btn.innerHTML =
      `<span class="category-icon">${CATEGORY_ICONS[opt.code] || CATEGORY_ICONS._default}</span>` +
      `<span class="category-label">${escapeHtml(optionLabel(opt))}</span>`;

    btn.addEventListener('click', () => {
      state.category = opt.code;
      renderCategories();
      updateDescriptionTag();
      clearError();
    });

    el.categoryGrid.appendChild(btn);
  });
}

function renderStars() {
  el.stars.innerHTML = '';

  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'star' + (i <= state.rating ? ' on' : '');
    btn.textContent = '★';
    btn.setAttribute('aria-label', String(i));

    btn.addEventListener('click', () => {
      state.rating = i;
      renderStars();
      updateRatingHint();
      clearError();
    });

    el.stars.appendChild(btn);
  }
}

function updateRatingHint() {
  el.ratingHint.textContent = state.rating
    ? t('rating.' + state.rating)
    : t('form.ratingHint');
  el.ratingHint.classList.toggle('rated', state.rating > 0);
}

/** 「其他建議」時描述變成必填，標籤要跟著改 */
function updateDescriptionTag() {
  const tag = document.getElementById('tagDescription');
  if (!tag) return;
  const required = state.category === 'CAT_OTHER';
  tag.textContent = required ? t('form.required') : t('form.optional');
  tag.classList.toggle('tag-required', required);
}

/** QR Code 網址帶 ?loc=LOC_02 時自動選好餐廳 */
function applyLocationFromUrl() {
  const loc = new URLSearchParams(location.search).get('loc');
  if (!loc) return;
  const exists = state.options.LOCATION.some((o) => o.code === loc);
  if (exists) el.location.value = loc;
}


// ===== 工號驗證 =====

let verifyTimer = null;

el.empId.addEventListener('input', () => {
  state.employee = null;
  state.empError = '';
  clearTimeout(verifyTimer);

  const value = el.empId.value.trim();
  if (!value) {
    el.empStatus.textContent = '';
    el.empStatus.className = 'field-note';
    return;
  }

  el.empStatus.textContent = t('form.checking');
  el.empStatus.className = 'field-note';

  // 每打一個字就打一次 API 太浪費，停止輸入 500 毫秒後才查
  verifyTimer = setTimeout(() => verifyEmpId(value), 500);
});

async function verifyEmpId(empId) {
  try {
    const result = await Api.verifyEmployee(empId);

    // 使用者可能在等待期間又改了工號，這次結果就作廢
    if (el.empId.value.trim() !== empId) return;

    if (result.ok) {
      state.employee = result.data;
      state.empError = '';
      el.empStatus.textContent = '✓ ' + result.data.emp_name;
      el.empStatus.className = 'field-note ok';
    } else {
      state.employee = null;
      state.empError = 'err.' + (result.error || 'EMP_NOT_FOUND');
      el.empStatus.textContent = errorMessage(result);
      el.empStatus.className = 'field-note ng';
    }
  } catch (err) {
    // 連線失敗（斷網、被節流）也會走到這裡。
    // 一定要跟「查無此工號」分開，否則使用者會一直懷疑自己的工號打錯。
    state.employee = null;
    state.empError = 'err.NETWORK';
    el.empStatus.textContent = t('err.NETWORK');
    el.empStatus.className = 'field-note ng';
  }
}


// ===== 提交 =====

el.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();
  setSubmitting(true);

  try {
    // 工號驗證可能還在進行中（後端有時要 3～5 秒）。
    // 不先等它完成就檢查的話，會誤判成「查無此工號」——
    // 使用者明明填對了卻被擋下來。
    const empIdValue = el.empId.value.trim();
    if (empIdValue && !state.employee) {
      clearTimeout(verifyTimer);
      await verifyEmpId(empIdValue);
    }

    const errorKey = validate();
    if (errorKey) {
      showError(t(errorKey));
      return;
    }

    const result = await Api.submitFeedback({
      client_submit_id: state.submitId,
      emp_id:           state.employee.emp_id,
      lang:             getLang() === 'zh' ? 'ZH' : 'ID',
      location_code:    el.location.value,
      category_code:    state.category,
      description:      el.description.value.trim(),
      rating:           state.rating,
    });

    if (result.ok && result.data && result.data.case_id) {
      showSuccess(result.data.case_id);
    } else if (result.ok) {
      // 理論上不會發生：後端說成功卻沒給案件編號。
      // 寧可明確報錯，也不要顯示一個空白的編號框讓使用者以為沒問題。
      // 印到主控台是為了日後真的發生時能分辨是這種情況，
      // 而不是跟一般的 SERVER_ERROR 混在一起。
      console.error('[BUG] 後端回傳成功但沒有案件編號：', result);
      showError(t('err.SERVER_ERROR'));
    } else {
      showError(errorMessage(result));
    }
  } catch (err) {
    showError(t('err.NETWORK'));
  } finally {
    setSubmitting(false);
  }
});

/** 送出前的檢查，回傳錯誤訊息的 i18n key（沒問題就回傳空字串） */
function validate() {
  if (!el.empId.value.trim())  return 'err.EMP_ID_REQUIRED';
  // 驗證沒過時，回報「真正的原因」——可能是查無此工號，
  // 也可能是連線失敗或工號已停用，訊息不能一律說成查無此工號
  if (!state.employee)         return state.empError || 'err.EMP_NOT_FOUND';
  if (!el.location.value)      return 'err.LOCATION_REQUIRED';
  if (!state.category)         return 'err.CATEGORY_REQUIRED';
  if (!state.rating)           return 'err.RATING_REQUIRED';
  if (state.category === 'CAT_OTHER' && !el.description.value.trim()) {
    return 'err.DESCRIPTION_REQUIRED';
  }
  return '';
}

function setSubmitting(isSubmitting) {
  el.submitBtn.disabled = isSubmitting;
  el.submitBtn.textContent = isSubmitting ? t('form.submitting') : t('form.submit');
}


// ===== 結果畫面 =====

function showSuccess(caseId) {
  el.caseId.textContent = caseId;
  el.formView.classList.add('hidden');
  el.successView.classList.remove('hidden');
  window.scrollTo(0, 0);
}

/** 「再回報一則」：保留工號和姓名，其餘清空 */
el.againBtn.addEventListener('click', () => {
  state.category = '';
  state.rating   = 0;
  state.submitId = newSubmitId();   // 新的一筆要有新的識別碼

  el.location.value    = '';
  el.description.value = '';
  clearError();

  renderCategories();
  renderStars();
  updateDescriptionTag();
  applyLocationFromUrl();

  el.successView.classList.add('hidden');
  el.formView.classList.remove('hidden');
  window.scrollTo(0, 0);
});

function showError(message) {
  el.formError.textContent = message;
  el.formError.classList.remove('hidden');
  el.formError.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearError() {
  el.formError.textContent = '';
  el.formError.classList.add('hidden');
}

function showLoadingError() {
  el.loadingView.innerHTML =
    `<p class="result error">${escapeHtml(t('err.NETWORK'))}</p>` +
    `<button type="button" class="btn-primary" onclick="location.reload()">${escapeHtml(t('fail.retry'))}</button>`;
}


// ===== 工具 =====

/** 把使用者或 Sheet 來的文字安全地放進 HTML */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
