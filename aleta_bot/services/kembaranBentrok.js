"use strict";

/**
 * ============================================================================
 * PEMERIKSA BENTROK - sebelum satu baris antrean dikirim ke server
 * ============================================================================
 *
 * Prinsip: baris antrean hanya BOLEH dikirim bila server masih dalam keadaan
 * yang sama dengan yang dilihat laptop saat tulisan itu terjadi (cuplikan).
 * Server berubah sejak itu = BENTROK = tidak dikirim, tanpa pengecualian dan
 * tanpa tombol "paksa".
 *
 *   UPDATE/DELETE   SELECT pencuplik yang SAMA dijalankan lagi di server. Himpunan
 *                   baris harus sama, dan kolom yang akan diubah (UPDATE) atau
 *                   seluruh kolom (DELETE) harus sama dengan cuplikan.
 *   INSERT          kunci unik (PRIMARY/UNIQUE) baris baru tidak boleh sudah ada
 *                   di server. Tabel tanpa kunci unik selain nomor urut: lolos
 *                   dengan catatan "tanpa pemeriksa duplikat".
 *   REPLACE / ON DUPLICATE KEY
 *                   baris berkunci sama di server harus persis seperti cuplikan.
 *
 * Aturan terpisah dan lebih keras - TANGGAL SUBSTANTIF (sidang, putusan,
 * penetapan, minutasi): tanggal yang SUDAH terisi di server tidak pernah
 * diubah, dengan hasil "ditahan" (bukan sekadar bentrok). Mengisinya untuk
 * pertama kali (kosong / 0000-00-00 di server) diperbolehkan.
 *
 * Modul ini tidak menyentuh basis data sendiri: pembacaan server disuntikkan
 * (ctx.bacaServer), supaya dapat diuji tanpa server dan - lebih penting -
 * supaya TIDAK ADA jalur tulis di sini.
 */

const mysql = require("mysql");
const Q = require("./kembaranSql");

const SUBSTANTIF = /^(tanggal|tgl)_(sidang|putusan|penetapan|minutasi)(_|$)/i;

function kolomSubstantif(kolom) {
  return SUBSTANTIF.test(String(kolom || ""));
}

// ---------------------------------------------------------------------------
// Nilai dan baris
// ---------------------------------------------------------------------------

function pad(n) {
  return String(n).padStart(2, "0");
}

