import type { DokumenEvidenSkp, KolomTabelEvidenSkp, PaketEvidenSkp } from "@/lib/eviden-skp-tipe";
import { judulTanpaPeriode } from "@/lib/eviden-skp-unduh";
import { tanggalPanjang } from "@/lib/tanggal-indonesia";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";

/**
 * ============================================================================
 * NASKAH CETAK EVIDEN SKP - SATU BENTUK UNTUK PDF, EXCEL, DAN WORD (2.40.0)
 * ============================================================================
 *
 * Diminta pengguna 27 September 2026: bukti dukung SKP hakim "lengkap dengan
 * header serta tempat tanda tangan yang di kanan ketua dan dikiri hakim yang
 * buat", dalam PDF, Excel, dan Word.
 *
 * Ketiga penggambar membaca NASKAH yang sama dari berkas ini - kop, judul,
 * identitas, indikator, tabel, catatan, dan tanda tangan sudah berupa teks
 * jadi di sini. Penggambar hanya memutuskan letak dan huruf. Tiga penggambar
 * yang masing-masing menyusun teksnya sendiri pasti berselisih cepat atau
 * lambat, dan wujud selisihnya adalah PDF yang diunggah ke eKinerja berbeda
 * bunyinya dari Excel yang disimpan hakimnya.
 *
 * Berkas ini tidak tahu apa itu perkara, dan tidak tahu peran apa yang
 * dibuatkan eviden: sebutan orangnya ("Hakim") datang dari pemanggil, sehingga
 * panitera dan juru sita kelak memakai penggambar yang sama.
 *
 * ============================================================================
 * KOP DARI PENGATURAN INSTANSI, TIDAK DIKARANG
 * ============================================================================
 *
 * Baris kop dibaca dari Identitas Instansi ALETA (tabel institution_identity -
 * yang juga dipakai /api/public/institution): nama satuan kerja, alamat,
 * telepon, surel, dan laman. Ruas yang kosong DILEWATI, tidak diisi tebakan -
 * kop yang memuat nomor telepon karangan lebih buruk daripada kop yang
 * kekurangan satu baris.
 *
 * Satu baris tetap: "MAHKAMAH AGUNG REPUBLIK INDONESIA", hanya bila nama
 * satkernya diawali "Pengadilan". Logonya logo Mahkamah Agung, dan setiap
 * pengadilan di bawahnya berkop demikian; baris itu bukan ruas pengaturan
 * yang dapat berbeda antarsatker.
 */

/** Bagian Identitas Instansi yang dipakai kop dan tanda tangan. */
export type InstansiCetak = {
  courtName?: string | null;
  address?: string | null;
  phoneNumber?: string | null;
  mobilePhone?: string | null;
  email?: string | null;
  website?: string | null;
};

export type BarisKop = { teks: string; tebal: boolean; ukuran: number };

export type BlokTandaTangan = {
  /** Baris di atas ruang tanda tangan - sudah disamakan jumlahnya kiri-kanan. */
  atas: string[];
  nama: string;
  /** false bila namanya titik-titik: tidak ditebalkan, tidak bergaris bawah. */
  namaTerisi: boolean;
  nip: string;
};

export type TabelNaskah = {
  kolom: KolomTabelEvidenSkp[];
  baris: Array<Record<string, string>>;
};

export type NaskahEvidenSkp = {
  kop: { logo: Uint8Array | null; baris: BarisKop[] };
  judul: string;
  subjudul: string;
  /** "1 April 2026 s.d. 30 Juni 2026". */
  rentang: string;
  identitas: Array<{ label: string; nilai: string }>;
  indikator: TabelNaskah | null;
  judulIndikator: string;
  tabel: TabelNaskah;
  judulTabel: string;
  /** Kalimat untuk tabel tanpa baris. */
  tabelKosong: string;
  catatan: string[];
  tandaTangan: { kiri: BlokTandaTangan; kanan: BlokTandaTangan };
  /** Teks kaki halaman kiri. */
  kaki: string;
  /** Judul dokumen tanpa periode, untuk nama lembar Excel dan metadata. */
  judulPendek: string;
  judulLengkap: string;
  namaOrang: string;
  dihitungPada: string;
  tataLetak: TataLetakEvidenSkp;
};

