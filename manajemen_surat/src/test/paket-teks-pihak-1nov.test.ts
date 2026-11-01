// @vitest-environment node
/**
 * 1 NOV 2026 - paket ABT abt-teks-pihak-1nov (keputusan 55: teks para pihak disalin apa adanya, kesimpulan UTUH di putusan).
 * Yang dijaga dari isi paket SUNGGUHAN (penulisan ke blangko ABT, jadi ketat):
 *   - aturan huruf awal (isian_awal_kecil) diturunkan HANYA saat cetak: acuan TypeScript di bawah harus menghasilkan md5 yang sama dengan keluaran
 *     fungsi MariaDB yang tercatat di uji-fungsi.tsv (perilaku, bukan sekadar teks kode);
 *   - nomor variabel baru di blok 12100-12119, di luar blok bukti-pisah 12040-12099 (PRASYARAT paket itu menolak nomor asing di blok itu);
 *   - variabel diganti (9255/9256/11313) dijaga md5 LAMA, variabel baru lengkap di PASANG/PERIKSA/PULIH;
 *   - tambalan blangko: 313 berkas ber-md5 lama/baru, token lama terlihat berganti variabel paket, tanpa kata nama aplikasi;
 *   - urutan pasang 26 paket: pembuktian-urut sesudah tanggal-agenda, teks-pihak paling akhir, sama dengan rantai.sh.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const DIR = path.join(AKAR, "abt-paket/teks-pihak-1nov/paket-satker");
const N = "abt-teks-pihak-1nov";
const baca = (b: string) => readFileSync(path.join(DIR, b), "utf8");
const md5 = (b: Buffer | string) => createHash("md5").update(b).digest("hex");
const HASIL = JSON.parse(readFileSync(path.join(AKAR, "abt-paket/teks-pihak-1nov/hasil/variabel.json"), "utf8")) as {
  baru: { no: number; nama: string; sql: string }[];
  diganti: { no: number; nama_lama: string; nama_baru: string; sql_lama: string; sql_baru: string }[];
  md5_fungsi: Record<string, string>;
  md5_penanda_lama: string;
};
const DAFTAR = baca("daftar-tambal.tsv").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
const TAMBAL = baca("tambal.tsv").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
const dekode = (b: string) => Buffer.from(b, "base64").toString("latin1");

/** Acuan aturan isian_awal_kecil (SQL): hanya huruf pertama A-Z diturunkan; sebutan pihak, huruf besar semua, dan satu huruf dibiarkan. */
const SEBUTAN = ["Penggugat", "Tergugat", "Pemohon", "Termohon", "Turut", "Majelis", "Hakim", "Pengadilan", "Kuasa"];
function awalKecil(t: string): string {
  const n = t.length;
  let i = 0;
  while (i < n && [32, 9, 10, 13, 160].includes(t.charCodeAt(i))) i += 1;
  if (i >= n) return t;
  const c = t.charCodeAt(i);
  if (!(c >= 65 && c <= 90)) return t;
  let j = i;
  while (j < n && /[A-Za-z]/.test(t[j])) j += 1;
  const k = t.slice(i, i + Math.min(j - i, 40));
  if (k.length < 2) return t;
  if (k === k.toUpperCase()) return t;
  if (SEBUTAN.includes(k)) return t;
  return t.slice(0, i) + t[i].toLowerCase() + t.slice(i + 1);
}

