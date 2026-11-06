/**
 * ============================================================================
 * PERTIMBANGAN DARI ALAT BUKTI - CERAI, ITSBAT NIKAH, DISPENSASI KAWIN, HARTA BERSAMA, KEWARISAN, PENETAPAN AHLI WARIS (6-7 Nov 2026)
 * ============================================================================
 *
 * Penyusun murni (tanpa DOM, tanpa jaringan) untuk layar cetak ALETA ABT. Dari daftar alat bukti dan keadaan putusan, tersusun paragraf
 * pertimbangan menurut kartu aturan (kartu-pertimbangan-bukti.json). Semua bunyi berasal dari Blangko ABT by Derry Briantono; jenis bukti
 * yang tidak punya bunyi di blangko dilaporkan di belumAdaBunyi, tidak dikarang. Tidak menulis ke SIPP atau ABT.
 *
 * Usulan bunyi (kartu-usulan-bukti.json, 7 Nov 2026) terpisah dari blangko: kartu `disetujui: false` hanya dipulangkan di perluDisetujui, tidak
 * pernah masuk paragraf; `disetujui: true` menjadi usulan bercentang di belakang semua paragraf blangko. Jenis yang punya bunyi sendiri di blangko
 * tidak memakai kartu usulan.
 *
 * Keputusan pemilik yang dijalankan di sini:
 *  - bukti pokok tertulis otomatis, bukti pelengkap menjadi usulan;
 *  - kalimat "tidak dibantah" hanya bila lawan hadir dan tidak membantah;
 *  - dicabut: sebelum pembuktian kosong; pada agenda pembuktian kedua atau sesudahnya, bukti agenda sebelumnya menjadi usulan.
 *
 * Itsbat nikah (IN) dan dispensasi kawin (DK) adalah permohonan: tidak ada lawan, jadi tidak ada verstek dan tidak ada kalimat "tidak dibantah".
 * Kartu mereka memakai keadaan kabul, tolak, dan tdt (tidak dapat diterima) menurut blangko Kabul, Tolak, dan NO.
 *
 * Perkara kebendaan (7 Nov 2026): harta bersama (HB) dan kewarisan (KW) adalah gugatan seperti cerai gugat (verstek dan kontradiktoir), penetapan
 * ahli waris (PAW) adalah permohonan. Blangko mereka menilai bukti surat per KELOMPOK lewat rumus variabel 4807/4808 (HB) dan 4829/4830 (KW): rumus
 * itu menggolongkan baris bukti menurut kata kunci pada namanya (urutan CASE menentukan; jenisKebendaan menirunya), lalu menulis satu kalimat per
 * kelompok dengan daftar kode "P.1, P.2 dan P.3". Kalimat per kelompok ini diambil dari rumus (kartu ber-`rumus`), bukan dari SQL yang dijalankan.
 * Rumus itu tidak membedakan meterai atau pencocokan: kelompok hanya ditulis untuk bukti yang bermeterai cukup dan dicocokkan (syarat "lengkap").
 */

import { jenisBuktiDari, katalogDari, tanggalIndo, type BarisBukti } from "./bukti-tertulis";
import kartuJson from "./kartu-pertimbangan-bukti.json";
import kartuUsulanJson from "./kartu-usulan-bukti.json";

export type JenisCerai = "CG" | "CT";
/** CG cerai gugat, CT cerai talak, IN itsbat nikah, DK dispensasi kawin, HB harta bersama, KW kewarisan, PAW penetapan ahli waris. */
export type JenisPerkaraBukti = "CG" | "CT" | "IN" | "DK" | "HB" | "KW" | "PAW";
export type KeadaanKartu = "kabul-verstek" | "kabul" | "tolak-verstek" | "tolak" | "tdt";
/** elektronik0: bukti elektronik yang tidak dapat dicocokkan dan tidak disertai digital forensic, pada perkara yang lawannya hadir dan tidak membantah. */
export type SyaratKartu = "meterai0" | "cocok0" | "cocok1" | "aktaOtentik" | "lengkap" | "elektronik0";
export type AsalKartu = { folder: string; berkas: string; alinea: number; sisiSumber: "P" | "T" };
export type Kartu = {
  id: string;
  kunci: string[] | "*";
  perkara: JenisPerkaraBukti[];
  keadaan: KeadaanKartu[];
  sisi: "P" | "T" | "PT";
  kategori: "pokok" | "pelengkap";
  bunyi: string;
  asal: AsalKartu[];
  syarat?: SyaratKartu;
  kelompok?: boolean;
  /** Satu paragraf untuk bukti kedua sisi sekaligus ("para pihak"); kodenya gabungan P lalu T. Tidak memakai sebutan pihak menurut sisi. */
  sekali?: boolean;
  /** Kalimat kelompok ini diambil dari cabang rumus variabel blangko (no = nomor variabel Penggugat/Pemohon, cabang = k1, k2, ...). */
  rumus?: { no: string; cabang: string };
  /** Hanya bukti ke-1 sampai ke-maks dari jenis yang sama pada sisi itu (mis. dua KTP Pemohon). */
  maks?: number;
  /** Hanya bila anak Pemohon perempuan (P) atau laki-laki (L); kosong = keduanya. */
  anak?: "P" | "L";
  /** Isian yang wajib ada; bila kosong kartu tidak ditulis dan bukti dicatat di belumAdaBunyi. */
  butuh?: string[];
  catatan?: string;
  sumberKhusus?: string;
  /** Hal yang harus diperiksa pengguna sebelum paragraf dipakai; ditampilkan sesudah rujukan blangko. */
  periksa?: string;
};
export const KARTU_PERTIMBANGAN: readonly Kartu[] = (kartuJson as unknown as { kartu: Kartu[] }).kartu;

