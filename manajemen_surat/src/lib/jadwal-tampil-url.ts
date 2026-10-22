/**
 * ============================================================================
 * JADWAL SIDANG YANG DIBUKA LEWAT TAUTAN RAHASIA  (20 Oktober 2026)
 * ============================================================================
 *
 * Diminta hakim/super admin: "buatkan tampilan yang tinggal url-nya dikasih
 * agar bisa menampilkan jadwal sidang, tapi untuk tombol hanya bisa: tunda,
 * putus, Court Calendar, mediator, serta tombol lainnya yang ada di bagian
 * kanan (ingat semua tag bisa dilihat), untuk tab yang ada print itu hanya
 * tampilkan print saja yang lain tidak tampil".
 *
 * Alamatnya (TANPA masuk akun, tetapi memakai rahasia panjang acak yang dibuat
 * Super Admin/Admin di Akses Publik > Tautan Jadwal Sidang):
 *
 *     /aleta/jadwal/<rahasia>                         hari ini
 *     /aleta/jadwal/<rahasia>?tanggal=2026-10-21      tanggal tertentu
 *     /aleta/jadwal/<rahasia>?ruang=1                 hanya satu ruang sidang
 *     /aleta/jadwal/<rahasia>?majelis=A               hanya satu majelis
 *
 * Halamannya MEMAKAI komponen Jadwal Sidang yang sama - tidak ada salinan
 * logika. Yang berbeda hanya apa yang digambar, dan itu ditentukan SATU
 * daftar di berkas ini (tampilanUrlJadwal), memakai mekanisme saklar
 * tampilan yang sudah ada. Tombol tulis tetap disaring hak peran
 * (saringSaklarSidang) sesudahnya atas akun yang diwakili tautan, jadi yang
 * tidak berhak menulis tetap tidak melihat tombolnya. Sisi server menolak
 * rute di luar daftar izin (lihat server/modules/tautan-jadwal).
 */

import { SAKLAR_TAMPILAN, tampilanBawaan, type PilihanTampilan } from "@/lib/tampilan-antrian-sidang";

/** Alamat pendek yang dibagikan (tanpa basePath; withBasePath menambahkannya): /jadwal/<rahasia>. */
export const ALAMAT_JADWAL_TAMPIL = "/jadwal";

/** Header yang membawa rahasia tautan ke server (rahasianya tidak ikut ke log alamat API). */
export const HEADER_TAUTAN_JADWAL = "x-tautan-jadwal";

/**
 * Memasang rahasia pada SETIAP permintaan fetch ke /api/aleta-ecourt/ dan
 * /api/jadwal-tautan/ (satu asal) - sehingga komponen Jadwal Sidang dan semua
 * tombolnya tidak perlu diubah satu per satu. Mengembalikan fungsi pelepas.
 * Permintaan lain (mis. /api/portal/) tidak dibawa rahasianya.
 */
export function pasangRahasiaTautanPadaFetch(rahasia: string, awalan: string): () => void {
  const asli = window.fetch;
  const garis = (awalan || "").replace(/\/+$/, "");
  const untukKita = (url: URL) =>
    url.origin === window.location.origin &&
    (url.pathname.startsWith(`${garis}/api/aleta-ecourt/`) || url.pathname.startsWith(`${garis}/api/jadwal-tautan/`));
  const pengganti: typeof window.fetch = (input, init) => {
    try {
      const teks = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
      if (untukKita(new URL(teks, window.location.href))) {
        const header = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        header.set(HEADER_TAUTAN_JADWAL, rahasia);
        return asli.call(window, input, { ...init, headers: header });
      }
    } catch {
      /* alamat tak terbaca: teruskan apa adanya */
    }
    return asli.call(window, input, init);
  };
  window.fetch = pengganti;
  return () => {
    if (window.fetch === pengganti) window.fetch = asli;
  };
}

/**
 * Saklar kelompok "alat" (tombol pada baris) yang TETAP ada di tampilan ini:
 * tunda | putus (beserta isi form ikrar), Mediator, Court Calendar, serta
 * tombol-tombol kolom kanan dan kolom Putusan - Status, Blangko, Pertanyaan
 * saksi, Skors/Lompat/Lanjutkan/Tandai berjalan, Selesai, Tunjuk konseptor,
 * Keterangan. Tombol Blangko tidak ikut: ia membuka halaman portal yang
 * menuntut masuk akun, dan tampilan ini tanpa akun. Status juga membuka
 * halaman portal - tombolnya tampil hanya bila induk menyediakan jalannya.
 */
export const TOMBOL_BARIS_DIIZINKAN_URL: readonly string[] = [
  "tombol-tunda-putus",
  "tombol-isi-ikrar",
  "tombol-mediator",
  "court-calendar",
  "pertanyaan-saksi",
  "tunjuk-konseptor",
  "keterangan-perkara",
  "tombol-status-perkara",
  "tombol-ruang-sidang",
  "tombol-selesai-sidang",
];

/**
 * Saklar kelompok "atas" (alat di atas tabel) yang tetap ada: HANYA yang
 * mencetak, ditambah dua keterangan pita ruang sidang (jumlah dan yang sedang
 * berjalan) - keduanya bacaan, bukan alat.
 */
