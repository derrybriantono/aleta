import { act, cleanup, render, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * TABEL JADWAL RINGAN (K13, 25 Okt 2026) - HANYA BARIS YANG BERUBAH DIGAMBAR ULANG
 * ============================================================================
 *
 *   A. saklar: MATI bawaan; menyala lewat localStorage / env;
 *   B. layar sungguhan (AletaEcourtSidang) dua perkara:
 *        - saklar mati: tiap perubahan menggambar ulang SEMUA baris (jalur lama);
 *        - saklar menyala: membuka rincian satu baris atau antrian satu perkara berubah
 *          hanya menggambar ulang baris itu; isi tabel (HTML) SAMA dengan jalur lama
 *          pada tiap langkah;
 *   C. penjaga: setiap peubah komponen yang dibaca baris tercantum di daftar
 *      kebergantungan memo atau alat pemicu (peubah baru yang terlupa = uji merah).
 */

const keadaan = vi.hoisted(() => ({
  portal: {
    institutionIdentity: { courtName: "PENGADILAN AGAMA DONGGALA" },
    currentUser: { id: "u1", name: "Penguji", roleId: "admin" } as Record<string, unknown> | null,
    positions: [] as unknown[],
  },
  gambar: {} as Record<string, number>,
  antrian102: 3,
}));

vi.mock("@/lib/app-state", () => ({ usePortal: () => keadaan.portal }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...sisa }: { href: string; children: unknown }) =>
    createElement("a", { href, ...sisa }, children as never),
}));
// Penghitung gambar per baris: TombolSelesaiSidang digambar sekali tiap baris digambar.
vi.mock("@/components/portal/jadwal-sidang-1okt", async (asli) => {
  const mod = await asli<typeof import("@/components/portal/jadwal-sidang-1okt")>();
  return {
    ...mod,
    TombolSelesaiSidang: (props: Parameters<typeof mod.TombolSelesaiSidang>[0]) => {
      const k = String(props.baris.perkaraId);
      keadaan.gambar[k] = (keadaan.gambar[k] ?? 0) + 1;
      return mod.TombolSelesaiSidang(props);
    },
  };
});

function tanggalLokal(t: Date) {
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}
const HARI = tanggalLokal(new Date());

function sidangBaris(perkaraId: string, nomorPerkara: string) {
  return {
    sidangId: `s${perkaraId}`,
    perkaraId,
    nomorPerkara,
    jenisPerkara: "Cerai Gugat",
    alurPerkaraId: 2,
    sudahPutus: false,
    tanggalPutusan: "",
    statusPutusan: "",
    tanggalMinutasi: "",
    tanggalBht: "",
    tanggalSidang: HARI,
    jamSidang: "09:00",
    agenda: "Pemeriksaan saksi",
    ruangan: "Ruang Sidang 1",
    ditunda: false,
    alasanDitunda: "",
    tanggalSidangBerikut: "",
    urutanSidang: 2,
    dihadiriOleh: null,
    adaBas: false,
    durasi: null,
    pihak: { penggugat: ["Penggugat"], tergugat: ["Tergugat"] },
    panggilan: { hadirSebelumnya: null, wajibDipanggil: [], belumDipanggil: 0, retur: 0, aman: true },
    putusanEcourt: null,
    majelisKode: "B",
    majelisNama: "",
    paniteraNama: "",
    jurusitaNama: "",
  };
}

function antrianBaris(nomor: number, keadaanAntrian: string, jamPanggil: string, waktuAmbil: string) {
  return {
    nomor,
    tanggalSidang: HARI,
    waktuAmbil,
    online: false,
    pihak1: waktuAmbil,
    pihak2: "",
    saksi: "",
    keadaan: keadaanAntrian,
    menitMenunggu: null,
    jamPanggil,
    noRuang: 1,
    ruanganId: 1,
    namaPetugas: "",
    majelisKode: "B",
  };
}

function jawabanJadwal() {
  return {
    available: true,
    dari: HARI,
    sampai: HARI,
    diperiksaPada: "",
    sidang: [sidangBaris("101", "101/Pdt.G/2026/PA.Dgl"), sidangBaris("102", "102/Pdt.G/2026/PA.Dgl")],
    kesiapan: {},
    rekamAntrian: { ditulis: 0, gagal: "" },
    antrian: {
      terbaca: true,
      alasan: "",
      tanggal: [HARI],
      peta: {
        101: antrianBaris(1, "dipanggil", "09:00", "08:10"),
        // Berubah antara pemuatan pertama dan kedua: nomor antrian perkara 102 saja.
        102: antrianBaris(keadaan.antrian102, "menunggu", "", "08:30"),
      },
    },
    waktuAntrian: { terbaca: false, alasan: "", sekarang: "", hariIni: HARI, langsungTerbaca: false, rekamanTerbaca: false, baris: [] },
  };
}

