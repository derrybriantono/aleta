import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * KEPUTUSAN PENGGUNA 23 OKT 2026 (butir 4 & 5) - LAYAR, per peran. Pasangan audit-hak-keputusan-23okt.test.ts.
 *   4. Ambil Antrian: yang tidak memegang sidang.antrian melihat daftar hari ini tanpa "Catat hadir" dan tanpa tampilan pihak.
 *   5. Pencatatan Laporan Perkara (LIPA): selain Panitera, Panmud, Admin, Super Admin - isian terkunci, tanpa tombol Simpan.
 */

const keadaan = vi.hoisted(() => ({ pengguna: undefined as Record<string, unknown> | null | undefined }));
vi.mock("@/lib/app-state", () => ({ usePenggunaAktifOpsional: () => keadaan.pengguna }));

import { AletaAntrianAmbil } from "@/components/portal/aleta-antrian-ambil";
import { AletaPenilaianBerjenjang } from "@/components/portal/aleta-penilaian-berjenjang";

const akun = (roleId: string, positionId = "", additionalRoleIds: string[] = []) => ({ id: roleId, roleId, positionId, additionalRoleIds });
const PERAN = {
  hakim: akun("hakim", "pos-hakim"),
  pp: akun("panitera-pengganti", "pos-panitera-pengganti"),
  panitera: akun("panitera", "pos-panitera"),
  panmudHukum: akun("panitera-muda", "pos-panitera-muda-hukum"),
  ptsp: akun("pelaksana", "pos-ptsp", ["petugas_ptsp"]),
  penjaga: akun("pelaksana", "pos-staf-umum", ["penjaga_sidang"]),
  admin: akun("admin"),
  js: akun("jurusita", "pos-jurusita"),
  kasir: akun("pelaksana", "pos-staf-umum", ["kasir"]),
  sekretaris: akun("sekretaris", "pos-sekretaris"),
};
type NamaPeran = keyof typeof PERAN;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  keadaan.pengguna = undefined;
});

const json = (isi: unknown) => new Response(JSON.stringify(isi), { status: 200 });

describe("4. Ambil Antrian per peran", () => {
  const BOLEH: NamaPeran[] = ["hakim", "pp", "panitera", "panmudHukum", "ptsp", "penjaga", "admin"];
  for (const n of Object.keys(PERAN) as NamaPeran[]) {
    const boleh = BOLEH.includes(n);
    it(`${n}: ${boleh ? "Catat hadir & tampilan pihak ada" : "hanya dibaca"}`, async () => {
      keadaan.pengguna = PERAN[n];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          if (String(url).includes("/api/aleta-ecourt/sidang")) return json({ ok: true, data: { sidang: [{ perkaraId: "77", nomorPerkara: "600/Pdt.G/2026/PA.Dgl", jamSidang: "09:00", ruangan: "Ruang 1" }] } });
          if (String(url).includes("/antrian/hadir")) return json({ ok: true, data: { peran: [] } });
          return json({ ok: true, data: { peta: {}, kehadiran: {} } });
        })
      );
      render(createElement(AletaAntrianAmbil));
      await screen.findByText("600/Pdt.G/2026/PA.Dgl");
      expect(Boolean(screen.queryByRole("button", { name: "Catat hadir" })), n).toBe(boleh);
      expect(Boolean(screen.queryByRole("button", { name: "Tampilan pihak" })), n).toBe(boleh);
      expect(Boolean(screen.queryByText(/Hanya dibaca/)), n).toBe(!boleh);
    });
  }
});

describe("5. Pencatatan Laporan Perkara (LIPA) per peran", () => {
  const BOLEH: NamaPeran[] = ["panitera", "panmudHukum", "admin"];
  for (const n of Object.keys(PERAN) as NamaPeran[]) {
    const boleh = BOLEH.includes(n);
    it(`${n}: ${boleh ? "isian & Simpan" : "terkunci, tanpa Simpan"}`, async () => {
      keadaan.pengguna = PERAN[n];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          const u = String(url);
          if (u.includes("/api/aleta-penilaian/laporan?lipa=")) {
            return json({ ok: true, data: { nomor: 1, judul: "LIPA 1", baris: [{ bulanLaporan: "2026-09", batasKirim: "2026-10-05", tanggalKirim: "", angkaLaporan: null, terlambatHari: null, angkaSipp: null, nilai: null }] } });
          }
          if (u.includes("/api/aleta-penilaian/laporan")) return json({ ok: true, data: { lipa: [{ nomor: 1, judul: "LIPA 1" }] } });
          return json({ ok: true, data: { daftar: [], kelompok: [] } });
        })
      );
      render(createElement(AletaPenilaianBerjenjang));
      const sel = await screen.findByText("2026-09");
      expect(Boolean(screen.queryByRole("button", { name: "Simpan" })), n).toBe(boleh);
      const tanggal = sel.closest("tr")?.querySelector('input[type="date"]') as HTMLInputElement | null;
      expect(tanggal, n).toBeTruthy();
      expect(tanggal?.disabled, n).toBe(!boleh);
    });
  }
});
