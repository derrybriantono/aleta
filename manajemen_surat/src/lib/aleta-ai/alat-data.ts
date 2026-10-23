/**
 * ============================================================================
 * ALETA Ai TAHAP 2a - KATALOG ALAT DATA (murni: definisi, saringan, hitungan)
 * ============================================================================
 *
 * Rencana v2 bagian 4 & 10.2. Model TIDAK menulis SQL: ia hanya memilih alat
 * dari katalog ini dan mengisi parameternya (tanggal, nomor perkara). Kueri
 * SELECT-nya ditulis pengembang di aleta_bot/services/aletaAiAlatService.js
 * dan dijalankan bot dengan akun SIPP BACA-SAJA khusus.
 *
 * Berkas ini memegang bagian yang tidak menyentuh jaringan:
 *   - definisi alat untuk API (nama, keterangan, input_schema) + bidang data
 *     yang dibacanya (matriks-peran.ts AKSES_DATA_AI);
 *   - parameter: bawaan rentang (3 bulan terakhir, minggu ini, ...);
 *   - saringan "milik" (perkara yang ditangani penanya - pencocok nama yang
 *     sama dengan Unggah massal, lib/perkara-sendiri.ts);
 *   - hitungan rekap + kalimat "cara hitung" (rencana 10.2: jawaban menyebut
 *     sumber dan cara hitungnya, dan dapat dibuka menjadi daftar perkara).
 */

import type { BidangDataAi, KemampuanAi, LingkupDataAi } from "@/lib/matriks-peran";
import { namaCocokSatu } from "@/lib/perkara-sendiri";

export type NamaAlatData =
  | "rekap_relaas_retur"
  | "rekap_sisa_perkara"
  | "rekap_perkara_lewat_5_bulan"
  | "rekap_bht_tertunda"
  | "rekap_beban_majelis"
  | "rekap_jadwal_sidang"
  | "data_perkara"
  | "rekap_keuangan_perkara"
  | "data_keuangan_perkara";

export type AlatApi = { name: string; description: string; input_schema: Record<string, unknown> };

export type DefinisiAlat = AlatApi & {
  name: NamaAlatData;
  jenis: "rekap" | "perkara";
  /** Bidang yang dibaca; lingkup = yang TERLUAS di antara bidang ini. */
  bidang: readonly BidangDataAi[];
  /** Operasi katalog bot. */
  operasi: "rekap.relaas" | "rekap.sisa" | "rekap.bht" | "rekap.penunjukan" | "rekap.sidang" | "perkara.paket" | "rekap.keuangan" | "keuangan.perkara";
  /** Kemampuan matriks 10.3 yang DIPERLUKAN selain hak bidang (mis. rekap kasir/panjar). */
  kemampuan?: KemampuanAi;
};

const TANGGAL = { type: "string", description: "Tanggal YYYY-MM-DD." };

export const BAGIAN_PERKARA = ["ringkas", "pihak", "jadwal", "relaas", "putusan"] as const;
export type BagianPerkara = (typeof BAGIAN_PERKARA)[number];

