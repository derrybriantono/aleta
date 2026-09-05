import { roles as defaultRoles } from "@/lib/mock-data";
import { isPrivilegedAdmin } from "@/lib/permissions";
import { type RoleId } from "@/lib/types";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * Kemampuan ekstensi ALETA E-Court, dan siapa yang boleh memakainya.
 *
 * ============================================================================
 * KENAPA INI ADA
 * ============================================================================
 *
 * Sebelumnya, satu sesi portal berarti kemampuan penuh: siapa pun yang dapat
 * masuk ALETA dapat membuka konteks perkara mana pun di SIPP, mengunduh berkas
 * e-Courtnya, dan menitip permintaan penarikan. Untuk pengadilan yang seluruh
 * pegawainya punya akun, itu berarti berkas perkara terbuka bagi semua orang -
 * termasuk yang pekerjaannya tidak bersinggungan dengan perkara sama sekali.
 *
 * ============================================================================
 * SUPER ADMIN DAN ADMIN TIDAK DISIMPAN DI DATABASE
 * ============================================================================
 *
 * Keduanya selalu berkemampuan penuh, dan itu ditegakkan di dalam kode. Bila
 * kewenangan mereka ikut bergantung pada baris tabel, satu pengalihan yang
 * keliru - atau satu baris yang terhapus - dapat mengunci seluruh administrasi
 * keluar dari halaman pengaturannya sendiri, tanpa jalan kembali lewat
 * antarmuka. Pengaturannya pun tidak menampilkan pengalihan bagi keduanya,
 * sehingga tidak ada tombol yang tampak berpengaruh padahal tidak.
 *
 * ============================================================================
 * PENJAGAAN DI SERVER, BUKAN DI EKSTENSI
 * ============================================================================
 *
 * Ekstensi memakai jawaban di sini untuk memutuskan apa yang digambar. Itu
 * kenyamanan, bukan penjagaan: ekstensi berjalan di peramban pengguna dan dapat
 * diubah siapa saja yang memasangnya. Karena itu tiap rute memeriksa ulang
 * kemampuannya sendiri sebelum menjawab - persis seperti pemeriksaan keanggotaan
 * majelis pada verifikasi hakim.
 */

/**
 * ============================================================================
 * PENUNJUKAN DIPISAH JADI DUA KEMAMPUAN, BUKAN SATU
 * ============================================================================
 *
 * "penunjukan" hanya membuka papan usulan dan pilihan manualnya; ia tidak
 * mengisi apa pun sendiri. "penunjukan-otomatis" yang menyalakan tombol
 * otomatis, dan hanya itu yang membuat ALETA menyusun keempat penetapan tanpa
 * diminta satu per satu.
 *
 * Dipisah karena keduanya menuntut kepercayaan yang berbeda. Membaca usulan
 * lalu mengetik sendiri tetap perbuatan orang yang mengetiknya. Menerima
 * usulan yang tersusun lengkap lalu menekan Kerjakan mudah berubah jadi
 * kebiasaan menekan tanpa membaca - dan itu perlu dapat dicabut dari sebagian
 * peran tanpa ikut mencabut papannya.
 */
export const KAPABILITAS_EKSTENSI = [
  "panel",
  "berkas",
  "permintaan",
  "penunjukan",
  "penunjukan-otomatis",
] as const;

export type KapabilitasEkstensi = (typeof KAPABILITAS_EKSTENSI)[number];

const KAPABILITAS_SAH = new Set<string>(KAPABILITAS_EKSTENSI);

/** Keterangan yang dipakai halaman pengaturan - satu sumber, bukan disalin di UI. */
export const KETERANGAN_KAPABILITAS: Record<
  KapabilitasEkstensi,
  { label: string; penjelasan: string }
