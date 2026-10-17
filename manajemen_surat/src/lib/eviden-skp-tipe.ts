/**
 * ============================================================================
 * EVIDEN SKP - KONTRAK DATA ANTARA BOT DAN PORTAL (2.40.0)
 * ============================================================================
 *
 * Diminta pengguna 27 September 2026: bukti dukung SKP hakim (eKinerja BKN)
 * diunduh dari ALETA dalam PDF, Excel, dan Word - datanya dari SIPP, bukan
 * diketik ulang ke spreadsheet tiap triwulan. Contoh yang dipakai sekarang:
 * spreadsheet "SKP 2026 DERRY BRIANTONO" (lembar Triwulan I-IV dan Tahunan,
 * 25 kolom status per perkara) dan kolom Realisasi eKinerja yang berbunyi
 * "... berdasarkan Rekap Perkara Triwulan II Tahun 2026".
 *
 * Berkas ini HANYA tipe. Bot (rute /sipp/eviden-skp) mengisi DataEvidenSkp
 * dengan FAKTA per perkara dari SIPP; portal memilih perkara per dokumen,
 * menghitung realisasi tiap indikator, lalu menggambar PDF/Excel/Word. Aturan
 * hitung tinggal di satu sisi saja (portal) supaya tidak ada dua versi angka
 * yang sama.
 *
 * Tanggal selalu ISO "YYYY-MM-DD" (tanggal SIPP apa adanya, tanpa zona);
 * kosong/tidak ada = null, BUKAN "". Ruas yang tidak dapat dibaca dari SIPP
 * disebut di `galat` dan nilainya null - jangan dijadikan false/0 diam-diam.
 */

import type { KunciBulanSkp } from "@/lib/skp-jabatan-tipe";

/** Peran yang didukung. Sementara hanya hakim; panitera dan juru sita menyusul. */
export type PeranEvidenSkp = "hakim";

/** Periode SKP. tw1 = Januari-Maret, ..., tahun = Januari-Desember. */
export type KunciPeriodeSkp = "tw1" | "tw2" | "tw3" | "tw4" | "tahun";

export type PeriodeSkp = {
  /**
   * tw1..tw4|tahun (jalur hakim lama) atau b01..b12 (SKP bulanan, 2026-10-17).
   * Penggambar tidak membaca kunci ini; yang dipakai label dan rentangnya.
   */
  kunci: KunciPeriodeSkp | KunciBulanSkp;
  tahun: number;
  /** "Triwulan II" / "Tahunan". */
  label: string;
  /** "Triwulan II Tahun 2026" / "Tahun 2026" - dipakai di judul dokumen. */
  labelPanjang: string;
  mulai: string;
  selesai: string;
  /** Lama periode dalam bulan (1, 3, atau 12) - realisasi aspek Waktu SKP. */
  bulan: number;
};

/** Orang yang dibuatkan eviden (kiri tanda tangan). */
export type OrangEvidenSkp = {
  /** ID SIPP menurut perannya (hakim_id). */
  id: string;
  nama: string;
  nip: string | null;
  /** "Hakim" / "Hakim Pratama Muda" - dari SIPP bila ada. */
  jabatan: string | null;
  /** "Penata Muda Tingkat I / III/b" - dari SIPP bila ada. */
  pangkatGolongan: string | null;
};

/** Pejabat yang mengetahui (kanan tanda tangan). */
export type KetuaEvidenSkp = {
  nama: string;
  nip: string | null;
  /** "Ketua Pengadilan Agama Donggala". */
  jabatan: string;
  /** Dari mana namanya dibaca - supaya dapat diperiksa. */
  sumber: string;
};

/** Hubungan orang itu dengan perkara. Satu perkara dapat punya lebih dari satu. */
export type HubunganEvidenSkp =
  | "hakim-ketua"
  | "hakim-anggota"
  | "hakim-tunggal"
  | "majelis-ikrar"
  | "mediator";

export type PihakEvidenSkp = { sebutan: string; nama: string[] };

