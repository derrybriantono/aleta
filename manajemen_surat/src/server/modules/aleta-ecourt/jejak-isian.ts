import { randomUUID } from "node:crypto";

import {
  KODE_FITUR_JEJAK_ISIAN,
  batasRetensi,
  bersihkanMasukanButir,
  bersihkanMasukanIsian,
  kelompokkanButir,
  kelompokkanIsian,
  kemiripan,
  persenDiterimaButir,
  tetapkanHasilButir,
  tetapkanHasilIsian,
  BATAS_KIRIM,
  type KelompokButir,
  type KelompokIsian,
} from "@/lib/jejak-isian";
import { type AletaDatabase } from "@/server/db/client";
import { catatKoreksi } from "@/server/modules/aleta-ecourt/kamus-deteksi";
import { fiturMenyala } from "@/server/modules/satker/fitur";

/**
 * ============================================================================
 * JEJAK ISIAN DAN BUTIR SAKSI - PENYIMPANAN (25 Okt 2026, rantai C butir C1)
 * ============================================================================
 *
 * U1 + U2 + U6. Aturan murninya di src/lib/jejak-isian.ts; di sini hanya
 * membaca saklar, menulis, membaca, dan membersihkan. Tabelnya
 * aleta_saksi_butir dan aleta_isian_jejak (migrasi 0091).
 *
 * ============================================================================
 * SAKLAR: BAWAAN MATI, DAN MATI BERARTI TIDAK MENULIS APA PUN
 * ============================================================================
 *
 * Saklar = butir katalog Fitur Satker "jejak-isian" (bawaan "mati"). Selama
 * mati: ekstensi tidak mengirim, dan SERVER pun menolak menulis (jawaban
 * aktif:false) sehingga ekstensi lama atau yang diubah tidak dapat memaksa
 * jejak masuk. Pembaca gagal ke sisi MATI untuk fitur bawaan mati - itu
 * perilaku keadaanFitur untuk butir yang tidak pernah disimpan.
 *
 * ============================================================================
 * YANG DITULIS DAN YANG TIDAK
 * ============================================================================
 *
 * Tidak ada yang ditulis ke SIPP/ABT/e-Court di berkas ini. Selisih usulan vs
 * final dikirim juga ke aleta_jejak_koreksi (kamus-deteksi.ts) supaya statistik
 * per pola menjangkau saksi dan isian Blangko Derry. Gagal mencatat koreksi
 * TIDAK menggagalkan jejak: koreksi hanya tambahan.
 *
 * Tulisan ke jejak adalah catatan, bukan sumber kebenaran isian: ABT tetap
 * satu-satunya tempat nilai yang berlaku.
 */

export async function jejakIsianAktif(db: AletaDatabase): Promise<boolean> {
  try {
    return await fiturMenyala(db, KODE_FITUR_JEJAK_ISIAN);
  } catch {
    return false;
  }
}

export type AktorJejak = { id: string; nama?: string | null };

const teks = (x: unknown) => String(x ?? "").trim();

async function namaAktor(db: AletaDatabase, aktor: AktorJejak): Promise<string> {
  if (aktor.nama) return teks(aktor.nama);
  try {
    const b = await db.queryOne<Record<string, unknown>>(`SELECT name FROM users WHERE id = ?`, [aktor.id]);
    return teks(b?.name);
  } catch {
    return "";
  }
}

// ─── Pembersihan (retensi 2 tahun) ──────────────────────────────────────────

let pembersihanTerakhir = 0;
const SELANG_BERSIH_MS = 6 * 3_600_000;

/** Menghapus baris lebih tua dari retensi. Mengembalikan jumlah yang dihapus per tabel. */
export async function bersihkanJejakLawas(db: AletaDatabase, sekarang: Date = new Date()) {
  const batas = batasRetensi(sekarang);
  const butir = await db.queryOne<Record<string, unknown>>(`SELECT COUNT(*) AS n FROM aleta_saksi_butir WHERE pada < ?`, [batas]);
  const isian = await db.queryOne<Record<string, unknown>>(`SELECT COUNT(*) AS n FROM aleta_isian_jejak WHERE pada < ?`, [batas]);
  await db.run(`DELETE FROM aleta_saksi_butir WHERE pada < ?`, [batas]);
  await db.run(`DELETE FROM aleta_isian_jejak WHERE pada < ?`, [batas]);
  return { butir: Number(butir?.n) || 0, isian: Number(isian?.n) || 0, batas };
}

