"use strict";

/**
 * ============================================================================
 * MESIN DETEKSI ALASAN (P1), FAKTA WAKTU (P2), PELAKU (P3), KESESUAIAN SAKSI (S6)
 * ============================================================================
 *
 * 10 Okt 2026, paket "deteksi lengkap" agen 1. Seluruh pola dibaca dari kamus
 * (kamus-deteksi/awal/{alasan,waktu,pelaku}.json + lapis database) lewat
 * kamusDeteksi.polaKelompok - tidak ada pola tertulis-mati di berkas ini.
 *
 * Yang dihasilkan selalu USULAN. Huruf alasan perceraian menunjuk dasar hukum
 * (bunyi resminya di abtAturanAlasan.js) dan tetap dipilih manusia.
 *
 *   P1  sebab per kalimat (ekonomi/nafkah, judi, mabuk, narkoba, KDRT,
 *       selingkuh, meninggalkan, penjara, cacat, taklik, murtad, campur
 *       tangan keluarga, beda prinsip, merantau/LDR, kawin paksa, ...) dan
 *       huruf yang ditunjuknya (kunci pola = huruf A-H).
 *   P2  petunjuk waktu yang belum dapat mengisi variabel ("sejak bulan Maret"
 *       tanpa tahun, "sejak lebaran") - disebut di catatan kartu, tidak diisi.
 *   P3  subjek perbuatan per kalimat (siapa pergi, memukul, tidak menafkahi,
 *       selingkuh) - pelaku = 0047 = Tergugat/Termohon, lawan = 0046 =
 *       Penggugat/Pemohon. Penentu subjeknya pelakuSatuKata (abtUsulanService).
 *   S6  per huruf & per fakta: kedua saksi sama / berbeda / hanya satu saksi
 *       (unus testis nullus testis).
 *
 * abtUsulanService memanggil berkas ini; sebaliknya berkas ini memanggil
 * abtUsulanService hanya di dalam fungsi (require tertunda) - tidak ada
 * putaran saat dimuat.
 */

const kamus = require("./kamusDeteksi");

/** require tertunda: abtUsulanService memuat berkas ini di kepalanya. */
function layananUsulan() {
  return require("./abtUsulanService");
}

// ============================================================================
// PEMBACA KAMUS PER KUNCI
// ============================================================================

/**
 * Singgahan polaKelompok SELAMA SATU PEKERJAAN SINKRON. polaKelompok menyusun ulang
 * daftarnya tiap dipanggil (terukur 2,8 md per perkara bila dipanggil di tiap
 * kalimat). Singgahannya dikosongkan pada microtask berikutnya - pemuat lapis database
 * (asinkron) selalu jatuh di pekerjaan lain - dan seketika bila aturLapisDatabase /
 * lupakan dipanggil lewat objek modul kamus (mis. dari uji yang sinkron).
 */
const singgahan = new Map();
let pembersihTerjadwal = false;
function kosongkanSinggahan() {
  singgahan.clear();
  pembersihTerjadwal = false;
}
for (const nama of ["aturLapisDatabase", "lupakan"]) {
  const asli = kamus[nama];
  if (typeof asli === "function" && !asli.__deteksiAlasan) {
    const pembungkus = function (...argumen) {
      kosongkanSinggahan();
      return asli.apply(this, argumen);
    };
    pembungkus.__deteksiAlasan = true;
    kamus[nama] = pembungkus;
  }
}
function polaKelompok(kelompok) {
  if (!singgahan.has(kelompok)) {
    // Keputusan orkestrator 10 Okt: hanya status "aktif" (atau tanpa status) yang mendeteksi; "draf"
    // menunggu tinjauan. Disaring juga di sini agar berlaku walau pemuat kamus versi lama.
    singgahan.set(kelompok, kamus.polaKelompok(kelompok).filter((p) => (p.status || "aktif") === "aktif"));
    if (!pembersihTerjadwal) {
      pembersihTerjadwal = true;
      queueMicrotask(kosongkanSinggahan);
    }
  }
  return singgahan.get(kelompok);
}

/**
 * Penguji satu kelompok, dibangun SEKALI per panggilan tingkat atas (polaKelompok
 * menyusun ulang daftarnya tiap dipanggil). Pola sekunci digabung: uji() benar bila
 * salah satu cocok; cocok() mencoba berurutan (ruas `urut`) dan memulangkan hasil
 * match pertama - untuk pola bergugus tangkap.
 */