describe("perilaku: huruf awal diturunkan saat cetak, selebihnya apa adanya", () => {
  const baris = baca("uji-fungsi.tsv").split("\n").filter(Boolean).map((l) => l.split("\t"));
  const awal = baris.filter((b) => b[1] === "isian_awal_kecil(@T@)");

  it("acuan TypeScript = keluaran fungsi MariaDB yang tercatat (md5) untuk setiap contoh", () => {
    expect(awal.length).toBeGreaterThanOrEqual(10);
    for (const [hx, , harap] of awal) {
      const masuk = Buffer.from(hx, "hex").toString("latin1");
      expect(md5(Buffer.from(awalKecil(masuk), "latin1")), JSON.stringify(masuk)).toBe(harap);
    }
  });

  it("aturan: hanya huruf pertama; sebutan pihak, huruf besar semua, satu huruf, dan teks berawal huruf kecil/angka tidak berubah", () => {
    expect(awalKecil("Bahwa Tergugat menolak seluruh dalil")).toBe("bahwa Tergugat menolak seluruh dalil");
    expect(awalKecil("Menolak SELURUH dalil")).toBe("menolak SELURUH dalil"); // sisanya apa adanya
    expect(awalKecil("Tergugat menolak")).toBe("Tergugat menolak");
    expect(awalKecil("Penggugat Rekonvensi tetap")).toBe("Penggugat Rekonvensi tetap");
    expect(awalKecil("TERGUGAT MENOLAK")).toBe("TERGUGAT MENOLAK");
    expect(awalKecil("PNS menolak")).toBe("PNS menolak");
    expect(awalKecil("A")).toBe("A");
    expect(awalKecil("1.Bahwa Ada")).toBe("1.Bahwa Ada");
    expect(awalKecil("tetap pada gugatan")).toBe("tetap pada gugatan");
    expect(awalKecil("  \r\nPara Pemohon mohon")).toBe("  \r\npara Pemohon mohon");
    expect(awalKecil("Salah ketik gugatanya   ;")).toBe("salah ketik gugatanya   ;"); // salah ketik dan spasi tidak dibetulkan
  });

  it("contoh uji memuat penanda tak rapi ('1 .', '1.Bahwa') untuk fungsi penanda dan butir", () => {
    const ekspr = baris.map((b) => b[1]);
    expect(ekspr).toContain("isian_rtf_penanda(@T@)");
    expect(ekspr).toContain("isian_rtf_butir(@T@, 'teks', 426)");
    const masuk = baris.filter((b) => b[1] === "isian_rtf_penanda(@T@)").map((b) => Buffer.from(b[0], "hex").toString("latin1"));
    expect(masuk).toContain("1 . Bahwa A");
    expect(masuk).toContain("1.Bahwa A");
    expect(masuk).toContain("1 .Bahwa A");
  });
});

