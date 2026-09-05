"use strict";

/**
 * Status satu perkara, dari pendaftaran sampai produk pengadilan.
 *
 * ============================================================================
 * SATU PERKARA, SATU LAYAR
 * ============================================================================
 *
 * Jadwal Sidang menjawab "hari ini sidang apa saja". Layar ini menjawab
 * pertanyaan yang berbeda: "perkara nomor sekian itu bagaimana keadaannya" -
 * pertanyaan yang datang dari meja pelayanan, dari pimpinan, dan dari majelis
 * yang menyiapkan berkas.
 *
 * Karena itu isinya menyusuri perkara dari awal: didaftarkan kapan, sudah
 * berjalan berapa lama, siapa yang menanganinya, sudah sampai sidang keberapa,
 * sudah diputus atau belum, dan sesudah putus sudah sampai mana.
 *
 * ============================================================================
 * PENCARIAN MENERIMA ANGKA SAJA
 * ============================================================================
 *
 * Petugas mengingat "419", bukan "419/Pdt.G/2026/PA.Dgl". Nomor urut saja
 * dapat cocok pada beberapa perkara - Pdt.G, Pdt.P, tahun berbeda - dan
 * itulah sebabnya pencarian mengembalikan DAFTAR, bukan langsung membuka satu.
 * Membuka yang pertama begitu saja berarti menampilkan perkara yang keliru
 * tanpa ada yang menyadarinya.
 *
 * ============================================================================
 * SIPP HANYA DIBACA
 * ============================================================================
 *
 * Seluruh kueri di berkas ini SELECT, dan nilai dari luar selalu masuk sebagai
 * parameter.
 */

const db = require("../db_config");
const { cleanText, normalizeCaseNumber } = require("./ecourtTextService");
const sippJadwalSidangService = require("./sippJadwalSidangService");
const sippKonteksService = require("./sippKonteksService");
const ecourtStoreService = require("./ecourtStoreService");
const ecourtPanggilanService = require("./ecourtPanggilanService");
const penilaianPerkaraService = require("./penilaianPerkaraService");
const analisaPerkaraService = require("./analisaPerkaraService");
const penilaianSippService = require("./penilaianSippService");
const sippTahapanService = require("./sippTahapanService");
const putusanEcourtService = require("./putusanEcourtService");

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

function isoTanggal(nilai) {
  if (!nilai) return "";
  if (nilai instanceof Date) {
    const bulan = String(nilai.getMonth() + 1).padStart(2, "0");
    const hari = String(nilai.getDate()).padStart(2, "0");
    return `${nilai.getFullYear()}-${bulan}-${hari}`;
  }
  return cleanText(nilai).slice(0, 10);
}

/** Selisih hari kalender antara dua tanggal, atau null. */
function selisihHari(dari, sampai) {
  if (!dari) return null;
  const urai = (teks) => {
    const cocok = String(teks).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!cocok) return null;
    return new Date(Number(cocok[1]), Number(cocok[2]) - 1, Number(cocok[3]));
  };
  const awal = urai(dari);

  // Hari ini dipotong ke tengah malam, sama seperti tanggal yang diurai.
  // Memakai jam sekarang membandingkan tengah malam dengan waktu berjalan,
  // dan pembulatannya menambah satu hari begitu lewat tengah hari - perkara
  // yang didaftarkan pagi ini tercatat "1 hari berjalan" pada sore yang sama.
  const hariIni = new Date();
  const akhir = sampai
    ? urai(sampai)
    : new Date(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate());

  if (!awal || !akhir) return null;
  return Math.round((akhir - awal) / 86400000);
}

/**
 * Mencari perkara.
 *
 * ============================================================================
 * SATU KOTAK UNTUK BANYAK BENTUK MASUKAN
 * ============================================================================
 *
 * Petugas mengetik apa yang diingatnya, dan yang diingat berbeda-beda: nomor
 * urutnya saja ("419"), sepotong nomor perkara, nama pihak, atau jenis
 * perkaranya. Menuntut mereka memilih dulu "cari berdasarkan apa" hanya
 * memindahkan pekerjaan menebak dari program ke orang.
 *
 * Karena itu satu kotak menerima semuanya, dan bentuk masukannya dikenali
 * sendiri:
 *
 *   angka saja        -> nomor urut perkara, cocok persis
 *   ada garis miring  -> sepotong nomor perkara
 *   selain itu        -> dicoba pada nomor perkara, jenis perkara, DAN nama
 *                        pihak sekaligus
 *
 * ============================================================================
 * SARINGAN MEMPERSEMPIT, BUKAN MENGGANTIKAN
 * ============================================================================
 *
 * Saringan jenis, status, tahun, dan alur perkara dapat dipakai TANPA kata
 * cari - itulah cara menjawab "perkara cerai gugat 2025 yang belum putus ada
 * berapa". Bila keduanya diisi, keduanya berlaku bersamaan.
 *
 * ============================================================================
 * NAMA PIHAK DICARI LEWAT SUBKUERI EXISTS
 * ============================================================================
 *
 * Menyambung langsung ke tabel pihak menggandakan baris perkara sebanyak
 * pihaknya, dan perkara dengan lima tergugat akan muncul lima kali. EXISTS
 * menjawab pertanyaan yang sebenarnya - "apakah ADA pihak yang namanya
 * begini" - tanpa menggandakan apa pun.
 */
/**
 * Keadaan relaas, sebagai daftar tertutup.
 *
 * ket_temu bukan "bertemu atau tidak" melainkan CARA pemanggilannya - dibaca
 * dari SIPP yang berjalan:
 *
 *   Y  bertemu langsung          S  gagal
 *   T  lewat kantor desa         E  elektronik ke kuasa hukum
 *   R  panggilan RRI             M  radiogram RRI
 *   W  website dan pengumuman    P  papan pengumuman
 *
 * Empat yang terakhir adalah cara memanggil pihak yang tidak diketahui
 * keberadaannya - itulah yang dimaksud "ghaib".
 */
const RELAAS_SYARAT = {
  retur:
    `EXISTS (SELECT 1 FROM perkara_pelaksanaan_relaas r
              WHERE r.perkara_id = p.perkara_id
                AND (r.ket_hasil_relaas LIKE '%retur%' OR r.status_pos = 2))`,
  gagal:
    "EXISTS (SELECT 1 FROM perkara_pelaksanaan_relaas r WHERE r.perkara_id = p.perkara_id AND r.ket_temu = 'S')",
  ghaib:
    `EXISTS (SELECT 1 FROM perkara_pelaksanaan_relaas r
              WHERE r.perkara_id = p.perkara_id AND r.ket_temu IN ('R', 'M', 'W', 'P'))`,
  bertemu:
    "EXISTS (SELECT 1 FROM perkara_pelaksanaan_relaas r WHERE r.perkara_id = p.perkara_id AND r.ket_temu = 'Y')",
  // Belum ada satu pun relaas tercatat - beda dengan relaas yang gagal.
  tanpa_relaas:
    "NOT EXISTS (SELECT 1 FROM perkara_pelaksanaan_relaas r WHERE r.perkara_id = p.perkara_id)",
};

/**
 * Umur perkara yang belum putus.
 *
 * Angka bulannya HARUS dari daftar tertutup: INTERVAL di MySQL tidak dapat
 * diparameterkan, sehingga angka yang datang dari peramban akan menjadi
 * bagian teks perintah.
 *
 * Lima bulan adalah ambang SEMA 2/2014 - inilah pertanyaan yang ditanyakan
 * pengawasan tiap bulan, dan sebelumnya tidak dapat ditanyakan sama sekali.
 */
const UMUR_SYARAT = {
  lewat3bulan:
    `NOT EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.tanggal_putusan IS NOT NULL)
     AND p.tanggal_pendaftaran < DATE_SUB(CURDATE(), INTERVAL 3 MONTH)`,
  lewat5bulan:
    `NOT EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.tanggal_putusan IS NOT NULL)
     AND p.tanggal_pendaftaran < DATE_SUB(CURDATE(), INTERVAL 5 MONTH)`,
};

/** Perkara masuk lewat e-Court atau didaftarkan di meja. */
const ECOURT_SYARAT = {
  ya: "EXISTS (SELECT 1 FROM perkara_efiling_id k WHERE k.perkara_id = p.perkara_id)",
  tidak: "NOT EXISTS (SELECT 1 FROM perkara_efiling_id k WHERE k.perkara_id = p.perkara_id)",
};