function penguji(kelompok) {
  const kunciSinggah = `penguji:${kelompok}`;
  if (singgahan.has(kunciSinggah)) return singgahan.get(kunciSinggah);
  const perKunci = new Map();
  for (const p of polaKelompok(kelompok)) {
    if (!perKunci.has(p.kunci)) perKunci.set(p.kunci, []);
    perKunci.get(p.kunci).push(p);
  }
  for (const daftar of perKunci.values()) daftar.sort((a, b) => (a.urut || 0) - (b.urut || 0));
  const ambil = (kunci) => perKunci.get(kunci) || [];
  const hasil = {
    pola: ambil,
    uji: (kunci, teks) => ambil(kunci).some((p) => p.re.test(String(teks || ""))),
    /** Indeks kecocokan paling awal di antara pola sekunci, atau -1. */
    cari: (kunci, teks) => {
      let i = -1;
      for (const p of ambil(kunci)) {
        const j = String(teks || "").search(p.re);
        if (j >= 0 && (i < 0 || j < i)) i = j;
      }
      return i;
    },
    cocok: (kunci, teks) => {
      for (const p of ambil(kunci)) {
        const m = String(teks || "").match(p.re);
        if (m) return m;
      }
      return null;
    },
  };
  singgahan.set(kunciSinggah, hasil);
  return hasil;
}

// ============================================================================
// P1 - SEBAB DAN HURUF
// ============================================================================

/** Sebab tanpa pelaku: tidak dinilai subjeknya (keluarga, keadaan, kedua pihak). */
const SEBAB_TANPA_PELAKU = new Set([
  "perselisihan terus-menerus",
  "masalah ekonomi",
  "campur tangan keluarga",
  "beda prinsip",
  "kawin paksa",
]);

/** Baris CIRI_ALASAN (bentuk lama {kunci, kata, hanyaDeteksi}) dari pola kamus berjenis "ciri". */
function ciriAlasanDariKamus() {
  return polaKelompok("alasan")
    .filter((p) => p.jenis === "ciri" && Array.isArray(p.kata) && p.kata.length && p.sebab)
    .map((p) => (p.hanyaDeteksi ? { kunci: p.sebab, kata: [...p.kata], hanyaDeteksi: true } : { kunci: p.sebab, kata: [...p.kata] }));
}

/** Sidik daftar ciri - berubah bila lapis database menambah/mematikan/mengubah baris ciri. */
function sidikCiri(daftar) {
  return daftar.map((b) => `${b.kunci}\u0001${b.kata.join("\u0002")}\u0001${b.hanyaDeteksi ? 1 : 0}`).join("\u0003");
}

/** Semua letak kecocokan satu pola dalam kalimat huruf kecil (untuk menilai subjek). */
function letakCocok(p, kalimat, kecil) {
  if (p.jenis === "ciri" && Array.isArray(p.kata)) {
    const kata = p.kata[0];
    const letak = [];
    // Bentuk pasif ("dipukul") tidak dinilai subjeknya - sama dengan pelakuCiri lama.
    if (/^di[a-z]/.test(kata)) return letak;
    for (let i = kecil.indexOf(kata); i >= 0; i = kecil.indexOf(kata, i + 1)) letak.push(i);
    return letak;
  }
  const bendera = (p.flags || "").includes("g") ? p.flags : `${p.flags || ""}g`;
  const letak = [];
  for (const m of kalimat.matchAll(new RegExp(p.regex, bendera))) {
    if (/^di[a-z]/i.test(m[0])) continue;
    letak.push(m.index);
    if (m[0] === "") break;
  }
  return letak;
}

/* === KDL2 11 Okt === */
/** Rentang [awal, akhir) tiap penyangkal-letak yang cocok, per sebab. */
function rentangPenyangkal(daftar, teks) {
  const peta = new Map();
  for (const p of daftar) {
    const bendera = (p.flags || "").includes("g") ? p.flags : `${p.flags || ""}g`;
    for (const m of teks.matchAll(new RegExp(p.regex, bendera))) {
      if (!m[0]) break;
      if (!peta.has(p.sebab)) peta.set(p.sebab, []);
      peta.get(p.sebab).push([m.index, m.index + m[0].length]);
    }
  }
  return peta;
}

/** Semua letak kecocokan pola (termasuk bentuk pasif) - untuk diuji terhadap rentang penyangkal. */
function letakSemua(p, teks, kecil) {
  const letak = [];
  if (p.jenis === "ciri" && Array.isArray(p.kata)) {
    const kata = p.kata[0];
    for (let i = kecil.indexOf(kata); i >= 0; i = kecil.indexOf(kata, i + 1)) letak.push(i);
    return letak;
  }
  const bendera = (p.flags || "").includes("g") ? p.flags : `${p.flags || ""}g`;
  for (const m of teks.matchAll(new RegExp(p.regex, bendera))) {
    letak.push(m.index);
    if (m[0] === "") break;
  }
  return letak;
}

/** true bila SETIAP kecocokan pola jatuh di dalam salah satu rentang penyangkal. */
function semuaDisangkal(p, teks, kecil, daftarRentang) {
  const letak = letakSemua(p, teks, kecil);
  return letak.length > 0 && letak.every((i) => daftarRentang.some(([a, b]) => i >= a && i < b));
}
/* === AKHIR KDL2 === */

/**
 * Sebab yang terbaca pada sekumpulan kalimat (satu saksi, atau posita).
 *
 * Baris "ciri" dinilai PERSIS seperti 5227 (barisBerlaku: kata lengkap dalam satu
 * kalimat + saringan menikah-lagi), baris "tambahan" dengan regex-nya. Subjek tiap
 * kecocokan dinilai pelakuSatuKata; satu kecocokan oleh pelaku cukup.
 *
 * @returns {Array<{sebab, huruf, pola: string[], kalimat, pelaku: ""|"pelaku"|"lawan"|"tuduhan", yakin}>}
 */
