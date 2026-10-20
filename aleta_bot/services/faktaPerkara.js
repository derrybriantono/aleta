"use strict";

/**
 * ============================================================================
 * FAKTA PERKARA - SATU SUMBER FAKTA PER PERKARA (agen U6, 20 Okt 2026)
 * ============================================================================
 *
 * Masalah yang diselesaikan: fakta yang sama (tanggal nikah, wali, anak, awal perselisihan, ...) dibaca oleh banyak pengisi
 * yang berdiri sendiri - abtUsulanService.dariSipp (+ abtIsianSippLanjutan, abtIsianLengkap20okt "S3", isiOtomatisJenisS5/S6),
 * pengisi jawaban saksi (isiJawabanSaksi*), mesin deteksi posita, dan isian yang sudah diketik petugas di ABT. Tiap pengisi
 * memberi nilainya sendiri sehingga tanya jawab saksi, BAS, dan putusan dapat menulis nilai yang BERBEDA untuk satu fakta.
 *
 * Berkas ini TIDAK menggantikan pengisi lama - ia MEMBUNGKUS semuanya dan memberi satu pintu:
 *
 *     const { faktaPerkara } = require("./faktaPerkara");
 *     const f = await faktaPerkara(perkaraId /* atau nomor perkara *\/, { isian, runQuery, runAbt, ... });
 *     f.fakta["nikah.tanggal"]   // { nilai, yakin, sumber, kutipan, kode:[...], bertentangan:[...] }
 *     f.kode["5197"]             // nilai untuk kode variabel ABT itu (juga untuk kode setara dari fakta yang sama)
 *     f.petitum                  // butir petitum (petitumBerbutir.js)
 *     f.usulanSetara             // usulan {kode,nilai,...} untuk kode setara - bentuk sama dengan usulan dariSipp
 *
 * Bentuk lengkap dan aturan prioritas ada di docs/isi-sipp-abt/FAKTA-PERKARA.md. Peta fakta -> kode variabel ada di
 * aleta_bot/config/peta-fakta-variabel.json (boleh ditambah agen lain; kode hanya di satu fakta).
 *
 * Aturan prioritas sumber (angka kecil menang):
 *   1 isian petugas   (abt_data_teks / yang diketik di Blangko Derry)  - kata petugas tidak pernah dikalahkan mesin
 *   2 data SIPP       (kolom terstruktur: pernikahan, anak, pihak, delegasi, ...)
 *   3 BAS             (keterangan saksi tersimpan)
 *   4 berkas e-Court  (gugatan/KTP/lampiran)
 *   5 posita/gugatan  (mesin deteksi kalimat)
 * Dua sumber yang menyebut nilai BERBEDA untuk satu fakta -> fakta ditandai `bertentangan` dan keyakinannya "ragu"
 * (kecuali pemenangnya isian petugas: tetap "pasti", pertentangan hanya dicatat).
 *
 * Semua pembacaan: SELECT saja. Kegagalan satu sumber tidak menggagalkan yang lain (dicatat di `galat`).
 */

const fs = require("fs");
const path = require("path");

const PETA_BERKAS = path.join(__dirname, "..", "config", "peta-fakta-variabel.json");

const PRIO = Object.freeze({ petugas: 1, sipp: 2, bas: 3, berkas: 4, posita: 5 });
const LABEL_SUMBER = Object.freeze({ 1: "isian petugas", 2: "data SIPP", 3: "BAS", 4: "berkas e-Court", 5: "posita/gugatan" });
const PANGKAT = Object.freeze({ pasti: 3, cukup: 2, ragu: 1 });

// ──────────────────────────────────────────────────────────────────────────────
// Peta fakta <-> kode
// ──────────────────────────────────────────────────────────────────────────────

let cachePeta = null;

