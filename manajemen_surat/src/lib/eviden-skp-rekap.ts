import { formatTanggal, persen, selisihHari } from "@/lib/eviden-skp-katalog";
import type {
  DokumenEvidenSkp,
  IndikatorEvidenSkp,
  KetuaEvidenSkp,
  PaketEvidenSkp,
  PeriodeSkp,
} from "@/lib/eviden-skp-tipe";
import type { FormatEvidenSkp } from "@/lib/eviden-skp-unduh";
import type { KunciPeriodeSkpJabatan } from "@/lib/skp-jabatan-tipe";
import { SEBUTAN_PERAN, type BarisRekap, type PeranRekap } from "@/lib/rekap-petugas";

/**
 * ============================================================================
 * EVIDEN SKP DARI REKAP PETUGAS (PP, Juru Sita, Mediator, 27 Okt 2026)
 * ============================================================================
 *
 * Tombol "Unduh eviden SKP" di halaman Rekap Petugas semula hanya untuk hakim
 * (dan PP/Juru Sita/Mediator yang akunnya sudah ditautkan ke pegawai di
 * Pemetaan SKP). Untuk yang belum tertaut, berkas ini menyusun SATU dokumen
 * sederhana yang jujur: rekap perkara yang ditangani orang itu, dibaca dari
 * rekap petugas yang sama dengan yang tampil di halaman - bentuk berkasnya
 * sama dengan eviden hakim (kop, indikator, tabel, tanda tangan).
 *
 * Tidak ada angka yang dikarang: semua hitungan di bawah berasal dari baris
 * rekap (tanggal daftar, putusan, lama perkara, penetapan/laporan mediasi).
 * Lembar SKP lengkap dengan target dan RHK tetap lewat Pemetaan SKP.
 */

/** Peran yang dibuatkan eviden dari rekap (hakim punya jalurnya sendiri). */
export type PeranRekapEviden = Exclude<PeranRekap, "hakim">;

export const KUNCI_DOKUMEN_REKAP = "rekap-perkara-ditangani";

export function peranRekapEvidenCadangan(nilai: unknown): nilai is PeranRekapEviden {
  return nilai === "panitera" || nilai === "jurusita" || nilai === "mediator";
}

/** Alamat rute daftar/unduh eviden rekap - satu aturan untuk menu dan penguji. */
export function alamatEvidenRekap(p: {
  aksi: "daftar" | "unduh";
  peran: PeranRekapEviden;
  id: number | string;
  tahun: number;
  periode: KunciPeriodeSkpJabatan;
  dokumen: string;
  format?: FormatEvidenSkp;
  tanggal?: string | null;
}): string {
  const kueri = new URLSearchParams({
    aksi: p.aksi,
    peran: p.peran,
    id: String(p.id),
    tahun: String(p.tahun),
    periode: p.periode,
    dokumen: p.dokumen,
  });
  if (p.format) kueri.set("format", p.format);
  if (p.tanggal) kueri.set("tanggal", p.tanggal);
  return `/api/aleta-ecourt/rekap-petugas/eviden?${kueri.toString()}`;
}

const sahIso = (nilai: unknown): string => {
  const t = String(nilai ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) && !t.startsWith("0000") ? t : "";
};

type Titik = { masuk: string; selesai: string; lama: number | null };

/** Tanggal masuk dan selesai menurut peran: mediator memakai penetapan dan laporan mediasi. */
function titikPerkara(b: BarisRekap, peran: PeranRekapEviden): Titik {
  if (peran === "mediator" && b.mediasi) {
    const masuk = sahIso(b.mediasi.penetapan) || sahIso(b.tanggalDaftar);
    const selesai = sahIso(b.mediasi.laporan);
    const lama = typeof b.mediasi.lamaHari === "number" ? b.mediasi.lamaHari : selesai ? selisihHari(masuk, selesai) : null;
    return { masuk, selesai, lama };
  }
  return { masuk: sahIso(b.tanggalDaftar), selesai: sahIso(b.tanggalPutusan), lama: typeof b.lamaHari === "number" ? b.lamaHari : null };
}

const dalam = (tanggal: string, mulai: string, selesai: string) => tanggal !== "" && tanggal >= mulai && tanggal <= selesai;

