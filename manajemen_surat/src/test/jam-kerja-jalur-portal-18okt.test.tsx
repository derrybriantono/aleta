import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/app-state", () => ({
  usePortal: () => ({ currentUser: { id: "usr_uji_1", roleId: "kasir" } }),
}));
vi.mock("@/components/portal/kasir-jurnal", () => ({ DialogKasir: () => null }));

import { IsiIkrarTalak } from "@/components/portal/isi-ikrar-talak";
import { BagianMassal } from "@/components/portal/kasir-otomatis";

/**
 * Jalur portal di luar jam kerja (keputusan 104, 18 Okt 2026, sambungan 1.205.9):
 * Kasir otomatis massal dan Isi form ikrar mengirim tanda tanyaJamKerja; bot
 * menjawab perluPilihan; layar memunculkan Antrekan (bawaan) / Tulis sekarang
 * dan mengirim ulang dengan pilihan itu.
 */
const KALIMAT =
  "Sekarang di luar jam kerja. Bila diantrekan, tulisan ini dikerjakan pada jam kerja berikutnya, Senin, 26 Oktober 2026 mulai pukul 07.30 WITA. Pilih Antrekan atau Tulis sekarang.";

type Panggilan = { url: string; badan: Record<string, unknown> | null };
function bungkus(isi: unknown) {
  return { ok: true, status: 200, json: async () => ({ data: isi }) } as unknown as Response;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Isi form ikrar di luar jam kerja", () => {
  it("mengirim tanyaJamKerja, memunculkan pilihan, lalu mengantrekan sesuai pilihan", async () => {
    const panggilan: Panggilan[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const badan = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
        panggilan.push({ url: String(url), badan });
        if (badan?.jamKerja === "antrekan") {
          return bungkus({ ok: true, diantrekan: true, kalimat: "Di luar jam kerja - diantrekan, dikerjakan Senin, 26 Oktober 2026 pukul 07.42 WITA." });
        }
        return bungkus({ ok: false, alasan: "di_luar_jam_kerja", kode: "di_luar_jam_kerja", perluPilihan: true, pesan: KALIMAT });
      })
    );
    render(<IsiIkrarTalak jadwalId={20400} perkaraId={10300} nomorPerkara="12/Pdt.G/2026/PA.Contoh" />);
    fireEvent.click(screen.getByRole("button", { name: /Isi form ikrar/ }));
    fireEvent.click(screen.getByRole("button", { name: "Ya, isi" }));

    const dialog = await screen.findByRole("alertdialog", { name: "Di luar jam kerja" });
    expect(dialog.textContent).toContain("Senin, 26 Oktober 2026");
    expect(screen.getByRole("button", { name: "Antrekan" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tulis sekarang" })).toBeTruthy();
    expect(panggilan[0].badan).toMatchObject({ kering: false, tanyaJamKerja: true });
    expect(panggilan[0].badan).not.toHaveProperty("jamKerja");

    fireEvent.click(screen.getByRole("button", { name: "Antrekan" }));
    await waitFor(() => expect(screen.getByText(/diantrekan, dikerjakan Senin/)).toBeTruthy());
    expect(panggilan[1].badan).toMatchObject({ tanyaJamKerja: true, jamKerja: "antrekan" });
  });

  it("Tulis sekarang mengirim jamKerja sekarang", async () => {
    const panggilan: Panggilan[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const badan = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
        panggilan.push({ url: String(url), badan });
        if (badan?.jamKerja === "sekarang") return bungkus({ ok: true, formSudahTerisi: false, tanggalIkrar: "2026-10-23" });
        return bungkus({ ok: false, kode: "di_luar_jam_kerja", perluPilihan: true, pesan: KALIMAT });
      })
    );
    render(<IsiIkrarTalak jadwalId={1} nomorPerkara="12/Pdt.G/2026/PA.Contoh" />);
    fireEvent.click(screen.getByRole("button", { name: /Isi form ikrar/ }));
    fireEvent.click(screen.getByRole("button", { name: "Ya, isi" }));
    await screen.findByRole("alertdialog", { name: "Di luar jam kerja" });
    fireEvent.click(screen.getByRole("button", { name: "Tulis sekarang" }));
    await waitFor(() => expect(screen.getByText(/terisi di SIPP/)).toBeTruthy());
    expect(panggilan[1].badan).toMatchObject({ jamKerja: "sekarang" });
  });
});

