"use client";

import type { CaraRelaas } from "@/server/modules/aleta-bot/whatsapp-gateway-client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ChevronDown, X } from "lucide-react";

import { AletaAnalisaPerkara } from "@/components/portal/aleta-analisa-perkara";
// Tampilan hasil pencarian (Detail, Daftar, Kotak, Kelompok), urutannya, dan
// lembar cetaknya hidup di berkas sendiri - lihat kepala berkas itu.
import {
  BilahPanelKecil,
  HasilPencarianPerkara,
  bacaTampilanTersimpan,
  simpanTampilan,
  tandaiTakTerbaca,
  type BarisHasil,
  type TampilanHasil,
  type Urutan,
} from "@/components/portal/status-perkara-hasil";
// Sepuluh bentuk sajian yang sudah dibangun untuk e-Audit dipakai APA ADANYA.
// Menulis penggambar kedua berarti dua aturan yang sama-sama bekerja, lalu pada
// suatu hari menggambar angka yang sama dengan bentuk yang berbeda - dan yang
// membacanya tidak punya cara tahu mana yang benar.
//
// Keempat aturannya ikut terbawa tanpa perlu ditulis ulang: sumbu selalu
// bermula dari nol, kecenderungan menolak digambar dari titik yang terlalu
// sedikit, yang dipotong disebutkan, dan garis ambang membawa dasar hukumnya.
import {
  DiagramBatang,
  DiagramPai,
  DiagramPerjalananSidang,
  type TitikData,
} from "@/components/portal/bentuk-sajian";
import { AletaPromptPutusan } from "@/components/portal/aleta-prompt-putusan";
import { NomorSidang, TombolUnduh } from "@/components/portal/aleta-ecourt-sidang";
import { TombolUnduhZip } from "@/components/portal/tombol-unduh-zip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BandingPerkara, ringkasDariStatus } from "@/components/portal/banding-perkara";
import {
  KartuIdentitasPihak,
  useIdentitasPihak,
} from "@/components/portal/identitas-pihak";
import {
  PenandaRiwayatPihak,
  PenyediaRiwayatPihak,
  bolehBertanda,
} from "@/components/portal/riwayat-pihak";
import { usePortal } from "@/lib/app-state";
import { AMBANG_HARI_SEMA, ringkasStatus } from "@/lib/ringkas-status";
import {
  BULAN_PANJANG,
  HARI_PENDEK,
  tanggalDMY,
  tanggalHariPanjang,
  tanggalHariPendek,
} from "@/lib/tanggal-indonesia";
import {
  DASAR_BAWAAN,
  PERIODE_BAWAAN,
  PERIODE_TAG,
  kelasNada,
  periodeButuhTanggal,
  type DasarTanggalTag,
  type KelompokTag,
  type TagPerkara,
} from "@/lib/tag-perkara";
import { susunPerjalananSidang } from "@/lib/perjalanan-sidang";
import { AlatStatusPerkara } from "@/components/portal/alat-status-perkara";
import { EcourtAksiPerkara } from "@/components/portal/ecourt-aksi-perkara";
import { DaftarMajelisPetugas, NamaMediatorTertaut, type MajelisIkrar } from "@/components/portal/tautan-petugas";
import { daftarkanBagian, kunciCiut, langgananAba } from "@/lib/alat-bagian";
import { Bagian } from "@/components/portal/bagian-ciut";
import { apiPath, withBasePath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import { GalatJawaban, bacaJsonAman, botTakTerjangkau, useCobaLagiOtomatis } from "@/lib/coba-lagi-otomatis";
import { useHilangSendiri } from "@/lib/pesan-sementara";
import { useOverlayHanyaGagal } from "@/lib/global-loading";
import { BannerGangguan } from "@/components/portal/banner-gangguan";
import { TombolTutupPesan } from "@/components/portal/tombol-tutup-pesan";
import { cn } from "@/lib/utils";
import { kelasTulisanPutusan, warnaStatusPutusan } from "@/lib/warna-putusan";

/**
 * Status satu perkara.
 *
 * ============================================================================
 * MENCARI DULU, BARU MEMBUKA
 * ============================================================================
 *
 * Petugas mengingat "419", bukan nomor lengkapnya. Angka itu dapat cocok pada
 * beberapa perkara - Pdt.G, Pdt.P, tahun berbeda - jadi pencarian menampilkan
 * daftarnya untuk dipilih. Membuka yang pertama begitu saja berarti menampilkan
 * perkara yang keliru tanpa ada yang menyadarinya.
 */

/** Saringan pencarian. Kosong seluruhnya berarti belum ada yang dicari. */
type Saringan = {
  cari: string;
  jenisPerkara: string;
  status: string;
  tahun: string;
  // Rentang tanggal PENDAFTARAN. Bot dan rute portal sudah lama menerimanya
  // (sejak/sampai), tetapi layar ini tidak pernah menyediakan kotaknya.
  sejak: string;
  sampai: string;
  alurPerkaraId: number;
  namaPihak: string;
  petugas: string;
  // --- pencarian mendalam ---
  hakim: string;
  panitera: string;
  jurusita: string;
  statusPutusan: string;
  pertimbangan: string;
  amar: string;
  verstek: string;
  alamatPihak: string;
  kua: string;
  relaas: string;
  putusSejak: string;
  putusSampai: string;
  umur: string;
  ecourt: string;
};

const SARINGAN_KOSONG: Saringan = {
  cari: "",
  jenisPerkara: "",
  status: "",
  tahun: "",
  sejak: "",
  sampai: "",
  alurPerkaraId: 0,
  namaPihak: "",
  petugas: "",
  hakim: "",
  panitera: "",
  jurusita: "",
  statusPutusan: "",
  pertimbangan: "",
  amar: "",
  verstek: "",
  alamatPihak: "",
  kua: "",
  relaas: "",
  putusSejak: "",
  putusSampai: "",
  umur: "",
  ecourt: "",
};

/**
 * Keadaan relaas. Kuncinya harus sama persis dengan yang dikenali bot -
 * kunci yang tidak dikenali akan diabaikan diam-diam, dan petugas melihat
 * hasil yang sama seolah saringannya tidak berpengaruh.
 */
const PILIHAN_RELAAS = [
  { kunci: "retur", label: "Relaas retur" },
  // "Dipanggil lewat surat tercatat", BUKAN "Pemanggilan gagal".
  //
  // Kuncinya menjaring ket_temu = 'S', dan komentar kolom SIPP sendiri
  // menyebut S = surat tercatat. Terukur di sipp_donggala 25 September 2026:
  // 1.431 perkara bersandi S, dan 829 di antaranya ber-status_pos = 1 yang
  // berarti BERHASIL. Label lama karena itu melaporkan 1.431 pemanggilan gagal
  // yang tidak pernah gagal - angka tunggakan yang dikarang. Yang sungguh gagal
  // dijaring kunci "retur" (relaas dikembalikan): 180 perkara.
  { kunci: "surat_tercatat", label: "Dipanggil lewat surat tercatat" },
  { kunci: "ghaib", label: "Dipanggil sebagai ghaib" },
  { kunci: "bertemu", label: "Bertemu langsung" },
  { kunci: "tanpa_relaas", label: "Belum ada relaas" },
];

/**
 * Umur perkara yang belum putus. Lima bulan adalah ambang SEMA 2/2014 -
 * pertanyaan yang ditanyakan pengawasan tiap bulan.
 */
const PILIHAN_UMUR = [
  { kunci: "lewat3bulan", label: "Belum putus, lewat 3 bulan" },
  { kunci: "lewat5bulan", label: "Belum putus, lewat 5 bulan (SEMA 2/2014)" },
];

/** Jenis putusan yang benar-benar ada di register. */
const PILIHAN_PUTUSAN = [
  "Dikabulkan",
  "Ditolak",
  "Tidak Dapat Diterima",
  "Dicabut",
  "Digugurkan",
  "Dicoret dari Register",
];

/** Kunci status yang dikenali bot - disalin agar layar dapat menampilkannya. */
const PILIHAN_STATUS = [
  { kunci: "berjalan", label: "Masih berjalan" },
  { kunci: "putus", label: "Sudah putus" },
  { kunci: "belum_minutasi", label: "Putus, belum diminutasi" },
  { kunci: "sudah_minutasi", label: "Sudah diminutasi" },
  { kunci: "belum_bht", label: "Putus, belum BHT" },
  { kunci: "sudah_bht", label: "Sudah BHT" },
  { kunci: "cabut", label: "Dicabut" },
  { kunci: "gugur", label: "Gugur" },
];

const PILIHAN_ALUR = [
  { id: 15, label: "Gugatan (Pdt.G)" },
  { id: 16, label: "Permohonan (Pdt.P)" },
  { id: 17, label: "Gugatan Sederhana (Pdt.G.S)" },
  { id: 122, label: "Jinayah (JN)" },
];
/**
 * Satu baris hasil pencarian. Definisinya - beserta ruas kontrak 25 September
 * 2026 (pihak, kuasa, petugas, tahapan, sidang, umur, e-Court, akta cerai) -
 * hidup di status-perkara-hasil.tsx, di samping tampilan yang memakainya.
 */
type Ditemukan = BarisHasil;

/** Baris pertama yang diminta tiap pencarian - sama dengan sebelum butir 7. */
const BATAS_AWAL = 100;
/** Tambahan tiap "Muat lebih banyak". */
const BATAS_TAMBAH = 100;
/**
 * Pagu seluruh baris yang dapat dimuat - sama dengan pagu `batas` di bot
 * (kontrak 25 September 2026). Lewat dari itu jawabannya persempit pencarian,
 * bukan tabel lima ribu baris di peramban.
 */
const PAGU_MUAT = 500;

/**
 * Tiga keadaan panel Tag dan Saringan lain (butir 9, 25 September 2026).
 *
 *   tertutup  tidak tampak sama sekali
 *   terbuka   panel utuh
 *   kecil     satu baris ringkas: apa yang sedang berlaku, dan "Buka lagi"
 *
 * Panel yang mengecil sendiri sesudah hasilnya datang memberi ruang bagi
 * hasilnya - tanpa menyembunyikan MENGAPA hasilnya seperti itu.
 */
type KeadaanPanel = "tertutup" | "terbuka" | "kecil";

/** Nama tiap saringan untuk ringkasan panel kecil dan lembar cetak. */
const LABEL_SARINGAN: Array<[Exclude<keyof Saringan, "cari">, string]> = [
  ["namaPihak", "Nama pihak"],
  ["jenisPerkara", "Jenis perkara"],
  ["status", "Keadaan"],
  ["alurPerkaraId", "Alur"],
  ["tahun", "Tahun pendaftaran"],
  ["sejak", "Didaftarkan sejak"],
  ["sampai", "Didaftarkan sampai"],
  ["petugas", "Petugas"],
  ["hakim", "Hakim"],
  ["panitera", "Panitera pengganti"],
  ["jurusita", "Juru sita"],
  ["alamatPihak", "Alamat pihak"],
  ["kua", "KUA"],
  ["pertimbangan", "Isi pertimbangan"],
  ["amar", "Isi amar"],
  ["statusPutusan", "Jenis putusan"],
  ["verstek", "Verstek"],
  ["relaas", "Relaas"],
  ["putusSejak", "Putus sejak"],
  ["putusSampai", "Putus sampai"],
  ["umur", "Umur perkara"],
  ["ecourt", "Cara pendaftaran"],
];

/**
 * Saringan yang sedang aktif, dengan nilai yang terbaca orang - label pilihan,
 * bukan kuncinya; tanggal lewat lib/tanggal-indonesia, bukan ISO.
 */
function ringkasSaringan(saringan: Saringan): Array<{ kunci: string; label: string; nilai: string }> {
  const hasil: Array<{ kunci: string; label: string; nilai: string }> = [];
  for (const [kunci, label] of LABEL_SARINGAN) {
    if (kunci === "alurPerkaraId") {
      const id = Number(saringan.alurPerkaraId) || 0;
      if (id > 0) hasil.push({ kunci, label, nilai: PILIHAN_ALUR.find((x) => x.id === id)?.label ?? String(id) });
      continue;
    }
    const teks = String(saringan[kunci] ?? "").trim();
    if (!teks) continue;
    let nilai = `“${teks}”`;
    if (kunci === "status") nilai = PILIHAN_STATUS.find((x) => x.kunci === teks)?.label ?? teks;
    else if (kunci === "relaas") nilai = PILIHAN_RELAAS.find((x) => x.kunci === teks)?.label ?? teks;
    else if (kunci === "umur") nilai = PILIHAN_UMUR.find((x) => x.kunci === teks)?.label ?? teks;
    else if (kunci === "verstek") nilai = teks === "ya" ? "putusan verstek" : "bukan verstek";
    else if (kunci === "ecourt") nilai = teks === "ya" ? "lewat e-Court" : "didaftarkan di meja";
    else if (kunci === "sejak" || kunci === "sampai" || kunci === "putusSejak" || kunci === "putusSampai") {
      nilai = tanggalDMY(teks, teks);
    } else if (kunci === "tahun" || kunci === "statusPutusan") nilai = teks;
    hasil.push({ kunci, label, nilai });
  }
  return hasil;
}

/**
 * Apakah dua isian Saringan lain sama - kata cari di luarnya. Dipakai bilah
 * ringkas untuk mengatakan bahwa isian di panel sudah berubah dan BELUM
 * dicari (telaah 26 September 2026).
 */
function samaSaringan(a: Saringan, b: Saringan): boolean {
  return (Object.keys(SARINGAN_KOSONG) as Array<keyof Saringan>)
    .filter((k) => k !== "cari")
    .every((k) => String(a[k] ?? "").trim() === String(b[k] ?? "").trim());
}

/** Tag dan rentang waktu sebagaimana DIKIRIM pada satu pencarian. */
type LingkupTag = { tag: string[]; dasar: string; periode: string; dari: string; sampai: string; acuan: string };

/**
 * Apakah dua lingkup tag menanyakan hal yang sama. Dasar tanggal dan acuan
 * hanya berarti bila ada tag atau periode - pencarian tanpa keduanya tidak
 * mengirimnya sama sekali (lihat jalankanCari).
 */
function samaLingkupTag(a: LingkupTag, b: LingkupTag): boolean {
  if ([...a.tag].sort().join(",") !== [...b.tag].sort().join(",") || a.periode !== b.periode) return false;
  if (a.tag.length === 0 && a.periode === PERIODE_BAWAAN) return true;
  if (a.dasar !== b.dasar) return false;
  if (periodeButuhTanggal(a.periode)) return a.dari === b.dari && a.sampai === b.sampai;
  if (a.periode === PERIODE_BAWAAN) return true;
  return (a.acuan || "") === (b.acuan || "");
}

/** Nama tag untuk dibaca orang; kuncinya hanya bila katalognya belum ada. */
function labelTag(katalog: KatalogTag | null, kunci: string): string {
  return katalog?.tag.find((x) => x.kunci === kunci)?.label ?? kunci;
}

/** "triwulan ini (acuan hari ini), menurut tanggal didaftarkan". */
function kalimatRentang(
  katalog: KatalogTag | null,
  dasar: string,
  periode: string,
  dari: string,
  sampai: string,
  acuan: string
): string {
  const labelDasar = (katalog?.dasar ?? []).find((x) => x.kunci === dasar)?.label ?? dasar;
  const labelPeriode = PERIODE_TAG.find((x) => x.nilai === periode)?.label ?? periode;
  let rentang: string;
  if (periode === PERIODE_BAWAAN) rentang = "seluruh register";
  else if (periodeButuhTanggal(periode)) rentang = `${tanggalDMY(dari, "—")} s.d. ${tanggalDMY(sampai, "—")}`;
  else rentang = `${labelPeriode.toLowerCase()} (acuan ${acuan ? tanggalDMY(acuan, acuan) : "hari ini"})`;
  return `${rentang}, menurut tanggal ${labelDasar.toLowerCase()}`;
}

/**
 * Kriteria pencarian sebagai kalimat - dicetak di kepala lembar hasil.
 *
 * Disusun SAAT pencarian dijalankan, dari nilai yang dikirim, bukan dari isian
 * layar ketika tombol cetak ditekan: isian boleh sudah disunting sesudahnya,
 * dan lembar yang menyebut kriteria yang tidak menghasilkan daftarnya berbohong.
 */
function susunKriteria(p: {
  kata: string;
  saringan: Saringan;
  tag: string[];
  katalog: KatalogTag | null;
  dasar: string;
  periode: string;
  dari: string;
  sampai: string;
  acuan: string;
}): string[] {
  const kalimat: string[] = [];
  if (p.kata) kalimat.push(`Kata cari: “${p.kata}”.`);
  const aktif = ringkasSaringan(p.saringan);
  if (aktif.length > 0) {
    kalimat.push(`Saringan: ${aktif.map((x) => `${x.label.toLowerCase()} ${x.nilai}`).join("; ")}.`);
  }
  if (p.tag.length > 0) {
    kalimat.push(`Tag: ${p.tag.map((k) => labelTag(p.katalog, k)).join(" DAN ")}.`);
  }
  if (p.tag.length > 0 || p.periode !== PERIODE_BAWAAN) {
    kalimat.push(`Rentang waktu: ${kalimatRentang(p.katalog, p.dasar, p.periode, p.dari, p.sampai, p.acuan)}.`);
  }
  return kalimat;
}

type ButirNilai = {
  kunci: string;
  label: string;
  keterangan: string;
  dasar: string;
  bobot: number;
  bagian: number;
  nilai: number;
  catatan: string;
  belumDinilai: boolean;
  /**
   * Butir yang BELUM WAKTUNYA dinilai - perkara belum diputus, sidang belum
   * ada yang berlalu. Tidak ikut membagi skor, dan tidak boleh ditampilkan
   * sebagai kekurangan: yang merah di sini akan dibaca sebagai kesalahan
   * pengadilan atas pekerjaan yang belum jatuh tempo.
   *
   * Boleh tidak ada - bot versi lama belum mengirimkannya.
   */
  dihitung?: boolean;
  belumBerlaku?: boolean;
};

export type Status = {
  identitas: {
    perkaraId: string;
    nomorPerkara: string;
    jenisPerkara: string;
    jenisPerkaraLengkap: string;
    tanggalDaftar: string;
  };
  umur: {
    hariBersih: number | null;
    hariMediasi: number;
    hariBerjalan: number | null;
    bulanBerjalan: number | null;
    sudahPutus: boolean;
    /**
     * "putus", "dicabut", atau "gugur". Ketiganya sama-sama berakhir dengan
     * tanggal putusan - yang berbeda hanya sebutannya bagi yang membaca.
     *
     * Boleh tidak ada - bot versi lama belum mengirimkannya.
     */
    sebabSelesai?: string;
    hariMinutasi: number | null;
  };
  // id = hakim_id / panitera_id / jurusita_id SIPP - kunci rekap orangnya.
  // Boleh tidak ada: bot versi lama belum mengirimnya, dan namanya lalu tampil
  // sebagai teks biasa, bukan tautan.
  //
  // Sejak perbaikan majelis ikrar (27 September 2026) ketiganya = PEMERIKSA
  // (majelisPemeriksaService di bot): yang menjabat pada hari putusan, bukan
  // yang aktif sekarang. keteranganTahapan terisi untuk penunjukan verzet,
  // banding, dan seterusnya.
  majelis: Array<{
    id?: number | null;
    kode: string;
    nama: string;
    jabatan: string;
    kedudukan?: string;
    tahapanId?: number | null;
    keteranganTahapan?: string;
  }>;
  panitera: Array<{ id?: number | null; kode: string; nama: string; tahapanId?: number | null; keteranganTahapan?: string }>;
  jurusita: Array<{ id?: number | null; kode: string; nama: string; tahapanId?: number | null; keteranganTahapan?: string }>;
  /**
   * Majelis ikrar talak - blok tersendiri, bukan majelis perkara. Per peran
   * dari penunjukan aktif tahapan 18 atau, bila tabel penunjukan tidak
   * mencatatnya, dari borang penetapan ikrar (sumber "penetapanIkrar").
   * null = tidak ada ikrar; tidak ada = bot versi lama.
   */
  ikrar?: MajelisIkrar | null;
  /**
   * "pemeriksa"; "aktif" bila bot jatuh ke penunjukan aktif; "tidakTerbaca"
   * bila penunjukan tidak terbaca sama sekali. Tidak ada = bot lama.
   */
  sumberMajelis?: string;
  saksi: { ada: boolean; jumlahSaksi: number; jumlahKeterangan: number };
  pihak: Array<{ nama: string; pihakKe: number | null; jenis: string; adaNomor: boolean; nomorSamar: string }>;
  identitasPihak: {
    jenisPerkara: string;
    kumulasi: string[];
    adaKumulasi: boolean;
    adaKuasa: boolean;
    kuasaPenggugat: boolean;
    kuasaTergugat: boolean;
  } | null;
  jadwal: Array<{
    sidangId: string;
    tanggalSidang: string;
    jamSidang: string;
    agenda: string;
    ruangan: string;
    ditunda: boolean;
    alasanDitunda: string;
    urutanSidang: number;
    adaBas: boolean;
  }>;
  penundaan: Array<{ tanggalSidang: string; agenda: string; alasanDitunda: string }>;
  putusan: {
    sudahPutus: boolean;
    tanggalPutusan: string;
    statusPutusan: string;
    verstek: boolean;
    tanggalMinutasi: string;
    tanggalBht: string;
    adaBerkasPutusan: boolean;
    adaBerkasAnonim: boolean;
    aktaCerai: { nomor: string; tanggal: string; diserahkanPihak1: string; diserahkanPihak2: string } | null;
    upayaHukum: Array<{ jenis: string; tanggal: string }>;
  } | null;
  biaya: {
    panjar: number;
    terpakai: number;
    sisa: number;
    rincian: Array<{ jenis: string; uraian: string; jumlah: number; tanggal: string }>;
  };
  dokumenEcourt: Array<{ documentKey: string; judulDokumen: string; statusVerifikasi: string }>;
  petitum: { ada: boolean; berkas?: string };
  /**
   * Relaas pelaksanaan panggilan, apa adanya dari SIPP - satu baris per pihak
   * per sidang. Berbeda dari nilaiRelaas yang sudah diolah untuk penilaian SK.
   *
   * ==========================================================================
   * DELAPAN RUAS PERNAH HILANG DI SINI, BUKAN DI BOT
   * ==========================================================================
   *
   * relaasSidang di bot sudah memulangkan jurusita, ketemu-tidaknya,
   * keterangan hasil, jejak pos beserta resinya, dan kedudukan pihak sejak
   * lama. Tipe di layar ini hanya menyebut delapan ruas, sehingga separuh
   * jawaban yang sudah melintasi jaringan berhenti di sini tanpa satu galat
   * pun - dan yang membaca layar menyimpulkan SIPP-nya yang kosong.
   */
  relaas: Array<{
    id: string;
    sidangId: string;
    tanggalSidang: string;
    namaPihak: string;
    peran: string;
    /** Kedudukan pihak: 1 penggugat/pemohon, 2 tergugat/termohon. */
    pihakKe: number | null;
    /** Tanggal relaas DISERAHKAN kepada yang dipanggil. */
    tanggalRelaas: string;
    /** Tanggal surat diserahkan ke kantor pos - "dikirim" pada SK KMA 363/2022. */
    tanggalKirimPos: string;
    /** Hasil lacak kiriman pos; 1 sampai, 2 dikembalikan. */
    statusPos: number | null;
    retur: boolean;
    ketHasilRelaas: string;
    /** Jurusita bertemu langsung dengan yang dipanggil. */
    bertemu: boolean;
    caraRelaas?: CaraRelaas;
    noResiPos: string;
    jurusitaNama: string;
    adaDokumen: boolean;
    adaResi: boolean;
  }>;
  /**
   * Court Calendar SIPP - RENCANA sidang yang disusun majelis di awal perkara
   * (tabel perkara_court_calendar), bukan sidang yang terjadi.
   *
   * Diukur 14 September 2026: baru 418 dari 791 perkara 2026 mengisinya, jadi
   * KOSONG adalah keadaan yang lazim - bukan cacat yang perlu dituduhkan.
   *
   * Boleh tidak ada: bot versi lama belum mengirimkannya.
   */
  courtCalendar?: {
    terbaca: boolean;
    alasan: string;
    baris: Array<{
      tanggal: string;
      jam: string;
      agenda: string;
      keterangan: string;
      diinputOleh: string;
      diinputTanggal: string;
      adaSidang: boolean;
      /** terlaksana | terjadwal | meleset | menunggu - lihat courtCalendarPerkara. */
      keadaan: string;
    }>;
    jumlah?: number;
    terlaksana?: number;
    terjadwal?: number;
    meleset?: number;
    menunggu?: number;
  };
  /**
   * Kepatutan panggilan per pihak untuk sidang TERAKHIR yang punya relaas -
   * relaas sidang itu saja, bukan relaas seluruh perkara (bot 24 Sep 2026;
   * bot yang lebih lama menilai sidang terakhir yang tercatat).
   *
   * Dinilai bot (ecourtPanggilanService) terhadap jalur yang SEHARUSNYA
   * dipakai - bukan jalur yang terlanjur dipakai - supaya panggilan lewat
   * saluran keliru tidak menjadi patut hanya karena ambang saluran kelirunya
   * lebih longgar.
   *
   * Boleh tidak ada: bot versi lama belum mengirimkannya, dan layar tetap utuh.
   */
  panggilan?: {
    lewatEcourt: boolean;
    /**
     * Sidang yang dinilai - yang terakhir punya relaas, bukan sekadar yang
     * terakhir tercatat. Boleh tidak ada: bot versi lama belum mengirimkannya.
     */
    tanggalSidang?: string | null;
    /**
     * Nomor sidang yang dinilai. Dipakai memeriksa apakah sidang itu memang
     * punya relaas - bila tidak ada satu pun, bot jatuh ke sidang terakhir
     * yang tercatat, dan kalimatnya harus mengatakan begitu.
     */
    sidangId?: string | number | null;
    pihak: Array<{
      nama: string;
      peran: string;
      persetujuan: string;
      seharusnya: string;
      terlaksana: string;
      sudahDikirim: boolean;
      tidakPerluDipanggil: boolean;
      belumDipanggil: boolean;
      salahSaluran: boolean;
      /**
       * Sandi relaas SIPP yang bertentangan dengan e-Court - mis. 'E' kepada
       * pihak yang tidak punya email di e-Court dan tidak pernah dikirimi
       * e-Summons. Bukan salah saluran: yang janggal catatannya, bukan
       * panggilannya. Boleh tidak ada: bot versi lama belum mengirimkannya.
       */
      catatanSaluran?: string;
      tanggalPanggilan: string;
      diterima: boolean | null;
      buktiPenerimaan: string;
      noResiPos: string;
      tanggalPelaksanaanRelaas: string | null;
      kepatutan: {
        ambang: number;
        hariKerja: boolean;
        dasarHukum: string;
        jalur: string;
        perluDiterima: boolean;
        dinilai: boolean;
        patut: boolean | null;
        selisih: number | null;
        alasan: string;
      };
    }>;
    ringkasan: {
      jumlahPihak: number;
      belumDipanggil: number;
      tidakPerluDipanggil: number;
      salahSaluran: number;
      /** Pihak yang ber-catatanSaluran - dihitung tersendiri, bukan disembunyikan. */
      saluranBelumPasti?: number;
      tidakPatut: number;
      penerimaanBelumTerbukti: number;
      patut: number;
    };
  };
  dokumenSipp: Array<{ id: string; namaDokumen: string }>;
  lewatEcourt: boolean;
  penilaian: {
    skor: number;
    keadaan: "baik" | "perhatian" | "kurang";
    totalBobot: number;
    rinci: ButirNilai[];
    catatan: string;
  };
  /**
   * Garis waktu, jeda antar sidang, ketepatan input, dan ringkasan - dirakit
   * bot dari data yang sudah ada, tanpa kueri tambahan ke SIPP.
   *
   * Boleh tidak ada: bot versi lama belum mengirimkannya, dan layar tetap utuh
   * tanpa bagian ini.
   */
  analisa?: {
    garisWaktu: {
      terbaca: boolean;
      alasan: string;
      mulai?: string;
      akhir?: string;
      sebabAkhir?: string;
      totalHari?: number;
      panjangHari?: number;
      ambangHari?: number;
      ambangTampak?: boolean;
      titik: Array<{
        kunci: string;
        label: string;
        tanggal: string;
        hariKe: number;
        jenis: string;
        agenda?: string;
        ditunda?: boolean;
      }>;
    };
    jedaSidang: {
      terbaca: boolean;
      alasan: string;
      baris: Array<{ dari: string; ke: string; hari: number; alasan: string; jenis: string }>;
      rata: number | null;
      terpanjang: { dari: string; ke: string; hari: number; alasan: string; jenis: string } | null;
    };
    ketepatanInput: {
      terbaca: boolean;
      alasan: string;
      dasar?: string;
      terlambat: number;
      baris: Array<{
        kunci: string;
        label: string;
        tanggal: string;
        diinput: string;
        selisih: number;
        poin: number;
        poinMaksimal: number;
        sebutan: string;
      }>;
    };
    ringkasan: string[];
  };
  penanda: {
    ghaib: boolean | null;
    sumberGhaib: string[];
    instansi: Array<{
      kunci: string;
      label: string;
      pihak: Array<{ nama: string; peran: string; pekerjaan: string }>;
    }>;
    perluIzinAtasan: boolean;
    mafqud: boolean | null;
    tundaanPanjang: Array<{ dari: string; ke: string; hari: number; agenda: string }>;
    ambangMafqud: { hari: number; kali: number };
  };
  penetapanKembali: {
    terbaca: boolean;
    adaPenggantian: boolean;
    baris: Array<{
      jenis: string;
      penggantian: Array<{
        nama: string;
        masihAktif: boolean;
        tanggalTidakAktif: string;
        diperbaharuiPada: string;
        diperbaharuiOleh: string;
      }>;
    }>;
  };
  durasiMediasi: { terbaca: boolean; hari: number; alasan: string };
  nilaiRelaas: {
    terbaca: boolean;
    alasan: string;
    sumber: string;
    dariAudit?: boolean;
    nilaiLangsung?: number;
  };
  saksiRinci: {
    terbaca: boolean;
    alasan: string;
    baris: Array<{
      nama: string;
      keterangan: string;
      diajukanOleh: string;
      alamat: string;
      isianTerisi: number;
      isianKurang: string[];
    }>;
    dikecualikan?: boolean;
  };
  ikrarTalak: {
    terbaca: boolean;
    alasan: string;
    ada: boolean;
    ikrarId?: string;
    penetapanMajelis?: string;
    majelis?: string;
    penetapanPp?: string;
    panitera?: string;
    penetapanJs?: string;
    jurusita?: string;
    penetapanSidang?: string;
    sidangPertama?: string;
    tanggalIkrar?: string;
    amar?: string;
    nomorSk?: string;
    adaBerkas?: boolean;
    statusId?: number | null;
    status?: string;
    sudahDiucapkan?: boolean;
  };
  putusanLengkap: {
    terbaca: boolean;
    ada: boolean;
    alasan?: string;
    tanggalPutusan?: string;
    statusPutusan?: string;
    amar?: string;
    amarAnonim?: string;
    sumberHukum?: string;
    faktorPrimer?: string;
    faktorSekunder?: string;
    qoblaBada?: string;
    statusNusyuz?: string;
  };
  arsipKeterangan: {
    terbaca: boolean;
    alasan: string;
    sudahDiarsipkan: boolean;
    berkasTerbaca?: boolean;
    alasanBerkas?: string;
    baris: Array<{
      arsipId: string;
      ruang?: string;
      lemari?: string;
      rak?: string;
      box?: string;
      tanggalMasuk?: string;
      penerima?: string;
      lengkap?: boolean;
      pinjam?: {
        tanggalPinjam: string;
        tanggalKembali: string;
        sedangDipinjam: boolean;
        peminjam: string;
        keterangan: string;
      } | null;
      tanggalInput: string;
      nomor: string;
      keterangan: string;
      oleh: string;
      adaBerkas: boolean;
      // "letak" bila berkasnya ada di tempat semestinya, "nama" bila ketemu
      // di tempat lain lewat penelusuran nama - lihat arsipBerkasService.
      berkasCara?: string;
      berkasBesar?: number | null;
      berkasDiubah?: string;
      berkasCatatan?: string;
    }>;
  };
  // Apakah putusannya benar-benar terbit di e-Court. null bila belum putus.
  putusanEcourt: {
    keadaan: string;
    sebutan: string;
    perluTindakan: boolean;
    keterangan: string;
    ecourt: {
      adaTab: boolean;
      adaBaris: boolean;
      nomorPutusan: string;
      nomorSalinan: string;
      tanggalPutusanTeks: string;
      tanggalBhtTeks: string;
      dokumenAda: boolean;
      dokumenJudul: string;
      diunggahOleh: string;
      tanggalUnggahTeks: string;
      paniteraNama: string;
      paniteraTte: boolean;
      paniteraTanggalTte: string;
      diperiksaPada: string;
    } | null;
  } | null;
  konseptor: {
    terbaca: boolean;
    alasan: string;
    // Terisi bila namanya berasal dari jejak audit, bukan dari tahapan
    // putusan - atau bila keduanya tidak menjawab.
    catatan?: string;
    dariAudit?: boolean;
    baris: Array<{
      pengguna: string;
      nama: string;
      namaTerbaca: boolean;
      tanggal: string;
      dariAudit?: boolean;
    }>;
  };
  delegasiMasuk: {
    terbaca: boolean;
    alasan: string;
    baris: Array<{
      asal: string;
      tanggalDiunggah: string;
      tanggalDiterima: string;
      hariSampaiTerima: number | null;
    }>;
  };
  delegasiKeluar: {
    terbaca: boolean;
    alasan: string;
    baris: Array<{
      tujuan: string;
      tanggalPermohonan: string;
      tanggalSelesai: string;
      tanggalSidang: string;
      tanggalResi: string;
      hariSebelumSidang: number | null;
      panggilan: boolean;
      nilai: number | null;
      pelaksanaan: { tanggalRelaas: string; jurusita: string } | null;
    }>;
  };
  mediasi: {
    terbaca: boolean;
    alasan: string;
    jadwal?: Array<{
      tanggal: string;
      jam: string;
      sampaiJam: string;
      tempat: string;
      dihadiri: string;
      ditunda: boolean;
    }>;
    mediator?: Array<{
      nama: string;
      tanggalPenetapan: string;
      nomorSk: string;
      status: string;
      masihAktif: boolean;
    }>;
    kolomTersedia?: string[];
    baris: Array<{
      mediator: string;
      /**
       * mediator_id tiap nama pada `mediator`, urutannya sejajar; null bila
       * bagian itu tidak terbaca. Boleh tidak ada - bot versi lama belum
       * mengirimnya, dan namanya lalu tampil sebagai teks biasa.
       */
      mediatorIds?: Array<number | null>;
      hasil: string;
      tanggalMulai: string;
      tanggalSelesai: string;
      lamaHari: number | null;
      lewatTenggang: boolean | null;
      jumlahPertemuan: number | null;
      jenisPenetapan: string;
      tanggalPenetapan: string;
      tanggalLaporan: string;
      /**
       * dimulai_mediasi apa adanya - ujung awal yang dipakai v_durasi_mediasi.
       * Sudah dikirim bot sejak lama (sippTahapanService.mediasiLengkapPerkara);
       * tipenya saja yang belum menyebut, sehingga ruasnya berhenti di sini.
       * Dipakai grafik Umur perkara pada tiap sidang untuk menempatkan hari
       * mediasi yang tidak dihitung pada TANGGALNYA.
       */
      tanggalDimulaiTercatat?: string;
      tanggalKesepakatan: string;
      isiKesepakatan: string;
      nomorSk: string;
      statusMediator: string;
      kodeHasil: string;
      berhasil: boolean;
      lamaDariView: boolean;
      catatan: string;
      tanggalKeputusan: string;
    }>;
    lamaHariView?: number | null;
  };
  tahapan: {
    terbaca: boolean;
    alasan: string;
    tahap: TahapPerkara[];
  };
  upayaHukum: Array<{
    jenis: string;
    sebutan: string;
    tanggalPermohonan: string;
    tanggalPutusan: string;
    nomorPerkara: string;
    dicabut: boolean;
    gugur: boolean;
    tahapan: Array<{ kunci: string; label: string; tanggal: string; adaKolom: boolean }>;
    keterangan: {
      nomorPerkara?: string;
      pemohon?: string;
      statusPutusan?: string;
      keadaan?: string;
      majelis?: string;
      paniteraPengganti?: string;
      amar?: string;
      catatan?: string;
    };
    tahapTakDikenali: string[];
    kolomTersedia: string[];
  }>;
  penilaianSk: {
    rinci: UnsurSk[];
    unsurBelumTersambung: Array<{ kunci: string; label: string; catatan: string }>;
    dasar: string;
    catatan: string;
  };
};

/** Satu tahap perkara: kapan terjadi, dan kapan diinput ke SIPP. */
type TahapPerkara = {
  kunci: string;
  label: string;
  dasar: string;
  tanggal: string;
  diinput: string;
  terbaca: boolean;
  inputTerbaca: boolean;
  alasan: string;
  alasanInput: string;
  hariSejakAcuan: number | null;
  hariSampaiInput: number | null;
  acuan: string;
  dokumenId: string;
  adaBerkas: boolean;
  diinputOleh: string;
};

/** Satu unsur penilaian menurut SK Dirjen Badilag 048/2024. */
type UnsurSk = {
  kunci: string;
  label: string;
  aspek: "kinerja" | "input" | "kelengkapan" | "kesesuaian";
  pengurang: boolean;
  bobot: number;
  dasar: string;
  keterangan: string;
  poin: number | null;
  terbaca: boolean;
  catatan: string;
};

const ASPEK_SK: Array<{ kunci: UnsurSk["aspek"]; label: string; bobot: string }> = [
  { kunci: "kinerja", label: "Kinerja penanganan perkara", bobot: "50%" },
  { kunci: "input", label: "Input data SIPP", bobot: "40%" },
  { kunci: "kelengkapan", label: "Kelengkapan dokumen", bobot: "10%" },
  { kunci: "kesesuaian", label: "Kesesuaian (pengurang)", bobot: "-10%" },
];

function rupiah(nilai: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
    nilai || 0
  );
}

