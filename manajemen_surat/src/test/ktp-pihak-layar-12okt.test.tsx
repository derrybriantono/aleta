import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AletaEcourtKtpPihak, jedaTeks, waktuLokalKtp } from "@/components/portal/aleta-ecourt-ktp-pihak";
import { BarisTanggalKtp, TanggalKtpPihak, bersihkanKtpPihakStatus } from "@/components/portal/status-perkara-ktp-pihak";
import type { KtpPihakStatusData } from "@/lib/ktp-pihak-tampil";

/**
 * ============================================================================
 * LAYAR TANGGAL KTP (12 Okt 2026, butir 8 dan 11) - DIGAMBAR SUNGGUHAN, FETCH DITIRU
 * ============================================================================
 *
 *   - Status Perkara, Para pihak: tanggal KTP tiap pihak dengan tingkat yakin dan sumber
 *     "dari berkas KTP e-Court"; belum ada/tidak terbaca disebut beserta sebabnya; kuasa tak
 *     punya baris; hak ditolak (403) = tidak digambar; NIK tidak pernah tampil.
 *   - Integrasi e-Court: kartu pengaturan (nyala/mati, berkas per putaran, jeda) + histori per
 *     nomor perkara + baca ulang; bukan Admin (403) = kartu tidak digambar.
 */

const NIK_RAHASIA = "7203094505900001";

const DATA: KtpPihakStatusData = {
  ada: true,
  pihak: [
    { cabang: 1, urutan: 1, peran: "Penggugat", nama: "SITI AMINAH", namaSipp: "Siti Aminah", tanggalKtp: "18/02/2012", tanggalKtpIso: "2012-02-18", kota: "Donggala", yakin: "cukup", cocok: "nik", sebab: "", sumberBaca: "teks-pdf", fileId: "f1" },
  ],
  dokumenKtp: 2,
  belumDibaca: 0,
  tidakTerbaca: 0,
  takBertuan: 0,
  catatan: [],
};

describe("BarisTanggalKtp (Status Perkara > Para pihak)", () => {
  const semua = [
    { nama: "Siti Aminah", pihakKe: 1, jenis: "pihak" },
    { nama: "Budi Santoso", pihakKe: 2, jenis: "pihak" },
  ];
  const html = (data: KtpPihakStatusData, orang: (typeof semua)[number]) =>
    renderToStaticMarkup(createElement(BarisTanggalKtp, { data, orang, semuaPihak: semua }));

  it("pihak bertanggal: tanggal, tingkat yakin, dan sumber 'dari berkas KTP e-Court' (beserta kota); NIK tak ada", () => {
    const h = html({ ...DATA, pihak: [{ ...DATA.pihak[0], nik: NIK_RAHASIA } as never] }, semua[0]);
    expect(h).toContain("18/02/2012");
    expect(h).toContain("cukup yakin");
    expect(h).toContain("dari berkas KTP e-Court");
    expect(h).toContain("(Donggala)");
    expect(h).toContain('data-bagian="ktp-pihak"');
    expect(h).not.toContain("belum ada");
  });

  it("pihak tanpa KTP terbaca saat pihak lain ada: disebut 'belum ada' dan alasannya", () => {
    const h = html(DATA, semua[1]);
    expect(h).toContain("belum ada");
    expect(h).toContain("belum terbaca atau belum cocok");
    expect(h).not.toContain("18/02/2012");
  });

  it("tak ada satu pun yang terbaca: sebab perkara disebut apa adanya (belum dibaca / tidak terbaca / tak ada berkas)", () => {
    const kosong = { ...DATA, ada: false, pihak: [] };
    expect(html({ ...kosong, belumDibaca: 1 }, semua[0])).toContain("berkas KTP belum dibaca");
    expect(html({ ...kosong, tidakTerbaca: 1 }, semua[0])).toContain("tidak terbaca - tanggal diketik petugas");
    expect(html({ ...kosong, dokumenKtp: 0 }, semua[0])).toContain("tidak ada berkas KTP di arsip e-Court");
  });

  it("keyakinan 'ragu' diberi tanda periksa", () => {
    const h = html({ ...DATA, pihak: [{ ...DATA.pihak[0], yakin: "ragu" }] }, semua[0]);
    expect(h).toContain("ragu - periksa");
  });
});

