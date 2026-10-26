import { hariLibur as tanggalLibur } from "@/lib/hari-libur";
import { golonganPengguna, type PenggunaGolongan } from "@/lib/matriks-peran";
import { isPrivilegedAdmin } from "@/lib/permissions";
import {
  SEMUA_ATURAN,
  nilaiTenggat,
  susunLaporanHarian,
  type Butir,
  type FaktaTenggat,
  type Rapor,
} from "@/lib/penjaga-tenggat";
import {
  KUNCI_SETELAN_TENGGAT,
  SETELAN_TENGGAT_BAWAAN,
  bersihkanSetelanTenggat,
  butirUntukPenerima,
  jatuhTempoTenggat,
  pemilikButir,
  pengingatWaAktif,
  potongPesan,
  raporDariButir,
  ringkasLonceng,
  type RingkasanLonceng,
  type SetelanTenggat,
} from "@/lib/tenggat-terjadwal";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import type { AletaDatabase } from "@/server/db/client";
import { getGatewayPenjagaTenggat } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { bacaHariLibur } from "@/server/modules/hari-libur/sumber";
import { bacaKunci, tulisKunci } from "@/server/modules/tunda-otomatis/layanan";
import { sendPortalWhatsappMessage, type PortalWhatsappSendInput, type PortalWhatsappSendResult } from "@/server/modules/whatsapp/portal-whatsapp-sender";

/**
 * ============================================================================
 * PENJAGA TENGGAT TERJADWAL (G1, 25 Okt 2026) - PENJADWAL, HASIL HARIAN, PENGINGAT WA
 * ============================================================================
 *
 * Aturan murninya di @/lib/penjaga-tenggat dan @/lib/tenggat-terjadwal (diuji tanpa basis data). Modul ini:
 *
 *   - SETELAN di aleta_ekstensi_setelan (pengguna '*sistem*', kunci 'sistem:penjaga-tenggat'), tanpa migrasi,
 *     pola yang sama dengan tunda otomatis. Dua saklar, KEDUANYA MATI bawaan (jadwal; pengingat WhatsApp).
 *   - HASIL HARIAN di kunci 'sistem:penjaga-tenggat:hari:YYYY-MM-DD': fakta dari SIPP (hanya MEMBACA lewat
 *     bot) sudah dinilai - dasar layar Tenggat, lonceng, dan pengingat. Hasil lebih dari 14 hari dibuang.
 *   - PENJADWAL: detak 5 menit (instrumentation.ts), sekali per tanggal pada jam pemicu (bawaan 07.30 WITA),
 *     HANYA pada hari kerja dan HANYA bila saklar jadwal menyala. Saklar mati = tidak ada jalan, tidak ada
 *     pembacaan SIPP, tidak ada catatan.
 *   - PENGINGAT WHATSAPP: hanya bila KEDUA saklar menyala. Satu pesan ringkas per orang per hari, hanya
 *     perkara yang namanya tercantum sebagai majelis / panitera pengganti / jurusita / mediator, hanya
 *     aturan yang tercantum di setelan.aturanPengingat. Pencegah ganda: aleta_tenggat_kirim (0110) -
 *     baris DIKLAIM sebelum mengirim.
 *   - LONCENG: pemberitahuan dibaca dari hasil harian oleh tasks/service.ts.
 *
 * Tidak menulis APA PUN ke SIPP/ABT/e-Court.
 */

const teks = (x: unknown) => String(x ?? "").trim();
export const kunciHariTenggat = (tanggal: string) => `${KUNCI_SETELAN_TENGGAT}:hari:${tanggal}`;
const PENGGUNA_SISTEM = "*sistem*";
/** Hasil harian lebih tua dari ini dibuang saat jalan berikutnya. */
const SIMPAN_HARI = 14;
/** Percobaan baca fakta yang gagal dalam satu hari (detak 5 menit): lewat ini berhenti sampai hari berikutnya. */
const BATAS_PERCOBAAN = 6;

// ============================================================================
// BENTUK
// ============================================================================

export type RingkasKirim = {
  pada: string;
  dicoba: number;
  terkirim: number;
  gagal: number;
  dilewati: number;
  tanpaPerkara: number;
};

export type JalanTenggat = {
  pada: string;
  pemicu: "jadwal" | "tangan";
  oleh: string;
  jam: string;
  galat: string;
  /** Aturan yang tidak terbaca dari SIPP (tiap aturan gagal sendiri-sendiri). */
  gagal: Record<string, string>;
};

