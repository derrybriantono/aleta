"use strict";

/**
 * ============================================================================
 * DETEKSI ITSBAT NIKAH (voluntair 360 & kontentius) - 13 Okt 2026, butir 14
 * ============================================================================
 *
 * Contoh nyata: 228/Pdt.P/2026/PA.Dgl. Panel berkata "Tidak ada data baru"
 * padahal 1002, 1046, 5105, 5178 masih DATA_TIDAK_ADA. Sebabnya dua:
 *   1. pengurai lama tidak membaca bentuk posita satker:
 *        5105  berhenti di koma pertama -> "Desa Lembantongoa" (tanpa kecamatan dst.)
 *        5178  hanya nama kecamatan ("Palolo") - isian petugas 278/278 berbentuk
 *              "Kantor Urusan Agama Kecamatan X, Kabupaten Y, Provinsi Z"
 *        1046  status wali di dalam kurung sesudah nama ("Samsul Bahri (Ayah
 *              Kandung Pemohon II)") tidak terbaca sama sekali
 *   2. karena itu ketepatannya terukur rendah, dan GERBANG_ITSBAT
 *      menyerahkannya ke "bawaan ABT" - padahal bawaan itu hanya muncul di
 *      jendela sembul, tidak pernah tersimpan: barisnya tetap DATA_TIDAK_ADA.
 *
 * Aturan di sini membaca kalimat posita sendiri; yang tidak tertulis
 * dikosongkan, tidak ditebak.
 */

const wilayah = require("./wilayah");

/** Peta variabel blangko Itsbat Nikah (Blangko Derry "2 Itsbat Nikah" [01]/[01a]/[01b]/[03] + BAS) -> sumber. */
const VARIABEL = Object.freeze([
  { kode: "5197", nama: "Tanggal nikah", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "5105", nama: "Alamat tempat menikah", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "5178", nama: "KUA kecamatan (domisili, tempat mencatatkan)", sumber: "posita", blangko: ["putusan"] },
  { kode: "1217", nama: "Nama wali nikah", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "1046", nama: "Status wali nikah", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "8087", nama: "Yang menikahkan", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "0650", nama: "Saksi nikah 1", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "0651", nama: "Saksi nikah 2", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "1001", nama: "Mas kawin", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "1002", nama: "Status Pemohon I sebelum nikah", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "1003", nama: "Status Pemohon II sebelum nikah", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "7211", nama: "Umur Pemohon I saat menikah", sumber: "posita", blangko: ["putusan"] },
  { kode: "7212", nama: "Umur Pemohon II saat menikah", sumber: "posita", blangko: ["putusan"] },
  { kode: "0007", nama: "Telah dikaruniai anak", sumber: "posita", blangko: ["putusan", "bas"] },
  { kode: "0364", nama: "Tgl. KTP Pemohon I", sumber: "ktp-ecourt", blangko: ["putusan"] },
  { kode: "0366", nama: "Tgl. KTP Pemohon II", sumber: "ktp-ecourt", blangko: ["putusan"] },
  { kode: "9958", nama: "Alat bukti itsbat terpadu (bagian tanggal KTP)", sumber: "ktp-ecourt", blangko: ["putusan"] },
  { kode: "8171", nama: "Tujuan itsbat (untuk ...)", sumber: "posita", blangko: ["bas"] },
  { kode: "1357", nama: "Alasan wali nikah", sumber: "posita", blangko: ["bas"] },
  { kode: "0228", nama: "Alasan syahadah istifadhah", sumber: "saksi-sipp", blangko: ["putusan [01a]"] },
  { kode: "1197", nama: "Identitas & keterangan saksi (1197-1208, 1241, 1242)", sumber: "dihitung-abt", blangko: ["putusan", "bas"] },
  { kode: "1358", nama: "Alasan tiada buku nikah", sumber: "dihitung-abt", blangko: ["putusan"] },
  { kode: "0098", nama: "Identitas, nomor, majelis, biaya, tanggal sidang (0001-0312, 6032-8505)", sumber: "dihitung-abt", blangko: ["putusan", "bas"] },
]);

