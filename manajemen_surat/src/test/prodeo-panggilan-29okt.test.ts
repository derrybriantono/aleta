// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

/**
 * 29 Okt 2026 - paket ABT abt-paket/prodeo-panggilan-29okt (blangko Derry):
 *  1. perkara PRODEO: amar biaya tanpa nominal/terbilang ("Membebankan biaya perkara kepada negara, melalui DIPA ... Tahun ...;"),
 *     rincian biaya semua pos Rp 0,00 dan jumlah "(nihil)";
 *  2. tanggal panggilan di duduk perkara/pertimbangan = SEMUA tanggal relaas (dulu #1077# MIN + #0120# MAX: satu panggilan
 *     tercetak "tanggal A dan tanggal A").
 * Uji tanpa DB: keutuhan paket (MD5SUMS, isi timpa.tgz = md5 baru di daftar-timpa.tsv), SQL bersyarat (pasang/pulih), tanpa kata
 * aplikasi, MariaDB 5.5. Pembandingan atas data nyata, siklus pasang/pulih, dan render php56 ada di PASANG.md paket.
 */
const akar = path.resolve(process.cwd(), "..");
const dir = path.join(akar, "abt-paket/prodeo-panggilan-29okt");
const pk = (b: string) => path.join(dir, "paket-satker", b);
const N = "abt-prodeo-panggilan-29okt";
const baca = (b: string) => readFileSync(pk(b), "utf8");
const md5 = (s: string | Buffer) => createHash("md5").update(s).digest("hex");
const isi = JSON.parse(readFileSync(path.join(dir, "hasil/isi-paket.json"), "utf8")) as {
  variabel_baru: number[];
  variabel_ubah: Record<string, { md5_lama: string; md5_baru: string }>;
  berkas_ditimpa: number;
  varian_amar: Record<string, string>;
};
const nomorBaru = baca("nomor-baru.txt").split("\n").filter((l) => l && !l.startsWith("#")).map(Number);
const uji = new Map(
  baca("uji-kueri.tsv")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => [Number(l.split("\t")[0]), l.slice(l.indexOf("\t") + 1)] as const),
);

/** Teks berakhir NUL (ruas header tar). */
const tanpaNul = (b: Buffer) => b.toString("latin1").split("\0")[0];

/** Isi berkas tar (ustar/GNU, nama panjang lewat ././@LongLink) -> nama -> isi. */
function bacaTar(b: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  let i = 0;
  let namaPanjang: string | null = null;
  while (i + 512 <= b.length) {
    const h = b.subarray(i, i + 512);
    if (h.every((x) => x === 0)) break;
    const nama0 = tanpaNul(h.subarray(0, 100));
    const awalan = tanpaNul(h.subarray(345, 500));
    const ukuran = parseInt(tanpaNul(h.subarray(124, 136)).trim() || "0", 8);
    const tipe = String.fromCharCode(h[156]);
    const data = b.subarray(i + 512, i + 512 + ukuran);
    i += 512 + Math.ceil(ukuran / 512) * 512;
    if (tipe === "L") {
      namaPanjang = tanpaNul(data);
      continue;
    }
    const nama = namaPanjang ?? (awalan ? `${awalan}/${nama0}` : nama0);
    namaPanjang = null;
    if (tipe === "0" || tipe === "\0") out.set(nama, Buffer.from(data));
  }
  return out;
}

