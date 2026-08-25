/**
 * 回報表單頁邏輯
 */

// ===== 頁面狀態 =====

const state = {
  options:  null,   // 從後端載入的選項清單
  employee: null,   // 驗證成功的員工 { emp_id, emp_name }
  empError: '',     // 工號驗證失敗的原因（i18n key），用來回報正確的錯誤訊息
  meal:       '',   // 選中的餐別代碼
  categories: [],   // 選中的問題分類代碼（依點選順序，第一個視為主要分類）
  photos:     [],   // 已壓縮的照片 { mimeType, data, size, previewUrl }
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
  mealGrid:    document.getElementById('mealGrid'),
  categoryGrid:document.getElementById('categoryGrid'),
  categoryHint:document.getElementById('categoryHint'),
  stars:       document.getElementById('stars'),
  ratingHint:  document.getElementById('ratingHint'),
  description: document.getElementById('description'),
  photoList:   document.getElementById('photoList'),
  photoInput:  document.getElementById('photoInput'),
  addPhotoBtn: document.getElementById('addPhotoBtn'),
  photoHint:   document.getElementById('photoHint'),
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

  // 連線失敗自動重試時，把載入文字換掉。
  // 少了這一行，使用者看到的是骨架畫面卡住不動，而他不知道還在跑
  setApiRetryNotice(function () { setText('loadingText', t('loading.retry')); });

  try {
    state.options = await loadOptions();
  } catch (err) {
    showLoadingError();
    return;
  }

  renderLocations();
  renderMeals();
  renderCategories();
  renderStars();
  applyLocationFromUrl();
  applyDefaultMeal();

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
        renderMeals();
        renderCategories();
        renderStars();
      }
    });
  });
}

/** 把畫面上所有固定文字換成目前語言 */
function renderTexts() {
  document.documentElement.lang = htmlLang();
  document.title = t('form.title') + ' · ' + t('appName');

  setText('pageTitle',       t('form.title'));
  setText('labelEmpId',      t('form.empId'));
  setText('labelLocation',   t('form.location'));
  setText('labelMeal',       t('form.meal'));
  setText('labelCategory',   t('form.category'));
  setText('labelRating',     t('form.rating'));
  setText('labelDescription',t('form.description'));
  setText('labelPhoto',      t('form.photo'));
  setText('addPhotoText',    t('form.photoAdd'));
  setText('tagPhoto',        t('form.optional'));
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
  updateCategoryHint();
  renderPhotos();
  renderSystemFooter('siteFooter');

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

function renderMeals() {
  el.mealGrid.innerHTML = '';

  (state.options.MEAL || []).forEach((opt) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'meal-btn' + (state.meal === opt.code ? ' selected' : '');
    btn.dataset.code = opt.code;
    btn.innerHTML =
      `<span class="meal-icon">${MEAL_ICONS[opt.code] || MEAL_ICONS._default}</span>` +
      `<span class="meal-label">${escapeHtml(optionLabel(opt))}</span>`;

    btn.addEventListener('click', () => {
      state.meal = opt.code;      // 單選，直接覆蓋
      renderMeals();
      clearError();
    });

    el.mealGrid.appendChild(btn);
  });
}

/**
 * 依目前時間預選餐別（早上預選早餐、中午預選中餐…）。
 *
 * 只是省一個動作，員工還是可以自己改——
 * 有人會在下午才來反映早餐的問題，不能直接用時間決定。
 * 時間不在任何供餐區間內就不預選。
 */
function applyDefaultMeal() {
  if (state.meal) return;                       // 已經選過就不要蓋掉

  // 判斷邏輯在 js/config.js（跟供餐時段放在一起，改時間只要動一個檔案）
  const code = mealCodeAt(new Date());
  if (!code) return;                            // 不在任何區間內就不預選

  // 選項是從 Sheet 讀的，管理者可能把某一餐停用了。
  // 預選一個畫面上根本沒有的按鈕，會變成「必填卻選不到」
  const exists = (state.options.MEAL || []).some((o) => o.code === code);
  if (!exists) return;

  state.meal = code;
  renderMeals();
}

