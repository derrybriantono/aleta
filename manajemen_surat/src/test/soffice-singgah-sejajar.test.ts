// @vitest-environment node

import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * KONVERSI SOFFICE: PERIKSA MESIN DISINGGAHKAN, DUA BERKAS SEJAJAR
 * ============================================================================
 *
 * Sebelum 25 September 2026 tiap konversi menjalankan DUA proses soffice
 * ("--version" lalu konversinya), dan dua berkas diubah BERURUTAN: satu
 * unggahan dua RTF = empat proses, waktu dinding = jumlah keduanya, dan tiap
 * proses boleh sampai 90 dtk - di dalam gerbang yang dahulu 60 dtk.
 *
 * soffice tidak terpasang di mesin pengembangan, jadi child_process.execFile
 * DITIRU: tiruan mencatat tiap proses (argumen, urutan mulai dan selesai) dan
 * menulis PDF palsu ke folder keluaran. Angka proses dan urutan mulai-selesai
 * di bawah ini hasil MENJALANKAN abtCetakService dan putusanUnggahService yang
 * asli di atas tiruan itu. Lama konversi sungguhan TIDAK terukur di sini.
 */

const require_ = createRequire(import.meta.url);
const akarBot = path.resolve(process.cwd(), "../aleta_bot");
const prosesAnak = require_("node:child_process") as { execFile: unknown };
const execFileAsli = prosesAnak.execFile;
const jalurCetak = require_.resolve(path.join(akarBot, "services/abtCetakService"));

type Proses = { jenis: "versi" | "konversi"; mulai: number; selesai?: number; batas?: number; isi?: string };
type Cetak = {
  dokumenKePdf: (isi: Buffer) => Promise<{ ok: boolean; pdf?: Buffer; alasan?: string }>;
  rtfKePdf: (isi: Buffer) => Promise<{ ok: boolean; alasan?: string }>;
  periksaMesin: () => Promise<{ ada: boolean; versi?: string; sebab?: string }>;
  BATAS_WAKTU_MS: number;
  BATAS_PERIKSA_MESIN_MS: number;
  MASA_SINGGAH_MESIN_MS: number;
};

/**
 * Memasang execFile tiruan, lalu memuat abtCetakService SEGAR (ia mengambil
 * execFile saat dimuat). `versi` menentukan jawaban "--version"; `tahan`
 * menahan tiap konversi sampai dilepas uji.
 */
function pasangSoffice({ versi = "ada", tahan = false }: { versi?: "ada" | "enoent" | "habis"; tahan?: boolean } = {}) {
  const proses: Proses[] = [];
  const tertahan: Array<{ isi: string; lepas: () => void }> = [];
  let detak = 0;
  prosesAnak.execFile = (
    _berkas: string,
    argumen: string[],
    opsi: { timeout?: number },
    balik: (galat: Error | null, keluaran?: string, galatKeluaran?: string) => void
  ) => {
    if (argumen[0] === "--version") {
      const satu: Proses = { jenis: "versi", mulai: detak++, batas: opsi?.timeout };
      proses.push(satu);
      setImmediate(() => {
        satu.selesai = detak++;
        if (versi === "enoent") return balik(Object.assign(new Error("spawn soffice ENOENT"), { code: "ENOENT" }));
        if (versi === "habis") {
          return balik(Object.assign(new Error("Command failed: soffice --version"), { killed: true }));
        }
        balik(null, "LibreOffice 7.6.4.1 (tiruan)\n", "");
      });
      return {};
    }
    const asal = argumen[argumen.indexOf("pdf") + 1];
    const keluar = argumen[argumen.indexOf("--outdir") + 1];
    // Isi berkas masukannya dicatat supaya uji tahu konversi mana milik
    // berkas mana - urutan tibanya di execFile tidak dijamin.
    const satu: Proses = {
      jenis: "konversi",
      mulai: detak++,
      batas: opsi?.timeout,
      isi: fs.readFileSync(asal, "latin1"),
    };
    proses.push(satu);
    const selesaikan = () => {
      fs.writeFileSync(path.join(keluar, path.basename(asal).replace(/\.[^.]+$/, ".pdf")), "%PDF-1.4 tiruan");
      satu.selesai = detak++;
      balik(null, "", "");
    };
    if (tahan) tertahan.push({ isi: satu.isi ?? "", lepas: selesaikan });
    else setImmediate(selesaikan);
    return {};
  };
  delete (require_.cache as Record<string, unknown>)[jalurCetak];
  const cetak = require_(jalurCetak) as Cetak;
  return { cetak, proses, tertahan };
}

