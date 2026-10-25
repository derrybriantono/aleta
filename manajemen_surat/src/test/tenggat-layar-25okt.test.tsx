import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BerkasOtomatisKartu } from "@/components/portal/berkas-otomatis-kartu";
import { TenggatLayar } from "@/components/portal/tenggat-layar";
import { ATURAN_BARU, ATURAN_TENGGAT, SEMUA_ATURAN, STATUS_DIKABULKAN, nilaiTenggat, type FaktaTenggat } from "@/lib/penjaga-tenggat";
import { SETELAN_TENGGAT_BAWAAN } from "@/lib/tenggat-terjadwal";

/**
 * Layar Tenggat (G1, 25 Okt 2026): data rekaan, fetch tiruan. Yang diuji perilaku layar: hitungan, saringan,
 * saklar yang mati bawaan, dan yang TIDAK tampil bagi peran yang bukan pengelola.
 */

const potal = vi.hoisted(() => ({ nilai: { currentUser: { name: "Budi Santoso", roleId: "super-admin" }, accessiblePortalApps: [{ id: "aleta-ecourt" }] } as Record<string, unknown> }));
vi.mock("@/lib/app-state", () => ({ usePortal: () => potal.nilai }));

function fakta(ubah: Partial<FaktaTenggat> = {}): FaktaTenggat {
  return { perkaraId: "1", nomorPerkara: "1/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", tanggalAcuan: "2026-10-01", statusPutusanId: STATUS_DIKABULKAN, ...ubah };
}

const rapor = nilaiTenggat(
  {
    "akta-cerai-gugat": [
      fakta({ nomorPerkara: "1/Pdt.G/2026/PA.Dgl", majelis: "Budi Santoso, S.H.", panitera: "Citra Lestari, S.H." }),
      fakta({ perkaraId: "2", nomorPerkara: "2/Pdt.G/2026/PA.Dgl", majelis: "Dewi Anggraini, S.H.", panitera: "Hana Putri, S.H." }),
    ],
    "banding-14-hari": [fakta({ perkaraId: "3", nomorPerkara: "3/Pdt.G/2026/PA.Dgl", tanggalAcuan: "2026-10-14", tanggalBatas: "2026-10-28", pihakKe: 1, pasti: true, majelis: "Budi Santoso, S.H." })],
    "mediasi-30-hari": [fakta({ perkaraId: "4", nomorPerkara: "4/Pdt.G/2026/PA.Dgl", tanggalAcuan: "2026-10-10", tanggalBatas: "2026-11-09", majelis: "Dewi Anggraini, S.H." })],
  },
  "2026-10-26",
  { aturan: SEMUA_ATURAN, hitungMundur: true }
);

function data(ubah: Record<string, unknown> = {}) {
  return {
    tersedia: true,
    sumber: "harian",
    tanggal: "2026-10-26",
    dibuatPada: "2026-10-25T23:30:00.000Z",
    lihatSemua: true,
    bolehKelola: true,
    hitung: rapor.hitung,
    berjalan: rapor.berjalan,
    butir: rapor.butir,
    tumpukanLama: {},
    gagal: {},
    aturan: SEMUA_ATURAN.map((a) => ({ kode: a.kode, judul: a.judul, dasar: a.dasar, perluVerifikasi: Boolean(a.perluVerifikasi) })),
    setelan: { ...SETELAN_TENGGAT_BAWAAN },
    jalan: null,
    wa: null,
    ...ubah,
  };
}

