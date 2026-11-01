import { gabungPembuktian, matriksSah, sidikBerkas, type MatriksDalil, type PembuktianDalil } from "@/lib/matriks-dalil";
import { type AletaDatabase } from "@/server/db/client";
import { type DokumenArsip } from "@/server/modules/aleta-ecourt/kuasa-gugatan";
import { type HasilIsiGugatan } from "@/server/modules/aleta-ecourt/isi-gugatan";

/**
 * ============================================================================
 * P2 (1 Nov 2026) - MATRIKS DALIL SATU SUMBER: PENYIMPANAN & PEMBARUAN OTOMATIS
 * ============================================================================
 *
 * Satu-satunya modul yang menyentuh aleta_matriks_dalil (migrasi 0126). Satu baris per perkara (kunci nomor_perkara = indeks),
 * berisi matriks yang SUDAH dihitung bot dari teks yang dibaca pembaca e-Court yang sama dengan rute isi-gugatan
 * (bacaGugatanSinggah + bacaGugatanEcourt - tidak ada pembaca kedua), atau dari posita/petitum SIPP bila perkara tanpa berkas.
 *
 * Pembaruan otomatis tanpa tombol:
 *   - rute isi-gugatan menyimpan matriks setiap kali berkas e-Court dibaca ulang (simpanDariIsiGugatan);
 *   - pastikanMatriksDalil membandingkan sidik daftar berkas e-Court (satu panggilan ringan ke bot, disinggahkan 60 detik) dengan
 *     sidik tersimpan: sama = baris tersimpan dikembalikan tanpa hitung ulang; berbeda (berkas baru masuk) = dibaca ulang & disimpan.
 *     Perkara tanpa berkas e-Court: posita SIPP dibaca ulang paling cepat tiap 6 jam (sidik isi posita/petitum).
 *   - kolom `pembuktian` (peta id dalil -> status, diisi agen A2) TIDAK disentuh hitung ulang; id dalil stabil selama teksnya sama.
 *
 * Tidak ada yang ditulis ke SIPP/ABT/e-Court.
 */

const UMUR_SIPP_MS = 6 * 60 * 60 * 1000;
const SINGGAH_RINCIAN_MS = 60 * 1000;
const BATAS_JSON = 2_000_000;

export type BarisMatriks = {
  nomor_perkara: string;
  sidik: string;
  versi: number | string;
  sumber_gugatan: string;
  jumlah: number | string;
  matriks: string;
  pembuktian: string;
  lama_ms: number | string;
  dihitung_pada: string;
};

export type HasilMatriksDalil = {
  ada: boolean;
  nomorPerkara: string;
  matriks: MatriksDalil | null;
  dihitungPada: string;
  /** Lama hitung bot (ms) - dari baris tersimpan bila dariSimpanan. */
  lamaMs: number;
  dariSimpanan: boolean;
  /** Berkas e-Court baru terdeteksi tetapi pembacaan ulang belum selesai dalam batas waktu (baris lama dikembalikan). */
  basi: boolean;
  sumber: "ecourt" | "sipp" | "";
  catatan: string[];
};

export type DepsMatriksDalil = {
  /** Daftar berkas arsip e-Court perkara (bot) - ringan, tanpa membaca berkas. */
  rincian: (nomor: string) => Promise<{ ok: boolean; dokumen: DokumenArsip[] }>;
  /** Pembaca e-Court bersama (bacaGugatanSinggah + bacaGugatanEcourt); ulang = abaikan singgahan 30 menit. */
  bacaEcourt: (nomor: string, sebutan: { lawan: string; pelaku: string }, ulang: boolean) => Promise<HasilIsiGugatan>;
  /** Matriks dari posita/petitum SIPP (bot /abt/matriks-dalil). */
  bacaSipp: (nomor: string, sebutan: { lawan: string; pelaku: string }) => Promise<{ matriks: MatriksDalil | null; sidik: string }>;
};

const singgahRincian = new Map<string, { sampai: number; sidik: string }>();
const sedangDihitung = new Map<string, Promise<HasilMatriksDalil>>();

export function buangSinggahanMatriks() {
  singgahRincian.clear();
  sedangDihitung.clear();
}

function urai<T>(teks: string, cadangan: T): T {
  try {
    return JSON.parse(teks || "") as T;
  } catch {
    return cadangan;
  }
}

export async function bacaBarisMatriks(db: AletaDatabase, nomor: string): Promise<BarisMatriks | null> {
  return db
    .queryOne<BarisMatriks>(
      "SELECT nomor_perkara, sidik, versi, sumber_gugatan, jumlah, matriks, pembuktian, lama_ms, dihitung_pada FROM aleta_matriks_dalil WHERE nomor_perkara = ?",
      [nomor]
    )
    .catch(() => null);
}