function renderCategories() {
  el.categoryGrid.innerHTML = '';
  const isFull = state.categories.length >= MAX_CATEGORIES;

  state.options.CATEGORY.forEach((opt) => {
    const selected = state.categories.includes(opt.code);

    const btn = document.createElement('button');
    btn.type = 'button';
    // 已經選滿時，其餘選項變灰——讓使用者一眼看出要先取消才能改選，
    // 而不是按了沒反應卻不知道為什麼
    btn.className = 'category-btn'
      + (selected ? ' selected' : '')
      + (!selected && isFull ? ' disabled' : '');
    btn.dataset.code = opt.code;
    btn.innerHTML =
      `<span class="category-icon">${CATEGORY_ICONS[opt.code] || CATEGORY_ICONS._default}</span>` +
      `<span class="category-label">${escapeHtml(optionLabel(opt))}</span>`;

    btn.addEventListener('click', () => toggleCategory(opt.code));

    el.categoryGrid.appendChild(btn);
  });
}

/**
 * 切換分類的選取狀態，最多 MAX_CATEGORIES 項。
 * 陣列保留點選順序，第一個視為「主要分類」，供管理者派工與統計使用。
 */
function toggleCategory(code) {
  const index = state.categories.indexOf(code);

  if (index >= 0) {
    state.categories.splice(index, 1);            // 再點一次 = 取消選取
  } else if (state.categories.length < MAX_CATEGORIES) {
    state.categories.push(code);
  } else {
    return;                                       // 已達上限，不做任何事
  }

  renderCategories();
  updateCategoryHint();
  updateDescriptionTag();
  clearError();
}

/** 分類下方的提示：還可以選 / 已經選滿 */
function updateCategoryHint() {
  if (!el.categoryHint) return;
  const isFull = state.categories.length >= MAX_CATEGORIES;
  el.categoryHint.textContent = isFull ? t('form.categoryFull') : t('form.categoryHint');
  el.categoryHint.classList.toggle('rated', isFull);
}

