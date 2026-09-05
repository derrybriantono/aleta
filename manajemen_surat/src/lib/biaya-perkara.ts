/**
 * BIAYA PERKARA (F5) - dihitung, bukan disalin dari putusan sebelumnya.
 *
 * ============================================================================
 * MENYALIN ANGKA BIAYA ADALAH KEKELIRUAN YANG PALING SERING LOLOS
 * ============================================================================
 *
 * Biaya perkara ditulis di amar, dan amar dibaca berkali-kali. Namun angkanya
 * hampir tidak pernah diperiksa ulang - ia terlihat seperti angka yang sudah
 * benar karena bentuknya sama dengan putusan minggu lalu.
 *
 * Padahal yang membedakan justru bagian yang tidak terlihat: berapa kali para
 * pihak dipanggil, dan berapa tarif radius alamat masing-masing. Perkara yang
 * tergugatnya di luar wilayah dan dipanggil empat kali punya biaya yang jauh
 * berbeda dari perkara sebelah - dengan amar yang bentuknya persis sama.
 *
 * ============================================================================
 * TARIF YANG TIDAK DIKETAHUI BUKAN NOL
 * ============================================================================
 *
 * Inilah aturan yang membuat berkas ini ada. Panggilan yang tarifnya belum
 * disetel akan menyumbang Rp 0 ke total bila dibiarkan - dan totalnya tetap
 * berupa angka rupiah yang rapi, tetap terbilang dengan benar, tetap tercetak
 * tanpa keluhan. Kekurangannya baru ketahuan di kasir.
 *
 * Maka tarif yang tidak diketahui MENGHENTIKAN perhitungan. Hasilnya bukan
 * total yang lebih kecil, melainkan tidak ada total sama sekali, beserta nama
 * komponen yang tarifnya belum ada.
 *
 * ============================================================================
 * TERBILANG DIHITUNG DARI ANGKANYA, TIDAK DIKETIK TERPISAH
 * ============================================================================
 *
 * Amar memuat angka dan terbilangnya sekaligus. Bila keduanya diketik sendiri
 * -sendiri, cepat atau lambat keduanya akan berselisih, dan putusan yang
 * angkanya berselisih dengan terbilangnya harus diperbaiki lewat penetapan.
 */

export type KomponenBiaya = {
  nama: string;
  /** Berapa satuan - misalnya berapa kali panggilan. */
  banyak: number;
  /** Tarif per satuan dalam rupiah; null berarti belum disetel. */
  tarif: number | null;
  keterangan?: string;
};

export type RincianBiaya = {
  nama: string;
  banyak: number;
  tarif: number;
  jumlah: number;
  keterangan: string;
};

export type HasilBiaya = {
  ok: boolean;
  rincian: RincianBiaya[];
  total: number;
  totalRupiah: string;
  terbilang: string;
  /** Panjar yang disetor; selisihnya dinyatakan, bukan didiamkan. */
  panjar: number;
  selisih: number;
  /** "sisa" bila panjar lebih, "kurang" bila panjar kurang, "" bila pas. */
  arahSelisih: "sisa" | "kurang" | "";
  halangan: string[];
};

const SATUAN = [
  "",
  "satu",
  "dua",
  "tiga",
  "empat",
  "lima",
  "enam",
  "tujuh",
  "delapan",
  "sembilan",
  "sepuluh",
  "sebelas",
];

/**
 * Angka menjadi kata, sebagaimana ditulis di amar.
 *
 * "se-" pada seratus, seribu, dan sebelas bukan kerapian bahasa belaka:
 * "satu ribu rupiah" pada amar putusan akan dikoreksi pembanding.
 */
export function terbilang(nilai: number): string {
  const angka = Math.floor(Math.abs(Number(nilai) || 0));
  if (angka === 0) return "nol";
  return susun(angka).replace(/\s+/g, " ").trim();
}

