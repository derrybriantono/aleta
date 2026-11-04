// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AletaEcourtMediasi } from "@/components/portal/aleta-ecourt-mediasi";
import { KUNCI_ANTARMUKA_MEDIASI, KUNCI_ANTARMUKA_SIDANG } from "@/lib/jadwal-baru";

import { pakaiAntarmukaLama } from "./antarmuka-lama";

/**
 * 4 Nov 2026 - TAMPILAN BARU Jadwal Sidang dan Jadwal Mediasi, digambar sungguhan (data rekaan).
 * Yang dibuktikan: bilah lekat tanpa nama pengguna dan tanpa Tampilkan/Pencarian lanjutan, kartu berlajur,
 * pita bawah, kotak cari berpil yang menyaring, dan pilihan Tampilan lama / baru yang saling mengembalikan.
 */

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
vi.mock("@/lib/app-state", async (asli) => {
  const mod = await asli<typeof import("@/lib/app-state")>();
  return { ...mod, usePortal: () => keadaan.portal };
});
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

function barisSidang(ubah: Record<string, unknown> = {}) {
  return {
    sidangId: "5001",
    perkaraId: "9001",
    nomorPerkara: "901/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Cerai Gugat",
    alurPerkaraId: 15,
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
    majelisNama: "Hakim Satu, S.H., M.H., Hakim Dua, S.Ag.",
    paniteraNama: "PP Karangan",
    jurusitaNama: "JS Karangan",
    penandaPerkara: { ghaib: false, prodeo: false },
    ...ubah,
  };
}

const SIDANG = [
  barisSidang(),
  barisSidang({
    sidangId: "5002",
    perkaraId: "9002",
    nomorPerkara: "902/Pdt.G/2026/PA.Dgl",
    jamSidang: "10:30",
    ruangan: "Ruang Sidang 2",
    majelisKode: "B",
    majelisNama: "Hakim Tiga, S.H.",
    pihak: { penggugat: ["Dewi Rekaan"], tergugat: ["Eko Rekaan"] },
    ditunda: true,
    alasanDitunda: "Jawaban Tergugat",
    tanggalSidangBerikut: "2099-12-10T00:00:00",
    courtCalendar: [{ tanggal: "2099-12-17", agenda: "Pembuktian" }],
  }),
  barisSidang({
    sidangId: "5003",
    perkaraId: "9003",
    nomorPerkara: "903/Pdt.G/2026/PA.Dgl",
    jamSidang: "13:15",
    sudahPutus: true,
    tanggalPutusan: HARI_INI,
    statusPutusan: "Dikabulkan",
    agenda: "Putusan",
    pihak: { penggugat: ["Fani Rekaan"], tergugat: ["Gito Rekaan"] },
  }),
];

function pasangFetchSidang() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      let isi: unknown = { ok: true, data: {} };
      if (/\/api\/aleta-ecourt\/sidang\?/.test(u)) {
        isi = { ok: true, data: { available: true, sidang: SIDANG, kesiapan: {}, antrian: { terbaca: false, alasan: "", tanggal: [], peta: {} } } };
      } else if (/\/api\/aleta-ecourt\/sidang\/keliling/.test(u)) {
        isi = { ok: true, data: { keliling: { tanggal: HARI_INI, aktif: false, diputuskan: true, diubahNama: "", diubahPada: "" }, bolehUbah: true } };
      } else if (/\/api\/aleta-ecourt\/sidang\/hakim-sidang/.test(u)) {
        isi = { ok: true, data: { pilihan: {}, calon: [], alasanCalon: "", bolehUbah: true } };
      }
      return { ok: true, status: 200, json: async () => isi, text: async () => JSON.stringify(isi) } as unknown as Response;
    })
  );
}

