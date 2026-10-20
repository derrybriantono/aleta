// @vitest-environment node
/**
 * ============================================================================
 * 20 OKT 2026 (AGEN U4) - PAKET ABT abt-u4-dk-wali-perwalian DAN KATALOG SAKSI VERSI 2
 * ============================================================================
 *
 * Dijaga (paket dibaca dari repo, skrip pasang dijalankan SUNGGUHAN di folder sementara):
 *   - keutuhan paket (MD5SUMS), jatah nomor 4400-4499, nama dan kueri tanpa kata aplikasi ini, hex SQL terbaca balik;
 *   - semua penanda #nnnn# di blangko baru/timpa dan di kueri adalah variabel milik paket atau variabel ABT lama;
 *   - RTF utuh (kurung seimbang), penanda tidak terpecah kode RTF, tidak ada sisa isian mentah ("ANAK 1", "PERSATU");
 *   - berkas_rtf.py: pasang -> periksa -> pulih mengembalikan berkas lama persis; berkas yang sudah disunting orang TIDAK ditimpa;
 *   - katalog DK/wali adhal/perwalian versi 2: butir baru lengkap per tingkat pengetahuan dan berlaku menurut keadaan.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

const REPO = path.resolve(__dirname, "../../..");
const PAKET = path.join(REPO, "abt-paket", "u4-dk-wali-perwalian", "paket-satker");
const NAMA = "abt-u4-dk-wali-perwalian";
const md5 = (b: Buffer | string) => createHash("md5").update(b).digest("hex");
const baca = (p: string) => fs.readFileSync(p);
const semuaBerkas = (akar: string): string[] => {
  const hasil: string[] = [];
  for (const n of fs.readdirSync(akar, { withFileTypes: true })) {
    const p = path.join(akar, n.name);
    if (n.isDirectory()) hasil.push(...semuaBerkas(p));
    else hasil.push(p);
  }
  return hasil;
};
/** Variabel LAMA yang dirujuk paket: daftar di PRASYARAT.sql, dicocokkan dengan server (BACA SAJA) saat paket dibangun (sumber/token_rtf.py --server). */
const prasyaratTeks = baca(path.join(PAKET, `${NAMA}-PRASYARAT.sql`)).toString("latin1");

/** Teks tampak RTF (cukup untuk mencari penanda dan kata terlarang). */
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
    else if (c === "}") {
      d -= 1;
      if (d < 0) return false;
    }
  }
  return d === 0;
}

const kamus: Set<string> = new Set([...(prasyaratTeks.match(/'(\d{4})'/g) || []).map((x) => x.slice(1, 5))]);
const sql = (jenis: string) => baca(path.join(PAKET, `${NAMA}-${jenis}.sql`)).toString("latin1");
const pasangSql = sql("PASANG");
const baris = [...pasangSql.matchAll(/INSERT INTO abt_variabel \([^)]*\) SELECT (\d+), 0x([0-9a-f]+), '([a-z_]+)', NULL, NULL, NULL, NULL, (NULL|0x[0-9a-f]+),/g)];
const variabel = baris.map((m) => ({ no: Number(m[1]), nama: Buffer.from(m[2], "hex").toString("latin1"), tipe: m[3], sql: m[4] === "NULL" ? "" : Buffer.from(m[4].slice(2), "hex").toString("latin1") }));

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
});