/** Kunci umur perkara yang diterima, untuk ditampilkan di layar. */
const UMUR_PENCARIAN = [
  { kunci: "lewat3bulan", label: "Belum putus, lewat 3 bulan" },
  { kunci: "lewat5bulan", label: "Belum putus, lewat 5 bulan (SEMA 2/2014)" },
];

/** Kunci relaas yang diterima, untuk ditampilkan di layar. */
const RELAAS_PENCARIAN = [
  { kunci: "retur", label: "Relaas retur" },
  { kunci: "gagal", label: "Pemanggilan gagal" },
  { kunci: "ghaib", label: "Dipanggil sebagai ghaib" },
  { kunci: "bertemu", label: "Bertemu langsung" },
  { kunci: "tanpa_relaas", label: "Belum ada relaas" },
];

/** Jenis putusan yang benar-benar ada di register, untuk pilihan di layar. */
const PUTUSAN_PENCARIAN = [
  "Dikabulkan",
  "Ditolak",
  "Tidak Dapat Diterima",
  "Dicabut",
  "Digugurkan",
  "Dicoret dari Register",
];

/**
 * Memotong sepenggal teks di sekitar kata yang dicari.
 *
 * Pertimbangan hukum panjangnya bisa ribuan huruf. Menampilkannya utuh di
 * kartu hasil berarti kartunya tidak dapat dibaca sama sekali; menampilkan
 * awalnya saja berarti bagian yang dicari justru tidak kelihatan.
 */
function penggalan(teks, kata, lebar = 70) {
  const isiTeks = String(teks || "").replace(/\s+/g, " ").trim();
  const cari = String(kata || "").trim();
  if (!isiTeks) return "";
  if (!cari) return isiTeks.slice(0, lebar * 2);

  const posisi = isiTeks.toLowerCase().indexOf(cari.toLowerCase());
  if (posisi < 0) return isiTeks.slice(0, lebar * 2);

  const mulai = Math.max(0, posisi - lebar);
  const akhir = Math.min(isiTeks.length, posisi + cari.length + lebar);
  return (mulai > 0 ? "…" : "") + isiTeks.slice(mulai, akhir) + (akhir < isiTeks.length ? "…" : "");
}

/**
 * ============================================================================
 * MENJELASKAN MENGAPA SEBUAH PERKARA MUNCUL
 * ============================================================================
 *
 * Kartu hasil sebelumnya hanya memuat nomor, jenis, tanggal daftar, dan
 * keadaan putusan. Saat yang dicari nama juru sita, alamat desa, atau sebuah
 * kalimat di pertimbangan hukum, tidak satu pun dari keempatnya menyebut
 * kata yang diketik - dan petugas menatap daftar berisi dua puluh nomor
 * perkara tanpa tahu mana yang benar-benar dimaksud.
 *
 * Dicari SESUDAH perkaranya ketemu, dibatasi pada perkara yang memang
 * dikembalikan - satu kueri untuk tiap jenis keterangan, bukan satu kueri
 * untuk tiap baris.
 */
