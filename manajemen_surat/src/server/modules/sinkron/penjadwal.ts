import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import { getDatabase, type AletaDatabase } from "@/server/db/client";
import { jalankanCadanganDb } from "@/server/modules/sinkron/cadangan-db";
import { buatKlienDrive, unggahCadanganKeDrive } from "@/server/modules/sinkron/drive-cadangan";
import { sinkronBerkasPerkara } from "@/server/modules/sinkron/drive-berkas";
import { bacaPengaturan, type Jadwal } from "@/server/modules/sinkron/pengaturan";
import {
  SEBUTAN_TUGAS,
  bacaKeadaan,
  catatRiwayat,
  saringRahasia,
  tulisKeadaan,
  type JenisTugas,
} from "@/server/modules/sinkron/riwayat";
import { appendAuditLog } from "@/server/shared/audit";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * Menjalankan tugas sinkron - dari tombol "Sinkron sekarang" maupun dari
 * jadwal - SATU pada satu waktu.
 *
 * ============================================================================
 * PENJADWALNYA HIDUP DI PORTAL
 * ============================================================================
 *
 * Portal belum punya penjadwal apa pun; bot punya (node-cron), tetapi bot
 * tidak pernah memanggil portal dan pengaturannya hidup di sini. Karena itu
 * detak semenit sekali dinyalakan instrumentation.ts saat portal berdiri
 * (matikan dengan ALETA_SINKRON_PENJADWAL=0), dan sebagai cadangan host dapat
 * memanggil POST /api/sinkron/picu dari cron dengan token internal - lihat
 * scripts/aleta-sinkron-cron.sh. Keduanya lewat detakSinkron() yang sama,
 * jadi tidak mungkin berjalan ganda.
 */

type Kunci = { tugas: JenisTugas; pembatal: AbortController };

const SIMPAN = globalThis as unknown as { __aletaSinkron?: { berjalan: Kunci | null; detak: NodeJS.Timeout | null } };
function wadah() {
  SIMPAN.__aletaSinkron ??= { berjalan: null, detak: null };
  return SIMPAN.__aletaSinkron;
}

export function tugasBerjalan() {
  return wadah().berjalan?.tugas ?? null;
}

export function hentikanTugas() {
  const k = wadah().berjalan;
  if (!k) return false;
  k.pembatal.abort();
  return true;
}

/**
 * Apakah jadwal sudah jatuh tempo: jam jadwal hari ini (WITA) sudah lewat,
 * dan jalan terakhir dimulai SEBELUM jam itu. Fungsi murni - diuji.
 */
export function jatuhTempo(jadwal: Jadwal, terakhirMulai: string | undefined, kini = new Date()) {
  if (jadwal.mode === "manual") return false;
  const { tanggal, jam } = waktuPengadilan(kini);
  if (jam.slice(0, 5) < jadwal.jam) return false;
  if (jadwal.mode === "mingguan") {
    const hari = new Date(`${tanggal}T12:00:00Z`).getUTCDay();
    if (hari !== jadwal.hari) return false;
  }
  if (!terakhirMulai) return true;
  const t = waktuPengadilan(new Date(terakhirMulai));
  const terakhir = `${t.tanggal} ${t.jam.slice(0, 5)}`;
  return terakhir < `${tanggal} ${jadwal.jam}`;
}

async function catatAudit(db: AletaDatabase | null, aksi: string, oleh: string | null, muatan: Record<string, unknown>) {
  if (!db) return;
  try {
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: oleh,
      action: aksi,
      entityType: "sinkron",
      entityId: String(muatan.tugas ?? "sinkron"),
      payload: muatan,
    });
  } catch {
    /* jejak yang gagal dicatat tidak membatalkan pekerjaan */
  }
}

export type PemicuTugas = { pemicu: "jadwal" | "manual"; olehId: string | null; olehNama: string };

/**
 * Menjalankan satu tugas sampai selesai. Melempar bila tugas lain sedang
 * berjalan - pemanggil dari layar menampilkannya, penjadwal menunggu detak
 * berikutnya.
 */
