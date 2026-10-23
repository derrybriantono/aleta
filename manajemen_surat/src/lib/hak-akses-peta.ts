/**
 * ============================================================================
 * PETA HAK AKSES PER PERAN - SATU DATA UNTUK PORTAL, DOKUMEN, DAN UJI (18 Okt 2026)
 * ============================================================================
 *
 * Permintaan pengguna 18 Okt 2026 ±21.00: "tentukan lagi tiap role dan user apa
 * saja yang bisa diakses: fitur, blangko, kewenangan, serta hal yang bisa dia
 * akses ... Kalau super admin bisa semua masuk dan ditampilkan."
 *
 * Berkas ini TIDAK menjadi sumber kebenaran baru bagi penjaga: penjaga tetap di
 * matriks-peran.ts (aplikasi, tab, aksi), panel-alat.js (menu ekstensi), dan
 * jenisDokumenAkun (blangko Derry). Berkas ini MENYUSUN peta tunggalnya dari
 * sumber-sumber itu, lalu menambah butir yang kuncinya hidup di tempat lain
 * (acc BAS, SKP, unggah massal, penanda SIPP, saklar popup, dan seterusnya).
 * Tiga pemakai memakai data YANG SAMA, bukan salinan tangan:
 *   1. halaman portal Pengaturan > Hak akses per peran (/admin/hak-akses);
 *   2. dokumen docs/hak-akses/MATRIKS-HAK-AKSES-18okt.md (dibangkitkan dari sini,
 *      dijaga uji agar tidak menyimpang);
 *   3. uji (hak-akses-peta-18okt.test.ts): tiap fitur punya butir, Super Admin
 *      selalu memegang semuanya, dan tabel menu ekstensi sama dengan panel-alat.js.
 *
 * Arti tingkat (kolom tabel):
 *   Lihat (L)  melihat/membaca saja
 *   Pakai (P)  menjalankan fitur dalam tugasnya (membuat, mengisi, mencetak, menarik)
 *   Ubah  (U)  mengubah data/pengaturan milik satker atau menulis hasil substantif
 *   -          tidak diberi (menu/tombol tidak tampil, rute menjawab 403)
 */

import { jenisDokumenAkun, type JenisDokumenDerry } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { LABEL_STATUS_FITUR } from "@/lib/fitur-satker";
import {
  AKSI,
  ATURAN_APLIKASI,
  GOLONGAN_PERAN,
  LABEL_GOLONGAN,
  MODUL_MILIK_APLIKASI,
  PETA_GOLONGAN_EKSTENSI,
  TAB_ECOURT,
  type GolonganPeran,
  type TingkatHak,
} from "@/lib/matriks-peran";
import { KODE_IDE_L2, PERAN_IDE_L2, type KodeIdeL2 } from "@/lib/sipp-ide-l2";

export type TingkatPeta = "L" | "P" | "U";
export const URUTAN_TINGKAT: readonly TingkatPeta[] = ["L", "P", "U"];
export const LABEL_TINGKAT: Readonly<Record<TingkatPeta, string>> = { L: "Lihat", P: "Pakai", U: "Ubah" };

export type KelompokPeta = "portal" | "pengaturan" | "ecourt" | "fitur" | "ekstensi" | "blangko";
export const URUTAN_KELOMPOK: readonly KelompokPeta[] = ["portal", "ecourt", "fitur", "ekstensi", "blangko", "pengaturan"];
export const LABEL_KELOMPOK: Readonly<Record<KelompokPeta, string>> = {
  portal: "Aplikasi dan menu portal",
  ecourt: "ALETA e-Court: tab dan tombol aksi",
  fitur: "Fitur kerja perkara",
  ekstensi: "Ekstensi di SIPP dan ABT",
  blangko: "Blangko",
  pengaturan: "Pengaturan dan pengelolaan",
};

export type HakPeta = Partial<Record<GolonganPeran, TingkatPeta>>;

export type ButirPeta = {
  /** Kunci tetap butir ini (tidak pernah tampil di layar pegawai). */
  id: string;
  kelompok: KelompokPeta;
  judul: string;
  keterangan: string;
  /** Hak tiap golongan. Super Admin SELALU memegang tingkat tertinggi butir ini (disisipkan buat()). */
  hak: HakPeta;
  /** Kewenangan khusus / syarat tambahan, dibaca semua pembaca halaman. */
  catatan?: string;
  /** Penanda teknis - hanya untuk Super Admin dan dokumen. */
  sumber?: string;
  rute?: readonly string[];
};

const tertinggi = (hak: HakPeta): TingkatPeta => {
  let t = 0;
  for (const v of Object.values(hak)) if (v) t = Math.max(t, URUTAN_TINGKAT.indexOf(v));
  return URUTAN_TINGKAT[t];
};

/**
 * Membangun butir: Super Admin selalu tingkat tertinggi butir. Admin ikut tingkat tertinggi
 * kecuali `admin` disebut eksplisit (false = tidak diberi, atau tingkat tertentu).
 */
function buat(
  b: Omit<ButirPeta, "hak"> & { hak: HakPeta; admin?: TingkatPeta | false; maks?: TingkatPeta }
): ButirPeta {
  const { admin, maks: minimal, ...sisa } = b;
  const hak: HakPeta = { ...b.hak };
  const dariHak = tertinggi(hak);
  const maks = minimal && URUTAN_TINGKAT.indexOf(minimal) > URUTAN_TINGKAT.indexOf(dariHak) ? minimal : dariHak;
  hak["super-admin"] = maks;
  if (admin === false) delete hak.admin;
  else hak.admin = admin ?? maks;
  return { ...sisa, hak };
}

const dari = (golongan: readonly GolonganPeran[], tingkat: TingkatPeta): HakPeta =>
  Object.fromEntries(golongan.map((g) => [g, tingkat])) as HakPeta;

const gabung = (...hak: HakPeta[]): HakPeta => Object.assign({}, ...hak);

const SEMUA_BIASA = GOLONGAN_PERAN.filter((g) => g !== "super-admin" && g !== "admin");

// ─── 1. Aplikasi (ATURAN_APLIKASI) ───────────────────────────────────────────

const dariTingkatHak = (t: TingkatHak): TingkatPeta => (t === "R" ? "L" : t === "CRU" ? "P" : "U");

function butirAplikasi(): ButirPeta[] {
  return ATURAN_APLIKASI.map((a) => {
    const hak: HakPeta = {};
    for (const [g, t] of Object.entries(a.hak)) if (t) hak[g as GolonganPeran] = dariTingkatHak(t);
    const hanyaSa = a.status === "belum-fix" || Boolean(a.hanyaSuperAdmin);
    const butir = buat({
      id: `aplikasi.${a.id}`,
      kelompok: "portal",
      judul: a.label,
      keterangan: a.alasan,
      hak: hanyaSa ? { "super-admin": "U" } : hak,
      maks: "U",
      admin: hanyaSa ? false : "U",
      catatan:
        a.status === "belum-fix"
          ? "Belum dibuka untuk peran lain: aplikasi masih dalam penyempurnaan. Super Admin dapat membukanya per peran lewat Akses Menu."
          : a.hanyaSuperAdmin
            ? "Hanya Super Admin (halaman dan rutenya menolak Admin)."
            : a.id === "blangko-saya"
              ? "Tahap awal (18 Okt 2026): ubin dan menu hanya tampil bagi Super Admin sampai saklar Fitur Satker 'Blangko Saya untuk semua peran' dinyalakan; kolom peran lain berlaku sesudahnya."
              : undefined,
      sumber: `ATURAN_APLIKASI.${a.id}`,
    });
    return butir;
  });
}

// ─── 2. Menu portal di luar aplikasi bermatriks ──────────────────────────────

type MenuPortal = { modul: string; judul: string; keterangan: string; hak: HakPeta; admin?: TingkatPeta | false; catatan?: string };

const MENU_PORTAL: readonly MenuPortal[] = [
  { modul: "dashboard", judul: "Dashboard Surat", keterangan: "Ringkasan surat dan disposisi pegawai.", hak: dari(SEMUA_BIASA, "P") },
  { modul: "notifikasi", judul: "Pusat Tugas", keterangan: "Tugas dan disposisi yang menunggu pegawai.", hak: dari(SEMUA_BIASA, "P") },
  {
    modul: "penugasan",
    judul: "Kelola PLH dan PLT",
    keterangan: "Menetapkan pelaksana harian atau pelaksana tugas.",
    hak: dari(["pimpinan", "hakim", "panitera", "panmud", "sekretariat"], "U"),
    catatan: "Pejabat struktural dan kesekretariatan menetapkan penggantinya sendiri; Plt/Plh yang berlaku tidak dapat menetapkan lagi.",
  },
  { modul: "surat-masuk", judul: "Surat Masuk", keterangan: "Surat dinas yang masuk; isi dibatasi alur disposisinya.", hak: gabung(dari(SEMUA_BIASA, "P"), dari(["sekretariat"], "U")) },
  { modul: "surat-keluar", judul: "Surat Keluar", keterangan: "Surat dinas yang keluar; isi dibatasi alur disposisinya.", hak: gabung(dari(SEMUA_BIASA, "P"), dari(["sekretariat"], "U")) },
  { modul: "arsip", judul: "Arsip Surat", keterangan: "Arsip surat dinas.", hak: dari(SEMUA_BIASA, "L") },
  { modul: "statistik", judul: "Statistik", keterangan: "Statistik surat dan disposisi.", hak: dari(SEMUA_BIASA, "L") },
  { modul: "disposisi", judul: "Disposisi Digital", keterangan: "Meneruskan dan menyelesaikan disposisi.", hak: dari(SEMUA_BIASA, "P") },
  { modul: "search", judul: "Pencarian Global", keterangan: "Mencari surat dan disposisi yang boleh dilihat pegawai.", hak: dari(SEMUA_BIASA, "L") },
  {
    modul: "laporan",
    judul: "Laporan",
    keterangan: "Laporan ringkas surat bagi pimpinan.",
    hak: dari(["pimpinan"], "L"),
  },
  {
    modul: "kepegawaian",
    judul: "Menu E-Kepegawaian (cuti, presensi, SKP pribadi)",
    keterangan: "Pegawai mengurus data kepegawaiannya sendiri; kesekretariatan mengelola dan menyetujui.",
    hak: gabung(dari(SEMUA_BIASA, "P"), dari(["sekretariat"], "U")),
  },
];

