/**
 * ============================================================================
 * PENJAGA SERVER - MESIN (N4, 1 November 2026)
 * ============================================================================
 *
 * Memperluas Pusat Kesehatan Sistem dan Kapasitas penyimpanan (BUKAN jalur kedua): angkanya dari pemeriksaan
 * yang sudah ada (komponen kesehatan, laporan kapasitas dari cron host, riwayat cadangan) ditambah satu laporan
 * kecil dari pemantau di server (scripts/kapasitas/penjaga-host.sh: inode, folder sementara, sertifikat,
 * kontainer, halaman ABT). Aturan murni: src/lib/penjaga-server.ts.
 *
 * HANYA MENGABARI. Tidak ada pembersihan, penghapusan, atau perubahan setelan server di sini. Satu-satunya
 * penghapusan adalah riwayat kejadian milik penjaga sendiri yang lebih dari 90 hari.
 *
 * BEBAN: tiap 5 menit, satu putaran. Memakai hasil Pusat Kesehatan bila baru (< 4 menit); bila tidak, satu
 * pemeriksaan kesehatan (semua panggilan paralel dan berbatas waktu 3-10 detik). Selebihnya hanya membaca tiga
 * berkas kecil dan beberapa baris tabel kecil. Tidak ada pemindaian folder/berkas besar.
 *
 * KABAR: lewat jalur WhatsApp portal yang sama dengan Pusat Kesehatan (kirimPeringatanWhatsapp), ke Super Admin.
 * Nomor penerima tidak pernah dicetak ke log. Bila ALETA Bot/WhatsApp sendiri yang mati dan pesan tidak dapat
 * dikirim, kejadian tetap dicatat dan kabar dicoba lagi pada putaran berikutnya.
 */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AletaDatabase } from "@/server/db/client";
import {
  PENGATURAN_PENJAGA_BAWAAN,
  bersihkanLaporanPenjagaHost,
  dalamJamTenang,
  kelompokDariKunci,
  pengaturanDariTersimpan,
  perluKabar,
  perluKabarPulih,
  periksaPengaturanPenjaga,
  susunPesanKejadian,
  susunPesanPulih,
  susunPesanRingkasan,
  temuanCadangan,
  temuanDisk,
  temuanHost,
  temuanLayanan,
  temuanPemantauBerhenti,
  tingkatKabar,
  type BarisKejadian,
  type CatatanCadangan,
  type LaporanPenjagaHost,
  type PengaturanPenjaga,
  type Temuan,
  type TingkatKejadian,
} from "@/lib/penjaga-server";
import { direktoriKapasitas, bacaLaporanHost } from "@/server/modules/kapasitas/penyimpanan";
import { susunKapasitas, type HasilKapasitas, type LaporanHost, type PartisiBot, type SetelanKapasitas } from "@/server/modules/kapasitas/hitung";
import { bacaSetelanKapasitas } from "@/server/modules/kapasitas/layanan";
import { bacaSetelanJson, simpanSetelanSistem } from "@/server/modules/kesehatan/setelan";
import { ApiError } from "@/server/shared/errors";

export const KUNCI_PENGATURAN_PENJAGA = "penjaga-server:pengaturan";
const HARI_RIWAYAT = 90;
const TAHAN_PULIH_MENIT = 10;
const RINGKAS_BILA_LEBIH_DARI = 3;
export const SELANG_PENJAGA_MS = 5 * 60_000;
const HASIL_BARU_MS = 4 * 60_000;

export type Penerima = Array<{ id: string; nama: string; nomor: string }>;
export type KirimPenjaga = (penerima: Penerima, pesan: string, kunci: string) => Promise<{ terkirim: number; gagal: number }>;

// ---------------------------------------------------------------------------
// Pengaturan
// ---------------------------------------------------------------------------

export async function bacaPengaturanPenjaga(db: AletaDatabase): Promise<PengaturanPenjaga> {
  const mentah = await bacaSetelanJson<PengaturanPenjaga>(db, KUNCI_PENGATURAN_PENJAGA);
  return mentah ? pengaturanDariTersimpan(mentah) : { ...PENGATURAN_PENJAGA_BAWAAN, penerimaIds: [] };
}

export async function simpanPengaturanPenjaga(db: AletaDatabase, masukan: unknown, kini = new Date()) {
  const sebelum = await bacaPengaturanPenjaga(db);
  const h = periksaPengaturanPenjaga(masukan, sebelum);
  if (!h.ok) throw new ApiError(400, h.pesan);
  await simpanSetelanSistem(db, KUNCI_PENGATURAN_PENJAGA, JSON.stringify(h.pengaturan), kini.toISOString());
  return { sebelum, sesudah: h.pengaturan };
}

