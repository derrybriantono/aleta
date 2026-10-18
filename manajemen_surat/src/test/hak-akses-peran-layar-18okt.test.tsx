import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HakAksesPeran } from "@/components/portal/hak-akses-peran";
import {
  HAK_MENU_ABT,
  KEPUTUSAN_DISETUJUI,
  KEPUTUSAN_MENUNGGU,
  KEWENANGAN_KHUSUS,
  LABEL_KELOMPOK,
  LABEL_TINGKAT,
  NAMA_GRUP_SIPP,
  PERUBAHAN_18OKT,
  URUTAN_KELOMPOK,
  petaUntukPembaca,
} from "@/lib/hak-akses-peta";
import { GOLONGAN_PERAN, LABEL_GOLONGAN } from "@/lib/matriks-peran";
import type { UserPersona } from "@/lib/types";

/**
 * Layar Pengaturan > Hak akses per peran (18 Okt 2026). Datanya dari peta yang SAMA dengan rute
 * /api/hak-akses/peta; fetch ditiru dengan keluaran peta sungguhan.
 *   - Admin: tabel dan daftar tugas per peran, tanpa rincian teknis dan tanpa daftar perubahan;
 *   - Super Admin: juga rincian teknis, daftar perubahan, dan keputusan yang menunggu;
 *   - Super Admin memegang semua baris (Ubah di setiap butir).
 */

function jawabanPeta(teknis: boolean) {
  return {
    ok: true,
    data: {
      teknis,
      golongan: GOLONGAN_PERAN.map((kode) => ({ kode, label: LABEL_GOLONGAN[kode] })),
      kelompok: URUTAN_KELOMPOK.map((kode) => ({ kode, label: LABEL_KELOMPOK[kode] })),
      tingkat: LABEL_TINGKAT,
      butir: JSON.parse(JSON.stringify(petaUntukPembaca(teknis))),
      kewenangan: KEWENANGAN_KHUSUS,
      perubahan: teknis ? PERUBAHAN_18OKT : [],
      menunggu: teknis ? KEPUTUSAN_MENUNGGU : [],
      disetujui: teknis ? KEPUTUSAN_DISETUJUI : [],
      hakMenuAbt: HAK_MENU_ABT.map((h) => ({
        folder: h.folder,
        tahap: h.tahap,
        grup: h.grup.map((g) => NAMA_GRUP_SIPP[g] ?? String(g)),
        validator: (h.validator ?? []).map((g) => NAMA_GRUP_SIPP[g] ?? String(g)),
      })),
    },
  };
}

