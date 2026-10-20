"use strict";

/**
 * ============================================================================
 * PENGISI JAWABAN SAKSI - VARIABEL ABT DAN SLOT KATALOG DARI DATA (20 Okt 2026, S7)
 * ============================================================================
 *
 * Jawaban susunan katalog jenis perkara memuat variabel ABT (#5110# nama anak, #1025# nama almarhum, #0606# nama
 * mempelai wanita, ...) dan slot ({hubungan}, {sejak}, {lama}) yang BELUM terisi saat disusun di ekstensi. Ekstensi
 * mengirim jawaban dengan penanda ⟦#kode#⟧ / ⟦{slot}⟧ di tempat yang kosong (jawabKode); berkas ini mengisinya satu per
 * satu dari fakta (isian blangko > data SIPP > posita), seperti yang dihitung ABT dari SIPP/isian untuk variabel itu.
 *
 * Aturan: nilai yang tidak ada di sumber mana pun tidak dikarang; penanda yang tidak terisi menjadi "..." lagi.
 * Murni (tanpa jaringan/basis data). Tiap pengisi menerima penolong `h` (isiJawabanSaksi.js: nilai, tempat, hubunganWali,
 * alamat) sehingga fakta yang dipakai tercatat untuk keyakinan dan keterangan sumber.
 */

const F = require("./isiJawabanSaksiFakta");

const TANDA_BUKA = "⟦";
const TANDA_TUTUP = "⟧";
const RE_TANDA = new RegExp(`${TANDA_BUKA}([^${TANDA_TUTUP}]+)${TANDA_TUTUP}`, "g");

const tahunDari = (n) => (/^\d+$/.test(String(n)) ? `${n} tahun` : String(n));
const kecil = (v) => (v == null ? v : String(v).charAt(0).toLowerCase() + String(v).slice(1));

/** "binti" -> Almarhumah; "bin" -> Almarhum; selain itu tidak dapat ditentukan. */
function almarhum(nama) {
  const n = String(nama || "");
  if (/\bbinti\b/i.test(n)) return "Almarhumah";
  if (/\bbin\b/i.test(n)) return "Almarhum";
  return null;
}

/**
 * Pengisi per kode variabel ABT: ({h, ctx, kiri, kanan}) -> string | null.
 * `kiri`/`kanan` = sepotong teks di kiri/kanan penanda (untuk menentukan bentuk kalimat).
 */
const KODE = {
  // ---- pernikahan (itsbat nikah, asal usul anak, kumulasi) ----
  5197: ({ h }) => h.nilai("tglNikah"),
  5105: ({ h }) => h.tempat(),
  7211: ({ h }) => h.nilai("umurP1", tahunDari),
  7212: ({ h }) => h.nilai("umurP2", tahunDari),
  1002: ({ h }) => h.nilai("statusP1", (v) => v.toLowerCase()),
  1003: ({ h }) => h.nilai("statusP2", (v) => v.toLowerCase()),
  1046: ({ h }) => h.hubunganWali(false),
  1217: ({ h }) => h.nilai("waliNama"),
  8087: ({ h }) => h.nilai("penikah"),
  "0650": ({ h }) => h.nilai("saksiNikah1"),
  "0651": ({ h }) => h.nilai("saksiNikah2"),
  1001: ({ h, kanan }) => {
    const f = h.fakta.ambil("mahar");
    if (!f) return null;
    const u = F.uraiMahar(f.nilai);
    if (!u.barang) return null;
    h.nilai("mahar");
    if (/^\s*(?:,|\s+yang\b|\s+dan\b|\s+dibayar)/i.test(kanan)) return u.barang;
    return u.bayar === "tunai" ? `${u.barang}, dibayar tunai` : u.bayar === "hutang" ? `${u.barang}, belum dibayar (terhutang)` : u.barang;
  },
  "0007": ({ h }) => {
    const n = h.fakta.ambil("jumlahAnak");
    if (!n) return null;
    h.nilai("jumlahAnak");
    return n.nilai === "0" ? "belum dikaruniai anak" : `telah dikaruniai ${n.nilai} orang anak`;
  },
  1358: ({ h }) => h.nilai("sebabTidakTercatat"),
  8171: ({ h }) => h.nilai("tujuan"),
  // ---- kematian (ahli waris, kewarisan, perwalian, wasiat) ----
  1025: ({ h }) => h.nilai("pewarisNama"),
  2026: ({ h }) => {
    const f = h.fakta.ambil("pewarisNama");
    const a = f ? almarhum(f.nilai) : null;
    if (a) h.nilai("pewarisNama");
    return a;
  },
  1246: ({ h }) => h.nilai("wafatTgl"),
  1230: ({ h }) => h.nilai("wafatTgl"),
  1509: ({ h }) => h.nilai("wafatTempat"),
  1247: ({ h }) => h.nilai("wafatSebab", kecil),
  8717: ({ h }) => h.nilai("ahliWaris"),
  8718: ({ h }) => h.nilai("ahliWaris"),
  8730: ({ h }) => h.nilai("hartaPeninggalan"),
  // ---- anak (perwalian, asal usul anak, hak asuh, pengangkatan anak) ----
  5110: ({ h }) => h.nilai("anakNama"),
  8603: ({ h }) => h.nilai("anakNama"),
  8602: ({ h }) => h.nilai("anakNama"),
  "0099": ({ h }) => h.nilai("anakUmur", tahunDari),
  "0709": ({ h }) => h.nilai("hubunganPemohonAnak", kecil),
  "0712": ({ h }) => h.nilai("orangTuaMeninggal", kecil),
  8618: ({ h }) => h.nilai("anakLahirTempat"),
  // ---- dispensasi kawin ----
  "0606": ({ h }) => mempelai(h, "P", "nama"),
  "0600": ({ h }) => mempelai(h, "L", "nama"),
  "0607": ({ h }) => mempelai(h, "P", "umur"),
  "0601": ({ h }) => mempelai(h, "L", "umur"),
  3333: ({ h }) => h.nilai("kuaPenolak"),
  1666: ({ h }) => h.nilai("lamaKenal"),
  1014: ({ h }) => {
    const e = h.fakta.ambil("eratHubungan");
    if (!e) return null;
    h.nilai("eratHubungan");
    return /^sudah\b/i.test(e.nilai) ? e.nilai : `sudah ${e.nilai}`;
  },
  "0999": ({ h }) => h.nilai("hamil"),
  // ---- wali adhal ----
  1029: ({ h }) => h.nilai("calonNama"),
  1030: ({ h }) => h.nilai("calonUmur", tahunDari),
  9200: ({ h }) => h.nilai("waliNama"),
  9202: ({ h }) => h.hubunganWali(false),
  6087: ({ h }) => h.nilai("alasanWali", kecil),
  "0652": ({ h }) => h.nilai("suratKuaNomor"),
  "0653": ({ h }) => h.nilai("suratKuaTanggal"),
  9205: ({ h }) => h.nilai("kuaPenolak"),
  // ---- pekerjaan ----
  6331: ({ h }) => h.nilai("calonPekerjaan"),
  1031: ({ h }) => h.nilai("pekerjaanSuami"),
  "0104": ({ h }) => h.nilai("pekerjaanT"),
  "0100": ({ h }) => h.nilai("pekerjaanP"),
  // ---- harta bersama ----
  9280: ({ h }) => h.nilai("putusanCerai"),
  // ---- hibah, wakaf, ekonomi syariah, izin poligami, mafqud ----
  9793: ({ h }) => h.nilai("penghibah"),
  9795: ({ h }) => h.nilai("objekHibah"),
  9823: ({ h }) => h.nilai("wakif"),
  9824: ({ h }) => h.nilai("nazhir"),
  9826: ({ h }) => h.nilai("hartaWakaf"),
  9827: ({ h }) => h.nilai("peruntukanWakaf"),
  9340: ({ h }) => h.nilai("akad"),
  9344: ({ h }) => h.nilai("jumlahUtang"),
  8723: ({ h }) => h.nilai("calonIstri"),
  8722: ({ h }) => h.nilai("hartaBersamaPoligami"),
  9860: ({ h }) => h.nilai("orangHilang"),
  9861: ({ h }) => h.nilai("hubunganOrangHilang", kecil),
  9864: ({ h }) => h.nilai("lamaHilang"),
};

