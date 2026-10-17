import { bacaIdSipp } from "@/lib/rekap-petugas";
import { LABEL_JABATAN_SKP, type AktorSkp, type JenisSkp, type KunciPeriodeSkpJabatan } from "@/lib/skp-jabatan-tipe";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import { PESAN_PERIODE_BELUM_DIMULAI, jenisSkpSah, mulaiPeriodeSkpJabatan, periodeSkpJabatanSah } from "@/lib/eviden-skp-unduh";
import { type AletaDatabase } from "@/server/db/client";
import { bolehLihatSkp, bolehTinjauSkp, bolehUbahTargetSkp } from "@/server/modules/skp/hak";
import { ajukanIsian, bacaIsian, simpanIsian, tinjauIsian } from "@/server/modules/skp/isian";
import { siapkanSkp } from "@/server/modules/skp/lembar";
import { bacaPemetaan, sarankanJabatanSkp } from "@/server/modules/skp/pemetaan";
import { bacaKeadaanPegawai, daftarKeadaanPegawai, hakPegawai, type KeadaanPegawaiSkp } from "@/server/modules/skp/pegawai";
import { bacaPenetapan, simpanPenetapan } from "@/server/modules/skp/penetapan";
import { ApiError } from "@/server/shared/errors";

/**
 * Logika rute JSON SKP (daftar pegawai, lembar, penetapan, pemetaan). Terpisah
 * dari berkas rute supaya diuji tanpa lapisan HTTP.
 */

export type LingkupSkp = "saya" | "bawahan" | "semua";

export function bacaLingkup(nilai: string | null): LingkupSkp {
  const l = String(nilai ?? "").trim().toLowerCase();
  return l === "bawahan" || l === "semua" ? l : "saya";
}

/** Peran yang melihat seluruh pegawai (lihat saja untuk Ketua/Wakil/Panitera). */
export function bolehLihatSemuaSkp(aktor: AktorSkp): boolean {
  return ["super-admin", "admin", "ketua", "wakil-ketua", "panitera"].includes(aktor.peran);
}

export type BarisPegawaiSkp = {
  userId: string;
  nama: string;
  nip: string | null;
  jabatanUtama: KeadaanPegawaiSkp["jabatanUtama"];
  labelJabatanUtama: string | null;
  jabatanTambahan: KeadaanPegawaiSkp["jabatanTambahan"];
  jenisTersedia: JenisSkp[];
  atasanNama: string | null;
  aktif: boolean;
  alasanHak: string;
  bolehUbahIsian: boolean;
};

export async function daftarPegawaiUntukAktor(db: AletaDatabase, aktor: AktorSkp, lingkup: LingkupSkp) {
  if (lingkup === "semua" && !bolehLihatSemuaSkp(aktor)) {
    throw new ApiError(403, "Daftar seluruh pegawai hanya untuk Ketua, Wakil Ketua, Panitera, dan administrator.");
  }
  const semua = await daftarKeadaanPegawai(db, null);
  const dipilih = semua.filter((k) => {
    if (lingkup === "saya") return k.userId === aktor.userId;
    if (lingkup === "bawahan") return k.atasanLangsungUserId === aktor.userId && k.userId !== aktor.userId;
    return k.aktif;
  });
  const pegawai: BarisPegawaiSkp[] = [];
  for (const k of dipilih) {
    const hak = bolehLihatSkp(aktor, hakPegawai(k));
    if (!hak.boleh) continue;
    pegawai.push({
      userId: k.userId,
      nama: k.nama,
      nip: k.nip,
      jabatanUtama: k.jabatanUtama,
      labelJabatanUtama: k.jabatanUtama ? LABEL_JABATAN_SKP[k.jabatanUtama] : null,
      jabatanTambahan: k.jabatanTambahan,
      jenisTersedia: k.jenisTersedia,
      atasanNama: k.atasanNama,
      aktif: k.aktif,
      alasanHak: hak.alasan,
      bolehUbahIsian: hak.bolehUbahIsian,
    });
  }
  return {
    lingkup,
    aktor: { userId: aktor.userId, peran: aktor.peran, bolehUbahTarget: bolehUbahTargetSkp(aktor.peran), bolehLihatSemua: bolehLihatSemuaSkp(aktor) },
    pegawai,
  };
}

export type ParameterLembar = {
  jenis: string | null;
  pegawai: string | null;
  id: string | null;
  tahun: string | null;
  periode: string | null;
  tambahan: string | null;
  langsung: string | null;
};

