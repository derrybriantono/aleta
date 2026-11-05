// @vitest-environment jsdom
/**
 * Layar alur kerja per peran dan berdampingan (5 Nov 2026, Tahap 6 dan 7), data rekaan:
 *   - Siap diperiksa: peran dipilih di layar (hanya melihat), pekerjaan dan blangko disarankan tampil, peringatan di luar tahapan tampil,
 *     periksa naskah menampilkan angka; hak folder yang belum berlaku disebut;
 *   - Selesaikan berkas: lima langkah, langkah yang dimatikan dijelaskan, "Ulangi langkah ini" hanya pada yang gagal;
 *   - Hak folder: ringkasan dan folder ragu tampil; menyetujui menuntut kotak periksa; setuju mengirim sidik yang dilihat;
 *   - Berdampingan: kemajuan menuju 30 cetak, beda merah dijawab dengan pilihan baku;
 *   - bahasa sehari-hari tanpa kata teknis; tampil sebagai kartu di lebar HP (tanpa geser mendatar).
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BerdampinganAbt } from "@/components/portal/berdampingan-abt";
import { HakFolderAbt } from "@/components/portal/hak-folder-abt";
import { SelesaikanBerkasAbt } from "@/components/portal/selesaikan-berkas-abt";
import { SiapDiperiksaAbt } from "@/components/portal/siap-diperiksa-abt";
import { ID_LANGKAH, keadaanAwal, keadaanDariJson } from "@/lib/aleta-abt-selesai";

const ok = (data: unknown) => new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { "content-type": "application/json" } });
const galat = (pesan: string, status = 422) => new Response(JSON.stringify({ ok: false, error: { message: pesan } }), { status, headers: { "content-type": "application/json" } });

function stub(peta: Record<string, (init?: RequestInit) => Response>) {
  const f = vi.fn(async (u: RequestInfo | URL, init?: RequestInit) => {
    const url = String(u);
    const kunci = Object.keys(peta)
      .filter((k) => url.includes(k))
      .sort((a, b) => b.length - a.length)[0];
    return kunci ? peta[kunci](init) : galat("tidak ada", 404);
  });
  vi.stubGlobal("fetch", f);
  return f;
}

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

const SARAN = (lain: Record<string, unknown> = {}) => ({
  folder: "derry_briantono/1 Perceraian CG",
  berkas: "[02] Kabul.rtf",
  label: "Putusan cerai gugat kabul",
  alasan: "Sidang beragenda pembacaan putusan.",
  utama: true,
  perkiraan: false,
  keyakinan: "pasti",
  berkasId: "abt-1",
  diPustaka: true,
  tingkatHak: "belum-berlaku",
  hakBoleh: null,
  peringatan: "",
  aturan: "penetapan hari sidang sampai minutasi (proses 80-297); cerai gugat",
  ...lain,
});
const JAWAB_SIAP = (lain: Record<string, unknown> = {}) => ({
  peran: "hakim",
  tanggal: "2026-11-05",
  tersedia: true,
  keterangan: "",
  jumlahBaris: 2,
  hakFolder: { berlaku: false, disetujui: false },
  butir: [
    { kunci: "1|putusan|9", perkaraId: "123", nomorPerkara: "1/Pdt.G/2026/PA.Uji", jenisPerkara: "Cerai Gugat", tanggalSidang: "2026-11-05", sidangId: "9", jenis: "putusan", judul: "Putusan", keterangan: "Sidang pada tanggal ini dapat memutus.", saran: [SARAN(), SARAN({ berkas: "[03] Tolak.rtf", label: "Putusan tolak", utama: false, diPustaka: false, berkasId: "", peringatan: "Folder ini dibuka ABT pada tahapan lain." })], keadaan: { prosesId: null, jenisPerkaraId: 347, alurPerkaraId: 15 } },
  ],
  ...lain,
});

describe("Siap diperiksa", () => {
  it("peran dipilih di layar; daftar dimuat ulang untuk peran itu; hak folder yang belum berlaku disebut", async () => {
    const f = stub({ "/api/aleta-abt/siap": () => ok(JAWAB_SIAP()) });
    render(<SiapDiperiksaAbt />);
    expect(await screen.findByText("1/Pdt.G/2026/PA.Uji")).toBeTruthy();
    expect(screen.getByText("Hak folder belum disetujui pemilik", { exact: false })).toBeTruthy();
    expect(f.mock.calls[0][0]).toContain("peran=hakim");
    fireEvent.click(screen.getByRole("button", { name: "Panitera Pengganti" }));
    await waitFor(() => expect(f.mock.calls.some((c) => String(c[0]).includes("peran=pp"))).toBe(true));
    expect(screen.getByRole("button", { name: "Panitera Pengganti" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Lihat sebagai peran")).toBeTruthy();
  });

  it("saran blangko tampil dengan alasan; yang di luar tahapan diberi peringatan; yang belum di pustaka diterangkan", async () => {
    stub({ "/api/aleta-abt/siap": () => ok(JAWAB_SIAP()) });
    render(<SiapDiperiksaAbt />);
    expect(await screen.findByText("Putusan cerai gugat kabul")).toBeTruthy();
    expect(screen.getAllByText("Sidang beragenda pembacaan putusan.").length).toBeGreaterThan(0);
    expect(screen.getByText("Di luar tahapan: Folder ini dibuka ABT pada tahapan lain.")).toBeTruthy();
    expect(screen.getByText("Blangko ini belum ada di pustaka ALETA ABT", { exact: false })).toBeTruthy();
    expect(screen.getAllByText("disarankan").length).toBe(1);
  });

  it("periksa naskah menampilkan angka isian dan apakah dapat dicetak", async () => {
    const f = stub({
      "/api/aleta-abt/siap?": () => ok(JAWAB_SIAP()),
      "/api/aleta-abt/siap": (init) => (init?.method === "POST" ? ok({ nama: "x", jumlahTerisi: 10, jumlahKosong: 2, periksaKembali: 3, pasti: 7, lolosCetak: false, mesinGalat: "", dapatDicetak: false }) : ok(JAWAB_SIAP())),
    });
    render(<SiapDiperiksaAbt />);
    fireEvent.click(await screen.findByRole("button", { name: "Periksa naskah" }));
    expect(await screen.findByText("7 isian pasti")).toBeTruthy();
    expect(screen.getByText("3 perlu dilihat")).toBeTruthy();
    expect(screen.getByText("2 kosong")).toBeTruthy();
    expect(screen.getByText("belum dapat dicetak")).toBeTruthy();
    const kirim = f.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "POST")!;
    expect(JSON.parse(String((kirim[1] as RequestInit).body))).toEqual({ tindakan: "periksa", berkasId: "abt-1", perkaraId: "123" });
  });

  it("jadwal tidak terbaca: sebabnya tampil, bukan daftar kosong", async () => {
    stub({ "/api/aleta-abt/siap": () => ok(JAWAB_SIAP({ tersedia: false, keterangan: "SIPP tidak terjangkau.", butir: [] })) });
    render(<SiapDiperiksaAbt />);
    expect(await screen.findByText("SIPP tidak terjangkau.")).toBeTruthy();
    expect(screen.getByText("Jadwal sidang belum dapat dibaca")).toBeTruthy();
  });

  it("galat server (bukan Super Admin) tampil apa adanya", async () => {
    stub({ "/api/aleta-abt/siap": () => galat("Siap diperiksa ALETA ABT hanya untuk Super Admin.", 403) });
    render(<SiapDiperiksaAbt />);
    expect(await screen.findByText("Siap diperiksa ALETA ABT hanya untuk Super Admin.")).toBeTruthy();
  });
});

describe("Selesaikan berkas", () => {
  const TARGET = { perkaraId: "123", berkasId: "abt-1", jenis: "putusan" as const, nomorPerkara: "1/Pdt.G/2026/PA.Uji", sidangKe: 0 };
  const SAKLAR = { "edoc-sipp": false, ecourt: false };
  const keadaan = (ubah: Partial<Record<(typeof ID_LANGKAH)[number], { status: string; pesan?: string }>>) => {
    const k = keadaanAwal();
    for (const [id, v] of Object.entries(ubah)) k.langkah[id as (typeof ID_LANGKAH)[number]] = { ...k.langkah[id as (typeof ID_LANGKAH)[number]], status: v!.status as never, pesan: v!.pesan ?? "" };
    return keadaanDariJson(k);
  };

  it("lima langkah tampil; yang dimatikan diterangkan; tombol Ulangi hanya pada langkah yang gagal", async () => {
    stub({
      "/api/aleta-abt/selesai": () =>
        ok({ saklar: SAKLAR, ada: true, keadaan: keadaan({ "pdf-salinan": { status: "selesai", pesan: "PDF salinan siap." }, "garis-z-nomor": { status: "tidak-berlaku" }, "edoc-sipp": { status: "dimatikan", pesan: "Dimatikan: langkah ini menulis ke SIPP dan saklarnya belum dinyalakan pemilik." }, ecourt: { status: "gagal", pesan: "Sesi pribadi tidak ada." } }) }),
    });
    render(<SelesaikanBerkasAbt target={TARGET} />);
    expect(await screen.findByText("Dimatikan: langkah ini menulis ke SIPP dan saklarnya belum dinyalakan pemilik.")).toBeTruthy();
    expect(screen.getByText("1. PDF salinan bertanda tangan dan cap")).toBeTruthy();
    expect(screen.getByText(/5\. Catatan di Status Perkara/)).toBeTruthy();
    expect(screen.getByText("Langkah yang menulis ke SIPP dan e-Court dimatikan sampai pemilik menyalakannya.", { exact: false })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Ulangi langkah ini" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Lanjutkan yang belum selesai" })).toBeTruthy();
  });

  it("Ulangi langkah ini mengirim hanya langkah itu; Selesaikan berkas mengirim jalankan", async () => {
    let status: unknown = keadaan({ ecourt: { status: "gagal", pesan: "x" } });
    const f = stub({
      "/api/aleta-abt/selesai": (init) => {
        if (init?.method === "POST") status = keadaan({ "pdf-salinan": { status: "selesai" }, ecourt: { status: "selesai" } });
        return ok({ saklar: SAKLAR, ada: true, keadaan: status });
      },
    });
    render(<SelesaikanBerkasAbt target={TARGET} />);
    fireEvent.click(await screen.findByRole("button", { name: "Ulangi langkah ini" }));
    await waitFor(() => expect(f.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === "POST")).toBe(true));
    const kirim = f.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "POST")!;
    expect(JSON.parse(String((kirim[1] as RequestInit).body))).toMatchObject({ tindakan: "ulangi", langkah: ["ecourt"], perkaraId: "123", berkasId: "abt-1", jenis: "putusan" });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Ulangi langkah ini" })).toBeNull());
  });

  it("belum dijalankan: tombol Selesaikan berkas; galat tampil", async () => {
    stub({ "/api/aleta-abt/selesai": (init) => (init?.method === "POST" ? galat("Berkas ini sedang diselesaikan. Tunggu sebentar lalu muat ulang.", 409) : ok({ saklar: SAKLAR, ada: false, keadaan: keadaanAwal() })) });
    render(<SelesaikanBerkasAbt target={TARGET} />);
    fireEvent.click(await screen.findByRole("button", { name: "Selesaikan berkas" }));
    expect(await screen.findByText("Berkas ini sedang diselesaikan. Tunggu sebentar lalu muat ulang.")).toBeTruthy();
  });
});

describe("Hak folder", () => {
  const baris = (folder: string, ragu: string[], hak: Record<string, string>) => ({
    folder,
    nama: "",
    adaMenu: ragu.length === 0,
    arsip: false,
    tahapan: "penetapan hari sidang sampai minutasi (proses 80-297)",
    jenis: "cerai gugat",
    penunjukan: "harus ditunjuk di perkara",
    grup: [],
    ragu,
    hak: { "super-admin": "bebas", admin: "tidak", pimpinan: "ditunjuk", hakim: "ditunjuk", panitera: "tidak", panmud: "tidak", pp: "tidak", jurusita: "tidak", kasir: "tidak", ptsp: "tidak", mediator: "tidak", "petugas-sidang": "tidak", "analis-perkara": "tidak", sekretariat: "tidak", ti: "tidak", pelaksana: "tidak", ...hak },
  });
  const MATRIKS = {
    baris: [baris("1 Perceraian CG", [], {}), baris("Folder tanpa menu", ["Tidak ada baris menu di ABT untuk folder ini, jadi siapa yang berhak tidak diketahui."], { hakim: "tidak", pimpinan: "tidak" })],
    golongan: ["super-admin", "admin", "pimpinan", "hakim", "panitera", "panmud", "pp", "jurusita", "kasir", "ptsp", "mediator", "petugas-sidang", "analis-perkara", "sekretariat", "ti", "pelaksana"],
    jumlahFolder: 2,
    jumlahRagu: 1,
    tanpaPadananAbt: ["mediator", "petugas-sidang", "ti", "pelaksana"],
    sidik: "abc12345",
  };
  const J = (lain: Record<string, unknown> = {}) => ({ matriks: MATRIKS, persetujuan: { disetujui: false, sidik: "", oleh: "", pada: "" }, berlaku: false, ...lain });

  it("ringkasan, folder ragu, dan keterangan belum berlaku tampil; peran tanpa padanan disebut", async () => {
    stub({ "/api/aleta-abt/hak-folder": () => ok(J()) });
    render(<HakFolderAbt />);
    expect(await screen.findByText("2 folder")).toBeTruthy();
    expect(screen.getByText("1 folder ragu")).toBeTruthy();
    expect(screen.getByText("belum disetujui, belum berlaku")).toBeTruthy();
    expect(screen.getAllByText("Tidak ada baris menu di ABT untuk folder ini, jadi siapa yang berhak tidak diketahui.").length).toBeGreaterThan(0);
    expect(screen.getByText("Mediator non-hakim", { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Tampilkan hanya folder yang ragu"));
    expect(screen.queryAllByText("1 Perceraian CG").length).toBe(0);
  });

  it("menyetujui menuntut kotak periksa dan mengirim sidik yang dilihat; cabut tersedia sesudahnya", async () => {
    let setuju = false;
    const f = stub({
      "/api/aleta-abt/hak-folder": (init) => {
        if (init?.method === "POST") setuju = JSON.parse(String(init.body)).setuju;
        return ok(J(setuju ? { persetujuan: { disetujui: true, sidik: "abc12345", oleh: "Derry", pada: "2026-11-05T10:00:00.000Z" }, berlaku: true } : {}));
      },
    });
    render(<HakFolderAbt />);
    const tombol = await screen.findByRole("button", { name: "Setujui matriks ini" });
    expect((tombol as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(/Saya sudah memeriksa tabel di atas/));
    expect((tombol as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(tombol);
    expect(await screen.findByText("disetujui, berlaku")).toBeTruthy();
    const kirim = f.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "POST")!;
    expect(JSON.parse(String((kirim[1] as RequestInit).body))).toEqual({ tindakan: "setuju", setuju: true, sidik: "abc12345" });
    expect((screen.getByRole("button", { name: "Cabut persetujuan" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("persetujuan yang gugur karena isi berubah dijelaskan", async () => {
    stub({ "/api/aleta-abt/hak-folder": () => ok(J({ persetujuan: { disetujui: true, sidik: "lama", oleh: "Derry", pada: "2026-11-01T00:00:00.000Z" }, berlaku: false })) });
    render(<HakFolderAbt />);
    expect(await screen.findByText("persetujuan lama gugur: isi berubah")).toBeTruthy();
  });

  it("di HP tiap folder menjadi kartu (daftar tabel hanya di layar lebar), tanpa geser mendatar pada halaman", async () => {
    stub({ "/api/aleta-abt/hak-folder": () => ok(J()) });
    const { container } = render(<HakFolderAbt />);
    await screen.findByText("2 folder");
    const tabel = container.querySelector("table")!;
    expect(tabel.parentElement!.className).toContain("hidden");
    expect(tabel.parentElement!.className).toContain("md:block");
    const kartu = container.querySelectorAll("article");
    expect(kartu.length).toBe(2);
    expect(within(kartu[0] as HTMLElement).getByText("Hakim", { exact: false })).toBeTruthy();
  });
});

describe("Berdampingan", () => {
  const J = (lain: Record<string, unknown> = {}) => ({
    ringkasan: {
      perJenis: [
        { jenis: "cerai-gugat", nama: "Cerai gugat", cetak: 22, target: 30, hijau: 20, kuning: 1, merah: 1, belumDiukur: 4, hariTanpaMerah: 9, memenuhiSyarat: false },
        { jenis: "cerai-talak", nama: "Cerai talak", cetak: 17, target: 30, hijau: 17, kuning: 0, merah: 0, belumDiukur: 0, hariTanpaMerah: 12, memenuhiSyarat: false },
      ],
      mingguan: [{ mulai: "2026-11-02", total: 12, hijau: 9, kuning: 2, merah: 1, belumDiukur: 0 }],
      merahBelumDijawab: 1,
      total: 39,
      syaratCetak: 30,
      syaratHari: 14,
    },
    beda: [
      { id: "bdp-1", waktu: "2026-11-05T10:00:00.000Z", berkasNama: "[02] Kabul.rtf", jenisPerkara: "cerai-gugat", jenisNaskah: "putusan", perkaraId: "123", hasil: "merah", jawaban: "", total: 10, identik: 9, dijelaskan: 0, belumDijelaskan: 1, perKelas: { isi: 1 }, nomor: [{ kelas: "isi", abt: 4, aleta: 4 }] },
      { id: "bdp-2", waktu: "2026-11-04T10:00:00.000Z", berkasNama: "[03] Tolak.rtf", jenisPerkara: "cerai-talak", jenisNaskah: "putusan", perkaraId: "124", hasil: "kuning", jawaban: "", total: 10, identik: 9, dijelaskan: 1, belumDijelaskan: 0, perKelas: { "tata-letak": 1 }, nomor: [{ kelas: "tata-letak", abt: 2, aleta: 2 }] },
    ],
    setelan: { aktif: false, diubahOleh: "", diubahPada: "" },
    ...lain,
  });

  it("kemajuan menuju 30 cetak dan dua pekan tampil; saklar mati bawaan; bahasa sehari-hari", async () => {
    stub({ "/api/aleta-abt/berdampingan": () => ok(J()) });
    const { container } = render(<BerdampinganAbt />);
    expect(await screen.findByText("22 dari 30 cetak")).toBeTruthy();
    expect(screen.getByText("17 dari 30 cetak")).toBeTruthy();
    expect(screen.getByText("9 dari 14 hari")).toBeTruthy();
    expect(screen.getByText("mati")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Nyalakan pembandingan otomatis" })).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Cetak Cerai gugat" }).getAttribute("aria-valuenow")).toBe("22");
    expect(container.textContent).not.toMatch(/renderer|md5|skrip|mesin/i);
  });

  it("menyalakan mengirim aktif:true; beda merah dijawab dengan pilihan baku, kuning tidak punya tombol", async () => {
    const f = stub({ "/api/aleta-abt/berdampingan": () => ok(J()) });
    render(<BerdampinganAbt />);
    fireEvent.click(await screen.findByRole("button", { name: "Nyalakan pembandingan otomatis" }));
    await waitFor(() => expect(f.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === "POST")).toBe(true));
    expect(JSON.parse(String((f.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "POST")![1] as RequestInit).body))).toEqual({ tindakan: "setelan", aktif: true });
    const tombolJawab = screen.getAllByRole("button", { name: /^Tandai / });
    expect(tombolJawab).toHaveLength(3);
    f.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Tandai sudah dibetulkan" }));
    await waitFor(() => expect(f.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === "POST")).toBe(true));
    expect(JSON.parse(String((f.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "POST")![1] as RequestInit).body))).toEqual({ tindakan: "jawab", id: "bdp-1", jawaban: "sudah-dibetulkan" });
  });

  it("layar tidak memuat kalimat naskah atau nama pihak: hanya angka dan nama jenis beda", async () => {
    stub({ "/api/aleta-abt/berdampingan": () => ok(J()) });
    const { container } = render(<BerdampinganAbt />);
    await screen.findByText("22 dari 30 cetak");
    expect(container.textContent).toContain("1 alinea: isi berbeda (belum dijelaskan)");
    expect(container.textContent).toContain("hanya spasi (sudah dijelaskan)");
    expect(container.textContent).toContain("Alinea ABT / ALETA ABT: 4/4");
  });
});
