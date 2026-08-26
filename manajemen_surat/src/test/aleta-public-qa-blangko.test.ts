// @vitest-environment node

import { promises as fs } from "fs";
import path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type AletaDatabase, createAletaDatabase } from "@/server/db/client";
import {
  getAletaBotSnapshot,
  syncAletaBotRuntimeConfigFromDb,
  updateAletaBotPublicQaIntent,
} from "@/server/modules/aleta-bot/service";

/**
 * Blangko jawaban dan kata kunci pengenal untuk Aturan Jawaban publik.
 *
 * Sebelumnya jawaban hanya bisa datang dari jalur lama atau kalimat bawaan
 * sistem, sehingga admin tidak punya cara menyusun sendiri jawaban untuk
 * pertanyaan seperti akta cerai atau biaya. Kata kunci pengenal pun dipaku di
 * kode dan hanya berlaku untuk aturan bawaan.
 */
let db: AletaDatabase | null = null;

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
});

afterEach(async () => {
  await db?.close();
  db = null;
});

/** Membaca lewat snapshot resmi, jalur yang sama dipakai halaman portal. */
async function daftarAturan() {
  return (await getAletaBotSnapshot(db!, "usr-super")).publicQaIntents;
}

async function aturanPertama() {
  const daftar = await daftarAturan();
  const target = daftar.find((item) => item.key === "cek_akta_cerai") ?? daftar[0];
  expect(target).toBeTruthy();
  return target;
}

describe("blangko jawaban tersimpan dan terbaca", () => {
  it("menyimpan blangko jawaban dan kata kunci yang diisi admin", async () => {
    const asli = await aturanPertama();

    await updateAletaBotPublicQaIntent(db!, {
      actorUserId: "usr-super",
      intent: {
        ...asli,
        answerTemplate: "Akta cerai dapat diambil 14 hari setelah putusan berkekuatan hukum tetap.",
        matchKeywords: ["akta", "akte cerai", "ambil akta"],
      },
    });

    const sesudah = (await daftarAturan()).find((item) => item.id === asli.id);
    expect(sesudah?.answerTemplate).toBe(
      "Akta cerai dapat diambil 14 hari setelah putusan berkekuatan hukum tetap."
    );
    expect(sesudah?.matchKeywords).toEqual(["akta", "akte cerai", "ambil akta"]);
  });

  it("merapikan kata kunci: dikecilkan, dipangkas, yang kosong dibuang", async () => {
    const asli = await aturanPertama();

    await updateAletaBotPublicQaIntent(db!, {
      actorUserId: "usr-super",
      intent: { ...asli, matchKeywords: ["  AKTA  ", "Akte Cerai", "", "   "] },
    });

    const sesudah = (await daftarAturan()).find((item) => item.id === asli.id);
    expect(sesudah?.matchKeywords).toEqual(["akta", "akte cerai"]);
  });

  it("blangko yang sangat panjang dipotong, bukan ditolak diam-diam", async () => {
    const asli = await aturanPertama();

    await updateAletaBotPublicQaIntent(db!, {
      actorUserId: "usr-super",
      intent: { ...asli, answerTemplate: "A".repeat(5000) },
    });

    const sesudah = (await daftarAturan()).find((item) => item.id === asli.id);
    // Dikirim lewat WhatsApp, jadi panjangnya dibatasi.
    expect(sesudah?.answerTemplate.length).toBe(4000);
  });

  it("aturan tanpa blangko tetap sah", async () => {
    const asli = await aturanPertama();

    await updateAletaBotPublicQaIntent(db!, {
      actorUserId: "usr-super",
      intent: { ...asli, answerTemplate: "", matchKeywords: [] },
    });

    const sesudah = (await daftarAturan()).find((item) => item.id === asli.id);
    expect(sesudah?.answerTemplate).toBe("");
    expect(sesudah?.matchKeywords).toEqual([]);
  });
});

describe("blangko diteruskan ke ALETA Bot", () => {
  it("ikut terkirim di konfigurasi runtime", async () => {
    const asli = await aturanPertama();

    await updateAletaBotPublicQaIntent(db!, {
      actorUserId: "usr-super",
      intent: {
        ...asli,
        answerTemplate: "Silakan ambil akta cerai di PTSP.",
        matchKeywords: ["akta cerai"],
      },
    });

    await syncAletaBotRuntimeConfigFromDb(db!);
    const berkas = path.join(process.cwd(), "data", "aleta-bot-runtime.json");
    const konfigurasi = JSON.parse(await fs.readFile(berkas, "utf8")) as {
      publicQaIntents?: { key: string; answerTemplate?: string; matchKeywords?: string[] }[];
    };

    const terkirim = (konfigurasi.publicQaIntents ?? []).find((item) => item.key === asli.key);
    // Tanpa ini blangko tersimpan di portal tetapi bot tidak pernah memakainya.
    expect(terkirim?.answerTemplate).toBe("Silakan ambil akta cerai di PTSP.");
    expect(terkirim?.matchKeywords).toEqual(["akta cerai"]);
  });
});

describe("aturan jawaban tidak lagi mengenal draft", () => {
  it("aturan yang disimpan langsung berlaku", async () => {
    const asli = await aturanPertama();

    await updateAletaBotPublicQaIntent(db!, {
      actorUserId: "usr-super",
      intent: { ...asli, answerTemplate: "Jawaban berlaku langsung." },
    });

    const sesudah = (await daftarAturan()).find((item) => item.id === asli.id);
    expect(sesudah?.status).toBe("active");
    expect(sesudah?.isActive).toBe(true);
  });

  it("tidak menyisakan satu pun aturan berstatus draft", async () => {
    const daftar = await daftarAturan();
    expect(daftar.filter((item) => item.status === "draft")).toHaveLength(0);
  });
});