export type TataLetakEvidenSkp = {
  kertas: "A4" | "F4";
  /** Ukuran huruf tabel rincian dalam titik. */
  ukuranTabel: number;
  /** Alasan pilihan kertas - ditulis ke laporan, bukan ke dokumen. */
  alasan: string;
};

export type OpsiNaskahEvidenSkp = {
  instansi: InstansiCetak | null;
  /** Tanggal tanda tangan ISO "YYYY-MM-DD". */
  tanggalTandaTangan: string;
  /** "Hakim" - untuk "Hakim yang bersangkutan,". */
  sebutanOrang: string;
  logo?: Uint8Array | null;
};

/** Tempat bawaan bila pengaturan instansi tidak dapat dibaca - satker ALETA ini. */
export const TEMPAT_BAWAAN = "Donggala";
export const SATKER_BAWAAN = "Pengadilan Agama Donggala";

export const TITIK_NAMA = "(..................................)";
export const TITIK_NIP = "NIP. ....................";

const bersih = (nilai: unknown) => String(nilai ?? "").replace(/\s+/g, " ").trim();

/**
 * "Pengadilan Agama Donggala Kelas II" -> "Pengadilan Agama Donggala".
 * Kelas satker tidak disebut pada jabatan Ketua di tanda tangan.
 */
export function namaSatkerTanpaKelas(namaSatker: string | null | undefined): string {
  return bersih(namaSatker).replace(/\s+Kelas\s+[IVX]+\s*[A-C]?\s*$/i, "").trim();
}

/**
 * Tempat tanda tangan dari nama satker: "Pengadilan Agama Donggala" ->
 * "Donggala". Nama yang tidak berpola "Pengadilan <jenis> <tempat>" tidak
 * ditebak - dipakai tempat bawaan.
 */
