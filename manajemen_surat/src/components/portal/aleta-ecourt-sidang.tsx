"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePortal } from "@/lib/app-state";
import { apiPath, withBasePath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Filter,
  Gauge,
  ListOrdered,
  MonitorPlay,
  Printer,
  RotateCcw,
} from "lucide-react";

import { AletaEcourtCetakJadwal } from "@/components/portal/aleta-ecourt-cetak-jadwal";
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
import { cn } from "@/lib/utils";
import { warnaStatusPutusan } from "@/lib/warna-putusan";

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
  alurPerkaraId: number;
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
  tanggalSidangBerikut: string;
  urutanSidang: number;
  dihadiriOleh: number | null;
  adaBas: boolean;
  pihak: { penggugat: string[]; tergugat: string[]; saksi?: string[]; lain?: string[] };
  panggilan: {
    hadirSebelumnya: number | null;
    wajibDipanggil: number[];
    belumDipanggil: number;
    // 1 penggugat/pemohon, 2 tergugat/termohon.
    sisiBelumDipanggil?: number[];
    retur: number;
    aman: boolean;
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

/** Nama jalur panggilan untuk ditampilkan. */
const NAMA_JALUR: Record<string, string> = {
  elektronik: "Elektronik (e-Summons)",
  surat_tercatat: "Surat tercatat",
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
 * Pengelompokan alur perkara, sejalan dengan urutan pada kueri jadwal.
 *
 * Nomor alurnya milik SIPP: 15 gugatan, 16 permohonan, 17 gugatan sederhana,
 * 122 jinayah. Alur lain masuk kelompok terakhir - bukan dihilangkan, karena
 * ringkasan yang jumlahnya tidak sama dengan isi tabel akan dianggap keliru.
 */
const KELOMPOK_ALUR = [
  { kunci: "gugatan", label: "Gugatan", alur: [15] },
  { kunci: "permohonan", label: "Permohonan", alur: [16] },
  { kunci: "gugatan-sederhana", label: "Gugatan Sederhana", alur: [17] },
  { kunci: "jinayah", label: "Jinayah", alur: [122] },
  { kunci: "lainnya", label: "Lainnya", alur: [] },
] as const;

type KunciAlur = (typeof KELOMPOK_ALUR)[number]["kunci"];

function kelompokAlur(alurPerkaraId: number): KunciAlur {
  const cocok = KELOMPOK_ALUR.find((k) => k.alur.includes(alurPerkaraId as never));
  return cocok ? cocok.kunci : "lainnya";
}

/** Sebutan kehadiran menurut kode SIPP. */
const SEBUTAN_HADIR: Record<number, string> = {
  1: "Semua pihak hadir",
  2: "Penggugat/pemohon saja",
  3: "Tergugat/termohon saja",
  4: "Tidak ada yang hadir",
};

/**
 * Apakah sidang ini berpotensi verstek?
 *
 * Verstek dijatuhkan ketika tergugat yang sudah dipanggil patut tidak hadir.
 * Yang dapat dibaca sistem hanyalah GEJALANYA: hanya penggugat yang hadir.
 * Karena itu disebut "potensi", bukan kesimpulan - keputusannya milik majelis.
 */
function potensiVerstek(dihadiriOleh: number | null) {
  return dihadiriOleh === 2;
}

/**
 * Apakah agenda sidang ini termasuk tahapan e-Litigasi.
 *
 * ============================================================================
 * DARI AGENDANYA, BUKAN DARI PENANDA PERKARA
 * ============================================================================
 *
 * Perkara yang didaftarkan lewat e-Court belum tentu disidangkan secara
 * e-Litigasi: persetujuan tergugat menentukan, dan persetujuan itu baru
 * diketahui pada sidang pertama. Yang menandai e-Litigasi justru AGENDANYA -
 * jawaban, replik, duplik, dan kesimpulan adalah tahapan yang pada
 * e-Litigasi dipertukarkan lewat aplikasi, bukan dibacakan di ruang sidang.
 *
 * Karena itu penentuannya di sini dan bukan di SIPP: yang ditanya bukan
 * "perkara ini e-Court atau bukan", melainkan "hari ini tahapannya
 * dipertukarkan lewat aplikasi atau tidak" - dan itu menentukan siapa yang
 * perlu hadir.
 */
const AGENDA_ELITIGASI = [
  /\bjawaban\b/i,
  /\breplik\b/i,
  /\bduplik\b/i,
  /duplik\s+rekonvensi/i,
  /\bkesimpulan\b/i,
  /musyawarah\s+majelis/i,
  // "Pembacaan putusan" dan "Pembacaan Penetapan" - keduanya benar-benar
  // ada di SIPP dengan ejaan berbeda, sehingga yang dicocokkan kata intinya.
  /pembacaan\s+(putusan|penetapan)/i,
  /putusan\s+sela/i,
];

/**
 * Agendanya saja. TIDAK dipakai sendirian - lihat sidangElitigasi di bawah.
 * Dipisah sebagai fungsi supaya dapat diuji tanpa merender apa pun.
 */
function agendaElitigasi(agenda: string): boolean {
  const teks = String(agenda || "");
  if (!teks) return false;
  return AGENDA_ELITIGASI.some((pola) => pola.test(teks));
}

/**
 * Agenda yang menandai perkara sedang MENUJU PUTUSAN hari itu.
 *
 * ============================================================================
 * KENAPA MERAH, DAN KENAPA TERPISAH DARI e-LITIGASI
 * ============================================================================
 *
 * Musyawarah majelis, pembacaan putusan, pembacaan penetapan, dan putusan sela
 * adalah hari yang menentukan: majelis harus lengkap, naskahnya harus siap,
 * dan tidak ada yang dapat ditunda tanpa penetapan. Merah di layar ini berarti
 * "menuntut perhatian hari ini", dan agenda-agenda ini memang begitu.
 *
 * Daftar polanya SAMA dengan yang dipakai penanda e-Litigasi - tetapi hanya
 * sebagian, dan syaratnya berbeda:
 *
 *   e-Litigasi  menuntut perkaranya terdaftar e-Court. Yang ditanya "hari ini
 *               tahapannya dipertukarkan lewat aplikasi atau tidak".
 *   Musyawarah  TIDAK menuntut apa pun selain agendanya. Perkara biasa maupun
 *               e-Court sama-sama bermusyawarah dan sama-sama membacakan
 *               putusan, dan keduanya sama-sama menuntut kesiapan.
 *
 * Karena itu keduanya berdiri sendiri-sendiri meski polanya beririsan. Satu
 * sidang dapat tertandai keduanya sekaligus, dan itu memang benar.
 */
const AGENDA_MUSYAWARAH = [
  /musyawarah/i,
  /pembacaan\s+(putusan|penetapan)/i,
  // "Pembacaan putusan" sudah tertangkap pola di atas; yang ini menangkap
  // penulisan lain yang benar-benar ada di SIPP - "Putusan", "Penetapan",
  // dan "Putusan Sela" tanpa kata pembacaan di depannya.
  /\bputusan\b/i,
  /\bpenetapan\b/i,
];

// Sidang ikrar talak SENGAJA tidak masuk. Ia memang hari yang menentukan -
// talak diucapkan dan perceraian berlaku sejak saat itu - tetapi ia bukan
// musyawarah dan bukan pembacaan putusan; putusannya sudah dijatuhkan jauh
// sebelumnya. Memasukkannya menambah 57 sidang merah pada 2026 saja, dan
// penanda merah yang menyala di mana-mana berhenti menuntut perhatian.

function agendaMusyawarah(agenda: string): boolean {
  const teks = String(agenda || "");
  if (!teks) return false;
  return AGENDA_MUSYAWARAH.some((pola) => pola.test(teks));
}

/**
 * Penanda e-Litigasi yang sesungguhnya: perkara e-Court DAN agenda elektronik.
 *
 * ============================================================================
 * KENAPA AGENDA SAJA TIDAK LAGI CUKUP
 * ============================================================================
 *
 * Selama daftar agendanya hanya jawaban, replik, duplik, dan kesimpulan,
 * agenda saja memang menandai - keempatnya jarang muncul di luar e-Litigasi.
 * Begitu daftarnya diperluas sampai musyawarah majelis dan pembacaan putusan,
 * ia berhenti menandai: pengukuran agenda 2026 di PA Donggala mencatat 31
 * sidang "Musyawarah Majelis" dan 20 "Pembacaan putusan", dan sebagian besar
 * perkara yang tidak pernah menyentuh e-Court sama sekali.
 *
 * Saringan yang memunculkan perkara biasa lebih menyesatkan daripada tidak ada
 * saringan - pembacanya menyangka daftar itu sudah tepat.
 *
 * lewatEcourt yang tidak terbaca dianggap BUKAN e-Court: gagal-tertutup, sama
 * seperti jalur penilaian lain di ALETA.
 */
function sidangElitigasi(baris: { agenda?: string; lewatEcourt?: boolean }): boolean {
  if (!baris.lewatEcourt) return false;
  return agendaElitigasi(baris.agenda || "");
}

/**
 * Apakah ini perkara verzet - perlawanan terhadap putusan verstek.
 *
 * SIPP tidak menyimpan penanda tersendiri untuknya; yang ada hanya nama jenis
 * perkaranya. "Perlawanan" adalah sebutan resmi di SIPP, "verzet" yang dipakai
 * sehari-hari - keduanya dikenali.
 *
 * Satu fungsi dipakai daftar maupun rincian. Dua salinan aturan yang sama akan
 * sama-sama bekerja, lalu pada suatu hari satu layar menandai perkara yang
 * tidak ditandai layar lain - untuk perkara yang persis sama.
 */
function perkaraVerzetDari(...teks: Array<string | undefined | null>): boolean {
  return /verzet|perlawanan/i.test(teks.filter(Boolean).join(" "));
}

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
  nada: "bahaya" | "awas" | "aman" | "sejuk" | "netral";
  judul: string;
  // Peta antrian ikut dikirim karena tiga keadaan terakhir menanyakannya.
  // Menaruhnya sebagai argumen, bukan menutupnya di dalam closure, membuat
  // daftar ini tetap dapat diuji tanpa merender komponennya.
  cocok: (baris: SidangBaris, antrian: Record<string, AntrianBaris>) => boolean;
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

const KEADAAN_SIDANG: KeadaanSidang[] = [
  {
    kunci: "retur",
    label: "Retur",
    nada: "bahaya",
    judul: "Ada relaas yang kembali tidak terlaksana. Panggilan harus diulang.",
    cocok: (x) => x.panggilan.retur > 0,
  },
  {
    kunci: "belum-dipanggil",
    label: "Belum dipanggil",
    nada: "bahaya",
    judul: "Masih ada pihak yang wajib dipanggil dan relaasnya belum ada.",
    cocok: (x) => x.panggilan.belumDipanggil > 0,
  },
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
          judul: "Sudah putus, tetapi putusannya belum beres di e-Court.",
          cocok: (x: SidangBaris) => Boolean(x.putusanEcourt?.perluTindakan),
        },
      ]
    : []),
  {
    kunci: "ditunda",
    label: "Ditunda",
    nada: "awas",
    judul: "Sidang ditunda ke tanggal lain.",
    cocok: (x) => x.ditunda,
  },
  {
    kunci: "belum-bas",
    label: "Belum ada BAS",
    nada: "awas",
    judul: "Berita acara sidang belum diunggah ke SIPP.",
    cocok: (x) => !x.adaBas,
  },
  {
    kunci: "sidang-pertama",
    label: "Sidang pertama",
    nada: "sejuk",
    judul: "Sidang pertama pada perkara ini.",
    cocok: (x) => x.urutanSidang <= 1,
  },
  {
    // Menggantikan "Agenda putusan" yang dulu bernada sejuk dan hanya
    // mencocokkan kata "putus". Nadanya dinaikkan menjadi bahaya karena
    // artinya memang begitu: hari ini majelis harus lengkap dan naskahnya
    // harus siap, dan tidak ada yang dapat ditunda tanpa penetapan.
    //
    // Tidak ditambahkan sebagai kotak KEDUA di sebelah yang lama - dua kotak
    // yang menyaring hal yang hampir sama membuat pembacanya menduga ada
    // bedanya, lalu mencari beda yang tidak ada.
    kunci: "musyawarah-majelis",
    label: "Musyawarah Majelis",
    nada: "bahaya",
    judul:
      "Agendanya musyawarah majelis, pembacaan putusan, pembacaan penetapan, atau putusan sela - majelis harus lengkap dan naskahnya harus siap.",
    cocok: (x) => agendaMusyawarah(x.agenda || ""),
  },
  {
    kunci: "e-litigasi",
    label: "e-Litigasi",
    nada: "sejuk",
    judul:
      "Perkara terdaftar lewat e-Court DAN agendanya tahapan yang dipertukarkan elektronik: jawaban, replik, duplik, duplik rekonvensi, kesimpulan, musyawarah majelis, atau pembacaan putusan/penetapan/putusan sela.",
    cocok: (x) => sidangElitigasi(x),
  },
  {
    kunci: "sudah-putus",
    label: "Sudah putus",
    nada: "aman",
    judul: "Perkaranya sudah dijatuhi putusan.",
    cocok: (x) => x.sudahPutus,
  },
  {
    kunci: "belum-putus",
    label: "Belum putus",
    nada: "netral",
    judul: "Perkaranya masih berjalan.",
    cocok: (x) => !x.sudahPutus,
  },
  {
    kunci: "tidak-dipanggil",
    label: "Tidak perlu dipanggil",
    nada: "netral",
    judul:
      "Tidak ada pihak yang wajib dipanggil untuk sidang ini - semuanya hadir pada sidang sebelumnya.",
    cocok: (x) => x.panggilan.wajibDipanggil.length === 0,
  },
  {
    kunci: "sudah-antri",
    label: "Sudah ambil antrian",
    nada: "sejuk",
    judul: "Pihaknya sudah mengambil nomor antrian, dalam jaringan maupun di mesin antrian.",
    cocok: (x, antrian) => Boolean(antrianUntuk(antrian, x)?.nomor),
  },
  {
    kunci: "antri-online",
    label: "Antrian online",
    nada: "sejuk",
    judul: "Antriannya diambil lewat WhatsApp, bukan di mesin antrian.",
    cocok: (x, antrian) => Boolean(antrianUntuk(antrian, x)?.online),
  },
  {
    kunci: "belum-antri",
    label: "Belum ambil antrian",
    nada: "awas",
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
];

