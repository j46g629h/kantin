# CLAUDE.md — 給 AI 助手的專案說明

> 這個檔案讓 Claude 在**任何一台電腦、任何一個新對話**都能立刻理解這個專案。
> 有重要決策或新的踩坑紀錄時，請更新這份文件。

---

## 使用者背景（很重要）

**這位使用者是第一次寫程式。** 請據此調整回答方式：

- 每個步驟都要具體：講清楚「在哪裡點」「按哪個按鈕」，不要只說「部署一下」
- 檔案路徑要完整，並說明是從專案根目錄算起
- 專有名詞第一次出現要解釋
- 每個階段都要有明確的「驗收方式」，讓他知道自己做對了沒有
- 先做出能跑的東西，再逐步加功能——不要一次丟太多概念
- 回覆使用**繁體中文**

---

## 專案概述

PCI adidas 工廠的**員工餐廳問題回報系統**。

- 員工掃 QR Code → 手機回報餐廳問題（含照片、評分）
- 管理者登入網頁 → 追蹤、回覆、結案
- 資料存 Google Sheet，每日 / 每月自動寄報表

| 項目 | 內容 |
|---|---|
| 員工人數 | 約 11,000 人 |
| 預估回報量 | 每月 50 筆以內 |
| 管理者 | 超級管理者 1 位（使用者本人）+ 一般管理者約 5 位 |
| 語言 | 印尼文 / 中文可切換 |
| 成本 | 零（全部使用免費服務） |

---

## 技術架構

```
GitHub Pages（前端）→ Google Apps Script（後端）→ Google Sheet / Drive（資料）
```

| 層級 | 技術 | 位置 |
|---|---|---|
| 前端 | 原生 HTML / CSS / JavaScript（不用框架） | **專案根目錄**（`index.html`、`css/`、`js/`） |
| 後端 | Google Apps Script | `gas/`（線上編輯器的備份） |
| 資料 | Google Sheet + Google Drive | 雲端 |

**頁面一覽**

| 檔案 | 給誰用 | 內容 |
|---|---|---|
| `index.html` | 員工 | 首頁，兩個入口 + 頁尾的管理者登入小連結 |
| `report.html` | 員工 | 回報表單 |
| `query.html` | 員工 | 查詢案件進度 |
| `admin.html` | 管理者 | 登入 + 強制變更初始密碼（同一頁，避免按上一頁繞過） |
| `admin-cases.html` | 管理者 | 案件列表、案件回覆與結案 |
| `admin-accounts.html` | 超級管理者 | 帳號管理（新增 / 停用 / 重設密碼）|

**Sheet 分頁**：`回報資料`、`員工名冊`、`管理者名單`、`選項設定`、`回覆範本`、`系統計數`、`錯誤日誌`

**後端檔案**：`Config`（常數）/ `Utils`（共用）/ `Store`（附有效期的鍵值儲存）/ `Main`（路由）/ `Auth`（登入與權限）/
`Options` / `Employee` / `Feedback` / `Image` / `Query`（員工端查詢）/ `Cases`（管理端案件）/
`Admins`（帳號管理，僅 SUPER）/ `Notify`（寄信共用）/ `Reports`（排程報表）/
`Triggers`（排程安裝與移除）/ `Setup`（一次性腳本與維運工具）

⚠️ **前端檔案必須放在專案根目錄，不可移到子資料夾。**
GitHub Pages 只允許 `/(root)` 或 `/docs` 兩種發布來源，而 `docs/` 已用於存放規格書。
根目錄的 `.nojekyll` 檔案不可刪除（用來關閉 Jekyll 處理）。

**不要引入 React / Vue / 打包工具。** 使用者是初學者，維持原生、零建置流程是刻意的決定。

---

## 重要文件

| 檔案 | 內容 |
|---|---|
| `docs/規格書_v2.md` | **目前依據的規格**，所有設計決策的來源 |
| `docs/規格書_v1.md` | 初版，僅供對照，不要參考 |
| `docs/部署筆記.md` | 所有網址、ID、部署步驟、踩坑紀錄 |
| `docs/開發進度.md` | 目前做到哪裡 |

---

## 必須遵守的設計約定

### 1. 資料庫存「代碼」，不存「顯示文字」

Sheet 裡存 `LOC_02`、`CAT_HYGIENE`、`ST_NEW`，中文 / 印尼文的顯示文字由前端依語言渲染。
若直接存顯示文字，同一筆資料會因語言不同出現兩種寫法，統計會壞掉。

