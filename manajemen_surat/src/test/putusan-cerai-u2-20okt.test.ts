// @vitest-environment node
/**
 * ============================================================================
 * 20 OKT 2026 (agen U2) - PUTUSAN CERAI GUGAT / CERAI TALAK / KUMULASI / IKRAR: akibat perceraian, SEMA 1/2022, tenggang ikrar
 * ============================================================================
 *
 * Yang dijaga (perilaku, bukan sekadar teks):
 *   A  pengisi tab Anak (aleta_bot/services/abtIsianPutusanCerai20okt.js): mumayyiz atau belum menurut tanggal lahir, siapa yang kini
 *      mengasuh, campuran tidak ditebak, hanya SELECT, kegagalan satu kueri tidak melempar, jenis selain cerai tidak disentuh;
 *   B  susunIsian atas rantai variabel paket: isian keputusan muncul dengan pemicu petitum, opsional, tanda diisi manual, pilihan;
 *   C  paket ABT (abt-paket/u2-putusan-cerai-lengkap): nomor di jatah 4100-4299, ASCII murni, tanpa nama aplikasi, hanya SELECT,
 *      kurung dan kutip seimbang, PASANG.sql memuat persis isi katalog, PERIKSA.sql cocok dengan MD5, PULIH.sql hanya menghapus jatah;
 *   D  tambalan RTF: skrip tambal-rtf.pl pasang/periksa/pulih atas pohon tiruan (idempoten, cadangan, pulih kembali ke semula);
 *   E  rantai pemasangan: pengisi dipanggil SEBELUM blok S3 di abtUsulanService.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ISIAN_MANUAL, ISIAN_OPSIONAL } from "@/app/api/aleta-ecourt/blangko-derry/isian-metadata";
import { susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";

const AKAR = path.resolve(process.cwd(), "..");
const req = createRequire(path.join(AKAR, "aleta_bot", "package.json"));
const PAKET = path.join(AKAR, "abt-paket", "u2-putusan-cerai-lengkap");

type Usulan = { kode: string; nama: string; nilai: string; keyakinan: string; catatan: string; jagaIsianLama?: boolean; sumber: Array<{ asal: string; kalimat: string }> };
type Modul = {
  KODE_DIISI: string[];
  BELUM_MUMAYYIZ: string;
  SUDAH_MUMAYYIZ: string;
  usulanKeadaanAnak: (rows: unknown, pada?: string) => Usulan[];
  usulanDiasuhOleh: (rows: unknown, jenis: number) => Usulan[];
  usulanPutusanCerai: (id: number, q: (sql: string, p?: unknown[]) => Promise<unknown>, opsi?: { pada?: string }) => Promise<Usulan[]>;
};
const M = req(path.join(AKAR, "aleta_bot", "services", "abtIsianPutusanCerai20okt.js")) as Modul;

type Var = { no: number; nama: string; tipe: string; sql: string | null; default: string | null };
const VAR: Var[] = JSON.parse(readFileSync(path.join(PAKET, "data", "variabel.json"), "utf-8"));
const md5 = (s: string) => createHash("md5").update(Buffer.from(s, "latin1")).digest("hex");

describe("A - pengisi tab Anak (keadaan anak dan yang mengasuh)", () => {
  const anak = (nama: string, lahir: string, diasuh: string | number | null = "1") => ({ nama: nama.length > 1 ? nama : `Anak ${nama}`, lahir, diasuh });

  it("semua anak di bawah 12 tahun = belum mumayyiz (cukup) dengan sumber tab Anak", () => {
    const u = M.usulanKeadaanAnak([anak("Fulan bin Fulan", "2020-03-01"), anak("Fulanah binti Fulan", "2018-06-15")], "2026-10-20");
    expect(u).toHaveLength(1);
    expect(u[0]).toMatchObject({ kode: "4106", nilai: M.BELUM_MUMAYYIZ, keyakinan: "cukup", jagaIsianLama: true });
    expect(u[0].sumber[0].kalimat).toMatch(/SIPP tab Anak/);
    expect(u[0].sumber[0].kalimat).toMatch(/Fulan bin Fulan/);
  });

  it("12 tahun penuh = mumayyiz; sehari sebelum ulang tahun ke-12 masih belum", () => {
    expect(M.usulanKeadaanAnak([anak("Anak A", "2014-10-20")], "2026-10-20")[0].nilai).toBe(M.SUDAH_MUMAYYIZ);
    expect(M.usulanKeadaanAnak([anak("Anak A", "2014-10-21")], "2026-10-20")[0].nilai).toBe(M.BELUM_MUMAYYIZ);
  });

  it("anak berbeda umur (sebagian sudah mumayyiz) tidak ditebak: tanpa sumber dengan penjelasan", () => {
    const u = M.usulanKeadaanAnak([anak("Anak A", "2010-01-01"), anak("Anak B", "2020-01-01")], "2026-10-20");
    expect(u).toHaveLength(1);
    expect(u[0].keyakinan).toBe("tidak_ada_sumber");
    expect(u[0].nilai).toBe("");
    expect(u[0].catatan).toMatch(/1 dari 2 anak sudah mumayyiz/);
  });

  it("tanggal lahir kosong atau tidak sah pada salah satu anak = tidak ada usulan (tidak ditebak)", () => {
    expect(M.usulanKeadaanAnak([anak("Anak A", "2020-01-01"), anak("Anak B", "0000-00-00")], "2026-10-20")).toEqual([]);
    expect(M.usulanKeadaanAnak([anak("Anak A", "")], "2026-10-20")).toEqual([]);
    expect(M.usulanKeadaanAnak([], "2026-10-20")).toEqual([]);
  });

  it("yang kini mengasuh: kode 1 = Penggugat/Pemohon, kode 2 = Tergugat/Termohon sesuai jenis; campuran atau kode lain tidak ditebak", () => {
    expect(M.usulanDiasuhOleh([anak("A", "2020-01-01", "1"), anak("B", "2021-01-01", 1)], 347)[0]).toMatchObject({ kode: "2004", nilai: "Penggugat", keyakinan: "cukup" });
    expect(M.usulanDiasuhOleh([anak("A", "2020-01-01", "2")], 347)[0].nilai).toBe("Tergugat");
    expect(M.usulanDiasuhOleh([anak("A", "2020-01-01", "1")], 346)[0].nilai).toBe("Pemohon");
    expect(M.usulanDiasuhOleh([anak("A", "2020-01-01", "2")], 346)[0].nilai).toBe("Termohon");
    expect(M.usulanDiasuhOleh([anak("A", "2020-01-01", "1"), anak("B", "2021-01-01", "2")], 347)).toEqual([]);
    expect(M.usulanDiasuhOleh([anak("A", "2020-01-01", "3")], 347)).toEqual([]);
    expect(M.usulanDiasuhOleh([anak("A", "2020-01-01", null)], 347)).toEqual([]);
  });

  it("usulanPutusanCerai: hanya SELECT, urutan 2004 lalu 4106, jenis selain cerai dijawab kosong tanpa membaca tab Anak", async () => {
    const sql: string[] = [];
    const q = async (s: string) => {
      sql.push(s);
      if (/FROM perkara WHERE perkara_id/.test(s)) return [{ jenis: 347 }];
      return [{ nama: "Fulan bin Fulan", lahir: "2021-02-02", diasuh: "1" }];
    };
    const u = await M.usulanPutusanCerai(10, q, { pada: "2026-10-20" });
    expect(u.map((x) => x.kode)).toEqual(["2004", "4106"]);
    expect(sql.every((s) => /^\s*SELECT/i.test(s))).toBe(true);
    expect(u.every((x) => x.jagaIsianLama === true)).toBe(true);
    expect(JSON.stringify(u)).not.toMatch(/aleta/i);

    const sql2: string[] = [];
    const q2 = async (s: string) => {
      sql2.push(s);
      return [{ jenis: 360 }];
    };
    expect(await M.usulanPutusanCerai(10, q2)).toEqual([]);
    expect(sql2).toHaveLength(1);
  });

  it("kegagalan kueri tidak melempar; id tidak sah atau tanpa pembaca dijawab kosong", async () => {
    const gagal = async () => {
      throw new Error("db mati");
    };
    expect(await M.usulanPutusanCerai(10, gagal)).toEqual([]);
    expect(await M.usulanPutusanCerai(0, gagal)).toEqual([]);
    expect(await M.usulanPutusanCerai(10, undefined as never)).toEqual([]);
    let n = 0;
    const separuh = async (s: string) => {
      n += 1;
      if (/perkara_anak_pihak/.test(s)) throw new Error("tab Anak tidak ada");
      return [{ jenis: 346 }];
    };
    expect(await M.usulanPutusanCerai(10, separuh)).toEqual([]);
    expect(n).toBe(2);
  });

  it("KODE_DIISI menyebut persis kode yang bisa dipancarkan", () => {
    expect([...M.KODE_DIISI].sort()).toEqual(["2004", "4106"]);
  });
});

describe("B - susunIsian atas rantai variabel paket", () => {
  const katalog = new Map<string, Definisi>();
  for (const v of VAR) katalog.set(String(v.no), { kode: String(v.no), nama: v.nama, jenis: v.tipe, sql: v.sql || "", bawaan: v.default || "" });
  const isianLama: Array<[string, string]> = [
    ["6054", "Nafkah iddah"], ["9712", "NAFKAH IDDAH (cerai gugat) - ISIAN"], ["6055", "Mut'ah"], ["9713", "MUT'AH (cerai gugat) - ISIAN"],
    ["7120", "Nafkah Lampau (Madhiyah / Madliyah)"], ["9711", "NAFKAH MADLIYAH (cerai gugat) - ISIAN"], ["9740", "NAFKAH ANAK KE DEPAN: JUMLAH SETIAP BULAN - ISIAN"],
    ["6071", "Nafkah Anak"], ["6072", "Nafkah anak (masing-masing anak)"], ["9741", "NAFKAH ANAK: KENAIKAN PER TAHUN - ISIAN"], ["9050", "KENAIKAN NAFKAH ANAK PER TAHUN - ISIAN"],
    ["9715", "NAFKAH ISTRI - PEMBAYARAN SEBELUM TERGUGAT MENGAMBIL AKTA CERAI"], ["2004", "kini anak tersebut diasuh oleh"], ["8503", "ALASAN PERCERAIAN"],
    ["9944", "lama pisah : _ (_) tahun _ (_) bulan"], ["246", "Pisah Rumah"], ["8730", "HARTA BERSAMA: OBJEK YANG DITETAPKAN SEBAGAI HARTA BERSAMA"],
  ];
  for (const [k, nama] of isianLama) if (!katalog.has(k)) katalog.set(k, { kode: k, nama, jenis: "data_teks", sql: "", bawaan: "" });
  katalog.set("8505", { kode: "8505", nama: "AMAR BIAYA PERKARA", jenis: "data_sql", sql: "SELECT 1", bawaan: "" });
  const s = susunIsian(["4118", "4117", "4119", "4138", "8505"], katalog);
  const per = new Map(s.isian.map((b) => [b.kode, b]));

  it("semua isian keputusan dan pembantunya muncul sebagai isian tangan", () => {
    for (const k of ["4100", "4101", "4102", "4103", "4104", "4105", "4106", "4107", "4108", "4109"]) expect(per.has(k), `isian ${k}`).toBe(true);
  });

  it("isian keputusan tuntutan berpemicu petitum (menyala hanya bila petitum menuntut), pemicu dan keterangannya tercatat", () => {
    expect(per.get("4100")!.pemicu).toBe("4140");
    expect(per.get("4106")!.pemicu).toBe("4140");
    expect(per.get("4101")!.pemicu).toBe("4141");
    expect(per.get("4104")!.pemicu).toBe("4144");
    expect(per.get("4105")!.pemicu).toBe("4145");
    expect(per.get("4102")!.pemicu).toBe("");
    const pem = Object.fromEntries(s.pemicu.map((p) => [p.kode, p.keterangan]));
    for (const k of ["4140", "4141", "4144", "4145"]) expect(pem[k], k).toMatch(/petitum menuntut/);
  });

  it("keputusan adalah pilihan hakim: tanda diisi manual dengan alasan, pilihan lengkap, label bahasa pengguna", () => {
    for (const k of ["4100", "4101", "4102", "4103", "4104", "4105"]) {
      const b = per.get(k)!;
      expect(b.manual, k).toBe(true);
      expect(b.alasanManual).toMatch(/putusan majelis/);
      expect(b.pilihan).toEqual(expect.arrayContaining(["dikabulkan seluruhnya", "dikabulkan sebagian", "ditolak", "tidak dapat diterima"]));
      expect(b.nama).not.toMatch(/#\d{4}#|OTOMATIS|PILIH:/);
    }
    expect(per.get("4102")!.pilihan).toContain("diberikan secara ex officio (tidak dituntut)");
    expect(per.get("4104")!.pilihan).not.toContain("diberikan secara ex officio (tidak dituntut)");
    expect(per.get("4106")!.pilihan).toEqual(["belum mumayyiz (belum berumur 12 tahun)", "mumayyiz (berumur 12 tahun atau lebih)"]);
  });

  it("nafkah iddah, mut'ah dan waktu pembayaran opsional ('isian tambahan bila ada'); keputusan bertuntutan lain bukan opsional", () => {
    for (const k of ["4102", "4103", "4109"]) {
      expect(per.get(k)!.opsional, k).toBe(true);
      expect(per.get(k)!.labelPengguna).toBe(ISIAN_OPSIONAL[k]);
    }
    expect(per.get("4100")!.opsional).toBeUndefined();
  });

  it("isian lama yang dibaca kueri paket ikut tampil (nominal, kemampuan, lama pisah) dan tercatat dipakai oleh variabel paket", () => {
    for (const k of ["6054", "6055", "9712", "7120", "6071", "9741", "2004", "9944"]) expect(per.has(k), k).toBe(true);
    expect(per.get("6054")!.dipakaiOleh.some((x) => ["4119", "4138", "4112", "4132"].includes(x))).toBe(true);
  });

  it("ISIAN_MANUAL memuat 4100-4105, 4107, 4108 dan tidak memuat isian yang bisa otomatis (4106)", () => {
    for (const k of ["4100", "4101", "4102", "4103", "4104", "4105", "4107", "4108"]) expect(ISIAN_MANUAL[k], k).toBeTruthy();
    expect(ISIAN_MANUAL["4106"]).toBeUndefined();
  });
});

describe("C - paket ABT: katalog, PASANG, PERIKSA, PULIH", () => {
  const SISTEM = new Set(["0046", "0047", "0053", "0100", "0104", "8554", "8008", "8602", "5114", "7777", "0222", "0246", "9944"]);

  it("nomor di jatah 4100-4299, unik; nama dan kueri ASCII murni dan tanpa nama aplikasi", () => {
    const nomor = VAR.map((v) => v.no);
    expect(new Set(nomor).size).toBe(nomor.length);
    expect(nomor.every((n) => n >= 4100 && n <= 4299)).toBe(true);
    for (const v of VAR) {
      for (const t of [v.nama, v.sql || "", v.default || ""]) {
        expect(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(t), `ASCII ${v.no}`).toBe(true);
        expect(/aleta/i.test(t), `nama aplikasi ${v.no}`).toBe(false);
      }
    }
  });

  it("kueri hanya SELECT, kutip dan kurung seimbang, penanda sistem yang dikenal saja, perkara_id disisipkan", () => {
    for (const v of VAR.filter((x) => x.sql)) {
      const q = v.sql!;
      expect(/^SELECT\b/.test(q), `SELECT ${v.no}`).toBe(true);
      expect(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|REPLACE\s+INTO|CREATE)\b/i.test(q.replace(/REPLACE\(/gi, "")), `tulis ${v.no}`).toBe(false);
      // seimbang di luar kutip
      let kurung = 0;
      let kutip = "";
      for (let i = 0; i < q.length; i++) {
        const c = q[i];
        if (kutip) {
          if (c === "\\") i++;
          else if (c === kutip) {
            if (q[i + 1] === kutip) i++;
            else kutip = "";
          }
        } else if (c === "'" || c === '"') kutip = c;
        else if (c === "(") kurung++;
        else if (c === ")") kurung--;
        expect(kurung).toBeGreaterThanOrEqual(0);
      }
      expect(kutip, `kutip ${v.no}`).toBe("");
      expect(kurung, `kurung ${v.no}`).toBe(0);
      for (const t of q.matchAll(/#(\d{4})#/g)) expect(SISTEM.has(t[1]), `penanda ${t[1]} di ${v.no}`).toBe(true);
      expect(q).toContain("'#perkara_id#'");
      expect(q).toContain("aps_badilag.");
      expect(q.length, `panjang ${v.no}`).toBeLessThan(65000);
    }
  });

  it("isian keputusan bertipe data_teks dengan pilihan di default_data; pemicu 4140-4145 menghasilkan 'ya' atau kosong", () => {
    for (const n of [4100, 4101, 4102, 4103, 4104, 4105]) {
      const v = VAR.find((x) => x.no === n)!;
      expect(v.tipe).toBe("data_teks");
      expect(v.default).toMatch(/dikabulkan seluruhnya\ndikabulkan sebagian\nditolak\ntidak dapat diterima/);
    }
    for (const n of [4140, 4141, 4142, 4143, 4144, 4145]) {
      const v = VAR.find((x) => x.no === n)!;
      expect(v.tipe).toBe("data_sql");
      expect(v.sql).toMatch(/^SELECT IF\(c\.t[hnimdb] = 1, 'ya', ''\) AS data FROM/);
    }
  });

  it("kalimat penting ada pada variabel yang tepat: SEMA 1/2022 hanya huruf F, Pasal 70 ayat (6) hanya cerai talak, [PERIKSA] bila petitum diam-diam", () => {
    const q = (n: number) => VAR.find((x) => x.no === n)!.sql!;
    expect(q(4118)).toMatch(/Nomor 1 Tahun 2022/);
    expect(q(4118)).toMatch(/UPPER\(c\.v_8503\) REGEXP 'F'/);
    expect(q(4117)).toMatch(/Pasal 70 ayat \(6\)/);
    expect(q(4117)).toMatch(/IF\(c\.ct = 1,/);
    for (const n of [4110, 4111, 4112, 4113, 4114, 4115]) expect(q(n)).toMatch(/\[PERIKSA: petitum menuntut/);
    expect(q(4112)).toMatch(/ex officio/);
    expect(q(4110)).toMatch(/Pasal 105 huruf b Kompilasi Hukum Islam/); // mumayyiz
    expect(q(4111)).toMatch(/Nomor 3 Tahun 2015/);
    expect(q(4119).length).toBeGreaterThan(q(4112).length);
  });

  it("PASANG.sql memuat persis katalog (heksa dekode = nama, tipe, kueri, bawaan), prasyarat jatah kosong, satu transaksi", () => {
    const sql = readFileSync(path.join(PAKET, "paket-satker", "abt-u2-PASANG.sql"), "utf-8");
    expect(sql).toMatch(/PRASYARAT COCOK - memasang/);
    expect(sql).toMatch(/no_var BETWEEN 4100 AND 4299\) = 0/);
    expect(sql).toMatch(/START TRANSACTION;[\s\S]*COMMIT;/);
    expect(/aleta/i.test(sql)).toBe(false);
    const baris = [...sql.matchAll(/INSERT INTO abt_variabel \([^)]*\) VALUES \((\d+), (0x[0-9a-f]+), (0x[0-9a-f]+), NULL, NULL, NULL, NULL, (NULL|0x[0-9a-f]+), (NULL|0x[0-9a-f]+), NULL, 0, 'admin'\);/g)];
    expect(baris).toHaveLength(VAR.length);
    const dekode = (h: string) => (h === "NULL" ? null : Buffer.from(h.slice(2), "hex").toString("latin1"));
    for (const [i, b] of baris.entries()) {
      const v = VAR[i];
      expect(Number(b[1])).toBe(v.no);
      expect(dekode(b[2])).toBe(v.nama);
      expect(dekode(b[3])).toBe(v.tipe);
      expect(dekode(b[4])).toBe(v.sql);
      expect(dekode(b[5])).toBe(v.default);
    }
    expect(sql.match(/INSERT INTO/g)).toHaveLength(VAR.length);
  });

  it("PERIKSA.sql: panjang dan MD5 tiap variabel cocok dengan katalog, ada baris SEMUA COCOK", () => {
    const sql = readFileSync(path.join(PAKET, "paket-satker", "abt-u2-PERIKSA.sql"), "utf-8");
    expect(sql).toContain("'SEMUA COCOK'");
    for (const v of VAR) {
      const m = new RegExp(`SELECT ${v.no} AS no_var,[^\\n]*?${v.sql ? v.sql.length : "NULL"} AS panjang_harap[^\\n]*?${v.sql ? md5(v.sql) : ""}`).exec(sql);
      expect(m, `periksa ${v.no}`).not.toBeNull();
      expect(sql).toContain(`MD5(nama) = '${md5(v.nama)}'`);
    }
  });

  it("PULIH.sql hanya menghapus jatah 4100-4299 (tidak ada variabel lama yang disentuh)", () => {
    const sql = readFileSync(path.join(PAKET, "paket-satker", "abt-u2-PULIH.sql"), "utf-8");
    const hapus = [...sql.matchAll(/DELETE FROM abt_variabel WHERE ([^;]+);/g)].map((x) => x[1]);
    expect(hapus).toEqual(["no_var BETWEEN 4100 AND 4299"]);
    expect(/\b(UPDATE|INSERT|REPLACE\s+INTO|DROP|TRUNCATE)\b/i.test(sql)).toBe(false);
  });

  it("MD5SUMS.txt cocok dengan berkas paket-satker", () => {
    const dir = path.join(PAKET, "paket-satker");
    const baris = readFileSync(path.join(dir, "MD5SUMS.txt"), "utf-8").trim().split("\n");
    const tercatat = new Map(baris.map((b) => [b.slice(34), b.slice(0, 32)]));
    for (const f of readdirSync(dir)) {
      if (f === "MD5SUMS.txt") continue;
      expect(tercatat.get(f), `md5 ${f}`).toBe(createHash("md5").update(readFileSync(path.join(dir, f))).digest("hex"));
    }
  });
});

describe("D - tambalan RTF dan skrip tambal-rtf.pl", () => {
  const dir = path.join(PAKET, "paket-satker");
  const tsv = readFileSync(path.join(dir, "rtf-tambal.tsv"), "ascii").trim().split("\n").map((l) => l.split("\t"));
  const dekode = (b: string) => Buffer.from(b, "base64").toString("latin1");
  const daftar = readFileSync(path.join(dir, "rtf-daftar-tambal.tsv"), "utf-8").trim().split("\n").map((l) => l.split("\t"));

  it("setiap tambalan: jangkar tidak kosong, jumlah >= 1, penanda baru memuat jangkar atau menggantikan blok beban", () => {
    expect(tsv.length).toBeGreaterThan(100);
    const nama = new Set<string>();
    for (const [rel, urut, jumlah, lama, baru] of tsv) {
      nama.add(dekode(rel));
      expect(Number(urut)).toBeGreaterThanOrEqual(1);
      expect(Number(jumlah)).toBeGreaterThanOrEqual(1);
      const l = dekode(lama);
      const b = dekode(baru);
      expect(l.length).toBeGreaterThan(5);
      expect(b.includes(l) || b === "#4150#", `${dekode(rel)} ${l.slice(0, 20)}`).toBe(true);
      expect(/aleta/i.test(b)).toBe(false);
      const baruTanpaLama = b.replace(l, "");
      for (const t of baruTanpaLama.matchAll(/#(\d{4})#/g)) expect([4117, 4118, 4119, 4138, 4139, 4150]).toContain(Number(t[1]));
    }
    expect(nama.size).toBe(daftar.length);
  });

  it("aturan: tenggang ikrar hanya di blangko cerai talak; varian Mut'ah Iddah memakai 4139 (bukan 4138/4119); BAS ikrar [2a] memakai 4150", () => {
    const per = new Map<string, string[]>();
    for (const [rel, , , , baru] of tsv) per.set(dekode(rel), [...(per.get(dekode(rel)) || []), dekode(baru)]);
    let ikrarCt = 0;
    for (const [rel, ops] of per) {
      const semua = ops.join(" ");
      if (semua.includes("#4117#")) {
        ikrarCt++;
        expect(/1a Perceraian CT|CT /.test(rel), rel).toBe(true);
      }
      if (/Mut'ah Iddah/.test(rel) && !/\] BAS|BAS /.test(rel)) {
        expect(semua).toContain("#4139#");
        expect(semua).not.toContain("#4138#");
        expect(semua).not.toContain("#4119#");
      }
      if (/Ikrar Talak - P & T Hadir, Ada Beban/.test(rel)) expect(semua).toContain("#4150#");
    }
    expect(ikrarCt).toBeGreaterThan(10);
  });

  const perl = spawnSync("perl", ["-e", "use MIME::Base64; print 1"], { encoding: "utf-8" });
  const md5sum = spawnSync("md5sum", ["--version"], { encoding: "utf-8" });
  const bisa = perl.status === 0 && md5sum.status === 0;

  it.skipIf(!bisa)("skrip tambal-rtf.pl: periksa, pasang (cadangan), ulang = SUDAH (idempoten), pulih kembali ke semula", () => {
    const tmp = mkdtempSync(path.join(process.env.TMP || tmpdir(), "u2-tambal-"));
    try {
      const B = path.join(tmp, "derry_briantono");
      const C = path.join(tmp, "cadangan");
      // pohon tiruan: tiap berkas = jangkar-jangkarnya (kali jumlah) di dalam kerangka RTF
      const awal = new Map<string, string>();
      const ops = new Map<string, Array<[string, number]>>();
      for (const [rel, , jumlah, lama] of tsv) ops.set(dekode(rel), [...(ops.get(dekode(rel)) || []), [dekode(lama), Number(jumlah)]]);
      let n = 0;
      for (const [rel, daftarOp] of ops) {
        if (n++ >= 12) break;
        const isi = "{\\rtf1 " + daftarOp.map(([l, j]) => (l + " teks ").repeat(j)).join("") + "}";
        const p = path.join(B, rel);
        mkdirSync(path.dirname(p), { recursive: true });
        writeFileSync(p, Buffer.from(isi, "latin1"));
        awal.set(rel, isi);
      }
      const jalan = (mode: string) => execFileSync("perl", ["tambal-rtf.pl", mode, B, C], { encoding: "utf-8", cwd: dir });
      const r0 = jalan("periksa");
      expect(r0).toMatch(/RINGKAS COCOK=12/);
      expect(r0).toMatch(/LEWAT=\d+/);
      const r1 = jalan("pasang");
      expect(r1).toMatch(/RINGKAS DITAMBAL=12 SUDAH=\d+ LEWAT=\d+/);
      for (const [rel] of awal) {
        const baru = readFileSync(path.join(B, rel), "latin1");
        expect(baru).not.toBe(awal.get(rel));
        expect(baru).toMatch(/#41(17|18|19|38|39|50)#/);
      }
      const r2 = jalan("periksa");
      expect(r2).toMatch(/RINGKAS COCOK=0 SUDAH=\d+/);
      expect(readdirSync(path.join(C, "rtf-lama")).length).toBe(12);
      const r3 = jalan("pulih");
      expect(r3).toMatch(/PULIH=12 DILEWATI=0/);
      for (const [rel, isi] of awal) expect(readFileSync(path.join(B, rel), "latin1")).toBe(isi);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("pasang tidak menyentuh berkas yang jangkarnya tidak cocok (dilewati dan dilaporkan)", () => {
    if (!bisa) return;
    const tmp = mkdtempSync(path.join(process.env.TMP || tmpdir(), "u2-tambal-"));
    try {
      const B = path.join(tmp, "derry_briantono");
      const [rel] = tsv[0];
      const p = path.join(B, dekode(rel));
      mkdirSync(path.dirname(p), { recursive: true });
      writeFileSync(p, "{\\rtf1 isi lain tanpa jangkar}");
      const r = execFileSync("perl", ["tambal-rtf.pl", "pasang", B, path.join(tmp, "cad")], { encoding: "utf-8", cwd: dir });
      expect(r).toMatch(/LEWAT\t/);
      expect(readFileSync(p, "utf-8")).toBe("{\\rtf1 isi lain tanpa jangkar}");
      expect(existsSync(path.join(tmp, "cad", "rtf-lama", "T001.rtf"))).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("E - rantai pemasangan pengisi", () => {
  it("abtUsulanService memanggil pengisi U2 SEBELUM blok S3 (data terstruktur tab Anak mengalahkan tebakan posita)", () => {
    const src = readFileSync(path.join(AKAR, "aleta_bot", "services", "abtUsulanService.js"), "utf-8");
    const u2 = src.indexOf('require("./abtIsianPutusanCerai20okt").usulanPutusanCerai');
    const s3 = src.indexOf('require("./abtIsianLengkap20okt").usulanLengkap');
    expect(u2).toBeGreaterThan(0);
    expect(s3).toBeGreaterThan(u2);
    expect(src).toMatch(/pengisi tambahan: gagal membaca tidak menggagalkan usulan SIPP lain/);
  });
});
