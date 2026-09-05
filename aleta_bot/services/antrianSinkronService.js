"use strict";

/**
 * Mendaftarkan jadwal sidang ALETA ke aplikasi antrian sidang.
 *
 * ============================================================================
 * SATU-SATUNYA TEMPAT ALETA MENULIS KE APLIKASI LAIN
 * ============================================================================
 *
 * Seluruh bagian ALETA yang menyentuh basis data di luar dirinya sendiri
 * hanya MEMBACA - SIPP dibaca, antrian dibaca, e-Court dikikis. Berkas ini
 * berbeda: ia menulis baris ke sipp_turunan_antrian.antrian_sidang, tabel
 * milik aplikasi antrian yang berjalan di 192.168.10.10/antrian dan dipakai
 * mesin antrian di ruang tunggu.
 *
 * Karena itu seluruh rancangannya berpihak pada TIDAK MENULIS:
 *
 *   1. UJI KERING adalah perilaku bawaan. Tanpa terapkan:true, yang
 *      dikembalikan hanya daftar apa yang AKAN ditambahkan.
 *
 *   2. HANYA MENAMBAH. Tidak ada UPDATE, tidak ada DELETE. Baris yang sudah
 *      ada di aplikasi antrian adalah miliknya - termasuk baris yang menurut
 *      SIPP sudah tidak ada jadwalnya. Menghapusnya berarti menghilangkan
 *      antrian orang yang mungkin sudah memegang nomornya.
 *
 *   3. KOLOM MILIK MESIN TIDAK DISENTUH. pihak_1, pihak_2, saksi, dan
 *      disidang diisi mesin antrian saat orang benar-benar datang dan saat
 *      petugas memanggil. ALETA mendaftarkan perkaranya; NOMORNYA tetap lahir
 *      dari pengambilan, bukan dari pendaftaran. Baris baru karena itu masuk
 *      sebagai "belum diambil" dan tidak menggeser nomor siapa pun.
 *
 *   4. STRUKTUR TABELNYA DIBACA, BUKAN DITEBAK. Bila ada kolom wajib yang
 *      ALETA tidak tahu cara mengisinya, sinkronisasi DITOLAK dengan
 *      menyebutkan kolomnya - bukan dicoba lalu gagal separuh jalan.
 *
 * ============================================================================
 * ONLINE DAN OFFLINE
 * ============================================================================
 *
 * Kolom `online` menandai ASAL pengambilan: 1 bila pihak mengambil antrian
 * lewat WhatsApp, 0 bila mengambil di mesin antrian ruang tunggu. Keduanya
 * masuk SATU deret yang sama, diurut menurut waktu ambil - lihat
 * antrianSidangService.
 *
 * Baris yang didaftarkan ALETA belum diambil siapa pun, jadi asalnya belum
 * ditentukan. Ia ditulis 0 - yang berarti "belum dari jalur online" - dan akan
 * disetel mesin antrian atau bot WhatsApp ketika pengambilannya benar-benar
 * terjadi.
 */

const externalDbService = require("./externalDbService");
const logService = require("./logService");
const { cleanText } = require("./ecourtTextService");

/** Sambungan yang sama dengan pembaca antrian - lihat antrianSidangService. */
const KUNCI_KONEKSI = "antrian_sidang";
const SKEMA = "sipp_turunan_antrian";
const TABEL = "antrian_sidang";
const TABEL_LENGKAP = `${SKEMA}.${TABEL}`;

/**
 * Kolom yang boleh diisi ALETA, beserta asal nilainya dari jadwal SIPP.
 *
 * Yang TIDAK ada di sini tidak akan pernah ditulis - termasuk kolom milik
 * mesin antrian.
 */
const KOLOM_DIISI = [
  // Diisi id baris jadwal SIPP, mengikuti aplikasi antrian. Kolom ini NOT
  // NULL dan tidak berpenomoran otomatis, jadi ia HARUS ditulis - tanpa
  // ini pemeriksa struktur menolak seluruh sinkronisasi.
  "id",
  "perkara_id",
  "tanggal_sidang",
  "jam_sidang",
  "majelis_hakim_kode",
  "ruangan_id",
  "no_ruang",
  "nama_petugas",
  "online",
];

/**
 * Kolom yang diisi mesin antrian sendiri. Disebutkan supaya jelas bahwa
 * ketiadaannya di KOLOM_DIISI memang disengaja, bukan terlupa.
 */
const KOLOM_MESIN = ["pihak_1", "pihak_2", "saksi", "disidang"];