export type CatatanTenggat = {
  tanggal: string;
  jalan: JalanTenggat | null;
  rapor: Rapor | null;
  wa: RingkasKirim | null;
  percobaan: number;
};

const CATATAN_KOSONG = (tanggal: string): CatatanTenggat => ({ tanggal, jalan: null, rapor: null, wa: null, percobaan: 0 });

export type AkunPenerima = { id: string; nama: string; nomorWa: string };

export type SumberTenggat = {
  fakta(acuan: string): Promise<{ ok: boolean; acuan: string; fakta: Record<string, FaktaTenggat[]>; gagal: Record<string, string>; galat: string }>;
  penerima(db: AletaDatabase): Promise<AkunPenerima[]>;
  kirim(masukan: PortalWhatsappSendInput): Promise<PortalWhatsappSendResult>;
};

export const SUMBER_TENGGAT_BAWAAN: SumberTenggat = {
  async fakta(acuan) {
    const h = await getGatewayPenjagaTenggat(acuan, { baru: true });
    if (!h.ok) return { ok: false, acuan, fakta: {}, gagal: {}, galat: teks(h.error) || "ALETA Bot tidak menjawab." };
    return {
      ok: true,
      acuan: teks(h.data?.acuan) || acuan,
      fakta: (h.data?.fakta || {}) as Record<string, FaktaTenggat[]>,
      gagal: (h.data?.gagal || {}) as Record<string, string>,
      galat: "",
    };
  },
  async penerima(db) {
    const baris = await db.queryAll<{ id: string; name: string; whatsapp_number: string }>(
      `SELECT id, name, whatsapp_number FROM users WHERE deleted_at IS NULL AND is_active = 1`
    );
    return baris.map((b) => ({ id: b.id, nama: teks(b.name), nomorWa: teks(b.whatsapp_number) }));
  },
  kirim: sendPortalWhatsappMessage,
};

// ============================================================================
// SETELAN & CATATAN
// ============================================================================

export async function bacaSetelanTenggat(db: AletaDatabase): Promise<SetelanTenggat> {
  return bersihkanSetelanTenggat((await bacaKunci(db, KUNCI_SETELAN_TENGGAT)) ?? SETELAN_TENGGAT_BAWAAN);
}

/** Hanya dipanggil rute yang sudah memastikan Super Admin. */
export async function simpanSetelanTenggat(
  db: AletaDatabase,
  aktor: { id: string; name?: string | null },
  badan: Record<string, unknown>
): Promise<SetelanTenggat> {
  const lama = await bacaSetelanTenggat(db);
  const baru = bersihkanSetelanTenggat({
    jadwal: typeof badan.jadwal === "boolean" ? badan.jadwal : lama.jadwal,
    pengingatWa: typeof badan.pengingatWa === "boolean" ? badan.pengingatWa : lama.pengingatWa,
    jam: badan.jam ?? lama.jam,
    aturanPengingat: Array.isArray(badan.aturanPengingat) ? badan.aturanPengingat : lama.aturanPengingat,
    diubahOleh: teks(aktor.name) || aktor.id,
    diubahPada: new Date().toISOString(),
  });
  await tulisKunci(db, KUNCI_SETELAN_TENGGAT, baru);
  return baru;
}

export async function bacaCatatanTenggat(db: AletaDatabase, tanggal: string): Promise<CatatanTenggat> {
  const c = await bacaKunci<Partial<CatatanTenggat>>(db, kunciHariTenggat(tanggal));
  if (!c) return CATATAN_KOSONG(tanggal);
  return { tanggal, jalan: c.jalan ?? null, rapor: c.rapor ?? null, wa: c.wa ?? null, percobaan: Number(c.percobaan) || 0 };
}

async function simpanCatatan(db: AletaDatabase, c: CatatanTenggat) {
  await tulisKunci(db, kunciHariTenggat(c.tanggal), c);
}

async function buangLama(db: AletaDatabase, tanggal: string) {
  try {
    const batas = new Date(`${tanggal}T12:00:00Z`);
    batas.setUTCDate(batas.getUTCDate() - SIMPAN_HARI);
    await db.run("DELETE FROM aleta_ekstensi_setelan WHERE pengguna_id = ? AND kunci LIKE ? AND kunci < ?", [
      PENGGUNA_SISTEM,
      `${KUNCI_SETELAN_TENGGAT}:hari:%`,
      kunciHariTenggat(batas.toISOString().slice(0, 10)),
    ]);
  } catch {
    /* pembersihan gagal tidak menggagalkan jalan */
  }
}

