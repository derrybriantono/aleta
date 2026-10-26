import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PanelJaringan } from "@/components/portal/keamanan/panel-jaringan";
import { JaringanDitolak } from "@/components/portal/jaringan-ditolak";

/**
 * Batas jaringan per peran (Bagian 6b) dirender sungguhan (jsdom) dengan fetch tiruan:
 * alamat Anda tampil, daftar jaringan dapat ditambah/dihapus, aturan per peran memanggil
 * rute, "verifikasi luar kantor" dinonaktifkan selama kaitnya belum ada, dan tanpa hak
 * ubah semua kendali nonaktif.
 */

vi.mock("@/lib/app-state", () => ({
  usePortal: () => ({
    roles: [
      { id: "hakim", name: "Hakim" },
      { id: "panitera", name: "Panitera" },
    ],
  }),
}));

const fetchTiruan = vi.fn();
let panggilan: Array<{ url: string; metode: string; badan: unknown }> = [];
let subnet: Array<{ id: string; cidr: string; label: string; aktif: boolean }> = [];
let aturan: Array<{ roleId: string; aturan: string }> = [];
const jawab = (data: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 400, json: async () => ({ ok, data: ok ? data : undefined, error: ok ? undefined : { message: String(data) } }) }) as unknown as Response;
const muatan = () => ({
  konfigurasi: { subnet, aturan },
  aturanTersedia: [
    { kode: "mana-pun", label: "Dari mana pun", tersedia: true },
    { kode: "kantor-saja", label: "Hanya dari jaringan kantor", tersedia: true },
    { kode: "luar-kantor-verifikasi", label: "Dari luar kantor wajib verifikasi", tersedia: false },
  ],
  ipAnda: "192.168.10.30",
  andaDalamKantor: subnet.some((s) => s.cidr === "192.168.10.0/24" && s.aktif),
});

