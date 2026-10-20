import { susunPeriodeSkpJabatan } from "@/lib/eviden-skp-unduh";
import type { DataEvidenSkp } from "@/lib/eviden-skp-tipe";
import { hitungLembarSkp, type HasilSkpJabatan } from "@/lib/skp-jabatan-hitung";
import { KUNCI_FAKTA_SKP_JABATAN } from "@/lib/skp-jabatan-katalog";
import type {
  AktorSkp,
  DataSkpJabatan,
  FaktaAkunSkp,
  HasilBolehLihatSkp,
  JabatanSkp,
  JenisSkp,
  KunciPeriodeSkpJabatan,
  PegawaiSkp,
  PenetapanSkp,
} from "@/lib/skp-jabatan-tipe";
import { type AletaDatabase } from "@/server/db/client";
import { ambilDataEvidenSkpPeriode, ambilDataSkpJabatan } from "@/server/modules/aleta-ecourt/eviden-skp-data";
import { bolehLihatSkp } from "@/server/modules/skp/hak";
import { bacaFaktaSistem } from "@/server/modules/skp/kegiatan-aleta";
import { bacaIsian } from "@/server/modules/skp/isian";
import { akunTertautPegawai, type AkunTertaut } from "@/server/modules/skp/pemetaan";
import { bacaKeadaanPegawai, hakPegawai, pejabatPenilaiSkp, type KeadaanPegawaiSkp, type PenilaiSkp } from "@/server/modules/skp/pegawai";
import { bacaPenetapan } from "@/server/modules/skp/penetapan";
import { bacaTarget } from "@/server/modules/skp/target";
import { sekarangIso } from "@/server/modules/skp/umum";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * PENYIAPAN LEMBAR SKP: pegawai + akun SIPP + bot + isian + target -> hitung
 * ============================================================================
 *
 * Satu pintu untuk rute lembar, daftar dokumen, unduhan, dan penetapan, supaya
 * hak, pemotongan kejadian menurut tanggal berlaku akun, dan pemakaian
 * penetapan terkunci SAMA di semuanya.
 *
 *   - Hak diperiksa (bolehLihatSkp) sebelum data SIPP diminta.
 *   - Akun SIPP yang dipegang pegawai pada periode itu (pemetaan bertanggal)
 *     diteruskan ke bot; kejadian di luar tanggal berlakunya dibuang (akun
 *     bersama Kasir/Meja tidak menghitung kerja orang lain).
 *   - Tidak ada akun aktif -> bot TIDAK dipanggil; indikator SIPP "—".
 *   - Penetapan TERKUNCI dipakai apa adanya (bot tidak dipanggil), kecuali
 *     diminta langsung.
 *   - Bot gagal: `ketat` -> galat (unduhan/penetapan tidak boleh diam-diam
 *     berisi "—"); tidak ketat -> data null dan sippTerjangkau=false (layar
 *     tetap menampilkan isian manual dan memberi tahu).
 */

export type PermintaanSiapSkp = {
  jenis: Exclude<JenisSkp, "hakim">;
  pegawaiUserId: string;
  /** ID SIPP hakim - untuk SKP Pimpinan (eviden hakim ikut). */
  idSipp: number | null;
  tahun: number;
  periode: KunciPeriodeSkpJabatan;
  sertakanTambahan: boolean;
  /** true = abaikan penetapan terkunci dan hitung dari SIPP sekarang. */
  langsung: boolean;
  /** true = kegagalan bot menjadi galat. */
  ketat: boolean;
  /** true = ambil juga data eviden hakim (SKP Pimpinan: unduhan, daftar, penetapan). */
  denganDataHakim: boolean;
};

export type HasilSiapSkp = {
  pegawai: KeadaanPegawaiSkp;
  hak: HasilBolehLihatSkp;
  hasil: HasilSkpJabatan;
  dataHakim: DataEvidenSkp | null;
  penetapan: PenetapanSkp | null;
  dariPenetapan: boolean;
  sippTerjangkau: boolean;
  catatanOperator: string[];
  penilai: PenilaiSkp;
  akun: AkunTertaut[];
};

