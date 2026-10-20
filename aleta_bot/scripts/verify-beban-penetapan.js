"use strict";

/**
 * ============================================================================
 * BEBAN PENETAPAN: STATISTIK, SKOR, URUTAN, DAN SK (20 Okt 2026, agen B1)
 * ============================================================================
 *
 * Dibuktikan dua lapis:
 *   1. fungsi murni bebanPenetapanService (30 hari, 6 bulan kebendaan,
 *      persentase, skor, urutan, kesesuaian SK) atas data sintetis;
 *   2. usulanPenunjukan atas SIPP tiruan: usulan memuat statistik yang SAMA
 *      dengan hitungan murni, urutan kandidat menurut skor, SK dipakai bila
 *      diisi, tanda "belum memakai SK" bila kosong, peringatan pegawai SK.
 *
 * SIPP diganti tiruan; tidak ada basis data yang disentuh.
 */

const pathx = require("path");
const Module = require("module");

let lulus = 0;
let gagal = 0;
function periksa(nama, benar, tambahan = "") {
  if (benar) {
    lulus += 1;
    console.log(`  OK    ${nama}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}${tambahan ? ` - ${tambahan}` : ""}`);
  }
}

// --- SIPP tiruan -------------------------------------------------------------
let jawaban = {};
const kueri = [];
function cocokkan(sql) {
  const teks = String(sql);
  kueri.push(teks);
  if (teks.includes("FROM perkara_hakim_pn bh")) return jawaban.barisHakim || [];
  if (teks.includes("FROM perkara_panitera_pn bpp")) return jawaban.barisPanitera || [];
  if (teks.includes("FROM perkara_jurusita bjs")) return jawaban.barisJurusita || [];
  if (teks.includes("FROM perkara_panitera_pn tpp")) return jawaban.paniteraTercatat || [];
  if (teks.includes("FROM perkara p")) return jawaban.perkara || [];
  if (teks.includes("FROM perkara_penetapan pp")) return [];
  if (teks.includes("FROM ref_majelis_tetap")) return [];
  if (teks.includes("FROM perkara_smartmajelis")) return [];
  if (teks.includes("FROM hakim_pn h")) return jawaban.hakim || [];
  if (teks.includes("FROM panitera_pn pn")) return jawaban.panitera || [];
  if (teks.includes("FROM jurusita js")) return jawaban.jurusita || [];
  if (teks.includes("FROM perkara_jurusita pj")) return jawaban.giliran || [];
  if (teks.includes("FROM perkara_hakim_pn hp")) {
    if (/hp\.hakim_nama/.test(teks)) return [];
    return jawaban.beban || [];
  }
  return [];
}

const dbPath = require.resolve(pathx.resolve(__dirname, "..", "db_config.js"));
require.cache[dbPath] = new Module(dbPath, null);
require.cache[dbPath].filename = dbPath;
require.cache[dbPath].loaded = true;
require.cache[dbPath].exports = {
  query(sql, params, callback) {
    callback(null, cocokkan(sql));
  },
};
const skemaPath = require.resolve("../services/sippSkemaService");
const skemaAsli = require("../services/sippSkemaService");
require.cache[skemaPath].exports = { ...skemaAsli, tabelAda: async () => true, muat: async () => ({}), lupakan: () => {} };

const beban = require("../services/bebanPenetapanService");
const layanan = require("../services/penunjukanService");

