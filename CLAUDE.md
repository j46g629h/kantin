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

`index.html` / `report.html` / `query.html` 引用 CSS 與 JS 時都帶 `?v=1.1`。

**為什麼一定要有：** GitHub Pages 的 `Cache-Control: max-age=600`，
使用者的瀏覽器會把 JS 快取 10 分鐘。若後端已更新而前端還是舊的，
畫面會用「錯誤的方式」壞掉——曾經因為 API 欄位改名，
使用者點下去整個清單消失且不顯示任何訊息。

**改法：** 三個 HTML 檔一起把 `?v=` 後面的數字往上加，
建議與 `js/config.js` 的 `SYSTEM_INFO.version` 保持一致。

```bash
# 例如從 1.1 改成 1.2
sed -i 's/?v=1\.1/?v=1.2/g' index.html report.html query.html
```

搭配另一個原則：**前端讀取 API 回傳值時要防禦性存取**（`item.images || []`），
且渲染函式要有 try/catch，這樣即使版本不一致也只是少顯示一段，
不會整頁空白又沒有訊息。


### 6. API 網址只寫在 `js/config.js`

其他檔案一律引用它，不可寫死。

### 7. 選項清單讀 Sheet，不可寫死

餐廳地點、問題分類都從 `選項設定` 分頁讀取，讓管理者自己就能新增。

---

## 常見陷阱

| 陷阱 | 說明 |
|---|---|
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

### 修改後端的標準流程

1. 改 `gas/` 底下的檔案
2. 串接檢查（模擬 Apps Script 共用全域範圍，可抓出重複宣告）：
   `cat gas/Config.js gas/Utils.js gas/Main.js gas/*.js > /tmp/all.js && node --check /tmp/all.js`
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