/** Nilai driver -> nilai JSON yang stabil dibandingkan (Date jadi teks lokal, Buffer jadi heksa). */
function serialNilai(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return "0000-00-00";
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())} ${pad(v.getHours())}:${pad(v.getMinutes())}:${pad(v.getSeconds())}`;
  }
  if (Buffer.isBuffer(v)) return `0x${v.toString("hex")}`;
  if (typeof v === "bigint") return v.toString();
  return v;
}

function serialBaris(baris) {
  const hasil = {};
  for (const [k, v] of Object.entries(baris || {})) hasil[k] = serialNilai(v);
  return hasil;
}

function kosong(v) {
  return v === null || v === undefined || v === "" || /^0000-00-00/.test(String(v));
}

const POLA_ANGKA = /^[-+]?\d+(\.\d+)?$/;

function sama(a, b) {
  if (kosong(a) && kosong(b)) return true;
  if (a === null || a === undefined || b === null || b === undefined) return false;
  const x = String(a);
  const y = String(b);
  if (x === y) return true;
  if (POLA_ANGKA.test(x) && POLA_ANGKA.test(y)) return Number(x) === Number(y);
  return false;
}

function bagianTanggal(v) {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v == null ? "" : v));
  return m ? m[1] : String(v == null ? "" : v);
}

function kunciBaris(baris, kolomKunci) {
  return JSON.stringify(kolomKunci.map((k) => (baris[k] === null || baris[k] === undefined ? null : String(baris[k]))));
}

function ringkasNilai(v) {
  if (v === null || v === undefined) return "NULL";
  const t = String(v);
  return t.length > 60 ? `${t.slice(0, 57)}...` : t;
}

// ---------------------------------------------------------------------------
// Kunci tabel
// ---------------------------------------------------------------------------

/**
 * Kunci PRIMARY dan UNIQUE sebuah tabel. `bacaFn(sql)` -> Promise<baris[]>.
 * Dibaca dari information_schema; gagal baca = tanpa kunci (bukan galat).
 */
async function kunciTabel(bacaFn, skema, tabel) {
  const sql = mysql.format(
    "SELECT INDEX_NAME AS nama, NON_UNIQUE AS bukan_unik, SEQ_IN_INDEX AS urut, COLUMN_NAME AS kolom " +
      "FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = IFNULL(NULLIF(?, ''), DATABASE()) AND TABLE_NAME = ? " +
      "ORDER BY INDEX_NAME, SEQ_IN_INDEX",
    [skema || "", tabel]
  );
  let baris = [];
  try {
    baris = await bacaFn(sql);
  } catch {
    return { utama: [], unik: [], terbaca: false };
  }
  const peta = new Map();
  for (const r of baris) {
    const nama = r.nama ?? r.INDEX_NAME;
    const bukanUnik = Number(r.bukan_unik ?? r.NON_UNIQUE);
    const kolom = r.kolom ?? r.COLUMN_NAME;
    if (bukanUnik !== 0) continue;
    if (!peta.has(nama)) peta.set(nama, []);
    peta.get(nama).push(kolom);
  }
  const utama = peta.get("PRIMARY") || [];
  const unik = [...peta].filter(([n]) => n !== "PRIMARY").map(([, k]) => k);
  return { utama, unik, terbaca: true };
}

/**
 * SELECT yang mencari baris berkunci sama dengan baris-baris INSERT/REPLACE.
 * null bila tak satu kunci pun dapat dirakit dari nilai literal.
 */
function susunSelectKunci(u, kunci) {
  if (!u || !u.terbaca || !u.kolom || !u.baris) return null;
  const semuaKunci = [kunci.utama, ...kunci.unik].filter((k) => k && k.length);
  const kondisi = [];
  for (const baris of u.baris) {
    for (const k of semuaKunci) {
      const bagian = [];
      for (const kolom of k) {
        const idx = u.kolom.findIndex((c) => c.toLowerCase() === String(kolom).toLowerCase());
        const nilai = idx >= 0 ? baris[idx] : null;
        if (!nilai || (nilai.tipe !== "teks" && nilai.tipe !== "angka")) {
          bagian.length = 0;
          break;
        }
        bagian.push(`\`${String(kolom).replace(/`/g, "``")}\` = ${mysql.escape(nilai.nilai)}`);
      }
      if (bagian.length) kondisi.push(`(${bagian.join(" AND ")})`);
    }
  }
  if (!kondisi.length) return null;
  const unikKondisi = [...new Set(kondisi)].slice(0, 200);
  const tabel = u.skema ? `\`${u.skema}\`.\`${u.tabel}\`` : `\`${u.tabel}\``;
  return `SELECT * FROM ${tabel} WHERE ${unikKondisi.join(" OR ")} LIMIT ${Q.BATAS_CUPLIKAN + 1}`;
}

// ---------------------------------------------------------------------------
// Pemeriksaan satu baris
// ---------------------------------------------------------------------------

function hasil(status, alasan = [], catatan = []) {
  return { hasil: status, alasan, catatan };
}

/** Pasangan {kolom, tipe, nilai} dari UPDATE/INSERT yang sudah diurai (disimpan di baris.uraian). */
function nilaiBaruKolom(uraian, kolom) {
  if (!uraian) return null;
  if (uraian.assignments) {
    const a = uraian.assignments.find((x) => x.kolom.toLowerCase() === kolom.toLowerCase());
    return a ? a.nilai : null;
  }
  return null;
}

/** Tanggal substantif: alasan penahanan (daftar) untuk baris server yang akan diubah. */
function periksaTanggalSubstantif({ uraian, barisServer }) {
  const alasan = [];
  const kolomTanggal = [];
  if (uraian.jenis === "UPDATE") {
    for (const a of uraian.assignments || []) if (kolomSubstantif(a.kolom)) kolomTanggal.push({ kolom: a.kolom, baru: a.nilai });
  } else if (uraian.kolom && uraian.baris && uraian.baris.length === 1) {
    uraian.kolom.forEach((kol, i) => {
      if (kolomSubstantif(kol)) kolomTanggal.push({ kolom: kol, baru: uraian.baris[0][i] });
    });
  } else if (uraian.kolom) {
    for (const kol of uraian.kolom) if (kolomSubstantif(kol)) kolomTanggal.push({ kolom: kol, baru: { tipe: "kompleks" } });
  }
  for (const { kolom, baru } of kolomTanggal) {
    for (const row of barisServer) {
      const kunciKolom = Object.keys(row).find((k) => k.toLowerCase() === kolom.toLowerCase());
      if (!kunciKolom) continue;
      const sekarang = row[kunciKolom];
      if (kosong(sekarang)) continue; // belum terisi di server: pengisian pertama boleh
      const nilaiBaru = baru && (baru.tipe === "teks" || baru.tipe === "angka") ? baru.nilai : null;
      if (nilaiBaru === null || bagianTanggal(nilaiBaru) !== bagianTanggal(sekarang)) {
        alasan.push(
          `Tanggal substantif "${kolom}" sudah terisi di server (${bagianTanggal(sekarang)}) dan tidak boleh diubah` +
            (nilaiBaru === null ? " (nilai baru tidak dapat dipastikan)." : ` menjadi ${bagianTanggal(nilaiBaru)}.`)
        );
      }
    }
  }
  return [...new Set(alasan)];
}