export function tempatDariInstansi(instansi: InstansiCetak | null | undefined): string {
  const nama = namaSatkerTanpaKelas(instansi?.courtName);
  const cocok = /^Pengadilan\s+(?:Tinggi\s+)?(?:Agama|Negeri|Tata\s+Usaha\s+Negara|Militer|Syar'?iyah)\s+(.+)$/i.exec(nama)
    ?? /^Mahkamah\s+Syar'?iyah\s+(.+)$/i.exec(nama);
  const tempat = bersih(cocok?.[1]);
  return tempat || TEMPAT_BAWAAN;
}

/** "http://www.pa-donggala.go.id/" -> "www.pa-donggala.go.id". */
function lamanRingkas(laman: string): string {
  return bersih(laman).replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

export function susunBarisKop(instansi: InstansiCetak | null | undefined): BarisKop[] {
  const baris: BarisKop[] = [];
  const nama = bersih(instansi?.courtName);
  if (/^(pengadilan|mahkamah syar)/i.test(nama)) {
    baris.push({ teks: "MAHKAMAH AGUNG REPUBLIK INDONESIA", tebal: true, ukuran: 12 });
  }
  if (nama) baris.push({ teks: nama.toUpperCase(), tebal: true, ukuran: 15 });

  const alamat = bersih(instansi?.address);
  if (alamat) baris.push({ teks: alamat, tebal: false, ukuran: 9.5 });

  // Telepon kantor lebih dahulu; nomor seluler hanya bila telepon kantor
  // kosong. Keduanya dari pengaturan - tidak ada yang dikarang.
  const kontak: string[] = [];
  const telepon = bersih(instansi?.phoneNumber) || bersih(instansi?.mobilePhone);
  if (telepon) kontak.push(`Telepon ${telepon}`);
  const surel = bersih(instansi?.email);
  if (surel) kontak.push(`Surel ${surel}`);
  const laman = lamanRingkas(String(instansi?.website ?? ""));
  if (laman) kontak.push(`Laman ${laman}`);
  if (kontak.length > 0) baris.push({ teks: kontak.join("  ·  "), tebal: false, ukuran: 9 });

  return baris;
}

/** NIP 18 angka ditulis berkelompok seperti di SK: "19940102 201712 1 003". */
export function formatNip(nip: string | null | undefined): string {
  const teks = bersih(nip);
  const angka = teks.replace(/\s+/g, "");
  if (/^\d{18}$/.test(angka)) {
    return `${angka.slice(0, 8)} ${angka.slice(8, 14)} ${angka.slice(14, 15)} ${angka.slice(15)}`;
  }
  return teks;
}

/** Kertas dan ukuran huruf tabel rincian menurut jumlah kolomnya. */
export function pilihTataLetak(jumlahKolom: number): TataLetakEvidenSkp {
  if (jumlahKolom > 12) {
    return {
      kertas: "F4",
      ukuranTabel: jumlahKolom > 20 ? 6 : 6.5,
      alasan:
        `${jumlahKolom} kolom: F4 mendatar (330 mm) memberi lebar 9 cm lebih banyak daripada A4 mendatar ` +
        "(297 mm), sehingga tiap kolom tetap memuat tanggal dan nomor perkara tanpa huruf lebih kecil dari 6 titik.",
    };
  }
  return {
    kertas: "A4",
    ukuranTabel: jumlahKolom > 8 ? 7.5 : 8.5,
    alasan: `${jumlahKolom} kolom: A4 mendatar cukup dan menjadi kertas bawaan unggahan eKinerja.`,
  };
}

/** "27 September 2026 pukul 13.40 WITA" dari cap waktu ISO. */
function waktuBaca(iso: string): string {
  const saat = new Date(iso);
  if (Number.isNaN(saat.getTime())) return "";
  const { tanggal, jam } = waktuPengadilan(saat);
  return `${tanggalPanjang(tanggal)} pukul ${jam.slice(0, 5).replace(":", ".")} WITA`;
}

const KOLOM_INDIKATOR: KolomTabelEvidenSkp[] = [
  { kunci: "aspek", judul: "Aspek", bobot: 1.1, rata: "tengah" },
  { kunci: "teks", judul: "Indikator", bobot: 4 },
  { kunci: "realisasi", judul: "Realisasi", bobot: 1.4, rata: "tengah" },
  { kunci: "dasar", judul: "Dasar hitung", bobot: 3.6 },
];

export function susunNaskahEvidenSkp(
  paket: PaketEvidenSkp,
  dokumen: DokumenEvidenSkp,
  opsi: OpsiNaskahEvidenSkp
): NaskahEvidenSkp {
  const { periode, orang, ketua } = paket;
  const satker = bersih(opsi.instansi?.courtName);
  const tempat = tempatDariInstansi(opsi.instansi);

  const identitas: Array<{ label: string; nilai: string }> = [
    { label: "Nama", nilai: bersih(orang.nama) || "-" },
    { label: "NIP", nilai: formatNip(orang.nip) || "-" },
    { label: "Pangkat/Golongan", nilai: bersih(orang.pangkatGolongan) || "-" },
    { label: "Jabatan", nilai: bersih(orang.jabatan) || "-" },
    { label: "Unit Kerja", nilai: satker || "-" },
  ];
  for (const t of paket.identitasTambahan ?? []) {
    if (bersih(t.label)) identitas.push({ label: bersih(t.label), nilai: bersih(t.nilai) || "-" });
  }
  if (bersih(dokumen.rhk)) identitas.push({ label: "Rencana Hasil Kerja", nilai: bersih(dokumen.rhk) });

  const catatan: string[] = [...dokumen.catatan.map(bersih).filter(Boolean)];
  for (const galat of paket.galat.map(bersih).filter(Boolean)) {
    catatan.push(`Tidak terbaca dari SIPP: ${galat}`);
  }
  const dibaca = waktuBaca(paket.dihitungPada);
  if (dibaca) catatan.push(`Data dibaca ALETA dari SIPP pada ${dibaca}.`);

  // Jabatan Ketua dari datanya bila ada; bila Ketua tidak terbaca, jabatannya
  // tetap ditulis supaya dokumen dapat ditandatangani - namanya yang titik-titik.
  const jabatanKetua = bersih(ketua?.jabatan) || `Ketua ${namaSatkerTanpaKelas(satker) || SATKER_BAWAAN}`;
  const kanan = [`${tempat}, ${tanggalPanjang(opsi.tanggalTandaTangan, opsi.tanggalTandaTangan)}`, bersih(paket.sebutanKanan) || "Mengetahui,", `${jabatanKetua.replace(/,\s*$/, "")},`];
  const kiri = [`${bersih(opsi.sebutanOrang) || "Yang"} yang bersangkutan,`];
  // Nama kedua pihak harus sebaris: blok yang barisnya lebih sedikit
  // diberi baris kosong di ATAS, bukan di bawah.
  while (kiri.length < kanan.length) kiri.unshift("");

  const nipKetua = formatNip(ketua?.nip);
  const nipOrang = formatNip(orang.nip);
  const namaKetua = bersih(ketua?.nama);

  const indikator =
    dokumen.indikator.length > 0
      ? {
          kolom: KOLOM_INDIKATOR,
          baris: dokumen.indikator.map((i) => ({
            aspek: bersih(i.aspek),
            teks: bersih(i.teks),
            realisasi: bersih(i.realisasi),
            dasar: bersih(i.dasar),
          })),
        }
      : null;

  const judulPendek = judulTanpaPeriode(bersih(dokumen.judulLengkap), periode) || bersih(dokumen.judul);

  return {
    kop: { logo: opsi.logo ?? null, baris: susunBarisKop(opsi.instansi) },
    judul: bersih(dokumen.judul).toUpperCase(),
    subjudul: bersih(periode.labelPanjang),
    rentang:
      periode.mulai && periode.selesai
        ? `${tanggalPanjang(periode.mulai, periode.mulai)} s.d. ${tanggalPanjang(periode.selesai, periode.selesai)}`
        : "",
    identitas,
    indikator,
    judulIndikator: "Realisasi Indikator Kinerja",
    tabel: {
      kolom: dokumen.tabel.kolom,
      baris: dokumen.tabel.baris.map((b) => {
        const baris: Record<string, string> = {};
        for (const k of dokumen.tabel.kolom) baris[k.kunci] = String(b[k.kunci] ?? "").trim();
        return baris;
      }),
    },
    judulTabel: `Rincian (${dokumen.tabel.baris.length})`,
    tabelKosong: "Tidak ada data pada periode ini.",
    catatan,
    tandaTangan: {
      kiri: {
        atas: kiri,
        nama: bersih(orang.nama) || TITIK_NAMA,
        namaTerisi: Boolean(bersih(orang.nama)),
        nip: nipOrang ? `NIP. ${nipOrang}` : TITIK_NIP,
      },
      kanan: {
        atas: kanan,
        nama: namaKetua || TITIK_NAMA,
        namaTerisi: Boolean(namaKetua),
        nip: namaKetua && nipKetua ? `NIP. ${nipKetua}` : TITIK_NIP,
      },
    },
    kaki: `${bersih(dokumen.judulLengkap)} · ${bersih(orang.nama)}`,
    judulPendek,
    judulLengkap: bersih(dokumen.judulLengkap),
    namaOrang: bersih(orang.nama),
    dihitungPada: paket.dihitungPada,
    tataLetak: pilihTataLetak(dokumen.tabel.kolom.length),
  };
}

