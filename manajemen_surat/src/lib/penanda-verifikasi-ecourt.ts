/**
 * ============================================================================
 * PENANDA VERIFIKASI MAJELIS - PERKARA E-LITIGASI HARI INI (5 Okt 2026, butir 30)
 * ============================================================================
 *
 * SATU penanda di samping nomor perkara, empat keadaan:
 *
 *   sudah        hijau  tidak ada dokumen persidangan yang menunggu verifikasi
 *   belum        kuning ada dokumen yang menunggu verifikasi majelis
 *   belum-upload jingga agenda menuntut dokumen pihak (jawaban/replik/duplik/
 *                       kesimpulan) tetapi sejak sidang sebelumnya belum ada
 *                       dokumen persidangan yang diunggah (6 Okt 2026)
 *   tidak-konek  abu    data e-Court tidak terbaca / bot tidak tersambung /
 *                       sesi e-Court habis
 *
 * Hanya baris yang SIDANGNYA e-Litigasi - aturan yang sama dengan penanda
 * e-Litigasi Jadwal Sidang (sidangElitigasi: terdaftar e-Court, bukan sidang
 * pertama, agendanya tahapan yang dipertukarkan elektronik) - pada perkara
 * GUGATAN yang bersidang HARI INI. Sampai 6 Okt 2026 syaratnya hanya
 * "terdaftar e-Court", sehingga sidang pembuktian/ikrar yang dihadiri di ruang
 * sidang pun mendapat "sudah diverifikasi". Perkara permohonan tidak melewati
 * verifikasi majelis atas dokumen persidangan. Datanya simpanan bot (GET /ecourt/verifikasi-hari-ini), bukan
 * tarikan e-Court saat halaman dimuat.
 */

import { sidangElitigasi } from "@/lib/keadaan-sidang";

export type KeadaanVerifikasi = "sudah" | "belum" | "belum-upload" | "tidak-konek";

export type VerifikasiPerkara = {
  perkaraId?: string;
  nomorPerkara: string;
  keadaan: KeadaanVerifikasi;
  belumDiperiksa?: boolean;
  menunggu: number;
  dokumen: number;
  terakhirDiperiksa: string;
  diverifikasiOleh: string[];
  /** Tanggal sidang sebelumnya (YYYY-MM-DD) dan unggahan sesudahnya - keadaan belum-upload. */
  sidangLalu?: string;
  unggahSejakSidangLalu?: number;
  /**
   * 13 Okt 2026: awal babak agenda (sidang yang ditunda dengan agenda yang
   * sama dilompati) dan jenis dokumen e-Court yang dituntut agenda itu.
   */
  awalBabak?: string;
  jenisDituntut?: string[];
};

/** "Jawaban", "Replik/Rereplik" - jenis dokumen yang dituntut, untuk keterangan. */
function sebutJenis(jenis: string[] | undefined): string {
  const daftar = (jenis ?? []).map((j) => String(j || "").trim()).filter(Boolean);
  return daftar.map((j) => j.charAt(0).toUpperCase() + j.slice(1)).join("/");
}

export type DataVerifikasi = {
  /** Jawaban bot terbaca. false = bot/rute tidak tersambung -> semua tidak konek. */
  terbaca: boolean;
  tanggal: string;
  perkara: Record<string, VerifikasiPerkara>;
  penarik?: { tersambung: boolean; alasan: string; berhentiHariIni: boolean; terakhirPutaran: string };
  alasan?: string;
};

export const DATA_VERIFIKASI_KOSONG: DataVerifikasi = { terbaca: false, tanggal: "", perkara: {} };

const POLA_GUGATAN = /\/Pdt\.G(\.S)?\//i;

/** Kunci pencocokan nomor perkara - huruf besar, tanpa spasi. */
function kunciNomor(nomor: string): string {
  return String(nomor || "").replace(/\s+/g, "").toUpperCase();
}

export type Penanda = {
  keadaan: KeadaanVerifikasi;
  label: string;
  kelas: string;
  keterangan: string;
};

const LABEL: Record<KeadaanVerifikasi, string> = {
  sudah: "sudah diverifikasi",
  belum: "belum diverifikasi",
  "belum-upload": "belum upload",
  "tidak-konek": "tidak konek",
};

