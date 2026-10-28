// @vitest-environment node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 28 Okt 2026 - angka romawi pihak pada sampul pihak banyak. Variabel bawaan ABT 5890-5893 (+ 5847, 5896, 5897 yang bermasalah sama) memakai NILAI kolom `urutan` sebagai angka romawi
 * (`ELT(a.urutan, 'I', 'II', ...)`) dan sebagai batas (`BETWEEN`, `<= 3`). Pendaftaran e-Court menomori `urutan` BERSAMBUNG lintas tabel (Tergugat 14-19, Turut Tergugat 25-26), sehingga baris pihak
 * hilang atau salah nomor. Paket abt-paket/romawi-pihak-28okt memakai PERINGKAT (isian_rtf_pihak_peringkat, paket pihak-urut-sisa-28okt) dan isian_rtf_romawi (1-3999, sudah di server).
 * Uji ini menjaga isi paket di repo (tanpa DB): berkas utuh, pembalikan ke kueri lama, model perilaku, dan hasil perbandingan atas perkara nyata (hasil/bandingkan-ringkasan.json).
 */
const akar = path.resolve(process.cwd(), "..");
const dir = path.join(akar, "abt-paket/romawi-pihak-28okt");
const dir27 = path.join(akar, "abt-paket/pihak-urut-ecourt-27okt");
const dirSisa = path.join(akar, "abt-paket/pihak-urut-sisa-28okt");
const pk = (b: string) => path.join(dir, "paket-satker", b);
const N = "abt-romawi-pihak-28okt";
const baca = (b: string) => readFileSync(pk(b), "utf8");
const md5 = (s: string | Buffer) => createHash("md5").update(s).digest("hex");

type Ubah = { no: number; lama_md5: string; baru_md5: string; lama_panjang: number; baru_panjang: number; diganti: number };
const ring = JSON.parse(readFileSync(path.join(dir, "hasil/isi-paket.json"), "utf8")) as {
  ubah: Ubah[];
  harap: string;
  ulang: string;
  prasyarat_27: { variabel: Record<string, string>; fungsi: Record<string, string> };
  prasyarat_sisa: { variabel: Record<string, string>; fungsi: Record<string, string> };
  jumlah_penggantian: number;
};
const ring27 = JSON.parse(readFileSync(path.join(dir27, "hasil/isi-paket.json"), "utf8")) as {
  ubah: { no: number; baru_md5: string }[];
  fungsi_baru: Record<string, string>;
  fungsi_x9: Record<string, { baru_md5: string }>;
};
const ringSisa = JSON.parse(readFileSync(path.join(dirSisa, "hasil/isi-paket.json"), "utf8")) as {
  ubah: { no: number; baru_md5: string }[];
  fungsi: { nama: string; md5: string };
};

const NOMOR = [5847, 5890, 5891, 5892, 5893, 5896, 5897];
const TABEL: Record<number, number> = { 5847: 3, 5890: 1, 5891: 1, 5892: 2, 5893: 2, 5897: 4 };
const ELT20 = (x: string) => `ELT(${x},'I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX')`;
const PER = "aps_badilag.isian_rtf_pihak_peringkat";
const ROM = "aps_badilag.isian_rtf_romawi";

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

/** pembalikan mekanis kueri baru ke bentuk lama */
function balik(q: string, no: number): string {
  if (no === 5896) {
    return q.replace(`${ROM}((SELECT COUNT(*) FROM perkara_pihak1 WHERE perkara_id=#perkara_id#))`, ELT20("LEAST((SELECT COUNT(*) FROM perkara_pihak1 WHERE perkara_id=#perkara_id#),20)"));
  }
  const t = TABEL[no];
  return q.split(`${ROM}(${PER}(${t}, a.id))`).join(ELT20("a.urutan")).split(`${PER}(${t}, a.id)`).join("a.urutan");
}

