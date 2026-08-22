/**
 * 管理者帳號管理頁（規格 §6.7，僅 SUPER）
 *
 * 四個動作：新增、停用、啟用、重設密碼。
 *
 * ⚠️ 這一頁的入口守衛只是「體驗上的導引」。
 *    真正的把關在後端——manageAdmin 被 withAuth(p, handler, true) 包住，
 *    非 SUPER 打過去一律回 FORBIDDEN。
 *    前端原始碼在 GitHub 上是公開的，任何人都可以把這段判斷刪掉。
 *
 *
 * 📌 為什麼沒有「調整角色」的按鈕：
 *
 *    一般管理者的生命週期就是「加入 → 離職停用」，中間不會變角色。
 *    唯一會用到的是超級管理者交接，而那用「新增一個 SUPER + 停用舊的」
 *    就完成了。少一個按鈕就少一次手滑把人降級的機會。
 *    後端的 setRole 仍然做好了（gas/Admins.js），日後要開放時前端加個按鈕即可。
 */


// ===== 狀態 =====

const state = {
  profile: null,
  admins:  [],
  self:    '',       // 目前登入者的帳號（自己那一列不給停用）
  activeSuperCount: 0,

  loading:  false,
  busy:     '',      // 正在處理中的帳號（那一列的按鈕要變灰）
  creating: false,
  addOpen:  false,

  /**
   * 剛產生出來的一次性密碼。
   * { account, password, mode: 'create' | 'reset' }
   *
   * 密碼只會從後端回來這一次——Sheet 裡只存雜湊，事後查不回來。
   * 所以在使用者按下「我已經記下來了」之前，這個彈窗不能被任何重畫蓋掉。
   */
  password: null,

  /**
   * 動作完成後短暫顯示的提示。
   *
   * 存的是「要顯示什麼」（翻譯鍵 + 姓名），不是已經組好的句子——
   * 存句子的話，使用者切換語言後那一行會停在舊語言不動。
   * 這跟案件頁把草稿存進 state 是同一個道理：畫面會重畫，資料要自己留著。
   *
   * { key: 'accounts.disabled'|'accounts.enabled', name: string, kicked: boolean }
   */
  note: null,
};

/** 動作提示的計時器（連續操作時要先取消上一個，否則會提早消失） */
let noteTimer = null;


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

  countInfo:  document.getElementById('countInfo'),
  addBtn:     document.getElementById('addBtn'),
  actionNote: document.getElementById('actionNote'),
  listError:  document.getElementById('listError'),

  addForm:      document.getElementById('addForm'),
  addFormTitle: document.getElementById('addFormTitle'),
  labelName:    document.getElementById('labelName'),
  labelAccount: document.getElementById('labelAccount'),
  labelEmail:   document.getElementById('labelEmail'),
  labelRole:    document.getElementById('labelRole'),
  roleHint:     document.getElementById('roleHint'),
  fName:        document.getElementById('fName'),
  fAccount:     document.getElementById('fAccount'),
  fEmail:       document.getElementById('fEmail'),
  fRole:        document.getElementById('fRole'),
  labelInitPw:  document.getElementById('labelInitPw'),
  newPwManual:     document.getElementById('newPwManual'),
  newPwManualHint: document.getElementById('newPwManualHint'),
  newPwAuto:       document.getElementById('newPwAuto'),
  newPwAutoHint:   document.getElementById('newPwAutoHint'),
  newPwBox:        document.getElementById('newPwBox'),
  fPassword:       document.getElementById('fPassword'),
  showNewPw:       document.getElementById('showNewPw'),
  newPwShowLabel:  document.getElementById('newPwShowLabel'),
  addError:     document.getElementById('addError'),
  createBtn:    document.getElementById('createBtn'),
  cancelBtn:    document.getElementById('cancelBtn'),

  listLoading:     document.getElementById('listLoading'),
  listLoadingText: document.getElementById('listLoadingText'),
  adminList:       document.getElementById('adminList'),
};


// ===== 啟動 =====

boot();