/** Penjaga menyala bila salah satu kabar menyala. Dipakai Pusat Kesehatan agar tidak mengirim peringatan merah dua kali. */
export function penjagaMengabari(p: Pick<PengaturanPenjaga, "merahAktif" | "peringatanAktif">): boolean {
  return p.merahAktif || p.peringatanAktif;
}

// ---------------------------------------------------------------------------
// Berkas pertukaran dengan pemantau di server
// ---------------------------------------------------------------------------

export const jalurPenjaga = {
  host: () => path.join(direktoriKapasitas(), "penjaga-host.json"),
  penerima: () => path.join(direktoriKapasitas(), "penjaga-penerima.json"),
};

export async function bacaLaporanPenjagaHost(): Promise<LaporanPenjagaHost | null> {
  try {
    return bersihkanLaporanPenjagaHost(JSON.parse(await readFile(jalurPenjaga.host(), "utf8")));
  } catch {
    return null;
  }
}

function digitNomor(nomor: string): string {
  const d = String(nomor || "").replace(/\D/g, "");
  if (d.startsWith("0")) return `62${d.slice(1)}`;
  if (d.startsWith("8")) return `62${d}`;
  return d;
}

/**
 * Cerminan untuk pemantau di server: bila portal sendiri mati, pemantau itulah yang menyuruh ALETA Bot
 * mengabari Super Admin. Hanya ditulis bila isinya berubah; berisi nomor, jadi mode 0600 dan tidak dicetak.
 */
export async function tulisCerminPenerima(pengaturan: Pick<PengaturanPenjaga, "merahAktif">, penerima: Penerima): Promise<boolean> {
  const isi = `${JSON.stringify({
    versi: 1,
    merahAktif: pengaturan.merahAktif,
    penerima: penerima.map((p) => ({ nama: p.nama.slice(0, 60), nomor: digitNomor(p.nomor) })).filter((p) => p.nomor.length >= 8),
  })}\n`;
  const jalur = jalurPenjaga.penerima();
  try {
    if ((await readFile(jalur, "utf8")) === isi) return false;
  } catch {
    // belum ada
  }
  await mkdir(path.dirname(jalur), { recursive: true });
  const sementara = `${jalur}.${process.pid}.tmp`;
  await writeFile(sementara, isi, { encoding: "utf8", mode: 0o600 });
  await rename(sementara, jalur);
  return true;
}

// ---------------------------------------------------------------------------
// Pengumpulan temuan
// ---------------------------------------------------------------------------

export type KomponenRingkas = { kunci: string; warna: string; ringkas: string };

export type DepsPenjaga = {
  kini: () => Date;
  /** null = tidak terbaca (kejadian layanan tidak dinilai putaran ini). */
  komponen: () => Promise<KomponenRingkas[] | null>;
  kapasitas: () => Promise<{ laporan: LaporanHost | null; partisiBot: PartisiBot[] | null; setelan: SetelanKapasitas; hasil: HasilKapasitas } | null>;
  host: () => Promise<LaporanPenjagaHost | null>;
  cadangan: () => Promise<CatatanCadangan[] | null>;
  penerima: (db: AletaDatabase) => Promise<Penerima>;
  kirim: KirimPenjaga;
};

const wadah = globalThis as typeof globalThis & {
  __kesehatanHasilTerakhir?: { pada: number; komponen: KomponenRingkas[] };
  __penjagaDetak?: ReturnType<typeof setInterval>;
  __penjagaTunda?: ReturnType<typeof setTimeout>;
  __penjagaJalan?: boolean;
};

/** Dipanggil Pusat Kesehatan tiap selesai memeriksa, supaya penjaga tidak memeriksa ulang yang baru saja diukur. */
export function titipHasilKesehatan(komponen: KomponenRingkas[], pada = Date.now()) {
  wadah.__kesehatanHasilTerakhir = { pada, komponen: komponen.map((k) => ({ kunci: k.kunci, warna: k.warna, ringkas: k.ringkas })) };
}

