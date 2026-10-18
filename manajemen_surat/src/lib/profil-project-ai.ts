/**
 * ============================================================================
 * PROFIL PROJECT ALETA AI (18 Okt 2026)
 * ============================================================================
 *
 * Project "ALETA AI PA CLAUDE ULTRA" di Claude sudah membawa sendiri
 * instruksinya: siapa ia, standar mutunya, format keluarannya, dan pemicu
 * yang dikenalinya. Perintah yang disusun ALETA karena itu TIDAK boleh
 * menulis ulang semua itu - perintah yang menulis ulang akan bertabrakan
 * dengan instruksi Project begitu Project diperbarui.
 *
 * Yang dicatat di sini hanya RINGKASAN instruksi itu, supaya penyusun perintah
 * memakai istilah, bagian, dan format yang sama dengan Project:
 *
 *   - ringkasan peran : catatan bagi manusia, TIDAK pernah masuk ke perintah
 *   - format keluaran : satu-dua kalimat, masuk ke perintah
 *   - istilah         : kebiasaan penulisan yang harus dipegang, masuk ke perintah
 *   - bagian          : urutan bagian data yang dikenali Project, memberi
 *                       rangka pada data perkara
 *   - pembuka         : kalimat pembuka singkat (tanpa sapaan, tanpa peran)
 *
 * Super Admin dapat mengubahnya di Pengaturan bila Project diperbarui; versi
 * dan tanggalnya dicatat supaya terlihat di layar penyusun.
 *
 * Berkas ini MURNI (tanpa basis data) - dipakai penyusun di peramban dan
 * penyimpanan di server, sehingga bentuk dan batasnya satu sumber.
 */

export type ProfilProjectAi = {
  namaProject: string;
  /** Mis. "PA Edition V.4.5 (Claude-Native Core)". */
  versi: string;
  /** ISO yyyy-mm-dd - kapan instruksi Project itu dicatat. */
  tanggal: string;
  /** Catatan bagi manusia. TIDAK dimasukkan ke perintah. */
  ringkasanRole: string;
  formatKeluaran: string;
  istilah: string;
  /** Bagian data yang dikenali Project, urut. */
  bagian: string[];
  pembuka: string;
  catatan: string;
  diubahOleh?: string;
  diubahPada?: string;
};

export const NAMA_PROJECT_AI = "ALETA AI PA CLAUDE ULTRA";
export const PEMBUKA_AMAN = "Gunakan instruksi Project yang sedang aktif. Fokus pada data perkara berikut.";

/**
 * Bawaan: ringkasan instruksi Project V.4.5 yang diberikan pengguna pada
 * 18 Okt 2026. Pola data JENIS - PENGGUGAT/PEMOHON - TERGUGAT/TERMOHON - FAKTA
 * KUNCI - BUKTI SURAT - SAKSI - YANG DIMINTA adalah format yang disarankan
 * Project itu sendiri.
 */
export const PROFIL_BAWAAN_V45: ProfilProjectAi = {
  namaProject: NAMA_PROJECT_AI,
  versi: "PA Edition V.4.5 (Claude-Native Core)",
  tanggal: "2026-10-18",
  ringkasanRole:
    "Project sudah memuat sendiri: peran, standar mutu, lingkup Pasal 49 UU Peradilan Agama, KEPPH, urutan prioritas aturan, anti-halusinasi, Devil's Advocate otomatis, format keluaran, dan sapaan. Perintah dari ALETA tidak mengulanginya.",
  formatKeluaran:
    "Jawaban di chat berupa teks polos tanpa markdown; dokumen bawaan berbentuk .rtf. Data yang tidak ada ditandai [placeholder: ...] oleh Project.",
  istilah:
    "Hukum acara yang dipakai RBg (bukan HIR). Tenggat ikrar talak dihitung enam bulan sejak tanggal penetapan hari sidang ikrar talak (PHS ikrar), bukan dari BHT. Produk para pihak dikutip persis di antara #VERBATIM dan #ENDVERBATIM.",
  bagian: [
    "JENIS",
    "PENGGUGAT/PEMOHON",
    "TERGUGAT/TERMOHON",
    "FAKTA KUNCI",
    "BUKTI SURAT",
    "SAKSI",
    "YANG DIMINTA",
  ],
  pembuka: PEMBUKA_AMAN,
  catatan: "Diisi dari ringkasan instruksi Project V.4.5 yang diberikan pengguna pada 18 Okt 2026.",
};

