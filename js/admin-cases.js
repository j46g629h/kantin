/**
 * 管理者案件列表頁
 *
 * 規格 §6.5：篩選、預設提交時間倒序、逾期標紅、頂端統計卡片。
 *
 * ⚠️ Apps Script 每次回應要 3～8 秒，所以刻意「按下查詢才送出請求」，
 *    不做「改一個下拉就自動重查」——那樣每動一次就要等好幾秒，很難用。
 */


// ===== 狀態 =====

const state = {
  profile: null,   // 目前登入者
  options: null,   // 代碼 → 顯示文字的對照
  cases:   [],
  total:   0,
  stats:   null,
  openId:  '',     // 目前展開的案件編號
  loading: false,
  loaded:  false,  // 是否已經成功載入過一次（用來分辨「還沒查」與「查無資料」）

  templates: [],   // 回覆範本
  months:    [],   // 有資料的月份 [{month,count}]
  period:    'ALL',// 檢視範圍：'ALL' 或某個月份 YYYYMM
  saving:    false,
  savedMsg:  '',   // 儲存成功後短暫顯示的訊息

  /**
   * 展開中那筆案件的草稿（狀態與回覆）。
   *
   * 為什麼要另外存：renderList() 每次都會把整個清單重畫，
   * 表單元素會被換成新的，打到一半的字就不見了。
   * 每次輸入都存進這裡，重畫時再填回去。
   */
  draft: null,
};

/** 目前套用中的篩選條件 */
const filters = {
  keyword: '', status_code: '', location_code: '', category_code: '',
  date_from: '', date_to: '',
};


/**
 * 這些狀態一定要填回覆才能儲存。
 * 後端 gas/Config.js 的 STATUS_REQUIRING_RESPONSE 是同一份規則，兩邊要一致。
 * 前端這份只是為了少跑一趟 API，真正的把關在後端。
 */
const STATUS_NEEDS_RESPONSE = ['ST_PROC', 'ST_DONE'];

/** 儲存成功提示的計時器（重複儲存時要先取消上一個，否則會提早消失） */
let savedMsgTimer = null;


const el = {
  bootView:  document.getElementById('bootView'),
  bootText:  document.getElementById('bootText'),
  errorView: document.getElementById('errorView'),
  mainView:  document.getElementById('mainView'),

  adminBar:  document.getElementById('adminBar'),
  adminName: document.getElementById('adminName'),
  adminRole: document.getElementById('adminRole'),
  logoutBtn: document.getElementById('logoutBtn'),
  accountsLink: document.getElementById('accountsLink'),
  pageTitle: document.getElementById('pageTitle'),

  statNew:   document.getElementById('statNew'),
  statProc:  document.getElementById('statProc'),
  statDone:  document.getElementById('statDone'),
  statNewLabel:  document.getElementById('statNewLabel'),
  statProcLabel: document.getElementById('statProcLabel'),
  statDoneLabel: document.getElementById('statDoneLabel'),

  periodBar:   document.getElementById('periodBar'),
  periodLabel: document.getElementById('periodLabel'),
  periodCount: document.getElementById('periodCount'),
  monthPicker: document.getElementById('monthPicker'),
  overdueNote: document.getElementById('overdueNote'),

  filterToggle:     document.getElementById('filterToggle'),
  filterToggleText: document.getElementById('filterToggleText'),
  filterActiveTag:  document.getElementById('filterActiveTag'),
  filterArrow:      document.getElementById('filterArrow'),
  filterForm:       document.getElementById('filterForm'),

  fKeyword:  document.getElementById('fKeyword'),
  fStatus:   document.getElementById('fStatus'),
  fLocation: document.getElementById('fLocation'),
  fCategory: document.getElementById('fCategory'),
  fDateFrom: document.getElementById('fDateFrom'),
  fDateTo:   document.getElementById('fDateTo'),

  searchBtn: document.getElementById('searchBtn'),
  resetBtn:  document.getElementById('resetBtn'),

  labelKeyword:  document.getElementById('labelKeyword'),
  labelStatus:   document.getElementById('labelStatus'),
  labelLocation: document.getElementById('labelLocation'),
  labelCategory: document.getElementById('labelCategory'),
  labelDateFrom: document.getElementById('labelDateFrom'),
  labelDateTo:   document.getElementById('labelDateTo'),

  resultInfo:  document.getElementById('resultInfo'),
  refreshBtn:  document.getElementById('refreshBtn'),
  savedNote:   document.getElementById('savedNote'),
  cappedNote:  document.getElementById('cappedNote'),
  listLoading: document.getElementById('listLoading'),
  listLoadingText: document.getElementById('listLoadingText'),
  listError:   document.getElementById('listError'),
  caseList:    document.getElementById('caseList'),
};


