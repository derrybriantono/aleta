import { hariKerjaBerikut, type SaksiTanyaJawab } from "@/lib/agen-h1-bas";
import { hariLibur as tanggalLibur } from "@/lib/hari-libur";
import {
  butirUntukPetugas,
  nilaiSidang,
  ringkasLoncengKelengkapan,
  susunPesanKelengkapan,
  tanggalPeriksa,
  type FaktaSidangKelengkapan,
  type IdentitasPetugas,
  type PenilaianSidang,
  type RingkasanLoncengKelengkapan,
} from "@/lib/kelengkapan-sidang";
import { golonganPengguna } from "@/lib/matriks-peran";
import { namaAdaDi } from "@/lib/perkara-sendiri";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import type { AletaDatabase } from "@/server/db/client";
import { getGatewayKelengkapanSidang } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { bacaHariLibur } from "@/server/modules/hari-libur/sumber";
import { bacaKunci, tulisKunci } from "@/server/modules/tunda-otomatis/layanan";
import { sendPortalWhatsappMessage, type PortalWhatsappSendInput, type PortalWhatsappSendResult } from "@/server/modules/whatsapp/portal-whatsapp-sender";

/**
 * ============================================================================
 * AGEN KELENGKAPAN HARI SIDANG (N1, 1 Nov 2026) - PENGUMPUL, SIMPANAN, PENJADWAL PAGI, KABAR
 * ============================================================================
 *
 * Aturannya di @/lib/kelengkapan-sidang (murni, diuji); fakta dari bot (kelengkapanSidangService, hanya SELECT). Modul ini:
 *
 *   - SETELAN di aleta_ekstensi_setelan (pengguna '*sistem*', kunci 'sistem:agen-kelengkapan'), tanpa migrasi - pola
 *     penjaga tenggat. Dua saklar: JADWAL (bawaan MENYALA: hanya membaca SIPP dan menulis basis data portal, tanpa
 *     mengirim apa pun) dan KABAR WHATSAPP (bawaan MATI: pesan ke telepon petugas baru menyala setelah Super Admin
 *     memeriksa hasil beberapa hari). Lonceng portal tidak bersaklar sendiri: ia mengikuti hasil harian.
 *   - HASIL HARIAN di kunci 'sistem:agen-kelengkapan:hari:YYYY-MM-DD' (penilaian tiap sidang hari ini + hari kerja berikutnya).
 *     Layar Jadwal Sidang, lonceng, dan pesan semuanya membaca hasil ini - satu penilaian, tiga pemakai. Hasil lebih dari
 *     7 hari dibuang.
 *   - PENJADWAL: detak 5 menit (instrumentation.ts); sekali per tanggal pada jam pemicu (bawaan 07.00 WITA, dapat diatur),
 *     hanya hari kerja. Gagal baca bot tidak dianggap hari bersih: dicoba lagi pada detak berikutnya (sampai 6 kali).
 *   - KABAR WHATSAPP: satu pesan per petugas per hari. Pencegah ganda: tabel aleta_tenggat_kirim yang sudah ada
 *     (id 'kelengkapan:<tanggal>:<akun>'), baris DIKLAIM sebelum mengirim. Butir bertingkat "info" tidak pernah dikirim.
 *
 * Tidak menulis APA PUN ke SIPP/ABT/e-Court.
 */

const teks = (x: unknown) => String(x ?? "").trim();
export const KUNCI_SETELAN_KELENGKAPAN = "sistem:agen-kelengkapan";
export const kunciHariKelengkapan = (tanggal: string) => `${KUNCI_SETELAN_KELENGKAPAN}:hari:${tanggal}`;
const PENGGUNA_SISTEM = "*sistem*";
const SIMPAN_HARI = 7;
const BATAS_PERCOBAAN = 6;
const BATAS_TANYA_JAWAB = 40;
const NOMOR_SAH = /^\+?\d[\d\s-]{7,18}$/;

// ============================================================================
// SETELAN
// ============================================================================

