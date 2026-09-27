/**
 * ============================================================================
 * PETA PERKARA DI LAYAR - DIGAMBAR DAN DIKETUK, BUKAN DISISIR
 * ============================================================================
 *
 * Komponen PetaTitikPerkara SUNGGUHAN digambar di jsdom. Yang dipalsukan hanya
 * pustaka petanya (Leaflet) - pemalsunya berperilaku seperti Leaflet dalam
 * satu hal yang menentukan: ia MENAMBAHKAN kelasnya sendiri ke unsur yang
 * diserahkan kepadanya. Itulah yang dahulu dihapus React ketika layar penuh
 * dinyalakan, dan yang membuat seluruh ubinan peta lenyap.
 *
 * Ukuran piksel sungguhan tidak ada di jsdom; yang itu diukur di Chromium
 * (D:/aleta-dev/kerja/peta-perkara/uji/cek-layar-penuh.mjs).
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PetaTitikPerkara, type TitikPerkara } from "@/components/portal/peta-titik-perkara";
import {
  KUNCI_INGAT_GOLONGAN,
  WARNA_KELAS,
  hitungGolongan,
  jariJariBulatan,
  skalaBulatan,
} from "@/lib/peta-perkara-ukur";

// ============================================================================
// PEMALSU LEAFLET - mencatat apa yang digambar
// ============================================================================
type Bentuk = {
  jenis: string;
  pos: unknown;
  opsi: Record<string, unknown>;
  penangan: Record<string, Array<() => void>>;
  tooltip: string;
};
type Kumpulan = { lapis: Bentuk[]; addTo: () => Kumpulan; clearLayers: () => void; addLayer: (l: Bentuk) => void };

const rekam = vi.hoisted(() => ({
  unsurPeta: null as HTMLElement | null,
  kumpulan: [] as Kumpulan[],
  invalidate: 0,
  zum: 9,
  penangan: new Map<string, Array<() => void>>(),
}));

vi.mock("@/lib/peta-leaflet", () => {
  const bentuk = (jenis: string, pos: unknown, opsi: Record<string, unknown> = {}) => {
    const b = {
      jenis,
      pos,
      opsi,
      penangan: {} as Record<string, Array<() => void>>,
      tooltip: "",
      addTo: () => b,
      bindTooltip: (isi: string) => {
        b.tooltip = isi;
        return b;
      },
      bindPopup: () => b,
      setStyle: () => b,
      on: (nama: string, f: () => void) => {
        (b.penangan[nama] ??= []).push(f);
        return b;
      },
      getElement: () => undefined,
    };
    return b;
  };
  const L = {
    map(el: HTMLElement) {
      // Seperti Leaflet sungguhan: kelasnya ditulis ke unsur itu sendiri.
      el.classList.add("leaflet-container", "leaflet-touch", "leaflet-fade-anim", "leaflet-grab");
      rekam.unsurPeta = el;
      const panel = new Map<string, HTMLElement>();
      const peta = {
        setView: () => peta,
        fitBounds: () => peta,
        remove: () => undefined,
        invalidateSize: () => {
          rekam.invalidate += 1;
        },
        getZoom: () => rekam.zum,
        on(nama: string, f: () => void) {
          for (const n of nama.split(" ")) rekam.penangan.set(n, [...(rekam.penangan.get(n) ?? []), f]);
        },
        off(nama: string, f: () => void) {
          for (const n of nama.split(" ")) rekam.penangan.set(n, (rekam.penangan.get(n) ?? []).filter((x) => x !== f));
        },
        createPane(nama: string) {
          const d = document.createElement("div");
          d.className = `leaflet-pane leaflet-${nama}-pane`;
          el.appendChild(d);
          panel.set(nama, d);
          return d;
        },
        getPane: (nama: string) => panel.get(nama),
      };
      return peta;
    },
    tileLayer: () => ({ addTo: () => undefined }),
    canvas: (opsi: Record<string, unknown>) => ({ kanvas: true, ...opsi }),
    circleMarker: (pos: unknown, opsi: Record<string, unknown>) => bentuk("bulatan", pos, opsi),
    circle: (pos: unknown, opsi: Record<string, unknown>) => bentuk("cincin", pos, opsi),
    polygon: (pos: unknown, opsi: Record<string, unknown>) => bentuk("poligon", pos, opsi),
    marker: (pos: unknown, opsi: Record<string, unknown>) => bentuk("label", pos, opsi),
    divIcon: (opsi: Record<string, unknown>) => opsi,
    layerGroup() {
      const k: Kumpulan = {
        lapis: [],
        addTo: () => k,
        clearLayers: () => {
          k.lapis.length = 0;
        },
        addLayer: (l: Bentuk) => {
          k.lapis.push(l);
        },
      };
      rekam.kumpulan.push(k);
      return k;
    },
    latLngBounds: (t: unknown[]) => ({ isValid: () => t.length > 0 }),
    control: { attribution: () => ({ addTo: () => undefined }) },
  };
  return { muatLeaflet: async () => L };
});

// Urutan kumpulan sesuai urutan pembuatannya di komponen.
const bulatan = () => rekam.kumpulan[0]?.lapis.filter((b) => b.jenis === "bulatan") ?? [];
const garisKecamatan = () => rekam.kumpulan[2]?.lapis ?? [];
const labelKecamatan = () => rekam.kumpulan[3]?.lapis ?? [];

async function ubahZum(z: number) {
  rekam.zum = z;
  await act(async () => {
    for (const f of rekam.penangan.get("zoomend") ?? []) f();
  });
}

// ============================================================================
// DATA - bentuk sungguhan kiriman bot (titikDesa), diringkas
// ============================================================================
const kelas = (k: Record<string, number>) =>
  Object.fromEntries(Object.entries(k).map(([nama, n]) => [nama, { perkara: n, lelaki: 0, perempuan: n }]));

const TITIK: TitikPerkara[] = [
  // Kecamatan 72.03.08 (Banawa): empat desa bertitik + satu desa TANPA titik.
  { kode: "72.03.08.1001", nama: "Boya", kecamatan: "Banawa", kabupaten: "Kabupaten Donggala", perkara: 12, lelaki: 0, perempuan: 12, jenis: {}, kelas: kelas({ ceraiGugat: 10, dispensasi: 2 }) },
  { kode: "72.03.08.1002", nama: "Ganti", kecamatan: "Banawa", kabupaten: "Kabupaten Donggala", perkara: 5, lelaki: 0, perempuan: 5, jenis: {}, kelas: kelas({ ceraiTalak: 5 }) },
  { kode: "72.03.08.1003", nama: "Labuan Bajo", kecamatan: "Banawa", kabupaten: "Kabupaten Donggala", perkara: 3, lelaki: 0, perempuan: 3, jenis: {}, kelas: kelas({ itsbat: 3 }) },
  { kode: "72.03.08.1004", nama: "Tanjung Batu", kecamatan: "Banawa", kabupaten: "Kabupaten Donggala", perkara: 1, lelaki: 0, perempuan: 1, jenis: {}, kelas: kelas({ dispensasi: 1 }) },
  { kode: "72.03.08.2099", nama: "Desa Tanpa Titik", kecamatan: "Banawa", kabupaten: "Kabupaten Donggala", perkara: 7, lelaki: 0, perempuan: 7, jenis: {}, kelas: kelas({ ceraiGugat: 7 }) },
  // Kecamatan 72.10.01 (Sigi Biromaru): hanya dua titik - tanpa garis perkiraan.
  { kode: "72.10.01.2009", nama: "Kalukubula", kecamatan: "Sigi Biromaru", kabupaten: "Kabupaten Sigi", perkara: 20, lelaki: 0, perempuan: 20, jenis: {}, kelas: kelas({ ceraiGugat: 20 }) },
  { kode: "72.10.01.2010", nama: "Mpanau", kecamatan: "Sigi Biromaru", kabupaten: "Kabupaten Sigi", perkara: 2, lelaki: 0, perempuan: 2, jenis: {}, kelas: kelas({ itsbat: 2 }) },
];

const KOORDINAT: Record<string, [number, number]> = {
  "72.03.08.1001": [-0.66, 119.74],
  "72.03.08.1002": [-0.68, 119.73],
  "72.03.08.1003": [-0.7, 119.76],
  "72.03.08.1004": [-0.67, 119.78],
  "72.10.01.2009": [-1.01, 119.96],
  "72.10.01.2010": [-1.03, 119.97],
};

const BATAS_CONTOH = {
  type: "FeatureCollection",
  sumber: "contoh uji",
  lisensi: "ODbL",
  dibuat: "2026-09-27",
  features: [
    {
      type: "Feature",
      properties: { kode: "72.03.08", nama: "Banawa", kabupaten: "Kabupaten Donggala" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [119.7, -0.72],
            [119.8, -0.72],
            [119.8, -0.64],
            [119.7, -0.64],
            [119.7, -0.72],
          ],
        ],
      },
    },
  ],
};

let batas: unknown = null;

function pasangFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (alamat: string) => {
      const url = String(alamat);
      if (url.endsWith("/peta/titik-desa.json")) {
        return new Response(JSON.stringify({ sumber: "uji", titik: KOORDINAT }), { status: 200 });
      }
      if (url.endsWith("/peta/batas-kecamatan.json")) {
        return batas ? new Response(JSON.stringify(batas), { status: 200 }) : new Response("tidak ada", { status: 404 });
      }
      return new Response(JSON.stringify({ ok: true, data: { ok: true, desa: [], perkara: [] } }), { status: 200 });
    })
  );
}

const SARINGAN = { kelompok: "perceraian", periode: "tahun", acuan: "2026-09-27", dari: "2026-01-01", sampai: "2026-12-31" };

async function gambar(props: Partial<Parameters<typeof PetaTitikPerkara>[0]> = {}) {
  const hasil = render(<PetaTitikPerkara titik={TITIK} tanpaKode={0} saringan={SARINGAN} {...props} />);
  await waitFor(() => expect(bulatan().length).toBeGreaterThan(0));
  return hasil;
}

beforeEach(() => {
  rekam.unsurPeta = null;
  rekam.kumpulan = [];
  rekam.invalidate = 0;
  rekam.zum = 9;
  rekam.penangan = new Map();
  batas = null;
  window.localStorage.clear();
  // Uji-uji di bawah ini menguji perilaku "Semua perkara" - pilihan itu
  // DIINGAT lebih dahulu, seperti petugas yang sudah pernah memilihnya.
  // Kunjungan pertama (tanpa ingatan) diuji tersendiri di bagian telaah 2.40.0.
  window.localStorage.setItem(KUNCI_INGAT_GOLONGAN, "semua");
  pasangFetch();
  if (!("requestAnimationFrame" in window)) {
    vi.stubGlobal("requestAnimationFrame", (f: FrameRequestCallback) => setTimeout(() => f(0), 0));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  }
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // @ts-expect-error - dipasang sendiri oleh uji
  delete HTMLElement.prototype.requestFullscreen;
  // @ts-expect-error - dipasang sendiri oleh uji
  delete document.exitFullscreen;
  Object.defineProperty(document, "fullscreenElement", { value: null, configurable: true });
});

function pasangFullscreenApi() {
  Object.defineProperty(document, "fullscreenElement", { value: null, configurable: true, writable: true });
  HTMLElement.prototype.requestFullscreen = function (this: HTMLElement) {
    Object.defineProperty(document, "fullscreenElement", { value: this, configurable: true, writable: true });
    document.dispatchEvent(new Event("fullscreenchange"));
    return Promise.resolve();
  };
  document.exitFullscreen = () => {
    Object.defineProperty(document, "fullscreenElement", { value: null, configurable: true, writable: true });
    document.dispatchEvent(new Event("fullscreenchange"));
    return Promise.resolve();
  };
}

// ============================================================================
// 1. LAYAR PENUH
// ============================================================================
describe("layar penuh tidak lagi mengosongkan peta", () => {
  it("unsur milik Leaflet TIDAK dirender React - kelas leaflet-container bertahan masuk DAN keluar", async () => {
    pasangFullscreenApi();
    await gambar();
    const unsur = rekam.unsurPeta!;
    expect(unsur.classList.contains("leaflet-container")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Layar penuh" }));
    await screen.findByRole("button", { name: /Keluar layar penuh/ });
    expect(document.fullscreenElement).toBe(document.querySelector(".aleta-peta-wadah"));
    // Inilah yang dahulu hilang: React menulis ulang className unsur ini.
    expect(unsur.classList.contains("leaflet-container")).toBe(true);
    expect(unsur.isConnected).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /Keluar layar penuh/ }));
    await screen.findByRole("button", { name: "Layar penuh" });
    expect(unsur.classList.contains("leaflet-container")).toBe(true);
    expect(unsur.classList.contains("leaflet-touch")).toBe(true);
  });

  it("ukurannya diatur kotak luar, dan peta menghitung ulang ukurannya sesudah berubah", async () => {
    pasangFullscreenApi();
    await gambar();
    const kotak = document.querySelector(".aleta-peta-wadah") as HTMLElement;
    expect(kotak.className).toContain("h-[26rem]");
    await waitFor(() => expect(rekam.invalidate).toBeGreaterThan(0));
    const sebelum = rekam.invalidate;

    fireEvent.click(screen.getByRole("button", { name: "Layar penuh" }));
    await screen.findByRole("button", { name: /Keluar layar penuh/ });
    expect(kotak.className).toContain("h-dvh");
    expect(kotak.className).not.toContain("h-[26rem]");
    await waitFor(() => expect(rekam.invalidate).toBeGreaterThan(sebelum));

    const sesudahMasuk = rekam.invalidate;
    fireEvent.click(screen.getByRole("button", { name: /Keluar layar penuh/ }));
    await screen.findByRole("button", { name: "Layar penuh" });
    await waitFor(() => expect(rekam.invalidate).toBeGreaterThan(sesudahMasuk));
  });

  it("pemilih golongan dan keterangan ukuran ikut masuk ke layar penuh", async () => {
    pasangFullscreenApi();
    await gambar();
    fireEvent.click(screen.getByRole("button", { name: "Layar penuh" }));
    const kotak = document.querySelector(".aleta-peta-wadah") as HTMLElement;
    await waitFor(() => expect(kotak.querySelector("select")).not.toBeNull());
    expect(kotak.textContent).toContain("Bulatan menghitung");
    expect(kotak.textContent).toMatch(/perkara/);
  });

  it("tanpa Fullscreen API: layar penuh SEMU, dan leluhur penahan position:fixed dinetralkan lalu dipulihkan", async () => {
    // requestFullscreen tidak dipasang sama sekali.
    const hasil = render(
      <div data-uji="kartu" style={{ transform: "translateZ(0)" }}>
        <PetaTitikPerkara titik={TITIK} tanpaKode={0} saringan={SARINGAN} />
      </div>
    );
    await waitFor(() => expect(bulatan().length).toBeGreaterThan(0));
    const kartu = hasil.container.querySelector('[data-uji="kartu"]') as HTMLElement;

    fireEvent.click(screen.getByRole("button", { name: "Layar penuh" }));
    await screen.findByRole("button", { name: /Keluar layar penuh/ });
    const kotak = document.querySelector(".aleta-peta-wadah") as HTMLElement;
    expect(kotak.className).toContain("fixed");
    expect(kotak.className).toContain("inset-0");
    expect(kartu.hasAttribute("data-aleta-lepas-bingkai")).toBe(true);
    expect(rekam.unsurPeta!.classList.contains("leaflet-container")).toBe(true);

    fireEvent.keyDown(document, { key: "Escape" });
    await screen.findByRole("button", { name: "Layar penuh" });
    expect(kartu.hasAttribute("data-aleta-lepas-bingkai")).toBe(false);
  });
});

// ============================================================================
// 2. GOLONGAN BULATAN
// ============================================================================
describe("pemilih golongan bulatan", () => {
  it("lima pilihan, masing-masing dengan jumlahnya", async () => {
    await gambar();
    const tombol = (nama: RegExp) => screen.getByRole("button", { name: nama });
    expect(tombol(/^Semua perkara/).textContent).toContain("50");
    expect(tombol(/^Cerai/).textContent).toContain("42");
    expect(tombol(/^Dispensasi kawin/).textContent).toContain("3");
    expect(tombol(/^Itsbat nikah/).textContent).toContain("5");
    expect(tombol(/^Lainnya/).textContent).toContain("0");
    expect(tombol(/^Semua perkara/).getAttribute("aria-pressed")).toBe("true");
  });

  it("memilih Dispensasi mengubah bulatan: tempat, jari-jari (skala SEMUA), dan warna", async () => {
    await gambar();
    await ubahZum(10);
    await waitFor(() => expect(bulatan()).toHaveLength(6));

    fireEvent.click(screen.getByRole("button", { name: /^Dispensasi kawin/ }));
    await waitFor(() => expect(bulatan()).toHaveLength(2));

    // Skala dihitung dari SEMUA perkara desa bertitik - bukan dari dispensasi.
    const skala = skalaBulatan(TITIK.filter((t) => KOORDINAT[t.kode]).map((t) => t.perkara));
    const menurutPos = new Map(bulatan().map((b) => [JSON.stringify(b.pos), b.opsi]));
    const boya = menurutPos.get(JSON.stringify(KOORDINAT["72.03.08.1001"]))!;
    const tanjung = menurutPos.get(JSON.stringify(KOORDINAT["72.03.08.1004"]))!;
    expect(boya.radius).toBe(jariJariBulatan(2, skala));
    expect(tanjung.radius).toBe(jariJariBulatan(1, skala));
    expect(boya.color).toBe(WARNA_KELAS.dispensasi);
    // Desa yang dispensasinya nol TIDAK digambar sebagai bulatan terkecil.
    expect(menurutPos.has(JSON.stringify(KOORDINAT["72.03.08.1002"]))).toBe(false);
  });

  it("warna cerai tetap merah-biru satker menurut kelas terbanyak", async () => {
    await gambar();
    await ubahZum(10);
    fireEvent.click(screen.getByRole("button", { name: /^Cerai/ }));
    await waitFor(() => expect(bulatan()).toHaveLength(3));
    const warna = new Map(bulatan().map((b) => [JSON.stringify(b.pos), b.opsi.color]));
    expect(warna.get(JSON.stringify(KOORDINAT["72.03.08.1001"]))).toBe(WARNA_KELAS.ceraiGugat);
    expect(warna.get(JSON.stringify(KOORDINAT["72.03.08.1002"]))).toBe(WARNA_KELAS.ceraiTalak);
  });

  it("pilihan diingat: dipasang ulang, petanya membuka golongan yang sama", async () => {
    const pertama = await gambar();
    fireEvent.click(screen.getByRole("button", { name: /^Itsbat nikah/ }));
    expect(window.localStorage.getItem(KUNCI_INGAT_GOLONGAN)).toBe("itsbat");
    pertama.unmount();
    rekam.kumpulan = [];

    await gambar();
    expect(screen.getByRole("button", { name: /^Itsbat nikah/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("golongan yang kosong tidak menggambar apa pun - dan mengatakannya", async () => {
    await gambar();
    fireEvent.click(screen.getByRole("button", { name: /^Lainnya/ }));
    await waitFor(() => expect(bulatan()).toHaveLength(0));
    expect(screen.getByText(/Tidak ada perkara lainnya yang dapat digambar/)).toBeInTheDocument();
  });

  it("bot yang belum mengirim kelas: hanya 'Semua', pemilih lain mati", async () => {
    const tanpaKelas = TITIK.map((t) => ({ ...t, kelas: undefined }));
    render(<PetaTitikPerkara titik={tanpaKelas} tanpaKode={0} saringan={SARINGAN} />);
    await waitFor(() => expect(bulatan().length).toBeGreaterThan(0));
    expect(screen.getByRole("button", { name: /^Dispensasi kawin/ })).toBeDisabled();
    expect(screen.getByText(/belum mengirim golongan jenis per desa/)).toBeInTheDocument();
  });
});

// ============================================================================
// 3. LAPISAN KECAMATAN
// ============================================================================
describe("lapisan kecamatan menurut perbesaran", () => {
  it("BATAS PERKIRAAN tanpa berkas resmi: putus-putus, >= 3 titik saja, dan mengaku perkiraan", async () => {
    await gambar();
    await waitFor(() => expect(garisKecamatan()).toHaveLength(1));
    // Hanya Banawa (4 titik); Sigi Biromaru (2 titik) tanpa garis.
    expect(garisKecamatan()[0].opsi.dashArray).toBe("6 5");
    expect(screen.getByText(/batas perkiraan dari titik desa — bukan batas resmi/)).toBeInTheDocument();
    // Zum 9: garis tanpa label.
    expect(labelKecamatan()).toHaveLength(0);
  });

  it("zum 8 tanpa garis; zum 10 garis + label nama dan jumlah SELURUH perkaranya", async () => {
    await gambar();
    await waitFor(() => expect(garisKecamatan()).toHaveLength(1));
    await ubahZum(8);
    await waitFor(() => expect(garisKecamatan()).toHaveLength(0));
    await ubahZum(10);
    await waitFor(() => expect(labelKecamatan().length).toBe(2));

    const html = labelKecamatan().map((l) => String((l.opsi.icon as { html: string }).html));
    const banawa = html.find((h) => h.includes("Banawa"))!;
    // 12 + 5 + 3 + 1 bertitik + 7 dari desa TANPA titik = 28.
    expect(banawa).toContain("28 perkara");
    expect(banawa).toContain("7 dari desa tanpa titik");
    const sigi = html.find((h) => h.includes("Sigi Biromaru"))!;
    expect(sigi).toContain("22 perkara");
  });

  it("label kecamatan mengikuti golongan yang dipilih", async () => {
    await gambar();
    await ubahZum(10);
    fireEvent.click(screen.getByRole("button", { name: /^Dispensasi kawin/ }));
    await waitFor(() => {
      const html = labelKecamatan().map((l) => String((l.opsi.icon as { html: string }).html));
      expect(html).toHaveLength(1);
      expect(html[0]).toContain("3 perkara dispensasi kawin");
    });
  });

  it("berkas batas RESMI (contoh GeoJSON): garis utuh, sumbernya disebut", async () => {
    batas = BATAS_CONTOH;
    await gambar();
    await waitFor(() => expect(garisKecamatan()).toHaveLength(1));
    expect(garisKecamatan()[0].opsi.dashArray).toBeUndefined();
    // [lintang, bujur] untuk Leaflet - GeoJSON dibalik.
    expect((garisKecamatan()[0].pos as number[][][][])[0][0][0]).toEqual([-0.72, 119.7]);
    expect(screen.getByText(/batas kecamatan OpenStreetMap \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Batas kecamatan: contoh uji/)).toBeInTheDocument();
  });
});

describe("hitungan pembanding", () => {
  it("jumlah pada tombol = jumlah seluruh desa, termasuk yang tanpa titik", () => {
    const semua = TITIK.reduce((n, t) => n + hitungGolongan(t, "semua").perkara, 0);
    expect(semua).toBe(50);
  });
});

// ============================================================================
// 4. TELAAH 2.40.0 - PILIHAN AWAL, DAN JENIS TUNGGAL YANG TEPAT JENIS ITU
// ============================================================================
//
// (1) Kunjungan pertama: menu halaman "Perceraian", bulatan "Semua perkara".
// (2) "Jenis perkara" = Kewarisan (golongan lainnya): bulatan dan daftar desa
//     yang diketuk memuat SELURUH "lainnya" (Harta Bersama, Perwalian, ...),
//     sedangkan tabel di bawahnya hanya Kewarisan. Sebelum 2.40.0 peta
//     menampilkan tepat jenis itu.
const lainnya = (jenis: Record<string, number>, kelamin: Record<string, [number, number]>) => ({
  jenis,
  jenisKelamin: Object.fromEntries(Object.entries(kelamin).map(([j, [l, p]]) => [j, { lelaki: l, perempuan: p }])),
});

const KEWARISAN: TitikPerkara[] = [
  {
    kode: "72.03.08.1001", nama: "Boya", kecamatan: "Banawa", kabupaten: "Kabupaten Donggala",
    perkara: 3, lelaki: 1, perempuan: 2,
    ...lainnya({ Kewarisan: 2, "Harta Bersama": 1 }, { Kewarisan: [1, 1], "Harta Bersama": [0, 1] }),
    kelas: { lainnya: { perkara: 3, lelaki: 1, perempuan: 2, jenis: { Kewarisan: 2, "Harta Bersama": 1 } } },
  },
  {
    kode: "72.03.08.1002", nama: "Ganti", kecamatan: "Banawa", kabupaten: "Kabupaten Donggala",
    perkara: 4, lelaki: 0, perempuan: 4,
    ...lainnya({ "Harta Bersama": 4 }, { "Harta Bersama": [0, 4] }),
    kelas: { lainnya: { perkara: 4, lelaki: 0, perempuan: 4, jenis: { "Harta Bersama": 4 } } },
  },
  {
    kode: "72.03.08.1003", nama: "Labuan Bajo", kecamatan: "Banawa", kabupaten: "Kabupaten Donggala",
    perkara: 7, lelaki: 1, perempuan: 6,
    ...lainnya({ Kewarisan: 1, "Cerai Gugat": 6 }, { Kewarisan: [1, 0], "Cerai Gugat": [0, 6] }),
    kelas: {
      ceraiGugat: { perkara: 6, lelaki: 0, perempuan: 6 },
      lainnya: { perkara: 1, lelaki: 1, perempuan: 0, jenis: { Kewarisan: 1 } },
    },
  },
  {
    kode: "72.03.08.2099", nama: "Desa Tanpa Titik", kecamatan: "Banawa", kabupaten: "Kabupaten Donggala",
    perkara: 2, lelaki: 2, perempuan: 0,
    ...lainnya({ Kewarisan: 2 }, { Kewarisan: [2, 0] }),
    kelas: { lainnya: { perkara: 2, lelaki: 2, perempuan: 0, jenis: { Kewarisan: 2 } } },
  },
];

describe("telaah 2.40.0: pilihan awal dan jenis tunggal", () => {
  beforeEach(() => window.localStorage.removeItem(KUNCI_INGAT_GOLONGAN));

  it("kunjungan pertama, 'Jenis perkara' Perceraian: bulatan menghitung Cerai - bukan Semua", async () => {
    await gambar();
    expect(screen.getByRole("button", { name: /^Cerai/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /^Semua perkara/ }).getAttribute("aria-pressed")).toBe("false");
    await ubahZum(10);
    // Boya (10 gugat), Ganti (5 talak), Kalukubula (20 gugat).
    await waitFor(() => expect(bulatan()).toHaveLength(3));
  });

  it("diingat 'jenis' dari kunjungan lalu, tetapi halaman kembali Perceraian: Cerai", async () => {
    window.localStorage.setItem(KUNCI_INGAT_GOLONGAN, "jenis");
    await gambar();
    expect(screen.getByRole("button", { name: /^Cerai/ }).getAttribute("aria-pressed")).toBe("true");
  });

  async function gambarKewarisan() {
    render(
      <PetaTitikPerkara
        titik={KEWARISAN}
        tanpaKode={0}
        jenisTerpilih="Kewarisan"
        golonganJenis="lainnya"
        saringan={{ ...SARINGAN, kelompok: "Kewarisan" }}
      />
    );
    await waitFor(() => expect(bulatan().length).toBeGreaterThan(0));
  }

  it("jenis tunggal: tombol jenis itu ada, TERPILIH, dan angkanya sama dengan tabel (5, bukan 10)", async () => {
    await gambarKewarisan();
    const tombol = screen.getByRole("button", { name: /^Kewarisan/ });
    expect(tombol.getAttribute("aria-pressed")).toBe("true");
    expect(tombol.textContent).toMatch(/Kewarisan\s*5$/);
    // Golongan "lainnya" tetap dapat dipilih - dan memang lebih besar.
    expect(screen.getByRole("button", { name: /^Lainnya/ }).textContent).toMatch(/10$/);
  });

  it("bulatannya TEPAT Kewarisan: desa yang hanya Harta Bersama tidak digambar, jari-jari dan warnanya dari jenis itu", async () => {
    await gambarKewarisan();
    await ubahZum(10);
    await waitFor(() => expect(bulatan()).toHaveLength(2));
    const skala = skalaBulatan([3, 4, 7]);
    const perPos = new Map(bulatan().map((b) => [JSON.stringify(b.pos), b]));
    expect(perPos.has(JSON.stringify(KOORDINAT["72.03.08.1002"]))).toBe(false);
    const boya = perPos.get(JSON.stringify(KOORDINAT["72.03.08.1001"]))!;
    expect(boya.opsi.radius).toBe(jariJariBulatan(2, skala));
    expect(boya.opsi.color).toBe(WARNA_KELAS.lainnya);
    expect(boya.tooltip).toContain("2 perkara Kewarisan");
    expect(boya.tooltip).toContain("1 laki-laki · 1 perempuan");
    expect(boya.tooltip).not.toContain("Harta Bersama");
  });

  it("desa yang diketuk meminta daftar menurut KELOMPOK halaman - tanpa golongan", async () => {
    await gambarKewarisan();
    await ubahZum(10);
    await waitFor(() => expect(bulatan()).toHaveLength(2));
    const boya = bulatan().find((b) => JSON.stringify(b.pos) === JSON.stringify(KOORDINAT["72.03.08.1001"]))!;
    await act(async () => {
      for (const f of boya.penangan.click ?? []) f();
    });
    const panggilan = () =>
      vi
        .mocked(globalThis.fetch)
        .mock.calls.map(([alamat]) => new URL(String(alamat), "http://uji"))
        .filter((u) => u.searchParams.get("apa") === "desa");
    await waitFor(() => expect(panggilan()).toHaveLength(1));
    const u = panggilan()[0];
    expect(u.searchParams.get("kode")).toBe("72.03.08.1001");
    expect(u.searchParams.get("kelompok")).toBe("Kewarisan");
    expect(u.searchParams.get("golongan") ?? "").toBe("");
  });

  it("label kecamatan pada jenis tunggal hanya menghitung jenis itu - termasuk desa tanpa titik", async () => {
    await gambarKewarisan();
    await ubahZum(10);
    await waitFor(() => {
      const html = labelKecamatan().map((l) => String((l.opsi.icon as { html: string }).html));
      expect(html).toHaveLength(1);
      expect(html[0]).toContain("5 perkara Kewarisan");
      expect(html[0]).toContain("2 dari desa tanpa titik");
    });
  });

  it("berpindah ke golongan tetap bisa - dan daftar desanya lalu memakai golongan itu", async () => {
    await gambarKewarisan();
    await ubahZum(10);
    fireEvent.click(screen.getByRole("button", { name: /^Semua perkara/ }));
    await waitFor(() => expect(bulatan()).toHaveLength(3));
    expect(window.localStorage.getItem(KUNCI_INGAT_GOLONGAN)).toBe("semua");
  });
});
