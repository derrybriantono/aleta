/**
 * ============================================================================
 * AGEN ALETA - TAHAP 1 (SUPER ADMIN + HAKIM), 4 OKTOBER 2026
 * ============================================================================
 *
 * Agen mengerjakan tugas peran menurut jadwal (harian sampai tahunan) memakai
 * fitur ALETA yang SUDAH ADA, dan SELALU memberitahukan yang dikerjakannya.
 * Gambaran & planning: D:/aleta-dev/kerja/agen-aleta/agen-aleta.html.
 *
 * KELAS TINDAKAN
 *   A  otomatis penuh - langsung dikerjakan, lalu diberitahukan.
 *   B  otomatis dengan tenggang - masuk antrean "akan dikerjakan" dengan jam;
 *      dapat dibatalkan atau dikerjakan sekarang.
 *   C  satu ketukan - agen menyiapkan sampai tombol terakhir; petugas menekan.
 *   Keputusan pengguna 4 Okt: TINDAKAN HUKUM (penetapan, unggah putusan, TTE)
 *   SELALU kelas C - setelan apa pun tidak dapat menurunkannya (kelasBerlaku).
 *
 * AGEN SERVER TANPA PENJADWAL TERPISAH (tahap 1)
 *   Tugas yang jatuh tempo dijalankan saat widget pemiliknya membaca
 *   GET /api/aleta-ecourt/agen (paling cepat tiap 2 menit), sekali per
 *   periode per pengguna - jejaknya yang menjadi penanda "sudah jalan".
 *   Penjadwal bot menyusul bila tugas harus jalan saat PC petugas mati.
 *
 * SUMBER: checklist milestone (susunChecklist) untuk fakta SIPP per peran,
 * audit_logs untuk tulisan ALETA, aleta_ecourt_aksi_jejak untuk aksi e-Court,
 * aleta_bas_komentar untuk komentar hakim. Tidak ada tulisan ke SIPP, ABT,
 * atau e-Court dari modul ini: tindakan nyata dilakukan fitur yang sudah ada
 * (lewat kartu satu ketukan atau agen ekstensi), dan jejaknya kembali ke sini.
 *
 * Tabel: aleta_agen_jejak, aleta_agen_antrean, aleta_agen_setelan (0057).
 */

import { getEffectiveRoleId } from "@/lib/permissions";
import { type AletaDatabase } from "@/server/db/client";
import { type requireActorUser } from "@/server/modules/organization/service";
import { nextPrefixedId } from "@/server/shared/ids";

import { susunChecklist, tentukanPeran, type JawabanChecklist } from "./checklist-milestone";

type Aktor = Awaited<ReturnType<typeof requireActorUser>>;

export type PeranAgen = "super-admin" | "hakim";
export type Kelas = "A" | "B" | "C";
export type Sistem = "aleta" | "sipp" | "abt" | "ecourt";
export type Periode = "harian" | "mingguan" | "bulanan" | "triwulan" | "semester" | "tahunan" | "peristiwa";

export const LABEL_PERAN_AGEN: Record<PeranAgen, string> = { "super-admin": "Super Admin", hakim: "Hakim" };

export type TugasAgen = {
  kunci: string;
  peran: PeranAgen;
  judul: string;
  periode: Periode;
  /** Jam WITA paling cepat tugas jalan pada periodenya (HH:MM). */
  jam: string;
  kelasBawaan: Kelas;
  /** Tindakan hukum: selalu kelas C (keputusan 4 Okt). */
  hukum: boolean;
  sistem: Sistem;
  /** Fitur ALETA yang dipakai - untuk layar Jadwal dan Pengaturan. */
  fitur: string;
  /** "aktif" = dijalankan; "rencana" = tampil di Jadwal sebagai rencana. */
  tahap: "aktif" | "rencana";
};

/**
 * Katalog tugas tahap 1. Urutan = urutan tampil di Jadwal. Kunci tidak
 * boleh berubah - jejak dan setelan menunjuknya.
 */
