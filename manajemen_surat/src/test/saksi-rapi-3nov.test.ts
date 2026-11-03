// @vitest-environment node
/**
 * 3 NOV 2026 - keterangan saksi di putusan RAPI dan TIDAK MENGGANTUNG (permintaan Derry, perkara 534/Pdt.G/2026).
 *
 * 1. Butir "-<tab>Bahwa ..." keterangan saksi (#9259#-#9265#, satu paragraf blangko; ABT mengganti <br> dengan \par sehingga
 *    semua butir mewarisi sifat paragraf itu) SEJAJAR dengan identitas saksinya: "-" di tepi kiri teks identitas, teks sesudah
 *    tab dan baris lanjutan menggantung 400 twip (\fi-400 \li L+400 \tx L+400), tanpa \cufi/\culi (satuan aksara mengalahkan
 *    \li di Word/WPS). Identitas saksi ke-3..5 di varian "(3/4/5 Saksi)" yang kurung kurawalnya rusak (Word memotong putusan
 *    sesudah "3.") dibetulkan. Paket ABT abt-paket/saksi-rapi-3nov (tambalan ber-md5, tanpa ubahan teks).
 * 2. Jawaban yang hanya "tidak tahu" / "tidak mengetahuinya" / "tidak pernah melihatnya" dilengkapi objek dari pertanyaannya
 *    (isian_rtf_tahu_lengkap di isian_rtf_ket_saksi). Katalog saksi ekstensi tidak boleh memuat jawaban menggantung.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const DIR = path.join(AKAR, "abt-paket/saksi-rapi-3nov/paket-satker");
const N = "abt-saksi-rapi-3nov";
const baca = (b: string) => readFileSync(path.join(DIR, b), "latin1");
const dekode = (b: string) => Buffer.from(b, "base64").toString("latin1");
const baris = (b: string) => baca(b).split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
const DAFTAR = baris("daftar-tambal.tsv");
const POTONG = baris("tambal.tsv").map(([kode, off, lama, baru]) => ({ kode, off: Number(off), lama: dekode(lama), baru: dekode(baru) }));
const teksPolos = (r: string) => r.replace(/\{\\\*[^{}]*\}/g, "").replace(/\\[a-z]+-?\d* ?/g, "").replace(/[{}\s]/g, "");

function kurung(s: string): number {
  let d = 0;
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] === "\\") i += 1;
    else if (s[i] === "{") d += 1;
    else if (s[i] === "}") d -= 1;
  }
  return d;
}

/** Jawaban menggantung: kata kerja tahu/lihat/dengar dinegasikan tanpa objek di ujung jawaban, atau seluruh jawaban hanya itu. */
const POLA_GANTUNG_UTUH = /^(?:(?:tidak|ya|iya)\s*,\s*)?(?:saya\s+)?(?:juga\s+|memang\s+)?(?:tidak|kurang|belum)\s+(?:pernah\s+)?(?:tahu|tau|mengetahui|melihat|mendengar|menyaksikan|kenal|mengenal)(?:nya)?\s*[;.]?\s*$/i;
/** Klausa terakhir (sesudah koma/titik koma) yang hanya "[adapun] saya tidak pernah melihat" - kata kerja tanpa objek. */
const POLA_GANTUNG_KLAUSA = /^\s*(?:adapun|tetapi|namun|sedangkan|tapi)?\s*(?:saya\s+)?(?:sendiri\s+)?(?:juga\s+)?(?:tidak|kurang|belum)\s+(?:pernah\s+)?(?:tahu|tau|mengetahui|melihat|mendengar|menyaksikan|kenal|mengenal)\s*[;.]?\s*$/i;
const menggantung = (t: string) => POLA_GANTUNG_UTUH.test(t) || POLA_GANTUNG_KLAUSA.test(t.split(/[,;:]/).pop() ?? "");

function* daun(x: unknown, jalan: string[]): Generator<[string[], string]> {
  if (typeof x === "string") yield [jalan, x];
  else if (Array.isArray(x)) for (let i = 0; i < x.length; i += 1) yield* daun(x[i], [...jalan, String(i)]);
  else if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) yield* daun(v, [...jalan, k]);
}

