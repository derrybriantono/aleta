/**
 * ============================================================================
 * PERKARA SAYA - DAFTAR PERKARA MILIK AKUN UNTUK "BLANGKO ABT BY DERRY BRIANTONO"
 * ============================================================================
 *
 * Tahap D (16 Okt 2026). Fungsi di berkas ini MURNI - tanpa jaringan, tanpa
 * basis data - supaya aturannya diuji langsung.
 *
 * Bahannya baris jadwal sidang bot (SidangBaris), satu baris per SIDANG. Yang
 * dihasilkan satu baris per PERKARA, dengan seluruh sidang yang terbaca di
 * rentang itu terlampir:
 *
 *   hakim            perkara yang namanya ada di majelisNama
 *   panitera pengganti  ... di paniteraNama
 *   juru sita        ... di jurusitaNama
 *   super admin/admin   semua perkara; dapat melihat sebagai satu akun saja
 *
 * ============================================================================
 * PENCOCOKAN NAMA - ATURAN YANG SAMA DENGAN LAYAR JADWAL SIDANG
 * ============================================================================
 *
 * SIPP tidak mengirim nomor pegawai; yang ada hanya NAMA sebagai tulisan.
 * Pencocokan memakai namaAdaDi (lib/perkara-sendiri) - gelar dibuang, dua
 * orang berbeda tidak saling terbawa. Berbeda dari layar jadwal yang
 * gagal-TERBUKA (daftar penuh bila tak satu pun cocok), di sini gagalnya
 * TERTUTUP: "perkara milik akun" yang diam-diam berisi perkara orang lain
 * lebih menyesatkan daripada daftar kosong. Daftar kosong disertai
 * `adaYangCocok: false` supaya layar dapat mengatakan sebabnya.
 *
 * ============================================================================
 * BACA SAJA
 * ============================================================================
 *
 * Tidak ada yang ditulis ke SIPP, ABT, maupun ALETA oleh apa pun di sini.
 */
import { namaAdaDi, pecahNamaPetugas } from "@/lib/perkara-sendiri";

export type PeranDerry = "hakim" | "pp" | "js";

/** Ruas jadwal bot menurut peran Derry. */
export const RUAS_PERAN: Record<PeranDerry, "majelisNama" | "paniteraNama" | "jurusitaNama"> = {
  hakim: "majelisNama",
  pp: "paniteraNama",
  js: "jurusitaNama",
};

export const SEMUA_PERAN: PeranDerry[] = ["hakim", "pp", "js"];

/** Bagian baris jadwal bot (SidangBaris) yang dipakai. Semua opsional - bot lama. */
export type BarisSidangSaya = {
  sidangId?: unknown;
  perkaraId?: unknown;
  nomorPerkara?: unknown;
  jenisPerkara?: unknown;
  alurPerkaraId?: unknown;
  sudahPutus?: unknown;
  tanggalPutusan?: unknown;
  tanggalMinutasi?: unknown;
  tanggalSidang?: unknown;
  jamSidang?: unknown;
  agenda?: unknown;
  ruangan?: unknown;
  ditunda?: unknown;
  alasanDitunda?: unknown;
  urutanSidang?: unknown;
  dihadiriOleh?: unknown;
  adaBas?: unknown;
  adaBerkasPutusan?: unknown;
  lewatEcourt?: unknown;
  majelisKode?: unknown;
  majelisNama?: unknown;
  paniteraNama?: unknown;
  jurusitaNama?: unknown;
  pihak?: { penggugat?: unknown; tergugat?: unknown } | null;
  penandaPerkara?: { ghaib?: unknown; prodeo?: unknown } | null;
};

export type SidangSaya = {
  sidangId: string;
  tanggal: string;
  jam: string;
  agenda: string;
  /** Alasan ditunda / keterangan sidang (kolom alasan_ditunda SIPP); "" bila tidak ada. */
  ket: string;
  ditunda: boolean;
  urutan: number;
  /** 1 semua pihak, 2 pihak pertama saja, 3 pihak kedua saja, 4 tidak ada; null = belum dicatat. */
  hadir: number | null;
  /** BAS sidang ini sudah di SIPP; null = bot lama tidak mengirimnya. */
  adaBas: boolean | null;
  ruangan: string;
};

