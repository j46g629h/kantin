/**
 * 測試資料產生器（開發用，上線前整支刪掉）
 *
 * 為什麼寫在 Apps Script 裡而不是從外面打 API：
 * 提交回報需要名冊上真實存在的工號，而工號屬於個資。
 * 在這裡跑的話，工號從頭到尾都留在 Sheet 內，不會外流到任何地方，
 * 執行紀錄也刻意只印案件編號、不印工號與姓名。
 *
 * 使用方式：函式下拉選單選 seedTestFeedback → 按 ▷ 執行 → 看執行紀錄
 *
 * ⚠️ 每執行一次就會新增 10 筆案件。要清掉全部測試資料請執行 clearTestData()。
 */


/**
 * 灌入 10 筆測試回報，其中 2 筆帶照片。
 *
 * 資料刻意做出變化，方便測試管理端的篩選功能：
 *   - 4 間餐廳、3 種餐別、5 種分類全部涵蓋
 *   - 星等 1～5 都有
 *   - 中文 3 筆、印尼文 7 筆（管理端會顯示「員工語言」，提示該用哪種語言回覆）
 *   - 2 筆刻意不填描述（描述本來就是選填）
 */
function seedTestFeedback() {
  const CASES = [
    { loc: 'LOC_02',  meal: 'MEAL_BREAKFAST', cat: 'CAT_TASTE',                lang: 'ID', rating: 2,
      desc: 'Bubur ayamnya hari ini terlalu encer, rasanya juga hambar.' },

    { loc: 'LOC_04',  meal: 'MEAL_LUNCH',     cat: 'CAT_HYGIENE',              lang: 'ID', rating: 1,
      desc: 'Meja nomor 12 lengket dan banyak sisa makanan. Tolong dibersihkan lebih sering ya.' },

    { loc: 'LOC_02',  meal: 'MEAL_LUNCH',     cat: 'CAT_FACILITY',             lang: 'ZH', rating: 3,
      desc: '餐廳靠窗那排有兩盞燈不亮，中午光線還好，但晚餐時間看不太清楚。',
      photo: 1 },

    { loc: 'LOC_R3',  meal: 'MEAL_DINNER',    cat: 'CAT_SERVICE',              lang: 'ID', rating: 4,
      desc: '' },

    { loc: 'LOC_VIP', meal: 'MEAL_LUNCH',     cat: 'CAT_OTHER',                lang: 'ID', rating: 5,
      desc: 'Semoga bisa ditambah pilihan buah segar setiap hari. Terima kasih!' },

    { loc: 'LOC_02',  meal: 'MEAL_BREAKFAST', cat: 'CAT_TASTE,CAT_SERVICE',    lang: 'ID', rating: 2,
      desc: 'Antrian sarapan panjang banget, dan telurnya sudah dingin waktu sampai giliran saya.' },

    { loc: 'LOC_04',  meal: 'MEAL_DINNER',    cat: 'CAT_HYGIENE,CAT_FACILITY', lang: 'ZH', rating: 2,
      desc: '洗手台的水龍頭關不緊一直滴水，旁邊地板也濕滑，走過去要很小心。',
      photo: 2 },

    { loc: 'LOC_R3',  meal: 'MEAL_LUNCH',     cat: 'CAT_TASTE',                lang: 'ID', rating: 3,
      desc: '' },

    { loc: 'LOC_02',  meal: 'MEAL_DINNER',    cat: 'CAT_SERVICE',              lang: 'ID', rating: 5,
      desc: 'Mbak yang di bagian nasi ramah banget, makasih ya.' },

    { loc: 'LOC_VIP', meal: 'MEAL_BREAKFAST', cat: 'CAT_FACILITY',             lang: 'ZH', rating: 4,
      desc: '冷氣有點太強，早餐時間坐久了會冷。' },
  ];

  // 一人一筆，避開「同一工號每日最多 10 筆」的防灌水限制
  const employees = pickRandomActiveEmployees(CASES.length);
  if (!employees.length) {
    const msg = '員工名冊裡找不到任何在職員工，無法產生測試資料。';
    Logger.log(msg);
    return msg;
  }

  const report = ['開始產生 ' + CASES.length + ' 筆測試回報…', ''];
  const created = [];
  let failed = 0;

  CASES.forEach(function (c, i) {
    const emp = employees[i % employees.length];

    const payload = {
      emp_id:           emp,
      location_code:    c.loc,
      meal_code:        c.meal,
      category_code:    c.cat,
      description:      c.desc,
      rating:           c.rating,
      lang:             c.lang,
      client_submit_id: 'seed-' + Utilities.getUuid(),
    };

    if (c.photo) {
      payload.images = [{ mimeType: 'image/jpeg', data: testImageBase64(c.photo) }];
    }

    // 直接呼叫正式的提交函式，走的是跟員工手機完全相同的路徑
    const result = submitFeedback(payload);

    if (result.ok) {
      created.push(result.data.case_id);
      report.push('✔ ' + result.data.case_id + '  ' + c.loc + '  ' + c.cat +
                  (c.photo ? '  （含照片）' : ''));
    } else {
      failed++;
      report.push('✘ 第 ' + (i + 1) + ' 筆失敗：' + result.error + ' — ' + result.message);
    }
  });

  report.push('');
  report.push('完成：成功 ' + created.length + ' 筆，失敗 ' + failed + ' 筆。');
  report.push('使用了 ' + employees.length + ' 位不同的在職員工（工號與姓名不列出，避免個資外流）。');
  report.push('');
  report.push('接下來可以到管理端案件列表按「重新整理」看結果。');
  report.push('想測試逾期標紅：把某一列的「提交時間」改成 4 天前，狀態保持 ST_NEW。');

  const text = report.join(String.fromCharCode(10));
  Logger.log(text);
  return text;
}


