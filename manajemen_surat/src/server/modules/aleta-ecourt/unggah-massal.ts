/**
 * ============================================================================
 * UNGGAH MASSAL e-DOC PUTUSAN & BAS KE SIPP (F4.1, 17 OKT 2026) - FUNGSI MURNI
 * ============================================================================
 *
 * Layar "Unggah massal" di panel ABT menampilkan perkara MILIK akun yang
 * e-Doc-nya belum ada di SIPP:
 *
 *   Hakim (termasuk Ketua/Wakil)   putusan yang sudah dibacakan (tanggal
 *                                  putusan terisi) tetapi e-Doc putusan atau
 *                                  anonimisasinya belum ada.
 *   PP / Panitera / Panmud         BAS sidang yang sudah berlangsung tetapi
 *                                  e-Doc BAS-nya belum ada.
 *   Admin / Super Admin            keduanya, semua perkara.
 *
 * Hak (keputusan 9 Okt & 16 Okt 2026): putusan hanya Super Admin/Admin/Hakim
 * (peranUnggahPutusan); BAS hanya golongan BAS massal (bolehBasMassal: PP,
 * Panitera, Panmud, Analis + Admin). Hakim TIDAK melihat BAS dan PP TIDAK
 * melihat putusan. "Milik" = namanya ada di majelis pemeriksa (putusan) / PP
 * aktif (BAS), dicocokkan seperti perkara-sendiri (namaCocokSatu). Saringan
 * "semua" hanya untuk yang mengawasi: Admin, Ketua/Wakil (putusan), Panitera,
 * Panmud, Analis (BAS). Hakim anggota dan PP selalu "saya".
 *
 * Sinkron dengan penyatu M2 (penyatu.ts): jendela BATAS_TUGAS_BAS_HARI hari,
 * "BAS belum" = edoc_bas kosong pada sidang yang sudah lewat, jejak ABT =
 * keterangan saksi sidang itu. Sidang HARI INI ikut ditawarkan (PP lazim
 * mengunggah sore hari) tetapi ditandai dan tidak ikut hitungan "tertunggak"
 * yang sama dengan M2.
 */