export async function depsAsliPenjaga(db: AletaDatabase): Promise<DepsPenjaga> {
  return {
    kini: () => new Date(),
    komponen: async () => {
      const titip = wadah.__kesehatanHasilTerakhir;
      if (titip && Date.now() - titip.pada < HASIL_BARU_MS) return titip.komponen;
      try {
        const { jalankanPemeriksaan } = await import("@/server/modules/kesehatan/layanan");
        const hasil = await jalankanPemeriksaan(db, { ping: true });
        const komponen = hasil.komponen.map((k) => ({ kunci: k.kunci, warna: k.warna, ringkas: k.ringkas }));
        titipHasilKesehatan(komponen);
        return komponen;
      } catch {
        return null;
      }
    },
    kapasitas: async () => {
      try {
        const [setelan, laporan] = await Promise.all([bacaSetelanKapasitas(db), bacaLaporanHost()]);
        let partisiBot: PartisiBot[] | null = null;
        if (!laporan) {
          const [{ mintaSumberDayaBot }, { bacaSumberDaya }] = await Promise.all([import("@/server/modules/sumber-daya/gateway"), import("@/server/modules/sumber-daya/layanan")]);
          const h = await bacaSumberDaya(null, () => mintaSumberDayaBot(4000));
          partisiBot = h.ok ? h.data.rincian.partisi.map((p) => ({ titik: p.titik, totalByte: p.totalByte, terpakaiByte: p.terpakaiByte, sisaByte: p.sisaByte })) : null;
        }
        const hasil = susunKapasitas({ laporan, partisiBot, setelan, kini: new Date() });
        return { laporan, partisiBot, setelan, hasil };
      } catch {
        return null;
      }
    },
    host: bacaLaporanPenjagaHost,
    cadangan: async () => {
      try {
        const { bacaRiwayat } = await import("@/server/modules/sinkron/riwayat");
        const semua = await bacaRiwayat();
        return semua
          .filter((r) => r.tugas === "cadangan")
          .sort((a, b) => (a.selesai < b.selesai ? 1 : -1))
          .slice(0, 12)
          .map((r) => ({ selesai: r.selesai, berhasil: r.berhasil, byte: Number(r.byte) || 0 }));
      } catch {
        return null;
      }
    },
    penerima: async (d) => {
      const { daftarPenerimaAdmin } = await import("@/server/modules/kesehatan/layanan");
      return daftarPenerimaAdmin(d, "super-admin");
    },
    kirim: async (penerima, pesan, kunci) => {
      const { kirimPeringatanWhatsapp } = await import("@/server/modules/kesehatan/layanan");
      return kirimPeringatanWhatsapp(penerima, pesan, kunci);
    },
  };
}

export type KumpulanTemuan = { temuan: Temuan[]; dinilai: Set<string> };

export async function kumpulkanTemuan(deps: DepsPenjaga, p: PengaturanPenjaga): Promise<KumpulanTemuan> {
  const kini = deps.kini();
  const [komponen, kap, host, cadangan] = await Promise.all([deps.komponen(), deps.kapasitas(), deps.host(), deps.cadangan()]);
  const temuan: Temuan[] = [];
  const dinilai = new Set<string>();

  if (komponen) {
    dinilai.add("layanan");
    temuan.push(...temuanLayanan(komponen));
  }
  const titikDipantau = new Set<string>();
  if (kap) {
    if (kap.laporan || kap.partisiBot) {
      dinilai.add("disk");
      const disk = temuanDisk({ laporan: kap.laporan, partisiBot: kap.partisiBot, kapasitas: kap.setelan });
      temuan.push(...disk);
      for (const d of disk) titikDipantau.add(d.kunci.slice("disk:".length));
      if (kap.laporan) for (const j of kap.laporan.jalur) if (j.titik) titikDipantau.add(j.titik);
    }
    if (kap.hasil.sumber === "host") {
      dinilai.add("pemantau");
      temuan.push(...temuanPemantauBerhenti(kap.hasil));
    }
  }
  if (host) {
    const umurMenit = (kini.getTime() - new Date(host.dibuat).getTime()) / 60_000;
    // Laporan yang basi tidak dipercaya: kejadiannya dibiarkan apa adanya (pemantau:server sudah mengabarkan basinya).
    if (umurMenit <= host.intervalMenit * 3 + 2) {
      for (const g of ["inode", "temp", "sertifikat", "kontainer"]) dinilai.add(g);
      if (host.abtWeb) dinilai.add("web");
      temuan.push(...temuanHost(host, p, kap?.setelan ?? { ambangKuning: 80, ambangMerah: 90 }, titikDipantau));
    }
  }
  if (cadangan) {
    dinilai.add("cadangan");
    temuan.push(...temuanCadangan(cadangan, kini, p));
  }
  return { temuan, dinilai };
}