export type PerkaraSaya = {
  nomorPerkara: string;
  perkaraId: string;
  jenisPerkara: string;
  alurPerkaraId: number;
  sudahPutus: boolean;
  tanggalPutusan: string;
  tanggalMinutasi: string;
  adaBerkasPutusan: boolean | null;
  lewatEcourt: boolean | null;
  ghaib: boolean;
  prodeo: boolean;
  majelisKode: string;
  majelisNama: string;
  paniteraNama: string;
  jurusitaNama: string;
  /** Sebagai apa akun ini di perkara itu. Admin tanpa "lihat sebagai": semua peran. */
  sebagai: PeranDerry[];
  pihak: { penggugat: string[]; tergugat: string[] };
  sidang: SidangSaya[];
};

export type AkunDilihat = { hakim: string[]; pp: string[]; js: string[] };

const teks = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
const tanggal10 = (v: unknown) => {
  const t = teks(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : "";
};
const benar = (v: unknown): boolean => v === true || v === 1 || v === "1" || v === "Y" || v === "true";
const benarAtauNull = (v: unknown): boolean | null => (v === null || v === undefined || v === "" ? null : benar(v));
const daftarNama = (v: unknown): string[] => (Array.isArray(v) ? v.map(teks).filter(Boolean) : []);
/** alasan_ditunda SIPP memakai "0", "-", "" untuk "tidak ada". */
const ketBersih = (v: unknown) => {
  const t = teks(v);
  return /^(0|-|--|\.+|null)$/i.test(t) ? "" : t;
};

export function peranDerryValid(v: unknown): PeranDerry | null {
  const t = teks(v).toLowerCase();
  return t === "hakim" || t === "pp" || t === "js" ? t : null;
}

/** Peran apa saja yang dipegang `nama` pada satu baris; `batas` membatasi ke satu peran. */
export function sebagaiApa(baris: BarisSidangSaya, nama: string, batas?: PeranDerry | null): PeranDerry[] {
  const hasil: PeranDerry[] = [];
  for (const peran of batas ? [batas] : SEMUA_PERAN) {
    if (namaAdaDi(nama, teks(baris[RUAS_PERAN[peran]]))) hasil.push(peran);
  }
  return hasil;
}

/** Sidang yang dijadikan acuan: hari ini, bila tidak ada yang terakhir sampai hari ini, bila tidak ada yang paling dekat. */
export function indeksSidangAcuan(sidang: Array<{ tanggal: string }>, hariIni: string): number {
  if (sidang.length === 0) return -1;
  const hariIniIdx = sidang.findIndex((s) => s.tanggal === hariIni);
  if (hariIniIdx >= 0) return hariIniIdx;
  let terakhirLewat = -1;
  sidang.forEach((s, i) => {
    if (s.tanggal && s.tanggal < hariIni) terakhirLewat = i;
  });
  return terakhirLewat >= 0 ? terakhirLewat : 0;
}

function urutSidang(a: SidangSaya, b: SidangSaya) {
  return a.tanggal.localeCompare(b.tanggal) || a.jam.localeCompare(b.jam) || a.urutan - b.urutan;
}

function ringkasSidang(b: BarisSidangSaya): SidangSaya {
  const hadir = Number(b.dihadiriOleh);
  return {
    sidangId: teks(b.sidangId),
    tanggal: tanggal10(b.tanggalSidang),
    jam: teks(b.jamSidang).slice(0, 5),
    agenda: teks(b.agenda),
    ket: ketBersih(b.alasanDitunda),
    ditunda: benar(b.ditunda),
    urutan: Number(b.urutanSidang) || 0,
    hadir: Number.isFinite(hadir) && hadir >= 1 && hadir <= 4 ? hadir : null,
    adaBas: benarAtauNull(b.adaBas),
    ruangan: teks(b.ruangan),
  };
}

export type OpsiSusun = {
  hariIni: string;
  /** Nama akun yang masuk. */
  nama: string;
  /** Super admin / admin: semua perkara. */
  lihatSemua: boolean;
  /** Admin melihat sebagai satu akun (nama + perannya). */
  sebagaiNama?: string;
  sebagaiPeran?: PeranDerry | null;
  /**
   * Hanya Super Admin/Admin yang boleh "Lihat sebagai akun" dan menerima daftar akun.
   * Bawaan = lihatSemua (kompatibel); Ketua/Wakil Ketua melihat semua perkara tetapi tidak berhak atas keduanya.
   */
  bolehLihatSebagai?: boolean;
  /** Peran yang dianggap dipegang saat `lihatSemua` tanpa "lihat sebagai". Bawaan: ketiganya (admin); Ketua/Wakil: hakim (putusan). */
  peranSemua?: PeranDerry[];
  /**
   * PTSP: mencari nomor perkara di seluruh satker (baca saja). Hanya perkara yang nomornya memuat
   * `cariNomor` yang dikembalikan; `sebagai` berisi peran milik akun itu sendiri (biasanya kosong = tanpa hak tulis).
   */
  cariNomorSatker?: boolean;
  cariNomor?: string;
};

export type HasilSusun = {
  perkara: PerkaraSaya[];
  /** Jumlah perkara berbeda di rentang itu (seluruh satker), sebelum disaring. */
  jumlahSemua: number;
  /** Ada perkara yang cocok dengan nama akun. Salah = nama tidak ketemu di jadwal. */
  adaYangCocok: boolean;
  /** Hanya untuk admin: nama-nama petugas di rentang itu, untuk "Lihat sebagai akun". */
  akun: AkunDilihat | null;
};

/**
 * Menyatukan baris sidang menjadi perkara, menyaring menurut akun, dan
 * mengurutkan menurut nomor perkara (urutan layar dilakukan peramban).
 */
export function susunPerkaraSaya(baris: BarisSidangSaya[], opsi: OpsiSusun): HasilSusun {
  const peta = new Map<string, BarisSidangSaya[]>();
  for (const b of Array.isArray(baris) ? baris : []) {
    const kunci = teks(b?.perkaraId) || teks(b?.nomorPerkara);
    if (!kunci) continue;
    if (!peta.has(kunci)) peta.set(kunci, []);
    peta.get(kunci)!.push(b);
  }

  const bolehSebagai = opsi.lihatSemua && opsi.bolehLihatSebagai !== false;
  const peranSemua = opsi.peranSemua && opsi.peranSemua.length ? opsi.peranSemua : SEMUA_PERAN;
  const kataNomor = opsi.cariNomorSatker ? teks(opsi.cariNomor).toLowerCase() : "";
  const lihatSebagai = bolehSebagai && teks(opsi.sebagaiNama) ? teks(opsi.sebagaiNama) : "";
  const batas = lihatSebagai ? peranDerryValid(opsi.sebagaiPeran) : null;
  const nama = lihatSebagai || teks(opsi.nama);
  const semuaTanpaSaring = opsi.lihatSemua && !lihatSebagai;

  const akun = bolehSebagai
    ? { hakim: new Map<string, string>(), pp: new Map<string, string>(), js: new Map<string, string>() }
    : null;
  const perkara: PerkaraSaya[] = [];

  for (const [, kelompok] of peta) {
    // Keterangan tingkat perkara dibaca dari sidang TERAKHIR: majelis dapat
    // diganti di tengah jalan, dan yang berlaku adalah yang terbaru.
    const urut = kelompok.map((b) => ({ b, s: ringkasSidang(b) })).sort((x, y) => urutSidang(x.s, y.s));
    const sidang = urut.map((x) => x.s);
    const akhir = urut[urut.length - 1].b;

    if (akun) {
      for (const peran of SEMUA_PERAN) {
        for (const satu of pecahNamaPetugas(teks(akhir[RUAS_PERAN[peran]]))) {
          const kunci = satu.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
          if (kunci && !akun[peran].has(kunci)) akun[peran].set(kunci, satu);
        }
      }
    }

    let sebagai: PeranDerry[];
    if (opsi.cariNomorSatker) {
      // Pencarian PTSP: tanpa kata kunci tidak ada yang dikembalikan; peran tulis hanya bila akun itu memang majelis/PP/juru sita.
      if (!kataNomor || !teks(akhir.nomorPerkara).toLowerCase().includes(kataNomor)) continue;
      sebagai = sebagaiApa(akhir, nama, batas);
    } else if (semuaTanpaSaring) sebagai = [...peranSemua];
    else {
      sebagai = sebagaiApa(akhir, nama, batas);
      if (sebagai.length === 0) continue;
    }

    const pihak = akhir.pihak || {};
    // Sidang yang sama persis (bot dapat mengirim baris kembar) dibuang.
    const unik = sidang.filter((s, i, a) => !s.sidangId || a.findIndex((x) => x.sidangId === s.sidangId) === i);
    perkara.push({
      nomorPerkara: teks(akhir.nomorPerkara),
      perkaraId: teks(akhir.perkaraId),
      jenisPerkara: teks(akhir.jenisPerkara),
      alurPerkaraId: Number(akhir.alurPerkaraId) || 0,
      sudahPutus: benar(akhir.sudahPutus),
      tanggalPutusan: tanggal10(akhir.tanggalPutusan),
      tanggalMinutasi: tanggal10(akhir.tanggalMinutasi),
      adaBerkasPutusan: benarAtauNull(akhir.adaBerkasPutusan),
      lewatEcourt: benarAtauNull(akhir.lewatEcourt),
      ghaib: benar(akhir.penandaPerkara?.ghaib),
      prodeo: benar(akhir.penandaPerkara?.prodeo),
      majelisKode: teks(akhir.majelisKode),
      majelisNama: teks(akhir.majelisNama),
      paniteraNama: teks(akhir.paniteraNama),
      jurusitaNama: teks(akhir.jurusitaNama),
      sebagai,
      pihak: { penggugat: daftarNama(pihak.penggugat), tergugat: daftarNama(pihak.tergugat) },
      sidang: unik,
    });
  }

  perkara.sort((a, b) => (parseInt(a.nomorPerkara, 10) || 0) - (parseInt(b.nomorPerkara, 10) || 0) || a.nomorPerkara.localeCompare(b.nomorPerkara));

  const urutNama = (m: Map<string, string>) => [...m.values()].sort((a, b) => a.localeCompare(b, "id"));
  return {
    perkara,
    jumlahSemua: peta.size,
    adaYangCocok: opsi.cariNomorSatker ? true : semuaTanpaSaring ? peta.size > 0 : perkara.length > 0,
    akun: akun ? { hakim: urutNama(akun.hakim), pp: urutNama(akun.pp), js: urutNama(akun.js) } : null,
  };
}

// ----------------------------------------------------------------------------
// Rentang tanggal
// ----------------------------------------------------------------------------

export type ModeDaftar = "hari" | "rentang" | "semua";

/** Batas rentang "Pilih tanggal" - 62 hari, supaya satu permintaan tidak menyapu satker setahun. */
export const BATAS_HARI_RENTANG = 62;
/** "Semua perkara saya": sidang sejak sekian hari lalu sampai sekian hari ke depan. */
export const HARI_LALU_SEMUA = 90;
export const HARI_DEPAN_SEMUA = 45;
/** Bot menyerahkan paling banyak 500 baris per permintaan; rentang dipecah per minggu. */
export const HARI_PER_POTONG = 7;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const hariKeMs = 86_400_000;
const tambahHari = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * hariKeMs).toISOString().slice(0, 10);
const selisihHari = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / hariKeMs);