export const KATALOG_AGEN: readonly TugasAgen[] = [
  // --- SUPER ADMIN ----------------------------------------------------------
  { kunci: "sa.kesehatan", peran: "super-admin", judul: "Periksa kesehatan sistem (sesi e-Court, WhatsApp, penetapan gagal, cadangan, versi server)", periode: "harian", jam: "07:00", kelasBawaan: "A", hukum: false, sistem: "aleta", fitur: "Checklist operator", tahap: "aktif" },
  { kunci: "sa.ecourt-gagal", peran: "super-admin", judul: "Aksi e-Court yang gagal 24 jam terakhir", periode: "harian", jam: "07:30", kelasBawaan: "A", hukum: false, sistem: "aleta", fitur: "Jejak aksi e-Court", tahap: "aktif" },
  { kunci: "sa.audit-tulisan", peran: "super-admin", judul: "Audit tulisan ALETA kemarin per petugas", periode: "harian", jam: "07:30", kelasBawaan: "A", hukum: false, sistem: "aleta", fitur: "Riwayat ALETA (audit)", tahap: "aktif" },
  { kunci: "sa.agen-ringkas", peran: "super-admin", judul: "Ringkasan kerja agen semua petugas hari ini", periode: "harian", jam: "16:00", kelasBawaan: "A", hukum: false, sistem: "aleta", fitur: "Riwayat agen", tahap: "aktif" },
  { kunci: "sa.usulan-pmh", peran: "super-admin", judul: "Usulan PMH/PPP/PJS perkara baru ke antrean Ketua", periode: "harian", jam: "08:00", kelasBawaan: "A", hukum: false, sistem: "aleta", fitur: "Penunjukan majelis, antrean penetapan", tahap: "rencana" },
  { kunci: "sa.laporan-mingguan", peran: "super-admin", judul: "Laporan sistem & perkara ke Ketua", periode: "mingguan", jam: "07:30", kelasBawaan: "A", hukum: false, sistem: "aleta", fitur: "Riwayat ALETA, Jadwal Sidang", tahap: "rencana" },
  { kunci: "sa.rekap-bulanan", peran: "super-admin", judul: "Rekap pemakaian ALETA per peran, pemetaan blangko kosong", periode: "bulanan", jam: "07:30", kelasBawaan: "A", hukum: false, sistem: "aleta", fitur: "Pemetaan blangko, profil saklar", tahap: "rencana" },
  { kunci: "sa.audit-akun", peran: "super-admin", judul: "Audit akun, peran, Plh/Plt; eviden SKP pegawai", periode: "triwulan", jam: "07:30", kelasBawaan: "A", hukum: false, sistem: "aleta", fitur: "Penugasan, Eviden SKP", tahap: "rencana" },
  { kunci: "sa.masa-simpan", peran: "super-admin", judul: "Masa simpan arsip e-Court dan ruang disk", periode: "semester", jam: "07:30", kelasBawaan: "A", hukum: false, sistem: "aleta", fitur: "Arsip e-Court", tahap: "rencana" },
  { kunci: "sa.kalender-libur", peran: "super-admin", judul: "Kalender libur tahun berikut", periode: "tahunan", jam: "07:30", kelasBawaan: "C", hukum: false, sistem: "aleta", fitur: "Kalender libur", tahap: "rencana" },
  // --- HAKIM ----------------------------------------------------------------
  { kunci: "hk.tenggat", peran: "hakim", judul: "Tenggat saya hari ini dan yang lewat", periode: "harian", jam: "06:30", kelasBawaan: "A", hukum: false, sistem: "aleta", fitur: "Checklist milestone hakim", tahap: "aktif" },
  { kunci: "hk.unggah-putusan", peran: "hakim", judul: "Unggah putusan yang sudah dibacakan ke SIPP", periode: "peristiwa", jam: "06:30", kelasBawaan: "C", hukum: true, sistem: "sipp", fitur: "Kerjakan perkara ini (panel ABT)", tahap: "aktif" },
  { kunci: "hk.konsep-putusan", peran: "hakim", judul: "Konsep putusan yang ditunjukkan kepada saya", periode: "harian", jam: "15:00", kelasBawaan: "A", hukum: false, sistem: "aleta", fitur: "Konseptor, putusan otomatis", tahap: "aktif" },
  { kunci: "hk.komentar-bas", peran: "hakim", judul: "Komentar saya atas BAS yang belum ditindaklanjuti", periode: "harian", jam: "13:00", kelasBawaan: "A", hukum: false, sistem: "aleta", fitur: "Komentar hakim atas BAS", tahap: "aktif" },
  { kunci: "hk.draf-putusan", peran: "hakim", judul: "Draf putusan agenda putusan besok + Input ke ABT", periode: "harian", jam: "15:00", kelasBawaan: "A", hukum: false, sistem: "abt", fitur: "Putusan otomatis, Input ke ABT", tahap: "rencana" },
  { kunci: "hk.unggah-ecourt", peran: "hakim", judul: "Unggah salinan putusan ke e-Court sesudah minutasi", periode: "peristiwa", jam: "08:00", kelasBawaan: "C", hukum: true, sistem: "ecourt", fitur: "Upload putusan ke e-Court", tahap: "rencana" },
  { kunci: "hk.lima-bulan", peran: "hakim", judul: "Perkara mendekati 5 bulan, minutasi tertunda", periode: "mingguan", jam: "07:30", kelasBawaan: "A", hukum: false, sistem: "aleta", fitur: "Status Perkara, checklist", tahap: "rencana" },
  { kunci: "hk.rekap-bulanan", peran: "hakim", judul: "Rekap kinerja bulan lalu", periode: "bulanan", jam: "07:30", kelasBawaan: "A", hukum: false, sistem: "aleta", fitur: "Status Perkara", tahap: "rencana" },
  { kunci: "hk.eviden-skp", peran: "hakim", judul: "Eviden SKP hakim", periode: "triwulan", jam: "07:30", kelasBawaan: "A", hukum: false, sistem: "aleta", fitur: "Eviden SKP", tahap: "rencana" },
  { kunci: "hk.rekap-tahunan", peran: "hakim", judul: "Perkara lewat batas waktu; rekap putusan tahunan", periode: "semester", jam: "07:30", kelasBawaan: "A", hukum: false, sistem: "aleta", fitur: "Status Perkara", tahap: "rencana" },
];

export function cariTugas(kunci: string): TugasAgen | undefined {
  return KATALOG_AGEN.find((t) => t.kunci === kunci);
}

export type Setelan = { kelas: Kelas; aktif: boolean };

/** Kelas yang berlaku. Tindakan hukum SELALU C, apa pun setelannya. */
export function kelasBerlaku(tugas: TugasAgen, setelan?: Setelan | null): Kelas {
  if (tugas.hukum) return "C";
  return setelan?.kelas ?? tugas.kelasBawaan;
}

// ============================================================================
// WAKTU WITA
// ============================================================================

const WITA_MS = 8 * 3600_000;

/** Tanggal WITA (YYYY-MM-DD) dan menit sejak tengah malam WITA. */
export function witaDari(kini: Date): { tanggal: string; menit: number; hariMinggu: number; bulan: number; tahun: number; tgl: number } {
  const w = new Date(kini.getTime() + WITA_MS);
  return {
    tanggal: w.toISOString().slice(0, 10),
    menit: w.getUTCHours() * 60 + w.getUTCMinutes(),
    hariMinggu: w.getUTCDay(),
    bulan: w.getUTCMonth() + 1,
    tahun: w.getUTCFullYear(),
    tgl: w.getUTCDate(),
  };
}

