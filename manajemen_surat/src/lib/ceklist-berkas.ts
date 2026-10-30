/**
 * ============================================================================
 * CEKLIST BERKAS PERKARA (Meja I / Pendaftaran), pasangan sampul cetak awal (26 Okt 2026) - MURNI
 * ============================================================================
 *
 * Daftar dokumen mengikuti jenis dan keadaan perkara (yang tidak berlaku tidak dicetak). Ada / Tidak ada ditentukan otomatis (tanda OTO) HANYA dari
 * sumber yang pasti; selebihnya dibiarkan kosong untuk dicentang petugas Meja I:
 *
 *   penetapan awal   perkara_penetapan (PMH, PPP, PJS, PHS): terbit = ada, belum terbit = tidak ada.
 *   SKUM, setor      kasir (perkara_biaya panjar): ada bila tercatat, tidak ada bila belum (kecuali prodeo, yang tidak punya setoran panjar).
 *   SKTM (prodeo)    judul dokumen e-Court memuat SKTM / KIS; tidak ditemukan padahal daftar dokumen terbaca = tidak ada.
 *   izin atasan      izinCeraiService (perkara_izin_cerai, posita, e-Court): ada / belum ada; belum terbaca = petugas.
 *   dokumen lain     judul dokumen e-Court dan arsip e-Court (BUKAN kolom cermin berkas_pdf yang basi): ditemukan = ada; tidak ditemukan = petugas
 *                    (KTP, KK, buku nikah dan sebagainya sering berada di dalam satu berkas "Dokumen Bukti"; tidak ditemukan tidak berarti tidak ada).
 *   dokumen fisik    buku nikah asli, fotokopi bermeterai: selalu petugas.
 *
 * Tabel disusun di sini (baris tabel sungguhan) dan ditempel menggantikan paragraf penanda di RTF yang diisi ABT.
 */

export type StatusCeklist = "ok" | "no" | "";
export type SifatCeklist = "WAJIB" | "BILA ADA";

export type FaktaCeklist = {
  keadaan: { phs?: boolean; kuasa?: boolean; prodeo?: boolean; ghaib?: boolean; ecourt?: boolean; anak?: boolean; tanggalDaftar?: string };
  penetapan: { pmh?: string; ppp?: string; pjs?: string; phs?: string };
  ppNama?: string;
  kasir: { jumlah?: number; tanggal?: string; baris?: number };
  izinCerai?: string;
  judulDokumen: string[];
  tertulisDokumen?: boolean;
};

export type BarisCeklist =
  | { grup: string }
  | { tangan: true }
  | { kunci: string; nama: string; sifat: SifatCeklist; st: StatusCeklist; oto: boolean; sumber: string; kecil?: string };

export type HasilCeklist = {
  baris: BarisCeklist[];
  ringkas: { ada: number; belum: number; petugas: number };
  penandaJenis: string;
  sebutan: { p: string; t: string };
};

const POLA: Record<string, RegExp> = {
  gugatan: /gugatan|permohonan/i,
  kuasa: /surat\s+kuasa/i,
  advokat: /kartu\s+advokat|berita\s+acara\s+sumpah|sumpah\s+advokat/i,
  sktm: /tidak\s+mampu|sktm|kartu\s+indonesia\s+sehat|\bkis\b|\bpkh\b/i,
  ktp: /\bktp\b|kartu\s+tanda\s+penduduk/i,
  nikah: /(?:buku|akta|kutipan|duplikat)\s+nikah/i,
  kk: /kartu\s+keluarga|\bkk\b/i,
  ghaib: /ghaib|gaib/i,
  lahir: /akta\s+(?:kelahiran|lahir)|surat\s+kelahiran/i,
  tolak_kua: /penolakan/i,
  ket_kua: /keterangan[^.]{0,40}kua|tidak\s+tercatat/i,
  ket_desa: /keterangan[^.]{0,40}(?:desa|lurah)/i,
  kematian: /kematian|meninggal/i,
  silsilah: /silsilah|ahli\s+waris/i,
  milik: /sertifikat|bpkb|kepemilikan|\bshm\b|akta\s+jual/i,
  rekom: /rekomendasi|konseling|psikolog|keterangan\s+sehat/i,
  setuju: /persetujuan\s+istri/i,
  gaji: /penghasilan|gaji/i,
  adil: /berlaku\s+adil/i,
  akad: /akad|perjanjian\s+pembiayaan/i,
  somasi: /somasi|surat\s+peringatan/i,
  akta_cerai: /akta\s+cerai|putusan\s+cerai/i,
  bidan: /bidan|rumah\s+sakit/i,
};

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;
const tanggalPendek = (iso: string | undefined) => {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const b = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][Number(m[2]) - 1];
  return `${Number(m[3])} ${b} ${m[1]}`;
};

