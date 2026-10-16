/**
 * Butir 3 dan 14 (5 Okt 2026):
 *   3  - pesan BERHASIL hilang sendiri (4 detik), pesan GAGAL menetap + tombol x;
 *   14 - gangguan jaringan ("Failed to fetch", 502/503/504, jawaban bukan JSON)
 *        dicoba lagi otomatis dengan jeda 2/4/8/15/30 dtk, satu percobaan pada
 *        satu waktu, segera saat tab terlihat / jaringan online, dan data yang
 *        sudah tampil TIDAK dikosongkan.
 * Perilaku diuji: kait dijalankan (renderHook), layar Jadwal Mediasi dirender
 * dengan fetch tiruan.
 */
import { createElement } from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GalatJawaban,
  bacaJsonAman,
  botTakTerjangkau,
  gangguanJaringan,
  jedaCobaLagi,
  useCobaLagiOtomatis,
} from "@/lib/coba-lagi-otomatis";
import { LAMA_PESAN_BERHASIL_MS, usePesanSementara } from "@/lib/pesan-sementara";
import { AletaEcourtMediasi } from "@/components/portal/aleta-ecourt-mediasi";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function setelTerlihat(nilai: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => nilai });
}

describe("mengenali gangguan jaringan", () => {
  it("jeda 2, 4, 8, 15, lalu tiap 30 detik", () => {
    expect([1, 2, 3, 4, 5, 6, 9].map(jedaCobaLagi)).toEqual([2000, 4000, 8000, 15000, 30000, 30000, 30000]);
  });

  it("Failed to fetch / NetworkError / 502-504 = gangguan; galat biasa bukan", () => {
    expect(gangguanJaringan(new TypeError("Failed to fetch"))).toBe(true);
    expect(gangguanJaringan(new TypeError("NetworkError when attempting to fetch resource."))).toBe(true);
    expect(gangguanJaringan(new Error("x"), 502)).toBe(true);
    expect(gangguanJaringan(new Error("x"), 504)).toBe(true);
    expect(gangguanJaringan(new Error("Perkara tidak ditemukan di SIPP."))).toBe(false);
    expect(gangguanJaringan(new Error("x"), 400)).toBe(false);
  });

  it("bacaJsonAman memeriksa status SEBELUM json(): 502 dan halaman HTML = gangguan, JSON galat biasa dipulangkan", async () => {
    await expect(bacaJsonAman(new Response("<html>Bad Gateway</html>", { status: 502 }))).rejects.toMatchObject({
      gangguan: true,
      status: 502,
    });
    await expect(bacaJsonAman(new Response("<!doctype html><title>proksi</title>", { status: 200 }))).rejects.toBeInstanceOf(
      GalatJawaban
    );
    await expect(bacaJsonAman(new Response(JSON.stringify({ message: "salah isian" }), { status: 400 }))).resolves.toEqual({
      message: "salah isian",
    });
    // 504 BERPESAN JSON dari rute portal sendiri = jawaban, bukan jaringan putus.
    await expect(
      bacaJsonAman(new Response(JSON.stringify({ error: "Pencarian dihentikan karena melewati batas 15 detik" }), { status: 504 }))
    ).resolves.toMatchObject({ error: expect.stringContaining("dihentikan") });
  });

  it("available:false hanya dicoba lagi bila bot memang tak terjangkau", () => {
    expect(botTakTerjangkau("ALETA Bot belum dapat dihubungi.")).toBe(true);
    expect(botTakTerjangkau("aleta_bot tidak dapat dihubungi (koneksi ditolak). Pastikan layanan aleta_bot berjalan.")).toBe(true);
    expect(botTakTerjangkau("fetch failed")).toBe(true);
    expect(botTakTerjangkau("Pencarian dihentikan karena melewati batas 15 detik untuk membaca SIPP.")).toBe(false);
    expect(botTakTerjangkau("Table 'sipp.perkara_pk' doesn't exist")).toBe(false);
  });
});

