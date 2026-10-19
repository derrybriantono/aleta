/**
 * ============================================================================
 * TAHAPAN POP-UP DRAF PUTUSAN (19 Okt 2026) - ATURAN MURNI
 * ============================================================================
 *
 * Keluhan hakim: draf H-7 "terlalu panjang, tulisan terlalu kecil, tidak
 * paham". Pop-up kini berisi lima tahap yang masing-masing dapat diklik dan
 * hanya menampilkan isinya sendiri:
 *
 *   1 Ringkasan        satu kalimat awam + blangko + "3 dari 11 isian siap"
 *   2 Isian otomatis   yang sudah terisi + lencana yakin + asal
 *   3 Perlu diisi hakim  daftar pendek + alasan satu baris + "Isi di Blangko"
 *   4 Bahan perkara    kartu terlipat (posita, jawab-menjawab, bukti, saksi, kesimpulan)
 *   5 Selesai          tombol utama membuka blangko; draf belum disimpan
 *
 * Modul ini hanya menyusun data tahapan dari draf; tampilannya di
 * components/portal/draf-h7.tsx. Tanpa istilah teknis: tidak ada kode
 * variabel, "golongan", atau "sumber:" di teks yang dihasilkan.
 */
import {
  namaBlangkoAwam,
  type AsalIsian,
  type BagianRingkasan,
  type DrafH7,
  type IsianDraf,
  type KeyakinanIsian,
  type PilihanBlangkoH7,
  type StatusVarianH7,
  type VarianDrafH7,
  daftarVarianH7,
  tanggalPanjang,
} from "@/lib/agen-h7-putusan";
import { sebutanPihak } from "@/app/api/aleta-ecourt/blangko-derry/susun";

export type KodeTahapH7 = "ringkasan" | "otomatis" | "perlu" | "bahan" | "selesai";
export type StatusTahapH7 = "lengkap" | "perlu" | "netral";

export const TAHAP_H7: ReadonlyArray<{ kode: KodeTahapH7; judul: string; pendek: string }> = [
  { kode: "ringkasan", judul: "Ringkasan", pendek: "Ringkasan" },
  { kode: "otomatis", judul: "Isian otomatis", pendek: "Otomatis" },
  { kode: "perlu", judul: "Perlu diisi hakim", pendek: "Perlu diisi" },
  { kode: "bahan", judul: "Bahan perkara", pendek: "Bahan" },
  { kode: "selesai", judul: "Buka blangko", pendek: "Selesai" },
];

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** "2026-10-19" -> "Senin 19 Oktober 2026". */
export function hariTanggal(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  if (!m) return String(iso ?? "");
  const hari = HARI[new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()];
  return `${hari} ${tanggalPanjang(iso)}`;
}

export const TEKS_YAKIN: Record<KeyakinanIsian, string> = {
  pasti: "pasti",
  cukup: "cukup yakin",
  ragu: "ragu - periksa",
};

export const TEKS_ASAL: Record<AsalIsian, string> = {
  abt: "sudah dicatat petugas",
  sipp: "dari SIPP",
  gugatan: "dari gugatan - belum dikuatkan saksi",
  berkas: "dari berkas e-Court",
  saksi: "dari keterangan saksi",
  lain: "dari deteksi ALETA",
};

/** Keyakinan sebuah isian; draf lama (tanpa ruas keyakinan) diturunkan dari golongannya. */
export function keyakinanIsian(i: Pick<IsianDraf, "golongan" | "keyakinan">): KeyakinanIsian {
  if (i.keyakinan) return i.keyakinan;
  return i.golongan === "terisi" || i.golongan === "pasti" ? "pasti" : "ragu";
}

/** Asal sebuah isian; draf lama diturunkan dari teks `sumber` yang dulu ditulis. */
export function asalIsian(i: Pick<IsianDraf, "golongan" | "asal" | "sumber">): AsalIsian {
  if (i.asal) return i.asal;
  if (i.golongan === "terisi") return "abt";
  const s = String(i.sumber ?? "").toLowerCase();
  if (/saksi/.test(s)) return "saksi";
  if (/ktp|e-court|gugatan-ecourt/.test(s)) return "berkas";
  if (/posita|permohonan|gugatan/.test(s)) return "gugatan";
  if (/sipp/.test(s)) return "sipp";
  return "lain";
}

