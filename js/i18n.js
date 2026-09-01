/**
 * 多語系文字對照表
 *
 * 設計原則：介面文字全部集中在這裡，不散落在各個 HTML。
 * 要修改用詞只改這個檔案，兩種語言一起看得到，不會漏改。
 *
 * 語言政策：
 *   - 使用者以印尼籍員工為主，**一律預設印尼文**
 *   - 只有使用者自己點過「中文」才會切換並記住
 *
 * 印尼文語氣：採用口語的 **kamu**（親切、日常），
 * 目的是降低員工回報問題的心理門檻。
 *
 * ⚠️ 印尼文用詞上線前請當地同仁校對一次。
 */

const I18N = {

  zh: {
    // --- 共用 ---
    appName:        'PCI 餐廳回饋系統',
    langName:       '中文',
    back:           '返回',
    loading:        '載入中…',
    // 自動重試時才會出現。不解釋原因也不喊「錯誤」——
    // 使用者要知道的只有「還在跑、不用重按」
    'loading.retry': '連線比較慢，重試中…',

    // --- 首頁 ---
    'home.tagline':     '幫我們一起把餐廳變更好',
    'home.report':      '提交回報',
    'home.reportDesc':  '有問題或建議，跟我們說',
    'home.query':       '查詢案件',
    'home.queryDesc':   '看看您的回報處理到哪了',
    'home.help':        '怎麼使用？',

    // --- 回報表單 ---
    'form.title':        '提交回報',
    'form.empId':        '工號',
    'form.empIdPlaceholder': '請輸入您的工號',
    'form.checking':     '查詢中…',
    'form.location':     '哪一間餐廳？',
    'form.selectPlaceholder': '請選擇餐廳',
    'form.meal':         '哪一餐？',
    'form.category':     '是什麼問題？',
    'form.categoryHint': '可以選 1～2 項',
    'form.categoryFull': '已選 2 項（最多）',
    'form.rating':       '這餐還滿意嗎？',
    'form.ratingHint':   '請點選星星評分',
    'form.photo':        '拍張照片',
    'form.photoAdd':     '加照片',
    'form.photoHint':    '最多 2 張，可以拍照或從相簿選',
    'form.photoWorking': '處理中…',
    'form.photoRemove':  '刪除',
    'form.description':  '說得更詳細一點',
    'form.descPlaceholder': '請描述您遇到的問題或建議…',
    'form.optional':     '可不填',
    'form.required':     '必填',
    'form.submit':       '送出',
    'form.submitting':   '傳送中…',

    // --- 星等說明 ---
    'rating.1': '很差',
    'rating.2': '不好',
    'rating.3': '普通',
    'rating.4': '不錯',
    'rating.5': '很棒',

    // --- 查詢頁 ---
    'query.title':       '查詢案件',
    'query.keyword':     '案件編號或工號',
    'query.placeholder': '例如 PCI-202608-001 或您的工號',
    'query.hint':        '輸入案件編號查單筆，輸入工號可查全部紀錄',
    'query.search':      '查詢',
    'query.searching':   '查詢中…',
    'query.needKeyword': '請先輸入案件編號或工號',
    'query.found':       '找到 {n} 筆',
    'query.noResult':    '查無資料，請確認輸入的內容',
    'query.reply':       '管理者回覆',
    'query.noReply':     '尚未回覆，我們正在處理中',
    'query.photos':      '照片',
    'query.handler':     '目前由誰處理',

    // --- 提交成功 ---
    'success.title':    '送出成功',
    'success.thanks':   '謝謝您的回報，我們會盡快處理',
    'success.caseLabel':'您的案件編號',
    'success.remember': '請記下這組編號，之後可以用它查進度',
    'success.again':    '再回報一則',
    'success.home':     '返回首頁',

    // --- 提交失敗 ---
    'fail.title':  '送出失敗',
    'fail.retry':  '再試一次',

    // --- 錯誤訊息（依後端回傳的錯誤代碼對應）---
    'err.NETWORK':              '連線有問題，請確認網路後再試一次',
    'err.EMP_ID_REQUIRED':      '請先輸入工號',
    'err.CASE_ID_REQUIRED':     '請先輸入案件編號',
    'err.CASE_NOT_FOUND':       '查無此案件編號，請確認後重新輸入',
    'err.EMP_NOT_FOUND':        '找不到這個工號，請再確認一下',
    'err.EMP_INACTIVE':         '這個工號已停用，請洽人事單位',
    'err.LOCATION_REQUIRED':    '請先選擇餐廳',
    'err.MEAL_REQUIRED':        '請先選擇是哪一餐',
    'err.MEAL_INVALID':         '餐別有誤，請重新選擇',
    'err.CATEGORY_REQUIRED':    '請先選擇是什麼問題',
    'err.RATING_REQUIRED':      '請先點星星評分',
    'err.DESCRIPTION_REQUIRED': '選「其他建議」的話，請描述一下內容',
    'err.LOCATION_INVALID':     '餐廳選項有誤，請重新選擇',
    'err.CATEGORY_INVALID':     '問題分類有誤，請重新選擇',
    'err.CATEGORY_TOO_MANY':    '問題分類最多選 2 項',
    'err.IMAGE_TOO_MANY':       '照片最多只能傳 2 張',
    'err.IMAGE_TOO_LARGE':      '照片太大了，請換一張',
    'err.IMAGE_TYPE_INVALID':   '只支援 JPG、PNG、WebP 格式的照片',
    'err.IMAGE_INVALID':        '照片資料有誤，請重新選擇',
    'err.IMAGE_READ_FAILED':    '讀不到這張照片，請換一張試試',
    'err.IMAGE_COMPRESS_FAILED':'照片處理失敗，請換一張試試',
    'err.IMAGE_UPLOAD_FAILED':  '照片上傳失敗，請稍後再試',
    'err.DAILY_LIMIT_EXCEEDED': '今天回報的次數已達上限，請明天再來',
    'err.BUSY':                 '系統忙碌中，請稍等一下再試',
    'err.SERVER_ERROR':         '系統出了點問題，請稍後再試',
    'err.UNKNOWN':              '發生未預期的問題，請稍後再試',

    // --- 管理端：登入 ---
    'admin.entry':          '管理者登入',
    'admin.login.title':    '管理者登入',
    'admin.login.hint':     '這個頁面只給餐廳管理者使用',
    'admin.account':        '帳號',
    'admin.accountPh':      '請輸入帳號',
    'admin.password':       '密碼',
    'admin.passwordPh':     '請輸入密碼',
    'admin.loginBtn':       '登入',
    'admin.loggingIn':      '登入中…',
    'admin.attemptsLeft':   '（還可以試 {n} 次）',

    // --- 管理端：變更密碼 ---
    'admin.changePw.title': '變更密碼',
    'admin.changePw.force': '這是你第一次登入，請先設定自己的密碼',
    'admin.oldPassword':    '目前密碼',
    'admin.newPassword':    '新密碼',
    'admin.confirmPw':      '再輸入一次新密碼',
    'admin.pwRule':         '至少 8 個字，要有英文字母和數字',
    'admin.pwMismatch':     '兩次輸入的新密碼不一樣',
    'admin.changeBtn':      '儲存新密碼',
    'admin.changing':       '儲存中…',
    'admin.changed':        '密碼已更新',

    // --- 管理端：共用 ---
    'admin.hello':          '你好，{name}',
    'admin.role.SUPER':     '超級管理者',
    'admin.role.ADMIN':     '管理者',
    'admin.logout':         '登出',
    'admin.help':           '操作說明',
    'admin.checking':       '確認登入狀態…',
    'admin.cases.title':    '案件列表',

    // --- 管理端：統計卡片 ---
    'admin.stats.new':        '未處理',
    'admin.stats.processing': '處理中',
    'admin.stats.done':       '已結案',
    'admin.stats.overdue':    '全系統有 {n} 件逾期未處理，點這裡查看',
    'admin.stats.unit':       '件',

    // --- 管理端：篩選 ---
    'admin.filter.show':     '篩選條件',
    'admin.filter.hide':     '收起篩選',
    'admin.filter.keyword':  '關鍵字',
    'admin.filter.keywordPh':'案件編號 / 工號 / 姓名 / 內容',
    'admin.filter.status':   '處理狀態',
    'admin.filter.location': '餐廳地點',
    'admin.filter.category': '問題分類',
    'admin.filter.dateFrom': '起始日期',
    'admin.filter.dateTo':   '結束日期',
    'admin.filter.all':      '全部',
    'admin.filter.search':   '查詢',
    'admin.filter.searching':'查詢中…',
    'admin.filter.reset':    '清除條件',
    'admin.filter.active':   '篩選中',

    // --- 管理端：列表 ---
    'admin.list.showing':  '顯示 {n} 筆，共 {total} 筆',
    'admin.list.capped':   '筆數較多，只顯示最新的 {n} 筆。請用篩選條件縮小範圍。',
    'admin.list.empty':    '沒有符合條件的案件',
    'admin.list.emptyAll': '目前還沒有任何回報',
    'admin.list.loading':  '載入案件中…',
    'admin.refresh':       '重新整理（回到初始畫面）',

    // --- 管理端：案件內容 ---
    'admin.case.overdue':   '已 {n} 天未處理',
    'admin.case.employee':  '回報人',
    'admin.case.handler':   '處理者',
    'admin.case.noHandler': '尚未指派',
    'admin.case.lang':      '員工語言',
    'admin.case.langZH':    '中文',
    'admin.case.langID':    '印尼文',
    'admin.case.reply':     '回覆內容',
    'admin.case.noReply':   '尚未回覆',

    // --- 管理端：回覆表單 ---
    'admin.reply.title':      '處理這件案件',
    'admin.reply.status':     '處理狀態',
    'admin.reply.content':    '回覆內容',
    'admin.reply.placeholder':'寫給員工看的回覆…',
    'admin.reply.required':   '「處理中」與「已結案」必須填寫回覆，員工才知道處理狀況',
    'admin.reply.templates':  '常用回覆',
    'admin.reply.langHint':   '這位員工用{lang}回報，建議用{lang}回覆',
    'admin.reply.save':       '儲存',
    'admin.reply.saving':     '儲存中…',
    'admin.reply.saved':      '已儲存 {id}',
    'admin.reply.noChange':   '沒有任何變更',
    'admin.reply.handler':    '指派處理者',
    'admin.reply.noHandler':  '不指派',
    'admin.reply.handlerHint':'指派後，員工查詢時就看得到目前是誰在處理',

    // --- 管理端：檢視範圍 ---
    'admin.period.pick':    '選擇檢視範圍',
    'admin.period.all':     '全部時間',
    'admin.period.current': '（本月）',
    'admin.period.count':   '{n} 件',
    'admin.period.total':   '共 {n} 件',
    'admin.month.label':    '{y} 年 {m} 月',

    // --- 管理端：Dashboard（僅 SUPER）---
    'dash.entry':        '動態表',
    'dash.title':        'PCI 員工餐廳回報動態表',
    'dash.loading':      '計算統計中…',
    'dash.updatedAt':    '資料時間 {t}',
    'dash.empty':        '目前還沒有任何回報資料，統計表要有資料才顯示得出來。',
    'dash.month':        '月份',
    'dash.year':         '年度',
    'dash.monthLabel':   '{y} 年 {m} 月',

    // 月份區塊
    'dash.mSection':     '{y} 年 {m} 月',
    'dash.mTotal':       '{y} 年 {m} 月回報數',
    'dash.mNew':         '未處理',
    'dash.mDone':        '結案率',
    'dash.mDays':        '平均處理天數',
    'dash.mRating':      '平均滿意度',
    'dash.byLocation':   '各餐廳回報數量',
    'dash.byStatus':     '處理狀態比例',
    'dash.byCategory':   '問題分類佔比',
    'dash.byCategoryNote':'每個被選到的分類都算 1 次，總和會超過 100%。',

    // 年度區塊
    'dash.ySection':     '{y} 年度總覽（1–12 月）',
    'dash.yTotal':       '年度總回報',
    'dash.yDone':        '年度結案率',
    'dash.yDays':        '平均處理天數',
    'dash.yRating':      '平均滿意度',
    'dash.trend':        '月度趨勢（1–12 月）',
    'dash.trendCount':   '回報數',
    'dash.trendRating':  '平均滿意度',
    'dash.locTable':     '各餐廳年度表現',
    'dash.colLoc':       '餐廳',
    'dash.colCount':     '回報數',
    'dash.colRating':    '滿意度',
    'dash.colDone':      '結案率',
    'dash.colDays':      '處理天數',
    'dash.noData':       '沒有資料',
    'dash.print':        '列印 / 存成 PDF',
    'dash.printMeta':    '月份 {m}　·　年度 {y}　·　資料時間 {t}',

    // --- 管理端：帳號管理（僅 SUPER）---
    'accounts.entry':        '帳號管理',
    'accounts.title':        '帳號管理',
    'accounts.loading':      '載入管理者名單…',
    'accounts.count':        '共 {n} 位管理者',
    'accounts.you':          '你',
    'accounts.neverLoggedIn':'從未登入',
    'accounts.lastLogin':    '最後登入',
    'accounts.created':      '建立於',
    'accounts.noEmail':      '未填 Email',
    'accounts.mustChangePw': '待本人自行設定密碼',
    'accounts.pwChanged':    '密碼最後變更',
    'accounts.pwNeverSet':   '密碼未曾變更過',
    'accounts.status.ACTIVE':  '啟用中',
    'accounts.status.DISABLED':'已停用',

    // 新增管理者
    'accounts.add':          '新增管理者',
    'accounts.addTitle':     '新增管理者',
    'accounts.cancel':       '取消',
    'accounts.fName':        '姓名',
    'accounts.fNamePh':      '這個人的姓名',
    'accounts.fAccount':     '登入帳號',
    'accounts.fAccountPh':   '建議直接用 email',
    'accounts.fEmail':       'Email（接收日報 / 月報）',
    'accounts.fEmailPh':     '可以留空',
    'accounts.fRole':        '角色',
    'accounts.fInitPw':      '初始密碼',
    'accounts.roleHint':     '超級管理者可以管理帳號，一般管理者只能處理案件',
    'accounts.create':       '建立帳號',
    'accounts.creating':     '建立中…',

    // 動作
    'accounts.disable':      '停用',
    'accounts.enable':       '啟用',
    'accounts.resetPw':      '重設密碼',
    'accounts.rename':       '編輯資料',
    'accounts.renameTitle':  '編輯管理者資料',
    'accounts.renameLabel':  '姓名',
    'accounts.renameHint':   'Email 是報表的收件地址，留空就不會收到。姓名只影響往後顯示——已處理過的案件仍會顯示當時的名字（那是稽核紀錄）。',
    'accounts.renameSave':   '儲存',
    'accounts.renaming':     '儲存中…',
    'accounts.renamed':      '已更新「{name}」的資料',
    'accounts.renameNoChange':'資料沒有變更',
    'accounts.delete':       '刪除',
    'accounts.deleteTitle':  '永久刪除這個帳號',
    'accounts.deleteWarn':   '刪掉之後救不回來。這個人的帳號、Email、建立時間、最後登入時間都會一起消失。已經處理過的案件仍會顯示當時的名字，但你查不到那是誰了。'+String.fromCharCode(10)+'如果只是要讓他不能登入，「停用」就夠了。',
    'accounts.deletePwLabel':'請輸入你自己的密碼',
    'accounts.deleteConfirm':'確定刪除',
    'accounts.deleting':     '刪除中…',
    'accounts.deleted':      '已刪除「{name}」',
    'accounts.working':      '處理中…',
    'accounts.disabled':     '已停用 {name}',
    'accounts.enabled':      '已啟用 {name}',
    'accounts.kicked':       '（他目前的登入也一併失效了）',

    // 確認
    'accounts.confirmDisable':'確定要停用「{name}」嗎？\n\n他會立刻被登出，而且無法再登入。\n之後可以再啟用回來。',
    'accounts.confirmEnable': '確定要重新啟用「{name}」嗎？',
    'accounts.confirmReset':'確定要重設「{name}」的密碼嗎？\n\n系統會產生一組新的隨機密碼，\n他目前的密碼與登入都會立刻失效。',

    // 一次性密碼
    'accounts.pwTitle':      '請把這組密碼交給對方',
    'accounts.pwCreated':    '帳號「{account}」建立完成',
    'accounts.pwReset':      '已重設「{account}」的密碼',
    'accounts.pwWarn':       '⚠️ 這組密碼只會出現這一次，關掉就看不到了。系統只存加密後的結果，查不回來。',
    'accounts.pwNext':       '對方第一次登入時，系統會要求他立刻改成自己的密碼。',
    'accounts.pwCopy':       '複製密碼',
    'accounts.pwCopied':     '已複製',
    'accounts.pwDone':       '我已經記下來了',

    // 重設密碼對話框
    'accounts.resetTitle':   '重設「{name}」的密碼',
    'accounts.resetWarn':    '他目前的密碼與登入都會立刻失效。',
    'accounts.pwModeAuto':   '系統產生一組隨機密碼',
    'accounts.pwModeAutoHint':'12 個字，猜不到。臨時要一組時用這個',
    'accounts.pwModeManual': '我自己設定',
    'accounts.pwModeManualHint':'系統會擋掉跟其他管理者重複的密碼',
    'accounts.pwInput':      '新密碼',
    'accounts.pwInputPh':    '至少 8 個字，要有英文字母和數字',
    'accounts.pwShow':       '顯示密碼',
    'accounts.resetConfirm': '確定重設',
    'accounts.resetting':    '重設中…',
    'accounts.pwCustomNote': '這是你剛才輸入的密碼。對方第一次登入時，系統會要求他改成自己的。',

    // 提示
    'accounts.lastSuperHint':'系統至少要保留一位啟用中的超級管理者',
    'accounts.selfHint':     '不能停用自己的帳號',

    // --- 管理端錯誤 ---
    'err.LOGIN_REQUIRED':       '請輸入帳號與密碼',
    'err.LOGIN_FAILED':         '帳號或密碼錯誤',
    'err.LOGIN_LOCKED':         '嘗試次數太多，請等 15 分鐘後再試',
    'err.ACCOUNT_DISABLED':     '這個帳號已停用，請洽系統管理者',
    'err.ACCOUNT_NOT_FOUND':    '查無此帳號',
    'err.UNAUTHORIZED':         '登入已逾時，請重新登入',
    'err.FORBIDDEN':            '你的帳號沒有這個權限',
    'err.PASSWORD_REQUIRED':    '請輸入目前密碼與新密碼',
    'err.PASSWORD_TOO_SHORT':   '新密碼至少要 8 個字',
    'err.PASSWORD_NEEDS_LETTER':'新密碼裡要有英文字母',
    'err.PASSWORD_NEEDS_DIGIT': '新密碼裡要有數字',
    'err.PASSWORD_SAME':        '新密碼不可以跟目前的密碼一樣',
    'err.OLD_PASSWORD_WRONG':   '目前密碼不正確',
    'err.STATUS_REQUIRED':      '請選擇處理狀態',
    'err.STATUS_INVALID':       '處理狀態不正確，請重新選擇',
    'err.RESPONSE_REQUIRED':    '這個狀態必須填寫回覆內容',
    'err.HANDLER_INVALID':      '指派的處理者不存在或已停用，請重新選擇',
    'err.UNKNOWN_OP':           '不支援的操作',
    'err.ADMIN_ACCOUNT_REQUIRED':'請輸入帳號',
    'err.ADMIN_NAME_REQUIRED':  '請輸入姓名',
    'err.ADMIN_ACCOUNT_INVALID':'帳號不可以有空白',
    'err.ADMIN_EMAIL_INVALID':  'Email 格式不正確',
    'err.ADMIN_EXISTS':         '這個帳號已經存在了',
    'err.ADMIN_NOT_FOUND':      '查無此帳號，請重新整理再試',
    'err.ADMIN_STATUS_INVALID': '狀態不正確',
    'err.ADMIN_ROLE_INVALID':   '角色不正確',
    'err.ADMIN_SELF_FORBIDDEN': '不能停用自己的帳號',
    'err.ADMIN_SELF_RESET':     '要改自己的密碼請用「變更密碼」',
    'err.ADMIN_SELF_ROLE':      '不能調整自己的角色',
    'err.ADMIN_LAST_SUPER':     '這是唯一一位啟用中的超級管理者，不能停用',
    'err.ADMIN_SELF_DELETE':    '不能刪除自己的帳號',
    'err.ADMIN_MUST_DISABLE_FIRST':'請先把這個帳號停用，才能刪除',
    'err.ADMIN_PASSWORD_REQUIRED':'請輸入你自己的密碼',
    'err.ADMIN_PASSWORD_WRONG': '密碼不正確',
    'err.ADMIN_PASSWORD_SAME':  '這組密碼跟他現在用的一樣，等於沒有重設',
    'err.ADMIN_PASSWORD_TAKEN': '已經有其他管理者在用這組密碼了，請換一組',

    // --- 頁尾系統資訊 ---
    'footer.version':    '系統版本',
    'footer.maintainer': '維護單位',
    'footer.contact':    '聯絡方式',
  },

  id: {
    // --- Umum ---
    appName:        'Suara Karyawan · Kantin PCI',
    langName:       'Bahasa Indonesia',
    back:           'Kembali',
    loading:        'Sebentar ya…',
    'loading.retry': 'Koneksi agak lambat, lagi dicoba ulang…',

    // --- Beranda ---
    'home.tagline':     'Bantu kami bikin kantin lebih baik',
    'home.report':      'Lapor Masalah',
    'home.reportDesc':  'Ada masalah atau saran? Kasih tahu kami',
    'home.query':       'Cek Laporan',
    'home.queryDesc':   'Lihat laporan kamu sudah diproses belum',
    'home.help':        'Gimana caranya?',

    // --- Formulir laporan ---
    'form.title':        'Lapor Masalah',
    'form.empId':        'NIK',
    'form.empIdPlaceholder': 'Ketik NIK kamu',
    'form.checking':     'Lagi dicari…',
    'form.location':     'Kantin Mana?',
    'form.selectPlaceholder': 'Pilih kantin',
    'form.meal':         'Menu yang Mana?',
    'form.category':     'Masalahnya Apa?',
    'form.categoryHint': 'Boleh pilih 1 sampai 2',
    'form.categoryFull': 'Sudah 2, maksimal segitu ya',
    'form.rating':       'Seberapa Puas?',
    'form.ratingHint':   'Ketuk bintangnya',
    'form.photo':        'Foto',
    'form.photoAdd':     'Tambah Foto',
    'form.photoHint':    'Maksimal 2 foto, boleh dari kamera atau galeri',
    'form.photoWorking': 'Lagi diproses…',
    'form.photoRemove':  'Hapus',
    'form.description':  'Ceritakan Lebih Detail',
    'form.descPlaceholder': 'Ceritakan masalahnya di sini…',
    'form.optional':     'boleh kosong',
    'form.required':     'harus diisi',
    'form.submit':       'Kirim',
    'form.submitting':   'Lagi dikirim…',

    // --- Keterangan bintang ---
    'rating.1': 'Jelek Banget',
    'rating.2': 'Kurang',
    'rating.3': 'Biasa Aja',
    'rating.4': 'Bagus',
    'rating.5': 'Mantap!',

    // --- Halaman cek laporan ---
    'query.title':       'Cek Laporan',
    'query.keyword':     'Nomor Laporan atau NIK',
    'query.placeholder': 'Contoh PCI-202608-001 atau NIK kamu',
    'query.hint':        'Isi nomor laporan untuk 1 laporan, atau NIK untuk semua',
    'query.search':      'Cari',
    'query.searching':   'Lagi dicari…',
    'query.needKeyword': 'Isi nomor laporan atau NIK dulu ya',
    'query.found':       'Ketemu {n} laporan',
    'query.noResult':    'Tidak ketemu, coba cek lagi',
    'query.reply':       'Balasan dari Pengelola',
    'query.noReply':     'Belum dibalas, masih kami proses ya',
    'query.photos':      'Foto',
    'query.handler':     'Ditangani oleh',

    // --- Berhasil ---
    'success.title':    'Laporan Terkirim!',
    'success.thanks':   'Makasih ya, laporan kamu segera kami proses',
    'success.caseLabel':'Nomor Laporan Kamu',
    'success.remember': 'Simpan nomor ini ya, buat cek status laporan nanti',
    'success.again':    'Lapor Lagi',
    'success.home':     'Kembali ke Beranda',

    // --- Gagal ---
    'fail.title':  'Gagal Terkirim',
    'fail.retry':  'Coba Lagi',

    // --- Pesan kesalahan ---
    'err.NETWORK':              'Koneksi bermasalah, cek sinyal lalu coba lagi',
    'err.EMP_ID_REQUIRED':      'Isi NIK kamu dulu ya',
    'err.CASE_ID_REQUIRED':     'Isi nomor laporan dulu ya',
    'err.CASE_NOT_FOUND':       'Nomor laporan tidak ketemu, coba cek lagi',
    'err.EMP_NOT_FOUND':        'NIK-nya tidak ketemu, coba cek lagi',
    'err.EMP_INACTIVE':         'NIK ini sudah tidak aktif, hubungi HRD ya',
    'err.LOCATION_REQUIRED':    'Pilih kantinnya dulu ya',
    'err.MEAL_REQUIRED':        'Pilih dulu menu yang mana',
    'err.MEAL_INVALID':         'Pilihan menu tidak valid, pilih ulang ya',
    'err.CATEGORY_REQUIRED':    'Pilih dulu masalahnya apa',
    'err.RATING_REQUIRED':      'Kasih bintang dulu ya',
    'err.DESCRIPTION_REQUIRED': 'Kalau pilih "Saran Lain", tolong ceritakan ya',
    'err.LOCATION_INVALID':     'Pilihan kantin tidak valid, pilih ulang ya',
    'err.CATEGORY_INVALID':     'Pilihan masalah tidak valid, pilih ulang ya',
    'err.CATEGORY_TOO_MANY':    'Maksimal pilih 2 masalah ya',
    'err.IMAGE_TOO_MANY':       'Maksimal 2 foto ya',
    'err.IMAGE_TOO_LARGE':      'Fotonya kebesaran, coba foto lain',
    'err.IMAGE_TYPE_INVALID':   'Cuma bisa foto JPG, PNG, atau WebP',
    'err.IMAGE_INVALID':        'Data foto bermasalah, pilih ulang ya',
    'err.IMAGE_READ_FAILED':    'Fotonya tidak terbaca, coba foto lain ya',
    'err.IMAGE_COMPRESS_FAILED':'Foto gagal diproses, coba foto lain ya',
    'err.IMAGE_UPLOAD_FAILED':  'Foto gagal diunggah, coba lagi nanti ya',
    'err.DAILY_LIMIT_EXCEEDED': 'Hari ini sudah lapor banyak, lanjut besok ya',
    'err.BUSY':                 'Sistem lagi sibuk, tunggu sebentar ya',
    'err.SERVER_ERROR':         'Ada gangguan sistem, coba lagi nanti ya',
    'err.UNKNOWN':              'Ada yang tidak beres, coba lagi nanti ya',

    // --- Admin: masuk ---
    'admin.entry':          'Login Admin',
    'admin.login.title':    'Login Admin',
    'admin.login.hint':     'Halaman ini khusus untuk pengelola kantin',
    'admin.account':        'Akun',
    'admin.accountPh':      'Masukkan akun kamu',
    'admin.password':       'Kata Sandi',
    'admin.passwordPh':     'Masukkan kata sandi',
    'admin.loginBtn':       'Masuk',
    'admin.loggingIn':      'Sedang masuk…',
    'admin.attemptsLeft':   ' (sisa {n} percobaan)',

    // --- Admin: ganti kata sandi ---
    'admin.changePw.title': 'Ganti Kata Sandi',
    'admin.changePw.force': 'Ini login pertama kamu, silakan buat kata sandi sendiri dulu',
    'admin.oldPassword':    'Kata sandi sekarang',
    'admin.newPassword':    'Kata sandi baru',
    'admin.confirmPw':      'Ulangi kata sandi baru',
    'admin.pwRule':         'Minimal 8 karakter, harus ada huruf dan angka',
    'admin.pwMismatch':     'Kata sandi baru yang kamu isi tidak sama',
    'admin.changeBtn':      'Simpan kata sandi baru',
    'admin.changing':       'Menyimpan…',
    'admin.changed':        'Kata sandi sudah diperbarui',

    // --- Admin: umum ---
    'admin.hello':          'Halo, {name}',
    'admin.role.SUPER':     'Admin Utama',
    'admin.role.ADMIN':     'Admin',
    'admin.logout':         'Keluar',
    'admin.help':           'Panduan',
    'admin.checking':       'Mengecek status login…',
    'admin.cases.title':    'Daftar Laporan',

    // --- Admin: kartu statistik ---
    'admin.stats.new':        'Belum Diproses',
    'admin.stats.processing': 'Sedang Diproses',
    'admin.stats.done':       'Selesai',
    'admin.stats.overdue':    'Ada {n} laporan terlambat di seluruh sistem, klik untuk lihat',
    'admin.stats.unit':       '',

    // --- Admin: filter ---
    'admin.filter.show':     'Filter',
    'admin.filter.hide':     'Tutup filter',
    'admin.filter.keyword':  'Kata kunci',
    'admin.filter.keywordPh':'Nomor laporan / NIK / nama / isi',
    'admin.filter.status':   'Status',
    'admin.filter.location': 'Kantin',
    'admin.filter.category': 'Kategori masalah',
    'admin.filter.dateFrom': 'Dari tanggal',
    'admin.filter.dateTo':   'Sampai tanggal',
    'admin.filter.all':      'Semua',
    'admin.filter.search':   'Cari',
    'admin.filter.searching':'Mencari…',
    'admin.filter.reset':    'Hapus filter',
    'admin.filter.active':   'Terfilter',

    // --- Admin: daftar ---
    'admin.list.showing':  'Menampilkan {n} dari {total} laporan',
    'admin.list.capped':   'Laporan terlalu banyak, hanya {n} terbaru yang ditampilkan. Pakai filter untuk mempersempit.',
    'admin.list.empty':    'Tidak ada laporan yang cocok',
    'admin.list.emptyAll': 'Belum ada laporan sama sekali',
    'admin.list.loading':  'Memuat laporan…',
    'admin.refresh':       'Muat ulang (kembali ke tampilan awal)',

    // --- Admin: isi laporan ---
    'admin.case.overdue':   'Sudah {n} hari belum diproses',
    'admin.case.employee':  'Pelapor',
    'admin.case.handler':   'Ditangani oleh',
    'admin.case.noHandler': 'Belum ditugaskan',
    'admin.case.lang':      'Bahasa pelapor',
    'admin.case.langZH':    'Mandarin',
    'admin.case.langID':    'Bahasa Indonesia',
    'admin.case.reply':     'Balasan',
    'admin.case.noReply':   'Belum dibalas',

    // --- Admin: form balasan ---
    'admin.reply.title':      'Proses laporan ini',
    'admin.reply.status':     'Status',
    'admin.reply.content':    'Isi balasan',
    'admin.reply.placeholder':'Tulis balasan untuk karyawan…',
    'admin.reply.required':   'Status "Sedang Diproses" dan "Selesai" wajib diisi balasan, biar karyawan tahu perkembangannya',
    'admin.reply.templates':  'Balasan cepat',
    'admin.reply.langHint':   'Karyawan ini lapor pakai {lang}, sebaiknya dibalas pakai {lang} juga',
    'admin.reply.save':       'Simpan',
    'admin.reply.saving':     'Menyimpan…',
    'admin.reply.saved':      '{id} sudah tersimpan',
    'admin.reply.noChange':   'Tidak ada perubahan',
    'admin.reply.handler':    'Tugaskan ke',
    'admin.reply.noHandler':  'Belum ditugaskan',
    'admin.reply.handlerHint':'Setelah ditugaskan, karyawan bisa lihat siapa yang sedang menangani',

    // --- Admin: rentang waktu ---
    'admin.period.pick':    'Pilih rentang waktu',
    'admin.period.all':     'Semua Waktu',
    'admin.period.current': ' (bulan ini)',
    'admin.period.count':   '{n} laporan',
    'admin.period.total':   'total {n} laporan',
    'admin.month.label':    '{m}/{y}',

    // --- Admin: papan data (khusus SUPER) ---
    'dash.entry':        'Data',
    'dash.title':        'Data Laporan Kantin PCI',
    'dash.loading':      'Menghitung data…',
    'dash.updatedAt':    'Data per {t}',
    'dash.empty':        'Belum ada laporan sama sekali, jadi belum ada yang bisa ditampilkan.',
    'dash.month':        'Bulan',
    'dash.year':         'Tahun',
    'dash.monthLabel':   '{m}/{y}',

    // Bagian bulanan
    'dash.mSection':     'Bulan {m}/{y}',
    'dash.mTotal':       'Laporan bulan {m}/{y}',
    'dash.mNew':         'Belum diproses',
    'dash.mDone':        'Tingkat selesai',
    'dash.mDays':        'Rata-rata hari proses',
    'dash.mRating':      'Rata-rata kepuasan',
    'dash.byLocation':   'Jumlah per kantin',
    'dash.byStatus':     'Proporsi status',
    'dash.byCategory':   'Kategori masalah',
    'dash.byCategoryNote':'Setiap kategori yang dipilih dihitung 1 — total bisa lebih dari 100%.',

    // Bagian tahunan
    'dash.ySection':     'Ringkasan tahun {y} (Jan–Des)',
    'dash.yTotal':       'Total tahun ini',
    'dash.yDone':        'Tingkat selesai',
    'dash.yDays':        'Rata-rata hari proses',
    'dash.yRating':      'Rata-rata kepuasan',
    'dash.trend':        'Tren bulanan (Jan–Des)',
    'dash.trendCount':   'Jumlah laporan',
    'dash.trendRating':  'Rata-rata kepuasan',
    'dash.locTable':     'Perbandingan kantin (setahun)',
    'dash.colLoc':       'Kantin',
    'dash.colCount':     'Laporan',
    'dash.colRating':    'Kepuasan',
    'dash.colDone':      'Selesai',
    'dash.colDays':      'Hari',
    'dash.noData':       'Belum ada data',
    'dash.print':        'Cetak / Simpan PDF',
    'dash.printMeta':    'Bulan {m}　·　Tahun {y}　·　Data per {t}',

    // --- Admin: kelola akun (khusus SUPER) ---
    'accounts.entry':        'Kelola Akun',
    'accounts.title':        'Kelola Akun',
    'accounts.loading':      'Memuat daftar admin…',
    'accounts.count':        'Total {n} admin',
    'accounts.you':          'kamu',
    'accounts.neverLoggedIn':'Belum pernah masuk',
    'accounts.lastLogin':    'Terakhir masuk',
    'accounts.created':      'Dibuat',
    'accounts.noEmail':      'Email belum diisi',
    'accounts.mustChangePw': 'Menunggu dia atur sandi sendiri',
    'accounts.pwChanged':    'Sandi terakhir diubah',
    'accounts.pwNeverSet':   'Sandi belum pernah diubah',
    'accounts.status.ACTIVE':  'Aktif',
    'accounts.status.DISABLED':'Nonaktif',

    // Tambah admin
    'accounts.add':          'Tambah Admin',
    'accounts.addTitle':     'Tambah Admin',
    'accounts.cancel':       'Batal',
    'accounts.fName':        'Nama',
    'accounts.fNamePh':      'Nama orangnya',
    'accounts.fAccount':     'Akun untuk masuk',
    'accounts.fAccountPh':   'Sebaiknya pakai email',
    'accounts.fEmail':       'Email (untuk laporan harian / bulanan)',
    'accounts.fEmailPh':     'Boleh dikosongkan',
    'accounts.fRole':        'Peran',
    'accounts.fInitPw':      'Kata sandi awal',
    'accounts.roleHint':     'Admin utama bisa kelola akun, admin biasa hanya menangani laporan',
    'accounts.create':       'Buat Akun',
    'accounts.creating':     'Membuat…',

    // Tindakan
    'accounts.disable':      'Nonaktifkan',
    'accounts.enable':       'Aktifkan',
    'accounts.resetPw':      'Reset Kata Sandi',
    'accounts.rename':       'Ubah Data',
    'accounts.renameTitle':  'Ubah Data Admin',
    'accounts.renameLabel':  'Nama',
    'accounts.renameHint':   'Email dipakai untuk kirim laporan; kosongkan kalau tidak mau menerima. Nama hanya untuk tampilan ke depan — laporan yang sudah ditangani tetap pakai nama waktu itu (catatan audit).',
    'accounts.renameSave':   'Simpan',
    'accounts.renaming':     'Menyimpan…',
    'accounts.renamed':      'Data "{name}" sudah diperbarui',
    'accounts.renameNoChange':'Tidak ada yang berubah',
    'accounts.delete':       'Hapus',
    'accounts.deleteTitle':  'Hapus Akun Ini Permanen',
    'accounts.deleteWarn':   'Kalau sudah dihapus tidak bisa dikembalikan. Akun, email, tanggal dibuat, dan waktu login terakhir orang ini akan hilang semua. Laporan yang sudah ditangani tetap menampilkan namanya waktu itu, tapi kamu tidak bisa lagi mencari tahu siapa dia.'+String.fromCharCode(10)+'Kalau cuma mau dia tidak bisa login, cukup pakai Nonaktifkan.',
    'accounts.deletePwLabel':'Masukkan kata sandi kamu sendiri',
    'accounts.deleteConfirm':'Ya, Hapus',
    'accounts.deleting':     'Menghapus…',
    'accounts.deleted':      '"{name}" sudah dihapus',
    'accounts.working':      'Memproses…',
    'accounts.disabled':     '{name} sudah dinonaktifkan',
    'accounts.enabled':      '{name} sudah diaktifkan',
    'accounts.kicked':       ' (sesi login-nya juga langsung berakhir)',

    // Konfirmasi
    'accounts.confirmDisable':'Yakin mau menonaktifkan "{name}"?\n\nDia akan langsung keluar dan tidak bisa masuk lagi.\nNanti bisa diaktifkan kembali.',
    'accounts.confirmEnable': 'Yakin mau mengaktifkan kembali "{name}"?',
    'accounts.confirmReset':'Yakin mau reset kata sandi "{name}"?\n\nSistem akan membuat kata sandi acak baru,\nkata sandi dan sesi login dia sekarang langsung tidak berlaku.',

    // Kata sandi sekali tampil
    'accounts.pwTitle':      'Berikan kata sandi ini ke orangnya',
    'accounts.pwCreated':    'Akun "{account}" berhasil dibuat',
    'accounts.pwReset':      'Kata sandi "{account}" sudah direset',
    'accounts.pwWarn':       '⚠️ Kata sandi ini hanya muncul sekali. Kalau ditutup tidak bisa dilihat lagi — sistem cuma menyimpan versi terenkripsi.',
    'accounts.pwNext':       'Saat pertama kali masuk, dia akan diminta menggantinya sendiri.',
    'accounts.pwCopy':       'Salin kata sandi',
    'accounts.pwCopied':     'Tersalin',
    'accounts.pwDone':       'Sudah saya catat',

    // Dialog reset kata sandi
    'accounts.resetTitle':   'Reset kata sandi "{name}"',
    'accounts.resetWarn':    'Kata sandi dan sesi login dia sekarang langsung tidak berlaku.',
    'accounts.pwModeAuto':   'Sistem buatkan kata sandi acak',
    'accounts.pwModeAutoHint':'12 karakter, tidak bisa ditebak. Pakai ini kalau butuh cepat',
    'accounts.pwModeManual': 'Saya tentukan sendiri',
    'accounts.pwModeManualHint':'Sistem akan menolak kata sandi yang sama dengan admin lain',
    'accounts.pwInput':      'Kata sandi baru',
    'accounts.pwInputPh':    'Minimal 8 karakter, harus ada huruf dan angka',
    'accounts.pwShow':       'Tampilkan kata sandi',
    'accounts.resetConfirm': 'Reset Sekarang',
    'accounts.resetting':    'Mereset…',
    'accounts.pwCustomNote': 'Ini kata sandi yang tadi kamu ketik. Saat pertama masuk, dia akan diminta menggantinya sendiri.',

    // Petunjuk
    'accounts.lastSuperHint':'Sistem harus punya minimal satu admin utama yang aktif',
    'accounts.selfHint':     'Tidak bisa menonaktifkan akun sendiri',

    // --- Pesan kesalahan admin ---
    'err.LOGIN_REQUIRED':       'Isi akun dan kata sandi dulu ya',
    'err.LOGIN_FAILED':         'Akun atau kata sandi salah',
    'err.LOGIN_LOCKED':         'Terlalu banyak percobaan, tunggu 15 menit ya',
    'err.ACCOUNT_DISABLED':     'Akun ini sudah dinonaktifkan, hubungi admin utama',
    'err.ACCOUNT_NOT_FOUND':    'Akun tidak ditemukan',
    'err.UNAUTHORIZED':         'Sesi kamu sudah habis, silakan masuk lagi',
    'err.FORBIDDEN':            'Akun kamu tidak punya akses untuk ini',
    'err.PASSWORD_REQUIRED':    'Isi kata sandi sekarang dan kata sandi baru',
    'err.PASSWORD_TOO_SHORT':   'Kata sandi baru minimal 8 karakter',
    'err.PASSWORD_NEEDS_LETTER':'Kata sandi baru harus ada hurufnya',
    'err.PASSWORD_NEEDS_DIGIT': 'Kata sandi baru harus ada angkanya',
    'err.PASSWORD_SAME':        'Kata sandi baru tidak boleh sama dengan yang sekarang',
    'err.OLD_PASSWORD_WRONG':   'Kata sandi sekarang tidak cocok',
    'err.STATUS_REQUIRED':      'Pilih status dulu ya',
    'err.STATUS_INVALID':       'Status tidak valid, pilih ulang ya',
    'err.RESPONSE_REQUIRED':    'Status ini wajib diisi balasan',
    'err.HANDLER_INVALID':      'Penanggung jawab tidak ditemukan atau sudah nonaktif, pilih ulang ya',
    'err.UNKNOWN_OP':           'Tindakan tidak didukung',
    'err.ADMIN_ACCOUNT_REQUIRED':'Isi akun dulu ya',
    'err.ADMIN_NAME_REQUIRED':  'Isi nama dulu ya',
    'err.ADMIN_ACCOUNT_INVALID':'Akun tidak boleh ada spasi',
    'err.ADMIN_EMAIL_INVALID':  'Format email tidak benar',
    'err.ADMIN_EXISTS':         'Akun ini sudah ada',
    'err.ADMIN_NOT_FOUND':      'Akun tidak ditemukan, coba muat ulang',
    'err.ADMIN_STATUS_INVALID': 'Status tidak benar',
    'err.ADMIN_ROLE_INVALID':   'Peran tidak benar',
    'err.ADMIN_SELF_FORBIDDEN': 'Tidak bisa menonaktifkan akun sendiri',
    'err.ADMIN_SELF_RESET':     'Untuk ganti kata sandi sendiri, pakai menu Ganti Kata Sandi',
    'err.ADMIN_SELF_ROLE':      'Tidak bisa mengubah peran sendiri',
    'err.ADMIN_LAST_SUPER':     'Ini satu-satunya admin utama yang aktif, tidak bisa dinonaktifkan',
    'err.ADMIN_SELF_DELETE':    'Tidak bisa menghapus akun sendiri',
    'err.ADMIN_MUST_DISABLE_FIRST':'Nonaktifkan dulu akun ini, baru bisa dihapus',
    'err.ADMIN_PASSWORD_REQUIRED':'Masukkan kata sandi kamu sendiri',
    'err.ADMIN_PASSWORD_WRONG': 'Kata sandi salah',
    'err.ADMIN_PASSWORD_SAME':  'Kata sandi ini sama dengan yang dia pakai sekarang, jadi tidak ada yang berubah',
    'err.ADMIN_PASSWORD_TAKEN': 'Kata sandi ini sudah dipakai admin lain, pakai yang lain ya',

    // --- Info sistem ---
    'footer.version':    'Versi',
    'footer.maintainer': 'Dikelola oleh',
    'footer.contact':    'Kontak',
  },

};