// ===== 啟動 =====

boot();

async function boot() {
  try {
    state.profile = await requireAdmin();
    if (!state.profile) return;      // 正在導回登入頁

    // 三件事同時發出，總等待時間等於最慢的那一個，不是三個相加。
    // 範本用 safeLoadTemplates()：範本讀不到只是少了快捷按鈕，
    // 不該讓整頁掛掉（Promise.all 只要有一個 reject 就全部失敗）
    const [options, templates] = await Promise.all([
      loadOptions(),
      safeLoadTemplates(),
      loadCases(),
    ]);
    state.options   = options;
    state.templates = templates;

    el.bootView.classList.add('hidden');
    el.adminBar.classList.remove('hidden');
    el.mainView.classList.remove('hidden');

    buildFilterSelects();
    renderAll();

  } catch (err) {
    // 網路問題就留在這一頁顯示錯誤，不要把人踢回登入頁——
    // 重新登入一樣會失敗，只是多繞一圈
    el.bootView.classList.add('hidden');
    el.errorView.textContent = err.message || t('err.NETWORK');
    el.errorView.classList.remove('hidden');
  }
}


// ===== 讀取案件 =====

/**
 * 跟後端要案件列表。
 * 失敗時不清空既有清單——寧可讓管理者看著舊資料，也不要整頁變空白。
 */
async function loadCases() {
  if (state.loading) return;

  state.loading = true;
  setLoading(true);
  hide(el.listError);

  try {
    const result = await Api.getCaseList(AdminSession.token(), filters, state.period);

    if (!result.ok) {
      if (result.error === 'UNAUTHORIZED') {
        AdminSession.clear();
        location.replace('admin.html');
        return;
      }
      show(el.listError, errorMessage(result));
      return;
    }

    state.cases  = result.data.cases || [];
    state.total  = result.data.total || 0;
    state.stats  = result.data.stats || null;
    state.months = result.data.available_months || [];
    state.openId = '';
    state.loaded = true;

    // 以後端實際採用的範圍為準（參數打錯時它會退回 ALL），
    // 這樣畫面顯示的範圍一定和資料一致
    if (state.stats && state.stats.period) state.period = state.stats.period;

  } catch (err) {
    show(el.listError, t('err.NETWORK'));
  } finally {
    state.loading = false;
    setLoading(false);
  }
}


/**
 * 讀取回覆範本。
 * 失敗就回傳空陣列——沒有範本只是少了快捷按鈕，管理者照樣可以自己打字，
 * 不該因此讓整個頁面進不去。
 */
async function safeLoadTemplates() {
  try {
    const result = await Api.getTemplates(AdminSession.token());
    return result.ok ? (result.data.templates || []) : [];
  } catch (err) {
    return [];
  }
}


function setLoading(loading) {
  el.listLoading.classList.toggle('hidden', !loading);
  el.searchBtn.disabled  = loading;
  el.refreshBtn.disabled = loading;
  el.refreshBtn.classList.toggle('spinning', loading);
  el.searchBtn.textContent = loading ? t('admin.filter.searching') : t('admin.filter.search');
}


// ===== 篩選 =====

/** 把選項清單填進三個下拉選單（第一項固定是「全部」） */
function buildFilterSelects() {
  fillSelect(el.fStatus,   'STATUS',   filters.status_code);
  fillSelect(el.fLocation, 'LOCATION', filters.location_code);
  fillSelect(el.fCategory, 'CATEGORY', filters.category_code);
}

function fillSelect(select, type, selected) {
  select.innerHTML = '';

  const all = document.createElement('option');
  all.value = '';
  all.textContent = t('admin.filter.all');
  select.appendChild(all);

  ((state.options && state.options[type]) || []).forEach((option) => {
    const node = document.createElement('option');
    node.value = option.code;
    node.textContent = optionLabel(option);
    select.appendChild(node);
  });

  select.value = selected || '';
}


el.filterForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  readFilterInputs();
  await loadCases();
  renderAll();
});


el.resetBtn.addEventListener('click', async () => {
  Object.keys(filters).forEach((key) => { filters[key] = ''; });
  writeFilterInputs();
  await loadCases();
  renderAll();
});


/**
 * 重新整理：重新載入資料，並回到剛登入時的乾淨狀態。
 *
 * 「保留目前篩選條件重新抓一次」請用篩選面板裡的〔查詢〕，
 * 那支按鈕本來就是這個作用。兩個需求各有一個按鈕，不會互相打架。
 */