const KELAS: Record<KeadaanVerifikasi, string> = {
  sudah: "bg-emerald-600 text-white",
  belum: "bg-amber-400 text-amber-950",
  "belum-upload": "bg-orange-600 text-white",
  "tidak-konek": "bg-slate-300 text-slate-800 dark:bg-slate-600 dark:text-slate-100",
};

function jamMenit(waktu: string): string {
  const c = /(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/.exec(String(waktu || ""));
  return c ? `${c[2]}:${c[3]}` : "";
}

/**
 * Penanda untuk satu baris jadwal - null bila baris itu tidak diberi penanda
 * (bukan e-Litigasi, bukan gugatan, atau bukan sidang hari ini).
 */
export function penandaVerifikasi(
  baris: { nomorPerkara: string; tanggalSidang: string; lewatEcourt?: boolean; agenda?: string; urutanSidang?: number },
  data: DataVerifikasi,
  hariIni: string
): Penanda | null {
  if (!baris.lewatEcourt) return null;
  // Hanya sidang e-Litigasi - satu aturan dengan penanda e-Litigasi di tabel.
  if (!sidangElitigasi(baris)) return null;
  if (!POLA_GUGATAN.test(String(baris.nomorPerkara || ""))) return null;
  if (!hariIni || String(baris.tanggalSidang || "").slice(0, 10) !== hariIni) return null;

  let item: VerifikasiPerkara | undefined;
  if (data.terbaca && data.tanggal === hariIni) {
    const k = kunciNomor(baris.nomorPerkara);
    item = Object.values(data.perkara).find((p) => kunciNomor(p.nomorPerkara) === k);
  }
  const keadaan: KeadaanVerifikasi = item ? item.keadaan : "tidak-konek";

  const bagian: string[] = [];
  if (!data.terbaca) {
    bagian.push(`Data verifikasi e-Court tidak terbaca${data.alasan ? ` (${data.alasan})` : ""}.`);
  } else if (!item) {
    bagian.push("Perkara ini belum terbaca sebagai e-Litigasi di data e-Court ALETA.");
  } else if (item.keadaan === "belum") {
    bagian.push(`${item.menunggu} dokumen persidangan menunggu verifikasi majelis.`);
  } else if (item.keadaan === "belum-upload" && item.jenisDituntut?.length) {
    const sejak = item.awalBabak || item.sidangLalu;
    bagian.push(
      `Pihak belum mengunggah dokumen ${sebutJenis(item.jenisDituntut)} di e-Court${
        sejak ? ` sejak sidang ${sejak}` : ""
      }, sehingga belum ada yang dapat diverifikasi hakim. Agenda hari ini menuntut dokumen itu lewat e-Court.`
    );
  } else if (item.keadaan === "belum-upload") {
    bagian.push(
      `Pihak belum mengunggah dokumennya di e-Court - belum ada dokumen persidangan yang diunggah sejak sidang sebelumnya${
        item.sidangLalu ? ` (${item.sidangLalu})` : ""
      }, sehingga belum ada yang dapat diverifikasi hakim. Agenda hari ini menuntut dokumen pihak lewat e-Court.`
    );
  } else if (item.keadaan === "sudah") {
    bagian.push(
      item.dokumen > 0
        ? "Tidak ada dokumen persidangan yang menunggu verifikasi majelis."
        : "Tidak ada dokumen persidangan di e-Court untuk diverifikasi."
    );
  } else {
    bagian.push(
      item.belumDiperiksa
        ? "Belum diperiksa dari e-Court hari ini - menunggu giliran penarikan."
        : `Data e-Court belum terbaca${data.penarik?.alasan ? `: ${data.penarik.alasan}` : ""}.`
    );
  }
  if (item?.diverifikasiOleh?.length) bagian.push(`Diverifikasi oleh ${item.diverifikasiOleh.join(", ")} (lewat ALETA).`);
  const jam = jamMenit(item?.terakhirDiperiksa ?? "");
  bagian.push(jam ? `Terakhir diperiksa pukul ${jam}.` : "Belum pernah diperiksa.");
  if (data.penarik && !data.penarik.tersambung && data.penarik.alasan && item && item.keadaan !== "tidak-konek") {
    bagian.push(`Penarik e-Court: ${data.penarik.alasan} - keadaan ini bisa sudah berubah.`);
  }

  return { keadaan, label: LABEL[keadaan], kelas: KELAS[keadaan], keterangan: bagian.join(" ") };
}
