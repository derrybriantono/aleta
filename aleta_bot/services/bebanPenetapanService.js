"use strict";

/**
 * ============================================================================
 * BEBAN PENETAPAN: SATU SUMBER ANGKA UNTUK PAPAN DAN PANEL SIPP (20 Okt 2026)
 * ============================================================================
 *
 * Papan penunjukan di ekstensi dan panel "Penetapan Otomatis" di halaman SIPP
 * menampilkan angka beban yang SAMA, karena keduanya membaca objek usulan yang
 * sama dan objek itu disusun di sini. Tidak ada rumus beban di peramban.
 *
 * Berkas ini dua lapis:
 *
 *   1. FUNGSI MURNI (hitungStatistik, skorKandidat, urutkanKandidat,
 *      alasanSingkat, periksaKesesuaianSk) - tanpa basis data, diuji satuan.
 *   2. PEMBACA (bacaBaris) - hanya SELECT ke SIPP, satu kali per orang peran
 *      (hakim, panitera pengganti, juru sita), dengan simpanan 10 detik.
 *
 * ============================================================================
 * APA YANG DIHITUNG
 * ============================================================================
 *
 * Untuk tiap orang di tiap peran:
 *   aktif       perkara yang ditetapkan kepadanya dan BELUM diputus
 *               (perkara.tahapan_terakhir_id < 15), tahun berapa pun
 *   tahun       penetapan tahun berjalan
 *   hari30      penetapan 30 hari terakhir (hari ini dan 29 hari sebelumnya)
 *   persen30    bagiannya atas seluruh penetapan 30 hari di perannya
 *               (hakim: atas jumlah KURSI, sehingga rata-ratanya 1/N)
 *   kebendaan6  perkara KEBENDAAN yang ditetapkan kepadanya 6 bulan terakhir,
 *               beserta bagiannya atas seluruh kebendaan 6 bulan
 *
 * Perkara kebendaan = jenis yang berbobot 2,0 di penunjukanService (harta
 * bersama, kewarisan, P3HP/penetapan ahli waris, wasiat, ekonomi syariah).
 * Definisinya TIDAK diulang di sini: pemanggil menyerahkan fungsi
 * `kebendaan(jenisId)` dan `bobot(jenisId)` dari penunjukanService.
 *
 * Penilaian dan alasan pemilihan: docs/penetapan/PENILAIAN-BEBAN.md.
 */

const TAHAPAN_TINGKAT_PERTAMA = 10;
/** Perkara dengan tahapan_terakhir_id di bawah ini belum diputus. */
const TAHAPAN_PUTUSAN = 15;
const HARI_JENDELA = 30;
const BULAN_KEBENDAAN = 6;
const TTL_SIMPANAN_MS = 10 * 1000;

/**
 * Bobot komponen skor. Jumlahnya 1 pada tiap baris.
 *
 * Perkara biasa: beban berjalan dan penerimaan terbaru menentukan; kebendaan
 * hanya sedikit karena bobot 2,0 sudah ikut di tiga komponen lain.
 * Perkara kebendaan: yang menentukan siapa yang paling LONGGAR dari
 * kebendaan 6 bulan, sebab kebendaan berat dan jarang - dibagi rata tersendiri.
 */
const BOBOT_SKOR = {
  biasa: { aktif: 0.2, tahun: 0.4, hari30: 0.3, kebendaan: 0.1 },
  kebendaan: { aktif: 0.1, tahun: 0.2, hari30: 0, kebendaan: 0.7 },
};

/**
 * Bobot khusus per peran (bila ada) menggantikan BOBOT_SKOR. Diatur dari hasil
 * ukur atas data nyata (docs/penetapan/PENILAIAN-BEBAN.md).
 */
const BOBOT_SKOR_PERAN = {
  // Juru sita: satuan kerjanya panggilan/relaas, bukan perkara berjalan - berjalan tidak dihitung.
  jurusita: {
    biasa: { aktif: 0, tahun: 0.6, hari30: 0.3, kebendaan: 0.1 },
    kebendaan: { aktif: 0, tahun: 0.2, hari30: 0.1, kebendaan: 0.7 },
  },
  // Panitera pengganti: menghadiri sidang selama perkara berjalan, jadi berjalan ikut sedikit.
  panitera: {
    biasa: { aktif: 0.1, tahun: 0.5, hari30: 0.3, kebendaan: 0.1 },
    kebendaan: { aktif: 0.1, tahun: 0.2, hari30: 0, kebendaan: 0.7 },
  },
};

