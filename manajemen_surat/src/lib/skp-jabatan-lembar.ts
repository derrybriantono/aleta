import {
  DAFTAR_DOKUMEN_EVIDEN_SKP,
  formatTanggal,
  susunPaketEvidenSkp,
} from "@/lib/eviden-skp-katalog";
import type {
  DataEvidenSkp,
  DokumenEvidenSkp,
  IndikatorEvidenSkp,
  KetuaEvidenSkp,
  KolomTabelEvidenSkp,
  OrangEvidenSkp,
  PaketEvidenSkp,
} from "@/lib/eviden-skp-tipe";
import { angkaSkp, buktiIsianRhk, type HasilSkpJabatan, type RincianRhkSkp } from "@/lib/skp-jabatan-hitung";
import { LABEL_JABATAN_SKP, type JenisSkp, type LembarSkp, type SumberSkp } from "@/lib/skp-jabatan-tipe";

/**
 * ============================================================================
 * LEMBAR SKP DAN BUKTI DUKUNG - PENYUSUN UNTUK PIPELINE CETAK YANG ADA
 * ============================================================================
 *
 * Hasil hitung (skp-jabatan-hitung.ts) diubah menjadi PaketEvidenSkp:
 * DokumenEvidenSkp "lembar-skp" (format Permen PANRB 6/2022) dan satu bukti
 * dukung per RHK. Paket itu lewat susunNaskahEvidenSkp dan penggambar PDF/
 * Excel/Word/ZIP yang sama dengan eviden hakim - tidak ada penggambar baru.
 *
 * Tanda tangan: kiri pegawai yang dinilai, KANAN pejabat penilai kinerja.
 * Perilaku kerja dan predikat kinerja periodik berupa baris titik-titik untuk
 * diisi manual oleh pejabat penilai.
 */

export const KUNCI_LEMBAR_SKP = "lembar-skp";
export const AWALAN_KUNCI_BUKTI_SKP = "bukti-";
export const SEBUTAN_KANAN_SKP = "Pejabat Penilai Kinerja,";

const TITIK_ISIAN = "..................";
const TITIK_JABATAN_PENILAI = "..................................";

const LABEL_SUMBER: Record<SumberSkp, string> = { sipp: "SIPP", isian: "Isian", gabungan: "SIPP + isian" };

/** Sebutan di baris tanda tangan kiri ("Pegawai yang bersangkutan,"). */
export function sebutanOrangSkp(jenis: JenisSkp): string {
  if (jenis === "hakim") return "Hakim";
  if (jenis === "pimpinan") return "Pimpinan";
  return "Pegawai";
}

export function kunciBuktiSkp(kunciRhk: string): string {
  return `${AWALAN_KUNCI_BUKTI_SKP}${kunciRhk}`;
}

// ─── Lembar SKP ─────────────────────────────────────────────────────────────

const KOLOM_LEMBAR: KolomTabelEvidenSkp[] = [
  { kunci: "no", judul: "No", bobot: 0.5, rata: "tengah" },
  { kunci: "rhk", judul: "Rencana Hasil Kerja", bobot: 2.8 },
  { kunci: "indikator", judul: "Indikator Kinerja Individu", bobot: 3.2 },
  { kunci: "target", judul: "Target", bobot: 1.3, rata: "tengah" },
  { kunci: "realisasi", judul: "Realisasi", bobot: 1.4, rata: "tengah" },
  { kunci: "sumber", judul: "Sumber", bobot: 1, rata: "tengah" },
  { kunci: "dasar", judul: "Dasar Hitung", bobot: 3.2 },
];

function judulLembar(jenis: JenisSkp): string {
  if (jenis === "pimpinan") return "Lembar SKP Pimpinan";
  return `Lembar SKP ${jenis === "hakim" ? "Hakim" : LABEL_JABATAN_SKP[jenis]}`;
}

type BarisLembar = Record<string, string>;

