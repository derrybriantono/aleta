import {
  BATAS,
  hitungStatusButir,
  type LangkahButir,
  type LangkahTerjadwal,
  type PilihanForm,
  type StatusButir,
  type StatusLangkah,
  bersihkanPilihanForm,
} from "@/lib/putusan-terjadwal";
import { type AletaDatabase } from "@/server/db/client";
import { appendAuditLog } from "@/server/shared/audit";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * ============================================================================
 * DASAR UNGGAH PUTUSAN TERJADWAL - BARIS, JEJAK, PENGATURAN (21 Okt 2026, agen B3)
 * ============================================================================
 *
 * Bentuk baris tabel aleta_putusan_jadwal_* (migrasi 0080), pemetaan ke bentuk
 * yang dibaca layar/ekstensi, jejak jujur (siapa menjadwalkan, kapan dijalankan,
 * oleh pelaksana mana), dan pengaturan sistem. Tidak ada yang ditulis ke SIPP.
 *
 * JEJAK. Tiap peristiwa penting - dijadwalkan, dibatalkan, ditunda, diklaim
 * peramban, tiap langkah selesai/dilewati/gagal - satu baris di
 * aleta_putusan_jadwal_jejak dengan pelaku yang JUJUR: "pengguna: <nama>"
 * untuk yang ditekan manusia, "pelaksana server" untuk e-Doc yang dijalankan
 * sendiri pada waktunya, "peramban: <nama>" untuk pengisian Putusan Akhir oleh
 * ekstensi. Peristiwa besar (dijadwalkan, dibatalkan, butir selesai/gagal) ikut
 * ke audit_logs atas akun ALETA pemilik jadwal.
 */

export type BarisJadwal = {
  id: string;
  dibuat_oleh: string;
  dibuat_nama: string;
  peran: string;
  akun_sipp: string;
  nama_sipp: string;
  ip: string;
  sumber: string;
  tanggal_acuan: string;
  mulai_wita: string;
  batas_akhir_wita: string;
  jeda_min: number;
  jeda_maks: number;
  jam_dari: string;
  jam_sampai: string;
  malam_boleh: number;
  lintas_hari: number;
  status: string;
  catatan: string;
  dibuat_pada: string;
  diubah_pada: string;
};

export type BarisButir = {
  id: string;
  jadwal_id: string;
  urut: number;
  perkara_id: string;
  nomor_perkara: string;
  jenis_perkara: string;
  pemilik_id: string;
  akun_sipp: string;
  nama_sipp: string;
  peran: string;
  ip: string;
  waktu_rencana: string;
  langkah_isi: number;
  langkah_putusan: number;
  langkah_anonim: number;
  status_isi: string;
  status_putusan: string;
  status_anonim: string;
  catatan_isi: string;
  catatan_putusan: string;
  catatan_anonim: string;
  status: string;
  pilihan_json: string;
  berkas_id: string;
  berkas_nama: string;
  berkas_bentuk: string;
  berkas_ukuran: number;
  berkas_sha256: string;
  berkas_jalur: string;
  berkas_hapus_pada: string;
  percobaan: number;
  klaim_oleh: string;
  klaim_sampai: string;
  tunggu_sampai: string;
  edoc_sesudah: string;
  mulai_pada: string;
  selesai_pada: string;
  dilihat_pada: string;
  dibuat_pada: string;
  diubah_pada: string;
};

export type BarisBerkas = {
  id: string;
  pemilik_id: string;
  nama: string;
  bentuk: string;
  ukuran: number;
  sha256: string;
  jalur: string;
  nomor_isi: string;
  peringatan_json: string;
  dipakai_butir: string;
  dibuat_pada: string;
  dihapus_pada: string;
};

export const LANGKAH_KOLOM: Record<LangkahTerjadwal, { dipilih: keyof BarisButir; status: keyof BarisButir; catatan: keyof BarisButir }> = {
  isi: { dipilih: "langkah_isi", status: "status_isi", catatan: "catatan_isi" },
  putusan: { dipilih: "langkah_putusan", status: "status_putusan", catatan: "catatan_putusan" },
  anonim: { dipilih: "langkah_anonim", status: "status_anonim", catatan: "catatan_anonim" },
};

export const sebaris = (t: unknown, maks = 300) => String(t ?? "").replace(/\s+/g, " ").trim().slice(0, maks);

