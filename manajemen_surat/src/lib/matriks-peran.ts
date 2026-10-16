/* === HAK-PERAN 12 Okt === */
/**
 * ============================================================================
 * MATRIKS PERAN - SATU SUMBER "SIAPA MELIHAT APA, SIAPA BOLEH MENGUBAH APA"
 * ============================================================================
 *
 * Permintaan pengguna 11-12 Okt 2026: tentukan apa yang DITAMPILKAN dan apa
 * yang bisa di-CRUD tiap pengguna, tiap peran dan sub-peran, di seluruh portal
 * ALETA, ekstensi, dan ALETA e-Court (Jadwal Sidang, Jadwal Mediasi, Status
 * Perkara). Aplikasi yang BELUM FIX disembunyikan untuk semua kecuali Super
 * Admin. Matriks lengkap beserta alasannya: D:/aleta-dev/kerja/peran-12okt/
 * matriks-peran.md.
 *
 * Berkas ini fungsi murni (tanpa React, tanpa basis data) supaya SATU aturan
 * dipakai di empat tempat:
 *   1. ubin & halaman portal (lib/app-state.tsx -> accessiblePortalApps),
 *   2. tombol/bagian di komponen e-Court (bolehAksi di layar),
 *   3. penjaga rute API sisi server (server/modules/akses/hak-peran.ts ->
 *      pastikanAksi: 403, bukan hanya menyembunyikan tombol),
 *   4. ekstensi (golonganMenu dikirim lewat /ekstensi/siapa, sipp-konteks,
 *      dan sumber "siapa" ABT; panel-alat.js membacanya).
 *
 * Prinsip:
 *   - least privilege menurut kebutuhan kerja jabatan;
 *   - "milik" = perkara yang ditangani (majelis/PP/JS-nya), "semua" = seluruh
 *     perkara satker (pimpinan baca semua, kasir keuangan semua perkara);
 *   - peran tambahan hanya MENAMBAH, tidak pernah mencabut;
 *   - keputusan terdahulu tetap: unggah putusan hanya hakim/ketua/wakil/
 *     admin/super admin (9 Okt), Kasir = menu Kasir+Perkara, PTSP = PTSP+
 *     Berkas+Perkara (11 Okt), arsip e-Court boleh dilihat semua (9 Okt),
 *     Super Admin semuanya.
 *   - Akses Menu admin (visibility-role) tetap dapat MEMBUKA aplikasi per
 *     peran - termasuk aplikasi yang belum fix - dan menutup aplikasi bawaan.
 */

import { resolveEffectivePositionId, resolveEffectiveRoleId } from "@/core/organization/service";
import type { RoleId, UserPersona } from "@/lib/types";

// ─── Golongan (peran + sub-peran) ────────────────────────────────────────────

export const GOLONGAN_PERAN = [
  "super-admin",
  "admin",
  "pimpinan", // Ketua, Wakil Ketua
  "hakim",
  "panitera",
  "panmud", // Panitera Muda (sub: gugatan, permohonan, hukum)
  "pp", // Panitera Pengganti
  "jurusita", // Jurusita & Jurusita Pengganti
  "kasir", // peran tambahan kasir/keuangan perkara/bendahara, Analis Keuangan
  "ptsp", // Petugas PTSP, meja informasi, pendaftaran, operator SIPP/e-Doc, Operator
  "mediator", // mediator non-hakim (peran tambahan "mediator")
  "petugas-sidang", // penjaga sidang, operator antrian/panggilan/video sidang, Operator
  "analis-perkara", // Analis Perkara, pengelola penanganan perkara, dokumentalis hukum
  "sekretariat", // Sekretaris, Kasubag, staf umum/kepegawaian/keuangan APBN
  "ti", // Pranata Komputer, staf PTIP
  "pelaksana", // Pelaksana/PPPK/Staf tanpa tugas khusus (cadangan)
] as const;

export type GolonganPeran = (typeof GOLONGAN_PERAN)[number];

export const LABEL_GOLONGAN: Record<GolonganPeran, string> = {
  "super-admin": "Super Admin",
  admin: "Admin",
  pimpinan: "Ketua / Wakil Ketua",
  hakim: "Hakim",
  panitera: "Panitera",
  panmud: "Panitera Muda",
  pp: "Panitera Pengganti",
  jurusita: "Jurusita / JSP",
  kasir: "Kasir",
  ptsp: "PTSP / Operator",
  mediator: "Mediator non-hakim",
  "petugas-sidang": "Petugas Sidang (penjaga/operator antrian)",
  "analis-perkara": "Analis Perkara",
  sekretariat: "Kesekretariatan",
  ti: "Pranata Komputer / TI",
  pelaksana: "Pelaksana / Staf",
};

/** Sub-peran Panitera Muda dari jabatannya. */
export type SubPanmud = "gugatan" | "permohonan" | "hukum";

export const PERAN_TAMBAHAN_KASIR_HAK: readonly string[] = [
  "kasir",
  "petugas_keuangan_perkara",
  "bendahara_penerimaan",
  "bendahara_pengeluaran",
];

export const PERAN_TAMBAHAN_PTSP_HAK: readonly string[] = [
  "petugas_ptsp",
  "petugas_meja_informasi",
  "petugas_pendaftaran_perkara",
  "resepsionis",
  "operator_sipp",
  "operator_edoc",
  "petugas_ecourt",
  "petugas_validasi_ecourt",
  "petugas_gugatan_mandiri",
];

export const PERAN_TAMBAHAN_MEDIATOR_HAK: readonly string[] = ["mediator", "mediator_non_hakim"];

/* === MEJA-SIPP 14 Okt === */
/**
 * Sub-peran petugas meja dari akun SIPP (lib/tautan-akun-sipp.ts
 * subPeranDariSipp: petugas_meja_<1-3>_<gugatan|permohonan|jinayat|...>).
 * Keputusan pengguna 14 Okt 2026:
 *   - Meja 1 (penerimaan perkara/pendaftaran)          -> golongan PTSP;
 *   - Meja 2 (registrasi) & Meja 3 (penyerahan produk/arsip) -> golongan
 *     kepaniteraan, yaitu golongan STAF kepaniteraan "analis-perkara" -
 *     bukan panitera/panmud/pp/jurusita yang memegang kewenangan pejabat.
 * Seperti peran tambahan lain: hanya MENAMBAH golongan (menu), tidak pernah
 * mengganti golongan utama dan tidak memberi hak di atas golongan itu.
 */
