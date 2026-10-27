// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { urutanRomawi } from "@/lib/sebutan-pihak";

/**
 * 27 Okt 2026 - pihak banyak pada perkara e-Court (656/Pdt.G/2026/PA.Dgl, Kewarisan).
 * Pendaftaran e-Court menomori kolom `urutan` BERSAMBUNG lintas tabel: Penggugat 1-25, Tergugat tunggal berurutan 25, Turut Tergugat 25 dan 26.
 * Kueri ABT memakai nilai `urutan` sebagai nomor sebutan, sehingga Tergugat I-V tercetak kosong, Tergugat XXV tercetak, kaki putusan menulis
 * "Penggugat 11" (angka Arab sesudah X) dan Turut Tergugat tidak tercetak. Paket abt-paket/pihak-urut-ecourt-27okt memakai PERINGKAT (urut urutan, id);
 * sisi ALETA (bot + portal) yang menurunkan sebutan dari urutan atau romawi terbatas disamakan. Uji ini menjaga isi paket di repo (tanpa DB);
 * pembandingan sebelum/sesudah atas perkara nyata dan render php56 ada di PASANG.md.
 */
const akar = path.resolve(process.cwd(), "..");
const dir = path.join(akar, "abt-paket/pihak-urut-ecourt-27okt");
const pk = (b: string) => path.join(dir, "paket-satker", b);
const N = "abt-pihak-urut-ecourt-27okt";
const baca = (b: string) => readFileSync(pk(b), "utf8");
const md5 = (s: string | Buffer) => createHash("md5").update(s).digest("hex");

function hexTerurai(sql: string): string[] {
  return [...sql.matchAll(/0x([0-9a-f]+)/g)].map((m) => Buffer.from(m[1], "hex").toString("latin1"));
}
function updateSql(pasang: string, no: number): string {
  const m = pasang.match(new RegExp(`UPDATE abt_variabel SET sql_query=0x([0-9a-f]+), modified='[^']*' WHERE \\(no_var=${no} `));
  expect(m, `UPDATE ${no}`).not.toBeNull();
  return Buffer.from(m![1], "hex").toString("latin1");
}
const ring = JSON.parse(readFileSync(path.join(dir, "hasil/isi-paket.json"), "utf8")) as {
  ubah: { no: number; lama_md5: string; baru_md5: string }[];
  baru: { no: number; nama: string; sql: string }[];
  fungsi_x9: Record<string, { lama_md5: string; baru_md5: string }>;
  fungsi_baru: Record<string, string>;
  harap: string;
  ulang: string;
};

describe("pihak-urut - berkas paket utuh", () => {
  it("MD5SUMS.txt cocok dengan isi paket-satker", () => {
    const baris = baca("MD5SUMS.txt").trim().split("\n");
    expect(baris.length).toBeGreaterThanOrEqual(15);
    for (const b of baris) {
      const [m, nama] = b.split(/\s+/);
      expect(md5(readFileSync(pk(nama))), nama).toBe(m);
    }
  });

  it("FUNGSI.sql di paket = sumber/templat-fungsi.sql; ASCII; tanpa kata merek; tanpa komentar -- di badan fungsi (klien mysql membuangnya, md5 definisi berubah)", () => {
    const fungsi = baca(`${N}-FUNGSI.sql`);
    expect(fungsi).toBe(readFileSync(path.join(dir, "sumber/templat-fungsi.sql"), "utf8"));
    expect(fungsi).not.toMatch(/[^\x09\x0a\x20-\x7e]/);
    expect(fungsi.toLowerCase()).not.toContain("aleta");
    expect(fungsi).not.toMatch(/PREPARE|EXECUTE|REGEXP_REPLACE/i);
    const badan = fungsi.slice(fungsi.indexOf("DELIMITER $$"));
    expect(badan.split("\n").filter((l) => /--/.test(l))).toEqual([]);
    expect(baca("nama-fungsi.txt").trim().split(/\s+/)).toEqual([
      "isian_rtf_pihak_jumlah",
      "isian_rtf_pihak_identitas",
      "isian_rtf_pihak_nama_semua",
      "isian_rtf_pihak_kaki",
      "isian_rtf_pihak_sebut",
    ]);
    const semua = [...Object.keys(ring.fungsi_x9), ...Object.keys(ring.fungsi_baru)];
    expect(semua).toHaveLength(9);
    for (const f of semua) {
      expect(fungsi).toContain(`DROP FUNCTION IF EXISTS ${f}$$`);
      expect(fungsi).toMatch(new RegExp(`CREATE FUNCTION ${f}\\([^]*?COMMENT 'PU: `));
    }
  });

  it("semua SQL paket ASCII dan, termasuk literal heksadesimal, tanpa kata merek", () => {
    for (const b of ["PRASYARAT", "PASANG", "PERIKSA", "PULIH", "FUNGSI-X9-LAMA"]) {
      const sql = baca(`${N}-${b}.sql`);
      expect(sql).not.toMatch(/[^\x09\x0a\x0d\x20-\x7e]/);
      expect(sql.toLowerCase()).not.toContain("aleta");
      for (const t of hexTerurai(sql)) expect(t.toLowerCase()).not.toContain("aleta");
    }
  });

  it("angka PRASYARAT di harap.txt = yang tertulis di PRASYARAT.sql", () => {
    const [harap, ulang] = baca("harap.txt").trim().split("\n");
    const pra = baca(`${N}-PRASYARAT.sql`);
    expect(pra).toContain(`"${harap}" (pertama) atau "${ulang}" (pasang ulang)`);
    expect(harap).toBe(ring.harap);
    expect(ulang).toBe(ring.ulang);
    expect(harap).toMatch(/^0\|0\|10\|0\|0\|\d+\|0\|4\|0$/);
    expect(ulang).toMatch(/^0\|4\|0\|10\|5\|\d+\|0\|0\|4$/);
  });
});

