/**
 * 多語系文字對照表
 *
 * 設計原則：介面文字全部集中在這裡，不散落在各個 HTML。
 * 要修改用詞只改這個檔案，兩種語言一起看得到，不會漏改。
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
    'home.tagline':     '您的意見，讓餐廳更好',
    'home.report':      '提交回報',
    'home.reportDesc':  '反映問題或提出建議',
    'home.query':       '查詢案件',
    'home.queryDesc':   '查看處理進度',

    // --- 回報表單 ---
    'form.title':        '提交回報',
    'form.empId':        '工號',
    'form.empIdPlaceholder': '請輸入您的工號',
    'form.checking':     '查詢中…',
    'form.location':     '餐廳地點',
    'form.selectPlaceholder': '請選擇',
    'form.category':     '問題分類',
    'form.rating':       '用餐滿意度',
    'form.ratingHint':   '請點選星星評分',
    'form.description':  '問題描述',
    'form.descPlaceholder': '請描述您遇到的問題或建議…',
    'form.optional':     '選填',
    'form.required':     '必填',
    'form.submit':       '提交回報',
    'form.submitting':   '傳送中…',

    // --- 星等說明 ---
    'rating.1': '很差',
    'rating.2': '不佳',
    'rating.3': '普通',
    'rating.4': '滿意',
    'rating.5': '很好',

    // --- 提交成功 ---
    'success.title':    '提交成功',
    'success.thanks':   '感謝您的回報，我們會盡快處理',
    'success.caseLabel':'您的案件編號',
    'success.remember': '請記下這組編號，日後可用它查詢處理進度',
    'success.again':    '再回報一則',
    'success.home':     '返回首頁',

    // --- 提交失敗 ---
    'fail.title':  '提交失敗',
    'fail.retry':  '重新提交',

    // --- 錯誤訊息（依後端回傳的錯誤代碼對應）---
    'err.NETWORK':              '連線失敗，請確認網路後再試一次',
    'err.EMP_ID_REQUIRED':      '請輸入工號',
    'err.EMP_NOT_FOUND':        '查無此工號，請確認後重新輸入',
    'err.EMP_INACTIVE':         '此工號已停用，請洽人事單位',
    'err.LOCATION_REQUIRED':    '請選擇餐廳地點',
    'err.CATEGORY_REQUIRED':    '請選擇問題分類',
    'err.RATING_REQUIRED':      '請選擇用餐滿意度',
    'err.DESCRIPTION_REQUIRED': '選擇「其他建議」時請填寫說明',
    'err.LOCATION_INVALID':     '餐廳地點不正確，請重新選擇',
    'err.CATEGORY_INVALID':     '問題分類不正確，請重新選擇',
    'err.DAILY_LIMIT_EXCEEDED': '今日回報次數已達上限，請明天再試',
    'err.BUSY':                 '系統忙碌中，請稍後再試',
    'err.SERVER_ERROR':         '系統發生錯誤，請稍後再試',
    'err.UNKNOWN':              '發生未預期的錯誤，請稍後再試',
  },

  id: {
    // --- Umum ---
    appName:        'Sistem Umpan Balik Kantin PCI',
    langName:       'Bahasa Indonesia',
    back:           'Kembali',
    loading:        'Memuat…',

    // --- Beranda ---
    'home.tagline':     'Masukan Anda membuat kantin lebih baik',
    'home.report':      'Lapor Masalah',
    'home.reportDesc':  'Sampaikan masalah atau saran',
    'home.query':       'Cek Status',
    'home.queryDesc':   'Lihat perkembangan laporan',

    // --- Formulir laporan ---
    'form.title':        'Lapor Masalah',
    'form.empId':        'Nomor Karyawan',
    'form.empIdPlaceholder': 'Masukkan nomor karyawan Anda',
    'form.checking':     'Memeriksa…',
    'form.location':     'Lokasi Kantin',
    'form.selectPlaceholder': 'Pilih',
    'form.category':     'Kategori Masalah',
    'form.rating':       'Tingkat Kepuasan',
    'form.ratingHint':   'Ketuk bintang untuk menilai',
    'form.description':  'Keterangan',
    'form.descPlaceholder': 'Jelaskan masalah atau saran Anda…',
    'form.optional':     'opsional',
    'form.required':     'wajib',
    'form.submit':       'Kirim Laporan',
    'form.submitting':   'Mengirim…',

    // --- Keterangan bintang ---
    'rating.1': 'Sangat Buruk',
    'rating.2': 'Buruk',
    'rating.3': 'Biasa',
    'rating.4': 'Baik',
    'rating.5': 'Sangat Baik',

    // --- Berhasil ---
    'success.title':    'Berhasil Dikirim',
    'success.thanks':   'Terima kasih, laporan Anda akan segera kami proses',
    'success.caseLabel':'Nomor Laporan Anda',
    'success.remember': 'Simpan nomor ini untuk mengecek status laporan',
    'success.again':    'Lapor Lagi',
    'success.home':     'Kembali ke Beranda',

    // --- Gagal ---
    'fail.title':  'Gagal Mengirim',
    'fail.retry':  'Coba Lagi',

    // --- Pesan kesalahan ---
    'err.NETWORK':              'Koneksi gagal, periksa jaringan lalu coba lagi',
    'err.EMP_ID_REQUIRED':      'Masukkan nomor karyawan',
    'err.EMP_NOT_FOUND':        'Nomor karyawan tidak ditemukan, mohon periksa kembali',
    'err.EMP_INACTIVE':         'Nomor karyawan tidak aktif, hubungi bagian HRD',
    'err.LOCATION_REQUIRED':    'Pilih lokasi kantin',
    'err.CATEGORY_REQUIRED':    'Pilih kategori masalah',
    'err.RATING_REQUIRED':      'Pilih tingkat kepuasan',
    'err.DESCRIPTION_REQUIRED': 'Isi keterangan bila memilih "Saran Lain"',
    'err.LOCATION_INVALID':     'Lokasi kantin tidak valid, silakan pilih ulang',
    'err.CATEGORY_INVALID':     'Kategori tidak valid, silakan pilih ulang',
    'err.DAILY_LIMIT_EXCEEDED': 'Batas laporan harian tercapai, coba lagi besok',
    'err.BUSY':                 'Sistem sedang sibuk, coba beberapa saat lagi',
    'err.SERVER_ERROR':         'Terjadi kesalahan sistem, coba lagi nanti',
    'err.UNKNOWN':              'Terjadi kesalahan tak terduga, coba lagi nanti',
  },

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

/**
 * 取得目前語言。
 * 順序：使用者選過的 → 瀏覽器語言 → 預設印尼文（多數使用者）
 */
function getLang() {
  const saved = localStorage.getItem(LANG_STORAGE_KEY);
  if (saved === 'zh' || saved === 'id') return saved;

  const browser = (navigator.language || '').toLowerCase();
  return browser.startsWith('zh') ? 'zh' : 'id';
}

/** 設定語言並記住（下次進來直接套用） */
function setLang(lang) {
  localStorage.setItem(LANG_STORAGE_KEY, lang);
}

/** 取得翻譯文字，找不到就回傳 key 本身（方便發現漏翻） */
function t(key) {
  const dict = I18N[getLang()] || I18N.id;
  return dict[key] !== undefined ? dict[key] : key;
}

/** 依目前語言取得選項的顯示文字 */
function optionLabel(option) {
  return getLang() === 'zh' ? option.label_zh : option.label_id;
}
