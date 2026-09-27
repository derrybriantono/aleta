import type {
  BarisEvidenSkp,
  DataEvidenSkp,
  DokumenEvidenSkp,
  IndikatorEvidenSkp,
  KolomTabelEvidenSkp,
  PaketEvidenSkp,
  PeriodeSkp,
  UpayaHukumEvidenSkp,
} from "@/lib/eviden-skp-tipe";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";

/**
 * ============================================================================
 * KATALOG EVIDEN SKP HAKIM - MEMILIH PERKARA, MENGHITUNG, MENULIS SEL (2.40.0)
 * ============================================================================
 *
 * Bot mengirim FAKTA per perkara (DataEvidenSkp). Di sinilah satu-satunya
 * tempat aturan hitung: perkara mana masuk dokumen mana, realisasi tiap
 * indikator beserta dasar hitungnya, dan teks tiap sel tabel. Penggambar
 * PDF/Excel/Word hanya menggambar hasilnya.
 *
 * ============================================================================
 * KEADAAN DIBACA PER AKHIR PERIODE
 * ============================================================================
 *
 * Eviden Triwulan II yang diunduh bulan September tetap menggambarkan keadaan
 * 30 Juni: putusan, minutasi, unggahan, dan ikrar yang tanggalnya sesudah akhir
 * periode ditulis "-". Contoh spreadsheet pengguna menghitung begitu -
 * 273/Pdt.G/2026/PA.Dgl yang belum putus bertanda durasi 38 hari pada lembar
 * Triwulan II, yaitu sampai 30 Juni, bukan sampai hari lembar itu dibuat.
 * Periode yang belum berakhir dibaca sampai hari ini.
 *
 * ============================================================================
 * DURASI (HARI) - COCOK DENGAN KEEMPAT CONTOH SPREADSHEET
 * ============================================================================
 *
 * Hari kalender sejak pendaftaran sampai putusan (atau sampai akhir periode
 * bila belum putus pada tanggal itu), HARI PENDAFTARAN IKUT DIHITUNG, dikurangi
 * masa mediasi paling banyak 60 hari - aturan yang sama dengan hitungWaktuPutus
 * dan hariMediasiBersih di bot. Diperiksa atas sipp_donggala:
 *
 *   687/Pdt.G/2025  28-11-2025 s.d. 17-03-2026 = 110 - mediasi 7   = 103
 *   620/Pdt.G/2025  22-10-2025 s.d. 24-02-2026 = 126 - mediasi 28  =  98
 *   142/Pdt.G/2026  18-02-2026 s.d. 07-04-2026 =  49 - mediasi 35  =  14
 *   273/Pdt.G/2026  27-04-2026 s.d. 30-06-2026 =  65 - mediasi 27  =  38
 *                   (belum putus; mediasi 03-06 s.d. 15-07 dipotong di 30-06)
 *
 * Keempatnya sama persis dengan angka spreadsheet pengguna.
 *
 * ============================================================================
 * PERSENTASE DENGAN PENYEBUT NOL DITULIS "—"
 * ============================================================================
 *
 * "0%" atas nol perkara menyatakan sesuatu yang tidak pernah diukur. Begitu
 * pula penanda yang TIDAK TERBACA dari SIPP (null) tidak pernah dihitung
 * "tidak": dokumennya menyebut berapa yang tidak terbaca, dan bila seluruhnya
 * tidak terbaca realisasinya "—".
 */

// ============================================================================
// SKP HAKIM 2026 - BUNYI RHK DAN INDIKATOR (MUDAH DISUNTING)
// ============================================================================
//
// Disalin dari SKP hakim 2026 di eKinerja (tangkapan layar pengguna, 27
// September 2026). Bunyinya "kurang lebih" - bila berbeda dari eKinerja,
// sunting di sini saja; aturan hitung di bawah tidak membaca teks ini.

type TeksSkp = { rhk: string; kuantitas: string; kualitas: string; waktu: string };

export const SKP_HAKIM_2026 = {
  "rekap-perkara": {
    rhk: "Penyelesaian penerimaan perkara yang pasti, transparan dan akuntabel",
    kuantitas: "Jumlah penyelesaian perkara yang ditangani",
    kualitas: "Tingkat kesesuaian jumlah perkara yang diselesaikan tepat waktu dengan jumlah perkara yang ditangani",
    waktu: "Tingkat kesesuaian kelengkapan berkas yang akan diminutasi",
  },
  "rekap-minutasi": {
    rhk: "Terwujudnya ketepatan waktu penyampaian salinan putusan guna menjamin kepastian hukum bagi para pihak",
    kuantitas: "Tingkat kesesuaian kelengkapan berkas yang akan diminutasi",
    kualitas: "Jumlah berkas perkara ditangani yang diminutasi tepat waktu",
    waktu: "Tingkat ketepatan waktu penyelesaian administrasi perkara",
  },
  "rekap-musyawarah-majelis": {
    rhk: "Penyelesaian Pengelolaan Administrasi Perkara",
    kuantitas: "Jumlah pelaksanaan musyawarah majelis yang diikuti",
    kualitas: "Tingkat ketepatan jumlah perkara yang diselesaikan dengan hasil musyawarah majelis",
    waktu: "Tingkat ketepatan waktu dalam melakukan musyawarah majelis",
  },
  "rekap-mediasi": {
    rhk: "Penyelesaian proses mediasi",
    kuantitas: "Pelaksanaan perkara melalui mediasi",
    kualitas: "Tingkat penyelesaian perkara melalui mediasi",
    waktu: "Tingkat ketepatan waktu penyelesaian perkara melalui mediasi",
  },
  "rekap-sidang-keliling": {
    rhk: "Pelaksanaan sidang di luar gedung pengadilan",
    kuantitas: "Jumlah perkara yang ditangani di luar gedung pengadilan",
    kualitas: "Tingkat penyelesaian perkara yang dilaksanakan di luar gedung pengadilan",
    waktu: "Tingkat ketepatan waktu penanganan perkara yang dilaksanakan di luar gedung pengadilan",
  },
  "rekap-ecourt": {
    rhk:
      "Terwujudnya penyelesaian perkara perdata agama melalui pemanfaatan sistem e-Court guna mendukung peradilan yang cepat, sederhana, dan biaya ringan",
    kuantitas: "Jumlah perkara perdata yang diselesaikan melalui sistem administrasi e-Court",
    kualitas: "Persentase pemanfaatan fitur e-Summons dan e-Litigasi dalam proses persidangan",
    waktu: "Efisiensi waktu penyelesaian perkara melalui prosedur persidangan elektronik",
  },
  "rekap-isbat-terpadu": {
    rhk: "Pelaksanaan sidang Isbat Nikah Terpadu",
    kuantitas: "Jumlah perkara isbat nikah terpadu yang ditangani",
    kualitas: "Tingkat penyelesaian perkara isbat nikah terpadu",
    waktu: "Tingkat ketepatan waktu penanganan perkara isbat nikah terpadu",
  },
  "rekap-ikrar-talak": {
    rhk: "Terselenggaranya persidangan penyaksian ikrar talak secara tepat waktu setelah putusan berkekuatan hukum tetap",
    kuantitas: "Jumlah perkara cerai talak yang diselesaikan sampai tahap sidang penyaksian ikrar talak",
    kualitas: "Persentase pelaksanaan sidang ikrar talak yang sesuai dengan penetapan hari sidang dan hukum acara",
    waktu: "Rata-rata waktu pemanggilan hingga pelaksanaan sidang ikrar talak",
  },
  "rekap-salinan-putusan": {
    rhk: "Terwujudnya ketepatan waktu penyampaian salinan putusan guna menjamin kepastian hukum bagi para pihak",
    kuantitas: "Jumlah salinan putusan perkara yang diminutasi dan siap disampaikan",
    kualitas: "Persentase kesesuaian prosedur penyampaian salinan putusan dengan SOP yang berlaku",
    waktu: "Tingkat ketepatan waktu penyelesaian penyampaian salinan putusan",
  },
  "rekap-prodeo": {
    rhk: "Penyelesaian administrasi perkara melalui pembebasan biaya perkara (prodeo)",
    kuantitas: "Jumlah perkara yang ditangani secara Prodeo",
    kualitas: "Waktu kesesuaian waktu dalam penanganan perkara secara prodeo",
    waktu: "Tingkat ketepatan waktu penyelesaian perkara secara prodeo",
  },
  "rekap-direktori-putusan": {
    rhk:
      "Terlaksananya pengunggahan putusan ke dalam Direktori Putusan Mahkamah Agung secara lengkap dan tepat waktu guna mewujudkan transparansi informasi",
    kuantitas: "Jumlah putusan yang dipublikasikan pada direktori putusan Mahkamah Agung",
    kualitas: "Persentase putusan yang diunggah secara lengkap (termasuk anonimisasi data pribadi)",
    waktu: "Ketepatan waktu pengunggahan putusan segera setelah minutasi selesai",
  },
  "rekap-selesai-minutasi": {
    rhk:
      "Meningkatnya kualitas tata kelola administrasi perkara yang akuntabel, transparan, dan tepat waktu guna mendukung peningkatan kepuasan pengguna layanan pengadilan",
    kuantitas: "Jumlah dokumen administrasi perkara yang diselesaikan secara akuntabel",
    kualitas: "Persentase kesesuaian hasil pengelolaan administrasi perkara terhadap standar layanan",
    waktu: "Tingkat ketepatan waktu penyelesaian administrasi perkara sesuai SOP",
  },
  "rekap-upaya-hukum": {
    rhk:
      "Terselenggaranya pengelolaan administrasi persidangan dan pengiriman pemberitahuan putusan hukum yang cepat dan akurat guna menjamin hak informasi para pihak dan kepastian hukum",
    kuantitas:
      "Jumlah dokumen pemberitahuan petikan/amar putusan Tingkat Banding, Kasasi, dan PK yang dikirimkan kepada para pihak",
    kualitas:
      "Tingkat akurasi identitas dan alamat para pihak dalam dokumen pemberitahuan sesuai dengan data dalam berkas perkara",
    waktu: "Ketepatan waktu penginputan tanggal pengiriman pemberitahuan ke dalam aplikasi SIPP",
  },
} as const satisfies Record<string, TeksSkp>;

type KunciRekap = keyof typeof SKP_HAKIM_2026;

/**
 * Bukti dukung SKP yang BUKAN data SIPP - tetap tampil di menu, nonaktif,
 * beserta sebabnya. Diperiksa 27 September 2026 atas sipp_donggala.
 */
const TIDAK_TERSEDIA = {
  "laporan-posbakum":
    "SIPP tidak mencatat layanan Pos Bantuan Hukum: tabel perkara_bantuan_hukum hanya untuk penetapan bantuan hukum perkara pidana, dan kosong di SIPP satker. Laporan Posbakum disusun dari register Posbakum.",
  "kegiatan-sipintar":
    "Kegiatan SIPINTAR dan bimbingan teknis tidak dicatat di SIPP - buktinya sertifikat atau daftar hadir kegiatannya.",
  "laporan-hawasbid":
    "Laporan hakim pengawas bidang tidak dicatat di SIPP; tabel hakim pengawas SIPP untuk hakim pengawas kepailitan, bukan Hawasbid.",
} as const;

