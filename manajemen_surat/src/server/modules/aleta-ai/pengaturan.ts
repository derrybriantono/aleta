import { randomUUID } from "node:crypto";

import { PARAMETER_HARGA_BAWAAN, TARIF_BAWAAN, type ParameterHarga, type Tarif } from "@/lib/aleta-ai/biaya";
import { EFFORT_SAH, RUTE_BAWAAN, type EffortAi, type RuteKelompok } from "@/lib/aleta-ai/rute";
import type { AletaDatabase } from "@/server/db/client";
import { hentikanSemuaPekerjaanAi } from "@/server/modules/aleta-ai/saklar";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * ALETA Ai - PENGATURAN, TARIF, DAN TABEL RUTE (basis data)
 * ============================================================================
 *
 * Nilai awal diisi malas (pertama kali dibaca) dari konstanta kode; sesudah itu
 * basis data yang berlaku dan HANYA Super Admin yang dapat mengubahnya (rute
 * memegang hak lewat pemanggil: rute API memeriksa peran). Tiap perubahan
 * dicatat di aleta_ai_jejak.
 */

const teks = (nilai: unknown): string => String(nilai ?? "").trim();

export type PengaturanAi = ParameterHarga & {
  /** Saklar darurat: false = ALETA Ai mati seketika untuk semua. */
  aktif: boolean;
  /** Batas harian per pengguna (Rp ditagih; Super Admin dikecualikan). */
  batasHarianRp: number;
  /** Batas harian per pengguna (token seluruh jenis). */
  batasHarianToken: number;
  /** Batas laju: pesan per menit per pengguna. */
  batasLajuPerMenit: number;
  /** Kurs awal (Rp per USD) bila belum pernah ada kurs tersimpan. */
  kursAwal: number;
  /** Dana yang ditahan = perkiraan x faktor ini (penyangga selisih perkiraan). */
  faktorTahan: number;
  /** Retensi percakapan (hari). Dicatat di tahap 1; penghapusan otomatis tahap 6. */
  retensiHari: number;
  /** Batas satker per bulan: biaya API (Rp, kurs dasar) seluruh pengguna termasuk Super Admin. 0 = tanpa batas. */
  batasSatkerBulananRp: number;
  /** Saldo di bawah angka ini = "saldo menipis" (pemberitahuan di Dompet dan layar ALETA Ai). */
  ambangSaldoMenipisRp: number;
  /** Isi saldo berbayar (QRIS, tahap 5). MATI bawaan dan belum dapat dinyalakan (pengingat hukum rencana bagian 9). */
  isiBerbayarAktif: boolean;
  /** Rekonsiliasi harian otomatis (bawaan MENYALA; tidak ikut saklar darurat - hanya membaca). */
  rekonsiliasiOtomatis: boolean;
  /** Jam WITA (0-23) rekonsiliasi harian atas tanggal kemarin; bawaan 1 = 01.00. */
  jamRekonsiliasi: number;
};

export const PENGATURAN_BAWAAN: PengaturanAi = {
  ...PARAMETER_HARGA_BAWAAN,
  aktif: true,
  batasHarianRp: 100_000,
  batasHarianToken: 3_000_000,
  batasLajuPerMenit: 6,
  kursAwal: 16_500,
  faktorTahan: 1.5,
  retensiHari: 90,
  batasSatkerBulananRp: 5_000_000,
  ambangSaldoMenipisRp: 5_000,
  isiBerbayarAktif: false,
  rekonsiliasiOtomatis: true,
  jamRekonsiliasi: 1,
};