function renderStars() {
  el.stars.innerHTML = '';

  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'star' + (i <= state.rating ? ' on' : '');
    btn.innerHTML = STAR_SVG;
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
  const required = state.categories.includes('CAT_OTHER');
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

/** 工號長度上限，與 report.html 的 maxlength 一致 */
const EMP_ID_MAX_LENGTH = 20;

let verifyTimer = null;

el.empId.addEventListener('input', () => {
  sanitizeEmpIdInput();

  state.employee = null;
  state.empError = '';
  clearTimeout(verifyTimer);

  const value = el.empId.value.trim();
  if (!value) {
    el.empStatus.textContent = '';
    el.empStatus.className = 'field-note';
    return;
  }

  showCachedEmployee(value);

  // 每打一個字就打一次 API 太浪費，停止輸入 500 毫秒後才查
  verifyTimer = setTimeout(() => verifyEmpId(value), 500);
});

/**
 * 這台裝置上次驗證成功的就是這個工號的話，姓名立刻顯示出來。
 *
 * 差別在於「第二次回報」：本來要盯著「查詢中…」等 3～8 秒，
 * 現在打完最後一碼就看到自己的名字。
 *
 * ⚠️ 這只是提早顯示，**不是跳過驗證**——
 *    500 毫秒後照樣會打一次 API，離職或改名都會被蓋掉（見 verifyEmpId）。
 *    而且就算這裡顯示了錯的姓名也送不出錯的案件：
 *    後端在 submitFeedback 會自己再驗一次工號。
 */
function showCachedEmployee(empId) {
  const cached = readEmployeeCache(empId);

  if (cached) {
    state.employee = cached;
    el.empStatus.textContent = '✓ ' + cached.emp_name;
    el.empStatus.className = 'field-note ok';
    return;
  }

  el.empStatus.textContent = t('form.checking');
  el.empStatus.className = 'field-note';
}

/**
 * 工號只允許數字與英文字母，英文一律轉成大寫。
 *
 * 在「打字當下」就過濾掉不合法的字元，而不是等送出才報錯——
 * 使用者打了一堆才被拒絕，體驗會很差。
 * 貼上的內容也會經過這裡（貼上一樣會觸發 input 事件）。
 */
function sanitizeEmpIdInput() {
  const raw = el.empId.value;
  const cleaned = raw.replace(/[^0-9a-zA-Z]/g, '').toUpperCase().slice(0, EMP_ID_MAX_LENGTH);
  if (cleaned === raw) return;

  // 保住游標位置，否則在字串中間修改時游標會跳到最後面
  const caret = el.empId.selectionStart || 0;
  const before = raw.slice(0, caret);
  const removed = before.length - before.replace(/[^0-9a-zA-Z]/g, '').length;

  el.empId.value = cleaned;
  const pos = Math.max(0, caret - removed);
  el.empId.setSelectionRange(pos, pos);
}


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
      writeEmployeeCache(empId, result.data);   // 下次同一個人就不必再等
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


// ===== 照片 =====

el.addPhotoBtn.addEventListener('click', () => el.photoInput.click());

el.photoInput.addEventListener('change', async () => {
  const files = Array.from(el.photoInput.files || []);
  el.photoInput.value = '';           // 清空才能重複選同一個檔案
  if (!files.length) return;

  const slots = IMAGE_MAX_COUNT - state.photos.length;
  if (slots <= 0) return;

  setPhotoBusy(true);
  clearError();

  try {
    // 一張一張處理。手機同時壓縮多張大圖容易吃光記憶體
    for (const file of files.slice(0, slots)) {
      state.photos.push(await compressImage(file));
      renderPhotos();
    }
  } catch (err) {
    showError(t('err.' + (err.message || 'IMAGE_READ_FAILED')));
  } finally {
    setPhotoBusy(false);
  }
});

function renderPhotos() {
  if (!el.photoList) return;
  el.photoList.innerHTML = '';

  state.photos.forEach((photo, index) => {
    const item = document.createElement('div');
    item.className = 'photo-item';

    const img = document.createElement('img');
    img.src = photo.previewUrl;
    img.alt = '';

    const size = document.createElement('span');
    size.className = 'photo-size';
    size.textContent = formatFileSize(photo.size);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'photo-remove';
    remove.textContent = '×';
    remove.setAttribute('aria-label', t('form.photoRemove'));
    remove.addEventListener('click', () => removePhoto(index));

    item.appendChild(img);
    item.appendChild(size);
    item.appendChild(remove);
    el.photoList.appendChild(item);
  });

  updatePhotoControls();
}

function removePhoto(index) {
  const photo = state.photos[index];
  if (photo && photo.previewUrl) URL.revokeObjectURL(photo.previewUrl);   // 釋放記憶體
  state.photos.splice(index, 1);
  renderPhotos();
}

/** 已達張數上限就把「加照片」藏起來，而不是按了沒反應 */
function updatePhotoControls() {
  const isFull = state.photos.length >= IMAGE_MAX_COUNT;
  el.addPhotoBtn.classList.toggle('hidden', isFull);
  el.photoHint.textContent = isFull ? '' : t('form.photoHint');
}

function setPhotoBusy(busy) {
  el.addPhotoBtn.disabled = busy;
  setText('addPhotoText', busy ? t('form.photoWorking') : t('form.photoAdd'));
}

/** 清空所有照片並釋放預覽圖佔用的記憶體 */
function clearPhotos() {
  state.photos.forEach((p) => { if (p.previewUrl) URL.revokeObjectURL(p.previewUrl); });
  state.photos = [];
  renderPhotos();
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
      meal_code:        state.meal,
      category_code:    state.categories.join(','),
      description:      el.description.value.trim(),
      rating:           state.rating,
      images:           state.photos.map((p) => ({ mimeType: p.mimeType, data: p.data })),
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
  if (!state.meal)             return 'err.MEAL_REQUIRED';
  if (state.categories.length === 0)              return 'err.CATEGORY_REQUIRED';
  if (state.categories.length > MAX_CATEGORIES)   return 'err.CATEGORY_TOO_MANY';
  if (!state.rating)           return 'err.RATING_REQUIRED';
  if (state.categories.includes('CAT_OTHER') && !el.description.value.trim()) {
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
  state.meal       = '';
  state.categories = [];
  state.rating     = 0;
  state.submitId = newSubmitId();   // 新的一筆要有新的識別碼

  el.location.value    = '';
  el.description.value = '';
  clearPhotos();
  clearError();

  renderMeals();
  renderCategories();
  renderStars();
  updateCategoryHint();
  updateDescriptionTag();
  applyLocationFromUrl();
  applyDefaultMeal();

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

