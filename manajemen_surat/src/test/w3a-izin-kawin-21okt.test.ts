// @vitest-environment node
/**
 * ============================================================================
 * 21 OKT 2026 (AGEN W3a-B) - IZIN KAWIN (SIPP 361): BLANGKO DERRY, VARIABEL, KATALOG SAKSI, DETEKSI
 * ============================================================================
 *
 * Perilaku yang dijaga (modul python dijalankan SUNGGUHAN, deteksi dijalankan SUNGGUHAN atas kalimat sintetis bergaya posita PA Donggala):
 *   - jenis_izin_kawin.py menulis 25 RTF (13 penetapan + 12 BAS), terbaca, penanda tidak terpecah, tanpa kata ALETA, tanpa sisa isian mentah,
 *     tanpa kata jenis lain (perwalian, hibah, nafkah anak ...), hanya memakai variabel server atau variabel baru 3640-3659;
 *   - variabel baru: nama <= 200 huruf, kueri hanya SELECT, tiap isian punya RAMAH, ISIAN hanya untuk data_teks, tanpa tumpang tindih;
 *   - BAS yang memuat pemeriksaan saksi juga memuat pendengaran orang tua/wali (#3659#) dan tidak lagi menyebut perwalian;
 *   - katalog saksi izin-kawin.json lolos mesin periksaKatalog, dikenali untuk jenis 361, semua dasar hukum terverifikasi;
 *   - deteksi: calon pasangan, umur, orang yang didengar (nama + hubungan), alasan, keadaan orang tua; teks tak berkaitan TIDAK menghasilkan nilai.
 * BATAS: perkara izin kawin di SIPP PA Donggala nol (21 Okt 2026), jadi ukuran atas perkara nyata tidak ada; fixture sintetis.
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
const FOLDER = "3a Izin Kawin";
const FOLDER_BAS = "3a Izin Kawin - BAS";
const TMP = process.env.TMP || "D:/Aplikasi/aleta/tmp";
const KAMUS_SERVER = "D:/aleta-dev/kerja/w3a/abt-variabel-server.json";

const lp = (p: string) => (process.platform === "win32" && !p.startsWith("\\\\?\\") ? "\\\\?\\" + path.resolve(p) : p);
const req = createRequire(path.resolve(process.cwd(), "../aleta_bot/routes/internalGatewayRoutes.js"));
const deteksi = req("../services/deteksi/izinKawin.js");
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

describe.skipIf(!ada)("paket izin kawin: modul python dan RTF", () => {
  const jalan = py([path.join(SUMBER, "jenis_izin_kawin.py")]);
  const info = py([
    "-c",
    "import sys,json; sys.path.insert(0,'sumber'); import jenis_izin_kawin as m, variabel_def as v; print(json.dumps(dict(var=v.VAR, isian=m.ISIAN, ramah=m.RAMAH, peta=m.PETA), ensure_ascii=False))",
  ]);
  const data = JSON.parse(info.stdout || "{}");
  const baru: any[] = (data.var || []).filter((x: any) => x.no >= 3640 && x.no <= 3659);
  const kamusServer: Set<string> = fs.existsSync(KAMUS_SERVER) ? new Set(Object.keys(JSON.parse(fs.readFileSync(KAMUS_SERVER, "utf8")))) : new Set();
  const kodeBaru = new Set(baru.map((x) => String(x.no).padStart(4, "0")));
  const berkas = (sub: string) => fs.readdirSync(lp(path.join(RTF, sub))).filter((n) => n.endsWith(".rtf"));

  it("modul jalan tanpa galat dan menulis 13 penetapan + 12 BAS", () => {
    expect(jalan.status, jalan.stderr).toBe(0);
    expect(berkas(FOLDER)).toHaveLength(13);
    expect(berkas(FOLDER_BAS)).toHaveLength(12);
  });

  it("20 variabel baru di jatah 3640-3659: nama <= 200 huruf, tanpa kata aplikasi ini, data_sql hanya SELECT", () => {
    expect(baru).toHaveLength(20);
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

  it("ISIAN hanya untuk data_teks, tidak ada yang rangkap; RAMAH melengkapi tiap isian", () => {
    const teks = new Set(baru.filter((x) => x.tipe !== "data_sql").map((x) => String(x.no)));
    for (const [kode, [jenis, alasan]] of Object.entries(data.isian as Record<string, [string, string]>)) {
      expect(teks.has(kode), `ISIAN ${kode} bukan data_teks`).toBe(true);
      expect(["manual", "opsional"]).toContain(jenis);
      expect(alasan.length).toBeGreaterThan(10);
    }
    for (const kode of teks) {
      expect(data.ramah[kode], `RAMAH ${kode}`).toBeTruthy();
      expect(data.ramah[kode].nm.length).toBeGreaterThan(5);
    }
    for (const kode of Object.keys(data.ramah)) expect(teks.has(kode), `RAMAH ${kode} bukan isian`).toBe(true);
  });

  it("PETA: 13 blangko, kombinasi (status, keadaan) unik", () => {
    expect(data.peta).toHaveLength(13);
    const kunci = data.peta.map((p: any) => `${p.status}|${p.keadaan}`);
    expect(new Set(kunci).size).toBe(kunci.length);
    expect(data.peta.every((p: any) => p.jenis === "izin-kawin" && p.folder === FOLDER)).toBe(true);
    for (const p of data.peta) expect(berkas(FOLDER)).toContain(p.berkas);
  });

  it("semua RTF: kurung seimbang, penanda utuh dan dikenal, tanpa kata aplikasi, tanpa sisa mentah, tanpa kata jenis lain", () => {
    const semua = [...berkas(FOLDER).map((n) => [FOLDER, n]), ...berkas(FOLDER_BAS).map((n) => [FOLDER_BAS, n])];
    expect(semua).toHaveLength(25);
    const terlarang = ["perwalian", "wali adhal", "wali adhol", "nafkah anak", "hibah", "wakaf", "wasiat", "mafqud", "pencegahan perkawinan", "asal usul anak", "aleta"];
    for (const [folder, nama] of semua) {
      const raw = fs.readFileSync(lp(path.join(RTF, folder, nama))).toString("latin1");
      expect(seimbang(raw), `${nama} kurung`).toBe(true);
      const teks = teksRtf(raw);
      const polos = teks.replace(/#\d{4}#/g, "");
      expect(polos, `${nama} penanda terpecah`).not.toMatch(/#\d{1,3}(?!\d)|(?<!\d)\d{1,3}#/);
      for (const t of new Set(teks.match(/#(\d{4})#/g) || [])) {
        const kode = t.slice(1, 5);
        if (kamusServer.size) expect(kamusServer.has(kode) || kodeBaru.has(kode), `${nama}: variabel ${kode} tidak dikenal`).toBe(true);
      }
      for (const kata of terlarang) expect(teks.toLowerCase(), `${nama}: ${kata}`).not.toContain(kata);
      expect(teks, `${nama}: sisa mentah`).not.toMatch(/ANAK 1 PERSATU|PERSATU P NYA|\.\.\.|\[ \]|(^|\s)_(\s|$)/);
    }
  });

  it("penetapan Kabul memuat sebutan calon pasangan, pendengaran orang tua/wali dan dasar Pasal 6 ayat (5) UU 1/1974", () => {
    for (const nama of berkas(FOLDER).filter((n) => n.startsWith("[01"))) {
      const teks = teksRtf(fs.readFileSync(lp(path.join(RTF, FOLDER, nama))).toString("latin1"));
      expect(teks, nama).toContain("#3648#");
      expect(teks, nama).toContain("#3640#");
      expect(teks, nama).toContain("Pasal 6 ayat (5) Undang-Undang Nomor 1 Tahun 1974");
      expect(teks, nama).toContain("Penjelasan Pasal 49 huruf a angka 2");
      expect(teks, nama).toMatch(/Memberi izin kepada #0046#/);
      expect(teks, nama).toContain("#8501#");
    }
  });

  it("varian pilihan hakim: Kabul/Tolak/NO berbeda amar dan pertimbangan batas umur (19 dan 21 tahun)", () => {
    const baca = (cari: string) => teksRtf(fs.readFileSync(lp(path.join(RTF, FOLDER, berkas(FOLDER).find((n) => n.startsWith(cari))!))).toString("latin1"));
    expect(baca("[03] ")).toMatch(/Menolak #0053# #0046#/);
    expect(baca("[03] ")).not.toMatch(/Memberi izin kepada/);
    expect(baca("[99a]")).toContain("Peraturan Mahkamah Agung Nomor 5 Tahun 2019");
    expect(baca("[99a]")).toContain("Pasal 7 ayat (2)");
    expect(baca("[99b]")).toContain("21 (dua puluh satu) tahun");
    expect(baca("[99c]")).toContain("Pasal 6 ayat (2) huruf c Peraturan Pemerintah Nomor 9 Tahun 1975");
    expect(baca("[01b]")).toContain("Pasal 6 ayat (3)");
    expect(baca("[01c]")).toContain("Pasal 6 ayat (4)");
  });

  it("BAS pemeriksaan saksi memuat pendengaran orang tua/wali (#3659#), nasihat izin kawin, dan tidak menyebut perwalian", () => {
    const nama = berkas(FOLDER_BAS);
    expect(nama.every((n) => n.startsWith("BAS ALUR 62 Izin Kawin - "))).toBe(true);
    for (const kode of ["[1]", "[1a]", "[1b]", "[2]", "[2a]", "[2b]"]) {
      const f = nama.find((n) => n.includes(` - ${kode} `))!;
      const teks = teksRtf(fs.readFileSync(lp(path.join(RTF, FOLDER_BAS, f))).toString("latin1"));
      expect(teks, f).toContain("#3659#");
      expect(teks.toLowerCase(), f).not.toContain("perwalian");
    }
    const satu = nama.find((n) => n.includes(" - [1] "))!;
    const t1 = teksRtf(fs.readFileSync(lp(path.join(RTF, FOLDER_BAS, satu))).toString("latin1"));
    expect(t1).toContain("ketentuan izin kawin bagi calon mempelai yang belum berumur 21");
    expect(t1).toContain("#3654#");
    expect(t1.indexOf("#3659#")).toBeLessThan(t1.indexOf("#5058#"));
  });
});

describe("katalog saksi izin-kawin", () => {
  const kat = JSON.parse(fs.readFileSync(path.join(REPO, "ekstensi-sipp", "saksi-katalog", "izin-kawin.json"), "utf8"));
  const kamus = fs.existsSync(KAMUS_SERVER) ? new Set(Object.keys(JSON.parse(fs.readFileSync(KAMUS_SERVER, "utf8")))) : null;
  if (kamus) for (let n = 3640; n <= 3659; n++) kamus.add(String(n));

  it("lolos periksaKatalog tanpa galat", () => {
    const r = Mesin.periksaKatalog(kat, { namaBerkas: "izin-kawin.json", variabelAda: kamus });
    expect(r.galat).toEqual([]);
  });

  it("dikenali untuk jenis perkara 361 dan hanya itu; minimal 20 butir; tiap jawaban 4+4 varian", () => {
    expect(kat.syarat.jenisPerkaraId).toEqual(["361"]);
    const k = Mesin.kenaliKatalog([kat], { jenisPerkaraId: "361", alurPerkaraId: "16", nama: "Izin Kawin" });
    expect(k && k.kunci).toBe("izin-kawin");
    expect(Mesin.kenaliKatalog([kat], { jenisPerkaraId: "363", alurPerkaraId: "16", nama: "Wali Adhal" })).toBeFalsy();
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

  it("semua dasar hukum terverifikasi dan bersumber; BAS menunjuk berkas yang ada; kata aplikasi tidak muncul", () => {
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

  it("susunSaksi: dua saksi, butir yang sama tidak pernah berkalimat sama, butir keadaan tidak berlaku muncul sesuai keadaan", () => {
    const masuk = (keadaan: Record<string, string>) => ({ benih: "1/Pdt.P/2026/PA.Dgl", keadaan, saksi: [{ pihak: "P" }, { pihak: "P" }], slot: { hubungan: "kakak kandung Pemohon" } });
    const hadir = Mesin.susunSaksi(kat, masuk({ keadaanOrangTua: "kedua-hidup", orangDidengar: "hadir" }));
    expect(hadir.saksi).toHaveLength(2);
    const idButir = (s: any) => s.baris.map((b: any) => b.id || b.butir);
    const semuaId = JSON.stringify(hadir.saksi[0].baris);
    expect(semuaId).toContain("q-sikap-disampaikan");
    expect(semuaId).not.toContain("q-tidak-hadir");
    expect(semuaId).not.toContain("q-wali-keluarga");
    const wali = JSON.stringify(Mesin.susunSaksi(kat, masuk({ keadaanOrangTua: "kedua-meninggal", orangDidengar: "tidak-hadir" })).saksi[0].baris);
    expect(wali).toContain("q-wali-keluarga");
    expect(wali).toContain("q-tidak-hadir");
    expect(idButir(hadir.saksi[0]).length).toBe(idButir(hadir.saksi[1]).length);
    for (let i = 0; i < hadir.saksi[0].baris.length; i++) {
      const a = JSON.stringify(hadir.saksi[0].baris[i].jawaban ?? hadir.saksi[0].baris[i]);
      const b = JSON.stringify(hadir.saksi[1].baris[i].jawaban ?? hadir.saksi[1].baris[i]);
      if (/q-penutup/.test(JSON.stringify(hadir.saksi[0].baris[i]))) continue;
      expect(a, `butir ${i}`).not.toBe(b);
    }
  });
});

describe("deteksi izin kawin (kalimat sintetis bergaya posita)", () => {
  const POSITA = `1. Bahwa Pemohon adalah seorang perempuan berumur 20 tahun yang hendak melangsungkan pernikahan dengan seorang laki-laki bernama Ahmad Fauzi bin Yusuf, umur 24 tahun, pekerjaan karyawan swasta;
2. Bahwa ayah kandung Pemohon yang bernama Hasan bin Ali tidak memberikan izin kepada Pemohon untuk menikah karena menurut ayah Pemohon, Pemohon masih harus menyelesaikan kuliah;
3. Bahwa ibu kandung Pemohon yang bernama Siti binti Abu telah menyetujui rencana pernikahan tersebut;`;

  it("modul terdaftar untuk jenis 361", () => {
    expect(deteksi.kunci).toBe("izin-kawin");
    expect(deteksi.jenisPerkaraId).toEqual([361]);
  });

  it("calon pasangan, umur, orang yang menolak (cukup), orang lain yang disebut (ragu), alasan (ragu)", () => {
    const h = deteksi.deteksi(POSITA);
    expect(h["3640"]).toMatchObject({ nilai: "Ahmad Fauzi bin Yusuf", yakin: "cukup" });
    expect(h["3641"]).toMatchObject({ nilai: "24", yakin: "cukup" });
    expect(h["3644"]).toMatchObject({ nilai: "Hasan bin Ali", yakin: "cukup" });
    expect(h["3645"]).toMatchObject({ nilai: "ayah kandung", yakin: "cukup" });
    expect(h["3646"]).toMatchObject({ nilai: "Siti binti Abu", yakin: "ragu" });
    expect(h["3647"]).toMatchObject({ nilai: "ibu kandung", yakin: "ragu" });
    expect(h["3651"].nilai).toBe("karena menurut ayah Pemohon, Pemohon masih harus menyelesaikan kuliah");
    expect(h["3651"].yakin).toBe("ragu");
    for (const v of Object.values(h) as any[]) {
      expect(v.kalimat.length).toBeGreaterThan(5);
      expect(["cukup", "ragu"]).toContain(v.yakin);
    }
  });

  it("calon istri bila Pemohon laki-laki, ibu kandung sebagai orang pertama", () => {
    const h = deteksi.deteksi("Bahwa Pemohon akan menikah dengan seorang perempuan bernama Rina Lestari binti Karim, umur 19 tahun; Bahwa ibu kandung Pemohon yang bernama Dahlia binti Salim tidak menyetujui rencana tersebut karena calon istri masih berstatus pelajar;");
    expect(h["3640"].nilai).toBe("Rina Lestari binti Karim");
    expect(h["3641"].nilai).toBe("19");
    expect(h["3644"]).toMatchObject({ nilai: "Dahlia binti Salim", yakin: "cukup" });
    expect(h["3645"].nilai).toBe("ibu kandung");
    expect(h["3646"]).toBeUndefined();
  });

  it("orang tua yang meninggal tidak dianggap orang yang didengar; keadaan orang tua 2 (satu) dan 4 (kedua)", () => {
    const satu = deteksi.deteksi("Bahwa ayah kandung Pemohon yang bernama Sukri bin Anwar telah meninggal dunia; Bahwa ibu kandung Pemohon yang bernama Nur binti Hamid tidak memberikan izin kepada Pemohon karena masih ingin Pemohon bekerja;");
    expect(satu["3649"]).toMatchObject({ nilai: "2", yakin: "cukup" });
    expect(satu["3644"].nilai).toBe("Nur binti Hamid");
    expect(satu["3646"]).toBeUndefined();
    const kedua = deteksi.deteksi("Bahwa kedua orang tua kandung Pemohon telah meninggal dunia; Bahwa kakek Pemohon yang bernama Darwis bin Salim tidak memberikan izin kepada Pemohon untuk menikah;");
    expect(kedua["3649"]).toMatchObject({ nilai: "4", yakin: "cukup" });
    expect(kedua["3644"]).toMatchObject({ nilai: "Darwis bin Salim", yakin: "cukup" });
    expect(kedua["3645"].nilai).toBe("kakek");
  });

  it("teks tak berkaitan (cerai, kosong) TIDAK menghasilkan nilai apa pun", () => {
    expect(deteksi.deteksi("")).toEqual({});
    expect(deteksi.deteksi("Bahwa Penggugat dan Tergugat telah menikah pada tanggal 1 Januari 2015; Bahwa sejak tahun 2020 rumah tangga sering terjadi perselisihan dan pertengkaran;")).toEqual({});
    expect(deteksi.deteksi("Bahwa Pemohon mohon ditetapkan sebagai wali bagi anak bernama Budi karena kedua orang tuanya telah meninggal dunia;")).toEqual({});
  });
});