export const POLA_SUB_PERAN_MEJA_PTSP = /^petugas_meja_1_[a-z]+$/;
export const POLA_SUB_PERAN_MEJA_KEPANITERAAN = /^petugas_meja_[23]_[a-z]+$/;
/* === AKHIR MEJA-SIPP === */

export const PERAN_TAMBAHAN_PETUGAS_SIDANG_HAK: readonly string[] = [
  "penjaga_sidang",
  "operator_antrian_sidang",
  "operator_panggilan_sidang",
  "operator_video_sidang",
];

export type PenggunaGolongan = {
  id?: string | null;
  roleId?: string | null;
  positionId?: string | null;
  additionalRoleIds?: readonly string[] | null;
  actingAssignment?: UserPersona["actingAssignment"];
};

function peranBerlaku(p: PenggunaGolongan): string {
  // Plt/Plh yang masih berlaku menggantikan peran (sama dengan getEffectiveRoleId).
  return String(resolveEffectiveRoleId(p as UserPersona) ?? p.roleId ?? "");
}

function posisiBerlaku(p: PenggunaGolongan): string {
  return String(resolveEffectivePositionId(p as UserPersona) ?? p.positionId ?? "");
}

/**
 * Golongan seorang pengguna - SATU ATAU LEBIH, urut dari jabatan utama.
 * Jabatan utama dari peran (roleId) dan jabatan (positionId); peran tambahan
 * menambah golongan (kasir/ptsp/mediator), tidak pernah menggantikannya.
 */
export function golonganPengguna(pengguna: PenggunaGolongan | null | undefined): GolonganPeran[] {
  if (!pengguna) return [];
  const peran = peranBerlaku(pengguna);
  const posisi = posisiBerlaku(pengguna);
  const tambahan = new Set((pengguna.additionalRoleIds ?? []).map((x) => String(x).toLowerCase()));
  const hasil: GolonganPeran[] = [];
  const tambah = (g: GolonganPeran) => {
    if (!hasil.includes(g)) hasil.push(g);
  };

  // Jabatan utama
  if (peran === "super-admin") tambah("super-admin");
  else if (peran === "admin") tambah("admin");
  else if (peran === "ketua" || peran === "wakil-ketua" || posisi === "pos-ketua" || posisi === "pos-wakil") tambah("pimpinan");
  else if (peran === "hakim" || posisi === "pos-hakim") tambah("hakim");
  else if (peran === "panitera" || posisi === "pos-panitera") tambah("panitera");
  else if (peran === "panitera-muda" || /^pos-panitera-muda/.test(posisi)) tambah("panmud");
  else if (peran === "panitera-pengganti" || posisi === "pos-panitera-pengganti") tambah("pp");
  else if (peran === "jurusita" || posisi === "pos-jurusita" || posisi === "pos-jurusita-pengganti") tambah("jurusita");
  else if (peran === "analis-keuangan" || posisi === "pos-analis-keuangan" || posisi === "pos-bendahara") tambah("kasir");
  else if (posisi === "pos-ptsp" || peran === "operator") tambah("ptsp");
  else if (
    peran === "analis-perkara" ||
    /^pos-analis-perkara/.test(posisi) ||
    /^pos-pengelola-penanganan-perkara/.test(posisi) ||
    posisi === "pos-dokumentalis-hukum" ||
    posisi === "pos-pengelola-umum-operasional-hukum"
  )
    tambah("analis-perkara");
  else if (peran === "pranata-komputer" || posisi === "pos-pranata-komputer" || posisi === "pos-staf-ptip")
    tambah("ti");
  else if (peran === "pejabat-struktural" && /^pos-panitera-muda/.test(posisi)) tambah("panmud");
  else if (peran === "sekretaris" || peran === "kasubag" || peran === "pejabat-struktural" || /^pos-(sekretaris|kasubag)/.test(posisi))
    tambah("sekretariat");
  else if (
    /^pos-(staf-umum|staf-kepegawaian|analis-kepegawaian|penata-layanan|pengadministrasi-umum|pranata-humas|arsiparis|penelaah-kebijakan|teknisi-sarpras|operator-layanan|pengelola-umum-operasional$|pengolah-data)/.test(
      posisi
    )
  )
    tambah("sekretariat");
  else tambah("pelaksana");

  // Peran tambahan (hanya menambah)
  if (PERAN_TAMBAHAN_KASIR_HAK.some((x) => tambahan.has(x))) tambah("kasir");
  if (PERAN_TAMBAHAN_PTSP_HAK.some((x) => tambahan.has(x)) || tambahan.has("operator")) tambah("ptsp");
  // MEJA-SIPP 14 Okt: Meja 1 -> PTSP; Meja 2/3 -> staf kepaniteraan (analis-perkara).
  if ([...tambahan].some((x) => POLA_SUB_PERAN_MEJA_PTSP.test(x))) tambah("ptsp");
  if ([...tambahan].some((x) => POLA_SUB_PERAN_MEJA_KEPANITERAAN.test(x))) tambah("analis-perkara");
  if (PERAN_TAMBAHAN_MEDIATOR_HAK.some((x) => tambahan.has(x))) tambah("mediator");
  // Operator = penjaga sidang yang mengoperasikan SIPP dari ruang sidang (mock-data roles).
  if (PERAN_TAMBAHAN_PETUGAS_SIDANG_HAK.some((x) => tambahan.has(x)) || peran === "operator" || tambahan.has("operator"))
    tambah("petugas-sidang");
  return hasil;
}

export function subPanmud(pengguna: PenggunaGolongan | null | undefined): SubPanmud | null {
  if (!pengguna) return null;
  const posisi = posisiBerlaku(pengguna);
  if (posisi === "pos-panitera-muda-gugatan") return "gugatan";
  if (posisi === "pos-panitera-muda-permohonan") return "permohonan";
  if (posisi === "pos-panitera-muda-hukum") return "hukum";
  return null;
}

export function golonganUtama(pengguna: PenggunaGolongan | null | undefined): GolonganPeran | null {
  return golonganPengguna(pengguna)[0] ?? null;
}

