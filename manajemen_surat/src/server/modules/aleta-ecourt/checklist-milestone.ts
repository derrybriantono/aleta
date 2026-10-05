import {
  KUNCI_PERAN,
  LABEL_PERAN,
  type KunciPeran,
  peranSah,
} from "@/lib/checklist-milestone-katalog";
import {
  type AntreanChecklist,
  type ButirChecklist,
  type JenisTakTersedia,
  type KonteksChecklist,
  type RingkasChecklist,
  type TambahanAleta,
  type TunjukanKonsep,
  konteksDari,
  nilaiChecklist,
  tunjukanMilikSaya,
} from "@/lib/checklist-milestone";
import { getEffectivePositionId, getEffectiveRoleId } from "@/lib/permissions";
import { type AletaDatabase } from "@/server/db/client";
import { getGatewayChecklistMilestone } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { KEADAAN_KREDENSIAL } from "@/server/modules/external-apps/service";
import { type requireActorUser } from "@/server/modules/organization/service";

import { bolehMenetapkan } from "./kewenangan-penetapan";
import { bacaSemuaKonseptorSementara } from "./konseptor-sementara";
import { type AkunSiapPakai, bacaPemetaanJabatan } from "./pemetaan-jabatan";
import { bacaAntreanChecklist } from "./penunjukan-antrean";

/**
 * ============================================================================
 * CHECKLIST MILESTONE - PENYUSUN JAWABAN PORTAL
 * ============================================================================
 *
 * Tiga langkah, dan tidak ada satu pun yang menebak:
 *
 *   1. SIAPA ANDA - peran akun ALETA (termasuk peran tambahan, peran berlaku
 *      PLH, dan jabatan) digabung dengan pemetaan jabatan SIPP
 *      (bacaPemetaanJabatan: user_hakim/user_panitera/user_jurusita yang
 *      kredensialnya tersimpan atas nama Anda). Penautannya lewat id, tidak
 *      pernah lewat kemiripan nama.
 *
 *   2. FAKTANYA - bot membaca SIPP untuk satu peran, dibatasi pada perkara yang
 *      menyebut id pejabat Anda; basis data ALETA menambah antrean penetapan
 *      dan tunjukan konseptor sementara.
 *
 *   3. PENILAIANNYA - lib/checklist-milestone.ts, tanpa basis data.
 *
 * Jawabannya disinggahkan 60 detik per pengguna dan per peran: widget
 * membacanya berulang, dan SIPP tidak perlu ditanya ulang tiap kali panel
 * digambar.
 *
 * ============================================================================
 * BEBAN: SATU HITUNG UNTUK PERMINTAAN YANG SAMA
 * ============================================================================
 *
 * Fakta bot disinggahkan menurut PERMINTAANNYA (peran, tanggal, id pejabat,
 * perkara tambahan), bukan menurut penggunanya: sepuluh petugas PTSP yang
 * membuka panel pukul 08.00 dilayani satu pembacaan SIPP, bukan sepuluh.
 * Itu aman karena faktanya hanya bergantung pada permintaan itu; yang
 * bergantung pada orangnya (antrean yang boleh ia tekan, tunjukan
 * konseptornya) tetap dinilai per pengguna. Permintaan yang datang selagi
 * hitungan yang sama masih berjalan menunggu hitungan itu - tidak
 * memulainya lagi.
 */

type Aktor = Awaited<ReturnType<typeof requireActorUser>>;

export type PeranTersedia = { kunci: KunciPeran; label: string };

export type JawabanChecklist = {
  pengguna: { nama: string; peran: string[] };
  peranTersedia: PeranTersedia[];
  peranAktif: string;
  dibuat: string;
  ringkas: RingkasChecklist;
  butir: ButirChecklist[];
  jenisTidakTersedia: JenisTakTersedia[];
  galat: string[];
};

/** Lama singgahan jawaban, fakta bot, dan pemetaan jabatan, dalam milidetik. */
export const SINGGAH_MS = 60_000;

type Singgahan<T> = { kapan: number; isi: T };
type PermintaanBot = Parameters<typeof getGatewayChecklistMilestone>[0];
type JawabBot = Awaited<ReturnType<typeof getGatewayChecklistMilestone>>;
type PemetaanSatker = Awaited<ReturnType<typeof bacaPemetaanJabatan>>;

