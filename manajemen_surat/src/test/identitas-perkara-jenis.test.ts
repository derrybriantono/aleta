// @vitest-environment node
import Module, { createRequire } from "node:module";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { sebutanRingkasan } from "@/lib/ringkasan-salin";

/**
 * ============================================================================
 * IDENTITAS PERKARA MEMBAWA NOMOR JENIS PERKARA (2.39.0)
 * ============================================================================
 *
 * Ringkasan salin Status Perkara menyebut para pihak dengan sebutan yang
 * ditentukan NOMOR alur DAN jenis perkara. Muatan bot dahulu hanya membawa
 * alur - dan alur gugatan (15) memuat cerai talak (346) serta izin poligami
 * (341) yang bersebutan Pemohon/Termohon. Tanpa nomor jenis, ringkasan hanya
 * dapat menulis sebutan ganda "Penggugat/Pemohon" pada 5.717 perkara satker.
 *
 * Yang dijalankan SUNGGUHAN: identitasPerkara di sippStatusPerkaraService
 * (bot) dan sebutanRingkasan (portal). Yang ditiru hanya db_config - dan
 * tiruannya mengembalikan HANYA kolom yang dipilih kuerinya ("p.kolom AS
 * alias"), sehingga kolom yang lupa dipilih tidak diam-diam terisi oleh uji.
 *
 * ALETA_UJI_STATUS_PERKARA menunjuk SALINAN layanan (bersebelahan dengan
 * aslinya, supaya require relatifnya tetap jalan) untuk pembukti gigitan.
 */

const require_ = createRequire(import.meta.url);
const AKAR_BOT = path.resolve(process.cwd(), "../aleta_bot");
const JALUR_DB = require_.resolve(path.join(AKAR_BOT, "db_config"));
const JALUR_LAYANAN = require_.resolve(
  process.env.ALETA_UJI_STATUS_PERKARA || path.join(AKAR_BOT, "services/sippStatusPerkaraService")
);

/** Satu baris tabel perkara, bernama kolom SIPP - bentuk sipp_donggala. */
type BarisPerkara = Record<string, string | number>;

function muatLayanan(baris: BarisPerkara | null) {
  const kueri: string[] = [];
  const tiruan = {
    query(sql: string, _params: unknown[], cb: (galat: unknown, rows: unknown[]) => void) {
      kueri.push(sql);
      if (!baris || !/FROM perkara p\b/.test(sql)) return cb(null, []);
      const hasil: Record<string, unknown> = {};
      for (const m of sql.matchAll(/\bp\.(\w+)\s+AS\s+(\w+)/g)) {
        if (m[1] in baris) hasil[m[2]] = baris[m[1]];
      }
      return cb(null, [hasil]);
    },
  };
  const modul = new Module(JALUR_DB);
  modul.filename = JALUR_DB;
  modul.loaded = true;
  modul.exports = tiruan;
  require_.cache[JALUR_DB] = modul;
  delete require_.cache[JALUR_LAYANAN];
  return { layanan: require_(JALUR_LAYANAN), kueri };
}

afterEach(() => {
  delete require_.cache[JALUR_DB];
  delete require_.cache[JALUR_LAYANAN];
});

const CERAI_TALAK: BarisPerkara = {
  perkara_id: 4211,
  nomor_perkara: "12/Pdt.G/2026/PA.Dgl",
  jenis_perkara_nama: "Cerai Talak",
  jenis_perkara_text: "Cerai Talak",
  alur_perkara_id: 15,
  jenis_perkara_id: 346,
  tanggal_pendaftaran: "2026-01-05",
};

describe("identitasPerkara (bot) membawa jenis_perkara_id", () => {
  it("cerai talak beralur gugatan: nomor jenis dan alur sama-sama terkirim", async () => {
    const { layanan } = muatLayanan(CERAI_TALAK);
    const identitas = await layanan.identitasPerkara("12/Pdt.G/2026/PA.Dgl");
    expect(identitas).toMatchObject({
      perkaraId: "4211",
      nomorPerkara: "12/Pdt.G/2026/PA.Dgl",
      alurPerkaraId: 15,
      jenisPerkaraId: 346,
      tanggalDaftar: "2026-01-05",
    });
  });

  it("ringkasan salin memakai keduanya: Pemohon/Termohon yang PASTI, bukan sebutan ganda", async () => {
    const { layanan } = muatLayanan(CERAI_TALAK);
    const identitas = await layanan.identitasPerkara("12/Pdt.G/2026/PA.Dgl");
    expect(sebutanRingkasan(identitas)).toEqual({ satu: "Pemohon", dua: "Termohon", pasti: true });
  });

  it("cerai gugat tetap Penggugat/Tergugat - nomor jenis tidak membalik semuanya", async () => {
    const { layanan } = muatLayanan({ ...CERAI_TALAK, jenis_perkara_nama: "Cerai Gugat", jenis_perkara_id: 347 });
    const identitas = await layanan.identitasPerkara("12/Pdt.G/2026/PA.Dgl");
    expect(identitas.jenisPerkaraId).toBe(347);
    expect(sebutanRingkasan(identitas)).toEqual({ satu: "Penggugat", dua: "Tergugat", pasti: true });
  });

  it("jenis yang kosong di SIPP menjadi 0, dan ringkasan jatuh ke sebutan ganda - tidak menebak", async () => {
    const { layanan } = muatLayanan({ ...CERAI_TALAK, jenis_perkara_id: "" });
    const identitas = await layanan.identitasPerkara("12/Pdt.G/2026/PA.Dgl");
    expect(identitas.jenisPerkaraId).toBe(0);
    expect(sebutanRingkasan(identitas)).toEqual({
      satu: "Penggugat/Pemohon",
      dua: "Tergugat/Termohon",
      pasti: false,
    });
  });

  it("perkara yang tidak ada tetap null", async () => {
    const { layanan, kueri } = muatLayanan(null);
    expect(await layanan.identitasPerkara("99/Pdt.G/2026/PA.Dgl")).toBeNull();
    expect(kueri.some((k) => /FROM perkara p\b/.test(k))).toBe(true);
  });
});
