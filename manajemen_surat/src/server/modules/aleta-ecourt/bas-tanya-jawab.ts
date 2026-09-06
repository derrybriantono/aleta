import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { rakitBerkasPerkara, type BerkasPerkara } from "@/server/modules/aleta-ecourt/berkas-perkara";

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
  /** Bunyi jawaban contoh dari ABT - bantuan mengetik, bukan jawaban saksi. */
  jawabanBawaan: string;
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

  const [berkas, kumpulan] = await Promise.all([
    rakitBerkasPerkara(perkaraId, args.nomorPerkara ?? ""),
    callAletaBotSippBridge<JawabanTanyaJawab>("abt.tanyaJawab", { kode }),
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
  const baris: BarisTanyaJawab[] = (kumpulan.data.pertanyaan ?? []).map((item) => {
    const pertanyaan = isiPenanda(item.pertanyaan, peta);
    const jawabanBawaan = isiPenanda(item.jawabanBawaan, peta);
    return {
      urutan: item.urutan,
      pertanyaan,
      jawabanBawaan,
      jawaban: String(tersimpan[item.urutan] ?? "").trim(),
      penandaTersisa: [...new Set([...penandaDalam(pertanyaan), ...penandaDalam(jawabanBawaan)])],
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
  };
}

/** Penanda yang tidak dirujuk kumpulan ini tidak perlu dilaporkan sebagai terisi. */
function tersediaDipakai(noVar: string, variabel?: Array<{ noVar: string }>): boolean {
  if (!Array.isArray(variabel) || variabel.length === 0) return true;
  return variabel.some((v) => v.noVar === noVar);
}
