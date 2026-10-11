/**
 * Status Perkara 12 Okt 2026 - sisi PERAMBAN (jsdom), dijalankan:
 *   butir 11 - dialog "Pilih isi unduhan": centang kategori, "Semua", lalu unduh -> alamat
 *              ZIP memuat ?kategori=... dan unduhan biasa peramban (bukan fetch);
 *   butir 12 - baris kontak di bawah nama pihak/kuasa: email, WhatsApp/HP dengan tanda sumber,
 *              dan "Sidang elektronik" ya/tidak/belum/tidak diketahui; 403 = tidak digambar.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KontakPihak, bersihkanKontakParaPihak } from "@/components/portal/kontak-para-pihak";
import { TombolUnduhZip, alamatZipPerkara } from "@/components/portal/tombol-unduh-zip";

const NOMOR = "273/Pdt.G/2026/PA.Dgl";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  bersihkanKontakParaPihak();
  document.querySelectorAll("iframe").forEach((x) => x.remove());
});

function bingkai() {
  const b = document.querySelector<HTMLIFrameElement>("iframe[data-aleta-unduh]");
  expect(b, "bingkai unduhan").toBeTruthy();
  return new URL(b!.src, "http://uji.local");
}

describe("butir 11 - pilih isi unduhan", () => {
  it("alamat ZIP memuat kategori terpilih; tanpa kategori = alamat lama", () => {
    const lama = new URL(alamatZipPerkara({ nomorPerkara: NOMOR, sumber: "semua", isi: "lengkap" }), "http://uji.local");
    expect(lama.searchParams.has("kategori")).toBe(false);
    const bas = new URL(
      alamatZipPerkara({ nomorPerkara: NOMOR, sumber: "semua", isi: "lengkap", kategori: ["bas", "relaas"] }),
      "http://uji.local"
    );
    expect(bas.searchParams.get("kategori")).toBe("bas,relaas");
  });

  it("panel terbuka dengan 'Semua' (kecuali arsip fisik); hanya BAS dicentang -> unduhan kategori=bas", () => {
    const fetchPalsu = vi.fn();
    vi.stubGlobal("fetch", fetchPalsu);
    render(<TombolUnduhZip nomorPerkara={NOMOR} isi="lengkap" />);

    expect(screen.queryByRole("group", { name: /Isi ZIP yang diunduh/ })).toBeNull();
    fireEvent.click(screen.getByText(/Pilih isi unduhan/));
    const grup = screen.getByRole("group", { name: /Isi ZIP yang diunduh/ });
    expect(grup).toBeTruthy();

    // Awalnya semua kategori kecuali arsip fisik tercentang.
    const kotak = (teks: RegExp) => screen.getByLabelText(teks) as HTMLInputElement;
    expect(kotak(/Semua \(kecuali arsip fisik\)/).checked).toBe(true);
    expect(kotak(/BAS \(berita acara sidang\)/).checked).toBe(true);
    expect(kotak(/Arsip fisik \(pindaian/).checked).toBe(false);

    // "Semua" dimatikan -> semuanya mati; lalu hanya BAS.
    fireEvent.click(kotak(/Semua \(kecuali arsip fisik\)/));
    expect(kotak(/BAS \(berita acara sidang\)/).checked).toBe(false);
    expect(screen.getByRole("button", { name: "Unduh yang dipilih" })).toBeDisabled();
    fireEvent.click(kotak(/BAS \(berita acara sidang\)/));
    expect(screen.getByRole("button", { name: "Unduh yang dipilih" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Unduh yang dipilih" }));

    expect(fetchPalsu).not.toHaveBeenCalled();
    const alamat = bingkai();
    expect(alamat.pathname).toMatch(/\/api\/aleta-ecourt\/berkas-zip$/);
    expect(alamat.searchParams.get("nomor")).toBe(NOMOR);
    expect(alamat.searchParams.get("isi")).toBe("lengkap");
    expect(alamat.searchParams.get("kategori")).toBe("bas");
  });

  it("e-Court + Lainnya + arsip fisik; tombol 'Unduh seluruh berkas' lama tetap satu tekan", () => {
    render(<TombolUnduhZip nomorPerkara={NOMOR} isi="lengkap" />);
    fireEvent.click(screen.getByText(/Pilih isi unduhan/));
    const kotak = (teks: RegExp) => screen.getByLabelText(teks) as HTMLInputElement;
    fireEvent.click(kotak(/Semua \(kecuali arsip fisik\)/)); // kosongkan
    fireEvent.click(kotak(/e-Court \(jawaban/));
    fireEvent.click(kotak(/Lainnya \(lampiran SIPP\)/));
    fireEvent.click(kotak(/Arsip fisik \(pindaian/));
    fireEvent.click(screen.getByRole("button", { name: "Unduh yang dipilih" }));
    expect(bingkai().searchParams.get("kategori")).toBe("ecourt,lainnya,arsip");

    cleanup();
    document.querySelectorAll("iframe").forEach((x) => x.remove());
    render(<TombolUnduhZip nomorPerkara={NOMOR} isi="lengkap" />);
    fireEvent.click(screen.getByRole("button", { name: "Unduh seluruh berkas" }));
    expect(bingkai().searchParams.has("kategori")).toBe(false);
  });

  it("layar tanpa isi lengkap (Antrian Sidang, Arsip berkas) tidak memperoleh panel pilihan", () => {
    render(<TombolUnduhZip nomorPerkara={NOMOR} />);
    expect(screen.queryByText(/Pilih isi unduhan/)).toBeNull();
  });
});

// ============================================================================
// BUTIR 12
// ============================================================================
const KONTAK = {
  ok: true,
  ada: true,
  lewatEcourt: true,
  orang: [
    {
      jenis: "pihak",
      pihakKe: 1,
      urutan: 1,
      nama: "RINA WATI binti AHMAD",
      email: { nilai: "rina.wati@yahoo.co.id", lazim: true, sumber: "sipp", label: "SIPP", lain: [{ nilai: "rina.lain@gmail.com", sumber: "ecourt", label: "akun e-Court" }] },
      hp: { nilai: "085211113333", jenis: "hp", lazim: true, sumber: "sipp", label: "SIPP", lain: [], bisaWhatsApp: true },
      elitigasi: { status: "ya", sumber: "ecourt", label: "Bersedia", terakhirTerlihat: null },
    },
    {
      jenis: "pihak",
      pihakKe: 2,
      urutan: 1,
      nama: "JOKO bin SAMIN",
      email: { nilai: "", lazim: true, sumber: "", label: "", lain: [] },
      hp: { nilai: "", jenis: "", lazim: true, sumber: "", label: "", lain: [], bisaWhatsApp: false },
      elitigasi: { status: "tidak-diketahui", sumber: "", label: "Pihak ini belum terbaca pada persetujuan e-Court - tarik perkara dari Kendali Berkas bila ingin memastikan.", terakhirTerlihat: null },
    },
    {
      jenis: "kuasa",
      pihakKe: 2,
      urutan: 1,
      nama: "SITI RAHMAWATI, S.H.",
      email: { nilai: "kantor.siti@gmail.com", lazim: true, sumber: "ecourt", label: "akun e-Court Kuasa Tergugat", keyakinan: "cukup", lain: [] },
      hp: { nilai: "0451421234", jenis: "telepon", lazim: true, sumber: "sipp", label: "SIPP", lain: [], bisaWhatsApp: false },
      elitigasi: { status: "tidak-berlaku", sumber: "", label: "Kuasa tidak mengisi persetujuan sendiri", terakhirTerlihat: null },
    },
  ],
};

function jawabJson(isi: unknown, status = 200) {
  return new Response(JSON.stringify({ ok: status === 200, data: isi }), { status });
}

describe("butir 12 - kontak pada Para Pihak", () => {
  beforeEach(() => bersihkanKontakParaPihak());

  it("email, WhatsApp, dan 'Sidang elektronik' tampil dengan tanda sumber; dibaca SEKALI untuk tiga orang", async () => {
    const fetchPalsu = vi.fn(async () => jawabJson(KONTAK));
    vi.stubGlobal("fetch", fetchPalsu);
    render(
      <div>
        <KontakPihak nomorPerkara={NOMOR} orang={{ nama: "RINA WATI binti AHMAD", jenis: "pihak", pihakKe: 1 }} />
        <KontakPihak nomorPerkara={NOMOR} orang={{ nama: "JOKO bin SAMIN", jenis: "pihak", pihakKe: 2 }} />
        <KontakPihak nomorPerkara={NOMOR} orang={{ nama: "SITI RAHMAWATI, S.H.", jenis: "kuasa", pihakKe: 2 }} />
      </div>
    );
    await waitFor(() => expect(screen.getAllByText("rina.wati@yahoo.co.id").length).toBe(1));
    expect(fetchPalsu).toHaveBeenCalledTimes(1);
    expect(String((fetchPalsu.mock.calls[0] as unknown[])[0])).toContain("/api/aleta-ecourt/kontak-para-pihak?nomor=");

    const blok = document.querySelectorAll('[data-bagian="kontak-pihak"]');
    expect(blok).toHaveLength(3);
    const [rina, joko, siti] = Array.from(blok) as HTMLElement[];

    // Penggugat: email SIPP + surel e-Court yang berbeda ikut disebut; HP = WhatsApp; bersedia = Ya.
    expect(rina.textContent).toContain("rina.wati@yahoo.co.id");
    expect(rina.textContent).toContain("SIPP");
    expect(rina.textContent).toContain("rina.lain@gmail.com");
    expect(rina.textContent).toContain("WhatsApp / HP");
    expect(rina.textContent).toContain("085211113333");
    expect(rina.querySelector('[data-elitigasi="ya"]')?.textContent).toBe("Ya");
    expect(rina.textContent).toContain("bersedia bersidang secara e-Litigasi - dari e-Court");

    // Tergugat: tidak ada kontak -> disebut jujur; kesediaan tidak diketahui + sebabnya.
    expect(joko.textContent).toContain("belum ada di SIPP maupun e-Court");
    expect(joko.querySelector('[data-elitigasi="tidak-diketahui"]')?.textContent).toBe("Tidak diketahui");
    expect(joko.textContent).toContain("belum terbaca pada persetujuan e-Court");

    // Kuasa: sumber e-Court bertanda; nomor telepon rumah BUKAN WhatsApp; tanpa baris kesediaan.
    expect(siti.textContent).toContain("kantor.siti@gmail.com");
    expect(siti.textContent).toContain("e-Court");
    expect(siti.textContent).toContain("Telepon (bukan HP)");
    expect(siti.textContent).not.toContain("WhatsApp");
    expect(siti.querySelector('[data-ruas-kontak="elitigasi"]')).toBeNull();
  });

  it("ditolak (403) = tidak digambar sama sekali, tanpa pesan galat", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 403 })));
    const { container } = render(
      <KontakPihak nomorPerkara={NOMOR} orang={{ nama: "RINA WATI binti AHMAD", jenis: "pihak", pihakKe: 1 }} />
    );
    await waitFor(() => expect(screen.queryByText("Membaca kontak…")).toBeNull());
    expect(container.textContent).toBe("");
  });

  it("bot belum diperbarui: sebabnya disebut, bukan layar kosong", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jawabJson({ ok: false, available: false, alasan: "ALETA Bot belum dapat dihubungi, atau belum diperbarui (rute kontak-para-pihak)." }))
    );
    render(<KontakPihak nomorPerkara={NOMOR} orang={{ nama: "RINA", jenis: "pihak", pihakKe: 1 }} />);
    expect(await screen.findByText(/belum diperbarui/)).toBeTruthy();
  });

  it("pihak yang tidak ada pada jawaban bot (mis. turut tergugat) tidak digambari apa pun", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jawabJson(KONTAK)));
    const { container } = render(
      <KontakPihak nomorPerkara={NOMOR} orang={{ nama: "ORANG LAIN", jenis: "pihak", pihakKe: 2 }} />
    );
    await waitFor(() => expect(screen.queryByText("Membaca kontak…")).toBeNull());
    expect(container.textContent).toBe("");
  });
});
