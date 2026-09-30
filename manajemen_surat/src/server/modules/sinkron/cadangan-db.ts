import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, rm, statfs } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import { APP_VERSION } from "@/lib/patch-notes";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import type { AletaDatabase } from "@/server/db/client";
import { bersihkanArsip, buatArsipBasisData } from "@/server/modules/backups/arsip";
import { Sidik, tarikDumpBot } from "@/server/modules/sinkron/bot-dump";
import { SEBUTAN_BASIS_DATA, bacaPengaturan, sandiArsip, type KunciBasisData } from "@/server/modules/sinkron/pengaturan";
import { bacaJson, jalurSinkron, tulisJson } from "@/server/modules/sinkron/penyimpanan";
import { saringRahasia } from "@/server/modules/sinkron/riwayat";
import { AKHIRAN_SANDI, AliranSandi } from "@/server/modules/sinkron/sandi-arsip";

/**
 * Cadangan basis data di server (butir 29) - satu "bundel" per jalan:
 *
 *   reports/sinkron/arsip/20260930-020000/
 *     aleta-database-<cap>.tar.gz.aleta-enc   ALETA PostgreSQL (buatArsipBasisData)
 *     sipp-20260930-020000.sql.gz.aleta-enc   SIPP MySQL (dump bot)
 *     abt-...  antrian-...  aleta_bot-...
 *     MANIFEST.json                           nama, byte, SHA-256 - tanpa rahasia
 *
 * PostgreSQL ALETA memakai buatArsipBasisData() yang SAMA dengan unduhan
 * Update Manager - pg_dump polos + kustom, atau SQL susunan ALETA bila pg_dump
 * tidak ada. MySQL ditarik dari bot, satu per satu (dump penuh SIPP berat;
 * dua sekaligus hanya membebani server induk dua kali lipat).
 */

export type BerkasBundel = {
  nama: string;
  sumber: KunciBasisData;
  byte: number;
  sha256: string;
  tersandi: boolean;
  keterangan: string;
};

export type ManifestBundel = {
  bundel: string;
  dibuat: string;
  selesai: string;
  versiAplikasi: string;
  tersandi: boolean;
  petunjukSandi: string;
  berkas: BerkasBundel[];
  gagal: Array<{ sumber: KunciBasisData; sebab: string }>;
};

const POLA_BUNDEL = /^\d{8}-\d{6}$/;

/** "20260930-020000" menurut jam pengadilan - urut abjad = urut waktu. */
export function namaBundel(kini = new Date()) {
  const { tanggal, jam } = waktuPengadilan(kini);
  return `${tanggal.replace(/-/g, "")}-${jam.replace(/:/g, "")}`;
}

export function direktoriBundel(bundel: string) {
  if (!POLA_BUNDEL.test(bundel)) throw new Error("Nama bundel tidak sah.");
  return path.join(jalurSinkron.arsip(), bundel);
}

export async function daftarBundel(): Promise<ManifestBundel[]> {
  let nama: string[] = [];
  try {
    nama = (await readdir(jalurSinkron.arsip(), { withFileTypes: true }))
      .filter((d) => d.isDirectory() && POLA_BUNDEL.test(d.name))
      .map((d) => d.name);
  } catch {
    return [];
  }
  const hasil: ManifestBundel[] = [];
  for (const n of nama.sort().reverse()) {
    const m = await bacaJson<ManifestBundel | null>(path.join(jalurSinkron.arsip(), n, "MANIFEST.json"), null);
    if (m && m.bundel === n && Array.isArray(m.berkas)) hasil.push(m);
  }
  return hasil;
}

/** Berkas bundel yang boleh diunduh - hanya yang tercatat di manifest-nya. */
export async function berkasBundel(bundel: string, nama: string) {
  const m = await bacaJson<ManifestBundel | null>(path.join(direktoriBundel(bundel), "MANIFEST.json"), null);
  const b = m?.berkas.find((x) => x.nama === nama);
  if (!m || !b || path.basename(b.nama) !== b.nama) return null;
  return { manifest: m, berkas: b, jalur: path.join(direktoriBundel(bundel), b.nama) };
}

/** Menyimpan `simpan` bundel terbaru; yang lebih lama dihapus dari server. */
export async function pangkasBundel(simpan: number) {
  let nama: string[] = [];
  try {
    nama = (await readdir(jalurSinkron.arsip(), { withFileTypes: true }))
      .filter((d) => d.isDirectory() && POLA_BUNDEL.test(d.name))
      .map((d) => d.name)
      .sort()
      .reverse();
  } catch {
    return [];
  }
  const buang = nama.slice(Math.max(1, simpan));
  for (const n of buang) await rm(path.join(jalurSinkron.arsip(), n), { recursive: true, force: true });
  return buang;
}

async function ruangBebasGb(dir: string) {
  try {
    const s = await statfs(dir);
    return (Number(s.bavail) * Number(s.bsize)) / 1024 ** 3;
  } catch {
    return null;
  }
}