// ============================================================================
// SIAPA MELIHAT SEMUA
// ============================================================================

/**
 * Admin, Super Admin, pimpinan, panitera, dan panitera muda melihat tenggat SELURUH satker (layar Tenggat,
 * lonceng ringkasan). Yang lain - hakim, panitera pengganti, jurusita - hanya perkara yang namanya
 * tercantum. Ditegakkan di SERVER, bukan hanya menyembunyikan saringan di layar.
 */
export function lihatSemuaTenggat(aktor: (PenggunaGolongan & Parameters<typeof isPrivilegedAdmin>[0]) | null | undefined): boolean {
  if (!aktor) return false;
  if (isPrivilegedAdmin(aktor)) return true;
  const g = golonganPengguna(aktor);
  return g.includes("pimpinan") || g.includes("panitera") || g.includes("panmud");
}

// ============================================================================
// HASIL: LANGSUNG ATAU HARIAN
// ============================================================================

/**
 * Menilai fakta SIPP untuk satu tanggal (aturan lama + baru, dengan hitung mundur). Tidak menyimpan apa pun.
 * Dipakai jalan terjadwal dan layar Tenggat saat belum ada hasil harian.
 */
export async function nilaiLangsung(
  tanggal: string,
  sumber: SumberTenggat = SUMBER_TENGGAT_BAWAAN
): Promise<{ ok: true; rapor: Rapor; gagal: Record<string, string> } | { ok: false; galat: string }> {
  const f = await sumber.fakta(tanggal);
  if (!f.ok) return { ok: false, galat: f.galat };
  return { ok: true, rapor: nilaiTenggat(f.fakta, f.acuan || tanggal, { aturan: SEMUA_ATURAN, hitungMundur: true }), gagal: f.gagal };
}

// ============================================================================
// PENGINGAT WHATSAPP
// ============================================================================

const NOMOR_SAH = /^\+?\d[\d\s-]{7,18}$/;

export async function kirimPengingat(
  db: AletaDatabase,
  rapor: Rapor,
  setelan: SetelanTenggat,
  opsi: { sumber?: SumberTenggat; kini?: Date; ulangiGagal?: boolean; satker?: string } = {}
): Promise<RingkasKirim> {
  const sumber = opsi.sumber ?? SUMBER_TENGGAT_BAWAAN;
  const ringkas: RingkasKirim = { pada: (opsi.kini ?? new Date()).toISOString(), dicoba: 0, terkirim: 0, gagal: 0, dilewati: 0, tanpaPerkara: 0 };
  // Pagar terakhir: dua saklar, di titik pengirimannya sendiri.
  if (!pengingatWaAktif(setelan)) return ringkas;

  const akun = await sumber.penerima(db);
  for (const a of akun) {
    const butir = butirUntukPenerima(rapor.butir, a.nama, setelan.aturanPengingat);
    if (butir.length === 0) {
      ringkas.tanpaPerkara += 1;
      continue;
    }
    const id = `${rapor.acuan}:${a.id}`;
    const sekarang = (opsi.kini ?? new Date()).toISOString();

    // KLAIM dulu: hanya yang berhasil menulis barisnya yang boleh mengirim. INSERT biasa (bukan ON CONFLICT):
    // kunci utama yang bentrok MELEMPAR di Postgres maupun pg-mem, sehingga klaim atomik dan tidak bergantung
    // pada cara tiap mesin melaporkan "tidak ada baris yang ditulis".
    let boleh = true;
    try {
      await db.run(
        `INSERT INTO aleta_tenggat_kirim (id, tanggal, penerima_id, penerima_nama, status, jumlah_butir, antrean_id, keterangan, dibuat_at, diubah_at)
         VALUES (?, ?, ?, ?, 'diklaim', ?, '', '', ?, ?)`,
        [id, rapor.acuan, a.id, a.nama, butir.length, sekarang, sekarang]
      );
    } catch (galat) {
      const ada = await db.queryOne<{ id: string }>("SELECT id FROM aleta_tenggat_kirim WHERE id = ?", [id]);
      if (!ada) throw galat; // bukan bentrokan kunci: galat sungguhan
      boleh = false;
    }
    if (!boleh && opsi.ulangiGagal) {
      const ulang = await db.run(
        `UPDATE aleta_tenggat_kirim SET status = 'diklaim', jumlah_butir = ?, diubah_at = ? WHERE id = ? AND status = 'gagal'`,
        [butir.length, sekarang, id]
      );
      boleh = Boolean(ulang.changes);
    }
    if (!boleh) continue; // sudah dikirim / sedang dikirim / dilewati hari ini

    const tutup = (status: string, keterangan: string, antrean = "") =>
      db.run(`UPDATE aleta_tenggat_kirim SET status = ?, keterangan = ?, antrean_id = ?, diubah_at = ? WHERE id = ?`, [
        status,
        keterangan.slice(0, 300),
        antrean,
        new Date().toISOString(),
        id,
      ]);

    if (!NOMOR_SAH.test(a.nomorWa)) {
      ringkas.dilewati += 1;
      await tutup("dilewati", "Nomor WhatsApp belum sah.");
      continue;
    }

    ringkas.dicoba += 1;
    try {
      const pesan = potongPesan(
        susunLaporanHarian(raporDariButir(rapor, butir), {
          satker: opsi.satker,
          judul: "PENGINGAT TENGGAT",
          sapaan: `Untuk: ${a.nama}`,
          batasRinci: 4,
        })
      );
      const hasil = await sumber.kirim({
        sourceFeature: "penjaga_tenggat",
        entityType: "tenggat",
        entityId: id,
        eventType: "pengingat-harian",
        recipientNumber: a.nomorWa,
        recipientName: a.nama,
        message: pesan,
        category: "employee",
        priority: 5,
        dryRun: false,
        metadata: { jumlahButir: butir.length },
      });
      if (hasil.ok && (hasil.status === "enqueued" || hasil.status === "sent")) {
        ringkas.terkirim += 1;
        await tutup("terkirim", hasil.message, String(hasil.queueId ?? ""));
      } else if (hasil.status === "skipped") {
        ringkas.dilewati += 1;
        ringkas.dicoba -= 1;
        await tutup("dilewati", hasil.message);
      } else {
        ringkas.gagal += 1;
        await tutup("gagal", hasil.message);
      }
    } catch (e) {
      ringkas.gagal += 1;
      await tutup("gagal", teks((e as Error)?.message) || "Pengiriman gagal.").catch(() => undefined);
    }
  }
  return ringkas;
}