/** Memuat peta dan membangun indeks kode -> fakta, kunciSaksi -> fakta. `petaLuar` (objek) dipakai uji. */
function muatPeta(petaLuar) {
  if (!petaLuar && cachePeta) return cachePeta;
  const mentah = petaLuar || JSON.parse(fs.readFileSync(PETA_BERKAS, "utf8"));
  const fakta = mentah.fakta || {};
  const kodeKeFakta = new Map();
  const saksiKeFakta = new Map();
  for (const [kunci, d] of Object.entries(fakta)) {
    for (const k of d.kode || []) {
      const kode = typeof k === "string" ? k : k.kode;
      if (kode) kodeKeFakta.set(String(kode), kunci);
    }
    if (d.kunciSaksi) saksiKeFakta.set(d.kunciSaksi, kunci);
  }
  const hasil = { ...mentah, fakta, kodeKeFakta, saksiKeFakta };
  if (!petaLuar) cachePeta = hasil;
  return hasil;
}

const kodeBaku = (k) => String(k == null ? "" : k).trim();
/** Kode ABT bernilai angka dengan nol di depan ("0007"); varian tanpa nol ("7") dikenali juga. */
function faktaDariKode(peta, kode) {
  const k = kodeBaku(kode);
  return peta.kodeKeFakta.get(k) || peta.kodeKeFakta.get(k.padStart(4, "0")) || null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Pembersih & pembanding nilai menurut tipe
// ──────────────────────────────────────────────────────────────────────────────

const lazy = {
  F: () => require("./isiJawabanSaksiFakta"),
  L: () => require("./abtIsianLengkap20okt"),
  T: () => require("./tuntutanDeteksiService"),
};

const rapat = (t) => String(t == null ? "" : t).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const adaAleta = (t) => /aleta/i.test(String(t == null ? "" : t));

/** Tanggal lengkap -> "YYYY-MM-DD"; "" bila bukan tanggal lengkap. */
function tanggalIso(t) {
  const s = rapat(t);
  if (!s) return "";
  const L = lazy.L();
  const a = L.ketanggalIso(s);
  if (a) return a;
  const indo = lazy.F().tanggalIndo(s);
  return indo ? L.ketanggalIso(indo) : "";
}

const angkaPertama = (t) => {
  const m = /\d[\d.]*/.exec(String(t == null ? "" : t));
  return m ? m[0].replace(/\./g, "") : "";
};
function rupiahAngka(t) {
  const s = String(t == null ? "" : t);
  const m = /Rp\.?\s*([\d.]+)/i.exec(s) || /\b(\d{1,3}(?:\.\d{3})+|\d{4,})\b/.exec(s);
  return m ? m[1].replace(/\./g, "") : "";
}
const namaBaku = (n) =>
  lazy.F()
    .norm(String(n).replace(/\b(?:bin|binti|alias|als)\b.*$/i, " "))
    .trim();
function daftarNama(t) {
  return String(t == null ? "" : t)
    .split(/;|\n|\bdan\b|,(?=\s*[A-Z])/)
    .map((x) => rapat(x))
    .filter((x) => x.length > 1);
}

/** Nilai kanonik untuk perbandingan dan keluaran (bergantung tipe fakta). */
function kanon(tipe, nilai) {
  const F = lazy.F();
  const v = rapat(nilai);
  switch (tipe) {
    case "tanggal":
      return tanggalIso(v) || F.waktuNikah(v) || v;
    case "angka":
      return angkaPertama(v) || v;
    case "rupiah":
      return rupiahAngka(v) || v;
    case "jumlahAnak": {
      const n = F.jumlahAnakDariTeks(v);
      if (n !== null) return String(n);
      return /^\d+$/.test(v) ? v : v;
    }
    case "nama":
    case "daftar":
      return daftarNama(v).join("; ");
    default:
      return v;
  }
}

/** Dua nilai (sudah dikanon) dianggap sama bila setelah normalisasi identik, atau saling memuat (teks), atau himpunan nama berimpit. */
function sama(tipe, a, b) {
  const F = lazy.F();
  if (a === "" || b === "") return true;
  if (tipe === "tanggal" || tipe === "angka" || tipe === "rupiah" || tipe === "jumlahAnak") return a === b || (tipe === "tanggal" && F.norm(a) === F.norm(b));
  if (tipe === "nama" || tipe === "daftar") {
    const x = new Set(daftarNama(a).map(namaBaku).filter(Boolean));
    const y = new Set(daftarNama(b).map(namaBaku).filter(Boolean));
    if (!x.size || !y.size) return true;
    const kecil = x.size <= y.size ? x : y;
    const besar = x.size <= y.size ? y : x;
    return [...kecil].every((n) => [...besar].some((m) => m === n || m.includes(n) || n.includes(m)));
  }
  return F.norm(a) === F.norm(b) || F.norm(a).includes(F.norm(b)) || F.norm(b).includes(F.norm(a));
}

const BULAN_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
/** Menulis nilai fakta menurut bentuk kode: asal | indo | slash | iso. Selain tanggal lengkap: apa adanya. */
function tulisBentuk(nilai, bentuk) {
  if (!bentuk || bentuk === "asal") return nilai;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(nilai));
  if (!iso) return nilai;
  if (bentuk === "iso") return nilai;
  if (bentuk === "slash") return `${iso[3]}/${iso[2]}/${iso[1]}`;
  if (bentuk === "indo") return `${Number(iso[3])} ${BULAN_ID[Number(iso[2]) - 1]} ${iso[1]}`;
  return nilai;
}

