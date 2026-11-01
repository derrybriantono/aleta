import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AletaAiChat } from "@/components/portal/aleta-ai/aleta-ai-chat";
import { AletaAiProyekKelola } from "@/components/portal/aleta-ai/aleta-ai-proyek-kelola";

/**
 * Layar proyek ALETA Ai (1 Nov 2026, keputusan 72 dengan ralatnya).
 *   - Layar tanya: pemilih proyek HANYA muncul bila ada proyek yang boleh dipakai; memilih menyimpan ke percakapan
 *     (PATCH) atau ikut saat percakapan dibuat (POST); baris usulan memori tidak tampil di jawaban.
 *   - Pengelolaan (Pengaturan, Super Admin): daftar, buka, unggah berkas satu per satu, usulan memori disetujui/ditolak.
 */

const fetchTiruan = vi.fn();
type Panggilan = { url: string; metode: string; badan: unknown; formulir?: FormData };
let panggilan: Panggilan[] = [];

const jawab = (data: unknown, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => ({ ok, data, error: ok ? undefined : { message: String(data) } }) }) as unknown as Response;

function alirSelesai(teks: string): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const o of [{ jenis: "teks", delta: teks }, { jenis: "selesai", pesanId: "ai-1", mode: "teliti", label: "Teliti", biayaRp: 1000, saldoRp: 9000 }]) c.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
      c.close();
    },
  });
  return { ok: true, status: 200, body, json: async () => ({}) } as unknown as Response;
}

const RINGKAS = (proyekPilihan?: Array<{ id: string; nama: string; deskripsi: string }>) => ({
  aktif: true,
  saldoRp: 10_000,
  superAdmin: false,
  pemicu: [],
  proyekVersi: 1,
  ...(proyekPilihan ? { proyekPilihan } : {}),
});

const PILIHAN = [
  { id: "aipk-1", nama: "ALETA AI PA CLAUDE", deskripsi: "Proyek utama hakim" },
  { id: "aipk-2", nama: "Waris", deskripsi: "Perkara waris" },
];