const ambilan = vi.fn();
beforeEach(() => {
  ambilan.mockReset();
  vi.stubGlobal("fetch", ambilan);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function pasangPeta(teknis: boolean) {
  ambilan.mockResolvedValue({ ok: true, status: 200, json: async () => jawabanPeta(teknis) });
}

describe("layar Hak akses per peran", () => {
  it("Admin: daftar tugas per peran, tanpa rincian teknis dan tanpa daftar perubahan", async () => {
    pasangPeta(false);
    const { container } = render(<HakAksesPeran />);
    await waitFor(() => expect(container.querySelector("[data-hak-akses-cara='peran']")).toBeTruthy());
    expect(screen.getByText(/Halaman ini hanya dapat dibaca/)).toBeTruthy();
    // Hakim (bawaan): unggah putusan ada, relaas tidak.
    expect(container.querySelector("[data-butir='aksi.putusan.unggah']")).toBeTruthy();
    expect(container.querySelector("[data-butir='aksi.sidang.cetak-relaas']")).toBeNull();
    expect(container.querySelector("details")).toBeNull();
    expect(container.querySelector("[data-hak-akses-perubahan]")).toBeNull();
    expect(container.querySelector("[data-hak-akses-menunggu]")).toBeNull();
    // Hak menu ABT tampil sebagai bacaan.
    expect(container.querySelector("[data-hak-akses-abt]")).toBeTruthy();
    expect(screen.getByText(/Kewenangan khusus/)).toBeTruthy();
  });

  it("memilih peran lain mengganti daftar: juru sita melihat relaas, tidak melihat unggah putusan", async () => {
    pasangPeta(false);
    const { container } = render(<HakAksesPeran />);
    await waitFor(() => expect(container.querySelector("[data-hak-akses-cara='peran']")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Pilih peran"), { target: { value: "jurusita" } });
    await waitFor(() => expect(container.querySelector("[data-butir='aksi.sidang.cetak-relaas']")).toBeTruthy());
    expect(container.querySelector("[data-butir='aksi.putusan.unggah']")).toBeNull();
    expect(container.querySelector("[data-butir='blangko.rel']")).toBeTruthy();
    expect(container.querySelector("[data-butir='blangko.put']")).toBeNull();
  });

  it("Super Admin per peran melihat SEMUA butir; Tabel lengkap menampilkan semua golongan sebagai kolom", async () => {
    pasangPeta(true);
    const { container } = render(<HakAksesPeran />);
    await waitFor(() => expect(container.querySelector("[data-hak-akses-cara='peran']")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Pilih peran"), { target: { value: "super-admin" } });
    const total = jawabanPeta(true).data.butir.length;
    await waitFor(() => expect(container.querySelectorAll("[data-hak-akses-cara='peran'] [data-butir]").length).toBe(total));
    fireEvent.click(screen.getByRole("button", { name: "Tabel lengkap" }));
    await waitFor(() => expect(container.querySelector("[data-hak-akses-cara='tabel']")).toBeTruthy());
    expect(container.querySelectorAll("thead th").length).toBe(GOLONGAN_PERAN.length + 1);
    expect(container.querySelectorAll("tbody tr[data-butir]").length).toBe(total);
  });

  it("Super Admin: rincian teknis, daftar perubahan, dan keputusan yang menunggu tampil", async () => {
    pasangPeta(true);
    const { container } = render(<HakAksesPeran />);
    await waitFor(() => expect(container.querySelector("[data-hak-akses-perubahan]")).toBeTruthy());
    expect(container.querySelector("[data-hak-akses-menunggu]")).toBeTruthy();
    expect(container.querySelector("[data-hak-akses-disetujui]")).toBeTruthy();
    expect(container.querySelector("details")).toBeTruthy();
    expect(screen.getAllByText("Pilihan baru").length).toBeGreaterThan(0);
  });

  it("Per akun: hak gabungan jabatan + peran tambahan (PP + Kasir) = PP dan Kasir, bukan lebih", async () => {
    pasangPeta(false);
    const akun = (id: string, name: string, roleId: string, positionId: string, tambahan: string[] = []) =>
      ({ id, name, username: id, password: "", email: "", roleId, positionId, additionalRoleIds: tambahan, isActive: true }) as unknown as UserPersona;
    const pengguna = [
      akun("u1", "Uji PP Kasir", "panitera-pengganti", "pos-panitera-pengganti", ["kasir"]),
      akun("u2", "Uji Juru Sita", "jurusita", "pos-jurusita"),
    ];
    const { container } = render(<HakAksesPeran pengguna={pengguna} />);
    await waitFor(() => expect(container.querySelector("[data-hak-akses-cara='peran']")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Per akun" }));
    expect(screen.getByText(/Pilih akun untuk melihat hak gabungan/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Pilih akun"), { target: { value: "u1" } });
    await waitFor(() => expect(container.querySelector("[data-butir='aksi.sidang.kasir']")).toBeTruthy());
    // PP: tulis BAS; Kasir: jurnal. Bukan juru sita: relaas tidak.
    expect(container.querySelector("[data-butir='aksi.bas.tulis']")).toBeTruthy();
    expect(container.querySelector("[data-butir='aksi.sidang.cetak-relaas']")).toBeNull();
    expect(container.querySelector("[data-butir='aksi.putusan.unggah']")).toBeNull();
    expect(screen.getByText(/Peran tambahan hanya menambah hak/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Pilih akun"), { target: { value: "u2" } });
    await waitFor(() => expect(container.querySelector("[data-butir='aksi.sidang.cetak-relaas']")).toBeTruthy());
    expect(container.querySelector("[data-butir='aksi.bas.tulis']")).toBeNull();
  });

  it("pencarian menyaring fitur", async () => {
    pasangPeta(true);
    const { container } = render(<HakAksesPeran />);
    await waitFor(() => expect(container.querySelector("[data-hak-akses-cara='peran']")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Pilih peran"), { target: { value: "super-admin" } });
    fireEvent.change(screen.getByLabelText("Cari fitur"), { target: { value: "relaas" } });
    await waitFor(() => {
      const daftar = Array.from(container.querySelectorAll("[data-hak-akses-cara='peran'] [data-butir]"));
      expect(daftar.length).toBeGreaterThan(0);
      expect(daftar.length).toBeLessThan(jawabanPeta(true).data.butir.length);
    });
  });

  it("peran yang tidak berhak: pesan galat dari server tampil, bukan layar kosong", async () => {
    ambilan.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ ok: false, error: { message: "Hak akses per peran hanya dapat dibuka Super Admin dan Admin." } }),
    });
    render(<HakAksesPeran />);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/hanya dapat dibuka Super Admin dan Admin/));
  });
});