function sebabDariButir(butir, opsi) {
  const o = opsi || {};
  const usul = layananUsulan();
  const pola = o.pola || polaKelompok("alasan");
  const ciri = pola.filter((p) => p.jenis === "ciri" && Array.isArray(p.kata)).map((p) => ({ kunci: p.sebab, kata: p.kata }));
  const uj = o.ujiPelaku || penguji("pelaku");
  const penyangkal = pola.filter((p) => p.jenis === "penyangkal" && p.sebab);
  /* === KDL2 11 Okt === */
  // Penyangkal bercakupan "letak" hanya memadamkan kecocokan yang JATUH di dalam
  // rentangnya ("Tergugat tidak pernah memukul" - kata "memukul" di dalam rentang
  // penyangkal), bukan seluruh kalimat: "sering memukul ... tetapi tidak pernah memukul
  // anak" tetap menyala. Penyangkal lama (tanpa cakupan) tetap sekalimat.
  const penyangkalKalimat = penyangkal.filter((p) => p.cakupan !== "letak");
  const penyangkalLetak = penyangkal.filter((p) => p.cakupan === "letak");
  /* === AKHIR KDL2 === */
  const peta = new Map();
  for (const kalimat of butir || []) {
    const teks = String(kalimat || "");
    const kecil = teks.toLowerCase();
    // Pola berjenis "penyangkal" ("tidak pernah keluar dari agama Islam") memadamkan
    // sebabnya untuk KALIMAT itu saja - di mesin ini, bukan di 5227 (perilaku lama dijaga).
    const disangkal = new Set(penyangkalKalimat.filter((p) => p.re.test(teks)).map((p) => p.sebab));
    /* === KDL2 11 Okt === */
    const rentang = rentangPenyangkal(penyangkalLetak, teks);
    /* === AKHIR KDL2 === */
    for (const p of pola) {
      if (!p.sebab || p.jenis === "penyangkal" || disangkal.has(p.sebab)) continue;
      const cocok =
        p.jenis === "ciri" && Array.isArray(p.kata)
          ? usul.barisBerlaku(kecil, { kunci: p.sebab, kata: p.kata }, ciri)
          : p.re.test(teks);
      if (!cocok) continue;
      /* === KDL2 11 Okt === */
      if (rentang.has(p.sebab) && semuaDisangkal(p, teks, kecil, rentang.get(p.sebab))) continue;
      /* === AKHIR KDL2 === */
      let s = peta.get(p.sebab);
      if (!s) {
        s = { sebab: p.sebab, huruf: p.kunci || "", pola: [], kalimat: teks, sisi: new Set(), yakin: "ragu" };
        peta.set(p.sebab, s);
      }
      if (!s.pola.includes(p.kode)) s.pola.push(p.kode);
      if (p.yakin === "pasti") s.yakin = "pasti";
      if (!SEBAB_TANPA_PELAKU.has(p.sebab)) {
        for (const i of letakCocok(p, teks, kecil)) s.sisi.add(usul.pelakuSatuKata(kecil, i, uj));
      }
    }
  }
  return Array.from(peta.values()).map((s) => {
    const pelaku = s.sisi.has("pelaku") ? "pelaku" : s.sisi.has("lawan") ? "lawan" : s.sisi.has("tuduhan") ? "tuduhan" : "";
    return { sebab: s.sebab, huruf: s.huruf, pola: s.pola, kalimat: s.kalimat, pelaku, yakin: s.yakin };
  });
}

/** Sebab dari teks bebas (BAS berbutir, isian 5227, posita polos). */
function sebabDariTeks(teks, opsi) {
  return sebabDariButir(layananUsulan().butirKeterangan(teks), opsi);
}

/** Huruf yang langsung ditunjuk sebab (bukan F-penyebab). Sebab lain berkunci F hanya MENYEBABKAN perselisihan. */
const HURUF_LANGSUNG = {
  zina: "A",
  mabuk: "A",
  judi: "A",
  "obat terlarang": "A",
  "salah satu pihak menjalani pidana penjara": "C",
  "kekerasan dalam rumah tangga": "D",
  "cacat badan atau penyakit": "E",
  "perselisihan terus-menerus": "F",
  "pelanggaran taklik talak": "G",
  "murtad/pindah agama": "H",
};

/** Sebab yang menunjuk huruf itu, dan bukan perbuatan pihak yang mengajukan / tuduhan terhadapnya. */
function sebabHuruf(daftarSebab, huruf) {
  // 30 Okt (keputusan sementara sesi utama): huruf H berlaku bagi SALAH SATU pihak - murtad oleh pihak yang mengajukan
  // sendiri tetap diusulkan (selaras paket ABT murtad-8529 yang membaca pihak murtad dua arah). Huruf lain tetap
  // menolak perbuatan pihak yang mengajukan. Tuduhan tidak pernah memicu.
  return (daftarSebab || []).filter((s) => HURUF_LANGSUNG[s.sebab] === huruf && s.pelaku !== "tuduhan" && (s.pelaku !== "lawan" || huruf === "H"));
}

