import { roles as defaultRoles } from "@/lib/mock-data";
import { bolehMenjalankanPenetapan, golonganPengguna, type PenggunaGolongan } from "@/lib/matriks-peran";
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
  "blangko-abt",
  "data-umum",
  "kerjakan",
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
      "Melihat usulan PMH, PPP, PJS, dan PHS di halaman SIPP, serta memilih sendiri dari daftarnya. Tidak mengisi blangko tanpa ditekan. Sejak 18 Okt 2026 hanya Ketua, Wakil Ketua, Admin, dan pengguna bersub-peran Operator, Petugas Meja, atau PTSP; pilihan peran lain di tabel tidak berlaku.",
  },
  "penunjukan-otomatis": {
    label: "Tombol otomatis penunjukan",
    penjelasan:
      "Menyalakan penyusunan keempat penetapan sekaligus. Hasilnya tetap tampil untuk diperiksa sebelum tombol Kerjakan ditekan.",
  },
  "blangko-abt": {
    label: "Panel blangko ABT",
    penjelasan:
      "Mengusulkan isian blangko dan menyusun keterangan saksi di halaman APS Badilag. Yang menuliskannya ke ABT tetap sesi petugas itu sendiri.",
  },
  "data-umum": {
    label: "Data Umum dari gugatan",
    penjelasan:
      "Membaca Data Umum perkara dari berkas gugatan e-Court, dan menyalinnya ke blangko Data Umum SIPP setelah diperiksa.",
  },
  kerjakan: {
    label: "Tombol Kerjakan",
    penjelasan:
      "Menuliskan penetapan dan penunjukan ke SIPP langsung dari panel. Inilah satu-satunya kemampuan ekstensi yang MENULIS ke SIPP atas nama petugas.",
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
 * ============================================================================
 * MELIHAT PENGATURAN BOLEH BERDUA, MENGUBAHNYA HANYA SUPER ADMIN
 * ============================================================================
 *
 * Admin tetap dapat membaca seluruh matriks - ia yang ditanya ketika ada
 * pegawai yang menunya tidak muncul, dan jawabannya ada di layar itu.
 *
 * Yang MENGUBAHnya hanya Super Admin. Kewenangan ekstensi menentukan siapa
 * yang dapat menuliskan penetapan ke SIPP; pengalihan satu saklar di sana
 * setara dengan memberi wewenang, dan itu tidak boleh menjadi perbuatan
 * sehari-hari yang dapat dilakukan sambil lalu oleh beberapa orang sekaligus.
 */
export function bolehMenyuntingAkses(user: { roleId?: string | null } | null | undefined) {
  return String(user?.roleId || "") === "super-admin";
}

/**
 * Seluruh kemampuan menyala - disusun dari daftarnya, tidak pernah diketik.
 *
 * Pernah terjadi sekali dan tidak boleh terjadi lagi: rute akses menjawab
 * `{ panel, berkas, permintaan }` sebagai "kemampuan penuh" bagi Super Admin,
 * sementara daftarnya sudah bertambah dua. Akibatnya papan penunjukan mati
 * justru bagi peran yang tidak pernah boleh dibatasi, dan tidak ada galat -
 * hanya menu yang tidak muncul. Fungsi ini menutup jalan itu.
 */
export function kemampuanPenuh(): Record<KapabilitasEkstensi, boolean> {
  const penuh = {} as Record<KapabilitasEkstensi, boolean>;
  for (const kunci of KAPABILITAS_EKSTENSI) penuh[kunci] = true;
  return penuh;
}

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
// Keputusan 111 (18 Okt 2026): hakim dan Panitera tidak lagi menjalankan penetapan di panel; Operator, Petugas Meja, dan
// PTSP memegangnya lewat sub-peran (bolehMenjalankanPenetapan), bukan lewat tabel peran ini.
const PERAN_PENETAP: RoleId[] = ["ketua", "wakil-ketua"];

/**
 * Yang boleh menyalakan tombol otomatisnya lebih sempit lagi.
 *
 * Hakim dan Wakil Ketua tetap dapat memakai papannya dan memilih manual;
 * penyusunan otomatis dibiarkan pada dua jabatan yang memang menetapkan
 * berombongan - Ketua untuk PMH, Panitera untuk PPP dan PJS.
 */
const PERAN_OTOMATIS: RoleId[] = ["ketua"];

/**
 * ============================================================================
 * KERJAKAN - SATU-SATUNYA KEMAMPUAN YANG MENULIS KE SIPP
 * ============================================================================
 *
 * Seluruh kemampuan ekstensi yang lain membaca, menghitung, atau mengusulkan.
 * Kerjakan menuliskan penetapan ke SIPP atas nama petugas yang menekannya,
 * lengkap dengan baris sys_audittrail-nya - tidak dapat dibedakan dari
 * pengisian tangan, dan tidak dapat dibatalkan dari panel.
 *
 * Karena itu bawaannya KOSONG bagi seluruh jabatan. Yang membukanya hanya:
 *
 *   - Super Admin dan Admin, yang kewenangannya ditegakkan di kode, dan
 *   - Operator, peran TAMBAHAN yang memang dibuat untuk itu - dilekatkan pada
 *     orang tertentu, bukan pada satu jabatan utuh.
 *
 * Membuka Kerjakan bagi sebuah jabatan berarti membukanya bagi setiap orang
 * yang kelak menduduki jabatan itu, termasuk yang belum pernah dilatih.
 * Melekatkannya lewat peran tambahan membuat pemberiannya berupa perbuatan
 * yang tercatat terhadap satu nama.
 */
const PERAN_KERJAKAN: RoleId[] = ["operator"];

function kemampuanBawaan(roleId: RoleId): Record<KapabilitasEkstensi, boolean> {
  const pemegangPerkara = PERAN_PEMEGANG_PERKARA.includes(roleId);
  return {
    panel: true,
    berkas: pemegangPerkara,
    permintaan: pemegangPerkara,
    penunjukan: PERAN_PENETAP.includes(roleId),
    "penunjukan-otomatis": PERAN_OTOMATIS.includes(roleId),
    // Blangko dikerjakan panitera pengganti dan diperiksa hakim; pemegang
    // perkara persis daftarnya. Peran yang tidak pernah membuka ABT - umum,
    // keuangan, kepegawaian - tidak diberi, dengan alasan yang sama seperti
    // "berkas": isinya perkara orang.
    "blangko-abt": pemegangPerkara,
    // Data Umum dibaca dari berkas gugatan e-Court lalu disalin ke borang
    // SIPP; ia menyentuh isi perkara, jadi mengikuti pemegang perkara -
    // ditambah Operator, yang justru dibuat untuk mengisi borang itu dari
    // ruang sidang dan tidak punya kewenangan perkara lainnya.
    "data-umum": pemegangPerkara || PERAN_KERJAKAN.includes(roleId),
    kerjakan: PERAN_KERJAKAN.includes(roleId),
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
  if (PERAN_SELALU_PENUH.has(roleId)) return kemampuanPenuh();

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
 * ============================================================================
 * PENGECUALIAN UNTUK SATU ORANG
 * ============================================================================
 *
 * Kewenangan per peran menjawab hampir semua keadaan, dan sengaja dibiarkan
 * menjadi jalan utamanya: kewenangan yang melekat pada jabatan dapat dijelaskan
 * dalam satu kalimat, sedangkan kewenangan yang melekat pada orang harus
 * diingat satu per satu.
 *
 * Yang tidak dapat dijawab per peran: satu orang yang perlu berbeda dari rekan
 * sejabatannya. Selama ini satu-satunya jalan adalah mengubah kewenangan
 * SELURUH peran - yang berarti memberi atau mencabut pada belasan orang untuk
 * keperluan satu orang.
 *
 * Tiga keadaan, bukan dua: tidak ada baris berarti IKUT PERAN. Menyimpan
 * boolean bagi setiap orang akan membekukan kewenangannya pada nilai peran saat
 * barisnya ditulis, dan perubahan peran kelak tidak lagi sampai kepadanya.
 *
 * Pengecualian yang lewat masa berlakunya berhenti berlaku dengan sendirinya,
 * tetapi barisnya tidak dihapus - "siapa yang pernah diberi akses ini" adalah
 * pertanyaan pemeriksaan.
 */
export type PengecualianPengguna = {
  userId: string;
  kapabilitas: KapabilitasEkstensi;
  aktif: boolean;
  alasan: string;
  berlakuSampai: string | null;
  kedaluwarsa: boolean;
  updatedAt: string;
  updatedBy: string | null;
};

type BarisPengecualian = {
  user_id: string;
  capability: string;
  enabled: number;
  alasan: string | null;
  berlaku_sampai: string | null;
  updated_at: string;
  updated_by: string | null;
};

/** Sudah lewat tanggalnya? Tanggal kosong berarti tanpa batas waktu. */
function sudahLewat(berlakuSampai: string | null, sekarang: Date) {
  if (!berlakuSampai) return false;
  const batas = new Date(berlakuSampai);
  if (Number.isNaN(batas.getTime())) return false;
  return batas.getTime() < sekarang.getTime();
}

function petakanPengecualian(baris: BarisPengecualian, sekarang: Date): PengecualianPengguna {
  return {
    userId: baris.user_id,
    kapabilitas: baris.capability as KapabilitasEkstensi,
    aktif: Number(baris.enabled) === 1,
    alasan: String(baris.alasan ?? ""),
    berlakuSampai: baris.berlaku_sampai ?? null,
    kedaluwarsa: sudahLewat(baris.berlaku_sampai ?? null, sekarang),
    updatedAt: baris.updated_at,
    updatedBy: baris.updated_by ?? null,
  };
}

/** Pengecualian satu orang, termasuk yang sudah lewat masa berlakunya. */
export async function bacaPengecualianPengguna(
  db: AletaDatabase,
  userId: string
): Promise<PengecualianPengguna[]> {
  const baris = await db
    .prepare(
      "SELECT user_id, capability, enabled, alasan, berlaku_sampai, updated_at, updated_by " +
        "FROM ecourt_extension_access_user WHERE user_id = ?"
    )
    .all<BarisPengecualian>(userId);

  const sekarang = new Date();
  return baris
    .filter((item) => KAPABILITAS_SAH.has(item.capability))
    .map((item) => petakanPengecualian(item, sekarang));
}

/**
 * Kemampuan seorang pengguna: kewenangan perannya, lalu pengecualiannya.
 *
 * Inilah yang dipakai tiap rute. kapabilitasPeran tetap ada dan tetap dipakai
 * halaman pengaturan - yang menggambar kewenangan JABATAN, bukan orang.
 */
export async function kapabilitasPengguna(
  db: AletaDatabase,
  pengguna: { id: string; roleId: string; additionalRoleIds?: string[] } & Pick<PenggunaGolongan, "positionId" | "actingAssignment">
): Promise<Record<KapabilitasEkstensi, boolean>> {
  const roleId = pengguna.roleId as RoleId;
  if (PERAN_SELALU_PENUH.has(roleId)) return kemampuanPenuh();

  const hasil = await kapabilitasPeran(db, roleId);

  // ==========================================================================
  // PERAN TAMBAHAN HANYA MENAMBAH
  // ==========================================================================
  //
  // Peran tambahan adalah tugas yang dilekatkan di samping jabatan - penjaga
  // sidang, misalnya - bukan pengganti jabatannya. Karena itu kemampuannya
  // DIGABUNG, tidak menimpa: seseorang tidak boleh kehilangan kewenangan
  // jabatannya hanya karena ia juga ditugasi menjaga sidang.
  //
  // Yang ingin mencabut kewenangan satu orang memakai pengecualian di bawah,
  // yang memang dibuat untuk itu dan menuntut alasan tertulis.
  for (const tambahan of pengguna.additionalRoleIds ?? []) {
    if (tambahan === roleId) continue;
    // Peran tambahan TIDAK dapat memberi kewenangan penuh. Menaruh
    // "super-admin" pada daftar peran tambahan seseorang bukan cara yang sah
    // untuk menjadikannya administrator.
    if (PERAN_SELALU_PENUH.has(tambahan as RoleId)) continue;

    const dariTambahan = await kapabilitasPeran(db, tambahan as RoleId);
    for (const kunci of KAPABILITAS_EKSTENSI) {
      if (dariTambahan[kunci]) hasil[kunci] = true;
    }
  }

  // Keputusan pengguna 23 Okt 2026: PTSP (jabatan, peran tambahan keluarga PTSP, Operator, Meja 1) memegang
  // "permintaan" - tarik satu perkara di Kendali Berkas (matriks berkas.tarik) - sebagai BAWAAN, karena PTSP
  // memverifikasi pendaftaran e-Court. Ditaruh SEBELUM pengecualian, sehingga pencabutan per orang tetap berlaku.
  if (golonganPengguna(pengguna).includes("ptsp")) hasil.permintaan = true;

  for (const kecuali of await bacaPengecualianPengguna(db, pengguna.id)) {
    // Yang sudah lewat tanggalnya diabaikan diam-diam - ia memang sudah
    // berhenti berlaku, dan itu bukan keadaan galat.
    if (kecuali.kedaluwarsa) continue;
    hasil[kecuali.kapabilitas] = kecuali.aktif;
  }

  // ==========================================================================
  // KEPUTUSAN 111 (18 Okt 2026): SIAPA MENJALANKAN PENETAPAN
  // ==========================================================================
  //
  // Papan penunjukan hanya untuk Ketua/Wakil dan sub-peran Operator, Petugas Meja, PTSP (Admin dan Super Admin penuh di
  // atas). Hakim dan Panitera tidak lagi memegangnya, dan pengecualian per orang tidak membukanya bagi mereka. Yang
  // memenuhi syarat memegangnya OTOMATIS - Admin tidak perlu menyalakannya per peran. Tombol otomatis tetap ikut
  // pengaturan Admin tetapi hanya untuk yang memenuhi syarat itu.
  const boleh = bolehMenjalankanPenetapan(pengguna);
  hasil.penunjukan = boleh;
  hasil["penunjukan-otomatis"] = hasil["penunjukan-otomatis"] && boleh;

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

  // Kewenangan ORANG ini - perannya, lalu pengecualian yang diberikan
  // kepadanya. Sebelumnya hanya perannya, sehingga pengecualian apa pun
  // tidak akan pernah sampai ke penjagaan yang sesungguhnya.
  const kemampuan = await kapabilitasPengguna(db, {
    id: actor.id,
    roleId: String(actor.roleId),
    additionalRoleIds: actor.additionalRoleIds ?? [],
    positionId: actor.positionId,
    actingAssignment: actor.actingAssignment,
  });
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

  if (!bolehMenyuntingAkses(actor)) {
    throw new ApiError(403, "Hanya Super Admin yang dapat mengubah akses ekstensi.");
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

/**
 * ============================================================================
 * DAFTAR ORANG YANG DIKECUALIKAN - BUKAN DAFTAR SELURUH PEGAWAI
 * ============================================================================
 *
 * Halaman pengaturan menggambar dua hal: siapa saja yang PUNYA pengecualian,
 * dan hasil pencarian ketika administrator mencari orang untuk diberi
 * pengecualian baru. Keduanya sengaja dipisah.
 *
 * Menggambar seluruh pegawai kali enam kemampuan berarti ratusan pengalihan
 * pada satu layar, dan di antaranya - tanpa tanda apa pun - beberapa baris
 * yang benar-benar berbeda dari perannya. Yang perlu dibaca administrator
 * justru beberapa baris itu.
 */
export type PenggunaDikecualikan = {
  userId: string;
  nama: string;
  username: string;
  peran: string;
  labelPeran: string;
  /** Kewenangan perannya - pembanding, supaya selisihnya terbaca. */
  dariPeran: Record<KapabilitasEkstensi, boolean>;
  /** Hasil akhirnya setelah pengecualian yang masih berlaku diterapkan. */
  berlaku: Record<KapabilitasEkstensi, boolean>;
  pengecualian: PengecualianPengguna[];
};

type BarisPengguna = {
  id: string;
  name: string;
  username: string;
  role_id: string;
};

async function susunPengguna(
  db: AletaDatabase,
  baris: BarisPengguna[]
): Promise<PenggunaDikecualikan[]> {
  const namaPeran = new Map<string, string>(defaultRoles.map((peran) => [peran.id, peran.name]));
  const hasil: PenggunaDikecualikan[] = [];

  for (const orang of baris) {
    const roleId = orang.role_id as RoleId;
    const selaluPenuh = PERAN_SELALU_PENUH.has(roleId);
    const dariPeran = selaluPenuh ? kemampuanPenuh() : await kapabilitasPeran(db, roleId);
    const pengecualian = selaluPenuh ? [] : await bacaPengecualianPengguna(db, orang.id);

    const berlaku = { ...dariPeran };
    for (const kecuali of pengecualian) {
      if (kecuali.kedaluwarsa) continue;
      berlaku[kecuali.kapabilitas] = kecuali.aktif;
    }

    hasil.push({
      userId: orang.id,
      nama: orang.name,
      username: orang.username,
      peran: roleId,
      labelPeran: namaPeran.get(roleId) ?? roleId,
      dariPeran,
      berlaku,
      pengecualian,
    });
  }

  return hasil;
}

/** Setiap orang yang punya pengecualian, termasuk yang sudah kedaluwarsa. */
export async function bacaSemuaPengecualian(db: AletaDatabase): Promise<PenggunaDikecualikan[]> {
  const baris = await db
    .prepare(
      // Tanpa alias dan tanpa subkueri berkorelasi - keduanya tidak dapat
      // diurai penyimpanan dalam-memori yang dipakai pengujian, dan kueri yang
      // hanya jalan di satu mesin bukan kueri yang teruji.
      "SELECT id, name, username, role_id FROM users " +
        "WHERE deleted_at IS NULL " +
        "AND id IN (SELECT user_id FROM ecourt_extension_access_user) " +
        "ORDER BY name ASC"
    )
    .all<BarisPengguna>();

  return susunPengguna(db, baris);
}

/**
 * Mencari pegawai menurut nama atau nama penggunanya.
 *
 * Pencarian, bukan daftar penuh: administrator yang hendak memberi
 * pengecualian sudah tahu kepada siapa. Hasilnya dibatasi dua puluh supaya
 * satu huruf tidak menarik seluruh tabel pegawai ke layar.
 */
export async function cariPenggunaUntukPengecualian(
  db: AletaDatabase,
  kata: string
): Promise<PenggunaDikecualikan[]> {
  const bersih = String(kata || "").trim();
  if (bersih.length < 2) return [];

  const pola = "%" + bersih.toLowerCase() + "%";
  const baris = await db
    .prepare(
      "SELECT id, name, username, role_id FROM users " +
        "WHERE deleted_at IS NULL AND is_active = 1 " +
        "AND (LOWER(name) LIKE ? OR LOWER(username) LIKE ?) " +
        "ORDER BY name ASC LIMIT 20"
    )
    .all<BarisPengguna>(pola, pola);

  return susunPengguna(db, baris);
}

/**
 * Menyimpan atau mencabut satu pengecualian.
 *
 * `aktif === null` berarti MENGHAPUS pengecualiannya - orang itu kembali ikut
 * perannya. Itu satu-satunya operasi yang menghapus baris di sini, dan ia
 * memang harus menghapus: baris yang tinggal tetapi tidak berlaku akan
 * membuat layar pengaturan berbohong tentang siapa yang dikecualikan.
 * Penghapusannya tetap tercatat di jejak audit.
 */
export async function simpanPengecualianPengguna(
  db: AletaDatabase,
  {
    actorUserId,
    userId,
    kapabilitas,
    aktif,
    alasan,
    berlakuSampai,
  }: {
    actorUserId: string;
    userId: string;
    kapabilitas: string;
    aktif: boolean | null;
    alasan?: string;
    berlakuSampai?: string | null;
  }
) {
  const actor = await requireActorUser(db, actorUserId);

  if (!bolehMenyuntingAkses(actor)) {
    throw new ApiError(403, "Hanya Super Admin yang dapat mengubah akses ekstensi.");
  }

  if (!KAPABILITAS_SAH.has(kapabilitas)) {
    throw new ApiError(400, "Kemampuan ekstensi tidak dikenali.");
  }

  const sasaran = await db
    .prepare("SELECT id, role_id FROM users WHERE id = ? AND deleted_at IS NULL")
    .all<{ id: string; role_id: string }>(userId);

  if (sasaran.length === 0) {
    throw new ApiError(400, "Pengguna tidak dikenali.");
  }

  if (PERAN_SELALU_PENUH.has(sasaran[0].role_id as RoleId)) {
    throw new ApiError(
      400,
      "Super Admin dan Admin selalu berkemampuan penuh dan tidak dapat dikecualikan."
    );
  }

  // Alasan diwajibkan pada pemberian, bukan pada pencabutan. Pengecualian yang
  // tidak dijelaskan akan menjadi permanen tanpa ada yang tahu sebabnya - dan
  // yang memeriksanya setahun kemudian tidak punya cara menilai apakah ia
  // masih perlu.
  const alasanBersih = String(alasan || "").trim().slice(0, 400);
  if (aktif !== null && alasanBersih.length < 4) {
    throw new ApiError(400, "Tulis alasan pengecualian ini - sekurang-kurangnya empat huruf.");
  }

  const batas = String(berlakuSampai || "").trim();
  if (batas && Number.isNaN(new Date(batas).getTime())) {
    throw new ApiError(400, "Tanggal berlaku sampai tidak dapat dibaca.");
  }

  return withTransaction(db, async (tx) => {
    const sekarang = new Date().toISOString();

    if (aktif === null) {
      await tx
        .prepare("DELETE FROM ecourt_extension_access_user WHERE user_id = ? AND capability = ?")
        .run(userId, kapabilitas);
    } else {
      await tx
        .prepare(
          "INSERT INTO ecourt_extension_access_user " +
            "(user_id, capability, enabled, alasan, berlaku_sampai, updated_at, updated_by) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?) " +
            "ON CONFLICT(user_id, capability) DO UPDATE SET " +
            "enabled = excluded.enabled, " +
            "alasan = excluded.alasan, " +
            "berlaku_sampai = excluded.berlaku_sampai, " +
            "updated_at = excluded.updated_at, " +
            "updated_by = excluded.updated_by"
        )
        .run(userId, kapabilitas, aktif ? 1 : 0, alasanBersih, batas || null, sekarang, actor.id);
    }

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: aktif === null ? "DELETE_ECOURT_EXTENSION_USER_ACCESS" : "UPDATE_ECOURT_EXTENSION_USER_ACCESS",
      entityType: "ecourt_extension_access_user",
      entityId: userId + ":" + kapabilitas,
      payload: { userId, kapabilitas, aktif, alasan: alasanBersih, berlakuSampai: batas || null },
    });

    return bacaSemuaPengecualian(tx);
  });
}
