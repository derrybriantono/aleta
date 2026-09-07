import { randomUUID } from "node:crypto";

import type { AletaDatabase } from "@/server/db/client";

/**
 * KEHADIRAN PERTEMUAN MEDIASI.
 *
 * ============================================================================
 * SIPP MENYIMPAN SATU ANGKA; YANG DITANYAKAN ADALAH SIAPA
 * ============================================================================
 *
 * perkara_jadwal_mediasi menyimpan kehadiran sebagai satu ruas bebas -
 * "dihadiri 1", "dihadiri 2". Angka itu tidak membedakan dua keadaan yang
 * akibat hukumnya berlawanan:
 *
 *   dua PIHAK hadir sendiri   memenuhi PERMA 1/2016 Pasal 7 ayat (1), yang
 *                             menuntut para pihak menghadiri mediasi secara
 *                             langsung;
 *   dua KUASA hadir sendirian tidak memenuhi, kecuali pada keadaan yang
 *                             disebut Pasal 7 ayat (2) - dan dapat berujung
 *                             pada penilaian iktikad baik menurut Pasal 6.
 *
 * Karena itu ALETA mencatatnya menurut empat kedudukan yang terpisah, dan
 * TIDAK PERNAH meringkasnya kembali menjadi satu angka.
 *
 * ============================================================================
 * TIDAK MENYIMPULKAN IKTIKAD BAIK
 * ============================================================================
 *
 * Yang disimpan di sini fakta kehadiran, bukan penilaiannya. Menyimpulkan
 * "tidak beriktikad baik" dari ketidakhadiran adalah kewenangan mediator dan
 * majelis - Pasal 6 menyebut syaratnya berlapis, dan sebagiannya tidak
 * terekam di sistem mana pun.
 *
 * ============================================================================
 * SIPP TIDAK PERNAH DITULIS
 * ============================================================================
 *
 * Seluruh tulisan mendarat di basis data ALETA. Sambungan ke SIPP tetap hanya
 * baca; mediasi_id dan perkara_id disalin sebagai penunjuk, bukan kunci asing.
 */

/**
 * Empat kedudukan yang dicatat.
 *
 * Kuasa ditulis berpasangan dengan sisinya - "kuasa_penggugat", bukan "kuasa"
 * saja. Kuasa tanpa sisi tidak menjawab apa pun: yang menentukan sah tidaknya
 * pertemuan adalah kehadiran tiap SISI, bukan jumlah kuasa yang datang.
 */
export const KEDUDUKAN_MEDIASI = [
  { kunci: "penggugat", label: "Penggugat / Pemohon", sisi: 1, kuasa: false },
  { kunci: "kuasa_penggugat", label: "Kuasa penggugat / pemohon", sisi: 1, kuasa: true },
  { kunci: "tergugat", label: "Tergugat / Termohon", sisi: 2, kuasa: false },
  { kunci: "kuasa_tergugat", label: "Kuasa tergugat / termohon", sisi: 2, kuasa: true },
] as const;

export type KunciKedudukan = (typeof KEDUDUKAN_MEDIASI)[number]["kunci"];

const KUNCI_SAH = new Set<string>(KEDUDUKAN_MEDIASI.map((x) => x.kunci));

const teks = (nilai: unknown): string => String(nilai ?? "").trim();

export type BarisKehadiran = {
  kedudukan: string;
  label: string;
  hadir: boolean;
  nama: string;
  alasan: string;
  catatan: string;
  dicatatOleh: string;
  dicatatAt: string;
  /** Belum pernah dicatat sama sekali - berbeda dari "dicatat sebagai tidak hadir". */
  belumDicatat: boolean;
};

/**
 * Kehadiran satu pertemuan, SELALU empat baris.
 *
 * Kedudukan yang belum pernah dicatat tetap dikembalikan, ditandai
 * belumDicatat. Menghilangkannya membuat layar menampilkan tiga baris dan
 * pembacanya menyangka kedudukan keempat memang tidak ada pada perkara itu -
 * padahal yang terjadi hanya belum diisi.
 */
export async function bacaKehadiran(
  db: AletaDatabase,
  mediasiId: string,
  tanggalPertemuan: string
): Promise<{ baris: BarisKehadiran[]; adaCatatan: boolean }> {
  const mediasi = teks(mediasiId);
  const tanggal = teks(tanggalPertemuan);

  const tersimpan = mediasi
    ? await db.queryAll<Record<string, unknown>>(
        `SELECT kedudukan, hadir, nama, alasan, catatan, dicatat_oleh, dicatat_at
           FROM aleta_kehadiran_mediasi
          WHERE mediasi_id = ? AND tanggal_pertemuan = ?`,
        [mediasi, tanggal]
      )
    : [];

  const peta = new Map<string, Record<string, unknown>>();
  for (const row of tersimpan) peta.set(teks(row.kedudukan), row);

  return {
    adaCatatan: peta.size > 0,
    baris: KEDUDUKAN_MEDIASI.map((kedudukan) => {
      const row = peta.get(kedudukan.kunci);
      return {
        kedudukan: kedudukan.kunci,
        label: kedudukan.label,
        hadir: Number(row?.hadir ?? 0) === 1,
        nama: teks(row?.nama),
        alasan: teks(row?.alasan),
        catatan: teks(row?.catatan),
        dicatatOleh: teks(row?.dicatat_oleh),
        dicatatAt: teks(row?.dicatat_at),
        belumDicatat: !row,
      };
    }),
  };
}

