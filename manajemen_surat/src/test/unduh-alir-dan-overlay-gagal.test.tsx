/**
 * Butir 25 dan 26 (6 Okt 2026) - perilaku di peramban, DIJALANKAN:
 *
 *   25 - tombol "Unduh seluruh berkas" membuka unduhan biasa peramban di
 *        bingkai tersembunyi (bukan fetch + blob), mengenali mulai lewat cookie
 *        token, menyebut sebab galat dari jawaban server - bukan "Failed to
 *        fetch" - dan menawarkan unduhan per bagian.
 *   26 - layar yang memanggil useOverlayHanyaGagal tidak memunculkan lapisan
 *        memuat maupun berhasil; lapisan GAGAL tetap muncul.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TombolUnduhZip } from "@/components/portal/tombol-unduh-zip";
import { GlobalLoadingProvider, useOverlayHanyaGagal } from "@/lib/global-loading";
import { mulaiUnduhAlir, pesanDariHalamanGalat } from "@/lib/unduh-alir";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.querySelectorAll("iframe").forEach((x) => x.remove());
  for (const c of document.cookie.split(/;\s*/)) {
    const nama = c.split("=")[0];
    if (nama) document.cookie = `${nama}=; Max-Age=0; Path=/`;
  }
});

function bingkaiUnduh() {
  const b = document.querySelector<HTMLIFrameElement>("iframe[data-aleta-unduh]");
  expect(b, "bingkai unduhan tersembunyi").toBeTruthy();
  return b!;
}

/** Meniru peramban: rute berhasil memasang cookie penanda pada kepala jawabannya. */
function serverMulaiMengirim(b: HTMLIFrameElement) {
  document.cookie = `aleta_unduh_${b.dataset.aletaUnduh}=1; Path=/`;
}

/** Meniru peramban: jawaban galat DIMUAT di bingkai (tidak diunduh). */
function serverMenjawabGalat(b: HTMLIFrameElement, teks: string) {
  const isi = b.contentDocument!;
  isi.open();
  isi.write(`<pre>${teks}</pre>`);
  isi.close();
  b.dispatchEvent(new Event("load"));
}

describe("butir 25 - tombol Unduh seluruh berkas", () => {
  it('tulisannya "Unduh seluruh berkas", dan menekannya TIDAK memanggil fetch', async () => {
    const fetchPalsu = vi.fn();
    vi.stubGlobal("fetch", fetchPalsu);
    render(<TombolUnduhZip nomorPerkara="445/Pdt.G/2026/PA.Dgl" isi="lengkap" />);

    fireEvent.click(screen.getByLabelText(/Sertakan berkas pindaian arsip/));
    fireEvent.click(screen.getByRole("button", { name: "Unduh seluruh berkas" }));
    expect(fetchPalsu).not.toHaveBeenCalled();

    const b = bingkaiUnduh();
    const alamat = new URL(b.src, "http://uji.local");
    expect(alamat.pathname).toMatch(/\/api\/aleta-ecourt\/berkas-zip$/);
    expect(alamat.searchParams.get("nomor")).toBe("445/Pdt.G/2026/PA.Dgl");
    expect(alamat.searchParams.get("isi")).toBe("lengkap");
    expect(alamat.searchParams.get("arsipFisik")).toBe("1");
    expect(alamat.searchParams.get("token")).toBe(b.dataset.aletaUnduh);
    expect(screen.getByRole("button", { name: "Menyusun…" })).toBeDisabled();

    act(() => serverMulaiMengirim(b));
    await waitFor(() => expect(screen.getByRole("button", { name: "Unduh seluruh berkas" })).toBeEnabled(), {
      timeout: 2000,
    });
    // Tidak ada pesan galat; TETAP SATU ZIP - tidak ada tautan per bagian (6 Okt 2026).
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/per bagian/)).toBeNull();
    // Cookie penanda sekali pakai dibuang.
    expect(document.cookie).not.toContain(`aleta_unduh_${b.dataset.aletaUnduh}`);
  });

  it("galat server disebutkan sebabnya - bukan 'Failed to fetch' - tanpa tawaran per bagian", async () => {
    render(<TombolUnduhZip nomorPerkara="445/Pdt.G/2026/PA.Dgl" isi="lengkap" />);
    fireEvent.click(screen.getByRole("button", { name: "Unduh seluruh berkas" }));
    const b = bingkaiUnduh();

    act(() =>
      serverMenjawabGalat(
        b,
        JSON.stringify({ ok: false, alasan: "tidak_ada_berkas_tersimpan", keterangan: ["Arsip e-Court: gateway mati"] })
      )
    );
    const galat = await screen.findByRole("alert");
    expect(galat.textContent).toBe("tidak ada berkas tersimpan");
    expect(galat.textContent).not.toMatch(/failed to fetch/i);

    // Satu ZIP saja: tidak ada tombol per bagian.
    expect(screen.queryByRole("button", { name: "berkas e-Court" })).toBeNull();
  });

  it("halaman galat proksi (502 HTML) disebut isinya", () => {
    expect(pesanDariHalamanGalat("Proxy Error The proxy server received an invalid response", "502 Proxy Error")).toBe(
      "Server menjawab: 502 Proxy Error"
    );
    expect(pesanDariHalamanGalat('{"ok":false,"error":{"message":"Sesi berakhir."}}')).toBe("Sesi berakhir.");
  });

  it("tanpa kabar sampai batas waktu: disebutkan, beserta kemungkinan diambil alih pengelola unduhan", async () => {
    vi.useFakeTimers();
    const janji = mulaiUnduhAlir("/aleta/api/aleta-ecourt/berkas-zip?nomor=1", { batasMs: 5000 });
    await vi.advanceTimersByTimeAsync(5000);
    const hasil = await janji;
    expect(hasil).toMatchObject({ ok: false, sebab: "tidak-ada-kabar" });
    expect(hasil.ok ? "" : hasil.pesan).toMatch(/pengelola unduhan/);
    expect(hasil.ok ? "" : hasil.pesan).not.toMatch(/per bagian/);
  });
});