> = {
  panel: {
    label: "Panel di halaman SIPP",
    penjelasan:
      "Melihat panel ALETA saat membuka perkara di SIPP: dokumen e-Court, tenggat, selisih, dan nomor register.",
  },
  berkas: {
    label: "Unduh berkas e-Court",
    penjelasan:
      "Mengunduh berkas PDF dan Word dari arsip e-Court, baik lewat ekstensi maupun lewat halaman Kendali Berkas.",
  },
  permintaan: {
    label: "Titip permintaan penarikan",
    penjelasan:
      "Menitip permintaan agar ALETA menarik berkas satu perkara dari e-Court pada putaran berikutnya.",
  },
  penunjukan: {
    label: "Papan penunjukan",
    penjelasan:
      "Melihat usulan PMH, PPP, PJS, dan PHS di halaman SIPP, serta memilih sendiri dari daftarnya. Tidak mengisi borang tanpa ditekan.",
  },
  "penunjukan-otomatis": {
    label: "Tombol otomatis penunjukan",
    penjelasan:
      "Menyalakan penyusunan keempat penetapan sekaligus. Hasilnya tetap tampil untuk diperiksa sebelum tombol Kerjakan ditekan.",
  },
};

/**
 * Peran yang kemampuannya tidak pernah dibaca dari database.
 *
 * Memakai daftar tersendiri, bukan memanggil isPrivilegedAdmin, karena daftar
 * ini juga dipakai saat menyusun tampilan pengaturan - yang butuh tahu peran
 * mana yang tidak perlu digambar pengalihannya, tanpa punya obyek pengguna di
 * tangan.
 */
export const PERAN_SELALU_PENUH = new Set<RoleId>(["super-admin", "admin"]);

/**
 * Kemampuan bawaan tiap peran saat tabelnya masih kosong.
 *
 * Panel dinyalakan untuk semua peran: sebelum pembaruan ini setiap pegawai
 * memang sudah dapat melihatnya, dan mencabutnya diam-diam pada saat pembaruan
 * akan terasa seperti aplikasi yang rusak, bukan seperti pengetatan yang
 * disengaja. Yang dipersempit adalah mengunduh berkas dan menitip permintaan -
 * dua hal yang benar-benar menyentuh isi perkara.
 *
 * Administrator dapat mengubah seluruhnya dari halaman Integrasi e-Court.
 */
const PERAN_PEMEGANG_PERKARA: RoleId[] = [
  "ketua",
  "wakil-ketua",
  "hakim",
  "panitera",
  "panitera-muda",
  "panitera-pengganti",
  "jurusita",
  "analis-perkara",
];

/**
 * Siapa yang menetapkan apa - dan karenanya siapa yang perlu papan itu.
 *
 * PMH ditetapkan Ketua Pengadilan, PPP dan PJS oleh Panitera, PHS oleh ketua
 * majelisnya sendiri. Wakil Ketua ikut karena Ketua bisa berhalangan, dan
 * hakim ikut karena tiap hakim dapat menjadi ketua majelis pada perkaranya.
 *
 * Panitera Muda, Panitera Pengganti, dan Juru Sita tidak menetapkan apa pun,
 * jadi papannya mati bagi mereka - bukan karena tidak dipercaya, melainkan
 * karena tidak ada borang yang menjadi urusannya.
 */
const PERAN_PENETAP: RoleId[] = ["ketua", "wakil-ketua", "hakim", "panitera"];

/**
 * Yang boleh menyalakan tombol otomatisnya lebih sempit lagi.
 *
 * Hakim dan Wakil Ketua tetap dapat memakai papannya dan memilih manual;
 * penyusunan otomatis dibiarkan pada dua jabatan yang memang menetapkan
 * berombongan - Ketua untuk PMH, Panitera untuk PPP dan PJS.
 */
const PERAN_OTOMATIS: RoleId[] = ["ketua", "panitera"];

function kemampuanBawaan(roleId: RoleId): Record<KapabilitasEkstensi, boolean> {
  const pemegangPerkara = PERAN_PEMEGANG_PERKARA.includes(roleId);
  return {
    panel: true,
    berkas: pemegangPerkara,
    permintaan: pemegangPerkara,
    penunjukan: PERAN_PENETAP.includes(roleId),
    "penunjukan-otomatis": PERAN_OTOMATIS.includes(roleId),
  };
}

export type AksesEkstensiPeran = {
  roleId: RoleId;
  label: string;
  selaluPenuh: boolean;
  kapabilitas: Record<KapabilitasEkstensi, boolean>;
};

