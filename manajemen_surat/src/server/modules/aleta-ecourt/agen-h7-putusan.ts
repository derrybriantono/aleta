import {
  HARI_H7,
  alasanH7,
  golongkanIsian,
  jendelaH7,
  nilaiKesiapanH7,
  pilihBlangkoH7,
  ringkasDrafH7,
  ringkasOtomatis,
  susunRingkasan,
  tambahHari,
  susunDrafSaya,
  untukChecklistH7,
  usulanDariKtp,
  varianTolakBerbeda,
  type BarisSidangH7,
  type PilihanBlangkoH7,
  type VarianDrafH7,
  type DrafH7Checklist,
  type KtpPihak,
  type DokumenEcourt,
  type DrafH7,
  type NilaiPenanda,
  type RiwayatSidang,
  type RingkasDrafH7,
  type SaksiDiperiksa,
  type UsulanDeteksi,
} from "@/lib/agen-h7-putusan";
import { VAR_BUKTI, VAR_ECOURT, VAR_KUASA } from "@/lib/isi-sipp-format";
import { namaAdaDi } from "@/lib/perkara-sendiri";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import { sebutanPihak, susunIsian, type Definisi, type Susunan } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import type { AletaDatabase } from "@/server/db/client";
import { getGatewayAbtUsulan, getGatewayJadwalSidang, getGatewayKtpPerkara } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { untukBot } from "@/server/modules/aleta-ecourt/tipe-keluaran";
import { bacaKonseptorSementara } from "@/server/modules/aleta-ecourt/konseptor-sementara";
import { bacaGugatanEcourt, bacaKuasaEcourt } from "@/server/modules/aleta-ecourt/isi-sipp-sumber";

/**
 * ============================================================================
 * AGEN H-7 DRAF PUTUSAN (F4.2) - PENGUMPUL BAHAN, PENYIMPAN, PENJADWAL
 * ============================================================================
 *
 * Aturannya di @/lib/agen-h7-putusan (murni, diuji). Modul ini:
 *   - mengumpulkan bahan tiap perkara lewat jembatan bot - SEMUANYA BACA SAJA:
 *     jadwal sidang, blangko Derry (blangko.baca), katalog variabel ABT,
 *     nilai penanda (mesin variabel ABT), deteksi usulan (/abt/usulan - jalur
 *     yang sama dengan panel ABT, tanpa AI), riwayat sidang, pemeriksaan
 *     saksi ABT, dokumen e-Court;
 *   - menyimpan draf di basis data ALETA (0068) - SIPP dan ABT tidak pernah
 *     ditulis; tidak ada AI eksternal yang dipanggil;
 *   - menjalankan diri sekali sehari (bawaan 06.00 WITA) dari
 *     instrumentation.ts, dimatikan dengan ALETA_AGEN_H7=0.
 */

const teks = (x: unknown) => String(x ?? "").trim();
const AKAR_DERRY = "derry_briantono";
/** Batas perkara per jalan - satu pagi tidak boleh menahan jembatan bot terlalu lama. */
const BATAS_PERKARA = 60;
const UMUR_KATALOG_MS = 30 * 60 * 1000;
/** Penanda yang selalu dinilai: keterangan saksi, tanggal sidang, sebutan pihak, posita, bukti, kesimpulan. */
const PENANDA_BAHAN = ["2021", "2022", "0033", "0046", "0047", "5125", "1214", "9911", "8436", "8437", "8503"];

// ============================================================================
// SUMBER BAHAN (dapat disuntik untuk uji)
// ============================================================================

export type SumberAgenH7 = {
  jadwal(dari: string, sampai: string): Promise<{ ok: boolean; sidang: BarisSidangH7[]; galat: string }>;
  bacaBlangko(folder: string, berkas: string): Promise<{ ada: boolean; penanda: string[]; sebab: string }>;
  katalog(db: AletaDatabase): Promise<Map<string, Definisi>>;
  nilaiPenanda(perkaraId: string, kode: string[]): Promise<{ ada: boolean; nilai: NilaiPenanda; sebab: string }>;
  usulan(db: AletaDatabase, muatan: Parameters<typeof getGatewayAbtUsulan>[0]): Promise<{ ok: boolean; jalur: Array<{ jalur: string; usulan: UsulanDeteksi[] }>; galat: string }>;
  riwayat(perkaraId: string): Promise<RiwayatSidang[]>;
  saksi(perkaraId: string): Promise<SaksiDiperiksa[]>;
  dokumen(perkaraId: string): Promise<DokumenEcourt[]>;
  /** Tanggal KTP pihak yang sudah dibaca ALETA dari berkas KTP e-Court (tidak memicu pembacaan baru). */
  ktp(nomorPerkara: string): Promise<KtpPihak[]>;
  /**
   * 19 Okt: usulan dari surat gugatan di arsip e-Court (rute isi-gugatan yang sama dengan Isi dari SIPP di Blangko Derry).
   * Opsional: sumber suntikan uji lama tidak memilikinya.
   */
  gugatan?(nomorPerkara: string, sebutan: { lawan: string; pelaku: string }, denganBukti: boolean): Promise<UsulanDeteksi[]>;
  /** 19 Okt: usulan kuasa dari surat gugatan (rute kuasa-gugatan yang sama). */
  kuasa?(nomorPerkara: string): Promise<UsulanDeteksi[]>;
};

