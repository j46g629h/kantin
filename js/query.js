/**
 * 案件查詢頁邏輯
 *
 * 只有一個輸入框，程式自動判斷使用者輸入的是案件編號還是工號——
 * 員工不必先搞懂「我要用哪一種方式查」。
 */


/** 案件編號的格式：PCI-YYYYMM-NNN */
const CASE_ID_PATTERN = /^PCI-\d{6}-\d+$/i;


const state = {
  options:  null,   // 用來把代碼翻成看得懂的文字
  cases:    [],
  openId:   '',     // 目前展開的案件編號
  searched: false,  // 是否已經查詢過（剛進頁面時不該顯示「查無資料」）
};

const el = {
  form:        document.getElementById('searchForm'),
  keyword:     document.getElementById('keyword'),
  searchBtn:   document.getElementById('searchBtn'),
  searchHint:  document.getElementById('searchHint'),
  loadingView: document.getElementById('loadingView'),
  searchError: document.getElementById('searchError'),
  resultInfo:  document.getElementById('resultInfo'),
  resultList:  document.getElementById('resultList'),
};


// ===== 啟動 =====

init();

async function init() {
  bindLanguageButtons();
  renderTexts();

  try {
    state.options = await loadOptions();
  } catch (err) {
    showError(t('err.NETWORK'));
  }

  // 從網址帶入關鍵字（例如提交成功頁直接連過來查）
  const preset = new URLSearchParams(location.search).get('q');
  if (preset) {
    el.keyword.value = preset;
    el.form.requestSubmit();
  }
}


// ===== 語言 =====

function bindLanguageButtons() {
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      setLang(btn.dataset.lang);
      renderTexts();
      renderResults();      // 結果裡的代碼也要跟著換語言
    });
  });
}

function renderTexts() {
  document.documentElement.lang = htmlLang();
  document.title = t('query.title') + ' · ' + t('appName');

  setText('pageTitle',   t('query.title'));
  setText('labelKeyword',t('query.keyword'));
  setText('loadingText', t('loading'));

  el.keyword.placeholder  = t('query.placeholder');
  el.searchBtn.textContent = t('query.search');
  if (!el.resultList.children.length) el.searchHint.textContent = t('query.hint');

  renderSystemFooter('siteFooter');

  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === getLang());
  });
}

function setText(id, text) {
  const node = document.getElementById(id);
  if (node) node.textContent = text;
}


// ===== 查詢 =====

el.form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const keyword = el.keyword.value.trim();
  if (!keyword) {
    showError(t('query.needKeyword'));
    return;
  }

  clearError();
  clearResults();
  setSearching(true);

  try {
    // 自動判斷：長得像案件編號就查單筆，否則當成工號查全部
    const isCaseId = CASE_ID_PATTERN.test(keyword);
    const result = isCaseId
      ? await Api.getCaseById(keyword)
      : await Api.getCasesByEmpId(keyword);

    if (!result.ok) {
      showError(errorMessage(result));
      return;
    }

    state.cases = result.data.cases || [];
    state.openId = '';
    state.searched = true;

    // 只有一筆時直接展開，省一次點擊
    if (state.cases.length === 1) state.openId = state.cases[0].case_id;

    renderResults();

  } catch (err) {
    showError(t('err.NETWORK'));
  } finally {
    setSearching(false);
  }
});

function setSearching(busy) {
  el.searchBtn.disabled = busy;
  el.searchBtn.textContent = busy ? t('query.searching') : t('query.search');
  el.loadingView.classList.toggle('hidden', !busy);
}


// ===== 結果 =====

function renderResults() {
  el.resultList.innerHTML = '';

  if (!state.cases.length) {
    el.resultInfo.classList.add('hidden');
    // 沒有結果時一定要說一聲。
    // 什麼都不顯示的話，使用者分不出是「查無資料」還是「系統壞了」。
    if (state.searched) showError(t('query.noResult'));
    return;
  }

  el.resultInfo.textContent = t('query.found').replace('{n}', state.cases.length);
  el.resultInfo.classList.remove('hidden');
  el.searchHint.textContent = '';

  state.cases.forEach((item) => {
    el.resultList.appendChild(buildCaseCard(item));
  });
}

