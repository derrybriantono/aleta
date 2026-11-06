/**
 * ============================================================================
 * PERTIMBANGAN DARI ALAT BUKTI - CERAI GUGAT, CERAI TALAK, ITSBAT NIKAH, DISPENSASI KAWIN (6 Nov 2026)
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
 */

import { jenisBuktiDari, katalogDari, tanggalIndo, type BarisBukti } from "./bukti-tertulis";
import kartuJson from "./kartu-pertimbangan-bukti.json";
import kartuUsulanJson from "./kartu-usulan-bukti.json";

export type JenisCerai = "CG" | "CT";
/** CG cerai gugat, CT cerai talak, IN itsbat nikah, DK dispensasi kawin. */
export type JenisPerkaraBukti = "CG" | "CT" | "IN" | "DK";
export type KeadaanKartu = "kabul-verstek" | "kabul" | "tolak-verstek" | "tolak" | "tdt";
export type SyaratKartu = "meterai0" | "cocok0" | "cocok1" | "aktaOtentik" | "lengkap";
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
  /** Hanya bukti ke-1 sampai ke-maks dari jenis yang sama pada sisi itu (mis. dua KTP Pemohon). */
  maks?: number;
  /** Hanya bila anak Pemohon perempuan (P) atau laki-laki (L); kosong = keduanya. */
  anak?: "P" | "L";
  /** Isian yang wajib ada; bila kosong kartu tidak ditulis dan bukti dicatat di belumAdaBunyi. */
  butuh?: string[];
  catatan?: string;
  sumberKhusus?: string;
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
};
/** Isian tambahan untuk itsbat nikah dan dispensasi kawin; semuanya boleh kosong (bagian kalimat yang membutuhkannya tidak ditulis). */
export type IsianPermohonan = { alamat?: string; anak?: string; calon?: string; usiaAnak?: string; tglLahirAnak?: string };
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
};
/** Nama isian untuk pesan "Lengkapi dulu". */
export const LABEL_ISIAN: Readonly<Record<string, string>> = {
  alamat: "alamat Pemohon",
  anak: "nama anak (kolom Atas nama pada akta kelahiran, atau isian nama anak)",
  calon: "nama calon pasangan anak",
  oleh: "penerbit surat (kolom Dikeluarkan oleh)",
  fotokopi: "bukti yang berupa fotokopi",
};
const kodeDari = (b: BuktiMasuk) => (b.kode && b.kode.trim() ? b.kode.trim() : `${b.sisi}.${b.nomor}`);

/** Jenis perkara dari teks jenis perkara SIPP. null bila belum punya bunyi (termasuk itsbat nikah kontensius). */
export function jenisPerkaraBukti(jenisPerkara: unknown): JenisPerkaraBukti | null {
  const t = String(jenisPerkara ?? "");
  if (/talak/i.test(t)) return "CT";
  if (/cerai/i.test(t)) return "CG";
  if (/dispensasi/i.test(t)) return "DK";
  if (/itsbat|istbat|isbat|pengesahan\s+perkawinan/i.test(t) && !/kontensius/i.test(t)) return "IN";
  return null;
}
export const permohonanBukti = (j: JenisPerkaraBukti) => j === "IN" || j === "DK";

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
  if (permohonan) {
    if (/tolak/.test(s)) return { kunci: "tolak", teks: "Ditolak" };
    if (/kabul/.test(s)) return { kunci: "kabul", teks: "Dikabulkan" };
    return { kunci: "kosong", teks: "Keadaan putusan belum terbaca" };
  }
  if (/tolak/.test(s)) return verstek ? { kunci: "tolak-verstek", teks: "Ditolak, lawan tidak hadir (verstek)" } : { kunci: "tolak", teks: "Ditolak, lawan hadir" };
  if (/kabul/.test(s)) return verstek ? { kunci: "kabul-verstek", teks: "Dikabulkan, lawan tidak hadir (verstek)" } : { kunci: "kabul", teks: "Dikabulkan, lawan hadir" };
  return { kunci: "kosong", teks: "Keadaan putusan belum terbaca" };
}