const dariYakin = (y) => {
  const x = String(y || "").toLowerCase();
  if (x === "pasti" || x === "yakin") return "pasti";
  if (x === "cukup") return "cukup";
  return "ragu";
};

// ──────────────────────────────────────────────────────────────────────────────
// Gudang kandidat & penimbangan
// ──────────────────────────────────────────────────────────────────────────────

function buatGudang(peta) {
  const kandidat = new Map(); // kunci fakta -> [{nilai,yakin,prio,sumber,kutipan,kode,asal}]
  const kodeMentah = new Map(); // kode tak terpetakan -> [{nilai,yakin,prio,...}]
  const api = {
    tambah(kunci, c) {
      const d = peta.fakta[kunci];
      const tipe = d ? d.tipe : "teks";
      if (!c || c.nilai == null || adaAleta(c.nilai)) return;
      const nilai = kanon(tipe, c.nilai);
      if (nilai === "") return;
      const daftar = kandidat.get(kunci) || [];
      daftar.push({ nilai, yakin: dariYakin(c.yakin), prio: c.prio, sumber: LABEL_SUMBER[c.prio], kutipan: rapat(c.kutipan).slice(0, 400), kode: c.kode ? kodeBaku(c.kode) : "", asal: c.asal || "", urut: daftar.length });
      kandidat.set(kunci, daftar);
    },
    tambahKode(kode, c) {
      if (!c || c.nilai == null || adaAleta(c.nilai) || !rapat(c.nilai)) return;
      const daftar = kodeMentah.get(kodeBaku(kode)) || [];
      daftar.push({ nilai: String(c.nilai), yakin: dariYakin(c.yakin), prio: c.prio, sumber: LABEL_SUMBER[c.prio], kutipan: rapat(c.kutipan).slice(0, 400), asal: c.asal || "", urut: daftar.length });
      kodeMentah.set(kodeBaku(kode), daftar);
    },
    kunciFakta: () => [...kandidat.keys()],
    kunciKode: () => [...kodeMentah.keys()],
    kandidatFakta: (k) => kandidat.get(k) || [],
    kandidatKode: (k) => kodeMentah.get(k) || [],
  };
  return api;
}

const potong = (t, n = 60) => {
  const s = rapat(t);
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};

