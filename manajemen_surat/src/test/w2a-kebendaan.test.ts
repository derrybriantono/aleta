// @vitest-environment node
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * W2a - KEBENDAAN (harta bersama, kewarisan, wasiat, hibah, wakaf, ekonomi syariah) - 21 Okt 2026
 * ============================================================================
 * Uji PERILAKU:
 *   A. paket ABT utuh: md5, nomor jatah, ASCII, tanpa kata aplikasi, tambalan RTF hanya mengganti paragraf yang disengaja;
 *   B. paket di MariaDB lokal: PASANG -> PERIKSA "SEMUA COCOK", PASANG ulang ditolak, PULIH, rujukan lama tak lengkap ditolak, semua kueri jalan;
 *   C. rakitan kalimat dan nomor butir amar atas perkara nyata + isian fixture (uji_semantik.cjs), termasuk regresi bunyi lama tanpa tuntutan;
 *   D. pengisi isiOtomatisW2a: semua usulan "ragu", kalimat penyangkalan tidak dibaca, tersambung ke dariSipp.
 * B dan C butuh MariaDB lokal (XAMPP, port 3306) dengan salinan SIPP PA Donggala dan aps_badilag_w2a; tanpa itu dilewati.
 */

const REPO = path.resolve(__dirname, "../../..");
const PAKET = path.join(REPO, "abt-paket", "w2a-kebendaan");
const SATKER = path.join(PAKET, "paket-satker");
const ALAT = path.join(PAKET, "alat");
const require = createRequire(import.meta.url);
const md5 = (b: Buffer | string) => createHash("md5").update(b).digest("hex");
const baca = (...p: string[]) => readFileSync(path.join(...p), "latin1");

type Variabel = { no: number; nama: string; tipe: string; sql: string | null; default: string | null };
const variabel: Variabel[] = JSON.parse(readFileSync(path.join(PAKET, "data", "variabel.json"), "utf8"));
const daftar = baca(SATKER, "DAFTAR-BLANGKO.tsv")
  .split("\n")
  .filter((x) => x.trim())
  .map((x) => {
    const [nn, folder, berkas, pra, baru] = x.split("\t");
    return { nn, folder, berkas, pra, baru };
  });

function jalankan(skrip: string, args: string[] = [], waktu = 900_000) {
  const r = spawnSync(process.execPath, [path.join(ALAT, skrip), ...args], { encoding: "utf8", timeout: waktu, env: { ...process.env, TMP: "D:/Aplikasi/aleta/tmp", TEMP: "D:/Aplikasi/aleta/tmp" } });
  if (r.status !== 0) throw new Error(`${skrip} gagal: ${(r.stderr || "").slice(0, 400)}`);
  return JSON.parse(r.stdout.trim().split("\n").pop() as string);
}

function mariadbAda(): boolean {
  const r = spawnSync(process.execPath, ["-e", `const m=require(${JSON.stringify(path.join(REPO, "aleta_bot", "node_modules", "mysql"))});const k=m.createConnection({host:"127.0.0.1",user:"root"});k.query("SELECT COUNT(*) n FROM aps_badilag_w2a.abt_variabel",(e,r)=>{process.exit(e||!r[0].n?1:0)});setTimeout(()=>process.exit(1),8000)`], { timeout: 12_000 });
  return r.status === 0;
}

