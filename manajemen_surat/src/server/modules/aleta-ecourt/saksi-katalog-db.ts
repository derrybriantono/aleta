import { createHash, randomUUID } from "node:crypto";

import { FITUR_KATALOG_SAKSI_DB } from "@/lib/fitur-satker";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { fiturMenyala } from "@/server/modules/satker/fitur";
import { bacaSetelanSistem, tulisSetelanSistem } from "@/server/modules/satker/setelan";
import { appendAuditLog } from "@/server/shared/audit";
import { EKSTENSI_BERKAS } from "@/server/shared/ekstensi-berkas";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * ============================================================================
 * KATALOG SAKSI DI BASIS DATA DENGAN VERSI (25 Okt 2026, rantai C butir C4 = U8)
 * ============================================================================
 *
 * Katalog Susun saksi tertanam di ekstensi (saksi-katalog-jenis/<kunci>.json), jadi perbaikan satu kalimat
 * menunggu rilis ekstensi. Modul ini menyimpan PENIMPA berversi (aleta_saksi_katalog + _versi, migrasi 0093)
 * dan menyajikannya ke ekstensi:
 *
 *   - bawaan   = JSON tertanam (EKSTENSI_BERKAS). Selalu ada; menjadi CADANGAN bila portal tak terjangkau.
 *   - penimpa  = versi di basis data yang AKTIF (versi_aktif > 0). Menimpa bawaan menurut kunci; kunci baru
 *                (tanpa bawaan) ikut disajikan.
 *
 * SAKLAR: butir Fitur Satker "katalog-saksi-basis-data", bawaan MATI. Mati = portal tidak menyajikan penimpa
 * (aktif:false) dan ekstensi memakai JSON tertanamnya seperti sebelumnya. Menyimpan versi tetap boleh.
 *
 * HAK MENYUNTING: Super Admin, ditambah akun yang didaftarkan di setelan sistem
 * "sistem:penyunting-katalog-saksi" (mis. akun Derry). Membaca untuk ekstensi: kemampuan "blangko-abt" (dijaga rute).
 *
 * VERSI tidak pernah dihapus atau diubah. Yang berganti hanya versi_aktif (aktifkan versi / kembali ke bawaan).
 * Setiap simpan harus lolos periksaKatalog (mesin ekstensi yang sama, dijalankan di server) dan tidak memuat kata
 * "Aleta" (tidak satu kata pun masuk ke ABT lewat jawaban katalog).
 */

export const KUNCI_PENYUNTING_KATALOG = "sistem:penyunting-katalog-saksi";
export const BATAS_BYTE_KATALOG = 3_000_000;
const POLA_KUNCI = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const AWALAN_BAWAAN = "saksi-katalog-jenis/";

export type Katalog = Record<string, unknown> & { kunci: string; judul?: string; versi?: number };

export type ButirIndeks = {
  kunci: string;
  judul: string;
  versi: number;
  syarat: Record<string, unknown>;
  tambahanUntuk: string[];
  kodeVariabel: string[];
  berkas: string;
  ukuran: number;
  contoh?: boolean;
  jenisKatalog?: string;
  /** Hanya pada indeks yang disajikan portal (saklar menyala): asal isi dan versi penimpanya. */
  sumber?: "bawaan" | "basis-data";
  versiDb?: number;
  sidik?: string;
};

const teks = (x: unknown) => String(x ?? "").trim();
const isiBawaanTeks = (kunci: string): string | null => {
  const t = (EKSTENSI_BERKAS as Record<string, unknown>)[`${AWALAN_BAWAAN}${kunci}.json`];
  return typeof t === "string" ? t : null;
};

/** Urutan indeks tertanam = urutan nama berkas ("x-tergugat.json" mendahului "x.json"); urutan sama menjaga hasil kenaliKatalog. */
const urutBerkas = (a: string, b: string) => (`${a}.json` < `${b}.json` ? -1 : `${a}.json` > `${b}.json` ? 1 : 0);

export function kunciBawaan(): string[] {
  return Object.keys(EKSTENSI_BERKAS as Record<string, unknown>)
    .filter((n) => n.startsWith(AWALAN_BAWAAN) && n.endsWith(".json"))
    .map((n) => n.slice(AWALAN_BAWAAN.length, -".json".length))
    .sort(urutBerkas);
}