// ----------------------------------------------------------------------------
type Rute = (url: string, init?: RequestInit) => { status?: number; data?: unknown };
let rute: Rute = () => ({ data: {} });
const dikirim: Array<{ url: string; method: string; badan: unknown }> = [];

beforeEach(() => {
  dikirim.length = 0;
  bersihkanKtpPihakStatus();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      dikirim.push({ url: String(url), method, badan: init?.body ? JSON.parse(String(init.body)) : null });
      const r = rute(String(url), init);
      return new Response(JSON.stringify({ ok: (r.status ?? 200) < 400, data: r.data }), {
        status: r.status ?? 200,
        headers: { "content-type": "application/json" },
      });
    })
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TanggalKtpPihak (memuat dari rute ktp-pihak-status)", () => {
  const orang = { nama: "Siti Aminah", pihakKe: 1, jenis: "pihak" };

  it("membaca SEKALI per perkara untuk banyak pihak; menampilkan tanggal bila sudah siap", async () => {
    rute = () => ({ data: DATA });
    render(
      <>
        <TanggalKtpPihak nomorPerkara="556/Pdt.G/2026/PA.Dgl" orang={orang} semuaPihak={[orang]} />
        <TanggalKtpPihak nomorPerkara="556/Pdt.G/2026/PA.Dgl" orang={{ nama: "Budi", pihakKe: 2, jenis: "pihak" }} semuaPihak={[orang]} />
      </>
    );
    await waitFor(() => expect(screen.getByText("18/02/2012")).toBeInTheDocument());
    expect(dikirim.filter((d) => d.url.includes("ktp-pihak-status"))).toHaveLength(1);
    expect(dikirim[0].url).toContain("nomor=556%2FPdt.G%2F2026%2FPA.Dgl");
    expect(screen.getByText(/belum ada/)).toBeInTheDocument(); // Budi
  });

  it("kuasa dan saksi tidak mendapat baris", async () => {
    rute = () => ({ data: DATA });
    const { container } = render(
      <>
        <TanggalKtpPihak nomorPerkara="1/Pdt.G/2026/PA.Dgl" orang={{ nama: "Kuasa", pihakKe: 1, jenis: "kuasa" }} semuaPihak={[]} />
        <TanggalKtpPihak nomorPerkara="1/Pdt.G/2026/PA.Dgl" orang={{ nama: "Saksi", pihakKe: 5, jenis: "pihak" }} semuaPihak={[]} />
      </>
    );
    await new Promise((r) => setTimeout(r, 30));
    expect(container.querySelector('[data-bagian="ktp-pihak"]')).toBeNull();
  });

  it("hak ditolak (403): tidak digambar sama sekali, bukan pesan galat", async () => {
    rute = () => ({ status: 403, data: {} });
    const { container } = render(<TanggalKtpPihak nomorPerkara="2/Pdt.G/2026/PA.Dgl" orang={orang} semuaPihak={[orang]} />);
    await waitFor(() => expect(dikirim.length).toBe(1));
    await new Promise((r) => setTimeout(r, 30));
    expect(container.textContent).toBe("");
  });

  it("bot tak terjangkau: sebabnya disebut", async () => {
    rute = () => ({ data: { ada: false, sebab: "Arsip KTP e-Court perkara ini tidak terbaca dari ALETA Bot.", pihak: [], catatan: [] } });
    render(<TanggalKtpPihak nomorPerkara="3/Pdt.G/2026/PA.Dgl" orang={orang} semuaPihak={[orang]} />);
    await waitFor(() => expect(screen.getByText(/tidak terbaca dari ALETA Bot/)).toBeInTheDocument());
  });
});

