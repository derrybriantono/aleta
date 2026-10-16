"use strict";

/**
 * ============================================================================
 * PENGATURAN SIPP & ABT - PENULIS ATURAN ABT DARI HALAMAN ADMIN PORTAL
 * ============================================================================
 *
 * 16 Oktober 2026 (Tahap H). Halaman admin portal "Pengaturan SIPP & ABT"
 * membaca dan mengubah EMPAT hal di basis data ABT (aps_badilag, MariaDB 5.5,
 * seluruh tabel abt_* InnoDB ber-latin1 - diukur di server 16 Okt 2026):
 *
 *   menu      abt_menu  - hak satu folder Blangko Derry (parent_direktori
 *             'derry_briantono'): peran yang melihat, peran yang selalu boleh,
 *             validator BAS, cek penunjukan, rentang tahapan & jenis perkara
 *   config    abt_config - hanya nama di CONFIG_BOLEH (validasi_data_bas)
 *   variabel  abt_variabel - sql_query (data_sql) dan default_data, HANYA
 *             variabel yang dipakai RTF Blangko Derry dan TIDAK dikunci ABT
 *   templat   abt_tanyajawab_template - isi satu kumpulan tanya jawab
 *
 * ============================================================================
 * PAGAR TULIS
 * ============================================================================
 *
 * - Satu transaksi per simpan (transaksiSipp.denganTransaksi - satu sambungan
 *   kolam SIPP; aps_badilag berada di server MariaDB yang sama). Baris yang
 *   diubah dikunci (SELECT ... FOR UPDATE) lalu dibandingkan dengan nilai LAMA
 *   yang dikirim portal: berbeda = tidak ada yang ditulis (kode 'berubah').
 *   Pola PRASYARAT paket ABT, tanpa paket.
 * - Template tanya jawab ditulis LANGSUNG (DELETE + INSERT di dalam transaksi).
 *   Rute ABT `main/tanyajawab_template?hapus=` tidak pernah dipanggil - rute itu
 *   menghapus lewat GET tanpa memeriksa peran (A-PETA-ABT jebakan 11).
 * - Teks di luar latin1/cp1252 ditolak sebelum menulis: kolom latin1 menyimpan
 *   huruf Arab/emoji sebagai '?' tanpa pesan (A-PETA-ABT jebakan 9).
 * - Kueri variabel hanya satu SELECT (pagarBaca mesin variabel + titik koma
 *   ganda ditolak) dan wajib LOLOS UJI atas satu perkara sebelum disimpan.
 * - Kolom `modifier` ABT tidak disentuh (tanpa tanda ALETA di sistem luar);
 *   jejak jujur siapa-mengubah-apa ada di portal (aleta_abt_suntingan).
 *
 * Bot tidak menyimpan cadangan: portal mencatat nilai lama SEBELUM memanggil
 * simpan, dan Kembalikan adalah simpan biasa dengan lama/baru ditukar.
 */

const fs = require("fs/promises");
const path = require("path");

const FOLDER_DERRY = "derry_briantono";
const KOLOM_MENU = [
  "user_grup_id",
  "user_top_id",
  "user_validator",
  "user_cek",
  "proses_id_min",
  "proses_id_max",
  "perkara_id_min",
  "perkara_id_max",
  "perkara_id_referensi",
];
const KOLOM_DAFTAR_PERAN = new Set(["user_grup_id", "user_top_id", "user_validator"]);
const KOLOM_ANGKA_WAJIB = new Set(["user_cek", "proses_id_min", "proses_id_max"]);
const KOLOM_ANGKA_BOLEH_KOSONG = new Set(["perkara_id_min", "perkara_id_max"]);
const REFERENSI_SAH = new Set(["jenis_perkara_id", "alur_perkara_id"]);
const CONFIG_BOLEH = { validasi_data_bas: ["0", "1"] };
const KOLOM_VARIABEL_BOLEH = ["sql_query", "default_data"];

/**
 * IDENTITAS SATKER (17 Okt 2026, keputusan pengguna butir 3/4/7). Variabel
 * 9271-9274 (paket abt-universal-satker-derry) berbentuk
 *   SELECT CASE (SELECT TRIM(value) FROM sys_config WHERE name = 'KodePN' LIMIT 1)
 *     WHEN 'PA.Dgl' THEN '<isian satker>' ELSE <data SIPP / ''> END AS data
 * Halaman Identitas satker hanya mengubah CABANG `WHEN '<KodePN>' THEN '...'`
 * milik satker ini; kerangka kueri lainnya wajib tetap (kerangkaSatker).
 * #9275# (baris kontak kop) adalah gabungan 9272-9274 dan tidak disunting.
 */