const KUNCI: Record<keyof PengaturanAi, string> = {
  marginPersen: "margin_persen",
  penyanggaKursPersen: "penyangga_kurs_persen",
  minimumRp: "minimum_rp",
  pembulatanRp: "pembulatan_rp",
  mdrPersen: "mdr_persen",
  aktif: "aktif",
  batasHarianRp: "batas_harian_rp",
  batasHarianToken: "batas_harian_token",
  batasLajuPerMenit: "batas_laju_per_menit",
  kursAwal: "kurs_awal",
  faktorTahan: "faktor_tahan",
  retensiHari: "retensi_hari",
  batasSatkerBulananRp: "batas_satker_bulanan_rp",
  ambangSaldoMenipisRp: "ambang_saldo_menipis_rp",
  isiBerbayarAktif: "isi_berbayar_aktif",
  rekonsiliasiOtomatis: "rekonsiliasi_otomatis",
  jamRekonsiliasi: "jam_rekonsiliasi",
};

/** Rentang yang masuk akal; di luar itu hampir pasti salah ketik. */
const RENTANG: Partial<Record<keyof PengaturanAi, [number, number]>> = {
  marginPersen: [0, 500],
  penyanggaKursPersen: [0, 50],
  minimumRp: [0, 1_000_000],
  pembulatanRp: [1, 100_000],
  mdrPersen: [0, 5],
  batasHarianRp: [0, 1_000_000_000],
  batasHarianToken: [0, 1_000_000_000],
  batasLajuPerMenit: [1, 600],
  kursAwal: [1_000, 100_000],
  faktorTahan: [1, 10],
  retensiHari: [1, 3650],
  batasSatkerBulananRp: [0, 10_000_000_000],
  ambangSaldoMenipisRp: [0, 10_000_000],
  jamRekonsiliasi: [0, 23],
};

const seedSudah = new WeakSet<AletaDatabase>();

function sekarangIso() {
  return new Date().toISOString();
}

async function isiBilaKosong(db: AletaDatabase) {
  const ada = new Set((await db.queryAll<{ kunci: string }>(`SELECT kunci FROM aleta_ai_pengaturan`)).map((r) => r.kunci));
  for (const [nama, kunci] of Object.entries(KUNCI) as Array<[keyof PengaturanAi, string]>) {
    if (ada.has(kunci)) continue;
    const nilai = PENGATURAN_BAWAAN[nama];
    try {
      await db.run(`INSERT INTO aleta_ai_pengaturan (kunci, nilai, diubah_oleh, diubah_at) VALUES (?, ?, '', ?)`, [
        kunci,
        typeof nilai === "boolean" ? (nilai ? "1" : "0") : String(nilai),
        sekarangIso(),
      ]);
    } catch {
      /* balapan dengan proses lain yang menanam nilai yang sama */
    }
  }

  const modelAda = new Set((await db.queryAll<{ model: string }>(`SELECT model FROM aleta_ai_harga`)).map((r) => r.model));
  for (const t of TARIF_BAWAAN) {
    if (modelAda.has(t.model)) continue;
    try {
      await db.run(
        `INSERT INTO aleta_ai_harga (model, masuk_per_juta, keluar_per_juta, cache_tulis_per_juta, cache_baca_per_juta, ambang_token, masuk_atas, keluar_atas, cache_tulis_atas, cache_baca_atas, fallback, diubah_oleh, diubah_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?)`,
        [t.model, t.masukPerJuta, t.keluarPerJuta, t.cacheTulisPerJuta, t.cacheBacaPerJuta, t.ambangToken, t.masukAtas, t.keluarAtas, t.cacheTulisAtas, t.cacheBacaAtas, t.fallback ? 1 : 0, sekarangIso()]
      );
    } catch {
      /* idem */
    }
  }

  const ruteAda = new Set((await db.queryAll<{ kelompok: string }>(`SELECT kelompok FROM aleta_ai_rute`)).map((r) => r.kelompok));
  for (const r of RUTE_BAWAAN) {
    if (ruteAda.has(r.kelompok)) continue;
    try {
      await db.run(
        `INSERT INTO aleta_ai_rute (kelompok, judul, model, effort, label, peran_json, urutan, perkiraan_keluaran, max_tokens, naik_ke, diubah_oleh, diubah_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?)`,
        [r.kelompok, r.judul, r.model, r.effort, r.label, JSON.stringify(r.peran), r.urutan, r.perkiraanKeluaran, r.maxTokens, r.naikKe, sekarangIso()]
      );
    } catch {
      /* idem */
    }
  }
}

