import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import { Readable, Transform, type TransformCallback } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { createGunzip } from "node:zlib";

import { AliranSandi } from "@/server/modules/sinkron/sandi-arsip";

/**
 * Menarik dump MySQL dari bot (GET /internal/aleta-bot/sinkron/dump) ke satu
 * berkas di server - dimampatkan bot, disandikan di sini bila ada sandi.
 *
 * Bot yang memegang sambungan MySQL SIPP/ABT/antrian; portal tidak pernah
 * memegang kredensial MySQL. Alamat dan token internalnya dibaca dari env
 * yang SAMA dengan klien gateway (ALETA_BOT_BASE_URL, ALETA_BOT_INTERNAL_*).
 */

export const PENANDA_SELESAI = "-- ALETA-DUMP-SELESAI";
export const PENANDA_GAGAL = "-- ALETA-DUMP-GAGAL";

export function alamatBot() {
  return (process.env.ALETA_BOT_BASE_URL || process.env.ALETA_BOT_RUNTIME_URL || "http://127.0.0.1:3003").replace(/\/$/, "");
}

export function tokenBot() {
  return process.env.ALETA_BOT_INTERNAL_API_TOKEN || process.env.ALETA_BOT_INTERNAL_TOKEN || "";
}

/** Menghitung SHA-256 dan jumlah byte yang lewat. */
export class Sidik extends Transform {
  readonly hash = createHash("sha256");
  byte = 0;
  _transform(potong: Buffer, _e: BufferEncoding, selesai: TransformCallback) {
    this.hash.update(potong);
    this.byte += potong.length;
    selesai(null, potong);
  }
}

/**
 * Meneruskan aliran gzip apa adanya sambil membukanya di samping untuk
 * memeriksa EKORNYA: dump yang benar ditutup PENANDA_SELESAI. Tanpa ini,
 * sambungan yang putus di tengah tabel ke-300 menghasilkan berkas .sql.gz
 * yang tampak utuh - dan baru ketahuan ketika dipulihkan, saat dibutuhkan.
 */
export class PemeriksaDump extends Transform {
  private readonly gunzip = createGunzip();
  private ekor = "";
  private galat: Error | null = null;
  private readonly selesaiBuka: Promise<void>;
  byteSql = 0;

  constructor() {
    super();
    this.gunzip.on("data", (b: Buffer) => {
      this.byteSql += b.length;
      this.ekor = (this.ekor + b.toString("utf8")).slice(-4096);
    });
    this.selesaiBuka = new Promise((ok) => {
      this.gunzip.on("end", () => ok());
      this.gunzip.on("error", (e) => {
        this.galat = e;
        ok();
      });
    });
  }

  _transform(potong: Buffer, _e: BufferEncoding, selesai: TransformCallback) {
    // Gzip yang sudah rusak tidak ditulisi lagi - "drain"-nya tidak akan
    // pernah datang, dan aliran utama akan menggantung selamanya.
    if (this.galat || this.gunzip.destroyed) return selesai(null, potong);
    if (!this.gunzip.write(potong)) {
      const lanjut = () => {
        this.gunzip.off("drain", lanjut);
        this.gunzip.off("error", lanjut);
        selesai(null, potong);
      };
      this.gunzip.once("drain", lanjut);
      this.gunzip.once("error", lanjut);
      return;
    }
    selesai(null, potong);
  }

  _flush(selesai: TransformCallback) {
    try {
      if (!this.galat && !this.gunzip.destroyed) this.gunzip.end();
    } catch {
      /* sudah tertutup karena rusak - sebabnya dilaporkan di bawah */
    }
    this.selesaiBuka.then(() => {
      if (this.galat) return selesai(new Error(`Dump rusak (gzip): ${this.galat.message}`));
      const gagal = this.ekor.lastIndexOf(PENANDA_GAGAL);
      if (gagal >= 0) {
        return selesai(new Error(`Bot gagal menyusun dump: ${this.ekor.slice(gagal + PENANDA_GAGAL.length + 1).trim().slice(0, 200)}`));
      }
      if (!this.ekor.includes(PENANDA_SELESAI)) {
        return selesai(new Error("Dump terpotong: penanda selesai tidak ada di ujung berkas."));
      }
      selesai();
    });
  }

