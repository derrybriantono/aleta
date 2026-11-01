import { getEffectiveRoleId } from "@/lib/permissions";
import { PERAN_HAKIM_ADVANCE } from "@/lib/putusan-advance";
import { bolehDisarankan } from "@/lib/rak-peraturan/indeks";
import type { MatriksDalil } from "@/lib/matriks-dalil";
import { susunDrafPutusanA1, type ArahDrafA1, type ButirPustakaA1, type DrafPutusanA1, type MasukanDrafA1, type SaksiA1 } from "@/lib/draf-putusan-a1";
import type { BarisSidangH7, DrafH7, NilaiPenanda, SaksiDiperiksa, StatusVarianH7 } from "@/lib/agen-h7-putusan";
import type { AletaDatabase } from "@/server/db/client";
import { getGatewayAmarBiaya, getGatewayPraperiksaFakta } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { matriksDalilPerkara } from "@/server/modules/aleta-ecourt/isi-sipp-sumber";
import { cariButir } from "@/server/modules/aleta-ecourt/pustaka-pertimbangan";
import { bacaSatkerAktif } from "@/server/modules/satker/identitas";

/**
 * ============================================================================
 * A1 (1 Nov 2026) - DRAF PERTIMBANGAN & AMAR OTOMATIS: PENGUMPUL BAHAN (SISI SERVER)
 * ============================================================================
 *
 * Dipanggil dari susunDrafSatu (agen H-7) untuk tiap varian draf. Aturannya di @/lib/draf-putusan-a1 (murni, diuji).
 * Bahan dibaca SAJA, semuanya lewat jalur yang sudah ada:
 *   - petitum & pihak     getGatewayPraperiksaFakta (sumber yang sama dengan usulan amar borang SIPP, rute amar-usulan);
 *   - biaya & prodeo      getGatewayAmarBiaya (#8504#/#0155# ABT);
 *   - nama satker         identitas satker aktif;
 *   - matriks dalil P2    matriksDalilPerkara (simpanan aleta_matriks_dalil; dihitung ulang hanya bila berkas e-Court berubah),
 *                         beserta status pembuktian agen A2 (kolom pembuktian) - kosong = "belum dinilai";
 *   - pustaka             butir pertimbangan yang SUDAH DISAHKAN berlabel huruf alasan (paling banyak dua per huruf).
 * Saksi, bukti, kesimpulan, dan lama pisah datang dari bahan H-7 yang sudah terkumpul (tidak dibaca dua kali).
 *
 * KINERJA: bahan dibaca berbarengan, tiap bacaan berbatas waktu; penyusunnya murni (diukur 2,4-8,5 ms per varian atas 10
 * perkara). Semua di latar agen (jadwal 06.00 / peristiwa BAS kesimpulan) - tidak ada permintaan pengguna yang menunggu.
 * Tidak ada yang ditulis ke SIPP/ABT; hasil ikut draf H-7 (draf_json 0068).
 */

const teks = (x: unknown) => String(x ?? "").trim();

/** Batas waktu tiap bacaan bahan A1 (ms). */
export const BATAS_BAHAN_A1_MS = 25_000;

async function denganBatas<T>(janji: Promise<T>, ms: number, cadangan: T): Promise<T> {
  let t: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([janji.catch(() => cadangan), new Promise<T>((r) => (t = setTimeout(() => r(cadangan), ms)))]);
  } finally {
    if (t) clearTimeout(t);
  }
}

export type FaktaA1 = { petitum: string; pihak1: string[]; pihak2: string[]; perkaraId: number | null; tanggalDaftar: string };
export type BiayaA1 = { prodeo: boolean; tahunDaftar: number | null; namaPengadilan: string; biaya: number | null; terbilang: string };

export type SumberA1 = {
  fakta(nomorPerkara: string): Promise<FaktaA1 | null>;
  biaya(perkaraId: number): Promise<BiayaA1 | null>;
  satker(db: AletaDatabase): Promise<string>;
  matriks(db: AletaDatabase, nomorPerkara: string, sebutan: { lawan: string; pelaku: string }): Promise<MatriksDalil | null>;
  pustaka(db: AletaDatabase, huruf: string): Promise<ButirPustakaA1[]>;
};

const bersihPa = (x: unknown) => teks(x).replace(/^\s*pengadilan\s+agama\s+/i, "").trim();

