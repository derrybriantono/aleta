/**
 * ============================================================================
 * MODE PEMELIHARAAN PORTAL (E3, admin 5 - 25 Okt 2026)
 * ============================================================================
 *
 * Saklar Super Admin + pesan + jadwal. MATI bawaan: tanpa pengaturan, tidak
 * ada yang berubah bagi siapa pun (portal, ekstensi, layar publik).
 *
 * Saat AKTIF (dinyalakan tangan, atau jadwal mulai-selesai sedang berjalan):
 *   - halaman portal untuk pengguna biasa diganti layar pemeliharaan yang
 *     memuat ulang sendiri begitu selesai;
 *   - permintaan MENULIS (POST/PUT/PATCH/DELETE) lewat API ditolak 503 dengan
 *     pesan Super Admin - di sinilah pekerjaan yang setengah jalan terjaga
 *     sebelum pemasangan; bacaan tetap jalan;
 *   - Super Admin tetap masuk dan bekerja seperti biasa; Admin hanya bila
 *     "Admin tetap boleh masuk" dicentang;
 *   - layar antrean/jadwal publik dan masuk/keluar tidak disentuh.
 *
 * Pemberitahuan: pita kuning bagi semua pengguna sejak 60 menit sebelum jadwal
 * mulai, dan - bila dicentang - satu WhatsApp ke admin 15 menit sebelumnya.
 *
 * Tersimpan di aleta_ekstensi_setelan (*sistem*, tanpa migrasi). Bacaan
 * disinggahkan 5 detik di memori proses; menyimpan membuang singgahan.
 */
import type { AletaDatabase } from "@/server/db/client";
import { bacaSetelanJson, simpanSetelanSistem } from "@/server/modules/kesehatan/setelan";
import { ApiError } from "@/server/shared/errors";

export const KUNCI_PEMELIHARAAN = "pemeliharaan:pengaturan";
export const BATAS_PESAN = 400;
export const BATAS_DURASI_JAM = 72;
/** Pita pemberitahuan tampil sejak sekian menit sebelum jadwal mulai. */
export const PITA_MENIT = 60;
/** WhatsApp ke admin sekian menit sebelum jadwal mulai. */
export const KABAR_WA_MENIT = 15;

export type PengaturanPemeliharaan = {
  /** Dinyalakan tangan: aktif sampai dimatikan tangan. */
  aktif: boolean;
  pesan: string;
  /** ISO UTC; kosong = tanpa jadwal. */
  mulai: string;
  selesai: string;
  adminBoleh: boolean;
  kabarWa: boolean;
  /** Nilai `mulai` yang sudah dikabari lewat WhatsApp (supaya tidak berulang). */
  kabarUntuk: string;
  diubahOleh: string;
  diubahPada: string;
};

export const PENGATURAN_PEMELIHARAAN_BAWAAN: PengaturanPemeliharaan = {
  aktif: false,
  pesan: "",
  mulai: "",
  selesai: "",
  adminBoleh: false,
  kabarWa: false,
  kabarUntuk: "",
  diubahOleh: "",
  diubahPada: "",
};

export const PESAN_BAWAAN = "ALETA sedang dalam pemeliharaan. Mohon simpan pekerjaan Anda dan coba lagi sebentar lagi.";

function isoAtauKosong(x: unknown): string {
  const teks = String(x ?? "").trim();
  if (!teks) return "";
  const t = Date.parse(teks);
  return Number.isNaN(t) ? "" : new Date(t).toISOString();
}

export function bersihkanPengaturanPemeliharaan(masukan: unknown): PengaturanPemeliharaan {
  const x = masukan && typeof masukan === "object" ? (masukan as Record<string, unknown>) : {};
  let mulai = isoAtauKosong(x.mulai);
  let selesai = isoAtauKosong(x.selesai);
  // Jadwal harus utuh: keduanya terisi, selesai sesudah mulai, paling lama 72 jam.
  if (!mulai || !selesai || Date.parse(selesai) <= Date.parse(mulai) || Date.parse(selesai) - Date.parse(mulai) > BATAS_DURASI_JAM * 3_600_000) {
    mulai = "";
    selesai = "";
  }
  return {
    aktif: x.aktif === true,
    pesan: String(x.pesan ?? "").replace(/[<>]/g, "").trim().slice(0, BATAS_PESAN),
    mulai,
    selesai,
    adminBoleh: x.adminBoleh === true,
    kabarWa: x.kabarWa === true,
    kabarUntuk: isoAtauKosong(x.kabarUntuk),
    diubahOleh: String(x.diubahOleh ?? "").slice(0, 120),
    diubahPada: isoAtauKosong(x.diubahPada),
  };
}

