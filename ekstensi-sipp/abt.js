"use strict";

/**
 * ============================================================================
 * TURUNAN 8503 - SATU KESATUAN (7 Okt 2026)
 * ============================================================================
 *
 * Variabel yang kalimatnya disusun kueri ABT dari huruf alasan 8503 (data_sql
 * - dihitung, bukan disimpan). Selama 8503 kosong atau bentuknya tidak
 * dikenali, SEMUANYA berbunyi "TIDAK BENAR QUERY NYA ..." - satu sebab, bukan
 * sembilan kerusakan. Daftar ini disebut pengguna (tangkapan 30, 7 Okt):
 * 8531 dan 8532 (paket abt-alasan-cdeh) serta 8524 dulu tidak ikut, sehingga
 * panel menyebut keduanya "2 variabel berbunyi pesan error" seolah kerusakan
 * sendiri. Urutan di sini tidak berarti apa-apa - tampilan mengikuti urutan
 * baris di halaman.
 */
const TURUNAN_8503 = Object.freeze(["4020", "8524", "8531", "8532", "8529", "8528", "8521", "8522", "8530"]);

// ============================================================================
// K11 (26 Okt 2026): PANEL ABT DIMUAT SAAT DIPAKAI
// ============================================================================
//
// Kode panel blangko (susunPanelAbt, penyusun saksi, Tahap 6/sore, ±600 KB) dan panel beranda ABT
// (susunPanelMassalAbt, ±80 KB) dahulu dimuat di SETIAP halaman ABT. Kini berkas terpisah
// (abt-panel-bersama.js, abt-panel-blangko.js, abt-panel-beranda.js) yang dimuat modul-malas.js lewat
// pekerja latar TEPAT sebelum dipakai: pasang() dan pasangMassalAbt() mengenali jenis halamannya lebih
// dulu (blangko / tanya-jawab / beranda / lain), baru menunggu modulnya. Isinya POTONGAN UTUH abt.js yang
// lama; pintunya hanya pemanggilan yang ditandai K11-GUARD. Tanpa pemuat (uji, jsdom) semua kode sudah ada.
function modulAbtSiap(id) {
  const pemuat = globalThis.AletaModul;
  return !pemuat || pemuat.siap(id) === true;
}

async function pastikanModulAbt(id) {
  if (modulAbtSiap(id)) return true;
  try {
    return (await globalThis.AletaModul.pastikan(id)) === true;
  } catch {
    return false;
  }
}

const ALETA_API_ABT = "/aleta/api/aleta-bot/abt/usulan";
const ALETA_API_POSITA = "/aleta/api/aleta-bot/sipp/posita";

function buatElemen(tag, kelas, teks) {
  const el = document.createElement(tag);
  if (kelas) el.className = kelas;
  if (teks !== undefined && teks !== null) el.textContent = teks;
  return el;
}