/** Daftar dokumen yang dapat diunduh, berurutan seperti di menu. */
export const DAFTAR_DOKUMEN_EVIDEN_SKP: ReadonlyArray<{ kunci: string; judul: string }> = [
  { kunci: "status-perkara", judul: "Status Perkara" },
  { kunci: "rekap-perkara", judul: "Rekap Perkara" },
  { kunci: "rekap-minutasi", judul: "Rekap Minutasi" },
  { kunci: "rekap-musyawarah-majelis", judul: "Rekap Musyawarah Majelis" },
  { kunci: "rekap-mediasi", judul: "Rekap Mediasi" },
  { kunci: "rekap-sidang-keliling", judul: "Rekap Sidang Keliling" },
  { kunci: "rekap-ecourt", judul: "Rekap Perkara Yang Di Daftar Secara E-Court" },
  { kunci: "rekap-isbat-terpadu", judul: "Rekap Perkara Isbat Terpadu" },
  { kunci: "rekap-ikrar-talak", judul: "Rekap Pelaksanaan Ikrar Talak" },
  { kunci: "rekap-salinan-putusan", judul: "Rekap Salinan Putusan Yang Telah Terunggah di SIPP" },
  { kunci: "rekap-prodeo", judul: "Rekap Perkara Yang Dibebaskan Biaya (Prodeo)" },
  { kunci: "rekap-direktori-putusan", judul: "Rekap Perkara Yang Terpublikasi Di Direktori Putusan Mahkamah Agung" },
  { kunci: "rekap-selesai-minutasi", judul: "Rekap Perkara Yang Selesai Prosedur dan Telah Di Minutasi" },
  { kunci: "rekap-upaya-hukum", judul: "Rekap Perkara Yang Melakukan Upaya Hukum (Banding/Kasasi/PK)" },
  { kunci: "laporan-posbakum", judul: "Rekap Laporan Posbakum" },
  { kunci: "kegiatan-sipintar", judul: "Kegiatan SIPINTAR/Bimtek" },
  { kunci: "laporan-hawasbid", judul: "Laporan Hawasbid" },
];

// ============================================================================
// AMBANG - SATU ANGKA, SATU SUMBER
// ============================================================================

/** Lima bulan, SEMA 2/2014 - sama dengan AMBANG_DURASI_HARI di bot. */
export const AMBANG_TEPAT_WAKTU_HARI = 150;
/** PERMA 1/2016 Pasal 24: 30 hari + perpanjangan 30 - sama dengan BATAS_POTONG_MEDIASI_HARI bot. */
export const BATAS_POTONG_MEDIASI_HARI = 60;
/** Pasal 70 ayat (6) UU 7/1989: enam bulan sejak BHT - sama dengan KT16 penilaianTahapanService. */
export const BATAS_IKRAR_HARI = 180;

// ============================================================================
// TANGGAL DAN ANGKA - MURNI
// ============================================================================

