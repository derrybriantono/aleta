import crypto from "node:crypto";

import { type AletaDatabase } from "@/server/db/client";
import { sandiTerlaluUmum } from "@/server/modules/keamanan/sandi-umum";
import { bacaSetelanAwalan, benar, bulatDalam, tulisSetelan } from "@/server/modules/keamanan/setelan";
import { ApiError } from "@/server/shared/errors";
import { hashSecret } from "@/server/shared/security";

/**
 * ============================================================================
 * KEBIJAKAN SANDI (25 Okt 2026, Bagian 6a) - saklar MATI bawaan
 * ============================================================================
 *
 * Selama saklar mati, aturan sandi PERSIS seperti sebelumnya: tidak ada
 * pemeriksaan tambahan, tidak ada paksaan ganti, tidak ada yang tampil di
 * layar. Satu-satunya yang berjalan adalah pencatatan diam-diam sidik sandi
 * lama (agar larangan pakai ulang punya bahan begitu saklar dinyalakan); galat
 * pencatatan itu ditelan dan tidak pernah menggagalkan penggantian sandi.
 *
 * Bila saklar menyala, aturannya dapat diatur Super Admin (bukan dipatok):
 * panjang minimal (bawaan 8 = panjang minimal yang sudah berlaku di jalur
 * pulihkan sandi), tolak sandi umum, tolak nama/NIP/username/email, wajib
 * campuran huruf-angka, larang pakai ulang N sandi terakhir, masa berlaku
 * opsional, dan "paksa ganti saat masuk berikutnya" per akun.
 *
 * HANYA BERLAKU UNTUK SANDI BARU/DIGANTI. Sandi yang sudah ada tidak dapat
 * diperiksa (yang tersimpan hanya hash), jadi "akun yang belum memenuhi" =
 * akun yang sandinya belum pernah diganti di bawah versi kebijakan sekarang,
 * sudah kedaluwarsa, atau dipaksa ganti - bukan penilaian atas sandinya.
 *
 * Sandi asli TIDAK pernah disimpan atau dicatat. Riwayat = HMAC-SHA256 berkunci
 * id akun. Pesan pelanggaran menyebut nama aturan, tidak pernah isi sandi.
 */

export type KebijakanSandi = {
  aktif: boolean;
  /** Naik tiap aturan diubah; akun yang sandinya dibuat di bawah versi lebih rendah tampil "belum memenuhi". */
  versi: number;
  panjangMin: number;
  tolakUmum: boolean;
  tolakIdentitas: boolean;
  wajibCampuran: boolean;
  /** 0 = tidak ada larangan pakai ulang. */
  riwayatN: number;
  /** 0 = sandi tidak kedaluwarsa. */
  masaBerlakuHari: number;
  aktifSejak: string;
};

export const KEBIJAKAN_SANDI_BAWAAN: KebijakanSandi = {
  aktif: false,
  versi: 1,
  panjangMin: 8,
  tolakUmum: true,
  tolakIdentitas: true,
  wajibCampuran: true,
  riwayatN: 5,
  masaBerlakuHari: 0,
  aktifSejak: "",
};

const KUNCI = {
  aktif: "sandi.aktif",
  versi: "sandi.versi",
  panjangMin: "sandi.panjang_min",
  tolakUmum: "sandi.tolak_umum",
  tolakIdentitas: "sandi.tolak_identitas",
  wajibCampuran: "sandi.campuran",
  riwayatN: "sandi.riwayat_n",
  masaBerlakuHari: "sandi.masa_hari",
  aktifSejak: "sandi.aktif_sejak",
} as const;

export const BATAS_KEBIJAKAN_SANDI = { panjangMin: [6, 64], riwayatN: [0, 24], masaBerlakuHari: [0, 730] } as const;
/** Sidik sandi lama yang disimpan per akun (di atas ini dipangkas). */
export const SIMPAN_RIWAYAT_MAKS = 24;

