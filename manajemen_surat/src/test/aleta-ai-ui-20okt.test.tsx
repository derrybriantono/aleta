import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AletaAiChat } from "@/components/portal/aleta-ai/aleta-ai-chat";
import { MarkdownAman } from "@/components/portal/aleta-ai/markdown-aman";
import { formatRupiah, kelompokWaktu, labelAman } from "@/lib/aleta-ai/kontrak";

/**
 * Layar ALETA Ai (tahap 1, bagian tampilan) - 20 Okt 2026.
 *
 * Rute /api/aleta-ai/* dibangun terpisah, jadi layar diuji dengan fetch dan SSE
 * TIRUAN yang meniru bentuk kontraknya (bungkus { ok, data } kecuali alirannya).
 *
 * Yang dijaga:
 *   - riwayat tampil berkelompok, dapat dicari, diubah namanya, disembunyikan;
 *   - pesan mengalir dari SSE huruf demi huruf lalu menampilkan lencana mode + biaya;
 *   - tombol pintasan (pemicu V4.5) benar-benar mengirim kodenya;
 *   - Hentikan memutus aliran tetapi menyimpan jawaban yang sudah sempat tampil;
 *   - layar nonaktif ramah dan tanpa kotak tulis;
 *   - pengaturan hanya Super Admin; pengguna biasa tidak melihat nama model;
 *   - markdown tidak pernah menjadi HTML mentah.
 */

const fetchTiruan = vi.fn();

type Berkas = { url: string; metode: string; badan: unknown };
let panggilan: Berkas[] = [];

function jawab(data: unknown, ok = true) {
  return { ok, status: ok ? 200 : 400, json: async () => ({ ok, data, error: ok ? undefined : { message: String(data) } }) } as unknown as Response;
}

type Alir = { push: (o: object) => void; tutup: () => void; respons: Response };