/** 餐別的圖示 */
/**
 * 圖示（關卡 5-2：emoji 改成 SVG）
 *
 * ⚠️ 為什麼不用 emoji：
 *
 *    1. **每支手機長得都不一樣。** 🍜 在 iPhone、三星、小米上是三種畫風，
 *       擺在一起像從不同地方剪貼來的。
 *    2. **不能上色。** emoji 的顏色是字型決定的，改不了——
 *       而這一版的設計原則是「畫面上只要有顏色，就一定代表意義」，
 *       一堆彩色 emoji 會把那個原則整個打掉。
 *    3. 讀起來像暫代品。
 *
 * 這些 SVG 用 `stroke="currentColor"`，所以**顏色是跟著父層的文字色走的**——
 * 放進深色按鈕就自動變淺色，不必為每種情境各寫一套（見 style.css 的 on-surface 說明）。
 *
 * 尺寸由 CSS 的 width/height 控制，不要在這裡寫死。
 */
const ICON_BASE = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" '
                + 'stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';

const svg = (paths) => '<svg ' + ICON_BASE + '>' + paths + '</svg>';

/** 餐別的圖示（早／午／晚以太陽的高度表示） */
const MEAL_ICONS = {
  // 日出：地平線 + 半個太陽 + 上升箭頭
  MEAL_BREAKFAST: svg('<path d="M3 18h18M7 18a5 5 0 0 1 10 0"/><path d="M12 3v3M5.6 8.6l2.1 2.1M18.4 8.6l-2.1 2.1"/>'),
  // 正午：完整的太陽
  MEAL_LUNCH:     svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>'),
  // 日落：地平線 + 半個太陽 + 下降箭頭
  MEAL_DINNER:    svg('<path d="M3 18h18M7 18a5 5 0 0 1 10 0"/><path d="M12 9V6M9 6l3 3 3-3"/>'),
  // 預設：刀叉
  _default:       svg('<path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10"/><path d="M17 3c-1.7 1.2-2.5 3-2.5 5s.8 3 2.5 3v10"/>'),
};

