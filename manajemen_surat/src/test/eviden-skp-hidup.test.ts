// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { durasiPerkara, konteksEviden, susunDokumenEvidenSkp } from "@/lib/eviden-skp-katalog";
import type { DataEvidenSkp } from "@/lib/eviden-skp-tipe";

/**
 * ============================================================================
 * SEKALI ATAS SIPP HIDUP - KEEMPAT CONTOH SPREADSHEET PENGGUNA
 * ============================================================================
 *
 * Dijalankan HANYA bila ALETA_UJI_SIPP_HIDUP=1: rangkaian uji penuh tidak
 * boleh bergantung pada MySQL di mesin pengujinya. Layanan bot SUNGGUHAN
 * (evidenSkpService) membaca basis data yang ditunjuk ALETA_UJI_SIPP_DB
 * (bawaan sipp_donggala di 127.0.0.1, root tanpa sandi) - SELECT saja - lalu
 * katalog portal menyusun dokumennya. Yang diperiksa: baris spreadsheet
 * "SKP 2026 DERRY BRIANTONO" (hakim_id 31) untuk Triwulan I dan II.
 *
 *   ALETA_UJI_SIPP_HIDUP=1 npx vitest run src/test/eviden-skp-hidup.test.ts
 */
const HIDUP = process.env.ALETA_UJI_SIPP_HIDUP === "1";

function muatLayanan() {
  process.env.ALETA_BOT_DB_SIPP_NAME = process.env.ALETA_UJI_SIPP_DB || "sipp_donggala";
  process.env.ALETA_BOT_DB_SIPP_HOST = process.env.ALETA_BOT_DB_SIPP_HOST || "127.0.0.1";
  process.env.ALETA_BOT_DB_SIPP_USER = process.env.ALETA_BOT_DB_SIPP_USER || "root";
  process.env.ALETA_BOT_DB_SIPP_PASSWORD = process.env.ALETA_BOT_DB_SIPP_PASSWORD || "";
  const req = createRequire(path.resolve(__dirname, "../../../aleta_bot/services/evidenSkpService.js"));
  return {
    layanan: req("./evidenSkpService.js") as {
      evidenSkp: (m: Record<string, string>, o?: Record<string, unknown>) => Promise<DataEvidenSkp | { ok: false; error: string }>;
    },
    db: req("../db_config.js") as { end: (cb: () => void) => void },
  };
}

describe.skipIf(!HIDUP)("eviden SKP atas SIPP hidup (ALETA_UJI_SIPP_HIDUP=1)", () => {
  it("baris contoh spreadsheet Triwulan I dan II", async () => {
    const { layanan, db } = muatLayanan();
    try {
      const baca = async (periode: string) => {
        const t0 = Date.now();
        const hasil = await layanan.evidenSkp({ peran: "hakim", id: "31", tahun: "2026", periode }, { hariIni: "2026-09-27" });
        expect(hasil.ok, JSON.stringify(hasil).slice(0, 300)).toBe(true);
        console.log(`[sipp hidup] ${periode}: ${(hasil as DataEvidenSkp).baris.length} perkara, ${Date.now() - t0} ms`);
        return hasil as DataEvidenSkp;
      };
      const tw1 = await baca("tw1");
      const tw2 = await baca("tw2");

      const status = (d: DataEvidenSkp) => susunDokumenEvidenSkp(d).find((x) => x.kunci === "status-perkara")!.tabel.baris;
      const cari = (d: DataEvidenSkp, nomor: string) => status(d).find((b) => b.nomor === nomor);

      expect(cari(tw1, "687/Pdt.G/2025/PA.Dgl")).toMatchObject({
        jenis: "Wasiat",
        daftar: "28/11/2025",
        majelis: "Hakim Ketua: Akbar Ali\nHakim Anggota 1: Himawan Tatura Wijaya\nHakim Anggota 2: Derry Briantono",
        panitera: "Sri Susilowati, S.H.",
        jurusita: "Tanty Restianty",
        musyawarah: "Terlaksana MM",
        durasi: "103",
        minutasi: "Telah Di Minutasi",
        ecourt: "E-Court",
        unggah: "Telah Di Upload",
        anonimisasi: "Telah Di Anonimisasi",
      });
      expect(cari(tw1, "687/Pdt.G/2025/PA.Dgl")?.direktori).toMatch(/^http:\/\/putusan\.mahkamahagung\.go\.id\/putusan\//);
      expect(cari(tw1, "620/Pdt.G/2025/PA.Dgl")).toMatchObject({
        jenis: "Kewarisan",
        daftar: "22/10/2025",
        putusan: "Putus (Dikabulkan)",
        banding: "Banding",
        jurusita: "Mohammad Syukri",
        durasi: "98",
      });
      expect(cari(tw2, "273/Pdt.G/2026/PA.Dgl")).toMatchObject({ jenis: "Kewarisan", daftar: "27/04/2026", putusan: "-", durasi: "38", ecourt: "E-Court" });
      expect(cari(tw2, "142/Pdt.G/2026/PA.Dgl")).toMatchObject({ jenis: "Kewarisan", daftar: "18/02/2026", minutasi: "Telah Di Minutasi", durasi: "14" });
      expect(cari(tw2, "142/Pdt.G/2026/PA.Dgl")?.direktori).toMatch(/^http:\/\/putusan\.mahkamahagung\.go\.id\/putusan\//);

      // Durasi seluruh perkara Triwulan II terhitung - tidak satu pun kosong
      // karena tanggal daftarnya tidak terbaca.
      const k2 = konteksEviden(tw2);
      expect(tw2.baris.filter((b) => durasiPerkara(b, k2) === null)).toEqual([]);
      expect(tw1.galat).toEqual([]);
      expect(tw2.galat).toEqual([]);
    } finally {
      await new Promise<void>((selesai) => db.end(() => selesai()));
    }
  }, 180_000);
});
