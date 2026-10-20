import type { AletaDatabase } from "@/server/db/client";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { rakitBerkasPerkara, type BerkasPerkara } from "@/server/modules/aleta-ecourt/berkas-perkara";
import { untukPortal } from "@/server/modules/aleta-ecourt/tipe-keluaran";
import { pihakKumpulan, type PihakSaksi } from "@/lib/keterangan-abt";
import {
  DAFTAR_RAGAM_PORTAL,
  ragamkanJawabanContoh,
  susunBankRagam,
  type BankRagam,
  type VarianRagam,
} from "@/lib/tipe-keluaran/ragam-jawaban";

/**
 * ALAT BANTU TULIS BAS - mengisi tanya-jawab ABT dari berkas perkara.
 *
 * ============================================================================
 * YANG SUDAH ADA DI SISTEM TIDAK DITANYAKAN LAGI
 * ============================================================================
 *
 * ABT menyimpan kumpulan pertanyaan pemeriksaan yang sudah terpakai bertahun -
 * A1a untuk saksi Penggugat cerai gugat, A2a untuk saksi Tergugat, dan
 * seterusnya. Pertanyaannya memuat penanda seperti #0046# yang menunjuk nomor
 * variabel: 0046 adalah Pemohon/Penggugat, 0047 Termohon/Tergugat.
 *
 * Selama ini penanda itu diisi panitera. Padahal namanya sudah tersimpan di
 * SIPP sejak perkara didaftarkan. Modul ini mengisinya dari berkas perkara,
 * sehingga yang tersisa untuk dijawab hanyalah yang memang baru: apa yang
 * dikatakan saksi hari ini.
 *
 * ============================================================================
 * YANG TIDAK PASTI TIDAK DIISI
 * ============================================================================
 *
 * Penanda yang tidak dapat dipastikan dari berkas DIBIARKAN, dan disebutkan
 * dalam daftar tersendiri. Mengisinya dengan tebakan yang mendekati jauh lebih
 * berbahaya daripada membiarkannya kosong: BAS adalah dokumen resmi yang
 * ditandatangani, dan nama yang keliru di dalamnya tidak dapat ditarik kembali
 * setelah ditandatangani.
 */

export type PenandaTerisi = {
  noVar: string;
  nama: string;
  nilai: string;
  /** Dari mana nilainya - supaya panitera dapat memeriksanya tanpa membuka SIPP. */
  asal: string;
};

export type PenandaKosong = {
  noVar: string;
  nama: string;
  /** Mengapa tidak dapat diisi, dalam bahasa yang terbaca petugas. */
  sebab: string;
};

export type BarisTanyaJawab = {
  urutan: number;
  pertanyaan: string;
  /**
   * Jawaban contoh UNTUK SAKSI INI - bantuan mengetik, bukan jawaban saksi.
   * Bentuknya dipilih per saksi dari ragam yang berbukti (lihat
   * ragamkanContoh); maknanya sama dengan contoh ABT.
   */
  jawabanBawaan: string;
  /** Contoh ABT apa adanya (penanda sudah diisi), sebelum diragamkan. */
  jawabanAbt?: string;
  /** Bentuk ke berapa dari berapa; `habis` = bentuknya sama dengan saksi sebelumnya. */
  varian?: VarianRagam;
  /** Jawaban yang benar-benar sudah disimpan panitera. Kosong bila belum. */
  jawaban: string;
  /** Penanda yang masih tersisa pada baris ini setelah pengisian. */
  penandaTersisa: string[];
};

export type LembarTanyaJawab = {
  ok: boolean;
  kode: string;
  namaKumpulan: string;
  nomorPerkara: string;
  perkaraId: string;
  jumlahPertanyaan: number;
  /** Berapa pertanyaan yang jawabannya sudah tersimpan. */
  jumlahTerjawab: number;
  baris: BarisTanyaJawab[];
  terisi: PenandaTerisi[];
  kosong: PenandaKosong[];
  halangan: string[];
  /** Saksi yang dilayani lembar ini - pihaknya dibaca dari kumpulan pertanyaan. */
  saksiKe?: number;
  pihakSaksi?: PihakSaksi;
  /**
   * Asal bank ragam contoh: 'portal' (pengaturan tipe keluaran) atau
   * 'tertanam' (cermin bawaan), versinya, dan kabar bila pengaturan tidak
   * terbaca - disebut, tidak ditelan.
   */
  ragam?: { asal: "portal" | "tertanam"; versi: string; dilepas: number; kabar: string[] };
};

