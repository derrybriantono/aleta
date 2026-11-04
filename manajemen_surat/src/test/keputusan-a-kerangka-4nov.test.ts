// @vitest-environment node
/**
 * Paket ABT abt-keputusan-a-kerangka-4nov (keputusan Derry 182/184, 4 Nov 2026): kerangka berisian + variabel baru.
 *   A4 nafkah iddah per bulan/hari dari isian #6054# (#9268#/#9269#) di 9 varian CT Mut'ah Iddah  | A8 BAS Itsbat [01a]/[01ab] tabel tanya-jawab
 *   A9 variabel #9266#/#9267# (keterangan saksi 3/4 T) + 4 blangko putusan kontradiktoir CG/CT [02] 3-4 saksi T | A10 AUA [01b] dipecah per paragraf.
 * Penjaga: isi paket, md5 dasar = hasil keputusan-a-mekanis-4nov, ubahan tepat, blangko baru utuh (kurung seimbang, tanpa nama aplikasi),
 * SQL variabel (4 nomor, nama <= 200 huruf), MD5SUMS, uji laptop (pasang/ulang/pulih/prasyarat), uji angka nafkah iddah.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO = path.resolve(process.cwd(), "..");
const AKAR = path.join(REPO, "abt-paket/keputusan-a-kerangka-4nov");
const P = path.join(AKAR, "paket-satker");
const baca = (n: string) => readFileSync(path.join(P, n));
const tsv = (p: string) => readFileSync(p, "utf8").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
const md5 = (b: Buffer) => createHash("md5").update(b).digest("hex");
const KODE = /\\[a-zA-Z]+-?\d* ?|[{}]|\r|\n/g;
const tampak = (s: string) => s.replace(KODE, "");
const seimbang = (b: Buffer) => {
  let d = 0;
  for (let i = 0; i < b.length; i++) {
    if (b[i] === 0x5c) { i++; continue; }
    if (b[i] === 0x7b) d++;
    else if (b[i] === 0x7d && --d < 0) return false;
  }
  return d === 0;
};
type Potong = { kode: string; off: number; lama: Buffer; baru: Buffer };
const potongan = (dir: string): Potong[] => tsv(path.join(dir, "tambal.tsv")).map(([k, off, lama, baru]) => ({
  kode: k, off: Number(off), lama: Buffer.from(lama, "base64"), baru: Buffer.from(baru, "base64"),
}));
const daftar = tsv(path.join(P, "daftar-tambal.tsv"));
const potong = potongan(P);
const baru = tsv(path.join(P, "daftar-rtf.tsv"));
const PM = path.join(REPO, "abt-paket/keputusan-a-mekanis-4nov/paket-satker");
const PE = path.join(REPO, "abt-paket/audit-ejaan-4nov/paket-satker");
const PA = path.join(REPO, "abt-paket/audit-mekanis-4nov/paket-satker");
const sql = (n: string) => readFileSync(path.join(P, `abt-keputusan-a-kerangka-4nov-${n}.sql`), "latin1");
const berkasDari = (kode: string) => daftar.find((d) => d[0] === kode)![1];

describe("paket keputusan-a-kerangka-4nov", () => {
  it("12 blangko ditambal (14 potongan): 9 CT Mut'ah Iddah, 2 BAS Itsbat, 1 AUA [01b]; 4 blangko baru", () => {
    expect(daftar).toHaveLength(12);
    expect(potong).toHaveLength(14);
    for (const d of daftar) {
      expect(d[0]).toMatch(/^K\d{4}$/);
      expect(potong.filter((p) => p.kode === d[0]), d[1]).toHaveLength(Number(d[4]));
    }
    expect(daftar.filter((d) => /1a Perceraian CT\//.test(d[1]))).toHaveLength(9);
    expect(daftar.filter((d) => /- BAS ITSTBAT NIKAH -\//.test(d[1]))).toHaveLength(2);
    expect(daftar.filter((d) => /8 Asal Usul Anak\/\[01b\]/.test(d[1]))).toHaveLength(1);
    expect(baru).toHaveLength(4);
  });

  it("A4: kalimat tetap Rp600.000,00/Rp20.000,00 diganti #9268#/#9269# dan tidak lagi merah (\\cf1)", () => {
    const a4 = potong.filter((p) => /Rp6/.test(p.lama.toString("latin1")));
    expect(a4).toHaveLength(9);
    for (const p of a4) {
      expect(tampak(p.lama.toString("latin1"))).toBe("Rp600.000,00 (enam ratus ribu rupiah) setiap bulan atau Rp20.000,00 (dua puluh ribu rupiah) setiap harinya");
      expect(tampak(p.baru.toString("latin1"))).toBe("#9268# setiap bulan atau #9269# setiap harinya");
      expect(p.lama.toString("latin1")).toContain("\\cf3 ");
      expect(p.baru.toString("latin1")).not.toContain("\\cf3");
      expect(p.baru.toString("latin1")).toContain("\\cf1 #9268#");
      expect(seimbang(p.lama) && seimbang(p.baru)).toBe(true);
    }
  });

  it("A8: tabel tanya-jawab teks tetap -> #5058# / #5059# (2 BAS); A10: \\line -> \\par, #9259#/#9260# paragraf sendiri", () => {
    const k8 = daftar.filter((d) => /BAS ITSTBAT/.test(d[1])).map((d) => d[0]);
    for (const k of k8) {
      const ps = potong.filter((p) => p.kode === k);
      expect(ps).toHaveLength(2);
      expect(tampak(ps[0].baru.toString("latin1"))).toBe("#5058#");
      expect(tampak(ps[1].baru.toString("latin1"))).toBe("#5059#");
      expect(tampak(ps[0].lama.toString("latin1"))).toContain("Apakah saksi kenal dengan");
      expect(seimbang(ps[0].baru) && seimbang(ps[1].baru)).toBe(true);
    }
    const k10 = daftar.find((d) => /8 Asal Usul Anak\/\[01b\]/.test(d[1]))![0];
    const p10 = potong.filter((p) => p.kode === k10);
    expect(p10).toHaveLength(1);
    const lama = p10[0].lama.toString("latin1");
    const hasil = p10[0].baru.toString("latin1");
    expect(lama).toContain("\\line #9259#\\line 2.\\tab");
    expect(hasil).not.toContain("\\line");
    expect(hasil).toContain("{#9259#}{\\par }");
    expect(hasil).toContain("{#9260#}{\\par }");
    expect(hasil.match(/#9259#/g)).toHaveLength(1);
    expect(hasil.match(/#9260#/g)).toHaveLength(1);
    expect(seimbang(p10[0].lama)).toBe(seimbang(p10[0].baru));
    expect(tampak(hasil).replace(/\s+/g, "")).toBe(tampak(lama).replace(/\s+/g, ""));
  });

  it("A9: 4 blangko baru utuh; md5 sesuai daftar; 3/4 saksi T dengan #9266#/#9267#, kata bilangan menyesuaikan; tanpa nama aplikasi", () => {
    for (const [folder, nama, m, asal] of baru) {
      const b = readFileSync(path.join(P, "rtf", folder, nama));
      expect(md5(b), nama).toBe(m);
      expect(seimbang(b), nama).toBe(true);
      const t = tampak(b.toString("latin1"));
      expect(b.toString("latin1")).not.toMatch(/aleta/i);
      expect(asal).toMatch(/^\[02\] \[Kabul\] C[GT] - F\.rtf$/);
      const empat = /\(4 Saksi T\)/.test(nama);
      expect(t.match(/#9266#/g)).toHaveLength(1);
      expect(t.match(/#9267#/g)?.length ?? 0).toBe(empat ? 1 : 0);
      expect(t).toContain("#6138#, umur #6139# tahun, agama #6140#, pendidikan #6141#, pekerjaan #6142#, bertempat tinggal di #6143#, saksi mengaku sebagai #8922#");
      expect(t.includes("#8934#, umur #8935# tahun, agama #8936#, pendidikan #8937#, pekerjaan #8938#, bertempat tinggal di #8939#, saksi mengaku sebagai #8940#")).toBe(empat);
      expect(t).toContain(empat ? "4 (empat) orang saksi yaitu #6100# (Saksi I), #6106# (Saksi II), #6138# (Saksi III) dan #8934# (Saksi IV), keempatnya merupakan #1251#, #1252#, #8922# dan #8940#" : "3 (tiga) orang saksi yaitu #6100# (Saksi I), #6106# (Saksi II) dan #6138# (Saksi III), ketiganya merupakan #1251#, #1252# dan #8922#");
      expect(t).toContain(empat ? "saksi pertama, saksi kedua, saksi ketiga maupun saksi keempat" : "saksi pertama, saksi kedua maupun saksi ketiga");
      expect(t).not.toMatch(/#0047# telah menghadirkan 2 \(dua\)/);
      expect(t).toContain("bukti elektronik T.3 dan " + (empat ? "4 (empat)" : "3 (tiga)") + " orang saksi");
      // penanda daftar saksi: nomor 3. (dan 4.) sebagai teks daftar
      expect(b.toString("latin1")).toContain("3.\\tab ");
      if (empat) expect(b.toString("latin1")).toContain("4.\\tab ");
    }
  });

  it("variabel baru: 9266 9267 9268 9269 (data_sql, nama <= 200 huruf), tanpa fungsi baru dan tanpa nama aplikasi; PRASYARAT/PERIKSA/PULIH berjaga sidik", () => {
    const pasang = sql("PASANG");
    expect(pasang.match(/^INSERT INTO abt_variabel/gm)).toHaveLength(4);
    for (const n of [9266, 9267, 9268, 9269]) expect(pasang).toContain(`SELECT ${n}, CONVERT(0x`);
    expect(pasang).not.toMatch(/CREATE (FUNCTION|PROCEDURE|TRIGGER)/i);
    expect(pasang).not.toMatch(/aleta/i);
    expect(sql("PRASYARAT")).toContain("BETWEEN 9266 AND 9269");
    expect(baca("harap.txt").toString("utf8").trim().split("\n")).toEqual(["0|0|6", "0|4|6"]);
    expect(sql("PULIH").match(/^DELETE v FROM abt_variabel v WHERE v\.no_var = 92(66|67|68|69)/gm)).toHaveLength(4);
    expect(sql("PERIKSA")).toContain("SEMUA COCOK");
    const kueri = tsv(path.join(P, "uji-kueri.tsv")).map(([n, b64]) => [n, Buffer.from(b64, "base64").toString("latin1")]);
    expect(kueri.map((k) => k[0])).toEqual(["9266", "9267", "9268", "9269"]);
    expect(kueri[0][1]).toContain('a.nama = "#6138#"');
    expect(kueri[1][1]).toContain('a.nama = "#8934#"');
    expect(kueri[2][1]).toContain("no_var = 6054");
    expect(kueri[2][1]).toContain("isian_rtf_terbilang");
    expect(kueri[3][1]).toContain("/ 30");
    for (const [, q] of kueri) {
      expect(q).not.toMatch(/aleta/i);
      expect(q.split("'").length % 2).toBe(1);
    }
    const hex = [...pasang.matchAll(/SELECT (\d+), CONVERT\(0x([0-9a-f]+) USING latin1\)/g)];
    expect(hex).toHaveLength(4);
    for (const m of hex) expect(Buffer.from(m[2], "hex").length, m[1]).toBeLessThanOrEqual(200);
    const dibaca = readFileSync(path.join(AKAR, "hasil/uji-iddah.txt"), "utf8");
    expect(dibaca).toContain("GAGAL=0 dari 11");
    expect(dibaca).toContain("Rp600.000,00 (enam ratus ribu rupiah)\tRp20.000,00 (dua puluh ribu rupiah)");
  });

  it("md5 dasar = md5_baru paket keputusan-a-mekanis / audit-ejaan / audit-mekanis (yang tercakup); berkas A8/A10 tidak bersentuhan paket mekanis", () => {
    const sesudah = (dir: string) => new Map(tsv(path.join(dir, "daftar-tambal.tsv")).map((b) => [b[1], b[3]] as [string, string]));
    const km = sesudah(PM);
    const e = sesudah(PE);
    const a = sesudah(PA);
    let dariMekanis = 0;
    for (const d of daftar) {
      const harap = km.get(d[1]) ?? e.get(d[1]) ?? a.get(d[1]);
      if (km.has(d[1])) dariMekanis++;
      if (harap) expect(d[2], d[1]).toBe(harap);
    }
    expect(dariMekanis).toBeGreaterThanOrEqual(8); // 9 CT Mut'ah Iddah: isteri -> istri oleh paket mekanis
    expect(new Set(daftar.map((d) => d[1])).size).toBe(12);
  });

  it("isi paket = MD5SUMS (termasuk rtf/); tambal_rtf.py dan berkas_rtf.py sama dengan paket asal; urutan cek sebelum pasang; uji laptop lengkap", () => {
    for (const l of baca("MD5SUMS.txt").toString("utf8").split("\n").filter(Boolean)) {
      const h = l.split(/\s+/)[0];
      const rel = l.slice(h.length).replace(/^\s+\*?/, "");
      expect(md5(readFileSync(path.join(P, rel))), rel).toBe(h);
    }
    expect(md5(baca("tambal_rtf.py"))).toBe(md5(readFileSync(path.join(PM, "tambal_rtf.py"))));
    expect(md5(baca("berkas_rtf.py"))).toBe(md5(readFileSync(path.join(REPO, "abt-paket/in-lupa-prosesi-3nov/paket-satker/berkas_rtf.py"))));
    const sh = baca("pasang-satker.sh").toString("utf8");
    expect(sh).toContain("N=abt-keputusan-a-kerangka-4nov");
    expect(sh).toContain('"BERKAS SIAP" ] || gagal');
    expect(sh.indexOf("tambal_rtf.py cek")).toBeLessThan(sh.indexOf("tambal_rtf.py pasang"));
    expect(sh.indexOf('PASANG SQL + PERIKSA')).toBeLessThan(sh.indexOf("BERKAS RTF (tambalan"));
    const uji = readFileSync(path.join(AKAR, "hasil/uji-lokal.txt"), "utf8");
    for (const s of ["PRASYARAT COCOK (0|0|6)", "PRASYARAT COCOK (0|4|6)", "TAMBAL=12", "BUAT=4", "SUDAH=12", "SUDAH_BARU=4", "UJI: 4 kueri berjalan", "SIDIK DAN VARIABEL TETAP", "HAPUS=4", "PULIH=12", "PULIH COCOK (0|0|6)",
      "SIDIK = AWAL", "VARIABEL = AWAL", "SAMA DENGAN PASANG PERTAMA", "GAGAL=1 SIAP=11", "GAGAL=9 SIAP=3", "prasyarat '1|0|6'", "berkas lain bernama sama sudah ada", "BIARKAN=1 HAPUS=3"]) expect(uji, s).toContain(s);
    expect(uji.match(/TIDAK ADA YANG BERUBAH/g)).toHaveLength(4);
    expect(uji.match(/PERIKSA: SEMUA COCOK/g)!.length).toBeGreaterThanOrEqual(3);
  });

  const POHON = process.env.POHON_AUDIT_4NOV ?? "D:/aleta-dev/kerja/audit-abt-4nov/pohon";
  it.skipIf(!existsSync(path.join(POHON, "derry_briantono")))("pohon laptop: audit-mekanis -> audit-ejaan -> keputusan-a-mekanis -> paket ini = md5_baru; pola lama hilang", () => {
    const terapkan = (b: Buffer, ps: Potong[]) => {
      for (const p of [...ps].sort((x, y) => y.off - x.off)) {
        expect(b.subarray(p.off, p.off + p.lama.length).equals(p.lama)).toBe(true);
        b = Buffer.concat([b.subarray(0, p.off), p.baru, b.subarray(p.off + p.lama.length)]);
      }
      return b;
    };
    const rantai = [PA, PE, PM].map((dir) => ({ pot: potongan(dir), daftar: new Map(tsv(path.join(dir, "daftar-tambal.tsv")).map((d) => [d[1], d] as [string, string[]])) }));
    for (const d of daftar) {
      let b: Buffer = readFileSync(path.join(POHON, d[1]));
      for (const r of rantai) {
        const x = r.daftar.get(d[1]);
        if (x) { b = terapkan(b, r.pot.filter((p) => p.kode === x[0])); expect(md5(b), d[1]).toBe(x[3]); }
      }
      expect(md5(b), d[1]).toBe(d[2]);
      b = terapkan(b, potong.filter((x) => x.kode === d[0]));
      expect(md5(b), d[1]).toBe(d[3]);
      expect(seimbang(b)).toBe(true);
    }
    expect(berkasDari("K0001")).toBeTruthy();
  });
});