/** Awal hari WITA sebagai ISO UTC. */
export function awalHariWita(tanggal: string): string {
  return new Date(Date.parse(`${tanggal}T00:00:00+08:00`)).toISOString();
}

/**
 * Kunci periode tugas pada saat `kini`, atau "" bila belum jatuh tempo
 * (jam belum sampai / bukan hari periodenya). Satu kunci = satu kali jalan.
 */
export function kunciPeriode(tugas: TugasAgen, kini: Date): string {
  const w = witaDari(kini);
  const [jj, mm] = tugas.jam.split(":").map(Number);
  if (w.menit < jj * 60 + mm) return "";
  switch (tugas.periode) {
    case "harian":
    case "peristiwa":
      return w.tanggal;
    case "mingguan":
      return w.hariMinggu === 1 ? `${w.tanggal}` : "";
    case "bulanan":
      return w.tgl === 1 ? `${w.tahun}-${String(w.bulan).padStart(2, "0")}` : "";
    case "triwulan":
      return w.tgl === 1 && [1, 4, 7, 10].includes(w.bulan) ? `${w.tahun}-T${Math.ceil(w.bulan / 3)}` : "";
    case "semester":
      return w.tgl === 1 && [1, 7].includes(w.bulan) ? `${w.tahun}-S${w.bulan === 1 ? 1 : 2}` : "";
    case "tahunan":
      return w.tgl === 2 && w.bulan === 1 ? `${w.tahun}` : "";
  }
}

// ============================================================================
// PERAN
// ============================================================================

/** Peran agen yang dimiliki pengguna (tahap 1: Super Admin dan Hakim). */
export function peranAgen(aktor: Aktor): PeranAgen[] {
  const peran = new Set(
    [String(aktor.roleId ?? ""), String(getEffectiveRoleId(aktor) ?? ""), ...(aktor.additionalRoleIds ?? []).map(String)].filter(Boolean)
  );
  const hasil: PeranAgen[] = [];
  if (peran.has("super-admin")) hasil.push("super-admin");
  if (tentukanPeran(aktor, []).includes("hakim")) hasil.push("hakim");
  return hasil;
}

// ============================================================================
// SETELAN, JEJAK, ANTREAN
// ============================================================================

export async function bacaSetelan(db: AletaDatabase): Promise<Map<string, Setelan>> {
  const baris = (await db.prepare("SELECT peran, tugas, kelas, aktif FROM aleta_agen_setelan").all()) as Array<Record<string, unknown>>;
  const peta = new Map<string, Setelan>();
  for (const b of baris) peta.set(String(b.tugas), { kelas: String(b.kelas) as Kelas, aktif: Number(b.aktif) === 1 });
  return peta;
}

export async function simpanSetelan(
  db: AletaDatabase,
  aktor: Aktor,
  masukan: { tugas: string; kelas: Kelas; aktif: boolean }
): Promise<Setelan> {
  const t = cariTugas(masukan.tugas);
  if (!t) throw new Error(`Tugas agen "${masukan.tugas}" tidak dikenal.`);
  if (!["A", "B", "C"].includes(masukan.kelas)) throw new Error("Kelas harus A, B, atau C.");
  // Tindakan hukum tetap C: setelan lain disimpan apa adanya tetapi tidak berlaku.
  const kelas: Kelas = t.hukum ? "C" : masukan.kelas;
  const kini = new Date().toISOString();
  await db.prepare("DELETE FROM aleta_agen_setelan WHERE peran = ? AND tugas = ?").run(t.peran, t.kunci);
  await db
    .prepare("INSERT INTO aleta_agen_setelan (peran, tugas, kelas, aktif, diubah_oleh, diubah_pada) VALUES (?, ?, ?, ?, ?, ?)")
    .run(t.peran, t.kunci, kelas, masukan.aktif ? 1 : 0, String(aktor.name ?? aktor.id), kini);
  return { kelas, aktif: masukan.aktif };
}

export type MasukanJejak = {
  penggunaId: string;
  penggunaNama: string;
  peran: string;
  tugas: string;
  kelas: Kelas;
  sistem: Sistem;
  nomorPerkara?: string;
  ringkas: string;
  rincian?: string;
  sebelum?: unknown;
  sesudah?: unknown;
  status: "dikerjakan" | "dicoba" | "gagal" | "dibatalkan" | "diurungkan" | "diketuk";
  alasan?: string;
  alamatIp?: string;
};

const potong = (s: unknown, n: number) => String(s ?? "").slice(0, n);

export async function catatJejak(db: AletaDatabase, m: MasukanJejak): Promise<string> {
  const id = await nextPrefixedId(db, "aleta_agen_jejak", "agj");
  const kini = new Date().toISOString();
  await db
    .prepare(
      "INSERT INTO aleta_agen_jejak (id, pengguna_id, pengguna_nama, peran, tugas, kelas, sistem, nomor_perkara, ringkas, rincian, sebelum_json, sesudah_json, status, alasan, alamat_ip, lewat, dibuat_pada, diubah_pada) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ALETA', ?, ?)"
    )
    .run(
      id,
      m.penggunaId,
      potong(m.penggunaNama, 120),
      m.peran,
      m.tugas,
      m.kelas,
      m.sistem,
      potong(m.nomorPerkara, 80),
      potong(m.ringkas, 300),
      potong(m.rincian, 2000),
      m.sebelum === undefined ? "" : potong(JSON.stringify(m.sebelum), 8000),
      m.sesudah === undefined ? "" : potong(JSON.stringify(m.sesudah), 8000),
      m.status,
      potong(m.alasan, 300),
      potong(m.alamatIp, 64),
      kini,
      kini
    );
  return id;
}