async function boot() {
  try {
    state.profile = await requireAdmin();
    if (!state.profile) return;      // 正在導回登入頁

    // 一般管理者不該看到這一頁。後端本來就會擋，
    // 但直接把他導回案件列表比讓他看到一頁 FORBIDDEN 友善
    if (!state.profile.is_super) {
      location.replace('admin-cases.html');
      return;
    }

    await loadAdmins();

    el.bootView.classList.add('hidden');
    el.adminBar.classList.remove('hidden');
    el.mainView.classList.remove('hidden');

    renderAll();

  } catch (err) {
    // 網路問題就留在這一頁顯示錯誤，不要把人踢回登入頁——
    // 重新登入一樣會失敗，只是多繞一圈
    el.bootView.classList.add('hidden');
    el.errorView.textContent = err.message || t('err.NETWORK');
    el.errorView.classList.remove('hidden');
  }
}


// ===== 讀取名單 =====

/**
 * 跟後端要管理者名單。
 * 失敗時不清空既有名單——寧可讓人看著舊資料，也不要整頁變空白。
 */
async function loadAdmins() {
  if (state.loading) return;

  state.loading = true;
  setLoading(true);
  hide(el.listError);

  try {
    const result = await Api.listAdmins(AdminSession.token());

    if (!result.ok) {
      if (result.error === 'UNAUTHORIZED') {
        AdminSession.clear();
        location.replace('admin.html');
        return;
      }
      show(el.listError, errorMessage(result));
      return;
    }

    // 防禦性存取：後端欄位改名時只會少顯示一段，不會整頁空白
    state.admins           = result.data.admins || [];
    state.self             = result.data.self || '';
    state.activeSuperCount = result.data.active_super_count || 0;

  } catch (err) {
    show(el.listError, t('err.NETWORK'));
  } finally {
    state.loading = false;
    setLoading(false);
  }
}


function setLoading(loading) {
  el.listLoading.classList.toggle('hidden', !loading);
}


// ===== 動作 =====

/** 新增管理者 */
async function createAdmin(event) {
  event.preventDefault();
  if (state.creating) return;

  const manualPw = document.querySelector('input[name="newPwMode"]:checked').value === 'manual';

  const data = {
    account: el.fAccount.value.trim(),
    name:    el.fName.value.trim(),
    email:   el.fEmail.value.trim(),
    role:    el.fRole.value,
    newPassword: manualPw ? el.fPassword.value.trim() : '',
  };

  // 前端先擋掉明顯的漏填，省一趟 3～8 秒的往返。真正的檢查在後端
  if (!data.name)    { show(el.addError, t('err.ADMIN_NAME_REQUIRED'));    el.fName.focus();    return; }
  if (!data.account) { show(el.addError, t('err.ADMIN_ACCOUNT_REQUIRED')); el.fAccount.focus(); return; }

  // 「不可與其他管理者重複」前端檢查不了（拿不到雜湊，也不該拿得到），
  // 那條由後端回 ADMIN_PASSWORD_TAKEN
  if (manualPw) {
    const ruleError = passwordRuleError(data.newPassword);
    if (ruleError) { show(el.addError, t(ruleError)); el.fPassword.focus(); return; }
  }

  state.creating = true;
  hide(el.addError);
  el.createBtn.disabled = true;
  el.createBtn.textContent = t('accounts.creating');

  try {
    const result = await Api.createAdmin(AdminSession.token(), data);

    if (!result.ok) {
      show(el.addError, errorMessage(result));
      // 「這組密碼已經有人在用」是最常見的失敗，游標直接回到密碼欄
      if (manualPw && String(result.error).indexOf('PASSWORD') >= 0) el.fPassword.focus();
      return;
    }

    // 先把密碼收好再重畫。這是它唯一一次出現的機會
    state.password = {
      account:   result.data.account,
      password:  result.data.initial_password,
      mode:      'create',
      generated: result.data.generated !== false,
    };

    closeAddForm();
    await loadAdmins();
    renderAll();

  } catch (err) {
    show(el.addError, t('err.NETWORK'));
  } finally {
    state.creating = false;
    el.createBtn.disabled = false;
    el.createBtn.textContent = t('accounts.create');
    renderPasswordBox();
  }
}


