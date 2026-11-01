import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KartuDompetSatker } from "@/components/portal/aleta-ai/dompet-satker";

/**
 * ALETA Ai - layar pengelolaan dompet satker di Pengaturan (Super Admin), dirender sungguhan dengan fetch tiruan:
 * saldo, isi saldo (POST), aturan per peran/pengguna (PUT/DELETE), pemakaian bulan ini, dan riwayat isi dan pemakaian.
 */

const fetchTiruan = vi.fn();
let panggilan: Array<{ url: string; metode: string; badan: any }> = [];
const jawab = (data: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => (status < 400 ? { ok: true, data } : { ok: false, error: { message: String(data) } }) }) as unknown as Response;

const PENGGUNA = [
  { id: "usr-1", name: "Hakim Satu" },
  { id: "usr-2", name: "Super Admin" },
];
const PERAN = [
  { id: "hakim", name: "Hakim" },
  { id: "panitera-pengganti", name: "Panitera Pengganti" },
];

let data: any;
beforeEach(() => {
  panggilan = [];
  data = {
    saldoRp: 75_000,
    seimbang: true,
    aturan: [{ sasaran: "peran", sasaranId: "hakim", boleh: true, batasBulananRp: 50_000 }],
    riwayat: [
      { id: "m2", jenis: "potong", jumlahRp: -1500, saldoSetelah: 75_000, penggunaId: "usr-1", peranId: "hakim", olehId: "", catatan: "Biaya giliran", waktu: "2026-11-01T03:00:00.000Z" },
      { id: "m1", jenis: "isi", jumlahRp: 76_500, saldoSetelah: 76_500, penggunaId: "", peranId: "", olehId: "usr-2", catatan: "Anggaran", waktu: "2026-11-01T02:00:00.000Z" },
    ],
    pemakaianBulanIni: [{ penggunaId: "usr-1", peranId: "hakim", terpakaiRp: 1500 }],
  };
  fetchTiruan.mockImplementation(async (url: string, init?: RequestInit) => {
    const metode = (init?.method ?? "GET").toUpperCase();
    const badan = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    panggilan.push({ url, metode, badan });
    if (metode === "POST") {
      data = { ...data, saldoRp: data.saldoRp + badan.jumlahRp };
      return jawab({ saldoRp: data.saldoRp });
    }
    if (metode === "PUT") {
      data = { ...data, aturan: [...data.aturan.filter((a: any) => !(a.sasaran === badan.sasaran && a.sasaranId === badan.sasaranId)), { ...badan, boleh: badan.boleh === true }] };
      return jawab(data.aturan);
    }
    if (metode === "DELETE") {
      const u = new URL(url, "http://x");
      data = { ...data, aturan: data.aturan.filter((a: any) => !(a.sasaran === u.searchParams.get("sasaran") && a.sasaranId === u.searchParams.get("sasaranId"))) };
      return jawab(data.aturan);
    }
    return jawab(data);
  });
  vi.stubGlobal("fetch", fetchTiruan);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchTiruan.mockReset();
});