export function adalahSuperAdmin(pengguna: PenggunaGolongan | null | undefined) {
  return golonganPengguna(pengguna).includes("super-admin");
}

export function adalahAdmin(pengguna: PenggunaGolongan | null | undefined) {
  const g = golonganPengguna(pengguna);
  return g.includes("super-admin") || g.includes("admin");
}

/** Golongan bawaan bagi sebuah roleId (tanpa jabatan/peran tambahan) - untuk Akses Menu per peran. */
export function golonganDariPeran(roleId: RoleId | string): GolonganPeran {
  return golonganPengguna({ roleId: String(roleId) })[0] ?? "pelaksana";
}

// ─── Aplikasi portal (ubin + halaman) ────────────────────────────────────────

/** Tingkat hak: R baca, CRU tambah+ubah (tanpa hapus), CRUD penuh. Tidak disebut = tidak tampil. */
export type TingkatHak = "R" | "CRU" | "CRUD";

export type StatusAplikasi = "matang" | "belum-fix";

export type AturanAplikasi = {
  id: string;
  label: string;
  status: StatusAplikasi;
  /** Alasan status / pembatasannya - tampil di Akses Menu dan matriks-peran.md. */
  alasan: string;
  /** Hak bawaan per golongan. Golongan yang tidak disebut = tidak tampil. */
  hak: Partial<Record<GolonganPeran, TingkatHak>>;
};

function hakUntuk(golongan: readonly GolonganPeran[], tingkat: TingkatHak): Partial<Record<GolonganPeran, TingkatHak>> {
  return Object.fromEntries(golongan.map((g) => [g, tingkat]));
}

const SEMUA_GOLONGAN = GOLONGAN_PERAN.filter((g) => g !== "super-admin" && g !== "admin");
const KEPANITERAAN: GolonganPeran[] = ["panitera", "panmud", "pp", "jurusita", "analis-perkara"];

/**
 * Super Admin & Admin tidak perlu disebut: Super Admin selalu melihat semua;
 * Admin melihat seluruh aplikasi MATANG (pengelola satker) - aplikasi belum
 * fix tetap tertutup baginya kecuali dibuka lewat Akses Menu.
 */
export const ATURAN_APLIKASI: readonly AturanAplikasi[] = [
  {
    id: "aleta-ecourt",
    label: "ALETA e-Court",
    status: "matang",
    alasan:
      "Pintu kerja harian (Jadwal Sidang, Mediasi, Status Perkara, Kendali Berkas, unduh ekstensi). Arsip e-Court boleh dilihat semua (keputusan 9 Okt); bagian & tombol dibatasi per golongan di dalamnya (AKSI_ECOURT).",
    hak: {
      ...hakUntuk(SEMUA_GOLONGAN, "R"),
      ...hakUntuk(["pimpinan", "hakim", "panitera", "panmud", "pp", "jurusita", "kasir", "ptsp", "mediator"], "CRU"),
    },
  },
  {
    id: "manajemen-surat",
    label: "Manajemen Surat",
    status: "matang",
    alasan:
      "Surat dinas & disposisi menyangkut semua pegawai; isi surat sudah dibatasi alur disposisinya (getAccessibleLetters). Registrasi surat: kesekretariatan (canCreateIncomingLetter).",
    hak: { ...hakUntuk(SEMUA_GOLONGAN, "CRU"), sekretariat: "CRUD" },
  },
  {
    id: "e-kepegawaian",
    label: "E-Kepegawaian",
    status: "matang",
    alasan: "Data kepegawaian pribadi tiap pegawai (cuti, SKP, eviden) - semua pegawai atas datanya sendiri; persetujuan oleh atasan/kepegawaian.",
    hak: { ...hakUntuk(SEMUA_GOLONGAN, "CRU"), sekretariat: "CRUD" },
  },
  {
    id: "aleta-bot",
    label: "ALETA Bot",
    status: "matang",
    alasan:
      "Riwayat pesan WhatsApp ke para pihak memuat nomor & isi pemberitahuan perkara - hanya yang menangani/menjawab perkara (+TI untuk gangguan). Kesekretariatan & pelaksana tanpa tugas perkara tidak melihatnya.",
    hak: hakUntuk(["pimpinan", "hakim", ...KEPANITERAAN, "kasir", "ptsp", "mediator", "ti"], "R"),
  },
  {
    id: "perkara",
    label: "Ruang Kerja Perkara",
    status: "matang",
    alasan: "Ruang kerja satu perkara (berkas, riwayat, pemeriksaan, draf) - pemutus & kepaniteraan penyusun naskah (daftar peran lama dipertahankan).",
    hak: { pimpinan: "CRU", hakim: "CRU", panitera: "CRU", panmud: "CRU", pp: "CRU", "analis-perkara": "R" },
  },
  {
    id: "bas",
    label: "Alat Bantu Tulis BAS",
    status: "matang",
    alasan: "BAS ditulis PP dan di-acc hakim; panitera/panmud/pimpinan mengawasi (baca). Juru sita, kasir, PTSP, kesekretariatan tidak menulis BAS.",
    hak: { pimpinan: "R", hakim: "CRU", panitera: "CRU", panmud: "R", pp: "CRUD", "analis-perkara": "R" },
  },
  {
    id: "sipp",
    label: "SIPP (SSO)",
    status: "matang",
    alasan: "Hanya tautan masuk ke SIPP; hak di dalam SIPP diatur SIPP sendiri. Semua yang punya akun SIPP.",
    hak: hakUntuk(SEMUA_GOLONGAN, "R"),
  },
  {
    id: "aps-badilag",
    label: "APS Badilag / ABT (SSO)",
    status: "matang",
    alasan: "Blangko ABT dipakai pemutus, kepaniteraan, dan PTSP (blangko penetapan). Kasir/kesekretariatan/TI tidak menyusun blangko.",
    hak: hakUntuk(["pimpinan", "hakim", ...KEPANITERAAN, "ptsp", "mediator"], "R"),
  },
  {
    id: "asisten-hakim",
    label: "Asisten Hakim",
    status: "matang",
    alasan:
      "Tampil hanya bila Pengaturan Asisten Hakim AKTIF dan peran/akun ada di daftar izinnya (canAccessAssistantJudge) - selama belum aktif praktis hanya Super Admin.",
    hak: { pimpinan: "R", hakim: "R" },
  },
  {
    id: "audit-trail",
    label: "Audit Trail",
    status: "matang",
    alasan: "Jejak seluruh perubahan sistem - pengelola (Admin/Super Admin) saja.",
    hak: {},
  },
  {
    id: "aleta-ecourt-admin",
    label: "ALETA e-Court (pengaturan)",
    status: "matang",
    alasan: "Pengaturan penghubung untuk seluruh satker - pengelola saja.",
    hak: {},
  },
  {
    id: "peta-perkara",
    label: "Peta Perkara (modul)",
    status: "matang",
    alasan: "Sebaran asal perkara & faktor perceraian - bahan pimpinan, majelis, dan kepaniteraan; baca saja.",
    hak: hakUntuk(["pimpinan", "hakim", "panitera", "panmud", "sekretariat"], "R"),
  },
  {
    id: "beban-konseptor",
    label: "Beban Konseptor (modul)",
    status: "matang",
    alasan: "Beban kerja konseptor putusan per orang - bahan pembagian kerja oleh pimpinan dan panitera; baca saja.",
    hak: hakUntuk(["pimpinan", "panitera"], "R"),
  },
  // ─── BELUM FIX: bawaan hanya Super Admin; dibuka per peran lewat Akses Menu ──
  {
    id: "aleta-sipp",
    label: "ALETA x SIPP",
    status: "belum-fix",
    alasan: "Kamus SIPP, query registry, penilaian - masih alat pengembang; kuerinya belum dikunci untuk pemakai umum.",
    hak: {},
  },
  {
    id: "judicia-legal-form",
    label: "ALETA Judicia (Legal Form / JLF)",
    status: "belum-fix",
    alasan: "Templat & pembangkit dokumen masih tahap uji; tumpang tindih dengan blangko mandiri/ABT yang sudah dipakai.",
    hak: {},
  },
  {
    id: "aleta-e-audit",
    label: "ALETA e-Audit",
    status: "belum-fix",
    alasan: "Baru tahap 1 (katalog 185 butir); lembar penilaian belum lengkap.",
    hak: {},
  },
  {
    id: "e-status",
    label: "E-Status",
    status: "belum-fix",
    alasan: "Alur validasi/batch ke instansi mitra belum diuji dengan mitra sungguhan (lencana 'Baru').",
    hak: {},
  },
  {
    id: "aleta-antrian",
    label: "Antrian Sidang",
    status: "belum-fix",
    alasan:
      "Layar antrean (TV/kios) berjalan lewat alamat publiknya sendiri; ubin pengelolaannya belum pernah dilepas ke pegawai (status quo: hanya Super Admin). Buka lewat Akses Menu untuk petugas antrean bila sudah dipakai.",
    hak: {},
  },
  { id: "e-keuangan", label: "E-Keuangan", status: "belum-fix", alasan: "Kerangka (lencana Rencana) - belum ada isi.", hak: {} },
  { id: "manajemen-aset", label: "Manajemen Aset", status: "belum-fix", alasan: "Kerangka (lencana Rencana) - belum ada isi.", hak: {} },
  { id: "perpustakaan", label: "Perpustakaan", status: "belum-fix", alasan: "Kerangka (lencana Rencana) - belum ada isi.", hak: {} },
  {
    id: "gateway-notifikasi",
    label: "Notifikasi (gateway)",
    status: "belum-fix",
    alasan: "Kerangka (lencana Rencana) - pemberitahuan sudah berjalan lewat ALETA Bot.",
    hak: {},
  },
];

