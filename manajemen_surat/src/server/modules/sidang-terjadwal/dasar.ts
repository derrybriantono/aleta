import { type MuatanTersimpan, bacaMuatanTersimpan, type StatusSidang } from "@/lib/sidang-terjadwal";
import { type AletaDatabase } from "@/server/db/client";
import { appendAuditLog } from "@/server/shared/audit";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * ============================================================================
 * DASAR UNGGAH BAS & TUNDAAN TERJADWAL - BARIS, UBAH BERSYARAT, JEJAK (27 Okt 2026)
 * ============================================================================
 *
 * Bentuk baris tabel aleta_sidang_terjadwal(_jejak) (migrasi 0114), pembaruan
 * bersyarat (dasar klaim yang tidak ganda), dan jejak jujur: tiap peristiwa
 * penting satu baris dengan pelaku yang JUJUR - "pengguna: <nama>" untuk yang
 * ditekan manusia, "pelaksana server" untuk yang dijalankan sendiri pada
 * waktunya. Peristiwa besar (dijadwalkan, dibatalkan, selesai/gagal) ikut ke
 * audit_logs atas akun ALETA pemilik. Tidak ada yang ditulis ke SIPP dari sini.
 */

export type BarisSidang = {
  id: string;
  jenis: string;
  dibuat_oleh: string;
  dibuat_nama: string;
  peran: string;
  akun_sipp: string;
  ip: string;
  perkara_id: string;
  nomor_perkara: string;
  jadwal_id: string;
  tanggal_sidang: string;
  waktu_rencana: string;
  waktu_rencana_wita: string;
  muatan_json: string;
  berkas_nama: string;
  berkas_bentuk: string;
  berkas_ukuran: number;
  berkas_sha256: string;
  berkas_jalur: string;
  berkas_hapus_pada: string;
  status: string;
  percobaan: number;
  klaim_oleh: string;
  klaim_sampai: string;
  tunggu_sampai: string;
  hasil_ringkas: string;
  hasil_json: string;
  mulai_pada: string;
  selesai_pada: string;
  dibuat_pada: string;
  diubah_pada: string;
};

export const sebaris = (t: unknown, maks = 300) => String(t ?? "").replace(/\s+/g, " ").trim().slice(0, maks);

export const muatanDariBaris = (b: Pick<BarisSidang, "muatan_json">): MuatanTersimpan => bacaMuatanTersimpan(b.muatan_json);

export async function bacaButir(db: AletaDatabase, id: string): Promise<BarisSidang | undefined> {
  return db.queryOne<BarisSidang>("SELECT * FROM aleta_sidang_terjadwal WHERE id = ?", [id]);
}

/** Kolom yang boleh diubah lewat ubahButir (daftar putih - tidak ada nama kolom dari luar). */
const KOLOM_SAH = [
  "status",
  "percobaan",
  "klaim_oleh",
  "klaim_sampai",
  "tunggu_sampai",
  "hasil_ringkas",
  "hasil_json",
  "mulai_pada",
  "selesai_pada",
  "berkas_jalur",
  "berkas_hapus_pada",
  "waktu_rencana",
  "waktu_rencana_wita",
] as const;
type KolomSah = (typeof KOLOM_SAH)[number];

export type PerubahanSidang = Partial<{ [K in KolomSah]: K extends "percobaan" ? number : K extends "status" ? StatusSidang : string }>;

/**
 * Menerapkan perubahan. Bersyarat pada status lama (`syaratStatus`) dan/atau pemegang klaim (`syaratKlaim`)
 * di SQL-nya juga: pulang null bila baris sudah berubah oleh pihak lain - dasar klaim yang tidak ganda.
 */