/** Bunyi susunan AI yang menunggu pemeriksaan pemilik; bukan dari blangko. */
export type KartuUsulan = {
  id: string;
  kunci: string;
  perkara: JenisPerkaraBukti[];
  keadaan: KeadaanKartu[];
  sisi: "P" | "T" | "PT";
  bunyi: string;
  /** Apa yang diterangkan bukti itu, tanpa kesimpulan. */
  isi: string;
  dasar: string[];
  perluDicek: string[];
  disetujui: boolean;
};
const dataUsulan = kartuUsulanJson as unknown as { kartu: KartuUsulan[]; bunyiTanpaAsli: Partial<Record<KeadaanKartu, string>> };
export const KARTU_USULAN: readonly KartuUsulan[] = dataUsulan.kartu;
export const BUNYI_TANPA_ASLI: Readonly<Partial<Record<KeadaanKartu, string>>> = dataUsulan.bunyiTanpaAsli;

export type BuktiMasuk = {
  sisi: "P" | "T";
  nomor: number;
  baris: BarisBukti;
  agendaKe?: number;
  /** Kode tanda seperti tertulis di naskah ("PK.2", "TR.3", "PK.2/TR.2"). Kosong: "P.n" atau "T.n" dari sisi dan nomor. Sisi hanya memilih bunyi. */
  kode?: string;
  /** Bukti elektronik (dibaca dari kalimat "bukti elektronik tersebut" di naskah). Jenisnya selalu "elektronik"; baris.nm memuat nama untuk tampilan. */
  elektronik?: boolean;
  /** Keadaan pemeriksaan bukti elektronik: 0 tidak dapat dicocokkan dan tanpa digital forensic, 1 dicocokkan dengan aslinya, 2 disertai hasil digital forensic; null tidak terbaca. */
  periksaEl?: 0 | 1 | 2 | null;
};
/** Isian tambahan untuk itsbat nikah, dispensasi kawin, dan kewarisan (pewaris); semuanya boleh kosong (bagian kalimat yang membutuhkannya tidak ditulis). */
export type IsianPermohonan = { alamat?: string; anak?: string; calon?: string; usiaAnak?: string; tglLahirAnak?: string; pewaris?: string };
export type KonteksPerkara = {
  /** Nama pengadilan. Kosong: ditulis "Pengadilan ini". */
  satker?: string;
  /** Sebutan majelis. Kosong: ditulis "Majelis Hakim". */
  majelis?: string;
  /** Kosong: pasal ditulis untuk RBg dan HIR sekaligus. */
  hukumAcara?: "RBg" | "HIR";
  /** Tanggal menikah (ISO atau teks). Kosong: bagian itu tidak ditulis. */
  tglNikah?: string;
  /** Itsbat dan dispensasi: jumlah Pemohon. Kosong dianggap dua (blangko "para Pemohon"); satu menghapus kata "para". */
  jumlahPemohon?: number;
  /** Dispensasi kawin: anak Pemohon perempuan (P, bawaan) atau laki-laki (L). */
  anak?: "P" | "L";
  isian?: IsianPermohonan;
};
export type MasukanPertimbangan = {
  /** Jenis perkara. Bila kosong dipakai jenisCerai (nama lama). */
  jenisPerkara?: JenisPerkaraBukti;
  jenisCerai?: JenisCerai;
  status: string;
  verstek: boolean;
  lawanHadir: boolean;
  lawanMembantah: boolean;
  /** 0 = belum ada pembuktian; 1 = agenda pembuktian pertama; dan seterusnya. Dipakai pada perkara dicabut. */
  agendaPembuktianKe: number;
  bukti: readonly BuktiMasuk[];
  konteks?: KonteksPerkara;
  /** Bawaan: kartu-usulan-bukti.json. */
  kartuUsulan?: readonly KartuUsulan[];
};
export type ParagrafBukti = { kode: string; kunci: string; bunyi: string; cara: "otomatis" | "usulan"; asal: string };
export type BelumAdaBunyi = { kode: string; kunci: string; nama: string; alasan: string };
/** Usulan yang belum diperiksa pemilik: hanya untuk ditinjau, tidak untuk paragraf atau teks salin. */
export type PerluDisetujui = { id: string; kode: string; kunci: string; nama: string; bunyi: string; dasar: string[] };
export type HasilPertimbangan = {
  /** Keadaan yang terbaca, dalam bahasa sehari-hari, untuk ditampilkan. */
  keadaan: string;
  paragraf: ParagrafBukti[];
  belumAdaBunyi: BelumAdaBunyi[];
  perluDisetujui: PerluDisetujui[];
  catatan: string[];
};

