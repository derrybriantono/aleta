import { type UserPersona } from "@/lib/types";
import { type AletaDatabase } from "@/server/db/client";
import {
  type AkunSiapPakai,
  type JenisJabatan,
  bacaPemetaanJabatan,
  pilihAkunPejabat,
} from "@/server/modules/aleta-ecourt/pemetaan-jabatan";
import { pejabatBertugas, yangSedangCuti } from "@/server/modules/aleta-ecourt/pejabat-bertugas";
import {
  type UsulanPenetapan,
  JABATAN_KETUA,
  JABATAN_PANITERA,
  akunPanitera,
  akunPimpinan,
} from "@/server/modules/aleta-ecourt/rencana-penetapan";
import { bolehMenetapkan, sebutanJabatan } from "@/server/modules/aleta-ecourt/kewenangan-penetapan";
import { bacaAturanPenunjukan } from "@/server/modules/aleta-ecourt/penunjukan-pengaturan";
import { buildExternalAppLaunchHtml } from "@/server/modules/external-apps/service";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * Masuk SIPP atas nama pejabat lain.
 *
 * ============================================================================
 * MENGAPA INI PINTU YANG BERBEDA
 * ============================================================================
 *
 * "Buka SIPP sebagai diri sendiri" boleh dipakai siapa pun yang punya akun -
 * ia hanya memakai kredensialnya sendiri, dan tidak ada yang bisa disalahkan
 * kepada orang lain.
 *
 * Yang ini lain. Ia memakai kredensial ORANG LAIN, dan segala yang dikerjakan
 * sesudahnya tercatat di SIPP atas nama orang itu. Karena itu ia tidak boleh
 * menumpang pintu yang sudah ada: ia punya gerbang izin sendiri, pemeriksaan
 * kesiapan sendiri, dan jejaknya sendiri.
 *
 * ============================================================================
 * TIGA PENGAMAN YANG TIDAK BOLEH DILEPAS
 * ============================================================================
 *
 *   1. Sesi lama ditutup lebih dulu. Halaman masuk SIPP tidak menampilkan
 *      formulir bila sesi masih hidup - ia mengalihkan ke dashboard. Tanpa ini
 *      "berganti akun" menghasilkan sesi LAMA yang bertahan, dan penetapan
 *      tercatat atas akun yang kebetulan sedang terbuka.
 *
 *   2. Pendaratannya dibuktikan. Nama yang muncul di halaman SIPP harus nama
 *      pejabat yang dimaksud. Bila tidak, perjalanan dihentikan - tidak
 *      diteruskan lalu baru ketahuan setelah penetapan tercatat keliru.
 *
 *   3. Akun yang belum teruji sandinya DITOLAK di sini, bukan dibiarkan gagal
 *      di tengah jalan. Kegagalan di tengah meninggalkan perkara setengah
 *      jadi, dan itu jauh lebih sulit dibereskan.
 */

export const JENIS_PENETAPAN = ["data-umum", "pmh", "ppp", "pjs", "phs"] as const;
export type JenisPenetapan = (typeof JENIS_PENETAPAN)[number];

/** Jabatan mana yang mengerjakan penetapan apa, di sisi SIPP. */
const JABATAN_UNTUK: Record<JenisPenetapan, JenisJabatan> = {
  "data-umum": "panitera",
  pmh: "hakim",
  ppp: "panitera",
  pjs: "panitera",
  phs: "hakim",
};

