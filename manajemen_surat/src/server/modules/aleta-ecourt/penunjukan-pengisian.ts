import { isPrivilegedAdmin } from "@/lib/permissions";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * Peta kolom formulir SIPP, dan catatan apa yang benar-benar diisikan.
 *
 * ============================================================================
 * PETA KOLOM ADALAH DATA, DAN ITU BUKAN KEMALASAN
 * ============================================================================
 *
 * Nama kolom formulir SIPP berbeda antar versi - persis seperti nama kolomnya,
 * yang sudah lebih dulu memaksa sippSkemaService membaca information_schema
 * alih-alih menebak.
 *
 * Taruhannya di sini lebih besar. Nama kolom yang salah membuat kueri GAGAL,
 * dengan pesan yang menyebut kolomnya. Penunjuk kolom yang salah membuat
 * pengisian mengenai kolom LAIN - dan itu tidak gagal sama sekali, ia hanya
 * salah. Nama juru sita masuk ke kolom panitera, dan tidak ada yang tahu
 * sampai relaasnya terbit.
 *
 * Karena itu petanya diisi dari kenyataan: ekstensi punya mode "baca formulir"
 * yang menyebutkan kolom apa yang benar ada di halaman, lengkap dengan
 * labelnya. Selama petanya kosong, tombol Kerjakan tetap mati.
 */

export const BORANG = ["data-umum", "pmh", "ppp", "pjs", "phs"] as const;
export type Borang = (typeof BORANG)[number];

const BORANG_SAH = new Set<string>(BORANG);

export const JENIS_KOLOM = ["teks", "pilih", "tanggal", "kaya"] as const;
const JENIS_SAH = new Set<string>(JENIS_KOLOM);

/**
 * Urutan pengisian penunjukan.
 *
 * TIDAK dapat dibalik. SIPP menolak penetapan panitera pengganti dan juru sita
 * selama majelisnya belum ditetapkan - keduanya memang menunjuk ke majelis
 * yang sudah ada. PHS terakhir karena ia menetapkan hari sidang bagi majelis
 * itu.
 *
 * Rencana semula mendahulukan PPP dan PJS dengan alasan keduanya paling mudah
 * dibetulkan bila keliru. Itu tidak dapat dijalankan: bukan soal urutan yang
 * lebih aman, melainkan urutan yang diterima SIPP sama sekali.
 */
export const URUTAN_PENGISIAN: Borang[] = ["pmh", "ppp", "pjs", "phs"];

export type MedanBorang = {
  borang: string;
  medan: string;
  penunjuk: string;
  jenis: string;
  wajib: boolean;
  catatan: string;
};

type BarisKolom = {
  borang: string;
  medan: string;
  penunjuk: string;
  jenis: string;
  wajib: number;
  catatan: string;
};

/** Peta kolom satu formulir, atau seluruhnya bila formulirnya tidak disebut. */
export async function bacaPetaMedan(
  db: AletaDatabase,
  borang?: string
): Promise<MedanBorang[]> {
  const baris = borang
    ? await db
        .prepare(
          "SELECT borang, medan, penunjuk, jenis, wajib, catatan FROM aleta_sipp_borang_medan WHERE borang = ? ORDER BY medan ASC"
        )
        .all<BarisKolom>(borang)
    : await db
        .prepare(
          "SELECT borang, medan, penunjuk, jenis, wajib, catatan FROM aleta_sipp_borang_medan ORDER BY borang ASC, medan ASC"
        )
        .all<BarisKolom>();

  return baris.map((item) => ({
    borang: String(item.borang),
    medan: String(item.medan),
    penunjuk: String(item.penunjuk),
    jenis: String(item.jenis),
    wajib: Number(item.wajib) === 1,
    catatan: String(item.catatan ?? ""),
  }));
}

/**
 * Apakah satu formulir sudah siap diisikan.
 *
 * Siap berarti: ada petanya, dan seluruh kolom yang ditandai wajib punya
 * penunjuk. Borang yang setengah terpetakan TIDAK dinyatakan siap - mengisi
 * separuh formulir lalu menyerahkan sisanya ke petugas menghasilkan formulir yang
 * tidak jelas siapa yang mengisinya, dan itu justru lebih sulit diperiksa
 * daripada formulir yang seluruhnya diketik orang.
 */
