// @vitest-environment node
/**
 * ============================================================================
 * 21 OKT 2026 (AGEN W3a-B) - PENGESAHAN ANAK (SIPP 352): BLANGKO DERRY, VARIABEL, KATALOG SAKSI, DETEKSI
 * ============================================================================
 *
 * Perilaku yang dijaga (modul python dijalankan SUNGGUHAN, deteksi dijalankan SUNGGUHAN atas kalimat sintetis bergaya posita PA Donggala):
 *   - jenis_pengesahan_anak.py menulis 23 RTF (11 penetapan + 12 BAS), terbaca, penanda tidak terpecah, tanpa kata ALETA, tanpa sisa isian mentah,
 *     tanpa kata jenis lain (perwalian, hibah, nafkah anak ...), hanya memakai variabel server atau variabel baru 3660-3689;
 *   - variabel baru: nama <= 200 huruf, kueri hanya SELECT, tiap isian punya RAMAH, ISIAN hanya untuk data_teks, tanpa tumpang tindih;
 *   - BAS tidak lagi menyebut perwalian dan memuat nasihat pengesahan anak;
 *   - katalog saksi pengesahan-anak.json lolos mesin periksaKatalog, dikenali untuk jenis 361, semua dasar hukum terverifikasi;
 *   - deteksi: nama anak, tempat/tanggal lahir, akta nikah/itsbat, keadaan pencatatan, sebab belum berakta, DNA, pengakuan, tujuan; teks tak berkaitan TIDAK menghasilkan nilai.
 * BATAS: perkara pengesahan anak di SIPP PA Donggala nol (21 Okt 2026), jadi ukuran atas perkara nyata tidak ada; fixture sintetis.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const REPO = path.resolve(__dirname, "../../..");
const PAKET = path.join(REPO, "abt-paket", "w3a-blangko-baru-perkawinan");
const SUMBER = path.join(PAKET, "sumber");
const RTF = path.join(PAKET, "rtf", "derry_briantono");
const FOLDER = "8a Pengesahan Anak";
const FOLDER_BAS = "8a Pengesahan Anak - BAS";
const TMP = process.env.TMP || "D:/Aplikasi/aleta/tmp";
const KAMUS_SERVER = "D:/aleta-dev/kerja/w3a/abt-variabel-server.json";

const lp = (p: string) => (process.platform === "win32" && !p.startsWith("\\\\?\\") ? "\\\\?\\" + path.resolve(p) : p);
const req = createRequire(path.resolve(process.cwd(), "../aleta_bot/routes/internalGatewayRoutes.js"));
const deteksi = req("../services/deteksi/pengesahanAnak.js");
const Mesin = req(path.join(REPO, "ekstensi-sipp", "saksi-katalog.js"));

function py(args: string[]) {
  return spawnSync("python", args, { encoding: "utf8", env: { ...process.env, TMP, TEMP: TMP, PYTHONIOENCODING: "utf-8" }, cwd: PAKET, maxBuffer: 64 * 1024 * 1024 });
}
const ada = py(["--version"]).status === 0;

function teksRtf(raw: string): string {
  return raw
    .replace(/\{\\\*[^{}]*\}/g, "")
    .replace(/\\'([0-9a-f]{2})/gi, (_, h) => Buffer.from(h, "hex").toString("latin1"))
    .replace(/\\(?:par|line|tab|cell|row)\b ?/g, "\n")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
    .replace(/[{}]/g, "");
}
function seimbang(raw: string): boolean {
  let d = 0;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === "\\") {
      i += 1;
      continue;
    }
    if (c === "{") d += 1;
    else if (c === "}") {
      d -= 1;
      if (d < 0) return false;
    }
  }
  return d === 0;
}


describe.skipIf(!ada)("paket pengesahan anak: modul python dan RTF", () => {
  const jalan = py([path.join(SUMBER, "jenis_pengesahan_anak.py")]);
  const info = py([
    "-c",
    "import sys,json; sys.path.insert(0,'sumber'); import jenis_pengesahan_anak as m, variabel_def as v; print(json.dumps(dict(var=v.VAR, isian=m.ISIAN, ramah=m.RAMAH, peta=m.PETA), ensure_ascii=False))",
  ]);
  const data = JSON.parse(info.stdout || "{}");
  const baru: any[] = (data.var || []).filter((x: any) => x.no >= 3660 && x.no <= 3689);
  const kamusServer: Set<string> = fs.existsSync(KAMUS_SERVER) ? new Set(Object.keys(JSON.parse(fs.readFileSync(KAMUS_SERVER, "utf8")))) : new Set();
  const kodeBaru = new Set(baru.map((x) => String(x.no).padStart(4, "0")));
  const berkas = (sub: string) => fs.readdirSync(lp(path.join(RTF, sub))).filter((n) => n.endsWith(".rtf"));
  const baca = (sub: string, cari: string) => teksRtf(fs.readFileSync(lp(path.join(RTF, sub, berkas(sub).find((n) => n.includes(cari))!))).toString("latin1"));

  it("modul jalan tanpa galat dan menulis 11 penetapan + 12 BAS", () => {
    expect(jalan.status, jalan.stderr).toBe(0);
    expect(berkas(FOLDER)).toHaveLength(11);
    expect(berkas(FOLDER_BAS)).toHaveLength(12);
  });

  it("17 variabel baru di jatah 3660-3689: nama <= 200 huruf, tanpa kata aplikasi ini, data_sql hanya SELECT", () => {
    expect(baru).toHaveLength(17);
    for (const x of baru) {
      expect(x.nama.length, `nama ${x.no}`).toBeLessThanOrEqual(200);
      expect(`${x.nama}${x.sql || ""}${x.default || ""}`.toLowerCase(), `aleta ${x.no}`).not.toContain("aleta");
      if (x.tipe === "data_sql") {
        expect(x.sql.trim().toUpperCase().startsWith("SELECT"), `SELECT ${x.no}`).toBe(true);
        expect(x.sql.replace(/"[^"]*"|'[^']*'/g, "''"), `satu pernyataan ${x.no}`).not.toMatch(/;\s*\S/);
        expect(x.sql.toUpperCase(), `tanpa DML ${x.no}`).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER)\b/);
        expect(x.sql, `kolom data ${x.no}`).toMatch(/\bAS data\b/);
      }
    }
  });

  it("ISIAN hanya untuk data_teks; RAMAH melengkapi tiap isian", () => {
    const teks = new Set(baru.filter((x) => x.tipe !== "data_sql").map((x) => String(x.no)));
    for (const [kode, [jenis, alasan]] of Object.entries(data.isian as Record<string, [string, string]>)) {
      expect(teks.has(kode), `ISIAN ${kode} bukan data_teks`).toBe(true);
      expect(["manual", "opsional"]).toContain(jenis);
      expect(alasan.length).toBeGreaterThan(10);
    }
    for (const kode of teks) expect(data.ramah[kode], `RAMAH ${kode}`).toBeTruthy();
    for (const kode of Object.keys(data.ramah)) expect(teks.has(kode), `RAMAH ${kode} bukan isian`).toBe(true);
  });

  it("PETA: 11 blangko, kombinasi (status, keadaan) unik, semua berkasnya ada", () => {
    expect(data.peta).toHaveLength(11);
    const kunci = data.peta.map((p: any) => `${p.status}|${p.keadaan}`);
    expect(new Set(kunci).size).toBe(kunci.length);
    expect(data.peta.every((p: any) => p.jenis === "pengesahan-anak" && p.folder === FOLDER)).toBe(true);
    for (const p of data.peta) expect(berkas(FOLDER)).toContain(p.berkas);
  });

  it("semua RTF: kurung seimbang, penanda utuh dan dikenal, tanpa kata aplikasi, tanpa sisa mentah, tanpa kata jenis lain", () => {
    const semua = [...berkas(FOLDER).map((n) => [FOLDER, n]), ...berkas(FOLDER_BAS).map((n) => [FOLDER_BAS, n])];
    expect(semua).toHaveLength(23);
    const terlarang = ["perwalian", "wali adhal", "wali adhol", "nafkah anak", "hibah", "wakaf", "wasiat", "mafqud", "pencegahan perkawinan", "aleta"];
    for (const [folder, nama] of semua) {
      const raw = fs.readFileSync(lp(path.join(RTF, folder, nama))).toString("latin1");
      expect(seimbang(raw), `${nama} kurung`).toBe(true);
      const teks = teksRtf(raw);
      expect(teks.replace(/#\d{4}#/g, ""), `${nama} penanda terpecah`).not.toMatch(/#\d{1,3}(?!\d)|(?<!\d)\d{1,3}#/);
      for (const t of new Set(teks.match(/#(\d{4})#/g) || [])) {
        const kode = t.slice(1, 5);
        if (kamusServer.size) expect(kamusServer.has(kode) || kodeBaru.has(kode), `${nama}: variabel ${kode} tidak dikenal`).toBe(true);
      }
      for (const kata of terlarang) expect(teks.toLowerCase(), `${nama}: ${kata}`).not.toContain(kata);
      expect(teks, `${nama}: sisa mentah`).not.toMatch(/ANAK 1 PERSATU|PERSATU P NYA|\.\.\.|\[ \]|(^|\s)_(\s|$)/);
    }
  });

  it("penetapan Kabul: dasar kewenangan angka 14, Pasal 44 ayat (2), status anak pilihan majelis, amar menetapkan status", () => {
    for (const nama of berkas(FOLDER).filter((n) => n.startsWith("[01"))) {
      const teks = teksRtf(fs.readFileSync(lp(path.join(RTF, FOLDER, nama))).toString("latin1"));
      expect(teks, nama).toContain("Penjelasan Pasal 49 huruf a angka 14");
      expect(teks, nama).toContain("Pasal 44 ayat (2) Undang-Undang Nomor 1 Tahun 1974");
      expect(teks, nama).toContain("#3668#");
      expect(teks, nama).toMatch(/Menetapkan bahwa #3661# bernama #8602#, yang lahir #3660#, adalah #3668#;/);
      expect(teks, nama).toContain("#3676#");
    }
  });

  it("[01] memuat pertimbangan pencatatan (3663) dan fakta pencatatan (3674); [01a] memuat Putusan MK 46/PUU-VIII/2010, hubungan darah dan pengakuan", () => {
    const a = baca(FOLDER, "[01] [Kabul]");
    expect(a).toContain("#3663#");
    expect(a).toContain("#3674#");
    expect(a).toContain("Pasal 14 Kompilasi Hukum Islam");
    const b = baca(FOLDER, "[01a] [Kabul]");
    expect(b).toContain("Putusan Nomor 46/PUU-VIII/2010");
    expect(b).toContain("#3667#");
    expect(b).toContain("#3675#");
    expect(b).toContain("Pasal 43 ayat (1) Undang-Undang Nomor 1 Tahun 1974");
    expect(b).toContain("Pasal 100 Kompilasi Hukum Islam");
  });

  it("Tolak dan NO: amar sesuai, dasar hukum khas varian", () => {
    expect(baca(FOLDER, "[03] [Tolak]")).toMatch(/Menolak #0053# #0046#/);
    expect(baca(FOLDER, "[03] [Tolak]")).not.toContain("Menetapkan bahwa #3661#");
    expect(baca(FOLDER, "[03a] [Tolak]")).toContain("Putusan Nomor 46/PUU-VIII/2010");
    expect(baca(FOLDER, "[99a]")).toContain("Pasal 7 ayat (1) dan ayat (2) Kompilasi Hukum Islam");
    expect(baca(FOLDER, "[99b]")).toContain("Pasal 44 ayat (2) Undang-Undang Nomor 1 Tahun 1974");
    expect(baca(FOLDER, "[99c]")).toContain("Pasal 55 ayat (1) Undang-Undang Nomor 1 Tahun 1974");
    for (const k of ["[99a]", "[99b]", "[99c]"]) expect(baca(FOLDER, k)).toMatch(/tidak dapat diterima \(Niet Ontvankelijke Verklaard\)/);
  });

  it("BAS ALUR 63: nama berpola, nasihat pengesahan anak, header isian, tanpa perwalian", () => {
    const nama = berkas(FOLDER_BAS);
    expect(nama.every((n) => n.startsWith("BAS ALUR 63 Pengesahan Anak - "))).toBe(true);
    const satu = nama.find((n) => n.includes(" - [1] "))!;
    const t1 = teksRtf(fs.readFileSync(lp(path.join(RTF, FOLDER_BAS, satu))).toString("latin1"));
    expect(t1).toContain("pengertian dan akibat hukum pengesahan anak");
    expect(t1).toContain("#3669#");
    expect(t1.indexOf("#3660#")).toBeGreaterThanOrEqual(0);
    expect(t1.indexOf("#3660#")).toBeLessThan(t1.indexOf("BERITA ACARA SIDANG"));
  });
});

describe("katalog saksi pengesahan-anak", () => {
  const kat = JSON.parse(fs.readFileSync(path.join(REPO, "ekstensi-sipp", "saksi-katalog", "pengesahan-anak.json"), "utf8"));
  const kamus = fs.existsSync(KAMUS_SERVER) ? new Set(Object.keys(JSON.parse(fs.readFileSync(KAMUS_SERVER, "utf8")))) : null;
  if (kamus) for (let n = 3660; n <= 3689; n++) kamus.add(String(n));

  it("lolos periksaKatalog tanpa galat", () => {
    const r = Mesin.periksaKatalog(kat, { namaBerkas: "pengesahan-anak.json", variabelAda: kamus });
    expect(r.galat).toEqual([]);
  });

  it("dikenali untuk jenis perkara 352 saja; minimal 20 butir; tiap jawaban 4+4 varian; asal usul anak (358) tidak ikut", () => {
    expect(kat.syarat.jenisPerkaraId).toEqual(["352"]);
    expect(Mesin.kenaliKatalog([kat], { jenisPerkaraId: "352", alurPerkaraId: "16", nama: "Pengesahan Anak" })?.kunci).toBe("pengesahan-anak");
    expect(Mesin.kenaliKatalog([kat], { jenisPerkaraId: "358", alurPerkaraId: "16", nama: "Asal Usul Anak" })).toBeFalsy();
    expect(kat.pertanyaan.length).toBeGreaterThanOrEqual(20);
    for (const q of kat.pertanyaan) {
      for (const jaw of Object.values(q.jawaban) as any[]) {
        for (const x of Array.isArray(jaw) ? jaw : [jaw]) {
          expect(x.saksi1.length).toBeGreaterThanOrEqual(4);
          expect(x.saksi2.length).toBeGreaterThanOrEqual(4);
        }
      }
    }
  });

  it("dasar hukum terverifikasi dan bersumber; BAS menunjuk berkas yang ada; kata aplikasi tidak muncul", () => {
    expect(kat.dasarHukum.length).toBeGreaterThanOrEqual(10);
    for (const d of kat.dasarHukum) {
      expect(d.status).toBe("terverifikasi");
      expect(d.sumber.length).toBeGreaterThan(10);
    }
    expect(JSON.stringify(kat).toLowerCase()).not.toContain("aleta");
    if (fs.existsSync(lp(path.join(RTF, FOLDER_BAS)))) {
      const ada = new Set(fs.readdirSync(lp(path.join(RTF, FOLDER_BAS))).map((n) => n.replace(/\.rtf$/, "")));
      for (const b of kat.blangkoBas) {
        expect(b.folder).toBe(FOLDER_BAS);
        expect(ada.has(b.berkas), b.berkas).toBe(true);
      }
    }
  });

  it("susunSaksi: butir anak lahir sebelum nikah (hubungan darah, pengakuan) hanya muncul pada keadaan itu; kalimat dua saksi berbeda", () => {
    const masuk = (keadaan: Record<string, string>) => ({ benih: "1/Pdt.P/2026/PA.Dgl", keadaan, saksi: [{ pihak: "P" }, { pihak: "P" }], slot: { hubungan: "tetangga Pemohon" } });
    const dalam = Mesin.susunSaksi(kat, masuk({ waktuLahir: "dalam-perkawinan", pencatatanNikah: "dicatat-kemudian" }));
    const sebelum = Mesin.susunSaksi(kat, masuk({ waktuLahir: "sebelum-nikah", pencatatanNikah: "belum-dicatat" }));
    const a = JSON.stringify(dalam.saksi[0].baris);
    const b = JSON.stringify(sebelum.saksi[0].baris);
    expect(a).not.toContain("q-hubungan-darah");
    expect(a).toContain("q-nikah-dicatat-kemudian");
    expect(a).not.toContain("q-nikah-belum-dicatat");
    expect(b).toContain("q-hubungan-darah");
    expect(b).toContain("q-pengakuan-ayah");
    expect(b).toContain("q-nikah-belum-dicatat");
    for (let i = 0; i < dalam.saksi[0].baris.length; i++) {
      if (/q-penutup/.test(JSON.stringify(dalam.saksi[0].baris[i]))) continue;
      expect(JSON.stringify(dalam.saksi[0].baris[i].jawaban ?? dalam.saksi[0].baris[i]), `butir ${i}`).not.toBe(JSON.stringify(dalam.saksi[1].baris[i].jawaban ?? dalam.saksi[1].baris[i]));
    }
  });
});

describe("deteksi pengesahan anak (kalimat sintetis bergaya posita)", () => {
  const POSITA = `1. Bahwa Pemohon I dan Pemohon II telah menikah secara agama Islam pada tanggal 12 Mei 2019 di Desa Tibo, Kecamatan Dolo, Kabupaten Sigi;
2. Bahwa pernikahan Pemohon I dan Pemohon II tersebut baru dicatat di Kantor Urusan Agama Kecamatan Dolo, Kabupaten Sigi dengan Akta Nikah Nomor 123/45/VI/2021 tanggal 10 Juni 2021, yaitu setelah anak lahir;
3. Bahwa dari pernikahan tersebut telah dikaruniai seorang anak bernama Aisyah binti Budi Santoso yang lahir di Tibo, pada hari Senin, tanggal 18 Agustus 2019;
4. Bahwa anak tersebut belum mempunyai akta kelahiran karena orang tuanya belum mengurusnya;
5. Bahwa Pemohon I dan Pemohon II memohon pengesahan anak agar dapat dipergunakan untuk mengurus akta kelahiran anak tersebut;`;
  const PETITUM = "1. Mengabulkan permohonan Pemohon I dan Pemohon II; 2. Menetapkan anak bernama Aisyah binti Budi Santoso adalah anak sah dari Pemohon I dan Pemohon II; 3. Membebankan biaya perkara kepada Pemohon;";

  it("modul terdaftar untuk jenis 352", () => {
    expect(deteksi.kunci).toBe("pengesahan-anak");
    expect(deteksi.jenisPerkaraId).toEqual([352]);
  });

  it("nama anak (petitum+posita sepakat = cukup), lahir (cukup), akta nikah, keadaan A, sebab, tujuan (ragu)", () => {
    const h = deteksi.deteksi(POSITA, { petitum: PETITUM });
    expect(h["8603"]).toMatchObject({ nilai: "Aisyah binti Budi Santoso", yakin: "cukup" });
    expect(h["3660"]).toMatchObject({ nilai: "di Tibo pada tanggal 18 Agustus 2019", yakin: "cukup" });
    expect(h["3664"].nilai).toContain("Akta Nikah Nomor 123/45/VI/2021 tanggal 10 Juni 2021");
    expect(h["3664"].yakin).toBe("ragu");
    expect(h["3662"].nilai.startsWith("A ·")).toBe(true);
    expect(h["3665"].nilai).toBe("belum mempunyai akta kelahiran karena orang tuanya belum mengurusnya");
    expect(h["3672"].nilai).toBe("mengurus akta kelahiran anak tersebut");
    for (const v of Object.values(h) as any[]) {
      expect(v.kalimat.length).toBeGreaterThan(5);
      expect(["cukup", "ragu"]).toContain(v.yakin);
    }
  });

  it("itsbat = pilihan C; belum dicatat = pilihan B; tes DNA dan pengakuan ayah", () => {
    const c = deteksi.deteksi("Bahwa pernikahan Pemohon I dan Pemohon II telah diitsbatkan dengan Penetapan Pengadilan Agama Donggala Nomor 12/Pdt.P/2025/PA.Dgl tanggal 3 Maret 2025;");
    expect(c["3662"].nilai.startsWith("C ·")).toBe(true);
    expect(c["3664"].nilai).toBe("Penetapan Itsbat Nikah Nomor 12/Pdt.P/2025/PA.Dgl tanggal 3 Maret 2025");
    const b = deteksi.deteksi("Bahwa pernikahan Pemohon I dan Pemohon II belum dicatat di Kantor Urusan Agama; Bahwa Pemohon I mengakui anak tersebut sebagai anak kandungnya dan telah dilakukan tes DNA di laboratorium;");
    expect(b["3662"].nilai.startsWith("B ·")).toBe(true);
    expect(b["3670"]).toMatchObject({ yakin: "ragu" });
    expect(b["3666"]).toMatchObject({ nilai: "dibuktikan dengan hasil tes DNA", yakin: "ragu" });
  });

  it("teks tak berkaitan (cerai, kosong) TIDAK menghasilkan nilai apa pun", () => {
    expect(deteksi.deteksi("")).toEqual({});
    expect(deteksi.deteksi("Bahwa Penggugat dan Tergugat telah menikah pada tanggal 1 Januari 2015; Bahwa sejak tahun 2020 rumah tangga sering terjadi perselisihan dan pertengkaran;")).toEqual({});
    expect(deteksi.deteksi("Bahwa Pemohon mohon izin untuk menikah dengan seorang laki-laki;")).toEqual({});
  });
});
