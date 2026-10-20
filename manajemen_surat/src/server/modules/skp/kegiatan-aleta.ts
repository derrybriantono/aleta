import { tanggalWita } from "@/lib/eviden-skp-katalog";
import {
  KUNCI_FAKTA_ALETA_SKP_JABATAN,
  type PembacaKegiatanAleta,
} from "@/lib/skp-jabatan-katalog";
import {
  USERNAME_SISTEM,
  type FaktaAkunSkp,
  type FaktaIndikatorSkp,
  type JabatanSkp,
  type KejadianSkp,
} from "@/lib/skp-jabatan-tipe";
import { type AletaDatabase } from "@/server/db/client";

/**
 * ============================================================================
 * KEGIATAN NYATA DI e-COURT DAN APLIKASI PENGADILAN -> FAKTA SKP
 * ============================================================================
 *
 * Diminta pengguna 20 Oktober 2026: eviden SKP untuk Panitera, PP, Panmud,
 * Juru Sita, Mediator, Petugas Meja (PTSP), Kasir, Sekretaris, Kasubag,
 * Operator, dan Analis Perkara - dari kegiatan NYATA, tidak diketik ulang.
 *
 * Kegiatan yang dicatat SIPP dibaca bot (evidenSkpJabatanService). Berkas ini
 * membaca yang SIPP tidak punya: surat dan disposisi, verifikasi/TTE/unggah
 * e-Court, pemrosesan cuti, pemantauan kinerja, dan jejak kegiatan di aplikasi.
 * Semuanya milik SATU pegawai (ID pengguna) - bukan akun SIPP - dan keluar
 * sebagai FaktaAkunSkp tiruan (USERNAME_SISTEM) yang digabung ke fakta bot,
 * sehingga aturan hitung, Lembar SKP, dan bukti dukung tetap satu jalur.
 *
 * Aturan yang dijaga (sama dengan bot):
 *   - hanya SELECT;
 *   - pembaca yang gagal membuat kuncinya terbaca:false beserta frasa untuk
 *     pembaca - TIDAK PERNAH daftar kosong yang tampak seperti nol;
 *   - daftar yang melewati batas baca ditolak sebagai tidak terbaca, bukan
 *     dipotong diam-diam;
 *   - tanggal kejadian menurut WITA (tanggal pengadilan), bukan UTC peladen.
 */

export type KonteksKegiatan = {
  db: AletaDatabase;
  userId: string;
  mulai: string;
  selesai: string;
};

const BATAS_BARIS = 5000;
const BATAS_BARIS_JEJAK = 20000;

class TidakTerbaca extends Error {}

/** Tanggal ISO digeser n hari (UTC; tanggal kalender tidak mengenal zona). */
export function geserTanggal(iso: string, hari: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + hari);
  return d.toISOString().slice(0, 10);
}

/** Cap waktu (UTC) atau tanggal polos -> tanggal WITA; null bila tak terbaca. */
export function tanggalKegiatan(nilai: unknown): string | null {
  const teks = String(nilai ?? "").trim();
  if (!teks) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(teks)) return teks;
  return tanggalWita(teks);
}

function dalamPeriode(tanggal: string | null, k: KonteksKegiatan): tanggal is string {
  return tanggal !== null && tanggal >= k.mulai && tanggal <= k.selesai;
}

/** Batas bawah/atas pencarian teks cap waktu: dilebarkan sehari supaya WITA tidak terpotong. */
function jendelaCap(k: KonteksKegiatan): [string, string] {
  return [geserTanggal(k.mulai, -1), geserTanggal(k.selesai, 2)];
}