describe("romawi-pihak - berkas paket utuh", () => {
  it("MD5SUMS.txt cocok dengan isi paket-satker dan memuat setiap berkas paket", () => {
    const baris = baca("MD5SUMS.txt").trim().split("\n");
    const nama = new Set<string>();
    for (const b of baris) {
      const [m, n] = b.split(/\s+/);
      nama.add(n);
      expect(md5(readFileSync(pk(n))), n).toBe(m);
    }
    const ada = readdirSync(path.join(dir, "paket-satker")).filter((f) => f !== "MD5SUMS.txt" && f !== "cadangan");
    expect([...nama].sort()).toEqual(ada.sort());
    for (const wajib of ["PRASYARAT", "PASANG", "PERIKSA", "PULIH", "UJIVAR-LAMA", "UJIVAR-BARU"]) expect(nama.has(`${N}-${wajib}.sql`), wajib).toBe(true);
    for (const wajib of ["pasang-satker.sh", "pulih-satker.sh", "harap.txt", "nomor-ubah.txt", "perkara-rapat.txt", "perkara-banyak.txt", "perkara-takrapat.txt"]) expect(nama.has(wajib), wajib).toBe(true);
    expect(existsSync(path.join(dir, "paket-satker/cadangan")), "cadangan uji laptop tidak boleh ikut paket").toBe(false);
  });

  it("semua SQL paket ASCII dan, termasuk literal heksadesimal, tanpa kata aplikasi (tidak boleh masuk ABT)", () => {
    for (const b of ["PRASYARAT", "PASANG", "PERIKSA", "PULIH", "UJIVAR-LAMA", "UJIVAR-BARU"]) {
      const sql = baca(`${N}-${b}.sql`);
      expect(sql, b).not.toMatch(/[^\x09\x0a\x0d\x20-\x7e]/);
      expect(sql.toLowerCase(), b).not.toContain("aleta");
      for (const t of hexTerurai(sql)) expect(t.toLowerCase(), `${b} hex`).not.toContain("aleta");
    }
    for (const [no, q] of baru) expect(q.toLowerCase(), `kueri ${no}`).not.toContain("aleta");
  });

  it("tidak ada fungsi baru: PASANG/PULIH tidak membuat atau menghapus fungsi; skrip tidak menyentuh fungsi paket lain", () => {
    expect(readdirSync(path.join(dir, "paket-satker")).filter((f) => /FUNGSI/.test(f))).toEqual([]);
    for (const b of ["PASANG", "PULIH", "PERIKSA", "PRASYARAT"]) {
      expect(baca(`${N}-${b}.sql`), b).not.toMatch(/CREATE FUNCTION|DROP FUNCTION|CREATE PROCEDURE|DELIMITER/i);
    }
    expect(baca("pulih-satker.sh")).not.toMatch(/DROP FUNCTION/);
    expect(baca("pasang-satker.sh")).not.toMatch(/DROP FUNCTION|CREATE FUNCTION/);
  });

  it("angka PRASYARAT di harap.txt = yang tertulis di PRASYARAT.sql dan di isi-paket.json", () => {
    const [harap, ulang] = baca("harap.txt").trim().split("\n");
    const pra = baca(`${N}-PRASYARAT.sql`);
    expect(pra).toContain(`"${harap}" (pertama) atau "${ulang}" (pasang ulang)`);
    expect(harap).toBe(ring.harap);
    expect(ulang).toBe(ring.ulang);
    expect(harap).toBe(`9|14|1|120|1|${NOMOR.length}|0|0`);
    expect(ulang).toBe(`9|14|1|120|1|0|${NOMOR.length}|0`);
    expect(baca("nomor-ubah.txt").trim()).toBe(NOMOR.join(","));
    expect(ring.ubah.map((u) => u.no)).toEqual(NOMOR);
  });
});