export const KATALOG_ALAT: readonly DefinisiAlat[] = [
  {
    name: "rekap_relaas_retur",
    description:
      "Rekap relaas (panggilan/pemberitahuan) dan yang RETUR dalam rentang tanggal relaas. Retur = dikembalikan pos (status_pos 2), hasil memuat retur/failed, atau keterangan SEMA 1/2023 angka 12 b/e/f/g pada surat tercatat. Bawaan: 3 bulan terakhir.",
    input_schema: { type: "object", properties: { dari: TANGGAL, sampai: TANGGAL }, additionalProperties: false },
    jenis: "rekap",
    bidang: ["rekap", "relaas"],
    operasi: "rekap.relaas",
  },
  {
    name: "rekap_sisa_perkara",
    description: "Jumlah sisa perkara (sudah terdaftar, belum bertanggal putusan) pada satu tanggal, per jenis perkara. Bawaan: hari ini.",
    input_schema: { type: "object", properties: { per: TANGGAL }, additionalProperties: false },
    jenis: "rekap",
    bidang: ["rekap"],
    operasi: "rekap.sisa",
  },
  {
    name: "rekap_perkara_lewat_5_bulan",
    description: "Perkara yang belum diputus dan sudah lebih dari 5 bulan sejak didaftarkan, pada satu tanggal. Bawaan: hari ini.",
    input_schema: { type: "object", properties: { per: TANGGAL }, additionalProperties: false },
    jenis: "rekap",
    bidang: ["rekap"],
    operasi: "rekap.sisa",
  },
  {
    name: "rekap_bht_tertunda",
    description:
      "Perkara yang sudah diputus tetapi tanggal BHT (berkekuatan hukum tetap) masih kosong, dikelompokkan menurut lama sejak putusan. Bawaan: putusan 12 bulan terakhir, lebih dari 14 hari.",
    input_schema: {
      type: "object",
      properties: { per: TANGGAL, minimal_hari: { type: "integer", minimum: 0, maximum: 3650, description: "Lama minimal sejak putusan (hari). Bawaan 14." } },
      additionalProperties: false,
    },
    jenis: "rekap",
    bidang: ["rekap"],
    operasi: "rekap.bht",
  },
  {
    name: "rekap_beban_majelis",
    description: "Beban penunjukan: jumlah perkara yang didaftarkan dalam rentang, per ketua majelis, per panitera pengganti, dan per jurusita. Bawaan: awal tahun sampai hari ini.",
    input_schema: { type: "object", properties: { dari: TANGGAL, sampai: TANGGAL }, additionalProperties: false },
    jenis: "rekap",
    bidang: ["rekap"],
    operasi: "rekap.penunjukan",
  },
  {
    name: "rekap_jadwal_sidang",
    description: "Jadwal sidang dalam rentang: jumlah sidang per tanggal dan per ketua majelis. Bawaan: minggu ini (Senin-Minggu).",
    input_schema: { type: "object", properties: { dari: TANGGAL, sampai: TANGGAL }, additionalProperties: false },
    jenis: "rekap",
    bidang: ["rekap"],
    operasi: "rekap.sidang",
  },
  {
    name: "data_perkara",
    description:
      "Data SATU perkara menurut nomor perkara (mis. 684/Pdt.G/2026/PA.Dgl): ringkas (jenis, tanggal daftar, tahapan, majelis, PP, JS), pihak (identitas DISAMARKAN dengan kode seperti [NAMA-1]), jadwal sidang, relaas, putusan. Pilih bagian yang perlu saja.",
    input_schema: {
      type: "object",
      properties: {
        nomor: { type: "string", description: "Nomor perkara lengkap atau bagian depannya." },
        bagian: { type: "array", items: { type: "string", enum: [...BAGIAN_PERKARA] }, description: "Bawaan: ringkas saja." },
      },
      required: ["nomor"],
      additionalProperties: false,
    },
    jenis: "perkara",
    bidang: ["perkara"],
    operasi: "perkara.paket",
  },
  {
    name: "rekap_keuangan_perkara",
    description:
      "Rekap keuangan perkara (kasir/panjar, BACA-SAJA): uang masuk dan keluar dalam rentang tanggal transaksi, jumlah perkara bertransaksi, dan perkara yang sisa panjarnya habis atau minus. Bawaan: awal bulan ini sampai hari ini.",
    input_schema: { type: "object", properties: { dari: TANGGAL, sampai: TANGGAL }, additionalProperties: false },
    jenis: "rekap",
    bidang: ["keuangan"],
    operasi: "rekap.keuangan",
    kemampuan: "rekap-kasir",
  },
  {
    name: "data_keuangan_perkara",
    description:
      "Jurnal keuangan SATU perkara (BACA-SAJA): transaksi panjar masuk/keluar, total, dan sisa panjar. Nama penyetor DISAMARKAN dengan kode seperti [NAMA-1].",
    input_schema: {
      type: "object",
      properties: { nomor: { type: "string", description: "Nomor perkara lengkap." } },
      required: ["nomor"],
      additionalProperties: false,
    },
    jenis: "perkara",
    bidang: ["keuangan"],
    operasi: "keuangan.perkara",
  },
];

