"use strict";

/**
 * ============================================================================
 * BERKAS KE FOLDER SIPP - DITAHAN DI MODE KEMBARAN
 * ============================================================================
 *
 * Tulisan e-Doc (putusan, BAS, penetapan) punya DUA bagian: berkas di folder
 * SIPP dan baris di basis data yang menunjuknya. Mengalihkan hanya barisnya
 * akan meninggalkan berkas yatim di laptop sementara server tidak pernah
 * menerimanya - persis kegagalan diam yang dijaga verify-jalur-tulis.js.
 *
 * Karena itu di mode kembaran berkas TIDAK ditulis ke folder SIPP. Isinya
 * disimpan di folder antrean (dinamai menurut SHA-256 isinya) dan satu baris
 * antrean (BERKAS_TULIS / BERKAS_PINDAH) mencatat jalur tujuannya relatif
 * terhadap akar SIPP. Baris itu memakai kelompok dan urutan yang sama dengan
 * baris basis data sebuah permintaan, sehingga saat dikirim berkas tiba LEBIH
 * DULU dari barisnya - urutan yang sama dengan penulisan di server.
 *
 * Di mode biasa: tulis() = mkdir + writeFileSync, persis seperti kode lama.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const mode = require("./kembaranMode");
const antrean = require("./kembaranAntrean");

function folderBerkas() {
  return process.env.ALETA_KEMBARAN_BERKAS_DIR || path.join(mode.folderKembaran(), "berkas");
}

/** Jalur relatif terhadap akar SIPP, pakai garis miring biasa. Melempar bila di luar akar. */
function relatifDariAkar(penuh, akar) {
  const a = path.resolve(String(akar || ""));
  const p = path.resolve(String(penuh || ""));
  const r = path.relative(a, p).split(path.sep).join("/");
  if (!akar || !r || r.startsWith("..") || path.isAbsolute(r)) {
    throw new Error("Berkas di luar folder SIPP tidak dapat dialihkan ke antrean sinkron.");
  }
  return r;
}

async function catatBerkas(jenis, isiRekam) {
  const penjaga = require("./penjagaKembaran");
  const dasar = penjaga.dasarRekam();
  await antrean.dapatkan().catatBanyak([
    {
      ...dasar,
      dicatatPada: new Date().toISOString(),
      sumber: "sipp",
      jenis,
      tabel: "(berkas)",
      sql: "",
      uraian: { terbaca: true, jenis },
      status: "menunggu",
      hasil: null,
      cuplikan: { status: "tidak_perlu" },
      ...isiRekam,
    },
  ]);
}

/**
 * Menulis berkas ke folder SIPP (mode biasa) atau menahannya di antrean (kembaran).
 * opsi.akar = akar SIPP (wajib di mode kembaran); opsi.flag = mis. "wx" bila tidak boleh menimpa.
 */
async function tulis(penuh, isi, opsi = {}) {
  if (!mode.aktif()) {
    fs.mkdirSync(path.dirname(penuh), { recursive: true });
    if (opsi.flag) fs.writeFileSync(penuh, isi, { flag: opsi.flag });
    else fs.writeFileSync(penuh, isi);
    return { dialihkan: false };
  }
  const relatif = relatifDariAkar(penuh, opsi.akar);
  const bita = Buffer.isBuffer(isi) ? isi : Buffer.from(isi);
  const sha = crypto.createHash("sha256").update(bita).digest("hex");
  const simpan = path.join(folderBerkas(), `${sha}.bin`);
  fs.mkdirSync(path.dirname(simpan), { recursive: true });
  if (!fs.existsSync(simpan)) fs.writeFileSync(simpan, bita);
  await catatBerkas("BERKAS_TULIS", {
    berkas: { relatif, sha256: sha, ukuran: bita.length, simpan, tanpaTimpa: opsi.flag === "wx" },
  });
  return { dialihkan: true, relatif, sha256: sha };
}

/**
 * Memindah berkas di folder SIPP (mis. BAS lama ke folder "terhapus").
 * Mode biasa: renameSync (lintas cakram: salin lalu hapus) dan mengembalikan false bila sumber tidak ada.
 * Kembaran: dicatat, mengembalikan true.
 */
async function pindah(dari, ke, opsi = {}) {
  if (!mode.aktif()) {
    if (!fs.existsSync(dari)) return false;
    fs.mkdirSync(path.dirname(ke), { recursive: true });
    try {
      fs.renameSync(dari, ke);
    } catch (e) {
      if (!e || e.code !== "EXDEV") throw e;
      fs.copyFileSync(dari, ke, fs.constants.COPYFILE_EXCL);
      fs.unlinkSync(dari);
    }
    return true;
  }
  await catatBerkas("BERKAS_PINDAH", {
    berkas: { dariRelatif: relatifDariAkar(dari, opsi.akar), keRelatif: relatifDariAkar(ke, opsi.akar) },
  });
  return true;
}

module.exports = { folderBerkas, relatifDariAkar, tulis, pindah };