/**
 * 產生 4 筆「已經逾期」的測試案件。
 *
 * 為什麼需要另外做一支：submitFeedback 一律用當下時間當提交時間，
 * 剛送出的案件是 0 天，永遠不會被判定為逾期。
 * 所以這裡先正常提交，再把「提交時間」改成過去的日期。
 *
 * 分別是 4 天前、12 天前、40 天前、75 天前：
 * 從剛過門檻到超過兩個月都有，方便對照天數計算，
 * 後兩筆同時也可以拿來測「月份切換」。
 *
 * ⚠️ 只有「未處理」的案件才會被判定為逾期，所以這兩筆會保持 ST_NEW。
 */
function seedOverdueCases() {
  const OVERDUE_SPECS = [
    // 剛過門檻與明顯超時，方便對照天數計算
    { daysAgo: 4,  loc: 'LOC_04', meal: 'MEAL_LUNCH',     cat: 'CAT_HYGIENE',  lang: 'ID', rating: 1,
      desc: 'Lantai di dekat wastafel licin, hampir jatuh kemarin.' },
    { daysAgo: 12, loc: 'LOC_02', meal: 'MEAL_BREAKFAST', cat: 'CAT_FACILITY', lang: 'ZH', rating: 2,
      desc: '早餐區的保溫檯壞了，粥端上來已經是冷的，這個問題持續一段時間了。' },

    // 超過一個月。這兩筆會落在上個月甚至上上個月，
    // 順便可以測「月份切換」——它們不會出現在本月清單裡，
    // 但「未處理」與「逾期」的統計仍然算得到（那兩個是全部時間範圍）
    { daysAgo: 40, loc: 'LOC_R3',  meal: 'MEAL_DINNER', cat: 'CAT_SERVICE', lang: 'ID', rating: 1,
      desc: 'Sudah lama lapor tapi belum ada kabar. Petugas kasir sering tidak ada di tempat.' },
    { daysAgo: 75, loc: 'LOC_VIP', meal: 'MEAL_LUNCH',  cat: 'CAT_TASTE',   lang: 'ZH', rating: 1,
      desc: '這個問題反映很久了一直沒有下文：湯品每天都一樣，希望能換菜色。' },
  ];

  const employees = pickRandomActiveEmployees(OVERDUE_SPECS.length);
  if (!employees.length) {
    const msg = '員工名冊裡找不到任何在職員工，無法產生測試資料。';
    Logger.log(msg);
    return msg;
  }

  const sheet  = getSheet(SHEETS.FEEDBACK);
  const colMap = getFeedbackColumnMap();
  const report = ['開始產生 ' + OVERDUE_SPECS.length + ' 筆逾期測試案件…', ''];
  let failed = 0;

  OVERDUE_SPECS.forEach(function (spec, i) {
    const result = submitFeedback({
      emp_id:           employees[i % employees.length],
      location_code:    spec.loc,
      meal_code:        spec.meal,
      category_code:    spec.cat,
      description:      spec.desc,
      rating:           spec.rating,
      lang:             spec.lang,
      client_submit_id: 'seed-overdue-' + Utilities.getUuid(),
    });

    if (!result.ok) {
      failed++;
      report.push('✘ 第 ' + (i + 1) + ' 筆失敗：' + result.error + ' — ' + result.message);
      return;
    }

    // 把提交時間往回調。用 case_id 找列，不可以假設它在最後一列——
    // 有人同時提交的話最後一列就不是我們剛建立的那筆了
    const row = findCaseRow(sheet, colMap, result.data.case_id);
    if (!row) {
      failed++;
      report.push('✘ ' + result.data.case_id + ' 建立後找不到，無法回溯日期');
      return;
    }

    const backdated = new Date(Date.now() - spec.daysAgo * 86400000);
    setDateCell(sheet, row, colMap.submit_time, backdated);

    report.push('✔ ' + result.data.case_id + '  ' + spec.daysAgo + ' 天前  ' +
                spec.loc + '  ' + spec.cat);
  });

  report.push('');
  report.push('完成：成功 ' + (OVERDUE_SPECS.length - failed) + ' 筆，失敗 ' + failed + ' 筆。');
  report.push('');
  report.push('到管理端案件列表按「重新整理」後：');
  report.push('  · 4 天前與 12 天前那兩筆會出現在本月清單，紅底顯示「已 N 天未處理」');
  report.push('  · 40 天前與 75 天前那兩筆落在之前的月份，');
  report.push('    要點「本月」卡片切換月份才看得到清單，');
  report.push('    但「未處理」與「逾期」的統計數字現在就會把它們算進去');
  report.push('    （那兩個統計是全部時間範圍，不受月份影響）');
  report.push('');
  report.push('（逾期門檻是 3 天，設定在 gas/Config.js 的 CASE_LIST.OVERDUE_DAYS）');

  const text = report.join(String.fromCharCode(10));
  Logger.log(text);
  return text;
}


