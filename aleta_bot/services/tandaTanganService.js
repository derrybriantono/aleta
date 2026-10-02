"use strict";

/**
 * ============================================================================
 * TANDA TANGAN PEJABAT - DISIMPAN DI BASIS DATA ALETA
 * ============================================================================
 *
 * Dipakai membubuhkan tanda tangan pada penetapan yang diterbitkan ALETA:
 * PMH ditandatangani Ketua, PPP dan PJS oleh Panitera, PHS oleh ketua majelis
 * perkara itu. Siapa yang menandatangani sudah diketahui rencana penetapan -
 * yang belum ada hanya gambarnya.
 *
 * ============================================================================
 * TIDAK ADA SATU PUN YANG DAPAT DIPAKAI SEBELUM DISAHKAN MANUSIA
 * ============================================================================
 *
 * Ini aturan terpenting di berkas ini, dan sebabnya berat: tanda tangan yang
 * terpasang pada nama yang keliru adalah tanda tangan palsu pada penetapan
 * pengadilan. Tidak ada galat yang akan berbunyi, tidak ada yang akan
 * menyadarinya, dan yang menanggungnya pejabat yang namanya tercantum.
 *
 * Gambar yang diimpor dari berkas .doc karena itu masuk dalam keadaan BELUM
 * DISAHKAN dan tidak pernah dipulangkan untuk dipakai. Ia baru dapat dipakai
 * sesudah seseorang membuka gambarnya, menuliskan nama pemiliknya, dan
 * mengesahkannya - dan namanya tercatat sebagai yang mengesahkan.
 *
 * Pengukiran gambar dari .doc memang kasar (lihat impor): ia menyapu bita
 * mencari tanda berkas PNG dan JPEG, tanpa tahu gambar mana milik siapa.
 * Justru karena kasar itulah pengesahan manusia tidak dapat dilewati.
 *
 * ============================================================================
 * TIDAK PERNAH MENYENTUH BASIS DATA SIPP
 * ============================================================================
 *
 * Tanda tangan pejabat bukan data perkara. Ia milik satuan kerja, dipakai
 * lintas perkara, dan tidak punya tempat di skema SIPP - menaruhnya di sana
 * berarti menambah tabel ALETA ke dalam basis data aplikasi orang lain.
 */

const crypto = require("node:crypto");

const db = require("../bot_db_config");

const TABEL = "aleta_bot_tanda_tangan";

/** Gambar yang lebih kecil dari ini hampir pasti ikon, bukan tanda tangan. */
const BATAS_KECIL = 4 * 1024;
/** Dan yang lebih besar dari ini tidak wajar untuk satu goresan tinta. */
const BATAS_BESAR = 8 * 1024 * 1024;

let siapPromise = null;

function kueri(sql, params = []) {
  return new Promise((selesai, gagal) => {
    db.query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
  });
}