describe("pihak-urut - fungsi menurut peringkat", () => {
  const fungsi = baca(`${N}-FUNGSI.sql`);
  const badanFungsi = (f: string) => fungsi.match(new RegExp(`CREATE FUNCTION ${f}\\([^]*?\\nBEGIN\\n([^]*?)\\nEND\\$\\$`))![1];

  it("empat fungsi x9 memberi nomor dengan penghitung baris (v_rn) dan mengurutkan urutan lalu id; tidak lagi menyaring a.urutan >= p_dari", () => {
    for (const f of ["isian_rtf_pihak_utama", "isian_rtf_pihak_nama"]) {
      const b = badanFungsi(f);
      expect(b, f).toContain("SET v_rn = v_rn + 1;");
      expect(b, f).toContain("IF v_rn >= p_dari THEN");
      expect(b, f).toContain("ORDER BY 1, 2;");
      expect(b, f).toContain("isian_rtf_romawi(v_rn)");
      expect(b, f).not.toMatch(/a\.urutan >= p_dari/);
      expect(b, f).not.toContain("isian_rtf_romawi(v_urutan)");
    }
    expect(badanFungsi("isian_rtf_pihak_urutan")).toContain("isian_rtf_pihak_jumlah(p_perkara, p_sisi)");
    expect(badanFungsi("isian_rtf_pihak_urutan")).not.toMatch(/MAX\(urutan\)/);
    const tambahan = badanFungsi("isian_rtf_pihak_tambahan");
    expect(tambahan).toContain("ORDER BY 1, 2;");
    expect(tambahan).toContain("isian_rtf_romawi(v_rn)");
  });

  it("identitas: satu pihak tanpa angka romawi, banyak pihak berangka romawi menurut peringkat, kalimat kuasa memuat daftar sebutan", () => {
    const b = badanFungsi("isian_rtf_pihak_identitas");
    expect(b).toContain("IF v_n = 1 THEN");
    expect(b).toContain("isian_rtf_romawi(v_rn)");
    expect(b).toContain("isian_rtf_pihak_urutan(p_perkara, p_sisi, p_sebutan)");
    expect(b).toContain("LOCATE('dahulu'"); // pihak ghaib: tanpa awalan "tempat kediaman di" (sama dengan variabel 0124)
    expect(b).toContain("v_rn = 1 AND TRIM(IFNULL(p_alamat1, '')) <> ''"); // alamat putusan (8548/8549) hanya pihak pertama
    expect(b).toContain("selanjutnya disebut sebagai"); // sisi 1 seperti 7047
  });

  it("kaki: romawi untuk semua pihak, tunggal tanpa angka, pola alur/jenis sama dengan 7148/7149 lama", () => {
    const b = badanFungsi("isian_rtf_pihak_kaki");
    expect(b).toContain("isian_rtf_romawi(i)");
    expect(b).toContain("v_alur IN (15, 17)");
    expect(b).toContain("v_alur = 16 OR v_jenis = 346");
    expect(b).toContain("IF v_n = 1 THEN");
    const sebut = badanFungsi("isian_rtf_pihak_sebut");
    expect(sebut).toContain("CONCAT('Turut ', IFNULL(v_s2, 'Tergugat'))");
    expect(sebut).toContain("' dan '");
  });
});