export type ButirOtomatis = {
  kode: string;
  nama: string;
  nilai: string;
  keyakinan: KeyakinanIsian;
  teksYakin: string;
  teksAsal: string;
  asal: AsalIsian;
  /** Usulan yang belum pasti: hakim/petugas memeriksa dulu. */
  periksa: boolean;
};

export type ButirPerlu = {
  kode: string;
  nama: string;
  /** Alasan satu baris dalam bahasa awam. */
  alasan: string;
  /** Usulan agen untuk isian hukum (bila ada) - ditawarkan, bukan diisikan. */
  usulan: string;
  penting: boolean;
};

export type KartuBahan = {
  kode: BagianRingkasan["kode"];
  judul: string;
  jumlah: number;
  ada: boolean;
  /** Butir yang dapat dilipat satu per satu (posita) atau baris biasa. */
  butir: string[];
  sumber: string;
};

export type TahapanH7 = {
  status: StatusVarianH7;
  kalimat: string;
  blangko: string;
  adaBlangko: boolean;
  alasanBlangko: string;
  siap: number;
  jumlah: number;
  tingkat: VarianDrafH7["kesiapan"]["tingkat"];
  otomatis: ButirOtomatis[];
  perlu: ButirPerlu[];
  dataSippKosong: string[];
  bahan: KartuBahan[];
  tahap: Array<{ kode: KodeTahapH7; judul: string; pendek: string; status: StatusTahapH7; ket: string }>;
};

const potong = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Satu kalimat awam tentang perkara ini. */
export function kalimatRingkasanH7(d: Pick<DrafH7, "alasan" | "tanggalSidang" | "agenda" | "jenisPerkara" | "nomorPerkara" | "blangko">): string {
  const t = sebutanPihak(d.jenisPerkara, d.nomorPerkara).T;
  const hari = hariTanggal(d.tanggalSidang);
  if (d.alasan === "verstek") {
    return `Perkara ini diperkirakan diputus ${hari}, kemungkinan verstek karena ${t} belum pernah hadir.`;
  }
  if (d.alasan === "kesimpulan") return `Perkara ini memasuki sidang kesimpulan pada ${hari}; putusan menyusul sesudah musyawarah majelis.`;
  return d.blangko.perkiraanVerstek
    ? `Perkara ini dijadwalkan musyawarah dan putusan ${hari}, kemungkinan verstek karena ${t} belum pernah hadir.`
    : `Perkara ini dijadwalkan musyawarah dan putusan ${hari}.`;
}

/** Alasan satu baris mengapa sebuah isian harus diisi manusia. */
export function alasanPerlu(i: IsianDraf): string {
  if (i.jenis === "tj") return "Tanya jawab saksi belum ada di Blangko ABT.";
  if (i.khusus === "bukti") return "Daftar bukti surat belum dicatat.";
  if (i.hukum) return i.nilai ? "Keputusan hakim - agen hanya mengusulkan, periksa lalu tetapkan." : "Keputusan hakim - ditetapkan majelis atau konseptor.";
  if (i.golongan === "usulan") return i.catatan && /berbeda/i.test(i.catatan) ? "Data dari dua sumber berbeda - pilih yang benar." : "Ada usulan tetapi belum pasti - periksa dulu.";
  const c = String(i.catatan ?? "").trim();
  if (c && !/^isian hukum/i.test(c)) return potong(c.replace(/\bABT\b/g, "Blangko ABT"), 110);
  return "Belum ada datanya - ketik langsung di blangko.";
}

