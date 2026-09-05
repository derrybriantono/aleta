import { randomUUID } from "node:crypto";

import { cariSerupa, susunSidik, type FaktaPola, type Kemiripan, type SidikPerkara } from "@/lib/perkara-serupa";
import {
  kompetensiTerpenuhi,
  periksaPerkara,
  urutkanHasil,
  type AturanPemeriksaan,
  type Fakta,
  type HasilPemeriksaan,
} from "@/lib/pemeriksaan-perkara";
import type { AletaDatabase } from "@/server/db/client";
import { bukaJangkar } from "@/server/modules/aleta-ecourt/pustaka-hukum";

/**
 * ANALISIS PERKARA (G1-G5).
 *
 * ============================================================================
 * YANG DIJALANKAN HANYA ATURAN YANG SUDAH DISAHKAN
 * ============================================================================
 *
 * Sama dengan pustaka pertimbangan, dan karena sebab yang sama: satu aturan
 * yang keliru tidak salah sekali, melainkan salah pada SETIAP perkara yang
 * diperiksanya. Aturan kompetensi yang terlalu longgar meloloskan perkara yang
 * bukan wewenang pengadilan ini, dan meloloskannya dengan rapi.
 *
 * Aturan masuk sebagai tidak aktif. Mengaktifkannya mencatat siapa yang
 * menekan DAN atas perintah siapa.
 *
 * ============================================================================
 * JANGKAR DIPERIKSA SAAT DIJALANKAN, BUKAN SAAT DISIMPAN
 * ============================================================================
 *
 * Peraturan dapat dimuat sesudah aturan dibuat, dan dapat dicabut sesudah
 * aturan disahkan. Memeriksa jangkarnya sekali saat penyimpanan berarti
 * pemeriksaan berjalan atas dasar hukum yang mungkin sudah tidak ada -
 * keadaan yang tidak menghasilkan galat apa pun, hanya kesimpulan yang salah.
 */