export type BarisJejak = {
  id: string;
  penggunaId: string;
  penggunaNama: string;
  peran: string;
  tugas: string;
  kelas: Kelas;
  sistem: Sistem;
  nomorPerkara: string;
  ringkas: string;
  rincian: string;
  bisaDiurungkan: boolean;
  status: string;
  alasan: string;
  dibuatPada: string;
};

function keJejak(b: Record<string, unknown>): BarisJejak {
  return {
    id: String(b.id),
    penggunaId: String(b.pengguna_id),
    penggunaNama: String(b.pengguna_nama ?? ""),
    peran: String(b.peran),
    tugas: String(b.tugas),
    kelas: String(b.kelas) as Kelas,
    sistem: String(b.sistem) as Sistem,
    nomorPerkara: String(b.nomor_perkara ?? ""),
    ringkas: String(b.ringkas ?? ""),
    rincian: String(b.rincian ?? ""),
    bisaDiurungkan: String(b.status) === "dikerjakan" && String(b.sebelum_json ?? "") !== "",
    status: String(b.status),
    alasan: String(b.alasan ?? ""),
    dibuatPada: String(b.dibuat_pada),
  };
}

export async function bacaJejak(
  db: AletaDatabase,
  saring: { penggunaId?: string; sejak?: string; tugas?: string; batas?: number }
): Promise<BarisJejak[]> {
  const syarat: string[] = [];
  const nilai: unknown[] = [];
  if (saring.penggunaId) {
    syarat.push("pengguna_id = ?");
    nilai.push(saring.penggunaId);
  }
  if (saring.sejak) {
    syarat.push("dibuat_pada >= ?");
    nilai.push(saring.sejak);
  }
  if (saring.tugas) {
    syarat.push("tugas = ?");
    nilai.push(saring.tugas);
  }
  const batas = Math.max(1, Math.min(500, Math.floor(saring.batas ?? 50)));
  const baris = (await db
    .prepare(
      `SELECT * FROM aleta_agen_jejak${syarat.length ? " WHERE " + syarat.join(" AND ") : ""} ORDER BY dibuat_pada DESC, id DESC LIMIT ${batas}`
    )
    .all(...nilai)) as Array<Record<string, unknown>>;
  return baris.map(keJejak);
}

export type BarisAntrean = {
  id: string;
  peran: string;
  tugas: string;
  kelas: "B" | "C";
  sistem: Sistem;
  nomorPerkara: string;
  kunci: string;
  ringkas: string;
  rincian: string;
  muatan: Record<string, unknown>;
  jadwalPada: string;
  status: string;
  dibuatPada: string;
};

function keAntrean(b: Record<string, unknown>): BarisAntrean {
  let muatan: Record<string, unknown> = {};
  try {
    muatan = JSON.parse(String(b.muatan_json || "{}"));
  } catch {
    muatan = {};
  }
  return {
    id: String(b.id),
    peran: String(b.peran),
    tugas: String(b.tugas),
    kelas: String(b.kelas) as "B" | "C",
    sistem: String(b.sistem) as Sistem,
    nomorPerkara: String(b.nomor_perkara ?? ""),
    kunci: String(b.kunci),
    ringkas: String(b.ringkas ?? ""),
    rincian: String(b.rincian ?? ""),
    muatan,
    jadwalPada: String(b.jadwal_pada ?? ""),
    status: String(b.status),
    dibuatPada: String(b.dibuat_pada),
  };
}

/** Tambah butir antrean; butir berkunci sama (pengguna, kunci) yang sudah ada tidak digandakan. */
export async function tambahAntrean(
  db: AletaDatabase,
  m: {
    penggunaId: string;
    peran: string;
    tugas: string;
    kelas: "B" | "C";
    sistem: Sistem;
    nomorPerkara?: string;
    kunci: string;
    ringkas: string;
    rincian?: string;
    muatan?: Record<string, unknown>;
    jadwalPada?: string;
  }
): Promise<{ id: string; baru: boolean }> {
  const ada = (await db
    .prepare("SELECT id FROM aleta_agen_antrean WHERE pengguna_id = ? AND kunci = ?")
    .get(m.penggunaId, m.kunci)) as { id?: string } | undefined;
  if (ada?.id) return { id: String(ada.id), baru: false };
  const id = await nextPrefixedId(db, "aleta_agen_antrean", "aga");
  const kini = new Date().toISOString();
  await db
    .prepare(
      "INSERT INTO aleta_agen_antrean (id, pengguna_id, peran, tugas, kelas, sistem, nomor_perkara, kunci, ringkas, rincian, muatan_json, jadwal_pada, status, dibuat_pada, diubah_pada) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'menunggu', ?, ?)"
    )
    .run(
      id,
      m.penggunaId,
      m.peran,
      m.tugas,
      m.kelas,
      m.sistem,
      potong(m.nomorPerkara, 80),
      potong(m.kunci, 200),
      potong(m.ringkas, 300),
      potong(m.rincian, 2000),
      JSON.stringify(m.muatan ?? {}),
      m.jadwalPada ?? "",
      kini,
      kini
    );
  return { id, baru: true };
}

export async function bacaAntrean(db: AletaDatabase, penggunaId: string, status = "menunggu"): Promise<BarisAntrean[]> {
  const baris = (await db
    .prepare("SELECT * FROM aleta_agen_antrean WHERE pengguna_id = ? AND status = ? ORDER BY dibuat_pada ASC, id ASC")
    .all(penggunaId, status)) as Array<Record<string, unknown>>;
  return baris.map(keAntrean);
}

