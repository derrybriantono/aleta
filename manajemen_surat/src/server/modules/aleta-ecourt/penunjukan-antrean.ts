import { isPrivilegedAdmin } from "@/lib/permissions";
import { type RoleId } from "@/lib/types";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

import { URUTAN_PENGISIAN } from "./penunjukan-pengisian";
import { bacaAturanPenunjukan } from "./penunjukan-pengaturan";

/**
 * Antrean penetapan: menyerahkan pekerjaan, bukan menyerahkan akun.
 *
 * ============================================================================
 * KENAPA INI ADA
 * ============================================================================
 *
 * Keempat penetapan dikerjakan pejabat yang berbeda, dan selama ini satu
 * operator mengerjakan keempatnya dengan masuk-keluar empat akun SIPP.
 *
 * Jejak SIPP lalu mencatat nama pejabatnya, tetapi yang menekan tombolnya
 * orang lain - dan tidak ada satu pun catatan yang menyebutkan itu. Yang
 * hilang bukan kerapian: penetapan adalah perbuatan pejabat, dan catatan yang
 * menyebut pejabat padahal orang lain yang mengerjakan membuat pertanyaan
 * "siapa yang menetapkan ini" tidak dapat dijawab dengan jujur.
 *
 * ============================================================================
 * YANG DIKERJAKAN, DAN YANG SENGAJA TIDAK
 * ============================================================================
 *
 * TIDAK menyimpan kata sandi siapa pun. TIDAK masuk atas nama siapa pun.
 * TIDAK menekan tombol atas nama siapa pun.
 *
 * Yang dikerjakan: usulan yang sudah disiapkan operator diteruskan, lalu
 * muncul di panel pejabat yang berwenang begitu ia membuka SIPP dengan akunnya
 * sendiri - lengkap, tinggal diperiksa dan ditekan sekali.
 *
 * Empat kali masuk-keluar akun berubah menjadi empat orang menekan sekali.
 */

/**
 * Aturan kewenangan penetapan kini berdiri sendiri di kewenangan-penetapan.ts.
 *
 * Dipindahkan karena jalur masuk-sebagai-pejabat memakai aturan yang sama
 * tetapi TIDAK menyentuh tabel antrean. Selama aturannya menumpang di sini,
 * jalur itu ikut menarik seluruh modul ini - dan pemasangan yang belum
 * memiliki tabel antreannya gagal dibangun.
 *
 * Diteruskan kembali dari sini supaya pemanggil yang sudah ada tidak berubah.
 */
import {
  JABATAN_PENETAP,
  SEBUTAN_PENETAPAN,
  bolehMenetapkan,
  sebutanJabatan,
} from "./kewenangan-penetapan";

export { JABATAN_PENETAP, SEBUTAN_PENETAPAN, bolehMenetapkan, sebutanJabatan };

export type BarisAntrean = {
  id: string;
  perkaraId: string;
  nomorPerkara: string;
  jenis: string;
  sebutan: string;
  usulan: Record<string, unknown>;
  ringkasan: string;
  untukPeran: string;
  keadaan: string;
  disiapkanOleh: string;
  disiapkanAt: string;
  catatan: string;
};

type BarisMentah = {
  id: string;
  perkara_id: string;
  nomor_perkara: string;
  jenis: string;
  usulan: string;
  ringkasan: string;
  untuk_peran: string;
  keadaan: string;
  disiapkan_oleh: string;
  disiapkan_at: string;
  catatan: string;
};

function rapikan(baris: BarisMentah): BarisAntrean {
  let usulan: Record<string, unknown> = {};
  try {
    // Usulan disimpan sebagai teks JSON. Yang rusak diperlakukan sebagai
    // kosong, bukan melempar - satu baris antrean yang isinya cacat tidak
    // boleh menjatuhkan seluruh daftar milik pejabat lain.
    usulan = JSON.parse(baris.usulan || "{}") as Record<string, unknown>;
  } catch {
    usulan = {};
  }

  return {
    id: String(baris.id),
    perkaraId: String(baris.perkara_id),
    nomorPerkara: String(baris.nomor_perkara),
    jenis: String(baris.jenis),
    sebutan: SEBUTAN_PENETAPAN[String(baris.jenis)] ?? String(baris.jenis).toUpperCase(),
    usulan,
    ringkasan: String(baris.ringkasan ?? ""),
    untukPeran: String(baris.untuk_peran ?? ""),
    keadaan: String(baris.keadaan),
    disiapkanOleh: String(baris.disiapkan_oleh ?? ""),
    disiapkanAt: String(baris.disiapkan_at ?? ""),
    catatan: String(baris.catatan ?? ""),
  };
}