export const PETA_ATURAN_APLIKASI: ReadonlyMap<string, AturanAplikasi> = new Map(ATURAN_APLIKASI.map((a) => [a.id, a]));

export const APLIKASI_BELUM_FIX: readonly string[] = ATURAN_APLIKASI.filter((a) => a.status === "belum-fix").map((a) => a.id);

/** Modul sidebar yang menjadi bagian aplikasi - ikut aturan aplikasinya (mis. Judicia tidak bocor lewat sidebar). */
export const MODUL_MILIK_APLIKASI: Readonly<Record<string, string>> = {
  "judicia-legal-form": "judicia-legal-form",
  "judicia-legal-form-settings": "judicia-legal-form",
  "aleta-sipp": "aleta-sipp",
  "aleta-sipp-settings": "aleta-sipp",
  "aleta-e-audit": "aleta-e-audit",
  "e-status": "e-status",
  "e-status-settings": "e-status",
  "aleta-antrian": "aleta-antrian",
  keuangan: "e-keuangan",
  aset: "manajemen-aset",
  bas: "bas",
  perkara: "perkara",
  "peta-perkara": "peta-perkara",
  "beban-konseptor": "beban-konseptor",
};

/**
 * Kunci baris Akses Menu (module_visibility_settings.module_id) yang MEMBUKA
 * atau MENUTUP aplikasi untuk sebuah peran - menimpa matriks bawaan.
 *
 * Kunci tersendiri, bukan baris lama `<appId>`: baris lama terisi benih
 * (ON CONFLICT DO NOTHING) yang tidak pernah diperbarui - di salinan server
 * 9 Okt "perkara", "bas", dan "aleta-ecourt" bernilai 0 untuk hampir semua
 * peran padahal komentarnya menyebut "harus ada di daftar bawaan". Dari baris
 * itu tidak dapat dibedakan pilihan sadar Super Admin dari sisa benih, jadi
 * untuk aplikasi di ATURAN_APLIKASI keputusannya kini dari matriks + kunci
 * buka:/tutup: yang hanya lahir dari tindakan di layar Akses Menu.
 */
export function kunciBukaAplikasi(appId: string) {
  return `buka:${appId}`;
}

export function kunciTutupAplikasi(appId: string) {
  return `tutup:${appId}`;
}

export type AksesMenuPeran = { roleId: string; modules: Partial<Record<string, boolean>> } | null | undefined;

export type TimpaanAkses = "bawaan" | "buka" | "tutup";

export function timpaanAplikasi(aksesMenu: AksesMenuPeran, appId: string): TimpaanAkses {
  const modul = aksesMenu?.modules ?? {};
  if (modul[kunciTutupAplikasi(appId)] === true) return "tutup";
  if (modul[kunciBukaAplikasi(appId)] === true) return "buka";
  return "bawaan";
}