export const CERAI = ["cg", "ct"];

/** Penanda jenis di kepala ceklist: cerai = CT dan CG (yang berlaku bertanda), selain itu satu kode. Bentuk "[X] CG   [ ] CT" (kotak dirapikan portal). */
export function penandaJenisCeklist(jenis: string): string {
  if (jenis === "cg") return "[ ] CT   [X] CG";
  if (jenis === "ct") return "[X] CT   [ ] CG";
  const kode: Record<string, string> = { dk: "DK", in: "IN", aua: "AU", wali: "PW", asuh: "HA", adhol: "WA", poligami: "IP", waris: "WR", paw: "PAW", hb: "HB", es: "ES", batal: "PN", lain: "LN" };
  return `[X] ${kode[jenis] ?? "LN"}`;
}

/** Dokumen khas selain cerai: kunci, nama, sifat (pola cocok di POLA[kunci]). */
const KHAS: Record<string, Array<[string, string, SifatCeklist]>> = {
  dk: [
    ["tolak_kua", "Surat Penolakan Pencatatan Nikah dari KUA", "WAJIB"],
    ["lahir", "Fotokopi Akta Kelahiran Anak dan Calon Pasangan", "WAJIB"],
    ["ktp_calon", "Fotokopi KTP / KK Calon Pasangan dan Orang Tuanya", "WAJIB"],
    ["rekom", "Surat Keterangan Sehat / Rekomendasi Konseling", "BILA ADA"],
  ],
  in: [
    ["ket_kua", "Surat Keterangan KUA (pernikahan tidak tercatat)", "WAJIB"],
    ["ket_desa", "Surat Keterangan Kepala Desa tentang Pernikahan", "BILA ADA"],
  ],
  waris: [
    ["kematian", "Surat Keterangan Kematian Pewaris", "WAJIB"],
    ["silsilah", "Silsilah / Keterangan Ahli Waris dari Desa", "WAJIB"],
    ["milik", "Bukti Kepemilikan Harta Waris (sertifikat, BPKB)", "BILA ADA"],
  ],
  paw: [
    ["kematian", "Surat Keterangan Kematian Pewaris", "WAJIB"],
    ["silsilah", "Silsilah / Keterangan Ahli Waris dari Desa", "WAJIB"],
    ["milik", "Bukti Peninggalan (tabungan, sertifikat, BPKB)", "BILA ADA"],
  ],
  hb: [
    ["akta_cerai", "Akta Cerai / Putusan Cerai", "WAJIB"],
    ["milik", "Bukti Kepemilikan Objek Harta Bersama", "WAJIB"],
  ],
  aua: [
    ["lahir", "Akta / Surat Keterangan Kelahiran Anak", "WAJIB"],
    ["bidan", "Surat Keterangan Bidan / Rumah Sakit", "BILA ADA"],
  ],
  wali: [
    ["kematian", "Surat Keterangan Kematian Orang Tua Anak", "WAJIB"],
    ["kk_anak", "Kartu Keluarga Anak dan Calon Wali", "WAJIB"],
  ],
  asuh: [["lahir", "Fotokopi Akta Kelahiran Anak", "WAJIB"]],
  adhol: [
    ["tolak_kua", "Surat Penolakan KUA (wali enggan menikahkan)", "WAJIB"],
    ["ket_desa", "Keterangan Calon Mempelai dan Wali", "WAJIB"],
  ],
  poligami: [
    ["setuju", "Surat Persetujuan Istri", "WAJIB"],
    ["gaji", "Keterangan Penghasilan Pemohon", "WAJIB"],
    ["adil", "Surat Pernyataan Berlaku Adil", "WAJIB"],
  ],
  es: [
    ["akad", "Akad / Perjanjian Pembiayaan", "WAJIB"],
    ["somasi", "Surat Peringatan (Somasi)", "BILA ADA"],
  ],
  batal: [["nikah_batal", "Kutipan Akta Nikah yang Dibatalkan", "WAJIB"]],
};

