import {
  KEHADIRAN_KEDUA,
  KEHADIRAN_PERTAMA,
  KEHADIRAN_SEMUA,
  KEHADIRAN_TIDAK_ADA,
  bawaanTunda,
  jamSidangBerikut,
  tahapAgenda,
  tambahHari,
  type KontakPihak,
  type MediasiRiwayat,
  type RencanaKalender,
  type SidangRiwayat,
} from "@/lib/bawaan-tunda";
import { geserUsulanKeHariKerja, type PetaLibur } from "@/lib/hari-libur";
import { sebutanPihakPerkara } from "@/lib/sebutan-pihak";

/**
 * ============================================================================
 * TUNDA OTOMATIS 16.30 - ATURAN KEBIASAAN, FUNGSI MURNI (22 Okt 2026)
 * ============================================================================
 *
 * Permintaan hakim: bila sampai pukul 16.30 WITA masih ada sidang HARI INI
 * yang belum diberi hasil, sidang itu ditunda menurut kebiasaan satker. Berkas
 * ini HANYA memutuskan; ia tidak membaca dan tidak menulis apa pun. Pengumpul
 * bahan, penyimpan daftar, dan penjadwal di src/server/modules/tunda-otomatis;
 * penulisnya PENULIS TUNDA YANG SUDAH ADA (bot sidangHasilAlur, atas akun PP
 * perkara). Sejak 22 Okt 2026 tundaan DITULIS SAAT JAM PEMICU walau di luar
 * jam kerja - tidak pernah berpindah ke hari berikutnya (keputusan pengguna).
 *
 * SASARAN (tafsir 1): sidang bertanggal hari ini yang pada jam pemicu belum
 * ditunda, belum diputus, alasan/hasilnya masih kosong, dan belum punya sidang
 * sesudahnya. Yang lain DILEWATI dengan sebabnya (lihat SebabLewati).
 *
 * URUTAN ATURAN - yang pertama cocok menang:
 *
 *   7  GUGUR. Penggugat/Pemohon tidak hadir pada sidang pertama, dan sidang
 *      hari ini sidang kedua yang ia juga tidak hadir (atau kehadirannya hari
 *      ini belum tercatat di mana pun). BUKAN tunda.
 *   8  TIDAK DAPAT DITERIMA. Penggugat/Pemohon PERNAH hadir, lalu tidak hadir
 *      pada dua sidang terakhir berturut-turut (sidang sebelumnya dan hari
 *      ini) - pertama hadir, kedua dan ketiga tidak. BUKAN tunda.
 *   5  PERMOHONAN (alur permohonan / Pdt.P): tunda 7 hari.
 *   4  Ada Court Calendar + tahap pembuktian (jawab-menjawab selesai, agenda
 *      hari ini pembuktian): 7 hari bila Tergugat/Termohon punya email
 *      (domisili elektronik e-Court), 14 hari bila tidak.
 *   3  Ada Court Calendar: semua pihak dianggap hadir; tanggal = rencana
 *      Court Calendar berikutnya yang belum menjadi sidang (agendanya ikut
 *      rencana). Tanpa rencana sesudah hari ini: 14 hari.
 *   2  Belum ada Court Calendar: 14 hari.
 *
 * Mengapa 7/8 lebih dulu: gugur dan tidak dapat diterima adalah PUTUSAN
 * (wewenang majelis). Bila salah satunya terpenuhi, menunda justru menimpa
 * pilihan majelis - jadi sidang itu TIDAK ditunda dan TIDAK diputus otomatis;
 * ia menjadi USULAN untuk disahkan majelis. Kegagalan aturan ini aman: sidang
 * tetap belum diberi hasil, petugas yang memutuskan.
 *
 * Mengapa 5 sebelum 4/3: permohonan tanpa lawan tidak punya jawab-menjawab
 * dan Court Calendar-nya tidak memuat lawan untuk dipanggil.
 *
 * Mengapa 4 sebelum 3: aturan 4 adalah kekhususan aturan 3 (perkara ber-Court
 * Calendar yang sudah sampai pembuktian).
 *
 * TANGGAL (tafsir 6): tanggal yang jatuh pada Sabtu/Minggu/hari libur SKB/
 * libur tambahan Pengaturan digeser ke hari kerja berikutnya (@/lib/hari-libur,
 * sumber yang sama dengan borang tunda dan Jadwalkan Putusan).
 *
 * SIDANG KELILING: tanggal aturan lalu dicocokkan ke hari sidang keliling
 * berikutnya DI LOKASI YANG SAMA (nama ruangan, mis. "Sidang Keliling Sigi
 * Biromaru"), yaitu tanggal pertama pada atau sesudah tanggal aturan yang
 * sudah ada sidang keliling lain di lokasi itu. Tanpa tanggal lokasi: aturan
 * umum + tanda "periksa lokasi".
 *
 * KEHADIRAN Penggugat/Pemohon per sidang dari dihadiri_oleh SIPP:
 *   1 semua, 2 pihak pertama saja, 10 sebagian penggugat -> HADIR
 *   3 pihak kedua saja, 4 para pihak tidak hadir         -> TIDAK HADIR
 *   kosong / sandi lain                                  -> tidak diketahui
 * Kehadiran HARI INI: dihadiri_oleh baris hari ini bila sudah diisi, lalu
 * antrian sidang (pihak kedua mengambil nomor tetapi pihak pertama tidak =
 * tidak hadir). Selebihnya tidak diketahui - KECUALI perkara ber-Court
 * Calendar, yang menurut aturan 3 dianggap dihadiri semua pihak. Kehadiran
 * yang tidak diketahui pada perkara tanpa Court Calendar tidak menolong
 * Penggugat: aturan 7/8 tetap berlaku dan usulannya membawa tanda
 * "kehadiran hari ini belum tercatat" (yang dirugikan bila keliru hanyalah
 * otomatisasinya - sidang itu tidak ditulis apa pun).
 */

