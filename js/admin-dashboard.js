/**
 * 管理者 Dashboard（規格 §3.8，僅 SUPER）
 *
 * 規格原本寫的是「在 Sheet 裡用公式做一個 Dashboard 分頁」，
 * 實作改成網頁，理由有兩個：
 *
 *   1. 規格 §5.6 寫「管理者不需要 Sheet 權限」——
 *      做在 Sheet 裡的話，只有試算表的擁有者看得到。
 *   2. Sheet 沒有圓角、陰影，也沒有語言切換，
 *      而這一頁需要的樣式與互動，app 這邊全部都是現成的。
 *
 *
 * ⚠️ 統計資料一次全部拿回來，之後切換月份 / 年度都不再打 API。
 *    Apps Script 每次回應要 3～8 秒，切一次下拉等一次的話沒有人想開這一頁。
 *    資料量很小（每個月一個小物件），累積十年也才 120 筆。
 *
 *
 * 📌 兩個下拉各管一個區塊，刻意不連動：
 *    上面的月份下拉管月份區塊，下面的年度下拉管年度區塊。
 *    連動的話會出現「上面是 8 月、下面卻是另一年」的錯亂。
 */


const state = {
  profile: null,
  options: null,     // 代碼 → 顯示文字
  stats:   null,     // 後端一次回傳的全部統計
  month:   '',       // 目前選定的月份 YYYYMM
  year:    '',       // 目前選定的年度 YYYY
};


const el = {
  bootView:  document.getElementById('bootView'),
  bootText:  document.getElementById('bootText'),
  errorView: document.getElementById('errorView'),
  mainView:  document.getElementById('mainView'),

  adminBar:  document.getElementById('adminBar'),
  adminName: document.getElementById('adminName'),
  adminRole: document.getElementById('adminRole'),
  logoutBtn: document.getElementById('logoutBtn'),
  pageTitle: document.getElementById('pageTitle'),

  dashTitle: document.getElementById('dashTitle'),
  labelMonth: document.getElementById('labelMonth'),
  labelYear:  document.getElementById('labelYear'),
  fMonth:     document.getElementById('fMonth'),
  fYear:      document.getElementById('fYear'),
  updatedAt:  document.getElementById('updatedAt'),
  emptyNote:  document.getElementById('emptyNote'),

  monthSection: document.getElementById('monthSection'),
  yearSection:  document.getElementById('yearSection'),

  mSection:  document.getElementById('mSection'),
  mTiles:    document.getElementById('mTiles'),
  mLocation: document.getElementById('mLocation'),
  mStatus:   document.getElementById('mStatus'),
  mCategory: document.getElementById('mCategory'),
  labelByLocation: document.getElementById('labelByLocation'),
  labelByStatus:   document.getElementById('labelByStatus'),
  labelByCategory: document.getElementById('labelByCategory'),
  noteByCategory:  document.getElementById('noteByCategory'),

  ySection:  document.getElementById('ySection'),
  yTiles:    document.getElementById('yTiles'),
  trendWrap: document.getElementById('trendWrap'),
  legendCount:  document.getElementById('legendCount'),
  legendRating: document.getElementById('legendRating'),
  labelTrend:    document.getElementById('labelTrend'),
  labelLocTable: document.getElementById('labelLocTable'),
  tblHead: document.getElementById('tblHead'),
  tblBody: document.getElementById('tblBody'),
};


/**
 * 圖表配色。
 *
 * ⚠️ 挑選標準不只是「好看」，而是**色相與明暗都要拉開**：
 *
 *    第一版全部是中等明度的粉色系，相鄰兩色的明暗差只有 1.13～1.40，
 *    等於只靠色相在區分——並排時看起來全都一樣。
 *
 *    這一版相鄰色的明暗差是 1.31～4.49，而且色相跨越藍 / 橘 / 綠 / 紫 / 青。
 *    好處是**印成黑白也分得出來**，不必靠顏色濃度硬撐。
 */
const CHART_COLORS  = ['#17457a', '#e8a33d', '#2a7d5f', '#9d6fc4', '#5bb8d4'];

/** 狀態是有語意的，不能依序取色：紅=未處理、橘=處理中、綠=已結案 */
const STATUS_COLORS = { ST_NEW: '#c0392b', ST_PROC: '#e8a33d', ST_DONE: '#2a7d5f' };


// ===== 啟動 =====

boot();

