import {
  BATAS_BARIS,
  KODE_FITUR_HURUF_BELAJAR,
  KODE_HURUF_ALASAN,
  bentukBarisHuruf,
  himpunanHuruf,
  ringkasPerPola,
  susunBelajar,
  susunDasarHukum,
  type BarisHuruf,
  type ButirPustaka,
  type DasarHukum,
  type HasilBelajar,
  type StatistikPola,
} from "@/lib/huruf-alasan-belajar";
import { jenisKunci } from "@/lib/ketepatan-isian";
import { type AletaDatabase } from "@/server/db/client";
import { fiturMenyala } from "@/server/modules/satker/fitur";

/**
 * ============================================================================
 * HURUF ALASAN YANG BELAJAR DARI HAKIM - PENYIMPANAN (25 Okt 2026, rantai D butir D4 = U14)
 * ============================================================================
 *
 * Aturan murni di src/lib/huruf-alasan-belajar.ts. Di sini: membaca saklar, membaca pilihan akhir hakim untuk
 * isian 8503 dari jejak isian (C1, aleta_isian_jejak), dan membaca dasar hukum dari pustaka pertimbangan
 * (aleta_pertimbangan_butir/_rujukan, 0026 + label alasan 0061). Tanpa migrasi baru: tidak ada yang disimpan.
 *
 * SAKLAR: Fitur Satker "huruf-alasan-belajar", bawaan MATI. Mati = tidak ada pertimbangan dan tidak ada
 * saran dasar hukum; huruf alasan persis seperti sebelumnya.
 *
 * TETAP USULAN: hasilnya hanya kalimat pertimbangan dan tombol yang ditekan hakim sendiri. Tidak ada yang
 * ditulis ke ABT/SIPP/e-Court di sini.
 */

export async function hurufBelajarAktif(db: AletaDatabase): Promise<boolean> {
  try {
    return await fiturMenyala(db, KODE_FITUR_HURUF_BELAJAR);
  } catch {
    return false;
  }
}

const teks = (x: unknown) => String(x ?? "").trim();

/** Pilihan akhir isian 8503 dari jejak (yang diurungkan tidak dihitung). */
export async function bacaBarisHuruf(db: AletaDatabase): Promise<BarisHuruf[]> {
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT jenis_perkara, nilai_usulan, nilai_final, pengguna_id, pengguna_nama, pada FROM aleta_isian_jejak
      WHERE kode = ? AND hasil <> 'diurungkan' ORDER BY pada DESC LIMIT ${BATAS_BARIS}`,
    [KODE_HURUF_ALASAN]
  );
  return baris.map((b) => bentukBarisHuruf(b)).filter((b): b is BarisHuruf => b !== null);
}

/** Dasar hukum per huruf dari butir pustaka berlabel huruf itu (yang disahkan atau masih usulan). */
export async function dasarHukumHuruf(db: AletaDatabase, huruf: string): Promise<DasarHukum[]> {
  const h = himpunanHuruf(huruf).slice(0, 8);
  const hasil: DasarHukum[] = [];
  for (const satu of h) {
    const butirRows = await db.queryAll<Record<string, unknown>>(
      `SELECT id, keadaan, jumlah_pemakaian FROM aleta_pertimbangan_butir WHERE keadaan IN ('disahkan', 'usulan') AND label_alasan LIKE ? ORDER BY jumlah_pemakaian DESC LIMIT 20`,
      [`%"${satu}"%`]
    );
    const butir: ButirPustaka[] = [];
    for (const b of butirRows) {
      const r = await db.queryAll<Record<string, unknown>>(`SELECT tertulis, pasal, ayat, huruf, peraturan, terbukti FROM aleta_pertimbangan_rujukan WHERE butir_id = ?`, [teks(b.id)]);
      butir.push({
        id: teks(b.id),
        keadaan: teks(b.keadaan),
        jumlahPemakaian: Number(b.jumlah_pemakaian) || 0,
        rujukan: r.map((x) => ({ tertulis: teks(x.tertulis), pasal: teks(x.pasal), ayat: teks(x.ayat), huruf: teks(x.huruf), peraturan: teks(x.peraturan), terbukti: Number(x.terbukti) === 1 })),
      });
    }
    for (const d of susunDasarHukum(satu, butir)) hasil.push(d);
  }
  return hasil;
}

export type JawabanBelajar = {
  aktif: boolean;
  belajar: HasilBelajar | null;
  /** Dasar hukum menurut huruf: huruf mesin dan huruf usulan-beda (bila ada). */
  dasarHukum: Array<{ huruf: string; daftar: DasarHukum[] }>;
};

export type MasukanBelajarServer = { hakimId: string; jenisPerkara: unknown; hurufMesin: unknown; majelis: unknown };

/** Pertimbangan untuk hakim yang membuka perkara. Saklar mati -> kosong. */
export async function bacaBelajar(db: AletaDatabase, m: MasukanBelajarServer): Promise<JawabanBelajar> {
  if (!(await hurufBelajarAktif(db))) return { aktif: false, belajar: null, dasarHukum: [] };
  const hurufMesin = himpunanHuruf(m.hurufMesin);
  const majelis = (Array.isArray(m.majelis) ? m.majelis : []).map((x) => teks(x).slice(0, 120)).filter(Boolean).slice(0, 10);
  const baris = await bacaBarisHuruf(db);
  const belajar = susunBelajar({ baris, jenis: jenisKunci(m.jenisPerkara), hurufMesin, hakimId: teks(m.hakimId), majelis });
  const hurufDasar = new Set<string>();
  if (hurufMesin) hurufMesin.split("").forEach((x) => hurufDasar.add(x));
  if (belajar.usulanBeda) belajar.usulanBeda.huruf.split("").forEach((x) => hurufDasar.add(x));
  const dasarHukum: JawabanBelajar["dasarHukum"] = [];
  for (const h of Array.from(hurufDasar).sort()) {
    const daftar = await dasarHukumHuruf(db, h);
    if (daftar.length) dasarHukum.push({ huruf: h, daftar });
  }
  return { aktif: true, belajar, dasarHukum };
}

export type RingkasanHuruf = { aktif: boolean; jumlah: number; perPola: StatistikPola[] };

/** Kecocokan per pola untuk layar Admin: tanpa nama hakim. */
export async function ringkasHurufBelajar(db: AletaDatabase): Promise<RingkasanHuruf> {
  if (!(await hurufBelajarAktif(db))) return { aktif: false, jumlah: 0, perPola: [] };
  const baris = await bacaBarisHuruf(db);
  return { aktif: true, jumlah: baris.length, perPola: ringkasPerPola(baris).slice(0, 100) };
}