describe("useCobaLagiOtomatis", () => {
  it("menjadwalkan, menghitung mundur, mencoba lagi dengan jeda memanjang, lalu pulih", async () => {
    vi.useFakeTimers();
    setelTerlihat("visible");
    let gagalTerus = true;
    const coba = vi.fn();
    const { result } = renderHook(() => {
      const k = useCobaLagiOtomatis(() => {
        coba();
        if (gagalTerus) k.laporGagal(new TypeError("Failed to fetch"));
        else k.laporBerhasil();
      });
      return k;
    });

    let dijadwalkan = false;
    act(() => {
      dijadwalkan = result.current.laporGagal(new TypeError("Failed to fetch"));
    });
    expect(dijadwalkan).toBe(true);
    expect(result.current.keadaan).toMatchObject({ gangguan: true, sisaDetik: 2, gagalBeruntun: 1 });
    expect(result.current.keadaan.pesan).toMatch(/terputus|server ALETA/i);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.keadaan.sisaDetik).toBe(1);
    expect(coba).toHaveBeenCalledTimes(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(coba).toHaveBeenCalledTimes(1);
    expect(result.current.keadaan).toMatchObject({ gangguan: true, gagalBeruntun: 2, sisaDetik: 4 });

    // Jeda kedua 4 detik: belum dicoba pada detik ke-3.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(coba).toHaveBeenCalledTimes(1);
    gagalTerus = false;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(coba).toHaveBeenCalledTimes(2);
    expect(result.current.keadaan.gangguan).toBe(false);

    // Tanpa gangguan tidak ada lagi percobaan.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(coba).toHaveBeenCalledTimes(2);
  });

  it("satu percobaan pada satu waktu; tab tersembunyi menunda; terlihat lagi / online mencoba seketika", async () => {
    vi.useFakeTimers();
    setelTerlihat("visible");
    const kendali = { selesaikan: () => {} };
    const coba = vi.fn(
      () =>
        new Promise<void>((r) => {
          kendali.selesaikan = r;
        })
    );
    const selesaikan = () => kendali.selesaikan();
    const { result } = renderHook(() => useCobaLagiOtomatis(coba));

    act(() => {
      result.current.laporGagal(new TypeError("Failed to fetch"));
    });
    await act(async () => {
      result.current.cobaSekarang();
      result.current.cobaSekarang();
      await Promise.resolve();
    });
    expect(coba).toHaveBeenCalledTimes(1);
    await act(async () => {
      selesaikan();
      await Promise.resolve();
    });

    // Gagal lagi, tab disembunyikan: jatuh tempo lewat tanpa percobaan.
    act(() => {
      result.current.laporGagal(new TypeError("Failed to fetch"));
    });
    setelTerlihat("hidden");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(coba).toHaveBeenCalledTimes(1);
    expect(result.current.keadaan.sisaDetik).toBeNull();

    setelTerlihat("visible");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });
    expect(coba).toHaveBeenCalledTimes(2);
    await act(async () => {
      selesaikan();
      await Promise.resolve();
    });

    act(() => {
      result.current.laporGagal(new TypeError("Failed to fetch"));
    });
    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
    });
    expect(coba).toHaveBeenCalledTimes(3);
  });

  it("galat biasa tidak dicoba lagi dan tidak menyalakan banner", () => {
    const { result } = renderHook(() => useCobaLagiOtomatis(() => undefined));
    let dijadwalkan = true;
    act(() => {
      dijadwalkan = result.current.laporGagal(new Error("Perkara tidak ditemukan di SIPP."));
    });
    expect(dijadwalkan).toBe(false);
    expect(result.current.keadaan.gangguan).toBe(false);
  });
});

describe("usePesanSementara", () => {
  it("yang berhasil hilang sesudah 4 detik; yang gagal menetap", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePesanSementara());
    act(() => result.current[1]({ ok: true, teks: "3 perkara didaftarkan ke antrian." }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LAMA_PESAN_BERHASIL_MS - 1);
    });
    expect(result.current[0]?.teks).toBe("3 perkara didaftarkan ke antrian.");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current[0]).toBeNull();

    act(() => result.current[1]({ ok: false, teks: "Tanda selesai belum tersimpan." }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(result.current[0]?.teks).toBe("Tanda selesai belum tersimpan.");
  });
});

// ============================================================================
// TOMBOL SKORS JADWAL SIDANG - DIRENDER
// ============================================================================