export const HARI_SATU_PEKAN = 7;
export const HARI_DUA_PEKAN = 14;
export const JAM_PEMICU_BAWAAN = "16:30";

export type AturanTunda =
  | "permohonan-7"
  | "pembuktian-elektronik-7"
  | "pembuktian-14"
  | "panggil-ulang-14"
  | "court-calendar"
  | "court-calendar-habis-14"
  | "tanpa-court-calendar-14";

export type AturanPutusan = "gugur" | "tidak-dapat-diterima";

export type SebabLewati =
  | "sudah-ditunda"
  | "sudah-diberi-hasil"
  | "sudah-diputus"
  | "sudah-ada-jadwal-berikutnya"
  | "ikrar-talak"
  | "putusan-sela"
  | "agenda-putusan"
  | "verzet"
  | "sedang-dikerjakan"
  | "sidang-berlangsung"
  | "bahan-tidak-terbaca"
  | "pp-tidak-jelas"
  | "perkiraan-verstek"
  | "dibatalkan-petugas"
  | "tanggal-tidak-terhitung";

/** Nomor aturan pengguna untuk layar dan laporan. */
export const NOMOR_ATURAN: Readonly<Record<AturanTunda | AturanPutusan, number>> = {
  gugur: 7,
  "tidak-dapat-diterima": 8,
  "permohonan-7": 5,
  "pembuktian-elektronik-7": 4,
  "pembuktian-14": 4,
  "panggil-ulang-14": 2,
  "court-calendar": 3,
  "court-calendar-habis-14": 3,
  "tanpa-court-calendar-14": 2,
};

export const KALIMAT_LEWATI: Readonly<Record<SebabLewati, string>> = {
  "sudah-ditunda": "Sudah ditunda petugas.",
  "sudah-diberi-hasil": "Hasil sidangnya sudah dicatat petugas.",
  "sudah-diputus": "Perkara sudah diputus.",
  "sudah-ada-jadwal-berikutnya": "Sudah ada jadwal sidang berikutnya.",
  "ikrar-talak": "Sidang ikrar talak - ditangani lewat tombol ikrar.",
  "putusan-sela": "Agenda putusan sela - wewenang majelis.",
  "agenda-putusan": "Agenda musyawarah/pembacaan putusan atau penetapan - kemungkinan sudah diputus, diperiksa petugas.",
  verzet: "Sidang perlawanan (verzet) - diperiksa petugas.",
  "sedang-dikerjakan": "Petugas sedang mengerjakan perkara ini.",
  "sidang-berlangsung": "Sidang masih berlangsung di ruang sidang.",
  "bahan-tidak-terbaca": "Riwayat sidang atau Court Calendar tidak terbaca - tidak menebak.",
  "pp-tidak-jelas": "Panitera sidang perkara ini tidak jelas di SIPP.",
  "perkiraan-verstek":
    // Keputusan pengguna 22 Okt: dilewati HANYA bila Penggugat/Pemohon tercatat hadir hari itu.
    "Sidang kedua atau lebih dan pihak lawan belum pernah hadir - kemungkinan besar diputus verstek hari ini, jadi tidak ditunda otomatis; petugas mencatat hasilnya.",
  "dibatalkan-petugas": "Ditandai \"jangan tunda otomatis\".",
  "tanggal-tidak-terhitung": "Tanggal sidang berikutnya tidak dapat dihitung.",
};