const KOLOM =
  "id, perkara_id, nomor_perkara, jenis, usulan, ringkasan, untuk_peran, keadaan, " +
  "disiapkan_oleh, disiapkan_at, catatan";

/**
 * Meneruskan satu penetapan untuk dikerjakan pejabat yang berwenang.
 *
 * Siapa pun yang boleh membuka papan penunjukan boleh meneruskan - meneruskan
 * bukan menetapkan, dan usulannya tetap harus diperiksa lalu ditekan pejabatnya
 * sendiri. Yang dibatasi mengerjakannya, bukan menyiapkannya.
 */
export async function titipkanPenetapan(
  db: AletaDatabase,
  {
    actorUserId,
    perkaraId,
    nomorPerkara,
    jenis,
    usulan,
    ringkasan,
    catatan,
  }: {
    actorUserId: string;
    perkaraId: string;
    nomorPerkara: string;
    jenis: string;
    usulan: Record<string, unknown>;
    ringkasan: string;
    catatan?: string;
  }
) {
  const actor = await requireActorUser(db, actorUserId);

  if (!URUTAN_PENGISIAN.includes(jenis as (typeof URUTAN_PENGISIAN)[number])) {
    throw new ApiError(400, "Jenis penetapan tidak dikenali.");
  }
  if (!String(perkaraId ?? "").trim() || !String(nomorPerkara ?? "").trim()) {
    throw new ApiError(400, "Perkara tidak disebutkan.");
  }

  const sekarang = new Date().toISOString();

  return withTransaction(db, async (tx) => {
    // Penerusan yang sudah ada untuk perkara dan jenis yang sama diganti, bukan
    // ditambah. Operator yang menyiapkan ulang karena usulannya keliru harus
    // menggantikan yang lama - meninggalkan keduanya membuat pejabatnya
    // memilih di antara dua usulan tanpa tahu mana yang terbaru.
    await tx
      .prepare(
        "UPDATE aleta_sipp_penunjukan_antrean SET keadaan = 'dibatalkan', alasan_batal = ? " +
          "WHERE perkara_id = ? AND jenis = ? AND keadaan = 'menunggu'"
      )
      .run("digantikan penerusan yang lebih baru", String(perkaraId), jenis);

    const id = await nextPrefixedId(tx, "aleta_sipp_penunjukan_antrean", "antre");
    await tx
      .prepare(
        "INSERT INTO aleta_sipp_penunjukan_antrean " +
          "(id, perkara_id, nomor_perkara, jenis, usulan, ringkasan, untuk_peran, keadaan, " +
          "disiapkan_oleh, disiapkan_at, catatan) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, 'menunggu', ?, ?, ?)"
      )
      .run(
        id,
        String(perkaraId),
        String(nomorPerkara),
        jenis,
        JSON.stringify(usulan ?? {}).slice(0, 8000),
        String(ringkasan ?? "").slice(0, 300),
        (JABATAN_PENETAP[jenis] ?? []).join(","),
        actor.id,
        sekarang,
        String(catatan ?? "").slice(0, 500)
      );

    return { id, jenis, untuk: sebutanJabatan(jenis), disiapkanAt: sekarang };
  });
}

/**
 * Yang menunggu peran ini - inilah yang membuat pejabatnya tahu ada pekerjaan
 * tanpa ada yang perlu meneleponnya.
 *
 * Perkara yang perannya TIDAK berwenang tidak ikut, kecuali bagi Super Admin
 * dan Admin yang memang melihat seluruhnya untuk keperluan pemeriksaan.
 */