el.refreshBtn.addEventListener('click', async () => {
  resetToInitialState();
  await loadCases();
  renderAll();
});


/** 把畫面恢復成剛登入的樣子 */
function resetToInitialState() {
  Object.keys(filters).forEach((key) => { filters[key] = ''; });
  writeFilterInputs();

  state.period   = 'ALL';
  state.openId   = '';
  state.draft    = null;
  state.savedMsg = '';

  el.monthPicker.classList.add('hidden');
  el.filterForm.classList.add('hidden');   // 篩選面板收合
  hide(el.listError);
  renderFilterToggle();
}


/** 狀態卡片點一下就依該狀態篩選；再點一次取消 */
document.querySelectorAll('.stat-card[data-status]').forEach((card) => {
  card.addEventListener('click', async () => {
    const status = card.dataset.status;
    filters.status_code = (filters.status_code === status) ? '' : status;
    writeFilterInputs();
    await loadCases();
    renderAll();
  });
});


/** 範圍列：點一下展開範圍選單 */
el.periodBar.addEventListener('click', () => {
  el.monthPicker.classList.toggle('hidden');
  renderMonthPicker();
});


/**
 * 逾期提示點一下 → 跳到「全部時間 + 未處理」。
 * 那正是要看逾期案件時該有的畫面，省得自己再設一次條件。
 */
el.overdueNote.addEventListener('click', async () => {
  state.period = 'ALL';
  filters.status_code = 'ST_NEW';
  writeFilterInputs();
  el.monthPicker.classList.add('hidden');
  await loadCases();
  renderAll();
});


/**
 * 畫出月份選單。
 *
 * 只列出真的有案件的月份——列出所有月份的話，
 * 使用者會點到一個空白月份，然後懷疑是不是壞了。
 */
function renderMonthPicker() {
  el.monthPicker.innerHTML = '';
  if (el.monthPicker.classList.contains('hidden')) return;

  const title = document.createElement('div');
  title.className = 'month-picker-title';
  title.textContent = t('admin.period.pick');
  el.monthPicker.appendChild(title);

  const thisMonth = currentYearMonth();
  const totalAll  = state.months.reduce((sum, m) => sum + m.count, 0);

  // 「全部時間」永遠放第一個
  el.monthPicker.appendChild(buildPeriodItem(
    'ALL', t('admin.period.all'), totalAll));

  state.months.forEach((entry) => {
    el.monthPicker.appendChild(buildPeriodItem(
      entry.month,
      monthLabel(entry.month) + (entry.month === thisMonth ? t('admin.period.current') : ''),
      entry.count));
  });
}


function buildPeriodItem(period, label, count) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'month-item' + (period === state.period ? ' active' : '');

  const text = document.createElement('span');
  text.textContent = label;

  const num = document.createElement('span');
  num.className = 'month-count';
  num.textContent = t('admin.period.count').replace('{n}', count);

  btn.appendChild(text);
  btn.appendChild(num);

  btn.addEventListener('click', async () => {
    state.period = period;
    el.monthPicker.classList.add('hidden');
    await loadCases();
    renderAll();
  });

  return btn;
}


/** 目前範圍的顯示文字 */
function periodLabelText() {
  return state.period === 'ALL' ? t('admin.period.all') : monthLabel(state.period);
}


/** YYYYMM → 依語言顯示的月份文字 */
function monthLabel(month) {
  const y = String(month).slice(0, 4);
  const m = String(Number(String(month).slice(4, 6)));
  return t('admin.month.label').replace('{y}', y).replace('{m}', m);
}


/** 目前年月 YYYYMM。用本機時區——管理者跟工廠在同一個時區 */
function currentYearMonth() {
  const now = new Date();
  return String(now.getFullYear()) + String(now.getMonth() + 1).padStart(2, '0');
}


el.filterToggle.addEventListener('click', () => {
  el.filterForm.classList.toggle('hidden');
  renderFilterToggle();
});


/** 把畫面上的輸入值收進 filters */
function readFilterInputs() {
  filters.keyword       = el.fKeyword.value.trim();
  filters.status_code   = el.fStatus.value;
  filters.location_code = el.fLocation.value;
  filters.category_code = el.fCategory.value;
  filters.date_from     = el.fDateFrom.value;
  filters.date_to       = el.fDateTo.value;
}

/** 把 filters 寫回畫面（重設、或從統計卡片改變狀態時用） */
function writeFilterInputs() {
  el.fKeyword.value  = filters.keyword;
  el.fStatus.value   = filters.status_code;
  el.fLocation.value = filters.location_code;
  el.fCategory.value = filters.category_code;
  el.fDateFrom.value = filters.date_from;
  el.fDateTo.value   = filters.date_to;
}

