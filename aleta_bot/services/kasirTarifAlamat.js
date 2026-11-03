"use strict";

/**
 * ============================================================================
 * TARIF PANGGILAN & PEMBERITAHUAN PER WILAYAH (Kasir ALETA, 3 Nov 2026)
 * ============================================================================
 *
 * Keputusan Derry 3 Nov 2026 23.00 atas analisis BIAYAALAMAT (jurnal
 * sipp_donggala 2024-2026): sejak panggilan lewat Pos (pekan 28 Okt 2024)
 * tarif seragam per KECAMATAN (97,5%) dan SATU tarif untuk semua jenis
 * (panggilan sidang, pemberitahuan putusan, ikrar, mediasi):
 *
 *   Kab. Donggala 14.500 kecuali Kec. Labuan 29.500, Kab. Sigi 29.500,
 *   Kota Palu 29.500, kabupaten lain Sulawesi Tengah 29.500 (Banggai 38.500),
 *   panggilan lewat RRI 200.000.
 *
 * Aturan lama belajar dari 18 bulan terakhir (bercampur era radius) dengan
 * ambang 60%. Aturan ini:
 *
 *   1. belajar HANYA dari baris sejak TANGGAL BERLAKU tarif (setelan, bawaan
 *      28 Okt 2024; per kabupaten dapat bergeser bila tarif baru diterima);
 *   2. kunci wilayah = KODE kecamatan SIPP (pihak.kecamatan "72.03.09"),
 *      bukan teks alamat;
 *   3. urutan saran: pihak yang sama di perkara itu -> kecamatan (>= 3 contoh,
 *      >= 80% sama) -> tabel kecamatan -> kabupaten (>= 5 contoh, >= 80%) ->
 *      tabel kabupaten -> tabel provinsi -> kosong (kasir mengisi);
 *   4. keyakinan "pasti" (pihak sama, atau kecamatan >= 10 contoh & >= 90%),
 *      selain itu "periksa";
 *   5. >= 5 baris BERTURUT-TURUT terbaru di satu kabupaten bernilai baru yang
 *      sama (berbeda dari tabel) -> tawaran "tarif baru sejak tanggal X?".
 *
 * Fungsi di berkas ini MURNI (tanpa basis data) - dipakai mesin usulan
 * (kasirJurnalService.susunUsulan), Kasir otomatis (lewat mesin yang sama),
 * dan uji. Setelannya disimpan kasirOtomatisService (baris id 2 tabel setelan
 * kasir yang sudah ada).
 */

const TANGGAL_BERLAKU_BAWAAN = "2024-10-28";
const KEC_LABUAN = "72.03.09";

/** Tabel bawaan: kode kecamatan (dd.dd.dd), kabupaten (dd.dd), provinsi (dd), "rri". */
const TARIF_BAWAAN = Object.freeze({
  [KEC_LABUAN]: 29500,
  "72.03": 14500,
  "72.10": 29500,
  "72.71": 29500,
  "72.01": 38500,
  72: 29500,
  rri: 200000,
});

/** Nama tampilan untuk kode di tabel bawaan (bila ref SIPP tidak terbaca). */
const NAMA_BAWAAN = Object.freeze({
  [KEC_LABUAN]: "Kec. Labuan",
  "72.03": "Kab. Donggala",
  "72.10": "Kab. Sigi",
  "72.71": "Kota Palu",
  "72.01": "Kab. Banggai",
  72: "Sulawesi Tengah",
  rri: "RRI",
});

/** Tarif Pos SEBELUM 28 Okt 2024 - nominal ini memicu peringatan lunak. */
const TARIF_LAMA = Object.freeze([14000, 29000]);

const AMBANG = Object.freeze({
  kecamatan: { n: 3, persen: 0.8 },
  kabupaten: { n: 5, persen: 0.8 },
  pasti: { n: 10, persen: 0.9 },
  rri: { n: 3, persen: 0.8 },
  tarifBaru: 5,
});

