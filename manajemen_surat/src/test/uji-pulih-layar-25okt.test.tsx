import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PanelUjiPulih } from "@/components/portal/keamanan/panel-uji-pulih";
import { PengaturanKeamananBoard } from "@/components/portal/pengaturan-keamanan-board";

/**
 * Uji pulih cadangan (Bagian 6d) dirender sungguhan (jsdom) dengan fetch tiruan:
 * bawaan mati, cadangan terbaru tampil, setelan tersimpan dengan badan yang benar,
 * "Jalankan uji sekarang" memanggil rute lalu menyegarkan sendiri sampai selesai,
 * rincian langkah/tabel dapat dibuka, dan tanpa hak ubah semua kendali nonaktif.
 */

const fetchTiruan = vi.fn();
let panggilan: Array<{ url: string; metode: string; badan: unknown }> = [];
const jawab = (data: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 409, json: async () => ({ ok, data: ok ? data : undefined, error: ok ? undefined : { message: String(data) } }) }) as unknown as Response;

const CADANGAN = { bundel: "20261025-020000", selesai: "2026-10-25T02:30:00Z", nama: "aleta-database.7z", byte: 52 * 1024 ** 2, tersandi: true, umurJam: 4 };
const GAGAL = {
  id: "pulih-1",
  mulaiPada: "2026-10-18T19:00:00Z",
  selesaiPada: "2026-10-18T19:09:00Z",
  pemicu: "jadwal",
  oleh: "Jadwal mingguan",
  status: "gagal",
  tingkat: "gagal",
  bundel: "20261018-020000",
  berkas: "x",
  pesan: "Tabel tidak cocok: users (60 dari 100).",
  durasiMs: 540_000,
  dibersihkan: true,
  rincian: {
    langkah: [
      { nama: "Cari cadangan ALETA terbaru", ok: true, ms: 5, catatan: "bundel 20261018-020000" },
      { nama: "Nilai hasil", ok: false, ms: 1, catatan: "Tabel tidak cocok" },
    ],
    tabel: [{ nama: "users", pulih: 60, produksi: 100, selisihPersen: 40, lulus: false }],
    migrasi: { pulih: 88, produksi: 90, lulus: true },
    galatPsql: 2,
    contohGalatPsql: [],
    dbSementara: "aleta_ujipulih_20261018190000_ab12",
  },
};
let keadaan: { setelan: Record<string, unknown>; riwayat: unknown[]; berjalan: boolean; cadanganTerbaru: unknown };