/**
 * 從員工名冊隨機挑 n 位在職員工，回傳工號陣列。
 *
 * 名冊只有幾百筆，整張讀進來再洗牌就好。
 * 用 Fisher-Yates 洗牌只洗前 n 個，不必整批排序。
 */
function pickRandomActiveEmployees(n) {
  const sheet = getSheet(SHEETS.EMPLOYEES);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const rows = sheet.getRange(2, 1, lastRow - 1, 3).getValues();

  const active = [];
  rows.forEach(function (row) {
    const id = str(row[0]);
    if (!id) return;                              // 略過空白列
    if (isInactiveStatus(row[2])) return;         // 離職的不用
    active.push(id);
  });

  for (let i = 0; i < Math.min(n, active.length); i++) {
    const j = i + Math.floor(Math.random() * (active.length - i));
    const tmp = active[i]; active[i] = active[j]; active[j] = tmp;
  }

  return active.slice(0, n);
}


/** 取得內嵌的測試照片（base64） */
function testImageBase64(index) {
  return index === 2 ? TEST_IMAGE_2 : TEST_IMAGE_1;
}


// ===== 內嵌的測試照片 =====
//
// 480×360 的 JPEG，各約 7 KB，畫面上有大字寫著 TEST，
// 在 Google Drive 裡一眼就認得出是測試檔案，方便日後清除。
// 上線前連同這整個檔案一起刪掉。

