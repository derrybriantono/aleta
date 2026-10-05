/**
 * ============================================================================
 * PENANDA VERIFIKASI MAJELIS - PERKARA E-LITIGASI HARI INI (5 Okt 2026, butir 30)
 * ============================================================================
 *
 * SATU penanda di samping nomor perkara, tiga keadaan:
 *
 *   sudah        hijau  tidak ada dokumen persidangan yang menunggu verifikasi
 *   belum        kuning ada dokumen yang menunggu verifikasi majelis
 *   tidak-konek  abu    data e-Court tidak terbaca / bot tidak tersambung /
 *                       sesi e-Court habis
 *
 * Hanya perkara GUGATAN e-Litigasi (terdaftar e-Court) yang bersidang HARI
 * INI - perkara permohonan tidak melewati verifikasi majelis atas dokumen
 * persidangan. Datanya simpanan bot (GET /ecourt/verifikasi-hari-ini), bukan
 * tarikan e-Court saat halaman dimuat.
 */

export type KeadaanVerifikasi = "sudah" | "belum" | "tidak-konek";

export type VerifikasiPerkara = {
  perkaraId?: string;
  nomorPerkara: string;
  keadaan: KeadaanVerifikasi;
  belumDiperiksa?: boolean;
  menunggu: number;
  dokumen: number;
  terakhirDiperiksa: string;
  diverifikasiOleh: string[];
};

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
  "tidak-konek": "tidak konek",
};

const KELAS: Record<KeadaanVerifikasi, string> = {
  sudah: "bg-emerald-600 text-white",
  belum: "bg-amber-400 text-amber-950",
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
  baris: { nomorPerkara: string; tanggalSidang: string; lewatEcourt?: boolean },
  data: DataVerifikasi,
  hariIni: string
): Penanda | null {
  if (!baris.lewatEcourt) return null;
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