export async function borangSiap(db: AletaDatabase, borang: string) {
  const medan = await bacaPetaMedan(db, borang);
  if (medan.length === 0) {
    return { siap: false, alasan: "peta_medan_belum_diisi", medan: [] as MedanBorang[] };
  }
  const kurang = medan.filter((x) => x.wajib && x.penunjuk.trim() === "");
  if (kurang.length > 0) {
    return {
      siap: false,
      alasan: `kolom wajib belum berpenunjuk: ${kurang.map((x) => x.medan).join(", ")}`,
      medan,
    };
  }
  return { siap: true, alasan: "", medan };
}

/** Menyimpan satu penunjuk kolom. */
export async function simpanMedanBorang(
  db: AletaDatabase,
  {
    actorUserId,
    borang,
    medan,
    penunjuk,
    jenis,
    wajib,
    catatan,
  }: {
    actorUserId: string;
    borang: string;
    medan: string;
    penunjuk: string;
    jenis: string;
    wajib?: boolean;
    catatan?: string;
  }
) {
  const actor = await requireActorUser(db, actorUserId);

  if (!isPrivilegedAdmin(actor)) {
    throw new ApiError(403, "Hanya Super Admin dan Admin yang dapat mengubah peta kolom formulir.");
  }
  if (!BORANG_SAH.has(borang)) {
    throw new ApiError(400, "Borang tidak dikenali.");
  }
  if (!JENIS_SAH.has(jenis)) {
    throw new ApiError(400, "Jenis kolom tidak dikenali.");
  }

  const namaKolom = String(medan ?? "").trim();
  if (!namaKolom) {
    throw new ApiError(400, "Nama kolom tidak boleh kosong.");
  }

  // Penunjuk diperiksa bentuknya di sini, bukan hanya di peramban. Pemilih
  // yang tidak sah membuat pengisian berhenti di tengah, meninggalkan formulir
  // separuh terisi - dan yang membacanya kemudian tidak tahu sampai mana.
  const pemilih = String(penunjuk ?? "").trim();
  if (pemilih.length > 300) {
    throw new ApiError(400, "Penunjuk kolom terlalu panjang.");
  }

  const sekarang = new Date().toISOString();

  return withTransaction(db, async (tx) => {
    await tx
      .prepare(
        "INSERT INTO aleta_sipp_borang_medan " +
          "(borang, medan, penunjuk, jenis, wajib, catatan, updated_at, updated_by) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?) " +
          "ON CONFLICT(borang, medan) DO UPDATE SET " +
          "penunjuk = excluded.penunjuk, " +
          "jenis = excluded.jenis, " +
          "wajib = excluded.wajib, " +
          "catatan = excluded.catatan, " +
          "updated_at = excluded.updated_at, " +
          "updated_by = excluded.updated_by"
      )
      .run(
        borang,
        namaKolom,
        pemilih,
        jenis,
        wajib ? 1 : 0,
        String(catatan ?? ""),
        sekarang,
        actor.id
      );

    return bacaPetaMedan(tx, borang);
  });
}

/** Menghapus satu penunjuk kolom. */
export async function hapusMedanBorang(
  db: AletaDatabase,
  { actorUserId, borang, medan }: { actorUserId: string; borang: string; medan: string }
) {
  const actor = await requireActorUser(db, actorUserId);
  if (!isPrivilegedAdmin(actor)) {
    throw new ApiError(403, "Hanya Super Admin dan Admin yang dapat mengubah peta kolom formulir.");
  }

  return withTransaction(db, async (tx) => {
    await tx
      .prepare("DELETE FROM aleta_sipp_borang_medan WHERE borang = ? AND medan = ?")
      .run(borang, medan);
    return bacaPetaMedan(tx, borang);
  });
}

// ===========================================================================
// CATATAN PENGISIAN
// ===========================================================================

export type BarisPengisian = {
  jenis: string;
  medan: string;
  nilai: string;
  asal: "otomatis" | "manual";
  usulanSemula?: string;
  alasan?: string;
};

/**
 * Mencatat apa yang diisikan ekstensi ke formulir SIPP.
 *
 * Yang dicatat bukan hanya nilainya, melainkan ASALNYA: usulan otomatis yang
 * diterima apa adanya, atau pilihan manual yang menggantikannya. Tanpa
 * pembedaan itu, pertanyaan "apakah otomasinya benar" hanya dapat dijawab
 * dengan kesan; dengan pembedaan itu, ia dapat dijawab dengan angka.
 *
 * Dicatat SEBELUM Simpan ditekan, dan ditandai belum mendarat. Mencatat
 * sesudahnya berarti pengisian yang gagal di tengah tidak meninggalkan jejak
 * sama sekali - justru yang paling perlu ditelusuri.
 */