describe("variabel baru (SQL)", () => {
  it("24 variabel, semua dalam jatah 4400-4499, tanpa kembar, tipe sah", () => {
    expect(variabel).toHaveLength(24);
    const nomor = variabel.map((v) => v.no);
    expect(new Set(nomor).size).toBe(24);
    for (const n of nomor) expect(n).toBeGreaterThanOrEqual(4400), expect(n).toBeLessThanOrEqual(4499);
    for (const v of variabel) {
      expect(["data_teks", "data_tanggal", "data_sql"]).toContain(v.tipe);
      expect(v.nama.length).toBeLessThanOrEqual(200);
      expect(v.nama.trim().length).toBeGreaterThan(10);
      if (v.tipe === "data_sql") expect(v.sql).toMatch(/^\s*SELECT\b/i);
      else expect(v.sql).toBe("");
    }
  });

  it("tidak satu kata 'Aleta' pun di SQL, nama, atau kueri (berkas SQL mentah)", () => {
    for (const j of ["PRASYARAT", "PASANG", "PERIKSA", "PULIH"]) expect(sql(j), j).not.toMatch(/aleta/i);
    for (const v of variabel) expect(v.nama + v.sql).not.toMatch(/aleta/i);
  });

  it("kueri hanya SELECT (tanpa DML/DDL), kolom hasil bernama data, tanda kutip seimbang", () => {
    for (const v of variabel.filter((x) => x.tipe === "data_sql")) {
      expect(v.sql, String(v.no)).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE\s+INTO)\b/i);
      expect(v.sql, String(v.no)).toMatch(/\bAS\s+data\b/i);
      const ganjil = (s: string, k: string) => (s.split(k).length - 1) % 2 === 1;
      expect(ganjil(v.sql, '"'), `${v.no} kutip ganda`).toBe(false);
      expect(ganjil(v.sql.replace(/\\'/g, ""), "'"), `${v.no} kutip tunggal`).toBe(false);
    }
  });

  it("penanda dalam kueri adalah milik paket atau variabel ABT lama", () => {
    const milik = new Set(variabel.map((v) => String(v.no).padStart(4, "0")));
    for (const v of variabel) {
      for (const m of v.sql.matchAll(/#(\d{4})#/g)) {
        if (!milik.has(m[1])) expect(kamus.has(m[1]), `${v.no} merujuk #${m[1]}#`).toBe(true);
      }
    }
  });

  it("PRASYARAT, PERIKSA dan PULIH memuat penjaga md5 tiap variabel", () => {
    for (const j of ["PRASYARAT", "PERIKSA", "PULIH"]) {
      const s = sql(j);
      for (const v of variabel) expect(s, `${j} ${v.no}`).toContain(`no_var=${v.no} AND MD5(nama)='${md5(Buffer.from(v.nama, "latin1"))}'`);
    }
    expect(sql("PERIKSA")).toContain("'SEMUA COCOK'");
    expect(sql("PULIH")).toContain("PULIH COCOK");
    expect(sql("PASANG")).toContain("WHERE NOT EXISTS");
  });
});

describe("blangko RTF baru dan timpa", () => {
  const baru = semuaBerkas(path.join(PAKET, "rtf")).filter((p) => p.endsWith(".rtf"));
  const timpa = semuaBerkas(path.join(PAKET, "timpa")).filter((p) => p.endsWith(".rtf"));
  const milik = new Set(variabel.map((v) => String(v.no).padStart(4, "0")));

  it("3 blangko baru dan 12 ditimpa; daftar-rtf/daftar-timpa mencatat md5 yang benar", () => {
    expect(baru).toHaveLength(3);
    expect(timpa).toHaveLength(12);
    const dr = baca(path.join(PAKET, "daftar-rtf.tsv")).toString("utf8").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
    for (const [folder, berkas, h] of dr) expect(md5(baca(path.join(PAKET, "rtf", folder, berkas)))).toBe(h);
    const dt = baca(path.join(PAKET, "daftar-timpa.tsv")).toString("utf8").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
    expect(dt).toHaveLength(12);
    for (const [folder, berkas, lama, baruMd5] of dt) {
      expect(md5(baca(path.join(PAKET, "timpa", folder, berkas)))).toBe(baruMd5);
      expect(baruMd5).not.toBe(lama);
    }
  });

  it("kurung seimbang, tanpa kata Aleta, penanda utuh dan dikenal, tanpa sisa isian mentah", () => {
    for (const p of [...baru, ...timpa]) {
      const raw = baca(p).toString("latin1");
      const rel = path.relative(PAKET, p);
      expect(seimbang(raw), rel).toBe(true);
      const tampak = teksRtf(raw);
      expect(tampak, rel).not.toMatch(/aleta/i);
      expect(tampak, rel).not.toMatch(/ANAK 1|PERSATU|\(_ tahun\)|lahir tanggal _/);
      // setiap penanda yang tampak harus ada utuh di RTF mentah (tidak terpecah kode format)
      const tampakToken = [...tampak.matchAll(/#(\d{4})#/g)].map((m) => m[1]);
      const mentahToken = [...raw.matchAll(/#(\d{4})#/g)].map((m) => m[1]);
      expect(mentahToken.length, `${rel} token terpecah`).toBeGreaterThanOrEqual(tampakToken.length);
      for (const t of new Set(tampakToken)) expect(kamus.has(t) || milik.has(t), `${rel} #${t}#`).toBe(true);
    }
  });

  it("perwalian kerabat memakai variabel baru; blangko DK baru memakai variabel alasan otomatis dan tidak lagi hamil-saja", () => {
    const kerabat = teksRtf(baca(baru.find((p) => p.includes("[01b]"))!).toString("latin1"));
    for (const t of ["#4400#", "#4405#", "#4406#", "#4407#", "#4409#", "#4411#", "#4412#"]) expect(kerabat, t).toContain(t);
    expect(kerabat).toContain("Pasal 50 ayat (1) Undang-Undang Nomor 1 Tahun 1974");
    expect(kerabat).toContain("Pasal 107 ayat (4) Kompilasi Hukum Islam");
    expect(kerabat).toContain("Peraturan Pemerintah Nomor 29 Tahun 2019");
    expect(kerabat).not.toMatch(/#5115#|#5110#|#5114#/);
    const dkA = teksRtf(baca(baru.find((p) => p.includes("[01c]"))!).toString("latin1"));
    for (const t of ["#4420#", "#4421#", "#4422#", "#4423#", "#4424#", "#4425#", "#4426#", "#4428#", "#1143#"]) expect(dkA, t).toContain(t);
    expect(dkA).toContain("Pasal 283 RBg jo. Pasal 1865");
    expect(dkA).toContain("Pasal 15 Peraturan Mahkamah Agung");
    const dkB = teksRtf(baca(baru.find((p) => p.includes("[01d]"))!).toString("latin1"));
    expect(dkB).toContain("#7047#");
    expect(dkB).toContain("kedua calon mempelai");
  });
});

describe("berkas_rtf.py (dijalankan sungguhan di folder sementara)", () => {
  const py = (() => {
    for (const c of ["python", "python3"]) {
      const r = spawnSync(c, ["--version"]);
      if (r.status === 0) return c;
    }
    return null;
  })();

  it.skipIf(!py)("pasang -> periksa -> pulih mengembalikan berkas lama persis; berkas yang berubah tidak ditimpa", () => {
    const tmp = fs.mkdtempSync(path.join(process.env.TEMP || os.tmpdir(), "u4-paket-"));
    try {
      const akar = path.join(tmp, "blangko");
      const paket = path.join(tmp, "paket");
      const cad = path.join(tmp, "cad");
      fs.mkdirSync(path.join(akar, "derry_briantono", "6 Perwalian"), { recursive: true });
      fs.mkdirSync(path.join(paket, "rtf", "derry_briantono", "6 Perwalian"), { recursive: true });
      fs.mkdirSync(path.join(paket, "timpa", "derry_briantono", "6 Perwalian"), { recursive: true });
      fs.mkdirSync(cad, { recursive: true });
      fs.copyFileSync(path.join(PAKET, "berkas_rtf.py"), path.join(paket, "berkas_rtf.py"));
      const lama = Buffer.from("{\\rtf1 LAMA}", "latin1");
      const baruIsi = Buffer.from("{\\rtf1 BARU}", "latin1");
      const baruFile = Buffer.from("{\\rtf1 FILE-BARU}", "latin1");
      const dirA = path.join(akar, "derry_briantono", "6 Perwalian");
      fs.writeFileSync(path.join(dirA, "lama.rtf"), lama);
      fs.writeFileSync(path.join(paket, "timpa", "derry_briantono", "6 Perwalian", "lama.rtf"), baruIsi);
      fs.writeFileSync(path.join(paket, "rtf", "derry_briantono", "6 Perwalian", "baru.rtf"), baruFile);
      fs.writeFileSync(path.join(paket, "daftar-rtf.tsv"), `derry_briantono/6 Perwalian\tbaru.rtf\t${md5(baruFile)}\tuji\n`);
      fs.writeFileSync(path.join(paket, "daftar-timpa.tsv"), `derry_briantono/6 Perwalian\tlama.rtf\t${md5(lama)}\t${md5(baruIsi)}\tuji\n`);
      const jalan = (aksi: string, ...arg: string[]) => spawnSync(py!, [path.join(paket, "berkas_rtf.py"), aksi, akar, ...arg], { encoding: "utf8" });

      let r = jalan("cek");
      expect(r.status, r.stdout).toBe(0);
      expect(r.stdout).toContain("BERKAS SIAP");
      r = jalan("pasang", paket, cad);
      expect(r.status, r.stdout + r.stderr).toBe(0);
      expect(fs.readFileSync(path.join(dirA, "lama.rtf")).equals(baruIsi)).toBe(true);
      expect(fs.readFileSync(path.join(dirA, "baru.rtf")).equals(baruFile)).toBe(true);
      expect(fs.readFileSync(path.join(cad, "timpa-asal", "derry_briantono", "6 Perwalian", "lama.rtf")).equals(lama)).toBe(true);
      r = jalan("periksa", cad);
      expect(r.stdout).toContain("BERKAS COCOK");
      r = jalan("pasang", paket, cad); // pasang ulang aman
      expect(r.status, r.stdout).toBe(0);
      expect(r.stdout).toContain("SUDAH");
      r = jalan("pulih", cad);
      expect(r.stdout).toContain("BERKAS PULIH");
      expect(fs.readFileSync(path.join(dirA, "lama.rtf")).equals(lama)).toBe(true);
      expect(fs.existsSync(path.join(dirA, "baru.rtf"))).toBe(false);

      // berkas disunting orang lain: pasang DIBATALKAN, tidak ada yang berubah
      const disunting = Buffer.from("{\\rtf1 LAMA disunting}", "latin1");
      fs.writeFileSync(path.join(dirA, "lama.rtf"), disunting);
      r = jalan("pasang", paket, cad);
      expect(r.status).toBe(1);
      expect(r.stdout).toContain("disunting orang lain");
      expect(fs.readFileSync(path.join(dirA, "lama.rtf")).equals(disunting)).toBe(true);
      expect(fs.existsSync(path.join(dirA, "baru.rtf"))).toBe(false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("katalog saksi versi 2: DK, wali adhal, perwalian", () => {
  const req = createRequire(import.meta.url);
  const EKS = path.join(REPO, "ekstensi-sipp");
  const muat = (n: string) => JSON.parse(fs.readFileSync(path.join(EKS, "saksi-katalog", n), "utf8"));
  const dk = muat("dispensasi-kawin.json");
  const wa = muat("wali-adhal.json");
  const pw = muat("perwalian.json");
  const butir = (k: any, id: string) => k.pertanyaan.find((q: any) => q.id === id);

  it("versi naik ke 2 dan isi lama tidak hilang (butir lama tetap ada)", () => {
    for (const k of [dk, wa, pw]) expect(k.versi).toBe(2);
    for (const id of ["q-dk-hamil-pr", "q-dk-alasan-lk", "q-dk-penutup-pr"]) expect(butir(dk, id), id).toBeTruthy();
    for (const id of ["q-alasan-wali", "q-sekufu", "q-penutup"]) expect(butir(wa, id), id).toBeTruthy();
    for (const id of ["q-pw-hubungan-kl", "q-pw-orangtua-kl", "q-pw-penutup-ok"]) expect(butir(pw, id), id).toBeTruthy();
  });

  it("butir baru punya jawaban melihat, de-auditu dan sebagian masing-masing 4 varian saksi 1 dan 4 varian saksi 2", () => {
    const baru = [
      ...dk.pertanyaan.filter((q: any) => /^q-dk-(penolakan-kua|selisih-usia|kekerasan|ekonomi|tinggal|upaya-tunda|lingkungan|pendampingan|dua-keluarga)-/.test(q.id)),
      ...["q-lamaran", "q-restu-keluarga-lain", "q-sejak-kapan-menolak", "q-bersedia-wali-hakim", "q-rencana-nikah"].map((id) => butir(wa, id)),
      ...["q-pw-hubungan-kerabat", "q-pw-orangtua-kerabat", "q-pw-pidana-sehat", "q-pw-penghasilan", "q-pw-tinggal-anak", "q-pw-pendidikan-anak", "q-pw-kesanggupan-harta"].map((id) => butir(pw, id)),
    ];
    expect(baru.length).toBe(15 + 2 + 5 + 7);
    for (const q of baru) {
      expect(q, "butir hilang").toBeTruthy();
      for (const j of ["melihat", "de-auditu", "sebagian"]) {
        const x = q.jawaban[j];
        expect(x.saksi1.length, `${q.id} ${j}`).toBeGreaterThanOrEqual(4);
        expect(x.saksi2.length, `${q.id} ${j}`).toBeGreaterThanOrEqual(4);
        expect(new Set([...x.saksi1, ...x.saksi2]).size).toBe(x.saksi1.length + x.saksi2.length);
      }
    }
  });

  it("jawaban memakai penanda variabel yang terisi dari data, bukan titik-titik", () => {
    for (const k of [dk, wa, pw]) {
      for (const id of Object.keys(k.pertanyaan).length ? k.pertanyaan.filter((q: any) => q.urutan >= (k === dk ? 1910 : k === wa ? 215 : 1410) && q.urutan < 2000 && q.urutan !== 900).map((q: any) => q.id) : []) {
        const q = butir(k, id);
        const kalimat = JSON.stringify(q.jawaban);
        expect(kalimat, id).not.toContain("...");
      }
    }
  });

  it("perwalian: butir kerabat menggantikan versi bertitik-titik; kunci keadaan dipatuhi", () => {
    expect(butir(pw, "q-pw-hubungan-kerabat").menggantikan).toEqual(["q-pw-hubungan-kl"]);
    expect(butir(pw, "q-pw-orangtua-kerabat").menggantikan).toEqual(["q-pw-orangtua-kl"]);
    expect(butir(pw, "q-pw-kesanggupan-harta").keadaan).toMatchObject({ pemohonWali: "keluarga-lain", hartaAnak: "ada" });
    expect(pw.variabelBaru).toEqual(expect.arrayContaining(["4400", "4409"]));
  });

  it("susunan DK: pekerjaan/penghasilan hanya untuk anak perempuan; dua keluarga hanya bila calon juga di bawah umur", () => {
    (globalThis as any).window = globalThis;
    const Mesin = req(path.join(EKS, "saksi-katalog.js"));
    const aktif = (keadaan: Record<string, string>) => {
      const ids = new Set(Mesin.pertanyaanAktif(dk, { ...Mesin.keadaanBawaan(dk, {}), ...keadaan, pihakSaksi: "P" }, "P", { tingkat: ["inti", "pilihan", "tambahan", "jarang"] }).map((q: any) => q.id));
      return ids;
    };
    const pr = aktif({ jenisKelaminAnak: "perempuan" });
    const lk = aktif({ jenisKelaminAnak: "laki-laki" });
    expect(pr.has("q-dk-ekonomi-pr")).toBe(true);
    expect(lk.has("q-dk-ekonomi-lk")).toBe(false);
    expect(pr.has("q-dk-dua-keluarga-pr")).toBe(false);
    expect(aktif({ jenisKelaminAnak: "perempuan", calonJuga: "di-bawah-umur" }).has("q-dk-dua-keluarga-pr")).toBe(true);
    expect(pr.has("q-dk-kekerasan-pr")).toBe(true);
    expect(lk.has("q-dk-kekerasan-lk")).toBe(true);
  });
});

// jalankan skrip pembangun katalog supaya data ekstensi tidak ketinggalan (uji penjaga juga memeriksa ini)
describe("data ekstensi sinkron dengan katalog", () => {
  it("scripts/susun-saksi-katalog.mjs --stdout sama dengan saksi-katalog-data.js", () => {
    const harap = execFileSync(process.execPath, [path.join(REPO, "manajemen_surat/scripts/susun-saksi-katalog.mjs"), "--stdout"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).replace(/\r\n/g, "\n");
    const nyata = fs.readFileSync(path.join(REPO, "ekstensi-sipp", "saksi-katalog-data.js"), "utf8").replace(/\r\n/g, "\n");
    expect(nyata === harap).toBe(true);
  });
});
