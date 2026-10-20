"use strict";

/**
 * ============================================================================
 * JJ2 (18 Okt 2026) - DAFTAR BUKTI DAN SURAT KETERANGAN KUA DARI e-COURT
 * ============================================================================
 *
 * Keputusan pengguna no. 75a dan no. 71.
 *
 * 75a. Daftar bukti Penggugat P.1, P.2, ... dan Tergugat T.1, ... (nama, jenis, nomor, tanggal) dari daftar bukti yang
 *      diunggah ke e-Court (judul "Daftar Bukti", atau diunggah sebagai "Kesimpulan" - JJ sudah mengenalinya sebagai
 *      daftar bukti). Arti variabel (dari tabel variabel ABT lokal, aps_badilag_pm55 / aps_badilag_i18):
 *        9470  Pencegahan nikah: alat bukti surat Penggugat/Pemohon (daftar P.1 dst.)
 *        9488  Wasiat: alat bukti surat Penggugat/Pemohon        9489  Wasiat: alat bukti surat Tergugat/Termohon (T.1 dst.)
 *        9492  Ekonomi syariah (acara biasa): alat bukti surat Penggugat/Pemohon   9493  idem Tergugat/Termohon
 *        9951  Bukti elektronik Penggugat/Pemohon (satu baris: "Tangkapan layar percakapan WhatsApp ..., diberi tanda P.5")
 *        9952  Bukti elektronik Tergugat/Termohon
 *      Bunyi daftar surat mengikuti bawaan variabelnya: "N. Fotokopi ..., bukti surat tersebut telah diberi meterai cukup,
 *      di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.n;" dipisah <br>.
 *      Tiap butir memuat kata-kata daftar yang diunggah pihak; pemeriksaan meterai dan pencocokan di persidangan tetap
 *      urusan majelis (itu sebabnya semuanya usulan ragu).
 *
 * 71.  Bukti P.3 itsbat: No. dan Tgl. Surat Keterangan KUA (0654, 0655) - dipakai sebagai surat keterangan nikah tidak
 *      tercatat. Urutan sumber: (1) posita gugatan e-Court - nomor dan tanggal dalam satu kalimat yang menyebut surat
 *      keterangan KUA / tidak tercatat dan hanya SATU pasangan yang muncul; (2) daftar bukti pihak; (3) isi berkas bukti
 *      (teks PDF atau OCR - paling ragu). Tidak terbaca -> dikosongkan untuk diisi manual.
 *
 * MURNI: tanpa basis data/jaringan/ABT/SIPP. Tingkat keyakinan diputuskan pemanggil; semua isi surat di sini belum
 * diukur atas berkas sungguhan (data/ecourt kosong di laptop) sehingga pemanggil memakai "ragu".
 */

const T = require("./tuntutanDeteksiService");
const TJ = require("./tanyaJawabEcourtService");

const KODE = Object.freeze({
  // S6 20 Okt: + hibah 9804/9805 (gugatan) dan 9810 (permohonan), wakaf 9834/9835 dan 9840, mafqud 9873 - daftar P.1/T.1 yang sama.
  // W3a 21 Okt: + penolakan perkawinan 3613, perkawinan campuran 3634, izin kawin 3654, pengesahan anak 3669, kelalaian kewajiban 3730 / 3731, hak bekas istri 3757 / 3758.
  suratP: Object.freeze(["9470", "9488", "9492", "9804", "9810", "9834", "9840", "9873", "3613", "3634", "3654", "3669", "3730", "3757"]),
  suratT: Object.freeze(["9489", "9493", "9805", "9835", "3731", "3758"]),
  elektronikP: "9951",
  elektronikT: "9952",
  noKua: "0654",
  tglKua: "0655",
});

const BULAN = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];
const BULAN_NAMA = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function indeksBulan(kata) {
  const k = String(kata || "").toLowerCase().replace(/\./g, "");
  if (!k) return -1;
  const penuh = BULAN.indexOf(k);
  if (penuh >= 0) return penuh;
  const singkat = { jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, agt: 7, agu: 7, agst: 7, sep: 8, sept: 8, okt: 9, nov: 10, nop: 10, des: 11 };
  return Object.prototype.hasOwnProperty.call(singkat, k) ? singkat[k] : -1;
}