export async function jalankanTugas(tugas: JenisTugas, pemicu: PemicuTugas, db?: AletaDatabase) {
  const w = wadah();
  if (w.berjalan) throw new Error(`${SEBUTAN_TUGAS[w.berjalan.tugas]} sedang berjalan. Tunggu sampai selesai.`);
  const pembatal = new AbortController();
  w.berjalan = { tugas, pembatal };
  const mulai = new Date().toISOString();
  const keadaan = await bacaKeadaan();
  keadaan.berjalan = { tugas, mulai, oleh: pemicu.olehNama, kemajuan: "mulai" };
  await tulisKeadaan(keadaan);

  let terakhirLapor = 0;
  const lapor = (teks: string) => {
    if (Date.now() - terakhirLapor < 3000) return;
    terakhirLapor = Date.now();
    void bacaKeadaan().then((k) => {
      if (k.berjalan && k.berjalan.tugas === tugas) {
        k.berjalan.kemajuan = teks.slice(0, 200);
        return tulisKeadaan(k);
      }
    });
  };

  let berhasil = false;
  let byte = 0;
  let ringkasan = "";
  let sebab = "";
  let rincian: string[] = [];
  const basis = db ?? (await getDatabase().catch(() => null));
  try {
    const p = await bacaPengaturan();
    if (tugas === "cadangan") {
      if (!basis) throw new Error("Basis data portal tidak terjangkau.");
      const m = await jalankanCadanganDb(basis, { sinyal: pembatal.signal, lapor });
      byte = m.berkas.reduce((s, b) => s + b.byte, 0);
      berhasil = m.gagal.length === 0 && m.berkas.length > 0;
      ringkasan = `Bundel ${m.bundel}: ${m.berkas.length} arsip${m.tersandi ? " tersandi" : " TIDAK tersandi"}`;
      sebab = m.gagal.map((g) => `${g.sumber}: ${g.sebab}`).join("; ");
      rincian = m.berkas.map((b) => `${b.nama} - ${(b.byte / 1024 ** 2).toFixed(1)} MB`);
      // Unggah ke Drive langsung sesudahnya bila diaktifkan - satu tekan
      // "Sinkron sekarang" = cadangan + Drive, seperti yang diminta.
      if (m.berkas.length > 0 && p.drive.aktif && p.drive.cadangan.aktif) {
        try {
          const d = await unggahCadanganKeDrive(buatKlienDrive(p), p, { sinyal: pembatal.signal, lapor });
          rincian.push(`Google Drive: ${d.terunggah} berkas diunggah${d.dibuang.length ? `, ${d.dibuang.length} folder lama ke Sampah` : ""}`);
          const k = await bacaKeadaan();
          k.terakhir["drive-cadangan"] = { mulai, selesai: new Date().toISOString(), berhasil: true };
          await tulisKeadaan(k);
        } catch (galat) {
          berhasil = false;
          sebab = [sebab, `Google Drive: ${saringRahasia(galat)}`].filter(Boolean).join("; ");
        }
      }
    } else if (tugas === "drive-cadangan") {
      if (!p.drive.aktif) throw new Error("Google Drive belum diaktifkan.");
      const d = await unggahCadanganKeDrive(buatKlienDrive(p), p, { sinyal: pembatal.signal, lapor });
      berhasil = true;
      byte = d.byte;
      ringkasan = `Bundel ${d.bundel}: ${d.terunggah} berkas diunggah`;
      rincian = d.dibuang.map((n) => `Folder lama ke Sampah: ${n}`);
    } else {
      if (!p.drive.aktif) throw new Error("Google Drive belum diaktifkan.");
      const h = await sinkronBerkasPerkara(buatKlienDrive(p), p, { sinyal: pembatal.signal, lapor });
      berhasil = h.galat.length === 0 && !h.terhenti;
      byte = h.byte;
      ringkasan = `${h.diperiksa} perkara diperiksa, ${h.berkasDiunggah} berkas diunggah, ${h.berkasSama} sudah sama${h.sisa ? `, ${h.sisa} perkara menunggu jalan berikutnya` : ""}`;
      sebab = [h.terhenti, ...h.galat.slice(0, 5)].filter(Boolean).join("; ");
      rincian = h.galat.slice(0, 50);
      // Data pribadi para pihak meninggalkan portal - dicatat seperti tombol
      // ZIP mencatat tiap unduhannya.
      await catatAudit(basis, "SINKRON_DRIVE_BERKAS_PERKARA", pemicu.olehId, {
        tugas,
        pemicu: pemicu.pemicu,
        diperiksa: h.diperiksa,
        berkasDiunggah: h.berkasDiunggah,
        byte: h.byte,
      });
    }
  } catch (galat) {
    berhasil = false;
    sebab = saringRahasia(galat);
  } finally {
    w.berjalan = null;
  }

  const selesai = new Date().toISOString();
  const k = await bacaKeadaan();
  k.berjalan = null;
  k.terakhir[tugas] = { mulai, selesai, berhasil };
  await tulisKeadaan(k);
  const baris = await catatRiwayat({
    tugas,
    pemicu: pemicu.pemicu,
    oleh: pemicu.olehNama,
    mulai,
    selesai,
    berhasil,
    byte,
    ringkasan,
    sebab,
    rincian,
  });
  await catatAudit(basis, "SINKRON_TUGAS_SELESAI", pemicu.olehId, { tugas, pemicu: pemicu.pemicu, berhasil, byte });
  return baris;
}

/**
 * Satu detak penjadwal: menjalankan tugas yang jatuh tempo, satu per detak.
 * Tidak pernah melempar - penjadwal yang mati karena satu error berarti
 * cadangan yang berhenti diam-diam.
 */
export async function detakSinkron(kini = new Date()) {
  try {
    if (wadah().berjalan) return null;
    const p = await bacaPengaturan();
    const k = await bacaKeadaan();
    // Keadaan "berjalan" yang tertinggal dari portal yang mati di tengah jalan.
    if (k.berjalan) {
      k.berjalan = null;
      await tulisKeadaan(k);
    }
    const sistem: PemicuTugas = { pemicu: "jadwal", olehId: null, olehNama: "jadwal" };
    if (p.cadangan.aktif && jatuhTempo(p.cadangan.jadwal, k.terakhir.cadangan?.mulai, kini)) {
      return await jalankanTugas("cadangan", sistem);
    }
    if (p.drive.aktif && p.drive.berkasPerkara.aktif && jatuhTempo(p.drive.berkasPerkara.jadwal, k.terakhir["drive-berkas"]?.mulai, kini)) {
      return await jalankanTugas("drive-berkas", sistem);
    }
  } catch (galat) {
    console.error("[sinkron] detak gagal:", saringRahasia(galat));
  }
  return null;
}

/** Dinyalakan sekali oleh instrumentation.ts. */
export function mulaiPenjadwalSinkron() {
  if (process.env.ALETA_SINKRON_PENJADWAL === "0") return;
  const w = wadah();
  if (w.detak) return;
  w.detak = setInterval(() => {
    void detakSinkron();
  }, 60_000);
  w.detak.unref?.();
}