export type MasukanTundaOtomatis = {
  /** YYYY-MM-DD WITA. */
  hariIni: string;
  jadwalId: number;
  perkaraId: number | string;
  nomorPerkara: string;
  jenisPerkara?: string | null;
  alurPerkaraId?: number | null;
  jenisPerkaraId?: number | null;
  /** YYYY-MM-DD */
  tanggalSidang: string;
  agenda: string;
  ditunda: boolean;
  /** alasan_ditunda apa adanya ("0"/kosong = belum diberi hasil). */
  alasanDitunda?: string | null;
  sudahPutus?: boolean;
  ikrar?: boolean;
  verzet?: boolean;
  sidangKeliling?: boolean;
  /** Nama ruangan/lokasi ("Sidang Keliling Kulawi"). */
  ruangan?: string | null;
  /** dihadiri_oleh baris hari ini bila sudah terisi. */
  dihadiriOlehSekarang?: number | null;
  /** Kehadiran rinci per orang hari ini (antrian ALETA): pihak pertama tercatat hadir. null/undefined = tidak terbaca. */
  hadirRinciPertama?: boolean | null;
  /** Cara panggil Tergugat/Termohon pada panggilan terakhir (relaas SIPP). null = tidak terbaca. */
  panggilanTergugat?: { ada: boolean; elektronik: boolean; sandi?: string } | null;
  /** Antrian sidang hari ini; null = tidak ada baris antrian. */
  antrian?: { hadirPihak1: boolean; hadirPihak2: boolean; keadaan?: string } | null;
  /** Seluruh sidang perkara (urutan bebas). null = tidak terbaca. */
  riwayat: SidangRiwayat[] | null;
  mediasi?: MediasiRiwayat;
  /** null = tidak terbaca; [] = memang tidak ada. */
  kalender: readonly RencanaKalender[] | null;
  kontak?: KontakPihak | null;
  /** Tanggal sidang keliling lain di lokasi yang sama sesudah hari ini; null = tidak terbaca/bukan keliling. */
  kelilingBerikut?: readonly string[] | null;
  sedangDikerjakan?: boolean;
  /** Akun PP perkara dapat dipastikan (pilihPaniteraSidang ok). undefined = belum diperiksa. */
  ppJelas?: boolean;
  dibatalkan?: { oleh: string; pada: string } | null;
};

export type HasilTunda = {
  jenis: "tunda";
  aturan: AturanTunda;
  nomorAturan: number;
  tanggal: string;
  jam: string;
  alasan: string;
  agenda: string;
  /** Sandi dihadiri_oleh yang ditulis untuk sidang hari ini. */
  kehadiran: number;
  penjelasan: string;
  bergeserDari?: string;
  tanda: string[];
};

export type HasilUsulanPutusan = {
  jenis: AturanPutusan;
  aturan: AturanPutusan;
  nomorAturan: number;
  /** Nama status putusan untuk usulan ("Digugurkan" / "Tidak Dapat Diterima"). */
  usulanStatus: string;
  penjelasan: string;
  tanda: string[];
};

export type HasilLewati = { jenis: "lewati"; sebab: SebabLewati; penjelasan: string };

export type KeputusanTundaOtomatis = HasilTunda | HasilUsulanPutusan | HasilLewati;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const teks = (x: unknown) => String(x ?? "").trim();
const iso = (x: unknown) => teks(x).slice(0, 10);

/** Kehadiran Penggugat/Pemohon menurut sandi dihadiri_oleh. null = tidak diketahui. */
export function hadirPihakPertama(sandi: number | null | undefined): boolean | null {
  const n = Number(sandi);
  if (n === KEHADIRAN_SEMUA || n === KEHADIRAN_PERTAMA || n === 10) return true;
  if (n === KEHADIRAN_KEDUA || n === KEHADIRAN_TIDAK_ADA) return false;
  return null;
}