/** Medan pencarian lanjutan untuk jadwal sidang. */
const MEDAN_CARI_SIDANG = [
  { kunci: "nomor", label: "Nomor perkara", petunjuk: "521/Pdt.G/2026" },
  { kunci: "pihak", label: "Nama pihak", petunjuk: "penggugat atau tergugat" },
  { kunci: "jenis", label: "Jenis perkara", petunjuk: "Cerai Gugat" },
  { kunci: "agenda", label: "Agenda", petunjuk: "Pemeriksaan Pokok Perkara" },
  { kunci: "majelis", label: "Majelis", petunjuk: "B-C2-C3 atau nama hakim" },
  { kunci: "petugas", label: "Panitera / juru sita", petunjuk: "nama petugas" },
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
    cocokTeks(baris.ruangan, isian.ruang ?? "") &&
    cocokTeks(baris.jamSidang, isian.jam ?? "") &&
    dalamRentang(nomorAntrian, isian.antrianDari ?? "", isian.antrianSampai ?? "")
  );
}

/**
 * Pencarian cepat: satu kotak yang menyapu seluruh kolom sekaligus.
 *
 * Berbeda dari kotak Cari di atas, yang dikirim ke SIPP dan menuntut tombol
 * Tampilkan. Yang ini bekerja atas baris yang SUDAH termuat, seketika, tanpa
 * satu pun kueri - dan karena itu boleh berjalan pada tiap ketikan.
 */
