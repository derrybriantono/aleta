import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { statusTanpaVerstek, tergugatBelumPernahHadir, verstekBawaan } from "@/lib/verstek-bawaan";
import type { SidangRiwayat } from "@/lib/bawaan-tunda";

// 22 Okt: tombol Putus Jadwal Sidang - Verstek tercentang bila Tergugat belum pernah hadir,
// lepas sendiri bila jenis putusan cabut / tidak dapat diterima / dicoret.
const sidang = (jadwalId: number, dihadiriOleh: number | null): SidangRiwayat => ({
  jadwalId,
  tanggal: "2026-10-01",
  agenda: "",
  ditunda: true,
  alasan: "",
  dihadiriOleh,
  ikrar: false,
});

const bahan = (lain: Partial<Parameters<typeof verstekBawaan>[0]> = {}) => ({
  gugatan: true,
  riwayat: [sidang(1, 2), sidang(2, 4), sidang(3, null)],
  jadwalIdSekarang: 3,
  dihadiriHariIni: 2,
  namaStatus: "Dikabulkan",
  ...lain,
});

describe("centang Verstek bawaan form Putus", () => {
  it("Tergugat belum pernah hadir: tercentang untuk dikabulkan dan ditolak", () => {
    expect(verstekBawaan(bahan())).toBe(true);
    expect(verstekBawaan(bahan({ namaStatus: "Ditolak" }))).toBe(true);
  });

  it("cabut, tidak dapat diterima, dicoret, gugur: tidak tercentang", () => {
    for (const nama of ["Dicabut", "Tidak Dapat Diterima", "Dicoret dari register", "Digugurkan"]) {
      expect(statusTanpaVerstek(nama), nama).toBe(true);
      expect(verstekBawaan(bahan({ namaStatus: nama })), nama).toBe(false);
    }
    expect(statusTanpaVerstek("Dikabulkan")).toBe(false);
  });

  it("Tergugat pernah hadir (sidang terdahulu atau hari ini): tidak tercentang", () => {
    expect(verstekBawaan(bahan({ riwayat: [sidang(1, 3), sidang(3, null)] }))).toBe(false);
    expect(verstekBawaan(bahan({ riwayat: [sidang(1, 1), sidang(3, null)] }))).toBe(false);
    expect(verstekBawaan(bahan({ dihadiriHariIni: 1 }))).toBe(false);
    expect(verstekBawaan(bahan({ dihadiriHariIni: 3 }))).toBe(false);
  });

  it("kehadiran sidang ini dibaca dari pilihan hari ini, bukan dari baris riwayatnya", () => {
    expect(tergugatBelumPernahHadir([sidang(3, 1)], 3, 2)).toBe(true);
  });

  it("permohonan dan riwayat tak terbaca: tidak menebak", () => {
    expect(verstekBawaan(bahan({ gugatan: false }))).toBe(false);
    expect(verstekBawaan(bahan({ riwayat: null }))).toBe(false);
    expect(tergugatBelumPernahHadir(undefined, 3, 2)).toBeNull();
  });

  it("kedua form Putus (lengkap dan ringkas) memakai bawaan ini dan menghormati centang petugas", () => {
    const isi = readFileSync(path.resolve(process.cwd(), "src/components/portal/hasil-sidang.tsx"), "utf8");
    expect(isi.match(/useVerstekBawaan\(\s*\{/g)?.length).toBe(2);
    expect(isi.match(/sentuhVerstek\(\);/g)?.length).toBe(2);
  });
});