function butirMenuPortal(): ButirPeta[] {
  return MENU_PORTAL.map((m) =>
    buat({
      id: `menu.${m.modul}`,
      kelompok: "portal",
      judul: m.judul,
      keterangan: m.keterangan,
      hak: m.hak,
      admin: m.admin,
      catatan: m.catatan,
      sumber: `modules.${m.modul}`,
    })
  );
}

// ─── 3. ALETA e-Court: tab dan aksi ──────────────────────────────────────────

const LABEL_TAB_ECOURT: Record<string, string> = {
  dasbor: "Beranda e-Court",
  sidang: "Jadwal Sidang",
  mediasi: "Jadwal Mediasi",
  status: "Status Perkara",
  berkas: "Kendali Berkas",
  riwayat: "Riwayat ALETA",
  ttd: "Tanda tangan dan cap pejabat",
  ekstensi: "Unduh ekstensi",
};

function butirTabEcourt(): ButirPeta[] {
  return (Object.entries(TAB_ECOURT) as Array<[string, (typeof TAB_ECOURT)[keyof typeof TAB_ECOURT]]>).map(([kunci, a]) => {
    const golongan = a.golongan === "semua" ? SEMUA_BIASA : (a.golongan as readonly GolonganPeran[]);
    return buat({
      id: `tab.${kunci}`,
      kelompok: "ecourt",
      judul: `Tab ${LABEL_TAB_ECOURT[kunci] ?? kunci}`,
      keterangan: a.alasan,
      hak: dari(golongan, "L"),
      sumber: `TAB_ECOURT.${kunci}`,
    });
  });
}

const tingkatAksi = (crud: string): TingkatPeta => (crud === "R" ? "L" : crud === "C" ? "P" : "U");

/** Aksi baca-saja yang bagi pemakainya berarti "menjalankan" (mencetak), bukan sekadar melihat. */
const TINGKAT_AKSI_KHUSUS: Readonly<Record<string, TingkatPeta>> = { "sidang.cetak-relaas": "P" };

function butirAksi(): ButirPeta[] {
  return (Object.entries(AKSI) as Array<[string, (typeof AKSI)[keyof typeof AKSI]]>).map(([kunci, a]) => {
    const t = TINGKAT_AKSI_KHUSUS[kunci] ?? tingkatAksi(a.crud);
    return buat({
      maks: t,
      id: `aksi.${kunci}`,
      kelompok: "ecourt",
      judul: a.label,
      keterangan: a.alasan,
      hak: dari(a.golongan, t),
      // Penjaga bolehAksi: Admin selalu boleh kecuali golongannya dikosongkan khusus (pengaturan satker).
      admin: t,
      catatan: a.lingkup === "milik" ? "Hanya atas perkara yang ia tangani (majelis, PP, atau juru sitanya); Ketua, Wakil, dan Admin semua perkara." : undefined,
      sumber: `AKSI.${kunci}`,
      rute: a.rute,
    });
  });
}

// ─── 4. Fitur kerja perkara yang kuncinya hidup di tempat lain ───────────────

const PERSIDANGAN: GolonganPeran[] = ["pimpinan", "hakim", "panitera", "panmud", "pp"];
const PEMEGANG_PERKARA: GolonganPeran[] = ["pimpinan", "hakim", "panitera", "panmud", "pp", "jurusita", "analis-perkara"];

/** Penanda SIPP (gelombang 1): label dibaca pegawai, kode tetap. */
const LABEL_PENANDA: Record<KodeIdeL2, string> = {
  sita: "Penanda: ada sita",
  eksekusi: "Penanda: ada permohonan eksekusi",
  "izin-cerai": "Penanda: perlu izin atasan (pihak PNS, TNI/Polri)",
  "penetapan-awal": "Penanda: penetapan awal belum lengkap (PMH, PPP, PJS, PHS)",
  "belum-ditunda": "Penanda: sidang lewat tanpa penundaan tercatat",
  "potensi-verstek": "Penanda: berpotensi putusan verstek",
  "umur-perkara": "Penanda: umur perkara mendekati batas",
  "tanpa-sidang-berikut": "Penanda: belum ada sidang berikutnya",
  "sisa-ikrar": "Penanda: sisa waktu ikrar talak",
  "akta-cerai": "Penanda: akta cerai dan BHT verstek",
  "lewat-5-bulan": "Penanda: perkara lewat 5 bulan",
  "ecourt-verifikasi": "Penanda: dokumen e-Court belum diverifikasi",
  "putusan-ecourt": "Penanda: putusan belum diunggah / belum TTE panitera di e-Court",
};

/** Golongan popup ekstensi (lib/golongan-popup.ts) -> golongan matriks. Panitera popup memuat Panmud. */
const POPUP_KE_MATRIKS: Record<string, GolonganPeran[]> = {
  ketua: ["pimpinan"],
  hakim: ["hakim"],
  "panitera-pengganti": ["pp"],
  "juru-sita": ["jurusita"],
  panitera: ["panitera", "panmud"],
  kasir: ["kasir"],
  ptsp: ["ptsp"],
  mediator: ["mediator"],
  operator: ["petugas-sidang", "ti"],
  umum: ["analis-perkara", "sekretariat", "pelaksana"],
};

function butirPenanda(): ButirPeta[] {
  return KODE_IDE_L2.map((kode) => {
    const golongan = (PERAN_IDE_L2[kode] as readonly string[]).flatMap((p) => POPUP_KE_MATRIKS[p] ?? []);
    return buat({
      id: `penanda.${kode}`,
      kelompok: "ekstensi",
      judul: LABEL_PENANDA[kode],
      keterangan: "Penanda kecil di daftar dan halaman perkara SIPP. Tiap pegawai juga punya saklar sendiri di popup ekstensi.",
      hak: dari(Array.from(new Set(golongan)), "L"),
      sumber: `PERAN_IDE_L2.${kode}`,
    });
  });
}

/** Saklar popup/widget per golongan (PROFIL_GOLONGAN.relevan di popup.js). */
export type SaklarPopup = "tandaiHalaman" | "sisipJadwal" | "cetakTigaBerkas" | "suntingLangsungAbt" | "checklistMilestone";
export const SAKLAR_POPUP_RELEVAN: Readonly<Record<string, readonly SaklarPopup[]>> = {
  ketua: ["tandaiHalaman", "sisipJadwal", "cetakTigaBerkas", "suntingLangsungAbt", "checklistMilestone"],
  hakim: ["tandaiHalaman", "sisipJadwal", "cetakTigaBerkas", "suntingLangsungAbt", "checklistMilestone"],
  "panitera-pengganti": ["tandaiHalaman", "sisipJadwal", "cetakTigaBerkas", "suntingLangsungAbt", "checklistMilestone"],
  "juru-sita": ["tandaiHalaman", "checklistMilestone"],
  panitera: ["tandaiHalaman", "sisipJadwal", "checklistMilestone"],
  kasir: ["checklistMilestone"],
  ptsp: ["tandaiHalaman", "checklistMilestone"],
  mediator: ["tandaiHalaman", "sisipJadwal", "checklistMilestone"],
  operator: ["tandaiHalaman", "checklistMilestone"],
  umum: ["tandaiHalaman", "checklistMilestone"],
};

const LABEL_SAKLAR_POPUP: Record<SaklarPopup, { judul: string; keterangan: string }> = {
  tandaiHalaman: { judul: "Popup: tandai halaman SIPP", keterangan: "Penanda di bawah nomor perkara pada daftar dan halaman perkara." },
  sisipJadwal: { judul: "Popup: sisipkan berkas ke Jadwal Sidang", keterangan: "Menaruh jawaban, replik, dan duplik di baris sidangnya." },
  cetakTigaBerkas: { judul: "Popup: cetak tiga berkas dari ABT", keterangan: "Satu tekanan Cetak menerbitkan putusan, PDF, dan anonim." },
  suntingLangsungAbt: { judul: "Popup: sunting langsung tabel ABT", keterangan: "Klik dua kali pada sel tabel ABT." },
  checklistMilestone: { judul: "Widget: checklist pekerjaan penting", keterangan: "Widget di kiri bawah dengan tombol Kerjakan." },
};

function butirSaklarPopup(): ButirPeta[] {
  return (Object.keys(LABEL_SAKLAR_POPUP) as SaklarPopup[]).map((saklar) => {
    const golongan: GolonganPeran[] = [];
    for (const [popup, relevan] of Object.entries(SAKLAR_POPUP_RELEVAN)) {
      if (relevan.includes(saklar)) golongan.push(...(POPUP_KE_MATRIKS[popup] ?? []));
    }
    return buat({
      id: `popup.${saklar}`,
      kelompok: "ekstensi",
      judul: LABEL_SAKLAR_POPUP[saklar].judul,
      keterangan: LABEL_SAKLAR_POPUP[saklar].keterangan,
      hak: dari(Array.from(new Set(golongan)), "P"),
      sumber: `PROFIL_GOLONGAN.relevan.${saklar}`,
    });
  });
}