async function gambarSidang(antarmuka: "baru" | "lama" = "baru") {
  window.localStorage.clear();
  pakaiAntarmukaLama(antarmuka);
  pasangFetchSidang();
  const { AletaEcourtSidang } = await import("@/components/portal/aleta-ecourt-sidang");
  const hasil = render(createElement(AletaEcourtSidang as never, { bolehKelolaTautan: true }));
  await waitFor(() => expect(screen.queryByText("901/Pdt.G/2026/PA.Dgl")).not.toBeNull(), { timeout: 20_000 });
  return hasil;
}

beforeEach(() => {
  keadaan.portal.currentUser = { id: "u1", name: "Admin Uji", roleId: "admin" };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  pakaiAntarmukaLama();
});

describe("Jadwal Sidang: tampilan baru", () => {
  it("bilah lekat: tanpa nama pengguna, tanpa Tampilkan dan Pencarian lanjutan, dengan ikon dan pilihan", async () => {
    const { container } = await gambarSidang();
    const bilah = container.querySelector("[data-bilah-jadwal]") as HTMLElement;
    expect(bilah).not.toBeNull();
    expect(bilah.className).toContain("sticky");
    expect(within(bilah).getByRole("heading", { name: "Jadwal Sidang" })).toBeTruthy();
    expect(screen.queryByText(/^Admin Uji/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Tampilkan" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Pencarian lanjutan/ })).toBeNull();
    for (const nama of ["Hari ini", "Rentang", "Saringan", "Saya", "Semua", "Ringkas", "Lengkap", "Tampilan", "Cetak", "Layar penuh", "Menu lain: tampilan lama atau baru, tautan jadwal, tunda otomatis"]) {
      expect(within(bilah).getByRole("button", { name: new RegExp(nama.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }), nama).toBeTruthy();
    }
    expect(within(bilah).getByRole("searchbox")).toBeTruthy();
    // tidak ada tabel: yang ada kartu berlajur
    expect(container.querySelector("table")).toBeNull();
    expect(container.querySelectorAll("article")).toHaveLength(3);
    expect(container.querySelector("[data-kepala-lajur]")).not.toBeNull();
  });

  it("satu tulisan ringkasan: ruang · perkara · diperbarui", async () => {
    const { container } = await gambarSidang();
    const t = container.querySelector('[data-s="tanggal-dan-jumlah"]') as HTMLElement;
    await waitFor(() => expect(t.textContent).toMatch(/2\s*ruang\s*·\s*3\s*perkara/));
  });

  it("urutan bawaan = nomor antrian (belum ada antrian: urutan jadwal), kartu memuat lajur dan pita bawah", async () => {
    const { container } = await gambarSidang();
    const kartu = Array.from(container.querySelectorAll("article")) as HTMLElement[];
    expect(kartu.map((k) => k.getAttribute("aria-label"))).toEqual(["901/Pdt.G/2026/PA.Dgl", "902/Pdt.G/2026/PA.Dgl", "903/Pdt.G/2026/PA.Dgl"]);
    const satu = kartu[0];
    expect(within(satu).getByText("Siti Karangan")).toBeTruthy();
    expect(within(satu).getByText("Cerai Gugat")).toBeTruthy();
    expect(satu.querySelector("[data-tahap-sidang]")).not.toBeNull();
    // pita bawah: Tunda | Putus + Konseptor + Keterangan + Rincian
    const pita = satu.querySelector("[data-pita-bawah]") as HTMLElement;
    expect(within(pita).getByRole("button", { name: /Tunda sidang 901/ })).toBeTruthy();
    expect(within(pita).getByRole("button", { name: /Catat putusan 901/ })).toBeTruthy();
    expect(within(pita).getByText("+ Konseptor")).toBeTruthy();
    expect(within(pita).getByText("+ Keterangan")).toBeTruthy();
    expect(within(pita).getByRole("button", { name: /Rincian/ })).toBeTruthy();
  });

  it("sidang yang sudah ditunda: baris Ditunda kuning + Rencana CC biru terpisah, peringatan karena tanggal beda, segmen read-only", async () => {
    const { container } = await gambarSidang();
    const dua = container.querySelectorAll("article")[1] as HTMLElement;
    const berikut = dua.querySelector("[data-sidang-berikutnya]") as HTMLElement;
    expect(within(berikut).getByText("Ditunda")).toBeTruthy();
    expect(within(berikut).getByText("Rencana CC")).toBeTruthy();
    expect(within(berikut).getByText("10 Des")).toBeTruthy();
    expect(within(berikut).getByText("17 Des")).toBeTruthy();
    expect(within(berikut).getByText(/Tanggal tunda berbeda dari Court Calendar/)).toBeTruthy();
    const pita = dua.querySelector("[data-pita-bawah]") as HTMLElement;
    expect(within(pita).getByText("Ditunda 10 Des")).toBeTruthy();
    expect(within(pita).queryByRole("button", { name: /Tunda sidang/ })).toBeNull();
  });

  it("sidang yang sudah putus: amar + tindak lanjut (Minutasi/Unggah), tanpa menebak PBT; BHT hanya perkiraan kontradiktoir", async () => {
    const { container } = await gambarSidang();
    const tiga = container.querySelectorAll("article")[2] as HTMLElement;
    expect(within(tiga).getByText("Dikabulkan")).toBeTruthy();
    const tl = tiga.querySelector("[data-tindak-lanjut]") as HTMLElement;
    expect(within(tl).getByText("Minutasi ✗")).toBeTruthy();
    expect(within(tl).getByText("Unggah ✗")).toBeTruthy();
    expect(within(tl).getByText(/Perkiraan BHT/)).toBeTruthy();
    expect(within(tl).queryByText(/PBT/)).toBeNull();
    expect(within(tiga).queryByText(/belum putus/)).toBeNull();
  });

  it("menekan Tunda/Putus membuka pencatat yang sudah ada (CatatHasilRingkas) lewat pemicu lama", async () => {
    const { container } = await gambarSidang();
    const satu = container.querySelectorAll("article")[0] as HTMLElement;
    const putus = within(satu).getByRole("button", { name: /Catat putusan 901/ });
    expect(putus.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(putus);
    await waitFor(() => expect(within(satu).getByRole("button", { name: /Catat putusan 901/ }).getAttribute("aria-pressed")).toBe("true"));
    fireEvent.click(within(satu).getByRole("button", { name: /Catat putusan 901/ }));
    await waitFor(() => expect(within(satu).getByRole("button", { name: /Catat putusan 901/ }).getAttribute("aria-pressed")).toBe("false"));
  });

  it("kotak cari berpil: saran per medan dengan jumlah, pilih = pil, pil menyaring, lepas pil mengembalikan", async () => {
    const { container } = await gambarSidang();
    const kotak = within(container.querySelector("[data-bilah-jadwal]") as HTMLElement).getByRole("searchbox");
    fireEvent.focus(kotak);
    fireEvent.change(kotak, { target: { value: "ruang sidang 2" } });
    const pilihan = within(screen.getByRole("listbox", { name: "Saran pencarian" })).getAllByRole("option");
    const ruang2 = pilihan.find((p) => p.textContent?.includes("Ruang Sidang 2"))!;
    expect(ruang2.textContent).toContain("Ruang");
    expect(ruang2.textContent).toMatch(/1$/);
    fireEvent.click(ruang2);
    await waitFor(() => expect(container.querySelectorAll("article")).toHaveLength(1));
    expect(container.querySelector("article")?.getAttribute("aria-label")).toBe("902/Pdt.G/2026/PA.Dgl");
    const pil = screen.getByRole("button", { name: /Ruang: Ruang Sidang 2/ });
    // kotak dikosongkan setelah memilih; ringkasan menyebut "1 dari 3"
    expect((kotak as HTMLInputElement).value).toBe("");
    fireEvent.click(pil);
    await waitFor(() => expect(container.querySelectorAll("article")).toHaveLength(3));
  });

  it("dua pil pada medan yang sama = ATAU; antarmedan = DAN", async () => {
    const { container } = await gambarSidang();
    const kotak = within(container.querySelector("[data-bilah-jadwal]") as HTMLElement).getByRole("searchbox");
    const pilih = (teks: string, medan: string) => {
      fireEvent.focus(kotak);
      fireEvent.change(kotak, { target: { value: `${medan}:${teks}` } });
      fireEvent.click(within(screen.getByRole("listbox")).getAllByRole("option")[0]);
    };
    pilih("Siti", "pihak");
    await waitFor(() => expect(container.querySelectorAll("article")).toHaveLength(1));
    pilih("Dewi", "pihak");
    await waitFor(() => expect(container.querySelectorAll("article")).toHaveLength(2));
    pilih("Ruang Sidang 2", "ruang");
    await waitFor(() => expect(container.querySelectorAll("article")).toHaveLength(1));
    expect(container.querySelector("article")?.getAttribute("aria-label")).toBe("902/Pdt.G/2026/PA.Dgl");
  });

  it("Enter pada kotak tanpa saran terpilih mencari ke SIPP (permintaan baru dengan kata yang diketik)", async () => {
    const { container } = await gambarSidang();
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const sebelum = fetchMock.mock.calls.length;
    const kotak = within(container.querySelector("[data-bilah-jadwal]") as HTMLElement).getByRole("searchbox");
    fireEvent.change(kotak, { target: { value: "kata-sipp" } });
    fireEvent.keyDown(kotak, { key: "Enter" });
    await waitFor(() => {
      const baru = fetchMock.mock.calls.slice(sebelum).map((c) => String(c[0]));
      expect(baru.some((u) => /\/api\/aleta-ecourt\/sidang\?/.test(u) && /kata-sipp/.test(decodeURIComponent(u)))).toBe(true);
    });
  });

  it("panel Saringan: menulis pil yang sama dan dapat disimpan", async () => {
    const { container } = await gambarSidang();
    fireEvent.click(screen.getByRole("button", { name: "Saringan" }));
    const panel = container.querySelector("[data-panel-saringan]") as HTMLElement;
    expect(panel).not.toBeNull();
    fireEvent.click(within(panel).getByRole("button", { name: /Ruang Sidang 1/ }));
    await waitFor(() => expect(container.querySelectorAll("article")).toHaveLength(2));
    fireEvent.change(within(panel).getByLabelText("Nama saringan yang akan disimpan"), { target: { value: "Ruang 1" } });
    fireEvent.click(within(panel).getByRole("button", { name: "Simpan saringan" }));
    const simpanan = JSON.parse(window.localStorage.getItem("aleta.jadwal-sidang.saringan-tersimpan") ?? "[]");
    expect(simpanan).toEqual([{ nama: "Ruang 1", pil: [{ medan: "ruang", nilai: "Ruang Sidang 1" }] }]);
  });

  it("kepala lajur: menekan Agenda mengurutkan; tekan lagi membalik; ketiga kembali ke urutan asal", async () => {
    const { container } = await gambarSidang();
    const urutan = () => Array.from(container.querySelectorAll("article")).map((a) => a.getAttribute("aria-label")!.slice(0, 3));
    const awal = urutan();
    const agenda = within(container.querySelector("[data-kepala-lajur]") as HTMLElement).getByRole("button", { name: /Agenda/ });
    const arah = () => agenda.closest("[aria-sort]")?.getAttribute("aria-sort");
    fireEvent.click(agenda);
    await waitFor(() => expect(arah()).toBe("ascending"));
    // "Pembuktian Penggugat" (901, 902; sama -> urutan asal terjaga) < "Putusan" (903)
    expect(urutan()).toEqual(["901", "902", "903"]);
    fireEvent.click(agenda);
    await waitFor(() => expect(arah()).toBe("descending"));
    expect(urutan()).toEqual(["903", "901", "902"]);
    fireEvent.click(agenda);
    await waitFor(() => expect(arah()).toBe("none"));
    expect(urutan()).toEqual(awal);
  });
});

describe("Jadwal Sidang: cadangan tampilan lama", () => {
  it("bawaan baru; pilih Tampilan lama dari menu ⋯ -> tabel lama muncul dan pilihan tersimpan; panel Tampilan mengembalikan", async () => {
    const { container } = await gambarSidang();
    expect(container.querySelector("table")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Menu lain: tampilan lama atau baru/ }));
    fireEvent.click(screen.getByRole("button", { name: "Tampilan lama" }));
    await waitFor(() => expect(container.querySelector("table")).not.toBeNull());
    expect(window.localStorage.getItem(KUNCI_ANTARMUKA_SIDANG)).toBe("lama");
    expect(container.querySelector("[data-bilah-jadwal]")).toBeNull();
    // fitur lama kembali: Tampilkan, Pencarian lanjutan
    expect(screen.getByRole("button", { name: "Tampilkan" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Pencarian lanjutan/ })).toBeTruthy();
    expect(container.querySelectorAll("tbody tr").length).toBeGreaterThanOrEqual(3);
    // kembali lewat panel Tampilan
    fireEvent.click(container.querySelector("[data-tombol-tampilan-sidang]") as HTMLElement);
    fireEvent.click(within(container.querySelector("[data-antarmuka-jadwal]") as HTMLElement).getByRole("button", { name: "Tampilan baru" }));
    await waitFor(() => expect(container.querySelector("table")).toBeNull());
    expect(window.localStorage.getItem(KUNCI_ANTARMUKA_SIDANG)).toBe("baru");
  });

  it("pilihan lama yang tersimpan dibaca saat layar dibuka", async () => {
    const { container } = await gambarSidang("lama");
    await waitFor(() => expect(container.querySelector("table")).not.toBeNull());
    expect(container.querySelector("article")).toBeNull();
  });

  it("pil yang masih terpasang tidak menyaring diam-diam di tampilan lama", async () => {
    const { container } = await gambarSidang();
    const kotak = within(container.querySelector("[data-bilah-jadwal]") as HTMLElement).getByRole("searchbox");
    fireEvent.focus(kotak);
    fireEvent.change(kotak, { target: { value: "ruang:ruang sidang 2" } });
    fireEvent.click(within(screen.getByRole("listbox")).getAllByRole("option")[0]);
    await waitFor(() => expect(container.querySelectorAll("article")).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: /Menu lain: tampilan lama atau baru/ }));
    fireEvent.click(screen.getByRole("button", { name: "Tampilan lama" }));
    await waitFor(() => expect(container.querySelectorAll("tbody tr").length).toBeGreaterThanOrEqual(3));
  });
});

