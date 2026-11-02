/**
 * Unduhan portal lewat ekstensi (2 Nov 2026) - sisi PORTAL (jsdom), DIJALANKAN:
 *   - ada ekstensi (data-aleta-unduh-aman="1"): tombol "Unduh seluruh berkas" /
 *     "Unduh yang dipilih" meminta ekstensi lewat jembatan, TIDAK memasang bingkai
 *     unduhan http (yang ditahan Chrome), menampilkan kemajuan MB dan nama berkas;
 *   - galat server dari ekstensi disebut, tanpa bingkai ulangan;
 *   - ekstensi tidak menjawab / tidak bekerja -> jalur lama (bingkai) dipakai;
 *   - tanpa ekstensi: bingkai seketika seperti dulu, ditambah petunjuk
 *     "pasang/aktifkan ekstensi ALETA, atau Keep";
 *   - tombol ekspor lain (unduhBerkasPortal): tanpa ekstensi window.open seperti
 *     dulu, dengan ekstensi lewat jembatan dan galatnya ke onGalat.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TombolUnduhZip } from "@/components/portal/tombol-unduh-zip";
import { mulaiUnduhAman } from "@/lib/unduh-alir";
import { PETUNJUK_TANPA_EKSTENSI, teksKemajuanUnduh, unduhBerkasPortal } from "@/lib/unduh-ekstensi";

const NOMOR = "273/Pdt.G/2026/PA.Dgl";
const NAMA = "perkara-273-Pdt.G-2026-PA.Dgl-data-gugatan-bas-penetapan-ecourt-lainnya.zip";

type Kiriman = { data: any; origin: string };
let kiriman: Kiriman[] = [];

beforeEach(() => {
  kiriman = [];
  // Pesan halaman -> ekstensi dicatat (di Chrome sungguhan diterima aleta.js).
  vi.spyOn(window, "postMessage").mockImplementation(((data: unknown, origin: string) => {
    kiriman.push({ data, origin });
  }) as typeof window.postMessage);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.aletaUnduhAman;
  document.querySelectorAll("iframe").forEach((x) => x.remove());
  for (const c of document.cookie.split(/;\s*/)) {
    const nama = c.split("=")[0];
    if (nama) document.cookie = `${nama}=; Max-Age=0; Path=/`;
  }
});

const pasangEkstensi = () => {
  document.documentElement.dataset.aletaUnduhAman = "1";
};
const permintaan = () => kiriman.filter((k) => k.data?.sumber === "aleta-portal" && k.data?.jenis === "unduh-berkas");
const bingkai = () => document.querySelector<HTMLIFrameElement>("iframe[data-aleta-unduh]");

/** Pesan ekstensi -> halaman, persis bentuk yang dikirim jembatan aleta.js. */
function dariEkstensi(data: Record<string, unknown>) {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { data: { sumber: "aleta-ekstensi", ...data }, origin: window.location.origin, source: window }));
  });
}