export const BATAS_PROFIL = {
  nama: 120,
  versi: 160,
  teksPanjang: 2000,
  pembuka: 400,
  catatan: 1000,
  butirBagian: 20,
  panjangButir: 80,
} as const;

function teks(nilai: unknown, maks: number): string {
  return String(nilai ?? "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, maks);
}

/**
 * Membersihkan masukan apa pun menjadi profil yang sah, atau null bila bukan
 * objek. Ruas yang kosong dibiarkan kosong - pemakaiannya (`profilEfektif`)
 * yang menambal dengan bawaan, bukan penyimpanan.
 */
export function bersihkanProfilProject(masukan: unknown): ProfilProjectAi | null {
  if (!masukan || typeof masukan !== "object" || Array.isArray(masukan)) return null;
  const x = masukan as Record<string, unknown>;
  const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(String(x.tanggal ?? "")) ? String(x.tanggal) : "";
  const bagianMentah = Array.isArray(x.bagian)
    ? x.bagian
    : typeof x.bagian === "string"
      ? x.bagian.split(/[\n,]/)
      : [];
  const bagian = bagianMentah
    .map((b) => teks(b, BATAS_PROFIL.panjangButir))
    .filter(Boolean)
    .slice(0, BATAS_PROFIL.butirBagian);
  const hasil: ProfilProjectAi = {
    namaProject: teks(x.namaProject, BATAS_PROFIL.nama),
    versi: teks(x.versi, BATAS_PROFIL.versi),
    tanggal,
    ringkasanRole: teks(x.ringkasanRole, BATAS_PROFIL.teksPanjang),
    formatKeluaran: teks(x.formatKeluaran, BATAS_PROFIL.teksPanjang),
    istilah: teks(x.istilah, BATAS_PROFIL.teksPanjang),
    bagian,
    pembuka: teks(x.pembuka, BATAS_PROFIL.pembuka),
    catatan: teks(x.catatan, BATAS_PROFIL.catatan),
  };
  if (typeof x.diubahOleh === "string") hasil.diubahOleh = teks(x.diubahOleh, 120);
  if (typeof x.diubahPada === "string") hasil.diubahPada = teks(x.diubahPada, 40);
  return hasil;
}

/**
 * Hanya Super Admin yang mengubah profil: mengubahnya mengubah isi setiap
 * perintah AI yang disusun sesudahnya, oleh siapa pun. Admin dan peran lain
 * hanya membaca.
 */
export function bolehMengubahProfilProject(pengguna: { roleId?: string | null } | null | undefined): boolean {
  return String(pengguna?.roleId || "") === "super-admin";
}

/** Profil yang berlaku: ruas yang kosong ditambal bawaan V.4.5. */
export function profilEfektif(tersimpan: ProfilProjectAi | null | undefined): ProfilProjectAi {
  if (!tersimpan) return { ...PROFIL_BAWAAN_V45, bagian: [...PROFIL_BAWAAN_V45.bagian] };
  const b = PROFIL_BAWAAN_V45;
  return {
    namaProject: tersimpan.namaProject || b.namaProject,
    versi: tersimpan.versi || b.versi,
    tanggal: tersimpan.tanggal || b.tanggal,
    ringkasanRole: tersimpan.ringkasanRole || b.ringkasanRole,
    formatKeluaran: tersimpan.formatKeluaran || b.formatKeluaran,
    istilah: tersimpan.istilah || b.istilah,
    bagian: tersimpan.bagian.length ? [...tersimpan.bagian] : [...b.bagian],
    pembuka: tersimpan.pembuka || b.pembuka,
    catatan: tersimpan.catatan,
    diubahOleh: tersimpan.diubahOleh,
    diubahPada: tersimpan.diubahPada,
  };
}

const BULAN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

/** "18 Okt 2026" dari "2026-10-18"; kosong bila bukan tanggal. */
export function tanggalPendek(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return "";
  return `${Number(m[3])} ${BULAN[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

/** Baris kecil di bawah centang: "Profil: PA Edition V.4.5 ... · 18 Okt 2026". */
export function labelVersiProfil(profil: ProfilProjectAi): string {
  const tgl = tanggalPendek(profil.tanggal);
  return `Profil Project: ${profil.versi}${tgl ? ` · ${tgl}` : ""}`;
}
