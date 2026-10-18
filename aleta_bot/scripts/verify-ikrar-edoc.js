"use strict";

/**
 * Verifikasi e-Doc penetapan ikrar talak (ikrarEdocService, 18 Okt 2026).
 * Tanpa basis data / disk SIPP sungguhan: seluruh ketergantungan dipalsukan lewat
 * buatLayanan(deps), jadi aman dijalankan di mana pun dan tidak pernah menulis ke SIPP.
 */

const path = require("path");

const dbPath = require.resolve(path.join(__dirname, "..", "db_config.js"));
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { query(sql, p, cb) { (typeof p === "function" ? p : cb)(null, []); } } };

const edoc = require("../services/ikrarEdocService");

let lulus = 0;
let gagal = 0;
function periksa(nama, kondisi, rinci = "") {
  if (kondisi) {
    lulus += 1;
    console.log(`  OK    ${nama}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}${rinci ? ` - ${rinci}` : ""}`);
  }
}

const AMAR = "<ol><li>Menyatakan perkawinan putus karena perceraian dengan talak satu raj'i;</li><li>Membebankan biaya Rp14.500,-;</li></ol>";
const dasarBaris = () => ({
  jadwal_id: 500,
  perkara_id: 9988,
  tanggal: "2026-10-07",
  ikrar_talak: "Y",
  dihadiri_oleh: 1,
  ditunda: "T",
  alasan_ditunda: "telah ikrar talak",
  keterangan: "Ikrar Telah Dilaksanakan",
  nomor_perkara: "474/Pdt.G/2026/PA.Dgl",
  tanggal_daftar: "2026-07-14",
  ada_baris: 9988,
  status_ikrar: 1,
  amar: AMAR + " ".repeat(40),
  tgl_ikrar: "2026-10-07",
  dok: null,
});

const RTF_BAIK = "{\\rtf1\\ansi{\\info{\\title Penetapan}}Penetapan Ikrar Talak nomor 474/Pdt.G/2026/PA.Dgl\\par}";
const RTF_ALETA = "{\\rtf1\\ansi Penetapan oleh ALETA}";

function bangun(sesuaikan = {}) {
  const catatan = { tulis: [], kueriTulis: [], jejak: [], pindah: [], hapus: [] };
  let baris = { ...dasarBaris(), ...(sesuaikan.baris || {}) };
  const deps = {
    kueri: async (sql, params) => {
      if (/^\s*SELECT j\.id/i.test(sql)) return baris ? [baris] : [];
      if (/FROM perkara_pihak|v_pihak_perkara/i.test(sql)) return [];
      if (/^\s*UPDATE perkara_ikrar_talak/i.test(sql)) {
        catatan.kueriTulis.push({ sql, params });
        return { affectedRows: sesuaikan.barisTerubah === undefined ? 1 : sesuaikan.barisTerubah };
      }
      return [];
    },
    kolomAda: async () => sesuaikan.kolomAda !== false,
    kenaliDokumen: (b) => (b.subarray(0, 5).toString("latin1").startsWith("{\\rtf") ? "rtf" : "lain"),
    isiBlangko: async (params) => {
      catatan.isiParams = params;
      if (sesuaikan.isiGalat) throw new Error("jembatan mati");
      if (sesuaikan.isi) return sesuaikan.isi;
      return { ok: true, kosong: [], rtfBase64: Buffer.from(sesuaikan.rtf || RTF_BAIK, "latin1").toString("base64") };
    },
    ketuaMajelis: async () => sesuaikan.ketua || { ok: true, username: "fahri", fullname: "Fahri" },
    periksaAkar: () => ({ dapatDitulis: true, akar: path.join(__dirname, "tmp-akar-uji-edoc") }),
    tulisBerkas: async (penuh, isi) => {
      catatan.tulis.push({ penuh, isi });
    },
    pindahBerkas: async (dari, ke) => {
      catatan.pindah.push({ dari, ke });
      return true;
    },
    hapusBerkas: (penuh) => catatan.hapus.push(penuh),
    samakanPemilik: () => {},
    catatJejak: async (j) => {
      catatan.jejak.push(j);
      return true;
    },
    sekarang: () => new Date("2026-10-18T02:00:00Z"),
    capWaktu: () => 1792000000,
  };
  return { layanan: edoc.buatLayanan(deps), catatan, ubahBaris: (b) => (baris = b) };
}