/**
 * ctx:
 *   bacaServer(sumber, sql) -> Promise<baris[]>   SELECT di server (dilarang menulis)
 *   kunciServer(sumber, skema, tabel) -> Promise<{utama, unik, terbaca}>
 *   mengandungAleta(teks) -> boolean              (opsional) jaring kata "Aleta"
 *   skemaSah(sumber, skema) -> boolean            (opsional)
 *   periksaBerkas(baris) -> Promise<{hasil, alasan, catatan}>   (opsional) baris berkas
 */
async function periksaBaris(b, ctx) {
  if (b.jenis === "BERKAS_TULIS" || b.jenis === "BERKAS_PINDAH") {
    if (!ctx.periksaBerkas) return hasil("tak_dapat_diperiksa", ["Pemeriksa berkas di server belum disiapkan."]);
    return ctx.periksaBerkas(b);
  }
  if (b.jenis === "DDL" || b.jenis === "LAIN") {
    return hasil("ditahan", ["Perubahan struktur / pernyataan khusus tidak pernah dikirim otomatis. Kerjakan manual di server bila memang perlu."]);
  }
  const u = b.uraian;
  if (!u || !u.terbaca) {
    return hasil("tak_dapat_diperiksa", [`Bentuk pernyataan tidak terbaca otomatis (${(u && u.sebab) || "tidak diketahui"}). Tidak dikirim.`]);
  }
  if (ctx.mengandungAleta && ctx.mengandungAleta(b.sql)) {
    return hasil("ditahan", ["Pernyataan memuat kata 'ALETA'. Tidak satu kata pun boleh masuk ke SIPP; periksa isinya."]);
  }
  if (u.skema && ctx.skemaSah && !ctx.skemaSah(b.sumber, u.skema)) {
    return hasil("ditahan", [`Tabel berawalan basis data "${u.skema}" yang tidak dikenal di server.`]);
  }

  const catatan = [];
  const c = b.cuplikan || {};

  if (u.jenis === "UPDATE" || u.jenis === "DELETE") {
    if (c.status !== "lengkap" || !c.selectSql) {
      return hasil("tak_dapat_diperiksa", [
        c.status === "terpotong"
          ? "Pernyataan menyentuh lebih dari 500 baris; cuplikan tidak lengkap. Tidak dikirim otomatis."
          : `Nilai lama tidak berhasil dicuplik saat tulisan terjadi (${c.sebab || c.status || "tidak ada"}). Tidak dikirim.`,
      ]);
    }
    let barisServer;
    try {
      barisServer = (await ctx.bacaServer(b.sumber, c.selectSql)).map(serialBaris);
    } catch (g) {
      return hasil("tak_dapat_diperiksa", [`Server tidak dapat dibaca: ${String((g && g.message) || g).slice(0, 160)}`]);
    }
    if (barisServer.length > Q.BATAS_CUPLIKAN) {
      return hasil("bentrok", ["Di server kini lebih dari 500 baris cocok dengan kondisi yang sama."]);
    }
    const kunci = await ctx.kunciServer(b.sumber, u.skema, u.tabel).catch(() => ({ utama: [], unik: [], terbaca: false }));
    const pk = kunci.utama && kunci.utama.length ? kunci.utama : null;
    const lama = c.baris || [];
    const alasan = [];

    if (lama.length !== barisServer.length) {
      alasan.push(`Jumlah baris terdampak berbeda: ${lama.length} di cuplikan, ${barisServer.length} di server sekarang.`);
    }

    // Pasangkan baris cuplikan dengan baris server.
    const pasangan = [];
    if (pk && lama.every((r) => pk.every((k) => k in r))) {
      const peta = new Map(barisServer.map((r) => [kunciBaris(r, pk), r]));
      for (const r of lama) {
        const s = peta.get(kunciBaris(r, pk));
        if (!s) alasan.push(`Baris ${pk.map((k) => `${k}=${r[k]}`).join(", ")} sudah tidak ada / tidak cocok lagi di server.`);
        else pasangan.push([r, s]);
      }
    } else if (!pk) {
      // Tanpa kunci utama: himpunan baris UTUH harus sama.
      const kanon = (r) => JSON.stringify(Object.keys(r).sort().map((k) => [k, r[k] === null ? null : String(r[k])]));
      const hitung = new Map();
      for (const r of lama) hitung.set(kanon(r), (hitung.get(kanon(r)) || 0) + 1);
      for (const r of barisServer) hitung.set(kanon(r), (hitung.get(kanon(r)) || 0) - 1);
      if ([...hitung.values()].some((n) => n !== 0)) alasan.push("Isi baris di server berbeda dari cuplikan (tabel tanpa kunci utama; seluruh kolom dibandingkan).");
      for (const r of lama) pasangan.push([r, barisServer.find((s) => kanon(s) === kanon(r)) || r]);
      catatan.push("Tabel tanpa kunci utama: pencocokan memakai seluruh isi baris.");
    }

    for (const [r, s] of pasangan) {
      const periksaKolom = u.jenis === "DELETE" ? Object.keys(r) : u.kolomUbah.map((k) => Object.keys(r).find((x) => x.toLowerCase() === k.toLowerCase()) || k);
      for (const k of periksaKolom) {
        if (sama(r[k], s[k])) continue;
        const baru = u.jenis === "UPDATE" ? nilaiBaruKolom(u, k) : null;
        if (baru && (baru.tipe === "teks" || baru.tipe === "angka" || baru.tipe === "null") && sama(baru.nilai, s[k])) {
          catatan.push(`Kolom "${k}" sudah bernilai sama di server (${ringkasNilai(s[k])}).`);
          continue;
        }
        alasan.push(`Kolom "${k}" berubah di server: cuplikan ${ringkasNilai(r[k])}, server kini ${ringkasNilai(s[k])}.`);
      }
      if (u.jenis === "UPDATE") {
        const lain = Object.keys(r).filter((k) => !periksaKolom.includes(k) && !sama(r[k], s[k]));
        if (lain.length) catatan.push(`Kolom lain yang berubah di server (tidak disentuh): ${lain.slice(0, 5).join(", ")}.`);
      }
    }

    // Tanggal substantif: ditahan, lebih keras daripada bentrok.
    const tahanTanggal = u.jenis === "UPDATE" ? periksaTanggalSubstantif({ uraian: u, barisServer }) : [];
    if (tahanTanggal.length) return hasil("ditahan", tahanTanggal, catatan);
    if (alasan.length) return hasil("bentrok", alasan, catatan);
    return hasil("aman", [], catatan);
  }

  if (u.jenis === "INSERT" || u.jenis === "REPLACE") {
    const upsert = u.jenis === "REPLACE" || u.onDuplicate;
    if (!c.selectSql) {
      if (upsert) return hasil("tak_dapat_diperiksa", ["Pernyataan REPLACE / ON DUPLICATE KEY tanpa kunci unik yang dapat dirakit. Tidak dikirim."]);
      return hasil("aman", [], ["Tanpa pemeriksa duplikat: tabel ini tidak punya kunci unik selain nomor urut otomatis."]);
    }
    let barisServer;
    try {
      barisServer = (await ctx.bacaServer(b.sumber, c.selectSql)).map(serialBaris);
    } catch (g) {
      return hasil("tak_dapat_diperiksa", [`Server tidak dapat dibaca: ${String((g && g.message) || g).slice(0, 160)}`]);
    }
    if (!upsert) {
      if (barisServer.length) return hasil("bentrok", [`Di server sudah ada ${barisServer.length} baris dengan kunci yang sama (kunci unik).`]);
      return hasil("aman", [], catatan);
    }
    // Upsert: baris berkunci sama di server harus persis seperti cuplikan lokal.
    const lama = c.baris || [];
    const kanon = (r) => JSON.stringify(Object.keys(r).sort().map((k) => [k, r[k] === null ? null : String(r[k])]));
    const hitung = new Map();
    for (const r of lama) hitung.set(kanon(r), (hitung.get(kanon(r)) || 0) + 1);
    for (const r of barisServer) hitung.set(kanon(r), (hitung.get(kanon(r)) || 0) - 1);
    if ([...hitung.values()].some((n) => n !== 0)) {
      return hasil("bentrok", ["Baris berkunci sama di server berbeda dari yang dilihat laptop saat tulisan terjadi."], catatan);
    }
    const tahanTanggal = periksaTanggalSubstantif({ uraian: u, barisServer });
    if (tahanTanggal.length) return hasil("ditahan", tahanTanggal, catatan);
    return hasil("aman", [], catatan);
  }

  return hasil("tak_dapat_diperiksa", ["Jenis pernyataan tidak dikenal."]);
}

module.exports = {
  SUBSTANTIF,
  kolomSubstantif,
  serialNilai,
  serialBaris,
  sama,
  kosong,
  bagianTanggal,
  kunciTabel,
  susunSelectKunci,
  periksaTanggalSubstantif,
  periksaBaris,
};