export async function bacaKebijakanSandi(db: AletaDatabase): Promise<KebijakanSandi> {
  const b = await bacaSetelanAwalan(db, "sandi.");
  const d = KEBIJAKAN_SANDI_BAWAAN;
  return {
    aktif: benar(b[KUNCI.aktif], d.aktif),
    versi: bulatDalam(b[KUNCI.versi], 1, 1_000_000, d.versi),
    panjangMin: bulatDalam(b[KUNCI.panjangMin], BATAS_KEBIJAKAN_SANDI.panjangMin[0], BATAS_KEBIJAKAN_SANDI.panjangMin[1], d.panjangMin),
    tolakUmum: benar(b[KUNCI.tolakUmum], d.tolakUmum),
    tolakIdentitas: benar(b[KUNCI.tolakIdentitas], d.tolakIdentitas),
    wajibCampuran: benar(b[KUNCI.wajibCampuran], d.wajibCampuran),
    riwayatN: bulatDalam(b[KUNCI.riwayatN], BATAS_KEBIJAKAN_SANDI.riwayatN[0], BATAS_KEBIJAKAN_SANDI.riwayatN[1], d.riwayatN),
    masaBerlakuHari: bulatDalam(b[KUNCI.masaBerlakuHari], BATAS_KEBIJAKAN_SANDI.masaBerlakuHari[0], BATAS_KEBIJAKAN_SANDI.masaBerlakuHari[1], d.masaBerlakuHari),
    aktifSejak: b[KUNCI.aktifSejak] ?? "",
  };
}

function periksaRentang(nama: string, nilai: unknown, [min, maks]: readonly [number, number]) {
  const n = Number(nilai);
  if (!Number.isFinite(n) || Math.round(n) !== n || n < min || n > maks) throw new Error(`${nama} harus bilangan bulat ${min}-${maks}.`);
  return n;
}

export type UbahKebijakanSandi = Partial<Omit<KebijakanSandi, "versi" | "aktifSejak">>;

/** Menyimpan perubahan; melempar Error berbahasa Indonesia bila nilainya di luar batas. Versi naik bila aturan berubah. */
export async function simpanKebijakanSandi(db: AletaDatabase, ubah: UbahKebijakanSandi, olehId: string, kini = new Date()) {
  const lama = await bacaKebijakanSandi(db);
  const pasangan: Array<[string, string]> = [];
  let aturanBerubah = false;
  const boolKunci: Array<["tolakUmum" | "tolakIdentitas" | "wajibCampuran", string, boolean]> = [
    ["tolakUmum", KUNCI.tolakUmum, lama.tolakUmum],
    ["tolakIdentitas", KUNCI.tolakIdentitas, lama.tolakIdentitas],
    ["wajibCampuran", KUNCI.wajibCampuran, lama.wajibCampuran],
  ];
  for (const [nama, kunci, nilaiLama] of boolKunci) {
    if (ubah[nama] === undefined) continue;
    const baru = Boolean(ubah[nama]);
    pasangan.push([kunci, baru ? "1" : "0"]);
    if (baru !== nilaiLama) aturanBerubah = true;
  }
  if (ubah.panjangMin !== undefined) {
    const n = periksaRentang("Panjang minimal sandi", ubah.panjangMin, BATAS_KEBIJAKAN_SANDI.panjangMin);
    pasangan.push([KUNCI.panjangMin, String(n)]);
    if (n !== lama.panjangMin) aturanBerubah = true;
  }
  if (ubah.riwayatN !== undefined) {
    const n = periksaRentang("Larangan pakai ulang sandi", ubah.riwayatN, BATAS_KEBIJAKAN_SANDI.riwayatN);
    pasangan.push([KUNCI.riwayatN, String(n)]);
    if (n !== lama.riwayatN) aturanBerubah = true;
  }
  if (ubah.masaBerlakuHari !== undefined) {
    const n = periksaRentang("Masa berlaku sandi", ubah.masaBerlakuHari, BATAS_KEBIJAKAN_SANDI.masaBerlakuHari);
    pasangan.push([KUNCI.masaBerlakuHari, String(n)]);
    if (n !== lama.masaBerlakuHari) aturanBerubah = true;
  }
  if (ubah.aktif !== undefined) {
    const aktif = Boolean(ubah.aktif);
    pasangan.push([KUNCI.aktif, aktif ? "1" : "0"]);
    // Pangkal hitungan masa berlaku bagi akun yang belum tercatat: saat saklar dinyalakan,
    // supaya menyalakannya tidak langsung menghanguskan sandi semua orang.
    if (aktif && !lama.aktif) {
      pasangan.push([KUNCI.aktifSejak, kini.toISOString()]);
      aturanBerubah = true;
    }
  }
  if (aturanBerubah) pasangan.push([KUNCI.versi, String(lama.versi + 1)]);
  if (pasangan.length) await tulisSetelan(db, pasangan, olehId, kini);
  return bacaKebijakanSandi(db);
}