export const ALAT_ATAS_DIIZINKAN_URL: readonly string[] = [
  "cetak",
  "tombol-cetak-relaas",
  "kartu-ruang",
  "ringkasan-ruang",
  // 22 Okt 2026: tiga unsur bacaan yang SUDAH tampil di tampilan ini sebelum
  // punya saklar - tetap tampil (tanggal terbaca + jumlah, tanda diperbarui,
  // kalender libur pada kotak tanggal).
  "tanggal-dan-jumlah",
  "tanda-diperbarui",
  "kalender-libur",
];

/**
 * Pilihan tampilan tetap untuk alamat ini.
 *
 *  - penanda dan keterangan (semua tag/lencana): MENYALA, kecuali yang
 *    bawaannya memang mati (kolom Siap, catatan cara menghitung);
 *  - tombol baris dan alat atas: menyala hanya yang ada di daftar izin.
 *
 * Daftar izin, bukan daftar larang: saklar baru yang kelak ditambahkan ke
 * Jadwal Sidang otomatis TIDAK ikut tampil di sini sampai sengaja diizinkan.
 */
export function tampilanUrlJadwal(): PilihanTampilan {
  const dasar = tampilanBawaan();
  const hasil: PilihanTampilan = {};
  for (const saklar of SAKLAR_TAMPILAN) {
    if (saklar.kelompok === "alat") {
      hasil[saklar.kunci] = TOMBOL_BARIS_DIIZINKAN_URL.includes(saklar.kunci);
    } else if (saklar.kelompok === "atas") {
      hasil[saklar.kunci] = ALAT_ATAS_DIIZINKAN_URL.includes(saklar.kunci);
    } else {
      hasil[saklar.kunci] = Boolean(dasar[saklar.kunci]);
    }
  }
  return hasil;
}

export type ParameterJadwalTampil = {
  /** YYYY-MM-DD; kosong = hari ini. */
  tanggal: string;
  ruang: string;
  majelis: string;
};

const POLA_TANGGAL = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Tanggal ISO yang sungguh ada di kalender (2026-02-30 ditolak). */
export function tanggalIsoSah(nilai: string | null | undefined): boolean {
  const cocok = POLA_TANGGAL.exec(String(nilai ?? "").trim());
  if (!cocok) return false;
  const [tahun, bulan, hari] = [Number(cocok[1]), Number(cocok[2]), Number(cocok[3])];
  const uji = new Date(Date.UTC(tahun, bulan - 1, hari));
  return uji.getUTCFullYear() === tahun && uji.getUTCMonth() === bulan - 1 && uji.getUTCDate() === hari;
}

function bersih(nilai: string | null | undefined, panjang = 60): string {
  return String(nilai ?? "").replace(/\s+/g, " ").trim().slice(0, panjang);
}

/**
 * Membaca ?tanggal=&ruang=&majelis= . Tanggal yang bukan tanggal sungguhan
 * dibuang (jatuh ke hari ini) - alamat yang salah ketik tetap menampilkan
 * jadwal, bukan layar kosong.
 */
export function bacaParameterJadwal(pencarian: string | URLSearchParams | null | undefined): ParameterJadwalTampil {
  const params =
    pencarian instanceof URLSearchParams ? pencarian : new URLSearchParams(String(pencarian ?? "").replace(/^\?/, ""));
  const tanggal = bersih(params.get("tanggal"), 10);
  return {
    tanggal: tanggalIsoSah(tanggal) ? tanggal : "",
    ruang: bersih(params.get("ruang")),
    majelis: bersih(params.get("majelis")),
  };
}

/** Menyusun bagian "?tanggal=..&ruang=.." ; kosong bila tidak ada satu pun. */
export function susunPencarianJadwal(p: Partial<ParameterJadwalTampil>): string {
  const params = new URLSearchParams();
  if (p.tanggal && tanggalIsoSah(p.tanggal)) params.set("tanggal", p.tanggal);
  if (p.ruang) params.set("ruang", p.ruang);
  if (p.majelis) params.set("majelis", p.majelis);
  const teks = params.toString();
  return teks ? `?${teks}` : "";
}

/**
 * Mencocokkan nilai ?ruang= dengan nama ruang yang ada pada jadwal.
 * Sama persis -> sama tanpa huruf besar/kecil -> hanya nomor ("1" cocok dengan
 * "Ruang Sidang 1", tetapi tidak dengan "Ruang Sidang 11").
 */
export function cocokkanRuang(param: string, daftar: ReadonlyArray<{ nama: string }>): string | null {
  const minta = bersih(param);
  if (!minta) return null;
  const persis = daftar.find((r) => r.nama === minta);
  if (persis) return persis.nama;
  const huruf = daftar.find((r) => r.nama.toLowerCase() === minta.toLowerCase());
  if (huruf) return huruf.nama;
  if (/^\d+$/.test(minta)) {
    const nomor = daftar.filter((r) => new RegExp(`(^|\\D)${minta}$`).test(r.nama.trim()));
    if (nomor.length === 1) return nomor[0].nama;
  }
  return null;
}
