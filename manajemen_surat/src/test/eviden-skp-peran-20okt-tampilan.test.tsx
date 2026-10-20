import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RekapPetugas } from "@/components/portal/rekap-petugas";
import type { RekapPetugas as DataRekap } from "@/lib/rekap-petugas";

/**
 * ============================================================================
 * TOMBOL "UNDUH EVIDEN SKP" DI REKAP PP, JURU SITA, DAN MEDIATOR (20 Okt 2026)
 * ============================================================================
 *
 * Halaman Rekap Petugas hakim sudah punya tombol itu. Untuk PP (?peran=panitera),
 * Juru Sita, dan Mediator tombol hanya muncul bila pegawai di balik halaman itu
 * ditemukan (akun SIPP -> Pemetaan), aktif, dan pengunjung berhak. Menunya sama,
 * tetapi berbicara ke /api/skp/daftar dan /api/skp/unduh dengan ?jenis=&pegawai=.
 */

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const bagian = { pembilang: 0, penyebut: 0, persen: null };

function rekap(peran: "panitera" | "jurusita" | "mediator" | "hakim", nama: string): DataRekap {
  const kosong = {
    jumlah: 0,
    keadaan: { proses: bagian, putus: bagian, putusBelumBht: bagian, bht: bagian },
    hasil: [],
    lama: { dihitung: 0, tanpaTanggal: 0, rataHari: null, medianHari: null, dalamBatas: bagian, prosesLewatBatas: bagian },
    verstek: { ...bagian, tidakTercatat: 0 },
    ecourt: bagian,
    banding: bagian,
  };
  return {
    ok: true,
    peran,
    id: 5,
    acuan: "2026-10-20",
    dihitungPada: "2026-10-20T02:00:00.000Z",
    dariSinggahan: false,
    perkaraTerbaca: true,
    identitas: {
      id: 5,
      nama,
      namaTerbaca: true,
      kode: "",
      aktif: true,
      sumber: "panitera_pn",
      jabatan: "",
      statusMediator: "",
      bersertifikat: null,
      hakimId: null,
      idMediator: [],
    },
    dasar: {},
    ambang: { lamaPerkaraHari: 150, mediasiHari: 30 },
    ringkas: kosong,
    diganti: null,
    menurutPeran: [],
    menurutTahun: [],
    menurutJenis: [],
    mediasi: null,
    relaas: null,
    sidang: null,
    daftar: {
      baris: [],
      jumlah: 0,
      lewati: 0,
      batas: 100,
      adaLagi: false,
      saringan: { tahun: null, keadaan: "", kedudukan: "" },
      pilihanTahun: [],
      pilihanKedudukan: [],
    },
    terpotong: false,
    takTerbaca: [],
  } as DataRekap;
}

const json = (badan: unknown, status = 200) =>
  new Response(JSON.stringify(badan), { status, headers: { "Content-Type": "application/json" } });

function pasang(peran: "panitera" | "jurusita" | "mediator" | "hakim", nama: string, pegawai: unknown) {
  const ambil = vi.fn(async (alamat: string) => {
    const url = new URL(String(alamat), "http://portal.contoh");
    if (url.pathname.endsWith("/api/aleta-ecourt/rekap-petugas")) {
      return json({ ok: true, data: { available: true, rekap: rekap(peran, nama), pesan: "" } });
    }
    if (url.pathname.endsWith("/api/skp/rekap-pegawai")) return json({ ok: true, data: pegawai });
    if (url.pathname.endsWith("/api/skp/daftar")) {
      return json({
        ok: true,
        data: {
          jenis: url.searchParams.get("jenis"),
          periode: { labelPanjang: "Triwulan III Tahun 2026" },
          orang: { nama },
          ketua: null,
          dokumen: [
            {
              kunci: "lembar-skp",
              judul: "LEMBAR SKP",
              judulLengkap: "Lembar SKP Panitera Pengganti Triwulan III Tahun 2026",
              tersedia: true,
              sebabTidakTersedia: null,
              jumlahBaris: 9,
            },
            {
              kunci: "bukti-pp-sidang",
              judul: "REKAP",
              judulLengkap: "Rekap Pendampingan Sidang dan BAS Triwulan III Tahun 2026",
              tersedia: true,
              sebabTidakTersedia: null,
              jumlahBaris: 12,
            },
          ],
          galat: [],
          catatanOperator: [],
          penetapan: null,
          dariPenetapan: false,
        },
      });
    }
    return json({ ok: false, error: { message: "tidak dikenal" } }, 404);
  });
  vi.stubGlobal("fetch", ambil);
  return ambil;
}

const kueri = (ambil: ReturnType<typeof vi.fn>, akhiran: string) =>
  ambil.mock.calls.map((c) => new URL(String(c[0]), "http://portal.contoh")).filter((u) => u.pathname.endsWith(akhiran));

