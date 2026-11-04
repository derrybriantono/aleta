/**
 * ============================================================================
 * JADWAL MEDIASI DARI CERMIN (A5, 25 Okt 2026)
 * ============================================================================
 *
 * Pertemuan mediasi pada JENDELA MEDIASI ([hari ini - 3, hari ini + 21] bawaan)
 * dihitung ulang tiap 10 menit lewat baris yang SAMA dengan layar Jadwal
 * Mediasi (daftarJadwalMediasi di bot), dan disimpan di aleta_cermin_mediasi.
 * Layar membaca cermin hanya bila saklar `mediasi` menyala, cermin segar, tanpa
 * pencarian, dan seluruh rentang di jendela; selain itu jalur lama persis.
 *
 * Satu-satunya isi yang bergantung pada HARI INI (sisa tenggang PERMA 30 hari,
 * lewat tenggang) dihitung ulang saat dibaca dari tenggat yang tersimpan,
 * sehingga tidak basi walau barisnya dihitung kemarin. Lama mediasi dari view
 * SIPP mengikuti hitung ulang berkala.
 *
 * Hanya MEMBACA SIPP (rute GET bot). Tulisan ke tabel mediasi tetap lewat jalur
 * lama (penetapan mediator dst.); sesudahnya cermin disegarkan seketika.
 */
import { createHash } from "node:crypto";

import { bersihkanKeadaanMediasi, selisihHariIso, tambahHari, type KeadaanMediasi, type PengaturanCermin } from "@/lib/cermin";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import { getDatabase, withTransaction, type AletaDatabase } from "@/server/db/client";
import { botCerminAsli, type BotCerminLengkap, type MediasiSumber } from "@/server/modules/cermin/bot";
import { KUNCI_JEJAK, bacaJejak, tulisJejak } from "@/server/modules/cermin/jejak";
import { kesegaranCermin } from "@/server/modules/cermin/kesegaran";
import { muatKeadaanPemindai } from "@/server/modules/cermin/pemindai";
import { pengaturanCerminBerlaku, sumberPengaturanCermin } from "@/server/modules/cermin/pengaturan";
import { NAMA_KOLOM_MEDIASI, kolomMediasiDariBaris } from "@/server/modules/cermin/jadwal-kolom";
import { sidikJadwalAktif, tandaiTerhapus } from "@/server/modules/cermin/penyimpan";
import { tulisCerminTerakhirMs } from "@/server/modules/cermin/setelah-tulisan";

export type DepsMediasi = {
  db: () => Promise<AletaDatabase>;
  bot: Pick<BotCerminLengkap, "mediasi">;
  pengaturan: () => Promise<PengaturanCermin>;
  sekarang: () => Date;
};

export const depsMediasiAsli: DepsMediasi = {
  db: getDatabase,
  bot: botCerminAsli,
  pengaturan: sumberPengaturanCermin,
  sekarang: () => new Date(),
};

export async function muatKeadaanMediasi(db: AletaDatabase): Promise<KeadaanMediasi> {
  return bersihkanKeadaanMediasi(await bacaJejak(db, KUNCI_JEJAK.mediasi));
}

/** Jendela mediasi menurut pengaturan, atas tanggal WITA. */
export function jendelaMediasi(sekarang: Date, p: Pick<PengaturanCermin, "mediasiHariLalu" | "mediasiHariDepan">) {
  const hari = waktuPengadilan(sekarang).tanggal;
  return { hari, dari: tambahHari(hari, -p.mediasiHariLalu), sampai: tambahHari(hari, p.mediasiHariDepan) };
}

// ---------------------------------------------------------------------------
// Penyimpanan
// ---------------------------------------------------------------------------

const sidikIsi = (isi: unknown) => createHash("sha1").update(JSON.stringify(isi)).digest("hex");
const teks = (n: unknown) => String(n ?? "").trim();

/**
 * Kunci baris: mediasiId|tanggal|jam (pertemuan tidak punya id sendiri pada
 * keluaran bot). Baris kembar diberi nomor urut (#2, #3, ...) menurut urutan
 * bot, supaya tidak ada pertemuan yang tertimpa.
 */