const BUTIR_FITUR: readonly ButirPeta[] = [
  buat({
    id: "fitur.bas-acc",
    kelompok: "fitur",
    judul: "Acc berita acara sidang (BAS)",
    keterangan: "BAS yang disusun panitera sidang di-acc atau dikembalikan hakim sebelum dipakai.",
    hak: dari(["pimpinan", "hakim"], "U"),
    admin: false,
    catatan:
      "Pemeriksaan oleh orang lain: panitera tidak meng-acc BAS-nya sendiri, dan Admin tidak meng-acc. Super Admin ikut (keputusan 18 Okt 2026) karena akunnya dipegang seorang hakim.",
    sumber: "bas-acc.bolehMengaccPeran",
    rute: ["POST /api/aleta-ecourt/bas/acc"],
  }),
  buat({
    id: "fitur.unggah-massal-putusan",
    kelompok: "fitur",
    judul: "Unggah massal putusan dan putusan anonim ke e-Doc SIPP",
    keterangan: "Hakim mengunggah putusan majelisnya; Ketua/Wakil dan Admin semua putusan.",
    hak: dari(["pimpinan", "hakim"], "U"),
    catatan: "Keputusan 9 Okt 2026: unggah putusan hanya Super Admin, Admin, dan hakim. Hakim hanya putusan perkara majelisnya.",
    sumber: "hakUnggahMassal.putusan",
    rute: ["GET /api/aleta-ecourt/unggah-massal", "POST /api/aleta-ecourt/unggah-massal/jejak"],
  }),
  buat({
    id: "fitur.unggah-massal-bas",
    kelompok: "fitur",
    judul: "Unggah massal BAS ke e-Doc SIPP",
    keterangan: "Panitera Pengganti mengunggah BAS sidangnya; panitera, panmud, dan analis perkara semua BAS.",
    hak: dari(["panitera", "panmud", "pp", "analis-perkara"], "U"),
    sumber: "hakUnggahMassal.bas",
    rute: ["GET /api/aleta-ecourt/unggah-massal", "POST /api/aleta-ecourt/bas/unggah-sipp"],
  }),
  buat({
    id: "fitur.putusan-advance",
    kelompok: "fitur",
    judul: "Putusan Advance (periksa dan susun draf putusan utuh)",
    keterangan: "Hakim dan konseptor perkara itu (ditunjuk di ALETA atau tercatat di SIPP).",
    hak: dari(["pimpinan", "hakim"], "P"),
    catatan:
      "Konseptor (biasanya Panitera Pengganti) ikut untuk perkara yang ia konsep. Daftar akun yang memakainya diatur Super Admin di Pengaturan SIPP & ABT; saklar fitur satker harus menyala. Draf hanya diunduh ke komputer sendiri.",
    sumber: "hakPutusanAdvance",
    rute: ["GET|POST /api/aleta-ecourt/putusan/advance"],
  }),
  buat({
    id: "fitur.draf-h7",
    kelompok: "fitur",
    judul: "Draf putusan H-7 (isi lengkap)",
    keterangan: "Draf tiap pagi untuk sidang 7 hari ke depan. Lencana kesiapan terlihat di Jadwal Sidang dan widget; isi lengkap hanya penyusun draf putusan.",
    hak: dari(PERSIDANGAN, "P"),
    catatan: "Isi lengkap ikut aksi 'Simpan draf putusan' (18 Okt 2026: juru sita tidak lagi dapat membaca isi draf).",
    sumber: "AKSI.putusan.draf",
    rute: ["GET /api/aleta-ecourt/agen-h7"],
  }),
  buat({
    id: "fitur.susun-saksi",
    kelompok: "fitur",
    judul: "Susun keterangan saksi menurut keadaan perkara (panel ABT)",
    keterangan: "Tombol Susun saksi di tanya jawab ABT dan di tab Keterangan anak, calon, dan orang tua (dispensasi kawin).",
    hak: dari(["panitera", "panmud", "pp", "analis-perkara"], "P"),
    catatan:
      "Menu panel ABT 'Susun keterangan saksi' hanya golongan kepaniteraan; hakim memakai Panduan pertanyaan saksi (baca). Katalog pertanyaannya dijaga aksi 'Set pertanyaan saksi'.",
    sumber: "ALAT_MENU_PERAN.abt.perkara.susun-saksi",
  }),
  buat({
    id: "fitur.blangko-saya-saklar",
    kelompok: "fitur",
    judul: "Blangko Saya: pemakai selama tahap awal",
    keterangan: "Selama saklar Fitur Satker 'Blangko Saya untuk semua peran' mati, hanya Super Admin yang memakai Blangko Saya.",
    hak: dari(["pimpinan", "hakim", "panitera", "panmud", "pp"], "U"),
    catatan:
      `Tahap awal (keputusan 18 Okt 2026): ubin, menu, dan rute tertutup bagi selain Super Admin. Hak di kolom ini berlaku setelah Super Admin menyalakan saklar (status bawaan: ${LABEL_STATUS_FITUR.mati}). Admin juga baru bisa setelah saklar menyala.`,
    admin: "U",
    sumber: "FITUR_BLANGKO_SAYA_SEMUA_PERAN",
  }),
  buat({
    id: "fitur.penetapan-penunjukan",
    kelompok: "fitur",
    judul: "Penetapan PMH, PPP, PJS, dan PHS di panel SIPP",
    keterangan: "Menjalankan penetapan majelis, penunjukan PP dan JS, serta hari sidang dari panel SIPP, satu per satu atau massal.",
    hak: gabung(dari(["pimpinan"], "U"), dari(["ptsp"], "P")),
    catatan:
      "Keputusan 111 (18 Okt 2026): yang boleh MENJALANKAN adalah Ketua, Wakil Ketua, Admin, Super Admin, dan pengguna dengan sub-peran Operator, Petugas Meja (Meja 1, 2, 3, informasi), atau PTSP. Hakim dan Panitera tidak mendapat tab sendiri. Sub-peran disimpan di akun (peran utama tidak berubah); Petugas Meja 2 dan 3 dikenali dari sub-perannya, bukan dari golongannya, sehingga analis perkara tanpa sub-peran itu tidak. Pencatatan di SIPP tetap atas akun pejabat pilihan (keputusan 13 Okt), bukan akun penekan tombol. Tombol otomatis tetap ikut pengaturan Admin, tetapi hanya untuk yang memenuhi syarat itu.",
    sumber: "kapabilitas.penunjukan / penunjukan-otomatis",
    rute: ["POST /api/aleta-ecourt/penetapan-edoc/unggah", "GET /api/aleta-ecourt/penetapan-edoc/peta"],
  }),
  buat({
    id: "fitur.ikrar-talak",
    kelompok: "fitur",
    judul: "Ikrar talak: tunda, putus, isi form, dan e-Doc penetapan",
    keterangan: "Tombol tunda ikrar dan 'ikrar dilaksanakan' di Jadwal Sidang; form ikrar SIPP terisi dan penetapan terunggah atas akun ketua majelis ikrar.",
    hak: dari(PERSIDANGAN, "U"),
    catatan: "Mengikuti aksi 'Tunda / Putus sidang'. Penyimpanan form saat halaman dibuka mengikuti saklar Penunjukan otomatis (bawaan mati).",
    sumber: "AKSI.sidang.tunda-putus",
    rute: ["POST /api/aleta-ecourt/sidang-ikrar-isi", "GET /api/aleta-ecourt/ikrar-borang"],
  }),
  buat({
    id: "fitur.skp-sendiri",
    kelompok: "fitur",
    judul: "SKP: melihat dan mengisi SKP sendiri",
    keterangan: "Tiap pegawai melihat SKP-nya sendiri (hakim, pimpinan, atau jabatan perkara) dan mengisi isian manualnya.",
    hak: dari(SEMUA_BIASA, "P"),
    sumber: "bolehLihatSkp.sendiri",
    rute: ["/api/skp/*"],
  }),
  buat({
    id: "fitur.skp-bawahan",
    kelompok: "fitur",
    judul: "SKP: melihat SKP bawahan dan seluruh pegawai",
    keterangan: "Atasan langsung melihat bawahannya; Ketua, Wakil Ketua, dan Panitera melihat semua pegawai (hanya lihat); Admin semua.",
    hak: dari(["pimpinan", "panitera"], "L"),
    catatan: "Atasan langsung (dari data kepegawaian) dapat melihat bawahannya walau golongannya tidak tercantum di kolom ini.",
    sumber: "bolehLihatSkp",
  }),
  buat({
    id: "fitur.skp-target",
    kelompok: "fitur",
    judul: "SKP: mengubah target dan pemetaan akun-pegawai-jabatan",
    keterangan: "Target tahunan dan pemetaan akun SKP.",
    hak: dari(["pimpinan", "panitera"], "U"),
    catatan: "Ketua mengubah; Wakil Ketua hanya melihat. Pemilik tidak menyetujui isiannya sendiri.",
    sumber: "bolehUbahTargetSkp",
  }),
  buat({
    id: "fitur.skp-tinjau",
    kelompok: "fitur",
    judul: "SKP: menyetujui isian manual dan mengunci penetapan",
    keterangan: "Atasan langsung, Ketua, Panitera, dan Admin; tidak pernah pemiliknya sendiri.",
    hak: dari(["pimpinan", "panitera"], "U"),
    catatan: "Ketua menyetujui; Wakil Ketua hanya bila ia atasan langsungnya.",
    sumber: "bolehTinjauSkp",
  }),
  buat({
    id: "fitur.eviden-skp",
    kelompok: "fitur",
    judul: "Eviden SKP hakim, PP, juru sita, dan mediator (unduhan)",
    keterangan: "Dokumen eviden SKP dari SIPP per bulan, triwulan, dan tahun.",
    hak: dari(SEMUA_BIASA, "L"),
    catatan:
      "BELUM DIBATASI per orang: unduhan lama ini terbuka bagi semua pegawai berpanel. SKP jabatan di menu SKP sudah memakai hak sendiri, atasan, dan pimpinan. Menunggu keputusan pengguna.",
    sumber: "eviden-skp (panel)",
    rute: ["GET /api/aleta-ecourt/eviden-skp"],
  }),
  buat({
    id: "fitur.sesi-ecourt-saya",
    kelompok: "fitur",
    judul: "Sesi e-Court saya (sambungkan akun e-Court sendiri)",
    keterangan: "Tiap pengguna menyambungkan sesi e-Court akunnya untuk verifikasi, TTE, dan unggah salinan putusan.",
    hak: dari(SEMUA_BIASA, "P"),
    sumber: "EcourtSesiPribadi",
  }),
  buat({
    id: "fitur.sesi-ecourt-semua",
    kelompok: "fitur",
    judul: "Sesi e-Court semua akun dan riwayat login WhatsApp",
    keterangan: "Daftar sesi e-Court seluruh akun dan riwayat login lewat WhatsApp (captcha).",
    hak: { "super-admin": "U" },
    admin: "L",
    catatan: "Keputusan 18 Okt 2026: riwayat login WhatsApp hanya Super Admin dan Admin.",
    sumber: "ecourt-sesi/rekap",
    rute: ["GET /api/aleta-ecourt/ecourt-sesi/rekap"],
  }),
  buat({
    id: "fitur.lihat-sebagai",
    kelompok: "fitur",
    judul: "Lihat sebagai peran atau akun lain",
    keterangan: "Meniru tampilan dan hak peran/akun lain untuk memeriksa menu yang tidak muncul.",
    hak: { "super-admin": "U" },
    admin: false,
    sumber: "alatPeranAktif / Lihat sebagai",
  }),
  buat({
    id: "fitur.tautan-akun-sipp",
    kelompok: "fitur",
    judul: "Tautan akun ALETA ke akun SIPP",
    keterangan: "Menautkan akun ALETA ke akun SIPP; peran UTAMA ditentukan pengguna sendiri, alat hanya memetakan sub-peran.",
    hak: { "super-admin": "U" },
    admin: "U",
    catatan: "Keputusan 14 Okt 2026: alat tidak pernah mengubah peran utama; akun baru memulai dari peran terendah.",
    sumber: "users/tautan-sipp",
    rute: ["POST /api/users/[id]/tautan-sipp", "POST /api/users/tautan-sipp-semua"],
  }),
  // ── Audit hak 23 Okt 2026: fitur yang kuncinya hidup di luar matriks, kini tercatat di peta ──
  buat({
    id: "fitur.tombol-putusan-sipp",
    kelompok: "ekstensi",
    judul: "Tombol Putusan Otomatis dan Jadwalkan Putusan di halaman SIPP",
    keterangan: "Tombol di halaman perkara dan daftar SIPP untuk menyusun lalu mengunggah putusan, sekarang atau terjadwal.",
    hak: dari(["pimpinan", "hakim"], "P"),
    admin: "P",
    catatan:
      "Keputusan pengguna 21 Okt 2026: hanya Ketua, Wakil Ketua, Hakim, Admin, dan Super Admin. Unggahnya dijaga hak unggah putusan (keputusan 9 Okt).",
    sumber: "panel-alat.js alatBolehTombolPutusanSipp",
    rute: ["GET|POST|PATCH /api/aleta-ecourt/putusan-terjadwal"],
  }),
  buat({
    id: "fitur.tombol-penetapan-sipp",
    kelompok: "ekstensi",
    judul: "Tombol Penetapan Otomatis di halaman SIPP",
    keterangan: "Tombol di halaman perkara SIPP untuk menuliskan PMH, PPP, PJS, dan PHS.",
    hak: dari(["pimpinan", "ptsp"], "P"),
    admin: "P",
    catatan:
      "Keputusan pengguna 21 Okt 2026: hanya PTSP (termasuk Operator dan Petugas Meja), Ketua, Wakil Ketua, Admin, dan Super Admin. Tombolnya juga menuntut kemampuan Kerjakan (menulis ke SIPP) yang bawaannya hanya Operator; peran lain mendapatkannya dari Super Admin di Akses ekstensi.",
    sumber: "panel-alat.js alatBolehTombolPenetapanSipp + kapabilitas penunjukan & kerjakan",
  }),
  buat({
    id: "fitur.tunda-putus-otomatis",
    kelompok: "ecourt",
    judul: "Tunda otomatis 16.30 dan putus otomatis gugur / tidak dapat diterima",
    keterangan: "Daftar harian di kepala Jadwal Sidang; saklar, mode kering, dan Jalankan sekarang.",
    hak: gabung(dari(SEMUA_BIASA, "L"), dari(["pimpinan", "hakim", "panitera", "panmud", "pp"], "P")),
    admin: "P",
    maks: "U",
    catatan:
      "Saklar dan Jalankan sekarang HANYA Super Admin (keputusan 22 Okt 2026). Mengecualikan satu perkara (Jangan tunda/putus otomatis, Ikutkan lagi) mengikuti aksi Tunda / Putus sidang. Tidak tampil pada tautan rahasia Jadwal Sidang.",
    sumber: "bolehMenyuntingAkses + sidang.tunda-putus",
    rute: ["GET|POST /api/aleta-ecourt/tunda-otomatis", "GET|POST /api/aleta-ecourt/putus-otomatis"],
  }),
  buat({
    id: "fitur.tes-putusan",
    kelompok: "blangko",
    judul: "Tes putusan di Blangko ABT by Derry Briantono",
    keterangan: "Perkara apa pun menjadi acuan data; semua blangko tampil; hanya pratinjau dan unduh berakhiran -TES.",
    hak: {},
    admin: false,
    maks: "U",
    catatan: "Hanya Super Admin. Selama mode tes tidak ada yang ditulis ke ABT, SIPP, maupun e-Court (keputusan 22 Okt 2026).",
    sumber: "blangko-derry.js superAdmin() / tesAktif()",
  }),
  buat({
    id: "fitur.tautan-jadwal",
    kelompok: "ecourt",
    judul: "Tautan rahasia Jadwal Sidang (tanpa masuk akun)",
    keterangan: "Membuat dan mencabut tautan; yang membuka tautan bekerja atas akun PP/panitera yang diwakili, hanya tombol baris yang diizinkan.",
    hak: {},
    admin: "U",
    maks: "U",
    catatan:
      "Mengelola tautan hanya Super Admin dan Admin. Pemakai tautan tidak mendapat unduhan berkas, Kasir, antrean, tunda/putus otomatis, pilih hakim, maupun penetapan; tulisannya terbatas daftar izin rute dan 60 tindakan per jam.",
    sumber: "server/modules/tautan-jadwal RUTE_TAUTAN",
    rute: ["GET|POST /api/aleta-ecourt/tautan-jadwal"],
  }),
];