const RTF = (isi: string) => Buffer.from(`{\\rtf1\\ansi ${isi}}`, "latin1");
const hitung = (proses: Proses[], jenis: Proses["jenis"]) => proses.filter((p) => p.jenis === jenis).length;
const tunggu = (syarat: () => boolean) =>
  vi.waitFor(() => {
    if (!syarat()) throw new Error("belum");
  });

afterEach(() => {
  prosesAnak.execFile = execFileAsli;
  delete (require_.cache as Record<string, unknown>)[jalurCetak];
  vi.useRealTimers();
});

describe("periksaMesin disinggahkan paling lama lima menit", () => {
  it("proses per konversi: 2 pada konversi pertama, 1 sesudahnya", async () => {
    const { cetak, proses } = pasangSoffice();
    expect((await cetak.dokumenKePdf(RTF("satu"))).ok).toBe(true);
    expect(proses.map((p) => p.jenis)).toEqual(["versi", "konversi"]);

    proses.length = 0;
    expect((await cetak.dokumenKePdf(RTF("dua"))).ok).toBe(true);
    expect(proses.map((p) => p.jenis)).toEqual(["konversi"]);
    // rtfKePdf (dokumen penetapan) memakai singgahan yang sama.
    proses.length = 0;
    expect((await cetak.rtfKePdf(RTF("tiga"))).ok).toBe(true);
    expect(proses.map((p) => p.jenis)).toEqual(["konversi"]);
  });

  it("umur singgahan: masih dipakai pada 4:59, diperiksa ulang pada 5:00", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const awal = new Date(2026, 8, 25, 9, 0, 0).getTime();
    vi.setSystemTime(awal);
    const { cetak, proses } = pasangSoffice();
    await cetak.periksaMesin();
    expect(hitung(proses, "versi")).toBe(1);

    vi.setSystemTime(awal + cetak.MASA_SINGGAH_MESIN_MS - 1000);
    await cetak.periksaMesin();
    expect(hitung(proses, "versi")).toBe(1);

    vi.setSystemTime(awal + cetak.MASA_SINGGAH_MESIN_MS);
    await cetak.periksaMesin();
    expect(hitung(proses, "versi")).toBe(2);
    expect(cetak.MASA_SINGGAH_MESIN_MS).toBeLessThanOrEqual(5 * 60_000);
  });

  it("pemeriksaan yang berjalan bersamaan berbagi SATU proses", async () => {
    const { cetak, proses } = pasangSoffice();
    const hasil = await Promise.all([cetak.periksaMesin(), cetak.periksaMesin(), cetak.periksaMesin()]);
    expect(hasil.every((h) => h.ada && h.versi === "LibreOffice 7.6.4.1 (tiruan)")).toBe(true);
    expect(hitung(proses, "versi")).toBe(1);
  });

  it("soffice tidak terpasang (ENOENT) disinggahkan dan sebabnya tetap disebut", async () => {
    const { cetak, proses } = pasangSoffice({ versi: "enoent" });
    const pertama = await cetak.dokumenKePdf(RTF("x"));
    const kedua = await cetak.dokumenKePdf(RTF("y"));
    expect(pertama.ok).toBe(false);
    expect(kedua.alasan).toContain("LibreOffice");
    expect(hitung(proses, "versi")).toBe(1);
    expect(hitung(proses, "konversi")).toBe(0);
  });

  it("periksa mesin yang habis waktu TIDAK disinggahkan - satu perlambatan tidak menolak lima menit", async () => {
    const { cetak, proses } = pasangSoffice({ versi: "habis" });
    expect((await cetak.periksaMesin()).ada).toBe(false);
    expect((await cetak.periksaMesin()).ada).toBe(false);
    expect(hitung(proses, "versi")).toBe(2);
  });

  it("jawaban singgahan tidak dapat dirusak pemanggilnya", async () => {
    const { cetak } = pasangSoffice();
    const satu = await cetak.periksaMesin();
    (satu as { ada: boolean }).ada = false;
    expect((await cetak.periksaMesin()).ada).toBe(true);
  });
});