const POLA_NIKAH = /(menikah|pernikahan|perkawinan|akad\s+nikah|ijab\s+(?:kabul|qabul)|dinikahkan)/i;
/** Anak kalimat yang bukan lagi tempat menikah. */
const POTONG_TEMPAT =
  /\b(?:namun|sehingga|karena|tetapi|sedangkan|sementara|dengan\s+wali|wali\s+nikah|yang\s+menikahkan|dengan\s+mas\s*kawin|dengan\s+mahar|berstatus|dikaruniai|bertempat\s+tinggal|tinggal\s+bersama|setelah\s+menikah|sejak\s+menikah)\b/i;
const POLA_TIDAK_DICATAT = /\btidak\s+(?:ter|di)?(?:daftar|catat)/i;

/**
 * Tempat menikah (5105) dari kalimat-kalimat posita.
 * Kalimat pertama yang menyebut pernikahan + wilayah (desa/kecamatan/KUA)
 * menjadi dasar; kalimat pernikahan berikutnya yang SELARAS (tidak
 * bertentangan) hanya melengkapi ruas yang kosong.
 * @returns {{nilai: string, komponen: object|null, kalimat: string}}
 */
function tempatNikah(kalimat) {
  const calon = [];
  for (const k of kalimat || []) {
    const awal = k.search(POLA_NIKAH);
    if (awal < 0) continue;
    const seg = k.slice(awal).split(POTONG_TEMPAT)[0];
    if (POLA_TIDAK_DICATAT.test(seg)) continue;
    const komp = wilayah.komponenWilayah(seg);
    if (!komp.desa && !komp.kecamatan) continue;
    calon.push({ komp, k });
  }
  if (!calon.length) return { nilai: "", komponen: null, kalimat: "" };
  // Dasarnya sebutan TERAKHIR - kalimat permohonan penetapan ("menetapkan sahnya perkawinan ... yang terjadi
  // pada ... di ...") yang menjadi amar; posita satker kerap salah ketik di butir pertama ("Kabupaten
  // Dongggala", Kinovaro "Kabupaten Donggala" lalu "Kabupaten Sigi") dan petugas mengikuti yang terakhir
  // (50 perkara, ukur 13 Okt). Ruas yang kosong dilengkapi dari sebutan lain yang desa/kecamatannya sama.
  const dasar = { ...calon[calon.length - 1].komp };
  const asal = calon[calon.length - 1].k;
  for (let i = calon.length - 2; i >= 0; i--) {
    const c = calon[i].komp;
    const bentrok = ["desa", "kecamatan"].some((r) => dasar[r] && c[r] && wilayah.rapat(dasar[r]) !== wilayah.rapat(c[r]));
    const bertemu = ["desa", "kecamatan"].some((r) => dasar[r] && c[r] && wilayah.rapat(dasar[r]) === wilayah.rapat(c[r]));
    if (bentrok || !bertemu) continue;
    for (const r of ["desa", "kecamatan", "kabupaten", "provinsi"]) if (!dasar[r] && c[r]) dasar[r] = c[r];
  }
  return { nilai: wilayah.tulisWilayah(dasar), komponen: dasar, kalimat: asal };
}

const POLA_KUA = /\b(?:Kantor\s+Urusan\s+Agama|KUA)\b/gi;
const POLA_CATAT = /(terdaftar|tercatat|dicatat|dicatatkan|mencatat|mencatatkan|didaftarkan|mendaftar|daftarkan|catatkan)/i;

/**
 * KUA tempat mencatatkan (5178). Blangko [01]: "Pegawai Pencatat Nikah yang
 * mewilayahi domisili Pemohon saat ini, dalam hal ini adalah #5178#".
 * Didahulukan sebutan KUA dalam kalimat PENCATATAN ("tidak terdaftar di KUA
 * Kecamatan X") - yang terakhir; tanpa itu, sebutan KUA terakhir mana pun
 * (sama dengan bawaan ABT #10103#). "KUA Kecamatan setempat" = KUA tempat
 * menikah. Kabupaten/provinsi diambil dari sebutan itu; bila tidak ada dan
 * kecamatannya sama dengan tempat menikah, dipinjam dari tempat menikah.
 * @returns {{nilai: string, kalimat: string}}
 */
