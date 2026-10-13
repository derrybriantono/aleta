"use strict";

/**
 * ============================================================================
 * PEMBANTU DETEKSI IZIN POLIGAMI, HARTA BERSAMA, KEWARISAN & AHLI WARIS
 * ============================================================================
 *
 * Dipakai bersama oleh deteksi/poligami.js, deteksi/hartaBersama.js dan
 * deteksi/waris.js (13 Okt 2026, butir 16). Tiga hal:
 *
 *   baris(posita)          posita polos dipecah per butir (<p>/<li>/baris) -
 *                          satuan yang sama dengan yang diketik pihak.
 *   daftarSesudah(...)     DAFTAR benda sesudah kalimat pembuka ("memperoleh
 *                          harta sebagai berikut:", "harta peninggalan
 *                          berupa:"), satu benda satu butir. Baris rincian
 *                          ("Sebelah Utara : ...", "Pemegang Hak : ...",
 *                          "Lokasi : ...") digabung ke benda di atasnya.
 *                          Daftar berhenti pada butir "Bahwa ..." berikutnya.
 *   tanggalBaku(teks)      "12 bulan februari tahun 1986" -> "12 Februari 1986".
 *
 * Bentuknya diambil dari posita sungguhan PA Donggala 2016-2026 (sipp_donggala
 * salinan 9 Okt): poligami 8 posita, harta bersama 10, kewarisan 22, P3HP 91.
 * Tidak ada yang ditebak: benda yang tidak tertulis tidak pernah muncul.
 */

const usulanService = require("../abtUsulanService");

/** Posita polos, satu butir per baris (tanda HTML dibuang, spasi dirapatkan). */
function baris(posita) {
  return usulanService
    .polosPosita(posita)
    .split(/\n+/)
    .map((b) => b.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
}

/** Posita polos satu baris panjang (butir dipisah "; "). */
function satuBaris(posita) {
  return baris(posita).join("; ").replace(/;\s*;/g, ";");
}

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const POLA_BULAN = "(?:Jan(?:uari)?|Feb(?:ruari|uari)?|Pebruari|Mar(?:et)?|Apr(?:il)?|Mei|Jun(?:i)?|Jul(?:i)?|Agu(?:stus)?|Agt|Sep(?:tember)?|Okt(?:ober)?|Nov(?:ember)?|Nopember|Noember|Nofember|Des(?:ember)?)";

function bulanKe(nama) {
  const t = String(nama || "").toLowerCase();
  if (/^peb/.test(t)) return 1;
  if (/^no[pf]?e?m|^noe/.test(t)) return 10;
  if (/^agt/.test(t)) return 7;
  const i = BULAN.findIndex((b) => b.toLowerCase().startsWith(t.slice(0, 3)));
  return i;
}

/**
 * Tanggal tertulis di awal teks -> "D Bulan YYYY" (hari dua angka seperti
 * tertulis). Bentuk: "18 Mei 2023", "12 bulan februari tahun 1986",
 * "17-11-2024", "17/11/2024". "" bila tidak ada.
 */
const RE_TANGGAL = new RegExp(
  `(\\d{1,2})\\s*(?:bulan\\s+)?(${POLA_BULAN})\\.?\\s*(?:tahun\\s+)?(\\d{4})|(\\d{1,2})[-/](\\d{1,2})[-/](\\d{4})`,
  "i"
);
function tanggalBaku(teks) {
  const m = RE_TANGGAL.exec(String(teks || ""));
  if (!m) return "";
  const dua = (n) => String(Number(n)).padStart(2, "0");
  if (m[1]) {
    const b = bulanKe(m[2]);
    if (b < 0 || Number(m[1]) < 1 || Number(m[1]) > 31) return "";
    return `${dua(m[1])} ${BULAN[b]} ${m[3]}`;
  }
  const b = Number(m[5]);
  if (b < 1 || b > 12 || Number(m[4]) < 1 || Number(m[4]) > 31) return "";
  return `${dua(m[4])} ${BULAN[b - 1]} ${m[6]}`;
}
/** Indeks + panjang tanggal pertama di teks (atau null). */
function letakTanggal(teks) {
  const m = RE_TANGGAL.exec(String(teks || ""));
  return m ? { index: m.index, panjang: m[0].length, nilai: tanggalBaku(m[0]) } : null;
}

/** Butir posita baru: "Bahwa ...", "5. Bahwa ...", "PRIMER", "Berdasarkan ...", dst. */
const RE_BUTIR_BARU =
  /^(?:\d{1,2}\s*[.)]\s*)?(?:Bahwa|Bahawa|Berdasarkan|Maka|Oleh\s+karena|Demikian|PRIMER|PRIMAIR|SUBSIDER|SUBSIDAIR|Mohon|Membayar\s+biaya|Atas\s+dasar|Selanjutnya\s+disebut|Hormat)\b/i;

