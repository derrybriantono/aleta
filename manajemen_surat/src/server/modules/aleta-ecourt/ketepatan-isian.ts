import { randomUUID } from "node:crypto";

import {
  AMBANG_NAIK,
  AMBANG_TURUN,
  JENDELA_BULAN,
  KODE_FITUR_KETEPATAN_ISIAN,
  MIN_KEJADIAN,
  asalGerbangDariPengisi,
  bulanMundur,
  kelompokkanKebenaran,
  kunciKetepatan,
  lipatKetepatanBulanan,
  ringkasBulananSaksi,
  statusDariKeputusan,
  tinjauKetepatan,
  type ButirSaksiUkur,
  type KejadianIsian,
  type KelompokKebenaran,
  type RingkasanBulananSaksi,
  type StatusGerbang,
} from "@/lib/ketepatan-isian";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { fiturMenyala } from "@/server/modules/satker/fitur";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * ============================================================================
 * KETEPATAN ISIAN - PENYIMPANAN DAN PERSETUJUAN (25 Okt 2026, rantai D butir D1)
 * ============================================================================
 *
 * U3 + U4. Aturan murni di src/lib/ketepatan-isian.ts; di sini membaca saklar,
 * menghitung ulang dari jejak isian (0091), menyimpan usulan, mencatat keputusan
 * Super Admin, dan mendorong keputusan yang berlaku ke bot.
 *
 * SAKLAR: Fitur Satker "ketepatan-isian", bawaan MATI. Mati berarti: tidak ada
 * yang dihitung atau disimpan, tidak ada keputusan yang berlaku, dan bot hanya
 * memakai berkas gerbang-isian.json - perilaku lama persis.
 *
 * KENAIKAN TIDAK PERNAH OTOMATIS. hitungDanTinjau hanya menulis baris berstatus
 * "usulan". Hanya putuskanUsulan (dipanggil dari tindakan Super Admin) yang
 * membuat baris berstatus "disetujui", dan ia menuntut pelaku bernama.
 *
 * Tidak ada yang ditulis ke SIPP/ABT/e-Court di berkas ini.
 */

export async function ketepatanAktif(db: AletaDatabase): Promise<boolean> {
  try {
    return await fiturMenyala(db, KODE_FITUR_KETEPATAN_ISIAN);
  } catch {
    return false;
  }
}

const teks = (x: unknown) => String(x ?? "").trim();
const angka = (x: unknown) => Number(x) || 0;

// ─── Keputusan yang berlaku ─────────────────────────────────────────────────

export type KeputusanKetepatan = {
  id: string;
  kode: string;
  pengisi: string;
  jenis: string;
  arah: string;
  status: string;
  dariStatus: string;
  keStatus: string;
  jumlah: number;
  bertahan: number;
  presisi: number;
  bulanAwal: string;
  bulanAkhir: string;
  dapatDiterapkan: boolean;
  berlaku: boolean;
  catatan: string;
  dibuatAt: string;
  diputuskanOleh: string;
  diputuskanNama: string;
  diputuskanAt: string;
  dicabutOleh: string;
  dicabutAt: string;
};

function keKeputusan(x: Record<string, unknown>): KeputusanKetepatan {
  return {
    id: teks(x.id),
    kode: teks(x.kode),
    pengisi: teks(x.pengisi),
    jenis: teks(x.jenis_perkara),
    arah: teks(x.arah),
    status: teks(x.status),
    dariStatus: teks(x.dari_status),
    keStatus: teks(x.ke_status),
    jumlah: angka(x.jumlah),
    bertahan: angka(x.bertahan),
    presisi: angka(x.presisi),
    bulanAwal: teks(x.bulan_awal),
    bulanAkhir: teks(x.bulan_akhir),
    dapatDiterapkan: angka(x.dapat_diterapkan) === 1,
    berlaku: angka(x.berlaku) === 1,
    catatan: String(x.catatan ?? ""),
    dibuatAt: teks(x.dibuat_at),
    diputuskanOleh: teks(x.diputuskan_oleh),
    diputuskanNama: teks(x.diputuskan_nama),
    diputuskanAt: teks(x.diputuskan_at),
    dicabutOleh: teks(x.dicabut_oleh),
    dicabutAt: teks(x.dicabut_at),
  };
}