export function bacaBawaan(kunci: string): Katalog | null {
  const t = isiBawaanTeks(kunci);
  if (t === null) return null;
  try {
    return JSON.parse(t) as Katalog;
  } catch {
    return null;
  }
}

/** Sidik isi katalog: sha256 dari JSON rapat (urutan kunci seperti tertulis). */
export function sidikKatalog(kat: unknown): string {
  return createHash("sha256").update(JSON.stringify(kat)).digest("hex").slice(0, 16);
}

/** Kode variabel ABT yang dipakai butir-butir satu katalog (sama dengan kodeVariabelKatalog di skrip pembangun). */
export function kodeVariabelKatalog(kat: Katalog): string[] {
  const kode = new Set<string>();
  const pertanyaan = Array.isArray(kat.pertanyaan) ? (kat.pertanyaan as Array<Record<string, unknown>>) : [];
  for (const q of pertanyaan) for (const v of Array.isArray(q.variabelAbt) ? (q.variabelAbt as unknown[]) : []) kode.add(String(v));
  return Array.from(kode);
}

export function butirIndeks(kat: Katalog): ButirIndeks {
  const butir: ButirIndeks = {
    kunci: kat.kunci,
    judul: teks(kat.judul),
    versi: Number(kat.versi) || 0,
    syarat: (kat.syarat as Record<string, unknown>) || {},
    tambahanUntuk: Array.isArray(kat.tambahanUntuk) ? (kat.tambahanUntuk as string[]) : [],
    kodeVariabel: kodeVariabelKatalog(kat),
    berkas: `${AWALAN_BAWAAN}${kat.kunci}.json`,
    ukuran: Buffer.byteLength(JSON.stringify(kat), "utf8"),
  };
  if (kat.contoh === true) butir.contoh = true;
  if (typeof kat.jenisKatalog === "string" && kat.jenisKatalog) butir.jenisKatalog = kat.jenisKatalog;
  return butir;
}

// ─── Mesin ekstensi di server (untuk memeriksa dan mempratinjau) ────────────

type Mesin = {
  periksaKatalog(kat: unknown, opsi?: Record<string, unknown>): { ok: boolean; galat: string[]; peringatan: string[] };
  susunSaksi(kat: unknown, masukan: Record<string, unknown>): { saksi: Array<{ ke: number; pihak: string; baris: Array<Record<string, unknown>> }>; peringatan: string[] };
  keadaanBawaan(kat: unknown, turunan?: Record<string, unknown>): Record<string, unknown>;
};
let mesinSimpanan: Mesin | null = null;
function mesin(): Mesin {
  if (mesinSimpanan) return mesinSimpanan;
  const dunia: Record<string, unknown> = {};
  const kode = (EKSTENSI_BERKAS as Record<string, unknown>)["saksi-katalog.js"];
  if (typeof kode !== "string") throw new Error("Mesin katalog saksi ekstensi tidak tertanam di portal");
  const modul: { exports: unknown } = { exports: {} };
  // Skrip ekstensi tertanam milik repo ini (bukan masukan pengguna); dunia kosong supaya tidak ada yang bocor.
  new Function("module", "globalThis", "self", kode)(modul, dunia, dunia);
  const m = dunia.AletaSaksiKatalog as Mesin | undefined;
  if (!m || typeof m.periksaKatalog !== "function") throw new Error("Mesin katalog saksi ekstensi tidak termuat");
  mesinSimpanan = m;
  return m;
}

// ─── Saklar dan hak ─────────────────────────────────────────────────────────

export async function katalogDbAktif(db: AletaDatabase): Promise<boolean> {
  try {
    return await fiturMenyala(db, FITUR_KATALOG_SAKSI_DB);
  } catch {
    return false;
  }
}

export async function bacaPenyunting(db: AletaDatabase): Promise<string[]> {
  try {
    const nilai = (await bacaSetelanSistem(db, KUNCI_PENYUNTING_KATALOG)) as { akun?: unknown } | null;
    return Array.isArray(nilai?.akun) ? (nilai!.akun as unknown[]).map(String).filter(Boolean).slice(0, 30) : [];
  } catch {
    return [];
  }
}

type Pelaku = { id: string; name?: string | null; roleId?: string | null; additionalRoleIds?: string[] };

const adalahSuperAdmin = (p: Pelaku) => String(p.roleId ?? "") === "super-admin" || (p.additionalRoleIds ?? []).includes("super-admin");

