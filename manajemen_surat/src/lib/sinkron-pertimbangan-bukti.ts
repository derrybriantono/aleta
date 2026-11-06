/**
 * ============================================================================
 * PERTIMBANGAN DARI ALAT BUKTI - CERAI GUGAT DAN CERAI TALAK (6 Nov 2026)
 * ============================================================================
 *
 * Penyusun murni (tanpa DOM, tanpa jaringan) untuk layar cetak ALETA ABT. Dari daftar alat bukti dan keadaan putusan, tersusun paragraf
 * pertimbangan menurut kartu aturan (kartu-pertimbangan-bukti.json). Semua bunyi berasal dari Blangko ABT by Derry Briantono; jenis bukti
 * yang tidak punya bunyi di blangko dilaporkan di belumAdaBunyi, tidak dikarang. Tidak menulis ke SIPP atau ABT.
 *
 * Keputusan pemilik yang dijalankan di sini:
 *  - bukti pokok tertulis otomatis, bukti pelengkap menjadi usulan;
 *  - kalimat "tidak dibantah" hanya bila lawan hadir dan tidak membantah;
 *  - dicabut: sebelum pembuktian kosong; pada agenda pembuktian kedua atau sesudahnya, bukti agenda sebelumnya menjadi usulan.
 */

import { jenisBuktiDari, katalogDari, tanggalIndo, type BarisBukti } from "./bukti-tertulis";
import kartuJson from "./kartu-pertimbangan-bukti.json";

export type JenisCerai = "CG" | "CT";
export type KeadaanKartu = "kabul-verstek" | "kabul" | "tolak-verstek" | "tolak";
export type SyaratKartu = "meterai0" | "cocok0" | "cocok1" | "aktaOtentik" | "lengkap";
export type AsalKartu = { folder: string; berkas: string; alinea: number; sisiSumber: "P" | "T" };
export type Kartu = {
  id: string;
  kunci: string[] | "*";
  cerai: JenisCerai[];
  keadaan: KeadaanKartu[];
  sisi: "P" | "T" | "PT";
  kategori: "pokok" | "pelengkap";
  bunyi: string;
  asal: AsalKartu[];
  syarat?: SyaratKartu;
  kelompok?: boolean;
  catatan?: string;
  sumberKhusus?: string;
};
export const KARTU_PERTIMBANGAN: readonly Kartu[] = (kartuJson as unknown as { kartu: Kartu[] }).kartu;

export type BuktiMasuk = { sisi: "P" | "T"; nomor: number; baris: BarisBukti; agendaKe?: number };
export type KonteksPerkara = {
  /** Nama pengadilan. Kosong: ditulis "Pengadilan ini". */
  satker?: string;
  /** Sebutan majelis. Kosong: ditulis "Majelis Hakim". */
  majelis?: string;
  /** Kosong: pasal ditulis untuk RBg dan HIR sekaligus. */
  hukumAcara?: "RBg" | "HIR";
  /** Tanggal menikah (ISO atau teks). Kosong: bagian itu tidak ditulis. */
  tglNikah?: string;
};
export type MasukanPertimbangan = {
  jenisCerai: JenisCerai;
  status: string;
  verstek: boolean;
  lawanHadir: boolean;
  lawanMembantah: boolean;
  /** 0 = belum ada pembuktian; 1 = agenda pembuktian pertama; dan seterusnya. Dipakai pada perkara dicabut. */
  agendaPembuktianKe: number;
  bukti: readonly BuktiMasuk[];
  konteks?: KonteksPerkara;
};
export type ParagrafBukti = { kode: string; kunci: string; bunyi: string; cara: "otomatis" | "usulan"; asal: string };
export type BelumAdaBunyi = { kode: string; kunci: string; nama: string; alasan: string };
export type HasilPertimbangan = {
  /** Keadaan yang terbaca, dalam bahasa sehari-hari, untuk ditampilkan. */
  keadaan: string;
  paragraf: ParagrafBukti[];
  belumAdaBunyi: BelumAdaBunyi[];
  catatan: string[];
};

const POKOK = new Set(["ktp", "nikah"]);
const kodeDari = (b: BuktiMasuk) => `${b.sisi}.${b.nomor}`;

/** Satu sebutan: "P.1", "P.1 dan P.2", "P.1, P.2 dan P.3". */
export function gabungKode(kode: readonly string[]): string {
  if (kode.length <= 1) return kode[0] ?? "";
  return `${kode.slice(0, -1).join(", ")} dan ${kode[kode.length - 1]}`;
}

