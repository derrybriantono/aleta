/**
 * Jadwal Sidang, perbaikan 6 Okt 2026 sore:
 *   butir 2  "sedang berjalan" terdeteksi dalam hitungan detik - keadaan
 *            disidang hari ini ditanyakan tiap 5 detik (lib/disidang-langsung,
 *            use-disidang-langsung, bot disidangLangsungService)
 *   butir 3  deretan tombol tindakan (Hitung skor ...) bawaannya terciut
 * (butir 1 - Court Calendar - di jadwal-sidang-6okt.test.ts)
 */
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  bacaDisidangLangsung,
  perluMuatPenuh,
  saringProsesLangsung,
  SELANG_DISIDANG_MS,
  terapkanDisidangLangsung,
  type DisidangLangsung,
} from "@/lib/disidang-langsung";
import { DATA_BERJALAN_KOSONG, petaSidangBerjalan, type DataBerjalan } from "@/lib/jadwal-sidang-2okt";
import { WAKTU_ANTRIAN_KOSONG, type BarisWaktuAntrian, type WaktuAntrian } from "@/lib/tiga-jarak-sidang";
import { ALAT_CIUT_BAWAAN } from "@/lib/alat-jadwal-sidang";
import { useDisidangLangsung } from "@/components/portal/use-disidang-langsung";

const akar = path.resolve(process.cwd(), "..");
const layar = readFileSync(path.resolve(process.cwd(), "src/components/portal/aleta-ecourt-sidang.tsx"), "utf8");

const HARI = "2026-10-06";

function barisWaktu(perkaraId: string, isi: Partial<BarisWaktuAntrian> = {}): BarisWaktuAntrian {
  return {
    tanggalSidang: HARI,
    perkaraId,
    nomorAntrian: Number(perkaraId) % 100,
    noRuang: 1,
    ruanganId: 1,
    majelisKode: "",
    ambilPihak1: `${HARI} 08:00:00`,
    ambilPihak2: "",
    ambilSaksi: "",
    ambilTerawal: `${HARI} 08:00:00`,
    jamJadwal: "09:00",
    panggilPertama: "",
    panggilTerakhir: "",
    jumlahPanggil: 0,
    online: null,
    namaPetugas: "",
    sumber: "langsung",
    disidang: null,
    ...isi,
  } as BarisWaktuAntrian;
}

function waktu(baris: BarisWaktuAntrian[]): WaktuAntrian {
  return { ...WAKTU_ANTRIAN_KOSONG, terbaca: true, hariIni: HARI, sekarang: `${HARI} 10:00:00`, langsungTerbaca: true, baris };
}

function langsung(isi: Array<[string, number | null]>, hariIni = HARI): DisidangLangsung {
  return {
    terbaca: true,
    hariIni,
    sekarang: `${hariIni} 10:00:05`,
    baris: isi.map(([perkaraId, disidang]) => ({ perkaraId, tanggalSidang: hariIni, disidang, ruanganId: 1, jamSidang: "10:00:01" })),
  };
}

// ============================================================================
// Butir 2: keadaan disidang terbaru ditimpakan ke bahan "sedang berjalan"
// ============================================================================