/** Jenis bukti yang punya bunyi sendiri (pokok) menurut jenis perkara; selebihnya pelengkap dan hanya menjadi usulan. */
export const POKOK_PERKARA: Readonly<Record<JenisPerkaraBukti, ReadonlySet<string>>> = {
  CG: new Set(["ktp", "nikah"]),
  CT: new Set(["ktp", "nikah"]),
  IN: new Set(["ktp"]),
  DK: new Set(["ktp", "kk", "nikah", "kia", "lahir", "ijazah", "tolak", "hamil", "bidan"]),
  HB: new Set(["kb-ktp", "kb-kk", "kb-nikah", "kb-cerai", "kb-tanah", "kb-kendaraan", "kb-uang"]),
  KW: new Set(["kb-ktp", "kb-kk", "kb-mati", "kb-nikah", "kb-lahir", "kb-silsilah", "kb-tanah", "kb-uang"]),
  PAW: new Set(["kb-surat"]),
};
/** Nama isian untuk pesan "Lengkapi dulu". */
export const LABEL_ISIAN: Readonly<Record<string, string>> = {
  alamat: "alamat Pemohon",
  anak: "nama anak (kolom Atas nama pada akta kelahiran, atau isian nama anak)",
  calon: "nama calon pasangan anak",
  oleh: "penerbit surat (kolom Dikeluarkan oleh)",
  fotokopi: "bukti yang berupa fotokopi",
};
/** Perkara kebendaan: harta bersama, kewarisan, dan penetapan ahli waris. */
export const perkaraKebendaan = (j: JenisPerkaraBukti) => j === "HB" || j === "KW" || j === "PAW";

/**
 * Golongan bukti surat menurut rumus blangko (variabel 4807/4808 harta bersama, 4829/4830 kewarisan): kata kunci pada nama bukti, diuji berurutan,
 * yang pertama cocok menang. Rumus menguji 140 huruf pertama baris bukti; di sini nama bukti, dengan satu spasi di belakang agar "foto " cocok.
 * Penetapan ahli waris tidak digolongkan: semua surat satu golongan "kb-surat".
 */
export function jenisKebendaan(nama: unknown, perkara: "HB" | "KW" | "PAW"): string {
  if (perkara === "PAW") return "kb-surat";
  const t = `${String(nama ?? "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 140)} `;
  const ada = (...kata: string[]) => kata.some((k) => t.includes(k));
  if (ada("kartu tanda penduduk", "ktp")) return "kb-ktp";
  if (ada("kartu keluarga")) return "kb-kk";
  const foto = ada("foto ", "foto-", "foto,", "tangkapan layar", "screenshot", "video", "rekaman");
  if (perkara === "HB") {
    if (ada("akta nikah", "buku nikah", "kutipan akta nikah")) return "kb-nikah";
    if (ada("akta cerai", "putusan")) return "kb-cerai";
    if (foto) return "kb-foto";
    if (ada("bpkb", "stnk", "kendaraan", "faktur")) return "kb-kendaraan";
    if (ada("sertifikat", "sertipikat", "hak milik", "hak guna", "akta jual beli", "ajb", "girik", "sppt", "pbb", "imb", "sporadik", "tanah", "rumah")) return "kb-tanah";
    if (ada("rekening", "tabungan", "deposito", "slip gaji", "kwitansi", "kuitansi", "kuintansi", "surat utang", "perjanjian kredit", "bank")) return "kb-uang";
    return "kb-lain";
  }
  if (ada("akta kematian", "keterangan kematian", "surat kematian", "keterangan meninggal")) return "kb-mati";
  if (ada("akta nikah", "buku nikah", "kutipan akta nikah")) return "kb-nikah";
  if (ada("akta kelahiran", "keterangan lahir", "surat kelahiran")) return "kb-lahir";
  if (ada("silsilah", "silsila", "keterangan ahli waris", "keterangan waris", "pernyataan ahli waris", "penetapan ahli waris")) return "kb-silsilah";
  if (foto) return "kb-foto";
  if (ada("rekening", "tabungan", "deposito", "bpjs", "taspen", "asuransi", "polis", "bank", "kwitansi", "kuitansi")) return "kb-uang";
  if (ada("sertifikat", "sertipikat", "hak milik", "akta jual beli", "ajb", "girik", "sppt", "pbb", "bpkb", "stnk", "tanah", "rumah", "kendaraan")) return "kb-tanah";
  return "kb-lain";
}

/** Kunci jenis satu bukti: bukti elektronik selalu "elektronik" (katalog surat tidak dipakai untuknya); perkara kebendaan memakai golongan rumus blangko. */
const jenisBPer = (b: BuktiMasuk, perkara: JenisPerkaraBukti): string =>
  b.elektronik ? "elektronik" : perkaraKebendaan(perkara) ? jenisKebendaan(b.baris.nm, perkara as "HB" | "KW" | "PAW") : jenisBuktiDari(b.baris.nm);
const kodeDari = (b: BuktiMasuk) => (b.kode && b.kode.trim() ? b.kode.trim() : `${b.sisi}.${b.nomor}`);

/** Jenis perkara dari teks jenis perkara SIPP. null bila belum punya bunyi (termasuk itsbat nikah kontensius, wasiat, hibah, wakaf). */
export function jenisPerkaraBukti(jenisPerkara: unknown): JenisPerkaraBukti | null {
  const t = String(jenisPerkara ?? "");
  if (/talak/i.test(t)) return "CT";
  if (/cerai/i.test(t)) return "CG";
  if (/dispensasi/i.test(t)) return "DK";
  if (/itsbat|istbat|isbat|pengesahan\s+perkawinan/i.test(t) && !/kontensius/i.test(t)) return "IN";
  if (/p3hp|ahli\s+waris/i.test(t)) return "PAW";
  if (/harta\s+bersama/i.test(t)) return "HB";
  if (/kewarisan|waris/i.test(t)) return "KW";
  return null;
}
export const permohonanBukti = (j: JenisPerkaraBukti) => j === "IN" || j === "DK" || j === "PAW";
/** Perkara yang kalimat "tidak dibantah"-nya ada di blangko (hanya cerai); kebendaan tidak punya. */
export const adaKalimatBantahan = (j: JenisPerkaraBukti) => j === "CG" || j === "CT";