/** Menyusun semua tahapan untuk satu varian ("dikabulkan" atau "ditolak"). */
export function susunTahapanH7(draf: DrafH7, status: StatusVarianH7 = "dikabulkan"): TahapanH7 {
  const semua = daftarVarianH7(draf);
  const v: VarianDrafH7 = semua.find((x) => x.status === status) ?? semua[0];
  const blangko: PilihanBlangkoH7 = v.blangko;
  const isian = v.isian;

  const otomatis: ButirOtomatis[] = isian
    .filter((i) => i.golongan === "terisi" || i.golongan === "pasti" || (i.golongan === "usulan" && !i.hukum && i.nilai))
    .map((i) => {
      const keyakinan = keyakinanIsian(i);
      const asal = asalIsian(i);
      return {
        kode: i.kode,
        nama: i.nama,
        nilai: i.nilai,
        keyakinan,
        teksYakin: TEKS_YAKIN[keyakinan],
        teksAsal: TEKS_ASAL[asal],
        asal,
        periksa: i.golongan === "usulan",
      };
    });

  const perlu: ButirPerlu[] = isian
    .filter((i) => i.golongan === "manusia" || (i.golongan === "usulan" && (i.hukum || !i.nilai)))
    .map((i) => ({ kode: i.kode, nama: i.nama, alasan: alasanPerlu(i), usulan: i.hukum && i.nilai ? potong(i.nilai, 220) : "", penting: i.penting }))
    // Yang penting dan hukum lebih dulu.
    .sort((a, b) => Number(b.penting) - Number(a.penting));

  const bahan: KartuBahan[] = draf.ringkasan.map((b) => {
    const butir = b.kode === "duduk" && b.butir?.length ? b.butir : b.isi;
    return { kode: b.kode, judul: judulBahan(b.kode, b.judul), jumlah: b.jumlah ?? (b.ada ? b.isi.length : 0), ada: b.ada, butir, sumber: b.sumber };
  });

  const siap = v.kesiapan.terisi + v.kesiapan.pasti;
  const jumlah = v.kesiapan.jumlah;
  const periksa = otomatis.filter((o) => o.periksa).length;
  const bahanAda = bahan.filter((b) => b.ada).length;
  const dataSippKosong = (v.otomatis?.kosong ?? []).map((k) => k.nama);

  const tahap: TahapanH7["tahap"] = TAHAP_H7.map((t) => {
    switch (t.kode) {
      case "ringkasan":
        return { ...t, status: blangko.utama ? "lengkap" : "perlu", ket: blangko.utama ? `${siap} dari ${jumlah} siap` : "blangko belum ada" };
      case "otomatis":
        return {
          ...t,
          status: !otomatis.length ? "netral" : periksa ? "perlu" : "lengkap",
          ket: !otomatis.length ? "belum ada" : periksa ? `${periksa} perlu diperiksa` : `${otomatis.length} terisi`,
        };
      case "perlu":
        return { ...t, status: perlu.length || dataSippKosong.length ? "perlu" : "lengkap", ket: perlu.length ? `${perlu.length} butir` : dataSippKosong.length ? "data SIPP kurang" : "tidak ada" };
      case "bahan":
        return { ...t, status: bahanAda === bahan.length && bahan.length ? "lengkap" : bahanAda ? "netral" : "perlu", ket: `${bahanAda} dari ${bahan.length || 5} ada` };
      default:
        return { ...t, status: v.kesiapan.tingkat === "siap" && blangko.utama ? "lengkap" : "perlu", ket: blangko.utama ? "buka di blangko" : "belum bisa dibuka" };
    }
  });

  return {
    status: v.status,
    kalimat: kalimatRingkasanH7(draf),
    blangko: namaBlangkoAwam(blangko.utama?.label),
    adaBlangko: Boolean(blangko.utama),
    alasanBlangko: blangko.alasan,
    siap,
    jumlah,
    tingkat: v.kesiapan.tingkat,
    otomatis,
    perlu,
    dataSippKosong,
    bahan,
    tahap,
  };
}

function judulBahan(kode: BagianRingkasan["kode"], asli: string): string {
  switch (kode) {
    case "duduk":
      return "Duduk perkara (gugatan)";
    case "jawab":
      return "Jawab-menjawab";
    case "bukti":
      return "Bukti surat";
    case "saksi":
      return "Keterangan saksi";
    case "kesimpulan":
      return "Kesimpulan para pihak";
    default:
      return asli;
  }
}
