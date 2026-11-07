/**
 * ============================================================================
 * ALAT BUKTI TERTULIS - KATALOG, KOLOM, DAN PEMBANDING SIPP (6 Nov 2026)
 * ============================================================================
 *
 * Satu aturan untuk Blangko ABT by Derry Briantono (kembarannya ekstensi-sipp/bukti-tertulis.js) dan layar ALETA ABT. Murni: tanpa DOM,
 * tanpa jaringan. Bunyi kalimat dan pilihan meterai/pencocokan sama dengan penyunting bukti Blangko Derry. Kekuatan mengikuti penilai
 * pembuktian (penilai-bukti.ts) untuk jenis yang dikenalnya; jenis lain usulan katalog. Katalog satu sumber: bukti-katalog.json.
 */

import katalog from "./bukti-katalog.json";

export type KekuatanBukti = "Akta otentik" | "Dinilai majelis";
export type JenisKatalog = { kunci: string; nama: string; kelompok: string; oleh: string; kuat: KekuatanBukti; isi: string; wajib: string; utama: string; pola: RegExp };
export type JenisElektronik = { kunci: string; nama: string; kelompok: string; bentuk: string; objek: string; keterangan: string; utama: string };
export type KolomBukti = { an: string; no: string; contohNo: string; tgl: string };
export type BarisBukti = {
  nm: string;
  an?: string;
  no?: string;
  tgl?: string;
  tglTeks?: string;
  oleh?: string;
  meterai?: number;
  cocok?: number;
  manual?: string | null;
};
export type PihakSipp = { nama: string; nikSamar: string; nikSidik: string };
export type NikahSipp = { nomor: string; tglKutipan: string; kua: string; tglNikah: string };
export type DataSipp = { P: PihakSipp[]; T: PihakSipp[]; nikah: NikahSipp | null };
export type HasilBanding = { keadaan: "sama" | "beda"; sipp: string; pakai: string | null };

/**
 * Kode tanda bukti di naskah: P.n dan T.n, kode naskah rekonvensi PK.n, TK.n, PR.n, TR.n, dan pasangan satu bukti berkode ganda ("PK.2/TR.2").
 * Kode ditulis apa adanya; sisi (P atau T) hanya dipakai untuk memilih bunyi: PK dan TR milik penggugat/pemohon, TK dan PR milik tergugat/termohon
 * (pengaju rekonvensi adalah tergugat/termohon konvensi, jadi PR berpihak ke T dan TR, lawannya, ke P).
 */
const KODE_SATU = String.raw`(?:PK|TK|PR|TR|P|T)\.\s?\d+`;
export const POLA_KODE_TANDA = String.raw`${KODE_SATU}(?:\s?/\s?${KODE_SATU})?`;
export const SISI_KODE_NASKAH: Readonly<Record<string, "P" | "T">> = { P: "P", PK: "P", TR: "P", T: "T", TK: "T", PR: "T" };

/** Kode dirapikan: tanpa spasi, huruf besar ("pk. 2 / tr.2" menjadi "PK.2/TR.2"). */
export const rapikanKodeTanda = (kode: string): string => String(kode ?? "").replace(/\s+/g, "").toUpperCase();

/** Sisi dan nomor dari kode pertama ("PK.2/TR.2" -> P, 2). */
export function bacaKodeTanda(kode: string): { sisi: "P" | "T"; nomor: number } | null {
  const m = /^(PK|TK|PR|TR|P|T)\.(\d+)/.exec(rapikanKodeTanda(kode));
  return m ? { sisi: SISI_KODE_NASKAH[m[1]], nomor: Number(m[2]) } : null;
}

export const KATALOG_BUKTI: readonly JenisKatalog[] = Object.freeze(
  katalog.surat.map((x) => ({
    kunci: x.k,
    nama: x.n,
    kelompok: x.g,
    oleh: x.o,
    kuat: (x.kuat === "O" ? "Akta otentik" : "Dinilai majelis") as KekuatanBukti,
    isi: x.isi,
    wajib: "w" in x ? String(x.w) : "",
    utama: x.u,
    pola: new RegExp(x.p, "i"),
  }))
);

