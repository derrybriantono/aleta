"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePortal } from "@/lib/app-state";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import { CalendarDays, ChevronLeft, ChevronRight, Filter, Gauge, ListOrdered, Printer, X } from "lucide-react";

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
  pihak: { penggugat: string[]; tergugat: string[] };
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
    saksi: { ada: boolean; jumlahSaksi: number; jumlahKeterangan: number };
    relaas: Array<{
      id: string;
      namaPihak: string;
      peran: string;
      tanggalRelaas: string;
      bertemu: boolean;
      retur: boolean;
      noResiPos: string;
      jurusitaNama: string;
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
      const punya = antrian[String(baris.perkaraId)];
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
  {
    kunci: "putusan-ecourt",
    label: "Putusan e-Court",
    nada: "bahaya",
    judul: "Sudah putus, tetapi putusannya belum beres di e-Court.",
    cocok: (x) => Boolean(x.putusanEcourt?.perluTindakan),
  },
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
    kunci: "agenda-putusan",
    label: "Agenda putusan",
    nada: "sejuk",
    judul: "Agendanya pembacaan putusan - berpeluang selesai hari ini.",
    cocok: (x) => /putus/i.test(x.agenda || ""),
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
    cocok: (x, antrian) => Boolean(antrian[String(x.perkaraId)]?.nomor),
  },
  {
    kunci: "antri-online",
    label: "Antrian online",
    nada: "sejuk",
    judul: "Antriannya diambil lewat WhatsApp, bukan di mesin antrian.",
    cocok: (x, antrian) => Boolean(antrian[String(x.perkaraId)]?.online),
  },
  {
    kunci: "belum-antri",
    label: "Belum ambil antrian",
    nada: "awas",
    judul:
      "Terdaftar di mesin antrian, tetapi belum ada pihak yang mengambil nomor. Perkara yang memang tidak memakai antrian tidak ikut terhitung.",
    cocok: (x, antrian) => {
      const punya = antrian[String(x.perkaraId)];
      // Perkara yang TIDAK terdaftar di mesin antrian sama sekali tidak ikut
      // - ia bukan "belum mengambil", ia memang tidak memakai antrian.
      return Boolean(punya) && !punya.nomor;
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
  const nomorAntrian = antrian[String(baris.perkaraId)]?.nomor ?? null;
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
          {/* Online dan offline satu deret; tanda ini menyebut ASAL
              pengambilannya, bukan urutannya. */}
          {antrian.online ? (
            <span
              className="rounded border border-sky-400 px-1 text-[9px] font-semibold uppercase leading-tight text-sky-600 dark:text-sky-400"
              title="Antrian diambil dalam jaringan lewat WhatsApp"
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

      {antrian.waktuAmbil ? (
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

  const alihkanKeadaan = (kunci: string) =>
    setKeadaanTerpilih((sekarang) =>
      sekarang.includes(kunci)
        ? sekarang.filter((x) => x !== kunci)
        : [...sekarang, kunci]
    );

  const [sedangCetak, setSedangCetak] = useState(false);

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

  useEffect(() => {
    try {
      setModeRingkas(window.localStorage.getItem("aleta.jadwal-sidang.ringkas") === "1");
    } catch {
      // Peramban yang memblokir penyimpanan situs tetap dapat memakai layar
      // ini - hanya pilihannya yang tidak diingat.
    }
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

  const adaSaringan = Boolean(saringJenis || saringTahap || saringMajelis || saringRuang);
  const sidangTersaring = adaSaringan ? sidangTerpilih.filter(cocokSaringan) : sidangTerpilih;

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

  const adaPenyaringTabel =
    keadaanTerpilih.length > 0 || cariCepat.trim() !== "" || cariLanjut.jumlahAktif > 0;

  const bersihkanTabel = () => {
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
          KEPALA DIRAPATKAN
          ==================================================================

          Judul halaman di atas kartu ini sudah menyebutkan ALETA e-Court
          beserta keterangannya. Kepala kartu yang setinggi bawaan mengulang
          ruang itu sekali lagi, dan tabel jadwal - yang justru dicari orang -
          terdorong jauh ke bawah lipatan layar.

          Keterangannya TIDAK dihapus, hanya dikecilkan dan dirapatkan: yang
          baru pertama membuka layar ini tetap perlu tahu apa isinya. */}
      <CardHeader className="gap-1 p-4 pb-2 sm:p-5 sm:pb-2">
        <CardTitle className="text-base sm:text-lg">Jadwal perkara yang bersidang</CardTitle>
        <CardDescription className="text-sm">
          Majelis, panitera, jurusita, para pihak, saksi, relaas panggilan, dan seluruh berkas SIPP
          maupun e-Court - dalam satu layar, per sidang.
        </CardDescription>
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
            {/* Satu kesatuan navigasi: panah dan pemilih tanggal menempel,
                supaya terbaca sebagai satu alat, bukan tiga tombol lepas. */}
            {/* Satu alat bersambung, bukan lima tombol sederajat: panah,
                tanggal, panah, "Hari ini", kalender - kelimanya memilih hari.
                Tombol yang berdiri sendiri-sendiri menuntut mata membaca
                semuanya sebelum menemukan satu. */}
            <div className="flex items-center overflow-hidden rounded-lg border bg-card shadow-sm">
              <button
                type="button"
                aria-label="Hari sebelumnya"
                onClick={() => pilihHari(geserHari(dari, -1))}
                className="px-3 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <Input
                type="date"
                value={dari}
                onChange={(peristiwa) => pilihHari(peristiwa.target.value)}
                className="h-9 w-[9.5rem] rounded-none border-x border-y-0 text-center focus-visible:ring-0"
                aria-label="Tanggal sidang"
              />

              <button
                type="button"
                aria-label="Hari berikutnya"
                onClick={() => pilihHari(geserHari(dari, 1))}
                className="px-3 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
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

          {/* Baris kedua kendali menyatu dengan baris pertama - garis pemisah
              dan jaraknya dulu memakan hampir satu baris penuh sendiri. */}
          <div className="flex flex-wrap items-end gap-2 border-t pt-2">
            <label className="flex flex-col gap-0.5 text-[11px] font-medium">
              Cari
              <Input
                placeholder="Nomor perkara, jenis, atau agenda"
                value={cari}
                onChange={(peristiwa) => setCari(peristiwa.target.value)}
                className="h-9 w-56"
              />
            </label>

            {/* Rentang tetap ada, tetapi tidak menonjol: melihat sepekan
                sekaligus jarang dikerjakan, dan menaruhnya sejajar pemilih hari
                membuat yang sehari-hari jadi berbelit. */}
            <label className="flex flex-col gap-0.5 text-[11px] font-medium">
              Sampai tanggal
              <Input
                type="date"
                value={sampai}
                min={dari}
                onChange={(peristiwa) => setSampai(peristiwa.target.value)}
                className="h-9 w-36"
              />
            </label>

            <Button size="sm" disabled={memuat} onClick={() => void muat()}>
              {memuat ? "Memuat…" : "Tampilkan"}
            </Button>

            <div className="ml-auto flex flex-wrap items-center gap-2">
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
                title="Mendaftarkan jadwal yang tampil ke aplikasi antrian ruang tunggu. Diperlihatkan dulu sebelum ditulis."
              >
                <ListOrdered className="mr-1.5 h-4 w-4" />
                {sinkronSibuk ? "Memeriksa…" : "Antrian"}
              </Button>
            </div>
          </div>
        </div>

        {/* --- Ringkasan per alur perkara --- */}
        {sidang.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {ringkasAlur(sidang).map((kelompok) => {
              const terpilih = alurTerpilih === kelompok.kunci;
              return (
                <button
                  key={kelompok.kunci}
                  type="button"
                  onClick={() => {
                    setAlurTerpilih(terpilih ? "" : kelompok.kunci);
                    bersihkanSaringan();
                  }}
                  aria-pressed={terpilih}
                  className={cn(
                    // Angka dan namanya SEBARIS, bukan bertumpuk. Lima kartu
                    // setinggi dua baris memakan tinggi yang sama dengan enam
                    // baris tabel - dan yang dicari orang tabelnya.
                    "inline-flex items-baseline gap-1.5 rounded-lg border px-2.5 py-1 text-left transition",
                    terpilih
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border bg-card hover:border-primary/40 hover:bg-muted/50"
                  )}
                >
                  <span className="text-base font-semibold tabular-nums">{kelompok.jumlah}</span>
                  <span className="text-sm text-muted-foreground">{kelompok.label}</span>
                </button>
              );
            })}

            <div className="inline-flex items-baseline gap-1.5 rounded-lg border border-dashed px-2.5 py-1">
              <span className="text-base font-semibold tabular-nums">{sidang.length}</span>
              <span className="text-sm text-muted-foreground">Seluruh sidang</span>
            </div>
          </div>
        ) : null}

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

        {sidang.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {KEADAAN_SIDANG.map((keadaan) => (
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
        {sidang.length > 0 ? (
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

            {adaPenyaringTabel ? (
              <>
                <span className="text-sm text-muted-foreground">
                  {sidangTampil.length} dari {sidang.length} sidang
                </span>
                <Button size="sm" variant="ghost" onClick={bersihkanTabel}>
                  <X className="mr-1 h-3.5 w-3.5" />
                  Bersihkan
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
            {adaSaringan ? (
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
        <div className="mb-2 flex flex-wrap items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">Tampilan</span>
          <div className="inline-flex overflow-hidden rounded-md border">
            <button
              type="button"
              onClick={() => setModeRingkas(true)}
              className={cn(
                "px-2 py-1",
                modeRingkas ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              Ringkas
            </button>
            <button
              type="button"
              onClick={() => setModeRingkas(false)}
              className={cn(
                "border-l px-2 py-1",
                modeRingkas ? "hover:bg-muted" : "bg-primary text-primary-foreground"
              )}
            >
              Lengkap
            </button>
          </div>
        </div>

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

        <div className="max-h-[70vh] overflow-auto rounded-xl border">
          <table
            className={cn(
              "w-full text-sm",
              modeRingkas ? "min-w-[640px] [&_.kolom-lengkap]:hidden" : "min-w-[980px]"
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
              </tr>
            </thead>
            <tbody>
              {memuat ? (
                <tr>
                  <td className="px-3 py-6 text-center text-muted-foreground" colSpan={11}>
                    Memuat jadwal…
                  </td>
                </tr>
              ) : sidangTampil.length === 0 && sidang.length > 0 ? (
                <tr>
                  <td className="px-3 py-10 text-center" colSpan={9}>
                    <p className="text-sm font-medium">
                      Tidak ada sidang yang cocok dengan saringan ini.
                    </p>
                    {/* Bedanya penting: hari yang memang kosong menyuruh
                        pindah tanggal, sedangkan hasil yang tersaring habis
                        menyuruh melonggarkan saringannya. Menyamakan keduanya
                        membuat orang mencari di tanggal lain padahal
                        perkaranya ada di depan mata. */}
                    <p className="mt-1 text-sm text-muted-foreground">
                      {sidang.length} sidang hari ini tidak satu pun cocok. Longgarkan
                      saringannya, atau tekan Bersihkan.
                    </p>
                    <Button size="sm" variant="outline" className="mt-3" onClick={bersihkanTabel}>
                      Bersihkan saringan
                    </Button>
                  </td>
                </tr>
              ) : sidang.length === 0 ? (
                <tr>
                  <td className="px-3 py-10 text-center" colSpan={11}>
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
                      <tr
                        className={cn(
                          "cursor-pointer border-t border-border transition",
                          dibuka === kunci
                            ? "bg-primary/10"
                            : urutan % 2 === 1
                              ? "bg-muted/20 hover:bg-muted/50"
                              : "hover:bg-muted/50"
                        )}
                        onClick={() => void buka(baris)}
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
                            antrian={antrian.peta[String(baris.perkaraId)]}
                            tanggalTampil={dari}
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span className="font-semibold">{baris.nomorPerkara}</span>
                          {/* Penanda panggilan tepat di samping nomor perkara:
                              itulah yang dicari mata saat menelusuri jadwal. */}
                          <span className="ml-2 inline-flex gap-1 align-middle">
                            <PenandaPanggilan panggilan={baris.panggilan} />
                          </span>
                          {/* Para pihak diringkas di bawah nomornya: inilah
                              yang dipakai memanggil perkara di ruang sidang. */}
                          {baris.pihak.penggugat.length > 0 ? (
                            <div
                              className="mt-0.5 max-w-[22rem] truncate text-sm text-muted-foreground"
                              title={[...baris.pihak.penggugat, ...baris.pihak.tergugat].join(" · ")}
                            >
                              {baris.pihak.penggugat[0]}
                              {baris.pihak.tergugat.length > 0
                                ? ` lawan ${baris.pihak.tergugat[0]}`
                                : ""}
                            </div>
                          ) : null}

                          {/* Jenis perkara kini di bawah nomornya - keduanya
                              menjawab pertanyaan yang sama, "perkara apa ini",
                              dan memisahkannya jadi dua kolom hanya memaksa
                              mata bolak-balik. */}
                          <div className="mt-0.5 text-sm text-muted-foreground">
                            {baris.jenisPerkara || "—"}
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
                            <>
                              <Badge variant="success">
                                {baris.statusPutusan || "Putus"}
                              </Badge>
                              <div className="mt-0.5 text-muted-foreground">
                                {baris.tanggalPutusan}
                              </div>
                              {/* Yang BELUM dikerjakan ditandai, bukan yang
                                  sudah - itulah yang perlu ditindaklanjuti. */}
                              {!baris.tanggalMinutasi ? (
                                <Badge variant="warning" className="mt-0.5">
                                  belum minutasi
                                </Badge>
                              ) : !baris.tanggalBht ? (
                                <Badge variant="muted" className="mt-0.5">
                                  belum BHT
                                </Badge>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-muted-foreground">belum putus</span>
                          )}
                        
                          {/* Putusan yang sudah dijatuhkan belum tentu terbit
                              di e-Court. Penandanya di sini, bukan di kolom
                              lain: inilah kolom yang dibaca orang saat
                              menanyakan salinan putusan. */}
                          {baris.putusanEcourt && baris.putusanEcourt.perluTindakan ? (
                            <div className="mt-1">
                              <PenandaPutusanEcourt putusan={baris.putusanEcourt} />
                            </div>
                          ) : null}
                        </td>
                      </tr>

                      {/* Baris rincian diberi latar lebih gelap dan garis kiri:
                          pada tabel panjang, tanpa penanda itu tidak jelas
                          rincian ini milik baris yang mana. */}
                      {dibuka === kunci ? (
                        <tr className="border-t border-border bg-muted/40">
                          <td className="border-l-4 border-l-primary px-4 py-4" colSpan={11}>
                            {memuatRincian ? (
                              <p className="text-sm text-muted-foreground">Memuat keterangan sidang…</p>
                            ) : (
                              <RincianSidang
                                rincian={rincian}
                                nomorPerkara={baris.nomorPerkara}
                                perkaraId={baris.perkaraId}
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

        {sedangCetak ? (
          <AletaEcourtCetakJadwal
            sidang={sidang}
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
}: {
  rincian: Rincian | null;
  nomorPerkara: string;
  perkaraId: string;
}) {
  if (!rincian) {
    return <p className="text-sm text-muted-foreground">Keterangan sidang tidak dapat dibaca.</p>;
  }

  const sipp = rincian.sipp;
  const identitas = rincian.identitas;
  // Disalin ke konstanta supaya penyempitan tipenya bertahan di dalam map -
  // TypeScript melepas penyempitan begitu masuk fungsi lain.
  const kesiapan = rincian.kesiapan;

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
        <h4 className="text-base font-semibold">{nomorPerkara}</h4>
        {sipp ? (
          <span className="text-sm text-muted-foreground">{sipp.majelis.length} hakim</span>
        ) : null}
      </div>

      {identitas ? (
        <div className="flex flex-wrap gap-1">
          {identitas.jenisPerkara ? <Badge variant="muted">{identitas.jenisPerkara}</Badge> : null}
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
          {sipp?.saksi?.ada ? (
            <Badge variant="success">
              Saksi: {sipp.saksi.jumlahSaksi} orang, {sipp.saksi.jumlahKeterangan} keterangan
            </Badge>
          ) : (
            <Badge variant="muted">Belum ada keterangan saksi</Badge>
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
                    <span className="text-sm text-muted-foreground"> · {anggota.jabatan}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Majelis belum ditetapkan.</p>
          )}

          <p className="mt-2 text-sm">
            <span className="text-sm text-muted-foreground">Panitera sidang: </span>
            {sipp && sipp.panitera.length > 0
              ? sipp.panitera.map((orang) => orang.nama).join(", ")
              : "—"}
          </p>
          <p className="text-sm">
            <span className="text-sm text-muted-foreground">Jurusita: </span>
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
          {rincian.pihak.length === 0 ? (
            <p className="text-sm text-muted-foreground">Pihak belum tercatat.</p>
          ) : (
            <ul className="space-y-0.5 text-sm">
              {rincian.pihak.map((orang, urutan) => (
                <li key={`${orang.nama}-${urutan}`}>
                  <span className="font-medium">{orang.nama}</span>
                  <span className="text-sm text-muted-foreground">
                    {" · "}
                    {orang.jenis === "kuasa"
                      ? "kuasa hukum"
                      : orang.pihakKe === 1
                        ? "penggugat/pemohon"
                        : orang.pihakKe === 2
                          ? "tergugat/termohon"
                          : "pihak"}
                    {orang.adaNomor ? ` · ${orang.nomorSamar}` : " · tanpa nomor"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

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
          <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <dt className="text-sm text-muted-foreground">Minutasi</dt>
              <dd className="font-medium">
                {sipp.putusan.tanggalMinutasi || (
                  <span className="text-amber-700 dark:text-amber-300">belum diminutasi</span>
                )}
              </dd>
            </div>

            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <dt className="text-sm text-muted-foreground">Berkekuatan hukum tetap</dt>
              <dd className="font-medium">
                {sipp.putusan.tanggalBht || (
                  <span className="text-amber-700 dark:text-amber-300">belum BHT</span>
                )}
              </dd>
            </div>

            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <dt className="text-sm text-muted-foreground">Akta cerai</dt>
              <dd className="font-medium">
                {sipp.putusan.aktaCerai?.nomor ? (
                  <>
                    {sipp.putusan.aktaCerai.nomor}
                    {sipp.putusan.aktaCerai.tanggal ? (
                      <div className="text-sm font-normal text-muted-foreground">
                        terbit {sipp.putusan.aktaCerai.tanggal}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <span className="text-muted-foreground">belum terbit</span>
                )}
              </dd>
            </div>

            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <dt className="text-sm text-muted-foreground">Upaya hukum</dt>
              <dd className="font-medium">
                {sipp.putusan.upayaHukum.length > 0 ? (
                  sipp.putusan.upayaHukum.map((upaya) => (
                    <div key={upaya.jenis}>
                      {upaya.jenis}
                      <span className="text-sm font-normal text-muted-foreground">
                        {" "}
                        {upaya.tanggal}
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-muted-foreground">tidak ada</span>
                )}
              </dd>
            </div>
          </dl>

          {/* Penyerahan akta cerai dicatat per pihak: sering satu pihak sudah
              mengambil dan satunya belum, dan itu yang ditanyakan di meja
              pelayanan. */}
          {sipp.putusan.aktaCerai?.nomor ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Penyerahan akta — pihak I:{" "}
              {sipp.putusan.aktaCerai.diserahkanPihak1 || "belum diambil"} · pihak II:{" "}
              {sipp.putusan.aktaCerai.diserahkanPihak2 || "belum diambil"}
              {sipp.putusan.aktaCerai.nomorSeri
                ? ` · seri ${sipp.putusan.aktaCerai.nomorSeri}`
                : ""}
            </p>
          ) : null}

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
                  <span className="text-sm text-muted-foreground">({hambat.sumber})</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 text-sm text-muted-foreground">
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
                          <div className="text-sm text-muted-foreground">{pihak.peran}</div>
                        ) : null}
                      </td>

                      <td className="px-3 py-2">
                        {!kesiapan.panggilan.lewatEcourt ? (
                          <span className="text-sm text-muted-foreground">—</span>
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
                            <div className="mt-0.5 text-sm text-muted-foreground">
                              {pihak.tanggalPanggilan}
                            </div>
                            {pihak.noResiPos ? (
                              <div className="text-sm text-muted-foreground">
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
                            <div className="mt-0.5 text-sm text-muted-foreground">
                              hadir pada sidang sebelumnya
                            </div>
                          </>
                        ) : (
                          <Badge variant="danger">belum dikirim</Badge>
                        )}
                      </td>

                      <td className="px-3 py-2">
                        {!pihak.kepatutan.perluDiterima ? (
                          <span className="text-sm text-muted-foreground">tidak disyaratkan</span>
                        ) : pihak.diterima === true ? (
                          <>
                            <Badge variant="success">diterima</Badge>
                            {pihak.tanggalPelaksanaanRelaas ? (
                              <div className="mt-0.5 text-sm text-muted-foreground">
                                {pihak.tanggalPelaksanaanRelaas}
                              </div>
                            ) : null}
                            {pihak.buktiPenerimaan ? (
                              <div className="text-sm text-muted-foreground">
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
          ) : (
            <p className="text-sm text-muted-foreground">
              Data pihak belum terbaca. Untuk perkara e-Court, tarik perkara ini dari menu Kendali
              Berkas lebih dulu; untuk perkara biasa, pihaknya dibaca dari data relaas SIPP.
            </p>
          )}

          <p className="mt-2 text-sm text-muted-foreground">
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
          <p className="text-sm text-muted-foreground">Belum ada jadwal sidang tercatat.</p>
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
                  <span className="text-sm text-muted-foreground">Ruang {jadwal.ruangan}</span>
                ) : null}
                {jadwal.urutanSidang > 0 ? (
                  <span className="text-sm text-muted-foreground">
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
                  <span className="text-sm text-muted-foreground">BAS belum diunggah</span>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* --- Relaas panggilan --- */}
      <section className="rounded-lg border bg-card p-3">
        <h5 className="mb-2 border-b pb-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Keadaan relaas panggilan
        </h5>
        {!sipp || sipp.relaas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada relaas tercatat untuk sidang ini.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Pihak</th>
                  <th className="px-3 py-2 font-medium">Tanggal</th>
                  <th className="px-3 py-2 font-medium">Hasil</th>
                  <th className="px-3 py-2 font-medium">Jurusita</th>
                  <th className="px-3 py-2 font-medium">Berkas</th>
                </tr>
              </thead>
              <tbody>
                {sipp.relaas.map((baris) => (
                  <tr key={baris.id} className="border-t border-border">
                    <td className="px-3 py-2">{baris.namaPihak || "—"}</td>
                    <td className="px-3 py-2 text-sm">{baris.tanggalRelaas || "—"}</td>
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
                        <div className="text-sm text-muted-foreground">Resi {baris.noResiPos}</div>
                      ) : null}
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
                          <span className="text-sm text-muted-foreground">—</span>
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
          <p className="text-sm text-muted-foreground">
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
                        <div className="text-sm text-muted-foreground">{dokumen.jenisDokumen}</div>
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
                          <span className="text-sm text-muted-foreground">belum tersimpan</span>
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
          <p className="text-sm text-muted-foreground">
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
              <p className="text-sm text-muted-foreground">Belum diunggah ke SIPP.</p>
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
              <p className="text-sm text-muted-foreground">Belum ada relaas tercatat.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {sipp.relaas.map((baris) => (
                  <li key={baris.id} className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 truncate" title={baris.namaPihak}>
                      {baris.namaPihak || "tanpa nama pihak"}
                      {baris.tanggalRelaas ? (
                        <span className="ml-1 text-sm text-muted-foreground">
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
                      <span className="text-sm text-muted-foreground">relaas belum diunggah</span>
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
              <p className="text-sm text-muted-foreground">Belum ada sidang tercatat.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {sipp.jadwalPerkara.map((sidang) => (
                  <li key={sidang.sidangId} className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">
                      {sidang.tanggalSidang}
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
                        namaCadangan={`bas-${nomorPerkara}-${sidang.tanggalSidang}.pdf`}
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">BAS belum diunggah</span>
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
                      <span className="text-sm text-muted-foreground">
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

      <p className="text-sm text-muted-foreground">
        Perkara {nomorPerkara}. Berkas e-Court yang belum tersimpan dapat ditarik dari menu Kendali
        Berkas.
      </p>
    </div>
  );
}
