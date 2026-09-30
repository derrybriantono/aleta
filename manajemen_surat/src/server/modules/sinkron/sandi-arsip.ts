import { createCipheriv, createDecipheriv, randomBytes, scryptSync, type CipherGCM, type DecipherGCM } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { open, rm, stat } from "node:fs/promises";
import { Transform, type TransformCallback } from "node:stream";
import { pipeline } from "node:stream/promises";

/**
 * Penyandian arsip cadangan basis data - AES-256-GCM, kunci dari scrypt.
 *
 * ============================================================================
 * BENTUK BERKAS "ALETASNK" VERSI 1 (juga dibaca tools/sinkron-laptop)
 * ============================================================================
 *
 *   0   8  "ALETASNK"            penanda
 *   8   1  0x01                  versi
 *   9   1  0x01                  KDF = scrypt
 *   10  1  log2(N)               15 -> N = 32768
 *   11  1  r                     8
 *   12  1  p                     1
 *   13 16  garam                 acak per berkas
 *   29 12  IV                    acak per berkas
 *   41  -  isi tersandi
 *   -16 16 tag GCM               di ujung berkas
 *
 * Kepala 41 byte ikut diautentikasi (AAD): mengubah satu byte parameter pun
 * membuat pembukaan gagal, bukan menghasilkan sampah diam-diam.
 *
 * Kata sandi TIDAK PERNAH ditulis ke berkas, log, atau jawaban API. Yang
 * disimpan pengaturan hanya bentuk tersandinya (encryptCredentialSecret),
 * sebab jadwal otomatis membutuhkannya tanpa admin di depan layar.
 */

export const PENANDA_SANDI = Buffer.from("ALETASNK", "ascii");
export const PANJANG_KEPALA = 41;
export const PANJANG_TAG = 16;
export const AKHIRAN_SANDI = ".aleta-enc";

const LOG_N = 15;
const R = 8;
const P = 1;

function turunkanKunci(sandi: string, garam: Buffer, logN: number, r: number, p: number) {
  if (!sandi) throw new Error("Kata sandi arsip kosong.");
  if (logN < 10 || logN > 20 || r < 1 || r > 32 || p < 1 || p > 16) {
    throw new Error("Parameter kunci pada kepala arsip tidak wajar - berkas rusak atau bukan arsip ALETA.");
  }
  const N = 2 ** logN;
  return scryptSync(sandi, garam, 32, { N, r, p, maxmem: 256 * N * r + 1024 * 1024 });
}

function susunKepala(garam: Buffer, iv: Buffer) {
  return Buffer.concat([PENANDA_SANDI, Buffer.from([1, 1, LOG_N, R, P]), garam, iv]);
}

export function bacaKepala(kepala: Buffer) {
  if (kepala.length < PANJANG_KEPALA || !kepala.subarray(0, 8).equals(PENANDA_SANDI)) {
    throw new Error("Bukan arsip tersandi ALETA (penanda ALETASNK tidak ada).");
  }
  if (kepala[8] !== 1 || kepala[9] !== 1) throw new Error(`Versi arsip tersandi tidak dikenal (${kepala[8]}).`);
  return {
    logN: kepala[10],
    r: kepala[11],
    p: kepala[12],
    garam: kepala.subarray(13, 29),
    iv: kepala.subarray(29, 41),
    kepala: kepala.subarray(0, PANJANG_KEPALA),
  };
}

/** Aliran penyandi: kepala di depan, tag di belakang. */
export class AliranSandi extends Transform {
  private readonly penyandi: CipherGCM;
  private readonly kepala: Buffer;
  private kepalaTerkirim = false;

  constructor(sandi: string) {
    super();
    const garam = randomBytes(16);
    const iv = randomBytes(12);
    this.kepala = susunKepala(garam, iv);
    this.penyandi = createCipheriv("aes-256-gcm", turunkanKunci(sandi, garam, LOG_N, R, P), iv);
    this.penyandi.setAAD(this.kepala);
  }

  private kirimKepala() {
    if (!this.kepalaTerkirim) {
      this.push(this.kepala);
      this.kepalaTerkirim = true;
    }
  }