const LABEL_STATUS = {
  sama: "kedua saksi sama",
  berbeda: "saksi berbeda",
  "satu saksi": "hanya satu saksi",
  "tidak ada": "tidak diterangkan saksi",
};

function labelStatus(status, saksiTunggal) {
  if (status === "satu saksi" && saksiTunggal) return `hanya saksi ${saksiTunggal}`;
  return LABEL_STATUS[status] || "";
}

/**
 * S6 untuk satu huruf. Kedua saksi "sama" bila keduanya menerangkan SEBAB YANG
 * SAMA untuk huruf itu (untuk B: keduanya menyebut lama pisah >= 24 bulan).
 * "berbeda": satu saksi menyebut perbuatan itu oleh pelaku, saksi lain oleh pihak
 * yang mengajukan; atau (B) satu saksi >= 24 bulan, yang lain menyebut kurang.
 */
function kesesuaianHuruf(huruf, s1, s2, lama1, lama2) {
  if (huruf === "B") {
    const a = Number.isFinite(lama1) ? lama1 : null;
    const b = Number.isFinite(lama2) ? lama2 : null;
    const ya1 = a !== null && a >= 24;
    const ya2 = b !== null && b >= 24;
    const status = ya1 && ya2 ? "sama" : (ya1 && b !== null) || (ya2 && a !== null) ? "berbeda" : ya1 || ya2 ? "satu saksi" : "tidak ada";
    const tunggal = status === "satu saksi" ? (ya1 ? 1 : 2) : 0;
    return {
      status,
      label: status === "berbeda" ? "lama pisah berbeda antar saksi" : labelStatus(status, tunggal),
      saksi1: a !== null ? [`lama pisah ${a} bulan`] : [],
      saksi2: b !== null ? [`lama pisah ${b} bulan`] : [],
    };
  }
  const h1 = sebabHuruf(s1, huruf).map((x) => x.sebab);
  const h2 = sebabHuruf(s2, huruf).map((x) => x.sebab);
  const sama = h1.filter((x) => h2.includes(x));
  // Pelaku bertentangan: saksi 1 "Tergugat berjudi", saksi 2 "Penggugat berjudi".
  const bertentangan = (s1 || [])
    .filter((x) => HURUF_LANGSUNG[x.sebab] === huruf && x.pelaku)
    .some((x) => (s2 || []).some((y) => y.sebab === x.sebab && y.pelaku && y.pelaku !== x.pelaku));
  const status = bertentangan ? "berbeda" : sama.length ? "sama" : h1.length && h2.length ? "berbeda" : h1.length || h2.length ? "satu saksi" : "tidak ada";
  const tunggal = status === "satu saksi" ? (h1.length ? 1 : 2) : 0;
  const label = bertentangan ? "pelaku berbeda antar saksi" : status === "berbeda" ? "sebab berbeda antar saksi" : labelStatus(status, tunggal);
  return { status, label, saksi1: h1, saksi2: h2, sama };
}

/**
 * Huruf yang diusulkan mesin P1 - aturan keputusan pengguna 11 yang sama dengan
 * abtAturanAlasan.usulkanUntukBlangko01, atas sebab yang dibaca pola kamus:
 *   F  perselisihan diterangkan saksi mana pun
 *   B  lama pisah (9944 gabungan) >= 24 bulan
 *   A, C, D, E, G, H  sebab yang SAMA diterangkan kedua saksi, bukan perbuatan
 *      pihak yang mengajukan, dan didalilkan posita (bila posita terbaca)
 */
function usulHuruf({ s1, s2, posita, lamaPisahBulan }) {
  const hasil = [];
  for (const huruf of "ABCDEFGH") {
    let usul = false;
    let pemicu = [];
    if (huruf === "F") {
      pemicu = [...sebabHuruf(s1, "F"), ...sebabHuruf(s2, "F")].map((x) => x.sebab).filter((x, i, a) => a.indexOf(x) === i);
      usul = pemicu.length > 0;
    } else if (huruf === "B") {
      usul = Number.isFinite(lamaPisahBulan) && lamaPisahBulan >= 24;
      if (usul) pemicu = [`lama pisah ${lamaPisahBulan} bulan`];
    } else {
      const a = sebabHuruf(s1, huruf).map((x) => x.sebab);
      const b = sebabHuruf(s2, huruf).map((x) => x.sebab);
      const dalil = posita ? sebabHuruf(posita, huruf).map((x) => x.sebab) : null;
      pemicu = a.filter((x) => b.includes(x) && (!dalil || dalil.includes(x)));
      usul = pemicu.length > 0;
    }
    hasil.push({ huruf, usul, pemicu });
  }
  return hasil;
}