function pastikanTabel() {
  if (siapPromise) return siapPromise;
  siapPromise = kueri(`
    CREATE TABLE IF NOT EXISTS ${TABEL} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      sidik CHAR(40) NOT NULL,
      nama_pejabat VARCHAR(150) NOT NULL DEFAULT '',
      jabatan VARCHAR(120) NOT NULL DEFAULT '',
      jenis_berkas VARCHAR(8) NOT NULL DEFAULT 'png',
      ukuran INT NOT NULL DEFAULT 0,
      isi LONGBLOB NOT NULL,
      disahkan TINYINT NOT NULL DEFAULT 0,
      disahkan_oleh VARCHAR(120) NOT NULL DEFAULT '',
      disahkan_pada DATETIME NULL,
      asal VARCHAR(255) NOT NULL DEFAULT '',
      -- Tautan ke AKUN portal, bukan sekadar nama yang diketik.
      --
      -- Nama sebagai teks bebas sudah membuktikan rapuhnya di tempat lain:
      -- SK menulis "Munifah, S.H." sedangkan SIPP menulis "Munifa" - beda satu
      -- huruf, dan pencocokan nama yang meleset memasang tanda tangan orang
      -- lain pada penetapan pengadilan.
      --
      -- Peran dan sub-perannya ikut DISALIN saat penautan, bukan dibaca ulang
      -- dari portal tiap kali: yang harus terbaca pada penetapan lama adalah
      -- jabatan orang itu KETIKA ia menandatangani, bukan jabatannya hari ini.
      pengguna_id VARCHAR(64) NOT NULL DEFAULT '',
      peran VARCHAR(64) NOT NULL DEFAULT '',
      sub_peran VARCHAR(255) NOT NULL DEFAULT '',
      diinput_oleh VARCHAR(120) NOT NULL DEFAULT '',
      diinput_tanggal DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_ttd_sidik (sidik),
      KEY idx_ttd_nama (nama_pejabat),
      KEY idx_ttd_sah (disahkan)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
    // CREATE TABLE IF NOT EXISTS tidak menyentuh tabel yang SUDAH ada - dan di
    // peladen tabel ini sudah berisi lima puluh gambar. Tanpa ALTER di bawah,
    // kolom tautannya hanya lahir di pemasangan baru, dan yang lama akan
    // menjawab "Unknown column" pada tiap penautan.
    .then(async () => {
      for (const [kolom, bentuk] of [
        ["pengguna_id", "VARCHAR(64) NOT NULL DEFAULT ''"],
        ["peran", "VARCHAR(64) NOT NULL DEFAULT ''"],
        ["sub_peran", "VARCHAR(255) NOT NULL DEFAULT ''"],
      ]) {
        const ada = await kueri(
          `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [TABEL, kolom]
        ).catch(() => [{ n: 1 }]);
        const punya = Array.isArray(ada) && Number(ada[0] && ada[0].n) > 0;
        if (!punya) await kueri(`ALTER TABLE ${TABEL} ADD COLUMN ${kolom} ${bentuk}`);
      }
    })
    .catch((galat) => {
      siapPromise = null;
      throw galat;
    });
  return siapPromise;
}

function dua(n) {
  return String(n).padStart(2, "0");
}

function waktuMysqlSekarang() {
  const d = new Date();
  return (
    `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())} ` +
    `${dua(d.getHours())}:${dua(d.getMinutes())}:${dua(d.getSeconds())}`
  );
}

function potong(nilai, panjang) {
  return String(nilai === null || nilai === undefined ? "" : nilai).slice(0, panjang);
}

/**
 * ============================================================================
 * MENGUKIR GAMBAR DARI BERKAS .doc
 * ============================================================================
 *
 * Berkas .doc adalah wadah OLE2, dan gambarnya tersimpan di dalam salah satu
 * arusnya. Yang dikerjakan di sini BUKAN penguraian OLE2 - ia menyapu seluruh
 * bita mencari tanda awal PNG dan JPEG lalu memotongnya sampai penanda
 * akhirnya.
 *
 * Cara ini kasar dan diakui kasar: yang terukir bisa saja logo kop surat, garis
 * pemisah, atau gambar yang sama dua kali. Karena itu hasilnya tidak pernah
 * langsung dipakai - lihat catatan tentang pengesahan di kepala berkas ini.
 *
 * Yang TIDAK dikerjakan di sini: menebak gambar mana milik siapa. Nama pejabat
 * memang ada di dalam .doc yang sama, tetapi urutan gambar di dalam wadah OLE2
 * tidak harus sama dengan urutan namanya di dalam teks - dan menebaknya berarti
 * memasang tanda tangan orang lain pada penetapan pengadilan.
 */
function ukirGambar(isiDoc) {
  const hasil = [];

  const tambah = (jenis, isi) => {
    if (isi.length < BATAS_KECIL || isi.length > BATAS_BESAR) return;
    hasil.push({ jenis, isi });
  };

  // --- PNG ---
  {
    const awal = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const akhir = Buffer.from("IEND\xae\x42\x60\x82", "latin1");
    let i = 0;
    while (i < isiDoc.length) {
      const mulai = isiDoc.indexOf(awal, i);
      if (mulai < 0) break;
      const selesai = isiDoc.indexOf(akhir, mulai);
      if (selesai < 0) break;
      tambah("png", isiDoc.subarray(mulai, selesai + akhir.length));
      i = selesai + akhir.length;
    }
  }

  // --- JPEG ---
  {
    const awal = Buffer.from([0xff, 0xd8, 0xff]);
    const akhir = Buffer.from([0xff, 0xd9]);
    let i = 0;
    while (i < isiDoc.length) {
      const mulai = isiDoc.indexOf(awal, i);
      if (mulai < 0) break;
      const selesai = isiDoc.indexOf(akhir, mulai + 3);
      if (selesai < 0) break;
      tambah("jpg", isiDoc.subarray(mulai, selesai + 2));
      i = selesai + 2;
    }
  }

  return hasil;
}

