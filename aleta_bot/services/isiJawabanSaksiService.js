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

/** Kode jenis jawaban saksi dari id jenis perkara SIPP, kunci katalog, atau namanya. */
const JENIS_ID = Object.freeze({ 346: "ct", 347: "cg", 360: "itsbat", 362: "dk", 363: "wa", 354: "perwalian", 358: "aua", 371: "paw", 364: "waris", 348: "hb", 341: "ip", 342: "cegah", 344: "batal", 349: "asuh", 743: "nafkahAnak", 365: "wasiat", 366: "hibah", 367: "wakaf", 370: "eksyar" });
const JENIS_KATALOG = Object.freeze({ "pengangkatan-anak": "angkat", mafqud: "mafqud", "hak-asuh": "asuh", "penguasaan-anak": "asuh", "nafkah-anak": "nafkahAnak", "izin-poligami": "ip", "pencegahan-perkawinan": "cegah", "pembatalan-perkawinan": "batal", hibah: "hibah", wakaf: "wakaf", wasiat: "wasiat", "ekonomi-syariah": "eksyar" });
function kodeJenis(jenisPerkara, alur, kunciKatalog) {
  const j = String(jenisPerkara || "").trim();
  if (JENIS_ID[j]) return JENIS_ID[j];
  if (JENIS_KATALOG[String(kunciKatalog || "")]) return JENIS_KATALOG[String(kunciKatalog)];
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
  if (/hibah/.test(n)) return "hibah";
  if (/wakaf/.test(n)) return "wakaf";
  if (/wasiat/.test(n)) return "wasiat";
  if (/ekonomi\s*syariah/.test(n)) return "eksyar";
  return "umum";
}

/**
 * Hubungan saksi dengan para pihak dari kolom Keterangan saksi di SIPP (perkara_pihak5). `kunciSaksi` = "saksi 2 p" / "saksi 1 t".
 * @returns {{teks: string, sumber: string, yakin: string, ket: string}|null}
 */
function hubunganDariSipp(sipp, kunciSaksi, lawan, pelaku) {
  const m = /^saksi\s+(\d+)\s+([pt])$/i.exec(String(kunciSaksi || "").trim());
  const daftar = sipp && Array.isArray(sipp.saksi) ? sipp.saksi : [];
  if (!m || !daftar.length) return null;
  const pihak = m[2].toLowerCase() === "t" ? "T" : "P";
  const id = daftar.find((x) => x && x.pihak === pihak && Number(x.urutPihak) === Number(m[1]));
  const label = id ? String(id.keterangan || "").replace(/\s+/g, " ").trim() : "";
  if (!label) return null;
  let teks = label;
  let yakin = "cukup";
  try {
    const D = require("./deteksiSaksiService");
    const d = D.deteksiHubungan(label, { bentuk: "label" });
    if (d) {
      teks = D.hubunganTampil(label, d, pihak, lawan, pelaku);
      yakin = "yakin";
    }
  } catch (_galat) {
    /* label ditulis apa adanya */
  }
  return { teks, sumber: "data SIPP", yakin, ket: yakin === "yakin" ? "" : "Hubungan saksi ditulis seperti di kolom Keterangan saksi SIPP; periksa penulisannya." };
}

/**
 * Menambahkan fakta bersama (faktaPerkara, U6) ke fakta jawaban saksi: tanya jawab saksi/BAS memakai nilai yang sama dengan
 * Blangko Derry dan putusan. Fakta bersama hanya MENAMBAH kandidat; prioritas dan penanda bertentangan tetap diputuskan buatFakta.
 */