/** Kehadiran Penggugat/Pemohon HARI INI: baris hari ini, lalu antrian. */
export function hadirPertamaHariIni(m: Pick<MasukanTundaOtomatis, "dihadiriOlehSekarang" | "antrian" | "hadirRinciPertama">): boolean | null {
  if (m.hadirRinciPertama === true) return true;
  const tercatat = hadirPihakPertama(m.dihadiriOlehSekarang ?? null);
  if (tercatat !== null) return tercatat;
  const a = m.antrian;
  if (!a) return null;
  if (a.hadirPihak1) return true;
  // Pihak kedua mengambil nomor, pihak pertama tidak: pihak pertama tidak datang.
  if (a.hadirPihak2) return false;
  return null;
}

/** Sandi dihadiri_oleh hari ini bila diketahui dari baris/antrian; null bila tidak. */
function kehadiranDiketahui(m: MasukanTundaOtomatis): number | null {
  const n = Number(m.dihadiriOlehSekarang);
  if (n >= 1 && n <= 4) return n;
  const a = m.antrian;
  if (!a) return null;
  if (a.hadirPihak1 && a.hadirPihak2) return KEHADIRAN_SEMUA;
  if (a.hadirPihak1) return KEHADIRAN_PERTAMA;
  if (a.hadirPihak2) return KEHADIRAN_KEDUA;
  return null;
}

export function belumDiberiHasil(alasan: unknown): boolean {
  const t = teks(alasan);
  return t === "" || t === "0";
}

/** Permohonan voluntair: alur permohonan atau nomor Pdt.P (cerai talak Pdt.G BUKAN). */
export function perkaraPermohonan(m: Pick<MasukanTundaOtomatis, "alurPerkaraId" | "nomorPerkara">): boolean {
  if (Number(m.alurPerkaraId) === 16) return true;
  return /\/Pdt\.P\//i.test(teks(m.nomorPerkara));
}

function urutRiwayat(riwayat: SidangRiwayat[]) {
  return [...riwayat].sort((a, b) =>
    iso(a.tanggal) === iso(b.tanggal) ? a.jadwalId - b.jadwalId : iso(a.tanggal) < iso(b.tanggal) ? -1 : 1
  );
}

/** Sidang biasa (bukan ikrar) SEBELUM sidang ini, berurutan. */
export function sidangSebelum(m: Pick<MasukanTundaOtomatis, "riwayat" | "jadwalId" | "tanggalSidang">): SidangRiwayat[] {
  const t = iso(m.tanggalSidang);
  return urutRiwayat(m.riwayat ?? []).filter(
    (r) => !r.ikrar && r.jadwalId !== m.jadwalId && (iso(r.tanggal) < t || (iso(r.tanggal) === t && r.jadwalId < m.jadwalId))
  );
}

function adaSidangSesudah(m: MasukanTundaOtomatis): boolean {
  const t = iso(m.tanggalSidang);
  return (m.riwayat ?? []).some((r) => r.jadwalId !== m.jadwalId && (iso(r.tanggal) > t || (iso(r.tanggal) === t && r.jadwalId > m.jadwalId)));
}

/** Tahap pembuktian: agenda sidang hari ini pembuktian (jawab-menjawab sudah lewat). */
export function tahapPembuktian(agenda: string): boolean {
  const t = tahapAgenda(agenda);
  return t === "pembuktian-pertama" || t === "pembuktian-kedua";
}

const AGENDA_PUTUSAN = /musyawarah|pembacaan putusan|baca putusan|pembacaan penetapan|pengucapan putusan|putusan akhir/i;

/**
 * Tanggal aturan -> tanggal sidang: sidang keliling dicocokkan ke lokasi, lalu
 * hari libur digeser. Pulang tanggal + penjelasan tambahan + tanda.
 */
