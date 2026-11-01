// @vitest-environment node
/**
 * 1 NOV 2026 - paket ABT ke-30 abt-perbaikan-1nov (keputusan 89-B2/73 dan 92):
 *   A. tanggal/hari pembuktian #0046# (2111/7119) dan #0047# (2112/7121) memakai aturan TUNDAAN (kembaran SQL dari bot ddf15a3a);
 *   B. 5 perbaikan dasar hukum di 14 blangko Derry (kata saja yang diganti).
 * Yang dijaga dari isi paket SUNGGUHAN (penulisan ke blangko dan variabel ABT, jadi ketat):
 *   - MD5SUMS cocok; md5 lama != baru; kode unik; tanpa folder terhapus; tanpa kata nama aplikasi;
 *   - perilaku berkas: tiap potongan diterapkan ke potongan RTF mentah di spesifikasi (hasil keputusan 92) -> teks polos = "teks baru (persis)";
 *   - SQL: hanya 4 variabel, hanya bila md5 persis dasar (= hasil pembuktian-urut-1nov); PULIH membalik; pola tundaan = pola bot;
 *     cabang Court Calendar tidak berubah; kueri ringan (satu pencarian sidang sebelumnya per baris lewat LEFT JOIN; tanpa REGEXP_REPLACE);
 *   - urutan: rantai.sh = URUTAN-PASANG-1nov.md, perbaikan-1nov ke-30 paling akhir.
 */
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const PAKET = path.join(AKAR, "abt-paket/perbaikan-1nov");
const DIR = path.join(PAKET, "paket-satker");
const baca = (b: string) => readFileSync(path.join(DIR, b), "utf8");
const dekode = (b: string) => Buffer.from(b, "base64").toString("latin1");
const DAFTAR = baca("daftar-tambal.tsv").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
const TAMBAL = baca("tambal.tsv").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
const per = new Map<string, { off: number; lama: string; baru: string }[]>();
for (const [kode, off, lama, baru] of TAMBAL) {
  const a = per.get(kode) ?? [];
  a.push({ off: Number(off), lama: dekode(lama), baru: dekode(baru) });
  per.set(kode, a);
}
// spesifikasi keputusan 92 (salinan hasil/spesifikasi-perbaikan-blangko-1nov.tsv): kolom berkas, kemunculan, teks lama, teks baru, potongan RTF mentah
const SPEK = readFileSync(path.join(PAKET, "hasil/spesifikasi-perbaikan-blangko-1nov.tsv"), "utf8")
  .split(/\r?\n/)
  .slice(1)
  .filter(Boolean)
  .map((l) => l.split("\t"));

