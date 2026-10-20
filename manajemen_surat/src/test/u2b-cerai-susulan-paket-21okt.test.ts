// @vitest-environment node
/**
 * ============================================================================
 * AGEN W2b-U2b (21 Okt 2026) - PAKET SUSULAN ABT "u2b-cerai-susulan"
 * ============================================================================
 *
 * Menambal 12 blangko BAS (folder ALUR 02/03/06) yang tidak masuk paket u2-putusan-cerai-lengkap, dan mencatat 31 baris LEWAT paket u2.
 *
 * Dijaga:
 *   1. isi paket: MD5SUMS cocok, prasyarat hanya SELECT, tanpa kata ALETA di SQL/tsv/skrip perl/tambalan, hanya variabel 4138 yang disisipkan dan variabel itu
 *      ada di katalog u2 (data/variabel.json), 12 tambalan terdaftar, 31 baris u2 tercatat dengan keadaan;
 *   2. perilaku skrip tambal-rtf.pl (perl) pada pohon tiruan: periksa tidak menulis, pasang = cadangan + md5 hasil, ulang = SUDAH (idempoten),
 *      pulih = md5 awal, berkas yang md5-nya beda DILEWATI dan tidak disentuh (penjaga md5), pulih tidak menimpa berkas yang disunting sesudahnya;
 *   3. pasang-satker.sh / pulih-satker.sh (ABT_LOKAL=1) : satu berkas beda md5 = GAGAL sebelum menulis apa pun;
 *   4. atas RTF NYATA dari server bila salinannya ada di laptop: hasil tambal bermd5 persis yang tercatat, kurung RTF seimbang, token #nnnn# utuh
 *      (hanya bertambah satu #4138#), sama persis dengan salinan yang sudah ditambal paket u2, lalu pulih mengembalikan md5 awal.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO = path.resolve(process.cwd(), "..");
const PAKET = path.join(REPO, "abt-paket/u2b-cerai-susulan");
const SATKER = path.join(PAKET, "paket-satker");
const U2 = path.join(REPO, "abt-paket/u2-putusan-cerai-lengkap");
const md5 = (b: Buffer | string) => createHash("md5").update(b).digest("hex");
const baca = (n: string) => readFileSync(path.join(SATKER, n), "utf8");
const dekode = (b: string) => Buffer.from(b, "base64").toString("latin1");

const daftar = baca("rtf-daftar-tambal.tsv").trim().split("\n").map((l) => l.split("\t"));
const tsv = baca("rtf-tambal.tsv").trim().split("\n").map((l) => l.split("\t"));
const tidak = readFileSync(path.join(PAKET, "data/tidak-ditambal.tsv"), "utf8").trim().split("\n").map((l) => l.split("\t"));

describe("isi paket", () => {
  it("MD5SUMS cocok dengan isi berkas paket-satker", () => {
    const baris = baca("MD5SUMS.txt").trim().split("\n");
    expect(baris.map((l) => l.slice(34)).sort()).toEqual(["abt-u2b-PRASYARAT.sql", "pasang-satker.sh", "pulih-satker.sh", "rtf-daftar-tambal.tsv", "rtf-tambal.tsv", "tambal-rtf.pl"]);
    for (const l of baris) expect(md5(readFileSync(path.join(SATKER, l.slice(34)))), l.slice(34)).toBe(l.slice(0, 32));
  });

  it("prasyarat hanya SELECT dan menjawab 35|1|1; tidak ada SQL penulis (paket ini tidak mengubah variabel)", () => {
    const sql = baca("abt-u2b-PRASYARAT.sql");
    expect(sql).toContain("BETWEEN 4100 AND 4150");
    expect(sql).toContain("harus menjawab 35|1|1");
    expect(sql.replace(/^--.*$/gm, "")).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|REPLACE|CREATE)\b/i);
    expect(readdirSync(SATKER).filter((n) => /\.sql$/.test(n))).toEqual(["abt-u2b-PRASYARAT.sql"]);
    expect(baca("pasang-satker.sh")).toContain('"35|1|1"');
  });

  it("tanpa kata ALETA di SQL, tsv, skrip perl dan tambalan (hanya nama kontainer docker dan variabel sandi di skrip pasang)", () => {
    for (const n of ["abt-u2b-PRASYARAT.sql", "rtf-daftar-tambal.tsv", "tambal-rtf.pl", "pulih-satker.sh"]) expect(baca(n), n).not.toMatch(/aleta/i);
    for (const [rel, , , lama, baru] of tsv) expect(`${dekode(rel)} ${dekode(lama)} ${dekode(baru)}`).not.toMatch(/aleta/i);
    const pasang = baca("pasang-satker.sh");
    expect(pasang.replace(/aleta-bot/g, "").replace(/ALETA_BOT_DB_SIPP_PASSWORD/g, "")).not.toMatch(/aleta/i);
  });

  it("12 tambalan: hanya #8505# -> #4138##8505# (variabel 4138 ada di katalog u2); md5 lama/baru berformat md5; jalur di folder ALUR", () => {
    expect(daftar.length).toBe(12);
    const kat = JSON.parse(readFileSync(path.join(U2, "data/variabel.json"), "utf8")) as Array<{ no: number; tipe: string }>;
    const ada = new Set(kat.map((x) => x.no));
    expect(ada.size).toBe(35);
    expect(tsv.length).toBe(12);
    const rujukan = new Set<number>();
    for (const [rel, urut, jumlah, lama, baru] of tsv) {
      expect(urut).toBe("1");
      expect(jumlah).toBe("1");
      expect(dekode(lama)).toBe("#8505#");
      expect(dekode(baru)).toBe("#4138##8505#");
      for (const m of dekode(baru).matchAll(/#(\d{4})#/g)) if (Number(m[1]) >= 4100 && Number(m[1]) <= 4150) rujukan.add(Number(m[1]));
      expect(dekode(rel)).toMatch(/^ALUR 0[236] [^/]+\/\[[23][abc]?\] BAS /);
    }
    expect([...rujukan]).toEqual([4138]);
    for (const n of rujukan) expect(ada.has(n), `${n}`).toBe(true);
    daftar.forEach(([kode, rel, m0, m1, n], i) => {
      expect(kode).toBe(`S${String(i + 1).padStart(3, "0")}`);
      expect(m0).toMatch(/^[0-9a-f]{32}$/);
      expect(m1).toMatch(/^[0-9a-f]{32}$/);
      expect(m0).not.toBe(m1);
      expect(n).toBe("1");
      expect(rel).toContain("ALUR");
    });
  });

  it("31 baris LEWAT paket u2 tercatat: 28 dipindah/diganti (sudah ditambal u2), 3 ikrar [2a] tidak ditambal dengan alasan; jalur cocok dengan daftar u2", () => {
    expect(tidak.length).toBe(31);
    const u2 = new Map(readFileSync(path.join(U2, "paket-satker/rtf-daftar-tambal.tsv"), "utf8").trim().split("\n").map((l) => l.split("\t")).map((c) => [c[0], c[1]] as [string, string]));
    const hitung = new Map<string, number>();
    for (const [kode, status, rel, , ket] of tidak) {
      expect(u2.get(kode), kode).toBe(rel);
      hitung.set(status, (hitung.get(status) || 0) + 1);
      expect(ket.length, kode).toBeGreaterThan(20);
      expect(`${rel} ${ket}`).not.toMatch(/aleta/i);
    }
    expect(Object.fromEntries(hitung)).toEqual({ DIPINDAH: 26, DIGANTI: 2, "TIDAK ADA": 1, "TIDAK DITAMBAL": 2 });
    expect(tidak.filter((t) => /Ikrar Talak/.test(t[2])).map((t) => t[0])).toEqual(["T055", "T089", "T102"]);
    for (const t of tidak.filter((x) => x[1] === "DIPINDAH")) expect(t[4]).toContain("sudah memuat #4138#");
  });
});

// ---- perilaku skrip -----------------------------------------------------------------------------------------------------------
const perl = spawnSync("perl", ["-e", "use MIME::Base64; print 1"], { encoding: "utf8" });
const md5sum = spawnSync("md5sum", ["--version"], { encoding: "utf8" });
const bash = spawnSync("bash", ["-c", "echo ok"], { encoding: "utf8" });
const bisaPerl = perl.status === 0 && md5sum.status === 0;
const bisaBash = bisaPerl && bash.status === 0 && bash.stdout.trim() === "ok";
const TMP = process.env.TMP || tmpdir();
const slash = (p: string) => p.replace(/\\/g, "/");

/** Pohon tiruan: tiap berkas RTF kecil berisi #8505# tepat sekali; paket disalin dan daftar md5-nya ditulis ulang agar cocok dengan pohon tiruan. */
function siapkan() {
  const tmp = mkdtempSync(path.join(TMP, "u2b-uji-"));
  const B = path.join(tmp, "derry_briantono");
  const P = path.join(tmp, "paket");
  mkdirSync(P, { recursive: true });
  for (const n of readdirSync(SATKER)) copyFileSync(path.join(SATKER, n), path.join(P, n));
  const baris: string[] = [];
  const awal = new Map<string, string>();
  daftar.forEach(([kode, rel], i) => {
    const isi = `{\\rtf1 Mengadili: 1. Menyatakan #0047# tidak hadir; 2. #4001#; ${i + 1}. #8505# (#0155# #7095#). Selanjutnya #4004# menutup sidang}`;
    const baru = isi.replace("#8505#", "#4138##8505#");
    const p = path.join(B, rel);
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, Buffer.from(isi, "latin1"));
    awal.set(rel, isi);
    baris.push([kode, rel, md5(Buffer.from(isi, "latin1")), md5(Buffer.from(baru, "latin1")), "1"].join("\t"));
  });
  writeFileSync(path.join(P, "rtf-daftar-tambal.tsv"), baris.join("\n") + "\n");
  // MD5SUMS ikut dihitung ulang (paket tiruan yang utuh)
  const sums = readdirSync(P).filter((n) => n !== "MD5SUMS.txt").sort().map((n) => `${md5(readFileSync(path.join(P, n)))} *${n}`);
  writeFileSync(path.join(P, "MD5SUMS.txt"), sums.join("\n") + "\n");
  const dp = baris.map((l) => l.split("	"));
  return { tmp, B, P, C: path.join(P, "cadangan"), awal, dp };
}
const perlJalan = (P: string, mode: string, B: string, C: string) => spawnSync("perl", ["tambal-rtf.pl", mode, slash(B), slash(C)], { encoding: "utf8", cwd: P });
const semuaBerkas = (B: string) => new Map(daftar.map(([, rel]) => [rel, readFileSync(path.join(B, rel), "latin1")] as [string, string]));

