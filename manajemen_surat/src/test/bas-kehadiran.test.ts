import { afterEach, describe, expect, it } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import {
  muatKehadiran,
  penandaDariKehadiran,
  semuaKehadiran,
  simpanKehadiran,
  type Kehadiran,
} from "@/server/modules/aleta-ecourt/bas-kehadiran";

/**
 * Kehadiran para pihak pada satu sidang.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Kehadiran adalah satu-satunya isian BAS yang tidak dapat dibaca dari mana
 * pun: SIPP mencatat "dihadiri oleh 2" sebagai angka, tanpa menyebut siapa.
 *
 * Dua kekeliruan yang paling berbahaya, dan keduanya diam:
 *
 *   - kehadiran satu sidang terbawa ke BAS sidang lain, dan
 *   - kehadiran yang KOSONG diisi tebakan.
 *
 * Keduanya menghasilkan BAS yang menyatakan seseorang hadir di persidangan
 * yang tidak pernah ia datangi.
 */

let db: AletaDatabase | null = null;

async function basisData() {
  db = await createAletaDatabase({ useInMemory: true, seed: false, runMigrations: false });
  return db;
}

const PERKARA = "10102";

afterEach(async () => {
  await db?.close();
  db = null;
});

describe("menyimpan kehadiran", () => {
  it("tersimpan dan terbaca kembali", async () => {
    const database = await basisData();
    await simpanKehadiran(database, "uji-panitera", {
      perkaraId: PERKARA,
      nomorPerkara: "551/Pdt.G/2026/PA.Dgl",
      sidangKe: 1,
      kehadiranPenggugat: "hadir secara pribadi",
      kehadiranTergugat: "tidak hadir dan tidak pula menyuruh orang lain sebagai wakil/kuasanya",
      agenda: "Sidang Pertama",
    });

    const isi = await muatKehadiran(database, PERKARA, 1);
    expect(isi?.kehadiranPenggugat).toBe("hadir secara pribadi");
    expect(isi?.kehadiranTergugat).toContain("tidak hadir");
    expect(isi?.agenda).toBe("Sidang Pertama");
  });

  it("tiap sidang punya catatannya sendiri", async () => {
    // Kehadiran berubah dari satu sidang ke sidang berikutnya - itulah sebabnya
    // ia ada. Yang terbawa antarsidang menghasilkan BAS yang menyatakan
    // seseorang hadir di persidangan yang tidak pernah ia datangi.
    const database = await basisData();
    await simpanKehadiran(database, "uji", { perkaraId: PERKARA, sidangKe: 1, kehadiranTergugat: "tidak hadir" });
    await simpanKehadiran(database, "uji", { perkaraId: PERKARA, sidangKe: 2, kehadiranTergugat: "hadir secara pribadi" });

    expect((await muatKehadiran(database, PERKARA, 1))?.kehadiranTergugat).toBe("tidak hadir");
    expect((await muatKehadiran(database, PERKARA, 2))?.kehadiranTergugat).toBe("hadir secara pribadi");
    expect(await semuaKehadiran(database, PERKARA)).toHaveLength(2);
  });

  it("menyimpan dua kali pada sidang yang sama tidak menggandakan barisnya", async () => {
    const database = await basisData();
    await simpanKehadiran(database, "uji", { perkaraId: PERKARA, sidangKe: 1, kehadiranPenggugat: "a" });
    await simpanKehadiran(database, "uji", { perkaraId: PERKARA, sidangKe: 1, kehadiranPenggugat: "b" });

    const semua = await semuaKehadiran(database, PERKARA);
    expect(semua).toHaveLength(1);
    expect(semua[0].kehadiranPenggugat).toBe("b");
  });

  it("tanpa perkara atau tanpa nomor sidang ditolak", async () => {
    const database = await basisData();
    await expect(simpanKehadiran(database, "uji", { perkaraId: "", sidangKe: 1 })).rejects.toThrow(/tidak dikenali/i);
    await expect(simpanKehadiran(database, "uji", { perkaraId: PERKARA, sidangKe: 0 })).rejects.toThrow(/belum ditentukan/i);
  });

  it("sidang yang belum dicatat mengembalikan kosong, bukan galat", async () => {
    const database = await basisData();
    expect(await muatKehadiran(database, PERKARA, 9)).toBeNull();
    expect(await semuaKehadiran(database, "99999")).toEqual([]);
  });
});

describe("kehadiran menjadi penanda blangko", () => {
  function catatan(sebagian: Partial<Kehadiran> = {}): Kehadiran {
    return {
      perkaraId: PERKARA,
      nomorPerkara: "551/Pdt.G/2026/PA.Dgl",
      sidangKe: 1,
      kehadiranPenggugat: "hadir secara pribadi",
      kehadiranTergugat: "tidak hadir tanpa alasan yang sah",
      agenda: "Sidang Pertama",
      hasil: "",
      catatan: "",
      diubahOleh: "uji",
      diubahAt: "2026-09-05T00:00:00.000Z",
      ...sebagian,
    };
  }

  it("mengisi penanda kehadiran kedua pihak", async () => {
    // 1072 "Kehadiran #0046#", 1073 "Kehadiran #0047#" - dari abt_variabel.
    const peta = penandaDariKehadiran(catatan());
    expect(peta.get("1072")?.nilai).toBe("hadir secara pribadi");
    expect(peta.get("1073")?.nilai).toBe("tidak hadir tanpa alasan yang sah");
  });

  it("kehadiran yang kosong TIDAK diisi tebakan", async () => {
    // Penanda yang dibiarkan masih terlihat; kalimat yang ditebak terbaca wajar
    // dan tidak ada yang memeriksanya lagi.
    const peta = penandaDariKehadiran(catatan({ kehadiranTergugat: "" }));
    expect(peta.get("1072")?.nilai).toBe("hadir secara pribadi");
    expect(peta.has("1073")).toBe(false);
  });

  it("tanpa catatan sama sekali tidak ada penanda yang diisi", async () => {
    expect(penandaDariKehadiran(null).size).toBe(0);
  });

  it("asal penanda menyebut sidang ke berapa", async () => {
    const peta = penandaDariKehadiran(catatan({ sidangKe: 3 }));
    expect(peta.get("1072")?.asal).toContain("sidang ke-3");
  });

  it("catatan tersimpan terbaca kembali sebagai penanda", async () => {
    const database = await basisData();
    await simpanKehadiran(database, "uji", {
      perkaraId: PERKARA,
      sidangKe: 2,
      kehadiranPenggugat: "hadir didampingi kuasanya",
    });

    const peta = penandaDariKehadiran(await muatKehadiran(database, PERKARA, 2));
    expect(peta.get("1072")?.nilai).toBe("hadir didampingi kuasanya");
  });
});