/** Teks polos kasar dari potongan RTF: kode kendali dibuang, 舠/舡 jadi tanda petik, spasi dirapatkan. */
function rtfPolos(rtf: string): string {
  return rtf
    .replace(/\\uc1 \\u8220 \?/g, "“")
    .replace(/\\uc1 \\u8221 \?/g, "”")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
const polosSpek = (s: string) => s.replace(/\s+/g, " ").trim();

describe("isi paket sungguhan - berkas (B: keputusan 92)", () => {
  it("MD5SUMS cocok; 14 berkas, 15 potongan; md5 lama != baru; kode unik; tanpa terhapus; skrip tanpa CRLF; tanpa nama aplikasi", () => {
    for (const baris of baca("MD5SUMS.txt").trim().split(/\r?\n/)) {
      const [md5, nama] = baris.split(/\s+\*?/);
      expect(createHash("md5").update(readFileSync(path.join(DIR, nama))).digest("hex"), nama).toBe(md5);
    }
    expect(DAFTAR.length).toBe(14);
    expect(new Set(DAFTAR.map((d) => d[0])).size).toBe(14);
    expect(new Set(DAFTAR.map((d) => d[1])).size).toBe(14);
    for (const d of DAFTAR) {
      expect(d[1]).toMatch(/^derry_briantono\/.+\.rtf$/);
      expect(d[1]).not.toMatch(/terhapus/);
      expect(d[2]).toMatch(/^[0-9a-f]{32}$/);
      expect(d[3]).toMatch(/^[0-9a-f]{32}$/);
      expect(d[2]).not.toBe(d[3]);
      expect(per.get(d[0])?.length, d[1]).toBe(Number(d[4]));
    }
    expect(TAMBAL.length).toBe(15);
    for (const sh of ["pasang-satker.sh", "pulih-satker.sh"]) expect(baca(sh)).not.toMatch(/\r\n/);
    for (const p of [...per.values()].flat()) expect(p.lama + p.baru).not.toMatch(/aleta/i);
  });

  it("daftar berkas dan md5 lama = spesifikasi keputusan 92 (14 berkas, md5 cocok dengan dasar 29 paket)", () => {
    expect(SPEK.length).toBe(14);
    const menurutBerkas = new Map(DAFTAR.map((d) => [d[1], d]));
    for (const r of SPEK) {
      const d = menurutBerkas.get(`derry_briantono/${r[2]}`);
      expect(d, r[2]).toBeTruthy();
      expect(d![2], r[2]).toBe(r[3]);
      expect(r[4]).toBe("1"); // satu kemunculan per berkas
    }
  });

  it("perilaku: potongan diterapkan ke potongan RTF mentah spesifikasi -> teks polos persis 'teks baru' (5 temuan, 14 berkas)", () => {
    const hitung: Record<string, number> = {};
    for (const r of SPEK) {
      const [no, temuan, , , , teksLama, teksBaru, , potongRtf] = r;
      hitung[no] = (hitung[no] ?? 0) + 1;
      const d = DAFTAR.find((x) => x[1] === `derry_briantono/${r[2]}`)!;
      let potong = potongRtf;
      const ps = per.get(d[0])!;
      for (const p of ps) {
        // potongan harus berada di dalam potongan RTF spesifikasi (bagian tanpa kode terpecah tetap utuh)
        expect(potong.includes(p.lama), `${temuan}: '${p.lama}' ada di potongan spesifikasi`).toBe(true);
        potong = potong.replace(p.lama, p.baru);
      }
      expect(polosSpek(rtfPolos(potong)), temuan).toBe(polosSpek(teksBaru));
      expect(polosSpek(rtfPolos(potongRtf)), `${temuan} (lama)`).toBe(polosSpek(teksLama));
    }
    // jumlah berkas per temuan (nomor temuan spesifikasi): 1 -> 7 KHI Pasal 7(4); 2 -> 1 poligami; 3 -> 1 harta bersama; 4 -> 1 itsbat bawah umur; 5 -> 4 dispensasi kawin
    expect(hitung).toEqual({ "1": 7, "2": 1, "3": 1, "4": 1, "5": 4 });
  });

  it("potongan hanya KATA: tiap potongan kecil, tanpa kode RTF tersisip, kecuali bunyi kutipan; temuan 4 dan 3 memakai bunyi naskah resmi", () => {
    for (const ps of per.values()) {
      for (const p of ps) {
        expect(p.lama.length).toBeLessThan(140);
        expect(p.lama + p.baru).not.toMatch(/[{}]/);
      }
    }
    const semua = [...per.values()].flat().map((p) => p.baru);
    expect(semua).toContain("apabila pria dan wanita sudah mencapai umur 19 (sembilan belas) tahun");
    expect(semua).toContain("suami dan isteri dan harta benda yang diperoleh masing-masing sebagai hadiah atau warisan, adalah dibawah");
    expect(semua).toContain("angka");
    expect(semua).toContain("ayat (2)");
  });
});

describe("isi paket sungguhan - SQL variabel (A: tundaan)", () => {
  const sqlPasang = baca("abt-perbaikan-1nov-PASANG.sql");
  const sqlPulih = baca("abt-perbaikan-1nov-PULIH.sql");
  const sqlPras = baca("abt-perbaikan-1nov-PRASYARAT.sql");
  const sqlPeriksa = baca("abt-perbaikan-1nov-PERIKSA.sql");
  const heks = (s: string) => [...s.matchAll(/UNHEX\('([0-9A-F]+)'\)/g)].map((m) => Buffer.from(m[1], "hex").toString("latin1"));
  const baru = heks(sqlPasang);
  const lama = heks(sqlPulih);
  const nomor = [...sqlPasang.matchAll(/WHERE no_var = (\d+) AND/g)].map((m) => m[1]);
  const md5 = (s: string) => createHash("md5").update(s, "latin1").digest("hex");

  it("PASANG: satu transaksi, HANYA 2111/7119/2112/7121, tiap UPDATE dijaga md5 dasar; PULIH membalik; tanpa variabel/menu baru; tanpa nama aplikasi", () => {
    expect(nomor).toEqual(["2111", "7119", "2112", "7121"]);
    expect(baru.length).toBe(4);
    expect(lama.length).toBe(4);
    expect(sqlPasang).toMatch(/START TRANSACTION;[^]*COMMIT;\s*$/);
    expect(sqlPasang).not.toMatch(/INSERT INTO|DELETE FROM|CREATE|DROP/);
    expect(sqlPulih).not.toMatch(/INSERT INTO|DELETE FROM|CREATE|DROP/);
    // PASANG menjaga md5 LAMA; PULIH menjaga md5 BARU
    const jagaPasang = [...sqlPasang.matchAll(/MD5\(REPLACE\(sql_query, CONCAT\(DATABASE\(\), '\.'\), 'aps_badilag\.'\)\) = '([0-9a-f]{32})'/g)].map((m) => m[1]);
    const jagaPulih = [...sqlPulih.matchAll(/MD5\(REPLACE\(sql_query, CONCAT\(DATABASE\(\), '\.'\), 'aps_badilag\.'\)\) = '([0-9a-f]{32})'/g)].map((m) => m[1]);
    expect(jagaPasang).toEqual(lama.map(md5));
    expect(jagaPulih).toEqual(baru.map(md5));
    expect(sqlPeriksa).toContain("SEMUA COCOK");
    expect(baca("harap.txt").trim().split(/\r?\n/)).toEqual(["4|0", "0|4"]);
    for (const s of [sqlPasang, sqlPulih, sqlPras, sqlPeriksa, ...baru]) expect(s).not.toMatch(/aleta/i);
  });

  it("dasar = hasil paket pembuktian-urut-1nov (ke-22): md5 'A' PRASYARAT sama dengan md5 'B' PRASYARAT paket itu", () => {
    const ke22 = readFileSync(path.join(AKAR, "abt-paket/pembuktian-urut-1nov/paket-satker/abt-pembuktian-urut-1nov-PRASYARAT.sql"), "utf8");
    const dasar = lama.map(md5).sort();
    const b22 = [...ke22.matchAll(/'([0-9a-f]{32})'/g)].map((m) => m[1]).slice(4).sort();
    expect(b22.length).toBe(4);
    expect(dasar).toEqual(b22);
    expect(sqlPras).toMatch(/no_var IN \(2111,7119,2112,7121\)/);
    // PRASYARAT: A (dasar) lalu B (baru)
    const semua = [...sqlPras.matchAll(/'([0-9a-f]{32})'/g)].map((m) => m[1]);
    expect(semua.slice(0, 4).sort()).toEqual(lama.map(md5).sort());
    expect(semua.slice(4).sort()).toEqual(baru.map(md5).sort());
  });

  it("kueri baru: pola tundaan = pola bot ddf15a3a; cabang Court Calendar tidak berubah; ringan (MariaDB 5.5)", () => {
    const bot = readFileSync(path.join(PAKET, "alat/tahapPembuktianService-ddf15a3a.js"), "utf8");
    const tahapLain = /const RE_TAHAP_LAIN = \/(.*?)\/;/.exec(bot)![1];
    const ganda = /const RE_PIHAK_GANDA = \/(.*?)\/;/.exec(bot)![1].split("\\s").join("[[:space:]]");
    expect(tahapLain).toBe("jawab|replik|duplik|kesimpulan|putus|musyawarah|mediasi|ikrar|pembacaan|sela|damai");
    for (let i = 0; i < 4; i += 1) {
      const b = baru[i];
      const l = lama[i];
      expect(b).toContain(`REGEXP '${tahapLain}'`);
      expect(b).toContain(`REGEXP '${ganda}'`);
      // cabang Court Calendar (SELECT ... UNION ALL) sama persis dengan dasar; juga akhir kueri (cabang pelengkap kosong, kecuali syarat sidang)
      const cc = (s: string) => s.slice(0, s.indexOf("FROM\r\n  perkara_jadwal_sidang j"));
      expect(cc(b), nomor[i]).toBe(cc(l));
      expect(cc(b)).toContain("perkara_court_calendar");
      expect(b).toContain("ORDER BY j.tanggal_sidang, j.id\r\nLIMIT 1)");
      // sidang sebelumnya dicari SEKALI per baris (LEFT JOIN + LIMIT 1), bukan subkueri berulang
      expect(b).toContain("LEFT JOIN perkara_jadwal_sidang h ON h.id = (SELECT x.id FROM perkara_jadwal_sidang x WHERE x.perkara_id = j.perkara_id");
      expect(b).toMatch(/ORDER BY x\.tanggal_sidang DESC, x\.id DESC LIMIT 1\)/);
      expect(b).not.toMatch(/CURDATE\(\)|REGEXP_REPLACE|\\b|\(\?<|\(\?=/i);
      expect(b.length).toBeLessThan(30000);
      expect(b.replace(/#perkara_id#/g, "")).not.toMatch(/#\d+#/);
      // pola dasar (T, P, T_MULAI, CUKUP) tetap sama dengan pola bot
      const posix = new Function(`const SP = "[[:space:]]+"; return ${/const POSIX = (\{[^]*?\n\});/.exec(bot)![1].replace(/\n\};?$/, "\n}")};`)() as Record<string, string>;
      for (const k of ["T", "P", "T_MULAI", "CUKUP"]) expect(b, `${nomor[i]} ${k}`).toContain(`REGEXP '${posix[k]}'`);
    }
  });

  it("variabel bersyarat sama untuk pasangan: 2111 = 7119 dan 2112 = 7121 hanya beda cabang sidang pertama/hari (syarat sidang identik)", () => {
    const syarat = (s: string) => s.slice(s.indexOf("LEFT JOIN perkara_jadwal_sidang h"));
    const potong = (s: string) => syarat(s).split("ORDER BY j.tanggal_sidang, j.id")[0];
    expect(potong(baru[0])).toBe(potong(baru[1]));
    expect(potong(baru[2])).toBe(potong(baru[3]));
    expect(potong(baru[0])).not.toBe(potong(baru[2]));
  });
});

describe("acuan perilaku A (salinan bot ddf15a3a): contoh aturan tundaan yang dimaksud keputusan 89-B2/73", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bot = createRequire(import.meta.url)(path.join(PAKET, "alat/tahapPembuktianService-ddf15a3a.js")) as {
    tahapPembuktian: (s: unknown[], o?: { gugatan?: boolean }) => { sisi: string | null }[];
    mulaiTahap: (s: unknown[], o?: { gugatan?: boolean }) => { P: string | null; T: string | null };
  };
  const sd = (id: number, tg: string, agenda: string, alasanDitunda = "", keterangan = "") => ({ sidangId: id, tanggalSidang: tg, agenda, alasanDitunda, keterangan });

  it("tundaan 'pembuktian Tergugat' menjadikan sidang berikutnya (agenda umum) sidang pembuktian Tergugat; 'pembuktian lanjutan Penggugat'/'saksi Penggugat' -> Penggugat", () => {
    const t = bot.mulaiTahap([sd(1, "2026-01-05", "Jawaban", "Pembuktian Penggugat"), sd(2, "2026-01-12", "Sidang lanjutan", "Untuk Pembuktian Tergugat"), sd(3, "2026-01-19", "Sidang lanjutan", "Kesimpulan")]);
    // sidang 2: tundaan sebelumnya 'Pembuktian Penggugat' -> Penggugat mulai 12-01; sidang 3: tundaan 'Untuk Pembuktian Tergugat' -> Tergugat mulai 19-01
    expect(t).toEqual({ P: "2026-01-12", T: "2026-01-19" });
    expect(bot.tahapPembuktian([sd(1, "2026-01-05", "Jawaban", "saksi Penggugat"), sd(2, "2026-01-12", "Sidang lanjutan", "Pembuktian lanjutan Penggugat")]).map((x) => x.sisi)).toEqual([null, "P"]);
  });

  it("tundaan tanpa sebutan pihak -> aturan tahap keputusan 52; agenda tahap lain (jawab, kesimpulan, putus) tidak berubah menjadi pembuktian", () => {
    const r = bot.tahapPembuktian([sd(1, "2026-01-05", "Pembuktian", "Pembuktian lanjutan"), sd(2, "2026-01-12", "Pembuktian lanjutan", "")]);
    expect(r.map((x) => x.sisi)).toEqual(["P", "P"]);
    const lain = bot.tahapPembuktian([sd(1, "2026-01-05", "Jawaban", "Pembuktian Tergugat"), sd(2, "2026-01-12", "Kesimpulan", "")]);
    expect(lain.map((x) => x.sisi)).toEqual([null, null]);
  });
});

describe("urutan pasang", () => {
  const urut = readFileSync(path.join(AKAR, "abt-paket/URUTAN-PASANG-1nov.md"), "utf8");
  const rantai = readFileSync(path.join(AKAR, "abt-paket/uji-rantai-31okt/rantai.sh"), "utf8");
  const daftarRantai = /^URUT="([^"]+)"/m.exec(rantai)![1].split(/\s+/);
  const daftarUrut = [...urut.matchAll(/^### (\d+)\. `([a-z0-9-]+)`/gm)].map((m) => [Number(m[1]), m[2]] as const);

  it("rantai.sh dan URUTAN-PASANG-1nov.md memuat paket yang sama dalam urutan yang sama; perbaikan-1nov ke-30 sesudah tanya-jawab-format-1nov", () => {
    expect(daftarUrut.map((x) => x[1])).toEqual(daftarRantai);
    expect(daftarUrut.map((x) => x[0])).toEqual(Array.from({ length: daftarUrut.length }, (_, i) => i + 1));
    expect(daftarRantai.length).toBeGreaterThanOrEqual(30);
    expect(daftarRantai[28]).toBe("tanya-jawab-format-1nov");
    expect(daftarRantai[29]).toBe("perbaikan-1nov");
    for (const p of daftarRantai) expect(existsSync(path.join(AKAR, "abt-paket", p, "paket-satker/pasang-satker.sh")), p).toBe(true);
  });
});
