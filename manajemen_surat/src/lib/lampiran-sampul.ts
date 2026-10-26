import { tanggalIndonesia } from "@/lib/berkas-perkara";
import { MUAT_PIHAK, TURUT_SEBARIS, bersihkanPihak, jumlahDariDaftar, pihakBanyak, romawi, type JumlahPihak, type PihakLampiran } from "@/lib/lampiran-pihak";

/**
 * ============================================================================
 * LAMPIRAN SAMPUL CETAK AWAL - HANYA BILA PERLU (keputusan Derry 26 Okt, versi 7) - MURNI
 * ============================================================================
 *
 * Sampul tetap SATU lembar. Yang tidak muat dipindah ke lampiran bernomor "LAMPIRAN n - JUDUL" di halaman berikutnya RTF yang sama, dengan alasan
 * dicetak di subjudul; jumlah lampiran disebut di kaki sampul. Empat lampiran, masing-masing hanya bila syaratnya terpenuhi:
 *
 *   1. DAFTAR PARA PIHAK      pihak melebihi ruang: 8 per sisi (perkara berlawanan; 6 bila info khas di halaman depan >= 2 baris), 12 (permohonan),
 *                             turut tergugat 3, atau ada pihak intervensi.
 *   2. DAFTAR OBJEK SENGKETA  objek lebih dari 2 (1-2 objek sebaris di sampul).
 *   3. DAFTAR ANAK            anak lebih dari 3 (1-3 anak sebaris di sampul).
 *   4. RIWAYAT SIDANG (LANJUTAN)  hanya pada cetak ulang bila sidang melebihi baris sampul; lanjutan nomor, 15 baris per halaman, kolom sama.
 *
 * Data dari bot (SIPP, baca saja); bagian RTF disusun di sini (baris tabel sungguhan: alamat dan objek bisa panjang).
 */

export const BATAS_OBJEK_SEBARIS = 2;
export const BATAS_ANAK_SEBARIS = 3;
export const BARIS_LANJUTAN = 15;
export const MUAT_LAWAN_RAPAT = 6;

export type AnakSampul = { nama: string; umur: string; diasuh: "P" | "T" | "" };
export type ObjekSampul = { nama: string; letak: string; ket?: string };
export type SidangLanjutan = { ke: number; tanggal: string; hadir: string; agenda: string; alasan: string };

export type KunciLampiran = "pihak" | "objek" | "anak" | "riwayat";
export type ButirLampiran = { nomor: number; kunci: KunciLampiran; judul: string; alasan: string };

export type BahanLampiran = {
  nomor: string;
  /** lebar isi dalam twip (lebar kertas dikurangi margin 1400) */
  lebar: number;
  lawan: boolean;
  pihak: PihakLampiran[];
  anak: AnakSampul[];
  objek: ObjekSampul[];
  riwayat: SidangLanjutan[];
  /** jumlah baris riwayat di sampul menurut kertas (15, 18, 20) */
  barisRiwayat: number;
  /** baris info khas di halaman depan di luar anak dan objek (fokus + pokok perkara) */
  infoKhasBaris?: number;
  sebutan?: { 1?: string; 2?: string };
  /** sebutan pihak I untuk "diasuh oleh" */
  sebutanPihakI?: string;
  sebutanPihakII?: string;
};

export type HasilLampiran = {
  daftar: ButirLampiran[];
  /** bagian RTF sesudah sampul (kosong bila tak ada lampiran) */
  bagianRtf: string;
  /** baris tambahan di halaman depan (anak, objek) untuk variabel 5832 */
  barisDepan: string[];
  /** muat nama per sisi yang dipakai kolom pihak */
  muatPihak: number;
  /** teks kaki sampul untuk variabel 5833; kosong bila tak ada lampiran */
  kaki: string;
};

// ---------------------------------------------------------------------------
// Keputusan
// ---------------------------------------------------------------------------
export function infoBarisDepan(anak: AnakSampul[], objek: ObjekSampul[]): number {
  return (anak.length ? 1 : 0) + (objek.length ? 1 : 0);
}

/** Muat nama per sisi di sampul: permohonan 12; berlawanan 8, atau 6 bila info khas di halaman depan sudah dua baris atau lebih. */
export function muatPihakSampul(lawan: boolean, infoKhasBaris: number): number {
  if (!lawan) return MUAT_PIHAK.permohonan;
  return infoKhasBaris >= 2 ? MUAT_LAWAN_RAPAT : MUAT_PIHAK.lawan;
}