function pasalAkta(h?: "RBg" | "HIR"): string {
  if (h === "HIR") return "Pasal 165 HIR";
  if (h === "RBg") return "Pasal 285 RBg";
  return "Pasal 285 RBg/Pasal 165 HIR";
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
function lolosSyarat(s: SyaratKartu | undefined, b: BuktiMasuk): boolean {
  if (!s) return true;
  const r = b.baris;
  if (s === "aktaOtentik") return katalogDari(r.nm)?.kuat === "Akta otentik";
  if (bebas(r)) return false;
  if (s === "meterai0") return meterai(r) === 0;
  if (s === "cocok0") return cocok(r) === 0;
  if (s === "cocok1") return cocok(r) === 1;
  return meterai(r) === 0 && cocok(r) === 0; // lengkap
}
const cocokKunci = (k: Kartu, jenis: string, pokok: ReadonlySet<string>) => (k.kunci === "*" ? !pokok.has(jenis) : k.kunci.includes(jenis));
const TANDA_BERKAS: Partial<Record<KeadaanKartu, RegExp>> = { kabul: /\[Kabul\]/, tolak: /\[Tolak\]/, tdt: /\[NO\]/ };
/** Rujukan blangko; bila ada, yang berasal dari blangko keadaan yang sedang disusun (Kabul, Tolak, atau NO) didahulukan. */
const rujukan = (k: Kartu, keadaan: KeadaanKartu) => {
  const tanda = TANDA_BERKAS[keadaan];
  const a = (tanda ? k.asal.find((x) => tanda.test(x.berkas)) : undefined) ?? k.asal[0];
  return a ? `${a.folder}, ${a.berkas}, alinea ${a.alinea + 1}` : (k.sumberKhusus ?? "");
};

/** Jenis yang isinya tentang anak Pemohon (dispensasi kawin) dan yang aslinya dikeluarkan untuk perkara ini (bukan fotokopi menurut blangko). */
const JENIS_ANAK = new Set(["lahir", "kia", "ijazah"]);
const JENIS_ASLI = new Set(["tolak", "hamil", "bidan"]);
const TINGKAT = /\b(SD|MI|SMP|MTs|SLTP|SMA|SMK|MA|SLTA|Paket [ABC])\b/i;
const rapi = (x: unknown) => String(x ?? "").replace(/\s+/g, " ").trim();

function susunUntuk(
  keadaan: KeadaanKartu,
  m: MasukanPertimbangan,
  jenis: JenisPerkaraBukti,
  bukti: readonly BuktiMasuk[],
  paksaUsulan: boolean
): { paragraf: ParagrafBukti[]; belum: BelumAdaBunyi[]; perlu: PerluDisetujui[] } {
  const k = m.konteks ?? {};
  const isian = k.isian ?? {};
  const permohonan = permohonanBukti(jenis);
  const pokok = POKOK_PERKARA[jenis];
  const tanpaBantahan = !permohonan && m.lawanHadir && !m.lawanMembantah && !m.verstek;
  const pihak = (s: "P" | "T") => (permohonan || jenis === "CT" ? (s === "P" ? "Pemohon" : "Termohon") : s === "P" ? "Penggugat" : "Tergugat");
  const anakGlobal =
    rapi(isian.anak) ||
    rapi(bukti.find((b) => JENIS_ANAK.has(jenisBuktiDari(b.baris.nm)) && rapi(b.baris.an))?.baris.an);
  const dasar = (s: "P" | "T"): Pengganti => ({
    pihak: pihak(s),
    lawan: pihak(s === "P" ? "T" : "P"),
    perkara: permohonan || jenis === "CT" ? "permohonan" : "gugatan",
    majelis: (k.majelis ?? "").trim() || "Majelis Hakim",
    satker: (k.satker ?? "").trim() || "Pengadilan ini",
    tglNikah: k.tglNikah ? tanggalIndo(k.tglNikah) : "",
    pasalAkta: pasalAkta(k.hukumAcara),
    para: (k.jumlahPemohon ?? 2) >= 2 ? "para " : "",
    alamat: rapi(isian.alamat),
    anak: anakGlobal,
    calon: rapi(isian.calon),
    usiaAnak: rapi(isian.usiaAnak),
    tglLahirAnak: tanggalIndo(rapi(isian.tglLahirAnak)),
    kodeKeluarga: gabungKodeTerurut(bukti.filter((b) => b.sisi === s && ["kk", "nikah"].includes(jenisBuktiDari(b.baris.nm)))),
  });
  /** Isian yang hanya dibaca dari baris bukti itu sendiri. */
  const dariBaris = (b: BuktiMasuk): Pengganti => {
    const r = b.baris;
    const j = jenisBuktiDari(r.nm);
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
    if (!belum.some((x) => x.kode === kode && x.alasan === alasan)) belum.push({ kode, kunci: jenisBuktiDari(b.baris.nm), nama: String(b.baris.nm ?? "").trim() || "Tanpa nama", alasan });
  };
  const keluar = (kar: Kartu, kode: string, jenisBukti: string, p: Pengganti) =>
    paragraf.push({ kode, kunci: jenisBukti, bunyi: isiKartu(kar.bunyi, p, tanpaBantahan), cara: paksaUsulan || kar.kategori === "pelengkap" ? "usulan" : "otomatis", asal: rujukan(kar, keadaan) });
  const kurang = (kar: Kartu, p: Pengganti) => (kar.butuh ?? []).filter((n) => !rapi(p[n]));

  const terbaca = new Set<BuktiMasuk>();
  const tahan = new Set<BuktiMasuk>();
  for (const sisi of ["P", "T"] as const) {
    const baris = bukti.filter((b) => b.sisi === sisi);
    const urutanJenis = (b: BuktiMasuk) => baris.filter((x) => jenisBuktiDari(x.baris.nm) === jenisBuktiDari(b.baris.nm)).indexOf(b);
    for (const kar of kartuBerlaku) {
      if (!kar.sisi.includes(sisi)) continue;
      const cocokan = baris.filter((b) => cocokKunci(kar, jenisBuktiDari(b.baris.nm), pokok) && (kar.maks == null || urutanJenis(b) < kar.maks));
      if (!cocokan.length) continue;
      const lolos = cocokan.filter((b) => lolosSyarat(kar.syarat, b));
      if (!lolos.length) continue;
      if (kar.kelompok) {
        const kodeSemua = gabungKodeTerurut(lolos);
        const asli = lolos.filter((b) => JENIS_ASLI.has(jenisBuktiDari(b.baris.nm)));
        const fotokopi = lolos.filter((b) => !JENIS_ASLI.has(jenisBuktiDari(b.baris.nm)));
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
        if (kar.kunci !== "*") lolos.forEach((b) => terbaca.add(b));
      } else {
        for (const b of lolos) {
          const p = { ...dasar(sisi), kode: kodeDari(b), ...dariBaris(b) };
          const kurangnya = kurang(kar, p);
          if (kurangnya.length) {
            tahan.add(b);
            catatBelum(b, `Lengkapi dulu: ${kurangnya.map((n) => LABEL_ISIAN[n] ?? n).join(", ")}.`);
            continue;
          }
          keluar(kar, kodeDari(b), jenisBuktiDari(b.baris.nm), p);
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
    const j = jenisBuktiDari(r.nm);
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
    if (keadaan === "kabul" && !bebas(r)) {
      if (meterai(r) === 1 || meterai(r) === 2) catatBelum(b, "Blangko hanya memuat bunyi bukti bermeterai cukup dan dinazegelen.");
      if (cocok(r) === 2 || cocok(r) === 3) catatBelum(b, "Blangko tidak memuat bunyi pencocokan dari fotokopi atau dari kopian sebelumnya.");
    }
    if (tahan.has(b) && !terbaca.has(b)) continue;
    if (keadaan === "tolak" && !terbaca.has(b)) {
      catatBelum(b, b.sisi === "P" && pokok.has(jenisBuktiDari(b.baris.nm)) ? "Isian meterai atau pencocokan berbeda dari bunyi blangko Ditolak." : "Blangko Ditolak hanya memuat bunyi bukti surat pokok sisi penggugat atau pemohon.");
    } else if (keadaan !== "tolak" && !terbaca.has(b)) {
      const j = jenisBuktiDari(b.baris.nm);
      catatBelum(b, j && !pokok.has(j) ? "Blangko tidak memuat bunyi untuk jenis bukti ini." : "Blangko tidak memuat bunyi untuk bukti ini pada keadaan yang dipilih.");
    }
  }
  return { paragraf, belum, perlu };
}

function gabungKodeTerurut(b: readonly BuktiMasuk[]): string {
  return gabungKode([...b].sort((x, y) => x.nomor - y.nomor).map(kodeDari));
}

/** Penyusun utama. Lihat catatan berkas untuk aturan keadaan. */
export function susunParagrafBukti(m: MasukanPertimbangan): HasilPertimbangan {
  const jenis = (m.jenisPerkara ?? m.jenisCerai ?? "CG") as JenisPerkaraBukti;
  const permohonan = permohonanBukti(jenis);
  const verstek = permohonan ? false : m.verstek;
  const bacaan = bacaKeadaan(m.status, verstek, permohonan);
  const kosong = (catatan: string[]): HasilPertimbangan => ({ keadaan: bacaan.teks, paragraf: [], belumAdaBunyi: [], perluDisetujui: [], catatan });
  const daftar = m.bukti.filter((b) => b && b.baris && String(b.baris.nm ?? "").trim());
  const belumSemua = (alasan: string) => daftar.map((b) => ({ kode: kodeDari(b), kunci: jenisBuktiDari(b.baris.nm), nama: String(b.baris.nm).trim(), alasan }));
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
  return { keadaan: bacaan.teks, paragraf: hasil.paragraf, belumAdaBunyi: hasil.belum, perluDisetujui: hasil.perlu, catatan };
}
