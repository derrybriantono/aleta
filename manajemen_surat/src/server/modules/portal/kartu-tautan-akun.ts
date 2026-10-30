/**
 * ============================================================================
 * KARTU TAUTAN AKUN PEGAWAI - SISI SERVER (G4, 30 Okt 2026)
 * ============================================================================
 *
 * Layar Pusat Kendali "Tautan Akun Pegawai" (Super Admin & Admin, aksi
 * "tautan-akun.atur"). Aturan murni di lib/kartu-tautan-akun.ts.
 *
 *   BACA      pratinjau tautan SIPP (lib/tautan-akun-sipp.ts, bahan sama dengan
 *             "Tautkan semua ke SIPP") + akun e-Court pribadi per pegawai (bot,
 *             TANPA sandi) + kelompok blangko ABT. Pasangan SIPP yang PASTI
 *             (username/NIP/nama sama persis, calon tunggal, tidak diklaim akun
 *             lain, tidak pernah dicabut) LANGSUNG DITAUTKAN lewat
 *             terapkanTautanSemua - satu transaksi, jejak audit per akun,
 *             dapat dibatalkan seperti tautan massal lain. Arahan pengguna 30 Okt
 *             malam: yang pasti otomatis, hanya yang ragu dipilih admin.
 *   TAUTKAN   satu pilihan admin untuk baris ragu/ganda (penyaring yang sama).
 *   ISI e-COURT  Super Admin/Admin mengisi akun + sandi e-Court pribadi seorang
 *             pegawai tanpa pegawai itu masuk sendiri (permintaan pengguna 30
 *             Okt 15.37). Sandi diteruskan SEKALI ke bot (disandi AES-256-GCM di
 *             sana) lalu dibuang; tidak pernah kembali ke layar admin maupun
 *             pemilik. Admin tidak dapat mengisi untuk akun Super Admin.
 *             Audit: "diisi oleh <admin> untuk <pegawai>" - tanpa surel, tanpa sandi.
 *
 * Sandi SIPP TIDAK disimpan di mana pun - kartu ini tidak punya kotak sandi SIPP.
 */

import {
  pilihanOtomatisPasti,
  ringkasKartu,
  susunKartuTautan,
  type AkunEcourtKartu,
  type AkunSippKartu,
  type GrupBlangkoAbt,
  type PegawaiKartu,
  type SesiEcourtKartu,
} from "@/lib/kartu-tautan-akun";
import type { PratinjauTautan } from "@/lib/tautan-akun-sipp";
import type { AletaDatabase } from "@/server/db/client";
import { peranEcourtDiharapkan } from "@/server/modules/aleta-ecourt/ecourt-akun-pengguna";
import {
  pratinjauTautanSemua,
  terapkanTautanSemua,
  type DepsTautanSemua,
  type JawabanDaftarSipp,
} from "@/server/modules/portal/tautan-semua-sipp";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

export const PERAN_ECOURT_KARTU = ["hakim", "panitera", "panitera-pengganti", "juru-sita", "lainnya"] as const;

export type AktorKartu = { id: string; roleId: string; name: string };

export type JawabanBot<T> = { ok: true; data: T } | { ok: false; alasan: string };

export type DepsKartuTautan = DepsTautanSemua & {
  /** bot /ecourt-pengguna/rekap - akun tanpa sandi + keadaan sesi. */
  rekapEcourt: () => Promise<JawabanBot<{ akun?: AkunEcourtKartu[]; sesi?: SesiEcourtKartu[] }>>;
  /** bot /abt-pengaturan/grup-blangko. */
  grupAbt: () => Promise<JawabanBot<{ grup?: GrupBlangkoAbt[] }>>;
  /** bot /ecourt-pengguna/akun/simpan - BADAN MEMUAT SANDI. */
  simpanEcourt: (badan: {
    penggunaId: string;
    peran: string;
    namaPengguna: string;
    email: string;
    sandi: string;
    olehSiapa: string;
    diisiOleh: string;
  }) => Promise<JawabanBot<{ ok?: boolean; alasan?: string }>>;
  hapusEcourt: (badan: { penggunaId: string; peran: string; olehSiapa: string }) => Promise<JawabanBot<{ ok?: boolean; alasan?: string }>>;
  /** Pengguna ALETA (organization/service getUsersFromDb). */
  pengguna: (db: AletaDatabase) => Promise<PegawaiKartu[]>;
};