const VARIABEL_SATKER = Object.freeze({ alamat: "9271", telepon: "9272", laman: "9273", surel: "9274" });
const NO_VAR_SATKER = new Set(Object.values(VARIABEL_SATKER));
const NO_VAR_IDENTITAS = ["9270", "9271", "9272", "9273", "9274", "9275", "9276"];
const NO_VAR_KODE_SURAT = "1154";
const KEPALA_CASE_SATKER = /CASE\s*\(\s*SELECT\s+TRIM\(\s*value\s*\)\s+FROM\s+sys_config\s+WHERE\s+name\s*=\s*'KodePN'\s+LIMIT\s+1\s*\)/i;
const RE_CABANG_SATKER = /\s*WHEN\s+'((?:[^'\\]|''|\\.)*)'\s+THEN\s+'((?:[^'\\]|''|\\.)*)'/gi;

/** Kueri tanpa cabang per satker - dua kueri yang kerangkanya sama hanya berbeda isian satker. */
function kerangkaSatker(sql) {
  return String(sql || "")
    .replace(RE_CABANG_SATKER, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const UMUR_INDEKS_MS = 10 * 60 * 1000;
const BATAS_UJI_MS = 20 * 1000;
const BATAS_KUERI_UJI_MS = 10 * 1000;
const PANJANG_KUERI_MAKS = 20000;
const PANJANG_BAWAAN_MAKS = 20000;
const BARIS_TEMPLAT_MAKS = 200;
const PANJANG_TANYA_MAKS = 5000;
const PANJANG_JAWAB_MAKS = 20000;

// ---------------------------------------------------------------------------
// Pemeriksa murni
// ---------------------------------------------------------------------------

/** Huruf cp1252 di 0x80-0x9F (MySQL latin1 = cp1252). */
const CP1252_TAMBAHAN = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

/** Huruf yang akan menjadi '?' di kolom latin1 - [] bila aman. */
function hurufDiluarLatin1(teks) {
  const hasil = [];
  for (const h of String(teks ?? "")) {
    const k = h.codePointAt(0);
    const aman = k === 9 || k === 10 || k === 13 || (k >= 32 && k <= 126) || (k >= 0xa0 && k <= 0xff) || CP1252_TAMBAHAN.has(h);
    if (!aman && !hasil.includes(h)) hasil.push(h);
    if (hasil.length >= 5) break;
  }
  return hasil;
}

/** Teks di luar kutipan & komentar - untuk menghitung titik koma. */
function kerangkaKueri(sql) {
  return String(sql)
    .replace(/'(?:[^'\\]|\\.|'')*'|"(?:[^"\\]|\\.|"")*"/g, "''")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|\s)(--\s|#(?!\d+#|perkara_id#))[^\n]*/g, " ");
}

/**
 * Kueri variabel ABT boleh disimpan? Pulang sebab dalam bahasa sehari-hari,
 * atau "" bila lolos. Penanda #NNNN# dan #perkara_id# diganti 0 dulu (yang
 * dijalankan ABT adalah kueri SESUDAH penggantian).
 */
function periksaKueriVariabel(sql, pagarBaca) {
  const teks = String(sql ?? "").trim();
  if (!teks) return "Kueri kosong.";
  if (teks.length > PANJANG_KUERI_MAKS) return `Kueri terlalu panjang (lebih dari ${PANJANG_KUERI_MAKS} huruf).`;
  const luar = hurufDiluarLatin1(teks);
  if (luar.length) return `Kueri memuat huruf yang tidak dapat disimpan ABT: ${luar.join(" ")}`;
  const kerangka = kerangkaKueri(teks);
  if (/;\s*;/.test(kerangka)) return "Kueri memuat titik koma ganda.";
  const tanpaAkhir = kerangka.trim().replace(/;\s*$/, "");
  if (tanpaAkhir.includes(";")) return "Kueri memuat lebih dari satu perintah (titik koma di tengah).";
  const siap = teks.replace(/#perkara_id#/g, "0").replace(/#\d{1,6}#/g, "0");
  const sebab = pagarBaca(siap);
  if (!sebab) return "";
  if (/kata terlarang/.test(sebab)) return `Kueri hanya boleh membaca data: ${sebab.replace(/^memuat /, "memuat ")}.`;
  if (/bukan satu SELECT/.test(sebab)) return "Kueri harus diawali SELECT (hanya membaca data).";
  return `Kueri ditolak: ${sebab}.`;
}

/** "1|30|500" -> "1|30|500" bersih; null bila kosong; melempar bila tak sah. */
function rapikanDaftarPeran(nilai, kolom) {
  if (nilai === null || nilai === undefined) return null;
  const teks = String(nilai).trim();
  if (!teks) return null;
  const bagian = teks.split("|").map((x) => x.trim()).filter(Boolean);
  const unik = [];
  for (const b of bagian) {
    if (!/^-?\d{1,6}$/.test(b)) throw galatTolak(`Daftar peran ${kolom} memuat "${b}" yang bukan nomor peran SIPP.`);
    if (!unik.includes(b)) unik.push(b);
  }
  const hasil = unik.join("|");
  if (hasil.length > 50) throw galatTolak(`Daftar peran ${kolom} terlalu panjang (batas ABT 50 huruf).`);
  return hasil || null;
}

function galatTolak(pesan, kode = "ditolak") {
  const g = new Error(pesan);
  g.kode = kode;
  g.ditolak = true;
  return g;
}

/** Nilai baru satu folder menu, dirapikan & diperiksa. Melempar bila tak sah. */
function rapikanMenuBaru(baru) {
  if (!baru || typeof baru !== "object") throw galatTolak("Isian baru tidak ada.");
  const hasil = {};
  for (const [k, v] of Object.entries(baru)) {
    if (!KOLOM_MENU.includes(k)) throw galatTolak(`Kolom "${k}" tidak boleh diubah dari sini.`);
    if (KOLOM_DAFTAR_PERAN.has(k)) hasil[k] = rapikanDaftarPeran(v, k);
    else if (KOLOM_ANGKA_WAJIB.has(k)) {
      const t = String(v ?? "").trim();
      if (!/^\d{1,5}$/.test(t)) throw galatTolak(`Isian ${k} harus angka.`);
      hasil[k] = Number(t);
    } else if (KOLOM_ANGKA_BOLEH_KOSONG.has(k)) {
      const t = String(v ?? "").trim();
      if (!t) hasil[k] = null;
      else if (/^\d{1,5}$/.test(t)) hasil[k] = Number(t);
      else throw galatTolak(`Isian ${k} harus angka atau kosong.`);
    } else if (k === "perkara_id_referensi") {
      const t = String(v ?? "").trim();
      if (t && !REFERENSI_SAH.has(t)) throw galatTolak("Acuan jenis perkara tidak dikenal.");
      hasil[k] = t || null;
    }
  }
  if ("user_cek" in hasil && hasil.user_cek > 3) throw galatTolak("Cara cek penunjukan hanya 0 sampai 3.");
  if (!Object.keys(hasil).length) throw galatTolak("Tidak ada yang diubah.");
  return hasil;
}

/** Nilai kolom pembanding: null/undefined -> "", angka -> teks. */
function teksDb(v) {
  if (v === null || v === undefined) return "";
  if (Buffer.isBuffer(v)) return v.toString("latin1");
  return String(v);
}

/** Baris template dirapikan seperti ABT menyimpan (strip_tags + ucfirst). */
function rapikanBarisTemplat(baris, { bolehKosong = false } = {}) {
  if (!Array.isArray(baris)) throw galatTolak("Daftar pertanyaan tidak terbaca.");
  if (!baris.length && !bolehKosong) throw galatTolak("Template harus memuat sedikitnya satu pertanyaan.");
  if (baris.length > BARIS_TEMPLAT_MAKS) throw galatTolak(`Paling banyak ${BARIS_TEMPLAT_MAKS} pertanyaan.`);
  const ucfirst = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
  const bersih = (t) => String(t ?? "").replace(/<[^>]*>/g, "").replace(/\r\n?/g, "\n").trim();
  return baris.map((b, i) => {
    const tanya = ucfirst(bersih(b && (b.tanya ?? b.pertanyaan)));
    const jawab = ucfirst(bersih(b && (b.jawab ?? b.jawaban)));
    if (!tanya) throw galatTolak(`Pertanyaan nomor ${i + 1} kosong.`);
    if (tanya.length > PANJANG_TANYA_MAKS) throw galatTolak(`Pertanyaan nomor ${i + 1} terlalu panjang.`);
    if (jawab.length > PANJANG_JAWAB_MAKS) throw galatTolak(`Jawaban nomor ${i + 1} terlalu panjang.`);
    const luar = hurufDiluarLatin1(tanya + jawab);
    if (luar.length) throw galatTolak(`Nomor ${i + 1} memuat huruf yang tidak dapat disimpan ABT: ${luar.join(" ")}`);
    return { no: i + 1, tanya, jawab };
  });
}

function samaBarisTemplat(a, b) {
  if (a.length !== b.length) return false;
  return a.every((x, i) => teksDb(x.tanya) === teksDb(b[i].tanya) && teksDb(x.jawab) === teksDb(b[i].jawab));
}

// ---------------------------------------------------------------------------
// Layanan
// ---------------------------------------------------------------------------

/**
 * @param {object} d
 * @param {(sql: string, params?: any[], opsi?: {timeoutMs?: number}) => Promise<object[]>} d.kueri  baca-saja (SIPP + aps_badilag)
 * @param {(kerja: (kueri) => Promise<any>) => Promise<any>} d.transaksi  satu transaksi tulis
 * @param {string} [d.skemaAbt]
 * @param {string} [d.akarBlangko]
 * @param {(opsi: object) => object} [d.buatMesin]
 */
function buatLayanan(d) {
  const skema = String(d.skemaAbt || process.env.ALETA_ABT_SKEMA || "aps_badilag").trim();
  if (!/^[A-Za-z0-9_]+$/.test(skema)) throw new Error("nama skema ABT tidak sah");
  const akarBlangko = d.akarBlangko || process.env.ALETA_BOT_BLANGKO_DIR || "/usr/src/app/blangko_abt";
  const mesinVar = require("./abtMesinVariabel");
  const buatMesin = d.buatMesin || mesinVar.buatMesin;
  const logoKop = () => d.logoKop || require("./logoKopService");
  const kueri = (sql, params = [], opsi = {}) => d.kueri(sql, params, opsi);
  const t = (nama) => `${skema}.${nama}`;

  // ---- menu ---------------------------------------------------------------

  const kolomMenuSql = ["id", "nama", "nama_alias", "direktori", "parent_direktori", ...KOLOM_MENU, "modified"].join(", ");

  async function bacaMenu() {
    const coba = (p) => p.catch(() => []);
    const [folder, grup, peran, proses, jenis, alur, config] = await Promise.all([
      kueri(`SELECT ${kolomMenuSql} FROM ${t("abt_menu")} WHERE parent_direktori = ? ORDER BY id`, [FOLDER_DERRY]),
      coba(kueri(`SELECT id, nama, direktori FROM ${t("abt_menu_grup")} WHERE direktori = ?`, [FOLDER_DERRY])),
      coba(kueri("SELECT groupid AS id, name AS nama FROM sys_groups ORDER BY groupid")),
      coba(kueri("SELECT id, nama FROM proses ORDER BY id")),
      coba(kueri("SELECT id, nama FROM jenis_perkara ORDER BY id")),
      coba(kueri("SELECT id, nama FROM alur_perkara ORDER BY id")),
      coba(kueri(`SELECT name, value FROM ${t("abt_config")} WHERE name IN (${Object.keys(CONFIG_BOLEH).map(() => "?").join(",")})`, Object.keys(CONFIG_BOLEH))),
    ]);
    const angka = (x) => (x === null || x === undefined || x === "" ? null : Number(x));
    return {
      grup: grup[0] || null,
      folder: folder.map((b) => ({
        id: Number(b.id),
        nama: teksDb(b.nama),
        namaAlias: teksDb(b.nama_alias),
        direktori: teksDb(b.direktori),
        user_grup_id: b.user_grup_id === null || b.user_grup_id === undefined ? null : teksDb(b.user_grup_id),
        user_top_id: b.user_top_id === null || b.user_top_id === undefined ? null : teksDb(b.user_top_id),
        user_validator: b.user_validator === null || b.user_validator === undefined ? null : teksDb(b.user_validator),
        user_cek: Number(b.user_cek) || 0,
        proses_id_min: Number(b.proses_id_min) || 0,
        proses_id_max: Number(b.proses_id_max) || 0,
        perkara_id_min: angka(b.perkara_id_min),
        perkara_id_max: angka(b.perkara_id_max),
        perkara_id_referensi: b.perkara_id_referensi ? teksDb(b.perkara_id_referensi) : null,
        diubah: teksDb(b.modified),
      })),
      peran: peran.map((b) => ({ id: Number(b.id), nama: teksDb(b.nama) })),
      proses: proses.map((b) => ({ id: Number(b.id), nama: teksDb(b.nama) })),
      jenis: jenis.map((b) => ({ id: Number(b.id), nama: teksDb(b.nama) })),
      alur: alur.map((b) => ({ id: Number(b.id), nama: teksDb(b.nama) })),
      config: Object.fromEntries(config.map((b) => [teksDb(b.name), teksDb(b.value)])),
    };
  }

  /**
   * ubah: [{id, lama:{kolom: nilai}, baru:{kolom: nilai}}]; config: [{name, lama, baru}].
   * Semua dalam SATU transaksi; satu prasyarat gagal = tidak ada yang ditulis.
   */
  async function simpanMenu(badan = {}) {
    const ubah = Array.isArray(badan.ubah) ? badan.ubah : [];
    const config = Array.isArray(badan.config) ? badan.config : [];
    if (!ubah.length && !config.length) throw galatTolak("Tidak ada yang diubah.");
    if (ubah.length > 80 || config.length > 5) throw galatTolak("Terlalu banyak ubahan sekaligus.");

    const rencana = ubah.map((u) => {
      const id = Number(u && u.id);
      if (!Number.isInteger(id) || id <= 0) throw galatTolak("Nomor folder tidak sah.");
      const baru = rapikanMenuBaru(u.baru);
      const lama = u.lama && typeof u.lama === "object" ? u.lama : null;
      if (!lama) throw galatTolak(`Nilai lama folder ${id} tidak dikirim - muat ulang halaman.`);
      for (const k of Object.keys(baru)) {
        if (!(k in lama)) throw galatTolak(`Nilai lama ${k} folder ${id} tidak dikirim - muat ulang halaman.`);
      }
      return { id, lama, baru };
    });
    const rencanaConfig = config.map((c) => {
      const name = String((c && c.name) || "");
      const boleh = CONFIG_BOLEH[name];
      if (!boleh) throw galatTolak(`Pengaturan ABT "${name}" tidak boleh diubah dari sini.`);
      const baru = String(c.baru ?? "");
      if (!boleh.includes(baru)) throw galatTolak(`Nilai "${baru}" tidak sah untuk ${name}.`);
      if (c.lama === undefined) throw galatTolak(`Nilai lama ${name} tidak dikirim - muat ulang halaman.`);
      return { name, lama: String(c.lama ?? ""), baru };
    });

    return d.transaksi(async (q) => {
      const sebelum = [];
      const sesudah = [];
      for (const r of rencana) {
        const kini = (await q(`SELECT ${kolomMenuSql} FROM ${t("abt_menu")} WHERE id = ? AND parent_direktori = ? FOR UPDATE`, [r.id, FOLDER_DERRY]))[0];
        if (!kini) throw galatTolak(`Folder ${r.id} bukan folder Blangko Derry.`, "bukan_derry");
        for (const k of Object.keys(r.baru)) {
          if (teksDb(kini[k]) !== teksDb(r.lama[k])) {
            throw galatTolak(`Hak folder "${teksDb(kini.nama_alias || kini.nama)}" sudah diubah orang lain sejak halaman dimuat - muat ulang lalu ulangi.`, "berubah");
          }
        }
        const kolom = Object.keys(r.baru);
        await q(
          `UPDATE ${t("abt_menu")} SET ${kolom.map((k) => `${k} = ?`).join(", ")} WHERE id = ? AND parent_direktori = ?`,
          [...kolom.map((k) => r.baru[k]), r.id, FOLDER_DERRY]
        );
        const baca = (await q(`SELECT ${kolomMenuSql} FROM ${t("abt_menu")} WHERE id = ?`, [r.id]))[0] || {};
        sebelum.push({ id: r.id, ...Object.fromEntries(kolom.map((k) => [k, kini[k] === undefined ? null : kini[k]])) });
        sesudah.push({ id: r.id, ...Object.fromEntries(kolom.map((k) => [k, baca[k] === undefined ? null : baca[k]])) });
      }
      const configSebelum = [];
      const configSesudah = [];
      for (const c of rencanaConfig) {
        const kini = (await q(`SELECT value FROM ${t("abt_config")} WHERE name = ? FOR UPDATE`, [c.name]))[0];
        if (!kini) throw galatTolak(`Pengaturan ABT "${c.name}" tidak ada.`);
        if (teksDb(kini.value) !== c.lama) throw galatTolak("Pengaturan ABT sudah diubah orang lain sejak halaman dimuat - muat ulang lalu ulangi.", "berubah");
        await q(`UPDATE ${t("abt_config")} SET value = ? WHERE name = ?`, [c.baru, c.name]);
        configSebelum.push({ name: c.name, value: teksDb(kini.value) });
        configSesudah.push({ name: c.name, value: c.baru });
      }
      return { sebelum, sesudah, configSebelum, configSesudah };
    });
  }

  // ---- variabel -----------------------------------------------------------

  let indeksJanji = null;
  let indeksSaat = 0;

  /** Penanda yang dipakai RTF Blangko Derry: Map(noVar -> [berkas]). */
  function indeksDerry() {
    if (indeksJanji && Date.now() - indeksSaat < UMUR_INDEKS_MS) return indeksJanji;
    indeksSaat = Date.now();
    indeksJanji = (async () => {
      const akar = path.resolve(akarBlangko, FOLDER_DERRY);
      const peta = new Map();
      const berkas = [];
      async function jelajah(dir, kedalaman) {
        if (kedalaman > 3) return;
        let isi = [];
        try {
          isi = await fs.readdir(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const e of isi) {
          const jalur = path.join(dir, e.name);
          if (e.isDirectory()) await jelajah(jalur, kedalaman + 1);
          else if (/\.rtf$/i.test(e.name)) berkas.push(jalur);
        }
      }
      await jelajah(akar, 0);
      const jumlahBerkas = berkas.length;
      if (!jumlahBerkas) throw galatTolak("Folder Blangko Derry tidak terbaca di server.", "folder_tidak_ada");
      // Dibaca berbarengan (8 sekaligus): satu per satu terukur 8-25 detik
      // untuk 226 berkas di laptop, padahal isinya hanya ±40 MB.
      const hasil = new Array(jumlahBerkas);
      let i = 0;
      await Promise.all(
        Array.from({ length: Math.min(8, jumlahBerkas) }, async () => {
          while (i < jumlahBerkas) {
            const k = i++;
            try {
              const rtf = mesinVar.satukanPenandaTerpecah(await fs.readFile(berkas[k], "latin1")).rtf;
              hasil[k] = [...new Set([...rtf.matchAll(/#(\d{3,5})#/g)].map((m) => m[1]))];
            } catch {
              hasil[k] = [];
            }
          }
        })
      );
      berkas.forEach((jalur, k) => {
        const rel = path.relative(akar, jalur).split(path.sep).join("/");
        for (const no of hasil[k]) {
          const daftar = peta.get(no) || [];
          daftar.push(rel);
          peta.set(no, daftar);
        }
      });
      return { peta, jumlahBerkas };
    })().catch((g) => {
      indeksJanji = null;
      throw g;
    });
    return indeksJanji;
  }

  function noVarSah(no) {
    const n = String(no ?? "").trim();
    if (!/^\d{3,5}$/.test(n)) throw galatTolak("Nomor variabel tidak sah.");
    return n.padStart(4, "0");
  }

  async function pastikanDerry(no) {
    const { peta } = await indeksDerry();
    const daftar = peta.get(no);
    if (!daftar) throw galatTolak(`Variabel #${no}# tidak dipakai Blangko Derry - tidak dapat diubah dari sini.`, "bukan_derry");
    return daftar;
  }

  async function daftarVariabel() {
    const { peta, jumlahBerkas } = await indeksDerry();
    const baris = await kueri(`SELECT no_var, nama, data_type, referensi, multi_sidang, locked, sql_query, default_data FROM ${t("abt_variabel")}`);
    const katalog = new Map(baris.map((b) => [teksDb(b.no_var).padStart(4, "0"), b]));
    const daftar = [...peta.entries()]
      .map(([no, berkas]) => {
        const b = katalog.get(no);
        return {
          noVar: no,
          ada: Boolean(b),
          nama: b ? teksDb(b.nama) : "",
          jenis: b ? teksDb(b.data_type) : "",
          dikunci: b ? Number(b.locked) === 1 : false,
          adaKueri: b ? Boolean(teksDb(b.sql_query).trim()) : false,
          adaBawaan: b ? Boolean(teksDb(b.default_data).trim()) : false,
          jumlahBlangko: berkas.length,
          contohBlangko: berkas.slice(0, 3),
        };
      })
      .sort((a, b) => b.jumlahBlangko - a.jumlahBlangko || a.noVar.localeCompare(b.noVar));
    return { jumlahBerkas, daftar };
  }

  async function bacaVariabel(noVar) {
    const no = noVarSah(noVar);
    const berkas = await pastikanDerry(no);
    const b = (await kueri(`SELECT no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modified FROM ${t("abt_variabel")} WHERE no_var = ?`, [no]))[0];
    if (!b) throw galatTolak(`Variabel #${no}# tidak ada di katalog ABT.`, "tidak_ada");
    return {
      noVar: no,
      nama: teksDb(b.nama),
      jenis: teksDb(b.data_type),
      dataTabel: teksDb(b.data_tabel),
      dataKolom: teksDb(b.data_kolom),
      referensi: teksDb(b.referensi),
      multiSidang: teksDb(b.multi_sidang),
      sql_query: teksDb(b.sql_query),
      default_data: teksDb(b.default_data),
      dikunci: Number(b.locked) === 1,
      diubah: teksDb(b.modified),
      blangko: berkas,
    };
  }

  /** Perkara contoh: nomor perkara -> perkara_id (atau perkara terbaru bila kosong). */
  async function cariPerkara(nomor) {
    const n = String(nomor ?? "").trim();
    const baris = n
      ? await kueri("SELECT perkara_id, nomor_perkara, jenis_perkara_nama FROM perkara WHERE nomor_perkara = ? LIMIT 1", [n])
      : await kueri("SELECT perkara_id, nomor_perkara, jenis_perkara_nama FROM perkara ORDER BY perkara_id DESC LIMIT 1");
    const b = baris[0];
    if (!b) return null;
    return { perkaraId: Number(b.perkara_id), nomor: teksDb(b.nomor_perkara), jenis: teksDb(b.jenis_perkara_nama) };
  }

  /**
   * Menghitung satu variabel atas satu perkara - definisi pengganti (belum
   * disimpan) ikut dihitung lewat timpaKatalog mesin variabel. Tidak menulis.
   */
  async function ujiVariabel(badan = {}) {
    const no = noVarSah(badan.noVar);
    await pastikanDerry(no);
    return ujiInti(no, badan);
  }

  async function ujiInti(no, badan = {}) {
    const perkaraId = Number(badan.perkaraId);
    if (!Number.isInteger(perkaraId) || perkaraId <= 0) throw galatTolak("Pilih perkara contoh dulu.");
    const timpa = {};
    if (badan.sql_query !== undefined) {
      const sebab = periksaKueriVariabel(badan.sql_query, mesinVar.pagarBaca);
      if (sebab) return { ok: false, status: "ditolak", sebab, nilai: "", ms: 0 };
      timpa.sql_query = String(badan.sql_query).trim();
    }
    if (badan.default_data !== undefined) timpa.default_data = String(badan.default_data);
    const mesin = buatMesin({
      kueri: (sql, params, opsi) => kueri(sql, params, { timeoutMs: Math.min((opsi && opsi.timeoutMs) || BATAS_KUERI_UJI_MS, BATAS_KUERI_UJI_MS) }),
      skemaAbt: skema,
      umurKatalogMs: 0,
      batasKueriMs: BATAS_KUERI_UJI_MS,
      timpaKatalog: Object.keys(timpa).length ? { [no]: timpa } : {},
    });
    const mulai = Date.now();
    let penunda;
    const habis = new Promise((_, gagal) => {
      penunda = setTimeout(() => gagal(galatTolak(`Uji melewati batas ${BATAS_UJI_MS / 1000} detik.`, "habis_waktu")), BATAS_UJI_MS);
    });
    try {
      const peta = await Promise.race([mesin.nilaiPenanda({ perkaraId, sidangKe: Number(badan.sidangKe) || 0 }, [no]), habis]);
      const v = peta.get(no) || { status: "galat", sebab: "tidak terhitung", polos: "" };
      return {
        ok: v.status !== "galat" && v.status !== "takada",
        status: v.status,
        sebab: v.sebab || "",
        nilai: String(v.polos || "").slice(0, 4000),
        ms: Date.now() - mulai,
      };
    } catch (g) {
      return { ok: false, status: g.kode === "habis_waktu" ? "habis_waktu" : "galat", sebab: String(g.message || g).slice(0, 300), nilai: "", ms: Date.now() - mulai };
    } finally {
      clearTimeout(penunda);
    }
  }

  /**
   * lama/baru: {sql_query?, default_data?}. Kueri baru WAJIB lolos uji atas
   * perkaraId sebelum ditulis; variabel yang dikunci ABT ditolak (ABT sendiri
   * menampilkan "VARIABEL TIDAK DAPAT DIEDIT" untuknya).
   */
  async function simpanVariabel(badan = {}) {
    const no = noVarSah(badan.noVar);
    await pastikanDerry(no);
    const baru = badan.baru && typeof badan.baru === "object" ? badan.baru : {};
    const lama = badan.lama && typeof badan.lama === "object" ? badan.lama : null;
    const kolom = Object.keys(baru);
    if (!kolom.length) throw galatTolak("Tidak ada yang diubah.");
    for (const k of kolom) {
      if (!KOLOM_VARIABEL_BOLEH.includes(k)) throw galatTolak(`Bagian "${k}" tidak boleh diubah dari sini.`);
      if (!lama || !(k in lama)) throw galatTolak("Nilai lama tidak dikirim - muat ulang halaman.");
    }
    const def = await bacaVariabel(no);
    if (def.dikunci) throw galatTolak("Variabel ini dikunci ABT (bawaan Badilag) dan tidak dapat diubah.", "dikunci");
    const rapi = {};
    // Kembalikan (pulihkan): menulis nilai yang SUDAH pernah berlaku - tidak diuji
    // ulang atas perkara contoh, dan kueri kosong semula boleh dikembalikan kosong.
    const pulihkan = badan.pulihkan === true;
    if ("sql_query" in baru) {
      if (def.jenis !== "data_sql") throw galatTolak("Kueri hanya dapat diubah untuk variabel yang mengambil data dengan kueri.");
      const kosongPulih = pulihkan && !String(baru.sql_query ?? "").trim();
      const sebab = kosongPulih ? "" : periksaKueriVariabel(baru.sql_query, mesinVar.pagarBaca);
      if (sebab) throw galatTolak(sebab, "kueri_ditolak");
      rapi.sql_query = String(baru.sql_query ?? "").trim();
    }
    if ("default_data" in baru) {
      const v = String(baru.default_data ?? "");
      if (v.length > PANJANG_BAWAAN_MAKS) throw galatTolak("Isian bawaan terlalu panjang.");
      const luar = hurufDiluarLatin1(v);
      if (luar.length) throw galatTolak(`Isian bawaan memuat huruf yang tidak dapat disimpan ABT: ${luar.join(" ")}`);
      rapi.default_data = v;
    }
    let uji = null;
    if ("sql_query" in rapi && !pulihkan) {
      uji = await ujiVariabel({ noVar: no, perkaraId: badan.perkaraId, sidangKe: badan.sidangKe, sql_query: rapi.sql_query });
      if (!uji.ok) {
        const g = galatTolak(`Kueri baru gagal diuji: ${uji.sebab || uji.status}. Tidak ada yang disimpan.`, "uji_gagal");
        g.uji = uji;
        throw g;
      }
    }
    const hasil = await tulisVariabel(no, lama, rapi);
    return { ...hasil, uji };
  }

  /** Satu transaksi: kunci baris, prasyarat nilai lama, tulis, baca kembali. */
  async function tulisVariabel(no, lama, rapi) {
    const kosongJadiNull = (v) => (String(v ?? "") === "" ? null : v);
    return d.transaksi(async (q) => {
      const kini = (await q(`SELECT no_var, sql_query, default_data, locked FROM ${t("abt_variabel")} WHERE no_var = ? FOR UPDATE`, [no]))[0];
      if (!kini) throw galatTolak(`Variabel #${no}# tidak ada di katalog ABT.`, "tidak_ada");
      if (Number(kini.locked) === 1) throw galatTolak("Variabel ini dikunci ABT dan tidak dapat diubah.", "dikunci");
      for (const k of Object.keys(rapi)) {
        if (teksDb(kini[k]) !== teksDb(lama[k])) throw galatTolak("Variabel ini sudah diubah orang lain sejak halaman dimuat - muat ulang lalu ulangi.", "berubah");
      }
      const ks = Object.keys(rapi);
      await q(`UPDATE ${t("abt_variabel")} SET ${ks.map((k) => `${k} = ?`).join(", ")} WHERE no_var = ?`, [...ks.map((k) => kosongJadiNull(rapi[k])), no]);
      const baca = (await q(`SELECT sql_query, default_data FROM ${t("abt_variabel")} WHERE no_var = ?`, [no]))[0] || {};
      return {
        sebelum: Object.fromEntries(ks.map((k) => [k, teksDb(kini[k])])),
        sesudah: Object.fromEntries(ks.map((k) => [k, teksDb(baca[k])])),
      };
    });
  }

  // ---- identitas satker (17 Okt 2026) -------------------------------------

  /**
   * Identitas satker menurut SIPP (sys_config) dan ABT (variabel 9270-9276 +
   * #1154#), beserta NILAI yang dihasilkan variabel itu sekarang. Tidak menulis.
   */
  async function bacaSatker() {
    const cfg = await kueri("SELECT name, value FROM sys_config WHERE name IN ('KodePN','NamaPN','NamaPT','AlamatPN','ZonaWaktu')").catch(() => []);
    const sipp = Object.fromEntries(cfg.map((b) => [teksDb(b.name), teksDb(b.value).trim()]));
    const nos = [...NO_VAR_IDENTITAS, NO_VAR_KODE_SURAT];
    const baris = await kueri(
      `SELECT no_var, nama, data_type, sql_query, default_data, locked FROM ${t("abt_variabel")} WHERE no_var IN (${nos.map(() => "?").join(",")})`,
      nos.map(Number)
    );
    const peta = new Map(baris.map((b) => [teksDb(b.no_var).padStart(4, "0"), b]));
    const perkara = await cariPerkara("").catch(() => null);
    let nilai = new Map();
    const ada = nos.filter((n) => peta.has(n) && n !== NO_VAR_KODE_SURAT);
    if (perkara && ada.length) {
      const mesin = buatMesin({
        kueri: (sql, params, opsi) => kueri(sql, params, { timeoutMs: Math.min((opsi && opsi.timeoutMs) || BATAS_KUERI_UJI_MS, BATAS_KUERI_UJI_MS) }),
        skemaAbt: skema,
        umurKatalogMs: 0,
        batasKueriMs: BATAS_KUERI_UJI_MS,
      });
      nilai = await mesin.nilaiPenanda({ perkaraId: perkara.perkaraId, sidangKe: 0 }, ada).catch(() => new Map());
    }
    const variabel = nos.map((no) => {
      const b = peta.get(no);
      const v = nilai.get(no);
      return {
        noVar: no,
        ada: Boolean(b),
        nama: b ? teksDb(b.nama) : "",
        jenis: b ? teksDb(b.data_type) : "",
        sql_query: b ? teksDb(b.sql_query) : "",
        default_data: b ? teksDb(b.default_data) : "",
        dikunci: b ? Number(b.locked) === 1 : false,
        bentukSatker: Boolean(b) && NO_VAR_SATKER.has(no) && KEPALA_CASE_SATKER.test(teksDb(b.sql_query)),
        nilai: v && v.status !== "galat" ? String(v.polos || "").slice(0, 1000) : "",
      };
    });
    return {
      sipp: {
        kodePN: sipp.KodePN || "",
        namaPN: sipp.NamaPN || "",
        namaPT: sipp.NamaPT || "",
        alamatPN: sipp.AlamatPN || "",
        zonaWaktu: sipp.ZonaWaktu || "",
      },
      variabel,
      perkaraContoh: perkara,
    };
  }

  /**
   * Mengubah CABANG satker pada kueri 9271-9274. Portal menyusun kueri baru;
   * di sini dijaga: nomor hanya 9271-9274, kerangka kueri lama = baru (yang
   * berubah hanya cabang WHEN '<KodePN>' THEN '...'), lolos pemeriksa kueri,
   * lolos uji atas perkara terbaru, dan prasyarat nilai lama di transaksi.
   */
  async function simpanKueriSatker(badan = {}) {
    const no = noVarSah(badan.noVar);
    if (!NO_VAR_SATKER.has(no)) throw galatTolak(`Variabel #${no}# bukan isian identitas satker.`, "bukan_satker");
    const lama = badan.lama && typeof badan.lama === "object" ? badan.lama : null;
    const baru = badan.baru && typeof badan.baru === "object" ? badan.baru : null;
    if (!lama || typeof lama.sql_query !== "string" || !baru || typeof baru.sql_query !== "string") {
      throw galatTolak("Kueri lama dan baru wajib dikirim - muat ulang halaman.");
    }
    const kueriBaru = String(baru.sql_query).trim();
    if (!KEPALA_CASE_SATKER.test(kueriBaru)) throw galatTolak("Kueri ini bukan bentuk isian satker (CASE KodePN) - ubah lewat Edit variabel.", "bukan_satker");
    if (kerangkaSatker(lama.sql_query) !== kerangkaSatker(kueriBaru)) {
      throw galatTolak("Kueri baru mengubah lebih dari isian satker - ditolak.", "bukan_satker");
    }
    const sebab = periksaKueriVariabel(kueriBaru, mesinVar.pagarBaca);
    if (sebab) throw galatTolak(sebab, "kueri_ditolak");
    const def = (await kueri(`SELECT data_type, locked FROM ${t("abt_variabel")} WHERE no_var = ?`, [no]))[0];
    if (!def) throw galatTolak(`Variabel #${no}# tidak ada di katalog ABT - pasang paket abt-universal-satker-derry dulu.`, "tidak_ada");
    if (Number(def.locked) === 1) throw galatTolak("Variabel ini dikunci ABT dan tidak dapat diubah.", "dikunci");
    if (teksDb(def.data_type) !== "data_sql") throw galatTolak("Variabel ini bukan variabel berkueri.", "bukan_satker");
    let uji = null;
    if (badan.pulihkan !== true) {
      const perkara = Number(badan.perkaraId) > 0 ? { perkaraId: Number(badan.perkaraId) } : await cariPerkara("");
      if (!perkara) throw galatTolak("Belum ada perkara di SIPP untuk menguji kueri.", "uji_gagal");
      uji = await ujiInti(no, { perkaraId: perkara.perkaraId, sidangKe: 0, sql_query: kueriBaru });
      if (!uji.ok) {
        const g = galatTolak(`Kueri baru gagal diuji: ${uji.sebab || uji.status}. Tidak ada yang disimpan.`, "uji_gagal");
        g.uji = uji;
        throw g;
      }
    }
    const hasil = await tulisVariabel(no, { sql_query: String(lama.sql_query) }, { sql_query: kueriBaru });
    return { ...hasil, uji };
  }

  // ---- logo kop (17 Okt 2026) - HANYA BACA blangko; paket ditulis ke folder runtime ----

  const akarDerry = () => path.resolve(akarBlangko, FOLDER_DERRY);

  async function pindaiLogo() {
    return logoKop().pindai(akarDerry());
  }

  async function gambarLogo(md5) {
    return logoKop().ambilGambar(akarDerry(), md5);
  }

  async function paketLogo(badan = {}) {
    const keluarAkar = d.paketDir || process.env.ALETA_BOT_PAKET_DIR || path.join(__dirname, "..", "runtime-data", "paket-abt");
    const akarServer = `${String(process.env.ALETA_BOT_BLANGKO_HOST_DIR || "/var/www/html/aps_badilag/_blangko_abt").replace(/\/+$/, "")}/${FOLDER_DERRY}`;
    const h = await logoKop().bangunPaket({
      akar: akarDerry(),
      keluarAkar,
      md5: Array.isArray(badan.md5) ? badan.md5 : [],
      logo: { base64: String(badan.logoBase64 || "") },
      akarServer,
      oleh: String(badan.oleh || "").slice(0, 120),
    });
    // Letak di server (host) - folder runtime bot terpasang dari sana.
    const runtimeContainer = "/usr/src/app/runtime-data";
    const runtimeHost = String(process.env.ALETA_BOT_RUNTIME_HOST_DIR || "/var/www/html/aleta-data/aleta-bot-runtime").replace(/\/+$/, "");
    const folderServer = h.folder.startsWith(runtimeContainer) ? runtimeHost + h.folder.slice(runtimeContainer.length) : h.folder;
    return { paket: { ...h, folderServer } };
  }

  // ---- template tanya jawab ------------------------------------------------

  async function daftarTemplat() {
    const [kumpulan, hitung] = await Promise.all([
      kueri(`SELECT id, kode, nama, jenis_perkara_id FROM ${t("abt_tanyajawab_id")} ORDER BY kode, jenis_perkara_id`),
      kueri(`SELECT kode_tanyajawab AS kode, COUNT(*) AS jumlah FROM ${t("abt_tanyajawab_template")} GROUP BY kode_tanyajawab`),
    ]);
    const jumlah = new Map(hitung.map((b) => [teksDb(b.kode), Number(b.jumlah) || 0]));
    const peta = new Map();
    for (const b of kumpulan) {
      const kode = teksDb(b.kode);
      if (!kode) continue;
      const ada = peta.get(kode) || { kode, nama: teksDb(b.nama), jenisPerkaraId: [], jumlah: jumlah.get(kode) || 0 };
      if (b.jenis_perkara_id !== null && b.jenis_perkara_id !== undefined) ada.jenisPerkaraId.push(Number(b.jenis_perkara_id));
      peta.set(kode, ada);
    }
    return { kumpulan: [...peta.values()] };
  }

  function kodeSah(kode) {
    const k = String(kode ?? "");
    if (!k.trim() || k.length > 5 || /[^\x20-\x7e]/.test(k)) throw galatTolak("Kode template tidak sah.");
    return k;
  }

  async function bacaTemplat(kode) {
    const k = kodeSah(kode);
    const id = await kueri(`SELECT kode, nama, jenis_perkara_id FROM ${t("abt_tanyajawab_id")} WHERE kode = ?`, [k]);
    if (!id.length) throw galatTolak("Template tidak ada di ABT.", "tidak_ada");
    const baris = await kueri(`SELECT urutan_pertanyaan, pertanyaan, jawaban FROM ${t("abt_tanyajawab_template")} WHERE kode_tanyajawab = ? ORDER BY urutan_pertanyaan`, [k]);
    return {
      kode: k,
      nama: teksDb(id[0].nama),
      jenisPerkaraId: id.map((b) => Number(b.jenis_perkara_id)).filter((x) => Number.isFinite(x)),
      baris: baris.map((b, i) => ({ no: Number(b.urutan_pertanyaan) || i + 1, tanya: teksDb(b.pertanyaan), jawab: teksDb(b.jawaban) })),
    };
  }

  /** lama/baru: [{tanya, jawab}] - isi seluruh kumpulan diganti dalam satu transaksi. */
  async function simpanTemplat(badan = {}) {
    const k = kodeSah(badan.kode);
    if (!Array.isArray(badan.lama)) throw galatTolak("Isi lama template tidak dikirim - muat ulang halaman.");
    const baru = rapikanBarisTemplat(badan.baru, { bolehKosong: badan.bolehKosong === true });
    const lama = badan.lama.map((b) => ({ tanya: teksDb(b && (b.tanya ?? b.pertanyaan)), jawab: teksDb(b && (b.jawab ?? b.jawaban)) }));
    return d.transaksi(async (q) => {
      const id = await q(`SELECT kode FROM ${t("abt_tanyajawab_id")} WHERE kode = ? FOR UPDATE`, [k]);
      if (!id.length) throw galatTolak("Template tidak ada di ABT.", "tidak_ada");
      const kini = await q(
        `SELECT urutan_pertanyaan, pertanyaan, jawaban, modifier FROM ${t("abt_tanyajawab_template")} WHERE kode_tanyajawab = ? ORDER BY urutan_pertanyaan FOR UPDATE`,
        [k]
      );
      const kiniRapi = kini.map((b) => ({ tanya: teksDb(b.pertanyaan), jawab: teksDb(b.jawaban) }));
      if (!samaBarisTemplat(kiniRapi, lama)) throw galatTolak("Template ini sudah diubah orang lain sejak halaman dimuat - muat ulang lalu ulangi.", "berubah");
      const modifier = kini.length && kini[0].modifier !== undefined ? kini[0].modifier : null;
      await q(`DELETE FROM ${t("abt_tanyajawab_template")} WHERE kode_tanyajawab = ?`, [k]);
      for (const b of baru) {
        await q(
          `INSERT INTO ${t("abt_tanyajawab_template")} (kode_tanyajawab, urutan_pertanyaan, pertanyaan, jawaban, modifier) VALUES (?, ?, ?, ?, ?)`,
          [k, b.no, b.tanya, b.jawab, modifier === undefined ? null : modifier]
        );
      }
      const baca = await q(`SELECT urutan_pertanyaan, pertanyaan, jawaban FROM ${t("abt_tanyajawab_template")} WHERE kode_tanyajawab = ? ORDER BY urutan_pertanyaan`, [k]);
      const sesudah = baca.map((b) => ({ tanya: teksDb(b.pertanyaan), jawab: teksDb(b.jawaban) }));
      if (!samaBarisTemplat(sesudah, baru)) throw galatTolak("Isi yang terbaca kembali tidak sama dengan yang ditulis - dibatalkan.", "periksa_gagal");
      return { sebelum: kiniRapi, sesudah };
    });
  }

  return {
    bacaMenu,
    simpanMenu,
    daftarVariabel,
    bacaVariabel,
    cariPerkara,
    ujiVariabel,
    simpanVariabel,
    daftarTemplat,
    bacaTemplat,
    simpanTemplat,
    bacaSatker,
    simpanKueriSatker,
    pindaiLogo,
    gambarLogo,
    paketLogo,
    _lupakanIndeks: () => {
      indeksJanji = null;
    },
  };
}

let bawaan = null;
/** Layanan dengan sambungan sungguhan (baca: kolam SIPP baca-saja; tulis: transaksiSipp). */
function layanan() {
  if (!bawaan) {
    const externalDbService = require("./externalDbService");
    const { denganTransaksi } = require("./transaksiSipp");
    bawaan = buatLayanan({
      kueri: (sql, params, opsi) =>
        externalDbService.query(
          "sipp_primary",
          // Nilai kolom sebagai TEKS - seperti mysqli PHP yang dipakai ABT dan
          // mesin variabel (DECIMAL "229000.00" tetap teks, DATE tidak jadi obyek).
          { sql, timeout: (opsi && opsi.timeoutMs) || 15000, typeCast: (field) => field.string() },
          params || []
        ),
      transaksi: (kerja) => denganTransaksi(kerja),
    });
  }
  return bawaan;
}

module.exports = {
  buatLayanan,
  layanan,
  periksaKueriVariabel,
  hurufDiluarLatin1,
  rapikanMenuBaru,
  rapikanBarisTemplat,
  FOLDER_DERRY,
  VARIABEL_SATKER,
  NO_VAR_KODE_SURAT,
  kerangkaSatker,
  KOLOM_MENU,
  CONFIG_BOLEH,
};