describe("butir 2: keadaan disidang terbaru menggerakkan 'sedang berjalan' tanpa jadwal penuh", () => {
  const lama = waktu([barisWaktu("101"), barisWaktu("102")]);

  it("perkara yang baru di-PROSES (disidang 1) langsung berjalan - jadwal penuhnya masih basi", () => {
    // Tanpa bacaan terbaru: tidak ada yang berjalan.
    expect(Object.keys(petaSidangBerjalan(lama.baris, { hariIni: HARI }).berjalan)).toEqual([]);
    const hidup = terapkanDisidangLangsung(lama, langsung([["101", 1], ["102", null]]));
    const ruang = petaSidangBerjalan(hidup.baris, { hariIni: HARI });
    expect(Object.keys(ruang.berjalan)).toEqual([`${HARI}|101`]);
    expect(ruang.berjalan[`${HARI}|101`].sumber).toBe("antrian-proses");
  });

  it("selesai (10) atau batal/skors (NULL) di mesin membuang 'proses' basi dari bacaan /selesai", () => {
    const basi: DataBerjalan = {
      ...DATA_BERJALAN_KOSONG,
      proses: [{ perkaraId: "101", tanggalSidang: HARI, noRuang: 1, sejak: `${HARI} 09:30:00` }],
    };
    const proses1 = waktu([barisWaktu("101", { disidang: 1 }), barisWaktu("102")]);
    expect(Object.keys(petaSidangBerjalan(proses1.baris, { hariIni: HARI, berjalan: basi }).berjalan)).toEqual([`${HARI}|101`]);

    for (const kini of [10, null]) {
      const l = langsung([["101", kini]]);
      const ruang = petaSidangBerjalan(terapkanDisidangLangsung(proses1, l).baris, {
        hariIni: HARI,
        berjalan: saringProsesLangsung(basi, l),
      });
      expect(ruang.berjalan, `disidang ${kini}`).toEqual({});
    }
  });

  it("obyek yang SAMA bila tidak ada yang berubah (useMemo tidak menghitung ulang tiap tanya)", () => {
    expect(terapkanDisidangLangsung(lama, langsung([["101", null], ["102", null]]))).toBe(lama);
    expect(terapkanDisidangLangsung(lama, langsung([["101", 1]], "2026-10-07"))).toBe(lama);
    expect(terapkanDisidangLangsung(lama, { ...langsung([["101", 1]]), terbaca: false })).toBe(lama);
    const b: DataBerjalan = { ...DATA_BERJALAN_KOSONG, proses: [{ perkaraId: "101", tanggalSidang: HARI, noRuang: 1, sejak: "" }] };
    expect(saringProsesLangsung(b, langsung([["101", 1]]))).toBe(b);
  });

  it("perkara di-PROSES tanpa baris waktu antrian memicu muat penuh - dengan tanda tangan, bukan tiap tanya", () => {
    expect(perluMuatPenuh(lama, langsung([["101", 1]]))).toBe("");
    expect(perluMuatPenuh(lama, langsung([["103", 2]]))).toBe(`${HARI}|103=2`);
    expect(perluMuatPenuh(lama, langsung([["103", null]]))).toBe("");
    expect(perluMuatPenuh(WAKTU_ANTRIAN_KOSONG, langsung([["103", 2]]))).toBe("");
    expect(layar).toContain("kurangBarisDisidang === kurangDimuatRef.current");
  });

  it("jawaban rute dibaca hati-hati: bot tak terjangkau / bentuk asing = tidak terbaca", () => {
    expect(bacaDisidangLangsung({ available: false }).terbaca).toBe(false);
    expect(bacaDisidangLangsung({ terbaca: true }).terbaca).toBe(false);
    const d = bacaDisidangLangsung({ available: true, terbaca: true, hariIni: HARI, baris: [{ perkaraId: 7, disidang: "3" }, { perkaraId: "" }] });
    expect(d.baris).toEqual([{ perkaraId: "7", tanggalSidang: HARI, disidang: 3, ruanganId: null, jamSidang: "" }]);
  });

  it("layar memakai bahan hidup untuk petaSidangBerjalan, dan hanya untuk hari ini", () => {
    expect(layar).toContain("const disidangLangsung = useDisidangLangsung(dari === sampai && dari === hariIni());");
    expect(layar).toContain("return petaSidangBerjalan(waktuAntrianHidup.baris, {");
    expect(layar).not.toContain("return petaSidangBerjalan(waktuAntrian.baris, {");
    expect(layar).toContain("const JEDA_MUAT_ULANG_MS = 45_000;");
  });
});

// ============================================================================
// Butir 2: simulasi latensi - jalur lama (muat ulang 45 dtk) vs bacaan 5 dtk
// ============================================================================