/** Super Admin atau akun yang didaftarkan. Admin biasa TIDAK otomatis (mengubah kalimat keterangan saksi di semua perkara). */
export async function bolehMenyuntingKatalog(db: AletaDatabase, pelaku: Pelaku): Promise<boolean> {
  if (adalahSuperAdmin(pelaku)) return true;
  return (await bacaPenyunting(db)).includes(pelaku.id);
}

export async function pastikanPenyunting(db: AletaDatabase, pelaku: Pelaku) {
  if (!(await bolehMenyuntingKatalog(db, pelaku))) {
    throw new ApiError(403, "Hanya Super Admin dan akun yang didaftarkan sebagai penyunting katalog saksi yang dapat mengubah katalog.");
  }
}

export async function simpanPenyunting(db: AletaDatabase, aktor: Pelaku, akun: unknown) {
  if (!adalahSuperAdmin(aktor)) {
    throw new ApiError(403, "Hanya Super Admin yang dapat mengatur penyunting katalog saksi.");
  }
  if (!Array.isArray(akun)) throw new ApiError(400, "Daftar akun penyunting harus berupa larik id pengguna.");
  const bersih = Array.from(new Set(akun.map((x) => teks(x)).filter(Boolean))).slice(0, 30);
  const sekarang = new Date().toISOString();
  await withTransaction(db, async (tx) => {
    await tulisSetelanSistem(tx, KUNCI_PENYUNTING_KATALOG, { akun: bersih, diubahOleh: aktor.id, diubahPada: sekarang }, sekarang);
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: aktor.id,
      action: "UPDATE_PENYUNTING_KATALOG_SAKSI",
      entityType: "aleta_ekstensi_setelan",
      entityId: KUNCI_PENYUNTING_KATALOG,
      payload: { jumlah: bersih.length },
      createdAt: sekarang,
    });
  });
  return bersih;
}

// ─── Pemeriksaan ────────────────────────────────────────────────────────────

export type HasilPeriksa = { ok: boolean; galat: string[]; peringatan: string[]; katalog: Katalog | null; sidik: string; ukuran: number };

/** Mengurai teks/objek, lalu memeriksa dengan periksaKatalog (mesin ekstensi) + aturan portal. Tidak menyimpan apa pun. */
export function periksaIsi(masukan: unknown, kunciYangDiharap = ""): HasilPeriksa {
  const galat: string[] = [];
  let kat: Katalog | null = null;
  if (typeof masukan === "string") {
    if (Buffer.byteLength(masukan, "utf8") > BATAS_BYTE_KATALOG) galat.push(`Katalog terlalu besar (batas ${BATAS_BYTE_KATALOG} bita).`);
    else {
      try {
        kat = JSON.parse(masukan) as Katalog;
      } catch (e) {
        galat.push(`JSON tidak dapat diurai: ${String((e as Error).message).slice(0, 160)}`);
      }
    }
  } else if (masukan && typeof masukan === "object" && !Array.isArray(masukan)) {
    kat = masukan as Katalog;
  } else galat.push("Isi katalog harus berupa objek JSON.");
  let peringatan: string[] = [];
  if (kat) {
    if (kunciYangDiharap && kat.kunci !== kunciYangDiharap) galat.push(`Kunci di dalam katalog ("${String(kat.kunci)}") harus sama dengan "${kunciYangDiharap}".`);
    if (typeof kat.kunci !== "string" || !POLA_KUNCI.test(kat.kunci)) galat.push("Kunci katalog harus kebab-case.");
    if (/aleta/i.test(JSON.stringify(kat))) galat.push('Katalog tidak boleh memuat kata "Aleta": jawabannya ditulis ke ABT.');
    if (Buffer.byteLength(JSON.stringify(kat), "utf8") > BATAS_BYTE_KATALOG) galat.push(`Katalog terlalu besar (batas ${BATAS_BYTE_KATALOG} bita).`);
    try {
      const h = mesin().periksaKatalog(kat);
      galat.push(...h.galat);
      peringatan = h.peringatan;
    } catch (e) {
      galat.push(`Pemeriksa katalog tidak dapat dijalankan: ${String((e as Error).message).slice(0, 160)}`);
    }
  }
  const ukuran = kat ? Buffer.byteLength(JSON.stringify(kat), "utf8") : 0;
  return { ok: galat.length === 0, galat, peringatan, katalog: galat.length === 0 ? kat : null, sidik: kat ? sidikKatalog(kat) : "", ukuran };
}