export type UpayaHukumEvidenSkp = {
  tanggalPermohonan: string | null;
  /** Tanggal pemberitahuan putusan tingkat banding/kasasi/PK kepada para pihak. */
  tanggalPemberitahuan: string | null;
  /** Tanggal input pemberitahuan itu ke SIPP (untuk aspek Waktu), bila terbaca. */
  tanggalInputPemberitahuan: string | null;
  putusan: string | null;
  /**
   * Tanggal putusan tingkat banding/kasasi/PK - ditambahkan agen data: tanpa
   * itu tidak dapat dibedakan putusan yang belum turun dari pemberitahuan yang
   * belum dikerjakan.
   */
  tanggalPutusan?: string | null;
};

/** FAKTA satu perkara - bukan teks jadi. Teks kolom disusun portal. */
export type BarisEvidenSkp = {
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  jenisPerkaraId: number | null;
  alurPerkaraId: number | null;
  tanggalDaftar: string | null;
  /** Hubungan orang yang dibuatkan eviden dengan perkara ini. */
  hubungan: HubunganEvidenSkp[];
  pihak: { satu: PihakEvidenSkp; dua: PihakEvidenSkp; turut: PihakEvidenSkp | null };
  /** Majelis PEMERIKSA (yang menjabat pada hari putusan; belum putus: yang aktif). */
  majelis: Array<{ kedudukan: string; nama: string; hakimId: string | null }>;
  /** Majelis ikrar talak bila ada (tahapan 18). */
  majelisIkrar: Array<{ kedudukan: string; nama: string; hakimId: string | null }>;
  panitera: string[];
  jurusita: string[];
  /** Musyawarah majelis: tanggalnya bila tercatat di SIPP; null = tidak tercatat. */
  musyawarah: { tanggal: string | null; sumber: string } | null;
  tanggalPutusan: string | null;
  /** Nama status putusan lewat JOIN status_putusan ("Dikabulkan", "Dicabut", ...). */
  statusPutusan: string | null;
  verstek: boolean | null;
  tanggalMinutasi: string | null;
  tanggalBht: string | null;
  mediasi: {
    mediator: string | null;
    /** true bila hakim ini mediatornya. */
    olehOrangIni: boolean;
    hasil: string | null;
    berhasil: boolean | null;
    tanggalPenetapan: string | null;
    tanggalLaporan: string | null;
  } | null;
  ikrar: { tanggalIkrar: string | null; tanggalPhsIkrar: string | null } | null;
  banding: UpayaHukumEvidenSkp | null;
  kasasi: UpayaHukumEvidenSkp | null;
  pk: UpayaHukumEvidenSkp | null;
  sidangKeliling: boolean | null;
  itsbatTerpadu: boolean | null;
  ghaib: boolean | null;
  prodeo: boolean | null;
  ecourt: boolean | null;
  /**
   * Tiga ruas di bawah ditambahkan agen data (27 Sep 2026), seluruhnya
   * opsional - penggambar tidak membacanya:
   *
   * rentangMediasi  seluruh rentang mediasi perkara (dimulai_mediasi ->
   *                 keputusan_mediasi, selesai null = belum diputuskan).
   *                 Durasi (Hari) mengeluarkan masa mediasi persis seperti
   *                 hariMediasiBersih bot; mediasi di atas hanya satu baris.
   *                 undefined = mediasinya tidak terbaca.
   * sidangLuarGedung sidang di luar gedung sampai akhir periode - tempatnya
   *                 untuk Rekap Sidang Keliling dan Itsbat Terpadu.
   * eSummons        ada relaas bersandi E (elektronik) sampai akhir periode;
   *                 null = tidak terbaca.
   */
  rentangMediasi?: Array<{ mulai: string; selesai: string | null }>;
  sidangLuarGedung?: Array<{ tanggal: string; tempat: string; terpadu: boolean }>;
  eSummons?: boolean | null;
  /** Salinan putusan terunggah di SIPP. */
  unggahPutusan: { ada: boolean; tanggal: string | null } | null;
  anonimisasi: { ada: boolean; tanggal: string | null } | null;
  /** Direktori Putusan MA: alamatnya bila tercatat. */
  direktori: { url: string | null; tanggal: string | null } | null;
};