/** 問題分類的圖示（選項設定新增分類時，在這裡補一筆就好） */
const CATEGORY_ICONS = {
  // 菜單口味：一碗熱食 + 蒸氣
  CAT_TASTE:    svg('<path d="M4 12h16a8 8 0 0 1-8 8 8 8 0 0 1-8-8Z"/><path d="M9 8c0-1 .8-1.5.8-2.5S9 3.5 9 3M14 8c0-1 .8-1.5.8-2.5S14 3.5 14 3"/>'),
  // 環境衛生：噴瓶 + 亮點
  CAT_HYGIENE:  svg('<path d="M9 8h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z"/><path d="M10 8V4h4v4"/><path d="M19 5h.01M21 8h.01M19 11h.01"/>'),
  // 服務態度：笑臉
  CAT_SERVICE:  svg('<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><path d="M9 9.5h.01M15 9.5h.01"/>'),
  // 餐廳設備：扳手
  CAT_FACILITY: svg('<path d="M14.7 6.3a4 4 0 0 0 5 5L21 10a5.5 5.5 0 0 1-7.6 6.9l-6 6a2.1 2.1 0 0 1-3-3l6-6A5.5 5.5 0 0 1 17.3 6L14.7 6.3Z"/>'),
  // 其他建議：燈泡
  CAT_OTHER:    svg('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.4.3.5.7.5 1.1v1h6v-1c0-.4.1-.8.5-1.1A6 6 0 0 0 12 3Z"/>'),
  // 預設：紙筆
  _default:     svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
};