// ─── 5. Menu panel ekstensi (cermin ALAT_MENU_PERAN di panel-alat.js) ────────

type SitusAlat = "sipp" | "abt";
type HalamanAlat = "perkara" | "daftar";
export type TabelMenuEkstensi = Record<SitusAlat, Record<HalamanAlat, Record<string, readonly string[]>>>;

/**
 * Cermin ALAT_MENU_PERAN (ekstensi-sipp/panel-alat.js). Uji hak-akses-peta-18okt MEMBANDINGKAN cermin ini dengan
 * panel-alat.js yang dijalankan sungguhan; bila ekstensi berubah, uji merah sampai cermin ini ikut.
 */
export const MENU_EKSTENSI: TabelMenuEkstensi = {
  sipp: {
    perkara: {
      admin: ["penetapan", "ptsp", "putusan", "jurusita", "berkas", "perkara"],
      ketua: ["penetapan", "putusan", "berkas", "perkara", "ptsp"],
      hakim: ["putusan", "berkas", "perkara"],
      panitera: ["berkas", "perkara"],
      jurusita: ["jurusita", "perkara", "berkas"],
      kasir: ["kasir", "perkara"],
      ptsp: ["ptsp", "berkas", "perkara"],
      pp: ["berkas", "perkara"],
      "panitera-utama": ["berkas", "perkara", "ptsp"],
      panmud: ["berkas", "perkara", "ptsp"],
      mediator: ["perkara", "berkas"],
      analis: ["berkas", "perkara"],
      sekretariat: ["perkara"],
      "lain-tetap": ["perkara"],
    },
    daftar: {
      admin: ["penetapan-massal", "bas-massal", "relaas-pbt-massal", "putusan-massal"],
      ketua: ["penetapan-massal", "putusan-massal"],
      hakim: ["putusan-massal"],
      panitera: ["bas-massal"],
      jurusita: ["relaas-pbt-massal"],
      kasir: [],
      ptsp: ["penetapan-massal"],
      pp: ["bas-massal"],
      "panitera-utama": ["bas-massal"],
      panmud: ["bas-massal"],
      mediator: [],
      analis: ["bas-massal"],
      sekretariat: [],
      "lain-tetap": [],
    },
  },
  abt: {
    perkara: {
      admin: ["semua"],
      ketua: ["isi-input", "unggah-putusan"],
      hakim: ["isi-input", "unggah-putusan"],
      panitera: ["susun-saksi", "isi-bas"],
      jurusita: ["jurusita"],
      kasir: [],
      ptsp: ["isi-input"],
      pp: ["susun-saksi", "isi-bas"],
      "panitera-utama": ["susun-saksi", "isi-bas"],
      panmud: ["susun-saksi", "isi-bas"],
      mediator: [],
      analis: ["susun-saksi", "isi-bas"],
      sekretariat: [],
      "lain-tetap": [],
    },
    daftar: {
      admin: ["putusan-massal", "bas-massal", "relaas-pbt-massal"],
      ketua: ["putusan-massal"],
      hakim: ["putusan-massal"],
      panitera: ["bas-massal"],
      jurusita: ["relaas-pbt-massal"],
      kasir: [],
      ptsp: [],
      pp: ["bas-massal"],
      "panitera-utama": ["bas-massal"],
      panmud: ["bas-massal"],
      mediator: [],
      analis: ["bas-massal"],
      sekretariat: [],
      "lain-tetap": [],
    },
  },
};