describe("tombol eviden SKP di rekap PP, Juru Sita, dan Mediator", () => {
  it("PP: pegawai ditemukan -> tombol muncul, menu membuka daftar jenis pp untuk pegawai itu, unduhan lewat /api/skp/unduh", async () => {
    const ambil = pasang("panitera", "PP Lima, S.H.", {
      tersedia: true,
      jenis: "pp",
      labelJenis: "Panitera Pengganti",
      pegawai: { userId: "usr-ppg", nama: "PP Lima", nip: null },
    });
    render(<RekapPetugas peran="panitera" id="5" />);
    await screen.findByRole("heading", { name: "PP Lima, S.H." });
    const cari = kueri(ambil, "/api/skp/rekap-pegawai");
    expect(cari).toHaveLength(1);
    expect(cari[0].searchParams.get("peran")).toBe("panitera");
    expect(cari[0].searchParams.get("id")).toBe("5");

    const tombol = await screen.findByRole("button", { name: /Unduh eviden SKP/ });
    fireEvent.click(tombol);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Bukti dukung SKP Panitera Pengganti PP Lima, S\.H\./)).toBeTruthy();
    expect(within(dialog).getByText(/tempat tanda tangan pegawai \(kiri\) dan pejabat penilai \(kanan\)/)).toBeTruthy();
    await within(dialog).findByText("Lembar SKP Panitera Pengganti Triwulan III Tahun 2026");

    const daftar = kueri(ambil, "/api/skp/daftar")[0];
    expect(daftar.searchParams.get("jenis")).toBe("pp");
    expect(daftar.searchParams.get("pegawai")).toBe("usr-ppg");
    // Pegawai-lah kuncinya: tanpa id SIPP hakim dan tanpa peran.
    expect(daftar.searchParams.get("id")).toBeNull();
    expect(daftar.searchParams.get("peran")).toBeNull();

    const pdf = within(dialog).getByRole("link", { name: "Unduh Lembar SKP Panitera Pengganti Triwulan III Tahun 2026 sebagai PDF" });
    const href = new URL(pdf.getAttribute("href") ?? "", "http://portal.contoh");
    expect(href.pathname).toMatch(/\/api\/skp\/unduh$/);
    expect(href.searchParams.get("jenis")).toBe("pp");
    expect(href.searchParams.get("pegawai")).toBe("usr-ppg");
    expect(href.searchParams.get("dokumen")).toBe("lembar-skp");
    expect(href.searchParams.get("format")).toBe("pdf");
    // Sampai di sini tidak ada jalur eviden hakim.
    expect(kueri(ambil, "/api/aleta-ecourt/eviden-skp")).toHaveLength(0);
  });

  it("Juru Sita dan Mediator memakai jenisnya sendiri", async () => {
    for (const [peran, jenis, label] of [
      ["jurusita", "jurusita-pengganti", "Jurusita Pengganti"],
      ["mediator", "mediator", "Mediator"],
    ] as const) {
      const ambil = pasang(peran, "Orang Uji", {
        tersedia: true,
        jenis,
        labelJenis: label,
        pegawai: { userId: "usr-x", nama: "Orang Uji", nip: null },
      });
      const { unmount } = render(<RekapPetugas peran={peran} id="5" />);
      await screen.findByRole("heading", { name: "Orang Uji" });
      fireEvent.click(await screen.findByRole("button", { name: /Unduh eviden SKP/ }));
      await waitFor(() => expect(kueri(ambil, "/api/skp/daftar").length).toBeGreaterThan(0));
      expect(kueri(ambil, "/api/skp/daftar")[0].searchParams.get("jenis")).toBe(jenis);
      unmount();
      cleanup();
    }
  });

  it("pegawai tidak ditemukan, nonaktif, atau pengunjung tidak berhak: tidak ada tombol, halaman rekap tetap terbuka", async () => {
    pasang("panitera", "PP Lima, S.H.", {
      tersedia: false,
      alasan: "Eviden SKP hanya untuk pemiliknya, atasan langsungnya, pimpinan, Panitera, dan administrator.",
    });
    render(<RekapPetugas peran="panitera" id="5" />);
    await screen.findByRole("heading", { name: "PP Lima, S.H." });
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByRole("button", { name: /Unduh eviden SKP/ })).toBeNull();
  });

  it("rute pegawai gagal (403/500): tanpa tombol dan tanpa galat di halaman", async () => {
    const ambil = vi.fn(async (alamat: string) => {
      const url = new URL(String(alamat), "http://portal.contoh");
      if (url.pathname.endsWith("/api/aleta-ecourt/rekap-petugas")) {
        return json({ ok: true, data: { available: true, rekap: rekap("jurusita", "JS Uji"), pesan: "" } });
      }
      return json({ ok: false, error: { message: "ditolak" } }, 403);
    });
    vi.stubGlobal("fetch", ambil);
    const { container } = render(<RekapPetugas peran="jurusita" id="5" />);
    await screen.findByRole("heading", { name: "JS Uji" });
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByRole("button", { name: /Unduh eviden SKP/ })).toBeNull();
    expect(container.textContent).not.toMatch(/ditolak/);
  });

  it("hakim: perilaku lama - tombol langsung ada, tanpa mencari pegawai", async () => {
    const ambil = pasang("hakim", "Hakim Lima, S.H.", { tersedia: false, alasan: "tidak dipakai" });
    render(<RekapPetugas peran="hakim" id="5" />);
    await screen.findByRole("heading", { name: "Hakim Lima, S.H." });
    expect(await screen.findByRole("button", { name: /Unduh eviden SKP/ })).toBeTruthy();
    expect(kueri(ambil, "/api/skp/rekap-pegawai")).toHaveLength(0);
  });
});
