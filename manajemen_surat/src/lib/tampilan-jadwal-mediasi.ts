/**
 * ============================================================================
 * SAKLAR TAMPILAN LAYAR JADWAL MEDIASI (7 Okt 2026)
 * ============================================================================
 *
 * Pola yang sama dengan tampilan-antrian-sidang.ts - satu centang untuk tiap
 * fitur baru, diminta pengguna: "setiap fitur baru punya centang". Disimpan
 * di peramban (kunci sendiri, bukan kunci Jadwal Sidang) dan tidak mengubah
 * data apa pun: yang dimatikan hanya tidak digambar.
 *
 * Saklar TIDAK memberi hak. Tombol hasil mediasi tetap hanya bagi mediator
 * perkara itu dan Super Admin; mematikan saklarnya hanya menyembunyikannya
 * dari yang memang berhak.
 */

export type SaklarTampilanMediasi = {
  kunci: string;
  label: string;
  keterangan: string;
  bawaanMati?: boolean;
};

export const SAKLAR_TAMPILAN_MEDIASI: readonly SaklarTampilanMediasi[] = [
  {
    kunci: "tombol-hasil-mediasi",
    label: "Tombol Buat hasil mediasi (.rtf)",
    keterangan:
      "Tombol di ujung kanan tiap baris: pop-up hasil mediasi dan butir kesepakatan, lalu unduh laporan mediator + kesepakatan perdamaian dalam satu berkas .rtf. Hanya tampil bagi mediator perkara itu dan Super Admin.",
  },
  // 18 Okt 2026 (audit fitur tanpa centang, permintaan hakim): layar ini tumbuh sejak 7 Okt
  // dan hanya tombol hasil mediasi yang punya centang. Delapan lainnya menyala bawaan -
  // tidak ada yang hilang dari layar siapa pun. Hak tetap dari peran (saklar bukan hak).
  {
    kunci: "tombol-status-mediasi",
    label: "Tombol Tandai berjalan | Selesai",
    keterangan:
      "Dua tombol di ujung kanan tiap baris untuk menandai pertemuan mediasi sedang berjalan atau sudah selesai (tersinkron dengan Jadwal Sidang). Hanya tampil bagi yang berwenang mencatat mediasi.",
  },
  {
    kunci: "lencana-status-mediasi",
    label: "Lencana sedang berjalan | selesai",
    keterangan:
      "Lencana \"sedang berjalan\" atau \"selesai\" di kolom Waktu beserta bingkai berwarna pada barisnya (biru berjalan, hijau selesai). Datanya tetap tersimpan; hanya tidak digambar.",
  },
  {
    kunci: "lencana-ditunda",
    label: "Lencana ditunda",
    keterangan: "Lencana kuning \"ditunda\" di kolom Waktu pada pertemuan mediasi yang ditunda.",
  },
  {
    kunci: "penetapan-mediator",
    label: "Tanggal penetapan dan nomor SK mediator",
    keterangan:
      "Dua baris kecil di bawah nama mediator: tanggal mediator ditetapkan (patokan tenggang 30 hari) dan nomor SK-nya. Nama dan sebutan mediator tetap tampil.",
  },
  {
    kunci: "kartu-ringkasan",
    label: "Tiga kartu angka di atas daftar",
    keterangan:
      "Jumlah pertemuan mediasi, yang lewat tenggang 30 hari (merah bila ada), dan yang ditunda pada rentang tanggal yang tampil.",
  },
  {
    kunci: "saring-keadaan",
    label: "Tombol saring keadaan",
    keterangan:
      "Deretan tombol bulat di atas daftar (mis. lewat tenggang, ditunda, sudah ada hasil) beserta jumlahnya; ditekan = hanya yang cocok. Saat dimatikan, saringan keadaan yang sedang dipilih tidak dipakai.",
  },
  {
    kunci: "pencarian-mediasi",
    label: "Kotak saring dan pencarian lanjutan",
    keterangan:
      "Kotak untuk menyaring di dalam hasil (nomor, pihak, mediator, tempat, hasil) dan tombol Pencarian lanjutan. Kotak Cari di atas (nomor perkara atau jenis) tidak terpengaruh. Saat dimatikan, isian saringan yang sedang berisi tidak dipakai.",
  },
  {
    kunci: "catatan-tenggang",
    label: "Catatan cara menghitung tenggang",
    keterangan:
      "Kalimat di dasar layar yang menerangkan tenggang 30 hari dihitung sejak penetapan mediator (PERMA 1/2016 Pasal 24), bukan sejak pertemuan pertama. Sama pada tiap perkara.",
  },
];

export type PilihanTampilanMediasi = Record<string, boolean>;

export const KUNCI_SIMPANAN_TAMPILAN_MEDIASI = "aleta.jadwal-mediasi.tampilan";

export function tampilanMediasiBawaan(): PilihanTampilanMediasi {
  const hasil: PilihanTampilanMediasi = {};
  for (const s of SAKLAR_TAMPILAN_MEDIASI) hasil[s.kunci] = !s.bawaanMati;
  return hasil;
}

/** Simpanan peramban -> pilihan sah; kunci asing dibuang, yang hilang memakai bawaan. */
export function bacaTampilanMediasi(mentah: string | null): PilihanTampilanMediasi {
  const hasil = tampilanMediasiBawaan();
  if (!mentah) return hasil;
  let urai: unknown;
  try {
    urai = JSON.parse(mentah);
  } catch {
    return hasil;
  }
  if (!urai || typeof urai !== "object" || Array.isArray(urai)) return hasil;
  for (const s of SAKLAR_TAMPILAN_MEDIASI) {
    const nilai = (urai as Record<string, unknown>)[s.kunci];
    if (typeof nilai === "boolean") hasil[s.kunci] = nilai;
  }
  return hasil;
}

export function tampilMediasi(pilihan: PilihanTampilanMediasi | undefined, kunci: string): boolean {
  const nilai = pilihan?.[kunci];
  if (typeof nilai === "boolean") return nilai;
  return !SAKLAR_TAMPILAN_MEDIASI.find((s) => s.kunci === kunci)?.bawaanMati;
}