export type IsianKehadiran = {
  kedudukan: string;
  hadir: boolean;
  nama?: string;
  alasan?: string;
  catatan?: string;
};

/**
 * Menyimpan kehadiran satu pertemuan.
 *
 * Kedudukan di luar keempatnya DITOLAK dan disebutkan, bukan didiamkan. Nilai
 * yang tidak dikenali dan tersimpan diam-diam akan muncul kembali sebagai
 * baris yang tidak dapat dibaca layar mana pun.
 */
export async function simpanKehadiran(
  db: AletaDatabase,
  masukan: {
    mediasiId: string;
    perkaraId?: string;
    nomorPerkara?: string;
    tanggalPertemuan: string;
    oleh: string;
    isian: IsianKehadiran[];
  }
): Promise<{ ok: boolean; jumlahDisimpan: number; ditolak: Array<{ kedudukan: string; sebab: string }>; sebab: string }> {
  const mediasi = teks(masukan.mediasiId);
  if (!mediasi) {
    return { ok: false, jumlahDisimpan: 0, ditolak: [], sebab: "Pertemuan mediasi wajib disebut." };
  }

  const tanggal = teks(masukan.tanggalPertemuan);
  const perkara = teks(masukan.perkaraId);
  const nomor = teks(masukan.nomorPerkara);
  const oleh = teks(masukan.oleh);
  const sekarang = new Date().toISOString();

  const ditolak: Array<{ kedudukan: string; sebab: string }> = [];
  let disimpan = 0;

  for (const butir of Array.isArray(masukan.isian) ? masukan.isian : []) {
    const kedudukan = teks(butir.kedudukan);
    if (!KUNCI_SAH.has(kedudukan)) {
      ditolak.push({ kedudukan, sebab: "Kedudukan tidak dikenali." });
      continue;
    }

    const hadir = butir.hadir === true;
    // Alasan hanya bermakna pada yang TIDAK hadir. Menyimpannya pada yang
    // hadir menghasilkan baris yang menerangkan ketidakhadiran orang yang
    // justru datang.
    const alasan = hadir ? "" : teks(butir.alasan).slice(0, 500);
    const nama = teks(butir.nama).slice(0, 200);
    const catatan = teks(butir.catatan).slice(0, 500);

    const lama = await db.queryOne<Record<string, unknown>>(
      `SELECT id FROM aleta_kehadiran_mediasi
        WHERE mediasi_id = ? AND tanggal_pertemuan = ? AND kedudukan = ?`,
      [mediasi, tanggal, kedudukan]
    );

    if (lama) {
      await db.run(
        `UPDATE aleta_kehadiran_mediasi
            SET hadir = ?, nama = ?, alasan = ?, catatan = ?, dicatat_oleh = ?, diperbarui_at = ?
          WHERE id = ?`,
        [hadir ? 1 : 0, nama, alasan, catatan, oleh, sekarang, teks(lama.id)]
      );
    } else {
      await db.run(
        `INSERT INTO aleta_kehadiran_mediasi
           (id, mediasi_id, perkara_id, nomor_perkara, tanggal_pertemuan, kedudukan,
            hadir, nama, alasan, catatan, dicatat_oleh, dicatat_at, diperbarui_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          mediasi,
          perkara,
          nomor,
          tanggal,
          kedudukan,
          hadir ? 1 : 0,
          nama,
          alasan,
          catatan,
          oleh,
          sekarang,
          sekarang,
        ]
      );
    }
    disimpan += 1;
  }

  return { ok: true, jumlahDisimpan: disimpan, ditolak, sebab: "" };
}

/**
 * Ringkasan kehadiran untuk sekumpulan pertemuan sekaligus.
 *
 * Dipakai daftar mediasi supaya tiap baris dapat menyebut keadaannya tanpa
 * satu permintaan per baris.
 */
export async function ringkasKehadiranBanyak(
  db: AletaDatabase,
  mediasiId: string[]
): Promise<Record<string, { hadir: string[]; tidakHadir: string[]; adaCatatan: boolean }>> {
  const daftar = [...new Set(mediasiId.map(teks).filter(Boolean))].slice(0, 500);
  if (daftar.length === 0) return {};

  const isian = daftar.map(() => "?").join(", ");
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT mediasi_id, kedudukan, hadir FROM aleta_kehadiran_mediasi
      WHERE mediasi_id IN (${isian})`,
    daftar
  );

  const hasil: Record<string, { hadir: string[]; tidakHadir: string[]; adaCatatan: boolean }> = {};
  for (const row of baris) {
    const kunci = teks(row.mediasi_id);
    if (!hasil[kunci]) hasil[kunci] = { hadir: [], tidakHadir: [], adaCatatan: true };
    const kedudukan = teks(row.kedudukan);
    if (Number(row.hadir) === 1) hasil[kunci].hadir.push(kedudukan);
    else hasil[kunci].tidakHadir.push(kedudukan);
  }
  return hasil;
}
