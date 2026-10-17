import type { DataEvidenSkp } from "@/lib/eviden-skp-tipe";
import type { HasilSkpJabatan } from "@/lib/skp-jabatan-hitung";
import type {
  AktorSkp,
  JenisSkp,
  KunciPeriodeSkpJabatan,
  PenetapanSkp,
  StatusPenetapanSkp,
} from "@/lib/skp-jabatan-tipe";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { bolehTinjauSkp, type PegawaiHakSkp } from "@/server/modules/skp/hak";
import { bacaJsonAman, sekarangIso, teksAtauNull } from "@/server/modules/skp/umum";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * ============================================================================
 * PENETAPAN SKP - TANGKAPAN REALISASI YANG DIKUNCI (aleta_skp_penetapan)
 * ============================================================================
 *
 * Realisasi dihitung langsung dari SIPP, jadi angkanya bergeser bila SIPP
 * diperbaiki sesudahnya. Penetapan membekukan hasil hitung satu pegawai untuk
 * satu jenis SKP dan periode: yang tersimpan di tangkapan_json adalah
 * SELURUH hasil hitung (Lembar SKP beserta daftar kejadian tiap indikator,
 * dan untuk SKP Pimpinan juga data eviden hakim) sehingga Lembar dan bukti
 * dukungnya dapat dicetak ulang persis sama walau SIPP berubah atau bot mati.
 *
 * Draf boleh dihitung ulang; yang TERKUNCI tidak pernah berubah lagi (tidak
 * ada jalan membukanya dari antarmuka - salah tetap harus tercatat).
 * PenetapanSkp.tangkapan (kontrak) = LembarSkp-nya.
 */

export type IsiTangkapanSkp = {
  versi: 1;
  hasil: HasilSkpJabatan;
  /** Hanya SKP Pimpinan: data eviden hakim yang ikut dicetak. */
  dataHakim: DataEvidenSkp | null;
};

type BarisPenetapan = {
  id: string;
  user_id: string;
  jenis: string;
  periode: string;
  tahun: number;
  tangkapan_json: string;
  dihitung_pada: string;
  pejabat_penilai_id: string;
  pejabat_penilai_nama: string;
  status: string;
  dikunci_oleh_id: string;
  dikunci_pada: string;
  dibuat_pada: string;
};

const KOLOM = `id, user_id, jenis, periode, tahun, tangkapan_json, dihitung_pada, pejabat_penilai_id, pejabat_penilai_nama,
  status, dikunci_oleh_id, dikunci_pada, dibuat_pada`;

export type PenetapanTersimpan = { penetapan: PenetapanSkp; isi: IsiTangkapanSkp };

function petakan(b: BarisPenetapan): PenetapanTersimpan | null {
  const isi = bacaJsonAman<IsiTangkapanSkp | null>(b.tangkapan_json, null);
  if (!isi || !isi.hasil?.lembar) return null;
  const status: StatusPenetapanSkp = b.status === "terkunci" ? "terkunci" : "draf";
  return {
    isi,
    penetapan: {
      id: b.id,
      userId: b.user_id,
      jenis: b.jenis as JenisSkp,
      periode: b.periode as KunciPeriodeSkpJabatan,
      tahun: Number(b.tahun),
      tangkapan: isi.hasil.lembar,
      dihitungPada: b.dihitung_pada,
      pejabatPenilaiId: b.pejabat_penilai_id,
      pejabatPenilaiNama: b.pejabat_penilai_nama,
      status,
      dikunciOlehId: teksAtauNull(b.dikunci_oleh_id),
      dikunciPada: teksAtauNull(b.dikunci_pada),
      dibuatPada: b.dibuat_pada,
    },
  };
}

export async function bacaPenetapan(
  db: AletaDatabase,
  p: { userId: string; jenis: JenisSkp; periode: KunciPeriodeSkpJabatan; tahun: number }
): Promise<PenetapanTersimpan | null> {
  const baris = await db.queryOne<BarisPenetapan>(
    `SELECT ${KOLOM} FROM aleta_skp_penetapan WHERE user_id = ? AND jenis = ? AND periode = ? AND tahun = ?`,
    [p.userId, p.jenis, p.periode, p.tahun]
  );
  return baris ? petakan(baris) : null;
}