/** Menimbang kandidat satu fakta -> {nilai, yakin, sumber, kutipan, kode, bertentangan, prio} atau null. */
function timbang(tipe, daftar) {
  if (!daftar.length) return null;
  const urut = daftar.slice().sort((a, b) => a.prio - b.prio || PANGKAT[b.yakin] - PANGKAT[a.yakin] || a.urut - b.urut);
  const atas = urut[0];
  const setuju = urut.filter((c) => sama(tipe, c.nilai, atas.nilai));
  const lawan = urut.filter((c) => !sama(tipe, c.nilai, atas.nilai));
  let yakin = atas.yakin;
  for (const c of setuju) if (PANGKAT[c.yakin] > PANGKAT[yakin]) yakin = c.yakin;
  if (atas.prio === PRIO.petugas) yakin = "pasti";
  else if (lawan.length) yakin = "ragu";
  const sumber = [...new Set(setuju.map((c) => c.prio))].sort().map((p) => LABEL_SUMBER[p]).join(" + ");
  const kutipan = (setuju.find((c) => c.kutipan) || {}).kutipan || "";
  const kode = [...new Set(setuju.map((c) => c.kode).filter(Boolean))];
  const bertentangan = lawan.map((c) => ({ nilai: c.nilai, sumber: c.sumber, kutipan: c.kutipan, kode: c.kode }));
  let catatan = "";
  if (lawan.length) {
    const l = lawan[0];
    catatan = `${atas.sumber} menyebut "${potong(atas.nilai)}", sedangkan ${l.sumber} menyebut "${potong(l.nilai)}". Periksa mana yang benar.`;
  }
  return { nilai: atas.nilai, yakin, sumber, kutipan, kode, bertentangan, catatan, prio: atas.prio };
}

// ──────────────────────────────────────────────────────────────────────────────
// Pembaca sumber
// ──────────────────────────────────────────────────────────────────────────────