function dariBaris(b: BarisMatriks, ekstra: Partial<HasilMatriksDalil> = {}): HasilMatriksDalil {
  const m = matriksSah(urai<unknown>(b.matriks, null));
  const pembuktian = urai<Record<string, PembuktianDalil>>(b.pembuktian, {});
  return {
    ada: Boolean(m && m.dalil.length),
    nomorPerkara: b.nomor_perkara,
    matriks: m ? gabungPembuktian(m, pembuktian) : null,
    dihitungPada: String(b.dihitung_pada || ""),
    lamaMs: Number(b.lama_ms) || 0,
    dariSimpanan: true,
    basi: false,
    sumber: (b.sumber_gugatan === "ecourt" || b.sumber_gugatan === "sipp" ? b.sumber_gugatan : "") as HasilMatriksDalil["sumber"],
    catatan: m ? m.catatan : [],
    ...ekstra,
  };
}

/** Simpan (ganti) matriks satu perkara; kolom pembuktian tetap. Galat basis data tidak pernah menggagalkan pemanggil. */
export async function simpanMatriks(db: AletaDatabase, nomor: string, sidik: string, m: MatriksDalil, kini = new Date()): Promise<boolean> {
  const json = JSON.stringify(m);
  if (json.length > BATAS_JSON) return false;
  const nilai = [sidik, m.versi, m.sumberGugatan, m.dalil.length, json, m.ms, kini.toISOString(), nomor];
  const ubah = await db
    .run("UPDATE aleta_matriks_dalil SET sidik = ?, versi = ?, sumber_gugatan = ?, jumlah = ?, matriks = ?, lama_ms = ?, dihitung_pada = ? WHERE nomor_perkara = ?", nilai)
    .catch(() => null);
  if (ubah && ubah.changes) return true;
  const tambah = await db
    .run(
      "INSERT INTO aleta_matriks_dalil (sidik, versi, sumber_gugatan, jumlah, matriks, lama_ms, dihitung_pada, nomor_perkara, pembuktian) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{}')",
      nilai
    )
    .catch(() => null);
  return Boolean(tambah);
}

/**
 * Dipanggil rute isi-gugatan sesudah berkas e-Court dibaca ULANG (bukan dari singgahan): matriks dari jawaban bot disimpan
 * bersama sidik daftar berkasnya. Tanpa menunggu pembaca kedua.
 */
export async function simpanDariIsiGugatan(db: AletaDatabase, nomor: string, hasil: HasilIsiGugatan, kini = new Date()) {
  const m = matriksSah(hasil.matriksDalil);
  if (!m || !hasil.sidikBerkas) return false;
  singgahRincian.set(nomor, { sampai: Date.now() + SINGGAH_RINCIAN_MS, sidik: hasil.sidikBerkas });
  return simpanMatriks(db, nomor, hasil.sidikBerkas, m, kini);
}

/** Agen A2: catat status pembuktian dalil (peta id -> status). Hitung ulang matriks tidak menghapusnya. */
export async function aturPembuktian(db: AletaDatabase, nomor: string, ubah: Record<string, PembuktianDalil | null>) {
  const b = await bacaBarisMatriks(db, nomor);
  if (!b) return false;
  const lama = urai<Record<string, PembuktianDalil>>(b.pembuktian, {});
  for (const [id, v] of Object.entries(ubah)) {
    if (!/^[A-Z]{1,2}-[0-9a-f]{10}(?:-\d+)?$/.test(id)) continue;
    if (v) lama[id] = v;
    else delete lama[id];
  }
  const r = await db.run("UPDATE aleta_matriks_dalil SET pembuktian = ? WHERE nomor_perkara = ?", [JSON.stringify(lama), nomor]).catch(() => null);
  return Boolean(r && r.changes);
}

async function sidikKini(nomor: string, deps: DepsMatriksDalil): Promise<string | null> {
  const s = singgahRincian.get(nomor);
  if (s && s.sampai > Date.now()) return s.sidik;
  const r = await deps.rincian(nomor).catch(() => ({ ok: false, dokumen: [] as DokumenArsip[] }));
  if (!r.ok) return null;
  const sidik = sidikBerkas(r.dokumen || []);
  singgahRincian.set(nomor, { sampai: Date.now() + SINGGAH_RINCIAN_MS, sidik });
  if (singgahRincian.size > 500) for (const [k, v] of singgahRincian) if (v.sampai <= Date.now()) singgahRincian.delete(k);
  return sidik;
}