function kuaDomisili(kalimat, tempat) {
  let catat = null;
  let akhir = null;
  let setempat = "";
  for (const k of kalimat || []) {
    const t = wilayah.rapatWilayah(k);
    let m;
    POLA_KUA.lastIndex = 0;
    while ((m = POLA_KUA.exec(t)) !== null) {
      const seg = t.slice(m.index).split(/\b(?:sehingga|karena|namun|dengan\s+alasan|sementara|yang\s+berwenang)\b|;/i)[0];
      const komp = wilayah.komponenWilayah(seg);
      const dicatat = POLA_CATAT.test(t.slice(Math.max(0, m.index - 90), m.index));
      if (!komp.kecamatan) {
        if (dicatat && /^\S+(?:\s+\S+){0,3}\s+(?:Kecamatan\s+)?setempat\b/i.test(seg)) setempat = k;
        continue;
      }
      const calon = { komp, kalimat: k };
      if (dicatat) catat = calon;
      akhir = calon;
    }
  }
  let pilih = catat || akhir;
  if (!pilih && setempat && tempat && tempat.komponen && tempat.komponen.kecamatan) {
    pilih = { komp: { kecamatan: tempat.komponen.kecamatan, kabupaten: "", provinsi: "" }, kalimat: setempat };
  }
  if (!pilih) return { nilai: "", kalimat: "" };
  const c = { ...pilih.komp };
  const tk = tempat && tempat.komponen;
  if (tk && wilayah.rapat(tk.kecamatan) === wilayah.rapat(c.kecamatan)) {
    if (!c.kabupaten) c.kabupaten = tk.kabupaten;
    if (!c.provinsi && (!c.kabupaten || c.kabupaten === tk.kabupaten)) c.provinsi = tk.provinsi;
  }
  return {
    nilai: [`Kantor Urusan Agama Kecamatan ${c.kecamatan}`, c.kabupaten, c.provinsi].filter(Boolean).join(", "),
    kalimat: pilih.kalimat,
  };
}

/* ---------------------------------------------------------------------------
 * STATUS WALI NIKAH (1046)
 * ------------------------------------------------------------------------- */

const KEPALA_WALI = new Set(["ayah", "bapak", "kakak", "adik", "saudara", "saudarah", "paman", "om", "kakek", "sepupu", "sepupuh", "keponakan", "ponakan", "anak", "wali"]);
const LANJUT_WALI = new Set([
  "ayah", "bapak", "kakak", "adik", "saudara", "saudarah", "paman", "om", "kakek", "sepupu", "sepupuh", "keponakan", "ponakan", "anak",
  "kandung", "laki-laki", "lakilaki", "laki", "seayah", "seibu", "sebapak", "tiri", "dari", "hakim", "pemohon", "termohon", "penggugat",
  "tergugat", "i", "ii", "iii", "1", "2", "sepupu", "tertua", "sulung", "kedua", "pertama",
]);

function judul(s) {
  return String(s)
    .split(" ")
    .map((w) => {
      if (/^\(?(?:i{1,3}|iv)\)?$/i.test(w)) return w.toUpperCase();
      if (/^\(?dari\)?$/i.test(w)) return w.toLowerCase();
      const buka = w.startsWith("(") ? "(" : "";
      const isi = w.slice(buka.length);
      return buka + isi.charAt(0).toUpperCase() + isi.slice(1).toLowerCase();
    })
    .join(" ");
}