/**
 * Nama bergelar yang terbaca di dalam .doc yang sama.
 *
 * BUKAN pasangan gambarnya - hanya daftar pilihan, supaya yang mengesahkan
 * tidak perlu mengetik ulang nama beserta gelarnya satu per satu dan salah
 * ketik pada gelar tidak menjadi nama pejabat yang berbeda.
 */
function ukirNama(isiDoc) {
  const teks = isiDoc.toString("latin1");
  const pola =
    /[A-Z][A-Za-z'.]{1,20}(?: [A-Z][A-Za-z'.]{1,20}){0,4},? (?:S\.H|M\.H|S\.Ag|S\.HI|S\.H\.I|M\.Si|S\.Sos|S\.E|S\.Kom|M\.A|A\.Md)[A-Za-z.,' ]{0,25}/g;
  const nama = [...teks.matchAll(pola)].map((x) => x[0].trim()).filter((x) => x.length < 70);
  return [...new Set(nama)];
}

/**
 * Memasukkan gambar hasil ukiran ke basis data, seluruhnya BELUM DISAHKAN.
 *
 * Gambar yang sudah pernah masuk dilewati - dikenali dari sidiknya, bukan dari
 * namanya: berkas .doc yang diimpor dua kali tidak menghasilkan dua baris untuk
 * tanda tangan yang sama.
 */
async function impor(isiDoc, { asal = "", oleh = "" } = {}) {
  await pastikanTabel();

  const gambar = ukirGambar(isiDoc);
  const nama = ukirNama(isiDoc);

  let masuk = 0;
  let dilewati = 0;

  for (const g of gambar) {
    const sidik = crypto.createHash("sha1").update(g.isi).digest("hex");
    const ada = await kueri(`SELECT id FROM ${TABEL} WHERE sidik = ? LIMIT 1`, [sidik]);
    if (Array.isArray(ada) && ada.length > 0) {
      dilewati += 1;
      continue;
    }
    await kueri(
      `INSERT INTO ${TABEL} (sidik, jenis_berkas, ukuran, isi, asal, diinput_oleh, diinput_tanggal)
       VALUES (?,?,?,?,?,?,?)`,
      [sidik, g.jenis, g.isi.length, g.isi, potong(asal, 255), potong(oleh, 120), waktuMysqlSekarang()]
    );
    masuk += 1;
  }

  return { ok: true, ditemukan: gambar.length, masuk, dilewati, namaTerbaca: nama };
}

/**
 * Menambahkan SATU tanda tangan yang diunggah orang.
 *
 * ============================================================================
 * KENAPA PERLU, PADAHAL SUDAH ADA PENGIMPOR
 * ============================================================================
 *
 * Pengimpor membaca berkas .doc satuan kerja dan menyapu bita mencari tanda
 * berkas PNG dan JPEG. Ia hanya memulangkan yang KEBETULAN ada di dokumen itu:
 * pejabat baru, pejabat yang tanda tangannya berubah, dan siapa pun yang tidak
 * pernah masuk dokumen itu tidak punya jalan sama sekali - selain meminta
 * seseorang menyunting .doc-nya lalu menjalankan skrip di peladen.
 *
 * ============================================================================
 * TETAP MENUNGGU PENGESAHAN
 * ============================================================================
 *
 * Yang diunggah TIDAK langsung sah, sama seperti yang diimpor. Gambar yang
 * diunggah seseorang sambil mengetikkan nama orang lain persis sama
 * berbahayanya dengan gambar yang tertukar di dalam .doc - dan pengesahan oleh
 * orang kedua adalah satu-satunya hal yang memisahkan keduanya dari tanda
 * tangan palsu pada penetapan pengadilan.
 *
 * Sidiknya tetap diperiksa: gambar yang sama persis tidak masuk dua kali,
 * walau diunggah dari layar alih-alih dibaca dari dokumen.
 */