/** Pratinjau: dua saksi Penggugat, keadaan bawaan katalog, penanda variabel dibiarkan (kosong). Tidak menyimpan apa pun. */
export function pratinjauKatalog(kat: Katalog) {
  const m = mesin();
  const keadaan = m.keadaanBawaan(kat, {});
  const hasil = m.susunSaksi(kat, {
    keadaan,
    benih: "pratinjau",
    saksi: [
      { pihak: "P", jenis: "melihat" },
      { pihak: "P", jenis: "melihat" },
    ],
    variabel: () => undefined,
    tingkat: ["inti", "pilihan", "tambahan"],
  });
  return {
    keadaan,
    peringatan: hasil.peringatan,
    saksi: hasil.saksi.map((s) => ({ ke: s.ke, pihak: s.pihak, baris: s.baris.map((b) => ({ butir: b.butir, jenis: b.jenis, tanya: b.tanya, jawab: b.jawab, kosong: b.kosong })) })),
  };
}

// ─── Penyimpanan versi ──────────────────────────────────────────────────────

type BarisKatalog = { kunci: string; judul: string; versi_aktif: number; diubah_oleh: string; diubah_nama: string; diubah_at: string };

async function barisKatalog(db: AletaDatabase, kunci: string): Promise<BarisKatalog | null> {
  const b = await db.queryOne<Record<string, unknown>>(`SELECT * FROM aleta_saksi_katalog WHERE kunci = ?`, [kunci]);
  return b
    ? { kunci: teks(b.kunci), judul: teks(b.judul), versi_aktif: Number(b.versi_aktif) || 0, diubah_oleh: teks(b.diubah_oleh), diubah_nama: teks(b.diubah_nama), diubah_at: teks(b.diubah_at) }
    : null;
}

export type RiwayatVersi = { versi: number; sidik: string; catatan: string; dasarVersi: number; dibuatOleh: string; dibuatNama: string; dibuatAt: string; aktif: boolean };

export async function riwayatKatalog(db: AletaDatabase, kunci: string): Promise<RiwayatVersi[]> {
  const aktif = (await barisKatalog(db, kunci))?.versi_aktif ?? 0;
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT versi, sidik, catatan, dasar_versi, dibuat_oleh, dibuat_nama, dibuat_at FROM aleta_saksi_katalog_versi WHERE kunci = ? ORDER BY versi DESC LIMIT 200`,
    [kunci]
  );
  return baris.map((b) => ({
    versi: Number(b.versi) || 0,
    sidik: teks(b.sidik),
    catatan: teks(b.catatan),
    dasarVersi: Number(b.dasar_versi) || 0,
    dibuatOleh: teks(b.dibuat_oleh),
    dibuatNama: teks(b.dibuat_nama),
    dibuatAt: teks(b.dibuat_at),
    aktif: Number(b.versi) === aktif,
  }));
}

/** Isi satu versi (utuh). versi 0 = bawaan tertanam. */
export async function isiVersi(db: AletaDatabase, kunci: string, versi: number): Promise<Katalog | null> {
  if (!versi) return bacaBawaan(kunci);
  const b = await db.queryOne<Record<string, unknown>>(`SELECT isi_json FROM aleta_saksi_katalog_versi WHERE kunci = ? AND versi = ?`, [kunci, versi]);
  if (!b) return null;
  try {
    return JSON.parse(String(b.isi_json)) as Katalog;
  } catch {
    return null;
  }
}

/**
 * Menyimpan versi baru dan (bawaan) mengaktifkannya. Wajib lolos periksaIsi; kunci baru (tanpa bawaan) boleh dibuat.
 * `dasarVersi` = versi yang disunting (0 = bawaan) - hanya catatan riwayat.
 */
export async function simpanVersi(
  db: AletaDatabase,
  aktor: Pelaku,
  masukan: { kunci: string; isi: unknown; catatan?: string; dasarVersi?: number; aktifkan?: boolean }
) {
  await pastikanPenyunting(db, aktor);
  const kunci = teks(masukan.kunci);
  if (!POLA_KUNCI.test(kunci)) throw new ApiError(400, "Kunci katalog harus kebab-case.");
  const periksa = periksaIsi(masukan.isi, kunci);
  if (!periksa.ok || !periksa.katalog) throw new ApiError(400, `Katalog ditolak: ${periksa.galat.slice(0, 6).join("; ")}`);
  const kat = periksa.katalog;
  const aktifkan = masukan.aktifkan !== false;
  const sekarang = new Date().toISOString();
  return withTransaction(db, async (tx) => {
    const maks = await tx.queryOne<Record<string, unknown>>(`SELECT MAX(versi) AS m FROM aleta_saksi_katalog_versi WHERE kunci = ?`, [kunci]);
    const versi = (Number(maks?.m) || 0) + 1;
    await tx.run(
      `INSERT INTO aleta_saksi_katalog_versi (id, kunci, versi, isi_json, sidik, catatan, dasar_versi, dibuat_oleh, dibuat_nama, dibuat_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), kunci, versi, JSON.stringify(kat), periksa.sidik, teks(masukan.catatan).slice(0, 500), Math.max(0, Math.round(Number(masukan.dasarVersi) || 0)), aktor.id, teks(aktor.name), sekarang]
    );
    const ada = await tx.queryOne<Record<string, unknown>>(`SELECT kunci FROM aleta_saksi_katalog WHERE kunci = ?`, [kunci]);
    if (ada) {
      await tx.run(
        `UPDATE aleta_saksi_katalog SET judul = ?, ${aktifkan ? "versi_aktif = ?, " : ""}diubah_oleh = ?, diubah_nama = ?, diubah_at = ? WHERE kunci = ?`,
        aktifkan ? [teks(kat.judul), versi, aktor.id, teks(aktor.name), sekarang, kunci] : [teks(kat.judul), aktor.id, teks(aktor.name), sekarang, kunci]
      );
    } else {
      await tx.run(`INSERT INTO aleta_saksi_katalog (kunci, judul, versi_aktif, diubah_oleh, diubah_nama, diubah_at) VALUES (?, ?, ?, ?, ?, ?)`, [
        kunci,
        teks(kat.judul),
        aktifkan ? versi : 0,
        aktor.id,
        teks(aktor.name),
        sekarang,
      ]);
    }
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: aktor.id,
      action: "SIMPAN_VERSI_KATALOG_SAKSI",
      entityType: "aleta_saksi_katalog",
      entityId: kunci,
      payload: { versi, sidik: periksa.sidik, aktifkan, catatan: teks(masukan.catatan).slice(0, 200) },
      createdAt: sekarang,
    });
    return { kunci, versi, aktif: aktifkan, sidik: periksa.sidik, peringatan: periksa.peringatan };
  });
}