export async function bacaKeputusan(db: AletaDatabase, batas = 300): Promise<KeputusanKetepatan[]> {
  const sampai = Math.max(1, Math.min(Number(batas) || 300, 1000));
  const baris = await db.queryAll<Record<string, unknown>>(`SELECT * FROM aleta_ketepatan_keputusan ORDER BY dibuat_at DESC LIMIT ${sampai}`);
  return baris.map(keKeputusan);
}

/** Keputusan disetujui yang masih berlaku dan dapat diterapkan di bot. Saklar mati -> kosong. */
export async function keputusanBerlaku(db: AletaDatabase): Promise<KeputusanKetepatan[]> {
  if (!(await ketepatanAktif(db))) return [];
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT * FROM aleta_ketepatan_keputusan WHERE status = 'disetujui' AND berlaku = 1 AND dapat_diterapkan = 1 ORDER BY diputuskan_at ASC`
  );
  return baris.map(keKeputusan);
}

/** Muatan untuk bot: hanya yang perlu dipakai gerbang. Saklar mati -> aktif:false dan tanpa entri. */
export type MuatanGerbangBot = {
  aktif: boolean;
  versi: string;
  entri: Array<{ kode: string; pengisi: string; jenis: string; status: "otomatis" | "saran"; pangkatMaks: "cukup" | "ragu"; n: number; presisi: number }>;
};

export async function bacaMuatanGerbangBot(db: AletaDatabase): Promise<MuatanGerbangBot> {
  const aktif = await ketepatanAktif(db);
  if (!aktif) return { aktif: false, versi: "", entri: [] };
  const daftar = await keputusanBerlaku(db);
  // Keputusan yang terakhir menang untuk satu kunci (urutan diputuskan_at naik).
  const peta = new Map<string, KeputusanKetepatan>();
  for (const k of daftar) peta.set(kunciKetepatan(k.kode, k.pengisi, k.jenis), k);
  const entri = Array.from(peta.values()).map((k) => {
    const status = statusDariKeputusan(k.arah);
    return { kode: k.kode, pengisi: k.pengisi, jenis: k.jenis, status, pangkatMaks: status === "otomatis" ? ("cukup" as const) : ("ragu" as const), n: k.jumlah, presisi: k.presisi };
  });
  const versi = daftar.length ? daftar[daftar.length - 1].diputuskanAt : "";
  return { aktif: true, versi, entri };
}

// ─── Bot ────────────────────────────────────────────────────────────────────

function pengaturanBot() {
  const alamat = (process.env.ALETA_BOT_BASE_URL || process.env.ALETA_BOT_RUNTIME_URL || "http://127.0.0.1:3003").replace(/\/$/, "");
  const token = process.env.ALETA_BOT_INTERNAL_API_TOKEN || process.env.ALETA_BOT_INTERNAL_TOKEN || "";
  return { alamat, token };
}

async function panggilBot(jalur: string, init: { method: "GET" | "POST"; badan?: unknown }): Promise<Response> {
  const { alamat, token } = pengaturanBot();
  const pengendali = new AbortController();
  const penunda = setTimeout(() => pengendali.abort(), 5000);
  try {
    return await fetch(`${alamat}${jalur}`, {
      method: init.method,
      headers: { "content-type": "application/json", ...(token ? { "x-aleta-internal-token": token } : {}) },
      body: init.badan === undefined ? undefined : JSON.stringify(init.badan),
      signal: pengendali.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(penunda);
  }
}

/**
 * Mendorong keputusan yang berlaku ke bot. Dicoba SEKALI; bot yang mati tidak menggagalkan keputusan - bot
 * tanpa data memakai berkas JSON saja (perilaku lama). Saklar mati mendorong muatan KOSONG supaya bot
 * melepas keputusan yang pernah diterimanya.
 */
export async function dorongGerbangKeBot(db: AletaDatabase): Promise<{ terkirim: boolean; pesan: string }> {
  try {
    const muatan = await bacaMuatanGerbangBot(db);
    const jawab = await panggilBot("/internal/aleta-bot/gerbang-isian/sinkron", { method: "POST", badan: muatan });
    return jawab.ok ? { terkirim: true, pesan: "Bot sudah menerima." } : { terkirim: false, pesan: `Bot belum menerima (HTTP ${jawab.status}) - bot perlu diperbarui.` };
  } catch {
    return { terkirim: false, pesan: "Bot belum dapat dihubungi - bot memakai gerbang terakhirnya (bawaan: berkas ukuran saja)." };
  }
}

export type GerbangBot = { terbaca: boolean; statik: Record<string, Record<string, string>> };

/** Status gerbang bawaan di bot (berkas JSON): kode -> asal -> status. Bot tak terjangkau -> terbaca:false. */
export async function bacaGerbangBot(): Promise<GerbangBot> {
  try {
    const jawab = await panggilBot("/internal/aleta-bot/gerbang-isian", { method: "GET" });
    if (!jawab.ok) return { terbaca: false, statik: {} };
    const j = (await jawab.json()) as { statik?: Record<string, Record<string, string>> };
    return { terbaca: Boolean(j && j.statik), statik: j && j.statik ? j.statik : {} };
  } catch {
    return { terbaca: false, statik: {} };
  }
}

// ─── Hitung ulang dan tinjau ────────────────────────────────────────────────

export type HasilHitung = { aktif: boolean; baris: number; usulanBaru: number; kedaluwarsa: number; dihitungAt: string; gerbangTerbaca: boolean };

/** Banyak bulan ke belakang yang dihitung ulang (jendela penilaian 6 bulan + 6 bulan pembanding untuk layar). */
const BULAN_DIHITUNG = 12;

/**
 * Jejak 12 bulan terakhir, kolom ringkas saja (tanpa nilai). Dilipat di sini, bukan di SQL: pg-mem (mode Postgres mati)
 * tidak mengenal fungsi teks, dan jumlahnya kecil (satu baris per penyimpanan isian).
 */
async function bacaKejadian(db: AletaDatabase, sekarang: Date): Promise<KejadianIsian[]> {
  const mulai = `${bulanMundur(bulanSekarang(sekarang), BULAN_DIHITUNG - 1)}-01`;
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT kode, asal_usulan, jenis_perkara, pada, hasil, cara FROM aleta_isian_jejak WHERE pada >= ? ORDER BY pada DESC LIMIT 200000`,
    [mulai]
  );
  return baris.map((b) => ({ kode: teks(b.kode), pengisi: teks(b.asal_usulan), jenis: teks(b.jenis_perkara), pada: teks(b.pada), hasil: teks(b.hasil), cara: teks(b.cara), n: 1 }));
}

