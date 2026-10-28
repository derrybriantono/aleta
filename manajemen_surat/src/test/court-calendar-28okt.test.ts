// @vitest-environment node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { folderTugas } from "@/lib/tugas-blangko";

/**
 * 28 Okt 2026 - blangko "Court Calendar" mandiri di Blangko Derry (paket abt-paket/court-calendar-28okt). Bagian court calendar (PERMA 7/2022 dan Keputusan Dirjen
 * Badilag 1465) semula hanya ada di dalam BAS 2 (penetapan jadwal) dan BAS 3 (perubahan jadwal karena gugatan rekonvensi) ALUR 04. Uji ini menjaga isi paket di repo (tanpa DB):
 * berkas utuh, variabel yang sama dengan BAS, hak menu sama dengan menu ALUR 04 (id 963), pasang/pulih aman, tanpa nama aplikasi di ABT.
 */
const akar = path.resolve(process.cwd(), "..");
const dir = path.join(akar, "abt-paket/court-calendar-28okt");
const ps = path.join(dir, "paket-satker");
const N = "abt-court-calendar-28okt";
const FOLDER = "98c Court Calendar - BAS";
const NAMA1 = "Court Calendar - Penetapan Jadwal Persidangan.rtf";
const NAMA2 = "Court Calendar - Perubahan Jadwal Persidangan (Gugatan Rekonvensi).rtf";
const baca = (b: string) => readFileSync(path.join(ps, b), "utf8");
const rtf = (n: string) => readFileSync(path.join(ps, "rtf", "derry_briantono", FOLDER, n)).toString("latin1");
const md5 = (s: string | Buffer) => createHash("md5").update(s).digest("hex");
const NOMOR = baca("nomor-variabel.txt").trim().split(",");
const pengenal = (r: string) => [...new Set([...r.matchAll(/#(\d{1,5})#/g)].map((m) => m[1]))].sort();
/** teks polos kasar: buang kontrol RTF (cukup untuk memeriksa frasa) */
const polos = (r: string) => r.replace(/\\'[0-9a-f]{2}/g, "").replace(/\\[a-zA-Z]+-?\d* ?/g, "").replace(/[{}]/g, "");

describe("paket Court Calendar 28 Okt", () => {
  it("MD5SUMS.txt cocok dengan isi paket-satker dan memuat setiap berkasnya", () => {
    const baris = baca("MD5SUMS.txt").trim().split("\n");
    const daftar = new Set<string>();
    for (const b of baris) {
      const [m, ...n] = b.split(/\s{2}/);
      const nama = n.join("  ");
      daftar.add(nama);
      expect(md5(readFileSync(path.join(ps, nama))), nama).toBe(m);
    }
    const nyata: string[] = [];
    const jalan = (d: string, rel: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        if (e.name === "cadangan" || e.name === "MD5SUMS.txt") continue;
        if (e.isDirectory()) jalan(path.join(d, e.name), `${rel}${e.name}/`);
        else nyata.push(`${rel}${e.name}`);
      }
    };
    jalan(ps, "");
    expect([...daftar].sort()).toEqual(nyata.sort());
    expect(nyata.length).toBe(13);
  });

  it("dua blangko RTF baru di folder baru; daftar-rtf.tsv cocok md5; tidak ada folder cadangan di repo", () => {
    const tsv = baca("daftar-rtf.tsv").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
    expect(tsv.map((x) => x[1]).sort()).toEqual([NAMA1, NAMA2].sort());
    for (const [folder, berkas, h] of tsv) {
      expect(folder).toBe(`derry_briantono/${FOLDER}`);
      expect(md5(readFileSync(path.join(ps, "rtf", folder, berkas)))).toBe(h);
    }
    expect(existsSync(path.join(ps, "cadangan"))).toBe(false);
    expect(baca("folder-baru.txt")).toContain(`derry_briantono/${FOLDER}`);
    expect(baca("folder-ada.txt")).toContain("ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)");
  });

  it("RTF: kurung seimbang, ASCII, tanpa kata nama aplikasi, tanpa variabel/placeholder asing", () => {
    for (const n of [NAMA1, NAMA2]) {
      const r = rtf(n);
      expect(r.startsWith("{\\rtf1")).toBe(true);
      let d = 0;
      for (let i = 0; i < r.length; i++) {
        if (r[i] === "\\") { i++; continue; }
        if (r[i] === "{") d++;
        else if (r[i] === "}") { d--; expect(d).toBeGreaterThanOrEqual(0); }
      }
      expect(d, n).toBe(0);
      expect(/[^\x00-\x7f]/.test(r), n).toBe(false);
      expect(/aleta/i.test(r), n).toBe(false);
      expect(/APABILA|\[\s*\]|\.\.\./.test(polos(r)), n).toBe(false);
    }
  });

  it("variabel yang dipakai = nomor-variabel.txt (37, semua sudah dipakai BAS 2/3); tanpa variabel baru", () => {
    const semua = [...new Set([...pengenal(rtf(NAMA1)), ...pengenal(rtf(NAMA2))])].sort();
    expect(semua).toEqual(NOMOR.map((x) => x.padStart(4, "0")).sort());
    expect(NOMOR.length).toBe(37);
    // paket tidak membawa SQL variabel/fungsi
    for (const f of readdirSync(ps).filter((x) => x.endsWith(".sql"))) {
      const s = baca(f);
      expect(/INSERT INTO abt_variabel|CREATE FUNCTION|abt_data_teks/i.test(s), f).toBe(false);
    }
    // jadwal: tujuh tahap (blangko 1) dan tujuh tahap (blangko 2), variabel hari/tanggal berpasangan
    for (const v of ["7115", "7111", "7116", "7112", "7117", "7113", "7119", "2111", "7121", "2112", "7122", "8438", "8545", "8544"]) expect(pengenal(rtf(NAMA1))).toContain(v);
    for (const v of ["7116", "7112", "7117", "7113", "7118", "7114", "7119", "2111", "7121", "2112", "7122", "8438", "8545", "8544", "7085", "7086"]) expect(pengenal(rtf(NAMA2))).toContain(v);
  });

  it("isi: penetapan court calendar PERMA 7/2022 lengkap dengan kop, identitas perkara, tabel jadwal, tempat/tanggal, dan tanda tangan Ketua Majelis + Panitera Pengganti", () => {
    const t1 = polos(rtf(NAMA1));
    for (const f of [
      "PENETAPAN", "Nomor #0001#", "TENTANG JADWAL PERSIDANGAN (COURT CALENDAR)", "Dalam perkara #0048# antara:", "#0098#, sebagai #7036#;", "melawan", "#0102#, sebagai #7037#;",
      "Peraturan Mahkamah Agung Nomor 7 Tahun 2022", "Nomor 363/KMA/SK/XII/2022", "jadwal persidangan (court calendar)", "MENETAPKAN",
      "Jawaban", "Replik", "Duplik", "Pembuktian #7036#", "Pembuktian #7037#", "Kesimpulan", "Pengucapan #5368#",
      "Ditetapkan di", "Pada tanggal", "#4004#,", "#6034#,", "#0012#", "#6033#",
    ]) expect(t1, f).toContain(f);
    const t2 = polos(rtf(NAMA2));
    for (const f of [
      "TENTANG PERUBAHAN JADWAL PERSIDANGAN (COURT CALENDAR)", "KARENA ADA GUGATAN REKONVENSI", "Replik konvensi dan Jawaban rekonvensi", "Duplik konvensi dan Replik rekonvensi", "Duplik rekonvensi",
      "Pembuktian #7085#", "Pembuktian #7086#", "Pengucapan #5368#", "mengunggah perubahan court calendar", "Ditetapkan di", "#6034#,", "#0012#",
    ]) expect(t2, f).toContain(f);
  });

  it("PRASYARAT/PASANG/PERIKSA/PULIH: hanya satu baris abt_menu, hak = menu ALUR 04 (963), id = MAX+1, tanpa menimpa, pulih hanya bila masih isi paket", () => {
    const pr = baca(`${N}-PRASYARAT.sql`);
    expect(pr).toContain("(SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (" + NOMOR.join(",") + "))");
    expect(pr).toContain("m.id = 963");
    const hak = ["proses_id_min = 80", "proses_id_max = 297", "perkara_id_min = 15", "perkara_id_max = 15", "perkara_id_referensi = 'alur_perkara_id'", "user_cek = 3",
      "user_grup_id = '1|30|500|430|1000|1010|1020'", "user_top_id = '1|30'", "user_validator = '10|20'"];
    for (const h of hak) expect(pr, h).toContain(`m.${h}`);
    const ps_ = baca(`${N}-PASANG.sql`);
    expect(ps_).toContain("INSERT INTO abt_menu");
    expect(ps_).toContain("IFNULL(MAX(id), 0) + 1");
    expect(ps_).toContain("WHERE NOT EXISTS");
    expect((ps_.match(/INSERT INTO/g) || []).length).toBe(1);
    expect(/UPDATE |DELETE |DROP |TRUNCATE /i.test(ps_.replace(/^--.*$/gm, ""))).toBe(false);
    expect(ps_).toContain(`'${FOLDER}'`);
    expect(ps_).toContain("'1|30|500|430|1000|1010|1020', '1|30', '10|20'");
    const pl = baca(`${N}-PULIH.sql`);
    expect((pl.match(/DELETE FROM/g) || []).length).toBe(1);
    expect(pl).toMatch(/DELETE FROM abt_menu WHERE direktori = '98c Court Calendar - BAS' AND parent_direktori = 'derry_briantono' AND MD5\(/);
    // PERIKSA dan PULIH memakai md5 yang sama
    const m5 = [...baca(`${N}-PERIKSA.sql`).matchAll(/= '([0-9a-f]{32})'/g)].map((m) => m[1]);
    expect(new Set(m5).size).toBe(1);
    expect(pl).toContain(m5[0]);
    expect(baca(`${N}-PERIKSA.sql`)).toContain("SEMUA COCOK");
  });

  it("pasang-satker.sh: md5 -> prasyarat 37|0|1 atau 37|1|1 -> cadangan -> pasang -> periksa -> folder+berkas -> periksa berkas; gagal = pulih; pulih-satker.sh berakhir PULIH COCOK", () => {
    const ps_ = baca("pasang-satker.sh");
    expect(ps_).toContain("HARAP='37|0|1'");
    expect(ps_).toContain("ULANG='37|1|1'");
    const urut = ["md5sum -c MD5SUMS.txt", "-PRASYARAT.sql", "mysqldump", `$N-PASANG.sql`, `$N-PERIKSA.sql`, "mkdir \"$B/$f\"", "berkas_rtf.py pasang", "berkas_rtf.py periksa", "SELESAI"];
    let pos = -1;
    for (const u of urut) {
      const i = ps_.indexOf(u, pos + 1);
      expect(i, u).toBeGreaterThan(pos);
      pos = i;
    }
    expect((ps_.match(/pulih_sql/g) || []).length).toBeGreaterThanOrEqual(5);
    expect(ps_).not.toMatch(/^\s*(ssh|scp)\s|git push/m);
    const pl = baca("pulih-satker.sh");
    expect(pl).toContain("PULIH COCOK");
    expect(pl).toContain("rmdir");
    expect(pl).toContain("berkas_rtf.py pulih");
  });

  it("portal mengenal folder baru sebagai BAS (bukan putusan/relaas)", () => {
    const f = folderTugas(FOLDER);
    expect(f).not.toBeNull();
    expect(f!.jenis).toBe("bas");
    expect(f!.folder).toBe(`derry_briantono/${FOLDER}`);
  });

  it("PASANG.md ada dan memuat PRASYARAT, perintah pasang, dan pulih", () => {
    const md = readFileSync(path.join(dir, "PASANG.md"), "utf8");
    for (const k of ["37|0|1", "37|1|1", "md5sum -c MD5SUMS.txt", "pasang-satker.sh", "pulih-satker.sh", "98c Court Calendar - BAS", "Keluaran benar"]) expect(md, k).toContain(k);
  });
});
