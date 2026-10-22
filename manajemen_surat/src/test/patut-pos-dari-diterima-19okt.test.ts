// @vitest-environment node

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { labelTidakPatut } from "@/lib/label-kepatutan";

/**
 * Surat tercatat dinilai dari tanggal DITERIMA (19 Oktober 2026).
 * Perkara 632/Pdt.G/2026/PA.Dgl: dikirim pos 9 Oktober, relaas (diterima)
 * 19 Oktober = hari sidang. Dahulu tertulis "patut 10 hari".
 */
const akar = path.resolve(process.cwd(), "..");
const baca = (jalur: string) => readFileSync(path.join(akar, jalur), "utf8").replace(/\r\n/g, "\n");
const muat = createRequire(path.join(akar, "aleta_bot", "app.js"));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const panggilan = muat("./services/ecourtPanggilanService.js");

describe("kepatutan surat tercatat dihitung dari tanggal diterima", () => {
  it("perkara 632: dikirim 9 Okt, diterima pada hari sidang -> tidak patut", () => {
    const dibaca = panggilan.bacaRelaas({
      ketTemu: "S",
      noResiPos: "P2610090030753",
      tanggalKirimPos: "2026-10-09",
      tanggalRelaas: "2026-10-19",
      statusPos: null,
    });
    expect(dibaca.jalur).toBe("pos");
    expect(dibaca.diterima).toBe(true);
    expect(dibaca.tanggalDiterima).toBe("2026-10-19");

    const nilai = panggilan.nilaiKepatutan({
      tanggalPanggilan: dibaca.tanggalKirim,
      tanggalSidang: "2026-10-19",
      jalur: "surat_tercatat",
      diterima: dibaca.diterima,
      tanggalDiterima: dibaca.tanggalDiterima,
    });
    expect(nilai.patut).toBe(false);
    expect(nilai.alasan).toBe("diterima_kurang_dari_ambang");
    expect(nilai.selisih).toBe(0);
    expect(nilai.selisihKirim).toBe(10);
  });

  it("diterima cukup jauh sebelum sidang tetap patut, dihitung dari tanggal diterima", () => {
    const nilai = panggilan.nilaiKepatutan({
      tanggalPanggilan: "2026-10-01",
      tanggalSidang: "2026-10-19",
      jalur: "surat_tercatat",
      diterima: true,
      tanggalDiterima: "2026-10-08",
    });
    expect(nilai.patut).toBe(true);
    // SEMA 1/2023 angka 11 (W58, 22 Okt): jarak DITERIMA dihitung hari KERJA -
    // 8 Okt (Kamis) ke 19 Okt (Senin) = 7 hari kerja (dulu 11 hari kalender).
    expect(nilai.selisih).toBe(7);
    expect(nilai.terimaHariKerja).toBe(true);
    expect(nilai.ambangTerima).toBe(3);
  });

  it("SEMA 1/2023 angka 11: dikirim 6 hari kalender, diterima 3 hari kerja sebelum sidang -> patut", () => {
    // Sidang Senin 19 Okt; dikirim Selasa 13 Okt (6 hari kalender);
    // diterima Rabu 14 Okt -> 15, 16, 19 = 3 hari kerja.
    const nilai = panggilan.nilaiKepatutan({
      tanggalPanggilan: "2026-10-13",
      tanggalSidang: "2026-10-19",
      jalur: "surat_tercatat",
      diterima: true,
      tanggalDiterima: "2026-10-14",
    });
    expect(nilai.patut).toBe(true);
    expect(nilai.selisih).toBe(3);
    expect(nilai.dasarHukum).toContain("SEMA 1/2023 angka 11");
    // Diterima Kamis 15 Okt -> 16, 19 = 2 hari kerja: tidak patut.
    const kurang = panggilan.nilaiKepatutan({
      tanggalPanggilan: "2026-10-13",
      tanggalSidang: "2026-10-19",
      jalur: "surat_tercatat",
      diterima: true,
      tanggalDiterima: "2026-10-15",
    });
    expect(kurang.patut).toBe(false);
    expect(kurang.alasan).toBe("diterima_kurang_dari_ambang");
    // Dikirim 5 hari kalender sebelum sidang: tidak patut walau cepat diterima.
    const telatKirim = panggilan.nilaiKepatutan({
      tanggalPanggilan: "2026-10-14",
      tanggalSidang: "2026-10-19",
      jalur: "surat_tercatat",
      diterima: true,
      tanggalDiterima: "2026-10-14",
    });
    expect(telatKirim.patut).toBe(false);
    expect(telatKirim.alasan).toBe("tenggang_kurang_dari_ambang");
  });

  it("diterima sesudah hari sidang", () => {
    const nilai = panggilan.nilaiKepatutan({
      tanggalPanggilan: "2026-10-01",
      tanggalSidang: "2026-10-19",
      jalur: "surat_tercatat",
      diterima: true,
      tanggalDiterima: "2026-10-21",
    });
    expect(nilai.patut).toBe(false);
    expect(nilai.alasan).toBe("diterima_setelah_hari_sidang");
  });

  it("tanpa tanggal diterima, aturan lama tetap (penerimaan belum terbukti)", () => {
    const nilai = panggilan.nilaiKepatutan({
      tanggalPanggilan: "2026-10-01",
      tanggalSidang: "2026-10-19",
      jalur: "surat_tercatat",
      diterima: null,
    });
    expect(nilai.patut).toBe(null);
    expect(nilai.alasan).toBe("penerimaan_belum_terbukti");
  });

  it("panggilan jurusita tidak berubah", () => {
    const nilai = panggilan.nilaiKepatutan({
      tanggalPanggilan: "2026-10-13",
      tanggalSidang: "2026-10-19",
      jalur: "biasa",
      diterima: true,
    });
    expect(nilai.patut).toBe(true);
  });
});

describe("label tidak patut menyebut jalurnya", () => {
  it("pos, jurusita, elektronik", () => {
    expect(labelTidakPatut("surat_tercatat")).toBe("tidak patut (pos)");
    expect(labelTidakPatut("biasa")).toBe("tidak patut (jurusita)");
    expect(labelTidakPatut("elektronik")).toBe("tidak patut (elektronik)");
    expect(labelTidakPatut("")).toBe("tidak patut");
  });

  it("Jadwal Sidang dan Status Perkara memakai label itu", () => {
    const jadwal = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");
    const status = baca("manajemen_surat/src/components/portal/aleta-ecourt-status-perkara.tsx");
    expect(jadwal).toContain("labelTidakPatut(pihak.terlaksana || pihak.seharusnya)");
    expect(status).toContain("labelTidakPatut(pihak.terlaksana || pihak.seharusnya)");
    expect(status).toContain('"diterima_kurang_dari_ambang"');
  });

  it("tenggang tersempit Jadwal ikut menghitung tanggal diterima", () => {
    const bot = baca("aleta_bot/services/sippJadwalSidangService.js");
    expect(bot).toContain("tanggalDiterima: dibaca.tanggalDiterima || null");
    expect(bot).toContain('nilai.alasan === "diterima_kurang_dari_ambang"');
  });
});
