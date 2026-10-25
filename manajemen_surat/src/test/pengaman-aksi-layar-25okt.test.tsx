import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PanelPengaman } from "@/components/portal/keamanan/panel-pengaman";
import { PengamanAksiGlobal } from "@/components/portal/keamanan/pengaman-aksi-global";
import { bacaPermintaanPengaman } from "@/lib/keamanan-klien";

/**
 * Pengaman aksi admin (Bagian 6c) dirender sungguhan (jsdom):
 *   - kotak konfirmasi muncul sendiri saat rute menjawab 403 "pengaman_aksi" dan
 *     permintaan SAMA diulang dengan tiga header konfirmasi (layar pemanggil tidak diubah);
 *   - dibatalkan -> jawaban 403 aslinya yang kembali; sandi salah -> kotak muncul lagi
 *     dengan kalimat dari server; 403 biasa dan alamat luar tidak disentuh;
 *   - panel pengaturan: bawaan mati, hak ubah, simpan mengirim semua pilihan.
 */

const jsonRespons = (status: number, isi: unknown) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
const minta = (salah = "") => ({
  ok: false,
  error: {
    message: "Mengubah batas perangkat meminta konfirmasi.",
    details: { alasan: "pengaman_aksi", kode: "perangkat.ubah-batas", label: "Mengubah batas perangkat", kataKonfirmasi: "UBAH BATAS", perluKodeKedua: false, salah },
  },
});

let panggilan: Array<{ url: string; headers: Record<string, string>; body: unknown }> = [];
let asli: typeof window.fetch;

beforeEach(() => {
  panggilan = [];
  asli = window.fetch;
});
afterEach(() => {
  cleanup();
  window.fetch = asli;
  vi.unstubAllGlobals();
});

function pasangServer(perilaku: (headers: Headers, url: string) => Response) {
  window.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const headers = new Headers(init?.headers);
    panggilan.push({ url, headers: Object.fromEntries(headers.entries()), body: init?.body });
    return perilaku(headers, url);
  }) as unknown as typeof window.fetch;
}

describe("pembaca permintaan pengaman", () => {
  it("hanya mengenali details.alasan = pengaman_aksi", () => {
    expect(bacaPermintaanPengaman(minta())).toMatchObject({ kode: "perangkat.ubah-batas", kataKonfirmasi: "UBAH BATAS", perluKodeKedua: false });
    expect(bacaPermintaanPengaman({ ok: false, error: { message: "Tidak berhak", details: { alasan: "matriks_peran" } } })).toBeNull();
    expect(bacaPermintaanPengaman({ ok: false, error: { message: "x" } })).toBeNull();
    expect(bacaPermintaanPengaman(null)).toBeNull();
  });
});

