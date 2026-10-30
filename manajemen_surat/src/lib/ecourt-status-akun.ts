/**
 * ============================================================================
 * STATUS AKUN e-COURT - SATU KAMUS TAMPILAN (30 Okt 2026)
 * ============================================================================
 *
 * Keadaan tiap akun DIHITUNG di ALETA Bot (aleta_bot/services/
 * ecourtStatusAkunService.js) dari bukti nyata: masuk, pemeriksaan, penarikan.
 * Berkas ini hanya MENERJEMAHKANNYA menjadi judul, kalimat, dan warna - satu
 * kamus untuk semua penanda: kartu Integrasi e-Court, lampu panel ekstensi,
 * baris Tarik data e-Court di popup, kesehatan server, dan sesi pribadi.
 *
 * Fungsi di sini MURNI (tanpa fetch, tanpa React) supaya diuji tanpa merender
 * dan dipakai sama persis di server (rute API) maupun di layar.
 *
 *   aktif             Tersambung         hijau
 *   perlu_masuk       Perlu masuk ulang  kuning
 *   tidak_tersambung  Tidak tersambung   merah
 *   memeriksa         Sedang memeriksa   kelabu
 *   belum_diatur      Belum diatur       kelabu
 */

import { waktuPendek } from "@/lib/status-penarikan-ecourt";

export const DAFTAR_KEADAAN_ECOURT = ["aktif", "perlu_masuk", "tidak_tersambung", "memeriksa", "belum_diatur"] as const;
export type KeadaanEcourt = (typeof DAFTAR_KEADAAN_ECOURT)[number];
export type NadaEcourt = "hijau" | "kuning" | "merah" | "kelabu";
export type TindakanEcourt = "masuk" | "masuk_lagi" | "periksa" | "";

/** Bentuk yang dikirim bot (statusSlot / statusSemua). Tanpa sandi, tanpa cookie. */
export type StatusAkunEcourt = {
  slot: string;
  label: string;
  utama?: boolean;
  aktifAkun?: boolean;
  keadaan: KeadaanEcourt;
  nada: NadaEcourt;
  kodeSebab: string;
  tindakan: TindakanEcourt;
  diperiksaPada: string;
  umurDetik: number | null;
  sumber: string;
  sedangMemeriksa?: boolean;
  menungguCaptcha?: boolean;
  adaSandi?: boolean;
  sandiDitolak?: boolean;
  galatTerakhir?: { pada: string; teks: string } | null;
};

export type StatusSemuaEcourt = {
  ok: boolean;
  dibaca: string;
  utama: string;
  segarMenit?: number;
  akun: StatusAkunEcourt[];
  ringkas: StatusAkunEcourt;
};

export const JUDUL_KEADAAN: Record<KeadaanEcourt, string> = {
  aktif: "Tersambung",
  perlu_masuk: "Perlu masuk ulang",
  tidak_tersambung: "Tidak tersambung",
  memeriksa: "Sedang memeriksa",
  belum_diatur: "Belum diatur",
};

export const NADA_KEADAAN: Record<KeadaanEcourt, NadaEcourt> = {
  aktif: "hijau",
  perlu_masuk: "kuning",
  tidak_tersambung: "merah",
  memeriksa: "kelabu",
  belum_diatur: "kelabu",
};

/** Varian Badge portal (components/ui/badge) - sudah terang & gelap. */
export const LENCANA_NADA: Record<NadaEcourt, "success" | "warning" | "danger" | "muted"> = {
  hijau: "success",
  kuning: "warning",
  merah: "danger",
  kelabu: "muted",
};

/** Kelas lampu ekstensi (panel.css aleta-t4/t7-lampu-*). */
export const LAMPU_NADA: Record<NadaEcourt, "baik" | "awas" | "buruk" | "netral"> = {
  hijau: "baik",
  kuning: "awas",
  merah: "buruk",
  kelabu: "netral",
};

/** Kelas kotak keterangan portal (terang + gelap). */
export const KOTAK_NADA: Record<NadaEcourt, string> = {
  hijau:
    "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
  kuning: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100",
  merah: "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100",
  kelabu: "border-border bg-muted/40 text-foreground",
};

