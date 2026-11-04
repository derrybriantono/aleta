import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pengguna = vi.hoisted(() => ({ aktif: { id: "usr_uji", roleId: "pelaksana", positionId: "pos-staf-umum", additionalRoleIds: ["kasir"] } as Record<string, unknown> }));
vi.mock("@/lib/app-state", () => ({
  usePortal: () => ({ currentUser: pengguna.aktif }),
}));
vi.mock("@/components/portal/kasir-jurnal", () => ({ DialogKasir: () => null }));

import { DialogKasirHarian } from "@/components/portal/kasir-otomatis";
import { lupakanPilihanKasir } from "@/components/portal/kasir-pilihan-tampilan";

/**
 * KASIR 4 Nov 2026 - pilihan Tampilan lama / Tampilan baru di jendela Kasir portal (per pengguna, disimpan di setelan
 * akun kasir.tampilan). Bawaan: baru. Tampilan lama = komponen rilis 1.205.71 (tab Kasir Manual, Rekap, Pengingat,
 * Riwayat) ditambah tab cetak Sisa panjar dan Instrumen jurusita. SELURUH data REKAAN.
 */
const HARI = "2026-11-03";
const bungkus = (isi: unknown, status = 200) => ({ ok: status < 400, status, headers: new Headers({ "content-type": "application/json" }), json: async () => ({ data: isi }) }) as unknown as Response;
const harian = { ok: true, available: true, tanggal: HARI, jumlahCalon: 0, gagal: [], terpotong: false, akun: { ok: true, username: "kasir1", nama: "Tiara Rekaan, A.Md." }, lengkap: [], perkara: [] };

function pasangFetch(opsi: { setelan?: "lama" | "baru" | null; put?: Array<Record<string, unknown>>; putGagal?: boolean } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const a = String(url);
      if (/ekstensi\/setelan/.test(a)) {
        if (init?.method === "PUT") {
          if (opsi.putGagal) return bungkus({}, 500);
          opsi.put?.push(JSON.parse(String(init.body)));
          return bungkus({ kunci: "kasir.tampilan" });
        }
        return bungkus({ setelan: opsi.setelan ? { "kasir.tampilan": { nilai: { tampilan: opsi.setelan } } } : {} });
      }
      if (/kasir\/harian/.test(a)) return bungkus(harian);
      if (/kasir\/psp/.test(a)) return bungkus({ ok: true, available: true, dari: HARI, sampai: HARI, jumlah: 0, total: 0, rekeningDisembunyikan: false, daftar: [] });
      if (/kasir\/instrumen/.test(a)) return bungkus({ ok: true, available: true, dari: HARI, sampai: HARI, kelompok: [] });
      return bungkus({});
    })
  );
}

beforeEach(() => {
  lupakanPilihanKasir();
  try {
    window.localStorage.clear();
  } catch {
    /* tanpa penyimpanan */
  }
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  pengguna.aktif = { id: "usr_uji", roleId: "pelaksana", positionId: "pos-staf-umum", additionalRoleIds: ["kasir"] };
});

const judulTab = () => screen.getAllByRole("tab").map((t) => t.textContent);

describe("pilihan tampilan Kasir portal", () => {
  it("bawaan: tampilan baru (tab Hari ini ...), tombol pilihan ada dan 'Tampilan baru' terpilih", async () => {
    pasangFetch();
    render(<DialogKasirHarian tabAwal="massal" onTutup={() => undefined} />);
    expect(judulTab()).toEqual(["Hari ini", "Sisa panjar", "Instrumen jurusita", "Rekap", "Pengingat", "Riwayat"]);
    expect(screen.getByRole("button", { name: "Tampilan baru" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Tampilan lama" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("memilih Tampilan lama: tab lama muncul (Kasir Manual), disimpan ke akun, tab yang sedang terbuka dibawa", async () => {
    const put: Array<Record<string, unknown>> = [];
    pasangFetch({ put });
    render(<DialogKasirHarian tabAwal="rekap" onTutup={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Tampilan lama" }));
    await waitFor(() => expect(judulTab()).toEqual(["Kasir Manual (satu hari)", "Sisa panjar", "Instrumen jurusita", "Rekap", "Pengingat", "Riwayat"]));
    expect(screen.getByRole("tab", { name: "Rekap" }).getAttribute("aria-selected")).toBe("true");
    expect(put).toEqual([{ kunci: "kasir.tampilan", nilai: { tampilan: "lama" } }]);
    expect(screen.getByRole("button", { name: "Tampilan lama" }).getAttribute("aria-pressed")).toBe("true");
    // Kembali ke baru.
    fireEvent.click(screen.getByRole("button", { name: "Tampilan baru" }));
    await waitFor(() => expect(judulTab()[0]).toBe("Hari ini"));
    expect(put[1]).toEqual({ kunci: "kasir.tampilan", nilai: { tampilan: "baru" } });
  });

  it("pilihan lama tersimpan di akun: jendela langsung membuka tampilan lama; tab cetak lama tidak hilang (Sisa panjar terbaca)", async () => {
    pasangFetch({ setelan: "lama" });
    render(<DialogKasirHarian tabAwal="massal" onTutup={() => undefined} />);
    await waitFor(() => expect(judulTab()[0]).toBe("Kasir Manual (satu hari)"));
    fireEvent.click(screen.getByRole("tab", { name: "Sisa panjar" }));
    await waitFor(() => expect(screen.getByRole("tab", { name: "Sisa panjar" }).getAttribute("aria-selected")).toBe("true"));
  });

  it("server tak terjangkau: salinan peramban dipakai; gagal menyimpan = kabar jelas, pilihan tetap berlaku", async () => {
    pasangFetch({ putGagal: true });
    render(<DialogKasirHarian tabAwal="massal" onTutup={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Tampilan lama" }));
    await waitFor(() => expect(judulTab()[0]).toBe("Kasir Manual (satu hari)"));
    await waitFor(() => expect(window.localStorage.getItem("aleta.kasir.tampilan.usr_uji")).toBe("lama"));
  });
});