function tanggalAkhir(
  m: MasukanTundaOtomatis,
  tanggalAturan: string,
  peta: PetaLibur | undefined,
  dariCourtCalendar: boolean
): { tanggal: string; bergeserDari?: string; catatan: string[]; tanda: string[] } {
  const catatan: string[] = [];
  const tanda: string[] = [];
  let t = tanggalAturan;
  if (m.sidangKeliling) {
    const lokasi = teks(m.ruangan) || "lokasi sidang keliling";
    const daftar = Array.isArray(m.kelilingBerikut) ? [...m.kelilingBerikut].map(iso).filter((x) => ISO.test(x)).sort() : null;
    if (dariCourtCalendar) {
      if (!daftar || !daftar.includes(t)) tanda.push("periksa lokasi");
    } else if (daftar && daftar.length) {
      const cocok = daftar.find((x) => x >= t);
      if (cocok) {
        if (cocok !== t) catatan.push(`Sidang keliling: mengikuti hari sidang keliling berikutnya di ${lokasi} (${cocok}).`);
        t = cocok;
      } else {
        tanda.push("periksa lokasi");
        catatan.push(`Belum ada hari sidang keliling di ${lokasi} pada atau sesudah ${t}.`);
      }
    } else {
      tanda.push("periksa lokasi");
      catatan.push(`Kalender sidang keliling ${lokasi} belum ada - mengikuti aturan umum.`);
    }
  }
  const g = geserUsulanKeHariKerja(t, peta);
  if (g.bergeser) catatan.push(g.pemberitahuan);
  return { tanggal: g.tanggal, bergeserDari: g.bergeser ? t : undefined, catatan, tanda };
}

/**
 * Keputusan untuk satu sidang. Fungsi murni.
 *
 * @param peta  peta hari libur (SKB + tambahan); bawaannya peta yang terpasang di proses.
 */
