/**
 * ============================================================================
 * BAS MASSAL - DAFTAR SIDANG SATU TANGGAL, STATUS BAS, DAN USULAN BLANGKONYA
 * ============================================================================
 *
 * Perbaikan 30 Sep 2026 sore, butir U4 (agen M): panitera sidang / panitera
 * pengganti mendapat pekerjaan massal yang setara "Putusan massal" hakim dan
 * "Relaas massal" juru sita. Fungsi di berkas ini MURNI - tanpa jaringan,
 * tanpa basis data - supaya aturannya diuji langsung.
 *
 * Yang disusun untuk tiap perkara yang bersidang pada tanggal itu:
 *
 *   - BAS di SIPP     adaBas pada baris jadwal (edoc_bas sidang itu terunggah)
 *   - saksi diajukan  saksiPihak1/2 dan namanya - belum tentu sudah diperiksa
 *   - lembar ALETA    lembar BAS yang diketik di Alat Bantu Tulis BAS portal
 *   - kehadiran       dihadiri_oleh SIPP (1 semua pihak, 2 pihak pertama saja,
 *                     3 pihak kedua saja, 4 tidak ada yang hadir)
 *   - blangko         pilihan blangko BAS dari set yang cocok dengan jenis
 *                     perkaranya (pohon-blangko.ts), pada jenjang "BAS <N>"
 *                     yang N-nya urutan sidang itu
 *
 * ============================================================================
 * USULAN BLANGKO HANYA BILA KEHADIRANNYA COCOK - SELEBIHNYA DIPILIH ORANG
 * ============================================================================
 *
 * Nama blangko BAS menyebut keadaannya ("BAS 2 P Hadir & T Tidak Hadir Pokok
 * Perkara - Putusan Verstek"). Usulan hanya diberikan bila keadaan di nama
 * blangko COCOK dengan kehadiran yang tercatat di SIPP. Kehadiran yang belum
 * dicatat, atau nama yang tidak menyebut kehadiran, tidak ditebak: seluruh
 * pilihan pada jenjang itu tetap ditawarkan, tanpa satu pun yang terpilih.
 *
 * ============================================================================
 * KEPUTUSAN PENGGUNA 9 OKT 2026 - USULAN WALAU KEHADIRAN BELUM TERCATAT
 * ============================================================================
 *
 * Temuan uji U2: 79 dari 82 sidang 12-15 Okt belum berkehadiran pada pagi
 * harinya, sehingga BAS massal tidak mengusulkan apa pun dan panitera
 * pengganti memilih satu per satu. Sejak ini:
 *
 *   - kehadiran dibaca dari SIPP (dihadiri_oleh), lalu dari ANTRIAN SIDANG
 *     (pihak yang mengambil nomor = hadir) bila SIPP belum mencatat;
 *   - belum ada keduanya, sebelum 14.00 WITA: usulan PERKIRAAN menurut
 *     urutan sidang, agenda, dan keadaan perkara (tergugat pernah hadir ->
 *     contra), bertanda "belum hadir";
 *   - lewat 14.00 WITA (atau hari sidangnya sudah lewat) tetap tanpa
 *     kehadiran: format PUTUS GUGUR atau TUNDA PANGGIL PARA PIHAK menurut
 *     tentukanFormatTanpaHadir - ragu selalu jatuh ke tunda.
 *
 * Petugas tetap dapat mengganti pilihannya. Kehadiran yang tercatat di SIPP
 * tetap memakai aturan lama (usulan hanya bila cocok) tanpa perubahan.
 *
 * Tidak ada yang ditulis ke mana pun oleh apa pun di sini.
 */
import {
  AGENDA_BAS,
  cocokPolaFormat,
  pilihBlangkoBasPeta,
  uraiKunciBas,
  type FormatBasTanpaHadir,
} from "@/lib/pemetaan-blangko";
import { ALUR_BAS_KUMULASI, tentukanAlurBasKumulasi } from "@/lib/alur-bas-kumulasi";
import { ALUR_BAS, padananBasArsip, type AlurBas, type HasilAlurBas, type LangkahAlurBas, type PadananBas } from "@/lib/alur-bas";
import { salinanBasJenis, type SalinanBas } from "@/lib/salinan-bas-jenis";
import { tentukanBasBaru, type HasilBasBaru, type LangkahBasBaru } from "@/lib/alur-bas-baru";
import { namaAdaDi } from "@/lib/perkara-sendiri";
import { setUntukPerkara } from "@/lib/pohon-blangko";

/** Bagian baris jadwal bot (SidangBaris) yang dipakai BAS massal. Semua opsional - bot lama. */
export type BarisSidangBas = {
  sidangId?: unknown;
  perkaraId?: unknown;
  nomorPerkara?: unknown;
  jenisPerkara?: unknown;
  tanggalSidang?: unknown;
  jamSidang?: unknown;
  agenda?: unknown;
  ruangan?: unknown;
  ditunda?: unknown;
  sudahPutus?: unknown;
  urutanSidang?: unknown;
  dihadiriOleh?: unknown;
  adaBas?: unknown;
  paniteraNama?: unknown;
  majelisNama?: unknown;
  saksiPihak1?: unknown;
  saksiPihak2?: unknown;
  saksiNamaPihak1?: unknown;
  saksiNamaPihak2?: unknown;
  /** 15 = Pdt.G (gugatan), 16 = Pdt.P (permohonan). 0/tidak ada = dibaca dari nomor perkara. */
  alurPerkaraId?: unknown;
  sidangIkrarTalak?: unknown;
  /** T 13 Okt: keterangan kumulasi bot ({daftar:[{kode, sumber}]}) - BAS putus verstek kumulasi hak asuh. */
  kumulasi?: unknown;
  panggilan?: {
    tergugatPernahHadir?: unknown;
    /** true / false / null - bot sejak 9 Okt 2026; tidak ada = bot lama. */
    penggugatPernahHadir?: unknown;
    hadirSebelumnya?: unknown;
    wajibDipanggil?: unknown;
    belumDipanggil?: unknown;
    sisiBelumDipanggil?: unknown;
    retur?: unknown;
    relaasTanpaKedudukan?: unknown;
    tenggangMepet?: unknown;
    tenggangTersempit?: { patut?: unknown; dinilai?: unknown; alasan?: unknown } | null;
  } | null;
};

/** Baris peta antrian bot (AntrianBarisGateway) yang dipakai: tanggal dan jam ambil tiap sisi. */
export type AntrianBarisBas = { tanggalSidang?: unknown; pihak1?: unknown; pihak2?: unknown };

/** jawaban.antrian dari jadwal bot - berkunci perkara_id; tabelnya hanya memuat hari berjalan. */
export type AntrianBas = {
  terbaca?: unknown;
  tanggal?: unknown;
  peta?: Record<string, AntrianBarisBas | undefined> | null;
} | null;

/** Saat menurut WITA (waktuPengadilan): tanggal YYYY-MM-DD dan jam HH:MM:SS. */
export type SaatBas = { tanggal: string; jam: string };

/** Keputusan pengguna 9 Okt 2026: "perkara yang sudah sampai jam 2 tidak ada kehadirannya". */
export const JAM_BATAS_KEHADIRAN_BAS = "14:00:00";

/**
 * Folder ABT umum yang memuat blangko format tanpa kehadiran. Set derry
 * (pohon-blangko.ts) punya "Tunda Panggil P & T" untuk BAS 1 dan 2 perceraian,
 * tetapi tidak satu pun BAS gugur - yang ada di "3 BAS Putus Standar" (34-a).
 * Untuk perkara selain perceraian, "Tunda Panggil P dan T" sidang pertama
 * ada di "1 BAS Pertama Standar" (02-a).
 */
export const FOLDER_BAS_FORMAT = ["berita_acara_sidang/3 BAS Putus Standar", "berita_acara_sidang/1 BAS Pertama Standar"];

/** Nama blangko yang dibutuhkan bila katalog tidak memuatnya - disebut di layar, bukan ditebak. */
export const BLANGKO_FORMAT_DIBUTUHKAN: Record<FormatBasTanpaHadir, string> = {
  gugur: "BAS Putus P & T Tidak Hadir (Gugur)",
  "tunda-panggil": "BAS P & T Tidak Hadir - Tunda Panggil P & T",
};

export type KehadiranPt = { p: boolean | null; t: boolean | null };

export type KeadaanKehadiranBas = "tercatat" | "antrian" | "belum-hadir" | "lewat-batas";

/** Tanda kehadiran satu baris - dibaca ekstensi; teksnya sudah siap tampil. */
export type TandaKehadiranBas = { keadaan: KeadaanKehadiranBas; teks: string; judul: string };

/** Format sidang lewat 14.00 tanpa kehadiran. ragu = data tidak cukup untuk gugur. */
export type FormatTanpaHadir = {
  jenis: FormatBasTanpaHadir;
  ragu: boolean;
  /** Kalimat penentu - satu baris di layar. */
  alasan: string;
  /** Seluruh pertimbangan yang terbaca, untuk keterangan. */
  dasar: string[];
};