export function bacaParameterLembar(p: URLSearchParams): ParameterLembar {
  const ambil = (k: string) => (p.get(k) === null ? null : String(p.get(k)));
  return {
    jenis: ambil("jenis"),
    pegawai: ambil("pegawai"),
    id: ambil("id"),
    tahun: ambil("tahun"),
    periode: ambil("periode"),
    tambahan: ambil("tambahan"),
    langsung: ambil("langsung"),
  };
}

function periksaTahunPeriode(tahunTeks: string | null, periodeTeks: string | null) {
  const tahunStr = String(tahunTeks ?? "").trim();
  const tahun = Number(tahunStr);
  if (!/^\d{4}$/.test(tahunStr) || tahun < 2000 || tahun > 2100) {
    throw new ApiError(400, "Tahun harus empat angka antara 2000 dan 2100.");
  }
  const periode = String(periodeTeks ?? "").trim().toLowerCase();
  if (!periodeSkpJabatanSah(periode)) throw new ApiError(400, "Periode harus b01 sampai b12, tw1, tw2, tw3, tw4, atau tahun.");
  if (mulaiPeriodeSkpJabatan(periode, tahun) > waktuPengadilan().tanggal) throw new ApiError(400, PESAN_PERIODE_BELUM_DIMULAI);
  return { tahun, periode: periode as KunciPeriodeSkpJabatan };
}

function periksaJenis(jenisTeks: string | null): Exclude<JenisSkp, "hakim"> {
  const jenis = String(jenisTeks ?? "").trim().toLowerCase();
  if (!jenisSkpSah(jenis) || jenis === "hakim") {
    throw new ApiError(400, "Jenis SKP harus pimpinan atau salah satu jabatan perkara yang dikenal (SKP Hakim melalui menu eviden SKP).");
  }
  return jenis;
}

/** Lembar SKP untuk layar: tanpa mengunduh. Kegagalan bot tidak menggagalkan layar (isian tetap tampil). */
export async function bacaLembarUntukLayar(db: AletaDatabase, aktor: AktorSkp, p: ParameterLembar) {
  const jenis = periksaJenis(p.jenis);
  const { tahun, periode } = periksaTahunPeriode(p.tahun, p.periode);
  const pegawaiUserId = String(p.pegawai ?? "").trim() || aktor.userId;
  const idSipp = p.id ? bacaIdSipp(p.id) : null;

  const siap = await siapkanSkp(db, aktor, {
    jenis,
    pegawaiUserId,
    idSipp,
    tahun,
    periode,
    sertakanTambahan: !["0", "tidak", "false", "mati"].includes(String(p.tambahan ?? "").toLowerCase()),
    langsung: ["1", "ya", "true"].includes(String(p.langsung ?? "").toLowerCase()),
    ketat: false,
    denganDataHakim: false,
  });
  const isian = (await bacaIsian(db, { userId: siap.pegawai.userId, tahun })).filter((i) => i.periode === periode);
  return {
    jenis,
    periode: siap.hasil.lembar.periode,
    pegawai: {
      userId: siap.pegawai.userId,
      nama: siap.pegawai.nama,
      nip: siap.pegawai.nip,
      pangkatGolongan: siap.pegawai.pangkatGolongan,
      jabatanUtama: siap.pegawai.jabatanUtama,
      jabatanTambahan: siap.pegawai.jabatanTambahan,
      atasanNama: siap.pegawai.atasanNama,
    },
    hak: {
      alasan: siap.hak.alasan,
      bolehUbahIsian: siap.hak.bolehUbahIsian,
      bolehUbahTarget: siap.hak.bolehUbahTarget,
      bolehTinjau: bolehTinjauSkp(aktor, hakPegawai(siap.pegawai)),
    },
    lembar: siap.hasil.lembar,
    sippTerjangkau: siap.sippTerjangkau,
    dariPenetapan: siap.dariPenetapan,
    penetapan: siap.penetapan
      ? {
          id: siap.penetapan.id,
          status: siap.penetapan.status,
          dihitungPada: siap.penetapan.dihitungPada,
          dikunciPada: siap.penetapan.dikunciPada,
          pejabatPenilaiNama: siap.penetapan.pejabatPenilaiNama,
        }
      : null,
    akun: siap.akun.map((a) => ({ username: a.username, tersirat: a.tersirat, jendela: a.jendela })),
    // Untuk PETUGAS di layar; tidak tercetak di dokumen.
    catatanOperator: siap.catatanOperator,
    isian,
  };
}