/** Baris rincian benda di atasnya (bukan benda baru). */
const RE_RINCIAN =
  /^(?:[-–•·o]\s*)?(?:(?:Di\s+)?Sebelah\s+|Batas\s+)?(?:Utara|Timur|Selatan|Barat|Pemegang\s+Hak|Nomor\s+(?:Hak|Registrasi|Polisi|Rangka|Mesin|Sertifikat)|No\.?\s*(?:Hak|Polisi|Pol|Rangka|Mesin)|Luas|Lokasi|Letak|Tanda[-\s]+tanda|Nama\s+Pemilik|Pemilik|Atas\s*nama|Bukti|Merk|Merek|Type|Tipe|Warna|Tahun(?:\s+Pembuatan)?|Isi\s+Silinder|Ukuran|Dengan\s+batas|Berbatas(?:an)?|Ditaksir|Seharga|Senilai|Nilai|Harga|Dibeli|Diperoleh|Yang\s+(?:dibeli|diperoleh|terletak|saat\s+ini))\b/i;

/** Awalan nomor/huruf butir daftar: "1.", "a.", "3.1.", "2.1", "-", "•", "I.". */
const RE_NOMOR_BUTIR = /^\s*(?:(?:\d{1,2}(?:\.\d{1,2})*|[a-zA-Z]|[IVX]{1,4})\s*[.)]\s+|\d{1,2}\.\d{1,2}\s+|[-–•·*]\s*|o\s+(?=[A-Z]))/;

/**
 * Butir yang memang BENDA (tanah, rumah, kendaraan, tabungan, ternak, perabot,
 * ...) - bukan kalimat cerita ("mobil dan motor tersebut dikuasai oleh
 * Tergugat ...") atau garis pemisah. Dipakai menyaring daftar.
 */
const RE_BENDA =
  /\b(?:sebidang|bidang|tanah|rumah|bangunan|gedung|ruko|toko|kios|kebun|sawah|empang|tambak|lahan|pekarangan|kavling|kapling|unit|mobil|motor|sepeda|kendaraan|truk|pick\s*up|perahu|kapal|emas|perhiasan|kalung|cincin|gelang|tabungan|rekening|deposito|uang|saham|sapi|kambing|kerbau|ternak|lemari|kulkas|televisi|tivi|tv|kursi|meja|mesin|springbed|kasur|perabot|peralatan|ac|kipas|kompor|sertifi?kat|shm|bpkb|polis|asuransi|taspen|bpjs|pensiun|gaji|warung|usaha)\b/i;
const RE_BUKAN_BENDA = /^(?:-+|[.\s-]+|.*\b(?:dikuasai\s+oleh|tidak\s+beretikad|berada\s+dalam\s+penguasaan|tertera\s+dan\s+tersebut)\b.*|beberapa\b.*|(?:sebagaimana|tersebut|seperti)\b.*)$/i;

function bendaSah(t) {
  const s = String(t || "").trim();
  return s.length >= 4 && RE_BENDA.test(s) && !RE_BUKAN_BENDA.test(s);
}

function rapiBenda(t) {
  return String(t || "")
    .replace(RE_NOMOR_BUTIR, "")
    .replace(/\s*:\s*/g, ": ")
    .replace(/\s+/g, " ")
    .replace(/[\s,;.]+$/, "")
    .trim();
}

