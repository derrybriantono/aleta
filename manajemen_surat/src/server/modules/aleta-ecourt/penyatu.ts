/**
 * ============================================================================
 * PENYATU SIPP - ABT - ALETA (TAHAP M2, 16 OKT 2026) - BACA SAJA
 * ============================================================================
 *
 * Kotak "Perkara ini di SIPP, ABT, dan ALETA" di halaman perkara SIPP
 * (ekstensi-sipp/sipp-ide-m2.js). Empat bagian:
 *
 *   1. Status blangko   penetapan, BAS, relaas, putusan: dibuat (ABT/ALETA),
 *                       ada di SIPP, diunggah (e-Doc).
 *   2. BAS belum diunggah   sidang yang sudah lewat tanpa e-Doc BAS, beserta
 *                       bukti BAS-nya sudah disusun (keterangan saksi ABT,
 *                       lembar BAS ALETA, validasi BAS ABT).
 *   3. Tugas perkara    apa yang harus dikerjakan peran akun ini untuk
 *                       perkara ini, lengkap dengan tempat mengerjakannya.
 *   4. Selisih 3 sumber data yang BERBEDA antara SIPP, ABT, dan ALETA/e-Court.
 *
 * Fakta mentah dikumpulkan bot (penyatuPerkaraService.js) dari SIPP, ABT, dan
 * basis data bot; di sini ditambah data ALETA di Postgres (lembar BAS, blangko
 * terbit, kamus variabel) lalu DITIMBANG oleh susunPenyatu - fungsi murni
 * yang diuji langsung.
 *
 * ============================================================================
 * ATURAN YANG SUDAH DIUKUR ATAS DATA SERVER 16 OKT (agregat, tanpa nama)
 * ============================================================================
 *
 *   - Tanggal putusan e-Court vs SIPP: 901 dari 901 sama; BHT 819 sama, 27
 *     hanya di SIPP (e-Court belum memuatnya) -> satu sisi = CATATAN, bukan
 *     selisih.
 *   - Nama "panitera" pada putusan e-Court adalah PANITERA penanda tangan,
 *     bukan panitera pengganti perkara: 769 dari 878 "berbeda" bila diadu -
 *     karena itu TIDAK dibandingkan (akan merah massal tanpa salah apa pun).
 *   - e-Doc penetapan baru ada sejak 2026 (2023-2025: 0 dari 2.370): e-Doc
 *     penetapan yang tidak ada pada perkara yang SUDAH PUTUS bukan tugas.
 *   - BAS di SIPP 99,5% terunggah tiap tahun; tugas hanya untuk sidang
 *     <= 120 hari, yang lebih lama hanya dihitung.
 *   - Tanda sidang ALETA vs jadwal SIPP: 5 dari 5 cocok. Keterangan saksi ABT
 *     pada sidang perkara lain: 18 dari 2.516 pasangan (0,7%).
 */
import { CERMIN_SIPP, kunciCerminSah } from "@/lib/kamus-sumber-abt";
import { type KunciPeran } from "@/lib/checklist-milestone-katalog";
import { namaAdaDi } from "@/lib/perkara-sendiri";
import { type AletaDatabase } from "@/server/db/client";

import { nilaiSippUntukCek } from "./kamus-sumber";
import { panggilBot, type HasilBot } from "./ecourt-aksi";

// ─────────────────────────────────────────────────────────────────────────────
// Bentuk fakta dari bot
// ─────────────────────────────────────────────────────────────────────────────
export type SidangSipp = {
  id: number;
  urutan: number;
  tanggal: string;
  agenda: string;
  ditunda: boolean;
  alasanDitunda: string;
  dihadiriOleh: string;
  ikrar: boolean;
  verzet: boolean;
  adaBas: boolean | null;
};
type Petugas = { nama: string; jabatan: string; urutan: number };
type GalatSumber = { sumber: "sipp" | "abt" | "aleta"; langkah: string; sebab: string };

export type FaktaBot = {
  ok: true;
  perkara: {
    perkaraId: number;
    nomorPerkara: string;
    jenisPerkara: string;
    alurPerkaraId: number;
    tanggalDaftar: string;
    tahapan: string;
    proses: string;
    ecourt: boolean | null;
  };
  sipp: {
    terbaca: boolean;
    sidang: SidangSipp[] | null;
    hakim: Petugas[] | null;
    pp: Petugas[] | null;
    js: Petugas[] | null;
    penetapan: {
      pmh: string;
      ppp: string;
      pjs: string;
      phs: string;
      /** Sidang pertama menurut JADWAL SIPP (MIN tanggal_sidang); cadangan perkara_penetapan.sidang_pertama. */
      sidangPertama: string;
      /** perkara_penetapan.sidang_pertama - tertimpa penetapan hari sidang yang baru. */
      sidangPertamaPenetapan?: string;
      /** Penetapan PERTAMA dari riwayat per tabel (sama dengan penanda L2); null bila tidak terbaca. */
      awal?: { pmh: string; ppp: string; pjs: string; phs: string } | null;
    } | null;
    edocPenetapan: { pmh: boolean; ppp: boolean; pjs: boolean; phs: boolean } | null;
    putusan: { ada: boolean; tanggal: string; statusNama: string; verstek?: boolean; adaEdoc: boolean; adaAnonim: boolean; minutasi: string; bht: string } | null;
    /** Pemberitahuan putusan terakhir per pihak (1 = Penggugat/Pemohon, 2 = Tergugat/Termohon); null bila tidak terbaca. */
    pemberitahuan?: { pihak1: string; pihak2: string } | null;
    /** Daftar saksi SIPP (perkara_pihak5) + jumlah tanya-jawab saksi di SIPP; null bila tidak terbaca. */
    saksi?: { daftar: Array<{ id: number; sisi: number }>; keterangan: number | null } | null;
    relaas: Array<{ sidangId: number; jumlah: number; berdokumen: number }> | null;
    mediasi: string[];
  };
  abt: {
    terbaca: boolean;
    saksi: Array<{ sidangId: number; tanyaJawab: number; saksi: number; saksiId?: number[]; terakhir: string }> | null;
    validasiBas: Array<{ sidangKe: number; tanggal: string; sah: boolean; divalidasi: string }> | null;
    isian: Array<{ kode: string; jenis: "teks" | "tanggal"; nilai: string }> | null;
  };
  aleta: {
    terbaca: boolean;
    ecourtPutusan?: {
      adaTab: boolean;
      adaPutusan: boolean;
      dokumenAda: boolean;
      tanggalPutusan: string;
      tanggalBht: string;
      diperiksa: string;
    } | null;
    tandaSidang: { selesai: string[] | null; berjalan: string[] | null; kehadiran: string[] | null };
    jejakPenetapan: Array<{ aksi: string; jenis: string; tanggal: string; waktu: string }> | null;
  };
  galat: GalatSumber[];
};