describe("Kasir otomatis massal di luar jam kerja", () => {
  const usulan = {
    kunci: "u1",
    tanggal: "2026-10-23",
    jenisBiayaId: 157,
    pihakKe: 1,
    pihakId: 5,
    uraian: "Panjar",
    jumlah: 10000,
    keterangan: "",
    jurusitaId: null,
    pilih: true,
    dasar: "uji",
  };
  const harian = {
    ok: true,
    available: true,
    tanggal: "2026-10-23",
    jumlahCalon: 1,
    lengkap: [],
    gagal: [],
    terpotong: false,
    akun: { ok: true, username: "kasir1" },
    perkara: [
      {
        perkaraId: 10300,
        nomorPerkara: "12/Pdt.G/2026/PA.Contoh",
        jenisPerkara: "Cerai Gugat",
        sebab: ["sidang"],
        keadaan: { kunci: "x", nama: "Sidang", lazim: [] },
        saldo: 0,
        saldoAkhir: 0,
        usulan: [usulan],
        ditawarkan: 1,
        catatan: [],
        perluPeriksa: false,
      },
    ],
  };

  it("menyimpan memunculkan pilihan Antrekan / Tulis sekarang, lalu mengantrekan dengan pilihan itu", async () => {
    const tulis: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (!init?.method || init.method === "GET") return bungkus(harian);
        const badan = JSON.parse(String(init.body)) as Record<string, unknown>;
        tulis.push(badan);
        if (badan.jamKerja === "antrekan") {
          return bungkus({ ok: true, diantrekan: true, kalimat: "Di luar jam kerja - diantrekan, dikerjakan Senin, 26 Oktober 2026 pukul 07.42 WITA." });
        }
        return bungkus({ ok: false, kode: "di_luar_jam_kerja", perluPilihan: true, pesan: KALIMAT });
      })
    );
    render(<BagianMassal onSunting={() => undefined} />);
    const simpan = await screen.findByRole("button", { name: /Simpan ke SIPP \(1 perkara\)/ });
    fireEvent.click(simpan);
    fireEvent.click(await screen.findByRole("button", { name: /Tekan sekali lagi/ }));

    await screen.findByRole("alertdialog", { name: "Di luar jam kerja" });
    expect(tulis).toHaveLength(1);
    expect(tulis[0]).toMatchObject({ kering: false, massal: true, tanyaJamKerja: true });
    expect(tulis[0]).not.toHaveProperty("jamKerja");

    fireEvent.click(screen.getByRole("button", { name: "Antrekan" }));
    await waitFor(() => expect(tulis).toHaveLength(2));
    expect(tulis[1]).toMatchObject({ tanyaJamKerja: true, jamKerja: "antrekan" });
    await waitFor(() => expect(screen.getAllByText(/diantrekan, dikerjakan Senin/).length).toBeGreaterThan(0));
  });

  it("pratinjau (uji coba) tidak menanyakan jam kerja", async () => {
    const tulis: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (!init?.method || init.method === "GET") return bungkus(harian);
        tulis.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        return bungkus({ ok: true, rencana: [{}] });
      })
    );
    render(<BagianMassal onSunting={() => undefined} />);
    fireEvent.click(await screen.findByRole("button", { name: /Pratinjau/ }));
    await waitFor(() => expect(tulis).toHaveLength(1));
    expect(tulis[0]).toMatchObject({ kering: true });
    expect(tulis[0]).not.toHaveProperty("tanyaJamKerja");
  });
});