/** 測試照片 1（紅底 TEST 1） */
const TEST_IMAGE_1 = [
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAA0JCgsKCA0LCwsPDg0QFCEVFBISFCgdHhghMCoyMS8qLi00O0tANDhHOS0uQllCR05QVFVUMz9dY1xSYktTVFH/2wBDAQ4PDxQRFCcVFSdRNi42UVFRUVFRUVFRUVFR',
  'UVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVH/wAARCAFoAeADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIh',
  'MUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXG',
  'x8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAV',
  'YnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq',
  '8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCtRRRXGfRhRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUU',
  'UAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUU',
  'UAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUU',
  'UAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUU',
  'UAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUU',
  'UAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAV2kfhHT3iRjNc5IB+8v/wATXF1qr4j1dVCi7wAMD92n+FXFpbmFaFSVvZux0P8Awh+nf89rn/vpf/iaP+EP07/ntc/99L/8TUPhfVr6/vpY7qfzEWPc',
  'BsUc5HoK0PE17cWGmLNayeXIZAucA8YPrWqUWr2OCUq8ans+bUq/8Ifp3/Pa5/76X/4mse20W2l8Rz6czyiGNSQwI3dvb3qv/wAJJrH/AD+f+Q0/wq54XuJbrxE887b5HjYscAZ6elReLaSR0ctanGUpy6Gp/wAI',
  'fp3/AD2uf++l/wDiaP8AhD9O/wCe1z/30v8A8TV7xDdz2WkyT277JAygHAPf3rkf+Ek1j/n8/wDIaf4VUuSLs0Y0liKseaMjoP8AhD9O/wCe1z/30v8A8TWT4i0O10u1ilgkmZnfad5BHT2Aqr/wkmsf8/n/AJDT',
  '/Cq19qt9qEax3U/mKpyBsUc/gKhyjbRHRTpV1JOUtCC0tpry5S3gTdI5wBXW2XhG1jQG7leV+4Q7VH9areB4kL3cxHzgKgPsck/yFXvFeoXljBCtqSiyEhpAOR6D27/lTjFKPMyK1WpKr7KDsWG8NaQVIFqVPqJG',
  '/wAay9R8IqIy+nysWH/LOQjn6H/GsBNX1JHDi+uCfeQkfkeK7PSdctbrT45Lq5ghm6OrOF5HfBppxlpYznGvR97mucAysjFWBVgcEHqDXWad4XsbrT4LiSW4DyIGIVlx/KsrxT9mbVjNayxyLKgZjGwIDdO30FQw',
  'a9qlvAkMV1tjQYUeWpwPyqFaL1OqftKsE6bszpP+EP07/ntc/wDfS/8AxNH/AAh+nf8APa5/76X/AOJqj4f1rUbzV4oLi43xsGyuxR0B9BXQa3cS2mkXE8D7JEA2tgHHI9a1Si1exxTlXhNQctWZv/CH6d/z2uf+',
  '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',
  't/bGqCJ1iHlwpFuKp2zjAFT6ktuPB9uLZ5HiW4+VpBgn72fwqk2s29xHH9u01LmaNQqyeYUyB0yB1pl5rb3mmfYnt0QBw0Zj+UIAOmO/fvTuiOSo2rrZ+VvkWNd/5Aui/wDXJv8A2WmeIf8Aj10n/r0T+Qqu2qRS',
  '6VHZ3FmsjwgiKUORtz7d6i1DUPtsVonlbPs8Iizuzux36cUm0XCEk1dbN/iUqKKKg6AooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACii',
  'igAooooAKKKKACiiigAooooAKKKKAJru7nvZzPcyb5CACcAfyqGiigEklZBRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQA',
  'UUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQA',
  'UUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQA',
  'UUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQA',
  'UUUUAFFFFABRRRQAUUUUAFFFFABUtt/r1/H+VRVLbf69fx/lQD2L1FFFUYBRRRQAUUUUAFFFFABRRRQAVmVp1mUmaQCiiikWaEX+qT/dFPpkX+qT/dFPqjBhRRRQAUUUUAFFFFABRRRQAVTvP9aP92rlU7z/AFo/',
  '3aGVDcgoooqTUs2f8f4VaqrZ/wAf4VaqkZS3CiiigkKKKKACiiigAooooAKiuf8AUN+H86lqK5/1Dfh/Oga3KNFFFSbDov8AWp/vCtGs6L/Wp/vCtGmjOYUUUUyAooooAKKKKACiiigAooooAzpf9a/+8abTpf8A',
  'Wv8A7xptSboKKKKACpbb/Xr+P8qiqW2/16/j/KgHsXqKKKowCiiigAooooAKKKKACiiigArMrTrMpM0gFFFFIs0Iv9Un+6KfTIv9Un+6KfVGDCiiigAooooAKKKKACiiigAqnef60f7tXKp3n+tH+7QyobkFFFFS',
  'almz/j/CrVVbP+P8KtVSMpbhRRRQSFFFFABRRRQAUUUUAFRXP+ob8P51LUVz/qG/D+dA1uUaKKKk2HRf61P94Vo1nRf61P8AeFaNNGcwooopkBRRRQAUUUUAFFFFABRRRQBnS/61/wDeNNp0v+tf/eNNqTdBRRRQ',
  'AVLbf69fx/lUVS23+vX8f5UA9i9RRRVGAUUUUAFFFFABRRRQAUUUUAFZladZlJmkAooopFmhF/qk/wB0U+mRf6pP90U+qMGFFFFABRRRQAUUUUAFFFFABVO8/wBaP92rlU7z/Wj/AHaGVDcgoooqTUs2f8f4Vaqr',
  'Z/x/hVqqRlLcKKKKCQooooAKKKKACiiigAqK5/1Dfh/Opaiuf9Q34fzoGtyjRRRUmw6L/Wp/vCtGs6L/AFqf7wrRpozmFFFFMgKKKKACiiigAooooAKKKKAM6X/Wv/vGm06X/Wv/ALxptSboKKKKACpbb/Xr+P8A',
  'Koqltv8AXr+P8qAexeoooqjAKKKKACiiigAooooAKKKKACsytOsykzSAUUUUizQi/wBUn+6KfTIv9Un+6KfVGDCiiigAooooAKKKKACiiigAqnef60f7tXKp3n+tH+7QyobkFFFFSalmz/j/AAq1VWz/AI/wq1VI',
  'yluFFFFBIUUUUAFFFFABRRRQAVFc/wCob8P51LUVz/qG/D+dA1uUaKKKk2HRf61P94Vo1nRf61P94Vo00ZzCiiimQFFFFABRRRQAUUUUAFFFFAGdL/rX/wB402nS/wCtf/eNNqTdBRRRQAVLbf69fx/lUVS23+vX',
  '8f5UA9i9RRRVGAUUUUAFFFFABRRRQAUUUUAFZladZlJmkAooopFmhF/qk/3RT6ZF/qk/3RT6owYUUUUAFFFFABRRRQAUUUUAFU7z/Wj/AHauVTvP9aP92hlQ3IKKKKk1LNn/AB/hVqqtn/H+FWqpGUtwooooJCii',
  'igAooooAKKKKACorn/UN+H86lqK5/wBQ34fzoGtyjRRRUmw6L/Wp/vCtGs6L/Wp/vCtGmjOYUUUUyAooooAKKKKACiiigAooooAzpf8AWv8A7xptOl/1r/7xptSboKKKKACpbb/Xr+P8qiqS3IEykkAe9APYv0Uz',
  'zI/76/nR5kf99fzqjCw+imeZH/fX86PMj/vr+dAWH0UzzI/76/nR5kf99fzoCw+imeZH/fX86PMj/vr+dAWH0UzzI/76/nR5kf8AfX86AsPrMrQ8yP8Avr+dZ9JmkAooopFmhF/qk/3RT6ijkQRqC65wO9O8yP8A',
  'vr+dUYtD6KZ5kf8AfX86PMj/AL6/nQKw+imeZH/fX86PMj/vr+dAWH0UzzI/76/nR5kf99fzoCw+imeZH/fX86PMj/vr+dAWH1TvP9aP92rPmR/31/Oqt0waQFSCMdqTLjuQ0UUUjQs2f8f4VaqpaMq79zAdOpqx',
  '5kf99fzqkZS3H0UzzI/76/nR5kf99fzoJsPopnmR/wB9fzo8yP8Avr+dAWH0UzzI/wC+v50eZH/fX86AsPopnmR/31/OjzI/76/nQFh9RXP+ob8P507zI/76/nUdw6GFgGUn2NA0tSnRRRUmw6L/AFqf7wrRrOjO',
  'JFJ6ZFXvMj/vr+dNETH0UzzI/wC+v50eZH/fX86ZnYfRTPMj/vr+dHmR/wB9fzoCw+imeZH/AH1/OjzI/wC+v50BYfRTPMj/AL6/nR5kf99fzoCw+imeZH/fX86PMj/vr+dAWKMv+tf/AHjTadIcyMR0yabUm6Ci',
  'iigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACi',
  'iigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/',
  '2Q==',
].join('');


