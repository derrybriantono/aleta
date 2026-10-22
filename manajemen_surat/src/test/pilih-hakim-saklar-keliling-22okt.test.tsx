/**
 * 22 Okt 2026 - menu "pilih hakim" (hakim per perkara + konseptor sementara)
 * TAMPIL HANYA bila saklar Sidang keliling tanggal itu MENYALA.
 *
 * Sebab lama: menu digerbangi oleh `kh.keliling` - catatan hari itu, yang tetap
 * ada (aktif=false) sesudah saklar dimatikan - bukan oleh `kh.keliling.aktif`.
 * Ditambah bacaan usang yang bisa mendarat sesudah jawaban penyimpanan.
 */
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const keadaan = vi.hoisted(() => ({
  portal: {
    institutionIdentity: { courtName: "PENGADILAN AGAMA DONGGALA", logoUrl: "" },
    currentUser: { id: "u1", name: "Admin Uji", roleId: "admin" } as Record<string, unknown> | null,
    currentUserId: "u1" as string | null,
    positions: [] as unknown[],
    theme: "dark",
    setTheme: () => undefined,
  },
}));
vi.mock("@/lib/app-state", () => ({ usePortal: () => keadaan.portal }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...sisa }: { href: string; children: unknown }) => createElement("a", { href, ...sisa }, children as never),
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/aleta-ecourt",
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
    penandaPerkara: { ghaib: false, prodeo: false },
    ...ubah,
  };
}

type Server = {
  aktif: boolean;
  bolehUbah: boolean;
  pilihan: Record<string, unknown>;
  panggilan: Array<{ metode: string; url: string; badan: unknown }>;
  /** Bila diisi, GET keliling BERIKUTNYA menunggu janji ini dan membawa keadaan saat ia berangkat. */
  tahanGetKeliling: Promise<void> | null;
};
let server: Server;

const CATATAN = (aktif: boolean) => ({ tanggal: HARI_INI, aktif, diputuskan: true, diubahNama: "Admin Uji", diubahPada: "" });

function pasangFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const metode = init?.method ?? "GET";
      server.panggilan.push({ metode, url: u, badan: init?.body ? JSON.parse(String(init.body)) : null });
      let isi: unknown = { ok: true, data: {} };
      if (/\/api\/aleta-ecourt\/sidang\?/.test(u)) {
        isi = { ok: true, data: { available: true, sidang: [baris()], kesiapan: {}, antrian: { terbaca: false, alasan: "", tanggal: [], peta: {} } } };
      } else if (/\/api\/aleta-ecourt\/sidang\/keliling/.test(u)) {
        if (metode === "PUT") {
          server.aktif = JSON.parse(String(init?.body)).aktif;
          isi = { ok: true, data: { keliling: CATATAN(server.aktif) } };
        } else {
          const saatBerangkat = server.aktif;
          const tahan = server.tahanGetKeliling;
          server.tahanGetKeliling = null;
          if (tahan) await tahan;
          isi = { ok: true, data: { keliling: CATATAN(tahan ? saatBerangkat : server.aktif), bolehUbah: server.bolehUbah } };
        }
      } else if (/\/api\/aleta-ecourt\/sidang\/hakim-sidang/.test(u)) {
        isi = {
          ok: true,
          data: { pilihan: server.pilihan, calon: [{ id: 1, kode: "HKM", nama: "Hakim Pilihan" }], alasanCalon: "", bolehUbah: server.bolehUbah },
        };
      }
      return { ok: true, status: 200, json: async () => isi, text: async () => JSON.stringify(isi) } as unknown as Response;
    })
  );
}

async function gambar() {
  const { AletaEcourtSidang } = await import("@/components/portal/aleta-ecourt-sidang");
  const hasil = render(createElement(AletaEcourtSidang as never, {}));
  await waitFor(() => expect(screen.queryByText("901/Pdt.G/2026/PA.Dgl")).not.toBeNull(), { timeout: 15_000 });
  return hasil;
}

const pemilih = () => screen.queryByRole("button", { name: /pilih hakim|ganti hakim/ });
const saklar = () => screen.getByRole("switch", { name: /Sidang keliling/ });