const diam = (kerja) => {
  try {
    return Promise.resolve(kerja()).catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
};
const satu = (r) => (Array.isArray(r) && r[0]) || null;

function runQueryBawaan(db) {
  return (sql, params) =>
    new Promise((resolve, reject) => {
      db().query(sql, params || [], (e, r) => (e ? reject(e) : resolve(r)));
    });
}

/** Asal usulan dariSipp -> tingkat sumber. */
function prioUsulan(u) {
  const asal = String((u && u.sumber && u.sumber[0] && u.sumber[0].asal) || "").toLowerCase();
  const pola = String((u && u.kodePola) || "").toLowerCase();
  if (/ktp|ecourt|lampiran|gugatan-ecourt|ocr/.test(asal)) return PRIO.berkas;
  if (/posita|petitum|saksi|deteksi|gugatan/.test(asal) || /^(?:posita|petitum)/.test(pola)) return PRIO.posita;
  if (/isian-petugas/.test(asal)) return PRIO.petugas;
  return PRIO.sipp;
}

/** Isian petugas yang sudah tersimpan di ABT untuk kode-kode berpeta (abt_data_teks, baca saja). */
async function bacaIsianAbt(perkaraId, kodeDaftar, runAbt) {
  if (!kodeDaftar.length || typeof runAbt !== "function") return {};
  const angka = kodeDaftar.map((k) => Number(k)).filter((n) => Number.isFinite(n));
  if (!angka.length) return {};
  const baris = await diam(() => runAbt(`SELECT no_var, data FROM abt_data_teks WHERE perkara_id = ? AND no_var IN (${angka.map(() => "?").join(",")})`, [perkaraId, ...angka]));
  const hasil = {};
  for (const b of Array.isArray(baris) ? baris : []) {
    const kode = String(b.no_var).padStart(4, "0");
    const nilai = rapat(b.data);
    if (nilai && !adaAleta(nilai)) hasil[kode] = nilai;
  }
  return hasil;
}

// ──────────────────────────────────────────────────────────────────────────────
// Titik masuk
// ──────────────────────────────────────────────────────────────────────────────

const SEBUTAN = Object.freeze({ 346: { P: "Pemohon", T: "Termohon" }, 347: { P: "Penggugat", T: "Tergugat" } });

/**
 * @param {number|string|{perkaraId?:number, nomorPerkara?:string}} masukan  id perkara SIPP, nomor perkara, atau objek
 * @param {object} [opsi]
 *   runQuery(sql, params)   pembaca SIPP baca-saja (bawaan: db_config)
 *   runAbt(sql, params)     pembaca ABT baca-saja (bawaan: db_config5); null = tanpa isian petugas dari ABT
 *   isian                   {kode: nilai | {nilai, keyakinan}}  isian petugas yang diketahui pemanggil (menambah/ menimpa bacaan ABT)
 *   usulan                  usulan siap pakai (menggantikan abtUsulanService.dariSipp) - untuk uji/skrip ukur
 *   perkara                 baris perkara siap pakai {jenis, alur, posita, petitum, nomor}
 *   sippSaksi               data SIPP siap pakai untuk pengisi jawaban saksi (bacaSippSaksi)
 *   pelaku, lawan           sebutan Tergugat/Termohon dan Penggugat/Pemohon (bawaan menurut jenis)
 *   tanggalSidang           "17 November 2025" untuk hitungan lama pisah
 *   peta                    peta lain (uji)
 *   tanpaDariSipp           true = jangan memanggil dariSipp
 *   tanpaBas                true = jangan membaca BAS
 *   batasMs                 batas waktu seluruh pembacaan (bawaan 6000)
 */
async function faktaPerkara(masukan, opsi) {
  const o = opsi && typeof opsi === "object" ? opsi : {};
  const petaDasar = muatPeta(o.peta);
  // salinan per panggilan: fakta dinamis (kunci lama pengisi saksi yang belum berpeta) tidak mencemari peta bersama
  const peta = { ...petaDasar, fakta: { ...petaDasar.fakta } };
  const g = buatGudang(peta);
  const galat = [];
  const terbaca = { perkara: false, dariSipp: false, posita: false, isianAbt: false, isianLuar: false, bas: false, petitum: false };
  const runQuery = typeof o.runQuery === "function" ? o.runQuery : runQueryBawaan(() => require("../db_config"));
  const runAbt = o.runAbt === null ? null : typeof o.runAbt === "function" ? o.runAbt : (() => {
    try {
      return runQueryBawaan(() => require("../db_config5"));
    } catch {
      return null;
    }
  })();

  // 1. Perkara dasar
  let perkara = o.perkara && typeof o.perkara === "object" ? o.perkara : null;
  const id0 = typeof masukan === "object" && masukan ? masukan.perkaraId : /^\d+$/.test(String(masukan)) ? Number(masukan) : null;
  const nomor0 = typeof masukan === "object" && masukan ? masukan.nomorPerkara : /^\d+$/.test(String(masukan)) ? "" : String(masukan || "");
  if (!perkara) {
    const baris = await diam(() =>
      id0
        ? runQuery("SELECT perkara_id AS id, nomor_perkara AS nomor, jenis_perkara_id AS jenis, alur_perkara_id AS alur, posita, petitum, DATE_FORMAT(tanggal_pendaftaran, '%Y-%m-%d') AS daftar FROM perkara WHERE perkara_id = ? LIMIT 1", [id0])
        : runQuery("SELECT perkara_id AS id, nomor_perkara AS nomor, jenis_perkara_id AS jenis, alur_perkara_id AS alur, posita, petitum, DATE_FORMAT(tanggal_pendaftaran, '%Y-%m-%d') AS daftar FROM perkara WHERE nomor_perkara = ? LIMIT 1", [nomor0])
    );
    perkara = satu(baris);
  }
  if (!perkara) return { ok: false, alasan: "perkara_tidak_ditemukan", versi: "fakta-perkara/1", fakta: {}, kode: {}, petitum: [], bertentangan: [], usulanSetara: [], galat };
  terbaca.perkara = true;
  const perkaraId = Number(perkara.id || id0) || 0;
  const nomorPerkara = String(perkara.nomor || nomor0 || "");
  const jenisId = Number(perkara.jenis) || 0;
  const alur = perkara.alur;
  const seb = SEBUTAN[jenisId] || { P: "Pemohon", T: "Termohon" };
  const pelaku = o.pelaku || seb.T;
  const lawan = o.lawan || seb.P;

  // 2. Isian petugas: ABT + yang diketahui pemanggil (pemanggil menang untuk kode yang sama)
  const kodeBerpeta = [...peta.kodeKeFakta.keys()];
  const isianAbt = await diam(() => bacaIsianAbt(perkaraId, kodeBerpeta, runAbt)).then((x) => x || {});
  terbaca.isianAbt = Object.keys(isianAbt).length > 0;
  const isianLuar = {};
  for (const [kode, v] of Object.entries(o.isian && typeof o.isian === "object" ? o.isian : {})) {
    const nilai = rapat(v && typeof v === "object" ? v.nilai : v);
    if (nilai && !adaAleta(nilai)) isianLuar[String(kode).padStart(4, "0")] = nilai;
  }
  terbaca.isianLuar = Object.keys(isianLuar).length > 0;
  const isianPetugas = { ...isianAbt, ...isianLuar };
  const kodePetugas = new Set(Object.keys(isianPetugas));
  for (const [kode, nilai] of Object.entries(isianPetugas)) {
    const kunci = faktaDariKode(peta, kode);
    const kut = `Isian petugas pada variabel ${kode}`;
    if (kunci) g.tambah(kunci, { nilai, yakin: "pasti", prio: PRIO.petugas, kutipan: kut, kode, asal: "isian-petugas" });
    else g.tambahKode(kode, { nilai, yakin: "pasti", prio: PRIO.petugas, kutipan: kut, asal: "isian-petugas" });
  }

  // 3. Usulan seluruh pengisi lama (dariSipp = SIPP terstruktur + S3/S5/S6/lanjutan + posita-gugatan)
  let usulanSipp = Array.isArray(o.usulan) ? o.usulan : null;
  if (!usulanSipp && !o.tanpaDariSipp && nomorPerkara) {
    const r = await diam(() => require("./abtUsulanService").dariSipp(nomorPerkara));
    if (r && Array.isArray(r.usulan)) usulanSipp = r.usulan;
    else galat.push("dariSipp");
  }
  for (const u of usulanSipp || []) {
    if (!u || !u.kode || u.nilai == null || !rapat(u.nilai)) continue;
    if (/^(?:tidak_ada_sumber|kosong)$/.test(String(u.keyakinan || ""))) continue;
    const prio = prioUsulan(u);
    const kunci = faktaDariKode(peta, u.kode);
    const kut = (u.sumber && u.sumber[0] && u.sumber[0].kalimat) || u.catatan || "";
    const c = { nilai: u.nilai, yakin: u.keyakinan, prio, kutipan: kut, kode: u.kode, asal: (u.sumber && u.sumber[0] && u.sumber[0].asal) || "sipp" };
    if (kunci) g.tambah(kunci, c);
    else g.tambahKode(u.kode, c);
  }
  terbaca.dariSipp = Array.isArray(usulanSipp);

  // 4. Mesin jawaban saksi: data SIPP + deteksi posita + pola tambahan (kunci lama -> fakta)
  try {
    const J = require("./isiJawabanSaksiService");
    const { positaTambahan } = require("./isiJawabanSaksiPosita");
    const kj = J.kodeJenis(String(jenisId), alur);
    const sipp = o.sippSaksi !== undefined ? o.sippSaksi : nomorPerkara ? await J.bacaSippSaksi(nomorPerkara, runQuery) : null;
    const dp = J.deteksiPosita({ posita: perkara.posita, jenis: kj, jenisPerkara: String(jenisId), alur, pelaku, lawan, tanggalSidang: o.tanggalSidang || "", alamatPihak: o.alamatPihak });
    const F = lazy.F().bangunFakta({ isian: {}, sipp, usulan: dp.usulan, cerai: dp.cerai, tambahan: positaTambahan(perkara.posita, kj), sebutan: { P: lawan, T: pelaku } });
    const PRIO_LAMA = { 1: PRIO.petugas, 2: PRIO.sipp, 3: PRIO.posita };
    for (const kunciLama of F.semua()) {
      const kunci = peta.saksiKeFakta.get(kunciLama) || `saksi.${kunciLama}`;
      if (!peta.fakta[kunci]) peta.fakta[kunci] = { label: kunciLama, tipe: "teks", kode: [], dinamis: true };
      for (const k of F.kandidat(kunciLama)) {
        if (PRIO_LAMA[k.prio] === PRIO.petugas) continue;
        g.tambah(kunci, { nilai: k.nilai, yakin: k.yakin, prio: PRIO_LAMA[k.prio] || PRIO.posita, kutipan: k.ket || `Terbaca dari ${LABEL_SUMBER[PRIO_LAMA[k.prio] || PRIO.posita]}`, asal: "mesin-saksi" });
      }
    }
    terbaca.posita = true;
  } catch (e) {
    galat.push(`mesinSaksi: ${String((e && e.message) || e).slice(0, 120)}`);
  }

  // 5. Petitum berbutir
  let petitum = [];
  try {
    const P = require("./petitumBerbutir");
    petitum = P.petitumBerbutir(perkara.petitum, { posita: perkara.posita, jenis: jenisId, alur }).butir;
    terbaca.petitum = true;
  } catch (e) {
    if (!/Cannot find module/.test(String(e && e.message))) galat.push(`petitum: ${String((e && e.message) || e).slice(0, 120)}`);
  }

  // 6. BAS
  let bas = null;
  if (!o.tanpaBas) {
    try {
      const B = require("./basPerkara");
      bas = await B.bacaBas(perkaraId, runAbt, runQuery);
      terbaca.bas = Boolean(bas);
    } catch (e) {
      if (!/Cannot find module/.test(String(e && e.message))) galat.push(`bas: ${String((e && e.message) || e).slice(0, 120)}`);
    }
  }

  // 7. Penimbangan
  const fakta = {};
  for (const kunci of g.kunciFakta()) {
    const d = peta.fakta[kunci] || { tipe: "teks", kode: [] };
    const t = timbang(d.tipe, g.kandidatFakta(kunci));
    if (!t) continue;
    fakta[kunci] = { label: d.label || kunci, tipe: d.tipe, nilai: t.nilai, yakin: t.yakin, sumber: t.sumber, kutipan: t.kutipan, kodeAsal: t.kode, kode: (d.kode || []).map((k) => (typeof k === "string" ? k : k.kode)), bertentangan: t.bertentangan, catatan: t.catatan, hanyaSaran: d.hanyaSaran === true };
  }
  // Kesaksian di BAS untuk pokok yang memuat fakta ini (bahan analisis bukti & saksi per dalil di pertimbangan putusan)
  if (bas && bas.pokok) {
    for (const def of peta.pokokBas || []) {
      const kutipan = (bas.pokok[def.id] || []).map((x) => ({ saksi: x.saksi, pihak: x.pihak, nama: x.nama, tanya: x.tanya, jawab: x.jawab }));
      if (!kutipan.length) continue;
      for (const kunci of def.fakta || []) if (fakta[kunci]) fakta[kunci].kesaksian = kutipan;
    }
  }
  const bertentangan = Object.keys(fakta).filter((k) => fakta[k].bertentangan.length);

  // 8. Peta kode: tiap kode berpeta mendapat nilai fakta (bentuk sesuai kodenya); kode lain: usulan terbaik
  const kode = {};
  for (const [kunci, f] of Object.entries(fakta)) {
    const d = peta.fakta[kunci] || {};
    for (const k of d.kode || []) {
      const kd = typeof k === "string" ? k : k.kode;
      const bentuk = (typeof k === "object" && k.bentuk) || (d.bentukKode && d.bentukKode[kd]) || "asal";
      kode[kd] = { nilai: tulisBentuk(f.nilai, bentuk), yakin: f.yakin, sumber: f.sumber, kutipan: f.kutipan, fakta: kunci, bentrok: f.bertentangan.length > 0, asalKode: f.kodeAsal.includes(kd) };
    }
  }
  for (const kd of g.kunciKode()) {
    if (kode[kd]) continue;
    const t = timbang("teks", g.kandidatKode(kd));
    if (t) kode[kd] = { nilai: t.nilai, yakin: t.yakin, sumber: t.sumber, kutipan: t.kutipan, fakta: "", bentrok: t.bertentangan.length > 0, asalKode: true };
  }

  // 9. Usulan untuk kode setara: kode lain dari fakta yang sama dengan nilai yang sudah ada di salah satu kodenya
  const usulanSetara = [];
  for (const [kunci, f] of Object.entries(fakta)) {
    if (f.hanyaSaran) continue;
    const d = peta.fakta[kunci] || {};
    const daftarKode = (d.kode || []).map((k) => (typeof k === "string" ? k : k.kode));
    if (daftarKode.length < 2) continue;
    const dariPetugas = f.sumber.split(" + ")[0] === LABEL_SUMBER[PRIO.petugas];
    for (const kd of daftarKode) {
      if (f.kodeAsal.includes(kd)) continue; // kode ini sudah punya nilainya sendiri dari sumber yang sama
      if (kodePetugas.has(kd)) continue; // petugas sudah mengisi kode ini sendiri - tidak pernah dikalahkan
      const entri = kode[kd];
      usulanSetara.push({
        kode: kd,
        nama: d.label || kunci,
        nilai: entri.nilai,
        keyakinan: dariPetugas ? "pasti" : f.yakin === "pasti" ? "cukup" : f.yakin,
        bentrok: "",
        sumber: [{ saksi: 0, asal: dariPetugas ? "isian-petugas" : "fakta-setara", kalimat: dariPetugas ? `Isian petugas pada variabel ${f.kodeAsal.join(", ")} (fakta yang sama: ${d.label || kunci})` : `Fakta yang sama (${d.label || kunci}) dari ${f.sumber}` }],
        catatan: dariPetugas ? "Sama dengan isian yang sudah Anda tulis di blangko lain untuk perkara ini." : `Sama dengan fakta "${d.label || kunci}" yang sudah terbaca dari ${f.sumber}.`,
        dihitung: false,
        jagaIsianLama: true,
        kodePola: dariPetugas ? "fakta-setara-petugas" : `fakta-setara:${kunci}`,
        fakta: kunci,
      });
    }
  }

  return {
    ok: true,
    versi: "fakta-perkara/1",
    perkaraId,
    nomorPerkara,
    jenis: jenisId,
    alur: alur == null ? null : Number(alur),
    fakta,
    kode,
    petitum,
    bas,
    bertentangan,
    usulanSetara,
    terbaca,
    galat,
  };
}

/**
 * Fakta bersama -> kandidat untuk pengisi jawaban saksi (kunci lama `isiJawabanSaksiFakta`: tglNikah, anakNama, ...).
 * Dipakai isiJawabanSaksiService supaya tanya jawab saksi/BAS membaca nilai yang SAMA dengan Blangko Derry dan putusan.
 * @returns {Array<{kunci:string, nilai:string, yakin:string, prio:number, ket:string}>}
 */
function kandidatUntukSaksi(hasil, petaLuar) {
  const peta = muatPeta(petaLuar);
  const keluar = [];
  if (!hasil || !hasil.fakta) return keluar;
  for (const [kunci, f] of Object.entries(hasil.fakta)) {
    const d = peta.fakta[kunci];
    if (!d || !d.kunciSaksi || f.hanyaSaran) continue;
    const prio = f.sumber.startsWith(LABEL_SUMBER[PRIO.petugas]) ? 1 : f.sumber.startsWith(LABEL_SUMBER[PRIO.sipp]) ? 2 : 3;
    keluar.push({ kunci: d.kunciSaksi, nilai: f.nilai, yakin: f.yakin, prio, ket: f.bertentangan.length ? f.catatan : f.kutipan || `Fakta perkara (${f.sumber})` });
  }
  return keluar;
}

/** Nilai fakta (string) atau "" bila tidak ada. Praktis untuk pemanggil yang hanya butuh nilainya. */
const nilaiFakta = (hasil, kunci) => (hasil && hasil.fakta && hasil.fakta[kunci] ? hasil.fakta[kunci].nilai : "");
/** Nilai untuk kode variabel ABT (fakta yang sama dibaca dari kode mana pun). */
const nilaiKode = (hasil, kodeAbt) => (hasil && hasil.kode && hasil.kode[kodeBaku(kodeAbt)] ? hasil.kode[kodeBaku(kodeAbt)].nilai : "");

module.exports = {
  faktaPerkara,
  nilaiFakta,
  nilaiKode,
  kandidatUntukSaksi,
  muatPeta,
  faktaDariKode,
  timbang,
  kanon,
  sama,
  tulisBentuk,
  prioUsulan,
  bacaIsianAbt,
  PRIO,
  LABEL_SUMBER,
  PETA_BERKAS,
};
