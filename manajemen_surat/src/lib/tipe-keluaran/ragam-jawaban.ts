import { CERMIN_BAS_SAKSI } from "@/lib/tipe-keluaran/bawaan/bawaan-bas-saksi";
import type { DataEntri } from "@/lib/tipe-keluaran/kontrak";
import { angka01, fnv1a32, indeksVarian, diragamkan, kelompokTanya } from "@/lib/tipe-keluaran/pemilih-ragam";

/**
 * ============================================================================
 * RAGAM JAWABAN CONTOH - SALINAN PORTAL DARI LANGKAH RAGAM BOT
 * ============================================================================
 *
 * Sumber: aleta_bot/services/abtUsulanService.js - periksaInvarian,
 * tiruanReplaceKetSaksi, cocokBentuk, varianRagamKata, pilihPembuka, dan
 * langkah 3-4 susunKeteranganSaksiSdg. Pemilih bentuknya TIDAK disalin: yang
 * dipakai pemilih-ragam.ts, cermin identik pemilihRagam.js bot.
 *
 * Dipakai lembar BAS portal ("Pakai contoh"). Yang TIDAK disalin, dan
 * sebabnya:
 *   - modus saksi (sama/sebagian/tidak-tahu/...) - lembar portal tidak
 *     mengetahui modus saksi; yang diragamkan hanya jawaban contoh ABT;
 *   - pengisian titik-titik dari gugatan - lembar portal tidak membaca posita,
 *     dan titik-titik yang tetap terlihat justru yang harus diisi panitera.
 *
 * YANG DIJAGA (sama dengan bot, uji ragam-jawaban-cermin.test.ts menjalankan
 * keduanya atas masukan yang sama dan menuntut hasil identik):
 *   - makna tidak bergeser - tiap bentuk lolos periksaInvarian, dan hasil
 *     akhirnya diperiksa sekali lagi; yang melanggar dilepas ke jawaban dasar;
 *   - lafal sumpah dan identitas (kelompok 'tetap') tidak disentuh sama sekali;
 *   - bentuk dipilih pemilih K7b (nomor perkara, kode kumpulan, kunci
 *     pertanyaan, urutan saksi) - bukan acak; memuat ulang lembar yang sama
 *     menghasilkan contoh yang sama persis.
 *
 * Panitera tetap yang memilih dan memeriksa: contoh hanya masuk ke kotak
 * jawaban bila ia menekan "Pakai contoh", dan tidak pernah tersimpan sendiri.
 */

// ============================================================================
// BANK
// ============================================================================

export type EntriBank = { kunci?: unknown; nilai?: unknown; data?: DataEntri | null };

export type BankRagam = {
  pembuka: Array<{ nilai: string; bobot: number }>;
  ragamKata: Array<{ pola: RegExp; ganti: string }>;
  bentuk: Map<string, Array<{ nilai: string; syarat: Record<string, unknown> | null }>>;
  profil: Map<string, { kunci: string; peluangRagam: number; rumusan: boolean }>;
  /** 'portal' bila sedikitnya satu daftar datang dari pengaturan, selain itu 'tertanam'. */
  asal: "portal" | "tertanam";
  versi: string;
  ditolak: Array<{ daftar: string; kunci: string; alasan: string }>;
};

/** Daftar yang dibaca lembar BAS portal (K2 bas.saksi.*, tanpa jawaban-modus). */
export const DAFTAR_RAGAM_PORTAL = [
  "bas.saksi.pembuka",
  "bas.saksi.ragam-kata",
  "bas.saksi.bentuk",
  "bas.saksi.profil",
] as const;

/**
 * Kata awal yang boleh dikecilkan sesudah pembuka - SALINAN
 * ragamBasBawaan.AWAL_BOLEH_DIKECILKAN (bukan daftar tipe keluaran; dijaga
 * deep-equal oleh ragam-jawaban-cermin.test.ts).
 */
export const AWAL_BOLEH_DIKECILKAN: readonly string[] = [
  "saya", "yang", "anak", "sudah", "setelah", "antara", "sebelum", "para", "selama", "mahar",
  "calon", "pada", "dari", "keluarga", "perselisihan", "pertengkaran", "penyebab", "penyebabnya",
  "puncak", "maksud", "perubahan", "sejak", "telah", "karena", "kalau", "kehidupan", "semasa",
  "hubungan", "pihak", "mereka", "keduanya", "awalnya", "hal", "beberapa",
];
const HIMPUNAN_AWAL = new Set(AWAL_BOLEH_DIKECILKAN);

