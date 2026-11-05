import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { FORMAT_PAKET, SERVER_INDUK, periksaManifest, sidikPaket, type ManifestPaket } from "@/lib/aleta-abt-satker";
import { susunPustakaMesin, type BarisPustakaMesin, type PustakaMesin } from "@/lib/aleta-abt-pustaka";
import type { AletaDatabase } from "@/server/db/client";
import { jalankanSinkron, type DepsSinkron, type HasilSinkron, type IsiBerkas, type PotretAbt } from "@/server/modules/aleta-abt-pustaka/service";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * PEMASANGAN PAKET INDUK ALETA ABT DI SATKER LAIN (5 Nov 2026, Tahap 8)
 * ============================================================================
 *
 * Paket = folder berisi manifest.json dan blangko/<jalur>. Pemasangan memakai sinkron yang SUDAH ADA (jalankanSinkron) dengan sumber
 * paket, bukan ABT, sehingga semua aturan keselamatannya ikut: satu arah, tidak menimpa ubahan satker, tidak menandai hilang yang
 * bukan miliknya, tidak menghapus. Server pustaka = "induk": blangko dan isian milik satker itu (asal "aleta") dan hasil sinkron dari
 * ABT setempat (server lain) tidak tercampur dengan pustaka induk, dan nomor isian ABT setempat tidak bentrok karena kode ALETA ABT
 * (AA + angka) dipetakan PER SERVER.
 *
 * Tidak menulis ke ABT, SIPP, atau e-Court; hanya membaca folder paket dan menulis database ALETA.
 */

const BATAS_ISI_BYTE = 12 * 1024 * 1024;
const md5 = (b: Buffer) => createHash("md5").update(b).digest("hex");

export type PaketDiDisk = { dir: string; manifest: ManifestPaket };

export async function bacaPaket(dir: string): Promise<PaketDiDisk> {
  let mentah: unknown;
  try {
    mentah = JSON.parse(await fs.readFile(path.join(dir, "manifest.json"), "utf8"));
  } catch {
    throw new ApiError(400, "Folder ini bukan paket pasang: manifest tidak terbaca.");
  }
  const masalah = periksaManifest(mentah);
  if (masalah.length) throw new ApiError(400, `Paket tidak sah: ${masalah.slice(0, 5).join(" ")}`);
  return { dir, manifest: mentah as ManifestPaket };
}

/** Jalur berkas di dalam folder paket; jalur yang keluar dari folder blangko ditolak. */
export function jalurDiPaket(dir: string, jalur: string): string | null {
  const akar = path.resolve(dir, "blangko");
  const penuh = path.resolve(akar, jalur);
  return penuh === akar || penuh.startsWith(akar + path.sep) ? penuh : null;
}

/** Memeriksa SEMUA berkas paket terhadap manifest (ada, ukuran dan md5 cocok). Kosong = utuh. */
export async function periksaIsiPaket(p: PaketDiDisk): Promise<string[]> {
  const masalah: string[] = [];
  for (const b of p.manifest.berkas) {
    const penuh = jalurDiPaket(p.dir, b.jalur);
    if (!penuh) {
      masalah.push(`Jalur di luar paket: ${b.jalur}`);
      continue;
    }
    let isi: Buffer;
    try {
      isi = await fs.readFile(penuh);
    } catch {
      masalah.push(`Berkas hilang dari paket: ${b.jalur}`);
      continue;
    }
    if (isi.length !== b.ukuran || md5(isi) !== b.md5) masalah.push(`Isi berkas tidak cocok dengan manifest: ${b.jalur}`);
    if (masalah.length >= 50) break;
  }
  for (const f of p.manifest.fungsi ?? []) {
    let isi: Buffer;
    try {
      isi = await fs.readFile(path.join(p.dir, "fungsi", `${f.nama}.sql`));
    } catch {
      masalah.push(`Berkas fungsi hilang dari paket: ${f.nama}`);
      continue;
    }
    if (isi.length !== f.ukuran || md5(isi) !== f.md5) masalah.push(`Isi fungsi tidak cocok dengan manifest: ${f.nama}`);
    if (masalah.length >= 50) break;
  }
  return masalah;
}

