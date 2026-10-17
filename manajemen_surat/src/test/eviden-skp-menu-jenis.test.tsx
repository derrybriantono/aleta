import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EvidenSkpMenu } from "@/components/portal/eviden-skp-menu";
import { RekapPetugas } from "@/components/portal/rekap-petugas";
import { hariIniWita, bulanSelesaiTerakhir } from "@/components/portal/skp-umum";

/**
 * ============================================================================
 * MENU UNDUH EVIDEN SKP - JENIS SKP (KETUA/WAKIL) DAN PERIODE BULANAN
 * ============================================================================
 *
 * Yang dijaga:
 *   - pilihan "Jenis SKP: SKP Hakim / SKP Pimpinan" hanya untuk Ketua dan
 *     Wakil Ketua; hakim biasa dan pemanggil lama tidak melihatnya;
 *   - perilaku lama hakim (Triwulan/Tahunan) tetap lewat rute eviden lama;
 *   - periode bulanan dan SKP Pimpinan lewat rute SKP (daftar dan unduh);
 *   - tanda tangan pejabat penilai (bukan Ketua) untuk SKP Pimpinan.
 */

const keadaan = vi.hoisted(() => ({ pengguna: null as { roleId: string } | null }));
vi.mock("@/lib/app-state", () => ({ usePortal: () => ({ currentUser: keadaan.pengguna }) }));

const DAFTAR = {
  periode: { kunci: "b09", tahun: 2026, label: "September", labelPanjang: "Bulan September Tahun 2026" },
  orang: { id: "26", nama: "Dr. Ketua Contoh" },
  ketua: { nama: "Dr. Ketua Contoh" },
  dokumen: [{ kunci: "lembar-skp", judul: "LEMBAR SKP", judulLengkap: "Lembar SKP September", tersedia: true, sebabTidakTersedia: null, jumlahBaris: 9 }],
  galat: [],
  catatanOperator: [],
  dariPenetapan: false,
};

function jawabanJson(badan: unknown, status = 200): Response {
  return new Response(JSON.stringify(badan), { status, headers: { "Content-Type": "application/json" } });
}

function pasangFetch(jawab?: (url: URL) => Response) {
  const ambil = vi.fn(async (alamat: string) => {
    const url = new URL(String(alamat), "http://portal.contoh");
    if (jawab) return jawab(url);
    if (url.pathname.endsWith("/rekap-petugas")) return jawabanJson({ ok: true, data: { available: false, rekap: null, pesan: "Bot mati (uji)." } });
    return jawabanJson({ ok: true, data: DAFTAR });
  });
  vi.stubGlobal("fetch", ambil);
  return ambil;
}

const kueri = (alamat: unknown) => {
  const u = new URL(String(alamat), "http://portal.contoh");
  return { pathname: u.pathname, kueri: Object.fromEntries(u.searchParams) };
};
const daftarTerakhir = (ambil: ReturnType<typeof pasangFetch>) =>
  kueri(ambil.mock.calls.filter((c) => !String(c[0]).includes("/unduh")).at(-1)![0]);

