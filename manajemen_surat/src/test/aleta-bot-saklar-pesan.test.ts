// @vitest-environment node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  BAWAAN_KIRIM_SAAT_LENGKAP,
  KATALOG_PESAN_BOT,
  gabungkanKatalogPesanBot,
  pesanDimatikan,
  rapikanKirimSaatLengkap,
  rapikanPesanNonaktif,
  setelPesan,
} from "@/lib/katalog-pesan-bot";
import { type AletaDatabase, createAletaDatabase } from "@/server/db/client";
import { getAletaBotSettings, updateAletaBotSettings } from "@/server/modules/aleta-bot/service";

/**
 * Kirim saat data lengkap, dan saklar per pesan - dari layar sampai berkas
 * runtime yang dibaca bot.
 *
 * Yang dijaga: setelan tersimpan lalu terbaca kembali APA ADANYA (termasuk
 * kedua saklar pegawai/pihak yang sebelumnya luput dari SELECT), angka di
 * luar rentang dijepit, saklar universal hanya menyala bila disebut menyala
 * secara tegas, dan seluruhnya sampai ke berkas runtime bot.
 */
describe("saklar pesan ALETA Bot", () => {
  let db: AletaDatabase | null = null;
  const previousRuntimeMode = process.env.WHATSAPP_RUNTIME_MODE;

  beforeAll(async () => {
    process.env.WHATSAPP_RUNTIME_MODE = "disabled";
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    await getAletaBotSettings(db);
  }, 120000);

  afterAll(async () => {
    await db?.close();
    db = null;
    if (previousRuntimeMode === undefined) {
      delete process.env.WHATSAPP_RUNTIME_MODE;
    } else {
      process.env.WHATSAPP_RUNTIME_MODE = previousRuntimeMode;
    }
  });

  it("bawaannya: fitur mati, tidak ada pesan yang dimatikan", async () => {
    const settings = await getAletaBotSettings(db!);
    expect(settings.kirimSaatLengkap).toEqual(BAWAAN_KIRIM_SAAT_LENGKAP);
    expect(settings.kirimSaatLengkap.enabled).toBe(false);
    expect(settings.pesanNonaktif).toEqual({ pegawai: [], pihak: [] });
  });

  it("menyimpan dan membaca kembali kirim-saat-lengkap serta saklar per pesan", async () => {
    const snapshot = await updateAletaBotSettings(db!, {
      actorUserId: "usr-super",
      payload: {
        kirimSaatLengkap: { enabled: true, pegawai: true, pihak: false, jendelaHari: 21, intervalMenit: 30 },
        pesanNonaktif: { pegawai: ["pegawai-kasir-harian"], pihak: ["pihak-sisa-panjar", "pihak-sisa-panjar"] },
      },
    });

    expect(snapshot.settings.kirimSaatLengkap).toEqual({
      enabled: true,
      pegawai: true,
      pihak: false,
      jendelaHari: 21,
      intervalMenit: 30,
    });
    expect(snapshot.settings.pesanNonaktif).toEqual({
      pegawai: ["pegawai-kasir-harian"],
      pihak: ["pihak-sisa-panjar"],
    });

    const row = await db!
      .prepare(`SELECT kirim_saat_lengkap_json, pesan_nonaktif_json FROM aleta_bot_settings WHERE id = 1`)
      .get<{ kirim_saat_lengkap_json: string; pesan_nonaktif_json: string }>();
    expect(JSON.parse(row!.kirim_saat_lengkap_json).jendelaHari).toBe(21);
    expect(JSON.parse(row!.pesan_nonaktif_json).pihak).toEqual(["pihak-sisa-panjar"]);

    const dibaca = await getAletaBotSettings(db!);
    expect(dibaca.kirimSaatLengkap.pihak).toBe(false);
    expect(dibaca.pesanNonaktif.pegawai).toEqual(["pegawai-kasir-harian"]);
  }, 90000);

  it("setelan sebagian digabung ke yang tersimpan, dan angka dijepit", async () => {
    const snapshot = await updateAletaBotSettings(db!, {
      actorUserId: "usr-super",
      payload: {
        kirimSaatLengkap: { jendelaHari: 500, intervalMenit: 1 } as never,
      },
    });
    // enabled dan pihak dari penyimpanan sebelumnya tetap; angkanya dijepit.
    expect(snapshot.settings.kirimSaatLengkap).toEqual({
      enabled: true,
      pegawai: true,
      pihak: false,
      jendelaHari: 90,
      intervalMenit: 5,
    });
  }, 90000);

  it("saklar pegawai/pihak yang dimatikan TERBACA mati - bukan diam-diam kembali menyala", async () => {
    const snapshot = await updateAletaBotSettings(db!, {
      actorUserId: "usr-super",
      payload: { kirimPihakEnabled: false },
    });
    expect(snapshot.settings.kirimPihakEnabled).toBe(false);
    expect(snapshot.settings.kirimPegawaiEnabled).toBe(true);

    const dibaca = await getAletaBotSettings(db!);
    expect(dibaca.kirimPihakEnabled).toBe(false);

    await updateAletaBotSettings(db!, { actorUserId: "usr-super", payload: { kirimPihakEnabled: true } });
    expect((await getAletaBotSettings(db!)).kirimPihakEnabled).toBe(true);
  }, 90000);

  it("seluruhnya sampai ke berkas runtime yang dibaca bot", async () => {
    await updateAletaBotSettings(db!, {
      actorUserId: "usr-super",
      payload: {
        kirimSaatLengkap: { enabled: true, pegawai: false, pihak: true, jendelaHari: 10, intervalMenit: 20 },
        pesanNonaktif: { pegawai: [], pihak: ["pihak-hari-sidang"] },
      },
    });
    const berkas = path.join(process.cwd(), "data", "aleta-bot-runtime.json");
    const isi = JSON.parse(await readFile(berkas, "utf8")) as {
      kirimSaatLengkap: unknown;
      pesanNonaktif: unknown;
      kirimPegawaiEnabled: boolean;
    };
    expect(isi.kirimSaatLengkap).toEqual({ enabled: true, pegawai: false, pihak: true, jendelaHari: 10, intervalMenit: 20 });
    expect(isi.pesanNonaktif).toEqual({ pegawai: [], pihak: ["pihak-hari-sidang"] });
    expect(isi.kirimPegawaiEnabled).toBe(true);
  }, 90000);
});