export function perluLampiranPihak(j: JumlahPihak, muat: number): boolean {
  return j.p1 > muat || j.p2 > muat || j.p3 > 0 || j.p4 > TURUT_SEBARIS;
}

/**
 * Kolom nama pihak sesudah pihak I untuk satu sisi: nama bernomor romawi, dibagi dua kolom (kiri ceil(n/2)); lebih dari `muat` nama (termasuk pihak I)
 * dipotong menjadi muat-2 nama ditambah "dan N lainnya - lengkap di Lampiran Daftar Para Pihak". Teks bergaris banyak (satu nama per baris).
 */
export function kolomPihakSampul(anggota: PihakLampiran[], muat: number, nomorLampiran: number): { kiri: string; kanan: string; sisa: number } {
  const urut = [...anggota].sort((a, b) => a.urutan - b.urutan);
  const total = urut.length;
  const tampil = total > muat ? muat - 2 : Math.max(0, total - 1);
  const nama = urut.slice(1, 1 + tampil).map((p, i) => `${romawi(i + 2)}. ${p.nama}`);
  const kiriN = Math.ceil(nama.length / 2);
  const sisa = Math.max(0, total - 1 - tampil);
  const kanan = [...nama.slice(kiriN), ...(sisa > 0 ? [`dan ${sisa} lainnya - lengkap di Lampiran ${nomorLampiran} Daftar Para Pihak`] : [])];
  return { kiri: nama.slice(0, kiriN).join("\n"), kanan: kanan.join("\n"), sisa };
}

/** Baris "Turut Tergugat" sebaris: tiga nama, lebihnya "dan N lainnya (lampiran)". Kosong bila tidak ada. */
export function barisTurut(turut: PihakLampiran[], nomorLampiran: number, sebutan = "TURUT TERGUGAT"): string {
  if (!turut.length) return "";
  const urut = [...turut].sort((a, b) => a.urutan - b.urutan);
  const tiga = urut.slice(0, TURUT_SEBARIS).map((p, i) => `${romawi(i + 1)}. ${p.nama}`).join("  -  ");
  const lebih = urut.length > TURUT_SEBARIS ? `  -  dan ${urut.length - TURUT_SEBARIS} lainnya (Lampiran ${nomorLampiran})` : "";
  return `${sebutan} (${urut.length})  ${tiga}${lebih}`;
}

const SEBUT_DIASUH = (k: "P" | "T" | "", p: string, t: string) => (k === "P" ? p : k === "T" ? t : "");

/** Baris di halaman depan: anak (1-3 sebaris, selebihnya rujukan lampiran) dan objek sengketa (1-2 sebaris). */
export function barisDepanSampul(anak: AnakSampul[], objek: ObjekSampul[], nomor: { anak?: number; objek?: number }, sebutPihak: { p: string; t: string }): string[] {
  const hasil: string[] = [];
  if (anak.length) {
    if (anak.length > BATAS_ANAK_SEBARIS) hasil.push(`Anak: ${anak.length} anak - rincian di Lampiran ${nomor.anak ?? "?"}`);
    else
      hasil.push(
        `Anak: ${anak
          .map((a) => {
            const rinci = [a.umur ? `${a.umur} th` : "", SEBUT_DIASUH(a.diasuh, sebutPihak.p, sebutPihak.t) ? `diasuh ${SEBUT_DIASUH(a.diasuh, sebutPihak.p, sebutPihak.t)}` : ""].filter(Boolean).join(", ");
            return rinci ? `${a.nama} (${rinci})` : a.nama;
          })
          .join("; ")}`
      );
  }
  if (objek.length) {
    if (objek.length > BATAS_OBJEK_SEBARIS) hasil.push(`Objek sengketa: ${objek.length} objek - rincian di Lampiran ${nomor.objek ?? "?"}`);
    else hasil.push(`Objek sengketa: ${objek.map((o) => o.nama).join("; ")}`);
  }
  return hasil;
}

// ---------------------------------------------------------------------------
// RTF
// ---------------------------------------------------------------------------
function esc(t: string): string {
  let hasil = "";
  for (const ch of t) {
    const o = ch.codePointAt(0) ?? 0;
    if (ch === "\\" || ch === "{" || ch === "}") hasil += `\\${ch}`;
    else if (o > 127) hasil += `\\u${o > 32767 ? o - 65536 : o}?`;
    else hasil += ch;
  }
  return hasil;
}

type Kolom = { judul: string; lebar: number; rata?: "l" | "c" };