const LABEL_MENU_EKSTENSI: Record<string, { judul: string; keterangan: string }> = {
  "sipp.perkara.penetapan": { judul: "Panel SIPP: tab Penetapan", keterangan: "Menyusun penetapan PMH, PPP, PJS, dan PHS dari halaman perkara." },
  "sipp.perkara.ptsp": { judul: "Panel SIPP: tab PTSP", keterangan: "Data Umum dari berkas gugatan, saksi dan pihak dari foto KTP, rapikan identitas pihak." },
  "sipp.perkara.putusan": { judul: "Panel SIPP: tab Putusan", keterangan: "Isi formulir Putusan Akhir dari berkas putusan dan unggah e-Doc." },
  "sipp.perkara.jurusita": { judul: "Panel SIPP: tab Juru Sita", keterangan: "Relaas dan PBT, mencentang pihak yang tidak hadir." },
  "sipp.perkara.berkas": { judul: "Panel SIPP: tab Berkas e-Court", keterangan: "Dokumen e-Court perkara, tenggat, dan selisih." },
  "sipp.perkara.perkara": { judul: "Panel SIPP: tab Perkara", keterangan: "Ringkasan perkara dan kotak penyatu SIPP-ABT-ALETA." },
  "sipp.perkara.kasir": { judul: "Panel SIPP: tab Kasir", keterangan: "Usulan jurnal keuangan perkara." },
  "sipp.daftar.penetapan-massal": { judul: "Daftar SIPP: penetapan massal", keterangan: "Menyusun penetapan banyak perkara sekaligus." },
  "sipp.daftar.bas-massal": { judul: "Daftar SIPP: BAS massal", keterangan: "Mengusulkan dan menyusun BAS banyak perkara sekaligus." },
  "sipp.daftar.relaas-pbt-massal": { judul: "Daftar SIPP: relaas dan PBT massal", keterangan: "Mencetak relaas dan PBT banyak perkara." },
  "sipp.daftar.putusan-massal": { judul: "Daftar SIPP: putusan massal", keterangan: "Mengisi dan mengunggah putusan banyak perkara." },
  "abt.perkara.isi-input": { judul: "Panel ABT: Isi dari SIPP dan input ke ABT", keterangan: "Mengisi isian blangko dari SIPP dan e-Court, lalu menyimpan ke ABT." },
  "abt.perkara.unggah-putusan": { judul: "Panel ABT: unggah putusan", keterangan: "Unggah e-Doc putusan dan anonim dari ABT." },
  "abt.perkara.susun-saksi": { judul: "Panel ABT: susun keterangan saksi", keterangan: "Tanya jawab saksi menurut keadaan perkara." },
  "abt.perkara.jurusita": { judul: "Panel ABT: relaas dan PBT", keterangan: "Blangko relaas dan PBT juru sita." },
  "abt.perkara.isi-bas": { judul: "Panel ABT: Isi dari SIPP untuk blangko BAS", keterangan: "Mengisi blangko BAS dari SIPP dan e-Court." },
  "abt.perkara.semua": { judul: "Panel ABT: seluruh bagian panel", keterangan: "Pengelola melihat semua bagian panel." },
  "abt.daftar.putusan-massal": { judul: "Beranda ABT: putusan massal", keterangan: "Putusan banyak perkara." },
  "abt.daftar.bas-massal": { judul: "Beranda ABT: BAS massal", keterangan: "BAS banyak perkara." },
  "abt.daftar.relaas-pbt-massal": { judul: "Beranda ABT: relaas dan PBT massal", keterangan: "Relaas dan PBT banyak perkara." },
};

/** Kunci tabel ekstensi untuk sebuah golongan matriks (sama dengan alatGolonganDariServer di panel-alat.js). */
function kunciTabelEkstensi(g: GolonganPeran): string {
  const e = PETA_GOLONGAN_EKSTENSI[g];
  if (e === "lain") return "lain-tetap";
  if (e === "panitera") return "panitera-utama";
  return e;
}

/**
 * Tab yang DITAMBAHKAN ekstensi di luar ALAT_MENU_PERAN: konten.js menambah tab Kasir bagi siapa pun yang
 * alatBolehKasir (kasir, panitera, panmud, admin) - sama dengan aksi Kasir di portal (sidang.kasir).
 */
const TAMBAHAN_MENU_EKSTENSI: Readonly<Record<string, readonly GolonganPeran[]>> = {
  "sipp.perkara.kasir": ["panitera", "panmud"],
  // Keputusan 111: konten.js menambahkan tab Penetapan bagi golongan PTSP (Operator, Meja 1, keluarga PTSP) bila kemampuan penunjukan ada.
  "sipp.perkara.penetapan": ["ptsp"],
};

/** Catatan khusus butir menu ekstensi. */
const CATATAN_MENU_EKSTENSI: Readonly<Record<string, string>> = {
  "sipp.perkara.penetapan": "Keputusan 111: Ketua, Wakil, Admin, PTSP, Operator, dan Petugas Meja (termasuk Meja 2 dan 3 lewat sub-peran) mendapat tab ini; hakim dan Panitera tidak.",
  "sipp.daftar.penetapan-massal": "Keputusan 111: Petugas Meja 2 dan 3 serta Operator (sub-peran) juga mendapat menu ini.",
  "abt.perkara.isi-input": "Keputusan 112: PTSP di ABT hanya mendapat menu ini (untuk blangko PTSP).",
};

function butirMenuEkstensi(): ButirPeta[] {
  const hasil: ButirPeta[] = [];
  for (const situs of ["sipp", "abt"] as const) {
    for (const halaman of ["perkara", "daftar"] as const) {
      const tabel = MENU_EKSTENSI[situs][halaman];
      const kunciMenu = new Set<string>();
      for (const daftar of Object.values(tabel)) for (const k of daftar) kunciMenu.add(k);
      for (const menu of kunciMenu) {
        const hak: HakPeta = {};
        for (const g of GOLONGAN_PERAN) {
          if (g === "super-admin" || g === "admin") continue;
          const baris = tabel[kunciTabelEkstensi(g)];
          if (baris && baris.includes(menu)) hak[g] = "P";
        }
        for (const g of TAMBAHAN_MENU_EKSTENSI[`${situs}.${halaman}.${menu}`] ?? []) hak[g] = "P";
        const label = LABEL_MENU_EKSTENSI[`${situs}.${halaman}.${menu}`];
        hasil.push(
          buat({
            id: `ekstensi.${situs}.${halaman}.${menu}`,
            kelompok: "ekstensi",
            judul: label?.judul ?? `${situs.toUpperCase()} ${halaman}: ${menu}`,
            keterangan: label?.keterangan ?? "",
            hak,
            maks: "P",
            admin: "P",
            catatan:
              CATATAN_MENU_EKSTENSI[`${situs}.${halaman}.${menu}`] ??
              (TAMBAHAN_MENU_EKSTENSI[`${situs}.${halaman}.${menu}`]
                ? "Panitera dan panmud: tab ditambahkan ekstensi sesuai aturan Kasir (hanya membaca bagi mereka)."
                : undefined),
            sumber: `ALAT_MENU_PERAN.${situs}.${halaman}.${menu}`,
          })
        );
      }
    }
  }
  return hasil;
}

// ─── 6. Blangko ──────────────────────────────────────────────────────────────

export type JenisBlangko = JenisDokumenDerry;

const BLANGKO: ReadonlyArray<{ jenis: JenisDokumenDerry; judul: string; keterangan: string; catatan: string }> = [
  {
    jenis: "put",
    judul: "Blangko putusan dan penetapan hakim (Blangko Derry, folder per jenis perkara)",
    keterangan: "Putusan, penetapan perkara permohonan, dan anonim: hakim dan Ketua/Wakil.",
    catatan: "Panitera Pengganti ikut membukanya hanya bila saklar 'Panitera Pengganti boleh blangko putusan' di Pengaturan SIPP & ABT menyala (bawaan mati).",
  },
  {
    jenis: "bas",
    judul: "Blangko BAS (pasangan '<Jenis> - BAS')",
    keterangan: "Berita acara sidang: Panitera Pengganti, panitera, panmud, dan staf kepaniteraan meja 2/3.",
    catatan: "Hakim ikut membukanya hanya bila saklar 'Hakim boleh blangko BAS' di Pengaturan SIPP & ABT menyala (bawaan mati). BAS di-acc hakim sebelum dipakai.",
  },
  {
    jenis: "rel",
    judul: "Blangko relaas (folder '98 Relaas')",
    keterangan: "Relaas panggilan dan pemberitahuan: khusus juru sita dan juru sita pengganti.",
    catatan: "Keputusan 16 Okt 2026: Panitera, PP, Ketua/Wakil, panmud, dan hakim tidak. Relaas tidak pernah terbuka lewat saklar.",
  },
  {
    jenis: "ptsp",
    judul: "Blangko PTSP (folder '99 PTSP')",
    keterangan: "Blangko layanan meja PTSP dan penetapan administratif.",
    catatan: "Mengikuti hak menu ABT (folder per jenis dan tahapan); Super Admin melewati cek proses.",
  },
];

const KODE_JENIS: Record<JenisDokumenDerry, string> = { put: "put", bas: "bas", rel: "rel", ptsp: "ptsp" };