/** Menghitung langsung lalu menyimpan (draf) atau mengunci tangkapan. */
export async function tetapkanSkp(db: AletaDatabase, aktor: AktorSkp, isi: Record<string, unknown>) {
  const jenis = periksaJenis(typeof isi.jenis === "string" ? isi.jenis : null);
  const { tahun, periode } = periksaTahunPeriode(String(isi.tahun ?? ""), typeof isi.periode === "string" ? isi.periode : null);
  const pegawaiUserId = String(isi.pegawai ?? "").trim();
  if (!pegawaiUserId) throw new ApiError(400, "Pegawai harus diisi.");
  const idSipp = isi.id !== undefined && isi.id !== null && isi.id !== "" ? bacaIdSipp(String(isi.id)) : null;
  const kunci = isi.kunci === true || isi.kunci === "1" || isi.kunci === 1;

  const siap = await siapkanSkp(db, aktor, {
    jenis,
    pegawaiUserId,
    idSipp,
    tahun,
    periode,
    sertakanTambahan: isi.tambahan !== false && isi.tambahan !== 0 && isi.tambahan !== "0",
    langsung: true,
    ketat: true,
    denganDataHakim: jenis === "pimpinan",
  });
  const penetapan = await simpanPenetapan(db, aktor, hakPegawai(siap.pegawai), {
    jenis,
    periode,
    tahun,
    hasil: siap.hasil,
    dataHakim: siap.dataHakim,
    penilai: { id: siap.penilai.userId, nama: siap.penilai.penilai?.nama ?? "" },
    kunci,
  });
  return {
    penetapan: {
      id: penetapan.id,
      userId: penetapan.userId,
      jenis: penetapan.jenis,
      periode: penetapan.periode,
      tahun: penetapan.tahun,
      status: penetapan.status,
      dihitungPada: penetapan.dihitungPada,
      pejabatPenilaiNama: penetapan.pejabatPenilaiNama,
      dikunciOlehId: penetapan.dikunciOlehId,
      dikunciPada: penetapan.dikunciPada,
    },
    lembar: penetapan.tangkapan,
  };
}

/** Layar Pemetaan: tautan yang ada, ditambah pegawai beserta saran jabatan dan akun di profilnya. */
export async function bacaPemetaanUntukLayar(db: AletaDatabase, aktor: AktorSkp) {
  if (!bolehLihatSemuaSkp(aktor)) {
    throw new ApiError(403, "Pemetaan akun dan jabatan hanya untuk Ketua, Wakil Ketua, Panitera, dan administrator.");
  }
  const [pemetaan, pegawai, kredensial] = await Promise.all([
    bacaPemetaan(db),
    daftarKeadaanPegawai(db, null),
    db.queryAll<{ user_id: string; external_username: string }>(
      `SELECT user_id, external_username FROM external_app_credentials WHERE app_id = 'sipp' AND external_username <> ''`
    ),
  ]);
  const akunProfil = new Map<string, string[]>();
  for (const k of kredensial.filter((x) => x.external_username.trim())) akunProfil.set(k.user_id, [...(akunProfil.get(k.user_id) ?? []), k.external_username.trim()]);
  return {
    bolehUbah: bolehUbahTargetSkp(aktor.peran),
    pemetaan,
    pegawai: pegawai
      .filter((k) => k.aktif)
      .map((k) => {
        const saran = sarankanJabatanSkp({ roleId: k.roleId, positionId: k.positionId });
        return {
          userId: k.userId,
          nama: k.nama,
          nip: k.nip,
          jabatanUtama: k.jabatanUtama,
          jabatanTambahan: k.jabatanTambahan,
          saranUtama: saran.utama,
          saranTambahan: saran.tambahan,
          akunProfil: akunProfil.get(k.userId) ?? [],
          jumlahTautan: pemetaan.filter((p) => p.userId === k.userId).length,
        };
      }),
  };
}