// ─── Pemeriksaan aturan ──────────────────────────────────────────────────────

export type IdentitasAkun = { username?: string | null; nama?: string | null; nip?: string | null; email?: string | null; whatsapp?: string | null };

const hurufAngka = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Potongan identitas yang tidak boleh dimuat sandi (huruf kecil, hanya huruf-angka). */
export function potonganIdentitas(i: IdentitasAkun): string[] {
  const hasil = new Set<string>();
  const tambah = (t: string, min: number) => {
    const b = hurufAngka(t);
    if (b.length >= min) hasil.add(b);
  };
  tambah(String(i.username ?? ""), 3);
  for (const kata of String(i.nama ?? "").split(/[\s.,]+/)) tambah(kata, 4);
  const nip = String(i.nip ?? "").replace(/\D/g, "");
  if (nip.length >= 6) {
    hasil.add(nip);
    hasil.add(nip.slice(0, 8)); // tanggal lahir pada NIP
    hasil.add(nip.slice(-6));
  }
  tambah(String(i.email ?? "").split("@")[0] ?? "", 3);
  const wa = String(i.whatsapp ?? "").replace(/\D/g, "");
  if (wa.length >= 8) hasil.add(wa.slice(-8));
  return [...hasil].filter((x) => x.length >= 3);
}

/** Daftar pelanggaran (kalimat siap tampil). Fungsi murni: tanpa basis data. */
export function periksaAturanSandi(sandi: string, k: KebijakanSandi, identitas: IdentitasAkun = {}): string[] {
  const salah: string[] = [];
  if (sandi.length < k.panjangMin) salah.push(`Sandi minimal ${k.panjangMin} karakter.`);
  if (k.wajibCampuran) {
    if (!/[A-Za-z]/.test(sandi)) salah.push("Sandi harus memuat minimal satu huruf.");
    if (!/[0-9]/.test(sandi)) salah.push("Sandi harus memuat minimal satu angka.");
  }
  if (k.tolakUmum && sandiTerlaluUmum(sandi)) salah.push("Sandi terlalu umum atau mudah ditebak. Pilih yang lebih sulit.");
  if (k.tolakIdentitas) {
    const polos = hurufAngka(sandi);
    if (potonganIdentitas(identitas).some((p) => polos.includes(p))) {
      salah.push("Sandi tidak boleh memuat nama, username, NIP, atau email Anda.");
    }
  }
  return salah;
}

export function sidikRiwayat(userId: string, sandi: string) {
  return crypto.createHmac("sha256", `aleta-riwayat-sandi:${userId}`).update(sandi).digest("hex");
}

async function identitasDariDb(db: AletaDatabase, userId: string): Promise<IdentitasAkun> {
  try {
    const u = await db.queryOne<{ username: string | null; name: string | null; nip: string | null; email: string | null; whatsapp_number: string | null }>(
      "SELECT username, name, nip, email, whatsapp_number FROM users WHERE id = ?",
      [userId]
    );
    return { username: u?.username, nama: u?.name, nip: u?.nip, email: u?.email, whatsapp: u?.whatsapp_number };
  } catch {
    return {};
  }
}

/**
 * Menegakkan kebijakan atas SANDI BARU. Tak berbuat apa pun bila saklar mati.
 * Melempar ApiError 400 berisi semua pelanggaran. Panggil dengan `db` biasa,
 * BUKAN klien transaksi (tabel yang belum ada akan membatalkan transaksinya).
 */