export function kunciBarisMediasi(rows: MediasiSumber[]): string[] {
  const hitung = new Map<string, number>();
  return rows.map((r) => {
    const dasar = `${teks(r.mediasiId)}|${teks(r.tanggal)}|${teks(r.jam)}`;
    const n = (hitung.get(dasar) ?? 0) + 1;
    hitung.set(dasar, n);
    return n === 1 ? dasar : `${dasar}#${n}`;
  });
}

export async function gantiMediasiRentang(
  db: AletaDatabase,
  dari: string,
  sampai: string,
  rows: MediasiSumber[],
  opsi: { hapus: boolean; sekarang?: string }
): Promise<{ ditulis: number; tetap: number; dihapus: number }> {
  const sekarang = opsi.sekarang ?? new Date().toISOString();
  const kunci = kunciBarisMediasi(rows);
  // Baris terhapus lembut dan baris lama (kolom belum diisi) dianggap berbeda, jadi ditulis ulang (hidup lagi).
  const lama = await sidikJadwalAktif(db, "aleta_cermin_mediasi", "id", kunci);
  const baru = rows.map((r, i) => ({ r, id: kunci[i], sidik: sidikIsi(r) })).filter((x) => lama.get(x.id) !== x.sidik);
  if (baru.length > 0) {
    await withTransaction(db, async (tx) => {
      for (const { r, id, sidik } of baru) {
        await tx.run(
          `INSERT INTO aleta_cermin_mediasi (id, perkara_id, tanggal, mediator, status, baris_json, sipp_diperbarui, cermin_diperbarui, sidik,
              terhapus_at, kolom_diisi, ${NAMA_KOLOM_MEDIASI.join(", ")})
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', 1, ${NAMA_KOLOM_MEDIASI.map(() => "?").join(", ")})
           ON CONFLICT (id) DO UPDATE SET
             perkara_id = excluded.perkara_id,
             tanggal = excluded.tanggal,
             mediator = excluded.mediator,
             status = excluded.status,
             baris_json = excluded.baris_json,
             sipp_diperbarui = excluded.sipp_diperbarui,
             cermin_diperbarui = excluded.cermin_diperbarui,
             sidik = excluded.sidik,
             terhapus_at = '',
             kolom_diisi = 1,
             ${NAMA_KOLOM_MEDIASI.map((k) => `${k} = excluded.${k}`).join(",\n             ")}`,
          [
            id,
            teks(r.perkaraId),
            teks(r.tanggal),
            teks(r.mediator),
            r.selesai === true ? "selesai" : "berjalan",
            JSON.stringify(r),
            "",
            sekarang,
            sidik,
            ...NAMA_KOLOM_MEDIASI.map((k) => kolomMediasiDariBaris(r)[k]),
          ]
        );
      }
    });
  }
  let dihapus = 0;
  if (opsi.hapus) {
    const ada = new Set(kunci);
    const semua = await db.queryAll<{ id: string }>("SELECT id FROM aleta_cermin_mediasi WHERE terhapus_at = '' AND tanggal >= ? AND tanggal <= ?", [dari, sampai]);
    const hapus = semua.map((x) => String(x.id)).filter((id) => !ada.has(id));
    // Terhapus lembut: ditandai hilang, bukan di-DELETE; hidup lagi bila SIPP memilikinya kembali.
    dihapus = await tandaiTerhapus(db, "aleta_cermin_mediasi", "id", hapus, sekarang);
  }
  return { ditulis: baru.length, tetap: rows.length - baru.length, dihapus };
}

// ---------------------------------------------------------------------------
// Putaran
// ---------------------------------------------------------------------------

type Wadah = { jalan: boolean; mulaiMs: number };
const SIMPAN = globalThis as unknown as { __aletaCerminMediasi?: Wadah };
function wadah(): Wadah {
  SIMPAN.__aletaCerminMediasi ??= { jalan: false, mulaiMs: 0 };
  return SIMPAN.__aletaCerminMediasi;
}
/** Hanya untuk uji. */
export function aturUlangMediasiCermin() {
  SIMPAN.__aletaCerminMediasi = { jalan: false, mulaiMs: 0 };
}

