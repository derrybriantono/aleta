/**
 * Jadwal Sidang 22 Okt 2026 - baris alat diganti SATU tombol Menu:
 *   [Cari ...] [Pencarian lanjutan] [Cetak] [Menu v]
 * Baris pil ruang dihapus (fungsinya di pita ruang), saklar Sidang keliling
 * pindah ke AWAL pita ruang. Render nyata AletaEcourtSidang.
 */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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

const DAFTAR = [
  baris(),
  baris({ sidangId: "5002", perkaraId: "9002", nomorPerkara: "902/Pdt.G/2026/PA.Dgl", ruangan: "Sidang Keliling Labuan 21", majelisKode: "B" }),
];

function pasangFetch(opsi: { bolehUbah?: boolean } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      let isi: unknown = { ok: true, data: {} };
      if (/\/api\/aleta-ecourt\/sidang\?/.test(u)) {
        isi = { ok: true, data: { available: true, sidang: DAFTAR, kesiapan: {}, antrian: { terbaca: false, alasan: "", tanggal: [], peta: {} } } };
      } else if (/\/api\/aleta-ecourt\/sidang\/keliling/.test(u)) {
        isi = { ok: true, data: { keliling: { tanggal: HARI_INI, aktif: false, diputuskan: true, diubahNama: "", diubahPada: "" }, bolehUbah: opsi.bolehUbah ?? true } };
      } else if (/\/api\/aleta-ecourt\/sidang\/hakim-sidang/.test(u)) {
        isi = { ok: true, data: { pilihan: {}, calon: [], alasanCalon: "", bolehUbah: opsi.bolehUbah ?? true } };
      }
      return { ok: true, status: 200, json: async () => isi, text: async () => JSON.stringify(isi) } as unknown as Response;
    })
  );
}

async function gambarJadwal(props: Record<string, unknown> = {}) {
  const { AletaEcourtSidang } = await import("@/components/portal/aleta-ecourt-sidang");
  const hasil = render(createElement(AletaEcourtSidang as never, props));
  await waitFor(() => expect(screen.queryByText("901/Pdt.G/2026/PA.Dgl")).not.toBeNull(), { timeout: 15_000 });
  return hasil;
}

const bukaMenu = async () => userEvent.click(await screen.findByRole("button", { name: /^Menu$/ }));

beforeEach(() => {
  window.localStorage.clear();
  keadaan.portal.currentUser = { id: "u1", name: "Admin Uji", roleId: "admin" };
  pasangFetch();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Jadwal Sidang - Cetak dan Menu di baris pencarian", () => {
  it("urutan: kotak cari, Pencarian lanjutan, Cetak, Menu - dan Cetak tepat di samping Pencarian lanjutan", async () => {
    const { container } = await gambarJadwal({ bolehCetakRelaas: true });
    const cari = container.querySelector("[data-cari-pintar-sidang]") as HTMLElement;
    const lanjut = screen.getByRole("button", { name: /Pencarian lanjutan/ });
    const cetak = screen.getByRole("button", { name: /^Cetak$/ });
    const menu = screen.getByRole("button", { name: /^Menu$/ });
    const sebelum = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(sebelum(cari, lanjut)).toBe(true);
    expect(sebelum(lanjut, cetak)).toBe(true);
    expect(sebelum(cetak, menu)).toBe(true);
    // Satu baris yang sama dengan kotak cari.
    expect(cetak.closest(".flex-wrap")).toBe(lanjut.closest(".flex-wrap"));
    expect(menu.closest(".flex-wrap")).toBe(lanjut.closest(".flex-wrap"));
  }, 60_000);

  it("baris alat lama tiada: tombol-tombol alat tidak berdiri sendiri, dan tidak ada penciut baris alat", async () => {
    const { container } = await gambarJadwal({ bolehCetakRelaas: true });
    for (const nama of [/^Hitung skor$/, /^Layar antrian$/, /^Per panitera sidang$/, /^Cetak relaas$/, /^Penetapan kembali$/, /^Daftarkan ke antrian$/, /^Kasir$/, /^Kasir harian$/]) {
      expect(screen.queryByRole("button", { name: nama }), String(nama)).toBeNull();
    }
    expect(container.querySelector('button[title^="Sembunyikan tombol tindakan"]')).toBeNull();
  }, 60_000);
});