/** Kejadian di luar jendela berlaku akun dibuang; tanpa tanggal dipertahankan (tidak pernah jadi 0). */
function potongMenurutJendela(akun: readonly FaktaAkunSkp[], tertaut: readonly AkunTertaut[]): FaktaAkunSkp[] {
  const peta = new Map(tertaut.map((a) => [a.username.toLowerCase(), a]));
  const hasil: FaktaAkunSkp[] = [];
  for (const a of akun) {
    const t = peta.get(a.username.toLowerCase());
    if (!t) continue;
    hasil.push({
      ...a,
      fakta: a.fakta.map((f) => ({
        ...f,
        kejadian: f.kejadian.filter((k) => {
          const tanggal = k.tanggal ? k.tanggal.slice(0, 10) : "";
          if (!tanggal) return true;
          return t.jendela.some((j) => tanggal >= j.dari && tanggal <= (j.sampai || "9999-12-31"));
        }),
      })),
    });
  }
  return hasil;
}

function gabungkanData(semua: readonly DataSkpJabatan[]): DataSkpJabatan {
  const [pertama, ...sisa] = semua;
  const akun = new Map<string, FaktaAkunSkp>();
  for (const d of semua) {
    for (const a of d.akun) {
      const kunci = a.username.toLowerCase();
      const ada = akun.get(kunci);
      if (!ada) {
        akun.set(kunci, { ...a, fakta: [...a.fakta] });
        continue;
      }
      for (const f of a.fakta) if (!ada.fakta.some((x) => x.kunci === f.kunci)) ada.fakta.push(f);
    }
  }
  const uniq = (l: Array<string | undefined>) => [...new Set(l.flatMap((x) => (x ? [x] : [])))];
  return {
    ...pertama,
    akun: [...akun.values()],
    catatan: uniq([pertama, ...sisa].flatMap((d) => d.catatan)),
    catatanOperator: uniq([pertama, ...sisa].flatMap((d) => d.catatanOperator ?? [])),
    galat: uniq([pertama, ...sisa].flatMap((d) => d.galat)),
  };
}

/** Jabatan yang fakta SIPP-nya diminta untuk sebuah permintaan. */
function jabatanDiminta(p: PermintaanSiapSkp, pegawai: KeadaanPegawaiSkp): JabatanSkp[] {
  if (p.jenis === "pimpinan") return [pegawai.jabatanUtama === "wakil-ketua" ? "wakil-ketua" : "ketua"];
  const daftar: JabatanSkp[] = [p.jenis];
  if (p.sertakanTambahan && pegawai.jabatanUtama === p.jenis) daftar.push(...pegawai.jabatanTambahan);
  return daftar;
}

