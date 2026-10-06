/**
 * Butir 23-24 (6 Okt 2026): turut tergugat (perkara_pihak4) dan intervensi
 * (perkara_pihak3) di Jadwal Sidang, Jadwal Mediasi, Status Perkara, dan
 * panggil WhatsApp.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { pihakTampil } from "@/components/portal/aleta-ecourt-sidang";
import { golonganSisi } from "@/components/portal/panggil-petugas";
import { KOLOM_HASIL, pihakTambahan, teksSel } from "@/components/portal/status-perkara-hasil";
import { namaDapatDiklik, panggilBawaan } from "@/lib/panggil-petugas";

const AKAR = path.resolve(process.cwd(), "..");
const baca = (p: string) => readFileSync(path.join(AKAR, p), "utf8");
const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));

describe("bot: kedudukan pihak_ke 3 = intervensi, 4 = turut tergugat", () => {
  it("label identitas pihak tidak lagi tertukar", () => {
    const sumber = baca("aleta_bot/services/identitasPihakService.js");
    expect(sumber).toContain('3: "Intervensi",');
    expect(sumber).toContain('4: "Turut Tergugat",');
    expect(sumber).not.toContain('4: "Pelawan"');
  });

  it("daftar sidang mengirim turutTergugat dan intervensi, tergugat lama tetap memuat turut tergugat", async () => {
    const jalurDb = require_.resolve(path.join(AKAR, "aleta_bot/db_config"));
    const Module = require_("module");
    const jalurLayanan = path.join(AKAR, "aleta_bot/services/sippJadwalSidangService.js");
    delete require_.cache[jalurLayanan];
    const tiruan = new Module(jalurDb, null);
    tiruan.filename = jalurDb;
    tiruan.loaded = true;
    tiruan.exports = {
      query: (_sql: string, _p: unknown[], cb: (e: unknown, r: unknown) => void) =>
        cb(null, [
          { perkaraId: 1, nama: "Ani", pihakKe: 1 },
          { perkaraId: 1, nama: "Budi", pihakKe: 2 },
          { perkaraId: 1, nama: "Kepala Desa", pihakKe: 4 },
          { perkaraId: 1, nama: "Bank X", pihakKe: 3 },
        ]),
    };
    require_.cache[jalurDb] = tiruan;
    const layanan = require_(jalurLayanan) as { pihakBanyakPerkara: (id: number[], o?: object) => Promise<Record<string, Record<string, string[]>>> };
    const lama = (await layanan.pihakBanyakPerkara([1]))["1"];
    expect(lama.tergugat).toEqual(["Budi", "Kepala Desa"]);
    expect(lama.turutTergugat).toEqual(["Kepala Desa"]);
    expect(lama.intervensi).toEqual(["Bank X"]);
    const pisah = (await layanan.pihakBanyakPerkara([1], { pisahkanTurut: true }))["1"];
    expect(pisah.tergugat).toEqual(["Budi"]);
    delete require_.cache[jalurDb];
    delete require_.cache[jalurLayanan];
  });

  it("panggil: perkara_pihak3/4 dibaca beserta telepon, bergolongan pihak3/pihak4", () => {
    const sumber = baca("aleta_bot/services/panggilPetugasService.js");
    expect(sumber).toContain("FROM perkara_pihak3 x LEFT JOIN pihak p ON p.id = x.pihak_id");
    expect(sumber).toContain("FROM perkara_pihak4 x LEFT JOIN pihak p ON p.id = x.pihak_id");
    expect(sumber).toContain('susunPihak(pihak4.baris, "pihak4", "pihak4", "pihak")');
    expect(sumber).toContain('susunPihak(pihak3.baris, "pihak3", "pihak3", "pihak")');
  });

  it("status perkara membaca keempat tabel pihak", () => {
    const sumber = baca("aleta_bot/services/sippStatusPerkaraService.js");
    expect(sumber).toContain("FROM perkara_pihak4 d WHERE d.perkara_id IN");
    expect(sumber).toContain("x.turutTergugat = sisi(4);");
    expect(sumber).toContain("x.intervensi = sisi(3);");
  });
});

describe("portal", () => {
  it("Jadwal Sidang: T tanpa turut tergugat, lalu baris Turut T dan Int yang dapat dipanggil", () => {
    expect(pihakTampil({ tergugat: ["Budi", "Kepala Desa"], turutTergugat: ["Kepala Desa"] }).tergugat).toEqual(["Budi"]);
    expect(pihakTampil({ tergugat: ["Budi"] }).tergugat).toEqual(["Budi"]);
    const layar = readFileSync(path.resolve(process.cwd(), "src/components/portal/aleta-ecourt-sidang.tsx"), "utf8");
    expect(layar).toContain('<span className="font-medium text-foreground/70">Turut T:</span>');
    expect(layar).toContain('<NamaDapatDipanggil golongan="pihak4"');
    expect(layar).toContain('<span className="font-medium text-foreground/70">Int:</span>');
    expect(layar).toContain('<NamaDapatDipanggil golongan="pihak3"');
  });

  it("Jadwal Mediasi: Turut T dan Int, keduanya dapat dipanggil WhatsApp seperti pihak lain", () => {
    expect(golonganSisi("turut")).toBe("pihak4");
    expect(golonganSisi("intervensi")).toBe("pihak3");
    const pilihan = panggilBawaan();
    expect(namaDapatDiklik(pilihan, "pihak4")).toBe(true);
    expect(namaDapatDiklik(pilihan, "pihak3")).toBe(true);
    const mediasi = readFileSync(path.resolve(process.cwd(), "src/components/portal/aleta-ecourt-mediasi.tsx"), "utf8");
    expect(mediasi).toContain('{ kunci: "intervensi", sebutan: "Int", nama: baris.pihak.intervensi ?? [] },');
  });

  it("Status Perkara: Turut T dan Int di kolom pihak kedua (layar dan teks unduhan)", () => {
    const b = { pihak2: "Budi", sebutanPihak2: "Tergugat", turutTergugat: "Kepala Desa", intervensi: "Bank X" };
    expect(pihakTambahan(b).map((x) => x.pendek)).toEqual(["Turut T", "Int"]);
    const kolom = KOLOM_HASIL.find((k) => k.kunci === "pihak2")!;
    expect(teksSel(kolom, b as never)).toBe("Tergugat: Budi; Turut Tergugat: Kepala Desa; Intervensi: Bank X");
    expect(pihakTambahan({ pihak2: "Budi" } as never)).toEqual([]);
    void createElement;
    void renderToStaticMarkup;
  });
});
