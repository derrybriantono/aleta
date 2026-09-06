"use strict";

/**
 * ============================================================================
 * CATATAN YANG MELEKAT PADA PENILAIAN - D02, D13, D14, D18
 * ============================================================================
 *
 * Empat alat, satu bentuk, satu tabel:
 *
 *   D02 penjelasan  - hak jawab atas sebuah temuan
 *   D13 tindakLanjut - keadaan pengerjaan sebuah baris
 *   D14 disposisi   - arahan pimpinan atas sebuah penilaian
 *   D18 peristiwa   - penanda pada sumbu waktu
 *
 * Keempatnya berbentuk sama: sebuah tulisan yang melekat pada sesuatu,
 * berpenulis dan bertanggal. Membuat empat tabel yang hampir serupa berarti
 * empat perangkat kode yang perlahan menyimpang, dan pada akhirnya empat cara
 * berbeda menjawab pertanyaan yang sama.
 *
 * ============================================================================
 * D02 - MENGAPA HAK JAWAB TIDAK DAPAT DITUNDA
 * ============================================================================
 *
 * Tujuh ribu enam puluh dua putusan ditandai diubah sesudah minutasi, dan nol
 * di antaranya punya catatan. Sebagian besar boleh jadi pembetulan salah ketik
 * yang sah - tetapi tidak ada tempat mengatakannya.
 *
 * Menerbitkan tujuh ribu temuan tanpa tempat menjawab akan membuat aplikasi ini
 * dibenci sebelum sempat berguna, dan yang dibenci tidak akan dipakai. Karena
 * itu temuan dan hak jawab terbit BERSAMAAN, atau tidak sama sekali.
 *
 * Penjelasan TIDAK menghapus temuan. Ia melekat padanya, sehingga yang membaca
 * melihat keduanya sekaligus - temuan tanpa penjelasannya adalah tuduhan, dan
 * temuan yang dihapus karena ada penjelasan adalah pengawasan yang mandul.
 *
 * ============================================================================
 * D13 - KEADAAN NILAI DAN KEADAAN PENGERJAAN ITU DUA HAL
 * ============================================================================
 *
 * Keadaan nilai menjawab "baik atau buruk". Keadaan tindak lanjut menjawab
 * "sudah dikerjakan atau belum". Tanpa yang kedua, daftar temuan tidak pernah
 * berkurang dan rapat pengawasan berikutnya membahas daftar yang sama persis.
 */

const botDb = require("./botDbService");

const TABEL = "aleta_bot_catatan_penilaian";

/** Jenis catatan. Daftar tertutup - lihat analisaLanjutService. */
const JENIS = Object.assign(Object.create(null), {
  penjelasan: {
    label: "Catatan penjelasan",
    alat: "D02",
    melekatPada: "baris",
    keterangan: "Hak jawab atas sebuah temuan. Tidak menghapus temuannya.",
  },
  tindakLanjut: {
    label: "Keadaan tindak lanjut",
    alat: "D13",
    melekatPada: "baris",
    keterangan: "Sudah dikerjakan atau belum - terpisah dari baik atau buruk.",
  },
  disposisi: {
    label: "Disposisi pimpinan",
    alat: "D14",
    melekatPada: "penilaian",
    keterangan: "Arahan Ketua, Panitera, Sekretaris, atau Hakim Pengawas Bidang.",
  },
  peristiwa: {
    label: "Anotasi peristiwa",
    alat: "D18",
    melekatPada: "waktu",
    keterangan: "Mutasi, libur, gangguan SIPP, perubahan wilayah - diinput manusia.",
  },
});

/**
 * Keadaan tindak lanjut. Daftar tertutup pula.
 *
 * "dikecualikan" ada dengan sengaja: sebagian temuan memang tidak perlu
 * ditindak, dan memaksa orang menandainya "selesai" akan membuat kata itu
 * kehilangan arti.
 */
const KEADAAN_TINDAK = Object.assign(Object.create(null), {
  belum: "Belum ditindak",
  jalan: "Sedang dikerjakan",
  selesai: "Selesai",
  dikecualikan: "Dikecualikan",
});

let tabelSiap = false;
let janjiTabel = null;