const singgahJawaban = new Map<string, Singgahan<JawabanChecklist>>();
const singgahFakta = new Map<string, Singgahan<JawabBot>>();
let singgahPemetaan: Singgahan<PemetaanSatker> | null = null;
const sedangBerjalan = new Map<string, Promise<unknown>>();

/** Dibuka untuk uji. */
export function kosongkanSinggahChecklist() {
  singgahJawaban.clear();
  singgahFakta.clear();
  singgahPemetaan = null;
  sedangBerjalan.clear();
}

/**
 * Satu hitungan untuk satu kunci: permintaan yang datang selagi hitungan
 * berkunci sama masih berjalan menunggu hitungan itu, tidak memulai lagi.
 */
function sekaliJalan<T>(kunci: string, kerja: () => Promise<T>): Promise<T> {
  const ada = sedangBerjalan.get(kunci);
  if (ada) return ada as Promise<T>;
  const janji = kerja().finally(() => sedangBerjalan.delete(kunci));
  sedangBerjalan.set(kunci, janji);
  return janji;
}

function simpanSinggah<T>(peta: Map<string, Singgahan<T>>, kunci: string, isi: T, kapan: number) {
  // Kunci basi dibuang sesekali supaya peta tidak tumbuh tanpa batas.
  if (peta.size > 500) {
    for (const [k, v] of peta) if (kapan - v.kapan >= SINGGAH_MS) peta.delete(k);
  }
  peta.set(kunci, { kapan, isi });
}

type PemetaanSaya = {
  ok: boolean;
  galat: string;
  /** Akun SIPP berjabatan yang SAH menautkan pengguna ini (lihat pemetaanSaya). */
  akun: AkunSiapPakai[];
  /** Username SIPP milik pengguna ini: kredensial aktif dan ia pemilik tunggalnya. */
  username: string[];
  /** Keterangan penautan untuk pengguna ini - kredensial nonaktif, username ganda, password tak cocok. */
  catatan: string[];
};

// ============================================================================
// SIAPA ANDA
// ============================================================================

const POSISI_PANITERA = /^pos-panitera(-muda.*)?$/;

/**
 * Peran checklist yang tersedia bagi pengguna, menurut urutan KUNCI_PERAN.
 *
 * Akun ALETA menjawab jabatan satker (ketua, panitera, PTSP, operator);
 * pemetaan SIPP menjawab jabatan persidangan (hakim, panitera pengganti,
 * juru sita) - sebab di SIPP satu orang dapat duduk sebagai panitera
 * pengganti walau jabatan struktural di ALETA-nya berbeda.
 */
export function tentukanPeran(aktor: Aktor, akunSaya: AkunSiapPakai[]): KunciPeran[] {
  const peran = new Set<string>(
    [String(aktor.roleId ?? ""), String(getEffectiveRoleId(aktor) ?? ""), ...(aktor.additionalRoleIds ?? []).map(String)].filter(
      Boolean
    )
  );
  const posisi = new Set<string>(
    [String(aktor.positionId ?? ""), String(getEffectivePositionId(aktor) ?? "")].filter(Boolean)
  );
  const punya = (jabatan: string) => akunSaya.some((a) => a.jabatan === jabatan);
  const salahSatu = (himpunan: Set<string>, daftar: string[]) => daftar.some((x) => himpunan.has(x));

  const hasil = new Set<KunciPeran>();
  if (salahSatu(peran, ["hakim", "ketua", "wakil-ketua"]) || salahSatu(posisi, ["pos-hakim", "pos-ketua", "pos-wakil"]) || punya("hakim")) {
    hasil.add("hakim");
  }
  if (peran.has("panitera-pengganti") || posisi.has("pos-panitera-pengganti") || punya("panitera")) {
    hasil.add("panitera-pengganti");
  }
  if (peran.has("jurusita") || salahSatu(posisi, ["pos-jurusita", "pos-jurusita-pengganti"]) || punya("jurusita")) {
    hasil.add("jurusita");
  }
  if (salahSatu(peran, ["panitera", "panitera-muda"]) || [...posisi].some((p) => POSISI_PANITERA.test(p) && p !== "pos-panitera-pengganti")) {
    hasil.add("panitera");
  }
  if (salahSatu(peran, ["ketua", "wakil-ketua"]) || salahSatu(posisi, ["pos-ketua", "pos-wakil"])) {
    hasil.add("ketua");
  }
  if (peran.has("ptsp") || posisi.has("pos-ptsp")) hasil.add("ptsp");
  if (salahSatu(peran, ["operator", "admin", "super-admin"]) || posisi.has("pos-pranata-komputer")) {
    hasil.add("operator");
  }
  return KUNCI_PERAN.filter((k) => hasil.has(k));
}