describe("tombol ZIP perkara dengan ekstensi ALETA", () => {
  it("Unduh seluruh berkas: lewat ekstensi, tanpa bingkai http, kemajuan MB lalu nama berkas tersimpan", async () => {
    pasangEkstensi();
    const fetchPalsu = vi.fn();
    vi.stubGlobal("fetch", fetchPalsu);
    render(<TombolUnduhZip nomorPerkara={NOMOR} isi="lengkap" />);
    fireEvent.click(screen.getByRole("button", { name: "Unduh seluruh berkas" }));

    expect(permintaan()).toHaveLength(1);
    const { idPesan, muatan } = permintaan()[0].data;
    expect(permintaan()[0].origin).toBe(window.location.origin);
    const alamat = new URL(muatan.alamat);
    expect(alamat.origin).toBe(window.location.origin);
    expect(alamat.pathname).toMatch(/\/api\/aleta-ecourt\/berkas-zip$/);
    expect(alamat.searchParams.get("nomor")).toBe(NOMOR);
    expect(alamat.searchParams.get("isi")).toBe("lengkap");
    expect(bingkai()).toBeNull();
    expect(fetchPalsu).not.toHaveBeenCalled();

    dariEkstensi({ kabar: idPesan, tahap: "diterima", diterima: 0, ukuran: 0 });
    expect(await screen.findByRole("button", { name: "Server menyusun berkas…" })).toBeDisabled();
    dariEkstensi({ kabar: idPesan, tahap: "kemajuan", diterima: 12.5 * 1024 * 1024, ukuran: 0 });
    expect(await screen.findByRole("button", { name: "Mengunduh 12,5 MB…" })).toBeTruthy();

    dariEkstensi({ balasan: idPesan, jawaban: { ok: true, nama: NAMA, ukuran: 45 * 1024 * 1024 } });
    expect(await screen.findByText(`Tersimpan lewat ekstensi ALETA: ${NAMA} (45,0 MB).`)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Unduh seluruh berkas" })).toBeEnabled();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(bingkai()).toBeNull();
  });

  it("Unduh yang dipilih (BAS saja) juga lewat ekstensi, alamatnya memuat kategori", async () => {
    pasangEkstensi();
    render(<TombolUnduhZip nomorPerkara={NOMOR} isi="lengkap" />);
    fireEvent.click(screen.getByText(/Pilih isi unduhan/));
    fireEvent.click(screen.getByLabelText(/Semua \(kecuali arsip fisik\)/));
    fireEvent.click(screen.getByLabelText(/BAS \(berita acara sidang\)/));
    fireEvent.click(screen.getByRole("button", { name: "Unduh yang dipilih" }));
    expect(permintaan()).toHaveLength(1);
    expect(new URL(permintaan()[0].data.muatan.alamat).searchParams.get("kategori")).toBe("bas");
    expect(bingkai()).toBeNull();
    dariEkstensi({ balasan: permintaan()[0].data.idPesan, jawaban: { ok: true, nama: "bas.zip", ukuran: 1024 } });
    expect(await screen.findByText(/Tersimpan lewat ekstensi ALETA: bas\.zip/)).toBeTruthy();
  });

  it("galat server dari ekstensi: sebabnya tampil merah, TIDAK diulang lewat bingkai", async () => {
    pasangEkstensi();
    render(<TombolUnduhZip nomorPerkara={NOMOR} isi="lengkap" />);
    fireEvent.click(screen.getByRole("button", { name: "Unduh seluruh berkas" }));
    const { idPesan } = permintaan()[0].data;
    dariEkstensi({
      balasan: idPesan,
      jawaban: { ok: false, galatServer: true, status: 403, sebab: "Server menolak (403): Akses ditolak untuk perkara ini" },
    });
    expect((await screen.findByRole("alert")).textContent).toBe("Server menolak (403): Akses ditolak untuk perkara ini");
    expect(bingkai()).toBeNull();
  });

  it("ekstensi tidak dapat memakai jalurnya (Chrome lama): jalur lama bingkai dipakai, sebabnya disebut", async () => {
    pasangEkstensi();
    render(<TombolUnduhZip nomorPerkara={NOMOR} isi="lengkap" />);
    fireEvent.click(screen.getByRole("button", { name: "Unduh seluruh berkas" }));
    const { idPesan } = permintaan()[0].data;
    dariEkstensi({ balasan: idPesan, jawaban: { ok: false, ditolakEkstensi: true, sebab: "Chrome ini belum mendukung jalur unduhan aman ekstensi" } });
    await waitFor(() => expect(bingkai()).toBeTruthy());
    act(() => {
      document.cookie = `aleta_unduh_${bingkai()!.dataset.aletaUnduh}=1; Path=/`;
    });
    expect(await screen.findByText(/Jalur ekstensi tidak dapat dipakai \(Chrome ini belum mendukung/, {}, { timeout: 3000 })).toBeTruthy();
  });
});

describe("mulaiUnduhAman tanpa React", () => {
  it("ekstensi diam 10 detik -> jalur lama (bingkai) dipakai", async () => {
    vi.useFakeTimers();
    pasangEkstensi();
    const janji = mulaiUnduhAman("/aleta/api/aleta-ecourt/berkas-zip?nomor=1", { batasMs: 60_000, jedaMs: 100 });
    expect(bingkai()).toBeNull();
    await vi.advanceTimersByTimeAsync(10_001);
    expect(bingkai()).toBeTruthy();
    document.cookie = `aleta_unduh_${bingkai()!.dataset.aletaUnduh}=1; Path=/`;
    await vi.advanceTimersByTimeAsync(200);
    await expect(janji).resolves.toMatchObject({ ok: true, lewat: "peramban" });
  });

  it("tanpa ekstensi: bingkai dipasang SEKETIKA (perilaku lama) dan petunjuk Keep/ekstensi bila bukan konteks aman", async () => {
    Object.defineProperty(window, "isSecureContext", { value: false, configurable: true });
    const janji = mulaiUnduhAman("/aleta/api/aleta-ecourt/berkas-zip?nomor=1", { jedaMs: 20 });
    expect(bingkai()).toBeTruthy();
    expect(permintaan()).toHaveLength(0);
    document.cookie = `aleta_unduh_${bingkai()!.dataset.aletaUnduh}=1; Path=/`;
    await expect(janji).resolves.toEqual({ ok: true, lewat: "peramban", petunjuk: PETUNJUK_TANPA_EKSTENSI });
    expect(PETUNJUK_TANPA_EKSTENSI).toMatch(/pasang\/aktifkan ekstensi ALETA, atau pilih Keep/);
  });

  it("pengelola unduhan mengosongkan hasil ekstensi -> jalur lama, pesan pengelola ikut sebagai petunjuk", async () => {
    pasangEkstensi();
    const janji = mulaiUnduhAman("/aleta/api/aleta-ecourt/berkas-zip?nomor=1", { jedaMs: 20 });
    const { idPesan } = permintaan()[0].data;
    dariEkstensi({ balasan: idPesan, jawaban: { ok: false, diambilPengelola: true, sebab: "diambil alih IDM" } });
    await waitFor(() => expect(bingkai()).toBeTruthy());
    document.cookie = `aleta_unduh_${bingkai()!.dataset.aletaUnduh}=1; Path=/`;
    const h = await janji;
    expect(h).toMatchObject({ ok: true, lewat: "peramban" });
    expect(h.ok && h.lewat === "peramban" && h.petunjuk).toContain("diambil alih IDM");
  });

  it("pesan dari bingkai/jendela lain atau asal lain diabaikan", async () => {
    pasangEkstensi();
    const janji = mulaiUnduhAman("/aleta/api/x", {});
    const { idPesan } = permintaan()[0].data;
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", { data: { sumber: "aleta-ekstensi", balasan: idPesan, jawaban: { ok: true, nama: "palsu.zip" } }, origin: "http://contoh.test", source: window })
      );
    });
    dariEkstensi({ balasan: idPesan, jawaban: { ok: true, nama: "asli.zip", ukuran: 5 } });
    await expect(janji).resolves.toMatchObject({ ok: true, lewat: "ekstensi", nama: "asli.zip" });
  });

  it("teks kemajuan", () => {
    expect(teksKemajuanUnduh({ tahap: "mulai", diterima: 0, ukuran: 0 })).toBe("Mulai mengunduh…");
    expect(teksKemajuanUnduh({ tahap: "kemajuan", diterima: 3 * 1024 * 1024, ukuran: 30 * 1024 * 1024 })).toBe("Mengunduh 3,0 MB dari 30,0 MB…");
  });
});