/** 目前有沒有套用任何篩選條件 */
function hasActiveFilter() {
  return Object.keys(filters).some((key) => filters[key]);
}


/**
 * 清單是不是被「縮小過範圍」。
 *
 * 用來決定沒有資料時該說哪一句：
 *   縮小過範圍 → 「沒有符合條件的案件」
 *   沒縮小過   → 「目前還沒有任何回報」
 *
 * 看的不只是篩選條件，還包括「正在看哪個月」——
 * 選了三月而三月剛好沒案件時，說「目前還沒有任何回報」
 * 會讓人以為整個系統都是空的。
 */
function isNarrowedView() {
  return hasActiveFilter() || state.period !== 'ALL';
}


// ===== 畫面 =====

function renderAll() {
  renderTexts();
  renderStats();
  renderList();
}


function renderTexts() {
  document.documentElement.lang = htmlLang();
  document.title = t('admin.cases.title') + ' · ' + t('appName');

  el.pageTitle.textContent = t('admin.cases.title');
  el.bootText.textContent  = t('admin.checking');
  el.logoutBtn.textContent = t('admin.logout');

  if (state.profile) {
    el.adminName.textContent = t('admin.hello')
      .replace('{name}', state.profile.name || state.profile.account);
    el.adminRole.textContent = adminRoleLabel(state.profile.role);

    // 帳號管理只給超級管理者。藏起來只是不讓一般管理者看到用不到的東西，
    // 後端的 withAuth(..., true) 才是真正擋得住的那一道
    el.accountsLink.textContent = t('accounts.entry');
    el.accountsLink.classList.toggle('hidden', !state.profile.is_super);
  }

  el.statNewLabel.textContent  = t('admin.stats.new');
  el.statProcLabel.textContent = t('admin.stats.processing');
  el.statDoneLabel.textContent = t('admin.stats.done');
  // 範圍列的文字由 renderStats() 決定（要帶入件數）

  el.labelKeyword.textContent  = t('admin.filter.keyword');
  el.labelStatus.textContent   = t('admin.filter.status');
  el.labelLocation.textContent = t('admin.filter.location');
  el.labelCategory.textContent = t('admin.filter.category');
  el.labelDateFrom.textContent = t('admin.filter.dateFrom');
  el.labelDateTo.textContent   = t('admin.filter.dateTo');
  el.fKeyword.placeholder      = t('admin.filter.keywordPh');

  el.resetBtn.textContent      = t('admin.filter.reset');
  el.refreshBtn.title          = t('admin.refresh');
  el.listLoadingText.textContent = t('admin.list.loading');
  if (!state.loading) el.searchBtn.textContent = t('admin.filter.search');

  renderFilterToggle();
  renderSystemFooter('siteFooter');

  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === getLang());
  });
}


function renderFilterToggle() {
  const open = !el.filterForm.classList.contains('hidden');
  el.filterToggleText.textContent = open ? t('admin.filter.hide') : t('admin.filter.show');
  el.filterArrow.textContent = open ? '▴' : '▾';

  // 收起來的時候，用一個小標記提醒「現在看到的不是全部」
  el.filterActiveTag.textContent = t('admin.filter.active');
  el.filterActiveTag.classList.toggle('hidden', !hasActiveFilter());
}


function renderStats() {
  const stats = state.stats;
  if (!stats) return;

  // 三張卡片的數字全部是「選定範圍」內的，範圍名稱就寫在上方那條列上
  el.statNew.textContent  = stats.new;
  el.statProc.textContent = stats.processing;
  el.statDone.textContent = stats.done;

  el.periodLabel.textContent = periodLabelText();
  el.periodCount.textContent = t('admin.period.total').replace('{n}', stats.total);

  // 目前依哪個狀態篩選，那張卡片就highlight
  document.querySelectorAll('.stat-card[data-status]').forEach((card) => {
    card.classList.toggle('active', card.dataset.status === filters.status_code && !!filters.status_code);
  });

  renderMonthPicker();

  // 逾期永遠顯示全系統的數字，並明說是全系統——
  // 這是安全網，不能被選定範圍藏起來
  if (stats.overdue_all > 0) {
    el.overdueNote.textContent = '⚠️ ' + t('admin.stats.overdue').replace('{n}', stats.overdue_all);
    el.overdueNote.classList.remove('hidden');
  } else {
    el.overdueNote.classList.add('hidden');
  }
}


