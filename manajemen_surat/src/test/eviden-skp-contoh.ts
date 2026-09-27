import type { DokumenEvidenSkp, KolomTabelEvidenSkp, PaketEvidenSkp } from "@/lib/eviden-skp-tipe";

/**
 * ============================================================================
 * DATA CONTOH EVIDEN SKP - UNTUK UJI PENGGAMBAR, RUTE, DAN MENU
 * ============================================================================
 *
 * Bukan berkas uji: dipakai berkas uji eviden-skp-*.test.ts dan pembuat contoh
 * keluaran. Mengikuti kontrak lib/eviden-skp-tipe.ts apa adanya (PaketEvidenSkp
 * yang biasanya disusun katalog), sehingga penggambar diuji tanpa bergantung
 * pada katalog yang sedang dibangun agen lain.
 *
 * Nama orang, NIP, dan nomor perkara di sini KARANGAN. Yang sengaja dimuat:
 * tanda kutip melengkung (Ma’ruf), "&" dan "<" di nama pihak, nama sangat
 * panjang, nomor perkara panjang tanpa spasi, pindah baris di dalam sel, "≤"
 * pada dasar hitung, dan huruf Arab yang tidak dapat dicetak huruf baku PDF.
 */

export const PERIODE_CONTOH: PaketEvidenSkp["periode"] = {
  kunci: "tw2",
  tahun: 2026,
  label: "Triwulan II",
  labelPanjang: "Triwulan II Tahun 2026",
  mulai: "2026-04-01",
  selesai: "2026-06-30",
  bulan: 3,
};

export const INSTANSI_CONTOH = {
  courtName: "Pengadilan Agama Donggala",
  address: "Jalan Contoh Nomor 1, Kabupaten Donggala, Sulawesi Tengah",
  phoneNumber: "(0457) 000000",
  mobilePhone: "0822-0000-0000",
  email: "surel.contoh@pa-contoh.go.id",
  website: "http://www.pa-contoh.go.id/",
};

const PIHAK = [
  "Siti Ma’rifah binti La Ode Muhammad Ali",
  "Andi Nur’aini & Muh. Rasyid",
  "PT Maju <Bersama> Sejahtera",
  "Nurhayati binti Lamasigi Abdul Rahman Daeng Mappagau bin Haji Muhammad Saleh Lasulo",
  "Rahmawati",
  "Fatimah Az-Zahra binti Ahmad Dahlan",
];

function nomorPerkara(i: number, jenis = "Pdt.G"): string {
  return `${100 + i}/${jenis}/2026/PA.Dgl`;
}

const KOLOM_REKAP: KolomTabelEvidenSkp[] = [
  { kunci: "no", judul: "No", bobot: 0.5, rata: "tengah" },
  { kunci: "nomor", judul: "Nomor Perkara", bobot: 2 },
  { kunci: "jenis", judul: "Jenis Perkara", bobot: 1.5 },
  { kunci: "pihak", judul: "Para Pihak", bobot: 3.5 },
  { kunci: "kedudukan", judul: "Kedudukan", bobot: 1.2 },
  { kunci: "daftar", judul: "Tanggal Daftar", bobot: 1.2, rata: "tengah" },
  { kunci: "putus", judul: "Tanggal Putus", bobot: 1.2, rata: "tengah" },
  { kunci: "status", judul: "Status Putusan", bobot: 1.5 },
];

export function dokumenRekapContoh(jumlah = 18): DokumenEvidenSkp {
  return {
    kunci: "rekap-perkara",
    judul: "REKAP PERKARA",
    judulLengkap: "Rekap Perkara Triwulan II Tahun 2026",
    tersedia: true,
    rhk: "Terselesaikannya perkara yang ditangani secara tepat waktu sesuai standar yang ditetapkan",
    indikator: [
      { aspek: "Kuantitas", teks: "Jumlah perkara yang diputus", realisasi: "12 Perkara", dasar: "12 perkara putus pada 1 April 2026 s.d. 30 Juni 2026" },
      { aspek: "Kualitas", teks: "Persentase perkara yang diputus tepat waktu", realisasi: "91,7%", dasar: "11 dari 12 perkara putus ≤ 150 hari sejak didaftarkan" },
      { aspek: "Waktu", teks: "Waktu penyelesaian", realisasi: "3 Bulan", dasar: "Triwulan II: April-Juni 2026" },
    ],
    tabel: {
      kolom: KOLOM_REKAP,
      baris: Array.from({ length: jumlah }, (_, i) => ({
        no: String(i + 1),
        nomor: nomorPerkara(i),
        jenis: i % 3 === 0 ? "Cerai Gugat" : i % 3 === 1 ? "Cerai Talak" : "Pengesahan Perkawinan/Istbat Nikah",
        pihak: `${PIHAK[i % PIHAK.length]}\nmelawan\n${PIHAK[(i + 2) % PIHAK.length]}`,
        kedudukan: i % 2 === 0 ? "Ketua Majelis" : "Hakim Anggota",
        daftar: `${String((i % 27) + 1).padStart(2, "0")}-04-2026`,
        putus: i % 5 === 4 ? "" : `${String((i % 27) + 2).padStart(2, "0")}-06-2026`,
        status: i % 5 === 4 ? "Belum putus" : i % 4 === 0 ? "Dicabut" : "Dikabulkan",
      })),
    },
    catatan: [
      "Perkara masuk periode bila tanggal putusnya jatuh pada 1 April 2026 s.d. 30 Juni 2026.",
      "Lama perkara dihitung sejak tanggal pendaftaran sampai tanggal putusan.",
    ],
  };
}