describe("layar dompet satker (Super Admin)", () => {
  it("menampilkan saldo, aturan dengan nama peran, pemakaian bulan ini bernama, dan riwayat siapa/kapan/berapa", async () => {
    render(<KartuDompetSatker pengguna={PENGGUNA} peran={PERAN} />);
    expect((await screen.findByTestId("saldo-satker")).textContent).toBe("Rp75.000");
    expect(screen.getByText("Cocok dengan buku mutasi")).toBeTruthy();
    const aturan = within(screen.getByTestId("aturan-satker"));
    expect(aturan.getByText("Hakim")).toBeTruthy();
    expect(aturan.getByText(/batas Rp50\.000 per bulan/)).toBeTruthy();
    const pemakaian = within(screen.getByTestId("pemakaian-satker"));
    expect(pemakaian.getByText(/Hakim Satu/)).toBeTruthy();
    expect(pemakaian.getByText("Rp1.500")).toBeTruthy();
    const riwayat = within(screen.getByTestId("riwayat-satker"));
    expect(riwayat.getByText("Isi saldo")).toBeTruthy();
    expect(riwayat.getByText("Pemakaian")).toBeTruthy();
    expect(riwayat.getByText("Super Admin")).toBeTruthy(); // siapa mengisi
    expect(riwayat.getAllByText("Hakim Satu").length).toBeGreaterThan(0); // siapa memakai
  });

  it("isi saldo mengirim POST dan menampilkan saldo baru; tombol mati bila jumlah kosong", async () => {
    render(<KartuDompetSatker pengguna={PENGGUNA} peran={PERAN} />);
    await screen.findByTestId("saldo-satker");
    const tombol = screen.getByRole("button", { name: "Isi saldo satker" }) as HTMLButtonElement;
    expect(tombol.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Jumlah isi saldo satker (Rp)"), { target: { value: "25000" } });
    fireEvent.change(screen.getByLabelText(/Catatan isi satker/), { target: { value: "Tambahan" } });
    fireEvent.click(tombol);
    await waitFor(() => expect(panggilan.some((p) => p.metode === "POST")).toBe(true));
    expect(panggilan.find((p) => p.metode === "POST")!.badan).toEqual({ jumlahRp: 25000, catatan: "Tambahan" });
    await waitFor(() => expect(screen.getByTestId("saldo-satker").textContent).toBe("Rp100.000"));
    expect(screen.getByText(/Saldo satker terisi/)).toBeTruthy();
  });

  it("menambah aturan untuk satu pengguna (batas bulanan) lewat PUT, lalu menghapus aturan lewat DELETE", async () => {
    render(<KartuDompetSatker pengguna={PENGGUNA} peran={PERAN} />);
    await screen.findByTestId("saldo-satker");
    const simpan = screen.getByRole("button", { name: "Simpan aturan" }) as HTMLButtonElement;
    expect(simpan.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Berlaku untuk"), { target: { value: "pengguna" } });
    fireEvent.change(screen.getByLabelText("Pengguna"), { target: { value: "usr-1" } });
    fireEvent.change(screen.getByLabelText("Batas per bulan (Rp)"), { target: { value: "20000" } });
    fireEvent.click(simpan);
    await waitFor(() => expect(panggilan.some((p) => p.metode === "PUT")).toBe(true));
    expect(panggilan.find((p) => p.metode === "PUT")!.badan).toEqual({ sasaran: "pengguna", sasaranId: "usr-1", boleh: true, batasBulananRp: 20000 });
    await waitFor(() => expect(within(screen.getByTestId("aturan-satker")).getByText(/batas Rp20\.000 per bulan/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Hapus aturan Hakim" }));
    await waitFor(() => expect(panggilan.some((p) => p.metode === "DELETE")).toBe(true));
    expect(panggilan.find((p) => p.metode === "DELETE")!.url).toContain("sasaran=peran&sasaranId=hakim");
    await waitFor(() => expect(within(screen.getByTestId("aturan-satker")).queryByText("Hakim")).toBeNull());
  });

  it("penolakan server tampil sebagai kalimat biasa", async () => {
    fetchTiruan.mockImplementation(async (_url: string, init?: RequestInit) => ((init?.method ?? "GET") === "POST" ? jawab("Jumlah isi saldo satker harus antara Rp1 dan Rp1.000.000.000.", 400) : jawab(data)));
    render(<KartuDompetSatker pengguna={PENGGUNA} peran={PERAN} />);
    await screen.findByTestId("saldo-satker");
    fireEvent.change(screen.getByLabelText("Jumlah isi saldo satker (Rp)"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Isi saldo satker" }));
    expect(await screen.findByText(/harus antara Rp1/)).toBeTruthy();
  });
});