/** 測試照片 2（藍底 TEST 2） */
const TEST_IMAGE_2 = [
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAA0JCgsKCA0LCwsPDg0QFCEVFBISFCgdHhghMCoyMS8qLi00O0tANDhHOS0uQllCR05QVFVUMz9dY1xSYktTVFH/2wBDAQ4PDxQRFCcVFSdRNi42UVFRUVFRUVFRUVFR',
  'UVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVH/wAARCAFoAeADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIh',
  'MUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXG',
  'x8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAV',
  'YnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq',
  '8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDHooor3DygooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKK',
  'KACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKK',
  'KACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKK',
  'KACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKK',
  'KACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKK',
  'KACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAK72LwVpjxI5nu8soJw6/wDxNcFWyvinW1UKt7gAYH7pP8KxqxnK3I7GlOUF8SOn/wCEH0v/AJ73f/fa/wDxNH/CD6X/AM97v/vtf/iar+ENa1HUtQmi',
  'vLjzUWLcBsUYOR6CtPxZf3WnaSs9pL5chlC52g8YPqPauNuqp8nNqdKVNx5rFT/hB9L/AOe93/32v/xNYVroNpN4puNLaSYQRqSGBG7oPbHf0qt/wleuf8/3/kJP8KveELma88TyXFw++V4mLNgDPT0rflqwi3J9',
  'DK9OTSijY/4QfS/+e93/AN9r/wDE0f8ACD6X/wA97v8A77X/AOJrQ8T3lxYaLJcWsnlyqygNgHqfeuJ/4SvXP+f7/wAhJ/hWVNVqiupGk/Zwdmjpv+EH0v8A573f/fa//E1ieKPD1no9nDNbyTMzybSJGBGMZ7AV',
  'U/4SvXP+f7/yEn+FVNQ1nUNSiWO8uPNRTuA2KMH8BW0KdZSTlLQylOm1ZIr2dpPfXSW1um+RzgD+tdrYeCbOOMG9meaTuEO1R/U1V+H0KF72cj51CoD6A5J/kK0PGep32n20C2hMaykh5QORjGAPTv8AlU1ak5VP',
  'ZwdiqcIqHPIst4T0RlIFmVPqJX/xrI1TwSoiMmmzMXH/ACylI5+h7fjXNJreqxyB11G5JBz80hI/I8V3mjeIbS802KW7ureC45V1eQLyO+Ce9RKNalre5UXTqaWseaurI7I6lWU4IIwQa7TS/COn3mmW1zJNch5Y',
  'wxCsuM/981jeL/sja0Z7SaKVJUDMYmDANyD0+gP41Bb+JNXtrdIIbvbHGNqr5aHA/EV0S56kE4OxjHlhJqWp1f8Awg+l/wDPe7/77X/4mj/hB9L/AOe93/32v/xNZ3hnX9Uvtbht7m68yJgxK+Wo6KT2FdN4gupr',
  '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',
  '1Ce62eX5rFtuc4/GinBxtfsE5J3t3Og8Qf8AIb0V2JJMMOSf941DrqXMnjh1s8C43x+WSBgHYvPPpWdqurHUJrWVYfKNvEsY+bdnB69BVi919bi9h1CGxWC+RgzyiQsHwMY29hSjCStp0Y3KLvr1Jr600xbuV9R1',
  'mSe6LHzVgg/i9M9K0vEAH/CW6Mw3ciEfN1/1hrJl1yyaU3MeiQLdk7jI0jMufXZ0pl7rzXuo2F9Jb/vbXZuw/EhU59OM8+tLkm2vn2HzRSZB4j/5GC+/66mrHhD/AJGaz/4H/wCgNWdqN39u1Ce62eX5rFtuc4/G',
  'pNHv/wCzNThvfK83y93ybtucqR1wfWtXF+z5etjNNc9/M1/Df/IX1X/r1m/9CFR6YWTwdqrxcO0iK5HXbkf4mqOm6r9gu7ufyPM+0RPHt3427iDnpz0qPS9Tm02STYiSwyrtlhkGVcVDg3f5fgUpLT5jtFOpG8aL',
  'TMmaRCrL8uCvfO7ir8XHgW4H/T7/AOyrUTa7DBbzR6Zpsdk0y7ZJPMMjY9AT0qompbdCk0zyc75/O8zd04AxjHt602pSd7dUJNLS5pahIw8E6VGD8rSSEj1wzY/nRpfzeDtYUk4DxnH4j/Cs251Lz9Gs9P8AJ2/Z',
  'mY+Zuzu3EnpjjrTrTVPs2j3mn+Tu+0lTv3Y24PpjmlyPlt53/EfMr/L9DOooorcyCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKA',
  'CiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKA',
  'CiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKA',
  'CiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKA',
  'CiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKA',
  'CiiigAqa1/4+E/H+VQ1Na/8AHwn4/wAqT2BbmhRRRWRoFFFFABRRRQAUUUUAFFFFABWTWtWTVwJkFFFFWSacP+pT/dFPpkP+pT/dFPrE0CiiigAooooAKKKKACiiigAqje/64f7tXqo3v+uH+7VR3FLYr0UUVoQW',
  '7D/lp+H9at1UsP8Alp+H9at1lLctbBRRRSGFFFFABRRRQAUUUUAFRXX/AB7v+H86lqK6/wCPd/w/nTW4PYzqKKK1Mx8P+uT/AHhWnWZD/rk/3hWnUTKiFFFFQUFFFFABRRRQAUUUUAFFFFAGZN/rn/3jTKfN/rn/',
  'AN40ytkZhRRRQAVNa/8AHwn4/wAqhqa1/wCPhPx/lSewLc0KKKKyNAooooAKKKKACiiigAooooAKya1qyauBMgoooqyTTh/1Kf7op9Mh/wBSn+6KfWJoFFFFABRRRQAUUUUAFFFFABVG9/1w/wB2r1Ub3/XD/dqo',
  '7ilsV6KKK0ILdh/y0/D+tW6qWH/LT8P61brKW5a2CiiikMKKKKACiiigAooooAKiuv8Aj3f8P51LUV1/x7v+H86a3B7GdRRRWpmPh/1yf7wrTrMh/wBcn+8K06iZUQoooqCgooooAKKKKACiiigAooooAzJv9c/+',
  '8aZT5v8AXP8A7xplbIzCiiigAqa1/wCPhPx/lUNTWv8Ax8J+P8qT2BbmhRRRWRoFFFFABRRRQAUUUUAFFFFABWTWtWTVwJkFFFFWSacP+pT/AHRT6ZD/AKlP90U+sTQKKKKACiiigAooooAKKKKACqN7/rh/u1eq',
  'je/64f7tVHcUtivRRRWhBbsP+Wn4f1q3VSw/5afh/WrdZS3LWwUUUUhhRRRQAUUUUAFFFFABUV1/x7v+H86lqK6/493/AA/nTW4PYzqKKK1Mx8P+uT/eFadZkP8Ark/3hWnUTKiFFFFQUFFFFABRRRQAUUUUAFFF',
  'FAGZN/rn/wB40ynzf65/940ytkZhRRRQAVNa/wDHwn4/yqGprX/j4T8f5UnsC3NCiiisjQKKKKACiiigAooooAKKKKACsmtasmrgTIKKKKsk04f9Sn+6KfTIf9Sn+6KfWJoFFFFABRRRQAUUUUAFFFFABVG9/wBc',
  'P92r1Ub3/XD/AHaqO4pbFeiiitCC3Yf8tPw/rVuqlh/y0/D+tW6yluWtgooopDCiiigAooooAKKKKACorr/j3f8AD+dS1Fdf8e7/AIfzprcHsZ1FFFamY+H/AFyf7wrTrMh/1yf7wrTqJlRCiiioKCiiigAooooA',
  'KKKKACiiigDMm/1z/wC8aZT5v9c/+8aZWyMwooooAKmtf+PhPx/lUNTWv/Hwn4/ypPYFuaFFFFZGgUUUUAFFFFABRRRQAUUUUAFZNa1ZNXAmQUUUVZJpw/6lP90U+mQ/6lP90U+sTQKKKKACiiigAooooAKKKKAC',
  'qN7/AK4f7tXqo3v+uH+7VR3FLYr0UUVoQW7D/lp+H9at1UsP+Wn4f1q3WUty1sFFFFIYUUUUAFFFFABRRRQAVFdf8e7/AIfzqWorr/j3f8P501uD2M6iiitTMfD/AK5P94Vp1mQ/65P94Vp1EyohRRRUFBRRRQAU',
  'UUUAFFFFABRRRQBmTf65/wDeNMp83+uf/eNMrZGYUUUUAFTWv/Hwn4/yqGpbYhZ1JIA55P0pPYEaNFM82P8A56L+dHmx/wDPRfzrKxoPopnmx/8APRfzo82P/nov50WAfRTPNj/56L+dHmx/89F/OiwD6KZ5sf8A',
  'z0X86PNj/wCei/nRYB9FM82P/nov50ebH/z0X86LAPrJrT82P/nov51mVcSZBRRRVkmnD/qU/wB0U+oopIxEgLqDtHenebH/AM9F/OsTQfRTPNj/AOei/nR5sf8Az0X86LAPopnmx/8APRfzo82P/nov50WAfRTP',
  'Nj/56L+dHmx/89F/OiwD6KZ5sf8Az0X86PNj/wCei/nRYB9Ub3/XD/dq35sf/PRfzqneMrSgqQRt7GqjuJ7EFFFFaEFuw/5afh/WrdU7J1XfuYDp1NWfNj/56L+dZy3LWw+imebH/wA9F/OjzY/+ei/nU2GPopnm',
  'x/8APRfzo82P/nov50WAfRTPNj/56L+dHmx/89F/OiwD6KZ5sf8Az0X86PNj/wCei/nRYB9RXX/Hu/4fzp3mx/8APRfzqO5kRoGAdSeOAfemtwZQooorUzHw/wCuT/eFadZcRAlQngbhWj5sf/PRfzqJFRH0UzzY',
  '/wDnov50ebH/AM9F/OosUPopnmx/89F/OjzY/wDnov50WAfRTPNj/wCei/nR5sf/AD0X86LAPopnmx/89F/OjzY/+ei/nRYB9FM82P8A56L+dHmx/wDPRfzosBnzf65/940ynSkGVyORuNNrZGYUUUUAFFFFABRR',
  'RQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRR',
  'RQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQB//9k=',
].join('');


