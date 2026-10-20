"use strict";

/**
 * ============================================================================
 * PENGISI JAWABAN SAKSI BERSUMBER - PENYAMBUNG KE RUTE 'saksi-sdg' (20 Okt 2026)
 * ============================================================================
 *
 * Mengumpulkan tiga sumber fakta lalu memanggil mesin pengisi (isiJawabanSaksi.js):
 *   1. isian blangko perkara itu  - dikirim panel (req.body.isian: {kode: {nilai, keyakinan}});
 *   2. data SIPP                   - dibaca di sini, HANYA SELECT, dibatasi 2,5 detik;
 *   3. posita                      - mesin deteksi yang sudah ada (itsbat, jenis lain, fakta cerai) + pola tambahan.
 *
 * Tidak menulis ke SIPP/ABT. Galat di mana pun tidak pernah menggagalkan susunan: jawaban tetap seperti dari
 * penyusun lama.
 */

const isi = require("./isiJawabanSaksi");
const { positaTambahan } = require("./isiJawabanSaksiPosita");

/** Kode jenis jawaban saksi dari id jenis perkara SIPP atau namanya. */
const JENIS_ID = Object.freeze({ 346: "ct", 347: "cg", 360: "itsbat", 362: "dk", 363: "wa", 354: "perwalian", 358: "aua", 371: "paw", 364: "waris", 348: "hb", 341: "ip" });
function kodeJenis(jenisPerkara, alur) {
  const j = String(jenisPerkara || "").trim();
  if (JENIS_ID[j]) return JENIS_ID[j];
  const n = j.toLowerCase();
  if (/cerai\s*talak/.test(n)) return "ct";
  if (/cerai\s*gugat/.test(n)) return "cg";
  if (/itsbat|istbat|isbat|pengesahan/.test(n)) return "itsbat";
  if (/dispensasi/.test(n)) return "dk";
  if (/wali\s*adh/.test(n)) return "wa";
  if (/perwalian/.test(n)) return "perwalian";
  if (/asal\s*usul/.test(n)) return "aua";
  if (/ahli\s*waris|p3hp/.test(n)) return "paw";
  if (/kewarisan|waris/.test(n)) return "waris";
  if (/harta\s*bersama/.test(n)) return "hb";
  if (/poligami/.test(n)) return "ip";
  return "umum";
}

/** Isian dari peramban disaring: hanya objek kode -> nilai pendek; yang memuat nama aplikasi dibuang. */
function saringIsian(isian) {
  const hasil = {};
  if (!isian || typeof isian !== "object") return hasil;
  let n = 0;
  for (const [kode, v] of Object.entries(isian)) {
    if (n >= 250 || !/^\d{3,5}$/.test(String(kode))) continue;
    const nilai = String(v && typeof v === "object" ? v.nilai : v == null ? "" : v).slice(0, 700);
    if (!nilai.trim() || /aleta/i.test(nilai)) continue;
    const yakin = v && typeof v === "object" ? String(v.keyakinan || v.yakin || "").slice(0, 12) : "";
    hasil[String(kode)] = { nilai, ...(yakin ? { keyakinan: yakin } : {}) };
    n += 1;
  }
  return hasil;
}

/**
 * Data SIPP perkara untuk jawaban saksi (SELECT saja). Bentuk sama dengan masukan `sipp` bangunFakta.
 * `jalankan(sql, params)` dipasok pemanggil supaya berkas ini mudah diuji.
 */