export async function antreanUntukSaya(db: AletaDatabase, actorUserId: string) {
  const actor = await requireActorUser(db, actorUserId);
  const roleId = String(actor.roleId ?? "");

  const baris = await db
    .prepare(
      `SELECT ${KOLOM} FROM aleta_sipp_penunjukan_antrean ` +
        "WHERE keadaan = 'menunggu' ORDER BY disiapkan_at ASC LIMIT 200"
    )
    .all<BarisMentah>();

  const semua = baris.map(rapikan);
  if (isPrivilegedAdmin(actor)) return { untukSaya: semua, seluruhnya: semua.length, roleId };

  // Selalu menurut JABATAN, bukan menurut mode. Daftar ini menjawab
  // "pekerjaan ini urusan siapa", bukan "boleh atau tidak saya kerjakan" -
  // dan pada mode longgar keduanya berbeda: operator boleh mengerjakan
  // keempatnya, tetapi daftar yang menampilkan seluruh penetapan kepada semua
  // orang berhenti menjadi daftar dan menjadi papan pengumuman.
  const untukSaya = semua.filter((x) => bolehMenetapkan(roleId, x.jenis, "ketat"));
  return { untukSaya, seluruhnya: semua.length, roleId };
}

/** Penerusan yang menunggu untuk satu perkara, apa pun jabatan yang dituju. */
export async function antreanPerkara(db: AletaDatabase, perkaraId: string) {
  const baris = await db
    .prepare(
      `SELECT ${KOLOM} FROM aleta_sipp_penunjukan_antrean ` +
        "WHERE perkara_id = ? AND keadaan = 'menunggu' ORDER BY disiapkan_at ASC"
    )
    .all<BarisMentah>(String(perkaraId));

  return baris.map(rapikan);
}

/**
 * Menutup satu penerusan - dikerjakan atau dibatalkan.
 *
 * Yang menutupnya sebagai "dikerjakan" harus benar-benar berwenang atas
 * penetapan itu. Pemeriksaan ini yang membedakan antrean dari sekadar papan
 * pengumuman: tanpa ia, siapa pun yang tahu id-nya dapat menyatakan penetapan
 * sudah dikerjakan padahal belum ada yang menyentuhnya.
 */
export async function tutupTitipan(
  db: AletaDatabase,
  {
    actorUserId,
    id,
    keadaan,
    akunSipp,
    alasan,
  }: {
    actorUserId: string;
    id: string;
    keadaan: "dikerjakan" | "dibatalkan";
    akunSipp?: string;
    alasan?: string;
  }
) {
  const actor = await requireActorUser(db, actorUserId);

  const baris = await db
    .prepare(`SELECT ${KOLOM} FROM aleta_sipp_penunjukan_antrean WHERE id = ? LIMIT 1`)
    .all<BarisMentah>(String(id));

  const penerusan = baris[0];
  if (!penerusan) throw new ApiError(404, "Penerusan penetapan tidak ditemukan.");
  if (penerusan.keadaan !== "menunggu") {
    throw new ApiError(409, `Penerusan ini sudah ${penerusan.keadaan}.`);
  }

  // Modenya dibaca dari pengaturan, sama dengan yang dipakai saat mengisi.
  // Kalau berbeda, operator dapat mengisi formulirnya tetapi tidak dapat
  // menutup penerusannya - dan barisnya menggantung sebagai pekerjaan yang
  // menunggu padahal sudah dikerjakan.
  const aturan = await bacaAturanPenunjukan(db);

  if (
    keadaan === "dikerjakan" &&
    !bolehMenetapkan(String(actor.roleId ?? ""), penerusan.jenis, aturan.penetapanBerjabatan)
  ) {
    throw new ApiError(
      403,
      `${SEBUTAN_PENETAPAN[penerusan.jenis] ?? penerusan.jenis} ditetapkan ${sebutanJabatan(
        penerusan.jenis
      )}, bukan peran Anda.`
    );
  }

  const sekarang = new Date().toISOString();
  await withTransaction(db, async (tx) => {
    await tx
      .prepare(
        "UPDATE aleta_sipp_penunjukan_antrean SET keadaan = ?, dikerjakan_oleh = ?, " +
          "dikerjakan_at = ?, akun_sipp = ?, alasan_batal = ? WHERE id = ?"
      )
      .run(
        keadaan,
        actor.id,
        sekarang,
        String(akunSipp ?? "").slice(0, 120),
        keadaan === "dibatalkan" ? String(alasan ?? "").slice(0, 300) : "",
        String(id)
      );
  });

  return { id: String(id), keadaan, waktu: sekarang };
}
