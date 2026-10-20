/**
 * JADWAL SIDANG LEWAT TAUTAN RAHASIA (/jadwal/<rahasia>, 20 Okt 2026) - sisi layar.
 *
 * Membuktikan:
 *  1. halaman memuat komponen Jadwal Sidang yang SAMA (mode alamat), tanpa
 *     salinan logika, dan TANPA masuk akun;
 *  2. hanya tombol yang diizinkan yang tampil: tunda | putus, Rincian, Cetak -
 *     sedangkan Tampilan, Hitung skor, Layar antrian, Ringkas/Lengkap, Ciutkan,
 *     Pencarian lanjutan, Daftarkan ke antrian TIDAK tampil;
 *  3. tag/lencana tetap tampil (ghaib, prodeo, ...);
 *  4. rahasia salah/dicabut/ditolak server: kartu penolakan, tanpa jadwal;
 *  5. rahasia dipasang di header permintaan komponen, bukan di alamat API;
 *  6. parameter ?tanggal= ?ruang= ?majelis=.
 * Sisi server (hash, jaringan kantor, jejak, batas laju) di tautan-jadwal-20okt.test.ts.
 * Nomor perkara dan nama di sini karangan.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ALAT_ATAS_DIIZINKAN_URL,
  HEADER_TAUTAN_JADWAL,
  TOMBOL_BARIS_DIIZINKAN_URL,
  bacaParameterJadwal,
  cocokkanRuang,
  pasangRahasiaTautanPadaFetch,
  susunPencarianJadwal,
  tampilanUrlJadwal,
  tanggalIsoSah,
} from "@/lib/jadwal-tampil-url";
import { SAKLAR_TAMPILAN, tampil } from "@/lib/tampilan-antrian-sidang";

const SRC = path.join(process.cwd(), "src");
const baca = (rel: string) => readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");

// ============================================================================
// PALSU
// ============================================================================
const keadaan = vi.hoisted(() => ({
  portal: {
    institutionIdentity: { courtName: "PENGADILAN AGAMA DONGGALA", logoUrl: "" },
    currentUser: { id: "u1", name: "Admin Uji", roleId: "admin" } as Record<string, unknown> | null,
    currentUserId: "u1" as string | null,
    positions: [] as unknown[],
    theme: "dark",
    setTheme: () => undefined,
  },
  rahasia: undefined as string | undefined,
}));
vi.mock("@/lib/app-state", async () => {
  const React = await import("react");
  const Konteks = React.createContext<typeof keadaan.portal | null>(null);
  return {
    usePortal: () => React.useContext(Konteks) ?? keadaan.portal,
    // Pembungkus palsu: menimpa pengguna aktif seperti aslinya.
    KonteksPenggunaTautan: ({ pengguna, children }: { pengguna: Record<string, unknown>; children: unknown }) =>
      React.createElement(Konteks.Provider, { value: { ...keadaan.portal, currentUser: pengguna, currentUserId: String(pengguna.id) } }, children as never),
  };
});
vi.mock("next/link", () => ({
  default: ({ href, children, ...sisa }: { href: string; children: unknown }) => createElement("a", { href, ...sisa }, children as never),
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ rahasia: keadaan.rahasia ? [keadaan.rahasia] : undefined }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/jadwal",
}));

const HARI_INI = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();

function baris(ubah: Record<string, unknown> = {}) {
  return {
    sidangId: "5001",
    perkaraId: "9001",
    nomorPerkara: "901/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Cerai Gugat",
    alurPerkaraId: 1,
    jenisPerkaraId: 347,
    sudahPutus: false,
    tanggalPutusan: "",
    statusPutusan: "",
    tanggalMinutasi: "",
    tanggalBht: "",
    tanggalSidang: `${HARI_INI}T00:00:00`,
    jamSidang: "09:00",
    agenda: "Pembuktian Penggugat",
    ruangan: "Ruang Sidang 1",
    ditunda: false,
    alasanDitunda: "",
    tanggalSidangBerikut: "",
    urutanSidang: 2,
    dihadiriOleh: 1,
    adaBas: false,
    durasi: null,
    pihak: { penggugat: ["Siti Karangan"], tergugat: ["Budi Karangan"] },
    panggilan: { hadirSebelumnya: 1, wajibDipanggil: [], belumDipanggil: 0, retur: 0, aman: true },
    putusanEcourt: null,
    majelisKode: "A",
    majelisNama: "Hakim Karangan",
    paniteraNama: "PP Karangan",
    jurusitaNama: "JS Karangan",
    penandaPerkara: { ghaib: false, prodeo: true },
    ...ubah,
  };
}

const DAFTAR = [
  baris(),
  baris({
    sidangId: "5002",
    perkaraId: "9002",
    nomorPerkara: "902/Pdt.G/2026/PA.Dgl",
    ruangan: "Ruang Sidang 2",
    majelisKode: "B",
    penandaPerkara: { ghaib: true, prodeo: false },
  }),
];

type Penolakan = { status: number; pesan: string };
function pasangFetch(opsi: { daftar?: unknown[]; sesi?: Penolakan } = {}) {
  const panggilan: Array<{ url: string; header: Record<string, string> }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      panggilan.push({ url: u, header: Object.fromEntries(new Headers(init?.headers).entries()) });
      let isi: unknown = { ok: true, data: {} };
      let status = 200;
      if (/\/api\/jadwal-tautan\/sesi/.test(u)) {
        if (opsi.sesi) {
          status = opsi.sesi.status;
          isi = { ok: false, error: { message: opsi.sesi.pesan } };
        } else {
          isi = { ok: true, data: { nama: "Meja PP Ruang 1", berlakuSampai: "", pengguna: { id: "usr-panitera", name: "Panitera Karangan", roleId: "panitera", positionId: "pos-panitera", additionalRoleIds: [] } } };
        }
      } else if (/\/api\/aleta-ecourt\/sidang\?/.test(u)) {
        isi = { ok: true, data: { available: true, sidang: opsi.daftar ?? DAFTAR, kesiapan: {}, antrian: { terbaca: false, alasan: "", tanggal: [], peta: {} } } };
      }
      return { ok: status < 400, status, json: async () => isi, text: async () => JSON.stringify(isi) } as unknown as Response;
    })
  );
  return panggilan;
}

async function gambarJadwal(props: Record<string, unknown> = {}, tunggu = "901/Pdt.G/2026/PA.Dgl") {
  const { AletaEcourtSidang } = await import("@/components/portal/aleta-ecourt-sidang");
  const hasil = render(createElement(AletaEcourtSidang as never, { modeUrl: true, ...props }));
  await waitFor(() => expect(screen.queryByText(tunggu)).not.toBeNull(), { timeout: 15_000 });
  return hasil;
}

/** Tombol yang TERLIHAT: yang berada di dalam pembungkus berkelas hidden tidak dihitung. */
const teksTombol = (wadah: HTMLElement) =>
  Array.from(wadah.querySelectorAll("button"))
    .filter((b) => b.closest(".hidden") === null)
    .map((b) => `${b.textContent ?? ""}|${b.getAttribute("aria-label") ?? ""}`.trim());