export const SUMBER_A1_BAWAAN: SumberA1 = {
  async fakta(nomor) {
    const h = await getGatewayPraperiksaFakta(nomor);
    if (!h.ok || !h.data?.ok) return null;
    const f = h.data;
    const nama = (ke: number) => (f.pihak ?? []).filter((p) => Number(p.pihakKe) === ke).map((p) => teks(p.nama)).filter(Boolean);
    return { petitum: teks(f.petitum), pihak1: nama(1), pihak2: nama(2), perkaraId: Number(f.perkaraId) || null, tanggalDaftar: teks(f.tanggalDaftar) };
  },
  async biaya(perkaraId) {
    const h = await getGatewayAmarBiaya(perkaraId);
    if (!h.ok || !h.data?.ok) return null;
    const b = h.data;
    return { prodeo: b.prodeo === true, tahunDaftar: b.tahunDaftar ?? null, namaPengadilan: bersihPa(b.namaPengadilan), biaya: b.biaya ? b.biaya.jumlah : null, terbilang: b.biaya ? teks(b.biaya.terbilang) : "" };
  },
  async satker(db) {
    const s = await bacaSatkerAktif(db).catch(() => null);
    return bersihPa(s?.namaPengadilan);
  },
  async matriks(db, nomor, sebutan) {
    const h = await matriksDalilPerkara(db, nomor, sebutan);
    return h.matriks;
  },
  async pustaka(db, huruf) {
    const out: ButirPustakaA1[] = [];
    for (const h of huruf.split("").filter(Boolean)) {
      const daftar = await cariButir(db, { labelAlasan: h, keadaan: "disahkan" }).catch(() => []);
      for (const b of daftar.slice(0, 2)) if (!out.some((x) => x.id === b.id)) out.push({ id: b.id, teks: b.teks, labelAlasan: b.labelAlasan });
    }
    return out;
  },
};

function polos(html: string): string {
  return String(html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|div)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .trim();
}

const barisBukti = (t: string) =>
  polos(t)
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

/** Pemeriksaan saksi ABT (case.pemeriksaanSaksi) -> saksi A1. Saksi tanpa pihak = pihak pertama (perilaku lama portal). */
export function saksiUntukA1(daftar: SaksiDiperiksa[]): SaksiA1[] {
  const hitung = { P: 0, T: 0 };
  return (Array.isArray(daftar) ? daftar : []).map((s) => {
    const pihak = teks(s.pihak) === "T" ? "T" : "P";
    hitung[pihak] += 1;
    const tj = Array.isArray(s.tanyaJawab) ? (s.tanyaJawab as Array<Record<string, unknown>>) : [];
    return {
      pihak,
      ke: Number(s.saksiKePihak) || hitung[pihak],
      tanyaJawab: tj.map((q) => ({ tanya: teks(q.pertanyaan ?? q.tanya), jawab: teks(q.jawaban ?? q.jawab) })).filter((q) => q.jawab),
    };
  });
}

const MEDIASI: Record<string, MasukanDrafA1["mediasi"]> = { T: "gagal", D: "gagal", S: "sebagian", Y: "berhasil", Y1: "berhasil", Y2: "berhasil" };

export type HasilA1Draf = { per: Partial<Record<StatusVarianH7, DrafPutusanA1>>; kendala: string[]; msBahan: number; msSusun: number };

/**
 * Draf pertimbangan & amar untuk varian-varian draf H-7. `verstek` = perkiraan H-7 (Tergugat/Termohon belum pernah hadir).
 * Tidak melempar: bahan yang gagal dibaca dicatat di `kendala`, draf tetap tersusun dengan tanda.
 */
