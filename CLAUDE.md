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
| `admin-dashboard.html` | 超級管理者 | 動態表（月份 / 年度統計，可切換語言）|

**Sheet 分頁**：`回報資料`、`員工名冊`、`管理者名單`、`選項設定`、`回覆範本`、`系統計數`、`錯誤日誌`

**後端檔案**：`Config`（常數）/ `Utils`（共用）/ `Store`（附有效期的鍵值儲存）/ `Main`（路由）/ `Auth`（登入與權限）/
`Options` / `Employee` / `Feedback` / `Image` / `Query`（員工端查詢）/ `Cases`（管理端案件）/
`Admins`（帳號管理，僅 SUPER）/ `Notify`（寄信共用）/ `Reports`（排程報表）/
`Triggers`（排程安裝與移除）/ `Stats`（Dashboard 統計與月報統計）/
`Backup`（每月備份 Sheet）/ `Retention`（滿 13 個月去識別化）/
`Setup`（一次性腳本與維運工具）

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

**七個 HTML 檔**（`index.html` / `report.html` / `query.html` /
`admin.html` / `admin-cases.html` / `admin-accounts.html` / `admin-dashboard.html`）
引用 CSS 與 JS 時都帶 `?v=2.7`。

**為什麼一定要有：** GitHub Pages 的 `Cache-Control: max-age=600`，
使用者的瀏覽器會把 JS 快取 10 分鐘。若後端已更新而前端還是舊的，
畫面會用「錯誤的方式」壞掉——曾經因為 API 欄位改名，
使用者點下去整個清單消失且不顯示任何訊息。

**改法：** 七個 HTML 檔一起把 `?v=` 後面的數字往上加，
並同步改**另外兩個地方**的版本號：

| 地方 | 漏改的後果 |
|---|---|
| `js/config.js` 的 `SYSTEM_INFO.version` | app 頁尾顯示的版本與實際載入的資源對不上 |
| `gas/Config.js` 的 `SYSTEM_INFO.version` | **信件頁尾印出錯的版本號**——有人拿著它來回報問題，你會去查錯的那一版 |

⚠️ 後端也要一份，是因為信是 Apps Script 產生的，而它讀不到 GitHub Pages 上的前端檔案。
「複製一份」必然會走鐘，所以有一支測試專門盯著（見下方）。

```bash
# 例如從 2.7 改成 2.8
sed -i 's/?v=2\.7/?v=2.8/g' index.html report.html query.html admin.html admin-cases.html admin-accounts.html admin-dashboard.html
```

改完**一定要跑這一支**，九個地方有任何一個沒對上都會紅：

```bash
node tools/test-version-sync.js
```

（它同時檢查：七個 HTML 的 `?v=` 是否一致、同一檔案內有沒有兩種版本號、
`js/config.js` 與 `gas/Config.js` 的 `SYSTEM_INFO` 是否完全相同、
以及前端頁尾顯示的版本是否就是 HTML 實際載入的那一版。）

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

### 17. 會破壞資料的功能，四件事缺一不可

目前只有 `gas/Retention.js`（結案滿 13 個月去識別化）屬於這一類。
日後若再出現「會刪東西」的功能，照同一套做：

| # | 要有什麼 | 為什麼 |
|---|---|---|
| 1 | **試跑模式**（`previewDeidentify()`）| 這種功能出錯的樣子不是跳錯誤訊息，而是**安靜地清掉不該清的東西**，而且很久以後才會發現。先把名單印出來給人看過 |
| 2 | **前置條件檢查**（`requireRecentBackup()`）| 沒有近期備份就拒絕執行。光靠「備份排 02:00、刪除排 05:00」不夠——那天的備份萬一失敗，時間再怎麼排也沒用 |
| 3 | **刪 Drive 檔案一律 `setTrashed(true)`** | 垃圾桶保留 30 天，判斷錯了救得回來，30 天後 Google 自己永久刪除。零維護，而且時間到是真的刪掉 |
| 4 | **邊界往保守方向取** | 分界日遇到不存在的日期（2 月 31 日）往回夾到月底。晚一個月刪，下次執行就補上了；早一天刪，回不來 |

**測試的重點要放在「不該動的有沒有被動到」，不是「有沒有清乾淨」。**
該清的沒清，下個月補上就好；清錯了是回不來的。
`tools/test-retention-api.js` 有一整段專門測這個
（未結案不可碰、處理中不可碰、晚分界日一天不可碰、沒有結案時間不可碰）。

**還有一個順序問題：先刪外部資源，再清 Sheet 欄位。**
反過來的話，清完欄位才刪檔案失敗，Sheet 裡的連結已經沒了，
那些檔案會變成沒有人知道存在的孤兒，永遠留著——那正是這種功能要消滅的東西。
照正確順序做，中途失敗下次執行會自動補上，不會留下遺留物。

---

### 18. 前端快取：能不能存在裝置上，看的是「洩漏出去會怎樣」