/** Bobot rata-rata skor anggota pada skor majelis (sisanya beban majelis sendiri). */
const BOBOT_ANGGOTA_MAJELIS = { nilai: 0.2 };

/** Penghalus: orang yang belum menerima apa pun tidak berskor nol mutlak. */
const PENGHALUS = 0.5;

// ---------------------------------------------------------------------------
// Tanggal (kalender lokal, ISO yyyy-mm-dd)
// ---------------------------------------------------------------------------

function iso(nilai) {
  if (!nilai) return "";
  if (typeof nilai === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(nilai);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
  }
  const d = nilai instanceof Date ? nilai : new Date(nilai);
  if (Number.isNaN(d.getTime())) return "";
  const dua = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}`;
}

function geser(isoTgl, hari) {
  const d = new Date(`${isoTgl}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + hari);
  return iso(d);
}

function geserBulan(isoTgl, bulan) {
  const d = new Date(`${isoTgl}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  const hariAsal = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + bulan);
  const akhir = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(hariAsal, akhir));
  return iso(d);
}

function selisihHari(dari, sampai) {
  const a = new Date(`${dari}T00:00:00`);
  const b = new Date(`${sampai}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.round((b - a) / 86400000);
}

/** Jendela waktu semua hitungan, dari satu tanggal "sekarang". */
function jendelaWaktu(sekarang) {
  const kini = iso(sekarang) || iso(new Date());
  const tahun = Number(kini.slice(0, 4));
  return {
    sekarang: kini,
    tahun,
    awalTahun: `${tahun}-01-01`,
    dari30: geser(kini, -(HARI_JENDELA - 1)),
    dari6: geserBulan(kini, -BULAN_KEBENDAAN),
  };
}

const bulat1 = (x) => Math.round(Number(x) * 10) / 10;
const bulat2 = (x) => Math.round(Number(x) * 100) / 100;
const persen = (bagian, total) => (total > 0 ? bulat1((bagian / total) * 100) : 0);

// ---------------------------------------------------------------------------
// Statistik
// ---------------------------------------------------------------------------

/**
 * Lama seseorang ikut dalam satu jendela, dibobot rasionya. Orang yang baru
 * bertugas di tengah jendela tidak dihitung sebagai orang penuh - sama dengan
 * asas bagianSemestinya di penunjukanService.
 */
function paparan(orang, mulaiJendela, sekarang) {
  const mulai = iso(orang.mulai);
  const awal = mulai && mulai > mulaiJendela ? (mulai > sekarang ? sekarang : mulai) : mulaiJendela;
  const hari = Math.max(1, selisihHari(awal, sekarang) + 1);
  const rasio = Number.isFinite(Number(orang.rasio)) && Number(orang.rasio) > 0 ? Number(orang.rasio) : 100;
  return hari * (rasio / 100);
}

/**
 * Statistik satu peran.
 *
 * @param {object} p
 * @param {Array<{id,kode,nama,mulai?,rasio?}>} p.orang   orang aktif di peran ini
 * @param {Array<{perkaraId,orangId,tanggal,jenisId,berjalan}>} p.baris penetapan
 */
function statistikPeran({ orang, baris, jendela, bobot, kebendaan, peran = "" }) {
  const unik = new Map();
  for (const b of Array.isArray(baris) ? baris : []) {
    if (!b || !(Number(b.orangId) > 0) || !(Number(b.perkaraId) > 0)) continue;
    const kunci = `${b.perkaraId}:${b.orangId}`;
    if (!unik.has(kunci)) unik.set(kunci, { ...b, tanggal: iso(b.tanggal) });
  }

  const per = new Map();
  for (const o of orang) {
    per.set(Number(o.id), {
      id: Number(o.id),
      peran,
      kode: o.kode || "",
      nama: o.nama || "",
      rasio: o.rasio || 100,
      mulai: iso(o.mulai),
      aktif: 0,
      aktifBobot: 0,
      tahun: 0,
      tahunBobot: 0,
      hari30: 0,
      hari30Bobot: 0,
      kebendaan6: 0,
      terakhir: "",
    });
  }

  for (const b of unik.values()) {
    const e = per.get(Number(b.orangId));
    if (!e) continue; // sudah tidak aktif (mutasi): tidak ditampilkan dan tidak dihitung
    const w = bobot(b.jenisId);
    if (b.berjalan) {
      e.aktif += 1;
      e.aktifBobot += w;
    }
    if (b.tanggal && b.tanggal >= jendela.awalTahun && b.tanggal <= jendela.sekarang) {
      e.tahun += 1;
      e.tahunBobot += w;
    }
    if (b.tanggal && b.tanggal >= jendela.dari30 && b.tanggal <= jendela.sekarang) {
      e.hari30 += 1;
      e.hari30Bobot += w;
    }
    if (b.tanggal && b.tanggal >= jendela.dari6 && b.tanggal <= jendela.sekarang && kebendaan(b.jenisId)) {
      e.kebendaan6 += 1;
    }
    if (b.tanggal && b.tanggal > e.terakhir) e.terakhir = b.tanggal;
  }

  const daftar = [...per.values()];
  const jumlah = daftar.length;
  const jumlahDari = (kunci) => daftar.reduce((s, e) => s + e[kunci], 0);
  const total = {
    aktif: jumlahDari("aktif"),
    aktifBobot: jumlahDari("aktifBobot"),
    tahun: jumlahDari("tahun"),
    tahunBobot: jumlahDari("tahunBobot"),
    hari30: jumlahDari("hari30"),
    hari30Bobot: jumlahDari("hari30Bobot"),
    kebendaan6: jumlahDari("kebendaan6"),
  };

  const pp = {
    tahun: daftar.map((e) => paparan(e, jendela.awalTahun, jendela.sekarang)),
    hari30: daftar.map((e) => paparan(e, jendela.dari30, jendela.sekarang)),
    enam: daftar.map((e) => paparan(e, jendela.dari6, jendela.sekarang)),
  };
  const sigma = (arr) => arr.reduce((s, x) => s + x, 0) || 1;
  const sTahun = sigma(pp.tahun);
  const s30 = sigma(pp.hari30);
  const s6 = sigma(pp.enam);

  daftar.forEach((e, i) => {
    // Yang DIHARAPKAN: bagian adil atas total, menurut lama ikut dan rasio.
    const harap = {
      aktif: total.aktifBobot * (pp.tahun[i] / sTahun),
      tahun: total.tahunBobot * (pp.tahun[i] / sTahun),
      hari30: total.hari30Bobot * (pp.hari30[i] / s30),
      kebendaan: total.kebendaan6 * (pp.enam[i] / s6),
    };
    e.semestinya = {
      aktif: bulat1(harap.aktif),
      tahun: bulat1(harap.tahun),
      hari30: bulat1(harap.hari30),
      kebendaan6: bulat1(harap.kebendaan),
    };
    e.nisbah = {
      aktif: (e.aktifBobot + PENGHALUS) / (harap.aktif + PENGHALUS),
      tahun: (e.tahunBobot + PENGHALUS) / (harap.tahun + PENGHALUS),
      hari30: (e.hari30Bobot + PENGHALUS) / (harap.hari30 + PENGHALUS),
      kebendaan: (e.kebendaan6 + PENGHALUS) / (harap.kebendaan + PENGHALUS),
    };
    e.persen30 = persen(e.hari30, total.hari30);
    e.rataRata30 = jumlah > 0 ? bulat1(100 / jumlah) : 0;
    e.persenKebendaan6 = persen(e.kebendaan6, total.kebendaan6);
    e.rataRataKebendaan6 = e.rataRata30;
    e.kebendaan6Total = total.kebendaan6;
    e.aktifBobot = bulat2(e.aktifBobot);
    e.tahunBobot = bulat2(e.tahunBobot);
    e.hari30Bobot = bulat2(e.hari30Bobot);
  });

  return { orang: daftar, total, jumlahOrang: jumlah };
}

/** Skor beban satu entri (makin kecil makin layak dapat penetapan baru). */
function skorKandidat(entri, { kebendaan = false } = {}) {
  if (!entri || !entri.nisbah) return null;
  const jenis = kebendaan ? "kebendaan" : "biasa";
  const khusus = entri.peran && BOBOT_SKOR_PERAN[entri.peran];
  const w = (khusus && khusus[jenis]) || BOBOT_SKOR[jenis];
  const n = entri.nisbah;
  return bulat1(100 * (w.aktif * n.aktif + w.tahun * n.tahun + w.hari30 * n.hari30 + w.kebendaan * n.kebendaan));
}

const kunciIdUrut = (ids) => [...(ids || [])].map(Number).sort((a, b) => a - b).join("-");

/**
 * Statistik majelis. Majelis = himpunan hakim yang sama pada satu perkara
 * (dua orang atau lebih). Dikenali sebagai majelis SK bila himpunan KODE
 * hakimnya sama dengan salah satu susunan SK (urutan tidak diperhitungkan -
 * alasan yang sama dengan penunjukanService.kodeSkUntuk).
 */
function statistikMajelis({ barisHakim, hakimAktif, susunanSk, jendela, bobot, kebendaan, skTanggal = "" }) {
  // Majelis SK dinilai sejak SK berlaku: susunan sebelum SK bukan majelis yang
  // sama, dan membandingkannya membuat majelis "tertinggal" yang lalu dibanjiri
  // perkara (terukur: 70 dari 136 perkara jatuh ke satu majelis).
  const mulaiMajelis = iso(skTanggal) && iso(skTanggal) > jendela.awalTahun ? iso(skTanggal) : jendela.awalTahun;
  const kodeDariId = new Map(hakimAktif.map((h) => [Number(h.id), String(h.kode || "").toUpperCase()]));
  const idDariKode = new Map(hakimAktif.map((h) => [String(h.kode || "").toUpperCase(), Number(h.id)]));
  const perPerkara = new Map();
  for (const b of barisHakim) {
    if (!(Number(b.orangId) > 0)) continue;
    if (!(iso(b.tanggal) >= mulaiMajelis)) continue;
    const p = perPerkara.get(b.perkaraId) || { ids: new Set(), tanggal: iso(b.tanggal), jenisId: b.jenisId, berjalan: b.berjalan };
    p.ids.add(Number(b.orangId));
    perPerkara.set(b.perkaraId, p);
  }

  const kunciKode = (kode) => [...kode].map((x) => String(x).toUpperCase()).sort().join("|");
  const sk = (Array.isArray(susunanSk) ? susunanSk : []).filter((s) => Array.isArray(s.hakimKode) && s.hakimKode.length >= 2);
  const petaSk = new Map(sk.map((s) => [kunciKode(s.hakimKode), s]));

  const entri = new Map();
  const ambil = (kunci, awal) => {
    if (!entri.has(kunci)) {
      entri.set(kunci, { ...awal, aktif: 0, aktifBobot: 0, tahun: 0, tahunBobot: 0, hari30: 0, hari30Bobot: 0, kebendaan6: 0, terakhir: "" });
    }
    return entri.get(kunci);
  };

  // Majelis SK selalu ada di daftar - majelis baru bermula dari nol.
  for (const s of sk) {
    const ids = s.hakimKode.map((k) => idDariKode.get(String(k).toUpperCase())).filter((x) => x > 0);
    ambil(`sk:${s.majelisKode}`, {
      kunci: ids.length === s.hakimKode.length ? ids.join("-") : "",
      kunciIdUrut: ids.length === s.hakimKode.length ? kunciIdUrut(ids) : "",
      kode: s.majelisKode,
      dariSk: true,
      anggotaKode: s.hakimKode.map((k) => String(k).toUpperCase()),
      anggotaId: ids,
      skNomor: s.skNomor || "",
      skTanggal: s.skTanggal || "",
    });
  }

  let tunggal = { aktif: 0, tahun: 0, hari30: 0, kebendaan6: 0 };
  let luarSk = { aktif: 0, tahun: 0, hari30: 0, kebendaan6: 0, perkara: 0 };
  let totalMajelis30 = 0;
  let totalKeb6 = 0;

  for (const p of perPerkara.values()) {
    const ids = [...p.ids];
    const w = bobot(p.jenisId);
    const ada30 = p.tanggal && p.tanggal >= jendela.dari30 && p.tanggal <= jendela.sekarang;
    const adaTahun = p.tanggal && p.tanggal >= jendela.awalTahun && p.tanggal <= jendela.sekarang;
    const adaKeb = p.tanggal && p.tanggal >= jendela.dari6 && p.tanggal <= jendela.sekarang && kebendaan(p.jenisId);
    if (ids.length < 2) {
      if (p.berjalan) tunggal.aktif += 1;
      if (adaTahun) tunggal.tahun += 1;
      if (ada30) tunggal.hari30 += 1;
      if (adaKeb) tunggal.kebendaan6 += 1;
      continue;
    }
    if (ada30) totalMajelis30 += 1;
    if (adaKeb) totalKeb6 += 1;
    const kodeSet = ids.map((i) => kodeDariId.get(i) || `#${i}`);
    const cocok = petaSk.get(kunciKode(kodeSet));
    const sasaran = cocok ? entri.get(`sk:${cocok.majelisKode}`) : null;
    if (!sasaran) {
      if (p.berjalan) luarSk.aktif += 1;
      if (adaTahun) luarSk.tahun += 1;
      if (ada30) luarSk.hari30 += 1;
      if (adaKeb) luarSk.kebendaan6 += 1;
      luarSk.perkara += 1;
      continue;
    }
    if (p.berjalan) {
      sasaran.aktif += 1;
      sasaran.aktifBobot += w;
    }
    if (adaTahun) {
      sasaran.tahun += 1;
      sasaran.tahunBobot += w;
    }
    if (ada30) {
      sasaran.hari30 += 1;
      sasaran.hari30Bobot += w;
    }
    if (adaKeb) sasaran.kebendaan6 += 1;
    if (p.tanggal && p.tanggal > sasaran.terakhir) sasaran.terakhir = p.tanggal;
  }

  const daftar = [...entri.values()];
  const n = daftar.length || 1;
  const total = (k) => daftar.reduce((s, e) => s + e[k], 0);
  const t = {
    aktifBobot: total("aktifBobot"),
    tahunBobot: total("tahunBobot"),
    hari30Bobot: total("hari30Bobot"),
    hari30: total("hari30"),
    kebendaan6: total("kebendaan6"),
  };
  for (const e of daftar) {
    // Semua majelis SK dianggap bersidang penuh (tiap majelis satu hari sidang).
    const harap = {
      aktif: t.aktifBobot / n,
      tahun: t.tahunBobot / n,
      hari30: t.hari30Bobot / n,
      kebendaan: t.kebendaan6 / n,
    };
    e.nisbah = {
      aktif: (e.aktifBobot + PENGHALUS) / (harap.aktif + PENGHALUS),
      tahun: (e.tahunBobot + PENGHALUS) / (harap.tahun + PENGHALUS),
      hari30: (e.hari30Bobot + PENGHALUS) / (harap.hari30 + PENGHALUS),
      kebendaan: (e.kebendaan6 + PENGHALUS) / (harap.kebendaan + PENGHALUS),
    };
    e.persen30 = persen(e.hari30, totalMajelis30);
    e.rataRata30 = bulat1(100 / n);
    e.persenKebendaan6 = persen(e.kebendaan6, totalKeb6);
    e.rataRataKebendaan6 = e.rataRata30;
    e.kebendaan6Total = totalKeb6;
    e.aktifBobot = bulat2(e.aktifBobot);
    e.tahunBobot = bulat2(e.tahunBobot);
    e.hari30Bobot = bulat2(e.hari30Bobot);
  }

  return { majelis: daftar, tunggal, luarSk, totalMajelis30, totalKebendaan6: totalKeb6 };
}

/**
 * Skor majelis: separuh dari hitungannya sendiri (beban majelis), separuh dari
 * rata-rata skor anggotanya (ketua dihitung separuh, anggota lain berbagi
 * separuh sisanya).
 */
function skorMajelis(entri, statHakim, opsi) {
  if (!entri) return null;
  const sendiri = entri.nisbah ? skorKandidat(entri, opsi) : null;
  const ids = entri.anggotaId || [];
  const skorAnggota = ids.map((id) => {
    const h = statHakim.get(id);
    return h ? skorKandidat(h, opsi) : null;
  });
  if (skorAnggota.length === 0 || skorAnggota.some((x) => x === null)) return sendiri;
  const ketua = skorAnggota[0];
  const lain = skorAnggota.slice(1);
  const rataLain = lain.length ? lain.reduce((s, x) => s + x, 0) / lain.length : ketua;
  const anggota = 0.5 * ketua + 0.5 * rataLain;
  const b = BOBOT_ANGGOTA_MAJELIS.nilai;
  return bulat1(sendiri === null ? anggota : (1 - b) * sendiri + b * anggota);
}

/**
 * Seluruh statistik untuk satu perkara yang akan ditetapkan.
 *
 * @param {object} p
 * @param {string|Date} p.sekarang
 * @param {{hakim:Array,panitera:Array,jurusita:Array}} p.baris  penetapan per peran
 * @param {{hakim:Array,panitera:Array,jurusita:Array}} p.orang  orang aktif per peran
 * @param {Array} p.susunanSk  susunan SK dari portal
 * @param {(jenisId:number)=>number} p.bobot
 * @param {(jenisId:number)=>boolean} p.kebendaan
 */
function hitungStatistik({ sekarang, baris, orang, susunanSk = [], bobot, kebendaan, skTanggal = "" }) {
  const jendela = jendelaWaktu(sekarang);
  const peran = (nama) =>
    statistikPeran({
      peran: nama,
      orang: (orang && orang[nama]) || [],
      baris: (baris && baris[nama]) || [],
      jendela,
      bobot,
      kebendaan,
    });

  const hakim = peran("hakim");
  const panitera = peran("panitera");
  const jurusita = peran("jurusita");

  const majelis = statistikMajelis({
    barisHakim: (baris && baris.hakim) || [],
    hakimAktif: (orang && orang.hakim) || [],
    susunanSk,
    jendela,
    bobot,
    kebendaan,
    skTanggal,
  });

  const terbaca = hakim.orang.length + panitera.orang.length + jurusita.orang.length > 0;
  return {
    terbaca,
    jendela,
    hakim,
    panitera,
    jurusita,
    majelis,
    // Kursi hakim = jumlah seluruh keanggotaan; perkara berbeda dengan kursi bila bermajelis.
    catatan:
      "Bagian 30 hari dan kebendaan 6 bulan dihitung atas kursi/penetapan di tiap peran; rata-rata = 100% dibagi jumlah orang aktif.",
  };
}

/**
 * Menempelkan skor, urutan, dan alasan ke daftar kandidat, lalu mengurutkan.
 *
 * @param {Array} kandidat  objek dengan id di `kunciId` (atau fungsi id)
 * @param {Map<number,object>} peta  id -> entri statistik
 * @param {object} opsi  { kebendaan, jenis: "hakim"|"panitera"|"jurusita"|"majelis",
 *                         urutanDasar?: (a,b)=>number, kelompok?: (x)=>number }
 *
 * `kelompok` memisahkan kandidat yang HARUS didahulukan lebih dulu (mis. PP
 * pendamping SK): kelompok kecil di depan, di dalamnya urut skor.
 */
function urutkanKandidat(kandidat, peta, { kebendaan = false, ambilId, ambilEntri, kelompok } = {}) {
  const daftar = (Array.isArray(kandidat) ? kandidat : []).map((x, indeks) => {
    const entri = ambilEntri ? ambilEntri(x) : peta.get(Number(ambilId(x)));
    const skor = entri ? (entri.skorMajelis !== undefined ? entri.skorMajelis : skorKandidat(entri, { kebendaan })) : null;
    return { x, entri, skor, indeks };
  });
  daftar.sort((a, b) => {
    const ka = kelompok ? kelompok(a.x) : 0;
    const kb = kelompok ? kelompok(b.x) : 0;
    if (ka !== kb) return ka - kb;
    if (a.skor !== null && b.skor !== null && a.skor !== b.skor) return a.skor - b.skor;
    if (a.skor === null && b.skor !== null) return 1;
    if (a.skor !== null && b.skor === null) return -1;
    // Skor sama: yang paling lama tidak menerima, lalu urutan semula (tetap).
    const ta = (a.entri && a.entri.terakhir) || "";
    const tb = (b.entri && b.entri.terakhir) || "";
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.indeks - b.indeks;
  });
  return daftar.map((d, urutan) => ({ ...d.x, skorBeban: d.skor, urutanBeban: urutan + 1 }));
}

/** Ringkasan statistik untuk disematkan pada satu orang/majelis (tanpa nisbah). */
function ringkasEntri(e) {
  if (!e) return null;
  return {
    aktif: e.aktif,
    tahun: e.tahun,
    hari30: e.hari30,
    persen30: e.persen30,
    rataRata30: e.rataRata30,
    kebendaan6: e.kebendaan6,
    persenKebendaan6: e.persenKebendaan6,
    rataRataKebendaan6: e.rataRataKebendaan6,
    kebendaan6Total: e.kebendaan6Total,
  };
}

/**
 * Kalimat alasan pendek yang tampil di papan.
 * "bagian 30 hari 18% (rata-rata 25%), kebendaan 6 bulan 1 dari 9"
 */
function alasanSingkat(entri, { kebendaan = false, totalKebendaan6 = null } = {}) {
  if (!entri) return "";
  const total = totalKebendaan6 !== null ? totalKebendaan6 : entri.kebendaan6Total;
  const bagian = `bagian 30 hari ${String(entri.persen30).replace(".", ",")}% (rata-rata ${String(entri.rataRata30).replace(".", ",")}%)`;
  const keb = `kebendaan 6 bulan ${entri.kebendaan6}${Number.isFinite(total) ? ` dari ${total}` : ""}`;
  const aktif = `${entri.aktif} perkara berjalan`;
  return kebendaan ? `${keb}, ${bagian}, ${aktif}` : `${bagian}, ${keb}, ${aktif}`;
}

// ---------------------------------------------------------------------------
// Kesesuaian dengan SK
// ---------------------------------------------------------------------------

/**
 * Apakah penetapan (yang tercatat, atau yang diusulkan) sesuai SK majelis.
 *
 * @param {object} p
 * @param {string[]} p.hakimKode kode hakim, ketua di depan; [] bila belum ada
 * @param {number[]} p.hakimId   id hakim yang sama urutannya
 * @param {number}   p.paniteraId panitera pengganti (0 bila belum)
 * @param {string}   p.tanggal   tanggal penetapan (ISO)
 * @param {Array}    p.susunanSk
 * @param {{nomor:string,tanggal:string}} p.sk
 * @returns {{status:string,majelisKode:string,bunyi:string,rinci:string[]}}
 *
 * Status: belum_ada_sk | belum_ditetapkan | tunggal | sebelum_berlaku |
 * sesuai | tidak_sesuai
 */
function periksaKesesuaianSk({ hakimKode = [], hakimId = [], paniteraId = 0, tanggal = "", susunanSk = [], sk = {} }) {
  const daftar = (Array.isArray(susunanSk) ? susunanSk : []).filter((s) => Array.isArray(s.hakimKode) && s.hakimKode.length >= 2);
  const sebutSk = sk && sk.nomor ? `SK ${sk.nomor}` : "SK majelis";
  if (daftar.length === 0) {
    return { status: "belum_ada_sk", majelisKode: "", bunyi: "Belum memakai SK - isi di Pengaturan SK Majelis.", rinci: [] };
  }
  const kode = (hakimKode || []).map((x) => String(x || "").toUpperCase()).filter(Boolean);
  if (kode.length === 0) {
    return { status: "belum_ditetapkan", majelisKode: "", bunyi: "Majelis belum ditetapkan.", rinci: [] };
  }
  if (kode.length === 1) {
    return { status: "tunggal", majelisKode: "", bunyi: "Hakim tunggal - tidak diatur oleh susunan majelis SK.", rinci: [] };
  }
  const tglSk = sk && sk.tanggal ? iso(sk.tanggal) : "";
  const tgl = iso(tanggal);
  if (tglSk && tgl && tgl < tglSk) {
    return { status: "sebelum_berlaku", majelisKode: "", bunyi: `Ditetapkan sebelum ${sebutSk} berlaku (${tglSk}).`, rinci: [] };
  }

  const kunci = (arr) => [...arr].map((x) => String(x).toUpperCase()).sort().join("|");
  const cocok = daftar.find((s) => kunci(s.hakimKode) === kunci(kode));
  const rinci = [];
  if (!cocok) {
    return {
      status: "tidak_sesuai",
      majelisKode: "",
      bunyi: `Susunan ${kode.join(", ")} tidak ada di ${sebutSk}.`,
      rinci: [`Susunan menurut SK: ${daftar.map((s) => `${s.majelisKode} = ${s.hakimKode.join(", ")}`).join("; ")}`],
    };
  }
  let sesuai = true;
  if (String(cocok.hakimKode[0]).toUpperCase() !== kode[0]) {
    sesuai = false;
    rinci.push(`Ketua menurut SK ${cocok.hakimKode[0]}, tercatat ${kode[0]}.`);
  }
  if (Number(paniteraId) > 0) {
    const pendamping = (cocok.panitera || []).filter((p) => Number(p.id) > 0);
    if (pendamping.length > 0 && !pendamping.some((p) => Number(p.id) === Number(paniteraId))) {
      sesuai = false;
      rinci.push(`Panitera pengganti bukan pendamping Majelis ${cocok.majelisKode} menurut SK.`);
    }
  }
  return {
    status: sesuai ? "sesuai" : "tidak_sesuai",
    majelisKode: cocok.majelisKode,
    bunyi: sesuai ? `Sesuai ${sebutSk} (Majelis ${cocok.majelisKode}).` : `Tidak sepenuhnya sesuai ${sebutSk} (Majelis ${cocok.majelisKode}).`,
    rinci,
  };
}

// ---------------------------------------------------------------------------
// Pembaca SIPP (hanya SELECT)
// ---------------------------------------------------------------------------

let simpanan = null;

function lupakanSimpanan() {
  simpanan = null;
}

function jalankan(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (galat, baris) => (galat ? reject(galat) : resolve(Array.isArray(baris) ? baris : [])));
  });
}