/**
 * Daftar benda sesudah butir pembuka yang cocok `polaPembuka`.
 *
 * - Pembuka berakhir ":" (atau "sebagai berikut", "yaitu") -> butir-butir
 *   sesudahnya adalah benda, sampai butir baru ("Bahwa ...") atau penutup
 *   (`polaPenutup`, mis. "adalah harta bersama").
 * - Pembuka yang memuat bendanya sendiri ("memperoleh harta berupa kendaraan
 *   roda 2 ...") -> satu benda: sisa kalimat sesudah "berupa".
 *
 * @returns {{benda: string[], kalimat: string, letak: number}} letak = indeks butir pembuka (-1 bila tidak ada)
 */
function daftarSesudah(daftarBaris, polaPembuka, opsi = {}) {
  const penutup = opsi.polaPenutup || /^(?:adalah|merupakan|sebagai|semuanya|kesemuanya)\s+(?:sebagai\s+)?harta\b/i;
  for (let i = 0; i < daftarBaris.length; i++) {
    const b = daftarBaris[i];
    const m = polaPembuka.exec(b);
    if (!m) continue;
    const sisa = b.slice(m.index + m[0].length).replace(/^\s*(?:sebagai\s+berikut|yaitu|yakni)?\s*[:;,]?\s*/i, "");
    const benda = [];
    // "... barang-barang ... tersebut di bawah ini, yakni;" - pembuka, daftarnya di butir berikut.
    const pembukaSaja = !sisa || sisa.length <= 3 || /(?:sebagai\s+berikut|yaitu|yakni|di\s*bawah\s+ini|antara\s+lain|berupa)\s*[:;,]?\s*$/i.test(sisa);
    if (!pembukaSaja && bendaSah(sisa)) {
      // Benda di kalimat yang sama ("... berupa kendaraan roda 2 DN 6396 JD.")
      // Bila kalimatnya diakhiri ":" dan baris berikutnya rincian, rincian ikut.
      let satu = sisa;
      let j = i + 1;
      while (j < daftarBaris.length && RE_RINCIAN.test(daftarBaris[j]) && !RE_BUTIR_BARU.test(daftarBaris[j])) {
        satu += `, ${daftarBaris[j]}`;
        j++;
      }
      const r = rapiBenda(satu);
      if (r) benda.push(r);
      return { benda, kalimat: b, letak: i };
    }
    if (!pembukaSaja) continue;
    for (let j = i + 1; j < daftarBaris.length; j++) {
      const s = daftarBaris[j];
      if (RE_BUTIR_BARU.test(s) || penutup.test(s)) break;
      if (benda.length && (RE_RINCIAN.test(s) || /^\s*[-–•·o]\s*(?:Sebelah|Batas|Utara|Timur|Selatan|Barat)/i.test(s))) {
        benda[benda.length - 1] += `${/:$/.test(benda[benda.length - 1]) ? " " : ", "}${rapiBenda(s)}`;
        continue;
      }
      const r = rapiBenda(s);
      if (r && bendaSah(r)) benda.push(r);
      else if (r && benda.length && !/^[-.\s]+$/.test(r) && r.length < 160 && !RE_BUKAN_BENDA.test(r)) benda[benda.length - 1] += `, ${r}`;
      if (benda.length >= 40) break;
    }
    if (benda.length) return { benda: benda.map((x) => x.replace(/:\s*,/g, ":").replace(/[\s,;:]+$/, "")), kalimat: b, letak: i };
  }
  return { benda: [], kalimat: "", letak: -1 };
}

/**
 * Cadangan bila tidak ada kalimat pembuka daftar: butir yang menguraikan SATU
 * benda tetap ("tanah beserta bangunan rumah tersebut terletak di ..., dengan
 * batas-batas sebagai berikut:") beserta baris batasnya.
 */