beforeEach(() => {
  fetchTiruan.mockReset();
  panggilan = [];
  vi.stubGlobal("fetch", fetchTiruan);
  vi.stubGlobal("confirm", () => true);
  window.confirm = () => true;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("layar tanya: pemilih proyek", () => {
  function pasangChat(ringkas: object, opsi: { rincian?: object; teksAi?: string } = {}) {
    fetchTiruan.mockImplementation(async (url: string, init?: RequestInit) => {
      const metode = (init?.method ?? "GET").toUpperCase();
      const badan = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      panggilan.push({ url, metode, badan });
      if (url.includes("/api/aleta-ai/ringkas")) return jawab(ringkas);
      if (/\/percakapan\/[^/]+\/pesan$/.test(url)) return alirSelesai(opsi.teksAi ?? "Jawaban.");
      const satu = /\/api\/aleta-ai\/percakapan\/([^/?]+)$/.exec(url);
      if (satu) return metode === "GET" ? jawab(opsi.rincian ?? { id: satu[1], judul: "Lama", pesan: [], proyekId: "aipk-2" }) : jawab({});
      if (url.includes("/api/aleta-ai/percakapan")) return metode === "POST" ? jawab({ id: "baru-1" }) : jawab([{ id: "p1", judul: "Lama", diperbarui: new Date().toISOString() }]);
      return jawab({});
    });
  }

  it("tanpa proyek yang boleh dipakai, pemilih tidak ada (tampilan lama tidak berubah)", async () => {
    pasangChat(RINGKAS());
    render(<AletaAiChat />);
    await screen.findByRole("textbox", { name: "Tulis pesan untuk ALETA Ai" });
    expect(screen.queryByTestId("pemilih-proyek")).not.toBeInTheDocument();
    cleanup();
    pasangChat(RINGKAS([]));
    render(<AletaAiChat />);
    await screen.findByRole("textbox", { name: "Tulis pesan untuk ALETA Ai" });
    expect(screen.queryByTestId("pemilih-proyek")).not.toBeInTheDocument();
  });

  it("pemilih menampilkan proyek bawaan + proyek yang diizinkan; pilihan ikut saat percakapan baru dibuat", async () => {
    pasangChat(RINGKAS(PILIHAN));
    render(<AletaAiChat />);
    const pilih = (await screen.findByLabelText("Proyek")) as HTMLSelectElement;
    expect(within(pilih).getAllByRole("option").map((o) => o.textContent)).toEqual(["Proyek bawaan satker", "ALETA AI PA CLAUDE", "Waris"]);
    expect(pilih.value).toBe("");

    await userEvent.selectOptions(pilih, "aipk-1");
    // Belum ada percakapan: tidak ada panggilan simpan, pilihan menunggu pesan pertama.
    expect(panggilan.some((p) => p.metode === "PATCH")).toBe(false);
    expect(screen.getByText("Proyek utama hakim")).toBeInTheDocument();

    await userEvent.type(screen.getByRole("textbox", { name: "Tulis pesan untuk ALETA Ai" }), "Halo{Enter}");
    await waitFor(() => expect(panggilan.some((p) => p.metode === "POST" && p.url.endsWith("/percakapan"))).toBe(true));
    expect(panggilan.find((p) => p.metode === "POST" && p.url.endsWith("/percakapan"))!.badan).toMatchObject({ proyekId: "aipk-1" });
  });

  it("tanpa pilihan proyek, kiriman percakapan baru tidak memuat proyekId", async () => {
    pasangChat(RINGKAS(PILIHAN));
    render(<AletaAiChat />);
    await screen.findByLabelText("Proyek");
    await userEvent.type(screen.getByRole("textbox", { name: "Tulis pesan untuk ALETA Ai" }), "Halo{Enter}");
    await waitFor(() => expect(panggilan.some((p) => p.metode === "POST" && p.url.endsWith("/percakapan"))).toBe(true));
    expect(panggilan.find((p) => p.metode === "POST" && p.url.endsWith("/percakapan"))!.badan).not.toHaveProperty("proyekId");
  });

  it("membuka percakapan lama menampilkan proyeknya; mengganti proyek menyimpan lewat PATCH", async () => {
    pasangChat(RINGKAS(PILIHAN));
    render(<AletaAiChat />);
    await userEvent.click(await screen.findByRole("button", { name: "Lama" }));
    const pilih = (await screen.findByLabelText("Proyek")) as HTMLSelectElement;
    await waitFor(() => expect(pilih.value).toBe("aipk-2"));
    await userEvent.selectOptions(pilih, "");
    await waitFor(() => expect(panggilan.some((p) => p.metode === "PATCH")).toBe(true));
    const patch = panggilan.find((p) => p.metode === "PATCH")!;
    expect(patch.url).toMatch(/\/percakapan\/p1$/);
    expect(patch.badan).toEqual({ proyekId: "" });
  });

  it("gagal menyimpan pilihan: pilihan dikembalikan dan alasan ditampilkan", async () => {
    pasangChat(RINGKAS(PILIHAN));
    const asli = fetchTiruan.getMockImplementation()!;
    fetchTiruan.mockImplementation(async (url: string, init?: RequestInit) => {
      if ((init?.method ?? "GET").toUpperCase() === "PATCH") return jawab("Proyek tidak ditemukan.", false);
      return asli(url, init);
    });
    render(<AletaAiChat />);
    await userEvent.click(await screen.findByRole("button", { name: "Lama" }));
    const pilih = (await screen.findByLabelText("Proyek")) as HTMLSelectElement;
    await waitFor(() => expect(pilih.value).toBe("aipk-2"));
    await userEvent.selectOptions(pilih, "aipk-1");
    await waitFor(() => expect(pilih.value).toBe("aipk-2"));
  });

  it("baris USUL-MEMORI di akhir jawaban tidak ditampilkan kepada pengguna", async () => {
    pasangChat(RINGKAS(PILIHAN), { teksAi: "Nafkah iddah tiga bulan.\n\nUSUL-MEMORI: Satker memakai kop resmi" });
    render(<AletaAiChat />);
    await screen.findByLabelText("Proyek");
    await userEvent.type(screen.getByRole("textbox", { name: "Tulis pesan untuk ALETA Ai" }), "Halo{Enter}");
    expect(await screen.findByText("Nafkah iddah tiga bulan.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId("jawaban-mengalir")).not.toBeInTheDocument());
    expect(screen.queryByText(/USUL-MEMORI/)).not.toBeInTheDocument();
    expect(screen.queryByText(/kop resmi/)).not.toBeInTheDocument();
  });
});

describe("pengelolaan proyek (Super Admin)", () => {
  const ringkas = {
    id: "aipk-1",
    nama: "ALETA AI PA CLAUDE",
    deskripsi: "Proyek utama",
    sertakanBawaan: false,
    akses: "semua",
    aksesPeran: [],
    aksesPengguna: [],
    memoriAktif: true,
    aktif: true,
    versi: 3,
    jumlahBerkas: 1,
    jumlahMemori: 1,
    jumlahUsulan: 1,
    diubah: "2026-11-01T01:00:00.000Z",
  };
  let rincian: Record<string, unknown>;

  function pasangKelola() {
    rincian = {
      ...ringkas,
      instruksi: "Instruksi awal proyek",
      berkas: [{ id: "b1", nama: "pedoman.md", jenis: "md", ukuran: 2048, karakter: 1800, selalu: false, diubah: "2026-11-01T01:00:00.000Z" }],
      memori: [
        { id: "m1", isi: "Satker memakai kop resmi", status: "disetujui", sumber: "super-admin", dibuat: "2026-11-01T01:00:00.000Z" },
        { id: "m2", isi: "Hakim ketua menyukai format ringkas", status: "usulan", sumber: "usulan-ai", dibuat: "2026-11-01T01:00:00.000Z" },
      ],
      riwayat: [{ aksi: "buat", ringkas: "Proyek dibuat", oleh: "usr-super", waktu: "2026-11-01T01:00:00.000Z" }],
    };
    fetchTiruan.mockImplementation(async (url: string, init?: RequestInit) => {
      const metode = (init?.method ?? "GET").toUpperCase();
      const formulir = init?.body instanceof FormData ? init.body : undefined;
      const badan = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      panggilan.push({ url, metode, badan, formulir });
      if (/proyek\/kelola\/aipk-1\/berkas$/.test(url) && metode === "POST") {
        return jawab({ hasil: formulir!.getAll("berkas").map((f) => ({ nama: (f as File).name, berkas: { id: "bx" }, peringatan: [] })) });
      }
      if (/proyek\/kelola\/aipk-1\/berkas\/b1$/.test(url)) return metode === "GET" ? jawab({ id: "b1", nama: "pedoman.md", teks: "Isi pedoman", selalu: false }) : jawab({});
      if (/proyek\/kelola\/aipk-9$/.test(url)) return jawab({ ...rincian, id: "aipk-9", nama: "Baru", berkas: [], memori: [] });
      if (/proyek\/kelola\/aipk-1$/.test(url)) return metode === "GET" ? jawab(rincian) : jawab(ringkas);
      if (/proyek\/kelola$/.test(url)) return metode === "GET" ? jawab([ringkas]) : jawab({ ...ringkas, id: "aipk-9", nama: "Baru" }, true);
      return jawab({});
    });
  }

  it("daftar proyek tampil dengan jumlah berkas dan usulan memori; membuat proyek mengirim namanya", async () => {
    pasangKelola();
    render(<AletaAiProyekKelola pengguna={[{ id: "u1", name: "Derry", jabatan: "Hakim" }]} peran={[{ id: "hakim", name: "Hakim" }]} />);
    const daftar = await screen.findByTestId("daftar-proyek-kelola");
    expect(within(daftar).getByText("ALETA AI PA CLAUDE")).toBeInTheDocument();
    expect(within(daftar).getByText("1 usulan memori")).toBeInTheDocument();
    expect(within(daftar).getByText(/1 berkas, 1 memori, dipakai oleh semua pengguna/)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Nama proyek baru"), "Baru");
    await userEvent.click(screen.getByRole("button", { name: /Buat proyek/ }));
    await waitFor(() => expect(panggilan.some((p) => p.metode === "POST" && p.url.endsWith("/proyek/kelola"))).toBe(true));
    expect(panggilan.find((p) => p.metode === "POST")!.badan).toEqual({ nama: "Baru" });
  });

  it("buka proyek: simpan instruksi, hak pakai per peran, unggah beberapa berkas, sunting berkas, setujui/tolak usulan memori", async () => {
    pasangKelola();
    render(<AletaAiProyekKelola pengguna={[{ id: "u1", name: "Derry", jabatan: "Hakim" }]} peran={[{ id: "hakim", name: "Hakim" }, { id: "jurusita", name: "Jurusita" }]} />);
    await userEvent.click(await screen.findByRole("button", { name: /ALETA AI PA CLAUDE/ }));
    const instruksi = (await screen.findByLabelText("Instruksi proyek")) as HTMLTextAreaElement;
    expect(instruksi.value).toBe("Instruksi awal proyek");

    // Instruksi
    await userEvent.clear(instruksi);
    await userEvent.type(instruksi, "Instruksi baru");
    await userEvent.click(screen.getByRole("button", { name: "Simpan instruksi" }));
    await waitFor(() => expect(panggilan.some((p) => p.metode === "PUT" && JSON.stringify(p.badan) === JSON.stringify({ instruksi: "Instruksi baru" }))).toBe(true));

    // Hak pakai per peran
    await userEvent.selectOptions(screen.getByLabelText("Siapa yang boleh memakai"), "peran");
    await userEvent.click(screen.getByRole("checkbox", { name: "Hakim" }));
    await userEvent.click(screen.getByRole("button", { name: "Simpan pengaturan" }));
    await waitFor(() => expect(panggilan.some((p) => p.metode === "PUT" && (p.badan as { akses?: string })?.akses === "peran")).toBe(true));
    const simpanAkses = panggilan.filter((p) => p.metode === "PUT" && (p.badan as { akses?: string })?.akses === "peran").at(-1)!;
    expect(simpanAkses.badan).toMatchObject({ akses: "peran", aksesPeran: ["hakim"], sertakanBawaan: false, memoriAktif: true, aktif: true });

    // Unggah dua berkas sekaligus (bukan ZIP)
    const masukan = screen.getByLabelText("Pilih berkas pengetahuan") as HTMLInputElement;
    const f1 = new File(["a"], "satu.pdf", { type: "application/pdf" });
    const f2 = new File(["b"], "dua.docx");
    await userEvent.upload(masukan, [f1, f2]);
    await waitFor(() => expect(panggilan.some((p) => p.formulir)).toBe(true));
    expect(panggilan.find((p) => p.formulir)!.formulir!.getAll("berkas").map((f) => (f as File).name)).toEqual(["satu.pdf", "dua.docx"]);
    expect(await screen.findByText(/2 berkas masuk/)).toBeInTheDocument();

    // Sunting berkas: isi dibuka dari server, disimpan lewat PUT
    await userEvent.click(screen.getByRole("button", { name: /Sunting/ }));
    const isi = (await screen.findByLabelText("Isi berkas")) as HTMLTextAreaElement;
    expect(isi.value).toBe("Isi pedoman");
    await userEvent.type(isi, " diubah");
    await userEvent.click(screen.getByRole("button", { name: "Simpan berkas" }));
    await waitFor(() => expect(panggilan.some((p) => p.metode === "PUT" && /berkas\/b1$/.test(p.url))).toBe(true));
    expect(panggilan.find((p) => p.metode === "PUT" && /berkas\/b1$/.test(p.url))!.badan).toMatchObject({ teks: "Isi pedoman diubah", nama: "pedoman.md" });

    // Usulan memori
    const kotakUsulan = screen.getByTestId("usulan-memori");
    expect(within(kotakUsulan).getByText("Hakim ketua menyukai format ringkas")).toBeInTheDocument();
    await userEvent.click(within(kotakUsulan).getByRole("button", { name: /Setujui/ }));
    await waitFor(() => expect(panggilan.some((p) => p.metode === "PUT" && /memori\/m2$/.test(p.url))).toBe(true));
    expect(panggilan.find((p) => p.metode === "PUT" && /memori\/m2$/.test(p.url))!.badan).toEqual({ putusan: "setuju" });
    await userEvent.click(within(kotakUsulan).getByRole("button", { name: /Tolak/ }));
    await waitFor(() => expect(panggilan.filter((p) => p.metode === "PUT" && /memori\/m2$/.test(p.url))).toHaveLength(2));
    expect(panggilan.filter((p) => p.metode === "PUT" && /memori\/m2$/.test(p.url))[1]!.badan).toEqual({ putusan: "tolak" });
  }, 60000);

  it("galat 403 dari server (bukan Super Admin) ditampilkan, bukan layar kosong", async () => {
    fetchTiruan.mockImplementation(async () => jawab("Hanya Super Admin yang dapat mengelola proyek ALETA Ai.", false));
    render(<AletaAiProyekKelola pengguna={[]} peran={[]} />);
    expect(await screen.findByText(/Hanya Super Admin/)).toBeInTheDocument();
    await act(async () => {});
  });
});