function bulanSekarang(sekarang: Date): string {
  return sekarang.toISOString().slice(0, 7);
}

/** Status gerbang SEKARANG untuk satu kunci: keputusan berlaku, lalu berkas bawaan bot. */
function penyusunStatus(berlaku: Map<string, "otomatis" | "saran">, gerbang: GerbangBot) {
  return (kunci: string, nilai: { kode: string; pengisi: string; jenis: string }): StatusGerbang => {
    const o = berlaku.get(kunci);
    if (o) return o;
    if (!gerbang.terbaca) return "belum-diketahui";
    const asal = asalGerbangDariPengisi(nilai.pengisi);
    if (!asal) return "tanpa-ukuran";
    const s = gerbang.statik[nilai.kode]?.[asal];
    return s === "otomatis" || s === "terstruktur" || s === "saran" ? s : "tanpa-ukuran";
  };
}

function petaBerlaku(daftar: KeputusanKetepatan[]): Map<string, "otomatis" | "saran"> {
  const peta = new Map<string, "otomatis" | "saran">();
  for (const k of daftar) if (k.status === "disetujui" && k.berlaku) peta.set(kunciKetepatan(k.kode, k.pengisi, k.jenis), statusDariKeputusan(k.arah));
  return peta;
}

/**
 * Menghitung ulang angka bulanan dari jejak, lalu menyusun usulan naik/turun. Saklar mati -> tidak melakukan apa pun.
 * Hanya menulis baris berstatus "usulan" (dan menandai usulan lama yang tak lagi memenuhi syarat "kedaluwarsa").
 */
