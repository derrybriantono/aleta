/**
 * ============================================================================
 * PENYUSUN PERINTAH AI YANG LENGKAP (18 Okt 2026)
 * ============================================================================
 *
 * Melengkapi `prompt-putusan.ts`. Yang lama hanya menjawab satu keperluan -
 * menulis putusan lengkap. Hakim yang membuka Status Perkara menginginkan
 * lebih banyak: pertimbangan satu isu, amar, analisis pembuktian, ringkasan,
 * persiapan sidang. Berkas ini merangkai SATU perintah dari bahan yang sama
 * untuk semua tujuan itu, dengan dua bentuk:
 *
 *   - TANPA Project: perintah berdiri sendiri - ada PERAN, TUGAS, data, format
 *     jawaban, dan BATASAN. Dipakai di percakapan Claude biasa.
 *   - DENGAN Project ALETA AI PA CLAUDE ULTRA: Project sudah punya instruksi
 *     sendiri, jadi perintah TIDAK menulis peran, tidak menyapa, dan tidak
 *     mengulang aturan. Ia hanya membuka dengan kalimat singkat, menyodorkan
 *     data dengan pola yang dikenali Project (JENIS, PENGGUGAT/PEMOHON,
 *     TERGUGAT/TERMOHON, FAKTA KUNCI, BUKTI SURAT, SAKSI, YANG DIMINTA), dan
 *     meminta dengan PEMICU Project (PT, PL, AM, BP, AP, KF, ...).
 *
 * ============================================================================
 * IDENTITAS SELALU DISAMARKAN
 * ============================================================================
 *
 * Keputusan anonimisasi yang berlaku: nama pihak menjadi inisial, NIK dan
 * nomor telepon tidak pernah ikut, alamat paling jauh sampai kabupaten/kota.
 * Penyamaran berlaku juga atas teks yang DITEMPEL petugas (gugatan, jawaban,
 * keterangan saksi) - nama pihak di dalamnya diganti inisial dan NIK
 * ditutup, tanpa menyentuh susunan kalimatnya.
 *
 * ============================================================================
 * YANG TIDAK ADA TIDAK DITEBAK
 * ============================================================================
 *
 * Bagian yang datanya kosong DIHILANGKAN, bukan diisi karangan. Project akan
 * menandainya [placeholder: ...] sendiri.
 */

import { bentukNamaPihak, polaNama } from "@/lib/anonim-nama-pihak";
import { namaTanpaGelar } from "@/lib/anonimisasi-putusan";
import { PEMBUKA_AMAN, type ProfilProjectAi } from "@/lib/profil-project-ai";
import {
  PILIHAN_ARAH,
  daftarBerkas,
  sebutanPihak,
  susunPrompt,
  type BahanPrompt,
  type PilihanPrompt,
} from "@/lib/prompt-putusan";

/* ========================================================================== */
/* Tujuan                                                                     */
/* ========================================================================== */

export type KunciTujuan =
  | "putusan-lengkap"
  | "pertimbangan"
  | "amar"
  | "blueprint"
  | "pembuktian"
  | "analisa-sebelum"
  | "analisa-sesudah"
  | "komparasi"
  | "ringkasan"
  | "sidang"
  | "saksi-bas"
  | "peta"
  | "peta-ringkas"
  | "faraidh"
  | "nafkah"
  | "biaya"
  | "cek-blangko"
  | "papan"
  | "debat"
  | "tanya";

export type ParameterTujuan = "isu" | "jenis" | "agenda";

export type DefinisiTujuan = {
  kunci: KunciTujuan;
  label: string;
  /** Pemicu yang dikenali Project. `{p}` diganti parameter. */
  pemicu: string;
  parameter?: ParameterTujuan;
  labelParameter?: string;
  contohParameter?: string;
  /** Kalimat tugas untuk perintah TANPA Project; `{p}` diganti parameter. */
  tugas: string;
  /** Bentuk jawaban yang diharapkan pada perintah TANPA Project. */
  format: string;
  /** Tujuan yang memerlukan arah putusan dari majelis. */
  butuhArah?: boolean;
};

