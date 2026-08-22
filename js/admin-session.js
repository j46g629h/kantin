/**
 * 管理端的登入狀態管理
 *
 * 每一個管理端頁面都會用到，所以抽出來共用。
 *
 * ⚠️ token 存在 sessionStorage 而不是 localStorage：
 *    sessionStorage 在「關掉分頁」時就會清空，
 *    管理者用共用電腦處理完案件直接關掉視窗，下一個人打開就進不去了。
 *    localStorage 則會一直留著，等於把門開著。
 */

const ADMIN_SESSION_KEY = 'kantin_admin_session';


const AdminSession = {

  /** 存入登入結果 */
  save(data) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({
      token:                data.token,
      account:              data.account,
      name:                 data.name,
      role:                 data.role,
      must_change_password: !!data.must_change_password,
    }));
  },

  /** 讀出目前的登入資訊，沒登入回傳 null */
  read() {
    try {
      const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      return (parsed && parsed.token) ? parsed : null;
    } catch (e) {
      return null;   // 壞掉就當作沒登入
    }
  },

  /** 取得 token（沒登入回傳空字串） */
  token() {
    const session = this.read();
    return session ? session.token : '';
  },

  /** 只更新其中幾個欄位（例如改完密碼後把 must_change_password 關掉） */
  patch(changes) {
    const session = this.read();
    if (!session) return;
    this.save(Object.assign(session, changes));
  },

  /** 清掉本機的登入資訊 */
  clear() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
  },

  /** 是否為超級管理者 */
  isSuper() {
    const session = this.read();
    return !!session && session.role === 'SUPER';
  },

};


/**
 * 登出：先通知後端讓 token 失效，再清掉本機資料並回登入頁。
 *
 * 後端呼叫失敗也照樣登出——不能因為網路不通就把人卡在登入狀態裡。
 */
async function adminLogout() {
  const token = AdminSession.token();
  try {
    if (token) await Api.adminLogout(token);
  } catch (e) {
    // 後端沒收到沒關係，token 6 小時後本來就會過期
  }
  AdminSession.clear();
  location.href = 'admin.html';
}


/**
 * 管理端頁面的入口守衛。
 *
 * 每個需要登入的頁面第一件事就是呼叫它：
 *   - 沒有 token → 回登入頁
 *   - token 過期 → 回登入頁
 *   - 還沒改過初始密碼 → 回登入頁（那裡會顯示改密碼畫面）
 *
 * ⚠️ 這只是「體驗上的導引」，不是安全機制。
 *    真正的把關在後端的 withAuth()——前端程式碼是公開的，
 *    有人把這段刪掉照樣打不到資料。
 *
 * @return {Object|null} 通過就回傳 profile，未通過回傳 null（此時已在導頁）
 */
async function requireAdmin() {
  const session = AdminSession.read();

  if (!session) {
    location.replace('admin.html');
    return null;
  }

  let result;
  try {
    result = await Api.getAdminProfile(session.token);
  } catch (e) {
    // 網路不通時不要把人踢出去，否則他重新登入也一樣會失敗
    throw new Error(t('err.NETWORK'));
  }

  if (!result.ok) {
    AdminSession.clear();
    location.replace('admin.html');
    return null;
  }

  // 以後端回傳的為準：角色可能在登入之後被超級管理者調整過
  AdminSession.save(Object.assign({ token: session.token }, result.data));

  if (result.data.must_change_password) {
    location.replace('admin.html');
    return null;
  }

  return result.data;
}


/** 依角色代碼取得顯示名稱 */
function adminRoleLabel(role) {
  return t('admin.role.' + (role === 'SUPER' ? 'SUPER' : 'ADMIN'));
}


// ===== 管理端的頁籤導覽 =====

/**
 * 管理端有哪些頁面。
 *
 * 三個管理頁共用這一份清單，所以「哪些頁面存在」「誰看得到」只定義一次。
 * 日後多一個管理頁就在這裡加一筆，三頁的導覽列會自動跟著多一個頁籤。
 *
 * ⚠️ `superOnly` 只是「不顯示」，不是權限控制。
 *    真正的把關在後端（withAuth 的第三個參數）與各頁的入口守衛——
 *    前端程式碼在 GitHub 上是公開的，把這個欄位改掉照樣打不到資料。
 */
const ADMIN_PAGES = [
  { key: 'cases',     href: 'admin-cases.html',     labelKey: 'admin.cases.title', superOnly: false },
  { key: 'dashboard', href: 'admin-dashboard.html', labelKey: 'dash.entry',        superOnly: true  },
  { key: 'accounts',  href: 'admin-accounts.html',  labelKey: 'accounts.entry',    superOnly: true  },
];


/**
 * 畫出頁籤導覽列。
 *
 * 之前這三個入口是擠在資訊列右邊的幾個小連結，有兩個問題：
 * 位置不夠放（再多一個功能就爆了），而且看不出「我現在在哪一頁」。
 *
 * 切換語言後要重新呼叫一次，頁籤文字才會跟著換。
 *
 * @param {string} currentKey 目前這一頁的 key
 * @param {Object} profile    requireAdmin() 回傳的登入者資料
 */
function renderAdminNav(currentKey, profile) {
  const nav = document.getElementById('adminNav');
  if (!nav || !profile) return;

  const isSuper = !!profile.is_super;

  nav.innerHTML = ADMIN_PAGES
    .filter(function (page) { return !page.superOnly || isSuper; })
    .map(function (page) {
      const active = page.key === currentKey;

      // 目前這一頁不做成連結：點自己沒有意義，而且會讓人以為沒反應
      if (active) {
        return `<span class="admin-nav-tab active" aria-current="page">${escapeHtml(t(page.labelKey))}</span>`;
      }
      return `<a href="${page.href}" class="admin-nav-tab">${escapeHtml(t(page.labelKey))}</a>`;
    }).join('');
}