describe("variabel paket", () => {
  const semua = HASIL.baru;
  it("nomor baru unik di blok 12100-12119, di luar blok bukti-pisah 12040-12099, tidak bentrok dengan paket lain", () => {
    const nomor = semua.map((v) => v.no);
    expect(new Set(nomor).size).toBe(nomor.length);
    for (const n of nomor) {
      expect(n).toBeGreaterThanOrEqual(12100);
      expect(n).toBeLessThanOrEqual(12119);
    }
    const pemilik = new Map<number, string>();
    for (const d of readdirSync(path.join(AKAR, "abt-paket"))) {
      if (d === "teks-pihak-1nov") continue;
      const f = path.join(AKAR, "abt-paket", d, "paket-satker/nomor-variabel.txt");
      if (!existsSync(f)) continue;
      for (const l of readFileSync(f, "utf8").split("\n")) if (/^\d+$/.test(l.trim())) pemilik.set(Number(l.trim()), d);
    }
    for (const n of nomor) expect(pemilik.has(n), String(n)).toBe(false);
    // variabel yang DIGANTI: 9255/9256 tidak dimiliki paket mana pun; 11313 dibuat sela-ps-30okt (paket ke-14, sebelum paket ini)
    expect(pemilik.has(9255)).toBe(false);
    expect(pemilik.has(9256)).toBe(false);
    expect(pemilik.get(11313)).toBe("sela-ps-30okt");
    expect(baca("nomor-variabel.txt").split("\n").filter((l) => /^\d+$/.test(l)).map(Number)).toEqual(nomor);
  });

  it("PASANG, PERIKSA, PULIH memuat tiap variabel; tanpa kata nama aplikasi di berkas yang tertulis ke ABT", () => {
    const pasang = baca(`${N}-PASANG.sql`);
    const periksa = baca(`${N}-PERIKSA.sql`);
    const pulih = baca(`${N}-PULIH.sql`);
    for (const v of semua) {
      expect(pasang).toContain(`WHERE NOT EXISTS (SELECT 1 FROM abt_variabel WHERE no_var = ${v.no})`);
      expect(periksa).toContain(`'var ${v.no}'`);
      expect(pulih).toContain(`DELETE FROM abt_variabel WHERE no_var = ${v.no} AND`);
      expect(v.nama + v.sql).not.toMatch(/aleta/i);
      expect(v.nama.length).toBeLessThanOrEqual(200);
      expect(v.sql).not.toContain("\\"); // garis miring terbalik hanya lewat CHAR(92)
    }
    for (const x of HASIL.diganti) {
      expect(pasang).toContain(`WHERE v.no_var = ${x.no} AND`);
      expect(pulih).toContain(`WHERE v.no_var = ${x.no} AND`);
      expect(periksa).toContain(`'var ${x.no}'`);
      expect(x.nama_baru + x.sql_baru).not.toMatch(/aleta/i);
      expect(x.nama_baru.length).toBeLessThanOrEqual(200);
    }
    // pasang/pulih-satker.sh memuat nama wadah bot untuk membaca sandi DB (sama di semua paket) - bukan teks yang tertulis ke ABT
    for (const b of [`${N}-FUNGSI.sql`, `${N}-FUNGSI-PULIH.sql`, `${N}-PASANG.sql`, `${N}-PERIKSA.sql`, `${N}-PULIH.sql`, "uji-kueri.tsv", "uji-fungsi.tsv"]) {
      expect(baca(b), b).not.toMatch(/aleta/i);
    }
  });

  it("kesimpulan 12100/12101: naskah tertulis 12027/12028 UTUH bila ada, selain itu frasa 8436/8437 lewat fungsi huruf-awal-kecil", () => {
    for (const [no, naskah, pokok] of [[12100, 12027, 8436], [12101, 12028, 8437]] as const) {
      const v = HASIL.baru.find((x) => x.no === no)!;
      expect(v.sql).toContain(`t.no_var = ${naskah} `);
      expect(v.sql).toContain(`t.no_var = ${pokok} `);
      expect(v.sql).toContain("aps_badilag.isian_rtf_blok(");
      expect(v.sql).toContain("'sebagai berikut:'");
      expect(v.sql).toContain("aps_badilag.isian_rtf_kalimat_kecil(");
      expect(v.sql).not.toMatch(/isian_rtf_kalimat\(/);
      // naskah dicabang LEBIH DULU daripada frasa
      expect(v.sql.indexOf(`t.no_var = ${naskah} `)).toBeLessThan(v.sql.indexOf("isian_rtf_kalimat_kecil("));
    }
  });

  it("variabel 9255/9256 hanya berganti ke fungsi huruf-kecil; 11313 hanya membungkus cabang isian 9681", () => {
    for (const no of [9255, 9256]) {
      const x = HASIL.diganti.find((d) => d.no === no)!;
      expect(x.sql_baru).toBe(x.sql_lama.replace("aps_badilag.isian_rtf_kalimat(", "aps_badilag.isian_rtf_kalimat_kecil("));
    }
    const x = HASIL.diganti.find((d) => d.no === 11313)!;
    expect(x.sql_baru.replace("aps_badilag.isian_awal_kecil(", "").length).toBe(x.sql_baru.length - "aps_badilag.isian_awal_kecil(".length);
    const dibuang = x.sql_baru.replace("aps_badilag.isian_awal_kecil(", "").replace(/\)(, "\.\.\."\) AS data)$/, "$1");
    expect(dibuang).toBe(x.sql_lama);
    // cabang 9685 (ketikan petugas) TIDAK dibungkus: pembungkus muncul sesudah teks "t.no_var = 9685"
    expect(x.sql_baru.indexOf("isian_awal_kecil(")).toBeGreaterThan(x.sql_baru.indexOf("t.no_var = 9685"));
  });

  it("bukti AUA/BAS: surat, elektronik saja, keduanya, tanpa bukti - tanpa bukti tetap kalimat lama (bukti suratnya)", () => {
    const v = (n: number) => HASIL.baru.find((x) => x.no === n)!.sql;
    expect(v(12106)).toContain("'menyerahkan alat bukti surat berupa:'");
    expect(v(12106)).toContain("'menyerahkan alat bukti elektronik berupa:'");
    expect(v(12107)).toMatch(/IF\(CHAR_LENGTH\(.*\) > 0 AND CHAR_LENGTH\(.*\) > 0, CONCAT\('Selanjutnya #7036# menyerahkan bukti elektronik berupa:'/);
    for (const n of [12108, 12109]) {
      expect(v(n)).toContain("'bukti surat dan bukti elektroniknya'");
      expect(v(n)).toContain("'bukti elektroniknya'");
      expect(v(n).match(/'bukti suratnya'/g)).toHaveLength(2); // surat saja DAN tanpa bukti
    }
    expect(v(12108)).toContain("'P'");
    expect(v(12109)).toContain("'T'");
    expect(v(12108)).not.toContain("'T'");
    expect(v(12109)).not.toContain("'P'");
  });
});

describe("berkas paket dan tambalan blangko", () => {
  it("md5 berkas paket cocok MD5SUMS; tidak ada folder cadangan yang ikut", () => {
    const baris = baca("MD5SUMS.txt").split("\n").filter(Boolean);
    expect(baris.length).toBeGreaterThanOrEqual(14);
    for (const l of baris) {
      const [m, f] = l.split(/  /);
      expect(md5(readFileSync(path.join(DIR, f))), f).toBe(m);
    }
    expect(readdirSync(DIR).includes("cadangan")).toBe(false);
  });

  it("313 berkas ditambal: md5 lama != baru, nama unik, tak ada berkas di luar pohon derry_briantono", () => {
    expect(DAFTAR).toHaveLength(313);
    expect(new Set(DAFTAR.map((d) => d[1])).size).toBe(313);
    for (const d of DAFTAR) {
      expect(d[1].startsWith("derry_briantono/")).toBe(true);
      expect(d[2]).toMatch(/^[0-9a-f]{32}$/);
      expect(d[3]).toMatch(/^[0-9a-f]{32}$/);
      expect(d[2]).not.toBe(d[3]);
    }
  });

  it("potongan: token lama terlihat berganti variabel paket, penyisipan hanya grup tersembunyi isianasal, tanpa kata nama aplikasi", () => {
    const nomorBaru = new Set(HASIL.baru.map((v) => String(v.no)));
    let ganti9255 = 0;
    let ganti9256 = 0;
    let gantiKecil = 0;
    let grup = 0;
    for (const [, , lama, baru] of TAMBAL) {
      const a = dekode(lama);
      const b = dekode(baru);
      expect(b).not.toMatch(/aleta/i);
      for (const m of b.matchAll(/#(121\d\d)#/g)) expect(nomorBaru.has(m[1]), m[0]).toBe(true);
      if (a === "") {
        grup += 1;
        expect(b).toMatch(/^\{\\\*\\isianasal( #\d{4,5}#)+\}$/); // penyisipan murni = grup tersembunyi
      } else if (a === "#9255#") {
        expect(b).toBe("#12100#");
        ganti9255 += 1;
      } else if (a === "#9256#") {
        expect(b).toBe("#12101#");
        ganti9256 += 1;
      } else if (/^#(9355|9491|9681|9164)#$/.test(a)) {
        expect(b).toBe({ "#9355#": "#12102#", "#9491#": "#12103#", "#9681#": "#12104#", "#9164#": "#12105#" }[a]);
        gantiKecil += 1;
      }
    }
    expect(ganti9255).toBe(102);
    expect(ganti9256).toBe(102);
    expect(gantiKecil).toBe(15);
    expect(grup).toBeGreaterThan(50);
  });

  it("Asal Usul Anak: 4 berkas, tiap berkas 3 ganti (klausa, pengantar elektronik, bukti suratnya)", () => {
    const aua = DAFTAR.filter((d) => d[1].startsWith("derry_briantono/8 Asal Usul Anak/"));
    expect(aua).toHaveLength(4);
    for (const d of aua) {
      const potong = TAMBAL.filter((t) => t[0] === d[0]);
      expect(potong.map((t) => dekode(t[3])).sort()).toEqual(["#12108#", "telah #12106#", "{#12107#}"].sort());
    }
  });

  it("BAS pembuktian: hanya kata 'bukti suratnya' di 'menyatakan telah cukup dengan' yang diganti, pihak P/T menurut daftar bukti", () => {
    let p = 0;
    let t = 0;
    for (const x of TAMBAL) {
      if (dekode(x[2]) !== "bukti suratnya") continue;
      const b = dekode(x[3]);
      if (b === "#12108#") p += 1;
      else if (b === "#12109#") t += 1;
      else throw new Error("pengganti tak dikenal " + b);
    }
    expect(p).toBeGreaterThan(100);
    expect(t).toBeGreaterThan(30);
  });
});

describe("fungsi paket", () => {
  const f = baca(`${N}-FUNGSI.sql`);
  it("dua fungsi baru, satu fungsi diganti (isian_rtf_penanda), tidak menyentuh isian_rtf_kalimat/butir", () => {
    for (const n of ["isian_awal_kecil", "isian_rtf_kalimat_kecil", "isian_rtf_penanda"]) {
      expect(f).toContain(`DROP FUNCTION IF EXISTS ${n}$$`);
      expect(f).toContain(`CREATE FUNCTION \`${n}\``);
    }
    expect(f).not.toMatch(/CREATE FUNCTION `isian_rtf_(kalimat|butir|blok)`/);
    expect(f).toContain("WHILE m < n AND m - j < 3 AND BINARY SUBSTRING(t, m + 1, 1) = ' ' DO"); // spasi sebelum titik penanda angka
    const pulih = baca(`${N}-FUNGSI-PULIH.sql`);
    expect(pulih).toContain("DROP FUNCTION IF EXISTS isian_rtf_kalimat_kecil;");
    expect(pulih).toContain("DROP FUNCTION IF EXISTS isian_awal_kecil;");
    expect(pulih).toContain("CREATE FUNCTION `isian_rtf_penanda`");
    expect(pulih).not.toContain("WHILE m < n AND m - j < 3 AND BINARY SUBSTRING(t, m + 1, 1) = ' ' DO");
  });

  it("PRASYARAT menjaga md5 LAMA penanda dan md5 fungsi paket; harap pasang pertama dan ulang", () => {
    const pras = baca(`${N}-PRASYARAT.sql`);
    expect(pras).toContain(HASIL.md5_penanda_lama);
    for (const m of Object.values(HASIL.md5_fungsi)) expect(pras).toContain(m);
    const [pertama, ulang] = baca("harap.txt").split("\n").filter(Boolean);
    expect(pertama).toBe("3|0|0|0|1|0|0|0|4");
    expect(ulang).toBe("0|3|10|0|0|1|2|0|4");
  });
});

describe("urutan pasang 26 paket", () => {
  const urut = readFileSync(path.join(AKAR, "abt-paket/URUTAN-PASANG-1nov.md"), "utf8");
  const lama = readFileSync(path.join(AKAR, "abt-paket/URUTAN-PASANG-31okt.md"), "utf8");
  const rantai = readFileSync(path.join(AKAR, "abt-paket/uji-rantai-31okt/rantai.sh"), "utf8");
  const daftarRantai = /^URUT="([^"]+)"/m.exec(rantai)![1].split(/\s+/);
  const daftarUrut = [...urut.matchAll(/^### (\d+)\. `([a-z0-9-]+)`/gm)].map((m) => [Number(m[1]), m[2]] as const);

  it("rantai.sh dan URUTAN-PASANG-1nov.md memuat paket yang sama dalam urutan yang sama; nomor berurutan 1..26", () => {
    expect(daftarUrut.map((x) => x[1])).toEqual(daftarRantai);
    expect(daftarUrut.map((x) => x[0])).toEqual(Array.from({ length: 26 }, (_, i) => i + 1));
  });

  it("pembuktian-urut tepat sesudah tanggal-agenda; teks-pihak paling akhir; setiap paket punya folder paket-satker dengan pasang-satker.sh", () => {
    const i = daftarRantai.indexOf("tanggal-agenda-31okt");
    expect(daftarRantai[i + 1]).toBe("pembuktian-urut-1nov");
    expect(daftarRantai[daftarRantai.length - 1]).toBe("teks-pihak-1nov");
    for (const p of daftarRantai) expect(existsSync(path.join(AKAR, "abt-paket", p, "paket-satker/pasang-satker.sh")), p).toBe(true);
  });

  it("berkas urutan lama diberi baris DIGANTI oleh URUTAN-PASANG-1nov.md", () => {
    expect(lama).toContain("DIGANTI oleh URUTAN-PASANG-1nov.md");
  });
});