/** 其他單獨用到的圖示 */
const UI_ICONS = {
  // 加照片：相機
  photo:   svg('<path d="M3 8a2 2 0 0 1 2-2h2.5l1.2-2h6.6L16.5 6H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z"/><circle cx="12" cy="13" r="3.5"/>'),
  // 送出成功：打勾
  check:   svg('<path d="m4 12.5 5.5 5.5L20 7"/>'),
  // 查無資料：放大鏡
  search:  svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
};

/**
 * 滿意度的星星。
 *
 * ⚠️ 原本用 `★` 這個文字字元，改成 SVG 有兩個理由：
 *
 *   1. **文字星星每支手機長得不一樣**（跟 emoji 同一個問題），
 *      而且沒辦法可靠地加描邊。
 *
 *   2. **更鮮豔＝更亮＝對比度更低。** 星星是「圖形」，
 *      WCAG 1.4.11 要求對背景至少 3:1，而越鮮豔的金色越亮、對比越低。
 *      改成 SVG 之後可以「鮮豔的填色 + 深色描邊」——
 *      對比度由描邊負責，填色就能放開。
 *      而且深色描邊在工廠的爛光線下本來就更好認。
 *
 * 未選＝只有外框，已選＝實心 + 描邊。這比「灰色實心 vs 金色實心」好認得多。
 */
