import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { relaasBertemu, relaasElektronik } from "@/lib/hasil-relaas";
import { tanpaLayarMuatNavigasi } from "@/lib/global-loading";

const baca = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const sidang = baca("src/components/portal/aleta-ecourt-sidang.tsx");
const mediasi = baca("src/components/portal/aleta-ecourt-mediasi.tsx");
const pengguna = baca("src/components/portal/aleta-ecourt-pengguna.tsx");
const botJadwal = baca("..", "aleta_bot", "services", "sippJadwalSidangService.js");

describe("panggilan elektronik dianggap bertemu", () => {
  it("sandi E bertemu, T tidak, Y tetap", () => {
    expect(relaasBertemu({ caraRelaas: { sandi: "E" } })).toBe(true);
    expect(relaasBertemu({ bertemu: true, caraRelaas: { sandi: "Y" } })).toBe(true);
    expect(relaasBertemu({ caraRelaas: { sandi: "T" } })).toBe(false);
    expect(relaasBertemu({ caraRelaas: { sandi: "S" } })).toBe(false);
    expect(relaasElektronik({ caraRelaas: { sandi: "E" } })).toBe(true);
    expect(relaasElektronik({ bertemu: true, caraRelaas: { sandi: "Y" } })).toBe(false);
  });

  it("bot menandai E sebagai bertemu; layar riwayat dan tabel memakai satu aturan", () => {
    expect(botJadwal).toMatch(/bertemu: \["Y", "E"\]\.includes/);
    expect(sidang).toContain("relaasBertemu(baris)");
    expect(sidang).toContain("relaasElektronik(baris)");
    expect(sidang).toContain("relaasBertemu(baris) ? (");
  });
});

describe("Jadwal Sidang dan Mediasi tanpa layar muat", () => {
  it("navigasi ke halaman jadwal tidak memunculkan kotak membuka halaman", () => {
    expect(tanpaLayarMuatNavigasi(new URL("https://x.id/aleta/aleta-ecourt"))).toBe(true);
    expect(tanpaLayarMuatNavigasi(new URL("https://x.id/aleta-ecourt/"))).toBe(true);
    expect(tanpaLayarMuatNavigasi(new URL("https://x.id/aleta/aleta-ecourt/rekap-petugas"))).toBe(false);
    expect(tanpaLayarMuatNavigasi(new URL("https://x.id/aleta/bas"))).toBe(false);
  });

  it("kerangka berdenyut dua tab dihapus, tab lain tetap", () => {
    expect(pengguna).toMatch(/AletaEcourtSidang = dynamic\([\s\S]*?loading: \(\) => null/);
    expect(pengguna).toMatch(/AletaEcourtMediasi = dynamic\([\s\S]*?loading: \(\) => null/);
    expect(pengguna).toMatch(/AletaEcourtStatusPerkara = dynamic\([\s\S]*?animate-pulse/);
  });

  it("lapisan memuat/berhasil dimatikan, gagal tetap ada dengan tombol coba lagi", () => {
    expect(sidang).toContain("useOverlayHanyaGagal();");
    expect(mediasi).toContain("useOverlayHanyaGagal();");
    expect(sidang).toContain("data-jadwal-coba-lagi");
    expect(mediasi).toContain("data-jadwal-coba-lagi");
  });
});
