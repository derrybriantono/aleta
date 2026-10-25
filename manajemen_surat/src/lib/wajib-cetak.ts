import { bakuBanding } from "@/lib/jejak-isian";
import { menyebutAleta } from "@/lib/tanda-aleta";
import type { FaktaPola } from "@/lib/perkara-serupa";

/**
 * ============================================================================
 * DAFTAR WAJIB SEBELUM CETAK DAN SALIN DARI PERKARA SERUPA - ATURAN MURNI
 * (25 Okt 2026, rantai D butir D3 = U13)
 * ============================================================================
 *
 * Berkas ini hanya aturan: tanpa basis data dan tanpa jaringan. Penyimpanan ada di
 * src/server/modules/aleta-ecourt/wajib-cetak.ts.
 *
 * ============================================================================
 * 1. ISIAN YANG BIASANYA SUDAH TERISI SAAT CETAK
 * ============================================================================
 *
 * Ekstensi sudah mengingatkan isian kosong sebelum Cetak (tingkat penting / tidak wajib dari
 * aturan blangko). Yang baru: ALETA mencatat, untuk SEMUA jenis blangko, isian mana yang terisi
 * tiap kali blangko DICETAK. Isian yang terisi pada sedikitnya 90% dari sedikitnya 8 cetak
 * sebelumnya blangko yang sama adalah "biasanya terisi"; bila hari ini masih kosong, ia ikut
 * diingatkan. Pengingat tidak pernah menahan cetak selain lewat dialog yang sudah ada
 * ("Tetap cetak" selalu ada).
 *
 * ============================================================================
 * 2. SALIN DARI PERKARA SERUPA - HANYA USULAN, HANYA YANG BUKAN IDENTITAS
 * ============================================================================
 *
 * Isian kosong dapat diberi USULAN dari perkara sejenis yang sudah putus (pola fakta yang sama,
 * perkara-serupa.ts). Syarat berlapis supaya fakta satu perkara tidak berpindah ke perkara lain:
 *   - bukan isian identitas atau fakta perkara (nama, alamat, NIK, tanggal, nomor, jumlah uang,
 *     saksi, bukti, anak, harta ... lihat POLA_BUKAN_SALINAN);
 *   - nilainya TIDAK berisi tanggal atau deretan angka;
 *   - nilai yang SAMA ditulis pada sedikitnya 2 perkara serupa yang berbeda (rumusan bersama,
 *     bukan fakta tunggal);
 *   - hanya usulan "ragu": petugas yang menekan Tab / Input ke ABT; tidak pernah ditulis sendiri.
 */

export const KODE_FITUR_WAJIB_CETAK = "wajib-sebelum-cetak";

/** Cetak minimal sebuah blangko sebelum ALETA berani menyebut isian "biasanya terisi". */
export const MIN_CETAK_WAJIB = 8;
/** Bagian cetak yang harus sudah mengisinya. */
export const RASIO_WAJIB = 0.9;
/** Laporan cetak terbaru per blangko yang dipakai belajar. */
export const JENDELA_LAPOR = 300;
export const BATAS_ISIAN_LAPOR = 400;
export const BATAS_RIWAYAT_PER_BERKAS = 50;
/** Perkara serupa yang diperiksa dan syarat nilai sama. */
export const BATAS_SERUPA = 8;
export const MIN_SERUPA_SAMA = 2;
export const BATAS_NILAI_SALINAN = 400;

const teks = (x: unknown): string => String(x ?? "").trim();

export type IsianLapor = { kode: string; terisi: boolean };

export type MasukanLapor = {
  perkaraId: string;
  nomorPerkara: string;
  berkas: string;
  jenisBlangko: string;
  jenisPerkara: string;
  isian: IsianLapor[];
  dicetak: boolean;
  fakta: FaktaPola;
};

/** Fakta pola: kunci pendek huruf/angka, nilai skalar pendek, paling banyak 20. */
export function bersihkanFaktaPola(mentah: unknown): FaktaPola {
  const hasil: FaktaPola = {};
  if (!mentah || typeof mentah !== "object" || Array.isArray(mentah)) return hasil;
  for (const [k, v] of Object.entries(mentah as Record<string, unknown>).slice(0, 20)) {
    if (!/^[A-Za-z][A-Za-z0-9]{0,30}$/.test(k)) continue;
    if (typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))) hasil[k] = v;
    else if (typeof v === "string" && v.trim()) hasil[k] = v.trim().slice(0, 60);
  }
  return hasil;
}