/** 停用 / 啟用 */
async function changeStatus(account, status) {
  const admin = findAdmin(account);
  if (!admin || state.busy) return;

  const who = admin.name || admin.account;
  const key = status === 'DISABLED' ? 'accounts.confirmDisable' : 'accounts.confirmEnable';
  if (!confirm(t(key).replace('{name}', who))) return;

  state.busy = account;
  renderList();
  hide(el.listError);

  try {
    const result = await Api.setAdminStatus(AdminSession.token(), account, status);

    if (!result.ok) {
      show(el.listError, errorMessage(result));
      return;
    }

    // 被停用的人如果正開著頁面，他手上的 token 會一起失效（後端做的）。
    // 這裡把作廢數字告訴操作者，讓「停用真的立刻生效」看得見
    setNote(status === 'DISABLED' ? 'accounts.disabled' : 'accounts.enabled',
            who, result.data.revoked_sessions > 0);

    await loadAdmins();

  } catch (err) {
    show(el.listError, t('err.NETWORK'));
  } finally {
    state.busy = '';
    renderAll();
  }
}


/**
 * 重設他人密碼。
 *
 * 先開一個對話框讓超級管理者選密碼要怎麼來：
 *   - 系統產生（預設）：12 碼隨機，猜不到
 *   - 自己設定：方便記住，但幾個人共用同一組的話，
 *     只要其中一個沒改密碼又外流，其他人的帳號等於一起破了
 *
 * 兩種都會要求對方第一次登入立刻改掉。
 */
function resetPassword(account) {
  const admin = findAdmin(account);
  if (!admin || state.busy) return;
  openResetDialog(admin);
}


/**
 * 重設密碼的對話框。
 *
 * 用自建對話框而不是 confirm()：confirm() 只能給一個是 / 否，
 * 沒辦法讓人選密碼來源、也沒辦法在同一個畫面上輸入密碼。
 */