export async function pastikanBawaan(db: AletaDatabase) {
  if (seedSudah.has(db)) return;
  await isiBilaKosong(db);
  seedSudah.add(db);
}

export async function bacaPengaturan(db: AletaDatabase): Promise<PengaturanAi> {
  await pastikanBawaan(db);
  const baris = await db.queryAll<{ kunci: string; nilai: string }>(`SELECT kunci, nilai FROM aleta_ai_pengaturan`);
  const peta = new Map(baris.map((b) => [b.kunci, b.nilai]));
  const hasil: Record<string, unknown> = { ...PENGATURAN_BAWAAN };
  for (const [nama, kunci] of Object.entries(KUNCI) as Array<[keyof PengaturanAi, string]>) {
    const mentah = peta.get(kunci);
    if (mentah === undefined) continue;
    if (typeof PENGATURAN_BAWAAN[nama] === "boolean") {
      hasil[nama] = mentah === "1";
    } else {
      const n = Number(mentah);
      if (Number.isFinite(n)) hasil[nama] = n;
    }
  }
  return hasil as PengaturanAi;
}

/** `margin` dan `penyanggaKurs` adalah nama pendek (dalam PERSEN, 30 = 30%) untuk marginPersen dan penyanggaKursPersen. */
export type PerubahanPengaturan = Partial<PengaturanAi> & { margin?: number; penyanggaKurs?: number };

export async function simpanPengaturan(db: AletaDatabase, olehId: string, masukan: PerubahanPengaturan): Promise<PengaturanAi> {
  await pastikanBawaan(db);
  const { margin, penyanggaKurs, ...sisa } = masukan;
  const perubahan: Partial<PengaturanAi> = { ...sisa };
  if (margin !== undefined && perubahan.marginPersen === undefined) perubahan.marginPersen = margin;
  if (penyanggaKurs !== undefined && perubahan.penyanggaKursPersen === undefined) perubahan.penyanggaKursPersen = penyanggaKurs;
  const diubah: string[] = [];
  for (const [nama, nilai] of Object.entries(perubahan) as Array<[keyof PengaturanAi, unknown]>) {
    if (!(nama in KUNCI) || nilai === undefined) continue;
    let simpan: string;
    if (nama === "aktif") {
      if (typeof nilai !== "boolean") throw new ApiError(400, "Saklar ALETA Ai harus berupa ya/tidak.");
      simpan = nilai ? "1" : "0";
    } else if (nama === "isiBerbayarAktif") {
      if (typeof nilai !== "boolean") throw new ApiError(400, "Saklar isi saldo berbayar harus berupa ya/tidak.");
      // Tahap 5 (QRIS) belum dibangun dan menunggu keputusan pengguna (PNBP/pungli, pajak, ASN, UU PDP).
      if (nilai) throw new ApiError(400, "Isi saldo berbayar belum tersedia. Saldo diisi manual oleh Super Admin.");
      simpan = "0";
    } else if (nama === "rekonsiliasiOtomatis") {
      if (typeof nilai !== "boolean") throw new ApiError(400, "Saklar rekonsiliasi otomatis harus berupa ya/tidak.");
      simpan = nilai ? "1" : "0";
    } else {
      const n = Number(nilai);
      const r = RENTANG[nama];
      if (!Number.isFinite(n) || (r && (n < r[0] || n > r[1]))) {
        throw new ApiError(400, `Nilai "${nama}" di luar rentang yang wajar${r ? ` (${r[0]} sampai ${r[1]})` : ""}.`);
      }
      if (nama === "jamRekonsiliasi" && !Number.isInteger(n)) throw new ApiError(400, "Jam rekonsiliasi harus jam bulat 0 sampai 23 (WITA).");
      simpan = String(n);
    }
    const hasil = await db.run(`UPDATE aleta_ai_pengaturan SET nilai = ?, diubah_oleh = ?, diubah_at = ? WHERE kunci = ?`, [simpan, olehId, sekarangIso(), KUNCI[nama]]);
    if (!hasil.changes) {
      await db.run(`INSERT INTO aleta_ai_pengaturan (kunci, nilai, diubah_oleh, diubah_at) VALUES (?, ?, ?, ?)`, [KUNCI[nama], simpan, olehId, sekarangIso()]);
    }
    diubah.push(nama);
  }
  if (diubah.length) await catatJejakPengaturan(db, olehId, "pengaturan", `Mengubah: ${diubah.join(", ")}`);
  // Saklar darurat: giliran dan tugas yang sedang berjalan di proses ini dihentikan seketika.
  if (perubahan.aktif === false) hentikanSemuaPekerjaanAi();
  return bacaPengaturan(db);
}