async function ubahStatusAntrean(db: AletaDatabase, id: string, status: string) {
  await db.prepare("UPDATE aleta_agen_antrean SET status = ?, diubah_pada = ? WHERE id = ?").run(status, new Date().toISOString(), id);
}

// ============================================================================
// PENJALAN TUGAS
// ============================================================================

type Konteks = { db: AletaDatabase; aktor: Aktor; kini: Date; galat: string[]; checklist: Map<string, Promise<JawabanChecklist>> };

type HasilTugas = {
  /** Kabar untuk jejak (kelas A). Kosong = tidak ada yang perlu dikabarkan. */
  ringkas: string;
  rincian?: string;
  nomorPerkara?: string;
  /** Butir antrean B/C yang ditimbulkan tugas ini. */
  antrean?: Array<{ kunci: string; ringkas: string; rincian?: string; nomorPerkara?: string; muatan?: Record<string, unknown> }>;
  /** Kunci antrean yang masih berlaku - butir lain tugas ini dianggap sudah dikerjakan di sistemnya. */
  kunciBerlaku?: string[];
};

function checklistPeran(k: Konteks, peran: string): Promise<JawabanChecklist> {
  let j = k.checklist.get(peran);
  if (!j) {
    j = susunChecklist(k.db, k.aktor, { peranDiminta: peran });
    k.checklist.set(peran, j);
  }
  return j;
}

const SEBUT_KELOMPOK: Record<string, string> = { lewat: "lewat", "hari-ini": "hari ini", "minggu-ini": "minggu ini" };

const PENJALAN: Record<string, (k: Konteks) => Promise<HasilTugas>> = {
  async "sa.kesehatan"(k) {
    const j = await checklistPeran(k, "operator");
    const masalah = j.butir.filter((b) => b.kelompok === "lewat" || b.kelompok === "hari-ini");
    if (j.peranAktif !== "operator") return { ringkas: "Checklist operator tidak tersedia untuk akun ini; kesehatan sistem tidak diperiksa.", rincian: j.galat.join(" ") };
    if (masalah.length === 0) return { ringkas: `Memeriksa ${j.butir.length + j.jenisTidakTersedia.length} hal sistem: tidak ada yang perlu ditindaklanjuti.` };
    return {
      ringkas: `Memeriksa sistem: ${masalah.length} hal perlu ditindaklanjuti.`,
      rincian: masalah
        .slice(0, 8)
        .map((b) => `• ${b.judul}${b.perkara ? ` (${b.perkara.nomor})` : ""} - ${SEBUT_KELOMPOK[b.kelompok] ?? b.kelompok}`)
        .join("\n"),
    };
  },

  async "sa.ecourt-gagal"(k) {
    const sejak = new Date(k.kini.getTime() - 24 * 3600_000).toISOString();
    const baris = (await k.db
      .prepare("SELECT aksi, pengguna_nama, nomor_perkara, alasan FROM aleta_ecourt_aksi_jejak WHERE hasil = 'gagal' AND dibuat_pada >= ? ORDER BY dibuat_pada DESC")
      .all(sejak)) as Array<Record<string, unknown>>;
    if (baris.length === 0) return { ringkas: "Aksi e-Court 24 jam terakhir: tidak ada yang gagal." };
    return {
      ringkas: `Aksi e-Court 24 jam terakhir: ${baris.length} gagal.`,
      rincian: baris
        .slice(0, 8)
        .map((b) => `• ${b.aksi} ${b.nomor_perkara || ""} oleh ${b.pengguna_nama || "-"}: ${String(b.alasan || "tanpa alasan").slice(0, 120)}`)
        .join("\n"),
    };
  },

  async "sa.audit-tulisan"(k) {
    const w = witaDari(k.kini);
    const kemarin = new Date(Date.parse(`${w.tanggal}T00:00:00+08:00`) - 24 * 3600_000).toISOString();
    const hariIni = awalHariWita(w.tanggal);
    const baris = (await k.db
      .prepare(
        "SELECT a.actor_user_id AS aktor, COALESCE(u.name, a.actor_user_id, '-') AS nama, a.action AS aksi, COUNT(*) AS n " +
          "FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id WHERE a.created_at >= ? AND a.created_at < ? GROUP BY a.actor_user_id, u.name, a.action ORDER BY n DESC"
      )
      .all(kemarin, hariIni)) as Array<Record<string, unknown>>;
    const total = baris.reduce((s, b) => s + Number(b.n || 0), 0);
    if (total === 0) return { ringkas: "Audit kemarin: tidak ada tulisan ALETA yang tercatat." };
    const perOrang = new Map<string, number>();
    for (const b of baris) perOrang.set(String(b.nama), (perOrang.get(String(b.nama)) ?? 0) + Number(b.n || 0));
    return {
      ringkas: `Audit kemarin: ${total} tulisan ALETA oleh ${perOrang.size} petugas.`,
      rincian: [...perOrang]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([nama, n]) => `• ${nama}: ${n}`)
        .join("\n"),
    };
  },

  async "sa.agen-ringkas"(k) {
    const sejak = awalHariWita(witaDari(k.kini).tanggal);
    const baris = (await k.db
      .prepare("SELECT pengguna_nama, status, COUNT(*) AS n FROM aleta_agen_jejak WHERE dibuat_pada >= ? AND tugas <> 'sa.agen-ringkas' GROUP BY pengguna_nama, status")
      .all(sejak)) as Array<Record<string, unknown>>;
    const total = baris.reduce((s, b) => s + Number(b.n || 0), 0);
    const gagal = baris.filter((b) => b.status === "gagal").reduce((s, b) => s + Number(b.n || 0), 0);
    return {
      ringkas: total === 0 ? "Agen hari ini: belum ada pekerjaan tercatat." : `Agen hari ini: ${total} tindakan tercatat, ${gagal} gagal.`,
      rincian: baris.map((b) => `• ${b.pengguna_nama || "-"}: ${b.n} ${b.status}`).join("\n"),
    };
  },

  async "hk.tenggat"(k) {
    const j = await checklistPeran(k, "hakim");
    if (j.peranAktif !== "hakim") return { ringkas: "Checklist hakim tidak tersedia untuk akun ini.", rincian: j.galat.join(" ") };
    const lewat = j.butir.filter((b) => b.kelompok === "lewat");
    const hari = j.butir.filter((b) => b.kelompok === "hari-ini");
    if (lewat.length + hari.length === 0) return { ringkas: "Tenggat hari ini: tidak ada yang lewat atau jatuh hari ini." };
    return {
      ringkas: `Tenggat: ${lewat.length} lewat, ${hari.length} hari ini.`,
      rincian: [...lewat, ...hari]
        .slice(0, 10)
        .map((b) => `• ${b.judul}${b.perkara ? ` - ${b.perkara.nomor}` : ""} (${SEBUT_KELOMPOK[b.kelompok] ?? b.kelompok})`)
        .join("\n"),
    };
  },

  async "hk.unggah-putusan"(k) {
    const j = await checklistPeran(k, "hakim");
    const butir = j.butir.filter((b) => b.jenis === "hakim.putusan-belum-unggah" && b.perkara);
    return {
      ringkas: "",
      antrean: butir.map((b) => ({
        kunci: `hk.unggah-putusan|${b.perkara!.id}`,
        ringkas: `Unggah putusan ${b.perkara!.nomor} ke SIPP`,
        rincian: `${b.keterangan || "Putusan sudah dibacakan; dokumen putusannya belum ada di SIPP."} Buka blangko putusannya di ABT, lalu tekan "Kerjakan perkara ini" di panel ABT.`,
        nomorPerkara: b.perkara!.nomor,
        muatan: { perkaraId: b.perkara!.id, kerjakan: b.kerjakan, tenggat: b.tenggat },
      })),
      kunciBerlaku: butir.map((b) => `hk.unggah-putusan|${b.perkara!.id}`),
    };
  },

  async "hk.konsep-putusan"(k) {
    const j = await checklistPeran(k, "hakim");
    const butir = j.butir.filter((b) => b.jenis === "hakim.konsep-putusan");
    if (butir.length === 0) return { ringkas: "" };
    return {
      ringkas: `${butir.length} konsep putusan ditunjukkan kepada Anda dan belum selesai.`,
      rincian: butir.slice(0, 8).map((b) => `• ${b.perkara?.nomor ?? b.judul}${b.tenggat ? ` - tenggat ${b.tenggat.slice(0, 10)}` : ""}`).join("\n"),
    };
  },

  async "hk.komentar-bas"(k) {
    const batas = new Date(k.kini.getTime() - 24 * 3600_000).toISOString();
    const baris = (await k.db
      .prepare(
        "SELECT nomor_perkara, sidang_ke, dibuat_pada FROM aleta_bas_komentar WHERE penulis_id = ? AND selesai = 0 AND dibuat_pada < ? ORDER BY dibuat_pada ASC"
      )
      .all(k.aktor.id, batas)) as Array<Record<string, unknown>>;
    if (baris.length === 0) return { ringkas: "" };
    return {
      ringkas: `${baris.length} komentar Anda atas BAS belum ditindaklanjuti lebih dari sehari.`,
      rincian: baris
        .slice(0, 8)
        .map((b) => `• ${b.nomor_perkara}${b.sidang_ke ? ` sidang ke-${b.sidang_ke}` : ""} (sejak ${String(b.dibuat_pada).slice(0, 10)})`)
        .join("\n"),
    };
  },
};