/** Sudah menyusul tulisan terakhir lewat ALETA? (baca tulisan sendiri; lihat cerminMenyusulTulisan). */
export function mediasiMenyusulTulisan(): boolean {
  return wadah().mulaiMs >= tulisCerminTerakhirMs();
}

export type HasilMediasi = { alasan: "mati" | "menunggu-pemindaian" | "menunggu-selang" | "sibuk" | "ok" | "galat"; baris?: number; ditulis?: number; pesan?: string };

/**
 * Menghitung ulang satu rentang mediasi: dibelah dua bila terpotong batas baris;
 * rentang yang tidak terbaca (tabel/kolom tidak dikenal) atau sehari yang tetap
 * terpotong ditulis tanpa menghapus apa pun.
 */
async function segarkanRentang(
  deps: Pick<DepsMediasi, "bot" | "db">,
  dari: string,
  sampai: string,
  sekarang: string
): Promise<{ baris: number; ditulis: number; dihapus: number; peringatan: string[] }> {
  const r = await deps.bot.mediasi(dari, sampai);
  if (!r.ok) throw new Error(r.error);
  if (!r.data.terbaca) throw new Error(r.data.alasan || "jadwal mediasi tidak terbaca dari SIPP");
  if (r.data.terpotong && sampai > dari) {
    const lebar = Math.round((Date.parse(sampai) - Date.parse(dari)) / 86_400_000);
    const tengah = tambahHari(dari, Math.floor(lebar / 2));
    const kiri = await segarkanRentang(deps, dari, tengah, sekarang);
    const kanan = await segarkanRentang(deps, tambahHari(tengah, 1), sampai, sekarang);
    return {
      baris: kiri.baris + kanan.baris,
      ditulis: kiri.ditulis + kanan.ditulis,
      dihapus: kiri.dihapus + kanan.dihapus,
      peringatan: [...kiri.peringatan, ...kanan.peringatan],
    };
  }
  const db = await deps.db();
  const g = await gantiMediasiRentang(db, dari, sampai, r.data.mediasi, { hapus: !r.data.terpotong, sekarang });
  return {
    baris: r.data.mediasi.length,
    ditulis: g.ditulis,
    dihapus: g.dihapus,
    peringatan: r.data.terpotong ? [`${dari}: sehari penuh mencapai batas baris bot (pertemuan mungkin kurang).`] : [],
  };
}

/**
 * Satu putaran Jadwal Mediasi. Sendiri-sendiri menolak bila saklar pemindai
 * mati, pemindaian awal belum selesai, atau belum waktunya (mediasiMenit).
 * `paksa` melewati saklar dan selang (tombol, tulisan seketika, uji).
 */
export async function putaranMediasi(deps: DepsMediasi = depsMediasiAsli, opsi: { paksa?: boolean } = {}): Promise<HasilMediasi> {
  const w = wadah();
  if (w.jalan) return { alasan: "sibuk" };
  w.jalan = true;
  const mulaiMs = Date.now();
  try {
    const p = await deps.pengaturan();
    if (!p.pemindaiAktif && !opsi.paksa) return { alasan: "mati" };
    const db = await deps.db();
    if ((await muatKeadaanPemindai(db)).status !== "selesai") return { alasan: "menunggu-pemindaian" };
    const sekarang = deps.sekarang();
    const k = await muatKeadaanMediasi(db);
    if (!opsi.paksa && k.terakhir) {
      const jeda = k.galat.beruntun > 0 ? Math.min(900, p.mediasiMenit * 60 * 2 ** k.galat.beruntun) : p.mediasiMenit * 60;
      if (sekarang.getTime() - (Date.parse(k.terakhir) || 0) < jeda * 1000) return { alasan: "menunggu-selang" };
    }
    const iso = sekarang.toISOString();
    const j = jendelaMediasi(sekarang, p);
    try {
      const h = await segarkanRentang(deps, j.dari, j.sampai, iso);
      w.mulaiMs = mulaiMs;
      await tulisJejak(
        db,
        KUNCI_JEJAK.mediasi,
        { ...k, terakhir: iso, dari: j.dari, sampai: j.sampai, baris: h.baris, ditulis: h.ditulis, dihapus: h.dihapus, ms: Date.now() - mulaiMs, galat: { terakhir: "", pada: "", beruntun: 0 }, peringatan: h.peringatan },
        iso
      );
      return { alasan: "ok", baris: h.baris, ditulis: h.ditulis };
    } catch (galat) {
      const pesan = galat instanceof Error ? galat.message : "mediasi gagal";
      // `terakhir` TIDAK dimajukan: cermin mediasi dianggap tertinggal sampai putaran berhasil.
      await tulisJejak(db, KUNCI_JEJAK.mediasi, { ...k, galat: { terakhir: pesan.slice(0, 300), pada: iso, beruntun: k.galat.beruntun + 1 } }, iso);
      return { alasan: "galat", pesan };
    }
  } catch (galat) {
    return { alasan: "galat", pesan: galat instanceof Error ? galat.message : "mediasi gagal" };
  } finally {
    w.jalan = false;
  }
}