function tabelLampiran(kolom: Kolom[], lebarIsi: number, barisData: Array<{ bagian?: string; sel?: string[]; tinggi?: number }>): string {
  const total = kolom.reduce((a, k) => a + k.lebar, 0);
  const lebar = kolom.map((k, i) => (i === kolom.length - 1 ? 0 : Math.trunc((k.lebar * lebarIsi) / total)));
  lebar[lebar.length - 1] = lebarIsi - lebar.slice(0, -1).reduce((a, b) => a + b, 0);
  const batas: number[] = [];
  lebar.reduce((a, w) => {
    batas.push(a + w);
    return a + w;
  }, 0);
  const garis = (b: number) => `\\clbrdrt\\brdrs\\brdrw${b}\\clbrdrl\\brdrs\\brdrw${b}\\clbrdrb\\brdrs\\brdrw${b}\\clbrdrr\\brdrs\\brdrw${b}`;
  const para = (teks: string, o: { b?: boolean; al?: "l" | "c"; sz?: number } = {}) => `\\pard\\plain\\intbl\\q${o.al ?? "l"}\\f0\\fs${o.sz ?? 17}\\sb20\\sa20 ${o.b ? "\\b " : ""}${esc(teks)}\\cell\n`;
  let s = `\\trowd\\trgaph60\\trleft0\\trkeep\\trhdr\n${batas.map((x) => `\\clcbpat2${garis(10)}\\clvertalt\\cellx${x}`).join("")}\n${kolom.map((k) => para(k.judul, { b: true, al: k.rata ?? "l", sz: 15 })).join("")}\\row\n`;
  for (const r of barisData) {
    if (r.bagian !== undefined) {
      s += `\\trowd\\trgaph60\\trleft0\\trkeep\n\\clcbpat2${garis(10)}\\cellx${lebarIsi}\n\\pard\\plain\\intbl\\ql\\f0\\fs16\\sb30\\sa30 \\b ${esc(r.bagian)}\\cell\n\\row\n`;
      continue;
    }
    s += `\\trowd\\trgaph60\\trleft0\\trkeep${r.tinggi ? `\\trrh${r.tinggi}` : ""}\n${batas.map((x) => `${garis(10)}\\clvertalc\\cellx${x}`).join("")}\n${(r.sel ?? []).map((t, i) => para(t, { al: kolom[i].rata ?? "l" })).join("")}\\row\n`;
  }
  return s;
}

function judulLampiran(n: number, judul: string, nomorPerkara: string, alasan: string): string {
  return (
    `\\page\n\\pard\\plain\\qc\\f0\\fs26\\b\\expndtw40 ${esc(`LAMPIRAN ${n} - ${judul}`)}\\par\n` +
    `\\pard\\plain\\qc\\f0\\fs18\\sb40\\sa20 ${esc(`Perkara Nomor ${String(nomorPerkara || "").replace(/[\u0000-\u001F]/g, " ").slice(0, 80)}`)}\\par\n` +
    `\\pard\\plain\\qc\\f0\\fs15\\sb0\\sa120 ${esc(`Halaman ${n + 1} sampul berkas - dicetak karena ${alasan}`)}\\par\n`
  );
}

const KOTAK_RTF = (rtf: string) => rtf.replace(/\\u(9744|9746)\?/g, "{\\f1\\u$1?}");

const SEBUTAN_BAWAAN = { 1: "Penggugat", 2: "Tergugat", 3: "Intervensi", 4: "Turut Tergugat" } as const;

function bagianPihak(b: BahanLampiran, n: number, alasan: string): string {
  const sebutan = { ...SEBUTAN_BAWAAN, ...(b.sebutan ?? {}) } as Record<number, string>;
  const rows: Array<{ bagian?: string; sel?: string[] }> = [];
  for (const sisi of [1, 2, 3, 4] as const) {
    const anggota = b.pihak.filter((p) => p.sisi === sisi).sort((a, c) => a.urutan - c.urutan);
    if (!anggota.length) continue;
    rows.push({ bagian: `${sebutan[sisi].toUpperCase()} (${anggota.length})` });
    anggota.forEach((p, i) => rows.push({ sel: [String(i + 1), p.nama, `${sebutan[sisi]} ${romawi(i + 1)}`, p.alamat || "-"] }));
  }
  return (
    judulLampiran(n, "DAFTAR PARA PIHAK", b.nomor, alasan) +
    tabelLampiran([{ judul: "NO", lebar: 560, rata: "c" }, { judul: "NAMA", lebar: 3500 }, { judul: "KEDUDUKAN", lebar: 1900 }, { judul: "ALAMAT", lebar: 4546 }], b.lebar, rows)
  );
}

