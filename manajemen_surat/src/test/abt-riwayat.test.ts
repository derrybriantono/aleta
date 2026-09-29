// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { BATAS_ISI, bacaRiwayat, catatRiwayat } from "@/server/modules/aleta-ecourt/abt-riwayat";

/**
 * ============================================================================
 * JEJAK PERUBAHAN ABT PINDAH KE PELADEN - A-9
 * ============================================================================
 *
 * Riwayat perubahan ABT selama ini hanya ada di chrome.storage peramban yang
 * dipakai, dan berkasnya menyebut batas itu sendiri. Tiga akibatnya nyata:
 * hilang saat data peramban dibersihkan, tidak ada pada peramban lain milik
 * orang yang sama, dan tidak terlihat oleh siapa pun selain yang
 * menyuntingnya - sehingga tidak dapat dipakai mengawasi apa pun.
 *
 * ============================================================================
 * DUA SALINAN, DAN PEMBAGIANNYA YANG DIUJI PALING KERAS
 * ============================================================================
 *
 *   peramban   LENGKAP, ada seketika, menggerakkan tombol Urungkan
 *   peladen    BERTAHAN, dapat dibaca orang lain, jejak pengawasan
 *
 * Yang paling mudah keliru: menjadikan peladen satu-satunya sumber. Urungkan
 * lalu mati setiap kali jaringan terputus - padahal justru saat sesuatu baru
 * saja salah diterapkanlah tombol itu paling dibutuhkan.
 */

let db: AletaDatabase | null = null;

async function basisData() {
  db = await createAletaDatabase({ useInMemory: true, seed: false, runMigrations: false });
  return db;
}

afterEach(async () => {
  await db?.close();
  db = null;
});

const PERKARA = "10510";

describe("mencatat jejak", () => {
  it("tersimpan dan terbaca kembali", async () => {
    const database = await basisData();
    await catatRiwayat(database, "usr-panitera", {
      perkaraId: PERKARA,
      nomorPerkara: "510/Pdt.G/2026/PA.Dgl",
      kode: "8503",
      nama: "Huruf alasan",
      sebelum: "a",
      sesudah: "ab",
      cara: "usulan diterapkan",
      pada: "2026-09-10T02:00:00.000Z",
    });

    const daftar = await bacaRiwayat(database, PERKARA);
    expect(daftar).toHaveLength(1);
    expect(daftar[0].kode).toBe("8503");
    expect(daftar[0].sebelum).toBe("a");
    expect(daftar[0].sesudah).toBe("ab");
    expect(daftar[0].oleh).toBe("usr-panitera");
    expect(daftar[0].dipotong).toBe(false);
  });

  it("waktunya dari ekstensi, bukan dari server", async () => {
    // Memakai waktu peladen akan menggeser seluruh jejak yang tertahan karena
    // jaringan - dan jejak yang waktunya digeser tidak dapat disandingkan
    // dengan apa pun.
    const database = await basisData();
    await catatRiwayat(database, "usr-panitera", {
      perkaraId: PERKARA,
      kode: "5125",
      pada: "2026-09-09T23:15:00.000Z",
    });

    const daftar = await bacaRiwayat(database, PERKARA);
    expect(daftar[0].pada).toBe("2026-09-09T23:15:00.000Z");
  });

  it("terbaru dahulu", async () => {
    const database = await basisData();
    for (const [kode, pada] of [
      ["8503", "2026-09-10T01:00:00.000Z"],
      ["5125", "2026-09-10T03:00:00.000Z"],
      ["2021", "2026-09-10T02:00:00.000Z"],
    ]) {
      await catatRiwayat(database, "usr-panitera", { perkaraId: PERKARA, kode, pada });
    }
    const daftar = await bacaRiwayat(database, PERKARA);
    expect(daftar.map((x) => x.kode)).toEqual(["5125", "2021", "8503"]);
  });

  it("jejak perkara lain tidak ikut terbawa", async () => {
    const database = await basisData();
    await catatRiwayat(database, "usr-a", { perkaraId: PERKARA, kode: "8503" });
    await catatRiwayat(database, "usr-a", { perkaraId: "99999", kode: "8503" });

    expect(await bacaRiwayat(database, PERKARA)).toHaveLength(1);
  });

  it("perkara yang tidak disebut tidak menghasilkan baris", async () => {
    const database = await basisData();
    expect(await catatRiwayat(database, "usr-a", { perkaraId: "" })).toBeNull();
    expect(await bacaRiwayat(database, "")).toEqual([]);
  });
});

describe("isi yang panjang dipotong, dan MENGAKU dipotong", () => {
  it("ditandai dipotong, bukan didiamkan", async () => {
    // Jejak yang dipotong diam-diam lebih buruk daripada jejak yang mengaku
    // dipotong: yang membacanya menyangka itulah seluruh perubahannya, lalu
    // menyimpulkan hal yang keliru tentang orang.
    const database = await basisData();
    const panjang = "a".repeat(BATAS_ISI + 500);
    await catatRiwayat(database, "usr-a", {
      perkaraId: PERKARA,
      kode: "5125",
      sebelum: panjang,
      sesudah: "pendek",
    });

    const daftar = await bacaRiwayat(database, PERKARA);
    expect(daftar[0].dipotong).toBe(true);
    expect(daftar[0].sebelum).toHaveLength(BATAS_ISI);
  });

  it("yang muat tidak ditandai", async () => {
    const database = await basisData();
    await catatRiwayat(database, "usr-a", {
      perkaraId: PERKARA,
      kode: "5125",
      sebelum: "a".repeat(BATAS_ISI),
    });
    expect((await bacaRiwayat(database, PERKARA))[0].dipotong).toBe(false);
  });
});

describe("ekstensi mencatat ke keduanya", () => {
  const abt = () =>
    readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/abt.js"), "utf8");

  it("peramban ditulis LEBIH DAHULU dan tanpa syarat", () => {
    // Urutan ini yang menjaga Urungkan tetap hidup ketika jaringan putus.
    const isi = abt();
    const iLokal = isi.indexOf("chrome.storage.local.set({ [KUNCI_RIWAYAT]");
    const iJauh = isi.indexOf("await fetch(ALETA_API_RIWAYAT, {");
    expect(iLokal).toBeGreaterThan(0);
    expect(iJauh).toBeGreaterThan(iLokal);
  });

  it("kegagalan mengirim ke server DIAM", () => {
    // Penyuntingannya sudah berhasil dan salinan lengkapnya sudah tersimpan.
    // Berteriak tentang jejak pengawasan pada saat itu hanya membuat petugas
    // menyangka suntingannya gagal.
    expect(abt()).toContain("jejak pengawasan tertinggal");
  });

  it("yang dari server tidak diberi tombol Urungkan", () => {
    // Jejak peladen dapat terpotong. Mengembalikan dari potongan akan menimpa
    // variabelnya dengan potongan itu, dan hasilnya terlihat seperti
    // keterangan yang utuh.
    const isi = abt();
    expect(isi).toContain("if (catatan.dariPeladen) {");
    expect(isi).toContain("Kembalikan dari peramban tempat perubahan ini dikerjakan.");
  });

  it("penggabungannya tidak menggandakan baris yang sama", () => {
    // Id peladen tidak ada pada salinan peramban, jadi memakainya sebagai
    // pengenal akan menggandakan SELURUH baris.
    expect(abt()).toContain("`${x.pada}|${x.kode}`");
  });

  it("catatan lama tentang \"hanya di peramban\" sudah tidak berlaku", () => {
    expect(abt()).not.toContain("Disimpan di penyimpanan ekstensi, bukan di server");
  });
});
