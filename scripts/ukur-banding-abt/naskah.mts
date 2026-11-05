/**
 * PEMBANDING NASKAH UTUH TAHAP 5 - alinea demi alinea: naskah ALETA ABT (mesin jalur ALETA) lawan naskah ABT (renderer php56 ABT asli).
 * HANYA MEMBACA SIPP/ABT: sisi ALETA lewat pagarBaca (aleta_bot/services/abtMesinVariabel.js); sisi ABT lewat salinan ABT milik sendiri
 * (UJI_ABT_DIR -> sipp_vs + aps_badilag_vs), yang menulis urutan sidang ke SALINAN itu saja. Skrip menolak berjalan bila basis data
 * bukan salinan uji (nama berakhiran _vs). Keluaran memuat data perkara -> tulis ke luar repo (bawaan D:/aleta-dev/kerja/aleta-abt/t5).
 *
 * Jalankan dari manajemen_surat/ (alias @/ dari tsconfig):  npx tsx ../scripts/ukur-banding-abt/naskah.mts <perintah> ...
 *
 *   sampel [perJenis=6]      pilih perkara dari sampel Tahap 4 (jenis & keadaan beragam, bukan yang lambat), daftar blangko pohon, dan penanda
 *   abt [paralel=2]          render pecahan RTF mentah tiap penanda per perkara (python abt_render_mentah.py), memakan beberapa menit per perkara
 *   banding [perkara,...]    bandingkan tiap blangko x perkara sejenis: ABT dirakit dari pecahan, ALETA lewat mesin; hasil jsonl per perkara
 *   waktu [putaran=3]        waktu pratinjau 10 blangko di mesin SEPI (jalankan sendirian; angka laptop)
 *   verifikasi [per=3]       buktikan rakitan ABT == render naskah utuh ABT (bita per bita): tiap jenis x putusan/BAS x blangko terkecil, tengah, terbesar
 *   laporan                  ringkas per jenis -> LAPORAN-T5.txt (tanpa data pihak) dan laporan-t5.json (untuk layar Laporan pembanding)
 *
 * TAHAP 8 (semua jenis perkara; env KELUAR_T5=D:/aleta-dev/kerja/aleta-abt/t8):
 *   sampel-semua [perJenis=3]  pilih perkara per KELUARGA blangko (aleta-abt-pindah.ts) langsung dari sipp_vs dan menulis perkara.tsv
 *                              (kolom 3 = kunci keluarga), blangko.tsv (semua folder RTF di pohon), kode-naskah.txt (semua penanda)
 *   kode-pid                   tulis kode-pid/p<perkara>.txt: penanda yang dipakai blangko keluarga tiap perkara (render ABT jauh lebih ringan)
 *   abt                        (sama seperti Tahap 5; untuk Tahap 8 pakai abt_render_mentah.py per perkara dengan @kode-pid/p<perkara>.txt)
 *   banding [perkara,...]      (sama; env BATAS_KUERI_MS = batas waktu satu kueri mesin, bawaan 240 dtk di skrip ini)
 *   ulang-tak-cocok            buang dari hasil naskah yang bedanya belum dijelaskan atau punya isian kosong karena galat, supaya disusun ulang
 *   laporan-semua [isian.json] ringkas per keluarga -> LAPORAN-T8.txt (tanpa data pihak) dan laporan-t8.json (dimuat di layar kesiapan);
 *                              isian.json = keluaran `node ukur.mjs banding` (nilai tiap isian) bila ada
 * Urutan: sampel-semua, kode-pid, render ABT per perkara, banding (beberapa proses boleh jalan bersama), ukur.mjs mesin/dari-mentah/banding
 * (env KODE_DIR=<kode-pid>), laporan-semua. Mesin yang sibuk membuat kueri habis waktu dan mengubah hasil: periksa `kosongGalat`.
 *
 * UKURAN YANG TIDAK DIUKUR DI SINI: jumlah halaman dan letak tanda tangan (butuh PDF dari LibreOffice; tidak ada di laptop ini).
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { KELAS_DIJELASKAN, alineaDariRtf, bandingAlinea, golongkanUlang, kertasDariRtf, type BedaAlinea, type KelasBeda } from "@/lib/aleta-abt-naskah";
import { FOLDER_BUKAN_BLANGKO, KELUARGA_PINDAH, keluargaDariFolder, type UkurKeluarga } from "@/lib/aleta-abt-pindah";
import { uraiRtf } from "@/lib/aleta-abt-rtf";

const SINI = path.dirname(fileURLToPath(import.meta.url));
const AKAR = path.join(SINI, "..", "..");
const req = createRequire(path.join(AKAR, "aleta_bot", "package.json"));
const SIPP = process.env.SIPP_DB || "sipp_vs";
const ABT = process.env.ABT_DB || "aps_badilag_vs";
const POHON = process.env.POHON || "D:/aleta-dev/kerja/audit-abt-4nov/pohon/derry_briantono";
const KELUAR = process.env.KELUAR_T5 || "D:/aleta-dev/kerja/aleta-abt/t5";
const T4 = process.env.KELUAR_T4 || "D:/aleta-dev/kerja/aleta-abt/t4";
const ABT_DIR = process.env.UJI_ABT_DIR || "D:/Aplikasi/aleta/tmp/vs30/abt";
/** Berkas sementara tidak boleh ke drive C: (aturan proyek). */
const TMP_UJI = process.env.TMP || "D:/Aplikasi/aleta/tmp";
const LB = String.fromCharCode(10);
/** Batas waktu satu kueri mesin; blangko berat (daftar isi) butuh lebih dari 60 dtk bila mesin sedang sibuk. Bawaan 240 dtk. */
const BATAS_KUERI_MS = Number(process.env.BATAS_KUERI_MS) || 240000;

if (!/_vs$/.test(SIPP) || !/_vs$/.test(ABT)) {
  console.error(`Berhenti: SIPP_DB=${SIPP} dan ABT_DB=${ABT} bukan pasangan salinan uji (_vs). Skrip ini tidak boleh menyentuh basis data lain.`);
  process.exit(2);
}

const KELOMPOK = [
  { folder: "1 Perceraian CG", jenis: "Cerai Gugat", kelompok: "putusan" },
  { folder: "1 Perceraian CG - BAS", jenis: "Cerai Gugat", kelompok: "BAS" },
  { folder: "1a Perceraian CT", jenis: "Cerai Talak", kelompok: "putusan" },
  { folder: "1a Perceraian CT - BAS", jenis: "Cerai Talak", kelompok: "BAS" },
] as const;

const mesinMod = req(path.join(AKAR, "aleta_bot", "services", "abtMesinVariabel.js")) as {
  buatMesin: (p: Record<string, unknown>) => { isiRtf: (rtf: string, o: Record<string, unknown>) => Promise<{ rtf: string; kosong: Array<{ noVar: string }>; mesinGalat: string; terisi: string[]; lolosCetak?: boolean }> };
  penandaUrutAbt: (rtf: string) => string[];
  satukanPenandaTerpecah: (rtf: string) => { rtf: string; jumlah: number };
};

const baca = (f: string) => fs.readFileSync(f, "utf8");
const tulis = (f: string, s: string) => (fs.mkdirSync(path.dirname(f), { recursive: true }), fs.writeFileSync(f, s));
const baris = (f: string) => baca(f).split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#")).map((l) => l.split("\t"));
const berkasPerkara = () => path.join(KELUAR, "perkara.tsv");
const berkasBlangko = () => path.join(KELUAR, "blangko.tsv");
const berkasKode = () => path.join(KELUAR, "kode-naskah.txt");
const dirMentah = () => path.join(KELUAR, "abt-mentah");
const dirHasil = () => path.join(KELUAR, process.env.HASIL || "hasil");

