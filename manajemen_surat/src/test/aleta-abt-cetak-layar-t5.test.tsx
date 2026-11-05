// @vitest-environment jsdom
/**
 * Layar cetak ALETA ABT dan laporan pembanding (5 Nov 2026, Tahap 5): alur pilih perkara -> blangko -> pratinjau -> unduh,
 * isian kosong menahan unduh, penjaga tertutup menampilkan sebabnya, tanda ekstensi disertakan hanya bila ekstensi terbaca,
 * laporan pembanding dibaca di peramban tanpa kirim ke server, dan tidak ada label teknis atau lebar yang memaksa geser mendatar.
 * Data rekaan.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CetakAletaAbt } from "@/components/portal/cetak-aleta-abt";
import { LaporanPembanding } from "@/components/portal/laporan-pembanding-aleta-abt";
import { lupakanTanda } from "@/lib/aleta-abt-tanda-klien";

type Panggilan = { url: string; metode: string; kepala: Record<string, string>; badan: Record<string, unknown> | null };

const DAFTAR = { folder: [{ folder: "f1", label: "Perceraian Gugat", blangko: [{ id: "b1", nama: "Putusan Cerai Uji", rtf: true, arsip: false, hilang: false, ukuran: 1, disunting: false, versi: 1, terbit: 1, adaDraf: false }] }] };
const PRATINJAU = {
  nama: "Putusan Cerai Uji.rtf",
  kertas: { nama: "F4", lebarMm: 215, tinggiMm: 330 },
  paragraf: [
    { i: 0, teks: "PUTUSAN", rata: "tengah", li: 0, fi: 0, tabel: false, awalan: "" },
    { i: 1, teks: "Nomor 1/Pdt.G/2026/PA.Uji", rata: "kiri", li: 0, fi: 0, tabel: false, awalan: "" },
  ],
  jumlahParagraf: 2,
  terpotong: false,
  jumlahTerisi: 4,
  kosong: [] as Array<{ nama: string; sebab: string; status: string }>,
  lolosCetak: true,
  mesinGalat: "",
  ringkasanKeyakinan: { pasti: 4 },
  waktu: { botMs: 120, totalMs: 180 },
};

let panggilan: Panggilan[] = [];
let hak = { boleh: true, lewat: "hp", sebab: "" };
let pratinjau = PRATINJAU;
let galatCetak: { status: number; badan: unknown } | null = null;

function pasangFetch() {
  panggilan = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const badan = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
      panggilan.push({ url: u, metode: init?.method ?? "GET", kepala: (init?.headers as Record<string, string>) ?? {}, badan });
      const jawab = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => (status < 400 ? { ok: true, data } : data) });
      if (u.includes("/api/aleta-abt/tanda")) return jawab({ tanda: "tanda-uji.abc", berlakuSampai: Date.now() + 600_000 });
      if (u.includes("bagian=hak")) return jawab(hak);
      if (u.includes("bagian=daftar")) return jawab(DAFTAR);
      if (u.includes("bagian=perkara")) return jawab({ perkara: [{ nomorPerkara: "1/Pdt.G/2026/PA.Uji", perkaraId: "11", jenisPerkara: "Cerai Gugat" }] });
      if (badan?.tindakan === "pratinjau") return jawab(pratinjau);
      if (galatCetak) return jawab(galatCetak.badan, galatCetak.status);
      if (badan?.tindakan === "salinan-berkas") return jawab({ pdfBase64: btoa("%PDF-uji"), byte: 8, bentuk: "rtf", waktuMs: 5 });
      if (badan?.tindakan === "rtf") return jawab({ nama: "Putusan Cerai Uji.rtf", rtfBase64: btoa("{\\rtf1 x}"), byte: 9 });
      if (badan?.tindakan === "banding") {
        return jawab({
          alinea: { total: 3, identik: 2, persen: 66.7, jumlahAbt: 3, jumlahAleta: 3, perKelas: { "tata-letak": 0, "tanda-baca": 0, isi: 1, "hanya-abt": 0, "hanya-aleta": 0 }, terpotong: false, beda: [{ kelas: "isi", nomorAbt: 2, nomorAleta: 2, abt: "teks ABT rekaan", aleta: "teks ALETA rekaan" }] },
          kertas: { abt: { nama: "F4", lebarMm: 215, tinggiMm: 330 }, aleta: { nama: "F4", lebarMm: 215, tinggiMm: 330 } },
          waktu: { botMs: 1, totalMs: 2 },
        });
      }
      return jawab({});
    })
  );
}

beforeEach(() => {
  hak = { boleh: true, lewat: "hp", sebab: "" };
  pratinjau = PRATINJAU;
  galatCetak = null;
  lupakanTanda();
  pasangFetch();
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:uji", revokeObjectURL: () => undefined }));
});

afterEach(() => {
  document.body.replaceChildren();
  delete document.documentElement.dataset.aletaEkstensi;
  vi.unstubAllGlobals();
});

async function sampaiPratinjau() {
  render(<CetakAletaAbt />);
  await screen.findByLabelText("Cari blangko");
  fireEvent.change(screen.getByLabelText("Nomor perkara"), { target: { value: "1/Pdt.G" } });
  fireEvent.click(screen.getByRole("button", { name: "Cari perkara" }));
  fireEvent.click(await screen.findByText("1/Pdt.G/2026/PA.Uji"));
  fireEvent.click(await screen.findByText("Putusan Cerai Uji"));
  fireEvent.click(screen.getByRole("button", { name: "Pratinjau naskah" }));
  await screen.findByText("PUTUSAN");
}

describe("layar cetak ALETA ABT", () => {
  it("penjaga tertutup: menampilkan sebabnya dan tidak memuat pustaka", async () => {
    hak = { boleh: false, lewat: "", sebab: "Cetak dari layar ini memerlukan ekstensi ALETA di PC." };
    render(<CetakAletaAbt />);
    await screen.findByText(/memerlukan ekstensi ALETA di PC/);
    expect(panggilan.some((p) => p.url.includes("bagian=daftar"))).toBe(false);
  });

  it("alur pilih perkara, blangko, pratinjau: paragraf, kertas, dan waktu tampil", async () => {
    await sampaiPratinjau();
    expect(screen.getByText("Nomor 1/Pdt.G/2026/PA.Uji")).toBeTruthy();
    expect(screen.getByText(/F4 \(215 x 330 mm\)/)).toBeTruthy();
    expect(screen.getAllByText(/0,18 detik/).length).toBeGreaterThan(0);
    const pr = panggilan.find((p) => p.badan?.tindakan === "pratinjau");
    expect(pr?.badan).toMatchObject({ berkasId: "b1", perkaraId: "11" });
    expect(document.body.textContent).not.toMatch(/#\d{3,5}#|berkasId|perkaraId/);
  });

  it("tanpa ekstensi tidak meminta tanda; dengan ekstensi tanda disertakan di setiap permintaan", async () => {
    await sampaiPratinjau();
    expect(panggilan.some((p) => p.url.includes("/api/aleta-abt/tanda"))).toBe(false);
    expect(panggilan.every((p) => !("x-aleta-abt-tanda" in p.kepala))).toBe(true);
    document.body.replaceChildren();
    pasangFetch();
    document.documentElement.dataset.aletaEkstensi = "1.205.76";
    await sampaiPratinjau();
    expect(panggilan.filter((p) => p.url.includes("/api/aleta-abt/tanda")).length).toBe(1);
    const ke = panggilan.filter((p) => p.url.includes("/api/aleta-abt/cetak"));
    expect(ke.length).toBeGreaterThan(3);
    expect(ke.every((p) => p.kepala["x-aleta-abt-tanda"] === "tanda-uji.abc")).toBe(true);
  });

  it("unduh RTF meminta cetak final; isian kosong menonaktifkan unduhan dan menyebut namanya", async () => {
    await sampaiPratinjau();
    fireEvent.click(screen.getByRole("button", { name: "Unduh RTF" }));
    await waitFor(() => expect(panggilan.some((p) => p.badan?.tindakan === "rtf")).toBe(true));
    document.body.replaceChildren();
    pasangFetch();
    pratinjau = { ...PRATINJAU, lolosCetak: false, kosong: [{ nama: "Pekerjaan Pemohon", sebab: "", status: "kosong" }] };
    await sampaiPratinjau();
    expect((screen.getByRole("button", { name: "Unduh RTF" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Unduh PDF" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Unduh PDF SALINAN" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Pekerjaan Pemohon")).toBeTruthy();
  });

  it("nama berkas unduhan tidak memuat kata ALETA (berkas dapat diunggah ke SIPP/e-Court)", async () => {
    const nama: string[] = [];
    const klik = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      nama.push(this.download);
    };
    try {
      await sampaiPratinjau();
      fireEvent.click(screen.getByRole("button", { name: "Unduh RTF" }));
      await waitFor(() => expect(nama.length).toBe(1));
    } finally {
      HTMLAnchorElement.prototype.click = klik;
    }
    expect(nama[0]).toBe("Putusan Cerai Uji.rtf");
    expect(nama[0]).not.toMatch(/aleta/i);
  });

  it("PDF SALINAN dari berkas: berkas dikirim, PDF langsung terunduh tanpa kata ALETA di namanya", async () => {
    const nama: string[] = [];
    const klik = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      nama.push(this.download);
    };
    try {
      render(<CetakAletaAbt />);
      await screen.findByLabelText("Cari blangko");
      const masukan = document.querySelector('input[type="file"][accept=".rtf,.docx,.doc,.pdf"]') as HTMLInputElement;
      const berkas = new File(["{\rtf1 isi}"], "Putusan Uji 123.rtf", { type: "application/rtf" });
      Object.defineProperty(berkas, "arrayBuffer", { value: async () => new TextEncoder().encode("{\rtf1 isi}").buffer });
      fireEvent.change(masukan, { target: { files: [berkas] } });
      await screen.findByText(/PDF SALINAN dari Putusan Uji 123.rtf sudah diunduh/);
    } finally {
      HTMLAnchorElement.prototype.click = klik;
    }
    const kirim = panggilan.find((p) => p.badan?.tindakan === "salinan-berkas");
    expect(kirim?.badan).toMatchObject({ namaBerkas: "Putusan Uji 123.rtf" });
    expect(nama).toEqual(["Putusan Uji 123 (SALINAN).pdf"]);
    expect(nama[0]).not.toMatch(/aleta/i);
  });

  it("berita acara PDF ditolak: pesan dari server tampil dan tidak ada unduhan", async () => {
    galatCetak = { status: 422, badan: { ok: false, kode: "bukan_putusan", alasan: "Berkas PDF ini berita acara sidang. PDF salinan dari berkas PDF hanya untuk putusan dan penetapan, karena salinan berita acara memakai tanda tangan asli." } };
    render(<CetakAletaAbt />);
    await screen.findByLabelText("Cari blangko");
    const masukan = document.querySelector('input[type="file"][accept=".rtf,.docx,.doc,.pdf"]') as HTMLInputElement;
    const berkas = new File(["%PDF-1.4"], "BAS.pdf");
    Object.defineProperty(berkas, "arrayBuffer", { value: async () => new TextEncoder().encode("%PDF-1.4").buffer });
    fireEvent.change(masukan, { target: { files: [berkas] } });
    await screen.findByText(/Berkas PDF ini berita acara sidang/);
    expect(screen.queryByText(/sudah diunduh/)).toBeNull();
  });

  it("galat server tampil sebagai pesan, bukan layar kosong", async () => {
    await sampaiPratinjau();
    galatCetak = { status: 409, badan: { ok: false, ditahan: true, kosong: [{ nama: "Alamat Termohon" }], alasan: "Cetak final ditahan: 1 isian masih kosong." } };
    fireEvent.click(screen.getByRole("button", { name: "Unduh RTF" }));
    await screen.findByText(/Cetak final ditahan: 1 isian masih kosong/);
    expect(screen.getByText(/Alamat Termohon/)).toBeTruthy();
  });

  it("banding RTF dari ABT menampilkan angka alinea dan dua naskah berdampingan", async () => {
    await sampaiPratinjau();
    const masukan = document.querySelector('input[type="file"][accept=".rtf"]') as HTMLInputElement;
    const berkas = new File(["{\\rtf1 abt}"], "abt.rtf", { type: "application/rtf" });
    Object.defineProperty(berkas, "arrayBuffer", { value: async () => new TextEncoder().encode("{\\rtf1 abt}").buffer });
    fireEvent.change(masukan, { target: { files: [berkas] } });
    await screen.findByText("2 dari 3 identik");
    fireEvent.click(screen.getByRole("button", { name: "Lihat dua naskah berdampingan" }));
    expect(screen.getByText("teks ABT rekaan")).toBeTruthy();
    expect(screen.getByText("teks ALETA rekaan")).toBeTruthy();
    expect(screen.getAllByText("belum diukur").length).toBe(2);
  });

  it("tanpa label teknis dan tanpa lebar tetap yang memaksa geser mendatar", async () => {
    await sampaiPratinjau();
    const html = document.body.innerHTML;
    expect(html).not.toMatch(/\b(peladen|template|endpoint|payload|jalurAleta|cetakFinal)\b/i);
    expect(html).not.toMatch(/min-w-\[|w-\[\d{3,}px\]|overflow-x-scroll/);
  });
});

/** jsdom belum punya File.text(); peramban sungguhan punya. */
function berkasTeks(isi: string, nama: string) {
  const f = new File([isi], nama);
  Object.defineProperty(f, "text", { value: async () => isi });
  return f;
}