const POLA_KATA_POLOS = /^[a-z]+( [a-z]+)*$/;
const POLA_KUNCI_TANYA = /^[a-z0-9#]+( [a-z0-9#]+)*$/;

function polaKata(kata: string, abaikanBesarKecil: boolean): RegExp {
  const aman = String(kata).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${aman}\\b`, abaikanBesarKecil ? "gi" : "g");
}

/** Pemeriksa teks yang sama dengan kalimatBaku.periksaTeksTipe bot (K6). */
function periksaTeksTipe(teks: unknown, penandaSah: string[]): string {
  const s = String(teks === undefined || teks === null ? "" : teks);
  if (!s.trim()) return "kosong";
  if (s.length > 400) return "lebih_dari_400_huruf";
  if (s.includes("${")) return "memuat_${";
  if (s.includes("<")) return "memuat_<";
  if (/[\r\n]/.test(s)) return "memuat_ganti_baris";
  for (const p of s.match(/\{[^{}]*\}/g) || []) {
    if (!penandaSah.includes(p)) return `penanda_tidak_sah:${p}`;
  }
  if (/[{}]/.test(s.replace(/\{[^{}]*\}/g, ""))) return "kurung_kurawal_lepas";
  return "";
}

function pembukaRusakDiPutusan(pembuka: string): boolean {
  const kata = String(pembuka).trim().replace(/,$/, "").split(/\s+/).pop()?.toLowerCase() ?? "";
  return /ya$/.test(kata) && kata !== "ya" && kata !== "saya";
}

const VERSI_TERTANAM = `tertanam-${fnv1a32(JSON.stringify(CERMIN_BAS_SAKSI)).toString(16)}`;

/**
 * Bank ragam dari daftar efektif (untukPortal) - penyaringnya sama dengan
 * bacaBankBas bot. Daftar yang tidak ada memakai cermin bawaan (sama dengan
 * konstanta tertanam bot).
 */
export function susunBankRagam(
  daftar?: Partial<Record<string, readonly EntriBank[]>> | null,
  versi?: string
): BankRagam {
  const ditolak: BankRagam["ditolak"] = [];
  let dariPortal = false;

  const ambil = <T>(
    kunciDaftar: (typeof DAFTAR_RAGAM_PORTAL)[number],
    normalkan: (e: { kunci: string; nilai: string; data: DataEntri }) => { entri?: T; alasan?: string }
  ): T[] => {
    const dariPengaturan = daftar && Object.prototype.hasOwnProperty.call(daftar, kunciDaftar);
    const mentah: readonly EntriBank[] = dariPengaturan
      ? (daftar?.[kunciDaftar] ?? [])
      : ((CERMIN_BAS_SAKSI[kunciDaftar] ?? []) as readonly EntriBank[]);
    if (dariPengaturan) dariPortal = true;
    const hasil: T[] = [];
    mentah.forEach((e, indeks) => {
      const kunciMentah = e && typeof e === "object" ? String(e.kunci ?? "").slice(0, 80) : "";
      if (indeks >= 200) {
        ditolak.push({ daftar: kunciDaftar, kunci: kunciMentah, alasan: "lebih_dari_200_entri" });
        return;
      }
      if (!e || typeof e !== "object") {
        ditolak.push({ daftar: kunciDaftar, kunci: "", alasan: "bukan_objek" });
        return;
      }
      const data = e.data && typeof e.data === "object" ? e.data : {};
      const nilai = String(e.nilai === undefined || e.nilai === null ? "" : e.nilai);
      const kunci = String(e.kunci === undefined || e.kunci === null ? "" : e.kunci).trim();
      const r = normalkan({ kunci, nilai, data });
      if (r.alasan) ditolak.push({ daftar: kunciDaftar, kunci: kunciMentah, alasan: r.alasan });
      else if (r.entri !== undefined) hasil.push(r.entri);
    });
    return hasil;
  };

  const pembuka = ambil<{ nilai: string; bobot: number }>("bas.saksi.pembuka", ({ nilai, data }) => {
    const salah = periksaTeksTipe(nilai, []);
    if (salah) return { alasan: `nilai_${salah}` };
    if (nilai.length < 3 || nilai.length > 40 || !nilai.endsWith(", ")) return { alasan: "pembuka_harus_3_40_huruf_diakhiri_koma" };
    if (pembukaRusakDiPutusan(nilai)) return { alasan: "pembuka_dirusak_replace_ket_saksi" };
    const bobot = data.bobot === undefined ? 1 : Number(data.bobot);
    if (!(bobot > 0 && bobot <= 100)) return { alasan: "bobot_bukan_0_100" };
    return { entri: { nilai, bobot } };
  });

  const ragamKata = ambil<{ kata: string; ganti: string; abaikanBesarKecil: boolean }>(
    "bas.saksi.ragam-kata",
    ({ nilai, data }) => {
      const ganti = String(data.ganti || "");
      if (!POLA_KATA_POLOS.test(nilai) || nilai.length > 30) return { alasan: "kata_bukan_kata_polos" };
      if (!POLA_KATA_POLOS.test(ganti) || ganti.length > 30 || ganti === nilai) return { alasan: "ganti_bukan_kata_polos" };
      return { entri: { kata: nilai, ganti, abaikanBesarKecil: data.abaikanBesarKecil === true } };
    }
  );

  const bentukMentah = ambil<{ kunci: string; nilai: string; syarat: Record<string, unknown> | null }>(
    "bas.saksi.bentuk",
    ({ kunci, nilai, data }) => {
      if (!POLA_KUNCI_TANYA.test(kunci) || kunci.length > 200) return { alasan: "kunci_bukan_kunci_tanya" };
      const salah = periksaTeksTipe(nilai, ["{slot}"]);
      if (salah) return { alasan: `nilai_${salah}` };
      const asing = (nilai.match(/#\d{4}#/g) || []).filter((p) => p !== "#0046#" && p !== "#0047#");
      if (asing.length) return { alasan: `penanda_tidak_sah:${asing[0]}` };
      if (nilai.length < 3 || nilai.length > 400) return { alasan: "nilai_bukan_3_400_huruf" };
      const syarat = data.syarat && typeof data.syarat === "object" ? (data.syarat as Record<string, unknown>) : null;
      return { entri: { kunci, nilai, syarat } };
    }
  );
  const bentuk: BankRagam["bentuk"] = new Map();
  const banyakSlot = (t: string) => t.split("{slot}").length - 1;
  for (const e of bentukMentah) {
    if (!bentuk.has(e.kunci)) bentuk.set(e.kunci, []);
    const kelompok = bentuk.get(e.kunci) ?? [];
    if (kelompok.length && banyakSlot(e.nilai) !== banyakSlot(kelompok[0].nilai)) {
      ditolak.push({ daftar: "bas.saksi.bentuk", kunci: e.kunci, alasan: "banyak_slot_berbeda" });
      continue;
    }
    kelompok.push({ nilai: e.nilai, syarat: e.syarat });
  }

  const profilMentah = ambil<{ kunci: string; peluangRagam: number; rumusan: boolean }>(
    "bas.saksi.profil",
    ({ kunci, data }) => {
      if (!POLA_KUNCI_TANYA.test(kunci) || kunci.length > 200) return { alasan: "kunci_bukan_kunci_tanya" };
      const p = Number(data.peluangRagam);
      if (typeof data.peluangRagam !== "number" || !(p >= 0 && p <= 1)) return { alasan: "peluang_bukan_0_1" };
      return { entri: { kunci, peluangRagam: p, rumusan: data.rumusan === true } };
    }
  );

  return {
    pembuka,
    ragamKata: ragamKata.map((r) => ({ pola: polaKata(r.kata, r.abaikanBesarKecil), ganti: r.ganti })),
    bentuk,
    profil: new Map(profilMentah.map((p) => [p.kunci, p])),
    asal: dariPortal ? "portal" : "tertanam",
    versi: dariPortal && typeof versi === "string" && versi ? versi.slice(0, 40) : VERSI_TERTANAM,
    ditolak,
  };
}

// ============================================================================
// PEMBANTU KALIMAT (sama dengan bot)
// ============================================================================

export function rapikanTeks(teks: unknown): string {
  return String(teks || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tanda baca akhir dibuang - titik-titik tempat isian tidak. */
export function tanpaAkhiran(teks: unknown): string {
  let t = rapikanTeks(teks);
  for (;;) {
    const s = t.replace(/[\s;,]+$/, "").replace(/([^.])\.$/, "$1");
    if (s === t) return t;
    t = s;
  }
}

export function akhiriJawaban(teks: unknown): string {
  const t = tanpaAkhiran(teks);
  return t ? `${t};` : "";
}

function besarkanAwal(teks: string): string {
  return teks.charAt(0).toUpperCase() + teks.slice(1);
}

/** Koma sesudah kata berakhiran 'ya' dibuang - ABT membuang 'ya, ' di putusan. */
function amankanKomaYa(teks: string): string {
  return String(teks || "").replace(/([A-Za-z]+)(ya), /gi, (utuh, akar: string, ya: string) =>
    `${akar}${ya}`.toLowerCase() === "saya" ? utuh : `${akar}${ya} `
  );
}

/** Tiruan replace_ket_saksi ABT (Abt_model.php:855) - bunyi jawaban di putusan. */
const REPLACE_KET_SAKSI: Array<[RegExp, string]> = [
  [/saya/gi, "saksi"],
  [/ya, /gi, ""],
  [/penggugat/gi, "Penggugat"],
  [/pemohon/gi, "Pemohon"],
  [/tergugat/gi, "Tergugat"],
  [/termohon/gi, "Termohon"],
];
export function tiruanReplaceKetSaksi(jawaban: string): string {
  let t = String(jawaban || "");
  t = t.charAt(0).toLowerCase() + t.slice(1);
  for (const [cari, ganti] of REPLACE_KET_SAKSI) t = t.replace(cari, ganti);
  return `Bahwa ${t}`;
}

const POLA_SEBUTAN_SEMUA = /\b(penggugat|tergugat|pemohon|termohon)\b/gi;
const POLA_MODAL_NEGASI = /\b(tidak|tak|belum|bukan|tanpa|pernah|sering|selalu|kadang|jarang|mungkin|harus|wajib)\b/gi;
const POLA_PEMBUKA_BUANG = /^(ya|iya|benar|betul|setahu saya|sepengetahuan saya|yang saya ketahui)\s*,\s*/i;
const POLA_SUDAH_BERPEMBUKA =
  /^(ya|benar|betul|iya|setahu|sepengetahuan|sepanjang|sejauh|seingat|menurut|yang saya|sebatas)\b/i;
const POLA_SEBUTAN_AWAL = /^(Penggugat|Tergugat|Pemohon|Termohon)$/;

function sidikKata(teks: string, pola: RegExp): string {
  return (String(teks).toLowerCase().match(pola) || []).sort().join(",");
}

function hitungKembar(teks: string): number {
  const t = String(teks);
  return (t.match(/\b([A-Za-z]{3,}) dan \1\b/gi) || []).length + (t.match(/\b([A-Za-z]{3,}) \1\b/gi) || []).length;
}

export type HasilInvarian = { ok: boolean; pelanggaran: string[] };

/**
 * PEMERIKSA MAKNA - salinan periksaInvarian bot. Ragam boleh mengubah cara
 * mengatakan, bukan yang dikatakan: sebutan, penanda #dddd#, angka,
 * titik-titik, isi slot, kata modal/negasi tetap; tanpa 'Iya,' dan
 * '<kata>ya, '; sebutan tidak berhuruf kecil; tanpa kata kembar baru;
 * jawaban 'tetap' tidak disentuh; bunyinya di putusan tidak rusak.
 */
export function periksaInvarian(
  dasar: string,
  hasil: string,
  opsi?: { slot?: string[]; tetap?: boolean }
): HasilInvarian {
  const o = opsi || {};
  const d = tanpaAkhiran(dasar).replace(POLA_PEMBUKA_BUANG, "");
  const hPenuh = tanpaAkhiran(hasil);
  const h = hPenuh.replace(POLA_PEMBUKA_BUANG, "");
  const pelanggaran: string[] = [];
  if (sidikKata(d, POLA_SEBUTAN_SEMUA) !== sidikKata(h, POLA_SEBUTAN_SEMUA)) pelanggaran.push("sebutan_berubah");
  if (sidikKata(d, /#\d{4}#/g) !== sidikKata(h, /#\d{4}#/g)) pelanggaran.push("penanda_berubah");
  if (sidikKata(d, /\d+/g) !== sidikKata(h, /\d+/g)) pelanggaran.push("angka_berubah");
  if ((d.match(/\.{3,}|_+/g) || []).length !== (h.match(/\.{3,}|_+/g) || []).length) pelanggaran.push("titik_titik_berubah");
  for (const isi of o.slot || []) if (isi && !h.includes(isi)) pelanggaran.push("slot_hilang");
  if (sidikKata(d, POLA_MODAL_NEGASI) !== sidikKata(h, POLA_MODAL_NEGASI)) pelanggaran.push("modal_negasi_berubah");
  if (/^iya\b/i.test(hPenuh)) pelanggaran.push("iya");
  for (const m of hPenuh.matchAll(/([A-Za-z]+), /g)) {
    const kata = m[1].toLowerCase();
    if (kata.endsWith("ya") && kata !== "ya" && kata !== "saya") {
      pelanggaran.push("kata_ya_koma");
      break;
    }
  }
  if (/(^|[.;,!?]\s*)(penggugat|tergugat|pemohon|termohon)\b/.test(hPenuh)) pelanggaran.push("sebutan_huruf_kecil");
  if (hitungKembar(h) > hitungKembar(d)) pelanggaran.push("kata_kembar");
  if (o.tetap && h.toLowerCase() !== d.toLowerCase()) pelanggaran.push("jawaban_tetap_disentuh");
  const diPutusan = tiruanReplaceKetSaksi(akhiriJawaban(hPenuh));
  if (/^Bahwa\s*[,;]|\s{2,}/.test(diPutusan)) pelanggaran.push("putusan_rusak");
  return { ok: pelanggaran.length === 0, pelanggaran };
}

// ============================================================================
// PEMILIHAN BENTUK (sama dengan bot)
// ============================================================================

type Pihak = { pelaku: string; lawan: string };
type Perkara = { jenisPerkara?: unknown; alur?: unknown };

function kePenanda(teks: string, pihak: Pihak) {
  const dipakai: Record<"#0046#" | "#0047#", string> = {
    "#0046#": pihak.lawan || "Penggugat",
    "#0047#": pihak.pelaku || "Tergugat",
  };
  let t = String(teks);
  const ganti = (kata: string, penanda: "#0046#" | "#0047#") => {
    if (!kata) return;
    const pola = new RegExp(`\\b${kata.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
    if (pola.test(t)) {
      dipakai[penanda] = kata;
      t = t.replace(pola, penanda);
    }
  };
  ganti(pihak.lawan, "#0046#");
  ganti(pihak.pelaku, "#0047#");
  for (const k of ["Penggugat", "Pemohon"]) ganti(k, "#0046#");
  for (const k of ["Tergugat", "Termohon"]) ganti(k, "#0047#");
  return { teks: t, dipakai };
}

function dariPenanda(teks: string, dipakai: Record<"#0046#" | "#0047#", string>): string {
  return String(teks).split("#0046#").join(dipakai["#0046#"]).split("#0047#").join(dipakai["#0047#"]);
}

const SINGGAHAN_POLA_BENTUK = new Map<string, RegExp>();
function polaBentuk(nilai: string): RegExp {
  const kunci = String(nilai);
  const ada = SINGGAHAN_POLA_BENTUK.get(kunci);
  if (ada) return ada;
  const bagianNilai = kunci.split("{slot}").map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pola = new RegExp(`^${bagianNilai.join("([^;]{1,200}?)")}$`, "i");
  if (SINGGAHAN_POLA_BENTUK.size < 2000) SINGGAHAN_POLA_BENTUK.set(kunci, pola);
  return pola;
}

function syaratCocok(syarat: Record<string, unknown> | null, perkara: Perkara): boolean {
  if (!syarat) return true;
  if (syarat.jenisPerkaraId !== undefined && String(syarat.jenisPerkaraId) !== String(perkara.jenisPerkara || "")) return false;
  if (syarat.alur !== undefined && String(syarat.alur) !== String(perkara.alur || "")) return false;
  return true;
}

/** Kelompok BENTUK yang cocok (paling khusus = literal terpanjang), beserta isi slotnya. */
export function cocokBentuk(jawab: string, bank: BankRagam, pihak: Pihak, perkara: Perkara) {
  const { teks, dipakai } = kePenanda(tanpaAkhiran(jawab).replace(POLA_PEMBUKA_BUANG, ""), pihak);
  const normal = teks.charAt(0).toLowerCase() + teks.slice(1);
  let terbaik: {
    kunci: string;
    layak: Array<{ nilai: string; syarat: Record<string, unknown> | null }>;
    slot: string[];
    panjang: number;
  } | null = null;
  for (const [kunci, kelompok] of bank.bentuk) {
    const layak = kelompok.filter((v) => syaratCocok(v.syarat, perkara));
    if (layak.length < 2) continue;
    for (const v of layak) {
      const m = normal.match(polaBentuk(v.nilai));
      if (!m) continue;
      const panjang = v.nilai.replace(/\{slot\}/g, "").length;
      if (!terbaik || panjang > terbaik.panjang) terbaik = { kunci, layak, slot: m.slice(1), panjang };
    }
  }
  if (!terbaik) return null;
  const isiSlot = terbaik.slot;
  const varian = terbaik.layak.map((v) => {
    let i = 0;
    const isi = v.nilai.split("{slot}").reduce((acc, potong, k) => (k === 0 ? potong : acc + isiSlot[i++] + potong), "");
    return dariPenanda(isi, dipakai);
  });
  return { kunci: terbaik.kunci, varian, slot: isiSlot.map((x) => dariPenanda(x, dipakai)) };
}

function varianRagamKata(teks: string, bank: BankRagam): string[] {
  const berlaku = bank.ragamKata.filter((r) => teks.search(r.pola) >= 0);
  const hasil = [teks];
  for (const r of berlaku) hasil.push(teks.replace(r.pola, r.ganti));
  if (berlaku.length > 1) hasil.push(berlaku.reduce((t, r) => t.replace(r.pola, r.ganti), teks));
  return [...new Set(hasil)];
}

const POLA_AWAL_MENYANGKAL = /^(?:\S+\s+){0,2}(?:tidak|belum|bukan|tak)\b/i;

function pilihPembuka(teks: string, jenis: string, benih: string, bank: BankRagam): string {
  if (jenis === "rumusan" || jenis === "tetap") return "";
  const kata = (String(teks).match(/^[A-Za-z]+/) || [""])[0];
  if (!HIMPUNAN_AWAL.has(kata.toLowerCase()) && !POLA_SEBUTAN_AWAL.test(kata)) return "";
  if (POLA_SUDAH_BERPEMBUKA.test(teks) || /^(sudah|cukup|tidak ada)\b/i.test(teks)) return "";
  // Butir 27 - sama dengan bot: tidak ada pembuka di depan jawaban yang
  // dibuka penyangkal ("Ya, saya tidak menyaksikannya sendiri").
  if (POLA_AWAL_MENYANGKAL.test(teks)) return "";
  if (String(teks).split(" ").length < 3) return "";
  const u = angka01(`${benih}|pembuka`) * 100;
  let kumulatif = 0;
  for (const p of bank.pembuka) {
    kumulatif += p.bobot;
    if (u < kumulatif) return p.nilai;
  }
  return "";
}

/**
 * Pilihan berlawanan ("A;B") dan butir daftar ("A;-x;-y") - sama dengan
 * pecahPilihan bot. pilihan kosong = bukan jawaban berpilihan.
 */
export function pecahPilihan(jawab: string): { jawab: string; pilihan: string[]; daftar: boolean } {
  const mentah = String(jawab || "").replace(/&nbsp;/gi, " ");
  const bagian = mentah
    .split(/\s*;\s*(?:<br\s*\/?>\s*)?|\s*<br\s*\/?>\s*/i)
    .map((x) => rapikanTeks(x))
    .filter(Boolean);
  if (bagian.length < 2) return { jawab: rapikanTeks(mentah), pilihan: [], daftar: false };
  if (bagian.slice(1).every((b) => /^-/.test(b))) {
    return { jawab: bagian.join(" "), pilihan: bagian.slice(1).map((b) => b.replace(/^-\s*/, "")), daftar: true };
  }
  return { jawab: bagian[0], pilihan: bagian, daftar: false };
}

const POLA_HUBUNGAN_DUA_MENTAH = /#\d{4}#\s*\/\s*#?\d{4}#?/;
const POLA_HUBUNGAN_DUA = /^(.*\b(?:saya adalah|karena saya|sebagai))\s+(.+?)\s+\/\s+(.+?)$/i;

/** "saya adalah #1241# / #1242#" - satu templat untuk DUA saksi (sama dengan bot). */
export function pecahHubungan(jawab: string, mentah?: string | null): [string, string] | null {
  if (mentah !== undefined && mentah !== null && String(mentah) !== "") {
    if (!POLA_HUBUNGAN_DUA_MENTAH.test(String(mentah))) return null;
  }
  const m = tanpaAkhiran(jawab).match(POLA_HUBUNGAN_DUA);
  if (!m) return null;
  return [`${m[1]} ${m[2]}`, `${m[1]} ${m[3]}`];
}

// ============================================================================
// SATU JAWABAN
// ============================================================================

export type MasukanRagam = {
  tanya: string;
  /** Jawaban contoh ABT SESUDAH penandanya diisi. */
  jawab: string;
  /** Jawaban contoh ABT MENTAH (penanda belum diisi) - untuk memecah hubungan dua saksi. */
  jawabMentah?: string | null;
  nomorPerkara: string;
  kodeKumpulan: string;
  /** Urutan saksi dalam lembar ini (mulai 1) - rumus K7b. */
  ke: number;
  pihakSaksi: "P" | "T";
  /** Banyak saksi yang dilayani lembar - untuk tanda 'habis'. */
  jumlahSaksi: number;
  /** Sebutan pihak: pelaku = #0047#, lawan = #0046#. */
  pelaku: string;
  lawan: string;
  jenisPerkara?: unknown;
  alur?: unknown;
  bank: BankRagam;
};

export type VarianRagam = { indeks: number; n: number; habis: boolean; dilepas?: string[] };

export type HasilRagam = {
  /** Contoh untuk saksi ini - sudah diragamkan (bila boleh) dan sudah diperiksa. */
  jawab: string;
  /** Jawaban dasar per bagian sebelum ragam, pembanding periksaInvarian. */
  dasar: string[];
  varian: VarianRagam;
  /** Jenis pertanyaan menurut pemilih K7b. */
  jenis: "tetap" | "rumusan" | "pokok" | "lain";
  kelompok: string;
  /** Berapa bagian yang dilepas ke jawaban dasar karena melanggar invarian. */
  dilepas: number;
};

/**
 * Meragamkan SATU bagian jawaban - langkah 3-4 susunKeteranganSaksiSdg bot.
 * `kunciPool` membedakan bagian ke-2 dan seterusnya dari jawaban berpilihan.
 */
function ragamkanBagian(
  masuk: MasukanRagam,
  jawabBagian: string,
  kel: { jenis: HasilRagam["jenis"]; kelompok: string; kunci: string },
  kunciPool: string
): { akhir: string; dasar: string; varian: VarianRagam; dilepas: boolean } {
  const { bank, nomorPerkara, kodeKumpulan, ke, jumlahSaksi } = masuk;
  const pihak = { pelaku: String(masuk.pelaku || "").trim(), lawan: String(masuk.lawan || "").trim() };
  const perkara = { jenisPerkara: masuk.jenisPerkara, alur: masuk.alur };
  const indeksUntuk = (kunci: string, n: number) => indeksVarian({ nomorPerkara, kodeKumpulan, kunciTanya: kunci, n, ke });

  let jawab = tanpaAkhiran(jawabBagian);
  if (kel.jenis !== "tetap") jawab = jawab.replace(/^(ya|benar|betul|iya)\b\s*,?\s*/i, "");
  jawab = amankanKomaYa(jawab);
  const dasar = jawab;
  let varian: VarianRagam = { indeks: 0, n: 1, habis: false };

  if (kel.jenis !== "tetap" && dasar) {
    const profil = bank.profil.get(kel.kelompok) || bank.profil.get("lain") || { peluangRagam: 0 };
    if (diragamkan({ nomorPerkara, kunciTanya: kel.kunci, peluang: profil.peluangRagam })) {
      const cocok = cocokBentuk(dasar, bank, pihak, perkara);
      let calon = cocok ? cocok.varian : varianRagamKata(dasar, bank);
      if (cocok && calon.length < 4) calon = [...new Set([...calon, ...calon.flatMap((v) => varianRagamKata(v, bank).slice(1))])];
      const sah = calon.filter((v) => periksaInvarian(dasar, v, { slot: cocok ? cocok.slot : [] }).ok);
      const pool = sah.length ? sah : [dasar];
      const indeks = indeksUntuk(kunciPool, pool.length);
      jawab = pool[indeks];
      varian = { indeks, n: pool.length, habis: pool.length < jumlahSaksi };
    }
  }

  const benih = `${nomorPerkara}|${kodeKumpulan}|${kunciPool}|${ke}`;
  const rumusan = kel.jenis === "rumusan" || (bank.profil.get(kel.kelompok) || { rumusan: false }).rumusan;
  const pembuka = kel.jenis === "tetap" ? "" : pilihPembuka(jawab, rumusan ? "rumusan" : kel.jenis, benih, bank);
  const kecilkan = pembuka && !POLA_SEBUTAN_AWAL.test((jawab.match(/^[A-Za-z]+/) || [""])[0]);
  let akhir = pembuka ? pembuka + (kecilkan ? jawab.charAt(0).toLowerCase() : jawab.charAt(0)) + jawab.slice(1) : besarkanAwal(jawab);
  akhir = akhiriJawaban(akhir);

  const cek = periksaInvarian(dasar, akhir, { tetap: kel.jenis === "tetap" });
  if (!cek.ok) {
    return {
      akhir: akhiriJawaban(besarkanAwal(dasar)),
      dasar,
      varian: { indeks: 0, n: 1, habis: jumlahSaksi > 1, dilepas: cek.pelanggaran },
      dilepas: true,
    };
  }
  return { akhir, dasar, varian, dilepas: false };
}

/**
 * Jawaban contoh untuk SATU saksi.
 *
 * - Kelompok 'tetap' (sumpah, identitas) dikembalikan APA ADANYA - tidak
 *   dirapikan, tidak diberi pembuka, tidak diragamkan.
 * - Hubungan dua saksi "#1241# / #1242#" dipecah untuk saksi 1-2 pihak
 *   Penggugat; saksi lain tetap melihat keduanya (dipilih panitera).
 * - Jawaban berpilihan ("A;B") tetap berpilihan: TIAP pilihan diragamkan dan
 *   diperiksa sendiri, lalu disambung kembali - pilihan yang berlawanan tidak
 *   pernah dijatuhkan diam-diam, sebab yang memilihnya harus panitera.
 */
export function ragamkanJawabanContoh(masuk: MasukanRagam): HasilRagam {
  const tanya = rapikanTeks(masuk.tanya);
  const kel = kelompokTanya(tanya);
  const asli = String(masuk.jawab ?? "");
  if (kel.jenis === "tetap" || !asli.trim()) {
    return { jawab: asli, dasar: [asli], varian: { indeks: 0, n: 1, habis: false }, jenis: kel.jenis, kelompok: kel.kelompok, dilepas: 0 };
  }

  const pecah = pecahPilihan(asli);
  let bagian: string[] = pecah.pilihan.length && !pecah.daftar ? pecah.pilihan : [pecah.jawab];
  if (kel.kelompok === "kenal" && bagian.length === 1) {
    const dua = pecahHubungan(bagian[0], masuk.jawabMentah);
    if (dua && masuk.pihakSaksi === "P" && masuk.ke <= 2) bagian = [dua[masuk.ke - 1]];
  }

  const hasil = bagian.map((b, i) => ragamkanBagian(masuk, b, kel, i === 0 ? kel.kunci : `${kel.kunci}|pilihan ${i}`));

  return {
    jawab: hasil.map((r) => r.akhir).join(""),
    dasar: hasil.map((r) => r.dasar),
    // Varian bagian pertama - bagian yang sama dengan jawaban utama bot.
    varian: hasil[0]?.varian ?? { indeks: 0, n: 1, habis: false },
    jenis: kel.jenis,
    kelompok: kel.kelompok,
    dilepas: hasil.filter((r) => r.dilepas).length,
  };
}
