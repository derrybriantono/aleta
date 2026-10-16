/**
 * ============================================================================
 * STATUS SKORS SIDANG YANG UTUH - F3.1 (17 Oktober 2026)
 * ============================================================================
 *
 * Skors sudah ada sejak 2 Okt 2026 (butir 10): tombol Skors / Lanjutkan,
 * lencana "diskors · belum selesai", catatan di tabel bot
 * aleta_bot_sidang_skors. F3.1 melengkapinya:
 *
 *   - ALASAN baku (menunggu pihak / saksi / kuasa, istirahat, musyawarah
 *     majelis, menunggu berkas, lainnya) + teks bebas;
 *   - PERKIRAAN LANJUT ("sekitar 10.30") dan hitung mundurnya;
 *   - LAMA SKORS dicatat saat Lanjutkan;
 *   - kalimat untuk LAYAR ANTRIAN PIHAK ("diskors, dilanjutkan sekitar 10.30");
 *   - USULAN KALIMAT BAS dari riwayat skors satu sidang - keputusan 17 Okt
 *     butir 49: HANYA skors sebelum pengucapan putusan (musyawarah majelis
 *     pada sidang berangenda putusan, lihat skorsUntukBas). Skors lain tetap
 *     tercatat di ALETA, tidak diusulkan ke BAS.
 *
 * Semua di berkas ini murni (tanpa jaringan) - dipakai portal dan dijaga uji.
 * Tidak ada yang ditulis ke SIPP: alasan, perkiraan, dan lama hanya di tabel
 * ALETA. Kode alasan di sini SAMA dengan KODE_ALASAN_SKORS di bot
 * (aleta_bot/services/sidangSelesaiService.js).
 */

import { agendaMusyawarah } from "@/lib/keadaan-sidang";

export type KodeAlasanSkors = "pihak" | "saksi" | "kuasa" | "istirahat" | "musyawarah" | "berkas" | "lainnya";

export const ALASAN_SKORS: ReadonlyArray<{
  kode: KodeAlasanSkors;
  /** Label tombol pilihan. */
  label: string;
  /** Bagian kalimat BAS: "sidang diskors <frasa>". */
  frasaBas: string;
}> = [
  { kode: "pihak", label: "Menunggu pihak", frasaBas: "untuk menunggu kehadiran pihak" },
  { kode: "saksi", label: "Menunggu saksi", frasaBas: "untuk menunggu kehadiran saksi" },
  { kode: "kuasa", label: "Menunggu kuasa", frasaBas: "untuk menunggu kehadiran kuasa" },
  { kode: "istirahat", label: "Istirahat", frasaBas: "untuk istirahat" },
  { kode: "musyawarah", label: "Musyawarah majelis", frasaBas: "untuk musyawarah majelis hakim" },
  { kode: "berkas", label: "Menunggu berkas", frasaBas: "untuk menunggu berkas" },
  { kode: "lainnya", label: "Lainnya", frasaBas: "" },
];

/** Pilihan cepat perkiraan lanjut, dalam menit dari sekarang. */
export const PERKIRAAN_CEPAT_MENIT: readonly number[] = [10, 15, 30, 60];

/** Zona waktu yang ditulis di BAS - PA Donggala (Sulawesi Tengah). */
export const ZONA_BAS = "WITA";