const NAMA_BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function sahIso(nilai: unknown): string | null {
  const teks = String(nilai ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(teks) && !teks.startsWith("0000") ? teks : null;
}

/** "28/11/2025" - bentuk tanggal di spreadsheet pengguna. */
export function formatTanggal(iso: string | null | undefined): string {
  const t = sahIso(iso);
  if (!t) return "-";
  return `${t.slice(8, 10)}/${t.slice(5, 7)}/${t.slice(0, 4)}`;
}

/** "30 Juni 2026". */
export function tanggalPanjang(iso: string | null | undefined): string {
  const t = sahIso(iso);
  if (!t) return "";
  return `${Number(t.slice(8, 10))} ${NAMA_BULAN[Number(t.slice(5, 7)) - 1]} ${t.slice(0, 4)}`;
}

/** Selisih hari kalender (sampai - dari), atau null. */
export function selisihHari(dari: string | null | undefined, sampai: string | null | undefined): number | null {
  const a = sahIso(dari);
  const b = sahIso(sampai);
  if (!a || !b) return null;
  const ms = (t: string) => Date.UTC(Number(t.slice(0, 4)), Number(t.slice(5, 7)) - 1, Number(t.slice(8, 10)));
  return Math.round((ms(b) - ms(a)) / 86400000);
}

/** Tanggal WITA dari cap waktu ISO - "hari ini" menurut pengadilan, bukan peladen. */
export function tanggalWita(iso: string): string | null {
  const saat = new Date(iso);
  if (Number.isNaN(saat.getTime())) return null;
  return waktuPengadilan(saat).tanggal;
}

/** "91,7%" - satu desimal, koma; ",0" dibuang. Penyebut nol = "—". */
export function persen(pembilang: number, penyebut: number): string {
  if (!(penyebut > 0)) return "—";
  const nilai = Math.round((pembilang / penyebut) * 1000) / 10;
  return `${String(nilai).replace(".", ",")}%`;
}

/**
 * Hari mediasi yang dikeluarkan dari durasi - kembaran hariMediasiBersih bot
 * (sippJadwalSidangService.js):
 *
 *   1. baris bertanggal mulai SAMA menerangkan mediasi yang sama; yang
 *      berujung menang atas yang menggantung;
 *   2. yang menggantung (belum diputuskan) berjalan sampai `sampai`;
 *   3. tiap rentang dijepit ke [daftar, sampai];
 *   4. yang bertindih disatukan, tidak dijumlah;
 *   5. jumlahnya paling banyak 60 hari.
 */
export function hariMediasiBersih(
  rentang: ReadonlyArray<{ mulai: string; selesai: string | null }> | undefined,
  daftar: string,
  sampai: string
): number {
  if (!rentang || !sahIso(daftar) || !sahIso(sampai)) return 0;
  const perMulai = new Map<string, Array<string | null>>();
  for (const r of rentang) {
    const mulai = sahIso(r.mulai);
    if (!mulai) continue;
    const kelompok = perMulai.get(mulai) ?? [];
    kelompok.push(sahIso(r.selesai));
    perMulai.set(mulai, kelompok);
  }
  const potong: Array<{ mulai: string; selesai: string }> = [];
  for (const [mulaiMentah, ujung] of perMulai) {
    const berujung = ujung.filter((x): x is string => Boolean(x)).sort();
    const selesaiMentah = berujung.length ? berujung[berujung.length - 1] : sampai;
    const mulai = mulaiMentah > daftar ? mulaiMentah : daftar;
    const selesai = selesaiMentah < sampai ? selesaiMentah : sampai;
    if (selesai <= mulai) continue;
    potong.push({ mulai, selesai });
  }
  potong.sort((a, b) => (a.mulai < b.mulai ? -1 : a.mulai > b.mulai ? 1 : 0));
  const gabung: Array<{ mulai: string; selesai: string }> = [];
  for (const r of potong) {
    const akhir = gabung[gabung.length - 1];
    if (akhir && r.mulai <= akhir.selesai) {
      if (r.selesai > akhir.selesai) akhir.selesai = r.selesai;
    } else {
      gabung.push({ ...r });
    }
  }
  const hari = gabung.reduce((jumlah, r) => jumlah + Math.max(0, selisihHari(r.mulai, r.selesai) ?? 0), 0);
  return Math.min(hari, BATAS_POTONG_MEDIASI_HARI);
}

// ============================================================================
// KONTEKS PERIODE DAN ATURAN PERKARA - MURNI
// ============================================================================

export type KonteksEviden = {
  periode: PeriodeSkp;
  mulai: string;
  akhir: string;
  /** Hari ini WITA, dari dihitungPada. */
  hariIni: string;
  /** Batas keadaan: akhir periode, atau hari ini bila periode belum berakhir. */
  batas: string;
  berjalan: boolean;
  idOrang: string;
};

export function konteksEviden(data: DataEvidenSkp): KonteksEviden {
  const akhir = data.periode.selesai;
  const hariIni = tanggalWita(data.dihitungPada) ?? akhir;
  const berjalan = hariIni < akhir;
  return {
    periode: data.periode,
    mulai: data.periode.mulai,
    akhir,
    hariIni,
    batas: berjalan ? hariIni : akhir,
    berjalan,
    idOrang: String(data.orang.id),
  };
}

const PEMERIKSA = new Set(["hakim-ketua", "hakim-anggota", "hakim-tunggal"]);

export function adalahPemeriksa(b: BarisEvidenSkp): boolean {
  return b.hubungan.some((h) => PEMERIKSA.has(h));
}

/** Terisi dan paling lambat batas keadaan. */
function sampaiBatas(tanggal: string | null | undefined, k: KonteksEviden): boolean {
  const t = sahIso(tanggal);
  return Boolean(t && t <= k.batas);
}

/**
 * Dalam periode SAMPAI BATAS KEADAAN - bukan sampai akhir periode. Periode
 * yang belum berakhir hanya dibaca sampai hari ini: musyawarah, ikrar, atau
 * pemberitahuan yang baru dijadwalkan sesudahnya belum terjadi. Batas yang
 * sama dengan bot (batasKeadaan di evidenSkpService).
 */
function dalamPeriode(tanggal: string | null | undefined, k: KonteksEviden): boolean {
  const t = sahIso(tanggal);
  return Boolean(t && t >= k.mulai && t <= k.batas);
}

/**
 * Perkara majelis pemeriksa yang masuk periode: didaftarkan paling lambat
 * batas keadaan DAN belum putus atau putus sejak awal periode. Aturan yang
 * sama dengan saringan bot (evidenSkpService) - di sana untuk memilih perkara
 * yang dibaca, di sini untuk memisahkannya dari perkara yang hanya masuk
 * lewat upaya hukum.
 */
export function masukPeriodePemeriksa(b: BarisEvidenSkp, k: KonteksEviden): boolean {
  if (!adalahPemeriksa(b)) return false;
  const daftar = sahIso(b.tanggalDaftar);
  if (!daftar || daftar > k.batas) return false;
  const putus = sahIso(b.tanggalPutusan);
  return !putus || putus >= k.mulai;
}

export function putusPerBatas(b: BarisEvidenSkp, k: KonteksEviden): boolean {
  return sampaiBatas(b.tanggalPutusan, k);
}

export function putusDalamPeriode(b: BarisEvidenSkp, k: KonteksEviden): boolean {
  return dalamPeriode(b.tanggalPutusan, k);
}

/**
 * Durasi (Hari): pendaftaran sampai putusan, atau sampai batas keadaan bila
 * belum putus saat itu; hari pendaftaran ikut dihitung; masa mediasi keluar
 * (paling banyak 60 hari, tidak melebihi durasinya sendiri).
 */
export function durasiPerkara(b: BarisEvidenSkp, k: KonteksEviden): number | null {
  const daftar = sahIso(b.tanggalDaftar);
  if (!daftar) return null;
  const sampai = putusPerBatas(b, k) ? (sahIso(b.tanggalPutusan) as string) : k.batas;
  const selisih = selisihHari(daftar, sampai);
  if (selisih === null || selisih < 0) return null;
  const kotor = selisih + 1;
  const mediasi = Math.min(hariMediasiBersih(b.rentangMediasi, daftar, sampai), Math.max(0, kotor - 1));
  return kotor - mediasi;
}

export function tepatWaktu(b: BarisEvidenSkp, k: KonteksEviden): boolean {
  const durasi = durasiPerkara(b, k);
  return durasi !== null && durasi <= AMBANG_TEPAT_WAKTU_HARI;
}

// ============================================================================
// TEKS SEL - BENTUK SEPERTI SPREADSHEET PENGGUNA
// ============================================================================

const TIDAK_TERBACA = "Tidak terbaca";

function hurufJudulKata(teks: string): string {
  return teks.replace(/(^|\s)(\S)/g, (_, depan: string, huruf: string) => `${depan}${huruf.toUpperCase()}`);
}

/** "Penggugat:\nNAMA\nTergugat:\n1.NAMA\n2.NAMA" - satu nama tanpa nomor. */
export function teksPihak(b: BarisEvidenSkp): string {
  const baris: string[] = [];
  const sisi = (p: { sebutan: string; nama: string[] } | null) => {
    if (!p) return;
    baris.push(`${p.sebutan}:`);
    if (p.nama.length === 0) baris.push("-");
    else if (p.nama.length === 1) baris.push(p.nama[0]);
    else p.nama.forEach((nama, i) => baris.push(`${i + 1}.${nama}`));
  };
  sisi(b.pihak.satu);
  sisi(b.pihak.dua);
  sisi(b.pihak.turut);
  return baris.join("\n");
}

/** "Hakim Ketua: X\nHakim Anggota 1: Y" - satu orang satu baris. */
export function teksMajelis(majelis: BarisEvidenSkp["majelis"]): string {
  const lihat = new Set<string>();
  const baris: string[] = [];
  for (const m of majelis) {
    const kunci = `${m.kedudukan}|${m.hakimId ?? m.nama}`;
    if (lihat.has(kunci)) continue;
    lihat.add(kunci);
    baris.push(`${m.kedudukan}: ${m.nama}`);
  }
  return baris.length ? baris.join("\n") : "-";
}

function teksDaftarNama(nama: string[]): string {
  return nama.length ? nama.join("\n") : "-";
}

export function teksPutusan(b: BarisEvidenSkp, k: KonteksEviden): string {
  if (!putusPerBatas(b, k)) return "-";
  return b.statusPutusan ? `Putus (${b.statusPutusan})` : "Putus";
}

export function teksMediasi(b: BarisEvidenSkp, k: KonteksEviden): string {
  const m = b.mediasi;
  if (!m || !sampaiBatas(m.tanggalPenetapan, k)) return "-";
  if (!sampaiBatas(m.tanggalLaporan, k)) return "Proses Mediasi";
  return m.hasil ? hurufJudulKata(m.hasil) : "Hasil Tidak Tercatat";
}

function teksUpaya(u: UpayaHukumEvidenSkp | null, nama: string, k: KonteksEviden): string {
  return u && sampaiBatas(u.tanggalPermohonan, k) ? nama : "-";
}

function teksPenanda(nilai: boolean | null | undefined, teks: string): string {
  if (nilai === null || nilai === undefined) return TIDAK_TERBACA;
  return nilai ? teks : "-";
}

function teksUnggah(u: { ada: boolean; tanggal: string | null } | null, teks: string, k: KonteksEviden): string {
  if (!u) return TIDAK_TERBACA;
  // Tanggal unggah yang tidak terbaca tidak menggugurkan unggahannya.
  return u.ada && (!u.tanggal || u.tanggal <= k.batas) ? teks : "-";
}

function unggahSampaiBatas(u: { ada: boolean; tanggal: string | null } | null, k: KonteksEviden): boolean | null {
  if (!u) return null;
  return u.ada && (!u.tanggal || u.tanggal <= k.batas);
}

function direktoriSampaiBatas(b: BarisEvidenSkp, k: KonteksEviden): boolean | null {
  if (!b.direktori) return null;
  return Boolean(b.direktori.url) && (!b.direktori.tanggal || b.direktori.tanggal <= k.batas);
}

function teksDirektori(b: BarisEvidenSkp, k: KonteksEviden): string {
  const ada = direktoriSampaiBatas(b, k);
  if (ada === null) return TIDAK_TERBACA;
  return ada && b.direktori?.url ? b.direktori.url : "-";
}

function musyawarahSampaiBatas(b: BarisEvidenSkp, k: KonteksEviden): boolean {
  return sampaiBatas(b.musyawarah?.tanggal, k);
}

/** Kedudukan orang yang dibuatkan eviden pada majelis itu ("Hakim Anggota 2"). */
function kedudukanOrang(majelis: BarisEvidenSkp["majelis"], k: KonteksEviden): string {
  const milik = majelis.filter((m) => m.hakimId === k.idOrang).map((m) => m.kedudukan);
  return milik.length ? [...new Set(milik)].join(", ") : "-";
}

// ============================================================================
// KOLOM - STATUS PERKARA 25 KOLOM PERSIS SEPERTI SPREADSHEET
// ============================================================================

export const KOLOM_STATUS_PERKARA: KolomTabelEvidenSkp[] = [
  { kunci: "no", judul: "No", bobot: 0.5, rata: "tengah" },
  { kunci: "nomor", judul: "Nomor Perkara", bobot: 2 },
  { kunci: "jenis", judul: "Jenis Perkara", bobot: 1.5 },
  { kunci: "daftar", judul: "Tanggal Pendaftaran", bobot: 1.2, rata: "tengah" },
  { kunci: "pihak", judul: "Para Pihak", bobot: 3.5 },
  { kunci: "majelis", judul: "Majelis Hakim", bobot: 3 },
  { kunci: "panitera", judul: "Panitera", bobot: 1.8 },
  { kunci: "jurusita", judul: "Jurusita", bobot: 1.6 },
  { kunci: "musyawarah", judul: "Musyawarah Majelis", bobot: 1.2, rata: "tengah" },
  { kunci: "durasi", judul: "Durasi (Hari)", bobot: 0.8, rata: "tengah" },
  { kunci: "mediasi", judul: "Mediasi", bobot: 1.4, rata: "tengah" },
  { kunci: "putusan", judul: "Putusan", bobot: 1.5, rata: "tengah" },
  { kunci: "minutasi", judul: "Minutasi", bobot: 1.2, rata: "tengah" },
  { kunci: "ikrar", judul: "Ikrar Talak", bobot: 1.1, rata: "tengah" },
  { kunci: "banding", judul: "Banding", bobot: 1, rata: "tengah" },
  { kunci: "kasasi", judul: "Kasasi", bobot: 1, rata: "tengah" },
  { kunci: "pk", judul: "Peninjauan Kembali (PK)", bobot: 1.2, rata: "tengah" },
  { kunci: "keliling", judul: "Sidang Keliling", bobot: 1.1, rata: "tengah" },
  { kunci: "terpadu", judul: "Itsbat Terpadu", bobot: 1.1, rata: "tengah" },
  { kunci: "ghaib", judul: "Ghaib", bobot: 0.8, rata: "tengah" },
  { kunci: "prodeo", judul: "Prodeo", bobot: 0.8, rata: "tengah" },
  { kunci: "ecourt", judul: "E-Court", bobot: 0.9, rata: "tengah" },
  { kunci: "unggah", judul: "Upload Putusan", bobot: 1.1, rata: "tengah" },
  { kunci: "anonimisasi", judul: "Anonimisasi", bobot: 1.3, rata: "tengah" },
  { kunci: "direktori", judul: "Direktori Putusan", bobot: 3 },
];

export function selStatusPerkara(b: BarisEvidenSkp, k: KonteksEviden, no: number): Record<string, string> {
  const durasi = durasiPerkara(b, k);
  return {
    no: String(no),
    nomor: b.nomorPerkara,
    jenis: b.jenisPerkara,
    daftar: formatTanggal(b.tanggalDaftar),
    pihak: teksPihak(b),
    majelis: teksMajelis(b.majelis),
    panitera: teksDaftarNama(b.panitera),
    jurusita: teksDaftarNama(b.jurusita),
    musyawarah: musyawarahSampaiBatas(b, k) ? "Terlaksana MM" : "-",
    durasi: durasi === null ? "-" : String(durasi),
    mediasi: teksMediasi(b, k),
    putusan: teksPutusan(b, k),
    minutasi: sampaiBatas(b.tanggalMinutasi, k) ? "Telah Di Minutasi" : "-",
    ikrar: sampaiBatas(b.ikrar?.tanggalIkrar, k) ? "Telah Ikrar Talak" : "-",
    banding: teksUpaya(b.banding, "Banding", k),
    kasasi: teksUpaya(b.kasasi, "Kasasi", k),
    pk: teksUpaya(b.pk, "Peninjauan Kembali", k),
    keliling: teksPenanda(b.sidangKeliling, "Sidang Keliling"),
    terpadu: teksPenanda(b.itsbatTerpadu, "Itsbat Terpadu"),
    ghaib: teksPenanda(b.ghaib, "Ghaib"),
    prodeo: teksPenanda(b.prodeo, "Prodeo"),
    ecourt: teksPenanda(b.ecourt, "E-Court"),
    unggah: teksUnggah(b.unggahPutusan, "Telah Di Upload", k),
    anonimisasi: teksUnggah(b.anonimisasi, "Telah Di Anonimisasi", k),
    direktori: teksDirektori(b, k),
  };
}

// ============================================================================
// PENYUSUN DOKUMEN
// ============================================================================

function urutDaftar(a: BarisEvidenSkp, b: BarisEvidenSkp): number {
  const x = a.tanggalDaftar ?? "";
  const y = b.tanggalDaftar ?? "";
  if (x !== y) return x < y ? -1 : 1;
  return Number(a.perkaraId) - Number(b.perkaraId);
}

function bernomor(baris: Array<Record<string, string>>): Array<Record<string, string>> {
  return baris.map((b, i) => ({ ...b, no: String(i + 1) }));
}

type Isi = {
  rhk: string | null;
  indikator: IndikatorEvidenSkp[];
  kolom: KolomTabelEvidenSkp[];
  baris: Array<Record<string, string>>;
  catatan: string[];
};

function judulDaftar(kunci: string): string {
  return DAFTAR_DOKUMEN_EVIDEN_SKP.find((d) => d.kunci === kunci)?.judul ?? kunci;
}

function dokumen(kunci: string, k: KonteksEviden, isi: Isi): DokumenEvidenSkp {
  const judul = judulDaftar(kunci);
  return {
    kunci,
    judul: judul.toUpperCase(),
    judulLengkap: `${judul} ${k.periode.labelPanjang}`,
    tersedia: true,
    rhk: isi.rhk,
    indikator: isi.indikator,
    tabel: { kolom: isi.kolom, baris: bernomor(isi.baris) },
    catatan: isi.catatan,
  };
}

function kalimatBatas(k: KonteksEviden): string {
  return k.berjalan
    ? `Periode belum berakhir: keadaan tiap perkara dibaca sampai ${tanggalPanjang(k.hariIni)}.`
    : `Keadaan tiap perkara dibaca per ${tanggalPanjang(k.akhir)}; yang terjadi sesudahnya ditulis "-".`;
}

const KALIMAT_DURASI =
  "Durasi (Hari): hari kalender sejak pendaftaran sampai putusan - atau sampai batas keadaan bila belum putus - hari " +
  `pendaftaran ikut dihitung, dikurangi masa mediasi paling banyak ${BATAS_POTONG_MEDIASI_HARI} hari (PERMA 1/2016).`;

const KALIMAT_TEPAT_WAKTU = `Tepat waktu = durasi paling lama ${AMBANG_TEPAT_WAKTU_HARI} hari (lima bulan, SEMA 2/2014).`;

/**
 * Lama yang sudah dijalani sejak `mulai` sampai `sampai` (keduanya ikut
 * dihitung): bulan penuh, lalu sisa hari. "8 Bulan 27 Hari", "3 Bulan",
 * "1 Hari". Periode SKP selalu bermula tanggal 1, jadi bulan penuhnya tidak
 * terganggu panjang bulan yang berbeda-beda.
 */
export function lamaDijalani(mulai: string, sampai: string): string {
  const a = sahIso(mulai);
  const b = sahIso(sampai);
  if (!a || !b || b < a) return "0 Hari";
  const tambahBulan = (iso: string, n: number) => {
    const t = new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1 + n, Number(iso.slice(8, 10))));
    return t.toISOString().slice(0, 10);
  };
  // Batas atas eksklusif: sehari sesudah `sampai`.
  const ujung = new Date(Date.UTC(Number(b.slice(0, 4)), Number(b.slice(5, 7)) - 1, Number(b.slice(8, 10)) + 1))
    .toISOString()
    .slice(0, 10);
  let bulan = 0;
  while (tambahBulan(a, bulan + 1) <= ujung) bulan += 1;
  const hari = selisihHari(tambahBulan(a, bulan), ujung) ?? 0;
  if (bulan === 0) return `${hari} Hari`;
  return hari > 0 ? `${bulan} Bulan ${hari} Hari` : `${bulan} Bulan`;
}

