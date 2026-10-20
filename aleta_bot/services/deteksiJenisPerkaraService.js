"use strict";

/**
 * ============================================================================
 * DETEKSI PER JENIS PERKARA - PANEL ABT DAN "SUSUN KETERANGAN SAKSI"
 * (batch 11 Okt B, Agen 3: "luaskan kembali ke semua blangko")
 * ============================================================================
 *
 * Panel ABT dan penyusun keterangan saksi dibangun untuk perceraian. Perkara lain
 * (itsbat nikah, dispensasi kawin, penetapan ahli waris, perwalian, asal usul,
 * wali adhol, harta bersama, poligami, ekonomi syariah, hadhanah, pengangkatan
 * anak) mendapat sebagian kecil saja: pengurai itsbat (14 variabel) dan empat
 * variabel DK. Berkas ini menambah SATU lapis yang sama untuk semua jenis itu:
 *
 *   1. faktaDariPosita   fakta khas jenis dari posita, lewat kamus per jenis
 *                        (kamus-deteksi/awal/<kelompok>.json, dibaca HANYA lewat
 *                        kamusDeteksi), ditambah pengurai lama (itsbat, DK,
 *                        perwalian) supaya satu jenis punya satu peta fakta.
 *   2. usulanJenis       variabel ABT dari fakta itu untuk panel "Isi dari
 *                        posita permohonan". Hanya pola "pasti" (terukur >= 95%
 *                        atas isian manusia, n >= 10) yang tercentang sendiri;
 *                        selebihnya "ragu" - tampil beserta kalimat sumbernya,
 *                        TIDAK tercentang.
 *   3. isiTemplatSaksi   templat tanya-jawab ABT per jenis (IN1/IN2/IN3, DK Pr/Lk,
 *                        PAW, PA1/PA2, 08a, WA, IP, ...) yang variabelnya belum
 *                        terisi di ABT (tercetak "...") diisi dari fakta yang sama.
 *   4. peringatanJenis   syarat saksi khas jenis (itsbat: saksi tak hadir akad =
 *                        de auditu; DK: Perma 5/2019 + umur 19; waris: ahli waris
 *                        belum diterangkan; kebendaan: saksi garis lurus Pasal 172
 *                        RBg; ...). Peringatan TIDAK menahan apa pun.
 *   5. kalimatPokok      ringkasan pokok keterangan saksi per jenis (gaya ringkas).
 *
 * Sebutan pihak SELALU dari alur/jenis_perkara_id (sebutanPihakService), bukan kata.
 * Hukum (dasar hukum di peringatan) adalah pengingat untuk hakim, bukan putusan.
 * Layanan ini tidak menulis apa pun.
 */

const kamus = require("./kamusDeteksi");
const usulanService = require("./abtUsulanService");
const lainService = require("./abtUsulanLainService");
const sebutanPihak = require("./sebutanPihakService");

/** Jenis yang dilayani. `kelompok` = berkas kamus; `pinjam` = kelompok lain yang ikut dibaca. */
const JENIS_SEMUA = Object.freeze([
  { kunci: "itsbat-nikah", nama: "Itsbat Nikah", ids: [360], kelompok: "itsbat", pola: /\bi[st]{1,2}bat\b|isbat|pengesahan\s+perkawinan/i },
  { kunci: "dispensasi-kawin", nama: "Dispensasi Kawin", ids: [362], kelompok: "dispensasi", pola: /dispensasi/i },
  { kunci: "penetapan-ahli-waris", nama: "Penetapan Ahli Waris", ids: [371], kelompok: "waris", pola: /ahli\s+waris|p3hp/i },
  { kunci: "kewarisan", nama: "Kewarisan", ids: [364, 365], kelompok: "waris", kebendaan: true, pola: /kewarisan|wasiat/i },
  { kunci: "perwalian", nama: "Perwalian", ids: [354], kelompok: "perwalian", pola: /perwalian/i },
  { kunci: "asal-usul", nama: "Asal Usul Anak", ids: [358], kelompok: "asal-usul", pinjam: ["itsbat"], pola: /asal\s*-?\s*usul/i },
  { kunci: "wali-adhol", nama: "Wali Adhol", ids: [363], kelompok: "wali-adhol", pola: /wali\s*adh?[oa]l/i },
  { kunci: "harta-bersama", nama: "Harta Bersama", ids: [348], kelompok: "harta-bersama", kebendaan: true, pola: /harta\s+bersama|gono\s*-?\s*gini/i },
  { kunci: "izin-poligami", nama: "Izin Poligami", ids: [341], kelompok: "poligami", pola: /poligami/i },
  { kunci: "ekonomi-syariah", nama: "Ekonomi Syariah", ids: [370], kelompok: "ekonomi-syariah", kebendaan: true, pola: /ekonomi\s+syari/i },
  { kunci: "hadhanah", nama: "Hadhanah", ids: [349], kelompok: "hadhanah", pola: /hadh?anah|penguasaan\s+anak|hak\s+asuh/i },
  { kunci: "pengangkatan-anak", nama: "Pengangkatan Anak", ids: [352], kelompok: "pengangkatan-anak", pola: /pengangkatan\s+anak|pengesahan\s+anak/i },
]);

const JENIS_CERAI = new Set([346, 347]);

/** Jenis dari id SIPP / nama / kunci. Cerai (346/347) dan yang tak dikenal = null. */
function kenaliJenis(jenisPerkara) {
  const teks = String(jenisPerkara === undefined || jenisPerkara === null ? "" : jenisPerkara).trim();
  if (!teks) return null;
  const angka = Number(teks);
  if (Number.isFinite(angka) && JENIS_CERAI.has(angka)) return null;
  if (/cerai/i.test(teks)) return null;
  return (
    JENIS_SEMUA.find((j) => j.kunci === teks) ||
    (Number.isFinite(angka) ? JENIS_SEMUA.find((j) => j.ids.includes(angka)) : null) ||
    JENIS_SEMUA.find((j) => j.pola.test(teks)) ||
    null
  );
}