function bersihkanBilaPerlu(db: AletaDatabase) {
  const kini = Date.now();
  if (kini - pembersihanTerakhir < SELANG_BERSIH_MS) return;
  pembersihanTerakhir = kini;
  void bersihkanJejakLawas(db).catch(() => undefined);
}

/** Untuk uji: melupakan penanda pembersihan terakhir. */
export function lupakanPembersihanTerakhir() {
  pembersihanTerakhir = 0;
}

// ─── Isian (U2 + U6) ────────────────────────────────────────────────────────

export type HasilCatat = { aktif: boolean; dicatat: number; koreksi: number; id: string[]; ditolak: number };

/**
 * Mencatat satu atau banyak penyimpanan isian. `daftar` mentah dari ekstensi.
 * Saklar mati -> {aktif:false} dan tidak menulis. `tanpaKoreksi`: jalur yang sudah mengirim koreksinya sendiri
 * (rute abt-riwayat) tidak menggandakannya.
 */
export async function catatJejakIsian(
  db: AletaDatabase,
  aktor: AktorJejak,
  daftar: unknown[],
  opsi: { tanpaKoreksi?: boolean } = {}
): Promise<HasilCatat> {
  if (!(await jejakIsianAktif(db))) return { aktif: false, dicatat: 0, koreksi: 0, id: [], ditolak: 0 };
  const kini = new Date().toISOString();
  const nama = await namaAktor(db, aktor);
  const id: string[] = [];
  let koreksi = 0;
  let ditolak = 0;
  for (const mentah of (Array.isArray(daftar) ? daftar : []).slice(0, BATAS_KIRIM)) {
    const m = bersihkanMasukanIsian(mentah, kini);
    if (!m) {
      ditolak += 1;
      continue;
    }
    const hasil = tetapkanHasilIsian(m.cara, m.nilaiUsulan, m.nilaiFinal);
    const baris = randomUUID();
    await db.run(
      `INSERT INTO aleta_isian_jejak
         (id, perkara_id, nomor_perkara, jenis_perkara, blangko, jenis_blangko, kode, nama_variabel, nilai_usulan, asal_usulan, keyakinan, kode_pola,
          nilai_sebelum, sebelum_dipotong, nilai_final, final_dipotong, cara, hasil, terverifikasi, nilai_terbaca, jalur, urungkan_dari,
          diurungkan_oleh, diurungkan_at, pengguna_id, pengguna_nama, pada, dibuat_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', ?, ?, ?, ?)`,
      [
        baris,
        m.perkaraId,
        m.nomorPerkara,
        m.jenisPerkara,
        m.blangko,
        m.jenisBlangko,
        m.kode,
        m.namaVariabel,
        m.nilaiUsulan,
        m.asalUsulan,
        m.keyakinan,
        m.kodePola,
        m.nilaiSebelum,
        m.sebelumDipotong ? 1 : 0,
        m.nilaiFinal,
        m.finalDipotong ? 1 : 0,
        m.cara,
        hasil,
        m.terverifikasi,
        m.nilaiTerbaca,
        m.jalur,
        m.urungkanDari,
        aktor.id,
        nama,
        m.pada,
        kini,
      ]
    );
    id.push(baris);

    // Urungkan menandai baris asalnya: satu baris tidak diurungkan dua kali dari daftar yang sama.
    if (m.cara === "diurungkan" && m.urungkanDari) {
      await db.run(`UPDATE aleta_isian_jejak SET diurungkan_oleh = ?, diurungkan_at = ? WHERE id = ? AND diurungkan_at = ''`, [aktor.id, kini, m.urungkanDari]);
    }

    // Selisih usulan vs final masuk lingkar koreksi (hanya tindakan manusia atas usulan).
    if (!opsi.tanpaKoreksi && (hasil === "disunting" || hasil === "diterima") && m.nilaiUsulan.trim()) {
      try {
        const k = await catatKoreksi(db, aktor.id, {
          perkaraId: m.perkaraId,
          nomorPerkara: m.nomorPerkara,
          variabel: m.kode,
          namaVariabel: m.namaVariabel,
          nilaiUsulan: m.nilaiUsulan,
          sumber: m.asalUsulan,
          kodePola: m.kodePola,
          keyakinan: m.keyakinan,
          kalimatSumber: "",
          nilaiAkhir: m.nilaiFinal,
          hasil,
          jalur: m.jalur,
          pada: m.pada,
        });
        if (k) koreksi += 1;
      } catch {
        /* koreksi tertinggal - jejak isian tetap tercatat */
      }
    }
  }
  bersihkanBilaPerlu(db);
  return { aktif: true, dicatat: id.length, koreksi, id, ditolak };
}