// ---------------------------------------------------------------------------
// Jadwal Mediasi
// ---------------------------------------------------------------------------

const MEDIASI = (n: string, ubah: Record<string, unknown> = {}) => ({
  mediasiId: n,
  perkaraId: `7${n}`,
  nomorPerkara: `7${n}/Pdt.G/2026/PA.Dgl`,
  jenisPerkara: "Cerai Gugat",
  alurPerkaraId: 15,
  jenisPerkaraId: 347,
  tanggal: HARI_INI,
  jam: "09:00",
  sampaiJam: "",
  tempat: "Ruang Mediasi",
  dihadiri: "",
  ditunda: false,
  mediator: "Hakim Mediator, S.H.",
  statusMediator: "H",
  jenisMediasi: "",
  nomorSk: "SK-1",
  penetapanMediator: HARI_INI,
  laporanMediator: "",
  selesai: false,
  hasil: "",
  hasilTeks: "",
  lamaHari: null,
  tenggatPerma: "",
  sisaHariTenggat: 12,
  lewatTenggang: false,
  pihak: { penggugat: ["Andi Rekaan"], tergugat: ["Wati Rekaan"] },
  ...ubah,
});

function pasangFetchMediasi() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (alamat: string) => {
      const url = String(alamat);
      let data: unknown = { baris: [] };
      if (url.includes("/api/aleta-ecourt/jadwal-mediasi")) {
        data = { mediasi: [MEDIASI("1"), MEDIASI("2", { mediator: "Mediator Lain, S.Ag.", tempat: "Ruang B", sisaHariTenggat: -3, lewatTenggang: true })] };
      }
      if (url.includes("/api/aleta-ecourt/mediasi-status")) data = { available: true, ok: true, peta: {} };
      return { ok: true, status: 200, json: async () => ({ data }) } as unknown as Response;
    })
  );
}