const potong = (teks: unknown, n: number) => {
  const t = String(teks ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

function kejadian(p: Partial<KejadianSkp>): KejadianSkp {
  return {
    perkaraId: null,
    nomorPerkara: null,
    tanggal: null,
    tanggalAcuan: null,
    nilai: null,
    keterangan: null,
    ...p,
  };
}

// ─── Pembaca ────────────────────────────────────────────────────────────────

type BarisSurat = {
  id: string;
  type: string;
  nomor_surat: string;
  perihal: string;
  created_by_user_id: string | null;
  approved_by_user_id: string | null;
  sent_by_user_id: string | null;
  created_at: string;
  approved_at: string | null;
  sent_at: string | null;
};

async function suratDikelola(k: KonteksKegiatan): Promise<KejadianSkp[]> {
  const [, atas] = jendelaCap(k);
  const baris = await k.db.queryAll<BarisSurat>(
    `SELECT id, type, nomor_surat, perihal, created_by_user_id, approved_by_user_id, sent_by_user_id,
            created_at, approved_at, sent_at
       FROM letters
      WHERE deleted_at IS NULL
        AND (created_by_user_id = ? OR approved_by_user_id = ? OR sent_by_user_id = ?)
        AND created_at < ?
      ORDER BY created_at DESC
      LIMIT ${BATAS_BARIS + 1}`,
    [k.userId, k.userId, k.userId, atas]
  );
  if (baris.length > BATAS_BARIS) throw new TidakTerbaca("Surat yang dikelola terlalu banyak untuk dibaca sekaligus; persempit periodenya.");
  const hasil: KejadianSkp[] = [];
  for (const b of baris) {
    // Tanggal kegiatan pegawai ini atas surat itu: pencatatan, lalu persetujuan, lalu pengiriman.
    const tanggal =
      (b.created_by_user_id === k.userId ? tanggalKegiatan(b.created_at) : null) ??
      (b.approved_by_user_id === k.userId ? tanggalKegiatan(b.approved_at) : null) ??
      (b.sent_by_user_id === k.userId ? tanggalKegiatan(b.sent_at) : null);
    if (!dalamPeriode(tanggal, k)) continue;
    hasil.push(
      kejadian({
        tanggal,
        keterangan: `${b.type === "masuk" ? "Surat masuk" : "Surat keluar"} ${potong(b.nomor_surat, 60)} - ${potong(b.perihal, 90)}`,
      })
    );
  }
  return hasil.sort((a, c) => String(a.tanggal).localeCompare(String(c.tanggal)));
}

type BarisDisposisi = {
  id: string;
  created_at: string;
  read_at: string | null;
  follow_up_note: string | null;
  nomor_surat: string;
  perihal: string;
};

async function bacaDisposisi(k: KonteksKegiatan): Promise<BarisDisposisi[]> {
  const [bawah, atas] = jendelaCap(k);
  const baris = await k.db.queryAll<BarisDisposisi>(
    `SELECT d.id, d.created_at, d.read_at, d.follow_up_note, l.nomor_surat, l.perihal
       FROM dispositions d JOIN letters l ON l.id = d.surat_id
      WHERE d.penerima_id = ? AND d.deleted_at IS NULL AND d.created_at >= ? AND d.created_at < ?
      ORDER BY d.created_at ASC
      LIMIT ${BATAS_BARIS + 1}`,
    [k.userId, bawah, atas]
  );
  if (baris.length > BATAS_BARIS) throw new TidakTerbaca("Disposisi yang diterima terlalu banyak untuk dibaca sekaligus; persempit periodenya.");
  return baris.filter((b) => dalamPeriode(tanggalKegiatan(b.created_at), k));
}

const ketDisposisi = (b: BarisDisposisi, awal: string) => `${awal} surat ${potong(b.nomor_surat, 60)} - ${potong(b.perihal, 80)}`;

async function disposisiDiterima(k: KonteksKegiatan): Promise<KejadianSkp[]> {
  return (await bacaDisposisi(k)).map((b) =>
    kejadian({ tanggal: tanggalKegiatan(b.created_at), keterangan: ketDisposisi(b, "Disposisi atas") })
  );
}

async function disposisiSelesai(k: KonteksKegiatan): Promise<KejadianSkp[]> {
  return (await bacaDisposisi(k))
    .filter((b) => String(b.follow_up_note ?? "").trim() !== "")
    .map((b) => kejadian({ tanggal: tanggalKegiatan(b.created_at), keterangan: ketDisposisi(b, "Disposisi ditindaklanjuti atas") }));
}

async function disposisiTanggapan(k: KonteksKegiatan): Promise<KejadianSkp[]> {
  // Disposisi yang belum dibuka tidak ikut: lama menanggapi belum ada, bukan nol hari.
  return (await bacaDisposisi(k))
    .filter((b) => tanggalKegiatan(b.read_at) !== null)
    .map((b) =>
      kejadian({
        tanggal: tanggalKegiatan(b.read_at),
        tanggalAcuan: tanggalKegiatan(b.created_at),
        keterangan: ketDisposisi(b, "Disposisi dibuka atas"),
      })
    );
}

type BarisAksiEcourt = {
  id: string;
  aksi: string;
  hasil: string;
  nomor_perkara: string;
  sasaran: string;
  dibuat_pada: string;
};

async function bacaAksiEcourt(k: KonteksKegiatan, aksi: readonly string[]): Promise<BarisAksiEcourt[]> {
  const [bawah, atas] = jendelaCap(k);
  const baris = await k.db.queryAll<BarisAksiEcourt>(
    `SELECT id, aksi, hasil, nomor_perkara, sasaran, dibuat_pada
       FROM aleta_ecourt_aksi_jejak
      WHERE pengguna_id = ? AND aksi IN (${aksi.map(() => "?").join(", ")}) AND dibuat_pada >= ? AND dibuat_pada < ?
      ORDER BY dibuat_pada ASC
      LIMIT ${BATAS_BARIS + 1}`,
    [k.userId, ...aksi, bawah, atas]
  );
  if (baris.length > BATAS_BARIS) throw new TidakTerbaca("Kegiatan e-Court terlalu banyak untuk dibaca sekaligus; persempit periodenya.");
  return baris.filter((b) => dalamPeriode(tanggalKegiatan(b.dibuat_pada), k));
}

const NAMA_AKSI_ECOURT: Record<string, string> = {
  verifikasi: "Verifikasi dokumen e-Court",
  tte: "Tanda tangan elektronik berkas e-Court",
  unggah_salinan: "Unggah salinan putusan/penetapan ke e-Court",
};

function dariAksi(b: BarisAksiEcourt): KejadianSkp {
  return kejadian({
    nomorPerkara: potong(b.nomor_perkara, 60) || null,
    tanggal: tanggalKegiatan(b.dibuat_pada),
    keterangan: `${NAMA_AKSI_ECOURT[b.aksi] ?? "Kegiatan e-Court"}${b.sasaran ? ` - ${potong(b.sasaran, 80)}` : ""}`,
  });
}

async function ecourtVerifikasi(k: KonteksKegiatan): Promise<KejadianSkp[]> {
  return (await bacaAksiEcourt(k, ["verifikasi"])).filter((b) => b.hasil === "berhasil").map(dariAksi);
}

async function ecourtPercobaan(k: KonteksKegiatan): Promise<KejadianSkp[]> {
  return (await bacaAksiEcourt(k, ["verifikasi"])).map(dariAksi);
}

async function ecourtBerkas(k: KonteksKegiatan): Promise<KejadianSkp[]> {
  return (await bacaAksiEcourt(k, ["tte", "unggah_salinan"])).filter((b) => b.hasil === "berhasil").map(dariAksi);
}

/** Aksi audit yang bukan kegiatan kerja: gagal, masuk/keluar, dan unduhan eviden SKP sendiri. */
const BUKAN_KEGIATAN = /FAILED|LOGIN|LOGOUT|SESSION|^SKP_|^EVIDEN_SKP_|PASSWORD/i;

/** "BAS_LEMBAR_SIMPAN" -> "Bas lembar simpan". */
export function namaKegiatan(aksi: string): string {
  const kata = String(aksi ?? "").replace(/[_\-.:]+/g, " ").trim().toLowerCase();
  return kata ? `${kata[0].toUpperCase()}${kata.slice(1)}` : "Kegiatan lain";
}

async function aplikasiKegiatan(k: KonteksKegiatan): Promise<KejadianSkp[]> {
  const [bawah, atas] = jendelaCap(k);
  const audit = await k.db.queryAll<{ action: string; created_at: string }>(
    `SELECT action, created_at FROM audit_logs
      WHERE actor_user_id = ? AND created_at >= ? AND created_at < ?
      ORDER BY created_at ASC
      LIMIT ${BATAS_BARIS_JEJAK + 1}`,
    [k.userId, bawah, atas]
  );
  if (audit.length > BATAS_BARIS_JEJAK) throw new TidakTerbaca("Kegiatan di aplikasi terlalu banyak untuk dibaca sekaligus; persempit periodenya.");
  const ecourt = await k.db.queryAll<{ aksi: string; dibuat_pada: string }>(
    `SELECT aksi, dibuat_pada FROM aleta_ecourt_aksi_jejak
      WHERE pengguna_id = ? AND hasil = 'berhasil' AND aksi IN ('verifikasi', 'tte', 'unggah_salinan', 'unduh', 'periksa')
        AND dibuat_pada >= ? AND dibuat_pada < ?
      LIMIT ${BATAS_BARIS + 1}`,
    [k.userId, bawah, atas]
  );
  if (ecourt.length > BATAS_BARIS) throw new TidakTerbaca("Kegiatan e-Court terlalu banyak untuk dibaca sekaligus; persempit periodenya.");

  const kelompok = new Map<string, { tanggal: string; nama: string; jumlah: number }>();
  const tambah = (tanggal: string | null, nama: string) => {
    if (!dalamPeriode(tanggal, k)) return;
    const kunci = `${tanggal}|${nama}`;
    const ada = kelompok.get(kunci);
    if (ada) ada.jumlah += 1;
    else kelompok.set(kunci, { tanggal, nama, jumlah: 1 });
  };
  for (const a of audit) {
    if (BUKAN_KEGIATAN.test(a.action)) continue;
    tambah(tanggalKegiatan(a.created_at), namaKegiatan(a.action));
  }
  for (const e of ecourt) tambah(tanggalKegiatan(e.dibuat_pada), `${NAMA_AKSI_ECOURT[e.aksi] ?? `e-Court: ${e.aksi}`}`);

  return [...kelompok.values()]
    .sort((a, c) => a.tanggal.localeCompare(c.tanggal) || a.nama.localeCompare(c.nama))
    .map((g) => kejadian({ tanggal: g.tanggal, nilai: g.jumlah, keterangan: `${g.nama} (${g.jumlah} kali)` }));
}

async function cutiDiproses(k: KonteksKegiatan): Promise<KejadianSkp[]> {
  const [bawah, atas] = jendelaCap(k);
  const baris = await k.db.queryAll<{ acted_at: string; request_number: string | null; submitted_at: string | null; created_at: string }>(
    `SELECT g.acted_at, r.request_number, r.submitted_at, r.created_at
       FROM hr_leave_approval_logs g JOIN hr_leave_requests r ON r.id = g.leave_request_id
      WHERE g.approver_user_id = ? AND g.acted_at >= ? AND g.acted_at < ?
      ORDER BY g.acted_at ASC
      LIMIT ${BATAS_BARIS + 1}`,
    [k.userId, bawah, atas]
  );
  if (baris.length > BATAS_BARIS) throw new TidakTerbaca("Permohonan cuti yang diproses terlalu banyak untuk dibaca sekaligus; persempit periodenya.");
  return baris
    .filter((b) => dalamPeriode(tanggalKegiatan(b.acted_at), k))
    .map((b) =>
      kejadian({
        tanggal: tanggalKegiatan(b.acted_at),
        tanggalAcuan: tanggalKegiatan(b.submitted_at) ?? tanggalKegiatan(b.created_at),
        keterangan: `Permohonan cuti${b.request_number ? ` ${potong(b.request_number, 40)}` : ""} diproses`,
      })
    );
}

async function analisisDijalankan(k: KonteksKegiatan): Promise<KejadianSkp[]> {
  const [bawah, atas] = jendelaCap(k);
  const pemantauan = await k.db.queryAll<{ run_name: string; created_at: string }>(
    `SELECT run_name, created_at FROM aleta_sipp_monitoring_runs
      WHERE created_by = ? AND created_at >= ? AND created_at < ?
      LIMIT ${BATAS_BARIS}`,
    [k.userId, bawah, atas]
  );
  const penilaian = await k.db.queryAll<{ created_at: string }>(
    `SELECT created_at FROM aleta_sipp_assessment_runs
      WHERE executed_by = ? AND created_at >= ? AND created_at < ?
      LIMIT ${BATAS_BARIS}`,
    [k.userId, bawah, atas]
  );
  const semua = [
    ...pemantauan.map((p) => ({ cap: p.created_at, ket: `Pemantauan indikator kinerja perkara - ${potong(p.run_name, 80)}` })),
    ...penilaian.map((p) => ({ cap: p.created_at, ket: "Penilaian kinerja perkara" })),
  ];
  return semua
    .map((x) => kejadian({ tanggal: tanggalKegiatan(x.cap), keterangan: x.ket }))
    .filter((x) => dalamPeriode(x.tanggal, k))
    .sort((a, c) => String(a.tanggal).localeCompare(String(c.tanggal)));
}

/** Pembaca tiap id katalog. Penjaga uji: setiap id PEMBACA_KEGIATAN_ALETA punya pembaca di sini. */
export const PEMBACA_KEGIATAN: Readonly<Record<PembacaKegiatanAleta, (k: KonteksKegiatan) => Promise<KejadianSkp[]>>> = {
  "surat-dikelola": suratDikelola,
  "disposisi-diterima": disposisiDiterima,
  "disposisi-selesai": disposisiSelesai,
  "disposisi-tanggapan": disposisiTanggapan,
  "ecourt-verifikasi": ecourtVerifikasi,
  "ecourt-percobaan": ecourtPercobaan,
  "ecourt-berkas": ecourtBerkas,
  "aplikasi-kegiatan": aplikasiKegiatan,
  "cuti-diproses": cutiDiproses,
  "analisis-dijalankan": analisisDijalankan,
};

// ─── Titik masuk ────────────────────────────────────────────────────────────

/** Kunci fakta -> pembaca yang diperlukan sebuah daftar jabatan (gabungan, tanpa pengulangan). */
export function kunciKegiatanDiperlukan(jabatan: readonly JabatanSkp[]): Record<string, PembacaKegiatanAleta> {
  const hasil: Record<string, PembacaKegiatanAleta> = {};
  for (const j of jabatan) Object.assign(hasil, KUNCI_FAKTA_ALETA_SKP_JABATAN[j] ?? {});
  return hasil;
}

/**
 * Fakta dari catatan sistem untuk satu pegawai. null bila jabatan-jabatan itu
 * tidak memakai catatan sistem. Setiap pembaca dijalankan sekali walau dipakai
 * beberapa kunci.
 */
export async function bacaFaktaSistem(
  db: AletaDatabase,
  p: { userId: string; jabatan: readonly JabatanSkp[]; mulai: string; selesai: string }
): Promise<FaktaAkunSkp | null> {
  const diperlukan = kunciKegiatanDiperlukan(p.jabatan);
  const kunci = Object.keys(diperlukan);
  if (kunci.length === 0) return null;

  const konteks: KonteksKegiatan = { db, userId: p.userId, mulai: p.mulai, selesai: p.selesai };
  const hasilPembaca = new Map<PembacaKegiatanAleta, Promise<{ ok: true; daftar: KejadianSkp[] } | { ok: false; frasa: string }>>();
  const jalankan = (id: PembacaKegiatanAleta) => {
    if (!hasilPembaca.has(id)) {
      hasilPembaca.set(
        id,
        PEMBACA_KEGIATAN[id](konteks).then(
          (daftar) => ({ ok: true as const, daftar }),
          (galat: unknown) => {
            if (!(galat instanceof TidakTerbaca)) console.warn(`[skp] pembaca ${id} gagal: ${String((galat as Error)?.message ?? galat).slice(0, 300)}`);
            return {
              ok: false as const,
              frasa: galat instanceof TidakTerbaca ? galat.message : "Catatan kegiatan di sistem tidak dapat dibaca saat ini.",
            };
          }
        )
      );
    }
    return hasilPembaca.get(id)!;
  };

  const fakta: FaktaIndikatorSkp[] = [];
  for (const k of kunci) {
    const hasil = await jalankan(diperlukan[k]);
    fakta.push(
      hasil.ok
        ? { kunci: k, terbaca: true, kejadian: hasil.daftar, galat: null }
        : { kunci: k, terbaca: false, kejadian: [], galat: hasil.frasa }
    );
  }
  return {
    username: USERNAME_SISTEM,
    userIdSipp: "",
    nama: "Catatan sistem",
    grup: [],
    jabatanDugaan: null,
    aktif: true,
    fakta,
  };
}