// ============================================================================
// P2 - PETUNJUK WAKTU YANG TIDAK DAPAT MENGISI VARIABEL
// ============================================================================

/**
 * "sejak bulan Maret" (tanpa tahun), "sejak lebaran" - dalam kalimat konflik
 * (0222) atau pisah (0246). Tidak pernah mengisi variabel: tahunnya tidak ada
 * atau tanggalnya berpindah tiap tahun. Dipulangkan untuk catatan kartu.
 *
 * @param {"0222"|"0246"} variabel
 * @returns {{kode, teks, kalimat}|null}
 */
function petunjukWaktu(butir, variabel, ujWaktu, tanggalSidang, opsi) {
  const uj = ujWaktu || penguji("waktu");
  const konteks = variabel === "0222" ? (b) => uj.uji("konflik", b) : (b) => uj.uji("pisah-rumah", b) || uj.uji("pisah-kata", b);
  for (const b of butir || []) {
    if (!konteks(b)) continue;
    /* === KDL2 11 Okt === */
    // "sejak-lalu" (N tahun/bulan yang lalu) dan "setelah-menikah" (N bulan setelah menikah) ditambah;
    // perkiraannya dari tanggal sidang / tanggal nikah posita - tetap petunjuk, tidak mengisi variabel.
    for (const kunci of ["sejak-bulan-tanpa-tahun", "sejak-hari-raya", "sejak-lalu", "setelah-menikah"]) {
    /* === AKHIR KDL2 === */
      for (const p of uj.pola(kunci)) {
        if (Array.isArray(p.variabel) && !p.variabel.includes(variabel)) continue;
        const m = String(b).match(p.re);
        if (!m) continue;
        const hasil = { kode: p.kode, teks: m[0].trim(), kalimat: b };
        // "sejak bulan Januari ... sudah sekitar 1 tahun 2 bulan" + tanggal sidang -> tahun perkiraan.
        if (kunci === "sejak-bulan-tanpa-tahun") {
          const perkiraan = tahunPerkiraan(m[1], String(b).slice(m.index + m[0].length), tanggalSidang, uj);
          if (perkiraan) hasil.perkiraan = perkiraan;
        }
        /* === KDL2 11 Okt === */
        if (kunci === "sejak-hari-raya") {
          const perkiraan = bulanHariRaya(m[1], m[2], tanggalSidang);
          if (perkiraan) hasil.perkiraan = perkiraan;
        }
        if (kunci === "sejak-lalu") {
          const perkiraan = mundurDari(m, tanggalSidang);
          if (perkiraan) hasil.perkiraan = perkiraan;
        }
        if (kunci === "setelah-menikah") {
          const perkiraan = majuDariNikah(m, opsi && opsi.tanggalNikah);
          if (perkiraan) hasil.perkiraan = perkiraan;
        }
        /* === AKHIR KDL2 === */
        return hasil;
      }
    }
  }
  return null;
}

/* === HARI RAYA 27 Okt === */
// Bulan (1-12, Masehi) jatuhnya 1 Ramadan, 1 Syawal (Idul Fitri), dan 10 Zulhijjah (Idul Adha) menurut kalender hijriah
// resmi; perkiraan bulan saja (hari dapat bergeser satu hari menurut rukyat) untuk petunjuk waktu 0222/0246.
const BULAN_RAYA = {
  2018: { ramadan: 5, fitri: 6, adha: 8 }, 2019: { ramadan: 5, fitri: 6, adha: 8 }, 2020: { ramadan: 4, fitri: 5, adha: 7 },
  2021: { ramadan: 4, fitri: 5, adha: 7 }, 2022: { ramadan: 4, fitri: 5, adha: 7 }, 2023: { ramadan: 3, fitri: 4, adha: 6 },
  2024: { ramadan: 3, fitri: 4, adha: 6 }, 2025: { ramadan: 3, fitri: 3, adha: 6 }, 2026: { ramadan: 2, fitri: 3, adha: 5 },
  2027: { ramadan: 2, fitri: 3, adha: 5 },
};

/** "Lebaran 2024" -> "bulan April 2024"; null bila tahunnya tak diketahui/di luar tabel. */
function bulanHariRaya(token, tahunKata, tanggalSidang) {
  const t = String(token || "").toLowerCase();
  const k = String(tahunKata || "").toLowerCase();
  const sidang = uraiBulanTahun(tanggalSidang);
  let tahun = /^\d{4}$/.test(k) ? Number(k) : k === "ini" && sidang ? sidang.tahun : /^(lalu|kemarin)$/.test(k) && sidang ? sidang.tahun - 1 : 0;
  if (!tahun) return "";
  let bulan = 0;
  if (/tahun\s+baru/.test(t)) bulan = 1;
  else if (/natal/.test(t)) bulan = 12;
  else if (BULAN_RAYA[tahun]) {
    const r = BULAN_RAYA[tahun];
    bulan = /puasa|ramadh?an/.test(t) ? r.ramadan : /adha/.test(t) ? r.adha : r.fitri;
  }
  if (!bulan) return "";
  const nama = NAMA_BULAN[bulan - 1];
  return `bulan ${nama.charAt(0).toUpperCase()}${nama.slice(1)} ${tahun}`;
}
/* === AKHIR HARI RAYA === */