// ===== 測試用的管理者帳號（關卡 3-5）=====

/**
 * 測試管理者的帳號網域。
 *
 * `.local` 是保留網域，永遠不會是真實信箱——
 * 這樣萬一忘了清掉，第 4 階段的日報也不會真的寄出去。
 * `removeTestAdmins()` 就是靠這個字串認出哪些是測試資料。
 */
const TEST_ADMIN_DOMAIN = '@kantin.local';


/**
 * 產生 5 個測試用的一般管理者帳號。
 *
 * 用途：帳號管理頁需要有多筆資料才看得出排版、排序與各個按鈕的樣子。
 * 一個一個手動建太慢，而且驗收完還要一個一個刪。
 *
 * ⚠️ 這些是「用完就要丟」的假帳號，正式上線前一定要執行 removeTestAdmins()。
 *
 *    為什麼不能留著：規格 §10 的日報與月報會寄給「所有 ACTIVE 管理者」，
 *    而且這些帳號從來沒有人登入過，密碼永遠停在初始密碼——
 *    留 5 個在正式名單裡就是留 5 個沒人看管的入口。
 *
 * 刻意不填 Email：就算你忘了清，寄信也不會有收件人。
 */
function seedTestAdmins() {
  const PEOPLE = [
    { account: 'test01' + TEST_ADMIN_DOMAIN, name: '測試管理者一' },
    { account: 'test02' + TEST_ADMIN_DOMAIN, name: '測試管理者二' },
    { account: 'test03' + TEST_ADMIN_DOMAIN, name: '測試管理者三' },
    { account: 'test04' + TEST_ADMIN_DOMAIN, name: '測試管理者四' },
    { account: 'test05' + TEST_ADMIN_DOMAIN, name: '測試管理者五' },
  ];

  const sheet  = getSheet(SHEETS.ADMINS);
  const report = ['===== 產生測試管理者帳號 ====='];
  let created = 0;

  PEOPLE.forEach(function (person) {
    if (findAdminByAccount(person.account)) {
      report.push('－ ' + person.account + '　已存在，略過');
      return;
    }

    const password = generateInitialPassword();
    const salt     = generateSalt();

    writeRowByColumns(sheet, SHEETS.ADMINS, sheet.getLastRow() + 1, ADMIN_COLUMNS, {
      name:           person.name,
      account:        person.account,
      email:          '',                    // 刻意留空，見上面的說明
      password_hash:  hashPassword(password, salt),
      password_salt:  salt,
      role:           ADMIN_ROLES.ADMIN,
      status:         ADMIN_STATUS.ACTIVE,
      must_change_pw: 'TRUE',
      created_at:     new Date(),
      last_login_at:  '',
    });

    report.push('✔ ' + person.account + '　' + person.name + '　密碼：' + password);
    created++;
  });

  report.push('');
  report.push('建立 ' + created + ' 個。密碼只出現在這一次的執行紀錄。');
  report.push('⚠️ 正式上線前務必執行 removeTestAdmins() 全部清掉。');

  const msg = report.join('\n');
  Logger.log(msg);
  return msg;
}