async function boot() {
  try {
    state.profile = await requireAdmin();
    if (!state.profile) return;

    // 只有超級管理者看得到。後端本來就會擋（withAuth 的第三個參數），
    // 這裡導回案件列表只是比讓他看到一頁 FORBIDDEN 友善
    if (!state.profile.is_super) {
      location.replace('admin-cases.html');
      return;
    }

    const [options, result] = await Promise.all([
      loadOptions(),
      Api.getDashboardStats(AdminSession.token()),
    ]);

    if (!result.ok) {
      if (result.error === 'UNAUTHORIZED') {
        AdminSession.clear();
        location.replace('admin.html');
        return;
      }
      throw new Error(errorMessage(result));
    }

    state.options = options;
    state.stats   = result.data;
    state.month   = (state.stats.available_months || [])[0] || '';
    state.year    = (state.stats.available_years  || [])[0] || '';

    el.bootView.classList.add('hidden');
    el.adminBar.classList.remove('hidden');
    el.mainView.classList.remove('hidden');

    buildSelects();
    renderAll();

  } catch (err) {
    el.bootView.classList.add('hidden');
    el.errorView.textContent = err.message || t('err.NETWORK');
    el.errorView.classList.remove('hidden');
  }
}


/** 月份與年度下拉的內容，來自後端實際有資料的清單 */
function buildSelects() {
  const months = state.stats.available_months || [];
  const years  = state.stats.available_years  || [];

  el.fMonth.innerHTML = months.map(function (key) {
    return `<option value="${escapeHtml(key)}">${escapeHtml(monthLabel(key))}</option>`;
  }).join('');
  el.fMonth.value = state.month;

  el.fYear.innerHTML = years.map(function (key) {
    return `<option value="${escapeHtml(key)}">${escapeHtml(key)}</option>`;
  }).join('');
  el.fYear.value = state.year;
}


// ===== 畫面 =====

function renderAll() {
  renderTexts();

  const hasData = (state.stats.available_months || []).length > 0;
  el.monthSection.classList.toggle('hidden', !hasData);
  el.yearSection.classList.toggle('hidden', !hasData);
  el.emptyNote.classList.toggle('hidden', hasData);
  el.emptyNote.textContent = hasData ? '' : t('dash.empty');
  if (!hasData) return;

  try {
    renderMonth();
    renderYear();
  } catch (err) {
    // 後端欄位改名而前端還是舊版時（GitHub Pages 會快取 JS 十分鐘），
    // 寧可顯示一行錯誤訊息，也不要變成一片空白又不說為什麼
    el.errorView.textContent = t('err.UNKNOWN');
    el.errorView.classList.remove('hidden');
  }
}


function renderTexts() {
  document.documentElement.lang = htmlLang();
  document.title = t('dash.title') + ' · ' + t('appName');

  el.pageTitle.textContent = t('dash.entry');
  el.dashTitle.textContent = t('dash.title');
  el.bootText.textContent  = t('admin.checking');
  el.logoutBtn.textContent = t('admin.logout');

  if (state.profile) {
    el.adminName.textContent = t('admin.hello')
      .replace('{name}', state.profile.name || state.profile.account);
    el.adminRole.textContent = adminRoleLabel(state.profile.role);
    renderAdminNav('dashboard', state.profile);
  }

  el.labelMonth.textContent = t('dash.month');
  el.labelYear.textContent  = t('dash.year');

  el.labelByLocation.textContent = t('dash.byLocation');
  el.labelByStatus.textContent   = t('dash.byStatus');
  el.labelByCategory.textContent = t('dash.byCategory');
  el.noteByCategory.textContent  = t('dash.byCategoryNote');
  el.labelTrend.textContent      = t('dash.trend');
  el.labelLocTable.textContent   = t('dash.locTable');
  el.legendCount.textContent     = t('dash.trendCount');
  el.legendRating.textContent    = t('dash.trendRating');

  if (state.stats) {
    el.updatedAt.textContent = t('dash.updatedAt').replace('{t}', state.stats.generated_at || '');
  }

  // 下拉的月份文字也要跟著換語言
  if (state.stats && (state.stats.available_months || []).length) buildSelects();

  renderSystemFooter('siteFooter');

  document.querySelectorAll('.lang-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.lang === getLang());
  });
}


