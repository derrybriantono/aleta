/**
 * Jadwal Sidang, perbaikan 6 Okt 2026:
 *   butir 2  kolom Majelis & Petugas dibatasi lebarnya (kepala DAN sel)
 *   butir 5  tombol ruang sidang di ujung kanan deretan alat - menyaring tabel ke satu ruang
 * (butir 1 - penanda verifikasi hanya sidang e-Litigasi + "belum upload" - di
 * verifikasi-majelis-elitigasi.test.tsx)
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { daftarRuangAktif, ruangPilihanBerlaku, saringKeRuang } from "@/lib/ruang-sidang-saring";
import { SAKLAR_TAMPILAN, tampil, tampilanBawaan } from "@/lib/tampilan-antrian-sidang";

const layar = readFileSync(path.resolve(process.cwd(), "src/components/portal/aleta-ecourt-sidang.tsx"), "utf8");

describe("butir 5: tombol ruang sidang", () => {
  const sidang = [
    { nomorPerkara: "1", ruangan: "Ruang Sidang 2" },
    { nomorPerkara: "2", ruangan: "Ruang Sidang 1 Dalam Gedung" },
    { nomorPerkara: "3", ruangan: " Ruang  Sidang 2 " },
    { nomorPerkara: "4", ruangan: "" },
    { nomorPerkara: "5", ruangan: null },
    { nomorPerkara: "6", ruangan: "Ruang Sidang 10" },
  ];

  it("satu tombol per ruang yang dipakai, berjumlah, urut alami; tanpa ruang = tidak ada tombol", () => {
    expect(daftarRuangAktif(sidang)).toEqual([
      { nama: "Ruang Sidang 1 Dalam Gedung", jumlah: 1 },
      { nama: "Ruang Sidang 2", jumlah: 2 },
      { nama: "Ruang Sidang 10", jumlah: 1 },
    ]);
    expect(daftarRuangAktif([{ ruangan: "" }, { ruangan: null }])).toEqual([]);
  });

  it("menyaring ke satu ruang; tanpa pilihan apa adanya; pilihan yang ruangnya hilang gugur", () => {
    expect(saringKeRuang(sidang, "Ruang Sidang 2").map((x) => x.nomorPerkara)).toEqual(["1", "3"]);
    expect(saringKeRuang(sidang, null)).toBe(sidang);
    const daftar = daftarRuangAktif(sidang);
    expect(ruangPilihanBerlaku("Ruang Sidang 2", daftar)).toBe("Ruang Sidang 2");
    expect(ruangPilihanBerlaku("Ruang Sidang 3", daftar)).toBeNull();
  });

  it("tersambung ke tabel, di ujung kanan deretan alat, dan punya saklar tampilan (menyala bawaan)", () => {
    expect(layar).toContain("const sidangTampil = saringKeRuang(milikSaya.baris, ruangSaring);");
    expect(layar).toContain('tampil(tampilan, "saring-ruang") ? ruangPilihanBerlaku(ruangDipilih, ruangAktif) : null');
    // Jumlahnya dari SELURUH sidang, bukan yang tersaring.
    expect(layar).toContain("const ruangAktif = useMemo(() => daftarRuangAktif(sidang), [sidang]);");
    // Sesudah tombol Daftarkan ke antrian, rata kanan.
    const iDaftar = layar.indexOf('{sinkronSibuk ? "Memeriksa…" : "Daftarkan ke antrian"}');
    const iRuang = layar.indexOf('data-saring-ruang=""');
    expect(iDaftar).toBeGreaterThan(-1);
    expect(iRuang).toBeGreaterThan(iDaftar);
    expect(layar.slice(iRuang - 120, iRuang)).toContain("ml-auto");
    expect(SAKLAR_TAMPILAN.find((x) => x.kunci === "saring-ruang")).toBeTruthy();
    expect(tampil(tampilanBawaan(), "saring-ruang")).toBe(true);
    expect(tampil({ ...tampilanBawaan(), "saring-ruang": false }, "saring-ruang")).toBe(false);
  });
});

describe("butir 2: kolom Majelis & Petugas tidak lagi melebar", () => {
  it("batas lebar dipasang pada kepala DAN sel kolomnya", () => {
    expect(layar).toContain('export const LEBAR_KOLOM_MAJELIS = "w-[17rem] max-w-[17rem]";');
    expect(layar).toContain('<KepalaUrut className={cn("px-2 kolom-lengkap", LEBAR_KOLOM_MAJELIS)} kunci="majelis"');
    // Sel majelis: yang memuat lencana kode majelis.
    const iSel = layar.indexOf('<td className={cn("px-2 py-2 align-top text-sm kolom-lengkap", LEBAR_KOLOM_MAJELIS)}>');
    expect(iSel).toBeGreaterThan(-1);
    expect(layar.slice(iSel, iSel + 2500)).toContain("KELAS_LENCANA_KODE_MAJELIS");
  });
});