// ----------------------------------------------------------------------------
describe("pembantu tampilan", () => {
  it("jedaTeks", () => {
    expect(jedaTeks(120)).toBe("2 menit");
    expect(jedaTeks(3600)).toBe("1 jam");
    expect(jedaTeks(45)).toBe("45 detik");
    expect(jedaTeks(0)).toBe("-");
  });
  it("waktuLokalKtp: ISO sah diformat, kosong/rusak '-'", () => {
    expect(waktuLokalKtp("")).toBe("-");
    expect(waktuLokalKtp("bukan tanggal")).toBe("-");
    expect(waktuLokalKtp("2026-10-12T03:00:00.000Z")).toMatch(/2026/);
  });
});

// ----------------------------------------------------------------------------
const HALAMAN = {
  available: true,
  tersimpan: null,
  efektif: { aktif: true, batas: 2, jedaMs: 120_000, sumber: "bawaan" },
  bawaanServer: { aktif: true, batas: 2, jedaMs: 120_000, sumber: "bawaan" },
  batas: { perPutaran: { min: 1, maks: 10, bawaan: 2 }, jedaDetik: { min: 30, maks: 86400, bawaan: 120 } },
  penyapu: { menyala: true, sedangMembaca: false, terakhir: null, efektif: null, putaranBerikutnyaPada: null },
  ringkasan: { perkara: 3, berkas: 5, terbaca: 3, tidakTerbaca: 1, bukanKtp: 0, belumDibaca: 1, pihakBertanggal: 4, terakhirDibaca: "2026-10-12T03:00:00.000Z", percobaanTercatat: 9 },
  pesanRingkasan: "",
};
const DAFTAR = {
  available: true,
  message: "",
  adaLagi: false,
  perkara: [{ nomorPerkara: "556/Pdt.G/2026/PA.Dgl", perkaraId: 1, berkas: 2, terbaca: 1, gagal: 1, pihakBertanggal: 1, terakhirDibaca: "2026-10-12T03:00:00.000Z" }],
};
const RINCIAN = {
  available: true,
  message: "",
  riwayat: {
    ok: true,
    nomorPerkara: "556/Pdt.G/2026/PA.Dgl",
    dokumenKtp: 3,
    berkas: [
      { fileId: "f1", judul: "KTP", format: "pdf", status: "terbaca", sebab: "", percobaan: 0, sumberBaca: "teks-pdf", versi: 1, dibacaPada: "2026-10-12T03:00:00.000Z", pihak: [{ peran: "Penggugat", cabang: 1, urutan: 1, tanggalKtp: "18/02/2012", yakin: "cukup", cocok: "nik", sebab: "" }] },
      { fileId: "f2", judul: "KTP", format: "pdf", status: "tidak_terbaca", sebab: "ocr_belum_tersedia", percobaan: 2, sumberBaca: "", versi: 1, dibacaPada: "2026-10-11T03:00:00.000Z", pihak: [] },
    ],
    belumDibaca: [{ fileId: "f3", judul: "KTP", format: "pdf" }],
    percobaan: [
      { waktu: "2026-10-12T03:00:00.000Z", fileId: "f1", pemicu: "manual", status: "terbaca", sebab: "", percobaan: 0, sumberBaca: "teks-pdf", jumlahKtp: 1, hasil: [{ peran: "Penggugat", cabang: 1, urutan: 1, tanggalKtp: "18/02/2012", yakin: "cukup", cocok: "nik", sebab: "" }] },
      { waktu: "2026-10-11T03:00:00.000Z", fileId: "f2", pemicu: "latar", status: "tidak_terbaca", sebab: "ocr_belum_tersedia", percobaan: 2, sumberBaca: "", jumlahKtp: 0, hasil: [] },
    ],
  },
};