/**
 * Aspek Waktu. Periode yang sudah selesai: "3 Bulan" / "12 Bulan". Periode
 * yang BELUM berakhir: lama yang sudah dijalani sampai hari ini - menulis
 * "12 Bulan" pada bulan September menyatakan sesuatu yang belum terjadi.
 */
function indikatorWaktu(teks: string, k: KonteksEviden, tambahan = ""): IndikatorEvidenSkp {
  const ekor = tambahan ? ` ${tambahan}` : "";
  if (k.berjalan) {
    return {
      aspek: "Waktu",
      teks,
      realisasi: `${lamaDijalani(k.mulai, k.batas)}, s.d. ${tanggalPanjang(k.batas)}`,
      dasar:
        `Periode ${k.periode.labelPanjang} belum berakhir: yang sudah dijalani ${tanggalPanjang(k.mulai)} s.d. ` +
        `${tanggalPanjang(k.batas)}, dari ${k.periode.bulan} bulan (sampai ${tanggalPanjang(k.akhir)}).${ekor}`,
    };
  }
  const rentang = `${tanggalPanjang(k.mulai)} s.d. ${tanggalPanjang(k.akhir)}`;
  return {
    aspek: "Waktu",
    teks,
    realisasi: `${k.periode.bulan} Bulan`,
    dasar: `Periode ${k.periode.labelPanjang}: ${rentang}.${ekor}`,
  };
}

/**
 * Saringan atas penanda boolean yang dapat TIDAK TERBACA (null): yang null
 * tidak masuk dan tidak dihitung "tidak" - jumlahnya disebut.
 */
function saringPenanda(
  dasar: BarisEvidenSkp[],
  ambil: (b: BarisEvidenSkp) => boolean | null | undefined
): { cocok: BarisEvidenSkp[]; takTerbaca: number; seluruhnyaTakTerbaca: boolean } {
  const takTerbaca = dasar.filter((b) => {
    const nilai = ambil(b);
    return nilai === null || nilai === undefined;
  }).length;
  return {
    cocok: dasar.filter((b) => ambil(b) === true),
    takTerbaca,
    seluruhnyaTakTerbaca: dasar.length > 0 && takTerbaca === dasar.length,
  };
}

function catatanTakTerbaca(jumlah: number, penanda: string): string[] {
  return jumlah > 0
    ? [`${penanda} tidak terbaca dari SIPP pada ${jumlah} perkara - perkara itu tidak ikut dokumen ini dan tidak dihitung.`]
    : [];
}

/** Catatan umum tiap dokumen: aturan periode, batas keadaan, dan catatan bot. */
/**
 * Catatan yang tercetak di SETIAP dokumen: aturan periode, batas keadaan, dan
 * catatan bot untuk pembaca. catatanOperator SENGAJA tidak ikut - isinya
 * urusan petugas (konfigurasi SIPP, nama tabel, sumber borang) dan tampil di
 * menu unduhan, bukan di dokumen yang ditandatangani Ketua.
 */
function catatanUmum(data: DataEvidenSkp, k: KonteksEviden): string[] {
  return [data.aturanPeriode, kalimatBatas(k), ...data.catatan].filter(Boolean);
}

/**
 * "; 26 lainnya belum putus per 30 Juni 2026, seluruhnya masih dalam 150
 * hari" - supaya persentase penyelesaian yang rendah karena perkaranya baru
 * didaftarkan menjelang akhir periode tidak terbaca sebagai tunggakan.
 */
function kalimatBelumPutus(baris: BarisEvidenSkp[], k: KonteksEviden): string {
  const belum = baris.filter((b) => !putusPerBatas(b, k));
  if (!belum.length) return "";
  const dalamTenggat = belum.filter((b) => tepatWaktu(b, k)).length;
  const tenggat =
    dalamTenggat === belum.length
      ? `seluruhnya masih dalam ${AMBANG_TEPAT_WAKTU_HARI} hari`
      : `${dalamTenggat} di antaranya masih dalam ${AMBANG_TEPAT_WAKTU_HARI} hari`;
  return `; ${belum.length} lainnya belum putus per ${tanggalPanjang(k.batas)}, ${tenggat}`;
}

function rataRata(angka: number[]): number | null {
  const sah = angka.filter((x) => Number.isFinite(x));
  if (!sah.length) return null;
  return Math.round((sah.reduce((a, b) => a + b, 0) / sah.length) * 10) / 10;
}

function angkaKoma(n: number): string {
  return String(n).replace(".", ",");
}

// ---- 1. Status Perkara ----------------------------------------------------------

function susunStatusPerkara(data: DataEvidenSkp, k: KonteksEviden): DokumenEvidenSkp {
  const baris = data.baris.filter((b) => masukPeriodePemeriksa(b, k)).sort(urutDaftar);
  return dokumen("status-perkara", k, {
    rhk: null,
    indikator: [],
    kolom: KOLOM_STATUS_PERKARA,
    baris: baris.map((b, i) => selStatusPerkara(b, k, i + 1)),
    catatan: [
      ...catatanUmum(data, k),
      "Memuat perkara yang diperiksa sebagai majelis (ketua, anggota, atau hakim tunggal). Majelis Hakim, Panitera, dan " +
        "Jurusita adalah yang menjabat pada hari putusan; perkara yang belum putus, penunjukan yang aktif.",
      KALIMAT_DURASI,
      "Musyawarah Majelis dibaca dari jadwal sidang: sidang beragenda musyawarah, atau sidang sesudah sidang yang " +
        "ditunda untuk musyawarah majelis. SIPP tidak memiliki kolom musyawarah; yang tidak diagendakan tertulis \"-\".",
      "Sidang Keliling: sidang bertanda sidang keliling atau di ruang \"Sidang Keliling\"; Itsbat Terpadu: itsbat nikah " +
        "yang bersidang di ruang \"Terpadu\". Direktori Putusan: alamat putusan pada Direktori Putusan Mahkamah Agung " +
        "yang tercatat di SIPP.",
    ],
  });
}

// ---- 2. Rekap Perkara -------------------------------------------------------------

function susunRekapPerkara(data: DataEvidenSkp, k: KonteksEviden): DokumenEvidenSkp {
  const teks = SKP_HAKIM_2026["rekap-perkara"];
  const baris = data.baris.filter((b) => masukPeriodePemeriksa(b, k)).sort(urutDaftar);
  const putus = baris.filter((b) => putusDalamPeriode(b, k));
  const tepat = putus.filter((b) => tepatWaktu(b, k));
  return dokumen("rekap-perkara", k, {
    rhk: teks.rhk,
    indikator: [
      {
        aspek: "Kuantitas",
        teks: teks.kuantitas,
        realisasi: `${putus.length} Perkara`,
        dasar: `${putus.length} dari ${baris.length} perkara yang ditangani sebagai majelis pemeriksa diputus dalam periode${kalimatBelumPutus(baris, k)}.`,
      },
      {
        aspek: "Kualitas",
        teks: teks.kualitas,
        realisasi: persen(tepat.length, putus.length),
        dasar: `${tepat.length} dari ${putus.length} perkara yang diputus dalam periode selesai paling lama ${AMBANG_TEPAT_WAKTU_HARI} hari.`,
      },
      indikatorWaktu(teks.waktu, k),
    ],
    kolom: [
      { kunci: "no", judul: "No", bobot: 0.5, rata: "tengah" },
      { kunci: "nomor", judul: "Nomor Perkara", bobot: 2 },
      { kunci: "jenis", judul: "Jenis Perkara", bobot: 1.6 },
      { kunci: "daftar", judul: "Tanggal Pendaftaran", bobot: 1.2, rata: "tengah" },
      { kunci: "kedudukan", judul: "Kedudukan", bobot: 1.4 },
      { kunci: "tanggalPutusan", judul: "Tanggal Putusan", bobot: 1.2, rata: "tengah" },
      { kunci: "putusan", judul: "Putusan", bobot: 1.6 },
      { kunci: "durasi", judul: "Durasi (Hari)", bobot: 0.9, rata: "tengah" },
      { kunci: "ketepatan", judul: "Ketepatan Waktu", bobot: 1.4, rata: "tengah" },
    ],
    baris: baris.map((b) => {
      const durasi = durasiPerkara(b, k);
      const diputus = putusDalamPeriode(b, k);
      return {
        no: "",
        nomor: b.nomorPerkara,
        jenis: b.jenisPerkara,
        daftar: formatTanggal(b.tanggalDaftar),
        kedudukan: kedudukanOrang(b.majelis, k),
        tanggalPutusan: putusPerBatas(b, k) ? formatTanggal(b.tanggalPutusan) : "-",
        putusan: teksPutusan(b, k),
        durasi: durasi === null ? "-" : String(durasi),
        ketepatan: !diputus
          ? "Belum putus"
          : durasi === null
            ? "-"
            : durasi <= AMBANG_TEPAT_WAKTU_HARI
              ? "Tepat waktu"
              : `Lewat ${AMBANG_TEPAT_WAKTU_HARI} hari`,
      };
    }),
    catatan: [...catatanUmum(data, k), KALIMAT_DURASI, KALIMAT_TEPAT_WAKTU],
  });
}

// ---- 3. Rekap Minutasi ---------------------------------------------------------------

function susunRekapMinutasi(data: DataEvidenSkp, k: KonteksEviden): DokumenEvidenSkp {
  const teks = SKP_HAKIM_2026["rekap-minutasi"];
  const baris = data.baris.filter((b) => masukPeriodePemeriksa(b, k) && putusDalamPeriode(b, k)).sort(urutDaftar);
  const diminutasi = baris.filter((b) => sampaiBatas(b.tanggalMinutasi, k));
  const samaDenganPutusan = diminutasi.filter((b) => b.tanggalMinutasi === b.tanggalPutusan).length;
  const kalimatMinutasi =
    samaDenganPutusan > 0
      ? `Ketepatan waktu minutasi TIDAK dapat diukur dari SIPP: tanggal minutasi sama dengan tanggal putusan pada ` +
        `${samaDenganPutusan} dari ${diminutasi.length} perkara ini (kolom itu terisi bersamaan dengan putusan), ` +
        `sehingga yang dihitung hanya keterisiannya.`
      : "Tanggal minutasi dibaca apa adanya dari SIPP; tenggat minutasi tidak dinilai di sini.";
  return dokumen("rekap-minutasi", k, {
    rhk: teks.rhk,
    indikator: [
      {
        aspek: "Kuantitas",
        teks: teks.kuantitas,
        realisasi: `${diminutasi.length} Perkara`,
        dasar: `${diminutasi.length} dari ${baris.length} perkara yang diputus dalam periode tercatat telah diminutasi.`,
      },
      {
        aspek: "Kualitas",
        teks: teks.kualitas,
        realisasi: persen(diminutasi.length, baris.length),
        dasar: `${diminutasi.length} dari ${baris.length} perkara yang diputus dalam periode tercatat diminutasi. ${kalimatMinutasi}`,
      },
      indikatorWaktu(teks.waktu, k),
    ],
    kolom: [
      { kunci: "no", judul: "No", bobot: 0.5, rata: "tengah" },
      { kunci: "nomor", judul: "Nomor Perkara", bobot: 2 },
      { kunci: "jenis", judul: "Jenis Perkara", bobot: 1.6 },
      { kunci: "tanggalPutusan", judul: "Tanggal Putusan", bobot: 1.2, rata: "tengah" },
      { kunci: "putusan", judul: "Putusan", bobot: 1.6 },
      { kunci: "tanggalMinutasi", judul: "Tanggal Minutasi", bobot: 1.2, rata: "tengah" },
      { kunci: "minutasi", judul: "Minutasi", bobot: 1.4, rata: "tengah" },
    ],
    baris: baris.map((b) => ({
      no: "",
      nomor: b.nomorPerkara,
      jenis: b.jenisPerkara,
      tanggalPutusan: formatTanggal(b.tanggalPutusan),
      putusan: teksPutusan(b, k),
      tanggalMinutasi: sampaiBatas(b.tanggalMinutasi, k) ? formatTanggal(b.tanggalMinutasi) : "-",
      minutasi: sampaiBatas(b.tanggalMinutasi, k) ? "Telah Di Minutasi" : "Belum Diminutasi",
    })),
    catatan: [...catatanUmum(data, k), kalimatMinutasi],
  });
}