/** Mengaktifkan versi yang sudah ada (pemulihan). */
export async function aktifkanVersi(db: AletaDatabase, aktor: Pelaku, kunci: string, versi: number) {
  await pastikanPenyunting(db, aktor);
  const k = teks(kunci);
  const v = Math.round(Number(versi) || 0);
  const baris = await db.queryOne<Record<string, unknown>>(`SELECT versi, isi_json FROM aleta_saksi_katalog_versi WHERE kunci = ? AND versi = ?`, [k, v]);
  if (!baris) throw new ApiError(404, "Versi katalog itu tidak ada.");
  let judul = "";
  try {
    judul = teks((JSON.parse(String(baris.isi_json)) as Katalog).judul);
  } catch {
    /* judul dari baris katalog */
  }
  const sekarang = new Date().toISOString();
  await withTransaction(db, async (tx) => {
    await tx.run(`UPDATE aleta_saksi_katalog SET versi_aktif = ?, judul = ?, diubah_oleh = ?, diubah_nama = ?, diubah_at = ? WHERE kunci = ?`, [v, judul, aktor.id, teks(aktor.name), sekarang, k]);
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: aktor.id,
      action: "AKTIFKAN_VERSI_KATALOG_SAKSI",
      entityType: "aleta_saksi_katalog",
      entityId: k,
      payload: { versi: v },
      createdAt: sekarang,
    });
  });
  return { kunci: k, versi: v };
}

/** Kembali memakai bawaan tertanam (versi_aktif = 0). Versi-versi tetap tersimpan. */
export async function kembaliKeBawaan(db: AletaDatabase, aktor: Pelaku, kunci: string) {
  await pastikanPenyunting(db, aktor);
  const k = teks(kunci);
  if (!(await barisKatalog(db, k))) return { kunci: k, versi: 0 };
  const sekarang = new Date().toISOString();
  await withTransaction(db, async (tx) => {
    await tx.run(`UPDATE aleta_saksi_katalog SET versi_aktif = 0, diubah_oleh = ?, diubah_nama = ?, diubah_at = ? WHERE kunci = ?`, [aktor.id, teks(aktor.name), sekarang, k]);
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: aktor.id,
      action: "KEMBALI_KE_BAWAAN_KATALOG_SAKSI",
      entityType: "aleta_saksi_katalog",
      entityId: k,
      payload: {},
      createdAt: sekarang,
    });
  });
  return { kunci: k, versi: 0 };
}