export const KATALOG_ELEKTRONIK: readonly JenisElektronik[] = Object.freeze(
  katalog.elektronik.map((x) => ({ kunci: x.k, nama: x.n, kelompok: x.g, bentuk: x.b, objek: x.o, keterangan: x.ket, utama: x.u }))
);

/** Jenis umum hanya dipakai bila tidak ada jenis khusus yang cocok. */
const JENIS_UMUM = new Set(["keterangan", "pernyataan", "perjanjian"]);

/** Kunci jenis dari nama bukti: jenis khusus lebih dulu, lalu kecocokan terpanjang. "" bila tidak dikenal. */
export function jenisBuktiDari(nama: unknown): string {
  const n = String(nama ?? "");
  let kunci = "";
  let panjang = 0;
  for (const x of KATALOG_BUKTI) {
    if (JENIS_UMUM.has(x.kunci)) continue;
    const m = x.pola.exec(n);
    if (m && m[0].length > panjang) {
      kunci = x.kunci;
      panjang = m[0].length;
    }
  }
  if (kunci) return kunci;
  return KATALOG_BUKTI.find((x) => JENIS_UMUM.has(x.kunci) && x.pola.test(n))?.kunci ?? "";
}

export function katalogDari(nama: unknown): JenisKatalog | null {
  const j = jenisBuktiDari(nama);
  return KATALOG_BUKTI.find((x) => x.kunci === j) ?? null;
}

/** Label kolom menurut jenis. Bawaan sama dengan penyunting lama. */
export function kolomBukti(nama: unknown): KolomBukti {
  const j = jenisBuktiDari(nama);
  if (j === "ktp") return { an: "Atas nama", no: "NIK", contohNo: "16 angka NIK", tgl: "Tanggal KTP dikeluarkan" };
  if (j === "kk") return { an: "Kepala keluarga", no: "Nomor KK", contohNo: "nomor Kartu Keluarga", tgl: "Tanggal" };
  if (j === "nikah" || j === "duplikat") return { an: "Atas nama", no: "Nomor kutipan", contohNo: "boleh kosong", tgl: j === "duplikat" ? "Tanggal duplikat" : "Tanggal kutipan" };
  if (j === "lahir") return { an: "Atas nama anak", no: "Nomor akta", contohNo: "boleh kosong", tgl: "Tanggal akta" };
  if (j === "mati" || j === "aktamati") return { an: "Yang meninggal", no: j === "aktamati" ? "Nomor akta" : "Nomor surat", contohNo: "boleh kosong", tgl: j === "aktamati" ? "Tanggal akta" : "Tanggal surat" };
  if (j === "shm" || j === "hgb") return { an: "Atas nama", no: "Nomor sertifikat", contohNo: "boleh kosong", tgl: "Tanggal terbit" };
  if (j === "bpkb" || j === "stnk") return { an: "Atas nama", no: j === "bpkb" ? "Nomor BPKB" : "Nomor polisi", contohNo: "boleh kosong", tgl: "Tanggal" };
  return { an: "Atas nama", no: "Nomor surat", contohNo: "boleh kosong", tgl: "Tanggal" };
}

/** Bentuk tampil NIK: empat angka depan dan empat belakang. */
export function samarkanNik(nik: unknown): string {
  const d = String(nik ?? "").replace(/\D/g, "");
  if (d.length < 9) return d ? "••••" : "";
  return `${d.slice(0, 4)} •••• •••• ${d.slice(-4)}`;
}

/** Jumlah sidang beragenda pembuktian dari bot: bilangan bulat 1 sampai 50; selain itu (kosong, nol, pecahan, bukan angka) = null. */
export function bersihAgendaPembuktian(x: unknown): number | null {
  return typeof x === "number" && Number.isInteger(x) && x >= 1 && x <= 50 ? x : null;
}