/**
 * 畫出案件清單。
 *
 * ⚠️ 整段包在 try/catch 裡：這個函式一開始就會清空清單，
 *    中途出錯的話畫面會變成「東西全部消失且沒有任何訊息」，
 *    使用者完全不知道發生什麼事。（查詢頁曾經因為快取到舊版 JS 而踩過。）
 */
function renderList() {
  try {
    renderListInner();
  } catch (err) {
    console.error('[BUG] 顯示案件清單時發生錯誤：', err);
    el.caseList.innerHTML = '';
    show(el.listError, t('err.UNKNOWN'));
  }
}

function renderListInner() {
  el.caseList.innerHTML = '';

  // 儲存成功的提示。顯示幾秒後自己消失，不用管理者動手關掉
  if (state.savedMsg) {
    el.savedNote.textContent = '✓ ' + state.savedMsg;
    el.savedNote.classList.remove('hidden');
    clearTimeout(savedMsgTimer);
    savedMsgTimer = setTimeout(() => {
      state.savedMsg = '';
      el.savedNote.classList.add('hidden');
    }, 4000);
  } else {
    el.savedNote.classList.add('hidden');
  }

  const shown = state.cases.length;

  el.resultInfo.textContent = state.loaded
    ? t('admin.list.showing').replace('{n}', shown).replace('{total}', state.total)
    : '';

  // 後端有回傳上限，超過時要講清楚，不能讓人以為「全部就這些」
  if (state.loaded && state.total > shown) {
    el.cappedNote.textContent = t('admin.list.capped').replace('{n}', shown);
    el.cappedNote.classList.remove('hidden');
  } else {
    el.cappedNote.classList.add('hidden');
  }

  if (!shown) {
    if (state.loaded) {
      const empty = document.createElement('div');
      empty.className = 'state-box';
      empty.textContent = isNarrowedView() ? t('admin.list.empty') : t('admin.list.emptyAll');
      el.caseList.appendChild(empty);
    }
    return;
  }

  state.cases.forEach((item) => {
    el.caseList.appendChild(buildCaseCard(item));
  });
}


function buildCaseCard(item) {
  const isOpen = state.openId === item.case_id;

  const card = document.createElement('div');
  card.className = 'case-card'
    + (isOpen ? ' open' : '')
    + (item.is_overdue ? ' overdue' : '');   // 逾期整張卡片標紅（規格 §6.5）

  const head = document.createElement('button');
  head.type = 'button';
  head.className = 'case-head';
  head.innerHTML =
    `<div class="case-head-main">` +
      `<div class="case-no">${escapeHtml(item.case_id)}` +
        (item.is_overdue
          ? `<span class="overdue-tag">${escapeHtml(t('admin.case.overdue').replace('{n}', item.days_open))}</span>`
          : '') +
      `</div>` +
      `<div class="case-meta">${escapeHtml(item.submit_time)}</div>` +
      `<div class="case-meta">${escapeHtml(labelOf('LOCATION', item.location_code))}` +
        ` · ${escapeHtml(labelOf('MEAL', item.meal_code))}` +
        ` · ${escapeHtml(item.emp_name || item.emp_id)}</div>` +
      (item.handler && item.handler.name
        ? `<div class="case-meta case-assigned">👤 ${escapeHtml(item.handler.name)}</div>`
        : '') +
      `<div class="case-meta">${categoryChips(item)}` +
        `<span class="case-stars">${starText(item.rating)}</span></div>` +
    `</div>` +
    `<div class="case-head-side">` +
      statusBadge(item.status_code) +
      `<span class="case-arrow">${isOpen ? '▴' : '▾'}</span>` +
    `</div>`;

  head.addEventListener('click', () => {
    state.openId = isOpen ? '' : item.case_id;   // 再點一次收合
    renderList();
  });

  card.appendChild(head);
  if (isOpen) card.appendChild(buildCaseDetail(item));
  return card;
}