/** Peran yang dibuka bila tidak diminta: yang sesuai jabatan utama, lalu urutan katalog. */
export function peranBawaan(aktor: Aktor, tersedia: KunciPeran[]): KunciPeran | "" {
  const utama = String(getEffectiveRoleId(aktor) ?? aktor.roleId ?? "");
  const posisi = String(getEffectivePositionId(aktor) ?? aktor.positionId ?? "");
  const calon: string[] = [];
  if (utama === "ketua" || utama === "wakil-ketua") calon.push("ketua");
  if (utama === "hakim") calon.push("hakim");
  if (utama === "panitera" || utama === "panitera-muda") calon.push("panitera");
  if (utama === "panitera-pengganti" || posisi === "pos-panitera-pengganti") calon.push("panitera-pengganti");
  if (utama === "jurusita" || posisi === "pos-jurusita" || posisi === "pos-jurusita-pengganti") calon.push("jurusita");
  if (posisi === "pos-ptsp") calon.push("ptsp");
  if (utama === "operator" || utama === "admin" || utama === "super-admin") calon.push("operator");
  const pilihan = calon.find((c) => tersedia.includes(c as KunciPeran)) as KunciPeran | undefined;
  return pilihan ?? tersedia[0] ?? "";
}

/** Kredensial SIPP tersimpan di ALETA - seluruh pengguna, dibaca segar tiap permintaan (tabel kecil, lokal). */
export type KredensialSipp = { userId: string; username: string; aktif: boolean; keadaan: string };

function kunciUsername(username: string): string {
  return String(username ?? "").trim().toLowerCase();
}

/** Hasil uji yang membuktikan kredensial itu TIDAK dapat dipakai masuk SIPP. */
const KEADAAN_TERBUKTI_SALAH = new Set<string>([
  KEADAAN_KREDENSIAL.SANDI_SALAH,
  KEADAAN_KREDENSIAL.TIDAK_TERDAFTAR,
  KEADAAN_KREDENSIAL.DIBLOKIR,
]);

/** Kekuatan bukti kepemilikan: teruji sah > belum/tak dapat diuji > terbukti salah. */
function bobotKredensial(keadaan: string): number {
  if (keadaan === KEADAAN_KREDENSIAL.SAH) return 2;
  return KEADAAN_TERBUKTI_SALAH.has(keadaan) ? 0 : 1;
}

export type PemilikUsername = { pemilik: string | null; pengklaim: KredensialSipp[] };

/**
 * Pemilik tiap username SIPP di antara pengguna ALETA yang menyimpannya.
 *
 * bacaPemetaanJabatan menautkan username ke pengguna TERAKHIR yang
 * menyimpannya (Map.set menimpa) dan tidak melihat is_enabled - pemeriksa
 * mandiri membuktikannya: kredensial nonaktif bersandi salah tetap menautkan
 * juru sita ke perkara hakim 26, dan dari dua pengguna yang menyimpan
 * username yang sama, yang belum teruji mengalahkan yang teruji. Layar
 * penetapan memakai fungsi itu apa adanya, jadi aturannya ditulis di sini:
 *
 *   - hanya kredensial AKTIF yang mengaku;
 *   - yang hasil ujinya paling kuat menang (bobotKredensial);
 *   - seri pada yang terkuat berarti TIDAK ADA pemilik - lebih baik belum
 *     tertaut (dan disebut) daripada menebak.
 */