// ----------------------------------------------------------------------------
// Tarif
// ----------------------------------------------------------------------------

type BarisHarga = {
  model: string;
  masuk_per_juta: number | string;
  keluar_per_juta: number | string;
  cache_tulis_per_juta: number | string;
  cache_baca_per_juta: number | string;
  ambang_token: number | string;
  masuk_atas: number | string;
  keluar_atas: number | string;
  cache_tulis_atas: number | string;
  cache_baca_atas: number | string;
  fallback: number | string;
};

const num = (n: unknown): number => {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
};

export async function bacaTarif(db: AletaDatabase): Promise<Tarif[]> {
  await pastikanBawaan(db);
  const baris = await db.queryAll<BarisHarga>(`SELECT * FROM aleta_ai_harga ORDER BY model`);
  return baris.map((b) => ({
    model: b.model,
    masukPerJuta: num(b.masuk_per_juta),
    keluarPerJuta: num(b.keluar_per_juta),
    cacheTulisPerJuta: num(b.cache_tulis_per_juta),
    cacheBacaPerJuta: num(b.cache_baca_per_juta),
    ambangToken: num(b.ambang_token),
    masukAtas: num(b.masuk_atas),
    keluarAtas: num(b.keluar_atas),
    cacheTulisAtas: num(b.cache_tulis_atas),
    cacheBacaAtas: num(b.cache_baca_atas),
    fallback: num(b.fallback) === 1,
  }));
}