function bendaBerletak(daftarBaris) {
  const benda = [];
  let kalimat = "";
  for (let i = 0; i < daftarBaris.length; i++) {
    const b = daftarBaris[i].replace(/^(?:\d{1,2}\s*[.)]\s*)?Bahwa\s+/i, "");
    if (!/\b(?:sebidang|tanah|rumah|kebun|sawah|bangunan|lahan)\b/i.test(b) || !/\b(?:terletak|berlokasi|beralamat|seluas|luas)\b/i.test(b)) continue;
    if (/\b(?:menghibahkan|dikuasai|menguasai|belum\s+pernah\s+dibagi|menjual|dijual)\b/i.test(b)) continue;
    let satu = rapiBenda(b.replace(/\s*(?:sebagai\s+berikut|berikut)\s*:?\s*$/i, ""));
    let j = i + 1;
    while (j < daftarBaris.length && (RE_RINCIAN.test(daftarBaris[j]) || /^\s*[-–•·o]?\s*Sebelah\b/i.test(daftarBaris[j])) && !RE_BUTIR_BARU.test(daftarBaris[j])) {
      satu += `${/:$/.test(satu) ? " " : ", "}${rapiBenda(daftarBaris[j])}`;
      j++;
    }
    if (bendaSah(satu)) {
      benda.push(satu.replace(/:\s*,/g, ":"));
      if (!kalimat) kalimat = daftarBaris[i];
    }
    i = j - 1;
  }
  return { benda, kalimat, letak: benda.length ? 0 : -1 };
}

/** Daftar benda -> isian ABT bernomor, satu benda satu baris ("1. X;<br>2. Y;"). */
function isianBernomor(benda, awalan) {
  return benda.map((x, i) => `${awalan ? `${awalan}.` : ""}${i + 1}${awalan ? "" : "."} ${x};`).join("<br>");
}

/** Nama di awal teks (aturan namaDiAwal itsbat) - "" bila tidak ada. */
function namaDiAwal(teks) {
  return usulanService.namaDiAwal(String(teks || "").replace(/^\s*[(:,]\s*/, ""));
}

/** Nama sesudah pola (RegExp, tanpa bendera g) di teks. */
function namaSesudahPola(teks, pola) {
  const m = pola.exec(String(teks || ""));
  if (!m) return { nama: "", index: -1 };
  const nama = namaDiAwal(String(teks).slice(m.index + m[0].length));
  return { nama, index: m.index };
}

/** "nama" sama (huruf kecil, huruf/angka saja) - pembanding ukur. */
const normal = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/\b(?:alm|almh|almarhum|almarhumah|hj|h|drs|dr|ir)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Nama pendek lengkapi ke bentuk "X bin/binti Y" bila bentuk lengkapnya ada di teks. */
function lengkapiBin(nama, teks) {
  const n = String(nama || "").trim();
  if (!n || /\bbin(?:ti)?\b/i.test(n)) return n;
  const lolos = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const m = new RegExp(`${lolos}\\s+(bin(?:ti)?)\\s+`, "i").exec(String(teks || ""));
  if (!m) return n;
  const belakang = namaDiAwal(String(teks).slice(m.index + m[0].length));
  return belakang ? `${n} ${m[1].toLowerCase()} ${belakang}` : n;
}

/** Kalimat (butir) yang memuat indeks i pada teks satu baris. */
function kalimatDi(teks, i, panjang = 0) {
  const t = String(teks || "");
  const awal = Math.max(0, t.lastIndexOf(";", i) + 1);
  const akhir = t.indexOf(";", i + panjang);
  return t.slice(awal, akhir < 0 ? Math.min(t.length, i + panjang + 200) : akhir).trim().slice(0, 400);
}

module.exports = {
  baris,
  satuBaris,
  BULAN,
  tanggalBaku,
  letakTanggal,
  RE_BUTIR_BARU,
  RE_RINCIAN,
  rapiBenda,
  daftarSesudah,
  bendaSah,
  bendaBerletak,
  isianBernomor,
  namaDiAwal,
  namaSesudahPola,
  lengkapiBin,
  normal,
  kalimatDi,
};