// ─── Penyajian ──────────────────────────────────────────────────────────────

export type RingkasanKatalog = {
  kunci: string;
  judul: string;
  versiJson: number;
  sumber: "bawaan" | "basis-data";
  versiDb: number;
  adaBawaan: boolean;
  jumlahVersi: number;
  sidik: string;
  diubahNama: string;
  diubahAt: string;
};

/** Daftar untuk layar penyunting: semua kunci bawaan + kunci yang hanya ada di basis data. */
export async function daftarKatalog(db: AletaDatabase): Promise<RingkasanKatalog[]> {
  const baris = await db.queryAll<Record<string, unknown>>(`SELECT * FROM aleta_saksi_katalog`);
  const jumlah = await db.queryAll<Record<string, unknown>>(`SELECT kunci, COUNT(*) AS n FROM aleta_saksi_katalog_versi GROUP BY kunci`);
  const n = new Map(jumlah.map((j) => [teks(j.kunci), Number(j.n) || 0]));
  const peta = new Map(baris.map((b) => [teks(b.kunci), b]));
  const kunci = Array.from(new Set([...kunciBawaan(), ...peta.keys()])).sort(urutBerkas);
  const hasil: RingkasanKatalog[] = [];
  for (const k of kunci) {
    const b = peta.get(k);
    const versiDb = Number(b?.versi_aktif) || 0;
    const kat = versiDb ? await isiVersi(db, k, versiDb) : bacaBawaan(k);
    hasil.push({
      kunci: k,
      judul: teks(kat?.judul ?? b?.judul),
      versiJson: Number(kat?.versi) || 0,
      sumber: versiDb ? "basis-data" : "bawaan",
      versiDb,
      adaBawaan: isiBawaanTeks(k) !== null,
      jumlahVersi: n.get(k) ?? 0,
      sidik: kat ? sidikKatalog(kat) : "",
      diubahNama: teks(b?.diubah_nama),
      diubahAt: teks(b?.diubah_at),
    });
  }
  return hasil;
}

/** Katalog efektif untuk ekstensi (saklar menyala): penimpa aktif, selain itu bawaan. null bila tidak ada sama sekali. */
export async function isiEfektif(db: AletaDatabase, kunci: string): Promise<{ kunci: string; sumber: "bawaan" | "basis-data"; versiDb: number; sidik: string; isi: Katalog } | null> {
  const b = await barisKatalog(db, kunci);
  if (b && b.versi_aktif > 0) {
    const isi = await isiVersi(db, kunci, b.versi_aktif);
    if (isi) return { kunci, sumber: "basis-data", versiDb: b.versi_aktif, sidik: sidikKatalog(isi), isi };
  }
  const bawaan = bacaBawaan(kunci);
  return bawaan ? { kunci, sumber: "bawaan", versiDb: 0, sidik: sidikKatalog(bawaan), isi: bawaan } : null;
}

/** Indeks efektif untuk ekstensi: bawaan, ditimpa menurut kunci oleh penimpa aktif; kunci basis-data baru ikut. */
export async function indeksEfektif(db: AletaDatabase): Promise<ButirIndeks[]> {
  const aktif = await db.queryAll<Record<string, unknown>>(`SELECT kunci, versi_aktif FROM aleta_saksi_katalog WHERE versi_aktif > 0`);
  const versiAktif = new Map(aktif.map((a) => [teks(a.kunci), Number(a.versi_aktif) || 0]));
  const kunci = Array.from(new Set([...kunciBawaan(), ...versiAktif.keys()])).sort(urutBerkas);
  const hasil: ButirIndeks[] = [];
  for (const k of kunci) {
    const versiDb = versiAktif.get(k) ?? 0;
    const kat = versiDb ? await isiVersi(db, k, versiDb) : bacaBawaan(k);
    if (!kat || kat.contoh === true) continue;
    hasil.push({ ...butirIndeks(kat), sumber: versiDb ? "basis-data" : "bawaan", versiDb, sidik: sidikKatalog(kat) });
  }
  return hasil;
}