export type RentangMinta = { ok: true; mode: ModeDaftar; dari: string; sampai: string } | { ok: false; alasan: string };

export function tentukanRentang(masuk: { mode?: string; dari?: string; sampai?: string }, hariIni: string): RentangMinta {
  const mode = (teks(masuk.mode) || "hari") as ModeDaftar;
  if (mode === "hari") return { ok: true, mode, dari: hariIni, sampai: hariIni };
  if (mode === "semua") {
    return { ok: true, mode, dari: tambahHari(hariIni, -HARI_LALU_SEMUA), sampai: tambahHari(hariIni, HARI_DEPAN_SEMUA) };
  }
  if (mode !== "rentang") return { ok: false, alasan: `Mode "${mode}" tidak dikenal (hari, rentang, atau semua).` };
  const dari = teks(masuk.dari);
  const sampai = teks(masuk.sampai) || dari;
  if (!ISO.test(dari) || !ISO.test(sampai)) return { ok: false, alasan: "Tanggal harus berbentuk YYYY-MM-DD." };
  if (sampai < dari) return { ok: false, alasan: "Tanggal akhir lebih awal daripada tanggal mulai." };
  if (selisihHari(dari, sampai) + 1 > BATAS_HARI_RENTANG) {
    return { ok: false, alasan: `Rentang paling lama ${BATAS_HARI_RENTANG} hari. Pakai "Semua perkara saya" untuk gambaran yang lebih lebar.` };
  }
  return { ok: true, mode, dari, sampai };
}

/** Memecah rentang menjadi potongan berurutan (paling lebar HARI_PER_POTONG hari). */
export function potongRentang(dari: string, sampai: string): Array<{ dari: string; sampai: string }> {
  const hasil: Array<{ dari: string; sampai: string }> = [];
  let mulai = dari;
  while (mulai <= sampai) {
    const akhir = tambahHari(mulai, HARI_PER_POTONG - 1);
    hasil.push({ dari: mulai, sampai: akhir < sampai ? akhir : sampai });
    mulai = tambahHari(mulai, HARI_PER_POTONG);
  }
  return hasil;
}