/** Membersihkan satu laporan kelengkapan dari ekstensi; null bila tak lengkap. */
export function bersihkanLapor(mentah: unknown): MasukanLapor | null {
  if (!mentah || typeof mentah !== "object" || Array.isArray(mentah)) return null;
  const o = mentah as Record<string, unknown>;
  const perkaraId = teks(o.perkaraId).slice(0, 60);
  const berkas = teks(o.berkas).slice(0, 300);
  if (!perkaraId || !berkas) return null;
  const lihat = new Set<string>();
  const isian: IsianLapor[] = [];
  for (const x of (Array.isArray(o.isian) ? o.isian : []).slice(0, BATAS_ISIAN_LAPOR)) {
    if (!x || typeof x !== "object") continue;
    const kode = teks((x as Record<string, unknown>).kode).replace(/[^0-9A-Za-z_-]/g, "").slice(0, 20);
    if (!kode || lihat.has(kode)) continue;
    lihat.add(kode);
    isian.push({ kode, terisi: Boolean((x as Record<string, unknown>).terisi) });
  }
  if (!isian.length) return null;
  return {
    perkaraId,
    nomorPerkara: teks(o.nomorPerkara).slice(0, 100),
    berkas,
    jenisBlangko: teks(o.jenisBlangko ?? o.jenis).slice(0, 20),
    jenisPerkara: teks(o.jenisPerkara).slice(0, 120),
    isian,
    dicetak: o.dicetak === true,
    fakta: bersihkanFaktaPola(o.fakta),
  };
}

/** "kode:1,kode:0" terurut menurut kode - bentuk ringkas, dan dasar membandingkan dua keadaan. */
export function tandaIsian(isian: IsianLapor[]): string {
  return [...isian]
    .sort((a, b) => a.kode.localeCompare(b.kode))
    .map((i) => `${i.kode}:${i.terisi ? 1 : 0}`)
    .join(",");
}

export function uraiTanda(tanda: string): Map<string, boolean> {
  const peta = new Map<string, boolean>();
  for (const bagian of teks(tanda).split(",")) {
    const [kode, nilai] = bagian.split(":");
    if (kode) peta.set(kode, nilai === "1");
  }
  return peta;
}

export type IsianBiasanya = { kode: string; terisi: number; dari: number; rasio: number };

export type HasilBelajar = { cetak: number; cukupData: boolean; wajib: IsianBiasanya[] };

/**
 * Isian yang BIASANYA sudah terisi saat blangko dicetak: terisi pada >= RASIO_WAJIB dari paling sedikit
 * MIN_CETAK_WAJIB cetak yang memuat isian itu. Hanya baris `dicetak` yang dihitung (keadaan saat petugas
 * sungguh mencetak, bukan saat masih mengisi). Murni.
 */
export function pelajariWajib(laporan: Array<{ isian: string; dicetak: boolean }>, opsi: { min?: number; rasio?: number } = {}): HasilBelajar {
  const min = opsi.min ?? MIN_CETAK_WAJIB;
  const rasio = opsi.rasio ?? RASIO_WAJIB;
  const hitung = new Map<string, { terisi: number; dari: number }>();
  let cetak = 0;
  for (const l of laporan) {
    if (!l.dicetak) continue;
    cetak += 1;
    for (const [kode, terisi] of uraiTanda(l.isian)) {
      const w = hitung.get(kode) ?? { terisi: 0, dari: 0 };
      w.dari += 1;
      if (terisi) w.terisi += 1;
      hitung.set(kode, w);
    }
  }
  const wajib: IsianBiasanya[] = [];
  for (const [kode, w] of hitung) {
    if (w.dari < min) continue;
    const r = w.terisi / w.dari;
    if (r >= rasio) wajib.push({ kode, terisi: w.terisi, dari: w.dari, rasio: Math.round(r * 1000) / 1000 });
  }
  wajib.sort((a, b) => b.rasio - a.rasio || b.dari - a.dari || a.kode.localeCompare(b.kode));
  return { cetak, cukupData: cetak >= min, wajib };
}

// ─── Salin dari perkara serupa ──────────────────────────────────────────────