// ---- 4. Rekap Musyawarah Majelis --------------------------------------------------

function susunRekapMusyawarah(data: DataEvidenSkp, k: KonteksEviden): DokumenEvidenSkp {
  const teks = SKP_HAKIM_2026["rekap-musyawarah-majelis"];
  const majelis = data.baris.filter(
    (b) => masukPeriodePemeriksa(b, k) && b.hubungan.some((h) => h === "hakim-ketua" || h === "hakim-anggota")
  );
  const baris = majelis.filter((b) => dalamPeriode(b.musyawarah?.tanggal, k)).sort(urutDaftar);
  const diputus = baris.filter(
    (b) => putusPerBatas(b, k) && (sahIso(b.tanggalPutusan) as string) >= (b.musyawarah?.tanggal as string)
  );
  return dokumen("rekap-musyawarah-majelis", k, {
    rhk: teks.rhk,
    indikator: [
      {
        aspek: "Kuantitas",
        teks: teks.kuantitas,
        realisasi: `${baris.length} Kegiatan`,
        dasar:
          `${baris.length} musyawarah majelis tercatat dalam periode, dari ${majelis.length} perkara yang diperiksa ` +
          `sebagai majelis (bukan hakim tunggal).`,
      },
      {
        aspek: "Kualitas",
        teks: teks.kualitas,
        realisasi: persen(diputus.length, baris.length),
        dasar: `${diputus.length} dari ${baris.length} perkara yang dimusyawarahkan dalam periode telah diputus pada atau sesudah hari musyawarahnya.`,
      },
      indikatorWaktu(teks.waktu, k),
    ],
    kolom: [
      { kunci: "no", judul: "No", bobot: 0.5, rata: "tengah" },
      { kunci: "nomor", judul: "Nomor Perkara", bobot: 2 },
      { kunci: "jenis", judul: "Jenis Perkara", bobot: 1.5 },
      { kunci: "majelis", judul: "Majelis Hakim", bobot: 3 },
      { kunci: "tanggalMusyawarah", judul: "Tanggal Musyawarah", bobot: 1.2, rata: "tengah" },
      { kunci: "sumber", judul: "Tercatat Pada", bobot: 3 },
      { kunci: "tanggalPutusan", judul: "Tanggal Putusan", bobot: 1.2, rata: "tengah" },
      { kunci: "putusan", judul: "Putusan", bobot: 1.5 },
    ],
    baris: baris.map((b) => ({
      no: "",
      nomor: b.nomorPerkara,
      jenis: b.jenisPerkara,
      majelis: teksMajelis(b.majelis),
      tanggalMusyawarah: formatTanggal(b.musyawarah?.tanggal),
      sumber: b.musyawarah?.sumber ?? "-",
      tanggalPutusan: putusPerBatas(b, k) ? formatTanggal(b.tanggalPutusan) : "-",
      putusan: teksPutusan(b, k),
    })),
    catatan: [
      ...catatanUmum(data, k),
      "Musyawarah majelis dibaca dari jadwal sidang: sidang beragenda musyawarah, atau sidang sesudah sidang yang " +
        "ditunda untuk musyawarah majelis. SIPP tidak memiliki kolom musyawarah - musyawarah yang tidak diagendakan " +
        `tidak tercatat, sehingga ${majelis.length - baris.length} perkara majelis lainnya dalam periode ini tidak ikut.`,
    ],
  });
}

// ---- 5. Rekap Mediasi (sebagai MEDIATOR) ------------------------------------------

function susunRekapMediasi(data: DataEvidenSkp, k: KonteksEviden): DokumenEvidenSkp {
  const teks = SKP_HAKIM_2026["rekap-mediasi"];
  const baris = data.baris
    .filter((b) => b.hubungan.includes("mediator"))
    .sort((a, b) => {
      const x = a.mediasi?.tanggalPenetapan ?? "";
      const y = b.mediasi?.tanggalPenetapan ?? "";
      return x !== y ? (x < y ? -1 : 1) : urutDaftar(a, b);
    });
  const dilaporkan = baris.filter((b) => dalamPeriode(b.mediasi?.tanggalLaporan, k));
  const dinilai = dilaporkan.filter((b) => b.mediasi?.berhasil === true || b.mediasi?.berhasil === false);
  const berhasil = dinilai.filter((b) => b.mediasi?.berhasil === true);
  const tanpaNilai = dilaporkan.length - dinilai.length;
  const lama = dilaporkan
    .map((b) => selisihHari(b.mediasi?.tanggalPenetapan, b.mediasi?.tanggalLaporan))
    .filter((x): x is number => x !== null && x >= 0);
  const rata = rataRata(lama);
  return dokumen("rekap-mediasi", k, {
    rhk: teks.rhk,
    indikator: [
      {
        aspek: "Kuantitas",
        teks: teks.kuantitas,
        realisasi: `${baris.length} Kegiatan`,
        dasar:
          `${baris.length} perkara dimediasi hakim yang bersangkutan sebagai mediator: mediator ditetapkan paling lambat ` +
          `${tanggalPanjang(k.batas)} dan laporannya dalam periode atau belum ada.`,
      },
      {
        aspek: "Kualitas",
        teks: teks.kualitas,
        realisasi: persen(berhasil.length, dinilai.length),
        dasar:
          `${berhasil.length} dari ${dinilai.length} mediasi yang dilaporkan dalam periode berhasil (seluruhnya atau sebagian)` +
          (tanpaNilai > 0 ? `; ${tanpaNilai} tidak dapat dilaksanakan atau hasilnya tidak tercatat, tidak dihitung.` : "."),
      },
      indikatorWaktu(
        teks.waktu,
        k,
        rata === null ? "" : `Rata-rata ${angkaKoma(rata)} hari sejak penetapan mediator sampai laporan mediator.`
      ),
    ],
    kolom: [
      { kunci: "no", judul: "No", bobot: 0.5, rata: "tengah" },
      { kunci: "nomor", judul: "Nomor Perkara", bobot: 2 },
      { kunci: "jenis", judul: "Jenis Perkara", bobot: 1.5 },
      { kunci: "pihak", judul: "Para Pihak", bobot: 3.2 },
      { kunci: "penetapan", judul: "Penetapan Mediator", bobot: 1.2, rata: "tengah" },
      { kunci: "laporan", judul: "Laporan Mediator", bobot: 1.2, rata: "tengah" },
      { kunci: "lama", judul: "Lama (Hari)", bobot: 0.8, rata: "tengah" },
      { kunci: "hasil", judul: "Hasil Mediasi", bobot: 1.6, rata: "tengah" },
    ],
    baris: baris.map((b) => {
      const dilapor = sampaiBatas(b.mediasi?.tanggalLaporan, k);
      const lamaHari = dilapor ? selisihHari(b.mediasi?.tanggalPenetapan, b.mediasi?.tanggalLaporan) : null;
      return {
        no: "",
        nomor: b.nomorPerkara,
        jenis: b.jenisPerkara,
        pihak: teksPihak(b),
        penetapan: formatTanggal(b.mediasi?.tanggalPenetapan),
        laporan: dilapor ? formatTanggal(b.mediasi?.tanggalLaporan) : "-",
        lama: lamaHari === null ? "-" : String(lamaHari),
        hasil: teksMediasi(b, k),
      };
    }),
    catatan: [
      ...catatanUmum(data, k),
      "Mediator dikenali lewat ID SIPP (mediator.hakim_id), bukan lewat nama. Berhasil = berhasil dengan kesepakatan, " +
        "berhasil dengan pencabutan, atau berhasil sebagian (sandi Y1, Y2, S); mediasi yang tidak dapat dilaksanakan " +
        "(sandi D) tidak dihitung berhasil maupun gagal.",
    ],
  });
}

// ---- 6-8. Sidang keliling, e-Court, isbat terpadu ---------------------------------

function tempatLuarGedung(b: BarisEvidenSkp, terpadu: boolean): string {
  const daftar = (b.sidangLuarGedung ?? []).filter((s) => s.terpadu === terpadu);
  if (!daftar.length) return terpadu ? "-" : "Tercatat pada atribut perkara (tanggal sidang tidak tercatat)";
  return daftar.map((s) => `${formatTanggal(s.tanggal)} - ${s.tempat}`).join("\n");
}

function susunRekapSidangKeliling(data: DataEvidenSkp, k: KonteksEviden): DokumenEvidenSkp {
  const teks = SKP_HAKIM_2026["rekap-sidang-keliling"];
  const dasar = data.baris.filter((b) => masukPeriodePemeriksa(b, k));
  const saring = saringPenanda(dasar, (b) => b.sidangKeliling);
  const baris = saring.cocok.sort(urutDaftar);
  const selesai = baris.filter((b) => putusDalamPeriode(b, k));
  const takTerbaca = saring.seluruhnyaTakTerbaca;
  return dokumen("rekap-sidang-keliling", k, {
    rhk: teks.rhk,
    indikator: [
      {
        aspek: "Kuantitas",
        teks: teks.kuantitas,
        realisasi: takTerbaca ? "—" : `${baris.length} Perkara`,
        dasar: takTerbaca
          ? "Penanda sidang keliling tidak terbaca dari SIPP - tidak dapat dihitung."
          : `${baris.length} dari ${dasar.length} perkara yang ditangani bersidang di luar gedung pengadilan (sidang keliling).`,
      },
      {
        aspek: "Kualitas",
        teks: teks.kualitas,
        realisasi: takTerbaca ? "—" : persen(selesai.length, baris.length),
        dasar: takTerbaca
          ? "Penanda sidang keliling tidak terbaca dari SIPP - tidak dapat dihitung."
          : `${selesai.length} dari ${baris.length} perkara sidang keliling diputus dalam periode${kalimatBelumPutus(baris, k)}.`,
      },
      indikatorWaktu(teks.waktu, k),
    ],
    kolom: [
      { kunci: "no", judul: "No", bobot: 0.5, rata: "tengah" },
      { kunci: "nomor", judul: "Nomor Perkara", bobot: 2 },
      { kunci: "jenis", judul: "Jenis Perkara", bobot: 1.5 },
      { kunci: "daftar", judul: "Tanggal Pendaftaran", bobot: 1.2, rata: "tengah" },
      { kunci: "tempat", judul: "Sidang di Luar Gedung", bobot: 3.2 },
      { kunci: "tanggalPutusan", judul: "Tanggal Putusan", bobot: 1.2, rata: "tengah" },
      { kunci: "putusan", judul: "Putusan", bobot: 1.5 },
    ],
    baris: baris.map((b) => ({
      no: "",
      nomor: b.nomorPerkara,
      jenis: b.jenisPerkara,
      daftar: formatTanggal(b.tanggalDaftar),
      tempat: tempatLuarGedung(b, false),
      tanggalPutusan: putusPerBatas(b, k) ? formatTanggal(b.tanggalPutusan) : "-",
      putusan: teksPutusan(b, k),
    })),
    catatan: [
      ...catatanUmum(data, k),
      "Sidang keliling: sidang bertanda sidang keliling pada jadwal SIPP, sidang di ruang \"Sidang Keliling ...\", atau " +
        "perkara bertanda sidang keliling pada atribut perkara. Sidang itsbat terpadu dihitung pada Rekap Perkara Isbat Terpadu.",
      ...catatanTakTerbaca(saring.takTerbaca, "Penanda sidang keliling"),
    ],
  });
}

