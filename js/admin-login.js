/**
 * 管理者登入頁
 *
 * 這一頁有兩個畫面，同一個檔案處理：
 *   1. 登入
 *   2. 變更密碼（第一次登入時強制出現）
 *
 * 為什麼放同一頁：首次登入必須立刻改密碼，
 * 如果拆成兩個網址，使用者按上一頁就能繞過去。
 */


// ===== 畫面元素 =====

const el = {
  bootView:    document.getElementById('bootView'),
  bootText:    document.getElementById('bootText'),

  loginView:   document.getElementById('loginView'),
  loginHint:   document.getElementById('loginHint'),
  account:     document.getElementById('account'),
  password:    document.getElementById('password'),
  loginBtn:    document.getElementById('loginBtn'),
  loginError:  document.getElementById('loginError'),
  labelAccount:  document.getElementById('labelAccount'),
  labelPassword: document.getElementById('labelPassword'),

  changeView:  document.getElementById('changeView'),
  changeTitle: document.getElementById('changeTitle'),
  changeHint:  document.getElementById('changeHint'),
  oldPassword: document.getElementById('oldPassword'),
  newPassword: document.getElementById('newPassword'),
  confirmPassword: document.getElementById('confirmPassword'),
  changeBtn:   document.getElementById('changeBtn'),
  changeError: document.getElementById('changeError'),
  cancelChangeBtn: document.getElementById('cancelChangeBtn'),
  labelOldPw:     document.getElementById('labelOldPw'),
  labelNewPw:     document.getElementById('labelNewPw'),
  labelConfirmPw: document.getElementById('labelConfirmPw'),
  pwRule:         document.getElementById('pwRule'),

  pageTitle:   document.getElementById('pageTitle'),
  siteFooter:  document.getElementById('siteFooter'),
};

/** 目前顯示哪個畫面：'boot' | 'login' | 'change' */
let currentView = 'boot';

/** 送出中的旗標，避免連按兩下送出兩次 */
let busy = false;


// ===== 進入頁面 =====

/**
 * 已經登入過的人不該再看到登入表單。
 *
 * 先顯示「確認中」再判斷，不要一開始就把登入表單畫出來——
 * 否則已登入的人會看到表單閃一下才跳走，像是被登出了。
 */
function boot() {
  const session = AdminSession.read();

  if (session && session.must_change_password) {
    showView('change');
  } else if (session) {
    location.replace('admin-cases.html');
  } else {
    showView('login');
  }
}


/** 切換畫面 */
function showView(view) {
  currentView = view;

  el.bootView.classList.toggle('hidden',   view !== 'boot');
  el.loginView.classList.toggle('hidden',  view !== 'login');
  el.changeView.classList.toggle('hidden', view !== 'change');

  render();

  // 自動聚焦到第一個要填的欄位，手機上會直接跳出鍵盤
  if (view === 'login')  el.account.focus();
  if (view === 'change') el.oldPassword.focus();
}


// ===== 登入 =====

el.loginView.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy) return;

  const account  = el.account.value.trim();
  const password = el.password.value;

  hideError(el.loginError);

  if (!account || !password) {
    showError(el.loginError, t('err.LOGIN_REQUIRED'));
    return;
  }

  setBusy(true, el.loginBtn, t('admin.loggingIn'));

  try {
    const result = await Api.adminLogin(account, password);

    if (!result.ok) {
      showError(el.loginError, loginErrorText(result));
      // 失敗時清空密碼但保留帳號——多半是密碼打錯，不必整組重打
      el.password.value = '';
      el.password.focus();
      return;
    }

    AdminSession.save(result.data);

    if (result.data.must_change_password) {
      // 初始密碼就是他剛剛輸入的那組，先幫他填好，少打一次
      el.oldPassword.value = password;
      showView('change');
      el.newPassword.focus();
    } else {
      location.href = 'admin-cases.html';
    }

  } catch (e) {
    showError(el.loginError, t('err.NETWORK'));
  } finally {
    setBusy(false, el.loginBtn, t('admin.loginBtn'));
  }
});