const dua = (n) => String(n).padStart(2, "0");

/** "12 Mei 2026" | "12-05-2026" | "12/5/2026" -> { iso, tampil:"dd/mm/yyyy", indo:"12 Mei 2026" }; null bila bukan tanggal sah. */
function uraiTanggal(teks) {
  const s = String(teks || "").trim();
  let m = /^(\d{1,2})[\s\-/.]+([A-Za-z]{3,10}\.?)[\s\-/.,]+(\d{4})$/.exec(s);
  let d;
  let b;
  let y;
  if (m) {
    d = Number(m[1]);
    b = indeksBulan(m[2]);
    y = Number(m[3]);
  } else {
    m = /^(\d{1,2})[\s\-/.]+(\d{1,2})[\s\-/.]+(\d{4})$/.exec(s);
    if (!m) return null;
    d = Number(m[1]);
    b = Number(m[2]) - 1;
    y = Number(m[3]);
  }
  if (b < 0 || b > 11 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  const kabisat = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const hariBulan = [31, kabisat ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][b];
  if (d > hariBulan) return null;
  return { iso: `${y}-${dua(b + 1)}-${dua(d)}`, tampil: `${dua(d)}/${dua(b + 1)}/${y}`, indo: `${d} ${BULAN_NAMA[b]} ${y}` };
}

const POLA_TANGGAL_DI_TEKS = "(\\d{1,2}[\\s\\-/.]+(?:[A-Za-z]{3,10}\\.?|\\d{1,2})[\\s\\-/.,]+\\d{4})";
const RE_TANGGAL_BERLABEL = new RegExp(`(?:tanggal|tgl\\.?|tertanggal)\\s*[:.]?\\s*${POLA_TANGGAL_DI_TEKS}`, "i");
const RE_NOMOR = /(?:nomor|no\.?)\s*[:.]?\s*([A-Za-z0-9][A-Za-z0-9/.\-]*\d[A-Za-z0-9/.\-]*)/i;

function bersihkanNomor(n) {
  return String(n || "").replace(/[.,;:\-/]+$/, "").trim();
}

// ─── Jenis bukti ─────────────────────────────────────────────────────────────

const JENIS_BUKTI = [
  [/surat\s+keterangan\s+(?:nikah\s+)?(?:tidak|belum)\s+tercatat|surat\s+keterangan\s+(?:dari\s+)?(?:kua|kantor\s+urusan\s+agama)|keterangan\s+(?:tidak|belum)\s+(?:tercatat|terdaftar)\s+nikah/i, "Surat Keterangan Nikah Tidak Tercatat", "kua"],
  [/\b(?:ktp|kartu\s+tanda\s+penduduk)\b/i, "Kartu Tanda Penduduk Elektronik (KTP-el)", "ktp"],
  [/kartu\s+keluarga|\bkk\b/i, "Kartu Keluarga", "kk"],
  [/akta\s+nikah|buku\s+nikah|kutipan\s+akta\s+nikah/i, "Kutipan Akta Nikah", "akta-nikah"],
  [/akta\s+kelahiran|surat\s+kelahiran/i, "Kutipan Akta Kelahiran", "akta-lahir"],
  [/akta\s+kematian|surat\s+kematian|surat\s+keterangan\s+kematian/i, "Akta Kematian", "kematian"],
  [/akta\s+cerai|putusan\s+(?:pengadilan|perceraian)/i, "Akta Cerai / Putusan", "cerai"],
  [/ijazah|rapor|surat\s+tanda\s+tamat/i, "Ijazah", "ijazah"],
  [/sertifikat|\bshm\b|\bsertipikat\b/i, "Sertifikat", "sertifikat"],
  [/\bbpkb\b|\bstnk\b|buku\s+pemilik\s+kendaraan/i, "Surat Kendaraan", "kendaraan"],
  [/surat\s+wasiat|\bwasiat\b/i, "Surat Wasiat", "wasiat"],
  [/surat\s+perjanjian|perjanjian|akad|jadwal\s+angsuran|somasi/i, "Surat Perjanjian / Akad", "perjanjian"],
  [/surat\s+pernyataan|surat\s+kesepakatan/i, "Surat Pernyataan", "pernyataan"],
  [/surat\s+keterangan/i, "Surat Keterangan", "keterangan"],
  [/kuitansi|kwitansi|nota\b|slip\s+gaji|struk|bukti\s+(?:transfer|pembayaran)|mutasi\s+rekening/i, "Bukti Pembayaran", "bayar"],
];

const RE_ELEKTRONIK =
  /tangkapan\s+layar|screen\s?shot|whats\s?app|\bwa\b|\bchat\b|percakapan|rekaman|\bvideo\b|flash\s?disk|\bcd\b|facebook|instagram|tiktok|media\s+sosial|pesan\s+(?:singkat|teks)|\bsms\b|\bfoto(?!kopi)\b|\be-?mail\b|bukti\s+elektronik/i;

function kenaliJenisBukti(uraian) {
  const u = String(uraian || "");
  if (RE_ELEKTRONIK.test(u) && !/^\s*fotokopi/i.test(u)) return { kunci: "elektronik", nama: "Bukti Elektronik", elektronik: true };
  for (const [re, nama, kunci] of JENIS_BUKTI) if (re.test(u)) return { kunci, nama, elektronik: false };
  return { kunci: "", nama: "", elektronik: false };
}

function ekstrakRincian(uraian) {
  const u = String(uraian || "");
  const nama = (/\batas\s+nama\s+([A-Z][^,;()]{2,60}?)(?=\s*(?:,|;|\(|\bNIK\b|\bNomor\b|\bNo\.|\btanggal\b|\btgl\b|\byang\b|$))/.exec(u) || [])[1] || "";
  const no = RE_NOMOR.exec(u);
  const tgl = RE_TANGGAL_BERLABEL.exec(u);
  const penerbit = (/dikeluarkan\s+(?:oleh|di)\s+([^,;]{3,80})/i.exec(u) || [])[1] || "";
  const tanggal = tgl ? uraiTanggal(tgl[1]) : null;
  return { nama: nama.trim(), nomor: no ? bersihkanNomor(no[1]) : "", tanggal, penerbit: penerbit.trim() };
}

// ─── Daftar bukti ────────────────────────────────────────────────────────────

const RE_ITEM_KODE = /^\s*(?:bukti\s+(?:surat\s+)?)?\(?([PT])\s*[-.–]?\s*(\d{1,2})\)?\s*(?:[:.\-–)]\s*|\s+)(.{3,})$/i;
const RE_ITEM_AKHIR = /^\s*\d{1,2}[.)]\s+(.+?)[\s,;(\[-]*(?:diberi\s+tanda\s+|bukti\s+|tanda\s+)?\(?([PT])\s*[-.]?\s*(\d{1,2})\)?[)\].;\s]*$/i;
const RE_ITEM_POLOS = /^\s*(\d{1,2})[.)]\s+(.{3,})$/;
const RE_JUDUL_DAFTAR = /\bdaftar\s+(?:alat\s+)?bukti\b|\bbukti\s+surat\b|\blampiran\s+bukti\b|\balat\s+bukti\b/i;