function LayarHanyaGagal({ url }: { url: string }) {
  useOverlayHanyaGagal();
  return (
    <button type="button" onClick={() => void fetch(url, { method: "POST" }).catch(() => undefined)}>
      Kirim
    </button>
  );
}

function LayarBiasa({ url }: { url: string }) {
  return (
    <button type="button" onClick={() => void fetch(url, { method: "POST" }).catch(() => undefined)}>
      Kirim
    </button>
  );
}

describe("butir 26 - overlay hanya untuk gagal", () => {
  it("memuat dan berhasil: TIDAK ada lapisan sama sekali", async () => {
    vi.useFakeTimers();
    let selesaikan: (r: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((r) => (selesaikan = r)))
    );
    render(
      <GlobalLoadingProvider>
        <LayarHanyaGagal url="/aleta/api/aleta-ecourt/ecourt-aksi" />
      </GlobalLoadingProvider>
    );
    const lapisan = screen.getByTestId("global-loading-overlay");

    fireEvent.click(screen.getByRole("button", { name: "Kirim" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(lapisan.className).toContain("opacity-0");
    expect(lapisan).toHaveAttribute("aria-busy", "false");

    await act(async () => {
      selesaikan(new Response("{}", { status: 200 }));
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(lapisan.className).toContain("opacity-0");
    expect(lapisan.getAttribute("data-phase")).not.toBe("success");

    // Kabar berhasil manual pun tidak memunculkan lapisan.
    act(() => {
      window.dispatchEvent(new CustomEvent("aleta:show-result", { detail: { phase: "success", label: "Proses berhasil" } }));
    });
    expect(lapisan.className).toContain("opacity-0");
  });

  it("gagal: lapisan GAGAL tetap muncul", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    render(
      <GlobalLoadingProvider>
        <LayarHanyaGagal url="/aleta/api/aleta-ecourt/ecourt-aksi" />
      </GlobalLoadingProvider>
    );
    const lapisan = screen.getByTestId("global-loading-overlay");
    fireEvent.click(screen.getByRole("button", { name: "Kirim" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(lapisan.className).toContain("opacity-100");
    expect(lapisan).toHaveAttribute("data-phase", "error");
    expect(screen.getByText("Proses gagal")).toBeInTheDocument();
  });

  it("jaringan putus (fetch melempar): lapisan GAGAL tetap muncul", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    render(
      <GlobalLoadingProvider>
        <LayarHanyaGagal url="/aleta/api/aleta-ecourt/ecourt-aksi" />
      </GlobalLoadingProvider>
    );
    const lapisan = screen.getByTestId("global-loading-overlay");
    fireEvent.click(screen.getByRole("button", { name: "Kirim" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(lapisan).toHaveAttribute("data-phase", "error");
    expect(lapisan.className).toContain("opacity-100");
  });

  it("layar lain tidak berubah: lapisan memuat tetap muncul, dan mode berhenti saat layar dilepas", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    const { unmount } = render(
      <GlobalLoadingProvider>
        <LayarHanyaGagal url="/aleta/api/x" />
      </GlobalLoadingProvider>
    );
    unmount();
    render(
      <GlobalLoadingProvider>
        <LayarBiasa url="/aleta/api/x" />
      </GlobalLoadingProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Kirim" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    const lapisan = screen.getByTestId("global-loading-overlay");
    expect(lapisan).toHaveAttribute("aria-busy", "true");
    expect(lapisan).toHaveAttribute("data-phase", "loading");
  });

  it("layar Status Perkara memintanya, dan kabar berhasil salin pindah ke tombolnya", () => {
    const layar = readFileSync(
      path.resolve(process.cwd(), "src/components/portal/aleta-ecourt-status-perkara.tsx"),
      "utf8"
    );
    expect(layar).toContain('import { useOverlayHanyaGagal } from "@/lib/global-loading";');
    expect(layar).toMatch(/\n\s+useOverlayHanyaGagal\(\);/);
    expect(layar).not.toContain("pesanBerhasil");
    expect(layar).toContain('{tandaSalin || "Salin daftar nomor"}');
  });
});
