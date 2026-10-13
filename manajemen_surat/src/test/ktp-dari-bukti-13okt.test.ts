// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { halamanBercirKtp, type HasilBacaKtp } from "@/server/modules/aleta-ecourt/ktp-ocr";
import { pindaiKtpPihak, type DepsKtp } from "@/server/modules/aleta-ecourt/ktp-pihak";
import type { BerkasKtpAntri, HasilBacaKtpPihak } from "@/server/modules/aleta-bot/whatsapp-gateway-client";

/**
 * ============================================================================
 * TANGGAL KTP DARI "DOKUMEN BUKTI" e-COURT (13 Okt 2026, butir 14)
 * ============================================================================
 *
 * 228/Pdt.P/2026: 0364/0366 DATA_TIDAK_ADA, 9958 "KTP belum terdeteksi". Dokumen
 * e-Court berjudul "KTP" tidak berberkas (terukur 0 dari 115 permohonan, 10 dari 385
 * gugatan); fotokopi KTP ada di "Dokumen Bukti" (4 halaman pindaian pada 228).
 * Berkas bukti kini ikut antrian, dibaca KETAT: halaman KK / surat keterangan
 * (tanggal "Dikeluarkan" di baris bawah akan terbaca sebagai tanggal KTP) dibuang.
 * Data contoh rekaan, bukan identitas orang.
 */

const AKAR = path.resolve(process.cwd(), "..");
const K = createRequire(path.join(AKAR, "aleta_bot/package.json"))(path.join(AKAR, "aleta_bot/services/ktpPihakService.js")) as {
  bacaKetat: (judul: string) => boolean;
  SQL_KANDIDAT: string;
};

const KTP = [
  "PROVINSI SULAWESI TENGAH",
  "KABUPATEN SIGI",
  "NIK : 7210010101010001",
  "Nama : XXX YYY",
  "Jenis kelamin : LAKI-LAKI Gol. Darah : -",
  "Kewarganegaraan : WNI",
  "Berlaku Hingga : SEUMUR HIDUP",
  "SIGI",
  "12-05-2019",
].join("\n");
const KK = [
  "KARTU KELUARGA",
  "No. 7210010101010099",
  "Nama Kepala Keluarga : XXX YYY",
  "NIK 7210010101010001 Kewarganegaraan WNI",
  "Dikeluarkan Tanggal : 03-04-2021",
].join("\n");
const SURAT = ["SURAT KETERANGAN", "NIK : 7210010101010001", "Kewarganegaraan : Indonesia", "Lembantongoa, 02-09-2026"].join("\n");

describe("halaman berciri KTP", () => {
  it("KTP dipakai; KK dan surat keterangan (meski memuat NIK + tanggal) dibuang", () => {
    expect(halamanBercirKtp(KTP)).toBe(true);
    expect(halamanBercirKtp(KK)).toBe(false);
    expect(halamanBercirKtp(SURAT)).toBe(false);
    expect(halamanBercirKtp("")).toBe(false);
  });
});

describe("bot: Dokumen Bukti ikut antrian, dibaca ketat", () => {
  it("judul bukti = ketat; judul KTP tetap biasa; dokumen lain tidak", () => {
    expect(K.bacaKetat("Dokumen Bukti")).toBe(true);
    expect(K.bacaKetat("Bukti Surat")).toBe(true);
    expect(K.bacaKetat("Alat Bukti")).toBe(true);
    expect(K.bacaKetat("KTP")).toBe(false);
    expect(K.bacaKetat("Surat Kuasa")).toBe(false);
    expect(K.SQL_KANDIDAT).toMatch(/bukti/);
  });

  it("penyapu portal meneruskan tanda ketat ke pembaca", async () => {
    const berkas: BerkasKtpAntri[] = [
      { fileId: "a", documentKey: "a", format: "pdf", ukuran: 10, nomorPerkara: "228/Pdt.P/2026/PA.Dgl", judul: "Dokumen Bukti", ketat: true },
      { fileId: "b", documentKey: "b", format: "pdf", ukuran: 10, nomorPerkara: "228/Pdt.P/2026/PA.Dgl", judul: "KTP" },
    ];
    const ketat: Array<boolean | undefined> = [];
    const kirim: HasilBacaKtpPihak[] = [];
    let t = 0;
    const deps: DepsKtp = {
      antrian: async () => ({ berkas, versi: 2 }),
      ambil: async () => Buffer.from("%PDF"),
      kirim: async (h) => (kirim.push(...h), true),
      baca: async (_d, _b, k) => {
        ketat.push(k);
        return [] as HasilBacaKtp[];
      },
      sekarang: () => (t += 1),
    };
    await pindaiKtpPihak([], deps, { batas: 2 });
    expect(ketat).toEqual([true, false]);
    expect(kirim.map((h) => h.fileId)).toEqual(["a", "b"]);
  });
});