beforeEach(() => {
  keadaan.pengguna = null;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("pilihan Jenis SKP", () => {
  it("pemanggil lama / hakim biasa: tidak ada pilihan Jenis SKP", async () => {
    pasangFetch();
    render(<EvidenSkpMenu peran="hakim" id={26} onTutup={() => {}} />);
    await screen.findByText("Lembar SKP September");
    expect(screen.queryByLabelText("Jenis SKP")).toBeNull();
  });

  it("dinyalakan: SKP Hakim bawaan memakai rute lama persis seperti dulu", async () => {
    const ambil = pasangFetch();
    render(<EvidenSkpMenu peran="hakim" id={26} onTutup={() => {}} pilihanJenis />);
    await screen.findByText("Lembar SKP September");
    const pilihan = screen.getByLabelText("Jenis SKP") as HTMLSelectElement;
    expect(Array.from(pilihan.options).map((o) => o.textContent)).toEqual(["SKP Hakim", "SKP Pimpinan"]);
    expect(pilihan.value).toBe("hakim");
    expect(daftarTerakhir(ambil).pathname).toBe("/api/aleta-ecourt/eviden-skp");
    expect(daftarTerakhir(ambil).kueri.jenis).toBeUndefined();
  });

  it("SKP Pimpinan: daftar dan unduhan lewat rute SKP dengan jenis=pimpinan dan ID SIPP", async () => {
    const ambil = pasangFetch();
    render(<EvidenSkpMenu peran="hakim" id={26} onTutup={() => {}} pilihanJenis />);
    await screen.findByText("Lembar SKP September");
    fireEvent.change(screen.getByLabelText("Jenis SKP"), { target: { value: "pimpinan" } });
    await waitFor(() => expect(daftarTerakhir(ambil).pathname).toBe("/api/skp/daftar"));
    expect(daftarTerakhir(ambil).kueri).toMatchObject({ jenis: "pimpinan", id: "26" });

    const tautan = await screen.findByRole("link", { name: "Unduh Lembar SKP September sebagai PDF" });
    const u = kueri(tautan.getAttribute("href"));
    expect(u.pathname).toBe("/api/skp/unduh");
    expect(u.kueri).toMatchObject({ jenis: "pimpinan", id: "26", dokumen: "lembar-skp", format: "pdf" });
    // Tanda tangan di kanan adalah pejabat penilai, bukan Ketua.
    expect(screen.getAllByText(/pejabat penilai di kanan/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Mengetahui:/)).toBeNull();
  });

  it("kembali ke SKP Hakim: rute lama lagi", async () => {
    const ambil = pasangFetch();
    render(<EvidenSkpMenu peran="hakim" id={26} onTutup={() => {}} pilihanJenis />);
    await screen.findByText("Lembar SKP September");
    fireEvent.change(screen.getByLabelText("Jenis SKP"), { target: { value: "pimpinan" } });
    await waitFor(() => expect(daftarTerakhir(ambil).pathname).toBe("/api/skp/daftar"));
    fireEvent.change(screen.getByLabelText("Jenis SKP"), { target: { value: "hakim" } });
    await waitFor(() => expect(daftarTerakhir(ambil).pathname).toBe("/api/aleta-ecourt/eviden-skp"));
  });

  it("angka dari penetapan terkunci disebut di menu", async () => {
    pasangFetch(() => jawabanJson({ ok: true, data: { ...DAFTAR, dariPenetapan: true } }));
    render(<EvidenSkpMenu peran="hakim" id={26} onTutup={() => {}} pilihanJenis />);
    await screen.findByText(/diambil dari penetapan yang sudah dikunci/);
  });
});

describe("periode bulanan", () => {
  it("memilih Bulanan menampilkan pilihan bulan dan meminta daftar lewat rute SKP (SKP Hakim)", async () => {
    const ambil = pasangFetch();
    render(<EvidenSkpMenu peran="hakim" id={26} onTutup={() => {}} />);
    await screen.findByText("Lembar SKP September");
    expect(screen.queryByLabelText("Bulan SKP")).toBeNull();
    fireEvent.click(screen.getByLabelText("Bulanan"));
    const bulan = (await screen.findByLabelText("Bulan SKP")) as HTMLSelectElement;
    expect(bulan.options).toHaveLength(12);
    await waitFor(() => expect(daftarTerakhir(ambil).pathname).toBe("/api/skp/daftar"));
    expect(daftarTerakhir(ambil).kueri).toMatchObject({ jenis: "hakim", id: "26", periode: expect.stringMatching(/^b\d\d$/) });

    fireEvent.change(bulan, { target: { value: "b01" } });
    await waitFor(() => expect(daftarTerakhir(ambil).kueri.periode).toBe("b01"));
    const tautan = await screen.findByRole("link", { name: "Unduh Lembar SKP September sebagai Word" });
    expect(kueri(tautan.getAttribute("href")).kueri).toMatchObject({ jenis: "hakim", periode: "b01", format: "docx" });
  });

  it("bulan yang belum dimulai tidak dapat dipilih", async () => {
    pasangFetch();
    render(<EvidenSkpMenu peran="hakim" id={26} onTutup={() => {}} />);
    await screen.findByText("Lembar SKP September");
    fireEvent.click(screen.getByLabelText("Bulanan"));
    const bulan = (await screen.findByLabelText("Bulan SKP")) as HTMLSelectElement;
    const hariIni = hariIniWita();
    const tahunIni = Number(hariIni.slice(0, 4));
    const nomorIni = Number(hariIni.slice(5, 7));
    const tahun = screen.getByLabelText("Tahun SKP") as HTMLSelectElement;
    expect(Number(tahun.value)).toBeLessThanOrEqual(tahunIni);
    Array.from(bulan.options).forEach((o, i) => {
      // Tahun bawaan bisa tahun lalu (Januari-Maret); hanya tahun berjalan yang punya bulan mendatang.
      if (Number(tahun.value) === tahunIni) expect(o.disabled, o.textContent ?? "").toBe(i + 1 > nomorIni);
      else expect(o.disabled).toBe(false);
    });
  });

  it("bulan terakhir yang selesai: Januari jatuh ke Desember tahun lalu", () => {
    expect(bulanSelesaiTerakhir("2026-01-05")).toEqual({ tahun: 2025, periode: "b12" });
    expect(bulanSelesaiTerakhir("2026-10-17")).toEqual({ tahun: 2026, periode: "b09" });
  });

  it("Triwulan/Tahunan hakim tetap lewat rute lama", async () => {
    const ambil = pasangFetch();
    render(<EvidenSkpMenu peran="hakim" id={26} onTutup={() => {}} />);
    await screen.findByText("Lembar SKP September");
    fireEvent.click(screen.getByLabelText("Tahunan"));
    await waitFor(() => expect(daftarTerakhir(ambil).kueri.periode).toBe("tahun"));
    expect(daftarTerakhir(ambil).pathname).toBe("/api/aleta-ecourt/eviden-skp");
  });
});

describe("tombol di halaman Rekap Hakim", () => {
  const bukaMenu = async () => {
    pasangFetch();
    render(<RekapPetugas peran="hakim" id="26" />);
    fireEvent.click(screen.getByRole("button", { name: "Unduh eviden SKP" }));
    return screen.findByRole("dialog", { name: "Unduh eviden SKP" });
  };

  it.each(["ketua", "wakil-ketua"])("%s melihat pilihan Jenis SKP", async (roleId) => {
    keadaan.pengguna = { roleId };
    const dialog = await bukaMenu();
    await within(dialog).findByText("Lembar SKP September");
    expect(within(dialog).getByLabelText("Jenis SKP")).toBeTruthy();
  });

  it.each(["hakim", "panitera", "admin", "super-admin", "pelaksana"])("%s tidak melihat pilihan Jenis SKP", async (roleId) => {
    keadaan.pengguna = { roleId };
    const dialog = await bukaMenu();
    await within(dialog).findByText("Lembar SKP September");
    expect(within(dialog).queryByLabelText("Jenis SKP")).toBeNull();
  });

  it("tanpa penyedia keadaan portal (uji berdiri sendiri): tidak ada pilihan, tidak galat", async () => {
    keadaan.pengguna = null;
    const dialog = await bukaMenu();
    await within(dialog).findByText("Lembar SKP September");
    expect(within(dialog).queryByLabelText("Jenis SKP")).toBeNull();
  });
});