function pihakDariKata(teks) {
  const s = String(teks || "").toLowerCase();
  const p = /\b(penggugat|pemohon)\b/.exec(s);
  const t = /\b(tergugat|termohon)\b/.exec(s);
  if (p && (!t || p.index < t.index)) return "P";
  if (t) return "T";
  return "";
}

function bersihkanUraian(u) {
  return TJ.amankan(u)
    .replace(/[\s,;:]*(?:diberi\s+tanda|bukti|tanda)\s+[PT][-.]?\s?\d{1,2}[\s.;)]*$/i, "")
    .replace(/[\s,;:.]+$/, "")
    .trim();
}

/**
 * Daftar bukti (P.1.. / T.1..) dari teks sebuah berkas. Butir tanpa kode P/T memakai pihak dari judul/kepala surat
 * (kodeDariUrutan = true -> ragu). Mengembalikan butir urut menurut pihak dan nomor.
 * @returns {{butir: Array<object>, pihakJudul: string, adaJudul: boolean}}
 */
function uraiDaftarBukti(teks, petunjukPihak) {
  const rapi = T.rapikanTeks(teks);
  const baris = rapi
    .split(/[\n\f]/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const kepala = baris.slice(0, 8).join(" ");
  const adaJudul = baris.slice(0, 8).some((l) => RE_JUDUL_DAFTAR.test(l));
  const pihakJudul = pihakDariKata(kepala) || pihakDariKata(petunjukPihak) || "";
  const hasil = [];
  let kini = null;
  const tutup = () => {
    if (kini) hasil.push(kini);
    kini = null;
  };
  let urutPolos = 0;
  for (const l of baris) {
    let m = RE_ITEM_KODE.exec(l);
    if (m) {
      tutup();
      kini = { pihak: m[1].toUpperCase(), no: Number(m[2]), uraian: m[3].trim(), kodeDariUrutan: false };
      continue;
    }
    m = RE_ITEM_AKHIR.exec(l);
    if (m) {
      tutup();
      kini = { pihak: m[2].toUpperCase(), no: Number(m[3]), uraian: m[1].trim(), kodeDariUrutan: false };
      continue;
    }
    m = RE_ITEM_POLOS.exec(l);
    if (m && pihakJudul && adaJudul) {
      tutup();
      urutPolos += 1;
      kini = { pihak: pihakJudul, no: Number(m[1]) || urutPolos, uraian: m[2].trim(), kodeDariUrutan: true };
      continue;
    }
    // Baris sambungan: hanya bila butir sedang terbuka dan barisnya bukan kepala/penutup surat.
    if (kini && !/^(?:demikian|hormat|kuasa|wassalam|[A-Z][a-z]+,\s*\d{1,2}\s+[A-Za-z]+\s+\d{4})/i.test(l) && l.length < 300) kini.uraian += ` ${l}`;
    else tutup();
  }
  tutup();
  const butir = [];
  const lihat = new Set();
  for (const b of hasil) {
    const uraian = bersihkanUraian(b.uraian);
    if (uraian.replace(/[^A-Za-z]/g, "").length < 6) continue;
    const kunci = `${b.pihak}${b.no}`;
    if (lihat.has(kunci)) continue;
    lihat.add(kunci);
    const jenis = kenaliJenisBukti(uraian);
    const rinci = ekstrakRincian(uraian);
    butir.push({ pihak: b.pihak, no: b.no, kode: `${b.pihak}.${b.no}`, uraian, jenis: jenis.nama, jenisKunci: jenis.kunci, elektronik: jenis.elektronik, kodeDariUrutan: b.kodeDariUrutan, ...rinci });
  }
  butir.sort((a, b) => (a.pihak === b.pihak ? a.no - b.no : a.pihak === "P" ? -1 : 1));
  return { butir, pihakJudul, adaJudul };
}

/** Judul berkas bukti bertanda P/T ("Bukti P-3 Akta Nikah", "T.2 Foto rumah") -> butir daftar; null bila judul tidak menandai bukti. */
const RE_JUDUL_BERTANDA = /^\s*(?:bukti\s+(?:surat\s+)?)?\(?([PT])\s*[-.–]?\s*(\d{1,2})\)?\s*[:.\-–)]?\s*(.*)$/i;
function butirDariJudul(judul) {
  const m = RE_JUDUL_BERTANDA.exec(String(judul || ""));
  if (!m) return null;
  const uraian = bersihkanUraian(m[3] || "");
  if (uraian.replace(/[^A-Za-z]/g, "").length < 6) return null;
  const jenis = kenaliJenisBukti(uraian);
  return { pihak: m[1].toUpperCase(), no: Number(m[2]), kode: `${m[1].toUpperCase()}.${Number(m[2])}`, uraian, jenis: jenis.nama, jenisKunci: jenis.kunci, elektronik: jenis.elektronik, kodeDariUrutan: false, ...ekstrakRincian(uraian) };
}

