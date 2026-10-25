import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HalamanPemeliharaan, PitaPemeliharaan, type KeadaanPublik } from "@/components/portal/pemeliharaan";

/**
 * Layar dan pita Mode pemeliharaan (E3): perilaku nyata di jsdom dengan
 * pewaktu palsu dan fetch palsu - layar memuat ulang SENDIRI begitu selesai,
 * pita hanya muncul bila memang ada yang perlu dikabarkan.
 */

vi.mock("@/lib/auth-client", () => ({ authClient: { signOut: vi.fn(async () => undefined) } }));

const AKTIF: KeadaanPublik = { aktif: true, sebab: "manual", pesan: "Pasang versi baru.", selesaiPerkiraan: "2026-10-26T03:00:00.000Z", mulaiDijadwalkan: "", menitSampaiMulai: null };
const MATI: KeadaanPublik = { aktif: false, sebab: null, pesan: "", selesaiPerkiraan: "", mulaiDijadwalkan: "", menitSampaiMulai: null };

let jawabanFetch: KeadaanPublik | "gagal";
let muatUlang: ReturnType<typeof vi.fn>;
const lokasiAsli = window.location;

beforeEach(() => {
  vi.useFakeTimers();
  jawabanFetch = AKTIF;
  muatUlang = vi.fn();
  Object.defineProperty(window, "location", { configurable: true, value: { ...lokasiAsli, reload: muatUlang } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      if (jawabanFetch === "gagal") throw new Error("server dimulai ulang");
      return { ok: true, json: async () => ({ ok: true, data: jawabanFetch }) };
    })
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Object.defineProperty(window, "location", { configurable: true, value: lokasiAsli });
});

describe("HalamanPemeliharaan", () => {
  it("menampilkan pesan Super Admin dan perkiraan selesai (WITA)", () => {
    render(<HalamanPemeliharaan awal={AKTIF} />);
    expect(screen.getByText("ALETA sedang dalam pemeliharaan")).toBeTruthy();
    expect(screen.getByText("Pasang versi baru.")).toBeTruthy();
    expect(screen.getByText(/Perkiraan selesai pukul 11\.00 WITA/)).toBeTruthy();
  });

  it("memuat ulang sendiri begitu pemeliharaan selesai; tetap bertahan selama masih aktif atau server belum menjawab", async () => {
    render(<HalamanPemeliharaan awal={AKTIF} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(muatUlang).not.toHaveBeenCalled();

    jawabanFetch = "gagal";
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(muatUlang).not.toHaveBeenCalled();

    jawabanFetch = MATI;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(muatUlang).toHaveBeenCalledTimes(1);
  });
});

describe("PitaPemeliharaan", () => {
  it("tanpa pemeliharaan tidak menggambar apa pun", () => {
    const { container } = render(<PitaPemeliharaan awal={null} dikecualikan={false} />);
    expect(container.innerHTML).toBe("");
    const { container: c2 } = render(<PitaPemeliharaan awal={MATI} dikecualikan />);
    expect(c2.innerHTML).toBe("");
  });

  it("jadwal akan mulai: semua pengguna melihat menit tersisa dan anjuran menyimpan pekerjaan", () => {
    render(<PitaPemeliharaan awal={{ ...MATI, mulaiDijadwalkan: "2026-10-26T01:30:00.000Z", selesaiPerkiraan: "2026-10-26T02:30:00.000Z", menitSampaiMulai: 20 }} dikecualikan={false} />);
    const pita = document.querySelector("[data-pita-pemeliharaan]")!;
    expect(pita.textContent).toMatch(/dimulai pukul 09\.30 WITA \(20 menit lagi\)/);
    expect(pita.textContent).toContain("Simpan pekerjaan Anda");
  });

  it("mode aktif: hanya yang dikecualikan melihat pita (yang lain melihat layar pemeliharaan, bukan pita)", () => {
    const { container } = render(<PitaPemeliharaan awal={AKTIF} dikecualikan={false} />);
    expect(container.innerHTML).toBe("");
    cleanup();
    render(<PitaPemeliharaan awal={AKTIF} dikecualikan />);
    expect(document.querySelector("[data-pita-pemeliharaan]")?.textContent).toContain("Mode pemeliharaan sedang aktif");
  });

  it("menanyakan keadaan tiap 2 menit dan menampilkan jadwal yang baru ditetapkan", async () => {
    render(<PitaPemeliharaan awal={null} dikecualikan={false} />);
    jawabanFetch = { ...MATI, mulaiDijadwalkan: "2026-10-26T01:40:00.000Z", menitSampaiMulai: 40 };
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(document.querySelector("[data-pita-pemeliharaan]")?.textContent).toContain("40 menit lagi");
  });
});