let singgahKatalog: { saat: number; peta: Map<string, Definisi> } | null = null;

async function katalogBawaan(db: AletaDatabase): Promise<Map<string, Definisi>> {
  if (singgahKatalog && Date.now() - singgahKatalog.saat < UMUR_KATALOG_MS) return singgahKatalog.peta;
  const peta = new Map<string, Definisi>();
  type Jawab = { ada?: boolean; variabel?: Array<{ noVar?: unknown; nama?: unknown; jenis?: unknown; sqlQuery?: unknown; defaultData?: unknown }> };
  try {
    const j = await callAletaBotSippBridge<Jawab>("abt.semuaVariabel", {}, { timeoutMs: 20000 });
    if (j.ok && j.data?.ada && Array.isArray(j.data.variabel)) {
      for (const v of j.data.variabel) {
        const kode = teks(v.noVar);
        if (kode) peta.set(kode, { kode, nama: teks(v.nama), jenis: teks(v.jenis), sql: String(v.sqlQuery ?? ""), bawaan: String(v.defaultData ?? "") });
      }
    }
  } catch {
    /* salinan kamus di bawah */
  }
  if (!peta.size) {
    try {
      const baris = await db.queryAll<Record<string, unknown>>(`SELECT no_var, nama, jenis, sql_query, default_data FROM aleta_kamus_variabel`);
      for (const b of baris) {
        const kode = teks(b.no_var);
        if (kode) peta.set(kode, { kode, nama: teks(b.nama), jenis: teks(b.jenis), sql: String(b.sql_query ?? ""), bawaan: String(b.default_data ?? "") });
      }
    } catch {
      /* kamus belum disalin */
    }
  }
  if (peta.size) singgahKatalog = { saat: Date.now(), peta };
  return peta;
}

async function jembatan<T>(operasi: string, params: Record<string, unknown>, timeoutMs = 20000): Promise<T | null> {
  try {
    const j = await callAletaBotSippBridge<T>(operasi, params, { timeoutMs });
    return j.ok ? ((j.data ?? null) as T | null) : null;
  } catch {
    return null;
  }
}