describe("katalog saksi ekstensi - tidak ada jawaban 'tidak tahu' menggantung", () => {
  for (const folder of ["saksi-katalog", "saksi-katalog-jenis"]) {
    it(`${folder}: jawaban per butir dan jawaban umum menyebut APA yang tidak diketahui`, () => {
      const salah: string[] = [];
      let diperiksa = 0;
      for (const f of readdirSync(path.join(AKAR, "ekstensi-sipp", folder)).filter((x) => x.endsWith(".json"))) {
        const k = JSON.parse(readFileSync(path.join(AKAR, "ekstensi-sipp", folder, f), "utf8"));
        for (const q of k.pertanyaan ?? []) {
          for (const [jalan, t] of daun(q.jawaban ?? {}, [q.id])) {
            if (jalan.includes("maksud")) continue;
            diperiksa += 1;
            if (menggantung(t)) salah.push(`${f} ${jalan.join(".")}: ${t}`);
          }
        }
        for (const [jalan, t] of daun(k.jawabanUmum ?? {}, ["jawabanUmum"])) {
          if (jalan.includes("maksud")) continue;
          diperiksa += 1;
          if (menggantung(t)) salah.push(`${f} ${jalan.join(".")}: ${t}`);
          if (jalan[1] === "tidak-tahu" && !t.includes("{hal}")) salah.push(`${f} ${jalan.join(".")}: tanpa {hal}: ${t}`);
        }
      }
      expect(diperiksa).toBeGreaterThan(10000);
      expect(salah).toEqual([]);
    });
  }

  it("pola penjaga memang menangkap bentuk yang dilaporkan", () => {
    for (const t of ["saya tidak tahu;", "Tidak tahu", "Saya tidak mengetahuinya;", "Saya tidak pernah melihatnya", "adapun saya tidak pernah menyaksikan"]) {
      expect(menggantung(t), t).toBe(true);
    }
    for (const t of ["saya tidak tahu proses akad jual beli", "Saya tidak pernah melihat Tergugat memukul Penggugat;", "{hal} tidak saya ketahui", "mengenai {hal} saya tidak tahu sama sekali"]) {
      expect(menggantung(t), t).toBe(false);
    }
  });
});