function susunRekapEcourt(data: DataEvidenSkp, k: KonteksEviden): DokumenEvidenSkp {
  const teks = SKP_HAKIM_2026["rekap-ecourt"];
  const dasar = data.baris.filter((b) => masukPeriodePemeriksa(b, k));
  const saring = saringPenanda(dasar, (b) => b.ecourt);
  const baris = saring.cocok.sort(urutDaftar);
  const putus = baris.filter((b) => putusDalamPeriode(b, k));
  const summonsTerbaca = baris.filter((b) => b.eSummons === true || b.eSummons === false);
  const summons = summonsTerbaca.filter((b) => b.eSummons === true);
  const takTerbaca = saring.seluruhnyaTakTerbaca;
  return dokumen("rekap-ecourt", k, {
    rhk: teks.rhk,
    indikator: [
      {
        aspek: "Kuantitas",
        teks: teks.kuantitas,
        realisasi: takTerbaca ? "—" : `${putus.length} Perkara`,
        dasar: takTerbaca
          ? "Penanda e-Court tidak terbaca dari SIPP - tidak dapat dihitung."
          : `${putus.length} dari ${baris.length} perkara e-Court yang ditangani diputus dalam periode${kalimatBelumPutus(baris, k)}.`,
      },
      {
        aspek: "Kualitas",
        teks: teks.kualitas,
        realisasi: takTerbaca ? "—" : persen(summons.length, summonsTerbaca.length),
        dasar: takTerbaca
          ? "Penanda e-Court tidak terbaca dari SIPP - tidak dapat dihitung."
          : `${summons.length} dari ${summonsTerbaca.length} perkara e-Court dipanggil secara elektronik (e-Summons, relaas ` +
            `bersandi E). Pemakaian e-Litigasi tidak tercatat per perkara di SIPP, sehingga tidak ikut dihitung.`,
      },
      indikatorWaktu(teks.waktu, k),
    ],
    kolom: [
      { kunci: "no", judul: "No", bobot: 0.5, rata: "tengah" },
      { kunci: "nomor", judul: "Nomor Perkara", bobot: 2 },
      { kunci: "jenis", judul: "Jenis Perkara", bobot: 1.6 },
      { kunci: "daftar", judul: "Tanggal Pendaftaran", bobot: 1.2, rata: "tengah" },
      { kunci: "summons", judul: "e-Summons", bobot: 1, rata: "tengah" },
      { kunci: "tanggalPutusan", judul: "Tanggal Putusan", bobot: 1.2, rata: "tengah" },
      { kunci: "putusan", judul: "Putusan", bobot: 1.6 },
    ],
    baris: baris.map((b) => ({
      no: "",
      nomor: b.nomorPerkara,
      jenis: b.jenisPerkara,
      daftar: formatTanggal(b.tanggalDaftar),
      summons: teksPenanda(b.eSummons, "Ya"),
      tanggalPutusan: putusPerBatas(b, k) ? formatTanggal(b.tanggalPutusan) : "-",
      putusan: teksPutusan(b, k),
    })),
    catatan: [
      ...catatanUmum(data, k),
      "Perkara e-Court: perkara yang tercatat pendaftarannya lewat e-Court di SIPP (perkara_efiling_id).",
      ...catatanTakTerbaca(saring.takTerbaca, "Penanda e-Court"),
      ...catatanTakTerbaca(baris.length - summonsTerbaca.length, "Relaas elektronik"),
    ],
  });
}

function susunRekapIsbatTerpadu(data: DataEvidenSkp, k: KonteksEviden): DokumenEvidenSkp {
  const teks = SKP_HAKIM_2026["rekap-isbat-terpadu"];
  const dasar = data.baris.filter((b) => masukPeriodePemeriksa(b, k));
  const saring = saringPenanda(dasar, (b) => b.itsbatTerpadu);
  const baris = saring.cocok.sort(urutDaftar);
  const selesai = baris.filter((b) => putusDalamPeriode(b, k));
  const takTerbaca = saring.seluruhnyaTakTerbaca;
  return dokumen("rekap-isbat-terpadu", k, {
    rhk: teks.rhk,
    indikator: [
      {
        aspek: "Kuantitas",
        teks: teks.kuantitas,
        realisasi: takTerbaca ? "—" : `${baris.length} Perkara`,
        dasar: takTerbaca
          ? "Jadwal sidang tidak terbaca dari SIPP - tidak dapat dihitung."
          : `${baris.length} perkara itsbat nikah yang ditangani bersidang terpadu di luar gedung pengadilan.`,
      },
      {
        aspek: "Kualitas",
        teks: teks.kualitas,
        realisasi: takTerbaca ? "—" : persen(selesai.length, baris.length),
        dasar: takTerbaca
          ? "Jadwal sidang tidak terbaca dari SIPP - tidak dapat dihitung."
          : `${selesai.length} dari ${baris.length} perkara itsbat terpadu diputus dalam periode${kalimatBelumPutus(baris, k)}.`,
      },
      indikatorWaktu(teks.waktu, k),
    ],
    kolom: [
      { kunci: "no", judul: "No", bobot: 0.5, rata: "tengah" },
      { kunci: "nomor", judul: "Nomor Perkara", bobot: 2 },
      { kunci: "daftar", judul: "Tanggal Pendaftaran", bobot: 1.2, rata: "tengah" },
      { kunci: "pihak", judul: "Para Pihak", bobot: 3.2 },
      { kunci: "tempat", judul: "Sidang Terpadu", bobot: 2.4 },
      { kunci: "tanggalPutusan", judul: "Tanggal Putusan", bobot: 1.2, rata: "tengah" },
      { kunci: "putusan", judul: "Putusan", bobot: 1.5 },
    ],
    baris: baris.map((b) => ({
      no: "",
      nomor: b.nomorPerkara,
      daftar: formatTanggal(b.tanggalDaftar),
      pihak: teksPihak(b),
      tempat: tempatLuarGedung(b, true),
      tanggalPutusan: putusPerBatas(b, k) ? formatTanggal(b.tanggalPutusan) : "-",
      putusan: teksPutusan(b, k),
    })),
    catatan: [
      ...catatanUmum(data, k),
      "Itsbat terpadu: perkara Pengesahan Perkawinan/Istbat Nikah yang bersidang di ruang \"Terpadu ...\" atau " +
        "\"Sidang diluar gedung Pengadilan (sidang terpadu)\" pada jadwal SIPP.",
      ...catatanTakTerbaca(saring.takTerbaca, "Jadwal sidang (penanda itsbat terpadu)"),
    ],
  });
}

// ---- 9. Ikrar talak (sebagai MAJELIS IKRAR) -----------------------------------------

/** Ikrar sesuai: sesudah BHT, paling lama 180 hari sesudahnya, tidak mendahului PHS ikrar. */
export function ikrarSesuai(b: BarisEvidenSkp): boolean | null {
  const ikrar = sahIso(b.ikrar?.tanggalIkrar);
  const bht = sahIso(b.tanggalBht);
  if (!ikrar || !bht) return null;
  const jarak = selisihHari(bht, ikrar);
  const phs = sahIso(b.ikrar?.tanggalPhsIkrar);
  return jarak !== null && jarak >= 0 && jarak <= BATAS_IKRAR_HARI && (!phs || ikrar >= phs);
}

function susunRekapIkrar(data: DataEvidenSkp, k: KonteksEviden): DokumenEvidenSkp {
  const teks = SKP_HAKIM_2026["rekap-ikrar-talak"];
  const baris = data.baris
    .filter((b) => b.hubungan.includes("majelis-ikrar"))
    .sort((a, b) => {
      const x = a.ikrar?.tanggalIkrar ?? "9999";
      const y = b.ikrar?.tanggalIkrar ?? "9999";
      return x !== y ? (x < y ? -1 : 1) : urutDaftar(a, b);
    });
  const selesai = baris.filter((b) => dalamPeriode(b.ikrar?.tanggalIkrar, k));
  const dinilai = selesai.filter((b) => ikrarSesuai(b) !== null);
  const sesuai = dinilai.filter((b) => ikrarSesuai(b) === true);
  const jarakPanggil = selesai
    .map((b) => selisihHari(b.ikrar?.tanggalPhsIkrar, b.ikrar?.tanggalIkrar))
    .filter((x): x is number => x !== null && x >= 0);
  const rata = rataRata(jarakPanggil);
  return dokumen("rekap-ikrar-talak", k, {
    rhk: teks.rhk,
    indikator: [
      {
        aspek: "Kuantitas",
        teks: teks.kuantitas,
        realisasi: `${selesai.length} Perkara`,
        dasar:
          `${selesai.length} perkara cerai talak selesai sampai penyaksian ikrar talak dalam periode, dari ${baris.length} ` +
          `perkara yang sidang ikrarnya dalam periode dengan hakim yang bersangkutan sebagai majelis ikrar.`,
      },
      {
        aspek: "Kualitas",
        teks: teks.kualitas,
        realisasi: persen(sesuai.length, dinilai.length),
        dasar:
          `${sesuai.length} dari ${dinilai.length} ikrar talak diucapkan sesudah putusan berkekuatan hukum tetap, paling ` +
          `lama ${BATAS_IKRAR_HARI} hari sesudahnya (Pasal 70 ayat (6) UU 7/1989), dan tidak mendahului penetapan hari ` +
          `sidang ikrarnya` +
          (selesai.length - dinilai.length > 0 ? `; ${selesai.length - dinilai.length} tanpa tanggal BHT, tidak dinilai.` : "."),
      },
      indikatorWaktu(
        teks.waktu,
        k,
        rata === null ? "" : `Rata-rata ${angkaKoma(rata)} hari sejak penetapan hari sidang ikrar sampai ikrar diucapkan.`
      ),
    ],
    kolom: [
      { kunci: "no", judul: "No", bobot: 0.5, rata: "tengah" },
      { kunci: "nomor", judul: "Nomor Perkara", bobot: 2 },
      { kunci: "majelisIkrar", judul: "Majelis Ikrar", bobot: 3 },
      { kunci: "bht", judul: "Tanggal BHT", bobot: 1.2, rata: "tengah" },
      { kunci: "phs", judul: "Penetapan Hari Sidang Ikrar", bobot: 1.3, rata: "tengah" },
      { kunci: "ikrar", judul: "Tanggal Ikrar", bobot: 1.2, rata: "tengah" },
      { kunci: "keterangan", judul: "Keterangan", bobot: 2 },
    ],
    baris: baris.map((b) => {
      const diucapkan = dalamPeriode(b.ikrar?.tanggalIkrar, k);
      const nilai = diucapkan ? ikrarSesuai(b) : null;
      const jarak = selisihHari(b.tanggalBht, b.ikrar?.tanggalIkrar);
      return {
        no: "",
        nomor: b.nomorPerkara,
        majelisIkrar: teksMajelis(b.majelisIkrar),
        bht: sampaiBatas(b.tanggalBht, k) ? formatTanggal(b.tanggalBht) : "-",
        phs: formatTanggal(b.ikrar?.tanggalPhsIkrar),
        ikrar: diucapkan ? formatTanggal(b.ikrar?.tanggalIkrar) : "-",
        keterangan: !diucapkan
          ? sampaiBatas(b.ikrar?.tanggalIkrar, k)
            ? "Diucapkan sebelum periode"
            : "Belum diucapkan dalam periode"
          : nilai === null
            ? "Tanggal BHT tidak tercatat"
            : nilai
              ? `Sesuai (${jarak} hari sesudah BHT)`
              : jarak !== null && jarak > BATAS_IKRAR_HARI
                ? `Lewat ${BATAS_IKRAR_HARI} hari sesudah BHT (${jarak} hari)`
                : "Tidak sesuai urutan BHT/penetapan hari sidang",
      };
    }),
    catatan: [
      ...catatanUmum(data, k),
      "Memuat perkara yang sidang ikrar talaknya dalam periode dengan hakim yang bersangkutan sebagai majelis ikrar " +
        "talak, menurut penunjukan majelis ikrar di SIPP - atau, bila penunjukannya tidak tercatat, menurut penetapan " +
        "ikrar talak di SIPP.",
    ],
  });
}