/** Bawaan matriks (tanpa timpaan Akses Menu) untuk sebuah golongan. */
export function bawaanAplikasiGolongan(golongan: readonly GolonganPeran[], appId: string): boolean {
  if (golongan.includes("super-admin")) return true;
  const aturan = PETA_ATURAN_APLIKASI.get(appId);
  if (!aturan) return true;
  if (aturan.status === "belum-fix") return false;
  if (golongan.includes("admin")) return true;
  return golongan.some((g) => Boolean(aturan.hak[g]));
}

/**
 * Apakah aplikasi tampil bagi pengguna.
 *   - Super Admin: selalu.
 *   - Akses Menu MENUTUP (tutup:<appId>): tidak tampil.
 *   - Akses Menu MEMBUKA (buka:<appId>): tampil - juga aplikasi belum fix.
 *     Inilah jalan sadar & tercatat (audit UPDATE_MODULE_VISIBILITY) untuk
 *     melepas aplikasi belum fix ke peran tertentu.
 *   - Selain itu bawaan matriks: belum fix tidak tampil; Admin semua yang
 *     matang; peran lain menurut ATURAN_APLIKASI.hak.
 * Aplikasi yang tidak terdaftar di ATURAN_APLIKASI tidak dibatasi di sini.
 */
export function aplikasiTampil(
  pengguna: PenggunaGolongan | null | undefined,
  appId: string,
  aksesMenu?: AksesMenuPeran
): boolean {
  if (!pengguna) return false;
  const golongan = golonganPengguna(pengguna);
  if (golongan.includes("super-admin")) return true;
  if (!PETA_ATURAN_APLIKASI.has(appId)) return true;
  const timpaan = timpaanAplikasi(aksesMenu, appId);
  if (timpaan === "tutup") return false;
  if (timpaan === "buka") return true;
  return bawaanAplikasiGolongan(golongan, appId);
}

/** Tingkat hak tertinggi golongan pengguna atas aplikasi (null = tidak tampil). */
export function tingkatAplikasi(pengguna: PenggunaGolongan | null | undefined, appId: string): TingkatHak | null {
  const golongan = golonganPengguna(pengguna);
  if (golongan.includes("super-admin")) return "CRUD";
  const aturan = PETA_ATURAN_APLIKASI.get(appId);
  if (!aturan) return null;
  if (aturan.status === "belum-fix") return null;
  if (golongan.includes("admin")) return "CRUD";
  const urut: TingkatHak[] = ["R", "CRU", "CRUD"];
  let terbaik = -1;
  for (const g of golongan) {
    const t = aturan.hak[g];
    if (t) terbaik = Math.max(terbaik, urut.indexOf(t));
  }
  return terbaik < 0 ? null : urut[terbaik];
}

/** Modul sidebar tampil? Modul milik aplikasi ikut aturan aplikasinya; selebihnya aturan lama (true). */
export function modulTampil(pengguna: PenggunaGolongan | null | undefined, moduleId: string, aksesMenu?: AksesMenuPeran) {
  const app = MODUL_MILIK_APLIKASI[moduleId];
  if (!app) return true;
  return aplikasiTampil(pengguna, app, aksesMenu);
}

// ─── Tab ALETA e-Court ───────────────────────────────────────────────────────

export type TabEcourt = "dasbor" | "sidang" | "mediasi" | "status" | "berkas" | "riwayat" | "ttd" | "ekstensi";

const PEMEGANG_PERKARA: GolonganPeran[] = ["pimpinan", "hakim", "panitera", "panmud", "pp", "jurusita", "analis-perkara"];

/** Golongan yang melihat tab (Super Admin & Admin selalu). Tidak disebut = semua golongan. */
export const TAB_ECOURT: Readonly<Record<TabEcourt, { golongan: readonly GolonganPeran[] | "semua"; alasan: string }>> = {
  dasbor: { golongan: "semua", alasan: "Keadaan penghubung - tidak memuat isi perkara." },
  sidang: {
    golongan: "semua",
    alasan: "Jadwal sidang adalah informasi terbuka di satker; tombol tulis di dalamnya dibatasi per aksi (sidang.*). Kasir memerlukannya untuk tombol Kasir.",
  },
  mediasi: {
    golongan: ["pimpinan", "hakim", "panitera", "panmud", "pp", "mediator", "ptsp", "analis-perkara"],
    alasan: "Mediasi tertutup untuk umum (PERMA 1/2016 ps. 5); hanya mediator, majelis/kepaniteraan, dan meja informasi (PTSP) yang mengarahkan pihak.",
  },
  status: { golongan: "semua", alasan: "Penelusuran satu perkara & arsip e-Court - boleh semua (keputusan 9 Okt); data pribadi pihak dibatasi aksi status.data-pihak." },
  berkas: { golongan: "semua", alasan: "Kendali Berkas = arsip e-Court - boleh dilihat semua (keputusan 9 Okt); tarik & sinkron dibatasi aksi." },
  riwayat: {
    golongan: ["pimpinan", "hakim", "panitera", "ptsp"],
    alasan: "Riwayat penetapan yang dituliskan ALETA ke SIPP - rutenya menuntut kemampuan 'penunjukan' (bawaan ketua/wakil/hakim/panitera; PTSP bila diberi).",
  },
  ttd: { golongan: [], alasan: "Tanda tangan pejabat & cap berlaku untuk seluruh satker - hanya Admin/Super Admin." },
  ekstensi: { golongan: "semua", alasan: "Unduh & pasang ekstensi - semua pegawai." },
};

export function tabEcourtTampil(pengguna: PenggunaGolongan | null | undefined, tab: TabEcourt): boolean {
  const golongan = golonganPengguna(pengguna);
  if (golongan.length === 0) return false;
  if (golongan.includes("super-admin") || golongan.includes("admin")) return true;
  const aturan = TAB_ECOURT[tab];
  if (!aturan) return true;
  if (aturan.golongan === "semua") return true;
  return golongan.some((g) => (aturan.golongan as readonly GolonganPeran[]).includes(g));
}

// ─── Aksi (C/U/D) - dipakai layar DAN penjaga rute ───────────────────────────