export function putuskanTundaOtomatis(m: MasukanTundaOtomatis, peta?: PetaLibur): KeputusanTundaOtomatis {
  const lewati = (sebab: SebabLewati, tambahan = ""): HasilLewati => ({
    jenis: "lewati",
    sebab,
    penjelasan: tambahan ? `${KALIMAT_LEWATI[sebab]} ${tambahan}` : KALIMAT_LEWATI[sebab],
  });

  // ---- Bukan sasaran / dilewati ------------------------------------------
  if (m.ditunda) return lewati("sudah-ditunda");
  if (!belumDiberiHasil(m.alasanDitunda)) return lewati("sudah-diberi-hasil", `(${teks(m.alasanDitunda).slice(0, 80)})`);
  if (m.sudahPutus) return lewati("sudah-diputus");
  if (m.ikrar) return lewati("ikrar-talak");
  if (m.dibatalkan) return lewati("dibatalkan-petugas", m.dibatalkan.oleh ? `Oleh ${m.dibatalkan.oleh}.` : "");
  if (!Array.isArray(m.riwayat)) return lewati("bahan-tidak-terbaca");
  if (adaSidangSesudah(m)) return lewati("sudah-ada-jadwal-berikutnya");
  if (m.verzet) return lewati("verzet");
  if (/putusan\s+sela/i.test(m.agenda)) return lewati("putusan-sela");
  if (AGENDA_PUTUSAN.test(m.agenda)) return lewati("agenda-putusan");
  if (m.sedangDikerjakan) return lewati("sedang-dikerjakan");
  if (m.antrian && /^disidang|skors/.test(teks(m.antrian.keadaan))) return lewati("sidang-berlangsung");

  const pihak = sebutanPihakPerkara({
    alurPerkaraId: m.alurPerkaraId ?? null,
    jenisPerkaraId: m.jenisPerkaraId ?? null,
    jenisPerkaraNama: m.jenisPerkara ?? null,
    nomorPerkara: m.nomorPerkara,
  });
  const satu = pihak.satu;
  const dua = pihak.dua;
  const sebelum = sidangSebelum(m);
  const sidangKe = sebelum.length + 1;
  const adaKalender = Array.isArray(m.kalender) && m.kalender.some((r) => ISO.test(iso(r.tanggal)));
  const tercatatHariIni = hadirPertamaHariIni(m);
  // Aturan 3 pengguna: ada Court Calendar -> semua pihak DIANGGAP hadir. Kehadiran
  // yang tidak tercatat pada perkara ber-Court Calendar karena itu dibaca hadir,
  // juga untuk aturan 7/8 (terukur: 8 dari 8 usulan "tidak dapat diterima" pada
  // sidang yang sungguh ditunda petugas adalah perkara ber-Court Calendar yang
  // Penggugatnya hadir hari itu).
  const hadirHariIni = tercatatHariIni === null && adaKalender && !perkaraPermohonan(m) ? true : tercatatHariIni;
  const belumTercatat = hadirHariIni === null ? ` Kehadiran ${satu} hari ini belum tercatat - pastikan sebelum disahkan.` : "";

  // ---- 7. Gugur -----------------------------------------------------------
  if (sidangKe === 2 && hadirPihakPertama(sebelum[0]?.dihadiriOleh) === false && hadirHariIni !== true) {
    return {
      jenis: "gugur",
      aturan: "gugur",
      nomorAturan: 7,
      usulanStatus: "Digugurkan",
      penjelasan: `${satu} tidak hadir pada sidang pertama (${iso(sebelum[0].tanggal)}) dan sidang kedua hari ini.${belumTercatat} Bukan ditunda: usulan putusan GUGUR untuk disahkan majelis.`,
      tanda: hadirHariIni === null ? ["kehadiran hari ini belum tercatat"] : [],
    };
  }

  // ---- 8. Tidak dapat diterima ---------------------------------------------
  if (sidangKe >= 3 && hadirHariIni !== true) {
    const lalu = sebelum[sebelum.length - 1];
    const pernahHadir = sebelum.slice(0, -1).some((r) => hadirPihakPertama(r.dihadiriOleh) === true);
    if (hadirPihakPertama(lalu?.dihadiriOleh) === false && pernahHadir) {
      return {
        jenis: "tidak-dapat-diterima",
        aturan: "tidak-dapat-diterima",
        nomorAturan: 8,
        usulanStatus: "Tidak Dapat Diterima",
        penjelasan: `${satu} pernah hadir, lalu tidak hadir pada sidang ${iso(lalu.tanggal)} dan sidang hari ini.${belumTercatat} Bukan ditunda: usulan putusan TIDAK DAPAT DITERIMA untuk disahkan majelis.`,
        tanda: hadirHariIni === null ? ["kehadiran hari ini belum tercatat"] : [],
      };
    }
  }

  // ---- Perkiraan putus verstek -------------------------------------------
  // Terukur 21 Sep-21 Okt 2026: sidang ke-2+ yang pihak lawannya belum pernah
  // hadir berakhir PUTUS (verstek 64, lain 7) pada 71 dari 94 sidang, ditunda
  // hanya 21. Sidang seperti ini yang belum dicatat pukul 16.30 lebih mungkin
  // putusan yang belum diinput daripada tundaan - menundanya menutup jalan
  // pencatatan putus (sidang yang sudah ditunda tidak dapat diputus). Sama
  // dengan perkiraan verstek Agen H-7.
  const lawanPernahHadir = sebelum.some((r) => r.dihadiriOleh === KEHADIRAN_SEMUA || r.dihadiriOleh === KEHADIRAN_KEDUA);
  const lawanHadirHariIni =
    Number(m.dihadiriOlehSekarang) === KEHADIRAN_SEMUA || Number(m.dihadiriOlehSekarang) === KEHADIRAN_KEDUA || Boolean(m.antrian?.hadirPihak2);
  // Keputusan pengguna 22 Okt 2026: Penggugat/Pemohon TERCATAT HADIR hari itu -> tetap dilewati
  // (majelis memutus verstek bila terbukti); tidak hadir / tidak tercatat -> TUNDA 14 hari,
  // Penggugat dan Tergugat dipanggil kembali (2 minggu mengikuti panggilan Tergugat).
  const kemungkinanVerstek = !perkaraPermohonan(m) && sidangKe >= 2 && !lawanPernahHadir && !lawanHadirHariIni;
  if (kemungkinanVerstek && tercatatHariIni === true) return lewati("perkiraan-verstek");
  const panggilUlang = kemungkinanVerstek;

  if (m.ppJelas === false) return lewati("pp-tidak-jelas");
  if (!ISO.test(iso(m.tanggalSidang))) return lewati("tanggal-tidak-terhitung");
  if (!Array.isArray(m.kalender)) return lewati("bahan-tidak-terbaca", "(Court Calendar)");

  // ---- Bahan alasan/agenda: aturan borang tunda yang sudah ada -------------
  const voluntair = perkaraPermohonan(m);
  const diketahui = kehadiranDiketahui(m);
  const kehadiran = adaKalender && !voluntair ? KEHADIRAN_SEMUA : diketahui;
  const bawaan = bawaanTunda(
    {
      jadwalId: m.jadwalId,
      tanggalSidang: iso(m.tanggalSidang),
      agenda: m.agenda,
      dihadiriOlehSekarang: diketahui,
      ikrar: false,
      riwayat: m.riwayat,
      mediasi: m.mediasi ?? null,
      kalender: m.kalender,
      kontak: m.kontak ?? null,
      sebutan: { alurPerkaraId: m.alurPerkaraId ?? null, jenisPerkaraId: m.jenisPerkaraId ?? null, jenisPerkaraNama: m.jenisPerkara ?? null, nomorPerkara: m.nomorPerkara },
    },
    kehadiran
  );
  const dasar = iso(m.tanggalSidang);
  const jadi = (
    aturan: AturanTunda,
    tanggalAturan: string,
    penjelasan: string,
    pilihan: { agenda?: string; jam?: string; dariKalender?: boolean; alasan?: string; kehadiran?: number } = {}
  ): HasilTunda | HasilLewati => {
    if (!ISO.test(tanggalAturan)) return lewati("tanggal-tidak-terhitung");
    const akhir = tanggalAkhir(m, tanggalAturan, peta, Boolean(pilihan.dariKalender));
    if (!(akhir.tanggal > iso(m.hariIni))) return lewati("tanggal-tidak-terhitung");
    const agenda = teks(pilihan.agenda) || bawaan.agenda;
    const jam = /^\d{2}:\d{2}$/.test(teks(pilihan.jam)) ? teks(pilihan.jam) : jamSidangBerikut(agenda, bawaan.alasan);
    return {
      jenis: "tunda",
      aturan,
      nomorAturan: NOMOR_ATURAN[aturan],
      tanggal: akhir.tanggal,
      jam,
      alasan: teks(pilihan.alasan) || bawaan.alasan,
      agenda,
      kehadiran: pilihan.kehadiran ?? bawaan.kehadiran,
      penjelasan: [penjelasan, ...akhir.catatan].join(" "),
      bergeserDari: akhir.bergeserDari,
      tanda: akhir.tanda,
    };
  };

  // ---- Panggil ulang (kemungkinan verstek, Penggugat tidak tercatat hadir) ---
  if (panggilUlang) {
    const kalimat = `Panggil ${satu} dan ${dua}`;
    return jadi(
      "panggil-ulang-14",
      tambahHari(dasar, HARI_DUA_PEKAN),
      `${dua} belum pernah hadir dan ${satu} tidak tercatat hadir hari ini: ${satu} dan ${dua} dipanggil kembali, tunda ${HARI_DUA_PEKAN} hari.`,
      { alasan: kalimat, agenda: kalimat, kehadiran: diketahui ?? KEHADIRAN_TIDAK_ADA }
    );
  }

  // ---- 5. Permohonan ------------------------------------------------------
  if (voluntair) {
    return jadi("permohonan-7", tambahHari(dasar, HARI_SATU_PEKAN), `Perkara permohonan: tunda ${HARI_SATU_PEKAN} hari.`);
  }

  if (adaKalender) {
    // ---- 4. Court Calendar + pembuktian -----------------------------------
    if (tahapPembuktian(m.agenda)) {
      // Keputusan pengguna 22 Okt 2026: bawaan 14 hari; 7 hari bila panggilan Tergugat
      // sebelumnya PANGGILAN ELEKTRONIK (relaas SIPP sandi E) - email tidak lagi syarat.
      const p = m.panggilanTergugat;
      return p?.elektronik === true
        ? jadi("pembuktian-elektronik-7", tambahHari(dasar, HARI_SATU_PEKAN), `Ada Court Calendar, tahap pembuktian, ${dua} dipanggil lewat panggilan elektronik: tunda ${HARI_SATU_PEKAN} hari.`)
        : jadi(
            "pembuktian-14",
            tambahHari(dasar, HARI_DUA_PEKAN),
            `Ada Court Calendar, tahap pembuktian, ${!p ? "cara panggil sebelumnya tidak terbaca" : !p.ada ? `belum ada relaas ${dua}` : `${dua} tidak dipanggil elektronik`}: tunda ${HARI_DUA_PEKAN} hari.`
          );
    }
    // ---- 3. Court Calendar ------------------------------------------------
    const terjadwal = new Set((m.riwayat ?? []).map((r) => iso(r.tanggal)));
    const rencana = [...m.kalender]
      .map((r) => ({ ...r, tanggal: iso(r.tanggal) }))
      .filter((r) => ISO.test(r.tanggal))
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    const unik: RencanaKalender[] = [];
    for (const r of rencana) if (!unik.some((x) => x.tanggal === r.tanggal)) unik.push(r);
    const i = unik.findIndex((r) => r.tanggal > dasar && !terjadwal.has(r.tanggal));
    if (i >= 0) {
      const r = unik[i];
      return jadi("court-calendar", r.tanggal, `Ada Court Calendar: semua pihak dianggap hadir, tanggal mengikuti rencana ke-${i + 1} (${r.tanggal}${teks(r.agenda) ? `, ${teks(r.agenda)}` : ""}).`, {
        agenda: teks(r.agenda),
        jam: teks(r.jam).slice(0, 5),
        dariKalender: true,
      });
    }
    return jadi("court-calendar-habis-14", tambahHari(dasar, HARI_DUA_PEKAN), `Ada Court Calendar tetapi tidak ada rencana sesudah hari ini: tunda ${HARI_DUA_PEKAN} hari.`);
  }

  // ---- 2. Tanpa Court Calendar --------------------------------------------
  return jadi("tanpa-court-calendar-14", tambahHari(dasar, HARI_DUA_PEKAN), `Belum ada Court Calendar: tunda ${HARI_DUA_PEKAN} hari.`);
}