export function tentukanPemilikSipp(kredensial: KredensialSipp[]): Map<string, PemilikUsername> {
  const per = new Map<string, KredensialSipp[]>();
  for (const k of kredensial) {
    const kunci = kunciUsername(k.username);
    if (!k.aktif || !kunci || !k.userId) continue;
    const daftar = per.get(kunci) ?? [];
    daftar.push(k);
    per.set(kunci, daftar);
  }
  const hasil = new Map<string, PemilikUsername>();
  for (const [kunci, daftar] of per) {
    const puncak = Math.max(...daftar.map((k) => bobotKredensial(k.keadaan)));
    const teratas = new Set(daftar.filter((k) => bobotKredensial(k.keadaan) === puncak).map((k) => k.userId));
    hasil.set(kunci, { pemilik: teratas.size === 1 ? [...teratas][0] : null, pengklaim: daftar });
  }
  return hasil;
}

export async function bacaKredensialSipp(db: AletaDatabase): Promise<KredensialSipp[]> {
  const baris = await db.queryAll<{
    user_id: string | null;
    external_username: string | null;
    is_enabled: number | boolean | null;
    last_verified_status: string | null;
  }>(
    `SELECT user_id, external_username, is_enabled, last_verified_status
       FROM external_app_credentials WHERE app_id = 'sipp'`,
    []
  );
  return baris.map((b) => ({
    userId: String(b.user_id ?? ""),
    username: String(b.external_username ?? "").trim(),
    aktif: Number(b.is_enabled) === 1,
    keadaan: String(b.last_verified_status || KEADAAN_KREDENSIAL.BELUM_DIUJI),
  }));
}

/** Kalimat penautan untuk pengguna ini - supaya "belum tertaut" tidak pernah tanpa sebab. */
function catatanPenautan(kredensial: KredensialSipp[], pemilik: Map<string, PemilikUsername>, aktorId: string): string[] {
  const hasil: string[] = [];
  for (const k of kredensial.filter((x) => x.userId === aktorId)) {
    const nama = `"${k.username}"`;
    if (!k.aktif) {
      hasil.push(`Kredensial SIPP ${nama} dinonaktifkan di Manajemen Akun, sehingga tidak dipakai menautkan Anda ke perkara pejabat SIPP.`);
      continue;
    }
    const p = pemilik.get(kunciUsername(k.username));
    if (!p) continue;
    const lain = p.pengklaim.filter((x) => x.userId !== aktorId).length;
    if (p.pemilik === aktorId) {
      if (lain > 0) {
        hasil.push(
          `Username SIPP ${nama} juga tersimpan di ${lain} akun ALETA lain; penautannya tetap kepada Anda karena hasil uji password Anda yang terkuat. Periksa siapa yang menyimpannya di Manajemen Akun.`
        );
      }
      if (bobotKredensial(k.keadaan) === 0) {
        hasil.push(`Password SIPP untuk ${nama} tidak cocok lagi menurut uji terakhir; perbarui di Manajemen Akun.`);
      }
    } else if (p.pemilik === null) {
      hasil.push(
        `Username SIPP ${nama} tersimpan di lebih dari satu akun ALETA dengan hasil uji password yang setara, sehingga perkara pejabatnya tidak ditautkan ke siapa pun. Uji ulang password Anda di Manajemen Akun, atau hapus kredensial yang bukan milik Anda.`
      );
    } else {
      hasil.push(
        `Username SIPP ${nama} juga tersimpan di akun ALETA lain dengan hasil uji password yang lebih kuat, sehingga perkara pejabatnya tidak ditautkan ke akun Anda.`
      );
    }
  }
  return hasil;
}

/** Pemetaan jabatan SIPP (lewat jembatan bot) - sama bagi semua pengguna, disinggahkan satu untuk semua. */
async function pemetaanSatker(db: AletaDatabase, kini: number): Promise<PemetaanSatker> {
  if (singgahPemetaan && kini - singgahPemetaan.kapan < SINGGAH_MS) return singgahPemetaan.isi;
  return sekaliJalan("pemetaan", async () => {
    const isi = await bacaPemetaanJabatan(db);
    singgahPemetaan = { kapan: kini, isi };
    return isi;
  });
}