const rata = (angka: number[]): number | null =>
  angka.length === 0 ? null : Math.round((angka.reduce((a, b) => a + b, 0) / angka.length) * 10) / 10;

const angkaKoma = (n: number): string => String(n).replace(".", ",");

const URAIAN_PERAN: Record<PeranRekapEviden, { kerja: string; selesai: string; waktu: string; sumber: string }> = {
  panitera: {
    kerja: "didampingi sebagai Panitera Pengganti",
    selesai: "diputus",
    waktu: "perkara diputus",
    sumber: "pemeriksa perkara (Panitera Pengganti) pada SIPP",
  },
  jurusita: {
    kerja: "relaasnya ditangani sebagai Juru Sita/Juru Sita Pengganti",
    selesai: "diputus",
    waktu: "perkara diputus",
    sumber: "relaas panggilan dan pemberitahuan pada SIPP",
  },
  mediator: {
    kerja: "dimediasi",
    selesai: "dilaporkan hasil mediasinya",
    waktu: "mediasi dilaporkan",
    sumber: "penetapan dan laporan mediasi pada SIPP",
  },
};

export type MasukanEvidenRekap = {
  peran: PeranRekapEviden;
  orang: { id: string; nama: string; jabatan?: string | null };
  periode: PeriodeSkp;
  baris: readonly BarisRekap[];
  /** Batas lama perkara/mediasi (hari) dari rekap. */
  ambangHari: number;
  ketua: KetuaEvidenSkp | null;
  dihitungPada: string;
  /** Daftar perkara terpotong / bagian yang tidak terbaca - disebut di dokumen. */
  galat: string[];
};

/** Perkara yang ditangani dalam periode: masuk sebelum akhir periode dan belum selesai sebelum awal periode. */
export function perkaraDitangani(baris: readonly BarisRekap[], peran: PeranRekapEviden, mulai: string, selesai: string) {
  return baris
    .map((b) => ({ b, t: titikPerkara(b, peran) }))
    .filter(({ t }) => t.masuk !== "" && t.masuk <= selesai && (t.selesai === "" || t.selesai >= mulai))
    .sort((x, y) => (x.t.masuk === y.t.masuk ? Number(x.b.perkaraId) - Number(y.b.perkaraId) : x.t.masuk < y.t.masuk ? -1 : 1));
}