type BarisAkses = { role_id: string; capability: string; enabled: number };

/**
 * Mengisi baris bawaan untuk peran yang belum punya catatan.
 *
 * ON CONFLICT DO NOTHING, sehingga pengaturan yang sudah disunting administrator
 * tidak pernah dikembalikan ke bawaan - termasuk pengalihan yang sengaja
 * dimatikan, yang kalau terisi ulang akan menyala kembali tanpa ada yang
 * menyalakannya.
 */
async function pastikanTersemai(db: AletaDatabase) {
  const barisPeran = await db.prepare("SELECT id FROM roles").all<{ id: string }>();
  const sekarang = new Date().toISOString();

  for (const baris of barisPeran) {
    const roleId = baris.id as RoleId;
    if (PERAN_SELALU_PENUH.has(roleId)) continue;

    const bawaan = kemampuanBawaan(roleId);
    for (const kapabilitas of KAPABILITAS_EKSTENSI) {
      await db
        .prepare(
          "INSERT INTO ecourt_extension_access (role_id, capability, enabled, updated_at) " +
            "VALUES (?, ?, ?, ?) " +
            "ON CONFLICT(role_id, capability) DO NOTHING"
        )
        .run(roleId, kapabilitas, bawaan[kapabilitas] ? 1 : 0, sekarang);
    }
  }
}

/** Seluruh matriks peran kali kemampuan, untuk halaman pengaturan. */
export async function bacaAksesEkstensi(db: AletaDatabase): Promise<AksesEkstensiPeran[]> {
  await pastikanTersemai(db);

  const baris = await db
    .prepare("SELECT role_id, capability, enabled FROM ecourt_extension_access")
    .all<BarisAkses>();

  const tersimpan = new Map<string, boolean>();
  for (const item of baris) {
    tersimpan.set(item.role_id + ":" + item.capability, Number(item.enabled) === 1);
  }

  const namaPeran = new Map<string, string>(defaultRoles.map((peran) => [peran.id, peran.name]));

  const barisPeran = await db.prepare("SELECT id FROM roles ORDER BY id ASC").all<{ id: string }>();

  return barisPeran.map((item) => {
    const roleId = item.id as RoleId;
    const selaluPenuh = PERAN_SELALU_PENUH.has(roleId);
    const bawaan = kemampuanBawaan(roleId);

    const kapabilitas = {} as Record<KapabilitasEkstensi, boolean>;
    for (const kunci of KAPABILITAS_EKSTENSI) {
      kapabilitas[kunci] = selaluPenuh
        ? true
        : tersimpan.get(roleId + ":" + kunci) ?? bawaan[kunci];
    }

    return { roleId, label: namaPeran.get(roleId) ?? roleId, selaluPenuh, kapabilitas };
  });
}

/** Kemampuan satu peran saja - dipakai tiap rute sebelum menjawab. */
export async function kapabilitasPeran(
  db: AletaDatabase,
  roleId: RoleId
): Promise<Record<KapabilitasEkstensi, boolean>> {
  if (PERAN_SELALU_PENUH.has(roleId)) {
    // Disusun dari daftar kemampuan, bukan diketik satu per satu: kemampuan
    // baru yang lupa diketik di sini akan terbaca undefined - yaitu tidak
    // boleh - justru bagi peran yang seharusnya tidak pernah dibatasi.
    const penuh = {} as Record<KapabilitasEkstensi, boolean>;
    for (const kunci of KAPABILITAS_EKSTENSI) penuh[kunci] = true;
    return penuh;
  }

  const baris = await db
    .prepare("SELECT role_id, capability, enabled FROM ecourt_extension_access WHERE role_id = ?")
    .all<BarisAkses>(roleId);

  const bawaan = kemampuanBawaan(roleId);
  const hasil = {} as Record<KapabilitasEkstensi, boolean>;

  for (const kunci of KAPABILITAS_EKSTENSI) {
    const tercatat = baris.find((item) => item.capability === kunci);
    // Belum tercatat berarti tabelnya belum tersemai untuk peran ini - jawabnya
    // bawaan, bukan ditolak. Menolak akan membuat ekstensi mati total pada
    // pemasangan baru sampai ada yang membuka halaman pengaturan.
    hasil[kunci] = tercatat ? Number(tercatat.enabled) === 1 : bawaan[kunci];
  }

  return hasil;
}