/** Frasa hubungan wali di AWAL teks ("Ayah Kandung Pemohon II (saudara ayah)"); "" bila bukan. */
function frasaWali(teks) {
  const t = String(teks || "").trim();
  const token = t.split(/\s+/);
  const hasil = [];
  for (let i = 0; i < token.length; i++) {
    const tk = token[i];
    // keterangan dalam kurung milik frasa: "paman kandung (saudara ayah) Pemohon II"
    if (hasil.length && /^\(/.test(tk)) {
      const tutup = t.indexOf(")", t.indexOf(tk));
      const isi = tutup > 0 ? t.slice(t.indexOf(tk), tutup + 1) : "";
      // hanya keterangan hubungan ("(saudara ayah)", "(ayah dari ayah)") - bukan nama ("(Irfan)")
      const kataPertama = isi.replace(/^\(\s*/, "").split(/[\s)]+/)[0].toLowerCase();
      if (isi && isi.length < 40 && !/\d/.test(isi) && LANJUT_WALI.has(kataPertama)) {
        hasil.push(isi.replace(/\s+/g, " "));
        i += isi.split(/\s+/).length - 1;
        continue;
      }
      break;
    }
    const inti = tk.replace(/[,;:.)]+$/, "");
    const kecil = inti.toLowerCase();
    if (!hasil.length ? !KEPALA_WALI.has(kecil) : !LANJUT_WALI.has(kecil)) break;
    if (kecil === "wali" && !/^hakim\b/i.test(token[i + 1] || "")) break;
    hasil.push(inti);
    if (inti !== tk) break;
  }
  while (hasil.length && /^(?:dari|laki)$/i.test(hasil[hasil.length - 1])) hasil.pop();
  if (!hasil.length) return "";
  return judul(hasil.join(" ").replace(/\s+/g, " ").trim());
}

/**
 * Status wali nikah dari kalimat wali. Bentuk (posita nyata):
 *   "wali nikah yaitu Samsul Bahri (Ayah Kandung Pemohon II)"     -> kurung sesudah nama
 *   "dengan wali nikah saudara kandung Pemohon II bernama X"       -> langsung sesudah "wali nikah"
 *   "Wali Nikah adalah AYAH KANDUNG yang bernama SAHMI"
 *   "wali nikah yang bernama Barda (Paman Kandung Pemohon karena ...)"
 *   "dengan wali hakim"
 * Alasan ("karena ayah kandung telah meninggal") tidak ikut - itu #1357#.
 */
function statusWali(kalimat) {
  for (const k of kalimat || []) {
    const i = k.search(/\bwali\b/i);
    if (i < 0) continue;
    // Batas: jangan sampai ke yang menikahkan / saksi / mahar di kalimat yang sama.
    const bagian = k.slice(i).split(/\b(?:yang\s+menikahkan|menikahkan|saksi|mahar|mas\s+kawin|dihadiri)\b/i)[0];
    if (/^wali\s+hakim\b/i.test(bagian)) return { nilai: "Wali Hakim", kalimat: k };
    // 1. langsung sesudah "wali nikah (nya)? (adalah|yaitu|ialah|oleh|:)?"
    const lepas = bagian.replace(/^wali(?:\s+nikah)?(?:nya)?\s*(?:pemohon\s+ii?\s*)?(?:adalah|yaitu|ialah|oleh|:)?\s*(?:seorang\s+)?/i, "");
    let f = frasaWali(lepas);
    if (f && f.toLowerCase() !== "wali") return { nilai: f, kalimat: k };
    // 2. dalam kurung sesudah nama
    const kurung = bagian.match(/\(\s*([^()]{3,90})\)/);
    if (kurung) {
      f = frasaWali(kurung[1].split(/\s*,?\s*karena\b/i)[0]);
      if (f) return { nilai: f, kalimat: k };
    }
    // 3. "bernama X selaku/sebagai ayah kandung Pemohon II"
    const selaku = bagian.match(/\b(?:selaku|sebagai|yang\s+merupakan|merupakan)\s+(.{3,60})/i);
    if (selaku) {
      f = frasaWali(selaku[1]);
      if (f) return { nilai: f, kalimat: k };
    }
  }
  return { nilai: "", kalimat: "" };
}

/* ---------------------------------------------------------------------------
 * STATUS SEBELUM NIKAH (1002/1003) - cadangan bila tanpa kata "berstatus"
 * ------------------------------------------------------------------------- */

const KATA_STATUS = "jejaka|perjaka|bujang|lajang|duda(?:\\s+(?:cerai\\s+)?(?:mati|hidup))?|perawan|gadis|janda(?:\\s+(?:cerai\\s+)?(?:mati|hidup))?";

function judulAwal(s) {
  return String(s).replace(/\s+/g, " ").trim().replace(/^./, (h) => h.toUpperCase());
}