describe("tombol ekspor portal lain (unduhBerkasPortal)", () => {
  it("tanpa ekstensi: window.open SEKETIKA seperti dulu (masih di dalam klik)", () => {
    const buka = vi.spyOn(window, "open").mockImplementation(() => null);
    void unduhBerkasPortal("/aleta/api/e-status/batches/1/export?format=csv");
    expect(buka).toHaveBeenCalledWith("/aleta/api/e-status/batches/1/export?format=csv", "_blank", "noopener,noreferrer");
    expect(permintaan()).toHaveLength(0);
  });

  it("dengan ekstensi: lewat jembatan, tanpa tab baru; galat server ke onGalat", async () => {
    pasangEkstensi();
    const buka = vi.spyOn(window, "open").mockImplementation(() => null);
    const onGalat = vi.fn();
    const janji = unduhBerkasPortal("/aleta/api/aleta-bot/messages?format=xlsx", { onGalat });
    expect(buka).not.toHaveBeenCalled();
    const { idPesan } = permintaan()[0].data;
    dariEkstensi({ balasan: idPesan, jawaban: { ok: false, galatServer: true, status: 500, sebab: "Server menjawab 500: gagal menyusun XLSX" } });
    await janji;
    expect(onGalat).toHaveBeenCalledWith("Server menjawab 500: gagal menyusun XLSX");
    expect(bingkai()).toBeNull();
  });
});
