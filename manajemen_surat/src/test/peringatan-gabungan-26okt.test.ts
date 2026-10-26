// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { PENGATURAN_KESEHATAN_BAWAAN, perbaruiStatus } from "@/server/modules/kesehatan/layanan";
import {
  ajukanPeringatan,
  jendelaGabungMenit,
  KUNCI_PERINGATAN_TERTUNDA,
  lepasPeringatanTertunda,
  susunPesanGabungan,
  type BagianPeringatan,
} from "@/server/modules/kesehatan/peringatan-gabungan";
import { bacaSetelanSistem } from "@/server/modules/kesehatan/setelan";

/**
 * Peringatan WhatsApp gabungan (26 Okt 2026): Pusat kesehatan (E2) dan penjaga integritas (E6) yang punya temuan
 * di jendela yang sama dikirim SATU pesan. Semua saklar WhatsApp tetap mati bawaan; modul ini hanya dipanggil
 * pengirim yang saklarnya sudah menyala. Pengirim di sini disuntik (tanpa WhatsApp sungguhan).
 */

let db: AletaDatabase;
const KINI = new Date("2026-10-26T01:00:00.000Z");
const menit = (m: number) => new Date(KINI.getTime() + m * 60_000);
const SA = { id: "u-sa", nama: "SA", nomor: "081200000001" };
const ADM = { id: "u-admin", nama: "Admin", nomor: "081200000002" };
const penerima = async (_d: AletaDatabase, tingkat: "admin" | "super-admin") => (tingkat === "super-admin" ? [SA] : [SA, ADM]);

type Kiriman = { ke: string[]; pesan: string; kunci: string };
function pengirim(hasil: { terkirim: number; gagal: number } | null = null) {
  const kiriman: Kiriman[] = [];
  const kirim = async (p: Array<{ id: string }>, pesan: string, kunci: string) => {
    kiriman.push({ ke: p.map((x) => x.id), pesan, kunci });
    return hasil ?? { terkirim: p.length, gagal: 0 };
  };
  return { kiriman, kirim };
}

beforeAll(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: false });
}, 300_000);
afterAll(async () => db?.close());
beforeEach(async () => {
  await db.run("DELETE FROM aleta_ekstensi_setelan");
});

const kesehatan = (teks = "Pusat kesehatan ALETA (01:00 UTC)\nMERAH: Bot. mati") => ({ sumber: "kesehatan" as const, teks, penerima: "admin" as const, kunci: "k1" });
const integritas = (teks = "PERINGATAN KEAMANAN website/server satker: 2 hal baru") => ({ sumber: "integritas" as const, teks, penerima: "admin" as const, kunci: "i1" });

describe("jendela", () => {
  it("bawaan 5 menit; 0 dan angka sah dihormati; sampah kembali ke bawaan", () => {
    expect(jendelaGabungMenit({})).toBe(5);
    expect(jendelaGabungMenit({ ALETA_PERINGATAN_GABUNG_MENIT: "0" })).toBe(0);
    expect(jendelaGabungMenit({ ALETA_PERINGATAN_GABUNG_MENIT: "10" })).toBe(10);
    expect(jendelaGabungMenit({ ALETA_PERINGATAN_GABUNG_MENIT: "abc" })).toBe(5);
    expect(jendelaGabungMenit({ ALETA_PERINGATAN_GABUNG_MENIT: "-3" })).toBe(5);
  });
});