function awalFotokopi(u) {
  return /^(?:fotokopi|foto\s+kopi|salinan|asli|cetakan|print|hasil\s+cetak|fotocopy)\b/i.test(u) ? u : `Fotokopi ${u}`;
}

const KALIMAT_TETAP = "bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai";

/** Satu butir surat dalam bunyi bawaan variabel alat bukti: "N. Fotokopi ..., bukti surat tersebut ..., lalu diberi tanda P.1;". */
function kalimatButirSurat(b, urut) {
  const isi = /meterai/i.test(b.uraian) ? b.uraian : `${awalFotokopi(b.uraian)}, ${KALIMAT_TETAP}`;
  return `${urut}. ${isi.replace(/[\s,;:.]+$/, "")}, lalu diberi tanda ${b.kode};`;
}

function kalimatButirElektronik(b) {
  return `${b.uraian.replace(/[\s,;:.]+$/, "")}, diberi tanda ${b.kode}`;
}

// ─── Surat keterangan KUA ────────────────────────────────────────────────────

const RE_KUA_KONTEKS =
  /surat\s+(?:keterangan|ket\.?)\b[^.]{0,200}?(?:\bkua\b|kantor\s+urusan\s+agama|(?:tidak|belum)\s+(?:tercatat|terdaftar|dicatat|pernah\s+tercatat))|(?:\bkua\b|kantor\s+urusan\s+agama)[^.]{0,200}?surat\s+(?:keterangan|ket\.?)/gi;