export type FaktaPortal = {
  lembar: Array<{ tanggalSidang: string; keadaan: string; diacc: boolean; kumpulan: string }> | null;
  terbit: { jumlah: number; terakhir: string } | null;
  isianAbt: Array<{ kode: string; label: string; nilaiAbt: string; nilaiSipp: string }> | null;
  /** Kalimat awam untuk Catatan. */
  galat: string[];
  /** Sebab teknisnya (tidak ditampilkan). */
  galatTeknis?: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Bentuk jawaban untuk ekstensi
// ─────────────────────────────────────────────────────────────────────────────
/** Tempat memperbaiki: tab halaman perkara SIPP, Blangko ABT, atau portal ALETA. */
export type Tempat =
  | { jenis: "tab"; tab: "tabs1" | "tabs2" | "tabs4" | "tabs10" | "tabs12" | "tabs23"; label: string }
  | { jenis: "abt"; label: string }
  | { jenis: "aleta"; label: string };

export type KeadaanBlangko = "lengkap" | "kurang" | "belum-waktunya" | "tidak-terbaca" | "selesai-lama";
export type BarisBlangko = { jenis: "penetapan" | "bas" | "relaas" | "putusan"; judul: string; keadaan: KeadaanBlangko; ringkas: string; rincian: string[] };
export type BasBelum = { sidangId: number; urutan: number; tanggal: string; agenda: string; bukti: string[] };
export type Tugas = { kode: string; peran: KunciPeran; untukAnda: boolean; judul: string; sebab: string; tempat: Tempat[] };
export type Selisih = {
  kode: string;
  tingkat: "merah" | "kuning";
  judul: string;
  nilai: { sipp?: string; abt?: string; aleta?: string; ecourt?: string };
  penjelasan: string;
  perbaiki: Tempat[];
};
export type JawabanPenyatu = {
  ok: true;
  perkara: { perkaraId: number; nomorPerkara: string; jenisPerkara: string; tahapan: string; ecourt: boolean | null };
  blangko: BarisBlangko[];
  ringkasBlangko: string;
  basBelum: BasBelum[];
  basLama: number;
  tugas: Tugas[];
  selisih: Selisih[];
  catatan: string[];
  /** Sebab teknis bagian yang gagal dibaca - untuk catatan server/Riwayat, TIDAK ditampilkan ke petugas. */
  galatTeknis: string[];
  sumber: { sipp: boolean; abt: boolean; aleta: boolean; portal: boolean };
  peran: KunciPeran[];
  hariIni: string;
};

export type MasukanSusun = {
  fakta: FaktaBot;
  portal: FaktaPortal;
  peran: KunciPeran[];
  namaAkun: string;
  hariIni: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Pembantu murni
// ─────────────────────────────────────────────────────────────────────────────
const BULAN_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** "2026-10-05" -> "5 Oktober 2026". */
export function tanggalAwam(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return String(iso || "") || "-";
  return `${Number(m[3])} ${BULAN_ID[Number(m[2]) - 1] || m[2]} ${m[1]}`;
}

function selisihHari(dari: string, sampai: string): number {
  const a = Date.parse(`${dari}T00:00:00Z`);
  const b = Date.parse(`${sampai}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86400000);
}

/** Pembanding nilai isian: huruf kecil, hanya huruf dan angka. */
export function bakuNilai(x: string): string {
  return String(x || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]/g, "");
}

/** "2026-10-01" + n hari -> "YYYY-MM-DD" (UTC, tanpa zona). */
function tambahHariIso(iso: string, n: number): string {
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(t)) return "";
  return new Date(t + n * 86400000).toISOString().slice(0, 10);
}

/** Alur gugatan SIPP (perkara contentiosa) - verstek hanya ada di sini. */
const ALUR_GUGATAN = 15;
/** Ambang "pemberitahuan verstek terlambat" penanda L2 (360 dari 385 verstek 2026 diberitahukan dalam 14 hari). */
const AMBANG_PEMBERITAHUAN_HARI = 14;
/** Tenggang verzet sejak pemberitahuan sah (Pasal 153 RBg / 129 HIR). */
const TENGGANG_VERZET_HARI = 14;

/** Batas sidang lewat yang masih menjadi tugas unggah BAS (hari). */
export const BATAS_TUGAS_BAS_HARI = 120;

const TAB = {
  dataUmum: { jenis: "tab", tab: "tabs1", label: "Buka tab Data Umum" },
  penetapan: { jenis: "tab", tab: "tabs2", label: "Buka tab Penetapan" },
  jadwal: { jenis: "tab", tab: "tabs4", label: "Buka tab Jadwal Sidang" },
  putusan: { jenis: "tab", tab: "tabs10", label: "Buka tab Putusan" },
  riwayat: { jenis: "tab", tab: "tabs12", label: "Buka tab Riwayat Perkara" },
  // Tab Saksi SIPP hanya ada bila perkara sudah punya saksi (detil_perkara_agama: $ada_data_saksi > 0).
  saksi: { jenis: "tab", tab: "tabs23", label: "Buka tab Saksi" },
} as const satisfies Record<string, Tempat>;
const ABT: Tempat = { jenis: "abt", label: "Buka di ABT" };
const ALETA: Tempat = { jenis: "aleta", label: "Buka di ALETA" };

const NAMA_PENETAPAN = { pmh: "PMH", ppp: "PPP", pjs: "PJS", phs: "PHS" } as const;
const PANJANG_PENETAPAN = {
  pmh: "Penetapan Majelis Hakim (PMH)",
  ppp: "Penunjukan Panitera Pengganti (PPP)",
  pjs: "Penunjukan Juru Sita (PJS)",
  phs: "Penetapan Hari Sidang (PHS)",
} as const;
type JenisPen = keyof typeof NAMA_PENETAPAN;
const JENIS_PEN: JenisPen[] = ["pmh", "ppp", "pjs", "phs"];
/** Siapa yang menetapkan/menunjuk tiap penetapan (penunjukan majelis PA Donggala). */
const PERAN_PENETAPAN: Record<JenisPen, KunciPeran> = { pmh: "ketua", ppp: "panitera", pjs: "panitera", phs: "hakim" };

// ─────────────────────────────────────────────────────────────────────────────
// Penimbang - MURNI
// ─────────────────────────────────────────────────────────────────────────────
export function susunPenyatu(m: MasukanSusun): JawabanPenyatu {
  const { fakta: f, portal, hariIni } = m;
  const s = f.sipp;
  const blangko: BarisBlangko[] = [];
  const basBelum: BasBelum[] = [];
  const tugas: Tugas[] = [];
  const selisih: Selisih[] = [];
  const catatan: string[] = [];
  const putus = Boolean(s.putusan && s.putusan.ada);
  let basLama = 0;

  // Siapa akun ini bagi perkara ini: peran portal + namanya tertulis di majelis/PP/JS SIPP.
  const nama = String(m.namaAkun || "").trim();
  const tertulis = (daftar: Petugas[] | null) => Boolean(nama && daftar && daftar.some((x) => namaAdaDi(nama, x.nama)));
  const milik: Partial<Record<KunciPeran, boolean>> = {
    hakim: tertulis(s.hakim),
    "panitera-pengganti": tertulis(s.pp),
    jurusita: tertulis(s.js),
  };
  const punya = (p: KunciPeran) => m.peran.includes(p);
  const untukAnda = (p: KunciPeran) =>
    p === "hakim" || p === "panitera-pengganti" || p === "jurusita" ? punya(p) && Boolean(milik[p]) : punya(p);
  const tambahTugas = (t: Omit<Tugas, "untukAnda">) => tugas.push({ ...t, untukAnda: untukAnda(t.peran) });

  const sidang = s.sidang || [];
  const lewat = sidang.filter((x) => x.tanggal && x.tanggal < hariIni);
  const sidangById = new Map(sidang.map((x) => [x.id, x]));
  const tanggalSipp = new Set(sidang.map((x) => x.tanggal).filter(Boolean));

  // ── 1. Penetapan ─────────────────────────────────────────────────────────
  if (!s.penetapan || !s.edocPenetapan) {
    blangko.push({ jenis: "penetapan", judul: "Penetapan (PMH, PPP, PJS, PHS)", keadaan: "tidak-terbaca", ringkas: "Belum terbaca dari SIPP.", rincian: [] });
  } else {
    const pen = s.penetapan;
    const edoc = s.edocPenetapan;
    const jejak = f.aleta.jejakPenetapan || [];
    const lewatAleta = (j: JenisPen) => jejak.some((x) => x.aksi === "tulis" && x.jenis === j);
    const edocAleta = (j: JenisPen) => jejak.some((x) => x.aksi === "unggah" && x.jenis === `edoc_${j}`);
    const ditetapkan = JENIS_PEN.filter((j) => pen[j]);
    const tanpaEdoc = ditetapkan.filter((j) => !edoc[j]);
    const awal = pen.awal || null;
    const rincian = JENIS_PEN.map((j) => {
      if (!pen[j]) return `${NAMA_PENETAPAN[j]}: belum ditetapkan di SIPP`;
      const asal = lewatAleta(j) ? " (ditulis lewat ALETA)" : "";
      const doc = edoc[j] ? `e-Doc ada${edocAleta(j) ? " (diunggah lewat ALETA dari blangko ABT)" : ""}` : "e-Doc belum ada";
      // Penetapan baru menimpa tanggal di SIPP; yang pertama tetap disebut (sama dengan penanda L2).
      const pertama = awal && awal[j] && awal[j] < pen[j] ? `${tanggalAwam(awal[j])} (pertama), terakhir ${tanggalAwam(pen[j])}` : tanggalAwam(pen[j]);
      return `${NAMA_PENETAPAN[j]}: ${pertama}${asal}, ${doc}`;
    });
    if (pen.sidangPertama) {
      const lain = pen.sidangPertamaPenetapan && pen.sidangPertamaPenetapan !== pen.sidangPertama;
      rincian.push(
        `Sidang pertama: ${tanggalAwam(pen.sidangPertama)}${lain ? ` (menurut jadwal sidang; isian sidang pertama di penetapan sudah tertimpa penetapan hari sidang yang baru: ${tanggalAwam(pen.sidangPertamaPenetapan || "")})` : ""}.`
      );
    }
    const semuaTanpaEdoc = ditetapkan.length > 0 && tanpaEdoc.length === ditetapkan.length;
    let keadaan: KeadaanBlangko;
    let ringkas: string;
    if (!ditetapkan.length) {
      keadaan = "kurang";
      ringkas = "Belum ada penetapan di SIPP.";
    } else if (!tanpaEdoc.length && ditetapkan.length === 4) {
      keadaan = "lengkap";
      ringkas = "Keempat penetapan sudah ada di SIPP beserta e-Doc-nya.";
    } else if (putus && semuaTanpaEdoc) {
      // Diukur 16 Okt: e-Doc penetapan baru dipakai sejak 2026 - perkara lama yang sudah putus tidak dituntut.
      keadaan = "selesai-lama";
      ringkas = "Perkara sudah putus; e-Doc penetapan tidak ada di SIPP (tidak lagi menjadi tugas).";
    } else {
      keadaan = "kurang";
      const kurangPen = JENIS_PEN.filter((j) => !pen[j]).map((j) => NAMA_PENETAPAN[j]);
      ringkas = [
        kurangPen.length ? `Belum ditetapkan: ${kurangPen.join(", ")}.` : "",
        tanpaEdoc.length ? `e-Doc belum diunggah: ${tanpaEdoc.map((j) => NAMA_PENETAPAN[j]).join(", ")}.` : "",
      ]
        .filter(Boolean)
        .join(" ");
    }
    blangko.push({ jenis: "penetapan", judul: "Penetapan (PMH, PPP, PJS, PHS)", keadaan, ringkas, rincian });

    if (!putus) {
      for (const j of JENIS_PEN) {
        // PHS menunggu PMH; PPP/PJS boleh lebih dulu.
        if (!pen[j] && (j !== "phs" || pen.pmh)) {
          tambahTugas({
            kode: `tetapkan-${j}`,
            peran: PERAN_PENETAPAN[j],
            judul: `${j === "pmh" || j === "phs" ? "Tetapkan" : "Tunjuk"} ${PANJANG_PENETAPAN[j]}`,
            sebab: `SIPP belum memuat ${NAMA_PENETAPAN[j]} perkara ini.`,
            tempat: [TAB.penetapan],
          });
        } else if (pen[j] && !edoc[j]) {
          tambahTugas({
            kode: `edoc-${j}`,
            peran: PERAN_PENETAPAN[j],
            judul: `Unggah e-Doc ${NAMA_PENETAPAN[j]}`,
            sebab: `${NAMA_PENETAPAN[j]} sudah ditetapkan ${tanggalAwam(pen[j])}, tetapi e-Doc-nya belum ada di SIPP. Blangkonya dapat diambil dari ABT (tombol Ambil dari ABT & upload di panel ALETA) atau diunggah lewat tombol Unggah di tab Penetapan SIPP.`,
            tempat: [TAB.penetapan],
          });
        }
      }
    }

    // Selisih: tanggal penetapan yang ditulis ALETA sudah diubah di SIPP sesudahnya.
    for (const j of JENIS_PEN) {
      const terakhir = jejak.find((x) => x.aksi === "tulis" && x.jenis === j && x.tanggal);
      if (terakhir && pen[j] && terakhir.tanggal !== pen[j]) {
        selisih.push({
          kode: `penetapan-${j}-tanggal`,
          tingkat: "kuning",
          judul: `Tanggal ${NAMA_PENETAPAN[j]} berbeda`,
          nilai: { sipp: tanggalAwam(pen[j]), aleta: tanggalAwam(terakhir.tanggal) },
          penjelasan: `ALETA pernah menulis ${PANJANG_PENETAPAN[j]} bertanggal ${tanggalAwam(terakhir.tanggal)} (${terakhir.waktu}), tetapi di SIPP sekarang tanggalnya ${tanggalAwam(pen[j])}. Kemungkinan diubah langsung di SIPP sesudahnya. Bila tanggal SIPP yang benar, tidak perlu apa-apa; blangko ABT selalu membaca tanggal dari SIPP.`,
          perbaiki: [TAB.penetapan, TAB.riwayat],
        });
      }
    }
  }

  // ── 2. BAS ───────────────────────────────────────────────────────────────
  const saksiAbt = new Map((f.abt.saksi || []).map((x) => [x.sidangId, x]));
  const lembar = portal.lembar || [];
  const validasi = f.abt.validasiBas || [];
  if (!s.sidang) {
    blangko.push({ jenis: "bas", judul: "BAS sidang", keadaan: "tidak-terbaca", ringkas: "Jadwal sidang belum terbaca dari SIPP.", rincian: [] });
  } else if (lewat.length && lewat.every((x) => x.adaBas === null)) {
    blangko.push({ jenis: "bas", judul: "BAS sidang", keadaan: "tidak-terbaca", ringkas: "Kolom e-Doc BAS tidak ada di SIPP ini.", rincian: [] });
  } else {
    for (const x of lewat) {
      if (x.adaBas !== false) continue;
      const umur = selisihHari(x.tanggal, hariIni);
      const bukti: string[] = [];
      const ks = saksiAbt.get(x.id);
      if (ks) bukti.push(`ABT: keterangan ${ks.saksi} saksi (${ks.tanyaJawab} tanya-jawab) sudah diisi`);
      const lb = lembar.filter((l) => l.tanggalSidang === x.tanggal);
      for (const l of lb) bukti.push(`ALETA: lembar BAS ${l.kumpulan || ""} ${l.diacc ? "sudah di-acc hakim" : l.keadaan === "selesai" ? "selesai, menunggu acc hakim" : "masih draf"}`.replace(/\s+/g, " "));
      const v = validasi.find((y) => y.sidangKe === x.urutan);
      if (v) bukti.push(`ABT: BAS ${v.sah ? `divalidasi hakim${v.divalidasi ? ` ${tanggalAwam(v.divalidasi)}` : ""}` : "diajukan, menunggu validasi hakim"}`);
      if (umur > BATAS_TUGAS_BAS_HARI) {
        basLama += 1;
        continue;
      }
      basBelum.push({ sidangId: x.id, urutan: x.urutan, tanggal: x.tanggal, agenda: x.agenda, bukti });
    }
    const ada = lewat.filter((x) => x.adaBas === true).length;
    const keadaan: KeadaanBlangko = !lewat.length ? "belum-waktunya" : basBelum.length ? "kurang" : basLama ? "selesai-lama" : "lengkap";
    const ringkas = !lewat.length
      ? "Belum ada sidang yang lewat."
      : `${ada} dari ${lewat.length} sidang yang sudah lewat punya e-Doc BAS di SIPP.${basBelum.length ? ` ${basBelum.length} belum diunggah.` : ""}${basLama ? ` ${basLama} sidang lama (lebih dari ${BATAS_TUGAS_BAS_HARI} hari) juga tanpa BAS.` : ""}`;
    const rincian = [
      ...(f.abt.saksi && f.abt.saksi.length ? [`ABT: keterangan saksi tercatat pada ${f.abt.saksi.length} sidang.`] : []),
      ...(f.abt.saksi && f.abt.saksi.length && s.saksi && s.saksi.keterangan === 0
        ? [`SIPP: daftar saksi ${s.saksi.daftar.length} orang; tanya-jawab saksi tidak disimpan di SIPP (BAS dan putusan memakai tanya-jawab dari ABT).`]
        : []),
      ...(lembar.length ? [`ALETA: ${lembar.length} lembar BAS.`] : []),
      ...(validasi.length ? [`ABT: ${validasi.length} BAS diajukan validasi (${validasi.filter((v) => v.sah).length} sah).`] : []),
    ];
    blangko.push({ jenis: "bas", judul: "BAS sidang", keadaan, ringkas, rincian });

    if (basBelum.length) {
      const sebut = basBelum.slice(0, 3).map((b) => tanggalAwam(b.tanggal));
      const adaBuktiAbt = basBelum.some((b) => b.bukti.some((t) => t.startsWith("ABT")));
      tambahTugas({
        kode: "unggah-bas",
        peran: "panitera-pengganti",
        judul: basBelum.length === 1 ? `Unggah BAS sidang ${sebut[0]}` : `Unggah BAS ${basBelum.length} sidang (${sebut.join(", ")}${basBelum.length > 3 ? ", …" : ""})`,
        sebab: `SIPP menulis "Dokumen Belum Ada" pada sidang itu.${adaBuktiAbt ? " BAS-nya sudah disusun di ABT - tinggal dicetak lalu diunggah." : ""}`,
        tempat: adaBuktiAbt ? [TAB.jadwal, ABT] : [TAB.jadwal],
      });
    }

    // Selisih ABT: keterangan saksi tersimpan pada sidang yang tidak ada di jadwal perkara ini.
    const yatim = (f.abt.saksi || []).filter((k) => !sidangById.has(k.sidangId));
    if (yatim.length) {
      selisih.push({
        kode: "abt-saksi-sidang",
        tingkat: "kuning",
        judul: "Keterangan saksi ABT tercatat pada sidang yang tidak ada di jadwal SIPP perkara ini",
        nilai: { abt: `${yatim.length} sidang (${yatim.reduce((a, k) => a + k.tanyaJawab, 0)} tanya-jawab)`, sipp: `${sidang.length} sidang di jadwal` },
        penjelasan:
          "Tanya-jawab saksi di ABT disimpan per sidang. Sebagian tersimpan pada sidang yang tidak ada (lagi) di jadwal SIPP perkara ini - jadwalnya dihapus atau diganti, atau tersimpan di sidang perkara lain. Blangko BAS sidang yang benar tidak akan memuat keterangan itu. Periksa di ABT (tab Tanya Jawab perkara) dan pindahkan ke sidang yang benar.",
        perbaiki: [ABT, TAB.jadwal],
      });
    }
    // Selisih ABT vs SIPP: keterangan saksi ABT untuk saksi yang tidak (lagi) terdaftar di daftar saksi SIPP
    // (perkara_pihak5; ABT menyimpan saksi_id = perkara_pihak5.id). Diukur 17 Okt atas server: 2026 = 31 dari 552
    // perkara berketerangan saksi ABT (3 belum putus); 2022-2026 = 132 dari 2.329 (SIPP + ABT, baca saja). Tanya-jawab saksi SIPP
    // (perkara_keterangan_saksi) TIDAK dijadikan selisih - 4 baris untuk seluruh register, akan kuning di semua perkara.
    const daftarSaksi = s.saksi ? s.saksi.daftar : null;
    const dariAbt = (f.abt.saksi || []).filter((k) => sidangById.has(k.sidangId));
    if (daftarSaksi && dariAbt.length) {
      const terdaftar = new Set(daftarSaksi.map((x) => x.id));
      const idAbt = [...new Set(dariAbt.flatMap((k) => k.saksiId || []))];
      const tak = idAbt.filter((id) => !terdaftar.has(id));
      const tj = dariAbt.reduce((a, k) => a + k.tanyaJawab, 0);
      const jumlahAbt = idAbt.length || dariAbt.reduce((a, k) => Math.max(a, k.saksi), 0);
      if (!daftarSaksi.length) {
        selisih.push({
          kode: "saksi-sipp-kosong",
          tingkat: "kuning",
          judul: "Keterangan saksi ada di ABT, SIPP mencatat 0 saksi",
          nilai: { abt: `keterangan ${jumlahAbt} saksi (${tj} tanya-jawab)`, sipp: "0 saksi di daftar saksi perkara" },
          penjelasan:
            "Tanya-jawab saksi sudah diisi di ABT, tetapi daftar saksi perkara ini di SIPP masih kosong. Nama dan identitas saksi pada BAS dan putusan diambil dari daftar saksi SIPP, jadi akan tercetak kosong. Tambahkan saksinya di SIPP lewat tombol \"Saksi Yang Dihadirkan\" di bagian atas halaman perkara, lalu periksa kembali tanya-jawabnya di ABT.",
          perbaiki: [TAB.dataUmum, ABT],
        });
      } else if (tak.length) {
        selisih.push({
          kode: "saksi-tak-terdaftar",
          tingkat: "kuning",
          judul: `Keterangan ${tak.length} saksi di ABT tidak cocok dengan daftar saksi SIPP`,
          nilai: { abt: `keterangan ${idAbt.length} saksi (${tj} tanya-jawab)`, sipp: `${daftarSaksi.length} saksi di daftar; ${tak.length} saksi ABT tidak ada di daftar itu` },
          penjelasan:
            "Sebagian tanya-jawab saksi di ABT tersimpan atas saksi yang tidak (lagi) ada di daftar saksi SIPP perkara ini - saksinya dihapus atau dimasukkan ulang di SIPP sesudah tanya-jawab diisi. Blangko BAS dan putusan tidak akan memuat keterangan saksi itu. Periksa daftar saksi di tab Saksi SIPP, lalu pindahkan atau isi ulang tanya-jawabnya di ABT untuk saksi yang benar.",
          perbaiki: [TAB.saksi, ABT],
        });
      }
    }
    // Selisih ALETA: lembar BAS bertanggal yang tidak ada di jadwal SIPP.
    const lembarAsing = lembar.filter((l) => l.tanggalSidang && !tanggalSipp.has(l.tanggalSidang));
    if (lembarAsing.length) {
      selisih.push({
        kode: "bas-aleta-tanggal",
        tingkat: "kuning",
        judul: "Lembar BAS ALETA bertanggal sidang yang tidak ada di SIPP",
        nilai: { aleta: lembarAsing.map((l) => tanggalAwam(l.tanggalSidang)).join(", "), sipp: "tidak ada sidang pada tanggal itu" },
        penjelasan: "Lembar BAS di ALETA disusun untuk tanggal sidang yang tidak tercatat di jadwal SIPP. Bisa jadi sidangnya ditunda ke tanggal lain atau jadwalnya diubah sesudah lembar dibuat.",
        perbaiki: [TAB.jadwal, ALETA],
      });
    }
    // Selisih ABT: tanggal sidang di validasi BAS ABT berbeda dengan jadwal SIPP untuk sidang ke- yang sama.
    for (const v of validasi) {
      const x = sidang.find((y) => y.urutan === v.sidangKe);
      if (x && v.tanggal && x.tanggal && v.tanggal !== x.tanggal) {
        selisih.push({
          kode: `abt-validasi-${v.sidangKe}`,
          tingkat: "kuning",
          judul: `Tanggal sidang ke-${v.sidangKe} berbeda antara ABT dan SIPP`,
          nilai: { abt: tanggalAwam(v.tanggal), sipp: tanggalAwam(x.tanggal) },
          penjelasan: "BAS yang diajukan validasi di ABT mencatat tanggal sidang yang lain dari jadwal SIPP. Blangko BAS mencetak tanggal dari SIPP; pastikan BAS yang divalidasi memang BAS sidang itu.",
          perbaiki: [ABT, TAB.jadwal],
        });
      }
    }
  }

  // Selisih ALETA: hari sidang yang dicatat ruang sidang ALETA tidak ada di jadwal (sidang maupun mediasi) SIPP.
  const tanda = f.aleta.tandaSidang;
  const hariAleta = new Set([...(tanda.selesai || []), ...(tanda.berjalan || []), ...(tanda.kehadiran || [])]);
  const mediasi = new Set(s.mediasi || []);
  if (s.sidang) {
    const asing = [...hariAleta].filter((t) => !tanggalSipp.has(t) && !mediasi.has(t)).sort();
    if (asing.length) {
      selisih.push({
        kode: "sidang-tanggal",
        tingkat: "merah",
        judul: "Tanggal sidang berbeda: ALETA mencatat sidang yang tidak ada di jadwal SIPP",
        nilai: { aleta: asing.map(tanggalAwam).join(", "), sipp: sidang.length ? `jadwal SIPP: ${sidang.slice(-3).map((x) => tanggalAwam(x.tanggal)).join(", ")}` : "belum ada jadwal" },
        penjelasan:
          "Ruang sidang ALETA (antrian, tanda sidang berjalan/selesai) mencatat perkara ini disidangkan pada tanggal itu, tetapi jadwal sidang SIPP tidak memuatnya. Biasanya jadwal SIPP belum ditunda/diubah ke hari sidang yang sebenarnya. Perbaiki lewat Tunda atau Edit jadwal di tab Jadwal Sidang.",
        perbaiki: [TAB.jadwal],
      });
    }
  }

  // ── 3. Relaas ────────────────────────────────────────────────────────────
  if (!s.relaas) {
    blangko.push({ jenis: "relaas", judul: "Relaas panggilan", keadaan: "tidak-terbaca", ringkas: "Data relaas belum terbaca dari SIPP.", rincian: [] });
  } else {
    const total = s.relaas.reduce((a, r) => a + r.jumlah, 0);
    const berdok = s.relaas.reduce((a, r) => a + r.berdokumen, 0);
    const tanpa = s.relaas.filter((r) => r.berdokumen < r.jumlah);
    blangko.push({
      jenis: "relaas",
      judul: "Relaas panggilan",
      keadaan: !total ? "belum-waktunya" : berdok < total ? (putus ? "selesai-lama" : "kurang") : "lengkap",
      ringkas: !total ? "Belum ada relaas tercatat di SIPP." : `${berdok} dari ${total} relaas punya berkas di SIPP.`,
      rincian: tanpa.map((r) => {
        const x = sidangById.get(r.sidangId);
        return `${x ? `Sidang ${tanggalAwam(x.tanggal)}` : "Sidang lain"}: ${r.jumlah - r.berdokumen} relaas tanpa berkas`;
      }),
    });
    if (tanpa.length && !putus) {
      tambahTugas({
        kode: "unggah-relaas",
        peran: "jurusita",
        judul: `Unggah berkas relaas (${tanpa.reduce((a, r) => a + r.jumlah - r.berdokumen, 0)})`,
        sebab: "Relaas sudah dicatat di SIPP tetapi berkas relaasnya belum diunggah (Data Relaas di tab Jadwal Sidang).",
        tempat: [TAB.jadwal],
      });
    }
  }

  // ── 4. Putusan ───────────────────────────────────────────────────────────
  const ec = f.aleta.ecourtPutusan;
  if (!s.putusan) {
    blangko.push({ jenis: "putusan", judul: "Putusan", keadaan: "tidak-terbaca", ringkas: "Data putusan belum terbaca dari SIPP.", rincian: [] });
  } else if (!putus) {
    blangko.push({
      jenis: "putusan",
      judul: "Putusan",
      keadaan: "belum-waktunya",
      ringkas: "Belum putus.",
      rincian: portal.terbit && portal.terbit.jumlah ? [`ALETA: ${portal.terbit.jumlah} blangko diterbitkan (terakhir ${portal.terbit.terakhir}).`] : [],
    });
  } else {
    const pu = s.putusan;
    const kurang = [!pu.adaEdoc ? "e-Doc putusan" : "", !pu.adaAnonim ? "e-Doc putusan anonimisasi" : ""].filter(Boolean);
    const rincian = [
      `Diputus ${tanggalAwam(pu.tanggal)}${pu.statusNama ? ` - ${pu.statusNama}` : ""}.`,
      `e-Doc putusan ${pu.adaEdoc ? "ada" : "belum ada"}; anonimisasi ${pu.adaAnonim ? "ada" : "belum ada"}.`,
      pu.minutasi ? `Minutasi ${tanggalAwam(pu.minutasi)}.` : "Belum minutasi.",
      ...(ec && ec.adaPutusan ? [`e-Court: putusan ${ec.dokumenAda ? "sudah diunggah" : "tercatat tanpa dokumen"}.`] : []),
      ...(portal.terbit && portal.terbit.jumlah ? [`ALETA: ${portal.terbit.jumlah} blangko diterbitkan (terakhir ${portal.terbit.terakhir}).`] : []),
    ];
    blangko.push({
      jenis: "putusan",
      judul: "Putusan",
      keadaan: kurang.length ? "kurang" : "lengkap",
      ringkas: kurang.length ? `Belum diunggah: ${kurang.join(" dan ")}.` : "Putusan dan anonimisasinya sudah diunggah ke SIPP.",
      rincian,
    });
    // Verstek (keputusan pengguna 16 Okt, sama dengan penanda L2 "Menunggu pemberitahuan"): putusan
    // dibacakan, lalu DIBERITAHUKAN kepada tergugat/termohon; tenggang verzet 14 hari dihitung sejak hari
    // sesudah pemberitahuan sah, jadi BHT = pemberitahuan + 15 hari. BHT tidak dihitung dari tanggal putus.
    if (f.perkara.alurPerkaraId === ALUR_GUGATAN && pu.verstek && !pu.bht && s.pemberitahuan !== undefined) {
      const lawan = /talak/i.test(f.perkara.jenisPerkara) ? "Termohon" : "Tergugat";
      const pbt = s.pemberitahuan ? s.pemberitahuan.pihak2 : "";
      const sejak = selisihHari(pu.tanggal, hariIni);
      if (!s.pemberitahuan) {
        rincian.push("Pemberitahuan putusan verstek belum dapat dibaca dari SIPP.");
      } else if (!pbt) {
        rincian.push(`Putusan verstek: belum diberitahukan kepada ${lawan} (${sejak} hari sejak dibacakan).`);
        tambahTugas({
          kode: "pemberitahuan-verstek",
          peran: "jurusita",
          judul: sejak >= AMBANG_PEMBERITAHUAN_HARI ? `Pemberitahuan putusan verstek (sudah ${sejak} hari)` : "Pemberitahuan putusan verstek",
          sebab:
            `Putusan verstek ${tanggalAwam(pu.tanggal)} (${sejak} hari lalu) belum tercatat diberitahukan kepada ${lawan}. ` +
            `Tenggang verzet 14 hari menuju BHT baru berjalan sejak pemberitahuan sah; catat relaas pemberitahuannya di tab Putusan SIPP.`,
          tempat: [TAB.putusan],
        });
      } else {
        const bht = tambahHariIso(pbt, TENGGANG_VERZET_HARI + 1);
        rincian.push(
          `Putusan verstek diberitahukan kepada ${lawan} ${tanggalAwam(pbt)}; tenggang verzet 14 hari berakhir ${tanggalAwam(tambahHariIso(pbt, TENGGANG_VERZET_HARI))}, BHT ${bht <= hariIni ? "jatuh" : "diperkirakan"} ${tanggalAwam(bht)} bila tidak ada verzet.`
        );
      }
    }
    for (const [kode, judul, adaKah] of [
      ["edoc-putusan", "Unggah e-Doc putusan", pu.adaEdoc],
      ["edoc-anonim", "Unggah e-Doc putusan anonimisasi", pu.adaAnonim],
    ] as const) {
      if (adaKah) continue;
      tambahTugas({
        kode,
        peran: "hakim",
        judul,
        sebab: `Perkara diputus ${tanggalAwam(pu.tanggal)}; SIPP menulis "Belum Di Upload". Unggah lewat tab Putusan (Unggah E-Doc) atau Putusan otomatis ALETA.`,
        tempat: [TAB.putusan],
      });
    }
  }

  // Selisih e-Court vs SIPP (putusan).
  if (ec === undefined) {
    // tidak terbaca - disebut di catatan sumber
  } else if (ec && s.putusan) {
    const pu = s.putusan;
    if (ec.adaPutusan && !pu.ada) {
      selisih.push({
        kode: "putusan-belum-sipp",
        tingkat: "merah",
        judul: "Status putusan berbeda: e-Court sudah putus, SIPP belum",
        nilai: { ecourt: ec.tanggalPutusan ? `diputus ${tanggalAwam(ec.tanggalPutusan)}` : "putusan ada", sipp: "belum ada tanggal putusan" },
        penjelasan: "Putusan perkara ini sudah tercatat di e-Court (dibaca ALETA), tetapi SIPP belum memuat tanggal putusannya. Isi jendela Putusan Akhir di tab Putusan (tombol Isi dengan ALETA dapat membantu).",
        perbaiki: [TAB.putusan, ALETA],
      });
      tambahTugas({
        kode: "isi-putusan",
        peran: "hakim",
        judul: "Isi Putusan Akhir di SIPP",
        sebab: "e-Court sudah memuat putusan perkara ini; SIPP belum.",
        tempat: [TAB.putusan],
      });
    }
    if (ec.adaPutusan && pu.ada && ec.tanggalPutusan && ec.tanggalPutusan !== pu.tanggal) {
      selisih.push({
        kode: "putusan-tanggal",
        tingkat: "merah",
        judul: "Tanggal putusan berbeda antara SIPP dan e-Court",
        nilai: { sipp: tanggalAwam(pu.tanggal), ecourt: tanggalAwam(ec.tanggalPutusan) },
        penjelasan: "Tanggal putusan di SIPP tidak sama dengan yang tertulis di e-Court. Salah satunya keliru; tanggal di naskah putusan yang ditandatangani yang benar.",
        perbaiki: [TAB.putusan, ALETA],
      });
    }
    if (ec.tanggalBht && pu.bht && ec.tanggalBht !== pu.bht) {
      selisih.push({
        kode: "bht-tanggal",
        tingkat: "merah",
        judul: "Tanggal BHT berbeda antara SIPP dan e-Court",
        nilai: { sipp: tanggalAwam(pu.bht), ecourt: tanggalAwam(ec.tanggalBht) },
        penjelasan: "Tanggal berkekuatan hukum tetap (BHT) di SIPP tidak sama dengan e-Court. Tanggal BHT SIPP diketik tangan di Data Umum.",
        perbaiki: [TAB.dataUmum, ALETA],
      });
    } else if (pu.bht && !ec.tanggalBht && ec.adaPutusan) {
      catatan.push(`BHT ${tanggalAwam(pu.bht)} sudah ada di SIPP; e-Court belum menampilkannya (terakhir dibaca ${ec.diperiksa || "-"}).`);
    }
    if (ec.dokumenAda && pu.ada && !pu.adaEdoc) {
      selisih.push({
        kode: "edoc-putusan",
        tingkat: "kuning",
        judul: "Berkas putusan: ada di e-Court, belum ada di e-Doc SIPP",
        nilai: { ecourt: "dokumen putusan ada", sipp: "e-Doc putusan belum ada" },
        penjelasan: "Naskah putusan sudah diunggah ke e-Court, tetapi e-Doc putusan di SIPP masih kosong. Unggah naskah yang sama di tab Putusan.",
        perbaiki: [TAB.putusan],
      });
    }
    if (pu.ada && f.perkara.ecourt && ec.adaTab && !ec.adaPutusan) {
      const sesudah = ec.diperiksa && ec.diperiksa.slice(0, 10) > pu.tanggal;
      if (sesudah) {
        selisih.push({
          kode: "putusan-belum-ecourt",
          tingkat: "kuning",
          judul: "Status putusan berbeda: SIPP sudah putus, e-Court belum",
          nilai: { sipp: `diputus ${tanggalAwam(pu.tanggal)}`, ecourt: `belum ada putusan (dibaca ${ec.diperiksa})` },
          penjelasan: "Perkara e-Court ini sudah diputus di SIPP, tetapi saat ALETA terakhir membaca e-Court putusannya belum diunggah ke sana. Unggah putusan ke e-Court (panel ALETA: Upload putusan ke e-Court).",
          perbaiki: [ALETA],
        });
      } else {
        catatan.push(`Data putusan e-Court terakhir dibaca ${ec.diperiksa || "-"}, sebelum tanggal putusan - belum dapat dibandingkan.`);
      }
    }
  }

  // Selisih isian tangan ABT vs SIPP (variabel manual yang mencerminkan data inti SIPP).
  for (const x of portal.isianAbt || []) {
    selisih.push({
      kode: `abt-isian-${x.kode}`,
      tingkat: "kuning",
      judul: `${x.label}: isian ABT berbeda dari SIPP`,
      nilai: { abt: x.nilaiAbt, sipp: x.nilaiSipp },
      penjelasan: `Isian yang diketik di ABT untuk perkara ini berbunyi lain dari data SIPP. Blangko yang memakai variabel ini akan mencetak isian ABT, bukan data SIPP. Ubah isiannya di Blangko ABT (atau kosongkan agar mengikuti SIPP), atau perbaiki SIPP bila SIPP yang keliru.`,
      perbaiki: [ABT, TAB.dataUmum],
    });
  }

  // ── Sumber yang tidak terbaca disebut, bukan disembunyikan ────────────────
  // Kalimat awam di layar; sebab teknisnya hanya di galatTeknis (tidak ditampilkan ekstensi).
  const namaSumber = { sipp: "SIPP", abt: "ABT", aleta: "ALETA" } as const;
  const galatTeknis: string[] = [];
  for (const g of f.galat || []) {
    catatan.push(`${namaSumber[g.sumber] || g.sumber}: data ${g.langkah} belum dapat dibaca saat ini - bagian itu belum dapat dibandingkan.`);
    galatTeknis.push(`${g.sumber}/${g.langkah}: ${g.sebab}`);
  }
  for (const g of portal.galat || []) catatan.push(`ALETA: ${g}`);
  galatTeknis.push(...(portal.galatTeknis || []));

  const berlaku = blangko.filter((b) => b.keadaan !== "tidak-terbaca" && b.keadaan !== "belum-waktunya");
  const lengkap = berlaku.filter((b) => b.keadaan === "lengkap" || b.keadaan === "selesai-lama").length;
  const ringkasBlangko = berlaku.length ? `${lengkap} dari ${berlaku.length} lengkap` : "Belum ada yang perlu dibuat";

  // Urutan tugas: untuk Anda dulu.
  tugas.sort((a, b) => Number(b.untukAnda) - Number(a.untukAnda));
  selisih.sort((a, b) => (a.tingkat === b.tingkat ? 0 : a.tingkat === "merah" ? -1 : 1));

  return {
    ok: true,
    perkara: { perkaraId: f.perkara.perkaraId, nomorPerkara: f.perkara.nomorPerkara, jenisPerkara: f.perkara.jenisPerkara, tahapan: f.perkara.tahapan, ecourt: f.perkara.ecourt },
    blangko,
    ringkasBlangko,
    basBelum,
    basLama,
    tugas,
    selisih,
    catatan,
    galatTeknis,
    sumber: { sipp: f.sipp.terbaca, abt: f.abt.terbaca, aleta: f.aleta.terbaca, portal: !(portal.galat || []).length },
    peran: m.peran,
    hariIni,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pembaca (bot + Postgres)
// ─────────────────────────────────────────────────────────────────────────────
export function faktaBot({ nomor, perkaraId }: { nomor: string; perkaraId?: string }): Promise<HasilBot<FaktaBot | { ok: false; alasan: string; sebab?: string }>> {
  const q = new URLSearchParams();
  if (nomor) q.set("nomor", nomor);
  if (perkaraId) q.set("perkaraId", perkaraId);
  return panggilBot(`/penyatu/perkara?${q.toString()}`, { batasMs: 20000 });
}

const teks = (x: unknown) => String(x ?? "").trim();

/**
 * Data ALETA di Postgres untuk satu perkara. Tiap pembacaan yang gagal disebut
 * di `galat` - bagian itu null, bukan kosong.
 */
export async function faktaPortal(db: AletaDatabase, fakta: FaktaBot): Promise<FaktaPortal> {
  const galat: string[] = [];
  const teknis: string[] = [];
  const id = String(fakta.perkara.perkaraId);
  let lembar: FaktaPortal["lembar"] = null;
  try {
    const b = await db.queryAll<Record<string, unknown>>(
      "SELECT tanggal_sidang, keadaan, diacc_at, nama_kumpulan FROM aleta_bas_lembar WHERE perkara_id = ?",
      [id]
    );
    lembar = b.map((r) => ({ tanggalSidang: teks(r.tanggal_sidang).slice(0, 10), keadaan: teks(r.keadaan), diacc: Boolean(teks(r.diacc_at)), kumpulan: teks(r.nama_kumpulan) }));
  } catch (e) {
    galat.push("lembar BAS belum dapat dibaca saat ini.");
    teknis.push(`aleta_bas_lembar: ${e instanceof Error ? e.message : String(e)}`);
  }
  let terbit: FaktaPortal["terbit"] = null;
  try {
    const b = await db.queryAll<Record<string, unknown>>("SELECT pada FROM aleta_blangko_terbit WHERE perkara_id = ?", [id]);
    const waktu = b.map((r) => teks(r.pada)).sort();
    terbit = { jumlah: b.length, terakhir: waktu.length ? waktu[waktu.length - 1].slice(0, 10) : "" };
  } catch (e) {
    galat.push("catatan blangko yang diterbitkan belum dapat dibaca saat ini.");
    teknis.push(`aleta_blangko_terbit: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Isian tangan ABT yang mencerminkan data inti SIPP (kamus: status manual + cermin_sipp).
  let isianAbt: FaktaPortal["isianAbt"] = [];
  const isian = fakta.abt.isian || [];
  if (isian.length) {
    try {
      const kamus = await db.queryAll<Record<string, unknown>>(
        "SELECT no_var, cermin_sipp FROM aleta_kamus_variabel WHERE cermin_sipp <> '' AND status = 'manual'"
      );
      const cermin = new Map(kamus.map((k) => [teks(k.no_var), teks(k.cermin_sipp)]));
      const calon = isian.filter((x) => cermin.has(x.kode) && x.nilai);
      if (calon.length) {
        const cek = await nilaiSippUntukCek(db, { perkaraId: id, kode: calon.map((x) => x.kode).join(",") });
        for (const b of cek.butir) {
          const abt = calon.find((x) => x.kode === b.kode);
          if (!abt || !b.terbaca || !b.nilaiSipp) continue;
          if (bakuNilai(abt.nilai) === bakuNilai(b.nilaiSipp)) continue;
          const k = kunciCerminSah(b.cermin);
          isianAbt.push({ kode: b.kode, label: k ? CERMIN_SIPP[k] : b.label || b.nama, nilaiAbt: abt.nilai, nilaiSipp: b.nilaiSipp });
        }
      }
    } catch (e) {
      isianAbt = null;
      galat.push("isian ABT belum dapat dibandingkan dengan SIPP saat ini.");
      teknis.push(`isian ABT: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { lembar, terbit, isianAbt, galat, galatTeknis: teknis };
}