function wajibAdmin(aktor: AktorKartu) {
  if (aktor.roleId !== "super-admin" && aktor.roleId !== "admin") {
    throw new ApiError(403, "Hanya Super Admin dan Admin yang dapat mengatur tautan akun pegawai.");
  }
}

/** daftarSipp dipanggil SEKALI per permintaan walau pratinjau disusun dua kali (sebelum dan sesudah penautan otomatis). */
function sekaliSipp(deps: DepsKartuTautan): DepsKartuTautan & { sippTerbaca: () => AkunSippKartu[] | undefined } {
  let janji: Promise<JawabanDaftarSipp> | null = null;
  let terbaca: AkunSippKartu[] | undefined;
  return {
    ...deps,
    daftarSipp: () => {
      if (!janji) {
        janji = deps.daftarSipp().then((j) => {
          if (j.ok) {
            terbaca = (j.data?.pengguna ?? []).map((s) => ({
              username: String(s.username ?? "").trim(),
              namaLengkap: String(s.namaLengkap ?? ""),
              diblokir: s.diblokir === true,
              kedaluwarsa: s.kedaluwarsa === true,
            }));
          }
          return j;
        });
      }
      return janji;
    },
    sippTerbaca: () => terbaca,
  };
}

export type HasilKartu = {
  baris: ReturnType<typeof susunKartuTautan>;
  ringkas: ReturnType<typeof ringkasKartu>;
  otomatis: { ditautkan: Array<{ userId: string; usernameSipp: string }>; gagal: string };
  ecourtTersedia: boolean;
  ecourtPesan: string;
  abtTersedia: boolean;
  bolehIsiSuperAdmin: boolean;
};

/**
 * Kartu lengkap. MENULIS hanya tautan SIPP yang pasti (lihat kepala berkas) -
 * selebihnya membaca.
 */
export async function bacaKartuTautan(db: AletaDatabase, aktor: AktorKartu, depsMentah: DepsKartuTautan): Promise<HasilKartu> {
  wajibAdmin(aktor);
  const deps = sekaliSipp(depsMentah);
  let pratinjau: PratinjauTautan = await pratinjauTautanSemua(db, deps);
  const otomatis: HasilKartu["otomatis"] = { ditautkan: [], gagal: "" };
  const pasti = pilihanOtomatisPasti(pratinjau, deps.sippTerbaca());
  if (pasti.length) {
    try {
      const h = await terapkanTautanSemua(db, deps, { id: aktor.id, roleId: aktor.roleId }, { tautkan: pasti });
      otomatis.ditautkan = h.ditautkan;
      if (h.ditautkan.length) pratinjau = await pratinjauTautanSemua(db, deps);
    } catch (galat) {
      // Keadaan berubah di sela (akun lain menautkan username yang sama): tidak ada yang tertulis; kartu tetap tampil.
      otomatis.gagal = galat instanceof Error ? galat.message.slice(0, 200) : "Penautan otomatis gagal.";
    }
  }
  const [rekap, grup, pegawai] = await Promise.all([
    deps.rekapEcourt().catch(() => ({ ok: false as const, alasan: "bot_tidak_terhubung" })),
    deps.grupAbt().catch(() => ({ ok: false as const, alasan: "bot_tidak_terhubung" })),
    deps.pengguna(db),
  ]);
  const baris = susunKartuTautan({
    pegawai,
    pratinjau,
    akunEcourt: rekap.ok ? (rekap.data.akun ?? []) : [],
    sesiEcourt: rekap.ok ? (rekap.data.sesi ?? []) : [],
    grupAbt: grup.ok ? (grup.data.grup ?? []) : [],
    sipp: deps.sippTerbaca(),
    otomatisBaru: otomatis.ditautkan.map((x) => x.userId),
    peranDiharapkan: (p) => peranEcourtDiharapkan(p),
  });
  return {
    baris,
    ringkas: ringkasKartu(baris),
    otomatis,
    ecourtTersedia: rekap.ok,
    ecourtPesan: rekap.ok ? "" : "Akun e-Court belum terbaca - ALETA Bot belum dapat dihubungi.",
    abtTersedia: grup.ok,
    bolehIsiSuperAdmin: aktor.roleId === "super-admin",
  };
}