export async function tegakkanKebijakanSandi(
  db: AletaDatabase,
  m: { userId?: string | null; sandi: string; identitas?: IdentitasAkun }
): Promise<void> {
  const k = await bacaKebijakanSandi(db);
  if (!k.aktif) return;
  const identitas = m.identitas ?? (m.userId ? await identitasDariDb(db, m.userId) : {});
  const salah = periksaAturanSandi(m.sandi, k, identitas);
  if (m.userId && k.riwayatN > 0) {
    const sidik = sidikRiwayat(m.userId, m.sandi);
    const lama = await db.queryAll<{ sidik: string }>(
      "SELECT sidik FROM aleta_riwayat_sandi WHERE user_id = ? ORDER BY dibuat_pada DESC LIMIT ?",
      [m.userId, k.riwayatN]
    );
    const sekarang = await db.queryOne<{ password_hash: string | null }>("SELECT password_hash FROM users WHERE id = ?", [m.userId]).catch(() => undefined);
    if (lama.some((b) => b.sidik === sidik) || (sekarang?.password_hash && sekarang.password_hash === hashSecret(m.sandi))) {
      salah.push(`Sandi ini sudah pernah dipakai. Pilih sandi yang berbeda dari ${k.riwayatN} sandi terakhir.`);
    }
  }
  if (salah.length) throw new ApiError(400, salah.join(" "), { alasan: "kebijakan_sandi", pelanggaran: salah });
}

/**
 * Mencatat sandi yang BARU tersimpan: sidiknya ke riwayat, dan status akun
 * (kapan, di bawah versi kebijakan berapa). `sementara` = sandi sementara dari
 * admin -> akun dipaksa ganti sandi (hanya bila saklar menyala). Tidak pernah
 * melempar: sandi sudah berganti, pencatatan yang gagal tidak boleh membatalkannya.
 */
export async function catatSandiTersimpan(
  db: AletaDatabase,
  m: { userId: string; sandi: string; sementara?: boolean; olehId?: string; kini?: Date }
) {
  try {
    const k = await bacaKebijakanSandi(db);
    const waktu = (m.kini ?? new Date()).toISOString();
    await db
      .prepare("INSERT INTO aleta_riwayat_sandi (id, user_id, sidik, dibuat_pada) VALUES (?, ?, ?, ?)")
      .run(`rs-${crypto.randomUUID()}`, m.userId, sidikRiwayat(m.userId, m.sandi), waktu);
    const lebih = await db.queryAll<{ id: string }>(
      "SELECT id FROM aleta_riwayat_sandi WHERE user_id = ? ORDER BY dibuat_pada DESC, id DESC LIMIT 1000 OFFSET ?",
      [m.userId, SIMPAN_RIWAYAT_MAKS]
    );
    for (const b of lebih) await db.run("DELETE FROM aleta_riwayat_sandi WHERE id = ?", [b.id]);
    const paksa = k.aktif && m.sementara ? 1 : 0;
    await db
      .prepare(
        `INSERT INTO aleta_status_sandi (user_id, diganti_pada, versi_kebijakan, paksa_ganti, paksa_oleh, paksa_pada)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET diganti_pada = excluded.diganti_pada, versi_kebijakan = excluded.versi_kebijakan,
           paksa_ganti = excluded.paksa_ganti, paksa_oleh = excluded.paksa_oleh, paksa_pada = excluded.paksa_pada`
      )
      .run(m.userId, waktu, k.aktif ? k.versi : 0, paksa, paksa ? (m.olehId ?? "") : "", paksa ? waktu : "");
  } catch (galat) {
    console.warn("[KEBIJAKAN SANDI] riwayat tidak tercatat:", galat instanceof Error ? galat.message : "tidak diketahui");
  }
}

// ─── Status per akun ─────────────────────────────────────────────────────────

export type AlasanGantiSandi = "dipaksa" | "kedaluwarsa";
export type StatusSandi = { dipaksa: boolean; gantiPada: string; versi: number };

async function bacaStatus(db: AletaDatabase, userId: string): Promise<StatusSandi> {
  const b = await db
    .queryOne<{ diganti_pada: string; versi_kebijakan: number; paksa_ganti: number }>(
      "SELECT diganti_pada, versi_kebijakan, paksa_ganti FROM aleta_status_sandi WHERE user_id = ?",
      [userId]
    )
    .catch(() => undefined);
  return { dipaksa: Number(b?.paksa_ganti ?? 0) === 1, gantiPada: String(b?.diganti_pada ?? ""), versi: Number(b?.versi_kebijakan ?? 0) };
}