/**
 * 登入失敗的訊息。
 *
 * 後端會另外回傳「還剩幾次機會」，接在訊息後面，
 * 讓人知道自己離被鎖住還有多遠——而不是突然就被鎖了 15 分鐘。
 */
function loginErrorText(result) {
  let text = errorMessage(result);

  const left = result.data ? result.data.attempts_left : undefined;
  if (typeof left === 'number' && left > 0) {
    text += t('admin.attemptsLeft').replace('{n}', left);
  }
  return text;
}


// ===== 變更密碼 =====

el.changeView.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy) return;

  const oldPassword = el.oldPassword.value;
  const newPassword = el.newPassword.value;
  const confirm     = el.confirmPassword.value;

  hideError(el.changeError);

  if (!oldPassword || !newPassword) {
    showError(el.changeError, t('err.PASSWORD_REQUIRED'));
    return;
  }

  // 兩次輸入不一致，本機就擋掉，不必送到後端
  if (newPassword !== confirm) {
    showError(el.changeError, t('admin.pwMismatch'));
    el.confirmPassword.value = '';
    el.confirmPassword.focus();
    return;
  }

  setBusy(true, el.changeBtn, t('admin.changing'));

  try {
    const result = await Api.adminChangePassword(AdminSession.token(), oldPassword, newPassword);

    if (!result.ok) {
      showError(el.changeError, errorMessage(result));

      // token 失效就只能重登入了
      if (result.error === 'UNAUTHORIZED') {
        AdminSession.clear();
        setTimeout(() => showView('login'), 1500);
      }
      return;
    }

    AdminSession.patch({ must_change_password: false });
    location.href = 'admin-cases.html';

  } catch (e) {
    showError(el.changeError, t('err.NETWORK'));
  } finally {
    setBusy(false, el.changeBtn, t('admin.changeBtn'));
  }
});


// 改密碼畫面的「登出」：不想現在改就先離開，下次登入還是會被要求改
el.cancelChangeBtn.addEventListener('click', () => {
  adminLogout();
});


// ===== 共用小工具 =====

function setBusy(value, button, text) {
  busy = value;
  button.disabled = value;
  button.textContent = text;
}

function showError(box, message) {
  box.textContent = message;
  box.classList.remove('hidden');
}

function hideError(box) {
  box.textContent = '';
  box.classList.add('hidden');
}


// ===== 依語言重畫文字 =====

function render() {
  document.documentElement.lang = htmlLang();
  document.title = t('admin.login.title') + ' · ' + t('appName');

  el.pageTitle.textContent = currentView === 'change'
    ? t('admin.changePw.title')
    : t('admin.login.title');

  el.bootText.textContent = t('admin.checking');

  // 登入
  el.loginHint.textContent     = t('admin.login.hint');
  el.labelAccount.textContent  = t('admin.account');
  el.labelPassword.textContent = t('admin.password');
  el.account.placeholder       = t('admin.accountPh');
  el.password.placeholder      = t('admin.passwordPh');
  if (!busy) el.loginBtn.textContent = t('admin.loginBtn');

  // 變更密碼
  el.changeTitle.textContent     = t('admin.changePw.title');
  el.changeHint.textContent      = t('admin.changePw.force');
  el.labelOldPw.textContent      = t('admin.oldPassword');
  el.labelNewPw.textContent      = t('admin.newPassword');
  el.labelConfirmPw.textContent  = t('admin.confirmPw');
  el.pwRule.textContent          = t('admin.pwRule');
  el.cancelChangeBtn.textContent = t('admin.logout');
  if (!busy) el.changeBtn.textContent = t('admin.changeBtn');

  renderSystemFooter('siteFooter');

  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === getLang());
  });
}


document.querySelectorAll('.lang-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    setLang(btn.dataset.lang);
    render();
  });
});


boot();