/** Nama tanpa "bin/binti" dan tanpa "alias", huruf besar (sama dengan rumus nama tanpa bin di blangko). */
export function namaTanpaBin(nama: unknown): string {
  const t = ` ${String(nama ?? "").replace(/\s+/g, " ").trim().toUpperCase()} `;
  return t.split(" ALIAS ")[0].split(" BIN ")[0].split(" BINTI ")[0].trim();
}

type KeadaanBaca = { kunci: KeadaanKartu | "kosong" | "tdt" | "cabut"; teks: string };
export function bacaKeadaan(status: string, verstek: boolean): KeadaanBaca {
  const s = String(status ?? "").toLowerCase();
  if (/gugur|damai/.test(s)) return { kunci: "kosong", teks: "Perkara gugur atau berakhir damai" };
  if (/cabut/.test(s)) return { kunci: "cabut", teks: "Perkara dicabut" };
  if (/tidak\s+dapat\s+diterima|niet|^no$/.test(s)) return { kunci: "tdt", teks: "Gugatan atau permohonan tidak dapat diterima" };
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
  return t.replace(/\{(\w+)\}/g, (_, n: string) => p[n] ?? "").replace(/\s{2,}/g, " ");
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
const cocokKunci = (k: Kartu, jenis: string) => (k.kunci === "*" ? !POKOK.has(jenis) : k.kunci.includes(jenis));
const rujukan = (k: Kartu) => (k.asal[0] ? `${k.asal[0].folder}, ${k.asal[0].berkas}, alinea ${k.asal[0].alinea + 1}` : (k.sumberKhusus ?? ""));

function susunUntuk(keadaan: KeadaanKartu, m: MasukanPertimbangan, bukti: readonly BuktiMasuk[], paksaUsulan: boolean): { paragraf: ParagrafBukti[]; belum: BelumAdaBunyi[] } {
  const k = m.konteks ?? {};
  const tanpaBantahan = m.lawanHadir && !m.lawanMembantah && !m.verstek;
  const pihak = (s: "P" | "T") => (m.jenisCerai === "CT" ? (s === "P" ? "Pemohon" : "Termohon") : s === "P" ? "Penggugat" : "Tergugat");
  const dasar = (s: "P" | "T"): Pengganti => ({
    pihak: pihak(s),
    lawan: pihak(s === "P" ? "T" : "P"),
    perkara: m.jenisCerai === "CT" ? "permohonan" : "gugatan",
    majelis: (k.majelis ?? "").trim() || "Majelis Hakim",
    satker: (k.satker ?? "").trim() || "Pengadilan ini",
    tglNikah: k.tglNikah ? tanggalIndo(k.tglNikah) : "",
    pasalAkta: pasalAkta(k.hukumAcara),
  });
  const kartuBerlaku = KARTU_PERTIMBANGAN.filter((x) => x.cerai.includes(m.jenisCerai) && x.keadaan.includes(keadaan));
  const paragraf: ParagrafBukti[] = [];
  const belum: BelumAdaBunyi[] = [];
  const catatBelum = (b: BuktiMasuk, alasan: string) => {
    const kode = kodeDari(b);
    if (!belum.some((x) => x.kode === kode && x.alasan === alasan)) belum.push({ kode, kunci: jenisBuktiDari(b.baris.nm), nama: String(b.baris.nm ?? "").trim() || "Tanpa nama", alasan });
  };
  const keluar = (kar: Kartu, kode: string, jenis: string, p: Pengganti) =>
    paragraf.push({ kode, kunci: jenis, bunyi: isiKartu(kar.bunyi, p, tanpaBantahan), cara: paksaUsulan || kar.kategori === "pelengkap" ? "usulan" : "otomatis", asal: rujukan(kar) });

  const terbaca = new Set<BuktiMasuk>();
  for (const sisi of ["P", "T"] as const) {
    const baris = bukti.filter((b) => b.sisi === sisi);
    for (const kar of kartuBerlaku) {
      if (!kar.sisi.includes(sisi)) continue;
      const cocokan = baris.filter((b) => cocokKunci(kar, jenisBuktiDari(b.baris.nm)));
      if (!cocokan.length) continue;
      const lolos = cocokan.filter((b) => lolosSyarat(kar.syarat, b));
      if (!lolos.length) continue;
      if (kar.kelompok) {
        keluar(kar, gabungKodeTerurut(lolos), Array.isArray(kar.kunci) ? kar.kunci.join("/") : "*", { ...dasar(sisi), kode: gabungKodeTerurut(lolos) });
        if (kar.kunci !== "*") lolos.forEach((b) => terbaca.add(b));
      } else {
        for (const b of lolos) {
          keluar(kar, kodeDari(b), jenisBuktiDari(b.baris.nm), { ...dasar(sisi), kode: kodeDari(b), namaTanpaBin: namaTanpaBin(b.baris.an) });
          terbaca.add(b);
        }
      }
    }
  }
  // Bagian isian yang tidak punya bunyi di blangko.
  for (const b of bukti) {
    const r = b.baris;
    if (keadaan === "kabul" && !bebas(r)) {
      if (meterai(r) === 1 || meterai(r) === 2) catatBelum(b, "Blangko hanya memuat bunyi bukti bermeterai cukup dan dinazegelen.");
      if (cocok(r) === 2 || cocok(r) === 3) catatBelum(b, "Blangko tidak memuat bunyi pencocokan dari fotokopi atau dari kopian sebelumnya.");
    }
    if (keadaan === "tolak" && !terbaca.has(b)) {
      catatBelum(b, b.sisi === "P" && POKOK.has(jenisBuktiDari(b.baris.nm)) ? "Isian meterai atau pencocokan berbeda dari bunyi blangko Ditolak." : "Blangko Ditolak hanya memuat bunyi bukti surat pokok sisi penggugat atau pemohon.");
    } else if (keadaan !== "tolak" && !terbaca.has(b)) {
      const jenis = jenisBuktiDari(b.baris.nm);
      catatBelum(b, jenis && !POKOK.has(jenis) ? "Blangko tidak memuat bunyi untuk jenis bukti ini." : "Blangko tidak memuat bunyi untuk bukti ini pada keadaan yang dipilih.");
    }
  }
  return { paragraf, belum };
}

function gabungKodeTerurut(b: readonly BuktiMasuk[]): string {
  return gabungKode([...b].sort((x, y) => x.nomor - y.nomor).map(kodeDari));
}

/** Penyusun utama. Lihat catatan berkas untuk aturan keadaan. */
export function susunParagrafBukti(m: MasukanPertimbangan): HasilPertimbangan {
  const bacaan = bacaKeadaan(m.status, m.verstek);
  const kosong = (catatan: string[]): HasilPertimbangan => ({ keadaan: bacaan.teks, paragraf: [], belumAdaBunyi: [], catatan });
  const daftar = m.bukti.filter((b) => b && b.baris && String(b.baris.nm ?? "").trim());
  if (bacaan.kunci === "kosong") return kosong([bacaan.teks === "Keadaan putusan belum terbaca" ? "Status putusan tidak dikenali, jadi tidak ada paragraf." : "Pada keadaan ini tidak ada paragraf pertimbangan bukti."]);
  if (bacaan.kunci === "tdt")
    return {
      keadaan: bacaan.teks,
      paragraf: [],
      belumAdaBunyi: daftar.map((b) => ({ kode: kodeDari(b), kunci: jenisBuktiDari(b.baris.nm), nama: String(b.baris.nm).trim(), alasan: "Blangko Tidak Dapat Diterima tidak memuat bunyi per alat bukti." })),
      catatan: ["Putusan berhenti pada syarat formil; blangko tidak menguraikan alat bukti satu per satu."],
    };
  if (bacaan.kunci === "cabut") {
    const agenda = Number(m.agendaPembuktianKe) || 0;
    if (agenda < 2) return kosong([agenda < 1 ? "Dicabut sebelum ada pembuktian: tidak ada paragraf." : "Dicabut pada agenda pembuktian pertama: belum ada pembuktian sebelumnya yang dapat ditawarkan."]);
    const lama = daftar.filter((b) => (b.agendaKe ?? 1) < agenda);
    const hasil = susunUntuk(m.verstek ? "kabul-verstek" : "kabul", m, lama, true);
    return { keadaan: bacaan.teks, paragraf: hasil.paragraf, belumAdaBunyi: hasil.belum, catatan: [`Dicabut pada agenda pembuktian ke-${agenda}: bukti pembuktian sebelumnya ditawarkan sebagai usulan.`] };
  }
  const hasil = susunUntuk(bacaan.kunci, m, daftar, false);
  const catatan: string[] = [];
  if (bacaan.kunci === "tolak" || bacaan.kunci === "tolak-verstek") catatan.push("Ditolak: bukti dinilai tanpa menyimpulkan bahwa dalil terbukti.");
  return { keadaan: bacaan.teks, paragraf: hasil.paragraf, belumAdaBunyi: hasil.belum, catatan };
}