async function hitung(db: AletaDatabase, nomor: string, sebutan: { lawan: string; pelaku: string }, sidik: string, adaSimpanan: boolean, deps: DepsMatriksDalil): Promise<HasilMatriksDalil> {
  const kini = new Date();
  if (sidik) {
    const h = await deps.bacaEcourt(nomor, sebutan, adaSimpanan);
    const m = matriksSah(h.matriksDalil);
    if (m) {
      await simpanMatriks(db, nomor, sidik, m, kini);
      const b = await bacaBarisMatriks(db, nomor);
      if (b) return { ...dariBaris(b), dariSimpanan: false };
      return { ada: m.dalil.length > 0, nomorPerkara: nomor, matriks: m, dihitungPada: kini.toISOString(), lamaMs: m.ms, dariSimpanan: false, basi: false, sumber: m.sumberGugatan, catatan: m.catatan };
    }
    // Berkas ada tetapi tidak satu pun terbaca (pindaian tanpa OCR, berkas bukti saja): posita SIPP menjadi dalil gugatan.
  }
  const s = await deps.bacaSipp(nomor, sebutan).catch(() => ({ matriks: null, sidik: "" }));
  if (!s.matriks) return { ada: false, nomorPerkara: nomor, matriks: null, dihitungPada: "", lamaMs: 0, dariSimpanan: false, basi: false, sumber: "", catatan: ["Posita perkara belum terbaca dari SIPP."] };
  // Perkara berberkas e-Court yang tidak terbaca tetap memakai sidik berkasnya (berkas baru = hitung ulang); tanpa berkas = sidik posita.
  await simpanMatriks(db, nomor, sidik || `sipp:${s.sidik}`, s.matriks, kini);
  const b = await bacaBarisMatriks(db, nomor);
  return b ? { ...dariBaris(b), dariSimpanan: false } : { ada: s.matriks.dalil.length > 0, nomorPerkara: nomor, matriks: s.matriks, dihitungPada: kini.toISOString(), lamaMs: s.matriks.ms, dariSimpanan: false, basi: false, sumber: "sipp", catatan: s.matriks.catatan };
}

/**
 * Matriks dalil perkara - dari simpanan bila berkas e-Court belum berubah, selain itu dihitung ulang (satu hitungan bersama per
 * perkara walau dipanggil berbarengan). `batasMs`: bila hitung ulang lebih lama, baris lama dikembalikan dengan basi=true dan
 * hitungan diteruskan di latar (hasilnya tersimpan untuk pembacaan berikutnya). Agen server memanggil tanpa batas (menunggu hasil).
 */
export async function pastikanMatriksDalil(
  db: AletaDatabase,
  nomor: string,
  sebutan: { lawan: string; pelaku: string },
  deps: DepsMatriksDalil,
  opsi: { batasMs?: number; kini?: Date } = {}
): Promise<HasilMatriksDalil> {
  const kini = opsi.kini || new Date();
  const lama = await bacaBarisMatriks(db, nomor);
  const sidik = await sidikKini(nomor, deps);
  if (lama) {
    const sama = sidik === null || (sidik ? lama.sidik === sidik : lama.sidik.startsWith("sipp:") && kini.getTime() - Date.parse(lama.dihitung_pada) < UMUR_SIPP_MS);
    // sidik === null: bot tak terjangkau - simpanan tetap dipakai (tanpa hitung ulang yang pasti gagal).
    if (sama) return dariBaris(lama);
  }
  let janji = sedangDihitung.get(nomor);
  if (!janji) {
    janji = hitung(db, nomor, sebutan, sidik || "", Boolean(lama), deps).finally(() => sedangDihitung.delete(nomor));
    sedangDihitung.set(nomor, janji);
  }
  if (!opsi.batasMs || !lama) {
    if (!opsi.batasMs) return janji;
    // Belum ada simpanan: tunggu sampai batas, lalu kabarkan sedang dihitung.
    const habis = new Promise<null>((r) => setTimeout(() => r(null), opsi.batasMs));
    const h = await Promise.race([janji, habis]);
    return h || { ada: false, nomorPerkara: nomor, matriks: null, dihitungPada: "", lamaMs: 0, dariSimpanan: false, basi: true, sumber: "", catatan: ["Dalil sedang disusun dari berkas perkara."] };
  }
  const habis = new Promise<null>((r) => setTimeout(() => r(null), opsi.batasMs));
  const h = await Promise.race([janji, habis]);
  return h || dariBaris(lama, { basi: true });
}
