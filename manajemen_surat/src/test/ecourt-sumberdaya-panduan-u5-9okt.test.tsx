/**
 * ============================================================================
 * AUDIT U5 (9 Oktober 2026) - INTEGRASI e-COURT, SUMBER DAYA SERVER, PANDUAN
 * ============================================================================
 *
 * Tiap butir di sini MERAH sebelum perbaikannya dan HIJAU sesudahnya:
 *
 *   1. Rute admin Integrasi e-Court (arsip, jadwal, pemberitahuan, login akun
 *      pengadilan) dulu hanya memeriksa "sudah login" - staf mana pun dapat
 *      menghapus arsip berkas perkara. Kini Super Admin dan Admin saja; Admin
 *      tetap dapat (fitur lama tidak berkurang).
 *   2. Batas lampiran WhatsApp 16 MB ikut menolak UNDUHAN berkas 17 MB yang
 *      sah tersimpan (jembatan menyimpan sampai 64 MB).
 *   3. Pembersih masa simpan menghitung berkas yang sudah hilang dari disk
 *      sebagai "gagal" selamanya - dan berkas 17 MB tidak pernah terhapus.
 *   4. Admin > Sumber daya server menampilkan "[object Object]" saat bot mati.
 *   5. Disk ALETA = ukuran Postgres saja (bot belum mengukur) tampil tanpa
 *      tanda SEBAGIAN.
 *   6. Kartu Ruang dan Masa Simpan menulis "0 berkas dihapus." padahal bot
 *      tidak menghapus apa pun karena SIPP tidak terbaca.
 *   8. Tarik "belum upload": sesi portal habis (401) terbaca "ALETA Bot tidak
 *      tersambung".
 *   9. /panduan: Panitera Muda (pejabat-struktural) melihat panduan patch
 *      server lewat SSH yang khusus Super Admin & Admin.
 *   +  Unduh berkas e-Court saat bot mati: "ALETA Bot belum dapat dihubungi"
 *      (503), dan permintaan ke bot punya batas waktu.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { positions, personas } from "@/lib/mock-data";

const AKAR = path.resolve(process.cwd(), "..");

// ---------------------------------------------------------------------------
// Tiruan bersama
// ---------------------------------------------------------------------------

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-humas"; // staf humas - tidak bersinggungan dengan perkara
let pengguna = personas.find((u) => u.id === "usr-gugatan")!;

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));
vi.mock("@/lib/app-state", () => ({ usePortal: () => ({ currentUser: pengguna, positions }) }));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: unknown; href: string }) => <a href={href}>{children as never}</a>,
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", async (asli) => {
  const modul = await asli<Record<string, unknown>>();
  return {
    ...modul,
    bersihkanGatewayEcourtArsip: vi.fn(async () => ({ ok: true, data: { ok: true, aktif: true, terhapus: 7, gagal: 0 } })),
    saveGatewayEcourtArsip: vi.fn(async () => ({ ok: true, data: { ok: true } })),
    jalankanGatewayEcourtSekarang: vi.fn(async () => ({ ok: true, data: { ok: true, dimulai: true } })),
    keluarGatewayEcourt: vi.fn(async () => ({ ok: true, data: { ok: true } })),
    setGatewayEcourtAktif: vi.fn(async () => ({ ok: true, data: { aktif: false } })),
  };
});

const gerbang = await import("@/server/modules/aleta-bot/whatsapp-gateway-client");
const { SumberDayaPanel } = await import("@/components/portal/sumber-daya-panel");
const { AletaEcourtArsip } = await import("@/components/portal/aleta-ecourt-arsip");
const { tarikBelumUpload } = await import("@/lib/tarik-belum-upload");
const { gabungTambahanPortal, bersihkanJawabanBot } = await import("@/server/modules/sumber-daya/layanan");
const { handleRouteError } = await import("@/server/shared/http");
const { ApiError } = await import("@/server/shared/errors");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// 1 + unduh berkas: rute (satu basis data untuk seluruh blok - pg-mem lambat)
// ---------------------------------------------------------------------------

describe("rute Integrasi e-Court", () => {
  beforeAll(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
  }, 600_000);
  afterAll(async () => {
    await db?.close();
    db = null;
  });

  const kirim = (badan: unknown) =>
    new NextRequest("http://localhost/x", { method: "POST", body: JSON.stringify(badan) });

  it("staf: menghapus arsip, mengubah masa simpan, menarik, keluar sesi, mematikan pemberitahuan -> 403 semua", async () => {
    aktor = "usr-humas";
    const arsip = await import("@/app/api/aleta-ecourt/arsip/route");
    const jadwal = await import("@/app/api/aleta-ecourt/jadwal/route");
    const ecourt = await import("@/app/api/aleta-bot/ecourt/route");
    const login = await import("@/app/api/aleta-bot/ecourt/login/route");

    const hasil = [
      await arsip.POST(kirim({ aksi: "bersihkan", hapus: true })),
      await arsip.POST(kirim({ minRuangGb: 1, maksBerkasMb: 1, simpanBulan: 1 })),
      await jadwal.POST(kirim({ aksi: "jalankan" })),
      await login.POST(kirim({ aksi: "keluar" })),
      await ecourt.POST(kirim({ aktif: false })),
    ];
    expect(hasil.map((r) => r.status)).toEqual([403, 403, 403, 403, 403]);
    expect(gerbang.bersihkanGatewayEcourtArsip).not.toHaveBeenCalled();
    expect(gerbang.saveGatewayEcourtArsip).not.toHaveBeenCalled();
    expect(gerbang.jalankanGatewayEcourtSekarang).not.toHaveBeenCalled();
    expect(gerbang.keluarGatewayEcourt).not.toHaveBeenCalled();
    expect(gerbang.setGatewayEcourtAktif).not.toHaveBeenCalled();
  }, 600_000);

  it("Admin tetap dapat membersihkan arsip dan menjalankan penarikan (fitur lama tidak berkurang)", async () => {
    aktor = "usr-admin";
    const arsip = await import("@/app/api/aleta-ecourt/arsip/route");
    const jadwal = await import("@/app/api/aleta-ecourt/jadwal/route");
    const r1 = await arsip.POST(kirim({ aksi: "bersihkan", hapus: true }));
    const r2 = await jadwal.POST(kirim({ aksi: "jalankan" }));
    expect([r1.status, r2.status]).toEqual([200, 200]);
    expect(gerbang.bersihkanGatewayEcourtArsip).toHaveBeenCalledWith(expect.objectContaining({ hapus: true }));
    expect(gerbang.jalankanGatewayEcourtSekarang).toHaveBeenCalled();
  }, 600_000);

  it("unduh berkas saat bot mati: 503 'ALETA Bot belum dapat dihubungi', dan fetch ke bot membawa batas waktu", async () => {
    aktor = "usr-admin";
    const panggilan: RequestInit[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_alamat: string, init?: RequestInit) => {
        panggilan.push(init ?? {});
        throw new TypeError("fetch failed", {
          cause: Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:3003"), { code: "ECONNREFUSED" }),
        });
      })
    );
    const { GET } = await import("@/app/api/aleta-ecourt/berkas/route");
    const r = await GET(new NextRequest("http://localhost/api/aleta-ecourt/berkas?documentKey=k1&format=pdf"));
    const isi = (await r.json()) as { error?: { message?: string } };
    expect(r.status).toBe(503);
    expect(isi.error?.message).toContain("ALETA Bot belum dapat dihubungi");
    expect(panggilan[0]?.signal).toBeInstanceOf(AbortSignal);
  }, 600_000);
});

// ---------------------------------------------------------------------------
// 2 + 3: bot - batas 16 MB dan pembersih masa simpan
// ---------------------------------------------------------------------------

describe("bot: arsip e-Court", () => {
  const req = createRequire(path.join(AKAR, "aleta_bot/package.json"));
  const TMP = path.join("D:/Aplikasi/aleta/tmp", `u5-ecourt-${process.pid}`);
  const lamaRoot = process.env.ALETA_BOT_ECOURT_DOCUMENT_ROOT;
  const disuntik: string[] = [];
  let arsip: any;
  let dok: any;

  function suntik(rel: string, exports: unknown) {
    const p = req.resolve(path.join(AKAR, "aleta_bot", rel));
    disuntik.push(p);
    req.cache[p] = { id: p, filename: p, loaded: true, exports } as never;
  }

  beforeAll(() => {
    mkdirSync(path.join(TMP, "perkara-a"), { recursive: true });
    writeFileSync(path.join(TMP, "perkara-a", "besar.pdf"), Buffer.alloc(17 * 1024 * 1024, 1));
    writeFileSync(path.join(TMP, "perkara-a", "kecil.pdf"), Buffer.from("%PDF-1.4 uji"));
    process.env.ALETA_BOT_ECOURT_DOCUMENT_ROOT = TMP;

    suntik("config/runtime-config.js", {
      readRuntimeConfig: () => ({ ecourtArsip: { minRuangGb: 1, maksBerkasMb: 50, simpanBulan: 12 } }),
      writeRuntimeConfig: () => {},
    });
    suntik("services/logService.js", { logSecurityEvent: async () => {}, logSystemEvent: async () => {} });
    suntik("services/ecourtStoreService.js", { ensureSchema: async () => {} });
    suntik("services/sippJadwalSidangService.js", {
      perkaraFinal: async () => ({ "1/Pdt.G/2020/PA.Dgl": { tanggalBht: "2020-02-01", tanggalMinutasi: "" } }),
    });
    suntik("services/botDbService.js", {
      toMysqlDate: (d: Date) => d.toISOString().slice(0, 19).replace("T", " "),
      query: async (sql: string) =>
        /^\s*SELECT/i.test(sql)
          ? [
              // Sudah hilang dari disk (keadaan nyata server: 400 hilang, 15 Sep).
              { id: 1, document_key: "k1", format: "pdf", jalur_berkas: "perkara-a/hilang.pdf", ukuran_byte: 100, nomor_perkara: "1/Pdt.G/2020/PA.Dgl" },
              // 17 MB, sah tersimpan.
              { id: 2, document_key: "k2", format: "pdf", jalur_berkas: "perkara-a/besar.pdf", ukuran_byte: 17 * 1024 * 1024, nomor_perkara: "1/Pdt.G/2020/PA.Dgl" },
              // Jalur di luar folder arsip: TETAP tidak boleh disentuh.
              { id: 3, document_key: "k3", format: "pdf", jalur_berkas: "../luar.pdf", ukuran_byte: 1, nomor_perkara: "1/Pdt.G/2020/PA.Dgl" },
            ]
          : [],
    });
    for (const rel of ["services/ecourtDocumentService.js", "services/ecourtArsipService.js"]) {
      const p = req.resolve(path.join(AKAR, "aleta_bot", rel));
      disuntik.push(p);
      delete req.cache[p];
    }
    dok = req(path.join(AKAR, "aleta_bot/services/ecourtDocumentService.js"));
    arsip = req(path.join(AKAR, "aleta_bot/services/ecourtArsipService.js"));
  });

  afterAll(() => {
    for (const p of disuntik) delete req.cache[p];
    if (lamaRoot === undefined) delete process.env.ALETA_BOT_ECOURT_DOCUMENT_ROOT;
    else process.env.ALETA_BOT_ECOURT_DOCUMENT_ROOT = lamaRoot;
    rmSync(TMP, { recursive: true, force: true });
  });

  it("berkas 17 MB dapat diunduh; batas 16 MB hanya untuk lampiran WhatsApp", () => {
    expect(dok.describeEcourtDocument("perkara-a/besar.pdf")).toMatchObject({ ok: true });
    expect(dok.describeEcourtDocument("perkara-a/besar.pdf", { batasByte: dok.MAX_ATTACHMENT_BYTES }).ok).toBe(false);
    expect(dok.pickBestAttachment({ berkasPdf: "perkara-a/besar.pdf" }).ok).toBe(false);
    expect(dok.pickBestAttachment({ berkasPdf: "perkara-a/kecil.pdf" }).ok).toBe(true);
    // Penjagaan jalur tidak berubah.
    expect(dok.describeEcourtDocument("../../etc/passwd").ok).toBe(false);
    expect(dok.jalurDiDalamArsip("../luar.pdf")).toBeNull();
  });

  it("pembersih: berkas yang hilang dianggap selesai, berkas 17 MB terhapus, jalur di luar folder tetap ditolak", async () => {
    const h = await arsip.bersihkan({ hapus: true });
    expect(h.terhapus).toBe(2);
    expect(h.gagal).toBe(1);
    expect(() => readFileSync(path.join(TMP, "perkara-a", "besar.pdf"))).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 4 + 5: Sumber daya server
// ---------------------------------------------------------------------------

describe("Admin > Sumber daya server", () => {
  it("bot mati: sebab dari server tampil, bukan [object Object]", async () => {
    const badan = await handleRouteError(new ApiError(503, "ALETA Bot tidak menjawab dalam batas waktu.")).text();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(badan, { status: 503, headers: { "Content-Type": "application/json" } })));
    render(<SumberDayaPanel />);
    await waitFor(() => expect(document.body.textContent).toMatch(/batas waktu|object Object/));
    expect(document.body.textContent).not.toContain("[object Object]");
    expect(document.body.textContent).toContain("ALETA Bot tidak menjawab dalam batas waktu.");
  });

  it("bot belum mengukur disk ALETA: ukuran Postgres saja bertanda sebagian", () => {
    const GIB = 1024 ** 3;
    const bersih = bersihkanJawabanBot({
      ambang: { ram: { kuning: 75, merah: 90 }, disk: { kuning: 80, merah: 90 }, gpu: { kuning: 70, merah: 90 } },
      ringkas: {
        aleta: {
          ram: { byte: null, totalByte: null, persen: null, warna: "kelabu" },
          disk: { byte: null, totalByte: 200 * GIB, persen: null, warna: "kelabu", sebagian: false },
          gpu: { ada: false },
        },
        server: { ram: {}, disk: {}, gpu: { ada: false } },
      },
      rincian: { diskAleta: { byte: null, lengkap: false, rincian: [] } },
    })!;
    const hasil = gabungTambahanPortal(bersih, { postgresByte: 0.3 * GIB, portalSendiri: null });
    expect(hasil.ringkas.aleta.disk.byte).toBe(0.3 * GIB);
    expect(hasil.ringkas.aleta.disk.sebagian).toBe(true);
  });

  it("bot SUDAH mengukur disk lengkap: tambahan Postgres tidak menandai sebagian", () => {
    const GIB = 1024 ** 3;
    const bersih = bersihkanJawabanBot({
      ringkas: {
        aleta: { ram: {}, disk: { byte: 10 * GIB, totalByte: 200 * GIB, persen: 5, warna: "hijau" }, gpu: { ada: false } },
        server: { ram: {}, disk: {}, gpu: { ada: false } },
      },
      rincian: { diskAleta: { byte: 10 * GIB, lengkap: true, rincian: [] } },
    })!;
    const hasil = gabungTambahanPortal(bersih, { postgresByte: 1 * GIB, portalSendiri: null });
    expect(hasil.ringkas.aleta.disk.byte).toBe(11 * GIB);
    expect(hasil.ringkas.aleta.disk.sebagian).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 6: kartu Ruang dan Masa Simpan
// ---------------------------------------------------------------------------

describe("kartu Ruang dan Masa Simpan", () => {
  const arsipData = (kedaluwarsa: Record<string, unknown>) => ({
    pengaturan: { minRuangGb: 5, maksBerkasMb: 50, simpanBulan: 12 },
    ruang: { ok: true, bebasGb: 50, totalGb: 200 },
    arsip: { jumlahBerkas: 10, totalMb: 30 },
    kedaluwarsa,
    ruangMenipis: false,
  });

  it("SIPP tidak terbaca saat menghapus: sebabnya tampil, bukan '0 berkas dihapus'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) =>
        init?.method === "POST"
          ? Response.json({
              ok: true,
              data: { ok: true, aktif: true, alasan: "sipp_tidak_terbaca: connect ETIMEDOUT", jumlah: 0, totalMb: 0, terhapus: 0, gagal: 0 },
            })
          : Response.json({ ok: true, data: { available: true, message: "", arsip: arsipData({ aktif: true, jumlah: 3, totalMb: 2 }) } })
      )
    );
    render(<AletaEcourtArsip />);
    fireEvent.click(await screen.findByText("Hapus Berkas Kedaluwarsa"));
    fireEvent.click(await screen.findByText("Ya, hapus 3 berkas"));
    await waitFor(() => expect(document.body.textContent).toContain("SIPP tidak terbaca"));
    expect(document.body.textContent).not.toContain("0 berkas dihapus");
  });

  it("angka kedaluwarsa yang tidak dapat dihitung disebut sebabnya, bukan 0", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ok: true,
          data: { available: true, message: "", arsip: arsipData({ aktif: true, jumlah: 0, totalMb: 0, alasan: "sipp_tidak_terbaca: x" }) },
        })
      )
    );
    render(<AletaEcourtArsip />);
    expect(await screen.findByText("belum dapat dihitung: SIPP tidak terbaca")).toBeTruthy();
  });

  it("penghapusan yang berhasil tetap dilaporkan seperti dulu", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) =>
        init?.method === "POST"
          ? Response.json({ ok: true, data: { ok: true, aktif: true, jumlah: 3, totalMb: 2, terhapus: 3, gagal: 0 } })
          : Response.json({ ok: true, data: { available: true, message: "", arsip: arsipData({ aktif: true, jumlah: 3, totalMb: 2 }) } })
      )
    );
    render(<AletaEcourtArsip />);
    fireEvent.click(await screen.findByText("Hapus Berkas Kedaluwarsa"));
    fireEvent.click(await screen.findByText("Ya, hapus 3 berkas"));
    await waitFor(() => expect(document.body.textContent).toContain("3 berkas dihapus"));
  });
});

// ---------------------------------------------------------------------------
// 8: tarik "belum upload"
// ---------------------------------------------------------------------------

describe("tarik 'belum upload' - penolakan oleh portal", () => {
  const tarik = (status: number, badan: unknown) =>
    tarikBelumUpload({
      nomorPerkara: "1/Pdt.G/2026/PA.Dgl",
      tanggal: "2026-10-09",
      alamat: "/api/aleta-ecourt/sidang/verifikasi-ecourt/tarik",
      ambil: vi.fn(async () => Response.json(badan, { status })),
    });

  it("401: sesi ALETA berakhir, bukan 'ALETA Bot tidak tersambung'", async () => {
    const h = await tarik(401, { ok: false, error: { message: "Sesi berakhir." } });
    expect(h.tahap).toBe("masalah");
    expect(h.pesan).not.toContain("ALETA Bot tidak tersambung");
    expect(h.pesan).toContain("masuk ulang");
  });

  it("403: pesan kewenangan dari server", async () => {
    const h = await tarik(403, { ok: false, error: { message: "Akses ditolak untuk kemampuan panel." } });
    expect(h.pesan).toBe("Akses ditolak untuk kemampuan panel.");
  });

  it("500 tanpa jawaban portal tetap terbaca sebagai bot tidak tersambung (perilaku lama)", async () => {
    const h = await tarik(500, null);
    expect(h.pesan).toContain("ALETA Bot tidak tersambung");
  });
});

// ---------------------------------------------------------------------------
// 9: /panduan
// ---------------------------------------------------------------------------

describe("/panduan - panduan teknis hanya bagi yang berwenang", () => {
  const gambar = async (id: string) => {
    pengguna = personas.find((u) => u.id === id)!;
    const { default: Halaman } = await import("@/app/(portal)/panduan/page");
    render(<Halaman />);
    // Halaman kini membuka Tutorial per fitur lebih dulu; panduan lengkap di tab kedua.
    fireEvent.click(screen.getByRole("tab", { name: /Panduan lengkap/ }));
    return document.body.textContent || "";
  };

  it("Panmud Gugatan (pejabat-struktural) tidak melihat panduan patch server lewat SSH, tetapi tetap melihat panduan pejabat", async () => {
    const teks = await gambar("usr-gugatan");
    expect(teks).not.toContain("Copy Patch Manual lewat SSH CentOS 7");
    expect(teks).not.toContain("Database PostgreSQL untuk Super Admin");
    expect(teks).toContain("Approval E-Kepegawaian untuk Pejabat Berwenang");
  });

  it("Sekretaris: tanpa panduan teknis server, dengan panduan PLH/PLT", async () => {
    const teks = await gambar("usr-sekretaris");
    expect(teks).not.toContain("Copy Patch Manual lewat SSH CentOS 7");
    expect(teks).toContain("Panduan Umum PLH/PLT");
  });

  it("Admin tetap melihat panduan teknis server", async () => {
    const teks = await gambar("usr-admin");
    expect(teks).toContain("Copy Patch Manual lewat SSH CentOS 7");
  });
});
