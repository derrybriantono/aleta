import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RekapPetugas } from "@/components/portal/rekap-petugas";
import type { Bagian, BarisRekap, KelompokRekap, RekapPetugas as DataRekap, RingkasPerkara } from "@/lib/rekap-petugas";

/**
 * ============================================================================
 * HALAMAN REKAP PETUGAS - DIGAMBAR, DISARING, DIBACA
 * ============================================================================
 *
 * Rute portal ditirukan lewat fetch palsu menurut kontraknya: 200
 * { ok, data: { available, rekap, pesan } }, atau galat { ok:false,
 * error:{message} } berstatus 4xx. Yang diperiksa yang TERGAMBAR:
 *
 *   - tiap persentase menyebut pembilang/penyebutnya; penyebut nol "—"
 *   - sebutan Mediator Hakim / Mediator Non Hakim dari sandi H / N
 *   - nomor perkara membuka Status Perkara (?perkara=) di tab baru
 *   - saringan dan "muat lagi" mengirim parameter yang benar
 *   - bacaan perkara yang gagal TIDAK digambar sebagai kartu nol
 *   - alamat yang tidak lengkap tidak memanggil apa pun
 *
 * Nama orang dan nomor perkara di sini karangan.
 */

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const b = (pembilang: number, penyebut: number): Bagian => ({
  pembilang,
  penyebut,
  persen: penyebut > 0 ? Math.round((pembilang / penyebut) * 1000) / 10 : null,
});

function ringkas(ubah: Partial<RingkasPerkara> = {}): RingkasPerkara {
  return {
    jumlah: 5,
    keadaan: { proses: b(2, 5), putus: b(3, 5), putusBelumBht: b(1, 5), bht: b(2, 5) },
    hasil: [
      { label: "Dikabulkan", ...b(1, 3) },
      { label: "Dicabut", ...b(1, 3) },
      { label: "Tidak Dapat Diterima", ...b(1, 3) },
    ],
    lama: {
      dihitung: 3,
      tanpaTanggal: 0,
      rataHari: 68.7,
      medianHari: 32,
      dalamBatas: b(2, 3),
      prosesLewatBatas: b(1, 2),
    },
    verstek: { ...b(1, 2), tidakTercatat: 1 },
    ecourt: b(2, 5),
    banding: b(1, 3),
    ...ubah,
  };
}

function baris(nomor: string, ubah: Partial<BarisRekap> = {}): BarisRekap {
  return {
    perkaraId: nomor,
    nomorPerkara: `${nomor}/Pdt.G/2025/PA.Ctt`,
    tanggalDaftar: "2025-01-10",
    tahun: 2025,
    jenisPerkara: "Cerai Gugat",
    kedudukan: ["ketua"],
    keadaan: "bht",
    tanggalPutusan: "2025-02-20",
    tanggalBht: "2025-03-10",
    statusPutusan: "Dikabulkan",
    verstek: true,
    ecourt: true,
    banding: false,
    hariMediasi: 10,
    lamaHari: 32,
    umurHari: null,
    ...ubah,
  };
}

const kelompok = (kunci: string | number, label?: string): KelompokRekap => ({ kunci, label, ...ringkas() });