async function gambarMediasi(antarmuka: "baru" | "lama" = "baru") {
  window.localStorage.clear();
  pakaiAntarmukaLama(antarmuka);
  pasangFetchMediasi();
  const hasil = render(createElement(AletaEcourtMediasi));
  await waitFor(() => expect(screen.queryAllByText("71/Pdt.G/2026/PA.Dgl").length).toBeGreaterThan(0), { timeout: 20_000 });
  return hasil;
}

describe("Jadwal Mediasi: tampilan baru dan cadangan lama", () => {
  it("bilah lekat tanpa Tampilkan, kartu berlajur, sorotan hari ini, tagihan laporan mediator", async () => {
    const { container } = await gambarMediasi();
    const bilah = container.querySelector("[data-bilah-jadwal]") as HTMLElement;
    expect(within(bilah).getByRole("heading", { name: "Jadwal Mediasi" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tampilkan" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Pencarian lanjutan/ })).toBeNull();
    expect(container.querySelector("table")).toBeNull();
    expect(container.querySelectorAll("article")).toHaveLength(2);
    expect(container.querySelector("[data-kepala-lajur]")).not.toBeNull();
    const sorot = container.querySelector("[data-sorotan-mediasi]") as HTMLElement;
    expect(within(sorot).getByText("Tagihan laporan mediator")).toBeTruthy();
    expect(within(sorot).getByText(/lewat 3 hari, laporan belum masuk/)).toBeTruthy();
    // yang lewat tenggang berbingkai merah
    const kedua = container.querySelectorAll("article")[1] as HTMLElement;
    expect(kedua.className).toContain("border-l-rose-500");
  });

  it("kotak cari berpil di Mediasi menyaring per medan Mediator", async () => {
    const { container } = await gambarMediasi();
    const kotak = within(container.querySelector("[data-bilah-jadwal]") as HTMLElement).getByRole("searchbox");
    fireEvent.focus(kotak);
    fireEvent.change(kotak, { target: { value: "mediator:lain" } });
    fireEvent.click(within(screen.getByRole("listbox")).getAllByRole("option")[0]);
    await waitFor(() => expect(container.querySelectorAll("article")).toHaveLength(1));
    expect(screen.getByRole("button", { name: /Mediator: Mediator Lain/ })).toBeTruthy();
  });

  it("pilih Tampilan lama dari menu ⋯: tabel dan tombol Tampilkan kembali; tersimpan", async () => {
    const { container } = await gambarMediasi();
    fireEvent.click(screen.getByRole("button", { name: /Menu lain: tampilan lama atau baru/ }));
    fireEvent.click(screen.getByRole("button", { name: "Tampilan lama" }));
    await waitFor(() => expect(container.querySelector("table")).not.toBeNull());
    expect(window.localStorage.getItem(KUNCI_ANTARMUKA_MEDIASI)).toBe("lama");
    expect(screen.getByRole("button", { name: "Tampilkan" })).toBeTruthy();
    fireEvent.click(container.querySelector("[data-tampilan-mediasi]") as HTMLElement);
    fireEvent.click(within(container.querySelector("[data-antarmuka-jadwal]") as HTMLElement).getByRole("button", { name: "Tampilan baru" }));
    await waitFor(() => expect(container.querySelector("table")).toBeNull());
    expect(window.localStorage.getItem(KUNCI_ANTARMUKA_MEDIASI)).toBe("baru");
  });

  it("tampilan lama yang tersimpan dibaca saat layar dibuka", async () => {
    const { container } = await gambarMediasi("lama");
    await waitFor(() => expect(container.querySelector("table")).not.toBeNull());
  });
});
