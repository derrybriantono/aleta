import {
  GRUP_SIPP_JABATAN,
  LABEL_JABATAN_SKP,
  type AktorSkp,
  type JabatanSkp,
  type PemetaanAkunPegawaiSkp,
} from "@/lib/skp-jabatan-tipe";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { bolehUbahTargetSkp } from "@/server/modules/skp/hak";
import {
  bacaJabatanTambahan,
  jabatanSkpSah,
  rentangBertumpang,
  sekarangIso,
  teksAtauNull,
  tanggalIsiSah,
} from "@/server/modules/skp/umum";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * ============================================================================
 * PEMETAAN AKUN SIPP -> PEGAWAI -> JABATAN (aleta_skp_akun_pegawai)
 * ============================================================================
 *
 * Satu akun SIPP dapat dipegang bergantian oleh beberapa pegawai (Kasir,
 * Meja), jadi tautannya BERTANGGAL. Rangkap jabatan: jabatan_utama + larik
 * jabatan_tambahan_json (mis. Panitera yang juga PP -> blok "tugas PP").
 *
 * Bila seorang pegawai belum punya baris pemetaan SAMA SEKALI, tautan akun
 * SIPP-nya di external_app_credentials dipakai sebagai tautan tersirat -
 * tetapi HANYA bila nama akun itu tidak dipakai pegawai lain (akun bersama
 * yang belum dipetakan akan menghitung kerja orang lain dua kali). Pegawai
 * tanpa akun aktif pada periode itu: indikator dari SIPP "—", isian manual.
 */

type BarisPemetaan = {
  id: string;
  username_sipp: string;
  user_id_sipp: string;
  user_id: string;
  jabatan_utama: string;
  jabatan_tambahan_json: string;
  berlaku_dari: string;
  berlaku_sampai: string;
  dikonfirmasi_oleh_id: string;
  dikonfirmasi_pada: string;
};

export function petakanBarisPemetaan(b: BarisPemetaan): PemetaanAkunPegawaiSkp {
  return {
    id: b.id,
    usernameSipp: b.username_sipp,
    userIdSipp: b.user_id_sipp,
    userId: b.user_id,
    jabatanUtama: jabatanSkpSah(b.jabatan_utama) ? b.jabatan_utama : null,
    jabatanTambahan: bacaJabatanTambahan(b.jabatan_tambahan_json),
    berlakuDari: b.berlaku_dari,
    berlakuSampai: teksAtauNull(b.berlaku_sampai),
    dikonfirmasiOlehId: teksAtauNull(b.dikonfirmasi_oleh_id),
    dikonfirmasiPada: teksAtauNull(b.dikonfirmasi_pada),
  };
}

export async function bacaPemetaan(
  db: AletaDatabase,
  saring: { userId?: string; usernameSipp?: string } = {}
): Promise<PemetaanAkunPegawaiSkp[]> {
  const where: string[] = [];
  const param: string[] = [];
  if (saring.userId) {
    where.push("user_id = ?");
    param.push(saring.userId);
  }
  if (saring.usernameSipp) {
    where.push("LOWER(username_sipp) = ?");
    param.push(saring.usernameSipp.toLowerCase());
  }
  const baris = await db.queryAll<BarisPemetaan>(
    `SELECT id, username_sipp, user_id_sipp, user_id, jabatan_utama, jabatan_tambahan_json, berlaku_dari,
            berlaku_sampai, dikonfirmasi_oleh_id, dikonfirmasi_pada
       FROM aleta_skp_akun_pegawai
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY berlaku_dari DESC, username_sipp ASC`,
    param
  );
  return baris.map(petakanBarisPemetaan);
}

/** Pemetaan yang berlaku di sebagian rentang [mulai, selesai]. */
export function pemetaanDalamRentang(
  semua: readonly PemetaanAkunPegawaiSkp[],
  mulai: string,
  selesai: string
): PemetaanAkunPegawaiSkp[] {
  return semua.filter((p) => rentangBertumpang({ dari: p.berlakuDari, sampai: p.berlakuSampai }, { dari: mulai, sampai: selesai }));
}

