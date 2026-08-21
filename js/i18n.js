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

    // --- 首頁 ---
    'home.tagline':     '幫我們一起把餐廳變更好',
    'home.report':      '提交回報',
    'home.reportDesc':  '有問題或建議，跟我們說',
    'home.query':       '查詢案件',
    'home.queryDesc':   '看看您的回報處理到哪了',

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
    'admin.checking':       '確認登入狀態…',
    'admin.cases.title':    '案件列表',

    // --- 管理端：統計卡片 ---
    'admin.stats.new':        '未處理',
    'admin.stats.processing': '處理中',
    'admin.stats.thisMonth':  '本月',
    'admin.stats.overdue':    '逾期 {n} 件',
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
    'admin.refresh':       '重新整理',

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

    // --- Beranda ---
    'home.tagline':     'Bantu kami bikin kantin lebih baik',
    'home.report':      'Lapor Masalah',
    'home.reportDesc':  'Ada masalah atau saran? Kasih tahu kami',
    'home.query':       'Cek Laporan',
    'home.queryDesc':   'Lihat laporan kamu sudah diproses belum',

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
    'admin.checking':       'Mengecek status login…',
    'admin.cases.title':    'Daftar Laporan',

    // --- Admin: kartu statistik ---
    'admin.stats.new':        'Belum Diproses',
    'admin.stats.processing': 'Sedang Diproses',
    'admin.stats.thisMonth':  'Bulan Ini',
    'admin.stats.overdue':    '{n} laporan terlambat',
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
    'admin.refresh':       'Muat ulang',

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

    // --- Info sistem ---
    'footer.version':    'Versi',
    'footer.maintainer': 'Dikelola oleh',
    'footer.contact':    'Kontak',
  },

};


/** 餐別的圖示 */
const MEAL_ICONS = {
  MEAL_BREAKFAST: '🌅',
  MEAL_LUNCH:     '☀️',
  MEAL_DINNER:    '🌇',
  _default:       '🍽️',
};


/** 問題分類的圖示（依代碼對應，選項設定新增分類時可在這裡補） */
const CATEGORY_ICONS = {
  CAT_TASTE:    '🍜',
  CAT_HYGIENE:  '🧹',
  CAT_SERVICE:  '🙂',
  CAT_FACILITY: '🔧',
  CAT_OTHER:    '💡',
  _default:     '📝',
};


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