export const PETA_ALAT: ReadonlyMap<string, DefinisiAlat> = new Map(KATALOG_ALAT.map((a) => [a.name, a]));

/** Bidang yang dibaca satu PANGGILAN data_perkara (relaas saja -> bidang relaas). */
export function bidangPanggilan(alat: DefinisiAlat, bagian: readonly BagianPerkara[]): BidangDataAi[] {
  if (alat.name !== "data_perkara") return [...alat.bidang];
  const b = new Set<BidangDataAi>();
  for (const x of bagian) b.add(x === "relaas" ? "relaas" : "perkara");
  return [...b];
}

/** Bentuk untuk API: hanya name, description, input_schema. */
export function alatUntukApi(daftar: readonly DefinisiAlat[]): AlatApi[] {
  return daftar.map((a) => ({ name: a.name, description: a.description, input_schema: a.input_schema }));
}

// ─── Tanggal (WITA, UTC+8) ───────────────────────────────────────────────────

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

export function tanggalWita(d: Date): string {
  return new Date(d.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}

export function geserHari(t: string, n: number): string {
  const d = new Date(`${t}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function geserBulan(t: string, n: number): string {
  const [y, m, h] = t.split("-").map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + n;
  const ty = Math.floor(total / 12);
  const tm = (total % 12) + 1;
  const akhir = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  return `${ty}-${String(tm).padStart(2, "0")}-${String(Math.min(h, akhir)).padStart(2, "0")}`;
}

export function selisihHari(dari: string, sampai: string): number {
  return Math.round((Date.parse(`${sampai}T00:00:00Z`) - Date.parse(`${dari}T00:00:00Z`)) / 86_400_000);
}

const tanggalSah = (v: unknown): string | null => {
  const t = String(v ?? "").trim();
  return POLA_TANGGAL.test(t) && !Number.isNaN(Date.parse(`${t}T00:00:00Z`)) ? t : null;
};

export class GalatParameterAlat extends Error {}

/** Parameter operasi bot dari masukan model + bawaan. Tanggal salah -> GalatParameterAlat. */
export function parameterOperasi(alat: DefinisiAlat, masukan: Record<string, unknown>, sekarang: Date): Record<string, unknown> {
  const hariIni = tanggalWita(sekarang);
  const ambil = (k: string, bawaan: string) => {
    const v = masukan[k];
    if (v === undefined || v === null || v === "") return bawaan;
    const t = tanggalSah(v);
    if (!t) throw new GalatParameterAlat(`Parameter ${k} harus tanggal YYYY-MM-DD.`);
    return t;
  };
  const rentang = (dariBawaan: string, sampaiBawaan: string) => {
    const dari = ambil("dari", dariBawaan);
    const sampai = ambil("sampai", sampaiBawaan);
    if (dari > sampai) throw new GalatParameterAlat("Tanggal 'dari' sesudah tanggal 'sampai'.");
    if (selisihHari(dari, sampai) > 3 * 366) throw new GalatParameterAlat("Rentang paling panjang 3 tahun.");
    return { dari, sampai };
  };
  switch (alat.name) {
    case "rekap_relaas_retur":
      return rentang(geserBulan(hariIni, -3), hariIni);
    case "rekap_beban_majelis":
      return rentang(`${hariIni.slice(0, 4)}-01-01`, hariIni);
    case "rekap_keuangan_perkara":
      return rentang(`${hariIni.slice(0, 7)}-01`, hariIni);
    case "rekap_jadwal_sidang": {
      const hari = new Date(`${hariIni}T00:00:00Z`).getUTCDay();
      const senin = geserHari(hariIni, hari === 0 ? -6 : 1 - hari);
      return rentang(senin, geserHari(senin, 6));
    }
    case "rekap_sisa_perkara":
    case "rekap_perkara_lewat_5_bulan":
      return { per: ambil("per", hariIni) };
    case "rekap_bht_tertunda": {
      const per = ambil("per", hariIni);
      const minimal = Number(masukan.minimal_hari ?? 14);
      if (!Number.isFinite(minimal) || minimal < 0 || minimal > 3650) throw new GalatParameterAlat("minimal_hari harus 0-3650.");
      return { per, dari: geserBulan(per, -12), minimal_hari: Math.trunc(minimal) };
    }
    case "data_perkara":
    case "data_keuangan_perkara": {
      const nomor = String(masukan.nomor ?? "").trim();
      if (!nomor || nomor.length > 60 || /[\r\n]/.test(nomor)) throw new GalatParameterAlat("Nomor perkara tidak sah.");
      return { nomor };
    }
  }
}

export function bagianDiminta(masukan: Record<string, unknown>): BagianPerkara[] {
  const mentah = Array.isArray(masukan.bagian) ? masukan.bagian : [];
  const sah = mentah.map((x) => String(x)).filter((x): x is BagianPerkara => (BAGIAN_PERKARA as readonly string[]).includes(x));
  return sah.length ? [...new Set(sah)] : ["ringkas"];
}

// ─── Saringan "milik" ────────────────────────────────────────────────────────

export type PetugasPerkara = { majelis: string[]; ketua: string; pp: string[]; js: string[] };
export type BarisRekap = PetugasPerkara & { perkaraId: string; nomor: string; jenis: string } & Record<string, unknown>;

/** Perkara yang ditangani `namaAkun` (salah satu majelis, PP, atau JS-nya). */
export function perkaraMilik(p: Partial<PetugasPerkara>, namaAkun: string): boolean {
  const semua = [...(p.majelis ?? []), ...(p.pp ?? []), ...(p.js ?? [])];
  return Boolean(String(namaAkun ?? "").trim()) && semua.some((n) => namaCocokSatu(namaAkun, n));
}

export function saringLingkup<T extends Partial<PetugasPerkara>>(baris: readonly T[], lingkup: LingkupDataAi, namaAkun: string): T[] {
  return lingkup === "semua" ? [...baris] : baris.filter((b) => perkaraMilik(b, namaAkun));
}

// ─── Hitungan rekap ──────────────────────────────────────────────────────────

export type HasilRekap = {
  alat: NamaAlatData;
  judul: string;
  sumber: string;
  cara_hitung: string;
  rentang: Record<string, string>;
  lingkup: string;
  angka: Record<string, number>;
  rincian: Record<string, Array<{ kunci: string; jumlah: number }>>;
  /** Nomor perkara yang dihitung (semua; ringkasan untuk model dipotong). */
  nomor_perkara: string[];
  terpotong: boolean;
};

const urutJumlah = (peta: Map<string, number>) =>
  [...peta.entries()].map(([kunci, jumlah]) => ({ kunci: kunci || "(kosong)", jumlah })).sort((a, b) => b.jumlah - a.jumlah || a.kunci.localeCompare(b.kunci));

function hitungPer<T>(baris: readonly T[], kunci: (b: T) => string | string[]): Array<{ kunci: string; jumlah: number }> {
  const peta = new Map<string, number>();
  for (const b of baris) {
    const k = kunci(b);
    for (const x of Array.isArray(k) ? (k.length ? k : [""]) : [k]) peta.set(x, (peta.get(x) ?? 0) + 1);
  }
  return urutJumlah(peta);
}

const unikNomor = (baris: ReadonlyArray<{ nomor: string }>) => [...new Set(baris.map((b) => b.nomor).filter(Boolean))];

const LABEL_LINGKUP: Record<LingkupDataAi, string> = { semua: "seluruh perkara satker", milik: "hanya perkara yang Anda tangani (majelis/PP/JS)" };

export function hitungRekap(
  alat: DefinisiAlat,
  parameter: Record<string, unknown>,
  data: { baris: BarisRekap[]; terpotong?: boolean; sumber?: string },
  lingkup: LingkupDataAi,
  namaAkun: string
): HasilRekap {
  const baris = saringLingkup(data.baris ?? [], lingkup, namaAkun);
  const dasar = {
    alat: alat.name,
    sumber: data.sumber ?? "SIPP",
    lingkup: LABEL_LINGKUP[lingkup],
    terpotong: Boolean(data.terpotong),
    rentang: Object.fromEntries(Object.entries(parameter).map(([k, v]) => [k, String(v)])),
  };
  switch (alat.name) {
    case "rekap_relaas_retur": {
      const retur = baris.filter((b) => b.retur === true);
      const perkaraRelaas = unikNomor(baris);
      const perkaraRetur = unikNomor(retur);
      return {
        ...dasar,
        judul: "Relaas retur",
        cara_hitung: `Dihitung dari relaas SIPP bertanggal ${parameter.dari} s.d. ${parameter.sampai}: ${baris.length} relaas pada ${perkaraRelaas.length} perkara, ${retur.length} relaas retur pada ${perkaraRetur.length} perkara.`,
        angka: { relaas: baris.length, perkara_berelaas: perkaraRelaas.length, relaas_retur: retur.length, perkara_retur: perkaraRetur.length },
        rincian: { retur_per_jenis: hitungPer(retur, (b) => b.jenis), retur_per_jurusita: hitungPer(retur, (b) => b.js) },
        nomor_perkara: perkaraRetur,
      };
    }
    case "rekap_sisa_perkara":
      return {
        ...dasar,
        judul: "Sisa perkara",
        cara_hitung: `Perkara terdaftar sampai ${parameter.per} yang belum bertanggal putusan pada ${parameter.per}: ${baris.length} perkara.`,
        angka: { sisa: baris.length },
        rincian: { per_jenis: hitungPer(baris, (b) => b.jenis), per_ketua_majelis: hitungPer(baris, (b) => b.ketua) },
        nomor_perkara: unikNomor(baris),
      };
    case "rekap_perkara_lewat_5_bulan": {
      const batas = geserBulan(String(parameter.per), -5);
      const lewat = baris.filter((b) => String(b.tanggalDaftar ?? "") !== "" && String(b.tanggalDaftar) < batas);
      return {
        ...dasar,
        judul: "Perkara lewat 5 bulan",
        cara_hitung: `Dari ${baris.length} sisa perkara per ${parameter.per}, yang didaftarkan sebelum ${batas} (lebih dari 5 bulan): ${lewat.length} perkara.`,
        angka: { sisa: baris.length, lewat_5_bulan: lewat.length },
        rincian: { per_jenis: hitungPer(lewat, (b) => b.jenis), per_ketua_majelis: hitungPer(lewat, (b) => b.ketua) },
        nomor_perkara: unikNomor(lewat),
      };
    }
    case "rekap_bht_tertunda": {
      const minimal = Math.max(0, Math.trunc(Number(parameter.minimal_hari ?? 14)));
      const per = String(parameter.per);
      const dengan = baris
        .map((b) => ({ ...b, lama: b.tanggalPutusan ? selisihHari(String(b.tanggalPutusan), per) : -1 }))
        .filter((b) => b.lama > minimal);
      const kelompok = (l: number) => (l <= 30 ? "15-30 hari" : l <= 90 ? "31-90 hari" : "lebih dari 90 hari");
      return {
        ...dasar,
        judul: "BHT tertunda",
        cara_hitung: `Putusan ${parameter.dari} s.d. ${per} yang tanggal BHT-nya masih kosong pada ${per} dan sudah lebih dari ${minimal} hari sejak putusan: ${dengan.length} perkara.`,
        angka: { bht_tertunda: dengan.length },
        rincian: { menurut_lama: hitungPer(dengan, (b) => kelompok(b.lama)), per_jenis: hitungPer(dengan, (b) => b.jenis) },
        nomor_perkara: unikNomor(dengan),
      };
    }
    case "rekap_beban_majelis":
      return {
        ...dasar,
        judul: "Beban penunjukan",
        cara_hitung: `Perkara yang didaftarkan ${parameter.dari} s.d. ${parameter.sampai}: ${baris.length} perkara, dihitung per ketua majelis, PP, dan JS yang aktif.`,
        angka: { perkara: baris.length },
        rincian: { per_ketua_majelis: hitungPer(baris, (b) => b.ketua), per_pp: hitungPer(baris, (b) => b.pp), per_js: hitungPer(baris, (b) => b.js) },
        nomor_perkara: unikNomor(baris),
      };
    case "rekap_jadwal_sidang":
      return {
        ...dasar,
        judul: "Jadwal sidang",
        cara_hitung: `Sidang terjadwal ${parameter.dari} s.d. ${parameter.sampai}: ${baris.length} sidang pada ${unikNomor(baris).length} perkara.`,
        angka: { sidang: baris.length, perkara: unikNomor(baris).length },
        rincian: { per_tanggal: hitungPer(baris, (b) => String(b.tanggal ?? "")).sort((a, b) => a.kunci.localeCompare(b.kunci)), per_ketua_majelis: hitungPer(baris, (b) => b.ketua) },
        nomor_perkara: unikNomor(baris),
      };
    case "rekap_keuangan_perkara": {
      const jumlah = (f: (b: BarisRekap) => number) => baris.reduce((n, b) => n + f(b), 0);
      const habis = baris.filter((b) => Number(b.sisa ?? 0) <= 0);
      const masuk = jumlah((b) => Number(b.masuk ?? 0));
      const keluar = jumlah((b) => Number(b.keluar ?? 0));
      return {
        ...dasar,
        judul: "Rekap keuangan perkara",
        cara_hitung: `Jurnal keuangan SIPP bertanggal ${parameter.dari} s.d. ${parameter.sampai}: ${baris.length} perkara bertransaksi, masuk Rp${masuk.toLocaleString("id-ID")}, keluar Rp${keluar.toLocaleString("id-ID")}; ${habis.length} perkara sisa panjarnya habis/minus (sisa dihitung dari seluruh jurnal tingkat pertama).`,
        angka: { perkara_bertransaksi: baris.length, masuk_rp: masuk, keluar_rp: keluar, perkara_panjar_habis: habis.length },
        rincian: { masuk_per_jenis: [...new Map(baris.map((b) => [b.jenis, 0])).keys()].map((j) => ({ kunci: j || "(kosong)", jumlah: jumlah((b) => (b.jenis === j ? Number(b.masuk ?? 0) : 0)) })).sort((a, b) => b.jumlah - a.jumlah) },
        nomor_perkara: unikNomor(habis),
      };
    }
    default:
      throw new Error(`bukan alat rekap: ${alat.name}`);
  }
}

/** Ringkasan untuk model: nomor perkara dipotong supaya hemat token. */
export function rekapUntukModel(h: HasilRekap, batasNomor = 30): Record<string, unknown> {
  return {
    ...h,
    nomor_perkara: h.nomor_perkara.slice(0, batasNomor),
    jumlah_nomor: h.nomor_perkara.length,
    catatan:
      h.nomor_perkara.length > batasNomor
        ? `Daftar lengkap ${h.nomor_perkara.length} nomor dapat dibuka pengguna di ALETA (tombol daftar perkara).`
        : undefined,
  };
}