// ============================================================================
// JAM PEMICU
// ============================================================================

export function jamPemicuSah(jam: unknown): string {
  const j = teks(jam);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(j) ? j : JAM_PEMICU_BAWAAN;
}

/** Sudah jam pemicu (WITA) dan belum jalan terjadwal hari ini? */
export function jatuhTempo(jamPemicu: string, jamSekarang: string, sudahJalan: boolean): boolean {
  if (sudahJalan) return false;
  return teks(jamSekarang).slice(0, 5) >= jamPemicuSah(jamPemicu);
}

// ============================================================================
// SETELAN
// ============================================================================

export type SetelanTundaOtomatis = {
  /** Saklar utama. Bawaan MATI. */
  nyala: boolean;
  /** Mode kering: menyusun daftar tanpa menulis ke SIPP. Bawaan NYALA. */
  kering: boolean;
  jam: string;
  diubahOleh: string;
  diubahPada: string;
  /** Alamat peramban Super Admin saat menyimpan - alamat audit tulisan otomatis. */
  ip: string;
};

export const SETELAN_BAWAAN: SetelanTundaOtomatis = Object.freeze({
  nyala: false,
  kering: true,
  jam: JAM_PEMICU_BAWAAN,
  diubahOleh: "",
  diubahPada: "",
  ip: "",
});