import { bacaRtfDariBita } from "@/lib/baca-rtf";
import { golonganMenuEkstensi, type GolonganMenuEkstensi } from "@/lib/matriks-peran";
import { isiMenunjukPerkara, nomorPerkaraDariIsi } from "@/lib/naskah-putusan-resmi";
import { namaCocokSatu } from "@/lib/perkara-sendiri";
import { isPrivilegedAdmin } from "@/lib/permissions";
import type {
  UnggahMassalBasBot,
  UnggahMassalDaftarBot,
  UnggahMassalPutusanBot,
  UnggahMassalTertahanBot,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { peranUnggahPutusan } from "@/server/modules/aleta-ecourt/hak-putusan";
import { kenaliBentuk } from "@/server/modules/aleta-ecourt/unggah-naskah-putusan";

export type JenisUnggahMassal = "putusan" | "bas";
export type Saringan = "saya" | "semua";

const GOLONGAN_BAS: GolonganMenuEkstensi[] = ["admin", "panitera", "panmud", "pp", "analis"];
const GOLONGAN_BAS_SEMUA: GolonganMenuEkstensi[] = ["admin", "panitera", "panmud", "analis"];
const PERAN_PUTUSAN_SEMUA = new Set(["super-admin", "admin", "ketua", "wakil-ketua"]);

type Pengguna = Parameters<typeof peranUnggahPutusan>[0];

export type HakUnggahMassal = {
  putusan: boolean;
  bas: boolean;
  /** Boleh memilih saringan "semua" per jenis. */
  semua: { putusan: boolean; bas: boolean };
  /** Peran/golongan yang diteruskan ke bot sebagai peranPenekan. */
  peranPutusan: string | null;
  peranBas: string | null;
};

export function hakUnggahMassal(user: Pengguna): HakUnggahMassal {
  const peranPutusan = user ? peranUnggahPutusan(user) : null;
  const admin = Boolean(user) && isPrivilegedAdmin(user as Parameters<typeof isPrivilegedAdmin>[0]);
  const golongan = user ? golonganMenuEkstensi(user as Parameters<typeof golonganMenuEkstensi>[0]) : [];
  const gBas = admin ? "admin" : golongan.find((g) => GOLONGAN_BAS.includes(g)) ?? null;
  return {
    putusan: Boolean(peranPutusan),
    bas: Boolean(gBas),
    semua: {
      putusan: Boolean(peranPutusan) && PERAN_PUTUSAN_SEMUA.has(String(peranPutusan)),
      bas: admin || golongan.some((g) => GOLONGAN_BAS_SEMUA.includes(g)),
    },
    peranPutusan: peranPutusan ? String(peranPutusan) : null,
    peranBas: gBas,
  };
}

export type BarisUnggahMassal = {
  /** "put:<perkaraId>" atau "bas:<sidangId>" - kunci centang di ekstensi. */
  kunci: string;
  jenis: JenisUnggahMassal;
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  alurPerkaraId: number;
  /** Tanggal putusan (putusan) / tanggal sidang (BAS). */
  tanggal: string;
  /** Nama majelis (putusan) atau PP (BAS) - yang menentukan "milik". */
  petugas: string[];
  milikSaya: boolean;
  /** Putusan: slot yang belum ada di SIPP. */
  perlu?: { putusan: boolean; anonim: boolean };
  statusPutusan?: string;
  verstek?: boolean;
  /** BAS */
  sidangId?: string;
  urutan?: number;
  agenda?: string;
  ditunda?: boolean;
  ikrar?: boolean;
  hariIni?: boolean;
  bukti?: string[];
  /** Butir 43 (17 Okt): e-Doc BAS SUDAH ada di SIPP (hanya bila diminta "tampilkan juga yang sudah ada") - tombol Ganti. */
  adaBas?: boolean;
  jalurBas?: string;
};

export type DaftarUnggahMassal = {
  ok: true;
  hariIni: string;
  sejak: string;
  hak: HakUnggahMassal;
  saringan: { putusan: Saringan; bas: Saringan };
  putusan: BarisUnggahMassal[];
  bas: BarisUnggahMassal[];
  /** Sudah dibacakan, tetapi Putusan Akhir belum diisi di SIPP - belum dapat diunggah. */
  tertahan: Array<{ perkaraId: string; nomorPerkara: string; tanggalSidang: string }>;
  jumlah: { putusanSaya: number; putusanSemua: number; basSaya: number; basSemua: number; basTertunggak: number };
  /** Bagian yang tidak terbaca - disebut, bukan dijawab kosong. */
  galat: string[];
};

const milik = (namaAkun: string, nama: string[]) => Boolean(namaAkun.trim()) && nama.some((n) => namaCocokSatu(namaAkun, n));

function barisPutusan(x: UnggahMassalPutusanBot, namaAkun: string): BarisUnggahMassal {
  return {
    kunci: `put:${x.perkaraId}`,
    jenis: "putusan",
    perkaraId: x.perkaraId,
    nomorPerkara: x.nomorPerkara,
    jenisPerkara: x.jenisPerkara,
    alurPerkaraId: x.alurPerkaraId,
    tanggal: x.tanggalPutusan,
    petugas: x.majelis,
    milikSaya: milik(namaAkun, x.majelis),
    perlu: { putusan: !x.adaPutusan, anonim: !x.adaAnonim },
    statusPutusan: x.statusPutusan,
    verstek: x.verstek,
  };
}

/** Kalimat jejak BAS di ABT - sama dengan penyatu M2. */
export function buktiBasAbt(saksi: UnggahMassalBasBot["saksiAbt"]): string[] {
  if (!saksi || !(saksi.tanyaJawab > 0)) return [];
  return [`ABT: keterangan ${saksi.saksi} saksi (${saksi.tanyaJawab} tanya-jawab) sudah diisi`];
}

function barisBas(x: UnggahMassalBasBot, namaAkun: string, hariIni: string): BarisUnggahMassal {
  return {
    kunci: `bas:${x.sidangId}`,
    jenis: "bas",
    perkaraId: x.perkaraId,
    nomorPerkara: x.nomorPerkara,
    jenisPerkara: x.jenisPerkara,
    alurPerkaraId: x.alurPerkaraId,
    tanggal: x.tanggalSidang,
    petugas: x.panitera,
    milikSaya: milik(namaAkun, x.panitera),
    sidangId: x.sidangId,
    urutan: x.urutan,
    agenda: x.agenda,
    ditunda: x.ditunda,
    ikrar: x.ikrar,
    hariIni: x.tanggalSidang === hariIni,
    bukti: buktiBasAbt(x.saksiAbt),
    ...(x.adaBas ? { adaBas: true, jalurBas: String(x.jalurBas || "") } : {}),
  };
}

export function saringanBerlaku(diminta: string | null | undefined, bolehSemua: boolean): Saringan {
  if (!bolehSemua) return "saya";
  return diminta === "saya" ? "saya" : "semua";
}

/**
 * Menyusun jawaban layar dari fakta bot. Murni.
 * Jenis yang tidak menjadi hak akun DIKOSONGKAN (bukan disaring di ekstensi).
 */
export function susunDaftarUnggahMassal(p: {
  data: UnggahMassalDaftarBot;
  hak: HakUnggahMassal;
  namaAkun: string;
  saringanDiminta?: { putusan?: string | null; bas?: string | null };
}): DaftarUnggahMassal {
  const { data, hak, namaAkun } = p;
  const saringan = {
    putusan: saringanBerlaku(p.saringanDiminta?.putusan, hak.semua.putusan),
    bas: saringanBerlaku(p.saringanDiminta?.bas, hak.semua.bas),
  };
  // Audit 17 Okt: sebab dari bot bisa pesan SQL mentah ("Unknown column ...") - layar hanya
  // menyebut sumber & langkahnya; sebab teknisnya ke log server.
  for (const g of data.galat || []) if (g.sebab) console.warn(`[unggah massal] ${g.sumber}/${g.langkah}: ${g.sebab}`);
  const galat: string[] = (data.galat || []).map((g) => `${g.sumber.toUpperCase()} - ${g.langkah}: belum dapat dibaca saat ini.`);

  const semuaPutusan = hak.putusan && data.putusan ? data.putusan.map((x) => barisPutusan(x, namaAkun)) : [];
  const semuaBas = hak.bas && data.bas ? data.bas.map((x) => barisBas(x, namaAkun, data.hariIni)) : [];
  if (hak.putusan && !data.putusan) galat.push("Daftar putusan belum dapat dibaca dari SIPP.");
  if (hak.bas && !data.bas) galat.push("Daftar BAS belum dapat dibaca dari SIPP.");
  if (hak.bas && data.bas && data.bas.length && !data.abtTerbaca) galat.push("Keterangan saksi di ABT belum terbaca - jejak BAS di ABT tidak ditampilkan.");

  const tertahanSemua: UnggahMassalTertahanBot[] = hak.putusan && data.tertahan ? data.tertahan : [];
  const tertahan = tertahanSemua
    .filter((t) => saringan.putusan === "semua" || milik(namaAkun, t.majelis))
    .map((t) => ({ perkaraId: t.perkaraId, nomorPerkara: t.nomorPerkara, tanggalSidang: t.tanggalSidang }));

  const putusan = saringan.putusan === "semua" ? semuaPutusan : semuaPutusan.filter((x) => x.milikSaya);
  const bas = saringan.bas === "semua" ? semuaBas : semuaBas.filter((x) => x.milikSaya);
  return {
    ok: true,
    hariIni: data.hariIni,
    sejak: data.sejak,
    hak,
    saringan,
    putusan,
    bas,
    tertahan,
    jumlah: {
      putusanSaya: semuaPutusan.filter((x) => x.milikSaya).length,
      putusanSemua: hak.semua.putusan ? semuaPutusan.length : semuaPutusan.filter((x) => x.milikSaya).length,
      // Yang sudah ada (butir 43, hanya bila diminta) tidak ikut hitungan "menunggu".
      basSaya: semuaBas.filter((x) => x.milikSaya && !x.adaBas).length,
      basSemua: (hak.semua.bas ? semuaBas : semuaBas.filter((x) => x.milikSaya)).filter((x) => !x.adaBas).length,
      basTertunggak: bas.filter((x) => !x.hariIni && !x.adaBas).length,
    },
    galat,
  };
}

/**
 * Pemeriksaan isi berkas BAS SEBELUM apa pun ditulis (sepadan periksaBerkasUnggahSipp
 * untuk putusan). RTF dibaca: harus berjudul berita acara dan, bila menyebut nomor
 * perkara, nomornya harus perkara ini. Bentuk lain hanya diberi peringatan. Murni.
 */
export function periksaBerkasBas(bita: Uint8Array, nomorPerkara: string): { tolak: string | null; peringatan: string[]; bentuk: string } {
  const bentuk = kenaliBentuk(bita);
  const peringatan: string[] = [];
  if (bentuk === "teks") return { tolak: "Berkasnya bukan RTF, PDF, DOC, maupun DOCX.", peringatan, bentuk };
  if (bentuk !== "rtf") {
    peringatan.push(`Berkas ${bentuk.toUpperCase()} tidak dapat dibaca isinya - judul dan nomor perkaranya belum dipastikan.`);
    return { tolak: null, peringatan, bentuk };
  }
  let teks = "";
  try {
    teks = bacaRtfDariBita(bita).replace(/\u0000/g, "");
  } catch (galat) {
    peringatan.push(`Isi RTF tidak terbaca (${String((galat as Error)?.message ?? galat).slice(0, 100)}), jadi tidak diperiksa.`);
    return { tolak: null, peringatan, bentuk };
  }
  if (!/BERITA\s+ACARA/i.test(teks)) {
    return { tolak: "Isinya bukan berita acara sidang (tidak ada judul \"Berita Acara\"). Tidak ada berkas yang dikirim ke SIPP.", peringatan, bentuk };
  }
  const dariIsi = nomorPerkaraDariIsi(teks);
  if (!dariIsi.nomor) {
    peringatan.push("BAS tidak menyebut nomor perkara di isinya - pastikan berkasnya milik perkara ini.");
  } else if (!isiMenunjukPerkara(dariIsi, nomorPerkara)) {
    return {
      tolak: `BAS menyebut nomor ${dariIsi.nomor}, bukan ${nomorPerkara} - kemungkinan milik perkara lain. Tidak ada berkas yang dikirim ke SIPP.`,
      peringatan,
      bentuk,
    };
  }
  return { tolak: null, peringatan, bentuk };
}

/** Ringkasan satu putaran unggah massal yang dicatat ke jejak ALETA (audit_logs). */
export type RingkasanPutaran = {
  jenis: JenisUnggahMassal;
  mulai: string;
  selesai: string;
  berhenti: boolean;
  sebabBerhenti: string;
  butir: Array<{ nomor: string; sidang?: number; hasil: "berhasil" | "gagal" | "dilewati" | "dobel"; catatan: string; berkas?: string }>;
};

const HASIL_SAH = new Set(["berhasil", "gagal", "dilewati", "dobel"]);

/** Membersihkan kiriman ekstensi sebelum dicatat: batas panjang, hasil yang dikenal saja. Murni. */
export function bersihkanRingkasan(x: unknown): RingkasanPutaran | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const jenis = o.jenis === "putusan" || o.jenis === "bas" ? o.jenis : null;
  if (!jenis) return null;
  const teks = (v: unknown, n: number) => String(v ?? "").replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, n);
  const butir = (Array.isArray(o.butir) ? o.butir : []).slice(0, 300).flatMap((b) => {
    if (!b || typeof b !== "object") return [];
    const r = b as Record<string, unknown>;
    const hasil = String(r.hasil ?? "");
    if (!HASIL_SAH.has(hasil)) return [];
    const sidang = Number(r.sidang);
    return [
      {
        nomor: teks(r.nomor, 60),
        ...(Number.isInteger(sidang) && sidang > 0 ? { sidang } : {}),
        hasil: hasil as RingkasanPutaran["butir"][number]["hasil"],
        catatan: teks(r.catatan, 300),
        ...(r.berkas ? { berkas: teks(r.berkas, 200) } : {}),
      },
    ];
  });
  if (!butir.length) return null;
  return {
    jenis,
    mulai: teks(o.mulai, 40),
    selesai: teks(o.selesai, 40),
    berhenti: o.berhenti === true,
    sebabBerhenti: teks(o.sebabBerhenti, 300),
    butir,
  };
}

export function hitungRingkasan(r: RingkasanPutaran) {
  const n = (h: string) => r.butir.filter((b) => b.hasil === h).length;
  return { berhasil: n("berhasil"), gagal: n("gagal"), dilewati: n("dilewati"), dobel: n("dobel"), total: r.butir.length };
}