/** "Pemohon I masih jejaka", "Pemohon II berstatus gadis" -> "Jejaka" / "Gadis"; "" bila tidak tertulis. */
function statusSebelumNikah(kalimat, sebut) {
  const lolos = String(sebut).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // "Pemohon" tunggal tidak boleh memakan "Pemohon I/II".
  const re = new RegExp(`${lolos}(?!I)(?!\\s+I{1,2}\\b)\\s+(?:saat\\s+itu\\s+|ketika\\s+itu\\s+)?(?:masih\\s+)?(?:berstatus\\s+)?(?:adalah\\s+)?(?:seorang\\s+)?(?:masih\\s+)?(${KATA_STATUS})\\b`, "i");
  for (const k of kalimat || []) {
    if (/suami\s+ist?e?ri/i.test(k) && !/berstatus/i.test(k)) continue;
    const m = k.match(re);
    if (m) return { nilai: judulAwal(m[1]), kalimat: k };
  }
  return { nilai: "", kalimat: "" };
}

const POLA_PRIA = /\b(jejaka|perjaka|bujang|lajang|duda(?:\s+(?:cerai\s+)?(?:mati|hidup))?)\b/i;
const POLA_WANITA = /\b(perawan|gadis|janda(?:\s+(?:cerai\s+)?(?:mati|hidup))?)\b/i;

/**
 * #1002# = status SUAMI, #1003# = status ISTRI (blangko itsbat & kumulasi). Sebutan pihak tidak selalu
 * menunjuk suami (cerai gugat: Penggugat = istri), jadi status dibaca menurut KATA-nya: jejaka/perjaka/
 * bujang/lajang/duda = suami, perawan/gadis/janda = istri - di kalimat yang menyebut status.
 */
function statusMenurutJenisKelamin(kalimat) {
  const hasil = { pria: { nilai: "", kalimat: "" }, wanita: { nilai: "", kalimat: "" } };
  for (const k of kalimat || []) {
    if (!/\b(?:berstatus|status)\b/i.test(k)) continue;
    const p = k.match(POLA_PRIA);
    const w = k.match(POLA_WANITA);
    // Umur tepat sesudah kata status ("berstatus Perjaka dalam usia 21 tahun", "(...) dalam usia ( 27) tahun").
    const umur = (m) => {
      const sisa = k.slice(m.index + m[0].length).replace(/^\s*\([^()]{0,120}\)/, "");
      const u = sisa.match(/^\s*,?\s*(?:dalam\s+usia|dengan\s+umur|berumur|berusia|umur|usia)\s*\(?\s*(\d{1,2})\s*\)?\s*(?:\([a-z ]+\)\s*)?tahun/i);
      return u ? `${Number(u[1])} tahun` : "";
    };
    if (p && !hasil.pria.nilai) hasil.pria = { nilai: judulAwal(p[1]), kalimat: k, umur: umur(p) };
    if (w && !hasil.wanita.nilai) hasil.wanita = { nilai: judulAwal(w[1]), kalimat: k, umur: umur(w) };
  }
  return hasil;
}

/* ---------------------------------------------------------------------------
 * ANAK (0007) - bunyi posita sendiri
 * ------------------------------------------------------------------------- */

/** "telah dikaruniai 2 (dua) orang anak" / "telah dikaruniai seorang anak" / "belum dikaruniai anak". */
function anakDariPosita(kalimat) {
  for (const k of kalimat || []) {
    const m = k.match(
      /\b((?:telah|sudah|belum)\s+)?(?:di)?karunia(?:i)?\s+(?:oleh\s+allah\s+(?:swt\.?\s+)?)?((?:\d+\s*(?:\([a-z ]+\)\s*)?orang\s+anak)|(?:seorang|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh)\s+(?:\(\d+\)\s*)?(?:orang\s+)?anak|anak|keturunan)\b/i
    );
    if (!m) continue;
    const kata = (m[1] || "").trim().toLowerCase();
    const isi = m[2].replace(/\s+/g, " ").trim().toLowerCase();
    // Sisa templat yang tidak dipilih ("telah/belum dikaruniai", "belum dikarunia 1 orang anak"): tidak diisi.
    if (/\btelah\s*\/\s*belum\b|\bbelum\s*\/\s*telah\b/i.test(k)) return { nilai: "", kalimat: k, jumlah: null };
    const belum = kata === "belum" || /\btidak\s+(?:di)?karunia/i.test(k);
    if (belum && jumlahAnak(isi)) return { nilai: "", kalimat: k, jumlah: null };
    if (belum) return { nilai: "belum dikaruniai anak", kalimat: k, jumlah: 0 };
    if (/^(?:anak|keturunan)$/.test(isi)) return { nilai: "", kalimat: k, jumlah: null };
    return { nilai: `${kata || "telah"} dikaruniai ${isi}`, kalimat: k, jumlah: jumlahAnak(isi) };
  }
  return { nilai: "", kalimat: "", jumlah: null };
}