export type SetelanKelengkapan = { jadwal: boolean; pengingatWa: boolean; jam: string; diubahOleh: string; diubahPada: string };
export const SETELAN_KELENGKAPAN_BAWAAN: Readonly<SetelanKelengkapan> = Object.freeze({ jadwal: true, pengingatWa: false, jam: "07:00", diubahOleh: "", diubahPada: "" });

export function jamKelengkapanSah(jam: unknown): string {
  const j = teks(jam);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(j) ? j : SETELAN_KELENGKAPAN_BAWAAN.jam;
}

export function bersihkanSetelanKelengkapan(mentah: unknown): SetelanKelengkapan {
  const m = (mentah && typeof mentah === "object" ? mentah : {}) as Record<string, unknown>;
  return {
    jadwal: typeof m.jadwal === "boolean" ? m.jadwal : SETELAN_KELENGKAPAN_BAWAAN.jadwal,
    pengingatWa: typeof m.pengingatWa === "boolean" ? m.pengingatWa : SETELAN_KELENGKAPAN_BAWAAN.pengingatWa,
    jam: jamKelengkapanSah(m.jam),
    diubahOleh: teks(m.diubahOleh),
    diubahPada: teks(m.diubahPada),
  };
}

export async function bacaSetelanKelengkapan(db: AletaDatabase): Promise<SetelanKelengkapan> {
  return bersihkanSetelanKelengkapan(await bacaKunci(db, KUNCI_SETELAN_KELENGKAPAN));
}

export async function simpanSetelanKelengkapan(db: AletaDatabase, aktor: { id: string; name?: string | null }, badan: Record<string, unknown>): Promise<SetelanKelengkapan> {
  const lama = await bacaSetelanKelengkapan(db);
  const baru = bersihkanSetelanKelengkapan({
    jadwal: typeof badan.jadwal === "boolean" ? badan.jadwal : lama.jadwal,
    pengingatWa: typeof badan.pengingatWa === "boolean" ? badan.pengingatWa : lama.pengingatWa,
    jam: badan.jam ?? lama.jam,
    diubahOleh: teks(aktor.name) || aktor.id,
    diubahPada: new Date().toISOString(),
  });
  await tulisKunci(db, KUNCI_SETELAN_KELENGKAPAN, baru);
  return baru;
}

// ============================================================================
// BENTUK & SUMBER
// ============================================================================

export type RingkasKirimKelengkapan = { pada: string; dicoba: number; terkirim: number; gagal: number; dilewati: number; tanpaButir: number };
export type JalanKelengkapan = {
  pada: string;
  pemicu: "jadwal" | "tangan" | "permintaan";
  oleh: string;
  jam: string;
  galat: string;
  /** Sumber fakta yang gagal sebagian (nama -> sebab), mis. "panjar". */
  gagal: Record<string, string>;
  /** Waktu tiap tahap, milidetik: jadwal, kuasa, panjar, ... plus "total". */
  ms: Record<string, number>;
  diperiksa: number;
  terpotong: boolean;
};
export type CatatanKelengkapan = {
  tanggal: string;
  jalan: JalanKelengkapan | null;
  /** Tanggal sidang yang diperiksa pada jalan ini. */
  diperiksaUntuk: string[];
  penilaian: PenilaianSidang[];
  wa: RingkasKirimKelengkapan | null;
  percobaan: number;
};
const CATATAN_KOSONG = (tanggal: string): CatatanKelengkapan => ({ tanggal, jalan: null, diperiksaUntuk: [], penilaian: [], wa: null, percobaan: 0 });

export type AkunPetugas = IdentitasPetugas;

export type SumberKelengkapan = {
  fakta(hariIni: string, tanggal: string[]): Promise<{ ok: boolean; sidang: FaktaSidangKelengkapan[]; gagal: Record<string, string>; ms: Record<string, number>; terpotong: boolean; galat: string }>;
  tanyaJawab(perkaraId: string): Promise<SaksiTanyaJawab[]>;
  penerima(db: AletaDatabase): Promise<AkunPetugas[]>;
  kirim(masukan: PortalWhatsappSendInput): Promise<PortalWhatsappSendResult>;
};