/** Kartu angka besar - dipakai jajaran ringkasan di atas. */
function Angka({
  label,
  nilai,
  keterangan,
  nada,
}: {
  label: string;
  nilai: string;
  keterangan?: string;
  nada?: "baik" | "perhatian" | "kurang";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        nada === "baik"
          ? "border-emerald-300/60 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10"
          : nada === "perhatian"
            ? "border-amber-300/60 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10"
            : nada === "kurang"
              ? "border-rose-300/60 bg-rose-50/60 dark:border-rose-500/30 dark:bg-rose-500/10"
              : "bg-card"
      )}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums">{nilai}</p>
      {keterangan ? <p className="text-sm text-muted-foreground">{keterangan}</p> : null}
    </div>
  );
}

/**
 * `Bagian` DIPINDAHKAN ke src/components/portal/bagian-ciut.tsx.
 *
 * Isinya tidak diubah satu baris pun - hanya tempatnya. Panel Rincian pada
 * layar Antrian Sidang memerlukan komponen yang persis sama, dan menyalinnya
 * ke sana akan meninggalkan dua salinan yang menyimpang diam-diam: yang satu
 * diperbaiki, yang lain tidak, dan tidak ada yang berbunyi ketika itu terjadi.
 *
 * Kedua puluh empat pemakaian di bawah tetap berperilaku persis sama, termasuk
 * kunci penyimpanannya - lihat catatan awalan kunci di berkas barunya.
 */

/**
 * Ringkasan para pihak untuk kepala bagian yang terciut.
 *
 * Yang disebut hanya HITUNGANNYA, tidak satu nama pun: kepala bagian selalu
 * terlihat, juga oleh yang kebetulan lewat di depan meja - dan menaruh nama
 * orang di sana membatalkan gunanya bagian itu diciutkan.
 */
function ringkasPihak(pihak: Array<{ jenis: string; adaNomor: boolean }>) {
  if (!Array.isArray(pihak) || pihak.length === 0) return "Pihak belum tercatat.";
  const tanpaNomor = pihak.filter((x) => !x.adaNomor).length;
  const sisi = new Map<string, number>();
  for (const x of pihak) {
    const nama = String(x.jenis || "").trim() || "tidak disebut";
    sisi.set(nama, (sisi.get(nama) ?? 0) + 1);
  }
  const rincian = [...sisi.entries()].map(([nama, n]) => `${n} ${nama}`).join(", ");
  return (
    `${pihak.length} pihak - ${rincian}` +
    (tanpaNomor > 0 ? `; ${tanpaNomor} tanpa nomor di SIPP` : "") +
    ". Terciut sebagai bawaan - nama pihak adalah data pribadi."
  );
}

/**
 * Teks SIPP berpemisah HTML menjadi baris-baris bersih.
 *
 * Borang ikrar talak menyimpan majelisnya sebagai "Hakim Ketua: Ulfah,
 * S.Ag., M.H.</br>Hakim Anggota 1: ..." - bentuk </br> (garis miring di
 * depan), yang tidak dikenali pemecah <br/> milik mediator. React menulis
 * teks apa adanya, jadi dulu tanda "</br>" tercetak di bagian Ikrar talak.
 * Tanda lain dibuang, tidak dirender.
 */