function buatAlir(sinyal?: AbortSignal | null): Alir {
  const enc = new TextEncoder();
  let ctrl!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      ctrl = c;
    },
  });
  sinyal?.addEventListener("abort", () => {
    try {
      ctrl.error(new DOMException("Aborted", "AbortError"));
    } catch {
      /* sudah ditutup */
    }
  });
  return {
    push: (o) => ctrl.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`)),
    tutup: () => ctrl.close(),
    respons: { ok: true, status: 200, body, json: async () => ({}) } as unknown as Response,
  };
}

const sekarang = new Date();
// Siang hari kemarin (bukan "sekarang - 25 jam": antara 00.00-01.00 itu jatuh ke dua hari lalu).
const kemarin = new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate() - 1, 12, 0, 0);

const RINGKAS_BIASA = {
  aktif: true,
  saldoRp: 25_000,
  superAdmin: false,
  pemicu: [
    { kode: "ALETA_04", label: "Kalkulator nafkah", kelompok: "Kalkulator" },
    { kode: "ALETA_09", label: "Periksa BAS", kelompok: "Berkas", perkiraanRp: 2500 },
    { kode: "ALETA_13", label: "Persiapan sidang", kelompok: "Sidang" },
  ],
  proyekVersi: "4.5",
};

type Pasang = {
  ringkas?: object;
  daftar?: object[];
  rincian?: Record<string, object>;
  alir?: (sinyal?: AbortSignal | null) => Alir;
};

function pasang(opsi: Pasang = {}) {
  panggilan = [];
  fetchTiruan.mockImplementation(async (url: string, init?: RequestInit) => {
    const metode = (init?.method ?? "GET").toUpperCase();
    const badan = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    panggilan.push({ url, metode, badan });
    if (url.includes("/api/aleta-ai/ringkas")) return jawab(opsi.ringkas ?? RINGKAS_BIASA);
    if (/\/percakapan\/[^/]+\/pesan$/.test(url)) {
      return (opsi.alir ?? (() => buatAlir()))(init?.signal).respons;
    }
    const satu = /\/api\/aleta-ai\/percakapan\/([^/?]+)$/.exec(url);
    if (satu) {
      if (metode === "GET") return jawab(opsi.rincian?.[satu[1]] ?? { id: satu[1], judul: "?", pesan: [] });
      return jawab({});
    }
    if (url.includes("/api/aleta-ai/percakapan")) {
      if (metode === "POST") return jawab({ id: "baru-1" });
      return jawab(opsi.daftar ?? []);
    }
    return jawab({});
  });
}

beforeEach(() => {
  fetchTiruan.mockReset();
  vi.stubGlobal("fetch", fetchTiruan);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const DAFTAR = [
  { id: "p1", judul: "Nafkah iddah perkara 12", diperbarui: sekarang.toISOString() },
  { id: "p2", judul: "Kerangka itsbat nikah", diperbarui: kemarin.toISOString(), perkara: "45/Pdt.P/2026/PA.Dgl" },
];

describe("riwayat percakapan", () => {
  it("tampil berkelompok Hari ini dan Kemarin, dapat dicari", async () => {
    pasang({ daftar: DAFTAR });
    render(<AletaAiChat />);

    const nav = await screen.findByRole("navigation", { name: "Daftar percakapan" });
    expect(await within(nav).findByText("Nafkah iddah perkara 12")).toBeInTheDocument();
    expect(within(nav).getByText("Kerangka itsbat nikah")).toBeInTheDocument();
    expect(within(nav).getByRole("region", { name: "Hari ini" })).toBeInTheDocument();
    expect(within(nav).getByRole("region", { name: "Kemarin" })).toBeInTheDocument();

    await userEvent.type(screen.getByRole("searchbox", { name: "Cari percakapan" }), "itsbat");
    expect(within(nav).queryByText("Nafkah iddah perkara 12")).not.toBeInTheDocument();
    expect(within(nav).getByText("Kerangka itsbat nikah")).toBeInTheDocument();
  });

  it("memilih percakapan memuat pesannya, Percakapan baru mengosongkan layar", async () => {
    pasang({
      daftar: DAFTAR,
      rincian: {
        p1: {
          id: "p1",
          judul: "Nafkah iddah perkara 12",
          pesan: [
            { id: "m1", peran: "pengguna", isi: "Hitung nafkah iddah", waktu: sekarang.toISOString() },
            { id: "m2", peran: "ai", isi: "Nafkah iddah dihitung **tiga bulan**.", mode: "teliti", label: "Teliti", biayaRp: 1500, waktu: sekarang.toISOString() },
          ],
        },
      },
    });
    render(<AletaAiChat />);
    await userEvent.click(await screen.findByRole("button", { name: "Nafkah iddah perkara 12" }));

    expect(await screen.findByText("Hitung nafkah iddah")).toBeInTheDocument();
    expect(screen.getByText("tiga bulan").tagName).toBe("STRONG");
    expect(screen.getByTestId("lencana-mode")).toHaveTextContent("Teliti");
    expect(screen.getByTestId("biaya-jawaban")).toHaveTextContent("Rp1.500");

    await userEvent.click(screen.getByRole("button", { name: "Percakapan baru" }));
    expect(await screen.findByTestId("sambutan")).toBeInTheDocument();
    expect(screen.queryByText("Hitung nafkah iddah")).not.toBeInTheDocument();
  });

  it("ubah nama memanggil PATCH, sembunyikan memanggil DELETE setelah konfirmasi", async () => {
    pasang({ daftar: DAFTAR });
    render(<AletaAiChat />);
    await screen.findByText("Kerangka itsbat nikah");

    await userEvent.click(screen.getByRole("button", { name: "Ubah nama Kerangka itsbat nikah" }));
    const isian = screen.getByRole("textbox", { name: "Nama percakapan" });
    await userEvent.clear(isian);
    await userEvent.type(isian, "Itsbat nikah 45{Enter}");
    await waitFor(() => expect(panggilan.some((p) => p.metode === "PATCH" && (p.badan as { judul: string }).judul === "Itsbat nikah 45")).toBe(true));
    expect(await screen.findByText("Itsbat nikah 45")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Sembunyikan Itsbat nikah 45" }));
    expect(panggilan.some((p) => p.metode === "DELETE")).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "Ya, sembunyikan" }));
    await waitFor(() => expect(panggilan.some((p) => p.metode === "DELETE" && p.url.endsWith("/p2"))).toBe(true));
    await waitFor(() => expect(screen.queryByText("Itsbat nikah 45")).not.toBeInTheDocument());
  });
});

describe("mengirim pesan dan aliran SSE", () => {
  it("jawaban mengalir, lalu lencana mode dan biaya tampil, saldo diperbarui", async () => {
    let alir!: Alir;
    pasang({
      alir: (s) => (alir = buatAlir(s)),
    });
    render(<AletaAiChat />);
    expect(await screen.findByTestId("saldo-kepala")).toHaveTextContent("Rp25.000");

    const kotak = screen.getByRole("textbox", { name: "Tulis pesan untuk ALETA Ai" });
    await userEvent.type(kotak, "Apa itu iddah?{Enter}");

    // Percakapan dibuat dulu, lalu pesan dikirim ke rute pesan.
    await waitFor(() => expect(panggilan.some((p) => p.metode === "POST" && p.url.endsWith("/percakapan"))).toBe(true));
    await waitFor(() => expect(panggilan.some((p) => p.url.endsWith("/percakapan/baru-1/pesan"))).toBe(true));
    const kirim = panggilan.find((p) => p.url.endsWith("/pesan"))!;
    expect((kirim.badan as { teks: string }).teks).toBe("Apa itu iddah?");
    expect(screen.getByText("Apa itu iddah?", { selector: "div" })).toBeInTheDocument();
    expect(await screen.findByTestId("indikator-berpikir")).toBeInTheDocument();

    await act(async () => {
      alir.push({ jenis: "perkiraan", mode: "teliti", label: "Teliti", perkiraanRp: 1800 });
    });
    expect(await screen.findByTestId("perkiraan-biaya")).toHaveTextContent("Teliti");
    expect(screen.getByTestId("perkiraan-biaya")).toHaveTextContent("Rp1.800");

    await act(async () => {
      alir.push({ jenis: "teks", delta: "Iddah adalah " });
    });
    expect(await screen.findByText(/Iddah adalah/)).toBeInTheDocument();
    expect(screen.getByTestId("jawaban-mengalir")).toBeInTheDocument();
    await act(async () => {
      alir.push({ jenis: "teks", delta: "masa tunggu." });
      alir.push({ jenis: "selesai", pesanId: "ai-1", mode: "teliti", label: "Teliti", biayaRp: 1500, saldoRp: 23_500 });
      alir.tutup();
    });

    expect(await screen.findByText("Iddah adalah masa tunggu.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId("jawaban-mengalir")).not.toBeInTheDocument());
    expect(screen.getByTestId("lencana-mode")).toHaveTextContent("Teliti");
    expect(screen.getByTestId("biaya-jawaban")).toHaveTextContent("Rp1.500");
    expect(screen.getByTestId("saldo-kepala")).toHaveTextContent("Rp23.500");
    // Percakapan baru ikut masuk riwayat.
    expect(within(screen.getByRole("navigation", { name: "Daftar percakapan" })).getByText("Apa itu iddah?")).toBeInTheDocument();
  });

  it("Shift+Enter menambah baris, bukan mengirim", async () => {
    pasang();
    render(<AletaAiChat />);
    const kotak = await screen.findByRole("textbox", { name: "Tulis pesan untuk ALETA Ai" });
    await userEvent.type(kotak, "baris satu{Shift>}{Enter}{/Shift}baris dua");
    expect(kotak).toHaveValue("baris satu\nbaris dua");
    expect(panggilan.some((p) => p.url.endsWith("/pesan"))).toBe(false);
  });

  it("peristiwa gagal menampilkan pesan ramah dan kotak tulis tersedia lagi", async () => {
    pasang({
      alir: (s) => {
        const a = buatAlir(s);
        queueMicrotask(() => {
          a.push({ jenis: "gagal", pesan: "Saldo belum cukup untuk jawaban ini." });
          a.tutup();
        });
        return a;
      },
    });
    render(<AletaAiChat />);
    await userEvent.type(await screen.findByRole("textbox", { name: "Tulis pesan untuk ALETA Ai" }), "tolong{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("Saldo belum cukup untuk jawaban ini.");
    await waitFor(() => expect(screen.getByRole("button", { name: "Kirim" })).toBeInTheDocument());
  });

  it("Hentikan memutus aliran dan menyimpan jawaban yang sudah tampil", async () => {
    let alir!: Alir;
    pasang({ alir: (s) => (alir = buatAlir(s)) });
    render(<AletaAiChat />);
    await userEvent.type(await screen.findByRole("textbox", { name: "Tulis pesan untuk ALETA Ai" }), "jelaskan panjang{Enter}");
    await screen.findByTestId("indikator-berpikir");
    await act(async () => {
      alir.push({ jenis: "teks", delta: "Sebagian jawaban" });
    });
    await screen.findByText("Sebagian jawaban");

    await userEvent.click(screen.getByRole("button", { name: "Hentikan jawaban" }));

    await waitFor(() => expect(screen.queryByTestId("jawaban-mengalir")).not.toBeInTheDocument());
    expect(screen.getByText("Sebagian jawaban")).toBeInTheDocument();
    expect(screen.getByText(/Jawaban berhenti sebelum selesai/)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Kirim" })).toBeInTheDocument();
  });
});

describe("pintasan (pemicu V4.5)", () => {
  it("chip dengan teks tertulis mengirim kode pemicunya", async () => {
    pasang({ alir: (s) => buatAlir(s) });
    render(<AletaAiChat />);
    const kotak = await screen.findByRole("textbox", { name: "Tulis pesan untuk ALETA Ai" });
    await userEvent.type(kotak, "Gaji tergugat 3 juta");
    await userEvent.click(within(screen.getByRole("list", { name: "Pintasan permintaan" })).getByRole("button", { name: "Kalkulator nafkah" }));

    await waitFor(() => expect(panggilan.some((p) => p.url.endsWith("/pesan"))).toBe(true));
    expect(panggilan.find((p) => p.url.endsWith("/pesan"))!.badan).toEqual({ teks: "Gaji tergugat 3 juta", pemicu: "ALETA_04" });
  });

  it("chip tanpa teks dipilih dulu, lalu Kirim memakai labelnya", async () => {
    pasang({ alir: (s) => buatAlir(s) });
    render(<AletaAiChat />);
    await screen.findByRole("textbox", { name: "Tulis pesan untuk ALETA Ai" });
    const chip = within(screen.getByRole("list", { name: "Pintasan permintaan" })).getByRole("button", { name: "Periksa BAS" });
    await userEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("pemicu-terpilih")).toHaveTextContent("Periksa BAS");
    expect(screen.getByTestId("pemicu-terpilih")).toHaveTextContent("Rp2.500");

    await userEvent.click(screen.getByRole("button", { name: "Kirim" }));
    await waitFor(() => expect(panggilan.some((p) => p.url.endsWith("/pesan"))).toBe(true));
    expect(panggilan.find((p) => p.url.endsWith("/pesan"))!.badan).toEqual({ teks: "Periksa BAS", pemicu: "ALETA_09" });
  });
});

describe("ALETA Ai belum diaktifkan", () => {
  it("menampilkan alasan ramah tanpa kotak tulis", async () => {
    pasang({ ringkas: { ...RINGKAS_BIASA, aktif: false, alasanNonaktif: "Layanan sedang dimatikan oleh admin sampai pengujian selesai." } });
    render(<AletaAiChat />);
    expect(await screen.findByText("ALETA Ai belum diaktifkan")).toBeInTheDocument();
    expect(screen.getByText(/dimatikan oleh admin sampai pengujian selesai/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kirim" })).not.toBeInTheDocument();
  });
});

describe("pengguna biasa tidak melihat nama model", () => {
  it("label yang berisi nama model diganti label mode", async () => {
    expect(labelAman("opus-max", "Opus 5.5 max")).toBe("Teliti");
    expect(labelAman("mendalam", "Opus 5.5")).toBe("Mendalam");
    expect(labelAman(undefined, "Cepat")).toBe("Cepat");

    pasang({
      daftar: DAFTAR,
      rincian: {
        p1: {
          id: "p1",
          judul: "Nafkah iddah perkara 12",
          pesan: [
            { id: "m1", peran: "pengguna", isi: "Hitung", waktu: sekarang.toISOString() },
            { id: "m2", peran: "ai", isi: "Selesai dihitung.", mode: "claude-opus-5-5", label: "Opus 5.5", biayaRp: 4000, waktu: sekarang.toISOString() },
          ],
        },
      },
    });
    const { container } = render(<AletaAiChat />);
    await userEvent.click(await screen.findByRole("button", { name: "Nafkah iddah perkara 12" }));
    await screen.findByText("Selesai dihitung.");
    expect(container.textContent).not.toMatch(/opus|sonnet|haiku|claude/i);
    expect(screen.getByTestId("lencana-mode")).toHaveTextContent("Teliti");
  });
});

describe("markdown aman", () => {
  it("tidak pernah membuat elemen dari HTML mentah dan menolak tautan berbahaya", () => {
    const { container } = render(
      <MarkdownAman
        teks={[
          "<script>window.__bocor = 1</script>",
          "<img src=x onerror=\"window.__bocor = 2\">",
          "[klik](javascript:alert(1)) dan [aman](https://contoh.go.id/x)",
        ].join("\n\n")}
      />
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<script>window.__bocor = 1</script>");
    const tautan = container.querySelectorAll("a");
    expect(tautan).toHaveLength(1);
    expect(tautan[0]).toHaveAttribute("href", "https://contoh.go.id/x");
    expect(tautan[0].getAttribute("rel")).toContain("noopener");
    expect(container.innerHTML).not.toContain("javascript:");
    expect((window as unknown as { __bocor?: number }).__bocor).toBeUndefined();
  });

  it("menampilkan judul, daftar, tabel, dan kode", () => {
    const { container } = render(
      <MarkdownAman
        teks={[
          "## Ringkasan",
          "- satu",
          "- dua",
          "",
          "1. pertama",
          "2. kedua",
          "",
          "| Unsur | Nilai |",
          "|---|---|",
          "| Iddah | 3 bulan |",
          "",
          "```",
          "a < b && c",
          "```",
        ].join("\n")}
      />
    );
    expect(screen.getByRole("heading", { name: "Ringkasan" })).toBeInTheDocument();
    expect(container.querySelectorAll("ul > li")).toHaveLength(2);
    expect(container.querySelectorAll("ol > li")).toHaveLength(2);
    expect(screen.getByRole("columnheader", { name: "Unsur" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "3 bulan" })).toBeInTheDocument();
    expect(container.querySelector("pre code")?.textContent).toBe("a < b && c");
  });

  it("blok kode yang belum ditutup (masih mengalir) tetap tampil sebagai kode", () => {
    const { container } = render(<MarkdownAman teks={"```\nbaris awal"} />);
    expect(container.querySelector("pre code")?.textContent).toBe("baris awal");
  });
});