/** Satu sebutan: "P.1", "P.1 dan P.2", "P.1, P.2 dan P.3". */
export function gabungKode(kode: readonly string[]): string {
  if (kode.length <= 1) return kode[0] ?? "";
  return `${kode.slice(0, -1).join(", ")} dan ${kode[kode.length - 1]}`;
}

/** Seperti gabungKode, tetapi tiga nomor berurutan atau lebih ditulis "P.1 sampai P.9" (cara blangko dispensasi kawin). */
export function gabungKodeRentang(b: readonly BuktiMasuk[]): string {
  const urut = [...b].sort((x, y) => x.nomor - y.nomor);
  const bagian: string[] = [];
  for (let i = 0; i < urut.length; ) {
    let j = i;
    while (j + 1 < urut.length && urut[j + 1].sisi === urut[i].sisi && urut[j + 1].nomor === urut[j].nomor + 1) j += 1;
    if (j - i >= 2) bagian.push(`${kodeDari(urut[i])} sampai ${kodeDari(urut[j])}`);
    else for (let n = i; n <= j; n += 1) bagian.push(kodeDari(urut[n]));
    i = j + 1;
  }
  return gabungKode(bagian);
}

/** Nama tanpa "bin/binti" dan tanpa "alias", huruf besar (sama dengan rumus nama tanpa bin di blangko). */
export function namaTanpaBin(nama: unknown): string {
  const t = ` ${String(nama ?? "").replace(/\s+/g, " ").trim().toUpperCase()} `;
  return t.split(" ALIAS ")[0].split(" BIN ")[0].split(" BINTI ")[0].trim();
}

type KeadaanBaca = { kunci: KeadaanKartu | "kosong" | "cabut"; teks: string };
export function bacaKeadaan(status: string, verstek: boolean, permohonan = false): KeadaanBaca {
  const s = String(status ?? "").toLowerCase();
  if (/gugur|damai/.test(s)) return { kunci: "kosong", teks: "Perkara gugur atau berakhir damai" };
  if (/cabut/.test(s)) return { kunci: "cabut", teks: "Perkara dicabut" };
  if (/tidak\s+dapat\s+diterima|niet|^no$/.test(s)) return { kunci: "tdt", teks: permohonan ? "Permohonan tidak dapat diterima" : "Gugatan atau permohonan tidak dapat diterima" };
  // Dikabulkan sebagian memakai bunyi blangko Dikabulkan (blangko tidak punya berkas terpisah untuk sebagian).
  if (/kabul/.test(s) && /sebagian/.test(s)) {
    if (permohonan) return { kunci: "kabul", teks: "Dikabulkan sebagian" };
    return verstek ? { kunci: "kabul-verstek", teks: "Dikabulkan sebagian, lawan tidak hadir (verstek)" } : { kunci: "kabul", teks: "Dikabulkan sebagian, lawan hadir" };
  }
  if (permohonan) {
    if (/tolak/.test(s)) return { kunci: "tolak", teks: "Ditolak" };
    if (/kabul/.test(s)) return { kunci: "kabul", teks: "Dikabulkan" };
    return { kunci: "kosong", teks: "Keadaan putusan belum terbaca" };
  }
  if (/tolak/.test(s)) return verstek ? { kunci: "tolak-verstek", teks: "Ditolak, lawan tidak hadir (verstek)" } : { kunci: "tolak", teks: "Ditolak, lawan hadir" };
  if (/kabul/.test(s)) return verstek ? { kunci: "kabul-verstek", teks: "Dikabulkan, lawan tidak hadir (verstek)" } : { kunci: "kabul", teks: "Dikabulkan, lawan hadir" };
  return { kunci: "kosong", teks: "Keadaan putusan belum terbaca" };
}

/** Pasal alat bukti (Pasal 284 RBg = Pasal 164 HIR), seperti variabel hukum acara di blangko. */
function pasalAlatBukti(h?: "RBg" | "HIR"): string {
  if (h === "HIR") return "Pasal 164 HIR";
  if (h === "RBg") return "Pasal 284 RBg";
  return "Pasal 284 RBg/Pasal 164 HIR";
}

function pasalAkta(h?: "RBg" | "HIR"): string {
  if (h === "HIR") return "Pasal 165 HIR";
  if (h === "RBg") return "Pasal 285 RBg";
  return "Pasal 285 RBg/Pasal 165 HIR";
}

/** Pasal akta di bawah tangan (variabel 11897: Pasal 288 RBg, atau Pasal 1875 KUHPerdata untuk HIR). */
function pasalBawahTangan(h?: "RBg" | "HIR"): string {
  if (h === "HIR") return "Pasal 1875 Kitab Undang-Undang Hukum Perdata";
  if (h === "RBg") return "Pasal 288 RBg";
  return "Pasal 288 RBg/Pasal 1875 Kitab Undang-Undang Hukum Perdata";
}

