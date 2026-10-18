/**
 * Layar Panduan lengkap: ringkasan "Fitur Terbaru per Peran" sampai ke peran
 * yang tepat (R9, 18 Okt 2026). Peran tambahan kasir ikut terbaca dari
 * matriks peran, bukan hanya dari nama jabatan.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let pengguna: Record<string, unknown> = { id: "u1", roleId: "hakim" };

vi.mock("@/lib/app-state", () => ({
  usePortal: () => ({ currentUser: pengguna, positions: [], moduleVisibility: [] }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...sisa }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...sisa}>
      {children}
    </a>
  ),
}));

import UserGuidePage from "@/app/(portal)/panduan/page";

function bukaPanduanLengkap() {
  render(<UserGuidePage />);
  fireEvent.click(screen.getByRole("tab", { name: /Panduan lengkap/ }));
  return document.body.textContent || "";
}

beforeEach(() => {
  pengguna = { id: "u1", roleId: "hakim" };
});
afterEach(() => cleanup());

describe("Panduan lengkap - fitur terbaru per peran", () => {
  it("hakim melihat panduan hakim dan panduan semua pegawai, tidak panduan Super Admin, juru sita, atau kasir", () => {
    const teks = bukaPanduanLengkap();
    expect(teks).toContain("Fitur terbaru untuk Hakim");
    expect(teks).toContain("Fitur terbaru untuk semua pegawai");
    expect(teks).not.toContain("Fitur terbaru untuk Super Admin");
    expect(teks).not.toContain("Fitur terbaru untuk Juru Sita");
    expect(teks).not.toContain("Fitur terbaru untuk Kasir");
  });

  it("juru sita melihat panduan juru sita saja di antara panduan per peran", () => {
    pengguna = { id: "u2", roleId: "jurusita" };
    const teks = bukaPanduanLengkap();
    expect(teks).toContain("Fitur terbaru untuk Juru Sita");
    expect(teks).not.toContain("Fitur terbaru untuk Hakim");
    expect(teks).not.toContain("Fitur terbaru untuk Kasir");
  });

  it("peran tambahan kasir membuka panduan Kasir", () => {
    pengguna = { id: "u3", roleId: "pegawai", additionalRoleIds: ["kasir"] };
    const teks = bukaPanduanLengkap();
    expect(teks).toContain("Fitur terbaru untuk Kasir");
    expect(teks).not.toContain("Fitur terbaru untuk Super Admin");
  });

  it("Ketua melihat panduan pimpinan dan panduan hakim", () => {
    pengguna = { id: "u4", roleId: "ketua" };
    const teks = bukaPanduanLengkap();
    expect(teks).toContain("Fitur terbaru untuk Ketua dan Wakil Ketua");
    expect(teks).toContain("Fitur terbaru untuk Hakim");
  });

  it("Super Admin melihat semua panduan per peran, dan Admin tidak melihat panduan Super Admin", () => {
    pengguna = { id: "u5", roleId: "super-admin" };
    let teks = bukaPanduanLengkap();
    for (const judul of ["Super Admin", "Admin", "Ketua dan Wakil Ketua", "Hakim", "Panitera, Panitera Muda", "Juru Sita", "Kasir", "PTSP dan Operator"]) {
      expect(teks, judul).toContain(`Fitur terbaru untuk ${judul}`);
    }
    cleanup();
    pengguna = { id: "u6", roleId: "admin" };
    teks = bukaPanduanLengkap();
    expect(teks).toContain("Fitur terbaru untuk Admin");
    expect(teks).not.toContain("Fitur terbaru untuk Super Admin");
  });
});