/* === KDL2 11 Okt === */
const ANGKA_KATA_LUAS = { ...{ satu: 1, se: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10, sebelas: 11 }, setahun: 1, sebulan: 1 };

/** Angka & satuan dari gugus bernama `angka`/`satuan` (atau 1/2); "tahun lalu" tanpa angka = 1. */
function angkaSatuan(m) {
  const g = (m && m.groups) || {};
  const mentah = String(g.angka || m[1] || "").toLowerCase();
  const satuan = String(g.satuan || m[2] || "").toLowerCase();
  if (!satuan) return null;
  const angka = !mentah ? 1 : /^\d+$/.test(mentah) ? Number(mentah) : ANGKA_KATA_LUAS[mentah];
  if (!Number.isFinite(angka)) return null; // "beberapa" - tidak dihitung
  return { angka, satuan };
}

/** Bulan/tahun dari teks tanggal "12 Maret 2025" / "Maret 2025" / "2025". */
function uraiBulanTahun(teks) {
  const t = String(teks || "").trim();
  const m = t.match(/(?:(\d{1,2})\s+)?([A-Za-z]+)\s+((?:19|20)\d{2})/);
  if (m) {
    const b = NAMA_BULAN.indexOf(m[2].toLowerCase().replace("pebruari", "februari").replace("nopember", "november"));
    if (b >= 0) return { bulan: b, tahun: Number(m[3]) };
  }
  const y = t.match(/\b((?:19|20)\d{2})\b/);
  return y ? { bulan: -1, tahun: Number(y[1]) } : null;
}

function teksBulanTahun(indeks, adaBulan) {
  const tahun = Math.floor(indeks / 12);
  if (!adaBulan) return `tahun ${tahun}`;
  const nama = NAMA_BULAN[((indeks % 12) + 12) % 12];
  return `bulan ${nama.charAt(0).toUpperCase()}${nama.slice(1)} ${tahun}`;
}

/** "N tahun/bulan yang lalu" dihitung mundur dari tanggal sidang (perkiraan). */
function mundurDari(m, tanggalSidang) {
  const a = angkaSatuan(m);
  const s = uraiBulanTahun(tanggalSidang);
  if (!a || !s || s.bulan < 0 || !/tahun|bulan/.test(a.satuan)) return null;
  // "2 tahun 8 bulan yang lalu": gugus tahunDepan ikut dijumlah.
  const depan = m.groups && m.groups.tahunDepan ? angkaSatuan({ groups: { angka: m.groups.tahunDepan, satuan: "tahun" } }) : null;
  const indeks = s.tahun * 12 + s.bulan - (a.satuan === "tahun" ? a.angka * 12 : a.angka) - (depan ? depan.angka * 12 : 0);
  return teksBulanTahun(indeks, a.satuan === "bulan");
}

/** "N bulan/tahun setelah menikah" dihitung maju dari tanggal nikah posita (perkiraan). */
function majuDariNikah(m, tanggalNikah) {
  const a = angkaSatuan(m);
  const s = uraiBulanTahun(tanggalNikah);
  if (!s) return null;
  // "sejak awal pernikahan": TANPA perkiraan - terukur 0/5 sama dengan bulan nikah pada isian petugas.
  if (!a) return null;
  if (!/tahun|bulan|minggu|hari/.test(a.satuan)) return null;
  if (s.bulan < 0) return a.satuan === "tahun" ? `tahun ${s.tahun + a.angka}` : null;
  const tambah = a.satuan === "tahun" ? a.angka * 12 : a.satuan === "bulan" ? a.angka : 0;
  return teksBulanTahun(s.tahun * 12 + s.bulan + tambah, a.satuan !== "tahun");
}

/** Tanggal nikah dari posita (kalimat pertama yang menyebut menikah + tanggal) - untuk perkiraan "setelah menikah". */
function tanggalNikahDari(butirPosita) {
  for (const b of butirPosita || []) {
    if (!/menikah|pernikahan|perkawinan|akad\s+nikah|melangsungkan/i.test(b)) continue;
    const m = String(b).match(/\b(\d{1,2}\s+)?(Januari|Februari|Pebruari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Nopember|Desember)\s+((?:19|20)\d{2})\b/i);
    if (m) return m[0];
  }
  return "";
}
/* === AKHIR KDL2 === */

const NAMA_BULAN = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];
const ANGKA_KATA = { satu: 1, se: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10, sebelas: 11 };

/** Lama (bulan) dari pola waktu "lama-satuan" (gugus 1 angka/kata, gugus 2 satuan) - jumlah seluruh satuan. */
function lamaBulanDari(teks, uj) {
  let total = null;
  for (const p of uj.pola("lama-satuan")) {
    const bendera = (p.flags || "").includes("g") ? p.flags : `${p.flags || ""}g`;
    for (const m of String(teks || "").matchAll(new RegExp(p.regex, bendera))) {
      const angka = /^\d+$/.test(m[1]) ? Number(m[1]) : ANGKA_KATA[String(m[1]).toLowerCase()];
      if (!Number.isFinite(angka)) continue;
      total = (total || 0) + (/tahun/i.test(m[2]) ? angka * 12 : angka);
    }
    if (total !== null) break;
  }
  return total;
}