export const TUJUAN_AI: readonly DefinisiTujuan[] = [
  {
    kunci: "putusan-lengkap",
    label: "Putusan lengkap",
    pemicu: "PL",
    tugas:
      "Susun draf putusan tingkat pertama yang lengkap untuk perkara ini, dari kepala putusan sampai kaki putusan dan rincian biaya perkara.",
    format:
      "Mulai dengan analisa singkat perkara dan rumusan pembebanan (bila diminta), lalu teks putusan utuh bernomor sesuai susunan Pengadilan Agama.",
    butuhArah: true,
  },
  {
    kunci: "pertimbangan",
    label: "Draf pertimbangan hukum",
    pemicu: "PT {p}",
    parameter: "isu",
    labelParameter: "Isu yang dipertimbangkan",
    contohParameter: "nafkah iddah, hadhanah, harta bersama",
    tugas: "Susun draf pertimbangan hukum untuk isu berikut: {p}.",
    format:
      "Paragraf pertimbangan berurutan: fakta yang terbukti, dasar hukum, penerapan pada fakta, lalu kesimpulan isu. Tiap dasar hukum disebut dengan nama aturan dan pasalnya.",
    butuhArah: true,
  },
  {
    kunci: "amar",
    label: "Amar putusan",
    pemicu: "AM",
    tugas: "Rumuskan amar putusan yang sesuai dengan arah putusan dan fakta perkara ini.",
    format: "Amar dalam butir bernomor, memakai rumusan baku putusan Pengadilan Agama, dengan pembebanan biaya perkara.",
    butuhArah: true,
  },
  {
    kunci: "blueprint",
    label: "Kerangka (blueprint) dokumen",
    pemicu: "BP {p}",
    parameter: "jenis",
    labelParameter: "Jenis dokumen",
    contohParameter: "putusan verstek cerai gugat",
    tugas: "Susun kerangka (blueprint) dokumen berjenis {p} untuk perkara ini, lengkap dengan bagian yang wajib ada.",
    format: "Daftar bagian berurutan beserta isi pokok tiap bagian dan data yang masih harus dilengkapi.",
    butuhArah: true,
  },
  {
    kunci: "pembuktian",
    label: "Analisis pembuktian",
    pemicu: "CEK BUKTI",
    tugas:
      "Analisis pembuktian perkara ini: nilai tiap alat bukti (surat dan saksi), syarat formil dan materiilnya, serta apakah dalil pokok terbukti.",
    format: "Tabel teks per alat bukti (nilai, kekuatan, kelemahan), lalu kesimpulan pembuktian per dalil pokok.",
  },
  {
    kunci: "analisa-sebelum",
    label: "Analisa perkara sebelum putusan",
    pemicu: "AP SEBELUM",
    tugas:
      "Analisis perkara ini sebelum putusan dijatuhkan: titik sengketa, kekuatan dan kelemahan tiap pihak, serta kemungkinan arah putusan beserta risikonya.",
    format: "Uraian berurutan: titik sengketa, analisis dalil dan bukti, kemungkinan arah putusan, hal yang perlu ditanyakan di sidang berikutnya.",
  },
  {
    kunci: "analisa-sesudah",
    label: "Analisa putusan yang sudah dijatuhkan",
    pemicu: "AP SESUDAH",
    tugas: "Analisis putusan yang sudah dijatuhkan pada perkara ini: ketepatan pertimbangan, amar, dan kelengkapannya.",
    format: "Temuan per bagian putusan (tepat, perlu diperbaiki, kurang), disusun menurut tingkat kepentingannya.",
  },
  {
    kunci: "komparasi",
    label: "Komparasi arah putusan",
    pemicu: "KOMPARASI",
    tugas: "Bandingkan kemungkinan arah putusan perkara ini, lengkap dengan alasan dan akibat hukum masing-masing arah.",
    format: "Satu bagian per arah putusan: dasar, kekuatan, risiko, lalu rekomendasi yang dapat dipertanggungjawabkan.",
    butuhArah: true,
  },
  {
    kunci: "ringkasan",
    label: "Ringkasan perkara",
    pemicu: "PERKARA",
    tugas: "Ringkas perkara ini: para pihak, pokok sengketa, jalannya persidangan, bukti, dan keadaan terakhir.",
    format: "Ringkasan satu halaman dalam butir pendek, urut kronologis, tanpa pendapat hukum.",
  },
  {
    kunci: "sidang",
    label: "Persiapan sidang",
    pemicu: "SIDANG {p}",
    parameter: "agenda",
    labelParameter: "Agenda sidang",
    contohParameter: "pembuktian saksi, kesimpulan",
    tugas: "Siapkan sidang dengan agenda {p}: apa yang perlu dilakukan majelis, pertanyaan kunci, dan hal yang perlu dicatat.",
    format: "Daftar langkah dan pertanyaan bernomor sesuai urutan jalannya sidang.",
  },
  {
    kunci: "saksi-bas",
    label: "Keterangan saksi dari BAS",
    pemicu: "KS DARI BAS",
    tugas: "Susun keterangan saksi dari kutipan Berita Acara Sidang berikut, apa adanya, dalam format keterangan saksi pada putusan.",
    format: "Butir-butir keterangan saksi per saksi, tiap butir diawali kata Bahwa, tanpa menambah atau mengubah isi.",
  },
  {
    kunci: "peta",
    label: "Peta musyawarah majelis",
    pemicu: "PETA",
    tugas: "Susun peta musyawarah majelis untuk perkara ini: isu, fakta, dasar hukum, dan titik yang masih perlu diputuskan.",
    format: "Peta isu bernomor, tiap isu memuat fakta, dasar hukum, dan opsi putusan.",
  },
  {
    kunci: "peta-ringkas",
    label: "Peta musyawarah ringkas",
    pemicu: "PETA RINGKAS",
    tugas: "Susun peta musyawarah majelis versi ringkas untuk perkara ini.",
    format: "Satu baris per isu: isu, fakta kunci, dasar hukum, opsi putusan.",
  },
  {
    kunci: "faraidh",
    label: "Hitung faraidh",
    pemicu: "KF",
    tugas: "Hitung pembagian waris (faraidh) berdasarkan data pewaris dan ahli waris yang tersedia pada perkara ini.",
    format: "Daftar ahli waris, bagian masing-masing (pecahan dan persen), cara menghitung langkah demi langkah, dan asumsi yang dipakai.",
  },
  {
    kunci: "nafkah",
    label: "Hitung nafkah",
    pemicu: "KN",
    tugas: "Hitung besaran nafkah (iddah, mut'ah, madhiyah, anak) berdasarkan data penghasilan dan keadaan para pihak pada perkara ini.",
    format: "Rincian per komponen nafkah dengan dasar perhitungan, lalu total dan asumsi yang dipakai.",
  },
  {
    kunci: "biaya",
    label: "Hitung biaya perkara",
    pemicu: "KB",
    tugas: "Hitung biaya perkara berdasarkan rincian panjar dan pemakaian pada perkara ini.",
    format: "Tabel rincian biaya, total, dan sisa atau kekurangan panjar.",
  },
  {
    kunci: "cek-blangko",
    label: "Periksa blangko",
    pemicu: "CEK BLANGKO",
    tugas: "Periksa kesesuaian blangko yang dipakai dengan keadaan perkara ini.",
    format: "Daftar temuan: bagian yang tidak sesuai, alasan, dan perbaikan yang disarankan.",
  },
  {
    kunci: "papan",
    label: "Papan perkara",
    pemicu: "PAPAN",
    tugas: "Susun papan ringkas keadaan perkara ini untuk dipantau majelis.",
    format: "Papan teks satu layar: keadaan, yang sudah selesai, yang tertunda, langkah berikutnya.",
  },
  {
    kunci: "debat",
    label: "Debat dua sisi",
    pemicu: "DEBAT",
    tugas: "Uji perkara ini dengan argumen dari kedua sisi, lalu simpulkan sisi yang lebih kuat.",
    format: "Argumen terkuat tiap sisi, bantahannya, dan penilaian akhir yang beralasan.",
  },
  {
    kunci: "tanya",
    label: "Pertanyaan hukum bebas",
    pemicu: "TANYA",
    tugas: "Jawab pertanyaan hukum yang saya tulis pada bagian pertanyaan, berdasarkan data perkara ini.",
    format: "Jawaban langsung di kalimat pertama, lalu dasar hukum dan penerapannya pada perkara ini.",
  },
] as const;