const ANGKA_KATA = { seorang: 1, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10 };

/** Jumlah anak dari bunyi isian ("2 (dua) orang anak", "seorang anak", "belum ..."); null bila tidak tersebut. */
function jumlahAnak(teks) {
  const t = String(teks || "").toLowerCase();
  if (/\bbelum\b|\btidak\b/.test(t)) return 0;
  const d = t.match(/(\d+)\s*(?:\([a-z ]+\)\s*)?(?:orang\s+)?anak/);
  if (d) return Number(d[1]);
  const w = t.match(/\b(seorang|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh)\b(?:\s+\(\d+\))?\s+(?:orang\s+)?anak/);
  return w ? ANGKA_KATA[w[1]] : null;
}

/* ---------------------------------------------------------------------------
 * ITSBAT KONTENTIUS - PASANGAN YANG SUDAH MENINGGAL (1025, 1246, 1247, 1509)
 * ------------------------------------------------------------------------- */

/**
 * Blangko "2a Itsbat Nikah Kontensius": "Nama Almarhum" (1025), tanggal (1246), sebab (1247), tempat (1509)
 * meninggal. Posita satker: "Tahir Xxx bin Yyy telah meninggal lebih dulu karena sakit pada tanggal 19
 * November 2025 sesuai dengan Kutipan Akta Kematian ...". Nama = nama orang di AWAL kalimat yang sama
 * (bukan "Pemohon"); tanggal/sebab/tempat memakai pengurai modul waris (agen X) yang sudah diukur.
 */
function pasanganWafat(kalimat) {
  const { namaDiAwal } = require("../abtUsulanService");
  for (const k of kalimat || []) {
    const w = /\b(?:telah\s+)?(?:meninggal(?:\s+dunia)?|wafat)\b/i.exec(k);
    if (!w || w.index > 140) continue;
    const nama = namaDiAwal(k);
    if (!nama || nama.split(" ").length < 1 || k.indexOf(nama) > 15) continue;
    const inti = nama.split(/\s+/).find((x) => x.length >= 3 && !/^(?:bin|binti)$/i.test(x));
    let fakta = null;
    try {
      fakta = require("./waris").faktaWafat([k], inti || "");
    } catch (_) {
      fakta = null;
    }
    return { nama, tanggal: (fakta && fakta.tanggal) || "", sebab: (fakta && fakta.sebab) || "", tempat: (fakta && fakta.tempat) || "", kalimat: k };
  }
  return null;
}

/**
 * Fakta itsbat dari posita - murni.
 * @param {string} posita
 * @param {{kalimat?: string[], pemohon?: string, pemohon2?: string}} opsi
 */