beforeEach(() => {
  panggilan = [];
  subnet = [];
  aturan = [];
  fetchTiruan.mockImplementation(async (url: string, init?: RequestInit) => {
    const metode = init?.method ?? "GET";
    const badan = init?.body ? JSON.parse(String(init.body)) : undefined;
    panggilan.push({ url, metode, badan });
    if (metode === "POST") {
      if (badan.aksi === "tambah-subnet") subnet = [...subnet, { id: `s${subnet.length + 1}`, cidr: badan.cidr, label: badan.label ?? "", aktif: true }];
      if (badan.aksi === "hapus-subnet") subnet = subnet.filter((s) => s.id !== badan.id);
      if (badan.aksi === "atur-peran") {
        if (!subnet.length && badan.aturan !== "mana-pun") return jawab("Isi dulu daftar jaringan kantor (minimal satu yang aktif) sebelum membatasi peran mana pun.", false);
        aturan = aturan.filter((a) => a.roleId !== badan.roleId);
        if (badan.aturan !== "mana-pun") aturan.push({ roleId: badan.roleId, aturan: badan.aturan });
      }
    }
    return jawab(muatan());
  });
  vi.stubGlobal("fetch", fetchTiruan);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("panel batas jaringan", () => {
  it("bawaan: tanpa pembatasan, semua peran 'Dari mana pun'; alamat Anda tampil; verifikasi luar kantor dinonaktifkan", async () => {
    render(<PanelJaringan bolehUbah />);
    await screen.findByText("Tidak ada pembatasan");
    expect(screen.getByText("192.168.10.30").tagName).toBe("STRONG");
    const hakim = screen.getByLabelText("Aturan jaringan Hakim") as HTMLSelectElement;
    expect(hakim.value).toBe("mana-pun");
    const opsi = within(hakim).getByRole("option", { name: /wajib verifikasi \(belum tersedia\)/ }) as HTMLOptionElement;
    expect(opsi.disabled).toBe(true);
    expect(screen.getByText("Belum ada jaringan kantor yang didaftarkan.")).toBeTruthy();
  });

  it("menambah jaringan, lalu membatasi satu peran: badan kiriman benar dan lencana berubah", async () => {
    render(<PanelJaringan bolehUbah />);
    await screen.findByText("Tidak ada pembatasan");
    fireEvent.change(screen.getByLabelText("Alamat jaringan"), { target: { value: "192.168.10.0/24" } });
    fireEvent.change(screen.getByLabelText("Keterangan jaringan"), { target: { value: "Kantor lt.1" } });
    fireEvent.click(screen.getByRole("button", { name: "Tambah" }));
    await screen.findByText("192.168.10.0/24");
    expect(panggilan.find((p) => p.badan && (p.badan as { aksi?: string }).aksi === "tambah-subnet")?.badan).toEqual({ aksi: "tambah-subnet", cidr: "192.168.10.0/24", label: "Kantor lt.1" });
    expect(document.querySelector("[data-alamat-anda]")?.textContent).toContain("(di jaringan kantor)");

    fireEvent.change(screen.getByLabelText("Aturan jaringan Hakim"), { target: { value: "kantor-saja" } });
    await screen.findByText("Ada peran dibatasi");
    expect(panggilan.at(-1)?.badan).toEqual({ aksi: "atur-peran", roleId: "hakim", aturan: "kantor-saja" });
    expect((screen.getByLabelText("Aturan jaringan Panitera") as HTMLSelectElement).value).toBe("mana-pun");
  });

  it("galat server (daftar kosong) tampil sebagai kalimat, bukan hilang", async () => {
    render(<PanelJaringan bolehUbah />);
    await screen.findByText("Tidak ada pembatasan");
    fireEvent.change(screen.getByLabelText("Aturan jaringan Hakim"), { target: { value: "kantor-saja" } });
    await screen.findByText(/Isi dulu daftar jaringan kantor/);
  });

  it("tanpa hak ubah: semua kendali nonaktif dan formulir tambah tidak ada", async () => {
    subnet = [{ id: "s1", cidr: "192.168.10.0/24", label: "Kantor", aktif: true }];
    render(<PanelJaringan bolehUbah={false} />);
    await screen.findByText("192.168.10.0/24");
    expect((screen.getByLabelText("Aturan jaringan Hakim") as HTMLSelectElement).disabled).toBe(true);
    expect(screen.queryByLabelText("Alamat jaringan")).toBeNull();
    expect(screen.queryByLabelText("Hapus 192.168.10.0/24")).toBeNull();
    expect(screen.getByRole("switch", { name: "Aktifkan 192.168.10.0/24" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/Hanya Super Admin yang dapat mengubahnya/)).toBeTruthy();
  });

  it("hapus jaringan memanggil rute", async () => {
    subnet = [{ id: "s1", cidr: "192.168.10.0/24", label: "Kantor", aktif: true }];
    render(<PanelJaringan bolehUbah />);
    await screen.findByText("192.168.10.0/24");
    fireEvent.click(screen.getByLabelText("Hapus 192.168.10.0/24"));
    await waitFor(() => expect(screen.queryByText("192.168.10.0/24")).toBeNull());
    expect(panggilan.at(-1)?.badan).toEqual({ aksi: "hapus-subnet", id: "s1" });
  });
});

describe("layar jaringan ditolak", () => {
  it("menampilkan pesan putusan, menjelaskan sesi tidak dihapus, dan menyediakan Keluar", () => {
    render(<JaringanDitolak pesan="Akun Anda hanya dapat masuk dari jaringan kantor." />);
    expect(screen.getByText("Akses dari jaringan ini tidak diizinkan")).toBeTruthy();
    expect(screen.getByText("Akun Anda hanya dapat masuk dari jaringan kantor.")).toBeTruthy();
    expect(screen.getByText(/Sesi Anda tidak dihapus/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Keluar/ })).toBeTruthy();
  });
});