/**
 * Menuntut satu kemampuan, atau melempar 403.
 *
 * Mengembalikan pengguna yang sudah diperiksa, sehingga pemanggil tidak perlu
 * memanggil requireActorUser dua kali.
 */
/**
 * Menuntut kewenangan Super Admin atau Admin.
 *
 * Dipakai untuk yang MENGUBAH keterangan hukum bersama - pustaka peraturan,
 * butir pertimbangan - bukan untuk yang membacanya. Satu pasal yang keliru
 * masuk pustaka tidak salah sekali, melainkan salah di setiap putusan yang
 * merujuknya, dengan rapi dan tanpa ada yang memeriksanya lagi.
 */
export async function pastikanAdminIstimewa(db: AletaDatabase, actorUserId: string | null | undefined, pekerjaan: string) {
  const actor = await requireActorUser(db, actorUserId);
  if (!isPrivilegedAdmin(actor)) {
    throw new ApiError(403, `Hanya Super Admin dan Admin yang dapat ${pekerjaan}.`);
  }
  return actor;
}

export async function pastikanKapabilitas(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  kapabilitas: KapabilitasEkstensi
) {
  const actor = await requireActorUser(db, actorUserId);

  // Peran berlaku - bukan peran tertulis. Pegawai yang sedang menjalankan tugas
  // jabatan lain memakai kewenangan jabatan yang dijalankannya.
  if (isPrivilegedAdmin(actor)) return actor;

  const kemampuan = await kapabilitasPeran(db, actor.roleId as RoleId);
  if (!kemampuan[kapabilitas]) {
    throw new ApiError(
      403,
      "Peran Anda tidak diberi akses " +
        KETERANGAN_KAPABILITAS[kapabilitas].label.toLowerCase() +
        ". Hubungi administrator ALETA."
    );
  }

  return actor;
}

/** Menyalakan atau mematikan satu kemampuan bagi satu peran. */
export async function simpanAksesEkstensi(
  db: AletaDatabase,
  {
    actorUserId,
    roleId,
    kapabilitas,
    aktif,
  }: {
    actorUserId: string;
    roleId: RoleId;
    kapabilitas: string;
    aktif: boolean;
  }
) {
  const actor = await requireActorUser(db, actorUserId);

  if (!isPrivilegedAdmin(actor)) {
    throw new ApiError(403, "Hanya Super Admin dan Admin yang dapat mengubah akses ekstensi.");
  }

  if (!KAPABILITAS_SAH.has(kapabilitas)) {
    throw new ApiError(400, "Kemampuan ekstensi tidak dikenali.");
  }

  if (PERAN_SELALU_PENUH.has(roleId)) {
    throw new ApiError(
      400,
      "Super Admin dan Admin selalu berkemampuan penuh dan tidak dapat dibatasi."
    );
  }

  const peranAda = await db.prepare("SELECT id FROM roles WHERE id = ?").all<{ id: string }>(roleId);

  if (peranAda.length === 0) {
    throw new ApiError(400, "Peran tidak dikenali.");
  }

  return withTransaction(db, async (tx) => {
    await pastikanTersemai(tx);
    const sekarang = new Date().toISOString();

    await tx
      .prepare(
        "INSERT INTO ecourt_extension_access (role_id, capability, enabled, updated_at, updated_by) " +
          "VALUES (?, ?, ?, ?, ?) " +
          "ON CONFLICT(role_id, capability) DO UPDATE SET " +
          "enabled = excluded.enabled, " +
          "updated_at = excluded.updated_at, " +
          "updated_by = excluded.updated_by"
      )
      .run(roleId, kapabilitas, aktif ? 1 : 0, sekarang, actor.id);

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "UPDATE_ECOURT_EXTENSION_ACCESS",
      entityType: "ecourt_extension_access",
      entityId: roleId + ":" + kapabilitas,
      payload: { roleId, kapabilitas, aktif },
    });

    return bacaAksesEkstensi(tx);
  });
}