function buildCaseDetail(item) {
  const box = document.createElement('div');
  box.className = 'case-detail';

  // 回報人：管理端才看得到工號與姓名（員工端查詢刻意不回傳）
  box.appendChild(detailRow(t('admin.case.employee'),
    escapeHtml(item.emp_name || '—') + ` <span class="case-emp-id">${escapeHtml(item.emp_id)}</span>`, true));

  // 員工用哪個語言回報的，提示該用哪個語言回覆（規格 §6.6）
  box.appendChild(detailRow(t('admin.case.lang'),
    item.lang === 'ZH' ? t('admin.case.langZH') : t('admin.case.langID'), false));

  box.appendChild(detailRow(t('form.category'), categoryChips(item), true));

  box.appendChild(detailRow(t('form.rating'),
    `<span class="case-stars">${starText(item.rating)}</span> ` +
    escapeHtml(t('rating.' + item.rating) || ''), true));

  if (item.description) {
    box.appendChild(detailRow(t('form.description'), escapeHtml(item.description), true));
  }

  // 照片。用 || [] 防禦：後端若因版本不一致少給欄位，
  // 頂多少顯示一段，不會讓整個畫面掛掉
  const images = item.images || [];
  if (images.length) {
    const row = detailRow(t('query.photos'), '', true);
    row.querySelector('.case-row-value').appendChild(buildThumbs(images));
    box.appendChild(row);
  }

  // 處理者：後端回傳的是 { code, name }
  const handler = item.handler || {};
  box.appendChild(detailRow(t('admin.case.handler'),
    handler.name || t('admin.case.noHandler'), false));

  // 回覆
  const replyBox = document.createElement('div');
  replyBox.className = 'case-reply' + (item.response ? '' : ' empty');
  replyBox.innerHTML = item.response
    ? `<div class="case-reply-title">${escapeHtml(t('admin.case.reply'))}` +
      (item.response_time ? ` <span class="case-reply-time">${escapeHtml(item.response_time)}</span>` : '') +
      `</div><div>${escapeHtml(item.response)}</div>`
    : `<div>${escapeHtml(t('admin.case.noReply'))}</div>`;
  box.appendChild(replyBox);

  // 回覆表單（規格 §6.6）
  box.appendChild(buildReplyForm(item));

  return box;
}


// ===== 回覆表單 =====

/**
 * 建立「處理這件案件」的表單：狀態下拉 + 範本快捷 + 回覆輸入框。
 *
 * 表單的內容不是直接綁在 DOM 上，而是同步寫進 state.draft。
 * 因為 renderList() 每次都會整個重畫清單，DOM 元素會被換掉，
 * 沒有另外存的話，打到一半的字會憑空消失。
 */