/**
 * Tahun untuk "sejak bulan X" bila kalimat yang sama menyebut lamanya dan tanggal sidang
 * diketahui: tahun yang membuat selisih bulan X..sidang paling dekat dengan lama itu.
 * PERKIRAAN - selalu disebut begitu, tidak pernah mengisi variabel.
 */
function tahunPerkiraan(namaBulan, sisaKalimat, tanggalSidang, uj) {
  const bulan = NAMA_BULAN.indexOf(String(namaBulan || "").toLowerCase().replace("pebruari", "februari").replace("nopember", "november"));
  const lama = lamaBulanDari(sisaKalimat, uj);
  const m = String(tanggalSidang || "").trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (bulan < 0 || lama === null || !m) return null;
  const bulanSidang = NAMA_BULAN.indexOf(m[2].toLowerCase());
  if (bulanSidang < 0) return null;
  const indeksSidang = Number(m[3]) * 12 + bulanSidang;
  let terbaik = null;
  for (let tahun = Number(m[3]); tahun >= Number(m[3]) - 30; tahun--) {
    const selisih = indeksSidang - (tahun * 12 + bulan);
    if (selisih < 0) continue;
    if (!terbaik || Math.abs(selisih - lama) < Math.abs(terbaik.selisih - lama)) terbaik = { tahun, selisih };
  }
  if (!terbaik || Math.abs(terbaik.selisih - lama) > 2) return null;
  const nama = NAMA_BULAN[bulan];
  return `bulan ${nama.charAt(0).toUpperCase()}${nama.slice(1)} ${terbaik.tahun}`;
}

// ============================================================================
// P3 - SUBJEK PERBUATAN PER KALIMAT
// ============================================================================

/**
 * Tiap kalimat: perbuatan apa (pola kunci "perbuatan") dan siapa subjeknya.
 * @returns {Array<{perbuatan, sisi: "pelaku"|"lawan"|"tuduhan", kalimat, kode}>}
 */
function pelakuPerKalimat(butir, ujPelaku) {
  const usul = layananUsulan();
  const uj = ujPelaku || penguji("pelaku");
  const hasil = [];
  for (const kalimat of butir || []) {
    const teks = String(kalimat || "");
    const kecil = teks.toLowerCase();
    for (const p of uj.pola("perbuatan")) {
      const sisi = new Set();
      for (const i of letakCocok(p, teks, kecil)) sisi.add(usul.pelakuSatuKata(kecil, i, uj));
      const s = sisi.has("pelaku") ? "pelaku" : sisi.has("lawan") ? "lawan" : sisi.has("tuduhan") ? "tuduhan" : "";
      if (s) hasil.push({ perbuatan: p.perbuatan || p.label, sisi: s, kalimat: teks, kode: p.kode });
    }
  }
  return hasil;
}

/** Sebutan pihak menurut sisi - dari 0046/0047 perkara, bukan dari kata. */
function sebutanSisi(sisi, pihak) {
  const tergugat = String((pihak && pihak.pelaku) || "").trim() || "Tergugat";
  const penggugat = String((pihak && pihak.lawan) || "").trim() || "Penggugat";
  return sisi === "pelaku" ? tergugat : sisi === "lawan" ? penggugat : "";
}

// ============================================================================
// S6 - FAKTA PER SAKSI
// ============================================================================

/** Kesesuaian satu fakta (nilai per saksi). */
function kesesuaianFakta(kode, nama, nilai1, nilai2) {
  const a = String(nilai1 || "").trim();
  const b = String(nilai2 || "").trim();
  // 31 Okt (butir 16): 0222/0246 - "bulan Juli 2024" dan "tanggal 23 Juli 2024" = sama (yang satu lebih rinci).
  const setaraWaktu = (kode === "0222" || kode === "0246") && a && b && Boolean(layananUsulan().waktuSetara(a, b));
  const status = a && b ? (a.toLowerCase() === b.toLowerCase() || setaraWaktu ? "sama" : "berbeda") : a || b ? "satu saksi" : "tidak ada";
  const tunggal = status === "satu saksi" ? (a ? 1 : 2) : 0;
  return { kode, nama, status, label: labelStatus(status, tunggal), saksi1: a, saksi2: b };
}

// ============================================================================
// SATU PERKARA
// ============================================================================

/**
 * @param {{b1: string[], b2: string[], butirPosita: string[], pihak, lamaPisahBulan: number|null,
 *          lamaSaksi1: number|null, lamaSaksi2: number|null}} bahan
 */