  /** "tabel=12 baris=3400 ..." dari penanda selesai. */
  ringkasan() {
    const i = this.ekor.lastIndexOf(PENANDA_SELESAI);
    return i >= 0 ? this.ekor.slice(i + PENANDA_SELESAI.length).trim().split("\n")[0] : "";
  }
}

export async function periksaSumberBot(fetchImpl: typeof fetch = fetch) {
  const jawab = await fetchImpl(`${alamatBot()}/internal/aleta-bot/sinkron/sumber`, {
    headers: tokenBot() ? { "x-aleta-internal-token": tokenBot() } : {},
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const isi = (await jawab.json().catch(() => null)) as
    | { ok?: boolean; message?: string; sumber?: Array<{ kunci: string; sebutan: string; terjangkau: boolean; namaDb: string; error: string }>; sedangBerjalan?: string | null }
    | null;
  if (!jawab.ok || !isi?.ok) {
    throw new Error(
      jawab.status === 404
        ? "Bot belum mengenal rute sinkron - container bot perlu dibangun ulang dengan versi ini."
        : isi?.message || `Bot menjawab HTTP ${jawab.status}.`
    );
  }
  return { sumber: isi.sumber ?? [], sedangBerjalan: isi.sedangBerjalan ?? null };
}

/**
 * Menarik satu dump ke `jalurKeluar`. Berkas yang gagal diperiksa DIHAPUS -
 * arsip yang tidak utuh tidak boleh tertinggal dengan nama yang tampak benar.
 */
export async function tarikDumpBot(
  kunci: string,
  jalurKeluar: string,
  sandi: string,
  pilihan: { sinyal?: AbortSignal; fetchImpl?: typeof fetch; lapor?: (byte: number) => void } = {}
) {
  const fetchImpl = pilihan.fetchImpl ?? fetch;
  const jawab = await fetchImpl(`${alamatBot()}/internal/aleta-bot/sinkron/dump?sumber=${encodeURIComponent(kunci)}`, {
    headers: tokenBot() ? { "x-aleta-internal-token": tokenBot() } : {},
    cache: "no-store",
    signal: pilihan.sinyal,
  });
  if (!jawab.ok || !jawab.body) {
    const isi = (await jawab.json().catch(() => null)) as { message?: string } | null;
    throw new Error(
      jawab.status === 404
        ? "Bot belum mengenal rute sinkron - container bot perlu dibangun ulang dengan versi ini."
        : isi?.message || `Bot menjawab HTTP ${jawab.status}.`
    );
  }
  const pemeriksa = new PemeriksaDump();
  const sidik = new Sidik();
  let terakhirLapor = 0;
  const laporan = new Transform({
    transform(potong: Buffer, _e, selesai) {
      if (pilihan.lapor && Date.now() - terakhirLapor > 5000) {
        terakhirLapor = Date.now();
        pilihan.lapor(sidik.byte);
      }
      selesai(null, potong);
    },
  });
  const tahap: NodeJS.ReadWriteStream[] = [pemeriksa, laporan];
  if (sandi) tahap.push(new AliranSandi(sandi));
  tahap.push(sidik);
  try {
    await pipeline(
      Readable.fromWeb(jawab.body as unknown as WebReadableStream<Uint8Array>),
      ...(tahap as [NodeJS.ReadWriteStream]),
      createWriteStream(jalurKeluar)
    );
  } catch (galat) {
    await rm(jalurKeluar, { force: true }).catch(() => undefined);
    throw galat;
  }
  return { byte: sidik.byte, sha256: sidik.hash.digest("hex"), byteSql: pemeriksa.byteSql, ringkasan: pemeriksa.ringkasan() };
}