describe("paket ABT prodeo-panggilan-29okt", () => {
  it("MD5SUMS cocok dengan isi paket", () => {
    const baris = baca("MD5SUMS.txt").split("\n").filter(Boolean);
    expect(baris.length).toBeGreaterThanOrEqual(12);
    for (const b of baris) {
      const [h, f] = b.split(/\s+\*?/);
      expect(md5(readFileSync(pk(f))), f).toBe(h);
    }
  });

  it("timpa.tgz memuat persis berkas daftar-timpa.tsv dengan md5 baru, hanya di derry_briantono", () => {
    const daftar = baca("daftar-timpa.tsv").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
    expect(daftar.length).toBe(isi.berkas_ditimpa);
    const tar = bacaTar(gunzipSync(readFileSync(pk("timpa.tgz"))));
    expect(tar.size).toBe(daftar.length);
    for (const [folder, berkas, lama, baru] of daftar) {
      expect(folder.startsWith("derry_briantono/") || folder === "derry_briantono", folder).toBe(true);
      expect(lama).not.toBe(baru);
      const isiBerkas = tar.get(`timpa/${folder}/${berkas}`);
      expect(isiBerkas, berkas).toBeDefined();
      expect(md5(isiBerkas!), berkas).toBe(baru);
      expect(/aleta/i.test(isiBerkas!.toString("latin1")), berkas).toBe(false);
    }
  });

  it("variabel baru di blok 11120-11199 dan semuanya dipasang tanpa menimpa (WHERE NOT EXISTS) serta dipulihkan bersyarat md5", () => {
    expect(nomorBaru).toEqual(isi.variabel_baru);
    expect(nomorBaru.every((n) => n >= 11120 && n <= 11199)).toBe(true);
    const pasang = baca(`${N}-PASANG.sql`);
    const pulih = baca(`${N}-PULIH.sql`);
    for (const n of nomorBaru) {
      expect(pasang).toContain(`WHERE NOT EXISTS (SELECT 1 FROM aps_badilag.abt_variabel WHERE no_var = ${n});`);
      expect(pulih).toMatch(new RegExp(`DELETE FROM aps_badilag\\.abt_variabel WHERE no_var = ${n} AND MD5\\(`));
    }
    for (const [no, { md5_lama, md5_baru }] of Object.entries(isi.variabel_ubah)) {
      expect(pasang).toMatch(new RegExp(`WHERE no_var = ${no} AND MD5\\(sql_query\\) = '${md5_lama}';`));
      expect(pulih).toMatch(new RegExp(`WHERE no_var = ${no} AND MD5\\(sql_query\\) = '${md5_baru}';`));
    }
    expect(Object.keys(isi.variabel_ubah).sort()).toEqual(["3992", "5223", "8505", "8508", "8547", "8600"]);
    expect(pasang.trim().startsWith("--")).toBe(true);
    expect(pasang).toContain("START TRANSACTION;");
    expect(pasang.trim().endsWith("COMMIT;")).toBe(true);
  });

  it("tanpa kata aplikasi dan tanpa sintaks di luar MariaDB 5.5", () => {
    for (const f of [`${N}-PASANG.sql`, `${N}-PULIH.sql`, `${N}-FUNGSI.sql`, "uji-kueri.tsv", "daftar-timpa.tsv"]) {
      const s = baca(f);
      expect(/aleta/i.test(s), f).toBe(false);
      expect(/REGEXP_REPLACE|\bWITH\s+\w+\s+AS\s*\(|\bOVER\s*\(|JSON_|LATERAL/i.test(s), f).toBe(false);
    }
  });

  it("prodeo: amar tanpa nominal, rincian nol, jumlah (nihil)", () => {
    const prodeo = "IFNULL((SELECT prodeo FROM perkara WHERE perkara_id = '#perkara_id#'), 0) = 1";
    const amar = uji.get(11122)!;
    expect(amar).toContain(`IF(${prodeo}, "#8505#", CONCAT("#8505#", " (", aps_badilag.isian_rtf_terbilang('#0143#'), " rupiah)"))`);
    expect(uji.get(11123)).toContain(`IF(${prodeo}, 'nihil', CONCAT(aps_badilag.isian_rtf_terbilang('#0143#'), ' rupiah'))`);
    expect(uji.get(11124)).toContain("isian_rtf_terbilang('#1101#')");
    for (const [n, v] of [[11130, "0279"], [11131, "6060"], [11137, "5223"], [11140, "0143"], [11143, "1101"]] as const) {
      expect(uji.get(n), String(n)).toContain(`IF(${prodeo}, '0', '#${v}#')`);
    }
    // amar tertulis langsung (Membebankan/Menghukum, perdamaian #9354#, ikrar #1101#, verzet #3993#):
    // prodeo = teks #8505# (DIPA), selain itu kalimat blangko yang sama dengan nominal benar
    const varian = Object.entries(isi.varian_amar);
    expect(varian.length).toBeGreaterThanOrEqual(17);
    expect(varian.some(([, k]) => k.startsWith("Menghukum"))).toBe(true);
    expect(varian.some(([, k]) => k.includes("#9354#"))).toBe(true);
    expect(varian.some(([, k]) => k.includes("#3993#"))).toBe(true);
    for (const [no, kalimat] of varian) {
      const q = uji.get(Number(no))!;
      // prodeo = teks #8505# (verzet: teks yang sama ditulis langsung - #8505# menghitung #5223# yang GALAT pada perkara verzet)
      const dipa = /#3993#,00/.test(kalimat) ? '"Membebankan biaya perkara kepada DIPA #8008# Tahun #0191#"' : '"#8505#"';
      expect(q.startsWith(`SELECT IF(${prodeo}, ${dipa}, `), no).toBe(true);
      const awal = kalimat.slice(0, kalimat.search(/#(0143|8504|1101|3993)#,00/));
      if (/#1101#,00/.test(kalimat)) {
        // penetapan ikrar: bunyi keputusan 30 Okt butir 4 (sama dengan amar ikrar ALETA di SIPP dan kutipan BAS ikrar)
        expect(q).toContain(`"Membebankan biaya perkara kepada ", IF('#0046#' = '', 'DATA_TIDAK_ADA', '#0046#'), " sejumlah Rp"`);
        expect(q).toContain("IF('#1101#' + 0 = 0, CONCAT(\"Membebankan biaya perkara kepada \"");
        expect(q).not.toContain("biaya penetapan");
      } else {
        // potongan teks harfiah kalimat blangko (sebutan #NNNN# disulih "..." bila kosong, seperti ABT dulu)
        for (const bagian of awal.split(/#\d{4}#/)) expect(q, no).toContain(bagian);
      }
      // isian perdamaian dibaca dari kolomnya, tidak disisipkan sebagai teks ke dalam kueri
      expect(q).not.toContain("#9354#");
      // #8504# dan #3993# dipakai apa adanya ('290.000'), bukan dicetak ulang ABT ("Rp290,00")
      if (/#8504#,00/.test(kalimat)) expect(q).toContain(`", '#8504#', ",00 (`);
    }
    // nomor varian TETAP (paket BAS lain dibangun di atas RTF paket ini)
    const tetap = readFileSync(path.join(dir, "sumber/varian-nomor.tsv"), "utf8").split("\n").filter((l) => l && !l.startsWith("#"));
    for (const l of tetap) {
      const [no, k] = l.split("\t");
      expect(isi.varian_amar[no], no).toBe(k);
    }
    // biaya nol (ikrar, verzet): tetap dibebankan, tanpa "sejumlah Rp0,00 ( rupiah)"; rincian nol = (nihil)
    expect(uji.get(11124)).toContain("OR '#1101#' + 0 = 0, 'nihil'");
    expect(uji.get(11145)).toContain("OR '#3992#' = '0', 'nihil'");
  });

  it("8505 prodeo: 'Membebankan biaya perkara kepada DIPA <satker> Tahun <tahun pendaftaran>'; verzet 3992 otomatis dari SIPP", () => {
    expect(Object.keys(isi.variabel_ubah).sort()).toEqual(["3992", "5223", "8505", "8508", "8547", "8600"]);
    const v8505 = uji.get(8505)!;
    expect(v8505).toContain('THEN "Membebankan biaya perkara kepada DIPA #8008# Tahun #0191#"');
    expect(v8505).not.toContain("negara");
    const v3992 = uji.get(3992)!;
    expect(v3992).toContain("JOIN perkara_verzet v ON v.perkara_id = b.perkara_id");
    expect(v3992).toContain("jb.jenis_transaksi = -1 AND b.jenis_biaya_id <> 151");
    expect(v3992).toContain("b.tanggal_transaksi >= v.tanggal_pendaftaran_verzet");
    expect(v3992).toContain("no_var = 3991"); // isian tetap didahulukan
    // meterai rincian putusan = baris meterai PERTAMA (perkara verzet punya dua baris: dulu subkueri GALAT dan cetakan berhenti)
    expect(uji.get(5223)).toContain("WHERE jenis_biaya_id = 152 AND perkara_id = #perkara_id# ORDER BY tanggal_transaksi, id LIMIT 1)");
  });

  it("tanggal panggilan: semua tanggal relaas berbeda, urut, A / A dan B / A, B, dan C", () => {
    for (const [n, tabel] of [[11120, "perkara_pihak1"], [11121, "perkara_pihak2"]] as const) {
      const q = uji.get(n)!;
      expect(q).toContain(`JOIN ${tabel} p ON p.perkara_id = r.perkara_id AND p.pihak_id = r.pihak_id`);
      expect(q).toContain("SELECT DISTINCT DATE(r.tanggal_relaas) AS t");
      expect(q).toContain("GROUP_CONCAT(aps_badilag.isian_rtf_tanggal(d.t) ORDER BY d.t SEPARATOR ', ')");
      expect(q).toContain("IF(x.n = 2, ' dan ', ', dan ')");
      expect(q).toContain("IFNULL(j.ikrar_talak, 'T') <> 'Y'");
      expect(q).not.toMatch(/LIMIT/);
    }
    const v8508 = uji.get(8508)!;
    expect(v8508).toContain("tanggal #11121#");
    expect(v8508).not.toContain("#1077# dan tanggal #0120#");
    const v8547 = uji.get(8547)!;
    expect(v8547.split("pada tanggal #11120#").length - 1).toBe(2);
    expect(v8547.split("pada tanggal #11121#").length - 1).toBe(1);
    expect(uji.get(8600)).toBe("SELECT IF('#11120#' = '...', '', CONCAT(', pada tanggal ', '#11120#')) AS data");
  });

  it("fungsi terbilang tanpa SQL, bulat 12 s.d. 999.999.999 (seperti TemplateHelper::Terbilang ABT)", () => {
    const f = baca(`${N}-FUNGSI.sql`);
    expect(f).toContain("CREATE FUNCTION aps_badilag.isian_rtf_terbilang(n DECIMAL(20,2))");
    expect(f).toContain("NO SQL");
    expect(f).toContain("IF n IS NULL OR n < 12 OR n >= 1000000000 THEN");
    expect(f).toContain("'seribu'");
    expect(baca(`${N}-FUNGSI-PULIH.sql`)).toContain("DROP FUNCTION IF EXISTS aps_badilag.isian_rtf_terbilang;");
  });
});