export function barisTeksSipp(teks: unknown): string[] {
  return String(teks ?? "")
    .split(/<\s*\/?\s*br\s*\/?\s*>|\r?\n/i)
    .map((x) => x.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Isi teks SIPP berpemisah sebagai baris-baris blok di dalam satu <dd>. */
function TeksBerbaris({ teks }: { teks: string }) {
  return (
    <dd className="text-sm text-muted-foreground">
      {barisTeksSipp(teks).map((baris, urutan) => (
        <span key={`${urutan}-${baris}`} className="block">
          {baris}
        </span>
      ))}
    </dd>
  );
}

/**
 * @param nomorAwal perkara yang langsung dibuka, dikirim layar Jadwal Sidang.
 */
export function AletaEcourtStatusPerkara({ nomorAwal = "" }: { nomorAwal?: string } = {}) {
  const [cari, setCari] = useState(nomorAwal);
  const [saringan, setSaringan] = useState<Saringan>(SARINGAN_KOSONG);
  const [keadaanSaringan, setKeadaanSaringan] = useState<KeadaanPanel>("tertutup");
  const saringanTampil = keadaanSaringan === "terbuka";
  const saringanAktif = useMemo(() => ringkasSaringan(saringan), [saringan]);
  const [hasilCari, setHasilCari] = useState<Ditemukan[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");
  // Butir 3 (5 Okt 2026): pesan BERHASIL ("N nomor perkara disalin") dipisah
  // dari `pesan` (keterangan/penolakan yang menetap) dan hilang sendiri.
  // Butir 26 (6 Okt 2026): yang berhasil tidak lagi muncul sebagai pesan
  // tersendiri di atas tabel - kabarnya pindah ke tulisan tombol salinnya
  // ("Disalin (N)") selama beberapa detik, lalu kembali.
  const [tandaSalin, setTandaSalin] = useState("");
  useHilangSendiri(tandaSalin, true, () => setTandaSalin(""), 2500);
  // Butir 26 (6 Okt 2026): di layar ini lapisan layar penuh hanya untuk
  // GAGAL - tanpa lapisan "Sedang memproses..." dan "Proses berhasil".
  useOverlayHanyaGagal();

  // ======================================================================
  // BUTIR 14 (5 Okt 2026) - GANGGUAN JARINGAN DICOBA LAGI SENDIRI
  // ======================================================================
  // Tiap pemuatan (buka perkara, cari, muat lebih banyak) mencatat cara
  // mengulangnya; bila gagal karena gangguan jaringan / 502-504 / jawaban
  // bukan JSON, banner kuning menghitung mundur lalu mengulangnya - satu
  // percobaan pada satu waktu. Hasil yang sudah tampil tidak dikosongkan.
  const ulangTerakhir = useRef<(() => Promise<unknown>) | null>(null);
  const cobaLagiStatus = useCobaLagiOtomatis(() => ulangTerakhir.current?.());
  const { laporGagal: laporGagalStatus, laporBerhasil: laporBerhasilStatus } = cobaLagiStatus;
  /**
   * `available: false` dari rute: bot tak terjangkau = gangguan (dicoba lagi
   * sendiri); selain itu (kueri SIPP habis waktu, tabel tidak ada) tetap merah
   * apa adanya seperti semula - mengulang kueri berat tiap beberapa detik
   * hanya membebani SIPP.
   */
  const tanganiTakTersedia = useCallback(
    (pesanBot: string) => {
      if (botTakTerjangkau(pesanBot)) {
        laporGagalStatus(new GalatJawaban(pesanBot, 503, true), 503, `${pesanBot} ALETA akan mencoba memuat lagi sendiri.`);
      } else {
        // Server terjangkau dan menjawab: bukan gangguan jaringan.
        laporBerhasilStatus();
        setGalat(pesanBot);
      }
    },
    [laporGagalStatus, laporBerhasilStatus]
  );
  // ======================================================================
  //
  // Kueri pencarian terakhir disimpan TANPA batas dan lewati, supaya "Muat
  // lebih banyak" meneruskan pertanyaan yang sama persis - bukan pertanyaan
  // yang disusun ulang dari isian yang barangkali sudah disunting.
  const [adaLagi, setAdaLagi] = useState(false);
  const [memuatLagi, setMemuatLagi] = useState(false);
  const [kueriHasil, setKueriHasil] = useState("");
  const [nomorHasil, setNomorHasil] = useState(0);
  const [kriteriaHasil, setKriteriaHasil] = useState<string[]>([]);
  // Saringan dan lingkup tag yang SUNGGUH dikirim pada pencarian yang sedang
  // tampil. Bilah ringkas digambar dari sini, bukan dari isian panel: isian
  // boleh sudah disunting sesudahnya tanpa dicari, dan bilah yang menyebut
  // isian yang belum pernah dicari menjelaskan daftar yang bukan miliknya
  // (telaah 26 September 2026 - "Budi" di bilah, daftar masih "Rahmat").
  const [saringanDicari, setSaringanDicari] = useState<Saringan | null>(null);
  const [tagDicari, setTagDicari] = useState<LingkupTag | null>(null);
  // Bagian keterangan yang gagal dibaca bot (kiriman `ruasTakTerbaca`) TIDAK
  // disimpan di sini: ia ditempelkan ke tiap baris halamannya lewat
  // tandaiTakTerbaca(), sehingga halaman yang gagal tidak menandai halaman
  // lain yang terbaca utuh.
  //
  // Lapis kata bebas yang menjawab: "dalam" berarti nomor, jenis, pihak, dan
  // kuasa tidak cocok sama sekali, dan yang tampil ketemu di alamat, KUA,
  // petugas, agenda sidang, pertimbangan, atau amar.
  const [lapisHasil, setLapisHasil] = useState("");
  // Pilihan tampilan diingat per peramban; urutannya bertahan antar pencarian
  // selama layar ini terbuka.
  const [tampilanHasil, setTampilanHasil] = useState<TampilanHasil>(bacaTampilanTersimpan);
  const [urutHasil, setUrutHasil] = useState<Urutan>(null);
  const { institutionIdentity } = usePortal();

  // ======================================================================
  // PANEL YANG MENGECIL SENDIRI (butir 9)
  // ======================================================================
  //
  // Penghitung sentuhan tiap panel. Nilainya dicatat saat pencarian mulai;
  // bila sesudah itu penggunanya masih mengetik atau memilih di dalam panel,
  // penghitungnya bergeser dan panelnya TIDAK dikecilkan ketika jawaban
  // datang. Panel yang menghilang di tengah orang mengetik lebih buruk daripada
  // panel yang tidak pernah mengecil.
  const sentuhTag = useRef(0);
  const sentuhSaringan = useRef(0);
  const panelTag = useRef<HTMLDivElement>(null);
  const panelSaringan = useRef<HTMLDivElement>(null);
  const [fokusRingkas, setFokusRingkas] = useState<"tag" | "saringan" | null>(null);
  // ======================================================================
  // PANEL TIDAK MENGECIL DI BAWAH PENUNJUK
  // ======================================================================
  //
  // Telaah 26 September 2026: pengguna menekan tag, lalu selagi menunggu
  // menggulir panel dengan roda tetikus dan menunjuk chip lain untuk membaca
  // judulnya - menimbang tag kedua. Jawaban datang, panel diganti bilah
  // ringkas, dan chip yang sedang ditunjuk lenyap dari bawah penunjuk.
  //
  // Dua aturan menutupnya: roda tetikus di dalam panel dihitung sentuhan
  // (masih menelusuri - tidak dikecilkan), dan bila penunjuk tetikus sedang
  // berada DI ATAS panel ketika jawaban datang, pengecilannya DITUNDA sampai
  // penunjuk keluar - selama tidak ada sentuhan baru dan pencariannya masih
  // yang sama. Sentuhan jari tidak menunda: sesudah jari diangkat, penunjuknya
  // tidak lagi "di atas" apa pun.
  const penunjukDi = useRef<{ tag: boolean; saringan: boolean }>({ tag: false, saringan: false });
  const tundaKecil = useRef<{
    tag: { sentuh: number; putaran: number } | null;
    saringan: { sentuh: number; putaran: number } | null;
  }>({ tag: null, saringan: null });

  // ======================================================================
  // TAG PERKARA (diminta pengguna 25 September 2026)
  // ======================================================================
  //
  // Katalognya TIDAK disalin ke berkas ini - datang utuh dari bot beserta
  // jumlah tiap tag. Dua daftar yang harus dijaga selaras adalah cara paling
  // pasti membuat layar menyimpang diam-diam ketika tagnya bertambah.
  const [keadaanTag, setKeadaanTag] = useState<KeadaanPanel>("tertutup");
  // Katalog dan angkanya dijaga selama panelnya HIDUP - terbuka maupun
  // dikecilkan. "Buka lagi" karena itu tidak menghitung ulang 88 tag (6,6 detik
  // terukur); yang menghitung ulang hanya perubahan lingkup waktunya.
  const tagTampil = keadaanTag !== "tertutup";
  const tagTerbuka = keadaanTag === "terbuka";
  const [tagPilih, setTagPilih] = useState<string[]>([]);
  const [dasarTag, setDasarTag] = useState(DASAR_BAWAAN);
  const [periodeTag, setPeriodeTag] = useState<string>(PERIODE_BAWAAN);
  const [dariTag, setDariTag] = useState("");
  const [sampaiTag, setSampaiTag] = useState("");
  // Kosong berarti hari ini. Disimpan sebagai teks, bukan sebagai Date, supaya
  // tidak ada zona waktu yang ikut campur - lihat kepala lib/tanggal-indonesia.
  const [acuanTag, setAcuanTag] = useState("");
  // Kotak saring nama tag. Sejak katalognya 88 tag dalam 12 kelompok, memindai
  // seluruhnya dengan mata lebih lambat daripada mengetik tiga huruf.
  const [cariTag, setCariTag] = useState("");
  // Nomor putaran pencarian. Sejak menekan tag langsung mencari, dua pencarian
  // dapat berjalan bersusulan - dan yang LEBIH LAMBAT dapat mendarat terakhir,
  // sehingga layar menampilkan hasil tag yang sudah dilepas. Terukur: satu tag
  // 3,5 sampai 10 detik, jadi susulan itu bukan kemungkinan teoretis.
  const putaranCari = useRef(0);
  const [katalogTag, setKatalogTag] = useState<KatalogTag | null>(null);
  const [memuatTag, setMemuatTag] = useState(false);
  const [galatTag, setGalatTag] = useState("");
  // Berapa yang SUNGGUH cocok dengan tagnya, terlepas dari berapa baris yang
  // muat ditampilkan - dan tag mana yang daftarnya terpotong di bot.
  const [ringkasTag, setRingkasTag] = useState<{
    jumlah: number | null;
    dipotong: string[];
    batasId: number | null;
  }>({ jumlah: null, dipotong: [], batasId: null });

  const buka: (nomorPerkara: string) => Promise<void> = useCallback(async (nomorPerkara: string): Promise<void> => {
    ulangTerakhir.current = () => buka(nomorPerkara);
    setMemuat(true);
    setGalat("");
    setPesan("");
    try {
      const jawaban = await fetch(
        apiPath(`/api/aleta-ecourt/status-perkara?nomor=${encodeURIComponent(nomorPerkara)}`),
        { cache: "no-store" }
      );
      // Status diperiksa sebelum badan dibaca sebagai JSON (502/504, halaman galat proksi).
      const isi = (await bacaJsonAman(jawaban)) as Record<string, unknown> & { data?: Record<string, unknown> };
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal membaca status perkara."));

      const data = (isi?.data ?? isi) as Record<string, unknown>;
      if (!data?.available) {
        tanganiTakTersedia(String(data?.message || "ALETA Bot belum dapat dihubungi."));
        return;
      }
      laporBerhasilStatus();
      if (!data.status) {
        setGalat(
          String(data.alasan) === "perkara_tidak_ditemukan"
            ? "Perkara tidak ditemukan di SIPP."
            : String(data.alasan || "Tidak dapat dibaca.")
        );
        return;
      }
      setStatus(data.status as Status);
    } catch (kesalahan) {
      if (!laporGagalStatus(kesalahan)) {
        setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal membaca status perkara.");
      }
    } finally {
      setMemuat(false);
    }
  }, [laporGagalStatus, laporBerhasilStatus, tanganiTakTersedia]);

  // Datang dari layar Jadwal Sidang dengan nomor perkara: langsung dibuka,
  // tanpa menunggu penggunanya menekan Cari lagi.
  useEffect(() => {
    if (!nomorAwal) return;
    const timer = window.setTimeout(() => {
      void buka(nomorAwal);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [nomorAwal, buka]);

  // ======================================================================
  // KATALOGNYA DIJEMPUT LEBIH DAHULU - TANPA MENYENTUH SIPP
  // ======================================================================
  //
  // Nama tag, kelompok, nada, dan penjelasannya tetapan yang dibekukan di bot;
  // tidak ada satu kueri pun di baliknya. Jumlahnya yang mahal: terukur 6,6
  // detik untuk 88 tag pada lingkup "Seluruhnya".
  //
  // Karena itu panel berdiri SEKETIKA dengan seluruh chipnya - bertanda "…"
  // pada tempat angkanya - lalu angkanya menyusul. Panel yang diam enam
  // setengah detik sebelum satu nama pun terlihat akan dianggap rusak.
  useEffect(() => {
    if (!tagTampil) return;
    // Sekali saja seumur panel: katalognya tidak berubah karena lingkup waktu.
    if (katalogTag) return;

    let dibatalkan = false;
    const pembatal = new AbortController();
    void (async () => {
      try {
        const jawaban = await fetch(
          apiPath("/api/aleta-ecourt/status-perkara/tag?katalogSaja=1"),
          { cache: "no-store", signal: pembatal.signal }
        );
        const isi = await jawaban.json();
        if (dibatalkan) return;
        if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal membaca daftar tag."));
        const data = (isi?.data ?? isi) as KatalogTag & { available?: boolean; message?: string };
        if (!data?.available) return;
        setKatalogTag({
          // null, BUKAN {}: belum dihitung berbeda dari sudah dihitung dan
          // hasilnya kosong. Chip yang belum berangka tidak boleh dimatikan.
          jumlah: null,
          lingkup: null,
          tag: data.tag ?? [],
          kelompok: data.kelompok ?? [],
          dasar: data.dasar ?? [],
          batasId: data.batasId ?? null,
        });
      } catch {
        // Diam: penjemput angka di bawah ini akan melaporkan galatnya, dan dua
        // pesan galat untuk satu sebab membuat panel tampak rusak dua kali.
      }
    })();

    return () => {
      dibatalkan = true;
      pembatal.abort();
    };
  }, [tagTampil, katalogTag]);

  // Angkanya dijemput ulang tiap LINGKUP WAKTU berubah - bukan tiap tag
  // ditekan. Angkanya sengaja tidak menyusut mengikuti tag yang menyala: bila
  // ikut menyusut, menyalakan satu tag membuat tag lain terbaca nol dan tidak
  // ada cara menduga mana yang masih masuk akal ditekan berikutnya.
  useEffect(() => {
    if (!tagTampil) return;
    if (periodeButuhTanggal(periodeTag) && (!dariTag || !sampaiTag)) return;

    let dibatalkan = false;
    const pembatal = new AbortController();
    const kueri = new URLSearchParams({
      dasarTanggal: dasarTag,
      periode: periodeTag,
      acuan: acuanTag || hariIniIso(),
    });
    if (periodeButuhTanggal(periodeTag)) {
      kueri.set("tagDari", dariTag);
      kueri.set("tagSampai", sampaiTag);
    }

    // Keadaan disetel DI DALAM kerjanya, bukan di badan efek: setState yang
    // dipanggil serentak di badan efek memicu gambar-ulang berantai, dan
    // eslint react-hooks menolaknya. Di sini ia juga lebih benar - penanda
    // "sedang menghitung" menyala bersama permintaannya, bukan sebelum.
    void (async () => {
      setMemuatTag(true);
      setGalatTag("");
      try {
        const jawaban = await fetch(
          apiPath(`/api/aleta-ecourt/status-perkara/tag?${kueri.toString()}`),
          { cache: "no-store", signal: pembatal.signal }
        );
        const isi = await jawaban.json();
        if (dibatalkan) return;
        if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal membaca daftar tag."));
        const data = (isi?.data ?? isi) as KatalogTag & { available?: boolean; message?: string };
        if (!data?.available) {
          setGalatTag(String(data?.message || "ALETA Bot belum dapat dihubungi."));
          return;
        }
        setKatalogTag({
          jumlah: data.jumlah ?? {},
          lingkup: data.lingkup ?? null,
          tag: data.tag ?? [],
          kelompok: data.kelompok ?? [],
          dasar: data.dasar ?? [],
          batasId: data.batasId ?? null,
        });
      } catch (kesalahan) {
        if (dibatalkan) return;
        // Pembatalan BUKAN kegagalan. Menampilkannya sebagai galat membuat
        // layar berkedip merah tiap kali penggunanya mengganti pilihan.
        if (kesalahan instanceof DOMException && kesalahan.name === "AbortError") return;
        setGalatTag(
          kesalahan instanceof Error ? kesalahan.message : "Gagal membaca daftar tag."
        );
      } finally {
        if (!dibatalkan) setMemuatTag(false);
      }
    })();

    return () => {
      dibatalkan = true;
      pembatal.abort();
    };
  }, [tagTampil, dasarTag, periodeTag, dariTag, sampaiTag, acuanTag]);

  /**
   * Mengecilkan satu panel. Bila fokus papan ketik berada di dalamnya, fokus
   * dipindahkan ke "Buka lagi" (lihat BilahPanelKecil) - bukan jatuh ke body.
   */
  const kecilkanPanel = useCallback((panel: "tag" | "saringan") => {
    const wadah = panel === "tag" ? panelTag.current : panelSaringan.current;
    const fokus = typeof document === "undefined" ? null : document.activeElement;
    if (wadah && fokus && wadah.contains(fokus)) setFokusRingkas(panel);
    if (panel === "tag") setKeadaanTag((k) => (k === "terbuka" ? "kecil" : k));
    else setKeadaanSaringan((k) => (k === "terbuka" ? "kecil" : k));
  }, []);

  /**
   * Jawaban datang dan panel ini layak mengecil: seketika, atau DITUNDA bila
   * penunjuk tetikus sedang di atasnya - lihat penunjukDi.
   */
  const kecilkanAtauTunda = useCallback(
    (panel: "tag" | "saringan", putaran: number) => {
      if (penunjukDi.current[panel]) {
        const sentuh = panel === "tag" ? sentuhTag.current : sentuhSaringan.current;
        tundaKecil.current[panel] = { sentuh, putaran };
        return;
      }
      kecilkanPanel(panel);
    },
    [kecilkanPanel]
  );

  /** Penunjuk keluar dari panel: pengecilan yang ditunda dijalankan - bila masih berlaku. */
  const keluarDariPanel = useCallback(
    (panel: "tag" | "saringan") => {
      penunjukDi.current[panel] = false;
      const tunda = tundaKecil.current[panel];
      tundaKecil.current[panel] = null;
      if (!tunda) return;
      const sentuh = panel === "tag" ? sentuhTag.current : sentuhSaringan.current;
      // Disentuh lagi sesudah jawaban datang, atau pencarian lain sudah
      // dimulai: penggunanya masih bekerja di panel - pengecilannya batal.
      if (tunda.sentuh !== sentuh || tunda.putaran !== putaranCari.current) return;
      kecilkanPanel(panel);
    },
    [kecilkanPanel]
  );
  const keluarPanelTag = useCallback(() => keluarDariPanel("tag"), [keluarDariPanel]);
  const keluarPanelSaringan = useCallback(() => keluarDariPanel("saringan"), [keluarDariPanel]);

  const jalankanCari = useCallback(async (tagTimpa?: string[]) => {
    const kata = cari.trim();

    // Pencarian berjalan bila ADA salah satu isian. Menuntut kata cari membuat
    // "cerai gugat 2025 yang belum putus" mustahil ditanyakan - padahal itu
    // justru pertanyaan yang sering datang dari pimpinan.
    const kueri = new URLSearchParams();
    if (kata) kueri.set("cari", kata);
    if (saringan.jenisPerkara.trim()) kueri.set("jenisPerkara", saringan.jenisPerkara.trim());
    if (saringan.status) kueri.set("status", saringan.status);
    if (saringan.tahun.trim()) kueri.set("tahun", saringan.tahun.trim());
    if (saringan.sejak.trim()) kueri.set("sejak", saringan.sejak.trim());
    if (saringan.sampai.trim()) kueri.set("sampai", saringan.sampai.trim());
    if (saringan.alurPerkaraId > 0) kueri.set("alurPerkaraId", String(saringan.alurPerkaraId));
    if (saringan.namaPihak.trim()) kueri.set("namaPihak", saringan.namaPihak.trim());
    if (saringan.petugas.trim()) kueri.set("petugas", saringan.petugas.trim());
    if (saringan.hakim.trim()) kueri.set("hakim", saringan.hakim.trim());
    if (saringan.panitera.trim()) kueri.set("panitera", saringan.panitera.trim());
    if (saringan.jurusita.trim()) kueri.set("jurusita", saringan.jurusita.trim());
    if (saringan.statusPutusan.trim()) kueri.set("statusPutusan", saringan.statusPutusan.trim());
    if (saringan.pertimbangan.trim()) kueri.set("pertimbangan", saringan.pertimbangan.trim());
    if (saringan.amar.trim()) kueri.set("amar", saringan.amar.trim());
    if (saringan.verstek.trim()) kueri.set("verstek", saringan.verstek.trim());
    if (saringan.alamatPihak.trim()) kueri.set("alamatPihak", saringan.alamatPihak.trim());
    if (saringan.kua.trim()) kueri.set("kua", saringan.kua.trim());
    if (saringan.relaas.trim()) kueri.set("relaas", saringan.relaas.trim());
    if (saringan.putusSejak.trim()) kueri.set("putusSejak", saringan.putusSejak.trim());
    if (saringan.putusSampai.trim()) kueri.set("putusSampai", saringan.putusSampai.trim());
    if (saringan.umur.trim()) kueri.set("umur", saringan.umur.trim());
    if (saringan.ecourt.trim()) kueri.set("ecourt", saringan.ecourt.trim());

    // Tag dan lingkup waktunya. Keduanya hanya dikirim bila memang dipakai -
    // kalau selalu dikirim, pemeriksaan "tidak ada satu pun syarat" di bawah
    // akan selalu lolos dan menekan Cari dengan layar kosong menarik seluruh
    // register.
    const tagDipilih = (tagTimpa ?? tagPilih).filter(Boolean);
    if (tagDipilih.length > 0) kueri.set("tag", tagDipilih.join(","));
    if (tagDipilih.length > 0 || periodeTag !== PERIODE_BAWAAN) {
      kueri.set("dasarTanggal", dasarTag);
      kueri.set("periode", periodeTag);
      // Tanggal acuan yang SAMA dengan yang dipakai menghitung chipnya. Dulu di
      // sini selalu hari ini: dengan acuan 15-05-2026, chip "Triwulan ini"
      // menghitung triwulan II, tetapi menekannya mencari triwulan III - dua
      // pertanyaan berbeda di balik satu tag, tanpa satu pun tanda.
      kueri.set("acuan", acuanTag || hariIniIso());
      if (periodeButuhTanggal(periodeTag)) {
        if (!dariTag || !sampaiTag) {
          setPesan("Isi kedua tanggal pada saringan tag, atau pilih periode yang lain.");
          return;
        }
        kueri.set("tagDari", dariTag);
        kueri.set("tagSampai", sampaiTag);
      }
    }

    kueri.set("batas", String(BATAS_AWAL));

    // Hanya batas yang terisi berarti tidak ada satu pun syarat.
    if ([...kueri.keys()].length <= 1) {
      // Hasil lama DIBUANG, tidak dibiarkan. Sesudah syarat terakhir dilepas -
      // mis. chip tag terakhir dihapus dari bilah ringkas - daftar yang tersisa
      // bukan lagi jawaban atas pertanyaan apa pun yang tampak di layar.
      putaranCari.current += 1;
      tundaKecil.current = { tag: null, saringan: null };
      setHasilCari([]);
      setSaringanDicari(null);
      setTagDicari(null);
      setAdaLagi(false);
      setLapisHasil("");
      setMemuat(false);
      setMemuatLagi(false);
      setRingkasTag({ jumlah: null, dipotong: [], batasId: null });
      setPesan("Isi sekurangnya satu kotak pencarian atau satu saringan.");
      return;
    }

    const putaran = putaranCari.current + 1;
    putaranCari.current = putaran;
    // Pengecilan yang ditunda milik pencarian sebelumnya - pencarian ini
    // memutuskannya sendiri ketika jawabannya datang.
    tundaKecil.current = { tag: null, saringan: null };
    // Sentuhan yang SUDAH terjadi saat pencarian mulai - termasuk tekanan
    // chip atau Enter yang memulainya. Yang terjadi sesudahnya berarti
    // penggunanya masih bekerja di panel itu.
    const sentuhAwal = { tag: sentuhTag.current, saringan: sentuhSaringan.current };

    // Coba-lagi otomatis mengulang pencarian ini (isian terkini) - butir 14.
    ulangTerakhir.current = async () => jalankanCariRef.current?.(tagTimpa);
    setMemuat(true);
    setMemuatLagi(false);
    setGalat("");
    setPesan("");
    setStatus(null);
    try {
      const jawaban = await fetch(
        apiPath(`/api/aleta-ecourt/status-perkara?${kueri.toString()}`),
        { cache: "no-store" }
      );
      const isi = (await bacaJsonAman(jawaban)) as Record<string, unknown> & { data?: Record<string, unknown> };
      // Jawaban dari putaran yang sudah ditinggalkan DIBUANG, bukan digambar.
      if (putaranCari.current !== putaran) return;
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal mencari perkara."));

      const data = (isi?.data ?? isi) as Record<string, unknown> & {
        perkara?: unknown;
        ruasTakTerbaca?: unknown;
        adaLagi?: unknown;
        lapis?: unknown;
        jumlahTag?: unknown;
        tagDipotong?: unknown;
        batasId?: unknown;
      };
      if (!data?.available) {
        tanganiTakTersedia(String(data?.message || "ALETA Bot belum dapat dihubungi."));
        return;
      }
      laporBerhasilStatus();

      // Tiap baris membawa bagian yang gagal dibaca pada halamannya - selnya
      // lalu tertulis "tak terbaca", bukan nilai "tidak ada" pengisi bot.
      const daftar = tandaiTakTerbaca((data.perkara ?? []) as Ditemukan[], data.ruasTakTerbaca);
      setHasilCari(daftar);
      // adaLagi dari bot. Bot versi lama tidak mengirimnya - maka halaman yang
      // penuh sampai batasnya DIANGGAP mungkin bersambung, dan "Muat lebih
      // banyak" yang tidak mendatangkan baris baru mengatakannya terus terang.
      setAdaLagi(typeof data.adaLagi === "boolean" ? data.adaLagi : daftar.length >= BATAS_AWAL);
      setLapisHasil(typeof data.lapis === "string" ? data.lapis : "");
      const kueriSimpan = new URLSearchParams(kueri);
      kueriSimpan.delete("batas");
      setKueriHasil(kueriSimpan.toString());
      setNomorHasil(putaran);
      setSaringanDicari(saringan);
      setTagDicari({
        tag: tagDipilih,
        dasar: dasarTag,
        periode: periodeTag,
        dari: dariTag,
        sampai: sampaiTag,
        acuan: acuanTag,
      });
      setKriteriaHasil(
        susunKriteria({
          kata,
          saringan,
          tag: tagDipilih,
          katalog: katalogTag,
          dasar: dasarTag,
          periode: periodeTag,
          dari: dariTag,
          sampai: sampaiTag,
          acuan: acuanTag,
        })
      );
      setRingkasTag({
        jumlah: typeof data.jumlahTag === "number" ? data.jumlahTag : null,
        dipotong: Array.isArray(data.tagDipotong) ? (data.tagDipotong as string[]) : [],
        batasId: typeof data.batasId === "number" ? data.batasId : null,
      });

      // Butir 9: panel yang syaratnya sudah dijawab MENGECIL, memberi ruang
      // bagi hasilnya. Hanya bila ada hasil - pencarian yang kosong justru
      // menuntut syaratnya diubah, dan panel yang mengecil saat itu menghalangi.
      // Hanya bila penggunanya tidak menyentuh panel itu lagi sejak pencarian
      // mulai - lihat sentuhTag - dan tidak di bawah penunjuk tetikus yang
      // masih berada di atas panel (lihat penunjukDi): yang itu ditunda.
      if (daftar.length > 0) {
        const tagMenyaring = tagDipilih.length > 0 || periodeTag !== PERIODE_BAWAAN;
        if (tagMenyaring && sentuhTag.current === sentuhAwal.tag && panelTag.current) {
          kecilkanAtauTunda("tag", putaran);
        }
        if (
          ringkasSaringan(saringan).length > 0 &&
          sentuhSaringan.current === sentuhAwal.saringan &&
          panelSaringan.current
        ) {
          kecilkanAtauTunda("saringan", putaran);
        }
      }

      if (daftar.length === 0) {
        setPesan("Tidak ada perkara yang cocok dengan pencarian ini.");
      } else if (daftar.length === 1) {
        // Hanya satu yang cocok: tidak ada yang perlu dipilih.
        await buka(daftar[0].nomorPerkara);
      }
    } catch (kesalahan) {
      if (putaranCari.current !== putaran) return;
      if (!laporGagalStatus(kesalahan)) {
        setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal mencari perkara.");
      }
    } finally {
      if (putaranCari.current === putaran) setMemuat(false);
    }
  }, [cari, saringan, tagPilih, dasarTag, periodeTag, dariTag, sampaiTag, acuanTag, katalogTag, buka, kecilkanAtauTunda, laporGagalStatus, laporBerhasilStatus, tanganiTakTersedia]);
  const jalankanCariRef = useRef<typeof jalankanCari | null>(null);
  useEffect(() => {
    jalankanCariRef.current = jalankanCari;
  }, [jalankanCari]);

  /**
   * Halaman berikutnya dari pencarian yang SAMA.
   *
   * @param semua sekaligus sampai pagu PAGU_MUAT, bukan seratus berikutnya.
   */
  const muatLagi = useCallback(
    async (semua: boolean) => {
      if (!kueriHasil) return;
      const sudah = hasilCari.length;
      const sisaPagu = PAGU_MUAT - sudah;
      if (sisaPagu <= 0) return;

      const kueri = new URLSearchParams(kueriHasil);
      kueri.set("batas", String(semua ? sisaPagu : Math.min(BATAS_TAMBAH, sisaPagu)));
      kueri.set("lewati", String(sudah));

      // Terikat pada putaran pencarian yang sedang tampil: bila pencarian baru
      // dimulai selagi ini berjalan, jawabannya dibuang - menempelkannya akan
      // mencampur dua pertanyaan dalam satu daftar.
      const putaran = putaranCari.current;
      ulangTerakhir.current = async () => muatLagiRef.current?.(semua);
      setMemuatLagi(true);
      setGalat("");
      setPesan("");
      try {
        const jawaban = await fetch(
          apiPath(`/api/aleta-ecourt/status-perkara?${kueri.toString()}`),
          { cache: "no-store" }
        );
        const isi = (await bacaJsonAman(jawaban)) as Record<string, unknown> & { data?: Record<string, unknown> };
        if (putaranCari.current !== putaran) return;
        if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal memuat perkara berikutnya."));

        const data = (isi?.data ?? isi) as Record<string, unknown> & {
          perkara?: unknown;
          ruasTakTerbaca?: unknown;
          adaLagi?: unknown;
        };
        if (!data?.available) {
          tanganiTakTersedia(String(data?.message || "ALETA Bot belum dapat dihubungi."));
          return;
        }
        laporBerhasilStatus();

        // Yang sudah ada tidak digandakan. Bot versi lama tidak mengenal
        // `lewati` dan memulangkan halaman pertama lagi - tanpa penyaring ini
        // daftar yang sama akan tertempel dua kali tanpa satu tanda.
        //
        // Yang gagal dibaca pada halaman INI ditandai pada baris halaman ini
        // saja - halaman sebelumnya yang terbaca utuh tidak ikut ditandai.
        const baru = tandaiTakTerbaca((data.perkara ?? []) as Ditemukan[], data.ruasTakTerbaca);
        const dikenal = new Set(hasilCari.map((x) => x.perkaraId || x.nomorPerkara));
        const tambahan = baru.filter((x) => !dikenal.has(x.perkaraId || x.nomorPerkara));
        setHasilCari([...hasilCari, ...tambahan]);

        if (typeof data.adaLagi === "boolean") {
          setAdaLagi(data.adaLagi);
        } else {
          setAdaLagi(false);
          setPesan(
            tambahan.length === 0
              ? "ALETA Bot versi ini belum dapat memuat halaman berikutnya — tidak ada perkara baru yang datang. Persempit pencarian untuk melihat sisanya."
              : `${tambahan.length} perkara lagi dimuat. ALETA Bot versi ini tidak menyebut apakah masih ada sisanya.`
          );
        }
      } catch (kesalahan) {
        if (putaranCari.current !== putaran) return;
        if (!laporGagalStatus(kesalahan)) {
          setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal memuat perkara berikutnya.");
        }
      } finally {
        if (putaranCari.current === putaran) setMemuatLagi(false);
      }
    },
    [kueriHasil, hasilCari, laporGagalStatus, laporBerhasilStatus, tanganiTakTersedia]
  );
  const muatLagiRef = useRef<typeof muatLagi | null>(null);
  useEffect(() => {
    muatLagiRef.current = muatLagi;
  }, [muatLagi]);

  const salinNomor = useCallback(async (baris: Ditemukan[]) => {
    // Nomor disalin dalam urutan dan saringan yang SEDANG TAMPIL - yang
    // disalin harus sama dengan yang dibaca.
    const teks = baris.map((x) => x.nomorPerkara).join("\n");
    if (!teks) return;
    try {
      await navigator.clipboard.writeText(teks);
      setTandaSalin(`Disalin (${baris.length})`);
    } catch {
      // Papan salin ditolak peramban - lazim pada sambungan bukan HTTPS.
      // Disebutkan apa adanya; diam berarti penggunanya menempel yang lama.
      setPesan("Peramban menolak menyalin. Sorot daftarnya lalu salin sendiri.");
    }
  }, []);

  /** Menyalakan atau melepas satu tag - dari panel. */
  const pilihTag = (kunci: string) => {
    // Sekali tekan, nomornya keluar - tanpa tombol kedua.
    const berikut = tagPilih.includes(kunci)
      ? tagPilih.filter((x) => x !== kunci)
      : [...tagPilih, kunci];
    setTagPilih(berikut);
    void jalankanCari(berikut);
  };

  /**
   * Melepas satu tag dari BILAH RINGKAS. Chip bilah digambar dari tag yang
   * dicari (tagDicari), jadi tombolnya selalu MELEPAS - tidak pernah
   * menyalakan tag yang kebetulan sudah dilepas di panel tanpa dicari.
   */
  const lepasTag = (kunci: string) => {
    const berikut = tagPilih.filter((x) => x !== kunci);
    setTagPilih(berikut);
    void jalankanCari(berikut);
  };

  // Tiap sentuhan di dalam panel menggeser penghitungnya - lihat sentuhTag.
  // Roda tetikus ikut dihitung dan penunjuk di atas panel dicatat - lihat
  // penunjukDi. Jari tidak "berada di atas" apa pun: hanya tetikus dan pena
  // yang dicatat.
  const sentuhPanelTag = {
    onPointerDownCapture: () => {
      sentuhTag.current += 1;
    },
    onKeyDownCapture: () => {
      sentuhTag.current += 1;
    },
    onChangeCapture: () => {
      sentuhTag.current += 1;
    },
    onWheelCapture: () => {
      sentuhTag.current += 1;
    },
    onPointerEnter: (peristiwa: React.PointerEvent) => {
      if (peristiwa.pointerType !== "touch") penunjukDi.current.tag = true;
    },
    onPointerLeave: keluarPanelTag,
  };
  const sentuhPanelSaringan = {
    onPointerDownCapture: () => {
      sentuhSaringan.current += 1;
    },
    onKeyDownCapture: () => {
      sentuhSaringan.current += 1;
    },
    onChangeCapture: () => {
      sentuhSaringan.current += 1;
    },
    onWheelCapture: () => {
      sentuhSaringan.current += 1;
    },
    onPointerEnter: (peristiwa: React.PointerEvent) => {
      if (peristiwa.pointerType !== "touch") penunjukDi.current.saringan = true;
    },
    onPointerLeave: keluarPanelSaringan,
  };

  const tagBerlaku = tagPilih.length > 0 || periodeTag !== PERIODE_BAWAAN;

  // Bilah ringkas: yang MENGHASILKAN daftar (yang dicari), dan apakah isian
  // panel sudah berubah sejak itu. Sebelum ada pencarian, isian panel sendiri
  // yang disebut - dan selalu "belum dicari".
  const lingkupTagSekarang: LingkupTag = {
    tag: tagPilih,
    dasar: dasarTag,
    periode: periodeTag,
    dari: dariTag,
    sampai: sampaiTag,
    acuan: acuanTag,
  };
  const tagBilah = tagDicari ?? lingkupTagSekarang;
  const tagBelumDicari = tagDicari ? !samaLingkupTag(tagDicari, lingkupTagSekarang) : tagBerlaku;
  const saringanBilah = saringanDicari ? ringkasSaringan(saringanDicari) : saringanAktif;
  const saringanBelumDicari = saringanDicari ? !samaSaringan(saringanDicari, saringan) : saringanAktif.length > 0;
  // Panel yang disembunyikan tetap meninggalkan bilah bila isiannya ADA atau
  // daftar yang tampil dihasilkan dengan isian - mengosongkan isian tanpa
  // mencari tidak boleh menyembunyikan mengapa daftarnya seperti itu.
  const saringanPerluBilah = saringanAktif.length > 0 || saringanBilah.length > 0;
  const tagPerluBilah = tagBerlaku || tagBilah.tag.length > 0 || tagBilah.periode !== PERIODE_BAWAAN;


  return (
    <Card>
      {/* ==================================================================
          KEPALA DIRAPATKAN
          ==================================================================

          Judul halaman di atas kartu ini sudah menyebutkan ALETA e-Court
          beserta keterangannya. Kepala setinggi bawaan mengulang ruang itu
          sekali lagi, dan keterangan tiga baris di sini mendorong kotak
          pencarian - satu-satunya hal yang dipakai orang di layar ini -
          hampir keluar dari lipatan layar.

          Keterangannya TIDAK dipotong, hanya dikecilkan: yang baru pertama
          membuka layar ini tetap perlu tahu bahwa nomornya boleh diketik
          angkanya saja, dan sejauh mana isinya. */}
      <CardHeader className="gap-1 p-4 pb-2 sm:p-5 sm:pb-2">
        <CardTitle className="text-base sm:text-lg">Status Perkara</CardTitle>
        <CardDescription className="text-sm">
          Masukkan nomor perkara — cukup angkanya saja, atau cari dengan nama pihak dan jenis
          perkara lewat Saringan lain. Seluruh keadaan perkara ditampilkan: sejak didaftarkan,
          siapa yang menanganinya, sudah sampai mana, sampai produk pengadilannya.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
        <div className="flex flex-wrap items-end gap-2">
          {/* Selebar baris di ponsel, 18rem mulai sm. "w-72 max-w-full" saja
              TIDAK cukup: lebar tetap 288 px ikut dihitung sebagai lebar
              minimum kartu, dan pada 320 px halaman bergulir mendatar 8 px
              (terukur pada replika). Lebar persen pada kotak isian tidak
              dihitung ke lebar minimum itu. */}
          <label className="flex w-full min-w-0 flex-col gap-0.5 text-[11px] font-medium sm:w-auto">
            Nomor perkara
            <Input
              placeholder="419, nama pihak, kuasa, NIK, akta cerai…"
              aria-describedby="keterangan-cari-status-perkara"
              value={cari}
              onChange={(peristiwa) => setCari(peristiwa.target.value)}
              onKeyDown={(peristiwa) => {
                if (peristiwa.key === "Enter") void jalankanCari();
              }}
              className="w-full max-w-full sm:w-72"
            />
          </label>
          <Button size="sm" disabled={memuat} onClick={() => void jalankanCari()}>
            {memuat ? "Mencari…" : "Cari"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            aria-expanded={saringanTampil}
            onClick={() =>
              setKeadaanSaringan((k) =>
                k === "terbuka" ? (saringanPerluBilah ? "kecil" : "tertutup") : "terbuka"
              )
            }
          >
            {saringanTampil ? "Sembunyikan saringan" : "Saringan lain"}
            {saringanAktif.length > 0 ? ` (${saringanAktif.length})` : ""}
          </Button>
          {/* Tag: pertanyaan yang sudah disusun, lengkap dengan jumlahnya.
              Bedanya dengan Saringan lain - saringan menuntut orang tahu APA
              yang harus diketik; tag menyebutkan pertanyaannya sendiri. */}
          <Button
            size="sm"
            variant={tagPilih.length > 0 ? "default" : "outline"}
            aria-expanded={tagTerbuka}
            onClick={() =>
              setKeadaanTag((k) => (k === "terbuka" ? (tagPerluBilah ? "kecil" : "tertutup") : "terbuka"))
            }
          >
            {tagTerbuka ? "Sembunyikan tag" : "Tag & rentang waktu"}
            {tagPilih.length > 0 ? ` (${tagPilih.length})` : ""}
          </Button>
          {saringanTampil ? (
            <Button size="sm" variant="ghost" onClick={() => setSaringan(SARINGAN_KOSONG)}>
              Kosongkan
            </Button>
          ) : null}
        </div>

        {/* Butir 8: APA SAJA yang dijangkau kata bebas, dikatakan di tempat
            orang mengetik. Tanpa kalimat ini tidak ada yang akan mencoba
            mengetik nomor akta cerai atau nama kuasa ke kotak "Nomor perkara". */}
        {/* Daftarnya mengikuti cabang kata bebas di bot (cariPerkaraHalaman di
            sippStatusPerkaraService.js: nomor urut tepat, angka panjang,
            bergaris miring, KOSAKATA_CARI/KOSAKATA_PINJAM, lalu SYARAT_CEPAT
            dan SYARAT_DALAM), bukan keinginan layar: yang disebut di sini dan
            tidak dicari bot adalah janji palsu.

            Lapis dalam HANYA berjalan bila lapis cepat tidak menemukan apa
            pun - itu dikatakan, sebab nama hakim yang kebetulan juga nama
            pihak akan menjawab dengan perkara pihaknya. */}
        <div className="space-y-0.5 text-[11px] leading-snug text-muted-foreground">
          {/* Ringkas: kalimat ini SELALU tampak, juga di ponsel di atas hasil.
              Rinciannya di bawah, dapat dibuka. */}
          <p id="keterangan-cari-status-perkara">
            Kata bebas mencari nomor perkara, nama pihak, kuasa hukum, NIK/telepon, nomor akta cerai/akta nikah,
            nomor banding/kasasi/PK, dan kata keadaan (verstek, ghaib, retur, e-court) — bila tidak ada yang cocok,
            diperdalam ke alamat, KUA, petugas, agenda sidang, pertimbangan, dan amar.
          </p>
          <details>
            <summary className="w-fit cursor-pointer select-none font-medium text-foreground/80 hover:text-foreground">
              Cara kata bebas dibaca
            </summary>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li>Angka 1–5 digit dicari sebagai nomor urut perkara, persis: “41” tidak memunculkan 410 sampai 419.</li>
              <li>
                Angka yang lebih panjang dicari sebagai NIK atau telepon pihak dan nomor kutipan akta nikah — sebagian
                nomornya pun cukup. Di “cocok karena” NIK dan telepon disamarkan: hanya angka yang Anda ketik yang
                tampak.
              </li>
              <li>
                Nomor bergaris miring dicocokkan lebih dahulu ke nomor perkara. Hanya bila tidak ada satu pun nomor
                perkara yang cocok, barulah dicari di nomor akta cerai, nomor perkara atau putusan banding/kasasi/PK, dan
                nomor akta nikah bentuk lama — jadi “/2019” menampilkan perkara 2019 saja, dan “376/AC/2026” menemukan
                akta cerainya.
              </li>
              <li>
                Kata keadaan dikenali bila diketik utuh: verstek, bukan verstek, banding, kasasi, PK, peninjauan
                kembali, upaya hukum, retur, gagal panggil, surat tercatat, ghaib, belum ada relaas, e-court, lewat 3
                bulan, lewat 5 bulan.
              </li>
              <li>
                Kata lain dicari lebih dahulu di nomor perkara, jenis perkara, nama pihak, dan nama kuasa hukum. Bila
                tidak ada satu pun yang cocok, barulah diperdalam ke alamat pihak, KUA tempat nikah, nama
                hakim/panitera/juru sita, agenda sidang, serta isi pertimbangan dan amar.
              </li>
              <li>Tiap hasil menyebut di mana katanya ditemukan (“cocok karena”).</li>
            </ul>
          </details>
        </div>

        {keadaanTag === "terbuka" ? (
          <div
            ref={panelTag}
            {...sentuhPanelTag}
            className="motion-safe:animate-in motion-safe:fade-in-0 motion-reduce:animate-none"
          >
            <PanelTagPerkara
              katalog={katalogTag}
              memuat={memuatTag}
              galat={galatTag}
              dipilih={tagPilih}
              dasar={dasarTag}
              periode={periodeTag}
              dari={dariTag}
              sampai={sampaiTag}
              onUbahDasar={setDasarTag}
              onUbahPeriode={setPeriodeTag}
              onUbahDari={setDariTag}
              onUbahSampai={setSampaiTag}
              acuan={acuanTag}
              onUbahAcuan={setAcuanTag}
              cari={cariTag}
              onUbahCari={setCariTag}
              onPilih={pilihTag}
              onKosongkan={() => {
                setTagPilih([]);
                setRingkasTag({ jumlah: null, dipotong: [], batasId: null });
              }}
              onJalankan={() => void jalankanCari()}
              sedangMencari={memuat}
            />
          </div>
        ) : keadaanTag === "kecil" ? (
          <BilahPanelKecil
            judul="Tag & rentang waktu"
            fokusAwal={fokusRingkas === "tag"}
            onBukaLagi={() => {
              setFokusRingkas(null);
              setKeadaanTag("terbuka");
            }}
            onTutup={() => {
              setFokusRingkas(null);
              setKeadaanTag("tertutup");
            }}
          >
            {/* Yang tertulis di sini yang MENGHASILKAN daftar di bawah
                (tagBilah = yang dicari), bukan isian panel saat ini. */}
            {tagBilah.tag.length === 0 ? (
              <span className="text-xs text-muted-foreground">Tidak ada tag yang menyala.</span>
            ) : (
              tagBilah.tag.map((kunci) => {
                const tag = katalogTag?.tag.find((x) => x.kunci === kunci);
                const nama = labelTag(katalogTag, kunci);
                return (
                  <span
                    key={kunci}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
                      kelasNada(tag?.nada ?? "netral", true)
                    )}
                  >
                    {nama}
                    <button
                      type="button"
                      aria-label={`Lepas tag ${nama}`}
                      disabled={memuat}
                      onClick={() => lepasTag(kunci)}
                      className="rounded-full p-0.5 hover:bg-foreground/10 disabled:opacity-50"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </span>
                );
              })
            )}
            {tagBilah.tag.length > 1 ? <span className="text-xs text-muted-foreground">digabung DAN</span> : null}
            <span className="text-xs text-muted-foreground">
              ·{" "}
              {kalimatRentang(
                katalogTag,
                tagBilah.dasar,
                tagBilah.periode,
                tagBilah.dari,
                tagBilah.sampai,
                tagBilah.acuan
              )}
            </span>
            {tagBelumDicari ? (
              <span data-bagian="belum-dicari" className="w-full text-xs text-amber-700 dark:text-amber-300">
                {memuat
                  ? "Sedang mencari dengan pilihan terbaru…"
                  : `Pilihan di panel sudah diubah dan belum dicari (${
                      lingkupTagSekarang.tag.length > 0
                        ? `${lingkupTagSekarang.tag.map((k) => labelTag(katalogTag, k)).join(" DAN ")}, `
                        : ""
                    }${kalimatRentang(
                      katalogTag,
                      dasarTag,
                      periodeTag,
                      dariTag,
                      sampaiTag,
                      acuanTag
                    )}) — tekan Cari untuk memakainya.`}
              </span>
            ) : null}
          </BilahPanelKecil>
        ) : null}

        {/* ==================================================================
            SARINGAN LAIN
            ==================================================================

            Disembunyikan sampai diminta. Yang datang ke layar ini sembilan dari
            sepuluh kali hanya membawa nomor perkara; menghadapkan mereka pada
            tujuh kotak sekaligus memperlambat pekerjaan yang paling sering.

            Seluruh saringan boleh dipakai TANPA nomor perkara - itulah cara
            menjawab "cerai gugat 2025 yang belum putus ada berapa". */}
        {saringanTampil ? (
          <div
            ref={panelSaringan}
            {...sentuhPanelSaringan}
            className="grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2 xl:grid-cols-4 motion-safe:animate-in motion-safe:fade-in-0 motion-reduce:animate-none"
          >
            <label className="flex flex-col gap-1 text-sm font-medium">
              Nama pihak
              <Input
                placeholder="nama penggugat, tergugat, pemohon…"
                value={saringan.namaPihak}
                onChange={(e) => setSaringan((x) => ({ ...x, namaPihak: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void jalankanCari();
                }}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Jenis perkara
              <Input
                placeholder="Cerai Gugat, Isbat Nikah…"
                value={saringan.jenisPerkara}
                onChange={(e) => setSaringan((x) => ({ ...x, jenisPerkara: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void jalankanCari();
                }}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Keadaan perkara
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={saringan.status}
                onChange={(e) => setSaringan((x) => ({ ...x, status: e.target.value }))}
              >
                <option value="">Semua keadaan</option>
                {PILIHAN_STATUS.map((pilihan) => (
                  <option key={pilihan.kunci} value={pilihan.kunci}>
                    {pilihan.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Alur perkara
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={String(saringan.alurPerkaraId || "")}
                onChange={(e) =>
                  setSaringan((x) => ({ ...x, alurPerkaraId: Number(e.target.value) || 0 }))
                }
              >
                <option value="">Semua alur</option>
                {PILIHAN_ALUR.map((pilihan) => (
                  <option key={pilihan.id} value={String(pilihan.id)}>
                    {pilihan.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Tahun pendaftaran
              <Input
                placeholder="2025"
                inputMode="numeric"
                value={saringan.tahun}
                onChange={(e) => setSaringan((x) => ({ ...x, tahun: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void jalankanCari();
                }}
              />
            </label>

            {/* Rentang tanggal PENDAFTARAN - bot sudah lama menerimanya,
                layar ini yang belum pernah menyediakan kotaknya. */}
            <label className="flex flex-col gap-1 text-sm font-medium">
              Didaftarkan sejak
              <Input
                type="date"
                value={saringan.sejak}
                onChange={(e) => setSaringan((x) => ({ ...x, sejak: e.target.value }))}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Didaftarkan sampai
              <Input
                type="date"
                value={saringan.sampai}
                onChange={(e) => setSaringan((x) => ({ ...x, sampai: e.target.value }))}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
              Petugas (hakim, panitera, atau juru sita)
              <Input
                placeholder="nama petugas"
                value={saringan.petugas}
                onChange={(e) => setSaringan((x) => ({ ...x, petugas: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void jalankanCari();
                }}
              />
            </label>

            {/* ================================================================
                PENCARIAN MENDALAM
                ================================================================

                Dipisahkan garis dan judulnya sendiri, bukan disambung ke
                grid di atas. Enam belas kotak sederajat tanpa pengelompokan
                membuat yang paling sering dipakai - nama pihak, jenis
                perkara - tenggelam di antara yang paling jarang.

                "Ba'da dukhul" dan "qabla dukhul" TIDAK punya kolom sendiri
                di SIPP, dan tidak satu pun muncul di amar putusan. Keduanya
                tertulis di dalam pertimbangan hukum - karena itu dicari
                lewat isian isi pertimbangan, bukan lewat saklar tersendiri
                yang hasilnya selalu kosong. */}
            <div className="sm:col-span-2 xl:col-span-4">
              <p className="border-t pt-3 text-sm font-semibold text-muted-foreground">
                Pencarian mendalam
              </p>
            </div>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Hakim
              <Input
                placeholder="nama hakim"
                value={saringan.hakim}
                onChange={(e) => setSaringan((x) => ({ ...x, hakim: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void jalankanCari();
                }}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Panitera Pengganti
              <Input
                placeholder="nama panitera pengganti"
                value={saringan.panitera}
                onChange={(e) => setSaringan((x) => ({ ...x, panitera: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void jalankanCari();
                }}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Juru Sita
              <Input
                placeholder="nama juru sita"
                value={saringan.jurusita}
                onChange={(e) => setSaringan((x) => ({ ...x, jurusita: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void jalankanCari();
                }}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Alamat pihak
              <Input
                placeholder="desa, kecamatan…"
                value={saringan.alamatPihak}
                onChange={(e) => setSaringan((x) => ({ ...x, alamatPihak: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void jalankanCari();
                }}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              KUA tempat nikah
              <Input
                placeholder="KUA Banawa…"
                value={saringan.kua}
                onChange={(e) => setSaringan((x) => ({ ...x, kua: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void jalankanCari();
                }}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Isi pertimbangan hukum
              <Input
                placeholder="ba'da dukhul, nusyuz…"
                value={saringan.pertimbangan}
                onChange={(e) => setSaringan((x) => ({ ...x, pertimbangan: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void jalankanCari();
                }}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Isi amar putusan
              <Input
                placeholder="kata dalam amar…"
                value={saringan.amar}
                onChange={(e) => setSaringan((x) => ({ ...x, amar: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void jalankanCari();
                }}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Jenis putusan
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={saringan.statusPutusan}
                onChange={(e) => setSaringan((x) => ({ ...x, statusPutusan: e.target.value }))}
              >
                <option value="">Semua jenis putusan</option>
                {PILIHAN_PUTUSAN.map((nama) => (
                  <option key={nama} value={nama}>
                    {nama}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Verstek
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={saringan.verstek}
                onChange={(e) => setSaringan((x) => ({ ...x, verstek: e.target.value }))}
              >
                <option value="">Verstek maupun bukan</option>
                <option value="ya">Putusan verstek</option>
                <option value="tidak">Bukan verstek</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Keadaan relaas
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={saringan.relaas}
                onChange={(e) => setSaringan((x) => ({ ...x, relaas: e.target.value }))}
              >
                <option value="">Semua keadaan relaas</option>
                {PILIHAN_RELAAS.map((pilihan) => (
                  <option key={pilihan.kunci} value={pilihan.kunci}>
                    {pilihan.label}
                  </option>
                ))}
              </select>
            </label>

            {/* Rentang tanggal PUTUSAN - terpisah dari rentang pendaftaran.
                "Perkara yang diputus bulan ini" ditanyakan tiap awal bulan
                untuk laporan, dan sebelumnya tidak dapat ditanyakan sama
                sekali. */}
            <label className="flex flex-col gap-1 text-sm font-medium">
              Putus sejak
              <Input
                type="date"
                value={saringan.putusSejak}
                onChange={(e) => setSaringan((x) => ({ ...x, putusSejak: e.target.value }))}
              />
            </label>

            {/* Umur perkara - pertanyaan pengawasan yang paling sering, dan
                sebelumnya tidak dapat ditanyakan sama sekali. */}
            <label className="flex flex-col gap-1 text-sm font-medium">
              Umur perkara
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={saringan.umur}
                onChange={(e) => setSaringan((x) => ({ ...x, umur: e.target.value }))}
              >
                <option value="">Semua umur</option>
                {PILIHAN_UMUR.map((pilihan) => (
                  <option key={pilihan.kunci} value={pilihan.kunci}>
                    {pilihan.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Cara pendaftaran
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={saringan.ecourt}
                onChange={(e) => setSaringan((x) => ({ ...x, ecourt: e.target.value }))}
              >
                <option value="">e-Court maupun meja</option>
                <option value="ya">Lewat e-Court</option>
                <option value="tidak">Didaftarkan di meja</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Putus sampai
              <Input
                type="date"
                value={saringan.putusSampai}
                onChange={(e) => setSaringan((x) => ({ ...x, putusSampai: e.target.value }))}
              />
            </label>
          </div>
        ) : keadaanSaringan === "kecil" ? (
          <BilahPanelKecil
            judul="Saringan lain"
            fokusAwal={fokusRingkas === "saringan"}
            onBukaLagi={() => {
              setFokusRingkas(null);
              setKeadaanSaringan("terbuka");
            }}
            onTutup={() => {
              setFokusRingkas(null);
              setKeadaanSaringan("tertutup");
            }}
          >
            {/* Saringan yang MENGHASILKAN daftar di bawah (saringanBilah =
                yang dicari), bukan isian panel saat ini. */}
            {saringanBilah.length === 0 ? (
              <span className="text-xs text-muted-foreground">Tidak ada saringan yang aktif.</span>
            ) : (
              <>
                <span className="text-xs font-medium">{saringanBilah.length} saringan aktif</span>
                {saringanBilah.map((x) => (
                  <span key={x.kunci} className="max-w-full break-words rounded-full border bg-card px-2 py-0.5 text-xs">
                    {x.label}: {x.nilai}
                  </span>
                ))}
              </>
            )}
            {saringanBelumDicari ? (
              <span data-bagian="belum-dicari" className="w-full text-xs text-amber-700 dark:text-amber-300">
                {memuat
                  ? "Sedang mencari dengan isian terbaru…"
                  : saringanAktif.length > 0
                    ? `Isian di panel sudah diubah dan belum dicari (${saringanAktif
                        .map((x) => `${x.label}: ${x.nilai}`)
                        .join("; ")}) — tekan Cari untuk memakainya.`
                    : "Isian di panel sudah dikosongkan dan belum dicari — tekan Cari untuk memakainya."}
              </span>
            ) : null}
          </BilahPanelKecil>
        ) : null}

        <BannerGangguan keadaan={cobaLagiStatus.keadaan} onCobaSekarang={cobaLagiStatus.cobaSekarang} />
        {galat ? (
          <p className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
            <span className="min-w-0 flex-1">{galat}</span>
            <TombolTutupPesan onTutup={() => setGalat("")} />
          </p>
        ) : null}
        {/* Keterangan / penolakan menetap sampai keadaannya berubah. Kabar
            BERHASIL tidak lagi tampil di sini - butir 26, 6 Okt 2026: ia
            pindah ke tulisan tombol salinnya (tandaSalin). */}
        {pesan ? <p className="text-sm text-muted-foreground">{pesan}</p> : null}

        {/* Batas baris TIDAK boleh memotong dalam diam.

            Pencarian dipagari 100 baris. Tanpa angka sesungguhnya, tag "ghaib"
            terbaca 100 perkara padahal 67 - atau terbaca 100 padahal 4.113,
            dan yang membacanya menyimpulkan pekerjaannya tinggal seratus. */}
        {!status && ringkasTag.jumlah !== null && ringkasTag.jumlah > hasilCari.length ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            {ringkasTag.jumlah.toLocaleString("id-ID")} perkara cocok dengan tag ini; yang
            ditampilkan {hasilCari.length.toLocaleString("id-ID")} teratas.{" "}
            {/* Pada pagu, tombol "Muat lebih banyak" sudah tidak ada - kalimat
                yang tetap menyuruh menekannya menunjuk tombol yang hilang. */}
            {hasilCari.length < PAGU_MUAT
              ? `Muat lebih banyak di bawah daftar (sampai ${PAGU_MUAT.toLocaleString("id-ID")}), atau persempit dengan rentang waktu atau tag lain.`
              : `Pagu ${PAGU_MUAT.toLocaleString("id-ID")} perkara sudah termuat — persempit dengan rentang waktu atau tag lain untuk melihat sisanya.`}
          </p>
        ) : null}
        {!status && ringkasTag.dipotong.length > 0 ? (
          <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-800 dark:text-rose-200">
            {/* Pagunya DIKIRIM bot, tidak ditulis di sini. Angka yang ditulis
                keras di layar akan berbohong pada hari pagunya diubah - dan itu
                sudah terjadi: peringatan ini pernah menyebut 3.000 sesudah
                pagunya dinaikkan menjadi 20.000. */}
            Tag {ringkasTag.dipotong.join(", ")} cocok pada lebih dari{" "}
            {(ringkasTag.batasId ?? 0).toLocaleString("id-ID")} perkara. Yang dihitung hanya
            sebanyak itu, yang TERBARU — perkara lama tidak ikut terbawa, dan angka irisan
            beberapa tag menjadi lebih kecil daripada yang sesungguhnya. Pilih rentang waktu
            supaya jawabannya utuh.
          </p>
        ) : null}

        {/* Daftar pilihan hanya muncul bila memang ada lebih dari satu.

            DISEMBUNYIKAN, tidak dilepas, selagi satu perkara dibuka: tombol
            "Kembali" lalu mendarat pada tampilan, urutan, saringan, dan
            kelompok yang terlipat persis seperti ditinggalkan. key berganti
            hanya pada pencarian BARU - "Muat lebih banyak" tidak menyetel
            ulang apa pun. */}
        {hasilCari.length > 1 ? (
          <div hidden={Boolean(status)}>
            <HasilPencarianPerkara
              key={nomorHasil}
              hasil={hasilCari}
              tampilan={tampilanHasil}
              onUbahTampilan={(tampilan) => {
                setTampilanHasil(tampilan);
                simpanTampilan(tampilan);
              }}
              urut={urutHasil}
              onUbahUrut={setUrutHasil}
              onBuka={(nomorPerkara) => void buka(nomorPerkara)}
              adaLagi={adaLagi}
              memuatLagi={memuatLagi}
              onMuatLagi={() => void muatLagi(false)}
              onMuatSemua={() => void muatLagi(true)}
              paguMuat={PAGU_MUAT}
              kriteria={kriteriaHasil}
              namaPengadilan={institutionIdentity.courtName || "PENGADILAN AGAMA"}
              lapis={lapisHasil}
              aksi={(barisTampil) => (
                <Button size="sm" variant="ghost" onClick={() => void salinNomor(barisTampil)}>
                  {tandaSalin || "Salin daftar nomor"}
                </Button>
              )}
            />
          </div>
        ) : null}

        {status ? (
          <IsiStatus status={status} onKembali={() => setStatus(null)} onBuka={(n) => void buka(n)} />
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Katalog tag beserta jumlahnya, sebagaimana dikirim bot. */
type KatalogTag = {
  /**
   * null berarti BELUM DIHITUNG - berbeda dari {} yang berarti sudah dihitung
   * dan hasilnya kosong. Chip yang belum berangka digambar "…" dan TIDAK
   * dimatikan; chip yang sudah dihitung dan bernilai nol dimatikan.
   */
  jumlah: Record<string, number> | null;
  lingkup: { dari: string; sampai: string; perkara: number } | null;
  tag: TagPerkara[];
  kelompok: KelompokTag[];
  dasar: DasarTanggalTag[];
  batasId?: number | null;
};

/**
 * Panel tag perkara.
 *
 * ==========================================================================
 * JUMLAHNYA DITULIS SEBELUM DITEKAN
 * ==========================================================================
 *
 * Tiap tag membawa angkanya sendiri. Itu yang membedakannya dari saringan:
 * "Putus, belum BHT 240" sudah menjawab sebelum ditekan, sedangkan kotak
 * saringan baru menjawab sesudah diisi dengan benar.
 *
 * Tag bernilai nol tetap DITAMPILKAN, hanya diredupkan dan dimatikan. Membuang
 * yang nol membuat daftarnya berubah-ubah tiap rentang waktu diganti, dan
 * petugas kehilangan jejak tag yang kemarin ada.
 *
 * Beberapa tag yang menyala digabung dengan DAN, bukan ATAU: "belum putus DAN
 * ghaib" adalah pertanyaan pengawasan yang nyata; gabungan ATAU hampir tidak
 * pernah ditanyakan.
 */
export function PanelTagPerkara({
  katalog,
  memuat,
  galat,
  dipilih,
  dasar,
  periode,
  dari,
  sampai,
  onUbahDasar,
  onUbahPeriode,
  onUbahDari,
  onUbahSampai,
  acuan,
  onUbahAcuan,
  cari,
  onUbahCari,
  onPilih,
  onKosongkan,
  onJalankan,
  sedangMencari,
}: {
  katalog: KatalogTag | null;
  memuat: boolean;
  galat: string;
  dipilih: string[];
  dasar: string;
  periode: string;
  dari: string;
  sampai: string;
  onUbahDasar: (nilai: string) => void;
  onUbahPeriode: (nilai: string) => void;
  onUbahDari: (nilai: string) => void;
  onUbahSampai: (nilai: string) => void;
  acuan: string;
  onUbahAcuan: (nilai: string) => void;
  cari: string;
  onUbahCari: (nilai: string) => void;
  onPilih: (kunci: string) => void;
  onKosongkan: () => void;
  onJalankan: () => void;
  sedangMencari: boolean;
}) {
  const kelompok = katalog?.kelompok ?? [];
  const jumlah = katalog?.jumlah ?? null;
  const lingkup = katalog?.lingkup ?? null;

  // Kotak saring dicocokkan ke LABEL dan PENJELASAN, bukan ke kuncinya: kunci
  // tag tidak pernah terbaca pengguna, sedangkan penjelasannya memuat kata
  // yang dicari orang ("BHT", "ikrar", "panjar") yang belum tentu ada di label.
  const kataCari = cari.trim().toLowerCase();
  const tag = (katalog?.tag ?? []).filter(
    (x) =>
      kataCari === "" ||
      x.label.toLowerCase().includes(kataCari) ||
      x.judul.toLowerCase().includes(kataCari)
  );
  const semuaTag = katalog?.tag.length ?? 0;

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5 text-[11px] font-medium">
          Tanggal yang dihitung
          <select
            value={dasar}
            onChange={(e) => onUbahDasar(e.target.value)}
            className="h-9 rounded-md border bg-card px-2 text-sm"
          >
            {(katalog?.dasar ?? [{ kunci: DASAR_BAWAAN, label: "Didaftarkan" }]).map((x) => (
              <option key={x.kunci} value={x.kunci}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-[11px] font-medium">
          Rentang waktu
          <select
            value={periode}
            onChange={(e) => onUbahPeriode(e.target.value)}
            className="h-9 rounded-md border bg-card px-2 text-sm"
          >
            {PERIODE_TAG.map((x) => (
              <option key={x.nilai} value={x.nilai}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        {periodeButuhTanggal(periode) ? (
          <>
            <label className="flex flex-col gap-0.5 text-[11px] font-medium">
              Dari
              <Input
                type="date"
                value={dari}
                onChange={(e) => onUbahDari(e.target.value)}
                className="w-40"
              />
            </label>
            <label className="flex flex-col gap-0.5 text-[11px] font-medium">
              Sampai
              <Input
                type="date"
                value={sampai}
                onChange={(e) => onUbahSampai(e.target.value)}
                className="w-40"
              />
            </label>
          </>
        ) : null}
        {/* Tanggal acuan: yang menentukan arti "triwulan ini", "bulan ini", dan
            "tahun ini". Kosong berarti hari ini.

            Tanpa kotak ini, "triwulan" hanya pernah berarti triwulan yang
            sedang BERJALAN - sedangkan laporan triwulanan yang sesungguhnya
            selalu tentang triwulan yang sudah lewat, dan satu-satunya jalan ke
            sana adalah mengetik dua tanggal sendiri. */}
        {periode !== "total" && !periodeButuhTanggal(periode) ? (
          <label className="flex flex-col gap-0.5 text-[11px] font-medium">
            Tanggal acuan
            <Input
              type="date"
              value={acuan}
              onChange={(e) => onUbahAcuan(e.target.value)}
              className="w-40"
              title="Kosong berarti hari ini. Isi tanggal di dalam triwulan, bulan, atau tahun yang ingin dilihat."
            />
          </label>
        ) : null}
        {/* Rentang waktu BOLEH berdiri sendiri tanpa satu tag pun - pengguna
            menyebutnya sebagai permintaan tersendiri ("dan juga tanggalnya hari
            ini atau antara tanggal atau ..."). Jalurnya pun cepat: terukur lewat
            cariPerkara sungguhan, dasar putus + triwulan 148 ms, dasar daftar +
            bulan 9 ms, dasar BHT + tahun 14 ms. */}
        {/* Kotak saring: 88 tag dalam 12 kelompok terlalu banyak untuk
            dipindai dengan mata, dan mengetik tiga huruf lebih cepat. */}
        <label className="flex flex-col gap-0.5 text-[11px] font-medium">
          Saring nama tag
          <Input
            placeholder="mis. BHT, ikrar, panjar"
            value={cari}
            onChange={(e) => onUbahCari(e.target.value)}
            className="w-44"
          />
        </label>
        <Button
          size="sm"
          disabled={sedangMencari || (dipilih.length === 0 && periode === "total")}
          onClick={onJalankan}
        >
          Tampilkan hasil
        </Button>
        {dipilih.length > 0 ? (
          <Button size="sm" variant="ghost" onClick={onKosongkan}>
            Lepas semua tag
          </Button>
        ) : null}
      </div>

      {/* Lingkup yang sedang dihitung ditulis apa adanya. Tanpa ini, "Triwulan
          ini" adalah janji yang tidak dapat diperiksa siapa pun. */}
      <p className="text-xs text-muted-foreground">
        {memuat ? (
          "Menghitung tag…"
        ) : lingkup ? (
          <>
            Dihitung atas{" "}
            {lingkup.dari && lingkup.sampai
              ? `${tanggalDMY(lingkup.dari, lingkup.dari)} s.d. ${tanggalDMY(lingkup.sampai, lingkup.sampai)}`
              : "seluruh register"}{" "}
            — {Number(lingkup.perkara || 0).toLocaleString("id-ID")} perkara.
            {dipilih.length > 1 ? " Beberapa tag digabung dengan DAN." : ""}
          </>
        ) : (
          "Belum ada angka."
        )}
      </p>

      {galat ? <p className="text-sm text-rose-600 dark:text-rose-300">{galat}</p> : null}

      {kataCari !== "" ? (
        <p className="text-xs text-muted-foreground">
          {tag.length} dari {semuaTag} tag cocok dengan &quot;{cari.trim()}&quot;. Tag yang
          sedang menyala tetap berlaku walau tidak tampil di sini.
        </p>
      ) : null}

      {kelompok.map((satu) => {
        const anggota = tag.filter((x) => x.kelompok === satu.kunci);
        if (anggota.length === 0) return null;
        return (
          <div key={satu.kunci} className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {satu.label}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {anggota.map((x) => {
                // BELUM DIHITUNG dibedakan dari NOL. Yang belum dihitung tetap
                // dapat ditekan - pencariannya tidak menunggu angkanya - dan
                // digambar "…"; yang sudah dihitung dan nol dimatikan.
                const belumDihitung = jumlah === null;
                const n = belumDihitung ? null : Number(jumlah[x.kunci] ?? 0);
                const hidup = dipilih.includes(x.kunci);
                const kosong = n === 0 && !hidup;
                return (
                  <button
                    key={x.kunci}
                    type="button"
                    title={
                      belumDihitung
                        ? `${x.judul} (jumlahnya sedang dihitung)`
                        : `${x.judul} (${Number(n).toLocaleString("id-ID")} perkara)`
                    }
                    disabled={kosong}
                    onClick={() => onPilih(x.kunci)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition",
                      kosong
                        ? "cursor-not-allowed border-border/60 text-muted-foreground/50"
                        : kelasNada(x.nada, hidup)
                    )}
                  >
                    {x.label}{" "}
                    <span className="font-semibold tabular-nums">
                      {belumDihitung ? "…" : Number(n).toLocaleString("id-ID")}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function IsiStatus({
  status,
  onKembali,
  onBuka,
}: {
  status: Status;
  onKembali: () => void;
  /** Membuka perkara lain - dipakai riwayat dan sematan pada bilah alat. */
  onBuka: (nomorPerkara: string) => void;
}) {
  /**
   * ==========================================================================
   * BOLEH TIDAKNYA MEMBUKA BEBAN KINERJA KONSEPTOR
   * ==========================================================================
   *
   * Ditanyakan kepada SUMBER YANG SAMA dengan yang menyusun menu samping -
   * `accessibleModules` - bukan dengan menyalin daftar perannya ke sini.
   * Daftar peran yang disalin akan menyimpang diam-diam begitu satker
   * mengubah Akses Menu, dan yang menyimpang justru tautan yang berujung
   * penolakan.
   *
   * Layar itu menyebut nama orang beserta peringkatnya, jadi ia memang tidak
   * untuk semua peran. Tautan yang muncul bagi yang tidak berhak lebih buruk
   * daripada tidak ada tautan: ia menyalahkan orangnya atas pintu yang memang
   * bukan untuk dia.
   */
  const { accessibleModules } = usePortal();
  const bolehBebanKonseptor = useMemo(
    () => accessibleModules.some((m) => m.id === "beban-konseptor"),
    [accessibleModules]
  );

  /**
   * ==========================================================================
   * NAMA YANG DIKETUK MEMBUKA IDENTITASNYA
   * ==========================================================================
   *
   * Satu nama terbuka pada satu waktu. Membuka seluruhnya sekaligus mengubah
   * daftar pihak menjadi lima kartu panjang, dan yang mencari satu orang harus
   * menggulung melewati empat orang lain untuk menemukannya.
   *
   * Pembacaan SIPP-nya baru berjalan ketika nama PERTAMA diketuk - lihat
   * `useIdentitasPihak`. Perkara yang dibuka untuk melihat jadwal sidang tidak
   * pernah menyentuh identitas siapa pun.
   */
  /**
   * ==========================================================================
   * RINGKASAN SATU LAYAR
   * ==========================================================================
   *
   * Disusun dari muatan yang SUDAH ada - tidak ada pembacaan tambahan ke SIPP.
   * Tanggal acuannya disuntikkan, bukan dibaca di dalam penyusunnya, supaya
   * perilakunya dapat diuji tanpa bergantung pada hari uji itu dijalankan.
   */
  const ringkas = useMemo(() => {
    const d = new Date();
    const p = (x: number) => String(x).padStart(2, "0");
    return ringkasStatus(status, `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
  }, [status]);

  const [pihakDibuka, setPihakDibuka] = useState("");
  const identitas = useIdentitasPihak(status.identitas.nomorPerkara, Boolean(pihakDibuka));

  // Satu urutan untuk seluruh daftar sidang di layar ini - Perjalanan sidang
  // dan BAS di Berkas - supaya nomor yang sama berdiri di baris yang sama pada
  // keduanya. sidangBerikut/sidangTerakhir di bawah sengaja tetap membaca
  // status.jadwal: "berikut" adalah pertanyaan tanggal, bukan nomor.
  const jadwalUrut = useMemo(() => urutkanMenurutNomorSidang(status.jadwal), [status.jadwal]);

  // "Hari ini" menurut jam PERAMBAN, sama dengan grafik Umur perkara pada tiap
  // sidang dan Kalender perkara. Dulu toISOString() - tanggal UTC - sehingga
  // pada pukul 00.00-08.00 WITA lencana "Sidang berikut" masih menyebut sidang
  // kemarin sementara grafiknya sudah menggambar sidang hari ini berongga.
  const sidangBerikut = status.jadwal.find((x) => x.tanggalSidang >= hariIniIso());
  const sidangTerakhir = status.jadwal[status.jadwal.length - 1];

  return (
    // Penanda pembungkus cetak: yang di dalamnya tercetak dengan palet kertas,
    // yang di luarnya (navigasi, pencarian) tidak - lihat cetak-status-perkara.tsx.
    <div className="space-y-3" data-cetak-status-perkara="">
      {/* items-start, bukan items-baseline: tombol unduh membawa pilihan
          arsip fisik di bawahnya, dan garis alas akan menggantungnya. */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">{status.identitas.nomorPerkara}</h3>
          <p className="text-sm text-muted-foreground">
            {status.identitas.jenisPerkaraLengkap || status.identitas.jenisPerkara}
          </p>
        </div>
        {/* ==============================================================
            SELURUH PERKARA DALAM SATU BERKAS
            ==============================================================

            Berdiri di KEPALA layar, bukan di bagian Berkas yang berada pada
            urutan ketujuh belas dari dua puluh enam. Yang datang untuk
            membawa perkaranya keluar - banding, pemeriksaan pengawas, serah
            terima pemegang perkara - datang untuk itu saja, dan menyuruhnya
            menggulung melewati enam belas bagian lebih dulu berarti
            tombolnya tidak akan ditemukan.

            Yang turun bukan hanya berkasnya: seluruh keterangan perkara ikut
            sebagai JSON dan CSV, sebab yang dikirim ke banding dan yang
            diperiksa pengawas adalah keduanya. */}
        <div className="flex flex-wrap items-start gap-2 print:hidden">
          {/* Tulisannya "Unduh seluruh berkas" (bawaan isi="lengkap") sejak
              butir 25, 6 Okt 2026. */}
          <TombolUnduhZip nomorPerkara={status.identitas.nomorPerkara} isi="lengkap" />
          <Button size="sm" variant="outline" onClick={onKembali}>
            Cari perkara lain
          </Button>
        </div>
      </div>

      {/* ==================================================================
          PENANDA PERKARA
          ==================================================================

          Deretan penanda ringkas, bukan kartu besar. Yang dibaca orang di
          sini adalah SIFAT perkaranya - lewat e-Court atau tidak, sudah putus
          atau belum, ghaib atau tidak - dan sifat tidak memerlukan ruang
          seperempat layar untuk disampaikan. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={status.lewatEcourt ? "default" : "muted"}>
          {status.lewatEcourt ? "e-Court" : "perkara biasa"}
        </Badge>

        {/* ==================================================================
            TANGGAL DAN STATUS DIPISAH JADI DUA PENANDA
            ==================================================================

            Sebelumnya keduanya satu lencana HIJAU - "Putus 2026-08-06 ·
            Dikabulkan" - dan hijaunya melekat pada kata "Putus", bukan pada
            hasilnya. Akibatnya perkara yang DITOLAK pun tergambar hijau, dan
            yang sempat melihat sekilas membaca kabar baik atas putusan yang
            justru menolak permohonan pihaknya.

            Sekarang tanggalnya netral - ia keterangan, bukan penilaian - dan
            warna melekat pada STATUSNYA, memakai aturan yang sama dengan layar
            jadwal sidang. */}
        {status.putusan?.sudahPutus ? (
          <>
            <Badge variant="outline">
              Putus {tanggalHariPendek(status.putusan.tanggalPutusan, status.putusan.tanggalPutusan)}
            </Badge>
            {status.putusan.statusPutusan ? (
              <Badge variant={warnaStatusPutusan(status.putusan.statusPutusan)}>
                {status.putusan.statusPutusan}
              </Badge>
            ) : null}
          </>
        ) : (
          <Badge variant="warning">Masih berjalan</Badge>
        )}

        {status.putusan?.verstek ? <Badge variant="muted">verstek</Badge> : null}

        {/* Ghaib mengubah cara perkara dinilai - SK memotong 120 hari dari
            waktu putusnya - dan cara ia dipanggil. Sumbernya disebutkan pada
            keterangan tombolnya supaya panitera dapat menilai sendiri apakah
            penandanya masuk akal. */}
        {status.penanda?.ghaib === true ? (
          <Badge
            variant="warning"
            title={`Dikenali dari: ${status.penanda.sumberGhaib.join("; ")}`}
          >
            ghaib
          </Badge>
        ) : null}

        {/* Mafqud tidak punya kolomnya sendiri di SIPP - yang dihitung
            pencirinya menurut SK: tundaan sidang 3 x 90 hari. Karena itu
            tertulis "terindikasi", dan tundaannya dirinci pada bagian
            Perjalanan sidang. */}
        {status.penanda?.mafqud === true ? (
          <Badge
            variant="warning"
            title={`Terindikasi dari ${status.penanda.tundaanPanjang.length} kali tundaan ${status.penanda.ambangMafqud.hari} hari atau lebih`}
          >
            mafqud (terindikasi)
          </Badge>
        ) : null}

        {(status.penanda?.instansi ?? []).map((x) => (
          <Badge
            key={x.kunci}
            variant="warning"
            title={x.pihak.map((y) => `${y.nama} (${y.pekerjaan})`).join("; ")}
          >
            {x.label}
          </Badge>
        ))}

        {status.identitasPihak?.adaKumulasi ? (
          <Badge variant="muted" title={status.identitasPihak.kumulasi.join(", ")}>
            kumulasi
          </Badge>
        ) : null}

        <Badge variant="muted">
          {status.identitasPihak?.adaKuasa ? "dengan kuasa" : "tanpa kuasa"}
        </Badge>
      </div>

      {/* --- Jajaran angka --- */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {/* ==================================================================
            LAMA PERKARA: YANG DINILAI DI ATAS, YANG MENTAH DI BAWAH
            ==================================================================

            Yang menentukan nilai adalah lama BERSIH - hari pendaftaran ikut
            dihitung, lalu lama mediasi dipotong. Itulah yang ditampilkan
            besar.

            Selisih mentah dari pendaftaran ke putusan tetap disebutkan dalam
            kurung: itu yang dapat dicocokkan langsung dengan tanggal pada
            berkas, dan tanpa itu angka besarnya tampak tidak berdasar. */}
        <Angka
          label="Lama perkara"
          nilai={
            status.umur.hariBersih === null
              ? "—"
              : `${status.umur.hariBersih} hari`
          }
          keterangan={
            status.umur.hariBerjalan === null
              ? "Tanggal pendaftaran belum tercatat."
              : `(${status.umur.hariBerjalan} hari daftar sampai ${
                  status.umur.sudahPutus ? status.umur.sebabSelesai || "putus" : "hari ini"
                }${status.umur.hariMediasi > 0 ? `, mediasi ${status.umur.hariMediasi} hari` : ""})`
          }
          nada={
            status.umur.hariBersih === null
              ? undefined
              : status.umur.hariBersih <= 90
                ? "baik"
                : status.umur.hariBersih <= 150
                  ? "perhatian"
                  : "kurang"
          }
        />
        <Angka
          label="Nilai kelengkapan"
          nilai={`${status.penilaian.skor}`}
          keterangan={`dari 100 · ${status.penilaian.keadaan}`}
          nada={status.penilaian.keadaan === "baik" ? "baik" : status.penilaian.keadaan === "perhatian" ? "perhatian" : "kurang"}
        />
        <Angka
          label="Sidang"
          nilai={`${status.jadwal.length}`}
          keterangan={
            status.penundaan.length > 0 ? `${status.penundaan.length} kali ditunda` : "tanpa penundaan"
          }
        />
        <Angka
          label="Sisa panjar"
          nilai={rupiah(status.biaya.sisa)}
          keterangan={`panjar ${rupiah(status.biaya.panjar)}`}
          nada={status.biaya.sisa < 0 ? "kurang" : undefined}
        />
      </div>

      {/* Bilah alat - sepuluh pekerjaan kecil yang selama ini dikerjakan
          tangan. Riwayat dan sematan tidak pernah meninggalkan peramban; yang
          ditanyakan ke peladen hanya alamat halaman perkara di SIPP. Muatan
          status diteruskan utuh sebagai bahan ringkasan yang disalin. */}
      <AlatStatusPerkara
        nomorPerkara={status.identitas.nomorPerkara}
        jenisPerkara={status.identitas.jenisPerkara}
        perkaraId={status.identitas.perkaraId}
        bahan={status}
        ringkas={ringkas}
        onBuka={onBuka}
      />

      {/* ==================================================================
          KARTU RINGKAS - TIGA PERTANYAAN PEMBUKA
          ==================================================================

          Dua puluh enam bagian di bawah, dan yang membuka layar ini hampir
          selalu datang dengan tiga pertanyaan yang sama: perkara ini sekarang
          DI MANA, apa yang TERLAMBAT, apa BERIKUTNYA. Ketiganya sebelumnya
          menuntut menggulung melewati bagian yang terciut.

          Tidak ada pembacaan tambahan ke SIPP - seluruhnya dari muatan yang
          sudah ada di layar ini. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card px-3 py-2">
          <p className="text-xs text-muted-foreground">Keadaan</p>
          <p
            className={cn(
              "text-sm font-semibold",
              ringkas.keadaanBerat && "text-amber-700 dark:text-amber-300"
            )}
          >
            {ringkas.keadaan}
          </p>
          <p className="text-xs text-muted-foreground">{ringkas.umurKalimat}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2">
          <p className="text-xs text-muted-foreground">Sidang berikutnya</p>
          <p className="text-sm font-semibold">{ringkas.berikutnya}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2">
          <p className="text-xs text-muted-foreground">Majelis</p>
          <p className="text-sm font-semibold">{ringkas.majelisKalimat}</p>
          <p className="text-xs text-muted-foreground">
            {status.panitera.length > 0
              ? status.panitera.map((x) => x.nama).join(", ")
              : "Panitera sidang belum ditunjuk"}
          </p>
        </div>
      </div>

      {/* ==================================================================
          PERLU TINDAKAN - PERINGATAN YANG DIKUMPULKAN, BUKAN DILAHIRKAN
          ==================================================================

          Tiap butir di sini sudah tampil di salah satu bagian di bawah,
          tersebar di antara dua puluh enam bagian yang sebagian besarnya
          terciut. Yang dikerjakan di sini mengumpulkannya.

          Yang tidak dapat ditindaklanjuti petugas TIDAK masuk: "perkara ini
          dibanding" adalah keadaan, bukan pekerjaan. */}
      {ringkas.peringatan.length > 0 ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
          <p className="mb-1 text-sm font-semibold">
            Perlu tindakan — {ringkas.peringatan.length} butir
          </p>
          <ul className="space-y-1">
            {ringkas.peringatan.map((x) => (
              <li key={x.pesan} className="flex items-start gap-2 text-sm">
                <span
                  className={cn(
                    "mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full",
                    x.berat ? "bg-amber-600 dark:bg-amber-400" : "bg-muted-foreground/60"
                  )}
                  aria-hidden
                />
                <span>
                  {x.pesan}
                  {x.sebab ? (
                    <span className="block text-xs text-muted-foreground">{x.sebab}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <Bagian judul="Majelis dan petugas" kunci="majelis">
          {/* Tiap nama membuka rekap orangnya di tab baru, lewat ID SIPP -
              lihat tautan-petugas.tsx (butir 9 permintaan 27 September 2026).
              Majelis PEMERIKSA, lalu majelis ikrar talak sebagai blok
              tersendiri - bukan majelis ikrar yang menggantikan pemeriksa. */}
          <DaftarMajelisPetugas
            majelis={status.majelis}
            panitera={status.panitera}
            jurusita={status.jurusita}
            ikrar={status.ikrar}
            sumberMajelis={status.sumberMajelis}
          />
        </Bagian>

        {/* ==================================================================
            PARA PIHAK - DIPISAH MENURUT KEDUDUKAN, BUKAN SATU DAFTAR
            ==================================================================

            Sebelumnya satu daftar berurutan dengan kedudukan tiap orang
            tertulis sebagai keterangan kecil di belakang namanya. Pada perkara
            berkuasa hukum dan bersaksi, daftar itu menjadi tujuh baris yang
            harus dibaca satu per satu untuk menjawab pertanyaan paling
            sederhana: siapa penggugatnya.

            Lebih buruk lagi, SAKSI tertulis "pihak" - sebutan yang keliru.
            Saksi bukan pihak: ia tidak dipanggil sebagai pihak, tidak
            menanggung biaya, dan tidak terikat putusan.

            Empat kelompok sekarang:

              Penggugat/Pemohon   beserta kuasanya, menjorok di bawahnya
              Tergugat/Termohon   beserta kuasanya
              Saksi penggugat     sisi yang mengajukannya dibaca dari SIPP
              Saksi tergugat

            Kuasa ditaruh DI BAWAH pihak yang diwakilinya, bukan pada
            kelompoknya sendiri. Kuasa tidak berdiri sendiri di persidangan -
            ia hadir UNTUK seseorang, dan memisahkannya menjadi kelompok
            tersendiri memutus keterangan yang justru menentukan siapa yang
            boleh berbicara.

            Kelompok yang kosong tidak digambar. Judul "Saksi tergugat" di atas
            ruang kosong menyatakan sesuatu yang tidak dinyatakan siapa pun. */}
        {/* ==================================================================
            TERCIUT SEBAGAI BAWAAN, DENGAN RINGKASANNYA DI KEPALA

            Nama para pihak adalah data pribadi, dan layar ini dibuka di meja
            yang kerap terlihat orang lain. Sebelumnya daftar lengkapnya - nama,
            kedudukan, dan nomor telepon samar tiap orang - terbentang sendiri
            begitu perkara dibuka, tiap kali, untuk siapa pun yang lewat.

            Yang tersisa di kepala hanya hitungannya. Yang perlu membacanya
            menekan sekali, dan itu memang niatnya.
            ================================================================== */}
        <Bagian
          judul="Para pihak"
          kunci="pihak"
          keterangan={ringkasPihak(status.pihak)}
          ciutBawaan
        >
          {/* Jalan ke Peta Perkara. Ditaruh di sini, bukan di menu samping,
              sebab pertanyaan "dari mana perkara seperti ini datang" justru
              muncul ketika seseorang sedang menatap satu perkara - dan alamat
              pihak inilah bahan sebarannya. */}
          <a
            href={withBasePath("/peta-perkara")}
            className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-foreground transition hover:bg-muted/50"
          >
            Lihat sebaran perkara sejenis pada Peta Perkara
          </a>

          {/* Riwayat para pihak (cerai berakta, perkara terkait) dibaca oleh
              PenyediaRiwayatPihak. Isi bagian ini baru digambar ketika
              bagiannya dibuka, jadi pembacaannya pun baru berjalan saat itu -
              muatan Status Perkara tidak bertambah satu kueri pun. */}
          {status.pihak.length === 0 ? (
            <p className="text-sm text-muted-foreground">Pihak belum tercatat.</p>
          ) : (
            <PenyediaRiwayatPihak
              perkaraId={status.identitas.perkaraId}
              nomorPerkara={status.identitas.nomorPerkara}
            >
            {(() => {
              /**
               * Sisi yang mengajukan tiap saksi, dari perkara_pihak5 lewat
               * saksiRinci. Daftar pihak sendiri TIDAK menyimpannya - di sana
               * saksi hanya berkedudukan lima tanpa keterangan sisi.
               *
               * Dicocokkan menurut nama. Nama yang tidak ketemu jatuh ke
               * kelompok "Saksi" tanpa sisi - "tidak diketahui", bukan
               * dipaksa ke salah satu sisi. Menaruh saksi pada sisi yang salah
               * membalik siapa yang menghadirkannya, dan itu keterangan yang
               * dipersoalkan saat kesaksiannya dinilai.
               */
              const sisiSaksi = new Map<string, string>();
              for (const saksi of status.saksiRinci.baris) {
                const nama = saksi.nama.trim().toLowerCase();
                if (nama) sisiSaksi.set(nama, saksi.diajukanOleh || "");
              }

              const pihakSisi = (sisi: 1 | 2) =>
                status.pihak.filter((x) => x.jenis !== "kuasa" && x.pihakKe === sisi);
              const kuasaSisi = (sisi: 1 | 2) =>
                status.pihak.filter((x) => x.jenis === "kuasa" && x.pihakKe === sisi);

              const seluruhSaksi = status.pihak.filter(
                (x) => x.jenis !== "kuasa" && x.pihakKe !== 1 && x.pihakKe !== 2
              );
              const saksiSisi = (cocok: (sisi: string) => boolean) =>
                seluruhSaksi.filter((x) => cocok(sisiSaksi.get(x.nama.trim().toLowerCase()) || ""));

              const nomor = (orang: (typeof status.pihak)[number]) =>
                orang.adaNomor ? ` · ${orang.nomorSamar}` : " · tanpa nomor";

              /**
               * Nama yang dapat diketuk untuk membuka identitasnya.
               *
               * Tetap tombol, bukan tautan: yang dibuka bukan halaman lain
               * melainkan keterangan di tempatnya sendiri. Tautan yang tidak
               * menuju ke mana-mana merusak klik-tengah, "buka di tab baru",
               * dan pembaca layar sekaligus.
               *
               * Kata "tombol" dieja begitu dengan sengaja - penjaga
               * button-wiring menyisir teks mentah dan menganggap lambang
               * tombol di dalam keterangan sebagai tombol sungguhan.
               */
              const NamaPihak = ({
                orang,
                nomor: keteranganNomor,
              }: {
                orang: (typeof status.pihak)[number];
                nomor: string;
              }) => {
                const terbuka = pihakDibuka === orang.nama;
                return (
                  <>
                    <button
                      type="button"
                      onClick={() => setPihakDibuka(terbuka ? "" : orang.nama)}
                      aria-expanded={terbuka}
                      title={terbuka ? "Tutup identitas" : `Lihat identitas ${orang.nama}`}
                      className="text-left font-medium underline decoration-dotted decoration-muted-foreground/60 underline-offset-4 transition hover:text-primary hover:decoration-primary"
                    >
                      {orang.nama}
                    </button>
                    <span className="text-xs text-muted-foreground">{keteranganNomor}</span>
                    {/* Penanda cerai berulang dan perkara terkait - HANYA
                        pihak pertama/kedua. Kuasa dan saksi bukan pihak yang
                        riwayat perkawinannya ditanyakan (riwayat-pihak.tsx). */}
                    {bolehBertanda(orang) ? (
                      <PenandaRiwayatPihak nama={orang.nama} pihakKe={orang.pihakKe} />
                    ) : null}
                    {terbuka ? (
                      <KartuIdentitasPihak
                        orang={identitas.cari(orang.nama)}
                        memuat={identitas.memuat}
                        galat={identitas.galat}
                      />
                    ) : null}
                  </>
                );
              };

              const Kelompok = ({
                judul,
                pihak,
                kuasa = [],
              }: {
                judul: string;
                pihak: typeof status.pihak;
                kuasa?: typeof status.pihak;
              }) => {
                if (pihak.length === 0 && kuasa.length === 0) return null;
                return (
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {judul}
                    </p>
                    <ul className="space-y-0.5">
                      {pihak.map((orang, urutan) => (
                        <li key={`${judul}-${orang.nama}-${urutan}`}>
                          <NamaPihak orang={orang} nomor={nomor(orang)} />
                        </li>
                      ))}
                      {kuasa.map((orang, urutan) => (
                        <li key={`${judul}-kuasa-${orang.nama}-${urutan}`} className="pl-3">
                          <span className="text-xs text-muted-foreground">kuasa: </span>
                          <NamaPihak orang={orang} nomor={nomor(orang)} />
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              };

              return (
                <div className="space-y-2 text-sm">
                  <Kelompok
                    judul="Penggugat / Pemohon"
                    pihak={pihakSisi(1)}
                    kuasa={kuasaSisi(1)}
                  />
                  <Kelompok
                    judul="Tergugat / Termohon"
                    pihak={pihakSisi(2)}
                    kuasa={kuasaSisi(2)}
                  />
                  <Kelompok
                    judul="Saksi penggugat"
                    pihak={saksiSisi((sisi) => /penggugat|pemohon/i.test(sisi))}
                  />
                  <Kelompok
                    judul="Saksi tergugat"
                    pihak={saksiSisi((sisi) => /tergugat|termohon/i.test(sisi))}
                  />
                  {/* Saksi yang sisinya tidak terbaca disebut apa adanya -
                      bukan dimasukkan ke salah satu sisi supaya daftarnya
                      terlihat rapi. */}
                  <Kelompok
                    judul="Saksi - sisi belum tercatat"
                    pihak={saksiSisi(
                      (sisi) => !/penggugat|pemohon|tergugat|termohon/i.test(sisi)
                    )}
                  />
                </div>
              );
            })()}
            </PenyediaRiwayatPihak>
          )}
        </Bagian>
      </div>

        {/* ==================================================================
          TAHAPAN PERKARA
          ==================================================================

          Dari pendaftaran sampai penetapan hari sidang, beserta KAPAN masing-
          masing diinput ke SIPP. Selisih harinya ditampilkan karena itulah
          yang dinilai SK - bukan sekadar ada tidaknya tanggalnya.

          Tahapan yang kolomnya tidak ada pada SIPP versi ini disebutkan apa
          adanya. "Kolomnya tidak ada" sangat berbeda dari "belum dikerjakan",
          dan menyamarkan keduanya akan menuduh pengadilan atas pekerjaan yang
          sebenarnya sudah selesai. */}
      <Bagian judul="Tahapan perkara dan waktu penginputannya" kunci="tahapan">
        {status.tahapan.terbaca ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-1 text-left font-medium">Tahap</th>
                  <th className="py-1 text-left font-medium">Tanggal</th>
                  <th className="py-1 text-right font-medium">Selisih</th>
                  <th className="py-1 text-left font-medium">Diinput</th>
                  <th className="py-1 text-right font-medium">Jeda input</th>
                  <th className="py-1 text-right font-medium">Berkas</th>
                </tr>
              </thead>
              <tbody>
                {status.tahapan.tahap.map((tahap) => (
                  <tr key={tahap.kunci} className="border-t">
                    <td className="py-1.5 pr-2">
                      <span className="font-medium" title={tahap.dasar}>
                        {tahap.label}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2">
                      {!tahap.terbaca ? (
                        <span className="text-sm text-amber-700 dark:text-amber-300" title={tahap.alasan}>
                          kolom tidak ada
                        </span>
                      ) : tahap.tanggal ? (
                        tahap.tanggal
                      ) : (
                        <span className="text-amber-700 dark:text-amber-300">belum</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-muted-foreground">
                      {/* Pendaftaran adalah titik nol - tidak ada acuan sebelumnya,
                          jadi selisihnya 0 hari, bukan tidak diketahui. Yang
                          benar-benar tidak diketahui hanya tahap yang tanggalnya
                          belum ada. */}
                      {tahap.hariSejakAcuan !== null
                        ? `${tahap.hariSejakAcuan} hari`
                        : !tahap.acuan && tahap.tanggal
                          ? "0 hari"
                          : "—"}
                    </td>
                    <td className="py-1.5 pr-2">
                      {!tahap.inputTerbaca ? (
                        <span className="text-sm text-amber-700 dark:text-amber-300" title={tahap.alasanInput}>
                          kolom tidak ada
                        </span>
                      ) : tahap.diinput ? (
                        tahap.diinput
                      ) : (
                        <span className="text-amber-700 dark:text-amber-300">belum</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-muted-foreground">
                      {tahap.hariSampaiInput === null ? "—" : `${tahap.hariSampaiInput} hari`}
                    </td>
                    <td className="py-1.5 text-right">
                      {/* Berkas pindaian penetapannya, bila memang sudah
                          diunggah. Tombol yang menghasilkan galat lebih buruk
                          daripada tidak ada tombol. */}
                      {tahap.adaBerkas && tahap.dokumenId ? (
                        <TombolUnduh
                          alamat={`/api/aleta-ecourt/berkas-sipp?jenis=penetapan&id=${encodeURIComponent(
                            tahap.dokumenId
                          )}`}
                          label="Unduh"
                          namaCadangan={`${tahap.kunci}-${status.identitas.nomorPerkara}.pdf`}
                        />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Penetapan kembali TIDAK mengurangi nilai - hakim mutasi bukan
                kesalahan siapa-siapa. Ia disebutkan supaya jelas mengapa ada
                lebih dari satu penetapan, dan mengapa yang dinilai yang
                pertama. */}
            {status.penetapanKembali.adaPenggantian ? (
              <div className="mt-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <p className="font-medium">Pernah ada penetapan kembali</p>
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  {status.penetapanKembali.baris.map((baris) => (
                    <li key={baris.jenis}>
                      <span className="font-medium">{baris.jenis}:</span>{" "}
                      {baris.penggantian
                        .map((x) =>
                          `${x.nama || "tanpa nama"}${x.masihAktif ? "" : " (diganti"}${
                            !x.masihAktif && x.tanggalTidakAktif ? ` ${tanggalHariPendek(x.tanggalTidakAktif, x.tanggalTidakAktif)}` : ""
                          }${x.masihAktif ? "" : ")"}`
                        )
                        .join(", ")}
                    </li>
                  ))}
                </ul>
                <p className="mt-1">
                  Yang dinilai tetap penetapan pertama - penetapan kembali tidak dihitung.
                </p>
              </div>
            ) : null}

            {/* ==============================================================
                JEDA PENGINPUTAN, DIGAMBAR
                ==============================================================

                Angka yang sama sudah ada di kolom terakhir tabel di atas -
                satu angka per baris, tersebar di sepuluh baris. Membandingkan
                sepuluh angka yang berjauhan menuntut pembacanya mengingat
                kesembilan lainnya sambil membaca yang kesepuluh.

                Digambar, pertanyaan "tahapan mana yang paling lambat diinput"
                terjawab tanpa satu pun angka dibaca. Tabelnya TETAP ADA di
                atas: gambar menjawab yang mana, tabel menjawab berapa dan
                oleh siapa.

                TIDAK ADA GARIS AMBANG - dan itu keputusan, bukan kelalaian.
                Ambang penginputan tiap tahapan berbeda-beda dan tidak satu pun
                disebut di layar ini; menggambar satu garis untuk semuanya
                berarti mengarang ambang yang tidak ada dasarnya, dan garis
                ambang yang dikarang lebih buruk daripada tidak ada garis. */}
            {(() => {
              const titik: TitikData[] = status.tahapan.tahap
                .filter((tahap) => tahap.hariSampaiInput !== null)
                .map((tahap) => ({
                  label: tahap.label,
                  nilai: tahap.hariSampaiInput,
                  keterangan: tahap.diinputOleh ? `diinput ${tahap.diinputOleh}` : "",
                }));

              // Satu batang bukan perbandingan - ia hanya angka yang digambar
              // lebih besar. Di bawah dua tahapan, tabel di atas sudah cukup.
              if (titik.length < 2) return null;

              return (
                <div className="mt-3">
                  <DiagramBatang
                    data={titik}
                    judul="Jeda antara peristiwa dan penginputannya"
                    satuan="hari"
                  />
                </div>
              );
            })()}
          </div>
        ) : (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
            {status.tahapan.alasan} Jalankan{" "}
            <code className="rounded bg-amber-100 px-1 dark:bg-amber-500/20">scripts/sipp-periksa-kolom.js</code> di server
            untuk melihat nama kolom yang sebenarnya.
          </p>
        )}
      </Bagian>

      <Bagian judul="Perjalanan sidang" kunci="sidang">
        {status.jadwal.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada jadwal sidang tercatat.</p>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap gap-2 text-sm">
              {sidangBerikut ? (
                <Badge variant="default">
                  Sidang berikut: {tanggalHariPendek(sidangBerikut.tanggalSidang, sidangBerikut.tanggalSidang)}{" "}
                  {sidangBerikut.jamSidang} —{" "}
                  {sidangBerikut.agenda || "tanpa agenda"}
                </Badge>
              ) : sidangTerakhir ? (
                <Badge variant="muted">
                  Sidang terakhir:{" "}
                  {tanggalHariPendek(sidangTerakhir.tanggalSidang, sidangTerakhir.tanggalSidang)}
                </Badge>
              ) : null}
            </div>

            <ol className="space-y-1 text-sm">
              {jadwalUrut.map((sidang) => (
                <li key={sidang.sidangId} className="flex flex-wrap items-baseline gap-x-2 border-l-2 border-border pl-2">
                  {/* Nomor sidang di tepi kiri - diminta pengguna 24 September
                      2026, sama dengan panel Rincian di Antrian Sidang. Angkanya
                      kolom urutan SIPP, bukan nomor baris daftar ini. */}
                  <NomorSidang urutan={sidang.urutanSidang} />
                  <span className="font-medium">
                    {tanggalHariPendek(sidang.tanggalSidang, sidang.tanggalSidang)}
                  </span>
                  {sidang.jamSidang ? (
                    <span className="text-sm tabular-nums text-muted-foreground">{sidang.jamSidang}</span>
                  ) : null}
                  <span className="text-sm">{sidang.agenda || "tanpa agenda"}</span>
                  {sidang.ruangan ? (
                    <span className="text-xs text-muted-foreground">Ruang {sidang.ruangan}</span>
                  ) : null}
                  {sidang.ditunda ? (
                    <Badge variant="warning">
                      ditunda{sidang.alasanDitunda ? `: ${sidang.alasanDitunda}` : ""}
                    </Badge>
                  ) : null}
                  {/* BAS bukan sekadar penanda - ia berkas yang perlu dibuka.
                      Penanda yang tidak dapat ditekan memaksa orang membuka
                      SIPP hanya untuk mengunduh satu berkas. */}
                  {sidang.adaBas && sidang.sidangId ? (
                    <TombolUnduh
                      alamat={`/api/aleta-ecourt/berkas-sipp?jenis=bas&id=${encodeURIComponent(
                        sidang.sidangId
                      )}`}
                      label="BAS"
                      namaCadangan={`bas-${status.identitas.nomorPerkara}-${sidang.tanggalSidang}.pdf`}
                    />
                  ) : null}
                </li>
              ))}
            </ol>

            {/* ============================================================
                UMUR PERKARA PADA TIAP SIDANG, TERHADAP AMBANG SK DAN SEMA
                ============================================================

                Daftar sidang di atas menjawab "kapan saja sidangnya". Yang
                TIDAK dijawabnya - dan yang justru ditanyakan pengawasan tiap
                bulan - adalah "sejauh mana perkara ini sudah berjalan
                terhadap ambangnya, dan di penundaan mana waktunya habis".

                Dihitung dengan cara yang SAMA dengan "Lama perkara" di kepala
                layar ini: hari pendaftaran hari ke-1, dan hari mediasi yang
                sama - status.umur.hariMediasi - dikeluarkan (PERMA 1/2016
                Pasal 24). Grafik lama menggambar hari kalender; 94 dari 1.977
                perkara putus bersidang tiga kali atau lebih di satker ini
                jatuh pada pita yang berbeda dari kepala layarnya.

                Sidang sesudah putusan - ikrar talak, yang dapat ditunda enam
                bulan - tidak digambar: SEMA 2/2014 berhenti pada putusan.
                Dengannya, 94 dari 158 perkara yang tampak melewati 150 hari
                ternyata melewatinya HANYA karena sidang sesudah putusan.

                Tiga pita, dua dasar: 90 dan 120 hari dari SK Dirjen Badilag
                048/2024 (nilai 5 dan 3 pada rubrik waktu putus), 150 hari dari
                SEMA 2/2014. Warnanya hijau, kuning, oranye, lalu merah di atas
                150 - sebutan yang sama dengan pita waktu putus
                (lib/pita-waktu-putus.ts). Ambang tanpa dasar hanya angka yang
                harus dipercaya; ambang yang menyebut dasarnya dapat dibantah.

                Titiknya menyebut nomor sidang SIPP (urutanSidang), angka yang
                sama dengan tepi kiri daftar di atas. */}
            {(() => {
              const perjalanan = susunPerjalananSidang({
                tanggalDaftar: status.identitas.tanggalDaftar,
                tanggalPutusan: status.putusan && status.putusan.sudahPutus ? status.putusan.tanggalPutusan : "",
                hariMediasi: status.umur.hariMediasi,
                jadwal: status.jadwal,
                mediasi: status.mediasi.terbaca ? status.mediasi.baris : [],
                hariIni: hariIniIso(),
              });

              // Dua titik selalu membentuk garis lurus, dan garis lurus
              // terbaca seperti pola. Penggambarnya sendiri menolak di bawah
              // tiga sidang; diperiksa di sini juga supaya judulnya pun tidak
              // sempat tergambar untuk gambar yang tidak akan ada.
              if (!perjalanan || perjalanan.titik.length < 3) return null;

              return (
                <div className="mt-3">
                  <DiagramPerjalananSidang
                    perjalanan={perjalanan}
                    judul="Umur perkara pada tiap sidang"
                    hariIniDihitung={status.umur.sudahPutus ? null : status.umur.hariBersih}
                    /* Perkara ghaib punya DUA angka umur yang keduanya benar,
                       dan satu-satunya yang menerangkan selisihnya adalah
                       catatan grafik ini.

                       Terukur di sipp_donggala 25 September 2026 atas 13 perkara
                       ghaib yang belum putus: 322/Pdt.G/2026 terbaca "1 hari" di
                       Antrian Sidang dan 115 hari di sini. Tanpa satu kalimat
                       penjelasan, salah satu layar akan dianggap rusak - garis
                       ini memang TIDAK dipotong, sebab batas lima bulan SEMA
                       2/2014 tidak mengenal kelonggaran perkara khusus. */
                    ghaib={status.penanda?.ghaib === true}
                    pita={[
                      { sampai: 90, singkat: "3 bln", label: "3 bulan - SK Dirjen Badilag 048/2024", nada: "hijau" },
                      { sampai: 120, singkat: "4 bln", label: "4 bulan - SK Dirjen Badilag 048/2024", nada: "kuning" },
                      { sampai: AMBANG_HARI_SEMA, singkat: "5 bln", label: "5 bulan - SEMA 2/2014", nada: "oranye" },
                    ]}
                  />
                </div>
              );
            })()}
          </>
        )}
      </Bagian>

      {/* ==================================================================
          KALENDER PERKARA
          ==================================================================

          "Perjalanan sidang" di atas menjawab apa yang sudah terjadi. Yang
          tidak dijawab daftar mana pun: KAPAN - dalam bentuk yang dapat
          dilihat sekali pandang, berikut jarak antar peristiwanya.

          Petugas yang menyiapkan berkas menanyakan "minggu ini perkara ini
          ada apa", dan jawabannya tersebar di enam bagian yang berbeda:
          sidang di jadwal, mediasi di mediasi, panggilan di relaas, minutasi
          di putusan. Kalender mengumpulkannya ke satu tempat tanpa
          memindahkan satu pun datanya. */}
      <Bagian
        judul="Kalender perkara"
        kunci="kalender"
        keterangan="seluruh peristiwa perkara ini pada satu bulan"
      >
        <KalenderPerkara status={status} />
      </Bagian>

      {/* ==================================================================
          RELAAS PANGGILAN
          ==================================================================

          Dulu ia satu blok di dalam "Berkas", berupa deretan nama beserta
          tombol unduh. Tempatnya keliru: relaas bukan lampiran, melainkan
          PERBUATAN yang menentukan sidang boleh dilanjutkan atau harus
          ditunda. Yang ditanyakan orang bukan "ada berkasnya atau tidak",
          melainkan "sudahkah para pihak dipanggil, lewat jalur apa, bertemu
          orangnya atau tidak, dan patut menurut tenggangnya".

          Disusun RUNUT PER SIDANG sebab begitulah relaas dicatat - satu baris
          per pihak per sidang. Daftar rata tanpa pengelompokan mengulang nama
          yang sama lima kali tanpa menyebutkan untuk sidang yang mana. */}
      <Bagian
        judul="Relaas panggilan"
        kunci="relaas"
        keterangan={
          status.relaas.length > 0
            ? `${status.relaas.length} relaas pada ${
                new Set(status.relaas.map((x) => x.tanggalSidang || "-")).size
              } sidang`
            : ""
        }
      >
        <RelaasPanggilan status={status} />
      </Bagian>
      {/* ==================================================================
          MEDIASI
          ==================================================================

          PERMA 1/2016 Pasal 24: mediasi paling lama 30 hari sejak mediator
          ditetapkan. Yang lewat ditandai - bukan untuk menyalahkan, melainkan
          supaya terlihat saat berkas diperiksa. */}
      <Bagian
        judul="Mediasi"
        kunci="mediasi"
        keterangan={
          status.mediasi.terbaca && status.mediasi.baris.length > 0
            ? `${status.mediasi.baris.length} catatan`
            : ""
        }
      >
        {!status.mediasi.terbaca ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
            <p>{status.mediasi.alasan}</p>
            {/* Nama kolom yang sebenarnya ada, langsung di layar. Tanpa ini,
                menemukan nama yang benar menuntut membuka Navicat. */}
            {status.mediasi.kolomTersedia && status.mediasi.kolomTersedia.length > 0 ? (
              <p className="mt-1 text-sm">
                Tambahkan nama yang sesuai ke daftar calon pada
                <code className="mx-1 rounded bg-amber-100 px-1 dark:bg-amber-500/20">services/sippSkemaService.js</code>
                lalu nyalakan ulang bot.
              </p>
            ) : null}
          </div>
        ) : status.mediasi.baris.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada catatan mediasi pada perkara ini.
          </p>
        ) : (
          <ul className="space-y-2">
            {status.mediasi.baris.map((baris, urutan) => (
              <li key={`${baris.mediator}-${urutan}`} className="rounded-md border bg-muted/20 p-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  {/* Tiap nama mediator membuka rekapnya di tab baru, lewat
                      mediator_id - lihat tautan-petugas.tsx (butir 6). */}
                  <NamaMediatorTertaut
                    mediator={baris.mediator}
                    statusMediator={baris.statusMediator}
                    mediatorIds={baris.mediatorIds}
                  />
                  {/* Hasil mediasi diberi warna menurut berhasil atau tidak -
                      itulah yang dicari mata saat memeriksa berkas. */}
                  {baris.hasil ? (
                    <Badge
                      variant={baris.berhasil ? "success" : "warning"}
                      title={baris.kodeHasil ? `Kode SIPP: ${baris.kodeHasil}` : ""}
                    >
                      {baris.hasil}
                    </Badge>
                  ) : (
                    <Badge variant="muted">hasil belum dicatat</Badge>
                  )}
                </div>
                <dl className="mt-1 grid gap-x-4 gap-y-0.5 text-sm sm:grid-cols-2">
                  {baris.jenisPenetapan ? (
                    <div>
                      <dt className="inline text-muted-foreground">Jenis penetapan: </dt>
                      <dd className="inline">{baris.jenisPenetapan}</dd>
                    </div>
                  ) : null}
                  {baris.nomorSk ? (
                    <div>
                      <dt className="inline text-muted-foreground">Nomor SK: </dt>
                      <dd className="inline">{baris.nomorSk}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="inline text-muted-foreground">Penetapan mediator: </dt>
                    <dd className="inline">
                      {tanggalHariPendek(baris.tanggalPenetapan, baris.tanggalPenetapan || "—")}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-muted-foreground">Mulai: </dt>
                    <dd className="inline">
                      {tanggalHariPendek(baris.tanggalMulai, baris.tanggalMulai || "—")}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-muted-foreground">Selesai: </dt>
                    <dd className="inline">
                      {tanggalHariPendek(baris.tanggalSelesai, baris.tanggalSelesai || "—")}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-muted-foreground">Laporan mediator: </dt>
                    <dd className="inline">
                      {tanggalHariPendek(baris.tanggalLaporan, baris.tanggalLaporan || "—")}
                    </dd>
                  </div>
                  {baris.tanggalKesepakatan ? (
                    <div>
                      <dt className="inline text-muted-foreground">Kesepakatan perdamaian: </dt>
                      <dd className="inline">
                        {tanggalHariPendek(baris.tanggalKesepakatan, baris.tanggalKesepakatan)}
                      </dd>
                    </div>
                  ) : null}
                  {baris.jumlahPertemuan !== null ? (
                    <div>
                      <dt className="inline text-muted-foreground">Pertemuan: </dt>
                      <dd className="inline">{baris.jumlahPertemuan} kali</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="inline text-muted-foreground">Lama: </dt>
                    <dd className="inline">
                      {baris.lamaHari === null ? "—" : `${baris.lamaHari} hari`}

                      {baris.lewatTenggang ? (
                        <span className="ml-1 text-amber-700 dark:text-amber-300">lewat 30 hari (PERMA 1/2016)</span>
                      ) : null}
                    </dd>
                  </div>
                </dl>

                {/* Isi kesepakatan dibawa utuh - inilah yang dibaca saat
                    berkas diperiksa, dan memotongnya menghilangkan bagian
                    yang mungkin justru sedang dicari. */}
                {/* Isi kesepakatan perdamaian panjang dan bertanda HTML.
                    Diciutkan secara bawaan: yang membacanya hanya saat berkas
                    perdamaian diperiksa, sedangkan yang lain cukup tahu
                    hasilnya. Ditampilkan sebagai TEKS, bukan dirender - isi
                    dari basis data tidak boleh menjadi markup di halaman. */}
                {baris.isiKesepakatan ? (
                  <details className="mt-1.5 rounded border bg-card p-2">
                    <summary className="cursor-pointer text-sm font-medium">
                      Isi kesepakatan perdamaian
                    </summary>
                    <div className="mt-1 max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {baris.isiKesepakatan
                        .replace(/<li>/gi, "\n• ")
                        .replace(/<\/(p|div|li|ol|ul)>/gi, "\n")
                        .replace(/<[^>]*>/g, " ")
                        .replace(/[ \t]+/g, " ")
                        .replace(/\n{3,}/g, "\n\n")
                        .trim()}
                    </div>
                  </details>
                ) : null}

                {baris.catatan ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    <span className="font-medium">Catatan: </span>
                    {baris.catatan.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {/* Jadwal pertemuan mediasi, bila SIPP mencatatnya tersendiri. */}
        {status.mediasi.jadwal && status.mediasi.jadwal.length > 0 ? (
          <div className="mt-2">
            <p className="mb-1 text-sm font-medium">Jadwal pertemuan</p>
            <ul className="space-y-0.5 text-sm text-muted-foreground">
              {status.mediasi.jadwal.map((x, urutan) => (
                <li key={`${x.tanggal}-${urutan}`}>
                  {tanggalHariPendek(x.tanggal, x.tanggal)}
                  {x.jam ? ` ${x.jam}` : ""}
                  {x.sampaiJam ? `-${x.sampaiJam}` : ""}
                  {x.tempat ? ` — ${x.tempat}` : ""}
                  {/* ditunda = T pada SIPP berarti pertemuan itu tidak jadi. */}
                  {x.ditunda ? <span className="ml-1 text-amber-700 dark:text-amber-300">ditunda</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Bagian>

      {/* ==================================================================
          SAKSI
          ==================================================================

          Hubungan saksi dengan para pihak lazimnya tidak punya kolomnya
          sendiri - panitera menuliskannya pada keterangan. Karena itu
          keterangannya ditampilkan UTUH, bukan diurai jadi kategori.
          Menguraikannya berarti menebak, dan menebak hubungan keluarga pada
          berkas perkara tidak termaafkan. */}
      <Bagian
        judul="Saksi"
        kunci="saksi"
        keterangan={
          status.saksiRinci.terbaca && status.saksiRinci.baris.length > 0
            ? `${status.saksiRinci.baris.length} saksi`
            : ""
        }
      >
        {/* Jalan ke layar hakim: keterangan saksi dibaca utuh di sana dan tiap
            keterangan yang salah dapat dikomentari. Ditaruh di bagian Saksi,
            bukan di menu samping, sebab pertanyaan "apa kata saksinya" muncul
            saat seseorang sedang menatap perkara ini. Komentar tidak menahan
            apa pun - tidak ada acc di jalan ini. */}
        {status.identitas.nomorPerkara ? (
          <a
            href={withBasePath("/bas/komentar?nomor=" + encodeURIComponent(status.identitas.nomorPerkara))}
            className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-foreground transition hover:bg-muted/50"
          >
            Baca BAS & keterangan saksi - komentar hakim
          </a>
        ) : null}
        {!status.saksiRinci.terbaca ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">{status.saksiRinci.alasan}</p>
        ) : status.saksiRinci.baris.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada keterangan saksi.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-1 text-left font-medium">Nama</th>
                  <th className="py-1 text-left font-medium">Diajukan</th>
                  <th className="py-1 text-left font-medium">Hubungan / keterangan</th>
                  <th className="py-1 text-right font-medium">Identitas</th>
                </tr>
              </thead>
              <tbody>
                {status.saksiRinci.baris.map((baris, urutan) => (
                  <tr key={`${baris.nama}-${urutan}`} className="border-t align-top">
                    <td className="py-1.5 pr-2 font-medium">{baris.nama || "—"}</td>
                    <td className="py-1.5 pr-2 text-muted-foreground">{baris.diajukanOleh || "—"}</td>
                    <td className="py-1.5 pr-2">{baris.keterangan || "—"}</td>
                    <td className="py-1.5 text-right text-sm tabular-nums text-muted-foreground">
                      {baris.isianTerisi} dari 3
                      {/* Apa yang belum diisi - supaya jelas apa yang harus
                          dilengkapi, bukan sekadar tahu nilainya kurang. */}
                      {baris.isianKurang && baris.isianKurang.length > 0 ? (
                        <div className="text-amber-700 dark:text-amber-300">belum: {baris.isianKurang.join(", ")}</div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Bagian>
      {/* ==================================================================
          PUTUSAN LENGKAP
          ==================================================================

          Yang ditanyakan saat berkas diperiksa, dan selama ini harus dibuka
          satu per satu di SIPP: amarnya, sumber hukumnya, faktor penyebab
          perceraiannya, qobla atau bada dukhul, dan status nusyuz. */}
      {/* Bagian ini muncul pada setiap perkara yang SUDAH PUTUS, bukan hanya
          saat keterangannya terbaca. Menyembunyikannya membuat dua keadaan
          yang sangat berbeda - belum putus, dan sudah putus tetapi tidak
          terbaca - tampak persis sama: bagiannya hilang. Konseptor pun tinggal
          di dalam sini, sehingga menyembunyikannya ikut menyembunyikan
          konseptor pada perkara yang justru perlu ditelusuri. */}
      {status.putusanLengkap.ada || status.putusan?.sudahPutus ? (
        <Bagian judul="Keterangan putusan" kunci="putusan-lengkap">
          {!status.putusanLengkap.ada ? (
            <p className="mb-2 rounded border border-amber-500/40 bg-amber-500/5 px-2 py-1.5 text-sm text-amber-700 dark:text-amber-400">
              Perkara ini sudah putus, tetapi keterangan putusannya belum dapat
              dibaca dari SIPP
              {status.putusanLengkap.terbaca === false && status.putusanLengkap.alasan
                ? `: ${status.putusanLengkap.alasan}`
                : "."}
            </p>
          ) : null}
          <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Tanggal putusan</dt>
              <dd className="font-medium">
                {tanggalHariPanjang(
                  status.putusanLengkap.tanggalPutusan,
                  status.putusanLengkap.tanggalPutusan || "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Status putusan</dt>
              {/* Warna tulisan, bukan lencana: di dalam daftar keterangan
                  berpasangan, lencana penuh menarik mata melebihi ruas lain
                  yang sama pentingnya. Warnanya tetap dari aturan yang sama,
                  sehingga lencana di kepala layar dan tulisan di sini tidak
                  mungkin menyebut arti yang berbeda. */}
              <dd
                className={cn(
                  "font-medium",
                  kelasTulisanPutusan(status.putusanLengkap.statusPutusan || "")
                )}
              >
                {status.putusanLengkap.statusPutusan || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Jenis putusan</dt>
              <dd className="font-medium">
                {status.putusan?.verstek ? "Verstek" : "Contradictoir"}
              </dd>
            </div>
            {status.putusanLengkap.sumberHukum ? (
              <div>
                <dt className="text-xs text-muted-foreground">Sumber hukum</dt>
                <dd>{status.putusanLengkap.sumberHukum}</dd>
              </div>
            ) : null}
            {status.putusanLengkap.faktorPrimer ? (
              <div>
                <dt className="text-xs text-muted-foreground">Faktor perceraian (primer)</dt>
                <dd>{status.putusanLengkap.faktorPrimer}</dd>
              </div>
            ) : null}
            {status.putusanLengkap.faktorSekunder ? (
              <div>
                <dt className="text-xs text-muted-foreground">Faktor perceraian (sekunder)</dt>
                <dd>{status.putusanLengkap.faktorSekunder}</dd>
              </div>
            ) : null}
            {status.putusanLengkap.qoblaBada ? (
              <div>
                <dt className="text-xs text-muted-foreground">Qobla / Bada dukhul</dt>
                <dd>{status.putusanLengkap.qoblaBada}</dd>
              </div>
            ) : null}
            {status.putusanLengkap.statusNusyuz ? (
              <div>
                <dt className="text-xs text-muted-foreground">Status nusyuz</dt>
                <dd>{status.putusanLengkap.statusNusyuz}</dd>
              </div>
            ) : null}

            {/* ==============================================================
                KONSEPTOR SELALU DISEBUT, WALAU KOSONG
                ==============================================================

                Siapa yang mengerjakan konsep putusannya. Tidak punya kolom
                sendiri di SIPP - dibaca dari jejak proses tahapan putusan,
                lalu nama penggunanya diterjemahkan jadi nama orangnya.

                Sebelumnya bagian ini HILANG saat tidak terbaca, sehingga yang
                mencarinya menyimpulkan fiturnya tidak ada. Sekarang kolomnya
                tetap muncul dan menerangkan sendiri mengapa kosong. */}
            <div>
              <dt className="text-xs text-muted-foreground">Konseptor</dt>
              <dd>
                {status.konseptor.baris.length > 0 ? (
                  <>
                    {status.konseptor.baris.map((x, urutan) => (
                      <span key={x.pengguna}>
                        {urutan > 0 ? ", " : ""}
                        <span title={x.namaTerbaca ? `pengguna: ${x.pengguna}` : ""}>{x.nama}</span>
                      </span>
                    ))}
                    {status.konseptor.dariAudit ? (
                      <span
                        className="ml-1 text-sm text-muted-foreground"
                        title={status.konseptor.catatan || ""}
                      >
                        (pencatat)
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
              {/* Sebabnya disebut apa adanya: tidak terbaca berbeda dari tidak
                  ada, dan menyamakan keduanya membuat orang menelusuri hal
                  yang salah. */}
              {status.konseptor.baris.length === 0 ? (
                <dd className="text-sm text-muted-foreground">
                  {status.konseptor.terbaca
                    ? status.konseptor.catatan ||
                      "Tahapan putusan tidak tercatat pada perkara_proses untuk perkara ini."
                    : status.konseptor.alasan || "Konseptor tidak dapat dibaca dari SIPP."}
                </dd>
              ) : null}

              {/* ==========================================================
                  JALAN KE BEBAN KINERJA KONSEPTOR
                  ==========================================================

                  Nama konseptornya ada di sini; berat pekerjaannya ada di
                  layar lain, dan layar itu TIDAK tampil di beranda - hanya di
                  menu samping, dan hanya untuk pimpinan serta kepaniteraan.
                  Petugas yang membaca nama di sini karena itu wajar
                  menyimpulkan penilaiannya tidak ada.

                  Tautannya ditaruh tepat di sebelah namanya, bukan di menu:
                  pertanyaan "berapa berat beban orang ini" muncul justru
                  ketika seseorang sedang menatap namanya.

                  Muncul pada peran yang memang dapat membukanya saja - tautan
                  yang berujung penolakan lebih buruk daripada tidak ada
                  tautan, sebab ia menyalahkan orangnya atas pintu yang memang
                  tidak untuk dia. */}
              {bolehBebanKonseptor ? (
                <dd className="mt-1">
                  <a
                    href={withBasePath("/beban-konseptor")}
                    className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-foreground transition hover:bg-muted/50"
                  >
                    Lihat beban kinerja konseptor
                  </a>
                </dd>
              ) : null}
            </div>
          </dl>

          {/* Amar disimpan SIPP sebagai teks bertanda HTML. Ditampilkan
              sebagai teks biasa, bukan dirender - isi dari basis data tidak
              boleh menjadi markup di halaman ini. */}
          {status.putusanLengkap.amar ? (
            <details className="mt-2 rounded-md border bg-muted/20 p-2">
              <summary className="cursor-pointer text-sm font-semibold">Amar putusan</summary>
              <div className="mt-1.5 max-h-80 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
                {/* Rantai yang sama dengan amar ikrar talak dan isi
                    kesepakatan mediasi. Sebelumnya di sini hanya dua
                    langkah, dan langkah keduanya salah tulis: DUA garis
                    miring terbalik membuatnya mencari garis miring
                    terbalik diikuti huruf s - bukan spasi. Akibatnya sisa
                    spasi bekas tag HTML tidak pernah dirapatkan, dan
                    penanda daftar hilang sama sekali. */}
                {status.putusanLengkap.amar
                  .replace(/<li>/gi, "\n\u2022 ")
                  .replace(/<\/(p|div|li|ol|ul)>/gi, "\n")
                  .replace(/<[^>]*>/g, " ")
                  .replace(/[ \t]+/g, " ")
                  .replace(/\n{3,}/g, "\n\n")
                  .trim()}
              </div>
            </details>
          ) : null}
        </Bagian>
      ) : null}

      {status.putusan?.sudahPutus ? (
        <Bagian judul="Putusan dan tindak lanjutnya" kunci="putusan">
          <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <dt className="text-xs text-muted-foreground">Minutasi</dt>
              <dd className="font-medium">
                {status.putusan.tanggalMinutasi || (
                  <span className="text-amber-700 dark:text-amber-300">belum</span>
                )}
                {status.umur.hariMinutasi !== null ? (
                  <div className="text-sm font-normal text-muted-foreground">
                    {status.umur.hariMinutasi} hari setelah putus
                  </div>
                ) : null}
              </dd>
            </div>
            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <dt className="text-xs text-muted-foreground">Berkekuatan hukum tetap</dt>
              <dd className="font-medium">
                {status.putusan.tanggalBht || (
                  <span className="text-amber-700 dark:text-amber-300">belum</span>
                )}
              </dd>
            </div>
            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <dt className="text-xs text-muted-foreground">Akta cerai</dt>
              <dd className="font-medium">
                {status.putusan.aktaCerai?.nomor || (
                  <span className="text-muted-foreground">belum terbit</span>
                )}
              </dd>
            </div>
            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <dt className="text-xs text-muted-foreground">Upaya hukum</dt>
              <dd className="font-medium">
                {status.putusan.upayaHukum.length > 0
                  ? status.putusan.upayaHukum.map((x) => x.jenis).join(", ")
                  : "tidak ada"}
              </dd>
            </div>
          </dl>
        </Bagian>
      ) : null}

      {/* ==================================================================
          IKRAR TALAK
          ==================================================================

          Pada cerai talak, putusan hanya MEMBERI IZIN pemohon mengucapkan
          ikrar. Perceraiannya baru terjadi saat ikrar itu diucapkan di depan
          sidang - dan bila tidak diucapkan dalam enam bulan, putusannya
          kehilangan kekuatan.

          Karena itu sidang ikrar punya penetapan majelis, panitera pengganti,
          dan juru sitanya sendiri. */}
      {status.ikrarTalak.ada ? (
        <Bagian
          judul="Ikrar talak"
          kunci="ikrar"
          keterangan={status.ikrarTalak.status || ""}
        >
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {status.ikrarTalak.status ? (
              <Badge
                variant={
                  status.ikrarTalak.statusId === 1
                    ? "success"
                    : status.ikrarTalak.statusId === 3
                      ? "muted"
                      : "warning"
                }
              >
                {status.ikrarTalak.status}
              </Badge>
            ) : null}
            {!status.ikrarTalak.sudahDiucapkan ? (
              <Badge variant="warning">ikrar belum diucapkan</Badge>
            ) : null}
            {status.ikrarTalak.adaBerkas && status.ikrarTalak.ikrarId ? (
              <TombolUnduh
                alamat={`/api/aleta-ecourt/berkas-sipp?jenis=ikrar-talak&id=${encodeURIComponent(
                  status.ikrarTalak.ikrarId
                )}`}
                label="Unduh penetapan"
                namaCadangan={`ikrar-talak-${status.identitas.nomorPerkara}.pdf`}
              />
            ) : null}
          </div>

          <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Penetapan majelis hakim</dt>
              <dd className="font-medium">{status.ikrarTalak.penetapanMajelis || "—"}</dd>
              {/* Teks borang SIPP berpemisah </br> - dipecah per baris, bukan
                  ditulis mentah (lihat barisTeksSipp). */}
              {status.ikrarTalak.majelis ? <TeksBerbaris teks={status.ikrarTalak.majelis} /> : null}
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Penunjukan panitera pengganti</dt>
              <dd className="font-medium">{status.ikrarTalak.penetapanPp || "—"}</dd>
              {status.ikrarTalak.panitera ? <TeksBerbaris teks={status.ikrarTalak.panitera} /> : null}
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Penunjukan juru sita</dt>
              <dd className="font-medium">{status.ikrarTalak.penetapanJs || "—"}</dd>
              {status.ikrarTalak.jurusita ? <TeksBerbaris teks={status.ikrarTalak.jurusita} /> : null}
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Penetapan sidang ikrar talak</dt>
              <dd className="font-medium">{status.ikrarTalak.penetapanSidang || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Tanggal ikrar talak</dt>
              <dd className="font-medium">
                {status.ikrarTalak.tanggalIkrar || (
                  <span className="text-amber-700 dark:text-amber-300">belum diucapkan</span>
                )}
              </dd>
            </div>
            {status.ikrarTalak.nomorSk ? (
              <div>
                <dt className="text-xs text-muted-foreground">Nomor penetapan</dt>
                <dd>{status.ikrarTalak.nomorSk}</dd>
              </div>
            ) : null}
          </dl>

          {/* Amar penetapan ikrar - ditampilkan sebagai teks, bukan dirender. */}
          {status.ikrarTalak.amar ? (
            <details className="mt-2 rounded-md border bg-muted/20 p-2">
              <summary className="cursor-pointer text-sm font-semibold">
                Amar penetapan ikrar talak
              </summary>
              <div className="mt-1.5 max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
                {status.ikrarTalak.amar
                  .replace(/<li>/gi, "\n• ")
                  .replace(/<\/(p|div|li|ol|ul)>/gi, "\n")
                  .replace(/<[^>]*>/g, " ")
                  .replace(/[ \t]+/g, " ")
                  .replace(/\n{3,}/g, "\n\n")
                  .trim()}
              </div>
            </details>
          ) : null}
        </Bagian>
      ) : null}

      {/* ==================================================================
          UPAYA HUKUM
          ==================================================================

          Dipisah per tingkat - banding, kasasi, peninjauan kembali - karena
          ketiganya perkara yang berbeda dengan nomor sendiri, dan mencampur
          tahapannya dalam satu tabel membuat "pemberitahuan putusan" muncul
          tiga kali tanpa keterangan itu putusan yang mana.

          Di dalam tiap tingkat, tahapannya disusun menurut urutan acara -
          permohonan, pemberitahuan, memori, kontra memori, inzage, pengiriman
          berkas, putusan, salinan, pemberitahuan putusan - dan yang BELUM
          terjadi tetap disebut. Justru itulah yang dicari saat berkas
          diperiksa: mana yang belum dikerjakan. */}
      {/* Pada perkara yang SUDAH PUTUS, ketiadaan upaya hukum disebutkan
          apa adanya - bukan dengan menghilangkan bagiannya. Bagian yang hilang
          tidak dapat membedakan "tidak ada banding" dari "tabel bandingnya
          tidak terbaca", dan keduanya menuntut tindakan yang berbeda. */}
      {status.upayaHukum.length === 0 && status.putusan?.sudahPutus ? (
        <Bagian judul="Upaya hukum" kunci="upaya" ciutBawaan>
          <p className="text-sm text-muted-foreground">
            Tidak ada banding, kasasi, maupun peninjauan kembali yang tercatat
            untuk perkara ini.
          </p>
        </Bagian>
      ) : null}

      {status.upayaHukum.length > 0 ? (
        <Bagian
          judul="Upaya hukum"
          kunci="upaya"
          keterangan={status.upayaHukum.map((x) => x.jenis).join(", ")}
        >
          <div className="space-y-3">
            {status.upayaHukum.map((upaya, urutan) => {
              const sudah = upaya.tahapan.filter((t) => t.tanggal).length;
              const dapatDibaca = upaya.tahapan.filter((t) => t.adaKolom).length;
              return (
                <div
                  key={`${upaya.sebutan}-${urutan}`}
                  className="rounded-lg border bg-muted/20 p-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-1.5">
                    <h4 className="text-sm font-semibold">
                      {upaya.jenis}
                      {upaya.nomorPerkara ? (
                        <span className="ml-2 font-normal text-muted-foreground">
                          {upaya.nomorPerkara}
                        </span>
                      ) : null}
                    </h4>
                    <span className="text-xs text-muted-foreground">
                      {upaya.dicabut
                        ? "dicabut"
                        : upaya.gugur
                          ? "gugur"
                          : upaya.tanggalPutusan
                            ? `diputus ${tanggalHariPendek(upaya.tanggalPutusan, upaya.tanggalPutusan)}`
                            : upaya.keterangan.keadaan || "belum diputus"}
                      {dapatDibaca > 0 ? ` \u00b7 ${sudah}/${dapatDibaca} tahap` : ""}
                    </span>
                  </div>

                  {/* Keterangan yang bukan tanggal. Hanya yang terisi -
                      deretan label bergaris tidak menolong siapa pun. */}
                  {[
                    ["Diajukan oleh", upaya.keterangan.pemohon],
                    ["Status putusan", upaya.keterangan.statusPutusan],
                    ["Keadaan berkas", upaya.keterangan.keadaan],
                    ["Majelis hakim", upaya.keterangan.majelis],
                    ["Panitera pengganti", upaya.keterangan.paniteraPengganti],
                    ["Catatan", upaya.keterangan.catatan],
                  ].some(([, nilai]) => nilai) ? (
                    <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                      {(
                        [
                          ["Diajukan oleh", upaya.keterangan.pemohon],
                          ["Status putusan", upaya.keterangan.statusPutusan],
                          ["Keadaan berkas", upaya.keterangan.keadaan],
                          ["Majelis hakim", upaya.keterangan.majelis],
                          ["Panitera pengganti", upaya.keterangan.paniteraPengganti],
                          ["Catatan", upaya.keterangan.catatan],
                        ] as Array<[string, string | undefined]>
                      )
                        .filter(([, nilai]) => nilai)
                        .map(([label, nilai]) => (
                          <div key={label}>
                            <dt className="text-xs text-muted-foreground">{label}</dt>
                            <dd>{nilai}</dd>
                          </div>
                        ))}
                    </dl>
                  ) : null}
                  <ol className="mt-2 space-y-0.5 text-sm">
                    {upaya.tahapan.map((tahap) => (
                      <li
                        key={tahap.kunci}
                        className="flex flex-wrap items-baseline justify-between gap-2 border-b border-dashed py-0.5 last:border-0"
                      >
                        <span className={tahap.tanggal ? "" : "text-muted-foreground"}>
                          {tahap.label}
                        </span>
                        {tahap.tanggal ? (
                          <span className="shrink-0">{tanggalHariPendek(tahap.tanggal, tahap.tanggal)}</span>
                        ) : tahap.adaKolom ? (
                          <span className="shrink-0 text-sm text-amber-700 dark:text-amber-400">
                            belum
                          </span>
                        ) : (
                          // Tidak sama dengan "belum": kolomnya memang tidak
                          // ada pada SIPP versi ini, jadi tidak ada yang
                          // perlu ditagih kepada siapa pun.
                          <span
                            className="shrink-0 text-sm text-muted-foreground"
                            title="Kolom untuk tahap ini tidak ada pada SIPP versi ini."
                          >
                            tidak tersedia
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>

                  {upaya.keterangan.amar ? (
                    <details className="mt-2 rounded-md border bg-background p-2">
                      <summary className="cursor-pointer text-sm font-semibold">
                        Amar putusan {upaya.jenis.toLowerCase()}
                      </summary>
                      {/* Teks dari basis data ditampilkan sebagai teks, tidak
                          dirender sebagai markup. */}
                      <div className="mt-1.5 max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
                        {upaya.keterangan.amar
                          .replace(/<li>/gi, "\n\u2022 ")
                          .replace(/<\/(p|div|li|ol|ul)>/gi, "\n")
                          .replace(/<[^>]*>/g, " ")
                          .replace(/[ \t]+/g, " ")
                          .replace(/\n{3,}/g, "\n\n")
                          .trim()}
                      </div>
                    </details>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Nama kolom yang belum dikenali disebutkan berikut kolom yang
              benar-benar ada, supaya dapat dilengkapi tanpa membuka basis
              datanya. */}
          {status.upayaHukum.some((x) => x.tahapTakDikenali.length > 0) ? (
            <details className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-sm">
              <summary className="cursor-pointer font-medium text-amber-700 dark:text-amber-400">
                Sebagian tahap tidak tersedia pada SIPP versi ini
              </summary>
              <div className="mt-1.5 space-y-1.5">
                {status.upayaHukum
                  .filter((x) => x.tahapTakDikenali.length > 0)
                  .map((x, i) => (
                    <div key={`${x.sebutan}-tak-${i}`}>
                      <p className="font-medium">{x.jenis}</p>
                      <p className="text-muted-foreground">
                        Belum dikenali: {x.tahapTakDikenali.join(", ")}
                      </p>
                      {x.kolomTersedia.length > 0 ? (
                        <p className="text-muted-foreground">
                          Kolom yang ada: {x.kolomTersedia.join(", ")}
                        </p>
                      ) : null}
                    </div>
                  ))}
              </div>
            </details>
          ) : null}
        </Bagian>
      ) : null}

      {/* ==================================================================
          PUTUSAN DI E-COURT
          ==================================================================

          Putusan yang sudah dijatuhkan belum tentu terbit di e-Court, dan
          tiga hal dapat gagal berturut-turut tanpa satu pun peringatan:
          barisnya tidak terbentuk, salinannya belum diunggah, atau Panitera
          belum menandatanganinya.

          Ketiganya baru ketahuan saat para pihak datang menanyakan salinan
          putusannya - kerap berminggu-minggu sesudahnya. Bagian ini muncul
          pada setiap perkara yang sudah putus, bukan hanya saat bermasalah:
          "sudah lengkap" pun perlu terlihat, supaya diamnya bagian ini tidak
          disalahartikan sebagai belum diperiksa. */}
      {status.putusanEcourt ? (
        <Bagian
          judul="Putusan di e-Court"
          kunci="putusanEcourt"
          keterangan={status.putusanEcourt.sebutan}
        >
          <div
            className={`mb-2 rounded-md border px-3 py-2 text-sm ${
              status.putusanEcourt.keadaan === "putusan_ecourt_error"
                ? "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300"
                : status.putusanEcourt.perluTindakan
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                  : "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
            }`}
          >
            <p className="font-semibold">{status.putusanEcourt.sebutan}</p>
            {status.putusanEcourt.keterangan ? (
              <p className="mt-0.5 text-sm">{status.putusanEcourt.keterangan}</p>
            ) : null}
          </div>

          {status.putusanEcourt.ecourt ? (
            <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {status.putusanEcourt.ecourt.nomorPutusan ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Nomor putusan di e-Court</dt>
                  <dd>{status.putusanEcourt.ecourt.nomorPutusan}</dd>
                </div>
              ) : null}
              {status.putusanEcourt.ecourt.tanggalPutusanTeks ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Tanggal putusan</dt>
                  <dd>{status.putusanEcourt.ecourt.tanggalPutusanTeks}</dd>
                </div>
              ) : null}
              {status.putusanEcourt.ecourt.tanggalBhtTeks ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Tanggal BHT</dt>
                  <dd>{status.putusanEcourt.ecourt.tanggalBhtTeks}</dd>
                </div>
              ) : null}

              <div>
                <dt className="text-xs text-muted-foreground">Dokumen salinan putusan</dt>
                <dd
                  className={
                    status.putusanEcourt.ecourt.dokumenAda
                      ? ""
                      : "text-amber-700 dark:text-amber-400"
                  }
                >
                  {status.putusanEcourt.ecourt.dokumenAda
                    ? status.putusanEcourt.ecourt.dokumenJudul || "sudah diunggah"
                    : "belum diunggah"}
                </dd>
              </div>

              {/* Siapa yang mengunggah dan kapan - dua pertanyaan yang selalu
                  menyusul begitu salinannya dipersoalkan. */}
              <div>
                <dt className="text-xs text-muted-foreground">Diupload oleh</dt>
                <dd className={status.putusanEcourt.ecourt.diunggahOleh ? "" : "text-muted-foreground"}>
                  {status.putusanEcourt.ecourt.diunggahOleh || "\u2014"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Tanggal upload</dt>
                <dd
                  className={
                    status.putusanEcourt.ecourt.tanggalUnggahTeks ? "" : "text-muted-foreground"
                  }
                >
                  {status.putusanEcourt.ecourt.tanggalUnggahTeks || "\u2014"}
                </dd>
              </div>

              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Panitera</dt>
                <dd>
                  {status.putusanEcourt.ecourt.paniteraNama || "\u2014"}
                  {status.putusanEcourt.ecourt.paniteraTte ? (
                    <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      Sudah di-TTE oleh Panitera
                      {status.putusanEcourt.ecourt.paniteraTanggalTte
                        ? ` \u00b7 ${status.putusanEcourt.ecourt.paniteraTanggalTte}`
                        : ""}
                    </span>
                  ) : (
                    <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-sm font-medium text-amber-800 dark:text-amber-300">
                      Belum TTE oleh Panitera
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              Keadaan e-Court untuk perkara ini belum pernah dibaca ALETA. Jalankan penarikan
              e-Court lebih dulu.
            </p>
          )}

          {status.putusanEcourt.ecourt && status.putusanEcourt.ecourt.diperiksaPada ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Keadaan ini menurut penarikan e-Court terakhir. Yang berubah sesudahnya belum
              terbaca di sini.
            </p>
          ) : null}
        </Bagian>
      ) : null}

      {/* ==================================================================
          AKSI e-COURT (perbaikan 1 Okt 2026, E9-E11; kontrak K5)
          ==================================================================

          Dokumen e-litigasi (unduh, verifikasi majelis lewat sesi e-Court
          hakim sendiri), TTE salinan putusan oleh panitera lewat sesi
          e-Court panitera sendiri, dan lencana belum diunggah / belum TTE.
          Komponennya sama dengan yang dipasang di rincian Jadwal Sidang. */}
      <Bagian judul="Aksi e-Court" kunci="ecourtAksi">
        <EcourtAksiPerkara
          nomorPerkara={status.identitas.nomorPerkara}
          perkaraId={status.identitas.perkaraId}
          konteks="status"
        />
      </Bagian>

      <Bagian
        judul="Arsip berkas"
        kunci="arsip"
        keterangan={status.arsipKeterangan.sudahDiarsipkan ? "sudah diarsipkan" : ""}
      >
        {!status.arsipKeterangan.terbaca ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">{status.arsipKeterangan.alasan}</p>
        ) : !status.arsipKeterangan.sudahDiarsipkan ? (
          <p className="text-sm text-muted-foreground">Berkas perkara ini belum diarsipkan.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {status.arsipKeterangan.baris.map((x, urutan) => (
              <li key={`arsip-${urutan}`} className="rounded-md border bg-muted/20 px-2.5 py-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{x.nomor || "tanpa nomor box"}</span>
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>
                      diinput {tanggalHariPendek(x.tanggalInput, x.tanggalInput || "—")}
                      {x.oleh ? ` oleh ${x.oleh}` : ""}
                    </span>
                    {/* ====================================================
                        TOMBOL INI TIDAK PERNAH MUNCUL SEKALI PUN
                        ====================================================

                        adaBerkas dulu dibaca dari kolom arsip yang TIDAK ADA
                        pada SIPP, jadi nilainya selalu salah untuk seluruh
                        perkara. Sekarang ia dijawab berkas sistem: 4.128 PDF
                        sebesar 32 GB memang ada di dokumen_arsip.

                        Besar berkasnya disebutkan sebab arsip perkara berkisar
                        2 MB sampai 28 MB - selisih yang menentukan apakah
                        seseorang mengunduhnya sekarang atau menunggu. */}
                    {x.adaBerkas && x.arsipId ? (
                      <>
                        {x.berkasBesar ? (
                          <span className="text-xs text-muted-foreground">
                            {(x.berkasBesar / 1024 / 1024).toFixed(1)} MB
                            {x.berkasDiubah ? ` · ${x.berkasDiubah}` : ""}
                          </span>
                        ) : null}
                        <TombolUnduh
                          alamat={`/api/aleta-ecourt/berkas-sipp?jenis=arsip&id=${encodeURIComponent(
                            x.arsipId
                          )}`}
                          label="Unduh"
                          namaCadangan={`arsip-${status.identitas.nomorPerkara}.pdf`}
                        />
                      </>
                    ) : (
                      <Badge variant="muted">berkas pindaian belum ada</Badge>
                    )}
                  </span>
                </div>
                {/* ============================================================
                    DI MANA BERKAS FISIKNYA
                    ============================================================

                    Inilah isi sebenarnya tabel arsip SIPP, dan sebelumnya
                    tidak satu pun ditampilkan - padahal SELURUH baris arsip
                    di pengadilan ini punya keterangan letaknya. Yang tampil
                    hanya nomor arsip dan tanggal input, sehingga bagian ini
                    terbaca seperti daftar berkas yang gagal dimuat. */}
                {x.ruang || x.lemari || x.rak || x.box ? (
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm">
                    {x.ruang ? (
                      <span>
                        <span className="text-muted-foreground">Ruang</span> {x.ruang}
                      </span>
                    ) : null}
                    {x.lemari ? (
                      <span>
                        <span className="text-muted-foreground">Lemari</span> {x.lemari}
                      </span>
                    ) : null}
                    {x.rak ? (
                      <span>
                        <span className="text-muted-foreground">Rak</span> {x.rak}
                      </span>
                    ) : null}
                    {x.box ? (
                      <span>
                        <span className="text-muted-foreground">Box</span> {x.box}
                      </span>
                    ) : null}
                  </p>
                ) : null}

                {x.tanggalMasuk || x.penerima ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {x.tanggalMasuk ? `Masuk arsip ${tanggalHariPendek(x.tanggalMasuk, x.tanggalMasuk)}` : ""}
                    {x.penerima ? ` \u00b7 diterima ${x.penerima}` : ""}
                    {x.lengkap === false ? " \u00b7 berkas dinyatakan belum lengkap" : ""}
                  </p>
                ) : null}

                {/* Berkas yang sedang dipinjam TIDAK ada di raknya. Itu yang
                    perlu diketahui sebelum orang berjalan ke ruang arsip. */}
                {x.pinjam && x.pinjam.sedangDipinjam ? (
                  <p className="mt-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    Sedang dipinjam
                    {x.pinjam.peminjam ? ` oleh ${x.pinjam.peminjam}` : ""}
                    {x.pinjam.tanggalPinjam
                      ? ` sejak ${tanggalHariPendek(x.pinjam.tanggalPinjam, x.pinjam.tanggalPinjam)}`
                      : ""}
                    {". Berkasnya tidak ada di raknya."}
                  </p>
                ) : null}

                {x.keterangan ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">{x.keterangan}</p>
                ) : null}

                {/* ============================================================
                    BERKAS YANG KETEMU DI LUAR LETAK SEMESTINYA
                    ============================================================

                    Letak arsip dapat disunting di SIPP, sedangkan berkas yang
                    sudah ditulis tetap di jalur lama - 307 berkas berkeadaan
                    begitu. ALETA tetap menemukannya lewat penelusuran nama,
                    dan tombol unduhnya tetap bekerja.

                    Tetapi menemukannya diam-diam berarti membiarkan letaknya
                    selamanya keliru. Karena itu disebutkan: yang membacanya
                    dapat membetulkan letak arsipnya di SIPP. */}
                {x.adaBerkas && x.berkasCara === "nama" && x.berkasCatatan ? (
                  <p className="mt-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    {x.berkasCatatan}
                  </p>
                ) : null}

                {!x.adaBerkas && x.berkasCatatan ? (
                  <p className="mt-1 text-sm text-muted-foreground">{x.berkasCatatan}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {/* ================================================================
            KETERANGAN LAMA DI SINI TERNYATA KELIRU
            ================================================================

            Kalimat sebelumnya menyatakan arsip SIPP "bukan tempat berkas
            digital, sehingga tidak ada yang dapat diunduh dari bagian ini".
            Kesimpulan itu diambil dari benarnya satu hal - tabel arsip memang
            tidak punya kolom dokumen - tetapi salah pada hal berikutnya.

            Berkas pindaiannya ADA: 4.128 PDF sebesar 32 GB di dokumen_arsip,
            disusun menurut letak fisiknya. Yang tidak ada hanyalah CATATANNYA
            di basis data, dan itu sebabnya jalurnya harus disusun sendiri.

            Yang tersisa untuk disebutkan di sini karena itu bukan lagi
            "tidak ada berkas digital", melainkan keadaan yang benar-benar
            menghalangi: folder arsipnya tidak terbaca dari container. */}
        {status.arsipKeterangan.sudahDiarsipkan && status.arsipKeterangan.berkasTerbaca === false ? (
          <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {status.arsipKeterangan.alasanBerkas ||
              "Folder arsip SIPP tidak terbaca dari ALETA, sehingga berkas pindaiannya tidak dapat disebut ada atau tidak."}
          </p>
        ) : null}

        {/* ================================================================
            ADA ATAU TIDAKNYA BERKAS PINDAIAN TIDAK MENGUBAH NILAI SK
            ================================================================

            SK 048/2024 Tabel 2 I.16 menilai JEDA PENGINPUTAN DATA arsip -
            berapa hari sesudah akta cerai atau BHT datanya diinput. Ia sama
            sekali tidak menyebut berkas pindaian.

            Karena itu keberadaan berkasnya ditampilkan sebagai keterangan,
            BUKAN sebagai pengurang nilai. Menjadikannya pengurang berarti
            menilai pengadilan dengan aturan yang tidak ada dalam SK - dan
            angka yang tidak dapat ditunjuk dasarnya tidak dapat dibantah
            oleh yang dinilai. Bila kelak dikehendaki ikut menentukan nilai,
            yang diperlukan lebih dahulu dasar hukumnya, bukan kodenya. */}
        {status.arsipKeterangan.sudahDiarsipkan ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Ada atau tidaknya berkas pindaian <strong>tidak</strong> memengaruhi nilai SK Tabel 2
            I.16 - yang dinilai di sana jeda penginputan datanya, bukan pindaiannya.
          </p>
        ) : null}
      </Bagian>

      {status.delegasiMasuk.baris.length > 0 || status.delegasiKeluar.baris.length > 0 ? (
        <Bagian judul="Delegasi" kunci="delegasi">
          {status.delegasiMasuk.baris.length > 0 ? (
            <div className="mb-2">
              <p className="mb-1 text-sm font-medium">Masuk - dilaksanakan pengadilan ini</p>
              <ul className="space-y-0.5 text-sm">
                {status.delegasiMasuk.baris.map((x, urutan) => (
                  <li key={`masuk-${urutan}`} className="flex flex-wrap gap-x-2">
                    <span className="font-medium">{x.asal || "tanpa keterangan asal"}</span>
                    <span className="text-muted-foreground">
                      diunggah {tanggalHariPendek(x.tanggalDiunggah, x.tanggalDiunggah || "—")},
                      diterima {tanggalHariPendek(x.tanggalDiterima, x.tanggalDiterima || "—")}
                      {x.hariSampaiTerima !== null ? ` (${x.hariSampaiTerima} hari)` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {status.delegasiKeluar.baris.length > 0 ? (
            <div>
              <p className="mb-1 text-sm font-medium">
                Keluar (tabayun) - diminta ke pengadilan lain
              </p>
              <ul className="space-y-0.5 text-sm">
                {status.delegasiKeluar.baris.map((x, urutan) => (
                  <li key={`keluar-${urutan}`} className="flex flex-wrap gap-x-2">
                    <span className="font-medium">{x.tujuan || "tanpa keterangan tujuan"}</span>
                    <span className="text-muted-foreground">
                      dimohon {tanggalHariPendek(x.tanggalPermohonan, x.tanggalPermohonan || "—")}
                      {x.tanggalSidang
                        ? `, untuk sidang ${tanggalHariPendek(x.tanggalSidang, x.tanggalSidang)}`
                        : ""}
                      {x.hariSebelumSidang !== null ? ` (${x.hariSebelumSidang} hari sebelumnya)` : ""}
                    </span>
                    {/* SK III.3: kurang dari 6 hari sebelum sidang mengurangi
                        nilai - relaasnya berisiko tidak sampai tepat waktu. */}
                    {x.panggilan && x.nilai !== null && x.nilai < 0 ? (
                      <span className="text-amber-700 dark:text-amber-300">nilai {x.nilai}</span>
                    ) : null}
                    {!x.panggilan ? (
                      <span className="text-muted-foreground">pemberitahuan - tidak dinilai</span>
                    ) : null}
                    {x.pelaksanaan && x.pelaksanaan.tanggalRelaas ? (
                      <span className="w-full text-muted-foreground">
                        relaas{" "}
                        {tanggalHariPendek(x.pelaksanaan.tanggalRelaas, x.pelaksanaan.tanggalRelaas)}
                        {x.pelaksanaan.jurusita ? ` oleh ${x.pelaksanaan.jurusita}` : ""}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Bagian>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {/* ==============================================================
            BERKAS
            ==============================================================

            Yang dicari orang di sini tiga hal: gugatan atau permohonannya,
            relaas panggilannya, dan berita acara sidangnya. Sebelumnya bagian
            ini hanya menghitung jumlah dokumen lalu menampilkan isi
            perkara_dokumen - berkas LAMPIRAN - dan ketiganya justru tidak ada
            di sana: gugatan pada kolom petitum perkara, relaas pada tabel
            relaas, BAS pada jadwal sidang.

            Susunannya disamakan dengan layar jadwal sidang supaya yang
            dicari ada di tempat yang sama pada kedua layar. */}
        <Bagian judul="Berkas" kunci="berkas">
          {/* Tombolnya TIDAK diulang di sini. Dua tombol yang mengerjakan hal
              yang sama membuat yang satu tampak berbeda dari yang lain, dan
              yang pertama ditekan belum tentu yang dimaksud. */}
          <p className="mb-2 text-xs text-muted-foreground">
            Seluruh berkas di bawah ini beserta data perkaranya dapat diunduh sekaligus lewat tombol{" "}
            <strong>Unduh seluruh perkara</strong> di kepala layar.
          </p>
          <div className="space-y-3">
            {/* --- Gugatan / permohonan --- */}
            <div>
              <p className="mb-1 text-sm font-semibold">Gugatan / permohonan</p>
              {status.petitum?.ada ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span>Surat gugatan/permohonan</span>
                  <TombolUnduh
                    alamat={`/api/aleta-ecourt/berkas-sipp?jenis=petitum&id=${encodeURIComponent(
                      status.identitas.perkaraId
                    )}`}
                    label="Unduh"
                    namaCadangan={`gugatan-${status.identitas.nomorPerkara}.pdf`}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Belum diunggah ke SIPP.</p>
              )}
            </div>

            {/* --- Relaas panggilan: hitungannya saja, rinciannya di bagian
                sendiri ---

                Daftarnya pernah digambar di sini JUGA. Dua daftar untuk satu
                data akan berselisih pada suntingan berikutnya - salah satunya
                diperbarui, yang lain tidak - dan tidak ada yang tahu mana yang
                usang. Yang tinggal di sini hitungannya; rincian beserta tombol
                unduhnya ada di bagian "Relaas panggilan", lengkap dengan
                sidang mana yang dipanggil. */}
            <div>
              <p className="mb-1 text-sm font-semibold">Relaas panggilan</p>
              {status.relaas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada relaas tercatat.</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {status.relaas.filter((x) => x.adaDokumen).length} dari {status.relaas.length}{" "}
                  relaas sudah berdokumen
                  {status.relaas.filter((x) => x.adaResi).length > 0
                    ? `, ${status.relaas.filter((x) => x.adaResi).length} berresi pos`
                    : ""}
                  . Rincian dan unduhannya ada di bagian <strong>Relaas panggilan</strong>.
                </p>
              )}
            </div>

            {/* --- Berita acara sidang --- */}
            <div>
              <p className="mb-1 text-sm font-semibold">
                Berita Acara Sidang
                {status.jadwal.length > 0 ? (
                  <span className="ml-1 font-normal text-muted-foreground">
                    ({status.jadwal.filter((x) => x.adaBas).length} dari {status.jadwal.length} sidang)
                  </span>
                ) : null}
              </p>
              {status.jadwal.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada sidang tercatat.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {jadwalUrut.map((sidang) => (
                    <li key={sidang.sidangId} className="flex flex-wrap items-center gap-2">
                      {/* Sidang keberapa - angka yang sama dengan Perjalanan
                          sidang dan dengan daftar BAS di Antrian Sidang. */}
                      <NomorSidang urutan={sidang.urutanSidang} />
                      <span className="min-w-0 flex-1 truncate">
                        {tanggalHariPendek(sidang.tanggalSidang, sidang.tanggalSidang)}
                        <span className="ml-1 text-sm text-muted-foreground">
                          {sidang.agenda || "tanpa agenda"}
                        </span>
                      </span>
                      {sidang.adaBas ? (
                        <TombolUnduh
                          alamat={`/api/aleta-ecourt/berkas-sipp?jenis=bas&id=${encodeURIComponent(
                            sidang.sidangId
                          )}`}
                          label="BAS"
                          namaCadangan={`bas-${status.identitas.nomorPerkara}-${sidang.tanggalSidang}.pdf`}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">BAS belum diunggah</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* --- Putusan --- */}
            {status.putusan?.adaBerkasPutusan || status.putusan?.adaBerkasAnonim ? (
              <div>
                <p className="mb-1 text-sm font-semibold">Putusan</p>
                <div className="flex flex-wrap gap-2">
                  {status.putusan?.adaBerkasPutusan ? (
                    <TombolUnduh
                      alamat={`/api/aleta-ecourt/berkas-sipp?jenis=putusan&id=${encodeURIComponent(
                        status.identitas.perkaraId
                      )}`}
                      label="Unduh putusan"
                      namaCadangan={`putusan-${status.identitas.nomorPerkara}.pdf`}
                    />
                  ) : null}
                  {status.putusan?.adaBerkasAnonim ? (
                    <TombolUnduh
                      alamat={`/api/aleta-ecourt/berkas-sipp?jenis=putusan-anonim&id=${encodeURIComponent(
                        status.identitas.perkaraId
                      )}`}
                      label="Unduh putusan anonim"
                      namaCadangan={`putusan-anonim-${status.identitas.nomorPerkara}.pdf`}
                    />
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* --- Lampiran lain --- */}
            <div>
              <p className="mb-1 text-sm font-semibold">
                Lampiran lain
                <span className="ml-1 font-normal text-muted-foreground">
                  ({status.dokumenSipp.length} dari SIPP, {status.dokumenEcourt.length} dari e-Court
                  {status.dokumenEcourt.length > 0
                    ? `, ${status.dokumenEcourt.filter((d) => d.statusVerifikasi === "belum").length} menunggu majelis`
                    : ""}
                  )
                </span>
              </p>
              {status.dokumenSipp.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada lampiran SIPP.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {status.dokumenSipp.map((dokumen) => (
                    <li
                      key={dokumen.id}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="min-w-0 flex-1 truncate" title={dokumen.namaDokumen}>
                        {dokumen.namaDokumen}
                      </span>
                      <TombolUnduh
                        alamat={`/api/aleta-ecourt/berkas-sipp?jenis=dokumen&id=${encodeURIComponent(
                          dokumen.id
                        )}`}
                        label="Unduh"
                        namaCadangan={dokumen.namaDokumen || "dokumen.pdf"}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="text-sm">
              <span className="text-xs text-muted-foreground">Keterangan saksi: </span>
              {status.saksi.ada
                ? `${status.saksi.jumlahSaksi} saksi, ${status.saksi.jumlahKeterangan} keterangan`
                : "belum ada"}
            </p>
          </div>
        </Bagian>
        <Bagian judul="Biaya perkara" kunci="biaya">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Panjar masuk</dt>
              <dd className="tabular-nums">{rupiah(status.biaya.panjar)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Terpakai</dt>
              <dd className="tabular-nums">{rupiah(status.biaya.terpakai)}</dd>
            </div>
            <div className="flex justify-between border-t pt-1 font-medium">
              <dt>Sisa</dt>
              <dd className="tabular-nums">{rupiah(status.biaya.sisa)}</dd>
            </div>
          </dl>
          {/* Rinciannya - "terpakai Rp 179.500" tidak memberi tahu untuk apa,
              dan justru rincian itulah yang ditanya kasir dan para pihak. */}
          {status.biaya.rincian.length > 0 ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">
                Rincian {status.biaya.rincian.length} transaksi
              </summary>
              <ul className="mt-1 space-y-0.5">
                {status.biaya.rincian.map((x, urutan) => (
                  <li key={`biaya-${urutan}`} className="flex justify-between gap-2 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="text-muted-foreground">
                        {tanggalHariPendek(x.tanggal, x.tanggal || "—")}{" "}
                      </span>
                      {x.uraian || (x.jenis === "masuk" ? "Penerimaan" : "Pengeluaran")}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 tabular-nums",
                        x.jenis === "masuk" ? "text-emerald-600" : "text-muted-foreground"
                      )}
                    >
                      {x.jenis === "masuk" ? "+" : "−"}
                      {rupiah(x.jumlah)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {status.biaya.sisa < 0 ? (
            <p className="mt-1 text-sm text-rose-600">
              Pengeluaran melebihi panjar — perlu tambah panjar.
            </p>
          ) : null}

          {/* ================================================================
              KE MANA PANJARNYA PERGI
              ================================================================

              "Terpakai Rp 179.500" tidak memberi tahu untuk apa, dan rincian
              transaksinya berupa daftar di balik menu lipat. Pai menjawab
              komposisinya sekali lihat - dan komposisi memang satu-satunya
              pertanyaan yang pantas dijawab pai.

              HANYA PENGELUARAN. Mencampur penerimaan dan pengeluaran dalam
              satu pai berarti menjumlahkan uang masuk dengan uang keluar
              seolah keduanya bagian dari satu keseluruhan - padahal yang satu
              justru sumber yang satunya.

              URAIAN ADALAH TEKS BEBAS di SIPP, dan itu disebutkan apa adanya
              di bawah gambarnya. Pada satu perkara jumlah barisnya sedikit
              sehingga masih terbaca, tetapi dua tulisan yang maksudnya sama
              dengan ejaan berbeda akan tergambar sebagai dua irisan - dan yang
              membacanya berhak tahu itu sebelum menyimpulkan apa pun.

              Irisan di luar enam terbesar disatukan penggambarnya menjadi
              "Lainnya", beserta jumlah yang disatukannya. */}
          {(() => {
            const keluar = status.biaya.rincian.filter(
              (x) => x.jenis === "keluar" && x.jumlah > 0
            );
            // Satu irisan bukan komposisi - ia lingkaran penuh yang tidak
            // membandingkan apa pun.
            if (keluar.length < 2) return null;

            // Uraian yang sama digabung lebih dulu. Tanpa ini, dua panggilan
            // pada tanggal berbeda tergambar sebagai dua irisan terpisah
            // padahal keduanya biaya yang sama.
            const perUraian = new Map<string, number>();
            for (const baris of keluar) {
              const nama = baris.uraian || "Pengeluaran tanpa uraian";
              perUraian.set(nama, (perUraian.get(nama) || 0) + baris.jumlah);
            }

            const titik: TitikData[] = Array.from(perUraian.entries())
              .map(([label, nilai]) => ({ label, nilai }))
              .sort((a, b) => (b.nilai as number) - (a.nilai as number));

            return (
              <div className="mt-3">
                <DiagramPai
                  data={titik}
                  judul={`Komposisi pengeluaran — ${rupiah(status.biaya.terpakai)}`}
                  maksIrisan={6}
                />
                <p className="mt-1 text-sm text-muted-foreground">
                  Uraian biaya adalah teks bebas di SIPP. Dua tulisan yang maksudnya sama
                  dengan ejaan berbeda tergambar sebagai dua irisan.
                </p>
              </div>
            );
          })()}
        </Bagian>
      </div>
      {/* --- Penilaian --- */}
      <Bagian judul="Penilaian kelengkapan perkara" kunci="rubrik" ciutBawaan>
        <div className="space-y-1.5">
          {status.penilaian.rinci.map((butir) => (
            <div key={butir.kunci} className="flex flex-wrap items-center gap-2 text-sm">
              <div className="min-w-[13rem] flex-1">
                <span className="font-medium">{butir.label}</span>
                <div className="text-sm text-muted-foreground">{butir.catatan}</div>
              </div>

              <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                {/* Butir yang belum waktunya dibiarkan KOSONG, bukan merah.
                    Batang merah penuh untuk perkara yang belum diputus akan
                    dibaca sebagai kelalaian atas pekerjaan yang belum jatuh
                    tempo - dan papan yang selalu merah berhenti dibaca. */}
                {butir.belumBerlaku ? null : (
                  <div
                    className={cn(
                      "h-full rounded-full",
                      butir.bagian >= 0.85
                        ? "bg-emerald-500"
                        : butir.bagian >= 0.5
                          ? "bg-amber-500"
                          : "bg-rose-500"
                    )}
                    style={{ width: `${Math.round(butir.bagian * 100)}%` }}
                  />
                )}
              </div>

              <span className="w-20 text-right text-sm tabular-nums text-muted-foreground">
                {butir.belumBerlaku ? "belum waktunya" : `${butir.nilai} / ${butir.bobot}`}
              </span>
            </div>
          ))}
        </div>

        {/* Batasnya disebutkan di layar, bukan disembunyikan. */}
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
          {status.penilaian.catatan} Butir bertanda &quot;belum waktunya&quot; - sidang belum ada yang
          berlalu, perkara belum diputus - tidak ikut membagi nilai, sehingga perkara yang baru
          berjalan dinilai atas apa yang sudah menjadi kewajibannya. Bobot dan ambangnya diubah di
          menu Integrasi e-Court.
        </p>
      </Bagian>

      {/* ==================================================================
          PENILAIAN MENURUT SK - terpisah dari rubrik ALETA di atas
          ==================================================================

          Poin yang ditampilkan poin SATU PERKARA menurut Tabel 2 SK. Nilai
          akhir SK dihitung atas seluruh perkara putus satu satuan kerja,
          bukan atas satu perkara - karena itu di sini tidak ada persentase
          maupun predikat bintang, supaya tidak dikira nilai satker. */}
      <Bagian judul="Penilaian SIPP menurut SK Dirjen Badilag 048/2024" kunci="sk" ciutBawaan>
        <div className="space-y-3">
          {ASPEK_SK.map((aspek) => {
            const unsur = status.penilaianSk.rinci.filter((x) => x.aspek === aspek.kunci);
            if (unsur.length === 0) return null;
            return (
              <div key={aspek.kunci} className="rounded-lg border bg-card p-3">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h4 className="text-sm font-semibold">{aspek.label}</h4>
                  <span className="text-sm tabular-nums text-muted-foreground">bobot {aspek.bobot}</span>
                </div>
                <ul className="space-y-1">
                  {unsur.map((x) => (
                    <li key={x.kunci} className="flex flex-wrap items-baseline gap-2 text-sm">
                      <div className="min-w-[14rem] flex-1">
                        <span className={cn(!x.terbaca && "text-muted-foreground")} title={x.dasar}>
                          {x.label}
                        </span>
                        <div className="text-sm text-muted-foreground">{x.catatan}</div>
                      </div>
                      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                        bobot {x.bobot}%
                      </span>
                      {x.terbaca ? (
                        <span
                          className={cn(
                            "w-16 shrink-0 rounded px-1.5 py-0.5 text-right text-sm font-semibold tabular-nums",
                            x.pengurang
                              ? (x.poin ?? 0) === 0
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200"
                              : (x.poin ?? 0) >= 5
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200"
                                : (x.poin ?? 0) >= 2
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200"
                                  : "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200"
                          )}
                        >
                          {x.poin} / {x.pengurang ? 0 : 5}
                        </span>
                      ) : (
                        <span className="w-16 shrink-0 text-right text-sm text-muted-foreground">belum</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="mt-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200">
          {status.penilaianSk.catatan} Dasar: {status.penilaianSk.dasar}
        </p>

        {/* Dari mana angka-angka yang tidak punya kolom resminya sendiri
            berasal. Nilai yang datang dari catatan pengadilan dan nilai yang
            ditelusuri dari jejak audit tidak boleh tampak sama. */}
        <ul className="mt-2 space-y-0.5 text-sm text-muted-foreground">
          {status.nilaiRelaas.sumber ? (
            <li>
              Nilai relaas dari: <span className="font-medium">{status.nilaiRelaas.sumber}</span>
              {status.nilaiRelaas.dariAudit ? (
                <span className="ml-1 text-amber-700 dark:text-amber-300">
                  (ditelusuri dari jejak audit, bukan kolom resmi)
                </span>
              ) : null}
            </li>
          ) : status.nilaiRelaas.alasan ? (
            <li className="text-amber-700 dark:text-amber-300">{status.nilaiRelaas.alasan}</li>
          ) : null}
          {status.durasiMediasi.terbaca && status.durasiMediasi.hari > 0 ? (
            <li>
              Waktu putus dikurangi{" "}
              <span className="font-medium">{status.durasiMediasi.hari} hari mediasi</span>.
            </li>
          ) : null}
          {status.penetapanKembali.adaPenggantian ? (
            <li>Penetapan pertama yang dinilai - penetapan kembali tidak dihitung.</li>
          ) : null}
        </ul>

        {status.penilaianSk.unsurBelumTersambung.length > 0 ? (
          <details className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            <summary className="cursor-pointer font-semibold">
              {status.penilaianSk.unsurBelumTersambung.length} unsur belum dapat dinilai
            </summary>
            <ul className="mt-1.5 space-y-0.5">
              {status.penilaianSk.unsurBelumTersambung.map((x) => (
                <li key={x.kunci}>
                  <span className="font-medium">{x.label}</span> - {x.catatan}
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {/* ==================================================================
            EMPAT ASPEK, DIBANDINGKAN
            ==================================================================

            Unsurnya sudah terdaftar per aspek di atas, tetapi ASPEKNYA sendiri
            tidak pernah dibandingkan - padahal itulah bentuk nilai SK: empat
            aspek berbobot 50, 40, dan 10 persen, dan yang menentukan nilai
            akhir adalah aspek mana yang jatuh.

            Yang digambar POIN YANG DIPEROLEH, bukan persentasenya. Persentase
            dari penyebut yang berbeda-beda tidak sebanding antaraspek, dan
            menggambarnya berdampingan membuat aspek berbobot 10 persen tampak
            sederajat dengan yang berbobot 50.

            Unsur yang BELUM TERBACA tidak dihitung nol - ia tidak dihitung
            sama sekali, dan jumlahnya disebutkan di bawah gambar. Menghitung
            yang belum terbaca sebagai nol menuduh pengadilan atas data yang
            justru belum dapat dibaca ALETA. */}
        {(() => {
          const titik: TitikData[] = [];
          let belumTerbaca = 0;

          for (const aspek of ASPEK_SK) {
            const unsur = status.penilaianSk.rinci.filter((x) => x.aspek === aspek.kunci);
            const terbaca = unsur.filter((x) => x.terbaca && x.poin !== null);
            belumTerbaca += unsur.length - terbaca.length;
            if (terbaca.length === 0) continue;
            titik.push({
              label: `${aspek.label} (${aspek.bobot})`,
              nilai: terbaca.reduce((jumlah, x) => jumlah + (x.poin ?? 0), 0),
              keterangan: `${terbaca.length} dari ${unsur.length} unsur terbaca`,
            });
          }

          if (titik.length < 2) return null;

          return (
            <div className="mt-3">
              <DiagramBatang data={titik} judul="Poin yang diperoleh tiap aspek" satuan="poin" />
              {belumTerbaca > 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {belumTerbaca} unsur belum terbaca dan tidak ikut dihitung - bukan dihitung
                  nol.
                </p>
              ) : null}
            </div>
          );
        })()}
      </Bagian>

      {/* ====================================================================
          ANALISA PERKARA
          ====================================================================

          Ditaruh paling bawah dan melebar penuh, bukan di dalam kisi dua
          kolom: garis waktunya perlu lebar, dan yang membacanya biasanya sudah
          melewati seluruh angka di atas lalu bertanya "jadi kenapa perkara ini
          begini". Itu pertanyaan penutup, dan tempatnya memang di penutup.

          Ringkasan diletakkan PALING ATAS di antara keempatnya. Untuk petugas
          yang punya sepuluh detik, kalimatlah yang terbaca; gambarnya dibuka
          kalau kalimatnya bikin penasaran. */}
      {/* ==================================================================
          ANALISIS LANJUTAN - DIMUAT SAAT DIMINTA
          ==================================================================

          Berbeda dari bagian Analisa perkara di bawahnya, yang disusun dari
          data yang SUDAH ada di layar ini tanpa pembacaan tambahan. Yang di
          sini membaca SIPP lagi - sebagian mengagregasi seluruh register -
          jadi tidak satu pun berjalan sampai tombolnya ditekan. */}
      <Bagian
        judul="Analisis lanjutan"
        kunci="analisa-lanjut"
        keterangan="Empat puluh satu analisis; masing-masing dihitung hanya saat ditekan."
        ciutBawaan
      >
        {/* ==============================================================
            LAYAR PENILAIAN YANG BERDIRI SENDIRI
            ==============================================================

            Keempat puluh satu analisis di bawah menjawab pertanyaan tentang
            PERKARA atau tentang PENGADILAN. Dua pertanyaan yang kerap
            ditanyakan dari sini justru tentang ORANG dan tentang TEMPAT, dan
            keduanya punya layarnya sendiri - tidak muncul di beranda, hanya di
            menu samping, sehingga yang mencarinya dari sini menyimpulkan
            layarnya tidak ada.

            Ditaruh di kepala bagian ini, bukan di ujung bawah: yang membuka
            "Analisis lanjutan" sedang mencari jawaban, dan daftar empat puluh
            satu tombol adalah tempat yang buruk untuk menyembunyikan dua
            jawaban yang tidak ada di dalamnya. */}
        <div className="mb-3 flex flex-wrap gap-2">
          {bolehBebanKonseptor ? (
            <a
              href={withBasePath("/beban-konseptor")}
              className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-foreground transition hover:bg-muted/50"
            >
              Beban Kinerja Konseptor — berat pekerjaan, bukan jumlahnya
            </a>
          ) : null}
          <a
            href={withBasePath("/peta-perkara")}
            className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-foreground transition hover:bg-muted/50"
          >
            Peta Perkara — sebaran per desa dan faktor perceraiannya
          </a>
        </div>

        <AletaAnalisaPerkara nomorPerkara={status.identitas.nomorPerkara} />
      </Bagian>

      {/* ==================================================================
          BANDINGKAN DENGAN PERKARA LAIN
          ==================================================================

          Ditaruh SESUDAH analisis lanjutan dan sebelum penyusun perintah:
          perbandingan adalah pertanyaan yang muncul setelah satu perkara
          selesai dibaca - "kok yang ini lebih lama dari yang itu?" - bukan
          pertanyaan pembuka.

          Terciut sebagai bawaan. Ia membaca SIPP lagi untuk perkara kedua,
          dan yang tidak membandingkan tidak perlu membayarnya. */}
      <Bagian
        judul="Bandingkan dengan perkara lain"
        kunci="banding-perkara"
        keterangan="Menjajarkan perkara ini dengan perkara lain beserta selisihnya."
        ciutBawaan
      >
        <BandingPerkara sekarang={ringkasDariStatus(status)} />
      </Bagian>

      {/* Penyusun perintah untuk Project Claude ALETA AI PA CLAUDE. Ditaruh
          sesudah analisis karena urutannya memang begitu: dibaca dahulu,
          baru ditulis. Bahannya diambil hanya bila tombolnya ditekan. */}
      <Bagian
        judul="Susun perintah putusan untuk AI"
        kunci="prompt-putusan"
        keterangan="Jadwal sidang, mediasi, saksi, kuasa, dan nama berkas terisi sendiri dari SIPP."
        ciutBawaan
      >
        <AletaPromptPutusan nomorPerkara={status.identitas.nomorPerkara} />
      </Bagian>

      {status.analisa ? (
        <Bagian
          judul="Analisa perkara"
          kunci="analisa"
          keterangan="Disusun dari data yang sudah ada di layar ini - tidak ada pembacaan tambahan ke SIPP."
        >
          <div className="space-y-4">
            {/* --- ringkasan --- */}
            {status.analisa.ringkasan.length > 0 ? (
              <ul className="space-y-1">
                {status.analisa.ringkasan.map((kalimat, urutan) => (
                  <li key={`ringkas-${urutan}`} className="flex gap-2 text-sm">
                    <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
                    <span>{kalimat}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {/* --- garis waktu --- */}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Garis waktu
              </h4>
              {status.analisa.garisWaktu.terbaca ? (
                <GarisWaktu garisWaktu={status.analisa.garisWaktu} />
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  {status.analisa.garisWaktu.alasan}
                </p>
              )}
            </div>

            {/* --- jeda antar sidang --- */}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Jeda antar sidang
              </h4>
              {status.analisa.jedaSidang.terbaca ? (
                <JedaSidang jeda={status.analisa.jedaSidang} />
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">{status.analisa.jedaSidang.alasan}</p>
              )}
            </div>

            {/* --- ketepatan input --- */}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Ketepatan input ke SIPP
              </h4>
              {status.analisa.ketepatanInput.terbaca ? (
                <KetepatanInput ketepatan={status.analisa.ketepatanInput} />
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  {status.analisa.ketepatanInput.alasan}
                </p>
              )}
            </div>
          </div>
        </Bagian>
      ) : null}
    </div>
  );
}

/**
 * ============================================================================
 * GARIS WAKTU
 * ============================================================================
 *
 * Digambar dengan div biasa, bukan pustaka chart. Portal ini tidak punya satu
 * pun pustaka semacam itu, dan menambahkannya demi satu batang mendatar berarti
 * menanggung paket baru beserta pembaruannya seumur hidup aplikasi - di server
 * yang tidak selalu punya internet.
 *
 * Tiap titik duduk pada jaraknya yang sebenarnya. Daftarnya di bawah gambar,
 * bukan label yang ditempel di atas titik: pada perkara dengan sepuluh sidang
 * label yang ditempel akan saling menimpa sampai tidak terbaca satu pun.
 */
/** Hari ini menurut jam peramban, dalam YYYY-MM-DD. */
function hariIniIso() {
  const waktu = new Date();
  const bulan = String(waktu.getMonth() + 1).padStart(2, "0");
  const hari = String(waktu.getDate()).padStart(2, "0");
  return `${waktu.getFullYear()}-${bulan}-${hari}`;
}

// ===========================================================================
// NOMOR SIDANG
// ===========================================================================

/**
 * ============================================================================
 * NOMOR SIDANG ADALAH KOLOM `urutan` SIPP, BUKAN NOMOR BARIS
 * ============================================================================
 *
 * perkara_jadwal_sidang.urutan diisi SIPP sendiri tiap kali sidang
 * ditambahkan. Diukur pada SIPP PA Donggala 24 September 2026 atas 20.109
 * baris jadwal (10.116 perkara): selalu mulai dari 1, tanpa lubang, tanpa
 * kembar - dan sidang ikrar talak MENERUSKAN nomor sidang pokoknya, tidak
 * mulai lagi dari 1.
 *
 * Nomor itu sama dengan urutan tanggal pada 20.105 baris. Empat sisanya (dua
 * perkara) adalah dua sidang pada HARI yang sama yang jamnya tercatat terbalik.
 * Diurutkan menurut NOMORNYA, sebab nomor itulah yang dicetak SIPP dan disebut
 * di BAS - "sidang ke-5" harus berdiri di baris kelima.
 *
 * Yang tidak bernomor (nol - bot yang belum mengirimnya) jatuh ke bawah dengan
 * urutan asalnya, dan TIDAK diberi nomor karangan: nomor yang keliru pada
 * berkas perkara lebih buruk daripada kosong.
 */
export function urutkanMenurutNomorSidang<T extends { urutanSidang?: number }>(jadwal: T[]): T[] {
  const kunci = (x: T) => {
    const n = Number(x.urutanSidang);
    return Number.isFinite(n) && n > 0 ? n : Number.MAX_SAFE_INTEGER;
  };
  // Salinan, bukan .sort() di tempat: status.jadwal juga dibaca sidangBerikut,
  // ringkasan, dan kalender - mengurutkan larik aslinya mengubah mereka diam-diam.
  return [...jadwal].sort((a, b) => kunci(a) - kunci(b));
}

/**
 * sidangId -> nomor sidang.
 *
 * Relaas membawa sidangId, bukan nomornya. Menomori ulang kelompok relaas
 * menyebut "sidang ke-2" untuk panggilan sidang ketujuh - diukur: 510 dari
 * 5.086 perkara berelaas di PA Donggala punya sidang tanpa relaas di antara
 * sidang-sidang yang berelaas, dan pada semuanya nomor lama itu keliru.
 */
export function petaNomorSidang(
  jadwal: Array<{ sidangId: string; urutanSidang?: number }>
): Map<string, number> {
  const peta = new Map<string, number>();
  for (const sidang of jadwal) {
    const id = String(sidang.sidangId || "");
    const n = Number(sidang.urutanSidang);
    if (id && Number.isFinite(n) && n > 0) peta.set(id, n);
  }
  return peta;
}

// ===========================================================================
// KALENDER PERKARA
// ===========================================================================

/**
 * Jenis peristiwa yang digambar kalender.
 *
 * Warnanya bukan hiasan - ia yang membuat sebulan penuh terbaca sekali
 * pandang, dan karena itu tiap jenis punya warnanya sendiri pada kedua tema.
 * Yang MENUNTUT TINDAKAN (sidang, tenggat) memakai warna kuat; yang sekadar
 * tercatat (relaas, penetapan) memakai warna tenang.
 */
const JENIS_PERISTIWA = {
  daftar: { label: "Pendaftaran", kelas: "bg-slate-500", teks: "text-slate-700 dark:text-slate-300" },
  penetapan: { label: "Penetapan (PMH/PPP/PJS/PHS)", kelas: "bg-violet-500", teks: "text-violet-700 dark:text-violet-300" },
  relaas: { label: "Relaas panggilan", kelas: "bg-sky-500", teks: "text-sky-700 dark:text-sky-300" },
  mediasi: { label: "Mediasi", kelas: "bg-teal-500", teks: "text-teal-700 dark:text-teal-300" },
  sidang: { label: "Sidang", kelas: "bg-emerald-600", teks: "text-emerald-700 dark:text-emerald-300" },
  rencana: { label: "Rencana Court Calendar tanpa sidang", kelas: "bg-zinc-400", teks: "text-zinc-600 dark:text-zinc-300" },
  putusan: { label: "Putusan", kelas: "bg-amber-500", teks: "text-amber-700 dark:text-amber-300" },
  minutasi: { label: "Minutasi", kelas: "bg-orange-500", teks: "text-orange-700 dark:text-orange-300" },
  bht: { label: "Berkekuatan hukum tetap", kelas: "bg-indigo-500", teks: "text-indigo-700 dark:text-indigo-300" },
  akta: { label: "Akta cerai", kelas: "bg-rose-500", teks: "text-rose-700 dark:text-rose-300" },
  ikrar: { label: "Ikrar talak", kelas: "bg-fuchsia-500", teks: "text-fuchsia-700 dark:text-fuchsia-300" },
} as const;

type JenisPeristiwa = keyof typeof JENIS_PERISTIWA;

type PeristiwaKalender = {
  tanggal: string;
  jenis: JenisPeristiwa;
  judul: string;
  rincian: string;
  /** Sidang yang ditunda tetap peristiwa, tetapi bukan peristiwa yang sama. */
  ditunda?: boolean;
};

/**
 * Menyusun seluruh peristiwa perkara dari muatan yang SUDAH ADA.
 *
 * ============================================================================
 * TIDAK ADA SATU PUN PANGGILAN BARU
 * ============================================================================
 *
 * Tiap tanggal di bawah sudah berada di layar ini - tersebar di enam bagian.
 * Menambah rute hanya untuk mengumpulkannya berarti menunda jawabannya demi
 * jawaban yang sama, dan menambah satu tempat lagi yang dapat gagal.
 *
 * Yang KOSONG dilewati diam-diam; yang tidak terbaca bukan urusan kalender -
 * bagian asalnya yang menyebutkan sebabnya.
 */
export function susunPeristiwa(status: Status): PeristiwaKalender[] {
  const hasil: PeristiwaKalender[] = [];
  const sah = (t: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(t || ""));
  const tambah = (satu: PeristiwaKalender) => {
    if (sah(satu.tanggal)) hasil.push(satu);
  };

  if (status.identitas.tanggalDaftar) {
    tambah({
      tanggal: status.identitas.tanggalDaftar,
      jenis: "daftar",
      judul: "Perkara didaftarkan",
      rincian: status.identitas.jenisPerkara || "",
    });
  }

  for (const tahap of status.tahapan?.tahap ?? []) {
    // Pendaftaran sudah disebut di atas; menyebutnya dua kali membuat satu
    // hari tampak memuat dua peristiwa yang sebenarnya satu.
    if (tahap.kunci === "daftar" || tahap.kunci === "pendaftaran") continue;
    tambah({
      tanggal: tahap.tanggal,
      jenis: "penetapan",
      judul: tahap.label,
      rincian: tahap.diinputOleh ? `diinput ${tahap.diinputOleh}` : "",
    });
  }

  for (const sidang of status.jadwal) {
    tambah({
      tanggal: sidang.tanggalSidang,
      jenis: "sidang",
      judul: sidang.agenda || "Sidang",
      rincian: [
        sidang.jamSidang,
        sidang.ruangan,
        sidang.ditunda ? `ditunda${sidang.alasanDitunda ? `: ${sidang.alasanDitunda}` : ""}` : "",
        sidang.adaBas ? "BAS ada" : "BAS belum",
      ]
        .filter(Boolean)
        .join(" · "),
      ditunda: sidang.ditunda,
    });
  }

  // ==========================================================================
  // RENCANA YANG TIDAK ADA SIDANGNYA - HANYA ITU YANG DIGAMBAR
  // ==========================================================================
  //
  // Court Calendar merencanakan tanggal yang pada 98% perkara memang bersidang
  // (diukur atas 1.127 rencana 2026). Menggambar keduanya berarti hampir tiap
  // hari sidang memuat dua titik yang menyatakan hal yang sama, dan yang satu
  // itu - rencana yang lewat TANPA sidang - tenggelam di antaranya.
  //
  // Yang terlaksana dan terjadwal sudah terwakili titik sidangnya; daftar di
  // bawah kalender tetap memuat keempat keadaannya.
  for (const rencana of status.courtCalendar?.baris ?? []) {
    if (rencana.adaSidang) continue;
    tambah({
      tanggal: rencana.tanggal,
      jenis: "rencana",
      judul: rencana.agenda || "Rencana sidang",
      rincian: [
        rencana.jam,
        rencana.keterangan,
        rencana.keadaan === "meleset" ? "hari itu lewat tanpa sidang" : "belum dijadwalkan",
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }

  for (const jadwal of status.mediasi?.jadwal ?? []) {
    tambah({
      tanggal: jadwal.tanggal,
      jenis: "mediasi",
      judul: "Mediasi",
      rincian: [jadwal.jam, jadwal.tempat, jadwal.ditunda ? "ditunda" : ""].filter(Boolean).join(" · "),
      ditunda: jadwal.ditunda,
    });
  }

  for (const relaas of status.relaas) {
    // Tanggal PELAKSANAAN relaas - hari jurusita menyerahkannya. Tanggal
    // kirim pos ditampilkan pada rinciannya, bukan sebagai peristiwa
    // tersendiri: keduanya satu perbuatan yang sama.
    tambah({
      tanggal: relaas.tanggalRelaas,
      jenis: "relaas",
      judul: `Relaas ${relaas.namaPihak || "pihak"}`,
      rincian: [
        relaas.peran,
        relaas.jurusitaNama ? `jurusita ${relaas.jurusitaNama}` : "",
        relaas.tanggalSidang ? `untuk sidang ${tanggalHariPendek(relaas.tanggalSidang, relaas.tanggalSidang)}` : "",
        relaas.caraRelaas?.cara || (relaas.bertemu ? "bertemu orangnya" : ""),
        relaas.retur ? "surat RETUR" : "",
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }

  const putusan = status.putusan;
  if (putusan) {
    const sebutan =
      status.umur.sebabSelesai === "dicabut"
        ? "Perkara dicabut"
        : status.umur.sebabSelesai === "gugur"
          ? "Perkara gugur"
          : "Putusan";
    tambah({
      tanggal: putusan.tanggalPutusan,
      jenis: "putusan",
      judul: sebutan,
      rincian: [putusan.statusPutusan, putusan.verstek ? "verstek" : ""].filter(Boolean).join(" · "),
    });
    tambah({
      tanggal: putusan.tanggalMinutasi,
      jenis: "minutasi",
      judul: "Minutasi",
      rincian: "",
    });
    tambah({
      tanggal: putusan.tanggalBht,
      jenis: "bht",
      judul: "Berkekuatan hukum tetap",
      rincian: "",
    });
    if (putusan.aktaCerai) {
      tambah({
        tanggal: putusan.aktaCerai.tanggal,
        jenis: "akta",
        judul: "Akta cerai terbit",
        rincian: putusan.aktaCerai.nomor || "",
      });
    }
  }

  if (status.ikrarTalak?.ada && status.ikrarTalak.tanggalIkrar) {
    tambah({
      tanggal: status.ikrarTalak.tanggalIkrar,
      jenis: "ikrar",
      judul: "Ikrar talak",
      rincian: status.ikrarTalak.nomorSk ? `SK ${status.ikrarTalak.nomorSk}` : "",
    });
  }

  return hasil.sort((a, b) => (a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : 0));
}

/**
 * Kalender satu bulan berisi seluruh peristiwa perkara.
 *
 * ============================================================================
 * BULAN YANG DIBUKA LEBIH DULU BUKAN BULAN INI
 * ============================================================================
 *
 * Perkara yang sudah putus setahun lalu tidak punya apa pun pada bulan ini,
 * dan kalender yang terbuka kosong terbaca seperti kalender yang rusak. Yang
 * dibuka karena itu bulan peristiwa TERDEKAT yang belum lewat; bila seluruh
 * peristiwanya sudah lewat, bulan peristiwa terakhir.
 */
export function KalenderPerkara({ status }: { status: Status }) {
  const peristiwa = useMemo(() => susunPeristiwa(status), [status]);
  const hariIni = hariIniIso();

  const bulanAwal = useMemo(() => {
    const berikut = peristiwa.find((x) => x.tanggal >= hariIni);
    const dipakai = berikut ?? peristiwa[peristiwa.length - 1];
    return dipakai ? dipakai.tanggal.slice(0, 7) : hariIni.slice(0, 7);
  }, [peristiwa, hariIni]);

  const [bulan, setBulan] = useState(bulanAwal);
  const [dipilih, setDipilih] = useState("");

  // Perkara lain dibuka dari layar yang sama - komponennya tidak dibongkar,
  // hanya muatannya berganti. Tanpa ini, kalender tetap berdiri di bulan
  // perkara sebelumnya dan tampak kosong.
  //
  // Disetel SAAT MENGGAMBAR, bukan di useEffect: efek yang memanggil setState
  // menggambar kalender perkara lama sekali dulu, baru menggantinya - dan
  // eslint (react-hooks/set-state-in-effect) menolaknya. Ini pola "menyesuaikan
  // state ketika prop berubah" dari dokumentasi React: kuncinya dibandingkan,
  // dan setState hanya terpanggil sekali tiap kali kuncinya berganti.
  const kunciBulanAwal = `${status.identitas.nomorPerkara}|${bulanAwal}`;
  const [kunciTerakhir, setKunciTerakhir] = useState(kunciBulanAwal);
  if (kunciTerakhir !== kunciBulanAwal) {
    setKunciTerakhir(kunciBulanAwal);
    setBulan(bulanAwal);
    setDipilih("");
  }

  if (peristiwa.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Belum ada satu pun tanggal yang tercatat pada perkara ini - kalender tidak dapat disusun.
      </p>
    );
  }

  const perTanggal = new Map<string, PeristiwaKalender[]>();
  for (const satu of peristiwa) {
    const daftar = perTanggal.get(satu.tanggal) ?? [];
    daftar.push(satu);
    perTanggal.set(satu.tanggal, daftar);
  }

  const [tahun, nomorBulan] = bulan.split("-").map(Number);
  const jumlahHari = new Date(tahun, nomorBulan, 0).getDate();
  const kosongDiDepan = new Date(tahun, nomorBulan - 1, 1).getDay();
  const geser = (selisih: number) => {
    const waktu = new Date(tahun, nomorBulan - 1 + selisih, 1);
    setBulan(`${waktu.getFullYear()}-${String(waktu.getMonth() + 1).padStart(2, "0")}`);
  };

  const awalPerkara = peristiwa[0].tanggal;
  const akhirPerkara = peristiwa[peristiwa.length - 1].tanggal;
  const jenisBulanIni = new Set(
    peristiwa.filter((x) => x.tanggal.startsWith(bulan)).map((x) => x.jenis)
  );
  const isiDipilih = dipilih ? perTanggal.get(dipilih) ?? [] : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => geser(-1)} aria-label="Bulan sebelumnya">
            ‹
          </Button>
          <span className="min-w-[9rem] text-center text-sm font-semibold">
            {BULAN_PANJANG[nomorBulan - 1]} {tahun}
          </span>
          <Button size="sm" variant="outline" onClick={() => geser(1)} aria-label="Bulan berikutnya">
            ›
          </Button>
          {bulan !== bulanAwal ? (
            <Button size="sm" variant="outline" onClick={() => setBulan(bulanAwal)}>
              Kembali
            </Button>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          Perkara ini berjalan {tanggalHariPanjang(awalPerkara)} – {tanggalHariPanjang(akhirPerkara)}
        </p>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {HARI_PENDEK.map((nama) => (
          <div key={nama} className="py-1 font-medium text-muted-foreground">
            {nama}
          </div>
        ))}

        {Array.from({ length: kosongDiDepan }).map((_, urutan) => (
          <div key={`kosong-${urutan}`} />
        ))}

        {Array.from({ length: jumlahHari }).map((_, urutan) => {
          const nomorHari = urutan + 1;
          const tanggal = `${bulan}-${String(nomorHari).padStart(2, "0")}`;
          const isi = perTanggal.get(tanggal) ?? [];
          const akhirPekan = new Date(tahun, nomorBulan - 1, nomorHari).getDay() % 6 === 0;
          const terpilih = tanggal === dipilih;

          return (
            <button
              key={tanggal}
              type="button"
              // Hari kosong tetap dapat ditekan supaya pilihannya dapat
              // dibatalkan tanpa mencari tombol lain.
              onClick={() => setDipilih(terpilih || isi.length === 0 ? "" : tanggal)}
              className={cn(
                "flex min-h-[3.4rem] flex-col items-center gap-1 rounded-md border p-1 transition",
                terpilih ? "border-primary bg-primary/10" : "border-transparent",
                isi.length > 0 ? "bg-muted/50 hover:bg-muted" : "hover:bg-muted/30",
                akhirPekan && isi.length === 0 ? "text-muted-foreground" : ""
              )}
              aria-label={`${tanggalHariPanjang(tanggal)}: ${
                isi.length === 0 ? "tanpa peristiwa" : isi.map((x) => x.judul).join(", ")
              }`}
            >
              <span
                className={cn(
                  "text-sm",
                  tanggal === hariIni &&
                    "rounded-full bg-primary px-1.5 font-semibold text-primary-foreground"
                )}
              >
                {nomorHari}
              </span>
              {isi.length > 0 ? (
                <span className="flex flex-wrap justify-center gap-0.5">
                  {/* Empat titik cukup: yang kelima dan seterusnya membuat
                      kotaknya tinggi sebelah dan tidak menambah satu pun
                      keterangan - jumlahnya sudah disebut angka di sebelahnya. */}
                  {isi.slice(0, 4).map((satu, ke) => (
                    <span
                      key={`${satu.jenis}-${ke}`}
                      className={cn("h-1.5 w-1.5 rounded-full", JENIS_PERISTIWA[satu.jenis].kelas)}
                    />
                  ))}
                  {isi.length > 4 ? (
                    <span className="text-[10px] leading-none text-muted-foreground">
                      +{isi.length - 4}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Keterangan warna hanya memuat jenis yang BENAR-BENAR ada pada bulan
          ini. Daftar sepuluh warna yang delapan di antaranya tidak dipakai
          menuntut pembacanya menyaring sendiri. */}
      {jenisBulanIni.size > 0 ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {(Object.keys(JENIS_PERISTIWA) as JenisPeristiwa[])
            .filter((jenis) => jenisBulanIni.has(jenis))
            .map((jenis) => (
              <span key={jenis} className="inline-flex items-center gap-1">
                <span className={cn("h-1.5 w-1.5 rounded-full", JENIS_PERISTIWA[jenis].kelas)} />
                {JENIS_PERISTIWA[jenis].label}
              </span>
            ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Tidak ada peristiwa pada bulan ini. Tekan Kembali untuk kembali ke bulan yang ada isinya.
        </p>
      )}

      <CourtCalendarSipp status={status} />

      {dipilih ? (
        <div className="rounded-md border bg-muted/40 p-2">
          <p className="mb-1 text-sm font-semibold">
            {tanggalHariPanjang(dipilih)}
          </p>
          <ul className="space-y-1 text-sm">
            {isiDipilih.map((satu, ke) => (
              <li key={`${satu.jenis}-${ke}`} className="flex items-baseline gap-2">
                <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", JENIS_PERISTIWA[satu.jenis].kelas)} />
                <span>
                  <span className={cn("font-medium", JENIS_PERISTIWA[satu.jenis].teks)}>
                    {satu.judul}
                  </span>
                  {satu.rincian ? (
                    <span className="ml-1 text-muted-foreground">{satu.rincian}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Tekan satu tanggal untuk membaca peristiwanya.
        </p>
      )}
    </div>
  );
}

/**
 * Court Calendar SIPP - rencana majelis, diadu dengan pelaksanaannya.
 *
 * ============================================================================
 * DUA TABEL YANG SELAMA INI TIDAK PERNAH DIPERTEMUKAN
 * ============================================================================
 *
 * perkara_court_calendar memuat RENCANA; perkara_jadwal_sidang memuat sidang
 * yang terjadi. SIPP menampilkan keduanya di layar yang berbeda, dan karena
 * itu pertanyaan "rencana mana yang tidak jadi" tidak pernah punya jawaban -
 * ia menuntut membuka dua layar lalu membandingkan tanggal dengan mata.
 *
 * Yang dicari di sini hanya satu baris: rencana yang harinya sudah lewat
 * tanpa satu pun sidang. Diukur atas 1.127 rencana 2026 di PA Donggala,
 * sembilan belas di antaranya begitu - jarang, dan justru karena jarang ia
 * tidak pernah tertangkap tanpa dicarikan.
 */
function CourtCalendarSipp({ status }: { status: Status }) {
  const cc = status.courtCalendar;

  // Tanggal -> nomor sidang yang MELAKSANAKAN rencana itu, HANYA bila hari itu
  // memuat SATU sidang - aturan yang sama dengan urutanSidangPerTanggal di
  // Antrian Sidang. Hari berisi dua sidang (terukur pada dua perkara) tidak
  // diberi keterangan: menebak salah satunya menempelkan nomor yang keliru.
  // Tanggalnya sepuluh huruf pertama saja, sama seperti di sana.
  const sidangPerHari = new Map<string, number[]>();
  for (const s of status.jadwal) {
    const hari = String(s.tanggalSidang || "").slice(0, 10);
    const n = Number(s.urutanSidang);
    if (hari && Number.isFinite(n) && n > 0) sidangPerHari.set(hari, [...(sidangPerHari.get(hari) ?? []), n]);
  }
  const sidangKeHari = (tanggal: string) => {
    const nomor = sidangPerHari.get(String(tanggal || "").slice(0, 10)) ?? [];
    return nomor.length === 1 ? nomor[0] : 0;
  };

  // Bot lama tidak mengirimkannya sama sekali - diam saja lebih jujur
  // daripada menuliskan "tidak ada rencana" untuk keterangan yang memang
  // tidak pernah ditanyakan.
  if (!cc) return null;

  if (!cc.terbaca) {
    return (
      <p className="text-sm text-muted-foreground">
        Court Calendar tidak terbaca{cc.alasan ? ` (${cc.alasan})` : ""} - rencana sidang tidak
        dapat diadu dengan pelaksanaannya.
      </p>
    );
  }

  if (cc.baris.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Court Calendar perkara ini belum diisi di SIPP. Itu lazim - pada perkara 2026 baru sekitar
        separuh perkara mengisinya - jadi bukan tanda ada yang keliru.
      </p>
    );
  }

  const nada = (keadaan: string) =>
    keadaan === "terlaksana"
      ? ("success" as const)
      : keadaan === "meleset"
        ? ("danger" as const)
        : keadaan === "terjadwal"
          ? ("default" as const)
          : ("muted" as const);

  const bunyi = (keadaan: string) =>
    keadaan === "terlaksana"
      ? "terlaksana"
      : keadaan === "terjadwal"
        ? "sudah dijadwalkan"
        : keadaan === "meleset"
          ? "lewat tanpa sidang"
          : "menunggu dijadwalkan";

  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <div className="mb-1.5 flex flex-wrap items-baseline gap-2 border-b pb-1">
        <p className="text-sm font-semibold">Court Calendar SIPP</p>
        <span className="text-xs text-muted-foreground">
          rencana majelis - {cc.jumlah ?? cc.baris.length} agenda
        </span>
        <span className="ml-auto flex flex-wrap gap-1">
          {cc.meleset ? <Badge variant="danger">{cc.meleset} lewat tanpa sidang</Badge> : null}
          {cc.terlaksana ? <Badge variant="success">{cc.terlaksana} terlaksana</Badge> : null}
          {cc.terjadwal ? <Badge variant="default">{cc.terjadwal} dijadwalkan</Badge> : null}
          {cc.menunggu ? <Badge variant="muted">{cc.menunggu} menunggu</Badge> : null}
        </span>
      </div>
      {/* Diurutkan DI SINI, bukan dipercayakan pada pengirimnya. Kuerinya
          memang sudah ORDER BY rencana_tanggal, tetapi bagian ini menjanjikan
          urutan waktu kepada yang membacanya - dan janji yang bergantung pada
          kerapian pemanggil akan diingkari pada hari pemanggilnya berubah.

          Jam menjadi pemecah seri: 22 perkara PA Donggala punya dua rencana
          pada tanggal yang sama. */}
      <ol className="space-y-1 text-sm">
        {[...cc.baris]
          .sort((a, b) =>
            a.tanggal !== b.tanggal
              ? a.tanggal < b.tanggal
                ? -1
                : 1
              : (a.jam || "") < (b.jam || "")
                ? -1
                : (a.jam || "") > (b.jam || "")
                  ? 1
                  : 0
          )
          .map((baris, ke) => (
          <li
            key={`${baris.tanggal}-${ke}`}
            className="flex flex-wrap items-baseline gap-x-2 border-l-2 border-border pl-2"
          >
            {/* Nomor rencana 1..N - sama dengan kolom "No" pada cetak Court
                Calendar SIPP (cetak.php), yang juga menomori menurut
                rencana_tanggal. Tabel perkara_court_calendar TIDAK punya kolom
                urutan, jadi nomornya memang urutan baris - dan karena itu
                dihitung SESUDAH .sort() di atas. Bukan nomor sidang: rencana
                dan sidang tidak selalu sama banyak. */}
            <NomorSidang urutan={ke + 1} sebutan="Rencana" />
            <span className="font-medium">{tanggalHariPanjang(baris.tanggal)}</span>
            {baris.jam ? <span className="text-muted-foreground">{baris.jam}</span> : null}
            <span>{baris.agenda || "tanpa agenda"}</span>
            {baris.keterangan ? (
              <span className="text-muted-foreground">{baris.keterangan}</span>
            ) : null}
            <Badge variant={nada(baris.keadaan)}>{bunyi(baris.keadaan)}</Badge>
            {/* Sidang keberapa yang melaksanakan rencana ini - nomor SIPP,
                bukan nomor rencana di tepi kiri. Hanya pada rencana yang
                bersidang dan harinya memuat satu sidang saja. */}
            {baris.adaSidang && sidangKeHari(baris.tanggal) > 0 ? (
              <span className="text-xs text-muted-foreground">sidang ke-{sidangKeHari(baris.tanggal)}</span>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Terlaksana dinilai dari ADANYA sidang pada tanggal yang direncanakan, bukan dari kecocokan
        agendanya - agenda ditulis bebas dan ejaannya tidak ajek di SIPP.
      </p>
    </div>
  );
}

// ===========================================================================
// RELAAS PANGGILAN
// ===========================================================================

/** Bunyi alasan kepatutan dalam kalimat, bukan kode. */
function bunyiAlasanKepatutan(alasan: string) {
  if (alasan === "dikirim_setelah_hari_sidang") return "dikirim setelah hari sidang";
  if (alasan === "tenggang_kurang_dari_ambang") return "tenggangnya kurang dari ambang";
  if (alasan === "belum_dikirim") return "belum dikirim";
  if (alasan === "tidak_wajib_dipanggil") return "tidak dinilai - hadir pada sidang sebelumnya";
  if (alasan === "belum_diterima") return "belum diterima";
  if (alasan === "penerimaan_belum_terbukti") return "penerimaannya belum terbukti";
  if (alasan === "tanggal_sidang_tidak_diketahui") return "tanggal sidangnya tidak diketahui";
  if (alasan === "tanggal_tidak_terbaca") return "tanggalnya tidak terbaca";
  return alasan.replace(/_/g, " ");
}

const SEBUTAN_JALUR: Record<string, string> = {
  elektronik: "panggilan elektronik",
  surat_tercatat: "surat tercatat",
  biasa: "jurusita (Pasal 122 HIR)",
  delegasi: "delegasi",
};

/**
 * Relaas panggilan, runut per sidang.
 *
 * ============================================================================
 * KELOMPOKNYA SIDANG, BUKAN PIHAK
 * ============================================================================
 *
 * Relaas dicatat per pihak per sidang, dan pada perkara yang bersidang enam
 * kali, dua nama yang sama muncul dua belas kali. Dikelompokkan per PIHAK,
 * daftar itu menjawab "siapa saja yang pernah dipanggil" - pertanyaan yang
 * hampir tidak pernah ditanyakan. Dikelompokkan per SIDANG, ia menjawab
 * "sidang tanggal sekian, siapa yang sudah dipanggil dan siapa yang belum" -
 * pertanyaan yang ditanyakan majelis setiap kali sidang dibuka.
 *
 * Urutannya menaik: sidang pertama di atas, sebab begitulah perkara berjalan
 * dan begitu pula bagian-bagian lain di layar ini disusun.
 */
export function RelaasPanggilan({ status }: { status: Status }) {
  const panggilan = status.panggilan;
  const ringkasan = panggilan?.ringkasan;

  // Agenda sidang diambil dari jadwal - relaas hanya membawa tanggalnya.
  const agendaSidang = new Map(
    status.jadwal.map((sidang) => [sidang.tanggalSidang, sidang])
  );

  // Nomor sidang diambil dari JADWAL lewat sidangId, bukan dari urutan
  // kelompok di daftar ini. Relaas hanya dibuat untuk sidang yang ada
  // panggilannya, sehingga sidang tanpa relaas membuat nomor urut kelompok
  // bergeser: pada 385/Pdt.G/2026 relaas sidang KETUJUH dahulu tertulis
  // "Sidang ke-2".
  const nomorSidangPer = petaNomorSidang(status.jadwal);

  // Sidang yang dinilai memang punya relaas? Bot yang mengirim sidangId
  // dicocokkan tepat; bot lama cukup ditanya ada tidaknya relaas sama sekali.
  const acuanBerelaas =
    status.panggilan?.sidangId != null && status.panggilan.sidangId !== ""
      ? status.relaas.some((r) => String(r.sidangId ?? "") === String(status.panggilan?.sidangId))
      : status.relaas.length > 0;

  // Kelompok per tanggal sidang. Yang tanggal sidangnya kosong dikumpulkan di
  // akhir dan DISEBUT apa adanya - relaas yang tidak tertaut sidang mana pun
  // adalah keadaan yang perlu diperbaiki di SIPP, bukan yang perlu
  // disembunyikan dari layar.
  const kelompok = new Map<string, Status["relaas"]>();
  for (const baris of status.relaas) {
    const kunci = baris.tanggalSidang || "";
    const daftar = kelompok.get(kunci) ?? [];
    daftar.push(baris);
    kelompok.set(kunci, daftar);
  }
  const tanggalUrut = [...kelompok.keys()]
    .filter(Boolean)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const tanpaSidang = kelompok.get("") ?? [];

  if (status.relaas.length === 0 && !ringkasan) {
    return (
      <p className="text-sm text-muted-foreground">
        Belum ada relaas tercatat pada perkara ini.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* --- ringkasan kepatutan untuk sidang terakhir --- */}
      {ringkasan ? (
        <div className="space-y-1">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="muted">{ringkasan.jumlahPihak} pihak</Badge>
            {ringkasan.patut > 0 ? (
              <Badge variant="success">{ringkasan.patut} patut</Badge>
            ) : null}
            {ringkasan.penerimaanBelumTerbukti > 0 ? (
              <Badge variant="warning">
                {ringkasan.penerimaanBelumTerbukti} penerimaan belum terbukti
              </Badge>
            ) : null}
            {ringkasan.tidakPatut > 0 ? (
              <Badge variant="danger">{ringkasan.tidakPatut} tidak patut</Badge>
            ) : null}
            {ringkasan.belumDipanggil > 0 ? (
              <Badge variant="danger">{ringkasan.belumDipanggil} belum dipanggil</Badge>
            ) : null}
            {ringkasan.salahSaluran > 0 ? (
              <Badge variant="warning">{ringkasan.salahSaluran} salah saluran</Badge>
            ) : null}
            {/* Sandi relaas SIPP yang bertentangan dengan e-Court - mis. 'E'
                kepada pihak tanpa email di e-Court. Bukan salah saluran, dan
                karena itu tidak berwarna: yang perlu dibetulkan catatannya,
                bukan panggilannya. Dihitung tersendiri, bukan disembunyikan. */}
            {(ringkasan.saluranBelumPasti ?? 0) > 0 ? (
              <Badge variant="muted">{ringkasan.saluranBelumPasti} saluran belum pasti</Badge>
            ) : null}
            {ringkasan.tidakPerluDipanggil > 0 ? (
              <Badge variant="muted">
                {ringkasan.tidakPerluDipanggil} tidak perlu dipanggil
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {/* Bot jatuh ke sidang terakhir yang TERCATAT bila tidak ada satu
                pun sidang yang punya relaas - kalimatnya harus mengikuti,
                bukan mengaku sidang itu punya relaas (40 dari 823 perkara
                bersidang 2026 tanpa relaas sama sekali). */}
            Kepatutan di atas dinilai untuk{" "}
            <strong>
              {acuanBerelaas
                ? "sidang terakhir yang punya relaas"
                : "sidang terakhir yang tercatat - belum ada relaas untuk sidang itu"}
            </strong>
            {panggilan?.tanggalSidang ? ` (${tanggalHariPanjang(panggilan.tanggalSidang)})` : ""}, menurut
            jalur yang SEHARUSNYA dipakai
            {panggilan?.lewatEcourt ? " (perkara e-Court)" : " (perkara biasa)"} - bukan jalur yang
            terlanjur dipakai. Alat bantu, bukan penetapan sah tidaknya panggilan.
          </p>
        </div>
      ) : null}

      {/* --- daftar runut per sidang --- */}
      {tanggalUrut.length === 0 && tanpaSidang.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada relaas tercatat.</p>
      ) : (
        <ol className="space-y-2">
          {tanggalUrut.map((tanggal) => {
            const sidang = agendaSidang.get(tanggal);
            const baris = kelompok.get(tanggal) ?? [];
            // Satu hari biasanya satu sidang. Bila dua (terukur pada dua
            // perkara), kedua nomornya disebut - bukan ditebak salah satunya.
            // Relaas yang sidangId-nya tidak ada di jadwal tidak diberi nomor
            // karangan: kepalanya berbunyi "Sidang" saja.
            const nomor = [
              ...new Set(
                baris
                  .map((r) => nomorSidangPer.get(String(r.sidangId || "")))
                  .filter((n): n is number => typeof n === "number")
              ),
            ].sort((a, b) => a - b);
            return (
              <li key={tanggal} className="rounded-md border bg-muted/30 p-2">
                <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b pb-1">
                  <span className="text-sm font-semibold">
                    {nomor.length > 0 ? `Sidang ke-${nomor.join(" & ke-")}` : "Sidang"} ·{" "}
                    {tanggalHariPanjang(tanggal)}
                  </span>
                  {sidang?.agenda ? (
                    <span className="text-xs text-muted-foreground">{sidang.agenda}</span>
                  ) : null}
                  {sidang?.ditunda ? <Badge variant="warning">ditunda</Badge> : null}
                  <span className="ml-auto text-sm text-muted-foreground">
                    {baris.length} relaas
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {baris.map((relaas) => (
                    <BarisRelaas key={relaas.id} relaas={relaas} tanggalSidang={tanggal} />
                  ))}
                </ul>
              </li>
            );
          })}

          {tanpaSidang.length > 0 ? (
            <li className="rounded-md border border-amber-300/70 bg-amber-50/60 p-2 dark:border-amber-700/50 dark:bg-amber-950/30">
              <p className="mb-1.5 border-b pb-1 text-sm font-semibold">
                {tanpaSidang.length} relaas tanpa tautan sidang
                <span className="ml-1 font-normal text-muted-foreground">
                  - sidang_id-nya kosong di SIPP, jadi tidak dapat dipastikan untuk sidang yang mana
                </span>
              </p>
              <ul className="space-y-1.5">
                {tanpaSidang.map((relaas) => (
                  <BarisRelaas key={relaas.id} relaas={relaas} tanggalSidang="" />
                ))}
              </ul>
            </li>
          ) : null}
        </ol>
      )}

      {/* --- kepatutan per pihak --- */}
      {panggilan && panggilan.pihak.length > 0 ? (
        <div>
          <p className="mb-1 text-sm font-semibold">Kepatutan panggilan sidang terakhir</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-1 font-medium">Pihak</th>
                  <th className="px-2 py-1 font-medium">Jalur seharusnya</th>
                  <th className="px-2 py-1 font-medium">Dikirim</th>
                  <th className="px-2 py-1 font-medium">Diterima</th>
                  <th className="px-2 py-1 font-medium">Kepatutan</th>
                </tr>
              </thead>
              <tbody>
                {panggilan.pihak.map((pihak, ke) => (
                  <tr key={`${pihak.nama}-${ke}`} className="border-b last:border-0 align-top">
                    <td className="px-2 py-1.5">
                      <span className="font-medium">{pihak.nama || "tanpa nama"}</span>
                      {pihak.peran ? (
                        <div className="text-sm text-muted-foreground">{pihak.peran}</div>
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5">
                      {SEBUTAN_JALUR[pihak.seharusnya] || pihak.seharusnya || "-"}
                      {pihak.salahSaluran ? (
                        <div className="mt-0.5">
                          <Badge variant="warning">
                            dipakai {SEBUTAN_JALUR[pihak.terlaksana] || pihak.terlaksana}
                          </Badge>
                        </div>
                      ) : pihak.catatanSaluran ? (
                        // Bukan lencana: sandi SIPP bertentangan dengan e-Court,
                        // dan yang perlu dibetulkan catatannya, bukan
                        // panggilannya. Lihat ecourtPanggilanService di bot.
                        <div className="mt-0.5 text-sm text-muted-foreground">{pihak.catatanSaluran}</div>
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5">
                      {pihak.sudahDikirim ? (
                        <>
                          <Badge variant="success">
                            {tanggalHariPendek(pihak.tanggalPanggilan, pihak.tanggalPanggilan)}
                          </Badge>
                          {pihak.noResiPos ? (
                            <div className="mt-0.5 text-sm text-muted-foreground">
                              resi {pihak.noResiPos}
                            </div>
                          ) : null}
                        </>
                      ) : pihak.tidakPerluDipanggil ? (
                        <>
                          <Badge variant="muted">tidak perlu dipanggil</Badge>
                          <div className="mt-0.5 text-sm text-muted-foreground">
                            hadir pada sidang sebelumnya
                          </div>
                        </>
                      ) : (
                        <Badge variant="danger">belum dikirim</Badge>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {!pihak.kepatutan.perluDiterima ? (
                        <span className="text-xs text-muted-foreground">tidak disyaratkan</span>
                      ) : pihak.diterima === true ? (
                        <>
                          <Badge variant="success">diterima</Badge>
                          {pihak.buktiPenerimaan ? (
                            <div className="mt-0.5 text-sm text-muted-foreground">
                              {pihak.buktiPenerimaan}
                            </div>
                          ) : null}
                        </>
                      ) : pihak.diterima === false ? (
                        <Badge variant="danger">belum diterima</Badge>
                      ) : (
                        <Badge variant="warning">belum terbukti</Badge>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {pihak.kepatutan.alasan === "tidak_wajib_dipanggil" ? (
                        // Hadir pada sidang sebelumnya dan memang tidak
                        // dipanggil - tidak ada yang dapat dinilai, dan kuning
                        // "belum dikirim" di sini dahulu berdiri di samping
                        // "tidak perlu dipanggil" (tinjauan 24 September 2026).
                        <Badge variant="muted">{bunyiAlasanKepatutan(pihak.kepatutan.alasan)}</Badge>
                      ) : pihak.kepatutan.patut === true ? (
                        <Badge variant="success">patut · {pihak.kepatutan.selisih} hari</Badge>
                      ) : pihak.kepatutan.patut === false ? (
                        <Badge variant="danger">
                          {bunyiAlasanKepatutan(pihak.kepatutan.alasan)}
                          {pihak.kepatutan.selisih === null ? "" : ` · ${pihak.kepatutan.selisih} hari`}
                        </Badge>
                      ) : (
                        <Badge variant="warning">
                          {bunyiAlasanKepatutan(pihak.kepatutan.alasan)}
                          {pihak.kepatutan.selisih === null ? "" : ` · ${pihak.kepatutan.selisih} hari`}
                        </Badge>
                      )}
                      <div className="mt-0.5 text-sm text-muted-foreground">
                        ambang {pihak.kepatutan.ambang}{" "}
                        {pihak.kepatutan.hariKerja ? "hari kerja" : "hari kalender"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {pihak.kepatutan.dasarHukum}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Satu relaas, dengan seluruh yang dicatat jurusita.
 *
 * Jarak hari ke sidangnya ditampilkan karena itulah yang menentukan patut
 * tidaknya panggilan - dan ia tidak dapat dibaca dari dua tanggal yang
 * berdampingan tanpa menghitung sendiri.
 */
function BarisRelaas({
  relaas,
  tanggalSidang,
}: {
  relaas: Status["relaas"][number];
  tanggalSidang: string;
}) {
  const jarakHari = (() => {
    if (!tanggalSidang || !relaas.tanggalRelaas) return null;
    const urai = (teks: string) => {
      const [t, b, h] = teks.split("-").map(Number);
      return new Date(t, b - 1, h).getTime();
    };
    const selisih = Math.round((urai(tanggalSidang) - urai(relaas.tanggalRelaas)) / 86400000);
    return Number.isFinite(selisih) ? selisih : null;
  })();

  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-l-2 border-border pl-2">
      <span className="font-medium">{relaas.namaPihak || "tanpa nama pihak"}</span>
      {relaas.peran ? (
        <span className="text-xs text-muted-foreground">{relaas.peran}</span>
      ) : null}

      {relaas.tanggalRelaas ? (
        <span className="text-sm">
          relaas {tanggalHariPendek(relaas.tanggalRelaas, relaas.tanggalRelaas)}
          {jarakHari === null ? null : (
            <span className="text-muted-foreground">
              {" "}
              ({jarakHari < 0 ? `${Math.abs(jarakHari)} hari SESUDAH sidang` : `${jarakHari} hari sebelum sidang`})
            </span>
          )}
        </span>
      ) : (
        <Badge variant="danger">belum dilaksanakan</Badge>
      )}

      {relaas.jurusitaNama ? (
        <span className="text-xs text-muted-foreground">oleh {relaas.jurusitaNama}</span>
      ) : null}

      {/* Bertemu orangnya atau tidak - inilah yang menentukan panggilan sah
          disampaikan langsung, atau lewat kepala desa. Diam berarti tidak
          tercatat, dan itu berbeda dari "tidak bertemu". */}
      {relaas.caraRelaas?.cara ? (
        // ====================================================================
        // CARANYA DARI SANDI SIPP, BUKAN DARI "BUKAN BERTEMU"
        // ====================================================================
        //
        // Sebelum ini hanya "bertemu orangnya" yang punya lencana hijau;
        // sisanya jatuh ke keterangan relaas apa adanya, atau diam. Padahal
        // panggilan elektronik dan relaas yang diterima orang serumah SAMPAI
        // dan sah - keduanya tercatat 3.532 dan 3.104 baris di SIPP satker.
        //
        // Warnanya mengikuti SAMPAI atau tidaknya, bukan mengikuti pertemuan
        // langsung.
        <Badge
          variant={
            relaas.caraRelaas.sampai === true
              ? "success"
              : relaas.caraRelaas.sampai === false
                ? "warning"
                : "muted"
          }
          title={
            relaas.caraRelaas.terbaca
              ? `Sandi SIPP "${relaas.caraRelaas.sandi}".`
              : `Sandi SIPP "${relaas.caraRelaas.sandi}" tidak ada di daftar pilihan SIPP; artinya dibaca dari keterangan relaasnya sendiri.`
          }
        >
          {relaas.caraRelaas.cara}
        </Badge>
      ) : relaas.bertemu ? (
        <Badge variant="success">bertemu orangnya</Badge>
      ) : relaas.ketHasilRelaas ? (
        <Badge variant="muted">{relaas.ketHasilRelaas}</Badge>
      ) : null}

      {relaas.tanggalKirimPos ? (
        <span className="text-xs text-muted-foreground">
          dikirim pos {tanggalHariPendek(relaas.tanggalKirimPos, relaas.tanggalKirimPos)}
          {relaas.noResiPos ? ` · resi ${relaas.noResiPos}` : ""}
        </span>
      ) : null}
      {relaas.retur ? <Badge variant="danger">surat RETUR</Badge> : null}
      {relaas.statusPos === 1 ? <Badge variant="success">pos sampai</Badge> : null}

      <span className="ml-auto flex flex-wrap items-center gap-1">
        {relaas.adaDokumen ? (
          <TombolUnduh
            alamat={`/api/aleta-ecourt/berkas-sipp?jenis=relaas&id=${encodeURIComponent(relaas.id)}`}
            label="Relaas"
            namaCadangan={`relaas-${relaas.id}.pdf`}
          />
        ) : (
          <span className="text-xs text-muted-foreground">relaas belum diunggah</span>
        )}
        {relaas.adaResi ? (
          <TombolUnduh
            alamat={`/api/aleta-ecourt/berkas-sipp?jenis=resi&id=${encodeURIComponent(relaas.id)}`}
            label="Resi"
            namaCadangan={`resi-${relaas.id}.pdf`}
          />
        ) : null}
      </span>
    </li>
  );
}

function GarisWaktu({
  garisWaktu,
}: {
  garisWaktu: NonNullable<Status["analisa"]>["garisWaktu"];
}) {
  const panjang = Math.max(1, Number(garisWaktu.panjangHari) || 1);
  const persen = (hari: number) => Math.min(100, Math.max(0, (hari / panjang) * 100));

  const warna: Record<string, string> = {
    awal: "bg-slate-500",
    penetapan: "bg-sky-500",
    sidang: "bg-amber-500",
    akhir: "bg-emerald-600",
  };

  return (
    <div className="mt-2">
      <div className="relative h-8">
        {/* Batangnya sendiri. */}
        <div className="absolute inset-x-0 top-3.5 h-1.5 rounded-full bg-muted" />

        {/* Bagian yang sudah berjalan sampai akhir - sisanya (minutasi, BHT)
            sengaja dibiarkan berwarna muda supaya terlihat bahwa ia SESUDAH
            perkara itu sendiri berakhir. */}
        <div
          className="absolute top-3.5 h-1.5 rounded-full bg-muted-foreground/30"
          style={{ left: 0, width: `${persen(Number(garisWaktu.totalHari) || 0)}%` }}
        />

        {/* Garis ambang - hanya bila ia memang jatuh di dalam gambarnya. */}
        {garisWaktu.ambangTampak ? (
          <div
            className="absolute top-1 h-6 border-l-2 border-dashed border-rose-400"
            style={{ left: `${persen(Number(garisWaktu.ambangHari) || 0)}%` }}
            title={`Ambang ${garisWaktu.ambangHari} hari`}
          />
        ) : null}

        {garisWaktu.titik.map((satu) => (
          <div
            key={satu.kunci}
            className={cn(
              "absolute top-2.5 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-background",
              warna[satu.jenis] || "bg-slate-400"
            )}
            style={{ left: `${persen(satu.hariKe)}%` }}
            title={`${satu.label} — ${tanggalHariPanjang(satu.tanggal, satu.tanggal)} (hari ke-${satu.hariKe})`}
          />
        ))}
      </div>

      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{tanggalHariPendek(garisWaktu.mulai, garisWaktu.mulai)}</span>
        <span>
          {garisWaktu.totalHari} hari
          {garisWaktu.ambangTampak ? ` · ambang ${garisWaktu.ambangHari} hari` : ""}
        </span>
        <span>{garisWaktu.akhir}</span>
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {garisWaktu.titik.map((satu) => (
          <li key={`daftar-${satu.kunci}`} className="flex items-center gap-1.5">
            <span
              className={cn("h-2 w-2 shrink-0 rounded-full", warna[satu.jenis] || "bg-slate-400")}
            />
            <span className="font-medium">{satu.label}</span>
            <span className="text-muted-foreground">
              {tanggalHariPendek(satu.tanggal, satu.tanggal)} · hari ke-{satu.hariKe}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Jeda antar sidang - batang mendatar, panjangnya sebanding harinya.
 *
 * Alasan tundaan ikut ditulis pada barisnya. Tanpa alasan, deretan angka ini
 * hanya memberitahu perkaranya lama; DENGAN alasan, ia memberitahu kenapa.
 */
function JedaSidang({ jeda }: { jeda: NonNullable<Status["analisa"]>["jedaSidang"] }) {
  const terpanjang = Math.max(1, ...jeda.baris.map((x) => x.hari));

  const warna: Record<string, string> = {
    pendaftaran: "bg-slate-400",
    sidang: "bg-amber-500",
    berjalan: "bg-rose-500",
    akhir: "bg-emerald-600",
  };

  return (
    <div className="mt-2 space-y-1">
      {jeda.baris.map((satu, urutan) => (
        <div key={`jeda-${urutan}`} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="min-w-[9rem] text-sm text-muted-foreground">
            {tanggalHariPendek(satu.dari, satu.dari)} → {tanggalHariPendek(satu.ke, satu.ke)}
          </span>
          <div className="h-2 min-w-[6rem] flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", warna[satu.jenis] || "bg-slate-400")}
              style={{ width: `${Math.max(2, (satu.hari / terpanjang) * 100)}%` }}
            />
          </div>
          <span className="w-16 shrink-0 text-right text-sm tabular-nums">{satu.hari} hari</span>
          {satu.alasan ? (
            <span className="w-full pl-[9rem] text-sm text-muted-foreground sm:w-auto sm:pl-0">
              {satu.alasan}
            </span>
          ) : null}
        </div>
      ))}
      {jeda.rata !== null ? (
        <p className="pt-1 text-sm text-muted-foreground">
          Rata-rata antar sidang {jeda.rata} hari
          {jeda.terpanjang ? ` · terpanjang ${jeda.terpanjang.hari} hari` : ""}.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Ketepatan input ke SIPP.
 *
 * Angka ini sudah dipakai menilai perkara menurut SK, tetapi selama ini
 * terkubur di dalam daftar unsur. Ia satu-satunya bagian nilai yang dapat
 * diperbaiki SEKARANG - tanggalnya sudah lewat, tetapi kebiasaan menginputnya
 * masih dapat diubah untuk perkara berikutnya.
 */
function KetepatanInput({
  ketepatan,
}: {
  ketepatan: NonNullable<Status["analisa"]>["ketepatanInput"];
}) {
  return (
    <div className="mt-2 space-y-1">
      {ketepatan.baris.map((satu) => (
        <div key={`input-${satu.kunci}`} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="min-w-[9rem] flex-1">
            <span className="font-medium">{satu.label}</span>{" "}
            <span className="text-xs text-muted-foreground">
              {tanggalHariPendek(satu.tanggal, satu.tanggal)} →{" "}
              {tanggalHariPendek(satu.diinput, satu.diinput)}
            </span>
          </span>
          <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full",
                satu.poin >= 5
                  ? "bg-emerald-500"
                  : satu.poin >= 2
                    ? "bg-amber-500"
                    : "bg-rose-500"
              )}
              style={{ width: `${(satu.poin / satu.poinMaksimal) * 100}%` }}
            />
          </div>
          <span className="w-32 shrink-0 text-right text-sm text-muted-foreground">
            {satu.sebutan}
          </span>
        </div>
      ))}
      {ketepatan.dasar ? (
        <p className="pt-1 text-sm text-muted-foreground">{ketepatan.dasar}</p>
      ) : null}
    </div>
  );
}