export const SUMBER_KELENGKAPAN_BAWAAN: SumberKelengkapan = {
  async fakta(hariIni, tanggal) {
    const h = await getGatewayKelengkapanSidang(hariIni, tanggal);
    if (!h.ok) return { ok: false, sidang: [], gagal: {}, ms: {}, terpotong: false, galat: teks(h.error) || "ALETA Bot tidak menjawab." };
    return {
      ok: true,
      sidang: (h.data?.sidang ?? []) as FaktaSidangKelengkapan[],
      gagal: (h.data?.gagal ?? {}) as Record<string, string>,
      ms: (h.data?.ms ?? {}) as Record<string, number>,
      terpotong: Boolean(h.data?.terpotong),
      galat: "",
    };
  },
  async tanyaJawab(perkaraId) {
    try {
      const j = await callAletaBotSippBridge<{ saksi?: SaksiTanyaJawab[] }>("case.pemeriksaanSaksi", { perkaraId }, { timeoutMs: 15000 });
      return j.ok && Array.isArray(j.data?.saksi) ? j.data!.saksi! : [];
    } catch {
      return [];
    }
  },
  async penerima(db) {
    const baris = await db.queryAll<{ id: string; name: string; whatsapp_number: string; role_id: string; position_id: string; additional_role_ids_json: string }>(
      `SELECT id, name, whatsapp_number, role_id, position_id, additional_role_ids_json FROM users WHERE deleted_at IS NULL AND is_active = 1`
    );
    return baris.map((b) => {
      let tambahan: string[] = [];
      try {
        const p = JSON.parse(String(b.additional_role_ids_json || "[]"));
        tambahan = Array.isArray(p) ? p.map(String) : [];
      } catch {
        tambahan = [];
      }
      return {
        id: b.id,
        nama: teks(b.name),
        nomorWa: teks(b.whatsapp_number),
        golongan: golonganPengguna({ id: b.id, roleId: b.role_id, positionId: b.position_id, additionalRoleIds: tambahan }),
      };
    });
  },
  kirim: sendPortalWhatsappMessage,
};

// ============================================================================
// CATATAN HARIAN
// ============================================================================

export async function bacaCatatanKelengkapan(db: AletaDatabase, tanggal: string): Promise<CatatanKelengkapan> {
  const c = await bacaKunci<Partial<CatatanKelengkapan>>(db, kunciHariKelengkapan(tanggal));
  if (!c) return CATATAN_KOSONG(tanggal);
  return {
    tanggal,
    jalan: c.jalan ?? null,
    diperiksaUntuk: Array.isArray(c.diperiksaUntuk) ? c.diperiksaUntuk : [],
    penilaian: Array.isArray(c.penilaian) ? c.penilaian : [],
    wa: c.wa ?? null,
    percobaan: Number(c.percobaan) || 0,
  };
}

async function simpanCatatan(db: AletaDatabase, c: CatatanKelengkapan) {
  await tulisKunci(db, kunciHariKelengkapan(c.tanggal), c);
}

async function buangLama(db: AletaDatabase, tanggal: string) {
  try {
    const batas = new Date(`${tanggal}T12:00:00Z`);
    batas.setUTCDate(batas.getUTCDate() - SIMPAN_HARI);
    await db.run("DELETE FROM aleta_ekstensi_setelan WHERE pengguna_id = ? AND kunci LIKE ? AND kunci < ?", [
      PENGGUNA_SISTEM,
      `${KUNCI_SETELAN_KELENGKAPAN}:hari:%`,
      kunciHariKelengkapan(batas.toISOString().slice(0, 10)),
    ]);
  } catch {
    /* pembersihan gagal tidak menggagalkan jalan */
  }
}

// ============================================================================
// PENILAIAN
// ============================================================================

/**
 * Menilai fakta bot menjadi penilaian per sidang. Tanya jawab saksi (ABT) hanya ditanyakan untuk sidang beragenda
 * pembuktian yang punya saksi tercatat, paling banyak BATAS_TANYA_JAWAB perkara - satu panggilan kecil per perkara.
 */