describe("butir 2: simulasi latensi deteksi 'sedang berjalan'", () => {
  let disidangServer: number | null = null;
  let panggilan: string[] = [];
  let tampak: DocumentVisibilityState = "visible";

  beforeEach(() => {
    vi.useFakeTimers();
    disidangServer = null;
    panggilan = [];
    tampak = "visible";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => tampak });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (alamat: string) => {
        panggilan.push(String(alamat));
        // Jawaban bot diukur 4-14 ms (kueri ringan); 50 ms termasuk portal.
        await new Promise((r) => setTimeout(r, 50));
        const isi = {
          data: {
            available: true,
            terbaca: true,
            hariIni: HARI,
            sekarang: `${HARI} 10:00:00`,
            baris: [{ perkaraId: "101", tanggalSidang: HARI, disidang: disidangServer, ruanganId: 1, jamSidang: "" }],
          },
        };
        return { ok: true, status: 200, json: async () => isi } as unknown as Response;
      })
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** Lama sampai hook melihat disidang 1, bila mesin antrian berubah `tunda` ms sesudah layar dibuka. */
  async function ukurBaru(tunda: number): Promise<number> {
    const { result, unmount } = renderHook(() => useDisidangLangsung(true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(tunda);
    });
    disidangServer = 1;
    let lewat = 0;
    while (result.current.baris[0]?.disidang !== 1 && lewat < 120_000) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
      lewat += 50;
    }
    unmount();
    disidangServer = null;
    return lewat;
  }

  /**
   * Jalur LAMA dimodelkan dengan angkanya sendiri: muat ulang jadwal penuh tiap
   * 45 dtk (JEDA_MUAT_ULANG_MS, dijaga di atas), jadwal penuh 130-160 ms di bot
   * (diukur 6 Okt 2026), lalu GET /selesai sesudahnya.
   */
  function ukurLama(tunda: number): number {
    const JEDA = 45_000;
    const MUAT_PENUH = 160;
    const SELESAI = 50;
    const putaran = Math.ceil((tunda + 1) / JEDA) * JEDA; // putaran berikut sesudah berubah
    return putaran - tunda + MUAT_PENUH + SELESAI;
  }

  it("deteksi baru paling lama satu selang (5 dtk) + jawaban; lama rata-rata belasan-puluhan detik", async () => {
    const tundaan = [1_000, 4_900, 7_300, 12_900, 22_500, 31_100, 38_000, 44_000];
    const baru: number[] = [];
    for (const t of tundaan) baru.push(await ukurBaru(t));
    const lama = tundaan.map(ukurLama);
    const rata = (x: number[]) => Math.round(x.reduce((a, b) => a + b, 0) / x.length);
    // Dicetak untuk laporan.
    console.info(
      `[latensi berjalan] lama rata ${rata(lama)} ms, maks ${Math.max(...lama)} ms | baru rata ${rata(baru)} ms, maks ${Math.max(...baru)} ms`
    );
    expect(Math.max(...baru)).toBeLessThanOrEqual(SELANG_DISIDANG_MS + 200);
    expect(rata(baru)).toBeLessThan(rata(lama) / 4);
  });

  it("satu kueri per selang saja, berhenti saat tab tersembunyi, langsung bertanya saat terlihat lagi", async () => {
    const { unmount } = renderHook(() => useDisidangLangsung(true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    // Saat pasang + tiap 5 dtk selama 30 dtk = 7.
    expect(panggilan.length).toBe(7);
    expect(panggilan.every((a) => a.endsWith("/api/aleta-ecourt/sidang/disidang"))).toBe(true);

    tampak = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    const sebelum = panggilan.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(panggilan.length).toBe(sebelum);

    tampak = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(panggilan.length).toBe(sebelum + 1);
    unmount();
  });

  it("bukan hari ini: tidak bertanya sama sekali", async () => {
    const { result, unmount } = renderHook(() => useDisidangLangsung(false));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(panggilan).toEqual([]);
    expect(result.current.terbaca).toBe(false);
    unmount();
  });
});

// ============================================================================
// Butir 2: bot - satu kueri ringan, dibagi seluruh tab
// ============================================================================