export type AturanAksi = {
  label: string;
  /** C/U/D yang dicakup. */
  crud: "C" | "U" | "D" | "CU" | "CUD" | "R";
  golongan: readonly GolonganPeran[];
  /** "milik" = layar menyaring ke perkara yang ditangani; rute menegakkan golongan. */
  lingkup: "milik" | "semua";
  /** Rute API yang menegakkannya (dokumentasi + uji). */
  rute: readonly string[];
  alasan: string;
};

const PERSIDANGAN: GolonganPeran[] = ["pimpinan", "hakim", "panitera", "panmud", "pp"];

export const AKSI = {
  // Jadwal Sidang
  "sidang.tunda-putus": {
    label: "Tunda / Putus sidang (tulis ke SIPP)",
    crud: "CU",
    golongan: PERSIDANGAN,
    lingkup: "milik",
    rute: ["POST /api/aleta-ecourt/sidang-tunda", "POST /api/aleta-ecourt/sidang-putus"],
    alasan: "Hasil sidang dicatat PP atas majelisnya (penginput tunda/putusan = PP); hakim/pimpinan/panitera mengawasi. Kasir, PTSP, juru sita tidak mencatat hasil sidang.",
  },
  "sidang.jalannya": {
    label: "Tandai selesai / sedang berjalan / skors",
    crud: "CU",
    golongan: [...PERSIDANGAN, "petugas-sidang"],
    lingkup: "semua",
    rute: ["POST /api/aleta-ecourt/sidang/selesai", "POST /api/aleta-ecourt/sidang/berjalan", "POST /api/aleta-ecourt/sidang/skors"],
    alasan: "Jalannya sidang di ruang - majelis, PP, dan petugas/penjaga sidang.",
  },
  "sidang.antrian": {
    label: "Antrian sidang (ambil/batal nomor, daftarkan, panggil pihak)",
    crud: "CUD",
    golongan: [...PERSIDANGAN, "petugas-sidang", "ptsp"],
    lingkup: "semua",
    rute: [
      "POST|DELETE /api/aleta-ecourt/antrian-ambil",
      "POST /api/aleta-ecourt/antrian",
      "POST /api/aleta-ecourt/antrian/panggil",
      "POST /api/aleta-ecourt/panggil",
    ],
    alasan: "Antrean dikelola meja PTSP/informasi dan petugas sidang; majelis/PP memanggil.",
  },
  "sidang.mediator": {
    label: "Pilih mediator",
    crud: "CU",
    golongan: PERSIDANGAN,
    lingkup: "milik",
    rute: ["POST /api/aleta-ecourt/sidang/mediator"],
    alasan: "Mediator ditunjuk majelis pada sidang pertama (PERMA 1/2016).",
  },
  "sidang.keterangan": {
    label: "Keterangan perkara",
    crud: "CU",
    golongan: [...PERSIDANGAN, "jurusita", "petugas-sidang"],
    lingkup: "milik",
    rute: ["POST /api/aleta-ecourt/keterangan-perkara"],
    alasan: "Catatan kerja petugas yang menangani perkara.",
  },
  "sidang.konseptor": {
    label: "Tunjuk konseptor sementara",
    crud: "CU",
    golongan: ["pimpinan", "hakim", "panitera", "panmud"],
    lingkup: "milik",
    rute: ["POST /api/aleta-ecourt/konseptor-sementara"],
    alasan: "Konseptor putusan ditunjuk majelis / diawasi panitera.",
  },
  "sidang.kehadiran-bas": {
    label: "Kehadiran pihak untuk BAS",
    crud: "CU",
    golongan: [...PERSIDANGAN, "petugas-sidang"],
    lingkup: "milik",
    rute: ["PUT /api/aleta-ecourt/bas/kehadiran"],
    alasan: "Kehadiran dicatat di ruang sidang oleh PP/petugas sidang.",
  },
  "sidang.court-calendar": {
    label: "Isi Court Calendar ke SIPP",
    crud: "CU",
    golongan: ["panitera", "panmud", "pp"],
    lingkup: "milik",
    rute: ["POST /api/aleta-ecourt/sidang/court-calendar"],
    alasan: "Court Calendar diisi kepaniteraan di SIPP (bolehIsiCourtCalendar, 6 Okt).",
  },
  "sidang.tarik-belum-upload": {
    label: "Tarik dokumen belum diunggah (e-Court)",
    crud: "C",
    golongan: PERSIDANGAN,
    lingkup: "milik",
    rute: ["POST /api/aleta-ecourt/sidang/verifikasi-ecourt/tarik"],
    alasan: "Menyiapkan verifikasi dokumen e-Litigasi - majelis & PP.",
  },
  "sidang.kasir": {
    label: "Kasir (jurnal, harian, pengingat, rekap)",
    crud: "CU",
    golongan: ["kasir", "panitera", "panmud"],
    lingkup: "semua",
    rute: ["POST /api/aleta-ecourt/sidang/kasir", "GET|POST /api/aleta-ecourt/sidang/kasir/*"],
    alasan: "Aturan Kasir 1.186 (bolehKasir): kasir/keuangan perkara/bendahara, panitera, panitera muda - keuangan SEMUA perkara.",
  },
  "sidang.cetak-relaas": {
    label: "Cetak relaas massal",
    crud: "R",
    golongan: ["jurusita"],
    lingkup: "milik",
    rute: ["GET /api/aleta-ecourt/relaas-massal/cetak"],
    alasan: "Relaas disampaikan juru sita/JSP.",
  },
  "ecourt.verifikasi": {
    label: "Verifikasi dokumen e-Court (hakim)",
    crud: "U",
    golongan: ["pimpinan", "hakim"],
    lingkup: "milik",
    rute: ["POST /api/aleta-ecourt/ecourt-aksi/verifikasi"],
    alasan: "Verifikasi dokumen e-Litigasi adalah tindakan majelis di e-Court.",
  },
  "ecourt.tte": {
    label: "TTE salinan putusan (panitera)",
    crud: "U",
    golongan: ["panitera", "panmud"],
    lingkup: "semua",
    rute: ["POST /api/aleta-ecourt/ecourt-aksi/tte"],
    alasan: "Salinan putusan ditandatangani panitera (atau panmud yang ditunjuk).",
  },
  // === 12OKT-F: saklar "Tarik data e-Court" di widget ekstensi ===
  "ecourt.tarik-data": {
    label: "Menyalakan / mematikan penarikan berkala e-Court (widget ekstensi)",
    crud: "U",
    golongan: [],
    lingkup: "semua",
    rute: ["GET|POST /api/aleta-ecourt/ekstensi/tarik-ecourt"],
    alasan: "Satu saklar penjadwal untuk seluruh satker (sama dengan Integrasi e-Court) - Admin/Super Admin saja.",
  },
  // === AKHIR 12OKT-F ===
  // Jadwal Mediasi
  "mediasi.catat": {
    label: "Catat kehadiran & status mediasi",
    crud: "CU",
    golongan: ["mediator", "hakim", "pimpinan", "panitera", "panmud", "pp"],
    lingkup: "milik",
    rute: ["POST /api/aleta-ecourt/kehadiran-mediasi", "POST /api/aleta-ecourt/mediasi-status"],
    alasan: "Dicatat mediator (hakim mediator atau mediator non-hakim) dan kepaniteraan perkara itu.",
  },
  "mediasi.hasil": {
    label: "Buat hasil mediasi (.rtf)",
    crud: "C",
    golongan: ["mediator", "hakim"],
    lingkup: "milik",
    rute: ["POST /api/aleta-ecourt/hasil-mediasi"],
    alasan: "Rute menegakkan pastikanMediator (nama akun cocok dengan mediator perkara di SIPP, atau Super Admin) - lebih tepat daripada golongan, jadi rute TIDAK diberi pagar golongan.",
  },
  // Status Perkara
  "status.data-pihak": {
    label: "Identitas & riwayat para pihak",
    crud: "R",
    golongan: [...PEMEGANG_PERKARA, "kasir", "ptsp", "mediator"],
    lingkup: "semua",
    rute: ["GET /api/aleta-ecourt/identitas-pihak", "GET /api/aleta-ecourt/riwayat-pihak", "GET /api/aleta-ecourt/kontak-para-pihak", "GET /api/aleta-ecourt/ktp-pihak-status"],
    alasan:
      "Data pribadi pihak (NIK, alamat, riwayat perkara lain, email/WA & kesediaan e-Litigasi) - hanya yang melayani perkara (UU PDP); kesekretariatan/TI/pelaksana/petugas sidang tidak.",
  },
  "status.analisa": {
    label: "Analisa perkara & prompt putusan",
    crud: "R",
    golongan: PERSIDANGAN,
    lingkup: "milik",
    rute: ["GET /api/aleta-ecourt/analisa", "GET /api/aleta-ecourt/prompt-putusan"],
    alasan: "Bahan penyusunan putusan - majelis, PP (konseptor), panitera/panmud.",
  },
  // Kendali Berkas
  "berkas.tarik": {
    label: "Tarik berkas satu perkara dari e-Court",
    crud: "C",
    golongan: [...PEMEGANG_PERKARA, "ptsp"],
    lingkup: "semua",
    rute: ["POST /api/aleta-ecourt/penarikan (tindakan perkara)"],
    alasan: "Kemampuan 'permintaan' (bawaan pemegang perkara); PTSP memverifikasi pendaftaran e-Court.",
  },
  "berkas.sinkron-sipp": {
    label: "Mulai sinkron Kendali Berkas SIPP",
    crud: "U",
    golongan: [],
    lingkup: "semua",
    rute: ["POST /api/aleta-ecourt/kendali-berkas"],
    alasan: "Pekerjaan berat untuk seluruh satker - Admin/Super Admin saja (rute sudah menolak; tombol kini ikut disembunyikan).",
  },
  // Putusan & berkas kerja
  "putusan.draf": {
    label: "Simpan draf putusan & jejak berkas perkara",
    crud: "CU",
    golongan: PERSIDANGAN,
    lingkup: "milik",
    rute: ["POST /api/aleta-ecourt/putusan", "POST /api/aleta-ecourt/putusan/jejak", "POST /api/aleta-ecourt/berkas-perkara/riwayat"],
    alasan: "Draf putusan disusun majelis/konseptor (PP) - juru sita, kasir, PTSP tidak.",
  },
  "putusan.unggah": {
    label: "Unggah putusan ke SIPP/e-Court",
    crud: "CU",
    golongan: ["pimpinan", "hakim"],
    lingkup: "milik",
    rute: ["POST /api/aleta-ecourt/putusan/unggah-sipp", "POST /api/aleta-ecourt/putusan/isian-sipp", "POST /api/aleta-ecourt/putusan/unggah-naskah"],
    alasan: "Keputusan pengguna 9 Okt: hanya Hakim (termasuk Ketua/Wakil), Admin, Super Admin (pastikanBolehUnggahPutusan).",
  },
  "ttd.kelola": {
    label: "Kelola tanda tangan pejabat & cap",
    crud: "CUD",
    golongan: [],
    lingkup: "semua",
    rute: ["POST /api/aleta-ecourt/tanda-tangan"],
    alasan: "Berlaku untuk seluruh satker & semua perkara sesudahnya - Admin/Super Admin (layar sudah admin; rute kini ikut).",
  },
  // Analitik
  "analitik.peta-beban": {
    label: "Peta perkara & beban konseptor",
    crud: "R",
    golongan: ["pimpinan", "hakim", "panitera", "panmud", "sekretariat"],
    lingkup: "semua",
    rute: ["GET /api/aleta-ecourt/peta-perkara", "GET /api/aleta-ecourt/konseptor"],
    alasan: "Rekap lintas perkara & lintas orang - pimpinan, majelis, kepaniteraan, sekretaris.",
  },
} as const satisfies Record<string, AturanAksi>;