/** Tugas yang punya penjalan - tugas aktif tanpa penjalan dianggap rencana. */
export function tugasBisaJalan(t: TugasAgen): boolean {
  return t.tahap === "aktif" && typeof PENJALAN[t.kunci] === "function";
}

async function sudahJalan(db: AletaDatabase, penggunaId: string, tugas: string, kunci: string): Promise<boolean> {
  const b = (await db
    .prepare("SELECT id FROM aleta_agen_jejak WHERE pengguna_id = ? AND tugas = ? AND alasan = ? LIMIT 1")
    .get(penggunaId, tugas, `periode:${kunci}`)) as { id?: string } | undefined;
  return Boolean(b?.id);
}

/**
 * Jalankan tugas yang jatuh tempo untuk pengguna ini (sekali per periode).
 * Hasil kelas A dicatat sebagai jejak "dikerjakan" berpenanda periode;
 * butir B/C masuk antrean; butir antrean yang sumbernya sudah tidak ada
 * ditandai dikerjakan (diselesaikan di sistemnya).
 */
export async function jalankanJatuhTempo(
  db: AletaDatabase,
  aktor: Aktor,
  peran: PeranAgen,
  kini: Date,
  opsi: { alamatIp?: string } = {}
): Promise<{ dijalankan: string[]; galat: string[] }> {
  const setelan = await bacaSetelan(db);
  const k: Konteks = { db, aktor, kini, galat: [], checklist: new Map() };
  const dijalankan: string[] = [];
  for (const t of KATALOG_AGEN) {
    if (t.peran !== peran || !tugasBisaJalan(t)) continue;
    const s = setelan.get(t.kunci);
    if (s && !s.aktif) continue;
    const periode = kunciPeriode(t, kini);
    if (!periode) continue;
    if (t.periode !== "peristiwa" && (await sudahJalan(db, aktor.id, t.kunci, periode))) continue;
    const kelas = kelasBerlaku(t, s);
    try {
      const hasil = await PENJALAN[t.kunci](k);
      if (hasil.antrean) {
        const kelasAntrean: "B" | "C" = kelas === "A" ? "B" : kelas;
        for (const a of hasil.antrean) {
          const r = await tambahAntrean(db, {
            penggunaId: aktor.id,
            peran,
            tugas: t.kunci,
            kelas: kelasAntrean,
            sistem: t.sistem,
            nomorPerkara: a.nomorPerkara,
            kunci: a.kunci,
            ringkas: a.ringkas,
            rincian: a.rincian,
            muatan: a.muatan,
          });
          if (r.baru) {
            await catatJejak(db, {
              penggunaId: aktor.id,
              penggunaNama: String(aktor.name ?? ""),
              peran,
              tugas: t.kunci,
              kelas: kelasAntrean,
              sistem: "aleta",
              nomorPerkara: a.nomorPerkara,
              ringkas: `Menyiapkan: ${a.ringkas} (menunggu ketukan Anda)`,
              status: "dikerjakan",
              alamatIp: opsi.alamatIp,
            });
          }
        }
      }
      if (hasil.kunciBerlaku) {
        const berlaku = new Set(hasil.kunciBerlaku);
        for (const a of await bacaAntrean(db, aktor.id)) {
          if (a.tugas === t.kunci && !berlaku.has(a.kunci)) {
            await ubahStatusAntrean(db, a.id, "dikerjakan");
            await catatJejak(db, {
              penggunaId: aktor.id,
              penggunaNama: String(aktor.name ?? ""),
              peran,
              tugas: t.kunci,
              kelas: a.kelas,
              sistem: a.sistem,
              nomorPerkara: a.nomorPerkara,
              ringkas: `Selesai di ${a.sistem.toUpperCase()}: ${a.ringkas}`,
              status: "diketuk",
              alamatIp: opsi.alamatIp,
            });
          }
        }
      }
      if (t.periode !== "peristiwa" && hasil.ringkas) {
        await catatJejak(db, {
          penggunaId: aktor.id,
          penggunaNama: String(aktor.name ?? ""),
          peran,
          tugas: t.kunci,
          kelas: "A",
          sistem: "aleta",
          nomorPerkara: hasil.nomorPerkara,
          ringkas: hasil.ringkas,
          rincian: hasil.rincian,
          status: "dikerjakan",
          alasan: `periode:${periode}`,
          alamatIp: opsi.alamatIp,
        });
      } else if (t.periode !== "peristiwa") {
        // Tidak ada yang perlu dikabarkan - tetap dicatat supaya tidak diulang sepanjang periode.
        await catatJejak(db, {
          penggunaId: aktor.id,
          penggunaNama: String(aktor.name ?? ""),
          peran,
          tugas: t.kunci,
          kelas: "A",
          sistem: "aleta",
          ringkas: `${t.judul}: tidak ada yang perlu ditindaklanjuti.`,
          status: "dicoba",
          alasan: `periode:${periode}`,
          alamatIp: opsi.alamatIp,
        });
      }
      dijalankan.push(t.kunci);
    } catch (galat) {
      const pesan = String((galat as Error)?.message ?? galat).slice(0, 200);
      k.galat.push(`${t.judul}: ${pesan}`);
      await catatJejak(db, {
        penggunaId: aktor.id,
        penggunaNama: String(aktor.name ?? ""),
        peran,
        tugas: t.kunci,
        kelas,
        sistem: "aleta",
        ringkas: `Gagal: ${t.judul}`,
        status: "gagal",
        alasan: `periode:${periode}`,
        rincian: pesan,
        alamatIp: opsi.alamatIp,
      });
    }
  }
  return { dijalankan, galat: k.galat };
}