// ---------------------------------------------------------------------------
// Pembacaan untuk layar
// ---------------------------------------------------------------------------

const TANGGAL_ISO = /^\d{4}-\d{2}-\d{2}$/;

export type AlasanTidakDariCerminMediasi = "saklar-mati" | "ada-pencarian" | "rentang-tidak-sah" | "di-luar-jendela" | "cermin-tertinggal" | "galat";

export function bolehMediasiDariCermin(
  p: { dari?: string; sampai?: string; cari?: string },
  pengaturan: PengaturanCermin,
  sekarang: Date
): { boleh: true; dari: string; sampai: string } | { boleh: false; alasan: AlasanTidakDariCerminMediasi } {
  if (pengaturan.layar.mediasi !== true) return { boleh: false, alasan: "saklar-mati" };
  if (String(p.cari ?? "").trim() !== "") return { boleh: false, alasan: "ada-pencarian" };
  const dari = String(p.dari ?? "").trim();
  const sampai = String(p.sampai ?? "").trim() || dari;
  if (!TANGGAL_ISO.test(dari) || !TANGGAL_ISO.test(sampai) || sampai < dari) return { boleh: false, alasan: "rentang-tidak-sah" };
  const j = jendelaMediasi(sekarang, pengaturan);
  if (dari < j.dari || sampai > j.sampai) return { boleh: false, alasan: "di-luar-jendela" };
  return { boleh: true, dari, sampai };
}

export type HasilMediasiCermin = {
  ok: true;
  data: {
    ok: true;
    dari: string;
    sampai: string;
    terbaca: true;
    alasan: "";
    mediasi: Array<Record<string, unknown>>;
    cermin: { diperbaruiPada: string | null };
  };
};

export type DepsBacaMediasi = Pick<DepsMediasi, "db" | "pengaturan" | "sekarang">;
export const depsBacaMediasiAsli: DepsBacaMediasi = { db: getDatabase, pengaturan: () => pengaturanCerminBerlaku(), sekarang: () => new Date() };

/** Urutan jalur lama: tanggal, jam, nomor perkara (teks). */
export function urutanMediasi(a: Record<string, unknown>, b: Record<string, unknown>): number {
  const s = (x: unknown) => String(x ?? "");
  const t = s(a.tanggal).localeCompare(s(b.tanggal));
  if (t) return t;
  const j = s(a.jam).localeCompare(s(b.jam));
  if (j) return j;
  return s(a.nomorPerkara) < s(b.nomorPerkara) ? -1 : s(a.nomorPerkara) > s(b.nomorPerkara) ? 1 : 0;
}