function deteksiPerkara(bahan) {
  const b = bahan || {};
  const pola = polaKelompok("alasan");
  const ujiPelaku = penguji("pelaku");
  const s1 = sebabDariButir(b.b1, { pola, ujiPelaku });
  const s2 = sebabDariButir(b.b2, { pola, ujiPelaku });
  const sp = b.butirPosita && b.butirPosita.length ? sebabDariButir(b.butirPosita, { pola, ujiPelaku }) : null;

  const semuaSebab = [...new Set([...s1, ...s2, ...(sp || [])].map((x) => x.sebab))];
  const sebab = semuaSebab.map((nama) => {
    const x1 = s1.find((x) => x.sebab === nama);
    const x2 = s2.find((x) => x.sebab === nama);
    const xp = sp ? sp.find((x) => x.sebab === nama) : null;
    const bertentangan = x1 && x2 && x1.pelaku && x2.pelaku && x1.pelaku !== x2.pelaku;
    const status = bertentangan ? "berbeda" : x1 && x2 ? "sama" : x1 || x2 ? "satu saksi" : "tidak ada";
    const tunggal = status === "satu saksi" ? (x1 ? 1 : 2) : 0;
    const dari = (x) => (x ? { kalimat: x.kalimat, pelaku: x.pelaku, sebutan: sebutanSisi(x.pelaku, b.pihak), pola: x.pola } : null);
    return {
      sebab: nama,
      huruf: (x1 || x2 || xp).huruf,
      status,
      label: bertentangan ? "pelaku berbeda antar saksi" : labelStatus(status, tunggal),
      saksi1: dari(x1),
      saksi2: dari(x2),
      posita: dari(xp),
      pola: [...new Set([...(x1 ? x1.pola : []), ...(x2 ? x2.pola : [])])],
    };
  });

  const usul = usulHuruf({ s1, s2, posita: sp, lamaPisahBulan: b.lamaPisahBulan });
  const huruf = usul.map((u) => ({
    ...u,
    kesesuaian: kesesuaianHuruf(u.huruf, s1, s2, b.lamaSaksi1, b.lamaSaksi2),
    didalilkan: sp ? (u.huruf === "B" ? sp.some((x) => x.sebab === "meninggalkan") : sebabHuruf(sp, u.huruf).length > 0) : null,
  }));

  const pelaku = {
    saksi1: pelakuPerKalimat(b.b1, ujiPelaku).map((x) => ({ ...x, sebutan: sebutanSisi(x.sisi, b.pihak) })),
    saksi2: pelakuPerKalimat(b.b2, ujiPelaku).map((x) => ({ ...x, sebutan: sebutanSisi(x.sisi, b.pihak) })),
  };
  // P3 x S6: perbuatan yang sama, subjek berbeda antar saksi - persoalan pembuktian, harus terlihat.
  const pelakuBerbeda = [];
  for (const x of pelaku.saksi1) {
    if (x.sisi === "tuduhan") continue;
    const y = pelaku.saksi2.find((z) => z.perbuatan === x.perbuatan && z.sisi !== "tuduhan" && z.sisi !== x.sisi);
    if (y && !pelaku.saksi1.some((z) => z.perbuatan === x.perbuatan && z.sisi === y.sisi) && !pelakuBerbeda.some((z) => z.perbuatan === x.perbuatan)) {
      pelakuBerbeda.push({ perbuatan: x.perbuatan, saksi1: x.sebutan, saksi2: y.sebutan, kalimat1: x.kalimat, kalimat2: y.kalimat });
    }
  }

  return { sebab, huruf, pelaku, pelakuBerbeda };
}

// ============================================================================
// KODE POLA PEMICU (u.kodePola) - untuk jejak koreksi & calon tinjauan pola (agen 4)
// ============================================================================

/** Kode pola pertama (urutan kamus) berkunci itu yang cocok pada teks, atau "". */
function kodePolaKunci(kelompok, kunci, teks) {
  const p = penguji(kelompok)
    .pola(kunci)
    .find((x) => x.re.test(String(teks || "")));
  return p ? p.kode : "";
}

/** Kode pola alasan yang menyalakan sebab itu pada kalimat itu (pola pertama urutan kamus), atau "". */
function kodePolaSebab(sebab, kalimat) {
  if (!kalimat) return "";
  const s = sebabDariButir([kalimat]).find((x) => x.sebab === sebab);
  return s && s.pola.length ? s.pola[0] : "";
}

module.exports = {
  HURUF_LANGSUNG,
  sebabHuruf,
  kodePolaKunci,
  kodePolaSebab,
  penguji,
  ciriAlasanDariKamus,
  sidikCiri,
  sebabDariButir,
  sebabDariTeks,
  usulHuruf,
  kesesuaianHuruf,
  kesesuaianFakta,
  petunjukWaktu,
  /* === KDL2 11 Okt === */
  tanggalNikahDari,
  mundurDari,
  majuDariNikah,
  rentangPenyangkal,
  /* === AKHIR KDL2 === */
  pelakuPerKalimat,
  deteksiPerkara,
  HURUF_LANGSUNG,
  SEBAB_TANPA_PELAKU,
  LABEL_STATUS,
};
