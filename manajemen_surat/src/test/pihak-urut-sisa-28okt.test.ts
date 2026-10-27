// @vitest-environment node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 28 Okt 2026 - sisa variabel Derry yang memilih pihak dengan `urutan = N` tetap (perkara e-Court menomori urutan bersambung lintas tabel, jadi Tergugat
 * pertama bisa berurutan 25). Paket abt-paket/pihak-urut-sisa-28okt menggantinya dengan PERINGKAT ke-N (urut urutan, id) lewat satu fungsi baru
 * isian_rtf_pihak_peringkat; perkara yang urutannya mulai 1 dan rapat keluarannya SAMA PERSIS. Uji ini menjaga isi paket di repo (tanpa DB);
 * pembandingan lama/baru atas perkara nyata, uji bolak-balik pasang/pulih dan render ada di PASANG.md paket.
 */
const akar = path.resolve(process.cwd(), "..");
const dir = path.join(akar, "abt-paket/pihak-urut-sisa-28okt");
const dir27 = path.join(akar, "abt-paket/pihak-urut-ecourt-27okt");
const pk = (b: string) => path.join(dir, "paket-satker", b);
const N = "abt-pihak-urut-sisa-28okt";
const baca = (b: string) => readFileSync(pk(b), "utf8");
const md5 = (s: string | Buffer) => createHash("md5").update(s).digest("hex");

const ring = JSON.parse(readFileSync(path.join(dir, "hasil/isi-paket.json"), "utf8")) as {
  ubah: { no: number; lama_md5: string; baru_md5: string; diganti: number; inline: number }[];
  fungsi: { nama: string; md5: string };
  dependensi: number[];
  harap: string;
  ulang: string;
  dilewati_27: number[];
  prasyarat_27: { variabel: Record<string, string>; fungsi: Record<string, string> };
  jumlah_penggantian: number;
};
const ring27 = JSON.parse(readFileSync(path.join(dir27, "hasil/isi-paket.json"), "utf8")) as {
  ubah: { no: number; baru_md5: string }[];
  fungsi_baru: Record<string, string>;
  fungsi_x9: Record<string, { baru_md5: string }>;
};

function hexTerurai(sql: string): string[] {
  return [...sql.matchAll(/0x([0-9a-f]+)/g)].map((m) => Buffer.from(m[1], "hex").toString("latin1"));
}
/** kueri BARU tiap variabel yang diubah, dibaca dari PASANG.sql */
function kueriBaru(): Map<number, string> {
  const peta = new Map<number, string>();
  const pasang = baca(`${N}-PASANG.sql`);
  for (const m of pasang.matchAll(/UPDATE abt_variabel SET sql_query=0x([0-9a-f]+), modified='[^']*' WHERE \(no_var=(\d+) /g)) {
    peta.set(Number(m[2]), Buffer.from(m[1], "hex").toString("latin1"));
  }
  return peta;
}
const baru = kueriBaru();