// ---------------------------------------------------------------------------
// Kejadian (tabel aleta_penjaga_kejadian)
// ---------------------------------------------------------------------------

type BarisDb = {
  id: string;
  kunci: string;
  tingkat: string;
  judul: string;
  uraian: string;
  mulai_at: string;
  terakhir_dilihat_at: string;
  berturut: number | string;
  pulih_at: string;
  kabar_at: string;
  kabar_tingkat: string;
  jumlah_kabar: number | string;
  kabar_pulih_at: string;
  catatan: string;
};

function keBaris(r: BarisDb): BarisKejadian {
  return {
    id: r.id,
    kunci: r.kunci,
    tingkat: r.tingkat === "merah" ? "merah" : "peringatan",
    judul: r.judul,
    uraian: r.uraian,
    mulaiAt: r.mulai_at,
    berturut: Number(r.berturut) || 0,
    pulihAt: r.pulih_at,
    kabarAt: r.kabar_at,
    kabarTingkat: r.kabar_tingkat,
    jumlahKabar: Number(r.jumlah_kabar) || 0,
    kabarPulihAt: r.kabar_pulih_at,
  };
}

export type HasilProses = { dibuka: number; pulih: number; dikirim: number; gagal: number; tanpaPenerima: boolean; ditahanJamTenang: number };

async function sebagianBaris(db: AletaDatabase, sql: string, params: Array<string | number> = []): Promise<BarisKejadian[]> {
  return (await db.queryAll<BarisDb>(sql, params)).map(keBaris);
}

/**
 * Satu putaran: perbarui kejadian dari temuan, lalu kabari yang perlu. Tidak melempar karena kegagalan kirim
 * (kejadian tetap tercatat, kabar dicoba lagi putaran berikutnya).
 */