describe(`paket ABT ${N} - fungsi keterangan saksi`, () => {
  const F = baca(`${N}-FUNGSI.sql`);
  const LAMA = baca(`${N}-FUNGSI-LAMA.sql`);
  const ket = F.slice(F.indexOf("CREATE DEFINER=CURRENT_USER FUNCTION `isian_rtf_ket_saksi`"));

  it("isian_rtf_ket_saksi memanggil isian_rtf_tahu_lengkap tepat sekali, sesudah saring penutup dan sebelum 'saya' -> 'saksi'", () => {
    expect(ket.match(/isian_rtf_tahu_lengkap\(t, tq\)/g)?.length).toBe(1);
    const a = ket.indexOf("isian_rtf_saring_penutup(t, tq)");
    const b = ket.indexOf("isian_rtf_tahu_lengkap(t, tq)");
    const c = ket.indexOf("isian_rtf_ganti_kata(t, 'saya', 'saksi')");
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it("selain satu baris itu, isian_rtf_ket_saksi sama dengan versi terpasang (FUNGSI-LAMA)", () => {
    const lama = LAMA.slice(LAMA.indexOf("DROP FUNCTION IF EXISTS `isian_rtf_ket_saksi`"), LAMA.indexOf("DROP FUNCTION IF EXISTS `isian_rtf_tahu_lengkap`"));
    const baru = F.slice(F.indexOf("DROP FUNCTION IF EXISTS `isian_rtf_ket_saksi`"));
    const bersih = (s: string) => s.replace("        SET t = isian_rtf_tahu_lengkap(t, tq);\n", "").replace(", S3N tidak tahu dilengkapi'", "'");
    expect(bersih(baru)).toBe(lama);
    expect(LAMA).toContain("DROP FUNCTION IF EXISTS `isian_rtf_objek_tanya`");
  });

  it("badan fungsi baru tanpa garis miring balik (MariaDB 5.5) dan tanpa kata nama aplikasi", () => {
    const baruSaja = F.slice(0, F.indexOf("DROP FUNCTION IF EXISTS `isian_rtf_ket_saksi`"));
    expect(baruSaja).not.toContain("\\");
    expect(F.toLowerCase()).not.toContain("aleta");
  });

  it("PERIKSA memuat contoh Derry (proses akad jual beli) dan kasus yang harus dibiarkan", () => {
    const P = baca(`${N}-PERIKSA.sql`);
    expect(P).toContain("'Saya tidak tahu proses akad jual beli'");
    expect(P).toContain("'Masalah nafkah, saya tidak tahu;'");
    expect(baca("harap.txt").trim().split("\n")).toEqual(["1|0|0", "0|2|1"]);
  });
});

describe(`paket ABT ${N} - blangko: keterangan saksi sejajar identitas`, () => {
  it("MD5SUMS cocok dengan isi paket", () => {
    for (const l of baca("MD5SUMS.txt").split("\n").filter(Boolean)) {
      const [m, nama] = l.split(/\s+\*?/);
      expect(createHash("md5").update(readFileSync(path.join(DIR, nama))).digest("hex"), nama).toBe(m);
    }
  });

  it("daftar berkas: hanya derry_briantono, tanpa folder terhapus, md5 berubah, kode unik", () => {
    expect(DAFTAR.length).toBeGreaterThan(290);
    expect(new Set(DAFTAR.map((d) => d[0])).size).toBe(DAFTAR.length);
    for (const [, rel, m0, m1] of DAFTAR) {
      expect(rel.startsWith("derry_briantono/")).toBe(true);
      expect(rel.toLowerCase()).not.toContain("terhapus");
      expect(m0).not.toBe(m1);
    }
  });

  it("tiap potongan inden keterangan: \\fi-400 \\li=\\lin=\\tx, tanpa \\cufi/\\culi, teks tidak berubah", () => {
    const inden = POTONG.filter((p) => /\\fi-400 \\li\d+ \\lin\d+ \\tql \\tx\d+/.test(p.baru));
    expect(inden.length).toBeGreaterThan(840);
    for (const p of inden) {
      const [, li, lin, tx] = p.baru.match(/\\fi-400 \\li(\d+) \\lin(\d+) \\tql \\tx(\d+)/) ?? [];
      expect(li).toBe(lin);
      expect(li).toBe(tx);
      expect(p.baru).not.toMatch(/\\cu(fi|li)/);
      expect(p.baru.match(/\\li\d+/g)?.length).toBe(1);
      expect(p.baru.match(/\\fi-?\d+/g)?.length).toBe(1);
      expect(teksPolos(p.baru)).toBe(teksPolos(p.lama));
      expect(kurung(p.baru)).toBe(kurung(p.lama));
    }
  });

  it("identitas saksi ke-3..5 yang rusak: kurung jadi seimbang, bernomor {\\listtext N.\\tab}, penanda asal tetap", () => {
    const id = POTONG.filter((p) => p.baru.includes("{\\listtext"));
    expect(id.length).toBe(36);
    for (const p of id) {
      expect(kurung(p.lama)).toBe(-1);
      expect(kurung(p.baru)).toBe(0);
      expect(p.baru).toMatch(/\\fi-394 \\li794 .*\\ls[1-9]\d* .*\{\\listtext .*\\f2 [345]\.\\tab \}/);
      const asal = p.lama.match(/\{\\\*\\isianasal [^{}]*\}/)?.[0];
      if (asal) expect(p.baru).toContain(asal);
    }
  });

  it("paragraf lama yang ditambal memang paragraf keterangan saksi (potongan inden hanya mengganti sifat paragraf)", () => {
    for (const p of POTONG.filter((x) => !x.baru.includes("{\\listtext"))) {
      expect(p.baru.startsWith("\\pard")).toBe(true);
      expect(p.baru).not.toMatch(/#\d{4,5}#/);
    }
  });
});