**Apps Script 每次回應 3～8 秒是固定成本，改不掉。** 那是 Google 那端的執行時間。
所以優化的方向從來不是「讓它變快」，而是「**讓使用者不必等它**」——
把上次拿到的先拿出來用，同時在背景抓新的。

三份東西，三種存法，**不可以互抄**：

| 存什麼 | 存在哪 | 為什麼 |
|---|---|---|
| 管理者 token | `sessionStorage` | 關掉分頁就失效。共用電腦上處理完直接關視窗，下一個人打不開（設計約定第 9 條）|
| 選項清單 | `localStorage` | 沒有個資，只是餐廳名稱與分類。而員工是**掃 QR Code 進來的**——每次都是新分頁，存 sessionStorage 等於完全沒有快取 |
| 最後一位驗證成功的工號 | `localStorage`，**只留一筆** | 借手機給同事用的情況真的會發生，不能讓別人的姓名累積在這台裝置上 |

**「先給舊的、背景抓新的」有兩條界線，兩條都要有：**

- 30 分鐘內 → 直接用，一次 API 都不打
- 30 分鐘～7 天 → **立刻回傳舊的**，同時在背景更新快取（畫面不動，下次進來才換）
- 超過 7 天 → 不敢再頂著，乖乖等新的

少了第二條（7 天），一個放了半年沒用的裝置會拿半年前的餐廳清單出來畫。
少了「背景更新」，管理者新增餐廳之後員工要等 TTL 過期才看得到。

⚠️ **工號快取有三條刻意的限制，改的時候不要拿掉：**

1. **只存驗證成功的。** 存了「查無此工號」的話，名冊補上他之後他還要等
   TTL 過期才進得去——而他不會等，他不會再來第二次。
2. **照樣在背景重驗一次。** 人會離職、名冊會改名。
3. **它只影響「畫面上先顯示什麼」，不影響資料正確性**——
   後端在 `submitFeedback` 會自己再驗一次工號（`gas/Feedback.js`），
   而且存進 Sheet 的是**名冊上的寫法**，不是前端快取的值。
   實測過：塞一個假的快取進去，姓名會先顯示出來，
   2 秒後背景驗證回來就被換成「查無此工號」，送不出去。

⚠️ **所有讀寫都要包 try/catch。** 無痕視窗、空間滿了、使用者關掉網站資料，
`localStorage.setItem` 都會丟例外。存不進去只是下次要重抓，
但沒包起來的話整個表單會白畫面。

驗證方式：`node tools/test-options-cache.js`

---

### 19. Apps Script 會**偶爾整支請求失敗**，前端一定要自動重試一次

**這不是我們的程式有問題。** 真的跑到我們的程式一定會回 HTTP 200 + JSON，
就算是錯誤也是 `{ok:false, error:'...'}`。但 `/exec` 這個網址本身
**會偶爾回 HTTP 404**——實測連打 15 次有 1 次，而且是**等了 33 秒之後**才回。

少了重試的話，那 1/15 的員工看到的是「載入中…」轉很久，然後跳「連線有問題」。
**而他只要再按一次就會成功——但他不會再按第二次。**

實作在 `js/api.js` 的 `fetchJson()`，三個數字都是量出來的，不是猜的：

| 設定 | 值 | 為什麼是這個數字 |
|---|---|---|
| 逾時 | 25 秒 | 正常回應 1.5～3 秒，但**實測出現過 20 秒才回而且最後是成功的**。設 10 秒會把「其實會成功」的請求砍掉重練，反而更慢。25 秒取在「量到的最慢成功 20 秒」與「Google 自己放棄的 33 秒」之間。⚠️ 那 20 秒**不是因為併發**——後來用 10 個同時打進去重測，全部成功、最慢 5.4 秒。它就是同一種間歇性的慢 |
| 重試 | 1 次 | 單次失敗率約 7%，重試一次降到 0.5%；再重試一次只再降一點點，卻讓最壞情況多等 25 秒 |
| 重試前等 | 1 秒 | 不要立刻打回去 |

**⚠️ 三件事不可以搞錯：**

**① 只有「連線失敗」才重試。** 後端有回 JSON 就算它說 `ok:false`
（查無此工號之類）也是**正常回應**，重試只是白等一次還多打一次 API。

**② 回來的不是 JSON 要當成連線問題。** 404 回的是一頁 HTML。
直接 `response.json()` 會丟一個看不懂的解析錯誤，訊息對不上使用者遇到的事。
所以改成先 `response.text()` 再自己 `JSON.parse`，失敗就轉成連線錯誤。

**③ 只有「重複做也不會出事」的 API 可以開重試。**
`Api.post()` 的第二個參數預設是 `false`，要開必須自己寫出來：

| 可以重試 | 為什麼 |
|---|---|
| 所有 GET（`getOptions` / `verifyEmployee` / 查詢）| 純讀取 |
| POST 的讀取（`getCaseList` / `getTemplates` / `getDashboardStats` / `manageAdmin op=list`）| 純讀取，只是因為要帶 token 才用 POST |
| `submitFeedback` | **靠 `client_submit_id` 去重**，重送同一筆會回既有的案件編號而不是建立第二筆（`gas/Feedback.js`）。而它也是最不能讓人重來的一支——表單填完了、照片也壓縮上傳了 |