async function pastikanTabel() {
  if (tabelSiap) return true;
  if (janjiTabel) return janjiTabel;

  janjiTabel = (async () => {
    await botDb.query(`
      CREATE TABLE IF NOT EXISTS ${TABEL} (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        jenis VARCHAR(24) NOT NULL,
        penilaian VARCHAR(64) NOT NULL DEFAULT '',
        periode_jenis VARCHAR(24) NOT NULL DEFAULT '',
        unit_kunci VARCHAR(32) NOT NULL DEFAULT '',
        baris_kunci VARCHAR(191) NOT NULL DEFAULT '',
        keadaan VARCHAR(24) NOT NULL DEFAULT '',
        isi MEDIUMTEXT NULL,
        penulis VARCHAR(191) NOT NULL DEFAULT '',
        jabatan VARCHAR(191) NOT NULL DEFAULT '',
        ditulis_pada DATETIME NOT NULL,
        KEY idx_catatan_penilaian (penilaian, periode_jenis, unit_kunci),
        KEY idx_catatan_baris (penilaian, baris_kunci),
        KEY idx_catatan_jenis (jenis, ditulis_pada)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    tabelSiap = true;
    return true;
  })();

  try {
    return await janjiTabel;
  } catch (galat) {
    janjiTabel = null;
    throw galat;
  }
}

function lupakanTabel() {
  tabelSiap = false;
  janjiTabel = null;
}

function bersih(x) {
  return String(x === undefined || x === null ? "" : x).trim();
}

/**
 * Memeriksa bentuk sebuah catatan. Memulangkan daftar cela; kosong berarti sah.
 *
 * Diperiksa sebelum disimpan, sebab catatan yang tidak berpenulis atau tidak
 * bertanggal tidak berguna sebagai hak jawab - dan hak jawab yang tidak dapat
 * ditelusuri penulisnya sama saja dengan tidak ada.
 */
function celaCatatan(catatan) {
  const cela = [];
  if (!catatan || typeof catatan !== "object") return ["catatan bukan objek"];

  const jenis = bersih(catatan.jenis);
  if (!Object.prototype.hasOwnProperty.call(JENIS, jenis)) {
    cela.push(`jenis "${catatan.jenis}" tidak dikenali`);
    return cela;
  }
  const bentuk = JENIS[jenis];

  if (!bersih(catatan.penulis)) cela.push("penulis kosong - catatan tanpa penulis tidak dapat ditelusuri");
  if (!bersih(catatan.jabatan)) cela.push("jabatan kosong");

  if (bentuk.melekatPada === "baris") {
    if (!bersih(catatan.penilaian)) cela.push("penilaian kosong");
    if (!bersih(catatan.barisKunci)) cela.push("barisKunci kosong - catatan ini melekat pada satu baris");
  }
  if (bentuk.melekatPada === "penilaian") {
    if (!bersih(catatan.penilaian)) cela.push("penilaian kosong");
  }
  if (bentuk.melekatPada === "waktu") {
    if (!bersih(catatan.unitKunci) && !bersih(catatan.periodeJenis)) {
      cela.push("anotasi peristiwa harus menyebut waktunya");
    }
  }

  if (jenis === "tindakLanjut") {
    const keadaan = bersih(catatan.keadaan);
    if (!Object.prototype.hasOwnProperty.call(KEADAAN_TINDAK, keadaan)) {
      cela.push(`keadaan "${catatan.keadaan}" tidak dikenali; yang sah: ${Object.keys(KEADAAN_TINDAK).join(", ")}`);
    }
    // "Dikecualikan" tanpa alasan adalah cara paling halus menghilangkan
    // temuan: ia tercatat, tampak sudah ditangani, dan tidak seorang pun
    // kembali kepadanya.
    if (keadaan === "dikecualikan" && bersih(catatan.isi).length < 15) {
      cela.push("temuan yang dikecualikan wajib menyebut alasannya");
    }
  } else if (!bersih(catatan.isi)) {
    cela.push("isi kosong");
  }

  return cela;
}

async function tulisCatatan(catatan) {
  const cela = celaCatatan(catatan);
  if (cela.length) throw new Error(`Catatan ditolak: ${cela.join("; ")}`);
  await pastikanTabel();

  const waktu = catatan.ditulisPada || new Date();
  await botDb.query(
    `INSERT INTO ${TABEL}
      (jenis, penilaian, periode_jenis, unit_kunci, baris_kunci, keadaan, isi, penulis, jabatan, ditulis_pada)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      bersih(catatan.jenis),
      bersih(catatan.penilaian),
      bersih(catatan.periodeJenis),
      bersih(catatan.unitKunci),
      bersih(catatan.barisKunci).slice(0, 191),
      bersih(catatan.keadaan),
      catatan.isi === undefined || catatan.isi === null ? "" : String(catatan.isi),
      bersih(catatan.penulis).slice(0, 191),
      bersih(catatan.jabatan).slice(0, 191),
      botDb.toMysqlDate ? botDb.toMysqlDate(waktu) : waktu,
    ]
  );
  return { ok: true };
}

/** Seluruh catatan yang melekat pada sebuah penilaian. */
async function bacaCatatan({ penilaian, jenis = null, barisKunci = null, batas = 200 } = {}) {
  await pastikanTabel();
  const syarat = ["penilaian = ?"];
  const nilai = [bersih(penilaian)];
  if (jenis) {
    syarat.push("jenis = ?");
    nilai.push(bersih(jenis));
  }
  if (barisKunci) {
    syarat.push("baris_kunci = ?");
    nilai.push(bersih(barisKunci));
  }
  nilai.push(Number(batas) || 200);

  const baris = await botDb.query(
    `SELECT id, jenis, penilaian, periode_jenis AS periodeJenis, unit_kunci AS unitKunci,
            baris_kunci AS barisKunci, keadaan, isi, penulis, jabatan, ditulis_pada AS ditulisPada
       FROM ${TABEL}
      WHERE ${syarat.join(" AND ")}
      ORDER BY ditulis_pada DESC, id DESC
      LIMIT ?`,
    nilai
  );
  return Array.isArray(baris) ? baris : [];
}

/**
 * Keadaan tindak lanjut terakhir untuk tiap baris.
 *
 * Yang berlaku catatan TERBARU, bukan yang pertama - keadaan berubah, dan
 * riwayat perubahannya tetap tersimpan.
 */
async function keadaanTindakLanjut(penilaian) {
  const semua = await bacaCatatan({ penilaian, jenis: "tindakLanjut", batas: 1000 });
  const peta = new Map();
  semua.forEach((c) => {
    // Sudah terurut menurun; yang pertama ditemui adalah yang terbaru.
    if (!peta.has(c.barisKunci)) peta.set(c.barisKunci, c);
  });
  return peta;
}

/**
 * Menempelkan catatan pada baris bukti sebuah penilaian.
 *
 * Baris yang belum punya catatan diberi keadaan "belum" - bukan dibiarkan
 * kosong. Kolom kosong terbaca sebagai "tidak berlaku"; "belum ditindak"
 * terbaca sebagai pekerjaan yang menunggu, dan itulah yang benar.
 */
async function lekatkanPadaBaris(penilaian, barisBukti) {
  const tindak = await keadaanTindakLanjut(penilaian);
  const penjelasan = await bacaCatatan({ penilaian, jenis: "penjelasan", batas: 1000 });
  const petaPenjelasan = new Map();
  penjelasan.forEach((c) => {
    if (!petaPenjelasan.has(c.barisKunci)) petaPenjelasan.set(c.barisKunci, []);
    petaPenjelasan.get(c.barisKunci).push(c);
  });

  return (Array.isArray(barisBukti) ? barisBukti : []).map((b) => {
    const kunci = bersih(b && b.kunci);
    const t = tindak.get(kunci);
    return {
      ...b,
      tindakLanjut: t ? t.keadaan : "belum",
      tindakLanjutTerbaca: t ? KEADAAN_TINDAK[t.keadaan] : KEADAAN_TINDAK.belum,
      tindakLanjutOleh: t ? t.penulis : null,
      penjelasan: petaPenjelasan.get(kunci) || [],
      adaPenjelasan: (petaPenjelasan.get(kunci) || []).length > 0,
    };
  });
}

module.exports = {
  TABEL,
  JENIS,
  KEADAAN_TINDAK,
  pastikanTabel,
  lupakanTabel,
  celaCatatan,
  tulisCatatan,
  bacaCatatan,
  keadaanTindakLanjut,
  lekatkanPadaBaris,
};