/**
 * Akun SIPP yang sedang masuk di peramban (nama tampil "Selamat Datang ..." atau username)
 * sama dengan akun yang tercatat pada butir? SIPP hanya menampilkan nama tampilnya, jadi nama
 * itu dicatat saat dijadwalkan (nama_sipp) dan dibandingkan di samping username.
 */
export function akunSippSama(masuk: string, b: Pick<BarisButir, "akun_sipp" | "nama_sipp">): boolean {
  const rapat = (x: string) => sebaris(x, 200).toLowerCase();
  const m = rapat(masuk);
  if (!m) return false;
  return m === rapat(b.akun_sipp) || (rapat(b.nama_sipp) !== "" && m === rapat(b.nama_sipp));
}

export function langkahDariBaris(b: Pick<BarisButir, "status_isi" | "status_putusan" | "status_anonim">): LangkahButir {
  return { isi: b.status_isi as StatusLangkah, putusan: b.status_putusan as StatusLangkah, anonim: b.status_anonim as StatusLangkah };
}

export function pilihanDariBaris(b: Pick<BarisButir, "pilihan_json">): PilihanForm {
  try {
    return bersihkanPilihanForm(JSON.parse(b.pilihan_json || "{}"));
  } catch {
    return {};
  }
}

export const SQL_KOLOM_BUTIR = "*";

export async function bacaButir(db: AletaDatabase, id: string): Promise<BarisButir | undefined> {
  return db.queryOne<BarisButir>("SELECT * FROM aleta_putusan_jadwal_butir WHERE id = ?", [id]);
}

export async function bacaJadwal(db: AletaDatabase, id: string): Promise<BarisJadwal | undefined> {
  return db.queryOne<BarisJadwal>("SELECT * FROM aleta_putusan_jadwal WHERE id = ?", [id]);
}

/** Perubahan satu butir: langkah (status + catatan), dan kolom lain. Status butir dihitung ulang. */
export type PerubahanButir = {
  isi?: { status?: StatusLangkah; catatan?: string };
  putusan?: { status?: StatusLangkah; catatan?: string };
  anonim?: { status?: StatusLangkah; catatan?: string };
  lain?: Partial<
    Pick<
      BarisButir,
      | "waktu_rencana"
      | "percobaan"
      | "klaim_oleh"
      | "klaim_sampai"
      | "tunggu_sampai"
      | "edoc_sesudah"
      | "mulai_pada"
      | "selesai_pada"
      | "dilihat_pada"
      | "berkas_jalur"
      | "berkas_hapus_pada"
    >
  >;
  dibatalkan?: boolean;
};

const KOLOM_LAIN_SAH = new Set([
  "waktu_rencana",
  "percobaan",
  "klaim_oleh",
  "klaim_sampai",
  "tunggu_sampai",
  "edoc_sesudah",
  "mulai_pada",
  "selesai_pada",
  "dilihat_pada",
  "berkas_jalur",
  "berkas_hapus_pada",
]);

/**
 * Menerapkan perubahan lalu menghitung ulang status butir. Bersyarat pada
 * `syarat` (mis. status lama) bila diberikan: pulang false bila baris sudah
 * berubah oleh pihak lain - dasar klaim yang tidak ganda.
 */
export async function ubahButir(
  db: AletaDatabase,
  id: string,
  p: PerubahanButir,
  opsi: { kini?: Date; syaratStatus?: string[]; syaratKlaim?: string } = {}
): Promise<BarisButir | null> {
  const baris = await bacaButir(db, id);
  if (!baris) return null;
  if (opsi.syaratStatus && !opsi.syaratStatus.includes(baris.status)) return null;
  if (opsi.syaratKlaim !== undefined && baris.klaim_oleh !== opsi.syaratKlaim) return null;
  const kini = (opsi.kini ?? new Date()).toISOString();
  const sets: string[] = [];
  const nilai: Array<string | number> = [];
  const langkah = langkahDariBaris(baris);
  for (const k of ["isi", "putusan", "anonim"] as const) {
    const u = p[k];
    if (!u) continue;
    const kol = LANGKAH_KOLOM[k];
    if (u.status) {
      sets.push(`${kol.status as string} = ?`);
      nilai.push(u.status);
      langkah[k] = u.status;
    }
    if (u.catatan !== undefined) {
      sets.push(`${kol.catatan as string} = ?`);
      nilai.push(sebaris(u.catatan, 500));
    }
  }
  for (const [kolom, v] of Object.entries(p.lain ?? {})) {
    if (!KOLOM_LAIN_SAH.has(kolom)) continue;
    sets.push(`${kolom} = ?`);
    nilai.push(v as string | number);
  }
  const status: StatusButir = hitungStatusButir(langkah, Boolean(p.dibatalkan) || baris.status === "dibatalkan");
  sets.push("status = ?", "diubah_pada = ?");
  nilai.push(status, kini);
  // Bersyarat di SQL juga: pembaca lain tidak boleh menimpa perubahan yang baru masuk.
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
  const hasil = await db.run(`UPDATE aleta_putusan_jadwal_butir SET ${sets.join(", ")} WHERE ${syarat.join(" AND ")}`, [...nilai, ...nilaiSyarat]);
  if (hasil.changes !== 1) return null;
  return (await bacaButir(db, id)) ?? null;
}

