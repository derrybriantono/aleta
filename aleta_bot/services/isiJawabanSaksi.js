"use strict";

/**
 * ============================================================================
 * PENGISI JAWABAN SAKSI BERSUMBER - MESIN PENGISI (20 Okt 2026)
 * ============================================================================
 *
 * Murni (tanpa jaringan/basis data). Pembagian berkas:
 *   isiJawabanSaksiFakta.js   fakta berurutan sumber (isian blangko > data SIPP > posita), pembersih nilai
 *   isiJawabanSaksiPosita.js  pola tambahan membaca posita
 *   isiJawabanSaksi.js        (ini) pola kalimat jawaban -> slot fakta, kontrak {teks, yakin, sumber, ket}
 *   isiJawabanSaksiService.js bacaan SIPP + deteksi posita bot + pemasangan ke hasil rute 'saksi-sdg'
 *
 * Cara kerja: tiap jawaban templat (mis. "Pemohon I dan Pemohon II menikah pada ... di ...;") dicocokkan dengan POLA
 * KALIMAT (CUES) menurut bunyi jawabannya; tiap pola menyebut fakta mana yang mengisi titik-titik urutan ke berapa.
 * Titik-titik yang faktanya tidak ada dibiarkan. Pola berbasis bunyi jawaban (bukan nomor baris) sehingga tahan
 * terhadap set pertanyaan yang diubah petugas atau berbeda per jenis perkara.
 */

const F = require("./isiJawabanSaksiFakta");
const { T, RE_SEBUTAN, adaTitik, hitungTitik, minYakin, kecilAwal, norm, rapat, tanpaProvinsi } = F;

const RE_TITIK_G = /\.{3,}|…/g;
const adaPlaceholder = (t) => /\{[a-zA-Z0-9_]+\}/.test(String(t || ""));
/** Jawaban masih memuat bagian yang belum terisi: titik-titik, "{placeholder}" katalog, atau "#kode#" ABT. */
const masihKosong = (t) => adaTitik(t) || adaPlaceholder(t) || /#\d{3,5}#/.test(String(t || ""));

// ============================================================================
// Alat pola
// ============================================================================

/** Menghitung pihak pertama/kedua dari sebutan di kalimat: "Pemohon I"/"Penggugat"/"Pemohon" = 1; "Pemohon II"/"Tergugat"/"Termohon" = 2. */
function pihakKe(sebutan) {
  const s = String(sebutan || "").trim();
  if (/\b(?:Tergugat|Termohon)\b/i.test(s)) return 2;
  const rom = /\b(I{1,3}|IV|\d)\s*$/.exec(s);
  if (rom) return rom[1] === "I" || rom[1] === "1" ? 1 : 2;
  return 1;
}

