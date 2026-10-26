"use client";

import { useOverlayHanyaGagal } from "@/lib/global-loading";
import { labelTidakPatut } from "@/lib/label-kepatutan";
import type { CaraRelaas } from "@/server/modules/aleta-bot/whatsapp-gateway-client";

import dynamic from "next/dynamic";
import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { TombolUnduhZip } from "@/components/portal/tombol-unduh-zip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePortal } from "@/lib/app-state";
import { apiPath, withBasePath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import { tanganiUnduhan } from "@/lib/unduh-berkas";
import {
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsDownUp,
  ChevronsUpDown,
  FileSearch,
  FileText,
  Filter,
  Gauge,
  Link2,
  ListChecks,
  ListOrdered,
  MapPin,
  MonitorPlay,
  PenLine,
  Printer,
  RotateCcw,
  SlidersHorizontal,
  Smartphone,
  StickyNote,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";

import { AletaEcourtCetakJadwal } from "@/components/portal/aleta-ecourt-cetak-jadwal";
import { daftarRuangAktif, ruangPilihanBerlaku, saringKeRuang } from "@/lib/ruang-sidang-saring";
import {
  cocokkanRuang,
  susunPencarianJadwal,
  tampilanUrlJadwal,
  type ParameterJadwalTampil,
} from "@/lib/jadwal-tampil-url";
/* === 12OKT-C: kartu ruang sidang & mediator === */
import { PitaRuangSidang } from "@/components/portal/pita-ruang-sidang";
import { BarisTabelRingan, sidik, tabelRinganAktif, useAlatBaris } from "@/components/portal/baris-tabel-ringan";
import { TombolTundaOtomatis } from "@/components/portal/tunda-otomatis-panel";
import { PemilihTanggalSidang } from "@/components/ui/pemilih-tanggal-sidang";
import { TombolBlangkoDerry } from "@/components/portal/tombol-blangko-derry";
import { jenisBlangkoBoleh, jenisBlangkoMenurutKeadaan, saringJenisBlangko } from "@/lib/tautan-blangko-derry";
import { susunPitaRuang } from "@/lib/pita-ruang-sidang";
import { SaksiLipat, useSaksiLipat } from "@/components/portal/saksi-lipat";
import { PetunjukCariPintar } from "@/components/portal/petunjuk-cari-pintar";
import {
  CONTOH_MEDAN_SIDANG,
  KATA_KUNCI_SIDANG,
  MEDAN_SIDANG,
  cocokCariPintar,
  uraiCariPintar,
  uraianKosong,
} from "@/lib/cari-pintar-jadwal";
import { kunciBarisSaksi } from "@/lib/saksi-lipat";
import { keteranganPerluDiperiksa, susunKartuRuang } from "@/lib/kartu-ruang-sidang";
import { mediatorBaris } from "@/lib/mediator-jadwal";
/* === AKHIR 12OKT-C === */
import { KUNCI_VERSI_BAWAAN, pilihanSesudahBawaan, type BawaanDiterima } from "@/lib/tampilan-bawaan";
import { DuaKeadaan, InfoContohSaklar } from "@/components/portal/contoh-tampilan";
import {
  courtCalendarTidakSinkron,
  keadaanCourtCalendar,
  type RencanaCourtCalendar,
} from "@/lib/court-calendar-sinkron";
import {
  penandaHasilMediasi,
  penandaMediator,
  penandaPernahMediasi,
  type MediasiPerkara,
  type PenandaMediasi,
} from "@/lib/penanda-mediasi";
import {
  ChipSaring,
  KepalaUrut,
  PanelCariLanjut,
  cocokTeks,
  dalamRentang,
  useCariLanjut,
  useUrutan,
  urutkan,
} from "@/components/portal/tabel-kendali";
import { formatLencana } from "@/lib/format-lencana";
import { cn } from "@/lib/utils";
import { hasilSidangPutusan } from "@/lib/hasil-sidang";
import { Bagian } from "@/components/portal/bagian-ciut";
import { LencanaPembebananIkrar, PembebananIkrarRincian } from "@/components/portal/pembebanan-ikrar";
import { PenandaJawabanAgenda } from "@/components/portal/penanda-jawaban-agenda";
import type { PembebananIkrar } from "@/lib/pembebanan-ikrar";
import { cocokNamaPenerimaLawan } from "@/lib/nama-penerima-lawan";
import { CatatHasilRingkas } from "@/components/portal/hasil-sidang";
import { IsiIkrarTalak } from "@/components/portal/isi-ikrar-talak";
import { CourtCalendarSidang } from "@/components/portal/court-calendar-sidang";
import { PopupPenetapanKembali, useBolehPenetapanKembali } from "@/components/portal/penetapan-kembali";
import { DialogKasir } from "@/components/portal/kasir-jurnal";
import { DialogKasirHarian, useKasirHarian } from "@/components/portal/kasir-otomatis";
import { MenuAlatJadwal, type ButirMenuAlat } from "@/components/portal/menu-alat-jadwal";
import { bolehMengerjakanKasir } from "@/lib/kasir-jurnal";
import { NamaDapatDipanggil, SaklarPanggil } from "@/components/portal/panggil-petugas";
/* === 12OKT-B: penanda perkara & pihak, panggil saksi === */
import { LencanaPekerjaanBaris, LencanaPerkaraBaris } from "@/components/portal/penanda-perkara-pihak";
import { NamaPihakHadir } from "@/components/portal/pihak-hadir"; /* 12OKT-H */
import { pihakHadirHariIni } from "@/lib/pihak-hadir"; /* 12OKT-H */
import { DaftarNamaSaksi } from "@/components/portal/panggil-saksi";
import type { BahanPenandaBaris, IzinCeraiBaris, LencanaPekerjaanPihak, PenandaPerkaraBaris } from "@/lib/penanda-perkara-pihak";
/* === AKHIR 12OKT-B === */
import { bandingkanKonseptor, type KonseptorSementara } from "@/lib/konseptor-sementara";
import { ChecklistKonseptor, LencanaKesiapanPutusan } from "@/components/portal/checklist-konseptor"; /* F1.6 */
import { LencanaDrafH7, PanelDrafH7 } from "@/components/portal/draf-h7"; /* F4.2 */
import type { RingkasDrafH7 } from "@/lib/agen-h7-putusan";
import { saringPerkaraSendiri } from "@/lib/perkara-sendiri";
import { pitaJarak, sebutanJarak } from "@/lib/jarak-antar-sidang";
import {
  WAKTU_ANTRIAN_KOSONG,
  bacaWaktu,
  hitungTigaJarak,
  kunciWaktu,
  type BarisWaktuAntrian,
  type Jarak,
  type TetanggaJarak,
  type WaktuAntrian,
} from "@/lib/tiga-jarak-sidang";
import {
  LencanaMenungguBerjalan,
  TigaJarakSidang,
  type PatokanWaktu,
} from "@/components/portal/tiga-jarak-sidang";
import { sebabMinutasiTertahan, sudahDiminutasi } from "@/lib/sebab-minutasi-tertahan";
import { sebabBerbauMediasi } from "@/lib/mediasi-sidang";
import { cariHakim, hakimPersis, type Hakim } from "@/lib/cari-hakim";
import {
  KUNCI_SIMPANAN_TAMPILAN,
  SAKLAR_TAMPILAN,
  bacaTampilan,
  jumlahDimatikan,
  kelompokTampilan,
  tampil,
  tampilanBawaan,
  tampilanSemuaMati,
  type PilihanTampilan,
} from "@/lib/tampilan-antrian-sidang";
/* === 12OKT-A: kumulasi perkara === */
import { JenisDenganKumulasi, RincianKumulasi } from "@/components/portal/kumulasi-perkara";
import type { KumulasiPerkara } from "@/lib/kumulasi-perkara";
/* === AKHIR 12OKT-A === */
/* === 12OKT-L: penanda pernah diskors === */
import { PenandaPernahDiskorsView } from "@/components/portal/pernah-diskors";
import { penandaPernahDiskors } from "@/lib/pernah-diskors";
/* === AKHIR 12OKT-L === */
/* === 12OKT-K: sita, eksekusi, eksepsi/rekonvensi === */
import { PenandaSitaAgenda, RincianJawabanSitaEksekusi, type BahanRincianJawabanSita } from "@/components/portal/penanda-sita-agenda";
import type { PenandaJawabanPerkara } from "@/lib/penanda-jawaban";
import type { EksekusiPerkara, SitaPerkara } from "@/lib/penanda-sita";
/* === AKHIR 12OKT-K === */
import {
  keadaanSelesai,
  kunciSelesai,
  modeTampilanAktif,
  namaBerkasRelaas,
  namaDokumenRelaas,
  tampilanModeLengkap,
} from "@/lib/jadwal-sidang-1okt";
import {
  ProsesMediasiRincian,
  TombolLayarPenuh,
  TombolPilihMediator,
  TombolSelesaiSidang,
  useLayarPenuh,
  useSelesaiSidang,
} from "@/components/portal/jadwal-sidang-1okt";
import {
  aksiRuangSidang,
  daftarDiskors,
  petaSidangBerjalan,
  selesaiPerKunciWaktu,
  skorsUntuk,
} from "@/lib/jadwal-sidang-2okt";
import {
  LencanaDiskors,
  LencanaSedangBerjalan,
  KontakPihakRincian,
  TandaAntrianOnline,
  TandaAntrianOnlineRincian,
  TombolRuangSidang,
} from "@/components/portal/jadwal-sidang-2okt";
import { tandaAntrianOnline, type TandaAntrianOnline as TandaOnline } from "@/lib/tanda-antrian-online";
import { bahanKehadiranDariBaris, kunciKehadiran, ringkasKehadiran, susunKehadiran, type KehadiranOrang } from "@/lib/kehadiran-rinci"; /* F3.2 */
import { DaftarHadirRinci, RingkasKehadiran, daftarPilihanHadir, type PilihanHadir } from "@/components/portal/kehadiran-rinci-sidang"; /* F3.2 */
import { EcourtAksiPerkara, EcourtLencanaPutusan } from "@/components/portal/ecourt-aksi-perkara";
import { bolehAksi, bolehAksiLayar, saringSaklarSidang, type PenggunaGolongan } from "@/lib/matriks-peran";
/* 22 Okt 2026: sidang keliling, hakim per perkara, meja panitera sidang, cetak per hakim */
import {
  MejaPaniteraSidang,
  NamaHakimMenyidangkan,
  PemilihHakimBaris,
  SaklarSidangKeliling,
  useKelilingHakim,
} from "@/components/portal/jadwal-keliling-hakim";
import { adaPilihanHakim, kelompokPerHakim, majelisTampil } from "@/lib/jadwal-keliling-hakim";
/** Saklar Sidang keliling mati: tidak ada hakim pengganti yang dipakai. */
const TANPA_PILIHAN_HAKIM = Object.freeze({});
import {
  AGENDA_ELITIGASI,
  AGENDA_MUSYAWARAH,
  KELOMPOK_ALUR,
  KELOMPOK_KEADAAN,
  KUNCI_BELUM_TUNDA_LEWAT_BATAS,
  KUNCI_PERLU_DIPERIKSA,
  NADA_PERLU_DIPERIKSA,
  SEBUTAN_HADIR,
  agendaElitigasi,
  agendaMusyawarah,
  belumTundaLewatBatas,
  hariPutusan,
  hasilSidangBelumDicatat,
  ikrarSelesai,
  kelompokAlur,
  perkaraVerzetDari,
  potensiVerstek,
  putusHariIni,
  sidangSelesaiHariIni,
  sudahPutusHariIni,
  sidangElitigasi,
  sidangIkrar,
} from "@/lib/keadaan-sidang";
import {
  JAM_BATAS_HASIL_SIDANG,
  SAAT_BELUM_TERBACA,
  jedaKeBatasBerikut,
  saatPengadilan,
  type SaatPengadilan,
} from "@/lib/waktu-pengadilan";
import { PITA_WAKTU_PUTUS, pitaWaktuPutus } from "@/lib/pita-waktu-putus";
import {
  BULAN_PANJANG,
  HARI_PENDEK,
  tanggalHariPanjang,
  tanggalHariPendek,
} from "@/lib/tanggal-indonesia";
import { warnaStatusPutusan } from "@/lib/warna-putusan";
import { KELAS_KODE_MAJELIS, KELAS_LENCANA_KODE_MAJELIS } from "@/lib/kode-majelis";
import { GalatJawaban, bacaJsonAman, botTakTerjangkau, useCobaLagiOtomatis } from "@/lib/coba-lagi-otomatis";
import { useHilangSendiri, usePesanSementara } from "@/lib/pesan-sementara";
import { perluMuatPenuh, saringProsesLangsung, terapkanDisidangLangsung } from "@/lib/disidang-langsung";
import { useDisidangLangsung } from "@/components/portal/use-disidang-langsung";
// 22 Okt 2026: pembaruan RINGAN (tunda/putus/kehadiran dalam hitungan detik) + pembaruan setempat sesudah tombol.
import { TandaDiperbarui, buatPenyimpanDiperbarui, useJadwalRingan } from "@/components/portal/use-jadwal-ringan";
import { terapkanHasilTulis, type HasilTulisRingkas } from "@/lib/jadwal-ringan";
import { BannerGangguan } from "@/components/portal/banner-gangguan";
import {
  DATA_VERIFIKASI_KOSONG,
  penandaVerifikasi,
  type DataVerifikasi,
  type Penanda,
} from "@/lib/penanda-verifikasi-ecourt";
import type { KeadaanTarik } from "@/lib/tarik-belum-upload";
import { useTarikBelumUpload } from "@/components/portal/use-tarik-belum-upload";
import { TombolTutupPesan } from "@/components/portal/tombol-tutup-pesan";
import { PanduanPemeriksaanSaksi, type PropsPanduanSaksi } from "@/components/portal/panduan-pemeriksaan-saksi";
import { agendaPembuktianSaksi, keadaanAwalDariSidang, sudahMasukPemeriksaan } from "@/lib/pandu-saksi";
import { relaasBertemu } from "@/lib/hasil-relaas";
import { LencanaKepatutanRelaas, LencanaRetur } from "@/components/portal/lencana-kepatutan-relaas";

/**
 * Dialog Cetak relaas dimuat SAAT DIBUKA, bukan bersama jadwal.
 *
 * Isinya - termasuk rekap relaas yang ditanam di dalamnya - lebih dari dua
 * ribu baris, dan hanya juru sita, admin, serta super admin yang pernah
 * membukanya. Petugas lain yang membuka jadwal tidak perlu menunggu peramban
 * mengurainya. ssr:false: tanggal bawaannya hari ini menurut jam pengadilan.
 */
/**
 * Bahan panduan pertanyaan saksi dari satu baris sidang (18 Okt 2026, permintaan hakim).
 * Dipakai tombol "Pertanyaan saksi" di kolom kanan baris; panduannya sendiri baru dimuat
 * ketika jendela pop-up dibuka.
 */
function bahanPanduDariBaris(baris: SidangBaris, namaPengadilan: string): Omit<PropsPanduanSaksi, "kunciBagian" | "pengguna"> {
  return {
    perkara: {
      nomorPerkara: baris.nomorPerkara,
      jenisPerkaraId: baris.jenisPerkaraId,
      alurPerkaraId: baris.alurPerkaraId,
      jenisPerkara: baris.jenisPerkara,
    },
    sidangId: baris.sidangId,
    tanggalSidang: baris.tanggalSidang,
    agenda: baris.agenda,
    menonjol: agendaPembuktianSaksi(baris.agenda),
    namaPengadilan,
    keadaanAwal: keadaanAwalDariSidang({
      dihadiriOleh: baris.dihadiriOleh,
      verstekPutusan: baris.verstekPutusan,
      tergugatPernahHadir: baris.panggilan?.tergugatPernahHadir,
      kumulasi: baris.kumulasiTerbaca ? baris.kumulasi ?? null : null,
      adaRekonvensi: Boolean(baris.penandaJawaban?.rekonvensi),
    }),
    namaSaksi: { P: baris.saksiNamaPihak1 ?? [], T: baris.saksiNamaPihak2 ?? [] },
  };
}

const DialogCetakRelaas = dynamic(
  () => import("@/components/portal/aleta-ecourt-cetak-relaas").then((m) => m.DialogCetakRelaas),
  { ssr: false }
);

/**
 * Jadwal perkara yang bersidang.
 *
 * ============================================================================
 * SATU BARIS PER SIDANG, RINCIAN SAAT DIBUKA
 * ============================================================================
 *
 * Tabel utama menjawab pertanyaan "hari ini sidang apa saja" - dan itu dijawab
 * dengan nomor perkara, majelis, agenda, dan jam. Seluruh keterangan lain
 * dibuka saat satu sidang dipilih.
 *
 * Menampilkan semuanya sekaligus akan menghasilkan tabel yang tidak dapat
 * dibaca, dan memajang identitas para pihak dari puluhan perkara di satu layar
 * sekaligus - yang tidak diperlukan siapa pun untuk melihat jadwal.
 */

type SidangBaris = {
  sidangId: string;
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  /* === 12OKT-A: kumulasi perkara === */
  /** Kumulasi dari SIPP, atau dari petitum bila SIPP kosong; null = tidak ada. Bot lama: tidak ada. */
  kumulasi?: KumulasiPerkara | null;
  kumulasiTerbaca?: boolean;
  /* === AKHIR 12OKT-A === */
  alurPerkaraId: number;
  /** Nomor jenis perkara SIPP (dikirim bot sejak 18 Okt 2026); dasar panduan pertanyaan saksi. */
  jenisPerkaraId?: number | null;
  /** I28 18 Okt: penetapan mafqud (Lain-Lain Pdt.P; bot membaca petitum/posita); null = tidak diketahui. */
  mafqud?: boolean | null;
  sudahPutus: boolean;
  tanggalPutusan: string;
  statusPutusan: string;
  tanggalMinutasi: string;
  tanggalBht: string;
  tanggalSidang: string;
  jamSidang: string;
  agenda: string;
  ruangan: string;
  ditunda: boolean;
  alasanDitunda: string;
  /** 22 Okt 2026: bendera SIPP sidang_keliling = 'Y' (bot 22 Okt ke atas) - dasar pop-up Sidang keliling. */
  sidangKeliling?: boolean;
  /**
   * Sidang penyaksian ikrar talak, dari kolom `ikrar_talak` milik SIPP.
   *
   * Dipakai penanda biru "Ikrar Talak" dan dipakai MENGECUALIKAN baris ini
   * dari penanda kuning "Hari Putusan" - lihat hariPutusan di bawah.
   *
   * Opsional di sisi layar, sebab jadwal yang sudah tersimpan di peramban
   * sebelum pembaruan ini tidak memuatnya. Yang tidak terbaca dianggap BUKAN
   * ikrar - gagal-tertutup, sama seperti jalur penilaian lain di ALETA.
   */
  sidangIkrarTalak?: boolean;
  /**
   * Sidang ikrar yang ikrarnya SUDAH tercatat di perkara_ikrar_talak pada
   * tanggal sidang ini - walau kolom hasil sidangnya dibiarkan kosong.
   * Dipakai supaya sidang itu tidak ditandai merah "Belum ditunda" sesudah
   * pukul 15:00. Opsional: bot lama tidak mengirimnya, dan yang tidak
   * terbaca dianggap belum tercatat.
   */
  ikrarTercatat?: boolean;
  /**
   * Peta putusan dan peta ikrar di bot TERBACA untuk daftar ini. false (atau
   * tidak terkirim - bot lama) berarti "belum diputus" tidak terbukti, dan
   * tanda merah Belum ditunda diam. Lihat belumTundaLewatBatas di lib.
   */
  putusanTerbaca?: boolean;
  ikrarTerbaca?: boolean;
  /** Tanggal penetapan hari sidang ikrar cerai talak (YYYY-MM-DD, kosong bila belum/tidak terbaca) - lihat ...Terbaca. */
  tanggalPenetapanSidangIkrar?: string;
  tanggalPenetapanSidangIkrarTerbaca?: boolean;
  /**
   * Pembebanan yang dibayar saat ikrar talak (mut'ah, nafkah iddah,
   * madliyah, nafkah anak, ...) - diurai bot dari amar putusan, hanya pada
   * sidang ikrar. null/tidak terkirim = tidak ada atau bot lama. Lihat
   * lib/pembebanan-ikrar.
   */
  pembebanan?: PembebananIkrar | null;
  pembebananTerbaca?: boolean;
  /**
   * Butir 7-9 (6 Okt 2026): mediasi TERAKHIR perkara ini (null = belum pernah)
   * dan tanggal sidang pertama yang dihadiri kedua belah pihak. Tidak terkirim
   * = bot lama; *Terbaca false = kuerinya gagal. Lihat lib/penanda-mediasi.
   */
  mediasi?: MediasiPerkara | null;
  mediasiTerbaca?: boolean;
  /** Butir 21 (6 Okt 2026): rencana Court Calendar perkara ini. Lihat lib/court-calendar-sinkron. */
  courtCalendar?: RencanaCourtCalendar[];
  courtCalendarTerbaca?: boolean;
  sidangLaporanMediasi?: string;
  sidangLaporanMediasiTerbaca?: boolean;
  hadirLengkapPertama?: string;
  hadirLengkapTerbaca?: boolean;
  tanggalSidangBerikut: string;
  urutanSidang: number;
  dihadiriOleh: number | null;
  adaBas: boolean;
  /**
   * Umur perkara, dengan hari mediasi DIKELUARKAN.
   *
   * Dasarnya PERMA 1/2016 Pasal 24 ayat (2) dan (3): jangka waktu mediasi
   * tidak termasuk jangka waktu penyelesaian perkara. Batas penyelesaiannya
   * lima bulan - SEMA 2/2014, 150 hari.
   *
   * Warnanya mengikuti tangga unsur Waktu Putus Perkara SK Dirjen Badilag
   * 048/DJA/SK.KP3.4.3/IV/2024, dinilai bot (waktuPutusSk) atas hari di luar
   * mediasi - sejak 24 September 2026. Hari pendaftaran ikut dihitung, cara
   * SK, dan kelonggaran perkara khusus SK (ghaib 120 hari) DIPOTONG dari
   * hariBersih sejak 24 September 2026 petang, atas permintaan pengguna.
   * Batas lima bulan SEMA 2/2014 tidak mengenal kelonggaran itu, jadi
   * sisaHari dihitung dari hariSema - lihat kedua ruas di bawah.
   *
   * null bila tanggal pendaftarannya tidak terbaca. Bukan nol: nol berarti
   * perkaranya didaftarkan hari ini.
   */
  durasi?: {
    tanggalDaftar: string;
    tanggalPutusan: string;
    sudahPutus: boolean;
    hariTotal: number | null;
    /** hariTotal + 1 - hari pendaftaran ikut dihitung, cara SK. */
    hariKotor?: number | null;
    hariMediasi: number;
    mediasiDibatasi?: boolean;
    hariBersih: number | null;
    /**
     * Kelonggaran perkara khusus SK 048/2024 Tabel 2 nomor 1 yang SUDAH
     * dipotong dari hariBersih (perkara ghaib 120 hari). null bila tidak ada;
     * tidak dikirim bot lama - layar lalu diam tentang kelonggaran, bukan
     * menebaknya.
     */
    kelonggaran?: {
      hari: number;
      hariMentah: number;
      sebab: string;
      sumber?: string[];
      jarakPhsHari?: number | null;
    } | null;
    /**
     * Hari yang dihitung terhadap batas lima bulan SEMA 2/2014: kotor
     * dikurangi mediasi, TANPA kelonggaran SK. sisaHari dihitung dari angka
     * INI, bukan dari hariBersih - SEMA tidak mengenal kelonggaran itu, dan
     * memotongnya pernah menyembunyikan perkara 163 hari sebagai "43 hari,
     * sisa 107". Bot lama tidak mengirimnya; di sana hariBersih memang angka
     * yang sama.
     */
    hariSema?: number | null;
    ambangHari: number;
    sisaHari: number | null;
    /** Nilai tangga waktu putus SK 048/2024 - layar hanya menerjemahkannya ke warna. */
    waktuPutusSk?: {
      nilai: number;
      sebutan: string;
      dariHari: number;
      sampaiHari: number | null;
      sisaDiPita: number | null;
    } | null;
    mediasi: Array<{ mulai: string; selesai: string; hasil: string; mediator: string }>;
  } | null;
  /**
   * turutTergugat/intervensi (butir 23, 6 Okt 2026): dikirim bot tersendiri.
   * tergugat MASIH memuat turut tergugat (pemakai lama: cetak, antrian) -
   * layar ini menyaringnya dari baris T. Lihat pihakTampil.
   */
  pihak: {
    penggugat: string[];
    tergugat: string[];
    saksi?: string[];
    lain?: string[];
    turutTergugat?: string[];
    intervensi?: string[];
  };
  panggilan: {
    hadirSebelumnya: number | null;
    // Tergugat/termohon pernah hadir pada sidang mana pun sebelumnya. Dikirim
    // bot sejak 2.19.4; yang tidak terbaca tidak menutup potensi verstek -
    // lihat potensiVerstek di lib.
    tergugatPernahHadir?: boolean;
    wajibDipanggil: number[];
    belumDipanggil: number;
    // 1 penggugat/pemohon, 2 tergugat/termohon.
    sisiBelumDipanggil?: number[];
    retur: number;
    /** Sebab tiap retur, mis. "Retur - alamat tidak ditemukan (SEMA 1/2023 angka 12 huruf e)". Bot lama: tidak ada. */
    returSebab?: string[];
    aman: boolean;
    /**
     * Berapa hari lagi sidangnya. Negatif berarti sudah lewat, null bila
     * tanggalnya tidak terbaca - dan null BUKAN nol: nol berarti hari ini.
     */
    sisaHariKeSidang?: number | null;
    /**
     * Pihak yang tenggang panggilannya paling genting. Bukan rata-rata: satu
     * panggilan yang tidak patut sudah cukup membatalkan sidangnya.
     */
    tenggangTersempit?: {
      sisi?: number;
      selisih: number | null;
      ambang?: number;
      hariKerja?: boolean;
      /** Surat tercatat: ambang hari antara DITERIMA dan sidang (SEMA 1/2023 angka 11). */
      ambangTerima?: number;
      terimaHariKerja?: boolean;
      patut: boolean | null;
      alasan: string;
      dasarHukum?: string;
      jalur?: string;
    } | null;
    /** Jarak panggilan ke hari sidang kurang dari ambang jalurnya. */
    tenggangMepet?: boolean;
  };
  // Keadaan putusan di e-Court. null bila perkaranya belum putus - dan itu
  // BUKAN masalah, hanya belum waktunya diperiksa.
  putusanEcourt: {
    keadaan: string;
    sebutan: string;
    perluTindakan: boolean;
    keterangan: string;
  } | null;
  majelisKode: string;
  majelisNama: string;
  paniteraNama: string;
  jurusitaNama: string;
  /** Ada tidaknya kuasa hukum pada tiap sisi - mengubah siapa yang dipanggil. */
  adaKuasa?: boolean;
  kuasaPihak1?: boolean;
  kuasaPihak2?: boolean;
  /** Putusan tanpa hadirnya tergugat. Bukan verzet - itu perlawanan TERHADAPnya. */
  verstekPutusan?: boolean;
  /** Naskah putusan sudah diunggah ke SIPP. */
  adaBerkasPutusan?: boolean;
  /** Saksi yang DIAJUKAN tiap sisi - belum tentu sudah diperiksa. */
  saksiPihak1?: number;
  saksiPihak2?: number;
  /** Nama saksi tiap sisi, urut sesuai pengajuannya di SIPP. */
  saksiNamaPihak1?: string[];
  saksiNamaPihak2?: string[];
  /** Terdaftar lewat e-Court - syarat pertama penanda e-Litigasi. */
  lewatEcourt?: boolean;
  /* === 12OKT-B: penanda perkara & pihak (ruas opsional; bot lama tidak mengirimnya) === */
  /** Peta e-Court terbaca - tanpa ini "non e-Court" TIDAK ditandai. */
  ecourtTerbaca?: boolean;
  penandaPerkara?: PenandaPerkaraBaris | null;
  /** 26 Okt 2026: sumber prodeo ("flag-sipp" | "ecourt") untuk keterangan lencana. */
  penandaProdeoSumber?: string[] | null;
  penandaPihak?: LencanaPekerjaanPihak[] | null;
  /** 14 Okt 2026: izin cerai pihak PNS/ASN (PPPK)/TNI/POLRI - lihat aleta_bot/services/izinCeraiService.js. */
  izinCerai?: IzinCeraiBaris | null;
  /* === AKHIR 12OKT-B === */
  /* === 12OKT-K: eksepsi/rekonvensi (sudah dikirim sejak 6 Okt), sita, eksekusi (ruas opsional) === */
  penandaJawaban?: PenandaJawabanPerkara | null;
  penandaJawabanTerbaca?: boolean;
  sita?: SitaPerkara | null;
  eksekusi?: EksekusiPerkara[];
  sitaTerbaca?: boolean;
  /* === AKHIR 12OKT-K === */
};

/**
 * Antrian sidang untuk satu perkara.
 *
 * ============================================================================
 * NOMORNYA DATANG DARI BOT, TIDAK PERNAH DIHITUNG DI SINI
 * ============================================================================
 *
 * Nomor antrian sudah diberitahukan kepada pihak berperkara lewat WhatsApp.
 * Menghitungnya ulang di peramban - misalnya dengan mengurutkan baris yang
 * kebetulan sedang tampil - akan menghasilkan angka yang berbeda begitu
 * jadwalnya disaring, dan layar yang menyebut nomor lain dari yang diterima
 * orang lebih buruk daripada layar yang tidak menyebut nomor sama sekali.
 *
 * nomor null berarti perkaranya terdaftar di mesin antrian tetapi belum ada
 * yang mengambil - berbeda dari perkara yang tidak terdaftar sama sekali,
 * yang tidak punya baris di peta ini.
 */
type AntrianBaris = {
  nomor: number | null;
  tanggalSidang: string;
  waktuAmbil: string;
  online: boolean;
  pihak1: string;
  pihak2: string;
  saksi: string;
  keadaan: "menunggu" | "dipanggil" | "belum-ambil";
  /**
   * Sudah berapa menit menunggu giliran - dihitung basis data mesin antrian
   * sendiri, bukan oleh Node maupun peramban.
   *
   * null berarti TIDAK dihitung: sudah dipanggil masuk, atau belum ada yang
   * mengambil nomor. Nol berarti baru saja mengambil - keadaan yang sungguh
   * terjadi, dan berbeda sama sekali dari null.
   */
  menitMenunggu?: number | null;
  jamPanggil: string;
  noRuang: number | null;
  ruanganId: number | null;
  namaPetugas: string;
  majelisKode: string;
};

type KeadaanAntrian = {
  terbaca: boolean;
  alasan: string;
  tanggal: string[];
  jumlahDiambil?: number;
  peta: Record<string, AntrianBaris>;
  /** F3.2: kehadiran rinci per orang, kunci "perkaraId|YYYY-MM-DD" (bot 17 Okt 2026 ke atas). */
  kehadiran?: Record<string, { hadir: KehadiranOrang[] }>;
};

type Penghambat = {
  tingkat: "berat" | "sedang" | "ringan";
  kunci: string;
  pesan: string;
  sumber: string;
};

type KesiapanRingkas = {
  skor: number;
  keadaan: "siap" | "perhatian" | "bermasalah";
  penghambat: Penghambat[];
};

/**
 * Nama jalur panggilan untuk ditampilkan.
 *
 * "pengumuman" ditambahkan 22 September 2026 bersama perbaikan pembaca sandi
 * ket_temu: panggilan lewat radio, media massa, papan pengumuman pengadilan,
 * dan papan pengumuman Pemda dulu ikut jatuh ke salah satu dari ketiga nama
 * di bawah - paling sering ke "Elektronik (e-Summons)", yang keliru pada
 * ketiga-tiganya.
 */
const NAMA_JALUR: Record<string, string> = {
  elektronik: "Elektronik (e-Summons)",
  surat_tercatat: "Surat tercatat",
  pengumuman: "Pengumuman (radio, media, papan pengumuman)",
  biasa: "Jurusita (panggilan biasa)",
};

type PihakPanggilan = {
  nama: string;
  peran: string;
  persetujuan: "setuju" | "tidak_setuju" | "belum";
  seharusnya: "elektronik" | "surat_tercatat" | "biasa";
  terlaksana: string;
  sudahDikirim: boolean;
  belumDipanggil: boolean;
  // Benar bila pihak ini hadir pada sidang sebelumnya - ia sudah diberitahu
  // di ruang sidang, jadi tidak ada panggilan yang perlu ditagih.
  tidakPerluDipanggil?: boolean;
  salahSaluran: boolean;
  /**
   * Sandi relaas SIPP bertentangan dengan e-Court - mis. 'E' (Panggilan
   * Elektronik) untuk pihak yang tidak punya email di e-Court dan tidak pernah
   * dikirimi e-Summons. BUKAN salah saluran: yang perlu dibetulkan catatannya,
   * bukan panggilannya. Lihat ecourtPanggilanService di bot.
   */
  catatanSaluran?: string;
  sandiRelaas?: string;
  tanggalPanggilan: string | null;
  diterima: boolean | null;
  buktiPenerimaan: string;
  noResiPos: string;
  tanggalPelaksanaanRelaas: string | null;
  kepatutan: {
    patut: boolean | null;
    selisih: number | null;
    ambang: number;
    hariKerja: boolean;
    dasarHukum: string;
    perluDiterima: boolean;
    alasan: string;
  };
};

type Kesiapan = KesiapanRingkas & {
  panggilan: {
    lewatEcourt: boolean;
    pihak: PihakPanggilan[];
    ringkasan: {
      jumlahPihak: number;
      belumDipanggil: number;
      salahSaluran: number;
      /** Sandi relaas SIPP yang bertentangan dengan e-Court - lihat catatanSaluran. */
      saluranBelumPasti?: number;
      tidakPatut: number;
      penerimaanBelumTerbukti: number;
      patut: number;
    };
  };
};

type Rincian = {
  sipp: {
    majelis: Array<{ kode: string; nama: string; jabatan: string }>;
    panitera: Array<{ kode: string; nama: string }>;
    jurusita: Array<{ kode: string; nama: string }>;
    saksi: {
      /** Ada keterangan saksi yang tercatat - saksi yang sudah DIPERIKSA. */
      ada: boolean;
      jumlahSaksi: number;
      jumlahKeterangan: number;
      /** Saksi yang DIAJUKAN tiap sisi - belum tentu sudah diperiksa. */
      diajukanPihak1: number;
      diajukanPihak2: number;
      adaDiajukan: boolean;
    };
    relaas: Array<{
      id: string;
      namaPihak: string;
      peran: string;
      tanggalRelaas: string;
      bertemu: boolean;
    caraRelaas?: CaraRelaas;
      retur: boolean;
      noResiPos: string;
      jurusitaNama: string;
      // Ruas berikut SUDAH dikirim jembatan sejak lama, hanya tidak pernah
      // disebut di tipe ini - sehingga tidak pernah tampil. Tanggal kirim ke
      // pos dan nomor resi adalah yang ditanya orang saat panggilan lewat
      // surat tercatat dipersoalkan, dan keduanya ada di SIPP sejak awal.
      sidangId?: string;
      tanggalSidang?: string;
      tanggalKirimPos?: string;
      statusPos?: number | null;
      ketHasilRelaas?: string;
      pihakKe?: number | null;
      // Benar bila namanya diambil dari penugasan jurusita pada perkara,
      // bukan dari baris relaasnya sendiri - lihat catatan di rincianSidang.
      jurusitaDariPenugasan?: boolean;
      adaDokumen: boolean;
      adaResi: boolean;
    }>;
    petitum?: { ada: boolean; berkas: string };
    dokumenSipp: Array<{
      id: string;
      namaDokumen: string;
      namaFile: string;
      ukuranByte: number;
      keterangan: string;
    }>;
    putusan: {
      sudahPutus: boolean;
      tanggalPutusan: string;
      statusPutusan: string;
      verstek: boolean;
      tanggalCabut: string;
      tanggalGugur: string;
      tanggalMinutasi: string;
      tanggalBht: string;
      amarRingkas: string;
      adaBerkasPutusan: boolean;
      adaBerkasAnonim: boolean;
      aktaCerai: {
        nomor: string;
        tanggal: string;
        nomorSeri: string;
        diserahkanPihak1: string;
        diserahkanPihak2: string;
        adaBerkas: boolean;
      } | null;
      upayaHukum: Array<{ jenis: string; tanggal: string }>;
    } | null;
    // Siapa yang menyusun naskah putusan. Terbaca dari jejak tahapan SIPP,
    // bukan dari tabel putusan - karena itu dapat tidak terbaca sama sekali,
    // dan itu keadaan yang harus dikatakan, bukan disamarkan jadi kosong.
    konseptor?: {
      terbaca: boolean;
      alasan: string;
      baris: Array<{ pengguna: string; nama: string; namaTerbaca: boolean; tanggal: string; dariAudit?: boolean }>;
    } | null;
    jadwalPerkara: Array<{
      sidangId: string;
      tanggalSidang: string;
      jamSidang: string;
      agenda: string;
      ruangan: string;
      ditunda: boolean;
      alasanDitunda: string;
      urutanSidang: number;
      dihadiriOleh: number | null;
      adaBas: boolean;
    }>;
  } | null;
  pesanSipp: string;
  ecourt: Array<{
    documentKey: string;
    judulDokumen: string;
    jenisDokumen: string;
    peranPengunggah: string;
    statusVerifikasi: string;
    adaPdf: boolean;
    adaWord: boolean;
    /**
     * Tanggal sidang tempat dokumen ini dipertukarkan.
     *
     * SUDAH dikirim bot sejak lama (sippKonteksService.dokumenPerkara), hanya
     * tidak pernah disebut di tipe ini - jadi tidak pernah dapat dipakai.
     * Kosong pada sebagian besar baris sampai jembatan e-Court menuliskannya;
     * yang memakainya harus menyiapkan keadaan kosong itu.
     */
    tanggalSidang?: string | null;
    /**
     * BERAPA berkas yang tercatat pernah diunduh tetapi tidak ada di cakram.
     *
     * ANGKA, bukan benar-salah. Bot mengirim angka sejak awal
     * (ecourtStoreService rincianArsipPerkara: berkasHilang: catatan.hilang),
     * dan tipe ini menyebutnya boolean - sehingga jumlahnya tidak akan pernah
     * dapat ditampilkan, dan yang lebih buruk: dokumen yang arsipnya RUSAK
     * tampak sama dengan dokumen yang memang belum diunggah. Hakim membaca
     * "belum tersimpan" lalu menyuruh pihak mengunggah ulang, padahal yang
     * rusak arsip kita sendiri.
     */
    berkasHilang?: number;
  }>;
  pesanEcourt: string;
  pihak: Array<{
    nama: string;
    pihakKe: number | null;
    jenis: string;
    adaNomor: boolean;
    nomorSamar: string;
    statusVerifikasi: string;
  }>;
  kesiapan: Kesiapan | null;
  identitas: {
    jenisPerkara: string;
    kumulasi: string[];
    adaKumulasi: boolean;
    adaKuasa: boolean;
    kuasaPenggugat: boolean;
    kuasaTergugat: boolean;
  } | null;
};

/**
 * ============================================================================
 * PENANDA "DITERIMA PIHAK LAWAN?"
 * ============================================================================
 *
 * Panggilan sidang untuk TERGUGAT yang ternyata diterima orang bernama sama
 * dengan PENGGUGAT layak dilihat majelis sebelum verstek dijatuhkan:
 * tergugatnya boleh jadi tidak pernah sungguh tahu ada sidang.
 *
 * Aturan pencocokannya di @/lib/nama-penerima-lawan - beserta seluruh angka
 * pengukurannya atas relaas satker, termasuk sebab ambangnya 0,85.
 *
 * MERAH, DAN TETAP BERTANDA TANYA
 * ============================================================================
 *
 * Merah di layar ini berarti "menuntut perlakuan berbeda" - sebutan yang sama
 * dipakai verzet dan relaas retur. Itu tepat di sini: yang diminta bukan
 * kesimpulan bahwa panggilannya cacat, melainkan bahwa ia diperiksa sebelum
 * verstek dijatuhkan.
 *
 * Merah baru dapat dipakai karena ia JARANG. Terukur 10 dari 11.150 relaas
 * yang dapat dinilai - 0,09%. Penanda merah yang menyala pada satu dari
 * sepuluh baris akan dipelajari orang untuk dilewati dalam sepekan.
 *
 * Tanda tanyanya TETAP, dan itu bukan kehati-hatian basa-basi. Yang diketahui
 * mesin hanya bahwa NAMAnya cocok - Donggala punya nama yang berulang, dan
 * "Nurlina" yang menerima surat belum tentu "Nurlina" yang menggugat.
 * Warnanya boleh menuntut perhatian; kalimatnya tidak boleh menuduh.
 *
 * Judul gantungnya menyebut kata pemicu DAN nama lawannya, supaya yang membaca
 * dapat membantahnya sendiri dalam satu tarikan napas tanpa membuka SIPP.
 */
function PenandaPenerimaLawan({
  baris,
  pihak,
}: {
  baris: { pihakKe?: number | null; ketHasilRelaas?: string };
  pihak: Array<{ nama: string; pihakKe: number | null }>;
}) {
  const hasil = cocokNamaPenerimaLawan({
    pihakKe: baris.pihakKe,
    ketHasilRelaas: baris.ketHasilRelaas,
    pihak,
  });
  if (!hasil.cocok) return null;
  return (
    <span
      className="ml-1 inline-flex items-center rounded-full border border-red-500 bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white dark:border-red-400 dark:bg-red-700 dark:text-red-50"
      title={`Keterangan relaas menyebut "${hasil.kataPemicu}", mirip nama pihak lawan: ${hasil.namaLawan}. Perlu diperiksa sebelum verstek - boleh jadi hanya kebetulan senama.`}
    >
      Diterima pihak lawan?
    </span>
  );
}

// ─── Aturan keadaan sidang ada di @/lib/keadaan-sidang ──────────────────────
//
// Seluruhnya MURNI - masuk data, keluar keputusan - dan seluruhnya dipindahkan
// ke sana beserta catatannya. Sebabnya bukan panjang berkas ini, melainkan
// pengujiannya: komponen ini tidak dapat dirender di lingkungan pengujian,
// sehingga ujinya dulu memakai SALINAN TANGAN tiap aturan - dan salinan yang
// menyimpang LOLOS, menguji aturan yang tidak pernah dikirim ke siapa pun.
//
// Yang tinggal di sini apa pun yang menggambar: warna, lencana, tata letak.

// warnaStatusPutusan pindah ke @/lib/warna-putusan - lihat impor di atas.
//
// Layar Status Perkara ikut mewarnai status yang sama, dan menyalin aturannya
// ke sana akan sama-sama bekerja - lalu pada suatu hari satu layar
// menghijaukan status yang dimerahkan layar lain, untuk perkara yang persis
// sama, dan tidak seorang pun tahu mana yang benar.

/** Ringkasan jumlah sidang per kelompok alur. */
/**
 * ============================================================================
 * NILAI YANG DIURUTKAN UNTUK TIAP KOLOM
 * ============================================================================
 *
 * Bukan teks yang tampil di layar, melainkan nilai yang MASUK AKAL diurutkan.
 * Kolom Putusan menampilkan lencana berwarna, tetapi yang diurutkan tanggal
 * putusannya; kolom Siap menampilkan lingkaran, yang diurutkan angkanya.
 *
 * Mengurutkan menurut yang tampil akan mengurutkan menurut kata "belum putus"
 * dan "Putus" - berurut menurut abjad, dan tidak berarti apa-apa.
 */
function nilaiUrutSidang(
  baris: SidangBaris,
  kunci: string,
  kesiapan: Record<string, KesiapanRingkas>,
  antrian: Record<string, AntrianBaris>
): unknown {
  switch (kunci) {
    case "jam":
      // Tanggalnya ikut, sebab rentang beberapa hari menampilkan jam yang
      // sama dari hari yang berbeda - mengurut jam saja mencampurnya.
      return `${baris.tanggalSidang} ${baris.jamSidang}`;
    case "antrian": {
      // Yang belum mengambil dan yang tanpa antrian sama-sama dikembalikan
      // kosong, sehingga keduanya jatuh ke bawah tanpa memandang arah - yang
      // dicari saat mengurut kolom ini memang yang sudah punya nomor.
      const punya = antrianUntuk(antrian, baris);
      return punya && punya.nomor ? punya.nomor : "";
    }
    case "perkara":
      return baris.nomorPerkara;
    case "agenda":
      return baris.agenda;
    case "majelis":
      return baris.majelisKode || baris.majelisNama;
    case "petugas":
      return baris.paniteraNama || baris.jurusitaNama;
    case "ruang":
      return baris.ruangan;
    case "putusan":
      // Yang belum putus dikembalikan kosong, sehingga ia jatuh ke bawah
      // tanpa memandang arah - yang dicari saat mengurut kolom ini memang
      // yang sudah putus.
      return baris.sudahPutus ? baris.tanggalPutusan || "0000-00-00" : "";
    case "siap": {
      const nilai = kesiapan[`${baris.nomorPerkara}|${baris.sidangId}`];
      return nilai ? nilai.skor : "";
    }
    default:
      return "";
  }
}

/**
 * ============================================================================
 * KEADAAN YANG DAPAT DISARING
 * ============================================================================
 *
 * Tiap keadaan adalah satu pertanyaan yang benar-benar ditanya sebelum sidang:
 * mana yang sudah putus, mana yang returnya belum beres, mana yang pihaknya
 * belum dipanggil sama sekali.
 *
 * Warnanya menyebut ARTI, bukan selera: yang menuntut tindakan berwarna merah,
 * yang perlu diperhatikan kuning, yang sudah beres hijau.
 *
 * Digabung dengan "atau" - menyalakan retur dan ditunda sekaligus berarti
 * "tunjukkan yang bermasalah", dan itu memang yang dicari.
 */
type KeadaanSidang = {
  kunci: string;
  label: string;
  /**
   * Label pendek untuk deretan padat.
   *
   * Hanya bagi kotak yang mengulang kata yang SUDAH berdiri sebagai judul
   * kelompoknya: di bawah ANTRIAN, "Sudah ambil antrian" kehilangan kata
   * "antrian"; di bawah PUTUSAN, "Sudah putus" kehilangan kata "putus". Yang
   * utuh tidak hilang - ia tetap terbaca pada judul gantung (title) bersama
   * keterangan panjangnya.
   *
   * Diukur atas deretan yang sungguhnya digambar layar ini: pada lebar isi
   * 1.400 piksel, dua baris kotak menjadi satu - 68 piksel menjadi 27.
   */
  labelPendek?: string;
  nada: "bahaya" | "awas" | "aman" | "sejuk" | "netral";
  // Pertanyaan yang dijawab kotak ini - lihat KELOMPOK_KEADAAN di lib.
  // Deretan di layar digambar per kelompok, dan ujinya memeriksa daftar di
  // bawah ditulis berkelompok pula. Kosong HANYA pada kotak gabungan "Perlu
  // diperiksa": ia berdiri di luar kelompok mana pun - daftar pekerjaan,
  // bukan saringan - dan digambar paling depan dengan pemisahnya sendiri.
  kelompok?: (typeof KELOMPOK_KEADAAN)[number]["kunci"];
  judul: string;
  // Peta antrian ikut dikirim karena tiga keadaan terakhir menanyakannya.
  // Menaruhnya sebagai argumen, bukan menutupnya di dalam closure, membuat
  // daftar ini tetap dapat diuji tanpa merender komponennya.
  //
  // Saat pengadilan ikut dikirim dengan alasan yang sama: kotak gabungan
  // "Perlu diperiksa" menanyakan apakah pukul 15:00 WITA pada hari sidangnya
  // sudah lewat. Kotak lain mengabaikannya.
  cocok: (
    baris: SidangBaris,
    antrian: Record<string, AntrianBaris>,
    saat: SaatPengadilan
  ) => boolean;
};

/**
 * Sakelar penanda "Putusan e-Court".
 *
 * ============================================================================
 * DIMATIKAN, DAN SEBABNYA DITULIS - BUKAN DIHAPUS DIAM-DIAM
 * ============================================================================
 *
 * Penandanya menyatakan "sudah putus, tetapi putusannya belum beres di
 * e-Court". Yang sebenarnya diperiksa bukan itu: ia membandingkan keadaan
 * SIPP dengan catatan e-Court di ALETA, dan catatan itu kosong pada perkara
 * yang penarikan e-Courtnya memang belum pernah dijalankan.
 *
 * Akibatnya penandanya menyala pada perkara yang tidak bermasalah sama sekali
 * - hanya belum pernah ditarik. Tuduhan yang salah pada layar jadwal jauh
 * lebih merugikan daripada penanda yang tidak ada: seseorang akan mengejar
 * perkara yang tidak perlu dikejar.
 *
 * Nyalakan kembali HANYA sesudah pemeriksaannya membedakan "belum pernah
 * ditarik" dari "sudah ditarik dan memang belum terbit". Sampai saat itu,
 * seluruh jalurnya tetap ada di kode dan hanya tidak digambar.
 */
const TAMPILKAN_PUTUSAN_ECOURT = false;

/**
 * Penanda satuan. Kotak gabungan di bawah disusun DARI daftar ini, dan itu
 * sebabnya keduanya terpisah: kotak gabungan yang berada di dalam daftar yang
 * ia sapu akan menyapu dirinya sendiri.
 */
const KEADAAN_DASAR: KeadaanSidang[] = [
  // ==========================================================================
  // URUTANNYA MENURUT KELOMPOK, LALU MENURUT NADA - LIHAT KELOMPOK_KEADAAN
  // ==========================================================================
  //
  // Panggilan, jalannya sidang, putusan, antrian. Di dalam kelompok yang
  // menuntut tindakan lebih dulu (URUTAN_NADA di lib). Deretan di layar
  // digambar per kelompok dari daftar ini, dan ujinya memeriksa urutan
  // tulisnya - kotak baru ditaruh di kelompoknya, bukan di ujung daftar.
  //
  // Sebelumnya lima belas kotak berjajar menurut urutan penambahannya, dan
  // yang berkaitan berjauhan: "Tidak perlu dipanggil" sembilan kotak dari
  // "Belum dipanggil", "Belum putus" dua kotak dari "Sudah putus".

  // --- PANGGILAN: sudahkah pihaknya dipanggil, sampaikah panggilannya -------
  {
    kunci: "retur",
    label: "Retur",
    nada: "bahaya",
    kelompok: "panggilan",
    judul: "Ada relaas yang kembali tidak terlaksana. Panggilan harus diulang.",
    cocok: (x) => x.panggilan.retur > 0,
  },
  {
    kunci: "belum-dipanggil",
    label: "Belum dipanggil",
    labelPendek: "Belum",
    nada: "bahaya",
    kelompok: "panggilan",
    judul: "Masih ada pihak yang wajib dipanggil dan relaasnya belum ada.",
    cocok: (x) => x.panggilan.belumDipanggil > 0,
  },
  {
    // ========================================================================
    // TENGGANG MEPET - ATURANNYA TIDAK DIKARANG DI LAYAR INI
    // ========================================================================
    //
    // Angkanya datang dari bot, yang menurunkannya dari ecourtPanggilanService:
    // elektronik 3 hari kalender (SK KMA 363/2022), surat tercatat 6 hari
    // kalender dan wajib terbukti diterima, panggilan biasa 3 hari KERJA
    // (Pasal 122 HIR). Jalurnya pun tidak ditebak - ia dibaca dari sandi
    // ket_temu pada relaasnya.
    //
    // Menyala juga ketika sidangnya sudah dekat sementara pihak wajibnya belum
    // punya relaas sama sekali. Keadaan itu tidak menghasilkan "tenggang
    // kurang" - tidak ada tanggal yang dapat dibandingkan - padahal justru ia
    // yang paling genting. Diukur 23 September 2026 atas 20 sidang empat belas
    // hari ke depan: 6 menyala, seluruhnya karena sebab itu.
    //
    // Nadanya "bahaya", jadi ia otomatis masuk kotak gabungan "Perlu
    // diperiksa" - penyaringnya membaca nada, bukan daftar tersendiri.
    kunci: "tenggang-mepet",
    label: "Tenggang mepet",
    labelPendek: "Mepet",
    nada: "bahaya",
    kelompok: "panggilan",
    judul:
      "Jarak panggilan ke hari sidang kurang dari ambang yang berlaku untuk jalurnya - " +
      "SK KMA 363/2022 untuk e-Summons, SEMA 1/2023 angka 11 untuk surat tercatat, Pasal 146 RBg untuk panggilan biasa.",
    cocok: (x) => x.panggilan.tenggangMepet === true,
  },
  {
    kunci: "tidak-dipanggil",
    label: "Tidak perlu dipanggil",
    labelPendek: "Tidak perlu",
    nada: "netral",
    kelompok: "panggilan",
    judul:
      "Tidak ada pihak yang wajib dipanggil untuk sidang ini - semuanya hadir pada sidang sebelumnya.",
    cocok: (x) => x.panggilan.wajibDipanggil.length === 0,
  },

  // --- JALANNYA SIDANG: verstek, ditunda, berita acara, pertama, e-litigasi --
  // Butir 21 (6 Okt 2026): perkara e-Litigasi yang sidangnya tidak sesuai Court
  // Calendar - merah, sebab para pihak membaca jadwal di e-Court. Hanya yang
  // TERBUKTI tidak sinkron; lihat @/lib/court-calendar-sinkron.
  {
    kunci: "cc-tidak-sinkron",
    label: "Court Calendar tidak sinkron",
    labelPendek: "CC tidak sinkron",
    nada: "bahaya",
    kelompok: "sidang",
    judul:
      "Perkara e-Litigasi yang kedua belah pihaknya pernah hadir dan sudah melewati laporan hasil mediasi, tetapi Court Calendar-nya belum dibuat, tidak memuat tanggal sidang ini, atau tujuan agendanya berbeda. Kalimatnya tidak harus sama - yang dibandingkan tahapannya (jawaban, replik, pembuktian, putusan, ...).",
    cocok: (x) => courtCalendarTidakSinkron(x),
  },
  {
    // ========================================================================
    // POTENSI VERSTEK - DARI SIDANG SEBELUMNYA; ATURANNYA potensiVerstek DI LIB
    // ========================================================================
    //
    // Dulu hanya tulisan kecil di dalam baris, dan menyala pada sidang
    // pertama yang hanya dihadiri penggugat - keliru: tergugat yang tidak
    // datang pada sidang pertama baru dipanggil sekali lagi. Kini kotak
    // keadaan yang dapat menyaring, dan yang dibaca sidang SEBELUMNYA.
    //
    // Kuning, bukan merah. Ia gejala yang perlu disiapkan - kepatutan
    // panggilan tergugat diperiksa, naskah verstek disiapkan - bukan
    // pekerjaan yang membatalkan sidangnya bila tidak diurus. Merah akan
    // memasukkannya ke kotak gabungan "Perlu diperiksa", dan itu salah alamat.
    kunci: "potensi-verstek",
    label: "Potensi verstek",
    nada: "awas",
    kelompok: "sidang",
    judul:
      "Pada sidang sebelumnya hanya penggugat/pemohon yang hadir dan tergugat/termohon belum pernah hadir; bila hari ini pun tergugat tidak datang, jalan putusan verstek terbuka. Keputusannya milik majelis.",
    // 22 Okt 2026: sidang yang sudah diputus hari ini tidak lagi "potensi" verstek.
    cocok: (x) => potensiVerstek(x) && !sudahPutusHariIni(x),
  },
  {
    kunci: "ditunda",
    label: "Ditunda",
    nada: "awas",
    kelompok: "sidang",
    judul: "Sidang ditunda ke tanggal lain.",
    cocok: (x) => x.ditunda,
  },
  {
    // ========================================================================
    // BELUM TUNDA - SIDANG YANG HASILNYA BELUM DICATAT SAMA SEKALI
    // ========================================================================
    //
    // Tiap sidang berakhir pada salah satu dari dua hal: DITUNDA ke tanggal
    // lain, atau DIPUTUS. Yang belum keduanya berarti hasilnya belum dicatat -
    // sidangnya sudah berjalan tetapi panitera sidang belum menekan apa pun.
    //
    // Ia BUKAN kebalikan "Ditunda". Perkara yang diputus hari ini juga tidak
    // ditunda, dan menghitungnya sebagai pekerjaan yang tertinggal akan
    // mengirim panitera memeriksa perkara yang sudah selesai. Karena itu
    // syaratnya dua: belum ditunda DAN belum putus hari ini.
    //
    // Kuning, bukan merah: pada pagi hari sebagian besar sidang memang belum
    // berhasil - merah akan menyalakan seluruh daftar tiap hari sebelum
    // sidang pertama dimulai.
    kunci: "belum-tunda",
    label: "Belum tunda",
    nada: "awas",
    kelompok: "sidang",
    judul:
      "Hasil sidangnya belum dicatat: belum ditunda ke tanggal lain, belum diputus hari ini, dan kolom hasil sidangnya di SIPP masih kosong. Selama masih begini, agenda sidang berikutnya tidak terbentuk. Sejak pukul 15:00 WITA pada hari sidangnya, sidang ini ikut dihitung di Perlu diperiksa dan barisnya diberi tanda merah Belum ditunda.",
    // Memakai sudahPutusHariIni, bukan putusHariIni: kotak ini berbunyi "hasil
    // sidangnya BELUM DICATAT", dan perkara yang alasan_ditunda-nya sudah
    // berbunyi "putus DIKABULKAN (verstek)" jelas sudah dicatat - hanya baris
    // putusannya yang belum dibuat. Menagihnya di sini berarti menagih
    // pekerjaan yang sudah dikerjakan.
    //
    // Sejak 24 September 2026 aturannya hasilSidangBelumDicatat di lib - satu
    // fungsi dengan kotak gabungan dan tanda merah di baris (yang di dalamnya
    // tetap memakai sudahPutusHariIni). Syarat barunya kolom hasil yang
    // kosong: sidang ikrar talak yang sudah dicatat "telah ikrar talak" (127
    // baris, 2025 - September 2026) tidak lagi tertagih.
    cocok: (x) => hasilSidangBelumDicatat(x),
  },
  {
    kunci: "belum-bas",
    label: "Belum ada BAS",
    labelPendek: "Belum BAS",
    nada: "awas",
    kelompok: "sidang",
    judul: "Berita acara sidang belum diunggah ke SIPP.",
    cocok: (x) => !x.adaBas,
  },
  {
    kunci: "sidang-pertama",
    label: "Sidang pertama",
    nada: "sejuk",
    kelompok: "sidang",
    judul: "Sidang pertama pada perkara ini.",
    cocok: (x) => x.urutanSidang <= 1,
  },
  {
    kunci: "e-litigasi",
    label: "e-Litigasi",
    nada: "sejuk",
    kelompok: "sidang",
    judul:
      "Perkara terdaftar lewat e-Court DAN agendanya tahapan yang dipertukarkan elektronik: jawaban, replik, duplik, duplik rekonvensi, kesimpulan, musyawarah majelis, atau pembacaan putusan/penetapan/putusan sela - selain sidang pertama, yang selalu dihadiri. Di tabel, tulisan agendanya merah (dapat dimatikan di menu Tampilan).",
    cocok: (x) => sidangElitigasi(x),
  },

  // --- PUTUSAN: berdirikah perkaranya di hadapan putusannya hari ini --------
  // ==========================================================================
  // "Putusan e-Court" SENGAJA TIDAK DITAMPILKAN - LIHAT TAMPILKAN_PUTUSAN_ECOURT
  // ==========================================================================
  //
  // Penandanya menuduh perkara yang sebenarnya tidak bermasalah, karena
  // keadaan e-Court yang dibacanya belum tentu pernah ditarik. Dimatikan
  // sampai pemeriksaannya benar-benar membandingkan keadaan yang sama.
  //
  // Definisinya TIDAK dihapus: menghapusnya berarti menulis ulang seluruhnya
  // ketika pemeriksaannya sudah benar, dan yang salah bukan definisinya
  // melainkan data yang dibacanya.
  ...(TAMPILKAN_PUTUSAN_ECOURT
    ? [
        {
          kunci: "putusan-ecourt",
          label: "Putusan e-Court",
          nada: "bahaya" as const,
          kelompok: "putusan" as const,
          judul: "Sudah putus, tetapi putusannya belum beres di e-Court.",
          cocok: (x: SidangBaris) => Boolean(x.putusanEcourt?.perluTindakan),
        },
      ]
    : []),
  {
    // ========================================================================
    // BELUM MINUTASI - DAN MENGAPA IA BUKAN SEKADAR "tanggal_minutasi KOSONG"
    // ========================================================================
    //
    // Lencananya sudah lama ada di dalam kolom Putusan. Yang belum ada:
    // kotaknya sendiri, sehingga tunggakan minutasi tidak dapat DISARING -
    // dan yang mengurus minutasi harus membaca seluruh baris satu per satu.
    //
    // Syaratnya DUA sumber, bukan satu, dan itu yang menentukan:
    //
    //     sudahPutus           perkaranya punya baris di perkara_putusan
    //     sudahPutusHariIni    hasil sidangnya berbunyi putus, walau baris
    //                          putusannya belum dibuat sama sekali
    //
    // Terukur pada SIPP setempat, dan angkanya yang membuat jalur kedua
    // wajib ada:
    //
    //     perkara_putusan                     9.993 baris
    //     di antaranya tanggal_minutasi kosong    0
    //
    // Nol. Begitu barisnya lahir, SIPP selalu punya tanggal minutasinya -
    // sehingga kotak yang hanya membaca perkara_putusan TIDAK AKAN PERNAH
    // menyala satu kali pun, dan akan terbaca sebagai "tidak ada tunggakan".
    //
    // Tunggakannya justru pada perkara yang barisnya BELUM ADA:
    //
    //     sidang yang hasilnya berbunyi putus              4.034
    //     di antaranya tanpa satu baris putusan pun           12
    //
    // Dua belas perkara itulah yang diputus di ruang sidang dan tidak pernah
    // sampai ke SIPP. Tanpa jalur kedua, tidak ada satu pun layar yang
    // menyebutkannya.
    kunci: "belum-minutasi",
    label: "Belum minutasi",
    labelPendek: "Belum minutasi",
    nada: "bahaya",
    kelompok: "putusan",
    judul:
      "Perkaranya sudah putus - baik tercatat di SIPP maupun menurut hasil sidangnya - tetapi minutasinya belum bertanggal. Buka rincian perkaranya untuk melihat berkas apa yang masih kurang.",
    cocok: (x) =>
      (Boolean(x.sudahPutus) || sudahPutusHariIni(x)) && !sudahDiminutasi(x.tanggalMinutasi),
  },
  {
    // ========================================================================
    // BELUM UNGGAH PUTUSAN - TERPISAH DARI MINUTASI, SEBAB ORANGNYA BERBEDA
    // ========================================================================
    //
    // Naskah putusan disusun hakim; minutasi dijahit panitera pengganti.
    // Menggabungkan keduanya ke satu kotak berarti menagih dua orang dengan
    // satu tulisan, dan yang membacanya tidak tahu giliran siapa.
    //
    // Terukur: dari 9.993 perkara yang sudah putus di SIPP setempat, 90
    // belum punya amar_putusan_dok. Kotak ini menyala pada kesembilan puluh
    // itu - dan tidak pada yang lain.
    kunci: "belum-unggah-putusan",
    label: "Belum unggah putusan",
    labelPendek: "Belum unggah",
    nada: "bahaya",
    kelompok: "putusan",
    judul:
      "Perkaranya sudah putus di SIPP tetapi naskah putusannya belum diunggah. Selama naskahnya belum ada, minutasi tidak patut dijahit dan publikasinya tidak dapat dikerjakan.",
    // Hanya yang barisnya SUDAH ada di perkara_putusan: perkara yang baris
    // putusannya belum dibuat sama sekali tidak dapat dituduh "belum
    // mengunggah" - yang tertinggal pencatatannya, dan itu kotak di atas.
    cocok: (x) => Boolean(x.sudahPutus) && !x.adaBerkasPutusan,
  },
  {
    // ========================================================================
    // "MUSYAWARAH MAJELIS" DILEBUR KE SINI - LIHAT hariPutusan DI ATAS
    // ========================================================================
    //
    // Riwayatnya tiga langkah, dan tiap langkah alasannya sama: satu
    // pertanyaan pantas punya satu kotak.
    //
    //   "Agenda putusan"      sejuk, hanya mencocokkan kata "putus"
    //   "Musyawarah Majelis"  bahaya, empat agenda yang menentukan
    //   "Hari Putusan"        awas, keempat agenda itu DAN hasil sidang yang
    //                         sudah tercatat - dikurangi sidang ikrar talak
    //
    // Kotak lama tidak dibiarkan berdiri di sebelahnya: cakupannya termuat
    // seluruhnya di sini, dan dua kotak yang menyaring hal yang hampir sama
    // membuat pembacanya menduga ada bedanya, lalu mencari beda yang tidak
    // ada.
    kunci: "hari-putusan",
    label: "Hari Putusan",
    nada: "awas",
    kelompok: "putusan",
    judul:
      "Hari ini perkaranya berdiri di hadapan putusannya - agendanya musyawarah majelis, pembacaan putusan, pembacaan penetapan, atau putusan sela; ATAU hasil sidangnya sudah tercatat putus. Sidang ikrar talak tidak ikut - ia punya penandanya sendiri.",
    cocok: (x) => hariPutusan(x),
  },
  {
    // ========================================================================
    // IKRAR TALAK - DIPISAHKAN DARI HARI PUTUSAN, BUKAN DILEBUR KE DALAMNYA
    // ========================================================================
    //
    // Sebelumnya sidang ikrar talak tidak punya penanda sama sekali, sehingga
    // ia hanya terbaca sebagai perkara "Sudah putus" - dan itu menyesatkan
    // pada layar jadwal: yang membaca "sudah putus" pada baris hari ini
    // menyangka perkaranya diputus hari ini, padahal putusannya - izin
    // mengucapkan talak - dijatuhkan berbulan-bulan sebelumnya dan yang
    // terjadi hari itu penyaksian ikrarnya.
    //
    // Biru, bukan kuning dan bukan hijau. Ia bukan tuntutan kesiapan naskah
    // dan bukan pula perkara yang selesai hari itu; ia satu acara tersendiri
    // yang menuntut kehadiran Pemohon - dan bila Pemohon tidak hadir sampai
    // batasnya, hak talaknya gugur. Biru sudah dipakai di layar ini untuk
    // keterangan yang perlu dilihat tanpa menuntut tindakan.
    //
    // Perkaranya TETAP terhitung "Sudah putus" - itu memang faktanya, dan
    // memotongnya dari sana akan membuat "sudah putus" ditambah "belum putus"
    // tidak lagi sama dengan jumlah sidang hari itu. Yang memisahkannya
    // penanda ini.
    kunci: "ikrar-talak",
    label: "Ikrar Talak",
    nada: "sejuk",
    kelompok: "putusan",
    judul:
      "Sidang penyaksian ikrar talak menurut bendera SIPP sendiri. Putusannya sudah dijatuhkan sebelumnya - yang terjadi hari ini pengucapan ikrarnya di depan majelis.",
    cocok: (x) => sidangIkrar(x),
  },
  {
    // ========================================================================
    // "SUDAH PUTUS" BERARTI DIPUTUS PADA SIDANG HARI ITU
    // ========================================================================
    //
    // Dulu ia mencocokkan x.sudahPutus saja - perkaranya punya putusan, kapan
    // pun tanggalnya. Pada layar JADWAL SIDANG itu menyesatkan, dan
    // menyesatkannya terbukti: 9 September 2026 menampilkan "2 Sudah putus",
    // dan keduanya sidang ikrar talak yang putusannya dijatuhkan
    // berbulan-bulan sebelumnya. Perkara yang benar-benar diputus hari itu -
    // 510/Pdt.G/2026, hasil sidangnya "putus DIKABULKAN (verstek)" - justru
    // tidak terhitung.
    //
    // Sekarang syaratnya tanggal putusannya SAMA dengan tanggal sidangnya.
    // Lihat putusHariIni di atas untuk pengukurannya.
    //
    // ------------------------------------------------------------------
    // SEPARUH KEDUA PERBAIKAN ITU: HASIL SIDANG IKUT DIBACA
    // ------------------------------------------------------------------
    //
    // Catatan di atas menyebut 510/Pdt.G/2026 sebagai perkara yang benar-benar
    // diputus hari itu tetapi tidak terhitung. Memakai tanggal putusan memang
    // menolongnya - SELAMA putusannya sudah dituliskan ke perkara_putusan.
    // Yang belum tertangani: perkara yang hasil sidangnya sudah berbunyi
    // "putus" sementara baris putusannya belum dibuat sama sekali.
    //
    // Terukur pada data satker, dan perpecahannya selalu jatuh pada hari yang
    // sedang berjalan - hari yang justru sedang dilihat orang:
    //
    //     2026-09-08   kotak ini menghitung 1, hasil sidang menyebut 6
    //                  (lima tanpa satu baris pun di perkara_putusan)
    //     2026-09-09   kotak ini menghitung 0, hasil sidang menyebut 1
    //
    // Itulah sebabnya layar tampak berbantah dengan dirinya sendiri: kotak
    // hijau "Hasil sidang - putus DIKABULKAN (verstek)" berdiri di baris yang
    // kolom putusannya berbunyi "putusan belum tercatat". Keduanya benar; yang
    // salah kotak penghitungnya, yang hanya mau melihat satu dari dua sumber.
    kunci: "sudah-putus",
    label: "Sudah putus",
    labelPendek: "Sudah",
    nada: "aman",
    kelompok: "putusan",
    judul:
      "Diputus pada sidang hari ini - baik putusannya sudah tercatat di SIPP bertanggal sama, maupun hasil sidangnya sudah berbunyi putus walau baris putusannya belum dibuat. Yang diputus pada sidang sebelumnya dan sidang ikrar talak tidak ikut.",
    cocok: (x) => sudahPutusHariIni(x),
  },
  {
    // ========================================================================
    // BUKAN LAGI PASANGAN YANG MENJUMLAH GENAP - DAN ITU DISENGAJA
    // ========================================================================
    //
    // Selama "Sudah putus" berarti "punya putusan", keduanya membagi hari itu
    // menjadi dua tanpa sisa. Sesudah "Sudah putus" dipersempit menjadi
    // "diputus hari itu", ada baris yang tidak masuk keduanya: perkara yang
    // putusannya dijatuhkan pada sidang sebelumnya - sidang ikrar talak,
    // sidang upaya hukum - dan hari ini mengerjakan hal lain.
    //
    // Itu bukan kebocoran hitungan. Pada hari itu, kedua pernyataan memang
    // tidak berlaku bagi baris tersebut: ia tidak diputus hari ini, dan ia
    // pun tidak sedang menunggu putusan. Memaksanya masuk salah satu kotak
    // berarti mengucapkan salah satu dari dua kebohongan kecil.
    //
    // Keadaan perkaranya sendiri tidak hilang dari layar: kolom Putusan tetap
    // menyebut statusnya, dan penanda biru menyebut apa yang dikerjakan hari
    // itu.
    kunci: "belum-putus",
    label: "Belum putus",
    labelPendek: "Belum",
    nada: "netral",
    kelompok: "putusan",
    judul:
      "Perkaranya belum punya putusan sama sekali - masih berjalan. Yang hasil sidangnya sudah berbunyi putus tidak ikut, walau baris putusannya belum dibuat di SIPP: perkaranya sudah selesai, yang tertinggal pencatatannya.",
    cocok: (x) => !x.sudahPutus && !sudahPutusHariIni(x),
  },

  // --- ANTRIAN: sudahkah pihaknya mengambil nomor di ruang tunggu -----------
  {
    kunci: "belum-antri",
    label: "Belum ambil antrian",
    labelPendek: "Belum ambil",
    nada: "awas",
    kelompok: "antrian",
    judul:
      "Terdaftar di mesin antrian, tetapi belum ada pihak yang mengambil nomor. Perkara yang memang tidak memakai antrian tidak ikut terhitung.",
    cocok: (x, antrian) => {
      const punya = antrianUntuk(antrian, x);
      // Perkara yang TIDAK terdaftar di mesin antrian sama sekali tidak ikut
      // - ia bukan "belum mengambil", ia memang tidak memakai antrian.
      //
      // Ditulis sebagai perbandingan, bukan Boolean(): Boolean() tidak
      // menyempitkan tipe, dan sebelumnya ini lolos hanya karena akses indeks
      // Record mengaku selalu mengembalikan nilai. Sesudah pencocokan tanggal,
      // "tidak ada" menjadi kemungkinan yang sebenarnya.
      return punya !== undefined && !punya.nomor;
    },
  },
  {
    kunci: "sudah-antri",
    label: "Sudah ambil antrian",
    labelPendek: "Sudah ambil",
    nada: "sejuk",
    kelompok: "antrian",
    judul: "Pihaknya sudah mengambil nomor antrian, dalam jaringan maupun di mesin antrian.",
    cocok: (x, antrian) => Boolean(antrianUntuk(antrian, x)?.nomor),
  },
  {
    kunci: "antri-online",
    label: "Antrian online",
    nada: "sejuk",
    kelompok: "antrian",
    judul: "Antriannya diambil lewat WhatsApp, bukan di mesin antrian.",
    cocok: (x, antrian) => Boolean(antrianUntuk(antrian, x)?.online),
  },
];

/**
 * Yang menuntut tindakan - dihitung dari nadanya, bukan didaftar ulang.
 *
 * Lihat NADA_PERLU_DIPERIKSA di @/lib/keadaan-sidang untuk alasan mengapa
 * hanya merah, padahal kuning pun mengganggu.
 */
const KEADAAN_MENUNTUT_TINDAKAN = KEADAAN_DASAR.filter((x) =>
  NADA_PERLU_DIPERIKSA.includes(x.nada)
);

const KEADAAN_SIDANG: KeadaanSidang[] = [
  // Paling depan di antara penanda keadaan, dan dipisahkan garis dari
  // penanda satuan di belakangnya: kotak ini dibaca lebih dulu, dan yang
  // membacanya sedang mencari pekerjaannya - bukan sedang menyaring.
  {
    kunci: KUNCI_PERLU_DIPERIKSA,
    label: "Perlu diperiksa",
    nada: "bahaya",
    // Kalimatnya dahulu berbunyi "Inilah yang membatalkan sidangnya bila tidak
    // diurus hari ini". Itu benar selama anggotanya hanya soal panggilan -
    // retur dan belum dipanggil memang membatalkan sidang.
    //
    // Sejak 2.29.0 anggotanya bertambah dua yang TIDAK membatalkan sidang
    // apa pun: belum minutasi dan belum unggah putusan menagih pekerjaan
    // sesudah perkaranya selesai. Kalimat lama karena itu menjadi tidak benar
    // bagi separuh anggotanya, dan kotak gabungan yang melebih-lebihkan
    // taruhannya adalah kotak yang lama-lama tidak dipercaya.
    //
    // Sejak 24 September 2026 anggotanya bertambah satu yang BERJAM: sidang
    // yang sudah lewat pukul 15:00 WITA pada hari sidangnya tetapi hasilnya
    // belum dicatat. Diminta pengguna bersamaan dengan penghapusan papan
    // "Perlu ditindaklanjuti" - "karena fungsi itu sudah ada di perlu
    // diperiksa". Kotak ini kini satu-satunya yang menjawab "hari ini beres
    // atau belum".
    judul:
      `Gabungan seluruh penanda merah: ${KEADAAN_MENUNTUT_TINDAKAN.map((x) => x.label).join(", ")}; ` +
      `ditambah sidang yang sudah lewat pukul ${JAM_BATAS_HASIL_SIDANG.slice(0, 5)} WITA pada hari sidangnya ` +
      "tetapi hasilnya belum dicatat - belum ditunda, belum diputus, dan kolom hasil sidangnya di SIPP masih kosong. " +
      "Yang menyangkut panggilan membatalkan sidangnya bila tidak diurus hari ini; " +
      "yang menyangkut putusan menagih berkas yang sudah lewat waktunya; " +
      "yang lewat pukul 15:00 menagih pencatatan hasil sidang - tanpanya agenda sidang berikutnya tidak terbentuk. " +
      "Penanda kuning lainnya sengaja tidak ikut - lihat kotaknya masing-masing.",
    // "Atau", sama seperti saringan kotak pada umumnya: satu penanda merah
    // sudah cukup membuat perkaranya perlu diurus. Anggota berjam disebut
    // dengan namanya - lihat NADA_PERLU_DIPERIKSA di lib.
    cocok: (baris, antrian, saat) =>
      KEADAAN_MENUNTUT_TINDAKAN.some((keadaan) => keadaan.cocok(baris, antrian, saat)) ||
      belumTundaLewatBatas(baris, saat),
  },
  ...KEADAAN_DASAR,
];

/**
 * Kotak gabungan itu sendiri, sebagai daftar satu anggota. Digambar di DUA
 * tempat - deret saringan dan baris ringkas saat Kendali diciutkan - dan
 * keduanya harus menggambar kotak yang sama.
 */
const KEADAAN_PERLU_DIPERIKSA = KEADAAN_SIDANG.filter((x) => x.kunci === KUNCI_PERLU_DIPERIKSA);

/**
 * Kotak yang TAMPAK: jumlahnya lebih dari nol, atau sedang menyala - lihat
 * "YANG BERNILAI NOL TIDAK DITAMPILKAN" di tempat deretannya digambar.
 */
function keadaanTampak(
  daftar: KeadaanSidang[],
  jumlah: Record<string, number>,
  terpilih: string[]
): KeadaanSidang[] {
  return daftar.filter(
    (keadaan) => (jumlah[keadaan.kunci] ?? 0) > 0 || terpilih.includes(keadaan.kunci)
  );
}

/**
 * Kelompok kotak beserta anggotanya yang tampak, urut menurut KELOMPOK_KEADAAN.
 * Kelompok yang seluruh anggotanya nol tidak ikut - judulnya pun tidak
 * digambar, supaya tidak ada judul kelompok yang berdiri tanpa satu pun kotak.
 */
function kelompokKeadaanTampak(jumlah: Record<string, number>, terpilih: string[]) {
  return KELOMPOK_KEADAAN.map((kelompok) => ({
    ...kelompok,
    anggota: keadaanTampak(
      KEADAAN_DASAR.filter((keadaan) => keadaan.kelompok === kelompok.kunci),
      jumlah,
      terpilih
    ),
  })).filter((kelompok) => kelompok.anggota.length > 0);
}

/** Medan pencarian lanjutan untuk jadwal sidang. */
const MEDAN_CARI_SIDANG = [
  { kunci: "nomor", label: "Nomor perkara", petunjuk: "521/Pdt.G/2026" },
  { kunci: "pihak", label: "Nama pihak", petunjuk: "penggugat atau tergugat" },
  { kunci: "jenis", label: "Jenis perkara", petunjuk: "Cerai Gugat" },
  { kunci: "agenda", label: "Agenda", petunjuk: "Pemeriksaan Pokok Perkara" },
  { kunci: "majelis", label: "Majelis", petunjuk: "B-C2-C3 atau nama hakim" },
  { kunci: "petugas", label: "Panitera / juru sita", petunjuk: "nama petugas" },
  { kunci: "saksi", label: "Nama saksi", petunjuk: "nama saksi" },
  { kunci: "mediator", label: "Mediator", petunjuk: "nama mediator" },
  { kunci: "ruang", label: "Ruang sidang", petunjuk: "Ruang Sidang 1" },
  { kunci: "jam", label: "Jam", petunjuk: "09:" },
  { kunci: "antrian", label: "Nomor antrian", jenis: "angka" as const },
];

/**
 * Menyaring satu baris dengan isian pencarian lanjutan.
 *
 * Seluruh medan digabung dengan "dan". Yang dikosongkan tidak ikut menyaring,
 * sehingga panel yang separuh terisi tetap berguna.
 */
function cocokCariLanjutSidang(
  baris: SidangBaris,
  isian: Record<string, string>,
  antrian: Record<string, AntrianBaris>
) {
  const pihak = [...baris.pihak.penggugat, ...baris.pihak.tergugat].join(" ");
  const nomorAntrian = antrianUntuk(antrian, baris)?.nomor ?? null;
  const petugas = `${baris.paniteraNama} ${baris.jurusitaNama}`;
  const majelis = `${baris.majelisKode} ${baris.majelisNama}`;

  return (
    cocokTeks(baris.nomorPerkara, isian.nomor ?? "") &&
    cocokTeks(pihak, isian.pihak ?? "") &&
    cocokTeks(baris.jenisPerkara, isian.jenis ?? "") &&
    cocokTeks(baris.agenda, isian.agenda ?? "") &&
    cocokTeks(majelis, isian.majelis ?? "") &&
    cocokTeks(petugas, isian.petugas ?? "") &&
    cocokTeks([...(baris.saksiNamaPihak1 ?? []), ...(baris.saksiNamaPihak2 ?? []), ...(baris.pihak.saksi ?? [])].join(" "), isian.saksi ?? "") &&
    cocokTeks(baris.mediasi?.mediator ?? "", isian.mediator ?? "") &&
    cocokTeks(baris.ruangan, isian.ruang ?? "") &&
    cocokTeks(baris.jamSidang, isian.jam ?? "") &&
    dalamRentang(nomorAntrian, isian.antrianDari ?? "", isian.antrianSampai ?? "")
  );
}

/**
 * Pencarian cepat (kini pintar) bekerja atas baris yang SUDAH termuat, seketika,
 * tanpa satu pun kueri - dan karena itu boleh berjalan pada tiap ketikan.
 *
 * Seluruh teks yang disapu kata bebas pencarian pintar (JADWAL-3 butir 1):
 * kolom pencarian cepat lama DITAMBAH saksi, kuasa/pihak lain, turut tergugat,
 * intervensi, mediator, dan konseptor.
 */
function teksCariSidang(baris: SidangBaris, konseptor: string): string {
  return [
    baris.nomorPerkara,
    baris.jenisPerkara,
    ...(baris.kumulasi?.daftar ?? []).map((x) => x.nama),
    baris.agenda,
    baris.majelisKode,
    baris.majelisNama,
    baris.paniteraNama,
    baris.jurusitaNama,
    baris.ruangan,
    baris.jamSidang,
    ...baris.pihak.penggugat,
    ...baris.pihak.tergugat,
    ...(baris.pihak.turutTergugat ?? []),
    ...(baris.pihak.intervensi ?? []),
    ...(baris.pihak.lain ?? []),
    ...(baris.pihak.saksi ?? []),
    ...(baris.saksiNamaPihak1 ?? []),
    ...(baris.saksiNamaPihak2 ?? []),
    baris.mediasi?.mediator ?? "",
    konseptor,
  ].join(" ");
}

function ringkasAlur(sidang: SidangBaris[]) {
  return KELOMPOK_ALUR.map((kelompok) => ({
    ...kelompok,
    jumlah: sidang.filter((baris) => kelompokAlur(baris.alurPerkaraId) === kelompok.kunci).length,
  })).filter((kelompok) => kelompok.jumlah > 0 || kelompok.kunci !== "lainnya");
}


/**
 * Satu baris di dalam kartu rincian: namanya, berapa banyak, dan cara
 * mengenali sidang mana saja yang termasuk di dalamnya.
 *
 * Pengenalnya dibawa serta - bukan dihitung ulang di tempat penyaringan -
 * supaya angka yang tertulis dan daftar yang muncul saat diklik selalu
 * berasal dari aturan yang sama. Menghitung dengan satu aturan lalu
 * menyaring dengan aturan lain adalah cara paling mudah membuat kartu
 * bertulis "12" membuka daftar berisi 9.
 */
type BarisRincian = {
  nama: string;
  jumlah: number;
  cocok: (baris: SidangBaris) => boolean;
};

/** Menyusun baris rincian dari satu penggolong, urut dari yang terbanyak. */
function rincianMenurut(
  daftar: SidangBaris[],
  ambil: (baris: SidangBaris) => string
): BarisRincian[] {
  const peta = new Map<string, number>();
  for (const baris of daftar) {
    const kunci = ambil(baris);
    peta.set(kunci, (peta.get(kunci) || 0) + 1);
  }
  return [...peta.entries()]
    .map(([nama, jumlah]) => ({ nama, jumlah, cocok: (b: SidangBaris) => ambil(b) === nama }))
    .sort((a, b) => b.jumlah - a.jumlah || a.nama.localeCompare(b.nama));
}

/**
 * Kartu rincian yang dapat diklik dan diurut.
 *
 * ============================================================================
 * ANGKA YANG TIDAK DAPAT DIBUKA MEMAKSA MENGHITUNG ULANG DENGAN MATA
 * ============================================================================
 *
 * Sebelumnya kartu ini hanya memberitahu "Cerai gugat: 12". Pertanyaan yang
 * langsung menyusul selalu sama - yang mana kedua belas itu - dan satu-satunya
 * cara menjawabnya adalah menyisir sendiri daftar di bawahnya. Sekarang
 * barisnya diklik dan daftarnya menyusut ke isi angka itu.
 *
 * Urutannya juga dapat dibalik. Urut jumlah menjawab "apa yang paling banyak
 * hari ini"; urut nama menjawab "apakah majelis C ada di daftar" - dua
 * pertanyaan berbeda yang sama-sama ditanya, dan yang kedua mustahil dijawab
 * cepat pada daftar yang urutannya berubah tiap hari.
 */
function KartuRincian({
  judul,
  baris,
  aktif,
  onPilih,
  monospasi = false,
}: {
  judul: string;
  baris: BarisRincian[];
  aktif: string;
  onPilih: (nama: string) => void;
  monospasi?: boolean;
}) {
  const [urutNama, setUrutNama] = useState(false);

  const tampil = urutNama
    ? [...baris].sort((a, b) => a.nama.localeCompare(b.nama))
    : baris;

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold uppercase text-muted-foreground">{judul}</p>
        <button
          type="button"
          onClick={() => setUrutNama((x) => !x)}
          className="shrink-0 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          title={
            urutNama
              ? "Sedang urut nama. Klik untuk mengurut dari yang terbanyak."
              : "Sedang urut jumlah. Klik untuk mengurut menurut nama."
          }
        >
          {urutNama ? "A-Z" : "9-1"}
        </button>
      </div>

      {tampil.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tidak ada.</p>
      ) : (
        <ul className="space-y-0.5 text-sm">
          {tampil.map((item) => {
            const terpilih = aktif === item.nama;
            return (
              <li key={item.nama}>
                <button
                  type="button"
                  onClick={() => onPilih(terpilih ? "" : item.nama)}
                  title={
                    terpilih
                      ? "Sedang disaring ke sini. Klik untuk menampilkan semuanya lagi."
                      : `Tampilkan hanya ${item.nama}`
                  }
                  className={`flex w-full justify-between gap-2 rounded px-1 py-0.5 text-left transition ${
                    terpilih
                      ? "bg-primary/15 font-medium text-primary"
                      : "hover:bg-muted"
                  }`}
                >
                  <span
                    className={`truncate ${monospasi ? "font-mono text-sm" : ""}`}
                    title={item.nama}
                  >
                    {item.nama}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">{item.jumlah}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Penanda putusan yang belum terbit utuh di e-Court.
 *
 * Muncul HANYA bila ada yang perlu dikerjakan. Perkara yang putusannya sudah
 * lengkap, yang belum putus, atau yang belum pernah ditarik tidak menampilkan
 * apa pun - penanda yang selalu ada berhenti dibaca.
 */
function PenandaPutusanEcourt({
  putusan,
}: {
  putusan: SidangBaris["putusanEcourt"];
}) {
  if (!putusan || !putusan.perluTindakan) return null;

  // Baris putusan yang tidak terbentuk paling gawat: para pihak tidak dapat
  // mengambil salinannya sama sekali, dan tidak ada yang memberi tanda.
  const gawat = putusan.keadaan === "putusan_ecourt_error";

  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
        gawat ? "bg-red-900 text-red-50" : "bg-amber-500/20 text-amber-800 dark:text-amber-300"
      }`}
      title={putusan.keterangan}
    >
      {putusan.sebutan}
    </span>
  );
}

/**
 * Jenis pelaksanaan relaas, DITURUNKAN dari kolom yang ada.
 *
 * ============================================================================
 * TIDAK ADA KOLOM "JENIS" DI SIPP
 * ============================================================================
 *
 * perkara_pelaksanaan_relaas menyimpan tanggal, ket_temu, no_resi_pos,
 * tanggal_jursit_pos, dan status_pos - tetapi tidak menyimpan satu ruas pun
 * yang menyebut caranya. Yang tampil di layar SIPP pun diturunkan.
 *
 * Karena itu yang dikembalikan di sini hanya yang benar-benar DAPAT dipastikan
 * dari datanya: surat tercatat pos (ada resi atau tanggal kirim pos), bertemu,
 * dan tidak bertemu. "Panggilan elektronik" TIDAK diikutkan - ia tidak dapat
 * dibedakan dari "bertemu" berdasarkan kolom yang ada, dan menebaknya berarti
 * menuliskan cara pemanggilan yang mungkin tidak pernah terjadi pada berkas
 * yang menentukan sah tidaknya panggilan.
 */
function jenisRelaas(baris: {
  noResiPos?: string;
  tanggalKirimPos?: string;
  bertemu?: boolean;
  caraRelaas?: CaraRelaas;
  tanggalRelaas?: string;
}): string {
  if (baris.noResiPos || baris.tanggalKirimPos) return "Surat tercatat POS";
  // ==========================================================================
  // CARANYA DIBACA DARI SANDI SIPP, BUKAN DITEBAK DARI "BUKAN Y"
  // ==========================================================================
  //
  // Sebelum ini segala yang bukan "Bertemu" jatuh menjadi "Tidak bertemu" -
  // termasuk panggilan elektronik dan relaas yang diterima orang serumah.
  // Terukur pada SIPP satker: 6.725 dari 14.495 baris, 46,4%, salah dilabeli.
  //
  // Yang paling merugikan "diterima orang serumah": penyampaian itu SAH
  // menurut SEMA 1/2023 angka 12 huruf c, relaasnya patut, dan sidangnya boleh berjalan. Menyebutnya
  // "tidak bertemu" membuat yang membacanya menunda sidang yang sudah boleh.
  if (baris.caraRelaas?.cara) return baris.caraRelaas.cara;
  if (relaasBertemu(baris)) return "Bertemu";
  if (baris.tanggalRelaas) return "Tidak bertemu";
  return "Belum dilaksanakan";
}

/**
 * Sandi SIPP di balik cara panggilnya. Sejak W58 (22 Okt 2026) warna hasil
 * panggilan mengikuti kepatutannya (@/lib/kepatutan-relaas), bukan lagi
 * menurut ruas "sampai" sandinya; sandi yang artinya ditebak tetap dikatakan di sini.
 */
function judulSandiRelaas(baris: { caraRelaas?: CaraRelaas }): string | undefined {
  const cara = baris.caraRelaas;
  if (!cara?.sandi) return undefined;
  return cara.terbaca
    ? `Sandi SIPP "${cara.sandi}".`
    : `Sandi SIPP "${cara.sandi}" tidak ada di daftar pilihan SIPP; artinya dibaca dari keterangan relaasnya sendiri.`;
}

/** Hasil lacak kiriman pos - SIPP menyimpannya sebagai angka. */
function sebutanStatusPos(status: number | null | undefined): string {
  if (status === null || status === undefined) return "";
  if (status === 1) return "sampai";
  if (status === 2) return "dikembalikan";
  return "tidak diketahui";
}

/** Sebutan lengkap sisi yang belum dipanggil, untuk keterangan penunjuk. */
function sebutanSisi(sisi: number[] | undefined) {
  if (!Array.isArray(sisi) || sisi.length === 0) return "";
  const nama = sisi.map((x) => (x === 1 ? "Penggugat/pemohon" : "Tergugat/termohon"));
  return `${nama.join(" dan ")} belum tercatat dipanggil.`;
}

/** Sebutan singkat yang menempel pada lencananya. */
function sebutanSisiPendek(sisi: number[] | undefined) {
  if (!Array.isArray(sisi) || sisi.length === 0) return "";
  if (sisi.length > 1) return "";
  return sisi[0] === 1 ? ": penggugat" : ": tergugat";
}

/**
 * Penanda keadaan panggilan.
 *
 * Merah GELAP untuk belum dipanggil, merah TERANG untuk retur - dua keadaan
 * yang tindak lanjutnya berbeda: yang satu menagih jurusita, yang lain
 * menelusuri alamat.
 *
 * Tidak muncul sama sekali bila panggilannya aman. Penanda yang selalu ada
 * berhenti dibaca.
 */
/**
 * Mengambil antrian sidang untuk satu perkara, dari sisi petugas.
 *
 * ============================================================================
 * PERANNYA DIPILIH, BUKAN DIANDAIKAN
 * ============================================================================
 *
 * Satu tombol "ambil antrian" tanpa peran akan memaksa mesin menebak siapa
 * yang datang - dan nomor antrian melekat pada SISI perkara, bukan pada
 * perkaranya. Menebaknya berarti penggugat yang datang tercatat sebagai
 * tergugat, lalu dipanggil pada urutan yang bukan miliknya.
 *
 * Kuasa dipisah dari pihaknya sendiri karena keduanya tidak sama: kuasa yang
 * hadir mewakili sisi yang sama, tetapi yang tercatat hadir harus tetap
 * terbaca sebagai kuasa - itulah yang dibaca majelis saat membuka sidang.
 *
 * Saksi berdiri sendiri: ia bukan pihak, dan kehadirannya tidak menggeser
 * nomor antrian sisi mana pun.
 */
//
// F3.2 (17 Okt 2026): daftar tetapnya (Penggugat/Pemohon, Tergugat/Termohon,
// Kuasa penggugat, Kuasa tergugat, Saksi) diganti daftarPilihanHadir - sama
// isinya, ditambah sebutan perkaranya sendiri, turut tergugat/intervensi bila
// terdaftar, dan saksi tiap pihak satu per satu menurut SIPP. Kuasa kini
// dikirim sebagai peran pihaknya + sebagaiKuasa: peran "kuasa-penggugat" lama
// tidak dikenal bot dan ditolak "peran_tidak_dikenali".

/**
 * Menu ke layar-layar antrian yang berdiri di luar portal.
 *
 * ============================================================================
 * DUA SISI YANG BERBEDA PEMAKAINYA
 * ============================================================================
 *
 * Layar-layar ini sudah lama ada, tetapi alamatnya hanya diketahui yang
 * memasangnya. Petugas yang butuh membuka papan panggil di ruang sidang harus
 * mengetik alamat dari ingatan - dan yang tidak ingat membuka jadwal ini lalu
 * membacakan nomor dengan suara.
 *
 * Dipisah menurut SIAPA yang menghadapinya, bukan menurut apa yang
 * ditampilkan:
 *
 *   Pihak    - dibaca orang yang datang berperkara. Tanpa login, sebab yang
 *              berdiri di depannya tidak punya akun dan tidak akan pernah
 *              punya.
 *   Operator - dipakai petugas yang menjalankan sidang. Memindahkan giliran,
 *              dan karena itu berada di balik login.
 *
 * Seluruhnya dibuka di tab baru: layar ini biasanya dipasang di monitor lain,
 * dan menutup jadwal sidang untuk membukanya berarti kehilangan tempat.
 */
const LAYAR_PIHAK: Array<{ jalur: string; nama: string; guna: string }> = [
  { jalur: "/antrian", nama: "Ambil antrian", guna: "Layar sentuh ruang tunggu - tanpa login" },
  { jalur: "/antrian-layar", nama: "Layar antrian", guna: "Televisi ruang tunggu, dibaca dari jauh" },
  { jalur: "/sidang-ruang", nama: "Papan pintu ruang", guna: "Dipasang menghadap koridor" },
];

const LAYAR_OPERATOR: Array<{ jalur: string; nama: string; guna: string }> = [
  { jalur: "/aleta-antrian/ambil", nama: "Meja pengambilan", guna: "Petugas mencatat yang datang" },
  { jalur: "/aleta-antrian/panggil", nama: "Papan panggil", guna: "Memanggil giliran dari ruang sidang" },
  { jalur: "/antrian-ruang", nama: "Antrian per ruang", guna: "Halaman cepat dari ponsel" },
];

/**
 * Menu turun yang menutup ketika ditekan di luar dirinya.
 *
 * ============================================================================
 * SATU KAIT UNTUK KEDUA MENU
 * ============================================================================
 *
 * Menu Tampilan dan menu Antrian sebelumnya hanya dapat ditutup dengan menekan
 * tombolnya sekali lagi. Menekan di tempat lain tidak berpengaruh, sehingga
 * menu yang terbuka menutupi baris jadwal di bawahnya sampai penekannya ingat
 * harus kembali ke tombol asalnya.
 *
 * Ditulis sekali dan dipakai keduanya. Dua salinan perilaku yang sama akan
 * sama-sama bekerja, lalu pada suatu hari satu menu menutup sementara yang
 * lain tidak - untuk gerakan yang persis sama.
 *
 * mousedown, BUKAN click: penutupan harus terjadi sebelum tekanan itu sempat
 * mengenai apa pun di bawahnya, supaya menutup menu tidak sekaligus menekan
 * tombol di baris jadwal yang kebetulan berada di belakangnya.
 *
 * Escape ikut menutup - kebiasaan yang sudah dimiliki setiap menu, dan
 * ketiadaannya baru terasa saat tangan sudah di papan ketik.
 */
function useTutupSaatDiLuar(terbuka: boolean, tutup: () => void) {
  const wadah = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!terbuka) return;

    const diLuar = (peristiwa: MouseEvent | TouchEvent) => {
      const sasaran = peristiwa.target as Node | null;
      if (!wadah.current || !sasaran) return;
      if (!wadah.current.contains(sasaran)) tutup();
    };
    const tombolEscape = (peristiwa: KeyboardEvent) => {
      if (peristiwa.key === "Escape") tutup();
    };

    document.addEventListener("mousedown", diLuar);
    document.addEventListener("touchstart", diLuar);
    document.addEventListener("keydown", tombolEscape);
    return () => {
      document.removeEventListener("mousedown", diLuar);
      document.removeEventListener("touchstart", diLuar);
      document.removeEventListener("keydown", tombolEscape);
    };
  }, [terbuka, tutup]);

  return wadah;
}

/**
 * Sisi antrian yang waktunya BENAR-BENAR sudah terisi.
 *
 * Kunci di sini adalah nama kolom di aplikasi antrian - pihak_1, pihak_2,
 * saksi - dan dikirim apa adanya ke bot, yang menolak nilai di luar ketiganya.
 * Labelnya dipakai layar, dan jamnya menjadi keterangan pada tombol resetnya.
 */
/**
 * Antrian milik SIDANG INI - bukan sekadar milik perkaranya.
 *
 * ============================================================================
 * SATU PERKARA BERSIDANG BERKALI-KALI; ANTRIANNYA MILIK SATU HARI
 * ============================================================================
 *
 * Peta antrian dikunci menurut perkara_id saja, sebab aplikasi antrian hanya
 * memuat baris hari berjalan. Tetapi JADWAL dapat dibuka pada tanggal mana
 * pun, dan perkara yang sama kerap bersidang lagi beberapa hari kemudian.
 *
 * Tanpa pencocokan tanggal, membuka jadwal esok hari menampilkan nomor antrian
 * dan jam kehadiran yang sebenarnya milik HARI INI. Perkara 216/Pdt.P/2026
 * memperlihatkannya: barisnya di aplikasi antrian bertanggal 7 September dengan
 * P, T, dan saksi hadir pukul 08:43 - dan angka itu ikut tergambar pada jadwal
 * 8 September, seolah para pihak sudah hadir untuk sidang yang belum terjadi.
 *
 * Akibatnya bukan sekadar salah tampil: perkara itu ikut terhitung pada kotak
 * "Sudah ambil antrian", dan petugas yang menyiapkan sidang esok menyangka
 * para pihaknya sudah datang.
 *
 * Tanggal yang tidak terbaca dianggap TIDAK cocok - gagal-tertutup. Antrian
 * adalah keterangan tambahan; menampilkannya saat ragu lebih merugikan
 * daripada tidak menampilkannya sama sekali.
 */
function antrianUntuk(
  peta: Record<string, AntrianBaris> | undefined,
  baris: { perkaraId: string; tanggalSidang: string }
): AntrianBaris | undefined {
  const punya = peta?.[String(baris.perkaraId)];
  if (!punya) return undefined;
  if (!punya.tanggalSidang || !baris.tanggalSidang) return undefined;
  return punya.tanggalSidang === baris.tanggalSidang ? punya : undefined;
}

function sisiTerisi(antrian: AntrianBaris | undefined) {
  if (!antrian) return [];
  return [
    { kunci: "pihak_1", label: "penggugat/pemohon", jam: antrian.pihak1 },
    { kunci: "pihak_2", label: "tergugat/termohon", jam: antrian.pihak2 },
    { kunci: "saksi", label: "saksi", jam: antrian.saksi },
  ].filter((x) => Boolean(x.jam));
}

function TombolAmbilAntrian({
  baris,
  antrian,
  sudahAda,
  onSelesai,
  kehadiran = [],
}: {
  /** F3.2: yang sudah tercatat hadir pada sidang ini (kehadiran rinci). */
  kehadiran?: KehadiranOrang[];
  baris: SidangBaris;
  /** Baris antrian perkara ini - dipakai menentukan sisi mana yang dapat direset. */
  antrian?: AntrianBaris;
  /** Nomor antrian yang sudah ada, bila perkaranya sudah pernah diambil. */
  sudahAda: number | null | undefined;
  onSelesai: () => void;
}) {
  const [terbuka, setTerbuka] = useState(false);
  const [sibuk, setSibuk] = useState("");
  // Butir 3 (5 Okt 2026): yang berhasil hilang sendiri, yang gagal menetap.
  const [pesan, setPesan] = usePesanSementara();

  // Menutup saat ditekan di luar - kait yang sama dengan menu Tampilan.
  const tutup = useCallback(() => setTerbuka(false), []);
  const wadah = useTutupSaatDiLuar(terbuka, tutup);

  const antrianSisi = sisiTerisi(antrian);

  const batalkan = async (sisi: { kunci: string; label: string; jam: string }) => {
    setSibuk(`batal-${sisi.kunci}`);
    setPesan(null);
    try {
      const jawaban = await fetch(apiPath("/api/aleta-ecourt/antrian-ambil"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          perkaraId: baris.perkaraId,
          nomorPerkara: baris.nomorPerkara,
          sisi: sisi.kunci,
          alasan: "salah input",
        }),
      });
      const isi = (await jawaban.json()) as {
        ok?: boolean;
        alasan?: string;
        antrianDikosongkan?: boolean;
        data?: { ok?: boolean; alasan?: string; antrianDikosongkan?: boolean };
      };
      const hasil = isi.data ?? isi;
      if (!hasil.ok) {
        setPesan({ ok: false, teks: hasil.alasan || "Kehadiran belum dapat dibatalkan." });
        return;
      }
      // antrianDikosongkan false berarti kolomnya memang sudah kosong - bukan
      // kegagalan. Yang menekan dua kali tidak perlu diberi pesan galat atas
      // keadaan yang justru sudah sesuai keinginannya.
      setPesan({
        ok: true,
        teks: hasil.antrianDikosongkan
          ? `Kehadiran ${sisi.label} dibatalkan. Urutan antrian dihitung ulang.`
          : `Kehadiran ${sisi.label} memang sudah kosong.`,
      });
      onSelesai();
    } catch {
      setPesan({ ok: false, teks: "Kehadiran belum dapat dibatalkan." });
    } finally {
      setSibuk("");
    }
  };

  // F3.2: pilihan menurut perkaranya (lihat daftarPilihanHadir).
  const bahanHadir = bahanKehadiranDariBaris(baris);
  const pilihanHadir = daftarPilihanHadir(bahanHadir);
  const susunHadir = susunKehadiran(kehadiran, antrian);

  const ambil = async (peran: PilihanHadir) => {
    setSibuk(peran.kunci);
    setPesan(null);
    try {
      const jawaban = await fetch(apiPath("/api/aleta-ecourt/antrian-ambil"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          perkaraId: baris.perkaraId,
          nomorPerkara: baris.nomorPerkara,
          peran: peran.peran,
          sisi: peran.sisi,
          sebagaiKuasa: peran.sebagaiKuasa,
          saksiUntuk: peran.saksiUntuk,
          urutanPihak: peran.urutanPihak,
          nama: peran.nama,
        }),
      });
      const isi = (await jawaban.json()) as {
        ok?: boolean;
        alasan?: string;
        sebutan?: string;
        antrianDiisi?: boolean;
        data?: { ok?: boolean; alasan?: string; sebutan?: string; antrianDiisi?: boolean };
      };
      const hasil = isi.data ?? isi;
      if (!hasil.ok) {
        setPesan({ ok: false, teks: hasil.alasan || "Kehadiran belum dapat dicatat." });
        return;
      }
      // Kedatangan kedua pada sisi yang sama TIDAK menggeser nomor - dijaga di
      // sisi bot. Yang dikatakan di sini bedanya, supaya petugas tahu
      // tekanannya berpengaruh atau hanya tercatat.
      setPesan({
        ok: true,
        teks: hasil.antrianDiisi
          ? `Nomor antrian terbit untuk ${hasil.sebutan || peran.label}.`
          : `${hasil.sebutan || peran.label} tercatat hadir; nomor antriannya sudah ada sebelumnya.`,
      });
      onSelesai();
    } catch {
      setPesan({ ok: false, teks: "Kehadiran belum dapat dicatat." });
    } finally {
      setSibuk("");
    }
  };

  return (
    <div className="relative" ref={wadah}>
      <button
        type="button"
        onClick={(peristiwa) => {
          peristiwa.stopPropagation();
          setTerbuka((buka) => !buka);
        }}
        title={
          sudahAda
            ? `Sudah bernomor ${sudahAda}. Menekan lagi mencatat kehadiran pihak lain tanpa menggeser nomornya.`
            : "Ambil nomor antrian untuk perkara ini"
        }
        className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <ListOrdered className="h-3 w-3" />
        Antrian
      </button>

      {terbuka ? (
        <div
          // bg-card karena alasan yang sama dengan menu Tampilan di atas:
          // token --popover tidak ada, dan bg-popover membuat menu ini tembus
          // pandang di atas baris jadwal.
          className="absolute left-0 z-20 mt-1 max-h-[70vh] w-64 overflow-y-auto rounded-md border bg-card text-card-foreground p-1 shadow-lg"
          onClick={(peristiwa) => peristiwa.stopPropagation()}
        >
          <p className="px-2 py-1 text-[11px] text-muted-foreground">Siapa yang hadir?</p>
          {pilihanHadir.map((peran) => (
            <button
              key={peran.kunci}
              type="button"
              disabled={Boolean(sibuk)}
              onClick={() => void ambil(peran)}
              className="block w-full rounded px-2 py-1 text-left text-xs transition hover:bg-muted disabled:opacity-50"
            >
              {sibuk === peran.kunci ? "Mencatat…" : peran.label}
            </button>
          ))}
          {/* ==============================================================
              RESET KEHADIRAN - HANYA SISI YANG MEMANG SUDAH TERCATAT
              ==============================================================

              Untuk SALAH INPUT, bukan untuk orang yang datang lalu pulang.
              Yang sudah hadir tetap pernah hadir, dan kehadirannya tidak
              dihapus dari catatan - yang ditulis adalah pembatalannya, beserta
              siapa yang membatalkan dan kapan.

              Hanya sisi yang waktunya benar-benar terisi yang ditawarkan.
              Menawarkan reset atas sisi yang belum pernah mengambil membuat
              orang menekannya lalu bertanya kenapa tidak terjadi apa-apa -
              dan pada tombol yang menggeser giliran orang, keraguan itu mahal.

              Nomor urut menyusul dengan sendirinya: waktuAmbil diturunkan dari
              kolom yang dikosongkan. Penggugat 08:00 dan tergugat 09:00, lalu
              penggugat dibatalkan, membuat perkara ini bergeser mengikuti
              09:00 - persis seperti seandainya hanya tergugat yang datang. */}
          {antrianSisi.length > 0 ? (
            <>
              <p className="mt-1 border-t px-2 pt-1.5 text-[11px] text-muted-foreground">
                Reset kehadiran (salah input)
              </p>
              {antrianSisi.map((sisi) => (
                <button
                  key={sisi.kunci}
                  type="button"
                  disabled={Boolean(sibuk)}
                  onClick={() => void batalkan(sisi)}
                  title={`Membatalkan kehadiran ${sisi.label} yang tercatat pukul ${sisi.jam}. Urutan antrian akan dihitung ulang.`}
                  className="block w-full rounded px-2 py-1 text-left text-xs text-rose-700 transition hover:bg-rose-50 disabled:opacity-50 dark:text-rose-300 dark:hover:bg-rose-950"
                >
                  {sibuk === `batal-${sisi.kunci}`
                    ? "Membatalkan…"
                    : `Reset ${sisi.label} (${sisi.jam})`}
                </button>
              ))}
            </>
          ) : null}

          {/* F3.2: yang sudah hadir - status per orang, Pulang / Diperiksa. */}
          <DaftarHadirRinci
            perkaraId={baris.perkaraId}
            hadir={kehadiran}
            susun={susunHadir}
            bahan={bahanHadir}
            onSelesai={onSelesai}
          />

          {pesan ? (
            <p
              className={cn(
                "flex items-start gap-1 border-t px-2 py-1 text-[11px]",
                pesan.ok ? "text-muted-foreground" : "text-rose-600"
              )}
            >
              <span className="min-w-0 flex-1">{pesan.teks}</span>
              {!pesan.ok ? <TombolTutupPesan onTutup={() => setPesan(null)} /> : null}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * ============================================================================
 * UMUR PERKARA - DAN HARI MEDIASI TIDAK DIHITUNG
 * ============================================================================
 *
 * Diminta pengguna 23 September 2026: "dibawah agenda tambahkan durasi perkara
 * berjalan (ingat mediasi tidak dihitung harinya)".
 *
 * Dasarnya PERMA 1/2016 Pasal 24 ayat (2) dan (3) - jangka waktu mediasi TIDAK
 * termasuk jangka waktu penyelesaian perkara. Menghitungnya begitu saja dari
 * tanggal pendaftaran berarti menuduh majelis atas hari-hari yang menurut
 * peraturan bukan miliknya, dan pada perkara yang mediasinya berjalan penuh
 * selisihnya sampai dua bulan.
 *
 * ============================================================================
 * WARNANYA MENGIKUTI PITA WAKTU PUTUS SK DIRJEN BADILAG 048/2024
 * ============================================================================
 *
 * Diminta pengguna 24 September 2026: "beri warna sesuai dengan lamanya untuk
 * yang aman <=3 Bulan itu warna hijau, 4 Bulan itu warna kuning, 5 Bulan
 * warna oranye dan >5 Bulan warna merah" - unsur Waktu Putus Perkara pada SK
 * Dirjen Badilag Nomor 048/DJA/SK.KP3.4.3/IV/2024.
 *
 * Sebelumnya warnanya mengikuti SISA terhadap 150 hari - kuning bila sisa 30
 * hari, merah bila lewat - aturan buatan layar ini sendiri. Perkara 100 hari
 * tampak netral padahal SK sudah menurunkan nilainya dari 5 ke 3.
 *
 * Batas harinya TIDAK ditulis di sini: nilainya dihitung bot dengan TANGGA
 * yang menilai unsur waktu putus di Status Perkara
 * (penilaianSippService.hitungWaktuPutus), dan layar ini hanya
 * menerjemahkannya ke warna (lib/pita-waktu-putus). Bot lama yang belum
 * mengirim nilainya membuat lencananya netral - tidak ditebak di peramban.
 *
 * ============================================================================
 * DUA KEWAJIBAN BERBEDA, DUA ANGKA
 * ============================================================================
 *
 * Yang dinilai hari berjalan di luar mediasi, DIKURANGI kelonggaran perkara
 * khusus SK (perkara ghaib 120 hari) - diminta pengguna 24 September 2026
 * petang: "perkara ghaib itu dipotong 120 hari dari hitungan hari perkara".
 * Yang dinilai SK adalah kinerja majelis, dan perkara ghaib berjalan lama
 * karena hukum acaranya sendiri, bukan karena majelis lambat.
 *
 * Tetapi SEMA 2/2014 adalah kewajiban ADMINISTRATIF yang tidak mengenal
 * pengecualian ghaib. Rancangan 24 September pagi memotong ghaib dari kedua
 * angka sekaligus, dan tinjauan menemukan akibatnya: perkara 232/Pdt.G/2026
 * yang berjalan 163 hari tampil "43 hari, sisa 107" - kewajiban lapornya
 * hilang dari layar. Karena itu angka pokok dan warnanya memakai hariBersih
 * yang sudah dipotong, sedangkan sisaHari datang dari hariSema yang TIDAK
 * dipotong, dan lencana merah "lewat 5 bulan" menagihnya DI BARIS.
 *
 * Lencana itu di baris, bukan hanya di tooltip dan panel Rincian, sebab
 * barislah yang dipindai panitera. Terukur 24 September 2026 atas 127 perkara
 * berjalan di Antrian: 13 ghaib, dan satu-satunya lencana merah yang tersisa
 * pada perkara berjalan adalah 232/Pdt.G/2026. Tanpa lencana ini, layar itu
 * kosong sama sekali dari tanda merah.
 *
 * Angka kedua ("· dari 163") hanya muncul pada baris berkelonggaran - 13 dari
 * 127 baris hari ini. Sebabnya penjepitan di hitungWaktuPutus: 12 dari 13
 * perkara ghaib yang belum putus berumur di bawah 121 hari, sehingga
 * potongannya dijepit dan hariBersih-nya menjadi 1. Tanpa angka kedua,
 * perkara yang berjalan 74 hari bertuliskan "1 hari" dan layarnya tampak
 * rusak; dengannya terbaca "1 hari · dari 74".
 *
 * Perkara yang SUDAH PUTUS tetap berwarna: yang dinilai SK memang waktu
 * putusnya, dan justru di sana nilainya final. Tulisan "putus" di dalam
 * lencana mencegah merahnya dibaca sebagai pekerjaan yang tertunggak.
 *
 * ============================================================================
 * LENCANANYA HANYA MENYEBUT ANGKA - MEDIASINYA DI RINCIAN
 * ============================================================================
 *
 * Diminta pengguna 24 September 2026: "hapus tulisan di hari yaitu tentang
 * mediasi : (mediasi 26 hari dipotong), cukup dirincian perkara saja disebut".
 *
 * Kolom agenda dibaca sekilas untuk puluhan perkara sekaligus. Keterangan
 * mediasi di tiap baris melipatgandakan lebar lencana tanpa mengubah apa pun
 * yang diputuskan dari baris itu - warnanya sudah memakai hari yang dihitung.
 * Jalan menuju angkanya tetap utuh di bagian "Rincian waktu perkara" pada
 * panel Rincian.
 *
 * Tooltip-nya SENGAJA tetap menyebut mediasi. Tooltip tidak terlihat sampai
 * ditunjuk, jadi tidak menambah tulisan di baris - tetapi tetap menjawab
 * petugas yang mencocokkan angka ini dengan umur perkara di SIPP dan mendapati
 * selisih. Tanpa itu, selisihnya tampak seperti galat hitung.
 */
function UmurPerkara({ durasi, telahIkrar = false }: { durasi: SidangBaris["durasi"]; telahIkrar?: boolean }) {
  if (!durasi || durasi.hariBersih === null) return null;

  const sk = durasi.waktuPutusSk ?? null;
  const pita = pitaWaktuPutus(sk?.nilai);
  const hariKe = durasi.hariKotor ?? durasi.hariTotal;
  const kelonggaran = durasi.kelonggaran ?? null;
  // Angka SEMA: hari di luar mediasi TANPA kelonggaran SK. Bot lama tidak
  // mengirimnya - di sana hariBersih memang angka itu.
  const hariSema = durasi.hariSema ?? durasi.hariBersih;
  const lewatSema = !durasi.sudahPutus && durasi.sisaHari !== null && durasi.sisaHari < 0;

  const rinci = [
    `Didaftarkan ${tanggalHariPanjang(durasi.tanggalDaftar) || "—"}.`,
    durasi.sudahPutus
      ? `Diputus ${tanggalHariPanjang(durasi.tanggalPutusan)} - hari ke-${hariKe ?? "—"} sejak pendaftaran.`
      : `Hari ke-${hariKe ?? "—"} sejak pendaftaran.`,
    durasi.hariMediasi > 0
      ? `Mediasi ${durasi.hariMediasi} hari TIDAK dihitung (PERMA 1/2016 Pasal 24).`
      : "Tidak ada hari mediasi yang dikeluarkan.",
    durasi.mediasiDibatasi
      ? "Potongan mediasinya dibatasi 60 hari - batas PERMA, termasuk perpanjangan."
      : "",
    kelonggaran
      ? `Kelonggaran ${kelonggaran.sebab} ${kelonggaran.hari} hari dipotong${
          kelonggaran.hari < kelonggaran.hariMentah
            ? ` (dijepit dari ${kelonggaran.hariMentah})`
            : ""
        } - SK 048/2024 Tabel 2 nomor 1${
          kelonggaran.sumber && kelonggaran.sumber.length > 0
            ? `; dikenali dari ${kelonggaran.sumber.join(", ")}`
            : ""
        }.`
      : "",
    sk && pita
      ? `Waktu putus ${sk.sebutan}: ${pita.warna} - tangga nilai ${sk.nilai} dari 5 pada SK Dirjen Badilag Nomor 048/DJA/SK.KP3.4.3/IV/2024, atas hari di luar mediasi.`
      : "Nilai waktu putus SK belum diterima dari server.",
    !durasi.sudahPutus && sk && pita && sk.sisaDiPita !== null
      ? sk.sisaDiPita === 0
        ? `Hari ini hari terakhir ${pita.warna}.`
        : `Tetap ${pita.warna} sekurangnya ${sk.sisaDiPita} hari lagi bila belum diputus.`
      : "",
    kelonggaran
      ? `Terhadap batas lima bulan SEMA 2/2014 dihitung ${hariSema} hari - kelonggaran itu milik penilaian SK, bukan pengecualian SEMA.`
      : "",
    // Dari sisa terhadap batas SEMA, bukan dari nilai SK: kewajiban lapor
    // milik SEMA 2/2014, dan batas itu tidak mengenal pengecualian SK.
    lewatSema
      ? "Lewat lima bulan: majelis melapor kepada Ketua Pengadilan dengan tembusan Ketua Mahkamah Agung (SEMA 2/2014)."
      : "",
    "Rinciannya di panel Rincian, bagian Rincian waktu perkara.",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
          pita ? pita.kelasKotak : "border-border text-muted-foreground"
        )}
        title={rinci}
      >
        <span className="font-semibold">{durasi.hariBersih} hari</span>
        {/* Angka kedua HANYA pada baris berkelonggaran - 13 dari 127 perkara
            berjalan hari ini. Tanpa itu 12 dari 13 perkara ghaib bertuliskan
            "1 hari" (hasil penjepitan SK) untuk perkara yang berjalan 37-114
            hari, dan layarnya tampak rusak. */}
        {kelonggaran ? <span className="font-normal">· dari {hariSema}</span> : null}
        {/* Sidang ikrar talak yang sudah dilaksanakan (butir 27, 30 Sep
            2026): perkaranya SELESAI, bukan sekadar putus - "85 hari · putus"
            pada 314/Pdt.G/2026 terbaca seolah masih ada yang ditunggu. */}
        {telahIkrar ? (
          <span className="font-normal">· selesai, telah ikrar</span>
        ) : durasi.sudahPutus ? (
          <span className="font-normal">· putus</span>
        ) : null}
        {/* Warna saja tidak terbaca pembaca layar maupun mata yang buta
            warna merah-hijau - sebutan pitanya ikut, tersembunyi. */}
        {pita ? <span className="sr-only">{`, waktu putus ${pita.warna}`}</span> : null}
      </span>
      {/* KEWAJIBAN LAPOR SEMA TETAP TERLIHAT DI BARIS, BUKAN HANYA DI PANEL.
          Pita SK menilai kinerja majelis dan perkara ghaib memang berhak
          hijau; SEMA 2/2014 menagih laporan dan tidak mengenal kelonggaran
          itu. Terukur 24 September 2026: tanpa lencana ini, 232/Pdt.G/2026
          yang berjalan 163 hari tidak meninggalkan jejak apa pun di barisnya. */}
      {lewatSema ? (
        <span
          className="inline-flex items-center rounded-full border border-red-500 bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-900 dark:bg-red-500/15 dark:text-red-200"
          title={`Sudah ${hariSema} hari di luar mediasi - lewat ${Math.abs(durasi.sisaHari ?? 0)} hari dari batas lima bulan SEMA 2/2014. Majelis melapor kepada Ketua Pengadilan dengan tembusan kepada Ketua Mahkamah Agung.`}
        >
          Lewat 5 bulan
        </span>
      ) : null}
    </div>
  );
}

/**
 * Penanda verifikasi majelis e-Litigasi (butir 30, 5 Okt 2026) - satu lencana,
 * tiga keadaan; keterangannya (kapan terakhir diperiksa, oleh siapa
 * diverifikasi) di title. Lihat @/lib/penanda-verifikasi-ecourt.
 */
export function LencanaVerifikasiMajelis({
  penanda,
  tarikan,
  onTarik,
}: {
  penanda: Penanda | null;
  /** 7 Okt 2026: keadaan tarik ulang e-Court perkara ini (lihat @/lib/tarik-belum-upload). */
  tarikan?: KeadaanTarik;
  /** Ada = penanda "belum upload" dapat ditekan (saklar tarik-belum-upload). */
  onTarik?: () => void;
}) {
  if (!penanda) return null;
  const kelas = cn("whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold", penanda.kelas);
  const berjalan = tarikan?.tahap === "berjalan";
  // Hanya "belum upload" yang dapat ditekan: keadaan lain tidak menunggu pihak,
  // jadi menarik ulang tidak menjawab apa pun yang ditanyakan penandanya.
  const lencana =
    penanda.keadaan === "belum-upload" && onTarik ? (
      <button
        type="button"
        data-verifikasi-majelis={penanda.keadaan}
        data-tarik-belum-upload=""
        className={cn(kelas, "cursor-pointer underline decoration-dotted underline-offset-2 hover:opacity-90 disabled:cursor-wait disabled:opacity-70")}
        title={`${penanda.keterangan} Tekan untuk memeriksa e-Court sekarang - hanya perkara ini.`}
        disabled={berjalan}
        aria-busy={berjalan}
        onClick={(e) => {
          e.stopPropagation();
          onTarik();
        }}
      >
        {berjalan ? "Memeriksa..." : formatLencana(penanda.label)}
      </button>
    ) : (
      <span data-verifikasi-majelis={penanda.keadaan} className={kelas} title={penanda.keterangan}>
        {penanda.label}
      </span>
    );
  return (
    <>
      {lencana}
      {tarikan ? (
        <span
          data-kemajuan-tarik={tarikan.tahap}
          role="status"
          aria-live="polite"
          className={cn(
            "inline-flex max-w-[16rem] flex-col text-[10px] leading-4",
            tarikan.tahap === "masalah" ? "text-red-700 dark:text-red-300" : "text-muted-foreground"
          )}
          title={tarikan.pesan}
        >
          <span className="truncate">
            {typeof tarikan.persen === "number" && tarikan.tahap !== "selesai" && tarikan.tahap !== "jeda" ? (
              <span data-persen-tarik="" className="mr-1 font-semibold tabular-nums">
                {tarikan.persen}%
              </span>
            ) : null}
            {tarikan.pesan}
          </span>
          {/* Butir 8 (1.189.x): garis proses dari tahap NYATA bot - bukan waktu yang berlalu. */}
          {typeof tarikan.persen === "number" && (tarikan.tahap === "berjalan" || tarikan.tahap === "masalah") ? (
            <span
              data-garis-tarik=""
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={tarikan.persen}
              aria-valuetext={tarikan.langkah || tarikan.pesan}
              className="mt-0.5 block h-1 w-40 overflow-hidden rounded bg-muted"
            >
              <span
                className={cn(
                  "block h-full rounded transition-[width] duration-500",
                  tarikan.tahap === "masalah" ? "bg-red-500" : "bg-sky-600"
                )}
                style={{ width: `${tarikan.persen}%` }}
              />
            </span>
          ) : null}
        </span>
      ) : null}
    </>
  );
}

function PenandaPanggilan({
  panggilan,
}: {
  panggilan: SidangBaris["panggilan"] | undefined;
}) {
  // ==========================================================================
  // "AMAN" TIDAK LAGI BERARTI TIDAK ADA APA-APA
  // ==========================================================================
  //
  // aman = tidak ada yang belum dipanggil DAN tidak ada retur. Itu benar
  // sampai 2.34.0, ketika tenggang mepet masuk - dan tenggang mepet justru
  // keadaan yang paling sering terjadi pada sidang yang panggilannya sudah
  // LENGKAP: seluruh pihak dipanggil, hanya terlambat.
  //
  // Keluar lebih awal di sini membuat penandanya tidak pernah tampil pada
  // perkara yang justru menjadi sebab fitur itu ada.
  if (!panggilan) return null;
  if (panggilan.aman && !panggilan.tenggangMepet) return null;

  return (
    <>
      {panggilan.belumDipanggil > 0 ? (
        <span
          className="rounded bg-red-900 px-1.5 py-0.5 text-[11px] font-semibold text-red-50"
          title={[
            // Sisi mana yang belum dipanggil disebut lebih dulu - itulah yang
            // menentukan siapa yang harus dikerjakan juru sita. Tanpa itu
            // penandanya hanya memberi tahu ada masalah, bukan masalah apa.
            sebutanSisi(panggilan.sisiBelumDipanggil),
            panggilan.hadirSebelumnya === null
              ? "Sidang pertama: para pihak wajib dipanggil, tetapi relaasnya belum tercatat."
              : "Pihak yang tidak hadir pada sidang sebelumnya wajib dipanggil, tetapi relaasnya belum tercatat.",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          Belum dipanggil
          {sebutanSisiPendek(panggilan.sisiBelumDipanggil)}
        </span>
      ) : null}

      {panggilan.retur > 0 ? (
        <span
          className="rounded bg-red-500 px-1.5 py-0.5 text-[11px] font-semibold text-white"
          title={
            panggilan.returSebab && panggilan.returSebab.length
              ? `${panggilan.returSebab.join("; ")}. Panggilan perlu diulang.`
              : "Surat panggilan dikembalikan - alamat perlu ditelusuri."
          }
        >
          retur{panggilan.retur > 1 ? ` ${panggilan.retur}` : ""}
        </span>
      ) : null}

      {/* ==================================================================
          TENGGANG MEPET
          ==================================================================

          Muncul HANYA bila memang mepet. Penanda yang selalu menyala berhenti
          dibaca, dan yang pertama berhenti membacanya justru orang yang paling
          sering melihatnya.

          Yang ditulis di badannya hitung mundur ke hari sidang - itulah yang
          dipakai memutuskan apakah masih sempat memanggil ulang. Sebabnya
          lengkap beserta dasar hukumnya ada di judulnya. */}
      {panggilan.tenggangMepet ? (
        <span
          className="rounded bg-amber-600 px-1.5 py-0.5 text-[11px] font-semibold text-white"
          title={sebabTenggang(panggilan)}
        >
          {sebutanHitungMundur(panggilan.sisaHariKeSidang)}
        </span>
      ) : null}
    </>
  );
}

/**
 * "H-3", "hari ini", "lewat 2 hari".
 *
 * null TIDAK dijadikan nol. Nol berarti sidangnya hari ini - keterangan yang
 * berbeda sama sekali dari "tanggalnya tidak terbaca".
 */
function sebutanHitungMundur(sisa: number | null | undefined) {
  if (sisa === null || sisa === undefined || !Number.isFinite(Number(sisa))) return "tenggang mepet";
  const n = Number(sisa);
  if (n === 0) return "sidang hari ini";
  if (n < 0) return `lewat ${Math.abs(n)} hari`;
  return `H-${n}`;
}

/** Sebab lengkap, beserta dasar hukum yang dipakai bot menghitungnya. */
function sebabTenggang(panggilan: NonNullable<SidangBaris["panggilan"]>) {
  const t = panggilan.tenggangTersempit;
  const bagian: string[] = [];

  if (t?.alasan === "belum_dipanggil_sidang_sudah_dekat") {
    bagian.push(
      "Sidangnya sudah dekat sementara pihak yang wajib dipanggil belum punya relaas sama sekali."
    );
  } else if (t?.alasan === "tenggang_kurang_dari_ambang") {
    bagian.push(
      `Jarak panggilan ke hari sidang ${t.selisih ?? "?"} hari${t.hariKerja ? " kerja" : ""}, ` +
        `sedangkan yang berlaku untuk jalur ini ${t.ambang ?? "?"} hari.`
    );
  } else if (t?.alasan === "diterima_kurang_dari_ambang") {
    bagian.push(
      `Surat tercatat baru diterima ${t.selisih ?? "?"} hari${t.terimaHariKerja ? " kerja" : ""} sebelum sidang, ` +
        `sedangkan SEMA 1/2023 angka 11 menuntut diterima paling lambat ${t.ambangTerima ?? t.ambang ?? "?"} hari${t.terimaHariKerja ? " kerja" : ""} sebelum sidang.`
    );
  } else if (t?.alasan === "diterima_setelah_hari_sidang") {
    bagian.push("Surat tercatat baru diterima SESUDAH hari sidang.");
  } else if (t?.alasan === "dikirim_setelah_hari_sidang") {
    bagian.push("Panggilannya dikirim SESUDAH hari sidang.");
  } else {
    bagian.push("Jarak panggilan ke hari sidang kurang dari ambang yang berlaku.");
  }

  if (t?.jalur) bagian.push(`Jalur: ${t.jalur}.`);
  if (t?.dasarHukum) bagian.push(`Dasar: ${t.dasarHukum}.`);
  bagian.push(sebutanSisi(t?.sisi ? [t.sisi] : undefined) || "");
  return bagian.filter(Boolean).join(" ");
}

/**
 * Jarak pemuatan ulang jadwal hari ini.
 *
 * Empat puluh lima detik: cukup rapat agar hasil sidang yang baru diketik
 * panitera muncul sebelum orang berikutnya bertanya, dan cukup renggang agar
 * kueri berat ke SIPP tidak dijalankan setiap beberapa detik. Satu layar
 * terbuka sepanjang jam kerja berarti sekitar 640 pemuatan - masih jauh di
 * bawah beban satu petugas yang menekan Tampilkan berulang kali.
 */
/**
 * ============================================================================
 * SEJAK BERAPA MENIT MENUNGGU PATUT DITANDAI - 40, DAN ITU KEPUTUSAN PENGGUNA
 * ============================================================================
 *
 * Empat puluh menit, diminta pengguna 22 September 2026.
 *
 * Saya sempat memasangnya 30, dan alasannya masih berdiri: 30 dan 60 sudah
 * menjadi batas pita warna jeda antar-sidang di layar YANG SAMA - diukur dari
 * 10.989 jarak nyata pada 1.753 kelompok hari x ruang sidang - sehingga 40
 * menjadi batas keenam yang tidak diukur dari apa pun, dan penanda 40 menit
 * akan berwarna sama dengan penanda 35 menit di sebelahnya.
 *
 * Alasan itu ditulis di sini supaya dapat ditimbang ulang kapan saja. Yang
 * memutuskan angkanya tetap yang memimpin satuan kerja: dialah yang tahu
 * berapa lama orang pantas menunggu di ruang tunggunya sendiri, dan itu bukan
 * pertanyaan yang dijawab sebaran data.
 *
 * Bot memakai tetapan yang sama namanya dan dapat disetel lewat lingkungan
 * (ALETA_ANTRIAN_AMBANG_MENUNGGU); bila kelak keduanya berbeda, yang
 * menentukan penampakan penandanya nilai di sini, dan yang menentukan
 * pemberitahuan nilai di bot.
 */
const AMBANG_MENUNGGU_MENIT = 40;

const JEDA_MUAT_ULANG_MS = 45_000;

/**
 * ============================================================================
 * JAM PENGADILAN YANG BERDETAK HANYA PADA BATASNYA
 * ============================================================================
 *
 * Aturan pukul 15:00 tidak boleh menunggu muat ulang 45 detik. Muat ulang
 * dilewati saat tab tersembunyi dan saat tanggal yang dilihat bukan hari
 * ini, dan jumlahKeadaan hanya dihitung ulang bila kebergantungannya
 * berubah - tanpa jam sebagai kebergantungan, kotaknya baru berubah pada
 * muat ulang yang KEBETULAN mengganti daftarnya.
 *
 * Yang disimpan hanya tanggal dan satu bendera "sudah lewat batas", bukan
 * detik: jam yang berdetak tiap detik melukis ulang layar ini tiap detik
 * untuk angka yang tidak ditampilkan di mana pun. Pengatur waktunya
 * dijadwalkan tepat ke batas berikutnya, paling lama semenit sekali; di
 * antaranya setSaat memulangkan obyek yang sama dan React tidak melukis.
 *
 * Dibaca ulang juga saat tab kembali terlihat: pengatur waktu tab
 * tersembunyi diperlambat peramban, dan laptop yang ditutup sepanjang siang
 * tidak menjalankannya sama sekali.
 *
 * Nilai awalnya SAAT_BELUM_TERBACA dan pembacaan pertamanya lewat
 * setTimeout 0, sama seperti muat() pertama: lukisan pertama terjadi di
 * peladen yang berjam UTC (lihat tanggal putusan di hasil-sidang), dan
 * aturan berjam baru menyala sesudah peramban membaca jamnya sendiri.
 */
function useSaatPengadilan(): SaatPengadilan {
  const [saat, setSaat] = useState<SaatPengadilan>(SAAT_BELUM_TERBACA);

  useEffect(() => {
    let pengatur: number | undefined;
    const baca = () => {
      const kini = new Date();
      const baru = saatPengadilan(kini);
      setSaat((lama) =>
        lama.tanggal === baru.tanggal && lama.lewatBatas === baru.lewatBatas ? lama : baru
      );
      window.clearTimeout(pengatur);
      pengatur = window.setTimeout(baca, jedaKeBatasBerikut(kini));
    };
    const saatTerlihat = () => {
      if (document.visibilityState === "visible") baca();
    };
    pengatur = window.setTimeout(baca, 0);
    document.addEventListener("visibilitychange", saatTerlihat);
    return () => {
      window.clearTimeout(pengatur);
      document.removeEventListener("visibilitychange", saatTerlihat);
    };
  }, []);

  return saat;
}

function hariIni() {
  const sekarang = new Date();
  const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");
  const hari = String(sekarang.getDate()).padStart(2, "0");
  return `${sekarang.getFullYear()}-${bulan}-${hari}`;
}

/** Menggeser tanggal ISO sebanyak n hari, tanpa tergelincir zona waktu. */
function geserHari(tanggalIso: string, selisih: number) {
  const [tahun, bulan, hari] = tanggalIso.split("-").map((bagian) => Number(bagian));
  // Konstruktor lokal, bukan Date.parse pada teks ISO - yang terakhir dibaca
  // sebagai UTC dan menggeser tanggalnya sehari di zona waktu Indonesia.
  const waktu = new Date(tahun, (bulan || 1) - 1, hari || 1);
  waktu.setDate(waktu.getDate() + selisih);
  const b = String(waktu.getMonth() + 1).padStart(2, "0");
  const h = String(waktu.getDate()).padStart(2, "0");
  return `${waktu.getFullYear()}-${b}-${h}`;
}

function ukuranTerbaca(byte: number) {
  if (!byte) return "";
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${(byte / 1024).toFixed(1)} KB`;
  return `${(byte / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Lencana skor kesiapan.
 *
 * Angkanya untuk mengurutkan, warnanya untuk dilihat sekilas. Keduanya tidak
 * menggantikan daftar penghambat - satu angka tidak memberi tahu apa yang harus
 * dikerjakan.
 */
/**
 * ============================================================================
 * NOMOR ANTRIAN DI ATAS JAM SIDANG
 * ============================================================================
 *
 * Nomornya besar, jam sidangnya kecil di bawahnya - dan itu bukan selera.
 * Pada hari sidang, yang dicari petugas dan yang ditanyakan orang yang datang
 * adalah "sekarang nomor berapa", bukan "jam berapa dijadwalkan". Jam sidang
 * tetap ada karena ia yang tercatat resmi, hanya tidak lagi yang pertama
 * terbaca.
 *
 * Perkara yang tidak terdaftar di mesin antrian sama sekali menampilkan jam
 * sidangnya seperti semula, tanpa tempat kosong yang menganga - kebanyakan
 * perkara memang tidak memakai antrian, dan menandainya "tanpa antrian" hanya
 * membuat kolomnya penuh keterangan yang tidak menolong siapa pun.
 */
/**
 * ============================================================================
 * KONSEPTOR SEMENTARA DI KOLOM PUTUSAN
 * ============================================================================
 *
 * SIPP baru punya nama konseptor sesudah naskahnya disentuh. Di antara sidang
 * terakhir dan naskah yang jadi, pertanyaan "siapa yang menyusun ini" tidak
 * dapat dijawab sistem mana pun - padahal justru pada rentang itulah ia paling
 * sering ditanyakan, dan dijawab lisan lalu terlupa.
 *
 * ============================================================================
 * DIKATAKAN SEMENTARA, DAN TIDAK DISAMARKAN
 * ============================================================================
 *
 * Tulisannya selalu menyebut "sementara". Nama yang berdiri sendiri di kolom
 * putusan akan terbaca sebagai nama yang datang dari SIPP - dan itu justru
 * kebalikan dari keadaannya: ia tunjukan tangan yang belum dikerjakan
 * siapa pun.
 *
 * Penanda "berbeda dari SIPP" TIDAK dipasang di sini melainkan di panel
 * Rincian, sebab nama konseptor sungguhan menuntut pembacaan jejak tahapan
 * per perkara. Menariknya untuk tiap baris daftar berarti puluhan pembacaan
 * tambahan tiap kali tanggalnya diganti - dan tanggal adalah yang paling
 * sering diganti di layar ini.
 */
/*
 * ============================================================================
 * "+X" DAN "→Y" DIGANTI TIGA JARAK BERNAMA (27 September 2026)
 * ============================================================================
 *
 * Di sini dulu berdiri JarakAntarSidang: dua lencana tanpa nama - "+12" sejak
 * perkara sebelumnya dipanggil, "→8" sampai perkara berikutnya dipanggil -
 * dihitung atas baris yang SEDANG TAMPIL, dengan jam panggil sampai menitnya.
 * Pengguna, 27 September 2026: "masih bingung dalam menghitungnya".
 *
 * Gantinya TigaJarakSidang (components/portal/tiga-jarak-sidang.tsx): Tunggu,
 * Dari sebelumnya, dan Lama sidang - bernama, berdetik, dihitung atas SELURUH
 * perkara hari itu di ruang yang sama, dan yang masih berjalan berdetak.
 * Keduanya sengaja tidak dibiarkan hidup berdampingan: dua cara menghitung
 * jarak yang sama di satu layar adalah persis kebingungan yang dikeluhkan.
 */

/** Satu revisi keterangan - bentuknya sama dengan yang disimpan peladen. */
type KeteranganRevisi = {
  id: string;
  perkaraId: string;
  urutan: number;
  isi: string;
  namaPenulis: string;
  jabatan: string;
  ditulisAt: string;
};

/** Keadaan keterangan satu perkara pada daftar - tanpa riwayatnya. */
type KeteranganPerkara = {
  perkaraId: string;
  terkini: KeteranganRevisi | null;
  jumlahRevisi: number;
};

/** Tanggal dan jam yang terbaca orang, dari ISO. */
function sebutWaktu(iso: string): string {
  const teks = String(iso || "");
  if (!teks) return "";
  const waktu = new Date(teks);
  if (Number.isNaN(waktu.getTime())) return teks;
  return waktu.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * ============================================================================
 * KETERANGAN PERKARA - CATATAN BEBAS, SIAPA PUN BOLEH MENGISI
 * ============================================================================
 *
 * Di bawah tunjuk konseptor. Isinya apa saja yang perlu diketahui orang
 * berikutnya: berkas yang ditunggu, pihak yang sulit dihubungi, kesepakatan
 * yang belum tertulis di mana pun. SIPP tidak punya tempat untuk ini.
 *
 * ABU-ABU ketika kosong, MERAH ketika ada isinya. Warnanya satu-satunya cara
 * mengetahui ada catatan tanpa membuka apa pun - dan pada daftar dua puluh
 * tujuh baris, membuka satu per satu bukan pilihan.
 *
 * BAWAANNYA TIDAK TAMPIL. Diminta begitu, dan sebabnya masuk akal: catatan ini
 * panjang dan tidak selalu perlu. Memajangnya di tiap baris membuat daftar
 * sidang berubah menjadi daftar catatan.
 *
 * RIWAYATNYA DITARIK SAAT DITEKAN, bukan saat daftar digambar. Dua puluh tujuh
 * perkara yang masing-masing membawa sepuluh revisi berarti dua ratus tujuh
 * puluh catatan yang tidak satu pun dibaca.
 *
 * TIDAK ADA UBAH DAN TIDAK ADA HAPUS - lihat sebabnya di modul peladennya.
 * Yang keliru diperbaiki dengan menulis revisi baru; yang lama tetap terbaca
 * beserta siapa yang menulisnya.
 */
/**
 * ============================================================================
 * CATATAN CARA MENGHITUNG - DAPAT DISINGKIRKAN, TETAPI TIDAK DIHAPUS
 * ============================================================================
 *
 * Kalimat yang menerangkan CARA ALETA menghitung, bukan fakta tentang
 * perkaranya: dari mana tenggang dihitung, di mana ambangnya disetel, bahwa
 * penilaiannya alat bantu dan bukan penetapan.
 *
 * Kalimat semacam itu sama persis pada tiap perkara. Dibaca sekali seumur
 * hidup pemakainya, lalu dilewati selamanya - sambil tetap memakan ruang di
 * panel yang justru sedang dibaca untuk perkara tertentu.
 *
 * Diminta pengguna 22 September 2026 agar dapat disingkirkan, dan bawaannya
 * TIDAK tampil. Tetapi TIDAK dihapus dari kode: yang baru memakai layar ini
 * memerlukannya, dan kalimat yang hilang sama sekali membuat angka di atasnya
 * terbaca sebagai penetapan - padahal ia taksiran.
 *
 * Yang disingkirkan hanya kalimat CARA MENGHITUNG. Keterangan yang menyebut
 * keadaan perkara - "Data pihak belum terbaca", "BAS belum diunggah" - tidak
 * pernah masuk ke sini: itu fakta, dan fakta tidak boleh dapat dimatikan.
 */
/**
 * Nomor sidang di tepi KIRI - angka saja, tanpa kata.
 *
 * Diminta pengguna 22 September 2026. Sebelumnya urutan sidang ditulis di
 * TENGAH barisnya sebagai "sidang ke-7", terselip di antara agenda dan
 * ruangan - sehingga untuk menjawab "ini sidang keberapa" mata harus membaca
 * seluruh barisnya lebih dulu.
 *
 * Di tepi kiri, seluruh angkanya berbaris lurus ke bawah dan urutannya
 * terbaca sekali pandang. Lebarnya dipatok supaya angka satu digit dan dua
 * digit tetap sejajar.
 *
 * Diam sama sekali bila urutannya tidak terbaca - bukan menulis "0" atau
 * tanda hubung. Nomor palsu pada daftar yang justru dibaca untuk urutannya
 * lebih buruk daripada kolom yang kosong.
 */
/**
 * ============================================================================
 * TOMBOL MEDIATOR - KINI MEMILIH MEDIATOR (PERBAIKAN 1 OKTOBER 2026, J1)
 * ============================================================================
 *
 * Diminta pengguna 22 September 2026; muncul hanya pada sidang yang agenda
 * atau alasan tundanya menyebut mediasi - lihat @/lib/mediasi-sidang.
 *
 * Sampai 1.176.0 tombol ini hanya membuka keterangan, sebab belum ada satu pun
 * jalur yang menulis penetapan mediator ke SIPP. Pada 1 Oktober 2026 pengguna
 * meminta memilih mediator langsung, seperti di SIPP. Jalurnya kini ada:
 * aleta_bot/services/mediatorTulisService.js, ditulis persis seperti blangko
 * "Penetapan Mediasi" SIPP (perkara_mediasi, perkara_mediator,
 * perkara_data_dukung_mediasi, perkara_jadwal_mediasi, riwayat 110/120/121,
 * tiga baris audit "Add Mediasi"), kering lebih dulu, lalu dikonfirmasi.
 *
 * Yang TETAP di SIPP dan disebut terus terang: jadwal pertemuan berikutnya,
 * laporan mediator, dan hasil mediasi. Jalan lama ke Status Perkara bagian
 * Mediasi tetap ada di dalam menunya.
 *
 * Isinya di @/components/portal/jadwal-sidang-1okt (TombolPilihMediator),
 * dipakai juga layar Hasil Sidang - satu komponen, bukan dua salinan.
 */
function TombolMediator({
  baris,
  onBukaStatus,
  sebabMediator,
}: {
  baris: SidangBaris;
  onBukaStatus?: (nomorPerkara: string) => void;
  /** Butir 7 (6 Okt 2026): kalimat "kedua belah pihak hadir pertama kali" dari penandaMediator. */
  sebabMediator?: string;
}) {
  const sebab = sebabMediator || sebabBerbauMediasi(baris.agenda, baris.alasanDitunda);
  return (
    <TombolPilihMediator
      baris={baris}
      sebab={sebab}
      onBukaStatus={onBukaStatus}
      // bg-card, BUKAN token popover: token itu tidak ada pada tema ini dan
      // menu yang memakainya tembus pandang.
      kelasPanel="bg-card"
      catatan="Jadwal pertemuan, laporan mediator, dan hasil mediasi masih ditulis di SIPP."
    />
  );
}

/**
 * Nomor sidang di tepi kiri baris - angka saja, rata kanan, supaya "9" dan
 * "10" berdiri pada satu tepi.
 *
 * Dipakai JUGA oleh layar Status Perkara - DIIMPOR, bukan disalin. Dua salinan
 * akan berselisih lebar atau warnanya pada suntingan berikutnya, dan nomor
 * yang sama tampak berbeda di dua layar untuk perkara yang sama.
 *
 * `sebutan` hanya mengubah keterangan saat disorot. Court Calendar memakainya
 * dengan "Rencana": nomor rencana BUKAN nomor sidang - rencana dan sidang
 * tidak selalu sama banyak, dan menyebut rencana ke-7 "sidang ke-7" mengaku
 * sidang yang barangkali tidak pernah terjadi.
 */
export function NomorSidang({ urutan, sebutan = "Sidang" }: { urutan?: number; sebutan?: string }) {
  const angka = Number(urutan);
  if (!Number.isFinite(angka) || angka <= 0) {
    return <span className="w-6 shrink-0" aria-hidden />;
  }
  return (
    <span
      className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground"
      title={`${sebutan} ke-${angka}`}
    >
      {angka}
    </span>
  );
}

function CatatanCaraHitung({
  tampilkan,
  children,
}: {
  tampilkan: boolean;
  children: React.ReactNode;
}) {
  if (!tampilkan) return null;
  return <p className="mt-2 text-xs text-muted-foreground">{children}</p>;
}

export function SelKeteranganPerkara({
  baris,
  keadaan,
  terbuka,
  onBuka,
  onSimpan,
  tampilKosong = true,
  bolehTulis = true,
}: {
  baris: SidangBaris;
  keadaan?: KeteranganPerkara;
  terbuka: boolean;
  onBuka: () => void;
  onSimpan: () => void;
  /**
   * Audit hak 23 Okt 2026: hak menulis keterangan (aksi sidang.keterangan -
   * majelis, panitera, panmud, PP, juru sita, petugas sidang, Admin). Yang tidak
   * berhak tetap MEMBACA keterangan yang sudah ada, tanpa kotak tulis; tombol
   * kosong tidak ditawarkan kepadanya. Rutenya juga menolak 403.
   */
  bolehTulis?: boolean;
  /**
   * Saklar "keterangan-perkara". Hanya tombol yang KOSONG yang disembunyikan;
   * keterangan yang sudah berisi tetap tampil - ia ditulis untuk orang
   * berikutnya, dan yang mematikan saklar di komputer bersama bukan orang yang
   * harus membacanya.
   */
  tampilKosong?: boolean;
}) {
  const adaIsi = Boolean(keadaan?.terkini?.isi);

  if (!terbuka && !adaIsi && (!tampilKosong || !bolehTulis)) return null;

  if (!terbuka) {
    return (
      <div className="mb-1">
        <button
          type="button"
          onClick={onBuka}
          title={
            adaIsi
              ? `Ada keterangan - ${keadaan?.jumlahRevisi ?? 1} kali diubah. Tekan untuk membacanya.`
              : "Belum ada keterangan. Tekan untuk menulis."
          }
          className={cn(
            "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition",
            adaIsi
              ? "border-rose-400 bg-rose-100 text-rose-900 hover:bg-rose-200 dark:border-rose-500/60 dark:bg-rose-500/15 dark:text-rose-200 dark:hover:bg-rose-500/25"
              : "border-dashed border-muted-foreground/40 text-muted-foreground hover:border-muted-foreground hover:text-foreground"
          )}
        >
          <StickyNote className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {adaIsi
              ? `Keterangan${(keadaan?.jumlahRevisi ?? 1) > 1 ? ` (${keadaan?.jumlahRevisi}× diubah)` : ""}`
              : "Keterangan"}
          </span>
        </button>
      </div>
    );
  }

  return <BorangKeteranganPerkara baris={baris} onTutup={onBuka} onSimpan={onSimpan} bolehTulis={bolehTulis} />;
}

/**
 * Borangnya - ADA hanya ketika terbuka.
 *
 * Dipisahkan supaya riwayatnya ditarik bersama lahirnya borang, bukan lewat
 * efek yang mengawasi keadaan terbuka. Idiom yang sama dengan
 * BorangKonseptorSementara di atas, dan sebabnya sama.
 */
function BorangKeteranganPerkara({
  baris,
  onTutup,
  onSimpan,
  bolehTulis = true,
}: {
  baris: SidangBaris;
  onTutup: () => void;
  onSimpan: () => void;
  bolehTulis?: boolean;
}) {
  const [riwayat, setRiwayat] = useState<KeteranganRevisi[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [isian, setIsian] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [lihatRiwayat, setLihatRiwayat] = useState(false);

  useEffect(() => {
    let batal = false;
    void (async () => {
      try {
        const balasan = await fetch(
          apiPath(
            `/api/aleta-ecourt/keterangan-perkara?perkaraId=${encodeURIComponent(baris.perkaraId)}`
          ),
          { cache: "no-store" }
        );
        const isi = (await balasan.json()) as { data?: { riwayat?: KeteranganRevisi[] } };
        if (batal) return;
        setRiwayat(Array.isArray(isi?.data?.riwayat) ? isi.data.riwayat : []);
      } catch {
        if (!batal) setRiwayat([]);
      } finally {
        if (!batal) setMemuat(false);
      }
    })();
    return () => {
      batal = true;
    };
  }, [baris.perkaraId]);

  const simpan = async () => {
    setSibuk(true);
    setGalat("");
    try {
      const balasan = await fetch(apiPath("/api/aleta-ecourt/keterangan-perkara"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          perkaraId: baris.perkaraId,
          nomorPerkara: baris.nomorPerkara,
          isi: isian,
        }),
      });
      const isi = (await balasan.json()) as { data?: { ok?: boolean; alasan?: string } };
      if (isi?.data?.ok === false) {
        setGalat(isi.data.alasan || "Keterangannya tidak tersimpan.");
        return;
      }
      setIsian("");
      onSimpan();
      onTutup();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Keterangannya tidak tersimpan.");
    } finally {
      setSibuk(false);
    }
  };

  const terkini = riwayat[0];
  const lama = riwayat.slice(1);

  return (
    <div className="mb-1.5 rounded-md border border-rose-300 bg-rose-50/70 p-1.5 dark:border-rose-500/40 dark:bg-rose-500/10">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-muted-foreground">Keterangan perkara</span>
        <button
          type="button"
          onClick={onTutup}
          className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition hover:bg-muted"
        >
          Tutup
        </button>
      </div>

      {memuat ? (
        <p className="mt-1 text-[11px]" aria-busy="true">
          {"\u00a0"}
        </p>
      ) : terkini ? (
        <div className="mt-1 rounded border bg-card p-1.5">
          <p className="whitespace-pre-line text-xs">{terkini.isi}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Perubahan ke-{terkini.urutan} ·{" "}
            {terkini.namaPenulis || "penulisnya tidak terbaca"}
            {terkini.jabatan ? ` (${terkini.jabatan})` : ""} · {sebutWaktu(terkini.ditulisAt)}
          </p>
        </div>
      ) : (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Belum ada keterangan pada perkara ini.
        </p>
      )}

      {/* ====================================================================
          RIWAYAT TERSEMBUNYI SAMPAI DIMINTA
          ====================================================================

          Diminta begitu. Dan masuk akal: yang membuka keterangan hampir selalu
          hendak membaca yang BERLAKU; riwayatnya diperlukan hanya ketika ada
          yang dipertanyakan. */}
      {lama.length > 0 ? (
        <div className="mt-1">
          <button
            type="button"
            onClick={() => setLihatRiwayat((n) => !n)}
            className="text-[10px] text-muted-foreground underline underline-offset-2 transition hover:text-foreground"
          >
            {lihatRiwayat
              ? "Sembunyikan riwayat"
              : `Lihat ${lama.length} keterangan sebelumnya`}
          </button>
          {lihatRiwayat ? (
            <ol className="mt-1 space-y-1">
              {lama.map((r) => (
                <li key={r.id} className="rounded border bg-muted/30 p-1.5">
                  <p className="whitespace-pre-line text-[11px] text-muted-foreground">{r.isi}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Perubahan ke-{r.urutan} · {r.namaPenulis || "penulisnya tidak terbaca"}
                    {r.jabatan ? ` (${r.jabatan})` : ""} · {sebutWaktu(r.ditulisAt)}
                  </p>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}

      {bolehTulis ? (
      <>
      <textarea
        value={isian}
        onChange={(e) => setIsian(e.target.value)}
        placeholder={terkini ? "Tulis perubahan keterangan…" : "Tulis keterangan…"}
        rows={2}
        className="mt-1.5 w-full rounded border bg-background px-1.5 py-1 text-xs"
      />

      <div className="mt-1 flex flex-wrap items-center gap-1">
        <button
          type="button"
          disabled={sibuk || !isian.trim()}
          onClick={() => void simpan()}
          className="rounded bg-rose-600 px-2 py-0.5 text-[11px] font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
        >
          {sibuk ? "Menyimpan…" : terkini ? "Simpan perubahan" : "Simpan"}
        </button>
      </div>
      </>
      ) : (
        <p className="mt-1.5 text-[11.5px] text-muted-foreground" data-keterangan-hanya-baca="">
          Hanya dibaca - keterangan ditulis majelis, kepaniteraan, juru sita, dan petugas sidang.
        </p>
      )}

      {galat ? <p className="mt-1 text-[11px] text-red-600">{galat}</p> : null}

      <p className="mt-0.5 text-[10px] text-muted-foreground">
        Keterangan lama tidak pernah ditimpa - tiap suntingan menjadi perubahan
        bernomor, beserta siapa yang menulisnya.
      </p>
    </div>
  );
}

function SelKonseptorSementara({
  baris,
  tunjukan,
  terbuka,
  daftarHakim,
  alasanHakim,
  onBuka,
  onSimpan,
  tampilKosong = true,
}: {
  baris: SidangBaris;
  tunjukan?: KonseptorSementara;
  terbuka: boolean;
  daftarHakim: Hakim[];
  alasanHakim: string;
  onBuka: () => void;
  onSimpan: () => void;
  /**
   * Saklar "tunjuk-konseptor". Hanya tombol yang KOSONG yang disembunyikan;
   * tunjukan yang sudah ada tetap tampil - ia ditulis untuk orang berikutnya.
   */
  tampilKosong?: boolean;
}) {
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");

  const simpan = async (nama: string) => {
    setSibuk(true);
    setGalat("");
    try {
      const balasan = await fetch(apiPath("/api/aleta-ecourt/konseptor-sementara"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          perkaraId: baris.perkaraId,
          nomorPerkara: baris.nomorPerkara,
          nama,
        }),
      });
      const isi = (await balasan.json()) as { data?: { ok?: boolean; alasan?: string } };
      if (isi?.data?.ok === false) {
        setGalat(isi.data.alasan || "Tunjukan tidak tersimpan.");
        return;
      }
      onBuka();
      onSimpan();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Tunjukan tidak tersimpan.");
    } finally {
      setSibuk(false);
    }
  };

  // Sesudah seluruh hook - hook harus dipanggil pada urutan yang sama tiap gambar.
  if (!terbuka && !tunjukan?.nama && !tampilKosong) return null;

  if (!terbuka) {
    return (
      <div className="mb-1">
        {/* ==============================================================
            MELIPAT DI DALAM SELNYA, NAMA TETAP LENGKAP
            ==============================================================

            Diminta pengguna 28 September 2026: "tombol konseptor sementara
            terlalu panjang ... tapi tetap nama konseptor lengkap". Dahulu
            satu pil rounded-full ber-truncate - pada kolom Putusan yang
            sempit ia terpotong di tepi kanan menjadi "konseptor sementara:
            Derry Bri…", dan nama, satu-satunya yang dicari, justru yang
            hilang.

            Kini tulisannya boleh melipat (sudut rounded-lg, sebab pil bulat
            dua baris terbaca sebagai gelembung), dan titik dua dibuang:
            "konseptor sementara" diredam, namanya ditebalkan - nama yang
            terbaca lebih dulu, lengkap, tanpa elipsis. */}
        <button
          type="button"
          onClick={onBuka}
          title={
            tunjukan?.nama
              ? `Konseptor sementara ${tunjukan.nama} - ditunjuk ${tunjukan.ditetapkanOleh || "entah siapa"}. Tunjukan tangan, bukan catatan SIPP.`
              : "Tunjuk konseptor sementara - berlaku sampai SIPP punya namanya sendiri."
          }
          className={cn(
            "inline-flex max-w-full items-start gap-1 rounded-lg border px-2 py-0.5 text-left text-[11px] font-medium leading-snug transition",
            tunjukan?.nama
              ? "border-violet-400 bg-violet-100 text-violet-900 hover:bg-violet-200 dark:border-violet-500/60 dark:bg-violet-500/15 dark:text-violet-200 dark:hover:bg-violet-500/25"
              : "border-dashed border-muted-foreground/40 text-muted-foreground hover:border-muted-foreground hover:text-foreground"
          )}
        >
          <PenLine className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
          {tunjukan?.nama ? (
            <span className="min-w-0 break-words" data-konseptor-sementara>
              <span className="font-normal opacity-75">konseptor sementara</span>{" "}
              <span className="font-semibold">{tunjukan.nama}</span>
            </span>
          ) : (
            <span className="min-w-0">tunjuk konseptor</span>
          )}
        </button>
      </div>
    );
  }

  return (
    <BorangKonseptorSementara
      awal={tunjukan?.nama ?? ""}
      adaTunjukan={Boolean(tunjukan?.nama)}
      sibuk={sibuk}
      galat={galat}
      keterangan={
        tunjukan?.ditetapkanOleh
          ? `Ditunjuk ${tunjukan.ditetapkanOleh}${
              tunjukan.ditetapkanAt ? ` pada ${tunjukan.ditetapkanAt.slice(0, 10)}` : ""
            }.`
          : ""
      }
      daftarHakim={daftarHakim}
      alasanHakim={alasanHakim}
      onSimpan={simpan}
      onBatal={onBuka}
    />
  );
}

/**
 * Borang tunjukannya - ADA hanya ketika terbuka.
 *
 * Dipisahkan supaya isiannya lahir bersama borangnya. Sebelumnya isiannya
 * disegarkan lewat useEffect yang mengawasi keadaan terbuka, sebab baris
 * daftar hidup terus selama tanggalnya tidak berganti. Borang yang hanya ada
 * ketika dibuka tidak memerlukan penyegaran sama sekali - nilai awalnya sudah
 * nilai yang benar - dan isian yang sedang diketik tidak lagi dapat tertimpa
 * oleh penyegaran tunjukan dari tempat lain di tengah pengetikan.
 */
/**
 * Dua isian dianggap sama bila hanya berbeda spasi dan besar-kecil huruf.
 *
 * Dipakai menutup daftar tawaran sesudah satu nama dipilih. Perbandingan
 * mentah tidak cukup: memilih nama menuliskannya ke kotak isian, dan satu
 * spasi tertinggal dari ketikan sebelumnya akan membuat daftarnya terbuka
 * kembali seketika di atas tombol Simpan.
 */
/**
 * Nama simpul daftar tawaran hakim.
 *
 * Tetap, bukan dihitung per baris: borang konseptor hanya ada SATU pada satu
 * waktu - ia lahir ketika satu baris dibuka dan mati ketika ditutup. Dua
 * borang tidak pernah terbuka bersamaan, jadi tidak ada nama yang bertabrakan.
 */
const ID_DAFTAR_HAKIM = "aleta-daftar-hakim-konseptor";

function bandingIsian(a: string, b: string): boolean {
  const rapi = (x: string) => String(x || "").trim().replace(/\s+/g, " ").toLowerCase();
  return rapi(a) === rapi(b);
}

function BorangKonseptorSementara({
  awal,
  adaTunjukan,
  sibuk,
  galat,
  keterangan,
  daftarHakim,
  alasanHakim,
  onSimpan,
  onBatal,
}: {
  awal: string;
  adaTunjukan: boolean;
  sibuk: boolean;
  galat: string;
  keterangan: string;
  /** Hakim aktif di SIPP. Kosong bukan galat - lihat catatan di dalam borang. */
  daftarHakim: Hakim[];
  /** Sebab daftarnya kosong, bila memang gagal dibaca. */
  alasanHakim: string;
  onSimpan: (nama: string) => void;
  onBatal: () => void;
}) {
  const [isian, setIsian] = useState(awal);

  // ==========================================================================
  // MENGENALI HAKIM - MENAWARKAN, TIDAK MEMAKSA
  // ==========================================================================
  //
  // Konseptor TIDAK selalu hakim: panitera pengganti pun menyusun naskah.
  // Karena itu daftar ini hanya menawarkan, dan kotaknya tetap kotak isian
  // biasa - yang mengetik nama di luar daftar cukup menekan Simpan.
  //
  // Kotak pilihan yang memaksa akan menolak nama yang benar, dan yang
  // memakainya lalu menulis nama yang salah demi lolos.
  const [sorot, setSorot] = useState(-1);
  const [pilihTerakhir, setPilihTerakhir] = useState("");

  const usul = useMemo(() => {
    // Diam ketika isiannya sudah PERSIS salah satu nama di daftar: daftar yang
    // tetap terbuka di bawah nama yang sudah benar hanya menutupi tombol
    // Simpan, dan tidak ada lagi yang perlu dipilih.
    if (hakimPersis(daftarHakim, isian)) return [];
    // Dan diam sesudah satu nama BARU SAJA dipilih - tanpa ini, memilih nama
    // mengisi kotaknya, isian berubah, dan daftarnya terbuka kembali seketika.
    if (pilihTerakhir && bandingIsian(isian, pilihTerakhir)) return [];
    return cariHakim(daftarHakim, isian);
  }, [daftarHakim, isian, pilihTerakhir]);

  const dikenali = useMemo(() => hakimPersis(daftarHakim, isian), [daftarHakim, isian]);

  const pilih = (h: Hakim) => {
    setIsian(h.nama);
    setPilihTerakhir(h.nama);
    setSorot(-1);
  };

  return (
    <div className="mb-1.5 rounded-md border border-violet-300 bg-violet-50/70 p-1.5 dark:border-violet-500/40 dark:bg-violet-500/10">
      <label className="block text-[11px] font-medium text-muted-foreground">
        Konseptor sementara
      </label>
      <input
        value={isian}
        onChange={(e) => {
          setIsian(e.target.value);
          setPilihTerakhir("");
          setSorot(-1);
        }}
        onKeyDown={(e) => {
          // Panah dan Enter hanya mengurus daftar SELAMA daftarnya terbuka.
          // Di luar itu Enter tetap menyimpan seperti sediakala - yang
          // mengetik nama di luar daftar tidak boleh kehilangan jalan
          // tercepatnya hanya karena daftar ini ada.
          if (usul.length > 0) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSorot((n) => (n + 1) % usul.length);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setSorot((n) => (n <= 0 ? usul.length - 1 : n - 1));
              return;
            }
            if (e.key === "Enter" && sorot >= 0) {
              e.preventDefault();
              pilih(usul[sorot]);
              return;
            }
          }
          if (e.key === "Enter") onSimpan(isian);
          if (e.key === "Escape") {
            // Escape menutup daftarnya lebih dulu, baru borangnya. Menutup
            // keduanya sekaligus membuang ketikan orang yang hanya bermaksud
            // menyingkirkan daftar.
            if (usul.length > 0 && sorot >= 0) {
              setSorot(-1);
              return;
            }
            onBatal();
          }
        }}
        placeholder="Nama penyusun naskah, atau kode hakim (A, B, C1…)"
        autoFocus
        role="combobox"
        aria-expanded={usul.length > 0}
        // Menunjuk daftar tawarannya. Tanpa ini pembaca layar mengumumkan
        // "combobox" tanpa pernah menyebut ada berapa pilihan dan apa isinya -
        // dan yang memakainya hanya mendengar kotak isian biasa.
        aria-controls={ID_DAFTAR_HAKIM}
        aria-autocomplete="list"
        className="mt-0.5 h-7 w-full rounded border bg-background px-1.5 text-xs"
      />

      {/* Daftar tawaran. Tidak melayang: borangnya sendiri sudah di dalam sel
          tabel yang dapat digulung, dan kotak melayang di dalam gulungan
          bersarang ikut tergeser dari kotak isiannya. */}
      {usul.length > 0 ? (
        <ul id={ID_DAFTAR_HAKIM} className="mt-1 max-h-32 overflow-auto rounded border bg-card">
          {usul.map((h, i) => (
            <li key={h.id || h.nama}>
              <button
                type="button"
                onMouseDown={(e) => {
                  // onMouseDown, bukan onClick: kotak isiannya kehilangan
                  // fokus lebih dulu pada klik, dan pada sebagian peramban
                  // itu cukup untuk membuang tekanannya.
                  e.preventDefault();
                  pilih(h);
                }}
                className={cn(
                  "flex w-full items-center gap-1.5 px-1.5 py-1 text-left text-[11px] transition",
                  i === sorot ? "bg-violet-200 dark:bg-violet-500/30" : "hover:bg-muted"
                )}
              >
                {h.kode ? (
                  <span className="shrink-0 rounded bg-muted px-1 font-mono text-[10px] font-semibold">
                    {h.kode}
                  </span>
                ) : null}
                <span className="truncate">{h.nama}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Lencana "hakim terdeteksi". Ia keterangan, bukan syarat: nama yang
          TIDAK dikenali tidak diberi tanda apa pun - bukan tanda peringatan -
          sebab nama di luar daftar memang sah. */}
      {dikenali ? (
        <p className="mt-1 text-[10px] text-emerald-700 dark:text-emerald-300">
          Hakim terdeteksi{dikenali.kode ? ` (kode ${dikenali.kode})` : ""}.
        </p>
      ) : null}
      {alasanHakim ? (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Daftar hakim tidak terbaca, jadi namanya tidak dapat ditawarkan — ketik saja
          namanya.
        </p>
      ) : null}
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <button
          type="button"
          disabled={sibuk}
          onClick={() => onSimpan(isian)}
          className="rounded bg-violet-600 px-2 py-0.5 text-[11px] font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
        >
          {sibuk ? "Menyimpan…" : "Simpan"}
        </button>
        {/* Mencabut tunjukan = menyimpan nama kosong. Baris bernama kosong
            tidak pernah disimpan - lihat simpanKonseptorSementara. */}
        {adaTunjukan ? (
          <button
            type="button"
            disabled={sibuk}
            onClick={() => onSimpan("")}
            className="rounded border px-2 py-0.5 text-[11px] transition hover:bg-muted disabled:opacity-50"
          >
            Cabut
          </button>
        ) : null}
        <button
          type="button"
          onClick={onBatal}
          className="rounded px-2 py-0.5 text-[11px] text-muted-foreground transition hover:bg-muted"
        >
          Batal
        </button>
      </div>
      {galat ? <p className="mt-1 text-[11px] text-red-600">{galat}</p> : null}
      {keterangan ? (
        <p className="mt-1 text-[10px] text-muted-foreground">{keterangan}</p>
      ) : null}
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        Tunjukan tangan ALETA - tidak ditulis ke SIPP, dan berhenti berlaku
        begitu SIPP punya namanya sendiri.
      </p>
    </div>
  );
}

/**
 * ============================================================================
 * NOMOR PERKARA YANG BOLEH PATAH - HANYA SESUDAH JENISNYA
 * ============================================================================
 *
 * "403/Pdt.G/2026/PA.Dgl" tidak punya satu pun tempat patah menurut peramban,
 * sehingga lebar minimum kolom Perkara selalu selebar nomor itu - 173 px pada
 * huruf tebal 0,95rem - dan pada layar 1366 px itulah yang mendorong tabel
 * melewati kartunya (diukur 28 September 2026).
 *
 * <wbr> memberi SATU tempat patah, sesudah "Pdt.G/": bila kolomnya cukup lebar
 * nomornya tetap satu baris (tabel auto memberi tiap kolom lebar isinya bila
 * ruangnya ada), dan bila tidak, ia patah menjadi dua potong yang masing-masing
 * masih terbaca - bukan di tengah angka atau di tengah "PA.Dgl". Teksnya tidak
 * berubah: <wbr> bukan aksara, jadi menyalin dan mencari nomornya tetap utuh.
 */
/**
 * Teks yang boleh patah SESUDAH tiap garis miring - "Penggugat/pemohon saja".
 * Peramban tidak mematahkan kata di garis miring, sehingga "Penggugat/pemohon"
 * menjadi satu potong selebar 140 px yang menentukan lebar minimum kolomnya.
 */
function PatahSesudahGaris({ teks }: { teks: string }) {
  const bagian = String(teks ?? "").split("/");
  return (
    <>
      {bagian.map((b, i) => (
        <Fragment key={i}>
          {i > 0 ? (
            <>
              /<wbr />
            </>
          ) : null}
          {b}
        </Fragment>
      ))}
    </>
  );
}

function NomorBolehPatah({ nomor }: { nomor: string }) {
  const bagian = nomor.split("/");
  if (bagian.length < 4) return <>{nomor}</>;
  return (
    <>
      {bagian.slice(0, 2).join("/")}/<wbr />
      {bagian.slice(2).join("/")}
    </>
  );
}

export function SelAntrianJam({
  baris,
  antrian,
  tanggalTampil,
  sidangSelesai,
  tampilMenunggu = true,
  tampilRincianAntrian = true,
  tampilTandaOnline = true,
  tampilJamPanggil = true,
  tungguBerjalan,
  patokan = null,
}: {
  baris: SidangBaris;
  antrian?: AntrianBaris;
  tanggalTampil: string;
  /** Saklar "menunggu-lama" - lencana menunggu N menit. */
  tampilMenunggu?: boolean;
  /**
   * "Tunggu" yang sedang berjalan dari tiga jarak waktu - bila ada, lencana
   * menunggu lama memakainya dan ikut berdetak, sehingga angkanya SAMA dengan
   * "Tunggu" di bawahnya. Tanpanya lencana kembali ke menitMenunggu bot.
   */
  tungguBerjalan?: Jarak;
  patokan?: PatokanWaktu | null;
  /** Saklar "rincian-antrian" - jam ambil tiap sisi dan nama petugas pelayanan. */
  tampilRincianAntrian?: boolean;
  /**
   * Saklar "tanda-antrian-online" - ikon ponsel bila nomornya diambil lewat
   * antrian online (perbaikan 2 Okt sore, butir 4). Bawaannya menyala, sama
   * dengan tanda "online" yang sudah ada sebelumnya tanpa saklar.
   */
  tampilTandaOnline?: boolean;
  /** Saklar "jam-dipanggil" (22 Okt 2026): tulisan "dipanggil hh:mm". */
  tampilJamPanggil?: boolean;
  /**
   * Dihitung di tingkat BARIS, bukan di sini.
   *
   * Dahulu sel ini menghitungnya sendiri - dan itu membuat penandanya tidak
   * pernah muncul pada perkara yang tidak terdaftar di mesin antrian, walau
   * sidangnya sudah selesai: sel ini keluar lebih awal ketika `antrian`
   * kosong, dan seluruh blok hijaunya berada di dalam syarat `antrian.nomor`.
   * Barisnya sendiri yang harus tahu, sebab barisnya yang diberi tanda.
   */
  sidangSelesai: boolean;
}) {
  const jam = baris.jamSidang || "—";
  const lencanaBerdetak = tungguBerjalan?.keadaan === "berjalan" && Boolean(patokan);
  // Satu sumber untuk ikon, keterangannya, dan sisi P/T yang bertanda - lihat
  // @/lib/tanda-antrian-online (yang tidak pasti tidak ditebak).
  const tandaOnline = tampilTandaOnline ? tandaAntrianOnline(antrian) : null;

  if (!antrian) {
    return (
      <>
        <div className="font-semibold tabular-nums">{jam}</div>
        {baris.tanggalSidang !== tanggalTampil ? (
          <div className="text-sm text-muted-foreground">
            {tanggalHariPendek(baris.tanggalSidang, baris.tanggalSidang)}
          </div>
        ) : null}
      </>
    );
  }

  // ==========================================================================
  // HIJAU BERARTI SIDANGNYA SUDAH SELESAI, BUKAN SEKADAR SUDAH DIPANGGIL
  // ==========================================================================
  //
  // Sampai 2.20.4 hijau hanya menyala pada ANGKA antriannya, dan hanya ketika
  // pihaknya sudah dipanggil masuk. Dipanggil masuk bukan selesai: perkara
  // yang pihaknya masuk pukul 09.50 dan sidangnya masih berjalan sampai siang
  // tetap hijau sejak menit pertama, sehingga menyusuri kolom antrian tidak
  // pernah menjawab "yang mana yang sudah beres".
  //
  // Sekarang hijaunya menandai SELESAI - hasil sidangnya sudah dicatat, entah
  // ditunda ke tanggal lain atau diputus hari ini. Batasnya sama persis dengan
  // kotak "Belum tunda", jadi keduanya tidak pernah berselisih: yang bertanda
  // "Belum tunda" tidak pernah hijau, dan yang hijau tidak pernah bertanda itu.
  //
  // Yang sudah dipanggil tetapi belum selesai TIDAK kehilangan tandanya - ia
  // tetap disebut pada baris "dipanggil 09.52" di bawah nomornya. Yang
  // berpindah hanya arti warnanya.
  return (
    <>
      {antrian.nomor ? (
        <div
          className={cn(
            "flex items-baseline gap-1.5",
            sidangSelesai &&
              "-mx-1 rounded-md border-l-2 border-emerald-500 bg-emerald-500/10 px-1 dark:border-emerald-400"
          )}
        >
          <span
            className={cn(
              "text-xl font-bold leading-none tabular-nums",
              // Hijau dan biru portal hampir sama TERANGNYA - diukur, luminans
              // 0,4962 lawan 0,5370, selisih 7,6% - sehingga yang membedakan
              // keduanya praktis hanya RONA. Yang tidak membedakan rona tidak
              // melihat bedanya sama sekali. Karena itu angka yang sudah
              // selesai juga diredupkan: terangnya berbeda, bukan cuma warnanya.
              sidangSelesai
                ? "text-emerald-600 opacity-70 dark:text-emerald-400"
                : "text-primary"
            )}
            title={
              sidangSelesai
                ? `Nomor antrian ${antrian.nomor} — sidangnya sudah selesai`
                : antrian.keadaan === "dipanggil"
                  ? `Nomor antrian ${antrian.nomor} — sudah dipanggil masuk, sidangnya belum selesai`
                  : `Nomor antrian ${antrian.nomor} — menunggu dipanggil`
            }
          >
            {antrian.nomor}
          </span>
          {/* ================================================================
              ONLINE DITANDAI, OFFLINE TIDAK
              ================================================================

              Tanda ini menyebut ASAL pengambilannya, bukan urutannya - online
              dan offline berbaris pada deret yang sama.

              Hanya yang online yang ditandai. Mengambil nomor di mesin ruang
              tunggu adalah keadaan biasa; menandainya "offline" berarti
              memberi label pada hampir setiap baris, dan label yang ada di
              mana-mana berhenti menjadi keterangan.

              CATATAN KEADAAN DATA: kolom `online` pada tabel antrian_sidang
              masih NULL pada seluruh baris di PA Donggala - belum satu pun
              pengambilan tercatat sebagai online. Tandanya karena itu belum
              akan muncul sampai aplikasi antrian mengisi kolom itu. Yang
              kurang datanya, bukan penandanya. */}
          {/* Sejak 2 Okt 2026 sore (butir 4) berupa IKON ponsel + kata
              "online" (kata itu hilang di mode Ringkas, ikonnya tidak), dengan
              keterangan "diambil lewat antrian online" + jamnya di title dan
              aria-label. Dapat dimatikan lewat Tampilan > "Tanda antrian
              online"; kotak saring Antrian online tidak terpengaruh. */}
          <TandaAntrianOnline tanda={tandaOnline} className="self-center" />
        </div>
      ) : (
        <div
          className="text-sm italic text-muted-foreground"
          title="Terdaftar di mesin antrian, tetapi belum ada pihak yang mengambil nomor."
        >
          belum ambil
        </div>
      )}

      {/* ====================================================================
          SUDAH MENUNGGU BERAPA LAMA
          ====================================================================

          Diminta pengguna 23 September 2026: tanda bagi pihak yang sudah
          menunggu lama di ruang tunggu.

          Muncul HANYA selagi keadaannya masih "menunggu" dan sudah melewati
          ambang. Dua sebab:

            - angka yang terus tumbuh sesudah orangnya masuk ruang sidang
              adalah angka yang salah, dan ia akan menyalakan penanda pada
              perkara yang justru sedang disidangkan;
            - penanda yang menyala pada setiap baris berhenti dibaca, dan yang
              pertama berhenti membacanya justru petugas yang paling sering
              melihatnya.

          Warnanya memakai pita jarak yang SAMA dengan jeda antar-sidang di
          layar ini - ambangnya 5/15/30/60 menit, diukur dari 10.989 jarak
          nyata. Menambah ambang keenam yang tidak diukur dari apa pun akan
          membuat dua warna berbeda untuk angka yang sama di satu layar. */}
      {tampilMenunggu && antrian.keadaan === "menunggu" && !lencanaBerdetak &&
      typeof antrian.menitMenunggu === "number" &&
      antrian.menitMenunggu >= AMBANG_MENUNGGU_MENIT ? (
        <div className="mt-0.5">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
              pitaJarak(antrian.menitMenunggu)?.kelas ?? ""
            )}
            title={`Pihaknya sudah mengambil nomor ${sebutanJarak(
              antrian.menitMenunggu
            )} yang lalu dan belum dipanggil masuk.`}
          >
            Menunggu {sebutanJarak(antrian.menitMenunggu)}
          </span>
        </div>
      ) : null}
      {/* Sejak 27 September 2026 lencana yang sama BERDETAK: dihitung dari
          "Tunggu" tiga jarak waktu dengan patokan jam aplikasi antrian, dan
          muncul pada detik ambangnya terlewati - tidak menunggu muat ulang 45
          detik. Menit bot di atas hanya cadangan bila waktu antrian tidak
          terkirim (bot lama), supaya angka di lencana dan di "Tunggu" tidak
          pernah berselisih. */}
      {tampilMenunggu && antrian.keadaan === "menunggu" && lencanaBerdetak && tungguBerjalan && patokan ? (
        <LencanaMenungguBerjalan
          jarak={tungguBerjalan}
          patokan={patokan}
          ambangMenit={AMBANG_MENUNGGU_MENIT}
        />
      ) : null}

      <div className="mt-0.5 text-sm tabular-nums text-muted-foreground">{jam}</div>

      {/* Kode majelis aplikasi antrian ("C1|C2|C3", butir 4 5 Okt 2026) DIBUANG
          dari sel ini 6 Okt 2026 (butir 6): ia mengulang kode di kolom
          Majelis & Petugas pada baris yang sama. Datanya (antrian.majelisKode)
          tetap terbaca dan tetap dipakai di tempat lain. */}

      {/* ====================================================================
          SIAPA YANG SUDAH MENGAMBIL - BUKAN SEKADAR "SUDAH DIAMBIL"
          ====================================================================

          Mesin antrian mencatat waktu pengambilan TERPISAH untuk tiap sisi:
          pihak_1, pihak_2, dan saksi. Ketiganya sudah lama terbaca ALETA dan
          sudah sampai ke layar ini, tetapi tidak pernah digambar - yang tampil
          hanya "ambil 08:17", waktu paling awal di antara keduanya.

          Bedanya menentukan. "Sudah ambil antrian" pada perkara yang hanya
          penggugatnya datang terbaca seolah kedua pihak sudah hadir, dan
          panitera yang memanggil perkara baru mengetahuinya di depan ruang
          sidang. Sekarang tiap sisi disebut sendiri beserta jamnya.

          Yang BELUM mengambil tidak digambar sama sekali. Menampilkan "T: —"
          pada perkara verstek yang tergugatnya memang tidak akan pernah datang
          hanya menambah baris yang tidak menagih apa pun. */}
      {!tampilRincianAntrian ? null : antrian.pihak1 || antrian.pihak2 || antrian.saksi ? (
        <div className="mt-0.5 flex flex-wrap gap-x-1.5 gap-y-0.5 text-[10px] leading-tight">
          {antrian.pihak1 ? (
            <span
              className="rounded bg-emerald-100 px-1 font-medium text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
              title={
                tandaOnline?.sisi === "P"
                  ? tandaOnline.keterangan
                  : `Penggugat/pemohon mengambil antrian pukul ${antrian.pihak1}`
              }
            >
              P {antrian.pihak1}
              {tandaOnline?.sisi === "P" ? (
                <Smartphone className="ml-0.5 inline h-2.5 w-2.5 align-[-1px]" aria-label="lewat antrian online" />
              ) : null}
            </span>
          ) : null}
          {antrian.pihak2 ? (
            <span
              className="rounded bg-emerald-100 px-1 font-medium text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
              title={
                tandaOnline?.sisi === "T"
                  ? tandaOnline.keterangan
                  : `Tergugat/termohon mengambil antrian pukul ${antrian.pihak2}`
              }
            >
              T {antrian.pihak2}
              {tandaOnline?.sisi === "T" ? (
                <Smartphone className="ml-0.5 inline h-2.5 w-2.5 align-[-1px]" aria-label="lewat antrian online" />
              ) : null}
            </span>
          ) : null}
          {antrian.saksi ? (
            <span
              className="rounded bg-sky-100 px-1 font-medium text-sky-900 dark:bg-sky-950 dark:text-sky-200"
              title={`Saksi mengambil antrian pukul ${antrian.saksi}`}
            >
              Saksi {antrian.saksi}
            </span>
          ) : null}
        </div>
      ) : antrian.waktuAmbil ? (
        <div className="text-[10px] text-muted-foreground" title="Waktu antrian diambil">
          ambil {antrian.waktuAmbil}
        </div>
      ) : null}

      {tampilJamPanggil && antrian.keadaan === "dipanggil" && antrian.jamPanggil ? (
        <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
          dipanggil {antrian.jamPanggil}
        </div>
      ) : null}

      {/* SIAPA YANG MELAYANI PENGAMBILAN NOMORNYA.

          Diminta pengguna 22 September 2026. Namanya sudah ikut terkirim dari
          aplikasi antrian sejak lama - tersimpan di dalam tipe, tidak pernah
          digambar sekali pun.

          Ia yang dicari ketika ada yang bertanya "siapa yang melayani ibu itu
          tadi pagi", dan tanpa baris ini jawabannya hanya dapat ditemukan
          dengan membuka basis data aplikasi antrian. */}
      {tampilRincianAntrian && antrian.namaPetugas ? (
        <div
          className="text-[10px] text-muted-foreground"
          title="Petugas yang melayani pengambilan nomor antrian ini"
        >
          petugas: {antrian.namaPetugas}
        </div>
      ) : null}

      {baris.tanggalSidang !== tanggalTampil ? (
        <div className="text-sm text-muted-foreground">
          {tanggalHariPendek(baris.tanggalSidang, baris.tanggalSidang)}
        </div>
      ) : null}
    </>
  );
}

function LencanaKesiapan({
  nilai,
  diminta = true,
}: {
  nilai: KesiapanRingkas | undefined;
  diminta?: boolean;
}) {
  // Bergaris punya DUA sebab yang sangat berbeda: skornya belum diminta, atau
  // sidang itu tidak dapat dinilai. Menyamakan keduanya membuat orang mengira
  // fiturnya rusak.
  if (!nilai) {
    return (
      <span
        className="text-sm text-muted-foreground"
        title={
          diminta
            ? "Sidang ini tidak dapat dinilai - datanya belum cukup terbaca."
            : "Skor belum dihitung. Tekan Hitung skor di atas."
        }
      >
        —
      </span>
    );
  }

  const varian =
    nilai.keadaan === "siap" ? "success" : nilai.keadaan === "perhatian" ? "warning" : "danger";

  return (
    <Badge
      variant={varian}
      title={
        nilai.penghambat.length > 0
          ? nilai.penghambat.map((x) => `${x.tingkat.toUpperCase()}: ${x.pesan}`).join("\n")
          : "Tidak ada penghambat tercatat."
      }
    >
      {nilai.skor}
      {nilai.penghambat.length > 0 ? ` · ${nilai.penghambat.length}` : ""}
    </Badge>
  );
}

/**
 * Tergugat TANPA turut tergugat (butir 23, 6 Okt 2026): bot masih memasukkan
 * turut tergugat ke `tergugat` demi pemakai lama, dan layar ini menyebutnya
 * sendiri di baris "Turut T". Nama yang sama tidak ditulis dua kali.
 */
export function pihakTampil(pihak: { tergugat: string[]; turutTergugat?: string[] }) {
  const turut = new Set(pihak.turutTergugat ?? []);
  return { tergugat: turut.size ? pihak.tergugat.filter((n) => !turut.has(n)) : pihak.tergugat };
}

/**
 * Penanda merah "court calendar tidak sinkron" di samping nomor perkara
 * (butir 21, 6 Okt 2026). Sebabnya di title. Tidak digambar bila sinkron,
 * bukan e-Litigasi, atau datanya tidak terbaca.
 */
export function LencanaCourtCalendarSinkron({ baris }: { baris: Parameters<typeof keadaanCourtCalendar>[0] }) {
  const k = keadaanCourtCalendar(baris);
  if (!k || k.sinkron) return null;
  return (
    <span
      data-cc-tidak-sinkron=""
      className="whitespace-nowrap rounded bg-rose-600 px-1.5 py-0.5 text-[11px] font-semibold text-white"
      title={k.sebab}
    >
      Court calendar tidak sinkron
    </span>
  );
}

/**
 * Penanda mediasi di kolom Agenda (butir 8-9, 6 Okt 2026): "Mediasi" (pernah
 * bermediasi) dan hasil mediasi. Ditekan = membuka Status Perkara perkara itu,
 * tempat keterangan mediasinya lengkap.
 */
export function PenandaMediasiAgenda({
  penanda,
  onBuka,
}: {
  penanda: Array<PenandaMediasi | null>;
  onBuka?: () => void;
}) {
  const ada = penanda.filter((x): x is PenandaMediasi => Boolean(x));
  if (ada.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {ada.map((p) => (
        <button
          key={p.kunci}
          type="button"
          data-penanda-mediasi={p.kunci}
          onClick={onBuka}
          disabled={!onBuka}
          className={cn(
            "whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold disabled:cursor-default",
            p.kelas
          )}
          title={p.keterangan}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Batas lebar kolom Majelis & Petugas (6 Okt 2026) - pada kepala DAN sel,
 * sebab tabel bertata letak otomatis mengabaikan batas yang hanya ada di salah
 * satunya. Lihat catatan pada kepala kolomnya.
 */
export const LEBAR_KOLOM_MAJELIS = "w-[17rem] max-w-[17rem]";

/**
 * Kolom Agenda dilebarkan (14 Okt 2026, permintaan pengguna). Tanpa batas, tabel
 * otomatis membagi sisa lebar menurut lebar IDEAL tiap kolom - "Perkara & Para
 * Pihak" (nama + lencana) merebutnya, dan agenda pendek terjepit: terukur di
 * replika Chromium 1366 px kolom Agenda 131 px. Batas BAWAH (min-w) di kepala DAN
 * sel: 1366 px -> 198 px (Perkara 240 -> 200 px, tanpa isi yang meluap),
 * 1920 px -> 303 px (Perkara 492 -> 472 px). Bukan w- tetap: agenda panjang
 * tetap boleh melebar.
 */
export const LEBAR_KOLOM_AGENDA = "min-w-[12rem] 2xl:min-w-[18rem]";

/** Lencana keadaan verifikasi majelis - sejalan dengan Kendali Berkas. */
function LencanaVerifikasi({ status }: { status: string }) {
  if (status === "valid") return <Badge variant="success">Diverifikasi</Badge>;
  if (status === "tidak_valid") return <Badge variant="danger">Tidak valid</Badge>;
  // Berkas pendaftaran tidak mengenal verifikasi majelis sama sekali - lihat
  // catatan pada ecourtVerificationService di ALETA Bot.
  if (status === "tidak_perlu") return <Badge variant="muted">Tanpa verifikasi</Badge>;
  return <Badge variant="warning">Menunggu majelis</Badge>;
}

/**
 * Audit hak 23 Okt 2026: tampilan lewat TAUTAN RAHASIA Jadwal Sidang tidak memuat
 * unduhan berkas (BAS, relaas, resi, putusan) - rute berkas-sipp tidak ada di
 * daftar izin tautan (server/modules/tautan-jadwal), jadi tombolnya hanya akan
 * menjawab ditolak. Bernilai true di dalam Jadwal Sidang bermode alamat.
 */
export const UnduhTertutupTautan = createContext(false);

/** Tombol unduh yang menampilkan sebab kegagalan, bukan sekadar kata gagal. */
export function TombolUnduh({
  alamat,
  label,
  namaCadangan,
}: {
  alamat: string;
  label: string;
  namaCadangan: string;
}) {
  const tertutupTautan = useContext(UnduhTertutupTautan);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");

  const unduh = async () => {
    setSibuk(true);
    setGalat("");
    try {
      const respons = await fetch(apiPath(alamat), { cache: "no-store" });
      // Satu penanganan bersama (butir 31, 30 Sep 2026): badan 0 bita yang
      // Content-Length-nya berisi berarti pengelola unduhan peramban sudah
      // mengambilnya - BERHASIL, bukan "kosong di server". Lihat unduh-berkas.ts.
      const hasil = await tanganiUnduhan(respons, { namaCadangan, alamat: apiPath(alamat) });
      if (!hasil.ok) setGalat(hasil.pesan);
    } catch (kesalahan) {
      setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal mengunduh.");
    } finally {
      setSibuk(false);
    }
  };

  if (tertutupTautan) return null;

  return (
    <span className="inline-flex flex-col gap-1">
      <Button size="sm" variant="outline" disabled={sibuk} onClick={() => void unduh()}>
        {sibuk ? "…" : label}
      </Button>
      {galat ? <span className="max-w-[16rem] text-sm text-rose-600">{galat}</span> : null}
    </span>
  );
}

/**
 * Kalender sidang satu bulan, muncul sebagai pop up.
 *
 * ============================================================================
 * HITUNGAN DI KOTAK TANGGAL, BUKAN DAFTAR PERKARANYA
 * ============================================================================
 *
 * Kalender menjawab satu pertanyaan: hari mana yang ada sidangnya. Kotak
 * tanggal cukup memuat angkanya, dan hari yang dipilih membuka daftarnya di
 * tabel. Menjejalkan nomor perkara ke dalam kotak tanggal menghasilkan
 * kalender yang tidak terbaca sekaligus memajang perkara sebulan penuh.
 */
function KalenderSidang({
  bulanAwal,
  tanggalTerpilih,
  onPilih,
  onTutup,
}: {
  bulanAwal: string;
  tanggalTerpilih: string;
  onPilih: (tanggal: string) => void;
  onTutup: () => void;
}) {
  const [bulan, setBulan] = useState(bulanAwal);
  const [hari, setHari] = useState<Array<{ tanggal: string; jumlah: number; jumlahDitunda: number }>>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState("");

  // Pemuatan ditunda satu putaran, mengikuti pola panel e-Court lain:
  // memanggil setState langsung di dalam efek memicu render beruntun.
  useEffect(() => {
    let hidup = true;

    const timer = window.setTimeout(() => {
      if (!hidup) return;
      setMemuat(true);
      setGalat("");
      void muatBulan();
    }, 0);

    async function muatBulan() {
      try {
        const jawaban = await fetch(
          apiPath(`/api/aleta-ecourt/sidang?kalender=${encodeURIComponent(bulan)}`),
          { cache: "no-store" }
        );
        const isi = await jawaban.json();
        if (!hidup) return;
        if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal membaca kalender."));

        const data = isi?.data ?? isi;
        if (!data?.available) {
          setGalat(String(data?.message || "ALETA Bot belum dapat dihubungi."));
          setHari([]);
          return;
        }
        setHari(Array.isArray(data.hari) ? data.hari : []);
      } catch (kesalahan) {
        if (hidup) setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal membaca kalender.");
      } finally {
        if (hidup) setMemuat(false);
      }
    }

    return () => {
      hidup = false;
      window.clearTimeout(timer);
    };
  }, [bulan]);

  // Menutup dengan Escape: pop up yang hanya dapat ditutup dengan tombol di
  // layar akan menjebak pembaca yang terbiasa menekan Escape.
  useEffect(() => {
    const tekan = (peristiwa: KeyboardEvent) => {
      if (peristiwa.key === "Escape") onTutup();
    };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, [onTutup]);

  const [tahun, nomorBulan] = bulan.split("-").map((bagian) => Number(bagian));
  const hariPertama = new Date(tahun, nomorBulan - 1, 1);
  const jumlahHari = new Date(tahun, nomorBulan, 0).getDate();
  // Kotak kosong sebelum tanggal 1, supaya tanggalnya jatuh di kolom harinya.
  const kosongDiDepan = hariPertama.getDay();

  const petaHari = new Map(hari.map((baris) => [baris.tanggal, baris]));
  const geserBulan = (selisih: number) => {
    const waktu = new Date(tahun, nomorBulan - 1 + selisih, 1);
    setBulan(`${waktu.getFullYear()}-${String(waktu.getMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Kalender sidang"
      onClick={onTutup}
    >
      <div
        className="max-h-[90dvh] w-full max-w-lg overflow-auto rounded-lg border bg-background p-4 shadow-lg"
        onClick={(peristiwa) => peristiwa.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <Button size="sm" variant="outline" onClick={() => geserBulan(-1)}>
            ‹
          </Button>
          <h3 className="text-sm font-semibold">
            {BULAN_PANJANG[nomorBulan - 1]} {tahun}
          </h3>
          <Button size="sm" variant="outline" onClick={() => geserBulan(1)}>
            ›
          </Button>
        </div>

        {galat ? (
          <p className="mb-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {galat}
          </p>
        ) : null}

        <div className="grid grid-cols-7 gap-1 text-center text-sm">
          {HARI_PENDEK.map((nama, urutan) => (
            <div key={nama} className={`py-1 font-medium ${urutan % 6 === 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
              {nama}
            </div>
          ))}

          {Array.from({ length: kosongDiDepan }).map((_, urutan) => (
            <div key={`kosong-${urutan}`} />
          ))}

          {Array.from({ length: jumlahHari }).map((_, urutan) => {
            const nomorHari = urutan + 1;
            const tanggal = `${bulan}-${String(nomorHari).padStart(2, "0")}`;
            const isi = petaHari.get(tanggal);
            const terpilih = tanggal === tanggalTerpilih;
            const akhirPekan = new Date(tahun, nomorBulan - 1, nomorHari).getDay() % 6 === 0;

            return (
              <button
                key={tanggal}
                type="button"
                onClick={() => onPilih(tanggal)}
                className={[
                  "flex min-h-[3rem] flex-col items-center justify-center rounded-md border p-1 transition",
                  terpilih ? "border-primary bg-primary/10 font-semibold" : "border-transparent",
                  isi ? "bg-muted/60 hover:bg-muted" : "hover:bg-muted/40",
                  // 23 Okt 2026: Sabtu/Minggu merah, sama dengan kalender libur.
                  akhirPekan ? "text-red-600 dark:text-red-400" : "",
                ].join(" ")}
                aria-label={`${tanggalHariPanjang(tanggal)}${isi ? `, ${isi.jumlah} sidang` : ", tanpa sidang"}`}
              >
                <span>{nomorHari}</span>
                {isi ? (
                  <span className="mt-0.5 rounded bg-emerald-100 px-1 text-[10px] font-semibold text-emerald-800">
                    {isi.jumlah}
                    {isi.jumlahDitunda > 0 ? ` · ${isi.jumlahDitunda} tunda` : ""}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {/* Tanpa tulisan memuat (JADWAL-3 butir 5) - kalimatnya sama sebelum dan sesudah angka datang. */}
            Angka pada tanggal adalah jumlah sidang.
          </p>
          <Button size="sm" variant="outline" onClick={onTutup}>
            Tutup
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * @param onBukaStatus dipanggil saat satu perkara diklik dari rincian
 *   kelompok. Halaman induk yang berpindah menu - komponen ini tidak tahu
 *   menu apa saja yang ada, dan tidak seharusnya tahu.
 */
export function AletaEcourtSidang({
  onBukaStatus,
  onBukaTunda,
  bolehCetakRelaas = false,
  modeUrl = false,
  awal,
  bolehKelolaTautan = false,
  namaTautan = "",
}: {
  onBukaStatus?: (nomorPerkara: string) => void;
  /**
   * Dipanggil saat kotak nomor perkara diketuk, dan MENDAHULUI onBukaStatus.
   *
   * Yang memegang layar ini sedang duduk di persidangan. Yang ia butuhkan dari
   * satu ketukan pada nomor perkara bukan halaman bacaan, melainkan tempat
   * menuliskan hasil sidangnya. Status perkara tetap terjangkau lewat kisi
   * kartu alur - jalan yang memang sudah ada sebelum nomor perkara dijadikan
   * tombol.
   *
   * Tetap opsional: layar lain yang memakai komponen ini tidak menyediakannya,
   * dan di sana nomor perkara tetap membuka status seperti sediakala.
   */
  onBukaTunda?: (baris: { nomorPerkara: string; sidangId: string }) => void;
  /**
   * Menampilkan tombol "Cetak relaas" - panggilan sidang dan pemberitahuan
   * putusan yang lahir pada hari itu, dicetak lewat ekstensi ALETA.
   *
   * Opsional dan bawaannya mati: layar lain yang memakai komponen ini tidak
   * mengirimnya dan tidak berubah sama sekali. Halaman e-Court mengirimnya
   * bagi juru sita, admin, dan super admin.
   */
  bolehCetakRelaas?: boolean;
  /**
   * TAMPILAN LEWAT ALAMAT (/jadwal, 20 Okt 2026).
   *
   * Komponen yang SAMA, hanya apa yang digambar yang dibatasi: tag dan lencana
   * semuanya tampil; tombol hanya tunda | putus, Court Calendar, Mediator, dan
   * tombol kolom kanan (Rincian, Status, Blangko, Pertanyaan saksi, Skors,
   * Lompat, Tandai berjalan, Selesai, Keterangan, Tunjuk konseptor); di kepala
   * hanya alat CETAK. Daftar izinnya satu: tampilanUrlJadwal() di
   * @/lib/jadwal-tampil-url. Hak peran tetap berlaku (saringSaklarSidang).
   */
  modeUrl?: boolean;
  /** Nilai awal dari alamat: tanggal (YYYY-MM-DD), ruang, majelis. */
  awal?: Partial<ParameterJadwalTampil>;
  /**
   * Menampilkan tombol kecil "Tautan jadwal" di pojok kanan atas (Super Admin
   * dan Admin): menuju pengaturan tempat tautan rahasia tampilan alamat dibuat
   * dan dicabut. Rahasianya hanya tampak sekali saat dibuat, jadi tidak ada
   * tombol "salin" di sini.
   */
  bolehKelolaTautan?: boolean;
  /** Nama tautan yang sedang dipakai (mode alamat) - ditampilkan di bawah judul. */
  namaTautan?: string;
} = {}) {
  // 21 Okt 2026: lapisan memuat/berhasil tidak muncul di jadwal; hanya yang GAGAL.
  useOverlayHanyaGagal();
  const [dari, setDari] = useState(awal?.tanggal || hariIni());
  const [sampai, setSampai] = useState(awal?.tanggal || hariIni());
  const [cari, setCari] = useState("");

  const [sidang, setSidang] = useState<SidangBaris[]>([]);
  const [kesiapan, setKesiapan] = useState<Record<string, KesiapanRingkas>>({});

  /**
   * Tunjukan konseptor sementara, menurut perkara_id.
   *
   * Dimuat TERPISAH dari jadwalnya, dan itu disengaja. Jadwal datang dari SIPP
   * lewat bot; tunjukan ini dari basis data ALETA sendiri. Menyatukan keduanya
   * dalam satu muatan berarti satu kegagalan SIPP ikut menghilangkan tunjukan
   * yang sama sekali tidak memerlukan SIPP.
   */
  const [tunjukan, setTunjukan] = useState<Record<string, KonseptorSementara>>({});
  // Butir 38 (17 Okt): checklist untuk perkara TANPA tunjukan yang konseptornya sudah tercatat di SIPP.
  const [checklistTanpaTunjukan, setChecklistTanpaTunjukan] = useState<
    Record<string, { kemajuan?: KonseptorSementara["kemajuan"]; konseptorSipp: string[] }>
  >({});
  /** F4.2: ringkas draf H-7 agen ALETA per perkara (hanya yang punya draf). */
  const [drafH7, setDrafH7] = useState<Record<string, RingkasDrafH7>>({});
  const [keterangan, setKeterangan] = useState<Record<string, KeteranganPerkara>>({});
  const [keteranganKunci, setKeteranganKunci] = useState<string | null>(null);
  const [tunjukKunci, setTunjukKunci] = useState<string | null>(null);
  // Antrian datang bersama jadwal dalam satu permintaan - ia dibaca bot dari
  // basis data lain, dan menariknya terpisah dari peramban berarti dua
  // permintaan yang hasilnya dapat berbeda umur.
  const [antrian, setAntrian] = useState<KeadaanAntrian>({
    terbaca: false,
    alasan: "",
    tanggal: [],
    peta: {},
  });
  // Waktu antrian berdetik - bahan tiga jarak waktu - datang dalam permintaan
  // yang SAMA dengan jadwal dan antriannya, dengan sebab yang sama: umur
  // ketiganya harus sama. Patokannya "sekarang" menurut jam aplikasi antrian
  // beserta Date.now() peramban saat diterima; lihat tiga-jarak-sidang.tsx.
  const [waktuAntrian, setWaktuAntrian] = useState<WaktuAntrian>(WAKTU_ANTRIAN_KOSONG);
  const [patokanWaktu, setPatokanWaktu] = useState<PatokanWaktu | null>(null);
  // Penilaian kesiapan membaca SIPP dan arsip e-Court untuk TIAP sidang -
  // beberapa kueri per perkara. Dimulai MATI supaya jadwalnya muncul seketika;
  // petugas yang memang memerlukan skornya menyalakannya sendiri.
  const [nilaiKesiapan, setNilaiKesiapan] = useState(false);
  const [alurTerpilih, setAlurTerpilih] = useState("");

  // Penyaring dari kartu rincian. Keempatnya berdiri sendiri dan digabung
  // dengan "dan": majelis C DI ruang 1 adalah pertanyaan yang benar-benar
  // ditanya, dan memaksa memilih salah satu saja membuat kartunya setengah
  // berguna.
  const [saringJenis, setSaringJenis] = useState("");
  const [saringTahap, setSaringTahap] = useState("");
  const [saringMajelis, setSaringMajelis] = useState("");
  const [saringRuang, setSaringRuang] = useState("");

  // Dipanggil setiap kelompok alur berganti atau ditutup. Penyaring yang
  // tertinggal dari kelompok sebelumnya menampilkan daftar kosong tanpa
  // sebab yang terlihat - dan yang disalahkan biasanya datanya.
  const bersihkanSaringan = () => {
    setSaringJenis("");
    setSaringTahap("");
    setSaringMajelis("");
    setSaringRuang("");
  };

  // ==========================================================================
  // URUT, SARING, CARI
  // ==========================================================================
  //
  // Ketiganya bekerja atas baris yang SUDAH termuat - tanpa satu pun kueri ke
  // SIPP. Itu sebabnya ia boleh berjalan pada tiap ketikan, berbeda dari kotak
  // Cari di atas yang dikirim ke SIPP dan menuntut tombol Tampilkan.
  // Dinamai urutTabel, bukan urutan: tiap tabel memetakan barisnya dengan
  // .map((baris, urutan) => ...), dan nama yang sama akan tertutupi indeks
  // baris di dalam map - keadaan pengurutan mendadak berarti nomor urut.
  const { urutan: urutTabel, tekan: tekanUrut } = useUrutan(null);
  const [keadaanTerpilih, setKeadaanTerpilih] = useState<string[]>([]);
  // Tanggal dan "sudah lewat 15:00" menurut WITA - aturan berjam di kotak
  // Perlu diperiksa dan tanda merah Belum ditunda. Lihat useSaatPengadilan.
  const saat = useSaatPengadilan();
  const [cariCepat, setCariCepat] = useState("");
  const [lanjutTerbuka, setLanjutTerbuka] = useState(false);
  const cariLanjut = useCariLanjut();

  /**
   * Ada tidaknya saringan yang sedang menyempitkan daftar.
   *
   * Satu sumber kebenaran, dipakai tombol Reset untuk MATI-HIDUPnya sekaligus
   * TAMPILANNYA. Sebelumnya keduanya dihitung terpisah: yang mematikan tombol
   * memeriksa empat hal, yang mewarnainya hanya dua - sehingga tombol yang
   * masih dapat ditekan tampil seperti tombol mati, dan tulisannya pun
   * berubah pada saat yang berbeda dari warnanya.
   *
   * Keempat penyaring kartu ikut dihitung. Merekalah yang paling mudah
   * tertinggal menyala tanpa disadari - letaknya di dalam panel yang dapat
   * ditutup, sehingga daftar dapat tampak kosong tanpa satu pun saringan
   * terlihat di layar.
   *
   * Rentang tanggal sengaja TIDAK ikut: ia menentukan HARI yang dilihat, dan
   * tombol yang berbunyi "Reset" tidak sepatutnya memindahkan orang ke hari
   * lain tanpa diminta.
   *
   * Kata kunci yang sudah dikirim ke SIPP justru IKUT, sejak kedua kotak
   * pencarian disatukan. Ia menyempitkan daftar persis seperti saringan lain,
   * bedanya penyempitan itu terjadi di seberang sana dan tidak meninggalkan
   * jejak apa pun di layar - kalau ia tidak ikut dilepas, tombol yang
   * berbunyi "Reset ke 27 perkara" tidak pernah sampai ke 27.
   */
  // adaSaringan dihitung SESUDAH saklar Tampilan terbaca (lihat di bawah, dekat
  // `dimatikan`): pencarian lanjutan yang sakelarnya mati tidak dihitung.

  const alihkanKeadaan = (kunci: string) =>
    setKeadaanTerpilih((sekarang) =>
      sekarang.includes(kunci)
        ? sekarang.filter((x) => x !== kunci)
        : [...sekarang, kunci]
    );

  const [sedangCetak, setSedangCetak] = useState(false);
  // Dialog Cetak relaas. Menutupnya TIDAK menghentikan putaran cetak - putaran
  // itu hidup di ekstensi, dan dialog yang dibuka lagi menampilkannya kembali.
  const [cetakRelaasTerbuka, setCetakRelaasTerbuka] = useState(false);

  // Kendali diciutkan supaya daftar sidang lebih panjang. Bawaannya TERBUKA:
  // yang baru membuka layar harus melihat alat yang tersedia, dan menemukan
  // layar yang alatnya tersembunyi jauh lebih membingungkan daripada layar
  // yang alatnya makan tempat.
  const [kendaliCiut, setKendaliCiut] = useState(false);
  /**
   * Deret kotak penanda diciutkan - dan yang dihemat TINGGINYA.
   *
   * Keluhan yang dilaporkan berbunyi "kalau diperbesar lari ke kanan", tetapi
   * diukur pada empat belas lebar layar dari 1400 px sampai 360 px, deret ini
   * TIDAK PERNAH meluber: scrollWidth selalu sama dengan clientWidth, sebab
   * pembungkusnya dan tiap pilnya sudah membungkus sendiri. Yang meluber ke
   * kanan pada layar itu tabelnya - min-w-[980px] di dalam ruang isi 916 px.
   *
   * Yang sungguh dimakan deret ini TINGGI: 58 px pada lebar isi 1188, 86 px
   * pada 916, dan 160 px pada 520 - dan pada layar laptop tiap 58 piksel
   * adalah satu baris sidang yang tidak terlihat.
   */
  const [penandaCiut, setPenandaCiut] = useState(false);

  /**
   * Kelompok penanda mana saja yang sedang diciutkan.
   *
   * Empat kelompoknya - Panggilan, Jalannya sidang, Putusan, Antrian - dapat
   * diciutkan sendiri-sendiri. Panitera yang sedang mengurus panggilan tidak
   * memerlukan deret Putusan, dan sebaliknya.
   *
   * Tombol "Penanda" tetap ada sebagai saklar induk: ia mengisi atau
   * mengosongkan daftar ini sekaligus, supaya yang hanya ingin memanjangkan
   * daftar sidang tidak perlu menekan empat kali.
   */
  const [kelompokCiut, setKelompokCiut] = useState<string[]>([]);

  const alihkanKelompokPenanda = (kunci: string) =>
    setKelompokCiut((lama) =>
      lama.includes(kunci) ? lama.filter((x) => x !== kunci) : [...lama, kunci]
    );

  const alihkanSeluruhPenanda = () => {
    const ciut = !penandaCiut;
    setPenandaCiut(ciut);
    setKelompokCiut(ciut ? KELOMPOK_KEADAAN.map((k) => k.kunci) : []);
  };

  /**
   * Menyaring daftar menjadi perkara akun yang sedang masuk.
   *
   * Menyala sejak awal. Tombolnya berbunyi "tampilkan semua perkara", dan
   * kalimat itu hanya masuk akal bila yang tampil sebelumnya belum semuanya.
   *
   * Keadaannya TIDAK diingat peramban, dan itu disengaja. Yang diingat akan
   * terbawa ke akun lain pada komputer bersama di ruang panitera - dan orang
   * berikutnya mendapati daftar yang tersaring atas nama orang sebelumnya
   * tanpa tahu sebabnya.
   */
  // Tampilan lewat alamat memuat SELURUH jadwal satker (tombol "Perkara saya"
  // tidak ada di sana); yang hanya ingin satu majelis memakai ?majelis=.
  const [hanyaMilikSaya, setHanyaMilikSaya] = useState(!modeUrl);

  /**
   * Butir 11 (6 Okt 2026): "Tampilkan contoh" di panel Tampilan - memampangkan
   * contoh tampil/disembunyikan di bawah tiap saklar. Tidak diingat: ia alat
   * bantu sesaat ketika menyetel, bukan bagian tampilan layar.
   */
  const [contohSaklar, setContohSaklar] = useState(false);

  /** Butir 5 (6 Okt 2026): ruang sidang pilihan di ujung kanan deretan alat. Tidak diingat - sama seperti di atas. */
  const [ruangDipilih, setRuangDipilihMentah] = useState<string | null>(null);
  // Dari alamat (?ruang=): berlaku sampai pemakai menekan pilihan ruang sendiri.
  const [ruangAlamat, setRuangAlamat] = useState(awal?.ruang ?? "");
  const setRuangDipilih = useCallback((ruang: string | null) => {
    setRuangAlamat("");
    setRuangDipilihMentah(ruang);
  }, []);

  // Nama pengadilan dari identitas lembaga, bukan dipatok mati - ALETA dapat
  // dipasang di satker lain.
  const { institutionIdentity, currentUser, positions, panelSettings } = usePortal();
  // JADWAL-3 tambahan B: alamat ABT dari setelan aplikasi luar "APS Badilag", dan jenis blangko menurut peran.
  const setelanAps = panelSettings?.externalApps?.["aps-badilag"]?.baseUrl ?? "";
  const jenisBlangkoPeran = useMemo(() => jenisBlangkoBoleh(currentUser), [currentUser]);
  const [memuat, setMemuat] = useState(true);
  /**
   * ==========================================================================
   * PENYEGARAN TIDAK BOLEH MELEPAS TABELNYA DARI LAYAR
   * ==========================================================================
   *
   * Halaman ini memuat ulang dirinya sendiri sepanjang hari - tundaan dan
   * putusan datang terus, dan layar yang basi tampak persis seperti layar yang
   * benar. Pemuatan ulang itu memang harus ada.
   *
   * Yang keliru bukan pemuatannya, melainkan APA YANG DIGAMBAR selama
   * pemuatan. Seluruh isi tbody diganti satu baris "Memuat jadwal…", sehingga
   * tabel tujuh belas baris menyusut menjadi satu. Halaman ikut memendek, dan
   * peramban - yang tidak dapat mempertahankan posisi gulir pada dokumen yang
   * mendadak lebih pendek daripada posisi itu sendiri - menjepitnya ke atas.
   * Begitu barisnya kembali, pembacanya sudah berada di puncak halaman.
   *
   * Itulah sebab layar ini "melompat ke atas sendiri" tiap kali ada yang
   * mengambil nomor antrian: mengambil nomor memicu penyegaran, dan
   * penyegaranlah yang memendekkan halaman.
   *
   * Perbaikannya bukan mematikan penyegaran - itu mengembalikan layar basi -
   * melainkan membiarkan baris yang SUDAH ada tetap terpasang selama data
   * barunya datang. Kuncinya stabil (nomorPerkara|sidangId), jadi React
   * menukar isinya di tempat tanpa melepas satu baris pun, dan posisi gulir
   * tidak pernah bergerak.
   *
   * Pesan "Memuat jadwal…" karena itu hanya untuk muatan PERTAMA, ketika
   * memang belum ada apa pun yang dapat ditampilkan. Pola yang sama sudah
   * dipakai layar Ambil Antrian - lihat pertamaMuat di aleta-antrian-ambil.
   */
  const [pertamaMuat, setPertamaMuat] = useState(true);
  // Dibaca dari dalam pemuatan ulang berkala - lihat catatannya di muatTanggal.
  const memuatRef = useRef(false);
  // 22 Okt 2026: waktu bacaan terakhir (ringan/lengkap) untuk tanda "diperbarui hh:mm:ss"; di luar state agar layar tidak dilukis ulang.
  const [penyimpanDiperbarui] = useState(buatPenyimpanDiperbarui);
  // A4 (25 Okt 2026): bila daftar dibaca dari Cermin Perkara - kapan cermin terakhir dihitung ulang (null = dari SIPP seperti biasa).
  const [cerminJadwal, setCerminJadwal] = useState<{ diperbaruiPada: string | null } | null>(null);
  const [galat, setGalat] = useState("");

  const [kalenderTerbuka, setKalenderTerbuka] = useState(false);
  const [dibuka, setDibuka] = useState("");

  /**
   * Baris mana yang sedang mencatat hasil sidang, dan lewat jalan yang mana.
   *
   * SATU pada satu waktu, sengaja. Dua borang tulis-ke-SIPP yang terbuka
   * bersamaan adalah undangan menekan tombol tulis pada baris yang keliru -
   * dan yang keliru itu tercatat di berkas perkara orang atas nama panitera
   * sidangnya.
   */
  const [catat, setCatat] = useState<{ kunci: string; jalan: "tunda" | "putus" } | null>(null);

  /**
   * ==========================================================================
   * RINCIAN YANG TERPOTONG - DUA SEBAB, DUA PERBAIKAN
   * ==========================================================================
   *
   * Petugas melaporkan "masih terpotong tampilan ketika di klik antrian".
   * Ditelusuri, sebabnya dua dan keduanya harus diperbaiki - memperbaiki satu
   * saja menyisakan terpotong yang persis sama di keadaan yang lain.
   *
   *   1. LEBAR. Baris rincian adalah satu sel di dalam tabel selebar 980px,
   *      dan tabel itu duduk di dalam kotak bergulir mendatar. Di layar yang
   *      lebih sempit, isinya melebar mengikuti TABELNYA, bukan mengikuti apa
   *      yang terlihat - sehingga separuh rinciannya berada di luar layar dan
   *      hanya dapat dibaca dengan menggulung ke samping.
   *
   *      Perbaikannya: pembungkus rincian dipaku `sticky left-0` dan diberi
   *      lebar SEBESAR YANG TERLIHAT. Ia lalu tinggal diam saat tabelnya
   *      digulung ke samping, dan tidak pernah ada bagian yang keluar layar.
   *
   *   2. TINGGI. (Sudah tidak berlaku sejak 28 September 2026 - batas
   *      tingginya dibuang seluruhnya; catatan ini disimpan sebagai riwayat.)
   *      Dari lg ke atas kotaknya dibatasi 70vh. Rincian sidang jauh
   *      lebih tinggi daripada itu, sehingga membukanya melahirkan gulir
   *      bersarang: halaman menggulung, dan di dalamnya kotak menggulung
   *      sendiri. Pembatasan itu dilepas selama ada rincian yang terbuka -
   *      gunanya (kepala kolom menempel pada daftar panjang) memang hanya
   *      berlaku ketika yang dibaca daftarnya, bukan rinciannya.
   */
  const kotakTabel = useRef<HTMLDivElement | null>(null);
  const [lebarTampak, setLebarTampak] = useState(0);
  /**
   * Tabelnya MUAT di kotaknya - diukur, bukan ditebak dari lebar layar.
   *
   * Selama muat, kotaknya overflow-visible: tidak ada gulir samping yang
   * perlu disediakan, dan kepala kolom (sticky top-0) menempel di puncak
   * LAYAR saat halaman digulung - kotak yang overflow-x-auto menangkap sticky
   * itu dan kepalanya ikut tergulung pergi. Begitu tidak muat - layar sempit,
   * atau kedua sidebar terbuka pada 1280 px - kotaknya kembali overflow-x-auto:
   * isi yang lebih lebar menggulir di dalam kartu, tidak meluber keluar dari
   * kartunya. Bawaannya TIDAK muat, supaya gambar pertama sebelum diukur
   * tidak pernah meluber.
   */
  const [tabelMuat, setTabelMuat] = useState(false);

  /**
   * Jabatan pengguna yang sedang membuka - untuk keterangan di kepala kartu.
   *
   * Dibaca dari daftar jabatan portal, bukan dari peran: peran menentukan apa
   * yang boleh dibuka, jabatan menyebut kedudukannya di kantor. Yang dipajang
   * di sini jabatannya, sebab itulah yang dikenali orang lain.
   */
  const jabatanSaya = useMemo(() => {
    const id = String(currentUser?.positionId ?? "");
    if (!id) return "";
    return String(positions.find((j) => String(j.id) === id)?.name ?? "");
  }, [currentUser?.positionId, positions]);

  useEffect(() => {
    const kotak = kotakTabel.current;
    if (!kotak || typeof ResizeObserver === "undefined") return;
    const ukur = () => {
      setLebarTampak(kotak.clientWidth);
      const tabel = kotak.querySelector("table");
      // Kotak selebar nol (belum tergambar, tab tersembunyi) bukan "muat".
      setTabelMuat(
        tabel !== null && kotak.clientWidth > 0 && tabel.getBoundingClientRect().width <= kotak.clientWidth + 0.5
      );
    };
    ukur();
    const pengamat = new ResizeObserver(ukur);
    pengamat.observe(kotak);
    // Tabelnya diamati juga: baris baru yang lebih lebar mengubah lebar
    // tabel tanpa mengubah lebar kotaknya.
    const tabel = kotak.querySelector("table");
    if (tabel) pengamat.observe(tabel);
    return () => pengamat.disconnect();
  }, []);

  /**
   * Ringkas atau lengkap. Bawaannya LENGKAP - tampilan yang sudah ada -
   * supaya tidak ada yang kehilangan kolom yang biasa dipakainya tanpa
   * memintanya. Pilihannya diingat per peramban, sebab yang memilih ringkas
   * biasanya memakai layar kecil atau menampilkannya ke orang banyak, dan itu
   * keadaan yang tidak berubah tiap kali halaman dibuka.
   */
  const [modeRingkas, setModeRingkas] = useState(false);

  // Dibaca SESUDAH penyandingan, bukan sebagai nilai awal useState: nilai awal
  // yang berbeda antara peladen dan peramban membuat React membuang seluruh
  // pohonnya dan menyusun ulang. Penyetelannya sendiri ditunda satu putaran
  // supaya ia tidak berjalan serentak di dalam badan efek.
  useEffect(() => {
    // Tampilan lewat alamat selalu LENGKAP: kolom Putusan (konseptor,
    // keterangan, checklist) hanya ada di mode itu. Di HP tabelnya menggulir
    // mendatar di dalam kotaknya sendiri (Ringkas diukur lebih buruk: tunda | putus
    // dan kolom kanan malah terpotong).
    if (modeUrl) return;
    let batal = false;
    void Promise.resolve().then(() => {
      if (batal) return;
      try {
        setModeRingkas(window.localStorage.getItem("aleta.jadwal-sidang.ringkas") === "1");
      } catch {
        // Peramban yang memblokir penyimpanan situs tetap dapat memakai layar
        // ini - hanya pilihannya yang tidak diingat.
      }
    });
    return () => {
      batal = true;
    };
  }, [modeUrl]);

  // Disimpan HANYA saat pemakai memilih, bukan lewat efek atas [modeRingkas].
  // Efek penyimpan dahulu berjalan serentak pada pemasangan pertama dan
  // menulis bawaan "0" SEBELUM pembacaan tertunda di atas sempat membaca -
  // simpanannya tertimpa, dan Ringkas selalu kembali ke Lengkap (28 Sep
  // 2026). Polanya sama dengan saklar tampilan di bawah (ubahSaklar).
  const pilihModeRingkas = useCallback((ringkas: boolean) => {
    setModeRingkas(ringkas);
    try {
      window.localStorage.setItem("aleta.jadwal-sidang.ringkas", ringkas ? "1" : "0");
    } catch {
      /* sama seperti di atas - pilihannya tetap berlaku di halaman ini */
    }
  }, []);

  // ==========================================================================
  // SAKLAR TAMPILAN - APA YANG DIGAMBAR, DIPILIH SENDIRI OLEH PEMAKAINYA
  // ==========================================================================
  //
  // Nilai awalnya BAWAAN, bukan hasil pembacaan simpanan - sama sebabnya
  // dengan modeRingkas di atas: peladen tidak punya localStorage, dan nilai
  // awal yang berbeda antara keduanya membuat React membuang pohonnya.
  const [tampilanPilihan, setTampilan] = useState<PilihanTampilan>(() => tampilanBawaan());
  /* === HAK-PERAN 12 Okt === */
  // Saklar BUKAN hak: tombol aksi yang tidak diberikan matriks peran
  // (Tunda/Putus, Mediator, Court Calendar, Kasir, Konseptor, Antrian, ...)
  // dimatikan apa pun pilihan saklarnya; pilihan aslinya tetap tersimpan.
  // Rutenya juga menjawab 403 (pastikanAksi).
  // Tampilan lewat alamat: pilihan TETAP (daftar izin di jadwal-tampil-url),
  // bukan pilihan peramban - yang membuka tautan melihat hal yang sama di
  // mana pun, dan penanda yang pernah dimatikan di Tampilan tidak ikut hilang.
  const tampilan = useMemo(
    () => saringSaklarSidang(modeUrl ? tampilanUrlJadwal() : tampilanPilihan, currentUser),
    [modeUrl, tampilanPilihan, currentUser]
  );
  const bolehJalannya = bolehAksi(currentUser, "sidang.jalannya");
  // Audit hak 23 Okt 2026: keterangan yang sudah berisi tetap terbaca semua, tetapi
  // kotak tulisnya hanya bagi aksi sidang.keterangan (rute keterangan-perkara 403).
  const bolehTulisKeterangan = bolehAksiLayar(currentUser, "sidang.keterangan");
  // 22 Okt 2026: Sidang keliling per tanggal, hakim per perkara, meja panitera
  // sidang (tunda/putus massal), cetak per hakim - hanya untuk SATU tanggal dan
  // bukan di tampilan lewat alamat. Lihat jadwal-keliling-hakim.tsx.
  const satuTanggalJadwal = dari === sampai;
  const kh = useKelilingHakim({ tanggal: dari, nyala: satuTanggalJadwal && !modeUrl && Boolean(currentUser) });
  // 22 Okt 2026 (pengguna): saklar Sidang keliling mati -> hakim per perkara yang
  // tersimpan tidak dipakai di mana pun (nama di kolom Majelis, cetak per hakim).
  // Datanya tetap; menyala lagi = tampil lagi.
  const pilihanHakim: typeof kh.pilihan = kh.kelilingAktif ? kh.pilihan : TANPA_PILIHAN_HAKIM;
  const bolehTundaPutusMassal = bolehAksi(currentUser, "sidang.tunda-putus");
  const [mejaPp, setMejaPp] = useState(false);
  // 22 Okt 2026: butir Menu (Penetapan kembali, Kasir, Kasir harian) memegang
  // dialognya DI SINI, di luar menu - isi menu dilepas begitu menu menutup.
  const bolehPenetapanKembali = useBolehPenetapanKembali();
  const [penetapanKembaliTerbuka, setPenetapanKembaliTerbuka] = useState(false);
  const bolehKasirJurnal = bolehMengerjakanKasir(currentUser);
  const [kasirTerbuka, setKasirTerbuka] = useState(false);
  const kasirHarian = useKasirHarian();
  const [cetakPerHakim, setCetakPerHakim] = useState(false);
  /* === AKHIR HAK-PERAN === */
  /* === 12OKT-B: saklar penanda perkara & pihak, panggil saksi === */
  const aktifPenandaPerkara = tampil(tampilan, "penanda-perkara");
  const aktifPenandaPekerjaan = tampil(tampilan, "penanda-pekerjaan");
  const aktifPanggilSaksi = tampil(tampilan, "panggil-saksi");
  // JADWAL-3 butir 4: nama saksi terlipat bawaan; pilihan per baris diingat per akun.
  const saksiLipat = useSaksiLipat(currentUser?.id, !tampil(tampilan, "saksi-lipat"));
  /* === AKHIR 12OKT-B === */
  /* === 12OKT-H: pihak yang sudah hadir hari ini (hijau + "(hadir)") === */
  const aktifPihakHadir = tampil(tampilan, "pihak-hadir");
  const hadirIni = (b: { perkaraId: string; tanggalSidang: string }) =>
    aktifPihakHadir ? pihakHadirHariIni(antrianUntuk(antrian.peta, b), b.tanggalSidang, hariIni()) : { pihak1: false, pihak2: false };
  /* === AKHIR 12OKT-H === */
  /* === 12OKT-L: penanda pernah diskors (di bawah tombol Selesai) === */
  const aktifPernahDiskors = tampil(tampilan, "pernah-diskors");
  const pernahDiskorsIni = (b: { perkaraId: string; tanggalSidang: string }) =>
    aktifPernahDiskors
      ? penandaPernahDiskors({
          riwayat: tandaSelesai.riwayatSkors,
          aktif: tandaSelesai.skors[kunciSelesai(b.perkaraId, b.tanggalSidang)] ?? null,
          baris: b,
          hariIni: hariIni(),
        })
      : null;
  /* === AKHIR 12OKT-L === */
  const [panelTampilan, setPanelTampilan] = useState(false);

  // Layar penuh berjendela (perbaikan 1 Okt 2026, J4) - Esc keluar.
  const [layarPenuh, setLayarPenuh] = useLayarPenuh();

  // Tanda Selesai - sinkron dua arah dengan antrian sidang (J2). Dibaca
  // ulang tiap daftar sidang dimuat ulang (45 detik), sehingga antrian yang
  // ditandai selesai di aplikasi antrian ikut menghijau di sini.
  const tandaSelesai = useSelesaiSidang(dari, sampai, sidang);

  useEffect(() => {
    if (modeUrl) return;
    let batal = false;
    void Promise.resolve().then(() => {
      if (batal) return;
      try {
        setTampilan(bacaTampilan(window.localStorage.getItem(KUNCI_SIMPANAN_TAMPILAN)));
      } catch {
        /* sama seperti modeRingkas - pilihannya saja yang tidak diingat */
      }
    });
    // Butir 22 (6 Okt 2026): bawaan dari Super Admin (Integrasi e-Court) -
    // berlaku bagi yang belum mengatur sendiri, atau menimpa SEKALI bila
    // "terapkan ulang". Gagal dibaca = pilihan peramban apa adanya.
    void (async () => {
      try {
        const jawab = await fetch(apiPath("/api/aleta-ecourt/sidang/tampilan-bawaan"), { cache: "no-store" });
        if (!jawab.ok || batal) return;
        const luar = (await jawab.json()) as { data?: { berlaku?: BawaanDiterima } };
        const bawaan = luar?.data?.berlaku ?? null;
        if (!bawaan || batal) return;
        const lokal = window.localStorage.getItem(KUNCI_SIMPANAN_TAMPILAN);
        const hasil = pilihanSesudahBawaan(lokal, window.localStorage.getItem(KUNCI_VERSI_BAWAAN), bawaan);
        setTampilan(hasil.pilihan);
        if (hasil.simpanLokal) window.localStorage.setItem(KUNCI_SIMPANAN_TAMPILAN, JSON.stringify(hasil.pilihan));
        if (hasil.versiBaru) window.localStorage.setItem(KUNCI_VERSI_BAWAAN, hasil.versiBaru);
      } catch {
        /* bawaan tidak terbaca: pilihan peramban tetap */
      }
    })();
    return () => {
      batal = true;
    };
  }, [modeUrl]);

  const ubahSaklar = useCallback((kunci: string, menyala: boolean) => {
    setTampilan((lama) => {
      const baru = { ...lama, [kunci]: menyala };
      try {
        window.localStorage.setItem(KUNCI_SIMPANAN_TAMPILAN, JSON.stringify(baru));
      } catch {
        /* pilihannya tetap berlaku sepanjang halaman ini terbuka */
      }
      return baru;
    });
  }, []);

  // "Mode lengkap" (dulu "Nyalakan semua") - perbaikan 1 Okt 2026, J5:
  // semua menyala KECUALI Kolom Siap dan Catatan cara menghitung. Sama
  // dengan keadaan bawaan; lihat tampilanModeLengkap.
  const setelUlangTampilan = useCallback(() => {
    const baru = tampilanModeLengkap();
    setTampilan(baru);
    try {
      window.localStorage.setItem(KUNCI_SIMPANAN_TAMPILAN, JSON.stringify(baru));
    } catch {
      /* sama seperti di atas */
    }
  }, []);

  // "Sembunyikan semua" - diminta pengguna 24 September 2026 ("mode
  // sembunyikan yang lain"). Yang wajib tetap menyala; lihat tampilanSemuaMati.
  const sembunyikanSemuaTampilan = useCallback(() => {
    const baru = tampilanSemuaMati();
    setTampilan(baru);
    try {
      window.localStorage.setItem(KUNCI_SIMPANAN_TAMPILAN, JSON.stringify(baru));
    } catch {
      /* sama seperti di atas */
    }
  }, []);

  // Mode yang sedang berlaku DIBACA dari centangnya (J5) - begitu satu
  // centang diubah tangan, tombol mode tidak lagi menyala ("suai").
  const modeTampilan = useMemo(() => modeTampilanAktif(tampilan), [tampilan]);

  const dimatikan = useMemo(() => jumlahDimatikan(tampilan), [tampilan]);

  // 22 Okt 2026 (W57): saklar yang mematikan tombolnya juga melepas saringannya -
  // isian yang tersembunyi tidak boleh diam-diam menyempitkan daftar.
  const cariLanjutBerlaku = tampil(tampilan, "pencarian-lanjutan") && cariLanjut.jumlahAktif > 0;
  const perkaraSayaAktif = hanyaMilikSaya && tampil(tampilan, "tombol-perkara-saya");
  const adaSaringan =
    Boolean(alurTerpilih) ||
    keadaanTerpilih.length > 0 ||
    Boolean(cariCepat) ||
    Boolean(cari) ||
    cariLanjutBerlaku ||
    Boolean(saringJenis) ||
    Boolean(saringTahap) ||
    Boolean(saringMajelis) ||
    Boolean(saringRuang);

  /**
   * Berapa kolom yang benar-benar digambar - dipakai seluruh colSpan.
   *
   * Angkanya dahulu ditulis 8 di lima tempat, dan itu aman selama tidak ada
   * satu pun kolom yang dapat hilang: saklar lain menyembunyikan lewat KELAS
   * (kolom-lengkap / hanya-ringkas), dan sel yang bergaya tersembunyi tetap
   * terhitung sebagai sel.
   *
   * Kolom "Siap" berbeda: kepala dan selnya benar-benar tidak digambar ketika
   * skor kesiapan dimatikan - sebab kolom berkepala yang isinya selalu kosong
   * memakan lebar tanpa menjawab apa pun. Begitu satu kolom sungguh hilang,
   * colSpan yang tetap 8 membentang satu kolom lebih jauh daripada tabelnya.
   */
  const kolomTabel = tampil(tampilan, "kolom-siap") ? 8 : 7;

  // ==========================================================================
  // DAFTAR HAKIM AKTIF - DIBACA SEKALI, BUKAN TIAP TANGGAL DIGANTI
  // ==========================================================================
  //
  // Isinya lima nama dan hampir tidak pernah berubah; menariknya ulang tiap
  // kali tanggalnya diganti berarti satu pembacaan SIPP untuk daftar yang
  // sama persis.
  //
  // Gagalnya TIDAK menghentikan apa pun: kotak isian konseptor tetap menerima
  // nama apa pun yang diketik. Sebabnya disimpan supaya borangnya dapat
  // mengatakan mengapa daftarnya tidak muncul - diam pada keadaan itu membuat
  // orang menyangka namanya memang tidak ada di SIPP.
  const [hakim, setHakim] = useState<{ daftar: Hakim[]; alasan: string }>({
    daftar: [],
    alasan: "",
  });

  useEffect(() => {
    let batal = false;
    void (async () => {
      try {
        const jawaban = await fetch(apiPath("/api/aleta-ecourt/hakim"), { cache: "no-store" });
        const isi = (await jawaban.json()) as {
          data?: { hakim?: Hakim[]; alasan?: string };
        };
        if (batal) return;
        setHakim({
          daftar: Array.isArray(isi?.data?.hakim) ? isi.data.hakim : [],
          alasan: String(isi?.data?.alasan ?? ""),
        });
      } catch (galat) {
        if (batal) return;
        setHakim({
          daftar: [],
          alasan: galat instanceof Error ? galat.message : "Daftar hakim tidak terbaca.",
        });
      }
    })();
    return () => {
      batal = true;
    };
  }, []);

  // --- pendaftaran jadwal ke aplikasi antrian --------------------------------
  const [sinkronSibuk, setSinkronSibuk] = useState(false);
  const [sinkronHasil, setSinkronHasil] = useState<{
    ujiKering: boolean;
    alasan?: string;
    ditambahkan: number;
    akanDitambah: Array<{ nomorPerkara: string }>;
    dilewati: Array<{ nomorPerkara: string; sebab: string }>;
    gagal: Array<{ nomorPerkara: string; sebab: string }>;
  } | null>(null);
  // Butir 3 (5 Okt 2026): hasil BERHASIL ("N perkara didaftarkan", atau
  // pemeriksaan tanpa apa pun yang perlu didaftarkan) hilang sendiri. Yang
  // gagal sebagian/seluruhnya, dan pratinjau yang masih menunggu "Daftarkan
  // sekarang", menetap.
  const sinkronBerhasil = Boolean(
    sinkronHasil &&
      !sinkronHasil.alasan &&
      sinkronHasil.gagal.length === 0 &&
      (!sinkronHasil.ujiKering || sinkronHasil.akanDitambah.length === 0)
  );
  useHilangSendiri(sinkronHasil, sinkronBerhasil, () => setSinkronHasil(null));

  const jalankanSinkron = useCallback(
    async (terapkan: boolean) => {
      setSinkronSibuk(true);
      try {
        const respons = await fetch(apiPath("/api/aleta-ecourt/antrian"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tanggal: dari, terapkan }),
        });
        const isi = (await respons.json()) as { data?: Record<string, unknown> };
        const hasil = (isi.data ?? isi) as Record<string, unknown>;
        setSinkronHasil({
          ujiKering: hasil.ujiKering === true,
          alasan: typeof hasil.alasan === "string" ? hasil.alasan : "",
          ditambahkan: Number(hasil.ditambahkan) || 0,
          akanDitambah: Array.isArray(hasil.akanDitambah)
            ? (hasil.akanDitambah as Array<{ nomorPerkara: string }>)
            : [],
          dilewati: Array.isArray(hasil.dilewati)
            ? (hasil.dilewati as Array<{ nomorPerkara: string; sebab: string }>)
            : [],
          gagal: Array.isArray(hasil.gagal)
            ? (hasil.gagal as Array<{ nomorPerkara: string; sebab: string }>)
            : [],
        });
      } catch (error) {
        setSinkronHasil({
          ujiKering: true,
          alasan: error instanceof Error ? error.message : String(error),
          ditambahkan: 0,
          akanDitambah: [],
          dilewati: [],
          gagal: [],
        });
      } finally {
        setSinkronSibuk(false);
      }
    },
    [dari]
  );

  const periksaSinkron = useCallback(() => jalankanSinkron(false), [jalankanSinkron]);
  const [rincian, setRincian] = useState<Rincian | null>(null);
  const [memuatRincian, setMemuatRincian] = useState(false);

  // ==========================================================================
  // KOTAK ALUR MENYARING TABELNYA JUGA - BUKAN HANYA RINGKASANNYA
  // ==========================================================================
  //
  // Dulu tidak: menekan "Gugatan" hanya membuka panel ringkasan, dan tabel di
  // bawahnya tetap memuat seluruh sidang hari itu. Alasannya angka pada
  // ringkasan tidak lagi cocok dengan isi tabel bila keduanya bergerak.
  //
  // Yang terjadi di layar justru sebaliknya. Kotaknya berbentuk sama dengan
  // kotak keadaan yang berjejer di sebelahnya - dan yang itu memang menyaring
  // tabel. Dua kotak yang serupa dengan akibat yang berbeda terbaca sebagai
  // kotak yang rusak, bukan sebagai kotak yang bekerja lain.
  //
  // Sekarang keduanya menyaring, dan kecocokan angkanya dijaga dari arah lain:
  // jumlah pada kotak KEADAAN dihitung di dalam alur yang sedang dipilih
  // (lihat jumlahKeadaan), sementara jumlah pada kotak ALUR tetap dihitung
  // dari seluruh sidang hari itu - kalau ikut menyusut, alur lain menjadi nol
  // dan pilihannya mustahil dilepas kembali.
  const sidangSealur = useMemo(
    () =>
      alurTerpilih
        ? sidang.filter((baris) => kelompokAlur(baris.alurPerkaraId) === alurTerpilih)
        : sidang,
    [sidang, alurTerpilih]
  );

  // Daftar yang sedang disorot panel ringkasan. Kosong saat tidak ada alur
  // yang dipilih - panelnya pun tidak digambar saat itu.
  const sidangTerpilih = alurTerpilih ? sidangSealur : [];
  // Baris kartu dihitung dari SELURUH kelompok, bukan dari yang sudah
  // tersaring: angka pada kartu harus tetap menyebut isi kelompoknya, supaya
  // menyaring ke satu majelis tidak membuat majelis lain lenyap dari kartu
  // dan penyaringnya mustahil dilepas kembali.
  const rincianJenis = rincianMenurut(sidangTerpilih, (x) => x.jenisPerkara || "Tanpa jenis");
  const rincianMajelis = rincianMenurut(sidangTerpilih, (x) => x.majelisKode || "Belum ditetapkan");
  const rincianRuang = rincianMenurut(sidangTerpilih, (x) => x.ruangan || "Belum ditentukan");
  const rincianTahap: BarisRincian[] = [
    {
      nama: "Sidang pertama",
      jumlah: sidangTerpilih.filter((x) => x.urutanSidang <= 1).length,
      cocok: (x) => x.urutanSidang <= 1,
    },
    {
      nama: "Sidang lanjutan",
      jumlah: sidangTerpilih.filter((x) => x.urutanSidang > 1).length,
      cocok: (x) => x.urutanSidang > 1,
    },
    {
      // Bertindihan dengan kedua baris di atas - sidang putusan tetap sidang
      // lanjutan. Disebut terpisah karena inilah yang berpeluang selesai hari
      // ini, dan itu pertanyaan tersendiri.
      nama: "Agenda putusan",
      jumlah: sidangTerpilih.filter((x) => /putus/i.test(x.agenda || "")).length,
      cocok: (x) => /putus/i.test(x.agenda || ""),
    },
  ];

  const cocokSaringan = (baris: SidangBaris) =>
    (!saringJenis || rincianJenis.some((x) => x.nama === saringJenis && x.cocok(baris))) &&
    (!saringTahap || rincianTahap.some((x) => x.nama === saringTahap && x.cocok(baris))) &&
    (!saringMajelis || rincianMajelis.some((x) => x.nama === saringMajelis && x.cocok(baris))) &&
    (!saringRuang || rincianRuang.some((x) => x.nama === saringRuang && x.cocok(baris)));

  // HANYA keempat penyaring kartu - bukan seluruh saringan. Dinamai begitu
  // supaya tidak tertukar dengan adaSaringan di atas, yang mencakup semuanya:
  // dua nama yang sama dengan arti berbeda pada satu berkas adalah cara
  // tercepat membuat panel keterangan menyebut saringan yang tidak berlaku.
  const adaSaringanKartu = Boolean(saringJenis || saringTahap || saringMajelis || saringRuang);
  const sidangTersaring = adaSaringanKartu ? sidangTerpilih.filter(cocokSaringan) : sidangTerpilih;

  // ==========================================================================
  // DAFTAR YANG DIGAMBAR TABEL
  // ==========================================================================
  //
  // Urutannya: saring keadaan, lalu cari cepat, lalu pencarian lanjutan, baru
  // diurutkan. Mengurutkan lebih dulu hanya membuang tenaga atas baris yang
  // kemudian dibuang.
  //
  // Angka pada kotak keadaan dihitung dari seluruh sidang DI DALAM ALUR yang
  // sedang dipilih - bukan dari yang sudah tersaring keadaan lain. Kalau ikut
  // menyusut oleh keadaan, menyalakan satu saringan akan membuat saringan lain
  // tampak nol dan mustahil dilepas kembali.
  //
  // Alur ikut membatasi karena tabelnya pun dibatasi olehnya: kotak bertuliskan
  // "2 Sudah putus" di atas tabel yang hanya memuat gugatan harus menyebut dua
  // gugatan, bukan dua perkara dari seluruh hari itu.
  const jumlahKeadaan = useMemo(() => {
    const hitung: Record<string, number> = {};
    for (const keadaan of KEADAAN_SIDANG) {
      hitung[keadaan.kunci] = sidangSealur.filter((baris) =>
        keadaan.cocok(baris, antrian.peta, saat)
      ).length;
    }
    // Bagian angka "Perlu diperiksa" yang datang dari aturan pukul 15:00.
    // Bukan kotak sendiri - hanya disebut pada judul kotak gabungan. Dihitung
    // di sini, dari fungsi yang sama dengan cocok() kotaknya, supaya tidak
    // lahir hitungan kedua yang suatu hari berbeda.
    hitung[KUNCI_BELUM_TUNDA_LEWAT_BATAS] = sidangSealur.filter((baris) =>
      belumTundaLewatBatas(baris, saat)
    ).length;
    return hitung;
  }, [sidangSealur, antrian.peta, saat]);

  // Kalimat berjam pada judul kotak "Perlu diperiksa". Angkanya dapat naik
  // mendadak pukul 15:00 tanpa satu perkara pun berubah; tanpa kalimat ini
  // kenaikan itu terbaca sebagai perkara baru yang bermasalah.
  const jumlahLewatBatas = jumlahKeadaan[KUNCI_BELUM_TUNDA_LEWAT_BATAS] ?? 0;
  const pukulBatas = JAM_BATAS_HASIL_SIDANG.slice(0, 5);
  const keteranganBatasJam = saat.lewatBatas
    ? `Sudah lewat pukul ${pukulBatas} WITA: ${jumlahLewatBatas} sidang ikut karena hasil sidangnya belum dicatat - lihat tanda merah "Belum ditunda" pada barisnya.`
    : `Belum pukul ${pukulBatas} WITA: sidang hari ini yang belum ditunda belum ikut dihitung${
        jumlahLewatBatas > 0
          ? `; ${jumlahLewatBatas} sidang tanggal lampau yang hasilnya belum dicatat sudah ikut`
          : ""
      }.`;

  const sidangTersusun = useMemo(() => {
    // Alur perkara lebih dulu: ia yang paling banyak memotong, dan saringan
    // sesudahnya jadi bekerja atas baris yang lebih sedikit.
    let hasil = sidangSealur;

    if (keadaanTerpilih.length > 0) {
      const dipilih = KEADAAN_SIDANG.filter((x) => keadaanTerpilih.includes(x.kunci));
      // "Atau", bukan "dan": menyalakan retur dan ditunda sekaligus berarti
      // "tunjukkan yang bermasalah". Menggabungnya dengan "dan" hampir selalu
      // menghasilkan daftar kosong, dan itu terbaca sebagai fitur yang rusak.
      hasil = hasil.filter((baris) =>
        dipilih.some((keadaan) => keadaan.cocok(baris, antrian.peta, saat))
      );
    }

    // Kotak cari (cariCepat) TIDAK lagi menyaring di sini: sejak pencarian
    // pintar (JADWAL-3 butir 1) ia membaca keadaan antrian dan ruang sidang
    // yang baru dihitung di bawah - lihat sidangTampil.

    if (cariLanjutBerlaku) {
      hasil = hasil.filter((baris) =>
        cocokCariLanjutSidang(baris, cariLanjut.isian, antrian.peta)
      );
    }

    // ========================================================================
    // URUTAN BAWAAN: NOMOR ANTRIAN, DARI YANG PERTAMA
    // ========================================================================
    //
    // Diminta pengguna 23 September 2026: "antrian paling pertama paling atas,
    // selanjutnya mengikuti sesuai sekarang".
    //
    // Sebabnya dapat dilihat di ruang sidang: yang dipanggil berikutnya adalah
    // nomor antrian terkecil yang belum dipanggil, bukan yang jam sidangnya
    // paling awal - sebab jam sidang hampir seluruhnya tertulis sama. Daftar
    // yang urutannya berbeda dari urutan panggilan menuntut mata mencari,
    // padahal yang dicari selalu baris teratas.
    //
    // Yang BELUM mengambil nomor turun ke bawah, dan urutan di antara mereka
    // TIDAK diacak - tetap seperti yang datang dari bot (tanggal, lalu jam).
    // Itulah "selanjutnya mengikuti sesuai sekarang".
    //
    // Hanya berlaku ketika tidak ada kepala kolom yang ditekan. Begitu orang
    // memilih urutan sendiri, pilihannya menang.
    if (!urutTabel) {
      const nomorAntrian = (baris: SidangBaris) => {
        const punya = antrianUntuk(antrian.peta, baris);
        const n = Number(punya?.nomor);
        // Number.MAX_SAFE_INTEGER, bukan 0: yang belum bernomor harus jatuh ke
        // BAWAH, dan nol akan melemparkannya ke puncak daftar.
        return Number.isFinite(n) && n > 0 ? n : Number.MAX_SAFE_INTEGER;
      };
      // Urutan asalnya dipertahankan bagi yang bernomor sama maupun yang
      // sama-sama belum bernomor - Array.prototype.sort dijamin stabil sejak
      // ES2019, jadi indeks cadangan tidak diperlukan.
      return [...hasil].sort((a, b) => nomorAntrian(a) - nomorAntrian(b));
    }

    return urutkan(hasil, urutTabel, (baris, kunci) =>
      nilaiUrutSidang(baris, kunci, kesiapan, antrian.peta)
    );
  }, [
    sidangSealur,
    keadaanTerpilih,
    cariLanjut.isian,
    cariLanjutBerlaku,
    urutTabel,
    kesiapan,
    antrian.peta,
    saat,
  ]);

  // ==========================================================================
  // KEEMPAT PENYARING KARTU IKUT SAMPAI KE TABEL
  // ==========================================================================
  //
  // Sejalan dengan kotak alur di atas. Keempatnya - jenis, tahap, majelis,
  // ruang - berdiri di dalam panel yang baru terbuka SESUDAH satu alur
  // dipilih, dan alur itu kini menyaring tabelnya. Membiarkan keempat kartu
  // hanya menyaring kartu di dalam panel akan mengulang persis kekeliruan yang
  // baru saja diperbaiki: satu deret kotak yang menyaring, satu deret lagi
  // yang tampaknya menyaring tetapi tidak menyentuh tabel.
  //
  // Dikerjakan DI LUAR useMemo di atas, bukan di dalamnya. cocokSaringan
  // dibangun ulang tiap render - ia bergantung pada rincianJenis dan
  // kawan-kawannya yang juga dibangun ulang - sehingga memasukkannya ke dalam
  // daftar kebergantungan useMemo berarti memo yang tidak pernah dipakai.
  // Penyaringnya sendiri satu lintasan atas paling banyak 500 baris.
  const sidangSetelahKartu = adaSaringanKartu
    ? sidangTersusun.filter(cocokSaringan)
    : sidangTersusun;

  /**
   * ==========================================================================
   * "PERKARA SAYA" DISARING PALING AKHIR
   * ==========================================================================
   *
   * Sesudah seluruh saringan lain, bukan sebelumnya. Urutan ini menentukan apa
   * arti keterangan "tidak ada perkara Anda hari ini": disaring lebih dahulu,
   * kalimat itu akan muncul juga ketika yang mengosongkan daftar sebenarnya
   * saringan Retur atau pencarian nomor - dan orangnya akan menyimpulkan ia
   * tidak bersidang hari itu.
   */
  const milikSaya = saringPerkaraSendiri(
    sidangSetelahKartu,
    currentUser
      ? {
          nama: currentUser.name,
          peran: String(currentUser.roleId || ""),
          // Peran TAMBAHAN ikut - operator/penjaga sidang tidak pernah menjadi
          // peran utama. Lihat catatan pada peranLihatSemua.
          peranTambahan: currentUser.additionalRoleIds ?? [],
        }
      : null,
    perkaraSayaAktif
  );
  // Butir 5 (6 Okt 2026): saringan ruang sidang - PALING akhir, sesudah
  // "Perkara saya", dan hanya bila saklarnya menyala. Lihat @/lib/ruang-sidang-saring.
  const ruangAktif = useMemo(() => daftarRuangAktif(sidang), [sidang]);
  // 12OKT-C: kartu ruang memakai saringan yang SAMA - menekan kartu saat tombol
  // ruangnya dimatikan tetap harus menyaring, jadi salah satu saklar cukup.
  const ruangSaring =
    modeUrl || tampil(tampilan, "saring-ruang") || tampil(tampilan, "kartu-ruang")
      ? ruangPilihanBerlaku(ruangDipilih ?? (ruangAlamat ? cocokkanRuang(ruangAlamat, ruangAktif) : null), ruangAktif)
      : null;
  // Tampilan lewat alamat: alamat di bilah peramban ikut tanggal dan saringan
  // yang sedang dilihat, supaya muat-ulang dan salinannya tetap sama. Tanggal
  // hanya ditulis bila diminta di alamat atau bukan hari ini - tautan tanpa
  // tanggal selalu berarti "hari ini".
  const ruangUntukAlamat = ruangDipilih !== null ? ruangDipilih : ruangAlamat;
  useEffect(() => {
    if (!modeUrl || typeof window === "undefined") return;
    const pencarian = susunPencarianJadwal({
      tanggal: dari === hariIni() && !awal?.tanggal ? "" : dari,
      ruang: ruangUntukAlamat,
      majelis: awal?.majelis ?? "",
    });
    if (pencarian === window.location.search) return;
    try {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${pencarian}${window.location.hash}`);
    } catch {
      /* alamat tidak dapat diperbarui - tampilannya tetap benar */
    }
  }, [modeUrl, dari, ruangUntukAlamat, awal?.majelis, awal?.tanggal]);
  /* === 12OKT-C: kartu ruang sidang (butir 3) ===
     "Perlu diperiksa" per ruang = predikat kotak gabungan "Perlu diperiksa"
     milik layar ini (KEADAAN_PERLU_DIPERIKSA) - bukan aturan kedua. Dihitung
     dari SELURUH sidang pada rentang, bukan yang sudah tersaring. */
  const kartuRuang = useMemo(
    () =>
      susunKartuRuang(sidang, (baris) =>
        KEADAAN_PERLU_DIPERIKSA.some((keadaan) => keadaan.cocok(baris, antrian.peta, saat))
      ),
    [sidang, antrian.peta, saat]
  );
  const keteranganPerluKartu = keteranganPerluDiperiksa(
    KEADAAN_MENUNTUT_TINDAKAN.map((x) => x.label),
    JAM_BATAS_HASIL_SIDANG.slice(0, 5)
  );
  /* === AKHIR 12OKT-C === */
  // Tampilan lewat alamat: ?majelis= menyaring ke satu majelis (kode, huruf besar/kecil tak dibedakan).
  const majelisAlamat = modeUrl ? (awal?.majelis ?? "").trim().toLowerCase() : "";
  const sidangSesudahRuang = saringKeRuang(milikSaya.baris, ruangSaring).filter(
    (b) => !majelisAlamat || String(b.majelisKode || "").trim().toLowerCase() === majelisAlamat
  );
  // Butir 8 (6 Okt 2026): "Ciutkan perkara yang sudah selesai" - bawaannya mati.
  // Selesai = tanda hijau yang sama dengan kolom Putusan (selesaiPerKunciWaktu).
  const petaSelesaiCiut = useMemo(
    () => selesaiPerKunciWaktu(sidang, tandaSelesai.peta),
    [sidang, tandaSelesai.peta]
  );
  const ciutkanSelesai = tampil(tampilan, "ciutkan-selesai");
  const sidangTampilDasar = ciutkanSelesai
    ? sidangSesudahRuang.filter((b) => !petaSelesaiCiut[kunciWaktu(b.tanggalSidang, b.perkaraId)])
    : sidangSesudahRuang;
  const jumlahDiciutkan = sidangSesudahRuang.length - sidangTampilDasar.length;

  /**
   * ==========================================================================
   * TIGA JARAK WAKTU - DIHITUNG SEKALI, ATAS SELURUH PERKARA HARI ITU
   * ==========================================================================
   *
   * Diminta pengguna 27 September 2026, menggantikan lencana "+X"/"→Y" (lihat
   * catatan di tempat JarakAntarSidang dulu berdiri).
   *
   * Dihitung atas waktuAntrian - SELURUH perkara pada tanggal yang dibuka,
   * dikirim bot apa adanya - bukan atas sidangTampil. Keluhan 23 September
   * 2026 ("→35" dan "+4" yang tampak bertengkar) lahir dari tetangga yang
   * sedang tersaring; angka yang berubah karena tabelnya disaring bukan angka
   * tentang sidang. Tetangga yang tidak tampil tetap disebut di title.
   *
   * SEKALI untuk seluruh tabel, bukan di tiap baris: baris yang mencari
   * tetangganya sendiri menyapu seluruh daftar untuk tiap baris.
   *
   * Tidak bergantung pada jam: yang berjalan hanya membawa waktu mulainya,
   * dan detiknya dihitung komponen kecil yang berdetak sendiri - tabel ini
   * tidak dilukis ulang tiap detik.
   */
  const bahanTigaJarak = useMemo(() => {
    const selesai: Record<string, boolean> = {};
    const ruangSipp: Record<string, string> = {};
    const nomorPerkara: Record<string, string> = {};
    for (const b of sidang) {
      const k = kunciWaktu(b.tanggalSidang, b.perkaraId);
      // Perkara TERAKHIR di ruangnya yang hasil sidangnya sudah dicatat tidak
      // lagi "berjalan" - lihat hitungTigaJarak.
      selesai[k] = sidangSelesaiHariIni(b);
      ruangSipp[k] = b.ruangan;
      nomorPerkara[k] = b.nomorPerkara;
    }
    return { selesai, ruangSipp, nomorPerkara };
  }, [sidang]);

  const tigaJarak = useMemo(
    () =>
      hitungTigaJarak(waktuAntrian.baris, {
        hariIni: waktuAntrian.hariIni,
        selesai: bahanTigaJarak.selesai,
        ruangSipp: bahanTigaJarak.ruangSipp,
      }),
    [waktuAntrian, bahanTigaJarak]
  );

  /**
   * ==========================================================================
   * SIDANG YANG SEDANG BERJALAN + SKORS (perbaikan 2 Okt 2026, butir 10)
   * ==========================================================================
   *
   * Per ruang, perkara TERAKHIR yang dipanggil hari ini dan belum selesai -
   * bahan yang sama dengan "lama sidang berjalan" di atas, ditambah tanda
   * Selesai (J2) dan skors. Lihat @/lib/jadwal-sidang-2okt.
   */
  // 6 Okt 2026: keadaan disidang hari ini ditanyakan tiap 5 detik dan
  // ditimpakan ke bahan di bawah - "sedang berjalan" tidak lagi menunggu muat
  // ulang jadwal 45 detik. Lihat @/lib/disidang-langsung.
  const disidangLangsung = useDisidangLangsung(dari === sampai && dari === hariIni());
  const waktuAntrianHidup = useMemo(() => terapkanDisidangLangsung(waktuAntrian, disidangLangsung), [waktuAntrian, disidangLangsung]);
  const berjalanHidup = useMemo(() => saringProsesLangsung(tandaSelesai.berjalan, disidangLangsung), [tandaSelesai.berjalan, disidangLangsung]);
  const ruangSidang = useMemo(() => {
    const ruangSipp: Record<string, string> = {};
    for (const b of sidang) ruangSipp[kunciWaktu(b.tanggalSidang, b.perkaraId)] = b.ruangan;
    return petaSidangBerjalan(waktuAntrianHidup.baris, {
      hariIni: waktuAntrianHidup.hariIni,
      selesai: selesaiPerKunciWaktu(sidang, tandaSelesai.peta),
      skors: tandaSelesai.skors,
      ruangSipp,
      // 2 Okt 2026 malam: tanda "Tandai sedang berjalan" + proses sidang di
      // mesin antrian (disidang = nomor ruang; bawaan bot sejak 5 Okt 2026, dan
      // juga terbaca dari `disidang` baris waktu antrian hari ini).
      berjalan: berjalanHidup,
    });
  }, [sidang, waktuAntrianHidup, tandaSelesai.peta, tandaSelesai.skors, berjalanHidup]);

  /** Perkara yang sedang diskors - disebut satu per satu di ringkasan ruang sidang. */
  const diskorsHariIni = useMemo(
    () => daftarDiskors(sidang, tandaSelesai.skors, ruangSidang, selesaiPerKunciWaktu(sidang, tandaSelesai.peta)),
    [sidang, tandaSelesai.skors, tandaSelesai.peta, ruangSidang]
  );

  /** JADWAL-3 butir 3: pil per ruang - kartu ruang + yang sedang disidang. */
  const pitaRuang = useMemo(
    () =>
      susunPitaRuang({
        kartu: kartuRuang,
        perRuang: ruangSidang.perRuang,
        ruangSipp: bahanTigaJarak.ruangSipp,
        nomorPerkara: bahanTigaJarak.nomorPerkara,
      }),
    [kartuRuang, ruangSidang, bahanTigaJarak]
  );

  /** Keterangan perkara untuk tombol skors/lompat - nomor perkara, nomor antrian, ruang. */
  const infoRuangSidang = useCallback(
    (perkaraId: string) => {
      const b = sidang.find((x) => String(x.perkaraId) === String(perkaraId));
      const a = b ? antrianUntuk(antrian.peta, b) : undefined;
      return { nomorPerkara: b?.nomorPerkara ?? "", nomorAntrian: a?.nomor ?? null, noRuang: a?.noRuang ?? null };
    },
    [sidang, antrian]
  );

  /** Perkara dapat dipanggil hari ini: punya baris antrian bertanggal hari ini. */
  const bisaDipanggilHariIni = useCallback(
    (b: SidangBaris) =>
      Boolean(waktuAntrian.hariIni) &&
      b.tanggalSidang === waktuAntrian.hariIni &&
      Boolean(antrianUntuk(antrian.peta, b)),
    [waktuAntrian.hariIni, antrian]
  );

  /** Baris waktu menurut kunciWaktu - jumlah panggilan dan nomor rekaman. */
  const barisWaktuPerKunci = useMemo(() => {
    const peta: Record<string, BarisWaktuAntrian> = {};
    for (const b of waktuAntrian.baris) peta[kunciWaktu(b.tanggalSidang, b.perkaraId)] = b;
    return peta;
  }, [waktuAntrian]);

  /**
   * Nilai `disidang` aplikasi antrian hari ini per kunciWaktu, sesudah ditimpa keadaan langsung
   * (tanya tiap 5 detik). Dasar tombol "Pertanyaan saksi": hanya perkara yang SUDAH MASUK
   * pemeriksaan (1..9 sedang disidang, 10 selesai hari itu) yang diberi tombolnya.
   */
  const disidangPerKunci = useMemo(() => {
    const peta: Record<string, number | null | undefined> = {};
    for (const b of waktuAntrianHidup.baris) peta[kunciWaktu(b.tanggalSidang, b.perkaraId)] = b.disidang;
    return peta;
  }, [waktuAntrianHidup]);

  /* === JADWAL-3 butir 1: PENCARIAN PINTAR ===
     Kata kunci keadaan + medan nama, atas baris yang sudah termuat. Predikat
     keadaan memakai aturan kotak keadaan yang SAMA (KEADAAN_SIDANG), supaya
     "belum bas" di kotak cari dan kotak "Belum ada BAS" tidak pernah berbeda. */
  const uraiCari = useMemo(() => uraiCariPintar(cariCepat, KATA_KUNCI_SIDANG, MEDAN_SIDANG), [cariCepat]);
  const opsiCari = useMemo(() => {
    const keadaan = (kunci: string) => {
      const k = KEADAAN_SIDANG.find((x) => x.kunci === kunci);
      return (b: SidangBaris) => (k ? k.cocok(b, antrian.peta, saat) : true);
    };
    const pid = (b: SidangBaris) => String(b.perkaraId);
    const kw = (b: SidangBaris) => kunciWaktu(b.tanggalSidang, b.perkaraId);
    const namaKonseptor = (b: SidangBaris) =>
      [tunjukan[pid(b)]?.nama ?? "", ...(checklistTanpaTunjukan[pid(b)]?.konseptorSipp ?? [])].filter(Boolean).join(" ");
    const berjalan = new Set(Object.values(ruangSidang.perRuang).map((x) => x.kunci));
    const selesai = (b: SidangBaris) => Boolean(petaSelesaiCiut[kw(b)]) || disidangPerKunci[kw(b)] === 10;
    const sedang = (b: SidangBaris) => {
      const d = disidangPerKunci[kw(b)];
      return !selesai(b) && (berjalan.has(kw(b)) || (typeof d === "number" && d >= 1 && d <= 9));
    };
    const diskors = (b: SidangBaris) => !selesai(b) && Boolean(tandaSelesai.skors[kunciSelesai(b.perkaraId, b.tanggalSidang)]);
    const hadir = (b: SidangBaris) => {
      const h = pihakHadirHariIni(antrianUntuk(antrian.peta, b), b.tanggalSidang, hariIni());
      return h.pihak1 || h.pihak2 || [1, 2, 3].includes(Number(b.dihadiriOleh));
    };
    return {
      predikat: {
        "belum-konseptor": (b: SidangBaris) => !namaKonseptor(b),
        "konseptor-sementara": (b: SidangBaris) => Boolean(tunjukan[pid(b)]?.nama),
        konseptor: (b: SidangBaris) => Boolean(namaKonseptor(b)),
        ghaib: (b: SidangBaris) => Boolean(b.penandaPerkara?.ghaib || b.mafqud),
        "potensi-verstek": keadaan("potensi-verstek"),
        verstek: (b: SidangBaris) => Boolean(b.verstekPutusan) || keadaan("potensi-verstek")(b),
        "e-litigasi": keadaan("e-litigasi"),
        "sidang-pertama": keadaan("sidang-pertama"),
        "belum-bas": keadaan("belum-bas"),
        "belum-tunda": keadaan("belum-tunda"),
        "belum-minutasi": keadaan("belum-minutasi"),
        "hari-putusan": keadaan("hari-putusan"),
        "ikrar-talak": keadaan("ikrar-talak"),
        "belum-putus": keadaan("belum-putus"),
        "sudah-putus": keadaan("sudah-putus"),
        ditunda: keadaan("ditunda"),
        kuasa: (b: SidangBaris) => Boolean(b.adaKuasa || b.kuasaPihak1 || b.kuasaPihak2),
        prodeo: (b: SidangBaris) => Boolean(b.penandaPerkara?.prodeo),
        "belum-antri": keadaan("belum-antri"),
        sedang,
        diskors,
        menunggu: (b: SidangBaris) =>
          antrianUntuk(antrian.peta, b)?.keadaan === "menunggu" && !sedang(b) && !selesai(b) && !diskors(b),
        selesai,
        hadir,
        "tidak-hadir": (b: SidangBaris) => !hadir(b),
      },
      nilaiMedan: {
        nomor: (b: SidangBaris) => b.nomorPerkara,
        pihak: (b: SidangBaris) =>
          [...b.pihak.penggugat, ...b.pihak.tergugat, ...(b.pihak.turutTergugat ?? []), ...(b.pihak.intervensi ?? [])].join(" "),
        kuasa: (b: SidangBaris) => (b.pihak.lain ?? []).join(" "),
        saksi: (b: SidangBaris) => [...(b.saksiNamaPihak1 ?? []), ...(b.saksiNamaPihak2 ?? []), ...(b.pihak.saksi ?? [])].join(" "),
        hakim: (b: SidangBaris) => `${b.majelisKode} ${b.majelisNama}`,
        pp: (b: SidangBaris) => b.paniteraNama,
        js: (b: SidangBaris) => b.jurusitaNama,
        mediator: (b: SidangBaris) => b.mediasi?.mediator ?? "",
        konseptor: namaKonseptor,
        jenis: (b: SidangBaris) => [b.jenisPerkara, ...(b.kumulasi?.daftar ?? []).map((x) => x.nama)].join(" "),
        agenda: (b: SidangBaris) => b.agenda,
        ruang: (b: SidangBaris) => b.ruangan,
      },
      teksBebas: (b: SidangBaris) => teksCariSidang(b, namaKonseptor(b)),
    };
  }, [antrian.peta, saat, tunjukan, checklistTanpaTunjukan, ruangSidang, petaSelesaiCiut, disidangPerKunci, tandaSelesai]);
  const sidangTampil = useMemo(
    () => (uraianKosong(uraiCari) ? sidangTampilDasar : sidangTampilDasar.filter((b) => cocokCariPintar(b, uraiCari, opsiCari))),
    [sidangTampilDasar, uraiCari, opsiCari]
  );
  const [fokusCari, setFokusCari] = useState(false);
  /* === AKHIR JADWAL-3 butir 1 === */

  /**
   * Sebutan tetangga untuk title: nomor antriannya DAN nomor perkaranya.
   *
   * Tetangga yang tidak ada di daftar yang dimuat - tersaring di sisi SIPP,
   * atau tidak terjadwal di SIPP tetapi dipanggil di aplikasi antrian - tetap
   * disebut, dengan keterangan bahwa ia tidak tampil. Justru keadaan itulah
   * yang dulu membuat dua angka yang benar terbaca bertengkar.
   */
  const sebutTetangga = useCallback(
    (tetangga: TetanggaJarak, tanggal: string) => {
      const nomorPerkara = bahanTigaJarak.nomorPerkara[kunciWaktu(tanggal, tetangga.perkaraId)];
      const antrianN = typeof tetangga.nomorAntrian === "number" ? `antrian ${tetangga.nomorAntrian}` : "perkara";
      return nomorPerkara
        ? `${antrianN} (${nomorPerkara})`
        : `${antrianN} (perkara yang tidak tampil pada daftar ini)`;
    },
    [bahanTigaJarak]
  );

  /**
   * Melepas SELURUH saringan sekaligus.
   *
   * ==========================================================================
   * SATU TOMBOL, BUKAN DUA YANG CAKUPANNYA BERBEDA
   * ==========================================================================
   *
   * Dulu ada dua: satu di deretan kotak keadaan, satu lagi di baris saringan.
   * Yang kedua - bernama "Bersihkan" - hanya melepas keadaan, kotak saring,
   * dan pencarian lanjutan; alur perkara dan keempat penyaring kartu TETAP
   * menyala. Dua tombol yang sama-sama tampak "membatalkan" tetapi
   * membatalkan hal yang berbeda adalah cara tercepat membuat orang menyangka
   * datanya hilang: ditekan salah satu, daftarnya tetap tersaring.
   *
   * Sekarang satu, dan cakupannya sama dengan adaSaringan yang menyalakannya.
   *
   * Badannya berada DI BAWAH muatTanggal, bukan di sini, karena sejak kotak
   * pencarian disatukan ia juga harus melepas kata kunci yang terlanjur
   * dikirim ke SIPP - dan melepasnya berarti memuat ulang.
   */

  /**
   * Memuat satu rentang, dengan tanggal DIKIRIM sebagai argumen.
   *
   * Tidak membaca dari state, sehingga dapat dipanggil pada putaran yang sama
   * dengan setDari - saat state-nya belum berubah. Tanpa ini, menekan panah
   * berikutnya selalu memuat hari SEBELUMNYA, tertinggal satu langkah.
   *
   * @param pakaiSkor dikirim sebagai argumen, bukan dibaca dari state -
   *   tombol skor memanggilnya pada putaran yang sama dengan setNilaiKesiapan,
   *   dan state React belum berubah saat itu.
   */
  // ==========================================================================
  // BUTIR 14 (5 Okt 2026) - "Failed to fetch" DICOBA LAGI SENDIRI
  // ==========================================================================
  // Gangguan jaringan / 502-504 / jawaban bukan JSON: banner kuning dengan
  // hitung mundur (2, 4, 8, 15, lalu tiap 30 dtk), data lama tetap tampil.
  // Lihat @/lib/coba-lagi-otomatis.
  const muatTanggalRef = useRef<
    ((mulai: string, akhir: string, pakaiSkor?: boolean, cariKini?: string) => Promise<void>) | null
  >(null);
  const permintaanTerakhirRef = useRef<{ mulai: string; akhir: string; pakaiSkor?: boolean; cariKini?: string } | null>(
    null
  );
  /** Rentang yang datanya sedang tampil - data rentang yang sama tidak dikosongkan saat bot tak terjangkau. */
  const rentangTampilRef = useRef("");
  const cobaLagiJadwal = useCobaLagiOtomatis(() => {
    const p = permintaanTerakhirRef.current;
    const muatUlang = muatTanggalRef.current;
    if (p && muatUlang) return muatUlang(p.mulai, p.akhir, p.pakaiSkor, p.cariKini);
    return undefined;
  });
  const { laporGagal: laporGagalJadwal, laporBerhasil: laporBerhasilJadwal } = cobaLagiJadwal;

  const muatTanggal = useCallback(
    async (mulai: string, akhir: string, pakaiSkor?: boolean, cariKini?: string) => {
    // Ditandai lewat ref, bukan state: pemuatan ulang berkala membacanya dari
    // dalam setInterval, dan state yang terbaca di sana adalah state sewaktu
    // interval dipasang - selamanya false.
    memuatRef.current = true;
    // Butir 14 (5 Okt 2026): permintaan terakhir diingat supaya coba-lagi
    // otomatis memuat rentang yang SAMA, bukan rentang di state.
    permintaanTerakhirRef.current = { mulai, akhir, pakaiSkor, cariKini };
    setMemuat(true);
    setGalat("");
    try {
      // Kata kuncinya DIKIRIM sebagai argumen bila ada, sama seperti tanggal
      // dan skor di atas: yang menekan Enter di kotak pencarian memanggil ini
      // pada putaran yang sama dengan setCari, dan state React belum berubah
      // saat itu. Tanpa argumen ini, tekanan pertama selalu mengirim kata
      // kunci SEBELUMNYA - dan yang kedua baru benar.
      const params = new URLSearchParams({ dari: mulai, sampai: akhir, cari: cariKini ?? cari });
      // Penilaian menembakkan beberapa kueri per sidang. Petugas yang hanya
      // ingin melihat jam sidang dapat mematikannya.
      if (pakaiSkor ?? nilaiKesiapan) params.set("kesiapan", "1");
      const jawaban = await fetch(apiPath(`/api/aleta-ecourt/sidang?${params.toString()}`), {
        cache: "no-store",
      });
      // Status diperiksa SEBELUM badan dibaca sebagai JSON: 502/504 proksi dan
      // halaman galat HTML adalah gangguan yang dicoba lagi sendiri.
      const isi = (await bacaJsonAman(jawaban)) as { data?: Record<string, unknown> } & Record<string, unknown>;
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal membaca jadwal sidang."));

      const data = (isi?.data ?? isi) as Record<string, unknown> & {
        available?: boolean;
        message?: unknown;
        sidang?: unknown;
        kesiapan?: unknown;
        antrian?: unknown;
        waktuAntrian?: unknown;
        cermin?: unknown;
      };
      const rentang = `${mulai}|${akhir}`;
      if (!data?.available) {
        const pesanBot = String(data?.message || "ALETA Bot belum dapat dihubungi.");
        // Bot tak terjangkau dari portal biasanya sementara (bot dimulai
        // ulang) - dicoba lagi sendiri. Data rentang yang SAMA yang sudah
        // tampil dibiarkan; rentang lain dikosongkan seperti semula, sebab
        // nomor antrian hari lain yang tertinggal di layar lebih menyesatkan
        // daripada kolom yang kosong.
        if (botTakTerjangkau(pesanBot)) {
          laporGagalJadwal(new GalatJawaban(pesanBot, 503, true), 503, `${pesanBot} ALETA akan mencoba memuat lagi sendiri.`);
        } else {
          // Bot menjawab tetapi tidak dapat membaca (mis. SIPP): merah seperti semula.
          laporBerhasilJadwal();
          setGalat(pesanBot);
        }
        if (rentangTampilRef.current !== rentang) {
          setSidang([]);
          setAntrian({ terbaca: false, alasan: "", tanggal: [], peta: {} });
          setWaktuAntrian(WAKTU_ANTRIAN_KOSONG);
          setPatokanWaktu(null);
          rentangTampilRef.current = "";
        }
        return;
      }
      laporBerhasilJadwal();
      rentangTampilRef.current = rentang;
      setSidang(Array.isArray(data.sidang) ? data.sidang : []);
      setKesiapan((data.kesiapan ?? {}) as Record<string, KesiapanRingkas>);
      setAntrian(
        (data.antrian ?? { terbaca: false, alasan: "", tanggal: [], peta: {} }) as KeadaanAntrian
      );
      const waktu = (data.waktuAntrian ?? WAKTU_ANTRIAN_KOSONG) as WaktuAntrian;
      setWaktuAntrian(waktu);
      setCerminJadwal((data.cermin ?? null) as { diperbaruiPada: string | null } | null);
      // Date.now() di sini hanya menandai KAPAN data diterima; yang berjalan
      // dihitung dari beda Date.now() sesudahnya, tidak dari jam komputernya.
      const sekarangMs = bacaWaktu(waktu.sekarang);
      setPatokanWaktu(sekarangMs === null ? null : { sekarangMs, diterimaMs: Date.now() });
      penyimpanDiperbarui.catatPenuh(Date.now());
    } catch (kesalahan) {
      // Gangguan jaringan: banner kuning + coba lagi sendiri, data lama tetap.
      // Galat lain tetap merah seperti semula.
      if (!laporGagalJadwal(kesalahan)) {
        setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal membaca jadwal sidang.");
      }
    } finally {
      memuatRef.current = false;
      setMemuat(false);
      // Sesudah putaran pertama, penyegaran berikutnya tidak boleh lagi
      // melepas tabelnya dari layar - lihat catatan pada pertamaMuat.
      setPertamaMuat(false);
    }
    },
    [cari, nilaiKesiapan, laporGagalJadwal, laporBerhasilJadwal, penyimpanDiperbarui]
  );
  useEffect(() => {
    muatTanggalRef.current = muatTanggal;
  }, [muatTanggal]);


  /** Perkara mana saja yang sedang tampil - dipakai memuat tunjukannya. */
  const perkaraTampil = useMemo(
    () => [...new Set(sidang.map((b) => String(b.perkaraId || "")).filter(Boolean))].join(","),
    [sidang]
  );

  const muatTunjukan = useCallback(async () => {
    // Daftar kosong: tidak ada yang perlu diminta, dan tidak ada pula yang
    // perlu dikosongkan. Tunjukan lama tidak dapat tampil - tidak ada baris
    // yang mencarinya - dan mengosongkannya di sini berarti menyetel keadaan
    // secara langsung di dalam efek, yang memicu gambar berantai tiap kali
    // tanggalnya diganti ke hari tanpa sidang.
    if (!perkaraTampil) return;
    try {
      const balasan = await fetch(
        apiPath(`/api/aleta-ecourt/konseptor-sementara?perkaraId=${encodeURIComponent(perkaraTampil)}`),
        { cache: "no-store" }
      );
      const isi = (await balasan.json()) as {
        data?: {
          peta?: Record<string, KonseptorSementara>;
          checklist?: Record<string, { kemajuan?: KonseptorSementara["kemajuan"]; konseptorSipp: string[] }>;
        };
      };
      setTunjukan(isi?.data?.peta ?? {});
      setChecklistTanpaTunjukan(isi?.data?.checklist ?? {});
    } catch {
      // Tunjukan yang gagal dimuat menyisakan kolomnya kosong - jadwalnya
      // tetap terbaca. Ia keterangan tambahan, bukan syarat layar ini hidup.
      setTunjukan({});
      setChecklistTanpaTunjukan({});
    }
  }, [perkaraTampil]);

  /**
   * F4.2: draf H-7 yang disiapkan agen ALETA. Gagal dimuat = tanpa lencana;
   * jadwalnya tetap terbaca (idiom yang sama dengan tunjukan konseptor).
   */
  const muatDrafH7 = useCallback(async () => {
    if (!perkaraTampil) return;
    try {
      const balasan = await fetch(
        apiPath(`/api/aleta-ecourt/agen-h7?ringkas=1&perkaraId=${encodeURIComponent(perkaraTampil)}`),
        { cache: "no-store" }
      );
      const isi = (await balasan.json()) as { data?: { peta?: Record<string, RingkasDrafH7> } };
      setDrafH7(isi?.data?.peta ?? {});
    } catch {
      setDrafH7({});
    }
  }, [perkaraTampil]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void muatDrafH7();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [muatDrafH7]);

  /**
   * Keadaan keterangan tiap perkara - hanya yang TERKINI beserta jumlah
   * revisinya. Riwayatnya ditarik saat tombolnya ditekan; lihat sebabnya di
   * SelKeteranganPerkara.
   */
  const muatKeterangan = useCallback(async () => {
    if (!perkaraTampil) return;
    try {
      const balasan = await fetch(
        apiPath(
          `/api/aleta-ecourt/keterangan-perkara?perkaraIds=${encodeURIComponent(perkaraTampil)}`
        ),
        { cache: "no-store" }
      );
      const isi = (await balasan.json()) as {
        data?: { peta?: Record<string, KeteranganPerkara> };
      };
      setKeterangan(isi?.data?.peta ?? {});
    } catch {
      // Sama seperti tunjukan konseptor: keterangan yang gagal dimuat
      // menyisakan tombolnya abu-abu. Jadwalnya tetap terbaca.
      setKeterangan({});
    }
  }, [perkaraTampil]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void muatKeterangan();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [muatKeterangan]);

  /**
   * Ditunda satu putaran, mengikuti idiom yang sudah dipakai berkas ini untuk
   * muatan lain di bawah.
   *
   * Bukan kerapian: memanggilnya langsung di dalam badan efek berarti
   * penyetelan keadaannya terjadi pada putaran yang sama dengan pemasangan
   * daftarnya, dan tabel berisi puluhan baris digambar dua kali berturut-turut
   * tiap kali tanggalnya diganti.
   */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void muatTunjukan();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [muatTunjukan]);

  const muat = useCallback(() => muatTanggal(dari, sampai), [muatTanggal, dari, sampai]);

  /**
   * ==========================================================================
   * SATU KOTAK PENCARIAN, DUA PEKERJAAN - DAN KEDUANYA TERLIHAT
   * ==========================================================================
   *
   * Dulu ada dua kotak: "Cari nomor perkara, jenis, atau agenda" yang dikirim
   * ke SIPP, dan "Saring di dalam hasil" yang menyaring baris yang sudah
   * termuat. Keduanya berbentuk sama, berdampingan di layar yang sama, dan
   * tidak ada pada bentuknya yang memberi tahu mana yang mana. Yang mengetik
   * di kotak yang keliru mendapati daftarnya kosong tanpa satu pun keterangan.
   *
   * Sekarang satu kotak. Mengetik MENYARING seketika apa yang sudah ada -
   * itulah yang diharapkan orang dari kotak pencarian. Menekan Enter
   * MELEBARKAN pencarian ke SIPP dengan kata yang sama, dan itulah satu-
   * satunya cara menjangkau perkara yang belum termuat.
   *
   * Yang terlanjur dikirim ke SIPP disebutkan di bawah kotaknya, beserta
   * tombol melepasnya. Tanpa keterangan itu, kata kunci yang masih berlaku
   * di sisi SIPP tidak terlihat di mana pun - dan daftar yang menyusut
   * karenanya akan disangka jadwal yang memang sepi.
   */
  const kirimCariKeSipp = useCallback(() => {
    if (memuatRef.current) return;
    // JADWAL-3 butir 1: kata kunci keadaan ("ghaib", "belum bas") dan medan
    // ("hakim: ...") tidak dikenal SIPP - yang dikirim hanya sisanya. Tanpa
    // sisa, Enter tidak memuat ulang apa pun kecuali melepas kata SIPP lama.
    const kirim = uraiCariPintar(cariCepat, KATA_KUNCI_SIDANG, MEDAN_SIDANG).sisa;
    if (!kirim && !cari) return;
    setCari(kirim);
    void muatTanggal(dari, sampai, undefined, kirim);
  }, [cariCepat, cari, dari, sampai, muatTanggal]);

  const lepasCariSipp = useCallback(() => {
    setCari("");
    void muatTanggal(dari, sampai, undefined, "");
  }, [dari, sampai, muatTanggal]);

  const resetSemuaSaringan = () => {
    setAlurTerpilih("");
    bersihkanSaringan();
    setKeadaanTerpilih([]);
    setCariCepat("");
    cariLanjut.bersihkan();
    // Kata kunci yang sudah dikirim ke SIPP ikut dilepas - kalau tidak,
    // tombol yang berbunyi "Reset ke 27 perkara" mengembalikan daftar yang
    // masih tersaring di sisi SIPP, dan angkanya tidak pernah tercapai.
    if (cari) lepasCariSipp();
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void muat();
    }, 0);
    return () => window.clearTimeout(timer);
    // Sengaja hanya saat pertama dibuka: penyaringan dijalankan lewat tombol,
    // bukan tiap ketikan - tiap huruf yang diketik akan menembak satu kueri
    // berat ke SIPP.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * ========================================================================
   * HARI INI DIMUAT ULANG SENDIRI - TUNDAAN DAN PUTUSAN DATANG SEPANJANG HARI
   * ========================================================================
   *
   * Panitera sidang mengisi hasil sidang di SIPP sepanjang persidangan
   * berjalan. Layar ALETA yang dibuka pukul sembilan karena itu sudah usang
   * pukul sebelas - dan usangnya tidak kelihatan, sebab layar yang basi
   * tampak persis seperti layar yang benar.
   *
   * Terbukti pada 8 September 2026: perkara 530/Pdt.G/2026 ditandai ditunda
   * di SIPP pukul 11:00:28, sedangkan layar ALETA yang sudah terbuka sejak
   * pagi masih menampilkannya belum ditunda.
   *
   * Tiga batas yang membuatnya tidak menjadi beban:
   *
   *   1. HANYA HARI INI. Tanggal lampau tidak berubah lagi, dan memuat
   *      ulangnya hanya menghabiskan kueri berat ke SIPP tanpa guna.
   *   2. HANYA SAAT TAB TERLIHAT. Layar yang tersembunyi di balik tab lain
   *      tidak dibaca siapa pun. Ini juga yang mencegah sepuluh tab menganggur
   *      memukul SIPP sepanjang hari.
   *   3. TIDAK SAAT SEDANG SIBUK. Pemuatan ulang dilewati bila permintaan
   *      sebelumnya belum selesai, supaya permintaan tidak menumpuk.
   *
   * Barisnya diganti utuh oleh muat(), sehingga rincian yang sedang dibuka
   * ikut memperbarui dirinya - bukan membeku pada isi sewaktu dibuka.
   */
  const sedangHariIni = dari === sampai && dari === hariIni();

  useEffect(() => {
    if (!sedangHariIni) return;

    const putaran = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (memuatRef.current) return;
      void muat();
    }, JEDA_MUAT_ULANG_MS);

    return () => window.clearInterval(putaran);
  }, [sedangHariIni, muat]);

  // ==========================================================================
  // 22 Okt 2026 - PEMBARUAN RINGAN: TUNDA / PUTUS / KEHADIRAN DALAM HITUNGAN DETIK
  // ==========================================================================
  // Jadwal lengkap (~40 kueri, 216-277 ms, 83-96 KB) tiap 45 detik adalah satu-
  // satunya jalur yang membawa tunda/putus yang dibuat petugas di SIPP: terlihat
  // 0-49 detik kemudian. Bacaan ringan (4 kueri berindeks, 10-12 ms, 15 KB)
  // hanya membawa kolom yang berubah, tiap 8 detik hari ini / 30 detik tanggal
  // lain, hanya saat tab terlihat. Lihat @/lib/jadwal-ringan.
  const { segarkan: segarkanRingan } = useJadwalRingan({
    aktif: Boolean(dari) && dari === sampai,
    dari,
    sampai,
    hariIni: sedangHariIni,
    adaPencarian: Boolean(cari.trim()),
    sidang,
    setSidang,
    sibuk: () => memuatRef.current,
    muatPenuh: () => void muat(),
    penyimpan: penyimpanDiperbarui,
  });

  // 6 Okt 2026: perkara yang di-PROSES tetapi belum punya baris waktu antrian
  // (antriannya diambil sesudah jadwal dimuat) - muat penuh SEKALI per perubahan.
  const kurangBarisDisidang = perluMuatPenuh(waktuAntrian, disidangLangsung);
  const kurangDimuatRef = useRef("");
  useEffect(() => {
    if (!kurangBarisDisidang || kurangBarisDisidang === kurangDimuatRef.current || memuatRef.current) return;
    kurangDimuatRef.current = kurangBarisDisidang;
    void muat();
  }, [kurangBarisDisidang, muat]);

  // ==========================================================================
  // BUTIR 30 (5 Okt 2026) - PENANDA VERIFIKASI MAJELIS E-LITIGASI HARI INI
  // ==========================================================================
  // Dibaca dari SIMPANAN bot (penarikannya di latar bot tiap 15 menit, satu
  // perkara per putaran, berhenti bila semua sudah diverifikasi) - bukan
  // tarikan e-Court saat halaman dimuat. Disegarkan bersama jadwalnya.
  const [verifikasi, setVerifikasi] = useState<DataVerifikasi>(DATA_VERIFIKASI_KOSONG);
  // 7 Okt 2026: penanda "belum upload" ditekan -> tarik ulang e-Court HANYA
  // perkara itu; hasilnya menimpa keadaan barisnya saja (tanpa muat ulang).
  const tarikBelumUpload = useTarikBelumUpload(setVerifikasi);
  const adaElitigasiHariIni = useMemo(
    () => sedangHariIni && sidang.some((b) => b.lewatEcourt && /\/Pdt\.G(\.S)?\//i.test(b.nomorPerkara)),
    [sedangHariIni, sidang]
  );
  useEffect(() => {
    if (!adaElitigasiHariIni) return;
    let batal = false;
    const tanggal = dari;
    void (async () => {
      try {
        const jawaban = await fetch(apiPath(`/api/aleta-ecourt/sidang/verifikasi-ecourt?tanggal=${encodeURIComponent(tanggal)}`), {
          cache: "no-store",
        });
        const isi = (await bacaJsonAman(jawaban)) as { data?: Record<string, unknown> } & Record<string, unknown>;
        const data = (isi?.data ?? isi) as Record<string, unknown>;
        if (batal) return;
        if (!jawaban.ok || data?.available === false || data?.ok === false) {
          setVerifikasi({ ...DATA_VERIFIKASI_KOSONG, alasan: String(data?.alasan || data?.message || "layanan ALETA belum tersambung") });
          return;
        }
        setVerifikasi({
          terbaca: true,
          tanggal: String(data.tanggal || tanggal),
          perkara: (data.perkara ?? {}) as DataVerifikasi["perkara"],
          penarik: data.penarik as DataVerifikasi["penarik"],
        });
      } catch (galat) {
        if (!batal) setVerifikasi({ ...DATA_VERIFIKASI_KOSONG, alasan: galat instanceof Error ? galat.message : "tidak terbaca" });
      }
    })();
    return () => {
      batal = true;
    };
  }, [adaElitigasiHariIni, dari, sidang]);

  /**
   * Berpindah ke satu hari, lalu memuatnya seketika.
   *
   * Dimuat langsung, tanpa menunggu tombol Tampilkan: berpindah hari adalah
   * gerakan tunggal, dan menuntut dua klik untuk satu maksud membuat panah
   * kiri-kanan terasa rusak. Pencarian tetap lewat tombol - ia berubah tiap
   * huruf yang diketik.
   */
  const pilihHari = useCallback(
    (tanggal: string) => {
      if (!tanggal) return;
      setDari(tanggal);
      setSampai(tanggal);
      setKalenderTerbuka(false);
      setDibuka("");
      // muat() membaca dari state yang belum berubah pada putaran ini, jadi
      // tanggalnya dikirim langsung.
      void muatTanggal(tanggal, tanggal);
    },
    // muatTanggal tidak bergantung pada state tanggal - lihat definisinya.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cari]
  );

  const buka = useCallback(
    async (baris: SidangBaris) => {
      const kunci = `${baris.nomorPerkara}|${baris.sidangId}`;
      if (dibuka === kunci) {
        setDibuka("");
        return;
      }

      setDibuka(kunci);
      setRincian(null);
      setMemuatRincian(true);
      try {
        const params = new URLSearchParams({
          nomor: baris.nomorPerkara,
          sidangId: baris.sidangId,
          // Tanggal dan agenda ikut dikirim: keduanya menentukan penilaian
          // kepatutan panggilan dan relevansi saksi, dan keduanya milik
          // SIDANG ini - bukan milik perkaranya.
          tanggalSidang: baris.tanggalSidang,
          agenda: baris.agenda,
        });
        const jawaban = await fetch(apiPath(`/api/aleta-ecourt/sidang?${params.toString()}`), {
          cache: "no-store",
        });
        const isi = await jawaban.json();
        if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal membaca rincian sidang."));
        setRincian((isi?.data ?? isi) as Rincian);
      } catch (kesalahan) {
        setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal membaca rincian sidang.");
        setDibuka("");
      } finally {
        setMemuatRincian(false);
      }
    },
    [dibuka]
  );

  // 22 Okt 2026: SATU tombol Menu di baris pencarian menggantikan baris alat.
  // Butirnya hanya yang boleh dilihat peran ini - syaratnya SAMA dengan syarat
  // tombolnya dulu, termasuk saklar "Tampilan" (tampil(tampilan, ...)).
  const butirMenuAlat: ButirMenuAlat[] = [];
  if (tampil(tampilan, "skor-kesiapan")) {
    butirMenuAlat.push({
      kunci: "hitung-skor",
      label: nilaiKesiapan ? "Skor: nyala" : "Hitung skor",
      ikon: Gauge,
      judul: "Menghitung kesiapan tiap sidang dari SIPP dan arsip e-Court: relaas, berkas, identitas pihak. Perlu beberapa detik.",
      nonaktif: pertamaMuat && memuat,
      menyala: nilaiKesiapan,
    });
  }
  if (tampil(tampilan, "layar-antrian")) {
    // "Layar antrian", BUKAN "Tampilan": kata itu sudah dipakai tombol saklar
    // tampilan di kepala layar yang sama.
    butirMenuAlat.push({
      kunci: "layar-antrian",
      label: "Layar antrian",
      ikon: MonitorPlay,
      judul: "Membuka layar antrian untuk televisi ruang tunggu dan layar operator",
      kelompokTautan: [
        { judul: "Untuk pihak", daftar: LAYAR_PIHAK.map((l) => ({ ...l, href: withBasePath(l.jalur) })) },
        { judul: "Untuk operator", daftar: LAYAR_OPERATOR.map((l) => ({ ...l, href: withBasePath(l.jalur) })) },
      ],
    });
  }
  if (!modeUrl && satuTanggalJadwal && kh.keliling && (kh.bolehHakim || bolehTundaPutusMassal) && sidang.length > 0 && tampil(tampilan, "menu-per-panitera")) {
    butirMenuAlat.push({
      kunci: "per-panitera-sidang",
      label: "Per panitera sidang",
      ikon: Users,
      // Audit hak 23 Okt 2026: "Pilih hakim" hanya disebut bagi yang memegangnya (Admin/Super Admin).
      judul: kh.bolehHakim
        ? "Pilih hakim, tunda massal, atau keterangan putus massal untuk semua perkara satu panitera sidang"
        : "Tunda massal atau keterangan putus massal untuk semua perkara satu panitera sidang",
      menyala: mejaPp,
    });
  }
  if (bolehCetakRelaas && tampil(tampilan, "tombol-cetak-relaas")) {
    butirMenuAlat.push({
      kunci: "cetak-relaas",
      label: "Cetak relaas",
      ikon: FileText,
      judul: "Cetak relaas panggilan sidang dan pemberitahuan putusan yang lahir pada hari itu, lewat ekstensi ALETA",
    });
  }
  if (tampil(tampilan, "tombol-penetapan-kembali") && bolehPenetapanKembali) {
    butirMenuAlat.push({
      kunci: "penetapan-kembali",
      label: "Penetapan kembali",
      ikon: RotateCcw,
      judul: "Penetapan kembali PMH, PPP, PJS, atau PHS - satu perkara atau massal, beserta alasannya. Dipratinjau dulu sebelum ditulis ke SIPP.",
    });
  }
  if (tampil(tampilan, "daftar-antrian")) {
    // Dua tekanan, bukan satu: yang pertama hanya MEMPERLIHATKAN apa yang akan
    // didaftarkan, yang kedua benar-benar menulis (lihat periksaSinkron).
    butirMenuAlat.push({
      kunci: "daftar-antrian",
      label: "Daftarkan ke antrian",
      labelSibuk: sinkronSibuk ? "Memeriksa…" : undefined,
      ikon: ListOrdered,
      judul: "Mendaftarkan perkara yang tampil ke aplikasi antrian ruang tunggu, supaya para pihak dapat mengambil nomor. Diperlihatkan dulu sebelum ditulis, dan hanya menambah yang belum terdaftar.",
      nonaktif: sinkronSibuk || sidang.length === 0,
    });
  }
  if (tampil(tampilan, "tombol-kasir") && bolehKasirJurnal) {
    butirMenuAlat.push({
      kunci: "kasir",
      label: "Kasir",
      ikon: Wallet,
      judul: "Kasir: isi Buku Jurnal Keuangan Perkara SIPP - uraian, pihak, jumlah, dan tanggal disusun otomatis dari keadaan perkara",
    });
  }
  if (tampil(tampilan, "tombol-kasir-harian") && kasirHarian.boleh) {
    butirMenuAlat.push({
      kunci: "kasir-harian",
      label: "Kasir harian",
      ikon: CalendarClock,
      judul: "Kasir harian: jurnal otomatis massal satu hari, rekap pengeluaran (PDF), dan pengingat tugas kasir",
    });
    if (tampil(tampilan, "menu-pengingat-kasir")) {
      butirMenuAlat.push({
        kunci: "pengingat-kasir",
        label: "Pengingat tugas kasir",
        ikon: ListChecks,
        judul: "Pengingat tugas kasir",
      });
    }
  }
  const adaTombolCetak = tampil(tampilan, "cetak");
  // 22 Okt 2026 (W57): saklar "Sidang keliling" di pita ruang punya saklar tampilannya;
  // keadaan keliling pada hari itu tidak berubah saat tombolnya disembunyikan.
  const adaSaklarKeliling = !modeUrl && satuTanggalJadwal && Boolean(kh.keliling) && tampil(tampilan, "saklar-sidang-keliling");
  const warnaBaris = tampil(tampilan, "warna-baris");
  const statusPutusanTampil = tampil(tampilan, "status-putusan");

  // ==========================================================================
  // K13 (25 Okt 2026) - TABEL JADWAL RINGAN: hanya baris yang berubah digambar ulang
  // ==========================================================================
  //
  // Saklar MATI bawaan (lihat baris-tabel-ringan.tsx): mati = tiap baris digambar
  // langsung seperti dulu. Menyala = baris dibungkus memo yang dibandingkan lewat
  // daftar `deps` di bawah. Isi daftar itu = SEMUA yang dibaca baris dari luar:
  //   - depsBarisBersama: keadaan layar yang sama untuk setiap baris (mengubahnya
  //     menggambar ulang semua baris, seperti sebelumnya);
  //   - sisanya diiris PER BARIS di tempatnya (peta antrian, tanda selesai, tiga jarak ...):
  //     berubahnya antrian satu perkara tidak menggambar ulang yang lain.
  // Fungsi pemicu (klik) lewat `alat`: bila saklar menyala, pembungkus stabil yang meneruskan ke versi terbaru.
  // Uji penjaga (cermin-tabel-ringan-25okt) mencocokkan daftar ini dengan semua
  // peubah yang dibaca baris, sehingga peubah baru yang terlupa ketahuan.
  const tabelRingan = useMemo(() => tabelRinganAktif(), []);
  const alat = useAlatBaris(tabelRingan, {
    onBukaStatus,
    onBukaTunda,
    muatTanggal,
    muatTunjukan,
    muatKeterangan,
    segarkanRingan,
    muatUlang: tandaSelesai.muatUlang,
    alihSaksi: saksiLipat.alih,
    tarikBelumUpload: tarikBelumUpload.tarik,
    infoRuangSidang,
    sebutTetangga,
    buka,
  });
  // Hasil pengait aslinya; baris membentuk salinan dengan pemicu dari `alat` (bernama sama supaya isi baris tetap).
  const tandaSelesaiHook = tandaSelesai;
  const saksiLipatHook = saksiLipat;
  const tarikBelumUploadHook = tarikBelumUpload;
  // Pemanggilan SAAT MENGGAMBAR memakai fungsi asli (bukan pembungkus): nilai putaran ini.
  const infoLangsung = infoRuangSidang;
  const tetanggaLangsung = sebutTetangga;
  const depsBarisBersama: readonly unknown[] = tabelRingan
    ? [
        tampilan,
        bolehJalannya,
        bolehTulisKeterangan,
        satuTanggalJadwal,
        modeUrl,
        dari,
        sampai,
        nilaiKesiapan,
        patokanWaktu,
        saat,
        hakim,
        pilihanHakim,
        aktifPenandaPerkara,
        aktifPenandaPekerjaan,
        aktifPanggilSaksi,
        aktifPihakHadir,
        kolomTabel,
        warnaBaris,
        statusPutusanTampil,
        setelanAps,
        jenisBlangkoPeran,
        institutionIdentity?.courtName,
        currentUser,
        verifikasi,
        waktuAntrian.hariIni,
        hariIni(),
        Boolean(onBukaStatus),
        Boolean(onBukaTunda),
        // kh dibentuk ulang tiap gambar, tetapi tiap ruasnya stabil.
        ...Object.values(kh),
      ]
    : [];

  return (
    <UnduhTertutupTautan.Provider value={Boolean(modeUrl)}>
    <Card
      className={cn(
        // Layar penuh BERJENDELA (J4): kartu menutupi seluruh jendela
        // peramban - tab dan bilah peramban tetap ada. Isinya tetap sama
        // persis, termasuk saklar Tampilan dan Ringkas/Lengkap.
        // backdrop-blur-none: filter pada kartu menjadikannya bingkai bagi
        // anak ber-position fixed (Kalender, dialog) - mereka akan ikut
        // tergulung bersama isi kartu, bukan tetap di tengah jendela.
        layarPenuh &&
          "fixed inset-0 z-50 m-0 overflow-auto rounded-none border-0 bg-background shadow-none backdrop-blur-none dark:bg-background"
      )}
      data-layar-penuh={layarPenuh ? "ya" : undefined}
    >
      {/* ==================================================================
          KEPALA SETIPIS MUNGKIN
          ==================================================================

          Yang dicari orang di layar ini adalah DAFTAR SIDANGNYA. Tiap baris
          keterangan di atasnya mendorong daftar itu turun, dan pada layar
          laptop 21 sidang berubah menjadi 6 yang terlihat.

          Keterangan panjangnya dibuang seluruhnya: ia menerangkan hal yang
          sudah jelas begitu tabelnya terlihat, dan hanya dibaca sekali seumur
          hidup pemakainya. Judul cukup.

          Tombol ciutkan menyembunyikan SELURUH kendali - tombol tindakan,
          saringan, pencarian - dan menyisakan navigasi hari saja. Panitera
          yang sedang membacakan jadwal tidak sedang menyaring apa pun; ia
          hanya perlu melihat sebanyak mungkin baris sekaligus. */}
      {/* flex-wrap, dan kelompok kanannya TIDAK lagi shrink-0.
          Terukur sebabnya: judul + tiga tombol tidak muat pada 375px, dan
          dengan shrink-0 kelompok kanannya tidak boleh mengecil maupun turun,
          sehingga yang terjadi bukan pembungkusan melainkan tombol yang
          terdorong keluar tepi. Sekarang ia turun ke baris berikutnya di
          layar sempit dan tetap satu baris di layar lebar. */}
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 p-4 pb-2 pt-3 sm:p-5 sm:pb-2 sm:pt-3">
        <CardTitle className="text-base font-bold uppercase tracking-wide sm:text-lg">
          Jadwal perkara yang bersidang
        </CardTitle>

        {/* ==================================================================
            SIAPA YANG SEDANG MEMBUKANYA - BUTIR 3
            ==================================================================

            Diminta pengguna 22 September 2026, menggantikan baris "Peran Anda
            berhak melihat seluruh perkara satker" yang dibuang pada hari yang
            sama. Keterangannya sama-sama tentang siapa yang membuka; bedanya
            yang ini tidak memakan satu baris penuh di atas daftar.

            Tepat di bawah judul, bukan di kelompok tombol kanan: ia keterangan,
            bukan kendali - dan menaruhnya di antara tombol membuat orang
            mencoba menekannya.

            Jabatan dibaca dari daftar jabatan portal. Yang tidak ketemu tidak
            menampilkan tanda kurung kosong - jabatan yang belum terisi adalah
            keadaan yang sah, dan kurung kosong terbaca seperti data yang
            hilang. */}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        {/* ==================================================================
            "PERKARA SAYA" DI SUDUT KANAN ATAS
            ==================================================================

            Dahulu ia berdiri sendirian pada satu baris tepat di atas tabel.
            Barisnya selebar layar sementara isinya hanya satu tombol, jadi
            yang didapat sebuah baris kosong yang mendorong seluruh daftar
            sidang turun - persis kerugian yang dihindari kepala setipis
            mungkin di atas.

            Di sini ia tidak memakai baris sama sekali: kepalanya sudah ada,
            dan tingginya ditentukan judul yang lebih tinggi daripada tombol.

            Ia ditaruh PALING KIRI di antara ketiganya - artinya paling dekat
            ke judul - sebab urutan bacanya memang begitu: apa yang saya
            lihat, seberapa padat, lalu apakah kendalinya dibuka.

            Keterangan panjangnya tidak ikut pindah; ia menjadi title. Yang
            TIDAK boleh menjadi title hanya peringatan namanya tidak ketemu -
            title tidak terlihat tanpa disentuh, dan peringatan yang tidak
            terlihat sama saja tidak ada. Itu tetap tinggal di atas tabel. */}
        {!modeUrl && bolehKelolaTautan && tampil(tampilan, "tautan-jadwal") ? (
          <a
            href={withBasePath("/admin/akses-publik")}
            data-tautan-jadwal=""
            className="inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
            title="Membuat atau mencabut tautan rahasia Jadwal Sidang (tanpa masuk akun, hanya dari jaringan kantor)."
          >
            <Link2 className="h-3.5 w-3.5" />
            Tautan jadwal
          </a>
        ) : null}
        {/* Tunda otomatis 16.30 (22 Okt 2026): daftar harian + saklar Super Admin. */}
        {currentUser && !modeUrl && tampil(tampilan, "tombol-tunda-otomatis") ? <TombolTundaOtomatis tanggal={dari} /> : null}
        {currentUser && !modeUrl && tampil(tampilan, "tombol-perkara-saya") ? (
          <Button
            type="button"
            size="sm"
            variant={hanyaMilikSaya ? "default" : "outline"}
            className="h-8 px-2.5"
            aria-pressed={hanyaMilikSaya}
            onClick={() => setHanyaMilikSaya((x) => !x)}
            title={
              hanyaMilikSaya
                ? `Sedang menampilkan perkara Anda saja${
                    milikSaya.sebagai ? ` sebagai ${milikSaya.sebagai}` : ""
                  } - tekan untuk melihat seluruh perkara satker.`
                : "Sedang menampilkan seluruh perkara satker - tekan untuk menyaring ke perkara Anda."
            }
          >
            <UserRound className="mr-1 h-3.5 w-3.5" />
            {hanyaMilikSaya ? "Perkara saya" : "Semua perkara"}
          </Button>
        ) : null}

        {/* ==================================================================
            SAKLAR TAMPILAN
            ==================================================================

            Di kepala bersama pemilih Ringkas/Lengkap, sebab pertanyaannya satu
            keluarga - keduanya menjawab "apa yang saya mau lihat", bukan
            "perkara yang bagaimana". Menaruhnya di antara saringan akan
            membuat orang menduga ia ikut menyaring baris, padahal ia hanya
            menggambar atau tidak menggambar.

            Angka pada tombolnya menyebut BERAPA yang sedang dimatikan. Tanpa
            itu, layar yang penandanya sudah dipadamkan berbulan-bulan lalu
            terbaca sebagai layar yang memang tidak punya penanda - dan yang
            membacanya akan menyimpulkan perkaranya bersih. */}
        {tampil(tampilan, "tombol-layar-penuh") || layarPenuh ? <TombolLayarPenuh penuh={layarPenuh} onUbah={setLayarPenuh} /> : null}

        {/* Pemilih tampilan berdiri di kepala, bukan di antara saringan:
            ia menjawab "seberapa padat saya mau melihatnya", satu keluarga
            dengan tombol ciutkan - dan justru paling dibutuhkan ketika
            kendali lainnya sedang disembunyikan. */}
        {modeUrl ? null : (
        <>
        <div className="inline-flex overflow-hidden rounded-md border text-sm">
          <button
            type="button"
            onClick={() => pilihModeRingkas(true)}
            className={cn(
              "px-2.5 py-1",
              modeRingkas ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            Ringkas
          </button>
          <button
            type="button"
            onClick={() => pilihModeRingkas(false)}
            className={cn(
              "border-l px-2.5 py-1",
              modeRingkas ? "hover:bg-muted" : "bg-primary text-primary-foreground"
            )}
          >
            Lengkap
          </button>
        </div>
        <button
          type="button"
          onClick={() => setKendaliCiut((n) => !n)}
          aria-expanded={!kendaliCiut}
          title={kendaliCiut ? "Tampilkan kendali dan saringan" : "Ciutkan kendali agar daftar sidang lebih panjang"}
          className="flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          {kendaliCiut ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          {kendaliCiut ? "Kendali" : "Ciutkan"}
        </button>
        {/* 19 Okt 2026 (JADWAL-3 butir 2): Tampilan di SUDUT KANAN - paling
            kanan di deret tombol kepala, sama dengan Jadwal Mediasi. */}
        <button
          type="button"
          data-tombol-tampilan-sidang=""
          onClick={() => setPanelTampilan((n) => !n)}
          aria-expanded={panelTampilan}
          title="Memilih penanda, keterangan, dan tombol mana yang digambar di layar ini."
          className={cn(
            "flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs transition",
            panelTampilan
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Tampilan
          {dimatikan > 0 ? (
            <span
              className={cn(
                "rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                panelTampilan ? "bg-primary-foreground/20" : "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100"
              )}
            >
              {dimatikan}
            </span>
          ) : null}
        </button>
        </>
        )}
        </div>
        {/* ==================================================================
            SIAPA YANG SEDANG MEMBUKANYA - DI BAWAH, BUKAN DI ANTARA TOMBOL
            ==================================================================

            Menggantikan baris "Peran Anda berhak melihat seluruh perkara
            satker" yang dibuang 22 September 2026.

            Letaknya SESUDAH kelompok tombol, dan itu yang membuat tombolnya
            duduk di kanan baris judul. Ketika ia berdiri di antara judul dan
            tombol, w-full basis-full miliknya memaksa pembungkusan - dan
            tombol terdorong ke baris ketiga, tempat justify-end tidak
            berpengaruh apa pun sebab pembungkusnya menyusut ke isinya.

            Ia keterangan, bukan kendali; menaruhnya di antara tombol membuat
            orang mencoba menekannya. */}
        {modeUrl ? (
          <p className="w-full basis-full text-xs text-muted-foreground" data-nama-tautan="">
            {namaTautan ? `Tautan: ${namaTautan}` : "Tautan jadwal sidang"}
          </p>
        ) : currentUser && tampil(tampilan, "identitas-pembuka") ? (
          <p className="w-full basis-full text-xs text-muted-foreground">
            {currentUser.name}
            {jabatanSaya ? ` · ${jabatanSaya}` : ""}
          </p>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
        <BannerGangguan keadaan={cobaLagiJadwal.keadaan} onCobaSekarang={cobaLagiJadwal.cobaSekarang} />
        {galat ? (
          <p className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            <span className="min-w-0 flex-1">{galat}</span>
            <button
              type="button"
              data-jadwal-coba-lagi=""
              onClick={() => {
                setGalat("");
                void cobaLagiJadwal.cobaSekarang();
              }}
              className="shrink-0 rounded border border-rose-300 px-2 py-0.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
            >
              Coba lagi
            </button>
            <TombolTutupPesan onTutup={() => setGalat("")} />
          </p>
        ) : null}

        {/* ==================================================================
            PANEL SAKLAR TAMPILAN
            ==================================================================

            Panel biasa yang mendorong isi di bawahnya, bukan popover
            melayang. Sebabnya diukur, bukan selera: daftarnya tiga puluhan
            saklar dalam empat kelompok, dan popover setinggi itu di layar
            laptop menutupi justru daftar yang sedang disetel orangnya - ia
            tidak dapat melihat akibat saklarnya sendiri.

            Panel ini hanya terbuka selama disetel, jadi ruang yang dipakainya
            tidak pernah menjadi ruang yang hilang permanen.

            Yang WAJIB tetap digambar - menyala dan tidak dapat ditekan -
            beserta sebabnya. Menghilangkannya dari daftar akan membuat orang
            mengira penandanya sudah tidak ada lagi, lalu mencarinya di tempat
            yang salah. */}
        {panelTampilan ? (
          <div className="rounded-xl border bg-muted/20 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">Apa yang digambar di layar ini</p>
              <button
                type="button"
                onClick={() => setPanelTampilan(false)}
                className="rounded-md border px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                Tutup
              </button>
            </div>

            {/* ==============================================================
                MODE DI PALING ATAS, SUB-PILIHAN DI BAWAHNYA - PERBAIKAN 1 OKT
                ==============================================================

                Diminta pengguna (J5): "Nyalakan semua" menjadi Mode lengkap,
                "Sembunyikan semua" menjadi Mode minimalis, diletakkan DI ATAS
                kelompok Penanda, dan memilih mode ikut mengubah centang di
                bawahnya. Lengkap = semua kecuali Kolom Siap dan Catatan cara
                menghitung; minimalis = semua mati (yang bertanda "tetap"
                tetap menyala). Mode yang menyala dibaca dari centangnya -
                mengubah satu centang menjadikannya "Suai". */}
            <div
              className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2"
              role="group"
              aria-label="Mode tampilan"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mode</span>
              <button
                type="button"
                onClick={setelUlangTampilan}
                aria-pressed={modeTampilan === "lengkap"}
                title="Mode lengkap (dulu: Nyalakan semua) - semua menyala kecuali Kolom Siap dan Catatan cara menghitung."
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition",
                  modeTampilan === "lengkap"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                Mode lengkap
              </button>
              <button
                type="button"
                onClick={sembunyikanSemuaTampilan}
                aria-pressed={modeTampilan === "minimalis"}
                title="Mode minimalis (dulu: Sembunyikan semua) - mematikan seluruh saklar yang dapat dimatikan; sesudahnya centang satu per satu yang hendak dilihat. Yang bertanda tetap tidak ikut; sebabnya di bawah daftar."
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition",
                  modeTampilan === "minimalis"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                Mode minimalis
              </button>
              {modeTampilan === "suai" ? (
                <span className="text-xs text-muted-foreground">
                  Suai - centangnya diatur sendiri di bawah.
                </span>
              ) : null}
            </div>

            {/* Butir 11 (6 Okt 2026): saklar "Tampilkan contoh" DI ATAS daftar.
                Menyala = contoh tampil/disembunyikan tiap fitur terpampang di bawah
                saklarnya; tiap saklar juga punya ikon "i" yang memperlihatkan hal
                yang sama saat disorot. */}
            <label
              className="mb-3 flex w-fit cursor-pointer items-center gap-2 rounded-lg border bg-card px-2 py-1.5 text-sm"
              data-saklar-contoh=""
              title="Memampangkan contoh bentuk tiap fitur saat tampil dan saat disembunyikan, langsung di bawah saklarnya."
            >
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-primary"
                checked={contohSaklar}
                onChange={(e) => setContohSaklar(e.target.checked)}
              />
              <span className="font-medium">Tampilkan contoh semua fitur</span>
              <span className="text-xs text-muted-foreground">(tampil dan disembunyikan)</span>
            </label>

            <p className="mb-3 text-xs text-muted-foreground">
              Pilihannya tersimpan di peramban ini saja dan tidak mengubah data apa pun -
              yang dimatikan hanya tidak digambar, bukan tidak ada. Penanda yang mendesak
              tidak dapat dimatikan; sebabnya disebut pada tiap barisnya.
            </p>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {kelompokTampilan().map((kelompok) => (
                <div key={kelompok.kunci} className="rounded-lg border bg-card p-2">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {kelompok.label}
                  </p>
                  <ul className="space-y-1">
                    {kelompok.anggota.map((saklar) => {
                      const menyala = tampil(tampilan, saklar.kunci);
                      return (
                        <li key={saklar.kunci}>
                          <div className="flex items-start gap-1">
                          <label
                            className={cn(
                              "flex items-start gap-2 rounded-md px-1.5 py-1 text-sm",
                              saklar.wajib ? "opacity-90" : "cursor-pointer hover:bg-muted/60"
                            )}
                            title={
                              saklar.wajib
                                ? `${saklar.keterangan} Tidak dapat dimatikan - lihat keterangan di bawah daftar.`
                                : saklar.keterangan
                            }
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 h-3.5 w-3.5 accent-primary"
                              checked={menyala}
                              disabled={saklar.wajib}
                              onChange={(e) => ubahSaklar(saklar.kunci, e.target.checked)}
                            />
                            <span className="leading-tight">
                              {saklar.label}
                              {saklar.wajib ? (
                                <span className="ml-1 rounded bg-rose-100 px-1 text-[10px] font-semibold text-rose-900 dark:bg-rose-950 dark:text-rose-200">
                                  Tetap
                                </span>
                              ) : null}
                            </span>
                          </label>
                          <InfoContohSaklar
                            kunci={saklar.kunci}
                            label={saklar.label}
                            keterangan={saklar.keterangan}
                            menyala={menyala}
                          />
                          </div>
                          {contohSaklar ? (
                            <div className="mb-1 ml-6 mt-0.5">
                              <DuaKeadaan kunci={saklar.kunci} keterangan={saklar.keterangan} menyala={menyala} />
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>

            {/* Butir 37 (5 Okt 2026): saklar fitur panggil petugas & pihak - simpanan sendiri. */}
            <SaklarPanggil className="mt-3" />

            <p className="mt-3 text-xs text-muted-foreground">
              {/* Daftarnya DIHITUNG dari saklar yang wajib, bukan ditulis tangan:
                  kalimat "empat penanda" sempat basi satu rilis penuh sesudah
                  tenggang mepet masuk sebagai kotak merah. */}
              <strong>Mengapa yang bertanda &ldquo;tetap&rdquo; tidak dapat dimatikan.</strong>{" "}
              Saklar yang dimatikan hari ini tersimpan di peramban dan tidak dinyalakan lagi
              besok. Untuk keterangan yang sekadar menolong itu tidak merugikan; untuk{" "}
              {SAKLAR_TAMPILAN.filter((x) => x.wajib)
                .map((x) => x.label.toLowerCase())
                .join(", ")}{" "}
              akibatnya sidang yang batal, berkas yang tidak pernah dijahit, atau hasil sidang
              yang tidak pernah dicatat — dan yang membaca layar sesudahnya belum tentu orang
              yang mematikannya.
            </p>
          </div>
        ) : null}

        {/* ==================================================================
            BILAH ALAT: NAVIGASI HARI DI ATAS, SISANYA DI BAWAH
            ==================================================================

            Sebelumnya tujuh tombol berjajar dalam satu baris tanpa pengelompokan,
            dan yang dipakai tiap hari - panah maju mundur - tenggelam di antara
            yang jarang dipakai.

            Sekarang navigasi hari berdiri sendiri sebagai satu kesatuan, dan
            tanggal terbacanya diletakkan besar di sebelahnya: itulah yang
            pertama dicari mata saat layar dibuka. */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* ============================================================
                SATU ALAT RENTANG, BUKAN DUA TANGGAL YANG BERJAUHAN
                ============================================================

                Tanggal mulai dan tanggal akhir menjawab SATU pertanyaan -
                "jadwal tanggal berapa sampai berapa". Sebelumnya keduanya
                dipisah oleh kotak pencarian, sehingga mata harus melompati
                kotak yang tidak ada hubungannya untuk membaca satu rentang.

                Sekarang keduanya menempel di dalam satu bingkai, dipisah tanda
                pisah, dan panah maju-mundur mengapitnya. Kotak pencarian pindah
                ke baris tindakan di bawah: ia menyaring yang SUDAH tampil, dan
                itu pekerjaan yang lain sama sekali. */}
            {/* 23 Okt 2026: tanpa overflow-hidden - bingkai ini memotong kalender
                libur yang membuka ke bawah, sehingga tombolnya tampak tidak
                berfungsi. Sudut tombol tepi dibulatkan sendiri (first:/last:). */}
            <div className="flex items-center rounded-lg border bg-card shadow-sm">
              <button
                type="button"
                aria-label="Hari sebelumnya"
                onClick={() => pilihHari(geserHari(dari, -1))}
                className="rounded-l-lg px-2.5 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex items-center border-x bg-background/40">
                {/* 22 Okt 2026: kalender bersama bertanda libur - tanggal tampilan, jadi libur boleh dibuka. */}
                <PemilihTanggalSidang
                  value={dari}
                  onChange={(v) => pilihHari(v)}
                  liburBolehDipilih
                  tampilKalender={tampil(tampilan, "kalender-libur")}
                  sebutan="Tanggal sidang"
                  className="h-9 w-[8.75rem] rounded-none border-0 bg-transparent text-center focus-visible:ring-0"
                  aria-label="Tanggal sidang mulai"
                />
                {modeUrl ? null : (
                <>
                <span aria-hidden className="select-none px-0.5 text-muted-foreground">
                  –
                </span>
                <PemilihTanggalSidang
                  value={sampai}
                  min={dari}
                  onChange={(v) => setSampai(v)}
                  liburBolehDipilih
                  tampilKalender={tampil(tampilan, "kalender-libur")}
                  sebutan="Tanggal sidang"
                  className="h-9 w-[8.75rem] rounded-none border-0 bg-transparent text-center focus-visible:ring-0"
                  aria-label="Tanggal sidang sampai"
                />
                </>
                )}
              </div>

              <button
                type="button"
                aria-label="Hari berikutnya"
                onClick={() => pilihHari(geserHari(dari, 1))}
                className="px-2.5 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => pilihHari(hariIni())}
                className="border-l px-3 py-2 text-sm text-muted-foreground transition last:rounded-r-lg hover:bg-muted hover:text-foreground"
              >
                Hari ini
              </button>

              {/* Ikon saja - gambarnya sudah menerangkan dirinya, dan
                  namanya hanya menambah lebar tanpa menambah keterangan.
                  aria-label dan title menjaganya tetap terbaca bagi yang
                  memakai pembaca layar maupun yang ragu. */}
              {modeUrl || !tampil(tampilan, "tombol-kalender-sidang") ? null : (
              <button
                type="button"
                aria-label="Pilih tanggal dari kalender"
                title="Pilih tanggal dari kalender"
                onClick={() => setKalenderTerbuka(true)}
                className="rounded-r-lg border-l px-3 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <CalendarDays className="h-4 w-4" />
              </button>
              )}
            </div>

            {/* JADWAL-3 butir 5: tulisan dan keadaannya TETAP selama memuat -
                penyegaran latar (antrian, 45 detik) tidak boleh menggambar apa
                pun. Tekanan ganda ditolak muatTanggal sendiri (memuatRef). */}
            {modeUrl ? null : (
            <Button size="sm" onClick={() => void muat()}>
              Tampilkan
            </Button>
            )}

            {/* Tanggal terbacanya, bukan angka - "Senin" adalah yang dicari
                orang, bukan "31/08". */}
            {/* 22 Okt 2026 (W57): dua saklar - tanggal terbaca + jumlah sidang, dan tanda
                "diperbarui". Keduanya hanya gambar; pembaruan ringan di latar tetap jalan. */}
            {tampil(tampilan, "tanggal-dan-jumlah") || tampil(tampilan, "tanda-diperbarui") ? (
            <div className="ml-auto text-right">
              {tampil(tampilan, "tanggal-dan-jumlah") ? (
                <p className="text-sm font-semibold leading-tight">{tanggalHariPanjang(dari)}</p>
              ) : null}
              <p className="text-sm text-muted-foreground">
                {tampil(tampilan, "tanggal-dan-jumlah")
                  ? pertamaMuat && memuat
                    ? "\u00a0"
                    : sidang.length === 0
                      ? "tidak ada sidang"
                      : `${sidang.length} sidang${dari !== sampai ? " pada rentang ini" : ""}`
                  : null}
                {/* 22 Okt 2026: waktu bacaan terakhir yang berhasil (ringan atau lengkap). */}
                {(pertamaMuat && memuat) || !tampil(tampilan, "tanda-diperbarui") ? null : (
                  <TandaDiperbarui penyimpan={penyimpanDiperbarui} awalan={tampil(tampilan, "tanggal-dan-jumlah") ? " · " : ""} />
                )}
                {/* A4: daftar dibaca dari Cermin Perkara; antrian dan kehadiran tetap langsung dari sumbernya. */}
                {cerminJadwal && !(pertamaMuat && memuat) ? (
                  <span data-testid="tanda-cermin" title="Daftar sidang dibaca dari salinan keadaan perkara SIPP di ALETA (Cermin Perkara). Antrian dan kehadiran tetap langsung.">
                    {" · Cermin · diperbarui "}
                    {cerminJadwal.diperbaruiPada
                      ? new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Makassar", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(cerminJadwal.diperbaruiPada)).replace(":", ".")
                      : "-"}
                  </span>
                ) : null}
              </p>
            </div>
            ) : null}
          </div>

          {/* ==============================================================
              SATU KOTAK PENCARIAN - DI ATAS, TEPAT DI BAWAH TANGGAL
              ==============================================================

              Diminta pengguna 22 September 2026: "pada search terdapat 2
              yaitu saring dan yang cari, buat jadi satu agar tidak
              membingungkan, buat di atas (dibawah tanggal) pencariannya".

              Sebabnya dapat diperiksa sendiri di layar lama: dua kotak
              berbentuk sama, sama-sama bertuliskan pencarian, satu di sisi
              tombol dan satu di bawah deretan penanda. Yang satu menuntut
              tombol Tampilkan ditekan sesudahnya, yang lain bekerja seketika
              - dan tidak ada pada bentuknya yang memberi tahu yang mana.

              Sekarang: mengetik menyaring seketika; menekan Enter melebarkan
              pencarian ke SIPP. Lihat catatan pada kirimCariKeSipp. */}
          <div className={cn("space-y-1.5", kendaliCiut && "hidden")}>
            {/* ==============================================================
                LEBARNYA DIBATASI, DAN TEMANNYA DI SEBELAHNYA
                ==============================================================

                Diminta pengguna 22 September 2026: "rounded search terlalu
                panjang jadi tidak estetik ... taruh tombol pencarian lanjutan
                disampingnya".

                Kotak selebar layar bukan sekadar tidak sedap dipandang: ia
                menjanjikan isian sepanjang itu, padahal yang diketik orang
                nomor perkara atau satu nama. Dan barisnya menjadi baris yang
                isinya satu benda saja - satu baris penuh yang mendorong
                seluruh daftar sidang turun.

                Pencarian lanjutan, angka "x dari y", dan Reset pindah ke sini
                dari baris tombol tindakan: ketiganya tentang MENYARING, dan
                tempatnya memang di sebelah kotak saringnya. Yang tinggal di
                baris tindakan hanya yang MENGERJAKAN sesuatu. */}
            <div className="flex flex-wrap items-center gap-2">
              {modeUrl ? null : (
              <div className="relative min-w-[15rem] flex-1 sm:max-w-xl" data-cari-pintar-sidang="">
                <FileSearch
                  aria-hidden="true"
                  className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={cariCepat}
                  onChange={(e) => setCariCepat(e.target.value)}
                  onFocus={() => setFokusCari(true)}
                  onBlur={() => setFokusCari(false)}
                  onKeyDown={(peristiwa) => {
                    if (peristiwa.key === "Enter") kirimCariKeSipp();
                    if (peristiwa.key === "Escape") setFokusCari(false);
                  }}
                  placeholder="Cari perkara, pihak, saksi, hakim, ghaib, konseptor… — Enter ke SIPP"
                  aria-label="Cari perkara. Mengetik menyaring daftar yang tampil, termasuk kata kunci seperti ghaib, verstek, konseptor, belum BAS; menekan Enter mencari ke SIPP."
                  className="h-9 pl-8 text-sm"
                />
                <PetunjukCariPintar
                  terbuka={fokusCari}
                  kataKunci={KATA_KUNCI_SIDANG}
                  medan={MEDAN_SIDANG}
                  contohMedan={CONTOH_MEDAN_SIDANG}
                  urai={uraiCari}
                  enterKeSipp
                  onPilih={(kata) => setCariCepat((lama) => `${lama.trim()} ${kata}`.trim() + " ")}
                />
              </div>
              )}

              {!modeUrl && sidang.length > 0 && tampil(tampilan, "pencarian-lanjutan") ? (
                <Button
                  size="sm"
                  variant={lanjutTerbuka || cariLanjut.jumlahAktif > 0 ? "default" : "outline"}
                  onClick={() => setLanjutTerbuka((buka) => !buka)}
                >
                  <Filter className="mr-1.5 h-4 w-4" />
                  Pencarian lanjutan
                  {cariLanjut.jumlahAktif > 0 ? ` (${cariLanjut.jumlahAktif})` : ""}
                </Button>
              ) : null}

              {/* 22 Okt 2026 (diminta pengguna): Cetak tepat di samping
                  Pencarian lanjutan, lalu SATU tombol Menu yang memuat alat
                  lainnya. Baris alat lama dan baris pil ruang sudah tiada. */}
              {adaTombolCetak ? (
              <div className="relative">
              <Button
                size="sm"
                variant="outline"
                disabled={sidang.length === 0}
                onClick={() => {
                  // 22 Okt 2026 (pengguna): cetak seperti semula; saat Sidang keliling
                  // menyala dan ada hakim pengganti, halamannya langsung dipisah per hakim.
                  setCetakPerHakim(adaPilihanHakim(sidangTampil, pilihanHakim));
                  setSedangCetak(true);
                }}
              >
                <Printer className="mr-1.5 h-4 w-4" />
                Cetak
              </Button>
              </div>
              ) : null}

              <MenuAlatJadwal
                butir={butirMenuAlat}
                onPilih={(kunci) => {
                  if (kunci === "hitung-skor") {
                    // Menyalakan skor HARUS memuat ulang. Sebelumnya tombolnya
                    // hanya membalik penanda, sehingga tulisannya berubah jadi
                    // "Skor: nyala" tetapi kolom Siap tetap bergaris - skornya
                    // memang belum pernah diminta ke bot.
                    const menyala = !nilaiKesiapan;
                    setNilaiKesiapan(menyala);
                    if (menyala) void muatTanggal(dari, sampai, true);
                    else setKesiapan({});
                  } else if (kunci === "per-panitera-sidang") setMejaPp((b) => !b);
                  else if (kunci === "cetak-relaas") setCetakRelaasTerbuka(true);
                  else if (kunci === "penetapan-kembali") setPenetapanKembaliTerbuka(true);
                  else if (kunci === "daftar-antrian") void periksaSinkron();
                  else if (kunci === "kasir") setKasirTerbuka(true);
                  else if (kunci === "kasir-harian") kasirHarian.setBuka("massal");
                  else if (kunci === "pengingat-kasir") kasirHarian.setBuka("pengingat");
                }}
              />

              {/* Angka "x dari y" menempel pada Reset: yang paling sering
                  ditanyakan saat daftar menyusut adalah berapa yang
                  disembunyikan. */}
              {!modeUrl && adaSaringan && sidang.length > 0 ? (
                <>
                  <span className="text-sm text-muted-foreground">
                    {sidangTampil.length} dari {sidang.length} perkara
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={resetSemuaSaringan}
                    title={`Lepaskan seluruh saringan dan kembali ke ${sidang.length} perkara`}
                  >
                    <RotateCcw className="mr-1 h-3.5 w-3.5" />
                    Reset ke {sidang.length} perkara
                  </Button>
                </>
              ) : null}
            </div>

            {/* Kata kunci yang sedang berlaku DI SISI SIPP disebutkan, karena
                ia tidak terlihat di mana pun selain di sini: daftarnya sudah
                menyusut sebelum sampai ke layar. Tanpa baris ini, jadwal yang
                tersaring akan disangka jadwal yang memang sepi. */}
            {!modeUrl && cari ? (
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span>
                  Dicari ke SIPP: <strong className="text-foreground">{cari}</strong>
                </span>
                <button
                  type="button"
                  onClick={lepasCariSipp}
                  disabled={pertamaMuat && memuat}
                  className="rounded border px-1.5 py-0.5 transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  lepaskan
                </button>
              </p>
            ) : null}
          </div>

          {mejaPp && !modeUrl && satuTanggalJadwal && kh.keliling && tampil(tampilan, "menu-per-panitera") ? (
            <MejaPaniteraSidang
              daftar={sidang}
              kh={kh}
              sudahHasil={sidangSelesaiHariIni}
              bolehTundaPutus={bolehTundaPutusMassal}
              onSelesai={() => void muatTanggal(dari, sampai, nilaiKesiapan)}
              onTutup={() => setMejaPp(false)}
            />
          ) : null}

          {/* === 12OKT-C: kartu ruang sidang (butir 3) ===
              Sejak 19 Okt 2026 (JADWAL-3 butir 3) kartu ruang tidak lagi
              memakai baris sendiri di sini: ia menyatu dengan ringkasan ruang
              sidang menjadi SATU pita di atas tabel - lihat PitaRuangSidang.
              Saklar "kartu-ruang" tetap mengatur bagian jumlah/perlu diperiksa. */}
        </div>


        {/* ==================================================================
            KOTAK KEADAAN
            ==================================================================

            Yang menuntut tindakan berwarna merah, yang perlu diperhatikan
            kuning, yang sudah beres hijau. Warnanya menyebut arti, bukan
            selera - dan itu yang membuat deretan ini terbaca sebelum
            angkanya sempat dibaca.

            Angkanya dihitung dari SELURUH sidang hari itu, bukan dari yang
            sudah tersaring: kalau ikut menyusut, menyalakan satu saringan
            membuat saringan lain tampak nol dan mustahil dilepas kembali. */}
        {/* Kegagalan membaca antrian disebutkan apa adanya. Kolom antrian yang
            kosong tanpa sebab akan disangka fitur yang belum jalan; yang
            menyebutkan sambungannya bermasalah dapat ditindaklanjuti - dan
            sambungannya memang dapat disunting dari menu Koneksi SQL. */}
        {!antrian.terbaca && antrian.alasan && sidang.length > 0 ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
            Nomor antrian tidak terbaca: {antrian.alasan} — periksa sambungan ke aplikasi antrian
            di Admin ALETA Bot. Jadwalnya sendiri tetap benar.
          </p>
        ) : null}

        {/* Tabel antrian memuat hari berjalan saja. Bila ia memuat lebih dari
            satu tanggal, nomornya patut diragukan - rumus yang menjawab
            WhatsApp pun tidak menyaring tanggal, sehingga nomor yang diterima
            para pihak ikut bergeser. Disebutkan, bukan didiamkan. */}
        {antrian.terbaca && antrian.tanggal.length > 1 ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
            Aplikasi antrian memuat {antrian.tanggal.length} tanggal sekaligus (
            {antrian.tanggal.map((t) => tanggalHariPendek(t, t)).join(", ")}). Nomor antrian dihitung dari seluruhnya, sama
            seperti nomor yang dikirim lewat WhatsApp — periksa apakah data antrian hari-hari
            sebelumnya sudah dibersihkan.
          </p>
        ) : null}

        {/* ==================================================================
            SATU DERET SARINGAN
            ==================================================================

            Alur perkara dan keadaan sidang disatukan. Keduanya mengerjakan
            hal yang sama - menyaring tabel dengan menekan angka - dan dua
            baris dengan dua bentuk kotak yang berbeda membuat pekerjaan
            tunggal itu tampak seperti dua alat.

            YANG BERNILAI NOL TIDAK DITAMPILKAN. Ia sudah dimatikan dan tidak
            dapat menyaring apa pun; menampilkannya hanya memaksa mata
            melewati sembilan kotak mati sebelum sampai ke yang hidup.
            Kecualinya kotak yang sedang MENYALA - kalau ia ikut hilang saat
            angkanya nol, saringannya tidak dapat dimatikan lagi. */}
        {sidang.length > 0 && (modeUrl || !kendaliCiut) ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {/* ============================================================
                SAKLAR CIUT - DAN SARINGAN YANG MENYALA TIDAK IKUT HILANG
                ============================================================

                Kotak yang sedang MENYALA tetap digambar walau deretnya
                diciutkan. Tanpa itu, saringan yang terlanjur aktif menjadi
                tidak dapat dimatikan lagi: daftarnya tampak kehilangan baris
                tanpa satu pun keterangan mengapa. Aturan yang sama sudah
                berlaku bagi kotak bernilai nol tepat di bawah ini. */}
            {/* IKON SAJA - TETAPI NAMANYA TIDAK IKUT HILANG.

                Diminta pengguna 22 September 2026. Kata "Penanda" dibuang dari
                layar, bukan dari tombolnya: aria-label tetap menyebutkannya,
                sehingga pembaca layar dan pencarian di dalam halaman masih
                menemukannya. Tombol tanpa nama sama sekali tidak dapat disebut
                oleh siapa pun yang tidak melihatnya.

                Ikonnya menggambarkan PERBUATANNYA, bukan keadaannya - dua anak
                panah yang merapat berarti "ciutkan", yang merenggang berarti
                "bentangkan". Panah tunggal atas/bawah, yang dipakai sebelum
                ini, baru terbaca setelah ada tulisan di sebelahnya; tanpa
                tulisan ia menjadi tebakan. */}
            {modeUrl ? null : (
            <button
              type="button"
              onClick={alihkanSeluruhPenanda}
              aria-expanded={!penandaCiut}
              aria-label={penandaCiut ? "Bentangkan penanda" : "Ciutkan penanda"}
              title={
                penandaCiut
                  ? "Bentangkan keempat kelompok penanda sekaligus"
                  : "Ciutkan keempat kelompok penanda agar daftar sidang lebih panjang - tiap kelompok juga punya saklarnya sendiri"
              }
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/70 bg-muted/40 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {penandaCiut ? (
                <ChevronsUpDown className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ChevronsDownUp className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
            )}

            {ringkasAlur(sidang)
              .filter((k) => k.jumlah > 0 || alurTerpilih === k.kunci)
              .filter((k) => !penandaCiut || alurTerpilih === k.kunci)
              .map((kelompok) => (
                <ChipSaring
                  key={`alur-${kelompok.kunci}`}
                  label={kelompok.label}
                  jumlah={kelompok.jumlah}
                  nada="netral"
                  judul={`Hanya ${kelompok.label}.`}
                  aktif={alurTerpilih === kelompok.kunci}
                  onTekan={() => {
                    setAlurTerpilih(alurTerpilih === kelompok.kunci ? "" : kelompok.kunci);
                    bersihkanSaringan();
                  }}
                />
              ))}

            {/* Pemisah tipis: alur perkara menjawab "perkara apa", keadaan
                menjawab "bagaimana keadaannya". */}
            {penandaCiut ? null : <span aria-hidden className="mx-1 h-5 w-px bg-border" />}

            {/* Kotak gabungan lebih dulu, di luar kelompok mana pun: ia
                daftar pekerjaan, bukan saringan - lihat catatannya pada
                KEADAAN_SIDANG.

                DIGAMBAR WALAU NOL, berbeda dari kotak satuan di belakangnya.
                Sejak papan "Perlu ditindaklanjuti" dihapus (24 September
                2026, diminta pengguna: "fungsi itu sudah ada di perlu
                diperiksa"), kotak inilah satu-satunya yang menjawab "hari ini
                beres atau belum" - dan nol adalah jawaban, bukan ketiadaan
                jawaban. ChipSaring melukis nol dengan redup dan tidak dapat
                ditekan. */}
            {KEADAAN_PERLU_DIPERIKSA.map((keadaan) => (
              <Fragment key={keadaan.kunci}>
                <ChipSaring
                  label={keadaan.label}
                  jumlah={jumlahKeadaan[keadaan.kunci] ?? 0}
                  nada={keadaan.nada}
                  judul={`${keadaan.judul} ${keteranganBatasJam}`}
                  aktif={keadaanTerpilih.includes(keadaan.kunci)}
                  onTekan={() => alihkanKeadaan(keadaan.kunci)}
                />
                {/* Garis kedua: kotak gabungan menjawab "apa pekerjaan saya
                    hari ini", yang di belakangnya menjawab "tunjukkan yang
                    begini". Tanpa pemisah, yang pertama terbaca sebagai
                    salah satu dari yang kedua - dan tidak akan pernah
                    ditekan orang yang sedang mencari pekerjaannya. */}
                {keadaan.kunci === KUNCI_PERLU_DIPERIKSA ? (
                  <span aria-hidden className="mx-1 h-5 w-px bg-border" />
                ) : null}
              </Fragment>
            ))}

            {/* ==========================================================
                KOTAK SATUAN, BERKELOMPOK MENURUT MAKSUDNYA
                ==========================================================

                Panggilan, jalannya sidang, putusan, antrian - tiap kelompok
                menjawab satu pertanyaan dan diberi judul kecil, supaya yang
                membaca tidak perlu menebak "Tidak perlu dipanggil" itu soal
                apa. Di dalam kelompok yang merah lebih dulu. Kelompok yang
                seluruh kotaknya nol tidak digambar sama sekali - judul
                tanpa satu pun kotak di bawahnya hanya membingungkan.

                Sebelumnya lima belas kotak berjajar menurut urutan
                penambahannya, dan yang berkaitan berjauhan: "Tidak perlu
                dipanggil" sembilan kotak dari "Belum dipanggil". */}
            {/* ==========================================================
                SATU PIL PER KELOMPOK - JUDULNYA IKUT MASUK KE DALAMNYA
                ==========================================================

                Bentuk sebelumnya: judul kelompok berdiri sendiri di antara
                garis pemisah, kotaknya berbaris di belakangnya, dan
                seluruhnya membungkus ke baris berikutnya sekehendak lebar
                layar - sehingga "ANTRIAN" dapat berakhir di ujung baris
                pertama sementara kedua kotaknya turun ke baris kedua.

                Sekarang judul dan kotaknya dikurung satu pil. Ia tidak
                pernah terpisah, dan pilnya yang membungkus - bukan isinya.
                Diukur atas deretan yang sungguhnya digambar layar ini,
                tinggi yang benar-benar dipakai:

                    lebar isi   sebelum   sesudah
                      1400 px    68 px     27 px    dua baris menjadi satu
                      1100 px    68 px     57 px
                       820 px   105 px     57 px

                Tidak satu kotak pun dibuang. */}
            {/* ==================================================================
                SATU SAKLAR UNTUK TIAP KELOMPOK
                ==================================================================

                Namanya sendiri yang menjadi tombolnya - tidak ada tombol
                tambahan yang harus dicari, dan tempat yang sudah dipakai label
                itu memang tempat yang dilihat orang ketika mencari kelompoknya.

                Yang diciutkan tetap memajang kotak yang sedang MENYALA, dan
                menyebutkan berapa yang disembunyikan. Saringan yang terlanjur
                aktif lalu hilang dari layar tidak dapat dimatikan lagi:
                daftarnya tampak kehilangan baris tanpa satu pun keterangan.

                Kelompok yang seluruh isinya tersembunyi TETAP digambar - lihat
                jumlah anggota sebelum penciutan di bawah. Membuangnya akan
                membuang saklarnya sendiri, dan kelompok itu tidak akan pernah
                dapat dibentangkan kembali. */}
            {kelompokKeadaanTampak(jumlahKeadaan, keadaanTerpilih).map((kelompok) => {
              const ciut = !modeUrl && kelompokCiut.includes(kelompok.kunci);
              const tampak = ciut
                ? kelompok.anggota.filter((k) => keadaanTerpilih.includes(k.kunci))
                : kelompok.anggota;
              const tersembunyi = kelompok.anggota.length - tampak.length;
              return (
              <span
                key={`kelompok-${kelompok.kunci}`}
                className="inline-flex flex-wrap items-center gap-0.5 rounded-full border border-border/70 bg-muted/40 py-0.5 pl-1 pr-1"
              >
                <button
                  type="button"
                  onClick={() => alihkanKelompokPenanda(kelompok.kunci)}
                  disabled={modeUrl}
                  aria-expanded={!ciut}
                  title={
                    ciut
                      ? `Bentangkan kotak penanda ${kelompok.label}`
                      : `Ciutkan kotak penanda ${kelompok.label}`
                  }
                  className="mr-0.5 inline-flex items-center gap-0.5 rounded-full px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  {modeUrl ? null : ciut ? (
                    <ChevronRight className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                  )}
                  {kelompok.label}
                  {tersembunyi > 0 ? (
                    <span className="font-normal normal-case tracking-normal">
                      +{tersembunyi}
                    </span>
                  ) : null}
                </button>
                {tampak.map((keadaan) => (
                  <ChipSaring
                    key={keadaan.kunci}
                    padat
                    label={keadaan.labelPendek ?? keadaan.label}
                    jumlah={jumlahKeadaan[keadaan.kunci] ?? 0}
                    nada={keadaan.nada}
                    // Label utuhnya tidak hilang - ia dibawa judul gantung,
                    // di depan keterangan panjangnya.
                    judul={
                      keadaan.labelPendek
                        ? `${keadaan.label} — ${keadaan.judul}`
                        : keadaan.judul
                    }
                    aktif={keadaanTerpilih.includes(keadaan.kunci)}
                    onTekan={() => alihkanKeadaan(keadaan.kunci)}
                  />
                ))}
              </span>
              );
            })}
          </div>
        ) : null}

        {/* ==================================================================
            KENDALI DICIUTKAN - "PERLU DIPERIKSA" TETAP TERLIHAT
            ==================================================================

            Menggantikan satu-satunya kelebihan papan "Perlu ditindaklanjuti"
            yang dihapus 24 September 2026: papan itu tetap tampil walau
            kendalinya diciutkan. Yang menciutkan kendali sedang
            memperpanjang daftar, bukan sedang menolak tahu apa yang harus
            diurus hari itu. */}
        {sidang.length > 0 && kendaliCiut ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {KEADAAN_PERLU_DIPERIKSA.map((keadaan) => (
              <ChipSaring
                key={keadaan.kunci}
                label={keadaan.label}
                jumlah={jumlahKeadaan[keadaan.kunci] ?? 0}
                nada={keadaan.nada}
                judul={`${keadaan.judul} ${keteranganBatasJam}`}
                aktif={keadaanTerpilih.includes(keadaan.kunci)}
                onTekan={() => alihkanKeadaan(keadaan.kunci)}
              />
            ))}
          </div>
        ) : null}

        {lanjutTerbuka && sidang.length > 0 && tampil(tampilan, "pencarian-lanjutan") ? (
          <PanelCariLanjut
            medan={MEDAN_CARI_SIDANG}
            isian={cariLanjut.isian}
            onUbah={cariLanjut.ubah}
            onBersihkan={cariLanjut.bersihkan}
            jumlahAktif={cariLanjut.jumlahAktif}
          />
        ) : null}

        {/* Rincian kelompok yang dipilih. Muncul HANYA saat diklik: menampilkan
            rincian seluruh kelompok sekaligus mengembalikan tabel kedua yang
            isinya sama dengan tabel utama. */}
        {alurTerpilih ? (
          <div className="rounded-xl border bg-muted/20 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">
                {KELOMPOK_ALUR.find((k) => k.kunci === alurTerpilih)?.label} —{" "}
                {sidangTerpilih.length} sidang
              </h4>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setAlurTerpilih("");
                  bersihkanSaringan();
                }}
              >
                Tutup
              </Button>
            </div>

            {/* ============================================================
                RINGKASAN KELOMPOK
                ============================================================

                Empat pertanyaan yang ditanya sebelum sidang dimulai: perkara
                apa saja hari ini, berapa yang sidang pertama, siapa memegang
                berapa, dan ruang mana dipakai berapa kali.

                Hanya yang ADA yang disebutkan - daftar berisi belasan jenis
                perkara bernilai nol tidak menolong siapa pun. */}
            <div className="mb-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <KartuRincian
                judul="Jenis perkara"
                baris={rincianJenis}
                aktif={saringJenis}
                onPilih={setSaringJenis}
              />
              <KartuRincian
                judul="Tahap sidang"
                baris={rincianTahap}
                aktif={saringTahap}
                onPilih={setSaringTahap}
              />
              <KartuRincian
                judul="Majelis"
                baris={rincianMajelis}
                aktif={saringMajelis}
                onPilih={setSaringMajelis}
                monospasi
              />
              <KartuRincian
                judul="Ruang sidang"
                baris={rincianRuang}
                aktif={saringRuang}
                onPilih={setSaringRuang}
              />
            </div>

            {/* Penyaring yang sedang berlaku disebutkan terang-terangan.
                Daftar yang menyusut tanpa keterangan terbaca sebagai data yang
                hilang, dan yang dilaporkan kemudian bukan "saya lupa melepas
                saringan" melainkan "perkaranya tidak muncul". */}
            {adaSaringanKartu ? (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
                <span className="font-medium">
                  Disaring: {sidangTersaring.length} dari {sidangTerpilih.length} sidang
                </span>
                {[
                  ["Jenis", saringJenis, setSaringJenis] as const,
                  ["Tahap", saringTahap, setSaringTahap] as const,
                  ["Majelis", saringMajelis, setSaringMajelis] as const,
                  ["Ruang", saringRuang, setSaringRuang] as const,
                ]
                  .filter(([, nilai]) => nilai)
                  .map(([label, nilai, ubah]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => ubah("")}
                      title={`Lepas saringan ${label}`}
                      className="rounded bg-primary/15 px-1.5 py-0.5 text-primary transition hover:bg-primary/25"
                    >
                      {label}: {nilai} &times;
                    </button>
                  ))}
                <button
                  type="button"
                  onClick={bersihkanSaringan}
                  className="ml-auto underline underline-offset-2 hover:text-primary"
                >
                  Lepas semua
                </button>
              </div>
            ) : null}
            {/* ==============================================================
                KISI KARTU DIHAPUS - TABEL DI BAWAH SUDAH MENJADI DAFTARNYA
                ==============================================================

                Panel ini dulu memuat kisi kartu berisi perkara kelompoknya,
                dan itu satu-satunya tempat daftar sealur dapat dilihat -
                tabel utama waktu itu tetap memuat seluruh hari.

                Sejak kotak alur menyaring tabelnya juga, kisi itu menjadi
                salinan: perkara yang sama, keterangan yang sama, hanya
                berbentuk kartu alih-alih baris, dua kali di satu halaman.
                Dua daftar yang isinya sama membuat pembacanya membandingkan
                keduanya untuk mencari beda yang tidak ada - dan yang di atas
                selalu lebih miskin, sebab kartu tidak memuat antrian,
                kesiapan, saksi, maupun hasil sidang.

                Yang TINGGAL di panel ini keempat kartu ringkasan di atas -
                jenis, tahap, majelis, ruang. Itu yang tidak ada di tabel:
                jawaban atas "berapa banyak", bukan pengulangan "yang mana".
                Keempatnya kini menyaring tabel di bawah secara langsung. */}
            <p className="text-sm text-muted-foreground">
              Daftar perkaranya ada di tabel di bawah — ia sudah mengikuti kelompok dan
              keempat penyaring di atas.
            </p>
          </div>
        ) : null}

        {/* Kepala tabel menempel saat digulung: jadwal sehari dapat puluhan
            baris, dan tanpa ini pembaca kehilangan nama kolomnya di tengah. */}
        {/* ==================================================================
            SUSUNAN KOLOM
            ==================================================================

            Diurut menurut apa yang dibaca lebih dulu saat menelusuri jadwal:
            jam, lalu perkara apa, lalu siapa yang menyidangkan, lalu di mana.

            Panitera dan juru sita digabung satu kolom - keduanya "petugas
            sidang", jarang dibaca terpisah, dan memisahkannya memakan lebar
            yang lebih berguna untuk nomor perkara.

            Ukuran huruf mengikuti kepentingan: jam dan nomor perkara paling
            besar, keterangan pendukung lebih kecil. */}
        {/* ==================================================================
            DUA KEDALAMAN, SATU TABEL
            ==================================================================

            RINGKAS untuk menelusuri - jam, perkara, agenda, ruang. Itu yang
            dibaca saat mencari "sidang berikutnya apa" atau saat layarnya
            ditampilkan ke orang banyak.

            LENGKAP untuk memeriksa - ditambah kesiapan, majelis, petugas
            sidang, dan keadaan putusan. Inilah tampilan yang sudah ada, dan ia
            tetap menjadi bawaan supaya tidak ada yang kehilangan kolom yang
            biasa dipakainya tanpa memintanya.

            Yang disembunyikan hanya GAYA-nya, bukan selnya: jumlah sel tiap
            baris tetap sama dengan jumlah kepala kolomnya, sehingga tidak ada
            colSpan yang perlu dihitung ulang di lima tempat. */}
        {/* Hasil pemeriksaan pendaftaran antrian - disebutkan apa adanya
            sebelum apa pun ditulis. */}
        {sinkronHasil ? (
          <div className="mb-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm">
            {sinkronHasil.alasan ? (
              <p className="flex items-start gap-2 text-rose-600">
                <span className="min-w-0 flex-1">{sinkronHasil.alasan}</span>
                <TombolTutupPesan onTutup={() => setSinkronHasil(null)} />
              </p>
            ) : sinkronHasil.ujiKering ? (
              <div className="flex flex-wrap items-center gap-2">
                <span>
                  {sinkronHasil.akanDitambah.length} perkara akan didaftarkan ke antrian
                  {sinkronHasil.dilewati.length > 0
                    ? `, ${sinkronHasil.dilewati.length} sudah terdaftar`
                    : ""}
                  .
                </span>
                {sinkronHasil.akanDitambah.length > 0 ? (
                  <Button size="sm" disabled={sinkronSibuk} onClick={() => void jalankanSinkron(true)}>
                    {sinkronSibuk ? "Mendaftarkan…" : "Daftarkan sekarang"}
                  </Button>
                ) : null}
                <button
                  type="button"
                  className="text-muted-foreground underline"
                  onClick={() => setSinkronHasil(null)}
                >
                  tutup
                </button>
              </div>
            ) : (
              <p className={cn("flex items-start gap-2", sinkronHasil.gagal.length > 0 ? "text-rose-700" : "text-emerald-700")}>
                <span className="min-w-0 flex-1">
                  {sinkronHasil.ditambahkan} perkara didaftarkan ke antrian.
                  {sinkronHasil.gagal.length > 0
                    ? ` ${sinkronHasil.gagal.length} gagal: ${sinkronHasil.gagal[0].sebab}`
                    : ""}{" "}
                  Nomor antriannya baru terbit saat para pihak mengambilnya.
                </span>
                {/* Yang berhasil seluruhnya hilang sendiri; yang ada gagalnya menetap sampai ditutup. */}
                {sinkronHasil.gagal.length > 0 ? <TombolTutupPesan onTutup={() => setSinkronHasil(null)} /> : null}
              </p>
            )}
          </div>
        ) : null}

        {/* Batas tinggi 70vh/82vh dan gulir tegak di dalam kotak sudah DIBUANG
            (28 September 2026) - lihat catatan di atas wadah tabel. Dahulu
            batasnya hanya dari lg ke atas, sebab di ponsel gulir bersarang
            membuat orang tersesat; kini tidak ada gulir bersarang di lebar
            mana pun. */}
        {/* ==================================================================
            PERINGATAN KETIKA "PERKARA SAYA" TIDAK MENGENA SATU BARIS PUN
            ==================================================================

            Tombolnya sendiri sudah pindah ke sudut kanan atas - lihat
            sebabnya di kepala. Yang TIDAK ikut pindah hanya peringatan ini,
            dan itu disengaja.

            Peringatan ini menjelaskan mengapa daftar yang seharusnya
            tersaring justru tampil penuh. Kalau ia hanya menjadi title pada
            tombolnya, ia tidak terlihat tanpa disentuh - dan yang membaca
            daftar penuh akan menyangka seluruh perkara itu miliknya. Itu
            kesimpulan yang salah tentang pekerjaan sendiri, dan tempatnya
            harus di jalan baca, bukan di balik kursor.

            Dua keterangan yang dahulu berdiri di sini - "Disaring atas nama
            X" dan "Seluruh perkara satker" - sudah menjadi title tombolnya:
            keduanya hanya mengulang apa yang sudah dikatakan tombol yang
            sedang menyala. */}
        {currentUser && perkaraSayaAktif && milikSaya.berlaku && !milikSaya.adaYangCocok ? (
          <p className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
            Nama <strong>{currentUser.name}</strong> tidak tercatat sebagai majelis,
            panitera pengganti, atau jurusita pada perkara yang tampil — seluruh perkara
            ditampilkan apa adanya.
          </p>
        ) : null}

        {/* ==================================================================
            BARIS "PERAN ANDA BERHAK MELIHAT SELURUH PERKARA" DIBUANG
            ==================================================================

            Ditambahkan 22 September 2026 pagi, dibuang atas permintaan
            pengguna pada hari yang sama - dan permintaannya benar.

            Ia lahir untuk menjawab keadaan yang sah: peran yang berhak melihat
            seluruh perkara tidak disaring walau tombolnya ditekan, dan
            sesudah keterangan "Disaring atas nama X" menjadi title, tidak ada
            lagi petunjuk di layar.

            Tetapi keadaan itu TETAP - ia berlaku sepanjang hari bagi ketua,
            panitera, dan operator. Baris yang selalu ada bukan lagi
            peringatan; ia menjadi perabot yang dibaca sekali lalu dilewati
            selamanya, sambil memakan satu baris penuh di atas daftar yang
            justru hendak dibaca.

            Keterangannya tidak hilang: title tombol "Perkara saya" tetap
            menyebutkan apa yang sedang disaring. Yang hilang hanya barisnya. */}

        {/* ==================================================================
            LEGENDA TIGA JARAK DIBUANG - ARTINYA PINDAH KE TITLE TIAP PIL
            ==================================================================

            Diminta pengguna 28 September 2026: "hapus tulisan Tiga angka
            waktu di kolom Antrian ...". Paragraf empat baris itu dibaca sekali
            lalu dilewati selamanya, sambil mendorong tabelnya ke bawah. Arti
            tiap angka kini ada di title pilnya sendiri - lihat ARTI di
            components/portal/tiga-jarak-sidang.tsx. */}

        {/* ==================================================================
            SELEBAR KARTUNYA, TANPA GULIR SAMPING, TANPA GULIR TEGAK SENDIRI
            ==================================================================

            Diminta pengguna 28 September 2026, tiga keluhan sekaligus pada
            layar 1920 px: tabelnya punya gulir ke samping, lencana konseptor
            terpotong di tepi kanan, dan "ada yang terlewat di bawah footer -
            seharusnya yang memanjang ke bawah itu antrian sidangnya".

            SEBAB GULIR SAMPING: tabelnya dikunci min-w-[980px], padahal
            kartunya hanya 956 px, dan di dalamnya nama pihak serta nama saksi
            ber-truncate max-w-[24rem] - yang tidak pernah menyempit di dalam
            sel tabel, sebab lebar minimum sel adalah lebar isinya yang tidak
            dapat dipatahkan (terukur: tabel 1.590 px di kartu 956 px). Kini
            dari xl (1280 px) ke atas batas lebarnya dilepas dan isi sel
            MELIPAT, sehingga tabel selebar kartunya. Di bawah xl batas lama
            tetap: kolomnya terlalu sempit untuk dilipat, dan menggulir ke
            samping lebih terbaca daripada kolom selebar satu kata.

            SEBAB "TERLEWAT DI BAWAH FOOTER": wadahnya dibatasi 70vh (82vh
            bila kendali diciutkan) dan menggulir sendiri. Halaman berakhir
            pada footer sementara baris-baris sidang masih tersembunyi di dalam
            kotak - terukur 2.115 px isi di kotak setinggi 754 px. Batas itu
            DIBUANG: tabelnya setinggi isinya, halamanlah yang menggulung, dan
            footer selalu di bawah baris terakhir. Kepala kolom tetap menempel
            di puncak layar selama tabelnya muat - lihat tabelMuat. Pengecualian
            rincian terbuka (sebab (2) pada catatan lebarTampak) ikut hilang,
            sebab tidak ada lagi batas yang perlu dilepas. */}
        {/* Siapa yang sedang disidangkan di tiap ruang - perbaikan 2 Okt
            2026 (butir 10). Ditekan = menggulung ke barisnya. */}
        {ciutkanSelesai && jumlahDiciutkan > 0 ? (
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-ciutkan-selesai="">
            {jumlahDiciutkan} perkara yang sudah selesai diciutkan - yang tampil hanya yang berjalan dan belum selesai.
            <button
              type="button"
              className="underline underline-offset-2 hover:text-foreground"
              onClick={() => ubahSaklar("ciutkan-selesai", false)}
            >
              Tampilkan semua
            </button>
          </p>
        ) : null}
        {/* JADWAL-3 butir 3 (19 Okt 2026): SATU pita ruang sidang - kartu
            ruang ("kartu-ruang": jumlah, perlu diperiksa, saring) dan
            ringkasan ruang ("ringkasan-ruang": yang sedang disidang, diskors)
            menyatu dalam satu baris setinggi ±36 px. Rancangan dan alasannya:
            docs/rancangan/ruang-sidang-ringkas.html (pilihan A). */}
        {tampil(tampilan, "ringkasan-ruang") || tampil(tampilan, "kartu-ruang") || tampil(tampilan, "saring-ruang") || adaSaklarKeliling ? (
          <PitaRuangSidang
            awal={
              adaSaklarKeliling ? (
                <SaklarSidangKeliling ringkas kh={kh} daftar={sidang} penggunaId={String(currentUser?.id ?? "")} />
              ) : undefined
            }
            pil={pitaRuang}
            tampilJumlah={tampil(tampilan, "kartu-ruang")}
            tampilBerjalan={tampil(tampilan, "ringkasan-ruang")}
            diskors={diskorsHariIni}
            nomorPerkara={(k) => bahanTigaJarak.nomorPerkara[k] ?? ""}
            ruangPilihan={ruangSaring}
            onPilih={tampil(tampilan, "saring-ruang") || tampil(tampilan, "kartu-ruang") ? setRuangDipilih : undefined}
            keteranganPerlu={keteranganPerluKartu}
            sekarangMs={() => (patokanWaktu ? patokanWaktu.sekarangMs + (Date.now() - patokanWaktu.diterimaMs) : Date.now())}
            onLihat={(k) => {
              const el = Array.from(document.querySelectorAll<HTMLElement>("[data-kunci-waktu]")).find(
                (x) => x.dataset.kunciWaktu === k
              );
              el?.scrollIntoView({ block: "center", behavior: "smooth" });
            }}
          />
        ) : null}

        <div
          ref={kotakTabel}
          data-tabel-muat={tabelMuat ? "ya" : "tidak"}
          className={cn("rounded-xl border", tabelMuat ? "overflow-visible" : "overflow-x-auto")}
        >
          <table
            className={cn(
              "w-full text-sm",
              modeRingkas
                ? "min-w-[640px] xl:min-w-0 [&_.kolom-lengkap]:hidden"
                : "min-w-[980px] xl:min-w-0 [&_.hanya-ringkas]:hidden"
            )}
          >
            {/* Sudut atas kepala kolom ikut membulat: selama tabelnya muat,
                wadahnya tidak lagi memotong isinya, dan latar bg-muted yang
                bersudut siku akan menyembul keluar dari garis rounded-xl. */}
            <thead className="sticky top-0 z-10 bg-muted text-left text-sm uppercase tracking-wide shadow-sm [&_th:first-child]:rounded-tl-xl [&_th:last-child]:rounded-tr-xl">
              {/* Tiap kepala dapat ditekan: naik, turun, lalu kembali ke
                  urutan asal. Putaran ketiga penting - tanpa jalan kembali,
                  satu tekanan yang tidak disengaja mengunci tabelnya, dan
                  satu-satunya cara pulih adalah memuat ulang halaman. */}
              <tr>
                <th className="px-2 py-2 text-right font-medium">No</th>
                {/* Kepalanya ikut saklarnya, sama seperti selnya dan
                    tombolnya. Sebelumnya hanya sel dan tombolnya yang dijaga,
                    sehingga mematikan skor meninggalkan kolom berkepala "Siap"
                    yang selalu kosong - memakan lebar, menawarkan pengurutan
                    atas angka yang tidak ada, dan tanpa tombol pemulih sebab
                    tombolnya sudah ikut hilang.

                    Selnya TETAP digambar kosong - lihat catatannya di sana:
                    jumlah sel tiap baris harus sama dengan jumlah kepala
                    kolomnya, jadi kepala dan sel harus hilang BERSAMA. */}
                {tampil(tampilan, "kolom-siap") ? (
                  <KepalaUrut
                    kunci="siap"
                    urutan={urutTabel}
                    onTekan={tekanUrut}
                    className="px-2 kolom-lengkap"
                    rata="tengah"
                    judul="Urutkan menurut skor kesiapan sidang"
                  >
                    Siap
                  </KepalaUrut>
                ) : null}
                <KepalaUrut
                  kunci="antrian"
                  urutan={urutTabel}
                  onTekan={tekanUrut}
                  className="max-w-[12rem] px-2"
                  judul="Urutkan menurut nomor antrian; yang belum mengambil dan yang tanpa antrian jatuh ke bawah"
                >
                  Antrian / Jam
                </KepalaUrut>
                <KepalaUrut className="px-2" kunci="perkara" urutan={urutTabel} onTekan={tekanUrut}>
                  Perkara &amp; Para Pihak
                </KepalaUrut>
                <KepalaUrut className={cn("px-2", LEBAR_KOLOM_AGENDA)} kunci="agenda" urutan={urutTabel} onTekan={tekanUrut}>
                  Agenda
                </KepalaUrut>
                {/* ==============================================================
                    TIGA KOLOM DISATUKAN MENJADI SATU
                    ==============================================================

                    Majelis, Petugas Sidang, dan Ruang dulu berdiri sendiri-
                    sendiri. Ketiganya menjawab satu pertanyaan yang sama -
                    SIAPA yang menyidangkan, dan DI MANA - dan memisahkannya
                    justru memakan tempat, bukan memberi kejelasan:

                      Majelis  nama hakimnya terpotong elipsis karena sempit
                      Petugas  "Unun Fidiyasari Patangai, S.H." membungkus
                               menjadi empat baris, dan seluruh baris tabel
                               ikut meninggi karenanya
                      Ruang    "Ruang Sidang 1 Dalam Gedung" membungkus
                               menjadi empat baris untuk satu keterangan yang
                               sama pada hampir seluruh perkara hari itu

                    Disatukan, ketiganya muat dalam satu kolom lebar tanpa
                    membungkus, dan tabel kehilangan dua kolom - itulah ruang
                    yang selama ini dicari Perkara dan Agenda.

                    Diurutkan menurut majelis, sebab itulah yang dicari orang
                    ketika menekan kepala kolom ini.

                    6 Okt 2026: "satu kolom lebar" itu kebablasan - tata letak
                    tabel otomatis memberinya ±430px (nama tiga hakim + "PP ...
                    · JS ..." dalam satu baris), dan Perkara/Agenda kembali
                    tersempitkan. Dibatasi LEBAR_KOLOM_MAJELIS pada kepala DAN
                    sel (pola yang sama dengan Antrian / Jam): namanya melipat,
                    tidak ada yang dipotong. */}
                <KepalaUrut className={cn("px-2 kolom-lengkap", LEBAR_KOLOM_MAJELIS)} kunci="majelis" urutan={urutTabel} onTekan={tekanUrut}>
                  Majelis &amp; Petugas
                </KepalaUrut>
                <KepalaUrut
                  kunci="putusan"
                  className="px-2 kolom-lengkap"
                  urutan={urutTabel}
                  onTekan={tekanUrut}
                  judul="Urutkan menurut tanggal putusan; yang belum putus jatuh ke bawah"
                >
                  Putusan
                </KepalaUrut>
                <th className="px-2 py-2 text-right font-medium">
                  <span className="sr-only">Rincian</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Hanya muatan PERTAMA yang boleh mengosongkan tabel - lihat
                  catatan panjang pada pertamaMuat. Penyegaran berikutnya
                  membiarkan barisnya terpasang, dan posisi gulir pembacanya
                  tidak bergerak. */}
              {pertamaMuat && memuat ? (
                // JADWAL-3 butir 5: tanpa tulisan memuat - ruangnya saja yang
                // dipesan, supaya baris sidang tidak membuat halaman melompat.
                <tr aria-busy="true" data-tabel-menunggu="">
                  <td className="h-40 px-3 py-6" colSpan={kolomTabel} />
                </tr>
              ) : sidangTampil.length === 0 && sidang.length > 0 ? (
                <tr>
                  <td className="px-3 py-10 text-center" colSpan={kolomTabel}>
                    <p className="text-sm font-medium">
                      Tidak ada sidang yang cocok dengan saringan ini.
                    </p>
                    {/* Bedanya penting: hari yang memang kosong menyuruh
                        pindah tanggal, sedangkan hasil yang tersaring habis
                        menyuruh melonggarkan saringannya. Menyamakan keduanya
                        membuat orang mencari di tanggal lain padahal
                        perkaranya ada di depan mata. */}
                    <p className="mt-1 text-sm text-muted-foreground">
                      {sidang.length} perkara pada rentang ini tidak satu pun cocok. Longgarkan
                      saringannya, atau tekan Reset.
                    </p>
                    {/* Memakai reset PENUH - dan justru di sini bedanya paling
                        menentukan. Tombol lama hanya melepas sebagian, sehingga
                        menekannya pada keadaan kosong dapat tetap menghasilkan
                        daftar kosong: alur perkara dan keempat penyaring kartu
                        tidak ikut dilepas. Tombol pemulih yang tidak memulihkan
                        apa pun adalah jalan buntu yang tampak seperti jalan. */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      onClick={resetSemuaSaringan}
                    >
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                      Reset ke {sidang.length} perkara
                    </Button>
                  </td>
                </tr>
              ) : sidang.length === 0 ? (
                <tr>
                  <td className="px-3 py-10 text-center" colSpan={kolomTabel}>
                    <CalendarDays className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm font-medium">Tidak ada sidang pada tanggal ini.</p>
                    {/* Keadaan kosong yang menawarkan langkah berikutnya, bukan
                        sekadar memberitahu bahwa tidak ada apa-apa. */}
                    <p className="mt-1 text-sm text-muted-foreground">
                      Coba hari lain lewat panah, atau buka Kalender sidang untuk
                      melihat hari mana saja yang ada sidangnya.
                    </p>
                  </td>
                </tr>
              ) : (
                sidangTampil.map((baris, urutan) => {
                  const kunci = `${baris.nomorPerkara}|${baris.sidangId}`;
                  // K13: fungsi pemicu dibaca dari `alat` (fungsi asli bila tabel ringan mati; pembungkus
                  // stabil bila menyala). Nama yang sama sengaja dipakai supaya isi baris tidak berubah.
                  const { onBukaStatus, onBukaTunda, muatTanggal, muatTunjukan, muatKeterangan, segarkanRingan, infoRuangSidang, sebutTetangga, buka } = alat;
                  const tandaSelesai = { ...tandaSelesaiHook, muatUlang: alat.muatUlang };
                  const saksiLipat = { ...saksiLipatHook, alih: alat.alihSaksi };
                  const tarikBelumUpload = { ...tarikBelumUploadHook, tarik: alat.tarikBelumUpload };
                  // Dihitung SEKALI di sini, lalu dipakai barisnya dan sel
                  // antriannya. Lihat sidangSelesaiHariIni: ia juga membaca
                  // hasil sidang, sehingga perkara yang sudah diputus menurut
                  // catatan ruang sidang ikut bertanda walau putusannya belum
                  // dituliskan ke perkara_putusan.
                  const sidangSelesai = sidangSelesaiHariIni(baris);
                  // Hijau baris = hasil sidang tercatat ATAU ditandai Selesai
                  // (ALETA / antrian). sidangSelesai sendiri TIDAK diperluas:
                  // ia juga menyembunyikan tombol tunda|putus, dan sidang yang
                  // ditandai selesai tetap harus dapat dicatat hasilnya.
                  const selesaiTanda = keadaanSelesai(baris, sidangSelesai, tandaSelesai.peta);
                  const kunciTiga = kunciWaktu(baris.tanggalSidang, baris.perkaraId);
                  const tigaBaris = tigaJarak[kunciTiga];
                  // Butir 10 (2 Okt 2026): sedang disidangkan / diskors.
                  const berjalanIni = ruangSidang.berjalan[kunciTiga] ?? null;
                  const skorsIni = skorsUntuk(tandaSelesai.skors, baris, ruangSidang.penandaPerKunci[kunciTiga]);
                  const ruangIni = ruangSidang.ruangPerKunci[kunciTiga];
                  const bisaDipanggilIni = bisaDipanggilHariIni(baris);
                  const aksiRuang = aksiRuangSidang({
                    hijau: selesaiTanda.hijau,
                    berjalan: berjalanIni,
                    skors: skorsIni,
                    berjalanDiRuang: ruangIni ? ruangSidang.perRuang[ruangIni] : null,
                    bisaDipanggil: bisaDipanggilIni,
                    // Tanda manual hanya untuk sidang HARI INI.
                    bisaTandai: Boolean(waktuAntrian.hariIni) && baris.tanggalSidang === waktuAntrian.hariIni,
                  });
                  // Butir 33/36 (5 Okt 2026): nama petugas & pihak dapat diklik untuk dipanggil.
                  // Tampilan lewat alamat: nama tidak dapat ditekan untuk memanggil (perkaraId kosong = teks biasa).
                  const konteksPanggil = { perkaraId: modeUrl ? "" : String(baris.perkaraId), tanggal: baris.tanggalSidang.slice(0, 10), nomorPerkara: baris.nomorPerkara, ruang: baris.ruangan, agenda: baris.agenda };
                  /* === 12OKT-C: mediator di Majelis & Petugas (butir 6) === */
                  const mediatorIni = tampil(tampilan, "mediator-majelis") ? mediatorBaris(baris) : "";
                  /* === AKHIR 12OKT-C === */
                  const gambarBaris = () => (
                    <Fragment key={kunci}>
                      {/* ==================================================
                          BARISNYA TIDAK DAPAT DITEKAN - HANYA TOMBOL RINCIAN
                          ==================================================

                          Seluruh baris dulu membuka rincian di mana pun
                          ditekan. Itu bertabrakan dengan isinya sendiri: di
                          dalam baris ada tombol Antrian, tautan nomor perkara,
                          dan penanda bertitel - dan menekan yang meleset
                          sedikit saja membuka rincian yang tidak diminta,
                          menggeser seluruh daftar di bawahnya.

                          Sekarang satu-satunya yang membuka adalah tombol
                          Rincian di ujung kanan. Ia menyebutkan dirinya, arah
                          panahnya menyatakan terbuka atau tidak, dan tempatnya
                          tetap pada tiap baris. */}
                      <tr
                        className={cn(
                          "border-t border-border transition",
                          dibuka === kunci
                            ? "bg-primary/10"
                            : urutan % 2 === 1
                              ? "bg-muted/20 hover:bg-muted/50"
                              : "hover:bg-muted/50",
                          // ================================================
                          // SELURUH BARIS YANG DITANDAI, BUKAN ANGKANYA SAJA
                          // ================================================
                          //
                          // Dahulu tandanya hanya kotak kecil di sekeliling
                          // angka antrian - dan angka itu sendiri hanya
                          // berbeda RONA, tidak berbeda terang. Pada daftar
                          // sembilan belas baris, yang dicari mata adalah
                          // "mana yang belum", dan itu pertanyaan tentang
                          // BARIS, bukan tentang satu angka di dalamnya.
                          //
                          // Garis kiri 4 piksel dipilih sebab ia terbaca tanpa
                          // bergantung pada warna: tebalnya sendiri sudah
                          // isyarat, dan pada tema gelap kontrasnya 9,12:1.
                          warnaBaris &&
                            selesaiTanda.hijau &&
                            dibuka !== kunci &&
                            "border-l-4 border-l-emerald-500 bg-emerald-500/[0.07] dark:border-l-emerald-400",
                          // SEDANG DISIDANGKAN (butir 10) - garis kiri biru
                          // dan bingkai; tidak pernah bersamaan dengan hijau
                          // (yang selesai tidak berjalan). Tetap tampak saat
                          // rinciannya terbuka.
                          warnaBaris &&
                            berjalanIni &&
                            "border-l-4 border-l-sky-500 bg-sky-500/[0.09] outline outline-2 -outline-offset-2 outline-sky-500/50 dark:border-l-sky-400",
                          warnaBaris &&
                            skorsIni &&
                            !berjalanIni &&
                            dibuka !== kunci &&
                            "border-l-4 border-l-amber-500 bg-amber-500/[0.06] dark:border-l-amber-400"
                        )}
                        data-kunci-waktu={kunciTiga}
                        data-sedang-berjalan={berjalanIni ? "ya" : undefined}
                      >
                        {/* Nomor urut, bukan nomor perkara: yang dijawab
                            adalah "hari ini ada berapa sidang". */}
                        <td className="px-2 py-2 text-right text-sm tabular-nums text-muted-foreground">
                          {urutan + 1}
                        </td>
                        {/* Sel DAN kepalanya hilang bersama-sama - lihat
                            catatan pada kepala "Siap".

                            Membuang selnya saja akan menggeser seluruh kolom
                            di kanannya; membuang kepalanya saja meninggalkan
                            kolom kosong yang tidak dapat dipulihkan. Keduanya
                            dijaga saklar yang SAMA, jadi jumlah sel tiap baris
                            tetap sama dengan jumlah kepala kolomnya. */}
                        {tampil(tampilan, "kolom-siap") ? (
                          <td className="px-2 py-2 text-center kolom-lengkap">
                            <LencanaKesiapan
                              nilai={nilaiKesiapan ? kesiapan[kunci] : undefined}
                              diminta={nilaiKesiapan}
                            />
                          </td>
                        ) : null}
                        {/* max-w-[12rem]: lencana "Tunggu / Dari sebelumnya / Lama" berada di wadah
                            yang boleh membungkus, tetapi lebar IDEAL wadah itu = semua lencana dijajar
                            satu baris (~330px). Tabel yang melebar otomatis membagi ruang menurut
                            lebar ideal, jadi kolom ini yang sudah terisi merebut ruang dari "Perkara &
                            Para Pihak" - kolom utama. Batas ini hanya mengikat yang sudah terisi: yang
                            belum mengambil nomor tetap sesempit isinya. */}
                        <td className="max-w-[12rem] px-2 py-2 align-top">
                          <SelAntrianJam
                            baris={baris}
                            antrian={antrianUntuk(antrian.peta, baris)}
                            tanggalTampil={dari}
                            sidangSelesai={sidangSelesai}
                            tampilMenunggu={tampil(tampilan, "menunggu-lama")}
                            tampilRincianAntrian={tampil(tampilan, "rincian-antrian")}
                            tampilTandaOnline={tampil(tampilan, "tanda-antrian-online")}
                            tampilJamPanggil={tampil(tampilan, "jam-dipanggil")}
                            tungguBerjalan={tigaBaris?.tunggu}
                            patokan={patokanWaktu}
                          />
                          {/* F3.2: "Penggugat hadir 08.47 · Tergugat belum · Saksi P 1/2" */}
                          {tampil(tampilan, "kehadiran-rinci") ? (
                            <RingkasKehadiran
                              potongan={ringkasKehadiran(
                                susunKehadiran(
                                  antrian.kehadiran?.[kunciKehadiran(baris.perkaraId, baris.tanggalSidang)]?.hadir,
                                  antrianUntuk(antrian.peta, baris)
                                ),
                                bahanKehadiranDariBaris(baris)
                              )}
                            />
                          ) : null}
                          {tampil(tampilan, "sedang-berjalan") && berjalanIni ? <LencanaSedangBerjalan berjalan={berjalanIni} /> : null}
                          {tampil(tampilan, "sedang-berjalan") && skorsIni && !berjalanIni ? <LencanaDiskors catatan={skorsIni} /> : null}

                          {/* Pengambilan antrian dari sisi PETUGAS, di kolom
                              yang memang sudah memuat nomornya. Sebelumnya
                              satu-satunya cara mengambil adalah layar sentuh di
                              ruang tunggu - dan yang datang menghadap meja
                              pelayanan tidak terlayani sama sekali. */}
                          {tampil(tampilan, "ambil-antrian") ? (
                            <div className="mt-1">
                              <TombolAmbilAntrian
                                baris={baris}
                                kehadiran={antrian.kehadiran?.[kunciKehadiran(baris.perkaraId, baris.tanggalSidang)]?.hadir}
                                antrian={antrianUntuk(antrian.peta, baris)}
                                sudahAda={antrianUntuk(antrian.peta, baris)?.nomor}
                                onSelesai={() => void muatTanggal(dari, sampai, nilaiKesiapan)}
                              />
                            </div>
                          ) : null}

                          {/* ==============================================
                              TIGA JARAK WAKTU - TUNGGU, DARI SEBELUMNYA,
                              LAMA SIDANG
                              ==============================================

                              Yang ditanyakan orang di ruang tunggu satu:
                              "kira-kira giliran saya jam berapa". Jadwal
                              menjawabnya "09:00" untuk hampir seluruh perkara
                              hari itu, dan jawaban itu tidak pernah benar
                              untuk perkara nomor dua belas.

                              Jarak yang SUDAH terjadi hari itu menjawabnya -
                              kini tiga, bernama, berdetik (27 September 2026).
                              Warna "Dari sebelumnya" dan "Lama sidang" menurut
                              sebaran terukur satker (@/lib/jarak-antar-sidang);
                              warna "Tunggu" menurut AMBANG_MENUNGGU_MENIT.

                              Perkara pertama di ruangnya tidak punya jarak
                              sebelumnya, dan tidak diberi nol: nol berarti
                              dipanggil bersamaan dengan yang sebelumnya. */}
                          {tampil(tampilan, "jarak-sidang") ? (
                            <TigaJarakSidang
                              tiga={tigaBaris}
                              baris={barisWaktuPerKunci[kunciTiga]}
                              patokan={patokanWaktu}
                              ambangTungguMenit={AMBANG_MENUNGGU_MENIT}
                              sebutTetangga={(tetangga) => sebutTetangga(tetangga, baris.tanggalSidang)}
                              nomorRekaman={
                                antrianUntuk(antrian.peta, baris)
                                  ? null
                                  : barisWaktuPerKunci[kunciTiga]?.nomorAntrian ?? null
                              }
                            />
                          ) : null}
                        </td>
                        <td className="px-2 py-2 align-top">
                          {/* ==================================================
                              NOMORNYA MEMBUKA STATUS PERKARA
                              ==================================================

                              Jalan itu dulu hanya ada di kisi kartu dalam panel
                              alur - satu tempat yang baru terlihat sesudah
                              menekan kotak alur, dan hilang bersama kisinya.
                              Tempatnya yang wajar justru di sini: nomor perkara
                              adalah yang pertama dicari mata dan yang pertama
                              hendak dibuka orang.

                              Tetap span biasa bila halaman induknya tidak
                              menyediakan jalan ke status perkara - tombol yang
                              tidak mengerjakan apa pun lebih buruk daripada
                              tulisan biasa. */}
                          {onBukaTunda ? (
                            <button
                              type="button"
                              onClick={() =>
                                onBukaTunda({ nomorPerkara: baris.nomorPerkara, sidangId: baris.sidangId })
                              }
                              title={`Tunda atau putus sidang ${baris.nomorPerkara}`}
                              className="text-left text-[0.95rem] font-extrabold tracking-tight underline decoration-transparent underline-offset-2 transition hover:decoration-primary hover:text-primary"
                            >
                              <NomorBolehPatah nomor={baris.nomorPerkara} />
                            </button>
                          ) : onBukaStatus ? (
                            <button
                              type="button"
                              onClick={() => onBukaStatus(baris.nomorPerkara)}
                              title={`Buka status perkara ${baris.nomorPerkara}`}
                              className="text-left text-[0.95rem] font-extrabold tracking-tight underline decoration-transparent underline-offset-2 transition hover:decoration-primary hover:text-primary"
                            >
                              <NomorBolehPatah nomor={baris.nomorPerkara} />
                            </button>
                          ) : (
                            <span className="text-[0.95rem] font-extrabold tracking-tight">
                              <NomorBolehPatah nomor={baris.nomorPerkara} />
                            </span>
                          )}
                          {/* ==================================================
                              VERZET DITANDAI DI SAMPING NOMORNYA
                              ==================================================

                              Verzet adalah perlawanan TERHADAP putusan verstek,
                              bukan perkara biasa: tenggangnya berbeda, dan yang
                              melawan justru pihak yang semula tergugat. Yang
                              membaca jadwal harus tahu itu sebelum memanggil,
                              bukan sesudah membuka rinciannya.

                              Merah - bukan karena buruk, melainkan karena ia
                              menuntut perlakuan yang berbeda dari perkara di
                              sekitarnya, dan itulah arti merah di layar ini. */}
                          {tampil(tampilan, "penanda-verzet") && perkaraVerzetDari(baris.jenisPerkara) ? (
                            <Badge
                              variant="danger"
                              className="ml-2 align-middle"
                              title="Perkara perlawanan terhadap putusan verstek."
                            >
                              verzet
                            </Badge>
                          ) : null}
                          {/* === 12OKT-B: Ghaib / Prodeo / Non e-Court di samping nomor === */}
                          <LencanaPerkaraBaris baris={baris} aktif={aktifPenandaPerkara} className="ml-2 align-middle" />
                          {/* === AKHIR 12OKT-B === */}
                          {/* Penanda panggilan tepat di samping nomor perkara:
                              itulah yang dicari mata saat menelusuri jadwal. */}
                          <span className="ml-2 inline-flex gap-1 align-middle">
                            <PenandaPanggilan panggilan={baris.panggilan} />
                            {/* Butir 30: verifikasi majelis e-Litigasi hari ini. */}
                            {tampil(tampilan, "verifikasi-majelis") ? (
                              <LencanaVerifikasiMajelis
                                penanda={penandaVerifikasi(baris, verifikasi, hariIni())}
                                tarikan={tarikBelumUpload.keadaanUntuk(baris.nomorPerkara)}
                                onTarik={
                                  tampil(tampilan, "tarik-belum-upload")
                                    ? () => void tarikBelumUpload.tarik(baris)
                                    : undefined
                                }
                              />
                            ) : null}
                            {/* Butir 21 (6 Okt 2026): Court Calendar tidak sinkron - merah.
                                Saklarnya WAJIB (merah = menuntut tindakan), jadi
                                tidak melewati tampil() - lihat SAKLAR_WAJIB. */}
                            <LencanaCourtCalendarSinkron baris={baris} />
                          </span>
                          {/* ==================================================
                              PENGGUGAT DAN TERGUGAT DIPISAH, BUKAN "A LAWAN B"
                              ==================================================

                              Dulu satu baris terpotong: "Karmila binti Bustamin
                              lawan Andika Rafliando bin S…". Pada nama panjang -
                              dan nama di sini hampir selalu panjang - yang
                              terpotong justru nama TERGUGAT, sehingga sisi yang
                              paling sering perlu dipanggil ulang tidak terbaca.

                              Dipisah dua baris berlabel P dan T. Labelnya sama
                              dengan yang dipakai penanda antrian dan penanda
                              saksi di bawahnya, sehingga ketiganya terbaca
                              sebagai satu bahasa - bukan tiga singkatan yang
                              kebetulan mirip.

                              Bila pihaknya lebih dari satu, SELURUH namanya
                              disebut dan dipisah koma. Sejak 28 September 2026
                              namanya MELIPAT, tidak lagi dipotong truncate
                              max-w-[24rem]: truncate di dalam sel tabel tidak
                              pernah menyempit - ia memaksa kolomnya selebar
                              24rem dan itulah salah satu sebab tabelnya
                              bergulir ke samping. Title-nya tetap ada.

                              Penanda "+2" yang sempat dipakai sudah DIHAPUS. Ia
                              menimbulkan pertanyaan alih-alih menjawabnya, dan
                              angkanya pun keliru: saksi ikut terhitung sebagai
                              penggugat, sehingga hampir setiap perkara tampak
                              berpenggugat tiga orang. */}
                          {baris.pihak.penggugat.length > 0 ||
                          baris.pihak.tergugat.length > 0 ||
                          (baris.pihak.turutTergugat ?? []).length > 0 ||
                          (baris.pihak.intervensi ?? []).length > 0 ? (
                            <div className="mt-0.5 space-y-0.5 text-sm text-muted-foreground">
                              {baris.pihak.penggugat.length > 0 ? (
                                <div
                                  className="break-words"
                                  title={baris.pihak.penggugat.join(", ")}
                                >
                                  <span className="font-medium text-foreground/70">P:</span>{" "}
                                  <NamaPihakHadir aktif={aktifPihakHadir} hadir={hadirIni(baris).pihak1}>{/* 12OKT-H */}<NamaDapatDipanggil golongan="pihak1" {...konteksPanggil}>{baris.pihak.penggugat.join(", ")}</NamaDapatDipanggil></NamaPihakHadir>
                                  <LencanaPekerjaanBaris baris={baris} nama={baris.pihak.penggugat} aktif={aktifPenandaPekerjaan} />{/* 12OKT-B */}
                                </div>
                              ) : null}
                              {pihakTampil(baris.pihak).tergugat.length > 0 ? (
                                <div
                                  className="break-words"
                                  title={pihakTampil(baris.pihak).tergugat.join(", ")}
                                >
                                  <span className="font-medium text-foreground/70">T:</span>{" "}
                                  <NamaPihakHadir aktif={aktifPihakHadir} hadir={hadirIni(baris).pihak2}>{/* 12OKT-H */}<NamaDapatDipanggil golongan="pihak2" {...konteksPanggil}>{pihakTampil(baris.pihak).tergugat.join(", ")}</NamaDapatDipanggil></NamaPihakHadir>
                                  <LencanaPekerjaanBaris baris={baris} nama={pihakTampil(baris.pihak).tergugat} aktif={aktifPenandaPekerjaan} />{/* 12OKT-B */}
                                </div>
                              ) : null}
                              {/* Butir 23 (6 Okt 2026): turut tergugat dan
                                  intervensi di bawah P dan T, dapat diklik
                                  (WhatsApp) seperti pihak lain. */}
                              {tampil(tampilan, "pihak-turut-intervensi") && (baris.pihak.turutTergugat ?? []).length > 0 ? (
                                <div className="break-words" title={`Turut Tergugat: ${(baris.pihak.turutTergugat ?? []).join(", ")}`} data-pihak-turut="">
                                  <span className="font-medium text-foreground/70">Turut T:</span>{" "}
                                  <NamaDapatDipanggil golongan="pihak4" {...konteksPanggil}>{(baris.pihak.turutTergugat ?? []).join(", ")}</NamaDapatDipanggil>
                                  <LencanaPekerjaanBaris baris={baris} nama={baris.pihak.turutTergugat ?? []} aktif={aktifPenandaPekerjaan} />{/* 12OKT-B */}
                                </div>
                              ) : null}
                              {tampil(tampilan, "pihak-turut-intervensi") && (baris.pihak.intervensi ?? []).length > 0 ? (
                                <div className="break-words" title={`Intervensi: ${(baris.pihak.intervensi ?? []).join(", ")}`} data-pihak-intervensi="">
                                  <span className="font-medium text-foreground/70">Int:</span>{" "}
                                  <NamaDapatDipanggil golongan="pihak3" {...konteksPanggil}>{(baris.pihak.intervensi ?? []).join(", ")}</NamaDapatDipanggil>
                                  <LencanaPekerjaanBaris baris={baris} nama={baris.pihak.intervensi ?? []} aktif={aktifPenandaPekerjaan} />{/* 12OKT-B */}
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                          {/* ==================================================
                              JENIS PERKARA, DAN TUNDA/PUTUS DI SAMPINGNYA
                              ==================================================

                              Jenis perkara kini di bawah nomornya - keduanya
                              menjawab pertanyaan yang sama, "perkara apa ini",
                              dan memisahkannya jadi dua kolom hanya memaksa
                              mata bolak-balik.

                              Ditebalkan: "Cerai Gugat" dan "Cerai Talak"
                              menentukan jalan perkaranya sama sekali - siapa
                              yang memohon, apakah ada ikrar talak - dan
                              sebelumnya ia sekelabu nama pihak di atasnya.

                              TUNDA DAN PUTUS PINDAH KE SINI, dari kiri nomor
                              perkara. Diminta pengguna 22 September 2026.

                              Di kiri nomor, keduanya berdiri di tempat yang
                              paling dahulu dibaca mata - sehingga yang pertama
                              terbaca pada tiap baris bukan perkaranya,
                              melainkan dua tombol yang bentuknya sama persis
                              pada dua puluh tujuh baris. Nomor perkara, satu-
                              satunya hal yang membedakan baris, terdorong ke
                              kanan dan tidak lagi berbaris lurus ke bawah
                              sebab panjang penandanya berbeda-beda.

                              Di samping jenis perkara, bukan di ujung barisnya
                              sendiri: jenis perkara menentukan apa yang akan
                              dicatat. Cerai Talak yang ditunda berbeda
                              akibatnya dari Cerai Gugat yang ditunda - yang
                              pertama masih menunggu ikrar. Bersebelahan,
                              keduanya terbaca sekali pandang.

                              Disembunyikan pada sidang yang hasilnya SUDAH
                              tercatat: menuliskan penundaan kedua atas sidang
                              yang sudah diputus menambah baris jadwal yang
                              tidak pernah disidangkan. */}
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-sm font-extrabold text-foreground/90">
                              {/* === 12OKT-A: kumulasi perkara === */}
                              {!tampil(tampilan, "kumulasi-perkara") ? (
                                <>{baris.jenisPerkara || "—"}</>
                              ) : (
                                <JenisDenganKumulasi jenis={baris.jenisPerkara} kumulasi={baris.kumulasi} />
                              )}
                              {/* === AKHIR 12OKT-A === */}
                            </span>
                            {/* ================================================
                                BELUM DITUNDA - MERAH, SEJAK PUKUL 15:00 WITA
                                ================================================

                                Diminta pengguna 24 September 2026. Berdiri di
                                depan tombol tunda|putus: yang membacanya
                                langsung melihat alat untuk membereskannya.

                                Aturannya belumTundaLewatBatas di lib - fungsi
                                yang sama dengan yang menambah angka Perlu
                                diperiksa, sehingga yang tersaring selalu yang
                                bertanda. Merah karena ia anggota kotak merah;
                                saklar Tampilan-nya wajib, sama seperti retur.
                                Tidak pernah muncul bersama garis hijau "sidang
                                selesai": keduanya saling meniadakan menurut
                                aturannya. */}
                            {belumTundaLewatBatas(baris, saat) ? (
                              <span
                                className="inline-flex items-center rounded-full border border-rose-500 bg-rose-100 px-1.5 py-0.5 text-[11px] font-semibold text-rose-800 dark:border-rose-400 dark:bg-rose-950 dark:text-rose-200"
                                title={
                                  baris.tanggalSidang < saat.tanggal
                                    ? `Sidang ${tanggalHariPanjang(baris.tanggalSidang)} sampai sekarang belum dicatat hasilnya - belum ditunda, belum diputus, dan kolom hasil sidangnya di SIPP masih kosong. Tanpa itu agenda sidang berikutnya tidak terbentuk.`
                                    : `Sudah lewat pukul ${JAM_BATAS_HASIL_SIDANG.slice(0, 5)} WITA dan hasil sidang ini belum dicatat - belum ditunda, belum diputus, dan kolom hasil sidangnya di SIPP masih kosong. ${
                                        // Tombolnya dapat disembunyikan saklar
                                        // Tampilan; tanda ini tidak.
                                        tampil(tampilan, "tombol-tunda-putus")
                                          ? "Catat lewat tombol tunda atau putus di sebelahnya."
                                          : "Catat di SIPP, atau nyalakan Tombol tunda | putus di menu Tampilan."
                                      }`
                                }
                              >
                                Belum ditunda
                              </span>
                            ) : null}
                            {sidangSelesai ? null : (
                              // Saklarnya di DALAM cabang ini: "{sidangSelesai ? null : ("
                              // dijaga sebagai janji bahwa sidang yang sudah tercatat
                              // tidak pernah ditawari penundaan kedua.
                              tampil(tampilan, "tombol-tunda-putus") ? (
                              <span className="inline-flex align-middle" data-tombol-tunda-putus="">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCatat((lama) =>
                                      lama && lama.kunci === kunci && lama.jalan === "tunda"
                                        ? null
                                        : { kunci, jalan: "tunda" }
                                    )
                                  }
                                  title={`Tunda sidang ${baris.nomorPerkara} tanpa berpindah layar`}
                                  aria-label={`Tunda sidang ${baris.nomorPerkara}`}
                                  aria-pressed={catat?.kunci === kunci && catat.jalan === "tunda"}
                                  className={cn(
                                    "rounded-l-md border px-1.5 py-0.5 text-[11px] font-semibold transition",
                                    catat?.kunci === kunci && catat.jalan === "tunda"
                                      ? "border-amber-600 bg-amber-600 text-white"
                                      : "border-amber-400 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-500/15"
                                  )}
                                >
                                  tunda
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCatat((lama) =>
                                      lama && lama.kunci === kunci && lama.jalan === "putus"
                                        ? null
                                        : { kunci, jalan: "putus" }
                                    )
                                  }
                                  title={`Catat putusan ${baris.nomorPerkara} tanpa berpindah layar`}
                                  aria-label={`Catat putusan ${baris.nomorPerkara}`}
                                  aria-pressed={catat?.kunci === kunci && catat.jalan === "putus"}
                                  className={cn(
                                    "-ml-px rounded-r-md border px-1.5 py-0.5 text-[11px] font-semibold transition",
                                    catat?.kunci === kunci && catat.jalan === "putus"
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-primary/50 text-primary hover:bg-primary/10"
                                  )}
                                >
                                  putus
                                </button>
                              </span>
                              ) : null
                            )}
                            {tampil(tampilan, "ikrar-selesai") && ikrarSelesai(baris) ? (
                              <span
                                className="inline-flex items-center rounded-full border border-emerald-500 bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-200"
                                title={
                                  baris.ikrarTercatat
                                    ? "Ikrar talak sudah tercatat di SIPP pada tanggal sidang ini - perkaranya selesai; tidak ada lagi yang ditunda atau diputus."
                                    : `Hasil sidang di SIPP: "${baris.alasanDitunda}" - ikrar talak sudah dilaksanakan, perkaranya selesai.`
                                }
                              >
                                Selesai · telah ikrar talak
                              </span>
                            ) : null}
                            {/* 18 Okt 2026: ikrar sudah dinyatakan terlaksana (mis. diisi lewat SIPP)
                                tetapi form ikrar talak di SIPP belum terisi tanggalnya. */}
                            {ikrarSelesai(baris) && !baris.ikrarTercatat && tampil(tampilan, "tombol-tunda-putus") && tampil(tampilan, "tombol-isi-ikrar") ? (
                              <IsiIkrarTalak
                                jadwalId={baris.sidangId}
                                perkaraId={baris.perkaraId}
                                nomorPerkara={baris.nomorPerkara}
                                onSelesai={() => void muatTanggal(dari, sampai, nilaiKesiapan)}
                              />
                            ) : null}

                            {/* ================================================
                                MEDIATOR - HANYA PADA SIDANG YANG BERURUSAN
                                DENGAN MEDIASI
                                ================================================

                                Diminta pengguna 22 September 2026. Ambangnya
                                diukur, bukan dikira - lihat @/lib/mediasi-sidang
                                untuk ketiga keputusan yang ditentukan angkanya,
                                termasuk mengapa agenda ikut dibaca dan mengapa
                                bendera ditunda TIDAK disyaratkan.

                                Berdiri sebagai tombol sendiri, bukan tombol
                                ketiga pada kelompok tunda|putus: kelompok itu
                                bersudut membulat di kedua ujungnya, dan
                                menyisipkan tombol ketiga menuntut membongkar
                                sudutnya. Lagi pula keduanya pekerjaan yang
                                berbeda - tunda dan putus MENULIS ke SIPP,
                                Mediator membuka keterangan. */}
                            {/* 6 Okt 2026 (butir 7): penanda/tombol Mediator HANYA
                                muncul pada sidang yang dihadiri KEDUA BELAH PIHAK
                                untuk PERTAMA KALI - saat mediasi wajib
                                diperintahkan dan mediator ditunjuk. Sebelumnya ia
                                muncul pada tiap agenda yang menyebut mediasi
                                (sidangBerbauMediasi); keterangan mediasinya kini
                                dibawa penanda "Mediasi" dan hasil mediasi di
                                kolom Agenda, dan tetap ada di Status Perkara. */}
                            {(() => {
                              if (!tampil(tampilan, "tombol-mediator")) return null;
                              const penanda = penandaMediator(baris, antrianUntuk(antrian.peta, baris), hariIni());
                              return penanda ? (
                                <span data-penanda-mediator="" className="inline-flex">
                                  <TombolMediator
                                    baris={baris}
                                    onBukaStatus={onBukaStatus}
                                    sebabMediator={penanda.keterangan}
                                  />
                                </span>
                              ) : null;
                            })()}
                          </div>

                          {/* ==================================================
                              SIAPA YANG MENYIDANGKAN - HANYA DI MODE RINGKAS
                              ==================================================

                              Di mode Lengkap keterangan ini sudah punya kolom
                              sendiri; menampilkannya dua kali hanya mengulang.
                              Di Ringkas kolomnya disembunyikan, dan tanpa baris
                              ini petugas yang memanggil perkara di depan ruang
                              sidang harus berpindah ke mode Lengkap hanya untuk
                              membaca satu kode majelis. */}
                          <div
                            className={cn(
                              "hanya-ringkas mt-0.5 flex-wrap items-center gap-x-2 text-sm text-muted-foreground",
                              // Saklarnya menyembunyikan lewat kelas, bukan
                              // dengan membuang simpulnya: kelas hanya-ringkas
                              // sudah mengaturnya per mode, dan mencampur dua
                              // cara menyembunyikan pada satu simpul membuat
                              // yang satu diam-diam mengalahkan yang lain.
                              tampil(tampilan, "petugas") ? "flex" : "hidden"
                            )}
                          >
                            {baris.majelisKode ? (
                              <span className="whitespace-nowrap" title={baris.majelisNama}>
                                <span className="font-medium text-foreground/70">Majelis</span>{" "}
                                <NamaDapatDipanggil golongan="majelis" {...konteksPanggil}>
                                  <span className={cn(KELAS_KODE_MAJELIS, "text-foreground")}>{baris.majelisKode}</span>
                                </NamaDapatDipanggil>
                                {majelisTampil(baris, pilihanHakim).diganti ? (
                                  <>
                                    {" "}
                                    <NamaHakimMenyidangkan baris={baris} pilihan={pilihanHakim} />
                                  </>
                                ) : null}
                              </span>
                            ) : null}
                            {baris.paniteraNama ? (
                              <span title={`Panitera Pengganti: ${baris.paniteraNama}`}>
                                <span className="font-medium text-foreground/70">PP</span>{" "}
                                <NamaDapatDipanggil golongan="pp" {...konteksPanggil}>{baris.paniteraNama}</NamaDapatDipanggil>
                              </span>
                            ) : null}
                            {baris.jurusitaNama ? (
                              <span title={`Juru Sita: ${baris.jurusitaNama}`}>
                                <span className="font-medium text-foreground/70">JS</span>{" "}
                                <NamaDapatDipanggil golongan="js" {...konteksPanggil}>{baris.jurusitaNama}</NamaDapatDipanggil>
                              </span>
                            ) : null}
                            {/* === 12OKT-C: mediator di bawah JS, di atas ruang === */}
                            {mediatorIni ? (
                              <span title={`Mediator: ${mediatorIni}`} data-mediator-majelis="">
                                <span className="font-medium text-foreground/70">Mediator</span> {mediatorIni}
                              </span>
                            ) : null}
                            {/* === AKHIR 12OKT-C === */}
                            {/* Ruang ikut ke sini sejak kolomnya dihapus. Ia
                                hampir selalu sama sepanjang satu hari, tetapi
                                pada hari yang memakai lebih dari satu ruang,
                                inilah satu-satunya keterangan yang menentukan
                                ke mana orang berjalan. */}
                            {baris.ruangan ? (
                              <span title={`Ruang sidang: ${baris.ruangan}`}>
                                <span className="font-medium text-foreground/70">Ruang</span>{" "}
                                {baris.ruangan}
                              </span>
                            ) : null}
                          </div>

                          {/* Keadaan yang di mode Lengkap terbaca dari kolomnya
                              sendiri. Retur dan belum-dipanggil TIDAK diulang
                              di sini - penandanya sudah menempel di samping
                              nomor perkara pada kedua mode. */}
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            {/* ==============================================
                                HARI PUTUSAN - KUNING, DI KEDUA MODE
                                ==============================================

                                Berdiri paling depan pada baris penanda ini,
                                sebab inilah satu-satunya di antaranya yang
                                menentukan apakah baris itu perlu dibuka
                                sekarang: hari ini perkaranya berdiri di
                                hadapan putusannya.

                                Aturannya di hariPutusan - satu tempat, dipakai
                                kotak saring di atas dan penanda ini sekaligus.
                                Sebelumnya keduanya menghitung sendiri-sendiri,
                                dan yang tersaring tidak selalu yang bertanda. */}
                            {tampil(tampilan, "hari-putusan") && hariPutusan(baris) ? (
                              <span
                                className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                                title={
                                  hasilSidangPutusan(baris.ditunda, baris.alasanDitunda)
                                    ? `Hasil sidangnya sudah tercatat: ${hasilSidangPutusan(
                                        baris.ditunda,
                                        baris.alasanDitunda
                                      )}`
                                    : "Agendanya musyawarah majelis, pembacaan putusan, pembacaan penetapan, atau putusan sela - majelis harus lengkap dan naskahnya harus siap."
                                }
                              >
                                Hari Putusan
                              </span>
                            ) : null}
                            {/* F1.6: kesiapan draf dari checklist konseptor sementara. */}
                            {tampil(tampilan, "hari-putusan") && tampil(tampilan, "kesiapan-putusan") && hariPutusan(baris) ? (
                              <LencanaKesiapanPutusan
                                kemajuan={tunjukan[String(baris.perkaraId)]?.kemajuan ?? checklistTanpaTunjukan[String(baris.perkaraId)]?.kemajuan}
                              />
                            ) : null}
                            {/* F4.2: draf H-7 agen ALETA untuk sidang INI - juga perkiraan putusan verstek (agenda bukan putusan). */}
                            {tampil(tampilan, "hari-putusan") &&
                            tampil(tampilan, "draf-putusan-agen") &&
                            !sudahPutusHariIni(baris) &&
                            drafH7[String(baris.perkaraId)]?.tanggalSidang === String(baris.tanggalSidang).slice(0, 10) ? (
                              <LencanaDrafH7 ringkas={drafH7[String(baris.perkaraId)]} />
                            ) : null}

                            {/* ==============================================
                                IKRAR TALAK - BIRU, MENGGANTIKAN YANG KUNING
                                ==============================================

                                Tidak pernah muncul bersama penanda kuning:
                                hariPutusan memotong sidang berbendera ikrar
                                lebih dulu. Yang dibaca orang pada baris ini
                                karena itu satu keterangan, bukan dua yang
                                saling menyangkal.

                                Putusannya sendiri tetap terbaca di kolom
                                Putusan - yang dikatakan penanda ini bukan
                                "belum putus", melainkan "yang dikerjakan hari
                                ini bukan putusannya". */}
                            {tampil(tampilan, "ikrar-talak") && sidangIkrar(baris) ? (
                              <span
                                className="rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-900 dark:bg-sky-950 dark:text-sky-200"
                                title="Sidang penyaksian ikrar talak. Putusannya - izin mengucapkan talak - sudah dijatuhkan sebelumnya; yang terjadi hari ini pengucapan ikrarnya di depan majelis."
                              >
                                Ikrar Talak
                              </span>
                            ) : null}

                            {/* ==============================================
                                KEHADIRAN, DAN POTENSI VERSTEK DARI SIDANG
                                SEBELUMNYA
                                ==============================================

                                Ia dulu hanya ada di kisi kartu dalam panel
                                alur, dan hilang bersama kisinya. Yang paling
                                menentukan di antaranya "potensi verstek" -
                                dan dulu ia dibaca dari kehadiran sidang INI:
                                hanya penggugat yang hadir. Itu keliru pada
                                sidang pertama; tergugat yang tidak datang
                                baru dipanggil sekali lagi. Kini ia dibaca
                                dari sidang SEBELUMNYA, lewat aturan yang
                                sama dengan kotak saringnya - potensiVerstek
                                di lib. Keputusannya tetap milik majelis;
                                karena itu potensi, bukan kesimpulan.

                                Satu penanda saja per baris: potensi verstek
                                lebih dulu (ia berlaku sebelum kehadiran hari
                                ini dicatat), lalu kehadiran hari ini. */}
                            {/* Rantainya tetap berupa satu if/else - "satu
                                penanda saja per baris" di atas masih berlaku -
                                tetapi tiap cabangnya kini memeriksa saklarnya
                                sendiri. Yang mematikan potensi verstek karena
                                itu JATUH ke penanda kehadiran, bukan kehilangan
                                keduanya sekaligus: saklar yang mematikan satu
                                hal tidak boleh diam-diam mematikan hal kedua
                                yang tidak disebut namanya. */}
                            {tampil(tampilan, "potensi-verstek") && potensiVerstek(baris) && !sudahPutusHariIni(baris) ? (
                              <Badge
                                variant="warning"
                                title="Pada sidang sebelumnya hanya penggugat/pemohon yang hadir dan tergugat/termohon belum pernah hadir; bila hari ini pun tergugat tidak datang, jalan putusan verstek terbuka. Keputusannya milik majelis."
                              >
                                potensi verstek
                              </Badge>
                            ) : tampil(tampilan, "kehadiran") && baris.dihadiriOleh === 1 ? (
                              <Badge variant="success" title="Kedua belah pihak hadir.">
                                contradictoir
                              </Badge>
                            ) : tampil(tampilan, "kehadiran") && baris.dihadiriOleh ? (
                              <Badge variant="muted">
                                <PatahSesudahGaris teks={SEBUTAN_HADIR[baris.dihadiriOleh]} />
                              </Badge>
                            ) : null}

                            {/* ==============================================
                                KUASA DI KEDUA MODE
                                ==============================================

                                Ada tidaknya kuasa mengubah SIAPA yang dipanggil
                                dan siapa yang berhak hadir. Selama ini ia baru
                                terlihat sesudah satu sidang dibuka - padahal
                                yang membacakan jadwal perlu tahu sebelum
                                memanggil, bukan sesudah. */}
                            {tampil(tampilan, "kuasa") && baris.adaKuasa ? (
                              <span
                                className="rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-900 dark:bg-sky-950 dark:text-sky-200"
                                title={`Memakai kuasa hukum: ${[
                                  baris.kuasaPihak1 ? "penggugat/pemohon" : "",
                                  baris.kuasaPihak2 ? "tergugat/termohon" : "",
                                ]
                                  .filter(Boolean)
                                  .join(" dan ") || "tercatat pada perkara"}`}
                              >
                                Kuasa
                                {baris.kuasaPihak1 && !baris.kuasaPihak2
                                  ? " P"
                                  : baris.kuasaPihak2 && !baris.kuasaPihak1
                                    ? " T"
                                    : ""}
                              </span>
                            ) : null}
                          </div>

                          {/* ==================================================
                              SAKSI: SIAPA, BUKAN HANYA BERAPA
                              ==================================================

                              Di kedua mode - berbeda dari penanda "belum ada
                              BAS" di bawah, yang hanya perlu di Ringkas karena
                              di Lengkap sudah punya kolomnya sendiri. Saksi
                              tidak punya kolom di mana pun.

                              Namanya disebut, bukan sekadar jumlahnya. Majelis
                              yang membuka jadwal sebelum sidang menanyakan
                              "saksi yang mana yang datang hari ini" - dan nama
                              itulah yang dicocokkan dengan orang yang duduk di
                              ruang tunggu. Jumlah saja tidak menjawabnya.

                              Sisi pengajunya disebutkan terpisah: saksi
                              penggugat dan saksi tergugat diperiksa pada
                              tahapan yang berbeda, dan menggabungkannya
                              menjadi satu angka menghapus perbedaan itu. */}
                          {tampil(tampilan, "saksi") &&
                          (baris.saksiPihak1 ?? 0) + (baris.saksiPihak2 ?? 0) > 0 ? (
                            <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                              {/* Melipat, bukan truncate - sebabnya sama dengan
                                  nama pihak di atas. */}
                              {/* JADWAL-3 butir 4: bawaan terlipat ("Saksi P (2) ▸"),
                                  dibuka per baris; saklar "saksi-lipat" dimatikan = terbentang. */}
                              {(baris.saksiPihak1 ?? 0) > 0 ? (
                                <SaksiLipat
                                  label="Saksi P"
                                  jumlah={baris.saksiPihak1 ?? 0}
                                  terbuka={saksiLipat.terbuka(kunciBarisSaksi(baris.perkaraId, "P"))}
                                  onAlih={() => saksiLipat.alih(kunciBarisSaksi(baris.perkaraId, "P"))}
                                  namaRingkas={(baris.saksiNamaPihak1 ?? []).join(", ")}
                                >
                                  {/* 12OKT-B: nama saksi dapat diklik untuk memanggil (saklar panggil-saksi) */}
                                  <DaftarNamaSaksi aktif={aktifPanggilSaksi} golongan="saksi1" nama={baris.saksiNamaPihak1 ?? []} konteks={konteksPanggil} />
                                </SaksiLipat>
                              ) : null}
                              {(baris.saksiPihak2 ?? 0) > 0 ? (
                                <SaksiLipat
                                  label="Saksi T"
                                  jumlah={baris.saksiPihak2 ?? 0}
                                  terbuka={saksiLipat.terbuka(kunciBarisSaksi(baris.perkaraId, "T"))}
                                  onAlih={() => saksiLipat.alih(kunciBarisSaksi(baris.perkaraId, "T"))}
                                  namaRingkas={(baris.saksiNamaPihak2 ?? []).join(", ")}
                                >
                                  {/* 12OKT-B */}
                                  <DaftarNamaSaksi aktif={aktifPanggilSaksi} golongan="saksi2" nama={baris.saksiNamaPihak2 ?? []} konteks={konteksPanggil} />
                                </SaksiLipat>
                              ) : null}
                            </div>
                          ) : null}

                          <div className="hanya-ringkas mt-1 flex flex-wrap items-center gap-1">
                            {/* ==============================================
                                BELUM MINUTASI IKUT KE MODE RINGKAS
                                ==============================================

                                Lencananya hidup di dalam kolom Putusan, dan
                                kolom itu berkelas kolom-lengkap - artinya ia
                                PADAM SELURUHNYA di mode Ringkas.

                                Itu bertentangan dengan janji panel saklar,
                                yang menyebut "belum minutasi" salah satu dari
                                empat penanda yang tidak dapat dimatikan siapa
                                pun. Penanda yang hilang karena mode tampilan
                                sama saja dimatikan - yang membedakan hanya
                                tombol mana yang menyebabkannya.

                                Karena itu ia diulang di sini, dan HANYA di
                                sini: di mode Lengkap barisan ini sendiri
                                tersembunyi, jadi tidak ada yang tergambar dua
                                kali. */}
                            {baris.sudahPutus && !sudahDiminutasi(baris.tanggalMinutasi) ? (
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 text-xs font-medium",
                                  baris.adaBerkasPutusan
                                    ? "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200"
                                    : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                                )}
                                title={
                                  (baris.adaBerkasPutusan
                                    ? "Naskah putusan sudah diunggah ke SIPP tetapi minutasi belum bertanggal."
                                    : "Naskah putusan belum diunggah ke SIPP.") +
                                  " Buka rincian perkara untuk daftar lengkap berkas yang masih kurang."
                                }
                              >
                                Belum minutasi
                              </span>
                            ) : null}
                            {tampil(tampilan, "belum-bas") && !baris.adaBas ? (
                              <span
                                className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                                title="Berita acara sidang belum diunggah ke SIPP."
                              >
                                Belum ada BAS
                              </span>
                            ) : null}
                            {/* Penanda saksi TIDAK di sini: ia kini berdiri
                                sendiri di atas, dengan namanya, dan tampil di
                                kedua mode. Mengulangnya di baris ini akan
                                membuat Ringkas menyebut saksi dua kali. */}
                            {/* Tanpa saklar, dan itu disengaja: penandanya
                                sudah dimatikan keras oleh
                                TAMPILKAN_PUTUSAN_ECOURT. Saklar bagi sesuatu
                                yang tidak pernah digambar adalah saklar yang
                                tidak mengerjakan apa pun - dan yang menekannya
                                akan menyimpulkan seluruh panelnya rusak. */}
                            {/* Lencana putusan e-Court belum diunggah / belum
                                TTE - kontrak K5 (komponen milik agen E). Hanya
                                pada perkara yang sudah putus; komponennya diam
                                bila tidak ada yang perlu dikerjakan. */}
                            {tampil(tampilan, "lencana-putusan-ecourt") && (baris.sudahPutus || sudahPutusHariIni(baris)) ? (
                              <EcourtLencanaPutusan
                                nomorPerkara={baris.nomorPerkara}
                                perkaraId={baris.perkaraId}
                                keadaan={baris.putusanEcourt ?? undefined}
                                kalimat
                                className="text-xs"
                              />
                            ) : null}
                            {TAMPILKAN_PUTUSAN_ECOURT &&
                            baris.putusanEcourt?.perluTindakan ? (
                              <span
                                className="rounded bg-rose-100 px-1.5 py-0.5 text-xs font-medium text-rose-900 dark:bg-rose-950 dark:text-rose-200"
                                title={
                                  baris.putusanEcourt.keterangan ||
                                  "Sudah putus, tetapi putusannya belum beres di e-Court."
                                }
                              >
                                {formatLencana(baris.putusanEcourt.sebutan || "putusan e-Court")}
                              </span>
                            ) : null}
                            {tampil(tampilan, "tidak-dipanggil") &&
                            baris.panggilan &&
                            baris.panggilan.wajibDipanggil.length === 0 ? (
                              <span
                                className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                                title="Semua pihak hadir pada sidang sebelumnya - tidak ada yang wajib dipanggil."
                              >
                                Tidak perlu dipanggil
                              </span>
                            ) : null}
                          </div>

                          {/* ==================================================
                              TUNDAAN DIRINCI DI TABEL UTAMA
                              ==================================================

                              Sebelumnya hanya bertulis "ditunda". Yang ditanya
                              orang berikutnya selalu sama: ditunda sampai
                              kapan, dan karena apa. Keduanya sudah terbaca dari
                              SIPP - tidak ada alasan menyembunyikannya di balik
                              satu kata. */}
                          {tampil(tampilan, "hasil-tundaan") && baris.ditunda ? (
                            <div className="mt-1 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-1 text-sm">
                              <span className="font-medium text-amber-700 dark:text-amber-300">
                                Ditunda
                              </span>
                              {baris.tanggalSidangBerikut ? (
                                // Hanya TANGGALNYA yang nowrap, bukan "sampai
                                // <tanggal>" seluruhnya: satu potong nowrap
                                // selebar 175 px itulah lebar minimum kolom
                                // Perkara pada baris yang ditunda (diukur 28
                                // September 2026), dan kolom itu yang
                                // mendorong tabel melewati kartunya.
                                <span className="text-amber-700 dark:text-amber-300">
                                  {" "}sampai{" "}
                                  <span className="whitespace-nowrap">
                                    {tanggalHariPendek(
                                      baris.tanggalSidangBerikut,
                                      baris.tanggalSidangBerikut
                                    )}
                                  </span>
                                </span>
                              ) : null}
                              {baris.alasanDitunda ? (
                                <div className="text-muted-foreground">{baris.alasanDitunda}</div>
                              ) : null}
                            </div>
                          ) : null}

                          {/* ==================================================
                              HASIL SIDANG - SEBELAHAN DENGAN TUNDAAN
                              ==================================================

                              Kolom yang sama dipakai panitera untuk dua hal:
                              bila ditunda ia berisi agenda berikutnya, bila
                              tidak ia berisi hasil sidangnya. Karena itu
                              keduanya menempati tempat yang sama di sini, dan
                              tidak pernah muncul bersamaan.

                              Hijau, bukan kuning: tundaan berarti pekerjaan
                              belum selesai, sedangkan putusan berarti selesai.
                              Membedakannya dengan warna membuat satu layar
                              penuh dapat dibaca tanpa mengeja tulisannya.

                              Aturan pemisahnya di lib/hasil-sidang - bukan di
                              sini - sebab layar antrian memakainya juga. */}
                          {tampil(tampilan, "hasil-tundaan") &&
                          hasilSidangPutusan(baris.ditunda, baris.alasanDitunda) ? (
                            <div className="mt-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-1 text-sm">
                              <span className="font-medium text-emerald-700 dark:text-emerald-300">
                                Hasil sidang
                              </span>
                              <div className="text-muted-foreground">
                                {hasilSidangPutusan(baris.ditunda, baris.alasanDitunda)}
                              </div>
                            </div>
                          ) : null}
                        </td>

                        <td className={cn("px-2 py-2 align-top text-sm", LEBAR_KOLOM_AGENDA)}>
                          {/* ==================================================
                              AGENDA e-LITIGASI BERTULISAN MERAH
                              ==================================================

                              Diminta pengguna 24 September 2026: "untuk segala
                              perkara yang e-litigasi dibuat warna merah tulisan
                              agendanya".

                              Aturannya SAMA dengan kotak e-Litigasi di atas
                              tabel. Kotak yang berbunyi "4" harus menunjuk empat
                              baris yang merah, bukan dua puluh.

                              BUKAN "seluruh perkara e-Court". Diukur di SIPP
                              satker: 1.913 dari 1.923 sidang 2026 (99,5%)
                              perkaranya terdaftar e-Court, 2.247 dari 2.250 pada
                              2025. Memerahkan seluruhnya berarti memerahkan
                              seluruh tabel, dan warna yang ada di tiap baris
                              tidak membedakan apa pun. Dengan agendanya ikut
                              disyaratkan: rata-rata 2,9 dari 19,9 sidang pada
                              hari sidang yang ramai.

                              TULISAN, BUKAN LENCANA. Retur dan belum dipanggil
                              adalah lencana berlatar merah di kolom Perkara;
                              yang ini tulisan tanpa latar di kolom Agenda.
                              Bentuk dan tempatnya berbeda, sehingga mata tidak
                              menukar "sidang ini lewat aplikasi" dengan
                              "panggilannya gagal". Hanya teks agendanya yang
                              merah: nomor sidang dan umur perkara (yang punya
                              warnanya sendiri) tidak ikut.

                              Ditebalkan supaya tetap terbeda tanpa melihat
                              warna: bagi pembaca yang buta warna merah-hijau,
                              red-700 hampir sehitam tulisan biasa.

                              Sel ini satu untuk mode Lengkap dan Ringkas. Lembar
                              cetak TIDAK ikut - sebabnya di berkas cetaknya. */}
                          {tampil(tampilan, "agenda-elitigasi") && sidangElitigasi(baris) ? (
                            <span
                              className="font-semibold text-red-700 dark:text-red-400"
                              title="e-Litigasi: perkara terdaftar lewat e-Court, dan agenda ini tahapan yang dipertukarkan lewat aplikasi. Aturannya sama dengan kotak e-Litigasi di atas tabel."
                            >
                              {baris.agenda}
                            </span>
                          ) : (
                            baris.agenda || "—"
                          )}
                          {tampil(tampilan, "urutan-sidang") && baris.urutanSidang > 0 ? (
                            <div className="text-muted-foreground">
                              sidang ke-{baris.urutanSidang}
                            </div>
                          ) : null}

                          {/* Butir 8-9 (6 Okt 2026): pernah mediasi, dan hasil
                              mediasi pada agenda laporan hasil mediasi. Tanpa
                              mediasi = tanpa penanda. Lihat lib/penanda-mediasi. */}
                          <PenandaMediasiAgenda
                            penanda={[
                              tampil(tampilan, "penanda-mediasi") ? penandaPernahMediasi(baris) : null,
                              tampil(tampilan, "hasil-mediasi") ? penandaHasilMediasi(baris) : null,
                            ]}
                            onBuka={onBukaStatus ? () => onBukaStatus(baris.nomorPerkara) : undefined}
                          />

                          {/* Butir 4 (6 Okt 2026): eksepsi / rekonvensi dari
                              jawaban & duplik Tergugat. Lihat lib/penanda-jawaban. */}
                          {tampil(tampilan, "penanda-jawaban") ? (
                            <PenandaJawabanAgenda
                              baris={baris}
                              onBuka={onBukaStatus ? () => onBukaStatus(baris.nomorPerkara) : undefined}
                            />
                          ) : null}

                          {/* === 12OKT-K: Sita (Jaminan/Revindikasi/Marital/Eksekusi/lain) dari
                              petitum + SIPP, di bawah Eksepsi/Rekonvensi. Lihat lib/penanda-sita. === */}
                          {tampil(tampilan, "penanda-sita") ? (
                            <PenandaSitaAgenda
                              baris={baris}
                              onBuka={onBukaStatus ? () => onBukaStatus(baris.nomorPerkara) : undefined}
                            />
                          ) : null}
                          {/* === AKHIR 12OKT-K === */}

                          {/* Umur perkara, tepat di bawah agendanya - diminta
                              pengguna 23 September 2026. Hari mediasi tidak
                              dihitung; warnanya pita Waktu Putus SK Dirjen
                              Badilag 048/2024 - sebabnya di komponen
                              UmurPerkara. */}
                          {tampil(tampilan, "umur-perkara") ? (
                            <UmurPerkara durasi={baris.durasi} telahIkrar={ikrarSelesai(baris)} />
                          ) : null}

                          {/* Keadaan putusan ikut di sini pada mode RINGKAS.
                              Kolom Putusan disembunyikan di mode itu, sehingga
                              perkara yang sudah putus tidak dapat dibedakan
                              dari yang belum - padahal itulah pertanyaan
                              pertama yang diajukan orang tentang satu perkara. */}
                          {statusPutusanTampil ? (
                          <div className="hanya-ringkas mt-1">
                            {baris.sudahPutus ? (
                              <Badge variant="success">{baris.statusPutusan || "Putus"}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">belum putus</span>
                            )}
                          </div>
                          ) : null}

                          {/* Court Calendar perkara ini - PALING BAWAH sel
                              Agenda (permintaan 6 Okt 2026, butir 3): lihat,
                              susun dari rekomendasi ALETA, tambah manual,
                              sunting baris lama, simpan ke SIPP. Hanya
                              panitera/admin; komponennya di berkas sendiri. */}
                          {tampil(tampilan, "court-calendar") ? (
                          <CourtCalendarSidang
                            perkaraId={String(baris.perkaraId)}
                            nomorPerkara={baris.nomorPerkara}
                            jenisPerkara={baris.jenisPerkara}
                          />
                          ) : null}
                        </td>
                        {/* Susunannya menurun dari yang paling menentukan ke
                            yang paling seragam: majelis, lalu petugasnya, lalu
                            ruangnya. Ruang hampir selalu sama untuk satu hari,
                            jadi ia yang paling pantas menjadi baris terakhir
                            yang teredam - ada bila dicari, tidak menarik mata
                            bila tidak. */}
                        <td className={cn("px-2 py-2 align-top text-sm kolom-lengkap", LEBAR_KOLOM_MAJELIS)}>
                          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                            {/* ============================================
                                KODE MAJELIS TIDAK BOLEH PATAH DI TANDA HUBUNG
                                ============================================

                                Kodenya berbentuk "C1-C2-C3" - tiga kode hakim
                                yang disambung tanda hubung. Peramban
                                memperlakukan tanda hubung sebagai tempat yang
                                boleh dipatahkan, sehingga pada kolom sempit ia
                                tersusun menurun:

                                    C1-
                                    C2-
                                    C3

                                Terbaca sebagai tiga hal yang berbeda, padahal
                                ia satu kode majelis. Barisnya pun jadi tiga
                                kali lebih tinggi daripada baris tetangganya.

                                whitespace-nowrap menahannya tetap satu baris.
                                Aman: kode terpanjang hanya sekitar sepuluh
                                aksara. Nama majelis di sebelahnya MELIPAT
                                (sejak 28 September 2026, bukan truncate
                                max-w-[18rem] lagi) - truncate di dalam sel
                                tabel memaksa kolomnya selebar namanya. */}
                            <span className={KELAS_LENCANA_KODE_MAJELIS}>
                              {baris.majelisKode || "—"}
                            </span>
                            {/* 22 Okt 2026: hakim yang menyidangkan menggantikan
                                nama majelis; KODE majelis di sebelahnya tetap. */}
                            {majelisTampil(baris, pilihanHakim).diganti ? (
                              <NamaHakimMenyidangkan baris={baris} pilihan={pilihanHakim} />
                            ) : baris.majelisNama ? (
                              <span
                                className="min-w-0 break-words text-muted-foreground"
                                title={baris.majelisNama}
                              >
                                <NamaDapatDipanggil golongan="majelis" {...konteksPanggil}>{baris.majelisNama}</NamaDapatDipanggil>
                              </span>
                            ) : null}
                            {!modeUrl && satuTanggalJadwal && tampil(tampilan, "pilih-hakim-baris") ? <PemilihHakimBaris baris={baris} kh={kh} /> : null}
                          </div>

                          {/* JADWAL-3 tambahan A (19 Okt 2026): PP dan JS
                              masing-masing di BARIS SENDIRI - disambung dengan
                              " · " keduanya terbungkus acak di kolom sempit
                              (1366 px, zoom 125-150%). Urutan: kode, nama
                              majelis, PP, JS, mediator, ruang. */}
                          <div className="mt-0.5 break-words" data-petugas-pp="">
                            <span className="text-muted-foreground">PP </span>
                            {baris.paniteraNama ? <NamaDapatDipanggil golongan="pp" {...konteksPanggil}>{baris.paniteraNama}</NamaDapatDipanggil> : "—"}
                          </div>
                          <div className="mt-0.5 break-words" data-petugas-js="">
                            <span className="text-muted-foreground">JS </span>
                            {baris.jurusitaNama ? <NamaDapatDipanggil golongan="js" {...konteksPanggil}>{baris.jurusitaNama}</NamaDapatDipanggil> : "—"}
                          </div>

                          {/* === 12OKT-C: mediator di bawah JS, di atas ruang === */}
                          {mediatorIni ? (
                            <div className="mt-0.5" title={`Mediator: ${mediatorIni}`} data-mediator-majelis="">
                              <span className="text-muted-foreground">Mediator </span>
                              {mediatorIni}
                            </div>
                          ) : null}
                          {/* === AKHIR 12OKT-C === */}

                          {baris.ruangan ? (
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {baris.ruangan}
                            </div>
                          ) : null}
                        </td>

                        <td className="px-2 py-2 align-top text-sm kolom-lengkap">
                          {baris.sudahPutus ? (
                            <div className="flex flex-wrap gap-1">
                              {/* Tanggalnya sengaja tidak ikut: yang dicari di
                                  kolom ini keadaannya, bukan kapan. Tanggal
                                  putusan tetap ada di rincian sidang, tempat
                                  ia memang dibutuhkan.

                                  Warnanya mengikuti STATUSNYA, bukan hijau
                                  untuk semuanya: "Ditolak" yang berwarna hijau
                                  terbaca sebagai kabar baik oleh siapa pun yang
                                  hanya sempat melihat warnanya. */}
                              {statusPutusanTampil ? (
                              <Badge variant={warnaStatusPutusan(baris.statusPutusan)}>
                                {baris.statusPutusan || "Putus"}
                              </Badge>
                              ) : null}

                              {/* Verstek: putusan tanpa hadirnya tergugat.
                                  Menentukan tenggang verzet, dan karena itu
                                  perlu terbaca tanpa membuka rincian. */}
                              {statusPutusanTampil && baris.verstekPutusan ? (
                                <Badge variant="warning">verstek</Badge>
                              ) : null}

                              {/* ==========================================
                                  BELUM MINUTASI: MERAH BILA NASKAHNYA SUDAH ADA
                                  ==========================================

                                  Dua keadaan yang tampak sama tetapi menagih
                                  orang yang berbeda:

                                    naskah belum diunggah  - masih menunggu
                                      hakim menyusunnya; kuning, sabar;
                                    naskah SUDAH diunggah  - tidak ada lagi
                                      yang ditunggu, minutasi tinggal
                                      dikerjakan panitera pengganti; merah.

                                  Sebelumnya keduanya kuning, sehingga yang
                                  benar-benar tertahan tidak terbedakan dari
                                  yang memang belum waktunya. */}
                              {/* sudahDiminutasi, bukan sekadar string kosong:
                                  SIPP menulis '0000-00-00' pada sebagian
                                  barisnya, dan tanggal nol yang dibaca sebagai
                                  "ada isinya" akan memadamkan lencana ini
                                  justru pada baris yang paling perlu
                                  menyalakannya. */}
                              {!sudahDiminutasi(baris.tanggalMinutasi) ? (
                                <Badge
                                  variant={baris.adaBerkasPutusan ? "danger" : "warning"}
                                  title={
                                    // Sebab lengkapnya menuntut jadwal SELURUH
                                    // perkara - baris ini hanya tahu BAS
                                    // sidangnya sendiri. Karena itu yang
                                    // disebut di sini hanya yang benar-benar
                                    // terbaca dari baris, dan sisanya
                                    // ditunjukkan tempatnya. Mengarang daftar
                                    // lengkap dari satu baris akan menyebut
                                    // BAS lengkap pada perkara yang sidang
                                    // lainnya belum ada BAS-nya.
                                    (baris.adaBerkasPutusan
                                      ? "Naskah putusan sudah diunggah ke SIPP tetapi minutasi belum bertanggal."
                                      : "Naskah putusan belum diunggah ke SIPP.") +
                                    " Buka rincian perkara untuk daftar lengkap berkas yang masih kurang."
                                  }
                                >
                                  belum minutasi
                                </Badge>
                              ) : null}
                            </div>
                          ) : hasilSidangPutusan(baris.ditunda, baris.alasanDitunda) ? (
                            /* ==================================================
                               PUTUS MENURUT HASIL SIDANG, TETAPI BELUM TERCATAT
                               ==================================================

                               Panitera menandai hasil sidang lebih dulu -
                               satu ketikan pada layar antrian - sedangkan data
                               putusannya diisi menyusul di SIPP. Di antara
                               keduanya ada jeda yang nyata.

                               Diukur pada 8 September 2026: dari enam perkara
                               yang hasil sidangnya menyebut putus, EMPAT belum
                               punya baris putusan.

                               Kolom ini dulu hanya bertulis "belum putus" untuk
                               keempatnya - tepat menurut tabel putusan, tetapi
                               menyesatkan bagi yang membacanya, sebab
                               perkaranya memang sudah diputus hari itu. Yang
                               tertinggal PENCATATANNYA, dan itu pekerjaan yang
                               menunggu orang, bukan keadaan perkara. */
                            /* ==================================================
                               DUA LENCANA, DAN URUTANNYA MENENTUKAN
                               ==================================================

                               Dahulu kolom ini hanya berbunyi "putusan belum
                               tercatat" - tepat, tetapi memimpin dengan
                               ketertinggalan pencatatannya dan tidak pernah
                               menyebut bahwa perkaranya SUDAH diputus. Dibaca
                               sekilas ia tetap berbunyi "belum ada putusan",
                               dan itulah yang membuat baris 491/Pdt.G/2026
                               tampak berbantah dengan kotak hijau hasil
                               sidangnya sendiri.

                               Sekarang faktanya dahulu - sudah putus, menurut
                               catatan ruang sidang - lalu apa yang masih
                               tertunggak. Keterangan kedua TIDAK dihapus: ia
                               menagih pekerjaan yang memang belum dikerjakan,
                               dan menghapusnya membuat tunggakan itu tidak
                               terlihat oleh siapa pun. */
                            <div className="flex flex-wrap gap-1">
                              {statusPutusanTampil ? (
                              <Badge
                                variant="success"
                                title={`Menurut catatan ruang sidang: ${hasilSidangPutusan(
                                  baris.ditunda,
                                  baris.alasanDitunda
                                )}`}
                              >
                                putus (hasil sidang)
                              </Badge>
                              ) : null}
                              <Badge
                                variant="warning"
                                title="Data putusannya belum diisi di SIPP - yang tertinggal pencatatannya, bukan keadaan perkaranya."
                              >
                                belum tercatat di SIPP
                              </Badge>
                            </div>
                          ) : statusPutusanTampil ? (
                            <span className="text-muted-foreground">belum putus</span>
                          ) : null}

                          {/* Pembebanan saat ikrar talak (6 Okt 2026): di
                              BAWAH penanda putusan, hanya pada sidang ikrar
                              yang pembebanannya ada. Rinciannya di panel
                              Rincian - lihat components/portal/pembebanan-ikrar. */}
                          {tampil(tampilan, "pembebanan-ikrar") ? <LencanaPembebananIkrar baris={baris} /> : null}

                          {/* ==================================================
                              KONSEPTOR SEMENTARA - DI BAWAH STATUS
                              ==================================================

                              Tempatnya diminta begitu, dan permintaannya masuk
                              akal: yang dicari mata di kolom ini keadaan
                              perkaranya lebih dahulu, dan siapa yang menyusun
                              naskahnya baru sesudah itu. Semula ia terpasang di
                              puncak sel, sehingga tunjukan tangan mendahului
                              fakta yang datang dari SIPP. */}
                          <SelKonseptorSementara
                            baris={baris}
                            tunjukan={tunjukan[String(baris.perkaraId)]}
                            terbuka={tunjukKunci === kunci}
                            daftarHakim={hakim.daftar}
                            alasanHakim={hakim.alasan}
                            onBuka={() => setTunjukKunci((lama) => (lama === kunci ? null : kunci))}
                            onSimpan={() => void muatTunjukan()}
                            tampilKosong={tampil(tampilan, "tunjuk-konseptor")}
                          />
                          {/* F4.2: rincian draf H-7 agen - untuk majelis dan konseptor, ditunjuk atau belum. */}
                          {tampil(tampilan, "draf-putusan-agen") && drafH7[String(baris.perkaraId)]?.tanggalSidang === String(baris.tanggalSidang).slice(0, 10) ? (
                            <PanelDrafH7
                              perkaraId={String(baris.perkaraId)}
                              ringkas={drafH7[String(baris.perkaraId)]}
                              tautan={{
                                sidangKe: baris.urutanSidang,
                                jumlahSaksiP: baris.saksiPihak1 ?? 0,
                                jumlahSaksiT: baris.saksiPihak2 ?? 0,
                                setelanAps,
                                boleh: jenisBlangkoPeran.includes("putusan"),
                              }}
                            />
                          ) : null}
                          {/* F1.6: checklist draf putusan - bila konseptornya sudah ditunjuk, ATAU
                              (butir 38, 17 Okt) sudah tercatat di SIPP tanpa tunjukan sementara. */}
                          {!tampil(tampilan, "checklist-konseptor") ? null : tunjukan[String(baris.perkaraId)]?.nama ? (
                            <ChecklistKonseptor
                              perkaraId={String(baris.perkaraId)}
                              nomorPerkara={baris.nomorPerkara}
                              kemajuan={tunjukan[String(baris.perkaraId)]?.kemajuan}
                              onBerubah={() => void muatTunjukan()}
                            />
                          ) : checklistTanpaTunjukan[String(baris.perkaraId)] ? (
                            <ChecklistKonseptor
                              perkaraId={String(baris.perkaraId)}
                              nomorPerkara={baris.nomorPerkara}
                              kemajuan={checklistTanpaTunjukan[String(baris.perkaraId)].kemajuan}
                              konseptorSipp={checklistTanpaTunjukan[String(baris.perkaraId)].konseptorSipp}
                              onBerubah={() => void muatTunjukan()}
                            />
                          ) : null}
                          {/* Butir 9: keterangan bebas, di BAWAH tunjuk
                              konseptor sebagaimana diminta. */}
                          <SelKeteranganPerkara
                            baris={baris}
                            keadaan={keterangan[String(baris.perkaraId)]}
                            terbuka={keteranganKunci === kunci}
                            onBuka={() =>
                              setKeteranganKunci((lama) => (lama === kunci ? null : kunci))
                            }
                            onSimpan={() => void muatKeterangan()}
                            tampilKosong={tampil(tampilan, "keterangan-perkara")}
                            bolehTulis={bolehTulisKeterangan}
                          />
                        </td>

                        {/* ==============================================
                            TOMBOL RINCIAN DI UJUNG KANAN
                            ==============================================

                            SATU-SATUNYA yang membuka rincian. Barisnya sendiri
                            tidak lagi dapat ditekan - lihat keterangan di atas
                            <tr>. */}
                        <td className="px-2 py-2 align-top text-right">
                          <div className="inline-flex flex-col items-stretch gap-1">
                            {/* ============================================
                                WARNANYA MENYATAKAN RINCIAN SEDANG TERBUKA
                                ============================================

                                Diminta pengguna 24 September 2026: "supaya tau
                                lagi dibuka rinciannya". Panah atas-bawah 3,5
                                piksel terlalu kecil untuk dibaca sekilas pada
                                daftar dua puluh baris - apalagi sesudah halaman
                                digulung dan panel rinciannya sudah di luar
                                layar.

                                Warnanya DITURUNKAN dari dibuka === kunci,
                                ungkapan yang sama yang menggambar panel
                                rinciannya di bawah - bukan disimpan di state
                                tersendiri. Dengan begitu tidak ada jalan
                                menutup rincian yang lupa memulihkan warnanya:
                                ditekan lagi, membuka baris lain (hanya SATU
                                rincian terbuka pada satu waktu), berpindah
                                hari, atau gagal membaca rincian - keempatnya
                                mengosongkan dibuka, dan tombolnya kembali ke
                                rupa semula dengan sendirinya.

                                Rupanya sama dengan tombol Tampilan di kepala
                                layar: panel terbuka = berisi warna primer.
                                Bentuk dan tebal hurufnya sengaja TIDAK
                                berubah - tombol ini menentukan lebar kolom
                                paling kanan bersama tombol Status di bawahnya,
                                dan huruf yang menebal membuat seluruh tabel
                                bergeser sedikit tiap kali rincian dibuka. */}
                            <button
                              type="button"
                              onClick={() => void buka(baris)}
                              aria-expanded={dibuka === kunci}
                              title={
                                dibuka === kunci
                                  ? `Tutup rincian ${baris.nomorPerkara}`
                                  : `Buka rincian ${baris.nomorPerkara}`
                              }
                              className={cn(
                                "inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs transition",
                                dibuka === kunci
                                  ? "border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                              )}
                            >
                              {dibuka === kunci ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                              Rincian
                            </button>

                            {/* ============================================
                                JALAN KE STATUS PERKARA, DIKEMBALIKAN
                                ============================================

                                Kotak nomor perkara dahulu membuka status
                                perkara. Begitu ia dialihkan ke layar hasil
                                sidang, jalan ke status perkara HILANG - dan
                                hilangnya tidak berbunyi apa-apa: tombolnya
                                masih ada, hanya membuka tempat yang berbeda.

                                Dikembalikan sebagai tombolnya sendiri di
                                bawah Rincian, bukan dengan menarik pulang
                                kotak nomornya: keduanya dibutuhkan, dan yang
                                satu tidak boleh menggantikan yang lain. */}
                            {tampil(tampilan, "tombol-status-perkara") && onBukaStatus ? (
                              <button
                                type="button"
                                onClick={() => onBukaStatus(baris.nomorPerkara)}
                                title={`Buka status perkara ${baris.nomorPerkara}`}
                                className="inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                              >
                                <FileSearch className="h-3.5 w-3.5" />
                                Status
                              </button>
                            ) : null}

                            {/* JADWAL-3 tambahan B (19 Okt 2026): Blangko ABT by Derry
                                dengan perkara + jenis blangko sesuai keadaan sidang -
                                ikrar = blangko ikrar/BAS, putus/akan putus = putusan/BAS,
                                selain itu BAS. Disaring hak peran; tidak menulis apa pun. */}
                            {tampil(tampilan, "tombol-blangko") ? (
                              <TombolBlangkoDerry
                                data={{
                                  nomor: baris.nomorPerkara,
                                  perkaraId: baris.perkaraId,
                                  sidangKe: baris.urutanSidang,
                                  tanggalSidang: baris.tanggalSidang,
                                  agenda: baris.agenda,
                                  tunda: baris.alasanDitunda,
                                  keterangan: keterangan[String(baris.perkaraId)]?.terkini?.isi ?? "",
                                  amar: baris.sudahPutus ? baris.statusPutusan : "",
                                  verstek: baris.sudahPutus ? Boolean(baris.verstekPutusan) : null,
                                  jumlahSaksiP: baris.saksiPihak1 ?? 0,
                                  jumlahSaksiT: baris.saksiPihak2 ?? 0,
                                }}
                                jenis={saringJenisBlangko(
                                  jenisBlangkoMenurutKeadaan({
                                    ikrarTalak: Boolean(baris.sidangIkrarTalak),
                                    sudahPutus: baris.sudahPutus,
                                    akanPutus: hariPutusan(baris),
                                  }),
                                  jenisBlangkoPeran
                                )}
                                setelanAps={setelanAps}
                              />
                            ) : null}

                            {/* ============================================
                                PERTANYAAN SAKSI - TOMBOL KECIL, BUKAN BAGIAN TERBUKA
                                ============================================

                                Diminta hakim 18 Okt 2026: panduan tidak boleh terbuka
                                sendiri di rincian. Hanya tombol ini; ditekan, panduan
                                (pokok wajib, centang, layar sidang, cetak) keluar sebagai
                                jendela pop-up. Tampil HANYA bila perkaranya sudah masuk
                                pemeriksaan menurut aplikasi antrian: disidang 1..9
                                (sedang di ruang) atau 10 (selesai hari itu, supaya PP
                                masih dapat melengkapi). Mengantre atau belum ada
                                antrian = tidak tampil. Perkara tanpa nomor antrian yang ditandai
                                petugas sedang berjalan, diskors, atau selesai ikut dihitung
                                (keputusan pengguna 18 Okt). Hak peran ditegakkan komponennya. */}
                            {tampil(tampilan, "pertanyaan-saksi") &&
                            sudahMasukPemeriksaan(disidangPerKunci[kunciTiga], {
                              berjalan: Boolean(berjalanIni),
                              diskors: Boolean(skorsIni),
                              selesai: selesaiTanda.ditandai,
                            }) ? (
                              <PanduanPemeriksaanSaksi
                                {...bahanPanduDariBaris(baris, institutionIdentity?.courtName || "")}
                                bentuk="tombol"
                                kunciBagian="sidang-pandu-saksi"
                                pengguna={currentUser}
                              />
                            ) : null}

                            {/* =============================================
                                URUTAN KOLOM KANAN (2 Okt 2026 malam):
                                Rincian, Status, lalu Selesai PALING BAWAH.
                                Skors / Lompat / Lanjutkan / Tandai berjalan
                                duduk di antara Status dan Selesai - tidak ada
                                tombol yang hilang, hanya urutannya. */}
                            {/* Skors / Lompat ke sini / Lanjutkan / Tandai berjalan - butir 10
                                (2 Okt 2026). Tidak pernah pada baris hijau. */}
                            {/* HAK-PERAN 12 Okt: hanya golongan sidang.jalannya / sidang.antrian */}
                            {bolehJalannya && tampil(tampilan, "tombol-ruang-sidang") ? (
                            <TombolRuangSidang
                              baris={baris}
                              aksi={aksiRuang}
                              berjalan={berjalanIni}
                              skors={skorsIni}
                              bisaDipanggil={bisaDipanggilIni}
                              info={infoRuangSidang}
                              ruang={ruangIni}
                              onBerubah={() => {
                                tandaSelesai.muatUlang();
                                void muatTanggal(dari, sampai, nilaiKesiapan);
                              }}
                            />
                            ) : null}
                            {/* Selesai - sinkron dua arah dengan antrian sidang
                                (perbaikan 1 Okt 2026, J2). */}
                            {bolehJalannya && tampil(tampilan, "tombol-selesai-sidang") ? (
                            <TombolSelesaiSidang
                              baris={baris}
                              keadaan={selesaiTanda}
                              onBerubah={tandaSelesai.muatUlang}
                            />
                            ) : null}
                            {/* === 12OKT-L: pernah diskors - tepat di bawah tombol Selesai === */}
                            <PenandaPernahDiskorsView penanda={pernahDiskorsIni(baris)} />
                            {/* === AKHIR 12OKT-L === */}
                          </div>
                        </td>
                      </tr>

                      {/* Borang catat hasil - baris tersendiri selebar tabel.
                          Di dalam sel nomor perkara ia akan memaksa kolomnya
                          selebar borangnya, dan seluruh tabel ikut bergeser. */}
                      {catat?.kunci === kunci ? (
                        <tr className="border-t border-border bg-amber-500/[0.06] dark:bg-amber-400/[0.06]">
                          <td className="max-w-0 p-0 align-top" colSpan={kolomTabel}>
                            {/* ==========================================
                                LEBARNYA DIKUNCI DUA ARAH, DAN ISINYA MENGGULUNG
                                ==========================================

                                `width` SAJA tidak cukup, dan itulah sebab
                                halaman tertarik ke samping tiap kali rincian
                                dibuka. Lebar yang disetel hanya menyatakan
                                lebar YANG DIINGINKAN; isi yang lebih lebar -
                                satu tabel relaas, satu nama tanpa spasi, satu
                                kisi dua kolom - tetap memaksa sel tabelnya
                                melebar, dan tabel yang melebar menyeret
                                seluruh halaman.

                                Tiga hal sekaligus yang mengunciNya:

                                  maxWidth   melarang melar melewati yang
                                             terlihat;
                                  minWidth 0 mematahkan lebar minimum bawaan
                                             simpul flex/grid di dalamnya -
                                             tanpa ini, isi yang lebar tetap
                                             menang atas maxWidth;
                                  overflow-x-auto  memberi isi yang memang
                                             lebar tempatnya sendiri untuk
                                             menggulung, alih-alih mendorong.

                                Yang menggulung kini rinciannya saja, bukan
                                seluruh daftar sidang. */}
                            <div
                              className="sticky left-0 overflow-x-auto border-l-4 border-l-amber-500 px-4 py-3"
                              style={
                                lebarTampak > 0
                                  ? { width: `${lebarTampak}px`, maxWidth: `${lebarTampak}px`, minWidth: 0 }
                                  : undefined
                              }
                            >
                              <CatatHasilRingkas
                                jadwalId={baris.sidangId}
                                nomorPerkara={baris.nomorPerkara}
                                jalan={catat.jalan}
                                onTutup={() => setCatat(null)}
                                onSelesai={(hasilTulis) => {
                                  // 22 Okt 2026: baris langsung berubah dari jawaban penulisan, satu bacaan ringan
                                  // membenarkannya seketika, lalu jadwal lengkap menyusul seperti semula.
                                  if (hasilTulis) setSidang((lama) => terapkanHasilTulis(lama, baris.sidangId, hasilTulis));
                                  void segarkanRingan().finally(() => void muatTanggal(dari, sampai, nilaiKesiapan));
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      ) : null}

                      {/* Baris rincian diberi latar lebih gelap dan garis kiri:
                          pada tabel panjang, tanpa penanda itu tidak jelas
                          rincian ini milik baris yang mana. */}
                      {dibuka === kunci ? (
                        <tr className="border-t border-border bg-muted/40">
                          <td className="max-w-0 p-0 align-top" colSpan={kolomTabel}>
                            {/* Dipaku pada tepi kiri yang TERLIHAT, selebar
                                yang terlihat - lihat sebab (1) pada catatan
                                lebarTampak. Tanpa lebar terukur ia jatuh ke
                                perilaku lama, bukan ke nol: peladen menggambar
                                halaman ini sebelum ada yang dapat diukur. */}
                            <div
                              className="sticky left-0 overflow-x-auto border-l-4 border-l-primary px-4 py-4"
                              style={
                                lebarTampak > 0
                                  ? { width: `${lebarTampak}px`, maxWidth: `${lebarTampak}px`, minWidth: 0 }
                                  : undefined
                              }
                            >
                              {memuatRincian ? (
                                <div className="min-h-[6rem]" aria-busy="true" />
                              ) : (
                                <RincianSidang
                                  rincian={rincian}
                                  nomorPerkara={baris.nomorPerkara}
                                  perkaraId={baris.perkaraId}
                                  sidangId={baris.sidangId}
                                  tunjukan={tunjukan[String(baris.perkaraId)]}
                                  mediator={mediatorIni} /* 12OKT-C */
                                  tampilCatatanHitung={tampil(tampilan, "catatan-cara-hitung")}
                                  durasi={baris.durasi}
                                  pembebanan={sidangIkrar(baris) ? baris.pembebanan ?? null : null}
                                  penanda={baris} /* 12OKT-B */
                                  aktifPenandaPerkara={aktifPenandaPerkara}
                                  aktifPenandaPekerjaan={aktifPenandaPekerjaan}
                                  pihakHadir={hadirIni(baris)} /* 12OKT-H */
                                  /* === 12OKT-A: kumulasi perkara === */
                                  kumulasi={tampil(tampilan, "kumulasi-perkara") && baris.kumulasiTerbaca ? baris.kumulasi ?? null : undefined}
                                  /* === AKHIR 12OKT-A === */
                                  /* === 12OKT-K: eksepsi/rekonvensi, sita, eksekusi di rincian === */
                                  jawabanSita={baris}
                                  tampilJawaban={tampil(tampilan, "penanda-jawaban")}
                                  tampilSita={tampil(tampilan, "penanda-sita")}
                                  tampilEksekusi={tampil(tampilan, "penanda-eksekusi") /* 12OKT-N */}
                                  /* === AKHIR 12OKT-K === */
                                  tandaOnline={
                                    tampil(tampilan, "tanda-antrian-online")
                                      ? tandaAntrianOnline(antrianUntuk(antrian.peta, baris))
                                      : null
                                  }
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                  // K13: saklar mati = jalur lama persis (baris digambar langsung).
                  if (!tabelRingan) return gambarBaris();
                  const pid = String(baris.perkaraId);
                  const berbuka = dibuka === kunci;
                  const kunciHadirIni = kunciKehadiran(baris.perkaraId, baris.tanggalSidang);
                  return (
                    <BarisTabelRingan
                      key={kunci}
                      gambar={gambarBaris}
                      deps={[
                        ...depsBarisBersama,
                        urutan,
                        sidik(baris),
                        sidik(sidangSelesai),
                        sidik(selesaiTanda),
                        sidik(tigaBaris),
                        // Teks tetangga tiga jarak bergantung pada daftar sidang (perkara lain).
                        tigaBaris
                          ? [tigaBaris.tunggu, tigaBaris.dariSebelumnya, tigaBaris.lamaSidang]
                              .map((j) => (j.tetangga ? tetanggaLangsung(j.tetangga, baris.tanggalSidang) : ""))
                              .join("|")
                          : "",
                        sidik(berjalanIni),
                        sidik(skorsIni),
                        ruangIni,
                        bisaDipanggilIni,
                        sidik(aksiRuang),
                        infoLangsung(String(baris.perkaraId)).nomorPerkara,
                        aksiRuang.asal ? infoLangsung(String(aksiRuang.asal.perkaraId)).nomorPerkara : "",
                        mediatorIni,
                        sidik(nilaiKesiapan ? kesiapan[kunci] : undefined),
                        sidik(tunjukan[pid]),
                        sidik(checklistTanpaTunjukan[pid]),
                        sidik(drafH7[pid]),
                        sidik(keterangan[pid]),
                        keteranganKunci === kunci,
                        tunjukKunci === kunci,
                        berbuka,
                        catat?.kunci === kunci ? catat.jalan : "",
                        berbuka ? rincian : null,
                        berbuka && memuatRincian,
                        berbuka ? lebarTampak : 0,
                        sidik(antrianUntuk(antrian.peta, baris)),
                        sidik(antrian.kehadiran?.[kunciHadirIni]?.hadir),
                        sidik(barisWaktuPerKunci[kunciTiga]),
                        sidik(disidangPerKunci[kunciTiga]),
                        sidik(hadirIni(baris)),
                        sidik(pernahDiskorsIni(baris)),
                        saksiLipat.terbuka(kunciBarisSaksi(baris.perkaraId, "P")),
                        saksiLipat.terbuka(kunciBarisSaksi(baris.perkaraId, "T")),
                        sidik(tarikBelumUpload.keadaanUntuk(baris.nomorPerkara)),
                        sidik(tampil(tampilan, "verifikasi-majelis") ? penandaVerifikasi(baris, verifikasi, hariIni()) : null),
                      ]}
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Yang dicetak adalah yang SEDANG TAMPIL, bukan seluruh yang termuat.
            Menyaring ke Retur lalu menekan Cetak sebelumnya menghasilkan lembar
            berisi seluruh sidang hari itu - dan lembar itu dibagikan ke orang
            lain sebagai daftar yang benar. */}
        {sedangCetak ? (
          <AletaEcourtCetakJadwal
            /* 22 Okt 2026: nama majelis diganti hakim yang menyidangkan (kode tetap). */
            sidang={sidangTampil.map((b) => ({ ...b, majelisNama: majelisTampil(b, pilihanHakim).nama }))}
            bagianHakim={
              cetakPerHakim
                ? kelompokPerHakim(
                    sidangTampil.map((b) => ({ ...b, majelisNama: majelisTampil(b, pilihanHakim).nama })),
                    pilihanHakim
                  )
                : undefined
            }
            antrian={antrian.peta}
            catatanSaringan={
              sidangTampil.length === sidang.length
                ? ""
                : `Daftar tersaring: ${sidangTampil.length} dari ${sidang.length} sidang.`
            }
            dari={dari}
            sampai={sampai}
            namaPengadilan={institutionIdentity.courtName || "PENGADILAN AGAMA"}
            onSelesai={() => setSedangCetak(false)}
          />
        ) : null}

        {/* Tanggal bawaannya hari yang sedang tampil bila rentangnya satu
            hari DAN hari itu dipilih orang; rentang beberapa hari tidak punya
            "hari itu", dan "hari ini" Antrian mengikuti jam peramban (bisa
            masih kemarin pada komputer berzona lain) - dalam keduanya dialog
            memakai hari ini menurut jam pengadilan. */}
        {bolehCetakRelaas && cetakRelaasTerbuka ? (
          <DialogCetakRelaas
            tanggalAwal={dari === sampai ? dari : ""}
            hariIniAntrian={hariIni()}
            onTutup={() => setCetakRelaasTerbuka(false)}
          />
        ) : null}

        {penetapanKembaliTerbuka && bolehPenetapanKembali ? (
          <PopupPenetapanKembali sidang={sidang} onTutup={() => setPenetapanKembaliTerbuka(false)} />
        ) : null}
        {kasirTerbuka && bolehKasirJurnal ? <DialogKasir daftar={sidang} onTutup={() => setKasirTerbuka(false)} /> : null}
        {kasirHarian.boleh && kasirHarian.buka ? (
          <DialogKasirHarian tabAwal={kasirHarian.buka} onTutup={kasirHarian.tutup} hanyaBaca={kasirHarian.hanyaBaca} />
        ) : null}

        {kalenderTerbuka ? (
          <KalenderSidang
            bulanAwal={dari.slice(0, 7)}
            tanggalTerpilih={dari}
            onPilih={pilihHari}
            onTutup={() => setKalenderTerbuka(false)}
          />
        ) : null}
      </CardContent>
    </Card>
    </UnduhTertutupTautan.Provider>
  );
}

/** Bagian rincian yang muncul saat satu sidang dibuka. */
export function RincianSidang({
  rincian,
  nomorPerkara,
  perkaraId,
  sidangId,
  tunjukan,
  mediator = "", /* 12OKT-C */
  tampilCatatanHitung,
  durasi,
  tandaOnline = null,
  pembebanan = null,
  penanda,
  aktifPenandaPerkara = false,
  aktifPenandaPekerjaan = false,
  pihakHadir = { pihak1: false, pihak2: false }, /* 12OKT-H */
  /* === 12OKT-A: kumulasi perkara === */
  kumulasi = undefined,
  /* === AKHIR 12OKT-A === */
  /* === 12OKT-K === */
  jawabanSita = undefined,
  tampilJawaban = false,
  tampilSita = false,
  tampilEksekusi = false /* 12OKT-N */,
  /* === AKHIR 12OKT-K === */
}: {
  /* === 12OKT-B: penanda perkara & pihak di rincian (dikirim dari barisnya) === */
  penanda?: BahanPenandaBaris;
  aktifPenandaPerkara?: boolean;
  aktifPenandaPekerjaan?: boolean;
  /** 12OKT-H: sisi yang sudah hadir hari ini (kosong bila saklar pihak-hadir mati). */
  pihakHadir?: { pihak1: boolean; pihak2: boolean };
  /* === AKHIR 12OKT-B === */
  /* === 12OKT-A: kumulasi perkara === */
  /**
   * Kumulasi dari baris (12 Okt 2026). undefined = saklar mati: badge lama
   * "Kumulasi: ..." dari identitas SIPP tetap tergambar seperti dulu.
   * null = saklar menyala, tidak berkumulasi.
   */
  kumulasi?: KumulasiPerkara | null;
  /* === AKHIR 12OKT-A === */
  /* === 12OKT-K: eksepsi/rekonvensi, sita, eksekusi (dari barisnya) === */
  jawabanSita?: BahanRincianJawabanSita;
  tampilJawaban?: boolean;
  tampilSita?: boolean;
  tampilEksekusi?: boolean; /* 12OKT-N: saklar penanda-eksekusi */
  /* === AKHIR 12OKT-K === */
  rincian: Rincian | null;
  nomorPerkara: string;
  perkaraId: string;
  /**
   * Umur perkara, dikirim dari barisnya.
   *
   * Tidak dibaca ulang di sini: angkanya sudah dihitung bot untuk seluruh
   * daftar dalam satu kueri, dan menghitungnya sekali lagi di panel berarti
   * melahirkan angka kedua yang suatu hari akan berbeda dari yang pertama -
   * tanpa satu pun tanda di layar yang memberi tahu mana yang benar.
   */
  durasi?: SidangBaris["durasi"];
  /** Sidang yang sedang dibuka - pemisah antara panggilan hari ini dan riwayat. */
  sidangId: string;
  /** Tunjukan konseptor sementara perkara ini - lihat SelKonseptorSementara. */
  tunjukan?: KonseptorSementara;
  /**
   * 12OKT-C (butir 6): nama mediator untuk bagian Majelis dan petugas. Sudah
   * dihitung di baris (mediatorBaris + saklar mediator-majelis); "" = tidak
   * ada / saklar mati / belum ditunjuk pada hari sidang ini.
   */
  mediator?: string;
  /** Catatan cara menghitung digambar atau tidak - lihat CatatanCaraHitung. */
  tampilCatatanHitung: boolean;
  /**
   * Tanda antrian online sidang ini (butir 4, 2 Okt sore) - sudah dihitung di
   * baris dengan saklarnya; null = tidak online atau saklarnya mati.
   */
  tandaOnline?: TandaOnline | null;
  /**
   * Pembebanan saat ikrar talak (6 Okt 2026) - dikirim dari baris, dan HANYA
   * bila baris itu sidang ikrar. null = bagiannya tidak digambar.
   */
  pembebanan?: PembebananIkrar | null;
}) {
  /**
   * Urutan sidang menurut sidangId - dari jadwal perkara, bukan dari urutan
   * baris relaas.
   *
   * Satu sidang dapat punya beberapa relaas (penggugat, tergugat, kuasa).
   * Menomori ulang daftar relaas akan menyebut "sidang ke-5" untuk relaas
   * kelima pada sidang kedua - angka yang tampak pasti dan salah.
   *
   * DI ATAS early return, dan itu bukan pilihan gaya: hook harus dipanggil
   * pada urutan yang sama tiap kali komponen digambar. Ditaruh di bawahnya, ia
   * dilewati pada perkara yang rinciannya gagal dibaca - dan React kehilangan
   * jejak hook mana milik siapa. eslint yang menangkapnya, bukan tsc.
   *
   * Karena itu dibaca dari `rincian` langsung, bukan dari `sipp` yang baru
   * lahir sesudah early return.
   */
  const urutanSidangPer = useMemo(() => {
    const peta = new Map<string, number>();
    for (const jadwal of rincian?.sipp?.jadwalPerkara ?? []) {
      const id = String(jadwal.sidangId || "");
      const urut = Number(jadwal.urutanSidang);
      if (id && Number.isFinite(urut) && urut > 0) peta.set(id, urut);
    }
    return peta;
  }, [rincian?.sipp?.jadwalPerkara]);

  /**
   * Tanggal sidang -> sidang keberapa.
   *
   * Dokumen e-Court tidak membawa sidang_id; yang dimilikinya tanggal sidang.
   * Peta ini menjembataninya supaya berkas jawab-menjawab pun dapat menyebut
   * sidang keberapa ia dipertukarkan.
   *
   * Tanggal yang dipakai SATU HARI saja (sepuluh huruf pertama) - SIPP
   * menuliskannya kadang beserta jam, dan dua bentuk yang sama harinya tidak
   * boleh menjadi dua kunci yang berbeda.
   *
   * Hari yang memuat LEBIH DARI SATU sidang tidak dipetakan sama sekali:
   * menebak salah satunya berarti menempelkan nomor yang keliru pada berkas
   * perkara, dan nomor yang keliru di sana lebih buruk daripada tidak ada
   * nomor.
   */
  const urutanSidangPerTanggal = useMemo(() => {
    const hitung = new Map<string, number[]>();
    for (const jadwal of rincian?.sipp?.jadwalPerkara ?? []) {
      const hari = String(jadwal.tanggalSidang || "").slice(0, 10);
      const urut = Number(jadwal.urutanSidang);
      if (!hari || !Number.isFinite(urut) || urut <= 0) continue;
      hitung.set(hari, [...(hitung.get(hari) ?? []), urut]);
    }
    const peta = new Map<string, number>();
    for (const [hari, daftar] of hitung) {
      if (daftar.length === 1) peta.set(hari, daftar[0]);
    }
    return peta;
  }, [rincian?.sipp?.jadwalPerkara]);

  if (!rincian) {
    return <p className="text-xs text-muted-foreground">Keterangan sidang tidak dapat dibaca.</p>;
  }

  const sipp = rincian.sipp;
  const identitas = rincian.identitas;
  // Tanggal sidang yang sedang dibuka - untuk aksi e-Court (K5).
  const tanggalSidangIni = String(
    sipp?.jadwalPerkara?.find((x) => x.sidangId === sidangId)?.tanggalSidang ?? ""
  ).slice(0, 10);
  // Disalin ke konstanta supaya penyempitan tipenya bertahan di dalam map -
  // TypeScript melepas penyempitan begitu masuk fungsi lain.
  const kesiapan = rincian.kesiapan;

  /**
   * Hasil sidang YANG SEDANG DIBUKA, bila ia berbunyi putus.
   *
   * Dibaca dari jadwalPerkara dan dicocokkan lewat sidangId - bukan dari
   * sidang terakhir dalam daftar. Perkara yang sesudah putusannya masih punya
   * sidang ikrar talak akan menaruh ikrar itu di urutan terakhir, dan
   * membacanya dari sana akan menjawab pertanyaan tentang sidang yang salah.
   */
  const hasilPutusSidangIni = hasilSidangPutusan(
    Boolean(sipp?.jadwalPerkara?.find((x) => x.sidangId === sidangId)?.ditunda),
    String(sipp?.jadwalPerkara?.find((x) => x.sidangId === sidangId)?.alasanDitunda ?? "")
  );

  // Relaas dipisah menurut sidangnya. Baris yang tidak menyebut sidang mana
  // pun ikut ke RIWAYAT, bukan ke sidang ini: menempelkannya pada sidang yang
  // sedang dibuka berarti menyatakan panggilan untuk hari ini sudah ada
  // padahal belum tentu - dan itu keputusan yang menentukan sidang dilanjutkan
  // atau ditunda.
  // Verzet dikenali dari jenis perkaranya - SIPP tidak menyimpan penanda
  // tersendiri untuknya. Aturannya satu, dipakai daftar maupun rincian.
  const perkaraVerzet = perkaraVerzetDari(
    rincian.identitas?.jenisPerkara,
    (rincian.identitas?.kumulasi ?? []).join(" ")
  );

  const seluruhRelaas = rincian.sipp?.relaas ?? [];
  const relaasSidangIni = seluruhRelaas.filter(
    (baris) => sidangId && String(baris.sidangId ?? "") === String(sidangId)
  );
  const relaasRiwayat = seluruhRelaas.filter(
    (baris) => !sidangId || String(baris.sidangId ?? "") !== String(sidangId)
  );

  // Pita Waktu Putus SK Dirjen Badilag 048/2024 - nilainya dari bot, layar
  // hanya menerjemahkannya ke warna (lib/pita-waktu-putus).
  const pitaSk = pitaWaktuPutus(durasi?.waktuPutusSk?.nilai);

  // Keterangan di kepala bagian yang terciut sebagai bawaan. Tanpa itu,
  // yang tidak membukanya tidak tahu apa pun tentang isinya - termasuk bahwa
  // di dalamnya ada penghambat BERAT. Disusun di sini, bukan di dalam tag,
  // supaya tag Bagian tetap sebaris sederhana.
  // Pelanggaran SEMA ikut disebut di kepala: bagian ini TERCIUT sebagai
  // bawaan, dan tanpa ini kewajiban lapornya hanya terlihat oleh yang
  // membukanya.
  const keteranganWaktu =
    durasi && durasi.hariBersih !== null
      ? `${durasi.hariBersih} hari${pitaSk ? ` · ${pitaSk.warna}` : ""}${
          !durasi.sudahPutus && durasi.sisaHari !== null && durasi.sisaHari < 0
            ? " · lewat 5 bulan"
            : ""
        }`
      : "";
  const keteranganKesiapan = (() => {
    if (!kesiapan) return "";
    const tingkat = (["berat", "sedang", "ringan"] as const)
      .map((n) => [n, kesiapan.penghambat.filter((x) => x.tingkat === n).length] as const)
      .filter(([, jumlah]) => jumlah > 0)
      .map(([n, jumlah]) => `${jumlah} ${n}`);
    return tingkat.length > 0 ? tingkat.join(" · ") : "tanpa penghambat";
  })();

  return (
    <div className="space-y-3">
      {rincian.pesanSipp ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {rincian.pesanSipp}
        </p>
      ) : null}

      {/* --- Penanda perkara --- */}
      {/* Nomor perkara diulang di kepala rincian: pada tabel panjang, pembaca
          yang sudah menggulung ke bawah kehilangan jejak baris asalnya. */}
      <div className="flex flex-wrap items-baseline gap-2">
        <h4 className="text-lg font-extrabold tracking-tight">{nomorPerkara}</h4>
        {/* Verzet ditandai di samping nomornya di sini juga - sama seperti di
            daftar. Yang membuka rincian tidak selalu datang dari daftar. */}
        {perkaraVerzet ? (
          <Badge variant="danger" title="Perkara perlawanan terhadap putusan verstek.">
            verzet
          </Badge>
        ) : null}
        {/* === 12OKT-B: Ghaib / Prodeo / Non e-Court di rincian === */}
        <LencanaPerkaraBaris baris={penanda ?? {}} aktif={aktifPenandaPerkara} />
        {/* === AKHIR 12OKT-B === */}
        {sipp ? (
          <span className="text-xs text-muted-foreground">{sipp.majelis.length} hakim</span>
        ) : null}
      </div>

      {/* Asal nomor antrian - kalimat utuh di Rincian, ikon saja di baris. */}
      <TandaAntrianOnlineRincian tanda={tandaOnline} />

      {/* Email dan persetujuan saluran elektronik para pihak (2 Okt 2026
          malam, butir 1f) - bahan tanggal tunda karena ketidakhadiran. */}
      <KontakPihakRincian perkaraId={perkaraId} nomorPerkara={nomorPerkara} />

      {/* === 12OKT-A: kumulasi perkara === */}
      <RincianKumulasi kumulasi={kumulasi} />
      {/* === AKHIR 12OKT-A === */}

      {/* === 12OKT-K: eksepsi/rekonvensi, sita, eksekusi === */}
      {jawabanSita ? (
        <RincianJawabanSitaEksekusi bahan={jawabanSita} tampilJawaban={tampilJawaban} tampilSita={tampilSita} tampilEksekusi={tampilEksekusi} />
      ) : null}
      {/* === AKHIR 12OKT-K === */}

      {identitas ? (
        <div className="flex flex-wrap gap-1">
          {/* Jenis perkara ditebalkan: ia menentukan jalan perkaranya, dan
              sebelumnya sekelabu penanda di sebelahnya. */}
          {identitas.jenisPerkara ? (
            <Badge variant="outline" className="font-bold">
              {identitas.jenisPerkara}
            </Badge>
          ) : null}
          {/* === 12OKT-A: kumulasi perkara === */}
          {identitas.adaKumulasi && kumulasi === undefined ? (
            <Badge variant="muted">Kumulasi: {identitas.kumulasi.join(", ")}</Badge>
          ) : null}
          {/* === AKHIR 12OKT-A === */}
          {identitas.adaKuasa ? (
            <Badge variant="default">
              Kuasa:{" "}
              {[
                identitas.kuasaPenggugat ? "penggugat/pemohon" : "",
                identitas.kuasaTergugat ? "tergugat/termohon" : "",
              ]
                .filter(Boolean)
                .join(" & ")}
            </Badge>
          ) : (
            <Badge variant="muted">Tanpa kuasa hukum</Badge>
          )}
          {/* ==================================================================
              SAKSI: BERAPA DARI TIAP SISI, BUKAN SEKADAR ADA ATAU TIDAK
              ==================================================================

              Dua pertanyaan yang berbeda, dan sebelumnya hanya satu terjawab:

                saksi DIAJUKAN   namanya terdaftar - inilah yang ditanyakan
                                 sebelum sidang, dan yang menentukan berapa
                                 lama pemeriksaan akan berlangsung;
                saksi DIPERIKSA  keterangannya sudah tercatat di SIPP.

              Penanda lama hanya menyebut yang kedua, dan berbunyi "Belum ada
              keterangan saksi" pada perkara yang sebenarnya sudah mengajukan
              empat saksi - terbaca seolah tidak ada saksi sama sekali. */}
          {sipp?.saksi?.adaDiajukan ? (
            <Badge variant="success" title="Saksi yang diajukan tiap pihak.">
              {[
                sipp.saksi.diajukanPihak1 > 0 ? `Saksi P: ${sipp.saksi.diajukanPihak1}` : "",
                sipp.saksi.diajukanPihak2 > 0 ? `Saksi T: ${sipp.saksi.diajukanPihak2}` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
              {sipp.saksi.ada ? ` · ${sipp.saksi.jumlahSaksi} diperiksa` : ""}
            </Badge>
          ) : sipp?.saksi?.ada ? (
            /* Ada keterangan tetapi tidak ada yang terdaftar diajukan -
               keadaan yang tidak seharusnya terjadi, dan disebut apa adanya
               daripada dipaksa masuk salah satu bentuk di atas. */
            <Badge variant="warning" title="Keterangan saksi tercatat, tetapi saksinya tidak terdaftar diajukan pihak mana pun.">
              Saksi diperiksa: {sipp.saksi.jumlahSaksi}, pengajunya tidak tercatat
            </Badge>
          ) : (
            <Badge variant="muted">Belum ada saksi</Badge>
          )}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* --- Majelis dan petugas --- */}
        {/* Majelis & petugas dan Identitas pihak TERLIPAT sebagai bawaan -
            diminta pengguna 1 Okt 2026 (J6). Kuncinya tidak diganti: yang
            pernah membukanya sendiri tetap mendapati pilihannya. */}
        <Bagian judul="Majelis dan petugas" kunci="sidang-majelis" ciutBawaan>
          {sipp && sipp.majelis.length > 0 ? (
            <ul className="space-y-0.5 text-sm">
              {sipp.majelis.map((anggota) => (
                <li key={anggota.kode + anggota.nama}>
                  <span className="font-mono text-sm">{anggota.kode || "—"}</span>{" "}
                  <span className="font-medium">{anggota.nama}</span>
                  {anggota.jabatan ? (
                    <span className="text-xs text-muted-foreground"> · {anggota.jabatan}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Majelis belum ditetapkan.</p>
          )}

          <p className="mt-2 text-sm">
            <span className="text-xs text-muted-foreground">Panitera sidang: </span>
            {sipp && sipp.panitera.length > 0
              ? sipp.panitera.map((orang) => orang.nama).join(", ")
              : "—"}
          </p>
          <p className="text-sm">
            <span className="text-xs text-muted-foreground">Jurusita: </span>
            {sipp && sipp.jurusita.length > 0
              ? sipp.jurusita.map((orang) => orang.nama).join(", ")
              : "—"}
          </p>
          {/* === 12OKT-C: mediator di bawah jurusita (butir 6) === */}
          {mediator ? (
            <p className="text-sm" data-rincian-mediator="">
              <span className="text-xs text-muted-foreground">Mediator: </span>
              {mediator}
            </p>
          ) : null}
          {/* === AKHIR 12OKT-C === */}
        </Bagian>

        {/* --- Para pihak --- */}
        <Bagian judul="Identitas pihak" kunci="sidang-pihak" ciutBawaan>
          {/* ==================================================================
              DIPISAH MENURUT KEDUDUKAN, KUASA MENEMPEL PADA YANG DIWAKILINYA
              ==================================================================

              Sebelumnya seluruhnya satu daftar berurutan, dan kedudukan tiap
              orang hanya tertulis sebagai keterangan kecil di belakang
              namanya. Pada perkara berkuasa hukum dan bersaksi, daftar itu
              menjadi tujuh baris yang harus dibaca satu per satu untuk
              menjawab pertanyaan paling sederhana: siapa penggugatnya.

              Kuasa hukum ditaruh DI BAWAH pihak yang diwakilinya, bukan pada
              kelompoknya sendiri. Kuasa tidak berdiri sendiri di persidangan -
              ia hadir UNTUK seseorang, dan memisahkannya menjadi kelompok
              tersendiri memutus keterangan yang justru menentukan siapa yang
              boleh berbicara.

              Kelompok yang kosong tidak digambar sama sekali. Judul "Saksi"
              di atas ruang kosong menyatakan sesuatu yang tidak dinyatakan
              siapa pun. */}
          {rincian.pihak.length === 0 ? (
            <p className="text-xs text-muted-foreground">Pihak belum tercatat.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {[
                { judul: "Penggugat / Pemohon", sisi: 1 },
                { judul: "Tergugat / Termohon", sisi: 2 },
              ].map((kelompok) => {
                const pihak = rincian.pihak.filter(
                  (orang) => orang.jenis !== "kuasa" && orang.pihakKe === kelompok.sisi
                );
                const kuasa = rincian.pihak.filter(
                  (orang) => orang.jenis === "kuasa" && orang.pihakKe === kelompok.sisi
                );
                if (pihak.length === 0 && kuasa.length === 0) return null;
                return (
                  <div key={kelompok.judul}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {kelompok.judul}
                    </p>
                    <ul className="space-y-0.5">
                      {pihak.map((orang, urutan) => (
                        <li key={`${orang.nama}-${urutan}`}>
                          <NamaPihakHadir aktif hadir={kelompok.sisi === 1 ? pihakHadir.pihak1 : pihakHadir.pihak2}>{/* 12OKT-H */}
                            <span className="font-medium">{orang.nama}</span>
                          </NamaPihakHadir>
                          <LencanaPekerjaanBaris baris={penanda ?? {}} nama={[orang.nama]} aktif={aktifPenandaPekerjaan} />{/* 12OKT-B */}
                          <span className="text-xs text-muted-foreground">
                            {orang.adaNomor ? ` · ${orang.nomorSamar}` : " · tanpa nomor"}
                          </span>
                        </li>
                      ))}
                      {kuasa.map((orang, urutan) => (
                        <li key={`kuasa-${orang.nama}-${urutan}`} className="pl-3">
                          <span className="text-xs text-muted-foreground">kuasa: </span>
                          <span className="font-medium">{orang.nama}</span>
                          <span className="text-xs text-muted-foreground">
                            {orang.adaNomor ? ` · ${orang.nomorSamar}` : " · tanpa nomor"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}

              {/* Saksi berdiri sendiri: ia bukan pihak, tidak punya kuasa, dan
                  kehadirannya tidak menentukan sah tidaknya panggilan. */}
              {(() => {
                const saksi = rincian.pihak.filter(
                  (orang) =>
                    orang.jenis !== "kuasa" && orang.pihakKe !== 1 && orang.pihakKe !== 2
                );
                if (saksi.length === 0) return null;
                return (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Saksi
                    </p>
                    <ul className="space-y-0.5">
                      {saksi.map((orang, urutan) => (
                        <li key={`saksi-${orang.nama}-${urutan}`}>
                          <span className="font-medium">{orang.nama}</span>
                          <span className="text-xs text-muted-foreground">
                            {orang.adaNomor ? ` · ${orang.nomorSamar}` : " · tanpa nomor"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
            </div>
          )}
        </Bagian>
      </div>

      {/* Proses mediasi (J7, 1 Okt 2026) - HANYA bila perkaranya punya
          mediasi; tanpa mediasi komponen ini tidak menggambar apa pun. */}
      <ProsesMediasiRincian perkaraId={perkaraId} cadangan={durasi?.mediasi} />

      {/* ==================================================================
          RELAAS PANGGILAN - SIDANG INI LEBIH DULU, RIWAYATNYA SESUDAHNYA
          ==================================================================

          Naik ke sini dari urutan kelima. Sesudah tahu siapa majelisnya dan
          siapa para pihaknya, yang ditanya berikutnya selalu sama: sudah
          dipanggil atau belum, dan bagaimana hasilnya. Menaruhnya di bawah
          putusan dan jadwal berarti pertanyaan yang paling sering diajukan
          dijawab paling akhir.

          Panggilan untuk sidang INI dipisah dari riwayatnya. Keduanya
          menjawab hal yang berbeda: yang pertama menentukan sidang hari ini
          dapat dilanjutkan atau tidak, yang kedua menunjukkan pola - berapa
          kali dipanggil, dengan cara apa, dan apa hasilnya tiap kali. */}
      <Bagian judul="Relaas panggilan sidang ini" kunci="sidang-relaas-ini">
        {!sipp || relaasSidangIni.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {sipp && sipp.relaas.length > 0
              ? "Belum ada relaas untuk sidang ini - riwayat panggilan sebelumnya ada di bawah."
              : "Belum ada relaas tercatat untuk perkara ini."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Pihak</th>
                  <th className="px-3 py-2 font-medium">Jenis &amp; tanggal</th>
                  <th className="px-3 py-2 font-medium">Hasil</th>
                  <th className="px-3 py-2 font-medium">Keterangan relaas</th>
                  <th className="px-3 py-2 font-medium">Jurusita</th>
                  <th className="px-3 py-2 font-medium">Berkas</th>
                </tr>
              </thead>
              <tbody>
                {relaasSidangIni.map((baris) => (
                  <tr key={baris.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <div className="font-medium">{baris.namaPihak || "—"}</div>
                      {baris.peran ? (
                        <div className="text-xs text-muted-foreground">{baris.peran}</div>
                      ) : null}
                    </td>

                    {/* ==============================================
                        JENIS, TANGGAL PELAKSANAAN, DAN TANGGAL KIRIM POS
                        ==============================================

                        Ketiganya menjawab pertanyaan yang berbeda dan sering
                        tertukar. Pada surat tercatat, tanggal pelaksanaan
                        adalah tanggal surat DITERIMA, sedangkan yang dihitung
                        pada SK KMA 363/2022 angka 8 huruf c adalah tanggal
                        surat DIKIRIM ke pos. Menampilkan satu saja membuat
                        tenggang panggilan dihitung dari tanggal yang keliru. */}
                    <td className="px-3 py-2 text-sm">
                      <Badge variant="muted" title={judulSandiRelaas(baris)}>{jenisRelaas(baris)}</Badge>
                      <div className="mt-0.5">
                        <span className="text-muted-foreground">dilaksanakan </span>
                        {tanggalHariPendek(baris.tanggalRelaas) || "—"}
                      </div>
                      {baris.tanggalKirimPos ? (
                        <div>
                          <span className="text-muted-foreground">kirim ke pos </span>
                          {tanggalHariPendek(baris.tanggalKirimPos, baris.tanggalKirimPos)}
                        </div>
                      ) : null}
                    </td>

                    <td className="px-3 py-2">
                      {/* Retur didahulukan: surat yang kembali menuntut
                          tindakan. Hasilnya menurut SATU aturan
                          (@/lib/kepatutan-relaas): SEMA 1/2023 angka 12 untuk
                          surat tercatat - mis. "Bertemu orang serumah (ayah)",
                          huruf c, bukan "Tidak bertemu" - Pasal 718 RBg untuk
                          jurusita, elektronik dianggap bertemu. */}
                      {baris.retur ? <LencanaRetur baris={baris} /> : null}
                      <LencanaKepatutanRelaas baris={baris} pihak={rincian.pihak} tanpaRetur={baris.retur} />
                      {baris.noResiPos ? (
                        <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                          resi {baris.noResiPos}
                        </div>
                      ) : null}
                      {sebutanStatusPos(baris.statusPos) ? (
                        <div className="text-xs text-muted-foreground">
                          pos: {sebutanStatusPos(baris.statusPos)}
                        </div>
                      ) : null}
                    </td>

                    {/* Keterangan relaas adalah kalimat yang ditulis jurusita
                        - "diterima oleh kakak ipar yang tinggal serumah" dan
                        semacamnya. Inilah yang dibaca majelis saat menilai
                        patut tidaknya panggilan, dan selama ini tidak pernah
                        ditampilkan sama sekali meski sudah terbaca dari SIPP. */}
                    <td className="px-3 py-2 text-sm">
                      {baris.ketHasilRelaas ? (
                        <span>{baris.ketHasilRelaas}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      <PenandaPenerimaLawan baris={baris} pihak={rincian.pihak} />
                    </td>
                    {/* Nama jurusita yang berasal dari penugasan perkara -
                        bukan dari baris relaasnya - ditandai. Panggilan
                        elektronik tidak menyebut pelaksananya, dan menaruh
                        nama tanpa keterangan berarti membebankan pekerjaan
                        pada orang yang mungkin tidak mengerjakannya. */}
                    <td className="px-3 py-2 text-sm">
                      {baris.jurusitaNama || "—"}
                      {baris.jurusitaNama && baris.jurusitaDariPenugasan ? (
                        <span
                          className="ml-1 text-muted-foreground"
                          title="Relaas ini tidak menyebut pelaksananya. Nama diambil dari penugasan jurusita pada perkara."
                        >
                          (penugasan)
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {baris.adaDokumen ? (
                          <TombolUnduh
                            alamat={`/api/aleta-ecourt/berkas-sipp?jenis=relaas&id=${encodeURIComponent(baris.id)}`}
                            label="Relaas"
                            namaCadangan={`relaas-${baris.id}.pdf`}
                          />
                        ) : null}
                        {baris.adaResi ? (
                          <TombolUnduh
                            alamat={`/api/aleta-ecourt/berkas-sipp?jenis=resi&id=${encodeURIComponent(baris.id)}`}
                            label="Resi"
                            namaCadangan={`resi-${baris.id}.pdf`}
                          />
                        ) : null}
                        {!baris.adaDokumen && !baris.adaResi ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Bagian>

      {/* --- Riwayat relaas sidang-sidang sebelumnya --- */}
      {relaasRiwayat.length > 0 ? (
        <Bagian judul="Riwayat panggilan sebelumnya" kunci="sidang-relaas-riwayat" keterangan={String(relaasRiwayat.length)}>
          {/* Bentuknya sengaja lebih ringkas daripada tabel di atas: yang
              dicari di sini polanya - sudah berapa kali dipanggil, dengan cara
              apa, dan apa hasilnya - bukan rincian tiap barisnya. */}
          <ul className="space-y-1.5 text-sm">
            {relaasRiwayat.map((baris) => (
              <li
                key={baris.id}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-border/50 pb-1.5 last:border-0 last:pb-0"
              >
                <NomorSidang urutan={urutanSidangPer.get(String(baris.sidangId || ""))} />
                <span className="font-medium">{baris.namaPihak || "—"}</span>
                {baris.tanggalSidang ? (
                  <span className="text-xs text-muted-foreground">
                    untuk sidang {tanggalHariPendek(baris.tanggalSidang, baris.tanggalSidang)}
                  </span>
                ) : null}
                <Badge variant="muted" title={judulSandiRelaas(baris)}>{jenisRelaas(baris)}</Badge>
                <span className="text-xs text-muted-foreground">
                  {tanggalHariPendek(baris.tanggalRelaas) || "belum dilaksanakan"}
                </span>
                {baris.retur ? <LencanaRetur baris={baris} /> : null}
                {/* W58 22 Okt: dulu segala yang bukan bertemu langsung/elektronik
                    jatuh ke "tidak bertemu" - termasuk surat tercatat yang
                    diterima orang serumah (SEMA 1/2023 angka 12 huruf c). */}
                {baris.retur || baris.tanggalRelaas || baris.ketHasilRelaas ? (
                  <LencanaKepatutanRelaas baris={baris} pihak={rincian.pihak} tanpaRetur={baris.retur} />
                ) : null}
                {baris.noResiPos ? (
                  <span className="font-mono text-[11px] text-muted-foreground">
                    resi {baris.noResiPos}
                  </span>
                ) : null}
                {baris.ketHasilRelaas ? (
                  <span className="w-full text-xs text-muted-foreground">
                    {baris.ketHasilRelaas}
                    <PenandaPenerimaLawan baris={baris} pihak={rincian.pihak} />
                  </span>
                ) : null}
                {/* Unduh per riwayat, bernama sesuai dokumennya (J8, 1 Okt
                    2026) - rute dan penanganan unduhan yang SAMA dengan tabel
                    sidang ini (TombolUnduh -> tanganiUnduhan). */}
                {baris.adaDokumen || baris.adaResi ? (
                  <span className="flex w-full flex-wrap gap-1">
                    {baris.adaDokumen ? (
                      <TombolUnduh
                        alamat={`/api/aleta-ecourt/berkas-sipp?jenis=relaas&id=${encodeURIComponent(baris.id)}`}
                        label={namaDokumenRelaas(baris, "relaas", urutanSidangPer.get(String(baris.sidangId || "")))}
                        namaCadangan={namaBerkasRelaas(
                          nomorPerkara,
                          baris,
                          "relaas",
                          urutanSidangPer.get(String(baris.sidangId || ""))
                        )}
                      />
                    ) : null}
                    {baris.adaResi ? (
                      <TombolUnduh
                        alamat={`/api/aleta-ecourt/berkas-sipp?jenis=resi&id=${encodeURIComponent(baris.id)}`}
                        label={namaDokumenRelaas(baris, "resi", urutanSidangPer.get(String(baris.sidangId || "")))}
                        namaCadangan={namaBerkasRelaas(
                          nomorPerkara,
                          baris,
                          "resi",
                          urutanSidangPer.get(String(baris.sidangId || ""))
                        )}
                      />
                    ) : null}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </Bagian>
      ) : null}

      {/* --- Seluruh jadwal sidang perkara ini --- */}
      <Bagian judul="Seluruh jadwal sidang perkara ini" kunci="sidang-jadwal">
        {!sipp || sipp.jadwalPerkara.length === 0 ? (
          <p className="text-xs text-muted-foreground">Belum ada jadwal sidang tercatat.</p>
        ) : (
          <ol className="space-y-1 text-sm">
            {sipp.jadwalPerkara.map((jadwal) => (
              <li
                key={jadwal.sidangId}
                className="flex flex-wrap items-baseline gap-x-2 border-l-2 border-border pl-2"
              >
                <NomorSidang urutan={jadwal.urutanSidang} />
                <span className="font-medium">{tanggalHariPanjang(jadwal.tanggalSidang)}</span>
                {jadwal.jamSidang ? (
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {jadwal.jamSidang}
                  </span>
                ) : null}
                <span className="text-sm">{jadwal.agenda || "tanpa agenda"}</span>
                {jadwal.ruangan ? (
                  <span className="text-xs text-muted-foreground">Ruang {jadwal.ruangan}</span>
                ) : null}
                {/* "sidang ke-N" yang dahulu di sini dibuang: angkanya sudah
                    berdiri di tepi kiri, dan menyebutkannya dua kali membuat
                    barisnya lebih panjang tanpa menambah satu keterangan pun. */}
                {jadwal.ditunda ? (
                  <Badge variant="warning">
                    ditunda{jadwal.alasanDitunda ? `: ${jadwal.alasanDitunda}` : ""}
                  </Badge>
                ) : null}
                {jadwal.dihadiriOleh ? (
                  <Badge variant={jadwal.dihadiriOleh === 1 ? "success" : "muted"}>
                    {SEBUTAN_HADIR[jadwal.dihadiriOleh]}
                  </Badge>
                ) : null}
                {/* Berita Acara Sidang: berkasnya melekat pada baris sidang
                    ini, bukan pada perkaranya. */}
                {jadwal.adaBas ? (
                  <TombolUnduh
                    alamat={`/api/aleta-ecourt/berkas-sipp?jenis=bas&id=${encodeURIComponent(jadwal.sidangId)}`}
                    label="BAS"
                    namaCadangan={`bas-${jadwal.sidangId}.pdf`}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">BAS belum diunggah</span>
                )}
              </li>
            ))}
          </ol>
        )}
      </Bagian>

      {/* ====================================================================
          GARIS BATAS - SELURUH BAGIAN DI BAWAH INI TERCIUT SEBAGAI BAWAAN
          ====================================================================

          Diminta pengguna 24 September 2026: "setelah tab seluruh jadwal
          sidang perkara ini dibawahnya buat defaultnya minimize".

          Yang di atas garis ini - majelis, pihak, relaas sidang ini, riwayat
          panggilan, dan seluruh jadwal - dibaca tiap kali rincian dibuka di
          meja sidang. Yang di bawahnya dibuka bila perlu saja; terbentang
          semuanya, panel ini memanjang beberapa layar. Jadwalnya sendiri
          TIDAK ikut terciut: permintaannya "dibawahnya", bukan jadwalnya.

          KUNCINYA BERAKHIRAN -v2, DAN ITU BUKAN HIASAN. Keadaan ciut diingat
          peramban menurut kuncinya, dan yang tersimpan menang atas bawaan.
          Pemakai yang pernah menutup lalu membuka salah satu bagian ini
          menyimpan "0" - dengan kunci lama bagian itu tetap terbentang di
          perambannya, dan permintaan ini tampak tidak dikerjakan tanpa satu
          tanda pun kenapa. Kunci baru melepaskan simpanan lama itu; yang ikut
          hilang hanya "1", yang memang sama dengan bawaan barunya, dan "0",
          yang justru hendak dikalahkan. Sesudah itu pilihan tiap orang
          diingat lagi seperti biasa.

          Bentuk kuncinya (kunciCiut di alat-bagian) SENGAJA tidak disentuh:
          layar Status Perkara memakai bentuk yang sama dan simpanannya tidak
          boleh ikut terhapus. Mengembalikan nama kunci lama akan
          menghidupkan lagi simpanan "0" yang lama.

          Bagian yang terciut menyebut ringkasan isinya di kepalanya
          (keterangan) - penghambat kesiapan dan umur perkara - supaya yang
          tidak membukanya tetap tahu ada apa di dalamnya. */}
      {/* --- Pembebanan saat ikrar talak (6 Okt 2026) ---
          Tepat di atas bagian putusan, dan TIDAK terciut sebagai bawaan:
          pada sidang ikrar inilah yang dicari orang yang membuka rinciannya -
          sudah dibayar belum, berapa, untuk siapa. Hanya tergambar pada
          sidang ikrar yang pembebanannya ada. */}
      <PembebananIkrarRincian pembebanan={pembebanan} />

      {/* --- Putusan dan tindak lanjutnya --- */}
      {sipp?.putusan?.sudahPutus ? (
        <Bagian judul="Putusan dan tindak lanjutnya" kunci="sidang-putusan-v2" ciutBawaan>

          <div className="mb-2 flex flex-wrap gap-1">
            <Badge variant="success">
              Putus {tanggalHariPendek(sipp.putusan.tanggalPutusan, sipp.putusan.tanggalPutusan)}
            </Badge>
            {sipp.putusan.statusPutusan ? (
              <Badge variant="default">{sipp.putusan.statusPutusan}</Badge>
            ) : null}
            {sipp.putusan.verstek ? <Badge variant="warning">verstek</Badge> : null}
            {sipp.putusan.tanggalCabut ? (
              <Badge variant="muted">
                dicabut {tanggalHariPendek(sipp.putusan.tanggalCabut, sipp.putusan.tanggalCabut)}
              </Badge>
            ) : null}
            {sipp.putusan.tanggalGugur ? (
              <Badge variant="muted">
                gugur {tanggalHariPendek(sipp.putusan.tanggalGugur, sipp.putusan.tanggalGugur)}
              </Badge>
            ) : null}
          </div>

          {/* Tahap sesudah putusan, berurut sesuai jalannya perkara. Yang belum
              terjadi ditampilkan sebagai "belum" - bukan disembunyikan, karena
              justru yang belum itulah yang perlu ditindaklanjuti. */}
          {/* ====================================================================
              BHT DAN AKTA CERAI TIDAK LAGI DI SINI
              ====================================================================

              Keduanya bukan keadaan PUTUSAN, melainkan keadaan sesudah perkara
              selesai - dan tempatnya di layar yang mengurus penyerahan akta,
              bukan di layar jadwal sidang. Yang membuka jadwal sedang menyiapkan
              atau membacakan sidang; ia tidak sedang mengurus akta cerai.

              Datanya TIDAK hilang: putusanPerkara tetap membacanya, dan layar
              Status Perkara tetap menampilkannya. Yang dibuang hanya
              tampilannya di sini. */}
          <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {/* ==============================================
                MINUTASI - DAN APA YANG MENAHANNYA
                ==============================================

                Kotak ini dulu hanya berbunyi "belum diminutasi", dengan
                sebabnya disembunyikan di dalam title: satu kalimat, dan hanya
                satu dari empat kemungkinan.

                Yang membacanya tetap harus membuka SIPP untuk tahu berkas mana
                yang kurang - dan justru itu pekerjaan yang hendak dihemat
                layar ini.

                Kini sebabnya DIDAFTAR, dan daftarnya dihitung dari data yang
                sudah ada di panel ini: jadwalPerkara membawa ada tidaknya BAS
                tiap sidang, dan putusan membawa kedua naskahnya. Tidak ada
                pembacaan tambahan ke SIPP sama sekali.

                Aturannya di sebab-minutasi-tertahan - satu tempat, dipakai
                kotak saring "Belum minutasi" di daftar dan kotak ini
                sekaligus. Lihat di sana mengapa daftarnya TIDAK disebut
                "syarat": SIPP sendiri tidak menolak tanggal minutasi karena
                berkas kurang. */}
            <div className="rounded-md border bg-muted/30 px-3 py-2 sm:col-span-2 lg:col-span-1">
              <dt className="text-xs text-muted-foreground">Minutasi</dt>
              <dd className="font-medium">
                {sudahDiminutasi(sipp.putusan.tanggalMinutasi) ? (
                  sipp.putusan.tanggalMinutasi
                ) : (
                  <>
                    <span
                      className={cn(
                        sipp.putusan.adaBerkasPutusan
                          ? "text-rose-700 dark:text-rose-300"
                          : "text-amber-700 dark:text-amber-300"
                      )}
                    >
                      belum diminutasi
                    </span>
                    {(() => {
                      const sebab = sebabMinutasiTertahan({
                        sudahPutus: Boolean(sipp.putusan?.sudahPutus),
                        // Batas bundel. Tanpa ini, sidang ikrar talak yang
                        // dijadwalkan berbulan SESUDAH putusan ikut dihitung,
                        // dan tuduhan BAS-nya palsu seluruhnya - terukur 0
                        // lawan 7 pada perkara putus 2026.
                        tanggalPutusan: sipp.putusan?.tanggalPutusan ?? "",
                        tanggalMinutasi: sipp.putusan?.tanggalMinutasi ?? "",
                        adaBerkasPutusan: Boolean(sipp.putusan?.adaBerkasPutusan),
                        adaBerkasAnonim: Boolean(sipp.putusan?.adaBerkasAnonim),
                        jadwal: sipp.jadwalPerkara ?? [],
                        // Relaas ikut sejak 22 September 2026 - diminta
                        // pengguna bersama putusan dan berita acara sidang.
                        // Yang dikirim daftarnya, bukan jumlahnya: sebabnya
                        // menyebut relaas MANA yang belum ada pindaiannya.
                        relaas: sipp.relaas ?? [],
                      });
                      // Daftar KOSONG berarti seluruh berkasnya sudah ada dan
                      // yang tertinggal hanya tanggalnya. Itu keadaan yang
                      // berbeda dari "ada yang kurang", dan mengatakannya
                      // menghemat pencarian: yang membacanya tidak perlu
                      // memeriksa berkas satu per satu untuk menemukan bahwa
                      // tidak ada yang kurang.
                      if (sebab.length === 0) {
                        return (
                          <p className="mt-1 text-xs font-normal text-muted-foreground">
                            Berkasnya sudah lengkap — tinggal tanggal minutasinya diisi di
                            SIPP.
                          </p>
                        );
                      }
                      return (
                        <ul className="mt-1 space-y-0.5 text-xs font-normal">
                          {sebab.map((x) => (
                            <li
                              key={x.kunci}
                              className={cn(
                                "flex gap-1.5",
                                x.tingkat === "penghalang"
                                  ? "text-rose-700 dark:text-rose-300"
                                  : "text-muted-foreground"
                              )}
                            >
                              <span aria-hidden>{x.tingkat === "penghalang" ? "•" : "◦"}</span>
                              <span>
                                {x.pesan}
                                {/* ==========================================
                                    YANG KURANG, DISEBUT SATU PER SATU
                                    ==========================================

                                    Diminta pengguna 22 September 2026:
                                    "disebut berkas perkara sidang ke berapa
                                    dan agenda berapa".

                                    Sub-daftar, bukan sambungan kalimat.
                                    "2 dari 5" adalah angka yang dibaca
                                    sekilas, dan membenamkan lima nama sidang
                                    ke dalam kalimatnya justru menghapus angka
                                    itu dari pandangan. */}
                                {(x.rincian ?? []).length > 0 ? (
                                  <ul className="mt-0.5 space-y-0.5 pl-3 text-[11px] text-muted-foreground">
                                    {(x.rincian ?? []).map((r, i) => (
                                      <li key={`${x.kunci}-${i}`}>
                                        <span className="font-medium text-foreground">
                                          {r.label}
                                        </span>
                                        {r.catatan ? ` — ${r.catatan}` : ""}
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}
                              </span>
                            </li>
                          ))}
                        </ul>
                      );
                    })()}
                  </>
                )}
              </dd>
            </div>

            {/* ==============================================
                JENIS PUTUSAN, BUKAN UPAYA HUKUM
                ==============================================

                Kotak ini dulu menampilkan upaya hukum, dan pada hampir seluruh
                perkara ia berbunyi "tidak ada" - satu kotak penuh yang tidak
                pernah mengatakan apa pun. Yang dicari orang di sini justru
                jenis putusannya: dikabulkan, ditolak, digugurkan, dicabut.

                Upaya hukum TIDAK hilang - ia muncul hanya bila memang ada,
                sebagai penanda di bawah. Keadaan yang jarang terjadi pantas
                ditampilkan saat terjadi, bukan disediakan tempat tetap. */}
            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <dt className="text-xs text-muted-foreground">Jenis putusan</dt>
              <dd className="font-medium">
                {/* Warnanya mengikuti statusnya - hijau untuk dikabulkan, merah
                    untuk ditolak. Sama persis dengan penanda di daftar, dari
                    fungsi yang sama: dua tempat yang menyebut hal yang sama
                    tidak boleh berbeda warnanya. */}
                {sipp.putusan.statusPutusan ? (
                  <Badge variant={warnaStatusPutusan(sipp.putusan.statusPutusan)}>
                    {sipp.putusan.statusPutusan}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">belum tercatat</span>
                )}

                {/* Verstek dan verzet adalah dua hal yang berbeda dan sering
                    tertukar: verstek putusan tanpa hadirnya tergugat, verzet
                    perlawanan TERHADAP putusan verstek itu. Keduanya ditandai
                    terpisah supaya tidak dibaca sebagai satu. */}
                {sipp.putusan.verstek ? (
                  <Badge variant="warning" className="ml-1.5">
                    verstek
                  </Badge>
                ) : null}
                {perkaraVerzet ? (
                  <Badge variant="warning" className="ml-1.5" title="Perkara perlawanan terhadap putusan verstek.">
                    perkara verzet
                  </Badge>
                ) : null}

                {sipp.putusan.upayaHukum.length > 0 ? (
                  <div className="mt-1 text-sm font-normal">
                    <span className="text-muted-foreground">Upaya hukum: </span>
                    {sipp.putusan.upayaHukum
                      .map(
                        (upaya) =>
                          `${upaya.jenis}${upaya.tanggal ? ` (${tanggalHariPendek(upaya.tanggal, upaya.tanggal)})` : ""}`
                      )
                      .join(", ")}
                  </div>
                ) : null}
              </dd>
            </div>

            {/* Konseptor: siapa yang menyusun naskahnya. Ditanya justru saat
                naskahnya dipersoalkan, dan selama ini tidak pernah tampil di
                layar ini meski sudah lama terbaca dari SIPP. */}
            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <dt className="text-xs text-muted-foreground">Konseptor putusan</dt>
              <dd className="font-medium">
                {sipp.konseptor?.terbaca && sipp.konseptor.baris.length > 0 ? (
                  sipp.konseptor.baris.map((orang) => (
                    <div key={orang.pengguna}>
                      {orang.nama}
                      {orang.tanggal ? (
                        <span className="text-sm font-normal text-muted-foreground">
                          {" "}
                          {tanggalHariPendek(orang.tanggal, orang.tanggal)}
                        </span>
                      ) : null}
                      {/* Pencatat pertama BUKAN konseptor - dua peran yang
                          kerap sama orangnya, tetapi tidak boleh diandaikan
                          sama pada naskah yang ditandatangani. */}
                      {orang.dariAudit ? (
                        <span
                          className="ml-1 text-sm font-normal text-muted-foreground"
                          title="Diambil dari catatan SIPP: inilah yang PERTAMA mencatat putusan, belum tentu yang menyusunnya."
                        >
                          (pencatat pertama)
                        </span>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <span className="text-muted-foreground">
                    {sipp.konseptor && !sipp.konseptor.terbaca
                      ? "tidak terbaca dari SIPP"
                      : "belum tercatat"}
                  </span>
                )}
                {/* Butir 38 (17 Okt): konseptor tercatat di SIPP tanpa tunjukan
                    sementara - checklist draf putusannya tetap dapat dibuka di sini. */}
                {!tunjukan?.nama && sipp.konseptor?.terbaca && sipp.konseptor.baris.length > 0 ? (
                  <div className="mt-1.5 border-t pt-1.5 text-sm font-normal">
                    <ChecklistKonseptor
                      perkaraId={perkaraId}
                      nomorPerkara={nomorPerkara}
                      konseptorSipp={sipp.konseptor.baris.filter((o) => !o.dariAudit).map((o) => o.nama)}
                    />
                  </div>
                ) : null}

                {/* ==================================================
                    TUNJUKAN TANGAN, DAN SELISIHNYA DENGAN SIPP
                    ==================================================

                    Tiga keadaan yang tampak mirip dan berakibat berbeda:

                      SIPP belum punya nama  tunjukan masih berlaku; tidak ada
                                             yang dapat dibanding
                      SIPP punya, sama       tunjukan terbukti; tidak perlu
                                             dikatakan apa pun
                      SIPP punya, berbeda    pekerjaannya berpindah tangan -
                                             inilah yang ditandai

                    Yang pertama paling mudah tersamar menjadi yang ketiga oleh
                    kode yang membandingkan langsung: "" tidak sama dengan
                    "Fulan", dan penanda merah pun menyala pada hampir setiap
                    perkara yang naskahnya memang belum diunggah. Aturannya
                    karena itu dipakai dari satu tempat - bandingkanKonseptor -
                    bukan ditulis ulang di sini.

                    Selisihnya TIDAK menuduh siapa pun. Konseptor berpindah
                    tangan adalah hal yang lazim dan sah; yang tidak lazim
                    hanyalah berpindah tanpa ada yang tahu. */}
                {tunjukan?.nama ? (
                  (() => {
                    const banding = bandingkanKonseptor(tunjukan, sipp.konseptor?.baris ?? []);
                    return (
                      <div className="mt-1.5 border-t pt-1.5 text-sm font-normal">
                        <span className="text-muted-foreground">Tunjukan sementara: </span>
                        <span className="font-medium">{tunjukan.nama}</span>
                        {tunjukan.ditetapkanOleh ? (
                          <span className="text-xs text-muted-foreground">
                            {" "}
                            oleh {tunjukan.ditetapkanOleh}
                          </span>
                        ) : null}
                        {banding.berbeda ? (
                          <Badge
                            variant="danger"
                            className="ml-1.5 align-middle"
                            title={`Yang menyusun naskahnya menurut SIPP: ${banding.namaSipp || "nama lain"}. Yang berlaku nama SIPP - tunjukan ini sudah lewat masanya.`}
                          >
                            berbeda dari SIPP
                          </Badge>
                        ) : banding.adaSipp ? (
                          <Badge variant="success" className="ml-1.5 align-middle">
                            sesuai
                          </Badge>
                        ) : (
                          <Badge variant="muted" className="ml-1.5 align-middle">
                            SIPP belum mencatat
                          </Badge>
                        )}
                      </div>
                    );
                  })()
                ) : null}
              </dd>
            </div>
          </dl>

          {/* Naskah putusan. Yang anonim boleh dipublikasikan; yang asli
              memuat identitas para pihak - keduanya disebutkan apa adanya
              supaya tidak tertukar. */}
          {sipp.putusan.adaBerkasPutusan || sipp.putusan.adaBerkasAnonim ? (
            <div className="mt-2 flex flex-wrap items-start gap-2">
              {sipp.putusan.adaBerkasPutusan ? (
                <TombolUnduh
                  alamat={`/api/aleta-ecourt/berkas-sipp?jenis=putusan&id=${encodeURIComponent(perkaraId)}`}
                  label="Unduh putusan"
                  namaCadangan={`putusan-${nomorPerkara.replace(/[^\w.-]+/g, "-")}.pdf`}
                />
              ) : null}
              {sipp.putusan.adaBerkasAnonim ? (
                <TombolUnduh
                  alamat={`/api/aleta-ecourt/berkas-sipp?jenis=putusan-anonim&id=${encodeURIComponent(perkaraId)}`}
                  label="Unduh putusan anonim"
                  namaCadangan={`putusan-anonim-${nomorPerkara.replace(/[^\w.-]+/g, "-")}.pdf`}
                />
              ) : null}
            </div>
          ) : null}

          {sipp.putusan.amarRingkas ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                Amar putusan (ringkas)
              </summary>
              <p className="mt-1 whitespace-pre-line rounded-md bg-muted/40 p-2 text-sm">
                {sipp.putusan.amarRingkas}
              </p>
            </details>
          ) : null}
        </Bagian>
      ) : null}

      {/* ====================================================================
          PUTUS MENURUT RUANG SIDANG, BELUM TERCATAT DI SIPP
          ====================================================================

          Seksi "Putusan dan tindak lanjutnya" di atas hanya digambar bila ada
          BARIS putusan di SIPP. Perkara yang diputus di ruang sidang tetapi
          baris putusannya belum dibuat karena itu tidak mendapat satu kalimat
          pun tentang minutasi - padahal justru merekalah yang dinyalakan kotak
          saring "Belum minutasi", dan lencananya menyuruh membuka rincian ini.

          Terukur di SIPP setempat: 12 perkara yang hasil sidangnya berbunyi
          putus tanpa satu baris putusan pun. Tanpa seksi ini, kedua belas
          perkara itu mengirim orang ke rincian yang diam.

          Yang dikatakannya SATU hal, dan bukan daftar berkas: selama baris
          putusannya belum ada, tidak ada tanggal putusan - dan tanpa tanggal
          putusan tidak ada batas bundel yang dapat diperiksa. Mengarang daftar
          di sini berarti menghitung BAS terhadap batas yang belum ada. */}
      {!sipp?.putusan?.sudahPutus && hasilPutusSidangIni ? (
        <Bagian judul="Putusan belum tercatat di SIPP" kunci="sidang-putus-belum-tercatat-v2" ciutBawaan>
          <p className="text-sm">
            Menurut catatan ruang sidang perkara ini{" "}
            <strong>{hasilPutusSidangIni}</strong>, tetapi baris putusannya belum ada di
            SIPP.
          </p>
          <ul className="mt-1 space-y-0.5 text-xs">
            <li className="flex gap-1.5 text-rose-700 dark:text-rose-300">
              <span aria-hidden>•</span>
              <span>
                Data putusan belum diisi di SIPP — selama belum, tanggal minutasi tidak
                dapat diisi sama sekali dan perkaranya tidak terhitung putus pada laporan.
              </span>
            </li>
            <li className="flex gap-1.5 text-muted-foreground">
              <span aria-hidden>◦</span>
              <span>
                Kelengkapan berkas untuk minutasi baru dapat diperiksa sesudah tanggal
                putusannya ada — tanpa tanggal itu, tidak ada batas bundel yang dapat
                dihitung.
              </span>
            </li>
          </ul>
        </Bagian>
      ) : null}

      {/* --- Kesiapan dan panggilan --- */}
      {kesiapan ? (
        <Bagian judul="Kesiapan sidang dan panggilan para pihak" kunci="sidang-kesiapan-v2" ciutBawaan keterangan={keteranganKesiapan}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="muted">
                {kesiapan.panggilan.lewatEcourt ? "perkara e-Court" : "perkara biasa"}
              </Badge>
              <LencanaKesiapan nilai={kesiapan} />
            </div>
          </div>

          {kesiapan.penghambat.length > 0 ? (
            <ul className="mb-3 space-y-1 text-sm">
              {kesiapan.penghambat.map((hambat) => (
                <li key={hambat.kunci} className="flex flex-wrap items-baseline gap-2">
                  <Badge
                    variant={
                      hambat.tingkat === "berat"
                        ? "danger"
                        : hambat.tingkat === "sedang"
                          ? "warning"
                          : "muted"
                    }
                  >
                    {hambat.tingkat}
                  </Badge>
                  <span>{hambat.pesan}</span>
                  <span className="text-xs text-muted-foreground">({hambat.sumber})</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 text-xs text-muted-foreground">
              Tidak ada penghambat tercatat untuk sidang ini.
            </p>
          )}

          {kesiapan.panggilan.pihak.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Pihak</th>
                    <th className="px-3 py-2 font-medium">Persetujuan e-Court</th>
                    <th className="px-3 py-2 font-medium">Jalur seharusnya</th>
                    <th className="px-3 py-2 font-medium">Pengiriman</th>
                    <th className="px-3 py-2 font-medium">Penerimaan</th>
                    <th className="px-3 py-2 font-medium">Kepatutan</th>
                  </tr>
                </thead>
                <tbody>
                  {kesiapan.panggilan.pihak.map((pihak) => (
                    <tr key={pihak.nama} className="border-t border-border align-top">
                      <td className="px-3 py-2">
                        <span className="font-medium">{pihak.nama}</span>
                        {pihak.peran ? (
                          <div className="text-xs text-muted-foreground">{pihak.peran}</div>
                        ) : null}
                      </td>

                      <td className="px-3 py-2">
                        {!kesiapan.panggilan.lewatEcourt ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : pihak.persetujuan === "setuju" ? (
                          <Badge variant="success">setuju</Badge>
                        ) : pihak.persetujuan === "tidak_setuju" ? (
                          <Badge variant="danger">tidak setuju</Badge>
                        ) : (
                          <Badge variant="muted">belum menjawab</Badge>
                        )}
                      </td>

                      <td className="px-3 py-2 text-sm">
                        {NAMA_JALUR[pihak.seharusnya] ?? pihak.seharusnya}
                        {pihak.salahSaluran ? (
                          <div className="mt-1">
                            <Badge variant="danger">
                              dipanggil lewat {NAMA_JALUR[pihak.terlaksana] ?? pihak.terlaksana}
                            </Badge>
                          </div>
                        ) : pihak.catatanSaluran ? (
                          // Bukan merah: sandi relaas di SIPP bertentangan
                          // dengan e-Court, dan yang perlu dibetulkan
                          // catatannya, bukan panggilannya. Diminta pengguna
                          // 24 September 2026 - perkara 385/Pdt.G/2026:
                          // tergugat tanpa email di e-Court, dipanggil surat
                          // tercatat, relaasnya bersandi E. Lihat
                          // ecourtPanggilanService di bot.
                          <div className="mt-1 text-xs text-muted-foreground">
                            {pihak.catatanSaluran}
                          </div>
                        ) : null}
                      </td>

                      {/* Sudah dikirim atau belum SELALU dicantumkan, termasuk
                          tanggalnya - bukan hanya saat bermasalah. */}
                      <td className="px-3 py-2">
                        {pihak.sudahDikirim ? (
                          <>
                            <Badge variant="success">terkirim</Badge>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {tanggalHariPendek(pihak.tanggalPanggilan, pihak.tanggalPanggilan ?? "")}
                            </div>
                            {pihak.noResiPos ? (
                              <div className="text-xs text-muted-foreground">
                                Resi {pihak.noResiPos}
                              </div>
                            ) : null}
                          </>
                        ) : pihak.tidakPerluDipanggil ? (
                          // Merah di sini akan keliru: pihak yang hadir pada
                          // sidang sebelumnya sudah diberitahu di ruang
                          // sidang, dan tidak ada panggilan yang tertunggak.
                          <>
                            <Badge variant="muted">tidak perlu dipanggil</Badge>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              hadir pada sidang sebelumnya
                            </div>
                          </>
                        ) : (
                          <Badge variant="danger">belum dikirim</Badge>
                        )}
                      </td>

                      <td className="px-3 py-2">
                        {!pihak.kepatutan.perluDiterima ? (
                          <span className="text-xs text-muted-foreground">tidak disyaratkan</span>
                        ) : pihak.diterima === true ? (
                          <>
                            <Badge variant="success">diterima</Badge>
                            {pihak.tanggalPelaksanaanRelaas ? (
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                {tanggalHariPendek(
                                  pihak.tanggalPelaksanaanRelaas,
                                  pihak.tanggalPelaksanaanRelaas ?? ""
                                )}
                              </div>
                            ) : null}
                            {pihak.buktiPenerimaan ? (
                              <div className="text-xs text-muted-foreground">
                                bukti: {pihak.buktiPenerimaan}
                              </div>
                            ) : null}
                          </>
                        ) : pihak.diterima === false ? (
                          <Badge variant="danger">belum diterima</Badge>
                        ) : (
                          <Badge variant="warning">belum terbukti</Badge>
                        )}
                      </td>

                      <td className="px-3 py-2">
                        {pihak.kepatutan.alasan === "tidak_wajib_dipanggil" ? (
                          // Hadir pada sidang sebelumnya dan memang tidak
                          // dipanggil - tidak ada yang dapat dinilai. Merah
                          // "belum dapat dinilai" di sini dahulu berdiri di
                          // samping "tidak perlu dipanggil" pada baris yang
                          // sama (tinjauan 24 September 2026).
                          <Badge variant="muted">tidak dinilai</Badge>
                        ) : pihak.kepatutan.patut === true ? (
                          <Badge variant="success">
                            patut · {pihak.kepatutan.selisih} hari
                          </Badge>
                        ) : pihak.kepatutan.patut === false ? (
                          <Badge variant="danger">
                            {pihak.kepatutan.alasan === "dikirim_setelah_hari_sidang"
                              ? labelTidakPatut(pihak.terlaksana || pihak.seharusnya) + " · dikirim setelah sidang"
                              : pihak.kepatutan.alasan === "diterima_setelah_hari_sidang"
                                ? labelTidakPatut(pihak.terlaksana || pihak.seharusnya) + " · diterima setelah sidang"
                                : labelTidakPatut(pihak.terlaksana || pihak.seharusnya) + " · " + pihak.kepatutan.selisih + " hari"}
                          </Badge>
                        ) : pihak.kepatutan.alasan === "belum_dikirim" ? (
                          <Badge variant="danger">belum dapat dinilai</Badge>
                        ) : (
                          <Badge variant="warning">
                            tenggang cukup · {pihak.kepatutan.selisih} hari
                          </Badge>
                        )}
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          ambang {pihak.kepatutan.ambang}{" "}
                          {pihak.kepatutan.hariKerja ? "hari kerja" : "hari kalender"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {pihak.kepatutan.dasarHukum}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Data pihak belum terbaca. Untuk perkara e-Court, tarik perkara ini dari menu Kendali
              Berkas lebih dulu; untuk perkara biasa, pihaknya dibaca dari data relaas SIPP.
            </p>
          )}

          <CatatanCaraHitung tampilkan={tampilCatatanHitung}>
            Tenggang dihitung dari tanggal panggilan dikirim sampai hari sidang. Untuk surat
            tercatat, yang dihitung adalah tanggal kirim ke pos — dan penerimaannya harus terbukti
            terpisah. Angka ambang dapat diubah di menu Integrasi e-Court. Penilaian ini alat bantu,
            bukan penetapan sah tidaknya panggilan.
          </CatatanCaraHitung>
        </Bagian>
      ) : null}

      {/* --- Berkas e-Court --- */}
      <Bagian judul="Berkas e-Court dan verifikasi majelis" kunci="sidang-ecourt-v2" ciutBawaan>
        {/* Aksi e-Court perkara ini - kontrak K5 (komponen milik agen E):
            unduh e-litigasi, verifikasi majelis, dan TTE putusan lewat sesi
            e-Court akun sendiri. */}
        <div className="mb-3">
          <EcourtAksiPerkara
            konteks="jadwal"
            nomorPerkara={nomorPerkara}
            perkaraId={perkaraId}
            tanggalSidang={tanggalSidangIni}
          />
        </div>
        {rincian.pesanEcourt ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {rincian.pesanEcourt}
          </p>
        ) : rincian.ecourt.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Belum ada dokumen e-Court tersimpan untuk perkara ini.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  {/* Angka saja - judul kolomnya pun satu kata. Diminta
                      pengguna 23 September 2026. */}
                  <th className="w-10 px-2 py-2 text-center font-medium" title="Sidang keberapa">
                    Sdg
                  </th>
                  <th className="px-3 py-2 font-medium">Judul Dokumen</th>
                  <th className="px-3 py-2 font-medium">Pengunggah</th>
                  <th className="px-3 py-2 font-medium">Verifikasi</th>
                  <th className="px-3 py-2 font-medium">Unduh</th>
                </tr>
              </thead>
              <tbody>
                {rincian.ecourt.map((dokumen) => (
                  <tr key={dokumen.documentKey} className="border-t border-border">
                    {/* Kosong bila tanggal sidang dokumennya belum terisi -
                        dan pada sebagian besar dokumen ia memang masih kosong,
                        sebab jembatan e-Court belum menuliskannya. Kolom yang
                        kosong lebih jujur daripada nomor yang ditebak. */}
                    <td className="px-2 py-2 text-center align-top">
                      <NomorSidang
                        urutan={urutanSidangPerTanggal.get(
                          String(dokumen.tanggalSidang || "").slice(0, 10)
                        )}
                      />
                    </td>
                    <td className="px-3 py-2">
                      {dokumen.judulDokumen || "Dokumen"}
                      {dokumen.jenisDokumen ? (
                        <div className="text-xs text-muted-foreground">{dokumen.jenisDokumen}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-sm">{dokumen.peranPengunggah || "—"}</td>
                    <td className="px-3 py-2">
                      <LencanaVerifikasi status={dokumen.statusVerifikasi} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {dokumen.adaPdf ? (
                          <TombolUnduh
                            alamat={`/api/aleta-ecourt/berkas?documentKey=${encodeURIComponent(dokumen.documentKey)}&format=pdf`}
                            label="PDF"
                            namaCadangan={`${dokumen.documentKey}.pdf`}
                          />
                        ) : null}
                        {dokumen.adaWord ? (
                          <TombolUnduh
                            alamat={`/api/aleta-ecourt/berkas?documentKey=${encodeURIComponent(dokumen.documentKey)}&format=word`}
                            label="Word"
                            namaCadangan={`${dokumen.documentKey}.docx`}
                          />
                        ) : null}
                        {/* DUA sebab yang berbeda, dan dahulu satu kalimat.

                            "belum tersimpan" berarti pihak belum mengunggah -
                            ditindaklanjuti dengan menagih pihaknya.
                            "lenyap dari arsip" berarti berkasnya PERNAH ada dan
                            catatannya masih ada, tetapi cakramnya tidak lagi
                            memuatnya - ditindaklanjuti dengan menarik ulang
                            dari e-Court, bukan dengan menagih siapa pun.
                            Seluruh arsip pernah lenyap sekaligus karena volume
                            Docker belum di-mount, jadi ini bukan kemungkinan
                            teoretis. */}
                        {!dokumen.adaPdf && !dokumen.adaWord ? (
                          Number(dokumen.berkasHilang || 0) > 0 ? (
                            <span
                              className="text-xs text-amber-700 dark:text-amber-300"
                              title="Berkasnya tercatat pernah diunduh tetapi tidak ada di cakram. Tarik ulang dari e-Court - jangan menagih pihaknya."
                            >
                              lenyap dari arsip ({Number(dokumen.berkasHilang)})
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">belum tersimpan</span>
                          )
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Bagian>

      {/* ==================================================================
          BERKAS SIPP
          ==================================================================

          Yang dicari orang di sini tiga hal: gugatan atau permohonannya,
          relaas panggilannya, dan berita acara sidangnya. Sebelumnya bagian
          ini hanya menampilkan isi perkara_dokumen - berkas lampiran - dan
          ketiganya justru tidak ada di sana: relaas ada pada tabel relaas,
          BAS pada jadwal sidang, dan gugatan pada kolom petitum perkara.

          Ketiganya kini dikelompokkan menurut jenisnya, bukan dicampur jadi
          satu daftar tanpa urutan. */}
      <Bagian judul="Berkas tersimpan di SIPP" kunci="sidang-berkas-sipp-v2" ciutBawaan>

        {/* ==================================================================
            SATU TEKAN UNTUK SELURUHNYA
            ==================================================================

            Tombol ZIP dulu hanya ada di panel Arsip e-Court, dan panel itu
            hanya menampilkan perkara yang PUNYA berkas e-Court. Perkara yang
            berkasnya hanya tersimpan di SIPP - gugatan, relaas, berita acara,
            putusan - tidak pernah ditawari ZIP sama sekali.

            Di sinilah orang bekerja: seluruh daftarnya sudah terbentang di
            bawah, dan tombolnya berdiri di atas daftar itu. */}
        {sipp ? (
          <div className="mb-3 flex flex-wrap items-start gap-2">
            <TombolUnduhZip nomorPerkara={nomorPerkara} sumber="semua" />
            <p className="max-w-md text-xs text-muted-foreground">
              Gugatan, relaas beserta resi pos, berita acara sidang, putusan, lampiran,
              dan berkas e-Court - berkelompok menurut jenisnya, beserta daftar isi.
            </p>
          </div>
        ) : null}

        {/* Seluruh bagian ini bergantung pada rincian SIPP. Dijaga sekali di
            sini, bukan pada tiap barisnya. */}
        {!sipp ? (
          <p className="text-xs text-muted-foreground">
            Keterangan SIPP untuk perkara ini belum dapat dibaca.
          </p>
        ) : (
        <div className="space-y-3">
          {/* --- Gugatan / permohonan --- */}
          <div>
            <p className="mb-1 text-sm font-semibold">Gugatan / permohonan</p>
            {sipp.petitum?.ada ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>Surat gugatan/permohonan</span>
                <TombolUnduh
                  alamat={`/api/aleta-ecourt/berkas-sipp?jenis=petitum&id=${encodeURIComponent(
                    perkaraId
                  )}`}
                  label="Unduh"
                  namaCadangan={`gugatan-${nomorPerkara}.pdf`}
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Belum diunggah ke SIPP.</p>
            )}
          </div>

          {/* --- Relaas panggilan --- */}
          <div>
            <p className="mb-1 text-sm font-semibold">
              Relaas panggilan
              {sipp.relaas.length > 0 ? (
                <span className="ml-1 font-normal text-muted-foreground">
                  ({sipp.relaas.filter((x) => x.adaDokumen).length} dari {sipp.relaas.length}
                  {" "}berdokumen)
                </span>
              ) : null}
            </p>
            {sipp.relaas.length === 0 ? (
              <p className="text-xs text-muted-foreground">Belum ada relaas tercatat.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {sipp.relaas.map((baris) => (
                  <li key={baris.id} className="flex flex-wrap items-center gap-2">
                    {/* Sidang keberapa - angka saja, di kiri. Diminta pengguna
                        23 September 2026. Satu relaas dapat menempel pada
                        sidang yang sama dengan relaas lain; nomornya diambil
                        dari sidangId, bukan dari urutan barisnya sendiri. */}
                    <NomorSidang urutan={urutanSidangPer.get(String(baris.sidangId || ""))} />
                    <span className="min-w-0 flex-1 truncate" title={baris.namaPihak}>
                      {baris.namaPihak || "tanpa nama pihak"}
                      {baris.tanggalRelaas ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          {tanggalHariPendek(baris.tanggalRelaas, baris.tanggalRelaas)}
                        </span>
                      ) : null}
                    </span>
                    {baris.adaDokumen ? (
                      <TombolUnduh
                        alamat={`/api/aleta-ecourt/berkas-sipp?jenis=relaas&id=${encodeURIComponent(
                          baris.id
                        )}`}
                        label="Relaas"
                        namaCadangan={`relaas-${baris.id}.pdf`}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">relaas belum diunggah</span>
                    )}
                    {baris.adaResi ? (
                      <TombolUnduh
                        alamat={`/api/aleta-ecourt/berkas-sipp?jenis=resi&id=${encodeURIComponent(
                          baris.id
                        )}`}
                        label="Resi"
                        namaCadangan={`resi-${baris.id}.pdf`}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* --- Berita acara sidang --- */}
          <div>
            <p className="mb-1 text-sm font-semibold">Berita Acara Sidang</p>
            {sipp.jadwalPerkara.length === 0 ? (
              <p className="text-xs text-muted-foreground">Belum ada sidang tercatat.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {sipp.jadwalPerkara.map((sidang) => (
                  <li key={sidang.sidangId} className="flex flex-wrap items-center gap-2">
                    <NomorSidang urutan={sidang.urutanSidang} />
                    <span className="min-w-0 flex-1 truncate">
                      {tanggalHariPendek(sidang.tanggalSidang, sidang.tanggalSidang)}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {sidang.agenda || "tanpa agenda"}
                      </span>
                    </span>
                    {sidang.adaBas ? (
                      <TombolUnduh
                        alamat={`/api/aleta-ecourt/berkas-sipp?jenis=bas&id=${encodeURIComponent(
                          sidang.sidangId
                        )}`}
                        label="BAS"
                        namaCadangan={`bas-${nomorPerkara}-${sidang.tanggalSidang}.pdf`}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">BAS belum diunggah</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* --- Lampiran lain, bila ada --- */}
          {sipp.dokumenSipp.length > 0 ? (
            <div>
              <p className="mb-1 text-sm font-semibold">Lampiran lain</p>
              <ul className="space-y-1 text-sm">
                {sipp.dokumenSipp.map((dokumen) => (
                  <li key={dokumen.id} className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">
                      {dokumen.namaDokumen || dokumen.namaFile}
                    </span>
                    {dokumen.ukuranByte ? (
                      <span className="text-xs text-muted-foreground">
                        {ukuranTerbaca(dokumen.ukuranByte)}
                      </span>
                    ) : null}
                    <TombolUnduh
                      alamat={`/api/aleta-ecourt/berkas-sipp?jenis=dokumen&id=${encodeURIComponent(
                        dokumen.id
                      )}`}
                      label="Unduh"
                      namaCadangan={dokumen.namaFile || `dokumen-${dokumen.id}`}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        )}
      </Bagian>

      {/* ====================================================================
          RINCIAN WAKTU - DAN DARI MANA TIAP ANGKANYA DATANG
          ====================================================================

          Diminta pengguna 23 September 2026: "tambahkan juga di rincian waktu
          durasi perkara secara lengkap".

          Yang ditulis di sini bukan satu angka melainkan JALAN menuju angka
          itu: berapa hari sejak didaftarkan, berapa hari mediasi yang
          dikeluarkan beserta tanggal dan hasilnya, dan berapa sisa sampai
          batas lima bulan. Angka tunggal tidak dapat dibantah maupun
          dibuktikan; rinciannya dapat keduanya.

          PALING BAWAH, DAN TERCIUT SEBAGAI BAWAAN

          Diminta pengguna 24 September 2026: "buat rincian waktu perkara tab
          nya paling bawah setelah kesiapan sidang dan panggilan para pihak".
          Dibaca paling bawah PANEL - sesudah Berkas tersimpan di SIPP, bukan
          tepat sesudah Kesiapan. Letak ini memenuhi kedua syarat kalimatnya
          sekaligus (paling bawah, dan sesudah Kesiapan); tepat sesudah
          Kesiapan hanya memenuhi yang kedua. Kalimat kaki di bawahnya tetap
          paling akhir: ia penutup panel, bukan bagian.

          Terciut karena ia kini berada di bawah Seluruh jadwal - lihat garis
          batas di bawah jadwal. Angka pokoknya tidak hilang dari pandangan:
          umur perkara tetap tertulis di bawah agenda tiap baris, dan juga di
          kepala bagian ini.

          PITA WAKTU PUTUS SK DIRJEN BADILAG 048/2024 - diminta pengguna 24
          September 2026. Nilainya dihitung bot dengan TANGGA yang sama yang
          menilai unsur waktu putus di Status Perkara, atas hari di luar
          mediasi - tanpa pengecualian perkara khusus. */}
      {durasi && durasi.hariBersih !== null ? (
        <Bagian judul="Rincian waktu perkara" kunci="sidang-durasi-v2" ciutBawaan keterangan={keteranganWaktu}>
          <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Didaftarkan</dt>
            <dd>{tanggalHariPanjang(durasi.tanggalDaftar) || "—"}</dd>

            <dt className="text-muted-foreground">
              {durasi.sudahPutus ? "Diputus" : "Sampai hari ini"}
            </dt>
            <dd>
              {durasi.sudahPutus ? tanggalHariPanjang(durasi.tanggalPutusan) : "belum diputus"}
            </dd>

            <dt className="text-muted-foreground">Berjalan</dt>
            <dd className="tabular-nums">
              {durasi.hariKotor ?? durasi.hariTotal ?? "—"} hari
              {durasi.hariKotor != null ? (
                <span className="ml-1 text-xs text-muted-foreground">
                  (hari pendaftaran ikut dihitung)
                </span>
              ) : null}
            </dd>

            <dt className="text-muted-foreground">Mediasi dikeluarkan</dt>
            <dd className="tabular-nums">
              {durasi.hariMediasi} hari
              {durasi.mediasiDibatasi ? (
                <span className="ml-1 text-xs text-muted-foreground">
                  (dibatasi 60 hari - batas PERMA termasuk perpanjangan)
                </span>
              ) : null}
            </dd>

            {durasi.kelonggaran ? (
              <>
                <dt className="text-muted-foreground">Kelonggaran perkara khusus</dt>
                <dd className="tabular-nums">
                  {durasi.kelonggaran.hari} hari
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({durasi.kelonggaran.sebab}
                    {durasi.kelonggaran.hari < durasi.kelonggaran.hariMentah
                      ? `, dijepit dari ${durasi.kelonggaran.hariMentah}`
                      : ""}
                    {durasi.kelonggaran.sumber && durasi.kelonggaran.sumber.length > 0
                      ? ` — dikenali dari ${durasi.kelonggaran.sumber.join(", ")}`
                      : ""}
                    ; SK 048/2024 Tabel 2 nomor 1)
                  </span>
                </dd>
              </>
            ) : null}

            <dt className="font-semibold">Durasi yang dihitung</dt>
            <dd className="font-semibold tabular-nums">
              {durasi.hariBersih} hari
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({(durasi.hariBersih / 30).toLocaleString("id-ID", { maximumFractionDigits: 1 })}{" "}
                bulan, sebulan 30 hari)
              </span>
            </dd>

            <dt className="text-muted-foreground">Waktu putus (SK Dirjen)</dt>
            <dd>
              {pitaSk && durasi.waktuPutusSk ? (
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                    pitaSk.kelasKotak
                  )}
                >
                  {formatLencana(pitaSk.warna)} - {durasi.waktuPutusSk.sebutan}, nilai {durasi.waktuPutusSk.nilai}{" "}
                  dari 5
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">belum diterima dari server</span>
              )}
            </dd>

            {/* Tanpa baris ini, pengurangan 150 − 163 tidak terlihat di mana
                pun dan baris "Sisa" tampak salah hitung terhadap "Durasi yang
                dihitung" di atasnya. */}
            {durasi.kelonggaran ? (
              <>
                <dt className="text-muted-foreground">Dihitung untuk SEMA 2/2014</dt>
                <dd className="tabular-nums">
                  {durasi.hariSema ?? durasi.hariBersih} hari
                  <span className="ml-1 text-xs text-muted-foreground">
                    (hari di luar mediasi, TANPA kelonggaran perkara khusus — batas lima bulan
                    tidak mengenal kelonggaran itu)
                  </span>
                </dd>
              </>
            ) : null}

            <dt className="text-muted-foreground">Batas penyelesaian</dt>
            <dd className="tabular-nums">
              {durasi.ambangHari} hari
              <span className="ml-1 text-xs text-muted-foreground">
                (lima bulan - SEMA 2/2014; lewat dari itu majelis melapor kepada Ketua Pengadilan)
              </span>
            </dd>

            <dt className="text-muted-foreground">Sisa</dt>
            <dd
              className={cn(
                "tabular-nums",
                durasi.sisaHari !== null && durasi.sisaHari < 0
                  ? "font-semibold text-red-700 dark:text-red-300"
                  : ""
              )}
            >
              {durasi.sisaHari === null
                ? "—"
                : durasi.sisaHari < 0
                  ? `LEWAT ${Math.abs(durasi.sisaHari)} hari`
                  : `${durasi.sisaHari} hari`}
            </dd>
          </dl>

          {durasi.mediasi.length > 0 ? (
            <div className="mt-2">
              <p className="mb-1 text-xs font-semibold">Mediasi yang tercatat</p>
              <ul className="space-y-1 text-xs">
                {durasi.mediasi.map((m, i) => (
                  <li key={`mediasi-${m.mulai}-${i}`} className="flex flex-wrap items-center gap-2">
                    <span>
                      {tanggalHariPendek(m.mulai) || "—"} &rarr;{" "}
                      {tanggalHariPendek(m.selesai) || "belum berujung"}
                    </span>
                    {m.hasil ? <Badge variant="outline">{m.hasil}</Badge> : null}
                    {m.mediator ? (
                      <span className="text-muted-foreground">mediator: {m.mediator}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="mt-2 text-xs text-muted-foreground">
            Warna mengikuti unsur Waktu Putus Perkara pada SK Dirjen Badilag Nomor
            048/DJA/SK.KP3.4.3/IV/2024 tentang Evaluasi Kinerja pada SIPP di Lingkungan Peradilan
            Agama:{" "}
            {PITA_WAKTU_PUTUS.map((p, i) => (
              <Fragment key={p.nilai}>
                {i > 0 ? "; " : ""}
                <span className={cn("font-medium", p.kelasTeks)}>{p.warna}</span> {p.rentang}, nilai{" "}
                {p.nilai}
              </Fragment>
            ))}
            . Sebulan dihitung 30 hari dan hari pendaftaran ikut dihitung. Hari mediasi tidak
            dihitung sebagai jangka penyelesaian perkara - PERMA 1/2016 Pasal 24 ayat (2) dan (3).
            Pengecualian perkara khusus SK (perkara ghaib, dikurangi 120 hari) DIPOTONG dari
            &quot;Durasi yang dihitung&quot; dan karena itu ikut menentukan warnanya, tetapi TIDAK
            dipotong dari hari yang dihitung terhadap batas lima bulan — kelonggaran itu milik
            penilaian kinerja SK, sedangkan kewajiban lapor SEMA 2/2014 tidak mengenalnya. Hari
            mediasinya di sini dibaca dari catatan mediasi SIPP (dibatasi 60 hari), sedangkan
            penilaian SK di layar Status Perkara membacanya dari sumber lain, sehingga nilainya
            masih dapat berbeda untuk perkara yang bermediasi. Perkara yang melewati lima bulan
            dilaporkan majelis kepada Ketua Pengadilan dengan tembusan kepada Ketua Mahkamah Agung
            (SEMA 2/2014).
            Baris mediasi yang bertanggal mulai sama dianggap satu mediasi, dan yang sudah punya
            keputusan menang atas yang belum.
          </p>
        </Bagian>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Perkara {nomorPerkara}. Berkas e-Court yang belum tersimpan dapat ditarik dari menu Kendali
        Berkas.
      </p>
    </div>
  );
}

