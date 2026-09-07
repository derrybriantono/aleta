import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BlangkoMandiri } from "@/components/portal/blangko-mandiri";

/**
 * Layar admin kemandirian blangko.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Empat tahap panjang ini masing-masing dapat berada dalam keadaan "belum
 * pernah dijalankan", dan dalam keadaan itu ALETA memang belum berguna. Yang
 * diuji:
 *
 *   - keadaan belum-pernah DIKATAKAN, bukan ditampilkan sebagai angka nol yang
 *     tidak dapat dibedakan dari "sudah dijalankan dan hasilnya nol";
 *   - hasil penyalinan dan pembelajaran dilaporkan dengan ANGKANYA, bukan
 *     sekadar "berhasil" - admin yang menekan tombol berhak tahu apa yang
 *     berubah;
 *   - kegagalan menyebutkan sebabnya, tidak diam.
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

const KAMUS_KOSONG = {
  statistik: { jumlah: 0, perKelas: { A: 0, B: 0, C: 0 }, perJenis: [], penyalinanTerakhir: null },
};

const KAMUS_TERISI = {
  statistik: {
    jumlah: 1253,
    perKelas: { A: 601, B: 162, C: 490 },
    perJenis: [],
    penyalinanTerakhir: {
      keadaan: "selesai",
      sebab: "",
      oleh: "Ketua",
      dijalankanAt: "2026-09-07T02:00:00.000Z",
      asalSkema: "aps_badilag",
    },
  },
};

/** Menjawab seluruh rute dengan keadaan kosong, kecuali yang ditimpa. */
function pasang(timpa: Record<string, unknown> = {}, kirim?: (badan: unknown) => unknown) {
  ambilan.mockImplementation((alamat: string, opsi?: RequestInit) => {
    const jalur = String(alamat);
    if (opsi?.method === "POST") {
      const badan = JSON.parse(String(opsi.body ?? "{}"));
      return jawaban(kirim ? kirim(badan) : { ok: true });
    }
    for (const [kunci, isi] of Object.entries(timpa)) {
      if (jalur.includes(kunci)) return jawaban(isi);
    }
    if (jalur.includes("/kamus")) return jawaban(KAMUS_KOSONG);
    if (jalur.includes("pergeseran=1")) return jawaban({ pergeseran: [] });
    if (jalur.includes("/korpus")) {
      return jawaban({
        statistik: {
          jumlahBerkas: 0,
          jumlahBlok: 0,
          jumlahGeser: 0,
          geserBelumDiputus: 0,
          perJenis: [],
          selMatriks: 0,
          pembelajaranTerakhir: null,
        },
      });
    }
    if (jalur.includes("kelasC=1")) return jawaban({ ringkas: { jumlahMati: 0, matiDanTerpakai: 0 }, temuan: [] });
    if (jalur.includes("saklar=")) return jawaban({ menyala: false });
    return jawaban({ blangko: [] });
  });
}

describe("keadaan belum pernah dijalankan dikatakan", () => {
  it("kamus yang belum disalin mengatakannya, bukan menampilkan nol", async () => {
    pasang();
    render(<BlangkoMandiri />);

    expect(await screen.findByText(/Kamus belum pernah disalin/)).toBeInTheDocument();
    // Tombolnya pun berbunyi lain - "salin" bukan "salin ulang".
    expect(screen.getByRole("button", { name: /Salin kamus dari ABT/i })).toBeInTheDocument();
  });

  it("kamus yang sudah terisi menampilkan pembagian kelasnya", async () => {
    pasang({ "/kamus": KAMUS_TERISI });
    render(<BlangkoMandiri />);

    expect(await screen.findByText("1253")).toBeInTheDocument();
    expect(screen.getByText("601")).toBeInTheDocument();
    expect(screen.getByText("Kelas B - butuh manusia")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salin ulang/i })).toBeInTheDocument();
    expect(screen.getByText(/Penyalinan terakhir selesai oleh Ketua/)).toBeInTheDocument();
  });
});