/** Satu pilihan admin untuk baris ragu/ganda - penyaring dan transaksi yang sama dengan "Tautkan semua ke SIPP". */
export async function tautkanSippPilihan(
  db: AletaDatabase,
  aktor: AktorKartu,
  pilihan: { userId: string; usernameSipp: string },
  deps: DepsKartuTautan
) {
  wajibAdmin(aktor);
  const userId = String(pilihan.userId ?? "").trim().slice(0, 80);
  const usernameSipp = String(pilihan.usernameSipp ?? "").trim().slice(0, 60);
  if (!userId || !usernameSipp) throw new ApiError(400, "Pilih pegawai dan akun SIPP-nya.");
  const h = await terapkanTautanSemua(db, deps, { id: aktor.id, roleId: aktor.roleId }, { tautkan: [{ userId, usernameSipp }] });
  if (!h.ditautkan.length) {
    const sebab = h.ditolak.find((x) => "userId" in x && x.userId === userId)?.sebab ?? h.ditolak[0]?.sebab ?? "Pilihan tidak dapat ditautkan.";
    return { ok: false as const, pesan: sebab };
  }
  return { ok: true as const, pesan: `Akun SIPP ${usernameSipp} ditautkan.` };
}

async function pegawaiSasaran(deps: DepsKartuTautan, db: AletaDatabase, aktor: AktorKartu, penggunaId: string) {
  const id = String(penggunaId ?? "").trim();
  const p = (await deps.pengguna(db)).find((x) => x.id === id);
  if (!p || p.isActive === false) throw new ApiError(404, "Pegawai itu tidak ditemukan atau tidak aktif.");
  if (p.roleId === "super-admin" && aktor.roleId !== "super-admin") {
    throw new ApiError(403, "Akun e-Court Super Admin hanya dapat diisi Super Admin.");
  }
  return p;
}

function peranSah(peran: unknown): string {
  const p = String(peran ?? "").trim().toLowerCase();
  if (!(PERAN_ECOURT_KARTU as readonly string[]).includes(p)) throw new ApiError(400, "Peran e-Court tidak dikenali.");
  return p;
}

export type HasilIsiEcourt = { ok: boolean; alasan: string; pesan: string };

const KALIMAT_ISI: Record<string, string> = {
  email_kosong: "Surel akun e-Court wajib diisi.",
  sandi_kosong: "Sandi e-Court wajib diisi untuk akun yang belum punya sandi tersimpan.",
  surel_berganti_sandi_wajib: "Surel berganti - sandi akun yang baru wajib diketik ulang.",
  email_terlalu_panjang: "Surel terlalu panjang.",
  sandi_terlalu_panjang: "Sandi terlalu panjang.",
  kunci_tidak_tersedia: "Sandi tidak dapat disimpan: kunci penyandian di server belum siap. Tidak ada yang tersimpan.",
  bot_tidak_terhubung: "ALETA Bot belum dapat dihubungi. Tidak ada yang tersimpan.",
};

function kalimatIsi(alasan: string) {
  const awal = alasan.split(":")[0];
  return KALIMAT_ISI[alasan] ?? KALIMAT_ISI[awal] ?? "Akun e-Court belum tersimpan.";
}