// ──────────────────────────────────────────────────────────────────────────
// Jejak
// ──────────────────────────────────────────────────────────────────────────

export type MasukanJejak = {
  jadwalId?: string;
  butirId?: string;
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

export async function catatJejak(db: AletaDatabase, j: MasukanJejak): Promise<void> {
  const waktu = (j.kini ?? new Date()).toISOString();
  try {
    await db.run(
      `INSERT INTO aleta_putusan_jadwal_jejak
         (id, jadwal_id, butir_id, nomor_perkara, waktu, peristiwa, pelaku, pelaku_id, akun_sipp, hasil, ringkas, rinci_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        await nextPrefixedId(db, "aleta_putusan_jadwal_jejak", "ptj"),
        j.jadwalId ?? "",
        j.butirId ?? "",
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
    console.error("[PUTUSAN TERJADWAL] jejak gagal dicatat:", galat);
  }
  if (j.audit) {
    try {
      await appendAuditLog(db, {
        id: await nextPrefixedId(db, "audit_logs", "adt"),
        actorUserId: j.audit.aktorId,
        action: j.audit.aksi,
        entityType: "putusan_terjadwal",
        entityId: j.audit.entitas,
        payload: {
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
      console.error("[PUTUSAN TERJADWAL] audit gagal dicatat:", galat);
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Pengaturan sistem (aleta_ekstensi_setelan, tanpa migrasi tambahan)
// ──────────────────────────────────────────────────────────────────────────

export const KUNCI_PENGATURAN = "sistem:putusan-terjadwal";
export const PENGGUNA_SISTEM = "*sistem*";

export type PengaturanTerjadwal = {
  /** Berkas dihapus dari penyimpanan N hari sesudah butirnya selesai. */
  hapusHari: number;
  /** Pelaksana server (e-Doc pada waktunya) menyala. */
  pelaksanaNyala: boolean;
  diubahOleh: string;
  diubahPada: string;
};

export const PENGATURAN_BAWAAN: PengaturanTerjadwal = { hapusHari: BATAS.hapusHariBawaan, pelaksanaNyala: true, diubahOleh: "", diubahPada: "" };

export function bersihkanPengaturan(mentah: unknown): PengaturanTerjadwal {
  const x = mentah && typeof mentah === "object" ? (mentah as Record<string, unknown>) : {};
  const hari = Math.round(Number(x.hapusHari));
  return {
    hapusHari: Number.isFinite(hari) ? Math.min(Math.max(hari, 1), BATAS.hapusHariTerlama) : BATAS.hapusHariBawaan,
    pelaksanaNyala: x.pelaksanaNyala !== false,
    diubahOleh: sebaris(x.diubahOleh, 120),
    diubahPada: sebaris(x.diubahPada, 40),
  };
}

export async function bacaPengaturan(db: AletaDatabase): Promise<PengaturanTerjadwal> {
  try {
    const b = await db.queryOne<{ nilai: string }>("SELECT nilai FROM aleta_ekstensi_setelan WHERE pengguna_id = ? AND kunci = ?", [
      PENGGUNA_SISTEM,
      KUNCI_PENGATURAN,
    ]);
    return b ? bersihkanPengaturan(JSON.parse(String(b.nilai))) : { ...PENGATURAN_BAWAAN };
  } catch {
    return { ...PENGATURAN_BAWAAN };
  }
}