describe("pihak-urut - variabel yang diubah", () => {
  const pasang = baca(`${N}-PASANG.sql`);

  it("10 baris diubah dan 4 variabel baru (3520-3523) di jatah 3500-3549 di luar 3502-3519", () => {
    expect(ring.ubah.map((u) => u.no)).toEqual([7036, 7037, 7047, 7048, 7097, 7098, 7148, 7149, 7152, 8516]);
    expect(baca("nomor-ubah.txt").trim()).toBe("7036,7037,7047,7048,7097,7098,7148,7149,7152,8516");
    expect(ring.baru.map((b) => b.no)).toEqual([3520, 3521, 3522, 3523]);
    expect(baca("nomor-baru.txt").trim()).toBe("3520,3521,3522,3523");
    for (const b of ring.baru) {
      expect(b.nama.length).toBeLessThanOrEqual(200);
      if (b.no <= 3521) expect(b.sql).toMatch(/^SELECT aps_badilag\.isian_rtf_pihak_sebut\(#perkara_id#, [34]\) AS data$/);
      for (const r of [...b.nama.matchAll(/#(\d+)#/g)].map((m) => m[1])) expect(["0046", "0047"]).toContain(r); // nama tanpa rujukan variabel lain (rekursi)
    }
  });

  it("7047/7048/7097/7098: kueri lama UTUH + dua sisipan (cabang pertama 'tidak rapat' dan kolom rapat) - md5 kueri tanpa sisipan = md5 lama server", () => {
    const lama = new Map(ring.ubah.map((u) => [u.no, u.lama_md5]));
    const baru = new Map(ring.ubah.map((u) => [u.no, u.baru_md5]));
    const RAPAT = " AS rapat";
    for (const no of [7047, 7048, 7097, 7098]) {
      const q = updateSql(pasang, no);
      expect(md5(Buffer.from(q, "latin1")), String(no)).toBe(baru.get(no));
      expect(q.match(/WHEN COALESCE\(p1\.rapat, 0\) = 0 THEN aps_badilag\.isian_rtf_pihak_(identitas|nama_semua)\(/g), String(no)).toHaveLength(1);
      expect(q.match(/\(MIN\(urutan\) = 1 AND MAX\(urutan\) = COUNT\(\*\) AND COUNT\(DISTINCT urutan\) = COUNT\(\*\)\) AS rapat/g), String(no)).toHaveLength(1);
      // balikkan dua sisipan -> harus persis kueri lama di server
      let balik = q.replace(/WHEN COALESCE\(p1\.rapat, 0\) = 0 THEN aps_badilag\.isian_rtf_pihak_(?:identitas|nama_semua)\([\s\S]*?\)\r\n {8}(?=WHEN )/, "");
      balik = balik.replace(/, \(MIN\(urutan\) = 1 AND MAX\(urutan\) = COUNT\(\*\) AND COUNT\(DISTINCT urutan\) = COUNT\(\*\)\)( AS rapat)/, "");
      balik = balik.replace(/, pp\.rapat AS rapat/, "");
      expect(balik.includes(RAPAT), String(no)).toBe(false);
      expect(md5(Buffer.from(balik, "latin1")), `${no} dibalikkan = isi lama server`).toBe(lama.get(no));
    }
  });

  it("7047/7048: kediaman, alamat putusan (8548/8549) dan kalimat kuasa (8540/8541) ikut ke fungsi identitas", () => {
    const q47 = updateSql(pasang, 7047);
    expect(q47).toContain('isian_rtf_pihak_identitas(#perkara_id#, 1, "#0046#", "tempat kediaman di", ');
    expect(q47).toContain("t.no_var = 8548");
    expect(q47).toContain('"#8540#")');
    const q48 = updateSql(pasang, 7048);
    expect(q48).toContain('isian_rtf_pihak_identitas(#perkara_id#, 2, "#0047#", "tempat kediaman di", ');
    expect(q48).toContain("t.no_var = 8549");
    expect(q48).toContain('"#8541#")');
    expect(updateSql(pasang, 7097)).toContain('isian_rtf_pihak_nama_semua(#perkara_id#, 1, "#0046#")');
    expect(updateSql(pasang, 7098)).toContain('isian_rtf_pihak_nama_semua(#perkara_id#, 2, "#0047#")');
  });

  it("7036/7037: 'para ...' menurut JUMLAH pihak (COUNT), bukan nilai urutan terbesar (Tergugat tunggal berurutan 25 tercetak 'para Tergugat')", () => {
    for (const no of [7036, 7037]) {
      const q = updateSql(pasang, no);
      expect(q).toContain("COUNT(*) AS urutan");
      expect(q).not.toContain("MAX(pp1.urutan)");
    }
  });

  it("kaki putusan: 7148/7149 dari fungsi, 7152 menambah Turut Tergugat dan 8516 pihak intervensi yang hadir (kode SIPP 7/8/9)", () => {
    expect(updateSql(pasang, 7148)).toBe("SELECT aps_badilag.isian_rtf_pihak_kaki(#perkara_id#, 1) AS data");
    expect(updateSql(pasang, 7149)).toBe("SELECT aps_badilag.isian_rtf_pihak_kaki(#perkara_id#, 2) AS data");
    const q52 = updateSql(pasang, 7152);
    expect(q52).toContain('"#7149# beserta Kuasanya"'); // kalimat lama utuh
    expect(q52).toContain('IF("#3520#" = "", "", " serta #3520#")');
    const q16 = updateSql(pasang, 8516);
    expect(q16).toContain("j.dihadiri_oleh IN (7, 8, 9)");
    expect(q16).toContain('IF(IFNULL(z.ivh, 0) = 1 AND "#3521#" <> "", " serta #3521#", "")');
    expect(q16).toContain('IF(z.ecourt, ", dan #0194# tersebut telah dikirim secara elektronik');
  });

  it("ditulis oleh admin, nama variabel lama tak berubah (md5 nama dijaga di PRASYARAT)", () => {
    expect(pasang).toContain("'admin'");
    const pra = baca(`${N}-PRASYARAT.sql`);
    for (const u of ring.ubah) {
      expect(pra).toContain(`no_var=${u.no} AND MD5(nama)=`);
      expect(pra).toContain(u.lama_md5);
      expect(baca(`${N}-PULIH.sql`)).toContain(u.baru_md5);
    }
  });
});

describe("pihak-urut - blangko RTF: Turut Tergugat (#8710#) dan pihak intervensi (#7054#) di identitas", () => {
  const daftar = baca("rtf-daftar-tambal.tsv").trim().split("\n").map((l) => l.split("\t"));
  const tambal = baca("rtf-tambal.tsv").trim().split("\n").map((l) => {
    const [rel, u, j, a, g] = l.split("\t");
    const d = (x: string) => Buffer.from(x, "base64").toString("utf8");
    return { rel: d(rel), u: Number(u), j: Number(j), a: d(a), g: d(g) };
  });

  it("hanya keluarga yang sudah memuat Turut Tergugat; hanya empat jenis tambalan (tiga untuk Turut Tergugat/intervensi, satu untuk kaki NO); tak ada berkas non-RTF atau di folder terhapus", () => {
    expect(daftar.length).toBeGreaterThan(300);
    for (const [kode, rel, m0, m1] of daftar) {
      expect(kode).toMatch(/^R\d{3}$/);
      expect(rel).toMatch(/\.rtf$/);
      expect(rel.startsWith("terhapus")).toBe(false);
      expect(m0).not.toBe(m1);
    }
    const jenis = new Set(tambal.map((t) => `${t.a} -> ${t.g}`));
    expect([...jenis].sort()).toEqual(["#7048#} -> #7048##8710#}", "#8502# -> #3523#", "#8710#} -> #8710##7054#}", "#9350#} -> #9350##8710#}"]);
    for (const t of tambal) expect(t.j).toBeGreaterThan(0);
    const keluarga = new Set(tambal.filter((t) => t.a !== "#8502#").map((t) => t.rel.split("/")[0].replace(/ - BAS$/, "")));
    for (const k of ["4b Kewarisan", "4a Harta Bersama", "4c Wasiat", "4d Hibah", "4e Wakaf"]) expect(keluarga.has(k), k).toBe(true);
    // cerai/itsbat/dispensasi tidak punya Turut Tergugat di rancangan Derry: tidak disentuh
    for (const k of ["1 Perceraian CG", "1a Perceraian CT", "2 Itsbat Nikah", "3 Dispensasi Kawin"]) expect(keluarga.has(k), k).toBe(false);
  });

  it("kaki NO (SEMA 1/2022): 38 blangko memanggil 3523; 3522 = 'di luar hadirnya' tetap (jamak menurut jumlah pihak, tanpa lawan hanya pihak pertama, Turut Tergugat ikut, kalimat e-Court); 3523 = 8502 dengan 8516 diganti 3522", () => {
    const no = tambal.filter((t) => t.a === "#8502#");
    expect(no).toHaveLength(38);
    for (const t of no) {
      expect(t.rel).toMatch(/\[NO\]/);
      expect(t.rel).toMatch(/Hadir Lalu 2x|Hadir Sidang Pertama Lalu 2x|Tidak Hadir Lagi|Cerai P & T Tidak Hadir/);
      expect(t.rel).not.toMatch(/ - BAS\//);
      expect(t.j).toBe(1);
    }
    for (const rel of ["1 Perceraian CG/[98] [NO] 4a. Cerai P Hadir Sidang Pertama Lalu 2x Tidak Hadir (SEMA 1 2022).rtf", "1a Perceraian CT/[98] [NO] 4a. Cerai P Hadir Sidang Pertama Lalu 2x Tidak Hadir (SEMA 1 2022).rtf", "9b Permohonan Umum/[99] [NO] Permohonan - Pemohon Tidak Hadir Lagi (SEMA 1 2022).rtf"]) {
      expect(no.some((t) => t.rel === rel), rel).toBe(true);
    }
    // blangko NO lain (cacat formil, kurang pihak, kewenangan) tetap memakai kehadiran yang tercatat
    expect(no.some((t) => /Cacat Formil|Kurang Pihak|Kewenangan/.test(t.rel))).toBe(false);
    const pasang = baca(`${N}-PASANG.sql`);
    const b22 = ring.baru.find((b) => b.no === 3522)!;
    expect(b22.sql).toContain('"di luar hadirnya ", "#7036#"');
    expect(b22.sql).toContain(`IF(EXISTS (SELECT 1 FROM perkara_pihak2 WHERE perkara_id = '#perkara_id#'), CONCAT(" dan ", "#7037#"), "")`);
    expect(b22.sql).toContain('IF("#3520#" = "", "", " serta #3520#")');
    expect(b22.sql).toContain("telah dikirim secara elektronik melalui sistem informasi pengadilan pada hari itu juga");
    const b23 = ring.baru.find((b) => b.no === 3523)!;
    expect(b23.sql).toContain("#3522#");
    expect(b23.sql).not.toContain("#8516#");
    expect(b23.sql).toContain("oleh <strong>#8550#</strong> sebagai #8555#");
    expect(pasang).toContain("3523");
  });

  it("blangko [98] Kewarisan (656/Pdt.G/2026) ikut ditambal: #8710# sesudah #7048#", () => {
    const rel = "4b Kewarisan/[98] [Cabut] Kewarisan - P & T Hadir Sebelum Jawaban.rtf";
    const t = tambal.filter((x) => x.rel === rel);
    expect(t.map((x) => `${x.a} -> ${x.g}`)).toEqual(["#7048#} -> #7048##8710#}", "#8710#} -> #8710##7054#}"]);
    expect(daftar.some((d) => d[1] === rel)).toBe(true);
  });
});

describe("pihak-urut - sisi ALETA (bot + portal)", () => {
  const req = createRequire(path.join(akar, "aleta_bot/services/x.js"));
  const ktp = req("./ktpPihakService.js") as {
    romawi: (n: number) => string;
    peranPihak: (cabang: number, urutan: number, jumlah: number, sebutan?: { satu: string; dua: string } | null) => string;
  };
  const sebutanBot = req("./sebutanPihakService.js") as { urutanRomawi: (n: number) => string };
  const pekerjaan = req("./pekerjaanPihakService.js") as { bacaPekerjaanPihak: (id: number, kueri: () => Promise<unknown[]>) => Promise<{ pihakKe: number; urutan: number; nama: string }[]> };
  const sumber = (rel: string) => readFileSync(path.join(akar, rel), "utf8");

  it("romawi untuk SEMUA pihak (dulu 'Penggugat 11'): bot dan portal sama sampai 3999", () => {
    expect([1, 4, 9, 10, 11, 12, 21, 25, 40, 49, 99].map(urutanRomawi)).toEqual(["I", "IV", "IX", "X", "XI", "XII", "XXI", "XXV", "XL", "XLIX", "XCIX"]);
    for (let n = 1; n <= 3999; n += 7) {
      expect(sebutanBot.urutanRomawi(n), String(n)).toBe(urutanRomawi(n));
      expect(ktp.romawi(n), String(n)).toBe(urutanRomawi(n));
    }
    expect(urutanRomawi(4000)).toBe("4000");
  });

  it("peran KTP: pihak ke-11 s.d. 25 bersebutan romawi; satu pihak tanpa angka; cabang 3 = intervensi, cabang 4 = Turut (kebalikan dari dulu)", () => {
    const s = { satu: "Penggugat", dua: "Tergugat" };
    expect(ktp.peranPihak(1, 11, 25, s)).toBe("Penggugat XI");
    expect(ktp.peranPihak(1, 25, 25, s)).toBe("Penggugat XXV");
    expect(ktp.peranPihak(2, 1, 1, s)).toBe("Tergugat");
    expect(ktp.peranPihak(4, 2, 2, s)).toBe("Turut Tergugat II");
    expect(ktp.peranPihak(3, 1, 1, s)).toBe("Pihak intervensi");
    expect(ktp.peranPihak(2, 1, 2, null)).toBe("Tergugat I");
  });

  it("ktpPihakService: urutan pihak = peringkat per cabang (ORDER BY urutan, id), nilai SIPP disimpan di urutanSipp", () => {
    const s = sumber("aleta_bot/services/ktpPihakService.js");
    expect(s).toContain("ORDER BY pp.urutan, pp.id");
    expect(s).toContain("urutan: peringkat,");
    expect(s).toContain("urutanSipp: r.urutan == null ? null : Number(r.urutan),");
  });

  it("pekerjaanPihakService: Tergugat tunggal berurutan 25 menjadi pihak ke-1; dua Penggugat berurutan 3 dan 9 menjadi ke-1 dan ke-2", async () => {
    const baris = [
      { pihakKe: 1, urutan: 3, nama: "A", pekerjaan: "Petani/Pekebun" },
      { pihakKe: 1, urutan: 9, nama: "B", pekerjaan: "Wiraswasta" },
      { pihakKe: 2, urutan: 25, nama: "Hadifah", pekerjaan: "Mengurus Rumah Tangga" },
    ];
    const hasil = await pekerjaan.bacaPekerjaanPihak(10225, async () => baris);
    expect(hasil.map((h) => [h.pihakKe, h.urutan, h.nama])).toEqual([[1, 1, "A"], [1, 2, "B"], [2, 1, "Hadifah"]]);
  });

  it("berkasPerkaraService: pihak ke-2 dan dua nama fokus diambil menurut peringkat (OFFSET / LIMIT), bukan urutan = 2", () => {
    const s = sumber("aleta_bot/services/berkasPerkaraService.js");
    expect(s).toContain('FROM perkara_pihak1 WHERE perkara_id = ? ORDER BY urutan, id LIMIT 1 OFFSET 1"');
    expect(s).toContain('FROM perkara_pihak1 WHERE perkara_id = ? ORDER BY urutan, id LIMIT 2"');
    expect(s).not.toContain("AND urutan = 2 LIMIT 1");
    expect(s).not.toContain("AND urutan <= 2 ORDER BY urutan");
  });
});