export type AkunTertaut = {
  username: string;
  userIdSipp: string;
  /** Jendela berlaku akun ini bagi pegawai itu (potong kejadian di luarnya). */
  jendela: Array<{ dari: string; sampai: string | null }>;
  /** true = dari tautan akun di profil (external_app_credentials), bukan pemetaan. */
  tersirat: boolean;
};

export type TautanAkunSkp = {
  akun: AkunTertaut[];
  /** Pemetaan berlaku (bertumpang dengan rentang) milik pegawai itu. */
  pemetaan: PemetaanAkunPegawaiSkp[];
  /** Kalimat untuk petugas (layar), bukan untuk dokumen. */
  catatanOperator: string[];
};

/**
 * Akun SIPP yang dipegang pegawai pada rentang [mulai, selesai].
 */
export async function akunTertautPegawai(
  db: AletaDatabase,
  userId: string,
  mulai: string,
  selesai: string
): Promise<TautanAkunSkp> {
  const milikPegawai = await bacaPemetaan(db, { userId });
  const catatanOperator: string[] = [];

  if (milikPegawai.length > 0) {
    const berlaku = pemetaanDalamRentang(milikPegawai, mulai, selesai);
    const peta = new Map<string, AkunTertaut>();
    for (const p of berlaku) {
      const kunci = p.usernameSipp.toLowerCase();
      const ada = peta.get(kunci) ?? { username: p.usernameSipp, userIdSipp: p.userIdSipp, jendela: [], tersirat: false };
      ada.jendela.push({ dari: p.berlakuDari, sampai: p.berlakuSampai });
      if (!ada.userIdSipp && p.userIdSipp) ada.userIdSipp = p.userIdSipp;
      peta.set(kunci, ada);
    }
    if (berlaku.length === 0) {
      catatanOperator.push("Tidak ada tautan akun SIPP yang berlaku pada periode ini; isi indikator secara manual dengan bukti.");
    }
    return { akun: [...peta.values()], pemetaan: berlaku, catatanOperator };
  }

  // Belum dipetakan: tautan akun di profil, bila tidak dipakai orang lain.
  const kredensial = await db.queryAll<{ user_id: string; external_username: string }>(
    `SELECT user_id, external_username FROM external_app_credentials
      WHERE app_id = 'sipp' AND external_username <> ''`
  );
  const miliknya = kredensial.filter((k) => k.user_id === userId && k.external_username.trim());
  const akun: AkunTertaut[] = [];
  for (const k of miliknya) {
    const nama = k.external_username.trim();
    const dipakaiLain =
      kredensial.some((o) => o.user_id !== userId && o.external_username.trim().toLowerCase() === nama.toLowerCase()) ||
      (await bacaPemetaan(db, { usernameSipp: nama })).length > 0;
    if (dipakaiLain) {
      catatanOperator.push(
        `Akun SIPP "${nama}" dipakai lebih dari satu pegawai; petakan akun ini lengkap dengan tanggal berlaku di layar Pemetaan.`
      );
      continue;
    }
    akun.push({ username: nama, userIdSipp: "", jendela: [{ dari: "1900-01-01", sampai: null }], tersirat: true });
  }
  if (akun.length === 0 && catatanOperator.length === 0) {
    catatanOperator.push("Pegawai ini belum ditautkan ke akun SIPP; petakan di layar Pemetaan atau isi indikator secara manual.");
  }
  return { akun, pemetaan: [], catatanOperator };
}

// ─── Saran jabatan ──────────────────────────────────────────────────────────