export type KunciMeta = "" | "saja" | "ringkas" | "lengkap";

export const PILIHAN_META: readonly { kunci: KunciMeta; label: string; pemicu: string; kalimat: string }[] = [
  { kunci: "", label: "Bawaan", pemicu: "", kalimat: "" },
  { kunci: "saja", label: "Saja (hanya yang diminta)", pemicu: "saja", kalimat: "Kerjakan hanya yang diminta, tanpa tambahan lain." },
  { kunci: "ringkas", label: "Ringkas", pemicu: "ringkas", kalimat: "Jawab ringkas." },
  { kunci: "lengkap", label: "Selengkap mungkin", pemicu: "selengkap mungkin", kalimat: "Jawab selengkap mungkin." },
];

export function tujuanDari(kunci: string): DefinisiTujuan {
  return TUJUAN_AI.find((t) => t.kunci === kunci) ?? TUJUAN_AI[0];
}

/* ========================================================================== */
/* Penyamaran                                                                 */
/* ========================================================================== */

/**
 * Inisial dari nama SIPP: "Ewardin bin Lasan" -> "E. bin L.",
 * "Siti Aminah binti Salim Ahmad" -> "S.A. binti S.A.". Gelar dibuang, ruas
 * setelah "alias" tidak dipakai.
 */