export function bersihkanSetelan(mentah: unknown): SetelanTundaOtomatis {
  const s = (mentah && typeof mentah === "object" ? mentah : {}) as Record<string, unknown>;
  return {
    nyala: s.nyala === true,
    // Hanya false yang tegas mematikan mode kering.
    kering: s.kering !== false,
    jam: jamPemicuSah(s.jam),
    diubahOleh: teks(s.diubahOleh).slice(0, 120),
    diubahPada: teks(s.diubahPada).slice(0, 40),
    ip: teks(s.ip).slice(0, 64),
  };
}

/** Ringkasan satu kalimat keadaan saklar untuk layar. */
export function kalimatSetelan(s: SetelanTundaOtomatis): string {
  if (!s.nyala) return "Mati - tidak ada yang ditunda otomatis.";
  if (s.kering) return `Mode kering - pukul ${s.jam.replace(":", ".")} daftar usulan disusun, TIDAK ada yang ditulis ke SIPP.`;
  return `Menyala - pukul ${s.jam.replace(":", ".")} sidang yang belum diberi hasil ditunda menurut aturan.`;
}

// ============================================================================
// JAM PEMICU PADA HARI SIDANG KELILING (tambahan pengguna 22 Okt 2026)
// ============================================================================
//
// Bila saklar "Sidang keliling" AKTIF untuk tanggal itu (tabel portal
// aleta_sidang_keliling_hari), tunda otomatis dipicu pukul 14.00 WITA, bukan
// pukul 16.30. Satu hari tetap SATU jalan terjadwal: penandanya per tanggal,
// jadi jam mana pun yang lebih dulu jatuh tempo hanya menjalankannya sekali.

export const JAM_PEMICU_KELILING = "14:00";

/** "Ya" dari kolom boolean apa pun bentuknya (true, 1, "1", "t", "true", "Y"). */
export function nilaiAktif(nilai: unknown): boolean {
  if (nilai === true) return true;
  if (typeof nilai === "number") return nilai === 1;
  return /^(1|t|true|y|ya)$/i.test(teks(nilai));
}

/** Jam pemicu tanggal itu: 14.00 pada hari sidang keliling aktif, selain itu jam setelan (bawaan 16.30). */
export function jamPemicuHari(setelan: Pick<SetelanTundaOtomatis, "jam">, kelilingAktif: boolean): string {
  return kelilingAktif ? JAM_PEMICU_KELILING : jamPemicuSah(setelan.jam);
}