function tanggalSah(nilai) {
  const teks = String(nilai || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(teks) ? teks : "";
}

/**
 * Membaca struktur tabel antrian.
 *
 * Yang dicari bukan sekadar daftar kolom, melainkan kolom WAJIB yang ALETA
 * tidak tahu cara mengisinya - kolom NOT NULL tanpa nilai bawaan dan bukan
 * penomoran otomatis. Selama ada satu saja, menulis berarti menabrak galat di
 * tengah jalan, dan baris separuh jadi di aplikasi antrian jauh lebih sulit
 * dibereskan daripada penolakan yang jelas di awal.
 */
async function periksaStruktur() {
  let baris;
  try {
    baris = await externalDbService.query(KUNCI_KONEKSI, `SHOW COLUMNS FROM ${TABEL_LENGKAP}`, []);
  } catch (galat) {
    return {
      ok: false,
      alasan: `Struktur tabel antrian tidak terbaca: ${sebutGalat(galat)}`,
      kolom: [],
      wajibTakDikenal: [],
    };
  }

  const daftar = (Array.isArray(baris) ? baris : []).map((row) => ({
    nama: String(row.Field || ""),
    bolehKosong: String(row.Null || "").toUpperCase() === "YES",
    bawaan: row.Default,
    tambahan: String(row.Extra || "").toLowerCase(),
  }));

  if (daftar.length === 0) {
    return { ok: false, alasan: "Tabel antrian tidak punya kolom yang terbaca.", kolom: [], wajibTakDikenal: [] };
  }

  const dikenal = new Set([...KOLOM_DIISI, ...KOLOM_MESIN]);
  const wajibTakDikenal = daftar
    .filter(
      (k) =>
        !k.bolehKosong &&
        k.bawaan === null &&
        !k.tambahan.includes("auto_increment") &&
        !dikenal.has(k.nama)
    )
    .map((k) => k.nama);

  return {
    ok: wajibTakDikenal.length === 0,
    alasan:
      wajibTakDikenal.length === 0
        ? ""
        : `Ada kolom wajib yang ALETA tidak tahu cara mengisinya: ${wajibTakDikenal.join(", ")}. Sinkronisasi dihentikan supaya tidak ada baris separuh jadi di aplikasi antrian.`,
    kolom: daftar.map((k) => k.nama),
    wajibTakDikenal,
  };
}

function sebutGalat(galat) {
  const pesan = externalDbService.sanitizeError
    ? externalDbService.sanitizeError(galat)
    : String(galat && galat.message ? galat.message : galat);
  return String(pesan).slice(0, 200);
}

/** Perkara yang SUDAH terdaftar di antrian pada tanggal itu. */
async function sudahTerdaftar(tanggal) {
  const baris = await externalDbService.query(
    KUNCI_KONEKSI,
    `SELECT a.perkara_id AS perkaraId
       FROM ${TABEL_LENGKAP} a
      WHERE DATE(a.tanggal_sidang) = ?`,
    [tanggal]
  );
  return new Set((Array.isArray(baris) ? baris : []).map((row) => String(row.perkaraId || "")));
}

/**
 * Menyusun daftar apa yang perlu ditambahkan - fungsi murni, tanpa basis data.
 *
 * Dipisah supaya keputusannya dapat diuji tanpa menyentuh aplikasi antrian
 * sama sekali. Yang menulis hanyalah sinkronkan(); yang MEMUTUSKAN ada di
 * sini, dan itulah bagian yang paling perlu dijaga.
 */
function susunTambahan({ tanggal, sidang = [], sudahAda = new Set() }) {
  const hari = tanggalSah(tanggal);
  const akanDitambah = [];
  const dilewati = [];

  const terlihat = new Set();

  for (const baris of Array.isArray(sidang) ? sidang : []) {
    const perkaraId = String((baris && baris.perkaraId) || "").trim();
    if (!perkaraId) {
      dilewati.push({ perkaraId: "", nomorPerkara: "", sebab: "perkara_id tidak terbaca" });
      continue;
    }

    // Satu perkara dapat punya lebih dari satu baris jadwal pada hari yang
    // sama - sidang yang ditunda lalu dijadwalkan ulang, misalnya. Antriannya
    // tetap satu: yang mengantre orangnya, bukan agendanya.
    if (terlihat.has(perkaraId)) continue;
    terlihat.add(perkaraId);

    // Tanpa id jadwal, barisnya tidak dapat ditulis sama sekali - dan
    // menebak angkanya berarti menabrak baris milik jadwal lain.
    const sidangId = Number((baris && baris.sidangId) || 0);
    if (!Number.isSafeInteger(sidangId) || sidangId <= 0) {
      dilewati.push({
        perkaraId,
        nomorPerkara: cleanText(baris.nomorPerkara),
        sebab: "id jadwal sidang tidak terbaca",
      });
      continue;
    }

    if (sudahAda.has(perkaraId)) {
      dilewati.push({
        perkaraId,
        nomorPerkara: cleanText(baris.nomorPerkara),
        sebab: "sudah terdaftar di aplikasi antrian",
      });
      continue;
    }

    const tanggalBaris = tanggalSah(baris.tanggalSidang) || hari;
    if (!tanggalBaris) {
      dilewati.push({
        perkaraId,
        nomorPerkara: cleanText(baris.nomorPerkara),
        sebab: "tanggal sidang tidak terbaca",
      });
      continue;
    }

    akanDitambah.push({
      perkaraId,
      nomorPerkara: cleanText(baris.nomorPerkara),
      sidangId,
      tanggalSidang: tanggalBaris,
      jamSidang: cleanText(baris.jamSidang),
      majelisKode: cleanText(baris.majelisKode),
      ruanganId: Number.isFinite(Number(baris.ruanganId)) ? Number(baris.ruanganId) : null,
      noRuang: Number.isFinite(Number(baris.noRuang)) ? Number(baris.noRuang) : null,
      namaPetugas: cleanText(baris.namaPetugas),
    });
  }

  return { akanDitambah, dilewati };
}

/**
 * Menjalankan sinkronisasi.
 *
 * @param {{tanggal: string, sidang: Array, terapkan?: boolean, olehSiapa?: string}} args
 */
async function sinkronkan({ tanggal, sidang = [], terapkan = false, olehSiapa = "" } = {}) {
  const hari = tanggalSah(tanggal);
  if (!hari) {
    return { ok: false, alasan: "Tanggal sinkronisasi tidak sah.", ujiKering: !terapkan };
  }

  const struktur = await periksaStruktur();
  if (!struktur.ok) {
    return { ok: false, alasan: struktur.alasan, ujiKering: !terapkan, struktur };
  }

  let sudahAda;
  try {
    sudahAda = await sudahTerdaftar(hari);
  } catch (galat) {
    return {
      ok: false,
      alasan: `Daftar antrian yang sudah ada tidak terbaca: ${sebutGalat(galat)}`,
      ujiKering: !terapkan,
    };
  }

  const { akanDitambah, dilewati } = susunTambahan({ tanggal: hari, sidang, sudahAda });

  // Uji kering adalah perilaku bawaan. Yang memanggil harus menyatakan
  // niatnya, bukan sebaliknya.
  if (!terapkan) {
    return {
      ok: true,
      ujiKering: true,
      tanggal: hari,
      akanDitambah,
      dilewati,
      ditambahkan: 0,
      gagal: [],
    };
  }

  // Kolom yang benar-benar ada di tabel saja yang ditulis. Aplikasi antrian
  // dapat berbeda versi antar pengadilan, dan menulis kolom yang tidak ada
  // akan menggagalkan seluruh sinkronisasi.
  const adaKolom = new Set(struktur.kolom);
  const kolomPakai = KOLOM_DIISI.filter((k) => adaKolom.has(k));

  const nilaiKolom = (baris, kolom) => {
    switch (kolom) {
      case "id":
        return baris.sidangId;
      case "perkara_id":
        return baris.perkaraId;
      case "tanggal_sidang":
        return baris.tanggalSidang;
      case "jam_sidang":
        return baris.jamSidang || null;
      case "majelis_hakim_kode":
        return baris.majelisKode || null;
      case "ruangan_id":
        return baris.ruanganId;
      case "no_ruang":
        return baris.noRuang;
      case "nama_petugas":
        return baris.namaPetugas || null;
      // Belum diambil siapa pun, jadi asalnya belum ditentukan. Mesin antrian
      // atau bot WhatsApp yang menyetelnya saat pengambilan terjadi.
      case "online":
        return 0;
      default:
        return null;
    }
  };

  const isian = kolomPakai.map(() => "?").join(", ");
  const sql = `INSERT INTO ${TABEL_LENGKAP} (${kolomPakai.join(", ")}) VALUES (${isian})`;

  let ditambahkan = 0;
  const gagal = [];

  for (const baris of akanDitambah) {
    try {
      await externalDbService.query(
        KUNCI_KONEKSI,
        sql,
        kolomPakai.map((k) => nilaiKolom(baris, k))
      );
      ditambahkan += 1;
    } catch (galat) {
      // Satu baris yang gagal tidak menghentikan sisanya - tetapi tiap
      // kegagalan disebutkan, bukan dihitung sebagai berhasil.
      gagal.push({ perkaraId: baris.perkaraId, nomorPerkara: baris.nomorPerkara, sebab: sebutGalat(galat) });
    }
  }

  // Menulis ke aplikasi lain selalu dicatat, berhasil maupun tidak.
  void logService.logSecurityEvent({
    eventType: "antrian_sidang_disinkronkan",
    severity: "warning",
    message: `Jadwal sidang didaftarkan ke aplikasi antrian: ${ditambahkan} baris.`,
    metadata: {
      tanggal: hari,
      ditambahkan,
      dilewati: dilewati.length,
      gagal: gagal.length,
      olehSiapa: String(olehSiapa || ""),
    },
  });

  return {
    ok: true,
    ujiKering: false,
    tanggal: hari,
    akanDitambah,
    dilewati,
    ditambahkan,
    gagal,
  };
}

module.exports = {
  KOLOM_DIISI,
  KOLOM_MESIN,
  KUNCI_KONEKSI,
  TABEL_LENGKAP,
  periksaStruktur,
  sinkronkan,
  sudahTerdaftar,
  susunTambahan,
};