export type BahanCeklist = { jenis: string; lawan: boolean; fakta: FaktaCeklist; tangan: Record<string, boolean>; sebutan?: { p?: string; t?: string } };

export function susunCeklist(b: BahanCeklist): HasilCeklist {
  const f = b.fakta;
  const cerai = CERAI.includes(b.jenis);
  const sebutan = { p: b.sebutan?.p || (b.lawan && b.jenis !== "ct" ? "Penggugat" : "Pemohon"), t: b.sebutan?.t || (b.lawan && b.jenis !== "ct" ? "Tergugat" : "Termohon") };
  const baris: BarisCeklist[] = [];
  const judul = (f.judulDokumen ?? []).map((x) => String(x));
  const cari = (kunci: string) => judul.find((x) => (POLA[kunci] ?? /$^/).test(x));
  const grup = (nama: string) => baris.push({ grup: nama });

  function tambah(kunci: string, nama: string, sifat: SifatCeklist, hitung: () => { st: StatusCeklist; sumber: string; oto?: boolean }, kecil?: string) {
    const h = hitung();
    const manual = Object.prototype.hasOwnProperty.call(b.tangan, kunci) ? b.tangan[kunci] : null;
    if (manual !== null) baris.push({ kunci, nama, sifat, st: manual ? "ok" : "no", oto: false, sumber: manual ? "dicentang petugas" : "dinyatakan belum ada oleh petugas", kecil });
    else baris.push({ kunci, nama, sifat, st: h.st, oto: h.st !== "" && h.oto !== false, sumber: h.sumber, kecil });
  }
  /** dokumen yang dikenali dari judul e-Court/arsip: ada bila ditemukan, selebihnya petugas */
  const dariJudul = (kunci: string, bila = "diperiksa petugas") => () => {
    const j = cari(kunci);
    return j ? { st: "ok" as const, sumber: `e-Court: ${j.length > 60 ? `${j.slice(0, 58)}..` : j}` } : { st: "" as const, sumber: `tidak terbaca otomatis - ${bila}` };
  };
  const fisik = (ket: string) => () => ({ st: "" as const, sumber: ket });

  grup("PENDAFTARAN");
  const suratGugat = b.lawan && b.jenis !== "ct" ? "Gugatan" : "Permohonan";
  tambah("gugatan", `Surat ${suratGugat}`, "WAJIB", () => {
    const j = cari("gugatan");
    if (j) return { st: "ok", sumber: `e-Court: ${j.length > 60 ? `${j.slice(0, 58)}..` : j}` };
    return { st: "", sumber: f.keadaan.ecourt ? "tidak terbaca di arsip e-Court - diperiksa petugas" : "berkas fisik - diperiksa petugas" };
  });
  tambah("skum", "Surat Kuasa Untuk Membayar (SKUM)", "WAJIB", () =>
    (f.kasir.baris ?? 0) > 0 || (f.kasir.jumlah ?? 0) > 0
      ? { st: "ok", sumber: `kasir: panjar ${rupiah(f.kasir.jumlah ?? 0)}${f.kasir.tanggal ? ` (${tanggalPendek(f.kasir.tanggal)})` : ""}` }
      : f.keadaan.prodeo
        ? { st: "", sumber: "prodeo: tanpa panjar - diperiksa petugas" }
        : { st: "no", sumber: "kasir: SKUM/panjar belum tercatat" }
  );
  if (f.keadaan.prodeo) {
    tambah("sktm", "Surat Keterangan Tidak Mampu (SKTM) / Kartu Indonesia Sehat", "WAJIB", () => {
      const j = cari("sktm");
      if (j) return { st: "ok", sumber: `e-Court: ${j.length > 60 ? `${j.slice(0, 58)}..` : j}` };
      return f.tertulisDokumen ? { st: "no", sumber: "prodeo: belum diunggah di e-Court" } : { st: "", sumber: "prodeo: diperiksa petugas" };
    });
  } else {
    tambah("setor", "Bukti Setor Panjar Biaya Perkara", "WAJIB", () =>
      (f.kasir.jumlah ?? 0) > 0 ? { st: "ok", sumber: `kasir: setoran ${rupiah(f.kasir.jumlah ?? 0)}${f.kasir.tanggal ? ` (${tanggalPendek(f.kasir.tanggal)})` : ""}` } : { st: "no", sumber: "kasir: belum ada setoran panjar" }
    );
  }
  if (f.keadaan.kuasa) {
    tambah("kuasa", "Surat Kuasa Khusus", "WAJIB", () => {
      const j = cari("kuasa");
      return j ? { st: "ok", sumber: `e-Court: ${j}` } : { st: "ok", sumber: "SIPP: kuasa hukum terdaftar pada perkara" };
    });
    tambah("advokat", "Kartu Advokat dan Berita Acara Sumpah", "WAJIB", dariJudul("advokat"));
  }

  grup("PENETAPAN AWAL");
  const pen = f.penetapan;
  for (const [kunci, nama, tgl, kode] of [
    ["pmh", "Penetapan Majelis Hakim (PMH)", pen.pmh, "PMH"],
    ["ppp", "Penunjukan Panitera Pengganti (PP)", pen.ppp, "PPP"],
    ["pjs", "Penunjukan Jurusita / Jurusita Pengganti (JS/JSP)", pen.pjs, "PJS"],
    ["phs", "Penetapan Hari Sidang (PHS)", pen.phs, "PHS"],
  ] as const) {
    tambah(kunci, nama, "WAJIB", () => (tgl ? { st: "ok", sumber: `SIPP: ${kode} ${tanggalPendek(tgl)}` } : { st: "no", sumber: "belum terbit di SIPP" }));
  }

  grup("IDENTITAS DAN BUKTI AWAL");
  tambah("ktp", `Fotokopi KTP ${sebutan.p}`, "WAJIB", dariJudul("ktp"));
  if (cerai || b.jenis === "in" || b.jenis === "batal") tambah("nikah", "Fotokopi Kutipan Akta Nikah / Buku Nikah", "WAJIB", dariJudul("nikah"));
  if (b.jenis !== "es") tambah("kk", "Fotokopi Kartu Keluarga", "WAJIB", dariJudul("kk"));
  if (cerai) tambah("nikah_asli", "Buku Nikah Asli", "WAJIB", fisik("diserahkan di Meja I (dicentang petugas)"), "dokumen fisik");
  if (cerai && (f.izinCerai ?? "") !== "") {
    tambah("izin", "Surat Izin / Keterangan Atasan (PNS/TNI/Polri)", "WAJIB", () =>
      f.izinCerai === "ada" ? { st: "ok", sumber: "SIPP/e-Court: izin atasan tercatat" } : f.izinCerai === "belum-ada" ? { st: "no", sumber: "pekerjaan pihak PNS/TNI/Polri: belum ada izin atasan" } : { st: "", sumber: "pihak PNS/TNI/Polri: izin atasan diperiksa petugas" }
    );
  }
  if (cerai && f.keadaan.ghaib) tambah("ghaib", "Surat Keterangan Ghaib dari Kepala Desa/Lurah", "WAJIB", dariJudul("ghaib"));
  if (cerai && f.keadaan.anak) tambah("lahir", "Fotokopi Akta Kelahiran Anak", "BILA ADA", dariJudul("lahir"));
  for (const [kunci, nama, sifat] of KHAS[b.jenis] ?? []) {
    if (kunci === "lahir" && cerai) continue;
    tambah(kunci, nama, sifat, dariJudul(kunci.replace(/_(calon|batal|anak)$/, "")));
  }

  grup("TAMBAHAN (DITULIS TANGAN)");
  for (let i = 0; i < 4; i += 1) baris.push({ tangan: true });

  const dok = baris.filter((x): x is Extract<BarisCeklist, { kunci: string }> => "kunci" in x);
  return {
    baris,
    ringkas: { ada: dok.filter((x) => x.st === "ok").length, belum: dok.filter((x) => x.st === "no").length, petugas: dok.filter((x) => x.st === "").length },
    penandaJenis: penandaJenisCeklist(b.jenis),
    sebutan,
  };
}

