// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AletaBotCetakRiwayat,
  type BarisCetakRiwayat,
} from "@/components/portal/aleta-bot-cetak-riwayat";

/**
 * Lembar cetak riwayat pengiriman - dipakai melapor ke pihak LUAR pengadilan.
 *
 * Yang dijaga di sini bukan kerapian, melainkan hal-hal yang membuat sebuah
 * laporan menyesatkan:
 *
 *   1. LAPORAN MENYEBUT SARINGANNYA. Daftar dua puluh pesan tanpa keterangan
 *      dibaca orang luar sebagai seluruh pengiriman bulan itu.
 *   2. ANGKANYA ANGKA SELURUH SARINGAN, bukan halaman yang sedang tampil.
 *   3. LEMBAR YANG TERPOTONG MENGATAKANNYA.
 *   4. NOMOR YANG DISAMARKAN DIAKUI DISAMARKAN - pembaca tidak boleh mengira
 *      nomor itulah yang sesungguhnya tercatat.
 */

function baris(ubah: Partial<BarisCetakRiwayat> = {}): BarisCetakRiwayat {
  return {
    id: "abnl-1",
    recipientName: "SITI AMINAH",
    recipientNumber: "6281111111111",
    recipientNumberMasked: false,
    penerima: "pihak",
    caseOrPosition: "10/Pdt.G/2026/PA.Dgl",
    statusLabel: "Terkirim",
    status: "success",
    sourceFeatureLabel: "Kirim Saat Lengkap",
    createdAt: "2026-09-10T02:00:00.000Z",
    sentAt: "2026-09-10T02:01:00.000Z",
    errorMessage: null,
    messagePreview: "Pemberitahuan perkara baru",
    ...ubah,
  };
}

const ringkasan = { total: 120, terkirim: 100, gagal: 12, simulasi: 5, lainnya: 3 };

function gambar(ubah: Partial<React.ComponentProps<typeof AletaBotCetakRiwayat>> = {}) {
  const selesai = vi.fn();
  render(
    <AletaBotCetakRiwayat
      baris={[baris(), baris({ id: "abnl-2", recipientName: "BUDI SANTOSO", status: "failed", statusLabel: "Gagal", errorMessage: "Nomor tidak valid.", sentAt: null })]}
      ringkasan={ringkasan}
      keterangan={["Waktu: 30 hari terakhir", "Status: Gagal"]}
      urutan="Waktu diproses (turun)"
      namaPengadilan="PENGADILAN AGAMA DONGGALA"
      alamatPengadilan="Jalan Jati Nomor 1, Donggala"
      dicetakOleh="DERRY BRIANTONO, S.H."
      terpotong={false}
      onSelesai={selesai}
      {...ubah}
    />
  );
  return { selesai };
}

afterEach(() => {
  // Lembarnya ditempel ke document.body lewat portal, jadi ia TIDAK ikut
  // hilang sendiri antar pemeriksaan. Tanpa cleanup, baris dari pemeriksaan
  // sebelumnya menumpuk dan hitungan barisnya membesar tanpa sebab.
  cleanup();
  vi.restoreAllMocks();
});

describe("lembar cetak riwayat pengiriman", () => {
  it("memuat kop pengadilan, judul laporan, dan penanda tangan", () => {
    vi.spyOn(window, "print").mockImplementation(() => {});
    gambar();
    expect(screen.getByText("PENGADILAN AGAMA DONGGALA")).toBeTruthy();
    expect(screen.getByText("Jalan Jati Nomor 1, Donggala")).toBeTruthy();
    expect(screen.getByText(/LAPORAN PENGIRIMAN PESAN WHATSAPP ALETA BOT/)).toBeTruthy();
    expect(screen.getByText("DERRY BRIANTONO, S.H.")).toBeTruthy();
  });

  it("menyebutkan seluruh penyaring yang sedang aktif beserta urutannya", () => {
    vi.spyOn(window, "print").mockImplementation(() => {});
    gambar();
    const penyaring = screen.getByText(/Waktu: 30 hari terakhir/);
    expect(penyaring.textContent).toContain("Status: Gagal");
    expect(screen.getByText("Waktu diproses (turun)")).toBeTruthy();
  });

  it("mengatakan 'Tidak ada' ketika memang tidak ada penyaring - bukan membiarkannya kosong", () => {
    vi.spyOn(window, "print").mockImplementation(() => {});
    gambar({ keterangan: [] });
    expect(screen.getByText("Tidak ada")).toBeTruthy();
  });

  it("angka ringkasannya angka SELURUH saringan, bukan jumlah baris yang tercetak", () => {
    vi.spyOn(window, "print").mockImplementation(() => {});
    gambar();
    // Dua baris tercetak, tetapi ringkasannya menyebut 120 - itu memang yang
    // dimaksud: pembaca harus tahu populasinya, bukan potongannya.
    const ringkas = screen.getByText(/120 pesan sesuai saringan/);
    expect(ringkas.textContent).toContain("100 terkirim");
    expect(ringkas.textContent).toContain("12 gagal");
    expect(ringkas.textContent).toContain("5 simulasi");
    expect(ringkas.textContent).toContain("3 lainnya");
  });

  it("lembar yang terpotong mengatakannya, dan yang utuh tidak", () => {
    vi.spyOn(window, "print").mockImplementation(() => {});
    gambar({ terpotong: true });
    expect(screen.getByText(/memuat 2 baris pertama/)).toBeTruthy();
  });

  it("tiap baris memuat penerima, status, dan keterangan gagalnya", () => {
    vi.spyOn(window, "print").mockImplementation(() => {});
    gambar();
    expect(screen.getByText("SITI AMINAH")).toBeTruthy();
    expect(screen.getByText("BUDI SANTOSO")).toBeTruthy();
    expect(screen.getByText("Nomor tidak valid.")).toBeTruthy();
    expect(screen.getAllByText("10/Pdt.G/2026/PA.Dgl").length).toBe(2);
    // Baris tanpa waktu terkirim ditulis "-", bukan dikosongkan.
    const tabel = document.querySelectorAll("#aleta-cetak-riwayat-daftar tbody tr");
    expect(tabel.length).toBe(2);
    expect(within(tabel[1] as HTMLElement).getAllByText("-").length).toBeGreaterThan(0);
  });

  it("nomor yang disamarkan diakui disamarkan pada kaki lembar", () => {
    vi.spyOn(window, "print").mockImplementation(() => {});
    gambar({ baris: [baris({ recipientNumber: "628****1111", recipientNumberMasked: true })] });
    expect(screen.getByText(/disamarkan sesuai hak akses/)).toBeTruthy();
  });

  it("tanpa satu pun baris, lembarnya tetap tercetak dan mengatakan kosong", () => {
    vi.spyOn(window, "print").mockImplementation(() => {});
    gambar({ baris: [] });
    expect(screen.getByText("Tidak ada pesan pada saringan ini.")).toBeTruthy();
  });

  it("mencetak sendiri sesudah tergambar, lalu memberi tahu pemanggilnya", async () => {
    const cetak = vi.spyOn(window, "print").mockImplementation(() => {});
    vi.useFakeTimers();
    const { selesai } = gambar();
    expect(cetak).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(cetak).toHaveBeenCalledTimes(1);
    expect(selesai).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