export const SUMBER_BAWAAN: SumberAgenH7 = {
  async jadwal(dari, sampai) {
    const h = await getGatewayJadwalSidang({ dari, sampai, cari: "", batas: 400 });
    if (!h.ok) return { ok: false, sidang: [], galat: teks(h.error) || "ALETA Bot tidak menjawab." };
    return { ok: true, sidang: (h.data?.sidang ?? []) as unknown as BarisSidangH7[], galat: "" };
  },
  async bacaBlangko(folder, berkas) {
    const j = await jembatan<{ ada?: boolean; sebab?: string; penanda?: string[] }>("blangko.baca", { folder, berkas }, 20000);
    if (!j?.ada) return { ada: false, penanda: [], sebab: teks(j?.sebab) || "Blangko tidak terbaca di server." };
    return { ada: true, penanda: (j.penanda ?? []).map(teks).filter((x) => /^\d{3,5}$/.test(x)), sebab: "" };
  },
  katalog: katalogBawaan,
  async nilaiPenanda(perkaraId, kode) {
    const daftar = [...new Set(kode)].slice(0, 600);
    type Jawab = { ok?: boolean; nilai?: Record<string, { status?: string; teks?: string; nama?: string; sebab?: string }> };
    try {
      const j = await callAletaBotSippBridge<Jawab>("abt.nilaiPenanda", { perkaraId, sidangKe: 0, penanda: daftar }, { timeoutMs: 90000 });
      if (!j.ok || !j.data?.ok) return { ada: false, nilai: {}, sebab: j.ok ? "Mesin variabel ABT tidak memulangkan nilai." : teks(j.error) };
      return { ada: true, nilai: j.data.nilai ?? {}, sebab: "" };
    } catch (e) {
      return { ada: false, nilai: {}, sebab: teks((e as Error)?.message) || "Bot ALETA tidak menjawab." };
    }
  },
  async usulan(db, muatan) {
    let tipeKeluaran: { versi: string; daftar: Record<string, unknown> } | undefined;
    try {
      const efektif = await untukBot(db);
      if (efektif.asal === "basis-data") tipeKeluaran = { versi: efektif.versi, daftar: efektif.daftar as unknown as Record<string, unknown> };
    } catch {
      /* kalimat tertanam bot */
    }
    const h = await getGatewayAbtUsulan({ ...muatan, tipeKeluaran });
    if (!h.ok) return { ok: false, jalur: [], galat: teks(h.error) || "ALETA Bot tidak menjawab." };
    const d = (h.data ?? {}) as Record<string, unknown>;
    const ambil = (x: unknown) => (x && typeof x === "object" && Array.isArray((x as { usulan?: unknown }).usulan) ? ((x as { usulan: UsulanDeteksi[] }).usulan) : []);
    return {
      ok: true,
      galat: "",
      jalur: [
        { jalur: "sipp", usulan: ambil(d.sipp) },
        { jalur: "saksi", usulan: ambil(d.saksi) },
        { jalur: "itsbat", usulan: ambil(d.itsbat) },
        { jalur: "posita-lain", usulan: ambil(d.positaLain) },
      ].filter((x) => x.usulan.length),
    };
  },
  async riwayat(perkaraId) {
    const j = await jembatan<RiwayatSidang[]>("case.schedule", { perkaraId }, 15000);
    return Array.isArray(j) ? j : [];
  },
  async saksi(perkaraId) {
    const j = await jembatan<{ saksi?: SaksiDiperiksa[] }>("case.pemeriksaanSaksi", { perkaraId }, 15000);
    return Array.isArray(j?.saksi) ? j!.saksi! : [];
  },
  async dokumen(perkaraId) {
    const j = await jembatan<{ dokumen?: DokumenEcourt[] }>("ecourt.dokumenPerkara", { perkaraId }, 15000);
    return Array.isArray(j?.dokumen) ? j!.dokumen! : [];
  },
  async ktp(nomorPerkara) {
    try {
      const h = await getGatewayKtpPerkara(nomorPerkara);
      return h.ok && Array.isArray(h.data?.pihak) ? (h.data.pihak as KtpPihak[]) : [];
    } catch {
      return [];
    }
  },
  async gugatan(nomorPerkara, sebutan, denganBukti) {
    const h = await bacaGugatanEcourt(nomorPerkara, sebutan, undefined, { denganBukti });
    return Array.isArray(h.usulan) ? (h.usulan as unknown as UsulanDeteksi[]) : [];
  },
  async kuasa(nomorPerkara) {
    const h = await bacaKuasaEcourt(nomorPerkara);
    return Array.isArray(h.usulan) ? (h.usulan as unknown as UsulanDeteksi[]) : [];
  },
};

// ============================================================================
// SATU PERKARA
// ============================================================================

