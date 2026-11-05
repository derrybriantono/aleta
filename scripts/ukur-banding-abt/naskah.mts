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
 * UKURAN YANG TIDAK DIUKUR DI SINI: jumlah halaman dan letak tanda tangan (butuh PDF dari LibreOffice; tidak ada di laptop ini).
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { alineaDariRtf, bandingAlinea, golonganBeda, kertasDariRtf, type BedaAlinea, type KelasBeda } from "@/lib/aleta-abt-naskah";
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
const dirHasil = () => path.join(KELUAR, "hasil");

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
      kolam.query({ sql: teks, values: params || [], timeout: opsi?.timeoutMs || 60000, typeCast: (f: { string: () => string }) => f.string() }, (g: Error | null, r: Array<Record<string, string>>) => (g ? gagal(g) : ok(r)))
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
  const antre = baris(berkasPerkara()).map((b) => b[0]).filter((pid) => !fs.existsSync(path.join(dirMentah(), `p${pid}.json`)));
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
    const mesin = mesinMod.buatMesin({ kueri, skemaAbt: ABT, umurKatalogMs: 3600 * 1000, batasKueriMs: 60000, jalurAleta: { pustaka: jalur.pustaka, alias: jalur.alias } });
    let dingin = true;
    let n = 0;
    for (const b of blangko.filter((x) => x.jenis === jenis)) {
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
    const mesin = mesinMod.buatMesin({ kueri, skemaAbt: ABT, umurKatalogMs: 3600 * 1000, batasKueriMs: 60000, jalurAleta: { pustaka: jalur.pustaka, alias: jalur.alias } });
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
  const perKel: Record<KelasBeda, number> = { "tata-letak": 0, "tanda-baca": 0, "tanda-kosong": 0, isi: 0, "hanya-abt": 0, "hanya-aleta": 0 };
  // Penggolongan dihitung ulang dari teks tersimpan dengan aturan terkini (hasil lama mungkin memakai penggolongan yang lebih kasar).
  for (const h of semua) {
    h.perKelas = { "tata-letak": 0, "tanda-baca": 0, "tanda-kosong": 0, isi: 0, "hanya-abt": 0, "hanya-aleta": 0 };
    for (const d of h.beda) {
      d.kelas = golonganBeda(d.abt, d.aleta);
      h.perKelas[d.kelas] += 1;
    }
  }
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
    return { jenis, naskah: hs.length, alinea, identik, persen: alinea ? (identik / alinea) * 100 : 100, naskahIdentik: hs.filter((h) => h.identik === h.total).length };
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
    "Jumlah halaman: butuh PDF dari LibreOffice, tidak ada di mesin pengukur. Pembandingnya (bandingRingkasPdf) sudah ada dan teruji dengan PDF rekaan.",
    "Letak tanda tangan: sama dengan jumlah halaman, butuh PDF. Nomor halaman dan garis Z juga hanya terlihat di PDF.",
    "Waktu PDF dan waktu pada server: tidak diukur di sini.",
    "Sidang ke-n pada berita acara: naskah dibandingkan dengan pilihan sidang bawaan kedua sisi (kosong), bukan tiap sidang.",
  ];
  const laporanJson = {
    dibuat: new Date().toISOString(),
    keterangan: `Naskah utuh ALETA ABT (mesin jalur ALETA) lawan naskah ABT yang dirakit dari nilai renderer ABT asli pada salinan uji. ${semua.length} naskah dari ${blangkoUnik.size} blangko dan ${perkaraUnik.size} perkara sampel.`,
    ringkas,
    perKelas: perKel,
    beda: bedaLaporan.map(({ _urut, ...x }) => x),
    belumTerukur,
    waktu: waktuSepi() ?? { jumlah: semua.length, rata: semua.length ? waktu.reduce((a, b) => a + b, 0) / semua.length : 0, tengah: median(waktu), terlama: Math.max(0, ...waktu), tempat: `laptop pengembangan (${os.cpus().length} inti), sambil 4 proses lain berjalan` },
  };
  tulis(path.join(KELUAR, "laporan-t5.json"), JSON.stringify(laporanJson, null, 1));
  const teks: string[] = [];
  teks.push("PEMBANDING NASKAH UTUH TAHAP 5 - ALETA ABT lawan ABT (memuat nama blangko; TANPA data pihak)");
  teks.push(`Dibuat ${laporanJson.dibuat}. Salinan uji ${SIPP} + ${ABT}.`);
  teks.push(`Naskah dibandingkan: ${semua.length} dari ${blangkoUnik.size} blangko x ${perkaraUnik.size} perkara. Naskah dengan penanda tanpa nilai ABT: ${tanpaNilai}.`);
  teks.push("");
  for (const r of ringkas) teks.push(`${r.jenis}: ${r.naskah} naskah, ${r.identik} dari ${r.alinea} alinea identik (${r.persen.toFixed(3)}%), ${r.naskahIdentik} naskah identik seluruhnya`);
  teks.push("");
  teks.push(`Beda per kelas (alinea): ${(Object.entries(perKel) as Array<[string, number]>).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  teks.push(`Waktu menyusun ALETA (mesin + penguraian) di laptop, ms: rata ${laporanJson.waktu.rata.toFixed(0)}, tengah ${laporanJson.waktu.tengah}, terlama ${laporanJson.waktu.terlama}; naskah pertama per perkara (dingin) tengah ${median(dingin)}, berikutnya (hangat) tengah ${median(hangat)}`);
  teks.push("");
  teks.push("Beda terbanyak (blangko | kelas | isian | banyak | perkara terdampak):");
  for (const e of [...kelompokBeda.values()].sort((a, b) => b.jumlah - a.jumlah).slice(0, 40)) teks.push(`  ${e.blangko.split("/").pop()} | ${e.kelas} | ${e.isian.join(", ") || "tak terlacak"} | ${e.jumlah} | ${e.perkara.size}`);
  teks.push("");
  teks.push("Belum terukur:");
  for (const t of belumTerukur) teks.push("  - " + t);
  tulis(path.join(KELUAR, "LAPORAN-T5.txt"), teks.join("\n") + "\n");
  console.log(teks.slice(0, 14).join("\n"));
}

const [cmd, ...arg] = process.argv.slice(2);
const peta: Record<string, (a: string[]) => unknown> = { sampel, abt, banding, waktu, verifikasi, laporan };
if (!peta[cmd]) {
  console.error("perintah: sampel | abt | banding | waktu | verifikasi | laporan");
  process.exit(2);
}
await peta[cmd](arg);