function openResetDialog(admin) {
  const who = admin.name || admin.account;

  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <form class="pw-box pw-box-form" id="resetForm" novalidate>
      <h2 class="pw-title">${escapeHtml(t('accounts.resetTitle').replace('{name}', who))}</h2>
      <p class="pw-who">${escapeHtml(admin.account)}</p>

      <label class="pw-choice">
        <input type="radio" name="pwMode" value="manual" checked>
        <span>
          <span class="pw-choice-title">${escapeHtml(t('accounts.pwModeManual'))}</span>
          <span class="pw-choice-hint">${escapeHtml(t('accounts.pwModeManualHint'))}</span>
        </span>
      </label>

      <label class="pw-choice">
        <input type="radio" name="pwMode" value="auto">
        <span>
          <span class="pw-choice-title">${escapeHtml(t('accounts.pwModeAuto'))}</span>
          <span class="pw-choice-hint">${escapeHtml(t('accounts.pwModeAutoHint'))}</span>
        </span>
      </label>

      <div class="pw-manual" id="manualBox">
        <label class="filter-label" for="newPw">${escapeHtml(t('accounts.pwInput'))}</label>
        <input type="password" id="newPw" autocomplete="new-password" spellcheck="false"
               placeholder="${escapeHtml(t('accounts.pwInputPh'))}">
        <label class="pw-show">
          <input type="checkbox" id="showPw">
          <span>${escapeHtml(t('accounts.pwShow'))}</span>
        </label>
      </div>

      <p class="pw-warn">${escapeHtml(t('accounts.resetWarn'))}</p>

      <div id="resetError" class="result error hidden"></div>

      <div class="filter-actions">
        <button type="submit" class="btn-primary btn-inline" id="resetGo">
          ${escapeHtml(t('accounts.resetConfirm'))}
        </button>
        <button type="button" class="btn-secondary btn-inline" id="resetCancel">
          ${escapeHtml(t('accounts.cancel'))}
        </button>
      </div>
    </form>`;

  document.body.appendChild(overlay);
  document.body.classList.add('no-scroll');

  const manualBox = overlay.querySelector('#manualBox');
  const newPw     = overlay.querySelector('#newPw');
  const errorBox  = overlay.querySelector('#resetError');
  const goBtn     = overlay.querySelector('#resetGo');

  const close = function () {
    overlay.remove();
    document.body.classList.remove('no-scroll');
  };

  overlay.querySelectorAll('input[name="pwMode"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      const manual = radio.value === 'manual' && radio.checked;
      manualBox.classList.toggle('hidden', !manual);
      hide(errorBox);
      if (manual) newPw.focus();
    });
  });

  // 打錯字是這裡最常見的失誤，而且要等對方登不進去才會發現，
  // 所以給一個「看一眼確認」的開關
  overlay.querySelector('#showPw').addEventListener('change', function (e) {
    newPw.type = e.target.checked ? 'text' : 'password';
  });

  overlay.querySelector('#resetCancel').addEventListener('click', close);

  overlay.querySelector('#resetForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const manual   = overlay.querySelector('input[name="pwMode"]:checked').value === 'manual';
    const password = manual ? newPw.value.trim() : '';

    // 前端先擋掉不合規則的密碼，省一趟 3～8 秒的往返。後端一樣會再檢查一次。
    //
    // 「不可以跟其他管理者重複」這一條前端檢查不了，也不該檢查得了——
    // 那需要拿到所有人的密碼雜湊，而管理端頁面的原始碼在 GitHub 上是公開的。
    // 那條規則由後端回 ADMIN_PASSWORD_TAKEN，錯誤會顯示在這個對話框裡
    if (manual) {
      const ruleError = passwordRuleError(password);
      if (ruleError) { show(errorBox, t(ruleError)); newPw.focus(); return; }
    }

    goBtn.disabled = true;
    goBtn.textContent = t('accounts.resetting');
    hide(errorBox);

    doResetPassword(admin.account, password, errorBox, function () {
      goBtn.disabled = false;
      goBtn.textContent = t('accounts.resetConfirm');
    }, close);
  });

  newPw.focus();      // 預設就是「我自己設定」，直接讓游標停在密碼欄
}


/**
 * 密碼規則檢查（規格 §5.5）。
 * 後端 gas/Auth.js 的 validatePasswordRule() 是同一份規則，兩邊要一致。
 * 回傳的是 i18n 的錯誤鍵，通過就回傳空字串。
 */
function passwordRuleError(password) {
  if (password.length < 8)      return 'err.PASSWORD_TOO_SHORT';
  if (!/[A-Za-z]/.test(password)) return 'err.PASSWORD_NEEDS_LETTER';
  if (!/[0-9]/.test(password))    return 'err.PASSWORD_NEEDS_DIGIT';
  return '';
}


/** 真正送出重設請求 */
async function doResetPassword(account, password, errorBox, restoreBtn, closeDialog) {
  state.busy = account;
  hide(el.listError);

  try {
    const result = await Api.resetAdminPassword(AdminSession.token(), account, password);

    if (!result.ok) {
      // 錯誤留在對話框裡顯示，輸入的密碼不清掉，改一下就能再送一次。
      // 「這組已經有人在用」是最常見的情況，游標直接回到密碼欄
      show(errorBox, errorMessage(result));
      restoreBtn();
      const input = document.getElementById('newPw');
      if (input && !input.closest('.hidden')) input.focus();
      return;
    }

    state.password = {
      account:   result.data.account,
      password:  result.data.initial_password,
      mode:      'reset',
      generated: result.data.generated !== false,
    };

    closeDialog();
    await loadAdmins();

  } catch (err) {
    show(errorBox, t('err.NETWORK'));
    restoreBtn();
    return;

  } finally {
    state.busy = '';
    renderAll();
  }

  renderPasswordBox();
}


/**
 * 修改姓名。
 *
 * 只改顯示用的名字，不影響帳號、密碼、權限，所以不需要任何確認就能直接開表單。
 * 對方不會被登出——後端會把他 session 裡的姓名就地換掉。
 */
function renameAdmin(account) {
  const admin = findAdmin(account);
  if (!admin || state.busy) return;

  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <form class="pw-box pw-box-form" id="renameForm" novalidate>
      <h2 class="pw-title">${escapeHtml(t('accounts.renameTitle'))}</h2>
      <p class="pw-who">${escapeHtml(admin.account)}</p>

      <label class="filter-label" for="newName">${escapeHtml(t('accounts.renameLabel'))}</label>
      <input type="text" id="newName" autocomplete="off" value="${escapeHtml(admin.name || '')}">

      <label class="filter-label" for="newEmail" style="margin-top:12px;display:block;">
        ${escapeHtml(t('accounts.fEmail'))}
      </label>
      <input type="text" id="newEmail" autocomplete="off" spellcheck="false" inputmode="email"
             value="${escapeHtml(admin.email || '')}"
             placeholder="${escapeHtml(t('accounts.fEmailPh'))}">

      <p class="pw-next">${escapeHtml(t('accounts.renameHint'))}</p>

      <div id="renameError" class="result error hidden"></div>

      <div class="filter-actions">
        <button type="submit" class="btn-primary btn-inline" id="renameGo">
          ${escapeHtml(t('accounts.renameSave'))}
        </button>
        <button type="button" class="btn-secondary btn-inline" id="renameCancel">
          ${escapeHtml(t('accounts.cancel'))}
        </button>
      </div>
    </form>`;

  document.body.appendChild(overlay);
  document.body.classList.add('no-scroll');

  const input    = overlay.querySelector('#newName');
  const emailBox = overlay.querySelector('#newEmail');
  const errorBox = overlay.querySelector('#renameError');
  const goBtn    = overlay.querySelector('#renameGo');

  const close = function () {
    overlay.remove();
    document.body.classList.remove('no-scroll');
  };

  overlay.querySelector('#renameCancel').addEventListener('click', close);

  overlay.querySelector('#renameForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const name  = input.value.trim();
    const email = emailBox.value.trim();

    if (!name) { show(errorBox, t('err.ADMIN_NAME_REQUIRED')); input.focus(); return; }

    // 沒有變更就不送出，省掉一趟 3～8 秒的往返
    if (name === (admin.name || '') && email === (admin.email || '')) {
      show(errorBox, t('accounts.renameNoChange'));
      return;
    }

    goBtn.disabled = true;
    goBtn.textContent = t('accounts.renaming');
    hide(errorBox);
    state.busy = account;

    try {
      const result = await Api.setAdminProfile(AdminSession.token(), account, name, email);

      if (!result.ok) {
        show(errorBox, errorMessage(result));
        goBtn.disabled = false;
        goBtn.textContent = t('accounts.renameSave');
        if (result.error === 'ADMIN_EMAIL_INVALID') emailBox.focus();
        return;
      }

      setNote('accounts.renamed', name, false);
      close();
      await loadAdmins();

      // 改的如果是自己，資訊列的「你好，OOO」也要跟著換
      if (account === state.self) {
        AdminSession.patch({ name: name });
        if (state.profile) state.profile.name = name;
      }

    } catch (err) {
      show(errorBox, t('err.NETWORK'));
      goBtn.disabled = false;
      goBtn.textContent = t('accounts.renameSave');
      return;

    } finally {
      state.busy = '';
      renderAll();
    }
  });

  input.focus();
  input.select();
}