/** Mediasi cermin pada [dari, sampai] urut seperti jalur lama; sisa tenggang PERMA dihitung ulang terhadap HARI INI. */
export async function muatMediasiCermin(db: AletaDatabase, dari: string, sampai: string, sekarang: Date, batasMasuk?: number): Promise<Array<Record<string, unknown>>> {
  const rows = await db.queryAll<{ baris_json: string }>("SELECT baris_json FROM aleta_cermin_mediasi WHERE terhapus_at = '' AND tanggal >= ? AND tanggal <= ?", [dari, sampai]);
  const hariIni = waktuPengadilan(sekarang).tanggal;
  const semua: Array<Record<string, unknown>> = [];
  for (const r of rows) {
    try {
      const b = JSON.parse(r.baris_json) as Record<string, unknown>;
      if (!b || typeof b !== "object") continue;
      // Bergantung pada HARI INI: dihitung ulang dengan rumus bot (selisihHari(hariIni, tenggat) bila belum selesai).
      const tenggat = String(b.tenggatPerma ?? "");
      const selesai = Boolean(String(b.laporanMediator ?? ""));
      const sisa = tenggat && !selesai ? selisihHariIso(hariIni, tenggat) : null;
      b.sisaHariTenggat = sisa;
      b.lewatTenggang = sisa !== null && sisa < 0;
      semua.push(b);
    } catch {
      // Baris cermin rusak dilewati; pencocokan mingguan memperbaikinya.
    }
  }
  semua.sort(urutanMediasi);
  const batas = Math.min(Math.max(Math.floor(Number(batasMasuk) || 200), 1), 500);
  return semua.slice(0, batas);
}

/**
 * Kesegaran mediasi: pemindaian awal selesai (kesegaranCermin) DAN jendela mediasi
 * dihitung ulang baru-baru ini (tidak lebih tua dari max(30 menit, 4 x mediasiMenit),
 * galat beruntun < 3) DAN sudah menyusul tulisan terakhir.
 */
export async function mediasiSegar(db: AletaDatabase, p: PengaturanCermin, sekarang: Date): Promise<{ segar: boolean; alasan: string; diperbaruiPada: string | null }> {
  const dasar = await kesegaranCermin(db, p, sekarang);
  if (!dasar.segar) return { segar: false, alasan: dasar.alasan, diperbaruiPada: null };
  const k = await muatKeadaanMediasi(db);
  const terakhirMs = Date.parse(k.terakhir);
  if (!Number.isFinite(terakhirMs)) return { segar: false, alasan: "jadwal mediasi belum pernah dihitung", diperbaruiPada: null };
  if (k.galat.beruntun >= 3) return { segar: false, alasan: `jadwal mediasi gagal ${k.galat.beruntun}x beruntun`, diperbaruiPada: null };
  const batasDetik = Math.max(1800, 4 * p.mediasiMenit * 60);
  const umur = (sekarang.getTime() - terakhirMs) / 1000;
  if (umur > batasDetik) return { segar: false, alasan: `jadwal mediasi terakhir dihitung ${Math.round(umur)} detik lalu`, diperbaruiPada: null };
  if (!mediasiMenyusulTulisan()) return { segar: false, alasan: "menunggu tulisan terakhir masuk cermin", diperbaruiPada: null };
  return { segar: true, alasan: "", diperbaruiPada: new Date(terakhirMs).toISOString() };
}

/**
 * Jadwal Mediasi dari cermin, atau null (pakai jalur lama). Tidak pernah melempar.
 * Sisa tenggang PERMA dihitung ulang dari tenggat tersimpan terhadap HARI INI.
 */
export async function bacaMediasiDariCermin(
  p: { dari?: string; sampai?: string; cari?: string; batas?: number },
  deps: DepsBacaMediasi = depsBacaMediasiAsli,
  catat?: (alasan: AlasanTidakDariCerminMediasi, rincian?: string) => void
): Promise<HasilMediasiCermin | null> {
  try {
    const pengaturan = await deps.pengaturan();
    const sekarang = deps.sekarang();
    const putusan = bolehMediasiDariCermin(p, pengaturan, sekarang);
    if (!putusan.boleh) {
      catat?.(putusan.alasan);
      return null;
    }
    const db = await deps.db();
    const segar = await mediasiSegar(db, pengaturan, sekarang);
    if (!segar.segar) {
      catat?.("cermin-tertinggal", segar.alasan);
      return null;
    }
    const mediasi = await muatMediasiCermin(db, putusan.dari, putusan.sampai, sekarang, p.batas);
    return {
      ok: true,
      data: { ok: true, dari: putusan.dari, sampai: putusan.sampai, terbaca: true, alasan: "", mediasi, cermin: { diperbaruiPada: segar.diperbaruiPada } },
    };
  } catch (galat) {
    catat?.("galat", galat instanceof Error ? galat.message : "galat");
    return null;
  }
}