type Blangko = { kelompok: string; jenis: string; folder: string; nama: string };
const daftarBlangko = (): Blangko[] => baris(berkasBlangko()).map(([kelompok, jenis, folder, nama]) => ({ kelompok, jenis, folder, nama }));
const bacaBlangko = (b: Blangko) => fs.readFileSync(path.join(POHON, b.folder, b.nama)).toString("latin1");

// ---------------------------------------------------------------------------------------------------------------
// ABT: naskah dirakit dari pecahan mentah dengan penyisipan yang sama seperti Abt_model::variabel_library
// ---------------------------------------------------------------------------------------------------------------

/** Normalisasi templat seperti penguji ABT (Uji_t::render meniru views/abt/preview.php): baris baru dibuang, dua kode huruf Word dibuang. */
export function templatAbt(rtf: string): string {
  return rtf.split("\n").join("").split("\\hich\\af1\\dbch\\af31505\\loch\\f0 ").join("").split("\\hich\\af1\\dbch\\af31505\\loch\\f1 ").join("");
}

export function rakitAbt(templatMentah: string, mentah: Record<string, string | null>): { rtf: string; tanpaNilai: string[] } {
  let s = templatAbt(templatMentah);
  const tanpaNilai: string[] = [];
  // get_variabel: semua kemunculan berurutan; str_replace berurutan atas larik (kemunculan ganda tidak mengubah hasil: yang pertama mengganti semua).
  const kode = [...s.matchAll(/#([0-9]*)#/g)].map((m) => m[1]);
  for (const k of kode) {
    if (k === "") continue;
    const nilai = mentah[k];
    if (nilai === null || nilai === undefined) {
      if (!tanpaNilai.includes(k)) tanpaNilai.push(k);
      continue;
    }
    s = s.split(`#${k}#`).join(nilai);
  }
  return { rtf: s, tanpaNilai };
}

// ---------------------------------------------------------------------------------------------------------------
// Basis data (hanya salinan uji)
// ---------------------------------------------------------------------------------------------------------------

function bukaKolam() {
  const mysql = req("mysql");
  const kolam = mysql.createPool({ host: "127.0.0.1", user: "root", database: SIPP, connectionLimit: 4, multipleStatements: false });
  const kueri = (sql: string, params?: unknown[], opsi?: { timeoutMs?: number }) => {
    const teks = String(sql).replace(/\baps_badilag\./g, `${ABT}.`);
    return new Promise<Array<Record<string, string>>>((ok, gagal) =>
      kolam.query({ sql: teks, values: params || [], timeout: opsi?.timeoutMs || 60000, typeCast: (f: { string: () => string; buffer: () => Buffer; type?: string; packet?: { charsetNr?: number } }) => (f.packet && f.packet.charsetNr === 63 && /STRING|BLOB/.test(String(f.type)) ? f.buffer().toString("latin1") : f.string()) }, (g: Error | null, r: Array<Record<string, string>>) => (g ? gagal(g) : ok(r)))
    );
  };
  return { kolam, kueri };
}

async function jalurDariKatalog(kueri: ReturnType<typeof bukaKolam>["kueri"]) {
  const rows = await kueri(`SELECT no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang FROM ${ABT}.abt_variabel`);
  const pustaka: Record<string, Record<string, string>> = {};
  const alias: Record<string, string> = {};
  const nama = new Map<string, string>();
  for (const b of rows) {
    const no = String(b.no_var).trim();
    pustaka[no] = { ...b, no_var: no, kode: `AA${no.padStart(5, "0")}` };
    alias[`AA${no.padStart(5, "0")}`] = no;
    nama.set(no, String(b.nama || ""));
  }
  return { pustaka, alias, nama };
}

// ---------------------------------------------------------------------------------------------------------------
// sampel
// ---------------------------------------------------------------------------------------------------------------

function sampel([perJenis = "6"]: string[]) {
  const semua = baris(path.join(T4, "perkara50.tsv"));
  const lambat = new Set<string>();
  for (const [pid] of semua) {
    try {
      const d = JSON.parse(baca(path.join(T4, "a50", `p${pid}.json`))) as { info?: string };
      const m = /detik=([\d.]+)/.exec(d.info || "");
      if (!m || Number(m[1]) > 200) lambat.add(pid);
    } catch {
      lambat.add(pid);
    }
  }
  const dipilih: string[][] = [];
  for (const jenis of ["Cerai Gugat", "Cerai Talak"]) {
    const kandidat = semua.filter((b) => b[2] === jenis && !lambat.has(b[0]));
    const tagPertama = new Set<string>();
    const ambil: string[][] = [];
    // utamakan keadaan (tag) yang belum terwakili, lalu isi sisanya
    for (const b of kandidat) {
      const t = b[1].split(",")[0];
      if (!tagPertama.has(t) && ambil.length < Number(perJenis)) {
        tagPertama.add(t);
        ambil.push(b);
      }
    }
    for (const b of kandidat) if (ambil.length < Number(perJenis) && !ambil.includes(b)) ambil.push(b);
    dipilih.push(...ambil);
  }
  tulis(berkasPerkara(), dipilih.map((b) => b.slice(0, 3).join("\t")).join("\n") + "\n");

  const hasil: Blangko[] = [];
  const kodeAbt = new Set<string>();
  for (const k of KELOMPOK) {
    const dir = path.join(POHON, k.folder);
    if (!fs.existsSync(dir)) continue;
    for (const nama of fs.readdirSync(dir).filter((n) => /\.rtf$/i.test(n)).sort()) {
      hasil.push({ kelompok: k.kelompok, jenis: k.jenis, folder: k.folder, nama });
      const rtf = fs.readFileSync(path.join(dir, nama)).toString("latin1");
      for (const x of mesinMod.penandaUrutAbt(rtf)) if (x !== "") kodeAbt.add(x);
      for (const x of mesinMod.penandaUrutAbt(mesinMod.satukanPenandaTerpecah(rtf).rtf)) if (x !== "") kodeAbt.add(x);
    }
  }
  tulis(berkasBlangko(), hasil.map((b) => [b.kelompok, b.jenis, b.folder, b.nama].join("\t")).join("\n") + "\n");
  tulis(berkasKode(), [...kodeAbt].sort().join(",") + "\n");
  const hitung = (kel: string, jenis: string) => hasil.filter((b) => b.kelompok === kel && b.jenis === jenis).length;
  console.log(
    `perkara ${dipilih.length} (${dipilih.filter((b) => b[2] === "Cerai Gugat").length} CG, ${dipilih.filter((b) => b[2] === "Cerai Talak").length} CT); blangko putusan CG ${hitung("putusan", "Cerai Gugat")} CT ${hitung("putusan", "Cerai Talak")}, BAS CG ${hitung("BAS", "Cerai Gugat")} CT ${hitung("BAS", "Cerai Talak")}; penanda ${kodeAbt.size}`
  );
}

// ---------------------------------------------------------------------------------------------------------------
// abt
// ---------------------------------------------------------------------------------------------------------------

async function abt([paralel = "2"]: string[]) {
  fs.mkdirSync(dirMentah(), { recursive: true });
  // satu perkara dapat mewakili beberapa keluarga (barisnya berulang di perkara.tsv): render sekali saja
  const antre = [...new Set(baris(berkasPerkara()).map((b) => b[0]))].filter((pid) => !fs.existsSync(path.join(dirMentah(), `p${pid}.json`)));
  const env = { ...process.env, TMP: TMP_UJI, TEMP: TMP_UJI, UJI_ABT_DIR: ABT_DIR };
  async function pekerja() {
    while (antre.length) {
      const pid = antre.shift()!;
      await new Promise<void>((ok) => {
        const c = spawn("python", [path.join(SINI, "abt_render_mentah.py"), `@${berkasKode()}`, pid, path.join(dirMentah(), `p${pid}.json`)], { env, stdio: "inherit" });
        c.on("exit", () => ok());
      });
    }
  }
  await Promise.all(Array.from({ length: Number(paralel) }, pekerja));
  console.log("abt selesai", fs.readdirSync(dirMentah()).length, "perkara");
}

// ---------------------------------------------------------------------------------------------------------------
// banding
// ---------------------------------------------------------------------------------------------------------------

type BedaHasil = BedaAlinea & { isianNo: string[]; isianNama: string[] };
type HasilNaskah = {
  perkara: string;
  tag: string;
  jenis: string;
  kelompok: string;
  blangko: string;
  alineaAbt: number;
  alineaAleta: number;
  total: number;
  identik: number;
  perKelas: Record<KelasBeda, number>;
  beda: BedaHasil[];
  kertasAbt: string;
  kertasAleta: string;
  tanpaNilaiAbt: string[];
  kosongAleta: number;
  /** Isian kosong karena galat (mis. waktu kueri habis), bukan karena datanya memang kosong: naskah dengan angka ini > 0 tidak boleh dipercaya bedanya. */
  kosongGalat?: number;
  mesinGalat: string;
  waktu: { isiMs: number; uraiMs: number; dingin: boolean };
};

const lolosRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Alinea templat bermuatan penanda -> pola; dipakai menyebut isian yang ada pada alinea yang beda (nama, bukan nilai). */
function polaTemplat(rtfTempat: string) {
  const satu = mesinMod.satukanPenandaTerpecah(templatAbt(rtfTempat)).rtf;
  const hasil: Array<{ re: RegExp; no: string[] }> = [];
  for (const a of alineaDariRtf(satu)) {
    const no = [...a.matchAll(/#(\d{3,5})#/g)].map((m) => m[1]);
    if (!no.length) continue;
    const potong = a.split(/#\d{3,5}#/);
    try {
      hasil.push({ re: new RegExp(`^${potong.map(lolosRegex).join(".*?")}$`, "s"), no: [...new Set(no)] });
    } catch {
      /* pola terlalu rumit: dilewati */
    }
  }
  return hasil;
}

async function banding([daftar]: string[]) {
  const perkara = baris(berkasPerkara()).filter((b) => !daftar || daftar.split(",").includes(b[0]));
  const blangko = daftarBlangko();
  fs.mkdirSync(dirHasil(), { recursive: true });
  const { kolam, kueri } = bukaKolam();
  const jalur = await jalurDariKatalog(kueri);
  const polaCache = new Map<string, ReturnType<typeof polaTemplat>>();
  for (const [pid, tag, jenis] of perkara) {
    const fm = path.join(dirMentah(), `p${pid}.json`);
    if (!fs.existsSync(fm)) {
      console.log("lewati", pid, "(belum ada pecahan ABT)");
      continue;
    }
    const mentah = (JSON.parse(baca(fm)) as { mentah: Record<string, string | null> }).mentah;
    const fh = path.join(dirHasil(), `p${pid}.jsonl`);
    const sudah = new Set(fs.existsSync(fh) ? baca(fh).split("\n").filter(Boolean).map((l) => (JSON.parse(l) as HasilNaskah).blangko) : []);
    // satu mesin per perkara: katalog dibaca sekali (naskah pertama = "dingin"), seperti bot yang menyimpan mesin 5 menit
    const mesin = mesinMod.buatMesin({ kueri, skemaAbt: ABT, umurKatalogMs: 3600 * 1000, batasKueriMs: BATAS_KUERI_MS, jalurAleta: { pustaka: jalur.pustaka, alias: jalur.alias } });
    let dingin = true;
    let n = 0;
    for (const b of blangko.filter((x) => x.jenis === jenis && (!process.env.KELOMPOK_UJI || x.kelompok === process.env.KELOMPOK_UJI))) {
      const kunci = `${b.folder}/${b.nama}`;
      if (sudah.has(kunci)) {
        dingin = false;
        continue;
      }
      const templat = bacaBlangko(b);
      const a = rakitAbt(templat, mentah);
      const t0 = Date.now();
      const h = await mesin.isiRtf(templat, { perkaraId: pid });
      const isiMs = Date.now() - t0;
      const t1 = Date.now();
      const doc = uraiRtf(h.rtf);
      const uraiMs = Date.now() - t1 + (doc.paragraf.length ? 0 : 0);
      const alAbt = alineaDariRtf(a.rtf);
      const alAleta = alineaDariRtf(h.rtf);
      const cmp = bandingAlinea(alAbt, alAleta);
      if (!polaCache.has(kunci) && cmp.beda.length) polaCache.set(kunci, polaTemplat(templat));
      const pola = polaCache.get(kunci) ?? [];
      const beda: BedaHasil[] = cmp.beda.map((d) => {
        const uji = d.abt || d.aleta;
        const cocok = pola.find((p) => p.re.test(uji));
        const no = cocok ? cocok.no : [];
        return { ...d, isianNo: no, isianNama: no.map((x) => jalur.nama.get(x) || `Isian ${x}`).slice(0, 12) };
      });
      const baru: HasilNaskah = {
        perkara: pid,
        tag,
        jenis,
        kelompok: b.kelompok,
        blangko: kunci,
        alineaAbt: alAbt.length,
        alineaAleta: alAleta.length,
        total: cmp.total,
        identik: cmp.identik,
        perKelas: cmp.perKelas,
        beda,
        kertasAbt: kertasDariRtf(a.rtf).nama,
        kertasAleta: kertasDariRtf(h.rtf).nama,
        tanpaNilaiAbt: a.tanpaNilai,
        kosongAleta: h.kosong.length,
        kosongGalat: (h.kosong as Array<{ status?: string }>).filter((x) => x.status === "galat").length,
        mesinGalat: h.mesinGalat,
        waktu: { isiMs, uraiMs, dingin },
      };
      fs.appendFileSync(fh, JSON.stringify(baru) + "\n");
      dingin = false;
      n += 1;
      if (n % 20 === 0) console.log(pid, n, "naskah");
    }
    console.log("selesai perkara", pid, jenis, n, "naskah baru");
  }
  kolam.end();
}

// ---------------------------------------------------------------------------------------------------------------
// waktu: pratinjau 10 blangko di mesin yang sepi (jalankan SENDIRIAN; angka laptop, bukan angka server)
// ---------------------------------------------------------------------------------------------------------------

/**
 * Waktu yang diukur = bagian pratinjau yang berjalan di laptop: mesin mengisi blangko (isiRtf, satu mesin hidup seperti di bot) dan portal
 * menguraikan hasilnya menjadi paragraf layar (uraiRtf + pemetaan). TIDAK termasuk jaringan portal-bot, pemuatan pustaka dari basis data
 * portal, dan JSON ke peramban: itu hanya dapat diukur di server. Dingin = naskah pertama sesudah mesin dibuat (katalog dibaca), hangat =
 * naskah berikutnya pada mesin yang sama.
 */
async function waktu([ulang = "3"]: string[]) {
  const semua = daftarBlangko();
  const perkara = baris(berkasPerkara()).find((b) => b[2] === "Cerai Gugat");
  if (!perkara) throw new Error("belum ada perkara: jalankan sampel");
  const pid = perkara[0];
  const kandidat = semua.filter((b) => b.jenis === "Cerai Gugat");
  const urut = (k: string) =>
    kandidat
      .filter((b) => b.kelompok === k)
      .map((b) => ({ b, ukuran: fs.statSync(path.join(POHON, b.folder, b.nama)).size }))
      .sort((x, y) => x.ukuran - y.ukuran);
  const ambil = (k: string, n: number) => {
    const u = urut(k);
    return Array.from({ length: n }, (_, i) => u[Math.min(u.length - 1, Math.round((i * (u.length - 1)) / (n - 1)))]);
  };
  const pilih = [...ambil("putusan", 5), ...ambil("BAS", 5)];
  const { kolam, kueri } = bukaKolam();
  const jalur = await jalurDariKatalog(kueri);
  const hasil: string[] = [`Pratinjau 10 blangko Cerai Gugat (5 putusan, 5 berita acara; terkecil sampai terbesar), ${ulang} putaran. Mesin ${os.cpus().length} inti, ${Math.round(os.totalmem() / 1e9)} GB, Windows. Hanya mesin + penguraian; bukan angka server.`];
  const semuaMs: number[] = [];
  const dinginMs: number[] = [];
  for (let putar = 0; putar < Number(ulang); putar += 1) {
    const mesin = mesinMod.buatMesin({ kueri, skemaAbt: ABT, umurKatalogMs: 3600 * 1000, batasKueriMs: BATAS_KUERI_MS, jalurAleta: { pustaka: jalur.pustaka, alias: jalur.alias } });
    let pertama = true;
    for (const { b, ukuran } of pilih) {
      const templat = bacaBlangko(b);
      const t0 = performance.now();
      const h = await mesin.isiRtf(templat, { perkaraId: pid });
      const t1 = performance.now();
      const doc = uraiRtf(h.rtf);
      const paragraf = doc.paragraf.map((p) => ({ i: p.indeks, teks: p.teks.replace(/\s+/g, " ").trim(), rata: p.rata, li: p.li, fi: p.fi }));
      const t2 = performance.now();
      const ms = t2 - t0;
      semuaMs.push(ms);
      if (pertama) dinginMs.push(ms);
      hasil.push(
        `putaran ${putar + 1} ${pertama ? "dingin" : "hangat"} ${b.kelompok} ${Math.round(ukuran / 1024)} KB: mesin ${(t1 - t0).toFixed(0)} ms + uraian ${(t2 - t1).toFixed(0)} ms = ${ms.toFixed(0)} ms (${paragraf.length} alinea, ${h.kosong.length} isian kosong)`
      );
      pertama = false;
    }
  }
  const hangat = semuaMs.filter((_, i) => i % pilih.length !== 0);
  const tengah = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? 0;
  hasil.push(`Tengah hangat ${tengah(hangat).toFixed(0)} ms, terlama hangat ${Math.max(0, ...hangat).toFixed(0)} ms, tengah dingin ${tengah(dinginMs).toFixed(0)} ms; ${hangat.filter((x) => x < 1000).length} dari ${hangat.length} naskah hangat di bawah 1 detik.`);
  tulis(path.join(KELUAR, "waktu.txt"), hasil.join(LB) + LB);
  const rata = semuaMs.reduce((x, y) => x + y, 0) / semuaMs.length;
  tulis(path.join(KELUAR, "waktu.json"), JSON.stringify({ jumlah: semuaMs.length, rata, tengah: tengah(semuaMs), terlama: Math.max(0, ...semuaMs), tempat: `laptop pengembangan (${os.cpus().length} inti), mesin sepi, mesin + penguraian saja` }));
  console.log(hasil.join(LB));
  kolam.end();
}

// ---------------------------------------------------------------------------------------------------------------
// verifikasi: rakitan ABT harus sama persis dengan render naskah utuh ABT
// ---------------------------------------------------------------------------------------------------------------

function verifikasi([per = "3"]: string[]) {
  // Tiap jenis perkara (satu perkara per jenis) x putusan/BAS x blangko terkecil, tengah, dan terbesar.
  const semuaPerkara = baris(berkasPerkara());
  const laporan: string[] = [];
  let sama = 0;
  let total = 0;
  for (const jenis of ["Cerai Gugat", "Cerai Talak"]) {
    const pk = semuaPerkara.find((b) => b[2] === jenis);
    if (!pk) continue;
    const pid = pk[0];
    const mentah = (JSON.parse(baca(path.join(dirMentah(), `p${pid}.json`))) as { mentah: Record<string, string | null> }).mentah;
    for (const kel of ["putusan", "BAS"]) {
      const urut = daftarBlangko()
        .filter((b) => b.jenis === jenis && b.kelompok === kel)
        .map((b) => ({ b, ukuran: fs.statSync(path.join(POHON, b.folder, b.nama)).size }))
        .sort((x, y) => x.ukuran - y.ukuran);
      const pilih = [urut[0], urut[Math.floor(urut.length / 2)], urut[urut.length - 1]].slice(0, Number(per)).filter(Boolean);
      for (const { b, ukuran } of pilih) {
        const sumber = path.join(POHON, b.folder, b.nama);
        const keluar = path.join(KELUAR, `verifikasi-${pid}.rtf`);
        const t0 = Date.now();
        const r = spawnSync("python", [path.join(SINI, "abt_render_mentah.py"), "--utuh", sumber, pid, keluar], {
          env: { ...process.env, TMP: TMP_UJI, TEMP: TMP_UJI, UJI_ABT_DIR: ABT_DIR },
          encoding: "utf8",
          timeout: 3_000_000,
        });
        const detik = Math.round((Date.now() - t0) / 1000);
        total += 1;
        if (r.status !== 0 || !fs.existsSync(keluar)) {
          laporan.push(`${jenis} ${kel} (${Math.round(ukuran / 1024)} KB): render utuh GAGAL (${(r.stdout + r.stderr).slice(-160)})`);
          continue;
        }
        const nyata = fs.readFileSync(keluar).toString("latin1");
        const rakitan = rakitAbt(bacaBlangko(b), mentah);
        const persis = nyata === rakitan.rtf;
        if (persis) sama += 1;
        let beda = "";
        if (!persis) {
          let i = 0;
          while (i < nyata.length && i < rakitan.rtf.length && nyata[i] === rakitan.rtf[i]) i += 1;
          beda = ` pertamaBeda=${i} panjang ${nyata.length} vs ${rakitan.rtf.length}`;
        }
        laporan.push(`${jenis} ${kel} (blangko ${Math.round(ukuran / 1024)} KB): render utuh ABT ${detik} dtk, ${nyata.length} bita; rakitan ${rakitan.rtf.length} bita; ${persis ? "SAMA PERSIS PER BITA" : "BEDA" + beda}; penanda tanpa nilai ${rakitan.tanpaNilai.length}`);
        fs.unlinkSync(keluar);
      }
    }
  }
  laporan.push(`Ringkas: ${sama} dari ${total} sama persis per bita.`);
  tulis(path.join(KELUAR, "verifikasi.txt"), laporan.join(LB) + LB);
  console.log(laporan.join(LB));
}

// ---------------------------------------------------------------------------------------------------------------
// laporan
// ---------------------------------------------------------------------------------------------------------------

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

/** Waktu dari perintah waktu (mesin sepi) bila ada; selain itu waktu naskah yang diukur sambil beberapa proses berjalan. */
function waktuSepi() {
  try {
    return JSON.parse(baca(path.join(KELUAR, "waktu.json"))) as { jumlah: number; rata: number; tengah: number; terlama: number; tempat: string };
  } catch {
    return null;
  }
}

function laporan() {
  const semua: HasilNaskah[] = [];
  for (const f of fs.existsSync(dirHasil()) ? fs.readdirSync(dirHasil()) : []) {
    for (const l of baca(path.join(dirHasil(), f)).split("\n").filter(Boolean)) semua.push(JSON.parse(l) as HasilNaskah);
  }
  const perKel = Object.fromEntries(Object.keys(KELAS_DIJELASKAN).map((k) => [k, 0])) as Record<KelasBeda, number>;
  // Penggolongan dihitung ulang dari teks tersimpan dengan aturan terkini (hasil lama mungkin memakai penggolongan yang lebih kasar).
  for (const h of semua) h.perKelas = golongkanUlang(h.beda);
  const jenisKelompok = new Map<string, HasilNaskah[]>();
  for (const h of semua) {
    const k = `${h.jenis} - ${h.kelompok === "BAS" ? "berita acara sidang" : "putusan"}`;
    if (!jenisKelompok.has(k)) jenisKelompok.set(k, []);
    jenisKelompok.get(k)!.push(h);
    for (const [kl, v] of Object.entries(h.perKelas)) perKel[kl as KelasBeda] += v;
  }
  const ringkas = [...jenisKelompok.entries()].sort().map(([jenis, hs]) => {
    const alinea = hs.reduce((a, h) => a + h.total, 0);
    const identik = hs.reduce((a, h) => a + h.identik, 0);
    const bedaSemua = hs.flatMap((h) => h.beda);
    const dijelaskan = bedaSemua.filter((d) => KELAS_DIJELASKAN[d.kelas]).length;
    const belumDijelaskan = bedaSemua.length - dijelaskan;
    return { jenis, naskah: hs.length, alinea, identik, persen: alinea ? (identik / alinea) * 100 : 100, naskahIdentik: hs.filter((h) => h.identik === h.total).length, dijelaskan, belumDijelaskan };
  });
  const waktu = semua.map((h) => h.waktu.isiMs + h.waktu.uraiMs);
  const dingin = semua.filter((h) => h.waktu.dingin).map((h) => h.waktu.isiMs + h.waktu.uraiMs);
  const hangat = semua.filter((h) => !h.waktu.dingin).map((h) => h.waktu.isiMs + h.waktu.uraiMs);
  const blangkoUnik = new Set(semua.map((h) => h.blangko));
  const perkaraUnik = new Set(semua.map((h) => h.perkara));
  const tanpaNilai = semua.filter((h) => h.tanpaNilaiAbt.length).length;

  // beda dikelompokkan menurut blangko + kelas + isian (tanpa nilai) supaya laporan terbaca dan tanpa data pihak
  const kelompokBeda = new Map<string, { jenis: string; blangko: string; kelas: KelasBeda; isian: string[]; jumlah: number; perkara: Set<string>; contoh: BedaHasil & { perkara: string } }>();
  for (const h of semua) {
    for (const d of h.beda) {
      const kunci = `${h.blangko}|${d.kelas}|${d.isianNo.join(",")}|${d.nomorAbt}`;
      const e = kelompokBeda.get(kunci);
      if (e) {
        e.jumlah += 1;
        e.perkara.add(h.perkara);
      } else kelompokBeda.set(kunci, { jenis: h.jenis, blangko: h.blangko, kelas: d.kelas, isian: d.isianNama, jumlah: 1, perkara: new Set([h.perkara]), contoh: { ...d, perkara: h.perkara } });
    }
  }
  const bedaLaporan = [...kelompokBeda.values()]
    .sort((a, b) => b.jumlah - a.jumlah)
    .slice(0, 500)
    .map((e, i) => ({ jenis: e.jenis, blangko: e.blangko.split("/").pop()!.replace(/\.rtf$/i, ""), perkara: `sampel ${[...e.perkara].length} perkara`, kelas: e.kelas, nomorAbt: e.contoh.nomorAbt, nomorAleta: e.contoh.nomorAleta, isian: e.isian, _urut: i }));
  const belumTerukur = [
    "Jumlah halaman dan letak tanda tangan: butuh PDF dari server.",
    "Nomor halaman dan garis Z: hanya terlihat di PDF.",
    "Waktu PDF dan waktu di server.",
    "Berita acara dibandingkan pada sidang bawaan, belum tiap sidang.",
  ];
  const laporanJson = {
    dibuat: new Date().toISOString(),
    keterangan: `Naskah ALETA ABT dibandingkan dengan hasil ABT pada salinan uji. ${semua.length} naskah dari ${blangkoUnik.size} blangko dan ${perkaraUnik.size} perkara sampel.`,
    ringkas,
    perKelas: perKel,
    beda: bedaLaporan.map(({ _urut, ...x }) => x),
    belumTerukur,
    waktu: waktuSepi() ?? { jumlah: semua.length, rata: semua.length ? waktu.reduce((a, b) => a + b, 0) / semua.length : 0, tengah: median(waktu), terlama: Math.max(0, ...waktu), tempat: `laptop pengembangan (${os.cpus().length} inti), sambil 4 proses lain berjalan` },
  };
  tulis(path.join(KELUAR, process.env.HASIL ? `laporan-t5-${process.env.HASIL}.json` : "laporan-t5.json"), JSON.stringify(laporanJson, null, 1));
  const teks: string[] = [];
  teks.push("PEMBANDING NASKAH UTUH TAHAP 5 - ALETA ABT lawan ABT (memuat nama blangko; TANPA data pihak)");
  teks.push(`Dibuat ${laporanJson.dibuat}. Salinan uji ${SIPP} + ${ABT}.`);
  teks.push(`Naskah dibandingkan: ${semua.length} dari ${blangkoUnik.size} blangko x ${perkaraUnik.size} perkara. Naskah dengan penanda tanpa nilai ABT: ${tanpaNilai}.`);
  teks.push("");
  for (const r of ringkas) teks.push(`${r.jenis}: ${r.naskah} naskah, ${r.alinea} alinea: ${r.identik} identik (${r.persen.toFixed(3)}%), ${r.dijelaskan} beda dijelaskan, ${r.belumDijelaskan} beda belum dijelaskan; identik + dijelaskan ${((100 * (r.identik + r.dijelaskan)) / r.alinea).toFixed(3)}%; ${r.naskahIdentik} naskah identik seluruhnya`);
  teks.push("");
  teks.push(`Beda per kelas (alinea): ${(Object.entries(perKel) as Array<[string, number]>).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  teks.push(`Waktu menyusun ALETA (mesin + penguraian) di laptop, ms: rata ${laporanJson.waktu.rata.toFixed(0)}, tengah ${laporanJson.waktu.tengah}, terlama ${laporanJson.waktu.terlama}; naskah pertama per perkara (dingin) tengah ${median(dingin)}, berikutnya (hangat) tengah ${median(hangat)}`);
  teks.push("");
  teks.push("Beda terbanyak (blangko | kelas | isian | banyak | perkara terdampak):");
  for (const e of [...kelompokBeda.values()].sort((a, b) => b.jumlah - a.jumlah).slice(0, 40)) teks.push(`  ${e.blangko.split("/").pop()} | ${e.kelas} | ${e.isian.join(", ") || "tak terlacak"} | ${e.jumlah} | ${e.perkara.size}`);
  teks.push("");
  teks.push("Belum terukur:");
  for (const t of belumTerukur) teks.push("  - " + t);
  tulis(path.join(KELUAR, process.env.HASIL ? `LAPORAN-T5-${process.env.HASIL}.txt` : "LAPORAN-T5.txt"), teks.join("\n") + "\n");
  console.log(teks.slice(0, 14).join("\n"));
}

// ---------------------------------------------------------------------------------------------------------------
// Tahap 8: semua keluarga blangko
// ---------------------------------------------------------------------------------------------------------------

/**
 * Pilih perkara per keluarga langsung dari salinan SIPP. Keadaan beragam: berputar menurut proses_terakhir_id yang berbeda, bukan
 * sekadar yang pertama. Cerai gugat dan cerai talak memakai sampel Tahap 5 (keadaan sudah beragam dan bukan yang lambat).
 */
async function sampelSemua([perJenis = "3"]: string[]) {
  const { kolam, kueri } = bukaKolam();
  const n = Number(perJenis);
  const t5 = path.join(T4, "..", "t5", "perkara.tsv");
  const keadaanT5 = fs.existsSync(t5) ? baris(t5) : [];
  // perkara salinan lambat dibaca (kolom teks panjang): satu kali saja untuk semua keluarga, urut menurut nomor
  const semuaPerkara = (await kueri("SELECT perkara_id, jenis_perkara_nama, proses_terakhir_id FROM perkara")).sort((x, y) => Number(x.perkara_id) - Number(y.perkara_id));
  const dipilih: Array<{ pid: string; tag: string; keluarga: string }> = [];
  const belumAda: string[] = [];
  const dariKeluarga = new Map<string, string[][]>();
  for (const k of KELUARGA_PINDAH) {
    if (k.umum) continue;
    let cocok: string[][] = [];
    const jenisCerai = k.jenisSipp.length === 1 && /^Cerai (Gugat|Talak)$/.test(k.jenisSipp[0]) ? k.jenisSipp[0] : "";
    if (jenisCerai && keadaanT5.length) {
      const tagPertama = new Set<string>();
      for (const b of keadaanT5.filter((x) => x[2] === jenisCerai)) {
        const t = b[1].split(",")[0];
        if (!tagPertama.has(t) && cocok.length < 5) {
          tagPertama.add(t);
          cocok.push([b[0], b[1]]);
        }
      }
    } else {
      const pola = k.jenisSipp.map((x) => new RegExp(`^${x.split("%").map(lolosRegex).join(".*")}$`, "i"));
      const rows = semuaPerkara.filter((b) => pola.some((re) => re.test(String(b.jenis_perkara_nama ?? ""))));
      const per = new Map<string, string[]>();
      for (const b of rows) {
        const g = String(b.proses_terakhir_id ?? "");
        if (!per.has(g)) per.set(g, []);
        per.get(g)!.push(String(b.perkara_id));
      }
      const kel = [...per.entries()].sort((a, b) => b[1].length - a[1].length);
      for (let putar = 0; cocok.length < n && putar < 50; putar += 1) {
        for (const [g, ids] of kel) {
          if (cocok.length >= n) break;
          const id = ids[Math.min(ids.length - 1, Math.floor(ids.length / 2) + putar)];
          if (id && !cocok.some((h) => h[0] === id)) cocok.push([id, `proses${g}`]);
        }
      }
    }
    dariKeluarga.set(k.kunci, cocok);
    if (!cocok.length) belumAda.push(k.kunci);
    for (const [pid, tag] of cocok) dipilih.push({ pid, tag, keluarga: k.kunci });
  }
  // keluarga lintas jenis: 2 cerai gugat, 2 cerai talak, 1 itsbat
  const umum = KELUARGA_PINDAH.find((k) => k.umum);
  if (umum) {
    const sumber = [...(dariKeluarga.get("cerai-gugat") ?? []).slice(0, 2), ...(dariKeluarga.get("cerai-talak") ?? []).slice(0, 2), ...(dariKeluarga.get("itsbat-nikah") ?? []).slice(0, 1)];
    for (const [pid, tag] of sumber) dipilih.push({ pid, tag, keluarga: umum.kunci });
  }
  tulis(berkasPerkara(), dipilih.map((b) => [b.pid, b.tag, b.keluarga].join("\t")).join("\n") + "\n");

  const hasil: Blangko[] = [];
  const kodeAbt = new Set<string>();
  const tanpaKeluarga: string[] = [];
  for (const folder of fs.readdirSync(POHON).sort()) {
    const dir = path.join(POHON, folder);
    if (!fs.statSync(dir).isDirectory()) continue;
    const kel = keluargaDariFolder(folder);
    const rtfs = fs.readdirSync(dir).filter((x) => /\.rtf$/i.test(x)).sort();
    if (!kel) {
      if (rtfs.length && !FOLDER_BUKAN_BLANGKO.includes(folder)) tanpaKeluarga.push(folder);
      continue;
    }
    for (const nama of rtfs) {
      hasil.push({ kelompok: / - BAS$|^BAS /.test(folder) ? "BAS" : "putusan", jenis: kel, folder, nama });
      const rtf = fs.readFileSync(path.join(dir, nama)).toString("latin1");
      for (const x of mesinMod.penandaUrutAbt(rtf)) if (x !== "") kodeAbt.add(x);
      for (const x of mesinMod.penandaUrutAbt(mesinMod.satukanPenandaTerpecah(rtf).rtf)) if (x !== "") kodeAbt.add(x);
    }
  }
  tulis(berkasBlangko(), hasil.map((b) => [b.kelompok, b.jenis, b.folder, b.nama].join("\t")).join("\n") + "\n");
  tulis(berkasKode(), [...kodeAbt].sort().join(",") + "\n");
  const perkaraUnik = new Set(dipilih.map((b) => b.pid)).size;
  console.log(`perkara ${dipilih.length} baris (${perkaraUnik} unik); blangko ${hasil.length}; penanda ${kodeAbt.size}; keluarga tanpa perkara di salinan: ${belumAda.join(", ") || "-"}; folder RTF tanpa keluarga: ${tanpaKeluarga.join(", ") || "-"}`);
  kolam.end();
}

type IsianKeluarga = { perkara: number; nilai: number; cocok: number; spasi: number; beda: number; tandaKosong?: number; cacatAbt?: number; waktuHabis?: number };

/**
 * Cacat ABT pada tingkat alinea: nilai ABT yang memuat kata kendali RTF tercetak sebagai teks (mis. "rowd rqc rgaph85"; kasus tanda tangan
 * majelis verzet: ABT mengubah "~" menjadi tab dan karakter kendali) membuat ABT mencetak sampah, sedangkan ALETA mencetak tabel yang benar.
 * Alinea ALETA yang menjadi pasangannya (satu sel satu alinea di ALETA, satu baris tabel satu alinea di ABT) ikut terbawa: satu BLOK beda
 * berurutan dihitung cacat ABT bila ada satu alinea ABT di dalamnya yang bocor. Hanya blok seperti itu; beda lain tetap belum dijelaskan.
 */
/** Urutan bita UTF-8 yang terbaca sebagai huruf latin1 diubah kembali menjadi hurufnya (sama dengan ukur.mjs); huruf latin1 tunggal dibiarkan. */
function perbaikiMojibake(t: string): string {
  return t.replace(/[\u00c2-\u00f4][\u0080-\u00bf]{1,3}/g, (m) => {
    const u = Buffer.from(m, "latin1").toString("utf8");
    return u.includes("\ufffd") ? m : u;
  });
}
const BOCOR_KENDALI = /(^|\s)(rowd|trqc|trgaph\d+|trleft\d+|cellx\d+|pardintbl\w*)(\s|$)/;
function indeksCacatAbt(beda: BedaHasil[]): Set<number> {
  const hasil = new Set<number>();
  let blok: number[] = [];
  let bocor = false;
  let terakhir = -10;
  const tutup = () => {
    if (bocor) for (const i of blok) hasil.add(i);
    blok = [];
    bocor = false;
  };
  beda.forEach((d, i) => {
    const nomor = Math.max(d.nomorAleta || 0, d.nomorAbt || 0);
    if (blok.length && nomor > terakhir + 1) tutup();
    blok.push(i);
    terakhir = nomor;
    if (d.abt && d.abt !== d.aleta && perbaikiMojibake(String(d.abt)) === d.aleta) {
      // mojibake ABT pada satu alinea (huruf UTF-8 dibaca sebagai latin1): ALETA mencetak hurufnya dengan benar
      hasil.add(i);
      return;
    }
    if (BOCOR_KENDALI.test(String(d.abt ?? "")) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(String(d.abt ?? ""))) bocor = true;
  });
  tutup();
  return hasil;
}

/**
 * Ringkasan per keluarga (angka saja). Alinea: dari hasil banding naskah (jsonl per perkara). Isian: dari keluaran `ukur.mjs banding`
 * (per_jenis, kuncinya = keluarga). Beda isian TIDAK dianggap dijelaskan di sini: sebab tiap beda ditinjau manusia dan dicatat sebagai
 * penjelasan tersendiri, tidak dilulukan diam-diam oleh skrip.
 */
function laporanSemua([isianBerkas]: string[]) {
  const semua: HasilNaskah[] = [];
  for (const f of fs.existsSync(dirHasil()) ? fs.readdirSync(dirHasil()) : []) {
    for (const l of baca(path.join(dirHasil(), f)).split("\n").filter(Boolean)) semua.push(JSON.parse(l) as HasilNaskah);
  }
  for (const h of semua) h.perKelas = golongkanUlang(h.beda);
  const isian: Record<string, IsianKeluarga> = isianBerkas && fs.existsSync(isianBerkas) ? (JSON.parse(baca(isianBerkas)) as { per_jenis: Record<string, IsianKeluarga> }).per_jenis : {};
  const blangkoTotal = new Map<string, number>();
  for (const b of daftarBlangko()) blangkoTotal.set(b.jenis, (blangkoTotal.get(b.jenis) ?? 0) + 1);
  const perkaraBaris = baris(berkasPerkara());
  // Blangko yang tidak dapat diukur karena isiannya belum ada di katalog salinan uji (atau memanggil fungsi yang tidak ada): dihitung per keluarga.
  const terhalangPer = new Map<string, number>();
  const fileTerhalang = path.join(KELUAR, "blangko-terhalang.tsv");
  if (fs.existsSync(fileTerhalang)) for (const l of baca(fileTerhalang).split("\n").filter(Boolean)) terhalangPer.set(l.split("\t")[0], (terhalangPer.get(l.split("\t")[0]) ?? 0) + 1);
  const keluarga: UkurKeluarga[] = [];
  const teks: string[] = ["PEMBANDING SEMUA JENIS PERKARA TAHAP 8 - ALETA ABT lawan ABT (memuat nama blangko; TANPA data pihak)"];
  teks.push(`Dibuat ${new Date().toISOString()}. Salinan uji ${SIPP} + ${ABT}. Naskah dibandingkan ${semua.length}.`);
  teks.push("");
  for (const k of KELUARGA_PINDAH) {
    const hs = semua.filter((h) => h.jenis === k.kunci);
    const perkaraK = new Set(perkaraBaris.filter((b) => b[2] === k.kunci).map((b) => b[0]));
    const adaBlangko = blangkoTotal.get(k.kunci) ?? 0;
    const i = isian[k.kunci];
    if (!perkaraK.size || !hs.length) {
      const sebab = perkaraK.size ? "belum ada naskah terukur" : "tidak ada perkara jenis ini di salinan uji";
      keluarga.push({ kunci: k.kunci, perkara: 0, naskah: 0, alinea: 0, identik: 0, dijelaskan: 0, belumDijelaskan: 0, isianNilai: 0, isianCocok: 0, isianDijelaskan: 0, sebabBelum: sebab });
      teks.push(`${k.nama} (${k.kunci}): BELUM TERUKUR - ${sebab}; ${adaBlangko} blangko menunggu`);
      continue;
    }
    const alinea = hs.reduce((a, h) => a + h.total, 0);
    const identik = hs.reduce((a, h) => a + h.identik, 0);
    const bedaSemua = hs.flatMap((h) => h.beda);
    const cacatPerNaskah = hs.map((h) => indeksCacatAbt(h.beda));
    const cacatAbtN = cacatPerNaskah.reduce((a, c, n) => a + [...c].filter((idx) => !KELAS_DIJELASKAN[hs[n].beda[idx].kelas]).length, 0);
    const dijelaskan = bedaSemua.filter((d) => KELAS_DIJELASKAN[d.kelas]).length + cacatAbtN;
    const belum = bedaSemua.length - dijelaskan;
    const naskahIdentik = hs.filter((h) => h.identik === h.total).length;
    const diharap = adaBlangko * perkaraK.size;
    keluarga.push({
      kunci: k.kunci,
      perkara: perkaraK.size,
      naskah: hs.length,
      alinea,
      identik,
      dijelaskan,
      belumDijelaskan: belum,
      isianNilai: i ? i.nilai : 0,
      isianCocok: i ? i.cocok + i.spasi : 0,
      isianDijelaskan: i ? (i.tandaKosong ?? 0) + (i.cacatAbt ?? 0) : 0,
      sebabBelum: [
        hs.length >= diharap ? "" : `baru ${hs.length} dari ${diharap} naskah`,
        terhalangPer.get(k.kunci) ? `${terhalangPer.get(k.kunci)} dari ${adaBlangko + (terhalangPer.get(k.kunci) ?? 0)} blangko belum dapat diukur karena isiannya belum ada di salinan uji` : "",
      ]
        .filter(Boolean)
        .join("; "),
    });
    teks.push(
      `${k.nama} (${k.kunci}): ${perkaraK.size} perkara, ${hs.length}/${diharap} naskah${terhalangPer.get(k.kunci) ? ` (tidak termasuk ${terhalangPer.get(k.kunci)} blangko terhalang)` : ""}, ${alinea} alinea: ${identik} identik (${((100 * identik) / alinea).toFixed(3)}%), ${dijelaskan} beda dijelaskan, ${belum} BELUM dijelaskan; identik + dijelaskan ${((100 * (identik + dijelaskan)) / alinea).toFixed(3)}%; ${naskahIdentik} naskah identik seluruhnya` +
        (cacatAbtN ? `; ${cacatAbtN} beda karena cacat ABT` : "") +
        (i ? `; isian ${i.nilai} nilai: ${i.cocok} cocok, ${i.spasi} beda spasi, ${i.tandaKosong ?? 0} titik-titik isian kosong, ${i.cacatAbt ?? 0} cacat ABT, ${i.waktuHabis ?? 0} waktu kueri habis (diukur ulang), ${i.beda} beda isi belum dijelaskan (${((100 * (i.cocok + i.spasi + (i.tandaKosong ?? 0) + (i.cacatAbt ?? 0))) / i.nilai).toFixed(3)}% cocok atau dijelaskan)` : "; isian belum diukur")
    );
    const kel = new Map<string, { blangko: string; kelas: string; banyak: number; perkara: Set<string>; isian: string }>();
    for (const [n, h] of hs.entries()) {
      for (const [idx, d] of h.beda.entries()) {
        if (KELAS_DIJELASKAN[d.kelas] || cacatPerNaskah[n].has(idx)) continue;
        const kunci = `${h.blangko}|${d.kelas}|${d.isianNo.join(",")}`;
        const e = kel.get(kunci) ?? { blangko: h.blangko.split("/").pop()!, kelas: d.kelas, banyak: 0, perkara: new Set<string>(), isian: d.isianNama.join(", ") };
        e.banyak += 1;
        e.perkara.add(h.perkara);
        kel.set(kunci, e);
      }
    }
    for (const e of [...kel.values()].sort((a, b) => b.banyak - a.banyak).slice(0, 8)) teks.push(`    belum dijelaskan: ${e.blangko} | ${e.kelas} | ${e.banyak} alinea | ${e.perkara.size} perkara | ${e.isian || "isian tak terlacak"}`);
  }
  teks.push("");
  const terukur = keluarga.filter((x) => x.naskah > 0);
  teks.push(`Terukur ${terukur.length} dari ${keluarga.length} keluarga. Belum terukur: ${keluarga.filter((x) => !x.naskah).map((x) => x.kunci).join(", ") || "-"}.`);
  tulis(path.join(KELUAR, "LAPORAN-T8.txt"), teks.join("\n") + "\n");
  tulis(path.join(KELUAR, "laporan-t8.json"), JSON.stringify({ dibuat: new Date().toISOString(), keterangan: `Naskah ALETA ABT dibandingkan dengan ABT pada salinan uji, ${semua.length} naskah.`, keluarga }, null, 1));
  console.log(teks.join("\n"));
}

/**
 * Membuang dari hasil naskah yang TIDAK boleh dipercaya atau perlu diukur ulang: yang punya beda belum dijelaskan (isi, hanya-abt, hanya-aleta,
 * tanda-baca) dan yang punya isian kosong karena galat (mis. waktu kueri habis). Dipakai sesudah mesin diperbaiki atau sesudah mesin sempat
 * sibuk; `banding` berikutnya menyusunnya lagi. Beda yang sudah dijelaskan tidak diulang.
 */
function ulangTakCocok() {
  let dibuang = 0;
  let tinggal = 0;
  for (const f of fs.existsSync(dirHasil()) ? fs.readdirSync(dirHasil()) : []) {
    const berkas = path.join(dirHasil(), f);
    const baru: string[] = [];
    for (const l of baca(berkas).split("\n").filter(Boolean)) {
      const h = JSON.parse(l) as HasilNaskah;
      golongkanUlang(h.beda);
      const cacat = indeksCacatAbt(h.beda);
      const buruk = (h.kosongGalat ?? 0) > 0 || h.beda.some((d, i) => !KELAS_DIJELASKAN[d.kelas] && !cacat.has(i)) || (h.mesinGalat ?? "") !== "";
      if (buruk) dibuang += 1;
      else {
        baru.push(l);
        tinggal += 1;
      }
    }
    fs.writeFileSync(berkas, baru.length ? baru.join("\n") + "\n" : "");
  }
  console.log(`dibuang ${dibuang} naskah untuk disusun ulang, tinggal ${tinggal}`);
}

/**
 * Daftar penanda per perkara (kode-pid/p<perkara>.txt): hanya penanda yang dipakai blangko keluarga perkara itu. Merender ABT sepanjang
 * seluruh penanda (1772) makan puluhan menit per perkara pada mesin sibuk; sepotong daftar cukup karena nilai tiap penanda tidak bergantung
 * pada penanda lain (lihat abt_render_mentah.py). Satu perkara yang mewakili beberapa keluarga memakai gabungannya.
 */
async function kodePerPerkara() {
  const dir = path.join(KELUAR, "kode-pid");
  fs.mkdirSync(dir, { recursive: true });
  // Isian yang memanggil fungsi basis data yang TIDAK ADA di salinan uji (langsung atau lewat isian lain) tidak dapat dihitung ABT: satu galat SQL
  // menghentikan seluruh render ABT. Isian itu dikeluarkan dari daftar dan blangko yang memuatnya dicatat "belum terukur", tidak ditebak.
  const { kolam, kueri } = bukaKolam();
  const ada = new Set((await kueri("SELECT ROUTINE_NAME AS n FROM information_schema.routines WHERE ROUTINE_SCHEMA = ?", [ABT])).map((r) => String(r.n).toLowerCase()));
  const katalog = await kueri(`SELECT no_var, sql_query, default_data, referensi FROM ${ABT}.abt_variabel`);
  const nomorBaku = (x: unknown) => String(x ?? "").trim().replace(/^0+(?=\d{4})/, "").padStart(4, "0");
  const rujukan = new Map<string, Set<string>>();
  const adaDiKatalog = new Set(katalog.map((v) => nomorBaku(v.no_var)));
  const terhalang = new Set<string>();
  const hilangFungsi = new Set<string>();
  for (const v of katalog) {
    const no = nomorBaku(v.no_var);
    const teks = `${v.sql_query ?? ""}\n${v.default_data ?? ""}`;
    rujukan.set(no, new Set([...teks.matchAll(/#(\d{3,5})#/g)].map((m) => nomorBaku(m[1]))));
    for (const m of teks.matchAll(/aps_badilag[a-z0-9_]*\.([a-z_][a-z0-9_]*)\s*\(/gi)) {
      if (!ada.has(m[1].toLowerCase())) {
        terhalang.add(no);
        hilangFungsi.add(m[1].toLowerCase());
      }
    }
  }
  for (let berubah = true; berubah; ) {
    berubah = false;
    for (const [no, rj] of rujukan) if (!terhalang.has(no) && [...rj].some((r) => terhalang.has(r))) (terhalang.add(no), (berubah = true));
  }
  kolam.end();
  tulis(path.join(dir, "terhalang.txt"), [...terhalang].sort().join(",") + "\n");
  const semuaBlangko = fs.existsSync(path.join(KELUAR, "blangko-semua.tsv")) ? path.join(KELUAR, "blangko-semua.tsv") : berkasBlangko();
  if (!fs.existsSync(path.join(KELUAR, "blangko-semua.tsv"))) fs.copyFileSync(berkasBlangko(), path.join(KELUAR, "blangko-semua.tsv"));
  const dipakai: Blangko[] = [];
  const dihalangi: string[] = [];
  const perJenis = new Map<string, Set<string>>();
  for (const [kelompok, jenis, folder, nama] of baris(semuaBlangko)) {
    const b: Blangko = { kelompok, jenis, folder, nama };
    const rtf = bacaBlangko(b);
    const penanda = new Set<string>();
    for (const x of mesinMod.penandaUrutAbt(rtf)) if (x !== "") penanda.add(nomorBaku(x));
    for (const x of mesinMod.penandaUrutAbt(mesinMod.satukanPenandaTerpecah(rtf).rtf)) if (x !== "") penanda.add(nomorBaku(x));
    // terhalang: isian yang memanggil fungsi yang tidak ada, atau isian yang BELUM ADA di katalog salinan uji (salinan lebih tua dari pohon blangko)
    const halang = [...penanda].filter((x) => terhalang.has(x) || !adaDiKatalog.has(x));
    if (halang.length) {
      dihalangi.push([jenis, folder, nama, halang.slice(0, 6).join(",")].join("\t"));
      continue;
    }
    dipakai.push(b);
    const himpunan = perJenis.get(jenis) ?? new Set<string>();
    for (const x of penanda) himpunan.add(x);
    perJenis.set(jenis, himpunan);
  }
  tulis(berkasBlangko(), dipakai.map((b) => [b.kelompok, b.jenis, b.folder, b.nama].join("\t")).join("\n") + "\n");
  tulis(path.join(KELUAR, "blangko-terhalang.tsv"), dihalangi.join("\n") + (dihalangi.length ? "\n" : ""));
  const tanpaKatalog = new Set<string>();
  for (const l of dihalangi) for (const x of (l.split("	")[3] ?? "").split(",")) if (x && !adaDiKatalog.has(x)) tanpaKatalog.add(x);
  console.log(`isian pada blangko yang tidak ada di katalog salinan uji: ${tanpaKatalog.size} (tampak pada daftar enam pertama blangko terhalang)`);
  console.log(`fungsi dipanggil isian tetapi tidak ada di salinan uji: ${[...hilangFungsi].sort().join(", ") || "-"}; isian terhalang ${terhalang.size}; blangko terhalang ${dihalangi.length} dari ${dipakai.length + dihalangi.length}`);
  const perPid = new Map<string, Set<string>>();
  for (const [pid, , jenis] of baris(berkasPerkara())) {
    const g = perPid.get(pid) ?? new Set<string>();
    for (const x of perJenis.get(jenis) ?? []) g.add(x);
    perPid.set(pid, g);
  }
  const ukuran: Array<[string, number]> = [];
  for (const [pid, g] of perPid) {
    tulis(path.join(dir, `p${pid}.txt`), [...g].sort().join(",") + "\n");
    ukuran.push([pid, g.size]);
  }
  ukuran.sort((a, b) => a[1] - b[1]);
  tulis(path.join(dir, "urutan.txt"), ukuran.map(([pid]) => pid).join("\n") + "\n");
  console.log(`penanda per perkara: ${ukuran.length} perkara, ${ukuran[0]?.[1]} sampai ${ukuran[ukuran.length - 1]?.[1]} penanda (semua: ${new Set([...perPid.values()].flatMap((g) => [...g])).size})`);
}

const [cmd, ...arg] = process.argv.slice(2);
const peta: Record<string, (a: string[]) => unknown> = { sampel, abt, banding, waktu, verifikasi, laporan, "sampel-semua": sampelSemua, "laporan-semua": laporanSemua, "ulang-tak-cocok": ulangTakCocok, "kode-pid": kodePerPerkara };
if (!peta[cmd]) {
  console.error("perintah: sampel | abt | banding | waktu | verifikasi | laporan | sampel-semua | laporan-semua | ulang-tak-cocok");
  process.exit(2);
}
await peta[cmd](arg);