### 2. CORS：一定要用 `text/plain`

Apps Script **不支援 `doOptions`**。前端 `fetch` 必須：

- `Content-Type: 'text/plain;charset=utf-8'`（不可用 `application/json`）
- 不加任何自訂 header（token 放 body，不放 header）

改成別的寫法會直接被瀏覽器擋掉。

### 3. 一律用 `case_id` 查找，不可用列號

有人在 Sheet 手動插入 / 刪除列，所有列號就全錯了。

### 4. 不刪資料，改用軟刪除

刪列會讓列號位移。改標記 `is_deleted`。

### 5. 改前端檔案後，一定要更新資源版本號

**六個 HTML 檔**（`index.html` / `report.html` / `query.html` /
`admin.html` / `admin-cases.html` / `admin-accounts.html`）
引用 CSS 與 JS 時都帶 `?v=2.2`。

**為什麼一定要有：** GitHub Pages 的 `Cache-Control: max-age=600`，
使用者的瀏覽器會把 JS 快取 10 分鐘。若後端已更新而前端還是舊的，
畫面會用「錯誤的方式」壞掉——曾經因為 API 欄位改名，
使用者點下去整個清單消失且不顯示任何訊息。

**改法：** 六個 HTML 檔一起把 `?v=` 後面的數字往上加，
並同步改 `js/config.js` 的 `SYSTEM_INFO.version`（漏改的話頁尾顯示的版本會對不上）。

```bash
# 例如從 2.2 改成 2.3
sed -i 's/?v=2\.2/?v=2.3/g' index.html report.html query.html admin.html admin-cases.html admin-accounts.html
```

改完用這行確認沒有漏掉：`grep -rn "v=2\.2" *.html`（應該一筆都查不到）

搭配另一個原則：**前端讀取 API 回傳值時要防禦性存取**（`item.images || []`），
且渲染函式要有 try/catch，這樣即使版本不一致也只是少顯示一段，
不會整頁空白又沒有訊息。


### 6. API 網址只寫在 `js/config.js`

其他檔案一律引用它，不可寫死。

### 7. 選項清單讀 Sheet，不可寫死

餐廳地點、問題分類、**處理者名單**都從 `選項設定` 分頁讀取，讓管理者自己就能新增。

⚠️ **「處理者」和「管理者」是兩份不會互相同步的名單，不要搞混：**

- **管理者名單** = 使用這個 app 的人（登入、回覆、結案），需要帳號密碼
- **選項設定的 `HANDLER`** = **現場實際派工的人員**（廚房主管、清潔組長、維修人員），
  **他們不會碰到這個 app**，只是被記錄為某件案子的負責人，所以不需要帳號

新增管理者不會自動變成可指派的處理者，反之亦然。這是刻意的設計。

### 8. 管理端 API 一律用 `withAuth()` 包起來

需要登入的 API 不要各自寫一次「檢查 token」——總有一支會忘記。
在 `gas/Main.js` 的路由表統一包：

```js
updateCase: function (p) { return withAuth(p, function (s) { return updateCase(p, s); }); },
// 只有 SUPER 能做的加第三個參數 true：
manageAdmin: function (p) { return withAuth(p, function (s) { return manageAdmin(p, s); }, true); },
```

### 9. token 放 POST body，且管理端一律用 POST

放網址會留在瀏覽器歷史與伺服器日誌；放 header 會觸發 CORS 預檢，
而 Apps Script 不支援 `doOptions`（見約定第 2 條）。所以只剩 body 這條路。
**就算只是讀資料，管理端也用 POST。**

前端 token 存 `sessionStorage`（不是 `localStorage`）：關掉分頁就失效，
共用電腦上處理完直接關視窗，下一個人打不開。

### 10. 任何密碼都不可以寫進程式碼

`gas/` 會跟著 git 上傳到 GitHub，寫在裡面就等於公開貼在網路上。
建立帳號時由 `generateInitialPassword()` 隨機產生，印在 Apps Script 的「執行紀錄」上，
登入後強制使用者改掉。

### 11. 寫進 Sheet 的字串欄一律「先設格式，再寫值」