(async () => {
  console.log("== Pilihan blangko menurut kehadiran ==");
  periksa("semua hadir (1) -> [90a]", edoc.pilihBlangkoIkrar(1).berkas.startsWith("[90a]"));
  periksa("Pemohon saja (2) -> [90]", edoc.pilihBlangkoIkrar(2).berkas.startsWith("[90] "));
  periksa("Pemohon tidak hadir (3/4) ditolak", edoc.pilihBlangkoIkrar(3).alasan === "pemohon_tidak_hadir" && edoc.pilihBlangkoIkrar(4).alasan === "pemohon_tidak_hadir");
  periksa("kehadiran kosong ditolak (tidak ditebak)", edoc.pilihBlangkoIkrar(null).alasan === "kehadiran_ikrar_tidak_jelas");
  periksa("folder blangko = 1a Perceraian CT milik Derry", edoc.FOLDER_BLANGKO_IKRAR === "derry_briantono/1a Perceraian CT");

  console.log("== Nama dan jalur berkas (menurut fileupload_c.php) ==");
  periksa(
    "nama berkas persis contoh data satker",
    edoc.namaBerkasIkrar("474/Pdt.G/2026/PA.Dgl", 1791343344, "rtf") === "PADgl_2026_PdtG_474_penetapan_ikrar_1791343344.rtf"
  );
  periksa(
    "jalur: tahun/bulan dari tanggal pendaftaran",
    edoc.jalurIkrar("474/Pdt.G/2026/PA.Dgl", "2026-07-14", 1791343344, "rtf") === "resources/file/doc/2026/07/PADgl_2026_PdtG_474_penetapan_ikrar_1791343344.rtf"
  );
  periksa("nomor tak berbagian empat -> kosong", edoc.namaBerkasIkrar("474/Pdt.G/2026", 1, "rtf") === "");
  periksa("ekstensi asing -> kosong", edoc.namaBerkasIkrar("474/Pdt.G/2026/PA.Dgl", 1, "exe") === "");
  periksa("nama berkas tanpa kata aleta", !/aleta/i.test(edoc.namaBerkasIkrar("474/Pdt.G/2026/PA.Dgl", 1, "rtf")));

  console.log("== Kering (rencana saja) ==");
  {
    const { layanan, catatan } = bangun();
    const h = await layanan.unggahPenetapanIkrar({ jadwalId: 500, operator: "tester", ip: "10.0.0.5", kering: true });
    periksa("kering ok", h.ok === true && h.kering === true, h.alasan);
    periksa("kering: blangko [90a], atas ketua majelis", /^\[90a\]/.test(h.blangko.berkas) && h.atasNama.username === "fahri");
    periksa("kering: tidak menulis berkas maupun baris", catatan.tulis.length === 0 && catatan.kueriTulis.length === 0);
  }

  console.log("== Unggah sungguhan ==");
  {
    const { layanan, catatan } = bangun();
    const h = await layanan.unggahPenetapanIkrar({ jadwalId: 500, perkaraId: 9988, operator: "tester", ip: "10.0.0.5", kering: false });
    periksa("unggah ok", h.ok === true, `${h.alasan} ${h.pesan || ""}`);
    periksa("blangko disusun lewat mesin: folder+berkas+perkara", catatan.isiParams && catatan.isiParams.folder === edoc.FOLDER_BLANGKO_IKRAR && /^\[90a\]/.test(catatan.isiParams.berkas) && catatan.isiParams.perkaraId === 9988);
    periksa("berkas ditulis sekali ke jalur SIPP", catatan.tulis.length === 1 && /resources[\\/]file[\\/]doc[\\/]2026[\\/]07[\\/]PADgl_2026_PdtG_474_penetapan_ikrar_1792000000\.rtf$/.test(catatan.tulis[0].penuh));
    periksa("satu UPDATE ikrar_talak_dok bersyarat kosong", catatan.kueriTulis.length === 1 && /SET ikrar_talak_dok = \? WHERE perkara_id = \? AND \(ikrar_talak_dok IS NULL OR ikrar_talak_dok = ''\)/.test(catatan.kueriTulis[0].sql));
    periksa("UPDATE hanya menyentuh kolom e-Doc (tanggal substantif tak diubah)", !/tgl_ikrar_talak|tanggal|status_penetapan|amar/i.test(catatan.kueriTulis[0].sql));
    periksa("jejak jujur: edoc_ikrar, akun ketua, operator penekan", catatan.jejak.length === 1 && catatan.jejak[0].jenis === "edoc_ikrar" && catatan.jejak[0].akunSipp === "fahri" && catatan.jejak[0].operator === "tester" && catatan.jejak[0].berhasil === true);
    periksa("grup {\\info{\\title}} tidak memuat aleta; isi tulis tanpa kata aleta", !/aleta/i.test(catatan.tulis[0].isi.toString("latin1")));
  }

  console.log("== Penolakan ==");
  {
    const t = async (sesuaikan, kode, pakai = {}) => {
      const { layanan, catatan } = bangun(sesuaikan);
      const h = await layanan.unggahPenetapanIkrar({ jadwalId: 500, operator: "t", kering: false, ...pakai });
      periksa(`${kode} ditolak, tanpa menulis`, h.ok === false && h.alasan === kode && catatan.tulis.length === 0 && catatan.kueriTulis.length === 0, `${h.alasan}`);
      periksa(`${kode}: penolakan ikut tercatat di jejak`, catatan.jejak.length === 1 && catatan.jejak[0].berhasil === false);
      return h;
    };
    await t({ baris: { ikrar_talak: "T" } }, "bukan_sidang_ikrar");
    await t({ baris: { alasan_ditunda: "Pemohon tidak hadir ikrar", keterangan: null } }, "ikrar_belum_dinyatakan_terlaksana");
    await t({ baris: { status_ikrar: null, amar: null, tgl_ikrar: null } }, "form_ikrar_belum_terisi");
    await t({ baris: { tgl_ikrar: "2026-10-01" } }, "form_ikrar_belum_terisi");
    await t({ baris: { dihadiri_oleh: 3 } }, "pemohon_tidak_hadir");
    await t({ baris: { dihadiri_oleh: null } }, "kehadiran_ikrar_tidak_jelas");
    await t({ baris: { dok: "resources/file/doc/2026/07/PADgl_2026_PdtG_474_penetapan_ikrar_1.rtf" } }, "sudah_ada");
    await t({ ketua: { ok: false, alasan: "akun_hakim_ganda", calon: ["a", "b"] } }, "akun_hakim_ganda");
    await t({ kolomAda: false }, "kolom_ikrar_talak_dok_tidak_ada");
    await t({ isiGalat: true }, "blangko_tidak_terbaca");
    await t({ isi: { ok: false, sebab: "Blangko tidak ditemukan." } }, "blangko_tidak_terbaca");
    const kosong = await t({ isi: { ok: true, kosong: [{ noVar: "1182", nama: "Tgl Sidang Ikrar Talak" }], rtfBase64: Buffer.from(RTF_BAIK, "latin1").toString("base64") } }, "blangko_ikrar_masih_kosong");
    periksa("isian kosong disebut satu per satu", kosong.kosong && /1182/.test(kosong.kosong[0]));
    await t({ rtf: RTF_ALETA }, "isi_berkas_menyebut_aleta");
  }

  console.log("== Mengganti e-Doc yang ada ==");
  {
    const lama = "resources/file/doc/2026/07/PADgl_2026_PdtG_474_penetapan_ikrar_1791343344.rtf";
    const { layanan, catatan } = bangun({ baris: { dok: lama } });
    const h = await layanan.unggahPenetapanIkrar({ jadwalId: 500, operator: "t", kering: false, ganti: true });
    periksa("ganti ok, UPDATE bersyarat nilai LAMA", h.ok === true && /AND ikrar_talak_dok = \?/.test(catatan.kueriTulis[0].sql) && catatan.kueriTulis[0].params[2] === lama, h.alasan);
    periksa("berkas lama dipindah ke folder terhapus, tidak dihapus", catatan.pindah.length === 1 && /2026[\\/]07[\\/]terhapus[\\/]PADgl_2026_PdtG_474_penetapan_ikrar_1791343344_/.test(catatan.pindah[0].ke) && catatan.hapus.length === 0);
  }
  {
    const { layanan, catatan } = bangun({ barisTerubah: 0 });
    const h = await layanan.unggahPenetapanIkrar({ jadwalId: 500, operator: "t", kering: false });
    periksa("orang lain mengisi lebih dulu: berkas kita dibuang, miliknya dibiarkan", h.ok === false && h.alasan === "sudah_ada" && catatan.hapus.length === 1);
  }

  console.log(`\nHasil: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal ? 1 : 0);
})().catch((e) => {
  console.error("GALAT", e);
  process.exit(1);
});