function deteksi(posita, opsi = {}) {
  const kalimat = opsi.kalimat || require("../abtUsulanService").kalimatPosita(posita);
  const hasil = {};
  const tempat = tempatNikah(kalimat);
  if (tempat.nilai) hasil["5105"] = { nilai: tempat.nilai, kalimat: tempat.kalimat, yakin: "cukup", kodePola: "itsbat-tempat-nikah" };
  const kua = kuaDomisili(kalimat, tempat);
  if (kua.nilai) hasil["5178"] = { nilai: kua.nilai, kalimat: kua.kalimat, yakin: "cukup", kodePola: "itsbat-kua-domisili" };
  const wali = statusWali(kalimat);
  if (wali.nilai) hasil["1046"] = { nilai: wali.nilai, kalimat: wali.kalimat, yakin: "cukup", kodePola: "itsbat-status-wali" };
  const anak = anakDariPosita(kalimat);
  if (anak.nilai) hasil["0007"] = { nilai: anak.nilai, kalimat: anak.kalimat, yakin: "cukup", kodePola: "itsbat-anak" };
  const coba = (daftar) => {
    for (const sebut of daftar) {
      if (!sebut) continue;
      const r = statusSebelumNikah(kalimat, sebut);
      if (r.nilai) return r;
    }
    return { nilai: "", kalimat: "" };
  };
  // #1002# = "Status #0046# sblm nikah": pihak #0046# - itsbat/cerai talak = suami, CERAI GUGAT = istri
  // (Penggugat). Isian petugas cerai gugat: "Perawan" 9 dari 12 terbaru. #1003# = pihak lawannya.
  const sebut1 = String((opsi && opsi.pemohon) || "").trim();
  const istriDulu = /^penggugat\b/i.test(sebut1);
  const sebut2 = String((opsi && opsi.pemohon2) || "").trim() || (istriDulu ? "Tergugat" : /^pemohon$/i.test(sebut1) ? "Termohon" : "");
  const g = statusMenurutJenisKelamin(kalimat);
  // Status yang DISEBUT untuk pihak #0046# dipakai apa adanya, apa pun jenis kelaminnya (itsbat kontentius:
  // Pemohon = istri/janda, "Pemohon berstatus Perawan"). Tanpa sebutan itu barulah dipilih menurut kata status.
  let s1 = coba(istriDulu ? [sebut1] : /^pemohon(?:\s+i)?$/i.test(sebut1) || !sebut1 ? ["Pemohon I", "Pemohon"] : [sebut1]);
  const istri1 = s1.nilai ? POLA_WANITA.test(s1.nilai) : istriDulu;
  if (!s1.nilai) s1 = istri1 ? g.wanita : g.pria;
  if (s1.nilai) hasil["1002"] = { nilai: s1.nilai, kalimat: s1.kalimat, yakin: "cukup", kodePola: "itsbat-status-1" };
  let s2 = coba(istriDulu ? [sebut2] : ["Pemohon II", sebut2]);
  if (!s2.nilai || POLA_WANITA.test(s2.nilai) === istri1) s2 = istri1 ? g.pria : g.wanita;
  if (s2.nilai) hasil["1003"] = { nilai: s2.nilai, kalimat: s2.kalimat, yakin: "cukup", kodePola: "itsbat-status-2" };
  // 7211 "Umur Isbat P1 (Laki-Laki)", 7212 "Umur Isbat P2 (Perempuan)" - menurut jenis kelamin, bukan sebutan.
  if (g.pria.umur) hasil["7211"] = { nilai: g.pria.umur, kalimat: g.pria.kalimat, yakin: "cukup", kodePola: "itsbat-umur-pria" };
  if (g.wanita.umur) hasil["7212"] = { nilai: g.wanita.umur, kalimat: g.wanita.kalimat, yakin: "cukup", kodePola: "itsbat-umur-wanita" };
  // Kontentius: pasangan yang telah meninggal - "ragu" (isian manusia baru 7 perkara, belum dapat diukur).
  const wafat = pasanganWafat(kalimat);
  if (wafat) {
    const r = (nilai, kodePola) => ({ nilai, kalimat: wafat.kalimat, yakin: "ragu", kodePola });
    hasil["1025"] = r(wafat.nama, "itsbat-almarhum");
    if (wafat.tanggal) hasil["1246"] = r(wafat.tanggal, "itsbat-tanggal-wafat");
    if (wafat.sebab) hasil["1247"] = r(wafat.sebab, "itsbat-sebab-wafat");
    if (wafat.tempat) hasil["1509"] = r(wafat.tempat, "itsbat-tempat-wafat");
  }
  return hasil;
}

module.exports = {
  kunci: "itsbat-nikah",
  jenisPerkaraId: [360],
  variabel: VARIABEL,
  deteksi,
  tempatNikah,
  kuaDomisili,
  statusWali,
  frasaWali,
  statusSebelumNikah,
  anakDariPosita,
  pasanganWafat,
  jumlahAnak,
};