async function pemetaanSaya(db: AletaDatabase, aktor: Aktor, kini: number): Promise<PemetaanSaya> {
  const [satker, kredensial] = await Promise.all([pemetaanSatker(db, kini), bacaKredensialSipp(db)]);
  const pemilik = tentukanPemilikSipp(kredensial);
  const milikSaya = (username: string) => pemilik.get(kunciUsername(username))?.pemilik === aktor.id;
  return {
    ok: satker.ok,
    galat: satker.galat,
    // Akun SIPP menautkan pengguna ke perkara pejabatnya hanya bila ia
    // pemilik tunggal username itu (kredensial aktif, lihat
    // tentukanPemilikSipp) DAN akunnya tidak diblokir atau kedaluwarsa -
    // aturannya sama dengan pilihAkunPejabat: akun lama bekas pejabat lain
    // tidak boleh membuat seseorang memikul perkara orang lain.
    akun: satker.akun.filter((a) => milikSaya(a.username) && !a.diblokir && !a.kedaluwarsa),
    username: kredensial.filter((k) => k.userId === aktor.id && milikSaya(k.username)).map((k) => k.username),
    catatan: catatanPenautan(kredensial, pemilik, aktor.id),
  };
}

const JABATAN_PERAN: Partial<Record<KunciPeran, "hakim" | "panitera" | "jurusita">> = {
  hakim: "hakim",
  "panitera-pengganti": "panitera",
  jurusita: "jurusita",
};

const SEBUT_JABATAN: Record<string, string> = {
  hakim: "hakim",
  panitera: "panitera pengganti",
  jurusita: "juru sita",
};

function idPejabat(akun: AkunSiapPakai[], jabatan: string): string[] {
  return [...new Set(akun.filter((a) => a.jabatan === jabatan).map((a) => a.pejabatId).filter(Boolean))];
}

// ============================================================================
// BAHAN DARI BASIS DATA ALETA
// ============================================================================

function awalHariWita(konteks: KonteksChecklist): string {
  return new Date(`${konteks.tanggal}T00:00:00+08:00`).toISOString();
}