function barisRhk(
  rhk: LembarSkp["rhk"][number],
  tambahan: boolean,
  mulaiNomor: number
): { baris: BarisLembar[]; berikut: number } {
  const baris: BarisLembar[] = [];
  let no = mulaiNomor;
  rhk.indikator.forEach((i, urut) => {
    no += 1;
    const usulan = i.statusTarget === "usulan" ? " (usulan)" : "";
    baris.push({
      no: String(no),
      rhk: urut === 0 ? `${tambahan ? "Tugas tambahan - " : ""}${rhk.teks}` : "",
      indikator: `${i.aspek}: ${i.teks}`,
      target: `${i.targetTeks}${i.target === null ? "" : usulan}`,
      realisasi: i.realisasiTeks,
      sumber: LABEL_SUMBER[i.sumber],
      dasar: i.dasar,
    });
  });
  return { baris, berikut: no };
}

function barisManual(mulaiNomor: number, perilaku: readonly string[]): { baris: BarisLembar[]; berikut: number } {
  const baris: BarisLembar[] = [];
  let no = mulaiNomor;
  perilaku.forEach((nama, urut) => {
    no += 1;
    baris.push({
      no: String(no),
      rhk: urut === 0 ? "PERILAKU KERJA" : "",
      indikator: nama,
      target: "Sesuai ekspektasi pimpinan",
      realisasi: TITIK_ISIAN,
      sumber: "Isian",
      dasar: "Diisi pejabat penilai",
    });
  });
  for (const [urut, uraian] of ["Hasil kerja", "Perilaku kerja", "Predikat kinerja periodik"].entries()) {
    no += 1;
    baris.push({
      no: String(no),
      rhk: urut === 0 ? "PREDIKAT KINERJA PERIODIK" : "",
      indikator: uraian,
      target: "-",
      realisasi: TITIK_ISIAN,
      sumber: "Isian",
      dasar: "Diisi pejabat penilai",
    });
  }
  return { baris, berikut: no };
}

/** Dokumen "Lembar SKP" dari hasil hitung. `rhkHakim` = dokumen hakim yang ikut pada SKP Pimpinan. */
export function susunDokumenLembarSkp(h: HasilSkpJabatan, rhkHakim: readonly DokumenEvidenSkp[] = []): DokumenEvidenSkp {
  const { lembar } = h;
  let no = 0;
  const baris: BarisLembar[] = [];
  for (const rhk of lembar.rhk) {
    const b = barisRhk(rhk, false, no);
    baris.push(...b.baris);
    no = b.berikut;
  }
  for (const d of rhkHakim) {
    if (!d.tersedia || d.indikator.length === 0) continue;
    d.indikator.forEach((i, urut) => {
      no += 1;
      baris.push({
        no: String(no),
        rhk: urut === 0 ? (d.rhk ?? d.judul) : "",
        indikator: `${i.aspek}: ${i.teks}`,
        target: "Sesuai SKP e-Kinerja",
        realisasi: i.realisasi,
        sumber: "SIPP",
        dasar: i.dasar,
      });
    });
  }
  for (const rhk of lembar.blokTambahan) {
    const b = barisRhk(rhk, true, no);
    baris.push(...b.baris);
    no = b.berikut;
  }
  baris.push(...barisManual(no, lembar.perilakuKerja).baris);

  const judul = judulLembar(lembar.jenis);
  return {
    kunci: KUNCI_LEMBAR_SKP,
    judul: judul.toUpperCase(),
    judulLengkap: `${judul} ${lembar.periode.labelPanjang}`,
    tersedia: true,
    rhk: null,
    indikator: [],
    tabel: { kolom: KOLOM_LEMBAR, baris },
    catatan: lembar.catatan,
  };
}

// ─── Bukti dukung per RHK ───────────────────────────────────────────────────

const KOLOM_BUKTI: KolomTabelEvidenSkp[] = [
  { kunci: "no", judul: "No", bobot: 0.5, rata: "tengah" },
  { kunci: "nomor", judul: "Nomor Perkara", bobot: 2 },
  { kunci: "daftar", judul: "Daftar", bobot: 1.2 },
  { kunci: "tanggal", judul: "Tanggal", bobot: 1.1, rata: "tengah" },
  { kunci: "acuan", judul: "Tanggal Pembanding", bobot: 1.2, rata: "tengah" },
  { kunci: "nilai", judul: "Nilai", bobot: 1.2, rata: "kanan" },
  { kunci: "keterangan", judul: "Keterangan", bobot: 2.6 },
];