const SUMBER_BUKTI: Record<string, string> = {
  masuk: "saat masuk",
  pemeriksaan: "pemeriksaan",
  penarikan: "penarikan berhasil",
  pemantau: "pemantau sesi",
  pemulihan: "pemulihan sesi",
  pemakaian: "saat dipakai",
};

export const LABEL_TINDAKAN: Record<Exclude<TindakanEcourt, "">, string> = {
  masuk: "Masuk e-Court",
  masuk_lagi: "Masuk lagi",
  periksa: "Periksa sekarang",
};

function sah(k: unknown): k is KeadaanEcourt {
  return typeof k === "string" && (DAFTAR_KEADAAN_ECOURT as readonly string[]).includes(k);
}

/** Status pengganti ketika ALETA Bot sendiri tidak menjawab. */
export function statusBotMati(slot = ""): StatusAkunEcourt {
  return {
    slot,
    label: slot,
    keadaan: "tidak_tersambung",
    nada: "merah",
    kodeSebab: "bot_mati",
    tindakan: "",
    diperiksaPada: "",
    umurDetik: null,
    sumber: "",
  };
}

/** Kalimat sebab satu status - tanpa istilah teknis, waktu dalam WITA. */
export function kalimatSebab(s: StatusAkunEcourt, zona?: string): string {
  const waktu = s.diperiksaPada ? waktuPendek(s.diperiksaPada, zona) : "";
  const dari = SUMBER_BUKTI[s.sumber] || "pemeriksaan";
  let teks: string;
  switch (s.kodeSebab) {
    case "terbukti":
      teks = `Terbukti tersambung ${waktu} (${dari}).`;
      break;
    case "sesi_habis":
      teks = `e-Court meminta masuk ulang - sesinya sudah habis${waktu ? ` (diketahui ${waktu})` : ""}.${
        s.adaSandi ? " Akun & sandi tersimpan - cukup ketik captcha." : " Siapkan surel dan sandi e-Court."
      }`;
      break;
    case "perlu_masuk":
      teks = `e-Court meminta masuk - belum ada sesi yang berlaku${waktu ? ` (diketahui ${waktu})` : ""}.${
        s.adaSandi ? " Akun & sandi tersimpan - cukup ketik captcha." : " Siapkan surel dan sandi e-Court."
      }`;
      break;
    case "gerbang":
      teks = "Akun ini sedang dipakai di perangkat lain. Masuk lagi untuk menegaskan - sesi di perangkat lain akan berhenti.";
      break;
    case "jaringan":
      teks = `Server ALETA tidak dapat menjangkau e-Court (jaringan atau server e-Court sedang gangguan)${
        waktu ? `, ${waktu}` : ""
      }. Diperiksa ulang otomatis.`;
      break;
    case "bot_mati":
      teks = "ALETA Bot tidak menjawab - keadaan e-Court tidak dapat dibaca.";
      break;
    case "sedang_diperiksa":
      teks = "Sedang dipastikan ke e-Court.";
      break;
    case "belum_diperiksa":
      teks = "Belum diperiksa sejak server menyala - sedang dipastikan.";
      break;
    case "bukti_basi_aktif":
      teks = `Terakhir terbukti tersambung ${waktu}; sedang dipastikan ulang.`;
      break;
    case "bukti_basi_putus":
      teks = `Terakhir tidak tersambung ${waktu}; sedang dipastikan ulang.`;
      break;
    case "belum_pernah_masuk":
      teks = `Akun ini belum pernah masuk dari server ALETA.${s.adaSandi ? " Akun & sandi tersimpan - cukup ketik captcha." : ""}`;
      break;
    case "sesi_dihapus":
      teks = `Sesi akun ini sudah dihapus dari server - masuk lagi untuk memakainya.${s.adaSandi ? " Akun & sandi tersimpan - cukup ketik captcha." : ""}`;
      break;
    case "tidak_terdaftar":
      teks = "Akun e-Court belum didaftarkan di Integrasi e-Court.";
      break;
    case "kembaran":
      teks = "Server ini salinan kerja - e-Court tidak dibuka dari sini.";
      break;
    default:
      teks = JUDUL_KEADAAN[s.keadaan] || "";
  }
  if (s.sandiDitolak) teks += " Sandi tersimpan ditolak e-Court - masukkan sandi baru.";
  if (s.menungguCaptcha) teks += " Kotak captcha sedang terbuka.";
  return teks;
}