/** Nama/umur mempelai menurut jenis kelamin: anak yang dimohonkan dispensasi dan calonnya (posita menyebut "calon mempelai wanita/laki-laki"). */
function mempelai(h, jk, medan) {
  const anakJk = h.fakta.ambil("anakJk");
  if (!anakJk) return null;
  const anakIni = anakJk.nilai === jk;
  const kunci = medan === "nama" ? (anakIni ? "anakNama" : "calonNama") : anakIni ? "anakUmur" : "calonUmur";
  h.nilai("anakJk");
  return h.nilai(kunci, medan === "umur" ? tahunDari : undefined);
}

/**
 * Slot katalog yang tersisa sesudah susunan ekstensi: {hubungan} (hubungan saksi), {sejak}, {lama}.
 * Hubungan saksi dihitung layanan dari kolom Keterangan saksi di SIPP (ctx.hubungan) dan dibaca lewat h.hubunganSaksi().
 */
const SLOT = {
  hubungan: ({ h }) => h.hubunganSaksi(),
  sejak: ({ h, tanya }) => (/pisah|meninggalkan|pergi/.test(tanya) ? h.nilai("pisahSejak") : /rukun|selisih|tengkar|konflik/.test(tanya) ? h.nilai("awalKonflik") : null),
  lama: ({ h, tanya }) => (/pisah|meninggalkan|pergi/.test(tanya) ? h.nilai("lamaPisah") : null),
};

/**
 * Mengisi semua penanda ⟦...⟧ dalam `kode`.
 * @returns {{teks: string, total: number, sisa: number}}  teks (penanda yang tidak terisi menjadi "..."), jumlah penanda, sisa
 */
function substitusi(kode, h, ctx, tanyaNorm) {
  const src = String(kode || "");
  let total = 0;
  let sisa = 0;
  const teks = src.replace(RE_TANDA, (semua, isi, idx) => {
    total += 1;
    const kiri = src.slice(Math.max(0, idx - 60), idx).replace(RE_TANDA, "…");
    const kanan = src.slice(idx + semua.length, idx + semua.length + 40);
    let nilai = null;
    try {
      const mKode = /^#(\d{4})#$/.exec(isi);
      const mSlot = /^\{([a-zA-Z0-9_]+)\}$/.exec(isi);
      if (mKode && KODE[mKode[1]]) nilai = KODE[mKode[1]]({ h, ctx, kiri, kanan });
      else if (mSlot && SLOT[mSlot[1]]) {
        nilai = SLOT[mSlot[1]]({ h, ctx, tanya: tanyaNorm });
      }
    } catch (_galat) {
      nilai = null;
    }
    if (nilai == null || String(nilai).trim() === "") {
      sisa += 1;
      return "...";
    }
    return String(nilai);
  });
  return { teks, total, sisa };
}

const adaTanda = (t) => new RegExp(TANDA_BUKA).test(String(t || ""));

module.exports = { substitusi, KODE, SLOT, adaTanda, almarhum, TANDA_BUKA, TANDA_TUTUP };