function findAdmin(account) {
  return state.admins.find(function (a) { return a.account === account; });
}


// ===== 畫面 =====

function renderAll() {
  renderTexts();
  renderList();
}


function renderTexts() {
  document.documentElement.lang = htmlLang();
  document.title = t('accounts.title') + ' · ' + t('appName');

  el.pageTitle.textContent = t('accounts.title');
  el.bootText.textContent  = t('admin.checking');
  el.logoutBtn.textContent = t('admin.logout');


  if (state.profile) {
    el.adminName.textContent = t('admin.hello')
      .replace('{name}', state.profile.name || state.profile.account);
    el.adminRole.textContent = adminRoleLabel(state.profile.role);
    renderAdminNav('accounts', state.profile);
  }

  el.countInfo.textContent = t('accounts.count').replace('{n}', state.admins.length);
  el.addBtn.textContent    = t('accounts.add');

  el.addFormTitle.textContent  = t('accounts.addTitle');
  el.labelName.textContent     = t('accounts.fName');
  el.labelAccount.textContent  = t('accounts.fAccount');
  el.labelEmail.textContent    = t('accounts.fEmail');
  el.labelRole.textContent     = t('accounts.fRole');
  el.fName.placeholder         = t('accounts.fNamePh');
  el.fAccount.placeholder      = t('accounts.fAccountPh');
  el.fEmail.placeholder        = t('accounts.fEmailPh');
  el.roleHint.textContent      = t('accounts.roleHint');

  el.labelInitPw.textContent     = t('accounts.fInitPw');
  el.newPwManual.textContent     = t('accounts.pwModeManual');
  el.newPwManualHint.textContent = t('accounts.pwModeManualHint');
  el.newPwAuto.textContent       = t('accounts.pwModeAuto');
  el.newPwAutoHint.textContent   = t('accounts.pwModeAutoHint');
  el.fPassword.placeholder       = t('accounts.pwInputPh');
  el.newPwShowLabel.textContent  = t('accounts.pwShow');
  el.cancelBtn.textContent     = t('accounts.cancel');
  if (!state.creating) el.createBtn.textContent = t('accounts.create');

  // 角色下拉的文字沿用登入資訊列的同一份翻譯，用詞才會一致
  el.fRole.options[0].textContent = adminRoleLabel('ADMIN');
  el.fRole.options[1].textContent = adminRoleLabel('SUPER');

  el.listLoadingText.textContent = t('accounts.loading');

  renderNote();          // 提示也要跟著換語言
  renderSystemFooter('siteFooter');

  document.querySelectorAll('.lang-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.lang === getLang());
  });
}