export async function ubahButir(
  db: AletaDatabase,
  id: string,
  p: PerubahanSidang,
  opsi: { kini?: Date; syaratStatus?: string[]; syaratKlaim?: string } = {}
): Promise<BarisSidang | null> {
  const sets: string[] = [];
  const nilai: Array<string | number> = [];
  for (const kolom of KOLOM_SAH) {
    const v = p[kolom];
    if (v === undefined) continue;
    sets.push(`${kolom} = ?`);
    nilai.push(v);
  }
  sets.push("diubah_pada = ?");
  nilai.push((opsi.kini ?? new Date()).toISOString());
  const syarat: string[] = ["id = ?"];
  const nilaiSyarat: Array<string | number> = [id];
  if (opsi.syaratStatus) {
    syarat.push(`status IN (${opsi.syaratStatus.map(() => "?").join(", ")})`);
    nilaiSyarat.push(...opsi.syaratStatus);
  }
  if (opsi.syaratKlaim !== undefined) {
    syarat.push("klaim_oleh = ?");
    nilaiSyarat.push(opsi.syaratKlaim);
  }
  const hasil = await db.run(`UPDATE aleta_sidang_terjadwal SET ${sets.join(", ")} WHERE ${syarat.join(" AND ")}`, [...nilai, ...nilaiSyarat]);
  if (hasil.changes !== 1) return null;
  return (await bacaButir(db, id)) ?? null;
}

// ──────────────────────────────────────────────────────────────────────────
// Jejak
// ──────────────────────────────────────────────────────────────────────────

export type MasukanJejak = {
  butirId?: string;
  jenis?: string;
  nomorPerkara?: string;
  peristiwa: string;
  pelaku: string;
  pelakuId?: string;
  akunSipp?: string;
  hasil?: "ok" | "gagal" | "dilewati" | "tertahan" | "";
  ringkas: string;
  rinci?: Record<string, unknown>;
  /** Ikut ke audit_logs atas akun ALETA ini (peristiwa besar saja). */
  audit?: { aksi: string; aktorId: string | null; entitas: string };
  kini?: Date;
};

export const PELAKU_SERVER = "pelaksana server";

export async function catatJejak(db: AletaDatabase, j: MasukanJejak): Promise<void> {
  const waktu = (j.kini ?? new Date()).toISOString();
  try {
    await db.run(
      `INSERT INTO aleta_sidang_terjadwal_jejak
         (id, butir_id, jenis, nomor_perkara, waktu, peristiwa, pelaku, pelaku_id, akun_sipp, hasil, ringkas, rinci_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        await nextPrefixedId(db, "aleta_sidang_terjadwal_jejak", "sdj"),
        j.butirId ?? "",
        j.jenis ?? "",
        sebaris(j.nomorPerkara, 120),
        waktu,
        sebaris(j.peristiwa, 60),
        sebaris(j.pelaku, 160),
        j.pelakuId ?? "",
        sebaris(j.akunSipp, 80),
        j.hasil ?? "",
        sebaris(j.ringkas, 500),
        JSON.stringify(j.rinci ?? {}),
      ]
    );
  } catch (galat) {
    // Jejak yang gagal ditulis tidak boleh menggagalkan pekerjaan - tetapi dilaporkan di log server.
    console.error("[SIDANG TERJADWAL] jejak gagal dicatat:", galat);
  }
  if (j.audit) {
    try {
      await appendAuditLog(db, {
        id: await nextPrefixedId(db, "audit_logs", "adt"),
        actorUserId: j.audit.aktorId,
        action: j.audit.aksi,
        entityType: "sidang_terjadwal",
        entityId: j.audit.entitas,
        payload: {
          jenis: j.jenis ?? "",
          nomorPerkara: j.nomorPerkara ?? "",
          peristiwa: j.peristiwa,
          pelaku: j.pelaku,
          akunSipp: j.akunSipp ?? "",
          hasil: j.hasil ?? "",
          ringkas: j.ringkas,
        },
        createdAt: waktu,
      });
    } catch (galat) {
      console.error("[SIDANG TERJADWAL] audit gagal dicatat:", galat);
    }
  }
}