function tiruFetch(isi: unknown, status = 200) {
  const f = vi.fn(async (_url: string, init?: RequestInit) => ({
    ok: status < 400,
    status,
    json: async () => (init?.method === "POST" ? { data: { ok: true } } : { data: isi }),
  }));
  vi.stubGlobal("fetch", f);
  return f;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TenggatLayar", () => {
  it("rangkuman, baris, dan hitung mundur tampil; aturan baru berdasar sudah diperiksa Derry (tanpa lencana belum diperiksa)", async () => {
    tiruFetch(data());
    render(<TenggatLayar />);
    await waitFor(() => expect(screen.getByText("1/Pdt.G/2026/PA.Dgl")).toBeTruthy());
    expect(screen.getByText(/2 lewat tenggat/)).toBeTruthy();
    expect(screen.getByText(/1 menjelang/)).toBeTruthy();
    expect(screen.getByText(/1 berjalan/)).toBeTruthy();
    // hitung mundur dan batas
    expect(screen.getByText(/tinggal 2 hari \(batas 28-10-2026\)/)).toBeTruthy();
    expect(screen.getByText(/tinggal 14 hari \(batas 09-11-2026\)/)).toBeTruthy();
    expect(screen.queryAllByText(/dasar belum diperiksa/i).length).toBe(0);
    // dasar tiap aturan tertulis, dengan catatan sudah diperiksa Derry 26 Okt 2026
    expect(screen.queryAllByText(/PERLU VERIFIKASI/).length).toBe(0);
    expect(screen.getAllByText(/diperiksa Derry 26 Okt 2026/).length).toBe(ATURAN_BARU.length);
    for (const a of ATURAN_TENGGAT.slice(0, 1)) expect(screen.getAllByText(new RegExp(a.judul.slice(0, 12))).length).toBeGreaterThan(0);
  });

  it("aturan yang dasarnya memang belum diperiksa tetap berlencana (lencana tidak dihapus, hanya aturan G1 yang lolos)", async () => {
    tiruFetch(data({ aturan: [{ kode: "contoh", judul: "Aturan contoh", dasar: "Dasar contoh", perluVerifikasi: true }] }));
    render(<TenggatLayar />);
    await waitFor(() => expect(screen.getByText("1/Pdt.G/2026/PA.Dgl")).toBeTruthy());
    expect(screen.getAllByText(/dasar belum diperiksa/i).length).toBeGreaterThan(0);
  });

  it("saringan tingkat dan majelis mengurangi baris", async () => {
    tiruFetch(data());
    render(<TenggatLayar />);
    await waitFor(() => expect(screen.getByText("3/Pdt.G/2026/PA.Dgl")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Saring tingkat"), { target: { value: "berjalan" } });
    expect(screen.queryByText("1/Pdt.G/2026/PA.Dgl")).toBeNull();
    expect(screen.getByText("4/Pdt.G/2026/PA.Dgl")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Saring tingkat"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Saring majelis"), { target: { value: "Dewi Anggraini, S.H." } });
    expect(screen.queryByText("1/Pdt.G/2026/PA.Dgl")).toBeNull();
    expect(screen.getByText("2/Pdt.G/2026/PA.Dgl")).toBeTruthy();
    expect(screen.getByText("4/Pdt.G/2026/PA.Dgl")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Saring majelis"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("switch", { name: /Perkara saya saja/ }));
    // nama akun uji "Budi Santoso": perkara 1 dan 3
    expect(screen.queryByText("2/Pdt.G/2026/PA.Dgl")).toBeNull();
    expect(screen.getByText("3/Pdt.G/2026/PA.Dgl")).toBeTruthy();
  });

  it("Super Admin: saklar jadwal dan pengingat WhatsApp MATI bawaan; WA terkunci selama jadwal mati; menyalakan jadwal mengirim POST", async () => {
    const f = tiruFetch(data());
    render(<TenggatLayar />);
    await waitFor(() => expect(screen.getByText(/Jadwal harian mati/)).toBeTruthy());
    const wa = screen.getByRole("switch", { name: /Pengingat WhatsApp pribadi mati/ }) as HTMLButtonElement;
    expect(wa.disabled).toBe(true);
    const jadwal = screen.getByRole("switch", { name: /Jadwal harian mati/ });
    fireEvent.click(jadwal);
    await waitFor(() => {
      const post = f.mock.calls.find(([, init]) => init?.method === "POST");
      expect(post).toBeTruthy();
      expect(JSON.parse(String(post?.[1]?.body))).toEqual({ aksi: "setelan", jadwal: true });
    });
    // aturan baru TIDAK dicentang di daftar pengingat; aturan lama dicentang
    const kotakBanding = screen.getByRole("checkbox", { name: /Masa banding 14 hari/ }) as HTMLInputElement;
    expect(kotakBanding.checked).toBe(false);
    const kotakAkta = screen.getAllByRole("checkbox").filter((c) => (c as HTMLInputElement).checked);
    expect(kotakAkta.length).toBe(ATURAN_TENGGAT.length);
  });

  it("bukan pengelola: tanpa bagian pengaturan, tanpa saringan majelis/PP, dan ada keterangan 'hanya perkara yang namanya tercantum'", async () => {
    tiruFetch(data({ lihatSemua: false, bolehKelola: false, setelan: null }));
    render(<TenggatLayar />);
    await waitFor(() => expect(screen.getByText("1/Pdt.G/2026/PA.Dgl")).toBeTruthy());
    expect(screen.queryByLabelText("Pengaturan penjaga tenggat")).toBeNull();
    expect(screen.queryByLabelText("Saring majelis")).toBeNull();
    expect(screen.queryByLabelText("Saring panitera pengganti")).toBeNull();
    expect(screen.getByText(/Hanya perkara yang namanya tercantum/)).toBeTruthy();
    expect(within(document.body).queryByText(/Jadwal harian/)).toBeNull();
  });

  it("SIPP tidak terbaca: BUKAN berarti tidak ada tenggat", async () => {
    tiruFetch({ tersedia: false, alasan: "ALETA Bot tidak menjawab.", tanggal: "2026-10-26", lihatSemua: true, bolehKelola: false, setelan: null });
    render(<TenggatLayar />);
    await waitFor(() => expect(screen.getByText(/BUKAN berarti tidak ada tenggat/)).toBeTruthy());
    expect(screen.getByText(/ALETA Bot tidak menjawab/)).toBeTruthy();
  });

  it("aturan yang gagal dibaca disebut apa adanya (tidak diperiksa, bukan bersih)", async () => {
    tiruFetch(data({ gagal: { "mediasi-30-hari": "tabel tidak ada" } }));
    render(<TenggatLayar />);
    await waitFor(() => expect(screen.getByText(/Sebagian aturan tidak terbaca dari SIPP/)).toBeTruthy());
    expect(screen.getByText(/tabel tidak ada/)).toBeTruthy();
  });
});

describe("BerkasOtomatisKartu (G2)", () => {
  const setelan = { bukti: false, kesimpulan: false, buktiSaksi: false, diubahOleh: "" };

  it("Super Admin: tiga saklar MATI bawaan; menyalakan satu mengirim POST hanya untuk saklar itu", async () => {
    const f = tiruFetch({ setelan, bolehUbah: true });
    render(<BerkasOtomatisKartu />);
    await waitFor(() => expect(screen.getByText(/Isi otomatis dari berkas e-Court/)).toBeTruthy());
    expect(screen.getAllByRole("switch")).toHaveLength(3);
    for (const sw of screen.getAllByRole("switch")) expect((sw as HTMLElement).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText(/Daftar alat bukti dari e-Court ditulis otomatis .mati./)).toBeTruthy();
    fireEvent.click(screen.getByRole("switch", { name: /Kesimpulan para pihak/ }));
    await waitFor(() => {
      const post = f.mock.calls.find(([, init]) => init?.method === "POST");
      expect(post).toBeTruthy();
      expect(JSON.parse(String(post?.[1]?.body))).toEqual({ kesimpulan: true });
    });
  });

  it("bukan Super Admin: kartu tidak tampil sama sekali", async () => {
    const f = tiruFetch({ setelan, bolehUbah: false });
    render(<BerkasOtomatisKartu />);
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect(screen.queryByText(/Isi otomatis dari berkas e-Court/)).toBeNull();
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
  });
});
