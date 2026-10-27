// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { susunPetaHakAkses } from "@/lib/hak-akses-peta";
import { AKSI } from "@/lib/matriks-peran";

/**
 * Hak Jadwalkan BAS / Jadwalkan Tunda terdaftar di matriks (27 Okt 2026): BAS = golongan BAS massal
 * (sama dengan unggah massal BAS), Tunda = aksi "sidang.tunda-putus". Rute yang sama dinilai lagi oleh
 * pelaksana saat dijalankan.
 */
describe("hak sidang terjadwal di matriks dan peta", () => {
  const PETA = susunPetaHakAkses();
  const butir = (id: string) => PETA.find((b) => b.id === id)!;
  const tampil = (hak: Record<string, string | undefined>, g: string) => Boolean(hak[g]);

  it("rute terjadwal tercantum pada aksi Tunda / Putus sidang dan terpasang di berkas rutenya", () => {
    const rute = AKSI["sidang.tunda-putus"].rute.join("\n");
    expect(rute).toContain("/api/aleta-ecourt/sidang-terjadwal");
    const teks = readFileSync(path.join(process.cwd(), "src/app/api/aleta-ecourt/sidang-terjadwal/route.ts"), "utf8");
    expect(teks).toContain('pastikanAksi(db, actorUserId, "sidang.tunda-putus")');
    // penilaian sungguhan terjadi di deps.hak
    const deps = readFileSync(path.join(process.cwd(), "src/server/modules/sidang-terjadwal/deps.ts"), "utf8");
    expect(deps).toContain('pastikanAksi(db, userId, "sidang.tunda-putus")');
    expect(deps).toContain("hakUnggahMassal(aktor)");
  });

  it("tombol Jadwalkan BAS: golongan BAS massal (kepaniteraan + analis), Admin dan Super Admin; hakim, kasir, juru sita tidak", () => {
    const b = butir("fitur.tombol-jadwalkan-bas");
    expect(b).toBeTruthy();
    for (const g of ["super-admin", "admin", "panitera", "panmud", "pp", "analis-perkara"]) expect(tampil(b.hak, g), g).toBe(true);
    for (const g of ["hakim", "pimpinan", "kasir", "ptsp", "juru-sita"]) expect(tampil(b.hak, g), g).toBe(false);
    // sama dengan unggah massal BAS
    const dasar = butir("fitur.unggah-massal-bas");
    expect(Object.keys(b.hak).sort()).toEqual(Object.keys(dasar.hak).sort());
  });

  it("tombol Jadwalkan Tunda: golongan yang boleh menunda/memutus sidang; kasir, PTSP, juru sita tidak", () => {
    const b = butir("fitur.tombol-jadwalkan-tunda");
    expect(b).toBeTruthy();
    for (const g of AKSI["sidang.tunda-putus"].golongan) expect(tampil(b.hak, g), g).toBe(true);
    for (const g of ["super-admin", "admin"]) expect(tampil(b.hak, g), g).toBe(true);
    for (const g of ["kasir", "ptsp", "juru-sita"]) expect(tampil(b.hak, g), g).toBe(false);
  });

  it("golongan di ekstensi (GOLONGAN_TUNDA) = golongan aksi Tunda / Putus sidang + admin", () => {
    const js = readFileSync(path.join(process.cwd(), "..", "ekstensi-sipp/sidang-terjadwal.js"), "utf8");
    const m = /const GOLONGAN_TUNDA = \[([^\]]*)\]/.exec(js)!;
    const ekstensi = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    const server = new Set<string>(["admin", ...AKSI["sidang.tunda-putus"].golongan.map(String)]);
    // ekstensi memakai "ketua" dan "panitera-utama" sebagai sebutan golongan menu ekstensi untuk pimpinan / panitera
    for (const g of ekstensi) expect(server.has(g) || ["ketua", "panitera-utama"].includes(g), g).toBe(true);
    for (const g of server) expect(ekstensi.includes(g), g).toBe(true);
  });
});