async function lampirkanCocok(hasil, kriteria) {
  const daftarId = hasil.map((x) => x.perkaraId).filter(Boolean);
  if (daftarId.length === 0) return;

  const peta = new Map(hasil.map((x) => [x.perkaraId, x]));
  const isian = daftarId.map(() => "?").join(", ");

  const tambah = (perkaraId, medan, nilaiCocok) => {
    const baris = peta.get(String(perkaraId));
    if (!baris || !nilaiCocok) return;
    // Satu keterangan per medan sudah cukup menjelaskan. Perkara dengan
    // sepuluh pihak yang semuanya cocok tidak perlu sepuluh lencana.
    if (baris.cocok.some((x) => x.medan === medan)) return;
    baris.cocok.push({ medan, nilai: String(nilaiCocok).slice(0, 200) });
  };

  const jalankan = async (sql, params) => {
    try {
      return await runQuery(sql, params);
    } catch {
      // SIPP versi lain bisa saja tidak punya tabelnya. Keterangan yang
      // hilang tidak boleh menghilangkan hasil pencariannya.
      return [];
    }
  };

  const kataBebas = cleanText(kriteria.kata);
  const pihakDicari = cleanText(kriteria.namaPihak) || kataBebas;

  const pekerjaan = [];

  if (pihakDicari) {
    pekerjaan.push(
      jalankan(
        `SELECT vp.perkara_id AS perkaraId, vp.nama AS nama
           FROM v_pihak_perkara vp
          WHERE vp.perkara_id IN (${isian}) AND vp.nama LIKE ?`,
        [...daftarId, `%${pihakDicari}%`]
      ).then((baris) => baris.forEach((x) => tambah(x.perkaraId, "Pihak", x.nama)))
    );
  }

  if (cleanText(kriteria.alamatPihak)) {
    const alamat = cleanText(kriteria.alamatPihak);
    pekerjaan.push(
      jalankan(
        `SELECT vp.perkara_id AS perkaraId, vp.alamat AS alamat
           FROM v_pihak_perkara vp
          WHERE vp.perkara_id IN (${isian}) AND vp.alamat LIKE ?`,
        [...daftarId, `%${alamat}%`]
      ).then((baris) => baris.forEach((x) => tambah(x.perkaraId, "Alamat", penggalan(x.alamat, alamat))))
    );
  }

  const jabatan = [
    [cleanText(kriteria.hakim) || cleanText(kriteria.petugas), "perkara_hakim_pn", "hakim_nama", "Hakim"],
    [cleanText(kriteria.panitera) || cleanText(kriteria.petugas), "perkara_panitera_pn", "panitera_nama", "Panitera Pengganti"],
    [cleanText(kriteria.jurusita) || cleanText(kriteria.petugas), "perkara_jurusita", "jurusita_nama", "Juru Sita"],
  ];
  for (const [dicari, tabel, kolom, label] of jabatan) {
    if (!dicari) continue;
    pekerjaan.push(
      jalankan(
        `SELECT t.perkara_id AS perkaraId, t.${kolom} AS nama
           FROM ${tabel} t
          WHERE t.perkara_id IN (${isian}) AND t.${kolom} LIKE ?`,
        [...daftarId, `%${dicari}%`]
      ).then((baris) => baris.forEach((x) => tambah(x.perkaraId, label, x.nama)))
    );
  }

  if (cleanText(kriteria.pertimbangan)) {
    const kataPtb = cleanText(kriteria.pertimbangan);
    pekerjaan.push(
      jalankan(
        `SELECT ph.perkara_id AS perkaraId, ph.pertimbangan_hukum AS teks
           FROM perkara_pertimbangan_hukum ph
          WHERE ph.perkara_id IN (${isian}) AND ph.pertimbangan_hukum LIKE ?`,
        [...daftarId, `%${kataPtb}%`]
      ).then((baris) => baris.forEach((x) => tambah(x.perkaraId, "Pertimbangan", penggalan(x.teks, kataPtb))))
    );
  }

  if (cleanText(kriteria.amar)) {
    const kataAmar = cleanText(kriteria.amar);
    pekerjaan.push(
      jalankan(
        `SELECT pu.perkara_id AS perkaraId, pu.amar_putusan AS teks
           FROM perkara_putusan pu
          WHERE pu.perkara_id IN (${isian}) AND pu.amar_putusan LIKE ?`,
        [...daftarId, `%${kataAmar}%`]
      ).then((baris) => baris.forEach((x) => tambah(x.perkaraId, "Amar", penggalan(x.teks, kataAmar))))
    );
  }

  if (cleanText(kriteria.kua)) {
    const kataKua = cleanText(kriteria.kua);
    pekerjaan.push(
      jalankan(
        `SELECT dn.perkara_id AS perkaraId, dn.kua_tempat_nikah AS kua
           FROM perkara_data_pernikahan dn
          WHERE dn.perkara_id IN (${isian}) AND dn.kua_tempat_nikah LIKE ?`,
        [...daftarId, `%${kataKua}%`]
      ).then((baris) => baris.forEach((x) => tambah(x.perkaraId, "KUA", x.kua)))
    );
  }

  await Promise.all(pekerjaan);
}
async function cariPerkara(kataCari, pilihan = {}) {
  const {
    batas = 25,
    jenisPerkara = "",
    status = "",
    tahun = "",
    alurPerkaraId = 0,
    sejak = "",
    sampai = "",
    namaPihak = "",
    petugas = "",
    // --- perluasan ---
    hakim = "",
    panitera = "",
    jurusita = "",
    statusPutusan = "",
    pertimbangan = "",
    amar = "",
    verstek = "",
    alamatPihak = "",
    kua = "",
    relaas = "",
    putusSejak = "",
    putusSampai = "",
    umur = "",
    ecourt = "",
  } = pilihan || {};

  const kata = cleanText(kataCari);
  const syarat = [];
  const nilai = [];

  if (kata) {
    if (/^\d+$/.test(kata)) {
      // Nomor urut saja - dicocokkan persis, bukan LIKE. "41" tidak boleh
      // memunculkan perkara 410 sampai 419.
      syarat.push("SUBSTRING_INDEX(p.nomor_perkara, '/', 1) = ?");
      nilai.push(kata);
    } else if (kata.includes("/")) {
      syarat.push("p.nomor_perkara LIKE ?");
      nilai.push(`%${kata}%`);
    } else {
      syarat.push(
        `(p.nomor_perkara LIKE ?
          OR p.jenis_perkara_nama LIKE ?
          OR EXISTS (SELECT 1 FROM v_pihak_perkara vp
                      WHERE vp.perkara_id = p.perkara_id AND vp.nama LIKE ?))`
      );
      nilai.push(`%${kata}%`, `%${kata}%`, `%${kata}%`);
    }
  }

  if (cleanText(jenisPerkara)) {
    syarat.push("p.jenis_perkara_nama LIKE ?");
    nilai.push(`%${cleanText(jenisPerkara)}%`);
  }

  if (cleanText(namaPihak)) {
    syarat.push(
      "EXISTS (SELECT 1 FROM v_pihak_perkara vp WHERE vp.perkara_id = p.perkara_id AND vp.nama LIKE ?)"
    );
    nilai.push(`%${cleanText(namaPihak)}%`);
  }

  // Petugas: hakim, panitera, atau juru sita mana pun pada perkara itu.
  if (cleanText(petugas)) {
    syarat.push(
      `(EXISTS (SELECT 1 FROM perkara_hakim_pn hk
                 WHERE hk.perkara_id = p.perkara_id AND hk.hakim_nama LIKE ?)
        OR EXISTS (SELECT 1 FROM perkara_panitera_pn pn
                    WHERE pn.perkara_id = p.perkara_id AND pn.panitera_nama LIKE ?)
        OR EXISTS (SELECT 1 FROM perkara_jurusita js
                    WHERE js.perkara_id = p.perkara_id AND js.jurusita_nama LIKE ?))`
    );
    const namaPetugas = `%${cleanText(petugas)}%`;
    nilai.push(namaPetugas, namaPetugas, namaPetugas);
  }

  // Petugas per jabatan. `petugas` mencari ketiganya sekaligus; ketiga
  // isian di bawah mencari satu jabatan saja - itu yang dibutuhkan saat
  // pertanyaannya "perkara siapa saja yang dipegang juru sita ini", bukan
  // "perkara yang menyebut nama ini di mana pun".
  const perJabatan = [
    [hakim, "perkara_hakim_pn hk", "hk.hakim_nama"],
    [panitera, "perkara_panitera_pn pn", "pn.panitera_nama"],
    [jurusita, "perkara_jurusita js", "js.jurusita_nama"],
  ];
  for (const [isian, tabel, kolom] of perJabatan) {
    const teks = cleanText(isian);
    if (!teks) continue;
    // Nama tabel dan kolom berasal dari daftar tertutup di atas, tidak
    // pernah dari peramban.
    syarat.push(
      `EXISTS (SELECT 1 FROM ${tabel} WHERE ${tabel.split(" ")[1]}.perkara_id = p.perkara_id AND ${kolom} LIKE ?)`
    );
    nilai.push(`%${teks}%`);
  }

  // Jenis putusan - Dikabulkan, Ditolak, Dicabut, dan seterusnya.
  if (cleanText(statusPutusan)) {
    syarat.push(
      "EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.status_putusan_nama LIKE ?)"
    );
    nilai.push(`%${cleanText(statusPutusan)}%`);
  }

  // Isi pertimbangan hukum. Di sinilah istilah seperti "ba'da dukhul" dan
  // "qabla dukhul" benar-benar tertulis - tidak ada kolomnya tersendiri di
  // SIPP, dan tidak satu pun muncul di amar putusan.
  if (cleanText(pertimbangan)) {
    syarat.push(
      `EXISTS (SELECT 1 FROM perkara_pertimbangan_hukum ph
                WHERE ph.perkara_id = p.perkara_id AND ph.pertimbangan_hukum LIKE ?)`
    );
    nilai.push(`%${cleanText(pertimbangan)}%`);
  }

  // Isi amar putusan.
  if (cleanText(amar)) {
    syarat.push(
      "EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.amar_putusan LIKE ?)"
    );
    nilai.push(`%${cleanText(amar)}%`);
  }

  // Verstek. Kolomnya berisi 'Y' atau 'T' - dicocokkan dengan daftar
  // tertutup, bukan disambung apa adanya.
  const kunciVerstek = cleanText(verstek).toLowerCase();
  if (kunciVerstek === "ya" || kunciVerstek === "tidak") {
    syarat.push(
      "EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.putusan_verstek = ?)"
    );
    nilai.push(kunciVerstek === "ya" ? "Y" : "T");
  }

  // Alamat pihak - untuk pertanyaan kewilayahan: berapa perkara dari desa
  // ini, dari kecamatan ini.
  if (cleanText(alamatPihak)) {
    syarat.push(
      "EXISTS (SELECT 1 FROM v_pihak_perkara vp WHERE vp.perkara_id = p.perkara_id AND vp.alamat LIKE ?)"
    );
    nilai.push(`%${cleanText(alamatPihak)}%`);
  }

  // KUA tempat nikah. Dipakai saat menyiapkan pemberitahuan akta cerai ke
  // KUA yang bersangkutan.
  if (cleanText(kua)) {
    syarat.push(
      `EXISTS (SELECT 1 FROM perkara_data_pernikahan dn
                WHERE dn.perkara_id = p.perkara_id AND dn.kua_tempat_nikah LIKE ?)`
    );
    nilai.push(`%${cleanText(kua)}%`);
  }

  // Keadaan relaas. Kuncinya daftar tertutup - nilai dari peramban tidak
  // pernah menjadi bagian teks kueri.
  const kunciUmur = cleanText(umur);
  if (kunciUmur && UMUR_SYARAT[kunciUmur]) syarat.push(UMUR_SYARAT[kunciUmur]);

  const kunciEcourt = cleanText(ecourt);
  if (kunciEcourt && ECOURT_SYARAT[kunciEcourt]) syarat.push(ECOURT_SYARAT[kunciEcourt]);

  const kunciRelaas = cleanText(relaas);
  if (kunciRelaas && RELAAS_SYARAT[kunciRelaas]) syarat.push(RELAAS_SYARAT[kunciRelaas]);

  // Rentang TANGGAL PUTUSAN, terpisah dari rentang pendaftaran.
  //
  // Selama ini sejak/sampai hanya menyaring tanggal pendaftaran, sehingga
  // "perkara yang diputus bulan ini" - pertanyaan yang ditanyakan tiap awal
  // bulan untuk laporan - tidak dapat ditanyakan sama sekali.
  const putusDari = cleanText(putusSejak);
  const putusKe = cleanText(putusSampai);
  if (/^\d{4}-\d{2}-\d{2}$/.test(putusDari)) {
    syarat.push(
      "EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.tanggal_putusan >= ?)"
    );
    nilai.push(putusDari);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(putusKe)) {
    syarat.push(
      "EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.tanggal_putusan <= ?)"
    );
    nilai.push(putusKe);
  }

  if (/^\d{4}$/.test(cleanText(tahun))) {
    syarat.push("YEAR(p.tanggal_pendaftaran) = ?");
    nilai.push(Number(cleanText(tahun)));
  }

  const dari = cleanText(sejak);
  const ke = cleanText(sampai);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dari)) {
    syarat.push("p.tanggal_pendaftaran >= ?");
    nilai.push(dari);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(ke)) {
    syarat.push("p.tanggal_pendaftaran <= ?");
    nilai.push(ke);
  }

  const alur = Number(alurPerkaraId) || 0;
  if (alur > 0) {
    syarat.push("p.alur_perkara_id = ?");
    nilai.push(alur);
  }

  // Status dibaca dari tabel putusan. Ditulis sebagai EXISTS supaya perkara
  // dengan lebih dari satu baris putusan tidak muncul berkali-kali.
  const STATUS = {
    // Cabut dan gugur ikut mengisi tanggal_putusan pada SIPP yang berjalan,
    // jadi keduanya sudah tersaring di sini tanpa syarat tambahan.
    berjalan:
      "NOT EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.tanggal_putusan IS NOT NULL)",
    putus:
      "EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.tanggal_putusan IS NOT NULL)",
    belum_minutasi:
      "EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.tanggal_putusan IS NOT NULL AND pu.tanggal_minutasi IS NULL)",
    sudah_minutasi:
      "EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.tanggal_minutasi IS NOT NULL)",
    belum_bht:
      "EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.tanggal_putusan IS NOT NULL AND pu.tanggal_bht IS NULL)",
    sudah_bht:
      "EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.tanggal_bht IS NOT NULL)",
    cabut:
      "EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.tanggal_cabut IS NOT NULL)",
    gugur:
      "EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.tanggal_gugur IS NOT NULL)",
  };

  // Kunci status dicocokkan dengan daftar tertutup di atas - bukan disambung
  // apa adanya. Nilai dari peramban tidak pernah menjadi bagian teks kueri.
  const kunciStatus = cleanText(status);
  if (kunciStatus && STATUS[kunciStatus]) syarat.push(STATUS[kunciStatus]);

  // Tanpa satu pun syarat, kuerinya akan memuat seluruh register. Yang keluar
  // bukan hasil pencarian, melainkan daftar acak sebanyak batas - dan itu
  // menyesatkan orang yang mengiranya hasil.
  if (syarat.length === 0) return [];

  const maksBaris = Math.min(Math.max(Number(batas) || 25, 1), 200);

  const rows = await runQuery(
    `SELECT p.perkara_id AS perkaraId,
            p.nomor_perkara AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            p.alur_perkara_id AS alurPerkaraId,
            p.tanggal_pendaftaran AS tanggalDaftar,
            pu.tanggalPutusan AS tanggalPutusan,
            pu.tanggalMinutasi AS tanggalMinutasi,
            pu.tanggalBht AS tanggalBht,
            pu.statusPutusan AS statusPutusan
       FROM perkara p
       LEFT JOIN (
         SELECT x.perkara_id,
                MAX(x.tanggal_putusan) AS tanggalPutusan,
                MAX(x.tanggal_minutasi) AS tanggalMinutasi,
                MAX(x.tanggal_bht) AS tanggalBht,
                MAX(x.status_putusan_nama) AS statusPutusan
           FROM perkara_putusan x
          GROUP BY x.perkara_id
       ) pu ON pu.perkara_id = p.perkara_id
      WHERE ${syarat.join(" AND ")}
      ORDER BY p.tanggal_pendaftaran DESC, p.perkara_id DESC
      LIMIT ${maksBaris}`,
    nilai
  );

  const hasil = rows.map((row) => ({
    perkaraId: String(row.perkaraId || ""),
    nomorPerkara: cleanText(row.nomorPerkara),
    jenisPerkara: cleanText(row.jenisPerkara),
    alurPerkaraId: Number(row.alurPerkaraId) || 0,
    tanggalDaftar: isoTanggal(row.tanggalDaftar),
    sudahPutus: Boolean(row.tanggalPutusan),
    tanggalPutusan: isoTanggal(row.tanggalPutusan),
    tanggalMinutasi: isoTanggal(row.tanggalMinutasi),
    tanggalBht: isoTanggal(row.tanggalBht),
    statusPutusan: cleanText(row.statusPutusan),
    // Diisi lampirkanCocok di bawah.
    cocok: [],
  }));

  await lampirkanCocok(hasil, {
    kata,
    namaPihak,
    alamatPihak,
    hakim,
    panitera,
    jurusita,
    petugas,
    pertimbangan,
    amar,
    kua,
  });

  return hasil;
}