export async function nilaiFakta(fakta: FaktaSidangKelengkapan[], hariIni: string, sumber: SumberKelengkapan): Promise<PenilaianSidang[]> {
  const hasil: PenilaianSidang[] = [];
  let ditanya = 0;
  for (const f of fakta) {
    let bertanyaJawab: number | null = null;
    const adaSaksi = (Number(f.saksiPihak1) || 0) + (Number(f.saksiPihak2) || 0) > 0;
    if (adaSaksi && /bukti|saksi|pembuktian/i.test(teks(f.agenda)) && ditanya < BATAS_TANYA_JAWAB) {
      ditanya += 1;
      const tj = await sumber.tanyaJawab(teks(f.perkaraId));
      bertanyaJawab = (Array.isArray(tj) ? tj : []).filter((s) => Array.isArray(s.tanyaJawab) && (s.tanyaJawab as unknown[]).length > 0).length;
    }
    hasil.push(nilaiSidang(f, { hariIni, saksiBertanyaJawab: bertanyaJawab }));
  }
  return hasil;
}

// ============================================================================
// KABAR WHATSAPP
// ============================================================================

export async function kirimKabarKelengkapan(
  db: AletaDatabase,
  penilaian: PenilaianSidang[],
  hariIni: string,
  opsi: { sumber?: SumberKelengkapan; kini?: Date; ulangiGagal?: boolean; satker?: string } = {}
): Promise<RingkasKirimKelengkapan> {
  const sumber = opsi.sumber ?? SUMBER_KELENGKAPAN_BAWAAN;
  const ringkas: RingkasKirimKelengkapan = { pada: (opsi.kini ?? new Date()).toISOString(), dicoba: 0, terkirim: 0, gagal: 0, dilewati: 0, tanpaButir: 0 };
  const akun = await sumber.penerima(db);
  for (const a of akun) {
    const baris = butirUntukPetugas(penilaian, a, namaAdaDi);
    if (baris.length === 0) {
      ringkas.tanpaButir += 1;
      continue;
    }
    const id = `kelengkapan:${hariIni}:${a.id}`;
    const sekarang = (opsi.kini ?? new Date()).toISOString();
    // KLAIM dulu (INSERT biasa: kunci utama bentrok melempar di Postgres maupun pg-mem) - hanya yang berhasil menulis boleh mengirim.
    let boleh = true;
    try {
      await db.run(
        `INSERT INTO aleta_tenggat_kirim (id, tanggal, penerima_id, penerima_nama, status, jumlah_butir, antrean_id, keterangan, dibuat_at, diubah_at)
         VALUES (?, ?, ?, ?, 'diklaim', ?, '', '', ?, ?)`,
        [id, hariIni, a.id, a.nama, baris.reduce((n, b) => n + b.butir.length, 0), sekarang, sekarang]
      );
    } catch (galat) {
      const ada = await db.queryOne<{ id: string }>("SELECT id FROM aleta_tenggat_kirim WHERE id = ?", [id]);
      if (!ada) throw galat;
      boleh = false;
    }
    if (!boleh && opsi.ulangiGagal) {
      const ulang = await db.run(`UPDATE aleta_tenggat_kirim SET status = 'diklaim', diubah_at = ? WHERE id = ? AND status = 'gagal'`, [sekarang, id]);
      boleh = Boolean(ulang.changes);
    }
    if (!boleh) continue;
    const tutup = (status: string, keterangan: string, antrean = "") =>
      db.run(`UPDATE aleta_tenggat_kirim SET status = ?, keterangan = ?, antrean_id = ?, diubah_at = ? WHERE id = ?`, [status, keterangan.slice(0, 300), antrean, new Date().toISOString(), id]);
    if (!NOMOR_SAH.test(a.nomorWa)) {
      ringkas.dilewati += 1;
      await tutup("dilewati", "Nomor WhatsApp belum sah.");
      continue;
    }
    ringkas.dicoba += 1;
    try {
      const hasil = await sumber.kirim({
        sourceFeature: "kelengkapan_sidang",
        entityType: "kelengkapan",
        entityId: id,
        eventType: "kesiapan-sidang-harian",
        recipientNumber: a.nomorWa,
        recipientName: a.nama,
        message: susunPesanKelengkapan({ nama: a.nama, hariIni, baris, satker: opsi.satker }),
        category: "employee",
        priority: 5,
        dryRun: false,
        metadata: { jumlahPerkara: baris.length },
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

const SIMPAN = globalThis as unknown as { __aletaKelengkapan?: { berjalan: Set<string>; detak: NodeJS.Timeout | null; coba: Map<string, number> } };
const wadah = () => (SIMPAN.__aletaKelengkapan ??= { berjalan: new Set(), detak: null, coba: new Map() });

/** Untuk uji. */
export function bersihkanAgenKelengkapan() {
  const w = wadah();
  w.berjalan.clear();
  w.coba.clear();
}

/**
 * Satu jalan: baca fakta (hari ini + hari kerja berikutnya), nilai, simpan, lalu - bila saklar WhatsApp menyala - kabari.
 * `jadwal`: sekali per tanggal. `tangan` (Admin): menilai ulang dan menimpa hasil hari itu; pesan yang sudah terkirim tidak
 * dikirim lagi (pencegah ganda). Kegagalan membaca BUKAN hari bersih: tidak ada hasil, detak berikutnya mencoba lagi.
 */
export async function jalankanKelengkapan(
  db: AletaDatabase,
  opsi: { pemicu: "jadwal" | "tangan" | "permintaan"; oleh?: string; tanggal?: string; sumber?: SumberKelengkapan; kini?: Date; ulangiGagal?: boolean; satker?: string } = { pemicu: "jadwal" }
): Promise<CatatanKelengkapan> {
  const w = wadah();
  const sumber = opsi.sumber ?? SUMBER_KELENGKAPAN_BAWAAN;
  const hariIni = opsi.tanggal || waktuPengadilan(opsi.kini).tanggal;
  const setelan = await bacaSetelanKelengkapan(db);
  const c = await bacaCatatanKelengkapan(db, hariIni);
  if (w.berjalan.has(hariIni)) return c;
  if (opsi.pemicu !== "tangan" && c.jalan && !c.jalan.galat) return c;
  w.berjalan.add(hariIni);
  const mulai = Date.now();
  try {
    await bacaHariLibur(db).catch(() => undefined);
    const tanggal = tanggalPeriksa(hariIni, hariKerjaBerikut(hariIni));
    const jam = waktuPengadilan(opsi.kini).jam.slice(0, 5);
    const f = await sumber.fakta(hariIni, tanggal);
    if (!f.ok) {
      c.percobaan += 1;
      c.jalan = { pada: new Date().toISOString(), pemicu: opsi.pemicu, oleh: teks(opsi.oleh) || "Agen kelengkapan", jam, galat: f.galat, gagal: {}, ms: {}, diperiksa: 0, terpotong: false };
      await simpanCatatan(db, c);
      return c;
    }
    const penilaian = await nilaiFakta(f.sidang, hariIni, sumber);
    c.percobaan = 0;
    c.diperiksaUntuk = tanggal;
    c.penilaian = penilaian;
    c.jalan = {
      pada: new Date().toISOString(),
      pemicu: opsi.pemicu,
      oleh: teks(opsi.oleh) || "Agen kelengkapan",
      jam,
      galat: "",
      gagal: f.gagal,
      ms: { ...f.ms, total: Date.now() - mulai },
      diperiksa: penilaian.length,
      terpotong: f.terpotong,
    };
    await simpanCatatan(db, c);
    if (setelan.pengingatWa) {
      c.wa = await kirimKabarKelengkapan(db, penilaian, hariIni, { sumber, kini: opsi.kini, ulangiGagal: opsi.ulangiGagal, satker: opsi.satker });
      await simpanCatatan(db, c);
    }
    await buangLama(db, hariIni);
  } catch (e) {
    c.jalan = {
      pada: new Date().toISOString(),
      pemicu: opsi.pemicu,
      oleh: teks(opsi.oleh) || "Agen kelengkapan",
      jam: "",
      galat: teks((e as Error)?.message).slice(0, 300) || "Agen kelengkapan gagal.",
      gagal: {},
      ms: {},
      diperiksa: 0,
      terpotong: false,
    };
    await simpanCatatan(db, c).catch(() => undefined);
  } finally {
    w.berjalan.delete(hariIni);
  }
  return c;
}

// ============================================================================
// PENJADWAL
// ============================================================================

/** Waktunya jalan: hari kerja, sudah lewat jamnya, dan belum ada hasil sah hari ini. Murni atas masukan. */
export function jatuhTempoKelengkapan(jamPemicu: string, jamSekarang: string, sudahJalan: boolean): boolean {
  if (sudahJalan) return false;
  return jamSekarang.slice(0, 5) >= jamPemicu;
}

export async function detakKelengkapan(db: AletaDatabase, opsi: { kini?: Date; sumber?: SumberKelengkapan; env?: Record<string, string | undefined> } = {}) {
  const env = opsi.env ?? process.env;
  if (env.ALETA_AGEN_KELENGKAPAN === "0") return null;
  const setelan = await bacaSetelanKelengkapan(db);
  if (!setelan.jadwal) return null;
  const { tanggal, jam } = waktuPengadilan(opsi.kini);
  await bacaHariLibur(db).catch(() => undefined);
  if (tanggalLibur(tanggal)) return null;
  const c = await bacaCatatanKelengkapan(db, tanggal);
  if (c.percobaan >= BATAS_PERCOBAAN && c.jalan?.galat) return null;
  if (!jatuhTempoKelengkapan(setelan.jam, jam, Boolean(c.jalan && !c.jalan.galat))) return null;
  return jalankanKelengkapan(db, { pemicu: "jadwal", tanggal, sumber: opsi.sumber, kini: opsi.kini });
}

/** Dinyalakan instrumentation.ts: detak 5 menit. Matikan dengan ALETA_AGEN_KELENGKAPAN=0 (atau saklar jadwalnya). */
export function mulaiKelengkapanBerkala(getDb: () => Promise<AletaDatabase>, env: Record<string, string | undefined> = process.env) {
  if (env.ALETA_AGEN_KELENGKAPAN === "0") return;
  const w = wadah();
  if (w.detak) return;
  const detak = async () => {
    try {
      await detakKelengkapan(await getDb(), { env });
    } catch (e) {
      console.error("[AGEN KELENGKAPAN] detak gagal:", e);
    }
  };
  w.detak = setInterval(() => void detak(), 5 * 60 * 1000);
  setTimeout(() => void detak(), 150 * 1000);
}

// ============================================================================
// PEMBACA UNTUK LAYAR & LONCENG (hanya membaca basis data portal; tidak membaca SIPP)
// ============================================================================

/**
 * Penilaian hari ini untuk perkara-perkara tertentu (lencana Jadwal Sidang): sidang terdekat dari hari ini ke depan tiap
 * perkara. Bila hasil hari ini belum ada dan sudah lewat jam pemicu, satu jalan dimulai di LATAR (tidak ditunggu, paling
 * sering sekali per lima menit) - pembaca tidak pernah menahan permintaan pengguna.
 */
export async function bacaKesiapan(db: AletaDatabase, perkaraIds: string[], opsi: { kini?: Date; sumber?: SumberKelengkapan; env?: Record<string, string | undefined> } = {}): Promise<{ hariIni: string; peta: Record<string, PenilaianSidang>; jalan: JalanKelengkapan | null; menyala: boolean }> {
  const kini = opsi.kini ?? new Date();
  const env = opsi.env ?? process.env;
  const { tanggal: hariIni, jam } = waktuPengadilan(kini);
  if (env.ALETA_AGEN_KELENGKAPAN === "0") return { hariIni, peta: {}, jalan: null, menyala: false };
  const setelan = await bacaSetelanKelengkapan(db);
  if (!setelan.jadwal) return { hariIni, peta: {}, jalan: null, menyala: false };
  let c = await bacaCatatanKelengkapan(db, hariIni);
  if (!c.jalan) {
    await bacaHariLibur(db).catch(() => undefined);
    const w = wadah();
    const akhir = w.coba.get(hariIni) ?? 0;
    if (!tanggalLibur(hariIni) && jam.slice(0, 5) >= setelan.jam && kini.getTime() - akhir >= 5 * 60 * 1000 && !w.berjalan.has(hariIni)) {
      w.coba.set(hariIni, kini.getTime());
      void jalankanKelengkapan(db, { pemicu: "permintaan", tanggal: hariIni, sumber: opsi.sumber, kini }).catch(() => undefined);
    }
    c = await bacaCatatanKelengkapan(db, hariIni);
  }
  const ids = new Set(perkaraIds.map(teks).filter(Boolean));
  const peta: Record<string, PenilaianSidang> = {};
  for (const p of c.penilaian) {
    if (!ids.has(p.perkaraId) || p.tanggalSidang < hariIni) continue;
    const ada = peta[p.perkaraId];
    if (!ada || p.tanggalSidang < ada.tanggalSidang) peta[p.perkaraId] = p;
  }
  return { hariIni, peta, jalan: c.jalan, menyala: true };
}

/** Penilaian milik akun (PP/jurusita/majelis menurut nama, Kasir untuk butir kasir; admin semua) - untuk daftar/widget. */
export async function bacaKesiapanSaya(db: AletaDatabase, opsi: { nama: string; golongan: readonly string[]; lihatSemua: boolean; kini?: Date }) {
  const hariIni = waktuPengadilan(opsi.kini).tanggal;
  const c = await bacaCatatanKelengkapan(db, hariIni);
  const semua = c.penilaian.filter((p) => p.tanggalSidang >= hariIni);
  if (opsi.lihatSemua) return { hariIni, penilaian: semua, jalan: c.jalan };
  const milik = butirUntukPetugas(semua, { nama: opsi.nama, golongan: opsi.golongan }, namaAdaDi);
  const ids = new Set(milik.map((b) => `${b.penilaian.perkaraId}|${b.penilaian.tanggalSidang}`));
  return { hariIni, penilaian: semua.filter((p) => ids.has(`${p.perkaraId}|${p.tanggalSidang}`)), jalan: c.jalan };
}

/**
 * Lonceng satu akun dari hasil harian. Admin/pimpinan (`lihatSemua`): satu ringkasan satker; yang lain: hanya perkara yang
 * menjadi tanggung jawabnya dan hanya butir miliknya. Saklar jadwal mati atau hasil belum ada = tidak ada lonceng.
 */
export async function pemberitahuanKelengkapan(
  db: AletaDatabase,
  opsi: { nama: string; golongan: readonly string[]; lihatSemua: boolean; kini?: Date }
): Promise<Array<RingkasanLoncengKelengkapan & { waktu: string }>> {
  try {
    const setelan = await bacaSetelanKelengkapan(db);
    if (!setelan.jadwal) return [];
    const hariIni = waktuPengadilan(opsi.kini).tanggal;
    const c = await bacaCatatanKelengkapan(db, hariIni);
    if (!c.jalan || c.jalan.galat) return [];
    let daftar: PenilaianSidang[];
    if (opsi.lihatSemua) daftar = c.penilaian.filter((p) => p.tanggalSidang >= hariIni);
    else {
      // Hanya butir miliknya: tingkat sidang dihitung ulang atas butir yang menjadi tanggung jawab orang ini.
      daftar = butirUntukPetugas(c.penilaian.filter((p) => p.tanggalSidang >= hariIni), { nama: opsi.nama, golongan: opsi.golongan }, namaAdaDi).map((b) => ({
        ...b.penilaian,
        butir: b.butir,
        tingkat: b.butir.some((x) => x.tingkat === "merah") ? ("tidak-siap" as const) : ("perhatian" as const),
      }));
    }
    const r = ringkasLoncengKelengkapan(daftar, hariIni, opsi.lihatSemua);
    return r ? [{ ...r, waktu: c.jalan.pada }] : [];
  } catch {
    return [];
  }
}