export type KunciAksi = keyof typeof AKSI;

/** Boleh melakukan aksi? Super Admin & Admin selalu (pengelola satker). */
export function bolehAksi(pengguna: PenggunaGolongan | null | undefined, aksi: KunciAksi): boolean {
  const golongan = golonganPengguna(pengguna);
  if (golongan.length === 0) return false;
  if (golongan.includes("super-admin") || golongan.includes("admin")) return true;
  const aturan: AturanAksi = AKSI[aksi];
  if (!aturan) return false;
  return golongan.some((g) => aturan.golongan.includes(g));
}

/**
 * Untuk LAYAR: pengguna undefined = komponen dirender tanpa PortalProvider
 * (uji lama/layar lepas) -> tidak disembunyikan; rute tetap penjaganya.
 */
export function bolehAksiLayar(pengguna: PenggunaGolongan | null | undefined, aksi: KunciAksi): boolean {
  if (pengguna === undefined) return true;
  return bolehAksi(pengguna, aksi);
}

export function pesanTolakAksi(aksi: KunciAksi): string {
  const aturan: AturanAksi = AKSI[aksi];
  const siapa = ["Admin", ...aturan.golongan.map((g) => LABEL_GOLONGAN[g])].join(", ");
  return `${aturan.label} hanya untuk ${siapa}. Peran Anda tidak diberi hak ini (matriks peran 12 Okt).`;
}