// ============================================================================
// JALAN HARIAN
// ============================================================================

const SIMPAN = globalThis as unknown as { __aletaTenggat?: { berjalan: Set<string>; detak: NodeJS.Timeout | null } };
const wadah = () => (SIMPAN.__aletaTenggat ??= { berjalan: new Set(), detak: null });

/**
 * Satu jalan: baca fakta SIPP (lewat bot), nilai, simpan, lalu (bila KEDUA saklar menyala) kirim pengingat.
 * `jadwal`: sekali per tanggal. `tangan` (Super Admin): menilai ulang dan menimpa hasil hari itu; pengingat yang
 * sudah terkirim tidak dikirim lagi (pencegah ganda), kecuali `ulangiGagal` untuk yang gagal.
 */
export async function jalankanTenggat(
  db: AletaDatabase,
  opsi: { pemicu: "jadwal" | "tangan"; oleh?: string; tanggal?: string; sumber?: SumberTenggat; kini?: Date; ulangiGagal?: boolean; satker?: string } = { pemicu: "jadwal" }
): Promise<CatatanTenggat> {
  const w = wadah();
  const sumber = opsi.sumber ?? SUMBER_TENGGAT_BAWAAN;
  const tanggal = opsi.tanggal || waktuPengadilan(opsi.kini).tanggal;
  const setelan = await bacaSetelanTenggat(db);
  const c = await bacaCatatanTenggat(db, tanggal);
  if (w.berjalan.has(tanggal)) return c;
  if (opsi.pemicu === "jadwal" && c.jalan) return c;
  w.berjalan.add(tanggal);
  try {
    const jam = waktuPengadilan(opsi.kini).jam.slice(0, 5);
    const nilai = await nilaiLangsung(tanggal, sumber);
    if (!nilai.ok) {
      // Gagal baca BUKAN hari bersih: tidak ada hasil, dan detak berikutnya mencoba lagi (sampai BATAS_PERCOBAAN).
      c.percobaan += 1;
      c.jalan = { pada: new Date().toISOString(), pemicu: opsi.pemicu, oleh: teks(opsi.oleh) || "Penjaga tenggat", jam, galat: nilai.galat, gagal: {} };
      if (c.percobaan < BATAS_PERCOBAAN && opsi.pemicu === "jadwal") c.jalan = null;
      await simpanCatatan(db, c);
      return c;
    }
    c.rapor = nilai.rapor;
    c.percobaan = 0;
    c.jalan = { pada: new Date().toISOString(), pemicu: opsi.pemicu, oleh: teks(opsi.oleh) || "Penjaga tenggat", jam, galat: "", gagal: nilai.gagal };
    await simpanCatatan(db, c);
    if (pengingatWaAktif(setelan)) {
      c.wa = await kirimPengingat(db, nilai.rapor, setelan, { sumber, kini: opsi.kini, ulangiGagal: opsi.ulangiGagal, satker: opsi.satker });
      await simpanCatatan(db, c);
    }
    await buangLama(db, tanggal);
  } catch (e) {
    c.jalan = {
      pada: new Date().toISOString(),
      pemicu: opsi.pemicu,
      oleh: teks(opsi.oleh) || "Penjaga tenggat",
      jam: "",
      galat: teks((e as Error)?.message).slice(0, 300) || "Penjaga tenggat gagal.",
      gagal: {},
    };
    await simpanCatatan(db, c).catch(() => undefined);
  } finally {
    w.berjalan.delete(tanggal);
  }
  return c;
}