/**
 * Super Admin/Admin mengisi akun e-Court pribadi seorang pegawai.
 * BADAN MEMUAT SANDI: tidak dicatat, tidak dikembalikan, disapu dari alasan bot.
 */
export async function isiEcourtPegawai(
  db: AletaDatabase,
  aktor: AktorKartu,
  masukan: { penggunaId: unknown; peran: unknown; email: unknown; sandi: unknown; alamatIp?: string },
  deps: DepsKartuTautan
): Promise<HasilIsiEcourt> {
  wajibAdmin(aktor);
  const sasaran = await pegawaiSasaran(deps, db, aktor, String(masukan.penggunaId ?? ""));
  const peran = peranSah(masukan.peran);
  const email = String(masukan.email ?? "").trim().slice(0, 200);
  let sandi = String(masukan.sandi ?? "");
  const sapu = (t: unknown) => (sandi ? String(t ?? "").split(sandi).join("***") : String(t ?? ""));
  try {
    const h = await deps.simpanEcourt({
      penggunaId: sasaran.id,
      peran,
      namaPengguna: sasaran.name,
      email,
      sandi,
      olehSiapa: `admin:${aktor.id}`,
      diisiOleh: aktor.name || aktor.id,
    });
    const berhasil = h.ok && h.data.ok !== false;
    const alasan = sapu(h.ok ? String(h.data.alasan ?? "") : h.alasan);
    if (berhasil) {
      // Yang dicatat perbuatannya: siapa mengisi untuk siapa. Tanpa surel, tanpa sandi.
      await appendAuditLog(db, {
        id: await nextPrefixedId(db, "audit_logs", "adt"),
        actorUserId: aktor.id,
        action: "ECOURT_AKUN_PRIBADI_DIISI_ADMIN",
        entityType: "ecourt_akun_pribadi",
        entityId: `${sasaran.id}:${peran}`,
        payload: {
          ringkas: `diisi oleh ${aktor.name || aktor.id} untuk ${sasaran.name}`,
          untukPenggunaId: sasaran.id,
          untukNama: sasaran.name,
          olehNama: aktor.name,
          peran,
          sandiDiganti: Boolean(sandi),
          alamatIp: masukan.alamatIp ?? "",
        },
      }).catch(() => undefined);
    }
    return { ok: berhasil, alasan, pesan: berhasil ? `Akun e-Court ${sasaran.name} tersimpan.` : kalimatIsi(alasan) };
  } finally {
    sandi = "";
    masukan.sandi = "";
  }
}

export async function hapusEcourtPegawai(
  db: AletaDatabase,
  aktor: AktorKartu,
  masukan: { penggunaId: unknown; peran: unknown; alamatIp?: string },
  deps: DepsKartuTautan
): Promise<HasilIsiEcourt> {
  wajibAdmin(aktor);
  const sasaran = await pegawaiSasaran(deps, db, aktor, String(masukan.penggunaId ?? ""));
  const peran = peranSah(masukan.peran);
  const h = await deps.hapusEcourt({ penggunaId: sasaran.id, peran, olehSiapa: `admin:${aktor.id}` });
  const berhasil = h.ok && h.data.ok !== false;
  if (berhasil) {
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: aktor.id,
      action: "ECOURT_AKUN_PRIBADI_DIHAPUS_ADMIN",
      entityType: "ecourt_akun_pribadi",
      entityId: `${sasaran.id}:${peran}`,
      payload: { ringkas: `dihapus oleh ${aktor.name || aktor.id} untuk ${sasaran.name}`, untukPenggunaId: sasaran.id, peran, alamatIp: masukan.alamatIp ?? "" },
    }).catch(() => undefined);
  }
  return { ok: berhasil, alasan: h.ok ? String(h.data.alasan ?? "") : h.alasan, pesan: berhasil ? "Akun e-Court dihapus dari ALETA." : "Akun e-Court belum terhapus." };
}
