import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GantiSandiWajib } from "@/components/portal/ganti-sandi-wajib";
import { PanelSandi } from "@/components/portal/keamanan/panel-sandi";

/**
 * Kebijakan sandi (Bagian 6a) dirender sungguhan (jsdom) dengan fetch tiruan:
 * saklar mati bawaan, hanya Super Admin yang dapat mengubah, simpan mengirim nilai
 * yang benar, paksa ganti memanggil rute, dan layar "Ganti sandi sekarang" memeriksa
 * pengulangan sandi sebelum menghubungi server.
 */

const fetchTiruan = vi.fn();
let panggilan: Array<{ url: string; metode: string; badan: unknown }> = [];
const jawab = (data: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 400, json: async () => ({ ok, data: ok ? data : undefined, error: ok ? undefined : { message: String(data) } }) }) as unknown as Response;

const KEBIJAKAN = { aktif: false, versi: 1, panjangMin: 8, tolakUmum: true, tolakIdentitas: true, wajibCampuran: true, riwayatN: 5, masaBerlakuHari: 0, aktifSejak: "" };
const BATAS = { panjangMin: [6, 64], riwayatN: [0, 24], masaBerlakuHari: [0, 730] };
let belum: Array<Record<string, string>> = [];

beforeEach(() => {
  panggilan = [];
  belum = [];
  fetchTiruan.mockImplementation(async (url: string, init?: RequestInit) => {
    const metode = init?.method ?? "GET";
    const badan = init?.body ? JSON.parse(String(init.body)) : undefined;
    panggilan.push({ url, metode, badan });
    if (url.endsWith("/api/admin/keamanan/sandi") && metode === "GET") return jawab({ kebijakan: KEBIJAKAN, belumMemenuhi: belum, batas: BATAS });
    if (url.endsWith("/api/admin/keamanan/sandi") && metode === "POST") return jawab({ kebijakan: { ...KEBIJAKAN, ...badan, versi: 2 }, belumMemenuhi: belum, batas: BATAS });
    if (url.endsWith("/api/admin/keamanan/sandi/paksa-ganti")) {
      belum = badan?.paksa ? [{ userId: badan.userId, username: "hakim", nama: "Hj. Nur Aisyah", peran: "hakim", alasan: "dipaksa", gantiPada: "" }] : [];
      return jawab({ belumMemenuhi: belum });
    }
    if (url.endsWith("/api/keamanan/ganti-sandi")) return jawab("Sandi lama tidak cocok.", false);
    return jawab({});
  });
  vi.stubGlobal("fetch", fetchTiruan);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("panel kebijakan sandi", () => {
  it("bawaan MATI; tanpa hak ubah semua kendali nonaktif", async () => {
    render(<PanelSandi bolehUbah={false} />);
    await screen.findByText("Mati");
    expect(screen.getByRole("switch", { name: "Nyalakan kebijakan sandi" }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("switch", { name: "Nyalakan kebijakan sandi" }).hasAttribute("disabled")).toBe(true);
    expect((screen.getByRole("button", { name: /Simpan kebijakan sandi/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Hanya Super Admin yang dapat mengubahnya/)).toBeTruthy();
    expect(screen.getByText("Kebijakan sandi sedang mati.")).toBeTruthy();
  });

  it("Super Admin menyalakan, mengubah panjang, dan menyimpan: badan kiriman memuat semua aturan", async () => {
    render(<PanelSandi bolehUbah />);
    await screen.findByText("Mati");
    fireEvent.click(screen.getByRole("switch", { name: "Nyalakan kebijakan sandi" }));
    fireEvent.change(screen.getByDisplayValue("8"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: /Simpan kebijakan sandi/ }));
    await screen.findByText("Tersimpan.");
    const kirim = panggilan.find((p) => p.metode === "POST" && p.url.endsWith("/api/admin/keamanan/sandi"));
    expect(kirim?.badan).toEqual({
      aktif: true,
      panjangMin: 12,
      tolakUmum: true,
      tolakIdentitas: true,
      wajibCampuran: true,
      riwayatN: 5,
      masaBerlakuHari: 0,
    });
    await screen.findByText("Menyala");
  });

  it("daftar akun belum memenuhi tampil; 'Paksa ganti sandi' memanggil rute dan menarik kembali", async () => {
    belum = [{ userId: "usr-hakim", username: "hakim", nama: "Hj. Nur Aisyah", peran: "hakim", alasan: "belum-diganti", gantiPada: "" }];
    render(<PanelSandi bolehUbah />);
    await screen.findByText(/Hj\. Nur Aisyah/);
    expect(screen.getByText("Belum diganti sejak aturan ini")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Paksa ganti sandi" }));
    await screen.findByText("Wajib ganti saat masuk");
    expect(panggilan.find((p) => p.url.endsWith("/paksa-ganti"))?.badan).toEqual({ userId: "usr-hakim", paksa: true });
    fireEvent.click(screen.getByRole("button", { name: "Batalkan paksaan" }));
    await waitFor(() => expect(screen.queryByText("Wajib ganti saat masuk")).toBeNull());
  });
});

describe("layar Ganti sandi sekarang", () => {
  it("menyebut alasan, menolak pengulangan yang berbeda tanpa menghubungi server, dan menampilkan galat server", async () => {
    render(<GantiSandiWajib alasan="kedaluwarsa" nama="Hj. Nur Aisyah" />);
    expect(screen.getByText(/masa berlaku sandi Anda sudah habis/)).toBeTruthy();
    const kolom = document.querySelectorAll("input[type=password]");
    expect(kolom).toHaveLength(3);
    fireEvent.change(kolom[0], { target: { value: "lama1234" } });
    fireEvent.change(kolom[1], { target: { value: "Baru6segar" } });
    fireEvent.change(kolom[2], { target: { value: "Baru6segaR" } });
    fireEvent.click(screen.getByRole("button", { name: /Simpan sandi baru/ }));
    await screen.findByText("Sandi baru dan pengulangannya tidak sama.");
    expect(panggilan.filter((p) => p.url.endsWith("/ganti-sandi"))).toHaveLength(0);

    fireEvent.change(kolom[2], { target: { value: "Baru6segar" } });
    fireEvent.click(screen.getByRole("button", { name: /Simpan sandi baru/ }));
    await screen.findByText("Sandi lama tidak cocok.");
    expect(panggilan.find((p) => p.url.endsWith("/ganti-sandi"))?.badan).toEqual({ sandiLama: "lama1234", sandiBaru: "Baru6segar" });
  });

  it("alasan dipaksa memakai kalimat permintaan admin", () => {
    render(<GantiSandiWajib alasan="dipaksa" nama="" />);
    expect(screen.getByText(/admin meminta Anda membuat sandi baru/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Simpan sandi baru/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
