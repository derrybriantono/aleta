import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * 5.1 Bundel satu PDF - tombol di layar Sampul/Daftar Isi (jsdom, host tiruan): halaman ASLI berkas menggantikan perkiraan hanya selama
 * bundel disusun, daftar isi yang dicetak memakainya, nomor 'awal'/'akhir' yang dikirim ke portal sama dengan daftar isi itu, dan setelah
 * selesai layar kembali ke angka semula (tidak ada yang diam-diam tersimpan).
 */
const AKAR = path.resolve(__dirname, "../../..");
type Bebas = any;
let BK: Bebas;

beforeAll(() => {
  const g = globalThis as Bebas;
  if (!g.CSS || typeof g.CSS.escape !== "function") g.CSS = { escape: (s: string) => String(s).replace(/([^\w-])/g, "\\$1") };
  (0, eval)(readFileSync(path.join(AKAR, "ekstensi-sipp/blangko-derry-berkas.js"), "utf8"));
  BK = g.AletaBerkasKhusus;
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

const fakta = () => ({
  perkara: { perkaraId: 5, nomor: "5/Pdt.G/2026/PA.Cth", jenisId: 347, jenisNama: "Cerai Gugat", jenis: "cg", permohonan: false, berlawanan: true, sebutanP: "Penggugat", sebutanT: "Tergugat" },
  jumlahPihak: { p1: 1, p2: 1, p3: 0, p4: 0 },
  pihakSemua: [{ sisi: 1, urutan: 1, nama: "Penggugat Satu", alamat: "Jl. A" }],
  anak: [],
  objek: [],
  riwayatSemua: [],
  susulan: { oto: {}, gagal: [] },
  alasan: { oto: {}, gagal: false },
  ciri: {},
  isian: {},
  upayaHukum: false,
  dokumen: [
    { bundel: "A", grup: "I. PENDAFTARAN", kunci: "gugatan", nama: "Surat Gugatan Penggugat", tanggal: "2026-01-04", halaman: 6, sumber: "pasti", dasar: "arsip" },
    { bundel: "A", grup: "II. PENETAPAN AWAL", kunci: "phs", nama: "Penetapan Hari Sidang (PHS)", tanggal: "2026-01-08", halaman: null, sumber: "perkiraan", jenisBawaan: "phs" },
    { bundel: "A", grup: "III. PEMERIKSAAN", kunci: "bas:1", nama: "Berita Acara Sidang Pertama", tanggal: "2026-02-01", halaman: null, sumber: "perkiraan", jenisBawaan: "bas" },
    { bundel: "A", grup: "III. PEMERIKSAAN", kunci: "relaas:1:p", nama: "Relaas Panggilan Penggugat ke 1", tanggal: "2026-01-20", halaman: null, sumber: "perkiraan", jenisBawaan: "relaas" },
  ],
});

function buatHost() {
  const panggilan: Array<{ alamat: string; metode: string; badan: Bebas }> = [];
  const toast: string[] = [];
  const host = {
    ambilPortal: async (alamat: string, opsi: Bebas) => {
      const metode = String((opsi && opsi.method) || "GET");
      const badan = opsi && opsi.body ? JSON.parse(opsi.body) : null;
      panggilan.push({ alamat, metode, badan });
      if (alamat.endsWith("/bundel")) {
        if (badan.aksi === "periksa") {
          return {
            dokumen: [
              { kunci: "gugatan", berkas: 1, pdf: 1, bukanPdf: 0, halaman: 8, ragu: false },
              { kunci: "phs", berkas: 0, pdf: 0, bukanPdf: 0, halaman: null, ragu: false },
              { kunci: "bas:1", berkas: 1, pdf: 1, bukanPdf: 0, halaman: 3, ragu: true },
              { kunci: "relaas:1:p", berkas: 1, pdf: 1, bukanPdf: 0, halaman: 4, ragu: false },
            ],
          };
        }
        return { pdfBase64: btoa("%PDF-1.4 tiruan"), halaman: 20, halamanSampul: 1, halamanDaftarIsi: 1, peringatan: ["Penetapan Hari Sidang (PHS): belum ada PDF-nya (tidak ada berkas); diganti 2 halaman penanda."], baris: [{ kunci: "phs", penanda: true }] };
      }
      if (alamat.includes("/naskah")) return { rtfBase64: btoa("{\\rtf1\\ansi Halo}"), kosong: [], mesinGalat: "", lampiran: [] };
      if (metode === "PUT") return { ok: true, ditolak: [] };
      return { fakta: fakta(), sunting: { susunan: {}, tag: {}, isian: {} }, bawaan: { putusan: 13 } };
    },
    unduh: vi.fn(async () => ({ ok: true })),
    pdfDari: vi.fn(async () => ({ blob: new Blob(["%PDF-1.4 x"]) })),
    namaUnduhan: (n: string, b: string, a: string) => `${n} - ${b}.${a}`,
    rtfKeHtml: (rtf: string) => `<p>${rtf.length}</p>`,
    toast: (t: string) => toast.push(t),
    bacaPenyimpanan: async () => ({}),
    tulisPenyimpanan: vi.fn(async () => true),
    sebagaiPeran: () => "",
  };
  return { host, panggilan, toast };
}

describe("tombol Bundel satu PDF", () => {
  it("memakai halaman asli untuk daftar isi, mengirim rentang yang sama ke portal, mengunduh satu PDF, lalu mengembalikan angka layar", async () => {
    vi.useFakeTimers();
    const w = document.createElement("div");
    document.body.appendChild(w);
    const { host, panggilan, toast } = buatHost();
    await BK.buka(w, host, { jenis: "daftar-isi", bentuk: "awal", perkaraId: "5", nomor: "5/Pdt.G/2026/PA.Cth" });
    await vi.advanceTimersByTimeAsync(50);
    expect(w.querySelector('[data-bk="bundel"]')).toBeTruthy();
    const ringkasSebelum = (w.querySelector("[data-bk-ringkas]") as HTMLElement).textContent;
    (w.querySelector('[data-bk="bundel"]') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(1500);
    await vi.advanceTimersByTimeAsync(1500);

    const periksa = panggilan.find((p) => p.alamat.endsWith("/bundel") && p.badan.aksi === "periksa")!;
    expect([...periksa.badan.kunci].sort()).toEqual(["bas:1", "gugatan", "phs", "relaas:1:p"]);
    const naskahDaftar = panggilan.filter((p) => p.alamat.includes("/naskah")).find((p) => p.badan.jenis === "daftar-isi")!;
    const per = Object.fromEntries(naskahDaftar.badan.baris.map((b: Bebas) => [b.kunci, b]));
    expect(per["gugatan"]).toMatchObject({ halaman: 8, sumber: "pasti" });
    expect(per["relaas:1:p"]).toMatchObject({ halaman: 4, sumber: "pasti" });
    // bas:1: dua cara hitung berbeda (ragu) -> tidak dipakai sebagai angka pasti
    expect(per["bas:1"].sumber).toBe("perkiraan");

    const susun = panggilan.find((p) => p.alamat.endsWith("/bundel") && p.badan.aksi === "susun")!;
    expect(susun.badan.sampulPdfBase64).toBeTruthy();
    expect(susun.badan.daftarIsiPdfBase64).toBeTruthy();
    // urutan baku daftar isi, kumulatif tanpa celah, dan sama dengan baris yang dikirim ke naskah daftar isi
    let kursor = 1;
    for (const b of susun.badan.baris) {
      expect(b.awal).toBe(kursor);
      kursor = b.akhir + 1;
      expect(b.akhir - b.awal + 1).toBe(per[b.kunci].halaman);
    }
    expect(susun.badan.baris.map((b: Bebas) => b.kunci).sort()).toEqual(["bas:1", "gugatan", "phs", "relaas:1:p"]);
    const g = susun.badan.baris.find((b: Bebas) => b.kunci === "gugatan");
    expect(g.akhir - g.awal + 1).toBe(8);

    expect(host.unduh).toHaveBeenCalledTimes(1);
    expect((host.unduh.mock.calls[0] as Bebas[])[1]).toBe("5/Pdt.G/2026/PA.Cth - Berkas Perkara Lengkap.pdf.pdf");
    expect(toast.some((t) => /Bundel diunduh: 20 halaman, 4 dokumen/.test(t))).toBe(true);
    expect(w.textContent).toMatch(/1 dokumen belum berbentuk PDF/);
    expect(w.textContent).toMatch(/diganti 2 halaman penanda/);

    // angka layar kembali seperti semula dan tidak ada simpanan sunting baru akibat bundel
    expect((w.querySelector("[data-bk-ringkas]") as HTMLElement).textContent).toBe(ringkasSebelum);
    const put = panggilan.filter((p) => p.metode === "PUT");
    expect(put.every((p) => !JSON.stringify(p.badan).includes('"halamanTeks":"8"'))).toBe(true);
  });

  it("bila portal gagal: tidak ada unduhan, pesan jelas, dan tombol dapat dipakai lagi", async () => {
    vi.useFakeTimers();
    const w = document.createElement("div");
    document.body.appendChild(w);
    const { host, toast } = buatHost();
    const asli = host.ambilPortal;
    host.ambilPortal = async (alamat: string, opsi: Bebas) => {
      if (alamat.endsWith("/bundel")) throw new Error("Bot ALETA tidak dapat membaca berkas perkara ini.");
      return asli(alamat, opsi);
    };
    await BK.buka(w, host, { jenis: "sampul", bentuk: "awal", perkaraId: "5", nomor: "5/Pdt.G/2026/PA.Cth" });
    await vi.advanceTimersByTimeAsync(50);
    (w.querySelector('[data-bk="bundel"]') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(1500);
    expect(host.unduh).not.toHaveBeenCalled();
    expect(toast.at(-1)).toMatch(/Bundel gagal: Bot ALETA tidak dapat membaca/);
    const tombol = w.querySelector('[data-bk="bundel"]') as HTMLButtonElement;
    expect(tombol.disabled).toBe(false);
  });
});