/** "Kuantitas 218 Perkara, Kualitas 86,5%, dan Waktu 0,2 Hari berdasarkan Rekap ... Bulan Maret Tahun 2026." */
export function kalimatRealisasiEkinerja(r: RincianRhkSkp, labelPanjangPeriode: string): string {
  const bagian = r.rhk.indikator.map((i) => `${i.aspek} ${i.realisasiTeks}`);
  const gabung =
    bagian.length <= 1
      ? bagian.join("")
      : `${bagian.slice(0, -1).join(", ")}, dan ${bagian[bagian.length - 1]}`;
  return `${gabung} berdasarkan ${r.judulRekap} ${labelPanjangPeriode}.`;
}

export function susunDokumenBuktiSkp(r: RincianRhkSkp, h: HasilSkpJabatan): DokumenEvidenSkp {
  const periode = h.lembar.periode;
  const indikator: IndikatorEvidenSkp[] = r.rhk.indikator.map((i) => ({
    aspek: i.aspek,
    teks: i.teks,
    realisasi: i.realisasiTeks,
    dasar: `${i.dasar}${i.target === null ? "" : ` Target ${i.targetTeks}${i.statusTarget === "usulan" ? " (usulan)" : ""}.`}`,
  }));

  // Satu baris per kejadian; daftar yang sama (dibagi beberapa indikator) hanya sekali.
  const sudah = new Map<string, string[]>();
  const urutan: Array<{ kunci: string; hasil: RincianRhkSkp["hasil"][number] }> = [];
  for (const hasil of r.hasil) {
    if (!hasil.sumberKunci || hasil.kejadian.length === 0) continue;
    const aspek = sudah.get(hasil.sumberKunci);
    if (aspek) aspek.push(hasil.indikator.aspek);
    else {
      sudah.set(hasil.sumberKunci, [hasil.indikator.aspek]);
      urutan.push({ kunci: hasil.sumberKunci, hasil });
    }
  }
  const baris: Array<Record<string, string>> = [];
  let no = 0;
  for (const { kunci, hasil } of urutan) {
    const daftar = (sudah.get(kunci) ?? []).join(", ");
    for (const k of hasil.kejadian) {
      no += 1;
      baris.push({
        no: String(no),
        nomor: k.nomorPerkara ?? "-",
        daftar,
        tanggal: formatTanggal(k.tanggal),
        acuan: formatTanggal(k.tanggalAcuan),
        nilai: k.nilai === null ? "-" : angkaSkp(k.nilai),
        keterangan: k.keterangan ?? "",
      });
    }
  }
  for (const b of buktiIsianRhk(r)) {
    no += 1;
    baris.push({
      no: String(no),
      nomor: b.judul,
      daftar: "Isian manual",
      tanggal: formatTanggal(b.tanggal),
      acuan: "-",
      nilai: "-",
      keterangan: b.rujukan ? `Bukti isian: ${b.rujukan}` : "Bukti isian manual",
    });
  }

  const catatan: string[] = [
    `Kalimat realisasi untuk e-Kinerja: ${kalimatRealisasiEkinerja(r, periode.labelPanjang)}`,
  ];
  if (baris.length === 0) {
    catatan.push("Tidak ada kejadian SIPP yang dapat dicantumkan; bukti dukung untuk indikator ini diisi manual pegawai.");
  }
  catatan.push(...h.lembar.catatan.slice(0, 1));

  return {
    kunci: kunciBuktiSkp(r.rhk.kunci),
    judul: r.judulRekap.toUpperCase(),
    judulLengkap: `${r.judulRekap} ${periode.labelPanjang}`,
    tersedia: true,
    rhk: `${r.tambahan ? "Tugas tambahan - " : ""}${r.rhk.teks}`,
    indikator,
    tabel: { kolom: KOLOM_BUKTI, baris },
    catatan,
  };
}

// ─── Paket ──────────────────────────────────────────────────────────────────

function ketuaDariPenilai(penilai: LembarSkp["pejabatPenilai"]): KetuaEvidenSkp {
  return {
    nama: penilai?.nama ?? "",
    nip: penilai?.nip ?? null,
    jabatan: penilai?.jabatan?.trim() || TITIK_JABATAN_PENILAI,
    sumber: "Pejabat penilai pada Lembar SKP",
  };
}