beforeEach(() => {
  panggilan = [];
  keadaan = { setelan: { aktif: false, hari: 0, jam: "03:00", toleransiPersen: 30 }, riwayat: [GAGAL], berjalan: false, cadanganTerbaru: CADANGAN };
  fetchTiruan.mockImplementation(async (url: string, init?: RequestInit) => {
    const metode = init?.method ?? "GET";
    const badan = init?.body ? JSON.parse(String(init.body)) : undefined;
    panggilan.push({ url, metode, badan });
    if (metode === "POST" && badan?.aksi === "setelan") keadaan = { ...keadaan, setelan: { aktif: badan.aktif, hari: badan.hari, jam: badan.jam, toleransiPersen: badan.toleransiPersen } };
    if (metode === "POST" && badan?.aksi === "jalankan") keadaan = { ...keadaan, berjalan: true };
    return jawab({ ...keadaan, dimulai: metode === "POST" && badan?.aksi === "jalankan" });
  });
  vi.stubGlobal("fetch", fetchTiruan);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("panel uji pulih cadangan", () => {
  it("bawaan MATI; cadangan terbaru dan hasil terakhir tampil; rincian dapat dibuka", async () => {
    render(<PanelUjiPulih bolehUbah />);
    await screen.findByText("Mati");
    expect(document.querySelector("[data-cadangan-terbaru]")?.textContent).toContain("bundel 20261025-020000, 52.0 MB, tersandi, umur 4 jam");
    expect(screen.getByText("Gagal")).toBeTruthy();
    expect(screen.getByText("Tabel tidak cocok: users (60 dari 100).")).toBeTruthy();
    expect(document.querySelector("[data-rincian-uji]")).toBeNull();
    fireEvent.click(screen.getByText("Tabel tidak cocok: users (60 dari 100)."));
    const rinci = await waitFor(() => {
      const el = document.querySelector("[data-rincian-uji]");
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect(within(rinci).getByText("Nilai hasil")).toBeTruthy();
    expect(within(rinci).getByText("40%")).toBeTruthy();
    expect(rinci.textContent).toContain("Basis data sementara sudah dihapus.");
  });

  it("menyalakan dan menyimpan setelan: badan memuat aksi, hari, jam, dan toleransi", async () => {
    render(<PanelUjiPulih bolehUbah />);
    await screen.findByText("Mati");
    fireEvent.click(screen.getByRole("switch", { name: "Nyalakan uji pulih mingguan" }));
    fireEvent.change(screen.getByDisplayValue("30"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan setelan" }));
    await screen.findByText("Tersimpan.");
    expect(panggilan.at(-1)?.badan).toEqual({ aksi: "setelan", aktif: true, hari: 0, jam: "03:00", toleransiPersen: 20 });
    await screen.findByText("Menyala");
  });

  it("Jalankan uji sekarang: memanggil rute, tombol berubah menjadi 'sedang berjalan'", async () => {
    render(<PanelUjiPulih bolehUbah />);
    await screen.findByText("Mati");
    fireEvent.click(screen.getByRole("button", { name: "Jalankan uji sekarang" }));
    await screen.findByText(/Uji dimulai/);
    expect(panggilan.find((p) => p.metode === "POST")?.badan).toEqual({ aksi: "jalankan" });
    expect((screen.getByRole("button", { name: "Uji sedang berjalan" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("tanpa cadangan tombol jalankan nonaktif dan penjelasan tampil; tanpa hak ubah semua nonaktif", async () => {
    keadaan.cadanganTerbaru = null;
    render(<PanelUjiPulih bolehUbah={false} />);
    await screen.findByText("Mati");
    expect(screen.getByText(/Belum ada cadangan ALETA yang selesai/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Jalankan uji sekarang" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Simpan setelan" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("switch", { name: "Nyalakan uji pulih mingguan" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/Hanya Super Admin yang dapat mengubahnya/)).toBeTruthy();
  });

  it("selama berjalan, riwayat disegarkan tiap 5 detik sampai selesai", async () => {
    keadaan.berjalan = true;
    keadaan.riwayat = [{ ...GAGAL, id: "p2", status: "berjalan", pesan: "", tingkat: "", rincian: null }];
    const pewaktu = vi.spyOn(window, "setInterval");
    render(<PanelUjiPulih bolehUbah />);
    await screen.findByText("Sedang memulihkan...");
    const panggilanInterval = pewaktu.mock.calls.find((c) => c[1] === 5000);
    expect(panggilanInterval).toBeTruthy();
    keadaan = { ...keadaan, berjalan: false, riwayat: [{ ...GAGAL, id: "p2", status: "berhasil", tingkat: "baik", pesan: "Cadangan berhasil dipulihkan.", rincian: null }] };
    const sebelum = panggilan.length;
    (panggilanInterval![0] as () => void)();
    await screen.findByText("Cadangan berhasil dipulihkan.");
    expect(panggilan.length).toBeGreaterThan(sebelum);
    pewaktu.mockRestore();
  });
});

describe("papan Pengaturan Keamanan", () => {
  it("memuat empat tab dengan urutan: sandi, jaringan, pengaman, uji pulih", async () => {
    vi.doMock("@/lib/app-state", () => ({ usePortal: () => ({ currentUser: { id: "usr-super", roleId: "super-admin", positionId: "pos-pranata-komputer" }, roles: [] }) }));
    vi.resetModules();
    const { PengaturanKeamananBoard: Papan } = await import("@/components/portal/pengaturan-keamanan-board");
    void PengaturanKeamananBoard;
    fetchTiruan.mockImplementation(async () => jawab({ kebijakan: { aktif: false, versi: 1, panjangMin: 8, tolakUmum: true, tolakIdentitas: true, wajibCampuran: true, riwayatN: 5, masaBerlakuHari: 0, aktifSejak: "" }, belumMemenuhi: [], batas: { panjangMin: [6, 64], riwayatN: [0, 24], masaBerlakuHari: [0, 730] } }));
    render(<Papan />);
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Kebijakan sandi", "Batas jaringan", "Pengaman aksi", "Uji pulih cadangan"]);
    vi.doUnmock("@/lib/app-state");
  });
});