/** Sebutan pihak dari alur/jenis_perkara_id (satu sumber). */
function sebutanJenis(jenis, alur) {
  const s = sebutanPihak.sebutanPihakPerkara({ alurPerkaraId: alur, jenisPerkaraId: jenis ? jenis.ids[0] : null });
  const permohonan = s.satu === "Pemohon";
  return {
    satu: s.satu,
    dua: s.dua,
    // Itsbat/asal usul/DK dua pemohon: "Pemohon I" dan "Pemohon II".
    pemohon1: permohonan ? `${s.satu} I` : s.satu,
    pemohon2: permohonan ? `${s.satu} II` : s.dua,
    permohonan,
  };
}

/* ============================================================================
 * PEMBANTU TEKS
 * ========================================================================== */

function polosSatuBaris(posita) {
  return usulanService
    .polosPosita(posita)
    .replace(/\n+/g, "; ")
    .replace(/[ \t]+/g, " ")
    .replace(/;\s*;/g, ";")
    .trim();
}

const KATA_DEPAN_BUANG = new Set([
  "bahwa", "almarhum", "almarhumah", "alm", "almh", "pewaris", "yaitu", "yakni", "bernama", "saudara", "sdr", "sdri",
  "bapak", "ibu", "ayah", "pemohon", "termohon", "penggugat", "tergugat", "anak", "suami", "istri", "isteri", "dan", "para",
  "menyatakan", "menetapkan", "mohon", "memohon", "dimana", "sedangkan", "kemudian", "selanjutnya",
]);