const JABATAN_DARI_POSISI: Readonly<Record<string, JabatanSkp>> = {
  "pos-ketua": "ketua",
  "pos-wakil": "wakil-ketua",
  "pos-panitera": "panitera",
  "pos-panitera-muda-hukum": "panmud-hukum",
  "pos-panitera-muda-gugatan": "panmud-gugatan",
  "pos-panitera-muda-permohonan": "panmud-permohonan",
  "pos-panitera-pengganti": "pp",
  "pos-jurusita": "jurusita",
  "pos-jurusita-pengganti": "jurusita-pengganti",
  "pos-ptsp": "petugas-meja",
  "pos-bendahara": "kasir",
  "pos-analis-keuangan": "kasir",
  "pos-pranata-komputer": "operator",
  "pos-staf-ptip": "operator",
  "pos-sekretaris": "sekretaris",
  "pos-kasubag-umum": "kasubag",
  "pos-kasubag-kepegawaian": "kasubag",
  "pos-kasubag-ptip": "kasubag",
  "pos-analis-perkara": "analis-perkara",
  "pos-analis-perkara-gugatan": "analis-perkara",
  "pos-analis-perkara-hukum": "analis-perkara",
  "pos-dokumentalis-hukum": "analis-perkara",
  "pos-pengelola-penanganan-perkara-gugatan": "analis-perkara",
};

const JABATAN_DARI_PERAN: Readonly<Record<string, JabatanSkp>> = {
  ketua: "ketua",
  "wakil-ketua": "wakil-ketua",
  panitera: "panitera",
  "panitera-pengganti": "pp",
  jurusita: "jurusita",
  sekretaris: "sekretaris",
  kasubag: "kasubag",
  "analis-perkara": "analis-perkara",
  "pranata-komputer": "operator",
  operator: "operator",
  "analis-keuangan": "kasir",
};

/** Peran tambahan (additional_role_ids) -> jabatan SKP yang ikut melekat. */
function jabatanDariPeranTambahan(tambahan: readonly string[]): JabatanSkp[] {
  const hasil: JabatanSkp[] = [];
  const ada = (j: JabatanSkp) => {
    if (!hasil.includes(j)) hasil.push(j);
  };
  for (const x of tambahan.map((t) => String(t).toLowerCase())) {
    if (x === "mediator" || x === "mediator_non_hakim") ada("mediator");
    else if (x === "kasir" || x === "petugas_keuangan_perkara" || x === "bendahara_penerimaan") ada("kasir");
    else if (/^petugas_meja_/.test(x) || x === "petugas_ptsp" || x === "petugas_pendaftaran_perkara") ada("petugas-meja");
    else if (x === "operator" || x === "operator_sipp" || x === "operator_edoc") ada("operator");
  }
  return hasil;
}

/**
 * Saran jabatan dari peran dan jabatan ALETA (dan tebakan grup SIPP bila ada).
 * Ketua vs Wakil SELALU dari peran ALETA, bukan dari grup SIPP (keduanya grup
 * 10). Hanya saran: pemetaan yang dikonfirmasi di layar Pemetaan menang,
 * kecuali Ketua/Wakil yang tetap mengikuti peran.
 */
export function sarankanJabatanSkp(p: {
  roleId: string;
  positionId: string;
  /** Peran tambahan pengguna (mediator, kasir, meja, operator) - hanya menambah jabatan. */
  additionalRoleIds?: readonly string[];
  dugaanSipp?: JabatanSkp | null;
  grupSipp?: readonly number[];
}): { utama: JabatanSkp | null; tambahan: JabatanSkp[] } {
  const role = String(p.roleId || "");
  if (role === "ketua") return { utama: "ketua", tambahan: [] };
  if (role === "wakil-ketua") return { utama: "wakil-ketua", tambahan: [] };

  const dariGrup = (p.grupSipp ?? []).map((g) => GRUP_SIPP_JABATAN[g]).filter((j): j is JabatanSkp => Boolean(j) && j !== "ketua");
  const utama: JabatanSkp | null =
    JABATAN_DARI_POSISI[String(p.positionId || "")] ?? JABATAN_DARI_PERAN[role] ?? (p.dugaanSipp && p.dugaanSipp !== "ketua" ? p.dugaanSipp : null) ?? dariGrup[0] ?? null;
  // Rangkap: pejabat kepaniteraan yang juga terdaftar PP di SIPP -> blok tugas PP.
  const tambahan: JabatanSkp[] = [];
  const dariPeranTambahan = jabatanDariPeranTambahan(p.additionalRoleIds ?? []);
  if (utama && utama !== "pp" && (utama === "panitera" || utama.startsWith("panmud-")) && dariGrup.includes("pp")) {
    tambahan.push("pp");
  }
  // Peran tambahan: mengisi jabatan utama bila kosong, selebihnya menjadi tambahan.
  let utamaAkhir = utama;
  for (const j of dariPeranTambahan) {
    if (!utamaAkhir) utamaAkhir = j;
    else if (j !== utamaAkhir && !tambahan.includes(j) && utamaAkhir !== "ketua" && utamaAkhir !== "wakil-ketua") tambahan.push(j);
  }
  return { utama: utamaAkhir, tambahan };
}