/** Nama isian yang berarti identitas atau fakta tunggal perkara: tidak pernah disalin dari perkara lain. */
export const POLA_BUKAN_SALINAN =
  /nama|alamat|nik\b|ktp|tempat\s*lahir|tgl|tanggal|umur|usia|pekerjaan|agama|telepon|telp|\bhp\b|email|nomor|\bno\b|rp\b|rupiah|biaya|panjar|uang|nilai|jumlah|mas\s*kawin|mahar|nafkah|harta|anak|saksi|bukti|kuasa|advokat|kantor|penetapan|putusan|akta|surat|buku\s*nikah|tempat\s*tinggal|domisili|kediaman|ahli\s*waris|pewaris|tenggat|batas\s*waktu/i;

const POLA_TANGGAL = /\b\d{1,2}[\s./-]+(?:jan|feb|mar|apr|mei|jun|jul|agu|ags|sep|okt|nov|des)[a-z]*[\s./-]+\d{2,4}\b|\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b|\b(?:19|20)\d{2}\b/i;

/** Boleh disalin sebagai usulan? Nama isian bukan identitas/fakta, nilai tanpa tanggal/angka panjang/tanda sistem, tidak terlalu panjang. */
export function bolehDisalin(nama: unknown, nilai: unknown): boolean {
  const n = teks(nama);
  const v = String(nilai ?? "").trim();
  if (!n || !v) return false;
  if (POLA_BUKAN_SALINAN.test(n)) return false;
  if (v.length > BATAS_NILAI_SALINAN) return false;
  if (POLA_TANGGAL.test(v)) return false;
  if ((v.match(/\d/g) ?? []).length >= 4) return false;
  if (menyebutAleta(v)) return false;
  return true;
}

export type NilaiPerkaraSerupa = { perkaraId: string; nomorPerkara: string; kode: string; nama: string; nilai: string; pada: string };

export type UsulanSerupa = {
  kode: string;
  nilai: string;
  /** Berapa perkara serupa menulis nilai ini. */
  jumlah: number;
  /** Berapa perkara serupa menulis isian ini (dengan nilai apa pun). */
  dari: number;
  nomorPerkara: string[];
};

/**
 * Usulan nilai per kode dari nilai akhir perkara serupa: nilai (dibakukan) yang ditulis paling banyak perkara
 * berbeda, minimal `minSama`; sama banyak -> yang terbaru. Hanya kode yang diminta dan lolos bolehDisalin. Murni.
 */
export function susunUsulanSerupa(baris: NilaiPerkaraSerupa[], kodeDiminta: Iterable<string>, minSama = MIN_SERUPA_SAMA): UsulanSerupa[] {
  const diminta = new Set(Array.from(kodeDiminta, (k) => teks(k)));
  const perKode = new Map<string, NilaiPerkaraSerupa[]>();
  for (const b of baris) {
    if (!diminta.has(b.kode)) continue;
    const daftar = perKode.get(b.kode) ?? [];
    daftar.push(b);
    perKode.set(b.kode, daftar);
  }
  const hasil: UsulanSerupa[] = [];
  for (const [kode, daftar] of perKode) {
    // satu nilai per perkara: yang terbaru
    const terbaru = new Map<string, NilaiPerkaraSerupa>();
    for (const b of daftar) {
      const lama = terbaru.get(b.perkaraId);
      if (!lama || b.pada > lama.pada) terbaru.set(b.perkaraId, b);
    }
    const kelompok = new Map<string, { nilai: string; perkara: NilaiPerkaraSerupa[]; pada: string }>();
    for (const b of terbaru.values()) {
      const kunci = bakuBanding(b.nilai);
      if (!kunci) continue;
      const w = kelompok.get(kunci) ?? { nilai: b.nilai.trim(), perkara: [], pada: "" };
      w.perkara.push(b);
      if (b.pada > w.pada) {
        w.pada = b.pada;
        w.nilai = b.nilai.trim();
      }
      kelompok.set(kunci, w);
    }
    const urut = Array.from(kelompok.values()).sort((a, b) => b.perkara.length - a.perkara.length || b.pada.localeCompare(a.pada));
    const menang = urut[0];
    if (!menang || menang.perkara.length < minSama) continue;
    if (!bolehDisalin(menang.perkara[0].nama, menang.nilai)) continue;
    hasil.push({
      kode,
      nilai: menang.nilai,
      jumlah: menang.perkara.length,
      dari: terbaru.size,
      nomorPerkara: menang.perkara.map((p) => p.nomorPerkara).filter(Boolean).sort(),
    });
  }
  return hasil.sort((a, b) => b.jumlah - a.jumlah || a.kode.localeCompare(b.kode));
}