function ruteIntegrasi(): Rute {
  return (url, init) => {
    const method = init?.method ?? "GET";
    if (method === "PUT") return { data: { ...HALAMAN, tersimpan: { aktif: false, batas: 5, jedaDetik: 300, diubahOleh: "Admin Uji", diubahPada: "2026-10-12T04:00:00.000Z" }, efektif: { aktif: false, batas: 5, jedaMs: 300_000, sumber: "layar" } } };
    if (method === "POST") return { data: { available: true, message: "", ditandai: 2, dibaca: 1, terbaca: 1, sedangSibuk: false } };
    if (url.includes("bagian=riwayat")) return { data: DAFTAR };
    if (url.includes("bagian=perkara")) return { data: RINCIAN };
    return { data: HALAMAN };
  };
}

describe("AletaEcourtKtpPihak (Pengaturan > Integrasi e-Court)", () => {
  it("memuat angka ringkas, pengaturan yang berlaku, dan daftar histori", async () => {
    rute = ruteIntegrasi();
    render(<AletaEcourtKtpPihak />);
    await waitFor(() => expect(screen.getByText("Penarikan tanggal KTP pihak")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("556/Pdt.G/2026/PA.Dgl")).toBeInTheDocument());
    expect(screen.getByText("Penyapu latar aktif")).toBeInTheDocument();
    expect(screen.getByText("Belum dibaca")).toBeInTheDocument();
    expect(screen.getByLabelText("Berkas per putaran")).toHaveValue(2);
    expect(screen.getByLabelText("Jeda antar putaran dalam detik")).toHaveValue(120);
    expect(screen.getByText(/Yang berlaku sekarang: menyala, 2 berkas tiap putaran, jeda 2 menit/)).toBeInTheDocument();
    // Simpan nonaktif selama tidak ada yang berubah; "Pakai bawaan server" nonaktif tanpa pengaturan tersimpan
    expect(screen.getByRole("button", { name: "Simpan" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Pakai bawaan server" })).toBeDisabled();
  });

  it("mengubah lalu Simpan: PUT membawa nyala/mati, berkas per putaran, dan jeda; hasilnya ditampilkan", async () => {
    rute = ruteIntegrasi();
    render(<AletaEcourtKtpPihak />);
    await waitFor(() => expect(screen.getByLabelText("Berkas per putaran")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Berkas per putaran"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Jeda antar putaran dalam detik"), { target: { value: "300" } });
    fireEvent.click(screen.getByRole("switch", { name: "Penyapu latar tanggal KTP" }));
    const simpan = screen.getByRole("button", { name: "Simpan" });
    expect(simpan).toBeEnabled();
    fireEvent.click(simpan);
    await waitFor(() => expect(screen.getByText(/Tersimpan\. Berlaku dalam 30 detik, tanpa restart\./)).toBeInTheDocument());
    const put = dikirim.find((d) => d.method === "PUT");
    expect(put?.badan).toEqual({ aktif: false, batas: 5, jedaDetik: 300 });
    expect(screen.getByText("Penyapu latar mati")).toBeInTheDocument();
    expect(screen.getByText(/diatur dari layar ini oleh Admin Uji/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pakai bawaan server" })).toBeEnabled();
  });

  it("'Pakai bawaan server' mengirim {bawaan: true}", async () => {
    rute = (url, init) => {
      if ((init?.method ?? "GET") === "GET" && !url.includes("bagian=")) return { data: { ...HALAMAN, tersimpan: { aktif: false, batas: 5, jedaDetik: 300 }, efektif: { aktif: false, batas: 5, jedaMs: 300_000, sumber: "layar" } } };
      return ruteIntegrasi()(url, init);
    };
    render(<AletaEcourtKtpPihak />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Pakai bawaan server" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Pakai bawaan server" }));
    await waitFor(() => expect(dikirim.some((d) => d.method === "PUT")).toBe(true));
    expect(dikirim.find((d) => d.method === "PUT")?.badan).toEqual({ bawaan: true });
  });

  it("Rincian: berkas dengan hasil per pihak, sebab gagal dalam kalimat, percobaan ke-n, berkas belum dibaca, percobaan terdahulu beserta pemicu", async () => {
    rute = ruteIntegrasi();
    render(<AletaEcourtKtpPihak />);
    await waitFor(() => expect(screen.getByText("556/Pdt.G/2026/PA.Dgl")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Rincian" }));
    const rincian = await waitFor(() => {
      const el = document.querySelector('[data-bagian="rincian-ktp"]') as HTMLElement | null;
      if (!el) throw new Error("rincian belum tampil");
      return el;
    });
    const dalam = within(rincian);
    expect(dalam.getByText(/3 dokumen KTP di arsip e-Court · 2 berkas sudah diproses · 1 belum dibaca/)).toBeInTheDocument();
    expect(dalam.getAllByText("18/02/2012").length).toBeGreaterThanOrEqual(1);
    expect(dalam.getAllByText(/mesin OCR belum terpasang di server/).length).toBeGreaterThanOrEqual(1);
    expect(dalam.getAllByText("percobaan ke-2").length).toBeGreaterThanOrEqual(1);
    expect(dalam.getByText("Belum dibaca")).toBeInTheDocument();
    expect(dalam.getByText(/dipicu tombol Admin/)).toBeInTheDocument();
    expect(dalam.getByText(/dipicu penyapu latar/)).toBeInTheDocument();
    expect(rincian.textContent).not.toContain(NIK_RAHASIA);
  });

  it("Baca ulang perkara ini: POST aksi baca-ulang + nomor; hasilnya disebut", async () => {
    rute = ruteIntegrasi();
    render(<AletaEcourtKtpPihak />);
    await waitFor(() => expect(screen.getByText("556/Pdt.G/2026/PA.Dgl")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Rincian" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Baca ulang perkara ini" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Baca ulang perkara ini" }));
    await waitFor(() => expect(screen.getByText("Selesai: 1 berkas dibaca, 1 terbaca.")).toBeInTheDocument());
    expect(dikirim.find((d) => d.method === "POST")?.badan).toEqual({ aksi: "baca-ulang", nomor: "556/Pdt.G/2026/PA.Dgl" });
  });

  it("cari nomor perkara: parameter 'cari' dikirim", async () => {
    rute = ruteIntegrasi();
    render(<AletaEcourtKtpPihak />);
    await waitFor(() => expect(screen.getByLabelText("Cari nomor perkara")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Cari nomor perkara"), { target: { value: "556" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari" }));
    await waitFor(() => expect(dikirim.some((d) => d.url.includes("bagian=riwayat") && d.url.includes("cari=556"))).toBe(true));
  });

  it("bukan Admin / Super Admin (403): kartu tidak digambar", async () => {
    rute = () => ({ status: 403, data: {} });
    const { container } = render(<AletaEcourtKtpPihak />);
    await waitFor(() => expect(dikirim.length).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 30));
    expect(container.textContent).toBe("");
  });

  it("angka ringkas tidak terbaca (bot mati): disebut, pengaturan tetap dapat dipakai", async () => {
    rute = (url, init) => (!url.includes("bagian=") && (init?.method ?? "GET") === "GET" ? { data: { ...HALAMAN, ringkasan: null, pesanRingkasan: "ALETA Bot tidak dapat dihubungi." } } : ruteIntegrasi()(url, init));
    render(<AletaEcourtKtpPihak />);
    await waitFor(() => expect(screen.getByText(/Angka ringkas tidak terbaca: ALETA Bot tidak dapat dihubungi\./)).toBeInTheDocument());
    expect(screen.getByLabelText("Berkas per putaran")).toBeInTheDocument();
  });
});