/** Kunci status yang diterima cariPerkara, untuk ditampilkan di layar. */
const STATUS_PENCARIAN = [
  { kunci: "berjalan", label: "Masih berjalan" },
  { kunci: "putus", label: "Sudah putus" },
  { kunci: "belum_minutasi", label: "Putus, belum diminutasi" },
  { kunci: "sudah_minutasi", label: "Sudah diminutasi" },
  { kunci: "belum_bht", label: "Putus, belum BHT" },
  { kunci: "sudah_bht", label: "Sudah BHT" },
  { kunci: "cabut", label: "Dicabut" },
  { kunci: "gugur", label: "Gugur" },
];

/** Alur perkara pada SIPP, untuk saringan di layar. */
const ALUR_PENCARIAN = [
  { id: 15, label: "Gugatan (Pdt.G)" },
  { id: 16, label: "Permohonan (Pdt.P)" },
  { id: 17, label: "Gugatan Sederhana (Pdt.G.S)" },
  { id: 122, label: "Jinayah (JN)" },
];

/** Ringkasan biaya perkara: panjar, terpakai, dan sisanya. */
async function biayaPerkara(perkaraId) {
  // Dua kueri: ringkasannya untuk kartu, rinciannya untuk daftar. Yang kedua
  // dibatasi supaya perkara dengan ratusan transaksi tidak membanjiri layar.
  const [ringkas, rinci] = await Promise.all([
    runQuery(
      `SELECT b.jenis_transaksi AS jenisTransaksi, SUM(b.jumlah) AS jumlah
         FROM perkara_biaya b WHERE b.perkara_id = ? GROUP BY b.jenis_transaksi`,
      [perkaraId]
    ),
    runQuery(
      `SELECT b.jenis_transaksi AS jenisTransaksi,
              b.uraian AS uraian,
              b.jumlah AS jumlah,
              b.tanggal_transaksi AS tanggal
         FROM perkara_biaya b
        WHERE b.perkara_id = ?
        ORDER BY b.tanggal_transaksi ASC, b.id ASC
        LIMIT 200`,
      [perkaraId]
    ).catch(() => []),
  ]);

  // jenis_transaksi SIPP: 1 pemasukan. Pengeluaran ditulis -1 pada jalur query
  // lama yang sudah lama menjawab publik; catatan di sini sempat menyebut 2.
  // Karena keduanya sama-sama BUKAN 1, hasil penjumlahannya tidak berbeda -
  // tetapi keterangannya diluruskan supaya pembaca berikutnya tidak menyangka
  // ada nilai ketiga yang terlewat.
  let masuk = 0;
  let keluar = 0;
  for (const baris of ringkas) {
    if (Number(baris.jenisTransaksi) === 1) masuk += Number(baris.jumlah) || 0;
    else keluar += Number(baris.jumlah) || 0;
  }

  return {
    panjar: masuk,
    terpakai: keluar,
    sisa: masuk - keluar,
    // Rinciannya - "terpakai Rp 179.500" tidak memberi tahu untuk apa.
    // Yang ditanya kasir dan pihak justru rinciannya.
    rincian: (Array.isArray(rinci) ? rinci : []).map((baris) => ({
      jenis: Number(baris.jenisTransaksi) === 1 ? "masuk" : "keluar",
      uraian: cleanText(baris.uraian),
      jumlah: Number(baris.jumlah) || 0,
      tanggal: isoTanggal(baris.tanggal),
    })),
  };
}

/** Riwayat penundaan sidang - berapa kali dan sebabnya. */
async function riwayatPenundaan(perkaraId) {
  const rows = await runQuery(
    `SELECT j.tanggal_sidang AS tanggalSidang,
            j.agenda AS agenda,
            j.alasan_ditunda AS alasanDitunda
       FROM perkara_jadwal_sidang j
      WHERE j.perkara_id = ? AND j.ditunda = 'Y'
      ORDER BY j.tanggal_sidang ASC`,
    [perkaraId]
  );

  return rows.map((row) => ({
    tanggalSidang: isoTanggal(row.tanggalSidang),
    agenda: cleanText(row.agenda),
    alasanDitunda: cleanText(row.alasanDitunda),
  }));
}