describe("kotak konfirmasi global", () => {
  it("meminta sandi + kata, lalu mengulang permintaan yang sama dengan header konfirmasi", async () => {
    pasangServer((h) => (h.get("x-aleta-pengaman-sandi") === "rahasia" && h.get("x-aleta-pengaman-ketik") === "UBAH BATAS" ? jsonRespons(200, { ok: true, data: { tersimpan: true } }) : jsonRespons(403, minta())));
    render(<PengamanAksiGlobal />);
    let hasil: Promise<Response> | null = null;
    act(() => {
      hasil = window.fetch("/aleta/api/admin/batas-perangkat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ maks: 3 }) });
    });
    const kotak = await screen.findByRole("dialog");
    expect(kotak.textContent).toContain("Mengubah batas perangkat");
    const tombol = screen.getByRole("button", { name: "Lanjutkan" }) as HTMLButtonElement;
    expect(tombol.disabled).toBe(true);
    fireEvent.change(document.querySelector("input[type=password]")!, { target: { value: "rahasia" } });
    fireEvent.change(screen.getByPlaceholderText("UBAH BATAS"), { target: { value: "UBAH BATAS" } });
    expect(tombol.disabled).toBe(false);
    fireEvent.click(tombol);
    const r = await hasil!;
    expect(r.status).toBe(200);
    expect(panggilan).toHaveLength(2);
    expect(panggilan[1].body).toBe(JSON.stringify({ maks: 3 }));
    expect(panggilan[1].headers["content-type"]).toBe("application/json");
    expect(panggilan[1].headers["x-aleta-pengaman-sandi"]).toBe("rahasia");
    expect(panggilan[1].headers["x-aleta-pengaman-kode"]).toBeUndefined();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("Batal mengembalikan jawaban 403 aslinya (layar pemanggil menampilkan kalimat server)", async () => {
    pasangServer(() => jsonRespons(403, minta()));
    render(<PengamanAksiGlobal />);
    let hasil: Promise<Response> | null = null;
    act(() => {
      hasil = window.fetch("/api/x", { method: "DELETE" });
    });
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Batal" }));
    const r = await hasil!;
    expect(r.status).toBe(403);
    expect((await r.json()).error.message).toMatch(/meminta konfirmasi/);
    expect(panggilan).toHaveLength(1);
  });

  it("sandi salah: kotak muncul lagi memuat kalimat server; permintaan kode kedua menampilkan kolom kode", async () => {
    let n = 0;
    pasangServer((h) => {
      n += 1;
      if (n === 1) return jsonRespons(403, { ...minta(), error: { ...minta().error, details: { ...minta().error.details, perluKodeKedua: true } } });
      if (h.get("x-aleta-pengaman-sandi") === "benar") return jsonRespons(200, { ok: true });
      return jsonRespons(403, { ...minta("Sandi tidak cocok."), error: { message: "Sandi yang Anda masukkan tidak cocok.", details: { ...minta("Sandi tidak cocok.").error.details, perluKodeKedua: true } } });
    });
    render(<PengamanAksiGlobal />);
    let hasil: Promise<Response> | null = null;
    act(() => {
      hasil = window.fetch("/api/x", { method: "POST" });
    });
    await screen.findByRole("dialog");
    expect(screen.getByText("Kode langkah kedua")).toBeTruthy();
    const isi = (sandi: string) => {
      fireEvent.change(document.querySelector("input[type=password]")!, { target: { value: sandi } });
      fireEvent.change(screen.getByPlaceholderText("UBAH BATAS"), { target: { value: "UBAH BATAS" } });
      fireEvent.change(document.querySelector("input[autocomplete=one-time-code]")!, { target: { value: "123456" } });
      fireEvent.click(screen.getByRole("button", { name: "Lanjutkan" }));
    };
    isi("salah");
    await screen.findByText("Sandi tidak cocok.");
    isi("benar");
    expect((await hasil!).status).toBe(200);
    expect(panggilan.at(-1)?.headers["x-aleta-pengaman-kode"]).toBe("123456");
  });

  it("403 biasa, jawaban bukan JSON, dan alamat luar/bukan API diteruskan apa adanya tanpa kotak", async () => {
    pasangServer((_h, url) => (url.includes("tidak-berhak") ? jsonRespons(403, { ok: false, error: { message: "Tidak berhak", details: { alasan: "matriks_peran" } } }) : new Response("<html>", { status: 403 })));
    render(<PengamanAksiGlobal />);
    expect((await window.fetch("/api/tidak-berhak", { method: "POST" })).status).toBe(403);
    expect((await window.fetch("/api/html", { method: "POST" })).status).toBe(403);
    expect((await window.fetch("https://contoh.luar/api/x")).status).toBe(403);
    expect((await window.fetch("/halaman-biasa")).status).toBe(403);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(panggilan).toHaveLength(4);
  });

  it("dilepas saat komponen dicabut: fetch asli dipulihkan", () => {
    const awal = window.fetch;
    const { unmount } = render(<PengamanAksiGlobal />);
    expect(window.fetch).not.toBe(awal);
    unmount();
    expect(window.fetch).toBe(awal);
  });
});

describe("panel pengaman aksi", () => {
  const KATALOG = [
    { kode: "peran.ubah-hak", label: "Mengubah hak peran atau akses menu", kataKonfirmasi: "UBAH HAK", keterangan: "x", tersambung: true },
    { kode: "lihat-sebagai", label: "Lihat sebagai pengguna lain", kataKonfirmasi: "LIHAT SEBAGAI", keterangan: "y", tersambung: false },
  ];
  const PENGAMAN = { aktif: false, aksi: { "peran.ubah-hak": true, "lihat-sebagai": true }, batasHapus: 20, langkahKedua: false };
  const bodi: unknown[] = [];

  beforeEach(() => {
    bodi.length = 0;
    pasangServer((_h, url) => {
      void url;
      return jsonRespons(200, { ok: true, data: { pengaman: PENGAMAN, katalog: KATALOG, langkahKeduaTersedia: false } });
    });
    const dasar = window.fetch;
    window.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") bodi.push(JSON.parse(String(init.body)));
      return dasar(input, init);
    }) as unknown as typeof window.fetch;
  });

  it("bawaan mati; aksi yang belum tersambung diberi tanda; langkah kedua nonaktif tanpa kait", async () => {
    render(<PanelPengaman bolehUbah />);
    await screen.findByText("Mati");
    expect(screen.getByText("Menunggu fitur terkait")).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Minta juga kode langkah kedua" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/Tersedia begitu verifikasi dua langkah/)).toBeTruthy();
  });

  it("menyalakan dan mematikan satu aksi lalu menyimpan: badan memuat semua pilihan", async () => {
    render(<PanelPengaman bolehUbah />);
    await screen.findByText("Mati");
    fireEvent.click(screen.getByRole("switch", { name: "Nyalakan pengaman aksi admin" }));
    fireEvent.click(screen.getByRole("switch", { name: "Jaga aksi: Mengubah hak peran atau akses menu" }));
    fireEvent.click(screen.getByRole("button", { name: /Simpan pengaman aksi/ }));
    await screen.findByText("Tersimpan.");
    expect(bodi.at(-1)).toEqual({ aktif: true, aksi: { "peran.ubah-hak": false, "lihat-sebagai": true }, batasHapus: 20, langkahKedua: false });
  });

  it("tanpa hak ubah semua kendali nonaktif", async () => {
    render(<PanelPengaman bolehUbah={false} />);
    await screen.findByText("Mati");
    expect(screen.getByRole("switch", { name: "Nyalakan pengaman aksi admin" }).hasAttribute("disabled")).toBe(true);
    expect((screen.getByRole("button", { name: /Simpan pengaman aksi/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