/**
 * 把 seedTestAdmins() 建立的測試帳號全部刪掉，並作廢它們手上的 token。
 *
 * 這裡是真的刪除列，不是標記停用——因為它們本來就不該存在，
 * 留著只會讓「這個人到底是誰」變成日後的疑問。
 *
 * 管理者名單刪列是安全的：所有查找都用帳號（findAdminByAccount），
 * 沒有任何地方依賴列號。這跟「回報資料」不同，那裡才必須用軟刪除。
 *
 * ⚠️ 由下往上刪。由上往下刪的話，刪掉第 3 列之後原本的第 4 列會變成第 3 列，
 *    接著刪「第 4 列」就會刪到別人。
 */
function removeTestAdmins() {
  const sheet  = getSheet(SHEETS.ADMINS);
  const report = ['===== 清除測試管理者帳號 ====='];

  const targets = readAllAdmins().filter(function (admin) {
    return str(admin.account).toLowerCase().indexOf(TEST_ADMIN_DOMAIN) >= 0;
  });

  if (targets.length === 0) {
    const none = '沒有找到任何測試帳號（' + TEST_ADMIN_DOMAIN + '），不需要清除。';
    Logger.log(none);
    return none;
  }

  let removed = 0, revoked = 0;

  // 由下往上刪，列號才不會在刪除過程中位移
  targets.sort(function (a, b) { return b.row - a.row; }).forEach(function (admin) {
    const account = str(admin.account).toLowerCase();

    // 安全網：萬一有人把測試帳號升級成唯一的超級管理者，刪掉就沒人管得了帳號了
    if (normalizeRole(admin.role) === ADMIN_ROLES.SUPER
        && normalizeAdminStatus(admin.status) === ADMIN_STATUS.ACTIVE
        && countActiveSupers(readAllAdmins().map(toSafeAdmin)) <= 1) {
      report.push('⚠ ' + account + '　是目前唯一啟用中的超級管理者，沒有刪除');
      return;
    }

    revoked += revokeSessionsForAccount(account);
    sheet.deleteRow(admin.row);
    report.push('✔ 已刪除 ' + account);
    removed++;
  });

  report.push('');
  report.push('刪除 ' + removed + ' 個帳號，同時作廢 ' + revoked + ' 支 token。');

  const msg = report.join('\n');
  Logger.log(msg);
  return msg;
}