// ============================================================================
// JAWABAN UNTUK WIDGET
// ============================================================================

export type JawabanAgen = {
  pengguna: { nama: string };
  peranTersedia: Array<{ kunci: PeranAgen; label: string }>;
  peranAktif: PeranAgen | "";
  dibuat: string;
  dikerjakan: BarisJejak[];
  akan: BarisAntrean[];
  ketuk: BarisAntrean[];
  jadwal: Array<{ kunci: string; judul: string; periode: Periode; jam: string; kelas: Kelas; hukum: boolean; sistem: Sistem; fitur: string; tahap: "aktif" | "rencana"; aktif: boolean }>;
  galat: string[];
};

const singgahJalan = new Map<string, number>();
/** Jarak minimum antar-jalan tugas per pengguna & peran. Dibuka untuk uji. */
export const JEDA_JALAN_MS = 120_000;
export function kosongkanSinggahAgen() {
  singgahJalan.clear();
}

export async function susunAgen(
  db: AletaDatabase,
  aktor: Aktor,
  opsi: { peranDiminta?: string; kini?: Date; alamatIp?: string; jalankan?: boolean } = {}
): Promise<JawabanAgen> {
  const kini = opsi.kini ?? new Date();
  const tersedia = peranAgen(aktor);
  const diminta = String(opsi.peranDiminta ?? "").trim() as PeranAgen;
  const aktif: PeranAgen | "" = tersedia.includes(diminta) ? diminta : tersedia[0] ?? "";
  const galat: string[] = [];
  if (diminta && !tersedia.includes(diminta)) galat.push(`Peran agen "${diminta}" tidak tersedia untuk akun Anda.`);
  const dasar = {
    pengguna: { nama: String(aktor.name ?? "") },
    peranTersedia: tersedia.map((p) => ({ kunci: p, label: LABEL_PERAN_AGEN[p] })),
    peranAktif: aktif,
    dibuat: kini.toISOString(),
  };
  if (!aktif) {
    return {
      ...dasar,
      dikerjakan: [],
      akan: [],
      ketuk: [],
      jadwal: [],
      galat: ["Agen tahap 1 tersedia untuk Super Admin dan Hakim. Peran lain menyusul.", ...galat],
    };
  }

  if (opsi.jalankan !== false) {
    const kunci = `${aktor.id}|${aktif}`;
    const terakhir = singgahJalan.get(kunci) ?? 0;
    if (opsi.kini || kini.getTime() - terakhir >= JEDA_JALAN_MS) {
      singgahJalan.set(kunci, kini.getTime());
      const r = await jalankanJatuhTempo(db, aktor, aktif, kini, { alamatIp: opsi.alamatIp });
      galat.push(...r.galat);
    }
  }

  const setelan = await bacaSetelan(db);
  const sejak = awalHariWita(witaDari(kini).tanggal);
  const jejak = (await bacaJejak(db, { penggunaId: aktor.id, sejak, batas: 60 })).filter((j) => j.status !== "dicoba");
  const antrean = (await bacaAntrean(db, aktor.id)).filter((a) => cariTugas(a.tugas)?.peran === aktif);
  return {
    ...dasar,
    dikerjakan: jejak.filter((j) => j.peran === aktif),
    akan: antrean.filter((a) => a.kelas === "B"),
    ketuk: antrean.filter((a) => a.kelas === "C"),
    jadwal: KATALOG_AGEN.filter((t) => t.peran === aktif).map((t) => {
      const s = setelan.get(t.kunci);
      return {
        kunci: t.kunci,
        judul: t.judul,
        periode: t.periode,
        jam: t.jam,
        kelas: kelasBerlaku(t, s),
        hukum: t.hukum,
        sistem: t.sistem,
        fitur: t.fitur,
        tahap: tugasBisaJalan(t) ? "aktif" : "rencana",
        aktif: s ? s.aktif : true,
      };
    }),
    galat,
  };
}