describe("batas waktu: bot < gerbang 120 dtk < ekstensi", () => {
  it("batas periksa mesin dan batas konversi benar-benar dipakai execFile", async () => {
    const { cetak, proses } = pasangSoffice();
    await cetak.dokumenKePdf(RTF("x"));
    expect(proses.find((p) => p.jenis === "versi")?.batas).toBe(cetak.BATAS_PERIKSA_MESIN_MS);
    expect(proses.find((p) => p.jenis === "konversi")?.batas).toBe(cetak.BATAS_WAKTU_MS);
  });

  it("gerbang unggah menyerah TEPAT pada 120.000 ms, dan batas bot di bawahnya", async () => {
    const { cetak } = pasangSoffice();
    vi.useFakeTimers();
    const fetchAsli = globalThis.fetch;
    let sinyal: AbortSignal | undefined;
    globalThis.fetch = ((_url: string, init: RequestInit) =>
      new Promise((_, gagal) => {
        sinyal = init.signal ?? undefined;
        sinyal?.addEventListener("abort", () => gagal(Object.assign(new Error("dibatalkan"), { name: "AbortError" })));
      })) as typeof fetch;
    try {
      const { gatewayUnggahPutusanSipp } = await import("@/server/modules/aleta-bot/whatsapp-gateway-client");
      const janji = gatewayUnggahPutusanSipp({
        perkaraId: "1",
        nomorPerkara: "1/Pdt.G/2026/PA.Dgl",
        putusanBase64: "e1xydGYxfQ==",
        olehUsername: "petugas uji",
        ip: "",
      });
      await vi.advanceTimersByTimeAsync(119_999);
      expect(sinyal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(sinyal?.aborted).toBe(true);
      expect((await janji).ok).toBe(false);
      const GERBANG_MS = 120_000;

      // Per konversi di bawah gerbang, dan periksa mesin + satu konversi
      // (dua berkas diubah sejajar) pun di bawah gerbang.
      expect(cetak.BATAS_WAKTU_MS).toBeLessThan(GERBANG_MS);
      expect(cetak.BATAS_PERIKSA_MESIN_MS + cetak.BATAS_WAKTU_MS).toBeLessThan(GERBANG_MS);
    } finally {
      globalThis.fetch = fetchAsli;
    }
  });
});

// ============================================================================
// DUA BERKAS DIUBAH SEJAJAR DALAM SATU UNGGAHAN (putusanUnggahService asli)
// ============================================================================
const folderUji: string[] = [];
afterAll(() => {
  for (const f of folderUji) fs.rmSync(f, { recursive: true, force: true });
});

function muatUnggah() {
  const Module = require_("module") as unknown as new (id: string) => {
    filename: string;
    loaded: boolean;
    exports: unknown;
  };
  const pasang = (jalur: string, isi: unknown) => {
    const m = new Module(jalur);
    m.filename = jalur;
    m.loaded = true;
    m.exports = isi;
    (require_.cache as Record<string, unknown>)[jalur] = m;
  };
  const akar = fs.mkdtempSync(path.join(os.tmpdir(), "aleta-uji-sejajar-"));
  folderUji.push(akar);
  const tulisan: string[] = [];
  pasang(require_.resolve(path.join(akarBot, "db_config")), {
    query: (sql: string, _p: unknown[], balik: (g: unknown, h: unknown) => void) => {
      const s = String(sql);
      if (!s.startsWith("SELECT")) tulisan.push(s.trim().split(/\s+/).slice(0, 3).join(" "));
      if (s.includes("SELECT tanggal_putusan")) return balik(null, [{ tanggal_putusan: "2026-09-01" }]);
      if (s.includes("dirput_dokumen_ref")) return balik(null, [{ ref: 89 }]);
      return balik(null, s.startsWith("SELECT") ? [] : { affectedRows: 1 });
    },
  });
  pasang(require_.resolve(path.join(akarBot, "services/sippSkemaService")), { tabelAda: async () => true });
  pasang(require_.resolve(path.join(akarBot, "services/dokumenPenetapanService")), {
    periksaAkarSipp: () => ({ dapatDitulis: true, akar }),
    samakanPemilikSipp: () => undefined,
  });
  const jalur = require_.resolve(path.join(akarBot, "services/putusanUnggahService"));
  delete (require_.cache as Record<string, unknown>)[jalur];
  const layanan = require_(jalur) as {
    unggahPutusan: (m: Record<string, unknown>) => Promise<{ ok: boolean; berkas: Array<{ ok: boolean; jalurPdf?: string }> }>;
  };
  return { layanan, tulisan };
}

const DUA_RTF = {
  perkaraId: "901",
  nomorPerkara: "12/Pdt.G/2026/PA.Dgl",
  olehUsername: "petugas uji",
  ip: "192.168.9.121",
  pdfPutusan: RTF("PUTUSAN Nomor 12/Pdt.G/2026/PA.Dgl"),
  pdfAnonimisasi: RTF("PUTUSAN anonim Nomor 12/Pdt.G/2026/PA.Dgl"),
};

describe("unggah dua RTF: dua konversi dimulai sebelum salah satunya selesai", () => {
  it("kedua konversi berjalan bersamaan, lalu ditulis putusan dahulu", async () => {
    const { proses, tertahan } = pasangSoffice({ tahan: true });
    const { layanan, tulisan } = muatUnggah();
    const jalan = layanan.unggahPutusan({ ...DUA_RTF });

    // Keduanya sudah dimulai padahal belum satu pun dilepas.
    await tunggu(() => hitung(proses, "konversi") === 2);
    expect(proses.filter((p) => p.jenis === "konversi").every((p) => p.selesai === undefined)).toBe(true);
    expect(tulisan).toEqual([]);

    // Anonimisasi selesai lebih dulu; tulisan tetap menunggu putusan.
    const anonim = tertahan.find((t) => t.isi.includes("anonim"));
    const putusan = tertahan.find((t) => !t.isi.includes("anonim"));
    expect(anonim && putusan).toBeTruthy();
    anonim?.lepas();
    await new Promise((r) => setTimeout(r, 20));
    expect(tulisan).toEqual([]);
    putusan?.lepas();
    const hasil = await jalan;
    expect(hasil.berkas.map((b) => b.ok)).toEqual([true, true]);
    expect(hasil.berkas.map((b) => b.jalurPdf)).toEqual([
      "resources/file/doc/2026/09/PA.Dgl_2026_Pdt.G_12_putusan_akhir.pdf",
      "resources/file/anonimisasi/2026/09/PA.Dgl_2026_Pdt.G_12_putusan_anonimisasi.pdf",
    ]);

    const konversi = proses.filter((p) => p.jenis === "konversi");
    const mulaiTerakhir = Math.max(...konversi.map((p) => p.mulai));
    const selesaiPertama = Math.min(...konversi.map((p) => p.selesai ?? Infinity));
    expect(mulaiTerakhir).toBeLessThan(selesaiPertama);
  });

  it("jumlah proses soffice untuk dua RTF: 3 saat mesin belum diperiksa, 2 sesudahnya (dahulu 4 dan 4)", async () => {
    const { proses } = pasangSoffice();
    const { layanan } = muatUnggah();
    await layanan.unggahPutusan({ ...DUA_RTF });
    // Periksa mesin serentak dari dua konversi berbagi satu proses.
    expect({ versi: hitung(proses, "versi"), konversi: hitung(proses, "konversi") }).toEqual({ versi: 1, konversi: 2 });

    proses.length = 0;
    await layanan.unggahPutusan({ ...DUA_RTF });
    expect({ versi: hitung(proses, "versi"), konversi: hitung(proses, "konversi") }).toEqual({ versi: 0, konversi: 2 });
  });

  it("PDF tidak diubah sama sekali - nol proses", async () => {
    const { proses } = pasangSoffice();
    const { layanan } = muatUnggah();
    await layanan.unggahPutusan({
      ...DUA_RTF,
      pdfPutusan: Buffer.from("%PDF-1.4 putusan"),
      pdfAnonimisasi: Buffer.from("%PDF-1.4 anonim"),
    });
    expect(proses).toEqual([]);
  });
});