function polosTeks(html: string): string {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

const jenisCerai = (j: string) => /cerai/i.test(j);
const jenisItsbat = (j: string) => /it?s?bat|isbat|istbat/i.test(j);
const daftarNama = (x: unknown) => (Array.isArray(x) ? x.map(teks).filter(Boolean) : []);

/**
 * Menyusun draf H-7 satu sidang. Tiap bahan gagal sendiri-sendiri: yang tidak
 * terbaca dicatat di `kendala`, drafnya tetap tersusun dari yang ada.
 */
export async function susunDrafSatu(
  db: AletaDatabase,
  baris: BarisSidangH7,
  sumber: SumberAgenH7 = SUMBER_BAWAAN,
  kini: Date = new Date(),
  opsi: { verstek?: boolean } = {}
): Promise<DrafH7 | null> {
  const alasan = alasanH7(baris, opsi);
  if (!alasan) return null;
  const perkaraId = teks(baris.perkaraId);
  const nomorPerkara = teks(baris.nomorPerkara);
  const jenisPerkara = teks(baris.jenisPerkara);
  const tanggalSidang = teks(baris.tanggalSidang).slice(0, 10);
  const kendala: string[] = [];
  const blangko = pilihBlangkoH7(baris, alasan);
  // Varian tolak (keputusan 17 Okt butir 54): disiapkan bila blangko tolaknya ada dan berbeda.
  const blangkoTolak = pilihBlangkoH7(baris, alasan, "ditolak");
  const adaTolak = varianTolakBerbeda(blangko, blangkoTolak);
  const sebutan = sebutanPihak(jenisPerkara, nomorPerkara);

  // Blangko Derry -> isian tangan sungguhan.
  const KOSONG: Susunan = { penanda: [], isian: [], pemicu: [], otomatis: [], takDikenal: [] };
  const susunUntuk = async (pilihan: PilihanBlangkoH7): Promise<Susunan> => {
    const u = pilihan.utama;
    if (!u) return KOSONG;
    const b = await sumber.bacaBlangko(u.folder.startsWith(AKAR_DERRY) ? u.folder : `${AKAR_DERRY}/${u.folder}`, u.berkas);
    if (!b.ada) {
      kendala.push(`blangko ${u.label} (${b.sebab})`);
      return KOSONG;
    }
    const katalog = await sumber.katalog(db);
    if (katalog.size) return susunIsian(b.penanda, katalog, sebutan);
    if (!kendala.includes("katalog variabel ABT")) kendala.push("katalog variabel ABT");
    return KOSONG;
  };
  const susunan = await susunUntuk(blangko);
  const susunanTolak = adaTolak ? await susunUntuk(blangkoTolak) : KOSONG;

  // Nilai ABT/SIPP untuk seluruh penanda kedua blangko + bahan ringkasan (satu permintaan).
  const kode = [
    ...new Set(
      [susunan, susunanTolak].flatMap((s) => [
        ...s.isian.map((i) => i.kode),
        ...s.pemicu.map((p) => p.kode),
        ...s.otomatis.filter((o) => o.langsung).map((o) => o.kode),
      ]).concat(PENANDA_BAHAN)
    ),
  ];
  const nilaiHasil = /^\d+$/.test(perkaraId) ? await sumber.nilaiPenanda(perkaraId, kode) : { ada: false, nilai: {}, sebab: "nomor perkara SIPP tidak dikenal" };
  if (!nilaiHasil.ada) kendala.push(`nilai isian ABT (${nilaiHasil.sebab || "tidak terbaca"})`);
  const nilai = nilaiHasil.nilai;
  const v = (k: string) => (nilai[k]?.status === "terisi" ? teks(nilai[k]?.teks) : "");

  // Deteksi ALETA - jalur yang sama dengan panel ABT ("Isi dari SIPP"), tanpa AI.
  const usulan: Array<{ jalur: string; usulan: UsulanDeteksi }> = [];
  if ((susunan.isian.length || susunanTolak.isian.length) && nomorPerkara) {
    const posita = polosTeks(v("5125")).slice(0, 20000);
    const tambah = (h: Awaited<ReturnType<SumberAgenH7["usulan"]>>) => {
      if (!h.ok) kendala.push(`deteksi ALETA (${h.galat})`);
      for (const j of h.jalur) for (const u of j.usulan) usulan.push({ jalur: j.jalur, usulan: u });
    };
    tambah(await sumber.usulan(db, { nomorPerkara, sumber: "sipp" }));
    for (const u of usulanDariKtp(await sumber.ktp(nomorPerkara))) usulan.push({ jalur: "ktp", usulan: u });
    // Berkas e-Court (gugatan dan kuasa): sama dengan mesin bersama Isi dari SIPP - hanya dibaca bila blangko memuat variabelnya.
    const kodeAda = new Set([...susunan.isian, ...susunanTolak.isian].map((i) => i.kode).concat([...susunan.pemicu, ...susunanTolak.pemicu].map((p) => p.kode)));
    if (baris.lewatEcourt !== false && sumber.gugatan && VAR_ECOURT.some((k) => kodeAda.has(k))) {
      try {
        const daftar = await sumber.gugatan(nomorPerkara, { lawan: sebutan.P, pelaku: sebutan.T }, VAR_BUKTI.some((k) => kodeAda.has(k)));
        for (const u of daftar) usulan.push({ jalur: "gugatan", usulan: u });
      } catch (e) {
        kendala.push(`berkas e-Court (${teks((e as Error)?.message).slice(0, 80) || "tidak terbaca"})`);
      }
    }
    if (baris.lewatEcourt !== false && sumber.kuasa && VAR_KUASA.some((k) => kodeAda.has(k))) {
      try {
        for (const u of await sumber.kuasa(nomorPerkara)) usulan.push({ jalur: "kuasa", usulan: u });
      } catch (e) {
        kendala.push(`kuasa dari gugatan (${teks((e as Error)?.message).slice(0, 80) || "tidak terbaca"})`);
      }
    }
    if (jenisCerai(jenisPerkara)) {
      const saksi1 = polosTeks(v("2021"));
      const saksi2 = polosTeks(v("2022"));
      if (saksi1 || saksi2) {
        tambah(
          await sumber.usulan(db, {
            nomorPerkara,
            sumber: "saksi",
            saksi1: saksi1.slice(0, 20000),
            saksi2: saksi2.slice(0, 20000),
            // Lama pisah dihitung sampai Hari Putusan, bukan sampai hari ini.
            tanggalSidang: (() => {
              const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tanggalSidang);
              return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
            })(),
            pelaku: polosTeks(v("0047")).slice(0, 40) || sebutan.T,
            lawan: polosTeks(v("0046")).slice(0, 40) || sebutan.P,
            posita,
          })
        );
      }
    } else if (jenisItsbat(jenisPerkara)) {
      tambah(await sumber.usulan(db, { nomorPerkara, sumber: "itsbat", posita, pemohon: polosTeks(v("0046")).slice(0, 40) || sebutan.P, jenisPerkara }));
    } else {
      tambah(await sumber.usulan(db, { nomorPerkara, sumber: "posita-lain", posita, jenisPerkara, pelaku: sebutan.T, lawan: sebutan.P }));
    }
  }

  const perkara = {
    prodeo: baris.penandaPerkara?.prodeo === true,
    ghaib: baris.penandaPerkara?.ghaib === true,
    lewatEcourt: typeof baris.lewatEcourt === "boolean" ? baris.lewatEcourt : null,
  };
  const isian = golongkanIsian({ susunan, nilai, usulan, perkara });
  const otomatis = susunan.otomatis.length && nilaiHasil.ada ? ringkasOtomatis(susunan, nilai) : null;
  const varian: VarianDrafH7[] = [];
  if (adaTolak) {
    const isianTolak = golongkanIsian({ susunan: susunanTolak, nilai, usulan, perkara });
    const otomatisTolak = susunanTolak.otomatis.length && nilaiHasil.ada ? ringkasOtomatis(susunanTolak, nilai) : null;
    varian.push({
      status: "ditolak",
      blangko: blangkoTolak,
      isian: isianTolak,
      otomatis: otomatisTolak,
      kesiapan: nilaiKesiapanH7(isianTolak, otomatisTolak, susunanTolak.isian.length + susunanTolak.otomatis.length > 0),
    });
  }

  const [riwayat, saksi, dokumen] = /^\d+$/.test(perkaraId)
    ? await Promise.all([sumber.riwayat(perkaraId), sumber.saksi(perkaraId), perkara.lewatEcourt === false ? Promise.resolve([]) : sumber.dokumen(perkaraId)])
    : [[], [], []];
  const ringkasan = susunRingkasan({
    nilai,
    riwayat: riwayat.filter((r) => teks(r.tanggalSidang).slice(0, 10) <= tanggalSidang),
    saksi,
    dokumen,
    namaSaksi: { P: daftarNama(baris.saksiNamaPihak1), T: daftarNama(baris.saksiNamaPihak2) },
    sebutan: { P: sebutan.P, T: sebutan.T },
  });

  return {
    perkaraId,
    nomorPerkara,
    jenisPerkara,
    tanggalSidang,
    agenda: teks(baris.agenda),
    alasan,
    majelis: teks(baris.majelisNama),
    panitera: teks(baris.paniteraNama),
    blangko,
    isian,
    otomatis,
    ringkasan,
    kesiapan: nilaiKesiapanH7(isian, otomatis, Boolean(blangko.utama) && susunan.isian.length + susunan.otomatis.length > 0),
    varian,
    kendala,
    dibuatPada: kini.toISOString(),
  };
}