/** Sidik pembanding NIK (FNV-1a). Halaman SIPP/ABT bukan konteks aman, jadi WebCrypto tidak tersedia; hanya untuk mendeteksi salah ketik. */
export function sidikNik(nik: unknown): string {
  const d = String(nik ?? "").replace(/\D/g, "");
  if (!d) return "";
  let h = 0x811c9dc5;
  for (let i = 0; i < d.length; i += 1) {
    h ^= d.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

const normal = (t: unknown) =>
  String(t ?? "")
    .toLowerCase()
    .replace(/kantor urusan agama/g, "kua")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
/**
 * "Rahmawati" dan "Rahmawati binti Ahmad" orang yang sama pada bukti; gelar sesudah koma diabaikan. Penanda peran dalam kurung
 * ("SITI CONTOH (Penggugat)", hasil isian #4048#) dan nama sebutan ("... alias ...") bukan bagian nama: tanpa ini 112 dari 1.054 perkara
 * berbukti di salinan uji terbaca "berbeda dari SIPP" padahal orangnya sama (ditemukan 7 Nov 2026).
 */
const intiNama = (t: unknown) =>
  normal(String(t ?? "").split(",")[0])
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+alias\s+.*$/, "")
    .replace(/\s+(?:bin|binti)\s+.*$/, "")
    .trim();

/** SIPP menyimpan nomor duplikat dengan awalan kata ("Duplikat B-100/..."), sedangkan kalimat bukti menulis kata itu pada nama surat dan hanya nomornya sesudah "Nomor". */
const tanpaAwalanNomor = (n: string) => n.replace(/^\s*(?:duplikat|salinan|turunan)\s+/i, "").trim();

const bandingTeks = (nilai: unknown, sipp: string, sama: boolean): HasilBanding | null =>
  !sipp || !String(nilai ?? "").trim() ? null : { keadaan: sama ? "sama" : "beda", sipp, pakai: sama ? null : sipp };

/**
 * Isian satu baris dibanding SIPP. Hasil: { kolom: {keadaan, sipp, pakai} }. Hanya KTP dan Kutipan Akta Nikah yang punya padanan di SIPP.
 * Kolom kosong tidak dibandingkan. NIK tidak punya "pakai" karena nilai utuhnya tidak pernah dikirim ke peramban.
 * urutanKtp: ini KTP ke berapa pada sisi itu (dari 0), dipakai bila nama pada bukti tidak cocok dengan pihak mana pun.
 */
export function bandingBaris(r: BarisBukti, sisi: "P" | "T", urutanKtp: number, sipp: DataSipp | null): Record<string, HasilBanding> {
  const hasil: Record<string, HasilBanding> = {};
  if (!sipp || typeof r.manual === "string") return hasil;
  const j = jenisBuktiDari(r.nm);
  const pasang = (kolom: string, h: HasilBanding | null) => {
    if (h) hasil[kolom] = h;
  };
  if (j === "ktp") {
    const daftar = sipp[sisi] || [];
    const an = intiNama(r.an);
    const p = (an ? daftar.find((x) => intiNama(x.nama) === an) : null) ?? daftar[urutanKtp] ?? null;
    if (!p) return hasil;
    pasang("an", bandingTeks(r.an, p.nama, intiNama(r.an) === intiNama(p.nama)));
    const samaNik = sidikNik(r.no) === p.nikSidik;
    if (p.nikSidik && String(r.no ?? "").trim()) hasil.no = { keadaan: samaNik ? "sama" : "beda", sipp: p.nikSamar, pakai: null };
    return hasil;
  }
  if ((j === "nikah" || j === "duplikat") && sipp.nikah) {
    const n = sipp.nikah;
    const nomorBukti = String(r.no ?? "").trim();
    pasang("no", bandingTeks(r.no, n.nomor, nomorBukti === n.nomor || (nomorBukti !== "" && nomorBukti === tanpaAwalanNomor(n.nomor))));
    // Tanggal duplikat memang lain dari tanggal kutipan pertama.
    if (j === "nikah") pasang("tgl", bandingTeks(r.tgl, n.tglKutipan, r.tgl === n.tglKutipan));
    pasang("oleh", bandingTeks(r.oleh, n.kua, normal(r.oleh) === normal(n.kua)));
  }
  return hasil;
}

/** Berkas e-Court untuk satu bukti: judul yang cocok jenisnya, lalu berkas gabungan "Dokumen Bukti" (KTP, KK, buku nikah sering satu berkas). */
export function berkasUntukBukti<T extends { judul: string; documentKey: string }>(nama: unknown, dokumen: readonly T[]): T | null {
  const jenis = katalogDari(nama);
  const daftar = Array.isArray(dokumen) ? dokumen : [];
  return (jenis ? daftar.find((d) => jenis.pola.test(d.judul)) : undefined) ?? daftar.find((d) => /\bbukti\b/i.test(d.judul)) ?? null;
}

// Bunyi kalimat: sama dengan penyunting Blangko Derry (blangko-derry-isian.js kalimatBukti).
export const PIL_METERAI = Object.freeze(["bermeterai cukup dan dinazegelen", "bermeterai cukup tetapi tidak dinazegelen", "tidak bermeterai dan tidak dinazegelen", "tanpa kalimat meterai"]);
export const PIL_COCOK = Object.freeze(["telah dicocokkan dengan aslinya dan ternyata sesuai", "tidak dapat dicocokkan dengan aslinya", "dicocokkan dari fotokopinya", "dicocokkan dengan kopian sebelumnya dan ternyata sesuai", "tanpa kalimat pencocokan"]);
const KAL_METERAI = [", bukti surat tersebut telah diberi meterai cukup, di-nazegelen", ", bukti surat tersebut telah diberi meterai cukup, tetapi tidak di-nazegelen", ", bukti surat tersebut tidak bermeterai dan tidak di-nazegelen", ""];
const KAL_COCOK = ["telah dicocokkan dengan aslinya yang ternyata sesuai", "tidak dapat dicocokkan dengan aslinya", "dicocokkan dari fotokopinya", "telah dicocokkan dengan kopian sebelumnya dan ternyata sesuai", ""];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export function tanggalIndo(iso: unknown): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
  return m ? `${Number(m[3])} ${BULAN[Number(m[2]) - 1]} ${m[1]}` : String(iso ?? "");
}