// ---------------------------------------------------------------------------------------------------------------------
describe("A. paket ABT w2a-kebendaan utuh", () => {
  it("md5 semua berkas paket cocok dengan MD5SUMS", () => {
    const baris = baca(SATKER, "MD5SUMS.txt").split("\n").filter(Boolean);
    expect(baris.length).toBeGreaterThan(25);
    for (const b of baris) {
      const [h, ...n] = b.split("  ");
      const berkas = path.join(SATKER, n.join("  "));
      expect(md5(readFileSync(berkas)), n.join("  ")).toBe(h);
    }
  });

  it("22 blangko: md5 sebelum = RTF asli server 21 Okt, md5 sesudah = RTF di paket, dan berkas berubah", () => {
    expect(daftar.length).toBe(22);
    for (const d of daftar) {
      const asli = readFileSync(path.join(PAKET, "asli-server-21okt", d.folder, d.berkas));
      const baru = readFileSync(path.join(SATKER, "rtf", `${d.nn}.rtf`));
      expect(md5(asli), d.berkas).toBe(d.pra);
      expect(md5(baru), d.berkas).toBe(d.baru);
      expect(d.pra).not.toBe(d.baru);
    }
    const folder = new Set(daftar.map((d) => d.folder));
    expect([...folder].sort()).toEqual(["10 Ekonomi Syariah", "10a Ekonomi Syariah Biasa", "4a Harta Bersama", "4b Kewarisan", "4c Wasiat", "4d Hibah", "4e Wakaf"].sort());
  });

  it("variabel: 70 buah, nomor unik dalam jatah 4780-4849, nama <= 200 huruf, ASCII, tanpa kata aplikasi, sql data_sql berawalan SELECT", () => {
    expect(variabel.length).toBe(70);
    const nomor = variabel.map((v) => v.no);
    expect(new Set(nomor).size).toBe(nomor.length);
    for (const v of variabel) {
      expect(v.no).toBeGreaterThanOrEqual(4780);
      expect(v.no).toBeLessThanOrEqual(4849);
      expect(v.nama.length).toBeLessThanOrEqual(200);
      for (const t of [v.nama, v.sql || "", v.default || ""]) {
        expect(/^[\x00-\x7f]*$/.test(t), `${v.no} bukan ASCII`).toBe(true);
        expect(/aleta/i.test(t), `${v.no} memuat kata aplikasi`).toBe(false);
      }
      if (v.tipe === "data_sql") expect((v.sql || "").trim().toUpperCase().startsWith("SELECT"), String(v.no)).toBe(true);
      else expect(v.sql).toBeNull();
      expect((v.sql || "").length).toBeLessThan(65535);
    }
  });

  it("penanda isian yang bisa kosong (nama pewaris, tanggal dan tempat wafat, tanggal putusan sela) dibungkus: kosong -> DATA_TIDAK_ADA (tampil titik-titik), bukan hilang", () => {
    const sql = (no: number) => variabel.find((v) => v.no === no)!.sql || "";
    for (const no of [4825, 4827]) {
      for (const t of ["1025", "1246", "1509"]) expect(sql(no), `${no} #${t}#`).toContain(`IF(TRIM("#${t}#") = '', 'DATA_TIDAK_ADA', "#${t}#")`);
      // tidak ada penanda tersebut di luar bungkus
      const tanpaBungkus = sql(no).split(`IF(TRIM("#1246#") = '', 'DATA_TIDAK_ADA', "#1246#")`).join("");
      expect(tanpaBungkus).not.toContain("#1246#");
    }
    for (const no of [4800, 4802, 4804, 4825, 4827, 4837]) expect(sql(no), String(no)).toContain("IF(TRIM('#0218#') = '', 'DATA_TIDAK_ADA', '#0218#')");
    // isian kosong -> DATA_TIDAK_ADA, bukan teks bawaan variabel (ABT lama menampilkan titik-titik)
    expect(sql(4802)).toContain("'DATA_TIDAK_ADA'");
    expect(sql(4802)).not.toContain("Sebidang tanah");
  });

  it("PASANG.sql: prasyarat jatah kosong + rujukan lama, satu INSERT per variabel dalam satu transaksi; PERIKSA memuat md5 tiap baris; PULIH hanya menghapus jatah", () => {
    const pasang = baca(SATKER, "abt-w2a-PASANG.sql");
    expect(pasang).toContain("PRASYARAT COCOK");
    expect(pasang).toContain("START TRANSACTION;");
    expect(pasang).toContain("COMMIT;");
    expect((pasang.match(/^INSERT INTO abt_variabel/gm) || []).length).toBe(70);
    expect(/aleta/i.test(pasang)).toBe(false);
    expect(/^[\x00-\x7f]*$/.test(pasang)).toBe(true);
    const periksa = baca(SATKER, "abt-w2a-PERIKSA.sql");
    expect((periksa.match(/MD5\(nama\)/g) || []).length).toBeGreaterThanOrEqual(70);
    expect(periksa).toContain("SEMUA COCOK");
    const pulih = baca(SATKER, "abt-w2a-PULIH-HAPUS-BARU.sql");
    expect(pulih).toContain("DELETE FROM abt_variabel WHERE no_var BETWEEN 4780 AND 4849;");
    expect(pulih.match(/DELETE/g)!.length).toBe(1);
  });

  it("skrip pasang menolak bila md5 blangko satker berbeda, mencadangkan sebelum menulis, dan memulihkan sendiri bila gagal", () => {
    const sh = baca(SATKER, "pasang-satker.sh");
    expect(sh.indexOf("BERBEDA dari yang diukur 21 Okt")).toBeLessThan(sh.indexOf("mysqldump"));
    expect(sh.indexOf("mysqldump")).toBeLessThan(sh.indexOf("abt-w2a-PASANG.sql"));
    expect(sh.indexOf("abt-w2a-PASANG.sql")).toBeLessThan(sh.indexOf('cat "rtf/$NN.rtf" >'));
    expect(sh).toContain("pulih-satker.sh");
    expect(sh).toContain("SEMUA COCOK");
    expect(/aleta/i.test(sh.replace(/aleta-bot/g, "").replace(/ALETA_BOT_DB_SIPP_PASSWORD/g, ""))).toBe(false);
    const pulih = baca(SATKER, "pulih-satker.sh");
    expect(pulih).toContain("abt-w2a-PULIH-HAPUS-BARU.sql");
    expect(pulih).toContain('cat "$CAD/rtf/$NN.rtf"');
  });

  it("tambalan RTF: kurung seimbang; token baru terdefinisi; keterangan merah yang diganti hilang; paragraf lama hilang hanya yang disengaja", () => {
    const ada = new Set(variabel.map((v) => v.no));
    const hapus = ["ISI SESUAI JAWAB-MENJAWAB", "HAPUS BAGIAN UANG PAKSA", "HAPUS BAGIAN PUTUSAN SERTA MERTA", "ISI URAIAN ISI MASING-MASING BUKTI SURAT/ELEKTRONIK PENGGUGAT"];
    for (const d of daftar) {
      const rtf = baca(SATKER, "rtf", `${d.nn}.rtf`);
      expect(rtf.split("{").length - rtf.split("\\{").length, d.berkas).toBe(rtf.split("}").length - rtf.split("\\}").length);
      const token = [...rtf.matchAll(/#(48\d\d)#/g)].map((m) => Number(m[1]));
      expect(token.length, d.berkas).toBeGreaterThan(0);
      for (const t of token) expect(ada.has(t), `${d.berkas}: #${t}# tidak terdefinisi`).toBe(true);
      for (const h of hapus) expect(rtf.includes(h), `${d.berkas}: ${h}`).toBe(false);
      expect(/aleta/i.test(rtf.replace(/\{\\\*\\aletaasal[^}]*\}/g, "")), d.berkas).toBe(/aleta/i.test(baca(PAKET, "asli-server-21okt", d.folder, d.berkas).replace(/\{\\\*\\aletaasal[^}]*\}/g, "")));
    }
  });

  it("selisih teks lama vs baru (rtf2txt): yang hilang hanya amar bernomor, keterangan merah, butir contoh dan paragraf yang digantikan variabel", () => {
    const r = spawnSync("python", [path.join(ALAT, "periksa_selisih.py")], { encoding: "utf8", timeout: 120_000, maxBuffer: 20_000_000 });
    expect(r.status, r.stderr).toBe(0);
    const sel: Record<string, { berkas: string; hilang: string[]; tambah: string[] }> = JSON.parse(r.stdout);
    expect(Object.keys(sel).length).toBe(22);
    const sah = [
      /^\d+\. (Mengabulkan|Menyatakan|Menetapkan|Menghukum|Menolak|#\d{4}#)/,
      /^Menimbang, bahwa (terhadap akta otentik|bukti-bukti surat yang diajukan|bukti surat yang dikeluarkan|bukti elektronik|berdasarkan fakta hukum tersebut|terhadap tuntutan pembayaran|terhadap harta peninggalan sebagaimana fakta|terhadap petitum yang bersifat menghukum|tentang obyek barang tidak bergerak|berdasarkan segala pertimbangan)/,
      /^Menimbang, bahwa (menurut fakta persidangan, tidak ada fakta hukum|berdasarkan pertimbangan tersebut, #8554# menyimpulkan|oleh karena objek yang telah diletakkan sita|Penggugat dalam petitumnya menuntut agar Tergugat dihukum membayar uang paksa|putusan atas harta bersama|terhadap petitum putusan serta merta)/,
      /^Menimbang bahwa berdasarkan putusan Mahkamah Agung/,
      /^(ISI |HAPUS BAGIAN|Tentang Petitum (Uang Paksa|Putusan Serta Merta))/,
      /^- (Bahwa terhadap objek|Apakah objek|Bahwa objek _)/,
      /^\d\. Bahwa pewaris meninggalkan/,
      /^(- )?Bahwa terhadap objek sengketa telah diletakkan sita jaminan/,
    ];
    for (const [nn, x] of Object.entries(sel)) {
      for (const h of x.hilang) {
        const dipakai = sah.some((p) => p.test(h)) || x.tambah.some((t) => t.startsWith(h.slice(0, 45)));
        expect(dipakai, `${nn} ${x.berkas}: paragraf hilang tak terduga: ${h.slice(0, 90)}`).toBe(true);
      }
      expect(x.hilang.length, nn).toBeLessThan(32);
      for (const t of x.tambah) expect(/aleta/i.test(t), nn).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("B. paket di MariaDB lokal", () => {
  let ada = false;
  let hasil: any = null;
  beforeAll(() => {
    ada = mariadbAda();
    if (ada) hasil = jalankan("uji_paket_lokal.cjs");
  }, 1_000_000);

  it("PASANG -> PERIKSA 'SEMUA COCOK' di 71 baris; PASANG kedua ditolak tanpa menambah baris", (c) => {
    if (!ada) return c.skip();
    expect(hasil.prasyarat).toBe(true);
    expect(hasil.sesudahPasang).toBe("70");
    expect(hasil.periksa).toBe("SEMUA COCOK");
    expect(hasil.barisPeriksa).toBe(71);
    expect(hasil.barisTidakCocok).toEqual([]);
    expect(hasil.pasangLagiGalat).toMatch(/Subquery returns more than 1 row/);
    expect(hasil.sesudahPasangLagi).toBe("70");
  });

  it("PASANG ditolak bila variabel rujukan lama tidak lengkap; PULIH mengembalikan jumlah semula tanpa menyentuh baris lain", (c) => {
    if (!ada) return c.skip();
    expect(hasil.rujukanKurangGalat).toMatch(/Subquery returns more than 1 row/);
    expect(hasil.rujukanKurangBaris).toBe("0");
    expect(hasil.sesudahPulih).toBe("0");
    expect(hasil.akhir).toBe(hasil.sebelum);
    expect(hasil.lainTersentuh).toBe("1");
  });

  it("panjang kueri < 65535 (TEXT), nama <= 200, dan seluruh kueri baru jalan tanpa galat atas 5 perkara nyata", (c) => {
    if (!ada) return c.skip();
    expect(hasil.terpanjang).toBeLessThan(65535);
    expect(hasil.namaTerpanjang).toBeLessThanOrEqual(200);
    expect(hasil.kueriGalat).toEqual([]);
    expect(hasil.kueriJalan).toBeGreaterThan(200);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("C. rakitan kalimat, nomor butir amar dan syarat tampil atas perkara nyata", () => {
  let ada = false;
  let s: Record<string, Record<string, string>> = {};
  beforeAll(() => {
    ada = mariadbAda();
    if (ada) s = jalankan("uji_semantik.cjs");
  }, 1_000_000);
  const n = (c: any) => c.skip();

  it("harta bersama tanpa tuntutan khusus (296/Pdt.G/2026): kosong atau bunyi lama, nomor biaya sama dengan blangko lama", (c) => {
    if (!ada) return n(c);
    const x = s.hb_netral;
    for (const k of ["4788", "4789", "4790", "4791", "4793", "4796", "4799", "4807", "4809", "4810", "4811", "4812"]) expect(x[k] || "", k).toBe("");
    expect(x["4794"]).toContain("adalah masing-masing berhak seperdua (1/2) dari harta bersama tersebut");
    // verstek: 6 butir (T tidak hadir, mengabulkan, menetapkan, bagian, menghukum) lalu biaya = 6; kontradiktoir: 5 -> 5
    expect(x["4800"].split("<br>").filter((l) => /^\d+\.   /.test(l)).map((l) => l.slice(0, 2))).toEqual(["1.", "2.", "3.", "4.", "5."]);
    expect(x["4801"]).toBe("6");
    expect(x["4802"].split("<br>").filter((l) => /^\d+\.   /.test(l)).length).toBe(4);
    expect(x["4802"]).toContain("Menetapkan harta-harta sebagai berikut: DATA_TIDAK_ADA adalah harta bersama");
    expect(x["4803"]).toBe("5");
    expect(x["4802"]).toContain("Mengabulkan #0053# #0046#;");
    expect(x["4802"]).toContain("masing-masing berhak 1/2 (seperdua) dari harta bersama sebagaimana disebutkan pada diktum putusan nomor 2;");
    expect(x["4802"]).not.toContain("untuk sebagian");
    expect(x["4804"]).toContain("untuk sebagian"); // blangko Konvensi Rekonvensi: bawaan sebagian
  });

  it("harta bersama dengan petitum sita, bagian 3/4 dan Turut Tergugat (506/Pdt.G/2026): bagian dan sita menunggu pilihan majelis, lalu amar bernomor mengikuti pilihan", (c) => {
    if (!ada) return n(c);
    const x = s.hb_fixture;
    expect(x["4788"]).toBe("ya");
    expect(x["4789"]).toBe("ya");
    expect(x["4790"] || "").toBe("");
    expect(x["4793"]).toContain("sita marital (maritale beslag)");
    expect(x["4794"]).toContain("Penggugat 3/4 (tiga perempat) dan Tergugat 1/4 (satu perempat)");
    expect(x["4794"]).toContain("Tergugat tidak pernah menafkahi");
    const amar = x["4800"].split("<br>");
    expect(amar[0]).toMatch(/^1\.   Menyatakan #7037# yang telah dipanggil/);
    expect(amar[1]).toContain("untuk sebagian dengan verstek");
    expect(amar[2]).toContain("sita marital");
    // rujukan "diktum putusan nomor" mengikuti nomor butir objek
    const objek = amar.findIndex((l) => l.includes("Menetapkan harta-harta"));
    expect(amar[objek + 2]).toContain(`diktum putusan nomor ${objek + 1} `);
    expect(amar[objek + 1]).toContain("Penggugat 3/4");
    expect(amar[amar.length - 1]).toContain("Menolak #0053# #0046# selain dan selebihnya;");
    expect(x["4801"]).toBe(String(amar.length + 1));
    expect(x["4805"]).toContain("membantah dengan alasan mobil dibeli Tergugat sebelum menikah");
    expect(x["4805"]).toContain("pengakuan murni");
    expect(x["4805"]).toContain("pengakuan berklausul");
    expect(x["4806"]).not.toContain("Sepeda motor"); // diakui murni tidak perlu dibuktikan
    expect(x["4807"].startsWith("<br>Menimbang, bahwa bukti P.1 (Kartu Tanda Penduduk)")).toBe(true);
    expect(x["4807"]).toContain("P.3 dan P.4 (surat-surat kendaraan bermotor)");
    expect(x["4807"]).toContain("P.5 (foto, tangkapan layar atau rekaman)");
  });

  it("kewarisan (142/Pdt.G/2026): susunan ahli waris terstruktur, bagian KHI 2:1, harta bersama pewaris, utang, penguasa, tirkah tidak terbukti; amar berurutan", (c) => {
    if (!ada) return n(c);
    const x = s.waris_fixture;
    expect(x["4820"]).toContain("Udin bin Abide");
    expect(x["4820"]).toContain("anak kandung Pewaris");
    expect(s.waris_fixture_bagian["4822"]).toContain("3 orang anak laki-laki dan 6 orang anak perempuan");
    expect(s.waris_fixture_bagian["4822"]).toContain("Pasal 176 Kompilasi Hukum Islam");
    expect(x["4823"]).toContain("Pasal 96 ayat (1) Kompilasi Hukum Islam");
    expect(x["4823"]).toContain("Pasal 171 huruf e Kompilasi Hukum Islam");
    expect(x["4832"]).toContain("dikuasai oleh Tergugat I dan Tergugat II");
    const amar = x["4825"].split("<br>").filter((l) => /^\d+\.   /.test(l)).map((l) => l.replace(/^\d+\.   /, ""));
    const urut = ["Menyatakan", "Mengabulkan", "Menetapkan #2026# #1025# telah meninggal", "Menetapkan ahli waris", "Menetapkan harta bersama", "Menetapkan harta peninggalan", "Menetapkan bahwa sebelum harta peninggalan dibagi", "Menetapkan bagian", "Menghukum Tergugat I dan Tergugat II", "Menghukum Para Turut", "Menolak"];
    urut.forEach((awal, i) => expect(amar[i], awal).toContain(awal));
    expect(x["4826"]).toBe(String(amar.length + 1));
  });

  it("kewarisan tanpa isian (490/Pdt.G/2026): bunyi lama (ahli waris 8717 bawaan, penghukuman menyerahkan, sebagian), tanpa pertimbangan tambahan", (c) => {
    if (!ada) return n(c);
    const x = s.waris_netral;
    expect(x["4822"] || "").toBe("");
    expect(x["4823"] || "").toBe("");
    expect(x["4829"] || "").toBe("");
    expect(x["4820"]).toBe("DATA_TIDAK_ADA"); // isian kosong tampil "..." seperti blangko lama
    expect(x["4827"].split("<br>").filter((l) => /^\d+\.   /.test(l)).length).toBe(7);
    expect(x["4828"]).toBe("8");
    expect(x["4825"].split("<br>").filter((l) => /^\d+\.   /.test(l)).length).toBe(8);
    expect(x["4826"]).toBe("9");
    expect(x["4827"]).toContain("untuk sebagian");
    expect(x["4832"]).toContain("menyerahkan harta peninggalan tersebut kepada ahli waris sesuai bagiannya patut dikabulkan");
  });

  it("kewarisan 'dikabulkan seluruhnya' + 'tidak ada penguasa': tanpa 'untuk sebagian', tanpa penghukuman menyerahkan, penghukuman ditolak di pertimbangan", (c) => {
    if (!ada) return n(c);
    const x = s.waris_seluruhnya;
    expect(x["4827"]).not.toContain("untuk sebagian");
    expect(x["4827"]).not.toContain("untuk menyerahkan harta peninggalan");
    expect(x["4827"]).not.toContain("selain dan selebihnya");
    expect(x["4827"]).toContain("sah dan berharga sita jaminan");
    expect(x["4832"]).toContain("tidak beralasan hukum dan patut ditolak");
  });

  it("wasiat/hibah/wakaf: butir tambahan bernomor sesudah butir pokok; tuntutan terbaca tanpa keputusan = kalimat periksa; keputusan mengubah butir", (c) => {
    if (!ada) return n(c);
    const a = s.wasiat_tanpa_keputusan;
    expect(a["4836"]).toBe("1.   Mengabulkan #0053# #0046#;{}");
    expect(a["4837"]).toBe("<br>3.   Menghukum Turut #0047# untuk tunduk dan patuh pada putusan ini;{}");
    expect(a["4838"]).toBe("4");
    expect(a["4839"]).toBe("2.   Mengabulkan #0053# #0046# dengan verstek;{}");
    expect(a["4840"]).toContain("<br>4.   Menghukum Turut");
    expect(a["4841"]).toBe("5");
    expect(a["4835"]).toContain("[PERIKSA: petitum menuntut sita jaminan");
    expect(a["4835"]).toContain("[PERIKSA: petitum menuntut uang paksa");
    expect(a["4835"]).toContain("[PERIKSA: petitum menuntut putusan serta merta");
    const b = s.wasiat_keputusan;
    expect(b["4836"]).toBe("1.   Mengabulkan #0053# #0046# untuk sebagian;{}");
    expect(b["4837"].split("<br>").filter(Boolean).map((l) => l.slice(0, 2))).toEqual(["3.", "4.", "5."]);
    expect(b["4837"]).toContain("sah dan berharga sita jaminan");
    expect(b["4837"]).toContain("Menolak #0053# #0046# selain dan selebihnya");
    expect(b["4838"]).toBe("6");
    expect(b["4841"]).toBe("7");
    expect(b["4835"]).not.toContain("[PERIKSA");
  });

  it("ekonomi syariah gugatan sederhana (2/Pdt.G.S/2025): denda, jaminan, pembatalan menunggu pilihan; rumusan amar ditulis hakim; butir pokok dua baris menggeser nomor", (c) => {
    if (!ada) return n(c);
    const a = s.es_tanpa_keputusan;
    expect(a["4845"]).toBe("ya");
    expect(a["4846"]).toBe("ya");
    expect(a["4847"] || "").toBe("");
    expect(a["4835"]).toContain("[PERIKSA: petitum menuntut denda atau ganti rugi");
    expect(a["4835"]).toContain("[PERIKSA: petitum menuntut penyelesaian jaminan");
    expect(a["4836"]).toBe("1.   Mengabulkan #0053# #0046# untuk sebagian;{}");
    expect(a["4837"]).toBe("<br>4.   Menolak #0053# #0046# selain dan selebihnya;{}");
    expect(a["4838"]).toBe("5");
    const b = s.es_keputusan;
    expect(b["4835"]).toContain("beralasan hukum dan patut dikabulkan sebagaimana akan dicantumkan dalam amar putusan, yaitu Menghukum Tergugat membayar denda keterlambatan");
    expect(b["4835"]).toContain("jaminan tidak disebut dalam akad, sehingga tuntutan tersebut tidak beralasan hukum dan patut ditolak");
    expect(b["4837"]).toContain("4.   Menghukum Tergugat membayar denda keterlambatan sejumlah Rp100.000,00;");
    expect(b["4837"]).not.toContain("jaminan tidak disebut");
    expect(b["4838"]).toBe("7");
    expect(b["4833"]).toContain("bukti P.1 (akad atau perjanjian pembiayaan");
    expect(b["4833"]).toContain("P.3 (surat-surat keuangan");
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("D. pengisi isiOtomatisW2a (kewarisan dan harta bersama)", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const W = require(path.join(REPO, "aleta_bot", "services", "isiOtomatisW2a.js")) as any;
  // petitum dan posita kewarisan nyata PA Donggala (perkara 142/Pdt.G/2026), dipersingkat
  const petitum = "Primair 1. Mengabulkan gugatan Para Penggugat untuk seluruhnya; 2. Menetapkan ahli waris dari almarhum Abide bin Amboroe adalah: 1. Udin bin Abide (anak kandung); 2. Rani binti Abide (anak kandung); 3. Muhdar bin Abide (anak kandung);";
  const posita = "1. Bahwa Abide bin Amboroe menikah dengan Hayati binti Zubair melahirkan 3 orang anak; 2. Bahwa Abide bin Amboroe telah meninggal dunia pada tahun 1990; 3. Bahwa harta peninggalan almarhum dikuasai oleh Tergugat I dan Tergugat II tanpa hak; 4. Bahwa selama perkawinan almarhum memperoleh harta bersama berupa sebidang rumah; 5. Bahwa almarhum tidak meninggalkan hutang apa pun;";

  it("semua usulan berkeyakinan ragu (saran); tanpa kata aplikasi; kode milik jatah W2a", () => {
    const u = W.usulanDariData({ perkara: { jenisId: 364, posita, petitum }, pihak1: [] });
    expect(u.length).toBeGreaterThan(0);
    for (const x of u) {
      expect(x.keyakinan).toBe("ragu");
      expect(/aleta/i.test(JSON.stringify(x))).toBe(false);
      expect(["4817", "4818", "4819", "8719", "9701", "9702", "9703", "9704", "9718"]).toContain(x.kode);
    }
  });

  it("penguasa harta peninggalan dan harta bersama pewaris dibaca; kalimat penyangkalan (tidak meninggalkan hutang) tidak dibaca", () => {
    const u = W.usulanDariData({ perkara: { jenisId: 364, posita, petitum }, pihak1: [] });
    const kode = Object.fromEntries(u.map((x: any) => [x.kode, x.nilai]));
    expect(kode["4817"]).toMatch(/Tergugat I dan Tergugat II|Tergugat I/);
    expect(kode["4818"]).toContain("harta bersama");
    expect(kode["4819"]).toBeUndefined();
  });

  it("susunan ahli waris dari petitum -> 9702 (anak) dan hitungan bagian KHI 8719 hanya bila seluruh ahli waris tergolong; pewaris perempuan/anak tak jelas -> tidak dihitung", () => {
    const u = W.usulanDariData({ perkara: { jenisId: 364, posita, petitum }, pihak1: [] });
    const anak = u.find((x: any) => x.kode === "9702");
    expect(anak.nilai).toContain("Udin bin Abide");
    const bagian = u.find((x: any) => x.kode === "8719");
    expect(bagian.nilai).toMatch(/2\/9|1\/9|2\/7/);
    const tanpa = W.usulanDariData({ perkara: { jenisId: 364, posita: "1. Bahwa X telah meninggal dunia", petitum: "Menyatakan ahli waris" }, pihak1: [] });
    expect(tanpa.find((x: any) => x.kode === "8719")).toBeUndefined();
  });

  it("harta bersama: utang bersama dibaca bila ada, tidak bila disangkal; jenis lain tidak disentuh", () => {
    const ada = W.usulanDariData({ perkara: { jenisId: 348, posita: "1. Bahwa selama perkawinan Penggugat dan Tergugat mempunyai hutang bersama kepada Bank sejumlah Rp10.000.000,00", petitum: "" }, pihak1: [] });
    expect(ada.map((x: any) => x.kode)).toEqual(["4786"]);
    const tiada = W.usulanDariData({ perkara: { jenisId: 348, posita: "1. Bahwa selama perkawinan tidak ada hutang bersama", petitum: "" }, pihak1: [] });
    expect(tiada).toEqual([]);
    expect(W.usulanDariData({ perkara: { jenisId: 365, posita, petitum }, pihak1: [] })).toEqual([]);
  });

  it("tersambung ke abtUsulanService.dariSipp setelah S6 dan tidak menimpa usulan yang sudah ada", () => {
    const kode = readFileSync(path.join(REPO, "aleta_bot", "services", "abtUsulanService.js"), "utf8");
    const i6 = kode.indexOf('require("./isiOtomatisJenisS6").usulanJenisS6');
    const iw = kode.indexOf('require("./isiOtomatisW2a").usulanW2a');
    expect(i6).toBeGreaterThan(0);
    expect(iw).toBeGreaterThan(i6);
    expect(kode.slice(iw, iw + 300)).toContain("!hasil.some((x) => x.kode === u.kode)");
  });

  it("berkas pengisi tidak menulis keyakinan pasti/cukup sehingga penjaga gerbang tidak menuntut ukuran", () => {
    const kode = readFileSync(path.join(REPO, "aleta_bot", "services", "isiOtomatisW2a.js"), "utf8");
    const tanpaKomentar = kode.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(/["'](?:pasti|cukup)["']/.test(tanpaKomentar)).toBe(false);
  });
});
