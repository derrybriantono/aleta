import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CerminPerkaraPanel, kalimatKemajuan } from "@/components/portal/cermin-perkara-panel";
import { PENGATURAN_CERMIN_BAWAAN, keadaanMediasiAwal, keadaanPembaruanAwal, keadaanPemindaiAwal, keadaanTagAwal, persenKemajuan } from "@/lib/cermin";
import type { HalamanPemantauCermin } from "@/server/modules/cermin/pemantau";

/**
 * Layar Pemantau Cermin Perkara (A2, 25 Okt 2026): kalimat kemajuan
 * ("18.400 dari 23.100 perkara, perkiraan selesai ..."), semua saklar mati
 * bawaan, Admin hanya melihat, dan Super Admin mengubah lewat PUT/POST.
 */

function halaman(ubah: Partial<HalamanPemantauCermin> = {}): HalamanPemantauCermin {
  const keadaan = keadaanPemindaiAwal();
  return {
    sekarang: "2026-10-25T14:00:00.000Z",
    bolehMengubah: true,
    pengaturan: { ...PENGATURAN_CERMIN_BAWAAN, layar: { ...PENGATURAN_CERMIN_BAWAAN.layar } },
    layar: [
      { kunci: "mediasi", label: "Jadwal Mediasi", aktif: false },
      { kunci: "status", label: "Status Perkara", aktif: false },
      { kunci: "jadwal", label: "Jadwal Sidang, layar publik, dan antrean", aktif: false },
      { kunci: "ekstensi", label: "Panel ekstensi di SIPP/ABT", aktif: false },
      { kunci: "kabar", label: "Kabar perubahan data SIPP di panel ekstensi", aktif: false },
    ],
    keadaan,
    pembaruan: keadaanPembaruanAwal(),
    pencocokan: { terakhir: null, riwayat: [], bersih: false },
    mediasi: keadaanMediasiAwal(),
    tag: keadaanTagAwal(),
    persen: persenKemajuan(keadaan),
    perkiraanSelesai: null,
    jendela: { mulai: "18:00", selesai: "06:30", dalamJendelaSekarang: true, jamSekarang: "22:00" },
    hitungan: { perkara: 0, sidang: 0, pihak: 0, mediasi: 0, tag: 0, perkaraTerbaru: "", sidangTerbaru: "" },
    proses: { menyala: true, sedangMembaca: false, terakhir: null },
    ...ubah,
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("kalimatKemajuan", () => {
  it("belum dimulai, sedang memindai perkara (dengan perkiraan), dan selesai", () => {
    expect(kalimatKemajuan(halaman())).toBe("Pemindaian awal belum dimulai.");
    const k = keadaanPemindaiAwal();
    k.status = "berjalan";
    k.perkara.total = 23_100;
    k.perkara.diproses = 18_400;
    // 02.40 WITA = 18.40 UTC
    expect(kalimatKemajuan({ keadaan: k, perkiraanSelesai: "2026-10-25T18:40:00.000Z" })).toBe("18.400 dari 23.100 perkara, perkiraan selesai 26 Okt, 02.40");
    expect(kalimatKemajuan({ keadaan: k, perkiraanSelesai: null })).toBe("18.400 dari 23.100 perkara");
    k.tahap = "sidang";
    k.perkara.diproses = 23_100;
    k.sidang.total = 20_000;
    k.sidang.diproses = 5_000;
    expect(kalimatKemajuan({ keadaan: k, perkiraanSelesai: null })).toContain("sidang 5.000 dari 20.000");
    k.status = "selesai";
    expect(kalimatKemajuan({ keadaan: k, perkiraanSelesai: null })).toContain("selesai");
  });
});

describe("CerminPerkaraPanel", () => {
  it("menampilkan semua saklar MATI bawaan dan kemajuan 0%", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true, data: halaman() })));
    const { container } = render(<CerminPerkaraPanel />);
    await waitFor(() => expect(screen.getByTestId("cermin-status")).toBeTruthy());
    expect(screen.getByTestId("cermin-status").textContent).toMatch(/belum dimulai/i);
    expect(screen.getByTestId("cermin-kemajuan").textContent).toContain("0%");
    const saklar = Array.from(container.querySelectorAll('button[role="switch"]')) as HTMLElement[];
    expect(saklar).toHaveLength(6); // pemindai + lima layar
    for (const s of saklar) expect(s.getAttribute("aria-checked"), s.getAttribute("aria-label") ?? "").toBe("false");
    expect(screen.getByText("Matikan semua (bawaan)")).toBeTruthy();
  });

  it("Admin (tidak boleh mengubah) melihat saklar terkunci dan tanpa tombol tindakan", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true, data: halaman({ bolehMengubah: false }) })));
    const { container } = render(<CerminPerkaraPanel />);
    await waitFor(() => expect(screen.getByTestId("cermin-status")).toBeTruthy());
    for (const s of Array.from(container.querySelectorAll('button[role="switch"]')) as HTMLButtonElement[]) expect(s.disabled).toBe(true);
    expect(screen.queryByText("Simpan pengaturan")).toBeNull();
    expect(screen.queryByText("Jalankan satu kelompok sekarang")).toBeNull();
    expect(screen.getByText(/Hanya Super Admin yang dapat mengubah saklar/)).toBeTruthy();
  });

  it("Super Admin menyalakan pemindai lalu menyimpan: PUT berisi pemindaiAktif true, layar tetap mati", async () => {
    const panggilan: Array<{ method: string; body: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        panggilan.push({ method: String(init?.method || "GET"), body: String(init?.body || "") });
        return Response.json({ ok: true, data: halaman() });
      })
    );
    render(<CerminPerkaraPanel />);
    await waitFor(() => expect(screen.getByLabelText("Pemindai cermin")).toBeTruthy());
    fireEvent.click(screen.getByLabelText("Pemindai cermin"));
    fireEvent.click(screen.getByText("Simpan pengaturan"));
    await waitFor(() => expect(panggilan.some((p) => p.method === "PUT")).toBe(true));
    const put = JSON.parse(panggilan.find((p) => p.method === "PUT")!.body);
    expect(put.pemindaiAktif).toBe(true);
    expect(put.layar).toEqual({ mediasi: false, status: false, jadwal: false, ekstensi: false, kabar: false });
  });

  it("galat rute tampil sebagai pesan, bukan [object Object]", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: false, error: { message: "Hanya Super Admin dan Admin." } }, { status: 403 })));
    render(<CerminPerkaraPanel />);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Hanya Super Admin dan Admin."));
  });
});