describe("penggabungan", () => {
  it("jendela 0: dikirim langsung per pengirim, persis seperti sebelum penggabungan (pesan apa adanya)", async () => {
    const { kiriman, kirim } = pengirim();
    const h = await ajukanPeringatan(db, kesehatan(), { kini: KINI, jendelaMenit: 0, kirim, penerima });
    expect(h).toMatchObject({ status: "terkirim", terkirim: 2 });
    expect(kiriman).toHaveLength(1);
    expect(kiriman[0].pesan).toBe("Pusat kesehatan ALETA (01:00 UTC)\nMERAH: Bot. mati");
    expect(kiriman[0].kunci).toBe("k1");
  });

  it("keduanya punya temuan di jendela yang sama: SATU pesan memuat dua bagian, dikirim saat bagian kedua tiba", async () => {
    const { kiriman, kirim } = pengirim();
    const a = await ajukanPeringatan(db, integritas(), { kini: KINI, jendelaMenit: 5, kirim, penerima });
    expect(a).toMatchObject({ status: "ditunda", terkirim: 0 });
    expect(kiriman).toHaveLength(0);
    expect(await bacaSetelanSistem(db, KUNCI_PERINGATAN_TERTUNDA)).toContain("integritas");

    const b = await ajukanPeringatan(db, kesehatan(), { kini: menit(2), jendelaMenit: 5, kirim, penerima });
    expect(b).toMatchObject({ status: "terkirim", terkirim: 2 });
    expect([...b.sumber].sort()).toEqual(["integritas", "kesehatan"]);
    expect(kiriman).toHaveLength(1);
    expect(kiriman[0].ke).toEqual(["u-sa", "u-admin"]);
    expect(kiriman[0].pesan).toContain("Peringatan sistem ALETA");
    expect(kiriman[0].pesan).toContain("PERINGATAN KEAMANAN");
    expect(kiriman[0].pesan).toContain("MERAH: Bot");
    expect(kiriman[0].kunci).toMatch(/^gabungan-/);
    expect(await bacaSetelanSistem(db, KUNCI_PERINGATAN_TERTUNDA)).toBeNull();
  });

  it("urutan terbalik (kesehatan dulu) memberi hasil sama: satu pesan", async () => {
    const { kiriman, kirim } = pengirim();
    await ajukanPeringatan(db, kesehatan(), { kini: KINI, jendelaMenit: 5, kirim, penerima });
    await ajukanPeringatan(db, integritas(), { kini: menit(1), jendelaMenit: 5, kirim, penerima });
    expect(kiriman).toHaveLength(1);
    expect(kiriman[0].pesan.indexOf("MERAH")).toBeGreaterThan(-1);
    expect(kiriman[0].pesan.indexOf("PERINGATAN KEAMANAN")).toBeGreaterThan(-1);
  });

  it("hanya satu pengirim yang punya temuan: ditahan sampai jendela habis lalu dikirim sendirian (isi apa adanya)", async () => {
    const { kiriman, kirim } = pengirim();
    await ajukanPeringatan(db, integritas(), { kini: KINI, jendelaMenit: 5, kirim, penerima });
    expect(await lepasPeringatanTertunda(db, { kini: menit(4), jendelaMenit: 5, kirim, penerima })).toBeNull();
    expect(kiriman).toHaveLength(0);
    const h = await lepasPeringatanTertunda(db, { kini: menit(5), jendelaMenit: 5, kirim, penerima });
    expect(h).toMatchObject({ status: "terkirim", sumber: ["integritas"] });
    expect(kiriman).toHaveLength(1);
    expect(kiriman[0].pesan).toBe("PERINGATAN KEAMANAN website/server satker: 2 hal baru");
    expect(await lepasPeringatanTertunda(db, { kini: menit(6), jendelaMenit: 5, kirim, penerima })).toBeNull();
  });

  it("temuan di luar jendela tidak digabung: dua pesan terpisah", async () => {
    const { kiriman, kirim } = pengirim();
    await ajukanPeringatan(db, integritas(), { kini: KINI, jendelaMenit: 5, kirim, penerima });
    await lepasPeringatanTertunda(db, { kini: menit(5), jendelaMenit: 5, kirim, penerima });
    await ajukanPeringatan(db, kesehatan(), { kini: menit(30), jendelaMenit: 5, kirim, penerima });
    await lepasPeringatanTertunda(db, { kini: menit(35), jendelaMenit: 5, kirim, penerima });
    expect(kiriman).toHaveLength(2);
  });

  it("penerima dihormati: bagian untuk Super Admin saja tidak sampai ke Admin; Admin tetap menerima bagian integritas sendirian", async () => {
    const { kiriman, kirim } = pengirim();
    await ajukanPeringatan(db, { ...kesehatan(), penerima: "super-admin" }, { kini: KINI, jendelaMenit: 5, kirim, penerima });
    await ajukanPeringatan(db, integritas(), { kini: menit(1), jendelaMenit: 5, kirim, penerima });
    const keSa = kiriman.find((k) => k.ke.includes("u-sa"));
    const keAdmin = kiriman.find((k) => k.ke.includes("u-admin") && !k.ke.includes("u-sa"));
    expect(kiriman).toHaveLength(2);
    expect(keSa?.pesan).toContain("MERAH: Bot");
    expect(keSa?.pesan).toContain("PERINGATAN KEAMANAN");
    expect(keAdmin?.ke).toEqual(["u-admin"]);
    expect(keAdmin?.pesan).toBe("PERINGATAN KEAMANAN website/server satker: 2 hal baru");
    expect(keAdmin?.pesan).not.toContain("MERAH");
  });

  it("gagal kirim ke semua: pemanggil mengulang sendiri; bagian pengirim lain ditahan lalu dicoba lagi", async () => {
    const gagal = pengirim({ terkirim: 0, gagal: 2 });
    await ajukanPeringatan(db, kesehatan(), { kini: KINI, jendelaMenit: 5, kirim: gagal.kirim, penerima });
    const h = await ajukanPeringatan(db, integritas(), { kini: menit(1), jendelaMenit: 5, kirim: gagal.kirim, penerima });
    expect(h).toMatchObject({ status: "gagal", terkirim: 0 });
    // bagian kesehatan tetap ditahan (percobaan 1); belum lewat jendela dari awalnya -> belum keluar
    const ok = pengirim();
    expect(await lepasPeringatanTertunda(db, { kini: menit(2), jendelaMenit: 5, kirim: ok.kirim, penerima })).toBeNull();
    const l2 = await lepasPeringatanTertunda(db, { kini: menit(6), jendelaMenit: 5, kirim: ok.kirim, penerima });
    expect(l2).toMatchObject({ status: "terkirim", sumber: ["kesehatan"] });
    expect(ok.kiriman).toHaveLength(1);
  });

  it("gagal terus: bagian yang ditahan dibuang setelah 3 percobaan, tidak berulang tanpa ujung", async () => {
    const gagal = pengirim({ terkirim: 0, gagal: 2 });
    await ajukanPeringatan(db, kesehatan(), { kini: KINI, jendelaMenit: 5, kirim: gagal.kirim, penerima });
    await ajukanPeringatan(db, integritas(), { kini: menit(1), jendelaMenit: 5, kirim: gagal.kirim, penerima }); // percobaan 1
    await lepasPeringatanTertunda(db, { kini: menit(6), jendelaMenit: 5, kirim: gagal.kirim, penerima }); // 2
    await lepasPeringatanTertunda(db, { kini: menit(7), jendelaMenit: 5, kirim: gagal.kirim, penerima }); // 3 -> dibuang
    expect(await bacaSetelanSistem(db, KUNCI_PERINGATAN_TERTUNDA)).toBeNull();
  });

  it("tanpa penerima sama sekali: dianggap selesai (tidak berulang tanpa ujung) dan tidak ada yang dikirim", async () => {
    const { kiriman, kirim } = pengirim();
    const h = await ajukanPeringatan(db, integritas(), { kini: KINI, jendelaMenit: 0, kirim, penerima: async () => [] });
    expect(h.status).toBe("terkirim");
    expect(kiriman).toHaveLength(0);
  });

  it("bagian dari sumber yang sama yang datang dua kali digabung ke satu bagian", async () => {
    const { kiriman, kirim } = pengirim();
    await ajukanPeringatan(db, kesehatan("A"), { kini: KINI, jendelaMenit: 5, kirim, penerima });
    await ajukanPeringatan(db, kesehatan("B"), { kini: menit(1), jendelaMenit: 5, kirim, penerima });
    await ajukanPeringatan(db, integritas("C"), { kini: menit(2), jendelaMenit: 5, kirim, penerima });
    expect(kiriman).toHaveLength(1);
    expect(kiriman[0].pesan).toContain("A\nB");
    expect(kiriman[0].pesan).toContain("C");
  });

  it("susunPesanGabungan: satu bagian apa adanya, dua bagian dengan judul bersama", () => {
    const b = (sumber: "kesehatan" | "integritas", teks: string): BagianPeringatan => ({ sumber, teks, penerima: "admin", kunci: "x", pada: KINI.toISOString(), percobaan: 0 });
    expect(susunPesanGabungan([b("kesehatan", "satu")], KINI)).toBe("satu");
    expect(susunPesanGabungan([b("kesehatan", "satu"), b("integritas", "dua")], KINI)).toBe("Peringatan sistem ALETA (01:00 UTC)\n\nsatu\n\ndua");
  });
});