/**
 * 畫出管理者清單。
 *
 * 整個函式包在 try/catch 裡：後端欄位改名而前端還是舊版時
 * （GitHub Pages 會把 JS 快取 10 分鐘），寧可顯示一行錯誤訊息，
 * 也不要變成一片空白又不說為什麼。
 */
function renderList() {
  try {
    el.adminList.innerHTML = state.admins.map(renderRow).join('');
    bindRowButtons();
  } catch (err) {
    el.adminList.innerHTML = '';
    show(el.listError, t('err.UNKNOWN'));
  }
}


function renderRow(admin) {
  const isSelf     = admin.account === state.self;
  const isActive   = admin.status === 'ACTIVE';
  const isBusy     = state.busy === admin.account;

  // 只剩一位啟用中的超級管理者時，那一位不能停用——
  // 停掉就沒有人能進這一頁了。後端也會擋（ADMIN_LAST_SUPER），這裡只是先變灰
  const isLastSuper = isActive && admin.role === 'SUPER' && state.activeSuperCount <= 1;
  const lockDisable = isSelf || isLastSuper;

  const lockReason = isSelf ? t('accounts.selfHint')
                   : isLastSuper ? t('accounts.lastSuperHint') : '';

  const tags = [
    `<span class="tag tag-role-${admin.role === 'SUPER' ? 'super' : 'admin'}">${escapeHtml(adminRoleLabel(admin.role))}</span>`,
    `<span class="tag tag-status-${isActive ? 'active' : 'disabled'}">${escapeHtml(t('accounts.status.' + admin.status))}</span>`,
  ];
  if (isSelf) tags.push(`<span class="tag">${escapeHtml(t('accounts.you'))}</span>`);
  if (admin.must_change_password) {
    tags.push(`<span class="tag tag-warn">${escapeHtml(t('accounts.mustChangePw'))}</span>`);
  }

  const lastLogin = admin.last_login_at
    ? `${escapeHtml(t('accounts.lastLogin'))}: ${escapeHtml(admin.last_login_at)}`
    : escapeHtml(t('accounts.neverLoggedIn'));

  // 密碼最後變更時間。
  //
  // 這是「密碼到底能不能顯示出來」這個問題唯一給得出的答案——
  // 密碼本身存的是單向雜湊，連系統自己都讀不回來。
  // 能回答的是「這組密碼是什麼時候換的」，剛重設完就看得到剛剛的時間。
  //
  // 欄位是選填的：Sheet 還沒升級時後端回空字串，這一段就不顯示
  const pwChanged = admin.password_changed_at
    ? `${escapeHtml(t('accounts.pwChanged'))}: ${escapeHtml(admin.password_changed_at)}`
    : '';

  const email = admin.email
    ? escapeHtml(admin.email)
    : `<span class="muted">${escapeHtml(t('accounts.noEmail'))}</span>`;

  return `
    <div class="admin-row${isActive ? '' : ' admin-row-disabled'}">
      <div class="admin-row-main">
        <div class="admin-row-name">${escapeHtml(admin.name || admin.account)}</div>
        <div class="admin-row-account">${escapeHtml(admin.account)}</div>
        <div class="admin-row-tags">${tags.join('')}</div>
        <div class="admin-row-meta">
          <span>${email}</span>
          <span>${lastLogin}</span>
          ${pwChanged ? `<span>${pwChanged}</span>` : ''}
        </div>
      </div>
      <div class="admin-row-actions">
        <button type="button" class="btn-secondary btn-small js-rename"
                data-account="${escapeHtml(admin.account)}"
                ${isBusy ? 'disabled' : ''}>
          ${escapeHtml(isBusy ? t('accounts.working') : t('accounts.rename'))}
        </button>
        <button type="button" class="btn-secondary btn-small js-reset"
                data-account="${escapeHtml(admin.account)}"
                ${isBusy || isSelf ? 'disabled' : ''}
                ${isSelf ? `title="${escapeHtml(t('err.ADMIN_SELF_RESET'))}"` : ''}>
          ${escapeHtml(isBusy ? t('accounts.working') : t('accounts.resetPw'))}
        </button>
        <button type="button" class="btn-secondary btn-small js-status"
                data-account="${escapeHtml(admin.account)}"
                data-status="${isActive ? 'DISABLED' : 'ACTIVE'}"
                ${isBusy || (isActive && lockDisable) ? 'disabled' : ''}
                ${isActive && lockReason ? `title="${escapeHtml(lockReason)}"` : ''}>
          ${escapeHtml(isBusy ? t('accounts.working') : t(isActive ? 'accounts.disable' : 'accounts.enable'))}
        </button>
      </div>
    </div>`;
}


