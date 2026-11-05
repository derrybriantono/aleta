// @vitest-environment jsdom
/**
 * Layar kesiapan pindah ke ALETA ABT (5 Nov 2026, Tahap 8), data rekaan:
 *   - tiap jenis perkara tampil sebagai kartu dengan hasil pembanding dan jumlah cetak berdampingan berdampingan;
 *   - tombol Nyalakan hanya aktif pada jenis yang siap; yang belum terukur diberi tanda Belum terukur;
 *   - menyalakan meminta persetujuan dulu lalu mengirim pilihan; mematikan langsung;
 *   - hasil pengukuran dimuat dari berkas dan dikirim apa adanya (hanya angka);
 *   - bahasa sehari-hari tanpa kata teknis; tampil sebagai kartu di lebar HP (tanpa geser mendatar);
 *   - hanya Super Admin: peran lain melihat keterangan, bukan layar.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { KesiapanAletaAbt, keadaanKeluarga } from "@/components/portal/kesiapan-aleta-abt";
import { KELUARGA_PINDAH, nilaiKesiapan, type UkurKeluarga } from "@/lib/aleta-abt-pindah";

const ok = (data: unknown) => new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { "content-type": "application/json" } });
const galat = (pesan: string, status = 409) => new Response(JSON.stringify({ ok: false, error: { message: pesan } }), { status, headers: { "content-type": "application/json" } });

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const UKUR = (kunci: string, lain: Partial<UkurKeluarga> = {}): UkurKeluarga => ({ kunci, perkara: 5, naskah: 685, alinea: 90000, identik: 89000, dijelaskan: 1000, belumDijelaskan: 0, isianNilai: 5000, isianCocok: 5000, isianDijelaskan: 0, sebabBelum: "", ...lain });

function keadaan(lain: Record<string, unknown> = {}) {
  const kini = new Date("2026-11-20T00:00:00.000Z");
  const cukup = Array.from({ length: 31 }, () => ({ waktu: "2026-10-01T00:00:00.000Z", folder: "1 Perceraian CG", hasil: "hijau" as const, jawaban: "" as const }));
  const keluarga = KELUARGA_PINDAH.map((k) => {
    if (k.kunci === "cerai-gugat") return nilaiKesiapan(k, { ukur: UKUR(k.kunci), berdampingan: cukup, aktif: false }, kini);
    if (k.kunci === "cerai-talak") return nilaiKesiapan(k, { ukur: UKUR(k.kunci, { belumDijelaskan: 12 }), berdampingan: [], aktif: false }, kini);
    if (k.kunci === "kewarisan") return nilaiKesiapan(k, { ukur: UKUR(k.kunci), berdampingan: cukup.map((b) => ({ ...b, folder: "4b Kewarisan" })), aktif: true }, kini);
    if (k.kunci === "hibah") return nilaiKesiapan(k, { ukur: UKUR(k.kunci, { perkara: 0, naskah: 0, alinea: 0, sebabBelum: "tidak ada perkara jenis ini di salinan uji" }), berdampingan: [], aktif: false }, kini);
    return nilaiKesiapan(k, { ukur: null, berdampingan: [], aktif: false }, kini);
  });
  return {
    keluarga,
    laporan: { ada: true, dibuat: "2026-11-05T10:00:00Z", keterangan: "Naskah ALETA ABT dibandingkan dengan ABT pada salinan uji.", dimuatOleh: "Derry", dimuatPada: "2026-11-05T11:00:00Z" },
    dimatikanServer: false,
    menyala: 1,
    siap: 2,
    terukur: 4,
    ...lain,
  };
}

function stub(j: unknown, pos: (init: RequestInit) => Response = () => ok({})) {
  const f = vi.fn(async (_u: RequestInfo | URL, init?: RequestInit) => (init?.method === "POST" ? pos(init) : ok(j)));
  vi.stubGlobal("fetch", f);
  return f;
}

const kartu = (nama: string) => {
  const judul = screen.getAllByText(nama).find((e) => e.tagName === "H3" || e.className.includes("font-")) ?? screen.getByText(nama);
  return judul.closest("div[class*='rounded']") as HTMLElement;
};

describe("kartu tiap jenis perkara", () => {
  it("semua jenis tampil, dengan hasil pembanding dan jumlah cetak berdampingan", async () => {
    stub(keadaan());
    render(<KesiapanAletaAbt />);
    expect(await screen.findByText("Cerai gugat")).toBeTruthy();
    for (const k of KELUARGA_PINDAH) expect(screen.getAllByText(k.nama).length, k.nama).toBeGreaterThan(0);
    expect(screen.getByRole("progressbar", { name: "Cetak berdampingan Cerai gugat" }).getAttribute("aria-valuenow")).toBe("30");
    expect(screen.getByRole("progressbar", { name: "Naskah Cerai gugat sama dengan ABT" })).toBeTruthy();
    expect(screen.getAllByText("31 dari 30 cetak").length).toBeGreaterThan(0);
    expect(screen.getByText("1 menyala")).toBeTruthy();
    expect(screen.getByText("2 siap dinyalakan")).toBeTruthy();
    expect(screen.getByText("4 dari 33 sudah terukur")).toBeTruthy();
  });

  it("keadaan tiap kartu: Menyala, Siap dinyalakan, Belum siap, Belum terukur", () => {
    const j = keadaan();
    const per = Object.fromEntries(j.keluarga.map((k) => [k.kunci, keadaanKeluarga(k).teks]));
    expect(per["kewarisan"]).toBe("Menyala");
    expect(per["cerai-gugat"]).toBe("Siap dinyalakan");
    expect(per["cerai-talak"]).toBe("Belum siap");
    expect(per["hibah"]).toBe("Belum terukur");
    expect(per["wakaf"]).toBe("Belum terukur");
  });

  it("tombol Nyalakan hanya aktif pada yang siap; yang menyala punya tombol Matikan", async () => {
    stub(keadaan());
    render(<KesiapanAletaAbt />);
    await screen.findByText("Cerai gugat");
    const nyalakan = screen.getAllByRole("button", { name: "Nyalakan ALETA ABT" });
    expect(nyalakan).toHaveLength(KELUARGA_PINDAH.length - 1);
    expect(nyalakan.filter((b) => !(b as HTMLButtonElement).disabled)).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Matikan, kembali ke ABT" })).toHaveLength(1);
    expect((within(kartu("Cerai talak")).getByRole("button", { name: "Nyalakan ALETA ABT" }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(kartu("Penetapan mafqud")).getByRole("button", { name: "Nyalakan ALETA ABT" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText("Belum terukur: belum ada hasil pengukuran untuk jenis ini.").length).toBeGreaterThan(0);
  });
});

describe("menyalakan dan mematikan", () => {
  it("menyalakan meminta persetujuan dulu; bila ditolak tidak mengirim apa pun", async () => {
    const f = stub(keadaan());
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<KesiapanAletaAbt />);
    await screen.findByText("Cerai gugat");
    fireEvent.click(within(kartu("Cerai gugat")).getByRole("button", { name: "Nyalakan ALETA ABT" }));
    expect(window.confirm).toHaveBeenCalled();
    expect(f.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === "POST")).toBe(false);
  });

  it("disetujui: mengirim pilihan jenis dan memuat ulang", async () => {
    const f = stub(keadaan());
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<KesiapanAletaAbt />);
    await screen.findByText("Cerai gugat");
    fireEvent.click(within(kartu("Cerai gugat")).getByRole("button", { name: "Nyalakan ALETA ABT" }));
    await waitFor(() => expect(f.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === "POST")).toBe(true));
    const kirim = f.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "POST")!;
    expect(JSON.parse(String((kirim[1] as RequestInit).body))).toEqual({ tindakan: "saklar", keluarga: "cerai-gugat", aktif: true });
    expect(await screen.findByText("Cerai gugat: ALETA ABT dinyalakan.", {}, { timeout: 8000 })).toBeTruthy();
  });

  it("server menolak karena syarat: alasannya tampil apa adanya", async () => {
    stub(keadaan(), () => galat("Saklar Cerai gugat belum dapat dinyalakan. Baru 12 cetak dibandingkan; kurang 18."));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<KesiapanAletaAbt />);
    await screen.findByText("Cerai gugat");
    fireEvent.click(within(kartu("Cerai gugat")).getByRole("button", { name: "Nyalakan ALETA ABT" }));
    expect(await screen.findByText("Saklar Cerai gugat belum dapat dinyalakan. Baru 12 cetak dibandingkan; kurang 18.")).toBeTruthy();
  });

  it("mematikan langsung, tanpa persetujuan", async () => {
    const f = stub(keadaan());
    const konfirmasi = vi.spyOn(window, "confirm");
    render(<KesiapanAletaAbt />);
    await screen.findByText("Cerai gugat");
    fireEvent.click(screen.getByRole("button", { name: "Matikan, kembali ke ABT" }));
    await waitFor(() => expect(f.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === "POST")).toBe(true));
    expect(konfirmasi).not.toHaveBeenCalled();
    const kirim = f.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "POST")!;
    expect(JSON.parse(String((kirim[1] as RequestInit).body))).toEqual({ tindakan: "saklar", keluarga: "kewarisan", aktif: false });
  });

  it("dimatikan lewat pengaturan server: semua tombol Nyalakan mati dan alasannya disebut", async () => {
    stub(keadaan({ dimatikanServer: true }));
    render(<KesiapanAletaAbt />);
    await screen.findByText("Cerai gugat");
    expect(screen.getByText("Pindah ke ALETA ABT dimatikan lewat pengaturan server, jadi semua jenis tetap memakai ABT dan belum dapat dinyalakan.")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Nyalakan ALETA ABT" }).every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
  });
});

describe("hasil pengukuran", () => {
  it("berkas dibaca dan dikirim sebagai hasil pengukuran; hasilnya diberitakan", async () => {
    const f = stub(keadaan(), () => ok({ keluarga: 33, terukur: 21, dibuat: "x" }));
    render(<KesiapanAletaAbt />);
    await screen.findByText("Cerai gugat");
    const isi = { dibuat: "2026-11-05T10:00:00Z", keluarga: [{ kunci: "cerai-gugat", perkara: 5 }] };
    const berkas = new File([JSON.stringify(isi)], "hasil.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("Berkas hasil pengukuran"), { target: { files: [berkas] } });
    expect(await screen.findByText("Hasil pengukuran dimuat: 21 dari 33 jenis perkara sudah terukur.", {}, { timeout: 8000 })).toBeTruthy();
    const kirim = f.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "POST")!;
    expect(JSON.parse(String((kirim[1] as RequestInit).body))).toEqual({ tindakan: "laporan", laporan: isi });
  });

  it("berkas yang bukan hasil pengukuran: pesan sehari-hari, tidak dikirim", async () => {
    const f = stub(keadaan());
    render(<KesiapanAletaAbt />);
    await screen.findByText("Cerai gugat");
    fireEvent.change(screen.getByLabelText("Berkas hasil pengukuran"), { target: { files: [new File(["bukan json"], "x.json")] } });
    expect(await screen.findByText("Berkas ini tidak dapat dibaca sebagai hasil pengukuran.", {}, { timeout: 8000 })).toBeTruthy();
    expect(f.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === "POST")).toBe(false);
  });
});

describe("bahasa dan tata letak", () => {
  it("tanpa kata teknis; menyebut bahwa panel Blangko ABT belum berubah", async () => {
    stub(keadaan());
    const { container } = render(<KesiapanAletaAbt />);
    await screen.findByText("Cerai gugat");
    expect(container.textContent).not.toMatch(/renderer|md5|skrip|mesin|JSON|API|RTF|endpoint|database|peladen|kunci|saklar|alinea|migrasi/i);
    expect(container.textContent).toContain("Panel Blangko ABT by Derry Briantono belum membuka ALETA ABT dari layar ini.");
  });

  it("kartu bersusun satu kolom di lebar HP (dua kolom hanya di layar lebar); tombol selebar kartu; tanpa geser mendatar", async () => {
    stub(keadaan());
    const { container } = render(<KesiapanAletaAbt />);
    await screen.findByText("Cerai gugat");
    const grid = container.querySelector("div.grid") as HTMLElement;
    expect(grid.className).toContain("md:grid-cols-2");
    expect(grid.className).not.toMatch(/(^|\s)grid-cols-[2-9]/);
    for (const b of screen.getAllByRole("button", { name: /Nyalakan|Matikan|Muat/ })) expect(b.className, b.textContent ?? "").toContain("w-full");
    expect(container.innerHTML).not.toContain("overflow-x-scroll");
    expect(container.innerHTML).not.toMatch(/min-w-\[\d{3,}px\]/);
  });

  it("galat membaca (bukan Super Admin) tampil apa adanya", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => galat("Pindah ke ALETA ABT hanya untuk Super Admin.", 403)));
    render(<KesiapanAletaAbt />);
    expect(await screen.findByText("Pindah ke ALETA ABT hanya untuk Super Admin.")).toBeTruthy();
  });
});
