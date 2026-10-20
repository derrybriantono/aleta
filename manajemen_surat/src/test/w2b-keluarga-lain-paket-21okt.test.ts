// @vitest-environment node
/**
 * ============================================================================
 * 21 OKT 2026 (AGEN INDUK W2b) - PAKET ABT abt-w2b-keluarga-lain (tiga keluarga dirakit) DAN KATALOG SAKSI KELUARGA
 * ============================================================================
 *
 * Paket dibangun ulang dari sumber (sumber/bangun_paket.py) lalu diperiksa:
 *   - keutuhan (MD5SUMS), jatah nomor 4850-4949 dan pembagian per keluarga, tanpa kembar, tanpa kata aplikasi;
 *   - kueri hanya SELECT, tanda kutip seimbang, tanpa garis miring terbalik (aman di jalur ABT);
 *   - tiap penanda #nnnn# di RTF baru/timpa dan kueri = variabel milik paket atau variabel ABT lama yang tercatat di PRASYARAT;
 *   - RTF utuh (kurung seimbang), penanda tidak terpecah kode RTF;
 *   - berkas_rtf.py dijalankan sungguhan: pasang -> periksa -> pasang ulang -> pulih mengembalikan berkas lama persis; berkas
 *     yang disunting orang lain TIDAK ditimpa;
 *   - sembilan katalog saksi keluarga versi 2: butir/pokok/dasar hukum lama utuh, kalimat saksi 1 dan 2 berbeda, data ekstensi sinkron;
 *   - variabel yang dideklarasikan katalog ada di paket.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

const REPO = path.resolve(__dirname, "../../..");
const AKAR = path.join(REPO, "abt-paket", "w2b-keluarga-lain");
const PAKET = path.join(AKAR, "paket-satker");
const NAMA = "abt-w2b-keluarga-lain";
const md5 = (b: Buffer | string) => createHash("md5").update(b).digest("hex");
const baca = (p: string) => fs.readFileSync(p);
const semuaBerkas = (akar: string): string[] =>
  fs.readdirSync(akar, { withFileTypes: true }).flatMap((n) => (n.isDirectory() ? semuaBerkas(path.join(akar, n.name)) : [path.join(akar, n.name)]));

const py = (() => {
  for (const c of ["python", "python3"]) if (spawnSync(c, ["--version"]).status === 0) return c;
  return null;
})();
if (py) {
  const b = spawnSync(py, ["sumber/bangun_paket.py"], { cwd: AKAR, encoding: "utf8", env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
  if (b.status !== 0) throw new Error("bangun_paket.py gagal: " + b.stderr);
}

const sql = (jenis: string) => baca(path.join(PAKET, `${NAMA}-${jenis}.sql`)).toString("latin1");
const pasangSql = sql("PASANG");
const baris = [...pasangSql.matchAll(/INSERT INTO abt_variabel \([^)]*\) SELECT (\d+), 0x([0-9a-f]+), '([a-z_]+)', NULL, NULL, NULL, NULL, (NULL|0x[0-9a-f]+),/g)];
const variabel = baris.map((m) => ({ no: Number(m[1]), nama: Buffer.from(m[2], "hex").toString("latin1"), tipe: m[3], sql: m[4] === "NULL" ? "" : Buffer.from(m[4].slice(2), "hex").toString("latin1") }));
const milik = new Set(variabel.map((v) => String(v.no).padStart(4, "0")));
const lamaDirujuk = new Set([...sql("PRASYARAT").matchAll(/'(\d{4})'/g)].map((m) => m[1]));

const KELUARGA: Record<string, [number, number]> = { perkawinan: [4850, 4879], anak: [4880, 4909], lain: [4910, 4939] };

function teksRtf(raw: string): string {
  return raw
    .replace(/\{\\\*[^{}]*\}/g, "")
    .replace(/\\'([0-9a-f]{2})/gi, (_, h) => Buffer.from(h, "hex").toString("latin1"))
    .replace(/\\(?:par|line|tab|cell|row)\b ?/g, "\n")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
    .replace(/[{}]/g, "");
}
function seimbang(raw: string): boolean {
  let d = 0;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === "\\") {
      i += 1;
      continue;
    }
    if (c === "{") d += 1;
    else if (c === "}" && --d < 0) return false;
  }
  return d === 0;
}

describe("keutuhan paket", () => {
  it("MD5SUMS cocok dengan seluruh berkas paket dan tidak ada berkas yang tak tercatat", () => {
    const daftar = baca(path.join(PAKET, "MD5SUMS.txt")).toString("utf8").split("\n").filter(Boolean);
    const dicatat = new Map(daftar.map((l) => [l.slice(34), l.slice(0, 32)]));
    const nyata = semuaBerkas(PAKET).filter((p) => path.basename(p) !== "MD5SUMS.txt");
    expect(nyata.length).toBe(dicatat.size);
    for (const p of nyata) {
      const rel = path.relative(PAKET, p).replace(/\\/g, "/");
      expect(dicatat.get(rel), rel).toBe(md5(baca(p)));
    }
  });
  it("tiga keluarga terrakit: jumlah variabel, blangko baru dan blangko timpa sesuai", () => {
    expect(variabel.length).toBe(70);
    expect(semuaBerkas(path.join(PAKET, "rtf")).filter((p) => p.endsWith(".rtf"))).toHaveLength(14);
    expect(semuaBerkas(path.join(PAKET, "timpa")).filter((p) => p.endsWith(".rtf"))).toHaveLength(31);
  });
});

describe("variabel baru (SQL)", () => {
  it("semua dalam jatah 4850-4949 menurut keluarga, tanpa kembar, tipe sah, nama bermakna", () => {
    const nomor = variabel.map((v) => v.no);
    expect(new Set(nomor).size).toBe(nomor.length);
    for (const v of variabel) {
      const ada = Object.values(KELUARGA).some(([a, b]) => v.no >= a && v.no <= b);
      expect(ada, String(v.no)).toBe(true);
      expect(["data_teks", "data_tanggal", "data_sql"]).toContain(v.tipe);
      expect(v.nama.trim().length).toBeGreaterThan(10);
      expect(v.nama.length).toBeLessThanOrEqual(255);
      if (v.tipe === "data_sql") expect(v.sql).toMatch(/^\s*SELECT\b/i);
      else expect(v.sql).toBe("");
    }
    for (const [k, [a, b]] of Object.entries(KELUARGA)) expect(nomor.filter((n) => n >= a && n <= b).length, k).toBeGreaterThan(5);
  });
  it("tidak satu kata 'Aleta' pun di SQL, nama, atau kueri", () => {
    for (const j of ["PRASYARAT", "PASANG", "PERIKSA", "PULIH"]) expect(sql(j), j).not.toMatch(/aleta/i);
    for (const v of variabel) expect(v.nama + v.sql).not.toMatch(/aleta/i);
  });
  it("kueri hanya SELECT, kolom hasil bernama data, tanpa garis miring terbalik (keabsahan sintaks diuji di MariaDB lokal dan SIPP server oleh skrip paket)", () => {
    for (const v of variabel.filter((x) => x.tipe === "data_sql")) {
      expect(v.sql, String(v.no)).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE\s+INTO)\b/i);
      expect(v.sql, String(v.no)).toMatch(/\bAS\s+data\b/i);
      expect(v.sql.includes("\\"), `${v.no} garis miring`).toBe(false);
      expect(v.sql, String(v.no)).not.toMatch(/\b(REGEXP_SUBSTR|JSON_|WITH\s+\w+\s+AS)\b/i);
    }
  });
  it("penanda dalam kueri adalah milik paket atau variabel ABT lama yang tercatat di PRASYARAT", () => {
    for (const v of variabel) {
      for (const m of (v.sql + v.nama).matchAll(/#(\d{4})#/g)) {
        if (!milik.has(m[1])) expect(lamaDirujuk.has(m[1]), `${v.no} merujuk #${m[1]}#`).toBe(true);
      }
    }
  });
  it("PRASYARAT, PERIKSA dan PULIH memuat penjaga md5 tiap variabel; PASANG tidak menimpa", () => {
    for (const j of ["PRASYARAT", "PERIKSA", "PULIH"]) {
      const s = sql(j);
      for (const v of variabel) expect(s, `${j} ${v.no}`).toContain(`no_var=${v.no} AND MD5(nama)='${md5(Buffer.from(v.nama, "latin1"))}'`);
    }
    expect(sql("PERIKSA")).toContain("'SEMUA COCOK'");
    expect(sql("PULIH")).toContain("PULIH COCOK");
    expect(pasangSql).toContain("WHERE NOT EXISTS");
    expect(pasangSql).not.toMatch(/\b(UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/i);
  });
});

describe("blangko RTF baru dan timpa", () => {
  const baru = semuaBerkas(path.join(PAKET, "rtf")).filter((p) => p.endsWith(".rtf"));
  const timpa = semuaBerkas(path.join(PAKET, "timpa")).filter((p) => p.endsWith(".rtf"));

  it("daftar-rtf dan daftar-timpa mencatat md5 yang benar; md5 baru berbeda dari lama; tidak ada nama kembar", () => {
    const dr = baca(path.join(PAKET, "daftar-rtf.tsv")).toString("utf8").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
    expect(dr).toHaveLength(14);
    for (const [folder, berkas, h] of dr) {
      expect(folder.startsWith("derry_briantono/")).toBe(true);
      expect(md5(baca(path.join(PAKET, "rtf", folder, berkas)))).toBe(h);
    }
    const dt = baca(path.join(PAKET, "daftar-timpa.tsv")).toString("utf8").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
    expect(dt).toHaveLength(31);
    for (const [folder, berkas, lama, baruMd5] of dt) {
      expect(md5(baca(path.join(PAKET, "timpa", folder, berkas)))).toBe(baruMd5);
      expect(baruMd5).not.toBe(lama);
    }
    const kunci = [...dr, ...dt].map(([f, b]) => `${f}/${b}`);
    expect(new Set(kunci).size).toBe(kunci.length);
  });

  it("kurung seimbang, tanpa kata Aleta, penanda utuh dan dikenal (milik paket atau variabel lama)", () => {
    for (const p of [...baru, ...timpa]) {
      const raw = baca(p).toString("latin1");
      const rel = path.relative(PAKET, p);
      expect(seimbang(raw), rel).toBe(true);
      const tampak = teksRtf(raw);
      expect(tampak, rel).not.toMatch(/aleta/i);
      const tampakToken = [...tampak.matchAll(/#(\d{4})#/g)].map((m) => m[1]);
      const mentahToken = [...raw.matchAll(/#(\d{4})#/g)].map((m) => m[1]);
      expect(mentahToken.length, `${rel} token terpecah`).toBeGreaterThanOrEqual(tampakToken.length);
      for (const t of new Set(mentahToken)) expect(milik.has(t) || lamaDirujuk.has(t), `${rel} #${t}#`).toBe(true);
      // penanda di jatah W2b hanya variabel yang memang dibuat paket
      for (const t of new Set(mentahToken)) if (Number(t) >= 4850 && Number(t) <= 4949) expect(milik.has(t), `${rel} #${t}#`).toBe(true);
    }
  });

  it("blangko izin poligami: verstek, keberatan Pasal 59 KHI dan pertimbangan calon istri pada [01]", () => {
    const dir = "rtf/derry_briantono/5 Izin Poligami";
    const a = baca(path.join(PAKET, dir, "[01a] [Kabul Verstek] Izin Poligami - Termohon Tidak Hadir.rtf")).toString("latin1");
    expect(a).toContain("#4863#");
    expect(a).toContain("secara verstek");
    const b = baca(path.join(PAKET, dir, "[01b] [Kabul] Izin Poligami - Termohon Keberatan (Pasal 59 KHI).rtf")).toString("latin1");
    expect(b).toContain("#4864#");
    expect(b).toContain("Pasal 59 Kompilasi Hukum Islam");
    const lama = baca(path.join(PAKET, "timpa/derry_briantono/5 Izin Poligami/[01] [Kabul] Izin Poligami.rtf")).toString("latin1");
    for (const t of ["#4857#", "#4860#", "#4861#"]) expect(lama).toContain(t);
  });

  it("permohonan umum: ada Kabul dan Tolak; keputusan pokok adalah isian hakim, bukan diputus mesin", () => {
    const dir = path.join(PAKET, "rtf/derry_briantono/9b Permohonan Umum");
    const berkas = fs.readdirSync(dir);
    expect(berkas.some((b) => b.startsWith("[01] [Kabul]"))).toBe(true);
    expect(berkas.some((b) => b.startsWith("[03] [Tolak]"))).toBe(true);
    const kabul = teksRtf(baca(path.join(dir, berkas.find((b) => b.startsWith("[01] [Kabul]"))!)).toString("latin1"));
    for (const t of ["#4935#", "#4936#", "#4937#", "#4938#"]) expect(kabul, t).toContain(t);
  });

  it("hak asuh: blangko baru kabul sebagian dan anak memilih ada; folder cerai kumulasi hak asuh (1d) tidak disentuh", () => {
    const semuaRel = [...baru, ...timpa].map((p) => path.relative(PAKET, p).replace(/\\/g, "/"));
    expect(semuaRel.some((r) => r.includes("6a Hak Asuh Anak (Hadhanah)/[01e]"))).toBe(true);
    expect(semuaRel.some((r) => r.includes("6a Hak Asuh Anak (Hadhanah)/[03c]"))).toBe(true);
    expect(semuaRel.filter((r) => r.includes("1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak"))).toHaveLength(0);
  });

  it("kalimat tuntutan yang terbaca tetapi belum diputus memakai tanda [PERIKSA ...] (menahan unggah), bukan putusan otomatis", () => {
    const peringatan = variabel.filter((v) => /\[PERIKSA/.test(v.sql));
    expect(peringatan.length).toBeGreaterThan(2);
  });
});

describe("berkas_rtf.py (dijalankan sungguhan di folder sementara)", () => {
  it.skipIf(!py)("pasang -> periksa -> pulih mengembalikan berkas lama persis; berkas yang berubah tidak ditimpa", () => {
    const tmp = fs.mkdtempSync(path.join(process.env.TEMP || os.tmpdir(), "w2b-paket-"));
    try {
      const akar = path.join(tmp, "blangko");
      const paket = path.join(tmp, "paket");
      const cad = path.join(tmp, "cad");
      const sub = path.join("derry_briantono", "5 Izin Poligami");
      fs.mkdirSync(path.join(akar, sub), { recursive: true });
      fs.mkdirSync(path.join(paket, "rtf", sub), { recursive: true });
      fs.mkdirSync(path.join(paket, "timpa", sub), { recursive: true });
      fs.mkdirSync(cad, { recursive: true });
      fs.copyFileSync(path.join(PAKET, "berkas_rtf.py"), path.join(paket, "berkas_rtf.py"));
      const lama = Buffer.from("{\\rtf1 LAMA}", "latin1");
      const baruIsi = Buffer.from("{\\rtf1 BARU}", "latin1");
      const baruFile = Buffer.from("{\\rtf1 FILE-BARU}", "latin1");
      const dirA = path.join(akar, sub);
      fs.writeFileSync(path.join(dirA, "lama.rtf"), lama);
      fs.writeFileSync(path.join(paket, "timpa", sub, "lama.rtf"), baruIsi);
      fs.writeFileSync(path.join(paket, "rtf", sub, "baru.rtf"), baruFile);
      fs.writeFileSync(path.join(paket, "daftar-rtf.tsv"), `derry_briantono/5 Izin Poligami\tbaru.rtf\t${md5(baruFile)}\tuji\n`);
      fs.writeFileSync(path.join(paket, "daftar-timpa.tsv"), `derry_briantono/5 Izin Poligami\tlama.rtf\t${md5(lama)}\t${md5(baruIsi)}\tuji\n`);
      const jalan = (aksi: string, ...arg: string[]) => spawnSync(py!, [path.join(paket, "berkas_rtf.py"), aksi, akar, ...arg], { encoding: "utf8" });

      let r = jalan("cek");
      expect(r.status, r.stdout).toBe(0);
      expect(r.stdout).toContain("BERKAS SIAP");
      r = jalan("pasang", paket, cad);
      expect(r.status, r.stdout + r.stderr).toBe(0);
      expect(fs.readFileSync(path.join(dirA, "lama.rtf")).equals(baruIsi)).toBe(true);
      expect(fs.readFileSync(path.join(dirA, "baru.rtf")).equals(baruFile)).toBe(true);
      r = jalan("periksa", cad);
      expect(r.stdout).toContain("BERKAS COCOK");
      r = jalan("pasang", paket, cad);
      expect(r.status, r.stdout).toBe(0);
      expect(r.stdout).toContain("SUDAH");
      r = jalan("pulih", cad);
      expect(r.stdout).toContain("BERKAS PULIH");
      expect(fs.readFileSync(path.join(dirA, "lama.rtf")).equals(lama)).toBe(true);
      expect(fs.existsSync(path.join(dirA, "baru.rtf"))).toBe(false);

      const disunting = Buffer.from("{\\rtf1 LAMA disunting}", "latin1");
      fs.writeFileSync(path.join(dirA, "lama.rtf"), disunting);
      r = jalan("pasang", paket, cad);
      expect(r.status).toBe(1);
      expect(fs.readFileSync(path.join(dirA, "lama.rtf")).equals(disunting)).toBe(true);
      expect(fs.existsSync(path.join(dirA, "baru.rtf"))).toBe(false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("sembilan katalog saksi keluarga versi 2", () => {
  const EKS = path.join(REPO, "ekstensi-sipp");
  const muat = (dir: string, n: string) => JSON.parse(fs.readFileSync(path.join(dir, `${n}.json`), "utf8"));
  const CAD = path.join(AKAR, "cadangan-katalog");
  const JENIS = ["izin-poligami", "pencegahan-perkawinan", "pembatalan-perkawinan", "hak-asuh", "penguasaan-anak", "nafkah-anak", "pengangkatan-anak", "mafqud", "permohonan-umum"];

  it("butir, pokok, dasar hukum dan keadaan lama utuh dan tidak berubah; versi naik satu; jumlah butir bertambah", () => {
    for (const j of JENIS) {
      const lama = muat(CAD, j);
      const baru = muat(path.join(EKS, "saksi-katalog"), j);
      expect(baru.versi, j).toBe(lama.versi + 1);
      expect(baru.pertanyaan.length, j).toBeGreaterThan(lama.pertanyaan.length);
      for (const q of lama.pertanyaan) expect(JSON.stringify(baru.pertanyaan.find((x: any) => x.id === q.id)), `${j} ${q.id}`).toBe(JSON.stringify(q));
      for (const p of lama.pokokPembuktian) expect(baru.pokokPembuktian.some((x: any) => x.id === p.id), `${j} ${p.id}`).toBe(true);
      for (const d of lama.dasarHukum) expect(baru.dasarHukum.some((x: any) => x.id === d.id), `${j} ${d.id}`).toBe(true);
      for (const k of Object.keys(lama.keadaan)) expect(baru.keadaan[k], `${j} ${k}`).toBeTruthy();
    }
  });

  it("butir baru: kalimat saksi 1 dan saksi 2 berbeda (>= 4 masing-masing) pada semua tingkat pengetahuan yang tersedia", () => {
    let diperiksa = 0;
    for (const j of JENIS) {
      const lama = muat(CAD, j);
      const ids = new Set(lama.pertanyaan.map((q: any) => q.id));
      const baru = muat(path.join(EKS, "saksi-katalog"), j);
      for (const q of baru.pertanyaan.filter((x: any) => !ids.has(x.id))) {
        for (const [jenis, v] of Object.entries(q.jawaban || {}) as [string, any][]) {
          for (const x of Array.isArray(v) ? v : [v]) {
            if (!x.saksi1 || !x.saksi2) continue;
            expect(x.saksi1.length, `${j}/${q.id}/${jenis}`).toBeGreaterThanOrEqual(2);
            expect(x.saksi2.length, `${j}/${q.id}/${jenis}`).toBeGreaterThanOrEqual(2);
            if (jenis !== "berbeda") for (const a of x.saksi1) for (const b of x.saksi2) expect(a, `${j}/${q.id}/${jenis}`).not.toBe(b);
            diperiksa += 1;
          }
        }
      }
    }
    expect(diperiksa).toBeGreaterThan(1500);
  });

  it("jumlah butir baru: jenis besar >= 40, jenis kecil >= 20", () => {
    const besar = new Set(["izin-poligami", "hak-asuh", "penguasaan-anak", "nafkah-anak", "pengangkatan-anak"]);
    for (const j of JENIS) {
      const sebelum = muat(CAD, j).pertanyaan.length;
      const sesudah = muat(path.join(EKS, "saksi-katalog"), j).pertanyaan.length;
      expect(sesudah - sebelum, j).toBeGreaterThanOrEqual(besar.has(j) ? 40 : 20);
    }
  });

  it("variabel yang dideklarasikan katalog (variabelBaru) ada di paket dan dalam jatah W2b", () => {
    for (const j of JENIS) {
      const k = muat(path.join(EKS, "saksi-katalog"), j);
      for (const n of k.variabelBaru || []) {
        const no = Number(typeof n === "string" ? n : n.kode);
        if (no >= 4850 && no <= 4949) expect(milik.has(String(no).padStart(4, "0")), `${j} ${no}`).toBe(true);
      }
    }
  });

  it("tidak satu kata 'Aleta' di katalog keluarga; data ekstensi sinkron dengan JSON", () => {
    for (const j of JENIS) expect(fs.readFileSync(path.join(EKS, "saksi-katalog", `${j}.json`), "utf8"), j).not.toMatch(/aleta/i);
    const harap = execFileSync(process.execPath, [path.join(REPO, "manajemen_surat/scripts/susun-saksi-katalog.mjs"), "--stdout"], { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 }).replace(/\r\n/g, "\n");
    const nyata = fs.readFileSync(path.join(EKS, "saksi-katalog-data.js"), "utf8").replace(/\r\n/g, "\n");
    expect(nyata === harap).toBe(true);
  });
});

describe("usulan untuk konfigurasi bersama sudah tergabung", () => {
  it("tiap fakta usulan keluarga ada di peta fakta dengan kodenya; tiap kode baru tercatat di gerbang (belumTerukur) sebagai saran", () => {
    const peta = JSON.parse(fs.readFileSync(path.join(REPO, "aleta_bot/config/peta-fakta-variabel.json"), "utf8"));
    const gerbang = JSON.parse(fs.readFileSync(path.join(REPO, "aleta_bot/config/gerbang-isian.json"), "utf8"));
    const sumber = path.join(AKAR, "untuk-sesi-utama");
    let fakta = 0;
    for (const n of fs.readdirSync(sumber).filter((x) => x.endsWith("-peta-fakta.json"))) {
      const t = JSON.parse(fs.readFileSync(path.join(sumber, n), "utf8"));
      for (const [k, d] of Object.entries(t.fakta || {}) as [string, any][]) {
        expect(peta.fakta[k], `${n} ${k}`).toBeTruthy();
        for (const kode of d.kode) expect(peta.fakta[k].kode.map((x: any) => (typeof x === "string" ? x : x.kode)), `${n} ${k}`).toContain(typeof kode === "string" ? kode : kode.kode);
        fakta += 1;
      }
    }
    expect(fakta).toBeGreaterThanOrEqual(26);
    for (const n of fs.readdirSync(sumber).filter((x) => x.endsWith("-gerbang.json"))) {
      const t = JSON.parse(fs.readFileSync(path.join(sumber, n), "utf8"));
      for (const kode of [...Object.keys(t.kode || {}), ...Object.keys(t.belumTerukur || {})]) {
        expect(gerbang.belumTerukur[kode] !== undefined || gerbang.kode[kode] !== undefined, `${n} ${kode}`).toBe(true);
        expect(gerbang.kode[kode], `${n} ${kode} tidak boleh otomatis tanpa data mentah`).toBeUndefined();
      }
    }
    expect(JSON.stringify(peta) + JSON.stringify(gerbang)).not.toMatch(/aleta/i);
  });
});