export type BarisJejakIsian = {
  id: string;
  perkaraId: string;
  nomorPerkara: string;
  blangko: string;
  kode: string;
  nama: string;
  nilaiUsulan: string;
  asalUsulan: string;
  nilaiSebelum: string;
  sebelumDipotong: boolean;
  nilaiFinal: string;
  cara: string;
  hasil: string;
  terverifikasi: string;
  jalur: string;
  urungkanDari: string;
  diurungkanOleh: string;
  diurungkanAt: string;
  oleh: string;
  olehNama: string;
  pada: string;
  /** Baris ini dapat diurungkan dari PC mana pun: nilai sebelumnya utuh, belum diurungkan, dan masih baris terbaru untuk kodenya. */
  bisaDiurungkan: boolean;
};

function keBaris(x: Record<string, unknown>): BarisJejakIsian {
  return {
    id: teks(x.id),
    perkaraId: teks(x.perkara_id),
    nomorPerkara: teks(x.nomor_perkara),
    blangko: teks(x.blangko),
    kode: teks(x.kode),
    nama: teks(x.nama_variabel),
    nilaiUsulan: String(x.nilai_usulan ?? ""),
    asalUsulan: teks(x.asal_usulan),
    nilaiSebelum: String(x.nilai_sebelum ?? ""),
    sebelumDipotong: Number(x.sebelum_dipotong) === 1,
    nilaiFinal: String(x.nilai_final ?? ""),
    cara: teks(x.cara),
    hasil: teks(x.hasil),
    terverifikasi: teks(x.terverifikasi),
    jalur: teks(x.jalur),
    urungkanDari: teks(x.urungkan_dari),
    diurungkanOleh: teks(x.diurungkan_oleh),
    diurungkanAt: teks(x.diurungkan_at),
    oleh: teks(x.pengguna_id),
    olehNama: teks(x.pengguna_nama),
    pada: teks(x.pada),
    bisaDiurungkan: false,
  };
}

/**
 * Jejak satu perkara, terbaru dahulu, LENGKAP (nilai sebelum utuh) supaya Urungkan
 * dapat dijalankan dari PC mana pun. `bisaDiurungkan` hanya benar untuk baris yang
 * masih yang terbaru untuk kodenya (mengurungkan yang lebih lama menimpa suntingan
 * yang lebih baru), belum pernah diurungkan, dan nilai sebelumnya tidak terpotong.
 */
export async function bacaJejakPerkara(db: AletaDatabase, perkaraId: string, batas = 100): Promise<BarisJejakIsian[]> {
  const id = teks(perkaraId);
  if (!id) return [];
  const sampai = Math.max(1, Math.min(Number(batas) || 100, 300));
  const baris = (
    await db.queryAll<Record<string, unknown>>(
      `SELECT * FROM aleta_isian_jejak WHERE perkara_id = ? ORDER BY pada DESC, dibuat_at DESC LIMIT ${sampai}`,
      [id]
    )
  ).map(keBaris);
  const terbaruUntukKode = new Set<string>();
  for (const b of baris) {
    const pertama = !terbaruUntukKode.has(b.kode);
    terbaruUntukKode.add(b.kode);
    b.bisaDiurungkan =
      pertama && !b.sebelumDipotong && !b.diurungkanAt && b.cara !== "diurungkan" && b.nilaiSebelum !== b.nilaiFinal && b.jalur !== "urungkan";
  }
  return baris;
}

export type RingkasanIsian = {
  jumlah: number;
  sejak: string;
  perKode: KelompokIsian[];
  perHasil: Record<string, number>;
  terverifikasiBeda: number;
};