describe("butir 2: bot disidangLangsungService", () => {
  const require_ = createRequire(path.join(akar, "aleta_bot/package.json"));
  const svc = require_("./services/disidangLangsungService.js") as {
    JEDA_SIMPAN_MS: number;
    SQL_DISIDANG_HARI_INI: string;
    buatLayanan: (deps: { kueri: (sql: string) => Promise<unknown[]>; kini: () => number }) => {
      disidangHariIni: () => Promise<{ terbaca: boolean; hariIni: string; baris: Array<{ perkaraId: string; disidang: number | null }> }>;
    };
  };

  it("hanya SELECT hari ini, jam basis datanya pada kueri yang sama", () => {
    expect(svc.SQL_DISIDANG_HARI_INI).toMatch(/^\s*SELECT/);
    expect(svc.SQL_DISIDANG_HARI_INI).not.toMatch(/\b(UPDATE|INSERT|DELETE)\b/i);
    expect(svc.SQL_DISIDANG_HARI_INI).toContain("LEFT JOIN sipp_turunan_antrian.antrian_sidang a ON a.tanggal_sidang = CURDATE()");
  });

  it("banyak tab dalam satu jeda = SATU kueri; hari tanpa antrian tetap menyebut hari ininya; galat = tidak terbaca", async () => {
    let jam = 0;
    const kueri = vi.fn(async () => [
      { sekarang: `${HARI} 10:00:00`, hariIni: HARI, perkaraId: 101, tanggalSidang: HARI, disidang: 2, ruanganId: 2, jamSidang: "10:00:00" },
    ]);
    const l = svc.buatLayanan({ kueri, kini: () => jam });
    const [a, b, c] = await Promise.all([l.disidangHariIni(), l.disidangHariIni(), l.disidangHariIni()]);
    expect(kueri).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(c.baris).toEqual([{ perkaraId: "101", tanggalSidang: HARI, disidang: 2, ruanganId: 2, jamSidang: "10:00:00" }]);
    jam += svc.JEDA_SIMPAN_MS;
    await l.disidangHariIni();
    expect(kueri).toHaveBeenCalledTimes(2);

    const kosong = svc.buatLayanan({ kueri: async () => [{ sekarang: `${HARI} 07:00:00`, hariIni: HARI, perkaraId: null }], kini: () => 0 });
    expect(await kosong.disidangHariIni()).toMatchObject({ terbaca: true, hariIni: HARI, baris: [] });

    const rusak = svc.buatLayanan({ kueri: async () => Promise.reject(new Error("ECONNREFUSED")), kini: () => 0 });
    expect(await rusak.disidangHariIni()).toMatchObject({ terbaca: false, baris: [] });
  });

  it("rute bot dan rute portal terpasang", () => {
    const rute = readFileSync(path.join(akar, "aleta_bot/routes/jadwalSidangRoutes.js"), "utf8");
    expect(rute).toContain('router.get("/disidang", wajibToken,');
    const portal = readFileSync(path.resolve(process.cwd(), "src/app/api/aleta-ecourt/sidang/disidang/route.ts"), "utf8");
    expect(portal).toContain('panggilBotJadwalSidang("/disidang"');
    expect(portal).toContain('pastikanKapabilitas(db, actorUserId, "panel")');
  });
});

// ============================================================================
// Butir 3: deretan tombol tindakan bawaannya terciut
// ============================================================================

const keadaan = vi.hoisted(() => ({
  portal: {
    institutionIdentity: { courtName: "PENGADILAN AGAMA DONGGALA" },
    currentUser: { id: "u1", name: "Penguji", roleId: "admin" } as Record<string, unknown> | null,
    positions: [] as unknown[],
  },
}));
vi.mock("@/lib/app-state", () => ({ usePortal: () => keadaan.portal }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...sisa }: { href: string; children: unknown }) => createElement("a", { href, ...sisa }, children as never),
}));

describe("butir 3: deretan Hitung skor dkk. bawaannya terciut", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, data: {} }) }) as unknown as Response)
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("bawaannya terciut, dan tidak ada simpanan yang membukanya", () => {
    expect(ALAT_CIUT_BAWAAN).toBe(true);
    expect(layar).toContain("const [alatCiut, setAlatCiut] = useState(ALAT_CIUT_BAWAAN);");
    expect(layar).not.toMatch(/localStorage[^\n]*alat/i);
  });

  it("layar yang baru dibuka: baris tombol tindakan tersembunyi", async () => {
    const { AletaEcourtSidang } = await import("@/components/portal/aleta-ecourt-sidang");
    const { container } = render(createElement(AletaEcourtSidang));
    await act(async () => {
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
    });
    const ciutkan = container.querySelector('button[title="Sembunyikan tombol tindakan supaya daftar sidang lebih panjang"]');
    expect(ciutkan, "tombol penciut baris tindakan").not.toBeNull();
    // Pembungkus baris tindakan (dua tingkat di atas tombol penciutnya) berkelas hidden.
    const baris = ciutkan?.parentElement?.parentElement as HTMLElement;
    expect(baris.className.split(/\s+/)).toContain("hidden");
    expect(baris.textContent).toContain("Hitung skor");
  }, 60_000);
});