export async function hitungDanTinjau(db: AletaDatabase, opsi: { sekarang?: Date; gerbang?: GerbangBot } = {}): Promise<HasilHitung> {
  if (!(await ketepatanAktif(db))) return { aktif: false, baris: 0, usulanBaru: 0, kedaluwarsa: 0, dihitungAt: "", gerbangTerbaca: false };
  const sekarang = opsi.sekarang ?? new Date();
  const kini = sekarang.toISOString();
  const gerbang = opsi.gerbang ?? (await bacaGerbangBot());
  const baris = lipatKetepatanBulanan(await bacaKejadian(db, sekarang));

  const keputusan = await bacaKeputusan(db, 1000);
  const usulan = tinjauKetepatan({ baris, sampaiBulan: bulanSekarang(sekarang), statusSekarang: penyusunStatus(petaBerlaku(keputusan), gerbang) });

  let baru = 0;
  let lewat = 0;
  await withTransaction(db, async (tx) => {
    await tx.run(`DELETE FROM aleta_ketepatan_isian`);
    for (const b of baris) {
      await tx.run(
        `INSERT INTO aleta_ketepatan_isian (id, kode, pengisi, jenis_perkara, bulan, usulan, diterima, diubah, diubah_otomatis, diketik, bertahan, presisi, dihitung_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [`${kunciKetepatan(b.kode, b.pengisi, b.jenis)}|${b.bulan}`, b.kode, b.pengisi, b.jenis, b.bulan, b.usulan, b.diterima, b.diubah, b.diubahOtomatis, b.diketik, b.bertahan, b.presisi, kini]
      );
    }
    const menunggu = keputusan.filter((k) => k.status === "usulan");
    const kunciMasih = new Set(usulan.map((u) => `${u.kunci}|${u.arah}`));
    for (const k of menunggu) {
      if (!kunciMasih.has(`${kunciKetepatan(k.kode, k.pengisi, k.jenis)}|${k.arah}`)) {
        await tx.run(`UPDATE aleta_ketepatan_keputusan SET status = 'kedaluwarsa' WHERE id = ? AND status = 'usulan'`, [k.id]);
        lewat += 1;
      }
    }
    for (const u of usulan) {
      const ada = menunggu.find((k) => kunciKetepatan(k.kode, k.pengisi, k.jenis) === u.kunci && k.arah === u.arah);
      if (ada) {
        // Angka diperbarui; keputusan tetap menunggu.
        await tx.run(`UPDATE aleta_ketepatan_keputusan SET jumlah = ?, bertahan = ?, presisi = ?, bulan_awal = ?, bulan_akhir = ?, dari_status = ? WHERE id = ?`, [u.n, u.bertahan, u.presisi, u.bulanAwal, u.bulanAkhir, u.dariStatus, ada.id]);
        continue;
      }
      await tx.run(
        `INSERT INTO aleta_ketepatan_keputusan
           (id, kode, pengisi, jenis_perkara, arah, status, dari_status, ke_status, jumlah, bertahan, presisi, bulan_awal, bulan_akhir, dapat_diterapkan, berlaku, catatan, dibuat_at)
         VALUES (?, ?, ?, ?, ?, 'usulan', ?, ?, ?, ?, ?, ?, ?, ?, 0, '', ?)`,
        [randomUUID(), u.kode, u.pengisi, u.jenis, u.arah, u.dariStatus, u.keStatus, u.n, u.bertahan, u.presisi, u.bulanAwal, u.bulanAkhir, u.dapatDiterapkan ? 1 : 0, kini]
      );
      baru += 1;
    }
  });
  return { aktif: true, baris: baris.length, usulanBaru: baru, kedaluwarsa: lewat, dihitungAt: kini, gerbangTerbaca: gerbang.terbaca };
}

// ─── Keputusan Super Admin ──────────────────────────────────────────────────

export type AktorKeputusan = { id: string; name?: string | null };

/**
 * Menyetujui atau menolak satu usulan. SATU-SATUNYA jalan menuju status "disetujui". Pemanggil (rute) wajib
 * sudah memastikan pelaku Super Admin; di sini pelaku tetap harus bernama (id tidak kosong).
 */
export async function putuskanUsulan(
  db: AletaDatabase,
  aktor: AktorKeputusan,
  id: string,
  keputusan: "setujui" | "tolak",
  catatan = ""
): Promise<KeputusanKetepatan> {
  if (!teks(aktor.id)) throw new ApiError(400, "Keputusan harus atas nama seseorang.");
  if (!(await ketepatanAktif(db))) throw new ApiError(409, "Saklar Ketepatan isian sedang mati.");
  const baris = await db.queryOne<Record<string, unknown>>(`SELECT * FROM aleta_ketepatan_keputusan WHERE id = ?`, [teks(id)]);
  if (!baris) throw new ApiError(404, "Usulan tidak ditemukan.");
  const k = keKeputusan(baris);
  if (k.status !== "usulan") throw new ApiError(409, "Usulan ini sudah diputuskan atau sudah tidak berlaku.");
  const kini = new Date().toISOString();
  const nama = teks(aktor.name);
  await withTransaction(db, async (tx) => {
    if (keputusan === "setujui") {
      if (!k.dapatDiterapkan) throw new ApiError(409, "Usulan ini tidak dapat diterapkan di bot.");
      // Keputusan berlaku sebelumnya untuk isian yang sama digantikan.
      await tx.run(`UPDATE aleta_ketepatan_keputusan SET berlaku = 0 WHERE kode = ? AND pengisi = ? AND jenis_perkara = ? AND berlaku = 1`, [k.kode, k.pengisi, k.jenis]);
      await tx.run(`UPDATE aleta_ketepatan_keputusan SET status = 'disetujui', berlaku = 1, diputuskan_oleh = ?, diputuskan_nama = ?, diputuskan_at = ?, catatan = ? WHERE id = ?`, [aktor.id, nama, kini, String(catatan).slice(0, 500), k.id]);
    } else {
      await tx.run(`UPDATE aleta_ketepatan_keputusan SET status = 'ditolak', berlaku = 0, diputuskan_oleh = ?, diputuskan_nama = ?, diputuskan_at = ?, catatan = ? WHERE id = ?`, [aktor.id, nama, kini, String(catatan).slice(0, 500), k.id]);
    }
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: aktor.id,
      action: keputusan === "setujui" ? "KETEPATAN_ISIAN_SETUJUI" : "KETEPATAN_ISIAN_TOLAK",
      entityType: "aleta_ketepatan_keputusan",
      entityId: k.id,
      payload: { kode: k.kode, pengisi: k.pengisi, jenis: k.jenis, arah: k.arah, jumlah: k.jumlah, presisi: k.presisi },
      createdAt: kini,
    });
  });
  const sesudah = await db.queryOne<Record<string, unknown>>(`SELECT * FROM aleta_ketepatan_keputusan WHERE id = ?`, [k.id]);
  return keKeputusan(sesudah ?? baris);
}

/** Mencabut keputusan yang berlaku: bot kembali ke berkas JSON untuk isian itu. */
export async function cabutKeputusan(db: AletaDatabase, aktor: AktorKeputusan, id: string): Promise<KeputusanKetepatan> {
  if (!teks(aktor.id)) throw new ApiError(400, "Pencabutan harus atas nama seseorang.");
  const baris = await db.queryOne<Record<string, unknown>>(`SELECT * FROM aleta_ketepatan_keputusan WHERE id = ?`, [teks(id)]);
  if (!baris) throw new ApiError(404, "Keputusan tidak ditemukan.");
  const k = keKeputusan(baris);
  if (k.status !== "disetujui" || !k.berlaku) throw new ApiError(409, "Keputusan ini tidak sedang berlaku.");
  const kini = new Date().toISOString();
  await withTransaction(db, async (tx) => {
    await tx.run(`UPDATE aleta_ketepatan_keputusan SET berlaku = 0, status = 'dicabut', dicabut_oleh = ?, dicabut_at = ? WHERE id = ?`, [aktor.id, kini, k.id]);
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: aktor.id,
      action: "KETEPATAN_ISIAN_CABUT",
      entityType: "aleta_ketepatan_keputusan",
      entityId: k.id,
      payload: { kode: k.kode, pengisi: k.pengisi, jenis: k.jenis, arah: k.arah },
      createdAt: kini,
    });
  });
  const sesudah = await db.queryOne<Record<string, unknown>>(`SELECT * FROM aleta_ketepatan_keputusan WHERE id = ?`, [k.id]);
  return keKeputusan(sesudah ?? baris);
}

// ─── Kebenaran isi saksi (U4) ───────────────────────────────────────────────

export type LaporanKebenaranSaksi = {
  jumlah: number;
  sejak: string;
  persenBenar: number | null;
  rataKemiripan: number | null;
  perJenisKeterangan: KelompokKebenaran[];
  perKatalog: KelompokKebenaran[];
  perBulan: RingkasanBulananSaksi[];
};

/** Baris butir saksi untuk diukur: kolom ringkas saja (tanpa teks pertanyaan atau jawaban). */
export async function bacaButirUntukUkur(db: AletaDatabase, sejak = ""): Promise<ButirSaksiUkur[]> {
  const batas = teks(sejak);
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT jenis_keterangan, katalog, pada, hasil, kemiripan FROM aleta_saksi_butir ${batas ? "WHERE pada >= ?" : ""} ORDER BY pada DESC LIMIT 100000`,
    batas ? [batas] : []
  );
  return baris.map((b) => ({ jenisKeterangan: teks(b.jenis_keterangan), katalog: teks(b.katalog), pada: teks(b.pada), hasil: teks(b.hasil), kemiripan: Number(b.kemiripan) || 0 }));
}

export function susunLaporanKebenaran(baris: ButirSaksiUkur[], sejak = ""): LaporanKebenaranSaksi {
  const semua = kelompokkanKebenaran(baris, () => "semua")[0];
  return {
    jumlah: baris.length,
    sejak,
    persenBenar: semua ? semua.persenBenar : null,
    rataKemiripan: semua ? semua.rataKemiripan : null,
    perJenisKeterangan: kelompokkanKebenaran(baris, (b) => b.jenisKeterangan).slice(0, 30),
    perKatalog: kelompokkanKebenaran(baris, (b) => b.katalog).slice(0, 200),
    perBulan: ringkasBulananSaksi(baris).slice(0, 24),
  };
}

export async function laporanKebenaranSaksi(db: AletaDatabase, sejak = ""): Promise<LaporanKebenaranSaksi> {
  return susunLaporanKebenaran(await bacaButirUntukUkur(db, sejak), teks(sejak));
}

// ─── Layar ──────────────────────────────────────────────────────────────────

export type LayarKetepatan = {
  aktif: boolean;
  dihitungAt: string;
  gerbangTerbaca: boolean;
  usulan: KeputusanKetepatan[];
  berlaku: KeputusanKetepatan[];
  riwayat: KeputusanKetepatan[];
  perIsian: Array<{ kode: string; pengisi: string; jenis: string; usulan: number; bertahan: number; presisi: number | null; diketik: number }>;
  kebenaranSaksi: LaporanKebenaranSaksi;
  ambang: { minKejadian: number; naik: number; turun: number; jendelaBulan: number };
};

const SELANG_HITUNG_MS = 20 * 3_600_000;

/**
 * Data layar Ketepatan isian. Menghitung ulang bila belum pernah atau sudah lebih dari 20 jam (diperbarui harian);
 * `paksa` menghitung sekarang. Saklar mati -> hanya {aktif:false} dan angka kebenaran kosong.
 */
export async function bacaLayarKetepatan(db: AletaDatabase, opsi: { paksa?: boolean; sekarang?: Date } = {}): Promise<LayarKetepatan> {
  const aktif = await ketepatanAktif(db);
  const ambang = { minKejadian: MIN_KEJADIAN, naik: AMBANG_NAIK, turun: AMBANG_TURUN, jendelaBulan: JENDELA_BULAN };
  if (!aktif) {
    return { aktif: false, dihitungAt: "", gerbangTerbaca: false, usulan: [], berlaku: [], riwayat: [], perIsian: [], kebenaranSaksi: susunLaporanKebenaran([]), ambang };
  }
  const sekarang = opsi.sekarang ?? new Date();
  const terakhir = await db.queryOne<Record<string, unknown>>(`SELECT MAX(dihitung_at) AS t FROM aleta_ketepatan_isian`);
  const dihitung = teks(terakhir?.t);
  let gerbangTerbaca = false;
  let dihitungAt = dihitung;
  if (opsi.paksa || !dihitung || sekarang.getTime() - new Date(dihitung).getTime() > SELANG_HITUNG_MS) {
    const h = await hitungDanTinjau(db, { sekarang });
    dihitungAt = h.dihitungAt || dihitung;
    gerbangTerbaca = h.gerbangTerbaca;
  }
  const keputusan = await bacaKeputusan(db, 500);
  const baris = await db.queryAll<Record<string, unknown>>(`SELECT * FROM aleta_ketepatan_isian ORDER BY bulan DESC LIMIT 20000`);
  const peta = new Map<string, { kode: string; pengisi: string; jenis: string; usulan: number; bertahan: number; diketik: number }>();
  for (const b of baris) {
    const kode = teks(b.kode);
    const pengisi = teks(b.pengisi);
    const jenis = teks(b.jenis_perkara);
    const kunci = kunciKetepatan(kode, pengisi, jenis);
    const w = peta.get(kunci) ?? { kode, pengisi, jenis, usulan: 0, bertahan: 0, diketik: 0 };
    w.usulan += angka(b.usulan);
    w.bertahan += angka(b.bertahan);
    w.diketik += angka(b.diketik);
    peta.set(kunci, w);
  }
  const perIsian = Array.from(peta.values())
    .map((w) => ({ ...w, bertahan: Math.max(0, w.bertahan), presisi: w.usulan ? Math.round((Math.max(0, w.bertahan) / w.usulan) * 1000) / 1000 : null }))
    .sort((a, b) => b.usulan + b.diketik - (a.usulan + a.diketik))
    .slice(0, 300);
  return {
    aktif: true,
    dihitungAt,
    gerbangTerbaca,
    usulan: keputusan.filter((k) => k.status === "usulan"),
    berlaku: keputusan.filter((k) => k.status === "disetujui" && k.berlaku),
    riwayat: keputusan.filter((k) => k.status !== "usulan" && !(k.status === "disetujui" && k.berlaku)).slice(0, 100),
    perIsian,
    kebenaranSaksi: await laporanKebenaranSaksi(db),
    ambang,
  };
}