/** Angka lapangan per kode dan asal usulan (dasar U3). Hanya Admin/Super Admin yang memanggilnya (dijaga rute). */
export async function ringkasJejakIsian(db: AletaDatabase, sejak = ""): Promise<RingkasanIsian> {
  const batas = teks(sejak);
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT kode, asal_usulan, hasil, cara, terverifikasi FROM aleta_isian_jejak ${batas ? "WHERE pada >= ?" : ""} ORDER BY pada DESC LIMIT 50000`,
    batas ? [batas] : []
  );
  const perHasil: Record<string, number> = {};
  let beda = 0;
  for (const b of baris) {
    const h = teks(b.hasil);
    perHasil[h] = (perHasil[h] ?? 0) + 1;
    if (teks(b.terverifikasi) === "beda") beda += 1;
  }
  return {
    jumlah: baris.length,
    sejak: batas,
    perKode: kelompokkanIsian(baris.map((b) => ({ kode: teks(b.kode), asalUsulan: teks(b.asal_usulan), hasil: teks(b.hasil), cara: teks(b.cara) }))).slice(0, 300),
    perHasil,
    terverifikasiBeda: beda,
  };
}

// ─── Butir saksi (U1) ───────────────────────────────────────────────────────

/**
 * Mencatat butir saksi yang disimpan petugas. Saklar mati -> tidak menulis.
 * Hasil, kemiripan, dan koreksi dihitung DI SINI.
 */
export async function catatButirSaksi(db: AletaDatabase, aktor: AktorJejak, daftar: unknown[]): Promise<HasilCatat> {
  if (!(await jejakIsianAktif(db))) return { aktif: false, dicatat: 0, koreksi: 0, id: [], ditolak: 0 };
  const kini = new Date().toISOString();
  const nama = await namaAktor(db, aktor);
  const id: string[] = [];
  let koreksi = 0;
  let ditolak = 0;
  for (const mentah of (Array.isArray(daftar) ? daftar : []).slice(0, BATAS_KIRIM * 4)) {
    const m = bersihkanMasukanButir(mentah, kini);
    if (!m) {
      ditolak += 1;
      continue;
    }
    // Butir tanpa usulan dan tanpa teks final tidak berarti apa-apa.
    if (!m.usulan.trim() && !m.teksFinal.trim()) {
      ditolak += 1;
      continue;
    }
    const hasil = tetapkanHasilButir(m.usulan, m.teksFinal);
    const mirip = m.usulan.trim() && m.teksFinal.trim() ? kemiripan(m.usulan, m.teksFinal) : 0;
    const baris = randomUUID();
    await db.run(
      `INSERT INTO aleta_saksi_butir
         (id, perkara_id, nomor_perkara, sidang, saksi_ke, pihak, jalur, variabel, katalog, versi_katalog, jenis_perkara, butir, varian,
          jenis_keterangan, nomor_butir, pertanyaan, usulan, teks_final, hasil, kemiripan, sumber_fakta, keyakinan, kode_pola,
          pengguna_id, pengguna_nama, pada, dibuat_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        baris,
        m.perkaraId,
        m.nomorPerkara,
        m.sidang,
        m.saksiKe,
        m.pihak,
        m.jalur,
        m.variabel,
        m.katalog,
        m.versiKatalog,
        m.jenisPerkara,
        m.butir,
        m.varian,
        m.jenisKeterangan,
        m.nomorButir,
        m.pertanyaan,
        m.usulan,
        m.teksFinal,
        hasil,
        mirip,
        m.sumberFakta,
        m.keyakinan,
        m.kodePola,
        aktor.id,
        nama,
        m.pada,
        kini,
      ]
    );
    id.push(baris);

    // Lingkar koreksi: statistik per pola menjangkau saksi. Variabelnya diberi awalan "saksi-" supaya
    // pembuat calon templat (kamus-deteksi) tidak menjadikan teks keterangan saksi sebagai calon templat.
    if (m.kodePola && (hasil === "diterima" || hasil === "disunting")) {
      try {
        const k = await catatKoreksi(db, aktor.id, {
          perkaraId: m.perkaraId,
          nomorPerkara: m.nomorPerkara,
          variabel: `saksi-${m.variabel || "x"}`,
          namaVariabel: `Keterangan saksi ${m.saksiKe || ""} ${m.pihak}`.trim(),
          nilaiUsulan: m.usulan,
          sumber: m.sumberFakta,
          kodePola: m.kodePola,
          keyakinan: m.keyakinan,
          kalimatSumber: m.pertanyaan,
          nilaiAkhir: m.teksFinal,
          hasil,
          jalur: `saksi-${m.jalur}`,
          pada: m.pada,
        });
        if (k) koreksi += 1;
      } catch {
        /* koreksi tertinggal - butir tetap tercatat */
      }
    }
  }
  bersihkanBilaPerlu(db);
  return { aktif: true, dicatat: id.length, koreksi, id, ditolak };
}

