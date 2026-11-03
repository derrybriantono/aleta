"use strict";

/**
 * ============================================================================
 * PUSTAKA ALETA ABT - PEMBACA ABT (3 Nov 2026, Tahap 1) - HANYA MEMBACA
 * ============================================================================
 *
 * Bahan sinkron SATU ARAH ABT -> database ALETA (portal, migrasi 0133). Bot tidak menulis apa pun ke ABT/SIPP dan tidak
 * menyimpan apa pun sendiri; portal yang membandingkan dan menyimpan (src/server/modules/aleta-abt-pustaka).
 *
 *   potret()       daftar SEMUA berkas di folder blangko Derry (jalur relatif, folder, nama, arsip?, md5, ukuran,
 *                  waktu, penanda #NNNN#), definisi variabel yang dipakai (langsung di RTF + turunan: rujukan #NNNN# di
 *                  kueri/isian bawaan, kolom referensi, 0046/0047 untuk dihadiri_oleh), baris abt_menu Derry,
 *                  abt_menu_grup Derry, dan identitas server (KodePN SIPP). TANPA isi berkas.
 *   isi(jalur[])   isi berkas (base64) untuk jalur yang diminta, paling banyak BATAS_ISI_BYTE sekali panggil.
 *
 * Penanda dibaca seperti indeks Blangko Derry (abtPengaturanService.indeksDerry): penanda yang terpecah kode RTF
 * disatukan dulu (satukanPenandaTerpecah), lalu #(\d{3,5})#, nomor dibakukan 4 angka.
 */

const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const FOLDER_DERRY = "derry_briantono";
const BATAS_ISI_BYTE = 16 * 1024 * 1024;
const BATAS_JALUR = 400;
const KEDALAMAN_MAKS = 6;

const teks = (v) => (v === null || v === undefined ? null : String(v));
const nomorBaku = (no) => String(no ?? "").trim().replace(/^0+(?=\d{4})/, "").padStart(4, "0");

/** Folder arsip (bukan pilihan petugas) - aturan yang sama dengan katalogBlangkoDerry. */
function folderArsip(rel) {
  const atas = String(rel || "").split("/")[0] || "";
  return /terhapus/i.test(rel) || /^ALUR/.test(atas) || /^- BAS .* -$/.test(atas);
}