const RE_NEGASI_SURAT = /\b(?:tidak|belum)\s+(?:ada|memiliki|mempunyai|punya)\s+surat\s+keterangan/i;

/**
 * Nomor dan tanggal surat keterangan KUA / tidak tercatat dari posita. "Jelas" bila SATU pasangan (nomor, tanggal) yang
 * muncul di semua kalimat yang menyebut suratnya; nomor atau tanggal tunggal tetap dikembalikan (jelas=false).
 * @returns {null | {nomor:string, tanggal:object|null, jelas:boolean, kutipan:string, bertentangan:boolean}}
 */
function suratKuaDariPosita(posita) {
  const teks = T.rapikanTeks(posita).replace(/[\n\t\v\f]/g, " ").replace(/\s+/g, " ");
  if (!teks.trim() || RE_NEGASI_SURAT.test(teks)) return null;
  const pasangan = [];
  const re = new RegExp(RE_KUA_KONTEKS.source, "gi");
  let m;
  while ((m = re.exec(teks))) {
    const jendela = teks.slice(m.index, m.index + 420);
    const no = RE_NOMOR.exec(jendela);
    const tg = RE_TANGGAL_BERLABEL.exec(jendela);
    const tanggal = tg ? uraiTanggal(tg[1]) : null;
    const nomor = no ? bersihkanNomor(no[1]) : "";
    if (nomor || tanggal) pasangan.push({ nomor, tanggal, kutipan: jendela.slice(0, 260) });
    re.lastIndex = m.index + Math.max(m[0].length, 1);
  }
  if (!pasangan.length) return null;
  const unik = new Set(pasangan.map((p) => `${p.nomor.toLowerCase()}|${p.tanggal ? p.tanggal.iso : ""}`));
  const lengkap = pasangan.filter((p) => p.nomor && p.tanggal);
  const unikLengkap = new Set(lengkap.map((p) => `${p.nomor.toLowerCase()}|${p.tanggal.iso}`));
  if (unikLengkap.size === 1) return { nomor: lengkap[0].nomor, tanggal: lengkap[0].tanggal, jelas: true, kutipan: lengkap[0].kutipan, bertentangan: false };
  if (unikLengkap.size > 1) return { nomor: "", tanggal: null, jelas: false, kutipan: lengkap[0].kutipan, bertentangan: true };
  // Tidak ada pasangan lengkap: nomor/tanggal yang tunggal saja.
  const nomorUnik = new Set(pasangan.map((p) => p.nomor.toLowerCase()).filter(Boolean));
  const tglUnik = new Set(pasangan.map((p) => (p.tanggal ? p.tanggal.iso : "")).filter(Boolean));
  const p0 = pasangan[0];
  return {
    nomor: nomorUnik.size === 1 ? pasangan.find((p) => p.nomor).nomor : "",
    tanggal: tglUnik.size === 1 ? pasangan.find((p) => p.tanggal).tanggal : null,
    jelas: false,
    kutipan: p0.kutipan,
    bertentangan: unik.size > 1 && (nomorUnik.size > 1 || tglUnik.size > 1),
  };
}