/** Identitas dasar satu perkara. */
async function identitasPerkara(nomorPerkara) {
  const rows = await runQuery(
    `SELECT p.perkara_id AS perkaraId,
            p.nomor_perkara AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            p.jenis_perkara_text AS jenisPerkaraLengkap,
            p.alur_perkara_id AS alurPerkaraId,
            p.tanggal_pendaftaran AS tanggalDaftar
       FROM perkara p
      WHERE p.nomor_perkara = ?
      ORDER BY p.perkara_id DESC
      LIMIT 1`,
    [nomorPerkara]
  );

  const baris = rows[0];
  if (!baris) return null;

  return {
    perkaraId: String(baris.perkaraId || ""),
    nomorPerkara: cleanText(baris.nomorPerkara),
    jenisPerkara: cleanText(baris.jenisPerkara),
    jenisPerkaraLengkap: cleanText(baris.jenisPerkaraLengkap),
    alurPerkaraId: Number(baris.alurPerkaraId) || 0,
    tanggalDaftar: isoTanggal(baris.tanggalDaftar),
  };
}

/**
 * Menyusun fakta satu perkara untuk dinilai menurut SK Penilaian SIPP.
 *
 * ============================================================================
 * ADA TIDAKNYA TERBACA, TEPAT TIDAKNYA WAKTU BELUM
 * ============================================================================
 *
 * Sebagian unsur SK dinilai dari WAKTU - berapa hari sesudah suatu peristiwa
 * datanya diinput ke SIPP. Kolom tanggal input itu belum dibaca ALETA; yang
 * terbaca baru ada tidaknya datanya.
 *
 * Karena itu berlaku satu aturan di seluruh fungsi ini:
 *
 *   tidak ada sama sekali     -> tetap dinilai, sebab SK memang menilainya
 *                                nol (atau -5), dan itu memang keadaannya
 *   ada tetapi waktunya gelap -> TIDAK dinilai, dan disebutkan sebagai unsur
 *                                yang sumber datanya belum tersambung
 *
 * Menebak yang kedua akan memberi nilai buruk kepada pekerjaan yang mungkin
 * sudah dikerjakan tepat waktu. Nilai yang keliru pada berkas resmi lebih
 * berbahaya daripada nilai yang jujur mengaku belum lengkap.
 *
 * Bidang yang dibiarkan undefined berarti "belum tersambung"; yang bernilai
 * null berarti "terbaca, memang kosong".
 */