beforeEach(() => {
  window.localStorage.clear();
  keadaan.portal.currentUser = { id: "u1", name: "Admin Uji", roleId: "admin" };
  keadaan.rahasia = undefined;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ============================================================================
// DAFTAR IZIN (murni)
// ============================================================================
describe("daftar izin tampilan alamat", () => {
  const pilihan = tampilanUrlJadwal();

  it("tombol baris: hanya tunda | putus, mediator, Court Calendar, dan tombol kolom kanan", () => {
    const alat = SAKLAR_TAMPILAN.filter((x) => x.kelompok === "alat").map((x) => x.kunci);
    for (const k of alat) {
      expect(tampil(pilihan, k), k).toBe(TOMBOL_BARIS_DIIZINKAN_URL.includes(k));
    }
    for (const k of ["tombol-tunda-putus", "tombol-mediator", "court-calendar", "tombol-status-perkara", "pertanyaan-saksi", "tombol-ruang-sidang", "tombol-selesai-sidang", "tunjuk-konseptor", "keterangan-perkara"]) {
      expect(tampil(pilihan, k), k).toBe(true);
    }
    // bukan yang dimaksud: memanggil, mengambil antrian, menarik e-Court; Blangko membuka halaman yang menuntut akun
    for (const k of ["panggil-saksi", "ambil-antrian", "tarik-belum-upload", "tombol-blangko"]) expect(tampil(pilihan, k), k).toBe(false);
    for (const k of TOMBOL_BARIS_DIIZINKAN_URL) expect(SAKLAR_TAMPILAN.some((x) => x.kunci === k), k).toBe(true);
  });

  it("alat di atas tabel: hanya yang mencetak (dan dua keterangan pita ruang)", () => {
    for (const k of ALAT_ATAS_DIIZINKAN_URL) expect(SAKLAR_TAMPILAN.some((x) => x.kunci === k), k).toBe(true);
    const atas = SAKLAR_TAMPILAN.filter((x) => x.kelompok === "atas").map((x) => x.kunci);
    expect(atas.filter((k) => tampil(pilihan, k)).sort()).toEqual(["cetak", "kartu-ruang", "ringkasan-ruang", "tombol-cetak-relaas"]);
    for (const k of ["skor-kesiapan", "layar-antrian", "daftar-antrian", "tombol-kasir", "tombol-kasir-harian", "tombol-penetapan-kembali", "saring-ruang", "tombol-layar-penuh", "ciutkan-selesai"]) {
      expect(tampil(pilihan, k), k).toBe(false);
    }
  });

  it("SEMUA tag/lencana (penanda dan keterangan) menyala, kecuali yang bawaannya mati", () => {
    const tag = SAKLAR_TAMPILAN.filter((x) => x.kelompok === "penanda" || x.kelompok === "keterangan");
    expect(tag.length).toBeGreaterThan(30);
    for (const s of tag) {
      if (s.kunci === "tombol-blangko") continue; // tombol, bukan tag
      expect(tampil(pilihan, s.kunci), s.kunci).toBe(!s.bawaanMati);
    }
    for (const s of SAKLAR_TAMPILAN.filter((x) => x.wajib)) expect(tampil(pilihan, s.kunci), s.kunci).toBe(true);
  });
});

describe("parameter alamat", () => {
  it("?tanggal= sah dipakai, yang salah dibuang", () => {
    expect(bacaParameterJadwal("?tanggal=2026-10-21").tanggal).toBe("2026-10-21");
    expect(bacaParameterJadwal("tanggal=2026-02-30").tanggal).toBe("");
    expect(bacaParameterJadwal("?tanggal=besok").tanggal).toBe("");
    expect(bacaParameterJadwal("").tanggal).toBe("");
    expect(tanggalIsoSah("2028-02-29")).toBe(true);
    expect(tanggalIsoSah("2026-02-29")).toBe(false);
  });

  it("?ruang= dan ?majelis= dibaca; disusun kembali tanpa ruas kosong", () => {
    const p = bacaParameterJadwal(new URLSearchParams("tanggal=2026-10-21&ruang=Ruang%20Sidang%201&majelis=A"));
    expect(p).toEqual({ tanggal: "2026-10-21", ruang: "Ruang Sidang 1", majelis: "A" });
    expect(susunPencarianJadwal(p)).toBe("?tanggal=2026-10-21&ruang=Ruang+Sidang+1&majelis=A");
    expect(susunPencarianJadwal({})).toBe("");
  });

  it("nomor ruang cocok dengan nama ruang, tidak tertukar 1 dengan 11", () => {
    const daftar = [{ nama: "Ruang Sidang 1" }, { nama: "Ruang Sidang 11" }, { nama: "Ruang Sidang 2" }];
    expect(cocokkanRuang("1", daftar)).toBe("Ruang Sidang 1");
    expect(cocokkanRuang("11", daftar)).toBe("Ruang Sidang 11");
    expect(cocokkanRuang("ruang sidang 2", daftar)).toBe("Ruang Sidang 2");
    expect(cocokkanRuang("9", daftar)).toBeNull();
    expect(cocokkanRuang("", daftar)).toBeNull();
  });
});

describe("rahasia dipasang di header, bukan di alamat API", () => {
  it("hanya untuk /api/aleta-ecourt/ dan /api/jadwal-tautan/ satu asal; dapat dilepas", async () => {
    const asli = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", asli);
    const lepas = pasangRahasiaTautanPadaFetch("R".repeat(43), "/aleta");
    await window.fetch("/aleta/api/aleta-ecourt/sidang?dari=2026-10-20");
    await window.fetch("/aleta/api/jadwal-tautan/sesi");
    await window.fetch("/aleta/api/portal/session");
    await window.fetch("https://luar.example/aleta/api/aleta-ecourt/sidang");
    const header = (i: number) => new Headers((asli.mock.calls[i] as unknown as [string, RequestInit | undefined])[1]?.headers);
    expect(header(0).get(HEADER_TAUTAN_JADWAL)).toBe("R".repeat(43));
    expect(header(1).get(HEADER_TAUTAN_JADWAL)).toBe("R".repeat(43));
    expect(header(2).get(HEADER_TAUTAN_JADWAL)).toBeNull();
    expect(header(3).get(HEADER_TAUTAN_JADWAL)).toBeNull();
    expect(String((asli.mock.calls[0] as unknown[])[0])).not.toContain("RRRR");
    lepas();
    await window.fetch("/aleta/api/aleta-ecourt/sidang");
    expect(new Headers((asli.mock.calls[4] as unknown as [string, RequestInit | undefined])[1]?.headers).get(HEADER_TAUTAN_JADWAL)).toBeNull();
  });
});

// ============================================================================
// KOMPONEN: tombol dan alat yang tampil
// ============================================================================
describe("Jadwal Sidang mode alamat - komponen yang sama, tombol terbatas", () => {
  it("tombol tulis ada: tunda dan putus per baris, Rincian, Cetak; Cetak relaas hanya bila diteruskan", async () => {
    pasangFetch();
    const { container } = await gambarJadwal({ bolehCetakRelaas: true });
    expect(screen.getAllByRole("button", { name: /^Tunda sidang 901/ }).length).toBe(1);
    expect(screen.getAllByRole("button", { name: /^Catat putusan 901/ }).length).toBe(1);
    expect(screen.getAllByRole("button", { name: /^Tunda sidang 902/ }).length).toBe(1);
    expect(screen.getAllByRole("button", { name: "Rincian" }).length).toBe(2);
    expect(screen.getByRole("button", { name: /^Cetak$/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Cetak relaas/ })).toBeTruthy();
    expect(container.querySelector("[data-nama-tautan]")).not.toBeNull();
  }, 60_000);

  it("Cetak relaas tidak tampil bila tidak diteruskan (halaman tautan tidak meneruskannya)", async () => {
    pasangFetch();
    await gambarJadwal({ bolehCetakRelaas: false });
    expect(screen.queryByRole("button", { name: /Cetak relaas/ })).toBeNull();
    expect(screen.getByRole("button", { name: /^Cetak$/ })).toBeTruthy();
  }, 60_000);

  it("alat kepala selain cetak TIDAK tampil", async () => {
    pasangFetch();
    const { container } = await gambarJadwal({ bolehCetakRelaas: true });
    const tombol = teksTombol(container).join(" # ");
    for (const dilarang of [
      "Tampilan", "Ringkas", "Lengkap", "Ciutkan", "Kendali", "Hitung skor", "Skor: nyala", "Layar antrian",
      "Pencarian lanjutan", "Daftarkan ke antrian", "Perkara saya", "Semua perkara", "Tampilkan", "Layar penuh", "Penetapan", "Kasir", "Blangko", "Tautan jadwal",
    ]) {
      expect(tombol, dilarang).not.toContain(dilarang);
    }
    expect(container.querySelector("[data-tombol-tampilan-sidang]")).toBeNull();
    expect(container.querySelector("[data-saring-ruang]")).toBeNull();
    const cari = container.querySelector("[data-cari-pintar-sidang]") as HTMLElement | null;
    expect(cari === null || cari.closest(".hidden") !== null).toBe(true);
    expect(container.querySelector('button[title="Sembunyikan tombol tindakan supaya daftar sidang lebih panjang"]')).toBeNull();
    expect(screen.getByRole("button", { name: /^Cetak$/ }).closest(".hidden")).toBeNull();
  }, 60_000);

  it("nomor perkara tidak menjadi tombol (jalannya menuntut akun) dan nama tidak dapat dipanggil", async () => {
    pasangFetch();
    const { container } = await gambarJadwal();
    expect(screen.queryByTitle(/^Buka status perkara/)).toBeNull();
    expect(screen.queryByTitle(/^Tunda atau putus sidang/)).toBeNull();
    expect(container.querySelector("[data-nama-panggil]")).toBeNull();
  }, 60_000);

  it("pemilih tanggal sederhana: sebelum, sesudah, hari ini; tanpa rentang dan kalender", async () => {
    pasangFetch();
    const { container } = await gambarJadwal();
    expect(screen.getByRole("button", { name: "Hari sebelumnya" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hari berikutnya" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hari ini" })).toBeTruthy();
    expect(container.querySelectorAll('input[type="date"]').length).toBe(1);
    expect(screen.queryByRole("button", { name: "Pilih tanggal dari kalender" })).toBeNull();
  }, 60_000);

  it("SEMUA tag tetap terlihat: prodeo, ghaib; deret kotak keadaan tetap dan tidak dapat diciutkan", async () => {
    pasangFetch();
    const { container } = await gambarJadwal();
    expect(container.textContent).toMatch(/Prodeo/i);
    expect(container.textContent).toMatch(/Ghaib/i);
    expect(container.querySelector('[aria-label="Ciutkan penanda"]')).toBeNull();
    expect(container.querySelector('[aria-label="Bentangkan penanda"]')).toBeNull();
    expect(container.textContent).toMatch(/Belum ditunda|Perlu diperiksa|Sudah putus|Belum dipanggil|Dipanggil/);
  }, 60_000);

  it("kontras: Jadwal Sidang biasa tetap punya Tampilan, Ringkas/Lengkap, Ciutkan, dan tautan ke pengaturan bagi admin", async () => {
    pasangFetch();
    const { AletaEcourtSidang } = await import("@/components/portal/aleta-ecourt-sidang");
    const { container } = render(createElement(AletaEcourtSidang as never, { bolehKelolaTautan: true }));
    await waitFor(() => expect(screen.queryByText("901/Pdt.G/2026/PA.Dgl")).not.toBeNull(), { timeout: 15_000 });
    const tombol = teksTombol(container).join(" # ");
    for (const ada of ["Tampilan", "Ringkas", "Lengkap", "Ciutkan"]) expect(tombol, ada).toContain(ada);
    const tautan = container.querySelector("a[data-tautan-jadwal]") as HTMLAnchorElement;
    expect(tautan.getAttribute("href")).toMatch(/\/admin\/akses-publik$/);
  }, 60_000);

  it("tautan ke pengaturan tidak tampil tanpa hak", async () => {
    pasangFetch();
    const { AletaEcourtSidang } = await import("@/components/portal/aleta-ecourt-sidang");
    const { container } = render(createElement(AletaEcourtSidang as never, {}));
    await waitFor(() => expect(screen.queryByText("901/Pdt.G/2026/PA.Dgl")).not.toBeNull(), { timeout: 15_000 });
    expect(container.querySelector("a[data-tautan-jadwal]")).toBeNull();
  }, 60_000);

  it("hak peran tetap: akun yang diwakili tanpa hak tulis tidak melihat tunda | putus", async () => {
    keadaan.portal.currentUser = { id: "u9", name: "Kasir Uji", roleId: "kasir" };
    pasangFetch();
    await gambarJadwal();
    expect(screen.queryByRole("button", { name: /^Tunda sidang/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Catat putusan/ })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Rincian" }).length).toBe(2);
  }, 60_000);

  it("?tanggal= memuat tanggal itu; ?ruang= menyaring", async () => {
    const panggilan = pasangFetch();
    await gambarJadwal({ awal: { tanggal: "2026-10-21", ruang: "2", majelis: "" } }, "902/Pdt.G/2026/PA.Dgl");
    expect(panggilan.some((p) => /dari=2026-10-21/.test(p.url) && /sampai=2026-10-21/.test(p.url))).toBe(true);
    await waitFor(() => expect(screen.queryByText("901/Pdt.G/2026/PA.Dgl")).toBeNull());
    expect(screen.getByText("902/Pdt.G/2026/PA.Dgl")).toBeTruthy();
  }, 60_000);

  it("?majelis=b (huruf kecil) menyaring ke majelis B", async () => {
    pasangFetch();
    await gambarJadwal({ awal: { tanggal: "", ruang: "", majelis: "b" } }, "902/Pdt.G/2026/PA.Dgl");
    await waitFor(() => expect(screen.queryByText("901/Pdt.G/2026/PA.Dgl")).toBeNull());
    expect(screen.getByText("902/Pdt.G/2026/PA.Dgl")).toBeTruthy();
  }, 60_000);

  it("alamat di bilah peramban ikut tanggal yang dilihat", async () => {
    pasangFetch();
    window.history.replaceState(null, "", "/jadwal/RAHASIA");
    await gambarJadwal();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Hari berikutnya" }));
    });
    await waitFor(() => expect(window.location.search).toMatch(/^\?tanggal=\d{4}-\d{2}-\d{2}$/));
    expect(window.location.pathname).toBe("/jadwal/RAHASIA"); // rahasia di jalur tidak terhapus
  }, 60_000);
});

// ============================================================================
// HALAMAN: memeriksa rahasia di server, tanpa masuk akun
// ============================================================================
describe("halaman /jadwal/<rahasia>", () => {
  async function gambarHalaman(pencarian = "") {
    window.history.replaceState(null, "", `/jadwal/${keadaan.rahasia ?? ""}${pencarian}`);
    const { default: Halaman } = await import("@/app/jadwal/[[...rahasia]]/page");
    return render(createElement(Halaman));
  }

  it("rahasia sah: memasang komponen yang sama dalam mode alamat, tanpa menu samping dan tanpa login", async () => {
    keadaan.rahasia = "A".repeat(43);
    keadaan.portal.currentUser = null; // tidak ada sesi akun
    const panggilan = pasangFetch();
    const { container } = await gambarHalaman("?tanggal=2026-10-21&ruang=2&majelis=B");
    await waitFor(() => expect(screen.queryByText("902/Pdt.G/2026/PA.Dgl")).not.toBeNull(), { timeout: 20_000 });
    // disaring ke ruang 2 dan majelis B; nama tautan tampil
    expect(screen.queryByText("901/Pdt.G/2026/PA.Dgl")).toBeNull();
    expect(container.querySelector("[data-nama-tautan]")?.textContent).toBe("Tautan: Meja PP Ruang 1");
    expect(container.querySelector("nav")).toBeNull();
    // tombol sesuai akun yang diwakili (panitera), bukan akun peramban (kosong)
    expect(screen.getAllByRole("button", { name: /^Tunda sidang 902/ }).length).toBe(1);
    expect(screen.queryByRole("button", { name: /Cetak relaas/ })).toBeNull();
    expect(screen.queryByTitle(/^Buka status perkara/)).toBeNull();
    // rahasia dikirim di HEADER (pemeriksaan dan permintaan jadwal), tidak di alamat API
    const sesi = panggilan.find((p) => /jadwal-tautan\/sesi/.test(p.url))!;
    expect(sesi.header[HEADER_TAUTAN_JADWAL]).toBe("A".repeat(43));
    const jadwal = panggilan.find((p) => /api\/aleta-ecourt\/sidang\?/.test(p.url))!;
    expect(jadwal.header[HEADER_TAUTAN_JADWAL]).toBe("A".repeat(43));
    expect(jadwal.url).toMatch(/dari=2026-10-21/);
    for (const p of panggilan) expect(p.url).not.toContain("AAAA");
    const sumber = baca("app/jadwal/[[...rahasia]]/page.tsx");
    expect(sumber).toContain("@/components/portal/aleta-ecourt-sidang");
    expect(sumber).not.toContain("PortalShellV2");
    expect(sumber).not.toContain("/login");
  }, 60_000);

  it.each([
    [401, "Tautan ini tidak berlaku."],
    [401, "Tautan ini sudah dicabut oleh admin."],
    [401, "Masa berlaku tautan ini sudah berakhir."],
    [403, "Tautan jadwal sidang hanya dapat dibuka dari jaringan kantor."],
    [403, "Tautan jadwal sidang sedang dimatikan oleh admin."],
  ])("ditolak server (%i): kartu penolakan dengan kalimat biasa, tanpa jadwal", async (status, pesan) => {
    keadaan.rahasia = "B".repeat(43);
    const panggilan = pasangFetch({ sesi: { status, pesan } });
    const { container } = await gambarHalaman();
    await waitFor(() => expect(container.querySelector("[data-tautan-ditolak]")).not.toBeNull());
    expect(container.textContent).toContain(pesan);
    expect(screen.queryByText("901/Pdt.G/2026/PA.Dgl")).toBeNull();
    expect(container.querySelector("table")).toBeNull();
    // tidak satu pun permintaan jadwal dikirim
    expect(panggilan.some((p) => /api\/aleta-ecourt\/sidang/.test(p.url))).toBe(false);
  });

  it("alamat tanpa rahasia: ditolak tanpa memanggil server", async () => {
    keadaan.rahasia = undefined;
    const panggilan = pasangFetch();
    const { container } = await gambarHalaman();
    await waitFor(() => expect(container.querySelector("[data-tautan-ditolak]")).not.toBeNull());
    expect(panggilan.length).toBe(0);
    expect(container.querySelector("table")).toBeNull();
  });
});