export async function prosesTemuan(
  db: AletaDatabase,
  kumpulan: KumpulanTemuan,
  opsi: { kini: Date; pengaturan: PengaturanPenjaga; penerima: (db: AletaDatabase) => Promise<Penerima>; kirim: KirimPenjaga }
): Promise<HasilProses> {
  const { kini, pengaturan: p } = opsi;
  const waktu = kini.toISOString();
  const hasil: HasilProses = { dibuka: 0, pulih: 0, dikirim: 0, gagal: 0, tanpaPenerima: false, ditahanJamTenang: 0 };
  const butuh = new Map<string, number>();
  const ada = new Set<string>();
  for (const t of kumpulan.temuan) {
    butuh.set(t.kunci, t.butuhBerturut);
    ada.add(t.kunci);
  }

  // 1. Yang tidak terlihat lagi (dan sumbernya memang dinilai putaran ini) -> pulih.
  const aktif = await sebagianBaris(db, "SELECT * FROM aleta_penjaga_kejadian WHERE pulih_at = ''");
  for (const b of aktif) {
    if (ada.has(b.kunci) || !kumpulan.dinilai.has(kelompokDariKunci(b.kunci))) continue;
    await db.run("UPDATE aleta_penjaga_kejadian SET pulih_at = ? WHERE id = ?", [waktu, b.id]);
    hasil.pulih += 1;
  }

  // 2. Temuan: buka baru, perbarui, atau buka kembali kejadian yang baru saja pulih (naik-turun sesaat = satu kejadian).
  for (const t of kumpulan.temuan) {
    const sekarang = (await sebagianBaris(db, "SELECT * FROM aleta_penjaga_kejadian WHERE kunci = ? AND pulih_at = ''", [t.kunci]))[0];
    if (sekarang) {
      await db.run("UPDATE aleta_penjaga_kejadian SET tingkat = ?, judul = ?, uraian = ?, terakhir_dilihat_at = ?, berturut = berturut + 1 WHERE id = ?", [t.tingkat, t.judul, t.uraian, waktu, sekarang.id]);
      continue;
    }
    const batas = new Date(kini.getTime() - TAHAN_PULIH_MENIT * 60_000).toISOString();
    const baruSaja = (
      await sebagianBaris(db, "SELECT * FROM aleta_penjaga_kejadian WHERE kunci = ? AND pulih_at <> '' AND kabar_pulih_at = '' ORDER BY pulih_at DESC LIMIT 1", [t.kunci])
    )[0];
    if (baruSaja && (baruSaja.pulihAt > batas || baruSaja.kabarAt)) {
      await db.run("UPDATE aleta_penjaga_kejadian SET pulih_at = '', tingkat = ?, judul = ?, uraian = ?, terakhir_dilihat_at = ?, berturut = berturut + 1 WHERE id = ?", [t.tingkat, t.judul, t.uraian, waktu, baruSaja.id]);
      continue;
    }
    await db.run(
      "INSERT INTO aleta_penjaga_kejadian (id, kunci, tingkat, judul, uraian, mulai_at, terakhir_dilihat_at, berturut) VALUES (?, ?, ?, ?, ?, ?, ?, 1)",
      [`pj-${randomUUID()}`, t.kunci, t.tingkat, t.judul, t.uraian, waktu, waktu]
    );
    hasil.dibuka += 1;
  }

  // 3. Kabar untuk kejadian yang berlangsung.
  const berlangsung = await sebagianBaris(db, "SELECT * FROM aleta_penjaga_kejadian WHERE pulih_at = ''");
  const jatuhTempo: BarisKejadian[] = [];
  for (const b of berlangsung) {
    const perlu = butuh.get(b.kunci) ?? 1;
    if (perluKabar(b, perlu, kini, p)) jatuhTempo.push(b);
    else if (b.berturut >= perlu && !b.kabarAt && tingkatKabar(b.tingkat, p) === "peringatan" && dalamJamTenang(kini, p)) hasil.ditahanJamTenang += 1;
  }
  // 4. Kabar "pulih" (sudah stabil TAHAN_PULIH_MENIT menit).
  const batasPulih = new Date(kini.getTime() - TAHAN_PULIH_MENIT * 60_000).toISOString();
  const pulihTempo = (
    await sebagianBaris(db, "SELECT * FROM aleta_penjaga_kejadian WHERE pulih_at <> '' AND kabar_at <> '' AND kabar_pulih_at = '' AND pulih_at <= ? ORDER BY pulih_at", [batasPulih])
  ).filter((b) => perluKabarPulih(b, kini, p));

  if (jatuhTempo.length === 0 && pulihTempo.length === 0) {
    await bersihkanRiwayatLama(db, kini);
    return hasil;
  }

  let penerima = await opsi.penerima(db);
  if (p.penerimaIds.length) penerima = penerima.filter((x) => p.penerimaIds.includes(x.id));
  if (penerima.length === 0) {
    hasil.tanpaPenerima = true;
    for (const b of jatuhTempo) await db.run("UPDATE aleta_penjaga_kejadian SET catatan = ? WHERE id = ?", ["Belum ada penerima: tidak ada Super Admin dengan nomor WhatsApp.", b.id]);
    await bersihkanRiwayatLama(db, kini);
    return hasil;
  }

  const kirimSatu = async (pesan: string, kunci: string): Promise<boolean> => {
    try {
      const h = await opsi.kirim(penerima, pesan, kunci);
      if ((Number(h?.terkirim) || 0) > 0) {
        hasil.dikirim += 1;
        return true;
      }
    } catch {
      // dihitung gagal di bawah
    }
    hasil.gagal += 1;
    return false;
  };
  const tandaiKabar = (b: BarisKejadian, tingkat: TingkatKejadian) =>
    db.run("UPDATE aleta_penjaga_kejadian SET kabar_at = ?, kabar_tingkat = ?, jumlah_kabar = jumlah_kabar + 1, catatan = '' WHERE id = ?", [waktu, tingkat, b.id]);
  const catatGagal = (b: BarisKejadian) => db.run("UPDATE aleta_penjaga_kejadian SET catatan = ? WHERE id = ?", ["Kabar WhatsApp belum terkirim; dicoba lagi.", b.id]);

  for (const tingkat of ["merah", "peringatan"] as const) {
    const kelompok = jatuhTempo.filter((b) => tingkatKabar(b.tingkat, p) === tingkat);
    if (kelompok.length === 0) continue;
    if (kelompok.length > RINGKAS_BILA_LEBIH_DARI) {
      const sukses = await kirimSatu(susunPesanRingkasan(kelompok, tingkat, kini), `penjaga-ringkasan-${tingkat}-${waktu}`);
      for (const b of kelompok) {
        if (sukses) await tandaiKabar(b, tingkat);
        else await catatGagal(b);
      }
      continue;
    }
    for (const b of kelompok) {
      const sukses = await kirimSatu(susunPesanKejadian(b, kini, tingkat), `penjaga-${b.kunci}-${waktu}`);
      if (sukses) await tandaiKabar(b, tingkat);
      else await catatGagal(b);
    }
  }
  for (const b of pulihTempo) {
    const sukses = await kirimSatu(susunPesanPulih(b), `penjaga-pulih-${b.kunci}-${waktu}`);
    if (sukses) await db.run("UPDATE aleta_penjaga_kejadian SET kabar_pulih_at = ? WHERE id = ?", [waktu, b.id]);
  }
  await bersihkanRiwayatLama(db, kini);
  return hasil;
}