// ─── Simpan ─────────────────────────────────────────────────────────────────

export type MasukanPemetaanSkp = {
  id?: string | null;
  usernameSipp: string;
  userIdSipp?: string | null;
  userId: string;
  jabatanUtama: string | null;
  jabatanTambahan?: unknown[];
  berlakuDari: string;
  berlakuSampai?: string | null;
};

/**
 * Menyimpan (membuat atau memperbarui) satu tautan akun-pegawai. Hanya
 * Panitera, Ketua, Super Admin, dan Admin. Menyimpan = mengonfirmasi.
 *
 * Satu akun SIPP tidak boleh ditautkan ke dua pegawai pada tanggal yang
 * sama: kerjanya akan terhitung dua kali.
 */
export async function simpanPemetaan(
  db: AletaDatabase,
  aktor: AktorSkp,
  masukan: MasukanPemetaanSkp
): Promise<PemetaanAkunPegawaiSkp> {
  if (!bolehUbahTargetSkp(aktor.peran)) {
    throw new ApiError(403, "Hanya Panitera, Ketua, atau administrator yang dapat memetakan akun SIPP ke pegawai.");
  }
  const username = String(masukan.usernameSipp ?? "").trim();
  if (!username || username.length > 100) throw new ApiError(400, "Nama akun SIPP wajib diisi (paling banyak 100 huruf).");
  const userId = String(masukan.userId ?? "").trim();
  const pegawai = userId
    ? await db.queryOne<{ id: string; name: string }>("SELECT id, name FROM users WHERE id = ? AND deleted_at IS NULL", [userId])
    : undefined;
  if (!pegawai) throw new ApiError(404, "Pegawai tidak ditemukan.");

  const utamaTeks = String(masukan.jabatanUtama ?? "").trim();
  if (utamaTeks && !jabatanSkpSah(utamaTeks)) throw new ApiError(400, "Jabatan utama tidak dikenal.");
  const tambahan = [...new Set((masukan.jabatanTambahan ?? []).map(String))];
  const salah = tambahan.find((j) => !jabatanSkpSah(j));
  if (salah) throw new ApiError(400, `Jabatan tambahan "${salah}" tidak dikenal.`);
  const tambahanSah = tambahan.filter(jabatanSkpSah).filter((j) => j !== utamaTeks);

  const dari = tanggalIsiSah(masukan.berlakuDari);
  if (!dari) throw new ApiError(400, "Tanggal mulai berlaku harus tanggal yang sah berbentuk YYYY-MM-DD.");
  const sampaiTeks = String(masukan.berlakuSampai ?? "").trim();
  const sampai = sampaiTeks ? tanggalIsiSah(sampaiTeks) : null;
  if (sampaiTeks && !sampai) throw new ApiError(400, "Tanggal berakhir berlaku harus tanggal yang sah berbentuk YYYY-MM-DD.");
  if (sampai && sampai < dari) throw new ApiError(400, "Tanggal berakhir tidak boleh sebelum tanggal mulai berlaku.");

  const id = String(masukan.id ?? "").trim();
  const sekarang = sekarangIso();

  return withTransaction(db, async (tx) => {
    const lain = await tx.queryAll<BarisPemetaan & { nama: string }>(
      `SELECT a.id, a.username_sipp, a.user_id_sipp, a.user_id, a.jabatan_utama, a.jabatan_tambahan_json, a.berlaku_dari,
              a.berlaku_sampai, a.dikonfirmasi_oleh_id, a.dikonfirmasi_pada, COALESCE(u.name, '') AS nama
         FROM aleta_skp_akun_pegawai a LEFT JOIN users u ON u.id = a.user_id
        WHERE LOWER(a.username_sipp) = ?`,
      [username.toLowerCase()]
    );
    for (const b of lain) {
      if (id && b.id === id) continue;
      if (rentangBertumpang({ dari, sampai }, { dari: b.berlaku_dari, sampai: teksAtauNull(b.berlaku_sampai) })) {
        throw new ApiError(
          409,
          b.user_id === userId
            ? `Akun SIPP "${username}" sudah ditautkan ke pegawai ini pada tanggal yang bertumpang; ubah tautan yang ada.`
            : `Akun SIPP "${username}" pada tanggal itu sudah ditautkan ke ${b.nama || "pegawai lain"}; akhiri tautan itu lebih dahulu.`
        );
      }
    }

    let simpanId = id;
    if (id) {
      const ada = await tx.queryOne<{ id: string }>("SELECT id FROM aleta_skp_akun_pegawai WHERE id = ?", [id]);
      if (!ada) throw new ApiError(404, "Tautan akun yang diubah tidak ditemukan.");
      await tx.run(
        `UPDATE aleta_skp_akun_pegawai
            SET username_sipp = ?, user_id_sipp = ?, user_id = ?, jabatan_utama = ?, jabatan_tambahan_json = ?,
                berlaku_dari = ?, berlaku_sampai = ?, dikonfirmasi_oleh_id = ?, dikonfirmasi_pada = ?, diperbarui_pada = ?
          WHERE id = ?`,
        [username, String(masukan.userIdSipp ?? "").trim(), userId, utamaTeks, JSON.stringify(tambahanSah), dari, sampai ?? "", aktor.userId, sekarang, sekarang, id]
      );
    } else {
      simpanId = await nextPrefixedId(tx, "aleta_skp_akun_pegawai", "skpakun");
      await tx.run(
        `INSERT INTO aleta_skp_akun_pegawai
           (id, username_sipp, user_id_sipp, user_id, jabatan_utama, jabatan_tambahan_json, berlaku_dari, berlaku_sampai,
            dikonfirmasi_oleh_id, dikonfirmasi_pada, dibuat_pada, diperbarui_pada)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [simpanId, username, String(masukan.userIdSipp ?? "").trim(), userId, utamaTeks, JSON.stringify(tambahanSah), dari, sampai ?? "", aktor.userId, sekarang, sekarang, sekarang]
      );
    }

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: aktor.userId,
      action: "SKP_PEMETAAN_SIMPAN",
      entityType: "skp_akun_pegawai",
      entityId: simpanId,
      payload: {
        usernameSipp: username,
        userId,
        jabatanUtama: utamaTeks ? LABEL_JABATAN_SKP[utamaTeks as JabatanSkp] : "",
        jabatanTambahan: tambahanSah,
        berlakuDari: dari,
        berlakuSampai: sampai,
        baru: !id,
      },
    });

    const baris = await tx.queryOne<BarisPemetaan>(
      `SELECT id, username_sipp, user_id_sipp, user_id, jabatan_utama, jabatan_tambahan_json, berlaku_dari,
              berlaku_sampai, dikonfirmasi_oleh_id, dikonfirmasi_pada
         FROM aleta_skp_akun_pegawai WHERE id = ?`,
      [simpanId]
    );
    return petakanBarisPemetaan(baris!);
  });
}
