import { jenisDokumenAkun, type JenisDokumenDerry, type PeranTiruan } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { type JenisBlangkoBerkas, berkasBlangko, type KodeKertas } from "@/lib/berkas-perkara";
import { golonganPengguna } from "@/lib/matriks-peran";
import { isPrivilegedAdmin } from "@/lib/permissions";
import { bacaHakBlangko } from "@/server/modules/pengaturan-abt/service";
import { ApiError } from "@/server/shared/errors";

const PERAN_TIRUAN = new Set(["hakim", "pp", "js"]);

/**
 * Jenis dokumen Derry yang boleh dibuka sesi ini (cermin jenisBolehSesi di rute blangko-derry): putusan = hakim, BAS = PP/panitera/panmud,
 * relaas = juru sita, PTSP = PTSP; Super Admin/Admin semuanya. Sampul memakai folder PTSP, daftar isi folder BAS (Panitera Sidang).
 */
export async function jenisBolehSesi(actor: unknown, sebagaiMinta = ""): Promise<JenisDokumenDerry[]> {
  const admin = isPrivilegedAdmin(actor as Parameters<typeof isPrivilegedAdmin>[0]);
  const sebagaiPeran = admin && PERAN_TIRUAN.has(sebagaiMinta) ? (sebagaiMinta as PeranTiruan) : null;
  const golongan = golonganPengguna(actor as Parameters<typeof golonganPengguna>[0]);
  const dasar = { admin, golongan, sebagaiPeran };
  if (admin && !sebagaiPeran) return jenisDokumenAkun(dasar);
  let saklar: { hakimBas?: boolean; ppPutusan?: boolean } = {};
  if (jenisDokumenAkun(dasar).some((j) => j === "put" || j === "bas")) {
    try {
      const hak = await bacaHakBlangko();
      if (hak && hak.saklar) saklar = hak.saklar;
    } catch {
      /* hak menu tak terbaca: saklar dianggap mati */
    }
  }
  return jenisDokumenAkun({ ...dasar, saklar });
}

/** Melempar 403 bila akun tidak boleh membuka blangko berkas ini (sampul = PTSP; daftar isi = BAS). */
export async function pastikanBolehBerkas(actor: unknown, jenis: JenisBlangkoBerkas, kertas: KodeKertas, sebagaiMinta = "") {
  const b = berkasBlangko(jenis, kertas);
  const boleh = await jenisBolehSesi(actor, sebagaiMinta);
  if (!boleh.includes(b.jenisFolder)) throw new ApiError(403, "Blangko ini bukan untuk peran akun Anda.");
  return b;
}