/**
 * ============================================================================
 * DOKUMEN SIAP CETAK - KONTRAK ANTARA PENYUSUN (katalog) DAN PENGGAMBAR
 * ============================================================================
 *
 * Penyusun (lib/eviden-skp-katalog.ts) memilih perkara, menghitung realisasi,
 * dan menulis teks tiap sel. Penggambar PDF/Excel/Word tidak tahu apa itu
 * perkara: ia hanya menggambar kop, judul, identitas, indikator, tabel,
 * catatan, dan tanda tangan dari bentuk ini - satu bentuk untuk tiga format,
 * sehingga ketiganya tidak pernah berselisih isi.
 */
export type KolomTabelEvidenSkp = {
  kunci: string;
  judul: string;
  /** Bobot lebar relatif (1 = sempit, 4 = lebar). Penggambar mengubahnya ke ukuran kertas. */
  bobot?: number;
  rata?: "kiri" | "tengah" | "kanan";
};

export type IndikatorEvidenSkp = {
  aspek: "Kuantitas" | "Kualitas" | "Waktu";
  /** Bunyi indikator kinerja individu seperti di SKP. */
  teks: string;
  /** "12 Perkara" / "91,7%" / "3 Bulan". */
  realisasi: string;
  /** Dasar hitung dalam kalimat, mis. "11 dari 12 perkara putus ≤ 150 hari". */
  dasar: string;
};

export type DokumenEvidenSkp = {
  /** "status-perkara", "rekap-perkara", "rekap-minutasi", ... */
  kunci: string;
  /** "REKAP PERKARA" - judul di dokumen. */
  judul: string;
  /** "Rekap Perkara Triwulan II Tahun 2026" - dipakai nama berkas dan bunyi eKinerja. */
  judulLengkap: string;
  /** false untuk bukti dukung yang bukan data SIPP (Posbakum, SIPINTAR, Hawasbid). */
  tersedia: boolean;
  sebabTidakTersedia?: string;
  /** Rencana Hasil Kerja SKP yang didukung dokumen ini. */
  rhk: string | null;
  indikator: IndikatorEvidenSkp[];
  tabel: { kolom: KolomTabelEvidenSkp[]; baris: Array<Record<string, string>> };
  catatan: string[];
};

/** Satu paket unduhan: satu orang, satu periode, beberapa dokumen. */
export type PaketEvidenSkp = {
  periode: PeriodeSkp;
  orang: OrangEvidenSkp;
  ketua: KetuaEvidenSkp | null;
  dokumen: DokumenEvidenSkp[];
  galat: string[];
  dihitungPada: string;
  /**
   * Baris identitas tambahan sesudah Unit Kerja (mis. Pejabat Penilai pada
   * Lembar SKP). Kosong/tidak ada = tanpa baris tambahan (eviden hakim lama).
   */
  identitasTambahan?: Array<{ label: string; nilai: string }>;
  /**
   * Baris pembuka tanda tangan kanan. Tidak ada = "Mengetahui," (eviden
   * hakim lama); Lembar SKP memakai "Pejabat Penilai Kinerja,".
   */
  sebutanKanan?: string;
};

export type DataEvidenSkp = {
  ok: true;
  peran: PeranEvidenSkp;
  periode: PeriodeSkp;
  orang: OrangEvidenSkp;
  ketua: KetuaEvidenSkp | null;
  /** Aturan perkara masuk periode, dalam kalimat - dicetak di catatan kaki dokumen. */
  aturanPeriode: string;
  baris: BarisEvidenSkp[];
  /**
   * Keterangan untuk PEMBACA dokumen (penilai SKP) - tercetak di catatan tiap
   * dokumen. Aturan dan dasar hitung ditulis katalog; bot kini tidak mengisi.
   */
  catatan: string[];
  /**
   * Keterangan untuk PETUGAS - konfigurasi SIPP yang perlu dibetulkan (NIP
   * Ketua tidak lengkap, jabatan kosong), sumber borang, nama tabel. Tampil di
   * menu unduhan, TIDAK tercetak di dokumen yang ditandatangani Ketua.
   */
  catatanOperator?: string[];
  /**
   * Bagian SIPP yang TIDAK TERBACA, sebagai frasa untuk pembaca ("Direktori
   * Putusan (alamat dan tanggal unggah putusan)") - dokumen menyebutnya,
   * tidak menyembunyikannya. Galat MySQL mentah tidak pernah masuk; rinciannya
   * di log bot.
   */
  galat: string[];
  dihitungPada: string;
};