| **不可以**重試 | 為什麼 |
|---|---|
| `manageAdmin` 的 create / resetPassword / setStatus / setRole | 不是冪等的。重設密碼重試會產生**第二組**密碼 |
| `adminLogin` | 會多算一次失敗次數 |
| `updateCase` | 可能會重複寄出回覆通知信 |

**④ 重試時要讓畫面知道。** `setApiRetryNotice()` 註冊一個回呼，
載入文字會換成「連線比較慢，重試中…」。少了這行，使用者看到的是
骨架畫面卡住不動 25 秒，他會以為當掉而重新整理——那反而讓他從頭再等一次。

---

## 常見陷阱

| 陷阱 | 說明 |
|---|---|
| 新增會用到新服務的功能（寄信、Drive、觸發器） | **第一次執行一定會失敗一次。** Apps Script 靠掃描程式碼推算需要哪些權限，剛推上新程式碼時它可能還在用舊的權限清單，於是「授權畫面按過了，功能照樣被擋」。再執行一次就好——第二次的授權畫面才會包含新權限。寫這類功能時，要把授權錯誤跟一般失敗分開報告（見 `gas/Notify.js` 的 `isAuthorizationError`），否則使用者只看到「失敗 N 次」，完全猜不到該做什麼 |
| 手機版的 CSS 斷點 | **一律寫成 `@media screen and (max-width: ...)`。** A4 扣掉邊界後的內容寬約 703px，裸的 `(max-width: 700px)` 在列印時會被誤觸發，印出來變成手機的排版。動態表的 PDF 輸出就踩過這個 |
| **新增排程之後** | **一定要重跑 `installTriggers()`。** `clasp push` 只是把程式碼推上去，Google 的鬧鐘不會自己出現——新排程就這樣安靜地不存在。`installTriggers()` 會先清光再重裝，重複執行是安全的；裝完用 `listTriggers()` 確認數量對得上 |
| Git Bash 的 `/tmp`（Windows）| `/tmp/x.js` 只有在當成**命令列參數**傳給程式時才會被轉成 Windows 路徑。程式在**內部** `open('/tmp/x.js')` 打開時不會轉，會直接 ENOENT——`node --check /tmp/a.js` 可以跑，Python 讀同一個檔案卻失敗。暫存檔一律放專案內的相對路徑 |
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
node tools/test-report-api.js  # 排程報表（收件人 / 日報 / 月報 / 空信規則 / 寄信失敗）
node tools/test-stats-api.js   # Dashboard 統計（月 / 年 / 趨勢 / 各餐廳表現）
node tools/test-backup-api.js  # 每月自動備份（保留份數 / 不誤刪使用者檔案 / 失敗處理）
node tools/test-retention-api.js # 結案滿 13 個月去識別化（分界日 / 誰不能碰 / 安全煞車）
node tools/check-contrast.js   # 配色對比度（WCAG AA），改任何顏色 token 之後跑
node tools/test-version-sync.js # 版本號與系統資訊有沒有漏改（見設計約定第 5 條）
node tools/test-options-cache.js # 前端連線層與兩份快取（逾時 / 重試 / 選項 / 工號）
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

**換到另一台時的完整步驟：**

```bash
git pull
```

拉下來就能繼續。三件事要注意：

| 項目 | 說明 |
|---|---|
| **指令前綴** | macOS 直接用 `clasp` / `npm`；Windows PowerShell 要用 `clasp.cmd` / `npm.cmd`（見上方說明） |
| **clasp 憑證** | 不在專案裡（在使用者家目錄），換電腦要重新 `clasp login`。**只有要改後端才需要**，光改前端不用 |
| **測試檔不可寫死路徑** | 一律用 `path.join(__dirname, '..')`。寫死 `D:/Claude/KANTIN` 在 macOS 上會直接爆掉——`test-cases-api.js` 與 `test-store.js` 都踩過 |

**不會跟著 git 走的東西**（換電腦時不必也不能帶）：

- clasp 登入憑證（`~/.clasprc.json`）→ 重新 `clasp login`
- Google Sheet 與 Drive 上的資料 → 本來就在雲端，兩台看到的是同一份
- Apps Script 上的程式碼 → 已部署的版本兩台共用，`clasp push` 推的是同一個專案
- 已安裝的觸發器（排程）→ 跟著「安裝的人」跑，不是跟著電腦

**接手後確認狀態的三個指令：**

```bash
git log --oneline -5                    # 做到哪裡
node tools/test-report-api.js           # 測試是否還全過
```

線上狀態（部署版本、排程有沒有裝）看 `docs/開發進度.md` 最上方的「目前狀態」。

---

## 開發原則

**先打通一條最小可行路徑，再擴充功能。**

不要一次做完所有分頁和 API 再測試。每個階段都要做到「可以實際使用」再進下一階段。