function buildReplyForm(item) {
  const draft = currentDraft(item);

  const form = document.createElement('div');
  form.className = 'reply-form';

  const title = document.createElement('div');
  title.className = 'reply-title';
  title.textContent = t('admin.reply.title');
  form.appendChild(title);

  // --- 處理狀態 ---
  const statusLabel = document.createElement('label');
  statusLabel.className = 'reply-label';
  statusLabel.textContent = t('admin.reply.status');
  form.appendChild(statusLabel);

  const select = document.createElement('select');
  select.className = 'reply-status';
  ((state.options && state.options.STATUS) || []).forEach((option) => {
    const node = document.createElement('option');
    node.value = option.code;
    node.textContent = optionLabel(option);
    select.appendChild(node);
  });
  select.value = draft.status_code;
  select.addEventListener('change', () => {
    draft.status_code = select.value;
    // 切到需要回覆的狀態時，把必填提示亮起來
    renderReplyHint(form, draft);
  });
  form.appendChild(select);

  // --- 指派處理者 ---
  // 名單來自「選項設定」分頁（類型 HANDLER），管理者自己加一列就多一個人。
  // 名單是空的就不顯示這一區，管理者照樣可以回覆
  const handlers = (state.options && state.options.HANDLER) || [];
  if (handlers.length) {
    const handlerLabel = document.createElement('label');
    handlerLabel.className = 'reply-label';
    handlerLabel.textContent = t('admin.reply.handler');
    form.appendChild(handlerLabel);

    const handlerSelect = document.createElement('select');
    handlerSelect.className = 'reply-handler';

    const none = document.createElement('option');
    none.value = '';
    none.textContent = t('admin.reply.noHandler');
    handlerSelect.appendChild(none);

    handlers.forEach((option) => {
      const node = document.createElement('option');
      node.value = option.code;
      node.textContent = optionLabel(option);
      handlerSelect.appendChild(node);
    });

    // 目前指派的人可能已經停用而不在清單裡，補一個選項免得選擇被無聲清掉
    if (draft.handler_code && !handlers.some((h) => h.code === draft.handler_code)) {
      const stale = document.createElement('option');
      stale.value = draft.handler_code;
      stale.textContent = (item.handler && item.handler.name) || draft.handler_code;
      handlerSelect.appendChild(stale);
    }

    handlerSelect.value = draft.handler_code;
    handlerSelect.addEventListener('change', () => {
      draft.handler_code = handlerSelect.value;
    });
    form.appendChild(handlerSelect);

    const handlerHint = document.createElement('div');
    handlerHint.className = 'reply-handler-hint';
    handlerHint.textContent = t('admin.reply.handlerHint');
    form.appendChild(handlerHint);
  }

  // --- 回覆內容 ---
  const contentLabel = document.createElement('label');
  contentLabel.className = 'reply-label';
  contentLabel.textContent = t('admin.reply.content');
  form.appendChild(contentLabel);

  // 提示該用哪個語言回覆（規格 §6.6）
  const langHint = document.createElement('div');
  langHint.className = 'reply-lang';
  const langName = item.lang === 'ZH' ? t('admin.case.langZH') : t('admin.case.langID');
  langHint.textContent = t('admin.reply.langHint').split('{lang}').join(langName);
  form.appendChild(langHint);

  const textarea = document.createElement('textarea');
  textarea.className = 'reply-text';
  textarea.rows = 4;
  textarea.placeholder = t('admin.reply.placeholder');
  textarea.value = draft.response;
  textarea.addEventListener('input', () => {
    draft.response = textarea.value;
  });

  // 範本按鈕要放在輸入框上面，但需要先有 textarea 才能塞文字進去
  const templates = templatesForCase(item);
  if (templates.length) {
    const row = document.createElement('div');
    row.className = 'template-row';

    const label = document.createElement('span');
    label.className = 'template-label';
    label.textContent = t('admin.reply.templates');
    row.appendChild(label);

    templates.forEach((tpl) => {
      // 用「員工回報時使用的語言」取範本內容，不是管理者目前的介面語言——
      // 這句話是要給員工看的
      const content = (item.lang === 'ZH' ? tpl.content_zh : tpl.content_id)
                   || tpl.content_zh || tpl.content_id;
      if (!content) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'template-btn';
      btn.textContent = content.length > 18 ? content.slice(0, 18) + '…' : content;
      btn.title = content;

      btn.addEventListener('click', () => {
        // 已經有內容就接在後面，不要把管理者打的字直接蓋掉
        textarea.value = textarea.value.trim()
          ? textarea.value.replace(/\s+$/, '') + String.fromCharCode(10) + content
          : content;
        draft.response = textarea.value;
        textarea.focus();
      });

      row.appendChild(btn);
    });

    form.appendChild(row);
  }

  form.appendChild(textarea);

  // --- 必填提示 ---
  const hint = document.createElement('div');
  hint.className = 'reply-required';
  hint.textContent = t('admin.reply.required');
  form.appendChild(hint);

  // --- 錯誤訊息 ---
  const error = document.createElement('div');
  error.className = 'reply-error result error hidden';
  form.appendChild(error);

  // --- 儲存 ---
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn-primary';
  saveBtn.textContent = state.saving ? t('admin.reply.saving') : t('admin.reply.save');
  saveBtn.disabled = state.saving;
  saveBtn.addEventListener('click', () => saveCase(item, draft, form));
  form.appendChild(saveBtn);

  renderReplyHint(form, draft);
  return form;
}


/** 需要回覆的狀態才把必填提示亮起來 */
function renderReplyHint(form, draft) {
  const hint = form.querySelector('.reply-required');
  if (hint) hint.classList.toggle('active', STATUS_NEEDS_RESPONSE.indexOf(draft.status_code) >= 0);
}


/**
 * 取得目前展開案件的草稿。
 * 換到另一筆案件時重新以該筆的現有內容開始。
 */
function currentDraft(item) {
  if (!state.draft || state.draft.case_id !== item.case_id) {
    state.draft = {
      case_id:         item.case_id,
      status_code:     item.status_code || 'ST_NEW',
      response:        item.response || '',
      handler_code: (item.handler && item.handler.code) || '',
    };
  }
  return state.draft;
}


/**
 * 挑出這筆案件適用的範本。
 *
 * 先找分類對得上的；一個都沒有就全部顯示，
 * 總比讓管理者看到一排空的「常用回覆」好。
 */
function templatesForCase(item) {
  const categories = item.category_codes || [];
  const matched = state.templates.filter(function (tpl) {
    return tpl.category && categories.indexOf(tpl.category) >= 0;
  });
  return matched.length ? matched : state.templates;
}