export function potretDariPaket(p: PaketDiDisk): PotretAbt {
  const m = p.manifest;
  return {
    server: SERVER_INDUK,
    waktu: m.dibuat,
    berkas: m.berkas.map((b) => ({ ...b })),
    variabel: m.variabel as unknown as PotretAbt["variabel"],
    menu: [],
    takDikenal: m.takDikenal,
  };
}

/** Sumber sinkron dari paket: tidak ada jaringan, tidak ada ABT. */
export function depsDariPaket(p: PaketDiDisk, kini?: () => string): DepsSinkron {
  return {
    ambilPotret: async () => potretDariPaket(p),
    ambilIsi: async (jalur) => {
      const berkas: IsiBerkas[] = [];
      const ditolak: string[] = [];
      const lewat: string[] = [];
      let total = 0;
      for (const j of jalur) {
        const penuh = jalurDiPaket(p.dir, j);
        if (!penuh) {
          ditolak.push(j);
          continue;
        }
        let bita: Buffer;
        try {
          bita = await fs.readFile(penuh);
        } catch {
          ditolak.push(j);
          continue;
        }
        if (berkas.length && total + bita.length > BATAS_ISI_BYTE) {
          lewat.push(j);
          continue;
        }
        total += bita.length;
        berkas.push({ jalur: j, md5: md5(bita), ukuran: bita.length, isi: bita.toString("base64") });
      }
      return { berkas, ditolak, lewat };
    },
    ...(kini ? { kini } : {}),
  };
}

/**
 * Memasang (atau memperbarui) pustaka induk dari paket. Paket diperiksa utuh DULU; yang rusak tidak pernah dipasang setengah.
 * Memasang ulang paket yang sama tidak menulis apa pun. `deps` untuk uji (transaksi pg-mem).
 */
export async function pasangPaketInduk(db: AletaDatabase, dir: string, oleh: string, deps: Partial<DepsSinkron> = {}): Promise<HasilSinkron & { paketSidik: string; berkasPaket: number; variabelPaket: number }> {
  const paket = await bacaPaket(dir);
  const masalah = await periksaIsiPaket(paket);
  if (masalah.length) throw new ApiError(400, `Paket rusak, tidak dipasang: ${masalah.slice(0, 3).join("; ")}`);
  const id = randomUUID();
  await db.run("INSERT INTO aleta_abt_sinkron (id, status, oleh, mulai_at) VALUES (?, 'jalan', ?, ?)", [id, `paket induk: ${String(oleh || "").slice(0, 100)}`, new Date().toISOString()]);
  const hasil = await jalankanSinkron(db, id, { ...depsDariPaket(paket), ...deps });
  return { ...hasil, paketSidik: paket.manifest.sidik, berkasPaket: paket.manifest.berkas.length, variabelPaket: paket.manifest.variabel.length };
}

/**
 * Pustaka isian untuk mesin dari server INDUK saja (tidak memilih "server terbanyak"): bila satker juga menyinkronkan ABT setempat
 * (server lain), isian ABT itu tidak pernah menggantikan isian induk. Hanya membaca database ALETA.
 */
export async function muatPustakaInduk(db: AletaDatabase, server: string = SERVER_INDUK): Promise<PustakaMesin> {
  const baris = await db.queryAll<BarisPustakaMesin>(
    `SELECT p.no_var AS no_var, v.kode AS kode, v.nama AS nama, v.tipe AS tipe, v.data_tabel AS data_tabel, v.data_kolom AS data_kolom,
            v.urutan_data AS urutan_data, v.referensi_asal AS referensi_asal, v.sql_query AS sql_query, v.default_data AS default_data, v.multi_sidang AS multi_sidang
       FROM aleta_abt_peta_variabel p JOIN aleta_abt_variabel v ON v.kode = p.kode
      WHERE p.server = ? AND p.status <> 'hilang' AND v.status = 'aktif'`,
    [server]
  );
  return susunPustakaMesin(baris, (t) => createHash("sha1").update(t).digest("hex"));
}

export { FORMAT_PAKET, sidikPaket };
