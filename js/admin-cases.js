/**
 * 管理者案件列表頁
 *
 * 目前只做到「確認登入狀態並顯示登入者」，
 * 案件列表本體是關卡 3-3 的工作，會接在 renderCases() 裡。
 *
 * 這一頁存在的意義是驗證整條路徑真的通了：
 * 登入 → 拿到 token → 用 token 打到一支需要授權的 API → 讀得到資料。
 */

const view = {
  loading:     document.getElementById('loadingView'),
  loadingText: document.getElementById('loadingText'),
  error:       document.getElementById('errorView'),
  main:        document.getElementById('mainView'),
  placeholder: document.getElementById('placeholder'),

  adminBar:  document.getElementById('adminBar'),
  adminName: document.getElementById('adminName'),
  adminRole: document.getElementById('adminRole'),
  logoutBtn: document.getElementById('logoutBtn'),

  pageTitle: document.getElementById('pageTitle'),
};

/** 目前登入者的資料（通過驗證後才會有值） */
let profile = null;


/**
 * 進入頁面：先確認 token 還有效，通過才把內容畫出來。
 * 沒通過的話 requireAdmin() 已經在導回登入頁，這裡直接結束。
 */
async function boot() {
  try {
    profile = await requireAdmin();
    if (!profile) return;   // 正在導回登入頁

    view.loading.classList.add('hidden');
    view.adminBar.classList.remove('hidden');
    view.main.classList.remove('hidden');
    render();

  } catch (e) {
    // 網路問題：留在這一頁顯示錯誤，不要把人踢回登入頁
    // （重新登入一樣會失敗，只是多繞一圈）
    view.loading.classList.add('hidden');
    view.error.textContent = e.message || t('err.NETWORK');
    view.error.classList.remove('hidden');
  }
}


view.logoutBtn.addEventListener('click', () => {
  adminLogout();
});


/** 依目前語言重畫文字 */
function render() {
  document.documentElement.lang = htmlLang();
  document.title = t('admin.cases.title') + ' · ' + t('appName');

  view.pageTitle.textContent   = t('admin.cases.title');
  view.loadingText.textContent = t('admin.checking');
  view.logoutBtn.textContent   = t('admin.logout');

  if (profile) {
    view.adminName.textContent = t('admin.hello').replace('{name}', profile.name || profile.account);
    view.adminRole.textContent = adminRoleLabel(profile.role);
  }

  // 關卡 3-3 會把這段換成真正的案件列表
  view.placeholder.textContent = t('admin.cases.soon');

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