  _transform(potong: Buffer, _enc: BufferEncoding, selesai: TransformCallback) {
    this.kirimKepala();
    selesai(null, this.penyandi.update(potong));
  }

  _flush(selesai: TransformCallback) {
    this.kirimKepala();
    this.push(this.penyandi.final());
    this.push(this.penyandi.getAuthTag());
    selesai();
  }
}

export function sandikanBuffer(isi: Buffer, sandi: string): Buffer {
  const garam = randomBytes(16);
  const iv = randomBytes(12);
  const kepala = susunKepala(garam, iv);
  const c = createCipheriv("aes-256-gcm", turunkanKunci(sandi, garam, LOG_N, R, P), iv);
  c.setAAD(kepala);
  return Buffer.concat([kepala, c.update(isi), c.final(), c.getAuthTag()]);
}

export function bukaSandiBuffer(berkas: Buffer, sandi: string): Buffer {
  const k = bacaKepala(berkas.subarray(0, PANJANG_KEPALA));
  if (berkas.length < PANJANG_KEPALA + PANJANG_TAG) throw new Error("Arsip tersandi terpotong.");
  const d = createDecipheriv("aes-256-gcm", turunkanKunci(sandi, k.garam, k.logN, k.r, k.p), k.iv);
  d.setAAD(k.kepala);
  d.setAuthTag(berkas.subarray(berkas.length - PANJANG_TAG));
  try {
    return Buffer.concat([d.update(berkas.subarray(PANJANG_KEPALA, berkas.length - PANJANG_TAG)), d.final()]);
  } catch {
    throw new Error("Kata sandi salah atau arsip rusak (tag GCM tidak cocok).");
  }
}

/** Menyandikan satu berkas ke berkas lain secara mengalir. */
export async function sandikanBerkas(masuk: string, keluar: string, sandi: string) {
  await pipeline(createReadStream(masuk), new AliranSandi(sandi), createWriteStream(keluar));
}

/**
 * Membuka berkas tersandi. Tag dibaca dari ujung berkas lebih dulu, lalu
 * isinya dialirkan - arsip SIPP beberapa GB tidak pernah dimuat utuh ke
 * memori. Keluaran yang gagal diautentikasi DIHAPUS: berkas separuh-terbuka
 * dengan isi yang belum terbukti utuh tidak boleh tertinggal.
 */
export async function bukaSandiBerkas(masuk: string, keluar: string, sandi: string) {
  const info = await stat(masuk);
  if (info.size < PANJANG_KEPALA + PANJANG_TAG) throw new Error("Arsip tersandi terpotong.");
  const pegangan = await open(masuk, "r");
  const kepala = Buffer.alloc(PANJANG_KEPALA);
  const tag = Buffer.alloc(PANJANG_TAG);
  try {
    await pegangan.read(kepala, 0, PANJANG_KEPALA, 0);
    await pegangan.read(tag, 0, PANJANG_TAG, info.size - PANJANG_TAG);
  } finally {
    await pegangan.close();
  }
  const k = bacaKepala(kepala);
  const d: DecipherGCM = createDecipheriv("aes-256-gcm", turunkanKunci(sandi, k.garam, k.logN, k.r, k.p), k.iv);
  d.setAAD(k.kepala);
  d.setAuthTag(tag);
  try {
    if (info.size === PANJANG_KEPALA + PANJANG_TAG) {
      await pipeline(
        async function* () {
          yield d.final();
        },
        createWriteStream(keluar)
      );
    } else {
      await pipeline(
        createReadStream(masuk, { start: PANJANG_KEPALA, end: info.size - PANJANG_TAG - 1 }),
        d,
        createWriteStream(keluar)
      );
    }
  } catch {
    await rm(keluar, { force: true }).catch(() => undefined);
    throw new Error("Kata sandi salah atau arsip rusak (tag GCM tidak cocok).");
  }
}

/** Sidik sandi untuk dicocokkan di layar ("sandi yang sama dengan kemarin?") tanpa menyimpan sandinya. */
export function petunjukSandi(sandi: string) {
  if (!sandi) return "";
  return `${sandi.length} aksara`;
}