describe("pembantu kontrak", () => {
  it("rupiah berformat Indonesia dan kelompok waktu benar", () => {
    expect(formatRupiah(1500)).toBe("Rp1.500");
    expect(formatRupiah(undefined)).toBe("Rp0");
    const patokan = new Date(2026, 9, 20, 12, 0, 0);
    expect(kelompokWaktu(new Date(2026, 9, 20, 1).toISOString(), patokan)).toBe("Hari ini");
    expect(kelompokWaktu(new Date(2026, 9, 19, 23).toISOString(), patokan)).toBe("Kemarin");
    expect(kelompokWaktu(new Date(2026, 9, 15).toISOString(), patokan)).toBe("7 hari terakhir");
    expect(kelompokWaktu(new Date(2026, 8, 1).toISOString(), patokan)).toBe("Lebih lama");
  });
});

// ---- Halaman pengaturan dan saldo --------------------------------------------------------

const portalTiruan = vi.hoisted(() => ({
  nilai: { currentUser: { roleId: "super-admin" }, activeUsers: [], positions: [], accessiblePortalApps: [{ id: "aleta-ai" }] } as Record<string, unknown>,
}));

vi.mock("@/lib/app-state", () => ({ usePortal: () => portalTiruan.nilai }));

const PENGATURAN = {
  margin: 30,
  penyanggaKurs: 3,
  minimumRp: 1000,
  pembulatanRp: 500,
  batasHarianRp: 50_000,
  aktif: true,
  tarif: [
    { model: "claude-opus-5-5", masuk: 15, keluar: 75, cacheTulis: 18.75, cacheBaca: 1.5 },
    { model: "claude-haiku-5-5", masuk: 1, keluar: 5, cacheTulis: 1.25, cacheBaca: 0.1 },
  ],
  rute: [{ kelompok: "Tanya cepat", model: "claude-haiku-5-5", effort: "low", label: "Cepat", peran: ["hakim"] }],
};

