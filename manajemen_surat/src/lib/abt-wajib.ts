/**
 * VARIABEL WAJIB ABT SEBELUM CETAK - aturan murni (server, layar, uji).
 *
 * ============================================================================
 * PERINGATAN, BUKAN PENAHAN
 * ============================================================================
 *
 * Keputusan pengguna 29 September 2026: daftarnya DIUKUR dari putusan dan
 * dapat diubah Super Admin; ekstensi menyebut variabel wajib yang masih
 * kosong atau berbunyi galat sebagai PERINGATAN - CETAK tidak pernah ditahan.
 *
 * ============================================================================
 * AMBANGNYA DARI UKURAN, BUKAN DARI SELERA
 * ============================================================================
 *
 * Terukur atas salinan Donggala (14 Sep 2026, 2.841 putusan berisian ABT):
 * variabel yang memang selalu diisi berkisar 91-98% (1214 alat bukti Cerai
 * Gugat 97,9%; sebelas variabel Istbat Nikah 91-96,5%). Di bawahnya ada
 * jurang: variabel berikutnya 64% (8171) atau sekitar 50% (alur baru Cerai
 * Gugat). Ambang 90% jatuh di jurang itu. Yang 50-90% tetap disimpan dalam
 * keadaan MATI supaya Super Admin dapat menyalakannya tanpa mengetik kodenya.
 *
 * Minimal 10 putusan: di bawahnya satu perkara menggeser persen sepuluh poin.
 */

export const AMBANG_WAJIB = 0.9;
export const BATAS_SIMPAN = 0.5;
export const MINIMAL_PERKARA = 10;

/**
 * Kunci jenis perkara: huruf kecil, tanda baca menjadi spasi, spasi dirapatkan.
 * "Pengesahan Perkawinan/Istbat Nikah" -> "pengesahan perkawinan istbat nikah".
 */
export function kunciJenis(nilai: unknown): string {
  return String(nilai ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Kode variabel ABT empat angka ("7" -> "0007"); kosong bila bukan angka. */
export function kodeVariabel(nilai: unknown): string {
  const t = String(nilai ?? "")
    .replace(/#/g, "")
    .trim();
  return /^\d{1,5}$/.test(t) ? t.padStart(4, "0") : "";
}

/** Persen satu desimal, atau null bila tidak ada penyebut. */
export function persenTerisi(terisi: number | null | undefined, jumlah: number | null | undefined): number | null {
  const n = Number(jumlah);
  const t = Number(terisi);
  if (!Number.isFinite(n) || n <= 0 || !Number.isFinite(t)) return null;
  return Math.round((1000 * t) / n) / 10;
}

/**
 * Mencocokkan jenis yang diminta ekstensi dengan jenis yang tersimpan.
 *
 * Sama persis lebih dulu. Bila tidak ada, satu-satunya jenis tersimpan yang
 * memuat - atau dimuat oleh - kunci yang diminta ("istbat nikah" ->
 * "pengesahan perkawinan istbat nikah"). Lebih dari satu calon = tidak
 * menebak: peringatan untuk jenis yang salah lebih buruk daripada tidak ada.
 */
export function cocokkanJenis(diminta: string, tersimpan: string[]): string | null {
  const k = kunciJenis(diminta);
  if (!k) return null;
  if (tersimpan.includes(k)) return k;
  const calon = tersimpan.filter((t) => t.includes(k) || k.includes(t));
  return calon.length === 1 ? calon[0] : null;
}

export type HasilUkurBot = {
  ada?: boolean;
  sebab?: string;
  diukurPada?: string;
  jumlahPerkaraDasar?: number;
  jenis?: Array<{
    jenis: string;
    jumlahPerkara?: number;
    variabel?: Array<{ noVar: string; nama?: string; jumlahPerkara: number; jumlahTerisi: number; mulai?: string }>;
  }>;
};

export type BarisUkur = {
  jenis: string;
  jenisNama: string;
  kode: string;
  nama: string;
  jumlahPerkara: number;
  jumlahTerisi: number;
  aktifBawaan: boolean;
};

/** Baris yang layak disimpan dari hasil ukur bot - ambang diterapkan di sini, bukan di bot. */
export function susunHasilUkur(hasil: HasilUkurBot): BarisUkur[] {
  const keluar: BarisUkur[] = [];
  for (const j of Array.isArray(hasil?.jenis) ? hasil.jenis : []) {
    const jenis = kunciJenis(j.jenis);
    if (!jenis) continue;
    for (const v of Array.isArray(j.variabel) ? j.variabel : []) {
      const kode = kodeVariabel(v.noVar);
      const n = Number(v.jumlahPerkara);
      const t = Number(v.jumlahTerisi);
      if (!kode || !Number.isFinite(n) || !Number.isFinite(t) || n < MINIMAL_PERKARA) continue;
      if (t / n < BATAS_SIMPAN) continue;
      keluar.push({
        jenis,
        jenisNama: String(j.jenis).trim(),
        kode,
        nama: String(v.nama ?? "").trim(),
        jumlahPerkara: n,
        jumlahTerisi: t,
        aktifBawaan: t / n >= AMBANG_WAJIB,
      });
    }
  }
  return keluar;
}