// ============================================================================
// PENYIMPANAN (0068)
// ============================================================================

async function simpanDraf(db: AletaDatabase, d: DrafH7, jalanId: string): Promise<"dibuat" | "diperbarui"> {
  const ringkas = ringkasDrafH7(d);
  const lama = await db.queryOne<Record<string, unknown>>(
    `SELECT dibuat_pada FROM aleta_agen_h7_draf WHERE perkara_id = ? AND tanggal_sidang = ?`,
    [d.perkaraId, d.tanggalSidang]
  );
  const nilai = [
    d.nomorPerkara.slice(0, 100),
    d.jenisPerkara.slice(0, 200),
    d.alasan,
    d.kesiapan.tingkat,
    d.kesiapan.persen,
    JSON.stringify(ringkas),
    JSON.stringify(d),
    d.dibuatPada,
    jalanId,
  ];
  if (lama) {
    await db.run(
      `UPDATE aleta_agen_h7_draf SET nomor_perkara = ?, jenis_perkara = ?, alasan = ?, tingkat = ?, persen = ?, ringkas_json = ?, draf_json = ?, diperbarui_pada = ?, jalan_id = ?
        WHERE perkara_id = ? AND tanggal_sidang = ?`,
      [...nilai, d.perkaraId, d.tanggalSidang]
    );
    return "diperbarui";
  }
  await db.run(
    `INSERT INTO aleta_agen_h7_draf (nomor_perkara, jenis_perkara, alasan, tingkat, persen, ringkas_json, draf_json, diperbarui_pada, jalan_id, perkara_id, tanggal_sidang, dibuat_pada)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [...nilai, d.perkaraId, d.tanggalSidang, d.dibuatPada]
  );
  return "dibuat";
}

function urai<T>(json: unknown, cadangan: T): T {
  try {
    return JSON.parse(String(json ?? "")) as T;
  } catch {
    return cadangan;
  }
}

/** Draf terbaru (Hari Putusan paling dekat ke depan, lalu yang terakhir) per perkara. */
async function bacaBaris(db: AletaDatabase, perkaraIds: string[], kolom: string) {
  const daftar = [...new Set(perkaraIds.map(teks).filter(Boolean))].slice(0, 500);
  if (!daftar.length) return new Map<string, Record<string, unknown>>();
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT perkara_id, tanggal_sidang, ${kolom} FROM aleta_agen_h7_draf WHERE perkara_id IN (${daftar.map(() => "?").join(", ")})`,
    daftar
  );
  const hariIni = waktuPengadilan().tanggal;
  const peta = new Map<string, Record<string, unknown>>();
  const nilai = (t: string) => (t >= hariIni ? `0${t}` : `1${String(99999999 - Number(t.replace(/-/g, "")))}`);
  for (const b of baris) {
    const pid = teks(b.perkara_id);
    const lama = peta.get(pid);
    if (!lama || nilai(teks(b.tanggal_sidang)) < nilai(teks(lama.tanggal_sidang))) peta.set(pid, b);
  }
  return peta;
}