/** Penolong yang dipakai tiap pola: membaca fakta + mencatat fakta yang benar-benar dipakai. */
function penolong(fakta, ctx, pakai) {
  const h = {
    ctx,
    fakta,
    /** Nilai fakta (diformat bila ada pemformat); null bila tidak ada. */
    nilai(kunci, format) {
      const f = fakta.ambil(kunci);
      if (!f) return null;
      const teks = format ? format(f.nilai, f) : f.nilai;
      if (teks == null || teks === "") return null;
      pakai.push(f);
      return teks;
    },
    /** Mengganti titik-titik di `m` berurutan dengan `nilai[i]` (null = dibiarkan). */
    isi(m, nilai) {
      let i = 0;
      return m.replace(RE_TITIK_G, (t) => {
        const v = nilai[i++];
        return v == null || v === "" ? t : v;
      });
    },
    /** Tempat menikah: tempat (desa/kecamatan) bila ada; KUA melengkapi atau menjadi cadangan. */
    tempat() {
      const tp = fakta.ambil("tempatNikah");
      const kua = fakta.ambil("kua");
      const kec = (x) => norm((/Kecamatan\s+([A-Za-z' -]+?)(?:,|$)/i.exec(x) || [])[1]);
      if (tp && kua && /Kecamatan/i.test(tp.nilai) && kec(tp.nilai) && kec(kua.nilai) && kec(tp.nilai) !== kec(kua.nilai)) {
        pakai.push({ ...tp, yakin: "ragu", ket: `Tempat menikah menurut ${tp.sumber} ("${F.potong(tp.nilai)}") tidak sama dengan KUA menurut ${kua.sumber} ("${F.potong(kua.nilai)}"). Periksa.` });
        return tp.nilai;
      }
      if (tp) {
        pakai.push(tp);
        if (/Kecamatan|Kabupaten|Kota\b|Kec\./i.test(tp.nilai) || !kua) return tp.nilai;
        pakai.push(kua);
        return `${tp.nilai}, wilayah ${kua.nilai}`;
      }
      if (kua) {
        pakai.push(kua);
        return `wilayah ${kua.nilai}`;
      }
      return null;
    },
    /** Hubungan wali tanpa sebutan pihak di ujungnya ("Ayah Kandung Pemohon II" -> "ayah kandung"). */
    hubunganWali(denganSebutan) {
      const f = fakta.ambil("waliHubungan");
      if (!f) return null;
      pakai.push(f);
      const inti = f.nilai.replace(new RegExp(`\\s+${RE_SEBUTAN}\\s*$`, "i"), "").trim();
      // "Ayah Kandung" -> "ayah kandung"; sebutan pihak (Pemohon II) tetap berhuruf besar.
      const kecilKata = (t) => t.replace(/\b[A-Z][a-z-]+\b/g, (k) => (/^(?:Pemohon|Termohon|Penggugat|Tergugat)$/.test(k) ? k : k.toLowerCase()));
      return denganSebutan ? kecilKata(f.nilai) : kecilKata(inti);
    },
    jenisWali() {
      const f = fakta.ambil("waliHubungan");
      if (!f) return null;
      pakai.push(f);
      return /hakim|kepala\s+kua|penghulu|pegawai\s+pencatat/i.test(f.nilai) ? "wali hakim" : "wali nasab";
    },
    alamat(sisi) {
      const f = fakta.ambil(sisi === 1 ? "alamatP" : "alamatT");
      if (!f) return null;
      pakai.push(f);
      return tanpaProvinsi(f.nilai);
    },
  };
  return h;
}

const kecilNilai = (v) => (v == null ? v : v.charAt(0).toLowerCase() + v.slice(1));

// ============================================================================
// Pola kalimat jawaban
// ============================================================================

/**
 * Tiap pola:
 *   id      nama (untuk uji dan laporan)
 *   jenis   daftar kode jenis yang boleh (kosong = semua)
 *   re      pola atas JAWABAN templat; setiap kecocokan diganti hasil bangun()
 *   tanya   (opsional) pola atas PERTANYAAN yang harus cocok
 *   bangun  ({ m, g, h, ctx }) -> teks pengganti | null (null = dibiarkan)
 */
const CUES = [];
const cue = (id, re, bangun, opsi) => CUES.push({ id, re, bangun, ...(opsi || {}) });

// ---- pernikahan (itsbat, asal usul anak, cerai) -----------------------------

cue("nikah-tgl-tempat", new RegExp(`menikah\\s+pada\\s+${T}\\s+di\\s+${T}`, "gi"), ({ m, h }) => {
  const tgl = h.nilai("tglNikah");
  const tempat = h.tempat();
  return h.isi(m, [tgl, tempat ? `${tempat}` : null]);
});
cue("nikah-tgl-saja", new RegExp(`menikah\\s+pada\\s+${T}(?!\\s+dan\\s+bercerai)(?!\\s+di\\b)`, "gi"), ({ m, h }) => h.isi(m, [h.nilai("tglNikah")]));

cue("wali-nikah", new RegExp(`wali\\s+nikah\\s+adalah\\s+${T}\\s+bernama\\s+${T},?\\s+yaitu\\s+${T}(\\s+${RE_SEBUTAN})?`, "gi"), ({ m, g, h }) => {
  const adaSebutan = Boolean(g[0]);
  const hubungan = h.hubunganWali(false);
  const hakim = hubungan && /hakim/i.test(hubungan);
  return h.isi(m, [h.jenisWali(), h.nilai("waliNama"), hakim && adaSebutan ? "wali hakim bagi" : hubungan]);
});
cue("wali-nikahnya-aua", new RegExp(`wali\\s+nikahnya\\s+${T}\\s+bernama\\s+${T},\\s+yang\\s+menikahkan\\s+${T},\\s+saksinya\\s+${T}\\s+dan\\s+${T}`, "gi"), ({ m, h }) =>
  h.isi(m, [h.hubunganWali(false), h.nilai("waliNama"), h.nilai("penikah"), h.nilai("saksiNikah1"), h.nilai("saksiNikah2")])
);
cue("menikahkan", new RegExp(`yang\\s+menikahkan\\s+adalah\\s+${T}`, "gi"), ({ m, h }) => h.isi(m, [h.nilai("penikah")]));
cue("saksi-nikah", new RegExp(`saksi\\s+nikahnya\\s+dua\\s+orang,?\\s+yaitu\\s+${T}\\s+dan\\s+${T}`, "gi"), ({ m, h }) => h.isi(m, [h.nilai("saksiNikah1"), h.nilai("saksiNikah2")]));
cue("mahar", new RegExp(`mahar(?:nya)?\\s+(?:berupa|yaitu)\\s+${T}(\\s*,?\\s*(?:dan\\s+)?dibayar\\s+(?:secara\\s+)?(?:tunai|hutang|kontan))?`, "gi"), ({ m, g, h }) => {
  const f = h.fakta.ambil("mahar");
  if (!f) return null;
  const u = F.uraiMahar(f.nilai);
  if (!u.barang) return null;
  h.nilai("mahar");
  let teks = h.isi(m.replace(/\s*,?\s*(?:dan\s+)?dibayar\s+(?:secara\s+)?(?:tunai|hutang|kontan)\s*$/i, ""), [u.barang]);
  const asalBayar = g[0] ? (/hutang/i.test(g[0]) ? "hutang" : "tunai") : "";
  const bayar = u.bayar || asalBayar;
  if (u.bayar === "tunai") teks += ", dibayar tunai";
  else if (u.bayar === "hutang") teks += ", belum dibayar (terhutang)";
  else if (asalBayar) {
    // cara bayar tidak disebut di sumber: bunyi dari contoh jawaban dipertahankan tetapi ditandai ragu
    teks += asalBayar === "tunai" ? ", dibayar tunai" : ", belum dibayar (terhutang)";
    h.ctx.__raguBayar = true;
  }
  return bayar ? teks : teks;
});
cue("status-pihak", new RegExp(`(${RE_SEBUTAN})\\s+berstatus\\s+${T}`, "gi"), ({ m, g, h, ctx }) => {
  if (ctx.jenis !== "itsbat" && ctx.jenis !== "aua") return null;
  const k = pihakKe(g[0]) === 1 ? "statusP1" : "statusP2";
  return h.isi(m, [h.nilai(k, (v) => v.toLowerCase())]);
});
cue("umur-nikah", new RegExp(`berumur\\s+sekitar\\s+${T}\\s+tahun\\s+dan\\s+(${RE_SEBUTAN})\\s+sekitar\\s+${T}\\s+tahun`, "gi"), ({ m, h }) => h.isi(m, [h.nilai("umurP1"), h.nilai("umurP2")]));
cue("isteri-lain-perjaka-a", new RegExp(`\\s*${T}\\s*\\(\\s*tidak\\s+mempunyai\\s+isteri\\s+lain[^)]*\\)`, "gi"), ({ h, ctx }) => {
  const s = h.fakta.ambil("statusP1");
  if (!s || !/perjaka|jejaka/i.test(s.nilai) || ctx.jenis !== "itsbat") return null;
  h.nilai("statusP1");
  return " tidak mempunyai isteri lain";
});
cue("isteri-lain-perjaka-b", new RegExp(`^\\s*${T}\\s*\\(\\s*tidak\\s+ada\\s+isteri\\s+lain[^)]*\\)`, "gi"), ({ h, ctx }) => {
  const s = h.fakta.ambil("statusP1");
  if (!s || !/perjaka|jejaka/i.test(s.nilai) || ctx.jenis !== "itsbat") return null;
  h.nilai("statusP1");
  return "Tidak ada isteri lain";
});
cue(
  "anak-karunia",
  new RegExp(`(dikaruniai|mempunyai|memiliki)\\s+${T}\\s+orang\\s+anak(?:,\\s*sekarang\\s+anak\\s+tersebut\\s+tinggal\\s+bersama\\s+${T})?`, "gi"),
  ({ m, g, h, ctx }) => {
    const n = h.fakta.ambil("jumlahAnak");
    if (!n) return null;
    h.nilai("jumlahAnak");
    if (n.nilai === "0") return `${/dikaruniai/i.test(g[0]) ? "belum dikaruniai" : "belum mempunyai"} anak`;
    let teks = h.isi(m, [n.nilai]);
    if (/tinggal\s+bersama\s+(?:\.{3,}|…)/.test(teks)) {
      const ikut = h.fakta.ambil("anakIkutPihak");
      if (ikut) {
        h.nilai("anakIkutPihak");
        teks = h.isi(teks, [ikut.nilai === "P" ? ctx.P : ctx.T]);
      }
    }
    return teks;
  }
);
cue("tidak-tercatat", new RegExp(`tidak\\s+tercatat\\s+karena\\s+${T};\\s*itsbat\\s+nikah\\s+diperlukan\\s+untuk\\s+${T}`, "gi"), ({ m, h }) => h.isi(m, [h.nilai("sebabTidakTercatat"), h.nilai("tujuan")]), { jenis: ["itsbat"] });

// ---- cerai -------------------------------------------------------------------

cue("kediaman-bersama", new RegExp(`tinggal\\s+bersama\\s+di\\s+${T}`, "gi"), ({ m, h }) => h.isi(m, [h.nilai("kediaman", kecilNilai)]), { jenis: ["cg", "ct"] });
cue("awal-konflik", new RegExp(`sejak\\s+${T}(\\s+tidak\\s+rukun|\\s*;?\\s*$)`, "gi"), ({ m, h }) => h.isi(m, [h.nilai("awalKonflik")]), { jenis: ["cg", "ct"], tanya: /keadaan\s+rumah\s+tangga|perselisihan|pertengkaran/ });
cue("awal-konflik-2", new RegExp(`(?:perselisihan\\s+dan\\s+pertengkaran|pertengkaran\\s+dan\\s+perselisihan)\\s+sejak\\s+${T}`, "gi"), ({ m, h }) => h.isi(m, [h.nilai("awalKonflik")]), { jenis: ["cg", "ct"] });
cue("puncak", new RegExp(`puncaknya\\s+terjadi\\s+pada\\s+${T}\\s+ketika\\s+${T}`, "gi"), ({ m, h }) => h.isi(m, [h.nilai("puncak"), h.nilai("puncakPeristiwa")]), { jenis: ["cg", "ct"] });
cue("pisah-sejak", new RegExp(`berpisah\\s+tempat\\s+tinggal\\s+sejak\\s+${T},\\s*sudah\\s+sekitar\\s+${T}(?:\\s+(?:bulan|tahun)(?:\\s*\\/\\s*(?:bulan|tahun))?)?`, "gi"), ({ m, h }) => {
  const sejak = h.nilai("pisahSejak");
  const lama = h.fakta.ambil("lamaPisah");
  let teks = h.isi(m, [sejak, null]);
  if (lama) {
    h.nilai("lamaPisah");
    teks = teks.replace(new RegExp(`sudah\\s+sekitar\\s+${T}(?:\\s+(?:bulan|tahun)(?:\\s*\\/\\s*(?:bulan|tahun))?)?`, "i"), `sudah sekitar ${lama.nilai}`);
  }
  return teks;
}, { jenis: ["cg", "ct"] });
cue("meninggalkan", new RegExp(`yang\\s+meninggalkan\\s+[^;.]{0,50}?adalah\\s+${T}`, "gi"), ({ m, h }) => h.isi(m, [h.nilai("siapaPergi")]), { jenis: ["cg", "ct"] });
cue("tinggal-di", new RegExp(`(${RE_SEBUTAN})\\s+tinggal\\s+di\\s+${T}`, "gi"), ({ m, g, h }) => h.isi(m, [h.alamat(pihakKe(g[0]))]), { jenis: ["cg", "ct"] });
// 20 Okt 2026 (U1): pekerjaan pihak dari data SIPP ("Tergugat bekerja sebagai ..." pada set sebab/nafkah/hak asuh).
cue("bekerja-sebagai", new RegExp(`(${RE_SEBUTAN})\\s+bekerja\\s+sebagai\\s+${T}`, "gi"), ({ m, g, h }) => h.isi(m, [h.nilai(pihakKe(g[0]) === 1 ? "pekerjaanP" : "pekerjaanT")]), { jenis: ["cg", "ct"] });

// ---- dispensasi kawin -----------------------------------------------------------

cue("dk-kua-penolak", new RegExp(`ditolak\\s+KUA\\s+Kecamatan\\s+${T}`, "gi"), ({ m, h }) => h.isi(m, [h.nilai("kuaPenolak")]), { jenis: ["dk"] });
cue("dk-anak", new RegExp(`anak\\s+Pemohon\\s+bernama\\s+${T},\\s*sekarang\\s+berumur\\s+${T}\\s+tahun`, "gi"), ({ m, h }) => h.isi(m, [h.nilai("anakNama"), h.nilai("anakUmur")]), { jenis: ["dk"] });
cue("dk-calon", new RegExp(`calon\\s+(?:suami|isteri)\\s+anak\\s+Pemohon\\s+bernama\\s+${T},\\s*umur\\s+${T}\\s+tahun,\\s*bekerja\\s+sebagai\\s+${T}`, "gi"), ({ m, h }) =>
  h.isi(m, [h.nilai("calonNama"), h.nilai("calonUmur"), h.nilai("calonPekerjaan")]), { jenis: ["dk"] });
cue("dk-kenal", new RegExp(`saling\\s+mengenal\\s+sejak\\s+${T};\\s*hubungan\\s+mereka\\s+sudah\\s+${T}`, "gi"), ({ m, h }) => {
  const lama = h.fakta.ambil("lamaKenal");
  const sudah = h.nilai("eratHubungan");
  let teks = h.isi(m, [null, sudah]);
  if (lama) {
    h.nilai("lamaKenal");
    // posita menulis lamanya ("2 tahun"), bukan awalnya: "sejak" -> "selama"
    teks = teks.replace(new RegExp(`saling\\s+mengenal\\s+sejak\\s+${T}`, "i"), `saling mengenal selama ${lama.nilai}`);
  }
  return teks;
}, { jenis: ["dk"] });
cue("dk-khawatir", new RegExp(`yang\\s+dikhawatirkan\\s+${T}`, "gi"), ({ m, h }) => {
  const hamil = h.fakta.ambil("hamil");
  if (hamil) {
    h.nilai("hamil");
    return `Yang dikhawatirkan anak tersebut sedang hamil ${hamil.nilai} dan hubungan mereka sudah tidak dapat dipisahkan`;
  }
  const erat = h.fakta.ambil("eratHubungan");
  if (erat) {
    h.nilai("eratHubungan");
    return "Yang dikhawatirkan hubungan mereka yang sudah sangat erat dan tidak dapat lagi dipisahkan";
  }
  return null;
}, { jenis: ["dk"] });
cue("dk-status-calon", new RegExp(`calon\\s+(?:suami|isteri)nya\\s+berstatus\\s+${T}`, "gi"), () => null, { jenis: ["dk"] });

// ---- wali adhal --------------------------------------------------------------------

cue("wa-calon", new RegExp(`calon\\s+suami\\s+Pemohon\\s+bernama\\s+${T},\\s*umur\\s+${T}\\s+tahun,\\s*beragama\\s+Islam,\\s*bekerja\\s+sebagai\\s+${T}`, "gi"), ({ m, h }) =>
  h.isi(m, [h.nilai("calonNama"), h.nilai("calonUmur"), h.nilai("calonPekerjaan")]), { jenis: ["wa"] });
cue("wa-wali", new RegExp(`wali\\s+nasab\\s+Pemohon\\s+adalah\\s+${T}\\s+bernama\\s+${T}`, "gi"), ({ m, h }) => h.isi(m, [h.hubunganWali(false), h.nilai("waliNama")]), { jenis: ["wa"] });
cue("wa-lamaran", new RegExp(`lamaran\\s+disampaikan\\s+pada\\s+${T}`, "gi"), ({ m, h }) => h.isi(m, [h.nilai("tglLamar")]), { jenis: ["wa"] });
cue("wa-alasan", new RegExp(`^Alasannya\\s+karena\\s+${T}`, "gi"), ({ m, h }) => h.isi(m, [h.nilai("alasanWali", kecilNilai)]), { jenis: ["wa"] });

// ---- ahli waris / kewarisan / perwalian / asal usul anak --------------------------------

cue("paw-meninggal", new RegExp(`yang\\s+meninggal\\s+dunia\\s+adalah\\s+${T}\\s+pada\\s+${T}\\s+di\\s+${T}\\s+karena\\s+${T}`, "gi"), ({ m, h }) =>
  h.isi(m, [h.nilai("pewarisNama"), h.nilai("wafatTgl"), h.nilai("wafatTempat"), h.nilai("wafatSebab")]), { jenis: ["paw"] });
cue("waris-meninggal", new RegExp(`pewaris\\s+bernama\\s+${T}\\s+meninggal\\s+dunia\\s+pada\\s+${T}\\s+karena\\s+${T}`, "gi"), ({ m, h }) =>
  h.isi(m, [h.nilai("pewarisNama"), h.nilai("wafatTgl"), h.nilai("wafatSebab")]), { jenis: ["waris"] });
cue("waris-anak", new RegExp(`pewaris\\s+mempunyai\\s+${T}\\s+orang\\s+anak(?:\\s+kandung)?,\\s*yaitu\\s+${T}`, "gi"), ({ m, h }) =>
  h.isi(m, [h.nilai("jumlahAnakPewaris"), h.nilai("anakPewaris")]), { jenis: ["paw", "waris"] });
cue("perwalian-anak", new RegExp(`sebagai\\s+wali\\s+bagi\\s+anak\\s+bernama\\s+${T}`, "gi"), ({ m, h }) => h.isi(m, [h.nilai("anakNama")]), { jenis: ["perwalian"] });
cue("perwalian-anak-umur", new RegExp(`anak\\s+tersebut\\s+bernama\\s+${T},\\s*berumur\\s+${T}\\s+tahun`, "gi"), ({ m, h }) => h.isi(m, [h.nilai("anakNama"), null]), { jenis: ["perwalian"] });
cue("aua-anak", new RegExp(`anak\\s+tersebut\\s+bernama\\s+${T},\\s*lahir\\s+pada\\s+${T}\\s+di\\s+${T}`, "gi"), ({ m, h }) => h.isi(m, [h.nilai("anakNama"), h.nilai("anakLahirTgl"), h.nilai("anakLahirTempat")]), { jenis: ["aua"] });
cue("tujuan-keperluan", new RegExp(`untuk\\s+keperluan\\s+${T}(?!\\s*\\()`, "gi"), ({ m, h, ctx }) => {
  if (!["paw", "perwalian", "aua", "umum"].includes(ctx.jenis)) return null;
  return h.isi(m, [h.nilai("tujuan")]);
});

// ============================================================================
// Lapis kedua: POKOK PERTANYAAN + kata di kiri titik-titik (untuk bunyi jawaban yang beragam, mis. katalog jenis perkara)
// ============================================================================

/** "N tahun" bila di kanan belum ada kata tahun; angka saja bila sudah. */
const satuanTahun = (n, kanan) => (/^\s*tahun/i.test(kanan) ? n : `${n} tahun`);
const SEB = RE_SEBUTAN;
const kiri = (s) => new RegExp(`${s}\\s*$`, "i");

/**
 * Tiap pokok: tanya (atas pertanyaan, huruf kecil tanpa tanda baca), jenis (opsional), slot [{kiri: pola atas teks di kiri
 * titik-titik, isi: ({h, ctx, kanan}) => string|null}]. Titik-titik diproses berurutan dari kiri ke kanan; yang tidak
 * cocok dengan aturan mana pun dibiarkan.
 */
const POKOK = [
  {
    id: "waktu-tempat",
    jenis: ["itsbat", "aua"],
    tanya: /kapan dan di mana.*menikah|waktu dan tempat.*(?:menikah|nikah)/,
    slot: [
      { kiri: kiri("\\b(?:di|bertempat di|dilangsungkan di|melangsungkan pernikahan di)"), isi: ({ h }) => h.tempat() },
      { kiri: kiri("\\b(?:tanggal|pada|pada tanggal|sejak)"), isi: ({ h }) => h.nilai("tglNikah") },
    ],
  },
  {
    id: "umur",
    jenis: ["itsbat", "aua"],
    tanya: /(?:umur|usia).*(?:menikah|nikah)|(?:menikah|nikah).*(?:umur|usia)/,
    slot: [
      { kiri: new RegExp(`dan\\s+${SEB}\\s+sekitar\\s*$|dan\\s+${SEB}\\s*$`, "i"), isi: ({ h, kanan }) => h.nilai("umurP2", (n) => satuanTahun(n, kanan)) },
      { kiri: new RegExp(`umur\\s+${SEB}\\s+sekitar\\s*$|umur\\s+${SEB}\\s*$`, "i"), isi: ({ h, kanan }) => h.nilai("umurP1", (n) => satuanTahun(n, kanan)) },
    ],
  },
  {
    id: "status",
    jenis: ["itsbat", "aua"],
    tanya: /status.*(?:menikah|nikah)|berstatus apa/,
    slot: [
      { kiri: new RegExp(`dan\\s+${SEB}\\s+berstatus\\s*$`, "i"), isi: ({ h }) => h.nilai("statusP2", (v) => v.toLowerCase()) },
      { kiri: new RegExp(`${SEB}\\s+(?:masih\\s+)?berstatus\\s*$`, "i"), isi: ({ h }) => h.nilai("statusP1", (v) => v.toLowerCase()) },
    ],
  },
  {
    id: "wali",
    jenis: ["itsbat", "aua"],
    tanya: /wali nikah/,
    slot: [
      { kiri: kiri("\\bbernama"), isi: ({ h }) => h.nilai("waliNama") },
      { kiri: kiri("\\b(?:adalah|yaitu|ialah|sebagai)"), isi: ({ h }) => h.hubunganWali(true) },
    ],
  },
  {
    id: "ijab",
    jenis: ["itsbat", "aua"],
    tanya: /ijab|menikahkan/,
    slot: [{ kiri: kiri("\\b(?:adalah|dari|oleh|yaitu|ialah)"), isi: ({ h }) => h.nilai("penikah") }],
  },
  {
    id: "saksi-nikah",
    jenis: ["itsbat", "aua"],
    tanya: /saksi nikah|disaksikan/,
    slot: [
      { kiri: kiri("\\bdan"), isi: ({ h }) => h.nilai("saksiNikah2") },
      { kiri: kiri("\\b(?:yaitu|adalah|ialah|oleh|bernama|dua orang saksi)"), isi: ({ h }) => h.nilai("saksiNikah1") },
    ],
  },
  {
    id: "mahar",
    jenis: ["itsbat", "aua"],
    tanya: /mas kawin|mahar|maskawin/,
    slot: [
      {
        kiri: kiri("\\b(?:berupa|yaitu|sebesar|adalah|ialah)"),
        isi: ({ h, kanan }) => {
          const f = h.fakta.ambil("mahar");
          if (!f) return null;
          const u = F.uraiMahar(f.nilai);
          if (!u.barang) return null;
          h.nilai("mahar");
          const bayar = u.bayar === "tunai" ? ", dibayar tunai" : u.bayar === "hutang" ? ", belum dibayar (terhutang)" : "";
          return /^\s*(?:,|dibayar)/i.test(kanan) ? u.barang : `${u.barang}${bayar}`;
        },
      },
    ],
  },
  {
    id: "anak",
    jenis: ["itsbat", "aua"],
    tanya: /(?:mempunyai|dikaruniai|punya) anak/,
    slot: [
      {
        kiri: new RegExp(`${SEB}\\s*$`, "i"),
        isi: ({ h }) => {
          const n = h.fakta.ambil("jumlahAnak");
          if (!n) return null;
          h.nilai("jumlahAnak");
          return n.nilai === "0" ? "belum dikaruniai anak" : `dikaruniai ${n.nilai} orang anak`;
        },
      },
    ],
  },
  {
    id: "tidak-dicatat",
    jenis: ["itsbat"],
    tanya: /tidak dicatat|tidak tercatat|mengapa pernikahan/,
    slot: [{ kiri: kiri("\\b(?:ialah|adalah|karena|yaitu)"), isi: ({ h }) => h.nilai("sebabTidakTercatat") }],
  },
  {
    id: "tujuan-itsbat",
    jenis: ["itsbat"],
    tanya: /untuk keperluan apa|keperluan apa/,
    slot: [{ kiri: kiri("\\buntuk"), isi: ({ h }) => h.nilai("tujuan") }],
  },
  // ---- dispensasi kawin ----
  {
    id: "dk-anak",
    jenis: ["dk"],
    tanya: /nama.*umur.*anak|siapa nama dan berapa umur anak/,
    slot: [
      { kiri: kiri("\\bbernama"), isi: ({ h }) => h.nilai("anakNama") },
      { kiri: kiri("\\b(?:berumur|umur|usia|berusia)"), isi: ({ h, kanan }) => h.nilai("anakUmur", (n) => satuanTahun(n, kanan)) },
    ],
  },
  {
    id: "dk-calon",
    jenis: ["dk"],
    tanya: /calon (?:suami|isteri|istri|mempelai)/,
    slot: [
      { kiri: kiri("\\bbernama"), isi: ({ h }) => h.nilai("calonNama") },
      { kiri: kiri("\\b(?:berumur|umur|usia|berusia)"), isi: ({ h, kanan }) => h.nilai("calonUmur", (n) => satuanTahun(n, kanan)) },
      { kiri: kiri("\\b(?:bekerja sebagai|pekerjaan)"), isi: ({ h }) => h.nilai("calonPekerjaan") },
    ],
  },
  {
    id: "dk-kua",
    jenis: ["dk"],
    tanya: /ditolak|penolakan|mengapa.*dispensasi/,
    slot: [{ kiri: kiri("\\b(?:KUA|Kantor Urusan Agama)(?: Kecamatan)?"), isi: ({ h }) => h.nilai("kuaPenolak") }],
  },
  // ---- wali adhal ----
  {
    id: "wa-calon",
    jenis: ["wa"],
    tanya: /calon suami/,
    slot: [
      { kiri: kiri("\\bbernama"), isi: ({ h }) => h.nilai("calonNama") },
      { kiri: kiri("\\b(?:umur|berumur|usia)"), isi: ({ h, kanan }) => h.nilai("calonUmur", (n) => satuanTahun(n, kanan)) },
      { kiri: kiri("\\b(?:bekerja sebagai|pekerjaan)"), isi: ({ h }) => h.nilai("calonPekerjaan") },
    ],
  },
  {
    id: "wa-wali",
    jenis: ["wa"],
    tanya: /wali nasab|wali yang menolak|siapa wali/,
    slot: [
      { kiri: kiri("\\bbernama"), isi: ({ h }) => h.nilai("waliNama") },
      { kiri: kiri("\\b(?:adalah|yaitu|ialah)"), isi: ({ h }) => h.hubunganWali(false) },
    ],
  },
  {
    id: "wa-alasan",
    jenis: ["wa"],
    tanya: /alasan.*wali|mengapa.*wali/,
    slot: [{ kiri: kiri("\\b(?:karena|ialah|adalah)"), isi: ({ h }) => h.nilai("alasanWali", kecilNilai) }],
  },
  // ---- ahli waris / kewarisan ----
  {
    id: "paw-meninggal",
    jenis: ["paw", "waris"],
    tanya: /meninggal dunia/,
    slot: [
      { kiri: kiri("\\b(?:adalah|bernama)"), isi: ({ h }) => h.nilai("pewarisNama") },
      { kiri: kiri("\\b(?:pada|tanggal)"), isi: ({ h }) => h.nilai("wafatTgl") },
      { kiri: kiri("\\bdi"), isi: ({ h }) => h.nilai("wafatTempat") },
      { kiri: kiri("\\b(?:karena|akibat)"), isi: ({ h }) => h.nilai("wafatSebab") },
    ],
  },
  {
    id: "paw-anak",
    jenis: ["paw", "waris"],
    tanya: /anak kandung|berapa orang anak/,
    slot: [
      { kiri: kiri("\\b(?:mempunyai|memiliki)"), isi: ({ h }) => h.nilai("jumlahAnakPewaris") },
      { kiri: kiri("\\byaitu"), isi: ({ h }) => h.nilai("anakPewaris") },
    ],
  },
  // ---- perwalian ----
  {
    id: "perwalian-anak",
    jenis: ["perwalian"],
    tanya: /nama.*anak|anak.*dimohonkan/,
    slot: [{ kiri: kiri("\\bbernama"), isi: ({ h }) => h.nilai("anakNama") }],
  },
];

/** Mengisi titik-titik yang tersisa menurut pokok pertanyaan dan kata di kirinya. */
function isiPokok(teks, q, h, ctx) {
  for (const p of POKOK) {
    if (p.jenis && !p.jenis.includes(ctx.jenis)) continue;
    if (!p.tanya.test(q)) continue;
    const re = /\.{3,}|…/g;
    const awal = teks;
    let keluar = "";
    let pos = 0;
    let m;
    while ((m = re.exec(awal)) !== null) {
      const sebelum = keluar + awal.slice(pos, m.index);
      const kanan = awal.slice(m.index + m[0].length, m.index + m[0].length + 24);
      let nilai = null;
      for (const s of p.slot) {
        if (!s.kiri.test(sebelum.slice(-70))) continue;
        try {
          nilai = s.isi({ h, ctx, kanan });
        } catch (_e) {
          nilai = null;
        }
        if (nilai != null && nilai !== "") break;
        nilai = null;
      }
      keluar = sebelum + (nilai == null ? m[0] : nilai);
      pos = m.index + m[0].length;
    }
    const hasil = keluar + awal.slice(pos);
    if (hasil !== awal) return hasil; // satu pokok per jawaban
  }
  return teks;
}

// ============================================================================
// Placeholder katalog "{sejak}" "{lama}" "{pelaku}" ... (agen S1 menyambungkan katalog ke panel)
// ============================================================================

function isiPlaceholder(teks, tanya, h, ctx) {
  const q = norm(tanya);
  const peta = {
    pelaku: () => ctx.T,
    korban: () => ctx.P,
    pihakSaksi: () => ctx.P,
    lawanSaksi: () => ctx.T,
    waktu: () => (/puncak/.test(q) ? h.nilai("puncak") : null),
    peristiwa: () => (/puncak/.test(q) ? h.nilai("puncakPeristiwa") : null),
    sejak: () => (/pisah|meninggalkan|pergi/.test(q) ? h.nilai("pisahSejak") : /rukun|selisih|tengkar|konflik/.test(q) ? h.nilai("awalKonflik") : null),
    lama: () => (/pisah|meninggalkan|pergi/.test(q) ? h.nilai("lamaPisah") : null),
  };
  return String(teks).replace(/\{([a-zA-Z0-9_]+)\}/g, (m, nama) => {
    const f = peta[nama];
    const v = f ? f() : null;
    return v == null || v === "" ? m : v;
  });
}

// ============================================================================
// Variasi saksi ke-2 dan bentuk pengetahuan saksi
// ============================================================================

/** Ragam kata yang tidak menggeser isi, dipakai bergantian: saksi ganjil memakai bunyi asli, saksi genap bunyi ragam. */
const RAGAM = [
  [/^Yang menikahkan adalah /, "Yang menikahkan mereka adalah "],
  [/^Yang menjadi wali nikah adalah /, "Wali nikahnya adalah "],
  [/^Saksi nikahnya dua orang, yaitu /, "Dua orang saksi nikahnya adalah "],
  [/^Maharnya berupa /, "Mahar yang diberikan berupa "],
  [/^Saat menikah /, "Pada saat menikah "],
  [/\bmenikah pada (?=\d{1,2} [A-Z])/, "menikah pada tanggal "],
  [/^Pemohon I dan Pemohon II dikaruniai /, "Dari pernikahan itu Pemohon I dan Pemohon II dikaruniai "],
  [/^Awalnya rumah tangga /, "Pada mulanya rumah tangga "],
];
function ragamkan(teks, ke) {
  if (ke % 2 === 1) return teks;
  for (const [re, ganti] of RAGAM) if (re.test(teks)) return teks.replace(re, ganti);
  return teks;
}

/** Pengetahuan saksi yang tidak diberi rincian dari data. */
const MODUS_TANPA_RINCIAN = new Set(["tidak-tahu", "tidak-melihat", "tahu-pisah", "tidak-hadir", "tidak-menyaksikan", "tidak-mengetahui", "ragu", "lupa"]);

// ============================================================================
// Mengisi satu jawaban
// ============================================================================

const LABEL_SUMBER = { "isian blangko": 1, "data SIPP": 2, gugatan: 3 };

function susunKet(pakai, ragu) {
  const sumber = [...new Set(pakai.flatMap((f) => String(f.sumber || "").split(" + ").filter(Boolean)))].sort((a, b) => (LABEL_SUMBER[a] || 9) - (LABEL_SUMBER[b] || 9));
  const label = [...new Set(pakai.map((f) => F.LABEL_FAKTA[f.kunci]).filter(Boolean))];
  const kets = [...new Set(pakai.map((f) => f.ket).filter(Boolean))];
  const dasar = `Diisi dari ${sumber.join(" dan ") || "data perkara"}${label.length ? ` (${label.slice(0, 4).join(", ")})` : ""}.`;
  return { sumber: sumber.join(" + "), ket: ragu ? `${kets.join(" ")} ${dasar}`.trim() : kets.length ? `${dasar} ${kets.join(" ")}` : dasar };
}

/**
 * @param {{tanya: string, jawab: string}} baris  baris templat (jawab = bunyi dasar dengan titik-titik)
 * @param {object} fakta  hasil bangunFakta
 * @param {{jenis: string, P: string, T: string, ke: number, modus?: string, sumberNama?: string}} ctx
 * @returns {{teks: string, terisi: number, total: number, yakin: string, sumber: string, ket: string}|null} null = tidak ada yang terisi
 */
function isiJawaban(baris, fakta, ctx) {
  const asal = String((baris && baris.jawab) || "");
  if (!masihKosong(asal)) return null;
  if (MODUS_TANPA_RINCIAN.has(String(ctx.modus || ""))) return null;
  const tanya = String((baris && baris.tanya) || "");
  const q = norm(tanya);
  const pakai = [];
  const h = penolong(fakta, ctx, pakai);
  const total = hitungTitik(asal);
  let teks = isiPlaceholder(asal, tanya, h, ctx);
  for (const c of CUES) {
    if (c.jenis && c.jenis.length && !c.jenis.includes(ctx.jenis)) continue;
    if (c.tanya && !c.tanya.test(q)) continue;
    const re = new RegExp(c.re.source, c.re.flags.includes("g") ? c.re.flags : `${c.re.flags}g`);
    teks = teks.replace(re, (...a) => {
      const m = a[0];
      const g = a.slice(1, a.length - 2);
      let r = null;
      try {
        r = c.bangun({ m, g, h, ctx });
      } catch (_galat) {
        r = null;
      }
      return r == null ? m : r;
    });
  }
  if (adaTitik(teks)) teks = isiPokok(teks, q, h, ctx);
  const terisi = total - hitungTitik(teks);
  if (teks === asal || terisi <= 0) return null;
  teks = teks.replace(/\s{2,}/g, " ").replace(/\s+([,;])/g, "$1");
  if (RE_ALETA_JAWAB.test(teks)) return null;
  teks = ragamkan(teks, Number(ctx.ke) || 1);
  if (String(ctx.modus) === "dari-cerita" && ctx.sumberNama && !/^Menurut\s/i.test(teks)) teks = `Menurut cerita ${ctx.sumberNama}, ${kecilAwal(teks)}`;
  let yakin = "yakin";
  for (const f of pakai) yakin = minYakin(yakin, f.yakin);
  if (ctx.__raguBayar) {
    yakin = "ragu";
    ctx.__raguBayar = false;
    pakai.push({ kunci: "mahar", sumber: "", ket: "Cara pembayaran mahar tidak disebut di sumber; bunyi 'dibayar tunai' berasal dari contoh jawaban. Periksa." });
  }
  const sisaTitik = hitungTitik(teks);
  // sebagian terisi: yang terisi itu tetap ditandai; yakin dibatasi "cukup" agar petugas melengkapi sisanya
  if (sisaTitik > 0) yakin = minYakin(yakin, "cukup");
  const ragu = yakin === "ragu";
  const { sumber, ket } = susunKet(pakai, ragu);
  return { teks, terisi, total, yakin, sumber, ket: sisaTitik > 0 ? `${ket} Sisanya belum ada datanya; lengkapi dari keterangan saksi.` : ket };
}
const RE_ALETA_JAWAB = /aleta/i;

// ============================================================================
// Memasang ke hasil rute 'saksi-sdg' (susunKeteranganSaksiSdg)
// ============================================================================

const polosJawab = (x) => (x ? x.jawaban.map(({ no, tanya, jawab }) => ({ no, tanya, jawab })) : []);
const hapusBelumTerisi = (daftar, no) => (Array.isArray(daftar) ? daftar.filter((x) => String((x && x.no) || "") !== String(no)) : daftar);

/**
 * Melengkapi `hasil` (keluaran susunKeteranganSaksiSdg) di tempat. Hanya jawaban yang masih bertitik-titik atau yang
 * titik-titiknya sudah dibuang penyusun lama padahal datanya ada yang diganti; pilihan berlawanan tidak disentuh.
 *
 * @param {object} hasil  keluaran susunKeteranganSaksiSdg (ok:true)
 * @param {object} opsi
 *   templatAsli [{no,tanya,jawab}]  templat yang dikirim ke penyusun (acuan titik-titik)
 *   fakta       hasil bangunFakta
 *   jenis       kode jenis (itsbat|aua|cg|ct|dk|wa|paw|waris|perwalian|hb|umum)
 *   P, T        sebutan pihak pertama/kedua (Penggugat/Pemohon, Tergugat/Termohon)
 *   saksi       [{pihak, ke, modus, sumberNama}] sejajar dengan hasil.saksi
 * @returns {{terisi: number, ragu: number, jawaban: number}}
 */
function lengkapiSusunan(hasil, opsi) {
  const o = opsi && typeof opsi === "object" ? opsi : {};
  const ringkas = { terisi: 0, ragu: 0, jawaban: 0 };
  if (!hasil || hasil.ok === false || !Array.isArray(hasil.saksi) || !o.fakta) return ringkas;
  const templat = Array.isArray(o.templatAsli) ? o.templatAsli : [];
  hasil.saksi.forEach((s, idx) => {
    const pil = (o.saksi && o.saksi[idx]) || {};
    s.jawaban.forEach((j, i) => {
      const acuan = templat[i];
      if (!acuan || !masihKosong(acuan.jawab)) return;
      const adaPilihan = Array.isArray(j.pilihan) && j.pilihan.length >= 2;
      const ctx = { jenis: o.jenis || "umum", P: o.P || "Penggugat", T: o.T || "Tergugat", ke: Number(pil.ke) || s.ke || idx + 1, modus: pil.modus || s.modus, sumberNama: pil.sumberNama || "" };
      const isi = isiJawaban({ tanya: j.tanya || acuan.tanya, jawab: acuan.jawab }, o.fakta, ctx);
      const sekarang = String(j.jawab || "");
      const kosongPenyusun = /^\s*\[BELUM TERISI/i.test(sekarang);
      if (!isi) return;
      const titikSekarang = hitungTitik(sekarang);
      const titikBaru = hitungTitik(isi.teks);
      // Ganti bila: penyusun gagal (kosong/bertitik) dan hasil ini lebih lengkap, atau penyusun membuang titik-titik
      // padahal datanya ada dan tidak satu pun nilainya muncul di jawaban penyusun.
      let ganti = false;
      if (kosongPenyusun || (titikSekarang > 0 && titikBaru < titikSekarang)) ganti = true;
      else if (titikSekarang === 0 && titikBaru === 0 && isi.terisi === isi.total) {
        const ns = norm(sekarang);
        const nilaiTampil = norm(isi.teks).split(" ").filter((k) => k.length > 3);
        const dipakai = nilaiTampil.filter((k) => ns.includes(k));
        ganti = nilaiTampil.length > 0 && dipakai.length / nilaiTampil.length < 0.6 && !/\b(?:tidak\s+(?:tahu|mengetahui)|lupa|ragu)\b/i.test(sekarang);
      }
      // Jawaban berpilihan (dua kemungkinan) hanya diputuskan bila seluruh titik-titiknya terisi dari data.
      if (adaPilihan) ganti = titikBaru === 0;
      if (!ganti) return;
      if (adaPilihan) delete j.pilihan;
      j.jawab = isi.teks;
      j.usulan = { teks: isi.teks, yakin: isi.yakin, sumber: isi.sumber, ket: isi.ket };
      j.perluDiisi = titikBaru > 0;
      if (kosongPenyusun) delete j.belumTerisi;
      ringkas.terisi += 1;
      if (isi.yakin === "ragu") ringkas.ragu += 1;
      if (idx === 0) {
        if (titikBaru === 0 && Array.isArray(hasil.perluDiisi)) hasil.perluDiisi = hapusBelumTerisi(hasil.perluDiisi, j.no);
        if (Array.isArray(hasil.belumTerisi)) hasil.belumTerisi = hapusBelumTerisi(hasil.belumTerisi, j.no);
      }
    });
  });
  // jawaban yang disusun penyusun lama dari posita (tanpa titik-titik lagi) ikut diberi keterangan sumber
  hasil.saksi.forEach((s, idx) => {
    s.jawaban.forEach((j, i) => {
      const acuan = templat[i];
      if (j.usulan || !acuan || !adaTitik(acuan.jawab) || masihKosong(j.jawab) || (Array.isArray(j.pilihan) && j.pilihan.length)) return;
      if (norm(j.jawab) === norm(acuan.jawab)) return;
      j.usulan = { teks: String(j.jawab), yakin: "cukup", sumber: "gugatan", ket: "Disusun dari gugatan perkara ini; periksa dengan keterangan saksi." };
      ringkas.jawaban += 1;
    });
  });
  hasil.saksi1 = polosJawab(hasil.saksi[0]);
  hasil.saksi2 = polosJawab(hasil.saksi[1]);
  ringkas.jawaban += ringkas.terisi;
  if (ringkas.terisi) hasil.terisiDariSumber = { jawaban: ringkas.terisi, ragu: ringkas.ragu };
  return ringkas;
}

module.exports = {
  isiJawaban,
  lengkapiSusunan,
  isiPlaceholder,
  pihakKe,
  masihKosong,
  adaPlaceholder,
  ragamkan,
  CUES,
  POKOK,
  isiPokok,
  MODUS_TANPA_RINCIAN,
  ...F,
};