describe("laporan pembanding", () => {
  const laporan = {
    dibuat: "2026-11-05",
    keterangan: "Sampel uji.",
    ringkas: [{ jenis: "Cerai Gugat", naskah: 2, alinea: 100, identik: 99, persen: 99, naskahIdentik: 1, dijelaskan: 0, belumDijelaskan: 1 }],
    perKelas: { "tata-letak": 0, "tanda-baca": 0, isi: 1, "hanya-abt": 0, "hanya-aleta": 0 },
    beda: [{ jenis: "Cerai Gugat", blangko: "Putusan Cerai Uji", perkara: "p1", kelas: "isi", nomorAbt: 5, nomorAleta: 5, isian: ["Pekerjaan Pemohon"] }],
    belumTerukur: ["Jumlah halaman: tidak ada LibreOffice di mesin pengukur."],
    waktu: { jumlah: 2, rata: 800, tengah: 700, terlama: 900, tempat: "laptop pengembangan" },
  };

  it("dibaca di peramban: tidak ada permintaan ke server, ringkasan dan belum terukur tampil", async () => {
    render(<LaporanPembanding />);
    const masukan = document.querySelector('input[type="file"]') as HTMLInputElement;
    const berkas = berkasTeks(JSON.stringify(laporan), "laporan.json");
    fireEvent.change(masukan, { target: { files: [berkas] } });
    await screen.findByText("Cerai Gugat", { selector: "p" });
    expect(screen.getByText(/99 dari 100 alinea identik/)).toBeTruthy();
    expect(screen.getByText(/Beda dijelaskan: 0\. Beda belum dijelaskan: 1\./)).toBeTruthy();
    expect(screen.getByText(/belum dijelaskan\)/)).toBeTruthy();
    expect(screen.getByText(/tidak ada LibreOffice/)).toBeTruthy();
    expect(screen.getByText(/Isian pada alinea itu: Pekerjaan Pemohon/)).toBeTruthy();
    expect(screen.getByText(/bukan angka server/)).toBeTruthy();
    expect(panggilan.length).toBe(0);
  });

  it("berkas bukan laporan ditolak dengan pesan", async () => {
    render(<LaporanPembanding />);
    const masukan = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(masukan, { target: { files: [berkasTeks("bukan json", "x.json")] } });
    await screen.findByText("Berkas ini bukan laporan pembanding.");
  });
});