function sertakanFaktaBersama(fakta, faktaBersama) {
  if (!faktaBersama || !fakta || typeof fakta.tambah !== "function") return fakta;
  try {
    for (const c of require("./faktaPerkara").kandidatUntukSaksi(faktaBersama)) fakta.tambah(c.kunci, c.nilai, c.yakin, c.prio, c.ket);
  } catch (_galat) {
    /* fakta bersama tidak terbaca: jawaban tetap dari sumber sendiri */
  }
  return fakta;
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
    const [nikah, itsbat, anak, pihak1, pihak2, saksiRows] = await Promise.all([
      aman("SELECT DATE_FORMAT(tgl_nikah, '%Y-%m-%d') AS tgl_nikah, kua_tempat_nikah AS kua FROM perkara_data_pernikahan WHERE perkara_id = ? LIMIT 1", [pid]),
      aman("SELECT DATE_FORMAT(tgl_menikah, '%Y-%m-%d') AS tgl, tempat_menikah AS tempat FROM perkara_data_itsbat WHERE perkara_id = ? LIMIT 1", [pid]),
      aman("SELECT nama_anak, DATE_FORMAT(tanggal_lahir, '%Y-%m-%d') AS lahir, jenis_kelamin AS jk, diasuh_oleh, ada_anak FROM perkara_anak_pihak WHERE perkara_id = ? ORDER BY anak_ke, id LIMIT 12", [pid]),
      aman("SELECT pp.urutan, pp.nama, pp.alamat, p.pekerjaan, DATE_FORMAT(p.tanggal_lahir, '%Y-%m-%d') AS lahir, p.jenis_kelamin AS jk FROM perkara_pihak1 pp LEFT JOIN pihak p ON p.id = pp.pihak_id WHERE pp.perkara_id = ? ORDER BY pp.urutan LIMIT 4", [pid]),
      aman("SELECT pp.urutan, pp.nama, pp.alamat, p.pekerjaan, DATE_FORMAT(p.tanggal_lahir, '%Y-%m-%d') AS lahir, p.jenis_kelamin AS jk FROM perkara_pihak2 pp LEFT JOIN pihak p ON p.id = pp.pihak_id WHERE pp.perkara_id = ? ORDER BY pp.urutan LIMIT 4", [pid]),
      aman("SELECT saksi_pihak_ke AS pihak, urutan, keterangan FROM perkara_pihak5 WHERE perkara_id = ? AND urutan > 0 ORDER BY saksi_pihak_ke, urutan LIMIT 12", [pid]),
    ]);
    const hitungSaksi = { P: 0, T: 0 };
    const saksi = (Array.isArray(saksiRows) ? saksiRows : []).map((b) => {
      const pihak = Number(b.pihak) === 2 ? "T" : "P";
      hitungSaksi[pihak] += 1;
      return { pihak, urutPihak: hitungSaksi[pihak], keterangan: String(b.keterangan || "") };
    });
    const satu = (x) => (Array.isArray(x) && x[0] ? x[0] : null);
    return { nikah: satu(nikah), itsbat: satu(itsbat), anak: Array.isArray(anak) ? anak : [], pihak1: Array.isArray(pihak1) ? pihak1 : [], pihak2: Array.isArray(pihak2) ? pihak2 : [], saksi };
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
    const jenis = kodeJenis(k.jenisPerkara, k.alur, k.kunciKatalog);
    const dp = deteksiPosita({ ...k, jenis });
    const tambahan = positaTambahan(k.posita, jenis, k.petitum);
    const fakta = sertakanFaktaBersama(isi.bangunFakta({ isian: saringIsian(k.isian), sipp: k.sipp, usulan: dp.usulan, cerai: dp.cerai, tambahan, sebutan: { P: k.lawan, T: k.pelaku } }), k.faktaBersama);
    const acuan = templat.map((b, i) => ({ no: String((b && (b.no || b.urutan_pertanyaan)) || i + 1), tanya: String((b && (b.tanya || b.pertanyaan)) || ""), jawab: String((b && (b.jawab || b.jawaban)) || "") }));
    const hitungPihak = { P: 0, T: 0 };
    const saksi = (hasil.saksi || []).map((s, i) => {
      const m = (Array.isArray(k.saksi) && k.saksi[i]) || {};
      const sumberKode = String(m.sumber || "");
      const sumberNama = m.sumberNama || (sumberKode === "keluarga" ? "keluarga mereka" : sumberKode === "tergugat" ? k.pelaku : k.lawan);
      const pihak = m.pihak === "T" ? "T" : "P";
      hitungPihak[pihak] += 1;
      const hubungan = hubunganDariSipp(k.sipp, `saksi ${hitungPihak[pihak]} ${pihak.toLowerCase()}`, k.lawan, k.pelaku);
      return { ke: m.ke || s.ke, modus: s.modus || m.modus, sumberNama, hubungan };
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
    const jenis = kodeJenis(k.jenisPerkara, k.alur, k.kunciKatalog);
    const dp = deteksiPosita({ ...k, jenis });
    const fakta = sertakanFaktaBersama(
      isi.bangunFakta({
      isian: saringIsian(k.isian),
      sipp: k.sipp,
      usulan: dp.usulan,
      cerai: dp.cerai,
      tambahan: positaTambahan(k.posita, jenis, k.petitum),
      sebutan: { P: k.lawan, T: k.pelaku },
      }),
      k.faktaBersama
    );
    // Variabel ABT yang belum terbaca di ekstensi (mis. nama anak di PERTANYAAN) dihitung dari fakta yang sama.
    const variabel = {};
    const ctxVar = { jenis, P: k.lawan || "Pemohon", T: k.pelaku || "Termohon", jumlahP: k.sipp && Array.isArray(k.sipp.pihak1) ? k.sipp.pihak1.length : 0 };
    for (const kode of (Array.isArray(k.kodeVariabel) ? k.kodeVariabel : []).slice(0, 60)) {
      if (!/^\d{4}$/.test(String(kode))) continue;
      const nv = isi.nilaiVariabel(String(kode), fakta, ctxVar);
      if (nv) variabel[String(kode)] = nv;
    }
    if (Object.keys(variabel).length) hasil["__variabel"] = variabel;
    for (const s of Array.isArray(k.saksiIsi) ? k.saksiIsi.slice(0, 12) : []) {
      const ctx = { jenis, P: k.lawan || "Pemohon", T: k.pelaku || "Termohon", ke: Number(s.ke) || 1, modus: String(s.modus || ""), sumberNama: String(s.sumberNama || ""), hubungan: hubunganDariSipp(k.sipp, s.kunci, k.lawan, k.pelaku), jumlahP: k.sipp && Array.isArray(k.sipp.pihak1) ? k.sipp.pihak1.length : 0 };
      for (const b of Array.isArray(s.baris) ? s.baris.slice(0, 80) : []) {
        const r = isi.isiJawaban({ tanya: String(b.tanya || ""), jawab: String(b.jawab || ""), ...(typeof b.kode === "string" && b.kode ? { kode: b.kode.slice(0, 3000) } : {}) }, fakta, { ...ctx });
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

/**
 * Fakta perkara apa adanya (sumber 'isi-jawaban' dengan mintaFakta): kunci -> {nilai, yakin, sumber, ket}. Dipakai penyusun saksi
 * katalog di panel untuk mengisi {slot} dan variabel ABT yang masih kosong dari isian blangko > data SIPP > gugatan. Tidak pernah
 * menebak: kunci yang tidak ada di ketiga sumber tidak muncul.
 */
const KUNCI_FAKTA_PUBLIK = ["tglNikah", "tempatNikah", "kua", "kediaman", "awalKonflik", "puncak", "puncakPeristiwa", "penyebab", "pisahSejak", "lamaPisah", "siapaPergi", "jumlahAnak", "anakNama", "anakIkutPihak", "alamatP", "alamatT", "pekerjaanP", "pekerjaanT", "upayaDamai", "putusanCerai", "aktaCerai", "hartaPeninggalan", "jumlahObjek", "nilaiTotalHarta", "ahliWaris", "pewarisNama", "wafatTgl", "wafatTempat"];
function faktaPerkara(o) {
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
      tambahan: positaTambahan(k.posita, jenis, k.petitum),
      sebutan: { P: k.lawan, T: k.pelaku },
    });
    for (const kunci of KUNCI_FAKTA_PUBLIK) {
      const f = fakta.ambil(kunci);
      if (f && f.nilai) hasil[kunci] = { nilai: String(f.nilai).slice(0, 400), yakin: f.yakin, sumber: f.sumber, ket: String(f.ket || "").slice(0, 300) };
    }
    // 21 Okt 2026 (W2a-K1): saran keadaan perkara (butir mana yang tampil) dari posita dan petitum harta bersama / kewarisan; semuanya "ragu - periksa"
    if ((jenis === "hb" || jenis === "waris") && String(k.posita || "").replace(/<[^>]*>/g, " ").trim()) {
      const saran = require("./isiJawabanSaksiKebendaan").saranKeadaan(jenis, k.posita, k.petitum);
      if (saran.length) hasil.__saranKeadaan = saran;
    }
    // 21 Okt 2026 (W2a-K2): saran keadaan wasiat, hibah, wakaf dan ekonomi syariah (isiJawabanSaksiKebendaanLain.js); semuanya "ragu - periksa"
    if ((jenis === "wasiat" || jenis === "hibah" || jenis === "wakaf" || jenis === "eksyar") && String(k.posita || "").replace(/<[^>]*>/g, " ").trim()) {
      const saran = require("./isiJawabanSaksiKebendaanLain").saranKeadaan(k.posita, k.petitum, jenis, { alur: k.alur });
      if (saran.length) hasil.__saranKeadaan = saran;
    }
    // upaya damai keluarga dari gugatan (bukan dari mediasi: mediasi baru diketahui sesudah sidang)
    if ((jenis === "cg" || jenis === "ct") && String(k.posita || "").replace(/<[^>]*>/g, " ").trim()) {
      const A = require("./abtUsulanService");
      const u = A.sumberUpayaDamai({ nilai1268: "", posita: k.posita, mediasi: null, pelaku: k.pelaku, lawan: k.lawan });
      if (u && u.kalimat) hasil.upayaDamai = { nilai: String(u.kalimat).slice(0, 400), yakin: "cukup", sumber: "gugatan", ket: "Dibaca dari kalimat upaya damai pada gugatan; periksa dengan keterangan saksi." };
    }
  } catch (_galat) {
    /* kosong = tidak ada fakta; penyusun memakai isian petugas */
  }
  return hasil;
}

module.exports = { lengkapi, isiBaris, faktaPerkara, KUNCI_FAKTA_PUBLIK, bacaSippSaksi, deteksiPosita, saringIsian, kodeJenis, hubunganDariSipp, sertakanFaktaBersama };