const PERAN_SQL = {
  hakim: { tabel: "perkara_hakim_pn", alias: "bh", kolom: "hakim_id" },
  panitera: { tabel: "perkara_panitera_pn", alias: "bpp", kolom: "panitera_id" },
  jurusita: { tabel: "perkara_jurusita", alias: "bjs", kolom: "jurusita_id" },
};

/**
 * Membaca penetapan tiga peran. Yang diambil: penetapan sejak awal jendela
 * terjauh (awal tahun atau 6 bulan lalu) DITAMBAH perkara yang masih berjalan
 * (ditetapkan sampai 3 tahun terakhir).
 */
async function bacaBaris(sekarang, { db = require("../db_config"), tabelAda } = {}) {
  const j = jendelaWaktu(sekarang);
  const terjauh = j.awalTahun < j.dari6 ? j.awalTahun : j.dari6;
  const batasBerjalan = geserBulan(j.sekarang, -36);
  const hasil = {};
  for (const [peran, d] of Object.entries(PERAN_SQL)) {
    if (tabelAda && !(await tabelAda(d.tabel))) {
      hasil[peran] = [];
      continue;
    }
    const rows = await jalankan(
      db,
      `SELECT ${d.alias}.perkara_id AS perkaraId, ${d.alias}.${d.kolom} AS orangId,
              ${d.alias}.tanggal_penetapan AS tanggal, bp.jenis_perkara_id AS jenisId,
              bp.tahapan_terakhir_id AS tahapan
         FROM ${d.tabel} ${d.alias}
         JOIN perkara bp ON bp.perkara_id = ${d.alias}.perkara_id
        WHERE ${d.alias}.aktif = 'Y'
          AND ${d.alias}.tahapan_id = ?
          AND ${d.alias}.tanggal_penetapan <= ?
          AND (${d.alias}.tanggal_penetapan >= ?
               OR (${d.alias}.tanggal_penetapan >= ? AND (bp.tahapan_terakhir_id IS NULL OR bp.tahapan_terakhir_id < ?)))`,
      [TAHAPAN_TINGKAT_PERTAMA, j.sekarang, terjauh, batasBerjalan, TAHAPAN_PUTUSAN]
    );
    hasil[peran] = rows
      .filter((r) => r && Number(r.perkaraId) > 0 && Number(r.orangId) > 0)
      .map((r) => ({
        perkaraId: Number(r.perkaraId),
        orangId: Number(r.orangId),
        tanggal: iso(r.tanggal),
        jenisId: Number(r.jenisId) || 0,
        berjalan: r.tahapan === null || r.tahapan === undefined || Number(r.tahapan) < TAHAPAN_PUTUSAN,
      }));
  }
  return hasil;
}