/**
 * Menyimpan hasil hitung sebagai draf, atau mengunci. Hanya yang berhak
 * meninjau (atasan langsung, Ketua, Panitera, Super Admin, Admin), bukan
 * pegawainya sendiri. Yang sudah terkunci ditolak 409.
 */
export async function simpanPenetapan(
  db: AletaDatabase,
  aktor: AktorSkp,
  pegawai: PegawaiHakSkp,
  p: {
    jenis: JenisSkp;
    periode: KunciPeriodeSkpJabatan;
    tahun: number;
    hasil: HasilSkpJabatan;
    dataHakim: DataEvidenSkp | null;
    penilai: { id: string; nama: string };
    kunci: boolean;
  }
): Promise<PenetapanSkp> {
  if (!bolehTinjauSkp(aktor, pegawai)) {
    throw new ApiError(403, "Hanya atasan langsung, Ketua, Panitera, atau administrator yang dapat menetapkan SKP pegawai ini.");
  }
  const sekarang = sekarangIso();
  const isi: IsiTangkapanSkp = { versi: 1, hasil: p.hasil, dataHakim: p.dataHakim };
  return withTransaction(db, async (tx) => {
    const ada = await tx.queryOne<BarisPenetapan>(
      `SELECT ${KOLOM} FROM aleta_skp_penetapan WHERE user_id = ? AND jenis = ? AND periode = ? AND tahun = ?`,
      [pegawai.userId, p.jenis, p.periode, p.tahun]
    );
    if (ada?.status === "terkunci") {
      throw new ApiError(409, "SKP periode ini sudah ditetapkan dan terkunci; angkanya tidak dapat diubah lagi.");
    }
    const status: StatusPenetapanSkp = p.kunci ? "terkunci" : "draf";
    const kunciOleh = p.kunci ? aktor.userId : "";
    const kunciPada = p.kunci ? sekarang : "";
    let id = ada?.id ?? "";
    if (ada) {
      await tx.run(
        `UPDATE aleta_skp_penetapan
            SET tangkapan_json = ?, dihitung_pada = ?, pejabat_penilai_id = ?, pejabat_penilai_nama = ?, status = ?,
                dikunci_oleh_id = ?, dikunci_pada = ?
          WHERE id = ? AND status <> 'terkunci'`,
        [JSON.stringify(isi), p.hasil.lembar.dihitungPada, p.penilai.id, p.penilai.nama, status, kunciOleh, kunciPada, id]
      );
    } else {
      id = await nextPrefixedId(tx, "aleta_skp_penetapan", "skptap");
      await tx.run(
        `INSERT INTO aleta_skp_penetapan
           (id, user_id, jenis, periode, tahun, tangkapan_json, dihitung_pada, pejabat_penilai_id, pejabat_penilai_nama,
            status, dikunci_oleh_id, dikunci_pada, dibuat_pada)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, pegawai.userId, p.jenis, p.periode, p.tahun, JSON.stringify(isi), p.hasil.lembar.dihitungPada, p.penilai.id, p.penilai.nama, status, kunciOleh, kunciPada, sekarang]
      );
    }
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: aktor.userId,
      action: p.kunci ? "SKP_PENETAPAN_KUNCI" : "SKP_PENETAPAN_SIMPAN",
      entityType: "skp_penetapan",
      entityId: id,
      payload: { pemilik: pegawai.userId, jenis: p.jenis, periode: p.periode, tahun: p.tahun, dihitungPada: p.hasil.lembar.dihitungPada },
    });
    const baru = await tx.queryOne<BarisPenetapan>(`SELECT ${KOLOM} FROM aleta_skp_penetapan WHERE id = ?`, [id]);
    return petakan(baru!)!.penetapan;
  });
}