function faktaPenilaianSk({ identitas, putusan, jadwal, relaas, saksi, sidangLewat, basAda, tahapan, pendukung } = {}) {
  const fakta = {};

  fakta.tanggalDaftar = identitas && identitas.tanggalDaftar ? identitas.tanggalDaftar : null;

  const sudahPutus = Boolean(putusan && putusan.sudahPutus);
  if (sudahPutus) {
    fakta.tanggalPutus = putusan.tanggalPutusan || null;
    fakta.tanggalMinutasi = putusan.tanggalMinutasi || null;
    fakta.tanggalBht = putusan.tanggalBht || null;
    fakta.wajibBht = true;

    // Sidang terakhir yang jatuh pada atau sebelum tanggal putus - itulah
    // yang dibandingkan SK Tabel 2 III.1.
    const sebelumPutus = (jadwal || []).filter(
      (x) => x.tanggalSidang && x.tanggalSidang <= putusan.tanggalPutusan
    );
    if (sebelumPutus.length > 0) {
      fakta.tanggalSidangTerakhir = sebelumPutus[sebelumPutus.length - 1].tanggalSidang;
    }

    // Perkara talak kabul dan verzet dikecualikan SK dari unsur ini.
    const status = String(putusan.statusPutusan || "").toLowerCase();
    if (/talak|verzet/.test(status)) fakta.dikecualikanAgendaTerakhir = true;

    fakta.adaAmarPutusan = Boolean(putusan.adaBerkasPutusan);

    // Verstek diucapkan bila tergugat tidak hadir. Kehadiran pada sidang
    // terakhir yang dibandingkan - SK Tabel 2 III.4.
    const hadirTerakhir = sebelumPutus.length > 0 ? sebelumPutus[sebelumPutus.length - 1].dihadiriOleh : null;
    if (hadirTerakhir === 1 || hadirTerakhir === 2) {
      // 1 = kedua pihak hadir (contradictoir), 2 = penggugat saja (verstek).
      fakta.jenisPutusanSesuai = putusan.verstek === (hadirTerakhir === 2);
    }

    // Perkara cabut atau gugur dikecualikan dari unsur data saksi.
    if (putusan.tanggalCabut || putusan.tanggalGugur) fakta.dikecualikanSaksi = true;

    if (putusan.aktaCerai) {
      fakta.wajibAktaCerai = true;
      fakta.tanggalAktaCerai = putusan.aktaCerai.tanggal || null;
    }
  }





  // ------------------------------------------------------------------------
  // KETEPATAN WAKTU PENGINPUTAN - SK Tabel 2 bagian I
  // ------------------------------------------------------------------------
  //
  // Tahapan yang KOLOMNYA ada di SIPP dinilai, termasuk bila isinya kosong -
  // kosong memang berarti belum dikerjakan. Tahapan yang kolomnya TIDAK ADA
  // dibiarkan undefined, sehingga tetap dilaporkan belum tersambung.
  const tahapPerKunci = {};
  for (const satu of tahapan && Array.isArray(tahapan.tahap) ? tahapan.tahap : []) {
    tahapPerKunci[satu.kunci] = satu;
  }

  const pasangTahap = (kunci, medanTanggal, medanInput) => {
    const satu = tahapPerKunci[kunci];
    if (!satu) return;
    if (satu.terbaca && medanTanggal) fakta[medanTanggal] = satu.tanggal || null;
    if (satu.inputTerbaca) fakta[medanInput] = satu.diinput || null;
  };

  pasangTahap("pendaftaran", "", "tanggalInputPendaftaran");
  pasangTahap("pmh", "tanggalPmh", "tanggalInputPmh");
  pasangTahap("ppp", "tanggalPpp", "tanggalInputPpp");
  pasangTahap("pjs", "tanggalPjs", "tanggalInputPjs");
  pasangTahap("phs", "tanggalPhs", "tanggalInputPhs");

  const bantu = pendukung || {};

  // Lama mediasi dipotong dari waktu putus - lihat catatan pada penilaian.
  if (bantu.durasiMediasi && bantu.durasiMediasi.terbaca) {
    fakta.hariMediasi = bantu.durasiMediasi.hari;
  }

  // E-Dokumen petitum - SK Tabel 2 II.1.
  if (bantu.petitum && bantu.petitum.terbaca) fakta.adaDokPetitum = bantu.petitum.ada;

  // Kelengkapan dokumen relaas - SK Tabel 2 II.2. Yang seharusnya ada
  // sebanyak relaas yang tercatat; menghitungnya dari biaya panggilan
  // menuntut penafsiran tarif yang berbeda tiap radius.
  if (bantu.dokumenRelaas && bantu.dokumenRelaas.terbaca && bantu.dokumenRelaas.jumlah > 0) {
    fakta.relaasSeharusnya = bantu.dokumenRelaas.jumlah;
    fakta.relaasBerdokumen = bantu.dokumenRelaas.berdokumen;
  }

  // ------------------------------------------------------------------------
  // KELONGGARAN PERKARA KHUSUS - SK Tabel 2 nomor 1
  // ------------------------------------------------------------------------
  //
  // Perkara ghaib dan perkara berpihak PNS/TNI/POLRI memang berjalan lebih
  // lama karena hukum acaranya sendiri yang mengharuskan. Tanpa penanda ini,
  // majelis yang sudah bekerja benar dinilai lambat.
  if (bantu.penanda) {
    // Urutannya penting: kelonggaran mafqud (270 hari) lebih besar daripada
    // ghaib (120 hari), dan kelonggaranWaktuPutus memakai yang pertama cocok.
    // Perkara yang keduanya terindikasi berhak atas yang lebih besar.
    if (bantu.penanda.mafqud === true) fakta.perkaraMafqud = true;
    if (bantu.penanda.ghaib === true) fakta.perkaraGhaib = true;
    // Waktu menunggu izin atasan tidak tercatat tersendiri di SIPP. Yang dapat
    // dipastikan hanyalah bahwa izin itu DIPERLUKAN; berapa lama menunggunya
    // tidak ditebak, sebab menebaknya berarti memberi kelonggaran yang mungkin
    // tidak berhak.
    fakta.perluIzinAtasan = Boolean(bantu.penanda.perluIzinAtasan);
  }

  // ------------------------------------------------------------------------
  // RELAAS - SK Tabel 2 I.10
  // ------------------------------------------------------------------------
  //
  // penilaianRelaasPerkara sudah mencoba empat sumber berurutan: tabel
  // penilaian, kolom tanggal input, dan jejak audit. Yang sampai ke sini
  // hasilnya, beserta keterangan dari mana ia datang.
  const nilaiR = bantu.nilaiRelaas;
  if (nilaiR && nilaiR.terbaca) {
    if (typeof nilaiR.nilaiLangsung === "number") {
      // SIPP sudah menghitung sendiri. Nilai itu dipakai apa adanya - ia
      // catatan pengadilan, bukan tafsiran kita.
      fakta.nilaiRelaasLangsung = nilaiR.nilaiLangsung;
    } else {
      fakta.relaas = nilaiR.relaas;
    }
  } else if (Array.isArray(relaas) && relaas.length === 0) {
    // Tidak ada relaas sama sekali - ini terbaca, dan SK menilainya -5.
    fakta.relaas = [];
  }

  // ------------------------------------------------------------------------
  // MEDIASI - SK Tabel 2 I.11
  // ------------------------------------------------------------------------
  //
  // Yang dinilai SK sekadar terisi atau tidak. Yang dianggap terisi: ada
  // baris mediasi yang HASILNYA sudah dicatat. Baris kosong yang terbentuk
  // saat mediator ditetapkan belum berarti rapornya diisi.
  if (bantu.mediasiLengkap && bantu.mediasiLengkap.terbaca) {
    fakta.rapotMediasiTerisi = bantu.mediasiLengkap.baris.some((x) => Boolean(x.hasil));
  } else if (bantu.durasiMediasi && bantu.durasiMediasi.terbaca && bantu.durasiMediasi.hari > 0) {
    // Mediasi yang lamanya tercatat berarti mediasinya memang berlangsung -
    // dan v_durasi_mediasi hanya menghasilkan angka bila datanya ada.
    fakta.rapotMediasiTerisi = true;
  }

  // Saksi: kelengkapan identitasnya - SK Tabel 2 I.12.
  if (bantu.saksiLengkap && bantu.saksiLengkap.terbaca) {
    fakta.saksi = bantu.saksiLengkap.baris.map((x) => ({ isianTerisi: x.isianTerisi }));
  } else if (saksi && Number(saksi.jumlahSaksi) === 0) {
    fakta.saksi = [];
  }

  // Pemberitahuan putusan - SK Tabel 2 I.13.
  if (sudahPutus && bantu.pemberitahuan && bantu.pemberitahuan.terbaca) {
    fakta.wajibPbt = true;
    const adaPbt = bantu.pemberitahuan.baris.filter((x) => x.tanggal);
    if (adaPbt.length === 0) {
      fakta.hariPbt = null;
    } else {
      // Yang dinilai pelaksanaan PALING LAMBAT: itulah yang menentukan kapan
      // seluruh pihak sudah diberitahu.
      const terakhir = adaPbt.reduce((a, b) => (a.tanggal > b.tanggal ? a : b));
      fakta.hariPbt = sippTahapanService.selisihHari(putusan.tanggalPutusan, terakhir.tanggal);
      if (terakhir.diinput) fakta.hariInputPbt = terakhir.hariSampaiInput;
    }
  }


  // Sisa panjar - SK Tabel 2 I.15.
  if (bantu.sisaPanjar && bantu.sisaPanjar.terbaca) {
    const kembali = bantu.sisaPanjar.baris.filter((x) => x.tanggal && x.hariSampaiInput !== null);
    fakta.hariInputSisaPanjar = kembali.length > 0 ? kembali[0].hariSampaiInput : null;
  }

  // Arsip - SK Tabel 2 I.16, diukur dari akta cerai atau dari BHT.
  if (bantu.arsip && bantu.arsip.terbaca) {
    const acuanArsip =
      putusan && putusan.aktaCerai && putusan.aktaCerai.tanggal
        ? putusan.aktaCerai.tanggal
        : putusan && putusan.tanggalBht
          ? putusan.tanggalBht
          : "";
    const diinput = bantu.arsip.baris.find((x) => x.tanggal);
    fakta.hariInputArsip =
      acuanArsip && diinput ? sippTahapanService.selisihHari(acuanArsip, diinput.tanggal) : null;
  }

  // Delegasi MASUK - SK Tabel 2 I.17. Yang dinilai penerimaan paling LAMBAT:
  // satu delegasi yang tertinggal tidak boleh tertutup oleh yang cepat.
  if (bantu.delegasiMasuk && bantu.delegasiMasuk.terbaca) {
    const berhari = bantu.delegasiMasuk.baris.filter((x) => x.hariSampaiTerima !== null);
    fakta.hariTerimaDelegasi =
      berhari.length > 0 ? Math.max(...berhari.map((x) => x.hariSampaiTerima)) : null;
  } else if (bantu.delegasi && bantu.delegasi.terbaca) {
    const adaDelegasi = bantu.delegasi.baris.find((x) => x.tanggal);
    fakta.hariTerimaDelegasi =
      adaDelegasi && adaDelegasi.hariSampaiInput !== null ? adaDelegasi.hariSampaiInput : null;
  }

  // Delegasi KELUAR (tabayun) - SK Tabel 2 III.3, unsur pengurang. Yang
  // dinilai permohonan yang paling MEPET ke hari sidang.
  if (bantu.delegasiKeluar && bantu.delegasiKeluar.terbaca) {
    // Hanya delegasi PANGGILAN yang dinilai - delegasi pemberitahuan bukan
    // pemanggilan, dan SK III.3 menilai kepatutan waktu pemanggilan.
    const berjarak = bantu.delegasiKeluar.baris.filter(
      (x) => x.panggilan && x.hariSebelumSidang !== null
    );
    fakta.hariSebelumSidangDelegasi =
      berjarak.length > 0 ? Math.min(...berjarak.map((x) => x.hariSebelumSidang)) : null;
  }

  // Unggah naskah putusan - SK Tabel 2 huruf c.
  if (sudahPutus && bantu.unggahPutusan && bantu.unggahPutusan.terbaca) {
    fakta.tanggalUnggahPutusan = bantu.unggahPutusan.tanggal || null;
  }

  // Unggah BAS - SK Tabel 2 II.3.
  if (bantu.unggahBas && bantu.unggahBas.terbaca) {
    const sidangAda = bantu.unggahBas.baris.filter((x) => x.tanggalSidang);
    if (sidangAda.length > 0) {
      fakta.bas = sidangAda.map((x) => ({
        tanggalSidang: x.tanggalSidang,
        tanggalUnggah: x.diunggah || null,
      }));
    }
  }

  return fakta;
}
/**
 * Seluruh keadaan satu perkara, dari pendaftaran sampai produk pengadilan.
 *
 * ============================================================================
 * MEMANGGIL LAYANAN YANG SUDAH ADA, BUKAN MENYALIN KUERINYA
 * ============================================================================
 *
 * Majelis, relaas, putusan, dan dokumen sudah punya pembacanya masing-masing
 * yang dipakai layar Jadwal Sidang. Menyalin kuerinya ke sini berarti punya dua
 * jalur yang dapat berbeda perilaku - dan yang satu ini akan lebih jarang
 * diperhatikan orang.
 *
 * ============================================================================
 * TIAP BAGIAN GAGAL SENDIRI-SENDIRI
 * ============================================================================
 *
 * Satu sumber yang tidak terbaca tidak boleh mengosongkan seluruh layar.
 * Bagian yang gagal tampil kosong dengan keterangannya, sisanya tetap terisi.
 */