function renderMonth() {
  const data = state.stats.months[state.month];
  if (!data) return;

  const label = monthLabel(state.month);
  el.mSection.textContent = fillMonth(t('dash.mSection'), state.month);

  el.mTiles.innerHTML = [
    tile(data.total, fillMonth(t('dash.mTotal'), state.month)),
    tile(data.new, t('dash.mNew'), 'dash-tile-alert'),
    tile(pct(data.done_rate), t('dash.mDone')),
    tile(num(data.avg_days), t('dash.mDays')),
    tile(num(data.avg_rating), t('dash.mRating')),
  ].join('');

  el.mLocation.innerHTML = bars(data.by_location, 'LOCATION', data.total, false, null);
  el.mStatus.innerHTML   = bars(data.by_status, 'STATUS', data.total, true, STATUS_COLORS);
  el.mCategory.innerHTML = bars(data.by_category, 'CATEGORY', data.total, true, null);
}


function renderYear() {
  const data = state.stats.years[state.year];
  if (!data) return;

  el.ySection.textContent = t('dash.ySection').replace('{y}', state.year);

  el.yTiles.innerHTML = [
    tile(data.total, t('dash.yTotal')),
    tile(pct(data.done_rate), t('dash.yDone')),
    tile(num(data.avg_days), t('dash.yDays')),
    tile(num(data.avg_rating), t('dash.yRating')),
  ].join('');

  el.trendWrap.innerHTML = trendChart(data.monthly || []);

  const cols = ['dash.colLoc', 'dash.colCount', 'dash.colRating', 'dash.colDone', 'dash.colDays'];
  el.tblHead.innerHTML = cols.map(function (key, i) {
    return `<th class="${i ? 'num' : ''}">${escapeHtml(t(key))}</th>`;
  }).join('');

  // 每一格帶上 data-label：手機上表頭會被隱藏，改用 CSS 的 ::before
  // 把欄位名稱顯示在值的左邊，一間餐廳變成一張卡片。
  // 原本是靠橫向捲動，但捲動軸在手機上看不到，使用者不會知道右邊還有東西
  const labels = cols.map(function (key) { return t(key); });

  const rows = data.locations || [];
  el.tblBody.innerHTML = rows.length
    ? rows.map(function (r) {
        return `<tr>
          <td>${escapeHtml(codeLabel('LOCATION', r.code))}</td>
          <td class="num" data-label="${escapeHtml(labels[1])}">${r.total}</td>
          <td class="num" data-label="${escapeHtml(labels[2])}">${escapeHtml(num(r.avg_rating))}</td>
          <td class="num" data-label="${escapeHtml(labels[3])}">${escapeHtml(pct(r.done_rate))}</td>
          <td class="num" data-label="${escapeHtml(labels[4])}">${escapeHtml(num(r.avg_days))}</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="5" class="muted">${escapeHtml(t('dash.noData'))}</td></tr>`;
}


// ===== 元件 =====

function tile(value, label, extraClass) {
  return `<div class="dash-tile">
    <div class="dash-tile-num ${extraClass || ''}">${escapeHtml(String(value))}</div>
    <div class="dash-tile-label">${escapeHtml(label)}</div>
  </div>`;
}


/**
 * 橫條圖。
 *
 * 條長用「佔最大值的比例」，右邊的數字才是實際值——
 * 用佔總數的比例當長度的話，最大的那條也只有 40% 寬，整張圖會空一半。
 *
 * @param {Array}  list    [{ code, count }]
 * @param {string} type    選項類型，用來查顯示文字
 * @param {number} denom   算百分比的分母
 * @param {boolean} asPct  右邊顯示百分比還是件數
 * @param {Object} colorMap 有語意的配色（狀態用）；null 就依序取色
 */
function bars(list, type, denom, asPct, colorMap) {
  if (!list || !list.length) {
    return `<div class="muted">${escapeHtml(t('dash.noData'))}</div>`;
  }

  const max = Math.max.apply(null, list.map(function (x) { return x.count; })) || 1;

  return list.map(function (item, i) {
    const width = Math.round(item.count / max * 100);
    const color = colorMap
      ? (colorMap[item.code] || CHART_COLORS[i % CHART_COLORS.length])
      : CHART_COLORS[i % CHART_COLORS.length];
    const right = asPct && denom > 0
      ? Math.round(item.count / denom * 100) + '%'
      : item.count;

    return `<div class="dash-bar-row">
      <div class="dash-bar-name">${escapeHtml(codeLabel(type, item.code))}</div>
      <div class="dash-bar-track">
        <div class="dash-bar-fill" style="width:${width}%;background:${color}"></div>
      </div>
      <div class="dash-bar-value">${escapeHtml(String(right))}</div>
    </div>`;
  }).join('');
}


/**
 * 月度趨勢：回報數（實線）與平均滿意度（虛線）疊在同一張圖。
 *
 * ⚠️ 平均滿意度是 null 的月份要「斷線」，不可以畫成 0。
 *    「那個月沒有人回報」跟「大家都給 0 分」是完全不同的兩件事，
 *    畫成 0 會讓那幾個月看起來像災難。
 *    回報數則相反：0 就是事實，照畫。
 */
function trendChart(monthly) {
  const W = 660, H = 170, TOP = 16, BOTTOM = 128, LEFT = 40, RIGHT = 640;
  const step = (RIGHT - LEFT) / 11;

  const counts = monthly.map(function (m) { return m.count || 0; });
  const maxCount = Math.max.apply(null, counts) || 1;

  const y = function (value, max) { return BOTTOM - (value / max) * (BOTTOM - TOP); };

  const countPts = monthly.map(function (m, i) {
    return (LEFT + i * step).toFixed(1) + ',' + y(m.count || 0, maxCount).toFixed(1);
  }).join(' ');

  // 滿意度：把連續有資料的月份切成一段一段，每一段各自畫一條線
  const ratingSegments = [];
  let current = [];
  monthly.forEach(function (m, i) {
    if (m.avg_rating === null || m.avg_rating === undefined) {
      if (current.length) ratingSegments.push(current);
      current = [];
      return;
    }
    current.push((LEFT + i * step).toFixed(1) + ',' + y(m.avg_rating, 5).toFixed(1));
  });
  if (current.length) ratingSegments.push(current);

  const ratingLines = ratingSegments.map(function (seg) {
    // 只有一個點的區段畫不出線，補一個小圓點
    if (seg.length === 1) {
      const xy = seg[0].split(',');
      return `<circle cx="${xy[0]}" cy="${xy[1]}" r="3" fill="#e8a33d"></circle>`;
    }
    return `<polyline points="${seg.join(' ')}" fill="none" stroke="#e8a33d"
             stroke-width="2.5" stroke-dasharray="5 4"></polyline>`;
  }).join('');

  const dots = monthly.map(function (m, i) {
    if (!m.count) return '';
    return `<circle cx="${(LEFT + i * step).toFixed(1)}" cy="${y(m.count, maxCount).toFixed(1)}"
             r="3" fill="#17457a"></circle>`;
  }).join('');

  const labels = monthly.map(function (m, i) {
    return `<text x="${(LEFT + i * step).toFixed(1)}" y="150">${m.month}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" class="dash-trend" role="img"
            aria-label="${escapeHtml(t('dash.trend'))}">
    <line x1="${LEFT - 16}" y1="${BOTTOM}" x2="${RIGHT + 16}" y2="${BOTTOM}"></line>
    <polyline points="${countPts}" fill="none" stroke="#17457a" stroke-width="2.5"></polyline>
    ${ratingLines}
    ${dots}
    <g class="dash-trend-label">${labels}</g>
  </svg>`;
}


// ===== 小工具 =====

/** 代碼換成目前語言的顯示文字；查不到就顯示代碼本身（總比空白好排查） */
function codeLabel(type, code) {
  const list = (state.options && state.options[type]) || [];
  const hit = list.filter(function (o) { return o.code === code; })[0];
  return hit ? optionLabel(hit) : code;
}

/** YYYYMM → 依語言的顯示文字 */
function monthLabel(key) {
  const y = String(key).substring(0, 4);
  const m = String(key).substring(4, 6);
  return t('dash.monthLabel').replace('{y}', y).replace('{m}', String(Number(m)));
}

/** 把翻譯字串裡的 {y} {m} 換成該月份 */
function fillMonth(text, key) {
  const y = String(key).substring(0, 4);
  const m = String(Number(String(key).substring(4, 6)));
  return text.replace('{y}', y).replace('{m}', m);
}

/** 沒有樣本時後端回傳 null，畫面顯示「–」而不是 0 —— 0 是會誤導人的 */
function num(value) {
  return (value === null || value === undefined) ? '–' : String(value);
}

function pct(value) {
  return (value === null || value === undefined) ? '–' : value + '%';
}


// ===== 事件 =====

el.logoutBtn.addEventListener('click', function () { adminLogout(); });

// 切換下拉不打 API：統計全部已經在手上了，所以是瞬間的
el.fMonth.addEventListener('change', function () {
  state.month = el.fMonth.value;
  renderMonth();
});

el.fYear.addEventListener('change', function () {
  state.year = el.fYear.value;
  renderYear();
});

document.querySelectorAll('.lang-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    setLang(btn.dataset.lang);
    renderAll();
  });
});
