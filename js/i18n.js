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
    'err.IMAGE_UPLOAD_FAILED':  '照片上傳失敗，請稍後再試',
    'err.DAILY_LIMIT_EXCEEDED': '今天回報的次數已達上限，請明天再來',
    'err.BUSY':                 '系統忙碌中，請稍等一下再試',
    'err.SERVER_ERROR':         '系統出了點問題，請稍後再試',
    'err.UNKNOWN':              '發生未預期的問題，請稍後再試',

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
    'err.IMAGE_UPLOAD_FAILED':  'Foto gagal diunggah, coba lagi nanti ya',
    'err.DAILY_LIMIT_EXCEEDED': 'Hari ini sudah lapor banyak, lanjut besok ya',
    'err.BUSY':                 'Sistem lagi sibuk, tunggu sebentar ya',
    'err.SERVER_ERROR':         'Ada gangguan sistem, coba lagi nanti ya',
    'err.UNKNOWN':              'Ada yang tidak beres, coba lagi nanti ya',

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