/** Validasi untuk penyimpanan oleh Super Admin: jadwal yang setengah isi atau terbalik ditolak, bukan dibuang diam-diam. */
export function periksaMasukanPemeliharaan(masukan: unknown) {
  const x = masukan && typeof masukan === "object" ? (masukan as Record<string, unknown>) : null;
  if (!x) throw new ApiError(400, "Pengaturan pemeliharaan tidak sah.");
  const mulai = isoAtauKosong(x.mulai);
  const selesai = isoAtauKosong(x.selesai);
  if ((mulai && !selesai) || (!mulai && selesai)) throw new ApiError(400, "Jadwal pemeliharaan harus mengisi waktu mulai DAN selesai.");
  if (mulai && selesai) {
    if (Date.parse(selesai) <= Date.parse(mulai)) throw new ApiError(400, "Waktu selesai harus sesudah waktu mulai.");
    if (Date.parse(selesai) - Date.parse(mulai) > BATAS_DURASI_JAM * 3_600_000) {
      throw new ApiError(400, `Jadwal pemeliharaan paling lama ${BATAS_DURASI_JAM} jam.`);
    }
  }
  if (String(x.pesan ?? "").length > BATAS_PESAN) throw new ApiError(400, `Pesan paling panjang ${BATAS_PESAN} huruf.`);
}

export type KeadaanPemeliharaan = {
  aktif: boolean;
  sebab: "manual" | "jadwal" | null;
  pesan: string;
  /** Perkiraan selesai (ISO), kosong bila tidak diketahui. */
  selesaiPerkiraan: string;
  /** Jadwal berikutnya yang belum mulai (ISO), kosong bila tidak ada. */
  mulaiDijadwalkan: string;
  /** Menit sampai jadwal mulai (0..PITA_MENIT) bila akan datang; null bila tidak. */
  menitSampaiMulai: number | null;
  adminBoleh: boolean;
};

export const KEADAAN_MATI: KeadaanPemeliharaan = {
  aktif: false,
  sebab: null,
  pesan: "",
  selesaiPerkiraan: "",
  mulaiDijadwalkan: "",
  menitSampaiMulai: null,
  adminBoleh: false,
};

export function hitungKeadaan(p: PengaturanPemeliharaan, kini: Date): KeadaanPemeliharaan {
  const t = kini.getTime();
  const mulai = p.mulai ? Date.parse(p.mulai) : NaN;
  const selesai = p.selesai ? Date.parse(p.selesai) : NaN;
  const dalamJadwal = Number.isFinite(mulai) && Number.isFinite(selesai) && t >= mulai && t < selesai;
  const akanDatang = Number.isFinite(mulai) && t < mulai;
  const aktif = p.aktif || dalamJadwal;
  const menit = akanDatang ? Math.ceil((mulai - t) / 60_000) : null;
  return {
    aktif,
    sebab: p.aktif ? "manual" : dalamJadwal ? "jadwal" : null,
    pesan: p.pesan || PESAN_BAWAAN,
    selesaiPerkiraan: Number.isFinite(selesai) && (dalamJadwal || akanDatang) ? p.selesai : "",
    mulaiDijadwalkan: akanDatang ? p.mulai : "",
    menitSampaiMulai: menit !== null && menit <= PITA_MENIT ? menit : null,
    adminBoleh: p.adminBoleh,
  };
}

const singgah: { pada: number; nilai: PengaturanPemeliharaan | null } = { pada: 0, nilai: null };
const SINGGAH_MS = 5000;

export function kosongkanSinggahPemeliharaan() {
  singgah.pada = 0;
  singgah.nilai = null;
}

export async function bacaPengaturanPemeliharaan(db: AletaDatabase, { tanpaSinggah = false } = {}): Promise<PengaturanPemeliharaan> {
  if (!tanpaSinggah && singgah.nilai && Date.now() - singgah.pada < SINGGAH_MS) return singgah.nilai;
  const tersimpan = await bacaSetelanJson<PengaturanPemeliharaan>(db, KUNCI_PEMELIHARAAN);
  const nilai = bersihkanPengaturanPemeliharaan({ ...PENGATURAN_PEMELIHARAAN_BAWAAN, ...(tersimpan ?? {}) });
  singgah.nilai = nilai;
  singgah.pada = Date.now();
  return nilai;
}

export async function simpanPengaturanPemeliharaan(
  db: AletaDatabase,
  masukan: unknown,
  oleh: { id: string; nama: string },
  kini: Date = new Date()
): Promise<PengaturanPemeliharaan> {
  periksaMasukanPemeliharaan(masukan);
  const sekarang = await bacaPengaturanPemeliharaan(db, { tanpaSinggah: true });
  const x = masukan as Record<string, unknown>;
  const baru = bersihkanPengaturanPemeliharaan({
    ...sekarang,
    ...x,
    // Jadwal baru = kabar WhatsApp baru; kabarUntuk tidak boleh diatur dari luar.
    kabarUntuk: x.mulai !== undefined && isoAtauKosong(x.mulai) !== sekarang.mulai ? "" : sekarang.kabarUntuk,
    diubahOleh: oleh.nama || oleh.id,
    diubahPada: kini.toISOString(),
  });
  await simpanSetelanSistem(db, KUNCI_PEMELIHARAAN, JSON.stringify(baru), kini.toISOString());
  kosongkanSinggahPemeliharaan();
  return baru;
}