function rekapUji(ubah: Partial<DataRekap> = {}): DataRekap {
  return {
    ok: true,
    peran: "hakim",
    id: 7,
    acuan: "2026-09-27",
    dihitungPada: "2026-09-27T02:00:00.000Z",
    dariSinggahan: false,
    perkaraTerbaca: true,
    identitas: {
      id: 7,
      nama: "Hakim Tujuh, S.H.",
      namaTerbaca: true,
      kode: "C1",
      aktif: true,
      sumber: "hakim_pn",
      jabatan: "",
      statusMediator: "",
      bersertifikat: null,
      hakimId: null,
      idMediator: [40, 42],
    },
    dasar: {
      lama: "Hari kalender sejak pendaftaran sampai putusan, dikurangi masa mediasi.",
      keadaan: "Masih proses = belum ada tanggal putusan.",
      hasil: "Nama status dibaca lewat tabel status_putusan.",
      minutasi: "Tanggal minutasi tidak dipakai sebagai ukuran.",
      penugasan: "Dihitung atas penunjukan yang masih AKTIF.",
      mediasi: "Lama mediasi sejak penetapan sampai laporan.",
      relaas: "Relaas pada perkara yang DITUGASKAN kepadanya.",
      sidang: "Sidang pada perkara yang DITUGASKAN kepadanya.",
    },
    ambang: { lamaPerkaraHari: 150, mediasiHari: 30 },
    ringkas: ringkas(),
    diganti: 1,
    menurutPeran: [kelompok("ketua", "Ketua majelis"), kelompok("mediator", "Mediator")],
    menurutTahun: [kelompok(2026), kelompok(2025)],
    menurutJenis: [kelompok("Cerai Gugat")],
    mediasi: {
      jumlah: 4,
      perkara: 4,
      hasil: [
        { kunci: "berhasil", label: "Berhasil", ...b(2, 4) },
        { kunci: "sebagian", label: "Berhasil sebagian", ...b(0, 4) },
        { kunci: "tidak", label: "Tidak berhasil", ...b(1, 4) },
        { kunci: "berjalan", label: "Belum ada hasil - perkaranya belum putus", ...b(1, 4) },
      ],
      berhasilRinci: { kesepakatan: b(1, 4), pencabutan: b(1, 4) },
      lama: { dihitung: 3, rataHari: 19.3, medianHari: 10, lewatBatas: b(1, 3), berjalanLewatBatas: 1, batasHari: 30 },
    },
    relaas: null,
    sidang: null,
    daftar: {
      baris: [
        baris("101", { kedudukan: ["ketua", "mediator"], mediasi: { sandiHasil: "Y1", golongan: "berhasil", penetapan: "2025-01-15", laporan: "2025-01-25", lamaHari: 10 } }),
        baris("105", { keadaan: "proses", tanggalPutusan: "", tanggalBht: "", statusPutusan: "", verstek: null, lamaHari: null, umurHari: 151, tahun: 2026, tanggalDaftar: "2026-03-01" }),
      ],
      jumlah: 150,
      lewati: 0,
      batas: 100,
      adaLagi: true,
      saringan: { tahun: null, keadaan: "", kedudukan: "" },
      pilihanTahun: [2026, 2025],
      pilihanKedudukan: [
        { kunci: "ketua", label: "Ketua majelis", jumlah: 2 },
        { kunci: "mediator", label: "Mediator", jumlah: 4 },
      ],
    },
    terpotong: false,
    takTerbaca: [],
    ...ubah,
  };
}

/** Kartu angka berlabel itu - label yang sama juga menjadi kepala tabel dan pilihan saringan. */
function kartuBerlabel(label: string): HTMLElement {
  const p = screen.getAllByText(label).find((el) => el.tagName === "P");
  if (!p?.parentElement) throw new Error(`kartu ${label} tidak tergambar`);
  return p.parentElement;
}

function jawabanJson(badan: unknown, status = 200): Response {
  return new Response(JSON.stringify(badan), { status, headers: { "Content-Type": "application/json" } });
}

function pasangFetch(jawab: (url: URL) => Response | Promise<Response>) {
  const ambil = vi.fn(async (alamat: string) => jawab(new URL(String(alamat), "http://portal.contoh")));
  vi.stubGlobal("fetch", ambil);
  return ambil;
}

const kueriKe = (ambil: ReturnType<typeof vi.fn>, n: number) =>
  new URL(String(ambil.mock.calls[n][0]), "http://portal.contoh").searchParams;

describe("alamat yang tidak lengkap", () => {
  it("peran atau id yang salah: penjelasan, tanpa satu pun permintaan", async () => {
    const ambil = pasangFetch(() => jawabanJson({ ok: true, data: { available: true, rekap: rekapUji(), pesan: "" } }));
    const { rerender } = render(<RekapPetugas peran="ketua" id="7" />);
    expect(screen.getByText("Alamat rekap tidak lengkap")).toBeTruthy();
    rerender(<RekapPetugas peran="hakim" id="abc" />);
    expect(screen.getByText("Alamat rekap tidak lengkap")).toBeTruthy();
    await new Promise((r) => setTimeout(r, 20));
    expect(ambil).not.toHaveBeenCalled();
  });
});