async function bersihkanRiwayatLama(db: AletaDatabase, kini: Date) {
  // Hanya riwayat kejadian milik penjaga sendiri (bukan data server/aplikasi lain).
  const batas = new Date(kini.getTime() - HARI_RIWAYAT * 86_400_000).toISOString();
  await db.run("DELETE FROM aleta_penjaga_kejadian WHERE pulih_at <> '' AND pulih_at < ?", [batas]);
}

// ---------------------------------------------------------------------------
// Putaran, penjadwal, layar
// ---------------------------------------------------------------------------

export async function jalankanPenjaga(db: AletaDatabase, opsi: { deps?: DepsPenjaga; pengaturan?: PengaturanPenjaga } = {}): Promise<(HasilProses & { temuan: number }) | null> {
  const pengaturan = opsi.pengaturan ?? (await bacaPengaturanPenjaga(db));
  if (!penjagaMengabari(pengaturan)) return null;
  const deps = opsi.deps ?? (await depsAsliPenjaga(db));
  const kumpulan = await kumpulkanTemuan(deps, pengaturan);
  const h = await prosesTemuan(db, kumpulan, { kini: deps.kini(), pengaturan, penerima: deps.penerima, kirim: deps.kirim });
  // Cerminan untuk pemantau di server (nomor tidak pernah dicetak). Kegagalan menulis tidak menggagalkan putaran.
  try {
    let penerima = await deps.penerima(db);
    if (pengaturan.penerimaIds.length) penerima = penerima.filter((x) => pengaturan.penerimaIds.includes(x.id));
    await tulisCerminPenerima(pengaturan, penerima);
  } catch {
    // folder pertukaran belum dapat ditulis
  }
  return { ...h, temuan: kumpulan.temuan.length };
}

/** Dinyalakan instrumentation.ts. Matikan seluruhnya dengan ALETA_PENJAGA_SERVER=0. Saklar Super Admin tetap berlaku. */
export function mulaiPenjagaBerkala(getDb: () => Promise<AletaDatabase>, env: Record<string, string | undefined> = process.env) {
  if (env.ALETA_PENJAGA_SERVER === "0") return;
  if (wadah.__penjagaDetak || wadah.__penjagaTunda) return;
  const putaran = async () => {
    if (wadah.__penjagaJalan) return;
    wadah.__penjagaJalan = true;
    try {
      await jalankanPenjaga(await getDb());
    } catch (e) {
      console.error("[Penjaga server] putaran gagal:", e instanceof Error ? e.message : "galat");
    } finally {
      wadah.__penjagaJalan = false;
    }
  };
  // Mulai 2 menit sesudah portal menyala: layanan yang sedang naik tidak dianggap mati.
  wadah.__penjagaTunda = setTimeout(() => {
    void putaran();
    wadah.__penjagaDetak = setInterval(() => void putaran(), SELANG_PENJAGA_MS);
    wadah.__penjagaDetak.unref?.();
  }, 120_000);
  wadah.__penjagaTunda.unref?.();
}

export type RiwayatKejadian = BarisKejadian & { catatan: string; terakhirDilihatAt: string };

export async function riwayatPenjaga(db: AletaDatabase, batas = 50): Promise<{ berlangsung: RiwayatKejadian[]; riwayat: RiwayatKejadian[] }> {
  const ke = (r: BarisDb): RiwayatKejadian => ({ ...keBaris(r), catatan: r.catatan, terakhirDilihatAt: r.terakhir_dilihat_at });
  const n = Math.min(200, Math.max(1, Math.floor(batas)));
  const [a, b] = await Promise.all([
    db.queryAll<BarisDb>("SELECT * FROM aleta_penjaga_kejadian WHERE pulih_at = '' ORDER BY mulai_at DESC LIMIT 100"),
    db.queryAll<BarisDb>(`SELECT * FROM aleta_penjaga_kejadian WHERE pulih_at <> '' ORDER BY mulai_at DESC LIMIT ${n}`),
  ]);
  return { berlangsung: a.map(ke), riwayat: b.map(ke) };
}