type Pengganti = Record<string, string>;
/** Isi kartu: segmen "tidak dibantah", segmen bersyarat [[...]] (hilang bila ada isian kosong), lalu penanda {nama}. */
export function isiKartu(bunyi: string, p: Pengganti, tanpaBantahan: boolean): string {
  let t = bunyi.replace(/\{\{tdkbantah\|([\s\S]*?)\}\}/g, (_, x: string) => (tanpaBantahan ? x : ""));
  t = t.replace(/\[\[([\s\S]*?)\]\]/g, (_, x: string) => {
    const nama = [...x.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    return nama.some((n) => !String(p[n] ?? "").trim()) ? "" : x;
  });
  return t
    .replace(/\{(\w+)\}/g, (_, n: string) => p[n] ?? "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+;/g, ";");
}

const cocok = (r: BarisBukti) => Number(r.cocok) || 0;
const meterai = (r: BarisBukti) => Number(r.meterai) || 0;
const bebas = (r: BarisBukti) => typeof r.manual === "string";
function lolosSyarat(s: SyaratKartu | undefined, b: BuktiMasuk, tanpaBantahan: boolean): boolean {
  if (!s) return true;
  if (s === "elektronik0") return Boolean(b.elektronik) && b.periksaEl === 0 && tanpaBantahan;
  if (b.elektronik) return false;
  const r = b.baris;
  if (s === "aktaOtentik") return katalogDari(r.nm)?.kuat === "Akta otentik";
  if (bebas(r)) return false;
  if (s === "meterai0") return meterai(r) === 0;
  if (s === "cocok0") return cocok(r) === 0;
  if (s === "cocok1") return cocok(r) === 1;
  return meterai(r) === 0 && cocok(r) === 0; // lengkap
}
const cocokKunci = (k: Kartu, jenis: string, pokok: ReadonlySet<string>) => (k.kunci === "*" ? jenis !== "elektronik" && !pokok.has(jenis) : k.kunci.includes(jenis));
const TANDA_BERKAS: Partial<Record<KeadaanKartu, RegExp>> = { kabul: /\[Kabul\]/, tolak: /\[Tolak\]/, tdt: /\[NO\]/ };
/** Rujukan blangko; bila ada, yang berasal dari blangko keadaan yang sedang disusun (Kabul, Tolak, atau NO) didahulukan. */
const TANDA_VERSTEK: Partial<Record<KeadaanKartu, RegExp>> = { "kabul-verstek": /\[Kabul Verstek\]/, "tolak-verstek": /\[Tolak Verstek\]/ };
const FOLDER_KEBENDAAN: Partial<Record<JenisPerkaraBukti, string>> = { HB: "4a ", KW: "4b ", PAW: "9 " };
/** Perkara kebendaan memilih rujukan di foldernya sendiri (kartu HB dan KW berbagi bunyi) dan mengenali berkas verstek. */
const rujukan = (k: Kartu, keadaan: KeadaanKartu, jenis: JenisPerkaraBukti) => {
  const folder = FOLDER_KEBENDAAN[jenis];
  const tanda = TANDA_BERKAS[keadaan] ?? (folder ? TANDA_VERSTEK[keadaan] : undefined);
  const daerah = folder ? k.asal.filter((x) => x.folder.startsWith(folder)) : k.asal;
  const a = (tanda ? daerah.find((x) => tanda.test(x.berkas)) : undefined) ?? daerah[0];
  if (!a) return k.sumberKhusus ?? "";
  const lokasi = `${a.folder}, ${a.berkas}, alinea ${a.alinea + 1}`;
  return k.rumus ? `Rumus variabel ${k.rumus.no} (cabang ${k.rumus.cabang}), dipanggil di ${lokasi}` : lokasi;
};

/** Jenis yang isinya tentang anak Pemohon (dispensasi kawin) dan yang aslinya dikeluarkan untuk perkara ini (bukan fotokopi menurut blangko). */
const JENIS_ANAK = new Set(["lahir", "kia", "ijazah"]);
const JENIS_ASLI = new Set(["tolak", "hamil", "bidan"]);
const TINGKAT = /\b(SD|MI|SMP|MTs|SLTP|SMA|SMK|MA|SLTA|Paket [ABC])\b/i;
const rapi = (x: unknown) => String(x ?? "").replace(/\s+/g, " ").trim();

/** Mengapa bukti elektronik tidak punya paragraf: blangko hanya menulisnya untuk satu keadaan. */
function alasanElektronik(b: BuktiMasuk, keadaan: KeadaanKartu, jenis: JenisPerkaraBukti, tanpaBantahan: boolean): string {
  const awal = "Blangko hanya memuat bunyi bukti elektronik";
  if (jenis === "HB") return keadaan === "kabul" ? "Blangko tidak memuat bunyi untuk bukti elektronik ini." : `${awal} pada putusan dikabulkan dengan lawan hadir.`;
  if (jenis === "KW" || jenis === "PAW") return "Blangko kewarisan dan penetapan ahli waris tidak memuat bunyi bukti elektronik terpisah.";
  if (jenis !== "CG" && jenis !== "CT") return "Blangko itsbat nikah dan dispensasi kawin tidak memuat bunyi bukti elektronik.";
  if (b.sisi !== "T") return `${awal} yang diajukan Tergugat atau Termohon.`;
  if (keadaan !== "kabul") return `${awal} pada putusan dikabulkan dengan lawan hadir.`;
  if (b.periksaEl !== 0) return `${awal} yang tidak dapat dicocokkan dengan aslinya dan tidak disertai digital forensic.`;
  if (!tanpaBantahan) return `${awal} yang tidak dibantah lawan.`;
  return "Blangko tidak memuat bunyi untuk bukti elektronik ini.";
}

function susunUntuk(
  keadaan: KeadaanKartu,
  m: MasukanPertimbangan,
  jenis: JenisPerkaraBukti,
  bukti: readonly BuktiMasuk[],
  paksaUsulan: boolean
): { paragraf: ParagrafBukti[]; belum: BelumAdaBunyi[]; perlu: PerluDisetujui[] } {
  const jenisB = (b: BuktiMasuk) => jenisBPer(b, jenis);
  const kebendaan = perkaraKebendaan(jenis);
  const k = m.konteks ?? {};
  const isian = k.isian ?? {};
  const permohonan = permohonanBukti(jenis);
  const pokok = POKOK_PERKARA[jenis];
  const tanpaBantahan = !permohonan && m.lawanHadir && !m.lawanMembantah && !m.verstek;
  const pihak = (s: "P" | "T") => (permohonan || jenis === "CT" ? (s === "P" ? "Pemohon" : "Termohon") : s === "P" ? "Penggugat" : "Tergugat");
  const anakGlobal =
    rapi(isian.anak) ||
    rapi(bukti.find((b) => JENIS_ANAK.has(jenisB(b)) && rapi(b.baris.an))?.baris.an);
  const dasar = (s: "P" | "T"): Pengganti => ({
    pihak: pihak(s),
    lawan: pihak(s === "P" ? "T" : "P"),
    penggugat: pihak("P"),
    tergugat: pihak("T"),
    pasalBawahTangan: pasalBawahTangan(k.hukumAcara),
    pewaris: rapi(isian.pewaris),
    almarhum: rapi(isian.pewaris) ? (/binti/i.test(isian.pewaris ?? "") ? "Almarhumah" : "Almarhum") : "",
    perkara: permohonan || jenis === "CT" ? "permohonan" : "gugatan",
    majelis: (k.majelis ?? "").trim() || "Majelis Hakim",
    satker: (k.satker ?? "").trim() || "Pengadilan ini",
    tglNikah: k.tglNikah ? tanggalIndo(k.tglNikah) : "",
    pasalAkta: pasalAkta(k.hukumAcara),
    pasalAlatBukti: pasalAlatBukti(k.hukumAcara),
    para: (k.jumlahPemohon ?? 2) >= 2 ? "para " : "",
    alamat: rapi(isian.alamat),
    anak: anakGlobal,
    calon: rapi(isian.calon),
    usiaAnak: rapi(isian.usiaAnak),
    tglLahirAnak: tanggalIndo(rapi(isian.tglLahirAnak)),
    kodeKeluarga: gabungKodeTerurut(bukti.filter((b) => b.sisi === s && ["kk", "nikah"].includes(jenisB(b)))),
  });
  /** Isian yang hanya dibaca dari baris bukti itu sendiri. */
  const dariBaris = (b: BuktiMasuk): Pengganti => {
    const r = b.baris;
    const j = jenisB(b);
    const an = rapi(r.an);
    const e: Pengganti = {
      namaTanpaBin: namaTanpaBin(r.an),
      oleh: rapi(r.oleh),
      tglIjazah: r.tgl ? tanggalIndo(r.tgl) : rapi(r.tglTeks),
      pendidikan: TINGKAT.exec(String(r.nm ?? ""))?.[1] ?? "",
    };
    if (an && JENIS_ANAK.has(j)) e.anak = an;
    if (an && (j === "hamil" || j === "bidan")) {
      e.anak = an;
      e.calon = an;
    }
    return e;
  };
  const kartuBerlaku = KARTU_PERTIMBANGAN.filter((x) => x.perkara.includes(jenis) && x.keadaan.includes(keadaan) && (!x.anak || x.anak === (k.anak ?? "P")));
  const paragraf: ParagrafBukti[] = [];
  const belum: BelumAdaBunyi[] = [];
  const catatBelum = (b: BuktiMasuk, alasan: string) => {
    const kode = kodeDari(b);
    if (!belum.some((x) => x.kode === kode && x.alasan === alasan)) belum.push({ kode, kunci: jenisB(b), nama: String(b.baris.nm ?? "").trim() || "Tanpa nama", alasan });
  };
  const keluar = (kar: Kartu, kode: string, jenisBukti: string, p: Pengganti) =>
    paragraf.push({ kode, kunci: jenisBukti, bunyi: isiKartu(kar.bunyi, p, tanpaBantahan), cara: paksaUsulan || kar.kategori === "pelengkap" ? "usulan" : "otomatis", asal: rujukan(kar, keadaan, jenis) + (kar.periksa ? `. Periksa: ${kar.periksa}` : "") });
  const kurang = (kar: Kartu, p: Pengganti) => (kar.butuh ?? []).filter((n) => !rapi(p[n]));

  const terbaca = new Set<BuktiMasuk>();
  const tahan = new Set<BuktiMasuk>();
  // Pada verstek lawan tidak hadir: bukti sisi T tidak punya bunyi (dicatat di belumAdaBunyi).
  const verstekKeadaan = keadaan.endsWith("-verstek");
  for (const sisi of ["P", "T"] as const) {
    if (verstekKeadaan && sisi === "T") continue;
    const baris = bukti.filter((b) => b.sisi === sisi);
    const urutanJenis = (b: BuktiMasuk) => baris.filter((x) => jenisB(x) === jenisB(b)).indexOf(b);
    for (const kar of kartuBerlaku) {
      if (!kar.sisi.includes(sisi)) continue;
      if (kar.sekali && sisi === "T") continue;
      const dasarBaris = kar.sekali ? bukti.filter((b) => !(verstekKeadaan && b.sisi === "T")) : baris;
      const cocokan = dasarBaris.filter((b) => cocokKunci(kar, jenisB(b), pokok) && (kar.maks == null || urutanJenis(b) < kar.maks));
      if (!cocokan.length) continue;
      const lolos = cocokan.filter((b) => lolosSyarat(kar.syarat, b, tanpaBantahan));
      if (!lolos.length) continue;
      if (kar.kelompok) {
        const kodeSemua = gabungKodeTerurut(lolos);
        const asli = lolos.filter((b) => JENIS_ASLI.has(jenisB(b)));
        const fotokopi = lolos.filter((b) => !JENIS_ASLI.has(jenisB(b)));
        const p = { ...dasar(sisi), kode: kodeSemua, fotokopi: gabungKodeRentang(fotokopi), asli: gabungKodeTerurut(asli), berkaitan: gabungKodeRentang(fotokopi) };
        const kurangnya = kurang(kar, p);
        if (kurangnya.length) {
          for (const b of lolos) {
            tahan.add(b);
            catatBelum(b, `Lengkapi dulu: ${kurangnya.map((n) => LABEL_ISIAN[n] ?? n).join(", ")}.`);
          }
          continue;
        }
        keluar(kar, kodeSemua, Array.isArray(kar.kunci) ? kar.kunci.join("/") : "*", p);
        // Perkara kebendaan: alinea umum (tanpa {kode}, mis. penilaian formil) tidak menggantikan kalimat kelompok bukti itu; bukti elektronik hanya punya alinea umum.
        const perBukti = !kebendaan || kar.bunyi.includes("{kode}") || kar.kunci.includes("elektronik");
        if (kar.kunci !== "*" && perBukti) lolos.forEach((b) => terbaca.add(b));
      } else {
        for (const b of lolos) {
          const p = { ...dasar(sisi), kode: kodeDari(b), ...dariBaris(b) };
          const kurangnya = kurang(kar, p);
          if (kurangnya.length) {
            tahan.add(b);
            catatBelum(b, `Lengkapi dulu: ${kurangnya.map((n) => LABEL_ISIAN[n] ?? n).join(", ")}.`);
            continue;
          }
          keluar(kar, kodeDari(b), jenisB(b), p);
          terbaca.add(b);
        }
      }
    }
  }
  // Kartu usulan, sesudah semua kartu blangko supaya blangko tetap di depan. Jenis yang punya bunyi sendiri di blangko tidak memakainya.
  const punyaBunyiSendiri = (j: string) => kartuBerlaku.some((x) => x.kunci !== "*" && x.kunci.includes(j) && !x.syarat);
  const perlu: PerluDisetujui[] = [];
  for (const b of bukti) {
    const r = b.baris;
    const j = jenisB(b);
    if (!j || punyaBunyiSendiri(j)) continue;
    const kar = (m.kartuUsulan ?? KARTU_USULAN).find((x) => x.kunci === j && x.perkara.includes(jenis) && x.keadaan.includes(keadaan) && x.sisi.includes(b.sisi));
    if (!kar) continue;
    // Meterai atau pencocokan yang tidak punya bunyi: tidak ada usulan, keterangan di belumAdaBunyi tetap berlaku.
    if (!bebas(r) && (meterai(r) === 1 || meterai(r) === 2 || cocok(r) === 2 || cocok(r) === 3)) continue;
    const kode = kodeDari(b);
    const tanpaAsli = !bebas(r) && cocok(r) === 1;
    if (tanpaAsli && paragraf.some((p) => /tidak dapat dicocokkan/.test(p.bunyi) && p.kode.split(/,\s*|\s+dan\s+/).includes(kode))) continue;
    const bunyi = isiKartu(tanpaAsli ? (BUNYI_TANPA_ASLI[keadaan] ?? kar.bunyi) : kar.bunyi, { ...dasar(b.sisi), kode, ...dariBaris(b) }, false);
    if (kar.disetujui) {
      paragraf.push({ kode, kunci: j, bunyi, cara: "usulan", asal: "usulan yang sudah Bapak setujui, bukan dari blangko" });
      terbaca.add(b);
    } else {
      perlu.push({ id: kar.id, kode, kunci: j, nama: String(r.nm).trim(), bunyi, dasar: tanpaAsli ? [] : kar.dasar });
    }
  }
  // Bagian isian yang tidak punya bunyi di blangko.
  for (const b of bukti) {
    const r = b.baris;
    if (b.elektronik) {
      if (!terbaca.has(b)) catatBelum(b, alasanElektronik(b, keadaan, jenis, tanpaBantahan));
      continue;
    }
    const sebelum = belum.length;
    if ((keadaan === "kabul" || kebendaan) && !bebas(r)) {
      if (meterai(r) === 1 || meterai(r) === 2) catatBelum(b, "Blangko hanya memuat bunyi bukti bermeterai cukup dan dinazegelen.");
      if (cocok(r) === 2 || cocok(r) === 3) catatBelum(b, "Blangko tidak memuat bunyi pencocokan dari fotokopi atau dari kopian sebelumnya.");
    }
    if (kebendaan) {
      if (!terbaca.has(b) && !tahan.has(b) && belum.length === sebelum)
        catatBelum(b, verstekKeadaan && b.sisi === "T" ? "Pada verstek lawan tidak hadir, blangko tidak memuat bukti sisi lawan." : bebas(r)
            ? "Bukti disunting bebas, bunyi blangko tidak berlaku."
            : jenis === "PAW"
              ? "Bunyi per bukti di blangko penetapan ahli waris terikat susunan ahli waris tertentu, jadi tidak dipakai."
              : "Blangko tidak memuat bunyi untuk bukti ini pada keadaan yang dipilih.");
      continue;
    }
    if (tahan.has(b) && !terbaca.has(b)) continue;
    if (keadaan === "tolak" && !terbaca.has(b)) {
      catatBelum(b, b.sisi === "P" && pokok.has(jenisB(b)) ? "Isian meterai atau pencocokan berbeda dari bunyi blangko Ditolak." : "Blangko Ditolak hanya memuat bunyi bukti surat pokok sisi penggugat atau pemohon.");
    } else if (keadaan !== "tolak" && !terbaca.has(b)) {
      const j = jenisB(b);
      catatBelum(b, j && !pokok.has(j) ? "Blangko tidak memuat bunyi untuk jenis bukti ini." : "Blangko tidak memuat bunyi untuk bukti ini pada keadaan yang dipilih.");
    }
  }
  return { paragraf, belum, perlu };
}

function gabungKodeTerurut(b: readonly BuktiMasuk[]): string {
  const urutSisi = (x: BuktiMasuk) => (x.sisi === "P" ? 0 : 1);
  return gabungKode([...b].sort((x, y) => urutSisi(x) - urutSisi(y) || x.nomor - y.nomor).map(kodeDari));
}

/** Penyusun utama. Lihat catatan berkas untuk aturan keadaan. */
export function susunParagrafBukti(m: MasukanPertimbangan): HasilPertimbangan {
  const jenis = (m.jenisPerkara ?? m.jenisCerai ?? "CG") as JenisPerkaraBukti;
  const permohonan = permohonanBukti(jenis);
  const verstek = permohonan ? false : m.verstek;
  const bacaan = bacaKeadaan(m.status, verstek, permohonan);
  const kosong = (catatan: string[]): HasilPertimbangan => ({ keadaan: bacaan.teks, paragraf: [], belumAdaBunyi: [], perluDisetujui: [], catatan });
  const daftar = m.bukti.filter((b) => b && b.baris && String(b.baris.nm ?? "").trim());
  const belumSemua = (alasan: string) => daftar.map((b) => ({ kode: kodeDari(b), kunci: jenisBPer(b, jenis), nama: String(b.baris.nm).trim(), alasan }));
  if (bacaan.kunci === "kosong") return kosong([bacaan.teks === "Keadaan putusan belum terbaca" ? "Status putusan tidak dikenali, jadi tidak ada paragraf." : "Pada keadaan ini tidak ada paragraf pertimbangan bukti."]);
  if (jenis === "DK" && (m.konteks?.jumlahPemohon ?? 2) < 2)
    return {
      keadaan: bacaan.teks,
      paragraf: [],
      belumAdaBunyi: belumSemua("Blangko dispensasi kawin hanya ditulis untuk dua Pemohon (kedua orang tua)."),
      perluDisetujui: [],
      catatan: ["Dengan satu Pemohon, blangko dispensasi kawin tidak punya bunyi bukti; jumlah Pemohon dapat diubah di atas."],
    };
  if (bacaan.kunci === "tdt") {
    if (!KARTU_PERTIMBANGAN.some((x) => x.perkara.includes(jenis) && x.keadaan.includes("tdt")))
      return {
        keadaan: bacaan.teks,
        paragraf: [],
        belumAdaBunyi: belumSemua("Blangko Tidak Dapat Diterima tidak memuat bunyi per alat bukti."),
        perluDisetujui: [],
        catatan: ["Putusan berhenti pada syarat formil; blangko tidak menguraikan alat bukti satu per satu."],
      };
    const hasil = susunUntuk("tdt", m, jenis, daftar, false);
    return { keadaan: bacaan.teks, paragraf: hasil.paragraf, belumAdaBunyi: hasil.belum, perluDisetujui: hasil.perlu, catatan: ["Tidak dapat diterima: hanya blangko NO yang memuat penilaian bukti yang dipakai; bunyi lain tidak ada."] };
  }
  if (bacaan.kunci === "cabut") {
    const agenda = Number(m.agendaPembuktianKe) || 0;
    if (agenda < 2) return kosong([agenda < 1 ? "Dicabut sebelum ada pembuktian: tidak ada paragraf." : "Dicabut pada agenda pembuktian pertama: belum ada pembuktian sebelumnya yang dapat ditawarkan."]);
    const lama = daftar.filter((b) => (b.agendaKe ?? 1) < agenda);
    const hasil = susunUntuk(verstek ? "kabul-verstek" : "kabul", m, jenis, lama, true);
    return { keadaan: bacaan.teks, paragraf: hasil.paragraf, belumAdaBunyi: hasil.belum, perluDisetujui: hasil.perlu, catatan: [`Dicabut pada agenda pembuktian ke-${agenda}: bukti pembuktian sebelumnya ditawarkan sebagai usulan.`] };
  }
  const hasil = susunUntuk(bacaan.kunci, m, jenis, daftar, false);
  const catatan: string[] = [];
  if (bacaan.kunci === "tolak" || bacaan.kunci === "tolak-verstek") catatan.push("Ditolak: bukti dinilai tanpa menyimpulkan bahwa dalil terbukti.");
  if (jenis === "PAW") catatan.push("Penetapan ahli waris: hanya pertimbangan umum bukti tertulis dari blangko yang dipakai; kalimat per bukti di blangko hanya untuk susunan ahli waris tertentu (anak kandung, pasangan dan orang tua pewaris telah meninggal).");
  if (/sebagian/.test(bacaan.teks)) catatan.push("Dikabulkan sebagian: bunyi blangko Dikabulkan dipakai. Periksa kembali bukti objek yang tidak dikabulkan.");
  return { keadaan: bacaan.teks, paragraf: hasil.paragraf, belumAdaBunyi: hasil.belum, perluDisetujui: hasil.perlu, catatan };
}