export type PermintaanMasukPejabat = {
  actor: Pick<UserPersona, "id" | "name" | "isActive" | "roleId">;
  jenis: string;
  /** hakim_id atau panitera_id di SIPP - ANGKA, bukan nama. */
  pejabatId: string;
  /**
   * Tabel SIPP tempat pejabatId itu dicari. Kosong berarti tabel yang lazim
   * bagi jenis penetapannya.
   *
   * Diperlukan karena PLH tidak selalu sejabatan dengan yang digantikan: PLH
   * Ketua biasanya seorang Hakim, dan bila hakim pun tidak ada bisa jatuh ke
   * Panitera - yang id-nya ada di user_panitera, bukan user_hakim. Mencarinya
   * di tabel yang lazim saja membuat pergantian akun GAGAL justru pada keadaan
   * yang paling memerlukannya.
   */
  jabatan?: JenisJabatan;
  /** Perkara yang sedang dikerjakan, untuk jejaknya. Boleh kosong. */
  perkaraId?: string;
  nomorPerkara?: string;
};

function jenisSah(nilai: string): nilai is JenisPenetapan {
  return (JENIS_PENETAPAN as readonly string[]).includes(nilai);
}

/**
 * Memutuskan boleh atau tidak, lalu menyiapkan halaman jembatannya.
 *
 * Mengembalikan HTML supaya seragam dengan jalur yang sudah ada - halaman
 * jembatan itulah yang mengerjakan penutupan sesi, pengiriman, dan
 * pembuktian pendaratan di sisi peramban petugas.
 */
export async function masukSebagaiPejabat(db: AletaDatabase, permintaan: PermintaanMasukPejabat) {
  const { actor, pejabatId } = permintaan;
  const jenis = String(permintaan.jenis || "").trim();

  if (!actor.isActive) {
    throw new ApiError(403, "Akun ALETA tidak aktif.");
  }
  if (!jenisSah(jenis)) {
    throw new ApiError(400, `Jenis penetapan "${jenis}" tidak dikenali.`);
  }
  if (!String(pejabatId || "").trim()) {
    throw new ApiError(400, "Pejabat yang dituju tidak disebutkan.");
  }

  // Gerbang izin memakai aturan DAN MODE yang sama dengan menutup antrean
  // penetapan.
  //
  // Modenya wajib dibaca dari pengaturan, bukan dibiarkan memakai bawaan.
  // Sebelumnya tidak - akibatnya pengadilan yang memilih mode ketat tetap
  // dijaga saat menutup antrean, tetapi TIDAK dijaga di sini, pada jalur yang
  // justru memakai kredensial orang lain. Penjagaan yang bocor di tempat yang
  // paling menentukan sama saja dengan tidak ada.
  const aturan = await bacaAturanPenunjukan(db);
  if (jenis !== "data-umum" && !bolehMenetapkan(String(actor.roleId ?? ""), jenis, aturan.penetapanBerjabatan)) {
    throw new ApiError(
      403,
      `Penetapan ini dikerjakan ${sebutanJabatan(jenis)}, bukan peran Anda.`
    );
  }

  const jabatan = permintaan.jabatan ?? JABATAN_UNTUK[jenis];
  const pemetaan = await bacaPemetaanJabatan(db);
  if (!pemetaan.ok) {
    throw new ApiError(503, `Pemetaan jabatan tidak terbaca: ${pemetaan.galat}`);
  }

  const akun = pilihAkunPejabat(pemetaan.akun, jabatan, pejabatId);
  if (!akun) {
    throw new ApiError(
      404,
      `Tidak ada akun SIPP aktif untuk ${jabatan} dengan id ${pejabatId}. ` +
        "Akun lamanya mungkin sudah diblokir karena mutasi."
    );
  }

  // Ditolak DI SINI, bukan dibiarkan gagal di tengah rangkaian.
  if (!akun.siap) {
    throw new ApiError(409, `Akun SIPP "${akun.username}" belum siap. ${akun.sebabBelumSiap}`);
  }

  const pemilik = await db
    .prepare(
      `SELECT user_id FROM external_app_credentials
       WHERE app_id = 'sipp' AND lower(external_username) = lower(?) LIMIT 1`
    )
    .get<{ user_id: string }>(akun.username);

  if (!pemilik?.user_id) {
    throw new ApiError(409, `Kredensial SIPP "${akun.username}" tidak ditemukan di Manajemen Akun.`);
  }

  await catatJejak(db, permintaan, jenis, akun);

  return buildExternalAppLaunchHtml(db, {
    actor,
    appId: "sipp",
    bertanggungJawab: {
      userIdKredensial: pemilik.user_id,
      alamatKeluar: alamatSipp("logout"),
      // Nama apa adanya dari sys_users.fullname - itulah yang ditampilkan SIPP
      // pada kepala halaman sesudah masuk.
      namaDiharap: akun.namaLengkap,
      tujuanAkhir: alamatSipp("main"),
    },
  });
}