export async function simpanTarif(db: AletaDatabase, olehId: string, daftar: Tarif[]): Promise<Tarif[]> {
  await pastikanBawaan(db);
  if (!Array.isArray(daftar) || !daftar.length) throw new ApiError(400, "Daftar tarif kosong.");
  const bersih: Tarif[] = daftar.map((t) => {
    const model = teks(t.model);
    if (!/^[a-z0-9][a-z0-9._-]{2,63}$/i.test(model)) throw new ApiError(400, "ID model tidak sah.");
    const nilai = [t.masukPerJuta, t.keluarPerJuta, t.cacheTulisPerJuta, t.cacheBacaPerJuta, t.ambangToken, t.masukAtas, t.keluarAtas, t.cacheTulisAtas, t.cacheBacaAtas].map(Number);
    if (nilai.some((n) => !Number.isFinite(n) || n < 0 || n > 10_000)) throw new ApiError(400, `Tarif model ${model} di luar rentang yang wajar.`);
    return {
      model,
      masukPerJuta: nilai[0] as number,
      keluarPerJuta: nilai[1] as number,
      cacheTulisPerJuta: nilai[2] as number,
      cacheBacaPerJuta: nilai[3] as number,
      ambangToken: Math.trunc(nilai[4] as number),
      masukAtas: nilai[5] as number,
      keluarAtas: nilai[6] as number,
      cacheTulisAtas: nilai[7] as number,
      cacheBacaAtas: nilai[8] as number,
      fallback: Boolean(t.fallback),
    };
  });
  for (const t of bersih) {
    const sekarang = sekarangIso();
    const hasil = await db.run(
      `UPDATE aleta_ai_harga SET masuk_per_juta = ?, keluar_per_juta = ?, cache_tulis_per_juta = ?, cache_baca_per_juta = ?, ambang_token = ?, masuk_atas = ?, keluar_atas = ?, cache_tulis_atas = ?, cache_baca_atas = ?, fallback = ?, diubah_oleh = ?, diubah_at = ? WHERE model = ?`,
      [t.masukPerJuta, t.keluarPerJuta, t.cacheTulisPerJuta, t.cacheBacaPerJuta, t.ambangToken, t.masukAtas, t.keluarAtas, t.cacheTulisAtas, t.cacheBacaAtas, t.fallback ? 1 : 0, olehId, sekarang, t.model]
    );
    if (!hasil.changes) {
      await db.run(
        `INSERT INTO aleta_ai_harga (model, masuk_per_juta, keluar_per_juta, cache_tulis_per_juta, cache_baca_per_juta, ambang_token, masuk_atas, keluar_atas, cache_tulis_atas, cache_baca_atas, fallback, diubah_oleh, diubah_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [t.model, t.masukPerJuta, t.keluarPerJuta, t.cacheTulisPerJuta, t.cacheBacaPerJuta, t.ambangToken, t.masukAtas, t.keluarAtas, t.cacheTulisAtas, t.cacheBacaAtas, t.fallback ? 1 : 0, olehId, sekarang]
      );
    }
  }
  await catatJejakPengaturan(db, olehId, "tarif", `Mengubah tarif: ${bersih.map((t) => t.model).join(", ")}`);
  return bacaTarif(db);
}

// ----------------------------------------------------------------------------
// Rute model
// ----------------------------------------------------------------------------

type BarisRute = {
  kelompok: string;
  judul: string;
  model: string;
  effort: string;
  label: string;
  peran_json: string;
  urutan: number | string;
  perkiraan_keluaran: number | string;
  max_tokens: number | string;
  naik_ke: string;
};

export async function bacaRute(db: AletaDatabase): Promise<RuteKelompok[]> {
  await pastikanBawaan(db);
  const baris = await db.queryAll<BarisRute>(`SELECT * FROM aleta_ai_rute ORDER BY urutan`);
  return baris.map((b) => {
    let peran: string[] = [];
    try {
      const j = JSON.parse(b.peran_json) as unknown;
      if (Array.isArray(j)) peran = j.map((p) => teks(p)).filter(Boolean);
    } catch {
      peran = [];
    }
    return {
      kelompok: b.kelompok,
      judul: b.judul,
      model: b.model,
      effort: (EFFORT_SAH as readonly string[]).includes(b.effort) ? (b.effort as EffortAi) : "medium",
      label: b.label,
      peran,
      urutan: num(b.urutan),
      perkiraanKeluaran: num(b.perkiraan_keluaran),
      maxTokens: num(b.max_tokens),
      naikKe: b.naik_ke,
    };
  });
}

const LABEL_SAH = ["Cepat", "Teliti", "Mendalam"];

export async function simpanRute(db: AletaDatabase, olehId: string, daftar: RuteKelompok[]): Promise<RuteKelompok[]> {
  await pastikanBawaan(db);
  if (!Array.isArray(daftar) || !daftar.length) throw new ApiError(400, "Tabel rute kosong.");
  const sekarangAda = await bacaRute(db);
  const kelompokAda = new Set(sekarangAda.map((r) => r.kelompok));
  const modelAda = new Set((await bacaTarif(db)).map((t) => t.model));

  const bersih = daftar.map((r) => {
    const kelompok = teks(r.kelompok);
    if (!kelompokAda.has(kelompok)) throw new ApiError(400, `Kelompok "${kelompok}" tidak dikenal; kelompok tidak dapat ditambah atau dihapus.`);
    const model = teks(r.model);
    if (!modelAda.has(model)) throw new ApiError(400, `Model "${model}" belum punya tarif; isi tarifnya dulu.`);
    if (!(EFFORT_SAH as readonly string[]).includes(teks(r.effort))) throw new ApiError(400, `Effort kelompok "${kelompok}" tidak sah.`);
    if (!LABEL_SAH.includes(teks(r.label))) throw new ApiError(400, `Label kelompok "${kelompok}" harus Cepat, Teliti, atau Mendalam.`);
    const peran = (Array.isArray(r.peran) ? r.peran : []).map((p) => teks(p)).filter(Boolean);
    if (!peran.length) throw new ApiError(400, `Kelompok "${kelompok}" harus punya minimal satu peran (atau "*").`);
    const perkiraan = Number(r.perkiraanKeluaran);
    const maks = Number(r.maxTokens);
    if (!Number.isFinite(perkiraan) || perkiraan < 100 || perkiraan > 200_000) throw new ApiError(400, `Perkiraan keluaran "${kelompok}" tidak wajar.`);
    if (!Number.isFinite(maks) || maks < 1000 || maks > 128_000) throw new ApiError(400, `max_tokens "${kelompok}" tidak wajar.`);
    const naikKe = teks(r.naikKe);
    if (naikKe && !kelompokAda.has(naikKe)) throw new ApiError(400, `Tujuan naik tingkat "${naikKe}" tidak dikenal.`);
    return { kelompok, model, effort: teks(r.effort) as EffortAi, label: teks(r.label), peran, perkiraanKeluaran: Math.trunc(perkiraan), maxTokens: Math.trunc(maks), naikKe, judul: teks(r.judul) };
  });

  for (const r of bersih) {
    await db.run(
      `UPDATE aleta_ai_rute SET model = ?, effort = ?, label = ?, peran_json = ?, perkiraan_keluaran = ?, max_tokens = ?, naik_ke = ?, diubah_oleh = ?, diubah_at = ? WHERE kelompok = ?`,
      [r.model, r.effort, r.label, JSON.stringify(r.peran), r.perkiraanKeluaran, r.maxTokens, r.naikKe, olehId, sekarangIso(), r.kelompok]
    );
  }
  await catatJejakPengaturan(db, olehId, "rute", `Mengubah rute: ${bersih.map((r) => `${r.kelompok}=${r.model}/${r.effort}`).join("; ")}`);
  return bacaRute(db);
}

// ----------------------------------------------------------------------------
// Jejak
// ----------------------------------------------------------------------------

async function catatJejakPengaturan(db: AletaDatabase, olehId: string, aksi: string, ringkas: string) {
  await catatJejak(db, { penggunaId: olehId, peranId: "super-admin", aksi: `admin.${aksi}`, hasil: "ok", ringkas });
}

export type MasukanJejak = {
  penggunaId: string;
  peranId?: string;
  aksi: string;
  percakapanId?: string;
  pesanId?: string;
  model?: string;
  tokenTotal?: number;
  biayaUsd?: number;
  biayaRp?: number;
  hasil?: string;
  ringkas?: string;
};

/** Jejak audit: tidak pernah memuat isi pesan atau kunci. */
export async function catatJejak(db: AletaDatabase, j: MasukanJejak): Promise<void> {
  try {
    await db.run(
      `INSERT INTO aleta_ai_jejak (id, waktu, pengguna_id, peran_id, aksi, percakapan_id, pesan_id, model, token_total, biaya_usd, biaya_rp, hasil, ringkas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `aij-${randomUUID()}`,
        sekarangIso(),
        teks(j.penggunaId),
        teks(j.peranId),
        j.aksi,
        teks(j.percakapanId),
        teks(j.pesanId),
        teks(j.model),
        Math.trunc(j.tokenTotal ?? 0),
        j.biayaUsd ?? 0,
        Math.trunc(j.biayaRp ?? 0),
        teks(j.hasil),
        teks(j.ringkas).slice(0, 500),
      ]
    );
  } catch {
    /* jejak tidak boleh menggagalkan pekerjaan utama */
  }
}