export async function susunA1UntukDraf(
  db: AletaDatabase,
  m: {
    baris: BarisSidangH7;
    nomorPerkara: string;
    jenisPerkara: string;
    sebutan: { P: string; T: string };
    nilai: NilaiPenanda;
    saksi: SaksiDiperiksa[];
    verstek: boolean;
    varian: StatusVarianH7[];
  },
  sumber: SumberA1 = SUMBER_A1_BAWAAN
): Promise<HasilA1Draf> {
  const kendala: string[] = [];
  const t0 = Date.now();
  const v = (k: string) => (m.nilai[k]?.status === "terisi" ? teks(m.nilai[k]?.teks) : "");
  const sebutanMatriks = { lawan: m.sebutan.P, pelaku: m.sebutan.T };
  const [fakta, satker, matriks] = await Promise.all([
    denganBatas(sumber.fakta(m.nomorPerkara), BATAS_BAHAN_A1_MS, null),
    denganBatas(sumber.satker(db), BATAS_BAHAN_A1_MS, ""),
    denganBatas(sumber.matriks(db, m.nomorPerkara, sebutanMatriks), BATAS_BAHAN_A1_MS * 2, null),
  ]);
  if (!fakta) kendala.push("petitum dan pihak dari SIPP (draf amar)");
  if (!matriks) kendala.push("matriks dalil (draf pertimbangan per dalil)");
  const perkaraId = fakta?.perkaraId ?? (Number(teks(m.baris.perkaraId)) || null);
  const biaya = perkaraId ? await denganBatas(sumber.biaya(perkaraId), BATAS_BAHAN_A1_MS, null) : null;
  const hurufAbt = v("8503");
  const pustaka = await denganBatas(sumber.pustaka(db, (hurufAbt || (matriks?.ringkas?.huruf ?? []).join("")).toUpperCase().replace(/[^A-H]/g, "")), BATAS_BAHAN_A1_MS, [] as ButirPustakaA1[]);
  const msBahan = Date.now() - t0;

  const mediasiKode = teks((m.baris.mediasi as { hasil?: unknown } | null | undefined)?.hasil).toUpperCase();
  const dasar: Omit<MasukanDrafA1, "arah"> = {
    jenisPerkara: m.jenisPerkara,
    nomorPerkara: m.nomorPerkara,
    alurPerkaraId: Number(m.baris.alurPerkaraId) || null,
    jenisPerkaraId: Number(m.baris.jenisPerkaraId) || null,
    verstek: m.verstek,
    sebutan: m.sebutan,
    namaPihak1: fakta?.pihak1 ?? [],
    namaPihak2: fakta?.pihak2 ?? [],
    satker: biaya?.namaPengadilan || satker || "...",
    prodeo: biaya?.prodeo === true || m.baris.penandaPerkara?.prodeo === true,
    biaya: biaya?.biaya ?? null,
    biayaTerbilang: biaya?.terbilang ?? "",
    tahunDaftar: biaya?.tahunDaftar ?? (Number(teks(fakta?.tanggalDaftar).slice(0, 4)) || null),
    petitum: fakta?.petitum ?? "",
    matriks,
    saksi: saksiUntukA1(m.saksi),
    bukti: { P: barisBukti(v("1214")), T: barisBukti(v("9911")) },
    hurufAbt,
    lamaPisah: polos(v("9944")),
    kesimpulan: { P: Boolean(v("8436")), T: Boolean(v("8437")) },
    lewatEcourt: typeof m.baris.lewatEcourt === "boolean" ? m.baris.lewatEcourt : null,
    mediasi: MEDIASI[mediasiKode] ?? "",
    pustaka,
  };
  const t1 = Date.now();
  const per: HasilA1Draf["per"] = {};
  for (const varian of m.varian) {
    const arah: ArahDrafA1 = varian === "ditolak" ? "ditolak" : "dikabulkan";
    try {
      per[varian] = susunDrafPutusanA1({ ...dasar, arah }, bolehDisarankan);
    } catch (e) {
      kendala.push(`draf pertimbangan ${varian} (${teks((e as Error)?.message).slice(0, 80)})`);
    }
  }
  return { per, kendala, msBahan, msSusun: Date.now() - t1 };
}

// ============================================================================
// HAK - hakim, ketua, wakil ketua, Super Admin (sama dengan fitur putusan C1-C4)
// ============================================================================

type AktorHak = { roleId?: unknown; additionalRoleIds?: unknown } & Parameters<typeof getEffectiveRoleId>[0];

export function bolehDrafPutusanA1(aktor: AktorHak | null | undefined): boolean {
  if (!aktor) return false;
  const tambahan = Array.isArray(aktor.additionalRoleIds) ? (aktor.additionalRoleIds as unknown[]).map(teks) : [];
  const peran = [teks(getEffectiveRoleId(aktor)), teks(aktor.roleId), ...tambahan].filter(Boolean);
  if (peran.includes("super-admin")) return true;
  return peran.some((p) => (PERAN_HAKIM_ADVANCE as readonly string[]).includes(p));
}

/** Draf H-7 tanpa bagian draf pertimbangan & amar (untuk akun selain hakim/ketua/wakil/Super Admin). */
export function tanpaDrafPutusan(d: DrafH7): DrafH7 {
  if (!d.putusan && !(d.varian ?? []).some((x) => x.putusan)) return d;
  const { putusan: _p, ...sisa } = d;
  void _p;
  return { ...sisa, varian: (d.varian ?? []).map((x) => ({ ...x, putusan: undefined })) };
}