/**
 * Saklar Jadwal Sidang yang mewakili tombol aksi - dimatikan bila peran tidak
 * boleh, apa pun pilihan saklar pemakainya (saklar bukan hak). Saklar tampilan
 * murni (penanda, keterangan) tidak disentuh.
 */
export const SAKLAR_SIDANG_PER_AKSI: Readonly<Record<string, KunciAksi>> = {
  "tombol-tunda-putus": "sidang.tunda-putus",
  "tombol-mediator": "sidang.mediator",
  "court-calendar": "sidang.court-calendar",
  "tarik-belum-upload": "sidang.tarik-belum-upload",
  "ambil-antrian": "sidang.antrian",
  "daftar-antrian": "sidang.antrian",
  // 12 Okt 2026 (butir 4): memanggil saksi memakai rute panggil yang sama (sidang.antrian).
  "panggil-saksi": "sidang.antrian",
  "tunjuk-konseptor": "sidang.konseptor",
  "keterangan-perkara": "sidang.keterangan",
  "tombol-kasir": "sidang.kasir",
  "tombol-kasir-harian": "sidang.kasir",
};

export function saringSaklarSidang<T extends Record<string, boolean | undefined>>(
  pilihan: T,
  pengguna: PenggunaGolongan | null | undefined
): T {
  if (!pengguna) return pilihan;
  let hasil: T | null = null;
  for (const [saklar, aksi] of Object.entries(SAKLAR_SIDANG_PER_AKSI)) {
    if (!bolehAksi(pengguna, aksi)) {
      hasil = hasil ?? ({ ...pilihan } as T);
      (hasil as Record<string, boolean | undefined>)[saklar] = false;
    }
  }
  return hasil ?? pilihan;
}

// ─── Ekstensi: golongan menu panel SIPP/ABT (panel-alat.js ALAT_MENU_PERAN) ───

/**
 * Golongan menu ekstensi yang dikirim server (ruas `golonganMenu` di
 * /ekstensi/siapa, sipp-konteks, dan sumber "siapa" ABT). Ekstensi
 * memakainya lebih dulu daripada menebak dari NAMA peran - sehingga jabatan
 * (positionId) dan peran tambahan ikut terbaca di SIPP maupun ABT.
 */
export type GolonganMenuEkstensi =
  | "admin"
  | "ketua"
  | "hakim"
  | "panitera"
  | "panmud"
  | "pp"
  | "jurusita"
  | "kasir"
  | "ptsp"
  | "mediator"
  | "analis"
  | "sekretariat"
  | "lain";

const PETA_GOLONGAN_EKSTENSI: Record<GolonganPeran, GolonganMenuEkstensi> = {
  "super-admin": "admin",
  admin: "admin",
  pimpinan: "ketua",
  hakim: "hakim",
  panitera: "panitera",
  panmud: "panmud",
  pp: "pp",
  jurusita: "jurusita",
  kasir: "kasir",
  ptsp: "ptsp",
  mediator: "mediator",
  "petugas-sidang": "lain",
  "analis-perkara": "analis",
  sekretariat: "sekretariat",
  ti: "lain",
  pelaksana: "lain",
};

const URUTAN_GOLONGAN_EKSTENSI: GolonganMenuEkstensi[] = [
  "admin",
  "ketua",
  "hakim",
  "panitera",
  "panmud",
  "pp",
  "jurusita",
  "kasir",
  "ptsp",
  "mediator",
  "analis",
  "sekretariat",
  "lain",
];

export function golonganMenuEkstensi(pengguna: PenggunaGolongan | null | undefined): GolonganMenuEkstensi[] {
  const hasil: GolonganMenuEkstensi[] = [];
  for (const g of golonganPengguna(pengguna)) {
    const e = PETA_GOLONGAN_EKSTENSI[g];
    if (!hasil.includes(e)) hasil.push(e);
  }
  // "lain" hanya bila tidak ada golongan lain yang lebih khusus; urutan
  // menurut pekerjaan perkara (tab pertama = tab bawaan terbuka): Pelaksana
  // berjabatan staf umum + peran tambahan Kasir membuka Kasir, bukan Perkara.
  const tanpaLain = hasil.filter((g) => g !== "lain");
  const urut = (tanpaLain.length ? tanpaLain : hasil.length ? (["lain"] as GolonganMenuEkstensi[]) : []).slice();
  return urut.sort((x, y) => URUTAN_GOLONGAN_EKSTENSI.indexOf(x) - URUTAN_GOLONGAN_EKSTENSI.indexOf(y));
}

/**
 * BAS massal (16 Okt 2026 malam, hak putusan/BAS per peran): golongan yang sama
 * dengan matriks menu ekstensi "bas-massal" (panel-alat.js ALAT_MENU_PERAN.*.daftar:
 * pp, panitera-utama, panmud, analis) + admin. Hakim, Ketua/Wakil, juru sita,
 * dan peran lain tidak - rute menolak 403 walau kemampuan "panel" menyala.
 */
const GOLONGAN_BAS_MASSAL: GolonganMenuEkstensi[] = ["admin", "panitera", "panmud", "pp", "analis"];
export function bolehBasMassal(pengguna: PenggunaGolongan | null | undefined): boolean {
  return golonganMenuEkstensi(pengguna).some((g) => GOLONGAN_BAS_MASSAL.includes(g));
}
/* === AKHIR HAK-PERAN === */