/** Baris dengan simpanan 10 detik (antrean massal memanggil usulan berulang). */
async function bacaBarisBersimpan(sekarang, opsi) {
  const kunci = iso(sekarang) || iso(new Date());
  const kini = Date.now();
  if (simpanan && simpanan.kunci === kunci && kini - simpanan.waktu < TTL_SIMPANAN_MS) return simpanan.baris;
  const baris = await bacaBaris(sekarang, opsi);
  simpanan = { kunci, waktu: kini, baris };
  return baris;
}

/** Panitera pengganti yang tercatat pada satu perkara (0 bila belum ada). */
async function paniteraTercatat(perkaraId, { db = require("../db_config") } = {}) {
  try {
    const rows = await jalankan(
      db,
      `SELECT tpp.panitera_id AS id FROM perkara_panitera_pn tpp
        WHERE tpp.perkara_id = ? AND tpp.aktif = 'Y' AND tpp.tahapan_id = ?
        ORDER BY tpp.urutan ASC LIMIT 1`,
      [perkaraId, TAHAPAN_TINGKAT_PERTAMA]
    );
    return rows[0] ? Number(rows[0].id) || 0 : 0;
  } catch {
    return 0;
  }
}

module.exports = {
  BOBOT_SKOR,
  BOBOT_SKOR_PERAN,
  BOBOT_ANGGOTA_MAJELIS,
  HARI_JENDELA,
  BULAN_KEBENDAAN,
  TAHAPAN_PUTUSAN,
  jendelaWaktu,
  hitungStatistik,
  statistikPeran,
  statistikMajelis,
  skorKandidat,
  skorMajelis,
  urutkanKandidat,
  ringkasEntri,
  alasanSingkat,
  periksaKesesuaianSk,
  bacaBaris,
  bacaBarisBersimpan,
  paniteraTercatat,
  lupakanSimpanan,
  kunciIdUrut,
};