/** Satu blangko dari katalog bot (blangko.katalog) - bentuk BlangkoItem. */
export type BlangkoKatalog = {
  berkas?: unknown;
  basKe?: unknown;
  basVarian?: unknown;
  keadaan?: unknown;
  tindakan?: unknown;
  judul?: unknown;
};

/** Katalog satu folder, sudah dibaca: terbaca false = bot tidak menjawab / folder tidak ada. */
export type KatalogFolder = { terbaca: boolean; sebab: string; blangko: BlangkoKatalog[] };

export type KecocokanKehadiran = "cocok" | "bertentangan" | "tidak-diketahui";

export type PilihanBlangkoBas = {
  folder: string;
  berkas: string;
  setId: string;
  setNama: string;
  basKe: number;
  label: string;
  kehadiran: KecocokanKehadiran;
  /** Perbaikan 2 Okt sore (butir 8): kunci Pemetaan blangko BAS yang memilihnya. Tanpa = usulan otomatis. */
  dariPemetaan?: string;
  /** 9 Okt 2026: usulan menurut PERKIRAAN kehadiran (belum tercatat) - periksa kembali. */
  perkiraan?: boolean;
  /** 9 Okt 2026: blangko format lewat 14.00 tanpa kehadiran. */
  format?: FormatBasTanpaHadir;
  /**
   * S 13 Okt: berkas yang SAMA di folder ALUR (paket ABT abt-blangko-derry-rapi menyembunyikan menu BAS lama) -
   * ekstensi memakai tokennya bila token berkas folder lama tidak dapat dipanen dari ABT. Tanpa = tidak perlu.
   */
  padanan?: PadananBas[];
  /**
   * F3 14 Okt: SALINAN berkas ini di folder jenis perkaranya (paket ABT abt-susunan-satu-folder) beserta nama menu ABT-nya
   * ("Cerai Talak - BAS", folder "1a Perceraian CT - BAS"; susunan berpasangan K3 15 Okt). Hanya folder yang cocok dengan jenis perkara barisnya - ABT menolak token folder CG untuk perkara
   * CT. Tanpa = jenis tidak terbaca atau tidak ada salinan: ekstensi memakai jalur lama (tidak menebak).
   */
  salinan?: SalinanBas[];
};

export type RingkasLembar = { jumlah: number; selesai: number; draf: number };

/* === ALURBAS 12 Okt === */
/**
 * Alur sidang perkara ini dan BAS langkah berikutnya dari folder alurnya di ABT (paket abt-bas-alur-sidang; peta di
 * lib/alur-bas.ts). KETERANGAN saja: tidak mengubah `blangko` (pilihan BAS massal yang sudah ada).
 */
export type AlurBasBaris = {
  id: string;
  nama: string;
  /** Folder ABT (relatif _blangko_abt), mis. "derry_briantono/ALUR 02 Cerai Verstek - ...". */
  folder: string;
  /** Awalan langkah di nama berkas: "1", "2a" ... */
  kode: string;
  berkas: string;
  keterangan: string;
  /** Berkas lain yang mungkin pada alur yang sama (varian saksi dsb.). */
  alternatif: string[];
  perkiraan: boolean;
  sebab: string;
};
/* === AKHIR ALURBAS === */

export type BarisBasMassal = {
  sidangId: string;
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  tanggalSidang: string;
  jamSidang: string;
  agenda: string;
  ruangan: string;
  ditunda: boolean;
  sudahPutus: boolean;
  /** 0 = bot tidak mengirim urutan sidang. */
  urutanSidang: number;
  dihadiriOleh: number | null;
  kehadiran: string;
  /** 9 Okt 2026: tercatat (SIPP) / antrian / belum-hadir / lewat-batas, beserta teks tandanya. */
  tandaKehadiran: TandaKehadiranBas;
  /** 9 Okt 2026: terisi hanya bila lewat 14.00 tanpa kehadiran sama sekali. */
  formatTanpaHadir: FormatTanpaHadir | null;
  /** null = bot lama tidak mengirim ruasnya (BUKAN "belum ada"). */
  basSipp: boolean | null;
  paniteraNama: string;
  majelisNama: string;
  /**
   * Pemilik kerja BAS = panitera pengganti sidang itu (KONTRAK K4, perbaikan
   * 1 Okt). id = kunci nama (penggunaKunci) - bot jadwal tidak mengirim kode
   * PP, jadwal SIPP hanya menyimpan namanya. Kosong bila PP belum ditunjuk.
   */
  pengguna: { id: string; nama: string };
  milikSaya: boolean;
  saksi: { pihak1: number; pihak2: number; nama1: string[]; nama2: string[] };
  /** null = lembar ALETA tidak terbaca. */
  lembar: RingkasLembar | null;
  blangko: { usulan: PilihanBlangkoBas | null; pilihan: PilihanBlangkoBas[]; sebab: string };
  /** 12 Okt 2026: alur sidang dan BAS langkahnya di folder alur ABT; null = jenis perkara tanpa folder alur. */
  alurBas: AlurBasBaris | null;
};

/**
 * Kunci pengelompokan satu nama petugas: huruf kecil, gelar sesudah koma dan
 * sebutan Drs./H./Hj./Ir./Prof. dibuang, tanpa tanda baca - "Siti Aminah,
 * S.H." dan "Siti Aminah" satu kelompok. SAMA dengan basmassalKunciPengguna di
 * ekstensi-sipp/basmassal.js (dijaga ekstensi-massal-1okt.test.ts).
 */