function bagianObjek(b: BahanLampiran, n: number, alasan: string): string {
  const rows = b.objek.map((o, i) => ({ sel: [String(i + 1), o.nama, o.letak || "-", o.ket || ""] }));
  return (
    judulLampiran(n, "DAFTAR OBJEK SENGKETA", b.nomor, alasan) +
    tabelLampiran([{ judul: "NO", lebar: 560, rata: "c" }, { judul: "OBJEK", lebar: 3300 }, { judul: "LETAK / IDENTITAS", lebar: 4400 }, { judul: "KETERANGAN", lebar: 2246 }], b.lebar, rows)
  );
}

function bagianAnak(b: BahanLampiran, n: number, alasan: string): string {
  const diasuh = (k: "P" | "T" | "") => (k === "P" ? (b.sebutanPihakI ?? "Penggugat") : k === "T" ? (b.sebutanPihakII ?? "Tergugat") : "");
  const rows = b.anak.map((a, i) => ({ sel: [String(i + 1), a.nama, a.umur ? `${a.umur} th` : "", diasuh(a.diasuh)] }));
  return (
    judulLampiran(n, "DAFTAR ANAK", b.nomor, alasan) +
    tabelLampiran([{ judul: "NO", lebar: 560, rata: "c" }, { judul: "NAMA ANAK", lebar: 5200 }, { judul: "UMUR", lebar: 1300, rata: "c" }, { judul: "DIASUH OLEH", lebar: 3446 }], b.lebar, rows)
  );
}

/** Kotak hadir: dicentang bila sidang itu mencatat pihaknya hadir (P T = semua pihak); baris kosong = dua kotak kosong untuk ditulis tangan. */
function teksHadir(h: string | undefined): string {
  const kode = String(h ?? "");
  const p = kode === "P T" || kode === "P" || kode === "I";
  const t = kode === "P T" || kode === "T" || kode === "I";
  return `${p ? "☒" : "☐"} P   ${t ? "☒" : "☐"} T`;
}

function bagianRiwayat(b: BahanLampiran, n: number, alasan: string): string {
  const mulai = b.barisRiwayat; // sidang ke barisRiwayat+1 dan seterusnya
  const sisa = b.riwayat.filter((r) => r.ke > mulai);
  const halaman = Math.max(1, Math.ceil(sisa.length / BARIS_LANJUTAN));
  let s = "";
  for (let h = 0; h < halaman; h += 1) {
    const rows: Array<{ sel: string[]; tinggi: number }> = [];
    for (let i = 0; i < BARIS_LANJUTAN; i += 1) {
      const r = sisa[h * BARIS_LANJUTAN + i];
      const ke = mulai + h * BARIS_LANJUTAN + i + 1;
      rows.push({ tinggi: 420, sel: [String(ke), r ? tanggalIndonesia(r.tanggal) : "", r ? r.agenda : "", teksHadir(r ? r.hadir : ""), r ? r.alasan : ""] });
    }
    s += KOTAK_RTF(
      judulLampiran(n, `RIWAYAT SIDANG (LANJUTAN${halaman > 1 ? ` ${h + 1}/${halaman}` : ""})`, b.nomor, alasan) +
      tabelLampiran(
        [{ judul: "KE", lebar: 560, rata: "c" }, { judul: "TANGGAL", lebar: 1950 }, { judul: "AGENDA", lebar: 2900 }, { judul: "HADIR", lebar: 1150, rata: "c" }, { judul: "HASIL / DITUNDA KE - ALASAN", lebar: 3946 }],
        b.lebar,
        rows
      )
    );
  }
  return s;
}