/** Dokumen kumulasi 25 kolom - bentuk lembar "status perkara" spreadsheet SKP. */
export function dokumenStatusContoh(jumlah = 40): DokumenEvidenSkp {
  const judul = [
    "No", "Nomor Perkara", "Jenis Perkara", "Tanggal Daftar", "Penggugat/Pemohon", "Tergugat/Termohon",
    "Majelis Hakim", "Panitera Pengganti", "Jurusita", "PMH", "Penetapan Hari Sidang", "Mediator",
    "Hasil Mediasi", "Musyawarah", "Tanggal Putus", "Status Putusan", "Verstek", "Minutasi", "BHT",
    "Ikrar Talak", "Banding", "Kasasi", "e-Court", "Unggah Putusan", "Direktori Putusan",
  ];
  const kolom: KolomTabelEvidenSkp[] = judul.map((j, i) => ({
    kunci: `k${i}`,
    judul: j,
    bobot: i === 0 ? 0.5 : [4, 5, 6].includes(i) ? 2.5 : [1, 2, 12].includes(i) ? 1.6 : 1,
    rata: i === 0 || i >= 16 ? "tengah" : "kiri",
  }));
  return {
    kunci: "status-perkara",
    judul: "STATUS PERKARA",
    judulLengkap: "Status Perkara Triwulan II Tahun 2026",
    tersedia: true,
    rhk: null,
    indikator: [],
    tabel: {
      kolom,
      baris: Array.from({ length: jumlah }, (_, i) => {
        const b: Record<string, string> = {};
        kolom.forEach((k, j) => {
          b[k.kunci] =
            j === 0
              ? String(i + 1)
              : j === 1
                ? `${1000 + i}/Pdt.G/2026/PA.Dgl`
                : j === 4
                  ? PIHAK[i % PIHAK.length]
                  : j === 5
                    ? i === 7
                      ? "Ahmad bin ﺩﺭﺀ Abdullah"
                      : PIHAK[(i + 3) % PIHAK.length]
                    : j === 6
                      ? "Hakim Contoh Ma’ruf, S.H.I., M.H. (K)\nHakim Anggota Satu, S.H.\nHakim Anggota Dua, S.Ag."
                      : [3, 9, 10, 14, 17, 18].includes(j)
                        ? `${String((i % 27) + 1).padStart(2, "0")}-0${4 + (j % 3)}-2026`
                        : j === 12
                          ? i % 3 === 0 ? "Berhasil sebagian" : "Tidak berhasil"
                          : j >= 16
                            ? i % 2 === 0 ? "Ya" : "Tidak"
                            : `Keterangan ${j}`;
        });
        return b;
      }),
    },
    catatan: ["Kumulasi seluruh perkara yang ditangani pada Triwulan II Tahun 2026."],
  };
}

export function dokumenKosongContoh(): DokumenEvidenSkp {
  return {
    kunci: "rekap-minutasi",
    judul: "REKAP MINUTASI",
    judulLengkap: "Rekap Minutasi Triwulan II Tahun 2026",
    tersedia: true,
    rhk: null,
    indikator: [{ aspek: "Kuantitas", teks: "Jumlah perkara yang diminutasi", realisasi: "0 Perkara", dasar: "Tidak ada perkara diminutasi" }],
    tabel: { kolom: KOLOM_REKAP.slice(0, 4), baris: [] },
    catatan: [],
  };
}

export function dokumenTidakTersediaContoh(): DokumenEvidenSkp {
  return {
    kunci: "posbakum",
    judul: "LAPORAN POSBAKUM",
    judulLengkap: "Laporan Posbakum Triwulan II Tahun 2026",
    tersedia: false,
    sebabTidakTersedia: "Bukti dukung Posbakum bukan data SIPP - dilampirkan dari laporan Posbakum.",
    rhk: null,
    indikator: [],
    tabel: { kolom: [], baris: [] },
    catatan: [],
  };
}

export function paketContoh(ubah: Partial<PaketEvidenSkp> = {}): PaketEvidenSkp {
  return {
    periode: PERIODE_CONTOH,
    orang: {
      id: "26",
      nama: "Hakim Contoh Ma’ruf, S.H.I., M.H.",
      nip: "199001012015031001",
      jabatan: "Hakim Pratama Muda",
      pangkatGolongan: "Penata Muda Tingkat I / III/b",
    },
    ketua: {
      nama: "Dr. Ketua Contoh, S.Ag., M.H.",
      nip: "197001011995031002",
      jabatan: "Ketua Pengadilan Agama Donggala",
      sumber: "contoh",
    },
    dokumen: [dokumenRekapContoh(), dokumenStatusContoh(), dokumenKosongContoh(), dokumenTidakTersediaContoh()],
    galat: ["Tanggal musyawarah majelis tidak tercatat di SIPP untuk 3 perkara."],
    dihitungPada: "2026-09-27T05:40:00.000Z",
    ...ubah,
  };
}
