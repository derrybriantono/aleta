import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hasilSidangPutusan } from "@/lib/hasil-sidang";
import { sudahPutusHariIni } from "@/lib/keadaan-sidang";

// 22 Okt: 609/Pdt.G/2026 - petugas mengetik "putus kabul verstek" di kolom keterangan jadwal
// (alasan_ditunda "0"); 1.198 sidang serupa di server. Hasil itu harus terbaca sebagai putus.
const require_ = createRequire(import.meta.url);
const bot = (berkas: string) => path.resolve(process.cwd(), "..", "aleta_bot", "services", berkas);
const { sqlAlasanHasil } = require_(bot("hasilSidangKolom.js")) as { sqlAlasanHasil: (a: string) => string };

describe("hasil putus yang diketik di kolom keterangan jadwal sidang", () => {
  it("penggalan SQL: ditunda Y menang, alasan kosong/0/- diganti keterangan yang memuat putus", () => {
    const s = sqlAlasanHasil("j").replace(/\s+/g, " ");
    expect(s).toContain("COALESCE(j.ditunda, '') <> 'Y'");
    expect(s).toContain("TRIM(COALESCE(j.alasan_ditunda, '')) IN ('', '0', '-')");
    expect(s).toContain("LIKE '%putus%' THEN j.keterangan ELSE j.alasan_ditunda END");
    expect(sqlAlasanHasil("")).toContain("COALESCE(keterangan, '')");
  });

  it("jadwal sidang, keadaan dan riwayat hasil sidang membaca lewat aturan bersama", () => {
    const jadwal = readFileSync(bot("sippJadwalSidangService.js"), "utf8");
    expect(jadwal.match(/\$\{sqlAlasanHasil\("j"\)\} AS alasanDitunda/g)?.length).toBe(2);
    expect(jadwal).not.toMatch(/j\.alasan_ditunda\s+AS alasanDitunda/);
    const hasil = readFileSync(bot("sidangHasilService.js"), "utf8");
    expect(hasil).toContain('${sqlAlasanHasil("j")} AS alasanDitunda');
    expect(hasil).toContain('${sqlAlasanHasil("")} AS alasan,');
    expect(hasil).toContain('require("./hasilSidangKolom")');
  });

  it("isi keterangan nyata terbaca sebagai putus hari itu", () => {
    for (const isi of ["putus kabul verstek", "Putus", "Putus Verstek", "Putus Kabul", "Putus Dikabulkan (Verstek)", "putus cabut"]) {
      expect(hasilSidangPutusan(false, isi), isi).not.toBe("");
      expect(
        sudahPutusHariIni({ sudahPutus: false, tanggalSidang: "2026-10-22", ditunda: false, alasanDitunda: isi }),
        isi
      ).toBe(true);
    }
    // "Pembacaan putusan" bukan hasil putus.
    expect(hasilSidangPutusan(false, "Pembacaan putusan")).toBe("");
  });

  it("baris yang sudah putus hari ini tidak lagi menyalakan Potensi verstek dan lencana Draf putusan", () => {
    const isi = readFileSync(path.resolve(process.cwd(), "src/components/portal/aleta-ecourt-sidang.tsx"), "utf8");
    expect(isi).toContain("cocok: (x) => potensiVerstek(x) && !sudahPutusHariIni(x),");
    expect(isi).toContain('potensiVerstek(baris) && !sudahPutusHariIni(baris) ? (');
    expect(isi).toMatch(/!sudahPutusHariIni\(baris\) &&\s+drafH7\[String\(baris\.perkaraId\)\]\?\.tanggalSidang === String\(baris\.tanggalSidang\)\.slice\(0, 10\) \? \(\s+<LencanaDrafH7/);
  });
});