function bersih(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

export type AturanTersimpan = AturanPemeriksaan & {
  id: string;
  jenisPerkara: string;
  aktif: boolean;
  disahkanOleh: string;
  atasPerintah: string;
  disahkanAt: string;
};

function bentukAturan(baris: Record<string, unknown>): AturanTersimpan {
  let pembanding: unknown = null;
  try {
    pembanding = JSON.parse(bersih(baris.pembanding) || "null");
  } catch {
    pembanding = bersih(baris.pembanding);
  }
  return {
    id: bersih(baris.id),
    kode: bersih(baris.kode),
    kelompok: (bersih(baris.kelompok) || "formil") as AturanPemeriksaan["kelompok"],
    hal: bersih(baris.hal),
    jenis: (bersih(baris.jenis) || "wajibAda") as AturanPemeriksaan["jenis"],
    fakta: bersih(baris.fakta),
    pembanding,
    tingkat: (bersih(baris.tingkat) || "peringatan") as AturanPemeriksaan["tingkat"],
    tindakan: bersih(baris.tindakan),
    jangkar: bersih(baris.jangkar),
    jenisPerkara: bersih(baris.jenis_perkara),
    aktif: Number(baris.aktif ?? 0) === 1,
    disahkanOleh: bersih(baris.disahkan_oleh),
    atasPerintah: bersih(baris.atas_perintah),
    disahkanAt: bersih(baris.disahkan_at),
  };
}

/**
 * Aturan yang berlaku bagi satu jenis perkara.
 *
 * Yang jenis_perkara-nya kosong berlaku bagi semua - itulah bentuk sebagian
 * besar syarat formil. Hanya yang AKTIF yang dikembalikan; tidak ada parameter
 * untuk membuka yang belum disahkan, karena parameter itu akan dipakai saat
 * daftarnya masih kosong.
 */
export async function aturanBerlaku(db: AletaDatabase, jenisPerkara: string): Promise<AturanTersimpan[]> {
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT * FROM aleta_aturan_periksa
      WHERE aktif = 1 AND (jenis_perkara = '' OR LOWER(jenis_perkara) = LOWER(?))
      ORDER BY kelompok ASC, kode ASC`,
    [bersih(jenisPerkara)]
  );
  return baris.map(bentukAturan);
}

export async function daftarAturan(db: AletaDatabase, hanyaAktif = false): Promise<AturanTersimpan[]> {
  const baris = await db.queryAll<Record<string, unknown>>(
    hanyaAktif
      ? `SELECT * FROM aleta_aturan_periksa WHERE aktif = 1 ORDER BY kelompok ASC, kode ASC`
      : `SELECT * FROM aleta_aturan_periksa ORDER BY kelompok ASC, kode ASC`
  );
  return baris.map(bentukAturan);
}

export type MasukanAturan = {
  kode: string;
  kelompok: AturanPemeriksaan["kelompok"];
  hal: string;
  jenis: AturanPemeriksaan["jenis"];
  fakta: string;
  pembanding?: unknown;
  tingkat: AturanPemeriksaan["tingkat"];
  tindakan: string;
  jangkar: string;
  jenisPerkara?: string;
};

/**
 * Menyimpan aturan baru - selalu TIDAK aktif.
 *
 * Tidak ada jalur yang membuat aturan langsung aktif. Aturan yang lahir aktif
 * akan dibuat pada hari yang sibuk oleh orang yang yakin, dan keyakinan itu
 * tidak tercatat di mana pun.
 */
export async function simpanAturan(
  db: AletaDatabase,
  aktor: string,
  masukan: MasukanAturan
): Promise<{ ok: boolean; id: string; sebab?: string }> {
  const kode = bersih(masukan.kode);
  const fakta = bersih(masukan.fakta);
  const jangkar = bersih(masukan.jangkar);

  if (!kode) return { ok: false, id: "", sebab: "Kode aturan wajib diisi." };
  if (!fakta) return { ok: false, id: "", sebab: "Nama fakta yang diperiksa wajib diisi." };
  if (!jangkar) {
    return { ok: false, id: "", sebab: "Aturan wajib menyebut jangkar pasal; tanpanya ia tidak memutuskan apa pun." };
  }

  const sudahAda = await db.queryOne<Record<string, unknown>>(
    `SELECT id FROM aleta_aturan_periksa WHERE kode = ?`,
    [kode]
  );
  if (sudahAda) return { ok: false, id: bersih(sudahAda.id), sebab: `Kode "${kode}" sudah dipakai.` };

  const id = randomUUID();
  const sekarang = new Date().toISOString();
  await db.run(
    `INSERT INTO aleta_aturan_periksa
       (id, kode, kelompok, hal, jenis, fakta, pembanding, tingkat, tindakan, jangkar,
        jenis_perkara, aktif, dibuat_oleh, dibuat_at, diubah_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    [
      id,
      kode,
      masukan.kelompok,
      bersih(masukan.hal),
      masukan.jenis,
      fakta,
      JSON.stringify(masukan.pembanding ?? null),
      masukan.tingkat,
      bersih(masukan.tindakan),
      jangkar,
      bersih(masukan.jenisPerkara),
      bersih(aktor),
      sekarang,
      sekarang,
    ]
  );
  return { ok: true, id };
}

/**
 * Mengesahkan aturan.
 *
 * Menuntut dua hal yang tidak dapat dilewati: atas perintah siapa, dan jangkar
 * yang BENAR-BENAR ada di pustaka. Aturan yang disahkan atas dasar pasal yang
 * belum dimuat akan langsung menghasilkan "dasar belum ada" pada tiap perkara -
 * lebih baik penolakannya terjadi di sini, di depan orang yang tahu maksudnya.
 */
export async function sahkanAturan(
  db: AletaDatabase,
  aktor: string,
  masukan: { kode: string; atasPerintah: string }
): Promise<{ ok: boolean; sebab?: string }> {
  const kode = bersih(masukan.kode);
  const atasPerintah = bersih(masukan.atasPerintah);
  if (!atasPerintah) return { ok: false, sebab: "Sebutkan atas perintah siapa aturan ini disahkan." };

  const baris = await db.queryOne<Record<string, unknown>>(
    `SELECT id, jangkar FROM aleta_aturan_periksa WHERE kode = ?`,
    [kode]
  );
  if (!baris) return { ok: false, sebab: "Aturan tidak ditemukan." };

  const jangkar = bersih(baris.jangkar);
  if (!(await bukaJangkar(db, jangkar))) {
    return { ok: false, sebab: `Jangkar "${jangkar}" belum ada di pustaka hukum. Muat peraturannya lebih dulu.` };
  }

  const sekarang = new Date().toISOString();
  await db.run(
    `UPDATE aleta_aturan_periksa
        SET aktif = 1, disahkan_oleh = ?, atas_perintah = ?, disahkan_at = ?, diubah_at = ?
      WHERE kode = ?`,
    [bersih(aktor), atasPerintah, sekarang, sekarang, kode]
  );
  return { ok: true };
}

export async function matikanAturan(
  db: AletaDatabase,
  masukan: { kode: string; alasan: string }
): Promise<{ ok: boolean; sebab?: string }> {
  const alasan = bersih(masukan.alasan);
  if (!alasan) return { ok: false, sebab: "Sebutkan alasan aturan ini dimatikan." };
  const sekarang = new Date().toISOString();
  const hasil = await db.run(
    `UPDATE aleta_aturan_periksa SET aktif = 0, tindakan = ?, diubah_at = ? WHERE kode = ?`,
    [`Dimatikan: ${alasan}`, sekarang, bersih(masukan.kode)]
  );
  return hasil.changes ? { ok: true } : { ok: false, sebab: "Aturan tidak ditemukan." };
}

/**
 * Menjalankan pemeriksaan atas satu perkara.
 *
 * Jangkar tiap aturan dibuka SEKARANG, bukan dipercaya dari saat pengesahan.
 * Peraturan dapat dicabut sesudah aturan disahkan, dan pemeriksaan yang
 * berjalan atas dasar hukum yang sudah tidak ada tidak menghasilkan galat -
 * hanya kesimpulan yang salah.
 */
export async function periksa(
  db: AletaDatabase,
  jenisPerkara: string,
  fakta: Fakta
): Promise<HasilPemeriksaan & { kompetensi: { boleh: boolean; sebab: string } }> {
  const aturan = await aturanBerlaku(db, jenisPerkara);

  const terbukti = new Set<string>();
  for (const jangkar of new Set(aturan.map((item) => item.jangkar).filter(Boolean))) {
    if (await bukaJangkar(db, jangkar)) terbukti.add(jangkar);
  }

  const hasil = periksaPerkara(aturan, fakta, terbukti);
  return {
    ...hasil,
    hasil: urutkanHasil(hasil.hasil),
    kompetensi: kompetensiTerpenuhi(hasil),
  };
}

// =============================================================================
// G5 - PERKARA SERUPA
// =============================================================================

/**
 * Mencatat pola fakta satu perkara.
 *
 * Ditimpa bila sudah ada: pola perkara berubah selama pemeriksaan berjalan -
 * saksi bertambah, kehadiran tercatat - dan pola yang tersimpan dari sidang
 * pertama akan mencocokkan perkara ini dengan perkara yang salah.
 */
export async function catatSidik(
  db: AletaDatabase,
  masukan: { perkaraId: string; nomorPerkara: string; jenisPerkara: string; fakta: FaktaPola }
): Promise<SidikPerkara | null> {
  const perkaraId = bersih(masukan.perkaraId);
  if (!perkaraId) return null;

  const sidik = susunSidik(perkaraId, bersih(masukan.nomorPerkara), masukan.fakta ?? {});
  if (!sidik.butir.length) return null;

  const sekarang = new Date().toISOString();
  const sudahAda = await db.queryOne<Record<string, unknown>>(
    `SELECT id FROM aleta_perkara_sidik WHERE perkara_id = ?`,
    [perkaraId]
  );

  if (sudahAda) {
    await db.run(
      `UPDATE aleta_perkara_sidik
          SET nomor_perkara = ?, jenis_perkara = ?, butir = ?, sidik = ?, dicatat_at = ?
        WHERE perkara_id = ?`,
      [
        sidik.nomorPerkara,
        bersih(masukan.jenisPerkara),
        JSON.stringify(sidik.butir),
        sidik.sidik,
        sekarang,
        perkaraId,
      ]
    );
  } else {
    await db.run(
      `INSERT INTO aleta_perkara_sidik
         (id, perkara_id, nomor_perkara, jenis_perkara, butir, sidik, dicatat_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        perkaraId,
        sidik.nomorPerkara,
        bersih(masukan.jenisPerkara),
        JSON.stringify(sidik.butir),
        sidik.sidik,
        sekarang,
      ]
    );
  }
  return sidik;
}

/**
 * Mencari perkara serupa.
 *
 * Dibatasi ke jenis perkara yang sama. Cerai gugat dan itsbat nikah dapat
 * berbagi banyak butir pola - keduanya punya para pihak, saksi, dan kehadiran -
 * dan kemiripan antar jenis yang berbeda selalu menyesatkan.
 */
export async function perkaraSerupa(
  db: AletaDatabase,
  masukan: { perkaraId: string; nomorPerkara: string; jenisPerkara: string; fakta: FaktaPola; batas?: number }
): Promise<{ acuan: SidikPerkara; serupa: Kemiripan[] }> {
  const acuan = susunSidik(bersih(masukan.perkaraId), bersih(masukan.nomorPerkara), masukan.fakta ?? {});

  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT perkara_id, nomor_perkara, butir FROM aleta_perkara_sidik WHERE LOWER(jenis_perkara) = LOWER(?)`,
    [bersih(masukan.jenisPerkara)]
  );

  const pustaka: SidikPerkara[] = baris.map((item) => {
    let butir: string[] = [];
    try {
      const hasil = JSON.parse(bersih(item.butir) || "[]");
      butir = Array.isArray(hasil) ? hasil.map(bersih).filter(Boolean) : [];
    } catch {
      butir = [];
    }
    return {
      perkaraId: bersih(item.perkara_id),
      nomorPerkara: bersih(item.nomor_perkara),
      butir,
      sidik: butir.join("|"),
    };
  });

  return { acuan, serupa: cariSerupa(acuan, pustaka, { batas: masukan.batas ?? 10 }) };
}
