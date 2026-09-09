import { type RoleId } from "@/lib/types";
import { type AletaDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * ACC HAKIM ATAS BERITA ACARA SIDANG
 * ============================================================================
 *
 * Di kenyataan, berita acara yang disusun panitera sidang di-acc hakim sebelum
 * dipakai. Langkah itu tidak pernah ada di ALETA - sehingga BAS yang sudah
 * di-acc tidak dapat dibedakan dari yang belum, dan penanda "belum ada BAS"
 * pada jadwal sidang menjawab pertanyaan yang berbeda sama sekali.
 *
 * ============================================================================
 * DUA SUMBU, BUKAN SATU DERET KEADAAN
 * ============================================================================
 *
 * Kolom keadaan yang sudah ada berisi "draf" atau "selesai". Menambahkan
 * "diacc" ke deret itu tampak paling ringkas - dan menghapus satu keterangan
 * yang justru paling sering dibutuhkan: "sudah selesai, menunggu acc".
 *
 * Keduanya memang dua sumbu yang berbeda:
 *
 *   keadaan   kemajuan PANITERA SIDANG - masih diisi, atau sudah selesai
 *   acc       perbuatan HAKIM - sudah disetujui, dikembalikan, atau belum
 *
 * Satu lembar dapat selesai tetapi belum di-acc; dapat pula dikembalikan lalu
 * diperbaiki dan menjadi draf lagi. Deret tunggal tidak dapat menyatakan itu
 * tanpa memperbanyak nilainya sampai tidak ada yang hafal artinya.
 *
 * ============================================================================
 * ACC BATAL BEGITU ISINYA BERUBAH - INI YANG PALING MENENTUKAN
 * ============================================================================
 *
 * Tanpa aturan itu, panitera dapat menyunting lembar SESUDAH hakim
 * menyetujuinya, dan persetujuan hakim melekat pada naskah yang tidak pernah
 * dilihatnya. Bukan kelalaian yang mustahil: memperbaiki satu salah ketik
 * sesudah di-acc adalah hal yang paling wajar dilakukan orang.
 *
 * Yang membuatnya berbahaya, acc semacam itu tidak menampakkan dirinya. Di
 * layar ia tetap tertulis "sudah di-acc", lengkap dengan nama hakim dan
 * tanggalnya - dan tidak ada seorang pun yang punya sebab untuk memeriksanya.
 */

/**
 * Siapa yang boleh meng-acc.
 *
 * Panitera TIDAK ikut, dan itu inti langkahnya: acc adalah pemeriksaan oleh
 * orang lain. Panitera yang dapat meng-acc berita acaranya sendiri membuat
 * langkah ini menjadi tombol tambahan, bukan pemeriksaan.
 *
 * Ketua dan Wakil Ketua ikut karena keduanya hakim, dan karena ketua majelis
 * pada perkara tertentu memang salah satu dari mereka.
 */
export const PERAN_PENGACC: RoleId[] = ["ketua", "wakil-ketua", "hakim"];

export type KeadaanAcc = "belum-selesai" | "menunggu-acc" | "dikembalikan" | "diacc";

export type BarisAcc = {
  keadaan?: string | null;
  diacc_at?: string | null;
  acc_dikembalikan_alasan?: string | null;
};

/**
 * Keadaan acc satu lembar - DITURUNKAN, tidak disimpan.
 *
 * Menyimpannya sebagai kolom tersendiri berarti ada dua sumber untuk satu
 * kenyataan, dan pada suatu hari keduanya berselisih: kolom berbunyi "diacc"
 * sementara jejak accnya kosong. Yang diturunkan tidak dapat berselisih dengan
 * yang menurunkannya.
 */
export function keadaanAcc(baris: BarisAcc): KeadaanAcc {
  const dikembalikan = String(baris.acc_dikembalikan_alasan ?? "").trim();
  const diacc = String(baris.diacc_at ?? "").trim();

  // Diperiksa lebih dahulu: lembar yang di-acc lalu dikembalikan harus
  // terbaca dikembalikan, bukan diacc. Pengembalian selalu menghapus jejak
  // accnya, jadi keduanya tidak pernah terisi bersamaan - tetapi urutan ini
  // membuatnya tetap benar seandainya kelak terisi bersamaan.
  if (dikembalikan) return "dikembalikan";
  if (diacc) return "diacc";

  return String(baris.keadaan ?? "").trim() === "selesai" ? "menunggu-acc" : "belum-selesai";
}

/** Sebutan yang dibaca orang. */
export const SEBUTAN_ACC: Record<KeadaanAcc, string> = {
  "belum-selesai": "Masih diisi panitera",
  "menunggu-acc": "Menunggu acc hakim",
  dikembalikan: "Dikembalikan hakim",
  diacc: "Sudah di-acc hakim",
};

async function pastikanPengacc(db: AletaDatabase, actorUserId: string | null | undefined) {
  const aktor = await requireActorUser(db, actorUserId);
  const peran = String(aktor.roleId ?? "") as RoleId;
  if (!PERAN_PENGACC.includes(peran)) {
    throw new ApiError(
      403,
      "Hanya hakim yang dapat meng-acc berita acara sidang. Acc adalah pemeriksaan oleh orang lain; panitera tidak meng-acc berita acaranya sendiri."
    );
  }
  return aktor;
}

async function ambilLembar(db: AletaDatabase, lembarId: string) {
  const baris = await db.queryOne<{
    id: string;
    keadaan: string;
    diacc_at: string;
    acc_dikembalikan_alasan: string;
  }>(
    `SELECT id, keadaan, diacc_at, acc_dikembalikan_alasan FROM aleta_bas_lembar WHERE id = ?`,
    [String(lembarId)]
  );
  if (!baris) throw new ApiError(404, "Lembar berita acara tidak ditemukan.");
  return baris;
}

/**
 * Hakim meng-acc satu lembar.
 *
 * Lembar yang MASIH DIISI tidak dapat di-acc. Bukan kerapian: meng-acc naskah
 * yang belum selesai berarti menyetujui kalimat yang belum ditulis, dan
 * panitera yang menuliskannya sesudah itu menulis di bawah persetujuan yang
 * sudah terlanjur diberikan.
 */
export async function accLembar(
  db: AletaDatabase,
  actorUserId: string,
  lembarId: string,
  catatan = ""
) {
  const aktor = await pastikanPengacc(db, actorUserId);
  const baris = await ambilLembar(db, lembarId);

  if (String(baris.keadaan).trim() !== "selesai") {
    throw new ApiError(
      409,
      "Lembar ini masih diisi panitera sidang. Acc diberikan sesudah panitera menyatakannya selesai."
    );
  }

  const sekarang = new Date().toISOString();
  await db.run(
    `UPDATE aleta_bas_lembar
        SET diacc_oleh = ?, diacc_at = ?, acc_dikembalikan_alasan = '',
            catatan = CASE WHEN ? = '' THEN catatan ELSE ? END
      WHERE id = ?`,
    [String(aktor.id), sekarang, String(catatan ?? ""), String(catatan ?? ""), String(baris.id)]
  );

  return { id: String(baris.id), keadaan: "diacc" as KeadaanAcc, oleh: String(aktor.id), pada: sekarang };
}

/**
 * Hakim mengembalikan satu lembar beserta alasannya.
 *
 * Alasannya WAJIB. Pengembalian tanpa alasan memaksa panitera menebak apa yang
 * harus diperbaiki, dan tebakan yang salah menghasilkan pengembalian kedua
 * atas hal yang sama - dua kali kerja untuk satu keterangan yang tidak pernah
 * disampaikan.
 */
export async function kembalikanLembar(
  db: AletaDatabase,
  actorUserId: string,
  lembarId: string,
  alasan: string
) {
  const aktor = await pastikanPengacc(db, actorUserId);
  const baris = await ambilLembar(db, lembarId);

  const sebab = String(alasan ?? "").trim();
  if (!sebab) {
    throw new ApiError(400, "Sebutkan apa yang harus diperbaiki. Pengembalian tanpa alasan memaksa panitera menebak.");
  }

  const sekarang = new Date().toISOString();
  await db.run(
    `UPDATE aleta_bas_lembar
        SET diacc_oleh = ?, diacc_at = '', acc_dikembalikan_alasan = ?, diubah_at = ?
      WHERE id = ?`,
    [String(aktor.id), sebab.slice(0, 500), sekarang, String(baris.id)]
  );

  return { id: String(baris.id), keadaan: "dikembalikan" as KeadaanAcc, alasan: sebab.slice(0, 500) };
}

/**
 * Membatalkan acc karena isinya berubah.
 *
 * Dipanggil penyimpan lembar, BUKAN oleh layar. Yang membatalkannya bukan
 * keputusan siapa pun - ia akibat langsung dari isinya yang tidak lagi sama
 * dengan yang dahulu dilihat hakim.
 *
 * Alasan pengembalian ikut dihapus: panitera yang sudah memperbaiki tidak
 * boleh terus membawa keterangan bahwa lembarnya dikembalikan, sebab yang
 * membaca berikutnya akan menyangka perbaikannya belum dikerjakan.
 */
export async function batalkanAccKarenaBerubah(db: AletaDatabase, lembarId: string) {
  await db.run(
    `UPDATE aleta_bas_lembar
        SET diacc_oleh = '', diacc_at = '', acc_dikembalikan_alasan = ''
      WHERE id = ? AND (diacc_at <> '' OR acc_dikembalikan_alasan <> '')`,
    [String(lembarId)]
  );
}