/** 儲存案件的狀態與回覆 */
async function saveCase(item, draft, form) {
  if (state.saving) return;

  const error   = form.querySelector('.reply-error');
  const saveBtn = form.querySelector('.btn-primary');

  error.textContent = '';
  error.classList.add('hidden');

  const response = draft.response.trim();

  // 前端先擋一次，省掉一趟 3～8 秒的往返
  if (STATUS_NEEDS_RESPONSE.indexOf(draft.status_code) >= 0 && !response) {
    error.textContent = t('err.RESPONSE_REQUIRED');
    error.classList.remove('hidden');
    return;
  }

  // 什麼都沒改就不要白跑一趟
  const currentHandler = (item.handler && item.handler.code) || '';
  if (draft.status_code === item.status_code
      && response === (item.response || '')
      && draft.handler_code === currentHandler) {
    error.textContent = t('admin.reply.noChange');
    error.classList.remove('hidden');
    return;
  }

  state.saving = true;
  saveBtn.disabled = true;
  saveBtn.textContent = t('admin.reply.saving');

  try {
    const result = await Api.updateCase(
      AdminSession.token(), item.case_id, draft.status_code, response, draft.handler_code);

    if (!result.ok) {
      if (result.error === 'UNAUTHORIZED') {
        AdminSession.clear();
        location.replace('admin.html');
        return;
      }
      error.textContent = errorMessage(result);
      error.classList.remove('hidden');
      return;
    }

    // 重新載入整份清單，統計卡片才會跟著更新——
    // 只換掉畫面上那一筆的話，「未處理 N 件」會停在舊數字
    state.savedMsg = t('admin.reply.saved').replace('{id}', item.case_id);
    state.draft = null;
    await loadCases();
    renderAll();

  } catch (err) {
    error.textContent = t('err.NETWORK');
    error.classList.remove('hidden');
  } finally {
    state.saving = false;
    if (saveBtn.isConnected) {
      saveBtn.disabled = false;
      saveBtn.textContent = t('admin.reply.save');
    }
  }
}


// ===== 小工具（與查詢頁同一套寫法）=====

function categoryChips(item) {
  return (item.category_codes || [])
    .map((code) => `<span class="chip">${escapeHtml(labelOf('CATEGORY', code))}</span>`)
    .join('');
}

function starText(rating) {
  const n = Number(rating) || 0;
  return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
}

function detailRow(label, value, isHtml) {
  const row = document.createElement('div');
  row.className = 'case-row';

  const l = document.createElement('div');
  l.className = 'case-row-label';
  l.textContent = label;

  const v = document.createElement('div');
  v.className = 'case-row-value';
  if (isHtml) v.innerHTML = value; else v.textContent = value;

  row.appendChild(l);
  row.appendChild(v);
  return row;
}

/** 狀態徽章：未處理紅、處理中黃、已結案綠 */
function statusBadge(code) {
  const cls = { ST_NEW: 'new', ST_PROC: 'proc', ST_DONE: 'done' }[code] || 'new';
  return `<span class="status-badge ${cls}">${escapeHtml(labelOf('STATUS', code))}</span>`;
}

/** 把代碼翻成目前語言的顯示文字；查不到就原樣顯示代碼 */
function labelOf(type, code) {
  if (!code) return '—';
  const list = (state.options && state.options[type]) || [];
  const found = list.find((o) => o.code === code);
  return found ? optionLabel(found) : code;
}


/** 照片縮圖。點一下在本頁全螢幕放大，不會跳到 Google Drive */
function buildThumbs(images) {
  const wrap = document.createElement('div');
  wrap.className = 'case-thumbs';

  images.forEach((image, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'case-thumb';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openLightbox(image.preview_url);
    });

    const img = document.createElement('img');
    img.src = image.preview_url;
    img.alt = '';

    // 萬一圖片載不出來，退回顯示連結，不要留一個破圖
    img.addEventListener('error', () => {
      const link = document.createElement('a');
      link.className = 'case-photo';
      link.href = image.view_url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = '📷 ' + (index + 1);
      btn.replaceWith(link);
    });

    btn.appendChild(img);
    wrap.appendChild(btn);
  });

  return wrap;
}


function openLightbox(url) {
  const overlay = document.createElement('div');
  overlay.className = 'lightbox';

  const img = document.createElement('img');
  img.src = url;
  img.alt = '';
  overlay.appendChild(img);

  const close = () => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    document.body.classList.remove('no-scroll');
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };

  overlay.addEventListener('click', close);
  document.addEventListener('keydown', onKey);

  document.body.appendChild(overlay);
  document.body.classList.add('no-scroll');
}


// ===== 訊息 =====

function show(box, message) {
  box.textContent = message;
  box.classList.remove('hidden');
}

function hide(box) {
  box.textContent = '';
  box.classList.add('hidden');
}


// ===== 事件 =====

el.logoutBtn.addEventListener('click', () => {
  adminLogout();
});

document.querySelectorAll('.lang-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    setLang(btn.dataset.lang);
    buildFilterSelects();   // 下拉選單的文字也要跟著換語言
    renderAll();
  });
});