export async function catatPengisian(
  db: AletaDatabase,
  {
    actorUserId,
    perkaraId,
    nomorPerkara,
    akunSipp,
    baris,
  }: {
    actorUserId: string;
    perkaraId: string;
    nomorPerkara: string;
    akunSipp: string;
    baris: BarisPengisian[];
  }
) {
  const actor = await requireActorUser(db, actorUserId);
  const sekarang = new Date().toISOString();
  const dicatat: string[] = [];

  await withTransaction(db, async (tx) => {
    for (const item of baris) {
      const id = await nextPrefixedId(tx, "aleta_sipp_penunjukan_log", "isi");
      await tx
        .prepare(
          "INSERT INTO aleta_sipp_penunjukan_log " +
            "(id, perkara_id, nomor_perkara, jenis, medan, nilai, asal, usulan_semula, alasan, " +
            "akun_sipp, aleta_user_id, aleta_peran, created_at, mendarat) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'belum')"
        )
        .run(
          id,
          String(perkaraId),
          String(nomorPerkara),
          String(item.jenis),
          String(item.medan),
          String(item.nilai ?? "").slice(0, 500),
          item.asal === "manual" ? "manual" : "otomatis",
          String(item.usulanSemula ?? "").slice(0, 500),
          String(item.alasan ?? "").slice(0, 500),
          String(akunSipp ?? "").slice(0, 120),
          actor.id,
          String(actor.roleId ?? ""),
          sekarang
        );
      dicatat.push(id);
    }
  });

  return { dicatat, waktu: sekarang };
}

/**
 * Menandai hasil pemeriksaan balik: apakah yang diisikan benar-benar tercatat.
 *
 * Mengisi formulir tidak sama dengan tercatat. Petugas dapat membatalkan, SIPP
 * dapat menolak, dan sambungan dapat putus di tengah. Tanpa pembacaan ulang,
 * catatan ini hanya membuktikan ALETA mengetik - bukan bahwa pengadilan
 * mencatat.
 */
export async function tandaiHasilPengisian(
  db: AletaDatabase,
  {
    idBaris,
    mendarat,
    tercatat,
  }: {
    idBaris: string[];
    mendarat: "ya" | "tidak" | "sebagian";
    tercatat?: string;
  }
) {
  if (idBaris.length === 0) return { ditandai: 0 };

  const sekarang = new Date().toISOString();
  await withTransaction(db, async (tx) => {
    for (const id of idBaris) {
      await tx
        .prepare(
          "UPDATE aleta_sipp_penunjukan_log SET mendarat = ?, diperiksa_at = ?, tercatat = ? WHERE id = ?"
        )
        .run(mendarat, sekarang, String(tercatat ?? "").slice(0, 500), id);
    }
  });

  return { ditandai: idBaris.length };
}

/**
 * Ringkasan: seberapa sering usulannya diubah orang sebelum dikerjakan.
 *
 * Inilah yang menjawab "apakah otomasinya benar" dengan angka. Angka manual
 * yang tinggi bukan kegagalan sistem - ia berarti aturannya belum menangkap
 * cara kerja yang sebenarnya, dan itu petunjuk aturan mana yang perlu
 * disunting.
 */
export async function ringkasanPengisian(db: AletaDatabase) {
  const baris = await db
    .prepare(
      "SELECT jenis, asal, mendarat, COUNT(*) AS jumlah FROM aleta_sipp_penunjukan_log GROUP BY jenis, asal, mendarat"
    )
    .all<{ jenis: string; asal: string; mendarat: string; jumlah: number }>();

  const peta = new Map<string, { otomatis: number; manual: number; mendarat: number; total: number }>();
  for (const item of baris) {
    const kunci = String(item.jenis);
    const isi = peta.get(kunci) ?? { otomatis: 0, manual: 0, mendarat: 0, total: 0 };
    const jumlah = Number(item.jumlah) || 0;
    if (item.asal === "manual") isi.manual += jumlah;
    else isi.otomatis += jumlah;
    if (item.mendarat === "ya") isi.mendarat += jumlah;
    isi.total += jumlah;
    peta.set(kunci, isi);
  }

  return [...peta.entries()].map(([jenis, isi]) => ({
    jenis,
    ...isi,
    persenDiubah: isi.total > 0 ? Math.round((isi.manual / isi.total) * 100) : 0,
  }));
}