async function bacaSippSaksi(nomorPerkara, jalankanLuar, batasMs = 2500) {
  const jalankan =
    typeof jalankanLuar === "function"
      ? jalankanLuar
      : (sql, params) =>
          new Promise((resolve, reject) => {
            require("../db_config").query(sql, params || [], (e, r) => (e ? reject(e) : resolve(r)));
          });
  const nomor = String(nomorPerkara || "").trim();
  if (!nomor) return null;
  const aman = (sql, params) => Promise.resolve(jalankan(sql, params)).catch(() => []);
  const kerja = async () => {
    const id = await aman("SELECT perkara_id FROM perkara WHERE nomor_perkara = ? LIMIT 1", [nomor]);
    const pid = Array.isArray(id) && id[0] ? id[0].perkara_id : null;
    if (!pid) return null;
    const [nikah, itsbat, anak, pihak1, pihak2] = await Promise.all([
      aman("SELECT DATE_FORMAT(tgl_nikah, '%Y-%m-%d') AS tgl_nikah, kua_tempat_nikah AS kua FROM perkara_data_pernikahan WHERE perkara_id = ? LIMIT 1", [pid]),
      aman("SELECT DATE_FORMAT(tgl_menikah, '%Y-%m-%d') AS tgl, tempat_menikah AS tempat FROM perkara_data_itsbat WHERE perkara_id = ? LIMIT 1", [pid]),
      aman("SELECT nama_anak, DATE_FORMAT(tanggal_lahir, '%Y-%m-%d') AS lahir, jenis_kelamin AS jk, diasuh_oleh, ada_anak FROM perkara_anak_pihak WHERE perkara_id = ? ORDER BY anak_ke, id LIMIT 12", [pid]),
      aman("SELECT pp.urutan, pp.nama, pp.alamat, p.pekerjaan, DATE_FORMAT(p.tanggal_lahir, '%Y-%m-%d') AS lahir, p.jenis_kelamin AS jk FROM perkara_pihak1 pp LEFT JOIN pihak p ON p.id = pp.pihak_id WHERE pp.perkara_id = ? ORDER BY pp.urutan LIMIT 4", [pid]),
      aman("SELECT pp.urutan, pp.nama, pp.alamat, p.pekerjaan, DATE_FORMAT(p.tanggal_lahir, '%Y-%m-%d') AS lahir, p.jenis_kelamin AS jk FROM perkara_pihak2 pp LEFT JOIN pihak p ON p.id = pp.pihak_id WHERE pp.perkara_id = ? ORDER BY pp.urutan LIMIT 4", [pid]),
    ]);
    const satu = (x) => (Array.isArray(x) && x[0] ? x[0] : null);
    return { nikah: satu(nikah), itsbat: satu(itsbat), anak: Array.isArray(anak) ? anak : [], pihak1: Array.isArray(pihak1) ? pihak1 : [], pihak2: Array.isArray(pihak2) ? pihak2 : [] };
  };
  const batas = new Promise((selesai) => setTimeout(() => selesai(null), batasMs));
  try {
    return await Promise.race([kerja(), batas]);
  } catch (_galat) {
    return null;
  }
}

/**
 * Fakta posita lewat mesin deteksi bot. Gagal = daftar kosong (sumber lain tetap dipakai).
 * @returns {{usulan: Array, cerai: object|null}}
 */
function deteksiPosita({ posita, jenis, jenisPerkara, alur, pelaku, lawan, tanggalSidang, alamatPihak, usul, lain, djp }) {
  const hasil = { usulan: [], cerai: null };
  if (!String(posita || "").replace(/<[^>]*>/g, " ").trim()) return hasil;
  const A = usul || require("./abtUsulanService");
  try {
    if (jenis === "itsbat" || jenis === "aua") {
      const r = A.dariPositaItsbat(posita, { pemohon: "Pemohon I", pemohon2: "Pemohon II" });
      const L = lain || require("./abtUsulanLainService");
      const s = L.saringUsulanItsbat(r, String(jenisPerkara || "360"));
      const D = djp || require("./deteksiJenisPerkaraService");
      const t = D.tambahUsulanJenis(s, posita, { jenisPerkara: String(jenisPerkara || "360"), alur });
      const ada = (u) => u && u.kode && u.nilai != null && String(u.nilai).trim() !== "";
      hasil.usulan.push(...((t && t.usulan) || []).filter(ada), ...((t && t.bawaanAbt) || []).filter(ada));
    } else if (jenis === "cg" || jenis === "ct") {
      hasil.cerai = A.faktaDariPosita(posita, pelaku, lawan, { tanggalSidang, alamatPihak });
      const butir = A.kalimatPosita ? A.kalimatPosita(posita) : [];
      const tgl = A.tanggalNikahDariPosita ? A.tanggalNikahDariPosita(butir) : { nilai: "" };
      if (tgl.nilai) hasil.usulan.push({ kode: "5197", nilai: tgl.nilai, keyakinan: "cukup" });
      const kua = A.kuaDariPosita ? A.kuaDariPosita(butir) : { nilai: "" };
      if (kua.nilai) hasil.usulan.push({ kode: "5178", nilai: kua.nilai, keyakinan: "ragu" });
    } else {
      const D = djp || require("./deteksiJenisPerkaraService");
      const t = D.tambahUsulanJenis({ usulan: [] }, posita, { jenisPerkara: String(jenisPerkara || ""), alur });
      hasil.usulan.push(...((t && t.usulan) || []));
    }
  } catch (_galat) {
    /* sumber lain tetap dipakai */
  }
  return hasil;
}

/**
 * Titik masuk dari rute: melengkapi `hasil` (keluaran susunKeteranganSaksiSdg) di tempat.
 *
 * @param {object} hasil   keluaran susunKeteranganSaksiSdg
 * @param {object} o
 *   templatMasuk  templat yang dikirim ke penyusun
 *   posita, jenisPerkara, alur, pelaku (Tergugat/Termohon), lawan (Penggugat/Pemohon), tanggalSidang, alamatPihak
 *   isian         req.body.isian
 *   sipp          hasil bacaSippSaksi
 * @returns {{terisi:number, ragu:number, jawaban:number}}
 */