describe("halaman pengaturan (Super Admin saja)", () => {
  it("pengguna biasa ditolak dan tidak memanggil rute pengaturan", async () => {
    portalTiruan.nilai = { currentUser: { roleId: "hakim" }, activeUsers: [], positions: [], accessiblePortalApps: [{ id: "aleta-ai" }] };
    fetchTiruan.mockImplementation(async () => jawab(PENGATURAN));
    const { default: Halaman } = await import("@/app/(portal)/aleta-ai/pengaturan/page");
    const { container } = render(<Halaman />);
    expect(screen.getByTestId("access-denied-card")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/opus|haiku|margin/i);
    expect(fetchTiruan).not.toHaveBeenCalled();
  });

  it("Super Admin melihat tarif, rute, dan dapat menyimpan lewat PUT", async () => {
    portalTiruan.nilai = {
      currentUser: { roleId: "super-admin" },
      activeUsers: [{ id: "u1", name: "Hakim Satu", positionId: "pos1" }],
      positions: [{ id: "pos1", name: "Hakim" }],
      accessiblePortalApps: [{ id: "aleta-ai" }],
    };
    panggilan = [];
    fetchTiruan.mockImplementation(async (url: string, init?: RequestInit) => {
      const metode = (init?.method ?? "GET").toUpperCase();
      panggilan.push({ url, metode, badan: typeof init?.body === "string" ? JSON.parse(init.body) : undefined });
      if (url.includes("/pengaturan")) return jawab(PENGATURAN);
      if (url.includes("/kurs")) return jawab({ kurs: 16_300, tanggal: "2026-10-20", sumber: "JISDOR BI" });
      if (url.includes("/proyek")) return jawab({ versi: "4.5", modul: [{ nama: "ALETA_08", versi: "4.5" }] });
      if (url.includes("/laporan")) return jawab({ pendapatanRp: 100_000, biayaApiRp: 60_000, labaRp: 40_000, perModel: [{ nama: "Opus", giliran: 4, pendapatanRp: 100_000, biayaApiRp: 60_000, labaRp: 40_000 }] });
      if (url.includes("/saldo/isi")) return jawab({ saldoRp: 75_000 });
      return jawab({});
    });
    const { default: Halaman } = await import("@/app/(portal)/aleta-ai/pengaturan/page");
    render(<Halaman />);

    expect(await screen.findByTestId("aleta-ai-pengaturan")).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Tanya cepat" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "claude-opus-5-5" })).toBeInTheDocument();
    expect(screen.getByTestId("kurs-terakhir")).toHaveTextContent("2026-10-20");
    expect(screen.getByTestId("kurs-terakhir")).toHaveTextContent("JISDOR BI");
    expect(screen.getByText("ALETA_08")).toBeInTheDocument();

    const margin = screen.getByLabelText("Margin (%)");
    fireEvent.change(margin, { target: { value: "35" } });
    await userEvent.click(screen.getByRole("button", { name: /Simpan pengaturan/ }));
    await waitFor(() => expect(panggilan.some((p) => p.metode === "PUT")).toBe(true));
    expect((panggilan.find((p) => p.metode === "PUT")!.badan as { margin: number }).margin).toBe(35);
    expect(await screen.findByText("Pengaturan tersimpan.")).toBeInTheDocument();

    // Isi saldo: cari pengguna, isi jumlah.
    await userEvent.type(screen.getByLabelText("Cari pengguna"), "Hakim");
    await userEvent.click(await screen.findByRole("button", { name: /Hakim Satu/ }));
    await userEvent.type(screen.getByLabelText("Jumlah (Rp)"), "50000");
    await userEvent.type(screen.getByLabelText("Catatan"), "setoran");
    await userEvent.click(screen.getByRole("button", { name: "Isi saldo" }));
    await waitFor(() => expect(panggilan.some((p) => p.url.includes("/saldo/isi"))).toBe(true));
    expect(panggilan.find((p) => p.url.includes("/saldo/isi"))!.badan).toEqual({ penggunaId: "u1", jumlahRp: 50_000, catatan: "setoran" });

    // Laporan bulan.
    await userEvent.click(screen.getByRole("button", { name: "Tampilkan laporan" }));
    const laporan = await screen.findByTestId("laporan-bulan");
    expect(laporan).toHaveTextContent("Laba");
    expect(laporan).toHaveTextContent("Rp40.000");
  });
});

describe("halaman saldo", () => {
  it("menampilkan saldo dan mutasi", async () => {
    portalTiruan.nilai = { currentUser: { roleId: "hakim" }, activeUsers: [], positions: [], accessiblePortalApps: [{ id: "aleta-ai" }] };
    fetchTiruan.mockImplementation(async () =>
      jawab({
        saldoRp: 12_500,
        mutasi: [
          { id: "a", waktu: "2026-10-19T08:00:00.000Z", keterangan: "Isi saldo", jumlahRp: 20_000, saldoSesudahRp: 20_000 },
          { id: "b", waktu: "2026-10-19T09:00:00.000Z", keterangan: "Jawaban Teliti", jumlahRp: -7_500, saldoSesudahRp: 12_500 },
        ],
      })
    );
    const { default: Halaman } = await import("@/app/(portal)/aleta-ai/saldo/page");
    render(<Halaman />);
    expect(await screen.findByTestId("saldo-besar")).toHaveTextContent("Rp12.500");
    expect(screen.getByText("Jawaban Teliti")).toBeInTheDocument();
    expect(screen.getByText("-Rp7.500")).toBeInTheDocument();
    expect(screen.getByText("+Rp20.000")).toBeInTheDocument();
  });
});
