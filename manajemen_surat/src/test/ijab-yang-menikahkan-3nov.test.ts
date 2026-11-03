// @vitest-environment node
/**
 * Paket ABT abt-ijab-yang-menikahkan-3nov (keputusan Derry 3 Nov 18.00): fakta/pertimbangan penetapan Itsbat Nikah Kabul
 * "Wali Nikah ... mengucapkan ijab ... sesaat setelah Wali Nikah ... mengucapkan ijab" -> "#8087# selaku yang menikahkan
 * mengucapkan ijab ... sesaat setelah ijab diucapkan" (benar bila yang menikahkan wali nasab sendiri maupun imam/penghulu/wakil
 * wali; sama dengan katalog saksi BAS). Penjaga isi paket: 5 berkas / 11 potongan, md5 dasar = keadaan server sesudah
 * saksi-rapi-3nov, kalimat lama hilang, tanpa kata nama aplikasi, isi paket = MD5SUMS. Uji pasang/pulih: hasil/uji-lokal.txt.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO = path.resolve(process.cwd(), "..");
const P = path.join(REPO, "abt-paket/ijab-yang-menikahkan-3nov/paket-satker");
const baca = (n: string) => readFileSync(path.join(P, n));
const baris = (n: string) => baca(n).toString("utf8").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
const md5 = (b: Buffer) => createHash("md5").update(b).digest("hex");

const daftar = baris("daftar-tambal.tsv");
const potong = baris("tambal.tsv").map(([kode, off, lama, baru]) => ({ kode, off: Number(off), lama: Buffer.from(lama, "base64").toString("latin1"), baru: Buffer.from(baru, "base64").toString("latin1") }));

describe("paket ijab-yang-menikahkan-3nov", () => {
  it("lima penetapan Itsbat Nikah Kabul derry_briantono, 11 kalimat", () => {
    expect(daftar.map((d) => d[1].replace("derry_briantono/2 Itsbat Nikah/", "").slice(0, 5))).toEqual(["[01] ", "[01a]", "[01b]", "[01d]", "[01e]"]);
    expect(daftar.map((d) => Number(d[4]))).toEqual([2, 1, 2, 3, 3]);
    expect(potong).toHaveLength(11);
    for (const d of daftar) expect(potong.filter((p) => p.kode === d[0])).toHaveLength(Number(d[4]));
  });
  it("md5 dasar = md5 sesudah paket saksi-rapi-3nov (keadaan server 3 Nov 15.20)", () => {
    const rapi = new Map(readFileSync(path.join(REPO, "abt-paket/saksi-rapi-3nov/paket-satker/daftar-tambal.tsv"), "utf8").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t")).map((b) => [b[1], b[3]] as [string, string]));
    for (const d of daftar) expect(rapi.get(d[1]), d[1]).toBe(d[2]);
  });
  it("bunyi baru menyebut yang menikahkan (#8087#), tidak lagi 'Wali Nikah ... mengucapkan ijab'", () => {
    for (const p of potong) {
      expect(p.lama).toMatch(/Wali Nikah (?:#0046# II|mempelai perempuan) mengucapkan ijab/);
      expect(p.baru).toMatch(/^(?:fakta bahwa )?#8087# selaku yang menikahkan mengucapkan ijab dan (?:#0046# I|mempelai laki-laki) mengucapkan kabul sesaat setelah ijab diucapkan/);
      expect(p.baru).not.toMatch(/Wali Nikah/);
      expect(p.baru).not.toMatch(/aleta/i);
      expect(p.baru).toMatch(/^[\x20-\x7e]+$/); // teks RTF polos, tanpa kode kendali/aksara di luar ASCII
    }
  });
  it("katalog saksi BAS berbunyi sama: ijab diucapkan oleh yang menikahkan (#8087#)", () => {
    const kat = JSON.parse(readFileSync(path.join(REPO, "ekstensi-sipp/saksi-katalog/itsbat-nikah.json"), "utf8"));
    const q = kat.pertanyaan.find((x: { id: string }) => x.id === "q-in-ijab-kabul-pb");
    const m = Array.isArray(q.jawaban.melihat) ? q.jawaban.melihat[0] : q.jawaban.melihat;
    for (const t of [...m.saksi1, ...m.saksi2]) expect(t).toMatch(/ijab[^,]*#8087#|#8087#[^,]*ijab/);
  });
  it("isi paket = MD5SUMS; tambal_rtf.py sama dengan paket saksi-rapi-3nov; pasang berhenti bila berkas tidak SIAP", () => {
    for (const l of baca("MD5SUMS.txt").toString("utf8").split("\n").filter(Boolean)) {
      const [h, n] = l.split(/\s+\*?/);
      expect(md5(baca(n)), n).toBe(h);
    }
    expect(md5(baca("tambal_rtf.py"))).toBe(md5(readFileSync(path.join(REPO, "abt-paket/saksi-rapi-3nov/paket-satker/tambal_rtf.py"))));
    const sh = baca("pasang-satker.sh").toString("utf8");
    expect(sh).toContain('"BERKAS SIAP" ] || gagal');
    expect(sh.indexOf("tambal_rtf.py cek")).toBeLessThan(sh.indexOf("tambal_rtf.py pasang"));
    const uji = readFileSync(path.join(P, "../hasil/uji-lokal.txt"), "utf8");
    for (const s of ["TAMBAL=5", "SIDIK TETAP", "PULIH COCOK", "SIDIK = AWAL", "TIDAK ADA YANG BERUBAH", "BIARKAN=1 PULIH=4"]) expect(uji).toContain(s);
  });
});