const SEKARANG = "2026-10-20";
const hari = (n) => {
  const d = new Date(`${SEKARANG}T00:00:00`);
  d.setDate(d.getDate() + n);
  const dua = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}`;
};

const bobot = layanan.bobotJenis;
const kebendaan = layanan.adalahKebendaan;

(async () => {
  console.log("beban penetapan");

  // ------------------------------------------------------------------ jendela
  {
    const j = beban.jendelaWaktu(SEKARANG);
    periksa("30 hari terakhir = hari ini dan 29 hari sebelumnya", j.dari30 === "2026-09-21", j.dari30);
    periksa("6 bulan terakhir mundur enam bulan kalender", j.dari6 === "2026-04-20", j.dari6);
    periksa("akhir Februari tidak meluncur", beban.jendelaWaktu("2026-08-31").dari6 === "2026-02-28");
  }

  // ----------------------------------------------- statistik atas data sintetis
  const orangJs = [
    { id: 1, kode: "E", nama: "Syukri" },
    { id: 2, kode: "E1", nama: "Tanty" },
    { id: 3, kode: "E2", nama: "Mustini" },
  ];
  // Syukri: 6 dalam 30 hari (1 kebendaan); Tanty: 2 dalam 30 hari; Mustini: 0 dalam 30 hari tetapi 3 kebendaan 6 bulan.
  const barisJs = [];
  let nomor = 100;
  const tambah = (orangId, tanggal, jenisId, berjalan = true) => barisJs.push({ perkaraId: nomor++, orangId, tanggal, jenisId, berjalan });
  for (let i = 0; i < 5; i++) tambah(1, hari(-i * 2 - 1), 347);
  tambah(1, hari(-3), 364);
  tambah(2, hari(-4), 347);
  tambah(2, hari(-9), 347);
  tambah(3, hari(-45), 364);
  tambah(3, hari(-100), 364);
  tambah(3, hari(-150), 371);
  tambah(3, hari(-200), 347, false);
  tambah(1, "2026-03-01", 364); // di luar 6 bulan
  tambah(1, "2025-12-31", 347, false); // tahun lalu, sudah diputus: tidak dihitung sama sekali

  let stat;
  {
    stat = beban.hitungStatistik({
      sekarang: SEKARANG,
      baris: { hakim: [], panitera: [], jurusita: barisJs },
      orang: { hakim: [], panitera: [], jurusita: orangJs },
      susunanSk: [],
      bobot,
      kebendaan,
    });
    const e = (id) => stat.jurusita.orang.find((x) => x.id === id);
    periksa("30 hari: Syukri 6, Tanty 2, Mustini 0", e(1).hari30 === 6 && e(2).hari30 === 2 && e(3).hari30 === 0, `${e(1).hari30}/${e(2).hari30}/${e(3).hari30}`);
    periksa("bagian 30 hari = jumlah / seluruh penerimaan 30 hari", e(1).persen30 === 75 && e(2).persen30 === 25 && e(3).persen30 === 0, `${e(1).persen30}/${e(2).persen30}`);
    periksa("rata-rata = 100 dibagi jumlah orang", e(1).rataRata30 === 33.3);
    periksa("kebendaan 6 bulan: Syukri 1, Mustini 3, Tanty 0; di luar 6 bulan tidak dihitung", e(1).kebendaan6 === 1 && e(3).kebendaan6 === 3 && e(2).kebendaan6 === 0, `${e(1).kebendaan6}/${e(3).kebendaan6}`);
    periksa("bagian kebendaan atas seluruh kebendaan 6 bulan (4)", e(1).persenKebendaan6 === 25 && e(3).persenKebendaan6 === 75 && e(1).kebendaan6Total === 4, `${e(1).persenKebendaan6}/${e(3).persenKebendaan6}`);
    periksa("tahun berjalan: penetapan 2025 tidak dihitung", e(1).tahun === 7 && e(3).tahun === 4, `${e(1).tahun}/${e(3).tahun}`);
    periksa("berjalan: hanya yang belum diputus", e(3).aktif === 3 && e(1).aktif === 7, `${e(3).aktif}/${e(1).aktif}`);

    // Perkara biasa: Tanty (2 perkara ringan) paling ringan; Mustini 0 dalam 30 hari tetapi memikul
    // tiga perkara kebendaan berbobot 2,0 yang masih berjalan, jadi di tengah; Syukri (6 dalam 30 hari) paling berat.
    const biasa = beban.urutkanKandidat(orangJs, new Map(stat.jurusita.orang.map((x) => [x.id, x])), { kebendaan: false, ambilId: (x) => x.id });
    periksa("perkara biasa: urutan Tanty, Mustini, Syukri menurut beban", biasa.map((x) => x.id).join() === "2,3,1", biasa.map((x) => `${x.id}:${x.skorBeban}`).join(" "));
    // Perkara kebendaan: Mustini paling BERAT kebendaannya, jadi turun; Tanty (0 kebendaan) di depan.
    const keb = beban.urutkanKandidat(orangJs, new Map(stat.jurusita.orang.map((x) => [x.id, x])), { kebendaan: true, ambilId: (x) => x.id });
    periksa("perkara kebendaan: kebendaan dibagi tersendiri - Tanty di depan, Mustini di belakang", keb[0].id === 2 && keb[2].id === 3, keb.map((x) => `${x.id}:${x.skorBeban}`).join(" "));
    periksa("urutan tetap sama tiap dihitung", beban.urutkanKandidat(orangJs, new Map(stat.jurusita.orang.map((x) => [x.id, x])), { ambilId: (x) => x.id }).map((x) => x.id).join() === biasa.map((x) => x.id).join());

    const alasan = beban.alasanSingkat(e(2), { kebendaan: false });
    periksa("alasan singkat: bagian 30 hari, rata-rata, kebendaan 6 bulan x dari y", /bagian 30 hari 25% \(rata-rata 33,3%\), kebendaan 6 bulan 0 dari 4/.test(alasan), alasan);
  }

  // Pegawai baru tidak dihukum karena datang terlambat.
  {
    const orang = [
      { id: 1, kode: "E", nama: "Lama" },
      { id: 2, kode: "E1", nama: "Baru", mulai: hari(-5) },
    ];
    const baris = [];
    let n = 500;
    for (let i = 0; i < 20; i++) baris.push({ perkaraId: n++, orangId: 1, tanggal: hari(-i), jenisId: 347, berjalan: true });
    const s = beban.hitungStatistik({ sekarang: SEKARANG, baris: { hakim: [], panitera: [], jurusita: baris }, orang: { hakim: [], panitera: [], jurusita: orang }, bobot, kebendaan });
    const baru = s.jurusita.orang.find((x) => x.id === 2);
    const lama = s.jurusita.orang.find((x) => x.id === 1);
    periksa("pegawai baru: bagian semestinya 30 hari jauh di bawah rata-rata pegawai lama", baru.semestinya.hari30 < lama.semestinya.hari30 / 2, `${baru.semestinya.hari30} vs ${lama.semestinya.hari30}`);
  }

  // ----------------------------------------------------------- kesesuaian SK
  {
    const sk = { nomor: "254/KPA.W19-A5/SK.HK2.6/VIII/2026", tanggal: "2026-08-27" };
    const susunanSk = [
      { majelisKode: "A", hakimKode: ["A", "C1", "C3"], panitera: [{ kode: "D", id: 1 }, { kode: "D4", id: 4 }] },
      { majelisKode: "B", hakimKode: ["B", "C2", "C3"], panitera: [{ kode: "D1", id: 2 }] },
    ];
    const cek = (p) => beban.periksaKesesuaianSk({ susunanSk, sk, tanggal: "2026-10-20", ...p });
    periksa("SK kosong -> belum memakai SK", beban.periksaKesesuaianSk({ hakimKode: ["A", "C1", "C3"], susunanSk: [], sk: {} }).status === "belum_ada_sk");
    periksa("susunan dan ketua cocok, PP pendamping -> sesuai", cek({ hakimKode: ["A", "C1", "C3"], paniteraId: 4 }).status === "sesuai");
    periksa("urutan anggota berbeda, ketua sama -> tetap sesuai", cek({ hakimKode: ["A", "C3", "C1"], paniteraId: 1 }).status === "sesuai");
    periksa("ketua berbeda -> tidak sesuai", cek({ hakimKode: ["C1", "A", "C3"], paniteraId: 1 }).status === "tidak_sesuai");
    periksa("PP bukan pendamping majelis itu -> tidak sesuai", cek({ hakimKode: ["A", "C1", "C3"], paniteraId: 2 }).status === "tidak_sesuai");
    periksa("susunan di luar SK -> tidak sesuai dan menyebut SK", /tidak ada di SK 254/.test(cek({ hakimKode: ["A", "B", "C2"], paniteraId: 1 }).bunyi));
    periksa("ditetapkan sebelum SK berlaku -> tidak dinilai", cek({ hakimKode: ["A", "B", "C2"], tanggal: "2026-08-01" }).status === "sebelum_berlaku");
    periksa("hakim tunggal -> tidak diatur susunan SK", cek({ hakimKode: ["C1"] }).status === "tunggal");
  }

  // ----------------------------------------- usulan memuat statistik yang sama
  const HAKIM = [
    { hakimId: 32, kode: "A", nama: "Fahri", gelar: "", jabatan: "" },
    { hakimId: 33, kode: "B", nama: "Sudarmin", gelar: "", jabatan: "" },
    { hakimId: 26, kode: "C1", nama: "Himawan", gelar: "", jabatan: "" },
    { hakimId: 28, kode: "C2", nama: "Idris", gelar: "", jabatan: "" },
    { hakimId: 31, kode: "C3", nama: "Derry", gelar: "", jabatan: "" },
  ];
  const PANITERA = [
    { paniteraId: 1, kode: "D", nama: "Sri Susilowati", gelar: "", jabatan: "" },
    { paniteraId: 4, kode: "D4", nama: "Andini", gelar: "", jabatan: "" },
    { paniteraId: 2, kode: "D1", nama: "Munifah", gelar: "", jabatan: "" },
  ];
  const JURUSITA = orangJs.map((o, i) => ({ jurusitaId: o.id, kode: o.kode, nama: o.nama, jabatan: "Jurusita", mulai: null }));
  const SK = [
    { majelisKode: "A", hakimKode: ["A", "C1", "C3"], panitera: [{ kode: "D", id: 1 }, { kode: "D4", id: 4 }], skNomor: "", skTanggal: "" },
    { majelisKode: "B", hakimKode: ["B", "C2", "C3"], panitera: [{ kode: "D1", id: 2 }], skNomor: "", skTanggal: "" },
  ];
  const PENGATURAN = {
    aturan: { jedaMinimalHari: 10, ambangNilaiSengketa: 500000000, klasifikasiHakimTunggal: ["dispensasi kawin"], kolamHakimTunggal: "hakim" },
    hariSidang: { A: 3, B: 2 },
    paniteraMajelis: {},
    sk: { nomor: "254/KPA.W19-A5/SK.HK2.6/VIII/2026", tanggal: "2026-08-27" },
  };

  function dasar() {
    const hariIni = new Date();
    const iso = (n) => {
      const d = new Date(hariIni);
      d.setDate(d.getDate() + n);
      const dua = (x) => String(x).padStart(2, "0");
      return `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}`;
    };
    const hk = [];
    let id = 1000;
    // Majelis A (A, C1, C3): 12 perkara dalam 30 hari. Majelis B (B, C2, C3): 3 perkara.
    for (let i = 0; i < 12; i++) {
      id += 1;
      for (const h of [32, 26, 31]) hk.push({ perkaraId: id, orangId: h, tanggal: iso(-i - 1), jenisId: 347, tahapan: 14 });
    }
    for (let i = 0; i < 3; i++) {
      id += 1;
      for (const h of [33, 28, 31]) hk.push({ perkaraId: id, orangId: h, tanggal: iso(-i * 5 - 2), jenisId: 347, tahapan: 14 });
    }
    return {
      perkara: [
        { perkaraId: 468, nomorPerkara: "468/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", jenisPerkaraLengkap: "Perceraian - Cerai Gugat", jenisPerkaraId: 347, tanggalDaftar: iso(-3), nilaiSengketa: null },
      ],
      hakim: HAKIM,
      panitera: PANITERA,
      jurusita: JURUSITA,
      giliran: [
        { jurusitaId: 1, jumlah: 10, perkaraTerakhir: 400 },
        { jurusitaId: 2, jumlah: 10, perkaraTerakhir: 401 },
        { jurusitaId: 3, jumlah: 10, perkaraTerakhir: 399 },
      ],
      beban: [],
      barisHakim: hk,
      barisPanitera: [
        ...Array.from({ length: 8 }, (_, i) => ({ perkaraId: 2000 + i, orangId: 1, tanggal: iso(-i - 1), jenisId: 347, tahapan: 14 })),
        ...Array.from({ length: 2 }, (_, i) => ({ perkaraId: 2100 + i, orangId: 4, tanggal: iso(-i - 1), jenisId: 347, tahapan: 14 })),
      ],
      barisJurusita: [
        ...Array.from({ length: 6 }, (_, i) => ({ perkaraId: 3000 + i, orangId: 1, tanggal: iso(-i - 1), jenisId: 347, tahapan: 14 })),
        ...Array.from({ length: 2 }, (_, i) => ({ perkaraId: 3100 + i, orangId: 2, tanggal: iso(-i - 1), jenisId: 347, tahapan: 14 })),
        { perkaraId: 3200, orangId: 3, tanggal: iso(-40), jenisId: 364, tahapan: 14 },
      ],
    };
  }

  {
    beban.lupakanSimpanan();
    jawaban = dasar();
    const u = await layanan.usulanPenunjukan("468/Pdt.G/2026/PA.Dgl", { ...PENGATURAN, susunanSk: SK });
    const st = u.statistik;
    periksa("usulan memuat statistik", Boolean(st) && st.terbaca === true);
    periksa("SK yang dipakai tampil di usulan: nomor, tanggal, dipakai", u.sk.dipakai === true && u.sk.nomor.startsWith("254/KPA") && u.sk.tanggal === "2026-08-27", JSON.stringify(u.sk));
    periksa("majelis diurut menurut beban: B (3 perkara) di depan A (12)", st.majelis[0].kode === "B" && st.majelis[1].kode === "A", st.majelis.map((m) => `${m.kode}:${m.skor}`).join(" "));
    periksa("majelis yang diusulkan = rekomendasi beban (B)", u.pmh.majelisKode === "B" && st.rekomendasi.majelis.kode === "B", `${u.pmh.majelisKode}/${st.rekomendasi.majelis && st.rekomendasi.majelis.kode}`);
    periksa("angka majelis A: 12 dalam 30 hari", st.majelis.find((m) => m.kode === "A").hari30 === 12);
    periksa("bagian 30 hari majelis A = 12 dari 15 = 80%", st.majelis.find((m) => m.kode === "A").persen30 === 80);
    periksa("hakim C3 ikut seluruh 15 perkara", st.hakim.find((h) => h.kode === "C3").hari30 === 15);
    periksa("anggota usulan membawa statistik yang sama dengan daftar hakim", u.pmh.anggota.every((a) => a.statistik && a.statistik.hari30 === st.hakim.find((h) => h.id === a.hakimId).hari30));
    periksa("juru sita: yang paling ringan (Mustini, 0 dalam 30 hari) diusulkan", u.pjs.usulan.jurusitaId === 3 && st.rekomendasi.jurusita.id === 3, String(u.pjs.usulan && u.pjs.usulan.jurusitaId));
    periksa("alasan juru sita tampil di sebab papan", /bagian 30 hari 0% \(rata-rata 33,3%\), kebendaan 6 bulan 1 dari 1/.test(u.pjs.sebab), u.pjs.sebab);
    periksa("calon juru sita menurut skor: 3, 2, 1", u.pjs.calon.map((x) => x.jurusitaId).join() === "3,2,1", u.pjs.calon.map((x) => x.jurusitaId).join());
    periksa("PP: pendamping SK majelis B (D1) didahulukan", u.ppp.usulan && (u.ppp.usulan.id ?? u.ppp.usulan.paniteraId) === 2, JSON.stringify(u.ppp.usulan && u.ppp.usulan.nama));
    periksa("kesesuaian SK untuk usulan: sesuai Majelis B", u.kesesuaianSk.status === "sesuai" && u.kesesuaianSk.majelisKode === "B", JSON.stringify(u.kesesuaianSk));
    periksa("tanpa peringatan pegawai SK bila semua aktif", u.sk.peringatan.length === 0, JSON.stringify(u.sk.peringatan));

    // Papan dan panel membaca objek yang sama: statistik di usulan = hitungan murni atas baris yang sama.
    const murni = beban.hitungStatistik({
      sekarang: new Date(),
      baris: {
        hakim: jawaban.barisHakim.map((b) => ({ ...b, berjalan: b.tahapan < 15 })),
        panitera: jawaban.barisPanitera.map((b) => ({ ...b, berjalan: true })),
        jurusita: jawaban.barisJurusita.map((b) => ({ ...b, berjalan: true })),
      },
      orang: {
        hakim: HAKIM.map((h) => ({ id: h.hakimId, kode: h.kode, nama: h.nama })),
        panitera: PANITERA.map((p) => ({ id: p.paniteraId, kode: p.kode, nama: p.nama })),
        jurusita: orangJs,
      },
      susunanSk: SK,
      bobot,
      kebendaan,
    });
    periksa("angka di usulan sama dengan hitungan murni yang sama (satu sumber)", st.hakim.every((h) => murni.hakim.orang.find((x) => x.id === h.id).hari30 === h.hari30 && murni.hakim.orang.find((x) => x.id === h.id).persen30 === h.persen30));
  }

  // Perkara kebendaan memakai bobot kebendaan.
  {
    beban.lupakanSimpanan();
    jawaban = dasar();
    jawaban.perkara[0].jenisPerkaraId = 364; // kewarisan
    const u = await layanan.usulanPenunjukan("468/Pdt.G/2026/PA.Dgl", { ...PENGATURAN, susunanSk: SK });
    periksa("perkara kewarisan ditandai kebendaan di statistik", u.statistik.kebendaanPerkara === true);
    periksa("alasan perkara kebendaan menyebut kebendaan lebih dahulu", /^kebendaan 6 bulan/.test(u.statistik.jurusita[0].alasan), u.statistik.jurusita[0].alasan);
    // Juru sita yang sudah memegang kebendaan (Mustini) tidak lagi di depan.
    periksa("kebendaan dibagi tersendiri: juru sita berkebendaan tidak diusulkan", u.pjs.usulan.jurusitaId !== 3, String(u.pjs.usulan.jurusitaId));
  }

  // SK kosong -> tanda dan susunan terpakai tetap dipakai.
  {
    beban.lupakanSimpanan();
    jawaban = dasar();
    jawaban.beban = [
      { susunan: "33,28,31", anggota: 3, perkara: 3 },
      { susunan: "32,26,31", anggota: 3, perkara: 12 },
    ];
    const u = await layanan.usulanPenunjukan("468/Pdt.G/2026/PA.Dgl", { ...PENGATURAN, sk: { nomor: "", tanggal: "" }, susunanSk: [] });
    periksa("SK kosong: ditandai belum memakai SK", u.sk.dipakai === false && /Belum memakai SK - isi di Pengaturan SK Majelis/.test(u.sk.bunyi), u.sk.bunyi);
    periksa("SK kosong: kesesuaian menyebut belum memakai SK", u.kesesuaianSk.status === "belum_ada_sk");
    periksa("SK kosong: usulan tetap berjalan memakai susunan terpakai", u.pmh.anggota.length === 3, String(u.pmh.anggota.length));
  }

  // Pegawai di SK yang tidak aktif ditandai.
  {
    beban.lupakanSimpanan();
    jawaban = dasar();
    const skBasi = [
      { majelisKode: "A", hakimKode: ["A", "C1", "C3"], panitera: [{ kode: "D", id: 1 }, { kode: "D9", id: 99 }] },
      { majelisKode: "B", hakimKode: ["B", "C2", "C3"], panitera: [] },
    ];
    const u = await layanan.usulanPenunjukan("468/Pdt.G/2026/PA.Dgl", {
      ...PENGATURAN,
      susunanSk: skBasi,
      sk: { ...PENGATURAN.sk, peringatan: [{ majelisKode: "A", kode: "D4", nama: "Munifa", alasan: "jabatannya sekarang bukan lagi panitera pengganti" }] },
    });
    const p = u.sk.peringatan.join(" | ");
    periksa("peringatan dari portal ikut tampil (jabatan berganti)", /Munifa.*bukan lagi panitera pengganti/.test(p), p);
    periksa("panitera di SK yang tidak aktif di SIPP ditandai", /panitera D9 tidak aktif di SIPP/.test(p), p);
    periksa("majelis tanpa panitera terikat ditandai", /Majelis B: belum ada panitera pengganti pendamping yang terikat/.test(p), p);
  }

  // Gagal membaca penetapan -> usulan lama tetap jalan.
  {
    beban.lupakanSimpanan();
    jawaban = dasar();
    jawaban.barisHakim = [];
    jawaban.barisPanitera = [];
    jawaban.barisJurusita = [];
    const u = await layanan.usulanPenunjukan("468/Pdt.G/2026/PA.Dgl", { ...PENGATURAN, susunanSk: SK });
    periksa("tanpa data penetapan: statistik kosong, usulan tetap ada", u.ok === true && u.statistik === null && Boolean(u.pjs.usulan));
  }

  // Hanya SELECT.
  periksa("seluruh kueri berupa SELECT", kueri.every((x) => /^\s*SELECT\b/i.test(x.trim())));
  periksa("tidak ada tulisan ke SIPP", kueri.every((x) => !/\b(INSERT|UPDATE|DELETE|DROP|ALTER|REPLACE)\b/i.test(x)));
  periksa("penetapan tingkat pertama disaring (tahapan_id = ?)", kueri.filter((x) => /FROM perkara_hakim_pn bh|FROM perkara_jurusita bjs|FROM perkara_panitera_pn bpp/.test(x)).every((x) => /tahapan_id\s*=\s*\?/.test(x)));

  console.log("");
  console.log(`Hasil: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal > 0 ? 1 : 0);
})().catch((galat) => {
  console.error("GALAT:", galat && galat.stack ? galat.stack : galat);
  process.exit(1);
});