export type PilihanCadangan = {
  sinyal?: AbortSignal;
  lapor?: (teks: string) => void;
  /** Uji: pengganti fetch ke bot dan pembuat arsip ALETA. */
  fetchImpl?: typeof fetch;
  buatArsipAleta?: typeof buatArsipBasisData;
};

export async function jalankanCadanganDb(db: AletaDatabase, pilihan: PilihanCadangan = {}) {
  const p = await bacaPengaturan();
  const sandi = sandiArsip(p);
  if (p.enkripsi.sandiTersandi && !sandi) {
    // Sandi tersimpan tetapi tidak dapat dibuka - kunci env server berganti.
    // Membuat arsip TANPA sandi diam-diam di sini akan menurunkan
    // perlindungan tanpa seorang pun tahu; lebih baik berhenti.
    throw new Error(
      "Kata sandi arsip tersimpan tetapi tidak dapat dibuka (kunci ALETA_CREDENTIAL_ENCRYPTION_KEY/BETTER_AUTH_SECRET server berganti?). Isi ulang kata sandi arsip di layar."
    );
  }
  const dipilih = (Object.keys(p.cadangan.basisData) as KunciBasisData[]).filter((k) => p.cadangan.basisData[k]);
  if (dipilih.length === 0) throw new Error("Tidak ada basis data yang dipilih untuk dicadangkan.");

  await mkdir(jalurSinkron.arsip(), { recursive: true });
  const minimalGb = Number(process.env.ALETA_SINKRON_MIN_RUANG_GB || 5);
  const bebas = await ruangBebasGb(jalurSinkron.arsip());
  if (bebas !== null && bebas < minimalGb) {
    throw new Error(`Ruang disk server tinggal ${bebas.toFixed(1)} GB (minimal ${minimalGb} GB). Cadangan tidak dibuat.`);
  }

  const bundel = namaBundel();
  const dir = direktoriBundel(bundel);
  await mkdir(dir, { recursive: true });
  const manifest: ManifestBundel = {
    bundel,
    dibuat: new Date().toISOString(),
    selesai: "",
    versiAplikasi: APP_VERSION,
    tersandi: Boolean(sandi),
    petunjukSandi: p.enkripsi.petunjuk,
    berkas: [],
    gagal: [],
  };
  const akhiran = sandi ? AKHIRAN_SANDI : "";

  for (const kunci of dipilih) {
    if (pilihan.sinyal?.aborted) {
      manifest.gagal.push({ sumber: kunci, sebab: "dihentikan admin" });
      continue;
    }
    pilihan.lapor?.(`${SEBUTAN_BASIS_DATA[kunci]}: mulai`);
    try {
      if (kunci === "aleta") {
        const hasil = await (pilihan.buatArsipAleta ?? buatArsipBasisData)(db);
        try {
          const nama = `${hasil.namaBerkas}${akhiran}`;
          const sidik = new Sidik();
          await pipeline(
            createReadStream(hasil.jalur),
            ...((sandi ? [new AliranSandi(sandi), sidik] : [sidik]) as [NodeJS.ReadWriteStream]),
            createWriteStream(path.join(dir, nama))
          );
          manifest.berkas.push({
            nama,
            sumber: kunci,
            byte: sidik.byte,
            sha256: sidik.hash.digest("hex"),
            tersandi: Boolean(sandi),
            keterangan: `${hasil.format}; ${hasil.catatan.join("; ")}`,
          });
        } finally {
          await bersihkanArsip(hasil);
        }
      } else {
        const nama = `${kunci}-${bundel}.sql.gz${akhiran}`;
        const hasil = await tarikDumpBot(kunci, path.join(dir, nama), sandi, {
          sinyal: pilihan.sinyal,
          fetchImpl: pilihan.fetchImpl,
          lapor: (byte) => pilihan.lapor?.(`${SEBUTAN_BASIS_DATA[kunci]}: ${(byte / 1024 ** 2).toFixed(0)} MB`),
        });
        manifest.berkas.push({
          nama,
          sumber: kunci,
          byte: hasil.byte,
          sha256: hasil.sha256,
          tersandi: Boolean(sandi),
          keterangan: `mysql dump (gzip) - ${hasil.ringkasan}; SQL ${(hasil.byteSql / 1024 ** 2).toFixed(1)} MB`,
        });
      }
    } catch (galat) {
      manifest.gagal.push({ sumber: kunci, sebab: saringRahasia(galat) });
    }
    await tulisJson(path.join(dir, "MANIFEST.json"), manifest);
  }

  manifest.selesai = new Date().toISOString();
  await tulisJson(path.join(dir, "MANIFEST.json"), manifest);
  if (manifest.berkas.length === 0) {
    // Bundel kosong tidak dihitung sebagai salinan - dan tidak boleh
    // mendorong keluar salinan lama yang masih utuh saat dipangkas.
    await rm(dir, { recursive: true, force: true });
  } else {
    await pangkasBundel(p.cadangan.simpanDiServer);
  }
  return manifest;
}