function bindRowButtons() {
  el.adminList.querySelectorAll('.js-status').forEach(function (btn) {
    btn.addEventListener('click', function () {
      changeStatus(btn.dataset.account, btn.dataset.status);
    });
  });
  el.adminList.querySelectorAll('.js-reset').forEach(function (btn) {
    btn.addEventListener('click', function () {
      resetPassword(btn.dataset.account);
    });
  });
  el.adminList.querySelectorAll('.js-rename').forEach(function (btn) {
    btn.addEventListener('click', function () {
      renameAdmin(btn.dataset.account);
    });
  });
}


/**
 * 一次性密碼的彈窗。
 *
 * ⚠️ 為什麼要用彈窗、而且要按按鈕才關得掉：
 *    這組密碼只會從後端回來這一次（Sheet 裡只存雜湊，查不回來）。
 *    塞在清單裡某一行的話，一個不小心捲過去就永遠找不回來了，
 *    只能再重設一次。所以刻意擋住整個畫面、逼使用者確認看過。
 */
function renderPasswordBox() {
  if (!state.password) return;

  const { account, password, mode, generated } = state.password;

  // 系統產生的密碼查不回來，關掉就沒了，要用比較強的措辭；
  // 自己輸入的那組本人知道，講「只出現這一次」反而是騙人的
  const warnText = generated ? t('accounts.pwWarn') : t('accounts.pwCustomNote');
  const warnClass = generated ? 'pw-warn' : 'pw-next';

  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="pw-box">
      <h2 class="pw-title">${escapeHtml(t('accounts.pwTitle'))}</h2>
      <p class="pw-who">${escapeHtml(
        t(mode === 'create' ? 'accounts.pwCreated' : 'accounts.pwReset').replace('{account}', account)
      )}</p>

      <div class="pw-value" id="pwValue">${escapeHtml(password)}</div>

      <button type="button" class="btn-secondary btn-inline" id="pwCopy">
        ${escapeHtml(t('accounts.pwCopy'))}
      </button>

      <p class="${warnClass}">${escapeHtml(warnText)}</p>
      ${generated ? `<p class="pw-next">${escapeHtml(t('accounts.pwNext'))}</p>` : ''}

      <button type="button" class="btn-primary" id="pwDone">
        ${escapeHtml(t('accounts.pwDone'))}
      </button>
    </div>`;

  document.body.appendChild(overlay);
  document.body.classList.add('no-scroll');

  overlay.querySelector('#pwCopy').addEventListener('click', function (e) {
    copyText(password, e.currentTarget);
  });

  overlay.querySelector('#pwDone').addEventListener('click', function () {
    state.password = null;
    overlay.remove();
    document.body.classList.remove('no-scroll');
  });
}


/**
 * 複製到剪貼簿。
 *
 * navigator.clipboard 在非 HTTPS 或舊瀏覽器上不存在，
 * 失敗就把文字選起來讓使用者自己按複製——不要留下一個按了沒反應的按鈕。
 */
function copyText(text, button) {
  const done = function () {
    button.textContent = t('accounts.pwCopied');
    setTimeout(function () { button.textContent = t('accounts.pwCopy'); }, 2000);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, selectFallback);
  } else {
    selectFallback();
  }

  function selectFallback() {
    const node = document.getElementById('pwValue');
    if (!node) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }
}


// ===== 新增表單的開合 =====

function openAddForm() {
  state.addOpen = true;
  el.addForm.classList.remove('hidden');
  el.addBtn.classList.add('hidden');
  hide(el.addError);
  el.fName.focus();
}

function closeAddForm() {
  state.addOpen = false;
  el.addForm.classList.add('hidden');
  el.addBtn.classList.remove('hidden');
  el.fName.value = '';
  el.fAccount.value = '';
  el.fEmail.value = '';
  el.fRole.value = 'ADMIN';
  el.fPassword.value = '';
  el.fPassword.type = 'password';        // 「顯示密碼」的狀態也要復原
  el.showNewPw.checked = false;
  document.querySelector('input[name="newPwMode"][value="manual"]').checked = true;
  el.newPwBox.classList.remove('hidden');
  hide(el.addError);
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

/** 動作完成的提示，8 秒後自動消失 */
function setNote(key, name, kicked) {
  state.note = { key: key, name: name, kicked: !!kicked };
  renderNote();

  if (noteTimer) clearTimeout(noteTimer);
  noteTimer = setTimeout(function () {
    state.note = null;
    hide(el.actionNote);
  }, 8000);
}

/** 依目前語言把提示畫出來（語言切換時會再跑一次） */
function renderNote() {
  if (!state.note) { hide(el.actionNote); return; }

  let message = t(state.note.key).replace('{name}', state.note.name);
  if (state.note.kicked) message += t('accounts.kicked');
  show(el.actionNote, message);
}


// ===== 事件 =====

el.logoutBtn.addEventListener('click', function () { adminLogout(); });
el.addBtn.addEventListener('click', openAddForm);
el.cancelBtn.addEventListener('click', closeAddForm);
el.addForm.addEventListener('submit', createAdmin);

document.querySelectorAll('input[name="newPwMode"]').forEach(function (radio) {
  radio.addEventListener('change', function () {
    const manual = radio.value === 'manual' && radio.checked;
    el.newPwBox.classList.toggle('hidden', !manual);
    hide(el.addError);
    if (manual) el.fPassword.focus();
  });
});

// 打錯字要等對方登不進去才會發現，給一個看一眼確認的開關
el.showNewPw.addEventListener('change', function (e) {
  el.fPassword.type = e.target.checked ? 'text' : 'password';
});

document.querySelectorAll('.lang-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    setLang(btn.dataset.lang);
    renderAll();
  });
});
