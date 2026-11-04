import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const pengguna = vi.hoisted(() => ({ aktif: { id: "usr_uji", roleId: "pelaksana", positionId: "pos-staf-umum", additionalRoleIds: ["kasir"] } as Record<string, unknown> }));
vi.mock("@/lib/app-state", () => ({
  usePortal: () => ({ currentUser: pengguna.aktif }),
}));
vi.mock("@/components/portal/kasir-jurnal", () => ({ DialogKasir: () => null }));

import { RuasPembayarEcourt } from "@/components/portal/kontak-para-pihak";
import { DialogKasirHarian } from "@/components/portal/kasir-otomatis";

/**
 * KASIR ALETA 4 Nov 2026 - jendela Kasir portal sesuai rancangan: bilah tab, kartu angka penyaring, Cari perkara,
 * kepala kartu, pembayar e-Court + Cetak SKUM (hanya peran berhak), kaki berisi total, tab Sisa panjar dan
 * Instrumen jurusita. SELURUH data REKAAN. Hanya tampilan: tidak ada tulisan yang dikirim di berkas ini.
 */
const HARI = "2026-11-03";
const bungkus = (isi: unknown) => ({ ok: true, status: 200, headers: new Headers({ "content-type": "application/json" }), json: async () => ({ data: isi }) }) as unknown as Response;
const u = (kunci: string, uraian: string, jumlah: number) => ({ kunci, tanggal: HARI, jenisBiayaId: 157, pihakKe: 2, pihakId: 12, uraian, jumlah, keterangan: "", jurusitaId: null, pilih: true, dasar: "kebiasaan" });
const keadaan = (nama: string) => ({ kunci: "x", nama, lazim: [] });
const harian = {
  ok: true, available: true, tanggal: HARI, jumlahCalon: 3, gagal: [], terpotong: false, akun: { ok: true, username: "kasir1", nama: "Tiara Rekaan, A.Md." },
  lengkap: [{ perkaraId: 603, nomorPerkara: "603/Pdt.G/2026/PA.Xyz", jenisPerkara: "Cerai Talak", keadaan: keadaan("Putus verstek"), sebab: ["putusan"] }],
  perkara: [
    { perkaraId: 601, nomorPerkara: "601/Pdt.G/2026/PA.Xyz", jenisPerkara: "Cerai Gugat", sebab: ["sidang"], keadaan: keadaan("Dalam persidangan"), saldo: 0, saldoAkhir: 0, usulan: [u("a1", "Redaksi", 10000), u("a2", "Meterai", 10000)], ditawarkan: 0, catatan: [], perluPeriksa: false },
    { perkaraId: 602, nomorPerkara: "602/Pdt.G/2026/PA.Xyz", jenisPerkara: "Cerai Talak", sebab: ["putusan"], keadaan: keadaan("Putus verstek"), saldo: 0, saldoAkhir: 0, usulan: [u("b1", "Redaksi", 10000)], ditawarkan: 0, catatan: ["Periksa tarif panggilan."], perluPeriksa: true },
  ],
};
const bayar = { ok: true, perkara: { "601/Pdt.G/2026/PA.Xyz": { nomorPerkara: "601/Pdt.G/2026/PA.Xyz", diterimaDari: "Budi Rekaan, S.H.", nomorRekening: "9900112233", atasNama: "", bank: "BNI", panjar: 355000, status: "Sudah dibayar", tanggal: "2026-11-01", jam: "10:12:00", adaSkum: true } } };
const psp = { ok: true, available: true, dari: HARI, sampai: HARI, jumlah: 2, total: 167000, rekeningDisembunyikan: false, daftar: [
  { jurnalId: 1, perkaraId: 601, nomorPerkara: "601/Pdt.G/2026/PA.Xyz", tanggal: HARI, jumlah: 125000, penerima: "Budi Rekaan", kuasa: "", ecourt: true, rekening: { diterimaDari: "Budi Rekaan, S.H.", bank: "BNI", nomorRekening: "9900112233", atasNama: "" } },
  { jurnalId: 2, perkaraId: 605, nomorPerkara: "605/Pdt.G/2026/PA.Xyz", tanggal: HARI, jumlah: 42000, penerima: "Ani Rekaan", kuasa: "", ecourt: false, rekening: null },
] };
const instrumen = { ok: true, available: true, dari: HARI, sampai: HARI, kelompok: [
  { kunci: "js-7", jurusitaId: 7, jurusita: "Eko Rekaan", jumlahPanggilan: 1, jumlahPbt: 1, total: 59000, baris: [
    { jurnalId: 11, nomorPerkara: "902/Pdt.G/2026/PA.Xyz", tanggal: HARI, jenis: "Panggilan sidang ke-1", jumlah: 29500, pihak: "Tergugat Rekaan", alamat: "Desa Contoh" },
    { jurnalId: 12, nomorPerkara: "906/Pdt.G/2026/PA.Xyz", tanggal: HARI, jenis: "PBT (pemberitahuan isi putusan)", jumlah: 29500, pihak: "Tergugat Dua", alamat: "Desa Lama" },
  ] },
] };

