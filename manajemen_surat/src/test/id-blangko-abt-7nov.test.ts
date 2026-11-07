import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { idBlangkoSah, POLA_ID_BLANGKO } from "@/lib/id-blangko-abt";

/**
 * Id blangko di pustaka ALETA ABT adalah jalur berkas (spasi, kurung, garis miring; sampai 181 huruf). Rute selesai dan pemeriksaan siap masih
 * memakai pola id 80 huruf tanpa spasi sehingga menolak 400 semua id pustaka nyata (sama dengan cacat rute cetak yang diperbaiki di 95995fdf).
 * Kini satu pola dipakai bersama; uji ini memegang pola itu dan memastikan tiap rute memakainya. Id rekaan dengan bentuk jalur nyata.
 */
const AKAR = path.resolve(__dirname, "..", "..");
const baca = (p: string) => readFileSync(path.join(AKAR, p), "utf8");

const ID_NYATA = [
  "1 Perceraian CG/[01] [Kabul Verstek] Cerai (Format Lengkap).rtf",
  "4a Harta Bersama/[01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvensi Sita Jaminan Tambahan Panjang Sekali Untuk Uji.rtf",
  "5 Kewarisan/" + "x".repeat(150) + ".rtf",
];

describe("pola id blangko bersama", () => {
  it("menerima jalur pustaka nyata dan menolak yang berbahaya atau kosong", () => {
    for (const id of ID_NYATA) expect(idBlangkoSah(id)).toBe(true);
    expect(ID_NYATA[2].length).toBeGreaterThan(80);
    for (const buruk of ["", "../x", "a/../b", "a\\b", "a\u0001b", "x".repeat(301), undefined, null, 12]) expect(idBlangkoSah(buruk)).toBe(false);
    expect(POLA_ID_BLANGKO.test("a/..")).toBe(false);
  });

  it("rute cetak, selesai, dan siap tidak lagi memakai pola 80 huruf untuk id blangko", () => {
    for (const berkas of ["src/app/api/aleta-abt/cetak/route.ts", "src/app/api/aleta-abt/selesai/route.ts", "src/server/modules/aleta-abt-siap/service.ts"]) {
      const sumber = baca(berkas);
      expect(sumber, berkas).toContain('from "@/lib/id-blangko-abt"');
      expect(sumber, berkas).toContain("idBlangkoSah(");
      expect(sumber, berkas).not.toMatch(/\[\\w\.:@-\]\{1,80\}/);
    }
  });
});

describe("pemeriksaan naskah siap dengan id pustaka nyata", () => {
  beforeEach(() => vi.resetModules());

  it("id jalur berkas lolos pemeriksaan id dan diteruskan ke penyusun naskah; id berbahaya tetap 400", async () => {
    const susunNaskah = vi.fn(async () => ({ ok: false as const, status: 404, alasan: "Naskah rekaan tidak ditemukan." }));
    vi.doMock("@/server/modules/aleta-abt-cetak/naskah", () => ({ susunNaskah }));
    vi.doMock("@/server/modules/aleta-bot/jadwal-sidang-singgah", () => ({ getGatewayJadwalSidangSinggah: vi.fn() }));
    vi.doMock("@/server/modules/aleta-abt-alur/hak-folder", () => ({ bacaKeadaanHakFolder: vi.fn(), putusanHakFolder: vi.fn() }));
    const { periksaNaskahSiap } = await import("@/server/modules/aleta-abt-siap/service");
    const db = {} as never;
    await expect(periksaNaskahSiap(db, { berkasId: ID_NYATA[0], perkaraId: "123" })).rejects.toMatchObject({ status: 404 });
    expect(susunNaskah).toHaveBeenCalledTimes(1);
    expect(susunNaskah).toHaveBeenCalledWith(db, expect.objectContaining({ berkasId: ID_NYATA[0], perkaraId: "123" }));
    await expect(periksaNaskahSiap(db, { berkasId: "a/../b", perkaraId: "123" })).rejects.toMatchObject({ status: 400 });
    expect(susunNaskah).toHaveBeenCalledTimes(1);
  });
});