用 `writeRowByColumns()` 或 `setTextCell()`（都在 `gas/Utils.js` / `gas/Auth.js`）。
直接 `setValue()` 的話 Sheet 會自作主張判斷型別：
工號 `0012345` 變 `12345`，64 位十六進位的密碼雜湊若剛好整串是數字會變成科學記號，
那個帳號從此永遠登不進去。

### 12. 改欄位定義＝改資料結構，順序不可顛倒

`XXX_COLUMNS`（`gas/Config.js`）就是資料結構的定義。
加一個欄位進去之後，`buildColumnMap()` 在 Sheet 找不到該欄位就會**丟出例外**，
所有讀那張表的功能會一起壞掉。

**兩種安全作法，選一種：**

**A. 先升級 Sheet，再部署程式。** 反過來做的話，
從部署到使用者跑完升級程式的這段時間，功能是全壞的。

**B. 把新欄位標成 `optional: true`（推薦）。**
這樣順序就不重要了——程式可以先部署（該功能暫時不顯示），
使用者跑完升級才開始生效，中間完全沒有壞掉的空窗期。

```js
{ code: 'password_changed_at', name: '密碼最後變更時間', width: 140,
  format: 'yyyy-mm-dd hh:mm:ss', optional: true },
```

`buildColumnMap()` 遇到標了 optional 又找不到的欄位會直接跳過，不丟例外。
**代價是呼叫端一定要自己檢查**，因為那個欄號會是 `undefined`：

```js
if (colMap.password_changed_at) {
  setDateCell(sheet, row, colMap.password_changed_at, new Date());
}
```

漏了這個檢查的話，`getRange(row, undefined)` 會炸掉——
等於把問題從「部署當下全壞」搬到「某個功能被用到時才壞」，那更難查。

**這個洞真的踩過一次。** `writeRowByColumns()` 當初沒檢查，
結果「新增管理者」在使用者跑升級程式之前整支壞掉——
而 `optional` 本來就是為了消滅這種空窗期，等於白做。已修正。

而且本機測試一路綠燈：假 Sheet 對 `getRange(row, undefined)` 默默接受
（陣列索引 `[NaN]` 不報錯）。**假的服務對錯誤輸入太寬容，測試就成了裝飾品。**
`tools/test-admin-api.js` 的假 Sheet 已改成欄號不合法就丟例外。

實際踩過：把「電話」加進 `ADMIN_COLUMNS` 後直接部署，
結果超級管理者完全無法登入，只看到「系統出了問題」。

寫入也要小心：一律用 `writeRowByColumns()`，它會依表頭定位。
自己照順序從第 1 欄寫到第 N 欄的話，Sheet 上多一欄就會整批錯位寫進隔壁，而且不會報錯。

### 13. 不要用 `CacheService`，改用 `gas/Store.js`

**這個專案的 `CacheService` 完全沒有作用。** 實測：`put()` 不丟任何錯誤，
但 `get()` 永遠回傳 null——連同一次請求內寫完立刻讀都讀不到。
`PropertiesService` 在同一個環境下完全正常。

**為什麼很難發現：** 快取失效通常只是「變慢」，功能照樣對。
所以選項快取、員工快取壞了兩個月都沒人察覺。
直到 token 也存在那裡，才變成「登入成功但下一個請求就未授權」——
使用者看到的是「輸入密碼後又跳回登入畫面」，而錯誤日誌裡一片空白。

`gas/Store.js` 是建在 `PropertiesService` 上的替代品，附有效期：

```js
storePut(key, value, ttlSeconds);   // value 要是字串
storeGet(key);                      // 不存在或過期都回 null
storeRemove(key);
storeSweepExpired();                // Properties 沒有自動過期，登入時順手掃
```

驗證方式：`node tools/test-store.js`

### 14. 改動帳號之後，一定要把對方的 token 作廢

`withAuth()` 只讀 token 裡的 session **快照**，不會回頭查 Sheet。
所以把某人停用之後，他手上那支 token 在效期內（6 小時）**照樣能改案件、能結案**——
「停用」等於沒有生效。把 SUPER 降成 ADMIN 也一樣，他那個分頁裡的角色還是舊的。

停用 / 改角色 / 重設密碼三個動作，都要呼叫 `revokeSessionsForAccount(account)`
（在 `gas/Auth.js`）。它靠 `storeEntries()` 把該帳號的所有 token 找出來刪掉。

> 這件事做得到，正是因為 token 改存在 `PropertiesService` 而不是 `CacheService`
> （見第 13 條）——存進去的東西是真的列得出來、刪得掉的。