/**
 * Menentukan pejabat pelaksana satu langkah dari perkaranya, lalu masuk.
 *
 * ============================================================================
 * MENGAPA RESOLUSINYA DI SINI, BUKAN DI EKSTENSI
 * ============================================================================
 *
 * Pelaksana tiap langkah bukan sekadar "hakim dengan id sekian". PMH dikerjakan
 * PIMPINAN pengadilan - yang tidak muncul di usulan per-perkara. PPP/PJS oleh
 * Panitera, atau Plh-nya bila Panitera sedang berhalangan. PHS oleh ketua
 * majelis perkara itu, yang baru pasti setelah PMH.
 *
 * Ekstensi tidak tahu siapa pimpinan atau panitera pengadilan; ia hanya tahu
 * perkara yang sedang dibuka. Karena itu pemetaan pelaksana diselesaikan di
 * sini - memakai aturan yang sama dengan perakit rencana - lalu diteruskan ke
 * masukSebagaiPejabat yang sudah teruji, lengkap dengan seluruh penjagaannya.
 */
export async function masukLangkahPerkara(
  db: AletaDatabase,
  args: {
    actor: Pick<UserPersona, "id" | "name" | "isActive" | "roleId">;
    jenis: string;
    nomorPerkara: string;
    perkaraId?: string;
    usulan: UsulanPenetapan;
  }
) {
  const jenis = String(args.jenis || "").trim();
  if (!jenisSah(jenis) || jenis === "data-umum") {
    throw new ApiError(400, `Langkah "${jenis}" tidak dikerjakan dengan akun pejabat lain.`);
  }

  const pemetaan = await bacaPemetaanJabatan(db);
  if (!pemetaan.ok) {
    throw new ApiError(503, `Pemetaan jabatan tidak terbaca: ${pemetaan.galat}`);
  }

  // Penugasan dibaca DI SINI juga, bukan hanya saat merakit rencana. Kalau
  // tidak, papan menyebut Plh sementara tombolnya memasukkan petugas sebagai
  // pejabat definitif - dan penetapan tercatat atas nama orang yang sedang
  // berhalangan, tepat pada jalur yang paling sulit dibetulkan.
  const tanggal = args.usulan.tanggalPenetapan || new Date().toISOString().slice(0, 10);

  let pelaksana: AkunSiapPakai | null = null;
  if (jenis === "pmh") {
    const [penunjukan, sedangCuti] = await Promise.all([
      pejabatBertugas(db, JABATAN_KETUA, tanggal),
      yangSedangCuti(db, tanggal),
    ]);
    pelaksana = akunPimpinan(pemetaan.akun, { penunjukan, sedangCuti }).akun;
  } else if (jenis === "ppp" || jenis === "pjs") {
    // SK-nya SK yang lain: PLH Ketua tidak menjadikan siapa pun PLH Panitera,
    // dan Panitera tidak punya wakil sejajar yang otomatis menggantikannya.
    const [penunjukan, sedangCuti] = await Promise.all([
      pejabatBertugas(db, JABATAN_PANITERA, tanggal),
      yangSedangCuti(db, tanggal),
    ]);
    pelaksana = akunPanitera(pemetaan.akun, { penunjukan, sedangCuti }).akun;
  } else if (jenis === "phs") {
    // Ketua majelis perkara ITU. Yang TERCATAT di perkara_hakim_pn mengalahkan
    // yang diusulkan - dan bila belum ada yang tercatat, jalur ini DITOLAK
    // sama sekali.
    //
    // Menolak lebih baik daripada memakai usulan: yang dibuka di sini adalah
    // sesi SIPP atas nama orang lain, dan usulan boleh berubah sampai PMH
    // benar-benar tersimpan. Masuk sebagai hakim yang ternyata bukan ketua
    // majelisnya berarti PHS tercatat atas nama yang keliru - persis kesalahan
    // yang paling sulit dibetulkan.
    const idKetua = args.usulan.tercatat.ada ? args.usulan.tercatat.ketuaHakimId : "";
    if (!idKetua) {
      throw new ApiError(
        409,
        "Majelis perkara ini belum tercatat di SIPP. Kerjakan PMH lebih dulu - ketua majelis yang mengerjakan PHS baru pasti sesudah PMH tersimpan."
      );
    }
    pelaksana = pilihAkunPejabat(pemetaan.akun, "hakim", idKetua);
  }

  if (!pelaksana) {
    throw new ApiError(404, `Tidak ada akun SIPP aktif untuk pelaksana ${sebutanJabatan(jenis)}.`);
  }

  // Diteruskan ke jalur yang sudah teruji: gerbang izin, penolakan yang belum
  // siap, penutupan sesi lama, dan pembuktian pendaratan semuanya di sana.
  //
  // Jabatannya ikut disebutkan, bukan disimpulkan lagi dari jenis penetapannya.
  // Pelaksana yang sudah dipilih di atas boleh saja berasal dari tabel yang
  // lain - seorang Panitera yang ditunjuk Plh Ketua, misalnya - dan menyuruh
  // jalur di bawah mencarinya sekali lagi di tabel yang lazim akan
  // menghasilkan 404 pada keadaan yang justru paling memerlukan pergantian akun.
  return masukSebagaiPejabat(db, {
    actor: args.actor,
    jenis,
    pejabatId: pelaksana.pejabatId,
    jabatan: pelaksana.jabatan,
    perkaraId: args.perkaraId,
    nomorPerkara: args.nomorPerkara,
  });
}