function susun(n: number): string {
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${susun(n - 10)} belas`;
  if (n < 100) {
    const sisa = n % 10;
    return `${susun(Math.floor(n / 10))} puluh${sisa ? ` ${susun(sisa)}` : ""}`;
  }
  if (n < 200) return `seratus${n - 100 ? ` ${susun(n - 100)}` : ""}`;
  if (n < 1000) {
    const sisa = n % 100;
    return `${susun(Math.floor(n / 100))} ratus${sisa ? ` ${susun(sisa)}` : ""}`;
  }
  if (n < 2000) return `seribu${n - 1000 ? ` ${susun(n - 1000)}` : ""}`;
  if (n < 1_000_000) {
    const sisa = n % 1000;
    return `${susun(Math.floor(n / 1000))} ribu${sisa ? ` ${susun(sisa)}` : ""}`;
  }
  if (n < 1_000_000_000) {
    const sisa = n % 1_000_000;
    return `${susun(Math.floor(n / 1_000_000))} juta${sisa ? ` ${susun(sisa)}` : ""}`;
  }
  if (n < 1_000_000_000_000) {
    const sisa = n % 1_000_000_000;
    return `${susun(Math.floor(n / 1_000_000_000))} miliar${sisa ? ` ${susun(sisa)}` : ""}`;
  }
  const sisa = n % 1_000_000_000_000;
  return `${susun(Math.floor(n / 1_000_000_000_000))} triliun${sisa ? ` ${susun(sisa)}` : ""}`;
}

/** Rp 1.234.567,00 - titik ribuan dan koma desimal, sebagaimana lazim di putusan. */
export function rupiah(nilai: number): string {
  const angka = Math.round(Number(nilai) || 0);
  return `Rp ${angka.toLocaleString("id-ID")},00`;
}

/**
 * Menghitung biaya perkara.
 *
 * Komponen yang banyaknya nol TIDAK dihitung dan tidak menuntut tarif -
 * perkara yang tidak pernah menghadirkan saksi tidak boleh terhalang oleh
 * tarif sumpah yang tidak relevan baginya.
 */
export function hitungBiaya(komponen: KomponenBiaya[], panjar = 0): HasilBiaya {
  const halangan: string[] = [];
  const rincian: RincianBiaya[] = [];

  for (const item of komponen ?? []) {
    const nama = String(item.nama ?? "").trim() || "(tanpa nama)";
    const banyak = Number(item.banyak);

    if (!Number.isFinite(banyak) || banyak < 0) {
      halangan.push(`Banyaknya "${nama}" belum diketahui.`);
      continue;
    }
    if (banyak === 0) continue;

    if (item.tarif === null || item.tarif === undefined || !Number.isFinite(Number(item.tarif))) {
      halangan.push(`Tarif "${nama}" belum disetel.`);
      continue;
    }

    const tarif = Number(item.tarif);
    if (tarif < 0) {
      halangan.push(`Tarif "${nama}" bernilai negatif.`);
      continue;
    }

    rincian.push({
      nama,
      banyak,
      tarif,
      jumlah: banyak * tarif,
      keterangan: String(item.keterangan ?? "").trim(),
    });
  }

  if (!rincian.length && !halangan.length) halangan.push("Tidak ada satu pun komponen biaya.");

  const ok = halangan.length === 0;
  const total = ok ? rincian.reduce((jumlah, item) => jumlah + item.jumlah, 0) : 0;
  const setoran = Number(panjar) || 0;
  const selisih = ok ? setoran - total : 0;

  return {
    ok,
    rincian,
    total,
    totalRupiah: ok ? rupiah(total) : "",
    terbilang: ok ? terbilang(total) : "",
    panjar: setoran,
    selisih: Math.abs(selisih),
    arahSelisih: !ok || selisih === 0 ? "" : selisih > 0 ? "sisa" : "kurang",
    halangan,
  };
}

/**
 * Kalimat biaya sebagaimana ditulis di amar.
 *
 * Mengembalikan kosong bila perhitungannya terhalang. Amar berbunyi
 * "membayar biaya perkara sejumlah Rp 0,00 (nol rupiah)" lebih buruk daripada
 * amar yang bagian biayanya kosong dan karenanya tidak mungkin ditandatangani.
 */
export function kalimatBiaya(hasil: HasilBiaya, dibebankanKepada: string): string {
  if (!hasil.ok) return "";
  const pihak = String(dibebankanKepada ?? "").trim();
  if (!pihak) return "";
  return `Menghukum ${pihak} untuk membayar biaya perkara sejumlah ${hasil.totalRupiah} (${hasil.terbilang} rupiah);`;
}

/**
 * Menghitung berapa kali panggilan dari relaas yang benar-benar tercatat.
 *
 * Bukan dari jumlah sidang. Sidang yang para pihaknya sudah hadir tidak
 * didahului panggilan baru, dan menghitung panggilan dari jumlah sidang
 * menggelembungkan biaya pada tiap perkara yang para pihaknya rajin datang.
 */
export function hitungPanggilan(relaas: Array<{ pihak: string; tanggal: string }>): Map<string, number> {
  const peta = new Map<string, number>();
  for (const item of relaas ?? []) {
    const pihak = String(item.pihak ?? "").trim();
    const tanggal = String(item.tanggal ?? "").trim();
    if (!pihak || !tanggal) continue;
    peta.set(pihak, (peta.get(pihak) ?? 0) + 1);
  }
  return peta;
}