/** Isi sebuah berkas bukti yang berupa surat keterangan KUA / tidak tercatat: nomor di kepala, tanggal berlabel atau tanggal terakhir. */
function suratKuaDariBerkas(teks) {
  const rapi = T.rapikanTeks(teks).replace(/[\f\t\v]/g, "\n");
  const kepala = rapi.slice(0, 1400).replace(/\s+/g, " ");
  if (!/surat\s+keterangan/i.test(kepala) || !/(?:tidak|belum)\s+(?:tercatat|terdaftar|dicatat)|kantor\s+urusan\s+agama|\bKUA\b/i.test(kepala)) return null;
  const no = RE_NOMOR.exec(kepala);
  let tanggal = null;
  let kutipan = kepala.slice(0, 240);
  const tg = RE_TANGGAL_BERLABEL.exec(rapi.replace(/\s+/g, " "));
  if (tg) tanggal = uraiTanggal(tg[1]);
  if (!tanggal) {
    const semua = [...rapi.replace(/\s+/g, " ").matchAll(/(\d{1,2}\s+(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+\d{4})/gi)];
    if (semua.length) tanggal = uraiTanggal(semua[semua.length - 1][1]);
  }
  const nomor = no ? bersihkanNomor(no[1]) : "";
  if (!nomor && !tanggal) return null;
  return { nomor, tanggal, kutipan };
}

// ─── Penyusunan ──────────────────────────────────────────────────────────────

function sumber(judul, kutipan, baca) {
  return [{ asal: "gugatan-ecourt", kalimat: `e-Court: ${judul}${baca === "ocr" ? " (dibaca OCR)" : ""} - "${String(kutipan || "").replace(/\s+/g, " ").slice(0, 260)}"` }];
}

/**
 * @param {{
 *   daftar: Array<{judul:string, teks:string, baca?:string, pengunggah?:string, penuntutKode?:string}>,   // daftar bukti (judul/isi)
 *   berkasBukti: Array<{judul:string, teks:string, baca?:string}>,                                       // berkas bukti lain (KTP, akta, surat keterangan ...)
 *   posita?: string,                                                                                      // posita gugatan (untuk surat keterangan KUA)
 *   sebutan?: {lawan:string, pelaku:string}
 * }} m
 * @returns {{butir:object[], usulan:object[], kalimat:object[], catatan:string[], kua:object|null}}
 */
function susunBukti(m) {
  const x = m || {};
  const hasil = { butir: [], usulan: [], kalimat: [], catatan: [], kua: null };
  const tandai = (e) => ({ bentrok: "", jagaIsianLama: true, keyakinan: "ragu", ...e });

  // 1. Daftar bukti pihak.
  const semua = [];
  for (const d of Array.isArray(x.daftar) ? x.daftar : []) {
    const petunjuk = `${d.judul || ""} ${d.pengunggah || ""}`;
    const u = uraiDaftarBukti(d.teks, petunjuk || (d.penuntutKode === "0047" ? "Tergugat" : d.penuntutKode === "0046" ? "Penggugat" : ""));
    for (const b of u.butir) semua.push({ ...b, dok: d });
  }
  // Berkas bukti yang judulnya sendiri bertanda P/T (satu berkas satu bukti): butir tambahan bila kodenya belum ada di daftar.
  for (const d of Array.isArray(x.berkasBukti) ? x.berkasBukti : []) {
    const b = butirDariJudul(d.judul);
    if (b && !semua.some((y) => y.kode === b.kode)) semua.push({ ...b, dok: d });
  }
  // Satu kode = satu butir; butir dari berkas yang lebih dulu dipakai (daftar susulan tidak menimpa).
  const perKode = new Map();
  for (const b of semua) {
    const k = b.kode;
    if (!perKode.has(k)) perKode.set(k, b);
    else if (perKode.get(k).uraian.toLowerCase() !== b.uraian.toLowerCase()) hasil.catatan.push(`Bukti ${k} tertulis berbeda di dua berkas daftar bukti - dipakai yang pertama, periksa.`);
  }
  hasil.butir = [...perKode.values()].map(({ dok, ...b }) => ({ ...b, sumber: dok.judul, baca: dok.baca || "teks" }));
  hasil.butir.sort((a, b) => (a.pihak === b.pihak ? a.no - b.no : a.pihak === "P" ? -1 : 1));

  for (const pihak of ["P", "T"]) {
    const milik = [...perKode.values()].filter((b) => b.pihak === pihak);
    if (!milik.length) continue;
    const surat = milik.filter((b) => !b.elektronik);
    const elek = milik.filter((b) => b.elektronik);
    const dari = milik[0].dok;
    const ocr = milik.some((b) => b.dok.baca === "ocr");
    const urutan = milik.some((b) => b.kodeDariUrutan);
    const rapiCatatan = [];
    if (ocr) rapiCatatan.push("daftar dibaca OCR");
    if (urutan) rapiCatatan.push("nomor P/T diambil dari urutan butir (tidak tertulis di berkas)");
    const catatanDasar = `Daftar bukti diunggah ${pihak === "P" ? "Penggugat/Pemohon" : "Tergugat/Termohon"} di e-Court; tanda P/T akhir ditetapkan majelis di persidangan, dan meterai serta pencocokan dengan aslinya diperiksa majelis - periksa dan sunting.${rapiCatatan.length ? ` (${rapiCatatan.join("; ")})` : ""}`;
    if (surat.length) {
      const nilai = surat.map((b, i) => kalimatButirSurat(b, i + 1)).join("<br>");
      const kodes = pihak === "P" ? KODE.suratP : KODE.suratT;
      for (const kode of kodes) {
        hasil.usulan.push(
          tandai({
            kode,
            nama: `Alat bukti surat ${pihak === "P" ? "Penggugat/Pemohon" : "Tergugat/Termohon"} (daftar ${pihak}.1 dst.)`,
            nilai,
            sumber: sumber(dari.judul, surat.map((b) => b.uraian).join("; "), dari.baca),
            kodePola: "bukti-daftar-ecourt",
            catatan: catatanDasar,
          })
        );
      }
      hasil.kalimat.push({
        kode: `bukti-surat-${pihak === "P" ? "0046" : "0047"}`,
        label: `Daftar bukti surat ${pihak === "P" ? "Penggugat/Pemohon" : "Tergugat/Termohon"} (e-Court) - ${surat.length} butir`,
        bagian: "bukti",
        jenis: "",
        teks: surat.map((b, i) => kalimatButirSurat(b, i + 1)).join("\n"),
        kosong: [],
      });
    }
    if (elek.length) {
      hasil.usulan.push(
        tandai({
          kode: pihak === "P" ? KODE.elektronikP : KODE.elektronikT,
          nama: `Bukti elektronik ${pihak === "P" ? "Penggugat/Pemohon" : "Tergugat/Termohon"}`,
          nilai: elek.map(kalimatButirElektronik).join(";<br>"),
          sumber: sumber(dari.judul, elek.map((b) => b.uraian).join("; "), dari.baca),
          kodePola: "bukti-elektronik-ecourt",
          catatan: catatanDasar,
        })
      );
    }
  }

  // 2. Surat keterangan KUA / nikah tidak tercatat (bukti P.3 itsbat): posita > daftar bukti > isi berkas bukti.
  let kua = null;
  const dariPosita = suratKuaDariPosita(x.posita || "");
  if (dariPosita && (dariPosita.nomor || dariPosita.tanggal)) {
    kua = { ...dariPosita, asal: "posita", judul: "surat gugatan" };
  }
  if (!kua || !kua.nomor || !kua.tanggal) {
    const item = hasil.butir.find((b) => b.jenisKunci === "kua" && (b.nomor || b.tanggal));
    if (item) {
      const lama = kua || { nomor: "", tanggal: null };
      kua = {
        nomor: lama.nomor || item.nomor,
        tanggal: lama.tanggal || item.tanggal,
        jelas: false,
        kutipan: item.uraian,
        asal: lama.nomor || lama.tanggal ? "posita+daftar" : "daftar-bukti",
        judul: item.sumber,
        bertentangan: false,
      };
    }
  }
  if (!kua || !kua.nomor || !kua.tanggal) {
    for (const b of Array.isArray(x.berkasBukti) ? x.berkasBukti : []) {
      const o = suratKuaDariBerkas(b.teks);
      if (!o) continue;
      const lama = kua || { nomor: "", tanggal: null };
      kua = {
        nomor: lama.nomor || o.nomor,
        tanggal: lama.tanggal || o.tanggal,
        jelas: false,
        kutipan: o.kutipan,
        asal: lama.nomor || lama.tanggal ? `${lama.asal || "posita"}+${b.baca === "ocr" ? "ocr" : "berkas"}` : b.baca === "ocr" ? "ocr" : "berkas",
        judul: b.judul,
        bertentangan: false,
        baca: b.baca,
      };
      break;
    }
  }
  if (kua && (kua.nomor || kua.tanggal)) {
    hasil.kua = kua;
    const dariBerkas = /ocr|berkas/.test(kua.asal);
    const asalTeks = { posita: "posita surat gugatan", "daftar-bukti": "daftar bukti", ocr: "isi berkas bukti (OCR)", berkas: "isi berkas bukti" }[kua.asal] || kua.asal;
    const catatan = `Surat keterangan KUA / nikah tidak tercatat dibaca dari ${asalTeks}${dariBerkas ? " - ejaan nomor dan angka tanggal lebih mungkin meleset" : ""}; nomor dan tanggal dipakai sebagai bukti P.3 itsbat - periksa.`;
    const s = sumber(kua.judul || "surat gugatan", kua.kutipan, kua.baca);
    if (kua.nomor) hasil.usulan.push(tandai({ kode: KODE.noKua, nama: "No. Surat Ket. KUA", nilai: kua.nomor, sumber: s, kodePola: `kua-${kua.asal.replace(/\+/g, "-")}`, catatan, jelas: Boolean(kua.jelas) }));
    if (kua.tanggal) hasil.usulan.push(tandai({ kode: KODE.tglKua, nama: "Tgl. Surat Ket. KUA", nilai: kua.tanggal.tampil, sumber: s, kodePola: `kua-${kua.asal.replace(/\+/g, "-")}`, catatan, jelas: Boolean(kua.jelas) }));
    if (kua.bertentangan) hasil.catatan.push("Posita menyebut lebih dari satu nomor atau tanggal surat keterangan KUA - tidak ada yang dipakai.");
  } else if (dariPosita && dariPosita.bertentangan) {
    hasil.catatan.push("Posita menyebut lebih dari satu nomor atau tanggal surat keterangan KUA - tidak ada yang dipakai.");
  }
  return hasil;
}

module.exports = { KODE, butirDariJudul, uraiTanggal, kenaliJenisBukti, ekstrakRincian, uraiDaftarBukti, kalimatButirSurat, kalimatButirElektronik, suratKuaDariPosita, suratKuaDariBerkas, susunBukti, RE_JUDUL_DAFTAR };