// ---------------------------------------------------------------------------
// Susunan: keputusan + bagian RTF + baris depan + kaki
// ---------------------------------------------------------------------------
export function susunLampiran(b: BahanLampiran): HasilLampiran {
  const j = jumlahDariDaftar(b.pihak);
  const infoKhas = (b.infoKhasBaris ?? 0) + infoBarisDepan(b.anak, b.objek);
  const muat = muatPihakSampul(b.lawan, infoKhas);
  const perlu: Array<{ kunci: KunciLampiran; judul: string; alasan: string }> = [];
  if (perluLampiranPihak(j, muat)) {
    const sebagian: string[] = [];
    if (j.p1 > muat) sebagian.push(`pihak I berjumlah ${j.p1} orang`);
    if (j.p2 > muat) sebagian.push(`pihak II berjumlah ${j.p2} orang`);
    if (j.p3 > 0) sebagian.push(`ada ${j.p3} pihak intervensi`);
    if (j.p4 > TURUT_SEBARIS) sebagian.push(`turut tergugat ${j.p4} orang`);
    perlu.push({ kunci: "pihak", judul: "DAFTAR PARA PIHAK", alasan: `${sebagian.join(", ")} (muat di sampul ${muat} nama per sisi, turut tergugat ${TURUT_SEBARIS})` });
  }
  if (b.objek.length > BATAS_OBJEK_SEBARIS) perlu.push({ kunci: "objek", judul: "DAFTAR OBJEK SENGKETA", alasan: `objek sengketa ${b.objek.length} (lebih dari ${BATAS_OBJEK_SEBARIS})` });
  if (b.anak.length > BATAS_ANAK_SEBARIS) perlu.push({ kunci: "anak", judul: "DAFTAR ANAK", alasan: `anak ${b.anak.length} orang (lebih dari ${BATAS_ANAK_SEBARIS})` });
  if (b.riwayat.some((r) => r.ke > b.barisRiwayat)) perlu.push({ kunci: "riwayat", judul: "RIWAYAT SIDANG (LANJUTAN)", alasan: `sidang sudah ${Math.max(...b.riwayat.map((r) => r.ke))} kali (sampul memuat ${b.barisRiwayat})` });
  const daftar: ButirLampiran[] = perlu.map((x, i) => ({ nomor: i + 1, ...x }));
  const nomorDari = (k: KunciLampiran) => daftar.find((d) => d.kunci === k)?.nomor;
  let bagianRtf = "";
  for (const d of daftar) {
    if (d.kunci === "pihak") bagianRtf += bagianPihak(b, d.nomor, d.alasan);
    else if (d.kunci === "objek") bagianRtf += bagianObjek(b, d.nomor, d.alasan);
    else if (d.kunci === "anak") bagianRtf += bagianAnak(b, d.nomor, d.alasan);
    else bagianRtf += bagianRiwayat(b, d.nomor, d.alasan);
  }
  const barisDepan = barisDepanSampul(b.anak, b.objek, { anak: nomorDari("anak"), objek: nomorDari("objek") }, { p: b.sebutanPihakI ?? "Penggugat", t: b.sebutanPihakII ?? "Tergugat" });
  const kaki = daftar.length ? `Lampiran (${daftar.length}): ${daftar.map((d) => `${d.nomor}. ${d.judul.replace(/ \(LANJUTAN\)/, " lanjutan")}`).join("; ")}` : "";
  return { daftar, bagianRtf, barisDepan, muatPihak: muat, kaki };
}

export { bersihkanPihak, pihakBanyak };

// ---------------------------------------------------------------------------
// Saringan kiriman klien
// ---------------------------------------------------------------------------
const bersih = (x: unknown, maks: number) =>
  String(x ?? "")
    .replace(/[\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maks);
const tanpaAplikasi = (t: string) => (/aleta/i.test(t) ? "" : t);

export function bersihkanAnak(mentah: unknown): AnakSampul[] {
  if (!Array.isArray(mentah)) return [];
  return mentah
    .slice(0, 60)
    .map((m) => (m && typeof m === "object" ? (m as Record<string, unknown>) : {}))
    .map((r) => ({ nama: tanpaAplikasi(bersih(r.nama, 200)), umur: /^\d{1,3}$/.test(String(r.umur ?? "")) ? String(r.umur) : "", diasuh: r.diasuh === "P" ? ("P" as const) : r.diasuh === "T" ? ("T" as const) : ("" as const) }))
    .filter((a) => a.nama);
}

export function bersihkanObjek(mentah: unknown): ObjekSampul[] {
  if (!Array.isArray(mentah)) return [];
  return mentah
    .slice(0, 80)
    .map((m) => (m && typeof m === "object" ? (m as Record<string, unknown>) : {}))
    .map((r) => ({ nama: tanpaAplikasi(bersih(r.nama, 200)), letak: tanpaAplikasi(bersih(r.letak, 500)), ket: tanpaAplikasi(bersih(r.ket, 120)) }))
    .filter((o) => o.nama);
}

export function bersihkanSidang(mentah: unknown): SidangLanjutan[] {
  if (!Array.isArray(mentah)) return [];
  return mentah
    .slice(0, 200)
    .map((m) => (m && typeof m === "object" ? (m as Record<string, unknown>) : {}))
    .map((r) => ({
      ke: Math.min(999, Math.trunc(Number(r.ke)) || 0),
      tanggal: bersih(r.tanggal, 40),
      hadir: bersih(r.hadir, 6),
      agenda: tanpaAplikasi(bersih(r.agenda, 200)),
      alasan: tanpaAplikasi(bersih(r.alasan, 300)),
    }))
    .filter((r) => r.ke > 0);
}