export function inisialNama(nama: string): string {
  const utuh = namaTanpaGelar(String(nama ?? "").split(/\s+alias\s+/i)[0]).replace(/\s+/g, " ").trim();
  if (!utuh) return "";
  const huruf = (s: string) =>
    s
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((k) => (k.match(/[\p{L}]/u)?.[0] ?? "").toUpperCase())
      .filter(Boolean)
      .join(".");
  const m = /^(.*?)\s+(bin|binti)\s+(.*)$/i.exec(utuh);
  if (!m) {
    const h = huruf(utuh);
    return h ? `${h}.` : "";
  }
  const diri = huruf(m[1]);
  const ayah = huruf(m[3]);
  return `${diri ? `${diri}.` : ""} ${m[2].toLowerCase()}${ayah ? ` ${ayah}.` : ""}`.trim();
}

/** NIK, telepon, dan nomor panjang lain ditutup. */
export function tutupDataPribadi(teks: string): string {
  return String(teks ?? "")
    .replace(/(?<!\d)\d{4}[ .-]?\d{4}[ .-]?\d{4}[ .-]?\d{4}(?!\d)/g, "[NIK disamarkan]")
    .replace(/(?<![\d])(?:\+62|62|0)8\d{1,3}[ .-]?\d{3,4}[ .-]?\d{3,5}(?!\d)/g, "[telepon disamarkan]");
}

/** Semua nama orang pada bahan - pihak, kuasa, saksi. Mediator dan pejabat tidak. */
export function namaOrangBahan(bahan: BahanPrompt): string[] {
  const nama = [
    ...bahan.pihak.penggugat.map((x) => x.nama),
    ...bahan.pihak.tergugat.map((x) => x.nama),
    ...bahan.kuasa.map((x) => x.nama),
    ...bahan.kuasa.map((x) => x.klien),
    ...bahan.saksi.map((x) => x.nama),
  ];
  return nama.map((n) => String(n ?? "").trim()).filter(Boolean);
}

/**
 * Mengganti nama orang di dalam teks dengan inisialnya, lalu menutup NIK dan
 * telepon. Nama terpanjang dikerjakan lebih dulu supaya "Ewardin bin Lasan"
 * tidak tercabik oleh "Ewardin".
 */
export function samarkanTeks(teks: string, namaOrang: string[]): string {
  let hasil = String(teks ?? "");
  const pengganti = new Map<string, string>();
  for (const nama of namaOrang) {
    const bentuk = bentukNamaPihak(nama);
    const ini = inisialNama(nama);
    if (bentuk.utuh && ini) pengganti.set(bentuk.utuh, ini);
    for (const ruas of bentuk.ruas) {
      const i = inisialNama(ruas);
      if (ruas && i) pengganti.set(ruas, i);
    }
    for (const diri of bentuk.diri) {
      const i = inisialNama(diri);
      if (diri && i) pengganti.set(diri, i);
    }
  }
  const urut = [...pengganti.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [asli, ganti] of urut) {
    hasil = hasil.replace(polaNama(asli, "giu"), ganti);
  }
  return tutupDataPribadi(hasil);
}

/** Salinan bahan dengan nama orang berganti inisial dan alamat diringkas. */
export function samarkanBahan(bahan: BahanPrompt): BahanPrompt {
  const nama = namaOrangBahan(bahan);
  const ganti = (n: string) => inisialNama(n) || "-";
  return {
    ...bahan,
    pihak: {
      penggugat: bahan.pihak.penggugat.map((x) => ({ nama: ganti(x.nama), alamat: kabupatenDari(x.alamat) })),
      tergugat: bahan.pihak.tergugat.map((x) => ({ nama: ganti(x.nama), alamat: kabupatenDari(x.alamat) })),
    },
    kuasa: bahan.kuasa.map((k) => ({ ...k, nama: ganti(k.nama), klien: ganti(k.klien) })),
    saksi: bahan.saksi.map((s) => ({ ...s, nama: ganti(s.nama) })),
    sidang: bahan.sidang.map((s) => ({
      ...s,
      agenda: samarkanTeks(s.agenda, nama),
      alasanDitunda: samarkanTeks(s.alasanDitunda, nama),
    })),
    mediasi: { ...bahan.mediasi, isiKesepakatan: samarkanTeks(bahan.mediasi.isiKesepakatan, nama) },
    berkas: bahan.berkas.map((b) => ({ ...b, judul: samarkanTeks(b.judul, nama) })),
  };
}