// ---- 10-13. Salinan, prodeo, direktori, selesai minutasi --------------------------

function susunRekapSalinan(data: DataEvidenSkp, k: KonteksEviden): DokumenEvidenSkp {
  const teks = SKP_HAKIM_2026["rekap-salinan-putusan"];
  const baris = data.baris.filter((b) => masukPeriodePemeriksa(b, k) && putusDalamPeriode(b, k)).sort(urutDaftar);
  const terbaca = baris.filter((b) => unggahSampaiBatas(b.unggahPutusan, k) !== null);
  const terunggah = terbaca.filter((b) => unggahSampaiBatas(b.unggahPutusan, k) === true);
  const jarak = terunggah
    .map((b) => selisihHari(b.tanggalPutusan, b.unggahPutusan?.tanggal))
    .filter((x): x is number => x !== null && x >= 0);
  const rata = rataRata(jarak);
  return dokumen("rekap-salinan-putusan", k, {
    rhk: teks.rhk,
    indikator: [
      {
        aspek: "Kuantitas",
        teks: teks.kuantitas,
        realisasi: `${terunggah.length} Perkara`,
        dasar: `${terunggah.length} dari ${baris.length} putusan dalam periode sudah terunggah salinannya di SIPP.`,
      },
      {
        aspek: "Kualitas",
        teks: teks.kualitas,
        realisasi: persen(terunggah.length, terbaca.length),
        dasar:
          `${terunggah.length} dari ${terbaca.length} putusan dalam periode terunggah di SIPP (dokumen putusan pada ` +
          `e-Doc SIPP).` +
          (baris.length - terbaca.length > 0 ? ` ${baris.length - terbaca.length} tidak terbaca, tidak dihitung.` : ""),
      },
      indikatorWaktu(
        teks.waktu,
        k,
        rata === null ? "" : `Rata-rata ${angkaKoma(rata)} hari sejak putusan sampai salinannya terunggah.`
      ),
    ],
    kolom: [
      { kunci: "no", judul: "No", bobot: 0.5, rata: "tengah" },
      { kunci: "nomor", judul: "Nomor Perkara", bobot: 2 },
      { kunci: "jenis", judul: "Jenis Perkara", bobot: 1.6 },
      { kunci: "tanggalPutusan", judul: "Tanggal Putusan", bobot: 1.2, rata: "tengah" },
      { kunci: "tanggalUnggah", judul: "Tanggal Unggah", bobot: 1.2, rata: "tengah" },
      { kunci: "unggah", judul: "Upload Putusan", bobot: 1.3, rata: "tengah" },
    ],
    baris: baris.map((b) => {
      const ada = unggahSampaiBatas(b.unggahPutusan, k);
      return {
        no: "",
        nomor: b.nomorPerkara,
        jenis: b.jenisPerkara,
        tanggalPutusan: formatTanggal(b.tanggalPutusan),
        tanggalUnggah: ada ? formatTanggal(b.unggahPutusan?.tanggal) : "-",
        unggah: teksUnggah(b.unggahPutusan, "Telah Di Upload", k),
      };
    }),
    catatan: [
      ...catatanUmum(data, k),
      "Salinan terunggah: dokumen putusan terisi pada e-Doc SIPP. Tanggal unggahnya tanggal SIPP menyusun berkas " +
        "Direktori Putusan dari unggahan itu; tanda \"-\" pada tanggal berarti tanggalnya tidak tercatat.",
    ],
  });
}

function susunRekapProdeo(data: DataEvidenSkp, k: KonteksEviden): DokumenEvidenSkp {
  const teks = SKP_HAKIM_2026["rekap-prodeo"];
  const dasar = data.baris.filter((b) => masukPeriodePemeriksa(b, k));
  const saring = saringPenanda(dasar, (b) => b.prodeo);
  const baris = saring.cocok.sort(urutDaftar);
  const putus = baris.filter((b) => putusDalamPeriode(b, k));
  const tepat = putus.filter((b) => tepatWaktu(b, k));
  const takTerbaca = saring.seluruhnyaTakTerbaca;
  return dokumen("rekap-prodeo", k, {
    rhk: teks.rhk,
    indikator: [
      {
        aspek: "Kuantitas",
        teks: teks.kuantitas,
        realisasi: takTerbaca ? "—" : `${baris.length} Perkara`,
        dasar: takTerbaca
          ? "Penanda prodeo tidak terbaca dari SIPP - tidak dapat dihitung."
          : `${baris.length} dari ${dasar.length} perkara yang ditangani dibebaskan biayanya (prodeo).`,
      },
      {
        aspek: "Kualitas",
        teks: teks.kualitas,
        realisasi: takTerbaca ? "—" : persen(tepat.length, putus.length),
        dasar: takTerbaca
          ? "Penanda prodeo tidak terbaca dari SIPP - tidak dapat dihitung."
          : `${tepat.length} dari ${putus.length} perkara prodeo yang diputus dalam periode selesai paling lama ${AMBANG_TEPAT_WAKTU_HARI} hari.`,
      },
      indikatorWaktu(teks.waktu, k),
    ],
    kolom: [
      { kunci: "no", judul: "No", bobot: 0.5, rata: "tengah" },
      { kunci: "nomor", judul: "Nomor Perkara", bobot: 2 },
      { kunci: "jenis", judul: "Jenis Perkara", bobot: 1.6 },
      { kunci: "daftar", judul: "Tanggal Pendaftaran", bobot: 1.2, rata: "tengah" },
      { kunci: "tanggalPutusan", judul: "Tanggal Putusan", bobot: 1.2, rata: "tengah" },
      { kunci: "putusan", judul: "Putusan", bobot: 1.6 },
      { kunci: "durasi", judul: "Durasi (Hari)", bobot: 0.9, rata: "tengah" },
    ],
    baris: baris.map((b) => {
      const durasi = durasiPerkara(b, k);
      return {
        no: "",
        nomor: b.nomorPerkara,
        jenis: b.jenisPerkara,
        daftar: formatTanggal(b.tanggalDaftar),
        tanggalPutusan: putusPerBatas(b, k) ? formatTanggal(b.tanggalPutusan) : "-",
        putusan: teksPutusan(b, k),
        durasi: durasi === null ? "-" : String(durasi),
      };
    }),
    catatan: [
      ...catatanUmum(data, k),
      "Prodeo: perkara bertanda prodeo di SIPP (perkara.prodeo).",
      KALIMAT_DURASI,
      KALIMAT_TEPAT_WAKTU,
      ...catatanTakTerbaca(saring.takTerbaca, "Penanda prodeo"),
    ],
  });
}

function susunRekapDirektori(data: DataEvidenSkp, k: KonteksEviden): DokumenEvidenSkp {
  const teks = SKP_HAKIM_2026["rekap-direktori-putusan"];
  const baris = data.baris.filter((b) => masukPeriodePemeriksa(b, k) && putusDalamPeriode(b, k)).sort(urutDaftar);
  const terbaca = baris.filter((b) => direktoriSampaiBatas(b, k) !== null);
  const terbit = terbaca.filter((b) => direktoriSampaiBatas(b, k) === true);
  const lengkapTerbaca = baris.filter(
    (b) => unggahSampaiBatas(b.unggahPutusan, k) !== null && unggahSampaiBatas(b.anonimisasi, k) !== null
  );
  const lengkap = lengkapTerbaca.filter(
    (b) => unggahSampaiBatas(b.unggahPutusan, k) === true && unggahSampaiBatas(b.anonimisasi, k) === true
  );
  const jarak = terbit
    .map((b) => selisihHari(b.tanggalPutusan, b.direktori?.tanggal))
    .filter((x): x is number => x !== null && x >= 0);
  const rata = rataRata(jarak);
  return dokumen("rekap-direktori-putusan", k, {
    rhk: teks.rhk,
    indikator: [
      {
        aspek: "Kuantitas",
        teks: teks.kuantitas,
        realisasi: `${terbit.length} Putusan`,
        dasar:
          `${terbit.length} dari ${baris.length} putusan dalam periode tercatat terbit di Direktori Putusan Mahkamah Agung.` +
          (baris.length - terbaca.length > 0 ? ` ${baris.length - terbaca.length} tidak terbaca, tidak dihitung.` : ""),
      },
      {
        aspek: "Kualitas",
        teks: teks.kualitas,
        realisasi: persen(lengkap.length, lengkapTerbaca.length),
        dasar: `${lengkap.length} dari ${lengkapTerbaca.length} putusan dalam periode diunggah lengkap: putusan dan putusan anonimisasinya.`,
      },
      indikatorWaktu(
        teks.waktu,
        k,
        rata === null ? "" : `Rata-rata ${angkaKoma(rata)} hari sejak putusan sampai terbit di Direktori Putusan.`
      ),
    ],
    kolom: [
      { kunci: "no", judul: "No", bobot: 0.5, rata: "tengah" },
      { kunci: "nomor", judul: "Nomor Perkara", bobot: 2 },
      { kunci: "tanggalPutusan", judul: "Tanggal Putusan", bobot: 1.2, rata: "tengah" },
      { kunci: "anonimisasi", judul: "Anonimisasi", bobot: 1.3, rata: "tengah" },
      { kunci: "tanggalTerbit", judul: "Tanggal Terbit", bobot: 1.2, rata: "tengah" },
      { kunci: "direktori", judul: "Direktori Putusan", bobot: 4 },
    ],
    baris: baris.map((b) => ({
      no: "",
      nomor: b.nomorPerkara,
      tanggalPutusan: formatTanggal(b.tanggalPutusan),
      anonimisasi: teksUnggah(b.anonimisasi, "Telah Di Anonimisasi", k),
      tanggalTerbit: direktoriSampaiBatas(b, k) ? formatTanggal(b.direktori?.tanggal) : "-",
      direktori: teksDirektori(b, k),
    })),
    catatan: [
      ...catatanUmum(data, k),
      "Alamat putusan diberikan Direktori Putusan Mahkamah Agung dan disimpan SIPP (dirput_dokumen); tanggal terbit dari " +
        "antrean unggah Direktori Putusan yang berhasil. Apakah putusannya masih terbaca publik hanya dapat dipastikan di " +
        "laman Direktori Putusan itu sendiri.",
    ],
  });
}

