import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IsianKelasB } from "@/components/portal/isian-kelas-b";

/**
 * Layar isian Kelas B.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Layar ini adalah satu-satunya tempat fakta perkara masuk ke naskah yang
 * ditandatangani. Karena itu yang diuji bukan "tampil dengan rapi", melainkan:
 *
 *   - nilai yang SUDAH tersimpan muncul kembali di kotaknya. Kotak yang kosong
 *     padahal isinya sudah pernah diketik akan membuat panitera mengetik ulang,
 *     dan ketikan kedua atas fakta yang sama pasti berselisih dengan yang
 *     pertama;
 *   - penolakan server DITAMPILKAN, bukan ditelan. Isian Kelas A yang ditolak
 *     tetapi tampak berhasil membuat panitera menyangka nilainya tersimpan;
 *   - blangko tanpa Kelas B mengatakan begitu, bukan menampilkan layar kosong
 *     yang tidak dapat dibedakan dari gagal memuat.
 */

const ambilan = vi.fn();

beforeEach(() => {
  ambilan.mockReset();
  vi.stubGlobal("fetch", ambilan);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jawaban(isi: unknown) {
  return Promise.resolve({ ok: true, json: async () => isi } as unknown as Response);
}

const KELOMPOK_PERNIKAHAN = {
  kode: "pernikahan",
  nama: "Keterangan pernikahan (isbat nikah)",
  urutan: 1,
  jumlahTerisi: 1,
  butir: [
    {
      noVar: "1001",
      nama: "Mas kawin",
      kelompok: "pernikahan",
      nilai: "seperangkat alat shalat dibayar tunai",
      diisiOleh: "panitera",
      diisiAt: "2026-09-07T02:00:00.000Z",
      jumlahPakai: 221,
    },
    {
      noVar: "0650",
      nama: "Saksi Nikah 1",
      kelompok: "pernikahan",
      nilai: "",
      diisiOleh: "",
      diisiAt: "",
      jumlahPakai: 220,
    },
  ],
};

function pasangMuat(kelompok: unknown[], ringkas?: Record<string, unknown>) {
  ambilan.mockImplementation((alamat: string, opsi?: RequestInit) => {
    if (opsi?.method === "POST") return jawaban({ ok: true, jumlahDisimpan: 1, ditolak: [], sebab: "" });
    if (String(alamat).includes("riwayat=1")) return jawaban({ riwayat: [] });
    return jawaban({
      ada: kelompok.length > 0,
      kelompok,
      ringkas: ringkas ?? {
        jumlah: 2,
        terisi: 1,
        kosong: 1,
        kalimat: "1 dari 2 isian sudah terisi; 1 lagi menunggu.",
      },
      sebab: kelompok.length > 0 ? "" : "Belum ada variabel Kelas B di kamus.",
    });
  });
}

describe("nilai yang sudah tersimpan muncul kembali", () => {
  it("kotak terisi dengan nilai dari server, bukan kosong", async () => {
    pasangMuat([KELOMPOK_PERNIKAHAN]);
    render(<IsianKelasB perkaraId="10096" semua olehNama="panitera" />);

    const kotak = await screen.findByLabelText("Mas kawin");
    expect((kotak as HTMLTextAreaElement).value).toBe("seperangkat alat shalat dibayar tunai");
  });

  it("yang belum diisi tetap kosong dan bertanda \"Belum diisi\"", async () => {
    pasangMuat([KELOMPOK_PERNIKAHAN]);
    render(<IsianKelasB perkaraId="10096" semua />);

    const kotak = await screen.findByLabelText("Saksi Nikah 1");
    expect((kotak as HTMLTextAreaElement).value).toBe("");
    expect(kotak).toHaveAttribute("placeholder", "Belum diisi");
  });

  it("nama kelompok dan kemajuannya terlihat", async () => {
    pasangMuat([KELOMPOK_PERNIKAHAN]);
    render(<IsianKelasB perkaraId="10096" semua />);

    expect(await screen.findByText("Keterangan pernikahan (isbat nikah)")).toBeInTheDocument();
    expect(screen.getByText("1 dari 2 terisi")).toBeInTheDocument();
    expect(screen.getByText(/1 lagi menunggu/)).toBeInTheDocument();
  });

  it("siapa yang mengisi terakhir disebutkan", async () => {
    // Nilai tanpa penulisnya tidak dapat dipertanggungjawabkan pada hari ia
    // dipersoalkan.
    pasangMuat([KELOMPOK_PERNIKAHAN]);
    render(<IsianKelasB perkaraId="10096" semua />);
    expect(await screen.findByText(/terakhir diisi panitera/)).toBeInTheDocument();
  });
});

describe("penolakan server ditampilkan, tidak ditelan", () => {
  it("isian Kelas A yang ditolak disebutkan beserta sebabnya", async () => {
    ambilan.mockImplementation((alamat: string, opsi?: RequestInit) => {
      if (opsi?.method === "POST") {
        return jawaban({
          ok: true,
          jumlahDisimpan: 0,
          ditolak: [{ noVar: "0098", sebab: "Kelas A - nilainya berasal dari sistem, tidak boleh diisi tangan." }],
          sebab: "",
        });
      }
      return jawaban({
        ada: true,
        kelompok: [KELOMPOK_PERNIKAHAN],
        ringkas: { jumlah: 2, terisi: 1, kosong: 1, kalimat: "1 dari 2 isian sudah terisi; 1 lagi menunggu." },
      });
    });

    render(<IsianKelasB perkaraId="10096" semua olehNama="panitera" />);
    fireEvent.click(await screen.findByRole("button", { name: /Simpan isian/i }));

    await waitFor(() => {
      expect(screen.getByText(/1 ditolak/)).toBeInTheDocument();
    });
    expect(screen.getByText(/tidak boleh diisi tangan/)).toBeInTheDocument();
  });

  it("penyimpanan yang gagal seluruhnya menyebutkan sebabnya", async () => {
    ambilan.mockImplementation((alamat: string, opsi?: RequestInit) => {
      if (opsi?.method === "POST") {
        return jawaban({ ok: false, jumlahDisimpan: 0, ditolak: [], sebab: "Isian harus menyebut siapa yang mengisinya." });
      }
      return jawaban({
        ada: true,
        kelompok: [KELOMPOK_PERNIKAHAN],
        ringkas: { jumlah: 2, terisi: 1, kosong: 1, kalimat: "" },
      });
    });

    render(<IsianKelasB perkaraId="10096" semua />);
    fireEvent.click(await screen.findByRole("button", { name: /Simpan isian/i }));

    await waitFor(() => {
      expect(screen.getByText(/siapa yang mengisinya/)).toBeInTheDocument();
    });
  });

  it("tidak ada yang berubah dikatakan apa adanya", async () => {
    ambilan.mockImplementation((alamat: string, opsi?: RequestInit) => {
      if (opsi?.method === "POST") return jawaban({ ok: true, jumlahDisimpan: 0, ditolak: [], sebab: "" });
      return jawaban({
        ada: true,
        kelompok: [KELOMPOK_PERNIKAHAN],
        ringkas: { jumlah: 2, terisi: 1, kosong: 1, kalimat: "" },
      });
    });

    render(<IsianKelasB perkaraId="10096" semua olehNama="panitera" />);
    fireEvent.click(await screen.findByRole("button", { name: /Simpan isian/i }));

    await waitFor(() => {
      expect(screen.getByText("Tidak ada yang berubah.")).toBeInTheDocument();
    });
  });
});

describe("keadaan kosong dibedakan dari gagal", () => {
  it("blangko tanpa Kelas B mengatakan begitu, bukan layar kosong", async () => {
    pasangMuat([]);
    render(<IsianKelasB perkaraId="10096" semua />);

    // Sebab dari server yang menang - ia lebih tahu mengapa kosong.
    expect(await screen.findByText(/Belum ada variabel Kelas B di kamus/)).toBeInTheDocument();
  });

  it("tanpa perkara, jembatan tidak dipanggil sama sekali", async () => {
    pasangMuat([KELOMPOK_PERNIKAHAN]);
    render(<IsianKelasB perkaraId="" semua />);

    await waitFor(() => {
      expect(screen.getByText(/tidak menuntut satu pun isian tangan/)).toBeInTheDocument();
    });
    expect(ambilan).not.toHaveBeenCalled();
  });

  it("tanpa penanda dan tanpa mode semua, tidak memanggil apa pun", async () => {
    pasangMuat([KELOMPOK_PERNIKAHAN]);
    render(<IsianKelasB perkaraId="10096" penanda={[]} />);

    await waitFor(() => {
      expect(screen.getByText(/tidak menuntut satu pun isian tangan/)).toBeInTheDocument();
    });
    expect(ambilan).not.toHaveBeenCalled();
  });
});

describe("alamat yang diminta", () => {
  it("mode semua meminta seluruh Kelas B", async () => {
    pasangMuat([KELOMPOK_PERNIKAHAN]);
    render(<IsianKelasB perkaraId="10096" semua />);

    await screen.findByLabelText("Mas kawin");
    expect(String(ambilan.mock.calls[0][0])).toContain("semua=1");
  });

  it("dengan penanda blangko, hanya penanda itu yang diminta", async () => {
    pasangMuat([KELOMPOK_PERNIKAHAN]);
    render(<IsianKelasB perkaraId="10096" penanda={["1001", "0650"]} />);

    await screen.findByLabelText("Mas kawin");
    const alamat = String(ambilan.mock.calls[0][0]);
    expect(alamat).toContain("penanda=1001%2C0650");
    expect(alamat).not.toContain("semua=1");
  });
});