describe("perapi setelan dan katalog", () => {
  it("saklar universal hanya menyala bila true secara tegas", () => {
    expect(rapikanKirimSaatLengkap(undefined).enabled).toBe(false);
    expect(rapikanKirimSaatLengkap({ enabled: "true" }).enabled).toBe(false);
    expect(rapikanKirimSaatLengkap({ enabled: 1 }).enabled).toBe(false);
    expect(rapikanKirimSaatLengkap({ enabled: true }).enabled).toBe(true);
  });

  it("saluran menyala kecuali dimatikan secara tegas", () => {
    expect(rapikanKirimSaatLengkap({}).pegawai).toBe(true);
    expect(rapikanKirimSaatLengkap({ pegawai: false }).pegawai).toBe(false);
  });

  it("daftar pesan nonaktif dirapikan: tanpa kembar, tanpa kosong, bukan larik dibuang", () => {
    expect(rapikanPesanNonaktif({ pegawai: ["a", "a", " ", "b"], pihak: "bukan larik" })).toEqual({
      pegawai: ["a", "b"],
      pihak: [],
    });
    expect(rapikanPesanNonaktif(null)).toEqual({ pegawai: [], pihak: [] });
  });

  it("setelPesan mematikan dan menyalakan satu kunci pada satu saluran saja", () => {
    const awal = { pegawai: [], pihak: [] };
    const mati = setelPesan(awal, "pihak-hari-sidang", "pihak", false);
    expect(mati).toEqual({ pegawai: [], pihak: ["pihak-hari-sidang"] });
    expect(pesanDimatikan(mati, "pihak-hari-sidang", "pihak")).toBe(true);
    expect(pesanDimatikan(mati, "pihak-hari-sidang", "pegawai")).toBe(false);
    const nyala = setelPesan(mati, "pihak-hari-sidang", "pihak", true);
    expect(nyala).toEqual({ pegawai: [], pihak: [] });
    // Mematikan dua kali tidak menggandakan.
    expect(setelPesan(mati, "pihak-hari-sidang", "pihak", false).pihak).toEqual(["pihak-hari-sidang"]);
  });

  it("katalog memuat kedua pemantau kelengkapan dan kuncinya unik", () => {
    const kunci = KATALOG_PESAN_BOT.map((butir) => butir.key);
    expect(new Set(kunci).size).toBe(kunci.length);
    expect(kunci).toContain("pihak-baru-lengkap");
    expect(kunci).toContain("pegawai-penugasan-lengkap");
    expect(KATALOG_PESAN_BOT.find((b) => b.key === "pihak-baru-lengkap")?.saluran).toBe("pihak");
    expect(KATALOG_PESAN_BOT.find((b) => b.key === "pegawai-penugasan-lengkap")?.saluran).toBe("pegawai");
  });

  it("notifikasi registri buatan admin ikut ke katalog menurut kategorinya, tanpa menggandakan yang sudah ada", () => {
    const gabungan = gabungkanKatalogPesanBot([
      { id: "notif-baru-1", name: "Pengingat Khusus", category: "employee", description: "" },
      { id: "pihak-hari-sidang", name: "Sudah ada", category: "party", description: "" },
      { id: "notif-pihak-2", name: "Panggilan Tambahan", category: "party", description: "x" },
    ]);
    expect(gabungan.length).toBe(KATALOG_PESAN_BOT.length + 2);
    expect(gabungan.find((b) => b.key === "notif-baru-1")?.saluran).toBe("pegawai");
    expect(gabungan.find((b) => b.key === "notif-pihak-2")?.saluran).toBe("pihak");
  });
});