function susunRekapSelesaiMinutasi(data: DataEvidenSkp, k: KonteksEviden): DokumenEvidenSkp {
  const teks = SKP_HAKIM_2026["rekap-selesai-minutasi"];
  const baris = data.baris.filter((b) => masukPeriodePemeriksa(b, k) && putusDalamPeriode(b, k)).sort(urutDaftar);
  const diminutasi = baris.filter((b) => sampaiBatas(b.tanggalMinutasi, k));
  const terbaca = baris.filter(
    (b) => unggahSampaiBatas(b.unggahPutusan, k) !== null && unggahSampaiBatas(b.anonimisasi, k) !== null
  );
  const lengkap = terbaca.filter(
    (b) =>
      sampaiBatas(b.tanggalMinutasi, k) &&
      unggahSampaiBatas(b.unggahPutusan, k) === true &&
      unggahSampaiBatas(b.anonimisasi, k) === true
  );
  return dokumen("rekap-selesai-minutasi", k, {
    rhk: teks.rhk,
    indikator: [
      {
        aspek: "Kuantitas",
        teks: teks.kuantitas,
        realisasi: `${diminutasi.length} Perkara`,
        dasar: `${diminutasi.length} dari ${baris.length} perkara yang diputus dalam periode tercatat telah diminutasi.`,
      },
      {
        aspek: "Kualitas",
        teks: teks.kualitas,
        realisasi: persen(lengkap.length, terbaca.length),
        dasar:
          `${lengkap.length} dari ${terbaca.length} perkara yang diputus dalam periode lengkap administrasinya: ` +
          `diminutasi, salinan putusan terunggah, dan putusan anonimisasi terunggah.`,
      },
      indikatorWaktu(teks.waktu, k),
    ],
    kolom: [
      { kunci: "no", judul: "No", bobot: 0.5, rata: "tengah" },
      { kunci: "nomor", judul: "Nomor Perkara", bobot: 2 },
      { kunci: "jenis", judul: "Jenis Perkara", bobot: 1.5 },
      { kunci: "tanggalPutusan", judul: "Tanggal Putusan", bobot: 1.2, rata: "tengah" },
      { kunci: "putusan", judul: "Putusan", bobot: 1.5 },
      { kunci: "minutasi", judul: "Minutasi", bobot: 1.2, rata: "tengah" },
      { kunci: "unggah", judul: "Upload Putusan", bobot: 1.2, rata: "tengah" },
      { kunci: "anonimisasi", judul: "Anonimisasi", bobot: 1.3, rata: "tengah" },
      { kunci: "bht", judul: "Tanggal BHT", bobot: 1.2, rata: "tengah" },
    ],
    baris: baris.map((b) => ({
      no: "",
      nomor: b.nomorPerkara,
      jenis: b.jenisPerkara,
      tanggalPutusan: formatTanggal(b.tanggalPutusan),
      putusan: teksPutusan(b, k),
      minutasi: sampaiBatas(b.tanggalMinutasi, k) ? "Telah Di Minutasi" : "-",
      unggah: teksUnggah(b.unggahPutusan, "Telah Di Upload", k),
      anonimisasi: teksUnggah(b.anonimisasi, "Telah Di Anonimisasi", k),
      bht: sampaiBatas(b.tanggalBht, k) ? formatTanggal(b.tanggalBht) : "-",
    })),
    catatan: [
      ...catatanUmum(data, k),
      "Tanggal minutasi di SIPP tidak dipakai mengukur kecepatan: pada data satker, kolom itu terisi bersamaan dengan " +
        "tanggal putusannya.",
    ],
  });
}

// ---- 14. Upaya hukum ------------------------------------------------------------

const TINGKAT_UPAYA: Array<{ kunci: "banding" | "kasasi" | "pk"; nama: string }> = [
  { kunci: "banding", nama: "Banding" },
  { kunci: "kasasi", nama: "Kasasi" },
  { kunci: "pk", nama: "Peninjauan Kembali" },
];

function susunRekapUpayaHukum(data: DataEvidenSkp, k: KonteksEviden): DokumenEvidenSkp {
  const teks = SKP_HAKIM_2026["rekap-upaya-hukum"];
  type Upaya = { b: BarisEvidenSkp; nama: string; u: UpayaHukumEvidenSkp };
  const daftar: Upaya[] = [];
  for (const b of [...data.baris].filter(adalahPemeriksa).sort(urutDaftar)) {
    for (const t of TINGKAT_UPAYA) {
      const u = b[t.kunci];
      if (!u) continue;
      const bergerak =
        dalamPeriode(u.tanggalPermohonan, k) || dalamPeriode(u.tanggalPutusan, k) || dalamPeriode(u.tanggalPemberitahuan, k);
      if (bergerak) daftar.push({ b, nama: t.nama, u });
    }
  }
  const diberitahukan = daftar.filter((x) => dalamPeriode(x.u.tanggalPemberitahuan, k));
  const turun = daftar.filter((x) => sampaiBatas(x.u.tanggalPutusan, k));
  const tercatatTurun = turun.filter((x) => sampaiBatas(x.u.tanggalPemberitahuan, k));
  const jarakInput = diberitahukan
    .map((x) => selisihHari(x.u.tanggalPemberitahuan, x.u.tanggalInputPemberitahuan))
    .filter((x): x is number => x !== null && x >= 0);
  const rata = rataRata(jarakInput);
  return dokumen("rekap-upaya-hukum", k, {
    rhk: teks.rhk,
    indikator: [
      {
        aspek: "Kuantitas",
        teks: teks.kuantitas,
        realisasi: `${diberitahukan.length} Dokumen`,
        dasar:
          `${diberitahukan.length} pemberitahuan putusan tingkat banding, kasasi, atau PK dalam periode, pada ` +
          `${new Set(daftar.map((x) => x.b.perkaraId)).size} perkara yang diperiksa hakim yang bersangkutan dan upaya hukumnya ` +
          `bergerak dalam periode.`,
      },
      {
        aspek: "Kualitas",
        teks: teks.kualitas,
        realisasi: persen(tercatatTurun.length, turun.length),
        dasar:
          `${tercatatTurun.length} dari ${turun.length} putusan tingkat banding/kasasi/PK yang sudah turun tercatat telah ` +
          `diberitahukan kepada para pihak. Akurasi identitas dan alamat pada dokumen pemberitahuan tidak tercatat di SIPP - ` +
          `yang dapat diukur hanya keterlaksanaan pemberitahuannya.`,
      },
      indikatorWaktu(
        teks.waktu,
        k,
        rata === null
          ? ""
          : `Rata-rata ${angkaKoma(rata)} hari sejak pemberitahuan sampai diinput ke SIPP (jejak proses SIPP).`
      ),
    ],
    kolom: [
      { kunci: "no", judul: "No", bobot: 0.5, rata: "tengah" },
      { kunci: "nomor", judul: "Nomor Perkara", bobot: 2 },
      { kunci: "upaya", judul: "Upaya Hukum", bobot: 1.4, rata: "tengah" },
      { kunci: "permohonan", judul: "Tanggal Permohonan", bobot: 1.2, rata: "tengah" },
      { kunci: "tanggalPutusan", judul: "Tanggal Putusan", bobot: 1.2, rata: "tengah" },
      { kunci: "amar", judul: "Amar", bobot: 1.5 },
      { kunci: "pemberitahuan", judul: "Tanggal Pemberitahuan", bobot: 1.3, rata: "tengah" },
      { kunci: "input", judul: "Diinput ke SIPP", bobot: 1.2, rata: "tengah" },
    ],
    baris: daftar.map((x) => ({
      no: "",
      nomor: x.b.nomorPerkara,
      upaya: x.nama,
      permohonan: sampaiBatas(x.u.tanggalPermohonan, k) ? formatTanggal(x.u.tanggalPermohonan) : "-",
      tanggalPutusan: sampaiBatas(x.u.tanggalPutusan, k) ? formatTanggal(x.u.tanggalPutusan) : "-",
      amar: sampaiBatas(x.u.tanggalPutusan, k) ? x.u.putusan ?? "-" : "-",
      pemberitahuan: sampaiBatas(x.u.tanggalPemberitahuan, k) ? formatTanggal(x.u.tanggalPemberitahuan) : "-",
      input: sampaiBatas(x.u.tanggalInputPemberitahuan, k) ? formatTanggal(x.u.tanggalInputPemberitahuan) : "-",
    })),
    catatan: [
      ...catatanUmum(data, k),
      "Memuat perkara yang diperiksa hakim yang bersangkutan sebagai majelis - kapan pun diputusnya - yang banding, " +
        "kasasi, atau PK-nya dimohonkan, diputus, atau diberitahukan dalam periode; satu baris per tingkat. Tanggal input " +
        "dari jejak proses SIPP (Pemberitahuan Putusan Banding/Kasasi/PK).",
    ],
  });
}

// ---- dokumen yang bukan data SIPP -----------------------------------------------------

function susunTidakTersedia(kunci: keyof typeof TIDAK_TERSEDIA, k: KonteksEviden): DokumenEvidenSkp {
  const judul = judulDaftar(kunci);
  return {
    kunci,
    judul: judul.toUpperCase(),
    judulLengkap: `${judul} ${k.periode.labelPanjang}`,
    tersedia: false,
    sebabTidakTersedia: TIDAK_TERSEDIA[kunci],
    rhk: null,
    indikator: [],
    tabel: { kolom: [], baris: [] },
    catatan: [TIDAK_TERSEDIA[kunci]],
  };
}

const PENYUSUN: Record<string, (data: DataEvidenSkp, k: KonteksEviden) => DokumenEvidenSkp> = {
  "status-perkara": susunStatusPerkara,
  "rekap-perkara": susunRekapPerkara,
  "rekap-minutasi": susunRekapMinutasi,
  "rekap-musyawarah-majelis": susunRekapMusyawarah,
  "rekap-mediasi": susunRekapMediasi,
  "rekap-sidang-keliling": susunRekapSidangKeliling,
  "rekap-ecourt": susunRekapEcourt,
  "rekap-isbat-terpadu": susunRekapIsbatTerpadu,
  "rekap-ikrar-talak": susunRekapIkrar,
  "rekap-salinan-putusan": susunRekapSalinan,
  "rekap-prodeo": susunRekapProdeo,
  "rekap-direktori-putusan": susunRekapDirektori,
  "rekap-selesai-minutasi": susunRekapSelesaiMinutasi,
  "rekap-upaya-hukum": susunRekapUpayaHukum,
  "laporan-posbakum": (_d, k) => susunTidakTersedia("laporan-posbakum", k),
  "kegiatan-sipintar": (_d, k) => susunTidakTersedia("kegiatan-sipintar", k),
  "laporan-hawasbid": (_d, k) => susunTidakTersedia("laporan-hawasbid", k),
};

/**
 * Seluruh dokumen eviden satu orang untuk satu periode, berurutan seperti
 * DAFTAR_DOKUMEN_EVIDEN_SKP. Tiap dokumen memilih perkaranya sendiri dari
 * data.baris; tidak ada dokumen yang membaca SIPP.
 */
export function susunDokumenEvidenSkp(data: DataEvidenSkp): DokumenEvidenSkp[] {
  const k = konteksEviden(data);
  return DAFTAR_DOKUMEN_EVIDEN_SKP.map((d) => {
    const penyusun = PENYUSUN[d.kunci];
    if (!penyusun) throw new Error(`Penyusun dokumen eviden "${d.kunci}" belum ada.`);
    return penyusun(data, k);
  });
}

export function susunPaketEvidenSkp(data: DataEvidenSkp): PaketEvidenSkp {
  return {
    periode: data.periode,
    orang: data.orang,
    ketua: data.ketua,
    dokumen: susunDokumenEvidenSkp(data),
    galat: data.galat,
    dihitungPada: data.dihitungPada,
  };
}

/** Kunci ketiga belas rekap yang disusun dari SIPP, menurut urutan SKP. */
export const KUNCI_REKAP_SKP = Object.keys(SKP_HAKIM_2026) as KunciRekap[];