/** Jenis biaya panggilan/pemberitahuan pihak - SATU tarif untuk semuanya. */
const JENIS_TARIF_PIHAK = Object.freeze([12, 13, 14, 15, 29, 307, 308, 378, 379, 380, 381]);
const SET_JENIS = new Set(JENIS_TARIF_PIHAK);

const RE_KHUSUS = /RRI|PEMDA|radio|iklan|pengumuman/i;
const RE_DELEGASI = /PA\.|tabayun|delegasi/i;
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const bersih = (v) => (v === null || v === undefined ? "" : String(v).trim());
const angka = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const tanggalSah = (v) => {
  const t = bersih(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : "";
};

function kodeKecamatan(nilai) {
  const t = bersih(nilai);
  return /^\d{2}\.\d{2}\.\d{2}$/.test(t) ? t : "";
}

function kodeKabupaten(kabupaten, kecamatan) {
  const t = bersih(kabupaten);
  if (/^\d{2}\.\d{2}$/.test(t)) return t;
  const kec = kodeKecamatan(kecamatan);
  return kec ? kec.slice(0, 5) : "";
}

/** "28 Okt 2024". */
function tanggalTeks(iso) {
  const t = tanggalSah(iso);
  if (!t) return "";
  return `${Number(t.slice(8, 10))} ${BULAN[Number(t.slice(5, 7)) - 1]} ${t.slice(0, 4)}`;
}

/** "Rp29.500". */
function rupiah(n) {
  return `Rp${Math.round(angka(n)).toLocaleString("id-ID").replace(/,/g, ".")}`;
}

/** Ref SIPP "Kabupaten Donggala" -> "Kab. Donggala"; kecamatan "Labuan" -> "Kec. Labuan". */
function namaWilayah(kode, namaRef) {
  const k = bersih(kode);
  const n = bersih(namaRef);
  if (n) {
    if (/^\d{2}\.\d{2}\.\d{2}$/.test(k)) return /^kec/i.test(n) ? n : `Kec. ${n}`;
    return n.replace(/^Kabupaten\s+/i, "Kab. ");
  }
  return NAMA_BAWAAN[k] || (k ? `wilayah ${k}` : "");
}

/** Baris jurnal yang BUKAN tarif Pos biasa (RRI, PEMDA, iklan, delegasi/tabayun). */
function barisKhusus(uraian) {
  const u = bersih(uraian);
  return RE_KHUSUS.test(u) || RE_DELEGASI.test(u);
}

// ─── Setelan ────────────────────────────────────────────────────────────────

/**
 * Setelan tarif yang sah. Bentuk tersimpan (ringkas - kolom 300 huruf):
 *   { b: "2024-10-28", t: { kode: nilai }, s: { kab: "YYYY-MM-DD" }, x: { kab: nilai } }
 *   b = tanggal berlaku, t = tarif yang mengubah/menambah tabel bawaan,
 *   s = tanggal berlaku per kabupaten (tarif baru diterima), x = tawaran ditolak.
 */
function setelanSah(mentah) {
  const m = mentah && typeof mentah === "object" ? mentah : {};
  const berlaku = tanggalSah(m.berlaku || m.b) || TANGGAL_BERLAKU_BAWAAN;
  const tarif = {};
  for (const [k, v] of Object.entries(m.tarif || m.t || {})) {
    const kode = bersih(k);
    if (!/^(\d{2}(\.\d{2}){0,2}|rri)$/.test(kode)) continue;
    const n = Math.round(angka(v));
    if (n > 0 && n <= 10000000) tarif[kode] = n;
  }
  const sejak = {};
  for (const [k, v] of Object.entries(m.sejak || m.s || {})) {
    if (/^\d{2}\.\d{2}$/.test(bersih(k)) && tanggalSah(v)) sejak[bersih(k)] = tanggalSah(v);
  }
  const tolak = {};
  for (const [k, v] of Object.entries(m.tolak || m.x || {})) {
    if (/^\d{2}\.\d{2}$/.test(bersih(k)) && angka(v) > 0) tolak[bersih(k)] = Math.round(angka(v));
  }
  return { berlaku, tarif, sejak, tolak, diubahOleh: bersih(m.diubahOleh), diubah: bersih(m.diubah) };
}

/** Bentuk ringkas untuk disimpan (<= 300 huruf; tawaran ditolak terlama dibuang dulu). */
function setelanRingkas(setelan) {
  const s = setelanSah(setelan);
  const isi = { b: s.berlaku, t: s.tarif, s: s.sejak, x: s.tolak };
  let teks = JSON.stringify(isi);
  const kunciTolak = Object.keys(isi.x);
  while (teks.length > 300 && kunciTolak.length) {
    delete isi.x[kunciTolak.shift()];
    teks = JSON.stringify(isi);
  }
  return teks.length > 300 ? null : teks;
}

/** Tabel yang berlaku = bawaan ditimpa setelan. */
function tabelBerlaku(setelan) {
  return { ...TARIF_BAWAAN, ...setelanSah(setelan).tarif };
}

function berlakuUntuk(kabupaten, setelan) {
  const s = setelanSah(setelan);
  const kab = bersih(kabupaten);
  return (kab && s.sejak[kab]) || s.berlaku;
}

/** Daftar tabel untuk layar setelan (urut: kecamatan di bawah kabupatennya, RRI terakhir). */
function daftarTabel(setelan, nama = {}) {
  const s = setelanSah(setelan);
  const tabel = tabelBerlaku(s);
  const peringkat = (k) => (k === "rri" ? 3 : k.length === 2 ? 2 : 1); // kabupaten/kecamatan, lalu provinsi, lalu RRI
  const urut = Object.keys(tabel).sort((a, b) => peringkat(a) - peringkat(b) || a.localeCompare(b));
  return urut.map((kode) => ({
    kode,
    nama: namaWilayah(kode, nama[kode]),
    nilai: tabel[kode],
    bawaan: TARIF_BAWAAN[kode] === tabel[kode],
    sejak: kode.length === 5 ? s.sejak[kode] || "" : "",
  }));
}

// ─── Belajar dari jurnal satker ─────────────────────────────────────────────

/**
 * Sebaran tarif per kecamatan & kabupaten dari baris jurnal satker
 * ({ tanggal, kecamatan, kabupaten, jumlah, n, rri, khusus }) - HANYA baris
 * sejak tanggal berlaku (per kabupaten). Baris khusus (PEMDA, delegasi) tidak
 * dipelajari; RRI dipelajari terpisah. Baris tanpa tanggal (uji lama) ikut.
 */
function pelajari(baris, setelan) {
  const s = setelanSah(setelan);
  const hitung = { kecamatan: {}, kabupaten: {}, rri: {} };
  const tambah = (peta, kunci, jumlah, n) => {
    if (!kunci) return;
    peta[kunci] = peta[kunci] || {};
    peta[kunci][jumlah] = (peta[kunci][jumlah] || 0) + n;
  };
  for (const b of Array.isArray(baris) ? baris : []) {
    const jumlah = Math.round(angka(b.jumlah));
    const n = angka(b.n) || 1;
    if (!(jumlah > 0)) continue;
    const tanggal = tanggalSah(b.tanggal);
    if (Number(b.rri) || (b.uraian && /RRI/i.test(b.uraian))) {
      // (RRI bukan tarif Pos - tarif lama 14.000/29.000 tidak berlaku baginya)
      if (!tanggal || tanggal >= s.berlaku) tambah(hitung.rri, "rri", jumlah, n);
      continue;
    }
    if (Number(b.khusus) || (b.uraian && barisKhusus(b.uraian))) continue;
    // Tarif lama yang masih diketik sesudah tanggal berlaku (masa peralihan) bukan tarif wilayah.
    if (TARIF_LAMA.includes(jumlah)) continue;
    const kec = kodeKecamatan(b.kecamatan);
    const kab = kodeKabupaten(b.kabupaten, b.kecamatan);
    if (tanggal && tanggal < berlakuUntuk(kab, s)) continue;
    tambah(hitung.kecamatan, kec, jumlah, n);
    tambah(hitung.kabupaten, kab, jumlah, n);
  }
  const ringkas = (peta) => {
    const hasil = {};
    for (const [kunci, sebaran] of Object.entries(peta)) {
      let nilai = 0;
      let n = 0;
      let total = 0;
      for (const [v, c] of Object.entries(sebaran)) {
        total += c;
        if (c > n || (c === n && Number(v) > nilai)) {
          nilai = Number(v);
          n = c;
        }
      }
      hasil[kunci] = { nilai, n, total, persen: total ? n / total : 0 };
    }
    return hasil;
  };
  const r = ringkas(hitung.rri).rri || null;
  return { kecamatan: ringkas(hitung.kecamatan), kabupaten: ringkas(hitung.kabupaten), rri: r, berlaku: s.berlaku };
}

const lolos = (r, ambang) => Boolean(r && r.nilai > 0 && r.total >= ambang.n && r.persen >= ambang.persen);

/**
 * Bahan tarif untuk mesin usulan (k.tarif). Bentuk lama dipertahankan
 * (kecamatan/kabupaten: kode -> nilai yang lolos ambang) supaya pemakai lama
 * tetap jalan; bentuk baru: rinci, tabel, setelan, nama.
 */
function bahanTarif(belajar, setelan, kode = [], nama = {}) {
  const s = setelanSah(setelan);
  const kecamatan = {};
  const kabupaten = {};
  const rinci = { kecamatan: {}, kabupaten: {} };
  for (const k of kode) {
    const kec = kodeKecamatan(k.kecamatan);
    const kab = kodeKabupaten(k.kabupaten, k.kecamatan);
    const rk = kec && belajar.kecamatan[kec];
    const rb = kab && belajar.kabupaten[kab];
    if (rk) rinci.kecamatan[kec] = rk;
    if (rb) rinci.kabupaten[kab] = rb;
    if (lolos(rk, AMBANG.kecamatan)) kecamatan[kec] = rk.nilai;
    if (lolos(rb, AMBANG.kabupaten)) kabupaten[kab] = rb.nilai;
  }
  const tabel = tabelBerlaku(s);
  const rri = lolos(belajar.rri, AMBANG.rri) ? belajar.rri.nilai : tabel.rri || null;
  return { kecamatan, kabupaten, rinci, tabel, setelan: s, nama, rri };
}

// ─── Saran untuk satu pihak ─────────────────────────────────────────────────

function ketContoh(nama, sejak, contoh) {
  return `tarif ${nama} sejak ${tanggalTeks(sejak)}, ${contoh} contoh`;
}

/**
 * Tarif menurut wilayah pihak (tanpa riwayat pihak itu sendiri).
 * tarif = bentuk bahanTarif ATAU bentuk lama { kecamatan: {kode: nilai}, kabupaten }.
 * @returns {{ jumlah: number|null, tingkat: string, yakin: "pasti"|"periksa", wilayah: string, ket: string, kira: boolean, contoh: number }}
 */
function tarifWilayah(p, tarif) {
  const t = tarif || {};
  const kec = kodeKecamatan(p && p.kecamatan) || bersih(p && p.kecamatan);
  const kab = kodeKabupaten(p && p.kabupaten, p && p.kecamatan) || bersih(p && p.kabupaten);
  const nama = t.nama || {};
  const sejak = berlakuUntuk(kab, t.setelan);
  const rinci = t.rinci || null;
  const nm = (kode) => namaWilayah(kode, nama[kode]);
  // 1. kecamatan yang dipelajari
  const kecNilai = kec && t.kecamatan ? Number(t.kecamatan[kec]) : 0;
  if (kecNilai > 0) {
    const r = rinci && rinci.kecamatan[kec];
    const contoh = r ? r.total : 0;
    const pasti = Boolean(r && r.nilai === kecNilai && lolos(r, AMBANG.pasti));
    return {
      jumlah: kecNilai,
      tingkat: "kecamatan",
      yakin: pasti ? "pasti" : "periksa",
      wilayah: nm(kec),
      ket: contoh ? ketContoh(nm(kec), sejak, contoh) : `tarif terbanyak di ${nm(kec)}`,
      kira: false,
      contoh,
    };
  }
  const tabel = t.tabel || null;
  // 2. tabel kecamatan (mis. Kec. Labuan di Kab. Donggala) - lebih rinci daripada kabupaten
  if (tabel && kec && Number(tabel[kec]) > 0) {
    return { jumlah: Number(tabel[kec]), tingkat: "tabel", yakin: "periksa", wilayah: nm(kec), ket: `tabel tarif ${nm(kec)} ${rupiah(tabel[kec])}`, kira: true, contoh: 0 };
  }
  // 3. kabupaten yang dipelajari
  const kabNilai = kab && t.kabupaten ? Number(t.kabupaten[kab]) : 0;
  if (kabNilai > 0) {
    const r = rinci && rinci.kabupaten[kab];
    const contoh = r ? r.total : 0;
    return {
      jumlah: kabNilai,
      tingkat: "kabupaten",
      yakin: "periksa",
      wilayah: nm(kab),
      ket: contoh ? ketContoh(nm(kab), sejak, contoh) : `tarif terbanyak di ${nm(kab)}`,
      kira: true,
      contoh,
    };
  }
  // 4. tabel kabupaten, lalu provinsi
  if (tabel) {
    for (const kode of [kab, kab ? kab.slice(0, 2) : ""]) {
      if (kode && Number(tabel[kode]) > 0) {
        return { jumlah: Number(tabel[kode]), tingkat: "tabel", yakin: "periksa", wilayah: nm(kode), ket: `tabel tarif ${nm(kode)} ${rupiah(tabel[kode])}`, kira: true, contoh: 0 };
      }
    }
  }
  return { jumlah: null, tingkat: "kosong", yakin: "periksa", wilayah: kec ? nm(kec) : kab ? nm(kab) : "", ket: "tarif wilayah pihak belum diketahui - isi nominalnya", kira: false, contoh: 0 };
}

/**
 * Saran tarif panggilan/pemberitahuan untuk satu pihak - SATU tarif untuk
 * semua jenis (panggilan sidang, pemberitahuan putusan, ikrar, mediasi).
 * Riwayat pihak itu sendiri di perkara ini (baris sejak tanggal berlaku) menang.
 *
 * @returns {{ jumlah: number|null, asal: string, kira: boolean, tarif: { nilai: number|null, yakin: string, ket: string, wilayah: string, tingkat: string } }}
 */
function saranTarifPihak(p, jurnal, tarif) {
  const t = tarif || {};
  const kab = kodeKabupaten(p && p.kabupaten, p && p.kecamatan);
  const sejak = berlakuUntuk(kab, t.setelan);
  const hitung = {};
  for (const b of Array.isArray(jurnal) ? jurnal : []) {
    if (!p || Number(b.pihakId) !== Number(p.pihakId) || !(Number(p.pihakId) > 0)) continue;
    if (!SET_JENIS.has(Number(b.jenisBiayaId))) continue;
    if (barisKhusus(b.uraian) || !(angka(b.jumlah) > 0)) continue;
    const tg = tanggalSah(b.tanggal);
    if (tg && tg < sejak) continue;
    const j = Math.round(angka(b.jumlah));
    if (TARIF_LAMA.includes(j)) continue; // tarif lama yang terketik di masa peralihan tidak diwariskan
    hitung[j] = (hitung[j] || 0) + 1;
  }
  let sendiri = 0;
  let n = 0;
  for (const [v, c] of Object.entries(hitung)) {
    if (c > n) {
      sendiri = Number(v);
      n = c;
    }
  }
  if (sendiri > 0) {
    return {
      jumlah: sendiri,
      asal: "tarif panggilan pihak ini sebelumnya",
      kira: false,
      tarif: { nilai: sendiri, yakin: "pasti", tingkat: "pihak", wilayah: "pihak ini", ket: `tarif pihak ini di perkara ini (${n} baris)` },
    };
  }
  const w = tarifWilayah(p, t);
  const asal =
    w.tingkat === "kecamatan"
      ? "tarif terbanyak di kecamatan pihak"
      : w.tingkat === "kabupaten"
        ? "tarif terbanyak di kabupaten pihak (perkiraan - periksa)"
        : w.tingkat === "tabel"
          ? `tabel tarif ${w.wilayah} (perkiraan - periksa)`
          : "tarif belum diketahui - isi jumlahnya";
  return { jumlah: w.jumlah, asal, kira: w.kira, tarif: { nilai: w.jumlah, yakin: w.yakin, tingkat: w.tingkat, wilayah: w.wilayah, ket: w.ket } };
}

/** Tarif RRI (dipelajari, lalu tabel). */
function saranTarifRri(tarif) {
  const t = tarif || {};
  const nilai = Number(t.rri) > 0 ? Number(t.rri) : null;
  return { jumlah: nilai, tarif: { nilai, yakin: nilai ? "periksa" : "periksa", tingkat: "rri", wilayah: "RRI", ket: nilai ? `tarif panggilan lewat RRI ${rupiah(nilai)}` : "tarif RRI belum diketahui - isi nominalnya" } };
}

// ─── Peringatan lunak ───────────────────────────────────────────────────────

/**
 * Nominal yang diketik kasir berbeda dari tarif wilayah, atau masih tarif lama
 * (14.000/29.000). TIDAK menahan simpan - satu baris kecil + tautan "pakai".
 * @returns {{ teks: string, pakai: number|null } | null}
 */
function peringatanNominal(nilai, tarif) {
  const n = Math.round(angka(nilai));
  const t = tarif && typeof tarif === "object" ? tarif : null;
  const saran = t && Number(t.nilai) > 0 ? Number(t.nilai) : null;
  if (!(n > 0)) return null;
  if (TARIF_LAMA.includes(n)) {
    return { teks: saran ? `Tarif lama - ${t.wilayah || "wilayah ini"} ${rupiah(saran)}` : `${rupiah(n)} tarif lama (sebelum ${tanggalTeks(TANGGAL_BERLAKU_BAWAAN)})`, pakai: saran };
  }
  if (saran && n !== saran && t.tingkat !== "rri") return { teks: `Tarif ${t.wilayah || "wilayah ini"} biasanya ${rupiah(saran)}`, pakai: saran };
  return null;
}

// ─── Tawaran tarif baru ─────────────────────────────────────────────────────

/** Nilai yang diharapkan tabel untuk satu baris (kecamatan > kabupaten > provinsi). */
function harapanTabel(tabel, kec, kab) {
  for (const kode of [kec, kab, kab ? kab.slice(0, 2) : ""]) if (kode && Number(tabel[kode]) > 0) return Number(tabel[kode]);
  return null;
}

/**
 * >= 5 baris BERTURUT-TURUT TERBARU di satu kabupaten memakai nilai baru yang
 * sama (berbeda dari tabel, bukan tarif lama, bukan yang sudah ditolak) ->
 * tawaran { kabupaten, nama, nilai, sejak, contoh }. Baris diurutkan menurut
 * tanggal (baris bertanggal sama dihitung n kali).
 */
function deteksiTarifBaru(baris, setelan, nama = {}) {
  const s = setelanSah(setelan);
  const tabel = tabelBerlaku(s);
  const perKab = {};
  for (const b of Array.isArray(baris) ? baris : []) {
    const jumlah = Math.round(angka(b.jumlah));
    const tanggal = tanggalSah(b.tanggal);
    if (!(jumlah > 0) || !tanggal || Number(b.rri) || Number(b.khusus)) continue;
    if (b.uraian && barisKhusus(b.uraian)) continue;
    const kec = kodeKecamatan(b.kecamatan);
    const kab = kodeKabupaten(b.kabupaten, b.kecamatan);
    if (!kab || tanggal < berlakuUntuk(kab, s)) continue;
    const harap = harapanTabel(tabel, kec, kab);
    if (!harap) continue;
    (perKab[kab] = perKab[kab] || []).push({ tanggal, jumlah, n: angka(b.n) || 1, harap });
  }
  const tawaran = [];
  for (const [kab, daftar] of Object.entries(perKab)) {
    daftar.sort((a, b) => b.tanggal.localeCompare(a.tanggal)); // terbaru dulu
    let nilai = 0;
    let contoh = 0;
    let sejak = "";
    for (const r of daftar) {
      if (r.jumlah === r.harap) break;
      if (!nilai) nilai = r.jumlah;
      if (r.jumlah !== nilai) break;
      contoh += r.n;
      sejak = r.tanggal;
    }
    if (contoh < AMBANG.tarifBaru || TARIF_LAMA.includes(nilai) || s.tolak[kab] === nilai) continue;
    tawaran.push({ kabupaten: kab, nama: namaWilayah(kab, nama[kab]), nilai, lama: harapanTabel(tabel, "", kab), sejak, contoh });
  }
  return tawaran.sort((a, b) => b.sejak.localeCompare(a.sejak));
}

/** Setelan sesudah tawaran DITERIMA (tarif kabupaten = nilai, berlaku sejak tanggal itu). */
function terimaTarifBaru(setelan, tawaran) {
  const s = setelanSah(setelan);
  const kab = bersih(tawaran && tawaran.kabupaten);
  const nilai = Math.round(angka(tawaran && tawaran.nilai));
  const sejak = tanggalSah(tawaran && tawaran.sejak);
  if (!/^\d{2}\.\d{2}$/.test(kab) || !(nilai > 0) || !sejak) return null;
  const tolak = { ...s.tolak };
  delete tolak[kab];
  return setelanSah({ ...s, tarif: { ...s.tarif, [kab]: nilai }, sejak: { ...s.sejak, [kab]: sejak }, tolak });
}

/** Setelan sesudah tawaran DITOLAK (nilai itu tidak ditawarkan lagi untuk kabupaten itu). */
function tolakTarifBaru(setelan, tawaran) {
  const s = setelanSah(setelan);
  const kab = bersih(tawaran && tawaran.kabupaten);
  const nilai = Math.round(angka(tawaran && tawaran.nilai));
  if (!/^\d{2}\.\d{2}$/.test(kab) || !(nilai > 0)) return null;
  return setelanSah({ ...s, tolak: { ...s.tolak, [kab]: nilai } });
}

module.exports = {
  TANGGAL_BERLAKU_BAWAAN,
  KEC_LABUAN,
  TARIF_BAWAAN,
  TARIF_LAMA,
  AMBANG,
  JENIS_TARIF_PIHAK,
  kodeKecamatan,
  kodeKabupaten,
  namaWilayah,
  tanggalTeks,
  barisKhusus,
  setelanSah,
  setelanRingkas,
  tabelBerlaku,
  berlakuUntuk,
  daftarTabel,
  pelajari,
  bahanTarif,
  tarifWilayah,
  saranTarifPihak,
  saranTarifRri,
  peringatanNominal,
  deteksiTarifBaru,
  terimaTarifBaru,
  tolakTarifBaru,
};