async function statusLengkap(nomorPerkaraMentah) {
  const nomorPerkara = normalizeCaseNumber(nomorPerkaraMentah);
  if (!nomorPerkara) return { ok: false, alasan: "nomor_perkara_kosong" };

  const identitas = await identitasPerkara(nomorPerkara);
  if (!identitas) return { ok: false, alasan: "perkara_tidak_ditemukan" };

  const aman = async (kerja, cadangan) => {
    try {
      return await kerja();
    } catch {
      return cadangan;
    }
  };

  // Tahapan dan tabel pendukungnya dibaca bersamaan dengan yang lain. Tiap
  // bagian gagal sendiri-sendiri: SIPP versi lama yang tidak punya tabel
  // pemberitahuan tidak boleh mengosongkan seluruh layar.
  const [rincian, biaya, penundaan, panggilanEcourt, dokumen, konteks] = await Promise.all([
    aman(() => sippJadwalSidangService.rincianSidang(nomorPerkara, 0), null),
    aman(() => biayaPerkara(identitas.perkaraId), { panjar: 0, terpakai: 0, sisa: 0 }),
    aman(() => riwayatPenundaan(identitas.perkaraId), []),
    aman(() => ecourtStoreService.bacaPanggilanPerkara(nomorPerkara), { pihak: [], panggilan: [] }),
    aman(() => ecourtStoreService.rincianArsipPerkara(nomorPerkara), { dokumen: [] }),
    aman(() => sippKonteksService.getKonteks(nomorPerkara), null),
  ]);

  const [
    tahapan,
    upayaHukum,
    pemberitahuan,
    mediasi,
    arsipSipp,
    delegasi,
    sisaPanjar,
    unggahPutusan,
    unggahBas,
    saksiLengkap,
    relaasInput,
  ] = await Promise.all([
    aman(() => sippTahapanService.tahapanPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.upayaHukumPerkara(identitas.perkaraId), []),
    aman(() => sippTahapanService.pemberitahuanPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.mediasiPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.arsipPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.delegasiPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.sisaPanjarPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.unggahPutusanPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.unggahBasPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.saksiLengkapPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.relaasBerinputPerkara(identitas.perkaraId), null),
  ]);

  // Penanda perkara dibaca SETELAH tahapan, karena salah satu pencirinya
  // adalah jarak PHS ke sidang pertama - dan itu baru diketahui dari tahapan.
  const tanggalPhs = tahapan && Array.isArray(tahapan.tahap)
    ? (tahapan.tahap.find((x) => x.kunci === "phs") || {}).tanggal || ""
    : "";

  const [
    penanda,
    saksiLengkapBaru,
    mediasiLengkap,
    penetapanKembali,
    durasiMediasi,
    petitum,
    dokumenRelaas,
    nilaiRelaas,
    delegasiMasuk,
    delegasiKeluar,
    arsipKeterangan,
    putusanLengkap,
    ikrarTalak,
    konseptor,
  ] = await Promise.all([
    aman(
      () =>
        sippTahapanService.penandaPerkara(identitas.perkaraId, {
          tanggalPhs,
          sidangPertama: tahapan ? tahapan.sidangPertama : "",
        }),
      null
    ),
    aman(() => sippTahapanService.saksiLengkapPerkaraBaru(identitas.perkaraId), null),
    aman(() => sippTahapanService.mediasiLengkapPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.penetapanKembaliPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.durasiMediasiPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.petitumPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.dokumenRelaasPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.penilaianRelaasPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.delegasiMasukPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.delegasiKeluarPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.arsipKeteranganPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.putusanLengkapPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.ikrarTalakPerkara(identitas.perkaraId), null),
    aman(() => sippTahapanService.konseptorPutusanPerkara(identitas.perkaraId), null),
  ]);

  const pendukung = {
    pemberitahuan,
    mediasi,
    arsip: arsipSipp,
    delegasi,
    sisaPanjar,
    unggahPutusan,
    unggahBas,
    saksiLengkap: saksiLengkapBaru || saksiLengkap,
    relaasInput,
    penanda,
    mediasiLengkap,
    durasiMediasi,
    petitum,
    dokumenRelaas,
    nilaiRelaas,
    delegasiMasuk,
    delegasiKeluar,
  };

  const putusan = rincian && rincian.ok ? rincian.putusan : null;
  const jadwal = rincian && rincian.ok ? rincian.jadwalPerkara || [] : [];
  const nomorPihak = konteks && konteks.ok ? konteks.nomorPihak : [];

  // --- umur perkara --------------------------------------------------------
  //
  // Perkara yang sudah diputus dihitung sampai putusannya; yang masih berjalan
  // dihitung sampai HARI INI. Menghitung keduanya sampai hari ini membuat
  // perkara lama yang sudah selesai tampak terus memburuk.
  // ------------------------------------------------------------------------
  // CABUT DAN GUGUR JUGA MEMBAWA TANGGAL PUTUSAN
  // ------------------------------------------------------------------------
  //
  // Dikonfirmasi langsung dari SIPP yang berjalan: perkara yang berakhir
  // karena dicabut atau gugur TETAP mengisi tanggal_putusan, sama seperti
  // perkara yang diputus. Karena itu "sudahPutus" sudah mencakup ketiganya,
  // jam umurnya sudah berhenti pada tempatnya, dan saringan "perkara berjalan"
  // sudah tidak memuatnya.
  //
  // Ini ditulis supaya tidak ada yang menambahkan jalur cadangan lewat
  // tanggal_cabut dan tanggal_gugur - jalur yang tidak akan pernah terpakai,
  // dan yang keberadaannya justru menyiratkan keadaan yang tidak ada.
  //
  // Yang tetap berguna dari kedua kolom itu hanya SEBUTANNYA: layar menyebut
  // "sampai dicabut" alih-alih "sampai putus", sebab keduanya memang bukan
  // peristiwa yang sama bagi yang membacanya.
  const sebabSelesai = !putusan || !putusan.sudahPutus
    ? ""
    : putusan.tanggalCabut
      ? "dicabut"
      : putusan.tanggalGugur
        ? "gugur"
        : "putus";

  const hariBerjalan = selisihHari(
    identitas.tanggalDaftar,
    putusan && putusan.sudahPutus ? putusan.tanggalPutusan : null
  );

  const hariMinutasi =
    putusan && putusan.sudahPutus && putusan.tanggalMinutasi
      ? selisihHari(putusan.tanggalPutusan, putusan.tanggalMinutasi)
      : null;

  // Berapa hari sejak putusan sampai HARI INI. Dipakai membedakan berkas yang
  // tenggang minutasinya masih berjalan dari berkas yang tenggangnya sudah
  // lewat - dua keadaan yang sangat berbeda dan dulu dinilai sama-sama nol.
  const hariSejakPutus =
    putusan && putusan.sudahPutus && putusan.tanggalPutusan
      ? selisihHari(putusan.tanggalPutusan, null)
      : null;

  // ------------------------------------------------------------------------
  // UMUR YANG DINILAI: HARI BERSIH
  // ------------------------------------------------------------------------
  //
  // Hari pendaftaran ikut dihitung, lalu lama mediasi dipotong - persis cara
  // SK menghitungnya. Inilah angka yang ditampilkan besar di layar beserta
  // warnanya, dan karena itu inilah yang harus dinilai.
  //
  // Dulu tidak: layar mewarnai hariBersih sementara rubrik menilai hari
  // mentah. Perkara bermediasi 40 hari yang selesai pada hari ke-120 tampil
  // HIJAU di layar - bersihnya 81 hari - sementara rubrik menilainya seolah
  // 120 hari dan memotong separuh bobot lama penyelesaian. Yang dilihat
  // petugas dan yang dihitung mesin bukan angka yang sama, dan justru perkara
  // bermediasi - yang potongannya memang disediakan untuk melindunginya -
  // yang paling dirugikan.
  const hariMediasi = durasiMediasi && durasiMediasi.terbaca ? Math.max(0, durasiMediasi.hari) : 0;
  const hariBersih = (() => {
    if (hariBerjalan === null) return null;
    const kotor = hariBerjalan + 1;
    // Dijepit sama seperti pada penilaian SK - lihat penilaianSippService.
    const dipotong = Math.min(hariMediasi, Math.max(0, kotor - 1));
    return kotor - dipotong;
  })();

  // --- keadaan panggilan ---------------------------------------------------
  const keadaanPanggilan = ecourtPanggilanService.susunKeadaanPanggilan({
    persetujuan: panggilanEcourt.pihak,
    panggilan: panggilanEcourt.panggilan,
    relaas: rincian && rincian.ok ? rincian.relaas : [],
    tanggalSidang: jadwal.length > 0 ? jadwal[jadwal.length - 1].tanggalSidang : null,
    lewatEcourt: rincian && rincian.ok ? rincian.lewatEcourt === true : false,
  });

  // --- sidang yang sudah berlalu, dan berapa yang ada BAS-nya --------------
  const hariIni = isoTanggal(new Date());
  const sidangLewat = jadwal.filter((x) => x.tanggalSidang && x.tanggalSidang < hariIni);
  const basAda = sidangLewat.filter((x) => x.adaBas).length;

  const penilaian = penilaianPerkaraService.nilaiPerkara({
    hariBerjalan,
    // Yang dinilai hari bersih - angka yang sama dengan yang dibaca petugas
    // di layar. hariBerjalan tetap dikirim untuk keterangannya.
    hariBersih,
    sudahPutus: Boolean(putusan && putusan.sudahPutus),
    majelis: rincian && rincian.ok ? rincian.majelis : [],
    panitera: rincian && rincian.ok ? rincian.panitera : [],
    pihak: nomorPihak,
    nomorPihakBermasalah: nomorPihak.filter(
      (n) => !n.adaNomor || n.statusVerifikasi === "ditolak" || n.statusVerifikasi === "menunggu"
    ).length,
    panggilan: {
      jumlahPihak: keadaanPanggilan.ringkasan.jumlahPihak,
      patut: keadaanPanggilan.ringkasan.patut,
    },
    sidangLewat: sidangLewat.length,
    basAda,
    adaBerkasPutusan: Boolean(putusan && putusan.adaBerkasPutusan),
    adaBerkasAnonim: Boolean(putusan && putusan.adaBerkasAnonim),
    hariMinutasi,
    hariSejakPutus,
  });

  // Nilai menurut SK Dirjen Badilag 048/DJA/SK.KP3.4.3/IV/2024. Dipisah dari
  // rubrik ALETA di atas: yang satu aturan resmi, yang satu penilaian sendiri.
  const penilaianSk = penilaianSippService.poinPerkara(
    faktaPenilaianSk({
      identitas,
      putusan,
      jadwal,
      relaas: rincian && rincian.ok ? rincian.relaas : null,
      saksi: rincian && rincian.ok ? rincian.saksi : null,
      sidangLewat: sidangLewat.length,
      basAda,
      tahapan,
      pendukung,
    }),
    { jenisPengadilan: "pertama" }
  );

  // Gagal-terbuka: keadaan putusan e-Court keterangan pelengkap. Bila
  // tabelnya belum ada - pemasangan yang belum pernah menjalankan penarikan -
  // sisanya tetap tampil seperti biasa.
  const putusanEcourt = await aman(
    () =>
      putusanEcourtService.keadaanSatu(identitas.nomorPerkara, {
        sudahPutus: Boolean(putusan && putusan.sudahPutus),
        tanggalPutusan: putusan ? putusan.tanggalPutusan : "",
      }),
    null
  );
  return {
    ok: true,
    alasan: "",
    identitas,
    umur: {
      hariBerjalan,
      sudahPutus: Boolean(putusan && putusan.sudahPutus),
      // Cabut dan gugur tetap berakhir dengan tanggal putusan, tetapi bukan
      // peristiwa yang sama bagi yang membaca layar. Sebutannya dipisah supaya
      // keterangan umurnya berbunyi "sampai dicabut", bukan "sampai putus".
      sebabSelesai,
      hariMinutasi,
      // ====================================================================
      // DUA ANGKA, DUA PERTANYAAN
      // ====================================================================
      //
      // hariBerjalan  - selisih mentah pendaftaran ke putusan
      // hariBersih    - yang DINILAI: hari pendaftaran ikut dihitung, lalu
      //                 lama mediasi dipotong
      //
      // Yang ditampilkan besar di layar hariBersih, sebab itulah yang
      // menentukan nilai. Yang mentah tetap disebutkan dalam kurung supaya
      // dapat dicocokkan dengan tanggal pada berkas.
      hariMediasi,
      hariBersih,
      // Umur dalam bulan, dibulatkan - itulah satuan yang dipakai laporan.
      // Dihitung dari hari BERSIH, sama seperti angka besar di layar dan sama
      // seperti yang dinilai. Menghitungnya dari hari mentah membuat satu
      // layar memuat dua umur yang berbeda untuk perkara yang sama.
      bulanBerjalan: hariBersih === null ? null : Math.round((hariBersih / 30) * 10) / 10,
    },
    majelis: rincian && rincian.ok ? rincian.majelis : [],
    panitera: rincian && rincian.ok ? rincian.panitera : [],
    jurusita: rincian && rincian.ok ? rincian.jurusita : [],
    saksi: rincian && rincian.ok ? rincian.saksi : { ada: false, jumlahSaksi: 0, jumlahKeterangan: 0 },
    pihak: nomorPihak,
    identitasPihak: konteks && konteks.ok ? konteks.identitas : null,
    jadwal,
    penundaan,
    relaas: rincian && rincian.ok ? rincian.relaas : [],
    panggilan: keadaanPanggilan,
    putusan,
    biaya,
    dokumenEcourt: dokumen.dokumen || [],
    dokumenSipp: rincian && rincian.ok ? rincian.dokumenSipp : [],
    // Surat gugatan atau permohonan - berkas yang paling sering dicari, dan
    // tempatnya BUKAN di perkara_dokumen melainkan pada kolom petitum tabel
    // perkara. Tanpa diteruskan ke sini, layar status perkara menampilkan
    // daftar lampiran tanpa berkas pokoknya.
    petitum: rincian && rincian.ok ? rincian.petitum || { ada: false } : { ada: false },
    lewatEcourt: rincian && rincian.ok ? rincian.lewatEcourt === true : false,
    penilaian,
    penilaianSk,
    // Garis waktu, jeda antar sidang, ketepatan input, dan ringkasan - seluruhnya
    // dirakit dari data di atas, tanpa satu pun kueri tambahan ke SIPP.
    analisa: analisaPerkaraService.analisaPerkara({
      tanggalDaftar: identitas.tanggalDaftar,
      hariIni,
      sudahPutus: Boolean(putusan && putusan.sudahPutus),
      sebabSelesai,
      putusan: putusan || {},
      tahapan,
      jadwal,
      biaya,
      panggilan: keadaanPanggilan.ringkasan,
      penilaian,
      hariBerjalan,
      hariBersih,
      hariMediasi,
      hariSejakPutus,
      ambangMinutasi: penilaian.pengaturan.hariMinutasi,
      ambangHari: penilaian.pengaturan.bulanNol * 30,
    }),
    // Tahapan dari pendaftaran sampai penetapan hari sidang, beserta kapan
    // masing-masing diinput ke SIPP.
    tahapan: tahapan || { terbaca: false, alasan: "Tahapan tidak terbaca.", tahap: [] },
    upayaHukum: Array.isArray(upayaHukum) ? upayaHukum : [],
    // Penanda yang mengubah cara perkara dinilai dan ditangani.
    penanda: penanda || { ghaib: null, sumberGhaib: [], instansi: [], perluIzinAtasan: false },
    penetapanKembali: penetapanKembali || { terbaca: false, adaPenggantian: false, baris: [] },
    durasiMediasi: durasiMediasi || { terbaca: false, hari: 0, alasan: "" },
    delegasiMasuk: delegasiMasuk || { terbaca: false, alasan: "", baris: [] },
    delegasiKeluar: delegasiKeluar || { terbaca: false, alasan: "", baris: [] },
    arsipKeterangan: arsipKeterangan || { terbaca: false, alasan: "", sudahDiarsipkan: false, baris: [] },
    putusanLengkap: putusanLengkap || { terbaca: false, ada: false },
    // Apakah putusannya benar-benar terbit di e-Court: barisnya ada, salinannya
    // diunggah, dan Panitera sudah menandatanganinya. Ketiganya dapat gagal
    // tanpa satu pun peringatan - lihat catatan pada putusanEcourtService.
    putusanEcourt,
    ikrarTalak: ikrarTalak || { terbaca: false, ada: false, alasan: "" },
    konseptor: konseptor || { terbaca: false, alasan: "", baris: [] },
    nilaiRelaas: nilaiRelaas || { terbaca: false, alasan: "", sumber: "", relaas: [] },
    dokumenRelaas: dokumenRelaas || { terbaca: false, jumlah: 0, berdokumen: 0, berresi: 0 },
    saksiRinci: saksiLengkapBaru || { terbaca: false, alasan: "", baris: [] },
    mediasi: mediasiLengkap || { terbaca: false, alasan: "", baris: [] },
    pendukungSipp: {
      pemberitahuan,
      mediasi,
      arsip: arsipSipp,
      delegasi,
      sisaPanjar,
      unggahBas,
      relaasInput,
    },
    pesanSipp: rincian && rincian.ok ? "" : "Sebagian keterangan SIPP belum dapat dibaca.",
  };
}

module.exports = {
  ALUR_PENCARIAN,
  PUTUSAN_PENCARIAN,
  RELAAS_PENCARIAN,
  UMUR_PENCARIAN,
  STATUS_PENCARIAN,
  biayaPerkara,
  faktaPenilaianSk,
  cariPerkara,
  identitasPerkara,
  isoTanggal,
  riwayatPenundaan,
  selisihHari,
  statusLengkap,
};