export function susunDokumenRekapEviden(m: MasukanEvidenRekap): DokumenEvidenSkp {
  const { peran, periode } = m;
  const u = URAIAN_PERAN[peran];
  const sebutan = SEBUTAN_PERAN[peran];
  const ditangani = perkaraDitangani(m.baris, peran, periode.mulai, periode.selesai);
  const selesaiPeriode = ditangani.filter(({ t }) => dalam(t.selesai, periode.mulai, periode.selesai));
  const masukPeriode = ditangani.filter(({ t }) => dalam(t.masuk, periode.mulai, periode.selesai));
  const berlangsung = ditangani.length - selesaiPeriode.length;
  const lama = selesaiPeriode.flatMap(({ t }) => (t.lama === null ? [] : [t.lama]));
  const tepat = lama.filter((h) => h <= m.ambangHari);
  const rerata = rata(lama);

  const indikator: IndikatorEvidenSkp[] = [
    {
      aspek: "Kuantitas",
      teks: `Jumlah perkara yang ${u.kerja} pada periode`,
      realisasi: `${ditangani.length} Perkara`,
      dasar: `${ditangani.length} perkara: ${masukPeriode.length} masuk pada periode dan ${ditangani.length - masukPeriode.length} dari periode sebelumnya.`,
    },
    {
      aspek: "Kuantitas",
      teks: `Jumlah perkara yang ${u.selesai} pada periode`,
      realisasi: `${selesaiPeriode.length} Perkara`,
      dasar: `${selesaiPeriode.length} dari ${ditangani.length} perkara ${u.selesai} dalam periode; ${berlangsung} belum selesai pada akhir periode.`,
    },
    {
      aspek: "Kualitas",
      teks: `Ketepatan waktu: ${u.waktu} paling lama ${m.ambangHari} hari`,
      realisasi: persen(tepat.length, lama.length),
      dasar:
        lama.length > 0
          ? `${tepat.length} dari ${lama.length} ${u.waktu} dalam periode selesai paling lama ${m.ambangHari} hari.`
          : "Belum ada perkara selesai dengan lama yang terbaca pada periode ini.",
    },
    {
      aspek: "Waktu",
      teks: `Rata-rata lama ${u.waktu} dalam periode`,
      realisasi: rerata === null ? "—" : `${angkaKoma(rerata)} Hari`,
      dasar:
        rerata === null
          ? "Belum ada perkara selesai dengan lama yang terbaca pada periode ini."
          : `Rata-rata dari ${lama.length} perkara selesai (tanggal masuk sampai tanggal selesai).`,
    },
  ];

  const kolom = [
    { kunci: "no", judul: "No", bobot: 0.5, rata: "tengah" as const },
    { kunci: "nomor", judul: "Nomor Perkara", bobot: 2 },
    { kunci: "jenis", judul: "Jenis Perkara", bobot: 1.6 },
    { kunci: "kedudukan", judul: "Kedudukan", bobot: 1.2 },
    { kunci: "masuk", judul: peran === "mediator" ? "Penetapan Mediasi" : "Tanggal Pendaftaran", bobot: 1.2, rata: "tengah" as const },
    { kunci: "selesai", judul: peran === "mediator" ? "Laporan Mediasi" : "Tanggal Putusan", bobot: 1.2, rata: "tengah" as const },
    { kunci: "keadaan", judul: "Keadaan", bobot: 1.4 },
    { kunci: "lama", judul: "Lama (Hari)", bobot: 0.9, rata: "tengah" as const },
  ];
  const teksKeadaan = (b: BarisRekap, t: Titik): string => {
    if (peran === "mediator") return t.selesai && t.selesai <= periode.selesai ? "Dilaporkan" : "Berjalan";
    if (!t.selesai || t.selesai > periode.selesai) return "Dalam proses";
    return b.statusPutusan ? `Putus - ${b.statusPutusan}` : "Putus";
  };
  const baris = ditangani.map(({ b, t }, i) => ({
    no: String(i + 1),
    nomor: b.nomorPerkara,
    jenis: b.jenisPerkara || "-",
    kedudukan: (b.kedudukan ?? []).join(", ") || "-",
    masuk: formatTanggal(t.masuk),
    selesai: t.selesai && t.selesai <= periode.selesai ? formatTanggal(t.selesai) : "-",
    keadaan: teksKeadaan(b, t),
    lama: t.lama !== null && t.selesai && t.selesai <= periode.selesai ? String(t.lama) : "-",
  }));

  return {
    kunci: KUNCI_DOKUMEN_REKAP,
    judul: "REKAP PERKARA DITANGANI",
    judulLengkap: `Rekap Perkara Ditangani ${sebutan} ${periode.labelPanjang}`,
    tersedia: true,
    rhk: null,
    indikator,
    tabel: { kolom, baris },
    catatan: [
      `Disusun dari rekap petugas pada SIPP (${u.sumber}); angka dihitung dari tanggal yang tercatat di sana, tidak diketik.`,
      `Perkara dihitung ditangani bila masuk paling lambat akhir periode dan belum selesai sebelum awal periode (${formatTanggal(periode.mulai)} s.d. ${formatTanggal(periode.selesai)}).`,
      "Dokumen ini ringkasan perkara, bukan Lembar SKP; target dan rencana hasil kerja diisi lewat Pemetaan SKP.",
      ...m.galat.map((g) => `Tidak terbaca/terpotong: ${g}`),
    ],
  };
}

export function susunPaketEvidenRekap(m: MasukanEvidenRekap): PaketEvidenSkp {
  return {
    periode: m.periode,
    orang: {
      id: m.orang.id,
      nama: m.orang.nama,
      nip: null,
      jabatan: m.orang.jabatan?.trim() || SEBUTAN_PERAN[m.peran],
      pangkatGolongan: null,
    },
    ketua: m.ketua,
    dokumen: [susunDokumenRekapEviden(m)],
    galat: m.galat,
    dihitungPada: m.dihitungPada,
  };
}