const STAR_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">'
  + '<path d="M12 2.6l2.95 5.98 6.6.96-4.78 4.66 1.13 6.57L12 17.66l-5.9 3.11'
  + ' 1.13-6.57L2.45 9.54l6.6-.96z" stroke-linejoin="round"/></svg>';


// ===== 語言管理 =====

const LANG_STORAGE_KEY = 'kantin_lang';

/** 系統預設語言。使用者以印尼籍員工為主，因此固定為印尼文。 */
const DEFAULT_LANG = 'id';

/**
 * 取得目前語言。
 *
 * 只有兩種可能：使用者自己選過的語言，或預設的印尼文。
 * 刻意「不」偵測瀏覽器語言——否則中文系統的手機會自動變成中文，
 * 但實際使用者絕大多數是印尼籍員工。
 */
function getLang() {
  const saved = localStorage.getItem(LANG_STORAGE_KEY);
  return (saved === 'zh' || saved === 'id') ? saved : DEFAULT_LANG;
}

/** 設定語言並記住（下次進來直接套用） */
function setLang(lang) {
  localStorage.setItem(LANG_STORAGE_KEY, lang);
}

/** 取得翻譯文字，找不到就回傳 key 本身（方便發現漏翻） */
function t(key) {
  const dict = I18N[getLang()] || I18N[DEFAULT_LANG];
  return dict[key] !== undefined ? dict[key] : key;
}

/** 依目前語言取得選項的顯示文字 */
function optionLabel(option) {
  return getLang() === 'zh' ? option.label_zh : option.label_id;
}

/** 目前語言對應的 HTML lang 屬性值 */
function htmlLang() {
  return getLang() === 'zh' ? 'zh-Hant' : 'id';
}