describe("rekap yang tergambar", () => {
  it("meminta rekap orang itu lewat peran dan id", async () => {
    const ambil = pasangFetch(() => jawabanJson({ ok: true, data: { available: true, rekap: rekapUji(), pesan: "" } }));
    render(<RekapPetugas peran="hakim" id="7" />);
    await screen.findByRole("heading", { name: "Hakim Tujuh, S.H." });
    const kueri = kueriKe(ambil, 0);
    expect(kueri.get("peran")).toBe("hakim");
    expect(kueri.get("id")).toBe("7");
    expect(new URL(String(ambil.mock.calls[0][0]), "http://portal.contoh").pathname).toMatch(
      /\/api\/aleta-ecourt\/rekap-petugas$/
    );
  });

  it("persentase menyebut pembilang dan penyebutnya", async () => {
    pasangFetch(() => jawabanJson({ ok: true, data: { available: true, rekap: rekapUji(), pesan: "" } }));
    render(<RekapPetugas peran="hakim" id="7" />);
    await screen.findByRole("heading", { name: "Hakim Tujuh, S.H." });
    // Kartu "Masih proses": 40% besar, "2 dari 5 · 40%" di bawahnya.
    const kartu = kartuBerlabel("Masih proses");
    expect(within(kartu).getByText("40%")).toBeTruthy();
    expect(within(kartu).getByText("2 dari 5 · 40%")).toBeTruthy();
    // Hasil putusan atas perkara yang putus.
    expect(screen.getAllByText("1 dari 3 · 33,3%").length).toBeGreaterThanOrEqual(3);
    // Pernah diganti disebut, tidak dihitung.
    expect(screen.getByText(/1 perkara lain: pernah ditunjuk lalu diganti/)).toBeTruthy();
  });

  it("penyebut nol ditulis —, bukan 0% atau NaN", async () => {
    const kosong = ringkas({
      jumlah: 0,
      keadaan: { proses: b(0, 0), putus: b(0, 0), putusBelumBht: b(0, 0), bht: b(0, 0) },
      hasil: [],
      lama: { dihitung: 0, tanpaTanggal: 0, rataHari: null, medianHari: null, dalamBatas: b(0, 0), prosesLewatBatas: b(0, 0) },
      verstek: { ...b(0, 0), tidakTercatat: 0 },
      ecourt: b(0, 0),
      banding: b(0, 0),
    });
    pasangFetch(() =>
      jawabanJson({
        ok: true,
        data: {
          available: true,
          rekap: rekapUji({ ringkas: kosong, menurutPeran: [], menurutTahun: [], menurutJenis: [], mediasi: null }),
          pesan: "",
        },
      })
    );
    const { container } = render(<RekapPetugas peran="hakim" id="7" />);
    await screen.findByRole("heading", { name: "Hakim Tujuh, S.H." });
    const kartu = kartuBerlabel("Masih proses");
    expect(within(kartu).getByText("—")).toBeTruthy();
    expect(container.textContent).not.toMatch(/NaN/);
    expect(container.textContent).not.toMatch(/0 dari 0/);
    expect(within(kartu).queryByText("0%")).toBeNull();
  });

  it("mediator hakim dan non hakim disebut dari sandi H dan N", async () => {
    pasangFetch(() =>
      jawabanJson({
        ok: true,
        data: {
          available: true,
          rekap: rekapUji({
            peran: "mediator",
            identitas: { ...rekapUji().identitas, statusMediator: "H", hakimId: 7, idMediator: [40, 42] },
          }),
          pesan: "",
        },
      })
    );
    render(<RekapPetugas peran="mediator" id="40" />);
    await screen.findByRole("heading", { name: "Hakim Tujuh, S.H." });
    expect(screen.getAllByText("Mediator Hakim").length).toBeGreaterThan(0);
    // Penyatuan lewat hakim_id disebutkan, beserta id-nya.
    expect(screen.getByText(/mediator_id 40, 42/)).toBeTruthy();
    // Tautan ke rekap hakimnya lewat hakim_id, bukan nama.
    const keHakim = screen.getByRole("link", { name: "Rekap sebagai hakim" });
    const url = new URL(keHakim.getAttribute("href")!, "http://portal.contoh");
    expect([url.searchParams.get("peran"), url.searchParams.get("id")]).toEqual(["hakim", "7"]);
    cleanup();

    pasangFetch(() =>
      jawabanJson({
        ok: true,
        data: {
          available: true,
          rekap: rekapUji({ peran: "mediator", identitas: { ...rekapUji().identitas, statusMediator: "N", idMediator: [41] } }),
          pesan: "",
        },
      })
    );
    render(<RekapPetugas peran="mediator" id="41" />);
    await screen.findByRole("heading", { name: "Hakim Tujuh, S.H." });
    expect(screen.getAllByText("Mediator Non Hakim").length).toBeGreaterThan(0);
  });

  it("nomor perkara membuka Status Perkara di tab baru", async () => {
    pasangFetch(() => jawabanJson({ ok: true, data: { available: true, rekap: rekapUji(), pesan: "" } }));
    render(<RekapPetugas peran="hakim" id="7" />);
    const a = await screen.findByRole("link", { name: /101\/Pdt\.G\/2025\/PA\.Ctt/ });
    const url = new URL(a.getAttribute("href")!, "http://portal.contoh");
    expect(url.pathname).toMatch(/\/aleta-ecourt$/);
    expect(url.searchParams.get("perkara")).toBe("101/Pdt.G/2025/PA.Ctt");
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")?.split(/\s+/)).toContain("noopener");
    // Perkara yang masih proses lewat lima bulan: "berjalan 151 hari".
    expect(screen.getByText("berjalan 151 hari")).toBeTruthy();
  });
});