export function teksRingkasCeklist(r: HasilCeklist["ringkas"]): string {
  return `${r.ada} ada (otomatis)   -   ${r.belum} belum ada, minta ke pihak   -   ${r.petugas} diperiksa petugas`;
}

// ---------------------------------------------------------------------------
// RTF
// ---------------------------------------------------------------------------
function esc(t: string): string {
  let h = "";
  for (const ch of t) {
    const o = ch.codePointAt(0) ?? 0;
    if (ch === "\\" || ch === "{" || ch === "}") h += `\\${ch}`;
    else if (o > 127) h += `\\u${o > 32767 ? o - 65536 : o}?`;
    else h += ch;
  }
  return h;
}

export const PENANDA_TABEL_CEKLIST = "@@TABEL-CEKLIST@@";

/** Tabel ceklist sebagai RTF (baris tabel sungguhan); `lebar` = lebar isi dalam twip. Kotak ADA / TIDAK ADA dengan centang pada font simbol. */
export function tabelCeklistRtf(baris: BarisCeklist[], lebar: number, barisMin = 0): string {
  // 30 Okt (sampul-rapi): kolom dan huruf sama dengan tabel ABT isian_rtf_tabel_ceklist; baris tulis tangan ditambah sampai barisMin (penuh halaman)
  const w = [560, 4500, 1100, 700, 800, 2806];
  const total = w.reduce((a, x) => a + x, 0);
  const lk = w.map((x) => Math.trunc((x * lebar) / total));
  lk[5] = lebar - lk.slice(0, 5).reduce((a, x) => a + x, 0);
  const batas: number[] = [];
  lk.reduce((a, x) => {
    batas.push(a + x);
    return a + x;
  }, 0);
  const garis = (t = 10) => `\\clbrdrt\\brdrs\\brdrw${t}\\clbrdrl\\brdrs\\brdrw${t}\\clbrdrb\\brdrs\\brdrw${t}\\clbrdrr\\brdrs\\brdrw${t}`;
  const para = (teks: string, o: { b?: boolean; al?: "l" | "c"; sz?: number } = {}) => `\\pard\\plain\\intbl\\q${o.al ?? "l"}\\f0\\fs${o.sz ?? 18}\\sb20\\sa20 ${o.b ? "\\b " : ""}${teks}\\cell\n`;
  const kepala = (t: string, al: "l" | "c" = "l") => para(esc(t), { b: true, al, sz: 15 });
  const awal = (tinggi: number, kepalaBaris = false) => `\\trowd\\trgaph70\\trleft0\\trkeep${kepalaBaris ? "\\trhdr" : ""}\\trrh${tinggi}\n`;
  let s = `${awal(380, true)}${batas.map((x) => `\\clcbpat2${garis()}\\clvertalc\\cellx${x}`).join("")}\n${kepala("NO", "c")}${kepala("JENIS SURAT / DOKUMEN")}${kepala("SIFAT", "c")}${kepala("ADA", "c")}${kepala("TIDAK ADA", "c")}${kepala("SUMBER / KETERANGAN")}\\row\n`;
  let no = 0;
  const kolom = batas.map((x) => `${garis()}\\clvertalc\\cellx${x}`).join("");
  const kosong = () => `${awal(400)}${kolom}\n${para(String(no), { al: "c" })}${para("")}${para("")}${para("")}${para("")}${para("")}\\row\n`;
  for (const r of baris) {
    if ("grup" in r) {
      s += `${awal(340)}\\clcbpat3${garis()}\\clvertalc\\cellx${lebar}\n\\pard\\plain\\intbl\\ql\\f0\\fs16\\sb20\\sa20 \\b ${esc(r.grup)}\\cell\n\\row\n`;
      continue;
    }
    no += 1;
    if ("tangan" in r) {
      s += kosong();
      continue;
    }
    const centang = (adaTanda: boolean, tanda: string) => para(adaTanda ? `{\\f1\\b\\u${tanda}?}` : "", { al: "c", sz: 19 });
    const nama = `${esc(r.nama)}${r.kecil ? ` {\\fs14 ${esc(r.kecil)}}` : ""}`;
    const sumber = `${esc(r.sumber)}${r.oto ? " {\\super\\b OTO}" : ""}`;
    s += `${awal(400)}${kolom}\n${para(String(no), { al: "c" })}${para(nama)}${para(esc(r.sifat), { al: "c", sz: 15 })}${centang(r.st === "ok", "10003")}${centang(r.st === "no", "10007")}${para(sumber, { sz: 15 })}\\row\n`;
  }
  // baris tulis tangan tambahan sampai nomor barisMin (memenuhi halaman; judul bagian tidak dihitung, sama dengan fungsi ABT)
  while (no < barisMin) {
    no += 1;
    s += kosong();
  }
  return `${s}\\pard\\plain\\f0\\fs4 `;
}