/** Membersihkan nilai menurut bentuknya. */
function bersihkanNilai(nilai, bentuk) {
  let t = String(nilai || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (bentuk === "nama") {
    const kata = t.split(" ");
    while (kata.length && KATA_DEPAN_BUANG.has(kata[0].toLowerCase().replace(/[.,]/g, ""))) kata.shift();
    t = kata.join(" ").replace(/[,;:]+$/, "").trim();
    // Kata huruf besar sesudah nama yang bukan nama ("... bin Lasa Desa X") dipangkas oleh namaDiAwal.
    const rapi = usulanService.namaDiAwal(t);
    return rapi && rapi.split(" ").length >= 1 ? rapi : t;
  }
  if (bentuk === "angka") return (t.match(/\d+/) || [""])[0];
  if (bentuk === "tanggal") return t.replace(/\s+/g, " ");
  // "untuk pengurus kelengkapan ..." - salah ketik templat posita yang selalu dibetulkan petugas.
  return t
    .replace(/^[,;:\s]+/, "")
    .replace(/[\s,;:.]+$/, "")
    .replace(/^pengurus(?=\s)/i, (m) => `${m}an`);
}

/* ============================================================================
 * 1. FAKTA DARI POSITA
 * ========================================================================== */

/** Pola aktif kelompok jenis (+ pinjaman), sudah dipisah fakta/tanya. */
function polaJenis(jenis) {
  const kelompok = [jenis.kelompok, ...(jenis.pinjam || [])];
  const semua = kelompok.flatMap((k) => kamus.polaKelompok(k));
  return {
    fakta: semua.filter((p) => (p.jenis || "fakta") === "fakta"),
    tanya: semua.filter((p) => p.jenis === "tanya"),
  };
}

function catat(peta, kunci, isi) {
  if (!kunci || !isi || (!isi.nilai && isi.nilai !== true)) return;
  if (peta[kunci]) return; // yang lebih dulu (kamus jenis sendiri) menang
  peta[kunci] = isi;
}

/** Fakta dari pengurai lama (itsbat 14 variabel, aturan perkara lain) - diberi kodePola jelas. */
function faktaPenguraiLama(posita, jenis, sebutan) {
  const peta = {};
  if (jenis.kunci === "itsbat-nikah" || jenis.kunci === "asal-usul") {
    const h = usulanService.dariPositaItsbat(posita, { pemohon: sebutan.pemohon1, pemohon2: sebutan.pemohon2 });
    for (const u of (h && h.usulan) || []) {
      if (!u.nilai) continue;
      const kalimat = u.sumber && u.sumber[0] ? u.sumber[0].kalimat : "";
      let nilai = String(u.nilai);
      // Untuk JAWABAN SAKSI (bukan usulan variabel itsbat, yang tetap lewat jalurnya sendiri):
      // "Desa X di wilayah hukum Kantor Urusan Agama Kecamatan Y" -> "Desa X, Kecamatan Y" seperti
      // saksi menuturkannya; sisa ",-" pada mahar dibuang.
      if (u.kode === "5105") nilai = nilai.replace(/\s+(?:di\s+)?wilayah\s+hukum\s+(?:Kantor\s+Urusan\s+Agama\s+|KUA\s+)?(?=Kecamatan\b)/i, ", ");
      if (u.kode === "1001") nilai = nilai.replace(/\s*,-\s*/g, " ").replace(/\s+/g, " ").trim();
      peta[u.kode] = { nilai, kalimat, kodePola: `pengurai-itsbat-${u.kode}`, yakin: "ragu", label: u.nama, asal: "pengurai-itsbat" };
    }
  }
  const aturan = (lainService.ATURAN_LAIN || {})[jenis.kunci];
  if (Array.isArray(aturan) && aturan.length) {
    const teks = usulanService.polosPosita(posita).replace(/\s+/g, " ").trim();
    const konteks = lainService.konteksAturan(posita);
    for (const a of aturan) {
      if (peta[a.kode]) continue;
      let r = null;
      try {
        r = a.ambil(teks, konteks);
      } catch (_) {
        r = null;
      }
      if (r && r.nilai) {
        const siap = lainService.sumberUsulanTerukur(jenis.kunci, a.kode).sumber === "aleta";
        peta[a.kode] = { nilai: r.nilai, kalimat: r.kalimat || "", kodePola: `aturan-lain-${jenis.kunci}-${a.kode}`, yakin: siap ? "pasti" : "ragu", label: a.nama, asal: "aturan-lain" };
      }
    }
  }
  // DK: #3333# blangko lama "KUA Kecamatan #3333#" = bagian kecamatan dari 5178.
  if (peta["5178"] && !peta["3333"]) {
    const kec = String(peta["5178"].nilai).replace(/^Kantor Urusan Agama\s+(?:\(KUA\)\s+)?Kecamatan\s+/i, "");
    if (kec && kec !== peta["5178"].nilai) peta["3333"] = { ...peta["5178"], nilai: kec, kodePola: `${peta["5178"].kodePola}-3333` };
  }
  return peta;
}

/**
 * Peta fakta satu perkara: { [kunci]: {nilai, kalimat, kodePola, yakin, label, asal} }.
 * kunci = nomor variabel ABT ("8171") atau "fakta-<nama>".
 */
function faktaDariPosita(posita, opsi = {}) {
  const jenis = opsi.jenis || kenaliJenis(opsi.jenisPerkara);
  if (!jenis) return { jenis: null, fakta: {} };
  const sebutan = opsi.sebutan || sebutanJenis(jenis, opsi.alur);
  const teks = polosSatuBaris(posita);
  const fakta = {};
  if (!teks) return { jenis, sebutan, fakta };
  for (const p of polaJenis(jenis).fakta) {
    const m = p.re.exec(teks);
    if (!m) continue;
    const mentah = m.groups && m.groups.nilai !== undefined ? m.groups.nilai : p.bentuk === "ada" ? m[0] : "";
    const nilai = p.bentuk === "ada" ? true : bersihkanNilai(mentah, p.bentuk);
    if (!nilai) continue;
    const awal = Math.max(0, teks.lastIndexOf(";", m.index) + 1);
    const akhir = teks.indexOf(";", m.index + m[0].length);
    catat(fakta, p.kunci, {
      nilai,
      // Awalan bentuk blangko ("bernama #1217##1357#" -> ", karena ...") - hanya untuk usulan variabel.
      ...(p.awalan ? { awalan: String(p.awalan) } : {}),
      kalimat: teks.slice(awal, akhir < 0 ? Math.min(teks.length, m.index + m[0].length + 120) : akhir).trim().slice(0, 400),
      kodePola: p.kode,
      yakin: p.yakin === "pasti" ? "pasti" : "ragu",
      label: p.label,
      asal: p.asal || "benih",
    });
  }
  const lama = faktaPenguraiLama(posita, jenis, sebutan);
  for (const [k, v] of Object.entries(lama)) catat(fakta, k, v);
  return { jenis, sebutan, fakta };
}

/* ============================================================================
 * 2. USULAN VARIABEL UNTUK PANEL ABT
 * ========================================================================== */

/**
 * Usulan variabel dari kamus per jenis - bentuknya sama dengan dariPositaLain.
 * Fakta dari pengurai lama TIDAK diulang di sini (pengurai itsbat / aturan perkara
 * lain sudah dikirim jalurnya sendiri); `kecuali` menyaring kode yang sudah ada.
 *
 * keyakinan "cukup" (tercentang) hanya untuk pola "pasti"; selebihnya "ragu".
 */
function usulanJenis(posita, opsi = {}) {
  const jenis = kenaliJenis(opsi.jenisPerkara);
  if (!jenis) return { ok: false, jenis: "", usulan: [], fakta: [], alasan: "jenis_perkara_tidak_dilayani" };
  const { fakta, sebutan } = faktaDariPosita(posita, { jenis, alur: opsi.alur });
  const kecuali = new Set((opsi.kecuali || []).map(String));
  const usulan = [];
  const lain = [];
  for (const [kunci, f] of Object.entries(fakta)) {
    if (f.asal === "pengurai-itsbat" || f.asal === "aturan-lain") continue;
    if (/^\d{4,5}$/.test(kunci)) {
      if (kecuali.has(kunci)) continue;
      usulan.push({
        kode: kunci,
        nama: f.label,
        nilai: `${f.awalan || ""}${String(f.nilai)}`,
        keyakinan: f.yakin === "pasti" ? "cukup" : "ragu",
        sumber: f.kalimat ? [{ saksi: 0, asal: "posita", kalimat: f.kalimat }] : [],
        siap: f.yakin === "pasti",
        kodePola: f.kodePola,
        yakin: f.yakin,
        jenisPerkara: jenis.kunci,
      });
    } else {
      lain.push({ kunci, nama: f.label, nilai: f.nilai === true ? "ya" : String(f.nilai), kodePola: f.kodePola, yakin: f.yakin });
    }
  }
  const pasti = usulan.filter((u) => u.siap).length;
  return {
    ok: true,
    jenis: jenis.kunci,
    namaJenis: jenis.nama,
    sebutan,
    usulan,
    fakta: lain,
    catatan:
      usulan.length
        ? `${usulan.length} variabel ${jenis.nama} terbaca dari posita (kamus per jenis)` +
          (pasti ? `, ${pasti} terukur pasti (tercentang).` : ".") +
          (usulan.length - pasti ? ` ${usulan.length - pasti} masih "ragu" - tidak tercentang, periksa kalimat sumbernya.` : "")
        : `Tidak ada variabel ${jenis.nama} tambahan yang terbaca dari posita.`,
  };
}

/* ============================================================================
 * 3. TEMPLAT SAKSI PER JENIS - VARIABEL "..." DIISI DARI FAKTA
 * ========================================================================== */

/** Variabel templat yang maknanya sama dengan fakta berkunci lain. */
const ALIAS_VARIABEL = Object.freeze({
  1246: "fakta-tanggal-wafat",
  1230: "fakta-tanggal-wafat-hari",
  9003: "0007",
  2026: "1025",
});

const POLA_ISIAN_KOSONG = /^\s*(?:\.{2,}|…+|_+|-+|DATA_TIDAK_ADA|TIDAK_BISA_LOAD)?\s*$/;
const POLA_SLOT = /(?:\.{3,}|…+|_{2,})/g;
const lolos = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const rapatSpasi = (s) => String(s || "").replace(/\s+/g, " ").trim();

function nilaiUntuk(kode, fakta, sebutan) {
  void sebutan;
  const k = String(kode).padStart(4, "0");
  const kunci = fakta[k] ? k : ALIAS_VARIABEL[Number(k)] || ALIAS_VARIABEL[k];
  const f = kunci ? fakta[kunci] : null;
  if (!f || f.nilai === true || !f.nilai) return null;
  let v = `${f.awalan || ""}${String(f.nilai)}`;
  // Umur di templat sudah diikuti "tahun".
  if (/^(0607|0601|7211|7212|1030)$/.test(k)) v = v.replace(/\s*tahun$/i, "");
  return { nilai: v, kunci, kodePola: f.kodePola, yakin: f.yakin };
}

/**
 * Jawaban ABT (variabel sudah diganti) disejajarkan dengan bentuk mentahnya:
 * literal di antara #NNNN# dipakai sebagai jangkar. Variabel yang tercetak
 * kosong/"..." dan punya fakta diganti; yang sudah berisi tidak disentuh.
 */
function isiDariMentah(jawab, mentah, fakta, sebutan) {
  const j = rapatSpasi(jawab);
  const m = rapatSpasi(mentah);
  if (!/#\d{4,5}#/.test(m)) return null;
  const bagian = m.split(/#(\d{4,5})#/);
  const rx = new RegExp(
    "^" + bagian.map((b, i) => (i % 2 ? "([\\s\\S]*?)" : lolos(b).replace(/\s+/g, "\\s*"))).join("") + "$",
    "i"
  );
  const cocok = j.match(rx);
  if (!cocok) return null;
  const terisi = [];
  // Variabel yang BERDEMPETAN ("#1217##1357#") tidak dapat dipisah dari jawaban terganti:
  // isian satu rangkaian dianggap kosong hanya bila gabungannya kosong/"...". Selain itu
  // rangkaian itu dibiarkan utuh (seluruhnya di variabel pertama).
  const tangkap = [];
  for (let i = 1, ke = 1; i < bagian.length; i += 2, ke++) tangkap.push(cocok[ke] || "");
  const kosongRangkaian = new Array(tangkap.length).fill(false);
  for (let a = 0; a < tangkap.length; ) {
    let b = a;
    while (b + 1 < tangkap.length && bagian[2 * (b + 1)] === "") b++;
    const gabung = tangkap.slice(a, b + 1).join("");
    const kosong = POLA_ISIAN_KOSONG.test(gabung) || /^\s*(?:\.{2,}|…+|_+)+\s*$/.test(gabung);
    for (let x = a; x <= b; x++) {
      kosongRangkaian[x] = kosong;
      if (!kosong && b > a) tangkap[x] = x === a ? gabung : "";
      // rangkaian kosong: yang tidak terisi kembali tercetak "..." seperti ABT
      else if (kosong && b > a) tangkap[x] = "...";
    }
    a = b + 1;
  }
  let ke = 0;
  const keluar = bagian.map((b, i) => {
    if (i % 2 === 0) return b;
    const urut = ke++;
    const sekarang = tangkap[urut];
    if (!kosongRangkaian[urut]) return sekarang;
    const v = nilaiUntuk(b, fakta, sebutan);
    if (!v) return sekarang;
    terisi.push({ variabel: b, nilai: v.nilai, kunci: v.kunci, kodePola: v.kodePola, yakin: v.yakin });
    return v.nilai;
  });
  if (!terisi.length) return null;
  let hasil = keluar.join("");
  if (/^[A-Z]/.test(j)) hasil = hasil.charAt(0).toUpperCase() + hasil.slice(1);
  return { jawab: hasil, terisi };
}

/** Tanpa bentuk mentah: pertanyaan dikenali kamus, SATU-SATUNYA slot jawaban diisi. */
function isiDariTanya(tanya, jawab, polaTanya, fakta, sebutan) {
  const slot = String(jawab || "").match(POLA_SLOT) || [];
  if (slot.length !== 1) return null;
  for (const p of polaTanya) {
    if (!p.re.test(String(tanya || ""))) continue;
    const kunci = String(p.kunci).replace(/^tanya-/, "");
    const v = nilaiUntuk(kunci, fakta, sebutan) || (fakta[kunci] && fakta[kunci].nilai !== true ? { nilai: String(fakta[kunci].nilai), kunci, kodePola: fakta[kunci].kodePola, yakin: fakta[kunci].yakin } : null);
    if (!v) return null;
    return { jawab: String(jawab).replace(POLA_SLOT, v.nilai), terisi: [{ variabel: "", nilai: v.nilai, kunci: v.kunci, kodePola: v.kodePola, yakin: v.yakin, kodePolaTanya: p.kode }] };
  }
  return null;
}

/**
 * GERBANG ISIAN SAKSI. Satu isian templat hanya ditulis bila pola "tanya" jenis itu
 * untuk kunci yang sama TERUKUR: nilai dari posita termuat di jawaban saksi yang
 * diketik manusia pada pertanyaan yang sama >= 75%, n >= 10 (agen3/ukur-jenis.js,
 * bagian B; angkanya di ruas `ukur` pola tanya). Yang belum lulus TIDAK ditulis ke
 * jawaban - nilainya disebut di catatan sebagai "tersedia dari posita, belum terukur".
 * Isian yang lulus tetap ditandai "diisi dari gugatan - periksa dahulu" di panel.
 */
const GERBANG_ISI_SAKSI = Object.freeze({ ketepatan: 0.75, nMinimal: 10 });

function lulusGerbangIsi(polaTanya, kunci) {
  const daftar = polaTanya.filter((p) => String(p.kunci) === `tanya-${kunci}`);
  let terbaik = null;
  for (const p of daftar) {
    const u = p.ukur || {};
    const n = Number(u.n) || 0;
    const r = n ? (Number(u.tepat) || 0) / n : 0;
    if (!terbaik || r > terbaik.ketepatan) terbaik = { ketepatan: r, n, kodePola: p.kode };
  }
  const lulus = Boolean(terbaik && terbaik.n >= GERBANG_ISI_SAKSI.nMinimal && terbaik.ketepatan >= GERBANG_ISI_SAKSI.ketepatan);
  return { lulus, ukur: terbaik };
}

/** Variabel yang isinya NAMA orang / UMUR (tahun) / jumlah anak PEMOHON sendiri. */
const KODE_NAMA = new Set(["0600", "0606", "1029", "1551", "5110", "8603", "8723", "1217", "8087", "0650", "0651"]);
const KODE_UMUR = new Set(["0601", "0607", "1030", "7211", "7212"]);
const KODE_ANAK_PEMOHON = new Set(["0007", "9003", "fakta-jumlah-anak"]);

/**
 * 20 Okt (S7): fakta hanya boleh mengisi templat bila MAKNANYA cocok dengan isian itu. Perbaikan bug dispensasi kawin:
 * "Calon suami ... bernama 3 orang anak" dan "Anak Pemohon sudah dikaruniai 3 orang anak" - jumlah anak dari perkawinan
 * Pemohon (kalimat "telah dikaruniai 3 (tiga) anak yang masing-masing bernama") terisi ke nama calon dan ke anak Pemohon
 * sendiri. Aturan: (1) jumlah anak Pemohon tidak dipakai pada jenis yang membicarakan anak Pemohon (dispensasi kawin,
 * perwalian, wali adhal); (2) isian nama tidak boleh berisi angka atau "orang anak"; (3) isian umur harus angka tahun.
 */
function maknaCocok(jenis, kunci, f) {
  const nilai = f && f.nilai === true ? "" : String((f && f.nilai) || "").trim();
  const k = String(kunci);
  if (KODE_ANAK_PEMOHON.has(k) && jenis && ["dispensasi-kawin", "perwalian", "wali-adhol"].includes(jenis.kunci)) return false;
  if (KODE_NAMA.has(k) && nilai && (/\d/.test(nilai) || /\b(?:orang\s+anak|dikaruni\w*|anak\s+yang\s+masing)/i.test(nilai))) return false;
  if (KODE_UMUR.has(k) && nilai && !/^\d{1,2}(?:\s*tahun)?$/i.test(nilai)) return false;
  return true;
}

/**
 * Templat tanya-jawab ABT untuk jenis non-cerai, dengan variabel/slot kosong diisi
 * dari posita. Mengembalikan templat BARU (masukan tidak diubah) dan daftar isian.
 *
 * @param {Array<{no, tanya, jawab, jawabMentah?}>} templat
 * @param {{posita, jenisPerkara, alur, tanpaGerbang?}} opsi
 * @returns {{jenis, namaJenis, sebutan, templat, terisi, tertahan, fakta}}
 */
function isiTemplatSaksi(templat, opsi = {}) {
  const daftar = Array.isArray(templat) ? templat : [];
  const jenis = kenaliJenis(opsi.jenisPerkara);
  if (!jenis || !daftar.length) return { jenis: jenis ? jenis.kunci : null, templat: daftar, terisi: [], tertahan: [], fakta: {} };
  const { fakta, sebutan } = faktaDariPosita(opsi.posita || "", { jenis, alur: opsi.alur });
  const { tanya: polaTanya } = polaJenis(jenis);
  // Fakta yang belum lulus gerbang tidak ikut menulis; dicatat sebagai tertahan.
  const tertahan = [];
  const faktaLulus = {};
  for (const [k, f] of Object.entries(fakta)) {
    const g = opsi.tanpaGerbang ? { lulus: true } : lulusGerbangIsi(polaTanya, k);
    if (g.lulus && maknaCocok(jenis, k, f)) faktaLulus[k] = f;
    else if (f.nilai !== true) tertahan.push({ kunci: k, nama: f.label, nilai: String(f.nilai), kodePola: f.kodePola, ukur: g.ukur || null });
  }
  const terisi = [];
  const baru = daftar.map((b, i) => {
    if (!b || typeof b !== "object") return b;
    const jawab = String(b.jawab !== undefined ? b.jawab : b.jawaban || "");
    const mentah = b.jawabMentah !== undefined ? b.jawabMentah : b.jawabanMentah;
    const tanya = String(b.tanya !== undefined ? b.tanya : b.pertanyaan || "");
    // Bentuk mentah yang bervariabel adalah sumber kebenaran letak isian: bila ia ada, slot
    // jawaban TIDAK ditebak dari pertanyaan (slot itu bisa milik variabel lain yang sudah berisi).
    const adaMentah = /#\d{4,5}#/.test(String(mentah || ""));
    const hasil = adaMentah ? isiDariMentah(jawab, mentah, faktaLulus, sebutan) : isiDariTanya(tanya, jawab, polaTanya, faktaLulus, sebutan);
    if (!hasil) return b;
    const no = String(b.no || b.urutan_pertanyaan || i + 1);
    for (const t of hasil.terisi) {
      if (!terisi.some((x) => x.no === no && x.kunci === t.kunci)) terisi.push({ no, tanya: rapatSpasi(tanya).slice(0, 160), ...t });
    }
    return b.jawab !== undefined ? { ...b, jawab: hasil.jawab } : { ...b, jawaban: hasil.jawab };
  });
  // Hanya yang memang dipakai templat ini yang disebut tertahan.
  const dipakai = new Set();
  for (const b of daftar) {
    const m = String((b && (b.jawabMentah || b.jawabanMentah)) || "");
    for (const x of m.match(/#\d{4,5}#/g) || []) {
      const k = x.replace(/#/g, "");
      dipakai.add(k);
      if (ALIAS_VARIABEL[Number(k)]) dipakai.add(ALIAS_VARIABEL[Number(k)]);
    }
    const t = String((b && (b.tanya || b.pertanyaan)) || "");
    for (const p of polaTanya) if (p.re.test(t)) dipakai.add(String(p.kunci).replace(/^tanya-/, ""));
  }
  return {
    jenis: jenis.kunci,
    namaJenis: jenis.nama,
    sebutan,
    templat: baru,
    terisi,
    tertahan: tertahan.filter((t) => dipakai.has(t.kunci) && !terisi.some((x) => x.kunci === t.kunci)),
    fakta,
  };
}

/* ============================================================================
 * 4. PERINGATAN SYARAT SAKSI PER JENIS
 * ========================================================================== */

function templatPeringatan(jenis, kodePeringatan) {
  const kel = [jenis.kelompok, ...(jenis.pinjam || []), "waris"];
  for (const k of kel) {
    const t = kamus.templatKelompok(k).find((x) => x.syarat && x.syarat.peringatan === kodePeringatan);
    if (t) return t;
  }
  return null;
}

function isi(teks, nilai) {
  return String(teks || "").replace(/\{(\w+)\}/g, (_, k) => (nilai[k] === undefined || nilai[k] === null ? "" : String(nilai[k]))).replace(/\s+/g, " ").trim();
}

/** Hubungan keluarga sedarah/semenda garis lurus (Pasal 172 ayat (1) RBg / 145 HIR). */
const GARIS_LURUS = new Set(["Ibu Kandung", "Ayah Kandung", "Orang Tua Kandung", "Ibu Tiri", "Ayah Tiri", "Mertua", "Menantu", "Anak Kandung", "Anak Tiri", "Cucu", "Kakek", "Nenek"]);

const POLA_TIDAK_HADIR = /\btidak\s+(?:hadir|menyaksikan|melihat\s+langsung)|\bmendengar\s+(?:cerita|informasi|kabar)|\binformasi\s+dari|\bdiberitahu|\bdiceritakan/i;

/**
 * @param {object} o { jenisPerkara, alur, saksiSdg (hasil susun), paragraf (paragrafSaksi), fakta }
 * @returns {Array<{kode, tingkat, pesan, saksi?, kodePola}>}
 */
function peringatanJenis(o = {}) {
  const jenis = kenaliJenis(o.jenisPerkara);
  if (!jenis) return [];
  const hasil = [];
  const fakta = o.fakta || {};
  const saksi = (o.saksiSdg && Array.isArray(o.saksiSdg.saksi) ? o.saksiSdg.saksi : []).filter(Boolean);
  const paragraf = Array.isArray(o.paragraf) ? o.paragraf : [];
  const { tanya: polaTanya } = polaJenis(jenis);
  const kunciTanya = (tanya) => {
    const p = polaTanya.find((x) => x.re.test(String(tanya || "")));
    return p ? String(p.kunci).replace(/^tanya-/, "") : "";
  };
  const tambah = (kodePeringatan, tingkat, nilai, saksiLabel) => {
    const t = templatPeringatan(jenis, kodePeringatan);
    if (!t) return;
    hasil.push({ kode: `${jenis.kunci}-${kodePeringatan}`, tingkat, pesan: isi(t.teks, nilai || {}), ...(saksiLabel ? { saksi: saksiLabel } : {}), kodePola: t.kode });
  };
  const labelSaksi = (s) => `Saksi ${s.urutPihak || s.ke} ${s.pihak === "T" ? "T" : "P"}`;
  const kosong = (b) => b.belumTerisi || /\.{3,}|…|_{2,}|\[BELUM TERISI/.test(String(b.jawab || ""));

  if (jenis.kunci === "itsbat-nikah" || jenis.kunci === "asal-usul") {
    let urut = 0;
    for (const s of saksi) {
      urut += 1;
      const hadir = (s.jawaban || []).find((b) => kunciTanya(b.tanya) === "fakta-hadir");
      if (hadir && POLA_TIDAK_HADIR.test(String(hadir.jawab || "")) && !/^\s*ya\b/i.test(String(hadir.jawab || ""))) {
        tambah("de-auditu", "ringan", { saksi: labelSaksi({ ...s, urutPihak: s.urutPihak || urut }) }, labelSaksi({ ...s, urutPihak: s.urutPihak || urut }));
      }
    }
    const pertama = saksi[0];
    if (pertama) {
      const rukun = { "1217": "wali nikah", "0650": "saksi nikah", "8087": "yang menikahkan" };
      const belum = [];
      for (const b of pertama.jawaban || []) {
        const k = kunciTanya(b.tanya);
        if (rukun[k] && kosong(b) && !belum.includes(rukun[k])) belum.push(rukun[k]);
      }
      if (belum.length) tambah("rukun-kosong", "ringan", { yang: belum.join(", ") });
    }
  }
  if (jenis.kunci === "dispensasi-kawin") {
    tambah("perma-dk", "info", {});
    for (const [kode, siapa] of [["0607", "Calon mempelai wanita"], ["0601", "Calon mempelai pria"]]) {
      const u = fakta[kode] && Number(String(fakta[kode].nilai).match(/\d+/));
      if (u && u >= 19) tambah("umur-cukup", "ringan", { siapa: `${siapa} (${fakta[kode === "0607" ? "0606" : "0600"] ? fakta[kode === "0607" ? "0606" : "0600"].nilai : ""})`.replace(" ()", ""), umur: u });
    }
    if (fakta["fakta-hamil"]) tambah("hamil", "info", { hamil: fakta["fakta-hamil"].nilai });
  }
  if (jenis.kunci === "penetapan-ahli-waris" || jenis.kunci === "kewarisan") {
    const pertama = saksi[0];
    const belum = [];
    for (const b of (pertama && pertama.jawaban) || []) {
      if (!kosong(b)) continue;
      const t = String(b.tanya || "").toLowerCase();
      for (const [kata, label] of [[/anak/, "anak pewaris"], [/menikah|isteri|istri|suami/, "perkawinan pewaris"], [/saudara/, "saudara pewaris"], [/ayah|ibu|kakek|nenek/, "orang tua/kakek-nenek pewaris"], [/keperluan/, "keperluan permohonan"]]) {
        if (kata.test(t) && !belum.includes(label)) belum.push(label);
      }
    }
    if (belum.length) tambah("ahli-waris-kosong", "ringan", { yang: belum.join(", ") });
  }
  if (jenis.kebendaan) {
    for (const p of paragraf) {
      const kunci = p && p.hubungan && p.hubungan.kunci;
      if (kunci && GARIS_LURUS.has(kunci)) tambah("saksi-garis-lurus", "ringan", { saksi: p.label, hubungan: kunci }, p.label);
    }
  }
  const info = {
    perwalian: "syarat-wali",
    "asal-usul": "dasar-asal-usul",
    "wali-adhol": "wali-adhol",
    "harta-bersama": "harta-bersama",
    "izin-poligami": "poligami",
    "ekonomi-syariah": "ekonomi-syariah",
    hadhanah: "hadhanah",
    "pengangkatan-anak": "pengangkatan-anak",
  }[jenis.kunci];
  if (info) tambah(info, "info", { kosong: "" });
  return hasil;
}

/* ============================================================================
 * 5. KALIMAT POKOK KETERANGAN SAKSI PER JENIS (gaya ringkas)
 * ========================================================================== */

function isiKurung(teks, nilai) {
  const v = (k) => (nilai[k] === undefined || nilai[k] === null || nilai[k] === true ? "" : String(nilai[k]).trim());
  return String(teks || "")
    .replace(/\[([^[\]]*)\]/g, (_, dalam) => ([...dalam.matchAll(/\{(\w+)\}/g)].every((m) => v(m[1])) ? dalam : ""))
    .replace(/\{(\w+)\}/g, (_, k) => v(k))
    .replace(/\s+/g, " ")
    .replace(/\s+([,;.])/g, "$1")
    .trim();
}

function kalimatPokok(o = {}) {
  const jenis = kenaliJenis(o.jenisPerkara);
  if (!jenis) return null;
  const sebutan = o.sebutan || sebutanJenis(jenis, o.alur);
  const semua = o.fakta || faktaDariPosita(o.posita || "", { jenis, alur: o.alur, sebutan }).fakta;
  // Hanya fakta yang lulus gerbang isian saksi - sama dengan yang ditulis ke jawaban.
  const { tanya: polaTanya } = polaJenis(jenis);
  const fakta = {};
  for (const [k, f] of Object.entries(semua)) if (o.tanpaGerbang || lulusGerbangIsi(polaTanya, k).lulus) fakta[k] = f;
  const kel = [jenis.kelompok, ...(jenis.pinjam || [])];
  const cariGaya = (gaya) => {
    for (const k of kel) {
      const x = kamus.templatKelompok(k).find((y) => y.gaya === gaya && (!y.syarat || !y.syarat.jenis || y.syarat.jenis === jenis.kunci));
      if (x) return x;
    }
    return null;
  };
  const t = cariGaya("ringkas");
  if (!t) return null;
  const tl = cariGaya("lengkap");
  const para = /\bpara\s+(?:Pemohon|Penggugat)\b/i.test(String(o.posita || "")) ? `para ${sebutan.satu}` : sebutan.satu;
  const nilai = { pemohon1: sebutan.pemohon1, pemohon2: sebutan.pemohon2, satu: sebutan.satu, dua: sebutan.dua, para };
  for (const [k, f] of Object.entries(fakta)) nilai[k] = f.nilai;
  if (fakta["fakta-tanggal-wafat"]) nilai.tanggalWafat = fakta["fakta-tanggal-wafat"].nilai;
  // {wali}: "Ayah Kandung bernama X", atau "X" saja bila hubungan wali tidak terbaca.
  if (fakta["1217"]) nilai.wali = fakta["1046"] ? `${fakta["1046"].nilai} bernama ${fakta["1217"].nilai}` : String(fakta["1217"].nilai);
  const ringkas = isiKurung(t.teks, nilai);
  if (!ringkas) return null;
  // Gaya lengkap: satu butir "- Bahwa ..." per baris; "|" di templat = ganti baris.
  const lengkap = tl
    ? isiKurung(tl.teks, nilai)
        .split("|")
        .map((b) => b.trim())
        .filter(Boolean)
        .join("\n")
    : "";
  return {
    ringkas: `Bahwa saksi menerangkan ${ringkas};`,
    ...(lengkap ? { lengkap } : {}),
    kodePola: t.kode,
    kodePolaGaya: { ringkas: t.kode, ...(tl ? { lengkap: tl.kode } : {}) },
  };
}

/* ============================================================================
 * PENYAMBUNG RUTE /abt/usulan (dipakai internalGatewayRoutes, blok JENIS3)
 * ========================================================================== */

/**
 * Menambah usulan kamus per jenis ke hasil itsbat / perkara lain yang sudah ada.
 * Kode yang sudah diputuskan jalur lama (usulan, bawaanAbt, belumSiap) TIDAK diulang -
 * keputusan sumber terukurnya tetap berlaku. Jenis yang dulu "tidak dilayani" kini
 * dijawab ok:true bila kamusnya mengenalnya.
 */
function tambahUsulanJenis(hasil, posita, opsi = {}) {
  const lama = hasil && typeof hasil === "object" ? hasil : null;
  const ada = new Set(
    [...((lama && lama.usulan) || []), ...((lama && lama.bawaanAbt) || []), ...((lama && lama.belumSiap) || [])].map((u) => String(u && u.kode))
  );
  const jenis = kenaliJenis(opsi.jenisPerkara);
  if (!jenis) return hasil;
  if (!polosSatuBaris(posita)) {
    return lama && lama.ok === false ? { ...lama, ...(lama.alasan === "jenis_perkara_tidak_dilayani" ? { alasan: "posita_kosong", jenis: jenis.kunci } : {}) } : hasil;
  }
  const t = usulanJenis(posita, { jenisPerkara: opsi.jenisPerkara, alur: opsi.alur, kecuali: [...ada] });
  if (!t.ok) return hasil;
  const ringkas = { jenis: t.jenis, namaJenis: t.namaJenis, jumlah: t.usulan.length, pasti: t.usulan.filter((u) => u.siap).length };
  if (!lama || lama.ok === false) {
    if (lama && lama.alasan && lama.alasan !== "jenis_perkara_tidak_dilayani") return hasil;
    return { ok: true, jenis: t.jenis, usulan: t.usulan, belumSiap: [], bawaanAbt: [], catatan: t.catatan, faktaJenis: t.fakta, usulanJenis: ringkas };
  }
  return {
    ...lama,
    usulan: [...(Array.isArray(lama.usulan) ? lama.usulan : []), ...t.usulan],
    faktaJenis: t.fakta,
    usulanJenis: ringkas,
    catatan: [lama.catatan || "", t.usulan.length ? t.catatan : ""].filter(Boolean).join(" "),
  };
}

/**
 * Menambah ruas jenis ke hasil susunKeteranganSaksiSdg (sesudah paragraf P5P6).
 *   jenisPerkara, terisiDariJenis, tertahanJenis, kalimatPokokJenis, peringatanSaksi (+ per jenis)
 * Isian dari posita ikut disebut di terisiDariPosita - panel menyorotnya "periksa dahulu".
 * Peringatan syiqaq (Pasal 76 UU 7/1989) dibuang: hanya berlaku untuk perceraian.
 */
function lengkapiSaksiJenis(saksiSdg, isiJenis, opsi = {}) {
  if (!saksiSdg || !saksiSdg.ok || !isiJenis || !isiJenis.jenis) return saksiSdg;
  saksiSdg.jenisPerkara = { kunci: isiJenis.jenis, nama: isiJenis.namaJenis };
  // Alasan PERCERAIAN yang terbaca dari posita non-cerai (34 dari 40 posita permohonan 2026
  // terbaca "pihak lain (wanita/pria idaman lain)" karena kalimat baku "tidak ada pihak ketiga
  // yang mengganggu gugat pernikahan")
  // tidak berarti apa-apa di sini dan tidak mengubah satu jawaban pun - dibuang dari tampilan.
  if (saksiSdg.asalAlasan === "posita" && Array.isArray(saksiSdg.alasan) && saksiSdg.alasan.length) {
    saksiSdg.alasanDibuangJenis = saksiSdg.alasan;
    saksiSdg.alasan = [];
    saksiSdg.asalAlasan = "";
  }
  saksiSdg.terisiDariJenis = isiJenis.terisi || [];
  saksiSdg.tertahanJenis = isiJenis.tertahan || [];
  if (!Array.isArray(saksiSdg.terisiDariPosita)) saksiSdg.terisiDariPosita = [];
  for (const t of saksiSdg.terisiDariJenis) {
    if (!saksiSdg.terisiDariPosita.some((x) => String(x.no) === String(t.no))) saksiSdg.terisiDariPosita.push({ no: t.no, tanya: t.tanya });
  }
  const per = peringatanJenis({
    jenisPerkara: opsi.jenisPerkara,
    alur: opsi.alur,
    saksiSdg,
    paragraf: saksiSdg.paragrafSaksi,
    fakta: isiJenis.fakta,
  });
  const lama = Array.isArray(saksiSdg.peringatanSaksi) ? saksiSdg.peringatanSaksi.filter((p) => !/^syiqaq/.test(String(p.kode || ""))) : [];
  if (per.length || lama.length || Array.isArray(saksiSdg.peringatanSaksi)) saksiSdg.peringatanSaksi = [...lama, ...per];
  const pokok = kalimatPokok({ posita: opsi.posita, jenisPerkara: opsi.jenisPerkara, alur: opsi.alur, fakta: isiJenis.fakta, sebutan: isiJenis.sebutan });
  if (pokok) saksiSdg.kalimatPokokJenis = { ...pokok, jenis: isiJenis.jenis, nama: isiJenis.namaJenis };
  const kabar = [];
  if (saksiSdg.terisiDariJenis.length) {
    const no = [...new Set(saksiSdg.terisiDariJenis.map((t) => t.no))];
    kabar.push(`${no.length} jawaban templat ${isiJenis.namaJenis} diisi dari posita (variabel ABT yang belum terisi) - periksa dahulu.`);
  }
  if (saksiSdg.tertahanJenis.length) {
    kabar.push(
      `Tersedia dari posita tetapi belum terukur cukup, TIDAK diisikan: ${saksiSdg.tertahanJenis
        .slice(0, 6)
        .map((t) => `${t.nama || t.kunci} = "${String(t.nilai).slice(0, 80)}"`)
        .join("; ")}.`
    );
  }
  if (kabar.length) saksiSdg.catatan = `${kabar.join(" ")} ${saksiSdg.catatan || ""}`.trim();
  return saksiSdg;
}

module.exports = {
  JENIS_SEMUA,
  GERBANG_ISI_SAKSI,
  tambahUsulanJenis,
  lengkapiSaksiJenis,
  ALIAS_VARIABEL,
  GARIS_LURUS,
  kenaliJenis,
  sebutanJenis,
  bersihkanNilai,
  faktaDariPosita,
  usulanJenis,
  isiTemplatSaksi,
  isiDariMentah,
  peringatanJenis,
  kalimatPokok,
};