function butirBlangko(): ButirPeta[] {
  const hasil: ButirPeta[] = BLANGKO.map((b) => {
    const hak: HakPeta = {};
    for (const g of GOLONGAN_PERAN) {
      if (g === "super-admin" || g === "admin") continue;
      if (jenisDokumenAkun({ admin: false, golongan: [g], saklar: null }).includes(b.jenis)) hak[g] = "P";
    }
    return buat({
      id: `blangko.${KODE_JENIS[b.jenis]}`,
      kelompok: "blangko",
      judul: b.judul,
      keterangan: b.keterangan,
      hak,
      admin: "P",
      catatan: b.catatan,
      sumber: `jenisDokumenAkun.${b.jenis}`,
      rute: ["GET /api/aleta-ecourt/blangko-derry"],
    });
  });
  // Blangko ABT bawaan kantor di luar folder Blangko Derry (hak menu ABT per kelompok SIPP; lihat HAK_MENU_ABT).
  const abtLama: Array<{ id: string; judul: string; keterangan: string; golongan: GolonganPeran[]; sumber: string; catatan?: string }> = [
    {
      id: "penetapan-awal",
      judul: "Blangko penetapan awal di ABT (PMH, penunjukan PP, penunjukan JS, PHS)",
      keterangan: "Menyusun penetapan awal perkara dari menu A.1 sampai A.4 di ABT.",
      golongan: ["pimpinan", "panitera", "panmud", "pp"],
      sumber: "abt_menu 2-5",
      catatan: "Ketua/Wakil selalu boleh untuk PMH dan PHS; Panitera selalu boleh untuk penunjukan PP dan JS. Penetapan yang ditulis ke SIPP mengikuti Kewenangan khusus (atas akun pejabat).",
    },
    {
      id: "ikrar-talak",
      judul: "Blangko ikrar talak (persiapan, BAS, dan penetapan)",
      keterangan: "Folder Ikrar Talak 1, 3, dan 4 pada cerai talak tahap ikrar.",
      golongan: ["hakim", "panmud", "pp"],
      sumber: "abt_menu 24, 26, 27",
    },
    {
      id: "ikrar-talak-relaas",
      judul: "Blangko relaas ikrar talak",
      keterangan: "Folder Ikrar Talak 2 (relaas ikrar).",
      golongan: ["jurusita"],
      sumber: "abt_menu 25",
    },
    {
      id: "akta-cerai",
      judul: "Blangko akta cerai (Cerai Gugat dan Cerai Talak)",
      keterangan: "Dibuka pada tahap penerbitan akta cerai.",
      golongan: ["panmud", "analis-perkara"],
      sumber: "abt_menu 20-21",
      catatan: "Panitera selalu boleh.",
    },
    {
      id: "mediasi",
      judul: "Blangko mediasi",
      keterangan: "Berita acara dan hasil mediasi di ABT.",
      golongan: ["pimpinan", "hakim", "panitera", "panmud", "pp"],
      sumber: "abt_menu 18",
      catatan: "Mediator non-hakim tidak punya akun ABT: hasil mediasi dibuat dari ALETA e-Court.",
    },
    {
      id: "kuasa-insidentil",
      judul: "Blangko surat kuasa insidentil",
      keterangan: "Dibuka pada tahap pendaftaran sampai persidangan.",
      golongan: ["panmud", "pp"],
      sumber: "abt_menu 7",
    },
    {
      id: "ecourt",
      judul: "Blangko e-Court",
      keterangan: "Blangko terkait e-Court (panggilan elektronik, pemberitahuan).",
      golongan: ["hakim", "panmud", "pp", "jurusita"],
      sumber: "abt_menu 22",
    },
  ];
  for (const b of abtLama) {
    hasil.push(
      buat({
        id: `blangko.${b.id}`,
        kelompok: "blangko",
        judul: b.judul,
        keterangan: b.keterangan,
        hak: dari(b.golongan, "P"),
        maks: "P",
        admin: "P",
        catatan: b.catatan,
        sumber: b.sumber,
      })
    );
  }
  hasil.push(
    buat({
      id: "blangko.saya",
      kelompok: "blangko",
      judul: "Blangko Saya (blangko pribadi, putusan mandiri, ajukan paket ABT)",
      keterangan: "Hakim, panitera/panmud, dan konseptor menyunting atau mengunggah blangko sendiri; milik pembuatnya.",
      hak: dari(["pimpinan", "hakim", "panitera", "panmud", "pp"], "U"),
      admin: "U",
      catatan:
        "Tahap awal: hanya Super Admin sampai saklar 'Blangko Saya untuk semua peran' dinyalakan. Pemilik saja yang mengubah; Super Admin melihat, memutus paket ABT, dan menghapus. Hanya Blangko Derry yang dipakai di ABT.",
      sumber: "blangko-saya",
    }),
    buat({
      id: "blangko.mandiri-admin",
      kelompok: "blangko",
      judul: "Pengelolaan blangko mandiri ALETA (kamus, korpus, templat)",
      keterangan: "Mengelola blangko mandiri satker, kamus deteksi, dan pustaka putusan.",
      hak: { "super-admin": "U" },
      admin: "U",
      sumber: "admin/blangko-mandiri",
    }),
    buat({
      id: "blangko.pengaturan-sipp-abt",
      kelompok: "blangko",
      judul: "Pengaturan SIPP & ABT: hak menu folder, variabel, blangko tanya jawab, identitas satker",
      keterangan: "Mengatur siapa membuka folder Blangko Derry, variabel, isian bawaan, dan identitas satker yang diterapkan ke ABT.",
      hak: { "super-admin": "U" },
      admin: "P",
      catatan:
        "Admin membuka, mengubah isian bawaan dan templat; hak menu folder, saklar kebijakan, dan kueri variabel hanya Super Admin.",
      sumber: "hakPengaturanAbt",
      rute: ["/api/pengaturan-sipp-abt"],
    })
  );
  return hasil;
}

// ─── 7. Pengaturan dan pengelolaan ───────────────────────────────────────────

type Pengaturan = { id: string; modul?: string[]; judul: string; keterangan: string; superAdmin?: boolean; admin?: TingkatPeta | false; catatan?: string };

const PENGATURAN: readonly Pengaturan[] = [
  { id: "pusat-kendali", modul: ["admin-hub"], judul: "Pusat Kendali", keterangan: "Pintu semua pengaturan dan pengelolaan." },
  { id: "akun", modul: ["mapping-user-jabatan"], judul: "Manajemen Akun (pengguna, jabatan, peran tambahan, tautan SIPP)", keterangan: "Membuat dan mengatur akun; peran utama ditentukan pengelola." },
  { id: "akses-menu", modul: ["visibility-role"], judul: "Akses Menu per peran", keterangan: "Membuka atau menutup aplikasi dan menu per peran.", superAdmin: true },
  {
    id: "hak-akses",
    modul: ["hak-akses"],
    judul: "Hak akses per peran (halaman ini)",
    keterangan: "Peta lengkap siapa boleh apa: fitur, blangko, dan kewenangan khusus.",
    admin: "L",
    catatan: "Super Admin melihat juga kunci, rute, dan daftar perubahan; Admin hanya membaca tabelnya.",
  },
  { id: "identitas", modul: ["identity"], judul: "Identitas Instansi", keterangan: "Nama, alamat, dan logo satker." },
  { id: "panel", modul: ["panel-settings"], judul: "Pengaturan Panel", keterangan: "Pengaturan tampilan panel portal." },
  { id: "akses-publik", modul: ["public-access"], judul: "Akses Publik dan layar antrian", keterangan: "Alamat publik portal dan ruas layar antrian yang tampil tanpa masuk." },
  { id: "whatsapp", modul: ["whatsapp-settings"], judul: "Status WhatsApp", keterangan: "Sambungan WhatsApp portal." },
  { id: "masukan", modul: ["feedback"], judul: "Masukan Pengguna (kotak masuk pengelola)", keterangan: "Membaca dan menindaklanjuti masukan pegawai." },
  { id: "pembaruan", modul: ["system-updates"], judul: "Pembaruan Sistem", keterangan: "Admin melihat status; unggah dan arsip paket hanya Super Admin.", admin: "L" },
  { id: "backup", modul: ["backup-system"], judul: "Backup Sistem", keterangan: "Cadangan basis data." },
  { id: "sumber-daya", modul: ["server-resources"], judul: "Sumber Daya Server", keterangan: "Pemakaian disk, memori, dan layanan." },
  { id: "sinkron-cadangan", judul: "Sinkron dan cadangan", keterangan: "Admin melihat; hanya Super Admin yang mengubah, menjalankan, menyambungkan Drive, dan membuat token laptop.", admin: "L" },
  { id: "sinkron-kembaran", judul: "Sinkron kembaran (mode laptop saat server mati)", keterangan: "Mengirim tulisan yang tertahan ke server setelah pemeriksaan bentrok dan persetujuan.", superAdmin: true, catatan: "Persetujuan pengiriman ke server hanya Super Admin." },
  { id: "fitur-satker", modul: ["fitur-satker"], judul: "Fitur Satker (stabil, uji coba, mati per fitur)", keterangan: "Status fitur per satker dan saluran pembaruan.", superAdmin: true },
  { id: "integrasi-ecourt", modul: ["aleta-ecourt-admin"], judul: "Integrasi e-Court (akun, akses ekstensi, penarikan)", keterangan: "Akun e-Court satker, kemampuan ekstensi per peran, saklar penarikan.", catatan: "Mengubah kemampuan ekstensi per peran hanya Super Admin; Admin membaca matriksnya. Pegawai lain hanya melihat kartu Sesi e-Court saya." },
  {
    id: "pengaturan-sipp-abt",
    modul: ["pengaturan-sipp-abt"],
    judul: "Pengaturan SIPP & ABT (menu pengelola)",
    keterangan: "Pintu pengaturan hak menu folder, variabel, blangko tanya jawab, dan identitas satker untuk ABT.",
    catatan: "Pembagian rincian Super Admin dan Admin ada di butir Blangko: Pengaturan SIPP & ABT.",
  },
  { id: "bot", modul: ["aleta-bot"], judul: "ALETA Bot (WhatsApp, antrian pesan, tindakan)", keterangan: "Pengelolaan bot dan antrian pesan." },
  { id: "bot-notifikasi", modul: ["notifikasi-wa"], judul: "Notifikasi WA", keterangan: "Pengaturan pemberitahuan WhatsApp." },
  { id: "kepegawaian-pengaturan", modul: ["hr-settings"], judul: "Pengaturan E-Kepegawaian", keterangan: "Aturan cuti dan impor data pegawai." },
  { id: "sipp-pengaturan", modul: ["aleta-sipp-settings"], judul: "Pengaturan ALETA x SIPP", keterangan: "Kamus SIPP, query registry, dan penilaian (alat pengembang).", catatan: "Aplikasi ALETA x SIPP belum dibuka untuk peran lain." },
  { id: "judicia-pengaturan", modul: ["judicia-legal-form-settings"], judul: "Pengaturan ALETA Judicia", keterangan: "Templat dan pengaturan Judicia.", superAdmin: true },
  { id: "ai", modul: ["ai-settings"], judul: "Pengaturan AI ALETA", keterangan: "Penyedia dan pagu AI.", superAdmin: true },
  { id: "asisten-hakim-pengaturan", modul: ["assistant-judge-settings"], judul: "Pengaturan Asisten Hakim", keterangan: "Mengaktifkan Asisten Hakim dan daftar izinnya.", superAdmin: true },
  { id: "audit", modul: ["audit"], judul: "Audit Trail (jejak seluruh perubahan)", keterangan: "Jejak perubahan sistem.", superAdmin: true },
  { id: "database", modul: ["database-viewer"], judul: "Database (penampil)", keterangan: "Melihat isi basis data ALETA.", superAdmin: true },
  { id: "e-status-pengaturan", modul: ["e-status-settings"], judul: "Pengaturan E-Status", keterangan: "Pengaturan E-Status (aplikasi belum dibuka untuk peran lain).", superAdmin: true },
  { id: "keuangan-aset", modul: ["keuangan", "aset"], judul: "Keuangan dan Aset (kerangka)", keterangan: "Belum ada isi.", superAdmin: true },
];