describe("tersambung ke Pusat kesehatan", () => {
  const hasil = (warna: string) =>
    ({ warna, komponen: [{ kunci: "bot", nama: "Bot", warna, ringkas: "mati", kelompok: "layanan" }] }) as unknown as Parameters<typeof perbaruiStatus>[1];
  const pengaturan = { ...PENGATURAN_KESEHATAN_BAWAAN, wa: true, berkala: true, penerima: "admin" as const };

  it("saklar wa menyala dan jendela > 0: pesan ditahan (dikirim = null) lalu keluar saat jendela habis", async () => {
    vi.stubEnv("ALETA_PERINGATAN_GABUNG_MENIT", "5");
    try {
      const { kiriman, kirim } = pengirim();
      await perbaruiStatus(db, hasil("merah"), { pengaturan, kirim, kini: KINI });
      const h = await perbaruiStatus(db, hasil("merah"), { pengaturan, kirim, kini: menit(1) });
      expect(h.peringatan).toEqual(["bot"]);
      expect(h.dikirim).toBeNull();
      expect(kiriman).toHaveLength(0);
      const keluar = await lepasPeringatanTertunda(db, { kini: menit(7), kirim, penerima });
      expect(keluar).toMatchObject({ status: "terkirim", sumber: ["kesehatan"] });
      expect(kiriman[0].pesan).toContain("MERAH: Bot. mati");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("saklar wa mati (bawaan): tidak ada yang ditahan dan tidak ada yang dikirim", async () => {
    vi.stubEnv("ALETA_PERINGATAN_GABUNG_MENIT", "5");
    try {
      const { kiriman, kirim } = pengirim();
      await perbaruiStatus(db, hasil("merah"), { pengaturan: { ...pengaturan, wa: false }, kirim, kini: menit(20) });
      await perbaruiStatus(db, hasil("merah"), { pengaturan: { ...pengaturan, wa: false }, kirim, kini: menit(21) });
      expect(await bacaSetelanSistem(db, KUNCI_PERINGATAN_TERTUNDA)).toBeNull();
      expect(kiriman).toHaveLength(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