const POLA_PENANDA = /#(\d{3,5})#/g;

type Pihak = { role?: string; name?: string };

/**
 * Mencari nama pihak menurut perannya.
 *
 * Dicocokkan longgar karena SIPP menulisnya sebagai "Penggugat/Pemohon" -
 * satu kolom untuk dua sebutan, dan mana yang berlaku bergantung jenis
 * perkaranya. Pencocokan ketat akan gagal pada separuh perkara.
 */
function cariPihak(paraPihak: unknown, kata: string[]): string {
  const daftar = Array.isArray(paraPihak) ? (paraPihak as Pihak[]) : [];
  const cocok = daftar.find((pihak) => {
    const peran = String(pihak?.role ?? "").toLowerCase();
    return kata.some((k) => peran.includes(k));
  });
  return String(cocok?.name ?? "").trim();
}

/** Satker pemilik blangko. Dari lingkungan supaya satker lain tinggal mengubahnya. */
const NAMA_SATKER = process.env.ALETA_NAMA_SATKER || "Pengadilan Agama Donggala";

/**
 * Zona waktu yang ditulis pada naskah - "pukul 09.00 WITA".
 *
 * Donggala berada di WITA. Dari lingkungan karena satker di zona lain memakai
 * WIB atau WIT, dan zona yang keliru pada BAS adalah jam sidang yang keliru.
 */
const ZONA_WAKTU = process.env.ALETA_ZONA_WAKTU || "WITA";