function pasangFetch(daftar: string[] = []) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const a = String(url);
      daftar.push(`${init?.method || "GET"} ${a}`);
      if (/pembayaran-ecourt/.test(a)) return bungkus(bayar);
      if (/kasir\/psp/.test(a)) return bungkus(psp);
      if (/kasir\/instrumen/.test(a)) return bungkus(instrumen);
      if (/kasir\/harian/.test(a)) return bungkus(harian);
      return bungkus({});
    })
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  pengguna.aktif = { id: "usr_uji", roleId: "pelaksana", positionId: "pos-staf-umum", additionalRoleIds: ["kasir"] };
});

describe("jendela Kasir portal (rancangan 4 Nov)", () => {
  it("kepala + tab: Hari ini, Sisa panjar, Instrumen jurusita, Rekap, Pengingat, Riwayat; Hari ini terpilih", async () => {
    pasangFetch();
    render(<DialogKasirHarian tabAwal="massal" onTutup={() => undefined} />);
    expect(screen.getByText("Jurnal Keuangan Perkara")).toBeTruthy();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Hari ini", "Sisa panjar", "Instrumen jurusita", "Rekap", "Pengingat", "Riwayat"]);
    expect(screen.getByRole("tab", { name: "Hari ini" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("dialog", { name: "Kasir harian" })).toBeTruthy();
  });

  it("Hari ini: lencana akun, kartu angka, kartu perkara berstatus, pembayar e-Court + Cetak SKUM, kaki berisi total", async () => {
    pasangFetch();
    render(<DialogKasirHarian tabAwal="massal" onTutup={() => undefined} />);
    await screen.findByText("601/Pdt.G/2026/PA.Xyz", {}, { timeout: 5000 });
    expect(screen.getByText("Dicatat atas akun kasir")).toBeTruthy();
    expect(screen.getByText("Tiara Rekaan, A.Md.")).toBeTruthy();
    const angka = (k: string) => (document.querySelector(`[data-saring="${k}"] span`) as HTMLElement).textContent;
    expect([angka("semua"), angka("perlu"), angka("lengkap")]).toEqual(["3", "2", "1"]);
    expect(screen.getAllByText("Perlu dijurnal").length).toBeGreaterThanOrEqual(3); // kartu angka + dua kartu perkara
    expect(screen.getByText("perlu diperiksa")).toBeTruthy();
    // Pembayar e-Court dibaca sekali (satu permintaan), tombol SKUM hanya di perkara e-Court.
    await screen.findByText("Budi Rekaan, S.H.", {}, { timeout: 5000 });
    expect(document.querySelector("[data-rekening]")!.textContent).toBe("BNI 9900112233");
    expect(screen.getAllByRole("button", { name: "Cetak SKUM e-Court" })).toHaveLength(1);
    // Kaki: 3 baris, Rp30.000; hanya perkara tercentang (601 tanpa periksa) yang terhitung = 2 baris Rp20.000.
    const kaki = screen.getByText(/baris dipilih untuk dijurnal/);
    expect(kaki.textContent).toBe("2 baris dipilih untuk dijurnal (1 perkara)");
    expect(screen.getByText("Rp20.000")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Masukkan ke jurnal SIPP" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Batal pilih" }));
    expect(screen.getByText("0 baris dipilih untuk dijurnal").textContent).toBe("0 baris dipilih untuk dijurnal");
    expect((screen.getByRole("button", { name: "Masukkan ke jurnal SIPP" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("kartu angka dan Cari perkara menyaring di layar; perkara sudah lengkap tampil ringkas", async () => {
    const minta: string[] = [];
    pasangFetch(minta);
    render(<DialogKasirHarian tabAwal="massal" onTutup={() => undefined} />);
    await screen.findByText("601/Pdt.G/2026/PA.Xyz", {}, { timeout: 5000 });
    fireEvent.click(document.querySelector('[data-saring="lengkap"]') as HTMLElement);
    expect(screen.queryByText("601/Pdt.G/2026/PA.Xyz")).toBeNull();
    const lengkap = screen.getByText("603/Pdt.G/2026/PA.Xyz").closest("li") as HTMLElement;
    expect(within(lengkap).getByText("Sudah lengkap")).toBeTruthy();
    fireEvent.click(document.querySelector('[data-saring="semua"]') as HTMLElement);
    const cari = screen.getByPlaceholderText("Nomor perkara atau nama pembayar");
    const n = minta.length;
    fireEvent.change(cari, { target: { value: "602" } });
    expect(screen.queryByText("601/Pdt.G/2026/PA.Xyz")).toBeNull();
    expect(screen.getByText("602/Pdt.G/2026/PA.Xyz")).toBeTruthy();
    fireEvent.change(cari, { target: { value: "budi rekaan" } });
    await waitFor(() => expect(screen.getByText("601/Pdt.G/2026/PA.Xyz")).toBeTruthy());
    expect(screen.queryByText("602/Pdt.G/2026/PA.Xyz")).toBeNull();
    fireEvent.change(cari, { target: { value: "zzz" } });
    expect(screen.getByText("Tidak ada perkara yang cocok dengan pilihan ini.")).toBeTruthy();
    // Menyaring tidak membaca ulang daftar harian.
    expect(minta.slice(n).filter((x) => /kasir\/harian/.test(x))).toEqual([]);
  });

  it("peran tanpa hak rekening: tidak ada permintaan pembayaran, tidak ada baris pembayar maupun tombol SKUM", async () => {
    pengguna.aktif = { id: "usr_pp", roleId: "panitera-pengganti", positionId: "pos-panitera-pengganti", additionalRoleIds: [] };
    const minta: string[] = [];
    pasangFetch(minta);
    render(<DialogKasirHarian tabAwal="massal" onTutup={() => undefined} />);
    await screen.findByText("601/Pdt.G/2026/PA.Xyz", {}, { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 50));
    expect(minta.some((x) => /pembayaran-ecourt/.test(x))).toBe(false);
    expect(document.querySelector("[data-rekening]")).toBeNull();
    expect(screen.queryByRole("button", { name: "Cetak SKUM e-Court" })).toBeNull();
    expect(screen.queryByText("Budi Rekaan, S.H.")).toBeNull();
  });

  it("tab Sisa panjar: ringkasan, tabel Perkara/Tanggal/Penerima/Bank dan rekening/Sisa panjar, total, pintasan rentang, Cetak daftar PSP", async () => {
    const minta: string[] = [];
    pasangFetch(minta);
    render(<DialogKasirHarian tabAwal="psp" onTutup={() => undefined} />);
    await screen.findByText("605/Pdt.G/2026/PA.Xyz", {}, { timeout: 5000 });
    expect(screen.getByText(/2 perkara mengembalikan sisa panjar pada 3 November 2026/)).toBeTruthy();
    const kop = Array.from(document.querySelectorAll("[data-kasir-cetak='psp'] thead th")).map((t) => t.textContent);
    expect(kop).toEqual(["Perkara", "Tanggal", "Penerima", "Bank dan rekening", "Sisa panjar"]);
    expect(document.querySelector("tr[data-psp='601/Pdt.G/2026/PA.Xyz'] [data-rekening]")!.textContent).toBe("BNI 9900112233");
    expect(screen.getByText("rekening belum ada")).toBeTruthy();
    expect(screen.getByText("pendaftaran langsung (bukan e-Court)")).toBeTruthy();
    expect(screen.getByText("Rp167.000")).toBeTruthy();
    expect(screen.getByText(/Nomor rekening tampil hanya untuk Super Admin, Admin, Ketua\/Wakil, Hakim, Panitera, Kasir, dan PTSP/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cetak daftar PSP" })).toBeTruthy();
    const n = minta.filter((x) => /kasir\/psp/.test(x)).length;
    fireEvent.click(screen.getByRole("button", { name: "7 hari" }));
    await waitFor(() => expect(minta.filter((x) => /kasir\/psp/.test(x)).length).toBe(n + 1));
    expect(decodeURIComponent(minta.filter((x) => /kasir\/psp/.test(x)).pop()!)).toMatch(/dari=\d{4}-\d{2}-\d{2}&sampai=\d{4}-\d{2}-\d{2}/);
  });

  it("tab Sisa panjar untuk peran tanpa rekening: kolom rekening tidak ada", async () => {
    pasangFetch();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (/kasir\/psp/.test(String(url)) ? bungkus({ ...psp, rekeningDisembunyikan: true, daftar: psp.daftar.map((b) => ({ ...b, rekening: null })) }) : bungkus({}))));
    render(<DialogKasirHarian tabAwal="psp" onTutup={() => undefined} />);
    await screen.findByText("605/Pdt.G/2026/PA.Xyz", {}, { timeout: 5000 });
    expect(Array.from(document.querySelectorAll("[data-kasir-cetak='psp'] thead th")).map((t) => t.textContent)).toEqual(["Perkara", "Tanggal", "Penerima", "Sisa panjar"]);
    expect(screen.getByText("Nomor rekening tidak ditampilkan untuk peran Anda.")).toBeTruthy();
    expect(document.querySelector("[data-rekening]")).toBeNull();
  });

  it("tab Instrumen jurusita: kartu per jurusita (jumlah relaas, total, Cetak) dan rincian relaas dapat dibuka", async () => {
    pasangFetch();
    render(<DialogKasirHarian tabAwal="instrumen" onTutup={() => undefined} />);
    await screen.findByText("Eko Rekaan", {}, { timeout: 5000 });
    const kartu = document.querySelector('[data-jurusita="js-7"]') as HTMLElement;
    expect(kartu.textContent).toContain("1 panggilan · 1 PBT");
    expect(kartu.textContent).toContain("Rp59.000");
    expect(within(kartu).getByRole("button", { name: "Cetak" })).toBeTruthy();
    expect(within(kartu).getByText("Lihat 2 relaas")).toBeTruthy();
    expect(kartu.textContent).toContain("Tergugat Rekaan");
    expect(kartu.textContent).toContain("PBT (pemberitahuan isi putusan)");
    expect(screen.queryByRole("button", { name: "Cetak semua (terpisah)" })).toBeNull(); // hanya satu jurusita
  });

  it("peran pengawas (panitera): tab Hari ini tidak ada; Sisa panjar dan Instrumen jurusita tetap dapat dibaca", async () => {
    pasangFetch();
    render(<DialogKasirHarian tabAwal="massal" hanyaBaca onTutup={() => undefined} />);
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Sisa panjar", "Instrumen jurusita", "Rekap", "Pengingat", "Riwayat"]);
    expect(screen.getByRole("tab", { name: "Pengingat" }).getAttribute("aria-selected")).toBe("true");
  });
});

describe("data pihak Status Perkara: blok pembayar panjar (rancangan Pihak)", () => {
  it("tiga baris berlabel - Pembayar panjar, Rekening, Untuk - dengan rekening penuh bagi peran yang menerimanya", () => {
    const data = { ...bayar.perkara["601/Pdt.G/2026/PA.Xyz"], skum: undefined, adaSkum: true } as never;
    render(<RuasPembayarEcourt data={data} kuasa cocok />);
    const blok = document.querySelector('[data-ruas-kontak="rekening-pembayar"]') as HTMLElement;
    expect(Array.from(blok.querySelectorAll(":scope > div > span:first-child")).map((x) => x.textContent)).toEqual(["Pembayar panjar", "Rekening", "Untuk"]);
    expect(blok.textContent).toContain("Budi Rekaan, S.H.");
    expect(blok.textContent).toContain("(kuasa)");
    expect(blok.textContent).toContain("dari e-Court");
    expect(blok.textContent).toContain("panjar Rp355.000");
    expect(blok.querySelector("[data-rekening]")!.textContent).toBe("BNI 9900112233");
    expect(blok.textContent).toContain("Pengembalian sisa panjar ke rekening pembayar");
    // Tanpa tingkat tersamar: tidak ada angka bertanda bintang/titik pengganti.
    expect(blok.textContent).not.toMatch(/••|\*\*/);
  });
});