export type LaporanButir = {
  jumlah: number;
  sejak: string;
  /** Bagian butir BERUSULAN yang disimpan tanpa diubah (seluruh data). */
  persenDiterima: number | null;
  perKatalog: KelompokButir[];
  perVarian: KelompokButir[];
  perJenisPerkara: KelompokButir[];
  perJenisKeterangan: KelompokButir[];
  perJalur: KelompokButir[];
  perPola: KelompokButir[];
};

/** Laporan "% butir diterima tanpa diubah" per katalog, varian, dan jenis perkara. Dijaga rute (Admin/Super Admin). */
export async function laporanButirSaksi(db: AletaDatabase, sejak = ""): Promise<LaporanButir> {
  const batas = teks(sejak);
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT katalog, varian, butir, jenis_perkara, jenis_keterangan, jalur, kode_pola, hasil, kemiripan FROM aleta_saksi_butir ${batas ? "WHERE pada >= ?" : ""} ORDER BY pada DESC LIMIT 100000`,
    batas ? [batas] : []
  );
  const per = (fungsi: (b: Record<string, unknown>) => string) =>
    kelompokkanButir(baris.map((b) => ({ kunci: fungsi(b) || "(tanpa)", hasil: teks(b.hasil), kemiripan: Number(b.kemiripan) || 0 })));
  const semua = per(() => "semua")[0];
  return {
    jumlah: baris.length,
    sejak: batas,
    persenDiterima: semua ? semua.persenDiterima : persenDiterimaButir({ diterima: 0, disunting: 0, dibuang: 0 }),
    perKatalog: per((b) => teks(b.katalog)).slice(0, 200),
    perVarian: per((b) => (teks(b.katalog) || teks(b.jalur)) + (teks(b.butir) ? `/${teks(b.butir)}` : "") + (teks(b.varian) ? `#${teks(b.varian)}` : "")).slice(0, 300),
    perJenisPerkara: per((b) => teks(b.jenis_perkara)).slice(0, 100),
    perJenisKeterangan: per((b) => teks(b.jenis_keterangan)).slice(0, 20),
    perJalur: per((b) => teks(b.jalur)),
    perPola: per((b) => teks(b.kode_pola)).slice(0, 300),
  };
}

export type BarisButirSaksi = {
  id: string;
  perkaraId: string;
  nomorPerkara: string;
  sidang: string;
  saksiKe: number;
  pihak: string;
  jalur: string;
  variabel: string;
  katalog: string;
  butir: string;
  varian: string;
  jenisKeterangan: string;
  pertanyaan: string;
  usulan: string;
  teksFinal: string;
  hasil: string;
  kemiripan: number;
  kodePola: string;
  olehNama: string;
  pada: string;
};

/** Butir tercatat satu perkara (Admin/Super Admin). */
export async function bacaButirPerkara(db: AletaDatabase, perkaraId: string, batas = 200): Promise<BarisButirSaksi[]> {
  const id = teks(perkaraId);
  if (!id) return [];
  const sampai = Math.max(1, Math.min(Number(batas) || 200, 500));
  const baris = await db.queryAll<Record<string, unknown>>(`SELECT * FROM aleta_saksi_butir WHERE perkara_id = ? ORDER BY pada DESC, nomor_butir ASC LIMIT ${sampai}`, [id]);
  return baris.map((x) => ({
    id: teks(x.id),
    perkaraId: teks(x.perkara_id),
    nomorPerkara: teks(x.nomor_perkara),
    sidang: teks(x.sidang),
    saksiKe: Number(x.saksi_ke) || 0,
    pihak: teks(x.pihak),
    jalur: teks(x.jalur),
    variabel: teks(x.variabel),
    katalog: teks(x.katalog),
    butir: teks(x.butir),
    varian: teks(x.varian),
    jenisKeterangan: teks(x.jenis_keterangan),
    pertanyaan: String(x.pertanyaan ?? ""),
    usulan: String(x.usulan ?? ""),
    teksFinal: String(x.teks_final ?? ""),
    hasil: teks(x.hasil),
    kemiripan: Number(x.kemiripan) || 0,
    kodePola: teks(x.kode_pola),
    olehNama: teks(x.pengguna_nama),
    pada: teks(x.pada),
  }));
}