/** Penetapan yang ada (draf atau terkunci) untuk satu pegawai, jenis, dan periode. */
export async function bacaPenetapanUntukLayar(db: AletaDatabase, aktor: AktorSkp, p: ParameterLembar) {
  const jenis = periksaJenis(p.jenis);
  const { tahun, periode } = periksaTahunPeriode(p.tahun, p.periode);
  const pegawaiUserId = String(p.pegawai ?? "").trim() || aktor.userId;
  const pegawai = await bacaKeadaanPegawai(db, pegawaiUserId, null);
  if (!pegawai) throw new ApiError(404, "Pegawai tidak ditemukan.");
  if (!bolehLihatSkp(aktor, hakPegawai(pegawai)).boleh) throw new ApiError(403, "Anda tidak berhak melihat SKP pegawai ini.");
  const tersimpan = await bacaPenetapan(db, { userId: pegawaiUserId, jenis, periode, tahun });
  return {
    jenis,
    periode,
    tahun,
    bolehTinjau: bolehTinjauSkp(aktor, hakPegawai(pegawai)),
    penetapan: tersimpan
      ? {
          id: tersimpan.penetapan.id,
          status: tersimpan.penetapan.status,
          dihitungPada: tersimpan.penetapan.dihitungPada,
          dikunciPada: tersimpan.penetapan.dikunciPada,
          dikunciOlehId: tersimpan.penetapan.dikunciOlehId,
          pejabatPenilaiNama: tersimpan.penetapan.pejabatPenilaiNama,
        }
      : null,
    lembar: tersimpan?.penetapan.tangkapan ?? null,
  };
}

/** Isian manual satu pegawai (tahun, dan periode bila diberikan) bagi yang berhak melihat SKP-nya. */
export async function bacaIsianUntukLayar(db: AletaDatabase, aktor: AktorSkp, p: URLSearchParams) {
  const pegawaiUserId = String(p.get("pegawai") ?? "").trim() || aktor.userId;
  const tahunTeks = String(p.get("tahun") ?? "").trim();
  const tahun = Number(tahunTeks);
  if (!/^\d{4}$/.test(tahunTeks) || tahun < 2000 || tahun > 2100) throw new ApiError(400, "Tahun harus empat angka antara 2000 dan 2100.");
  const periodeTeks = String(p.get("periode") ?? "").trim().toLowerCase();
  if (periodeTeks && !periodeSkpJabatanSah(periodeTeks)) throw new ApiError(400, "Periode harus b01 sampai b12, tw1, tw2, tw3, tw4, atau tahun.");
  const pegawai = await bacaKeadaanPegawai(db, pegawaiUserId, null);
  if (!pegawai) throw new ApiError(404, "Pegawai tidak ditemukan.");
  const hak = bolehLihatSkp(aktor, hakPegawai(pegawai));
  if (!hak.boleh) throw new ApiError(403, "Anda tidak berhak melihat SKP pegawai ini.");
  return {
    pegawaiUserId,
    bolehUbahIsian: hak.bolehUbahIsian,
    bolehTinjau: bolehTinjauSkp(aktor, hakPegawai(pegawai)),
    isian: await bacaIsian(db, { userId: pegawaiUserId, tahun, periode: periodeTeks || undefined }),
  };
}

/** PUT isian = simpan draf; POST isian = ajukan | setujui | kembalikan. */
export async function jalankanAksiIsian(db: AletaDatabase, aktor: AktorSkp, isi: Record<string, unknown>) {
  const aksi = String(isi.aksi ?? "").trim().toLowerCase();
  const id = String(isi.id ?? "").trim();
  if (!id) throw new ApiError(400, "ID isian harus diisi.");
  if (aksi === "ajukan") return ajukanIsian(db, aktor, id);
  if (aksi === "setujui" || aksi === "kembalikan") {
    return tinjauIsian(db, aktor, id, aksi, String(isi.catatan ?? ""));
  }
  throw new ApiError(400, "Aksi harus ajukan, setujui, atau kembalikan.");
}

export async function simpanIsianDariIsi(db: AletaDatabase, aktor: AktorSkp, isi: Record<string, unknown>) {
  return simpanIsian(db, aktor, {
    userId: typeof isi.pegawai === "string" ? isi.pegawai : null,
    periode: String(isi.periode ?? ""),
    tahun: Number(isi.tahun),
    kunciRhk: String(isi.kunciRhk ?? ""),
    kunciIndikator: String(isi.kunciIndikator ?? ""),
    nilai: (isi.nilai ?? null) as number | string | null,
    nilaiTeks: typeof isi.nilaiTeks === "string" ? isi.nilaiTeks : undefined,
    catatan: typeof isi.catatan === "string" ? isi.catatan : undefined,
    bukti: isi.bukti,
  });
}