export type TampilanStatusEcourt = {
  slot: string;
  label: string;
  keadaan: KeadaanEcourt;
  judul: string;
  teks: string;
  nada: NadaEcourt;
  lencana: "success" | "warning" | "danger" | "muted";
  lampu: "baik" | "awas" | "buruk" | "netral";
  tindakan: TindakanEcourt;
  labelTindakan: string;
  diperiksaPada: string;
  adaSandi: boolean;
  sandiDitolak: boolean;
  sedangMemeriksa: boolean;
  menungguCaptcha: boolean;
  utama: boolean;
};

/**
 * Status bot -> tampilan. Masukan kosong/rusak = bot tidak menjawab (merah),
 * BUKAN hijau: lebih baik menyebut tidak tahu daripada menyebut tersambung.
 */
export function tampilanStatus(s: StatusAkunEcourt | null | undefined, opsi: { zona?: string } = {}): TampilanStatusEcourt {
  const st: StatusAkunEcourt = s && sah(s.keadaan) ? s : statusBotMati(s?.slot || "");
  const nada = NADA_KEADAAN[st.keadaan];
  const tindakan: TindakanEcourt = st.sandiDitolak && st.keadaan !== "aktif" ? "masuk_lagi" : st.tindakan || "";
  return {
    slot: st.slot || "",
    label: st.label || st.slot || "",
    keadaan: st.keadaan,
    judul: JUDUL_KEADAAN[st.keadaan],
    teks: kalimatSebab(st, opsi.zona),
    nada,
    lencana: LENCANA_NADA[nada],
    lampu: LAMPU_NADA[nada],
    tindakan,
    labelTindakan: tindakan ? LABEL_TINDAKAN[tindakan] : "",
    diperiksaPada: st.diperiksaPada || "",
    adaSandi: Boolean(st.adaSandi),
    sandiDitolak: Boolean(st.sandiDitolak),
    sedangMemeriksa: Boolean(st.sedangMemeriksa),
    menungguCaptcha: Boolean(st.menungguCaptcha),
    utama: Boolean(st.utama),
  };
}

/**
 * Kata keadaan lama lampu sambungan ekstensi (hidup/habis/belum-ada/
 * tidak-diketahui) - dipertahankan untuk ekstensi yang belum diperbarui.
 * "memeriksa" TIDAK lagi menjadi "hidup": itulah hijau palsu yang dikeluhkan.
 */
export function keadaanSambunganLama(k: KeadaanEcourt): "hidup" | "habis" | "belum-ada" | "terputus" | "tidak-diketahui" {
  switch (k) {
    case "aktif":
      return "hidup";
    case "perlu_masuk":
      return "habis";
    case "belum_diatur":
      return "belum-ada";
    case "tidak_tersambung":
      return "terputus";
    default:
      return "tidak-diketahui";
  }
}

/** Bentuk lama `sesi` pada status penarikan - diturunkan dari model. */
export function sesiDariStatus(s: StatusAkunEcourt): { berlaku: boolean | null; pada: string; sumber: string } {
  return {
    berlaku: s.keadaan === "aktif" ? true : s.keadaan === "perlu_masuk" ? false : null,
    pada: s.diperiksaPada || "",
    sumber: SUMBER_BUKTI[s.sumber] || s.sumber || "",
  };
}

/** Nama peristiwa jendela: kirim sesudah masuk/keluar/periksa supaya semua kartu memuat ulang serempak. */
export const PERISTIWA_STATUS_ECOURT = "aleta-ecourt-status-berubah";

/** Peristiwa jendela {detail:{slot}}: minta kartu Masuk e-Court membuka kotak captcha untuk akun itu. */
export const PERISTIWA_MASUK_ECOURT = "aleta-ecourt-masuk";