export async function siapkanSkp(
  db: AletaDatabase,
  aktor: AktorSkp,
  p: PermintaanSiapSkp
): Promise<HasilSiapSkp> {
  const periode = susunPeriodeSkpJabatan(p.periode, p.tahun);
  const pegawai = await bacaKeadaanPegawai(db, p.pegawaiUserId, { mulai: periode.mulai, selesai: periode.selesai });
  if (!pegawai) throw new ApiError(404, "Pegawai tidak ditemukan.");

  const hak = bolehLihatSkp(aktor, hakPegawai(pegawai));
  if (!hak.boleh) throw new ApiError(403, "Anda tidak berhak melihat SKP pegawai ini.");

  if (p.jenis === "pimpinan") {
    if (pegawai.roleId !== "ketua" && pegawai.roleId !== "wakil-ketua") {
      throw new ApiError(400, "SKP Pimpinan hanya untuk Ketua dan Wakil Ketua.");
    }
  } else if (!pegawai.jenisTersedia.includes(p.jenis)) {
    throw new ApiError(400, "Pegawai ini tidak menjabat sebagai jabatan yang diminta; petakan jabatannya di layar Pemetaan.");
  }

  const penilai = await pejabatPenilaiSkp(db, pegawai);
  const tersimpan = await bacaPenetapan(db, { userId: pegawai.userId, jenis: p.jenis, periode: p.periode, tahun: p.tahun });

  if (tersimpan?.penetapan.status === "terkunci" && !p.langsung) {
    return {
      pegawai,
      hak,
      hasil: tersimpan.isi.hasil,
      dataHakim: tersimpan.isi.dataHakim,
      penetapan: tersimpan.penetapan,
      dariPenetapan: true,
      sippTerjangkau: true,
      catatanOperator: [],
      penilai,
      akun: [],
    };
  }

  const tautan = await akunTertautPegawai(db, pegawai.userId, periode.mulai, periode.selesai);
  const catatanOperator = [...tautan.catatanOperator];
  const usernames = tautan.akun.map((a) => a.username);

  // Pegawai untuk hitungan: untuk jabatan tambahan yang diminta sebagai jenis, ia menjadi jabatan utama lembar itu.
  const untukHitung: PegawaiSkp = {
    userId: pegawai.userId,
    nama: pegawai.nama,
    nip: pegawai.nip,
    pangkatGolongan: pegawai.pangkatGolongan,
    jabatanUtama: p.jenis === "pimpinan" ? pegawai.jabatanUtama : p.jenis,
    jabatanTambahan: p.jenis === "pimpinan" || pegawai.jabatanUtama === p.jenis ? pegawai.jabatanTambahan : [],
  };

  let data: DataSkpJabatan | null = null;
  let sippTerjangkau = true;
  const mulaiDari = new Date().toISOString();
  const jabatanLembar = jabatanDiminta(p, pegawai);
  // Bot hanya ditanya untuk jabatan yang punya indikator SIPP; jabatan yang
  // seluruhnya dari catatan sistem (Sekretaris, Kasubag, Analis) tidak
  // bergantung pada SIPP terjangkau atau tidaknya.
  const jabatanSipp = jabatanLembar.filter((j) => (KUNCI_FAKTA_SKP_JABATAN[j] ?? []).length > 0);
  if (usernames.length === 0 || jabatanSipp.length === 0) {
    data = {
      ok: true,
      periode,
      jabatan: null,
      akun: [],
      catatan: [],
      galat: [],
      dihitungPada: mulaiDari,
    };
  } else {
    const diterima: DataSkpJabatan[] = [];
    for (const jabatan of jabatanSipp) {
      const jawaban = await ambilDataSkpJabatan({ tahun: p.tahun, periode: p.periode, jabatan, username: usernames });
      if (!jawaban.ok) {
        if (p.ketat) throw new ApiError(jawaban.status, jawaban.alasan);
        sippTerjangkau = false;
        catatanOperator.push(jawaban.alasan);
        break;
      }
      diterima.push(jawaban.data);
    }
    if (sippTerjangkau && diterima.length > 0) {
      const gabung = gabungkanData(diterima);
      data = { ...gabung, akun: potongMenurutJendela(gabung.akun, tautan.akun) };
      catatanOperator.push(...(gabung.catatanOperator ?? []));
    }
  }

  // Kegiatan nyata di e-Court dan aplikasi pengadilan (bukan SIPP): dibaca di
  // portal, dimiliki satu pegawai, digabung ke fakta supaya satu jalur hitung.
  if (data) {
    const sistem = await bacaFaktaSistem(db, {
      userId: pegawai.userId,
      jabatan: jabatanLembar,
      mulai: periode.mulai,
      selesai: periode.selesai,
    });
    if (sistem) data = { ...data, akun: [...data.akun, sistem] };
  }

  let dataHakim: DataEvidenSkp | null = null;
  if (p.jenis === "pimpinan" && p.denganDataHakim) {
    if (p.idSipp === null) throw new ApiError(400, "SKP Pimpinan memerlukan ID SIPP hakim (id).");
    const hakim = await ambilDataEvidenSkpPeriode({ peran: "hakim", id: String(p.idSipp), tahun: p.tahun, periode: p.periode });
    if (!hakim.ok) throw new ApiError(hakim.status, hakim.alasan);
    dataHakim = hakim.data;
    catatanOperator.push(...(hakim.data.catatanOperator ?? []));
  }

  const [isian, target] = await Promise.all([
    bacaIsian(db, { userId: pegawai.userId, tahun: p.tahun }),
    bacaTarget(db, { tahun: p.tahun }),
  ]);

  const hasil = hitungLembarSkp({
    jenis: p.jenis,
    periode,
    pegawai: untukHitung,
    pejabatPenilai: penilai.penilai,
    data,
    usernameSipp: usernames,
    isian,
    target,
    sertakanTambahan: p.sertakanTambahan,
    dihitungPada: data?.dihitungPada ?? sekarangIso(),
  });

  return {
    pegawai,
    hak,
    hasil,
    dataHakim,
    penetapan: tersimpan?.penetapan ?? null,
    dariPenetapan: false,
    sippTerjangkau,
    catatanOperator: [...new Set(catatanOperator)],
    penilai,
    akun: tautan.akun,
  };
}