describe("saringan dan halaman daftar", () => {
  it("tiap saringan mengirim parameternya, lalu Hapus saringan mengosongkannya", async () => {
    const ambil = pasangFetch(() => jawabanJson({ ok: true, data: { available: true, rekap: rekapUji(), pesan: "" } }));
    render(<RekapPetugas peran="hakim" id="7" />);
    await screen.findByRole("heading", { name: "Hakim Tujuh, S.H." });

    fireEvent.change(screen.getByLabelText("Saring tahun daftar"), { target: { value: "2025" } });
    await waitFor(() => expect(ambil).toHaveBeenCalledTimes(2));
    expect(kueriKe(ambil, 1).get("tahun")).toBe("2025");

    fireEvent.change(screen.getByLabelText("Saring keadaan perkara"), { target: { value: "proses" } });
    await waitFor(() => expect(ambil).toHaveBeenCalledTimes(3));
    expect(kueriKe(ambil, 2).get("keadaan")).toBe("proses");
    expect(kueriKe(ambil, 2).get("tahun")).toBe("2025");

    fireEvent.change(screen.getByLabelText("Saring kedudukan"), { target: { value: "mediator" } });
    await waitFor(() => expect(ambil).toHaveBeenCalledTimes(4));
    expect(kueriKe(ambil, 3).get("kedudukan")).toBe("mediator");

    fireEvent.click(screen.getByRole("button", { name: "Hapus saringan" }));
    await waitFor(() => expect(ambil).toHaveBeenCalledTimes(5));
    const akhir = kueriKe(ambil, 4);
    expect([akhir.get("tahun"), akhir.get("keadaan"), akhir.get("kedudukan")]).toEqual([null, null, null]);
  });

  it("muat lagi meminta halaman berikutnya dan MENAMBAHKAN barisnya", async () => {
    const ambil = pasangFetch((url) => {
      const lewati = Number(url.searchParams.get("lewati") || 0);
      const rekap = rekapUji();
      if (lewati > 0) rekap.daftar = { ...rekap.daftar, baris: [baris("201")], lewati, adaLagi: false };
      return jawabanJson({ ok: true, data: { available: true, rekap, pesan: "" } });
    });
    render(<RekapPetugas peran="hakim" id="7" />);
    await screen.findByRole("link", { name: /101\/Pdt\.G/ });
    fireEvent.click(screen.getByRole("button", { name: /Muat 100 lagi/ }));
    await screen.findByRole("link", { name: /201\/Pdt\.G/ });
    expect(kueriKe(ambil, 1).get("lewati")).toBe("2");
    // Baris halaman pertama tetap ada.
    expect(screen.getByRole("link", { name: /101\/Pdt\.G/ })).toBeTruthy();
    expect(screen.getByText("Menampilkan 3 dari 150 perkara.")).toBeTruthy();
  });
});

describe("kegagalan tidak digambar sebagai nol", () => {
  it("bacaan perkara gagal: tanpa kartu angka, dengan kalimat sebabnya", async () => {
    pasangFetch(() =>
      jawabanJson({
        ok: true,
        data: {
          available: true,
          rekap: rekapUji({
            perkaraTerbaca: false,
            ringkas: ringkas({ jumlah: 0 }),
            takTerbaca: [{ bagian: "perkara", sebab: "Query execution was interrupted" }],
          }),
          pesan: "",
        },
      })
    );
    render(<RekapPetugas peran="hakim" id="7" />);
    await screen.findByRole("heading", { name: "Hakim Tujuh, S.H." });
    expect(screen.queryByText("Perkara ditangani")).toBeNull();
    expect(screen.getByText(/tidak dapat dibaca dari SIPP/)).toBeTruthy();
    expect(screen.getByText(/perkara: Query execution was interrupted/)).toBeTruthy();
  });

  it("ditolak rute (403): kalimat penolakannya yang tampil", async () => {
    pasangFetch(() =>
      jawabanJson({ ok: false, error: { message: "Peran Anda tidak diberi akses panel. Hubungi administrator ALETA." } }, 403)
    );
    render(<RekapPetugas peran="hakim" id="7" />);
    expect(await screen.findByText(/tidak diberi akses panel/)).toBeTruthy();
  });

  it("bot tidak menemukan orangnya: kalimat bot yang tampil", async () => {
    pasangFetch(() =>
      jawabanJson({ ok: true, data: { available: false, rekap: null, pesan: "Tidak ada hakim dengan ID SIPP 999." } })
    );
    render(<RekapPetugas peran="hakim" id="999" />);
    expect(await screen.findByText("Tidak ada hakim dengan ID SIPP 999.")).toBeTruthy();
  });
});