describe("romawi-pihak - tiap baris punya PRASYARAT, PASANG, PERIKSA, PULIH", () => {
  const pra = baca(`${N}-PRASYARAT.sql`);
  const pasang = baca(`${N}-PASANG.sql`);
  const periksa = baca(`${N}-PERIKSA.sql`);
  const pulih = baca(`${N}-PULIH.sql`);

  it("setiap variabel diganti ada di keempat berkas, dijaga md5 isi lama dan nama; PULIH hanya bila masih isi baru", () => {
    expect(baru.size).toBe(NOMOR.length);
    expect(pasang.match(/^UPDATE abt_variabel/gm)).toHaveLength(NOMOR.length);
    for (const u of ring.ubah) {
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

  it("PASANG hanya UPDATE abt_variabel dalam satu transaksi; PULIH hanya memulihkan", () => {
    const tanpaHex = pasang.replace(/0x[0-9a-f]+/g, "0x");
    expect(tanpaHex).not.toMatch(/\b(INSERT|DELETE|REPLACE|DROP|ALTER|TRUNCATE|CREATE)\b/);
    expect(tanpaHex.match(/^START TRANSACTION;$/gm)).toHaveLength(1);
    expect(tanpaHex.match(/^COMMIT;$/gm)).toHaveLength(1);
    for (const m of tanpaHex.matchAll(/^UPDATE (\S+)/gm)) expect(m[1]).toBe("abt_variabel");
    expect(pulih).not.toMatch(/\b(INSERT|DELETE|DROP|ALTER|TRUNCATE|CREATE)\b/);
    expect(pulih).toContain("JOIN pu_lama l ON l.no_var=a.no_var");
  });

  it("prasyarat: 9 fungsi + 14 variabel paket 27 Okt dan 1 fungsi + 120 variabel paket sisa 28 Okt, md5 persis isi-paket.json paket-paket itu", () => {
    expect(Object.keys(ring.prasyarat_27.variabel)).toHaveLength(14);
    for (const u of ring27.ubah) {
      expect(ring.prasyarat_27.variabel[String(u.no)], `md5 27 ${u.no}`).toBe(u.baru_md5);
      expect(pra).toContain(`(no_var=${u.no} AND MD5(sql_query)='${u.baru_md5}')`);
    }
    const fn27 = { ...ring27.fungsi_baru, ...Object.fromEntries(Object.entries(ring27.fungsi_x9).map(([k, v]) => [k, v.baru_md5])) };
    expect(Object.keys(fn27)).toHaveLength(9);
    for (const [f, h] of Object.entries(fn27)) {
      expect(ring.prasyarat_27.fungsi[f], f).toBe(h);
      expect(pra).toContain(`(routine_name='${f}' AND MD5(routine_definition)='${h}')`);
    }
    expect(Object.keys(ring.prasyarat_sisa.variabel)).toHaveLength(120);
    for (const u of ringSisa.ubah) {
      expect(ring.prasyarat_sisa.variabel[String(u.no)], `md5 sisa ${u.no}`).toBe(u.baru_md5);
      expect(pra).toContain(`(no_var=${u.no} AND MD5(sql_query)='${u.baru_md5}')`);
    }
    expect(ring.prasyarat_sisa.fungsi).toEqual({ [ringSisa.fungsi.nama]: ringSisa.fungsi.md5 });
    expect(pra).toContain(`(routine_name='isian_rtf_pihak_peringkat' AND MD5(routine_definition)='${ringSisa.fungsi.md5}')`);
    // perilaku fungsi yang dipakai diperiksa di server: romawi sampai > 20 dan peringkat untuk keempat tabel
    for (const sepasang of ["isian_rtf_romawi(25)='XXV'", "isian_rtf_romawi(32)='XXXII'", "isian_rtf_romawi(3999)='MMMCMXCIX'", "isian_rtf_pihak_peringkat(4, 0) IS NULL", "isian_rtf_pihak_peringkat(3, 0) IS NULL"]) {
      expect(pra, sepasang).toContain(sepasang);
      expect(periksa, sepasang).toContain(sepasang);
    }
    expect(periksa).toContain("'paket 27 Okt utuh'");
    expect(periksa).toContain("'paket sisa 28 Okt utuh'");
  });

  it("fungsi romawi yang dipakai memang ada di repo (paket x9) sebagai romawi 1-3999 dan peringkat tersedia untuk tabel 3 dan 4", () => {
    const x9 = readFileSync(path.join(akar, "abt-paket/x9-pihak-banyak-21okt/paket-satker/abt-x9-pihak-banyak-21okt-FUNGSI.sql"), "utf8");
    expect(x9).toMatch(/CREATE FUNCTION isian_rtf_romawi\(n INT\)/);
    expect(x9).toContain("n > 3999");
    const sisa = readFileSync(path.join(dirSisa, "paket-satker/abt-pihak-urut-sisa-28okt-FUNGSI.sql"), "utf8");
    for (const t of [3, 4]) expect(sisa).toContain(`FROM SIPP.perkara_pihak${t} WHERE id = p_id;`);
  });
});

describe("romawi-pihak - isi kueri baru", () => {
  it("tidak ada lagi `urutan` dan tidak ada ELT romawi di tujuh kueri baru; yang dipakai hanya peringkat dan fungsi romawi", () => {
    for (const [no, q] of baru) {
      expect(q.replace(/isian_rtf_pihak_peringkat/g, ""), `kueri ${no}`).not.toMatch(/urutan/i);
      expect(q, `kueri ${no}`).not.toContain("ELT(");
      expect(q, `kueri ${no}`).toContain(`${ROM}(`);
      expect(q, `kueri ${no}`).not.toMatch(/PREPARE|EXECUTE|@pid/i);
      expect(q.trimStart().toLowerCase().startsWith("select"), `SELECT ${no}`).toBe(true);
    }
  });

  it("pembalikan: kueri baru dibalik secara mekanis = kueri LAMA persis (md5) untuk ketujuh variabel; jumlah penggantian cocok", () => {
    let total = 0;
    for (const u of ring.ubah) {
      const q = baru.get(u.no)!;
      expect(md5(Buffer.from(balik(q, u.no), "latin1")), `pembalikan ${u.no}`).toBe(u.lama_md5);
      const jml = (q.match(/aps_badilag\.isian_rtf_pihak_peringkat\(/g) ?? []).length;
      expect(jml, `peringkat di ${u.no}`).toBe(u.no === 5896 ? 0 : u.diganti);
      total += u.diganti;
    }
    expect(total).toBe(ring.jumlah_penggantian);
  });

  it("tabel benar per variabel: 5847 = pihak3 (intervensi), 5890/5891 = pihak1, 5892/5893 = pihak2, 5897 = pihak4 (Turut Tergugat), 5896 = jumlah pihak1", () => {
    for (const [no, t] of Object.entries(TABEL)) {
      const q = baru.get(Number(no))!;
      expect(q, `tabel ${no}`).toContain(`FROM perkara_pihak${t} a WHERE`);
      const semua = [...q.matchAll(/isian_rtf_pihak_peringkat\((\d), a\.id\)/g)].map((m) => Number(m[1]));
      expect(new Set(semua), `peringkat ${no}`).toEqual(new Set([t]));
    }
    expect(baru.get(5896)!).toContain(`${ROM}((SELECT COUNT(*) FROM perkara_pihak1 WHERE perkara_id=#perkara_id#))`);
    expect(baru.get(5896)!).not.toContain("LEAST(");
  });

  it("batas, pembagian kolom dan ORDER BY memakai peringkat (bukan nilai urutan); konstanta 8/12 dan CEIL(.../2) tidak berubah", () => {
    for (const no of [5890, 5892]) {
      const q = baru.get(no)!;
      const t = TABEL[no];
      expect(q).toContain(`ORDER BY ${PER}(${t}, a.id) SEPARATOR '<br>'`);
      expect(q).toContain(`AND ${PER}(${t}, a.id) BETWEEN 2 AND 1+CEIL(`);
      expect(q.match(/,8,12\)/g)).toHaveLength(2);
    }
    for (const no of [5891, 5893]) {
      const q = baru.get(no)!;
      const t = TABEL[no];
      expect(q).toContain(`ORDER BY ${PER}(${t}, a.id) SEPARATOR '<br>') FROM perkara_pihak${t} a WHERE a.perkara_id=#perkara_id# AND ${PER}(${t}, a.id) BETWEEN 2+CEIL(`);
      expect(q).toContain("' lainnya - lengkap di Lampiran Daftar Para Pihak'"); // keterangan "dan N lainnya" memakai COUNT, utuh
    }
    for (const no of [5847, 5897]) {
      const q = baru.get(no)!;
      const t = TABEL[no];
      expect(q).toContain(`CASE WHEN ${PER}(${t}, a.id)<=3 THEN CONCAT(${ROM}(${PER}(${t}, a.id)),'. ',a.nama) END ORDER BY ${PER}(${t}, a.id) SEPARATOR ' - '`);
      expect(q).toContain("HAVING COUNT(*)>0");
    }
  });

  it("UJIVAR-LAMA dan UJIVAR-BARU memuat kueri tiap variabel dengan @pid dan nomor yang sama; LAMA tanpa fungsi, BARU memakai fungsi", () => {
    const lama = baca(`${N}-UJIVAR-LAMA.sql`);
    const bar = baca(`${N}-UJIVAR-BARU.sql`);
    for (const no of NOMOR) {
      expect(lama).toContain(`SELECT ${no} AS no_var, u.data FROM (`);
      expect(bar).toContain(`SELECT ${no} AS no_var, u.data FROM (`);
    }
    for (const s of [lama, bar]) {
      expect(s).not.toContain("#perkara_id#");
      expect(s).toContain("@pid");
    }
    expect(lama).not.toContain("aps_badilag.");
    expect(bar).toContain("aps_badilag.isian_rtf_romawi(");
  });

  it("variabel lain yang MEMANGGIL 5890-5893 ikut benar tanpa diubah: pemakainya hanya enam blangko sampul pihak banyak, tidak ada variabel turunan di paket-paket ABT", () => {
    const akarPaket = path.join(akar, "abt-paket");
    const pemakai: string[] = [];
    const telusur = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) telusur(p);
        else if (/\.rtf$/i.test(e.name)) {
          if (/#(5890|5891|5892|5893)#/.test(readFileSync(p, "latin1"))) pemakai.push(e.name);
        }
      }
    };
    telusur(path.join(akarPaket, "sampul-daftar-isi-26okt/rtf"));
    expect(pemakai.sort()).toEqual([
      "Sampul Berkas Perkara (Permohonan Pihak Banyak) (F4).rtf",
      "Sampul Berkas Perkara (Permohonan Pihak Banyak) (Legal).rtf",
      "Sampul Berkas Perkara (Permohonan Pihak Banyak).rtf",
      "Sampul Berkas Perkara (Pihak Banyak) (F4).rtf",
      "Sampul Berkas Perkara (Pihak Banyak) (Legal).rtf",
      "Sampul Berkas Perkara (Pihak Banyak).rtf",
    ]);
  });
});

/**
 * MODEL PERILAKU (cermin kueri 5890/5891): baris pihak yang tampil di kolom kiri/kanan sampul. Lama memakai nilai `urutan` (ELT romawi NULL di atas 20 membuang baris),
 * baru memakai peringkat. Dipakai untuk menunjukkan: perkara rapat identik, perkara e-Court tak rapat kini lengkap, romawi benar untuk berapa pun.
 */
function romawi(n: number): string {
  if (n < 1 || n > 3999) return "";
  const t: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let s = "";
  for (const [v, r] of t) while (n >= v) { s += r; n -= v; }
  return s;
}
const ELT_LAMA = (u: number | null) => (u != null && u >= 1 && u <= 20 ? romawi(u) : null);
function sampulModel(urutan: number[], pdtG: boolean, baruRumus: boolean) {
  const jumlah = urutan.length;
  const batas = pdtG ? 8 : 12;
  const tampil = jumlah > batas ? batas - 2 : jumlah - 1;
  const kiriAkhir = 1 + Math.ceil(tampil / 2);
  const urut = [...urutan].sort((a, b) => a - b);
  const nilai = (i: number) => (baruRumus ? i + 1 : urut[i]); // peringkat (mulai 1) atau nilai urutan
  const romaw = (i: number) => (baruRumus ? romawi(i + 1) : ELT_LAMA(urut[i]));
  const daftar = (dari: number, sampai: number) => urut.map((_, i) => i).filter((i) => nilai(i) >= dari && nilai(i) <= sampai).map((i) => [romaw(i), i] as const).filter(([r]) => r != null).map(([r, i]) => `${r}#${i}`);
  return {
    kiri: daftar(2, kiriAkhir),
    kanan: daftar(2 + Math.ceil(tampil / 2), 1 + tampil),
    lainnya: jumlah > batas ? jumlah - tampil - 1 : null,
  };
}

describe("romawi-pihak - model perilaku sampul pihak banyak (lama lawan baru)", () => {
  it("romawi benar sampai di atas 20 dan seterusnya", () => {
    expect([1, 4, 9, 14, 20, 21, 25, 26, 32, 49, 99, 1994, 3999].map(romawi)).toEqual(["I", "IV", "IX", "XIV", "XX", "XXI", "XXV", "XXVI", "XXXII", "XLIX", "XCIX", "MCMXCIV", "MMMCMXCIX"]);
    expect(ELT_LAMA(21)).toBeNull(); // sebab lama: ELT hanya 20 butir
  });

  it("perkara berurutan rapat (1..n): lama = baru, untuk Pdt.G (batas 8) dan lainnya (batas 12), 1 sampai 40 pihak", () => {
    for (const pdtG of [true, false]) {
      for (let n = 1; n <= 40; n++) {
        const u = Array.from({ length: n }, (_, i) => i + 1);
        expect(sampulModel(u, pdtG, true), `n=${n} pdtG=${pdtG}`).toEqual(sampulModel(u, pdtG, false));
      }
    }
  });

  it("perkara e-Court Tergugat berurutan 14-19 (enam orang): lama kosong, baru II-VI lengkap dan berurutan", () => {
    const u = [14, 15, 16, 17, 18, 19];
    expect(sampulModel(u, true, false)).toEqual({ kiri: [], kanan: [], lainnya: null });
    expect(sampulModel(u, true, true)).toEqual({ kiri: ["II#1", "III#2", "IV#3"], kanan: ["V#4", "VI#5"], lainnya: null });
  });

  it("urutan tidak mulai 1 (2-6) dan tunggal berurutan 25: lama salah nomor atau kosong, baru benar; tunggal tetap tanpa baris II", () => {
    // lama: nilai urutan 2.. dianggap peringkat, jadi pihak PERTAMA (#0, urutan 2) ikut tercetak sebagai "II" dan pihak kelima terlewat
    expect(sampulModel([2, 3, 4, 5, 6], true, false)).toEqual({ kiri: ["II#0", "III#1"], kanan: ["IV#2", "V#3"], lainnya: null });
    expect(sampulModel([2, 3, 4, 5, 6], true, true)).toEqual({ kiri: ["II#1", "III#2"], kanan: ["IV#3", "V#4"], lainnya: null });
    expect(sampulModel([25], true, true)).toEqual({ kiri: [], kanan: [], lainnya: null });
    expect(sampulModel([25], true, false)).toEqual({ kiri: [], kanan: [], lainnya: null });
  });

  it("Penggugat 1-25 pada Pdt.G: enam baris tampil, 18 'lainnya'; urutan 30-54 (bersambung jauh) tetap tampil di baru, hilang di lama", () => {
    const rapat = Array.from({ length: 25 }, (_, i) => i + 1);
    expect(sampulModel(rapat, true, true)).toEqual({ kiri: ["II#1", "III#2", "IV#3"], kanan: ["V#4", "VI#5", "VII#6"], lainnya: 18 });
    const jauh = Array.from({ length: 25 }, (_, i) => i + 30);
    expect(sampulModel(jauh, true, false).kiri).toEqual([]);
    expect(sampulModel(jauh, true, true)).toEqual({ kiri: ["II#1", "III#2", "IV#3"], kanan: ["V#4", "VI#5", "VII#6"], lainnya: 18 });
  });
});

describe("romawi-pihak - hasil perbandingan atas perkara nyata (hasil/bandingkan-ringkasan.json)", () => {
  const f = path.join(dir, "hasil/bandingkan-ringkasan.json");
  it("ringkasan perbandingan ada: semua perkara berpihak; perkara rapat tidak berubah kecuali 5896 untuk > 20 pihak; selisih hanya pada perkara tak rapat", () => {
    expect(existsSync(f), "hasil/bandingkan-ringkasan.json").toBe(true);
    const r = JSON.parse(readFileSync(f, "utf8")) as {
      total: number;
      galat: number;
      per_variabel: Record<string, { beda: number; beda_rapat: number; beda_tanpa_sebab: number }>;
      tak_rapat: { pihak1: number; pihak2: number; pihak4: number };
    };
    expect(r.total).toBeGreaterThan(10000);
    expect(r.galat).toBe(0);
    expect(Object.keys(r.per_variabel).sort()).toEqual(NOMOR.map(String).sort());
    for (const [no, v] of Object.entries(r.per_variabel)) {
      expect(v.beda_tanpa_sebab, `variabel ${no} berubah tanpa sebab`).toBe(0);
      if (no !== "5896") expect(v.beda_rapat, `variabel ${no} berubah pada perkara rapat`).toBe(0);
    }
    expect(r.tak_rapat).toEqual({ pihak1: 9, pihak2: 12, pihak4: 6 });
  });
});

describe("romawi-pihak - skrip pasang dan pulih", () => {
  const pasang = baca("pasang-satker.sh");
  const pulih = baca("pulih-satker.sh");

  it("urutan pasang: md5, prasyarat, cadangan, pasang, periksa, uji; gagal di tengah memulihkan; tanpa langkah fungsi", () => {
    const urut = ["md5sum -c MD5SUMS.txt", "PRASYARAT COCOK", "mysqldump", `$MY < "$N-PASANG.sql"`, "SEMUA COCOK", "UJI rapat perkara", "UJI tak rapat perkara", "touch \"$CAD/pasang.selesai\""];
    let pos = -1;
    for (const k of urut) {
      const i = pasang.indexOf(k, pos + 1);
      expect(i, k).toBeGreaterThan(pos);
      pos = i;
    }
    expect(pasang).toContain("pulih()");
    expect(pasang).toContain("batal()");
    expect(pasang).toContain("NOMOR_UBAH=$(cat nomor-ubah.txt)");
    expect(pasang).toContain('[ "$nlama" = "$NU" ]');
    expect(pasang).toContain("cmp -s");
    expect(pasang).toContain("timeout 300 mysql");
  });

  it("pulih memulihkan variabel dari cadangan, menolak bila cadangan tidak ada, dan tidak menghapus fungsi", () => {
    expect(pulih).toContain("abt_variabel-sebelum.sql");
    expect(pulih).toContain("CREATE TEMPORARY TABLE pu_lama LIKE abt_variabel;");
    expect(pulih).toContain("PULIH COCOK");
    expect(pulih).toContain("PULIH TIDAK LENGKAP");
    expect(pulih).not.toMatch(/DROP FUNCTION|routine_comment/);
    expect(baca("harap.txt").trim().split("\n")).toHaveLength(2);
  });

  it("daftar perkara uji: rapat, banyak (>20) dan tak rapat tidak saling tumpang tindih", () => {
    const daftar = (b: string) => baca(b).trim().split("\n");
    const rapat = daftar("perkara-rapat.txt");
    const banyak = daftar("perkara-banyak.txt");
    const tak = daftar("perkara-takrapat.txt");
    expect(rapat.length).toBeGreaterThanOrEqual(8);
    expect(banyak.length).toBeGreaterThanOrEqual(1);
    expect(tak.length).toBeGreaterThanOrEqual(8);
    expect(new Set([...rapat, ...banyak, ...tak]).size).toBe(rapat.length + banyak.length + tak.length);
    for (const n of [...rapat, ...banyak, ...tak]) expect(n).toMatch(/^\d+\/Pdt\.[GP]\/\d{4}\/PA\.Dgl$/);
  });
});
