import { readFileSync } from "node:fs";
import path from "node:path";

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

/**
 * ============================================================================
 * PEMALSU INI PERNAH MEMALSUKAN BENTUK YANG TIDAK PERNAH ADA
 * ============================================================================
 *
 * Rute /api/aleta-ecourt/isian menjawab lewat ok(), yang membungkus muatannya:
 *
 *     { ok: true, data: { ada: true, kelompok: [...] } }
 *
 * Pemalsu ini dulu memulangkan muatannya TELANJANG, tanpa bungkus. Akibatnya
 * uji di berkas ini hijau atas layar yang di dunia nyata selalu berbunyi
 * "Isian tidak terbaca" - sebab komponennya membaca isi.ada dari bungkusnya,
 * dan di sana tidak ada ada.
 *
 * Inilah yang membuat cacat itu hidup begitu lama: bukan karena tidak ada
 * ujinya, melainkan karena ujinya menguji dunia yang tidak pernah ada. Uji
 * yang memalsukan kontrak yang salah lebih berbahaya daripada tidak ada uji -
 * yang kedua membuat orang berhati-hati, yang pertama membuat orang yakin.
 *
 * Bungkusnya sekarang ikut dipalsukan di sini, satu tempat, dan uji terakhir
 * di berkas ini mengikatnya pada rute yang sesungguhnya.
 */
function jawaban(isi: unknown) {
  return Promise.resolve({
    ok: true,
    json: async () => ({ ok: true, data: isi }),
  } as unknown as Response);
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

/**
 * ============================================================================
 * PEMALSUNYA DIIKAT PADA RUTE YANG SESUNGGUHNYA
 * ============================================================================
 *
 * Pemalsu yang bebas menyimpang adalah pemalsu yang suatu hari menyimpang.
 * Uji ini membaca rutenya sendiri dan memastikan ia memang membungkus - kalau
 * kelak ia berhenti membungkus, yang gagal uji ini, beserta petunjuk bahwa
 * pemalsu di atas yang harus disesuaikan.
 *
 * Tanpa ikatan ini, berkas uji ini dapat kembali hijau atas dunia yang tidak
 * ada, dan tidak ada yang tahu sampai seseorang membuka layarnya.
 */
describe("pemalsu jawaban setia pada bentuk rutenya", () => {
  it("rute isian memang membungkus muatannya", () => {
    const rute = readFileSync(
      path.resolve(process.cwd(), "src/app/api/aleta-ecourt/isian/route.ts"),
      "utf8"
    );

    // Seluruh jalan keluarnya lewat ok(), dan ok() membungkus { ok, data }.
    expect(rute).toContain('import { ok } from "@/server/shared/http"');
    expect(rute).toContain("return ok({ ada: true");

    // Dan tidak ada satu pun jalan keluar yang menjawab tanpa bungkus.
    expect(rute).not.toContain("NextResponse.json({ ada");
    expect(rute).not.toContain("Response.json({ ada");
  });
});