beforeEach(() => {
  window.localStorage.clear();
  keadaan.portal.currentUser = { id: "u1", name: "Admin Uji", roleId: "admin" };
  server = { aktif: true, bolehUbah: true, pilihan: {}, panggilan: [], tahanGetKeliling: null };
  pasangFetch();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("menu pilih hakim mengikuti saklar Sidang keliling", () => {
  it("saklar nyala -> tampil; dimatikan -> hilang seketika; muat ulang -> tetap hilang", async () => {
    const { unmount } = await gambar();
    await waitFor(() => expect(pemilih()).not.toBeNull());

    await userEvent.click(saklar());
    await waitFor(() => expect(pemilih()).toBeNull());
    expect(server.panggilan.some((p) => p.metode === "PUT" && (p.badan as { aktif?: boolean })?.aktif === false)).toBe(true);
    // Tidak menunggu bacaan ulang: hilangnya karena jawaban penyimpanan saja.
    expect(saklar().getAttribute("aria-checked")).toBe("false");

    // Muat ulang halaman = layar digambar ulang dari keadaan server (mati).
    unmount();
    await gambar();
    await waitFor(() => expect(screen.getByRole("switch", { name: /Sidang keliling/ }).getAttribute("aria-checked")).toBe("false"));
    expect(pemilih()).toBeNull();

    // Dinyalakan lagi -> tampil lagi.
    await userEvent.click(saklar());
    await waitFor(() => expect(pemilih()).not.toBeNull());
  }, 60_000);

  it("saklar yang tak pernah dinyalakan (mati sejak awal): menu tidak ada", async () => {
    server.aktif = false;
    await gambar();
    await waitFor(() => expect(screen.getByRole("switch", { name: /Sidang keliling/ })).toBeTruthy());
    expect(pemilih()).toBeNull();
  }, 60_000);

  it("peran non-admin (tanpa hak mengubah): menu tidak pernah tampil, walau saklar menyala", async () => {
    server.bolehUbah = false;
    keadaan.portal.currentUser = { id: "u2", name: "Kasir Uji", roleId: "kasir" };
    await gambar();
    await waitFor(() => expect(screen.getByRole("switch", { name: /Sidang keliling/ })).toBeTruthy());
    expect(screen.getByRole("switch", { name: /Sidang keliling/ }).hasAttribute("disabled")).toBe(true);
    expect(pemilih()).toBeNull();
  }, 60_000);

  it("hakim per perkara yang SUDAH tersimpan tidak dihapus saat saklar mati: tidak ada DELETE, menunya saja yang hilang", async () => {
    server.pilihan = {
      "9001": { perkaraId: "9001", hakimId: "1", hakimNama: "Hakim Pilihan", hakimKode: "HKM", anggotaMajelis: false },
    };
    await gambar();
    await waitFor(() => expect(screen.queryByRole("button", { name: /ganti hakim/ })).not.toBeNull());
    await userEvent.click(saklar());
    await waitFor(() => expect(pemilih()).toBeNull());
    expect(server.panggilan.some((p) => p.metode === "DELETE")).toBe(false);
    expect(server.panggilan.some((p) => p.metode === "PUT" && /hakim-sidang/.test(p.url))).toBe(false);
    // Datanya tetap ada di server dan tetap terbaca layar.
    expect(Object.keys(server.pilihan)).toEqual(["9001"]);
  }, 60_000);
});

describe("useKelilingHakim - bacaan usang tidak menyalakan kembali menu", () => {
  it("bacaan yang berangkat sebelum saklar dimatikan dan mendarat sesudahnya diabaikan", async () => {
    const { useKelilingHakim } = await import("@/components/portal/jadwal-keliling-hakim");
    const { result } = renderHook(() => useKelilingHakim({ tanggal: HARI_INI, nyala: true }));
    await waitFor(() => expect(result.current.kelilingAktif).toBe(true));
    expect(result.current.bolehHakim).toBe(true);

    let lepas: () => void = () => undefined;
    server.tahanGetKeliling = new Promise<void>((selesai) => {
      lepas = selesai;
    });
    // Bacaan ulang berangkat saat server masih MENYALA ...
    act(() => result.current.muatUlang());
    await waitFor(() => expect(server.tahanGetKeliling).toBeNull());
    // ... saklar dimatikan ...
    await act(async () => {
      await result.current.ubahKeliling(false);
    });
    expect(result.current.kelilingAktif).toBe(false);
    expect(result.current.bolehHakim).toBe(false);
    // ... lalu bacaan usang mendarat membawa aktif=true.
    await act(async () => {
      lepas();
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(result.current.kelilingAktif).toBe(false);
    expect(result.current.bolehHakim).toBe(false);
  }, 60_000);

  it("catatan hari yang sudah mati tidak menghidupkan bolehHakim (pilihan tetap terbaca)", async () => {
    server.aktif = false;
    server.pilihan = { "9001": { perkaraId: "9001", hakimId: "1", hakimNama: "Hakim Pilihan", hakimKode: "HKM", anggotaMajelis: false } };
    const { useKelilingHakim } = await import("@/components/portal/jadwal-keliling-hakim");
    const { result } = renderHook(() => useKelilingHakim({ tanggal: HARI_INI, nyala: true }));
    await waitFor(() => expect(result.current.keliling).not.toBeNull());
    expect(result.current.kelilingAktif).toBe(false);
    expect(result.current.bolehHakim).toBe(false);
    expect(Object.keys(result.current.pilihan)).toEqual(["9001"]);
  }, 60_000);
});
