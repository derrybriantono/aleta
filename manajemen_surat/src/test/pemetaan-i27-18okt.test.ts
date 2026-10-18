// @vitest-environment node
/**
 * ============================================================================
 * PEMETAAN PAKET BAS VERSTEK POLIGAMI DAN PERBAIKAN DK (I27, 18 Okt): abt-poligami-verstek-lengkap-derry (butir 70), abt-dk-lama-perbaikan-derry (butir 78-79),
 * abt-dk-cowok-02-perbaikan-derry
 * ============================================================================
 *
 * Tidak ada berkas baru, tidak ada nama yang berubah, tidak ada variabel baru: yang berubah isi (md5) empat berkas yang sudah ada dan isian yang tampil.
 * Yang dijaga: (A) empat berkas tetap di pohon dan BAS verstek Poligami tetap satu langkah V2 ALUR 34; (B) md5 baru sama dengan paket (bila paket ada di laptop ini);
 * (C) deteksi DK memetakan pendidikan calon suami ke 0603 untuk putusan; (D) isian BAS verstek Poligami (calon istri kedua, penghasilan) dipetakan ke BAS, bukan hanya putusan.
 *
 * Yang SENGAJA tidak berupa kode: isian yang tampil mengikuti penanda RTF yang dibaca bot, jadi 0603 (menggantikan 0609 pada [01]/[02] Cowok), hilangnya 0999 dari [03], dan
 * isian BAS verstek Poligami (9955, 8723-8725, 9171, 9760) muncul sendiri dari berkas baru. Butir P.11 (surat keterangan hamil/kesehatan) di popup bukti 9956 adalah isi popup di
 * ABT (data_teks, tidak diuraikan bot): petugas menghapusnya dari popup untuk "[03] ... Belum Hamil".
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ALUR_BAS_BARU } from "@/lib/alur-bas-baru";

const FIX = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "blangko-derry-server-17okt.json"), "utf8")) as { berkas: string[] };
const A = "derry_briantono/";
const POLI = "5 Izin Poligami - BAS/BAS ALUR 34 Poligami - Sidang 2 - T Tetap Tidak Hadir - Pembuktian dan Putusan Verstek.rtf";
const DK03 = "3 Dispensasi Kawin/[03] [Tolak] DK - (Anak P Cewek) Belum Hamil.rtf";
const DK01 = "3 Dispensasi Kawin/[01] [Kabul] DK - (Anak P Cowok) Calon Istri Hamil.rtf";
const DK02 = "3 Dispensasi Kawin/[02] [Kabul] DK - (Anak P Cowok) sudah berhubungan badan.rtf";
const MD5_SEBELUM: Record<string, string> = {
  [POLI]: "917862a502826eaba83e2d6f7507c609", // = sesudah paket i25 (sebelum i25: 9c992b1ff12374141dc7e49ea8145928)
  [DK03]: "d68b9fd90ba04ab8481640713406cb3f",
  [DK01]: "fe4563fd0a0c0bd064745cbe7b31b9c2",
  [DK02]: "b251bf523973269dd0813b32a3ae53a0",
};
const MD5_SESUDAH: Record<string, string> = {
  [POLI]: "9861fcf2b10894cfc4b3aa3ce8ad732b",
  [DK03]: "e15350a973b23d467be5f6f8168a9aae",
  [DK01]: "fdde09a87dcd7abc9227b946723c2153",
  [DK02]: "5d3d9df4f20ef62c799c09ae6d3d982d",
};

describe("A. pohon", () => {
  it("keempat berkas tetap ada di pohon server dan BAS verstek Poligami tetap satu langkah V2 ALUR 34", () => {
    for (const b of Object.keys(MD5_SESUDAH)) expect(FIX.berkas, b).toContain(`${A}${b}`);
    const alur = ALUR_BAS_BARU.find((a) => a.id === "alur-34")!;
    const v2 = alur.langkah.filter((l) => l.kode === "V2");
    expect(v2).toHaveLength(1);
    expect(`${alur.folder.replace(A, "")}/${v2[0].berkas}`).toBe(POLI);
  });

  it("md5 sebelum dan sesudah berbeda untuk keempat berkas (isi berubah, nama tetap)", () => {
    for (const b of Object.keys(MD5_SESUDAH)) expect(MD5_SESUDAH[b], b).not.toBe(MD5_SEBELUM[b]);
  });
});

describe("B. md5 paket", () => {
  it("md5 berkas sesudah paket (bila hasil paket ada di laptop ini) sama dengan yang dipetakan", () => {
    const akar = "D:/aleta-dev/kerja/batch-14okt-sore/i27-bas-verstek-poligami/hasil";
    const berkas: Record<string, string> = {
      [POLI]: `${akar}/dasar-dan-baru/berkas-baru.rtf`,
      [DK03]: `${akar}/dk-baru/${DK03.split("/")[1]}`,
      [DK01]: `${akar}/dk-baru/${DK01.split("/")[1]}`,
      [DK02]: `${akar}/dk-baru/${DK02.split("/")[1]}`,
    };
    for (const [nama, jalur] of Object.entries(berkas)) {
      if (!existsSync(jalur)) continue;
      expect(createHash("md5").update(readFileSync(jalur)).digest("hex"), nama).toBe(MD5_SESUDAH[nama]);
    }
  });
});

describe("C. deteksi DK: pendidikan calon suami (0603) untuk putusan", () => {
  const require_ = createRequire(import.meta.url);
  const berkasDb = path.resolve(process.cwd(), "../aleta_bot/db_config.js");
  require_.cache[berkasDb] = { id: berkasDb, filename: berkasDb, loaded: true, exports: { query: () => Promise.reject(new Error("db mati")) } } as unknown as NodeJS.Module;
  const dk = require_(path.resolve(process.cwd(), "../aleta_bot/services/deteksiDispensasiKawinService.js")) as {
    PETA_SUMBER: Array<{ kode: string; sumber: string; blangko: string[] }>;
  };

  it("0603 dipetakan ke putusan (bukan hanya blangko lama); 0609 dan 0610 tetap; semua variabel tetap satu entri", () => {
    const peta = (k: string) => dk.PETA_SUMBER.filter((v) => v.kode === k);
    expect(peta("0603")).toHaveLength(1);
    expect(peta("0603")[0].blangko).toContain("putusan");
    expect(peta("0603")[0].sumber).toBe("posita");
    expect(peta("0609")[0].blangko).toContain("putusan");
    expect(peta("0610")[0].blangko).toEqual(["putusan"]);
    const kodeSemua = dk.PETA_SUMBER.map((v) => v.kode);
    expect(new Set(kodeSemua).size).toBe(kodeSemua.length);
  });
});

describe("D. isian BAS verstek Poligami dipetakan ke BAS", () => {
  const require_ = createRequire(import.meta.url);
  const poligami = require_(path.resolve(process.cwd(), "../aleta_bot/services/deteksi/poligami.js")) as { variabel: Array<{ kode: string; blangko: string[] }> };

  it("8723 (calon istri kedua), 8724 (status calon istri), 8725 (penghasilan) berlaku untuk putusan dan BAS; 1152, 8720, 8722, 8726 tetap putusan", () => {
    const blangko = (k: string) => poligami.variabel.find((v) => v.kode === k)!.blangko;
    for (const k of ["8723", "8724", "8725"]) expect(blangko(k), k).toEqual(["putusan", "bas"]);
    for (const k of ["1152", "8720", "8722", "8726"]) expect(blangko(k), k).toEqual(["putusan"]);
  });
});