function butirPengaturan(): ButirPeta[] {
  return PENGATURAN.map((p) =>
    buat({
      id: `pengaturan.${p.id}`,
      kelompok: "pengaturan",
      judul: p.judul,
      keterangan: p.keterangan,
      hak: { "super-admin": "U" },
      admin: p.superAdmin ? false : (p.admin ?? "U"),
      catatan: p.catatan,
      sumber: p.modul ? `modules.${p.modul.join(",")}` : undefined,
    })
  );
}

/** Id modul portal yang ditutup oleh butir pengaturan / menu / aplikasi pemilik - dipakai uji kelengkapan. */
export function modulTercakup(): Set<string> {
  const s = new Set<string>(Object.keys(MODUL_MILIK_APLIKASI));
  // Menu samping yang berbagi id dengan aplikasinya (mis. ALETA e-Court) tercakup oleh butir aplikasinya.
  for (const a of ATURAN_APLIKASI) s.add(a.id);
  for (const m of MENU_PORTAL) s.add(m.modul);
  for (const p of PENGATURAN) for (const m of p.modul ?? []) s.add(m);
  return s;
}

// ─── Susunan peta ────────────────────────────────────────────────────────────

let singgah: ButirPeta[] | null = null;

/** Seluruh butir peta, urut kelompok. Dibangun sekali (data murni). */
export function susunPetaHakAkses(): readonly ButirPeta[] {
  if (singgah) return singgah;
  const semua = [
    ...butirMenuPortal(),
    ...butirAplikasi(),
    ...butirTabEcourt(),
    ...butirAksi(),
    ...BUTIR_FITUR,
    ...butirMenuEkstensi(),
    ...butirPenanda(),
    ...butirSaklarPopup(),
    ...butirBlangko(),
    ...butirPengaturan(),
  ];
  const urut = (k: KelompokPeta) => URUTAN_KELOMPOK.indexOf(k);
  singgah = semua
    .map((b, i) => ({ b, i }))
    .sort((x, y) => urut(x.b.kelompok) - urut(y.b.kelompok) || x.i - y.i)
    .map((x) => x.b);
  return singgah;
}

/** Tingkat hak sebuah golongan atas sebuah butir: "-" bila tidak diberi. */
export function tingkatButir(butir: ButirPeta, golongan: GolonganPeran): TingkatPeta | "-" {
  return butir.hak[golongan] ?? "-";
}

/** Butir yang tampil bagi sebuah golongan (hak tidak kosong). */
export function butirUntukGolongan(golongan: GolonganPeran): ButirPeta[] {
  return susunPetaHakAkses().filter((b) => Boolean(b.hak[golongan]));
}

/** Peta untuk dikirim ke layar: Admin tanpa kunci/rute teknis, Super Admin lengkap. */
export function petaUntukPembaca(teknis: boolean): ButirPeta[] {
  return susunPetaHakAkses().map((b) => (teknis ? b : { ...b, sumber: undefined, rute: undefined }));
}

// ─── Daftar perubahan 18 Okt 2026 ────────────────────────────────────────────

export type PerubahanHak = { judul: string; sebelum: string; sesudah: string; alasan: string; keputusan?: "baru" | "tegas" };

export const PERUBAHAN_18OKT: readonly PerubahanHak[] = [
  {
    judul: "Data pribadi pihak lewat panel (kontak e-Court, tanggal KTP, pekerjaan, kuasa, isi gugatan, pindai KTP saksi)",
    sebelum: "Semua pegawai berpanel (hampir semua peran) dapat memanggil rutenya.",
    sesudah: "Hanya pemegang perkara (Ketua/Wakil, hakim, panitera, panmud, PP, juru sita, analis perkara), kasir, PTSP, dan mediator; Admin dan Super Admin.",
    alasan: "Sama dengan aksi 'Identitas dan riwayat para pihak' yang sudah ada: data pribadi (UU PDP) hanya untuk yang melayani perkara.",
    keputusan: "baru",
  },
  {
    judul: "Lembar BAS, naskah, blangko, tanya jawab, dan pemeriksaannya",
    sebelum: "Dapat dibaca dan disimpan semua pegawai berpanel.",
    sesudah: "Dibaca: Ketua/Wakil, hakim, panitera, panmud, PP, analis perkara. Disimpan: hakim, panitera, panmud, PP, analis perkara.",
    alasan: "BAS memuat keterangan saksi dan para pihak; alur acc hakim hanya bermakna bila penyusunnya terbatas.",
    keputusan: "baru",
  },
  {
    judul: "Aplikasi Alat Bantu Tulis BAS: panmud dan analis perkara",
    sebelum: "Panmud dan analis perkara: Lihat.",
    sesudah: "Panmud dan analis perkara: Pakai (menulis).",
    alasan: "Keduanya sudah memegang menu Isi BAS dan BAS massal di ekstensi (keputusan 12-16 Okt); matriks diselaraskan, bukan diperluas.",
    keputusan: "baru",
  },
  {
    judul: "Acc BAS oleh Super Admin",
    sebelum: "Hanya Ketua, Wakil Ketua, dan hakim.",
    sesudah: "Ditambah Super Admin (Admin tetap tidak).",
    alasan: "Perintah pengguna: Super Admin boleh semua; akun Super Admin satker dipegang seorang hakim.",
    keputusan: "tegas",
  },
  {
    judul: "Jadwal Mediasi (data jadwal)",
    sebelum: "Tab disembunyikan dari peran tanpa urusan mediasi, tetapi rute datanya masih dapat dipanggil semua pegawai berpanel.",
    sesudah: "Rutenya ikut menolak (403) bagi golongan yang tabnya disembunyikan: hanya Ketua/Wakil, hakim, panitera, panmud, PP, mediator, PTSP, dan analis perkara.",
    alasan: "Mediasi tertutup untuk umum (PERMA 1/2016 ps. 5); menyembunyikan tab bukan penjagaan.",
    keputusan: "baru",
  },
  {
    judul: "Set pertanyaan saksi di Blangko Derry",
    sebelum: "Semua pegawai berpanel.",
    sesudah: "Ketua/Wakil, hakim, panitera, panmud, PP, analis perkara.",
    alasan: "Hanya katalog pertanyaan, tetapi hanya dipakai penyusun tanya jawab; menyamai Panduan pertanyaan saksi.",
    keputusan: "baru",
  },
  {
    judul: "Isi lengkap draf putusan H-7",
    sebelum: "Pemegang perkara termasuk juru sita.",
    sesudah: "Ketua/Wakil, hakim, panitera, panmud, PP (aksi 'Simpan draf putusan').",
    alasan: "Juru sita tidak menyusun putusan; lencana kesiapan tetap terlihat.",
    keputusan: "baru",
  },
  {
    judul: "Ubin Audit Trail",
    sebelum: "Tampil bagi Admin, tetapi halaman dan rutenya menolak Admin.",
    sesudah: "Hanya Super Admin.",
    alasan: "Menu yang pasti ditolak tidak boleh tampil. Admin tidak kehilangan akses nyata. Disetujui pengguna (keputusan 114).",
    keputusan: "tegas",
  },
  {
    judul: "Siapa menjalankan Penetapan PMH, PPP, PJS, dan PHS di panel",
    sebelum: "Kemampuan penunjukan bawaan Ketua, Wakil, hakim, dan Panitera; PTSP hanya bila diberi Admin.",
    sesudah: "Ketua, Wakil, Admin, Super Admin, dan pengguna bersub-peran Operator, Petugas Meja, atau PTSP (otomatis, tanpa diatur per peran). Hakim dan Panitera tidak mendapat tab sendiri; tab Riwayat ALETA ikut hanya untuk yang menjalankan.",
    alasan: "Keputusan 111: yang berubah hanya siapa yang menjalankan; pencatatan tetap atas akun pejabat pilihan (13 Okt).",
    keputusan: "tegas",
  },
  {
    judul: "PTSP di panel ABT",
    sebelum: "Susunan lama: seluruh panel digambar walau server menolak BAS, saksi, dan relaas.",
    sesudah: "Hanya menu 'Isi dari SIPP dan input ke ABT' (untuk blangko PTSP); tanpa menu massal.",
    alasan: "Keputusan 112: disetujui sesuai usulan.",
    keputusan: "tegas",
  },
  {
    judul: "Ubin dan menu Blangko Saya",
    sebelum: "Tampil bagi hakim, panitera, panmud, PP, Ketua/Wakil, dan Admin walau server menolak selama tahap awal.",
    sesudah: "Hanya Super Admin selama saklar Fitur Satker 'Blangko Saya untuk semua peran' mati; otomatis tampil bagi yang berhak saat saklar menyala.",
    alasan: "Keputusan 18 Okt 2026 (butir 10): tahap awal hanya Super Admin. Sekarang tampilan sama dengan haknya.",
    keputusan: "tegas",
  },
  {
    judul: "Halaman Hak akses per peran",
    sebelum: "Tidak ada; hak tersebar di kode.",
    sesudah: "Pengaturan > Hak akses per peran: Admin membaca, Super Admin lengkap dengan kunci dan daftar perubahan.",
    alasan: "Permintaan pengguna 18 Okt 2026.",
    keputusan: "tegas",
  },
];

// ─── Kewenangan khusus ───────────────────────────────────────────────────────