export async function keadaanPemeliharaan(db: AletaDatabase, kini: Date = new Date()): Promise<KeadaanPemeliharaan> {
  return hitungKeadaan(await bacaPengaturanPemeliharaan(db), kini);
}

/** Super Admin selalu lewat; Admin hanya bila dicentang; peran lain tidak. */
export function bolehLewatPemeliharaan(roleId: string | null | undefined, keadaan: Pick<KeadaanPemeliharaan, "adminBoleh">): boolean {
  if (roleId === "super-admin") return true;
  return roleId === "admin" && keadaan.adminBoleh;
}

/** Jalur yang tetap bekerja saat pemeliharaan (setelah awalan /aleta dibuang). */
export const JALUR_TETAP_BEKERJA = [
  "/api/auth",
  "/api/public",
  "/api/system",
  "/api/admin/pemeliharaan",
  "/api/portal/galat",
  "/api/portal/session",
  // layar antrean dan jadwal publik
  "/api/antrian",
  "/api/antrian-publik",
  "/api/antrian-tampil",
  "/api/antrian-ruang",
  "/api/sidang-ruang",
  "/api/jadwal-tautan",
  "/api/aleta-ecourt/antrian-publik",
  "/api/aleta-ecourt/tautan-jadwal",
] as const;

export function jalurTetapBekerja(pathname: string): boolean {
  const jalur = pathname === "/aleta" ? "/" : pathname.startsWith("/aleta/") ? pathname.slice("/aleta".length) : pathname;
  return JALUR_TETAP_BEKERJA.some((awal) => jalur === awal || jalur.startsWith(`${awal}/`));
}

// ---------------------------------------------------------------------------
// Kabar WhatsApp 15 menit sebelum jadwal
// ---------------------------------------------------------------------------

function jamWita(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Makassar", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)).replace(".", ":");
}

export type KirimKabar = (penerima: Array<{ id: string; nama: string; nomor: string }>, pesan: string, kunci: string) => Promise<{ terkirim: number; gagal: number }>;

/**
 * Satu detak: bila kabarWa menyala, jadwal ada, dan sekarang di dalam 15 menit
 * sebelum mulai (belum mulai) dan belum pernah dikabari untuk jadwal ini,
 * kirim SATU pesan ke admin lalu catat. Mengembalikan hasil kirim atau null.
 */
export async function detakKabarPemeliharaan(
  db: AletaDatabase,
  opsi: { kini?: Date; kirim?: KirimKabar; penerima?: (db: AletaDatabase) => Promise<Array<{ id: string; nama: string; nomor: string }>> } = {}
) {
  const kini = opsi.kini ?? new Date();
  const p = await bacaPengaturanPemeliharaan(db, { tanpaSinggah: true });
  if (!p.kabarWa || !p.mulai || !p.selesai || p.kabarUntuk === p.mulai) return null;
  const sisaMenit = (Date.parse(p.mulai) - kini.getTime()) / 60_000;
  if (!(sisaMenit > 0 && sisaMenit <= KABAR_WA_MENIT)) return null;

  const { kirimPeringatanWhatsapp, daftarPenerimaAdmin } = await import("@/server/modules/kesehatan/layanan");
  const penerima = await (opsi.penerima ?? ((d) => daftarPenerimaAdmin(d, "admin")))(db);
  const pesan =
    `Pemeliharaan ALETA dijadwalkan mulai pukul ${jamWita(p.mulai)} WITA, perkiraan selesai ${jamWita(p.selesai)} WITA. ` +
    `${p.pesan || PESAN_BAWAAN}${p.adminBoleh ? " Admin dan Super Admin tetap dapat masuk." : " Hanya Super Admin yang dapat masuk selama pemeliharaan."}`;
  const hasil = await (opsi.kirim ?? kirimPeringatanWhatsapp)(penerima, pesan, `pemeliharaan-${p.mulai.slice(0, 16)}`);
  // Dicatat walau sebagian gagal: kabar diulang tiap menit bukan jalan keluar.
  await simpanSetelanSistem(db, KUNCI_PEMELIHARAAN, JSON.stringify({ ...p, kabarUntuk: p.mulai }), kini.toISOString());
  kosongkanSinggahPemeliharaan();
  return hasil;
}

const wadah = globalThis as typeof globalThis & { __pemeliharaanDetak?: ReturnType<typeof setInterval> };

/** Dinyalakan instrumentation.ts. Matikan dengan ALETA_PEMELIHARAAN_DETAK=0. Tanpa kabarWa dan jadwal, detaknya tidak berbuat apa-apa. */
export function mulaiPemeliharaanBerkala(getDb: () => Promise<AletaDatabase>, env: Record<string, string | undefined> = process.env) {
  if (env.ALETA_PEMELIHARAAN_DETAK === "0") return;
  if (wadah.__pemeliharaanDetak) return;
  wadah.__pemeliharaanDetak = setInterval(() => {
    void (async () => {
      try {
        await detakKabarPemeliharaan(await getDb());
      } catch (e) {
        console.error("[Pemeliharaan] detak gagal:", e);
      }
    })();
  }, 60_000);
  wadah.__pemeliharaanDetak.unref?.();
}