function buildCaseCard(item) {
  const isOpen = state.openId === item.case_id;

  const card = document.createElement('div');
  card.className = 'case-card' + (isOpen ? ' open' : '');

  // --- 摘要（可點擊展開）---
  const head = document.createElement('button');
  head.type = 'button';
  head.className = 'case-head';
  head.innerHTML =
    `<div class="case-head-main">` +
      `<div class="case-no">${escapeHtml(item.case_id)}</div>` +
      `<div class="case-meta">${escapeHtml(item.submit_time)}</div>` +
      `<div class="case-meta">${escapeHtml(labelOf('LOCATION', item.location_code))}` +
        ` · ${escapeHtml(labelOf('MEAL', item.meal_code))}</div>` +
    `</div>` +
    `<div class="case-head-side">` +
      statusBadge(item.status_code) +
      `<span class="case-arrow">${isOpen ? '▴' : '▾'}</span>` +
    `</div>`;

  head.addEventListener('click', () => {
    state.openId = isOpen ? '' : item.case_id;   // 再點一次收合
    renderResults();
  });

  card.appendChild(head);

  if (isOpen) card.appendChild(buildCaseDetail(item));
  return card;
}

function buildCaseDetail(item) {
  const box = document.createElement('div');
  box.className = 'case-detail';

  // 問題分類
  const categories = item.category_codes
    .map((code) => `<span class="chip">${escapeHtml(labelOf('CATEGORY', code))}</span>`)
    .join('');
  box.appendChild(detailRow(t('form.category'), categories, true));

  // 滿意度
  const stars = '★'.repeat(item.rating) + '☆'.repeat(Math.max(0, 5 - item.rating));
  box.appendChild(detailRow(t('form.rating'),
    `<span class="case-stars">${stars}</span> ${escapeHtml(t('rating.' + item.rating) || '')}`, true));

  // 問題描述
  if (item.description) {
    box.appendChild(detailRow(t('form.description'), escapeHtml(item.description), true));
  }

  // 照片
  if (item.images.length) {
    const row = detailRow(t('query.photos'), '', true);
    row.querySelector('.case-row-value').appendChild(buildThumbs(item.images));
    box.appendChild(row);
  }

  // 管理者回覆
  const replyBox = document.createElement('div');
  replyBox.className = 'case-reply' + (item.response ? '' : ' empty');
  replyBox.innerHTML = item.response
    ? `<div class="case-reply-title">${escapeHtml(t('query.reply'))}` +
      (item.response_time ? ` <span class="case-reply-time">${escapeHtml(item.response_time)}</span>` : '') +
      `</div><div>${escapeHtml(item.response)}</div>`
    : `<div>${escapeHtml(t('query.noReply'))}</div>`;
  box.appendChild(replyBox);

  return box;
}

function detailRow(label, valueHtml, isHtml) {
  const row = document.createElement('div');
  row.className = 'case-row';

  const l = document.createElement('div');
  l.className = 'case-row-label';
  l.textContent = label;

  const v = document.createElement('div');
  v.className = 'case-row-value';
  if (isHtml) v.innerHTML = valueHtml; else v.textContent = valueHtml;

  row.appendChild(l);
  row.appendChild(v);
  return row;
}

/**
 * 照片縮圖。點一下在本頁全螢幕放大，不會跳到 Google Drive。
 */
function buildThumbs(images) {
  const wrap = document.createElement('div');
  wrap.className = 'case-thumbs';

  images.forEach((image, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'case-thumb';
    btn.addEventListener('click', () => openLightbox(image.preview_url));

    const img = document.createElement('img');
    img.src = image.preview_url;
    img.alt = '';
    // 不用 loading="lazy"：一次最多只顯示 2 張，延遲載入沒有好處，
    // 反而遇過瀏覽器判定「不在畫面內」而始終不發出請求，看起來像壞掉

    // 萬一圖片載不出來（Drive 端點改變、網路問題），
    // 退回顯示連結，不要留一個破圖讓使用者不知所措
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


/** 全螢幕檢視照片：點任何地方或按 Esc 關閉 */
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
  document.body.classList.add('no-scroll');   // 放大時背景不要跟著捲動
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


// ===== 訊息 =====

function showError(message) {
  el.searchError.textContent = message;
  el.searchError.classList.remove('hidden');
}

function clearError() {
  el.searchError.textContent = '';
  el.searchError.classList.add('hidden');
}

function clearResults() {
  state.cases = [];
  el.resultList.innerHTML = '';
  el.resultInfo.classList.add('hidden');
}