/** Fungsi murni: apakah akun HARUS ganti sandi sekarang, dan mengapa. */
export function keputusanWajibGanti(k: KebijakanSandi, s: StatusSandi, kini = new Date()): { wajib: boolean; alasan: "" | AlasanGantiSandi } {
  if (!k.aktif) return { wajib: false, alasan: "" };
  if (s.dipaksa) return { wajib: true, alasan: "dipaksa" };
  if (k.masaBerlakuHari > 0) {
    const pangkal = Date.parse(s.gantiPada || k.aktifSejak);
    if (Number.isFinite(pangkal) && kini.getTime() - pangkal > k.masaBerlakuHari * 86_400_000) return { wajib: true, alasan: "kedaluwarsa" };
  }
  return { wajib: false, alasan: "" };
}

/** Dipakai tata letak portal: saklar mati -> satu pembacaan setelan lalu selesai. Tidak pernah melempar. */
export async function wajibGantiSandi(db: AletaDatabase, userId: string, kini = new Date()): Promise<{ wajib: boolean; alasan: "" | AlasanGantiSandi }> {
  try {
    const k = await bacaKebijakanSandi(db);
    if (!k.aktif) return { wajib: false, alasan: "" };
    return keputusanWajibGanti(k, await bacaStatus(db, userId), kini);
  } catch {
    return { wajib: false, alasan: "" };
  }
}

export type AkunBelumMemenuhi = {
  userId: string;
  username: string;
  nama: string;
  peran: string;
  alasan: "dipaksa" | "kedaluwarsa" | "belum-diganti";
  gantiPada: string;
};

/** Akun aktif yang sandinya belum terbukti memenuhi kebijakan sekarang. Kosong bila saklar mati. */
export async function daftarAkunBelumMemenuhi(db: AletaDatabase, kini = new Date()): Promise<AkunBelumMemenuhi[]> {
  const k = await bacaKebijakanSandi(db);
  if (!k.aktif) return [];
  const baris = await db.queryAll<{
    id: string;
    username: string;
    name: string;
    role_id: string;
    diganti_pada: string | null;
    versi_kebijakan: number | null;
    paksa_ganti: number | null;
  }>(
    `SELECT u.id, u.username, u.name, u.role_id, s.diganti_pada, s.versi_kebijakan, s.paksa_ganti
       FROM users u LEFT JOIN aleta_status_sandi s ON s.user_id = u.id
      WHERE u.deleted_at IS NULL AND u.is_active = 1
      ORDER BY u.name`
  );
  const hasil: AkunBelumMemenuhi[] = [];
  for (const b of baris) {
    const status: StatusSandi = { dipaksa: Number(b.paksa_ganti ?? 0) === 1, gantiPada: String(b.diganti_pada ?? ""), versi: Number(b.versi_kebijakan ?? 0) };
    const wajib = keputusanWajibGanti(k, status, kini);
    const alasan: AkunBelumMemenuhi["alasan"] | null = wajib.wajib ? (wajib.alasan as "dipaksa" | "kedaluwarsa") : status.versi < k.versi ? "belum-diganti" : null;
    if (alasan) hasil.push({ userId: b.id, username: b.username, nama: b.name, peran: b.role_id, alasan, gantiPada: status.gantiPada });
  }
  return hasil;
}

/** Super Admin menandai akun: ganti sandi pada masuk berikutnya (atau menariknya kembali). */
export async function setPaksaGanti(db: AletaDatabase, userId: string, paksa: boolean, olehId: string, kini = new Date()) {
  const ada = await db.queryOne<{ id: string }>("SELECT id FROM users WHERE id = ? AND deleted_at IS NULL", [userId]);
  if (!ada) throw new ApiError(404, "Akun tidak ditemukan.");
  const waktu = kini.toISOString();
  await db
    .prepare(
      `INSERT INTO aleta_status_sandi (user_id, diganti_pada, versi_kebijakan, paksa_ganti, paksa_oleh, paksa_pada)
       VALUES (?, '', 0, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET paksa_ganti = excluded.paksa_ganti, paksa_oleh = excluded.paksa_oleh, paksa_pada = excluded.paksa_pada`
    )
    .run(userId, paksa ? 1 : 0, paksa ? olehId : "", paksa ? waktu : "");
}