function identitasPenilai(penilai: LembarSkp["pejabatPenilai"]): Array<{ label: string; nilai: string }> {
  return [
    { label: "Pejabat Penilai", nilai: penilai?.nama?.trim() || TITIK_JABATAN_PENILAI },
    { label: "NIP Pejabat Penilai", nilai: penilai?.nip?.trim() || TITIK_JABATAN_PENILAI },
    { label: "Jabatan Penilai", nilai: penilai?.jabatan?.trim() || TITIK_JABATAN_PENILAI },
  ];
}

function orangDariPegawai(lembar: LembarSkp): OrangEvidenSkp {
  const utama = lembar.pegawai.jabatanUtama ? LABEL_JABATAN_SKP[lembar.pegawai.jabatanUtama] : null;
  const rangkap = lembar.pegawai.jabatanTambahan.map((j) => LABEL_JABATAN_SKP[j]);
  return {
    id: lembar.pegawai.userId,
    nama: lembar.pegawai.nama,
    nip: lembar.pegawai.nip,
    jabatan: utama ? (rangkap.length > 0 ? `${utama} (merangkap ${rangkap.join(", ")})` : utama) : null,
    pangkatGolongan: lembar.pegawai.pangkatGolongan,
  };
}

/** Paket SKP jabatan perkara: Lembar SKP lalu bukti dukung tiap RHK (utama, kemudian tambahan). */
export function susunPaketSkpJabatan(h: HasilSkpJabatan): PaketEvidenSkp {
  const { lembar } = h;
  return {
    periode: lembar.periode,
    orang: orangDariPegawai(lembar),
    ketua: ketuaDariPenilai(lembar.pejabatPenilai),
    dokumen: [susunDokumenLembarSkp(h), ...h.rincian.map((r) => susunDokumenBuktiSkp(r, h))],
    galat: lembar.galat,
    dihitungPada: lembar.dihitungPada,
    identitasTambahan: identitasPenilai(lembar.pejabatPenilai),
    sebutanKanan: SEBUTAN_KANAN_SKP,
  };
}

/**
 * SKP PIMPINAN (Ketua/Wakil Ketua) = SKP Hakim yang ada + RHK pimpinan:
 * Lembar SKP Pimpinan (RHK pimpinan, lalu RHK hakim), seluruh dokumen eviden
 * hakim apa adanya, lalu bukti dukung RHK pimpinan. Tanda tangan kanan =
 * pejabat penilai (bukan "Mengetahui Ketua": Ketua sendiri yang dinilai).
 */
export function susunPaketSkpPimpinan(h: HasilSkpJabatan, dataHakim: DataEvidenSkp): PaketEvidenSkp {
  const hakim = susunPaketEvidenSkp(dataHakim);
  const lembarPimpinan = susunDokumenLembarSkp(h, hakim.dokumen);
  const labelJabatan = h.lembar.pegawai.jabatanUtama ? LABEL_JABATAN_SKP[h.lembar.pegawai.jabatanUtama] : null;
  return {
    periode: dataHakim.periode,
    orang: { ...dataHakim.orang, jabatan: labelJabatan ?? dataHakim.orang.jabatan },
    ketua: ketuaDariPenilai(h.lembar.pejabatPenilai),
    dokumen: [lembarPimpinan, ...hakim.dokumen, ...h.rincian.map((r) => susunDokumenBuktiSkp(r, h))],
    galat: [...hakim.galat, ...h.lembar.galat],
    dihitungPada: dataHakim.dihitungPada,
    identitasTambahan: identitasPenilai(h.lembar.pejabatPenilai),
    sebutanKanan: SEBUTAN_KANAN_SKP,
  };
}

/** Daftar dokumen untuk menu unduhan (kunci + judul), berurutan seperti paket. */
export function daftarDokumenSkpJabatan(h: HasilSkpJabatan, denganHakim = false): Array<{ kunci: string; judul: string }> {
  const judulLembar = susunDokumenLembarSkp(h).judulLengkap;
  const daftar = [{ kunci: KUNCI_LEMBAR_SKP, judul: judulLembar.replace(` ${h.lembar.periode.labelPanjang}`, "") }];
  if (denganHakim) daftar.push(...DAFTAR_DOKUMEN_EVIDEN_SKP.map((d) => ({ ...d })));
  for (const r of h.rincian) daftar.push({ kunci: kunciBuktiSkp(r.rhk.kunci), judul: r.judulRekap });
  return daftar;
}