describe.skipIf(!bisaPerl)("tambal-rtf.pl (perl) pada pohon tiruan", () => {
  it("periksa tidak menulis; pasang membuat cadangan utuh dan md5 hasil cocok; ulang = SUDAH; pulih = isi awal", () => {
    const { tmp, B, P, C, awal, dp } = siapkan();
    try {
      const r0 = perlJalan(P, "periksa", B, C);
      expect(r0.stdout).toMatch(/RINGKAS COCOK=12 SUDAH=0 LEWAT=0/);
      expect(existsSync(C)).toBe(false);
      for (const [rel, isi] of semuaBerkas(B)) expect(isi).toBe(awal.get(rel));
      const r1 = perlJalan(P, "pasang", B, C);
      expect(r1.status).toBe(0);
      expect(r1.stdout).toMatch(/RINGKAS DITAMBAL=12 SUDAH=0 LEWAT=0/);
      expect(readdirSync(path.join(C, "rtf-lama")).length).toBe(12);
      dp.forEach(([kode, rel, m0, m1]) => {
        expect(md5(readFileSync(path.join(B, rel)))).toBe(m1);
        expect(md5(readFileSync(path.join(C, "rtf-lama", `${kode}.rtf`)))).toBe(m0);
        expect(readFileSync(path.join(B, rel), "latin1")).toContain("#4138##8505#");
      });
      expect(perlJalan(P, "periksa", B, C).stdout).toMatch(/RINGKAS COCOK=0 SUDAH=12 LEWAT=0/);
      // pasang ulang ditolak (cadangan lama tidak ditimpa)
      expect(perlJalan(P, "pasang", B, C).status).not.toBe(0);
      const r3 = perlJalan(P, "pulih", B, C);
      expect(r3.stdout).toMatch(/RINGKAS PULIH=12 DILEWATI=0/);
      for (const [rel, isi] of semuaBerkas(B)) expect(isi).toBe(awal.get(rel));
      expect(perlJalan(P, "periksa", B, C).stdout).toMatch(/RINGKAS COCOK=12 SUDAH=0 LEWAT=0/);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("penjaga md5: berkas yang md5-nya beda DILEWATI dan tidak disentuh, tanpa cadangan untuknya; berkas lain tetap ditambal", () => {
    const { tmp, B, P, C, awal } = siapkan();
    try {
      const rel = daftar[4][1];
      const beda = awal.get(rel) + " "; // satu spasi tambahan: jangkar masih cocok tetapi md5 bukan yang diperiksa
      writeFileSync(path.join(B, rel), Buffer.from(beda, "latin1"));
      const r = perlJalan(P, "pasang", B, C);
      expect(r.stdout).toMatch(/LEWAT\tS005\tmd5 server [0-9a-f]{32} beda dari yang diperiksa/);
      expect(r.stdout).toMatch(/RINGKAS DITAMBAL=11 SUDAH=0 LEWAT=1/);
      expect(readFileSync(path.join(B, rel), "latin1")).toBe(beda);
      expect(existsSync(path.join(C, "rtf-lama", "S005.rtf"))).toBe(false);
      // berkas hilang dan berkas tanpa jangkar juga dilewati
      rmSync(path.join(B, daftar[0][1]));
      writeFileSync(path.join(B, daftar[1][1]), "{\\rtf1 isi lain}");
      const r2 = perlJalan(P, "periksa", B, path.join(tmp, "c2"));
      expect(r2.stdout).toMatch(/LEWAT\tS001\ttidak ada/);
      expect(r2.stdout).toMatch(/LEWAT\tS002\tmd5 server/);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("pulih hanya mengembalikan berkas yang md5-nya masih persis hasil paket (yang disunting sesudahnya dibiarkan)", () => {
    const { tmp, B, P, C, awal } = siapkan();
    try {
      expect(perlJalan(P, "pasang", B, C).status).toBe(0);
      const rel = daftar[2][1];
      const sunting = readFileSync(path.join(B, rel), "latin1") + " disunting";
      writeFileSync(path.join(B, rel), Buffer.from(sunting, "latin1"));
      const r = perlJalan(P, "pulih", B, C);
      expect(r.stdout).toMatch(/RINGKAS PULIH=11 DILEWATI=1/);
      expect(readFileSync(path.join(B, rel), "latin1")).toBe(sunting);
      for (const [r2, isi] of semuaBerkas(B)) if (r2 !== rel) expect(isi).toBe(awal.get(r2));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe.skipIf(!bisaBash)("pasang-satker.sh / pulih-satker.sh (ABT_LOKAL=1)", () => {
  const jalan = (P: string, B: string, skrip: string) =>
    spawnSync("bash", [skrip], { encoding: "utf8", cwd: P, env: { ...process.env, ABT_LOKAL: "1", ABT_BLANGKO: slash(B), TMPDIR: slash(TMP) } });

  it("pasang lengkap -> SELESAI; diulang ditolak; pulih -> isi awal; md5 paket rusak ditolak sebelum apa pun", () => {
    const { tmp, B, P, awal } = siapkan();
    try {
      const r = jalan(P, B, "pasang-satker.sh");
      expect(r.stdout).toMatch(/RINGKAS COCOK=12 SUDAH=0 LEWAT=0/);
      expect(r.stdout).toMatch(/RINGKAS DITAMBAL=12 SUDAH=0 LEWAT=0/);
      expect(r.stdout).toMatch(/RINGKAS COCOK=0 SUDAH=12 LEWAT=0/);
      expect(r.stdout).toMatch(/SELESAI - paket u2b-cerai-susulan terpasang \(12 berkas\)/);
      expect(r.status).toBe(0);
      const lagi = jalan(P, B, "pasang-satker.sh");
      expect(lagi.stdout).toMatch(/GAGAL: paket ini sudah pernah dipasang/);
      const p = jalan(P, B, "pulih-satker.sh");
      expect(p.stdout).toMatch(/RINGKAS PULIH=12 DILEWATI=0/);
      expect(p.stdout).toMatch(/SELESAI - dipulihkan/);
      for (const [rel, isi] of semuaBerkas(B)) expect(isi).toBe(awal.get(rel));
      // paket rusak (tsv diubah) -> ditolak
      writeFileSync(path.join(P, "rtf-tambal.tsv"), readFileSync(path.join(P, "rtf-tambal.tsv"), "utf8") + "\n");
      const rusak = jalan(P, B, "pasang-satker.sh");
      expect(rusak.stdout).toMatch(/GAGAL: berkas paket rusak/);
      for (const [rel, isi] of semuaBerkas(B)) expect(isi).toBe(awal.get(rel));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("satu berkas beda md5 = GAGAL sebelum menulis apa pun (tidak ada berkas lain yang berubah, tidak ada cadangan)", () => {
    const { tmp, B, P, C, awal } = siapkan();
    try {
      const rel = daftar[7][1];
      const beda = awal.get(rel) + "\r\n";
      writeFileSync(path.join(B, rel), Buffer.from(beda, "latin1"));
      const r = jalan(P, B, "pasang-satker.sh");
      expect(r.stdout).toMatch(/GAGAL: praperiksa 'RINGKAS COCOK=11 SUDAH=0 LEWAT=1'/);
      expect(r.status).not.toBe(0);
      for (const [r2, isi] of semuaBerkas(B)) expect(isi).toBe(r2 === rel ? beda : awal.get(r2));
      expect(existsSync(path.join(C, "rtf-lama"))).toBe(false);
      expect(existsSync(path.join(C, "pasang.selesai"))).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ---- atas RTF nyata dari server (bila salinannya ada di laptop) ---------------------------------------------------------------
const POHON = "D:/aleta-dev/kerja/u2b-asli-server";
const adaPohon = existsSync(POHON) && daftar.every(([, rel, m0]) => existsSync(path.join(POHON, rel)) && md5(readFileSync(path.join(POHON, rel))) === m0);
const seimbang = (r: string) => {
  const s = r.replace(/\\\\/g, "").replace(/\\\{/g, "").replace(/\\\}/g, "");
  return s.split("{").length - s.split("}").length;
};
const token = (r: string) => {
  const h = new Map<string, number>();
  for (const m of r.matchAll(/#\d{4}#/g)) h.set(m[0], (h.get(m[0]) || 0) + 1);
  return h;
};

describe.skipIf(!(bisaPerl && adaPohon))("atas 12 RTF nyata dari server (md5 persis yang diperiksa)", () => {
  it("hasil tambal: md5 persis yang tercatat, kurung seimbang, token #nnnn# utuh (hanya +1 #4138#), sama dengan salinan yang sudah ditambal paket u2", () => {
    const tmp = mkdtempSync(path.join(TMP, "u2b-nyata-"));
    try {
      const B = path.join(tmp, "derry");
      for (const [, rel] of daftar) {
        mkdirSync(path.dirname(path.join(B, rel)), { recursive: true });
        copyFileSync(path.join(POHON, rel), path.join(B, rel));
      }
      const C = path.join(tmp, "cad");
      const r = spawnSync("perl", ["tambal-rtf.pl", "pasang", slash(B), slash(C)], { encoding: "utf8", cwd: SATKER });
      expect(r.status).toBe(0);
      expect(r.stdout).toMatch(/RINGKAS DITAMBAL=12 SUDAH=0 LEWAT=0/);
      for (const [kode, rel, m0, m1] of daftar) {
        const asli = readFileSync(path.join(POHON, rel), "latin1");
        const baru = readFileSync(path.join(B, rel), "latin1");
        expect(md5(Buffer.from(baru, "latin1")), kode).toBe(m1);
        expect(seimbang(baru), kode).toBe(seimbang(asli));
        expect(seimbang(baru), kode).toBe(0);
        const ta = token(asli);
        const tb = token(baru);
        ta.set("#4138#", (ta.get("#4138#") || 0) + 1);
        expect([...tb].sort(), kode).toEqual([...ta].sort());
        expect(baru.replace("#4138##8505#", "#8505#"), kode).toBe(asli);
        expect(md5(readFileSync(path.join(C, "rtf-lama", `${kode}.rtf`))), kode).toBe(m0);
        // salinan pasangan di folder "<jenis> - BAS" yang sudah ditambal paket u2: hasilnya sama persis
        const nama = rel.split("/")[1];
        for (const folder of ["1 Perceraian CG - BAS", "1a Perceraian CT - BAS"]) {
          const kembar = path.join(POHON, folder, "BAS ALUR " + rel.split("/")[0].split(" ")[1] + " " + nama);
          if (existsSync(kembar)) expect(md5(readFileSync(kembar)), `${kode} ${folder}`).toBe(m1);
        }
      }
      expect(spawnSync("perl", ["tambal-rtf.pl", "pulih", slash(B), slash(C)], { encoding: "utf8", cwd: SATKER }).stdout).toMatch(/RINGKAS PULIH=12 DILEWATI=0/);
      for (const [, rel, m0] of daftar) expect(md5(readFileSync(path.join(B, rel)))).toBe(m0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("pohon nyata: aturan u2 pada seluruh folder perceraian server tidak menyisakan berkas kabul yang belum bertambal selain 12 ini (data/pohon-asli-md5.tsv memuat md5-nya)", () => {
    const md5s = readFileSync(path.join(PAKET, "data/pohon-asli-md5.tsv"), "utf8").trim().split("\n");
    expect(md5s.length).toBeGreaterThan(300);
    for (const [, rel, m0] of daftar) expect(md5s).toContain(`${m0}\t${rel}`);
    expect(statSync(POHON).isDirectory()).toBe(true);
  });
});