function cocokCariCepat(baris: SidangBaris, kata: string) {
  if (!kata.trim()) return true;
  const semua = [
    baris.nomorPerkara,
    baris.jenisPerkara,
    baris.agenda,
    baris.majelisKode,
    baris.majelisNama,
    baris.paniteraNama,
    baris.jurusitaNama,
    baris.ruangan,
    baris.jamSidang,
    ...baris.pihak.penggugat,
    ...baris.pihak.tergugat,
  ].join(" ");
  return cocokTeks(semua, kata);
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
  tanggalRelaas?: string;
}): string {
  if (baris.noResiPos || baris.tanggalKirimPos) return "Surat tercatat POS";
  if (baris.bertemu) return "Bertemu";
  if (baris.tanggalRelaas) return "Tidak bertemu";
  return "Belum dilaksanakan";
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
const PERAN_ANTRIAN: Array<{ kunci: string; label: string; sisi: string; kuasa: boolean }> = [
  { kunci: "penggugat", label: "Penggugat / Pemohon", sisi: "1", kuasa: false },
  { kunci: "tergugat", label: "Tergugat / Termohon", sisi: "2", kuasa: false },
  { kunci: "kuasa-penggugat", label: "Kuasa penggugat", sisi: "1", kuasa: true },
  { kunci: "kuasa-tergugat", label: "Kuasa tergugat", sisi: "2", kuasa: true },
  { kunci: "saksi", label: "Saksi", sisi: "", kuasa: false },
];

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

function MenuLayarAntrian() {
  const [terbuka, setTerbuka] = useState(false);
  const tutup = useCallback(() => setTerbuka(false), []);
  const wadah = useTutupSaatDiLuar(terbuka, tutup);

  return (
    <div className="relative" ref={wadah}>
      <Button size="sm" variant="outline" onClick={() => setTerbuka((buka) => !buka)}>
        <MonitorPlay className="mr-1.5 h-4 w-4" />
        Tampilan
      </Button>

      {terbuka ? (
        // bg-card, BUKAN bg-popover: token --popover tidak pernah didefinisikan
        // di globals.css, sehingga bg-popover menghasilkan warna yang tidak sah
        // dan menu tampil TEMBUS PANDANG di atas tabel di bawahnya. Tidak ada
        // galat apa pun - hanya tulisan yang bertumpuk dan tidak terbaca.
        <div className="absolute right-0 z-30 mt-1 w-72 rounded-md border bg-card text-card-foreground p-2 shadow-lg">
          {[
            { judul: "Untuk pihak", daftar: LAYAR_PIHAK },
            { judul: "Untuk operator", daftar: LAYAR_OPERATOR },
          ].map((kelompok) => (
            <div key={kelompok.judul} className="mb-1 last:mb-0">
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {kelompok.judul}
              </p>
              {kelompok.daftar.map((layar) => (
                <a
                  key={layar.jalur}
                  href={withBasePath(layar.jalur)}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded px-2 py-1.5 transition hover:bg-muted"
                  onClick={() => setTerbuka(false)}
                >
                  <span className="block text-sm font-medium">{layar.nama}</span>
                  <span className="block text-[11px] text-muted-foreground">{layar.guna}</span>
                </a>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
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
}: {
  baris: SidangBaris;
  /** Baris antrian perkara ini - dipakai menentukan sisi mana yang dapat direset. */
  antrian?: AntrianBaris;
  /** Nomor antrian yang sudah ada, bila perkaranya sudah pernah diambil. */
  sudahAda: number | null | undefined;
  onSelesai: () => void;
}) {
  const [terbuka, setTerbuka] = useState(false);
  const [sibuk, setSibuk] = useState("");
  const [pesan, setPesan] = useState("");

  // Menutup saat ditekan di luar - kait yang sama dengan menu Tampilan.
  const tutup = useCallback(() => setTerbuka(false), []);
  const wadah = useTutupSaatDiLuar(terbuka, tutup);

  const antrianSisi = sisiTerisi(antrian);

  const batalkan = async (sisi: { kunci: string; label: string; jam: string }) => {
    setSibuk(`batal-${sisi.kunci}`);
    setPesan("");
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
        setPesan(hasil.alasan || "Kehadiran belum dapat dibatalkan.");
        return;
      }
      // antrianDikosongkan false berarti kolomnya memang sudah kosong - bukan
      // kegagalan. Yang menekan dua kali tidak perlu diberi pesan galat atas
      // keadaan yang justru sudah sesuai keinginannya.
      setPesan(
        hasil.antrianDikosongkan
          ? `Kehadiran ${sisi.label} dibatalkan. Urutan antrian dihitung ulang.`
          : `Kehadiran ${sisi.label} memang sudah kosong.`
      );
      onSelesai();
    } catch {
      setPesan("Kehadiran belum dapat dibatalkan.");
    } finally {
      setSibuk("");
    }
  };

  const ambil = async (peran: (typeof PERAN_ANTRIAN)[number]) => {
    setSibuk(peran.kunci);
    setPesan("");
    try {
      const jawaban = await fetch(apiPath("/api/aleta-ecourt/antrian-ambil"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          perkaraId: baris.perkaraId,
          nomorPerkara: baris.nomorPerkara,
          peran: peran.kunci,
          sisi: peran.sisi,
          sebagaiKuasa: peran.kuasa,
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
        setPesan(hasil.alasan || "Kehadiran belum dapat dicatat.");
        return;
      }
      // Kedatangan kedua pada sisi yang sama TIDAK menggeser nomor - dijaga di
      // sisi bot. Yang dikatakan di sini bedanya, supaya petugas tahu
      // tekanannya berpengaruh atau hanya tercatat.
      setPesan(
        hasil.antrianDiisi
          ? `Nomor antrian terbit untuk ${hasil.sebutan || peran.label}.`
          : `${hasil.sebutan || peran.label} tercatat hadir; nomor antriannya sudah ada sebelumnya.`
      );
      onSelesai();
    } catch {
      setPesan("Kehadiran belum dapat dicatat.");
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
          className="absolute left-0 z-20 mt-1 w-52 rounded-md border bg-card text-card-foreground p-1 shadow-lg"
          onClick={(peristiwa) => peristiwa.stopPropagation()}
        >
          <p className="px-2 py-1 text-[11px] text-muted-foreground">Siapa yang hadir?</p>
          {PERAN_ANTRIAN.map((peran) => (
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

          {pesan ? (
            <p className="border-t px-2 py-1 text-[11px] text-muted-foreground">{pesan}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PenandaPanggilan({
  panggilan,
}: {
  panggilan: SidangBaris["panggilan"] | undefined;
}) {
  if (!panggilan || panggilan.aman) return null;

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
          belum dipanggil
          {sebutanSisiPendek(panggilan.sisiBelumDipanggil)}
        </span>
      ) : null}

      {panggilan.retur > 0 ? (
        <span
          className="rounded bg-red-500 px-1.5 py-0.5 text-[11px] font-semibold text-white"
          title="Surat panggilan dikembalikan - alamat perlu ditelusuri."
        >
          retur{panggilan.retur > 1 ? ` ${panggilan.retur}` : ""}
        </span>
      ) : null}
    </>
  );
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

const NAMA_HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** "Senin, 30 Agustus 2026" dari tanggal ISO. */
function tanggalTerbaca(tanggalIso: string) {
  const [tahun, bulan, hari] = tanggalIso.split("-").map((bagian) => Number(bagian));
  if (!tahun || !bulan || !hari) return tanggalIso;
  const waktu = new Date(tahun, bulan - 1, hari);
  return `${NAMA_HARI[waktu.getDay()]}, ${hari} ${NAMA_BULAN[bulan - 1]} ${tahun}`;
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
function SelAntrianJam({
  baris,
  antrian,
  tanggalTampil,
}: {
  baris: SidangBaris;
  antrian?: AntrianBaris;
  tanggalTampil: string;
}) {
  const jam = baris.jamSidang || "—";

  if (!antrian) {
    return (
      <>
        <div className="font-semibold tabular-nums">{jam}</div>
        {baris.tanggalSidang !== tanggalTampil ? (
          <div className="text-sm text-muted-foreground">{baris.tanggalSidang}</div>
        ) : null}
      </>
    );
  }

  return (
    <>
      {antrian.nomor ? (
        <div className="flex items-baseline gap-1.5">
          <span
            className={cn(
              "text-xl font-bold leading-none tabular-nums",
              antrian.keadaan === "dipanggil"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-primary"
            )}
            title={
              antrian.keadaan === "dipanggil"
                ? `Nomor antrian ${antrian.nomor} — sudah dipanggil masuk`
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
          {antrian.online ? (
            <span
              className="rounded-full border border-sky-400 bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-sky-700 dark:bg-sky-950 dark:text-sky-300"
              title="Antrian diambil dalam jaringan - bukan di mesin antrian ruang tunggu"
            >
              online
            </span>
          ) : null}
        </div>
      ) : (
        <div
          className="text-sm italic text-muted-foreground"
          title="Terdaftar di mesin antrian, tetapi belum ada pihak yang mengambil nomor."
        >
          belum ambil
        </div>
      )}

      <div className="mt-0.5 text-sm tabular-nums text-muted-foreground">{jam}</div>

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
      {antrian.pihak1 || antrian.pihak2 || antrian.saksi ? (
        <div className="mt-0.5 flex flex-wrap gap-x-1.5 gap-y-0.5 text-[10px] leading-tight">
          {antrian.pihak1 ? (
            <span
              className="rounded bg-emerald-100 px-1 font-medium text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
              title={`Penggugat/pemohon mengambil antrian pukul ${antrian.pihak1}`}
            >
              P {antrian.pihak1}
            </span>
          ) : null}
          {antrian.pihak2 ? (
            <span
              className="rounded bg-emerald-100 px-1 font-medium text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
              title={`Tergugat/termohon mengambil antrian pukul ${antrian.pihak2}`}
            >
              T {antrian.pihak2}
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

      {antrian.keadaan === "dipanggil" && antrian.jamPanggil ? (
        <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
          dipanggil {antrian.jamPanggil}
        </div>
      ) : null}

      {baris.tanggalSidang !== tanggalTampil ? (
        <div className="text-sm text-muted-foreground">{baris.tanggalSidang}</div>
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

/** Lencana keadaan verifikasi majelis - sejalan dengan Kendali Berkas. */
function LencanaVerifikasi({ status }: { status: string }) {
  if (status === "valid") return <Badge variant="success">Diverifikasi</Badge>;
  if (status === "tidak_valid") return <Badge variant="danger">Tidak valid</Badge>;
  // Berkas pendaftaran tidak mengenal verifikasi majelis sama sekali - lihat
  // catatan pada ecourtVerificationService di ALETA Bot.
  if (status === "tidak_perlu") return <Badge variant="muted">Tanpa verifikasi</Badge>;
  return <Badge variant="warning">Menunggu majelis</Badge>;
}

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
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");

  const unduh = async () => {
    setSibuk(true);
    setGalat("");
    try {
      const respons = await fetch(apiPath(alamat), { cache: "no-store" });
      const tipe = respons.headers.get("content-type") || "";

      // Jawaban galat berbentuk JSON tidak boleh tersimpan sebagai berkas -
      // itulah sebab laporan "berkasnya hilang": yang terunduh bukan berkasnya.
      if (!respons.ok || tipe.includes("application/json")) {
        const isi = await respons.json().catch(() => null);
        setGalat(pesanGalatPortal(isi, `HTTP ${respons.status}`).replace(/_/g, " "));
        return;
      }

      const blob = await respons.blob();
      if (blob.size === 0) {
        setGalat("Berkasnya kosong di server.");
        return;
      }

      const url = URL.createObjectURL(blob);
      const tautan = document.createElement("a");
      tautan.href = url;

      const disposisi = respons.headers.get("content-disposition") || "";
      const cocok = disposisi.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
      tautan.download = cocok ? decodeURIComponent(cocok[1]) : namaCadangan;

      document.body.appendChild(tautan);
      tautan.click();
      tautan.remove();

      // Tidak dilepas seketika: peramban masih membaca blobnya setelah klik
      // selesai diproses, dan melepasnya di baris yang sama membatalkan
      // sebagian unduhan tanpa pesan apa pun.
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (kesalahan) {
      setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal mengunduh.");
    } finally {
      setSibuk(false);
    }
  };

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
        className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-lg border bg-background p-4 shadow-lg"
        onClick={(peristiwa) => peristiwa.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <Button size="sm" variant="outline" onClick={() => geserBulan(-1)}>
            ‹
          </Button>
          <h3 className="text-sm font-semibold">
            {NAMA_BULAN[nomorBulan - 1]} {tahun}
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
          {NAMA_HARI.map((nama) => (
            <div key={nama} className="py-1 font-medium text-muted-foreground">
              {nama.slice(0, 3)}
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
                  akhirPekan && !isi ? "text-muted-foreground" : "",
                ].join(" ")}
                aria-label={`${tanggalTerbaca(tanggal)}${isi ? `, ${isi.jumlah} sidang` : ", tanpa sidang"}`}
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
            {memuat ? "Memuat kalender…" : "Angka pada tanggal adalah jumlah sidang."}
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
}: {
  onBukaStatus?: (nomorPerkara: string) => void;
} = {}) {
  const [dari, setDari] = useState(hariIni());
  const [sampai, setSampai] = useState(hariIni());
  const [cari, setCari] = useState("");

  const [sidang, setSidang] = useState<SidangBaris[]>([]);
  const [kesiapan, setKesiapan] = useState<Record<string, KesiapanRingkas>>({});
  // Antrian datang bersama jadwal dalam satu permintaan - ia dibaca bot dari
  // basis data lain, dan menariknya terpisah dari peramban berarti dua
  // permintaan yang hasilnya dapat berbeda umur.
  const [antrian, setAntrian] = useState<KeadaanAntrian>({
    terbaca: false,
    alasan: "",
    tanggal: [],
    peta: {},
  });
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
   * Rentang tanggal dan kotak Cari di atas sengaja TIDAK ikut: keduanya
   * menentukan apa yang DIAMBIL dari SIPP, bukan apa yang disembunyikan dari
   * yang sudah diambil.
   */
  const adaSaringan =
    Boolean(alurTerpilih) ||
    keadaanTerpilih.length > 0 ||
    Boolean(cariCepat) ||
    cariLanjut.jumlahAktif > 0 ||
    Boolean(saringJenis) ||
    Boolean(saringTahap) ||
    Boolean(saringMajelis) ||
    Boolean(saringRuang);

  const alihkanKeadaan = (kunci: string) =>
    setKeadaanTerpilih((sekarang) =>
      sekarang.includes(kunci)
        ? sekarang.filter((x) => x !== kunci)
        : [...sekarang, kunci]
    );

  const [sedangCetak, setSedangCetak] = useState(false);

  // Kendali diciutkan supaya daftar sidang lebih panjang. Bawaannya TERBUKA:
  // yang baru membuka layar harus melihat alat yang tersedia, dan menemukan
  // layar yang alatnya tersembunyi jauh lebih membingungkan daripada layar
  // yang alatnya makan tempat.
  const [kendaliCiut, setKendaliCiut] = useState(false);

  // Nama pengadilan dari identitas lembaga, bukan dipatok mati - ALETA dapat
  // dipasang di satker lain.
  const { institutionIdentity } = usePortal();
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState("");

  const [kalenderTerbuka, setKalenderTerbuka] = useState(false);
  const [dibuka, setDibuka] = useState("");

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
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("aleta.jadwal-sidang.ringkas", modeRingkas ? "1" : "0");
    } catch {
      /* sama seperti di atas */
    }
  }, [modeRingkas]);

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

  // Daftar yang sedang disorot ringkasan. Tabel utama TETAP menampilkan
  // seluruhnya - menyaringnya sekalian akan membuat angka pada ringkasan tidak
  // lagi cocok dengan isi tabelnya.
  const sidangTerpilih = alurTerpilih
    ? sidang.filter((baris) => kelompokAlur(baris.alurPerkaraId) === alurTerpilih)
    : [];
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
  // Angka pada kotak keadaan dihitung dari SELURUH sidang hari itu, bukan dari
  // yang sudah tersaring - kalau ikut menyusut, menyalakan satu saringan akan
  // membuat saringan lain tampak nol dan mustahil dilepas kembali.
  const jumlahKeadaan = useMemo(() => {
    const hitung: Record<string, number> = {};
    for (const keadaan of KEADAAN_SIDANG) {
      hitung[keadaan.kunci] = sidang.filter((baris) => keadaan.cocok(baris, antrian.peta)).length;
    }
    return hitung;
  }, [sidang, antrian.peta]);

  const sidangTampil = useMemo(() => {
    let hasil = sidang;

    if (keadaanTerpilih.length > 0) {
      const dipilih = KEADAAN_SIDANG.filter((x) => keadaanTerpilih.includes(x.kunci));
      // "Atau", bukan "dan": menyalakan retur dan ditunda sekaligus berarti
      // "tunjukkan yang bermasalah". Menggabungnya dengan "dan" hampir selalu
      // menghasilkan daftar kosong, dan itu terbaca sebagai fitur yang rusak.
      hasil = hasil.filter((baris) =>
        dipilih.some((keadaan) => keadaan.cocok(baris, antrian.peta))
      );
    }

    if (cariCepat.trim()) {
      hasil = hasil.filter((baris) => cocokCariCepat(baris, cariCepat));
    }

    if (cariLanjut.jumlahAktif > 0) {
      hasil = hasil.filter((baris) =>
        cocokCariLanjutSidang(baris, cariLanjut.isian, antrian.peta)
      );
    }

    return urutkan(hasil, urutTabel, (baris, kunci) =>
      nilaiUrutSidang(baris, kunci, kesiapan, antrian.peta)
    );
  }, [
    sidang,
    keadaanTerpilih,
    cariCepat,
    cariLanjut.isian,
    cariLanjut.jumlahAktif,
    urutTabel,
    kesiapan,
    antrian.peta,
  ]);

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
   */
  const resetSemuaSaringan = () => {
    setAlurTerpilih("");
    bersihkanSaringan();
    setKeadaanTerpilih([]);
    setCariCepat("");
    cariLanjut.bersihkan();
  };

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
  const muatTanggal = useCallback(
    async (mulai: string, akhir: string, pakaiSkor?: boolean) => {
    setMemuat(true);
    setGalat("");
    try {
      const params = new URLSearchParams({ dari: mulai, sampai: akhir, cari });
      // Penilaian menembakkan beberapa kueri per sidang. Petugas yang hanya
      // ingin melihat jam sidang dapat mematikannya.
      if (pakaiSkor ?? nilaiKesiapan) params.set("kesiapan", "1");
      const jawaban = await fetch(apiPath(`/api/aleta-ecourt/sidang?${params.toString()}`), {
        cache: "no-store",
      });
      const isi = await jawaban.json();
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal membaca jadwal sidang."));

      const data = isi?.data ?? isi;
      if (!data?.available) {
        setGalat(String(data?.message || "ALETA Bot belum dapat dihubungi."));
        setSidang([]);
        // Antrian ikut dikosongkan: nomor antrian kemarin yang tertinggal di
        // layar lebih menyesatkan daripada kolom yang kosong.
        setAntrian({ terbaca: false, alasan: "", tanggal: [], peta: {} });
        return;
      }
      setSidang(Array.isArray(data.sidang) ? data.sidang : []);
      setKesiapan((data.kesiapan ?? {}) as Record<string, KesiapanRingkas>);
      setAntrian(
        (data.antrian ?? { terbaca: false, alasan: "", tanggal: [], peta: {} }) as KeadaanAntrian
      );
    } catch (kesalahan) {
      setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal membaca jadwal sidang.");
    } finally {
      setMemuat(false);
    }
    },
    [cari, nilaiKesiapan]
  );

  const muat = useCallback(() => muatTanggal(dari, sampai), [muatTanggal, dari, sampai]);

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

  return (
    <Card>
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
      <CardHeader className="flex-row items-center justify-between gap-2 p-4 pb-2 sm:p-5 sm:pb-2">
        <CardTitle className="text-base font-bold uppercase tracking-wide sm:text-lg">
          Jadwal perkara yang bersidang
        </CardTitle>
        <div className="flex shrink-0 items-center gap-2">
        {/* Pemilih tampilan berdiri di kepala, bukan di antara saringan:
            ia menjawab "seberapa padat saya mau melihatnya", satu keluarga
            dengan tombol ciutkan - dan justru paling dibutuhkan ketika
            kendali lainnya sedang disembunyikan. */}
        <div className="inline-flex overflow-hidden rounded-md border text-sm">
          <button
            type="button"
            onClick={() => setModeRingkas(true)}
            className={cn(
              "px-2.5 py-1",
              modeRingkas ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            Ringkas
          </button>
          <button
            type="button"
            onClick={() => setModeRingkas(false)}
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
        </div>
      </CardHeader>

      <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
        {galat ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {galat}
          </p>
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
            <div className="flex items-center overflow-hidden rounded-lg border bg-card shadow-sm">
              <button
                type="button"
                aria-label="Hari sebelumnya"
                onClick={() => pilihHari(geserHari(dari, -1))}
                className="px-2.5 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex items-center border-x bg-background/40">
                <Input
                  type="date"
                  value={dari}
                  onChange={(peristiwa) => pilihHari(peristiwa.target.value)}
                  className="h-9 w-[8.75rem] rounded-none border-0 bg-transparent text-center focus-visible:ring-0"
                  aria-label="Tanggal sidang mulai"
                />
                <span aria-hidden className="select-none px-0.5 text-muted-foreground">
                  –
                </span>
                <Input
                  type="date"
                  value={sampai}
                  min={dari}
                  onChange={(peristiwa) => setSampai(peristiwa.target.value)}
                  className="h-9 w-[8.75rem] rounded-none border-0 bg-transparent text-center focus-visible:ring-0"
                  aria-label="Tanggal sidang sampai"
                />
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
                className="border-l px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                Hari ini
              </button>

              {/* Ikon saja - gambarnya sudah menerangkan dirinya, dan
                  namanya hanya menambah lebar tanpa menambah keterangan.
                  aria-label dan title menjaganya tetap terbaca bagi yang
                  memakai pembaca layar maupun yang ragu. */}
              <button
                type="button"
                aria-label="Pilih tanggal dari kalender"
                title="Pilih tanggal dari kalender"
                onClick={() => setKalenderTerbuka(true)}
                className="border-l px-3 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <CalendarDays className="h-4 w-4" />
              </button>
            </div>

            <Button size="sm" disabled={memuat} onClick={() => void muat()}>
              {memuat ? "Memuat…" : "Tampilkan"}
            </Button>

            {/* Tanggal terbacanya, bukan angka - "Senin" adalah yang dicari
                orang, bukan "31/08". */}
            <div className="ml-auto text-right">
              <p className="text-sm font-semibold leading-tight">{tanggalTerbaca(dari)}</p>
              <p className="text-sm text-muted-foreground">
                {memuat
                  ? "memuat…"
                  : sidang.length === 0
                    ? "tidak ada sidang"
                    : `${sidang.length} sidang${dari !== sampai ? " pada rentang ini" : ""}`}
              </p>
            </div>
          </div>

          {/* Tombol tindakan berdiri sendiri dan IKUT CIUT: mencetak,
              menghitung skor, dan mendaftarkan antrian tidak dikerjakan tiap
              kali layar dibuka. */}
          <div className={cn("flex flex-wrap items-center gap-2", kendaliCiut && "hidden")}>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={nilaiKesiapan ? "default" : "outline"}
                disabled={memuat}
                onClick={() => {
                  // Menyalakan skor HARUS memuat ulang. Sebelumnya tombolnya
                  // hanya membalik penanda, sehingga tulisannya berubah jadi
                  // "Skor: nyala" tetapi kolom Siap tetap bergaris - skornya
                  // memang belum pernah diminta ke bot.
                  const menyala = !nilaiKesiapan;
                  setNilaiKesiapan(menyala);
                  if (menyala) void muatTanggal(dari, sampai, true);
                  else setKesiapan({});
                }}
                title="Menghitung kesiapan tiap sidang dari SIPP dan arsip e-Court: relaas, berkas, identitas pihak. Perlu beberapa detik."
              >
                <Gauge className="mr-1.5 h-4 w-4" />
                {memuat && nilaiKesiapan ? "Menghitung…" : nilaiKesiapan ? "Skor: nyala" : "Hitung skor"}
              </Button>

              <MenuLayarAntrian />

              <Button
                size="sm"
                variant="outline"
                disabled={sidang.length === 0}
                onClick={() => setSedangCetak(true)}
              >
                <Printer className="mr-1.5 h-4 w-4" />
                Cetak
              </Button>

              {/* Pendaftaran ke aplikasi antrian ruang tunggu.

                  Dua tekanan, bukan satu: yang pertama hanya MEMPERLIHATKAN
                  apa yang akan didaftarkan, yang kedua benar-benar menulis.
                  Yang ditulis tabel milik aplikasi antrian, dan satu tekanan
                  yang tidak disengaja di sana tidak dapat dibatalkan dari sini.

                  ALETA hanya MENAMBAH perkara yang belum terdaftar. Nomor
                  antriannya tidak ditulis: nomor lahir dari pengambilan, bukan
                  dari pendaftaran, sehingga baris baru masuk sebagai "belum
                  diambil" dan tidak menggeser nomor siapa pun. */}
              <Button
                size="sm"
                variant="outline"
                disabled={sinkronSibuk || sidang.length === 0}
                onClick={() => void periksaSinkron()}
                title="Mendaftarkan perkara yang tampil ke aplikasi antrian ruang tunggu, supaya para pihak dapat mengambil nomor. Diperlihatkan dulu sebelum ditulis, dan hanya menambah yang belum terdaftar."
              >
                <ListOrdered className="mr-1.5 h-4 w-4" />
                {sinkronSibuk ? "Memeriksa…" : "Daftarkan ke antrian"}
              </Button>

              {/* Pencarian yang dikirim ke SIPP - berbeda dari kotak "Saring di
                  dalam hasil" di bawah, yang bekerja atas baris yang sudah
                  termuat. Tempatnya di sini, di sisi tombol tindakan, karena ia
                  pun menuntut Tampilkan ditekan sesudahnya. */}
              <Input
                placeholder="Cari nomor perkara, jenis, atau agenda"
                value={cari}
                onChange={(peristiwa) => setCari(peristiwa.target.value)}
                onKeyDown={(peristiwa) => {
                  if (peristiwa.key === "Enter" && !memuat) void muat();
                }}
                className="h-9 w-64"
                aria-label="Cari nomor perkara, jenis, atau agenda"
              />
            </div>
          </div>
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
            Nomor antrian tidak terbaca: {antrian.alasan} — periksa sambungan
            <strong> antrian_sidang</strong> di Admin ALETA Bot, tab Koneksi SQL. Jadwalnya
            sendiri tetap benar.
          </p>
        ) : null}

        {/* Tabel antrian memuat hari berjalan saja. Bila ia memuat lebih dari
            satu tanggal, nomornya patut diragukan - rumus yang menjawab
            WhatsApp pun tidak menyaring tanggal, sehingga nomor yang diterima
            para pihak ikut bergeser. Disebutkan, bukan didiamkan. */}
        {antrian.terbaca && antrian.tanggal.length > 1 ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
            Tabel antrian memuat {antrian.tanggal.length} tanggal sekaligus (
            {antrian.tanggal.join(", ")}). Nomor antrian dihitung dari seluruhnya, sama
            seperti nomor yang dikirim lewat WhatsApp — periksa apakah tabel turunannya
            sudah dibersihkan.
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
        {sidang.length > 0 && !kendaliCiut ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {ringkasAlur(sidang)
              .filter((k) => k.jumlah > 0 || alurTerpilih === k.kunci)
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
            <span aria-hidden className="mx-1 h-5 w-px bg-border" />

            {KEADAAN_SIDANG.filter(
              (keadaan) =>
                (jumlahKeadaan[keadaan.kunci] ?? 0) > 0 ||
                keadaanTerpilih.includes(keadaan.kunci)
            ).map((keadaan) => (
              <ChipSaring
                key={keadaan.kunci}
                label={keadaan.label}
                jumlah={jumlahKeadaan[keadaan.kunci] ?? 0}
                nada={keadaan.nada}
                judul={keadaan.judul}
                aktif={keadaanTerpilih.includes(keadaan.kunci)}
                onTekan={() => alihkanKeadaan(keadaan.kunci)}
              />
            ))}
          </div>
        ) : null}

        {/* ==================================================================
            PENCARIAN DI DALAM HASIL
            ==================================================================

            Terpisah dari kotak Cari di atas, dan sengaja. Yang di atas
            dikirim ke SIPP dan menuntut tombol Tampilkan; yang ini menyaring
            baris yang sudah termuat, seketika, tanpa satu pun kueri.

            Keduanya berguna: yang satu memperluas apa yang diambil, yang
            lain mempersempit apa yang dilihat. */}
        {sidang.length > 0 && !kendaliCiut ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={cariCepat}
              onChange={(e) => setCariCepat(e.target.value)}
              placeholder="Saring di dalam hasil: nomor, pihak, agenda, majelis, ruang…"
              className="h-8 max-w-md flex-1 text-sm"
            />
            <Button
              size="sm"
              variant={lanjutTerbuka || cariLanjut.jumlahAktif > 0 ? "default" : "outline"}
              onClick={() => setLanjutTerbuka((buka) => !buka)}
            >
              <Filter className="mr-1.5 h-4 w-4" />
              Pencarian lanjutan
              {cariLanjut.jumlahAktif > 0 ? ` (${cariLanjut.jumlahAktif})` : ""}
            </Button>

            {/* ============================================================
                RESET BERDIRI DI SINI, BUKAN DI DERETAN KOTAK KEADAAN
                ============================================================

                Sebelumnya ia ikut mengantre di antara belasan kotak keadaan,
                dan karena deretan itu selalu penuh, ia hampir selalu jatuh
                sendirian ke baris berikutnya - satu baris penuh terpakai oleh
                satu tombol, dan jumlah sidang yang terlihat berkurang.

                Tempatnya di sini karena inilah baris kendali saringan: kotak
                saring dan pencarian lanjutan menyempitkan daftar, dan tombol
                ini melepasnya. Baris ini pun jarang penuh, sehingga ia tidak
                pernah lagi mendorong apa pun ke bawah.

                Angka "x dari y" tetap ada di sebelahnya: yang paling sering
                ditanyakan saat daftar menyusut adalah berapa yang
                disembunyikan. */}
            {adaSaringan ? (
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
        ) : null}

        {lanjutTerbuka && sidang.length > 0 ? (
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
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sidangTersaring.map((baris) => (
                <button
                  key={`${baris.nomorPerkara}|${baris.sidangId}`}
                  type="button"
                  onClick={() => onBukaStatus?.(baris.nomorPerkara)}
                  title={`Buka status perkara ${baris.nomorPerkara}`}
                  className="rounded-lg border bg-card p-3 text-left text-sm transition hover:border-primary/50 hover:bg-muted/50"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{baris.nomorPerkara}</span>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {baris.jamSidang || "—"}
                    </span>
                  </div>

                  <p className="mt-0.5 text-sm text-muted-foreground">{baris.jenisPerkara}</p>

                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {baris.urutanSidang > 0 ? (
                      <Badge variant="muted">sidang ke-{baris.urutanSidang}</Badge>
                    ) : null}
                    {baris.ditunda ? <Badge variant="warning">ditunda</Badge> : null}
                    <PenandaPanggilan panggilan={baris.panggilan} />
                    {potensiVerstek(baris.dihadiriOleh) ? (
                      <Badge variant="danger" title="Hanya penggugat/pemohon yang hadir pada sidang ini.">
                        potensi verstek
                      </Badge>
                    ) : baris.dihadiriOleh === 1 ? (
                      <Badge variant="success">contradictoir</Badge>
                    ) : baris.dihadiriOleh ? (
                      <Badge variant="muted">{SEBUTAN_HADIR[baris.dihadiriOleh]}</Badge>
                    ) : null}
                  </div>

                  <dl className="mt-2 space-y-0.5 text-sm">
                    <div>
                      <dt className="inline text-muted-foreground">Agenda: </dt>
                      <dd className="inline">{baris.agenda || "—"}</dd>
                    </div>
                    <div>
                      <dt className="inline text-muted-foreground">Majelis: </dt>
                      <dd className="inline font-mono">{baris.majelisKode || "—"}</dd>
                    </div>
                    <div>
                      <dt className="inline text-muted-foreground">Panitera: </dt>
                      <dd className="inline">{baris.paniteraNama || "—"}</dd>
                    </div>
                    <div>
                      <dt className="inline text-muted-foreground">Jurusita: </dt>
                      <dd className="inline">{baris.jurusitaNama || "—"}</dd>
                    </div>
                    <div>
                      <dt className="inline text-muted-foreground">Ruang: </dt>
                      <dd className="inline">{baris.ruangan || "—"}</dd>
                    </div>
                  </dl>

                  <p className="mt-2 text-sm text-primary">Buka status perkara →</p>
                </button>
              ))}
            </div>
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
              <p className="text-rose-600">{sinkronHasil.alasan}</p>
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
              <p className="text-emerald-700">
                {sinkronHasil.ditambahkan} perkara didaftarkan ke antrian.
                {sinkronHasil.gagal.length > 0
                  ? ` ${sinkronHasil.gagal.length} gagal: ${sinkronHasil.gagal[0].sebab}`
                  : ""}{" "}
                Nomor antriannya baru terbit saat para pihak mengambilnya.
              </p>
            )}
          </div>
        ) : null}

        {/* Tinggi tabel MENGIKUTI kendali yang diciutkan: ruang yang dihemat
            di atas diberikan kepada daftar sidangnya, bukan dibiarkan kosong.
            Itulah gunanya menciutkan - kalau tabelnya tetap setinggi semula,
            yang didapat hanya ruang putih. */}
        <div
          className={cn(
            "overflow-auto rounded-xl border",
            kendaliCiut ? "max-h-[82vh]" : "max-h-[70vh]"
          )}
        >
          <table
            className={cn(
              "w-full text-sm",
              modeRingkas
                ? "min-w-[640px] [&_.kolom-lengkap]:hidden"
                : "min-w-[980px] [&_.hanya-ringkas]:hidden"
            )}
          >
            <thead className="sticky top-0 z-10 bg-muted text-left text-sm uppercase tracking-wide shadow-sm">
              {/* Tiap kepala dapat ditekan: naik, turun, lalu kembali ke
                  urutan asal. Putaran ketiga penting - tanpa jalan kembali,
                  satu tekanan yang tidak disengaja mengunci tabelnya, dan
                  satu-satunya cara pulih adalah memuat ulang halaman. */}
              <tr>
                <th className="px-2 py-2 text-right font-medium">No</th>
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
                <KepalaUrut
                  kunci="antrian"
                  urutan={urutTabel}
                  onTekan={tekanUrut}
                  className="px-2"
                  judul="Urutkan menurut nomor antrian; yang belum mengambil dan yang tanpa antrian jatuh ke bawah"
                >
                  Antrian / Jam
                </KepalaUrut>
                <KepalaUrut kunci="perkara" urutan={urutTabel} onTekan={tekanUrut}>
                  Perkara &amp; Para Pihak
                </KepalaUrut>
                <KepalaUrut kunci="agenda" urutan={urutTabel} onTekan={tekanUrut}>
                  Agenda
                </KepalaUrut>
                <KepalaUrut className="kolom-lengkap" kunci="majelis" urutan={urutTabel} onTekan={tekanUrut}>
                  Majelis
                </KepalaUrut>
                <KepalaUrut className="kolom-lengkap" kunci="petugas" urutan={urutTabel} onTekan={tekanUrut}>
                  Petugas Sidang
                </KepalaUrut>
                <KepalaUrut kunci="ruang" urutan={urutTabel} onTekan={tekanUrut}>
                  Ruang
                </KepalaUrut>
                <KepalaUrut
                  kunci="putusan"
                  className="kolom-lengkap"
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
              {memuat ? (
                <tr>
                  <td className="px-3 py-6 text-center text-muted-foreground" colSpan={10}>
                    Memuat jadwal…
                  </td>
                </tr>
              ) : sidangTampil.length === 0 && sidang.length > 0 ? (
                <tr>
                  <td className="px-3 py-10 text-center" colSpan={10}>
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
                  <td className="px-3 py-10 text-center" colSpan={10}>
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
                  return (
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
                              : "hover:bg-muted/50"
                        )}
                      >
                        {/* Nomor urut, bukan nomor perkara: yang dijawab
                            adalah "hari ini ada berapa sidang". */}
                        <td className="px-2 py-2 text-right text-sm tabular-nums text-muted-foreground">
                          {urutan + 1}
                        </td>
                        <td className="px-2 py-2 text-center kolom-lengkap">
                          <LencanaKesiapan
                            nilai={nilaiKesiapan ? kesiapan[kunci] : undefined}
                            diminta={nilaiKesiapan}
                          />
                        </td>
                        <td className="px-2 py-2 align-top">
                          <SelAntrianJam
                            baris={baris}
                            antrian={antrianUntuk(antrian.peta, baris)}
                            tanggalTampil={dari}
                          />

                          {/* Pengambilan antrian dari sisi PETUGAS, di kolom
                              yang memang sudah memuat nomornya. Sebelumnya
                              satu-satunya cara mengambil adalah layar sentuh di
                              ruang tunggu - dan yang datang menghadap meja
                              pelayanan tidak terlayani sama sekali. */}
                          <div className="mt-1">
                            <TombolAmbilAntrian
                              baris={baris}
                              antrian={antrianUntuk(antrian.peta, baris)}
                              sudahAda={antrianUntuk(antrian.peta, baris)?.nomor}
                              onSelesai={() => void muatTanggal(dari, sampai, nilaiKesiapan)}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span className="text-[0.95rem] font-extrabold tracking-tight">
                            {baris.nomorPerkara}
                          </span>
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
                          {perkaraVerzetDari(baris.jenisPerkara) ? (
                            <Badge
                              variant="danger"
                              className="ml-2 align-middle"
                              title="Perkara perlawanan terhadap putusan verstek."
                            >
                              verzet
                            </Badge>
                          ) : null}
                          {/* Penanda panggilan tepat di samping nomor perkara:
                              itulah yang dicari mata saat menelusuri jadwal. */}
                          <span className="ml-2 inline-flex gap-1 align-middle">
                            <PenandaPanggilan panggilan={baris.panggilan} />
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
                              disebut dan dipisah koma - dipotong truncate bila
                              melebihi lebar kolom, dengan nama lengkapnya tetap
                              terbaca pada title.

                              Penanda "+2" yang sempat dipakai sudah DIHAPUS. Ia
                              menimbulkan pertanyaan alih-alih menjawabnya, dan
                              angkanya pun keliru: saksi ikut terhitung sebagai
                              penggugat, sehingga hampir setiap perkara tampak
                              berpenggugat tiga orang. */}
                          {baris.pihak.penggugat.length > 0 ||
                          baris.pihak.tergugat.length > 0 ? (
                            <div className="mt-0.5 space-y-0.5 text-sm text-muted-foreground">
                              {baris.pihak.penggugat.length > 0 ? (
                                <div
                                  className="max-w-[24rem] truncate"
                                  title={baris.pihak.penggugat.join(", ")}
                                >
                                  <span className="font-medium text-foreground/70">P:</span>{" "}
                                  {baris.pihak.penggugat.join(", ")}
                                </div>
                              ) : null}
                              {baris.pihak.tergugat.length > 0 ? (
                                <div
                                  className="max-w-[24rem] truncate"
                                  title={baris.pihak.tergugat.join(", ")}
                                >
                                  <span className="font-medium text-foreground/70">T:</span>{" "}
                                  {baris.pihak.tergugat.join(", ")}
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                          {/* Jenis perkara kini di bawah nomornya - keduanya
                              menjawab pertanyaan yang sama, "perkara apa ini",
                              dan memisahkannya jadi dua kolom hanya memaksa
                              mata bolak-balik.

                              Ditebalkan: "Cerai Gugat" dan "Cerai Talak"
                              menentukan jalan perkaranya sama sekali - siapa
                              yang memohon, apakah ada ikrar talak - dan
                              sebelumnya ia sekelabu nama pihak di atasnya. */}
                          <div className="mt-0.5 text-sm font-extrabold text-foreground/90">
                            {baris.jenisPerkara || "—"}
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
                          <div className="hanya-ringkas mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                            {baris.majelisKode ? (
                              <span title={baris.majelisNama}>
                                <span className="font-medium text-foreground/70">Majelis</span>{" "}
                                {baris.majelisKode}
                              </span>
                            ) : null}
                            {baris.paniteraNama ? (
                              <span title={`Panitera Pengganti: ${baris.paniteraNama}`}>
                                <span className="font-medium text-foreground/70">PP</span>{" "}
                                {baris.paniteraNama}
                              </span>
                            ) : null}
                            {baris.jurusitaNama ? (
                              <span title={`Juru Sita: ${baris.jurusitaNama}`}>
                                <span className="font-medium text-foreground/70">JS</span>{" "}
                                {baris.jurusitaNama}
                              </span>
                            ) : null}
                          </div>

                          {/* Keadaan yang di mode Lengkap terbaca dari kolomnya
                              sendiri. Retur dan belum-dipanggil TIDAK diulang
                              di sini - penandanya sudah menempel di samping
                              nomor perkara pada kedua mode. */}
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            {/* ==============================================
                                KUASA DI KEDUA MODE
                                ==============================================

                                Ada tidaknya kuasa mengubah SIAPA yang dipanggil
                                dan siapa yang berhak hadir. Selama ini ia baru
                                terlihat sesudah satu sidang dibuka - padahal
                                yang membacakan jadwal perlu tahu sebelum
                                memanggil, bukan sesudah. */}
                            {baris.adaKuasa ? (
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
                          {(baris.saksiPihak1 ?? 0) + (baris.saksiPihak2 ?? 0) > 0 ? (
                            <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                              {(baris.saksiPihak1 ?? 0) > 0 ? (
                                <div className="max-w-[24rem] truncate">
                                  <span className="font-medium text-foreground/75">
                                    Saksi P ({baris.saksiPihak1}):
                                  </span>{" "}
                                  <span title={(baris.saksiNamaPihak1 ?? []).join(", ")}>
                                    {(baris.saksiNamaPihak1 ?? []).join(", ") || "nama belum tercatat"}
                                  </span>
                                </div>
                              ) : null}
                              {(baris.saksiPihak2 ?? 0) > 0 ? (
                                <div className="max-w-[24rem] truncate">
                                  <span className="font-medium text-foreground/75">
                                    Saksi T ({baris.saksiPihak2}):
                                  </span>{" "}
                                  <span title={(baris.saksiNamaPihak2 ?? []).join(", ")}>
                                    {(baris.saksiNamaPihak2 ?? []).join(", ") || "nama belum tercatat"}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                          <div className="hanya-ringkas mt-1 flex flex-wrap items-center gap-1">
                            {!baris.adaBas ? (
                              <span
                                className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                                title="Berita acara sidang belum diunggah ke SIPP."
                              >
                                belum ada BAS
                              </span>
                            ) : null}
                            {/* Penanda saksi TIDAK di sini: ia kini berdiri
                                sendiri di atas, dengan namanya, dan tampil di
                                kedua mode. Mengulangnya di baris ini akan
                                membuat Ringkas menyebut saksi dua kali. */}
                            {TAMPILKAN_PUTUSAN_ECOURT && baris.putusanEcourt?.perluTindakan ? (
                              <span
                                className="rounded bg-rose-100 px-1.5 py-0.5 text-xs font-medium text-rose-900 dark:bg-rose-950 dark:text-rose-200"
                                title={
                                  baris.putusanEcourt.keterangan ||
                                  "Sudah putus, tetapi putusannya belum beres di e-Court."
                                }
                              >
                                {baris.putusanEcourt.sebutan || "putusan e-Court"}
                              </span>
                            ) : null}
                            {baris.panggilan &&
                            baris.panggilan.wajibDipanggil.length === 0 ? (
                              <span
                                className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                                title="Semua pihak hadir pada sidang sebelumnya - tidak ada yang wajib dipanggil."
                              >
                                tidak perlu dipanggil
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
                          {baris.ditunda ? (
                            <div className="mt-1 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-1 text-sm">
                              <span className="font-medium text-amber-700 dark:text-amber-300">
                                Ditunda
                              </span>
                              {baris.tanggalSidangBerikut ? (
                                <span className="text-amber-700 dark:text-amber-300">
                                  {" "}sampai {baris.tanggalSidangBerikut}
                                </span>
                              ) : null}
                              {baris.alasanDitunda ? (
                                <div className="text-muted-foreground">{baris.alasanDitunda}</div>
                              ) : null}
                            </div>
                          ) : null}
                        </td>

                        <td className="px-3 py-2 align-top text-sm">
                          {baris.agenda || "—"}
                          {baris.urutanSidang > 0 ? (
                            <div className="text-muted-foreground">
                              sidang ke-{baris.urutanSidang}
                            </div>
                          ) : null}

                          {/* Keadaan putusan ikut di sini pada mode RINGKAS.
                              Kolom Putusan disembunyikan di mode itu, sehingga
                              perkara yang sudah putus tidak dapat dibedakan
                              dari yang belum - padahal itulah pertanyaan
                              pertama yang diajukan orang tentang satu perkara. */}
                          <div className="hanya-ringkas mt-1">
                            {baris.sudahPutus ? (
                              <Badge variant="success">{baris.statusPutusan || "Putus"}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">belum putus</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top kolom-lengkap">
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm font-semibold">
                            {baris.majelisKode || "—"}
                          </span>
                          {baris.majelisNama ? (
                            <div
                              className="mt-0.5 max-w-[14rem] truncate text-sm text-muted-foreground"
                              title={baris.majelisNama}
                            >
                              {baris.majelisNama}
                            </div>
                          ) : null}
                        </td>

                        {/* Panitera dan juru sita satu kolom - keduanya
                            petugas sidang, dan jarang dibaca terpisah. */}
                        <td className="px-3 py-2 align-top text-sm kolom-lengkap">
                          <div>
                            <span className="text-muted-foreground">PP: </span>
                            {baris.paniteraNama || "—"}
                          </div>
                          <div>
                            <span className="text-muted-foreground">JS: </span>
                            {baris.jurusitaNama || "—"}
                          </div>
                        </td>

                        <td className="px-3 py-2 align-top text-sm">{baris.ruangan || "—"}</td>

                        <td className="px-3 py-2 align-top text-sm kolom-lengkap">
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
                              <Badge variant={warnaStatusPutusan(baris.statusPutusan)}>
                                {baris.statusPutusan || "Putus"}
                              </Badge>

                              {/* Verstek: putusan tanpa hadirnya tergugat.
                                  Menentukan tenggang verzet, dan karena itu
                                  perlu terbaca tanpa membuka rincian. */}
                              {baris.verstekPutusan ? (
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
                              {!baris.tanggalMinutasi ? (
                                <Badge
                                  variant={baris.adaBerkasPutusan ? "danger" : "warning"}
                                  title={
                                    baris.adaBerkasPutusan
                                      ? "Naskah putusan sudah diunggah ke SIPP tetapi minutasi belum bertanggal."
                                      : "Naskah putusan belum diunggah ke SIPP."
                                  }
                                >
                                  belum minutasi
                                </Badge>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">belum putus</span>
                          )}
                        </td>

                        {/* ==============================================
                            TOMBOL RINCIAN DI UJUNG KANAN
                            ==============================================

                            SATU-SATUNYA yang membuka rincian. Barisnya sendiri
                            tidak lagi dapat ditekan - lihat keterangan di atas
                            <tr>. */}
                        <td className="px-2 py-2 align-top text-right">
                          <button
                            type="button"
                            onClick={() => void buka(baris)}
                            aria-expanded={dibuka === kunci}
                            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          >
                            {dibuka === kunci ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                            Rincian
                          </button>
                        </td>
                      </tr>

                      {/* Baris rincian diberi latar lebih gelap dan garis kiri:
                          pada tabel panjang, tanpa penanda itu tidak jelas
                          rincian ini milik baris yang mana. */}
                      {dibuka === kunci ? (
                        <tr className="border-t border-border bg-muted/40">
                          <td className="border-l-4 border-l-primary px-4 py-4" colSpan={10}>
                            {memuatRincian ? (
                              <p className="text-sm text-muted-foreground">Memuat keterangan sidang…</p>
                            ) : (
                              <RincianSidang
                                rincian={rincian}
                                nomorPerkara={baris.nomorPerkara}
                                perkaraId={baris.perkaraId}
                                sidangId={baris.sidangId}
                              />
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
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
            sidang={sidangTampil}
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
  );
}

/** Bagian rincian yang muncul saat satu sidang dibuka. */
function RincianSidang({
  rincian,
  nomorPerkara,
  perkaraId,
  sidangId,
}: {
  rincian: Rincian | null;
  nomorPerkara: string;
  perkaraId: string;
  /** Sidang yang sedang dibuka - pemisah antara panggilan hari ini dan riwayat. */
  sidangId: string;
}) {
  if (!rincian) {
    return <p className="text-xs text-muted-foreground">Keterangan sidang tidak dapat dibaca.</p>;
  }

  const sipp = rincian.sipp;
  const identitas = rincian.identitas;
  // Disalin ke konstanta supaya penyempitan tipenya bertahan di dalam map -
  // TypeScript melepas penyempitan begitu masuk fungsi lain.
  const kesiapan = rincian.kesiapan;

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
        {sipp ? (
          <span className="text-xs text-muted-foreground">{sipp.majelis.length} hakim</span>
        ) : null}
      </div>

      {identitas ? (
        <div className="flex flex-wrap gap-1">
          {/* Jenis perkara ditebalkan: ia menentukan jalan perkaranya, dan
              sebelumnya sekelabu penanda di sebelahnya. */}
          {identitas.jenisPerkara ? (
            <Badge variant="outline" className="font-bold">
              {identitas.jenisPerkara}
            </Badge>
          ) : null}
          {identitas.adaKumulasi ? (
            <Badge variant="muted">Kumulasi: {identitas.kumulasi.join(", ")}</Badge>
          ) : null}
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
        <section className="rounded-lg border bg-card p-3">
          <h5 className="mb-2 border-b pb-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Majelis dan petugas
          </h5>
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
        </section>

        {/* --- Para pihak --- */}
        <section className="rounded-lg border bg-card p-3">
          <h5 className="mb-2 border-b pb-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Identitas pihak
          </h5>
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
                          <span className="font-medium">{orang.nama}</span>
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
        </section>
      </div>

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
      <section className="rounded-lg border bg-card p-3">
        <h5 className="mb-2 border-b pb-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Relaas panggilan sidang ini
        </h5>
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
                      <Badge variant="muted">{jenisRelaas(baris)}</Badge>
                      <div className="mt-0.5">
                        <span className="text-muted-foreground">dilaksanakan </span>
                        {baris.tanggalRelaas || "—"}
                      </div>
                      {baris.tanggalKirimPos ? (
                        <div>
                          <span className="text-muted-foreground">kirim ke pos </span>
                          {baris.tanggalKirimPos}
                        </div>
                      ) : null}
                    </td>

                    <td className="px-3 py-2">
                      {/* Retur didahulukan: surat yang kembali menuntut
                          tindakan, sedangkan "tidak bertemu" belum tentu. */}
                      {baris.retur ? (
                        <span className="rounded bg-red-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                          retur
                        </span>
                      ) : baris.bertemu ? (
                        <Badge variant="success">Bertemu langsung</Badge>
                      ) : (
                        <Badge variant="warning">Tidak bertemu</Badge>
                      )}
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
      </section>

      {/* --- Riwayat relaas sidang-sidang sebelumnya --- */}
      {relaasRiwayat.length > 0 ? (
        <section className="rounded-lg border bg-card p-3">
          <h5 className="mb-2 border-b pb-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Riwayat panggilan sebelumnya ({relaasRiwayat.length})
          </h5>
          {/* Bentuknya sengaja lebih ringkas daripada tabel di atas: yang
              dicari di sini polanya - sudah berapa kali dipanggil, dengan cara
              apa, dan apa hasilnya - bukan rincian tiap barisnya. */}
          <ul className="space-y-1.5 text-sm">
            {relaasRiwayat.map((baris) => (
              <li
                key={baris.id}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-border/50 pb-1.5 last:border-0 last:pb-0"
              >
                <span className="font-medium">{baris.namaPihak || "—"}</span>
                {baris.tanggalSidang ? (
                  <span className="text-xs text-muted-foreground">
                    untuk sidang {baris.tanggalSidang}
                  </span>
                ) : null}
                <Badge variant="muted">{jenisRelaas(baris)}</Badge>
                <span className="text-xs text-muted-foreground">
                  {baris.tanggalRelaas || "belum dilaksanakan"}
                </span>
                {baris.retur ? (
                  <span className="rounded bg-red-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                    retur
                  </span>
                ) : baris.bertemu ? (
                  <Badge variant="success">bertemu</Badge>
                ) : baris.tanggalRelaas ? (
                  <Badge variant="warning">tidak bertemu</Badge>
                ) : null}
                {baris.noResiPos ? (
                  <span className="font-mono text-[11px] text-muted-foreground">
                    resi {baris.noResiPos}
                  </span>
                ) : null}
                {baris.ketHasilRelaas ? (
                  <span className="w-full text-xs text-muted-foreground">
                    {baris.ketHasilRelaas}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* --- Putusan dan tindak lanjutnya --- */}
      {sipp?.putusan?.sudahPutus ? (
        <section className="rounded-lg border bg-card p-3">
          <h5 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
            Putusan dan tindak lanjutnya
          </h5>

          <div className="mb-2 flex flex-wrap gap-1">
            <Badge variant="success">Putus {sipp.putusan.tanggalPutusan}</Badge>
            {sipp.putusan.statusPutusan ? (
              <Badge variant="default">{sipp.putusan.statusPutusan}</Badge>
            ) : null}
            {sipp.putusan.verstek ? <Badge variant="warning">verstek</Badge> : null}
            {sipp.putusan.tanggalCabut ? (
              <Badge variant="muted">dicabut {sipp.putusan.tanggalCabut}</Badge>
            ) : null}
            {sipp.putusan.tanggalGugur ? (
              <Badge variant="muted">gugur {sipp.putusan.tanggalGugur}</Badge>
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
            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <dt className="text-xs text-muted-foreground">Minutasi</dt>
              <dd className="font-medium">
                {sipp.putusan.tanggalMinutasi || (
                  <span
                    className={cn(
                      sipp.putusan.adaBerkasPutusan
                        ? "text-rose-700 dark:text-rose-300"
                        : "text-amber-700 dark:text-amber-300"
                    )}
                    title={
                      sipp.putusan.adaBerkasPutusan
                        ? "Naskah putusan sudah diunggah ke SIPP tetapi minutasi belum bertanggal."
                        : "Naskah putusan belum diunggah ke SIPP."
                    }
                  >
                    belum diminutasi
                  </span>
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
                      .map((upaya) => `${upaya.jenis}${upaya.tanggal ? ` (${upaya.tanggal})` : ""}`)
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
                        <span className="text-sm font-normal text-muted-foreground"> {orang.tanggal}</span>
                      ) : null}
                      {/* Pencatat pertama BUKAN konseptor - dua peran yang
                          kerap sama orangnya, tetapi tidak boleh diandaikan
                          sama pada naskah yang ditandatangani. */}
                      {orang.dariAudit ? (
                        <span
                          className="ml-1 text-sm font-normal text-muted-foreground"
                          title="Diambil dari jejak audit: inilah yang PERTAMA mencatat putusan, belum tentu yang menyusunnya."
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
        </section>
      ) : null}

      {/* --- Kesiapan dan panggilan --- */}
      {kesiapan ? (
        <section className="rounded-lg border bg-card p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h5 className="text-sm font-semibold uppercase text-muted-foreground">
              Kesiapan sidang dan panggilan para pihak
            </h5>
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
                        ) : null}
                      </td>

                      {/* Sudah dikirim atau belum SELALU dicantumkan, termasuk
                          tanggalnya - bukan hanya saat bermasalah. */}
                      <td className="px-3 py-2">
                        {pihak.sudahDikirim ? (
                          <>
                            <Badge variant="success">terkirim</Badge>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {pihak.tanggalPanggilan}
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
                                {pihak.tanggalPelaksanaanRelaas}
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
                        {pihak.kepatutan.patut === true ? (
                          <Badge variant="success">
                            patut · {pihak.kepatutan.selisih} hari
                          </Badge>
                        ) : pihak.kepatutan.patut === false ? (
                          <Badge variant="danger">
                            {pihak.kepatutan.alasan === "dikirim_setelah_hari_sidang"
                              ? "dikirim setelah sidang"
                              : "tidak patut · " + pihak.kepatutan.selisih + " hari"}
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

          <p className="mt-2 text-xs text-muted-foreground">
            Tenggang dihitung dari tanggal panggilan dikirim sampai hari sidang. Untuk surat
            tercatat, yang dihitung adalah tanggal kirim ke pos — dan penerimaannya harus terbukti
            terpisah. Angka ambang dapat diubah di menu Integrasi e-Court. Penilaian ini alat bantu,
            bukan penetapan sah tidaknya panggilan.
          </p>
        </section>
      ) : null}

      {/* --- Seluruh jadwal sidang perkara ini --- */}
      <section className="rounded-lg border bg-card p-3">
        <h5 className="mb-2 border-b pb-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Seluruh jadwal sidang perkara ini
        </h5>
        {!sipp || sipp.jadwalPerkara.length === 0 ? (
          <p className="text-xs text-muted-foreground">Belum ada jadwal sidang tercatat.</p>
        ) : (
          <ol className="space-y-1 text-sm">
            {sipp.jadwalPerkara.map((jadwal) => (
              <li
                key={jadwal.sidangId}
                className="flex flex-wrap items-baseline gap-x-2 border-l-2 border-border pl-2"
              >
                <span className="font-medium">{tanggalTerbaca(jadwal.tanggalSidang)}</span>
                {jadwal.jamSidang ? (
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {jadwal.jamSidang}
                  </span>
                ) : null}
                <span className="text-sm">{jadwal.agenda || "tanpa agenda"}</span>
                {jadwal.ruangan ? (
                  <span className="text-xs text-muted-foreground">Ruang {jadwal.ruangan}</span>
                ) : null}
                {jadwal.urutanSidang > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    sidang ke-{jadwal.urutanSidang}
                  </span>
                ) : null}
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
      </section>

      {/* --- Berkas e-Court --- */}
      <section className="rounded-lg border bg-card p-3">
        <h5 className="mb-2 border-b pb-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Berkas e-Court dan verifikasi majelis
        </h5>
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
                  <th className="px-3 py-2 font-medium">Judul Dokumen</th>
                  <th className="px-3 py-2 font-medium">Pengunggah</th>
                  <th className="px-3 py-2 font-medium">Verifikasi</th>
                  <th className="px-3 py-2 font-medium">Unduh</th>
                </tr>
              </thead>
              <tbody>
                {rincian.ecourt.map((dokumen) => (
                  <tr key={dokumen.documentKey} className="border-t border-border">
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
                        {!dokumen.adaPdf && !dokumen.adaWord ? (
                          <span className="text-xs text-muted-foreground">belum tersimpan</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
      <section className="rounded-lg border bg-card p-3">
        <h5 className="mb-2 border-b pb-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Berkas tersimpan di SIPP
        </h5>

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
                    <span className="min-w-0 flex-1 truncate" title={baris.namaPihak}>
                      {baris.namaPihak || "tanpa nama pihak"}
                      {baris.tanggalRelaas ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          {baris.tanggalRelaas}
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
                    <span className="min-w-0 flex-1 truncate">
                      {sidang.tanggalSidang}
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
      </section>

      <p className="text-xs text-muted-foreground">
        Perkara {nomorPerkara}. Berkas e-Court yang belum tersimpan dapat ditarik dari menu Kendali
        Berkas.
      </p>
    </div>
  );
}