async function bahanAleta(
  db: AletaDatabase,
  peran: KunciPeran,
  aktor: Aktor,
  pemetaan: PemetaanSaya,
  konteks: KonteksChecklist,
  galat: string[]
): Promise<TambahanAleta> {
  const tambahan: TambahanAleta = { antrean: [], konsep: [] };
  const sejak = awalHariWita(konteks);

  const antrean = async (jenis: string[]): Promise<AntreanChecklist[]> => {
    try {
      return (await bacaAntreanChecklist(db, jenis, sejak, konteks.kini)).map((a) => ({
        id: a.id,
        perkaraId: a.perkaraId,
        nomorPerkara: a.nomorPerkara,
        jenis: a.jenis,
        keadaan: a.keadaan,
        disiapkanAt: a.disiapkanAt,
        dikerjakanAt: a.dikerjakanAt,
      }));
    } catch (e) {
      galat.push(`Antrean penetapan tidak terbaca: ${e instanceof Error ? e.message : String(e)}`);
      return [];
    }
  };

  if (peran === "hakim") {
    tambahan.antrean = await antrean(["phs"]);
    try {
      const akunSaya = pemetaan.akun;
      const usernames = usernameSipp(pemetaan);
      const nama = [String(aktor.name ?? ""), ...akunSaya.flatMap((a) => [a.nama, a.namaLengkap])].filter(Boolean);
      tambahan.konsep = (await bacaSemuaKonseptorSementara(db))
        .filter((t) => tunjukanMilikSaya(t, { usernames, nama }))
        .map<TunjukanKonsep>((t) => ({
          perkaraId: t.perkaraId,
          nomorPerkara: t.nomorPerkara,
          nama: t.nama,
          pengguna: t.pengguna,
          ditetapkanOleh: t.ditetapkanOleh,
          ditetapkanAt: t.ditetapkanAt,
        }));
    } catch (e) {
      galat.push(`Konseptor sementara tidak terbaca: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else if (peran === "panitera") {
    // Hanya yang BOLEH menekan PPP/PJS (mode ketat) yang ditagih - Panitera
    // Muda melihat papan kepaniteraan, tetapi titipan itu bukan pekerjaannya.
    const peranSaya = [String(aktor.roleId ?? ""), String(getEffectiveRoleId(aktor) ?? ""), ...(aktor.additionalRoleIds ?? [])];
    const jenis = ["ppp", "pjs"].filter((j) => peranSaya.some((r) => bolehMenetapkan(String(r), j, "ketat")));
    tambahan.antrean = await antrean(jenis);
  } else if (peran === "ketua") {
    tambahan.antrean = await antrean(["pmh"]);
  }
  return tambahan;
}

/**
 * Username SIPP milik pengguna: dari akun berjabatan yang menautkannya,
 * ditambah kredensial SIPP lain yang sah miliknya. Username yang juga
 * disimpan orang lain dengan uji lebih kuat TIDAK ikut - tunjukan konseptor
 * atas username itu milik orang lain.
 */
function usernameSipp(pemetaan: PemetaanSaya): string[] {
  return [...new Set([...pemetaan.akun.map((a) => a.username), ...pemetaan.username].filter(Boolean))];
}

// ============================================================================
// PENYUSUN
// ============================================================================

export type OpsiChecklist = {
  /** Nilai ?peran= apa adanya; yang tidak tersedia jatuh ke peran bawaan. */
  peranDiminta?: string;
  /** Jam acuan - hanya untuk uji dan pengukuran; tanpa singgahan. */
  kini?: Date;
};

export async function susunChecklist(
  db: AletaDatabase,
  aktor: Aktor,
  opsi: OpsiChecklist = {}
): Promise<JawabanChecklist> {
  const kini = opsi.kini ?? new Date();
  const detik = kini.getTime();
  const pemetaan = await pemetaanSaya(db, aktor, detik);
  const tersedia = tentukanPeran(aktor, pemetaan.akun);
  const diminta = String(opsi.peranDiminta ?? "").trim();
  const catatanPermintaan: string[] = [];

  let aktif: KunciPeran | "" = "";
  if (diminta && peranSah(diminta) && tersedia.includes(diminta)) {
    aktif = diminta;
  } else {
    aktif = peranBawaan(aktor, tersedia);
    if (diminta) {
      catatanPermintaan.push(
        `Peran "${diminta}" tidak tersedia untuk akun Anda${aktif ? `; ditampilkan peran ${LABEL_PERAN[aktif]}` : ""}.`
      );
    }
  }

  if (opsi.kini) return tempelCatatan(await hitung(db, aktor, aktif, tersedia, pemetaan, kini, false), catatanPermintaan);

  // Kunci singgahan memuat penautan pengguna saat ini: kredensial yang baru
  // disimpan atau dinonaktifkan tidak menunggu singgahan lamanya habis.
  const tautan = pemetaan.akun.map((a) => `${a.jabatan}:${a.pejabatId}`).sort().join(",");
  const kunciSinggah = `${aktor.id}|${aktif}|${tersedia.join(",")}|${tautan}`;
  const ada = singgahJawaban.get(kunciSinggah);
  if (ada && detik - ada.kapan < SINGGAH_MS) return tempelCatatan(ada.isi, catatanPermintaan);

  const jawaban = await sekaliJalan(`jawaban|${kunciSinggah}`, async () => {
    const isi = await hitung(db, aktor, aktif, tersedia, pemetaan, kini, true);
    simpanSinggah(singgahJawaban, kunciSinggah, isi, detik);
    return isi;
  });
  return tempelCatatan(jawaban, catatanPermintaan);
}

function tempelCatatan(jawaban: JawabanChecklist, catatan: string[]): JawabanChecklist {
  if (catatan.length === 0) return jawaban;
  return { ...jawaban, galat: [...catatan, ...jawaban.galat] };
}

/**
 * Fakta bot untuk satu permintaan. Disinggahkan menurut permintaannya - dua
 * pengguna dengan permintaan yang sama (seluruh peran satker, atau dua akun
 * ALETA milik pejabat yang sama) berbagi satu pembacaan SIPP. Jawaban gagal
 * tidak disinggahkan: permintaan berikutnya boleh mencoba lagi.
 */
async function faktaBot(permintaan: PermintaanBot, kini: number, bolehSinggah: boolean): Promise<JawabBot> {
  if (!bolehSinggah) return getGatewayChecklistMilestone(permintaan);
  const kunci = JSON.stringify([
    permintaan.peran,
    permintaan.acuan,
    ...[permintaan.hakim, permintaan.panitera, permintaan.jurusita, permintaan.perkara].map((x) => [...(x ?? [])].sort()),
  ]);
  const ada = singgahFakta.get(kunci);
  if (ada && kini - ada.kapan < SINGGAH_MS) return ada.isi;
  return sekaliJalan(`fakta|${kunci}`, async () => {
    const isi = await getGatewayChecklistMilestone(permintaan);
    if (isi.ok) simpanSinggah(singgahFakta, kunci, isi, kini);
    return isi;
  });
}

async function hitung(
  db: AletaDatabase,
  aktor: Aktor,
  aktif: KunciPeran | "",
  tersedia: KunciPeran[],
  pemetaan: PemetaanSaya,
  kini: Date,
  bolehSinggah: boolean
): Promise<JawabanChecklist> {
  const konteks = konteksDari(kini);
  const dasar = {
    pengguna: { nama: String(aktor.name ?? ""), peran: [...tersedia] as string[] },
    peranTersedia: tersedia.map((k) => ({ kunci: k, label: LABEL_PERAN[k] })),
    peranAktif: aktif,
    dibuat: kini.toISOString(),
  };
  const kosong: RingkasChecklist = { lewat: 0, hariIni: 0, mingguIni: 0, selesaiHariIni: 0, totalHariIni: 0 };

  if (!aktif) {
    return {
      ...dasar,
      ringkas: kosong,
      butir: [],
      jenisTidakTersedia: [],
      galat: [
        "Akun Anda belum punya peran yang memiliki checklist (hakim, panitera pengganti, juru sita, panitera, ketua, PTSP, atau operator), dan belum tertaut ke akun pejabat SIPP.",
        ...pemetaan.catatan,
      ],
    };
  }

  const galat: string[] = [...pemetaan.catatan];
  if (!pemetaan.ok) galat.push(`Pemetaan jabatan SIPP tidak terbaca: ${pemetaan.galat}`);

  const jabatan = JABATAN_PERAN[aktif];
  const id = {
    hakim: idPejabat(pemetaan.akun, "hakim"),
    panitera: idPejabat(pemetaan.akun, "panitera"),
    jurusita: idPejabat(pemetaan.akun, "jurusita"),
  };
  let sebabTakTertaut = "";
  if (jabatan && id[jabatan].length === 0) {
    sebabTakTertaut = pemetaan.ok
      ? `Akun ALETA Anda belum tertaut ke akun SIPP ${SEBUT_JABATAN[jabatan]}. Simpan username dan password SIPP Anda di Manajemen Akun supaya daftar ini dapat disaring ke perkara Anda.`
      : `Perkara Anda sebagai ${SEBUT_JABATAN[jabatan]} tidak dapat disaring karena pemetaan jabatan SIPP tidak terbaca.`;
  }

  const tambahan = await bahanAleta(db, aktif, aktor, pemetaan, konteks, galat);

  // Perkara tambahan yang keadaannya perlu dibaca dari SIPP: tunjukan
  // konseptor dan titipan PHS.
  const perkaraTambahan =
    aktif === "hakim"
      ? [...new Set([...tambahan.konsep.map((t) => t.perkaraId), ...tambahan.antrean.map((a) => a.perkaraId)])]
      : [];

  const jawabBot = await faktaBot(
    {
      peran: aktif,
      acuan: konteks.tanggal,
      hakim: aktif === "hakim" ? id.hakim : [],
      panitera: aktif === "panitera-pengganti" ? id.panitera : [],
      jurusita: aktif === "jurusita" ? id.jurusita : [],
      perkara: perkaraTambahan,
    },
    kini.getTime(),
    bolehSinggah
  );

  // Koleksi yang terpotong batas barisnya di bot - disebut, bukan diam.
  if (jawabBot.ok) for (const c of jawabBot.data?.catatan ?? []) galat.push(c);

  const hasil = nilaiChecklist({
    peran: aktif,
    konteks,
    fakta: jawabBot.ok ? ((jawabBot.data?.fakta ?? {}) as Record<string, unknown>) : null,
    gagalKoleksi: jawabBot.ok ? jawabBot.data?.gagal ?? {} : {},
    galatBot: jawabBot.ok ? "" : jawabBot.error,
    tambahan,
    sebabTakTertaut,
  });

  return {
    ...dasar,
    ringkas: hasil.ringkas,
    butir: hasil.butir,
    jenisTidakTersedia: hasil.jenisTidakTersedia,
    galat: [...galat, ...hasil.galat],
  };
}