**為什麼不改成「每次請求都回查 Sheet」：** 那樣每支 API 都要多讀一次管理者名單，
Apps Script 本來就慢（每次回應 3～8 秒），不值得為了一年用不到幾次的情況天天付這個成本。

### 15. 密碼查不回來，這不是權限問題

有人會問「能不能讓超級管理者看到每個帳號目前的密碼」。**做不到，而且不該做。**

Sheet 存的是加鹽 + SHA-256 迭代 1000 次的結果，這個運算單向不可逆——
不是系統不給看，是連系統自己都算不回去。

要能顯示，唯一辦法是改存明文，那代價是：任何拿到這份 Sheet 的人
（帳號被盜、誤設分享、Google 端備份）就直接拿到全部管理者的密碼。

**能給的替代資訊：**

| 想知道什麼 | 給什麼 |
|---|---|
| 我剛剛的重設有沒有生效 | 「密碼最後變更時間」欄位 |
| 這個人還在用別人幫他設的密碼嗎 | `需重設密碼 = TRUE`，列表上顯示「待本人自行設定密碼」 |
| 我忘記幫他設的密碼是什麼 | 查不回來，重設一次就好（三個點擊） |

⚠️ 「待本人自行設定密碼」這個標籤在「超級管理者剛幫他重設完」時**本來就該出現**，
那不是 bug。它的意思是「這組密碼是別人設的，他還沒換成只有自己知道的」。

### 16. 帳號管理的三條安全規則

`gas/Admins.js` 的 `guardLastActiveSuper()` 擋掉這三件事，前端也把對應的按鈕變灰：

| 擋什麼 | 為什麼 |
|---|---|
| 停用 / 降級自己 | 手滑就把自己關在門外 |
| 停用 / 降級**最後一位啟用中的 SUPER** | 系統會變成沒有人進得去帳號管理頁，只能回 Apps Script 編輯器手動救 |
| 重設自己的密碼 | 等於把自己的密碼換成一組隨機字串然後被登出，沒有任何好處。要改自己的密碼走「變更密碼」 |

前端把按鈕變灰只是體驗（還附上 tooltip 說明原因），**真正的把關在後端**——
`manageAdmin` 被 `withAuth(p, handler, true)` 包住，非 SUPER 一律回 `FORBIDDEN`。

**重設密碼時的「不可與他人重複」檢查，錯誤訊息絕不可以說是「誰」在用。**
`findPasswordClash()` 只回傳有 / 沒有。說了是誰的話，超級管理者就能拿這支 API
當試探器，一組一組猜出某個特定帳號的密碼。
（比對方式是拿輸入的密碼、用每個人各自的鹽值分別重算一次雜湊——
Sheet 裡只存雜湊，沒有任何地方存得回明文。）

另外，`adminOpList()` 回傳前一定要經過 `toSafeAdmin()`。
`readAllAdmins()` 讀的是整列，裡面就有 `password_hash` 與 `password_salt`，
直接回傳等於把整份密碼資料送到瀏覽器上。`toSafeAdmin()` 採白名單寫法，
日後 `ADMIN_COLUMNS` 加了新欄位也不會不小心跟著漏出去。

---

## 常見陷阱

| 陷阱 | 說明 |
|---|---|
| 新增會用到新服務的功能（寄信、Drive、觸發器） | **第一次執行一定會失敗一次。** Apps Script 靠掃描程式碼推算需要哪些權限，剛推上新程式碼時它可能還在用舊的權限清單，於是「授權畫面按過了，功能照樣被擋」。再執行一次就好——第二次的授權畫面才會包含新權限。寫這類功能時，要把授權錯誤跟一般失敗分開報告（見 `gas/Notify.js` 的 `isAuthorizationError`），否則使用者只看到「失敗 N 次」，完全猜不到該做什麼 |
| Apps Script 重新部署 | 必須用「管理部署作業 → 鉛筆 → 版本選『新增版本』」。按「新增部署作業」會產生新網址，前端就斷了 |
| 時區 | Apps Script 專案時區必須是 `Asia/Jakarta`（已設定完成） |
| 工號前導零 | 名冊貼進 Sheet 前，工號欄必須先設為「純文字」格式，否則 `0012345` 會變成 `12345` |
| 部署權限 | 「誰可以存取」必須選**所有人**，不是「所有 Google 帳號使用者」（員工不會登入 Google） |
| 員工名冊個資 | `.gitignore` 已排除 `*.csv` / `*.xlsx`，**絕不可上傳 GitHub** |