describe("Jadwal Sidang: pesan tombol Skors", () => {
  const HARI = "2026-10-05";
  const props = {
    baris: { perkaraId: "12", nomorPerkara: "12/Pdt.G/2026/PA.Dgl", tanggalSidang: HARI },
    aksi: { skors: true, lompat: false, lanjut: false, asal: null },
    berjalan: { kunci: `${HARI}|12`, perkaraId: "12", tanggalSidang: HARI, ruang: "Ruang 1", sejak: `${HARI} 09:40:00`, nomorAntrian: 2 },
    skors: null,
    bisaDipanggil: true,
    info: () => ({ nomorPerkara: "12/Pdt.G/2026/PA.Dgl", nomorAntrian: 2, noRuang: 1 }),
    onBerubah: () => undefined,
  };

  it("berhasil: pesannya hilang sendiri", async () => {
    const { TombolRuangSidang } = await import("@/components/portal/jadwal-sidang-2okt");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: { available: true, ok: true } }))));
    const { container } = render(createElement(TombolRuangSidang, props));
    const awal = container.textContent ?? "";
    fireEvent.click(screen.getByRole("button", { name: /Skors/ }));
    // F3.1: Skors membuka jendela alasan; "Skors sekarang" yang mengirim.
    fireEvent.click(screen.getByRole("button", { name: /Skors sekarang/ }));
    await waitFor(() => expect((container.textContent ?? "").length).toBeGreaterThan(awal.length));
    await waitFor(() => expect(container.querySelector(".text-emerald-700")).not.toBeNull());
    await waitFor(() => expect(container.querySelector(".text-emerald-700")).toBeNull(), { timeout: LAMA_PESAN_BERHASIL_MS + 3000 });
  });

  it("gagal: pesannya menetap dan dapat ditutup", async () => {
    const { TombolRuangSidang } = await import("@/components/portal/jadwal-sidang-2okt");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ data: { available: true, ok: false, alasan: "sudah_ditandai_selesai" } })))
    );
    const { container } = render(createElement(TombolRuangSidang, props));
    fireEvent.click(screen.getByRole("button", { name: /Skors/ }));
    fireEvent.click(screen.getByRole("button", { name: /Skors sekarang/ }));
    await waitFor(() => expect(container.querySelector(".text-rose-600")).not.toBeNull());
    await new Promise((r) => setTimeout(r, LAMA_PESAN_BERHASIL_MS + 500));
    expect(container.querySelector(".text-rose-600")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tutup pesan" }));
    expect(container.querySelector(".text-rose-600")).toBeNull();
  });
});

// ============================================================================
// LAYAR JADWAL MEDIASI - DIRENDER
// ============================================================================

function baris(nomorPerkara: string) {
  return {
    mediasiId: "1",
    perkaraId: "609",
    nomorPerkara,
    jenisPerkara: "Cerai Gugat",
    tanggal: "2026-10-05",
    jam: "09:00",
    sampaiJam: "",
    tempat: "Ruang Mediasi",
    dihadiri: "",
    ditunda: false,
    mediator: "Contoh, S.H.",
    statusMediator: "H",
    jenisMediasi: "",
    nomorSk: "",
    penetapanMediator: "2026-10-01",
    laporanMediator: "",
    selesai: false,
    hasil: "",
    hasilTeks: "",
    lamaHari: 4,
    tenggatPerma: "2026-10-31",
    sisaHariTenggat: 26,
    lewatTenggang: false,
    pihak: { penggugat: ["Penggugat Contoh"], tergugat: ["Tergugat Contoh"] },
  };
}

describe("Jadwal Mediasi: gangguan jaringan", () => {
  it("data yang sudah tampil TIDAK dikosongkan; banner menghitung mundur lalu memuat lagi sendiri", async () => {
    setelTerlihat("visible");
    // Hanya permintaan jadwal-mediasi yang dihitung: sejak butir 35 halaman ini
    // juga membaca status mediasi (mediasi-status) - permintaan lain dijawab kosong.
    let panggilan = 0;
    const ambil = vi.fn(async (alamat: unknown) => {
      if (!String(alamat).includes("jadwal-mediasi")) {
        return new Response(JSON.stringify({ data: { available: true, status: {} } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      panggilan += 1;
      if (panggilan === 2) throw new TypeError("Failed to fetch");
      return new Response(JSON.stringify({ data: { available: true, mediasi: [baris(`609/Pdt.G/2026/PA.Dgl`)] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const jadwal = () => ambil.mock.calls.filter((c) => String(c[0]).includes("jadwal-mediasi")).length;
    vi.stubGlobal("fetch", ambil);
    render(createElement(AletaEcourtMediasi));
    await waitFor(() => expect(screen.getAllByText("609/Pdt.G/2026/PA.Dgl").length).toBeGreaterThan(0), { timeout: 10000 });

    // Muat ulang (Tampilkan) gagal karena jaringan.
    fireEvent.click(screen.getByRole("button", { name: "Tampilkan" }));
    await waitFor(() => expect(screen.getByText(/Mencoba lagi dalam \d+ dtk/)).toBeTruthy(), { timeout: 10000 });
    expect(screen.queryByText("Failed to fetch")).toBeNull();
    // Baris lama tetap ada.
    expect(screen.getAllByText("609/Pdt.G/2026/PA.Dgl").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Coba sekarang/ })).toBeTruthy();

    // Dicoba lagi sendiri (sekitar 2 detik) dan banner hilang.
    await waitFor(() => expect(jadwal()).toBe(3), { timeout: 8000 });
    await waitFor(() => expect(screen.queryByText(/Mencoba lagi dalam/)).toBeNull(), { timeout: 8000 });
  });
});