export const KEWENANGAN_KHUSUS: readonly { judul: string; isi: string }[] = [
  { judul: "Super Admin", isi: "Memegang dan melihat semua fitur, halaman, menu ekstensi, dan blangko. Satu-satunya yang membuka aplikasi belum fix, mengubah Akses Menu, Fitur Satker, dan hak menu ABT." },
  { judul: "Admin", isi: "Pengelola satker: semua aplikasi matang dan semua aksi e-Court; tidak membuka aplikasi belum fix, tidak meng-acc BAS, tidak memakai Lihat sebagai, tidak mengubah Fitur Satker maupun kemampuan ekstensi per peran." },
  { judul: "Unggah putusan ke SIPP dan e-Court", isi: "Hanya Super Admin, Admin, dan hakim (termasuk Ketua/Wakil). Hakim hanya putusan perkara majelisnya; Ketua, Wakil, dan Admin semua perkara (16 Okt 2026). PP, panitera, juru sita, dan lainnya tidak, walau kemampuan papan penunjukan menyala." },
  { judul: "Penetapan PMH, PPP, PJS, PHS", isi: "Atas akun pejabat yang berwenang (Ketua, Panitera, ketua majelis), tercatat sebagai penginput petugas yang menekan (keputusan 13 Okt 2026). Penetapan ikrar talak diunggah sebagai e-Doc atas akun ketua majelis ikrar (18 Okt 2026)." },
  { judul: "Acc BAS", isi: "Hakim (termasuk Ketua/Wakil) dan Super Admin; BAS disusun Panitera Pengganti. Panitera tidak meng-acc BAS-nya sendiri." },
  { judul: "Kasir", isi: "Jurnal keuangan semua perkara untuk kasir, petugas keuangan perkara, bendahara, panitera, dan panmud; panitera/panmud hanya membaca. Panitera Pengganti, hakim, dan juru sita tidak." },
  { judul: "Relaas dan PBT", isi: "Khusus juru sita dan juru sita pengganti (dan Super Admin/Admin). Panitera, PP, Ketua/Wakil, panmud, dan hakim tidak." },
  { judul: "Data pribadi para pihak (NIK, KTP, kontak, riwayat)", isi: "Hanya yang melayani perkara; NIK disamarkan, KTP 'pasti' menimpa, kesekretariatan, TI, pelaksana, dan petugas sidang tidak melihatnya (UU PDP)." },
  { judul: "Mediasi", isi: "Tertutup untuk umum (PERMA 1/2016): mediator, majelis/kepaniteraan, dan meja informasi PTSP. Hasil mediasi hanya mediator perkara itu (nama akun cocok di SIPP) atau Super Admin." },
  { judul: "Blangko Saya", isi: "Tahap awal hanya Super Admin; setelah saklar menyala: hakim, panitera/panmud, dan konseptor. Pemilik saja mengubah. Tidak ada tanda ALETA yang masuk ke SIPP maupun ABT." },
  { judul: "Hak menu ABT (folder Blangko Derry)", isi: "Per folder: perkara harus berada di tahap dan jenis yang cocok dengan folder itu; Super Admin melewati pemeriksaan tahap. Salinan database lokal hanya dibaca; perubahannya lewat paket ABT atas persetujuan." },
  { judul: "Peran utama akun", isi: "Ditentukan pengguna sendiri; alat Tautan SIPP hanya memetakan sub-peran. Meja 1 masuk golongan PTSP; Meja 2/3 masuk staf kepaniteraan (analis perkara)." },
  { judul: "Pengecualian untuk satu orang", isi: "Super Admin dapat memberi atau mencabut kemampuan ekstensi (panel, berkas, penunjukan, blangko ABT, Kerjakan) bagi SATU akun di Integrasi e-Court, lengkap dengan alasan dan masa berlaku, tanpa mengubah seluruh peran. Tanpa pengecualian, akun mengikuti perannya. Halaman ini memperlihatkan hak gabungan satu akun lewat Per akun." },
  { judul: "Mode kembaran (laptop saat server mati)", isi: "SIPP dan ABT di laptop hanya dapat dibaca; tulisan diantrekan, dikirim setelah pemeriksaan bentrok dan persetujuan Super Admin." },
];

// ─── Hal yang menunggu keputusan pengguna ────────────────────────────────────

export const KEPUTUSAN_MENUNGGU: readonly { judul: string; keadaan: string; usul: string }[] = [
  {
    judul: "Eviden SKP hakim, PP, juru sita, dan mediator (unduhan lama)",
    keadaan:
      "Unduhan lama ini terbuka bagi semua pegawai berpanel sehingga eviden SKP orang lain dapat dipanggil bila tahu nomor SIPP-nya. SKP jabatan di menu SKP sudah dibatasi (sendiri, atasan, Ketua/Wakil/Panitera, Admin).",
    usul: "Disetujui (keputusan 113): samakan dengan SKP jabatan - pemilik, atasan langsung, Ketua/Wakil, Panitera, dan Admin. Dikerjakan SETELAH pemetaan akun SIPP ke pegawai selesai (Senin); sementara belum dibatasi.",
  },
];

/** Keputusan pengguna 18 Okt 2026 malam atas usulan hak akses (nomor = daftar keputusan koordinator). */
export const KEPUTUSAN_DISETUJUI: readonly { nomor: number; judul: string; isi: string }[] = [
  { nomor: 111, judul: "Penetapan di panel", isi: "Dijalankan Ketua, Wakil, Super Admin, Admin, dan sub-peran Operator, Petugas Meja, dan PTSP. Hakim dan Panitera tidak mendapat tab sendiri. Pencatatan tetap atas akun pejabat pilihan." },
  { nomor: 112, judul: "PTSP di panel ABT", isi: "Hanya 'Isi dari SIPP dan input ke ABT'." },
  { nomor: 113, judul: "Eviden SKP unduhan lama", isi: "Dibatasi sesuai usulan, menunggu pemetaan akun SIPP ke pegawai (Senin)." },
  { nomor: 114, judul: "Audit Trail", isi: "Hanya Super Admin." },
  { nomor: 115, judul: "Acc BAS oleh Super Admin dan penulisan BAS oleh analis perkara", isi: "Tetap seperti sekarang." },
  { nomor: 116, judul: "Ringkasan perkara terbuka dan Blangko Saya untuk Admin", isi: "Tetap seperti sekarang." },
];

// ─── Hak menu ABT (folder Blangko Derry) menurut kelompok pengguna SIPP ──────

/** Nama kelompok pengguna SIPP (sys_groups) yang dipakai hak menu ABT. */
export const NAMA_GRUP_SIPP: Readonly<Record<number, string>> = {
  1: "Super Admin",
  10: "Ketua/Wakil Ketua",
  20: "Hakim",
  30: "Panitera/Wakil Panitera",
  420: "Panmud Pidana",
  430: "Panmud Hukum",
  431: "Staf Panitera Hukum",
  440: "Panmud PHI",
  500: "Panitera Pengganti",
  600: "Jurusita",
  650: "Koordinator Delegasi",
  1000: "Panmud Gugatan",
  1001: "Meja I Gugatan",
  1003: "Meja III Gugatan",
  1010: "Panmud Permohonan",
  1011: "Meja I Permohonan",
  1020: "Panmud Jinayat",
  1030: "Panmud Perkara",
  1032: "Meja I Perkara",
};

export type HakMenuAbt = {
  folder: string;
  /** Tahap SIPP (proses terakhir perkara) saat folder terbuka, "min-maks". */
  tahap: string;
  /** Kelompok SIPP yang membuka folder (Super Admin selalu, melewati cek tahap). */
  grup: readonly number[];
  /** Pemeriksa/pemberi acc (validasi BAS), bila ada. */
  validator?: readonly number[];
  catatan?: string;
};

/**
 * Ringkasan hak menu ABT dari SALINAN LOKAL XAMPP (database aps_badilag_i28, hanya SELECT, 18 Okt 2026).
 * Ini paket yang SIAP; yang berjalan di server dapat berbeda sampai paketnya dipasang. Hak diatur PER FOLDER:
 * membuka folder berarti membuka seluruh isinya. Sumber aturan: Abt.php dan Abt_model.php (cek tahap, cek jenis/alur).
 */
export const HAK_MENU_ABT: readonly HakMenuAbt[] = [
  { folder: "Putusan per jenis perkara (1 Perceraian CG, 1a CT, 2 Itsbat, 3 Dispensasi, ... 97 Sita)", tahap: "80-297", grup: [1, 10, 20], catatan: "Hakim dan Ketua/Wakil; Panitera Pengganti hanya bila saklar 'PP boleh blangko putusan' menyala." },
  { folder: "BAS per jenis perkara ('<Jenis> - BAS') dan BAS alur 01-13", tahap: "80-297 (BAS ikrar 210-297)", grup: [1, 30, 500, 430, 1000, 1010, 1020], validator: [10, 20], catatan: "Disusun kepaniteraan; Ketua/Wakil dan hakim memeriksa dan meng-acc." },
  { folder: "98 Relaas (panggilan sidang dan pemberitahuan)", tahap: "20-1000", grup: [1, 600], catatan: "Khusus juru sita (keputusan 16 Okt 2026)." },
  { folder: "99 PTSP (form bantu PTSP)", tahap: "20-1000", grup: [1, 30, 500, 430, 1000, 1010, 1020, 1032, 1001, 1011] },
  { folder: "Blangko Derry (induk, Daftar sampai Produk)", tahap: "20-1000", grup: [1, 30, 430, 500, 600, 650, 1000, 1001, 1010, 1011, 1020, 1032] },
  { folder: "Penetapan awal: PMH, Penunjukan PP, Penunjukan JS, Penetapan Hari Sidang", tahap: "20-220 (PHS 80-220)", grup: [1, 30, 500, 430, 1000, 1010, 1020, 1030, 440, 420], validator: [10], catatan: "PMH dan PHS: Ketua/Wakil selalu boleh; PP dan JS: Panitera selalu boleh." },
  { folder: "Relaas Panggilan (blangko lama)", tahap: "80-220", grup: [1, 600, 650] },
  { folder: "Kuasa Insidentil", tahap: "10-200", grup: [1, 500, 430, 1000, 1010, 1020] },
  { folder: "Mediasi", tahap: "120-230", grup: [1, 30, 500, 430, 1000, 1010, 1020], validator: [20] },
  { folder: "Ikrar talak: persiapan, BAS, dan penetapan", tahap: "290-600", grup: [1, 20, 500, 430, 1000, 1010, 1020] },
  { folder: "Ikrar talak: relaas", tahap: "290-600", grup: [1, 600, 650] },
  { folder: "Akta cerai (Cerai Gugat, Cerai Talak)", tahap: "296", grup: [1, 430, 431, 1000, 1003], validator: [30] },
  { folder: "Blangko e-Court", tahap: "0-1000", grup: [1, 20, 500, 430, 600, 650, 1000, 1010, 1020] },
  { folder: "Gugatan dan Permohonan", tahap: "0-1000", grup: [1, 30, 500, 430, 1000, 1010, 1020, 1032, 1001, 1011] },
];