// ============================================================================
// AKSI DARI WIDGET
// ============================================================================

export type AksiAgen = "batalkan" | "kerjakan" | "diketuk" | "urungkan";

/**
 * Aksi petugas atas antrean atau jejaknya sendiri.
 *   batalkan  antrean B/C -> dibatalkan (jejak "dibatalkan")
 *   kerjakan  antrean B -> dikerjakan sekarang (jejak "dikerjakan")
 *   diketuk   antrean C -> petugas menekan tombol aslinya (jejak "diketuk")
 *   urungkan  jejak kelas A yang punya keadaan "sebelum" -> diurungkan;
 *             pemulihan nilai di SIPP/ABT dikerjakan agen ekstensi dari
 *             `sebelum` yang dikembalikan.
 * Hanya milik pemanggil; milik orang lain dijawab "tidak ditemukan".
 */
export async function aksiAgen(
  db: AletaDatabase,
  aktor: Aktor,
  masukan: { id: string; aksi: AksiAgen; alamatIp?: string }
): Promise<{ ok: true; status: string; sebelum?: unknown }> {
  const nama = String(aktor.name ?? "");
  if (masukan.aksi === "urungkan") {
    const b = (await db.prepare("SELECT * FROM aleta_agen_jejak WHERE id = ? AND pengguna_id = ?").get(masukan.id, aktor.id)) as
      | Record<string, unknown>
      | undefined;
    if (!b) throw new Error("Jejak agen tidak ditemukan.");
    const j = keJejak(b);
    if (!j.bisaDiurungkan) throw new Error("Tindakan ini tidak dapat diurungkan.");
    await db.prepare("UPDATE aleta_agen_jejak SET status = 'diurungkan', diubah_pada = ? WHERE id = ?").run(new Date().toISOString(), j.id);
    let sebelum: unknown = null;
    try {
      sebelum = JSON.parse(String(b.sebelum_json || "null"));
    } catch {
      sebelum = null;
    }
    return { ok: true, status: "diurungkan", sebelum };
  }
  const b = (await db.prepare("SELECT * FROM aleta_agen_antrean WHERE id = ? AND pengguna_id = ?").get(masukan.id, aktor.id)) as
    | Record<string, unknown>
    | undefined;
  if (!b) throw new Error("Butir antrean agen tidak ditemukan.");
  const a = keAntrean(b);
  if (a.status !== "menunggu") throw new Error(`Butir ini sudah ${a.status}.`);
  if (masukan.aksi === "kerjakan" && a.kelas !== "B") throw new Error("Butir satu ketukan dikerjakan lewat tombol aslinya, bukan dari sini.");
  if (masukan.aksi === "diketuk" && a.kelas !== "C") throw new Error("Hanya butir satu ketukan yang ditandai diketuk.");
  const status = masukan.aksi === "batalkan" ? "dibatalkan" : "dikerjakan";
  await ubahStatusAntrean(db, a.id, status);
  await catatJejak(db, {
    penggunaId: aktor.id,
    penggunaNama: nama,
    peran: a.peran,
    tugas: a.tugas,
    kelas: a.kelas,
    sistem: a.sistem,
    nomorPerkara: a.nomorPerkara,
    ringkas: `${masukan.aksi === "batalkan" ? "Dibatalkan" : masukan.aksi === "diketuk" ? "Diketuk" : "Dikerjakan sekarang"}: ${a.ringkas}`,
    status: masukan.aksi === "batalkan" ? "dibatalkan" : masukan.aksi === "diketuk" ? "diketuk" : "dikerjakan",
    alamatIp: masukan.alamatIp,
  });
  return { ok: true, status };
}

/** Super Admin melihat riwayat semua petugas; yang lain hanya miliknya. */
export function bolehLihatSemua(aktor: Aktor): boolean {
  return peranAgen(aktor).includes("super-admin");
}