describe("hasil dilaporkan dengan angkanya", () => {
  it("penyalinan berhasil menyebut berapa yang tersalin dan pembagiannya", async () => {
    pasang({}, () => ({ ok: true, jumlahBaris: 1253, rekap: { A: 601, B: 162, C: 490 }, sebab: "" }));
    render(<BlangkoMandiri />);

    fireEvent.click(await screen.findByRole("button", { name: /Salin kamus dari ABT/i }));

    await waitFor(() => {
      expect(screen.getByText(/1253 definisi tersalin/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Kelas A 601, B 162, C 490/)).toBeInTheDocument();
  });

  it("penyalinan gagal menyebutkan sebabnya, tidak diam", async () => {
    pasang({}, () => ({ ok: false, jumlahBaris: 0, rekap: {}, sebab: "Basis data APS Badilag tidak ditemukan." }));
    render(<BlangkoMandiri />);

    fireEvent.click(await screen.findByRole("button", { name: /Salin kamus dari ABT/i }));

    await waitFor(() => {
      expect(screen.getByText(/APS Badilag tidak ditemukan/)).toBeInTheDocument();
    });
  });
});

describe("tab korpus", () => {
  it("korpus yang belum dipelajari mengatakannya", async () => {
    pasang();
    render(<BlangkoMandiri />);

    await userEvent.click(await screen.findByRole("tab", { name: "Korpus" }));
    expect(await screen.findByText(/Korpus belum pernah dipelajari/)).toBeInTheDocument();
  });

  it("pembelajaran gagal menyebut berapa blangko yang tidak dapat disusun ulang", async () => {
    // Angka itulah yang memberi tahu admin bahwa korpusnya cacat, bukan
    // sekadar "gagal".
    pasang({}, () => ({
      ok: false,
      jumlahBerkas: 0,
      jumlahBlok: 0,
      jumlahGeser: 0,
      jumlahGagalSusun: 3,
      sebab: "3 blangko tidak dapat disusun kembali tepat kata demi kata - korpus tidak disimpan.",
    }));
    render(<BlangkoMandiri />);

    await userEvent.click(await screen.findByRole("tab", { name: "Korpus" }));
    fireEvent.click(await screen.findByRole("button", { name: /Pelajari seluruh blangko ABT/i }));

    await waitFor(() => {
      expect(screen.getByText(/3 blangko gagal disusun ulang/)).toBeInTheDocument();
    });
  });
});

describe("tab pustaka", () => {
  it("pustaka kosong mengarahkan mulai dari relaas", async () => {
    pasang();
    render(<BlangkoMandiri />);

    await userEvent.click(await screen.findByRole("tab", { name: "Pustaka" }));
    expect(await screen.findByText(/mulailah dari relaas/i)).toBeInTheDocument();
  });

  it("saklar periksa bawaannya mati untuk tiap golongan", async () => {
    pasang();
    render(<BlangkoMandiri />);

    await userEvent.click(await screen.findByRole("tab", { name: "Pustaka" }));
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Langsung pakai/i }).length).toBeGreaterThan(1);
    });
  });

  it("uji kemandirian atas pustaka kosong TIDAK dinyatakan mandiri", async () => {
    // Uji yang lulus karena tidak ada yang diuji adalah uji yang berbohong.
    pasang({}, (badan) => {
      if ((badan as { tindakan?: string }).tindakan === "ujiMandiri") {
        return { mandiri: false, jumlahDiperiksa: 0, temuan: [] };
      }
      return { ok: true };
    });
    render(<BlangkoMandiri />);

    await userEvent.click(await screen.findByRole("tab", { name: "Pustaka" }));
    fireEvent.click(await screen.findByRole("button", { name: /Jalankan uji/i }));

    await waitFor(() => {
      expect(screen.getByText(/tidak ada yang dapat diuji/i)).toBeInTheDocument();
    });
  });
});

describe("tab pembersihan", () => {
  it("tanpa variabel mati yang terpakai, dikatakan tidak perlu dibereskan", async () => {
    pasang();
    render(<BlangkoMandiri />);

    await userEvent.click(await screen.findByRole("tab", { name: "Pembersihan" }));
    expect(await screen.findByText(/tidak menyentuh naskah siapa pun/)).toBeInTheDocument();
  });

  it("variabel mati yang terpakai ditampilkan beserta blangkonya", async () => {
    pasang({
      "kelasC=1": {
        ringkas: { jumlahMati: 490, matiDanTerpakai: 114 },
        temuan: [
          {
            noVar: "7211",
            nama: "Umur Isbat P1 (Laki-Laki)",
            sebab: "Terdaftar di ABT tanpa jenis - tidak dapat diisi siapa pun.",
            jumlahPakai: 60,
            blangko: ["putusan_penetapan/[01] [Kabul] IN.rtf"],
          },
        ],
      },
    });
    render(<BlangkoMandiri />);

    await userEvent.click(await screen.findByRole("tab", { name: "Pembersihan" }));
    expect(await screen.findByText(/#7211# — Umur Isbat P1/)).toBeInTheDocument();
    expect(screen.getByText("putusan_penetapan/[01] [Kabul] IN.rtf")).toBeInTheDocument();
    expect(screen.getByText("114")).toBeInTheDocument();
  });
});