export async function bacaRingkasDrafH7(db: AletaDatabase, perkaraIds: string[]): Promise<Record<string, RingkasDrafH7>> {
  const peta = await bacaBaris(db, perkaraIds, "ringkas_json");
  const hasil: Record<string, RingkasDrafH7> = {};
  for (const [pid, b] of peta) {
    const r = urai<RingkasDrafH7 | null>(b.ringkas_json, null);
    if (r) hasil[pid] = r;
  }
  return hasil;
}

export async function bacaDrafH7(db: AletaDatabase, perkaraIds: string[]): Promise<Record<string, DrafH7>> {
  const peta = await bacaBaris(db, perkaraIds, "draf_json");
  const hasil: Record<string, DrafH7> = {};
  for (const [pid, b] of peta) {
    const d = urai<DrafH7 | null>(b.draf_json, null);
    if (d) hasil[pid] = d;
  }
  return hasil;
}

/** Bahan kartu checklist konseptor (F1.6) per perkara. */
export async function bacaDrafRingkasUntukChecklist(db: AletaDatabase, perkaraIds: string[]): Promise<Record<string, DrafH7Checklist>> {
  const draf = await bacaDrafH7(db, perkaraIds);
  return Object.fromEntries(Object.entries(draf).map(([pid, d]) => [pid, untukChecklistH7(d)]));
}

/**
 * Widget ALETA: draf H-7 milik akun (majelis, PP, konseptor sementara; Admin:
 * semua) dengan Hari Putusan hari ini s.d. tujuh hari lagi. Baca saja.
 */