/** Kabupaten/kota dari alamat SIPP; kosong bila tidak terbaca. Tidak pernah alamat jalan. */
export function kabupatenDari(alamat: string): string {
  const a = String(alamat ?? "");
  const m = /\b(Kab(?:upaten|\.)?|Kota)\s+([A-Za-z'’ ]{3,40}?)(?=\s*(?:,|;|$|Prov|Provinsi|Kec|Kel|Desa))/i.exec(a);
  if (m) return `${/^kota/i.test(m[1]) ? "Kota" : "Kab."} ${m[2].trim()}`;
  // Alamat yang hanya satu kata (mis. "Donggala") sudah setingkat kabupaten.
  const satuKata = /^[A-Za-z'’]{3,30}$/.exec(a.trim());
  return satuKata ? a.trim() : "";
}

/* ========================================================================== */
/* Masukan dan hasil                                                          */
/* ========================================================================== */

export type TempelanPihak = {
  gugatan: string;
  jawaban: string;
  replik: string;
  duplik: string;
  kesimpulan: string;
};

export type MasukanAi = {
  tujuan: KunciTujuan;
  /** Isu / jenis dokumen / agenda, menurut tujuan. */
  parameter: string;
  meta: KunciMeta;
  /** Benar bila petugas memakai Project ALETA AI PA CLAUDE ULTRA. */
  pakaiProject: boolean;
  fakta: string;
  /** Kutipan keterangan saksi dari BAS, ditempel apa adanya. */
  keteranganSaksiBas: string;
  /** Pertanyaan yang ingin dijawab, bebas. */
  pertanyaan: string;
  tempelan: TempelanPihak;
};

export function masukanAwal(): MasukanAi {
  return {
    tujuan: "putusan-lengkap",
    parameter: "",
    meta: "",
    pakaiProject: false,
    fakta: "",
    keteranganSaksiBas: "",
    pertanyaan: "",
    tempelan: { gugatan: "", jawaban: "", replik: "", duplik: "", kesimpulan: "" },
  };
}

export type OpsiPromptAi = {
  /** Hukum acara satker: "RBg" untuk luar Jawa-Madura. Bawaan RBg. */
  hukumAcara?: "RBg" | "HIR";
};

function baris(...isi: (string | false | null | undefined)[]): string {
  return isi.filter(Boolean).join("\n");
}

function nilaiParameter(tujuan: DefinisiTujuan, masukan: MasukanAi, bahan: BahanPrompt): string {
  const p = masukan.parameter.trim();
  if (p) return p;
  if (tujuan.parameter === "jenis") return bahan.identitas.jenisPerkara || "";
  return "";
}

/** Pemicu Project untuk tujuan dan meta yang dipilih, mis. "PT nafkah iddah ringkas". */
export function pemicuProject(masukan: MasukanAi, bahan: BahanPrompt): string {
  const t = tujuanDari(masukan.tujuan);
  const p = nilaiParameter(t, masukan, bahan);
  const dasar = t.pemicu.replace("{p}", p).replace(/\s+/g, " ").trim();
  const meta = PILIHAN_META.find((m) => m.kunci === masukan.meta)?.pemicu ?? "";
  return [dasar, meta].filter(Boolean).join(" ");
}

/** Keadaan kehadiran: verstek atau kontradiktoir, dari data SIPP. Kosong bila tidak jelas. */
export function keadaanPersidangan(bahan: BahanPrompt): string {
  const { satu, dua } = sebutanPihak(bahan);
  if (bahan.putusan?.verstek) return `Verstek (${dua} tidak hadir).`;
  const tidakHadir = bahan.sidang.filter((s) => /Tergugat\/Termohon tidak hadir|kedua pihak tidak hadir/i.test(s.kehadiran || ""));
  if (tidakHadir.length > 0) {
    return `${dua} tidak hadir pada ${tidakHadir.length} sidang; belum tentu verstek, periksa pemanggilan dan putusannya.`;
  }
  const penggugatTidak = bahan.sidang.filter((s) => /Penggugat\/Pemohon tidak hadir/i.test(s.kehadiran || ""));
  const terbaca = bahan.sidang.filter((s) => (s.kehadiran || "").trim());
  if (penggugatTidak.length > 0) return `${satu} tidak hadir pada ${penggugatTidak.length} sidang.`;
  if (terbaca.length > 0 && terbaca.every((s) => /kedua pihak hadir/i.test(s.kehadiran))) {
    return "Kontradiktoir (kedua pihak hadir pada seluruh sidang yang tercatat).";
  }
  return "";
}

function blokVerbatim(judul: string, isi: string): string {
  return `${judul}\n#VERBATIM\n${isi.trim()}\n#ENDVERBATIM`;
}

/** Isian yang masih kurang menurut tujuan, untuk peringatan sebelum disalin. */
export function isianKurangAi(masukan: MasukanAi, bahan: BahanPrompt): string[] {
  const t = tujuanDari(masukan.tujuan);
  const kurang: string[] = [];
  if (t.parameter === "isu" && !masukan.parameter.trim()) kurang.push("Isu yang dipertimbangkan belum diisi.");
  if (t.parameter === "agenda" && !masukan.parameter.trim()) kurang.push("Agenda sidang belum diisi.");
  if (t.parameter === "jenis" && !nilaiParameter(t, masukan, bahan)) kurang.push("Jenis dokumen belum diisi.");
  if (t.kunci === "tanya" && !masukan.pertanyaan.trim()) kurang.push("Pertanyaan belum ditulis.");
  if (t.kunci === "saksi-bas" && !masukan.keteranganSaksiBas.trim()) kurang.push("Kutipan keterangan saksi dari BAS belum ditempel.");
  return kurang;
}

/* ========================================================================== */
/* Perangkaian                                                                */
/* ========================================================================== */

const KALIMAT_PERAN =
  "Anda adalah asisten hukum yang membantu hakim Pengadilan Agama menyusun dan memeriksa dokumen perkara. Bekerjalah dengan cermat, netral, dan hanya atas dasar data yang diberikan.";

/**
 * Merangkai perintah.
 *
 * `pilihan` adalah borang putusan yang sudah ada (arah putusan, mediasi,
 * blangko, dan seterusnya) - dipakai penuh pada tujuan "Putusan lengkap" dan
 * sebagian pada tujuan lain.
 */
export function susunPromptAi(
  bahanAsli: BahanPrompt,
  pilihanAsli: PilihanPrompt,
  masukan: MasukanAi,
  profil: ProfilProjectAi,
  opsi: OpsiPromptAi = {}
): string {
  const hukumAcara = opsi.hukumAcara ?? "RBg";
  const tujuan = tujuanDari(masukan.tujuan);
  const orang = namaOrangBahan(bahanAsli);
  const bahan = samarkanBahan(bahanAsli);
  const bebas = (t: string) => samarkanTeks(t, orang);
  const { satu, dua } = sebutanPihak(bahan);
  const penuhPutusan = tujuan.kunci === "putusan-lengkap";

  /* ---- blok data, dikunci menurut pola Project ----------------------------- */
  const alur = bahan.identitas.gugatan
    ? "Gugatan (contentiosa, ada pihak lawan)"
    : "Permohonan (voluntair, tanpa pihak lawan)";
  const kuasaSisi = (sisi: string) => {
    const k = bahan.kuasa.filter((x) => x.pihak === sisi);
    return k.length ? `kuasa hukum: ${k.map((x) => x.nama).join(", ")}` : "tanpa kuasa hukum";
  };
  const sisiPihak = (daftar: { nama: string; alamat: string }[], sisi: string) =>
    daftar.length
      ? daftar
          .map((p) => `${p.nama}${p.alamat ? `, ${p.alamat}` : ""}`)
          .join("; ") + ` (${kuasaSisi(sisi)})`
      : "";

  const saksi1 = bahan.saksi.filter((s) => s.pihak === "Penggugat/Pemohon");
  const saksi2 = bahan.saksi.filter((s) => s.pihak === "Tergugat/Termohon");
  const saksiLain = bahan.saksi.filter((s) => s.pihak !== "Penggugat/Pemohon" && s.pihak !== "Tergugat/Termohon");
  const bagianSaksi = baris(
    saksi1.length > 0 && `Saksi ${satu}: ${saksi1.map((s) => s.nama).join(", ")}`,
    saksi2.length > 0 && `Saksi ${dua}: ${saksi2.map((s) => s.nama).join(", ")}`,
    saksiLain.length > 0 && `Saksi lain: ${saksiLain.map((s) => s.nama).join(", ")}`,
    masukan.keteranganSaksiBas.trim() &&
      blokVerbatim("Keterangan saksi (kutipan BAS, apa adanya):", bebas(masukan.keteranganSaksiBas)),
    pilihanAsli.saksiManual.trim() && `Catatan saksi: ${bebas(pilihanAsli.saksiManual)}`
  );

  const arahDipilih = PILIHAN_ARAH.find((x) => x.kunci === pilihanAsli.arahPutusan);
  // Pada "Putusan lengkap" arah putusan sudah dibahas bagian A rincian putusan.
  const arah = arahDipilih && tujuan.butuhArah && !penuhPutusan ? `Arah putusan (ditentukan majelis): ${arahDipilih.label}.` : "";

  const fakta = baris(
    masukan.fakta.trim() && bebas(masukan.fakta),
    pilihanAsli.adaRekonvensi && "Ada gugatan rekonvensi.",
    pilihanAsli.adaBuktiElektronik && "Ada bukti elektronik.",
    arah
  );

  const mediasi = bahan.mediasi.ada
    ? [
        bahan.mediasi.mediator && `mediator ${bahan.mediasi.mediator}`,
        bahan.mediasi.tanggalMulaiTerbaca && `mulai ${bahan.mediasi.tanggalMulaiTerbaca}`,
        bahan.mediasi.tanggalLaporanTerbaca && `laporan ${bahan.mediasi.tanggalLaporanTerbaca}`,
        bahan.mediasi.hasilTerbaca && `hasil ${bahan.mediasi.hasilTerbaca}`,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  const riwayat = bahan.sidang.length
    ? bahan.sidang
        .map(
          (s) =>
            `- ${s.tanggalTerbaca || s.tanggal}: ${s.agenda || "-"}${
              s.alasanDitunda ? ` (ditunda: ${s.alasanDitunda})` : ""
            }${s.kehadiran ? ` [${s.kehadiran}]` : ""}`
        )
        .join("\n")
    : "";

  const dokumen = daftarBerkas(bahan)
    .map((b) => `- ${b.nama}${b.penjelas ? ` (${b.penjelas})` : ""}`)
    .join("\n");

  const t = masukan.tempelan;
  const produk = [
    t.gugatan.trim() && blokVerbatim(satu === "Pemohon" ? "PERMOHONAN" : "GUGATAN", bebas(t.gugatan)),
    t.jawaban.trim() && blokVerbatim(`JAWABAN ${dua.toUpperCase()}`, bebas(t.jawaban)),
    t.replik.trim() && blokVerbatim(`REPLIK ${satu.toUpperCase()}`, bebas(t.replik)),
    t.duplik.trim() && blokVerbatim(`DUPLIK ${dua.toUpperCase()}`, bebas(t.duplik)),
    t.kesimpulan.trim() && blokVerbatim("KESIMPULAN", bebas(t.kesimpulan)),
  ].filter(Boolean);

  const permintaanPertanyaan = masukan.pertanyaan.trim() ? `Pertanyaan: ${bebas(masukan.pertanyaan)}` : "";

  /** Data menurut label baku Project -> isi. Yang kosong tidak ikut. */
  const baku: Record<string, string> = {
    JENIS: baris(
      `${bahan.identitas.jenisPerkara || "-"}, Nomor ${bahan.identitas.nomorPerkara}`,
      `Alur: ${alur}`,
      bahan.identitas.tanggalDaftar && `Didaftarkan: ${bahan.identitas.tanggalDaftar}`
    ),
    "PENGGUGAT/PEMOHON": sisiPihak(bahan.pihak.penggugat, "Penggugat/Pemohon") && `${satu}: ${sisiPihak(bahan.pihak.penggugat, "Penggugat/Pemohon")}`,
    "TERGUGAT/TERMOHON": sisiPihak(bahan.pihak.tergugat, "Tergugat/Termohon") && `${dua}: ${sisiPihak(bahan.pihak.tergugat, "Tergugat/Termohon")}`,
    "FAKTA KUNCI": fakta,
    "BUKTI SURAT": pilihanAsli.buktiSurat.trim() ? bebas(pilihanAsli.buktiSurat) : "",
    SAKSI: bagianSaksi,
  };
  const tambahan: [string, string][] = [
    ["KEADAAN PERSIDANGAN", keadaanPersidangan(bahan)],
    ["RIWAYAT SIDANG", penuhPutusan ? "" : riwayat],
    ["MEDIASI", penuhPutusan ? "" : mediasi],
    ["DOKUMEN DI E-COURT", dokumen],
    ["PRODUK PARA PIHAK (kutipan persis, jangan diubah atau diringkas)", produk.join("\n\n")],
    ["CATATAN MAJELIS", pilihanAsli.catatanKhusus.trim() ? bebas(pilihanAsli.catatanKhusus) : ""],
  ];

  const urutan = (profil.bagian.length ? profil.bagian : Object.keys(baku))
    .map((b) => b.toUpperCase())
    .filter((b) => b !== "YANG DIMINTA");
  const blokData: string[] = [];
  for (const label of urutan) {
    if (label in baku && baku[label]) blokData.push(`${label}: ${baku[label]}`);
  }
  // Label baku yang tidak disebut profil tetap ikut - data yang ada tidak boleh hilang
  // hanya karena profil mencatat bagian yang lebih sedikit.
  for (const label of Object.keys(baku)) {
    if (!urutan.includes(label) && baku[label]) blokData.push(`${label}: ${baku[label]}`);
  }
  for (const [label, isi] of tambahan) {
    if (isi) blokData.push(label.startsWith("PRODUK") ? `${label}\n${isi}` : `${label}: ${isi.includes("\n") ? `\n${isi}` : isi}`);
  }

  const perintahPutusan = penuhPutusan
    ? susunPrompt(bahan, {
        ...pilihanAsli,
        buktiSurat: bebas(pilihanAsli.buktiSurat),
        saksiManual: bebas(pilihanAsli.saksiManual),
        catatanKhusus: bebas(pilihanAsli.catatanKhusus),
        isiKesepakatan: bebas(pilihanAsli.isiKesepakatan),
        lampiranTambahan: pilihanAsli.lampiranTambahan,
      })
    : "";

  /* ---- DENGAN Project ------------------------------------------------------ */
  if (masukan.pakaiProject) {
    const pemicu = pemicuProject(masukan, bahan);
    const catatanFormat = baris(
      profil.formatKeluaran && `Format keluaran: ${profil.formatKeluaran}`,
      profil.istilah && `Istilah dan aturan: ${profil.istilah}`,
      hukumAcara === "RBg" && !/RBg/.test(profil.istilah) && "Hukum acara: RBg."
    );
    return [
      profil.pembuka.trim() || PEMBUKA_AMAN,
      blokData.join("\n"),
      baris(`YANG DIMINTA: ${pemicu}`, permintaanPertanyaan),
      perintahPutusan && `RINCIAN PENYUSUNAN PUTUSAN\n\n${perintahPutusan}`,
      catatanFormat,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  /* ---- TANPA Project ------------------------------------------------------- */
  const parameter = nilaiParameter(tujuan, masukan, bahan);
  const meta = PILIHAN_META.find((m) => m.kunci === masukan.meta);
  const tugas = tujuan.tugas.replace("{p}", parameter || "(isu belum diisi)");
  const batasan = [
    "Gunakan hanya dasar hukum yang terverifikasi (nama aturan, nomor, dan pasal yang Anda yakini ada). Bila ragu, tulis [perlu verifikasi] di samping rujukannya.",
    "Jangan mengarang nomor putusan, nomor perkara, pasal, atau yurisprudensi. Bila tidak ada rujukan yang pasti, katakan terus terang.",
    "Data yang tidak ada pada perintah ini jangan diisi dengan tebakan. Tulis [placeholder: nama data] di tempatnya.",
    `Hukum acara yang berlaku ${hukumAcara}${hukumAcara === "RBg" ? " (bukan HIR)" : ""}.`,
    "Tenggat ikrar talak dihitung enam bulan sejak tanggal penetapan hari sidang ikrar talak (PHS ikrar), bukan sejak putusan berkekuatan hukum tetap.",
    "Identitas pihak sudah disamarkan menjadi inisial. Jangan mencoba menebak atau memulihkan identitas asli.",
    "Teks di antara #VERBATIM dan #ENDVERBATIM adalah kutipan persis; jangan diubah, dirapikan, atau diringkas. Keterangan saksi yang bertanda kutipan BAS dikutip sebagaimana tercatat.",
  ];

  return [
    baris("PERAN", KALIMAT_PERAN),
    baris("TUGAS", tugas),
    baris("DATA PERKARA (identitas disamarkan)", "", blokData.join("\n")),
    baris(
      "YANG DIMINTA",
      `${tugas}${meta?.kalimat ? ` ${meta.kalimat}` : ""}`,
      permintaanPertanyaan
    ),
    perintahPutusan && `RINCIAN PENYUSUNAN PUTUSAN\n\n${perintahPutusan}`,
    baris(
      "FORMAT JAWABAN",
      tujuan.format,
      "Tulis dalam bahasa Indonesia hukum yang baku. Pisahkan bagian dengan judul singkat. Tandai data yang kurang dengan [placeholder: ...]."
    ),
    baris("BATASAN", batasan.map((b) => `- ${b}`).join("\n")),
  ]
    .filter(Boolean)
    .join("\n\n");
}