export function penggunaKunci(nama: string): string {
  return String(nama || "")
    .split(",")[0]
    .toLowerCase()
    .replace(/\b(?:drs?|dra|hj?|ir|prof)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Batas pilihan blangko per perkara - daftar yang lebih panjang berhenti dibaca. */
export const BATAS_PILIHAN_BLANGKO = 12;

const teks = (x: unknown) => String(x ?? "").trim();
const angka = (x: unknown) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};
const daftarTeks = (x: unknown) => (Array.isArray(x) ? x.map(teks).filter(Boolean) : []);

/** Sandi dihadiri_oleh SIPP -> kalimat (borang jadwal_sidang_p_edit.php). */
export const SEBUTAN_KEHADIRAN: Record<number, string> = {
  1: "semua pihak hadir",
  2: "hanya pihak pertama hadir",
  3: "hanya pihak kedua hadir",
  4: "tidak ada pihak hadir",
};

export function kalimatKehadiran(dihadiriOleh: number | null): string {
  return dihadiriOleh && SEBUTAN_KEHADIRAN[dihadiriOleh] ? SEBUTAN_KEHADIRAN[dihadiriOleh] : "kehadiran belum dicatat di SIPP";
}

/**
 * Keadaan kehadiran yang disebut nama blangko: { p, t } masing-masing
 * true (hadir), false (tidak hadir), atau null (tidak disebut).
 *
 *   "P Hadir & T Tidak Hadir Pokok Perkara"  -> { p: true,  t: false }
 *   "P & T Hadir"                            -> { p: true,  t: true }
 *   "P & T Tidak Hadir"                      -> { p: false, t: false }
 *   "Pembuktian"                             -> { p: null,  t: null }
 */
export function kehadiranDiNama(keadaan: string): { p: boolean | null; t: boolean | null } {
  const k = ` ${String(keadaan || "").toLowerCase().replace(/\s+/g, " ")} `;
  let p: boolean | null = null;
  let t: boolean | null = null;
  // Bentuk berdua lebih dulu: "p & t tidak hadir" / "p dan t hadir".
  const berdua = k.match(/\sp\s*(?:&|dan)\s*t\s+(tidak\s+)?hadir\b/);
  if (berdua) {
    const hadir = !berdua[1];
    p = hadir;
    t = hadir;
  }
  const satuP = k.match(/\sp\s+(tidak\s+)?hadir\b/);
  if (satuP) p = !satuP[1];
  const satuT = k.match(/\st\s+(tidak\s+)?hadir\b/);
  if (satuT) t = !satuT[1];
  return { p, t };
}

/** Kehadiran yang tercatat di SIPP -> { p, t }; null bila belum dicatat. */
function kehadiranSipp(dihadiriOleh: number | null): { p: boolean; t: boolean } | null {
  if (dihadiriOleh === 1) return { p: true, t: true };
  if (dihadiriOleh === 2) return { p: true, t: false };
  if (dihadiriOleh === 3) return { p: false, t: true };
  if (dihadiriOleh === 4) return { p: false, t: false };
  return null;
}

export function cocokKehadiran(keadaan: string, dihadiriOleh: number | null): KecocokanKehadiran {
  return cocokKehadiranPt(keadaan, kehadiranSipp(dihadiriOleh));
}

/**
 * Kecocokan nama blangko dengan kehadiran per sisi (9 Okt 2026). Sisi yang
 * belum diketahui (null) tidak dibandingkan; nama yang menyebut sisi itu
 * saja yang diketahui tidak dinyatakan cocok - "tidak-diketahui".
 */
export function cocokKehadiranPt(keadaan: string, pt: KehadiranPt | null): KecocokanKehadiran {
  const nama = kehadiranDiNama(keadaan);
  if (!pt || (pt.p === null && pt.t === null) || (nama.p === null && nama.t === null)) return "tidak-diketahui";
  if ((nama.p !== null && pt.p !== null && nama.p !== pt.p) || (nama.t !== null && pt.t !== null && nama.t !== pt.t)) {
    return "bertentangan";
  }
  if ((nama.p !== null && pt.p === null) || (nama.t !== null && pt.t === null)) return "tidak-diketahui";
  return "cocok";
}

/** Kehadiran per sisi -> sandi dihadiri_oleh (untuk Pemetaan blangko); null bila ada sisi yang belum diketahui. */
export function sandiDariPt(pt: KehadiranPt | null): number | null {
  if (!pt || pt.p === null || pt.t === null) return null;
  if (pt.p && pt.t) return 1;
  if (pt.p) return 2;
  if (pt.t) return 3;
  return 4;
}

/**
 * Kehadiran menurut ANTRIAN SIDANG pada hari sidang itu: sisi yang
 * mengambil nomor = hadir. null = antrian tidak dapat menjawab hari itu
 * (tidak terbaca, atau tabelnya memuat hari lain - aplikasi antrian hanya
 * menyimpan hari berjalan). Perkara yang tidak ada di peta padahal hari itu
 * terbaca = tidak satu pun pihak mengambil nomor.
 */
export function kehadiranDariAntrian(
  antrian: AntrianBas | undefined,
  perkaraId: string,
  tanggalSidang: string
): { p: boolean; t: boolean } | null {
  if (!antrian || antrian.terbaca !== true || !tanggalSidang) return null;
  const peta = antrian.peta && typeof antrian.peta === "object" ? antrian.peta : {};
  const baris = perkaraId ? peta[perkaraId] : undefined;
  if (baris && teks(baris.tanggalSidang).slice(0, 10) === tanggalSidang) {
    return { p: Boolean(teks(baris.pihak1)), t: Boolean(teks(baris.pihak2)) };
  }
  const hari = Array.isArray(antrian.tanggal) ? antrian.tanggal.map((x) => teks(x).slice(0, 10)) : [];
  return hari.includes(tanggalSidang) ? { p: false, t: false } : null;
}

/** Hari sidang sudah lewat, atau hari ini pukul 14.00 WITA atau sesudahnya. Saat kosong = tidak pernah lewat. */
export function lewatBatasKehadiran(tanggalSidang: string, saat: SaatBas | null | undefined): boolean {
  if (!saat || !saat.tanggal || !tanggalSidang) return false;
  if (tanggalSidang < saat.tanggal) return true;
  return tanggalSidang === saat.tanggal && String(saat.jam || "") >= JAM_BATAS_KEHADIRAN_BAS;
}

/**
 * ============================================================================
 * GUGUR ATAU TUNDA PANGGIL PARA PIHAK - LEWAT 14.00 TANPA KEHADIRAN
 * ============================================================================
 *
 * Pasal 124 HIR / Pasal 148 RBg (PA Donggala di luar Jawa-Madura: RBg):
 * penggugat yang tidak datang pada hari sidang yang ditentukan, padahal
 * telah dipanggil dengan patut, gugatannya dinyatakan gugur. Pasal 126 HIR /
 * Pasal 150 RBg membolehkan hakim memanggil sekali lagi - karena itu
 * GUGUR hanya diusulkan bila SELURUH syarat terbaca pasti dari data:
 *
 *   1. perkara gugatan (alur 15 / nomor "Pdt.G" - cerai talak ikut);
 *      permohonan (Pdt.P) tidak digugurkan -> tunda;
 *   2. bukan sidang ikrar talak (Pasal 70 ayat 6 UU 7/1989 - bukan 124
 *      HIR) dan perkaranya belum putus;
 *   3. penggugat BELUM PERNAH hadir pada sidang sebelumnya
 *      (panggilan.penggugatPernahHadir === false; sidang pertama = belum).
 *      Yang pernah hadir lalu tidak datang tidak digugurkan -> tunda.
 *      Ada sidang sebelumnya yang kehadirannya kosong -> ragu;
 *   4. relaas penggugat untuk sidang ini ADA (sisi 1 tidak di
 *      sisiBelumDipanggil), tidak ada retur, tenggangnya patut (tidak mepet,
 *      tenggang tersempit patut), dan tidak ada relaas tanpa kedudukan pihak
 *      (relaas itu tidak pasti milik penggugat);
 *   5. ketidakhadirannya terbaca dari antrian hari itu juga (antrian
 *      terbaca, penggugat tidak mengambil nomor) - bukan hanya dari SIPP
 *      yang kosong.
 *
 * Selebihnya TUNDA PANGGIL PARA PIHAK. Yang kurang datanya ditandai ragu -
 * ALETA tidak pernah menebak gugur.
 */
export function tentukanFormatTanpaHadir(
  s: BarisSidangBas,
  opsi: { antrianTerbaca: boolean }
): FormatTanpaHadir {
  const dasar: string[] = [];
  const tunda = (alasan: string, ragu: boolean): FormatTanpaHadir => ({
    jenis: "tunda-panggil",
    ragu,
    alasan,
    dasar: [...dasar, alasan],
  });
  const nomor = teks(s.nomorPerkara);
  const alur = angka(s.alurPerkaraId);
  const permohonan = alur === 16 || (alur === 0 && /\/pdt\.p\//i.test(nomor));
  const gugatan = alur === 15 || (alur === 0 && /\/pdt\.g\//i.test(nomor));
  if (permohonan) return tunda("Perkara permohonan (Pdt.P) tidak digugurkan - ditunda untuk memanggil Pemohon.", false);
  if (!gugatan) return tunda("Jenis alur perkara (gugatan/permohonan) tidak terbaca.", true);
  if (s.sidangIkrarTalak === true) {
    return tunda("Sidang ikrar talak - berlaku Pasal 70 ayat (6) UU 7/1989, bukan pengguguran Pasal 124 HIR.", false);
  }
  if (s.sudahPutus === true) return tunda("Perkara sudah diputus - pengguguran tidak berlaku.", false);

  const pg = s.panggilan;
  if (!pg || !Array.isArray(pg.wajibDipanggil)) {
    return tunda("Keadaan panggilan sidang ini tidak terbaca dari server.", true);
  }
  const urutan = angka(s.urutanSidang);
  let pernah: boolean | null;
  if (pg.penggugatPernahHadir === true || pg.penggugatPernahHadir === false) pernah = pg.penggugatPernahHadir;
  else if (pg.penggugatPernahHadir === null) pernah = null;
  else if (urutan === 1) pernah = false; // bot lama: sidang pertama belum punya sidang sebelumnya
  else {
    const sebelum = pg.hadirSebelumnya === null || pg.hadirSebelumnya === undefined ? null : angka(pg.hadirSebelumnya);
    pernah = sebelum === 1 || sebelum === 2 ? true : null;
  }
  if (pernah === true) {
    return tunda(
      "Penggugat pernah hadir pada sidang sebelumnya - tidak digugurkan (Pasal 124 HIR / 148 RBg bagi penggugat yang tidak pernah datang); ditunda untuk memanggil para pihak.",
      false
    );
  }
  if (pernah === null) {
    return tunda("Kehadiran sidang sebelumnya ada yang belum dicatat - tidak pasti penggugat belum pernah hadir.", true);
  }
  dasar.push(urutan === 1 ? "Sidang pertama - penggugat belum pernah hadir." : "Penggugat belum pernah hadir pada sidang sebelumnya.");

  const wajib = (pg.wajibDipanggil as unknown[]).map(angka);
  const sisiBelum = Array.isArray(pg.sisiBelumDipanggil) ? pg.sisiBelumDipanggil.map(angka) : null;
  if (sisiBelum ? sisiBelum.includes(1) : angka(pg.belumDipanggil) > 0) {
    return tunda("Relaas panggilan penggugat untuk sidang ini belum ada - panggilan belum terbukti patut.", sisiBelum === null);
  }
  if (!wajib.includes(1)) {
    return tunda("Penggugat tidak termasuk pihak yang dipanggil untuk sidang ini - panggilannya tidak terbaca.", true);
  }
  if (angka(pg.retur) > 0) return tunda("Ada relaas yang kembali (retur) - panggilan belum pasti patut.", true);
  if (angka(pg.relaasTanpaKedudukan) > 0) {
    return tunda("Ada relaas tanpa kedudukan pihak - tidak pasti relaas penggugat sudah patut.", true);
  }
  if (pg.tenggangMepet === true) return tunda("Tenggang panggilan kurang dari ambangnya - panggilan tidak patut.", false);
  const tersempit = pg.tenggangTersempit;
  if (!tersempit) return tunda("Tenggang panggilan tidak terbaca - kepatutannya tidak dapat dinilai.", true);
  if (tersempit.patut === false) return tunda("Panggilan tidak patut menurut tenggangnya.", false);
  if (tersempit.patut !== true) return tunda("Kepatutan panggilan belum dapat dinilai (mis. surat tercatat belum terbukti diterima).", true);
  dasar.push("Relaas penggugat untuk sidang ini ada, tidak retur, dan tenggangnya patut.");
  if (!opsi.antrianTerbaca) {
    return tunda("Antrian sidang hari itu tidak terbaca - ketidakhadiran hanya menurut SIPP yang kosong.", true);
  }
  const alasan =
    "Penggugat tidak hadir (tidak tercatat di SIPP, tidak mengambil nomor antrian) padahal telah dipanggil resmi dan patut - Pasal 124 HIR / Pasal 148 RBg.";
  return { jenis: "gugur", ragu: false, alasan, dasar: [...dasar, alasan] };
}

/** Nama terbaca satu blangko di dalam jenjangnya (setara labelBlangko pohon-blangko.ts). */
function labelBlangkoBas(item: BlangkoKatalog): string {
  const gabung = [teks(item.keadaan), teks(item.tindakan)].filter(Boolean).join(" - ");
  return gabung || teks(item.judul) || teks(item.berkas);
}

/** Set BAS yang cocok dengan jenis perkara - dari pohon-blangko.ts, satu-satunya tempat set ditulis. */
export function setBasUntukPerkara(jenisPerkara: string) {
  return setUntukPerkara(jenisPerkara).filter((s) => s.jenis === "bas" && s.cocok);
}

/**
 * Tergugat/termohon hadir pada sidang ini atau pernah hadir sebelumnya ->
 * set contra lebih dahulu; selain itu verstek lebih dahulu. Hanya URUTAN -
 * kedua set tetap ditawarkan.
 */
function contraLebihDulu(dihadiriOleh: number | null, tergugatPernahHadir: unknown): boolean {
  if (dihadiriOleh === 1 || dihadiriOleh === 3) return true;
  return tergugatPernahHadir === true;
}

const PERINGKAT_KEHADIRAN: Record<KecocokanKehadiran, number> = { cocok: 0, "tidak-diketahui": 1, bertentangan: 2 };

/**
 * Pilihan blangko BAS untuk satu sidang.
 *
 * Kandidat = blangko set yang cocok dengan jenis perkaranya yang jenjangnya
 * "BAS <urutan sidang>". Urutan: set yang lebih mungkin (contra/verstek
 * menurut kehadiran tergugat), lalu kecocokan kehadiran, lalu nama berkas.
 * Usulan = kandidat pertama BILA kehadirannya "cocok"; selain itu null.
 */
export function pilihBlangkoBas(masukan: {
  jenisPerkara: string;
  urutanSidang: number;
  dihadiriOleh: number | null;
  tergugatPernahHadir?: unknown;
  katalog: Record<string, KatalogFolder | undefined>;
  /** Perbaikan 2 Okt sore (butir 8): Pemetaan blangko BAS { kunci: nama berkas } dan agenda sidang. */
  petaBas?: Record<string, string>;
  agenda?: string;
  /**
   * 9 Okt 2026: kehadiran per sisi dari SIPP ATAU antrian. Tidak diisi =
   * dari dihadiriOleh (perilaku lama). null/sebagian + perkiraan = usulan
   * menurut perkiraan (P hadir; T hadir bila contra).
   */
  kehadiranPt?: KehadiranPt | null;
  perkiraan?: boolean;
  /** 9 Okt 2026: lewat 14.00 tanpa kehadiran - blangko format gugur / tunda panggil para pihak. */
  format?: FormatTanpaHadir | null;
}): { usulan: PilihanBlangkoBas | null; pilihan: PilihanBlangkoBas[]; sebab: string } {
  const hasil = masukan.format
    ? pilihBlangkoFormat(masukan, masukan.format)
    : terapkanPetaBas(pilihBlangkoBasOtomatis(masukan), masukan);
  return denganPadanan(hasil, masukan.jenisPerkara);
}

/* === S 13 Okt === */
/** Lengkapi tiap pilihan dengan padanan folder ALUR-nya (bila ada) - pilihan dan usulan tetap objek yang sama bentuknya. */
function denganPadanan<T extends { usulan: PilihanBlangkoBas | null; pilihan: PilihanBlangkoBas[] }>(h: T, jenisPerkara = ""): T {
  const tambah = (p: PilihanBlangkoBas): PilihanBlangkoBas => {
    const padanan = padananBasArsip(p.folder, p.berkas);
    // F3 14 Okt: salinan di folder jenis yang SESUAI jenis perkara (lib/salinan-bas-jenis.ts).
    const salinan = salinanBasJenis(p.folder, p.berkas, jenisPerkara);
    return padanan.length || salinan.length ? { ...p, ...(padanan.length ? { padanan } : {}), ...(salinan.length ? { salinan } : {}) } : p;
  };
  const pilihan = h.pilihan.map(tambah);
  const usulan = h.usulan ? pilihan.find((p) => p.folder === h.usulan!.folder && p.berkas === h.usulan!.berkas) ?? tambah(h.usulan) : null;
  return { ...h, pilihan, usulan };
}
/* === AKHIR S === */

/**
 * ============================================================================
 * BLANGKO FORMAT TANPA KEHADIRAN (9 OKT 2026)
 * ============================================================================
 *
 * Urutan: Pemetaan blangko > BAS berkunci "<jenis>|gugur|*" atau
 * "<jenis>|tunda-panggil|*" -> katalog set jenis perkaranya -> folder ABT
 * umum (FOLDER_BAS_FORMAT). Nama dicocokkan POLA_BLANGKO_FORMAT; jenjang
 * "BAS N" yang sama dengan urutan sidang (BAS 2 untuk lanjutan) lebih dulu,
 * dan blangko "BAS Pertama" hanya untuk sidang pertama. Kedua format SELALU
 * ada di pilihan (bila ditemukan) supaya petugas dapat menukarnya, lalu
 * pilihan otomatis jenjang itu.
 */
function pilihBlangkoFormat(
  masukan: Parameters<typeof pilihBlangkoBas>[0],
  format: FormatTanpaHadir
): { usulan: PilihanBlangkoBas | null; pilihan: PilihanBlangkoBas[]; sebab: string } {
  const pt: KehadiranPt = { p: false, t: false };
  const otomatis = pilihBlangkoBasOtomatis({ ...masukan, kehadiranPt: pt, perkiraan: false, format: null });
  const set = setBasUntukPerkara(masukan.jenisPerkara);
  const contra = contraLebihDulu(null, masukan.tergugatPernahHadir);
  const urutSet = [...set].sort((a, b) => {
    const n = (id: string) => (id === "bas-contra" ? (contra ? 0 : 1) : id === "bas-verstek" ? (contra ? 1 : 0) : 2);
    return n(a.id) - n(b.id);
  });
  const folder = [...new Set([...urutSet.map((s) => s.folder), ...FOLDER_BAS_FORMAT])];
  const jenjang = Math.min(Math.max(masukan.urutanSidang, 1), 2);

  const buat = (f: string, item: BlangkoKatalog, jenis: FormatBasTanpaHadir, dariPemetaan?: string): PilihanBlangkoBas => {
    const s = set.find((x) => x.folder === f);
    return {
      folder: f,
      berkas: teks(item.berkas),
      setId: s ? s.id : "",
      setNama: s ? s.nama : f.split("/").pop() || f,
      basKe: angka(item.basKe),
      label: labelBlangkoBas(item),
      kehadiran: cocokKehadiranPt(teks(item.keadaan), pt),
      format: jenis,
      ...(dariPemetaan ? { dariPemetaan } : {}),
    };
  };

  const cari = (jenis: FormatBasTanpaHadir): PilihanBlangkoBas | null => {
    // Pemetaan admin - hanya kunci format.
    if (masukan.petaBas) {
      const petaFormat = Object.fromEntries(
        Object.entries(masukan.petaBas).filter(([k]) => uraiKunciBas(k).sidang === jenis)
      );
      const cocok = pilihBlangkoBasPeta(petaFormat, {
        jenisPerkara: masukan.jenisPerkara,
        urutanSidang: masukan.urutanSidang,
        agenda: masukan.agenda,
        dihadiriOleh: null,
        format: jenis,
      });
      if (cocok) {
        const dicari = kunciBerkasBas(cocok.namaBerkas);
        for (const f of [...new Set([...folder, ...Object.keys(masukan.katalog)])]) {
          const k = masukan.katalog[f];
          const item = k && k.terbaca ? k.blangko.find((b) => kunciBerkasBas(b.berkas) === dicari) : undefined;
          if (item) return buat(f, item, jenis, cocok.kunci);
        }
      }
    }
    let terbaik: { p: PilihanBlangkoBas; nilai: number } | null = null;
    folder.forEach((f, iFolder) => {
      const k = masukan.katalog[f];
      if (!k || !k.terbaca) return;
      for (const item of k.blangko) {
        const berkas = teks(item.berkas);
        if (!berkas || !cocokPolaFormat(jenis, berkas)) continue;
        const pertama = /\bpertama\b/i.test(berkas);
        if (pertama && masukan.urutanSidang > 1) continue;
        const ke = angka(item.basKe);
        if (ke > 0 && ke !== jenjang) continue;
        // Folder lebih dulu (set jenis perkara sebelum folder umum), lalu nama.
        const nilai = iFolder * 1000 + (ke === jenjang ? 0 : 1);
        if (!terbaik || nilai < terbaik.nilai || (nilai === terbaik.nilai && berkas.localeCompare(terbaik.p.berkas, "id") < 0)) {
          terbaik = { p: buat(f, item, jenis), nilai };
        }
      }
    });
    return terbaik ? (terbaik as { p: PilihanBlangkoBas }).p : null;
  };

  const gugur = cari("gugur");
  const tundaPanggil = cari("tunda-panggil");
  const usulan = format.jenis === "gugur" ? gugur : tundaPanggil;
  const urut = format.jenis === "gugur" ? [gugur, tundaPanggil] : [tundaPanggil, gugur];
  const pilihan: PilihanBlangkoBas[] = [];
  for (const p of [...urut, ...otomatis.pilihan]) {
    if (!p) continue;
    if (pilihan.some((x) => x.folder === p.folder && kunciBerkasBas(x.berkas) === kunciBerkasBas(p.berkas))) continue;
    pilihan.push(p);
  }
  const sebab = usulan
    ? ""
    : `Blangko "${BLANGKO_FORMAT_DIBUTUHKAN[format.jenis]}"${format.jenis === "tunda-panggil" && masukan.urutanSidang > 1 ? " untuk sidang lanjutan" : ""} belum ada di katalog yang terbaca - pilih blangkonya sendiri, atau atur di Pemetaan blangko > BAS (kunci "${format.jenis}").`;
  return { usulan, pilihan: pilihan.slice(0, BATAS_PILIHAN_BLANGKO), sebab };
}

/** Nama berkas dibandingkan: huruf kecil, spasi tunggal, tanpa .rtf - sama dengan alatKunciBerkas ekstensi. */
function kunciBerkasBas(nama: unknown): string {
  return teks(nama).replace(/\s+/g, " ").trim().replace(/\.rtf$/i, "").trim().toLowerCase();
}

/**
 * ============================================================================
 * PEMETAAN BLANGKO BAS MENANG ATAS USULAN OTOMATIS (BUTIR 8)
 * ============================================================================
 *
 * Yang diatur admin di Pemetaan blangko > BAS (kunci "jenis|sidang|kehadiran",
 * lib/pemetaan-blangko.ts) dipakai sebagai USULAN - asal berkasnya ada di
 * katalog yang terbaca (pratinjau dan unduh menuntut foldernya). Berkas
 * pemetaan yang tidak ada di katalog TIDAK diganti diam-diam dengan tebakan:
 * usulannya dikosongkan dan sebabnya disebut, pilihan otomatis tetap
 * ditawarkan. Tanpa pemetaan yang cocok: perilaku lama, tidak berubah.
 */
function terapkanPetaBas(
  otomatis: { usulan: PilihanBlangkoBas | null; pilihan: PilihanBlangkoBas[]; sebab: string },
  masukan: Parameters<typeof pilihBlangkoBas>[0]
): { usulan: PilihanBlangkoBas | null; pilihan: PilihanBlangkoBas[]; sebab: string } {
  if (!masukan.petaBas || Object.keys(masukan.petaBas).length === 0) return otomatis;
  const cocok = pilihBlangkoBasPeta(masukan.petaBas, {
    jenisPerkara: masukan.jenisPerkara,
    urutanSidang: masukan.urutanSidang,
    agenda: masukan.agenda,
    dihadiriOleh: masukan.dihadiriOleh,
  });
  if (!cocok) return otomatis;
  const dicari = kunciBerkasBas(cocok.namaBerkas);
  const set = setBasUntukPerkara(masukan.jenisPerkara);
  // Folder set jenis ini lebih dulu, lalu folder lain yang kebetulan terbaca.
  const folder = [...new Set([...set.map((s) => s.folder), ...Object.keys(masukan.katalog)])];
  for (const f of folder) {
    const k = masukan.katalog[f];
    if (!k || !k.terbaca) continue;
    const item = k.blangko.find((b) => kunciBerkasBas(b.berkas) === dicari);
    if (!item) continue;
    const s = set.find((x) => x.folder === f);
    const p: PilihanBlangkoBas = {
      folder: f,
      berkas: teks(item.berkas),
      setId: s ? s.id : "",
      setNama: s ? s.nama : f.split("/").pop() || f,
      basKe: angka(item.basKe),
      label: labelBlangkoBas(item),
      kehadiran: cocokKehadiran(teks(item.keadaan), masukan.dihadiriOleh),
      dariPemetaan: cocok.kunci,
      // 9 Okt 2026: kunci pemetaan tanpa kehadiran yang dipakai sebelum
      // kehadiran tercatat tetap ditandai perkiraan.
      ...(masukan.perkiraan && masukan.dihadiriOleh === null ? { perkiraan: true } : {}),
    };
    const lain = otomatis.pilihan.filter((x) => !(x.folder === p.folder && kunciBerkasBas(x.berkas) === dicari));
    return {
      usulan: p,
      pilihan: [p, ...lain].slice(0, BATAS_PILIHAN_BLANGKO),
      sebab: p.perkiraan ? otomatis.sebab : "",
    };
  }
  return {
    usulan: null,
    pilihan: otomatis.pilihan,
    sebab:
      `Pemetaan blangko BAS (${cocok.kunci}) menunjuk "${cocok.namaBerkas}", tetapi berkas itu tidak ada di katalog yang terbaca - ` +
      "periksa namanya di Pemetaan blangko, atau pilih blangkonya sendiri.",
  };
}

function pilihBlangkoBasOtomatis(masukan: Parameters<typeof pilihBlangkoBas>[0]): {
  usulan: PilihanBlangkoBas | null;
  pilihan: PilihanBlangkoBas[];
  sebab: string;
} {
  const set = setBasUntukPerkara(masukan.jenisPerkara);
  if (set.length === 0) {
    return {
      usulan: null,
      pilihan: [],
      sebab: `Jenis perkara "${masukan.jenisPerkara || "tidak terbaca"}" belum punya set blangko BAS - pakai Alat Bantu Tulis BAS di portal.`,
    };
  }
  if (!(masukan.urutanSidang > 0)) {
    return { usulan: null, pilihan: [], sebab: "Urutan sidang tidak dikirim server - blangko BAS tidak dapat dipilihkan." };
  }
  // 9 Okt 2026: kehadiran per sisi (SIPP atau antrian). Tanpa kehadiranPt =
  // dari dihadiriOleh, persis seperti sebelumnya.
  const pt: KehadiranPt | null =
    masukan.kehadiranPt !== undefined ? masukan.kehadiranPt : kehadiranSipp(masukan.dihadiriOleh);
  const lengkap = Boolean(pt && pt.p !== null && pt.t !== null);
  const contra =
    pt && pt.t === true ? true : contraLebihDulu(masukan.dihadiriOleh, masukan.tergugatPernahHadir);
  // Perkiraan bila kehadiran belum lengkap: P dianggap hadir (yang mengajukan
  // perkara), T menurut keadaan perkaranya (contra = pernah hadir). Sisi yang
  // sudah diketahui dari antrian tidak ditimpa.
  const perkiraan: KehadiranPt | null =
    masukan.perkiraan && !lengkap ? { p: pt?.p ?? true, t: pt?.t ?? contra } : null;
  const agendaKunci = Object.keys(AGENDA_BAS).filter((k) => AGENDA_BAS[k].test(String(masukan.agenda || "")));
  const urutanSet = [...set].sort((a, b) => {
    const nilai = (id: string) => (id === "bas-contra" ? (contra ? 0 : 1) : id === "bas-verstek" ? (contra ? 1 : 0) : 2);
    return nilai(a.id) - nilai(b.id);
  });

  const tidakTerbaca: string[] = [];
  const kandidat: Array<PilihanBlangkoBas & { urutSet: number; nilaiPerkiraan: number; nilaiAgenda: number }> = [];
  urutanSet.forEach((s, urutSet) => {
    const k = masukan.katalog[s.folder];
    if (!k || !k.terbaca) {
      tidakTerbaca.push(`${s.nama}: ${k?.sebab || "katalog tidak terbaca"}`);
      return;
    }
    for (const item of k.blangko) {
      if (angka(item.basKe) !== masukan.urutanSidang) continue;
      const berkas = teks(item.berkas);
      if (!berkas) continue;
      kandidat.push({
        folder: s.folder,
        berkas,
        setId: s.id,
        setNama: s.nama,
        basKe: angka(item.basKe),
        label: labelBlangkoBas(item),
        kehadiran: cocokKehadiranPt(teks(item.keadaan), pt),
        urutSet,
        nilaiPerkiraan: perkiraan ? PERINGKAT_KEHADIRAN[cocokKehadiranPt(teks(item.keadaan), perkiraan)] : 0,
        // Agenda hanya memilah dalam mode perkiraan - urutan lama tidak berubah.
        nilaiAgenda:
          perkiraan && agendaKunci.length
            ? agendaKunci.some((k) => AGENDA_BAS[k].test(`${teks(item.keadaan)} ${teks(item.tindakan)} ${berkas}`))
              ? 0
              : 1
            : 0,
      });
    }
  });

  kandidat.sort(
    (a, b) =>
      a.urutSet - b.urutSet ||
      PERINGKAT_KEHADIRAN[a.kehadiran] - PERINGKAT_KEHADIRAN[b.kehadiran] ||
      a.nilaiPerkiraan - b.nilaiPerkiraan ||
      a.nilaiAgenda - b.nilaiAgenda ||
      a.berkas.localeCompare(b.berkas, "id", { numeric: true })
  );
  const pilihan = kandidat
    .slice(0, BATAS_PILIHAN_BLANGKO)
    .map(({ urutSet: _u, nilaiPerkiraan: _n, nilaiAgenda: _a, ...sisa }) => sisa);

  if (pilihan.length === 0) {
    const sebab =
      tidakTerbaca.length === urutanSet.length
        ? `Katalog blangko tidak terbaca (${tidakTerbaca.join("; ")}).`
        : `Tidak ada blangko "BAS ${masukan.urutanSidang}" di ${urutanSet.map((s) => s.nama).join(" / ")} - pakai Alat Bantu Tulis BAS di portal.`;
    return { usulan: null, pilihan, sebab };
  }
  if (pilihan[0].kehadiran === "cocok") return { usulan: pilihan[0], pilihan, sebab: "" };
  if (perkiraan) {
    // Usulan PERKIRAAN (9 Okt 2026): kandidat pertama yang tidak bertentangan
    // dengan sisi yang sudah diketahui. Ditandai - petugas memeriksanya.
    const pertama = pilihan.find((p) => p.kehadiran !== "bertentangan");
    if (pertama) {
      const usulan: PilihanBlangkoBas = { ...pertama, perkiraan: true };
      return {
        usulan,
        pilihan: pilihan.map((p) => (p === pertama ? usulan : p)),
        sebab: "Kehadiran belum tercatat - usulan menurut urutan sidang, agenda, dan keadaan perkara; periksa kembali sesudah sidang.",
      };
    }
  }
  const sebab =
    pt === null || !lengkap
      ? "Kehadiran sidang ini belum dicatat di SIPP - pilih blangkonya sendiri."
      : "Tidak ada blangko yang keadaannya jelas cocok dengan kehadiran - pilih blangkonya sendiri.";
  return { usulan: null, pilihan, sebab };
}

/* === ALURBAS 12 Okt === */
/** Alur + langkah BAS untuk satu sidang, dalam bentuk ringkas yang dikirim ke ekstensi; null bila jenis perkara tanpa folder alur. */
export function alurBasBaris(masukan: Parameters<typeof tentukanAlurBasKumulasi>[0]): AlurBasBaris | null {
  // T 13 Okt: pembungkus kumulasi (hak asuh -> folder BAS kumulasi) dan itsbat gugur/cabut; tanpa kumulasi = tentukanAlurBas.
  return ringkasAlurBas(tentukanAlurBasKumulasi(masukan));
}

/** Q3 16 Okt: bentuk ringkas hasil penebak alur (dipisah supaya hasil lengkapnya dapat dipakai untuk pilihan blangko). */
export function ringkasAlurBas(h: HasilAlurBas): AlurBasBaris | null {
  if (!h.alur || !h.langkah) return null;
  return {
    id: h.alur.id,
    nama: h.alur.nama,
    folder: h.alur.folder,
    kode: h.langkah.kode,
    berkas: h.langkah.berkas,
    keterangan: h.langkah.keterangan,
    alternatif: h.alternatif.map((l) => l.berkas),
    perkiraan: h.perkiraan,
    sebab: h.sebab,
  };
}
/* === AKHIR ALURBAS === */

/* === G3 15 Okt === */
/**
 * BAS baru di folder jenis (paket D3 abt-bas-paw / abt-bas-permohonan, E3 abt-bas-gugatan; lib/alur-bas-baru.ts) masuk ke pilihan
 * blangko baris: langkah yang ditebak menjadi usulan (mode "ganti") atau hanya ditawarkan (mode "tambah"); alternatifnya
 * ikut sebagai pilihan. Berkasnya BUKAN salinan - langsung di folder jenis - jadi `salinan` menunjuk dirinya sendiri beserta
 * nama menu ABT ("Penetapan Ahli Waris (P3HP) - BAS") agar "Buka di ABT" menemukan tokennya. Pemetaan blangko admin dan
 * blangko format tanpa-kehadiran tetap menang atas usulan baru.
 */
function pilihanDariBasBaru(h: HasilBasBaru, l: LangkahBasBaru, perkiraan: boolean): PilihanBlangkoBas {
  return {
    folder: h.alur.folder,
    berkas: l.berkas,
    setId: h.alur.id,
    setNama: `ALUR ${h.alur.id.replace(/^alur-/, "").toUpperCase()} ${h.alur.nama}`,
    basKe: 0,
    label: `[${l.kode}] ${l.keterangan}`.trim(),
    kehadiran: perkiraan ? "tidak-diketahui" : "cocok",
    ...(perkiraan ? { perkiraan: true } : {}),
    salinan: [{ folder: h.alur.folder, berkas: l.berkas, menu: h.alur.menu.nama, alias: h.alur.menu.alias }],
  };
}

export function gabungBasBaru(
  dasar: { usulan: PilihanBlangkoBas | null; pilihan: PilihanBlangkoBas[]; sebab: string },
  baru: HasilBasBaru | null,
  /** true = baris berformat tanpa-kehadiran (lewat 14.00): usulan format/sebabnya tidak disentuh, BAS baru hanya ditawarkan. */
  tahan = false
): { usulan: PilihanBlangkoBas | null; pilihan: PilihanBlangkoBas[]; sebab: string } {
  if (!baru) return dasar;
  const kunci = (p: { folder: string; berkas: string }) => `${p.folder}|${kunciBerkasBas(p.berkas)}`;
  const utama = pilihanDariBasBaru(baru, baru.langkah, baru.perkiraan);
  const lain = baru.alternatif.map((l) => pilihanDariBasBaru(baru, l, true));
  const semua = [utama, ...lain];
  const sudah = new Set(semua.map(kunci));
  const lama = dasar.pilihan.filter((p) => !sudah.has(kunci(p)));
  const terkunci = tahan || Boolean(dasar.usulan && (dasar.usulan.dariPemetaan || dasar.usulan.format));
  const batas = BATAS_PILIHAN_BLANGKO + semua.length;
  if (baru.mode === "tambah" || terkunci) return { ...dasar, pilihan: [...lama, ...semua].slice(0, batas) };
  return { usulan: utama, pilihan: [...semua, ...lama].slice(0, batas), sebab: baru.perkiraan ? baru.sebab : "" };
}

/* === Q3 16 Okt === */
/**
 * ALUR SIDANG (ALUR 01-13, kumulasi 945, itsbat gugur/cabut 946) MENJADI PILIHAN BERKAS (peta perkara L3 15 Okt, usulan 1).
 *
 * Dulu hasil penebak alur hanya berupa keterangan ("alur 04 [3]") tanpa dapat dipilih: 732 dari 5.501 pasangan sidang x langkah
 * (13%) tidak terjangkau pilihan sama sekali dan 38 berkas BAS Derry hanya tersambung sebagai tag. Sekarang usulan langkah, varian
 * saksi (alternatif satu alur), dan langkah di alur lain (ALUR 01, ALUR 03 [2], ALUR 05, cabut/NO/gugur) masuk `blangko.pilihan`
 * lewat SALINANNYA di folder "<jenis> - BAS" (salinanBasJenis; menu "Cerai Gugat - BAS" dst.). Langkah yang tak punya salinan
 * di folder jenis perkaranya dilewati - ia tak bisa dibuka di ABT.
 *
 * Aturan gabung (mengikuti gabungBasBaru mode "tambah"): usulan yang sudah ada (katalog arsip, pemetaan admin, format tanpa-kehadiran)
 * TIDAK diganti - pilihan baru ditambahkan di belakang; bila belum ada usulan sama sekali, langkah utama penebak alur menjadi
 * usulan PERKIRAAN. Pilihan yang berkas salinannya sama dengan pilihan yang sudah ada tidak digandakan.
 */
function alurPemilikLangkah(h: HasilAlurBas, l: LangkahAlurBas): AlurBas | null {
  if (h.alur && h.alur.langkah.includes(l)) return h.alur;
  for (const a of [...ALUR_BAS, ...ALUR_BAS_KUMULASI]) if (a.langkah.includes(l)) return a;
  // Objek langkah yang tersalin (bukan rujukan yang sama): cocokkan lewat nama berkas.
  for (const a of [...ALUR_BAS, ...ALUR_BAS_KUMULASI]) if (a.langkah.some((x) => x.berkas === l.berkas)) return a;
  return null;
}

function kunciSalinan(p: { folder: string; berkas: string; salinan?: SalinanBas[] }): string[] {
  const s = (p.salinan ?? []).map((x) => `${x.folder}|${x.berkas}`);
  return s.length ? s : [`${p.folder}|${kunciBerkasBas(p.berkas)}`];
}

function pilihanDariAlurLama(alur: AlurBas, l: LangkahAlurBas, perkiraan: boolean, jenisPerkara: string): PilihanBlangkoBas | null {
  const dasar: PilihanBlangkoBas = {
    folder: alur.folder,
    berkas: l.berkas,
    setId: alur.id,
    setNama: /^alur-\d+$/.test(alur.id) ? `ALUR ${String(alur.nomor).padStart(2, "0")} ${alur.nama}` : alur.nama,
    basKe: l.ke > 0 ? l.ke : 0,
    label: `[${l.kode}] ${l.keterangan || l.berkas.replace(/^\[[^\]]+\]\s*/, "").replace(/\.rtf$/i, "")}`.trim(),
    kehadiran: perkiraan ? "tidak-diketahui" : "cocok",
    ...(perkiraan ? { perkiraan: true } : {}),
  };
  const lengkap = denganPadanan({ usulan: null as PilihanBlangkoBas | null, pilihan: [dasar] }, jenisPerkara).pilihan[0];
  return lengkap.salinan && lengkap.salinan.length ? lengkap : null;
}

export function gabungAlurLama(
  dasar: { usulan: PilihanBlangkoBas | null; pilihan: PilihanBlangkoBas[]; sebab: string },
  h: HasilAlurBas | null,
  jenisPerkara: string,
  /** true = baris berformat tanpa-kehadiran (lewat 14.00): usulan/sebabnya tidak disentuh. */
  tahan = false
): { usulan: PilihanBlangkoBas | null; pilihan: PilihanBlangkoBas[]; sebab: string } {
  if (!h || !h.alur || !h.langkah) return dasar;
  const daftar: Array<{ alur: AlurBas; l: LangkahAlurBas; utama: boolean }> = [{ alur: h.alur, l: h.langkah, utama: true }];
  for (const l of h.alternatif) {
    const a = alurPemilikLangkah(h, l);
    if (a) daftar.push({ alur: a, l, utama: false });
  }
  for (const x of h.lainAlur ?? []) daftar.push({ alur: x.alur, l: x.langkah, utama: false });

  const ada = new Set(dasar.pilihan.flatMap(kunciSalinan));
  const baru: PilihanBlangkoBas[] = [];
  let utamaBaru: PilihanBlangkoBas | null = null;
  for (const d of daftar) {
    // Semua pilihan dari penebak alur adalah PERKIRAAN (ditebak dari urutan sidang, agenda, kehadiran) - petugas memeriksa.
    const p = pilihanDariAlurLama(d.alur, d.l, true, jenisPerkara);
    if (!p) continue;
    const kunci = kunciSalinan(p);
    if (kunci.some((k) => ada.has(k))) continue;
    kunci.forEach((k) => ada.add(k));
    baru.push(p);
    if (d.utama) utamaBaru = p;
  }
  if (baru.length === 0) return dasar;
  const batas = BATAS_PILIHAN_BLANGKO + baru.length;
  if (dasar.usulan || tahan || !utamaBaru) return { ...dasar, pilihan: [...dasar.pilihan, ...baru].slice(0, batas) };
  const utama: PilihanBlangkoBas = utamaBaru;
  return { usulan: utama, pilihan: [utama, ...baru.filter((p) => p !== utama), ...dasar.pilihan].slice(0, batas), sebab: h.sebab };
}
/**
 * Gabungan G3 + Q3: BAS baru di folder jenis lebih dulu; bila ia mengganti (mode "ganti"), alur lama sudah tak berlaku untuk baris ini;
 * selain itu pilihan dari alur lama ditambahkan.
 */
export function gabungSemuaBas(
  dasar: { usulan: PilihanBlangkoBas | null; pilihan: PilihanBlangkoBas[]; sebab: string },
  baru: HasilBasBaru | null,
  alur: HasilAlurBas | null,
  jenisPerkara: string,
  tahan = false
): { usulan: PilihanBlangkoBas | null; pilihan: PilihanBlangkoBas[]; sebab: string } {
  const g3 = gabungBasBaru(dasar, baru, tahan);
  if (baru && baru.mode === "ganti") return g3;
  return gabungAlurLama(g3, alur, jenisPerkara, tahan);
}
/* === AKHIR Q3 === */

export function alurBasBarisDariBaru(h: HasilBasBaru): AlurBasBaris {
  return {
    id: h.alur.id,
    nama: h.alur.nama,
    folder: h.alur.folder,
    kode: h.langkah.kode,
    berkas: h.langkah.berkas,
    keterangan: h.langkah.keterangan,
    alternatif: h.alternatif.map((l) => l.berkas),
    perkiraan: h.perkiraan,
    sebab: h.sebab,
  };
}
/* === AKHIR G3 === */

/** Ringkasan lembar ALETA satu perkara dari baris aleta_bas_lembar. */
export function ringkasLembar(baris: Array<{ keadaan?: unknown }>): RingkasLembar {
  const selesai = baris.filter((b) => teks(b.keadaan) === "selesai").length;
  return { jumlah: baris.length, selesai, draf: baris.length - selesai };
}

const SEBUTAN_FORMAT: Record<FormatBasTanpaHadir, string> = {
  gugur: "gugur",
  "tunda-panggil": "tunda panggil para pihak",
};

/**
 * Kehadiran satu sidang beserta tandanya (9 Okt 2026):
 *
 *   tercatat     dihadiri_oleh SIPP terisi - aturan lama
 *   antrian      SIPP kosong, sedikitnya satu pihak mengambil nomor antrian;
 *                sisi yang belum datang = belum diketahui sebelum 14.00,
 *                tidak hadir sesudahnya
 *   belum-hadir  keduanya kosong, sebelum 14.00 WITA - usulan perkiraan
 *   lewat-batas  keduanya kosong, lewat 14.00 WITA - format gugur / tunda
 */
export function kehadiranBaris(
  s: BarisSidangBas,
  o: {
    perkaraId: string;
    tanggalSidang: string;
    dihadiriMentah: number | null;
    dihadiriOleh: number | null;
    antrian?: AntrianBas;
    saat?: SaatBas | null;
  }
): { keadaan: KeadaanKehadiranBas; pt: KehadiranPt | null; tanda: TandaKehadiranBas; format: FormatTanpaHadir | null } {
  if (o.dihadiriMentah !== null) {
    return {
      keadaan: "tercatat",
      pt: kehadiranSipp(o.dihadiriOleh),
      tanda: {
        keadaan: "tercatat",
        teks: o.dihadiriOleh ? kalimatKehadiran(o.dihadiriOleh) : `kehadiran tercatat (sandi SIPP ${o.dihadiriMentah})`,
        judul: "Kehadiran menurut jadwal sidang SIPP.",
      },
      format: null,
    };
  }
  const lewat = lewatBatasKehadiran(o.tanggalSidang, o.saat);
  const antri = kehadiranDariAntrian(o.antrian, o.perkaraId, o.tanggalSidang);
  if (antri && (antri.p || antri.t)) {
    const pt: KehadiranPt = { p: antri.p ? true : lewat ? false : null, t: antri.t ? true : lewat ? false : null };
    const sisi = (hadir: boolean | null, nama: string) =>
      hadir === true ? `${nama} hadir` : hadir === false ? `${nama} tidak hadir` : `${nama} belum datang`;
    return {
      keadaan: "antrian",
      pt,
      tanda: {
        keadaan: "antrian",
        teks: `menurut antrian: ${sisi(pt.p, "P")}, ${sisi(pt.t, "T")} - belum dicatat di SIPP`,
        judul:
          "Kehadiran belum dicatat di SIPP; dibaca dari antrian sidang (pihak yang mengambil nomor = hadir). " +
          "Catat kehadirannya di SIPP sesudah sidang.",
      },
      format: null,
    };
  }
  if (!lewat) {
    return {
      keadaan: "belum-hadir",
      pt: null,
      tanda: {
        keadaan: "belum-hadir",
        teks: "belum hadir - kehadiran belum tercatat",
        judul:
          "Belum dicatat di SIPP dan belum mengambil nomor antrian. Usulan blangko menurut urutan sidang, agenda, dan keadaan perkara - " +
          "periksa kembali. Lewat pukul 14.00 WITA tanpa kehadiran, usulannya menjadi gugur atau tunda panggil para pihak.",
      },
      format: null,
    };
  }
  const format = tentukanFormatTanpaHadir(s, { antrianTerbaca: antri !== null });
  return {
    keadaan: "lewat-batas",
    pt: { p: false, t: false },
    tanda: {
      keadaan: "lewat-batas",
      teks: `lewat 14.00 tanpa kehadiran - usulan: ${SEBUTAN_FORMAT[format.jenis]}${format.ragu ? " (ragu)" : ""}`,
      judul: format.dasar.join(" "),
    },
    format,
  };
}

/**
 * Folder ABT umum yang perlu dibaca katalognya: hanya bila ada sidang yang
 * lewat 14.00 tanpa kehadiran - pagi hari tidak menambah satu panggilan pun.
 */
export function folderFormatDibutuhkan(sidang: BarisSidangBas[], antrian: AntrianBas | undefined, saat: SaatBas | null): string[] {
  for (const s of Array.isArray(sidang) ? sidang : []) {
    if (!s || !(s.dihadiriOleh === null || s.dihadiriOleh === undefined)) continue;
    const tanggal = teks(s.tanggalSidang).slice(0, 10);
    if (!lewatBatasKehadiran(tanggal, saat)) continue;
    const antri = kehadiranDariAntrian(antrian, teks(s.perkaraId), tanggal);
    if (antri && (antri.p || antri.t)) continue;
    return [...FOLDER_BAS_FORMAT];
  }
  return [];
}

/**
 * Satu baris per PERKARA (baris jadwal ganda pada tanggal yang sama - sidang
 * ditunda lalu dijadwalkan ulang - diambil yang pertama), disaring menurut
 * panitera pengganti bila `saringan` "saya".
 */
export function susunBarisBasMassal(
  sidang: BarisSidangBas[],
  opsi: {
    namaAkun: string;
    saringan: "saya" | "semua";
    katalog: Record<string, KatalogFolder | undefined>;
    lembar: Record<string, RingkasLembar | null | undefined>;
    /** Perbaikan 2 Okt sore (butir 8): Pemetaan blangko BAS dari server. */
    petaBas?: Record<string, string>;
    /** 9 Okt 2026: antrian sidang dari jawaban jadwal bot (hari berjalan saja). */
    antrian?: AntrianBas;
    /** 9 Okt 2026: saat WITA - batas 14.00. Tanpa = batasnya tidak pernah lewat. */
    saat?: SaatBas | null;
  }
): { baris: BarisBasMassal[]; jumlahSemua: number; jumlahSaya: number } {
  const sudah = new Set<string>();
  const semua: BarisBasMassal[] = [];
  for (const s of Array.isArray(sidang) ? sidang : []) {
    const nomor = teks(s?.nomorPerkara);
    if (!nomor || sudah.has(nomor)) continue;
    sudah.add(nomor);
    const perkaraId = teks(s.perkaraId);
    const dihadiriMentah = s.dihadiriOleh === null || s.dihadiriOleh === undefined ? null : angka(s.dihadiriOleh);
    const dihadiriOleh = dihadiriMentah && SEBUTAN_KEHADIRAN[dihadiriMentah] ? dihadiriMentah : null;
    const urutanSidang = angka(s.urutanSidang);
    const paniteraNama = teks(s.paniteraNama);
    const jenisPerkara = teks(s.jenisPerkara);
    const tanggalSidang = teks(s.tanggalSidang).slice(0, 10);
    const k = kehadiranBaris(s, {
      perkaraId,
      tanggalSidang,
      dihadiriMentah,
      dihadiriOleh,
      antrian: opsi.antrian,
      saat: opsi.saat,
    });
    // G3 15 Okt: BAS baru di folder jenis (lib/alur-bas-baru.ts) - dihitung sekali, dipakai blangko dan alurBas.
    const sandiHadir = dihadiriOleh ?? (k.keadaan === "antrian" ? sandiDariPt(k.pt) : null);
    const baru = tentukanBasBaru({
      jenisPerkara,
      urutanSidang,
      dihadiriOleh: sandiHadir,
      agenda: teks(s.agenda),
      tergugatPernahHadir: s.panggilan?.tergugatPernahHadir,
      sidangIkrarTalak: s.sidangIkrarTalak === true,
      kumulasi: s.kumulasi,
      nomorPerkara: nomor,
    });
    // Q3 16 Okt: hasil lengkap penebak alur (bukan hanya ringkasannya) - dipakai juga untuk pilihan blangko.
    const hasilAlurDasar = tentukanAlurBasKumulasi({
      jenisPerkara,
      urutanSidang,
      dihadiriOleh: sandiHadir,
      agenda: teks(s.agenda),
      tergugatPernahHadir: s.panggilan?.tergugatPernahHadir,
      sidangIkrarTalak: s.sidangIkrarTalak === true,
      kumulasi: s.kumulasi, // T 13 Okt
    });
    const alurDasar = ringkasAlurBas(hasilAlurDasar);
    semua.push({
      sidangId: teks(s.sidangId),
      perkaraId,
      nomorPerkara: nomor,
      jenisPerkara,
      tanggalSidang,
      jamSidang: teks(s.jamSidang),
      agenda: teks(s.agenda),
      ruangan: teks(s.ruangan),
      ditunda: s.ditunda === true,
      sudahPutus: s.sudahPutus === true,
      urutanSidang,
      dihadiriOleh,
      kehadiran: kalimatKehadiran(dihadiriOleh),
      tandaKehadiran: k.tanda,
      formatTanpaHadir: k.format,
      basSipp: typeof s.adaBas === "boolean" ? s.adaBas : null,
      paniteraNama,
      majelisNama: teks(s.majelisNama),
      pengguna: { id: penggunaKunci(paniteraNama), nama: paniteraNama },
      milikSaya: Boolean(opsi.namaAkun) && namaAdaDi(opsi.namaAkun, paniteraNama),
      saksi: {
        pihak1: angka(s.saksiPihak1),
        pihak2: angka(s.saksiPihak2),
        nama1: daftarTeks(s.saksiNamaPihak1),
        nama2: daftarTeks(s.saksiNamaPihak2),
      },
      lembar: perkaraId && opsi.lembar[perkaraId] !== undefined ? (opsi.lembar[perkaraId] ?? null) : null,
      blangko: gabungSemuaBas(pilihBlangkoBas({
        jenisPerkara,
        urutanSidang,
        // Pemetaan blangko memakai sandi kehadiran: dari SIPP, atau dari
        // antrian bila kedua sisinya sudah terbaca.
        dihadiriOleh: dihadiriOleh ?? (k.keadaan === "antrian" ? sandiDariPt(k.pt) : null),
        tergugatPernahHadir: s.panggilan?.tergugatPernahHadir,
        katalog: opsi.katalog,
        petaBas: opsi.petaBas,
        agenda: teks(s.agenda),
        // Kehadiran tercatat di SIPP: perilaku lama, tanpa perkiraan.
        ...(k.keadaan === "tercatat" ? {} : { kehadiranPt: k.pt, perkiraan: true }),
        format: k.format,
      }), baru, hasilAlurDasar, jenisPerkara, k.format !== null), // G3 15 Okt; Q3 16 Okt
      /* === ALURBAS 12 Okt === */
      alurBas: baru && (baru.mode === "ganti" || !alurDasar) ? alurBasBarisDariBaru(baru) : alurDasar, // G3 15 Okt
      /* === AKHIR ALURBAS === */
    });
  }
  const jumlahSaya = semua.filter((b) => b.milikSaya).length;
  const baris = opsi.saringan === "saya" ? semua.filter((b) => b.milikSaya) : semua;
  return { baris, jumlahSemua: semua.length, jumlahSaya };
}

/** Folder katalog yang dibutuhkan baris-baris ini - tanpa ganda. */
export function folderDibutuhkan(sidang: BarisSidangBas[]): string[] {
  const hasil = new Set<string>();
  for (const s of Array.isArray(sidang) ? sidang : []) {
    for (const set of setBasUntukPerkara(teks(s?.jenisPerkara))) hasil.add(set.folder);
  }
  return [...hasil];
}