const BULAN = [
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

/**
 * Tanggal dalam bentuk yang dipakai naskah pengadilan: "2 September 2026".
 *
 * Dibaca sebagai UTC, bukan waktu setempat. SIPP mengirim tengah malam UTC;
 * menafsirkannya sebagai waktu setempat menggeser tanggalnya satu hari pada
 * mesin di sebelah barat - dan tanggal yang meleset sehari pada BAS adalah
 * tanggal sidang yang salah.
 */
function tanggalIndonesia(nilai: unknown): string {
  const teks = String(nilai ?? "").trim();
  if (!teks) return "";
  const waktu = new Date(teks);
  if (Number.isNaN(waktu.getTime())) return "";
  return `${waktu.getUTCDate()} ${BULAN[waktu.getUTCMonth()]} ${waktu.getUTCFullYear()}`;
}

type Petugas = { role?: string; jabatan?: string; urutan?: number; name?: string };

function namaPetugas(daftar: unknown): string[] {
  return (Array.isArray(daftar) ? (daftar as Petugas[]) : [])
    .map((orang) => String(orang?.name ?? "").trim())
    .filter(Boolean);
}

/**
 * Ketua majelis menurut jabatan yang tercatat SIPP.
 *
 * Dicocokkan longgar pada kata "ketua" karena SIPP menuliskannya "Hakim Ketua"
 * sementara pemasangan lain dapat menuliskannya lain. Bila tidak ada satu pun
 * yang berjabatan ketua - misalnya hakim tunggal yang jabatannya tidak diisi -
 * dikembalikan KOSONG, bukan hakim pertama: menebaknya berarti menetapkan
 * siapa yang memimpin persidangan menurut naskah resmi.
 */
function ketuaMajelis(daftar: unknown): string {
  const orang = (Array.isArray(daftar) ? (daftar as Petugas[]) : []).find((item) =>
    String(item?.jabatan ?? "").toLowerCase().includes("ketua")
  );
  return String(orang?.name ?? "").trim();
}

/**
 * "gugatan" atau "permohonan" - bergantung jenis perkaranya.
 *
 * Cerai Talak terdaftar sebagai Pdt.G tetapi diajukan sebagai PERMOHONAN, jadi
 * kode register saja tidak cukup; jenis perkaranya yang menentukan.
 */
function sebutanSurat(jenisPerkara: string, nomorPerkara: string): string {
  const jenis = jenisPerkara.toLowerCase();
  if (jenis.includes("talak") || jenis.includes("permohonan") || /\/pdt\.p\//i.test(nomorPerkara)) return "permohonan";
  if (jenis.includes("gugat") || /\/pdt\.g\//i.test(nomorPerkara)) return "gugatan";
  return "";
}

/** "putusan" untuk perkara gugatan, "penetapan" untuk permohonan voluntair. */
function sebutanPutusan(nomorPerkara: string): string {
  if (/\/pdt\.p\//i.test(nomorPerkara)) return "penetapan";
  if (/\/pdt\.g\//i.test(nomorPerkara)) return "putusan";
  return "";
}

/**
 * ============================================================================
 * SEBUTAN PIHAK BUKAN NAMA PIHAK
 * ============================================================================
 *
 * #0046# dan #0047# adalah SEBUTAN - "Penggugat", "Pemohon", "Tergugat",
 * "Termohon" - bukan nama orangnya. Namanya dibawa #0098# dan #0102#, yang di
 * ABT sendiri bernama "Nama #0046#" dan "Nama #0047#": mustahil #0046# juga
 * nama, sebab kalau begitu #0098# berarti "Nama nama penggugat".
 *
 * Dokumen rujukan membuktikannya tanpa ragu. Blangko berbunyi
 *
 *     #0098#, NIK #0335#, ... sebagai #0046#;
 *
 * dan hasil jadinya berbunyi
 *
 *     Muhammad Ilham bin Aco Daude, NIK 7203040912000003, ... sebagai Pemohon I;
 *
 * Sebelum ini keduanya diisi nama, sehingga kalimat seperti "Ketua Majelis
 * memeriksa identitas #0046#" tercetak dengan nama lengkap di tempat yang
 * seharusnya berbunyi "Penggugat". #0046# muncul 12.935 kali di pustaka
 * blangko - tersering dari seluruh 749 kode - dan #0047# 5.137 kali.
 */
function sebutanPihak1(jenisPerkara: string, nomorPerkara: string): string {
  const surat = sebutanSurat(jenisPerkara, nomorPerkara);
  if (surat === "permohonan") return "Pemohon";
  if (surat === "gugatan") return "Penggugat";
  return "";
}

function sebutanPihak2(jenisPerkara: string, nomorPerkara: string): string {
  const surat = sebutanSurat(jenisPerkara, nomorPerkara);
  if (surat === "permohonan") return "Termohon";
  if (surat === "gugatan") return "Tergugat";
  return "";
}

/**
 * "Majelis Hakim" atau "Hakim" - juga sebutan, bukan daftar nama.
 *
 * ABT menentukannya dari ADA atau TIDAKNYA hakim berjabatan ketua, bukan dari
 * banyaknya baris: perkara bertiga yang jabatannya belum terisi bukan majelis
 * menurut SIPP, dan menyebutnya majelis berarti naskah menyatakan susunan yang
 * tidak tercatat. Tanpa satu pun hakim, dikembalikan kosong - penanda yang
 * masih terlihat lebih baik daripada sebutan yang ditebak.
 */
function sebutanMajelis(daftar: unknown): string {
  if (namaPetugas(daftar).length === 0) return "";
  return ketuaMajelis(daftar) ? "Majelis Hakim" : "Hakim";
}

/** "Ketua Majelis" atau "Hakim" - sebutan bagi yang memimpin sidang. */
function sebutanKetua(daftar: unknown): string {
  if (namaPetugas(daftar).length === 0) return "";
  return ketuaMajelis(daftar) ? "Ketua Majelis" : "Hakim";
}

/**
 * Jabatan petugas sebagaimana TERCATAT di SIPP.
 *
 * Dipakai untuk #6034# ("Panitera/Panitera Pengganti") dan #6032#
 * ("Jurusita/Jurusita Pengganti"), yang keduanya jabatan - bukan nama. ABT
 * membedakannya dengan membandingkan nama panitera perkara terhadap nama
 * Panitera pengadilan di sys_config; ALETA tidak memegang nilai itu, jadi yang
 * dipakai adalah jabatan yang sudah tercatat pada perkaranya.
 *
 * Bila jabatannya kosong dikembalikan KOSONG, bukan ditebak "Pengganti":
 * menyebut Panitera sebagai Panitera Pengganti pada naskah yang ditandatangani
 * adalah menuliskan jabatan yang keliru, dan itu lebih buruk daripada penanda
 * yang masih terlihat.
 */
function jabatanPetugas(daftar: unknown): string {
  const orang = (Array.isArray(daftar) ? (daftar as Petugas[]) : []).find((item) =>
    String(item?.name ?? "").trim()
  );
  return String(orang?.jabatan ?? "").trim();
}

/**
 * Nilai tiap penanda, diambil dari berkas perkara.
 *
 * SATU sumber kebenaran untuk lembar tanya-jawab maupun naskah blangko. Dua
 * peta terpisah pasti berselisih, dan selisihnya akan muncul sebagai BAS dan
 * putusan yang menyebut nama berbeda untuk perkara yang sama.
 *
 * ============================================================================
 * YANG DIISI HANYA YANG ABT SENDIRI SEBUT BERASAL DARI SIPP
 * ============================================================================
 *
 * Nomor variabelnya tidak ditebak. Tabel abt_variabel sudah menyatakan asal
 * tiap variabel - 0098 adalah perkara_pihak1.nama, 1061 adalah
 * perkara.tanggal_pendaftaran, dan seterusnya - jadi yang dipetakan di sini
 * adalah yang memang dinyatakan berasal dari SIPP, ditambah sebutan yang murni
 * mengikuti jenis perkara.
 *
 * Yang SENGAJA tidak diisi: variabel yang di ABT dihitung dengan aturan sendiri
 * - amar, penanda otomatis, sumpah menurut agama saksi, dan isian per sidang.
 * Menyalin bentuknya berdasarkan tebakan berarti menaruh kalimat yang tampak
 * benar ke dalam dokumen yang ditandatangani, dan kalimat yang tampak benar
 * jauh lebih sulit ketahuan keliru daripada penanda yang masih terlihat.
 */
export function petaPenanda(berkas: BerkasPerkara): Map<string, { nilai: string; asal: string }> {
  const peta = new Map<string, { nilai: string; asal: string }>();
  const pasang = (noVar: string, nilai: string, asal: string) => {
    if (String(nilai || "").trim()) peta.set(noVar, { nilai: String(nilai).trim(), asal });
  };

  const identitas = (berkas.identitas.nilai ?? {}) as Record<string, unknown>;
  const nomor = berkas.nomorPerkara || String(identitas.nomorPerkara ?? "");
  const jenisPerkara = String(identitas.jenisPerkara ?? "").trim();

  // --- Perkara ---
  pasang("0001", nomor, "SIPP - perkara.nomor_perkara");
  pasang("0048", jenisPerkara, "SIPP - perkara.jenis_perkara_nama");
  const tanggalSurat = tanggalIndonesia(identitas.tanggalSurat);
  const tanggalDaftar = tanggalIndonesia(identitas.tanggalDaftar);
  pasang("0017", tanggalSurat, "SIPP - perkara.tanggal_surat");
  pasang("1061", tanggalDaftar, "SIPP - perkara.tanggal_pendaftaran");

  // #0306# BUKAN sekadar tanggal daftar. ABT: bila tanggal surat sama dengan
  // tanggal daftar, yang dicetak kata "tersebut" - supaya kalimat tidak
  // mengulang tanggal yang sama dua kali dalam satu napas.
  pasang(
    "0306",
    tanggalSurat && tanggalSurat === tanggalDaftar ? "tersebut" : tanggalDaftar,
    "ABT #0306# - \"tersebut\" bila sama dengan tanggal surat"
  );

  // --- Para pihak: SEBUTAN dan NAMA adalah dua penanda yang berbeda ---
  const namaPihak1 = cariPihak(berkas.paraPihak.nilai, ["penggugat", "pemohon"]);
  const namaPihak2 = cariPihak(berkas.paraPihak.nilai, ["tergugat", "termohon"]);
  pasang("0046", sebutanPihak1(jenisPerkara, nomor), "ABT #0046# - sebutan menurut jenis perkara");
  pasang("0047", sebutanPihak2(jenisPerkara, nomor), "ABT #0047# - sebutan menurut jenis perkara");
  pasang("0098", namaPihak1, "SIPP - perkara_pihak1.nama");
  pasang("0102", namaPihak2, "SIPP - perkara_pihak2.nama");

  // --- Petugas: sebutan dan jabatan, bukan nama ---
  pasang("0690", sebutanMajelis(berkas.majelis.nilai), "ABT #0690# - sebutan susunan hakim");

  // #4004# dan #0668# adalah SEBUTAN bagi yang memimpin - "Ketua Majelis" atau
  // "Hakim" - bukan namanya. Namanya dibawa #0012#, yang di ABT bernama
  // "Nama #0668#". Sebelum ini #4004# diisi nama ketua majelis.
  pasang("4004", sebutanKetua(berkas.majelis.nilai), "ABT #4004# - sebutan pemimpin sidang");
  pasang("0668", sebutanKetua(berkas.majelis.nilai), "ABT #0668# - sebutan pemimpin sidang");
  pasang("0012", ketuaMajelis(berkas.majelis.nilai), "SIPP - perkara_hakim_pn, jabatan Hakim Ketua");

  const panitera = namaPetugas(berkas.panitera.nilai);
  pasang("0015", panitera[0] ?? "", "SIPP - perkara_panitera_pn.nama");
  // #6033# di ABT berbunyi select "#0015#" - alias bagi nama panitera.
  pasang("6033", panitera[0] ?? "", "ABT #6033# - alias nama panitera (#0015#)");
  // #6034# JABATANNYA, bukan namanya. Sebelum ini keduanya diisi nama yang
  // sama, sehingga blangko "#6033# sebagai #6034#" tercetak
  // "Unun Fidiyasari Patangai, S.H. sebagai Unun Fidiyasari Patangai, S.H.".
  pasang("6034", jabatanPetugas(berkas.panitera.nilai), "SIPP - jabatan panitera pada perkara");

  // #6032# juga jabatan - "Jurusita" atau "Jurusita Pengganti".
  pasang("6032", jabatanPetugas(berkas.jurusita.nilai), "SIPP - jabatan jurusita pada perkara");

  // --- Sebutan yang mengikuti jenis perkara ---
  pasang("0053", sebutanSurat(jenisPerkara, nomor), "ALETA - menurut jenis perkara");
  const putusanAtauPenetapan = sebutanPutusan(nomor);
  pasang("0194", putusanAtauPenetapan, "ALETA - menurut nomor perkara");
  pasang("5368", putusanAtauPenetapan, "ALETA - menurut nomor perkara");

  // --- Satker ---
  pasang("8008", NAMA_SATKER, "ALETA - pengaturan satker");
  pasang("0150", ZONA_WAKTU, "ALETA - pengaturan satker");

  return peta;
}

function isiPenanda(teks: string, peta: Map<string, { nilai: string; asal: string }>): string {
  return teks.replace(POLA_PENANDA, (utuh, noVar: string) => peta.get(noVar)?.nilai ?? utuh);
}

function penandaDalam(teks: string): string[] {
  return [...teks.matchAll(POLA_PENANDA)].map((cocok) => cocok[1]);
}

/**
 * Bank ragam untuk lembar portal: cermin bawaan + tambahan yang DISAHKAN
 * (untukPortal). Tabel yang tidak terbaca sudah dijatuhkan ke cermin oleh
 * untukPortal sendiri, dengan kabar; galat lain di sini juga jatuh ke cermin -
 * contoh tetap tersedia - tetapi galatnya dicatat dan disebut di kabar.
 */
export async function bankRagamPortal(db: AletaDatabase | null | undefined): Promise<{ bank: BankRagam; kabar: string[] }> {
  if (!db) return { bank: susunBankRagam(null), kabar: [] };
  try {
    const efektif = await untukPortal(db, DAFTAR_RAGAM_PORTAL);
    const kabar = [...efektif.kabar];
    const bank = susunBankRagam(efektif.asal === "basis-data" ? efektif.daftar : null, efektif.versi);
    for (const t of bank.ditolak) kabar.push(`Ragam ${t.daftar} "${t.kunci}" tidak dipakai: ${t.alasan}.`);
    return { bank, kabar };
  } catch (galat) {
    console.error("[BAS TANYA-JAWAB] Pengaturan ragam tidak terbaca; memakai bawaan.", galat);
    const pesan = galat instanceof Error ? galat.message : String(galat);
    return { bank: susunBankRagam(null), kabar: [`Pengaturan ragam tidak terbaca - memakai bawaan: ${pesan}`] };
  }
}

/**
 * Nama jenis perkara SIPP (perkara.jenis_perkara_nama) -> id.
 *
 * CERMIN ID_JENIS_PERKARA_SIPP di ekstensi-sipp/abt.js. Bentuk bersyarat
 * (data.syarat.jenisPerkaraId) membandingkan ID, dan ekstensi mengirim ID ke
 * bot; portal harus mengirim bentuk yang sama ke pemilih, atau bentuk
 * bersyarat dipakai bot tetapi tidak pernah di "Pakai contoh". Kesamaan
 * kedua peta dijaga bas-pakai-contoh-ragam.test.ts.
 */
export const ID_JENIS_PERKARA_SIPP: Readonly<Record<string, string>> = Object.freeze({
  "izin poligami": "341",
  "pencegahan perkawinan": "342",
  "penolakan perkawinan": "343",
  "pembatalan perkawinan": "344",
  "cerai talak": "346",
  "cerai gugat": "347",
  "harta bersama": "348",
  "penguasaan anak": "349",
  "pengesahan anak": "352",
  "kelalaian atas kewajiban suami / istri": "345", // W3a 21 Okt
  "hak - hak bekas istri/kewajiban bekas suami": "351",
  "perkawinan campuran": "359",
  "izin kawin": "361",
  perwalian: "354",
  "asal usul anak": "358",
  "istbat nikah": "360",
  "pengesahan perkawinan/istbat nikah": "360",
  "dispensasi kawin": "362",
  "wali adhol": "363",
  kewarisan: "364",
  wasiat: "365",
  wakaf: "367",
  "lain-lain": "369",
  "lain-lain *)": "369",
  "ekonomi syariah": "370",
  "p3hp/penetapan ahli waris": "371",
  "nafkah anak pasca perceraian": "743",
});

/** Id jenis perkara SIPP dari namanya; nama apa adanya bila tidak dikenal (sama dengan ekstensi). */
export function idJenisPerkaraSipp(nama: unknown): string {
  const bersih = String(nama ?? "").replace(/\s+/g, " ").trim();
  return ID_JENIS_PERKARA_SIPP[bersih.toLowerCase()] || bersih;
}

/** alur_perkara_id SIPP dari nomor perkara: 15 gugatan, 16 permohonan, 17 gugatan sederhana (sama dengan ekstensi). */
export function idAlurPerkaraSipp(nomor: unknown): string {
  const teks = String(nomor ?? "");
  if (/Pdt\.G\.S\b/i.test(teks)) return "17";
  if (/Pdt\.G\b/i.test(teks)) return "15";
  if (/Pdt\.P\b/i.test(teks)) return "16";
  return "";
}

export type KonteksContoh = {
  nomorPerkara: string;
  kodeKumpulan: string;
  saksiKe: number;
  pihakSaksi: PihakSaksi;
  /** Sebutan #0047# dan #0046# sebagaimana diisi petaPenanda. */
  pelaku: string;
  lawan: string;
  /** Id jenis perkara SIPP dan alur_perkara_id - syarat bentuk bersyarat, bentuknya sama dengan kiriman ekstensi. */
  jenisPerkara: string;
  alur: string;
  bank: BankRagam;
};

/**
 * Jawaban contoh untuk SATU saksi.
 *
 * ============================================================================
 * DUA SAKSI TIDAK DIBERI CONTOH YANG SAMA PERSIS
 * ============================================================================
 *
 * Sebelum ini "Pakai contoh" menuang kalimat ABT yang sama kata demi kata ke
 * lembar saksi pertama dan kedua - pada pertanyaan pokok (kenal, tempat
 * tinggal, penyebab, pisah, upaya damai) 100% identik. Di BAS manusia dua
 * saksi hampir tidak pernah berkata sama persis pada pertanyaan itu, dan BAS
 * yang dua keterangannya kembar dibaca sebagai salinan.
 *
 * Kini bentuknya dipilih per saksi dari bank BENTUK yang ditambang dari BAS
 * manusia (atau RAGAM_KATA sebagai cadangan), lewat pemilih K7b yang SAMA
 * dengan bot, dan tiap bentuk harus lolos periksaInvarian - makna, sebutan,
 * angka, titik-titik, dan negasi tidak bergeser. Pertanyaan rumusan mengikuti
 * profil manusia (umumnya tetap sama). Lafal sumpah dan identitas tidak
 * disentuh. Contohnya tetap CONTOH: masuk hanya bila panitera menekan
 * "Pakai contoh", dan panitera tetap membaca dan memperbaikinya.
 */
export function ragamkanContoh(
  item: { pertanyaan: string; jawabanBawaan: string },
  pertanyaan: string,
  jawabanTerisi: string,
  konteks: KonteksContoh
): { jawaban: string; varian: VarianRagam; dilepas: number } {
  const hasil = ragamkanJawabanContoh({
    tanya: pertanyaan,
    jawab: jawabanTerisi,
    jawabMentah: item.jawabanBawaan,
    nomorPerkara: konteks.nomorPerkara,
    kodeKumpulan: konteks.kodeKumpulan,
    ke: konteks.saksiKe,
    pihakSaksi: konteks.pihakSaksi,
    jumlahSaksi: konteks.saksiKe,
    pelaku: konteks.pelaku,
    lawan: konteks.lawan,
    jenisPerkara: konteks.jenisPerkara,
    alur: konteks.alur,
    bank: konteks.bank,
  });
  return { jawaban: hasil.jawab, varian: hasil.varian, dilepas: hasil.dilepas };
}

/**
 * Menyusun lembar tanya-jawab untuk satu perkara.
 *
 * Berkas perkara dan kumpulan pertanyaan diambil BERSAMAAN - keduanya tidak
 * saling bergantung, dan menunggu berurutan hanya menambah jeda yang terasa
 * pada tiap pembukaan halaman.
 */
export async function susunLembarTanyaJawab(args: {
  perkaraId: string;
  kode: string;
  nomorPerkara?: string;
  /** Urutan saksi di pihaknya (1-4 Penggugat, 1-2 Tergugat) - memilih bentuk contohnya. */
  saksiKe?: number;
  /** Nama kumpulan dari katalog - menentukan pihak saksi bersama kodenya. */
  namaKumpulan?: string;
  /** Basis data portal, untuk tambahan ragam yang disahkan. Tanpa ini: bawaan. */
  db?: AletaDatabase | null;
  /**
   * Jawaban yang sudah tersimpan, berkunci urutan pertanyaan.
   *
   * Dicocokkan LEWAT URUTAN, dan itu aman karena keduanya berasal dari
   * kumpulan pertanyaan yang sama. Keterangan saksi lama dari ABT SENGAJA
   * tidak ikut dicocokkan begini - urutan pertanyaan di sana tidak dijamin
   * sama, dan jawaban yang mendarat di bawah pertanyaan yang keliru akan
   * terbaca masuk akal justru saat ia paling salah.
   */
  jawabanTersimpan?: Record<number, string>;
}): Promise<LembarTanyaJawab> {
  const perkaraId = String(args.perkaraId || "").trim();
  const kode = String(args.kode || "").trim();

  const kosongLembar: LembarTanyaJawab = {
    ok: false,
    kode,
    namaKumpulan: "",
    nomorPerkara: args.nomorPerkara ?? "",
    perkaraId,
    jumlahPertanyaan: 0,
    jumlahTerjawab: 0,
    baris: [],
    terisi: [],
    kosong: [],
    halangan: [],
  };

  if (!perkaraId) return { ...kosongLembar, halangan: ["Perkara tidak dikenali."] };
  if (!kode) return { ...kosongLembar, halangan: ["Kumpulan pertanyaan belum dipilih."] };

  type JawabanTanyaJawab = {
    ada?: boolean;
    sebab?: string;
    pertanyaan?: Array<{ urutan: number; pertanyaan: string; jawabanBawaan: string }>;
    variabel?: Array<{ noVar: string; nama: string; jenis: string }>;
  };

  const saksiKe = Math.max(1, Math.floor(Number(args.saksiKe) || 1));
  const pihakSaksi = pihakKumpulan(kode, args.namaKumpulan);

  const [berkas, kumpulan, ragamBank] = await Promise.all([
    rakitBerkasPerkara(perkaraId, args.nomorPerkara ?? ""),
    callAletaBotSippBridge<JawabanTanyaJawab>("abt.tanyaJawab", { kode }),
    bankRagamPortal(args.db),
  ]);

  const halangan = [...berkas.halangan];

  if (!kumpulan.ok || !kumpulan.data?.ada) {
    halangan.push(
      `Kumpulan pertanyaan "${kode}" tidak terbaca: ${kumpulan.data?.sebab ?? kumpulan.error ?? "tidak diketahui"}`
    );
    return { ...kosongLembar, nomorPerkara: berkas.nomorPerkara, halangan };
  }

  const peta = petaPenanda(berkas);
  const namaVariabel = new Map((kumpulan.data.variabel ?? []).map((v) => [v.noVar, v.nama]));

  const tersimpan = args.jawabanTersimpan ?? {};
  // Nomor dari berkas yang dirakit, bukan dari alamat: benih ragam harus
  // sama untuk perkara yang sama, dari halaman mana pun lembar dibuka.
  const nomorKonteks = berkas.nomorPerkara || String(args.nomorPerkara ?? "");
  const identitasPerkara = (berkas.identitas.nilai ?? {}) as Record<string, unknown>;
  const konteks: KonteksContoh = {
    nomorPerkara: nomorKonteks,
    // Id, bukan nama - sama dengan yang dikirim ekstensi ke bot, supaya
    // bentuk bersyarat terpilih sama di portal dan di ekstensi.
    jenisPerkara: idJenisPerkaraSipp(identitasPerkara.jenisPerkara),
    alur: idAlurPerkaraSipp(nomorKonteks),
    kodeKumpulan: kode,
    saksiKe,
    pihakSaksi,
    pelaku: peta.get("0047")?.nilai ?? "",
    lawan: peta.get("0046")?.nilai ?? "",
    bank: ragamBank.bank,
  };
  let dilepas = 0;
  const baris: BarisTanyaJawab[] = (kumpulan.data.pertanyaan ?? []).map((item) => {
    const pertanyaan = isiPenanda(item.pertanyaan, peta);
    const jawabanAbt = isiPenanda(item.jawabanBawaan, peta);
    const contoh = ragamkanContoh(item, pertanyaan, jawabanAbt, konteks);
    dilepas += contoh.dilepas;
    return {
      urutan: item.urutan,
      pertanyaan,
      jawabanBawaan: contoh.jawaban,
      jawabanAbt,
      varian: contoh.varian,
      jawaban: String(tersimpan[item.urutan] ?? "").trim(),
      penandaTersisa: [...new Set([...penandaDalam(pertanyaan), ...penandaDalam(contoh.jawaban)])],
    };
  });

  const terisi: PenandaTerisi[] = [];
  for (const [noVar, isi] of peta) {
    terisi.push({ noVar, nama: namaVariabel.get(noVar) ?? noVar, nilai: isi.nilai, asal: isi.asal });
  }

  const tersisa = new Set(baris.flatMap((b) => b.penandaTersisa));
  const kosong: PenandaKosong[] = [...tersisa].map((noVar) => ({
    noVar,
    nama: namaVariabel.get(noVar) ?? noVar,
    sebab: berkas.paraPihak.ada
      ? "Belum ada padanannya di berkas perkara - diisi panitera."
      : "Para pihak tidak terbaca dari SIPP.",
  }));

  return {
    ok: true,
    kode,
    namaKumpulan: "",
    nomorPerkara: berkas.nomorPerkara,
    perkaraId,
    jumlahPertanyaan: baris.length,
    jumlahTerjawab: baris.filter((b) => b.jawaban).length,
    baris,
    terisi: terisi.filter((item) => tersediaDipakai(item.noVar, kumpulan.data?.variabel)),
    kosong,
    halangan,
    saksiKe,
    pihakSaksi,
    ragam: { asal: ragamBank.bank.asal, versi: ragamBank.bank.versi, dilepas, kabar: ragamBank.kabar },
  };
}

/** Penanda yang tidak dirujuk kumpulan ini tidak perlu dilaporkan sebagai terisi. */
function tersediaDipakai(noVar: string, variabel?: Array<{ noVar: string }>): boolean {
  if (!Array.isArray(variabel) || variabel.length === 0) return true;
  return variabel.some((v) => v.noVar === noVar);
}