// ============================================================================
// PENJADWAL
// ============================================================================

export async function detakTenggat(db: AletaDatabase, opsi: { kini?: Date; sumber?: SumberTenggat; env?: Record<string, string | undefined> } = {}) {
  const env = opsi.env ?? process.env;
  if (env.ALETA_PENJAGA_TENGGAT === "0") return null;
  const setelan = await bacaSetelanTenggat(db);
  // Saklar MATI (bawaan) = tidak ada jalan, tidak ada pembacaan SIPP, tidak ada catatan.
  if (!setelan.jadwal) return null;
  const { tanggal, jam } = waktuPengadilan(opsi.kini);
  await bacaHariLibur(db).catch(() => undefined);
  if (tanggalLibur(tanggal)) return null;
  const c = await bacaCatatanTenggat(db, tanggal);
  if (c.percobaan >= BATAS_PERCOBAAN && !c.jalan) return null;
  if (!jatuhTempoTenggat(setelan.jam, jam, Boolean(c.jalan))) return null;
  return jalankanTenggat(db, { pemicu: "jadwal", tanggal, sumber: opsi.sumber, kini: opsi.kini });
}

/** Dinyalakan instrumentation.ts: detak 5 menit. Matikan dengan ALETA_PENJAGA_TENGGAT=0 (atau saklarnya). */
export function mulaiTenggatBerkala(getDb: () => Promise<AletaDatabase>, env: Record<string, string | undefined> = process.env) {
  if (env.ALETA_PENJAGA_TENGGAT === "0") return;
  const w = wadah();
  if (w.detak) return;
  const detak = async () => {
    try {
      await detakTenggat(await getDb(), { env });
    } catch (e) {
      console.error("[PENJAGA TENGGAT] detak gagal:", e);
    }
  };
  w.detak = setInterval(() => void detak(), 5 * 60 * 1000);
  setTimeout(() => void detak(), 120 * 1000);
}

// ============================================================================
// LONCENG (sumber tugas portal /api/tasks)
// ============================================================================

/**
 * Pemberitahuan lonceng satu akun dari hasil harian hari ini. Admin/Super Admin/pimpinan (`lihatSemua`): satu
 * ringkasan seluruh satker; yang lain: hanya perkara yang namanya tercantum. Saklar jadwal mati = tidak ada.
 * Hanya membaca basis data ALETA; gagal baca = tidak ada.
 */
export async function pemberitahuanTenggat(
  db: AletaDatabase,
  opsi: { nama: string; lihatSemua: boolean; kini?: Date }
): Promise<Array<RingkasanLonceng & { waktu: string }>> {
  try {
    const setelan = await bacaSetelanTenggat(db);
    if (!setelan.jadwal) return [];
    const tanggal = waktuPengadilan(opsi.kini).tanggal;
    const c = await bacaCatatanTenggat(db, tanggal);
    if (!c.jalan || !c.rapor) return [];
    const butir: Butir[] = opsi.lihatSemua ? c.rapor.butir : c.rapor.butir.filter((b) => pemilikButir(b, opsi.nama));
    const r = ringkasLonceng(butir, tanggal, opsi.lihatSemua);
    return r ? [{ ...r, waktu: c.jalan.pada }] : [];
  } catch {
    return [];
  }
}