function rapi(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

function dua(n: number): string {
  return String(n).padStart(2, "0");
}

export function kodeAlasanSah(nilai: unknown): KodeAlasanSkors | "" {
  const kode = rapi(nilai).toLowerCase();
  return ALASAN_SKORS.some((a) => a.kode === kode) ? (kode as KodeAlasanSkors) : "";
}

export function labelAlasan(kode: unknown): string {
  return ALASAN_SKORS.find((a) => a.kode === kodeAlasanSah(kode))?.label ?? "";
}

/**
 * Teks alasan yang disimpan di kolom `alasan` (191 huruf) - label baku,
 * ditambah keterangan bila ada. "Lainnya" = keterangannya saja.
 */
export function susunAlasanSkors(kode: unknown, keterangan: unknown): string {
  const k = kodeAlasanSah(kode);
  const ket = rapi(keterangan).replace(/\s+/g, " ");
  if (!k) return ket.slice(0, 191);
  if (k === "lainnya") return (ket || "Lainnya").slice(0, 191);
  return (ket ? `${labelAlasan(k)} - ${ket}` : labelAlasan(k)).slice(0, 191);
}

/** Alasan yang dibaca manusia dari satu catatan skors - "" bila tidak ada. */
export function teksAlasanSkors(catatan: { alasan?: string | null; alasanKode?: string | null } | null | undefined): string {
  if (!catatan) return "";
  const alasan = rapi(catatan.alasan);
  if (alasan) return alasan;
  return labelAlasan(catatan.alasanKode);
}

// ============================================================================
// WAKTU
// ============================================================================

/** "YYYY-MM-DD HH:MM[:SS]" -> Date waktu setempat, atau null. */
export function waktuDari(teks: unknown): Date | null {
  const c = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(rapi(teks));
  if (!c) return null;
  const t = new Date(Number(c[1]), Number(c[2]) - 1, Number(c[3]), Number(c[4]), Number(c[5]), Number(c[6] || 0));
  return Number.isNaN(t.getTime()) ? null : t;
}

/** Date -> "YYYY-MM-DD HH:MM:SS" (waktu setempat) - bentuk yang dimengerti bot. */
export function teksWaktu(t: Date): string {
  return `${t.getFullYear()}-${dua(t.getMonth() + 1)}-${dua(t.getDate())} ${dua(t.getHours())}:${dua(t.getMinutes())}:${dua(t.getSeconds())}`;
}

/** Jam bergaya Indonesia: "10.30". */
export function jamTitik(teks: unknown): string {
  const c = /(\d{1,2}):(\d{2})/.exec(rapi(teks));
  return c ? `${c[1].padStart(2, "0")}.${c[2]}` : "";
}

/**
 * Perkiraan lanjut dari pilihan cepat - dibulatkan ke atas ke kelipatan lima
 * menit (orang di ruang tunggu membaca "10.30", bukan "10.27").
 */
export function perkiraanDariMenit(menit: number, kini: Date = new Date()): string {
  const t = new Date(kini.getTime() + Math.max(1, Math.round(menit)) * 60_000);
  t.setSeconds(0, 0);
  const sisa = t.getMinutes() % 5;
  if (sisa) t.setMinutes(t.getMinutes() + (5 - sisa));
  return teksWaktu(t);
}

/** "HH:MM" dari kotak jam -> waktu penuh pada tanggal sidang; "" bila tidak sah. */
export function perkiraanDariJam(jam: unknown, tanggalSidang: unknown): string {
  const c = /^(\d{1,2})[:.](\d{2})$/.exec(rapi(jam));
  const tanggal = rapi(tanggalSidang).slice(0, 10);
  if (!c || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return "";
  const j = Number(c[1]);
  const m = Number(c[2]);
  if (j > 23 || m > 59) return "";
  return `${tanggal} ${dua(j)}:${dua(m)}:00`;
}

/** Menit (dibulatkan) - "" bila tidak terukur. */
export function teksLama(detik: number | null | undefined): string {
  if (detik === null || detik === undefined || !Number.isFinite(detik) || detik < 0) return "";
  const menit = Math.round(detik / 60);
  if (menit < 1) return "kurang dari 1 menit";
  if (menit < 60) return `${menit} menit`;
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  return sisa ? `${jam} jam ${sisa} menit` : `${jam} jam`;
}

/** Lama skors dalam detik: kolom lama_detik, atau selisih dua waktu. */
export function lamaSkorsDetik(c: {
  lamaDetik?: number | null;
  diskorsPada?: string | null;
  dilanjutkanPada?: string | null;
}): number | null {
  if (typeof c.lamaDetik === "number" && Number.isFinite(c.lamaDetik) && c.lamaDetik >= 0) return c.lamaDetik;
  const a = waktuDari(c.diskorsPada);
  const b = waktuDari(c.dilanjutkanPada);
  if (!a || !b || b < a) return null;
  return Math.round((b.getTime() - a.getTime()) / 1000);
}

export type HitungMundur = {
  /** Menit tersisa sampai perkiraan (negatif = sudah lewat). */
  sisaMenit: number;
  lewat: boolean;
  /** "lanjut ±12 mnt lagi" / "lewat 5 mnt dari perkiraan" / "sebentar lagi". */
  teks: string;
};

/** Hitung mundur menuju perkiraan lanjut - null bila tidak ada perkiraan. */
export function hitungMundur(perkiraanLanjut: unknown, kini: Date = new Date()): HitungMundur | null {
  const t = waktuDari(perkiraanLanjut);
  if (!t) return null;
  const sisaMenit = Math.round((t.getTime() - kini.getTime()) / 60_000);
  if (sisaMenit > 0) return { sisaMenit, lewat: false, teks: `${sisaMenit} mnt lagi` };
  if (sisaMenit === 0) return { sisaMenit, lewat: false, teks: "sebentar lagi" };
  return { sisaMenit, lewat: true, teks: `lewat ${-sisaMenit} mnt dari perkiraan` };
}

// ============================================================================
// LAYAR ANTRIAN PIHAK (TANPA LOGIN)
// ============================================================================

/**
 * Kalimat untuk orang di ruang tunggu - tanpa alasan, tanpa nama petugas:
 * "Diskors, dilanjutkan sekitar 10.30" / "Diskors sementara".
 */
export function kalimatPublikSkors(perkiraanLanjut: unknown): string {
  const jam = jamTitik(perkiraanLanjut);
  return jam ? `Diskors, dilanjutkan sekitar ${jam}` : "Diskors sementara";
}

/**
 * Skors yang masih berlaku menurut layar tanpa login, yang tidak mengenal
 * penanda mulai Jadwal Sidang: catatan aktif (belum dilanjutkan) DAN perkara
 * itu tidak dipanggil lagi SESUDAH diskors. Panggilan baru = sidangnya sudah
 * berjalan lagi walau tombol Lanjutkan tidak ditekan.
 *
 * `jamPanggil` boleh "HH:MM[:SS]" (hari yang sama) atau waktu penuh.
 */
export function skorsPublikBerlaku(
  catatan: { diskorsPada?: string | null; dilanjutkanPada?: string | null } | null | undefined,
  jamPanggil?: string | null
): boolean {
  if (!catatan || rapi(catatan.dilanjutkanPada)) return false;
  const diskors = waktuDari(catatan.diskorsPada);
  const panggil = rapi(jamPanggil);
  if (!diskors) return false;
  if (!panggil) return true;
  const penuh = waktuDari(panggil);
  const jam = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(panggil);
  const waktuPanggil =
    penuh ??
    (jam
      ? new Date(diskors.getFullYear(), diskors.getMonth(), diskors.getDate(), Number(jam[1]), Number(jam[2]), Number(jam[3] || 0))
      : null);
  if (!waktuPanggil) return true;
  return waktuPanggil.getTime() <= diskors.getTime();
}

// ============================================================================
// RIWAYAT SKORS SATU SIDANG -> USULAN KALIMAT BAS
// ============================================================================

export type SkorsTercatat = {
  perkaraId: string;
  tanggalSidang: string;
  nomorPerkara?: string;
  alasan?: string;
  alasanKode?: string;
  oleh?: string;
  diskorsPada: string;
  perkiraanLanjut?: string;
  dilanjutkanPada?: string;
  dilanjutkanOleh?: string;
  lamaDetik?: number | null;
};

/** Skors satu sidang (perkara x tanggal), terlama dulu; tanpa catatan rusak. */
export function riwayatSkorsSidang(
  daftar: readonly SkorsTercatat[] | null | undefined,
  perkaraId: string,
  tanggalSidang: string
): SkorsTercatat[] {
  const id = rapi(perkaraId);
  const tanggal = rapi(tanggalSidang).slice(0, 10);
  return (Array.isArray(daftar) ? daftar : [])
    .filter((s) => s && rapi(s.perkaraId) === id && rapi(s.tanggalSidang).slice(0, 10) === tanggal && waktuDari(s.diskorsPada))
    .slice()
    .sort((a, b) => rapi(a.diskorsPada).localeCompare(rapi(b.diskorsPada)));
}

/** Frasa sebab skors di BAS - dari kode baku, keterangan ikut dalam kurung. */
function frasaSebabBas(s: SkorsTercatat): string {
  const kode = kodeAlasanSah(s.alasanKode);
  const alasan = rapi(s.alasan);
  const baku = ALASAN_SKORS.find((a) => a.kode === kode);
  if (baku && baku.frasaBas) {
    // Keterangan = bagian alasan sesudah "Label - ".
    const ket = alasan.startsWith(`${baku.label} - `) ? alasan.slice(baku.label.length + 3).trim() : "";
    return ket ? `${baku.frasaBas} (${ket})` : baku.frasaBas;
  }
  if (alasan && alasan.toLowerCase() !== "lainnya") return `karena ${alasan.charAt(0).toLowerCase()}${alasan.slice(1)}`;
  return "";
}

/**
 * Skors yang dicatat di BAS (keputusan 17 Okt 2026 butir 49): HANYA skors
 * sebelum pengucapan putusan - alasannya "Musyawarah majelis" pada sidang yang
 * agendanya musyawarah/pembacaan putusan/penetapan (agendaMusyawarah, sama
 * dengan penanda Hari Putusan). Agenda tidak diketahui (kosong): cukup
 * alasannya. Skors lain (menunggu pihak/saksi, istirahat, ...) tetap tercatat
 * di ALETA - riwayat, layar antrian, widget - tetapi tidak diusulkan ke BAS.
 */
export function skorsUntukBas(riwayat: readonly SkorsTercatat[] | null | undefined, agenda?: string | null): SkorsTercatat[] {
  const teksAgenda = rapi(agenda);
  if (teksAgenda && !agendaMusyawarah(teksAgenda)) return [];
  return (Array.isArray(riwayat) ? riwayat : []).filter((s) => s && kodeAlasanSah(s.alasanKode) === "musyawarah");
}

/**
 * Usulan kalimat BAS dari riwayat skors SATU sidang - satu kalimat per skors:
 *
 *   "Pada pukul 09.40 WITA sidang diskors untuk menunggu kehadiran saksi, dan
 *    pada pukul 10.05 WITA skors dicabut dan sidang dibuka kembali."
 *
 * Kalimat netral: tidak menyebut "terbuka untuk umum" (sidang perceraian
 * tertutup untuk umum) dan tidak menyebut nama petugas yang menekan tombol.
 * Skors yang belum dilanjutkan disebut apa adanya ("... dan belum dibuka
 * kembali pada saat catatan ini dibuat") supaya PP melengkapinya, bukan
 * menebak jamnya.
 */
export function kalimatSkorsBas(riwayat: readonly SkorsTercatat[] | null | undefined, zona: string = ZONA_BAS): string {
  const daftar = (Array.isArray(riwayat) ? riwayat : []).filter((s) => s && waktuDari(s.diskorsPada));
  const kalimat = daftar.map((s, i) => {
    const pembuka = i === 0 ? "Pada pukul" : "Kemudian pada pukul";
    const jamSkors = jamTitik(s.diskorsPada);
    const sebab = frasaSebabBas(s);
    const jamBuka = jamTitik(s.dilanjutkanPada);
    const bagianSkors = `${pembuka} ${jamSkors} ${zona} sidang diskors${sebab ? ` ${sebab}` : ""}`;
    return jamBuka
      ? `${bagianSkors}, dan pada pukul ${jamBuka} ${zona} skors dicabut dan sidang dibuka kembali.`
      : `${bagianSkors}, dan sidang belum dibuka kembali pada saat catatan ini dibuat.`;
  });
  return kalimat.join(" ");
}

/** Ringkasan satu baris untuk layar petugas: "09.40-10.05 (25 menit) · Menunggu saksi". */
export function ringkasSkors(s: SkorsTercatat): string {
  const awal = jamTitik(s.diskorsPada);
  const akhir = jamTitik(s.dilanjutkanPada);
  const lama = teksLama(lamaSkorsDetik(s));
  const alasan = teksAlasanSkors(s);
  const waktu = akhir ? `${awal}-${akhir}${lama ? ` (${lama})` : ""}` : `sejak ${awal}${s.perkiraanLanjut ? `, perkiraan lanjut ${jamTitik(s.perkiraanLanjut)}` : ""}`;
  return [waktu, alasan].filter(Boolean).join(" · ");
}