/** Menggantikan paragraf penanda di RTF hasil isian ABT dengan tabel; tanpa penanda RTF dikembalikan apa adanya. */
export function tempelTabelCeklist(rtf: string, tabel: string): string {
  const i = rtf.indexOf(PENANDA_TABEL_CEKLIST);
  if (i < 0) return rtf;
  const awal = rtf.lastIndexOf("\\pard", i);
  const akhir = rtf.indexOf("\\par", i);
  if (awal < 0 || akhir < 0) return rtf;
  const sesudah = rtf[akhir + 4] === "\n" ? akhir + 5 : akhir + 4;
  return `${rtf.slice(0, awal)}${tabel}${rtf.slice(sesudah)}`;
}

/** Nama kota dari nama pengadilan ("Pengadilan Agama Donggala" -> "Donggala"). */
export function kotaDariPengadilan(nama: string): string {
  const m = String(nama || "").match(/pengadilan\s+(?:agama|negeri|tinggi agama|tata usaha negara)\s+(.+)$/i);
  const k = (m ? m[1] : String(nama || "")).trim();
  return k ? k.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bDan\b/g, "dan") : "";
}

// ---------------------------------------------------------------------------
// Saringan kiriman klien
// ---------------------------------------------------------------------------
const bersih = (x: unknown, maks: number) =>
  String(x ?? "")
    .replace(/[\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maks);
const tglIso = (x: unknown) => (/^\d{4}-\d{2}-\d{2}/.test(String(x ?? "")) ? String(x).slice(0, 10) : "");
const JENIS_SAH = ["cg", "ct", "dk", "in", "aua", "wali", "asuh", "adhol", "poligami", "waris", "paw", "hb", "es", "batal", "lain"];

export function bersihkanBahanCeklist(mentah: unknown): BahanCeklist | null {
  if (!mentah || typeof mentah !== "object") return null;
  const r = mentah as Record<string, unknown>;
  const jenis = JENIS_SAH.includes(String(r.jenis)) ? String(r.jenis) : "lain";
  const f = (r.fakta && typeof r.fakta === "object" ? r.fakta : {}) as Record<string, unknown>;
  const k = (f.keadaan && typeof f.keadaan === "object" ? f.keadaan : {}) as Record<string, unknown>;
  const p = (f.penetapan && typeof f.penetapan === "object" ? f.penetapan : {}) as Record<string, unknown>;
  const ks = (f.kasir && typeof f.kasir === "object" ? f.kasir : {}) as Record<string, unknown>;
  const tangan: Record<string, boolean> = {};
  if (r.tangan && typeof r.tangan === "object") for (const [kunci, v] of Object.entries(r.tangan as Record<string, unknown>)) if (/^[a-z_]{2,20}$/.test(kunci)) tangan[kunci] = Boolean(v);
  const judul = Array.isArray(f.judulDokumen) ? f.judulDokumen.slice(0, 300).map((x) => bersih(x, 160)).filter((x) => x && !/aleta/i.test(x)) : [];
  const sebut = (r.sebutan && typeof r.sebutan === "object" ? r.sebutan : {}) as Record<string, unknown>;
  const ppNama = bersih(f.ppNama, 120).replace(/^panitera\s+pengganti\s*:?\s*/i, "");
  return {
    jenis,
    lawan: r.lawan !== false,
    tangan,
    sebutan: { p: bersih(sebut.p, 20), t: bersih(sebut.t, 20) },
    fakta: {
      keadaan: { phs: Boolean(k.phs), kuasa: Boolean(k.kuasa), prodeo: Boolean(k.prodeo), ghaib: Boolean(k.ghaib), ecourt: Boolean(k.ecourt), anak: Boolean(k.anak), tanggalDaftar: tglIso(k.tanggalDaftar) },
      penetapan: { pmh: tglIso(p.pmh), ppp: tglIso(p.ppp), pjs: tglIso(p.pjs), phs: tglIso(p.phs) },
      ppNama: /aleta/i.test(ppNama) ? "" : ppNama,
      kasir: { jumlah: Math.max(0, Number(ks.jumlah) || 0), tanggal: tglIso(ks.tanggal), baris: Math.max(0, Math.trunc(Number(ks.baris)) || 0) },
      izinCerai: ["ada", "belum-ada", "belum-dicatat", "belum-terbaca"].includes(String(f.izinCerai)) ? String(f.izinCerai) : "",
      judulDokumen: judul,
      tertulisDokumen: Boolean(f.tertulisDokumen),
    },
  };
}