---

## 開發環境

### 前端預覽

```bash
node tools/dev-server.js
# → http://localhost:5500
```

### 後端同步（clasp）

後端程式碼放在 `gas/`，用 clasp 直接推到 Apps Script，**不要用複製貼上**。

```bash
clasp.cmd push -f                          # 推送程式碼
clasp.cmd redeploy <deploymentId> -d "說明"  # 更新部署（網址不變）
clasp.cmd pull                             # 從線上拉回（很少用）
```

⚠️ **Windows PowerShell 上要用 `clasp.cmd`**，直接打 `clasp` 會被執行原則擋掉
（PowerShell 會優先選 `clasp.ps1`，而未簽章的 `.ps1` 被禁止執行）。macOS 上直接用 `clasp`。

哪些指令要加 `.cmd`：

| 指令 | PowerShell 實際執行 | 加 `.cmd`？ |
|---|---|---|
| `git` / `node` | `.exe` | 不用 |
| `npm` / `clasp` | `.ps1` | **要加** |

規則：**透過 npm 安裝的工具要加 `.cmd`。** 不確定時用 `Get-Command <指令>` 查，
結尾是 `.ps1` 就要加。

正式部署 ID 記錄在 `docs/部署筆記.md`。`redeploy` 會沿用同一組 ID，網址不會變。

### 後端邏輯的本機測試

```bash
node tools/test-cases-api.js   # 管理端案件 API（篩選 / 排序 / 統計 / 逾期 / 回覆 / 指派）
node tools/test-store.js       # 附有效期的鍵值儲存
node tools/test-admin-api.js   # 帳號管理 API（權限 / 新增 / 停用 / 重設密碼 / token 作廢）
node tools/test-report-api.js  # 排程報表（收件人 / 日報內容 / 空信規則 / 寄信失敗）
```

⚠️ 測試檔裡**不要寫死絕對路徑**（用 `path.join(__dirname, '..')`）。
寫死 `D:/Claude/KANTIN` 的話，在 macOS 那台會直接爆掉。

用假的 Apps Script 服務（`SpreadsheetApp` / `Utilities` / `Session`）在 Node 裡跑 `getCaseList`，
不必部署、不必登入就能驗證篩選、排序、統計、逾期判斷。改到 `gas/Cases.js` 就順手跑一次。

⚠️ 假資料裡的 `Date` 必須在 sandbox **裡面**建立。在外面建立的話，
sandbox 裡的 `x instanceof Date` 會是 false（跨 realm 的建構子不同），
程式會誤判提交時間不是日期。這是測試環境的限制，真實 Apps Script 沒這問題。

### 修改後端的標準流程

1. 改 `gas/` 底下的檔案
2. 串接檢查（模擬 Apps Script 共用全域範圍，可抓出重複宣告）：

   ```bash
   cat gas/*.js > /tmp/all.js && node --check /tmp/all.js
   ```

   ⚠️ 不要寫成 `cat gas/Config.js gas/Utils.js gas/Main.js gas/*.js`——
   `gas/*.js` 已經包含前面那三個檔案，串兩次必然報
   `SyntaxError: Identifier 'SHEET_ID' has already been declared`，
   看起來像程式有錯，其實是指令本身的問題。

   `node --check` 抓得到重複的 `const`，**但抓不到重複的 `function`**
   （重複的函式宣告在 JS 裡是合法的，後面那個會無聲蓋掉前面那個）。
   新增函式時順手跑這行確認沒撞名：

   ```bash
   grep -oh "^function [a-zA-Z0-9_]*" gas/*.js | sort | uniq -d
   ```
3. `clasp.cmd push -f`
4. `clasp.cmd redeploy <deploymentId> -d "說明"`
5. 用 curl 打 API 驗證

### 跨電腦

Windows 公司電腦 ↔ macOS 私人電腦，透過 GitHub 同步。
`.gitattributes` 已設定換行字元正規化。
換電腦後 clasp 需要重新 `clasp login`（憑證存在使用者家目錄，不在專案裡）。

---

## 開發原則

**先打通一條最小可行路徑，再擴充功能。**

不要一次做完所有分頁和 API 再測試。每個階段都要做到「可以實際使用」再進下一階段。