export async function bacaDrafSaya(db: AletaDatabase, opsi: { nama: string; lihatSemua: boolean; hariIni?: string }) {
  const hariIni = opsi.hariIni || waktuPengadilan().tanggal;
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT perkara_id, draf_json FROM aleta_agen_h7_draf WHERE tanggal_sidang >= ? AND tanggal_sidang <= ?`,
    [hariIni, tambahHari(hariIni, HARI_H7)]
  );
  const draf = baris.map((b) => urai<DrafH7 | null>(b.draf_json, null)).filter((d): d is DrafH7 => Boolean(d));
  let konseptor: Record<string, { nama?: string }> = {};
  try {
    konseptor = await bacaKonseptorSementara(db, draf.map((d) => d.perkaraId));
  } catch {
    konseptor = {};
  }
  return {
    hariIni,
    ...susunDrafSaya(
      draf.map((d) => ({ draf: d, konseptor: teks(konseptor[d.perkaraId]?.nama) })),
      { hariIni, nama: opsi.nama, lihatSemua: opsi.lihatSemua, cocokNama: namaAdaDi }
    ),
  };
}

export type JalanAgenH7 = {
  id: string;
  tanggal: string;
  pemicu: string;
  oleh: string;
  mulai: string;
  selesai: string;
  diperiksa: number;
  dibuat: number;
  diperbarui: number;
  gagal: number;
  galat: string;
};

export async function bacaJalanTerakhir(db: AletaDatabase, batas = 10): Promise<JalanAgenH7[]> {
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT id, tanggal, pemicu, oleh, mulai, selesai, diperiksa, dibuat, diperbarui, gagal, galat FROM aleta_agen_h7_jalan ORDER BY mulai DESC LIMIT ${Math.max(1, Math.min(50, Math.floor(batas)))}`
  );
  return baris.map((b) => ({
    id: teks(b.id),
    tanggal: teks(b.tanggal),
    pemicu: teks(b.pemicu),
    oleh: teks(b.oleh),
    mulai: teks(b.mulai),
    selesai: teks(b.selesai),
    diperiksa: Number(b.diperiksa) || 0,
    dibuat: Number(b.dibuat) || 0,
    diperbarui: Number(b.diperbarui) || 0,
    gagal: Number(b.gagal) || 0,
    galat: teks(b.galat),
  }));
}

// ============================================================================
// SATU JALAN
// ============================================================================

const SIMPAN = globalThis as unknown as { __aletaAgenH7?: { berjalan: boolean; detak: NodeJS.Timeout | null } };
const wadah = () => (SIMPAN.__aletaAgenH7 ??= { berjalan: false, detak: null });

export type HasilJalan = JalanAgenH7 & { perkara: Array<{ perkaraId: string; nomorPerkara: string; tanggalSidang: string; hasil: string }> };

/**
 * Memeriksa jadwal hari ini+1 sampai hari ini+7 (WITA): sidang Hari Putusan
 * tepat tujuh hari lagi DIBUATKAN draf, yang lebih dekat DIPERBARUI (isian ABT
 * bertambah dari hari ke hari - laporannya ikut berubah).
 */
