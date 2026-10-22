import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TombolTundaOtomatis } from "@/components/portal/tunda-otomatis-panel";

/**
 * Tunda otomatis 16.30 (22 Okt 2026) - layar: daftar harian dari bungkus
 * { ok, data }, saklar terkunci bagi bukan Super Admin, tombol "Jangan tunda
 * otomatis" mengirim aksi batal per jadwal, usulan gugur tampil tanpa tombol tulis.
 */

const daftar = (bolehUbahSetelan: boolean) => ({
  ok: true,
  data: {
    ada: true,
    tanggal: "2026-10-22",
    setelan: { nyala: true, kering: true, jam: "16:30", diubahOleh: "Derry", diubahPada: "" },
    kalimatSetelan: "Mode kering - pukul 16.30 daftar usulan disusun, TIDAK ada yang ditulis ke SIPP.",
    jamPemicu: "16:30",
    kelilingAktif: false,
    tahap: "pratinjau",
    jalan: null,
    galat: "",
    hariLibur: false,
    bolehUbahSetelan,
    butir: [
      {
        jadwalId: "11",
        nomorPerkara: "600/Pdt.G/2026/PA.Dgl",
        agenda: "Pemeriksaan Pokok Perkara",
        majelis: "",
        panitera: "",
        keliling: false,
        keputusan: { jenis: "tunda", aturan: "tanpa-court-calendar-14", nomorAturan: 2, tanggal: "2026-11-05", jam: "09:00", alasan: "Panggil Tergugat", agenda: "Pemeriksaan Pokok Perkara", kehadiran: 2, penjelasan: "Belum ada Court Calendar: tunda 14 hari.", tanda: [] },
      },
      {
        jadwalId: "12",
        nomorPerkara: "548/Pdt.G/2026/PA.Dgl",
        agenda: "Sidang",
        majelis: "",
        panitera: "",
        keliling: false,
        keputusan: { jenis: "gugur", aturan: "gugur", nomorAturan: 7, usulanStatus: "Digugurkan", penjelasan: "Penggugat tidak hadir pada sidang pertama dan kedua.", tanda: [] },
      },
    ],
  },
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TombolTundaOtomatis", () => {
  it("membuka daftar (bungkus dibuka), saklar terkunci bagi bukan Super Admin, batal per jadwal", async () => {
    const kiriman: Array<{ url: string; badan?: unknown }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        // Bagian Putus otomatis (22 Okt) punya rutenya sendiri - di uji ini kosong.
        if (String(url).includes("putus-otomatis")) return new Response(JSON.stringify({ ok: true, data: { ada: false } }), { status: 200 });
        kiriman.push({ url: String(url), badan: init?.body ? JSON.parse(String(init.body)) : undefined });
        return new Response(JSON.stringify(init?.method === "POST" ? { ok: true, data: { ok: true, pesan: "Perkara ini tidak akan ditunda otomatis hari ini." } } : daftar(false)), { status: 200 });
      })
    );
    render(createElement(TombolTundaOtomatis, { tanggal: "2026-10-22" }));
    fireEvent.click(screen.getByRole("button", { name: /Tunda otomatis/ }));
    await screen.findByText("600/Pdt.G/2026/PA.Dgl");
    expect(screen.getByText("2026-11-05 09:00")).toBeTruthy();
    expect(screen.getByText("Usulan gugur")).toBeTruthy();
    expect(screen.getByText(/Saklar hanya dapat diubah Super Admin/)).toBeTruthy();
    for (const s of screen.getAllByRole("switch")) expect((s as HTMLButtonElement).disabled).toBe(true);
    const tombol = screen.getAllByRole("button", { name: "Jangan tunda otomatis" });
    // Hanya baris tunda yang dapat dibatalkan - usulan gugur tidak punya tombol tulis.
    expect(tombol).toHaveLength(1);
    fireEvent.click(tombol[0]);
    await waitFor(() => expect(kiriman.some((k) => (k.badan as { aksi?: string } | undefined)?.aksi === "batal")).toBe(true));
    expect(kiriman.find((k) => (k.badan as { aksi?: string } | undefined)?.aksi === "batal")!.badan).toEqual({ aksi: "batal", tanggal: "2026-10-22", jadwalId: "11" });
    await screen.findByText("Perkara ini tidak akan ditunda otomatis hari ini.");
  });

  it("Super Admin dapat menyalakan/mematikan saklar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).includes("putus-otomatis") ? new Response(JSON.stringify({ ok: true, data: { ada: false } }), { status: 200 }) : new Response(JSON.stringify(daftar(true)), { status: 200 })
      )
    );
    render(createElement(TombolTundaOtomatis, { tanggal: "2026-10-22" }));
    fireEvent.click(screen.getByRole("button", { name: /Tunda otomatis/ }));
    await screen.findByText("600/Pdt.G/2026/PA.Dgl");
    for (const s of screen.getAllByRole("switch")) expect((s as HTMLButtonElement).disabled).toBe(false);
  });
});