/** Alamat dasar aplikasi ABT, diturunkan dari alamat halaman yang dibuka. */
function asalAbt() {
  const cocok = location.pathname.match(/^(.*?\/abt)\//);
  return cocok ? `${location.origin}${cocok[1]}` : `${location.origin}/aps_badilag/abt`;
}

/**
 * Baris variabel di halaman ABT.
 *
 * Dikenali dari sel pertama yang ber-id empat angka - itulah bentuk yang
 * dipakai view ABT, dan bentuk itu jauh lebih tahan banting daripada urutan
 * kolom: halaman lain di aplikasi yang sama punya tabel dengan jumlah kolom
 * berbeda.
 */
function barisVariabel(akar) {
  const hasil = new Map();
  // `akar` (7 Okt): halaman blangko yang dibaca ulang lewat DOMParser - lihat
  // t6BacaUlangTurunan. Tanpa argumen: halaman yang sedang terbuka.
  for (const baris of Array.from((akar || document).querySelectorAll("tr"))) {
    const sel = baris.querySelectorAll("td");
    if (sel.length < 3) continue;
    const kode = String(sel[0].id || "").trim();
    if (!/^\d{4}$/.test(kode)) continue;
    hasil.set(kode, {
      kode,
      baris,
      selNama: sel[1],
      selNilai: sel[2],
      selAksi: sel[3] || null,
      nama: String(sel[1].textContent || "").replace(/\s+/g, " ").trim(),
      nilai: String(sel[2].textContent || "").replace(/\s+/g, " ").trim(),
    });
  }
  return hasil;
}
/* === AKHIR NAMA-ISIAN === */

/**
 * perkara_id dan penanda perkara sementara, dibaca dari tombol edit ABT.
 *
 * Keduanya tidak ada di alamat halaman dalam bentuk yang dapat dibaca -
 * alamatnya tersandi. Yang menyimpannya justru atribut onclick pada tombol
 * edit: load_form('0222','10011','...'). Dibaca dari situ, bukan dari alamat.
 */
function jatiDiriPerkara() {
  for (const tombol of Array.from(document.querySelectorAll("a[onclick]"))) {
    const cocok = String(tombol.getAttribute("onclick") || "").match(
      /load_form\('(\d{4})','([^']*)','([^']*)'\)/
    );
    if (cocok) return { perkaraId: cocok[2], perkTemp: cocok[3] };
  }
  return null;
}


/** Nomor perkara dari kepala halaman ABT. */
function nomorPerkaraAbt() {
  const judul = document.querySelector("h3.w3l_header span, h3 span");
  const teks = String((judul && judul.textContent) || document.title || "");
  const cocok = teks.match(/\d{1,5}\/[A-Za-z.]+\/\d{4}\/[A-Za-z.]+/);
  return cocok ? cocok[0] : "";
}

/** Halaman ini benar halaman daftar variabel blangko? */
function halamanBlangko() {
  return barisVariabel().size >= 5 && jatiDiriPerkara() !== null;
}

/**
 * ============================================================================
 * PENYUNTING TANYA-JAWAB SAKSI - HALAMAN TEMPAT PEKERJAANNYA SUNGGUH TERJADI
 * ============================================================================
 *
 * Penyusun keterangan dua saksi sudah ada sejak lama, tetapi HANYA di halaman
 * daftar variabel blangko. Yang mengisi keterangan saksi tidak duduk di sana -
 * ia duduk di abt/tanyajawab_perkara_edit, halaman yang barisnya
 * pertanyaan-jawaban satu per satu, dan di halaman itu ALETA tidak muncul
 * sama sekali.
 *
 * Akibatnya persis seperti yang dilaporkan: "belum ada deteksi otomisasi
 * mengisi keterangan saksi". Kemampuannya ada, tempatnya yang salah - dan
 * kemampuan yang tidak berada di tempat orang mengerjakannya sama saja dengan
 * kemampuan yang tidak ada.
 *
 * Dikenali dari DUA hal sekaligus, bukan dari alamatnya saja: alamat dapat
 * berubah, sedangkan borang tanya-jawab beserta tabel barisnya tidak.
 */
function halamanTanyaJawab() {
  if (!/tanyajawab_perkara_edit/i.test(location.pathname + location.search)) return false;
  return Boolean(document.querySelector(".tbl_user_data, .add_tanyajawab, .row_data"));
}

/**
 * Sebab jawaban ABT yang BUKAN yang diminta (uji 9 Okt) - "" bila tidak dikenali.
 *
 *  - Abt_model::get_data_variabel menjalankan die("<h3>ERROR Variabel #x#</h3>")
 *    bila satu kueri data_sql patah: seluruh halaman/pratinjau CETAK berhenti.
 *  - Abt::__construct mengalihkan ke halaman masuk bila sesinya habis - jawaban
 *    200 berisi borang sandi, bukan RTF/"DATA DISIMPAN".
 */
function a3SebabBukanAbt(teks) {
  const t = String(teks || "").slice(0, 6000);
  const galat = t.match(/ERROR\s+Variabel\s*#(\d{3,5})#/i);
  if (galat) {
    return (
      `ABT berhenti menghitung variabel #${galat[1]}# - kuerinya patah, biasanya karena petik (' atau ") ` +
      `atau garis miring terbalik pada isian yang dirujuknya. Perbaiki isian itu di ABT lalu ulangi.`
    );
  }
  if (/type=["']?password|name=["']?password/i.test(t)) return "sesi ABT habis - masuk ulang ke ABT, lalu ulangi.";
  return "";
}

// ─── Merapikan teks yang sudah ada di blangko ────────────────────────────────

/**
 * ============================================================================
 * NOMOR 6 - PENOMORAN POSITA YANG MENEMPEL
 * ============================================================================
 *
 * Posita diketik sebagai satu gumpalan: "... 23 Oktober 2017.2. Bahwa setelah
 * menikah ...". Angka butir berikutnya menempel langsung pada titik butir
 * sebelumnya, tanpa pemisah apa pun.
 *
 * Di layar ABT itu masih terbaca - kolomnya sempit, jadi teksnya membungkus
 * dan angkanya kebetulan jatuh di awal baris. Di dokumen cetak tidak: seluruh
 * posita menjadi satu paragraf panjang, dan pembacanya harus mencari sendiri
 * di mana satu butir berakhir.
 *
 * Yang dikerjakan hanya MENYISIPKAN PEMISAH. Tidak satu kata pun diubah, tidak
 * satu angka pun dinomori ulang - penomoran ulang berarti mengubah rujukan
 * antar butir ("sebagaimana butir 3"), dan itu mengubah isi gugatan.
 *
 * Butir induk dikenali dari pola "<angka>." dan anak butir dari "<huruf>.".
 * Anak butir diberi lekukan supaya tampak menggantung pada induknya.
 */
// rapikanPosita DIPINDAHKAN ke aleta_bot/services/sippPositaService.js.
//
// Sebabnya bukan kerapian: yang dirapikan harus teks yang BENAR-BENAR akan
// tersimpan, dan teks itu ada di kolom posita SIPP - bukan innerText sel
// tabel yang tergambar di sini. Dua salinan aturan yang bekerja atas dua teks
// berbeda menghasilkan pratinjau yang tidak pernah cocok dengan hasilnya.
//
// Pratinjaunya kini diminta ke server lewat uji kering - lihat mintaPositaRapi.

/**
 * ============================================================================
 * NOMOR 8 - KALIMAT PENUTUP KETERANGAN SAKSI
 * ============================================================================
 *
 * Petugas mengakhiri tiap keterangan saksi dengan "Bahwa sudah cukup;" atau
 * "Bahwa tidak sanggup lagi;". Kalimat itu catatan pemeriksaan - penanda bahwa
 * saksi selesai - bukan fakta yang dibuktikan. Di dalam putusan ia terbaca
 * seperti keterangan saksi yang berdiri sama dengan yang lain, padahal ia
 * tidak menerangkan apa pun tentang perkaranya.
 *
 * Ikut dibuang: baris kosong dan spasi yang tertinggal di bawahnya. Baris
 * kosong di ujung variabel menjadi paragraf hampa di dokumen cetak, dan
 * paragraf hampa di tengah pertimbangan hukum terlihat seperti ada yang
 * terhapus.
 *
 * Yang TIDAK dibuang: apa pun selain kedua kalimat itu. Daftar penutupnya
 * ditulis tegas di POLA_PENUTUP, bukan ditebak dari panjang kalimat - kalimat
 * pendek di tengah keterangan bisa saja fakta yang menentukan.
 */
// 17 Okt 2026 (keputusan pengguna: "hapus kalimat penutup semuanya, jangan hapus keterangan yang
// berhubungan dengan perkara"): semua pola di bawah SELURUH baris (berakhir $). Dulu cukup
// AWALANNYA cocok (\b), sehingga "Bahwa sudah cukup lama berpisah" dan "tidak sanggup lagi
// menunggu Tergugat" ikut terhapus dari keterangan saksi.
const POLA_PENUTUP = [
  /^bahwa\s+sudah\s+cukup[\s;.,!:]*$/i,
  // "tidak sanggup lagi" TIDAK lagi di daftar tegas: 17 Okt, ia jawaban perkara bila pertanyaannya
  // soal mendamaikan; penentuannya ada di adalahKalimatPenutupSaksi(baris, pertanyaan).
  /^sudah\s+cukup[\s;.,!:]*$/i,
  // ==========================================================================
  // BENTUK TANPA "BAHWA" - DIPERLUKAN SEJAK PEMBERSIHAN MENYENTUH BASIS DATA
  // ==========================================================================
  //
  // Yang tergambar di halaman selalu berawalan "Bahwa": list_keterangan di
  // ABT menyusunnya sebagai "-   Bahwa " + lcfirst(jawaban). Selama
  // pembersihan hanya menyentuh teks yang tergambar, ketiga pola di atas
  // cukup.
  //
  // Sejak keterangan saksi benar-benar disimpan kembali ke
  // abt_keterangan_saksi, yang dibersihkan adalah kolom jawaban APA ADANYA -
  // dan di sana kata "Bahwa" tidak ada. "Sudah cukup" tertangkap pola ketiga;
  // "tidak sanggup lagi" tidak tertangkap satu pun, dan akan lolos diam-diam.
  // ==========================================================================
  // DENGAN "SUDAH" DI TENGAHNYA - BENTUK YANG PALING SERING DIPAKAI
  // ==========================================================================
  //
  // "Bahwa sudah tidak sanggup lagi" tidak tertangkap satu pun pola di atas:
  // yang berawalan "bahwa" menuntut "tidak" tepat sesudahnya, dan yang
  // berawalan "tidak" menuntut kalimatnya dimulai dari situ. Kata "sudah" di
  // tengah membuat keduanya meleset.
  //
  // Lolosnya tidak berbunyi - kalimatnya hanya tetap berdiri di dalam putusan,
  // di antara keterangan saksi yang lain, seolah ia fakta yang dibuktikan.
];

/**
 * Uji 9 Okt (data satker, 4.251 jawaban penutup): 2 jawaban berbunyi
 * "Sudah\ncukup;" - penutupnya terbelah baris sehingga tidak satu baris pun
 * cocok POLA_PENUTUP dan ia lolos. Jawaban yang SELURUHNYA hanya kalimat
 * penutup (spasi/baris dirapatkan) dibuang utuh; yang memuat kata lain tetap
 * diperiksa per baris seperti sebelumnya.
 */
const POLA_PENUTUP_UTUH = /^(?:bahwa\s+)?(?:sudah\s+)?cukup\s*[;.]?$/i;

/*
 * ============================================================================
 * 16 OKT 2026 (F1.3) - PENUTUP LENTUR: BENTUK APA PUN, ASAL SELURUH BARISNYA
 * ============================================================================
 *
 * Daftar tegas di atas hanya mengenal "sudah cukup" dan "tidak sanggup lagi"
 * yang berawalan tepat. Yang lolos (dilaporkan pengguna): "Bahwa saya tidak
 * sanggup lagi", "Bahwa saksi tidak sanggup lagi", "Bahwa saksi sudah tidak
 * sanggup lagi", "Bahwa cukup sekian", "Bahwa tidak ada lagi yang ingin
 * disampaikan", dan jawaban dua bagian seperti "Tidak ada, sudah cukup"
 * (7+6+3 jawaban di data satker).
 *
 * Aturannya sengaja SEMPIT di sisi yang lain: yang dibuang hanya baris yang
 * SELURUHNYA terdiri dari kalimat penutup (subjek saya/saksi, kata sudah/
 * telah, satu atau beberapa inti penutup, "terima kasih"). Satu kata di luar
 * itu - "Sekian lama ia pergi", "sudah cukup lama berpisah", "tidak sanggup
 * lagi merukunkan keduanya" - membuat baris itu BUKAN penutup dan tetap
 * tinggal. "Tidak sanggup" tanpa kata "lagi" juga tidak dibuang: itu bisa
 * jawaban atas "sanggupkah saksi mendamaikan?".
 */
const PENUTUP_SUBJEK = "(?:(?:saya|saksi|aku)\\s+)?";
const PENUTUP_WAKTU = "(?:(?:sudah|telah|memang|sekarang)\\s+)*";
const PENUTUP_KERJA = "(?:untuk\\s+)?(?:menjawab|memberi(?:kan)?\\s+keterangan|menerangkan|menjelaskan|melanjutkan|berbicara|bicara)";
const PENUTUP_INTI = [
  // cukup / cukup sekian / sekian / sampai di sini
  "cukup(?:\\s+sekian)?(?:\\s+(?:saja|dulu|sampai\\s+di\\s+sini))?",
  "sekian(?:\\s+(?:saja|dulu))?(?:\\s+(?:keterangan|jawaban)\\s+(?:saya|saksi))?",
  "sampai\\s+di\\s+sini(?:\\s+saja)?",
  // tidak sanggup lagi (kata "lagi" WAJIB, kecuali diikuti kata kerja menjawab/menerangkan).
  // 17 Okt (keputusan pengguna): "tidak kuat/mampu lagi" TANPA kata kerja menjawab/menerangkan
  // adalah keterangan perkara ("Bahwa tidak kuat lagi", "Penggugat tidak mampu lagi") - tinggal.
  "(?:tidak|belum)\\s+sanggup\\s+lagi(?:\\s+" + PENUTUP_KERJA + ")?",
  "(?:tidak|belum)\\s+(?:kuat|mampu)\\s+lagi\\s+" + PENUTUP_KERJA,
  "(?:tidak|belum)\\s+lagi\\s+sanggup(?:\\s+" + PENUTUP_KERJA + ")?",
  "(?:tidak|belum)\\s+lagi\\s+(?:kuat|mampu)\\s+" + PENUTUP_KERJA,
  "(?:tidak|belum)\\s+(?:sanggup|kuat|mampu)\\s+" + PENUTUP_KERJA + "(?:\\s+lagi)?",
  // tidak ada lagi yang ingin disampaikan / tidak ada keterangan lain
  "(?:sudah\\s+)?tidak\\s+ada\\s+(?:lagi\\s+)?(?:yang\\s+)?(?:(?:ingin|akan|hendak|mau|perlu|dapat|bisa)\\s+)?(?:(?:saya|saksi)\\s+)?(?:sampaikan|disampaikan|terangkan|diterangkan|tambahkan|ditambahkan|jelaskan|dijelaskan|katakan|dikatakan|ketahui|diketahui)(?:\\s+lagi)?",
  "(?:sudah\\s+)?tidak\\s+ada\\s+(?:lagi\\s+)?(?:keterangan|jawaban|hal|tambahan)(?:\\s+(?:lain|tambahan|lagi))*(?:\\s+(?:dari|yang)\\s+(?:saya|saksi)(?:\\s+(?:sampaikan|terangkan|ketahui))?)?",
  // hanya itu yang saya ketahui / demikian keterangan saya (kata ganti WAJIB)
  "(?:hanya\\s+itu|itu\\s+saja|hanya\\s+demikian)(?:\\s+saja)?(?:\\s+yang)?\\s+(?:saya|saksi)\\s+(?:ketahui|terangkan|sampaikan|ketahui\\s+dan\\s+sampaikan)",
  "demikian(?:\\s+saja)?\\s+(?:keterangan|jawaban)\\s+(?:saya|saksi)",
];
const PENUTUP_SATU = PENUTUP_SUBJEK + PENUTUP_WAKTU + "(?:" + PENUTUP_INTI.join("|") + ")";
const POLA_PENUTUP_LENTUR = new RegExp(
  "^(?:(?:tidak\\s+ada|tidak|ya|iya|baik)\\s*,\\s*)?" +
    PENUTUP_SATU +
    "(?:\\s*(?:,|dan|serta)\\s*" +
    PENUTUP_SATU +
    ")*(?:\\s*(?:,|dan)?\\s*terima\\s+kasih)?$",
  "i"
);

/*
 * 17 Okt (keputusan pengguna): "Saya tidak sanggup lagi" ialah JAWABAN perkara atas "Apakah saksi masih
 * sanggup mendamaikan ...?" (452 dari 453 kemunculan di data nyata), bukan penutup. Bentuk yang
 * bermakna ganda itu (sanggup/kuat/mampu tanpa kata kerja menjawab/menerangkan) hanya dihitung penutup
 * bila PERTANYAANNYA diketahui dan berupa pertanyaan penutup ("Apakah masih ada yang ingin saudara
 * sampaikan?"). Tanpa pertanyaan (mis. teks sel gabungan) ia dibiarkan: lebih baik tinggal daripada
 * menghapus keterangan perkara. Cermin aleta_bot/services/penutupSaksi.js.
 */
const POLA_KESANGGUPAN = /\b(?:sanggup|kuat|mampu)\b/i;
const POLA_KERJA_MENJAWAB = /\b(?:menjawab|memberi(?:kan)?\s+keterangan|menerangkan|menjelaskan|melanjutkan|berbicara|bicara)\b/i;
// Kata penutup yang pasti (mis. "tidak sanggup lagi, cukup sekian"): kalimat itu penutup apa pun pertanyaannya.
const POLA_PENUTUP_PASTI = /\b(?:cukup|sekian|terima\s+kasih|tidak\s+ada|sampai\s+di\s+sini|demikian|hanya\s+itu|itu\s+saja)\b/i;
const POLA_TANYA_PENUTUP =/masih\s+ada\b[^?]*\b(?:sampaikan|sampikan|disampaikan|tanyakan|keterangan|hal\s+lain)|\b(?:sudah\s+cukup|cukup\s+sekian)\b/i;
const POLA_TANYA_KESANGGUPAN_PERKARA = /\b(?:sanggup|mampu|kuat|bisa|dapat)\b[^?]*(?:damai|rukun|nasihat|nasehat|pertahankan|bersatu|akur)/i;

/** Pertanyaan penutup pemeriksaan saksi (bukan pertanyaan perkara)? */
function pertanyaanPenutup(pertanyaan) {
  const t = String(pertanyaan || "").replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (POLA_TANYA_KESANGGUPAN_PERKARA.test(t)) return false;
  return POLA_TANYA_PENUTUP.test(t);
}

/**
 * Baris seluruhnya kalimat penutup (bentuk lentur)? Awalan "Bahwa" dan tanda baca ujung tidak dihitung.
 * `pertanyaan` (opsional) = pertanyaan yang dijawab baris itu; menentukan bentuk bermakna ganda.
 */
function adalahKalimatPenutupSaksi(baris, pertanyaan) {
  const inti = String(baris || "")
    .replace(/^[\s\-–•*]+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^bahwa[\s,]*/i, "")
    .replace(/[\s;.,!:]+$/, "")
    .trim();
  // 17 Okt (keputusan pengguna): "tidak ada yang (saya) ketahui" tanpa "lagi"/"lain" bisa jawaban
  // atas pertanyaan perkara ("tahukah saksi sebabnya?") - tinggal. Dengan "lagi"/"lain" = penutup.
  if (/\btidak\s+ada\b/i.test(inti) && /\b(?:ketahui|diketahui)\b/i.test(inti) && !/\b(?:lagi|lain)\b/i.test(inti)) return false;
  if (inti === "" || !POLA_PENUTUP_LENTUR.test(inti)) return false;
  if (POLA_KESANGGUPAN.test(inti) && !POLA_KERJA_MENJAWAB.test(inti) && !POLA_PENUTUP_PASTI.test(inti)) return pertanyaanPenutup(pertanyaan);
  return true;
}

/** `pertanyaan` (opsional): pertanyaan yang dijawab `teks`; tanpa itu "tidak sanggup lagi" dibiarkan. */
function bersihkanKeteranganSaksi(teks, pertanyaan) {
  const rapat = String(teks || "").replace(/^[\s\-–•]+/, "").replace(/\s+/g, " ").trim();
  if (rapat && (POLA_PENUTUP_UTUH.test(rapat) || adalahKalimatPenutupSaksi(rapat, pertanyaan))) return "";
  const baris = String(teks || "").replace(/\r\n/g, "\n").split("\n");
  // 21 Okt (x6): baris penutup dibuang HANYA bila berdiri sesudah kalimat yang selesai (baris sebelumnya
  // berakhir ; . ! ? :) dan ia sendiri berakhir dengan tanda itu atau baris terakhir. Baris yang terbelah di
  // tengah kalimat ("... tidak" / "cukup;") bukan penutup: dulu "nafkah ... tidak\ncukup;" terpotong jadi
  // "... tidak" (ukur 69.427 jawaban nyata: 1 kasus). Cermin isian_rtf_saring_penutup (SQL) di paket x6.
  let sebelumSelesai = true;
  const disimpan = baris.filter((satu, i) => {
    const bersih = satu.replace(/^[\s\-–•]+/, "").replace(/\s+/g, " ").trim();
    if (bersih === "") return true; // baris kosong diurus di bawah
    const selesai = /[;.!?:]$/.test(bersih);
    const terakhir = baris.slice(i + 1).every((x) => x.trim() === "");
    const penutup = POLA_PENUTUP.some((pola) => pola.test(bersih)) || adalahKalimatPenutupSaksi(bersih, pertanyaan);
    if (penutup && sebelumSelesai && (selesai || terakhir)) return false;
    sebelumSelesai = selesai;
    return true;
  });

  return disimpan
    .map((satu) => satu.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Posita: dirapikan di SIPP, sebab ABT hanya membacanya ────────────

/**
 * ============================================================================
 * KENAPA 5125 TIDAK DAPAT DISIMPAN LEWAT edit_data
 * ============================================================================
 *
 * Dibaca dari definisi variabelnya di basis data ABT:
 *
 *   5125  POSITA LENGKAP  data_type = data_sipp  tabel = perkara  kolom = posita
 *
 * dan dari Abt_model::get_data_variabel, yang untuk data_sipp menjalankan
 * "select posita as data from perkara where perkara_id = ?" terhadap koneksi
 * SIPP. ABT tidak menyimpan salinannya di mana pun.
 *
 * Karena itu penolakannya - "bertipe data_sipp, tidak dapat disunting" -
 * bukan keterbatasan yang dapat diakali: tidak ada tempat di ABT untuk
 * menyimpannya. Yang dirapikan harus positanya di SIPP, dan begitu ia rapi
 * di sana, ABT membacanya rapi pada pemuatan berikutnya.
 *
 * ============================================================================
 * LEWAT PORTAL, DAN DENGAN PAGAR YANG DAPAT DIBUKTIKAN
 * ============================================================================
 *
 * Ekstensi tidak menyentuh basis data SIPP - ia tidak punya dan tidak boleh
 * punya jalannya. Ia mengirim teks yang sudah dirapikan ke portal ALETA,
 * portal memeriksa sesi dan kewenangan, lalu bot yang menuliskannya.
 *
 * Pagarnya di sisi bot dan mutlak: teks tanpa ruang kosong harus persis sama
 * sebelum dan sesudah. Perapian hanya menyisipkan pemisah antar butir - lihat
 * rapikanPosita - sehingga tidak satu huruf pun dalil gugatan dapat berubah.
 * Bila berbeda walau satu huruf, tulisannya ditolak dan sebabnya disebut.
 */
async function mintaPositaRapi(perkaraId, ujiKering) {
  const respons = await alatAmbil(ALETA_API_POSITA, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    // Teksnya TIDAK dikirim - hanya perkaranya. Bot membaca positanya
    // sendiri dari SIPP dan merapikannya di sana; lihat catatan panjang di
    // sippPositaService.js tentang kenapa mengirim teks dari sini keliru.
    body: JSON.stringify({ perkaraId, ujiKering: ujiKering === true }),
  }, "Merapikan posita");
  if (!respons.ok) {
    // Uji 9 Okt: label kedua fungsi ini dulu tertukar ("Menyambung kata gagal"
    // saat merapikan posita, dan sebaliknya).
    return { ok: false, pesan: alatPesanGagal(null, respons.status, "Merapikan posita") };
  }

  const luar = await respons.json();
  const isi = luar?.data ?? luar;
  if (!isi?.available) {
    // Pesan dari portal diteruskan apa adanya bila ada - ia menyebut sebab
    // yang lebih tepat daripada kalimat umum, misalnya penolakan pagar isi.
    return { ok: false, pesan: isi?.message || alatPesanGagal(null, 0, "Merapikan posita") };
  }

  const disambung = Number(isi.disambung) || 0;
  const ragu = Array.isArray(isi.ragu) ? isi.ragu : [];
  return {
    ok: true,
    berubah: isi.berubah === true,
    disambung,
    ragu,
    sebelum: String(isi.sebelum || ""),
    sesudah: String(isi.sesudah || ""),
    // Perbaikan data disebut TERPISAH dari penataan. Yang satu menyambung
    // kata yang terpecah - kerusakan yang sudah tersimpan - dan yang lain
    // hanya menata barisnya. Menggabungkannya menjadi satu kata "dirapikan"
    // menyembunyikan bahwa positanya baru saja diperbaiki.
    pesan:
      isi.alasan === "sudah rapi"
        ? "positanya memang sudah rapi"
        : ujiKering
          ? disambung
            ? `pratinjau — ${disambung} kata yang terpecah akan disambung kembali`
            : "pratinjau"
          : disambung
            ? `tersimpan di SIPP, ${disambung} kata yang terpecah disambung kembali`
            : "tersimpan di SIPP",
  };
}

/**
 * ============================================================================
 * KETERANGAN SAKSI DIBACA MENTAH UNTUK "INPUT KE ABT"
 * ============================================================================
 *
 * Yang tergambar di baris 2021/2022 sudah melewati replace_ket_saksi
 * (Abt_model::list_keterangan): str_ireplace 'saya' -> 'saksi', 'ya, ' -> '',
 * dan sebutan pihak dikapitalkan - DI MANA PUN letaknya, juga di tengah kata.
 * "anaknya, dan" menjadi "anakndan", "sayang" menjadi "saksing". Diukur atas
 * keterangan saksi PA Donggala (1.119 perkara, 32.100 baris): 635 baris rusak
 * begitu, dan kalimat sumber usulan berbeda pada 961 perkara - walau nilai
 * usulannya sendiri sama pada 1.119 dari 1.119.
 *
 * Titik baca ABT yang TIDAK melewati replace_ket_saksi ada satu: penyunting
 * tanya-jawab (tanyajawab_perkara_edit -> views/abt/load_tanyajawab.php,
 * ajax_data = GetKeteranganPihak apa adanya, lihat ambilTanyaJawab). Rutenya
 * hanya memakai c (perkara), d (urutan sidang), dan no_var - sehingga ia
 * terbaca juga pada blangko cerai yang TIDAK menggambar 2021/2022 ([01ab],
 * [01a], [02]), yang sampai kini menjawab "masih kosong di halaman ini" walau
 * keterangannya ada di ABT.
 *
 * Bentuknya disusun seperti list_keterangan - "-   Bahwa " + lcfirst(jawaban)
 * per baris, jawaban kosong dilewati, lalu dibaca seperti innerText - supaya
 * pemecah butir bot melihat bentuk yang sama. Hanya replace_ket_saksi yang
 * tidak diterapkan.
 */
function teksSaksiMentah(baris) {
  const html = (Array.isArray(baris) ? baris : [])
    .map((b) => String((b && b.jawaban) || ""))
    // list_keterangan: if($value->jawaban) - "" dan "0" dilewati PHP.
    .filter((j) => j !== "" && j !== "0")
    .map((j) => `-   Bahwa ${j.charAt(0).toLowerCase()}${j.slice(1)}<br>\n`)
    .join("");
  return html
    .replace(/\r?\n/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((x) => x.trim())
    .join("\n")
    .trim();
}

// ─── Tiga berkas dari satu tekanan CETAK ─────────────────────────────────────

/**
 * ============================================================================
 * APA YANG SEBENARNYA DILAKUKAN TOMBOL CETAK ABT
 * ============================================================================
 *
 * Dibaca dari kodenya di server - views/abt/preview.php - tombol CETAK adalah
 * tautan biasa ke abt/preview, dan yang dikembalikannya SATU berkas:
 *
 *   header("Content-Type: application/vnd.ms-word");
 *   header("Content-disposition: attachment; filename=\"<no perkara> - <blangko>.rtf\"");
 *
 * RTF, satu-satunya bentuk yang dihasilkan ABT. Tidak ada satu pun rute di ABT
 * yang menghasilkan PDF.
 *
 * Anonimisasi ADA di ABT, tetapi ia menuntut berkasnya DIUNGGAH: rute
 * abt/main/anonim menerima perkara_id, perkara_no, dan file_putusan sebagai
 * multipart, lalu mengembalikan "anonim_<no>.rtf". Petugas karena itu harus
 * mengunduh putusannya lebih dulu, membuka menu lain, lalu mengunggah berkas
 * yang baru saja ia unduh.
 *
 * ============================================================================
 * YANG DIKERJAKAN DI SINI
 * ============================================================================
 *
 * Satu tekanan, tiga berkas, tanpa satu pun langkah manual di antaranya:
 *
 *   1. RTF     diambil dari abt/preview - alamat yang sama dengan tautannya
 *   2. PDF     RTF itu dikirim ke ALETA, dikonversi LibreOffice, kembali
 *   3. ANONIM  RTF itu diunggahkan ke rute anonimisasi ABT sendiri
 *
 * PDF dibuat dari yang BUKAN anonim - itu putusan yang ditandatangani.
 * Anonimnya untuk diunggah ke direktori putusan, dan bentuk yang diminta di
 * sana memang RTF.
 *
 * Urutannya disengaja: RTF lebih dulu dan diunduh SEGERA. Kalau dua langkah
 * berikutnya gagal, yang paling dibutuhkan sudah ada di tangan.
 *
 * ============================================================================
 * DAPAT DIMATIKAN, DAN BAWAANNYA MATI
 * ============================================================================
 *
 * Ia mengubah arti tombol milik aplikasi orang lain: satu tekanan yang dulu
 * menghasilkan satu berkas kini menghasilkan tiga. Perubahan sebesar itu tidak
 * pantas diambil sendiri oleh sebuah pembaruan - saklarnya ada di popup ikon
 * ALETA, dan selama mati, tombol CETAK berperilaku persis seperti semula.
 */
/**
 * Keadaan saklar sunting langsung, dibaca sekali lalu diikuti perubahannya -
 * sama dengan saklar cetak tiga berkas di bawah. Bawaannya MATI; lihat
 * catatan pada alatSuntingLangsung di panel-alat.js.
 */
let suntingLangsungNyala = false;

/* === 12OKT-G: sunting langsung (klik dua kali) - satu pintu === */
//
// Saklar "Sunting langsung (klik dua kali)" MATI = tidak satu pun sel ABT dan
// tidak satu pun teks usulan membuka penyunting lewat klik atau papan ketik
// (hanya tombol "Sunting" eksplisit pada kartu usulan yang tersisa - ia
// menyunting USULAN di panel, bukan sel ABT). Sebelum 12 Okt, sel tabel ABT
// membuka penyunting pada SATU klik tanpa menengok saklar sama sekali.
//
// Keadaannya tidak hanya dibaca saat dipakai: setiap perubahan (onChanged,
// fokus tab, pembacaan ulang di suntingLangsungSekarang) lewat
// aturSuntingLangsung - ia memasang atribut di <body> yang menggerakkan CSS
// (kursor, sorot, tombol), menyegarkan petunjuk, dan MENUTUP (membatalkan,
// tanpa simpan) penyunting langsung yang sedang terbuka.
const KUNCI_ATRIBUT_SUNTING = "data-aleta-sunting-langsung";
/** Tempat atribut keadaan: <body> (bukan <html> - atribut akar tampilan Lama dijaga identik dengan sebelum Tahap 6). */
const akarSunting = () => document.body || document.documentElement;
/** Penyunting terbuka: {batal, langsung}. langsung = dibuka lewat klik dua kali/papan ketik. */
const penyuntingTerbuka = new Set();
/** Penyegar petunjuk (title, role, tabindex) milik sel dan kartu; yang lepas dari dokumen dibuang. */
const penyegarSunting = new Set();

function terapkanSuntingLangsung() {
  try {
    akarSunting().setAttribute(KUNCI_ATRIBUT_SUNTING, suntingLangsungNyala ? "ya" : "tidak");
  } catch {
    /* tanpa dokumen, tidak ada yang digerakkan */
  }
  if (!suntingLangsungNyala) {
    for (const terbuka of Array.from(penyuntingTerbuka)) {
      if (terbuka.langsung && !terbuka.sibuk()) {
        try {
          terbuka.batal();
        } catch {
          /* penyunting yang sudah lepas */
        }
      }
    }
  }
  for (const segar of Array.from(penyegarSunting)) {
    try {
      if (segar() === false) penyegarSunting.delete(segar);
    } catch {
      penyegarSunting.delete(segar);
    }
  }
}

/** Menetapkan keadaan saklar; perubahan (atau pemakaian pertama) diterapkan seketika. */
function aturSuntingLangsung(nyala) {
  // Halaman yang belum punya akar (atau tiruan uji tanpa atribut) dianggap belum pernah diterapkan.
  const akar = akarSunting();
  const sudahDiterapkan = Boolean(akar && typeof akar.hasAttribute === "function" && akar.hasAttribute(KUNCI_ATRIBUT_SUNTING));
  const berubah = suntingLangsungNyala !== (nyala === true) || !sudahDiterapkan;
  suntingLangsungNyala = nyala === true;
  if (berubah) terapkanSuntingLangsung();
}
/* === AKHIR 12OKT-G === */

void alatSuntingLangsung().then((n) => {
  aturSuntingLangsung(n === true);
});

/**
 * Membaca ulang saklar sunting langsung dari penyimpanan.
 *
 * Sama sebabnya dengan saklarCetakSekarang: salinan di memori dapat basi
 * tanpa satu pun tanda, dan yang ditentukannya PERBUATAN - menulis langsung
 * ke blangko ABT. Gagal membaca dianggap MATI, bukan menyala: yang ragu tidak
 * menulis apa pun ke berkas orang.
 */
async function suntingLangsungSekarang() {
  try {
    const nyala = await alatSuntingLangsung();
    aturSuntingLangsung(nyala === true);
    return suntingLangsungNyala;
  } catch {
    aturSuntingLangsung(false);
    return false;
  }
}
try {
  chrome.storage.onChanged.addListener((perubahan, wilayah) => {
    if (wilayah !== "local" || !perubahan[KUNCI_SUNTING_LANGSUNG]) return;
    aturSuntingLangsung(perubahan[KUNCI_SUNTING_LANGSUNG].newValue === true);
  });
} catch {
  /* di luar konteks ekstensi */
}
// Tab yang dibekukan tidak menerima onChanged: saat tab kembali dilihat,
// keadaannya dibaca ULANG dari penyimpanan.
try {
  window.addEventListener("focus", () => void suntingLangsungSekarang());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void suntingLangsungSekarang();
  });
} catch {
  /* tanpa jendela */
}

const KUNCI_CETAK_TIGA = "cetakTigaBerkas";

/**
 * Tata letak penyunting keterangan dua saksi: "damping" atau "tumpuk".
 *
 * Bawaannya BERDAMPINGAN - diputuskan pengguna 21 September 2026. Yang
 * menyunting keterangan saksi membandingkan jawaban saksi 1 dengan saksi 2
 * baris demi baris, dan perbandingan itu yang menjadi pekerjaannya.
 *
 * Diingat per peramban, bukan per perkara: pilihannya tentang cara orang itu
 * bekerja, bukan tentang perkaranya. Gagal membacanya jatuh ke bawaan, bukan
 * ke galat - tata letak yang salah tidak pantas menghentikan penyuntingan.
 */
const KUNCI_TATA_SAKSI = "tataLetakSaksi";
let tataSaksi = "damping";

async function muatTataSaksi() {
  try {
    const simpan = await chrome.storage.local.get([KUNCI_TATA_SAKSI]);
    tataSaksi = simpan[KUNCI_TATA_SAKSI] === "tumpuk" ? "tumpuk" : "damping";
  } catch {
    tataSaksi = "damping";
  }
}

/* === P5P6 10 Okt === */
/**
 * ============================================================================
 * PARAGRAF KETERANGAN SAKSI (RINGKAS / LENGKAP) + PERINGATAN RINGAN
 * ============================================================================
 *
 * Bot (deteksiSaksiService.lengkapiSusunan) menambahkan dua ruas pada jawaban
 * "Susun keterangan saksi": paragrafSaksi[] - tiap saksi dalam dua gaya,
 * identitasnya dari SIPP di awal paragraf - dan peringatanSaksi[] (saksi di
 * bawah umur, bukan keluarga pada perkara syiqaq, hanya satu saksi).
 *
 *   - Peringatan TIDAK menahan apa pun; tombol simpan tetap seperti semula.
 *   - Paragraf TIDAK disimpan ke ABT. Yang disimpan tetap tanya-jawab (ABT
 *     sendiri mencetaknya menjadi "Bahwa ..."). Paragraf untuk disalin ke
 *     putusan/catatan; ia mengikuti susunan SAAT tombol Susun ditekan.
 *   - Gaya diingat per peramban (chrome.storage.local), bawaannya "lengkap"
 *     (gaya blangko putusan satker). Gagal membaca = bawaan, bukan galat.
 *   - Bot lama tanpa ruas ini: tidak ada yang digambar.
 */
const P6_KUNCI_GAYA = "gayaParagrafSaksi";
let p6GayaParagraf = "lengkap";

async function p6MuatGaya() {
  try {
    const simpan = await chrome.storage.local.get([P6_KUNCI_GAYA]);
    p6GayaParagraf = simpan[P6_KUNCI_GAYA] === "ringkas" ? "ringkas" : "lengkap";
  } catch {
    p6GayaParagraf = "lengkap";
  }
}

/**
 * Keadaan saklar, dibaca sekali lalu diikuti perubahannya.
 *
 * Bawaannya MATI. Ia mengubah arti tombol milik aplikasi orang lain - satu
 * tekanan yang dulu menghasilkan satu berkas menjadi tiga - dan perubahan
 * sebesar itu tidak pantas diambil sendiri oleh sebuah pembaruan.
 */
let cetakTigaMenyala = false;

async function muatSaklarCetak() {
  try {
    const simpan = await chrome.storage.local.get([KUNCI_CETAK_TIGA]);
    cetakTigaMenyala = simpan[KUNCI_CETAK_TIGA] === true;
  } catch {
    cetakTigaMenyala = false;
  }
  try {
    // Diubah dari popup sementara halaman ini terbuka: berlaku seketika,
    // tanpa memuat ulang. Yang baru menyalakannya lalu menekan CETAK tidak
    // seharusnya mendapat satu berkas karena halamannya belum disegarkan.
    chrome.storage.onChanged.addListener((perubahan, wilayah) => {
      if (wilayah !== "local" || !perubahan[KUNCI_CETAK_TIGA]) return;
      cetakTigaMenyala = perubahan[KUNCI_CETAK_TIGA].newValue === true;
      // Penandanya ikut berubah seketika. Tanpa ini, saklar yang baru
      // dinyalakan dari popup meninggalkan halaman yang mengaku masih mati -
      // dan penanda yang berbohong lebih buruk daripada tidak ada penanda.
      segarkanPenandaCetak();
    });
  } catch {
    /* tanpa pendengar, saklarnya berlaku pada pemuatan berikutnya */
  }
}

/**
 * Nama berkas, disusun di sini dan bukan diambil dari header ABT.
 *
 * Header ABT menyusunnya dari nomor perkara dan nama blangko, dan nama blangko
 * memuat tanda kurung siku serta garis miring - "[01] [Kabul Verstek] Cerai
 * (Format Lengkap)". Yang bergaris miring tidak dapat menjadi nama berkas di
 * mana pun, dan yang lolos pun menghasilkan tiga berkas dengan nama sepanjang
 * satu baris.
 */
/**
 * ============================================================================
 * STATUS PUTUSAN IKUT PADA NAMANYA - TERMASUK VERSTEK
 * ============================================================================
 *
 * Diminta sejak 15 September: nama berkas menyebut nomor perkara,
 * deskripsinya, status putusannya, dan verstek atau bukan. Dua yang pertama
 * sudah ada; status dan verstek belum, sehingga dua berkas dari perkara yang
 * sama - satu dikabulkan verstek, satu contradictoir - hanya dapat dibedakan
 * dengan membukanya.
 *
 * Sumbernya SIPP, lewat jadwal sidang yang sudah dibaca panel massal
 * (statusPutusan dan verstekPutusan). Pada halaman satu perkara, panel
 * menanyakannya sekali lalu menyimpannya di statusPutusanPerkara.
 *
 * Yang tidak terbaca tidak menambahkan apa pun - nama berkas yang mengarang
 * status putusan jauh lebih berbahaya daripada nama yang pendek.
 */
const statusPutusanPerkara = new Map();

/** "Dikabulkan" + verstek menjadi "Dikabulkan verstek". */
function sebutStatusPutusan(nomorPerkara) {
  const keadaan = statusPutusanPerkara.get(String(nomorPerkara || ""));
  if (!keadaan) return "";
  const status = String(keadaan.statusPutusan || "").trim();
  const verstek = keadaan.verstek ? "verstek" : "";
  // Status yang sudah menyebut verstek tidak diulang: SIPP menulis
  // "DIKABULKAN (verstek)" pada sebagian baris.
  if (verstek && /verstek/i.test(status)) return status;
  return [status, verstek].filter(Boolean).join(" ");
}

/** Jenis perkara menurut daftar sidang - "" bila perkaranya belum dikenal. */
function sebutJenisPerkara(nomorPerkara) {
  const keadaan = statusPutusanPerkara.get(String(nomorPerkara || ""));
  return String((keadaan && keadaan.jenisPerkara) || "").trim();
}

// ─── Riwayat dan urungkan ────────────────────────────────────────────────────

/**
 * ============================================================================
 * TIAP PERUBAHAN DICATAT, DAN DAPAT DIURUNGKAN
 * ============================================================================
 *
 * Tanpa ini, pengisian otomatis yang keliru tidak dapat dibedakan dari ketikan
 * petugas: keduanya hanya berupa teks di dalam kolom, tanpa jejak siapa yang
 * menaruhnya dan apa isinya sebelum itu. Yang menemukan kekeliruan seminggu
 * kemudian tidak punya cara mengembalikannya selain mengingat.
 *
 * Dahulu disimpan HANYA di penyimpanan ekstensi, dengan batas yang disebut
 * sendiri: riwayatnya hanya ada di peramban ini dan hilang bila datanya
 * dibersihkan. Batas itu punya tiga akibat nyata - hilang saat data peramban
 * dibersihkan, tidak ada pada peramban lain milik orang yang sama, dan tidak
 * terlihat oleh siapa pun selain yang menyuntingnya, sehingga tidak dapat
 * dipakai mengawasi apa pun.
 *
 * Sekarang dicatat di KEDUANYA, dan masing-masing punya tugasnya - lihat
 * catatan pada catatRiwayat di bawah. Yang di peramban tetap yang
 * menggerakkan Urungkan, dan itu bukan peninggalan: ia satu-satunya yang
 * lengkap, dan satu-satunya yang tetap ada ketika jaringan putus.
 */
const KUNCI_RIWAYAT = "abtRiwayat";
const BATAS_RIWAYAT = 200;
const ALETA_API_RIWAYAT = "/aleta/api/aleta-ecourt/abt-riwayat";

/**
 * ============================================================================
 * DICATAT DUA KALI, DAN MASING-MASING PUNYA TUGASNYA
 * ============================================================================
 *
 *   peramban   LENGKAP, ada seketika, dan menggerakkan tombol Urungkan
 *   peladen    BERTAHAN, dapat dibaca orang lain, dan menjadi jejak pengawasan
 *
 * Peramban ditulis LEBIH DAHULU dan tanpa syarat. Menjadikan peladen
 * satu-satunya sumber akan mematikan Urungkan setiap kali jaringan terputus -
 * padahal justru saat sesuatu baru saja salah diterapkanlah tombol itu paling
 * dibutuhkan.
 *
 * Kegagalan mengirim ke peladen karena itu DIAM: penyuntingannya sudah
 * berhasil, salinan lengkapnya sudah tersimpan, dan berteriak tentang jejak
 * pengawasan pada saat itu hanya membuat petugas menyangka suntingannya gagal.
 */
/**
 * 1.184.0 (butir 16): catatan riwayat DIANTRIKAN. Sampai 1.183.0 jeda manusia
 * >= 0,9 detik memisahkan tiap tulisan, sehingga baca-lalu-tulis
 * KUNCI_RIWAYAT tidak pernah bertumpuk. Tanpa jeda, dua catatan beruntun
 * dapat membaca daftar yang sama dan yang kedua menimpa yang pertama.
 */
let a3AntreanRiwayat = Promise.resolve();

function catatRiwayat(catatan) {
  const jalan = a3AntreanRiwayat.then(() => catatRiwayatSatu(catatan));
  a3AntreanRiwayat = jalan.catch(() => {});
  return jalan;
}

async function catatRiwayatSatu(catatan) {
  try {
    const simpan = await chrome.storage.local.get([KUNCI_RIWAYAT]);
    const daftar = Array.isArray(simpan[KUNCI_RIWAYAT]) ? simpan[KUNCI_RIWAYAT] : [];
    daftar.unshift(catatan);
    await chrome.storage.local.set({ [KUNCI_RIWAYAT]: daftar.slice(0, BATAS_RIWAYAT) });
  } catch {
    /* penyimpanan tidak tersedia - perubahannya tetap tersimpan di ABT */
  }

  try {
    await fetch(ALETA_API_RIWAYAT, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(catatan),
    });
  } catch {
    /* jejak pengawasan tertinggal - salinan lengkapnya ada di peramban */
  }
}

/**
 * Riwayat satu perkara, dari kedua tempat sekaligus.
 *
 * Digabung supaya jejak yang dicatat dari peramban LAIN - atau yang sudah
 * terhapus dari peramban ini - tetap terlihat. Yang dari peramban tetap
 * didahulukan pada baris yang sama, sebab hanya ia yang isinya utuh dan hanya
 * ia yang dapat diurungkan.
 */
async function bacaRiwayat(perkaraId) {
  let lokal = [];
  try {
    const simpan = await chrome.storage.local.get([KUNCI_RIWAYAT]);
    const daftar = Array.isArray(simpan[KUNCI_RIWAYAT]) ? simpan[KUNCI_RIWAYAT] : [];
    lokal = daftar.filter((x) => x && x.perkaraId === perkaraId);
  } catch {
    lokal = [];
  }

  let jauh = [];
  try {
    const respons = await fetch(
      `${ALETA_API_RIWAYAT}?perkaraId=${encodeURIComponent(String(perkaraId))}`,
      { credentials: "include", cache: "no-store" }
    );
    if (respons.ok) {
      const luar = await respons.json();
      const isi = luar && luar.data ? luar.data : luar;
      jauh = Array.isArray(isi && isi.daftar) ? isi.daftar : [];
    }
  } catch {
    jauh = [];
  }

  // Dikenali dari waktu dan variabelnya - itulah yang sama pada kedua
  // salinan satu perubahan. Id peladen tidak ada pada salinan peramban, jadi
  // memakainya sebagai pengenal akan menggandakan seluruh baris.
  const sudah = new Set(lokal.map((x) => `${x.pada}|${x.kode}`));
  const gabung = lokal.slice();

  // ==========================================================================
  // JEJAK LENGKAP DARI SERVER (rantai C, C1 = U6) - SAKLAR "jejak-isian", BAWAAN MATI
  // ==========================================================================
  //
  // Bila saklar menyala, server menyimpan nilai SEBELUM yang utuh (aleta_isian_jejak), sehingga perubahan yang dibuat di PC lain tetap
  // dapat diurungkan dari PC ini (dengan konfirmasi). Saklar mati / gagal bertanya: tidak ada tambahan apa pun, daftar seperti dulu.
  // Catatan yang sama dengan salinan peramban (kode sama, waktu sama atau berselisih <= 15 detik dengan isi akhir sama) tidak digandakan.
  let lengkap = [];
  try {
    const J = globalThis.AletaJejakIsian;
    if (J && typeof J.jejakPerkara === "function") lengkap = (await J.jejakPerkara(perkaraId)).map((b) => J.keRiwayat(b));
  } catch {
    lengkap = [];
  }
  const serupa = (a, b) => {
    if (String(a.kode) !== String(b.kode)) return false;
    if (a.pada === b.pada) return true;
    const selisih = Math.abs(new Date(a.pada).getTime() - new Date(b.pada).getTime());
    return Number.isFinite(selisih) && selisih <= 15000 && String(a.sesudah || "").replace(/\s+/g, " ").trim().toLowerCase() === String(b.sesudah || "").replace(/\s+/g, " ").trim().toLowerCase();
  };
  for (const satu of lengkap) {
    if (gabung.some((x) => serupa(x, satu))) continue;
    sudah.add(`${satu.pada}|${satu.kode}`);
    gabung.push(satu);
  }

  for (const satu of jauh) {
    if (lengkap.length && gabung.some((x) => x.dariServerLengkap && serupa(x, satu))) continue;
    const kunci = `${satu.pada}|${satu.kode}`;
    if (sudah.has(kunci)) continue;
    sudah.add(kunci);
    // Ditandai supaya terlihat bahwa ia tidak dapat diurungkan dari sini:
    // isinya mungkin dipotong, dan salinan lengkapnya ada di peramban lain.
    gabung.push({ ...satu, dariPeladen: true });
  }

  gabung.sort((a, b) => String(b.pada || "").localeCompare(String(a.pada || "")));
  return gabung;
}

/**
 * ============================================================================
 * PENANDA TIGA BERKAS DI SAMPING TOMBOL CETAK
 * ============================================================================
 *
 * Saklarnya ada di popup ikon ekstensi - satu jendela yang hampir tidak
 * pernah dibuka. Akibatnya keadaannya tidak dapat diketahui dari halaman
 * tempat tombolnya ditekan: yang menekan CETAK tidak tahu apakah ia akan
 * mendapat satu berkas atau tiga sampai berkasnya benar-benar turun.
 *
 * Untuk tombol yang mengubah arti tombol milik aplikasi lain, itu terbalik.
 * Keadaannya harus terbaca DI SEBELAH tombolnya, sebelum ditekan.
 *
 * Penandanya hanya digambar ketika saklarnya MENYALA. Penanda yang selalu
 * ada - menyala atau tidak - menuntut orang membaca tulisannya untuk tahu
 * keadaannya, dan itu satu langkah lebih banyak daripada yang diperlukan.
 */
const KELAS_PENANDA_CETAK = "aleta-cetak-tiga";

function segarkanPenandaCetak() {
  // F1.5 (17 Okt): label tombol Cetak panel ikut saklar tiga berkas.
  if (typeof f15SegarkanLabel === "function") f15SegarkanLabel();
  for (const tautan of Array.from(document.querySelectorAll('a[href*="abt/preview"]'))) {
    const induk = tautan.parentElement || tautan;
    let tanda = induk.querySelector("." + KELAS_PENANDA_CETAK);

    if (!cetakTigaMenyala) {
      if (tanda) tanda.remove();
      continue;
    }
    if (tanda) continue;

    tanda = buatElemen("span", KELAS_PENANDA_CETAK);
    tanda.title =
      "ALETA aktif: satu tekanan CETAK menerbitkan tiga berkas - putusan .rtf, " +
      "PDF hasil konversi, dan anonim .rtf. Matikan dari popup ikon ALETA.";
    // Angka 3 dan lambang berkas: dibaca dalam sekejap, tanpa membaca kata.
    tanda.appendChild(buatElemen("span", "aleta-cetak-tiga-angka", "3"));
    tanda.appendChild(buatElemen("span", "aleta-cetak-tiga-ikon", "🗎"));
    // Disisipkan SESUDAH tautannya, bukan di dalamnya: menyisipkan anak ke
    // dalam tautan CETAK membuat tekanan pada penandanya ikut mencetak.
    if (tautan.nextSibling) induk.insertBefore(tanda, tautan.nextSibling);
    else induk.appendChild(tanda);
  }
}

async function mintaUsulan(muatan) {
  // C5/U9 (25 Okt 2026): saklar Fitur Satker "fakta-non-cerai" (bawaan MATI; gagal bertanya = mati) meminta bot juga membaca
  // 2557/2558 (berapa kali saksi melihat/mendengar pertengkaran) dari BAS yang sudah tersimpan. Mati = muatan persis seperti dulu.
  let muatanKirim = muatan;
  if (muatan && (muatan.sumber === "sipp" || muatan.sumber === "semua") && globalThis.AletaSaklarFitur) {
    try {
      if (await globalThis.AletaSaklarFitur.aktif("fakta-non-cerai")) muatanKirim = { ...muatan, kaliPertengkaranBas: true };
    } catch {
      /* tanpa saklar: muatan lama */
    }
  }
  const respons = await alatAmbil(ALETA_API_ABT, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(muatanKirim),
  }, "Membaca usulan");
  if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Membaca usulan"));
  const luar = await respons.json();
  const isi = luar?.data ?? luar;
  if (!isi?.available) throw new Error(isi?.message || alatPesanGagal(null, 0, "Membaca usulan"));
  // Keterangan perkara ditumpangkan pada jawaban ini sejak 2.20.4 - jenis
  // perkara dan status putusannya, yang menyusun nama berkas. Diingat di sini,
  // pada satu tempat yang dilewati SELURUH pemanggil, bukan di tiap pemanggil.
  ingatKeteranganPerkara(muatan?.nomorPerkara, isi?.sipp?.keteranganPerkara);
  return isi;
}

/**
 * Menyimpan jenis perkara dan status putusan satu perkara.
 *
 * Tidak menimpa dengan yang KOSONG: papan massal mengisinya dari daftar
 * sidang, dan permintaan usulan atas perkara yang belum putus tidak boleh
 * menghapus status yang sudah terbaca di sana.
 */
function ingatKeteranganPerkara(nomorPerkara, keterangan) {
  const nomor = String(nomorPerkara || "").trim();
  if (!nomor || !keterangan) return;
  const lama = statusPutusanPerkara.get(nomor) || {};
  statusPutusanPerkara.set(nomor, {
    jenisPerkara: String(keterangan.jenisPerkara || "").trim() || lama.jenisPerkara || "",
    statusPutusan: String(keterangan.statusPutusan || "").trim() || lama.statusPutusan || "",
    verstek: keterangan.verstek === undefined ? Boolean(lama.verstek) : Boolean(keterangan.verstek),
  });
}

/**
 * ============================================================================
 * PITA IDENTITAS PANEL ABT - SAMA BENTUKNYA DENGAN PANEL SIPP
 * ============================================================================
 *
 * Yang diminta petugas: siapa yang masuk ALETA, nomor perkara, jenis perkara,
 * dan seri ekstensi terbaca di kepala DAN di kaki, pada letak dan huruf yang
 * sama di panel mana pun - termasuk panel blangko ABT ini. Kelas dan urutannya
 * persis milik konten.js (pitaIdentitas); yang berbeda hanya sumbernya:
 * halaman ABT tidak menulis akun SIPP di mana pun, jadi ruas itu tidak ada.
 *
 * Nama pengguna ALETA datang dari portal dan datangnya menyusul; pita digambar
 * dulu tanpa nama, lalu digambar ulang begitu jawabannya tiba. Panel tidak
 * menunggu jaringan hanya untuk menuliskan satu nama.
 */
let penggunaAletaAbt = null;
/**
 * Kemampuan ekstensi yang diberikan portal kepada orang ini.
 *
 * Dipakai menyembunyikan tombol yang akan ditolak. Itu KENYAMANAN, bukan
 * penjagaan - rutenya memeriksa ulang sendiri, dan harus, sebab berkas ini
 * berjalan di peramban petugas dan dapat diubah siapa saja yang memasangnya.
 *
 * Selama jawabannya belum tiba, tombolnya dibiarkan tampak. Menyembunyikannya
 * lebih dulu lalu memunculkannya membuat panel berkedip pada setiap pemuatan
 * bagi orang yang justru berwenang - yaitu hampir semua orang yang membuka
 * halaman blangko.
 */
let kapabilitasAletaAbt = null;

async function muatPenggunaAleta() {
  if (penggunaAletaAbt) return penggunaAletaAbt;
  try {
    const isi = await mintaUsulan({ nomorPerkara: nomorPerkaraAbt(), sumber: "siapa" });
    penggunaAletaAbt = isi && isi.pengguna && isi.pengguna.nama ? isi.pengguna : null;
    kapabilitasAletaAbt = (isi && isi.kapabilitas) || null;
    /* === HAK-PERAN 12 Okt === */
    // Golongan menu dari matriks peran portal - soreMenuPeran memanggil
    // alatMenuPeran dengan NAMA peran, jadi golongannya diingat di panel-alat.
    if (penggunaAletaAbt && typeof alatSetelGolonganServer === "function") alatSetelGolonganServer(penggunaAletaAbt.golonganMenu);
    /* === AKHIR HAK-PERAN === */
  } catch {
    penggunaAletaAbt = null;
  }
  return penggunaAletaAbt;
}

const DAFTAR_ALASAN_SDG = [
  "perselisihan terus-menerus",
  "kekerasan dalam rumah tangga",
  "tidak memberi nafkah",
  "pihak lain (wanita/pria idaman lain)",
  "cemburu",
  "obat terlarang",
  "judi",
  "mabuk",
  "murtad/pindah agama",
  "temperamental",
  "berkata kasar",
  "bersikap kasar",
  "malas bekerja",
  "tidak memiliki pekerjaan tetap",
  "masalah ekonomi",
  "menikah lagi",
];

/**
 * ============================================================================
 * PILIHAN ALASAN SAKSI - DARI PORTAL, DENGAN CADANGAN ENAM BELAS TERTANAM
 * ============================================================================
 *
 * Daftar bas.saksi.alasan-pilihan dapat ditambah admin di portal (zina,
 * pidana penjara, cacat badan, pelanggaran taklik talak - ciri yang bot sudah
 * kenal). DAFTAR_ALASAN_SDG di atas tetap cadangan terakhir: portal mati dan
 * singgahan kosong berarti perilakunya sama persis dengan sebelum portal ada.
 * Nilainya dicerminkan portal (bawaan-ekstensi.ts) - jangan disunting tanpa
 * menyunting cerminnya.
 *
 * Yang dikirim ke bot KUNCI cirinya; labelnya hanya untuk dibaca petugas.
 *
 * @returns {Promise<{pilihan: {kunci: string, label: string}[], asal: string}>}
 */
async function muatAlasanSdg() {
  const tertanam = DAFTAR_ALASAN_SDG.map((a, urutan) => ({ kunci: a, nilai: a, data: {}, urutan, asal: "bawaan", sidik: "" }));
  const hasil = await alatTipeKeluaran("bas.saksi.alasan-pilihan", { tertanam });
  const pilihan = [];
  const sudah = new Set();
  for (const e of hasil.entri) {
    const kunci = String(e.kunci || "").trim();
    if (!kunci || sudah.has(kunci)) continue;
    sudah.add(kunci);
    pilihan.push({ kunci, label: String(e.nilai || "").trim() || kunci });
  }
  return { pilihan, asal: hasil.asal };
}

/**
 * Sebutan pihak yang bercerita kepada saksi, dari sebutan blangko ini sendiri.
 * pelaku = 0047 = Tergugat/Termohon; lawan = 0046 = Penggugat/Pemohon.
 */
function sebutanSumberSdg(kode, pelaku, lawan) {
  if (kode === "keluarga") return "keluarga mereka";
  if (kode === "tergugat") return String(pelaku || "").trim() || "Tergugat";
  return String(lawan || "").trim() || "Penggugat";
}

/**
 * Nama jenis perkara SIPP (perkara.jenis_perkara_nama, variabel 0048) -> id.
 * Dibaca 26 September 2026 dengan SELECT DISTINCT atas sipp_donggala dan
 * sipp. Bentuk bersyarat (data.syarat.jenisPerkaraId) dan perkara lain
 * (abtUsulanLainService.kenaliJenis) membandingkan ID, bukan nama.
 */
const ID_JENIS_PERKARA_SIPP = Object.freeze({
  "izin poligami": "341",
  "pencegahan perkawinan": "342",
  "penolakan perkawinan": "343",
  "pembatalan perkawinan": "344",
  "cerai talak": "346",
  "cerai gugat": "347",
  "harta bersama": "348",
  "penguasaan anak": "349",
  "pengesahan anak": "352",
  "kelalaian atas kewajiban suami / istri": "345",
  "hak - hak bekas istri/kewajiban bekas suami": "351",
  "perkawinan campuran": "359",
  "izin kawin": "361",
  perwalian: "354",
  "asal usul anak": "358",
  "istbat nikah": "360",
  "pengesahan perkawinan/istbat nikah": "360",
  "dispensasi kawin": "362",
  "wali adhol": "363",
  kewarisan: "364",
  wasiat: "365",
  hibah: "366", // I28 18 Okt
  wakaf: "367",
  // W3b 21 Okt: blangko Derry baru gelombang 3.
  "nafkah anak oleh ibu karena ayah tidak mampu": "350",
  "pencabutan kekuasaan orang tua": "353",
  "pencabutan kekuasaan wali": "355",
  "penunjukan orang lain sebagai wali oleh pengadilan": "356",
  "ganti rugi terhadap wali": "357",
  "lain-lain": "369",
  "lain-lain *)": "369",
  "ekonomi syariah": "370",
  "p3hp/penetapan ahli waris": "371",
  "nafkah anak pasca perceraian": "743",
});

/** Id jenis perkara SIPP dari namanya; nama apa adanya bila tidak dikenal. */
function idJenisPerkaraSipp(nama) {
  const bersih = String(nama || "").replace(/\s+/g, " ").trim();
  return ID_JENIS_PERKARA_SIPP[bersih.toLowerCase()] || bersih;
}

/** alur_perkara_id SIPP dari nomor perkara: 15 gugatan, 16 permohonan, 17 gugatan sederhana. */
function idAlurPerkaraSipp(nomor) {
  const teks = String(nomor || "");
  if (/Pdt\.G\.S\b/i.test(teks)) return "17";
  if (/Pdt\.G\b/i.test(teks)) return "15";
  if (/Pdt\.P\b/i.test(teks)) return "16";
  return "";
}

/**
 * Nilai variabel 1268 yang layak dikirim sebagai upayaDamai (butir 28).
 * ABT menulis "DATA_TIDAK_ADA" untuk variabel yang kuerinya tidak menemukan
 * apa-apa; itu, isian tanpa huruf ("...", "_"), dan variabel yang belum
 * terganti ("#1268#") bukan keterangan - dikirim kosong supaya bot memakai
 * sumber berikutnya.
 */
function nilaiUpayaDamai(nilai) {
  const t = String(nilai == null ? "" : nilai).trim();
  if (!t || /DATA_TIDAK_ADA/i.test(t)) return "";
  if (!/[A-Za-z]/.test(t.replace(/#\d{4}#/g, ""))) return "";
  return t;
}
/* === AKHIR PSAKSI === */

/**
 * Muatan permintaan 'saksi-sdg' (K6). Fungsi murni - diuji langsung.
 *
 *   saksi  [{pihak 'P'|'T', ke, modus, sumber, alasan[]}] dalam urutan borang
 *
 * sumberNama selalu ikut, untuk ketiga pilihan pencerita: sebutan yang
 * sungguh tertulis di blangko ini, supaya bot tidak menafsirkan kode.
 * modus.saksi1/saksi2 tetap dikirim untuk bot lama yang belum mengenal saksi[].
 */
function susunMuatanSdg(o) {
  const r = o && typeof o === "object" ? o : {};
  const saksi = (Array.isArray(r.saksi) ? r.saksi : []).map((s) => ({
    ke: Number(s.ke),
    pihak: s.pihak === "T" ? "T" : "P",
    modus: String(s.modus || "sama"),
    sumber: String(s.sumber || "penggugat"),
    sumberNama: sebutanSumberSdg(String(s.sumber || "penggugat"), r.pelaku, r.lawan),
    alasan: Array.isArray(s.alasan) ? s.alasan.map(String) : [],
  }));
  const polos = (s) => (s ? { modus: s.modus, sumber: s.sumber, sumberNama: s.sumberNama, alasan: s.alasan } : undefined);
  const saksiP = saksi.filter((s) => s.pihak === "P");
  return {
    nomorPerkara: String(r.nomorPerkara || ""),
    sumber: "saksi-sdg",
    templat: Array.isArray(r.templat) ? r.templat : [],
    kodeKumpulan: String(r.kodeKumpulan || ""),
    jenisPerkara: String(r.jenisPerkara || ""),
    alur: String(r.alur || ""),
    alasan: Array.isArray(r.alasan) ? r.alasan : [],
    posita: String(r.posita || ""),
    pelaku: String(r.pelaku || ""),
    lawan: String(r.lawan || ""),
    // Butir 28: nilai variabel 1268 (Upaya Damai Keluarga) - sumber pertama
    // jawaban pertanyaan upaya rukun. Ruasnya hanya ikut bila berisi, supaya
    // muatan tampilan Lama tetap persis seperti sebelumnya; tanpa ruas ini bot
    // membaca posita lalu mediasi SIPP.
    ...(nilaiUpayaDamai(r.upayaDamai) ? { upayaDamai: nilaiUpayaDamai(r.upayaDamai) } : {}),
    modus: { saksi1: polos(saksiP[0] || saksi[0]), saksi2: polos(saksiP[1] || saksi[1]) },
    saksi,
  };
}

/**
 * 21 Okt (x6): kalimat penutup pemeriksaan saksi ("Sudah cukup;" jawaban atas "Apakah masih ada yang ingin
 * Saudara sampaikan?") tidak pernah ikut tertulis ke ABT. Templat ABT membawanya sebagai jawaban bawaan di
 * SETIAP kumpulan (04, A1, DK1, ...), jadi "Susun keterangan saksi" yang memuat templat lalu menyimpan
 * semua barisnya menulis "Sudah cukup;" ke abt_keterangan_saksi - dan ABT mencetaknya di putusan dan BAS.
 * Baris yang jawabannya SELURUHNYA penutup dibuang (pertanyaan ikut hilang, sama seperti Rapikan); jawaban
 * yang hanya SEBAGIAN barisnya penutup dipotong; selebihnya tidak disentuh. Nomor dihitung ulang.
 *
 * @param baris [{no, tanya, jawab}]
 * @returns {{baris: Array, dibuang: number}}
 */
function saringBarisPenutup(baris) {
  const hasil = [];
  let dibuang = 0;
  for (const x of Array.isArray(baris) ? baris : []) {
    const asli = String((x && x.jawab) || "");
    if (!asli.trim()) {
      hasil.push(x);
      continue;
    }
    const bersih = bersihkanKeteranganSaksi(asli, String((x && x.tanya) || ""));
    if (!bersih.trim()) {
      dibuang += 1;
      continue;
    }
    const berubah = bersih.replace(/\s+/g, " ") !== asli.replace(/\s+/g, " ").trim();
    hasil.push(berubah ? { ...x, jawab: bersih } : x);
  }
  if (dibuang > 0) return { baris: hasil.map((x, i) => ({ ...x, no: String(i + 1) })), dibuang };
  return { baris: hasil, dibuang };
}

// ─── Pemasangan ──────────────────────────────────────────────────────────────

async function sedangAktif() {
  try {
    const simpan = await chrome.storage.local.get(["aktif"]);
    return simpan.aktif !== false;
  } catch {
    return true;
  }
}

let sudahDipasang = false;

/**
 * Penunjuk yang menentukan di halaman ABT.
 *
 * Halaman blangko dan halaman tanya-jawab memakai kerangka yang sama, jadi
 * yang wajib hanya kerangkanya; sisanya ditandai menurut halamannya.
 */
alatDaftarkanPenunjuk("Kerangka ABT", ["#wrapper", "#content"], { wajib: true });
alatDaftarkanPenunjuk("Menu ABT", ["#cssmenu"], { wajib: true });
alatDaftarkanPenunjuk("Daftar blangko", [".pricing-top", ".pricing_inner_w3ls"], { wajib: false, saat: "halaman blangko" });
alatDaftarkanPenunjuk("Blangko tanya-jawab", ["#tanyajawab", "table.tabel_tanyajawab", "form"], { wajib: false, saat: "halaman tanya-jawab" });

/**
 * Uji 9 Okt: halaman blangko yang dihentikan ABT sendiri - die("<h3>ERROR
 * Variabel #x#</h3>...") - tidak punya tabel, jadi panel tidak lahir dan
 * petugas hanya melihat pesan SQL. Di satker 5 perkara sudah begitu karena
 * isian berpetik (0156 -> 7080 pada 4 perkara, 1214 -> 8529 pada 1 perkara).
 * Yang dikerjakan HANYA menerangkan sebabnya di atas pesan itu - tidak ada
 * yang ditulis ke ABT.
 */
function a3TerangkanHalamanGalat() {
  if (!document.body || document.getElementById("aleta-abt-galat-variabel")) return false;
  if (document.querySelector("#wrapper table td[id]")) return false;
  const teks = String(document.body.textContent || "").slice(0, 6000);
  const m = teks.match(/ERROR\s+Variabel\s*#(\d{3,5})#/i);
  if (!m) return false;
  const kotak = buatElemen("div", "aleta-abt-galat-variabel");
  kotak.id = "aleta-abt-galat-variabel";
  kotak.setAttribute("role", "alert");
  kotak.style.cssText =
    "margin:12px;padding:12px 14px;border:2px solid #b91c1c;border-radius:8px;background:#fef2f2;color:#7f1d1d;font:14px/1.5 system-ui,sans-serif;max-width:860px";
  kotak.appendChild(buatElemen("strong", "", "ALETA: halaman blangko ini dihentikan ABT"));
  kotak.appendChild(buatElemen("div", "", a3SebabBukanAbt(teks)));
  kotak.appendChild(
    buatElemen(
      "div",
      "",
      `Cari isian (data teks) yang dirujuk kueri #${m[1]} dan memuat petik ' atau " - mis. nama kantor kuasa "Partner's" ` +
        `atau nama "Assa'" - lalu ganti petiknya dengan ’ lewat menu edit variabel ABT (atau minta admin ABT). ` +
        "Sesudah itu muat ulang halaman ini."
    )
  );
  document.body.insertBefore(kotak, document.body.firstChild);
  return true;
}

async function pasang() {
  if (sudahDipasang) return;
  const diTanyaJawab = halamanTanyaJawab();
  if (!halamanBlangko() && !diTanyaJawab) {
    try {
      if (/\/abt\//i.test(location.pathname) && (await sedangAktif())) a3TerangkanHalamanGalat();
    } catch {
      /* penerang saja - gagal tidak mengubah apa pun */
    }
    return;
  }
  if (!(await sedangAktif())) return;

  // Di halaman tanya-jawab tidak ada satu pun tautan load_form, jadi jati diri
  // perkaranya tidak dapat dibaca dari sana. Ia tidak diperlukan di situ:
  // penyusun keterangan saksi menulis lewat rute tanya-jawab ABT, yang
  // alamatnya dibaca dari alamat halaman ini sendiri (lihat ruasAlamatAbt).
  const jatiDiri = jatiDiriPerkara() || (diTanyaJawab ? { perkaraId: "", perkTemp: "" } : null);
  if (!jatiDiri) return;

  if (!(await pastikanModulAbt("abt-blangko"))) return; // K11-GUARD
  if (sudahDipasang) return; // K11-GUARD: dipasang pemanggil lain selagi modul dimuat
  sudahDipasang = true;
  // Saklar cetak dibaca SEKALI seumur halaman: ia memasang pendengar
  // chrome.storage sendiri, dan memanggilnya lagi saat panel dibangun ulang
  // berarti dua pendengar yang mengerjakan hal yang sama pada tiap perubahan.
  if (!saklarCetakDibaca) {
    saklarCetakDibaca = true;
    await muatSaklarCetak();
    await muatTataSaksi();
    await p6MuatGaya(); // P5P6 10 Okt - gaya paragraf saksi
  }
  pasangSunting(jatiDiri);
  const panel = susunPanelAbt(jatiDiri);
  document.body.appendChild(panel);
  // F1.5 (17 Okt): gembok "Ringkas otomatis" tepat di bawah kepala - sama
  // dengan panel SIPP. Dipasang SESUDAH panel masuk halaman: pemeriksa
  // ringkasnya berhenti sendiri bila panel belum tersambung. Lama: null.
  if (typeof alatPasangGembok === "function") alatPasangGembok(panel, panel.querySelector(":scope > .aleta-kepala"), "abt");
  pasangPenjagaCetak(jatiDiri, panel.lapor);
  // Tahap 6: menata panel yang sudah jadi. Dalam tampilan Lama hanya mencatat
  // tanda tampilannya di luar DOM, lalu pulang - lihat blok TAHAP 6.
  t6TataAman(panel, jatiDiri);
  // Perbaikan 30 Sep sore (Baru & UI Baru): menunggu Tahap 6 selesai menata.
  soreTataAman(panel, jatiDiri);
}

let saklarCetakDibaca = false;

/**
 * Membuang kedua panel ABT - panel blangko dan panel putusan massal di
 * halaman depan - beserta penandanya, sehingga keduanya benar-benar dapat
 * dibangun ulang. Penanda yang tertinggal menyala membuat pasang() keluar
 * pada baris pertamanya, dan panelnya tidak pernah kembali.
 */
function buangPanelAbt() {
  for (const panel of Array.from(document.querySelectorAll(".aleta-panel-abt"))) {
    panel.remove();
  }
  sudahDipasang = false;
  sudahDipasangMassalAbt = false;
}

// Saklar dari popup ikon Chrome berlaku seketika di halaman ABT juga.
try {
  chrome.storage.onChanged.addListener((ubah, tempat) => {
    if (tempat !== "local" || !ubah.aktif) return;
    if (ubah.aktif.newValue === false) {
      buangPanelAbt();
      return;
    }
    void pasang();
    void pasangMassalAbt();
  });
} catch {
  /* di luar konteks ekstensi */
}

// Halaman ABT tahu alamat portalnya sendiri - dan petugas yang seharian di
// sini tidak pernah membuka SIPP.
alatCatatAsalPortal();
/**
 * ============================================================================
 * TOMBOL CETAK MILIK ABT SENDIRI MENGHASILKAN "download.rtf"
 * ============================================================================
 *
 * Tiga berkas yang diterbitkan panel sudah bernama nomor perkara. Yang tidak:
 * unduhan dari tombol CETAK milik ABT. Rutenya menjawab tanpa nama berkas yang
 * masuk akal, sehingga Chrome menamainya "download.rtf", "download.pdf",
 * "download (1).rtf" - dan folder unduhan petugas penuh berkas bernama sama
 * yang tidak dapat dibedakan tanpa dibuka satu per satu.
 *
 * ABT tidak dapat diubah dari sini. Yang dapat dikerjakan: memberitahu pekerja
 * latar perkara apa yang sedang terbuka, lalu membiarkannya menamai unduhan
 * bernama umum yang datang dari ABT. Lihat latar.js.
 *
 * Dikirim saat halaman dibuka DAN disegarkan selama petugas masih mengerjakan
 * halaman itu - bukan pada tiap unduhan, sebab unduhan ABT tidak melewati
 * skrip ini sama sekali.
 *
 * Penyegaran itu yang membuat umur lima menit berarti "lima menit sejak
 * terakhir Anda menyentuh halaman ini", bukan "lima menit sejak halaman
 * dibuka". Yang kedua hampir selalu sudah lewat ketika CETAK ditekan:
 * petugas membuka perkara, membaca, menyiapkan blangko, baru mencetak.
 */
function kabarkanKonteksUnduh() {
  const nomor = nomorPerkaraAbt();
  if (!nomor) return;
  try {
    chrome.runtime.sendMessage(
      {
        sumber: "aleta-panel",
        jenis: "konteks-unduh",
        nomor,
        // Dua medan yang menyusun nama berkas, bukan lagi potongan kepala
        // halaman: jenis perkara dan status putusan. Keduanya kosong bila
        // perkaranya belum dikenal - dan nama yang pendek lebih baik daripada
        // nama yang mengarang.
        jenisPerkara: sebutJenisPerkara(nomor),
        statusPutusan: sebutStatusPutusan(nomor),
      },
      () => void chrome.runtime.lastError
    );
  } catch {
    // Pekerja latar sedang tidur atau ekstensi baru dimuat ulang - unduhannya
    // tetap tersimpan, hanya namanya yang tidak berubah.
  }
}

/**
 * ============================================================================
 * DIDEKLARASIKAN DI SINI, DI ATAS PEMANGGILNYA - DAN ITU BUKAN KERAPIAN
 * ============================================================================
 *
 * Dahulu ia berdiri tepat di atas pasangMassalAbt, ratusan baris DI BAWAH
 * pemanggilan ini. Deklarasi `function` terangkat ke atas sehingga
 * pasangMassalAbt sudah dapat dipanggil dari sini; deklarasi `let` TIDAK - ia
 * ada tetapi belum boleh disentuh sampai barisnya sendiri dijalankan.
 *
 * Dan baris pertama pasangMassalAbt justru membacanya:
 *
 *     Uncaught (in promise) ReferenceError:
 *     Cannot access 'sudahDipasangMassalAbt' before initialization
 *
 * Fungsinya async, tetapi badannya berjalan serempak sampai await pertama, dan
 * pembacaan itu ada sebelum await mana pun - jadi ia meledak seketika.
 *
 * Panelnya tetap muncul, dan itulah yang membuatnya tidak pernah terlihat:
 * gelung ulangan di bawah memanggilnya lagi, dan pada panggilan kedua barisnya
 * sudah lewat. Yang tersisa satu error di chrome://extensions tiap halaman ABT
 * dibuka - tanpa satu pun gejala di layar.
 *
 * Itu yang berbahaya. Lencana merah Chrome yang selalu menyala membuat error
 * SUNGGUHAN berikutnya tenggelam; tidak ada yang membuka daftar yang memang
 * selalu merah.
 */
let sudahDipasangMassalAbt = false;

void pasang();
void pasangMassalAbt();
kabarkanKonteksUnduh();

// ==========================================================================
// DISEGARKAN OLEH KEHADIRAN PETUGAS, BUKAN OLEH JAM
// ==========================================================================
//
// Tiap sentuhan pada halaman ini menyegarkan konteksnya, dibatasi sekali tiap
// sepuluh detik supaya tidak menghujani pekerja latar. Yang dipakai peristiwa
// pointerdown - ia mendahului "click", sehingga konteksnya sudah tersimpan
// sebelum tombol CETAK milik ABT sempat menerbitkan unduhannya.
//
// Kembali ke tab ini pun menyegarkan: petugas kerap membuka SIPP di tab lain,
// lalu kembali ke ABT untuk mencetak.
const JEDA_SEGAR_KONTEKS_MS = 10 * 1000;
let segarTerakhir = 0;
function segarkanKonteksUnduh() {
  const sekarang = Date.now();
  if (sekarang - segarTerakhir < JEDA_SEGAR_KONTEKS_MS) return;
  segarTerakhir = sekarang;
  kabarkanKonteksUnduh();
}
document.addEventListener("pointerdown", segarkanKonteksUnduh, true);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") segarkanKonteksUnduh();
});

// ABT memuat sebagian isinya menyusul. Diperiksa beberapa kali, lalu berhenti -
// pengamat yang hidup selamanya pada halaman yang tidak pernah berubah hanya
// menambah kerja tanpa menambah apa pun.
let percobaan = 0;
const jeda = setInterval(() => {
  percobaan += 1;
  void pasang();
  void pasangMassalAbt();
  if ((sudahDipasang && sudahDipasangMassalAbt) || percobaan > 10) clearInterval(jeda);
}, 700);

/*
 * ============================================================================
 * PUTUSAN MASSAL DI ABT - DARI JADWAL SIDANG KE TIGA BERKAS PER PERKARA
 * ============================================================================
 *
 * Halaman blangko ABT (beranda dan daftar per kelompok) selama ini tidak
 * punya panel ALETA sama sekali - panel hanya muncul di halaman variabel satu
 * perkara. Di sinilah pekerjaan massalnya duduk, sebab di sinilah token
 * blangko (a/b) dirender ABT, dan hanya dari halaman ini token itu dapat
 * dibaca tanpa menebak.
 *
 * Alurnya per perkara, berurutan:
 *
 *   RTF     GET  abt/preview?a=&b=&c=<perkara_id>         - ABT mengisi blangko
 *   draf    POST /putusan/unggah-naskah                    - ALETA memotong amar
 *   anonim  POST abt/main/anonim   (bila diunggah/diunduh) - ABT menyamarkan nama
 *   PDF     POST /aleta-bot/abt/pdf (hanya bila diunduh)   - bot (soffice)
 *   SIPP    POST /putusan/unggah-sipp   (bila diminta)     - RTF putusan dan RTF
 *           anonimisasinya dalam satu kiriman
 *
 * TIDAK ADA LAGI KERJA YANG HASILNYA DIBUANG. Sampai 1.167 setelan bawaannya
 * (unggah mati) tetap membuat PDF, anonim, dan PDF anonim - tiga dari lima
 * permintaan per perkara - lalu tidak memakai satu pun, sementara ringkasannya
 * berbunyi "PDF ok · anonim ok". Dan unggah ke SIPP menuntut PDF, padahal
 * 87,7% e-Doc satker berbentuk RTF dan rute unggah-sipp menerima RTF:
 * mematikan PDF membuat unggahannya dilewati ("tidak ada PDF").
 *
 * Satu perkara gagal TIDAK menghentikan sisanya: tiap perkara berdiri
 * sendiri, dan yang gagal dicatat sebabnya di neraca. Ini beda dengan
 * penetapan massal, yang memang berantai.
 *
 * Tidak ada yang tercentang sendiri. Agenda sidang menyodorkan kandidat;
 * yang memutuskan orang.
 */
const PENANDA_MASSAL_ABT = "aleta-panel-abt-massal";

/** Halaman daftar blangko ABT: ada bilah kelompok di kiri dan kartu berkas di kanan. */
function halamanBerandaAbt() {
  if (halamanBlangko() || halamanTanyaJawab()) return false;
  return Boolean(document.querySelector("#navbar .accordion")) && Boolean(document.querySelector(".pricing_inner_w3ls"));
}

/** Nama pengguna ABT yang sedang masuk - dipakai sebagai olehUsername unggahan. */
function namaPenggunaAbt() {
  const b = document.querySelector("#header .h_right b, .h_right b");
  return b ? String(b.textContent || "").replace(/\s+/g, " ").trim() : "";
}

/**
 * Seluruh berkas blangko yang tergambar di halaman ini, beserta tokennya.
 * Satu kartu = satu blangko; tiap <p><a> di dalamnya = satu berkas RTF.
 */
function berkasBlangkoDiHalaman() {
  const hasil = [];
  for (const kartu of Array.from(document.querySelectorAll(".pricing_inner_w3ls"))) {
    const judul = kartu.querySelector(".pricing-top h3");
    const blangko = judul ? String(judul.textContent || "").replace(/\s+/g, " ").trim() : "";
    if (!blangko) continue;
    for (const tautan of Array.from(kartu.querySelectorAll(".pricing-bottom-bottom a[onclick], .pricing-bottom-bottom a[href*='abt/preview']"))) {
      const token = alatTokenDariTautan(tautan);
      if (!token || !token.a || !token.b) continue;
      const span = tautan.querySelector("span");
      const berkas = String((span || tautan).textContent || "").replace(/^#\s*/, "").replace(/\s+/g, " ").trim();
      if (!berkas) continue;
      hasil.push({ blangko, berkas, a: token.a, b: token.b, d: token.d || "", elemen: tautan });
    }
  }
  return hasil;
}

async function pasangMassalAbt() {
  if (sudahDipasangMassalAbt) return;
  if (!halamanBerandaAbt()) return;
  if (!(await sedangAktif())) return;
  // 1.183.0: submenu berkas yang diklik, untuk mengenali jenis blangko.
  a3CatatMenuBlangko();
  if (!(await pastikanModulAbt("abt-beranda"))) return; // K11-GUARD
  if (sudahDipasangMassalAbt) return; // K11-GUARD: dipasang pemanggil lain selagi modul dimuat
  sudahDipasangMassalAbt = true;
  await muatPenggunaAleta();
  const panel = await susunPanelMassalAbt();
  document.body.appendChild(panel);
  // Keputusan 17 Okt butir 50-51: panel massal ABT (putusan massal & BAS massal)
  // juga bergembok - arti SAMA dengan SIPP & panel ABT biasa (kunci gembokKepalaAbt):
  // terbuka = meringkas ke kepala saat menutupi tabel dan tidak ditunjuk; terkunci =
  // selalu tampil penuh. Lama: null (tampilan Lama tetap identik).
  if (typeof alatPasangGembok === "function") alatPasangGembok(panel, panel.querySelector(":scope > .aleta-kepala"), "abt");
  // Perbaikan 30 Sep sore (Baru & UI Baru): menu beranda per peran.
  soreTataBerandaAman(panel);
}

/** Kalimat ringkasan bila rute menyamarkan sisa pada salinan anonimisasi ("" bila tidak ada). */
function kalimatSisaDisamarkan(jawab) {
  const d = jawab && jawab.disamarkan;
  if (!d || !(Number(d.jumlah) > 0)) return "";
  const bagian = [];
  if (Number(d.nama) > 0) bagian.push(`${d.nama} sisa nama pihak`);
  if (Number(d.nik) > 0) bagian.push(`${d.nik} NIK`);
  return `ALETA menyamarkan ${bagian.join(" dan ")} yang ditinggalkan ABT pada salinan anonimisasi (putusan asli tidak diubah)`;
}

/* ─── Token blangko dicari menurut NAMA, dari halaman ABT sendiri ──────────
 *
 * Pemetaan boleh datang hanya dengan nama berkas - dari popup, atau dari
 * bawaan cerai. Tokennya dicari di sini, dengan dua langkah yang sama persis
 * seperti yang dilakukan orang: buka bilah kelompok, buka kelompoknya, baca
 * tautan berkasnya. Bedanya, halaman kelompoknya diambil lewat fetch pada
 * asal yang sama (sesi ABT ikut), bukan digambar.
 *
 * Hasilnya disimpan ke pemetaan supaya pencarian berikutnya tidak perlu
 * menyentuh jaringan; dan halaman kelompok yang sudah dibaca disimpan di
 * memori halaman ini supaya dua berkas dari kelompok yang sama hanya
 * mengambil halamannya sekali.
 */
const BATAS_KELOMPOK_DICARI = 60;
const JEDA_ANTAR_KELOMPOK_MS = 250;
const kelompokTerbaca = new Map(); // a kelompok -> daftar berkas terurai

/** Tautan kelompok dari bilah beranda halaman ini, atau dari HTML beranda bila perlu. */
async function daftarKelompokBlangko() {
  const dariHalaman = alatUraiKelompokDariHtml(document.body ? document.body.innerHTML : "");
  if (dariHalaman.length > 0) return dariHalaman;
  const respons = await fetch(`${asalAbt()}/main/beranda`, { credentials: "include", cache: "no-store" });
  if (!respons.ok) throw new Error(`ABT menjawab ${respons.status} saat membaca bilah kelompok`);
  return alatUraiKelompokDariHtml(await respons.text());
}

async function berkasDalamKelompok(kelompok) {
  if (kelompokTerbaca.has(kelompok.a)) return kelompokTerbaca.get(kelompok.a);
  const alamat = `${asalAbt()}/main/beranda?a=${encodeURIComponent(kelompok.a)}`;
  const respons = await fetch(alamat, { credentials: "include", cache: "no-store" });
  if (!respons.ok) throw new Error(`ABT menjawab ${respons.status} untuk kelompok ${kelompok.kelompok}`);
  const daftar = alatUraiBerkasDariHtml(await respons.text());
  kelompokTerbaca.set(kelompok.a, daftar);
  return daftar;
}

/**
 * Mencari satu berkas menurut namanya di seluruh kelompok blangko.
 * Pulang { blangko, berkas, a, b, d } atau null bila tidak ada di ABT ini.
 *
 * kelompokDiharapkan - nama menu ABT yang seharusnya memuat berkas ini. Nama
 * berkas saja tidak selalu cukup: "[01] [Kabul Verstek] Cerai (Format
 * Lengkap)" berdiri di menu Cerai Gugat DAN Cerai Talak, dan tanpa sebutan
 * ini yang pertamalah yang selalu menang.
 */
async function cariTokenBlangko(namaBerkas, lapor, kelompokDiharapkan) {
  const kunci = alatKunciBerkas(namaBerkas);
  if (!kunci) return null;
  const diminta = alatKunciKelompokBanyak(kelompokDiharapkan);
  const bawa = (x, k) => ({ blangko: x.blangko || k || "", berkas: x.berkas, a: x.a, b: x.b, d: x.d || "" });

  // Yang tergambar di halaman ini lebih dulu - tanpa jaringan. Bila menunya
  // disebut, halaman ini hanya dipakai kalau ia MEMANG menu itu; kalau tidak,
  // pencarian tetap berjalan. Halaman yang kebetulan terbuka bukan jawaban.
  const diHalaman = berkasBlangkoDiHalaman();
  if (diminta.length > 0) {
    const tepatDiSini = alatCocokkanBerkasDiKelompok(diHalaman, namaBerkas, kelompokDiharapkan);
    if (tepatDiSini) return bawa(tepatDiSini);
  } else {
    const diSini = alatCocokkanBerkas(diHalaman, namaBerkas);
    if (diSini) return bawa(diSini);
  }

  const kelompok = alatDahulukanKelompok(await daftarKelompokBlangko(), kelompokDiharapkan).slice(
    0,
    BATAS_KELOMPOK_DICARI
  );
  // ==========================================================================
  // SATU PINDAIAN, DUA JAWABAN - DAN YANG TEPAT TIDAK BOLEH DIDAHULUI
  // ==========================================================================
  //
  // Cadangan (berkas senama di menu mana pun) dipegang DI SINI, bukan di
  // dalam pencocok per kelompok. Sebabnya sederhana dan mahal: pencocok itu
  // hanya melihat satu kelompok, jadi cadangannya akan selalu menang di
  // kelompok pertama yang senama - dan untuk cerai talak, kelompok pertama
  // itu justru Cerai Gugat, yang hendak kita hindari.
  let cadangan = null;
  for (let i = 0; i < kelompok.length; i += 1) {
    const k = kelompok[i];
    if (lapor) lapor(`mencari di ${k.kelompok} (${i + 1}/${kelompok.length})…`);
    let daftar;
    try {
      daftar = await berkasDalamKelompok(k);
    } catch (galat) {
      alatCatat("massal-galat", `kelompok ${k.kelompok}: ${String((galat && galat.message) || galat)}`, "");
      continue;
    }
    if (diminta.length > 0) {
      const tepat = alatCocokkanBerkasDiKelompok(daftar, namaBerkas, kelompokDiharapkan);
      if (tepat) return bawa(tepat, k.kelompok);
      if (!cadangan) {
        const senama = alatCocokkanBerkas(daftar, namaBerkas);
        if (senama) cadangan = bawa(senama, k.kelompok);
      }
    } else {
      const cocok = alatCocokkanBerkas(daftar, namaBerkas);
      if (cocok) return bawa(cocok, k.kelompok);
    }
    if (!kelompokTerbaca.has(k.a)) await alatJeda(JEDA_ANTAR_KELOMPOK_MS);
  }
  return cadangan;
}

/**
 * Melengkapi token untuk baris pemetaan yang baru punya nama. Pulang jumlah
 * yang terisi; yang tidak ketemu dibiarkan bernama saja dan disebut di
 * catatan, bukan dihapus.
 */
async function lengkapiTokenPeta(peta, lapor) {
  let terisi = 0;
  for (const [kunci, baris] of Object.entries(peta)) {
    if (!alatBlangkoTerpetakan(baris) || alatBlangkoLengkap(baris)) continue;
    const diminta = baris.blangkoDiminta || baris.blangko || "";
    const semuaNama = diminta ? [diminta, ...(baris.blangkoLain || [])] : [];
    const hasil = await cariTokenBlangko(baris.berkas, lapor, semuaNama);
    if (!hasil) {
      baris.catatan = "berkas tidak ditemukan di ABT ini";
      continue;
    }
    // Kalau kelompok yang diminta tidak ada di ABT ini, barisnya tetap
    // terisi - tetapi yang membaca layar berhak tahu ia mendarat di menu lain.
    //
    // blangkoDiminta DISIMPAN, dan itu bukan hiasan: tanpanya pemulihan baris
    // di alatMuatPetaBlangkoLengkap akan melihat blangko yang "salah" lagi
    // pada pemuatan berikutnya, melepas tokennya lagi, dan memindai ulang
    // seluruh ABT setiap kali halaman dibuka - berputar tanpa akhir.
    const menuLain =
      diminta && !alatKunciKelompokBanyak(semuaNama).includes(alatKunciKelompok(hasil.blangko));
    peta[kunci] = {
      ...alatRapikanBlangko({ ...hasil }),
      jenisAsli: baris.jenisAsli || kunci,
      bawaan: Boolean(baris.bawaan),
      // Perbaikan 2 Okt sore (P): baris dari Pemetaan blangko server tetap
      // bertanda server, dan baris status tetap menyebut statusnya.
      ...(baris.sumber ? { sumber: baris.sumber } : {}),
      ...(baris.statusAsli ? { statusAsli: baris.statusAsli } : {}),
      ...(diminta ? { blangkoDiminta: diminta } : {}),
      ...(baris.blangkoLain ? { blangkoLain: baris.blangkoLain } : {}),
      ...(menuLain ? { catatan: `diminta dari "${diminta}", yang ada di ABT ini "${hasil.blangko}"` } : {}),
    };
    terisi += 1;
    alatCatat("massal", `token blangko terisi: ${baris.jenisAsli || kunci} → ${hasil.blangko} / ${hasil.berkas}`, "");
  }
  if (terisi > 0) await alatSimpanPetaBlangko(peta);
  return terisi;
}

// ─── Pembungkus fondasi Tahap 1 ──────────────────────────────────────────────

function t6Mode() {
  try {
    return typeof alatUjiMode === "function" ? String(alatUjiMode() || "lama") : "lama";
  } catch {
    return "lama";
  }
}

function t6Aktif() {
  return t6Mode() !== "lama";
}

/** Anak langsung pertama berkelas `kelas` - bukan cucu dari bagian lain. */
function t6Anak(induk, kelas) {
  if (!induk) return null;
  return Array.from(induk.children).find((c) => c.classList.contains(kelas)) || null;
}

/** Lapisan ini hidup di Baru dan UI Baru - sama dengan Tahap 6. */
function soreAktif() {
  return t6Aktif();
}

/**
 * Tampilan berganti selagi beranda terbuka: panel massal TIDAK disusun ulang
 * sendiri (putusan massal yang sedang berjalan tidak boleh terputus) - ↻ di
 * kaki panel yang menyusunnya ulang, dan itu disebut.
 */
function soreSaatUjiBerubahBeranda() {
  const panel = document.getElementById(PENANDA_MASSAL_ABT);
  if (!panel) return;
  const kini = soreAktif() ? "ya" : null;
  if (panel.getAttribute("data-sore") === kini || panel.querySelector(".aleta-sore-ganti-tampilan")) return;
  const isi = t6Anak(panel, "aleta-isi");
  if (!isi) return;
  isi.insertBefore(buatElemen("div", "aleta-abt-kabar aleta-sore-ganti-tampilan", "Tampilan ALETA berganti - tekan ↻ di kaki panel untuk menyusun ulang panel ini."), isi.firstChild);
}

try {
  document.addEventListener("aleta-uji-berubah", soreSaatUjiBerubahBeranda);
} catch {
  /* tanpa dokumen */
}

/*
 * ============================================================================
 * PERBAIKAN 1 OKT 2026 - PANEL ABT DI UI BARU (AGEN A)
 * ============================================================================
 *
 * Sumber: pesan pengguna sesudah memakai 1.176.0 (tangkapan 125-128). SELURUH
 * blok ini hidup HANYA dalam UI Baru (t6Modern(): alatUjiMode() === "ui").
 * Lama dan Baru tetap seperti 1.176.0 - tiap kait di jalur lama bertanya
 * t6Modern() lebih dahulu (dijaga ekstensi-abt-tahap6 "SYARAT MUTLAK" dan
 * ekstensi-abt-sederhana).
 *
 *   butir 1   bagian panel (Isi dari SIPP, Susun saksi, Unggah, Juru Sita,
 *             Alasan perceraian, bagian beranda) diselaraskan lewat
 *             alatJadikanLipat (agen W, K2) - bila fungsinya sudah ada.
 *   butir 8   posita RAPI dan keterangan saksi RAPI langsung masuk daftar
 *             "Input ke ABT" saat panel terbuka. Pratinjau posita = uji kering
 *             bot (POST tanpa menulis); tulisannya tetap hanya lewat tombol
 *             Input ke ABT, dengan jalur simpan yang sama dengan "Terapkan"
 *             pada Rapikan (mintaPositaRapi / simpanKeteranganSaksi).
 *   butir 9   huruf alasan = KESIMPULAN (keterangan saksi dikaitkan dengan
 *             posita). Pasal dan syarat di balik ⓘ aturan (bawaan tertutup);
 *             inti keterangan tiap saksi di balik ⓘ kenapa (intiCiri dari bot,
 *             cadangan: pencarian kata di keterangan yang sudah dibaca).
 *   butir 10  4020/8521/8522/8528/8529/8530 diisi ABT SENDIRI sesudah
 *             variabel lain diinput - tidak diperingatkan selama masih ada
 *             yang menunggu Input. Diperingatkan bila sesudah Input + muat
 *             ulang masih error. Berlaku untuk pita, dialog CETAK (termasuk
 *             huruf G), dan penjaga CETAK lama.
 *   butir 11  Unggah putusan perkara ini: blangko HALAMAN INI dipilih sendiri
 *             (tautan CETAK), nomor perkara cadangan dari variabel 0001, dan
 *             hasil per langkah. Jalur tulisnya tetap kerjakanSatuPerkaraAbt.
 *   butir 13  putusan massal ABT: bawaan hanya perkara yang hari itu PUTUS
 *             atau DITUNDA untuk putusan / musyawarah (aletaMassalPutusanLayak
 *             agen M bila ada). "Semua perkara" tetap ada di saringan.
 *   butir 14  Super Admin & Admin: daftar dikelompokkan per hakim ketua
 *             majelis, centang "kerjakan semua milik X". Hakim: "Hanya
 *             majelis saya".
 *   butir 15  susun saksi: label sama/beda/varian habis pindah ke ⓘ; tombol
 *             ⟳ ganti keterangan ke alternatif + ↶ urungkan / ↷ ulangi.
 *   butir 16  pita error putusan dan komentar hakim atas BAS mengikuti menu
 *             peran (lihat soreKelola).
 *
 * KUNCI PENYIMPANAN BARU: abtInputSelesai (chrome.storage.local) -
 * {perkaraId: ms terakhir Input ke ABT lewat ALETA}, paling banyak 40 perkara.
 */
const A1_MUAT_MS = Date.now();

// ─── Butir 14: jeda seperti manusia sebelum menulis (global) ────────────────

/**
 * alatJedaManusia (panel-alat.js, agen W) - tanpa jeda dalam mode kering,
 * latihan, dan coba yang menahan alamat itu. Fungsinya belum ada = tanpa jeda.
 */
async function a2JedaTulis(jenis, alamat) {
  // 1.184.0 (5 Okt 2026, butir 16): TANPA jeda untuk tulisan ke ABT - keputusan
  // pengguna ("Tanpa jeda di ABT"), menggantikan butir 14 (2 Okt) KHUSUS ABT.
  // ±75% waktu "Input ke ABT" adalah jeda 0,9-2,2 detik per variabel. Sejak
  // 17 Okt pengisian borang SIPP juga langsung; jeda tinggal untuk tulisan database
  // beruntun (alatJedaManusia di konten.js dan bot). Riwayat
  // ALETA tetap jujur dan lengkap (catatRiwayat). Tulisan ke ABT tetap satu
  // per satu - ABT tidak pernah menerima dua tulisan sekaligus.
  void jenis;
  void alamat;
}
const A3_KUNCI_MENU = "aletaAbtMenuBlangko";

function a3Baku(teks) {
  return String(teks || "").replace(/\s+/g, " ").trim();
}

/**
 * Halaman DAFTAR blangko ABT: submenu berkas yang diklik dicatat untuk halaman
 * blangko berikutnya di tab yang sama (klik -> abt/main/cari -> view). Hanya
 * di sessionStorage tab ini - tidak ada yang ditulis ke ABT.
 */
function a3CatatMenuBlangko() {
  if (a3CatatMenuBlangko.dipasang) return;
  a3CatatMenuBlangko.dipasang = true;
  document.addEventListener(
    "click",
    (e) => {
      const a = e.target && e.target.closest ? e.target.closest(".pricing-bottom-bottom a") : null;
      if (!a) return;
      const kartu = a.closest(".pricing_inner_w3ls");
      const judul = kartu ? kartu.querySelector(".pricing-top h3") : null;
      const span = a.querySelector("span");
      const aktif = document.querySelector("#navbar a.active");
      const panelGrup = aktif ? aktif.closest(".panel") : null;
      const tombolGrup = panelGrup ? panelGrup.previousElementSibling : null;
      // Judul kartu = "<submenu><br><jenis perkara> - <nomor>" (beranda.php ABT):
      // yang dinilai hanya submenunya, sebab "Cerai Gugat" bukan nama menu.
      let menu = "";
      for (const n of Array.from((judul && judul.childNodes) || [])) {
        if (n.nodeName === "BR") break;
        menu += n.textContent || "";
      }
      const catatan = {
        berkas: a3Baku((span || a).textContent).replace(/^#\s*/, ""),
        menu: a3Baku(menu),
        grup: tombolGrup && tombolGrup.classList.contains("accordion") ? a3Baku(tombolGrup.textContent) : "",
      };
      try {
        if (catatan.berkas) sessionStorage.setItem(A3_KUNCI_MENU, JSON.stringify(catatan));
      } catch {
        /* tanpa sessionStorage: halaman blangko memakai nama berkas saja */
      }
    },
    true
  );
}
const KTP_TEKS_P1 = Object.freeze({ cabang: 1, urutan: 1 });
const KTP_TEKS_P2 = Object.freeze({ cabang: 1, urutan: 2 });
const KTP_TEKS_T1 = Object.freeze({ cabang: 2, urutan: 1 });

const KTP_TEKS_BULAN_POLA =
  "januari|pebruari|februari|maret|april|mei|juni|juli|agustus|september|oktober|nopember|november|desember|" +
  "jan|peb|feb|mar|apr|jun|jul|agu|ags|agt|sept|sep|okt|nop|nov|des";
const EL7_TEKS = Object.freeze({
  "1": "E-Litigasi: penuh (Tergugat ber-email)",
  "2": "E-Litigasi: hybrid (diunggah Panitera Sidang)",
});
const EL7_POLA_EMAIL = /^[^\s@,;:<>()]+@[^\s@,;:<>()]+\.[A-Za-z]{2,}$/;
const EL7_EMAIL_INSTANSI = /@(?:pa-[\w-]+|[\w-]+\.mahkamahagung|mahkamahagung|badilag\.mahkamahagung)\.go\.id$/i;
const EL7_API_KONTAK = "/aleta/api/aleta-ecourt/kontak-pihak";

/** Murni: email sah (huruf kecil) atau "" - "-", "0", "..." dan surel instansi pengadilan bukan email pihak. */
function el7Email(teks) {
  const t = String(teks == null ? "" : teks).replace(/\s+/g, "").replace(/[.,;]+$/, "");
  return EL7_POLA_EMAIL.test(t) && !EL7_EMAIL_INSTANSI.test(t) ? t.toLowerCase() : "";
}

/**
 * Murni: email Tergugat (pihak ke-2) atau kuasanya dari `kontak` (bentuk kontak-pihak / isi-gugatan.kontak).
 * -> { email, asal: "sipp"|"ecourt", milik: "pihak"|"kuasa", ragu } | null. Yang dari SIPP atau e-Court non-ragu
 * didahulukan; yang hanya berkeyakinan "ragu" dikembalikan dengan ragu: true.
 */
function el7CariEmailTergugat(kontak) {
  if (!kontak || typeof kontak !== "object") return null;
  const calon = [];
  const dom = kontak.domisili && typeof kontak.domisili === "object" ? kontak.domisili[2] : null;
  if (dom && el7Email(dom.email)) {
    const sipp = dom.asal === "sipp";
    calon.push({ email: el7Email(dom.email), asal: sipp ? "sipp" : "ecourt", milik: dom.milik === "kuasa" ? "kuasa" : "pihak", ragu: !sipp && dom.keyakinan === "ragu" });
  }
  for (const o of Array.isArray(kontak.orang) ? kontak.orang : []) {
    if (!o || Number(o.pihakKe) !== 2) continue;
    const milik = o.jenis === "kuasa" ? "kuasa" : "pihak";
    const emailSipp = el7Email(o.sipp && o.sipp.email);
    if (emailSipp) calon.push({ email: emailSipp, asal: "sipp", milik, ragu: false });
    const u = o.usulan && o.usulan.email;
    const emailEc = el7Email(u && u.nilai);
    if (emailEc) calon.push({ email: emailEc, asal: "ecourt", milik, ragu: u.keyakinan === "ragu" });
  }
  return calon.find((c) => !c.ragu && c.asal === "sipp") || calon.find((c) => !c.ragu) || calon[0] || null;
}

/**
 * Murni: keputusan #7139# dari kontak perkara. -> { nilai: "1"|"2", sebab, keterangan, email? } atau null (biarkan kosong).
 * `kontak.elitigasi` = fakta dari bot { lewatEcourt, tergugatHadir, jumlahSidang }; bot lama tanpa fakta tetap
 * tidak pernah memutuskan apa pun (18 Okt: "1" pun menuntut perkara e-Court yang terbukti).
 */
function el7Putuskan(kontak) {
  if (!kontak || typeof kontak !== "object" || kontak.ada === false) return null;
  const e = el7CariEmailTergugat(kontak);
  const f = kontak.elitigasi && typeof kontak.elitigasi === "object" ? kontak.elitigasi : null;
  // 18 Okt 2026 (keputusan 2): "1" HANYA untuk perkara e-Court; perkara bukan e-Court (atau yang belum diketahui
  // lewat e-Court atau tidak) dibiarkan KOSONG - tidak diunggah ke e-Court, jadi e-litigasi tidak berlaku.
  if (e && !e.ragu && !(f && f.lewatEcourt === true)) return null;
  if (e && !e.ragu) return { nilai: "1", sebab: "email", asal: e.asal, milik: e.milik, email: e.email, keterangan: EL7_TEKS["1"] };
  if (e) return null; // email ada tetapi pemiliknya belum pasti: petugas yang memutuskan
  if (f && f.lewatEcourt === true && f.tergugatHadir === true) return { nilai: "2", sebab: "hadir-tanpa-email", keterangan: EL7_TEKS["2"] };
  return null;
}

/** Kontak perkara (SIPP + akun e-Court + teks gugatan/kuasa/jawaban tanpa OCR + fakta sidang). null bila rute/bot belum ada atau gagal. */
async function el7AmbilKontak(nomor) {
  if (!nomor) return null;
  try {
    const respons = await fetch(`${EL7_API_KONTAK}?nomor=${encodeURIComponent(nomor)}&teks=1`, { credentials: "include", cache: "no-store" });
    if (!respons || !respons.ok) return null;
    const luar = await respons.json();
    const isi = luar && luar.data ? luar.data : luar;
    return isi && typeof isi === "object" ? isi : null;
  } catch {
    return null;
  }
}

/**
 * Keputusan #7139# untuk satu perkara dari bahan kontak yang sudah ada (`kontakAda`) atau, bila belum cukup, dari
 * kontak-pihak. Dipakai panel ABT (el7Baca) dan lapisan Blangko Derry (blangko-derry-isian.js).
 * -> keputusan el7Putuskan atau null.
 */
async function el7Ambil7139(nomor, kontakAda) {
  const kontak = kontakAda && typeof kontakAda === "object" && kontakAda.ada ? kontakAda : null;
  let putusan = el7Putuskan(kontak);
  if (!putusan && (!kontak || !kontak.elitigasi)) {
    const lain = await el7AmbilKontak(nomor);
    if (lain) putusan = el7Putuskan(lain);
  }
  return putusan;
}
/* === AKHIR PEKERJAAN === */

/* === 16OKT-F43: ANONIMISASI PUTUSAN MANDIRI ALETA (tanpa rute anonim ABT) === */
// Blangko Derry "PDF anonim" dan unggah e-Doc anonim memakai penyamar ALETA lebih dulu
// (portal: /putusan/anonim-mandiri - data pihak/saksi/anak dari SIPP + pola naskah);
// anonimisasi ABT (main/anonim) hanya cadangan bila penyamar ALETA gagal. Sebelum
// mengunggah, petugas melihat pratinjau naskah anonim (alatPratinjauAnonim).
const ALETA_API_ANONIM_MANDIRI = "/aleta/api/aleta-ecourt/putusan/anonim-mandiri";
const F43_NAMA_JENIS = {
  "nama pihak": "nama para pihak",
  "nama saksi": "nama saksi",
  "nama anak": "nama anak",
  "nama orang lain": "nama orang lain (orang tua, kerabat)",
  NIK: "NIK",
  "nomor telepon": "nomor telepon",
  "nomor rekening": "nomor rekening",
  email: "alamat email",
  NIP: "NIP",
  "tempat & tanggal lahir": "tempat/tanggal lahir",
  alamat: "alamat (disisakan kabupaten/kota)",
  pekerjaan: "pekerjaan",
  sekolah: "nama sekolah",
};

function f43Esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function f43KeBase64(buf) {
  const b = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}
function f43DariBase64(b64) {
  const s = atob(String(b64 || ""));
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) b[i] = s.charCodeAt(i);
  return b.buffer;
}

/** "12 nama para pihak, 3 NIK, ..." - kalimat ringkas untuk catatan cetak. */
function alatRingkasAnonim(h) {
  const r = (h && h.ringkas) || {};
  const urut = Object.keys(F43_NAMA_JENIS).filter((k) => r[k]);
  return urut.map((k) => `${r[k]} ${F43_NAMA_JENIS[k]}`).join(", ") || "tidak ada yang perlu disamarkan";
}

/**
 * Samarkan RTF putusan lewat portal. Pulang { ok, rtf:ArrayBuffer, ringkas, sisa, dilewati,
 * potongan, tidakTerbaca } atau { ok:false, sebab } - pemanggil lalu memakai ABT.
 */
async function alatAnonimMandiri(rtfBuf, nomorPerkara, catat) {
  try {
    if (typeof catat === "function") catat("menyamarkan naskah dengan penyamar ALETA…");
    const opsi = {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rtfBase64: f43KeBase64(rtfBuf), nomorPerkara: String(nomorPerkara || "") }),
      batasMs: 90000,
    };
    const r = typeof alatAmbil === "function" ? await alatAmbil(ALETA_API_ANONIM_MANDIRI, opsi, "Menyamarkan putusan") : await fetch(ALETA_API_ANONIM_MANDIRI, opsi);
    const luar = await r.json().catch(() => null);
    const d = luar && luar.data !== undefined ? luar.data : luar;
    if (!r.ok || !d || !d.ok) {
      return { ok: false, sebab: (d && (d.sebab || d.alasan)) || (luar && luar.error && luar.error.message) || `ALETA menjawab ${r.status}` };
    }
    return { ...d, ok: true, rtf: f43DariBase64(d.rtfBase64), rtfBase64: undefined };
  } catch (e) {
    return { ok: false, sebab: String((e && e.message) || e) };
  }
}

function f43PasangGaya() {
  if (document.getElementById("aleta-f43-gaya")) return;
  const g = document.createElement("style");
  g.id = "aleta-f43-gaya";
  g.textContent = `
.aleta-f43-tirai{position:fixed;inset:0;z-index:2147483600;background:var(--aleta-tirai-warna,rgba(15,23,42,.38));-webkit-backdrop-filter:var(--aleta-tirai-filter,none);backdrop-filter:var(--aleta-tirai-filter,none);display:flex;align-items:center;justify-content:center;padding:16px;font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.aleta-f43-kotak{background:#fff;color:#0f172a;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.35);width:min(920px,100%);max-height:calc(100vh - 32px);display:flex;flex-direction:column;overflow:hidden}
.aleta-f43-kepala{padding:16px 20px 10px;border-bottom:1px solid #e2e8f0}
.aleta-f43-kepala h2{margin:0 0 4px;font-size:19px;font-weight:700}
.aleta-f43-kepala p{margin:0;color:#475569}
.aleta-f43-badan{padding:12px 20px;overflow:auto;flex:1 1 auto}
.aleta-f43-awas{background:#fef3c7;border:1px solid #f59e0b;border-radius:10px;padding:10px 12px;margin:0 0 10px}
.aleta-f43-awas ul{margin:6px 0 0 18px;padding:0}
.aleta-f43-awas li{margin:2px 0}
.aleta-f43-baik{background:#dcfce7;border:1px solid #22c55e;border-radius:10px;padding:8px 12px;margin:0 0 10px}
.aleta-f43-naskah{white-space:pre-wrap;font:15px/1.6 "Times New Roman",Georgia,serif;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;max-height:48vh;overflow:auto;background:#f8fafc}
.aleta-f43-naskah mark{background:#bfdbfe;color:#1e3a8a;border-radius:3px;padding:0 2px;font-family:system-ui,sans-serif;font-size:13px;font-weight:600}
.aleta-f43-naskah mark.pihak{background:#c7d2fe}.aleta-f43-naskah mark.orang{background:#e9d5ff;color:#581c87}
.aleta-f43-kaki{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;padding:12px 20px;border-top:1px solid #e2e8f0;background:#f8fafc}
.aleta-f43-kaki button{font:600 15px system-ui,sans-serif;border-radius:9px;padding:9px 16px;cursor:pointer;border:1px solid #cbd5e1;background:#fff;color:#0f172a}
.aleta-f43-kaki button.utama{background:#1d4ed8;border-color:#1d4ed8;color:#fff}
.aleta-f43-kaki button:focus-visible{outline:3px solid #93c5fd;outline-offset:2px}
.aleta-f43-badan details{margin:0 0 10px}
@media (prefers-color-scheme: dark){.aleta-f43-kotak{background:#0f172a;color:#e2e8f0}.aleta-f43-kepala,.aleta-f43-kaki{border-color:#334155}.aleta-f43-kaki{background:#111827}.aleta-f43-kaki button{background:#1e293b;color:#e2e8f0;border-color:#475569}.aleta-f43-naskah{background:#111827;border-color:#334155}.aleta-f43-kepala p{color:#94a3b8}.aleta-f43-awas{background:#422006;border-color:#b45309}.aleta-f43-baik{background:#052e16;border-color:#15803d}}
`;
  (document.head || document.documentElement).appendChild(g);
}

/**
 * Pratinjau naskah anonim sebelum diunggah ke e-Doc SIPP.
 * Pulang "unggah" (putusan + anonim), "tanpa" (putusan saja), atau "batal".
 */
function alatPratinjauAnonim(h, o) {
  return new Promise((selesai) => {
    f43PasangGaya();
    const tirai = document.createElement("div");
    tirai.className = "aleta-f43-tirai";
    tirai.setAttribute("role", "dialog");
    tirai.setAttribute("aria-modal", "true");
    tirai.setAttribute("aria-labelledby", "aleta-f43-judul");
    const sisa = (h && h.sisa) || [];
    const dilewati = (h && h.dilewati) || [];
    const tidakTerbaca = (h && h.tidakTerbaca) || [];
    const kelas = (j) => (j === "nama pihak" ? "pihak" : /^nama/.test(j || "") ? "orang" : "");
    const naskah = ((h && h.potongan) || [])
      .map((p) => (p.j ? `<mark class="${kelas(p.j)}" title="${f43Esc(F43_NAMA_JENIS[p.j] || p.j)}">${f43Esc(p.t)}</mark>` : f43Esc(p.t)))
      .join("");
    tirai.innerHTML =
      `<div class="aleta-f43-kotak">` +
      `<div class="aleta-f43-kepala"><h2 id="aleta-f43-judul">Periksa naskah anonim sebelum diunggah</h2>` +
      `<p>${f43Esc((o && o.nomor) || "")} · Yang disamarkan: ${f43Esc(alatRingkasAnonim(h))}. Nama majelis, panitera, dan kuasa hukum tidak disamarkan.</p></div>` +
      `<div class="aleta-f43-badan">` +
      (sisa.length
        ? `<div class="aleta-f43-awas" role="alert"><b>Masih ada ${sisa.length} bagian yang tampaknya data pribadi:</b><ul>${sisa
            .slice(0, 12)
            .map((x) => `<li><b>${f43Esc(x.kata)}</b> (${f43Esc(x.jenis)}) - "…${f43Esc(x.konteks)}…"</li>`)
            .join("")}</ul>Bila diunggah, bagian itu ikut terbit di Direktori Putusan.</div>`
        : `<div class="aleta-f43-baik">Tidak ada nama, NIK, atau nomor telepon dari data SIPP yang tersisa.</div>`) +
      (tidakTerbaca.length
        ? `<div class="aleta-f43-awas">Sebagian data SIPP tidak terbaca (${f43Esc(tidakTerbaca.join(", "))}) - periksa nama-nama itu sendiri di naskah.</div>`
        : "") +
      (dilewati.length
        ? `<details><summary>${dilewati.length} nama dalam kutipan kitab/hadis dibiarkan (bukan orang dalam perkara)</summary><ul>${dilewati
            .slice(0, 20)
            .map((x) => `<li>${f43Esc(x.kata)} - "…${f43Esc(x.konteks)}…"</li>`)
            .join("")}</ul></details>`
        : "") +
      `<div class="aleta-f43-naskah" tabindex="0" aria-label="Naskah anonim">${naskah}</div>` +
      `</div>` +
      `<div class="aleta-f43-kaki">` +
      `<button type="button" data-f43="batal">Batal unggah</button>` +
      `<button type="button" data-f43="tanpa">Unggah putusan saja</button>` +
      `<button type="button" class="utama" data-f43="unggah">Unggah putusan + anonim</button>` +
      `</div></div>`;
    const tutup = (hasil) => {
      document.removeEventListener("keydown", tombol, true);
      tirai.remove();
      selesai(hasil);
    };
    const tombol = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        tutup("batal");
      }
    };
    tirai.addEventListener("click", (e) => {
      const b = e.target && e.target.closest ? e.target.closest("[data-f43]") : null;
      if (b) tutup(b.getAttribute("data-f43"));
    });
    document.addEventListener("keydown", tombol, true);
    document.body.appendChild(tirai);
    const utama = tirai.querySelector("button.utama");
    if (utama) utama.focus();
  });
}

/* === 17OKT-F41: UNGGAH MASSAL e-DOC PUTUSAN & BAS KE SIPP (panel ABT) === */
/*
 * Layar "Unggah massal": perkara MILIK akun yang e-Doc-nya belum ada di SIPP
 * (hakim: putusan + anonimisasi; PP/panitera: BAS sidang), centang banyak,
 * "Periksa" (pratinjau ringkas per berkas), lalu "Unggah" berurutan dengan
 * kemajuan per baris. Berhenti sendiri pada kegagalan pertama; e-Doc yang
 * ternyata sudah ada = "dobel", dilewati tanpa diganti (selaras L1). Ringkasan
 * putaran dicatat ke riwayat ALETA.
 *
 *   daftar     GET  /unggah-massal                (portal -> bot, SELECT saja)
 *   blangko    putusan: pemetaan blangko jenis/status (alatPetaUntukPerkara);
 *              BAS: usulan BAS massal tanggal itu (/bas-massal) + token ABT
 *   hak ABT    POST main/cari redirect manual (abtKlien.periksaHakBuka) - ABT
 *              preview sendiri TIDAK memeriksa hak (A-PETA-ABT 4.2)
 *   berkas     GET  abt/preview?a&b&c&d (abtKlien.cetak) - RTF jadi
 *   anonim     penyamar ALETA (alatAnonimMandiri), ABT main/anonim cadangan
 *   cek dobel  GET  /unggah-massal/cek tepat sebelum tiap unggahan
 *   tulis      POST /putusan/unggah-sipp (putusan) | /bas/unggah-sipp (BAS)
 *   riwayat    POST/GET /unggah-massal/jejak
 *
 * Ganti (butir 43-44, 17 Okt 2026): e-Doc BAS yang SUDAH ada dapat diganti dengan
 * konfirmasi - tab BAS "Tampilkan juga yang sudah ada" (daftar ?basAda=1) atau baris
 * yang ternyata dobel. Bot memindah berkas lama ke <folder>/terhapus/; jejaknya
 * hanya di ALETA. Putusan tidak punya Ganti.
 *
 * Tidak memanggil rute blangko tanya jawab ABT (apalagi yang menghapus). Antrean dilaporkan
 * ke latar (alatAntreanKerja) - tombol Perbarui ekstensi ditahan selama jalan.
 */
const F41_API = {
  daftar: "/aleta/api/aleta-ecourt/unggah-massal",
  cek: "/aleta/api/aleta-ecourt/unggah-massal/cek",
  jejak: "/aleta/api/aleta-ecourt/unggah-massal/jejak",
  putusan: "/aleta/api/aleta-ecourt/putusan/unggah-sipp",
  bas: "/aleta/api/aleta-ecourt/bas/unggah-sipp",
  basMassal: "/aleta/api/aleta-ecourt/bas-massal",
};
const F41_HASH = "aleta-unggah-massal";
const F41_BATAS_UNGGAH_MS = 150000;
/** Batas anonimisasi ABT (main/anonim) per berkas - ABT sendiri bisa 5 menit; lewat itu dianggap gagal. */
const F41_BATAS_ANONIM_ABT_MS = 330000;
const F41_BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function f41Esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
/** "2026-10-15" -> "15 Okt 2026". Murni. */
function f41Tanggal(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${Number(m[3])} ${F41_BULAN[Number(m[2]) - 1] || m[2]} ${m[1]}` : "";
}
/** Badan JSON portal ({ok,data}) -> data; tolakan -> kalimatnya. Murni. */
async function f41Baca(r) {
  let luar = null;
  try {
    luar = await r.json();
  } catch {
    luar = null;
  }
  const data = luar && luar.data !== undefined ? luar.data : luar;
  const pesan =
    (data && typeof data === "object" && (data.sebab || data.alasan || data.pesan)) ||
    (luar && luar.error && typeof luar.error === "object" ? luar.error.message : luar && luar.error) ||
    (luar && luar.alasan) ||
    "";
  return { status: r.status, okHttp: r.ok, data, pesan: String(pesan || "") };
}

/** Kebergantungan bawaan - semuanya fungsi yang sudah ada di panel-alat.js/abt.js/basmassal.js/abt-klien.js. */
function f41Bawaan() {
  let klien = null;
  const petaBas = new Map();
  let petaPutusan = null;
  return {
    ambil: (url, opsi, sebut) => (typeof alatAmbil === "function" ? alatAmbil(url, opsi, sebut) : fetch(url, opsi)),
    klien: () => {
      if (klien) return klien;
      if (typeof abtKlienBuat !== "function") throw new Error("abt-klien.js belum termuat.");
      klien = abtKlienBuat({ ambil: (u, i) => fetch(u, i), asal: asalAbt() });
      return klien;
    },
    async blangkoPutusan(baris, lapor) {
      if (typeof alatMuatPetaBlangkoLengkap !== "function" || typeof alatPetaUntukPerkara !== "function") return { sebab: "pemetaan blangko belum termuat" };
      if (!petaPutusan) petaPutusan = await alatMuatPetaBlangkoLengkap();
      const cari = () => {
        // Temuan audit D3: kumulasi (SIPP + petitum) dan keadaan putusan datang per baris dari portal - sama dengan jalur satu perkara.
        const h = alatPetaUntukPerkara(petaPutusan, baris.jenisPerkara, baris.statusPutusan || "", Boolean(baris.verstek), baris.kumulasi || null, Array.isArray(baris.keadaanPutusan) ? baris.keadaanPutusan : []);
        return h && h.baris ? h.baris : null;
      };
      let b = cari();
      if (b && !alatBlangkoLengkap(b) && alatBlangkoTerpetakan(b) && typeof lengkapiTokenPeta === "function") {
        await lengkapiTokenPeta(petaPutusan, lapor || (() => {}));
        if (typeof alatSimpanPetaBlangko === "function") await alatSimpanPetaBlangko(petaPutusan).catch(() => {});
        b = cari();
      }
      if (!b || !alatBlangkoTerpetakan(b)) return { sebab: `blangko putusan untuk ${baris.jenisPerkara || "jenis ini"} belum dipetakan (Pemetaan blangko putusan)` };
      if (!alatBlangkoLengkap(b)) return { sebab: `blangko "${b.berkas}" tidak ditemukan di ABT ini` };
      return { a: b.a, b: b.b, berkas: b.berkas, blangko: b.blangko || b.jenisAsli || "" };
    },
    async blangkoBas(baris, lapor) {
      const tgl = baris.tanggal;
      if (!petaBas.has(tgl)) {
        const r = await (typeof alatAmbil === "function" ? alatAmbil : fetch)(`${F41_API.basMassal}?tanggal=${encodeURIComponent(tgl)}&saringan=semua`, { credentials: "include", cache: "no-store" }, "Membaca usulan blangko BAS");
        const j = await f41Baca(r);
        petaBas.set(tgl, j.okHttp && j.data && Array.isArray(j.data.sidang) ? j.data.sidang : { sebab: j.pesan || `ALETA menjawab ${j.status}` });
      }
      const sidang = petaBas.get(tgl);
      if (!Array.isArray(sidang)) return { sebab: `usulan blangko BAS tidak terbaca (${sidang.sebab})` };
      const s = sidang.find((x) => String(x.sidangId) === String(baris.sidangId)) || sidang.find((x) => String(x.perkaraId) === String(baris.perkaraId));
      const u = s && s.blangko && s.blangko.usulan;
      if (!u) return { sebab: (s && s.blangko && s.blangko.sebab) || "belum ada usulan blangko BAS untuk sidang ini - pilih di BAS massal" };
      let token = null;
      if (typeof basmassalTokenUntuk === "function" && typeof basmassalBacaToken === "function") {
        if (typeof basmassalPanenTokenAbt === "function") await basmassalPanenTokenAbt().catch(() => 0);
        token = basmassalTokenUntuk(await basmassalBacaToken(), u.folder, u.berkas, u.padanan, u.salinan).berkas;
      }
      if (!token && typeof cariTokenBlangko === "function") {
        const kelompok = [...(Array.isArray(u.salinan) ? u.salinan.map((x) => x && x.menu).filter(Boolean) : []), u.folder].filter(Boolean);
        token = await cariTokenBlangko(u.berkas, lapor, kelompok);
      }
      if (!token || !token.a || !token.b) return { sebab: `blangko BAS "${u.berkas}" tidak ditemukan di ABT ini` };
      // Temuan audit A5: usulan "perkiraan" (kehadiran belum tercatat) adalah tebakan - mesin menahannya sampai petugas memeriksanya.
      return { a: token.a, b: token.b, berkas: u.berkas, blangko: u.label || u.berkas, perkiraan: Boolean(u.perkiraan) };
    },
    anonim: (rtf, nomor, lapor) => (typeof alatAnonimMandiri === "function" ? alatAnonimMandiri(rtf, nomor, lapor) : Promise.resolve({ ok: false, sebab: "penyamar ALETA belum termuat" })),
    pratinjauAnonim: (h, o) => (typeof alatPratinjauAnonim === "function" ? alatPratinjauAnonim(h, o) : Promise.resolve("batal")),
    namaBaku: (nomor, berkas) =>
      (typeof alatNamaUnduhanBlangko === "function" && alatNamaUnduhanBlangko(nomor, berkas, "rtf")) || `${String(nomor).replace(/[\\/:*?"<>|]+/g, "_")} - ${berkas}.rtf`,
    olehUsername: () => (typeof namaPenggunaAbt === "function" ? namaPenggunaAbt() : ""),
    jeda: (ms) => (typeof alatJeda === "function" ? alatJeda(ms) : new Promise((r) => setTimeout(r, ms))),
    jedaMs: typeof ALAT_JEDA_MASSAL_MS === "number" ? ALAT_JEDA_MASSAL_MS : 1500,
    catat: (j, r) => {
      try {
        if (typeof alatCatat === "function") alatCatat(j, r, "");
      } catch {
        /* kotak hitam hanya kenyamanan */
      }
    },
    antrean: (n) => (typeof alatAntreanKerja === "function" ? alatAntreanKerja("unggah-massal-edoc", "unggah massal e-Doc", n) : null),
    sekarang: () => new Date().toISOString(),
  };
}

/**
 * Mesin unggah massal - tanpa DOM, semua jaringan lewat `deps` (diuji dengan tiruan).
 * Status baris: siap | halangan | dobel; hasil: berhasil | gagal | dilewati | dobel.
 */
function f41Mesin(depsMasuk) {
  const d = depsMasuk || f41Bawaan();
  // Temuan audit D2: anonimisasi ABT (main/anonim, 25 dtk - 5 mnt) hanya cadangan dan SEKALI per baris.
  const anonimAbtDicoba = new Set();
  // Temuan audit D4: antrian validasi BAS ABT dibaca sekali per putaran (bukan per baris).
  let validasiBacaan = null;

  async function daftar(saringan) {
    const q = new URLSearchParams();
    if (saringan && saringan.putusan) q.set("putusan", saringan.putusan);
    if (saringan && saringan.bas) q.set("bas", saringan.bas);
    if (saringan && saringan.basAda) q.set("basAda", "1");
    const r = await d.ambil(`${F41_API.daftar}${q.toString() ? `?${q}` : ""}`, { credentials: "include", cache: "no-store" }, "Membaca daftar unggah massal");
    const j = await f41Baca(r);
    if (!j.okHttp || !j.data || j.data.ok === false) throw new Error(j.pesan || `ALETA menjawab ${j.status}`);
    return j.data;
  }

  async function cek(baris) {
    const q = new URLSearchParams({ jenis: baris.jenis, perkaraId: String(baris.perkaraId) });
    if (baris.jenis === "bas") q.set("sidangId", String(baris.sidangId));
    const r = await d.ambil(`${F41_API.cek}?${q}`, { credentials: "include", cache: "no-store" }, "Memeriksa e-Doc di SIPP");
    const j = await f41Baca(r);
    if (!j.okHttp || !j.data || j.data.ok === false) throw new Error(j.pesan || `ALETA menjawab ${j.status}`);
    return j.data;
  }

  /** Slot yang masih kosong di SIPP menurut bacaan cek. Murni. */
  function slotKosong(baris, c) {
    if (baris.jenis === "bas") return { bas: !c.adaBas };
    return { putusan: !c.adaPutusan, anonim: !c.adaAnonim };
  }

  /**
   * Pratinjau satu baris: cek dobel, blangko, hak ABT, RTF, nama baku, anonim. Tidak menulis apa pun.
   * opsi.ganti (BAS saja, butir 43): e-Doc BAS yang sudah ada TIDAK menghentikan pratinjau -
   * baris disiapkan untuk MENGGANTI (s.ganti), dengan nama berkas lamanya.
   */
  /**
   * Antrian validasi BAS ABT dibaca sekali per putaran (temuan audit D4). Pulang { ok, fiturAktif, baris } atau
   * { ok:false, pesan }; null bila klien lama tidak punya pembacanya. Hanya bacaan yang berhasil disimpan.
   */
  async function bacaValidasiBas(klien) {
    if (!klien || typeof klien.daftarValidasiBas !== "function") return null;
    if (validasiBacaan && Date.now() - validasiBacaan.pada < 60000) return validasiBacaan.hasil;
    let hasil;
    try {
      hasil = await klien.daftarValidasiBas();
    } catch (e) {
      return { ok: false, pesan: String((e && e.message) || e) };
    }
    if (hasil && hasil.ok !== false) validasiBacaan = { pada: Date.now(), hasil };
    return hasil || { ok: false, pesan: "tanpa jawaban" };
  }

  /** Kalimat halangan bila BAS ini belum di-acc hakim di ABT ("" = lolos). Saklar validasi mati = lolos. */
  async function halanganValidasiBas(klien, baris) {
    const v = await bacaValidasiBas(klien);
    if (v === null) return "";
    if (v.ok === false) return `Antrian validasi BAS di ABT tidak terbaca (${v.pesan || "tanpa keterangan"}) - tidak dapat dipastikan BAS ini sudah di-acc hakim.`;
    if (v.fiturAktif === false) return "";
    const rapat = (x) => String(x || "").replace(/\s+/g, "").toLowerCase();
    const ada = (Array.isArray(v.baris) ? v.baris : []).some((x) => {
      const tautan = (x && x.tautanBuka) || {};
      const cocokPerkara = (x && x.perkaraNomor && rapat(x.perkaraNomor) === rapat(baris.nomorPerkara)) || (tautan.c && String(tautan.c) === String(baris.perkaraId));
      if (!cocokPerkara) return false;
      const ke = (String((x && x.sidangTeks) || "").match(/sidang\s*ke\s*-?\s*(\d+)/i) || [])[1] || tautan.d || "";
      return !ke || Number(ke) === Number(baris.urutan);
    });
    return ada ? `BAS sidang ke-${baris.urutan || "?"} masih menunggu validasi hakim di ABT (validasi BAS menyala) - unggah setelah di-acc.` : "";
  }

  async function siapkan(baris, lapor, opsi) {
    const kabar = typeof lapor === "function" ? lapor : () => {};
    const ganti = Boolean(opsi && opsi.ganti) && baris.jenis === "bas";
    const sinyalLuar = (opsi && opsi.sinyal) || null;
    const dihentikan = () => Boolean(sinyalLuar && sinyalLuar.aborted);
    const s = { baris, keadaan: "halangan", halangan: "", catatan: [], nama: "", blangko: "", rtf: null, anonim: null, keputusanAnonim: "", perlu: null, ukuran: 0, ganti: false, jalurLama: "", tebakan: false };
    try {
      if (dihentikan()) {
        s.halangan = "Dihentikan petugas sebelum diperiksa.";
        return s;
      }
      kabar("memeriksa e-Doc di SIPP…");
      const c = await cek(baris);
      if (baris.jenis === "putusan" && c.adaBaris === false) {
        s.halangan = "Putusan Akhir belum diisi di SIPP - isi dulu, baru e-Doc dapat diunggah.";
        return s;
      }
      s.perlu = slotKosong(baris, c);
      if (ganti && !s.perlu.bas) {
        s.ganti = true;
        s.jalurLama = String(c.jalur || "");
        s.perlu = { bas: true };
        s.catatan.push(`Mengganti e-Doc BAS yang sudah ada${s.jalurLama ? ` (${s.jalurLama})` : ""} - berkas lama dipindah ke folder "terhapus" di SIPP.`);
      } else if (baris.jenis === "bas" ? !s.perlu.bas : !s.perlu.putusan && !s.perlu.anonim) {
        s.keadaan = "dobel";
        s.jalurLama = String(c.jalur || c.jalurPutusan || "");
        s.halangan = `Sudah ada di SIPP${c.jalur || c.jalurPutusan ? ` (${c.jalur || c.jalurPutusan})` : ""} - tidak diganti${baris.jenis === "bas" ? ". Tekan Ganti bila berkas itu keliru" : ""}.`;
        return s;
      }
      if (baris.jenis === "putusan" && !s.perlu.putusan) s.catatan.push(`e-Doc putusan sudah ada${c.jalurPutusan ? ` (${c.jalurPutusan})` : ""} - hanya anonimisasi yang diunggah.`);
      if (baris.jenis === "putusan" && !s.perlu.anonim) s.catatan.push("e-Doc anonimisasi sudah ada - hanya putusan yang diunggah.");

      kabar("mencari blangko…");
      const b = baris.jenis === "bas" ? await d.blangkoBas(baris, kabar) : await d.blangkoPutusan(baris, kabar);
      if (!b || !b.a || !b.b) {
        s.halangan = `Blangko belum siap: ${(b && b.sebab) || "tidak ditemukan"}.`;
        return s;
      }
      s.blangko = b.berkas;
      // Temuan audit A5: blangko BAS yang hanya perkiraan (kehadiran belum tercatat) tidak diunggah tanpa tanda "sudah diperiksa".
      if (baris.jenis === "bas" && b.perkiraan) {
        if (opsi && opsi.tebakanDiperiksa) s.catatan.push(`Blangko "${b.berkas}" adalah perkiraan - sudah diperiksa petugas.`);
        else {
          s.tebakan = true;
          s.halangan = `Blangko BAS "${b.berkas}" hanya perkiraan (kehadiran belum tercatat di SIPP; dipilih menurut urutan sidang dan agenda). Periksa dulu, lalu tekan "Sudah diperiksa".`;
          return s;
        }
      }
      const klien = d.klien();
      kabar("memeriksa hak buka blangko di ABT…");
      const hak = await klien.periksaHakBuka({ a: b.a, b: b.b, perkaraId: baris.perkaraId });
      if (!hak || hak.ok === false) {
        s.halangan = `ABT menolak blangko ini: ${(hak && (hak.pesan || hak.sebab)) || "alasan tidak terbaca"}.`;
        return s;
      }
      // Temuan audit D4: ABT preview tidak memeriksa acc hakim - saklar validasi BAS yang menyala diperiksa di sini.
      if (baris.jenis === "bas") {
        const tahan = await halanganValidasiBas(klien, baris);
        if (tahan) {
          s.halangan = tahan;
          return s;
        }
      }
      if (dihentikan()) {
        s.halangan = "Pemeriksaan dihentikan petugas.";
        return s;
      }
      kabar("mencetak dari ABT…");
      const cetak = await klien.cetak({ a: b.a, b: b.b, perkaraId: baris.perkaraId, sidang: baris.jenis === "bas" ? String(baris.urutan || "") : "" });
      if (!cetak || !cetak.ok || !cetak.rtf) {
        s.halangan = `ABT tidak mengembalikan berkas: ${(cetak && (cetak.pesan || cetak.sebab)) || "tanpa keterangan"}.`;
        return s;
      }
      s.rtf = cetak.rtf;
      s.ukuran = cetak.ukuran || (cetak.rtf.byteLength || 0);
      s.nama = d.namaBaku(baris.nomorPerkara, b.berkas);
      // Temuan audit D1: abtKlienPeriksaRtf mengembalikan LARIK penanda, bukan angka.
      const rawSisa = cetak.periksa ? cetak.periksa.penandaSisa : 0;
      const sisaPenanda = Array.isArray(rawSisa) ? rawSisa.length : Number(rawSisa) > 0 ? Number(rawSisa) : 0;
      if (sisaPenanda) s.catatan.push(`${sisaPenanda} isian blangko masih kosong di naskah - periksa sebelum diunggah.`);

      if (baris.jenis === "putusan" && s.perlu.anonim) {
        const an = await d.anonim(s.rtf, baris.nomorPerkara, kabar);
        if (an && an.ok && an.rtf) {
          s.anonim = { ...an, sumber: "ALETA" };
          s.keputusanAnonim = (an.sisa || []).length ? "" : "unggah";
        } else if (anonimAbtDicoba.has(String(baris.kunci || baris.perkaraId))) {
          // Temuan audit D2: main/anonim mahal (25 dtk - 5 mnt) - tidak diulang untuk baris yang sama.
          s.catatan.push(`Anonimisasi belum dapat dibuat (${(an && an.sebab) || "penyamar ALETA gagal"}; anonimisasi ABT sudah dicoba untuk perkara ini dan tidak diulang).`);
        } else if (dihentikan()) {
          s.halangan = "Pemeriksaan dihentikan petugas.";
          return s;
        } else {
          kabar("penyamar ALETA gagal - memakai anonimisasi ABT…");
          anonimAbtDicoba.add(String(baris.kunci || baris.perkaraId));
          // Sinyal Hentikan petugas + batas waktu sendiri, supaya ABT yang macet tidak menggantung selamanya.
          const pembatalAbt = new AbortController();
          const batalkan = () => pembatalAbt.abort();
          const pewaktu = setTimeout(batalkan, F41_BATAS_ANONIM_ABT_MS);
          if (sinyalLuar && typeof sinyalLuar.addEventListener === "function") sinyalLuar.addEventListener("abort", batalkan);
          let abt;
          try {
            abt = await klien.anonim({ perkaraId: baris.perkaraId, nomor: baris.nomorPerkara, rtf: s.rtf, namaBerkas: s.nama, sinyal: pembatalAbt.signal });
          } catch (e) {
            abt = { ok: false, pesan: pembatalAbt.signal.aborted ? (dihentikan() ? "dihentikan petugas" : "melewati batas waktu") : String((e && e.message) || e) };
          } finally {
            clearTimeout(pewaktu);
            if (sinyalLuar && typeof sinyalLuar.removeEventListener === "function") sinyalLuar.removeEventListener("abort", batalkan);
          }
          if (abt && abt.ok && abt.rtf) {
            s.anonim = { ok: true, rtf: abt.rtf, sumber: "ABT", ringkas: {}, sisa: [], potongan: [] };
            s.keputusanAnonim = "unggah";
            s.catatan.push(`Anonimisasi dari ABT (penyamar ALETA: ${(an && an.sebab) || "gagal"}); sisa nama disamarkan lagi saat diunggah.`);
          } else {
            s.catatan.push(`Anonimisasi belum dapat dibuat (${(an && an.sebab) || "penyamar ALETA gagal"}; ABT: ${(abt && (abt.pesan || abt.sebab)) || "gagal"}).`);
          }
        }
      }
      s.keadaan = "siap";
      return s;
    } catch (e) {
      s.halangan = `Pemeriksaan gagal: ${String((e && e.message) || e)}`;
      return s;
    }
  }

  /** Yang akan dikirim untuk baris siap. Murni. */
  function kiriman(s) {
    if (!s || s.keadaan !== "siap" || s.hasil === "berhasil" || s.hasil === "dobel") return null;
    if (s.baris.jenis === "bas") return s.perlu && s.perlu.bas && s.rtf ? { bas: true } : null;
    const putusan = Boolean(s.perlu && s.perlu.putusan && s.rtf);
    const anonim = Boolean(s.perlu && s.perlu.anonim && s.anonim && s.anonim.rtf && s.keputusanAnonim === "unggah");
    return putusan || anonim ? { putusan, anonim } : null;
  }

  /** Satu unggahan. Pulang { hasil, catatan, berkas }. */
  async function unggah(s, lapor) {
    const kabar = typeof lapor === "function" ? lapor : () => {};
    const b = s.baris;
    let k = kiriman(s);
    if (!k) {
      const sebab = b.jenis === "putusan" && s.perlu && s.perlu.anonim && s.anonim && !s.keputusanAnonim
        ? "naskah anonim masih memuat data pribadi dan belum diperiksa - buka \"Periksa naskah anonim\""
        : "tidak ada berkas yang perlu diunggah";
      return { hasil: "dilewati", catatan: sebab };
    }
    // Cek dobel TEPAT sebelum menulis: e-Doc yang diisi orang lain sejak pratinjau tidak diganti.
    kabar("cek dobel di SIPP…");
    let c;
    try {
      c = await cek(b);
    } catch (e) {
      return { hasil: "gagal", catatan: `cek dobel gagal: ${String((e && e.message) || e)}` };
    }
    const kosong = slotKosong(b, c);
    if (b.jenis === "bas") {
      // Ganti (butir 43): hanya yang dipilih petugas dengan konfirmasi; selain itu dobel tetap tidak diganti.
      if (!kosong.bas && !s.ganti) return { hasil: "dobel", catatan: `e-Doc BAS sudah ada di SIPP${c.jalur ? ` (${c.jalur})` : ""} - tidak diganti` };
    } else {
      k = { putusan: k.putusan && kosong.putusan, anonim: k.anonim && kosong.anonim };
      if (!k.putusan && !k.anonim) return { hasil: "dobel", catatan: "e-Doc putusan/anonimisasi sudah ada di SIPP - tidak diganti" };
    }

    const badan = new FormData();
    badan.append("perkaraId", String(b.perkaraId));
    badan.append("nomorPerkara", b.nomorPerkara);
    badan.append("olehUsername", d.olehUsername() || "");
    const blob = (x) => new Blob([x], { type: "application/rtf" });
    let alamat;
    let isinya;
    if (b.jenis === "bas") {
      alamat = F41_API.bas;
      badan.append("sidangId", String(b.sidangId));
      badan.append("bas", blob(s.rtf), s.nama);
      if (s.ganti) badan.append("ganti", "1");
      isinya = `BAS sidang ke-${b.urutan || "?"}`;
    } else {
      alamat = F41_API.putusan;
      if (k.putusan) badan.append("putusan", blob(s.rtf), s.nama);
      if (k.anonim) {
        badan.append("anonimisasi", blob(s.anonim.rtf), s.nama.replace(/\.rtf$/i, " - anonim.rtf"));
        badan.append("samarkanSisa", "1");
      }
      isinya = k.putusan && k.anonim ? "putusan + anonimisasi" : k.putusan ? "putusan" : "anonimisasi";
    }
    kabar(`mengunggah ${isinya}…`);
    let j;
    try {
      const r = await d.ambil(alamat, { method: "POST", body: badan, credentials: "include", batasMs: F41_BATAS_UNGGAH_MS }, `Mengunggah ${isinya} ke SIPP`);
      j = await f41Baca(r);
    } catch (e) {
      return { hasil: "gagal", catatan: `${isinya}: ${String((e && e.message) || e)}` };
    }
    if (j.status === 409 && j.data && j.data.alasan === "sudah_ada") return { hasil: "dobel", catatan: j.pesan || "sudah ada di SIPP - tidak diganti" };
    // Anonimisasi ditolak penjaga rute (409, belum ada yang ditulis): putusan dikirim sendirian, anonimnya disebut gagal.
    if (j.status === 409 && b.jenis === "putusan" && k.putusan && k.anonim && j.data && j.data.slot === "anonimisasi") {
      const ulang = { ...s, anonim: null, keputusanAnonim: "" };
      const r2 = await unggah({ ...ulang, perlu: { putusan: true, anonim: false } }, kabar);
      return r2.hasil === "berhasil"
        ? { hasil: "gagal", catatan: `putusan masuk; anonimisasi ditolak: ${j.pesan} - samarkan lalu unggah anonimnya sendiri`, berkas: s.nama }
        : r2;
    }
    if (!j.okHttp || !j.data || j.data.ok === false) return { hasil: "gagal", catatan: `${isinya}: ${j.pesan || `ALETA menjawab ${j.status}`}` };
    const tambahan = [];
    if (b.jenis === "putusan" && typeof kalimatSisaDisamarkan === "function") {
      const samar = kalimatSisaDisamarkan(j.data);
      if (samar) tambahan.push(samar);
    }
    const sebagian = Array.isArray(j.data.berkas) ? j.data.berkas.filter((x) => x && x.ok === false) : [];
    if (sebagian.length) return { hasil: "gagal", catatan: `${isinya}: sebagian gagal (${sebagian.map((x) => `${x.jenis}: ${x.pesan || x.alasan}`).join("; ")})`, berkas: s.nama };
    if (b.jenis === "bas" && j.data.diganti) {
      tambahan.push(j.data.lamaDipindah ? "berkas lama dipindah ke folder terhapus" : `berkas lama belum dipindah: ${j.data.peringatanLama || "sebab tidak terbaca"}`);
      return { hasil: "berhasil", catatan: [`${isinya} MENGGANTI e-Doc lama di SIPP`, ...tambahan].join(" · "), berkas: (j.data && j.data.nama) || s.nama };
    }
    return { hasil: "berhasil", catatan: [`${isinya} masuk ke e-Doc SIPP`, ...tambahan].join(" · "), berkas: (j.data && j.data.nama) || s.nama };
  }

  /**
   * Unggah berurutan. Berhenti pada kegagalan PERTAMA (sisanya "dilewati" beserta sebabnya);
   * dobel dan halangan pratinjau tidak menghentikan. `sinyal` = AbortSignal "Hentikan".
   */
  async function jalankan(daftarSiap, o) {
    const opsi = o || {};
    const lapor = typeof opsi.lapor === "function" ? opsi.lapor : () => {};
    const jenis = daftarSiap[0] ? daftarSiap[0].baris.jenis : "putusan";
    const ringkas = { jenis, mulai: d.sekarang(), selesai: "", berhenti: false, sebabBerhenti: "", butir: [] };
    const antre = d.antrean(daftarSiap.length);
    let menulis = 0;
    try {
      for (let i = 0; i < daftarSiap.length; i += 1) {
        const s = daftarSiap[i];
        const b = s.baris;
        let h;
        if (ringkas.berhenti) h = { hasil: "dilewati", catatan: `tidak dikerjakan - ${ringkas.sebabBerhenti}` };
        else if (opsi.sinyal && opsi.sinyal.aborted) {
          ringkas.berhenti = true;
          ringkas.sebabBerhenti = "dihentikan petugas";
          h = { hasil: "dilewati", catatan: "tidak dikerjakan - dihentikan petugas" };
        } else if (s.keadaan === "dobel") h = { hasil: "dobel", catatan: s.halangan };
        else if (s.keadaan !== "siap") h = { hasil: "dilewati", catatan: s.halangan || "belum siap" };
        else {
          if (menulis > 0) await d.jeda(d.jedaMs);
          lapor(s, "jalan", "mulai…");
          h = await unggah(s, (t) => lapor(s, "jalan", t));
          if (h.hasil === "berhasil" || h.hasil === "gagal") menulis += 1;
          if (h.hasil === "gagal") {
            ringkas.berhenti = true;
            ringkas.sebabBerhenti = `${b.nomorPerkara} gagal: ${h.catatan}`;
          }
        }
        s.hasil = h.hasil;
        s.catatanHasil = h.catatan;
        ringkas.butir.push({ nomor: b.nomorPerkara, ...(b.jenis === "bas" ? { sidang: Number(b.urutan) || undefined } : {}), hasil: h.hasil, catatan: String(h.catatan || ""), ...(h.berkas ? { berkas: h.berkas } : {}) });
        lapor(s, h.hasil, h.catatan);
        d.catat(h.hasil === "gagal" ? "massal-galat" : "massal", `unggah massal ${b.nomorPerkara}${b.jenis === "bas" ? ` sidang ${b.urutan}` : ""}: ${h.hasil} - ${h.catatan}`);
        if (antre) antre.maju(i + 1, daftarSiap.length);
      }
    } finally {
      if (antre) antre.selesai();
    }
    ringkas.selesai = d.sekarang();
    return ringkas;
  }

  async function catatRiwayat(ringkas) {
    try {
      const r = await d.ambil(F41_API.jejak, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ringkas) }, "Mencatat riwayat unggah massal");
      const j = await f41Baca(r);
      return j.okHttp && j.data && j.data.id ? { ok: true } : { ok: false, sebab: j.pesan || `ALETA menjawab ${j.status}` };
    } catch (e) {
      return { ok: false, sebab: String((e && e.message) || e) };
    }
  }

  async function riwayat() {
    const r = await d.ambil(F41_API.jejak, { credentials: "include", cache: "no-store" }, "Membaca riwayat unggah massal");
    const j = await f41Baca(r);
    if (!j.okHttp || !j.data) throw new Error(j.pesan || `ALETA menjawab ${j.status}`);
    return j.data;
  }

  return { daftar, cek, siapkan, kiriman, unggah, jalankan, catatRiwayat, riwayat, deps: d };
}

/** Hitung hasil putaran. Murni. */
function f41Hitung(ringkas) {
  const n = (h) => ringkas.butir.filter((b) => b.hasil === h).length;
  return { berhasil: n("berhasil"), gagal: n("gagal"), dilewati: n("dilewati"), dobel: n("dobel"), total: ringkas.butir.length };
}
/** "3 berhasil · 1 gagal · 2 dilewati · 1 sudah ada (dobel)". Murni. */
function f41KalimatHasil(h) {
  const bagian = [`${h.berhasil} berhasil`];
  if (h.gagal) bagian.push(`${h.gagal} gagal`);
  if (h.dilewati) bagian.push(`${h.dilewati} dilewati`);
  if (h.dobel) bagian.push(`${h.dobel} sudah ada (dobel)`);
  return bagian.join(" · ");
}

function f41PasangGaya() {
  if (document.getElementById("aleta-f41-gaya")) return;
  const g = document.createElement("style");
  g.id = "aleta-f41-gaya";
  g.textContent = `
.aleta-f41-tirai{position:fixed;inset:0;z-index:2147483500;background:var(--aleta-tirai-warna,rgba(15,23,42,.38));-webkit-backdrop-filter:var(--aleta-tirai-filter,none);backdrop-filter:var(--aleta-tirai-filter,none);display:flex;align-items:center;justify-content:center;padding:16px;font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#0f172a}
.aleta-f41-kotak{background:#fff;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.35);width:min(1000px,100%);max-height:calc(100vh - 32px);display:flex;flex-direction:column;overflow:hidden}
.aleta-f41-kepala{display:flex;gap:12px;align-items:flex-start;padding:16px 20px 8px}
.aleta-f41-kepala h2{margin:0 0 2px;font-size:19px;font-weight:700}
.aleta-f41-kepala p{margin:0;color:#475569}
.aleta-f41-kepala .aleta-f41-tutup{margin-left:auto;border:0;background:transparent;font-size:24px;line-height:1;cursor:pointer;color:#475569;padding:2px 8px;border-radius:8px}
.aleta-f41-tab{display:flex;gap:6px;padding:0 20px;border-bottom:1px solid #e2e8f0}
.aleta-f41-tab button{font:600 15px system-ui,sans-serif;border:0;border-bottom:3px solid transparent;background:transparent;padding:8px 12px;cursor:pointer;color:#475569}
.aleta-f41-tab button[aria-selected="true"]{color:#1d4ed8;border-bottom-color:#1d4ed8}
.aleta-f41-alat{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 20px;border-bottom:1px solid #f1f5f9}
.aleta-f41-alat select,.aleta-f41-alat button,.aleta-f41-kaki button,.aleta-f41-baris button{font:600 14px system-ui,sans-serif;border-radius:9px;padding:6px 12px;cursor:pointer;border:1px solid #cbd5e1;background:#fff;color:#0f172a}
.aleta-f41-alat .aleta-f41-hitung{color:#475569;margin-left:auto}
.aleta-f41-badan{padding:10px 20px;overflow:auto;flex:1 1 auto}
.aleta-f41-baris{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin:0 0 8px;background:#fff}
.aleta-f41-baris[data-keadaan="berhasil"]{border-color:#22c55e;background:#f0fdf4}
.aleta-f41-baris[data-keadaan="gagal"]{border-color:#ef4444;background:#fef2f2}
.aleta-f41-baris[data-keadaan="dobel"],.aleta-f41-baris[data-keadaan="halangan"]{border-color:#f59e0b;background:#fffbeb}
.aleta-f41-baris[data-keadaan="jalan"]{border-color:#3b82f6;background:#eff6ff}
.aleta-f41-baris label{display:flex;gap:10px;align-items:center;cursor:pointer;flex-wrap:wrap}
.aleta-f41-baris input[type=checkbox]{width:18px;height:18px}
.aleta-f41-kecil{color:#475569;font-size:14px}
.aleta-f41-chip{display:inline-block;border-radius:999px;padding:1px 10px;font-size:13px;font-weight:600;background:#e2e8f0;color:#334155;margin:2px 4px 0 0}
.aleta-f41-chip.kuning{background:#fef3c7;color:#92400e}.aleta-f41-chip.hijau{background:#dcfce7;color:#166534}.aleta-f41-chip.biru{background:#dbeafe;color:#1e40af}.aleta-f41-chip.merah{background:#fee2e2;color:#991b1b}
.aleta-f41-rinci{margin:6px 0 0 28px;font-size:14px}
.aleta-f41-rinci div{margin:2px 0}
.aleta-f41-kemajuan{margin:4px 0 0 28px;font-size:14px;font-weight:600}
.aleta-f41-pesan{border-radius:10px;padding:10px 12px;margin:0 0 10px}
.aleta-f41-pesan.awas{background:#fef3c7;border:1px solid #f59e0b}.aleta-f41-pesan.baik{background:#dcfce7;border:1px solid #22c55e}.aleta-f41-pesan.buruk{background:#fee2e2;border:1px solid #ef4444}.aleta-f41-pesan.info{background:#eff6ff;border:1px solid #93c5fd}
.aleta-f41-kaki{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:flex-end;padding:12px 20px;border-top:1px solid #e2e8f0;background:#f8fafc}
.aleta-f41-kaki .aleta-f41-status{margin-right:auto;color:#334155}
.aleta-f41-kaki button.utama{background:#1d4ed8;border-color:#1d4ed8;color:#fff}
.aleta-f41-kaki button.bahaya{background:#fff;border-color:#ef4444;color:#b91c1c}
.aleta-f41-kaki button:disabled,.aleta-f41-alat button:disabled{opacity:.5;cursor:not-allowed}
.aleta-f41-tirai button:focus-visible,.aleta-f41-tirai input:focus-visible,.aleta-f41-tirai select:focus-visible{outline:3px solid #93c5fd;outline-offset:2px}
.aleta-f41-kosong{color:#475569;padding:24px 4px;text-align:center}
@media (max-width:640px){.aleta-f41-tirai{padding:0}.aleta-f41-kotak{border-radius:0;max-height:100vh;height:100vh}.aleta-f41-rinci,.aleta-f41-kemajuan{margin-left:0}}
@media (prefers-color-scheme: dark){.aleta-f41-tirai{color:#e2e8f0}.aleta-f41-kotak{background:#0f172a}.aleta-f41-kepala p,.aleta-f41-kecil,.aleta-f41-alat .aleta-f41-hitung,.aleta-f41-kaki .aleta-f41-status{color:#94a3b8}.aleta-f41-tab,.aleta-f41-alat,.aleta-f41-kaki{border-color:#334155}.aleta-f41-kaki{background:#111827}.aleta-f41-baris{background:#111827;border-color:#334155}.aleta-f41-alat select,.aleta-f41-alat button,.aleta-f41-kaki button,.aleta-f41-baris button{background:#1e293b;color:#e2e8f0;border-color:#475569}.aleta-f41-kaki button.utama{background:#2563eb;border-color:#2563eb;color:#fff}.aleta-f41-baris[data-keadaan="berhasil"]{background:#052e16}.aleta-f41-baris[data-keadaan="gagal"]{background:#450a0a}.aleta-f41-baris[data-keadaan="dobel"],.aleta-f41-baris[data-keadaan="halangan"]{background:#422006}.aleta-f41-baris[data-keadaan="jalan"]{background:#172554}.aleta-f41-chip{background:#334155;color:#e2e8f0}.aleta-f41-pesan.awas{background:#422006}.aleta-f41-pesan.baik{background:#052e16}.aleta-f41-pesan.buruk{background:#450a0a}.aleta-f41-pesan.info{background:#172554}}
`;
  (document.head || document.documentElement).appendChild(g);
}

let f41Terbuka = null;

/**
 * Membuka layar Unggah massal. `jenisAwal` "putusan" | "bas" | "" (= jenis pertama yang menjadi hak akun).
 * Pulang elemen tirai (untuk uji) - atau yang sudah terbuka.
 */
function aletaUnggahMassalBuka(jenisAwal, depsMasuk) {
  if (f41Terbuka && f41Terbuka.isConnected) return f41Terbuka;
  f41PasangGaya();
  const mesin = f41Mesin(depsMasuk);
  const S = { data: null, tab: "", saringan: {}, basAda: false, centang: new Set(), siap: new Map(), jalan: false, pembatal: null, ringkas: null, riwayat: null, galatMuat: "", tebakanOk: new Set(), fase: "" };
  const tirai = document.createElement("div");
  tirai.className = "aleta-f41-tirai";
  tirai.setAttribute("role", "dialog");
  tirai.setAttribute("aria-modal", "true");
  tirai.setAttribute("aria-labelledby", "aleta-f41-judul");
  tirai.innerHTML =
    `<div class="aleta-f41-kotak">` +
    `<div class="aleta-f41-kepala"><div><h2 id="aleta-f41-judul">Unggah massal ke e-Doc SIPP</h2>` +
    `<p>Putusan dan BAS yang belum ada di SIPP. Centang, periksa, lalu unggah - satu per satu, berhenti sendiri bila ada yang gagal.</p></div>` +
    `<button type="button" class="aleta-f41-tutup" data-f41="tutup" aria-label="Tutup" title="Tutup">×</button></div>` +
    `<div class="aleta-f41-tab" role="tablist"></div>` +
    `<div class="aleta-f41-alat"></div>` +
    `<div class="aleta-f41-badan" tabindex="0"></div>` +
    `<div class="aleta-f41-kaki"><span class="aleta-f41-status" aria-live="polite"></span>` +
    `<button type="button" data-f41="periksa">Periksa yang dicentang</button>` +
    `<button type="button" class="utama" data-f41="unggah" disabled>Unggah</button>` +
    `<button type="button" class="bahaya" data-f41="henti" hidden>Hentikan</button></div>` +
    `</div>`;
  const q = (s) => tirai.querySelector(s);
  const elTab = q(".aleta-f41-tab");
  const elAlat = q(".aleta-f41-alat");
  const elBadan = q(".aleta-f41-badan");
  const elStatus = q(".aleta-f41-status");
  const tPeriksa = q('[data-f41="periksa"]');
  const tUnggah = q('[data-f41="unggah"]');
  const tHenti = q('[data-f41="henti"]');

  const daftarTab = () => (S.data ? S.data[S.tab] || [] : []);
  const barisDicentang = () => daftarTab().filter((b) => S.centang.has(b.kunci));
  const status = (t) => {
    elStatus.textContent = t;
  };

  function chipBaris(b) {
    const c = [];
    if (b.jenis === "putusan") {
      if (b.perlu && b.perlu.putusan && b.perlu.anonim) c.push(["Putusan & anonim belum di SIPP", "kuning"]);
      else if (b.perlu && b.perlu.anonim) c.push(["Anonim belum di SIPP", "kuning"]);
      else if (b.perlu && b.perlu.putusan) c.push(["Putusan belum di SIPP", "kuning"]);
    } else {
      c.push([`Sidang ke-${b.urutan || "?"} · ${f41Tanggal(b.tanggal)}`, "biru"]);
      if (b.adaBas) c.push([`Sudah ada di SIPP${b.jalurBas ? `: ${b.jalurBas}` : ""}`, "kuning"]);
      if (b.hariIni) c.push(["Hari ini", ""]);
      if (b.bukti && b.bukti.length) c.push(["Sudah disusun di ABT", "hijau"]);
    }
    if (S.saringan[S.tab] === "semua" && !b.milikSaya && b.petugas && b.petugas.length) c.push([b.jenis === "bas" ? `PP: ${b.petugas[0]}` : `Majelis: ${b.petugas[0]}`, ""]);
    return c.map(([t, w]) => `<span class="aleta-f41-chip ${w}">${f41Esc(t)}</span>`).join("");
  }

  function keteranganBaris(b) {
    if (b.jenis === "putusan") {
      const st = [b.statusPutusan, b.verstek ? "verstek" : ""].filter(Boolean).join(", ");
      return `${b.jenisPerkara || ""} · diputus ${f41Tanggal(b.tanggal)}${st ? ` · ${st}` : ""}`;
    }
    return `${b.jenisPerkara || ""}${b.agenda ? ` · ${b.agenda}` : ""}${b.ditunda ? " · ditunda" : ""}`;
  }

  function rinciPratinjau(s) {
    if (!s) return "";
    const r = [];
    if (s.keadaan === "siap") {
      r.push(`<div>Nama berkas: <b>${f41Esc(s.nama)}</b>${s.ukuran ? ` <span class="aleta-f41-kecil">(${Math.max(1, Math.round(s.ukuran / 1024))} KB)</span>` : ""}</div>`);
      r.push(
        s.ganti
          ? `<div>Cek dobel: <span class="aleta-f41-chip kuning">akan MENGGANTI yang sudah ada</span>${s.jalurLama ? ` <span class="aleta-f41-kecil">(${f41Esc(s.jalurLama)})</span>` : ""}</div>`
          : `<div>Cek dobel: <span class="aleta-f41-chip hijau">belum ada di SIPP</span></div>`
      );
      if (s.baris.jenis === "putusan" && s.perlu && s.perlu.anonim) {
        if (!s.anonim) r.push(`<div>Anonim: <span class="aleta-f41-chip merah">belum dapat dibuat</span> - putusan saja yang diunggah.</div>`);
        else {
          const ringkas =
            s.anonim.sumber === "ABT"
              ? "dibuat ABT (cadangan)"
              : typeof alatRingkasAnonim === "function"
                ? `${alatRingkasAnonim(s.anonim)} disamarkan`
                : "disamarkan ALETA";
          const sisa = (s.anonim.sisa || []).length;
          const kep = s.keputusanAnonim === "unggah" ? "" : s.keputusanAnonim === "tanpa" ? " · anonim TIDAK diunggah (pilihan Anda)" : "";
          r.push(
            `<div>Naskah anonim: ${f41Esc(ringkas)}. ${sisa ? `<span class="aleta-f41-chip kuning">masih ada ${sisa} data pribadi</span>` : `<span class="aleta-f41-chip hijau">tidak ada nama tersisa</span>`}${f41Esc(kep)} ` +
              `<button type="button" data-f41-anonim="${f41Esc(s.baris.kunci)}">Periksa naskah anonim</button></div>`
          );
        }
      }
    } else if (s.halangan) {
      r.push(
        `<div><span class="aleta-f41-chip ${s.keadaan === "dobel" ? "kuning" : "merah"}">${s.keadaan === "dobel" ? "Sudah ada" : "Belum bisa"}</span> ${f41Esc(s.halangan)}` +
          (s.keadaan === "dobel" && s.baris.jenis === "bas" && !s.hasil ? ` <button type="button" data-f41-ganti="${f41Esc(s.baris.kunci)}">Ganti</button>` : "") +
          (s.tebakan && !s.hasil ? ` <button type="button" data-f41-tebakan="${f41Esc(s.baris.kunci)}" title="Saya sudah memeriksa bahwa blangko BAS ini memang yang tepat untuk sidang ini">Sudah diperiksa</button>` : "") +
          `</div>`
      );
    }
    for (const c of s.catatan || []) r.push(`<div class="aleta-f41-kecil">${f41Esc(c)}</div>`);
    return r.join("");
  }

  function gambarTab() {
    const tab = [];
    if (S.data && S.data.hak.putusan) tab.push(["putusan", `Putusan (${S.data.putusan.length})`]);
    if (S.data && S.data.hak.bas) tab.push(["bas", `BAS (${S.data.bas.length})`]);
    tab.push(["riwayat", "Riwayat"]);
    elTab.innerHTML = tab.map(([k, t]) => `<button type="button" role="tab" data-f41-tab="${k}" aria-selected="${S.tab === k}">${f41Esc(t)}</button>`).join("");
  }

  function gambarAlat() {
    if (S.tab === "riwayat" || !S.data) {
      elAlat.innerHTML = "";
      elAlat.hidden = true;
      return;
    }
    elAlat.hidden = false;
    const bolehSemua = S.data.hak.semua[S.tab];
    const sar = S.saringan[S.tab] || "saya";
    elAlat.innerHTML =
      (bolehSemua
        ? `<label class="aleta-f41-kecil">Tampilkan <select data-f41="saringan" aria-label="Saringan"><option value="saya" ${sar === "saya" ? "selected" : ""}>Milik saya</option><option value="semua" ${sar === "semua" ? "selected" : ""}>Semua</option></select></label>`
        : "") +
      (S.tab === "bas"
        ? `<label class="aleta-f41-kecil" title="BAS yang e-Doc-nya sudah ada di SIPP ikut tampil, untuk diganti bila keliru"><input type="checkbox" data-f41="bas-ada" ${S.basAda ? "checked" : ""} ${S.jalan ? "disabled" : ""}> Tampilkan juga yang sudah ada</label>`
        : "") +
      `<button type="button" data-f41="semua" ${S.jalan ? "disabled" : ""}>Centang semua</button>` +
      `<button type="button" data-f41="bersih" ${S.jalan ? "disabled" : ""}>Hapus centang</button>` +
      `<button type="button" data-f41="muat" ${S.jalan ? "disabled" : ""}>Muat ulang</button>` +
      `<span class="aleta-f41-hitung">${barisDicentang().length} dari ${daftarTab().length} dicentang</span>`;
  }

  function gambarBadan() {
    if (S.galatMuat) {
      elBadan.innerHTML = `<div class="aleta-f41-pesan buruk" role="alert">${f41Esc(S.galatMuat)}</div>`;
      return;
    }
    if (!S.data) {
      elBadan.innerHTML = `<div class="aleta-f41-kosong">Membaca daftar dari SIPP…</div>`;
      return;
    }
    if (S.tab === "riwayat") return gambarRiwayat();
    const atas = [];
    if (S.ringkas && S.ringkas.jenis === S.tab) {
      const h = f41Hitung(S.ringkas);
      atas.push(
        `<div class="aleta-f41-pesan ${h.gagal ? "buruk" : "baik"}" role="status"><b>Selesai: ${f41Esc(f41KalimatHasil(h))}.</b>` +
          (S.ringkas.berhenti ? `<div>Berhenti: ${f41Esc(S.ringkas.sebabBerhenti)}</div>` : "") +
          `<div class="aleta-f41-kecil">${S.ringkas.riwayat === false ? "Riwayat belum tercatat di ALETA." : "Tercatat di Riwayat."}</div></div>`
      );
    }
    for (const g of S.data.galat || []) atas.push(`<div class="aleta-f41-pesan awas">${f41Esc(g)}</div>`);
    if (S.tab === "putusan" && S.data.tertahan && S.data.tertahan.length) {
      atas.push(
        `<div class="aleta-f41-pesan info">${S.data.tertahan.length} perkara sudah dibacakan putusannya tetapi Putusan Akhir belum diisi di SIPP, jadi e-Doc-nya belum dapat diunggah: ` +
          `${f41Esc(S.data.tertahan.slice(0, 6).map((t) => t.nomorPerkara).join(", "))}${S.data.tertahan.length > 6 ? ", …" : ""}.</div>`
      );
    }
    const daftar = daftarTab();
    if (!daftar.length) {
      elBadan.innerHTML =
        atas.join("") +
        `<div class="aleta-f41-kosong">${S.tab === "putusan" ? "Tidak ada putusan yang menunggu e-Doc." : "Tidak ada BAS yang menunggu e-Doc."} Semua sudah ada di SIPP${S.saringan[S.tab] === "saya" ? " untuk perkara Anda" : ""}.</div>`;
      return;
    }
    elBadan.innerHTML =
      atas.join("") +
      daftar
        .map((b) => {
          const s = S.siap.get(b.kunci);
          const keadaan = s && s.hasil ? s.hasil : s ? s.keadaan : "";
          return (
            `<div class="aleta-f41-baris" data-kunci="${f41Esc(b.kunci)}" data-keadaan="${f41Esc(keadaan)}">` +
            `<label><input type="checkbox" data-f41-centang="${f41Esc(b.kunci)}" ${S.centang.has(b.kunci) ? "checked" : ""} ${S.jalan ? "disabled" : ""}>` +
            `<b>${f41Esc(b.nomorPerkara)}</b><span class="aleta-f41-kecil">${f41Esc(keteranganBaris(b))}</span></label>` +
            `<div style="margin-left:28px">${chipBaris(b)}${
              b.jenis === "bas" && b.adaBas && !s && !S.jalan ? ` <button type="button" data-f41-ganti="${f41Esc(b.kunci)}" title="Ganti e-Doc BAS yang sudah ada dengan BAS dari blangko ABT">Ganti</button>` : ""
            }</div>` +
            `<div class="aleta-f41-rinci">${rinciPratinjau(s)}</div>` +
            `<div class="aleta-f41-kemajuan" data-f41-kemajuan="${f41Esc(b.kunci)}">${s && s.catatanHasil ? f41Esc(s.catatanHasil) : ""}</div>` +
            `</div>`
          );
        })
        .join("");
  }

  function gambarRiwayat() {
    if (!S.riwayat) {
      elBadan.innerHTML = `<div class="aleta-f41-kosong">Membaca riwayat…</div>`;
      mesin
        .riwayat()
        .then((r) => {
          S.riwayat = r;
          if (S.tab === "riwayat") gambarRiwayat();
        })
        .catch((e) => {
          S.riwayat = { riwayat: [], galat: String((e && e.message) || e) };
          if (S.tab === "riwayat") gambarRiwayat();
        });
      return;
    }
    const daftar = S.riwayat.riwayat || [];
    if (S.riwayat.galat) {
      elBadan.innerHTML = `<div class="aleta-f41-pesan buruk">Riwayat belum dapat dibaca: ${f41Esc(S.riwayat.galat)}</div>`;
      return;
    }
    if (!daftar.length) {
      elBadan.innerHTML = `<div class="aleta-f41-kosong">Belum ada unggah massal yang tercatat.</div>`;
      return;
    }
    elBadan.innerHTML = daftar
      .map((x) => {
        const h = x.jumlah || f41Hitung(x);
        const jam = String(x.dicatat || x.selesai || "").replace("T", " ").slice(0, 16);
        return (
          `<details class="aleta-f41-baris"><summary><b>${f41Esc(jam)}</b> · ${x.jenis === "bas" ? "BAS" : "Putusan"} · ${f41Esc(f41KalimatHasil(h))}` +
          `${S.riwayat.semua && x.oleh ? ` · ${f41Esc(x.oleh)}` : ""}${x.berhenti ? ` · <span class="aleta-f41-chip merah">berhenti</span>` : ""}</summary>` +
          (x.berhenti ? `<div class="aleta-f41-kecil">${f41Esc(x.sebabBerhenti)}</div>` : "") +
          `<div class="aleta-f41-rinci">${(x.butir || [])
            .map((b) => `<div>${f41Esc(b.nomor)}${b.sidang ? ` sidang ke-${b.sidang}` : ""}: <b>${f41Esc(b.hasil)}</b> - ${f41Esc(b.catatan)}</div>`)
            .join("")}</div></details>`
        );
      })
      .join("");
  }

  function segarkanTombol() {
    const dicentang = barisDicentang();
    const siapKirim = dicentang.filter((b) => mesin.kiriman(S.siap.get(b.kunci)));
    tPeriksa.hidden = S.tab === "riwayat";
    tUnggah.hidden = S.tab === "riwayat";
    tPeriksa.disabled = S.jalan || dicentang.length === 0;
    tUnggah.disabled = S.jalan || siapKirim.length === 0;
    tUnggah.textContent = siapKirim.length ? `Unggah ${siapKirim.length} berkas` : "Unggah";
    tHenti.hidden = !S.jalan;
  }

  function gambar() {
    gambarTab();
    gambarAlat();
    gambarBadan();
    segarkanTombol();
  }

  async function muat() {
    S.data = null;
    S.galatMuat = "";
    S.siap.clear();
    S.centang.clear();
    gambar();
    try {
      S.data = await mesin.daftar({ ...S.saringan, basAda: S.basAda });
      S.saringan = { ...S.data.saringan };
      if (!S.tab || (S.tab !== "riwayat" && !S.data.hak[S.tab])) S.tab = jenisAwal && S.data.hak[jenisAwal] ? jenisAwal : S.data.hak.putusan ? "putusan" : "bas";
      status(`${S.data.putusan.length + S.data.bas.length} menunggu unggah · dibaca ${f41Tanggal(S.data.hariIni)}`);
    } catch (e) {
      S.galatMuat = `Daftar belum dapat dibaca: ${String((e && e.message) || e)}`;
      status("");
    }
    gambar();
  }

  function laporBaris(s, keadaan, teks) {
    const el = elBadan.querySelector(`[data-kunci="${f41Esc(s.baris.kunci)}"]`);
    if (!el) return;
    el.setAttribute("data-keadaan", keadaan);
    const k = el.querySelector("[data-f41-kemajuan]");
    if (k) k.textContent = teks || "";
  }

  async function periksa() {
    const dipilih = barisDicentang();
    if (!dipilih.length || S.jalan) return;
    S.jalan = true;
    S.ringkas = null;
    // Temuan audit D2: Periksa dapat dihentikan (tombol Hentikan) - ABT beranonim bisa 5 menit per berkas.
    S.pembatal = new AbortController();
    S.fase = "periksa";
    const sinyal = S.pembatal.signal;
    gambar();
    let i = 0;
    let diperiksa = 0;
    for (const b of dipilih) {
      if (sinyal.aborted) break;
      i += 1;
      status(`Memeriksa ${i} dari ${dipilih.length}: ${b.nomorPerkara}…`);
      laporBaris({ baris: b }, "jalan", "memeriksa…");
      const s = await mesin.siapkan(b, (t) => laporBaris({ baris: b }, "jalan", t), { sinyal, tebakanDiperiksa: S.tebakanOk.has(b.kunci) });
      diperiksa += 1;
      S.siap.set(b.kunci, s);
      const el = elBadan.querySelector(`[data-kunci="${f41Esc(b.kunci)}"]`);
      if (el) {
        el.setAttribute("data-keadaan", s.keadaan);
        el.querySelector(".aleta-f41-rinci").innerHTML = rinciPratinjau(s);
        el.querySelector("[data-f41-kemajuan]").textContent = "";
      }
    }
    const berhenti = sinyal.aborted;
    S.jalan = false;
    S.pembatal = null;
    const siap = dipilih.filter((b) => mesin.kiriman(S.siap.get(b.kunci))).length;
    const perluLihat = dipilih.filter((b) => {
      const s = S.siap.get(b.kunci);
      return s && s.keadaan === "siap" && s.anonim && !s.keputusanAnonim;
    }).length;
    status(
      berhenti
        ? `Pemeriksaan dihentikan petugas - ${diperiksa} dari ${dipilih.length} sudah diperiksa, ${siap} siap diunggah.`
        : `${siap} siap diunggah dari ${dipilih.length} yang diperiksa${perluLihat ? ` · ${perluLihat} naskah anonim perlu Anda lihat dulu` : ""}.`
    );
    gambar();
  }

  /** Tombol "Sudah diperiksa" (temuan audit A5): blangko BAS perkiraan disiapkan ulang sebagai pilihan petugas. */
  async function tandaiTebakan(kunci) {
    const b = daftarTab().find((x) => x.kunci === kunci);
    if (!b || S.jalan) return;
    const lama = S.siap.get(kunci);
    S.tebakanOk.add(kunci);
    S.jalan = true;
    gambar();
    laporBaris({ baris: b }, "jalan", "menyiapkan…");
    const s = await mesin.siapkan(b, (t) => laporBaris({ baris: b }, "jalan", t), { ganti: Boolean(lama && lama.ganti), tebakanDiperiksa: true });
    S.siap.set(kunci, s);
    if (s.keadaan === "siap") S.centang.add(kunci);
    S.jalan = false;
    status(s.keadaan === "siap" ? `${b.nomorPerkara} sidang ke-${b.urutan || "?"} siap diunggah.` : `${b.nomorPerkara}: ${s.halangan}`);
    gambar();
  }

  async function unggah() {
    // Yang sudah berhasil/dobel pada putaran sebelumnya tidak diikutkan lagi.
    const dipilih = barisDicentang()
      .map((b) => S.siap.get(b.kunci))
      .filter((s) => s && s.hasil !== "berhasil" && s.hasil !== "dobel");
    const siap = dipilih.filter((s) => mesin.kiriman({ ...s, hasil: undefined }));
    if (!siap.length || S.jalan) return;
    let setuju = true;
    try {
      const nGanti = siap.filter((s) => s.ganti).length;
      setuju = window.confirm(
        `Unggah ${siap.length} berkas ke e-Doc SIPP sekarang?\n\nBerkas dikirim satu per satu. ` +
          (nGanti
            ? `${nGanti} di antaranya MENGGANTI e-Doc BAS yang sudah ada (berkas lama dipindah ke folder "terhapus"); yang lain tidak diganti.`
            : "e-Doc yang sudah ada tidak diganti.") +
          " Bila satu gagal, sisanya tidak dikerjakan."
      );
    } catch {
      setuju = true;
    }
    if (!setuju) return;
    S.jalan = true;
    S.pembatal = new AbortController();
    S.fase = "unggah";
    for (const s of dipilih) {
      delete s.hasil;
      delete s.catatanHasil;
    }
    gambar();
    let n = 0;
    const ringkas = await mesin.jalankan(dipilih, {
      sinyal: S.pembatal.signal,
      lapor: (s, keadaan, teks) => {
        if (keadaan !== "jalan") n += 1;
        status(`Mengunggah… ${n} dari ${dipilih.length} selesai`);
        laporBaris(s, keadaan, teks);
      },
    });
    const catat = await mesin.catatRiwayat(ringkas);
    ringkas.riwayat = catat.ok;
    S.ringkas = ringkas;
    S.riwayat = null;
    S.jalan = false;
    S.pembatal = null;
    status(f41KalimatHasil(f41Hitung(ringkas)));
    gambar();
  }

  /** Kalimat konfirmasi Ganti satu BAS (butir 43-44). Murni. */
  function kalimatGanti(b, jalurLama) {
    return (
      `Ganti e-Doc BAS sidang ke-${b.urutan || "?"} perkara ${b.nomorPerkara}?\n\n` +
      `Berkas yang sekarang di SIPP${jalurLama ? ` (${jalurLama})` : ""} TIDAK dihapus: dipindah ke folder "terhapus" di folder dokumen SIPP. ` +
      `Penggantinya dicetak dari blangko BAS di ABT. Sesudah diperiksa, tekan Unggah untuk mengirimnya.`
    );
  }

  /** Tombol Ganti: konfirmasi, lalu pratinjau baris itu sebagai PENGGANTI (dicentang, belum dikirim). */
  async function siapkanGanti(kunci) {
    const b = daftarTab().find((x) => x.kunci === kunci);
    if (!b || b.jenis !== "bas" || S.jalan) return;
    const lama = S.siap.get(kunci);
    let setuju = false;
    try {
      setuju = window.confirm(kalimatGanti(b, (lama && lama.jalurLama) || b.jalurBas || ""));
    } catch {
      setuju = false;
    }
    if (!setuju) return;
    S.jalan = true;
    gambar();
    laporBaris({ baris: b }, "jalan", "menyiapkan pengganti…");
    const s = await mesin.siapkan(b, (t) => laporBaris({ baris: b }, "jalan", t), { ganti: true, tebakanDiperiksa: S.tebakanOk.has(kunci) });
    S.siap.set(kunci, s);
    if (s.keadaan === "siap") S.centang.add(kunci);
    S.jalan = false;
    status(s.keadaan === "siap" ? `${b.nomorPerkara} sidang ke-${b.urutan || "?"} siap MENGGANTI e-Doc lama - tekan Unggah.` : `${b.nomorPerkara}: ${s.halangan}`);
    gambar();
  }

  async function lihatAnonim(kunci) {
    const s = S.siap.get(kunci);
    if (!s || !s.anonim) return;
    const pilih = await mesin.deps.pratinjauAnonim(s.anonim, { nomor: s.baris.nomorPerkara });
    if (pilih === "unggah") s.keputusanAnonim = "unggah";
    else if (pilih === "tanpa") s.keputusanAnonim = "tanpa";
    gambar();
  }

  function tutup() {
    if (S.jalan) {
      status("Tunggu sampai unggahan berhenti - tekan Hentikan lebih dulu.");
      return;
    }
    document.removeEventListener("keydown", tombol, true);
    tirai.remove();
    f41Terbuka = null;
  }
  function tombol(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      tutup();
    }
  }

  tirai.addEventListener("click", (e) => {
    const t = e.target;
    const c = (s) => (t && t.closest ? t.closest(s) : null);
    if (t === tirai) return tutup();
    const aksi = c("[data-f41]");
    const kode = aksi ? aksi.getAttribute("data-f41") : "";
    if (kode === "tutup") return tutup();
    if (kode === "periksa") return void periksa();
    if (kode === "unggah") return void unggah();
    if (kode === "henti" && S.pembatal) {
      S.pembatal.abort();
      status(S.fase === "periksa" ? "Pemeriksaan berhenti sesudah berkas yang sedang diperiksa selesai…" : "Berhenti sesudah berkas yang sedang dikirim selesai…");
      return;
    }
    const tb = c("[data-f41-tebakan]");
    if (tb && !S.jalan) return void tandaiTebakan(tb.getAttribute("data-f41-tebakan"));
    if (kode === "semua" && !S.jalan) {
      // Yang sudah ada di SIPP tidak ikut "Centang semua" - Ganti selalu satu per satu.
      for (const b of daftarTab()) if (!b.adaBas) S.centang.add(b.kunci);
      return gambar();
    }
    if (kode === "bersih" && !S.jalan) {
      for (const b of daftarTab()) S.centang.delete(b.kunci);
      return gambar();
    }
    if (kode === "muat" && !S.jalan) return void muat();
    const tab = c("[data-f41-tab]");
    if (tab && !S.jalan) {
      S.tab = tab.getAttribute("data-f41-tab");
      return gambar();
    }
    const an = c("[data-f41-anonim]");
    if (an && !S.jalan) return void lihatAnonim(an.getAttribute("data-f41-anonim"));
    const gt = c("[data-f41-ganti]");
    if (gt && !S.jalan) return void siapkanGanti(gt.getAttribute("data-f41-ganti"));
  });
  tirai.addEventListener("change", (e) => {
    const t = e.target;
    if (t && t.getAttribute && t.getAttribute("data-f41-centang")) {
      const k = t.getAttribute("data-f41-centang");
      if (t.checked) S.centang.add(k);
      else S.centang.delete(k);
      gambarAlat();
      segarkanTombol();
    } else if (t && t.getAttribute && t.getAttribute("data-f41") === "bas-ada") {
      S.basAda = Boolean(t.checked);
      void muat();
    } else if (t && t.getAttribute && t.getAttribute("data-f41") === "saringan") {
      S.saringan = { ...S.saringan, [S.tab]: t.value };
      void muat();
    }
  });
  document.addEventListener("keydown", tombol, true);
  document.body.appendChild(tirai);
  f41Terbuka = tirai;
  const tutupTombol = q('[data-f41="tutup"]');
  if (tutupTombol) tutupTombol.focus();
  tirai.__f41 = { S, muat, periksa, unggah, mesin, siapkanGanti, kalimatGanti };
  void muat();
  return tirai;
}

/** Tombol "Unggah massal" di panel massal ABT (UI Baru/Baru saja), Blangko Derry, dan alamat #aleta-unggah-massal. */
function f41Pasang() {
  try {
    globalThis.aletaUnggahMassal = { buka: aletaUnggahMassalBuka };
  } catch {
    /* tanpa globalThis */
  }
  // Blangko ABT by Derry Briantono: alat "Unggah massal" (hakim & PP) - didaftarkan begitu API-nya ada.
  let coba = 0;
  const daftarkanBd = () => {
    const bd = globalThis.aletaBlangkoDerry;
    if (bd && typeof bd.daftarkanAlat === "function") {
      bd.daftarkanAlat("massal:unggah", () => aletaUnggahMassalBuka(""));
      return;
    }
    if ((coba += 1) < 40) setTimeout(daftarkanBd, 500);
  };
  daftarkanBd();
  // Dari SIPP (penyatu M2): .../abt/main/beranda#aleta-unggah-massal=bas
  const dariHash = () => {
    const m = String(location.hash || "").match(new RegExp(`${F41_HASH}(?:=(putusan|bas))?`));
    if (m) aletaUnggahMassalBuka(m[1] || "");
  };
  window.addEventListener("hashchange", dariHash);
  setTimeout(dariHash, 800);
  // Bagian di panel massal ABT (beranda) - Tampilan Lama tidak berubah.
  let ulang = 0;
  const sisip = () => {
    if (typeof alatUjiMode === "function" && alatUjiMode() === "lama") return;
    const panel = document.getElementById(typeof PENANDA_MASSAL_ABT === "string" ? PENANDA_MASSAL_ABT : "aleta-panel-abt-massal");
    if (!panel) {
      if ((ulang += 1) < 30) setTimeout(sisip, 1000);
      return;
    }
    if (panel.querySelector(".aleta-f41-bagian")) return;
    // Audit hak 23 Okt 2026: sama dengan hakUnggahMassal di portal (rute unggah-massal 403 bagi yang lain) -
    // putusan: Hakim, Ketua/Wakil; BAS: PP, Panitera, Panmud, staf kepaniteraan; plus Admin/Super Admin.
    // Akun belum terbaca = tetap ditawarkan (rutenya yang menjaga).
    try {
      const akun = typeof alatPenggunaAkunAleta === "function" ? alatPenggunaAkunAleta() : null;
      if (akun && typeof alatGolonganMenuSemua === "function") {
        const g = alatGolonganMenuSemua(akun);
        if (!g.some((x) => ["admin", "ketua", "hakim", "pp", "panitera", "panitera-utama", "panmud", "analis"].includes(x))) return;
      }
    } catch {
      /* gerbang tak terbaca: biarkan rute yang menjaga */
    }
    const kotak = document.createElement("div");
    kotak.className = "aleta-bagian aleta-f41-bagian";
    const tombolBuka = document.createElement("button");
    tombolBuka.type = "button";
    tombolBuka.className = "aleta-perkakas-aksi";
    tombolBuka.textContent = "Unggah massal ke e-Doc SIPP";
    tombolBuka.title = "Putusan (hakim) atau BAS (panitera pengganti) yang belum ada di SIPP - centang, periksa, unggah berurutan.";
    tombolBuka.addEventListener("click", () => aletaUnggahMassalBuka(""));
    kotak.appendChild(tombolBuka);
    const isi = panel.querySelector(".aleta-isi") || panel;
    isi.insertBefore(kotak, isi.firstChild);
  };
  setTimeout(sisip, 1500);
}
if (typeof window !== "undefined" && typeof document !== "undefined" && /\/abt(\/|$)/.test(String((typeof location !== "undefined" && location.pathname) || "")) && !globalThis.__aletaF41Uji) {
  try {
    void (typeof sedangAktif === "function" ? sedangAktif() : Promise.resolve(true))
      .then((aktif) => {
        if (aktif) f41Pasang();
      })
      .catch(() => {});
  } catch (e) {
    if (typeof alatCatat === "function") alatCatat("galat", `unggah massal tidak terpasang: ${String((e && e.message) || e)}`, "");
  }
}

function f15LabelCetak() {
  return cetakTigaMenyala ? "Cetak · 3 berkas" : "Cetak";
}

function f15JudulCetak() {
  return (
    (cetakTigaMenyala
      ? "Mencetak blangko yang terbuka untuk perkara ini: .rtf, PDF, dan .rtf anonim (saklar \"Cetak tiga berkas\" di popup ALETA menyala)."
      : "Mencetak blangko yang terbuka untuk perkara ini sebagai .rtf - sama dengan CETAK di ABT. Tiga berkas (RTF, PDF, anonim) dinyalakan dari popup ALETA.") +
    " Sebelum mencetak, ALETA memeriksa usulan pasti yang belum disimpan, isian yang masih kosong, dan bagian naskah yang belum terisi."
  );
}

/** Label & keterangan tombol Cetak mengikuti saklar tiga berkas (dipanggil segarkanPenandaCetak). */
function f15SegarkanLabel() {
  for (const t of Array.from(document.querySelectorAll(".aleta-f15-cetak"))) {
    if (t.getAttribute("aria-busy") === "true" || t.getAttribute("aria-disabled") === "true") continue;
    t.textContent = f15LabelCetak();
    t.title = f15JudulCetak();
  }
}

/* === AKHIR F1.5 === */