async function tambah({
  isiBase64 = "",
  jenisBerkas = "",
  namaPejabat = "",
  jabatan = "",
  penggunaId = "",
  peran = "",
  subPeran = "",
  asal = "unggahan layar",
  oleh = "",
} = {}) {
  await pastikanTabel();

  const nama = potong(namaPejabat, 150).trim();
  if (!nama) return { ok: false, alasan: "nama_pejabat_kosong" };

  const bersih = String(isiBase64 || "").replace(/^data:[^;]+;base64,/, "").trim();
  if (!bersih) return { ok: false, alasan: "gambar_kosong" };

  let isi;
  try {
    isi = Buffer.from(bersih, "base64");
  } catch (galat) {
    return { ok: false, alasan: "gambar_tidak_terbaca" };
  }
  if (!isi || isi.length === 0) return { ok: false, alasan: "gambar_kosong" };
  if (isi.length > BATAS_BESAR) return { ok: false, alasan: "gambar_terlalu_besar", ukuran: isi.length };
  if (isi.length < BATAS_KECIL) return { ok: false, alasan: "gambar_terlalu_kecil", ukuran: isi.length };

  // Jenisnya dibaca dari BITANYA, bukan dari nama berkas atau dari apa yang
  // disebut peramban. Berkas bernama .png yang isinya bukan PNG akan gagal
  // digambar pada penetapan, dan gagalnya baru terlihat di kertas.
  const jenis = jenisDariBita(isi);
  if (!jenis) return { ok: false, alasan: "bukan_gambar_png_atau_jpeg" };
  if (jenisBerkas && String(jenisBerkas).toLowerCase().replace("jpeg", "jpg") !== jenis.replace("jpeg", "jpg")) {
    // Bukan penolakan - hanya laporan. Yang dipakai tetap jenis dari bitanya.
  }

  const sidik = crypto.createHash("sha1").update(isi).digest("hex");
  const ada = await kueri(`SELECT id, nama_pejabat FROM ${TABEL} WHERE sidik = ? LIMIT 1`, [sidik]);
  if (Array.isArray(ada) && ada.length > 0) {
    return {
      ok: false,
      alasan: "gambar_sudah_ada",
      id: Number(ada[0].id),
      namaPejabat: String(ada[0].nama_pejabat || ""),
    };
  }

  const hasil = await kueri(
    `INSERT INTO ${TABEL}
       (sidik, nama_pejabat, jabatan, pengguna_id, peran, sub_peran,
        jenis_berkas, ukuran, isi, asal, diinput_oleh, diinput_tanggal)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      sidik,
      nama,
      potong(jabatan, 120).trim(),
      potong(penggunaId, 64).trim(),
      potong(peran, 64).trim(),
      potong(subPeran, 255).trim(),
      jenis,
      isi.length,
      isi,
      potong(asal, 255),
      potong(oleh, 120),
      waktuMysqlSekarang(),
    ]
  );

  return {
    ok: true,
    id: Number(hasil && hasil.insertId) || 0,
    namaPejabat: nama,
    jenisBerkas: jenis,
    ukuran: isi.length,
    // Disebut TEGAS supaya layar tidak perlu menyimpulkannya sendiri.
    disahkan: false,
    keterangan: "Tanda tangan tersimpan tetapi BELUM disahkan - ia belum dapat dipakai membubuhi penetapan.",
  };
}

/** Jenis gambar dari bitanya sendiri - "png", "jpg", atau kosong bila bukan keduanya. */
function jenisDariBita(isi) {
  if (isi.length >= 8 && isi[0] === 0x89 && isi[1] === 0x50 && isi[2] === 0x4e && isi[3] === 0x47) return "png";
  if (isi.length >= 3 && isi[0] === 0xff && isi[1] === 0xd8 && isi[2] === 0xff) return "jpg";
  return "";
}

/** Daftar tanda tangan - TANPA isi gambarnya, yang dibaca terpisah. */
async function daftar({ hanyaSah = false } = {}) {
  await pastikanTabel();
  const baris = await kueri(
    `SELECT id, sidik, nama_pejabat, jabatan, jenis_berkas, ukuran, disahkan,
            disahkan_oleh, disahkan_pada, asal, diinput_oleh, diinput_tanggal,
            pengguna_id, peran, sub_peran
       FROM ${TABEL}
      ${hanyaSah ? "WHERE disahkan = 1" : ""}
      ORDER BY disahkan DESC, nama_pejabat, id`
  );
  return {
    ok: true,
    baris: (Array.isArray(baris) ? baris : []).map((b) => ({
      id: Number(b.id),
      sidik: String(b.sidik),
      namaPejabat: String(b.nama_pejabat || ""),
      jabatan: String(b.jabatan || ""),
      jenisBerkas: String(b.jenis_berkas || "png"),
      ukuran: Number(b.ukuran) || 0,
      disahkan: Number(b.disahkan) === 1,
      disahkanOleh: String(b.disahkan_oleh || ""),
      disahkanPada: b.disahkan_pada ? new Date(b.disahkan_pada).toISOString() : "",
      asal: String(b.asal || ""),
      penggunaId: String(b.pengguna_id || ""),
      peran: String(b.peran || ""),
      subPeran: String(b.sub_peran || ""),
    })),
  };
}

/** Gambarnya sendiri - dipakai layar pengesahan dan pembubuh tanda tangan. */
async function gambar(id) {
  await pastikanTabel();
  const nomor = Number(id);
  if (!Number.isFinite(nomor) || nomor <= 0) return null;
  const baris = await kueri(`SELECT jenis_berkas, isi FROM ${TABEL} WHERE id = ? LIMIT 1`, [nomor]);
  const satu = Array.isArray(baris) ? baris[0] : null;
  if (!satu) return null;
  return { jenis: String(satu.jenis_berkas || "png"), isi: satu.isi };
}

/**
 * Menamai satu tanda tangan.
 *
 * Menamai TIDAK mengesahkan. Keduanya sengaja dua langkah: yang menuliskan nama
 * belum tentu yang berwenang menyatakan gambar itu memang tanda tangannya, dan
 * satu langkah yang menggabungkan keduanya menghilangkan pemeriksaan yang
 * justru menjadi seluruh alasan adanya pengesahan.
 *
 * Mengubah nama MEMBATALKAN pengesahannya. Tanda tangan yang sudah disahkan
 * atas nama A lalu diganti namanya menjadi B adalah tanda tangan A pada
 * penetapan B - persis keadaan yang hendak dicegah.
 */
async function namai(
  id,
  { namaPejabat = "", jabatan = "", penggunaId = "", peran = "", subPeran = "", oleh = "" } = {}
) {
  await pastikanTabel();
  const nomor = Number(id);
  if (!Number.isFinite(nomor) || nomor <= 0) return { ok: false, alasan: "id_tidak_sah" };

  const nama = potong(namaPejabat, 150).trim();
  if (!nama) return { ok: false, alasan: "nama_pejabat_kosong" };

  const sebelum = await kueri(`SELECT nama_pejabat, disahkan FROM ${TABEL} WHERE id = ? LIMIT 1`, [nomor]);
  const satu = Array.isArray(sebelum) ? sebelum[0] : null;
  if (!satu) return { ok: false, alasan: "tanda_tangan_tidak_ketemu" };

  const berubah = String(satu.nama_pejabat || "").trim() !== nama;
  // Dibaca SEBELUM pembaruannya berjalan. Dibaca sesudahnya, nilainya sudah
  // menjadi nol oleh pembaruan itu sendiri - dan laporan "pengesahannya
  // dibatalkan" tidak pernah berbunyi walau pengesahannya memang dibatalkan.
  const sudahDisahkan = Number(satu.disahkan) === 1;

  // Dua pernyataan yang berbeda, bukan satu dengan ruas bersyarat: yang
  // namanya TIDAK berubah tidak boleh kehilangan catatan siapa dan kapan
  // mengesahkannya, dan satu pernyataan yang mengisi ruas itu dengan nilai
  // bersyarat terlalu mudah menuliskan null ke sana tanpa ada yang menyadarinya.
  const idAkun = potong(penggunaId, 64).trim();
  const peranAkun = potong(peran, 64).trim();
  const subPeranAkun = potong(subPeran, 255).trim();

  if (berubah) {
    await kueri(
      `UPDATE ${TABEL}
          SET nama_pejabat = ?, jabatan = ?, pengguna_id = ?, peran = ?, sub_peran = ?,
              disahkan = 0, disahkan_oleh = '', disahkan_pada = NULL
        WHERE id = ?`,
      [nama, potong(jabatan, 120).trim(), idAkun, peranAkun, subPeranAkun, nomor]
    );
  } else {
    await kueri(
      `UPDATE ${TABEL} SET nama_pejabat = ?, jabatan = ?, pengguna_id = ?, peran = ?, sub_peran = ?
        WHERE id = ?`,
      [nama, potong(jabatan, 120).trim(), idAkun, peranAkun, subPeranAkun, nomor]
    );
  }

  return { ok: true, id: nomor, namaPejabat: nama, pengesahanDibatalkan: berubah && sudahDisahkan, oleh };
}

/** Mengesahkan - sesudah ini, dan hanya sesudah ini, ia boleh dipakai. */
async function sahkan(id, { oleh = "" } = {}) {
  await pastikanTabel();
  const nomor = Number(id);
  if (!Number.isFinite(nomor) || nomor <= 0) return { ok: false, alasan: "id_tidak_sah" };

  const pengesah = potong(oleh, 120).trim();
  if (!pengesah) return { ok: false, alasan: "pengesah_tidak_dikenali" };

  const baris = await kueri(`SELECT nama_pejabat FROM ${TABEL} WHERE id = ? LIMIT 1`, [nomor]);
  const satu = Array.isArray(baris) ? baris[0] : null;
  if (!satu) return { ok: false, alasan: "tanda_tangan_tidak_ketemu" };
  // Tanda tangan tanpa nama tidak dapat disahkan: yang disahkan justru
  // pernyataan bahwa gambar ini milik orang yang namanya tertulis.
  if (!String(satu.nama_pejabat || "").trim()) return { ok: false, alasan: "belum_dinamai" };

  await kueri(
    `UPDATE ${TABEL} SET disahkan = 1, disahkan_oleh = ?, disahkan_pada = ? WHERE id = ?`,
    [pengesah, waktuMysqlSekarang(), nomor]
  );
  return { ok: true, id: nomor, oleh: pengesah };
}

async function hapus(id) {
  await pastikanTabel();
  const nomor = Number(id);
  if (!Number.isFinite(nomor) || nomor <= 0) return { ok: false, alasan: "id_tidak_sah" };
  await kueri(`DELETE FROM ${TABEL} WHERE id = ?`, [nomor]);
  return { ok: true, id: nomor };
}

/**
 * Tanda tangan milik seorang pejabat - HANYA yang sudah disahkan.
 *
 * Namanya dicocokkan sesudah dibakukan: SIPP menuliskan "Sudarmin H.I.M. Tang,
 * S.H.I., M.H" sedangkan blangko ABT menuliskannya dengan huruf besar seluruhnya
 * dan titik yang tidak selalu sama. Yang dibandingkan huruf dan angkanya saja.
 */
function bakuNama(nilai) {
  return String(nilai || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

async function untukPejabat(namaPejabat) {
  await pastikanTabel();
  const dicari = bakuNama(namaPejabat);
  if (!dicari) return null;

  const baris = await kueri(
    `SELECT id, nama_pejabat, jenis_berkas, isi FROM ${TABEL} WHERE disahkan = 1`
  );
  for (const b of Array.isArray(baris) ? baris : []) {
    if (bakuNama(b.nama_pejabat) === dicari) {
      return { id: Number(b.id), namaPejabat: String(b.nama_pejabat), jenis: String(b.jenis_berkas), isi: b.isi };
    }
  }
  return null;
}

/**
 * Tanda tangan SAH milik satu akun portal (pengguna_id) - dipakai edoc
 * penetapan (butir 17, 2 Okt 2026) untuk mendahulukan tanda tangan pengguna
 * yang sedang login. Hanya yang disahkan; yang terbaru disahkan menang.
 */
async function untukPengguna(penggunaId) {
  const id = String(penggunaId || "").trim();
  if (!id) return null;
  await pastikanTabel();
  const baris = await kueri(
    `SELECT id, nama_pejabat, jenis_berkas, isi FROM ${TABEL}
      WHERE disahkan = 1 AND pengguna_id = ?
      ORDER BY disahkan_pada DESC, id DESC LIMIT 1`,
    [id.slice(0, 64)]
  );
  const b = Array.isArray(baris) ? baris[0] : null;
  if (!b) return null;
  return { id: Number(b.id), namaPejabat: String(b.nama_pejabat), jenis: String(b.jenis_berkas), isi: b.isi };
}

module.exports = {
  TABEL,
  BATAS_KECIL,
  BATAS_BESAR,
  pastikanTabel,
  ukirGambar,
  ukirNama,
  impor,
  tambah,
  jenisDariBita,
  daftar,
  gambar,
  namai,
  sahkan,
  hapus,
  untukPejabat,
  untukPengguna,
  bakuNama,
};