export async function jalankanAgenH7(
  db: AletaDatabase,
  opsi: { pemicu: "jadwal" | "tangan"; oleh?: string; hariIni?: string; sumber?: SumberAgenH7; kini?: Date; verstek?: boolean } = { pemicu: "jadwal" }
): Promise<HasilJalan> {
  const w = wadah();
  const kini = opsi.kini ?? new Date();
  const hariIni = opsi.hariIni || waktuPengadilan(kini).tanggal;
  const sumber = opsi.sumber ?? SUMBER_BAWAAN;
  const pilihan = { verstek: opsi.verstek ?? process.env.ALETA_AGEN_H7_VERSTEK !== "0" };
  const jalan: HasilJalan = {
    id: `h7_${kini.getTime().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    tanggal: hariIni,
    pemicu: opsi.pemicu,
    oleh: teks(opsi.oleh) || "Agen ALETA",
    mulai: kini.toISOString(),
    selesai: "",
    diperiksa: 0,
    dibuat: 0,
    diperbarui: 0,
    gagal: 0,
    galat: "",
    perkara: [],
  };
  if (w.berjalan) return { ...jalan, galat: "Agen H-7 sedang berjalan." };
  w.berjalan = true;
  try {
    await db.run(
      `INSERT INTO aleta_agen_h7_jalan (id, tanggal, pemicu, oleh, mulai, selesai, diperiksa, dibuat, diperbarui, gagal, galat) VALUES (?, ?, ?, ?, ?, '', 0, 0, 0, 0, '')`,
      [jalan.id, jalan.tanggal, jalan.pemicu, jalan.oleh, jalan.mulai]
    );
    const j = await sumber.jadwal(tambahHari(hariIni, 1), tambahHari(hariIni, HARI_H7));
    if (!j.ok) jalan.galat = `Jadwal sidang tidak terbaca: ${j.galat}`;
    const sasaran = j.sidang
      .filter((b) => alasanH7(b, pilihan) && jendelaH7(hariIni, teks(b.tanggalSidang)))
      // Yang tepat H-7 dulu (dibuat), lalu yang paling dekat Hari Putusan-nya.
      .sort((a, b) => {
        const ja = jendelaH7(hariIni, teks(a.tanggalSidang)) === "dibuat" ? 0 : 1;
        const jb = jendelaH7(hariIni, teks(b.tanggalSidang)) === "dibuat" ? 0 : 1;
        return ja - jb || teks(a.tanggalSidang).localeCompare(teks(b.tanggalSidang));
      });
    const lihat = new Set<string>();
    for (const b of sasaran) {
      const kunci = `${teks(b.perkaraId)}|${teks(b.tanggalSidang).slice(0, 10)}`;
      if (lihat.has(kunci)) continue;
      lihat.add(kunci);
      if (jalan.diperiksa >= BATAS_PERKARA) break;
      jalan.diperiksa += 1;
      const ringkas = { perkaraId: teks(b.perkaraId), nomorPerkara: teks(b.nomorPerkara), tanggalSidang: teks(b.tanggalSidang).slice(0, 10), hasil: "" };
      try {
        const d = await susunDrafSatu(db, b, sumber, new Date(), pilihan);
        if (!d) continue;
        const hasil = await simpanDraf(db, d, jalan.id);
        if (hasil === "dibuat") jalan.dibuat += 1;
        else jalan.diperbarui += 1;
        ringkas.hasil = `${hasil} - ${d.kesiapan.tingkat} ${d.kesiapan.persen}%`;
      } catch (e) {
        jalan.gagal += 1;
        ringkas.hasil = `gagal: ${teks((e as Error)?.message).slice(0, 160)}`;
      }
      jalan.perkara.push(ringkas);
    }
  } catch (e) {
    jalan.galat = teks((e as Error)?.message).slice(0, 300) || "Agen H-7 gagal.";
  } finally {
    jalan.selesai = new Date().toISOString();
    try {
      await db.run(
        `UPDATE aleta_agen_h7_jalan SET selesai = ?, diperiksa = ?, dibuat = ?, diperbarui = ?, gagal = ?, galat = ? WHERE id = ?`,
        [jalan.selesai, jalan.diperiksa, jalan.dibuat, jalan.diperbarui, jalan.gagal, jalan.galat.slice(0, 500), jalan.id]
      );
    } catch {
      /* catatan jalan gagal ditulis - drafnya tetap tersimpan */
    }
    w.berjalan = false;
  }
  return jalan;
}

// ============================================================================
// PENJADWAL HARIAN
// ============================================================================

/** Jam jalan harian (WITA) dari env ALETA_AGEN_H7_JAM "HH:MM", bawaan 06:00. */
export function jamAgenH7(env: Record<string, string | undefined> = process.env): string {
  const j = teks(env.ALETA_AGEN_H7_JAM);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(j) ? j : "06:00";
}

/** Sudah waktunya jalan hari ini dan belum ada jalan terjadwal hari ini? (murni atas masukan) */
export function agenH7JatuhTempo(jam: string, kini: Date, sudahJalanHariIni: boolean): boolean {
  if (sudahJalanHariIni) return false;
  return waktuPengadilan(kini).jam.slice(0, 5) >= jam;
}

export async function detakAgenH7(db: AletaDatabase, env: Record<string, string | undefined> = process.env, kini = new Date()) {
  if (env.ALETA_AGEN_H7 === "0") return null;
  const hariIni = waktuPengadilan(kini).tanggal;
  const ada = await db.queryOne<Record<string, unknown>>(
    `SELECT id FROM aleta_agen_h7_jalan WHERE tanggal = ? AND pemicu = 'jadwal' LIMIT 1`,
    [hariIni]
  );
  if (!agenH7JatuhTempo(jamAgenH7(env), kini, Boolean(ada))) return null;
  return jalankanAgenH7(db, { pemicu: "jadwal", kini, verstek: env.ALETA_AGEN_H7_VERSTEK !== "0" });
}

/** Dinyalakan instrumentation.ts: detak 10 menit, jalan sekali sehari sesudah jamnya. */
export function mulaiAgenH7Berkala(getDb: () => Promise<AletaDatabase>, env: Record<string, string | undefined> = process.env) {
  if (env.ALETA_AGEN_H7 === "0") return;
  const w = wadah();
  if (w.detak) return;
  const detak = async () => {
    try {
      await detakAgenH7(await getDb(), env);
    } catch (e) {
      console.error("[AGEN H-7] detak gagal:", e);
    }
  };
  w.detak = setInterval(() => void detak(), 10 * 60 * 1000);
  // Detak pertama sesudah portal tenang (dua menit), bukan saat berdiri.
  setTimeout(() => void detak(), 2 * 60 * 1000);
}