/** Nomor variabel yang dirujuk satu definisi (kueri, isian bawaan, referensi, dihadiri_oleh). */
function rujukanVariabel(def) {
  const hasil = new Set();
  for (const m of `${def.sql_query || ""}\n${def.default_data || ""}`.matchAll(/#(\d{3,5})#/g)) hasil.add(nomorBaku(m[1]));
  if (def.referensi !== null && def.referensi !== undefined && Number(def.referensi) > 0) hasil.add(nomorBaku(def.referensi));
  if (String(def.multi_sidang || "") === "dihadiri_oleh") {
    hasil.add("0046");
    hasil.add("0047");
  }
  return [...hasil];
}

/** Jalur relatif yang aman (tanpa .., tanpa jalur mutlak) di dalam akar. */
function jalurAman(akar, rel) {
  const r = String(rel || "");
  if (!r || r.length > 600 || r.includes("\0") || r.startsWith("/") || /(^|[\\/])\.\.([\\/]|$)/.test(r)) return null;
  const penuh = path.resolve(akar, r);
  const akarPenuh = path.resolve(akar);
  if (penuh !== akarPenuh && !penuh.startsWith(akarPenuh + path.sep)) return null;
  return penuh;
}

function buatPustaka(d = {}) {
  const skema = String(d.skemaAbt || process.env.ALETA_ABT_SKEMA || "aps_badilag").trim();
  if (!/^[A-Za-z0-9_]+$/.test(skema)) throw new Error("nama skema ABT tidak sah");
  const akarBlangko = d.akarBlangko || process.env.ALETA_BOT_BLANGKO_DIR || "/usr/src/app/blangko_abt";
  const akar = path.resolve(akarBlangko, FOLDER_DERRY);
  const satukan = d.satukanPenandaTerpecah || require("./abtMesinVariabel").satukanPenandaTerpecah;
  const kueri = (sql, params = []) => d.kueri(sql, params);
  const t = (nama) => `${skema}.${nama}`;

  async function daftarBerkas() {
    const hasil = [];
    async function jelajah(dir, kedalaman) {
      if (kedalaman > KEDALAMAN_MAKS) return;
      let isi = [];
      try {
        isi = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of isi) {
        const jalur = path.join(dir, e.name);
        if (e.isDirectory()) await jelajah(jalur, kedalaman + 1);
        else if (e.isFile()) hasil.push(jalur);
      }
    }
    await jelajah(akar, 0);
    return hasil.sort();
  }

  async function bacaServer() {
    const baris = await kueri("SELECT value FROM sys_config WHERE name = 'KodePN' LIMIT 1").catch(() => []);
    const kode = String((baris[0] && baris[0].value) || "").trim();
    return String(process.env.ALETA_ABT_SERVER_ID || kode || "setempat").slice(0, 60);
  }

  async function potret() {
    const mulai = Date.now();
    const jalurPenuh = await daftarBerkas();
    if (!jalurPenuh.length) {
      const g = new Error("Folder Blangko Derry tidak terbaca di server.");
      g.ditolak = true;
      g.kode = "folder_tidak_ada";
      throw g;
    }
    const berkas = [];
    const langsung = new Map();
    for (const j of jalurPenuh) {
      const rel = path.relative(akar, j).split(path.sep).join("/");
      let isi;
      let info;
      try {
        [isi, info] = await Promise.all([fs.readFile(j), fs.stat(j)]);
      } catch {
        continue;
      }
      const penanda = [];
      if (/\.rtf$/i.test(rel)) {
        const rtf = satukan(isi.toString("latin1")).rtf;
        for (const m of rtf.matchAll(/#(\d{3,5})#/g)) {
          const no = nomorBaku(m[1]);
          if (!penanda.includes(no)) penanda.push(no);
        }
      }
      for (const no of penanda) langsung.set(no, (langsung.get(no) || 0) + 1);
      const bagian = rel.split("/");
      berkas.push({
        jalur: rel,
        folder: bagian.length > 1 ? bagian[0] : "",
        nama: bagian[bagian.length - 1],
        arsip: folderArsip(rel),
        md5: crypto.createHash("md5").update(isi).digest("hex"),
        ukuran: isi.length,
        waktu: info.mtime.toISOString(),
        penanda,
      });
    }
    const [katalog, menu, grup, server] = await Promise.all([
      kueri(
        `SELECT no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier, modified FROM ${t("abt_variabel")}`
      ),
      kueri(`SELECT * FROM ${t("abt_menu")} WHERE parent_direktori = ? ORDER BY id`, [FOLDER_DERRY]),
      kueri(`SELECT id, nama, direktori FROM ${t("abt_menu_grup")} WHERE direktori = ?`, [FOLDER_DERRY]).catch(() => []),
      bacaServer(),
    ]);
    const kat = new Map(katalog.map((b) => [nomorBaku(b.no_var), b]));
    const sumber = new Map([...langsung.keys()].map((k) => [k, "blangko"]));
    const antre = [...sumber.keys()];
    while (antre.length) {
      const def = kat.get(antre.pop());
      if (!def) continue;
      for (const r of rujukanVariabel(def)) {
        if (sumber.has(r)) continue;
        sumber.set(r, "turunan");
        antre.push(r);
      }
    }
    const variabel = [];
    const takDikenal = [];
    for (const [no, asal] of [...sumber.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))) {
      const def = kat.get(no);
      if (!def) {
        takDikenal.push(no);
        continue;
      }
      variabel.push({
        no,
        nama: teks(def.nama) || "",
        data_type: teks(def.data_type),
        data_tabel: teks(def.data_tabel),
        data_kolom: teks(def.data_kolom),
        urutan_data: teks(def.urutan_data),
        referensi: def.referensi === null || def.referensi === undefined ? null : nomorBaku(def.referensi),
        sql_query: teks(def.sql_query),
        default_data: teks(def.default_data),
        multi_sidang: teks(def.multi_sidang),
        locked: Number(def.locked) === 1 ? 1 : 0,
        modifier: teks(def.modifier) || "",
        modified: teks(def.modified) || "",
        sumber: asal,
        jumlahBlangko: langsung.get(no) || 0,
        rujukan: rujukanVariabel(def),
      });
    }
    return {
      server,
      skema,
      waktu: new Date().toISOString(),
      lamaMs: Date.now() - mulai,
      grup: grup[0] ? { id: String(grup[0].id), nama: teks(grup[0].nama) || "", direktori: teks(grup[0].direktori) || "" } : null,
      berkas,
      variabel,
      takDikenal,
      menu: menu.map((b) => ({
        id: String(b.id),
        nama: teks(b.nama),
        nama_alias: teks(b.nama_alias),
        direktori: teks(b.direktori) || "",
        parent_direktori: teks(b.parent_direktori),
        user_grup_id: teks(b.user_grup_id),
        user_top_id: teks(b.user_top_id),
        user_validator: teks(b.user_validator),
        user_cek: teks(b.user_cek),
        proses_id_min: teks(b.proses_id_min),
        proses_id_max: teks(b.proses_id_max),
        perkara_id_min: teks(b.perkara_id_min),
        perkara_id_max: teks(b.perkara_id_max),
        perkara_id_referensi: teks(b.perkara_id_referensi),
        modified: teks(b.modified) || "",
      })),
    };
  }

  /** Isi berkas yang diminta (base64), berhenti sebelum melewati BATAS_ISI_BYTE; sisanya disebut `lewat`. */
  async function isi(daftar) {
    const jalur = (Array.isArray(daftar) ? daftar : []).slice(0, BATAS_JALUR).map(String);
    const berkas = [];
    const ditolak = [];
    const lewat = [];
    let total = 0;
    for (const rel of jalur) {
      const penuh = jalurAman(akar, rel);
      if (!penuh) {
        ditolak.push(rel);
        continue;
      }
      let bita;
      try {
        bita = await fs.readFile(penuh);
      } catch {
        ditolak.push(rel);
        continue;
      }
      if (berkas.length && total + bita.length > BATAS_ISI_BYTE) {
        lewat.push(rel);
        continue;
      }
      total += bita.length;
      berkas.push({ jalur: rel, md5: crypto.createHash("md5").update(bita).digest("hex"), ukuran: bita.length, isi: bita.toString("base64") });
    }
    return { berkas, ditolak, lewat };
  }

  return { potret, isi };
}

let bawaan = null;
/** Sambungan sungguhan: kolam SIPP baca-saja (aps_badilag di server MariaDB yang sama), sebagai pekerjaan latar. */
function layanan() {
  if (!bawaan) {
    const externalDbService = require("./externalDbService");
    const kolam = require("./kolamSippService");
    bawaan = buatPustaka({
      kueri: (sql, params) =>
        kolam.latar(() => externalDbService.query("sipp_primary", { sql, timeout: 60000, typeCast: (field) => field.string() }, params || [])),
    });
  }
  return bawaan;
}

module.exports = { buatPustaka, layanan, rujukanVariabel, folderArsip, jalurAman, nomorBaku, BATAS_ISI_BYTE, FOLDER_DERRY };