/** Alamat halaman SIPP, disusun dari pengaturan panel yang sama dengan jalur biasa. */
function alamatSipp(jalur: string) {
  const dasar = String(process.env.ALETA_SIPP_BASE_URL || "http://192.168.10.10/SIPP").replace(/\/+$/, "");
  return `${dasar}/${jalur.replace(/^\/+/, "")}`;
}

/**
 * Jejaknya dicatat SEBELUM jembatan dibuka, bukan sesudah.
 *
 * Yang dicatat adalah NIAT, dan niat itu sudah cukup untuk dipertanggung-
 * jawabkan. Mencatat sesudahnya berarti percobaan yang gagal di tengah -
 * peramban ditutup, listrik mati - tidak meninggalkan jejak sama sekali,
 * padahal justru percobaan semacam itulah yang paling perlu terbaca.
 */
async function catatJejak(
  db: AletaDatabase,
  permintaan: PermintaanMasukPejabat,
  jenis: JenisPenetapan,
  akun: AkunSiapPakai
) {
  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId: permintaan.actor.id,
    action: "SIPP_MASUK_SEBAGAI_PEJABAT",
    entityType: "external_app_credentials",
    entityId: akun.username,
    payload: {
      jenis,
      jabatan: akun.jabatan,
      pejabatId: akun.pejabatId,
      akunSipp: akun.username,
      namaPejabat: akun.namaLengkap,
      grupSipp: akun.grup,
      kodeMajelis: akun.kode,
      perkaraId: permintaan.perkaraId ?? "",
      nomorPerkara: permintaan.nomorPerkara ?? "",
      dikerjakanOleh: permintaan.actor.name,
    },
  });
}