function jawab(isi: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: async () => isi } as unknown as Response);
}

beforeEach(() => {
  keadaan.gambar = {};
  keadaan.antrian102 = 3;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (alamat: string) => {
      const url = String(alamat);
      // Rincian satu sidang (tombol Rincian) memakai alamat yang sama dengan jadwal tetapi membawa nomor=.
      if (url.includes("/api/aleta-ecourt/sidang?") && url.includes("nomor=")) return jawab({ ok: true, data: { sipp: null, pesanSipp: "", ecourt: [], pesanEcourt: "", pihak: [], kesiapan: null, identitas: null } });
      if (url.includes("/api/aleta-ecourt/sidang?")) return jawab({ ok: true, data: jawabanJadwal() });
      return jawab({ ok: true, data: {} });
    })
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  try {
    window.localStorage.removeItem("aleta-tabel-ringan");
  } catch {
    /* jsdom tanpa localStorage */
  }
});

const tunggu = (ms: number) => new Promise((r) => setTimeout(r, ms));
const AKAR = path.resolve(__dirname, "../..");
const sumber = () => readFileSync(path.join(AKAR, "src/components/portal/aleta-ecourt-sidang.tsx"), "utf8").replace(/\r\n/g, "\n");

/** Jam dinding dan angka detik berubah antar-jalan: dinormalkan supaya hanya isi yang dibandingkan. */
function badan(container: HTMLElement) {
  const html = container.querySelector("tbody")?.innerHTML ?? "";
  return html.replace(/\d{1,2}:\d{2}(?::\d{2})?/g, "hh:mm").replace(/\b\d+[mdj]\b/g, "n").replace(/useId[^"]*/g, "");
}

async function jalankan(ringan: boolean) {
  keadaan.gambar = {};
  keadaan.antrian102 = 3;
  window.localStorage.setItem("aleta-tabel-ringan", ringan ? "1" : "0");
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  const { AletaEcourtSidang } = await import("@/components/portal/aleta-ecourt-sidang");
  const { container } = render(createElement(AletaEcourtSidang));
  await waitFor(() => expect(container.querySelectorAll("tbody tr").length).toBeGreaterThanOrEqual(2), { timeout: 15_000 });
  // Pemuatan pertama tenang dulu.
  await act(async () => {
    await tunggu(400);
  });
  const langkah: Record<string, string> = {};
  langkah.awal = badan(container);
  const sesudahAwal = { ...keadaan.gambar };

  // 1. Buka rincian perkara 101 saja.
  const tombol101 = container.querySelector('button[title="Buka rincian 101/Pdt.G/2026/PA.Dgl"]') as HTMLButtonElement | null;
  expect(tombol101).toBeTruthy();
  await act(async () => {
    tombol101!.click();
    await tunggu(300);
  });
  langkah.rincian = badan(container);
  const sesudahRincian = { ...keadaan.gambar };

  // 2. Muat ulang berkala (45 dtk): antrian perkara 102 berubah, perkara 101 tidak.
  keadaan.antrian102 = 7;
  await act(async () => {
    vi.advanceTimersByTime(46_000);
    await tunggu(500);
  });
  langkah.muatUlang = badan(container);
  const sesudahMuat = { ...keadaan.gambar };
  return { langkah, sesudahAwal, sesudahRincian, sesudahMuat };
}

describe("A. saklar tabel ringan", () => {
  it("mati bawaan; menyala lewat localStorage", async () => {
    const { tabelRinganAktif } = await import("@/components/portal/baris-tabel-ringan");
    window.localStorage.removeItem("aleta-tabel-ringan");
    expect(tabelRinganAktif()).toBe(false);
    window.localStorage.setItem("aleta-tabel-ringan", "0");
    expect(tabelRinganAktif()).toBe(false);
    window.localStorage.setItem("aleta-tabel-ringan", "1");
    expect(tabelRinganAktif()).toBe(true);
  });

  it("sidik: obyek berisi sama = sidik sama; undefined dibedakan dari null", async () => {
    const { sidik } = await import("@/components/portal/baris-tabel-ringan");
    expect(sidik({ a: 1, b: [1, 2] })).toBe(sidik({ a: 1, b: [1, 2] }));
    expect(sidik({ a: 1 })).not.toBe(sidik({ a: 2 }));
    expect(sidik(undefined)).not.toBe(sidik(null));
    const lingkar: Record<string, unknown> = {};
    lingkar.diri = lingkar;
    expect(sidik(lingkar)).not.toBe(sidik(lingkar)); // tak dapat diserialkan: selalu dianggap berbeda
  });
});

describe("B. layar Jadwal Sidang: jalur lama vs tabel ringan", () => {
  it("isi tabel SAMA pada tiap langkah; saklar mati menggambar semua baris, saklar menyala hanya yang berubah", async () => {
    const lama = await jalankan(false);
    cleanup();
    vi.useRealTimers();
    const baru = await jalankan(true);

    // Isi sama pada tiap langkah (rincian dibuka, antrian 102 berubah).
    expect(baru.langkah.awal).toBe(lama.langkah.awal);
    expect(baru.langkah.rincian).toBe(lama.langkah.rincian);
    expect(baru.langkah.muatUlang).toBe(lama.langkah.muatUlang);
    expect(baru.langkah.muatUlang).toContain("101/Pdt.G/2026/PA.Dgl");

    const tambah = (a: Record<string, number>, b: Record<string, number>, k: string) => (b[k] ?? 0) - (a[k] ?? 0);

    // Jalur lama: membuka rincian 101 menggambar ulang kedua baris.
    expect(tambah(lama.sesudahAwal, lama.sesudahRincian, "102")).toBeGreaterThan(0);
    // Tabel ringan: baris 102 tidak disentuh, baris 101 digambar ulang.
    expect(tambah(baru.sesudahAwal, baru.sesudahRincian, "101")).toBeGreaterThan(0);
    expect(tambah(baru.sesudahAwal, baru.sesudahRincian, "102")).toBe(0);

    // Muat ulang: antrian 102 berubah -> 102 digambar ulang, 101 (tak berubah) tidak.
    expect(tambah(baru.sesudahRincian, baru.sesudahMuat, "102")).toBeGreaterThan(0);
    expect(tambah(baru.sesudahRincian, baru.sesudahMuat, "101")).toBe(0);
    // Jalur lama: muat ulang menggambar ulang 101 juga.
    expect(tambah(lama.sesudahRincian, lama.sesudahMuat, "101")).toBeGreaterThan(0);
  }, 90_000);
});

describe("C. penjaga kebergantungan baris", () => {
  it("setiap peubah komponen yang dibaca baris ada di daftar kebergantungan atau alat pemicu", async () => {
    const ts = await import("typescript");
    const fail = path.join(AKAR, "src/components/portal/aleta-ecourt-sidang.tsx");
    const teks = sumber();
    const program = ts.createProgram([fail], {
      jsx: ts.JsxEmit.Preserve,
      target: ts.ScriptTarget.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      module: ts.ModuleKind.ESNext,
      strict: true,
      skipLibCheck: true,
      noEmit: true,
      baseUrl: AKAR,
      paths: { "@/*": ["src/*"] },
      types: [],
    });
    const sf = program.getSourceFile(fail)!;
    const chk = program.getTypeChecker();

    let panggilan: import("typescript").ArrowFunction | null = null;
    const cari = (n: import("typescript").Node) => {
      if (ts.isCallExpression(n) && n.expression.getText(sf).endsWith("sidangTampil.map") && n.arguments[0] && ts.isArrowFunction(n.arguments[0])) {
        const badanFn = n.arguments[0];
        if (badanFn.getText(sf).includes("const gambarBaris")) panggilan = badanFn;
      }
      ts.forEachChild(n, cari);
    };
    cari(sf);
    expect(panggilan, "callback baris tidak ditemukan").toBeTruthy();
    const cb = panggilan as unknown as import("typescript").ArrowFunction;

    // Peubah bebas yang dideklarasikan DI DALAM komponen (di luar callback baris).
    const bebas = new Set<string>();
    const jalan = (n: import("typescript").Node) => {
      if (ts.isIdentifier(n)) {
        const p = n.parent;
        const bukanRujukan =
          (ts.isPropertyAccessExpression(p) && p.name === n) ||
          (ts.isPropertyAssignment(p) && p.name === n) ||
          (ts.isJsxAttribute(p) && p.name === n);
        if (!bukanRujukan) {
          const sym = ts.isShorthandPropertyAssignment(p) ? chk.getShorthandAssignmentValueSymbol(p) : chk.getSymbolAtLocation(n);
          const d = sym?.declarations?.[0];
          if (d && d.getSourceFile() === sf && !(d.pos >= cb.pos && d.end <= cb.end)) {
            let f: import("typescript").Node | undefined = d.parent;
            while (f) {
              if (ts.isFunctionLike(f) && f.pos <= cb.pos && f.end >= cb.end) {
                bebas.add(n.text);
                break;
              }
              f = f.parent;
            }
          }
        }
      }
      ts.forEachChild(n, jalan);
    };
    jalan(cb);

    // Daerah yang sah: blok K13 (alat + depsBarisBersama) dan daftar `deps` per baris.
    const a = teks.indexOf("const tabelRingan = useMemo");
    const b = teks.indexOf("<UnduhTertutupTautan.Provider", a);
    const blokHook = teks.slice(a, b);
    const c = teks.indexOf("if (!tabelRingan) return gambarBaris();", teks.indexOf("const gambarBaris"));
    const d = teks.indexOf("/>", teks.indexOf("<BarisTabelRingan", c));
    const blokDeps = teks.slice(c, d);
    const dicakup = `${blokHook}\n${blokDeps}`;

    // Penyetel state dan pembungkus stabil tidak perlu dicantumkan (identitasnya tetap).
    const PENYETEL_STABIL = new Set(["setSidang", "setCatat", "setKeteranganKunci", "setTunjukKunci"]);
    // Peubah yang dibaca baris lewat NILAI TURUNAN per baris (dihitung di puncak callback):
    // yang wajib tercantum adalah turunannya, bukan peta utuhnya.
    const TURUNAN: Record<string, string[]> = {
      dibuka: ["berbuka"],
      ruangSidang: ["berjalanIni", "skorsIni", "ruangIni", "aksiRuang"],
      tigaJarak: ["tigaBaris"],
      bisaDipanggilHariIni: ["bisaDipanggilIni"],
      tandaSelesaiHook: ["selesaiTanda", "skorsIni"],
      saksiLipatHook: ["saksiLipat.terbuka"],
      tarikBelumUploadHook: ["tarikBelumUpload.keadaanUntuk"],
    };
    const adaKata = (teks: string, kata: string) => {
      // Kata utuh (bukan bagian kata lain, bukan anggota obyek lain); titik di dalam kata dianggap huruf biasa.
      let dari = 0;
      for (;;) {
        const i = teks.indexOf(kata, dari);
        if (i < 0) return false;
        const sebelum = i === 0 ? "" : teks[i - 1];
        const sesudah = teks[i + kata.length] ?? "";
        if (!/[\w.]/.test(sebelum) && !/\w/.test(sesudah)) return true;
        dari = i + 1;
      }
    };
    for (const [asal, turunan] of Object.entries(TURUNAN)) {
      for (const t of turunan) {
        expect(adaKata(dicakup, t), `${asal}: turunan ${t} harus ada di kebergantungan`).toBe(true);
      }
    }
    const terlupa = [...bebas]
      .filter((n) => !PENYETEL_STABIL.has(n) && !(n in TURUNAN))
      .filter((n) => !new RegExp(`(^|[^\\w.])${n}([^\\w]|$)`).test(dicakup))
      .sort();
    expect(terlupa, `peubah dibaca baris tetapi tidak ada di kebergantungan memo: ${terlupa.join(", ")}`).toEqual([]);
    expect(bebas.size).toBeGreaterThan(40);
  }, 120_000);

  it("jalur lama persis bila saklar mati: baris digambar langsung, tanpa pembungkus", () => {
    const teks = sumber();
    expect(teks).toContain("if (!tabelRingan) return gambarBaris();");
    expect(teks).toContain("useAlatBaris(tabelRingan,");
    const modul = readFileSync(path.join(AKAR, "src/components/portal/baris-tabel-ringan.tsx"), "utf8");
    expect(modul).toContain('process.env.NEXT_PUBLIC_ALETA_TABEL_RINGAN === "1"');
    expect(modul).toContain('"aleta-tabel-ringan"');
    // Tanpa virtualisasi: tinggi baris beragam; hanya memo.
    expect(modul).not.toMatch(/IntersectionObserver|react-window|react-virtual/);
  });
});