function keIso(teks: string): string {
  const t = teks.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = /^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})$/.exec(t);
  if (m) {
    const bulan = m[2].toLowerCase().slice(0, 3);
    const b = BULAN.findIndex((x) => x.toLowerCase().startsWith(bulan));
    if (b >= 0) return `${m[3]}-${String(b + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return "";
}

/** Kalimat satu bukti. Bagian kosong tidak ditulis. `kodeAsli` (mis. "PK.2/TR.2") dipakai apa adanya bila diberikan; kosong: "P.n" atau "T.n". */
export function kalimatBaris(r: BarisBukti, sisi: "P" | "T", i: number, kodeAsli?: string): string {
  const kode = kodeAsli ? rapikanKodeTanda(kodeAsli) : `${sisi}.${i + 1}`;
  if (typeof r.manual === "string" && r.manual.trim()) return r.manual.trim();
  const nm = String(r.nm ?? "").trim();
  const an = String(r.an ?? "").trim();
  const no = String(r.no ?? "").trim();
  let t = nm;
  if (an) t += `${t ? " " : ""}atas nama ${an}`;
  if (no) t += `${t ? (nm && /\bnomor\b/i.test(nm) && !an ? " " : ", ") : ""}${jenisBuktiDari(nm) === "ktp" ? "NIK" : "Nomor"} ${no}`;
  if (r.tgl) t += ` tanggal ${tanggalIndo(r.tgl)}`;
  else if (r.tglTeks) t += ` tanggal ${r.tglTeks}`;
  if (String(r.oleh ?? "").trim()) t += `, yang dikeluarkan oleh ${String(r.oleh).trim()}`;
  const tm = KAL_METERAI[Number(r.meterai) || 0] ?? KAL_METERAI[0];
  const tc = KAL_COCOK[Number(r.cocok) || 0] ?? KAL_COCOK[0];
  t += tm;
  if (tc) t += tm ? `, serta ${tc}` : `, bukti surat tersebut ${tc}`;
  t += `, lalu diberi tanda ${kode} serta diberi tanggal dan paraf oleh Ketua Majelis;`;
  return t.replace(/^, /, "");
}

/** Satu kalimat bukti dari naskah menjadi isian. Yang tidak berbentuk baku tetap sebagai kalimat bebas. Aturan sama dengan uraiBukti panel. */
export function uraiKalimatBukti(teks: string): BarisBukti {
  let s = String(teks ?? "").replace(/\s+/g, " ").trim().replace(/^\d+[.)]\s*/, "").replace(/;$/, "");
  const r: BarisBukti = { nm: "", an: "", no: "", tgl: "", oleh: "", meterai: 0, cocok: 0, manual: null };
  if (!new RegExp(String.raw`bukti surat tersebut|,\s*lalu diberi tanda\s+${POLA_KODE_TANDA}\s+serta diberi tanggal`, "i").test(s)) {
    r.nm = (/^[^,.;]+/.exec(s) || [s])[0].trim();
    r.manual = String(teks ?? "").replace(/\s+/g, " ").trim();
    return r;
  }
  r.meterai = !/meterai/i.test(s) ? 3 : /tidak bermeterai/i.test(s) ? 2 : /tidak di-?nazegelen/i.test(s) ? 1 : 0;
  r.cocok = /kopian sebelumnya/i.test(s) ? 3 : /tidak dapat dicocokkan/i.test(s) ? 1 : /dari fotokopinya/i.test(s) ? 2 : /dicocokkan/i.test(s) ? 0 : 4;
  s = s.replace(/,?\s*bukti surat tersebut[\s\S]*$/i, "").replace(/,?\s*lalu diberi tanda[\s\S]*$/i, "");
  // Titik-titik ("...", "…") adalah isian yang belum diisi di ABT, bukan nilai: bagian itu dibaca kosong, tetapi tetap dibuang dari nama.
  const TITIK = /^[\s._…-]*$/;
  const oleh = /,?\s*yang (?:dikeluarkan|diterbitkan) oleh\s+(.+?)$/i.exec(s);
  if (oleh) {
    r.oleh = TITIK.test(oleh[1]) ? "" : oleh[1].trim();
    s = s.slice(0, oleh.index);
  }
  s = s.replace(/[,\s]+$/, "");
  const tgl = /,?\s*\b(?:ter)?tanggal\s+([0-9]{1,2}[-/ ][A-Za-z0-9]+[-/ ][0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2}|\.{2,}|…+|_{2,})\s*$/i.exec(s);
  if (tgl) {
    const tt = tgl[1].replace(/\s+/g, " ").trim();
    if (!TITIK.test(tt)) {
      r.tgl = keIso(tt);
      if (!r.tgl) r.tglTeks = tt;
    }
    s = s.slice(0, tgl.index);
  }
  s = s.replace(/[,\s]+$/, "");
  const no = /,?\s*\bNIK\.?\s*:?\s*([0-9][0-9 .]*[0-9])\s*$/i.exec(s) || /,?\s*\bNomor\s*:?\s+(.+?)\s*$/i.exec(s);
  if (no && !/^Nomor\s*$/i.test(s)) {
    r.no = TITIK.test(no[1]) ? "" : no[1].trim();
    s = s.slice(0, no.index);
  }
  s = s.replace(/[,\s]+$/, "");
  const an = /\s+(?:atas nama|a\.\s?n\.)\s+(.+)$/i.exec(s);
  if (an) {
    r.an = an[1].replace(/[,\s]+$/, "").trim();
    s = s.slice(0, an.index);
  }
  r.nm = s.replace(/[,\s]+$/, "").trim();
  return r;
}

export type BuktiNaskah = { sisi: "P" | "T"; nomor: number; /** Kode seperti tertulis di naskah: "P.1", "PK.2", "TR.3", atau "PK.2/TR.2". */ kode: string; baris: BarisBukti };

/** Alinea uraian satu surat, bukan alinea pertimbangan yang kebetulan menyebut tanda bukti. */
const uraianSuratLepas = (t: string): boolean =>
  !/^\s*(?:\d+[.)]\s*)?(?:-\s*)?(?:Menimbang|Bahwa)\b/i.test(t) && /foto\s?-?(?:kopi|copy)|kopi|salinan|\bscan\b|\basli\b|meterai/i.test(t);

const polaTandaSurat = () => new RegExp(String.raw`diberi tanda\s+(${POLA_KODE_TANDA})\s+serta diberi tanggal`, "i");
// Naskah yang diketik sendiri punya bentuk lain: "lalu diberi tanda P.1;", "dengan tanda P.1", "diberi kode bukti (P.1)". Kalimatnya tampil apa adanya.
const polaTandaLain = () => new RegExp(String.raw`(?:diberi tanda|dengan tanda(?:\s+tanda)?|diberi kode bukti)\s*\(?\s*(${POLA_KODE_TANDA})(?!\d)`, "i");

/** Setiap kemunculan kalimat bukti surat di naskah menurut urutnya, termasuk yang kodenya berulang. */
function semuaBuktiSurat(alinea: ReadonlyArray<{ teks: string }>): Array<{ kode: string; teks: string }> {
  const hasil: Array<{ kode: string; teks: string }> = [];
  const pola = polaTandaSurat();
  const polaLain = polaTandaLain();
  for (const a of alinea) {
    const t = String(a.teks ?? "");
    if (/bukti elektronik tersebut/i.test(t)) continue;
    const m = pola.exec(t) ?? (uraianSuratLepas(t) ? polaLain.exec(t) : null);
    if (!m) continue;
    const kode = rapikanKodeTanda(m[1]);
    if (!bacaKodeTanda(kode)) continue;
    hasil.push({ kode, teks: t });
  }
  return hasil;
}

/**
 * Bukti surat yang tertulis di naskah: alinea yang memuat "diberi tanda" diikuti kode (P.n, T.n, PK.n, TK.n, PR.n, TR.n, atau pasangan "PK.2/TR.2"),
 * tanpa bukti elektronik. Urut seperti di naskah. Kode dibawa apa adanya; sisi menurut SISI_KODE_NASKAH. Kode yang tertulis berulang dibaca dari
 * kemunculan pertama; yang kalimatnya berbeda dilaporkan oleh kodeGandaDiNaskah.
 */
export function buktiDariAlinea(alinea: ReadonlyArray<{ teks: string }>): BuktiNaskah[] {
  const hasil: BuktiNaskah[] = [];
  const sudah = new Set<string>();
  for (const { kode, teks } of semuaBuktiSurat(alinea)) {
    const b = bacaKodeTanda(kode);
    if (!b || sudah.has(kode)) continue;
    sudah.add(kode);
    hasil.push({ sisi: b.sisi, nomor: b.nomor, kode, baris: uraiKalimatBukti(teks) });
  }
  return hasil;
}

export type KodeGanda = { kode: string; jumlah: number; elektronik: boolean };
const kalimatSama = (x: string) => x.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Kode bukti yang tertulis lebih dari sekali di naskah dengan kalimat yang berbeda (biasanya dua kotak bukti di Blangko ABT sama-sama terisi).
 * buktiDariAlinea dan butirElektronikDariAlinea hanya membaca kemunculan pertama, jadi yang lain dilaporkan di sini supaya tidak hilang diam-diam.
 * Salinan yang kalimatnya sama persis tidak dilaporkan. Urut menurut kemunculan pertama.
 */
export function kodeGandaDiNaskah(alinea: ReadonlyArray<{ teks: string }>): KodeGanda[] {
  const kelompok = new Map<string, { kalimat: Set<string>; jumlah: number; elektronik: boolean }>();
  const catat = (kode: string, teks: string, elektronik: boolean) => {
    const kunci = `${elektronik ? "E" : "S"}|${kode}`;
    const e = kelompok.get(kunci) ?? { kalimat: new Set<string>(), jumlah: 0, elektronik };
    e.kalimat.add(kalimatSama(teks));
    e.jumlah += 1;
    kelompok.set(kunci, e);
  };
  for (const x of semuaBuktiSurat(alinea)) catat(x.kode, x.teks, false);
  for (const x of semuaButirElektronik(alinea)) catat(x.kode, x.teks, true);
  return [...kelompok.entries()]
    .filter(([, e]) => e.jumlah > 1 && e.kalimat.size > 1)
    .map(([kunci, e]) => ({ kode: kunci.slice(2), jumlah: e.jumlah, elektronik: e.elektronik }));
}

export type ButirElektronik = {
  sisi: "P" | "T";
  nomor: number;
  /** Kode tanda seperti tertulis di naskah ("T.3", "TK.4", ...). */
  kode: string;
  /** Nama dari katalog elektronik bila dikenali; selain itu bagian depan kalimat naskah. */
  nama: string;
  /** Kunci katalog elektronik (mis. "el-wa"); "" bila tidak dikenali. */
  jenis: string;
  /** Keadaan pemeriksaan menurut kalimat: 0 tidak dapat dicocokkan dan tanpa digital forensic, 1 dicocokkan dengan aslinya, 2 disertai hasil digital forensic; null tidak terbaca. */
  periksa: 0 | 1 | 2 | null;
};

/** Jenis katalog elektronik dari bagian depan kalimat (bentuk + objek): objek terpanjang yang tersebut menang. */
export function jenisElektronikDari(teks: unknown): JenisElektronik | null {
  const t = String(teks ?? "").toLowerCase();
  let terbaik: JenisElektronik | null = null;
  for (const x of KATALOG_ELEKTRONIK) {
    const o = x.objek.toLowerCase();
    if (o && t.includes(o) && (!terbaik || o.length > terbaik.objek.length)) terbaik = x;
  }
  return terbaik;
}

/** Setiap kemunculan kalimat "bukti elektronik tersebut" berkode di naskah menurut urutnya, termasuk yang kodenya berulang. */
function semuaButirElektronik(alinea: ReadonlyArray<{ teks: string }>): Array<{ kode: string; teks: string }> {
  const hasil: Array<{ kode: string; teks: string }> = [];
  const pola = new RegExp(String.raw`diberi tanda\s+(${POLA_KODE_TANDA})`, "i");
  for (const a of alinea) {
    const t = String(a.teks ?? "").replace(/\s+/g, " ").trim();
    if (!/bukti elektronik tersebut/i.test(t)) continue;
    const m = pola.exec(t);
    if (!m) continue;
    const kode = rapikanKodeTanda(m[1]);
    if (!bacaKodeTanda(kode)) continue;
    hasil.push({ kode, teks: t });
  }
  return hasil;
}

/**
 * Bukti elektronik yang tertulis di naskah: alinea yang memuat "bukti elektronik tersebut" dan "diberi tanda" diikuti kode (P.n, T.n, PK.n, TK.n, PR.n, TR.n).
 * Bunyi kalimat sama dengan kalimatBuktiEl di Blangko Derry. Urut seperti di naskah; kode berulang dihitung sekali.
 */
export function butirElektronikDariAlinea(alinea: ReadonlyArray<{ teks: string }>): ButirElektronik[] {
  const hasil: ButirElektronik[] = [];
  const sudah = new Set<string>();
  for (const { kode, teks: t } of semuaButirElektronik(alinea)) {
    const b = bacaKodeTanda(kode);
    if (!b || sudah.has(kode)) continue;
    sudah.add(kode);
    const depan = t.replace(/^\d+[.)]\s*/, "").split(/,\s*bukti (?:surat|elektronik) tersebut/i)[0].trim();
    const periksa: ButirElektronik["periksa"] = /tidak (?:dapat )?dicocokkan/i.test(t) || /tidak disertai/i.test(t) ? 0 : /disertai dengan hasil digital forensic/i.test(t) ? 2 : /telah dicocokkan/i.test(t) ? 1 : null;
    const jenis = jenisElektronikDari(depan);
    hasil.push({ sisi: b.sisi, nomor: b.nomor, kode, nama: jenis ? jenis.nama : depan || "Bukti elektronik", jenis: jenis ? jenis.kunci : "", periksa });
  }
  return hasil;
}