describe("Jadwal Sidang - isi Menu menurut peran", () => {
  it("admin: Hitung skor, Layar antrian, Cetak relaas (bila diteruskan), Daftarkan ke antrian, Kasir; ikon-ikon dipertahankan", async () => {
    await gambarJadwal({ bolehCetakRelaas: true });
    await bukaMenu();
    const menu = await screen.findByRole("menu");
    for (const nama of [/Hitung skor/, /Layar antrian/, /Cetak relaas/, /Daftarkan ke antrian/]) {
      expect(within(menu).getByRole("menuitem", { name: nama }), String(nama)).toBeTruthy();
    }
    // Setiap butir berikon (sama dengan tombol lamanya).
    for (const butir of within(menu).getAllByRole("menuitem")) expect(butir.querySelector("svg"), butir.textContent ?? "").not.toBeNull();
  }, 60_000);

  it("tanpa bolehCetakRelaas: butir Cetak relaas tidak ada", async () => {
    await gambarJadwal();
    await bukaMenu();
    const menu = await screen.findByRole("menu");
    expect(within(menu).queryByRole("menuitem", { name: /Cetak relaas/ })).toBeNull();
    expect(within(menu).getByRole("menuitem", { name: /Hitung skor/ })).toBeTruthy();
  }, 60_000);

  it("Layar antrian membentangkan tautan di dalam menu tanpa menutupnya", async () => {
    await gambarJadwal();
    await bukaMenu();
    await userEvent.click(await screen.findByRole("menuitem", { name: /Layar antrian/ }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("Untuk pihak")).toBeTruthy();
    expect(within(menu).getByText("Untuk operator")).toBeTruthy();
    expect(within(menu).getAllByRole("menuitem").some((m) => m.matches("a[target='_blank']"))).toBe(true);
  }, 60_000);

  it("Hitung skor memuat ulang dengan skor menyala, Escape menutup menu", async () => {
    await gambarJadwal();
    await bukaMenu();
    await userEvent.click(await screen.findByRole("menuitem", { name: /Hitung skor/ }));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await bukaMenu();
    expect(await screen.findByRole("menuitem", { name: /Skor: nyala/ })).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  }, 60_000);

  it("Menu memakai latar bg-card (bukan bg-popover)", async () => {
    await gambarJadwal();
    await bukaMenu();
    const menu = await screen.findByRole("menu");
    expect(menu.className).toContain("bg-card");
    expect(menu.className).not.toContain("bg-popover");
  }, 60_000);

  it("bila tak satu pun butir diizinkan, tombol Menu tidak tampil (mode alamat tanpa Cetak relaas)", async () => {
    await gambarJadwal({ modeUrl: true, bolehCetakRelaas: false });
    expect(screen.queryByRole("button", { name: /^Menu$/ })).toBeNull();
  }, 60_000);
});

describe("Jadwal Sidang - pil ruang lama dihapus, saklar Sidang keliling di awal pita ruang", () => {
  it("tidak ada baris pil ruang; saringan ruang tetap lewat rincian pil di pita", async () => {
    const { container } = await gambarJadwal();
    await waitFor(() => expect(container.querySelector("[data-pita-ruang-sidang]")).not.toBeNull());
    expect(container.querySelector("[data-saring-ruang]")).toBeNull();
    expect(container.querySelector("button[data-ruang]")).toBeNull();
    const pita = container.querySelector("[data-pita-ruang-sidang]") as HTMLElement;
    expect(pita.querySelectorAll("[data-pil-ruang]").length).toBe(2);
    await userEvent.click(within(pita).getByRole("button", { name: "Rincian Sidang Keliling Labuan 21" }));
    await userEvent.click(await screen.findByRole("button", { name: "Saring ruang ini" }));
    await waitFor(() => expect(screen.queryByText("901/Pdt.G/2026/PA.Dgl")).toBeNull());
    expect(screen.queryByText("902/Pdt.G/2026/PA.Dgl")).not.toBeNull();
    // Menekan sekali lagi memulihkan semua ruang.
    await userEvent.click(within(pita).getByRole("button", { name: "semua ruang" }));
    await waitFor(() => expect(screen.queryByText("901/Pdt.G/2026/PA.Dgl")).not.toBeNull());
  }, 60_000);

  it("saklar Sidang keliling berada di AWAL pita, sebelum ringkasan ruang dan pil", async () => {
    const { container } = await gambarJadwal();
    const pita = (await waitFor(() => {
      const el = container.querySelector("[data-pita-ruang-sidang]") as HTMLElement | null;
      expect(el).not.toBeNull();
      return el as HTMLElement;
    })) as HTMLElement;
    const saklar = await waitFor(() => {
      const el = pita.querySelector("[data-saklar-keliling]") as HTMLElement | null;
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect(pita.firstElementChild?.contains(saklar)).toBe(true);
    expect(saklar.textContent).toContain("Sidang keliling");
    const ringkasan = Array.from(pita.querySelectorAll("span")).find((s) => /ruang · \d+ perkara/.test(s.textContent ?? ""));
    expect(ringkasan).toBeTruthy();
    expect(Boolean(saklar.compareDocumentPosition(ringkasan as Node) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    // Tidak lagi di baris cari / Menu.
    expect(screen.getByRole("button", { name: /^Menu$/ }).closest("div")?.querySelector("[data-saklar-keliling]")).toBeNull();
  }, 60_000);
});