describe("pihak-urut-sisa - berkas paket utuh", () => {
  it("MD5SUMS.txt cocok dengan isi paket-satker (dan memuat setiap berkas paket)", () => {
    const baris = baca("MD5SUMS.txt").trim().split("\n");
    expect(baris.length).toBeGreaterThanOrEqual(13);
    const nama = new Set<string>();
    for (const b of baris) {
      const [m, n] = b.split(/\s+/);
      nama.add(n);
      expect(md5(readFileSync(pk(n))), n).toBe(m);
    }
    for (const wajib of ["FUNGSI", "PASANG", "PERIKSA", "PRASYARAT", "PULIH", "UJIVAR", "UJIVAR-BERAT"]) expect(nama.has(`${N}-${wajib}.sql`), wajib).toBe(true);
    for (const wajib of ["pasang-satker.sh", "pulih-satker.sh", "harap.txt", "nomor-ubah.txt", "nama-fungsi.txt", "perkara-uji.txt"]) expect(nama.has(wajib), wajib).toBe(true);
  });

  it("semua SQL paket ASCII dan, termasuk literal heksadesimal, tanpa kata aplikasi (tidak boleh masuk ABT)", () => {
    for (const b of ["FUNGSI", "PRASYARAT", "PASANG", "PERIKSA", "PULIH", "UJIVAR", "UJIVAR-BERAT"]) {
      const sql = baca(`${N}-${b}.sql`);
      expect(sql, b).not.toMatch(/[^\x09\x0a\x0d\x20-\x7e]/);
      expect(sql.toLowerCase(), b).not.toContain("aleta");
      for (const t of hexTerurai(sql)) expect(t.toLowerCase(), `${b} hex`).not.toContain("aleta");
    }
    // kueri baru yang akan tertulis di ABT juga bersih
    for (const [no, q] of baru) expect(q.toLowerCase(), `kueri ${no}`).not.toContain("aleta");
  });

  it("FUNGSI.sql = sumber/templat-fungsi.sql; satu fungsi berkomentar 'PS:'; tanpa komentar -- di badan (klien mysql membuangnya, md5 definisi berubah)", () => {
    const fungsi = baca(`${N}-FUNGSI.sql`);
    expect(fungsi).toBe(readFileSync(path.join(dir, "sumber/templat-fungsi.sql"), "utf8"));
    expect(fungsi).not.toMatch(/PREPARE|EXECUTE|REGEXP_REPLACE/i);
    const badan = fungsi.slice(fungsi.indexOf("DELIMITER $$"));
    expect(badan.split("\n").filter((l) => /--/.test(l))).toEqual([]);
    expect(baca("nama-fungsi.txt").trim()).toBe("isian_rtf_pihak_peringkat");
    expect(ring.fungsi.nama).toBe("isian_rtf_pihak_peringkat");
    expect(fungsi).toContain("DROP FUNCTION IF EXISTS isian_rtf_pihak_peringkat$$");
    expect(fungsi).toMatch(/CREATE FUNCTION isian_rtf_pihak_peringkat\(p_tabel INT, p_id BIGINT\) RETURNS INT[^]*?COMMENT 'PS: /);
    expect(fungsi.match(/CREATE FUNCTION/g)).toHaveLength(1);
    const m = fungsi.match(/\nBEGIN\n([^]*?)\nEND\$\$/)!;
    expect(md5("BEGIN\n" + m[1] + "\nEND")).toBe(ring.fungsi.md5);
  });

  it("fungsi peringkat: urut urutan lalu id, NULL dianggap 0, empat tabel pihak, hanya membaca SIPP, tidak menyentuh data", () => {
    const f = baca(`${N}-FUNGSI.sql`);
    for (const t of [1, 2, 3, 4]) {
      expect(f).toContain(`FROM SIPP.perkara_pihak${t} WHERE id = p_id;`);
      expect(f).toContain(`FROM SIPP.perkara_pihak${t} WHERE perkara_id = v_perkara AND (IFNULL(urutan, 0) < v_urutan OR (IFNULL(urutan, 0) = v_urutan AND id < p_id));`);
    }
    expect(f).toContain("RETURN v_n + 1;");
    expect(f).toContain("READS SQL DATA");
    expect(f).not.toMatch(/\b(INSERT|UPDATE|DELETE|REPLACE|DROP TABLE|TRUNCATE)\b(?!.*FUNCTION)/i);
  });

  it("angka PRASYARAT di harap.txt = yang tertulis di PRASYARAT.sql dan di isi-paket.json", () => {
    const [harap, ulang] = baca("harap.txt").trim().split("\n");
    const pra = baca(`${N}-PRASYARAT.sql`);
    expect(pra).toContain(`"${harap}" (pertama) atau "${ulang}" (pasang ulang)`);
    expect(harap).toBe(ring.harap);
    expect(ulang).toBe(ring.ulang);
    const ju = ring.ubah.length;
    expect(harap).toBe(`9|14|${ju}|0|0|${ring.dependensi.length}|0`);
    expect(ulang).toBe(`9|14|0|${ju}|1|${ring.dependensi.length}|0`);
    expect(baca("nomor-ubah.txt").trim()).toBe(ring.ubah.map((u) => u.no).join(","));
  });
});

describe("pihak-urut-sisa - hanya variabel Derry, tiap baris punya PRASYARAT, PASANG, PERIKSA, PULIH", () => {
  const pra = baca(`${N}-PRASYARAT.sql`);
  const pasang = baca(`${N}-PASANG.sql`);
  const periksa = baca(`${N}-PERIKSA.sql`);
  const pulih = baca(`${N}-PULIH.sql`);

  it("setiap variabel diganti ada di keempat berkas, dijaga md5 isi lama dan nama; PULIH hanya bila masih isi baru", () => {
    expect(ring.ubah.length).toBeGreaterThan(70);
    expect(baru.size).toBe(ring.ubah.length);
    expect(pasang.match(/^UPDATE abt_variabel/gm)).toHaveLength(ring.ubah.length);
    for (const u of ring.ubah) {
      expect(baru.has(u.no), `PASANG ${u.no}`).toBe(true);
      expect(md5(Buffer.from(baru.get(u.no)!, "latin1")), `md5 baru ${u.no}`).toBe(u.baru_md5);
      expect(u.lama_md5).not.toBe(u.baru_md5);
      expect(pra, `PRASYARAT ${u.no}`).toContain(`(no_var=${u.no} AND MD5(nama)=`);
      expect(pra, `PRASYARAT lama ${u.no}`).toContain(u.lama_md5);
      expect(pra, `PRASYARAT baru ${u.no}`).toContain(u.baru_md5);
      expect(pasang, `PASANG guard ${u.no}`).toContain(`MD5(sql_query)='${u.lama_md5}'`);
      expect(periksa, `PERIKSA ${u.no}`).toContain(`'var ${u.no} diubah'`);
      expect(periksa, `PERIKSA md5 ${u.no}`).toContain(u.baru_md5);
      expect(pulih, `PULIH baru ${u.no}`).toContain(u.baru_md5);
      expect(pulih, `PULIH lama ${u.no}`).toContain(u.lama_md5);
    }
  });

  it("PASANG hanya UPDATE abt_variabel (tanpa INSERT, DELETE, atau tabel lain); PULIH hanya memulihkan; satu transaksi", () => {
    const tanpaHex = pasang.replace(/0x[0-9a-f]+/g, "0x");
    expect(tanpaHex).not.toMatch(/\b(INSERT|DELETE|REPLACE|DROP|ALTER|TRUNCATE|CREATE)\b/);
    expect(tanpaHex.match(/^START TRANSACTION;$/gm)).toHaveLength(1);
    expect(tanpaHex.match(/^COMMIT;$/gm)).toHaveLength(1);
    for (const m of tanpaHex.matchAll(/^UPDATE (\S+)/gm)) expect(m[1]).toBe("abt_variabel");
    expect(pulih).not.toMatch(/\b(INSERT|DELETE|DROP|ALTER|TRUNCATE|CREATE)\b/);
    expect(pulih).toContain("JOIN pu_lama l ON l.no_var=a.no_var");
  });

  it("tidak ada variabel non-Derry: semua nomor >= 2000, bukan 14 variabel paket 27 Okt, bukan bawaan ABT yang dikenal (0020/0024/0337/0343/0347 dst.) dan bukan keluarga data_sipp", () => {
    const nomor = ring.ubah.map((u) => u.no);
    for (const n of nomor) expect(n, `nomor ${n}`).toBeGreaterThanOrEqual(2000);
    const bawaan = [20, 24, 27, 45, 118, 120, 337, 343, 347, 1076, 1077, 5101, 5842, 5847, 5897, 6031, 6032, 8175, 8179, 8180];
    for (const b of bawaan) expect(nomor.includes(b), `bawaan ${b}`).toBe(false);
    // variabel data_sipp (urutan di kolom urutan_data, tanpa kueri): tidak disentuh
    for (const n of [3119, 3129, 5089, 5090, 5097, 5098, 5117, 5118]) expect(nomor.includes(n), `data_sipp ${n}`).toBe(false);
    // 14 variabel paket 27 Okt (7036 7037 7047 7048 7097 7098 7148 7149 7152 8516 3520-3523) tidak disentuh lagi
    const p27 = [...ring27.ubah.map((u) => u.no), 3520, 3521, 3522, 3523];
    expect(p27).toHaveLength(14);
    for (const n of p27) expect(nomor.includes(n), `paket 27 Okt ${n}`).toBe(false);
    expect([...ring.dilewati_27].sort((a, b) => a - b)).toEqual([...p27].sort((a, b) => a - b));
    // kelompok yang diminta pengguna
    const minta = [
      ...Array.from({ length: 8 }, (_, i) => 3111 + i), // 3111-3118
      ...Array.from({ length: 8 }, (_, i) => 3121 + i), // 3121-3128
      3131, 5078, 5079, 5080, 5081, 5083, 5088, 5091, 5096, 5099, 5107,
      8800, 8801, 8802, 8803, 8808, 8809, 8810, 8811, 9290, 9291, 9292, 9293, 9560, 9561, 9562,
    ];
    for (const n of minta) expect(nomor.includes(n), `diminta ${n}`).toBe(true);
    // nomor tambahan di luar daftar awal (ketemu pada pemeriksaan pola urutan): relaas, umur, kode pos, kabupaten, tanggal relaas dst.
    for (const n of [3642, 3643, 3673, 4440, 5116, 7078, 8129, 8510, 8524, 8533, 8890, 9104, 9200, 9205, 9277, 9278, 9279, 9280, 9281, 9404, 9405, 10106, 10107]) expect(nomor.includes(n), `tambahan ${n}`).toBe(true);
  });

  it("prasyarat 27 Okt: 9 fungsi dan 14 variabel dengan md5 persis isi-paket.json paket 27 Okt (yang terpasang 27 Okt)", () => {
    const var27 = ring.prasyarat_27.variabel;
    expect(Object.keys(var27)).toHaveLength(14);
    for (const u of ring27.ubah) {
      expect(var27[String(u.no)], `md5 ${u.no}`).toBe(u.baru_md5);
      expect(pra).toContain(`(no_var=${u.no} AND MD5(sql_query)='${u.baru_md5}')`);
    }
    const fn27 = { ...ring27.fungsi_baru, ...Object.fromEntries(Object.entries(ring27.fungsi_x9).map(([k, v]) => [k, v.baru_md5])) };
    expect(Object.keys(fn27)).toHaveLength(9);
    for (const [f, h] of Object.entries(fn27)) {
      expect(ring.prasyarat_27.fungsi[f], f).toBe(h);
      expect(pra).toContain(`(routine_name='${f}' AND MD5(routine_definition)='${h}')`);
    }
    expect(periksa).toContain("'paket 27 Okt utuh'");
  });
});

describe("pihak-urut-sisa - isi kueri baru", () => {
  const POLA_SISA = /\b[A-Za-z_][A-Za-z_0-9]*\.urutan\s*(?:=|IN\b|<=|>=|<>|!=)\s*\(?\s*\d|(?<![.\w])urutan\s*(?:=|IN\b)\s*\(?\s*\d/i;

  it("tidak ada lagi `urutan = angka` tetap pada tabel pihak; yang tersisa hanya ORDER BY/pengurutan", () => {
    for (const [no, q] of baru) {
      expect(q, `kueri ${no}`).not.toMatch(POLA_SISA);
      const tanpaPeringkat = q.replace(/aps_badilag\.isian_rtf_pihak_peringkat\(\d, [A-Za-z_0-9.]+\)/g, "PERINGKAT");
      expect(tanpaPeringkat, `kueri ${no}`).not.toMatch(POLA_SISA);
    }
  });

  it("tiap variabel memakai fungsi peringkat sebanyak penggantian yang dilaporkan; 9280/9281 memakai predikat SQL murni (waktu tetap) tanpa fungsi", () => {
    let total = 0;
    for (const u of ring.ubah) {
      const q = baru.get(u.no)!;
      const jml = (q.match(/aps_badilag\.isian_rtf_pihak_peringkat\(/g) ?? []).length;
      expect(jml, `fungsi di ${u.no}`).toBe(u.diganti - u.inline);
      expect(u.diganti, `diganti ${u.no}`).toBeGreaterThan(0);
      total += u.diganti;
      if (u.inline) expect(q, `inline ${u.no}`).toContain("NOT EXISTS (SELECT 1 FROM perkara_pihak");
    }
    expect(total).toBe(ring.jumlah_penggantian);
    expect(ring.ubah.filter((u) => u.inline > 0).map((u) => u.no)).toEqual([9280, 9281]);
  });

  it("bentuk penggantian: tabel dan alias benar (pihak1 = Penggugat/Pemohon, pihak2 = Tergugat/Termohon)", () => {
    const contoh = (no: number) => baru.get(no)!;
    expect(contoh(3111)).toContain("where aps_badilag.isian_rtf_pihak_peringkat(1, perkara_pihak1.id)=3 and perkara_id=#perkara_id#");
    expect(contoh(3122)).toContain("where aps_badilag.isian_rtf_pihak_peringkat(1, a.id)=4 and a.perkara_id=#perkara_id#");
    expect(contoh(5078)).toContain("where aps_badilag.isian_rtf_pihak_peringkat(2, a.id)=2 and a.perkara_id=#perkara_id#");
    expect(contoh(5107)).toContain("aps_badilag.isian_rtf_pihak_peringkat(2, a.id)=5");
    expect(contoh(8801)).toContain("FROM perkara_pihak2 a JOIN pihak b ON b.id = a.pihak_id WHERE a.perkara_id = '#perkara_id#' AND aps_badilag.isian_rtf_pihak_peringkat(2, a.id) = 1 LIMIT 1");
    expect(contoh(8800)).toContain("aps_badilag.isian_rtf_pihak_peringkat(1, a.id) = 1 LIMIT 1");
    expect(contoh(8524)).toContain("aps_badilag.isian_rtf_pihak_peringkat(1, a.id) = 1 AND a.perkara_id");
    expect(contoh(8524)).toContain("aps_badilag.isian_rtf_pihak_peringkat(2, a2.id) = 1 AND a2.perkara_id");
    expect(contoh(8129)).toContain("AND aps_badilag.isian_rtf_pihak_peringkat(2, p.id) = 1 WHERE");
    expect(contoh(8890)).toContain("aps_badilag.isian_rtf_pihak_peringkat(1, zp.id) = 1");
    expect(contoh(8890)).toContain("aps_badilag.isian_rtf_pihak_peringkat(2, x.id) = 1 GROUP BY");
    expect(contoh(9561)).toContain("aps_badilag.isian_rtf_pihak_peringkat(1, p.id) IN (1, 2)");
    expect(contoh(9561)).toContain("ORDER BY p.urutan DESC LIMIT 1"); // pengurutan tidak diubah
    expect(contoh(7078)).toContain("alur_perkara_id = 16 AND aps_badilag.isian_rtf_pihak_peringkat(1, perkara_pihak1.id) = 2");
    expect(contoh(3673)).toContain("MAX(CASE WHEN aps_badilag.isian_rtf_pihak_peringkat(1, pp.id) = 1 THEN p.nama END)");
    expect(contoh(3673)).toContain("MAX(CASE WHEN aps_badilag.isian_rtf_pihak_peringkat(1, pp.id) = 2 THEN p.nama END)");
    // 9404/9405: nomor sebutan Pihak Istri = PERINGKAT terkecil, bukan nilai urutan
    expect(contoh(9404)).toContain("(SELECT MIN(aps_badilag.isian_rtf_pihak_peringkat(1, a.id)) FROM perkara_pihak1 a");
    expect(contoh(9404)).toContain("(SELECT MIN(aps_badilag.isian_rtf_pihak_peringkat(2, a.id)) FROM perkara_pihak2 a");
    expect(contoh(9405)).toContain("aps_badilag.isian_rtf_pihak_peringkat(1, a.id) = z.u");
    expect(contoh(9405)).toContain("aps_badilag.isian_rtf_pihak_peringkat(2, a.id) = z.u");
    // 9280: peringkat 1 sebagai "tidak ada pihak yang lebih awal"
    expect(contoh(9280)).toContain("NOT EXISTS (SELECT 1 FROM perkara_pihak1 zc1 WHERE zc1.perkara_id = c1.perkara_id AND (IFNULL(zc1.urutan, 0) < IFNULL(c1.urutan, 0) OR (IFNULL(zc1.urutan, 0) = IFNULL(c1.urutan, 0) AND zc1.id < c1.id)))");
  });

  it("kueri baru tidak memuat PREPARE/EXECUTE/variabel sesi dan tetap SELECT; pengurutan yang sudah berupa peringkat (ORDER BY urutan LIMIT) tidak diubah", () => {
    for (const [no, q] of baru) {
      // 10106/10107 membuka dengan baris komentar asli ("-- Bawaan ..."): dilewati sebelum memeriksa SELECT
      const tanpaKomentar = q.replace(/^(\s*--[^\n]*\n)+/, "");
      expect(tanpaKomentar.trimStart().toLowerCase().startsWith("select"), `SELECT ${no}`).toBe(true);
      expect(q, `kueri ${no}`).not.toMatch(/PREPARE|EXECUTE|@pid/i);
    }
    expect(baru.has(10121)).toBe(false); // ORDER BY a.urutan, a.id LIMIT 1 sudah peringkat
    expect(baru.has(8609)).toBe(false);
  });

  it("UJIVAR memuat kueri baru semua variabel (pemisahan berat/ringan) dengan @pid", () => {
    const ringan = baca(`${N}-UJIVAR.sql`);
    const berat = baca(`${N}-UJIVAR-BERAT.sql`);
    for (const u of ring.ubah) {
      const di = [9280, 9281, 9290, 9291].includes(u.no) ? berat : ringan;
      expect(di, `UJIVAR ${u.no}`).toContain(`SELECT ${u.no} AS no_var, COUNT(*) AS baris FROM (`);
    }
    expect(berat.match(/AS no_var/g)).toHaveLength(4);
    expect(ringan.match(/AS no_var/g)).toHaveLength(ring.ubah.length - 4);
    expect(ringan).not.toContain("#perkara_id#");
    expect(ringan).toContain("@pid");
  });
});

describe("pihak-urut-sisa - skrip pasang dan pulih", () => {
  const pasang = baca("pasang-satker.sh");
  const pulih = baca("pulih-satker.sh");

  it("salinan di paket-satker = sumber; tanpa CR", () => {
    expect(pasang).toBe(readFileSync(path.join(dir, "sumber/pasang-satker.sh"), "utf8"));
    expect(pulih).toBe(readFileSync(path.join(dir, "sumber/pulih-satker.sh"), "utf8"));
    expect(pasang).not.toContain("\r");
    expect(pulih).not.toContain("\r");
  });

  it("pasang: md5 paket -> prasyarat (berhenti bila tak cocok) -> cadangan -> fungsi -> pasang -> periksa -> uji; gagal = pulih otomatis; tanpa blangko RTF", () => {
    const urut = ["md5sum -c MD5SUMS.txt", "-PRASYARAT.sql", "mysqldump", "-FUNGSI.sql", "-PASANG.sql", "-PERIKSA.sql", "isian_rtf_pihak_peringkat($T, a.id)", "-UJIVAR.sql", "-UJIVAR-BERAT.sql", "SELESAI"].map((k) => pasang.indexOf(k));
    for (const i of urut) expect(i).toBeGreaterThan(0);
    expect([...urut].sort((a, b) => a - b)).toEqual(urut);
    expect(pasang).toContain('TIDAK ada yang diubah');
    expect(pasang).toContain("pulih");
    expect(pasang).toContain('[ "$nlama" = "$NU" ]'); // cadangan memuat semua baris lama
    expect(pasang).not.toMatch(/tambal-rtf|\.rtf|ABT_BLANGKO/i);
    expect(pasang).toContain("PERIKSA tidak cocok");
    expect(pasang).toContain("peringkat tidak sama dengan urutan pada perkara berurutan rapat");
  });

  it("pulih: variabel dikembalikan dari cadangan hanya bila masih isi baru; fungsi PS dihapus hanya bila tak ada yang memanggil; baris akhir PULIH COCOK", () => {
    expect(pulih).toContain("CREATE TEMPORARY TABLE pu_lama LIKE abt_variabel;");
    expect(pulih).toContain("grep '^REPLACE' \"$CAD/abt_variabel-sebelum.sql\"");
    expect(pulih).toContain("routine_comment LIKE 'PS:%'");
    expect(pulih).toContain("LIKE '%isian\\_rtf\\_pihak\\_peringkat%'");
    expect(pulih).toContain("PULIH COCOK");
    expect(pulih).toContain("SEBELUM pulih paket abt-pihak-urut-ecourt-27okt");
  });

  it("direktori paket: PASANG.md ada, folder cadangan tidak ikut repo", () => {
    expect(existsSync(path.join(dir, "PASANG.md"))).toBe(true);
    expect(readFileSync(path.join(dir, ".gitignore"), "utf8")).toContain("paket-satker/cadangan/");
  });
});