function lengkapi(hasil, o) {
  const k = o && typeof o === "object" ? o : {};
  const kosong = { terisi: 0, ragu: 0, jawaban: 0 };
  try {
    if (!hasil || hasil.ok === false) return kosong;
    const templat = Array.isArray(k.templatMasuk) ? k.templatMasuk : [];
    if (!templat.some((b) => isi.masihKosong(b && (b.jawab || b.jawaban)))) return kosong;
    const jenis = kodeJenis(k.jenisPerkara, k.alur);
    const dp = deteksiPosita({ ...k, jenis });
    const tambahan = positaTambahan(k.posita, jenis);
    const fakta = isi.bangunFakta({ isian: saringIsian(k.isian), sipp: k.sipp, usulan: dp.usulan, cerai: dp.cerai, tambahan, sebutan: { P: k.lawan, T: k.pelaku } });
    const acuan = templat.map((b, i) => ({ no: String((b && (b.no || b.urutan_pertanyaan)) || i + 1), tanya: String((b && (b.tanya || b.pertanyaan)) || ""), jawab: String((b && (b.jawab || b.jawaban)) || "") }));
    const saksi = (hasil.saksi || []).map((s, i) => {
      const m = (Array.isArray(k.saksi) && k.saksi[i]) || {};
      const sumberKode = String(m.sumber || "");
      const sumberNama = m.sumberNama || (sumberKode === "keluarga" ? "keluarga mereka" : sumberKode === "tergugat" ? k.pelaku : k.lawan);
      return { ke: m.ke || s.ke, modus: s.modus || m.modus, sumberNama };
    });
    return isi.lengkapiSusunan(hasil, { templatAsli: acuan, fakta, jenis, P: k.lawan || "Penggugat", T: k.pelaku || "Tergugat", saksi });
  } catch (galat) {
    if (hasil && typeof hasil === "object") hasil.isiSumberGagal = String((galat && galat.message) || galat).slice(0, 200);
    return kosong;
  }
}

/**
 * Mengisi baris-baris tanya jawab apa saja (mis. susunan katalog jenis perkara) - sumber 'isi-jawaban'.
 * Kuncinya bebas (kunciJawaban katalog); hasil: { [kunci]: {teks, yakin, sumber, ket}, ["<kunci>@<kunciSaksi>"]: ... }.
 *
 * @param {object} o
 *   posita, jenisPerkara, alur, pelaku, lawan, tanggalSidang, alamatPihak, isian, sipp (sama dengan lengkapi)
 *   saksiIsi [{kunci, ke, modus, sumberNama, baris: [{kunci, tanya, jawab}]}]
 */
function isiBaris(o) {
  const k = o && typeof o === "object" ? o : {};
  const hasil = {};
  try {
    const jenis = kodeJenis(k.jenisPerkara, k.alur);
    const dp = deteksiPosita({ ...k, jenis });
    const fakta = isi.bangunFakta({
      isian: saringIsian(k.isian),
      sipp: k.sipp,
      usulan: dp.usulan,
      cerai: dp.cerai,
      tambahan: positaTambahan(k.posita, jenis),
      sebutan: { P: k.lawan, T: k.pelaku },
    });
    for (const s of Array.isArray(k.saksiIsi) ? k.saksiIsi.slice(0, 12) : []) {
      const ctx = { jenis, P: k.lawan || "Pemohon", T: k.pelaku || "Termohon", ke: Number(s.ke) || 1, modus: String(s.modus || ""), sumberNama: String(s.sumberNama || "") };
      for (const b of Array.isArray(s.baris) ? s.baris.slice(0, 80) : []) {
        const r = isi.isiJawaban({ tanya: String(b.tanya || ""), jawab: String(b.jawab || "") }, fakta, { ...ctx });
        if (!r) continue;
        const nilai = { teks: r.teks, yakin: r.yakin, sumber: r.sumber, ket: r.ket };
        const kunci = String(b.kunci || "");
        if (!kunci) continue;
        if (!hasil[kunci]) hasil[kunci] = nilai;
        hasil[`${kunci}@${String(s.kunci || ctx.ke)}`] = nilai;
      }
    }
  } catch (_galat) {
    /* kosong = jawaban dasar dipertahankan */
  }
  return hasil;
}

module.exports = { lengkapi, isiBaris, bacaSippSaksi, deteksiPosita, saringIsian, kodeJenis };
