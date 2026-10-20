// @vitest-environment node
/**
 * ============================================================================
 * 21 OKT 2026 (AGEN W3a-A) - PERKAWINAN CAMPURAN (SIPP 359, ALUR 61)
 * ============================================================================
 *
 * Dijaga:
 *   - deteksi isian dari posita (aleta_bot/services/deteksi/perkawinanCampuran.js): nama calon WNI dan WNA, negara asal, pejabat penolak, nomor/tanggal surat penolakan,
 *     alasan penolakan terisi "cukup"; huruf syarat hanya saran "ragu"; teks tak berkaitan tidak menghasilkan apa pun;
 *   - modul python jenis_perkawinan_campuran.py benar-benar membangun RTF (putusan + BAS) dan katalog yang lolos mesin pemeriksa katalog;
 *   - RTF: penanda utuh, hanya variabel yang dikenal, tanpa kata aplikasi ini, tanpa sisa isian mentah, tanpa kata jenis lain;
 *   - variabel baru: jatah 3620-3639, nama <= 200 huruf, kueri SELECT saja, tiap isian punya ISIAN dan RAMAH.
 * BATAS: perkara nyata jenis ini NOL di SIPP PA Donggala; fixture di bawah sintetis (bergaya posita permohonan PA).
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

const REPO = path.resolve(__dirname, "../../..");
const SUMBER = path.join(REPO, "abt-paket", "w3a-blangko-baru-perkawinan", "sumber");
const req = createRequire(path.join(REPO, "aleta_bot", "package.json"));
const deteksi = req(path.join(REPO, "aleta_bot", "services", "deteksi", "perkawinanCampuran.js"));
const Mesin = req(path.join(REPO, "ekstensi-sipp", "saksi-katalog.js"));

const env = { ...process.env, TMP: "D:/Aplikasi/aleta/tmp", TEMP: "D:/Aplikasi/aleta/tmp", PYTHONIOENCODING: "utf-8" };
const py = (kode: string) => execFileSync("python", ["-c", kode], { cwd: SUMBER, env, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });

type Fakta = { nilai: string; yakin: string; kalimat: string };
type Peta = Record<string, Fakta>;
const nilai = (p: Peta, k: string) => (p[k] ? p[k].nilai : undefined);

describe("deteksi perkawinan campuran", () => {
  const POSITA = `<ol>
<li>Bahwa Pemohon I adalah warga negara Indonesia bernama Rina Marlina binti Ahmad dan Pemohon II adalah warga negara Malaysia bernama Ahmad Faiz bin Hassan, keduanya beragama Islam;</li>
<li>Bahwa Para Pemohon bermaksud melangsungkan perkawinan campuran di Indonesia;</li>
<li>Bahwa Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan Banawa, Kabupaten Donggala telah menolak memberikan surat keterangan bahwa syarat-syarat perkawinan telah dipenuhi berdasarkan Surat Penolakan Nomor B-45/Kua.20.01.01/PW.01/04/2026 tanggal 20 April 2026 dengan alasan surat keterangan dari kedutaan negara asal Pemohon II belum diserahkan;</li></ol>`;

  it("jenis 359 dan peta variabel memuat semua kode yang dideteksi", () => {
    expect(deteksi.kunci).toBe("perkawinan-campuran");
    expect(deteksi.jenisPerkaraId).toEqual([359]);
    const kode = new Set(deteksi.variabel.map((v: { kode: string }) => v.kode));
    for (const k of Object.keys(deteksi.deteksi(POSITA))) expect(kode.has(k), k).toBe(true);
  });

  it("posita lengkap: nama WNI dan WNA, negara asal, pejabat, nomor, tanggal dan alasan terisi 'cukup'", () => {
    const p: Peta = deteksi.deteksi(POSITA);
    expect(nilai(p, "3620")).toBe("Rina Marlina binti Ahmad");
    expect(nilai(p, "3621")).toBe("Ahmad Faiz bin Hassan");
    expect(nilai(p, "3624")).toBe("Malaysia");
    expect(nilai(p, "3626")).toBe("Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan Banawa, Kabupaten Donggala");
    expect(nilai(p, "0652")).toBe("B-45/Kua.20.01.01/PW.01/04/2026");
    expect(nilai(p, "0653")).toBe("20 April 2026");
    expect(nilai(p, "3627")).toBe("surat keterangan dari kedutaan negara asal Pemohon II belum diserahkan");
    for (const k of ["3620", "3621", "3624", "3626", "0652", "0653", "3627"]) expect(p[k].yakin, k).toBe("cukup");
    for (const k of Object.keys(p)) expect(p[k].kalimat.length, `sumber ${k}`).toBeGreaterThan(10);
  });

  it("Indonesia dan 'asing' tidak dianggap negara asal; huruf syarat hanya saran 'ragu' dan tidak ditebak bila ambigu", () => {
    const p: Peta = deteksi.deteksi(POSITA);
    expect(nilai(p, "3631")).toBe("A");
    expect(p["3631"].yakin).toBe("ragu");
    const asing: Peta = deteksi.deteksi("<p>Bahwa Pemohon II adalah warga negara asing bernama John Smith dan Pemohon I warga negara Indonesia bernama Sari Dewi.</p>");
    expect(asing["3624"]).toBeUndefined();
    expect(nilai(asing, "3621")).toBe("John Smith");
    const huruf = deteksi.hurufDariAlasan as (a: string) => string;
    expect(huruf("calon WNA masih terikat perkawinan di negara asalnya")).toBe("B");
    expect(huruf("calon WNI belum cukup umur")).toBe("C");
    expect(huruf("calon WNA bukan beragama Islam sehingga berbeda agama")).toBe("D");
    expect(huruf("paspor calon WNA sudah habis masa berlakunya")).toBe("E");
    expect(huruf("paspor belum diperpanjang dan surat keterangan dari kedutaan belum ada")).toBe("");
    expect(huruf("alasan lain")).toBe("");
  });

  it("teks tak berkaitan tidak menghasilkan nilai apa pun dan nomor/tanggal tidak dikarang", () => {
    expect(deteksi.deteksi("")).toEqual({});
    expect(deteksi.deteksi("<p>Bahwa Pemohon dan Termohon menikah di Kantor Urusan Agama Kecamatan Sindue, Kabupaten Donggala dan dikaruniai 2 orang anak.</p>")).toEqual({});
    const p: Peta = deteksi.deteksi("<p>Bahwa Kantor Urusan Agama Kecamatan Banawa Kabupaten Donggala menolak memberikan surat keterangan syarat perkawinan karena paspor Pemohon II sudah habis masa berlakunya;</p>");
    expect(nilai(p, "3626")).toBe("Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan Banawa, Kabupaten Donggala");
    expect(p["0652"]).toBeUndefined();
    expect(p["0653"]).toBeUndefined();
    expect(nilai(p, "3631")).toBe("E");
  });

  it("tanpa kata aplikasi ini di berkas deteksi", () => {
    const isi = fs.readFileSync(path.join(REPO, "aleta_bot", "services", "deteksi", "perkawinanCampuran.js"), "utf-8");
    expect(isi.replace(/aleta_bot|ALETA_/g, "")).not.toMatch(/aleta/i);
  });
});

describe("modul python jenis_perkawinan_campuran", () => {
  let ringkas: {
    var: Array<{ no: number; nama: string; tipe: string; sql: string | null }>;
    isian: Record<string, string[]>;
    ramah: string[];
    peta: Array<{ berkas: string; status: string; keadaan: string; folder: string }>;
    galatRtf: string[];
    berkasPutusan: string[];
    berkasBas: string[];
    katalog: { kode: number; keluar: string };
  };

  beforeAll(() => {
    const keluar = py(`
import json, os, sys
sys.path.insert(0, '.')
import jenis_perkawinan_campuran as M, w3a_lib as L, variabel_def as VD, w3aA_susun as S
M.bangun()
M.bangun_katalog()
kode, ket = S.periksa_katalog('perkawinan-campuran.json')
j = M.J
put = sorted(os.listdir(L.lp(os.path.join(L.OUT, j['folder']))))
bas = sorted(os.listdir(L.lp(os.path.join(L.OUT, j['folder_bas']))))
galat = []
for sub, daftar in ((j['folder'], put), (j['folder_bas'], bas)):
    for f in daftar:
        for t in S.cek_rtf(os.path.join(L.OUT, sub, f), kata_boleh=('wali adhal', 'dispensasi', 'pencegahan')):
            galat.append(f[:50] + ': ' + t)
mine = [x for x in VD.VAR if 3620 <= x['no'] <= 3639]
print(json.dumps(dict(var=[dict(no=x['no'], nama=x['nama'], tipe=x['tipe'], sql=x['sql']) for x in mine], isian={k: list(v) for k, v in M.ISIAN.items()}, ramah=sorted(M.RAMAH),
    peta=[dict(berkas=p['berkas'], status=p['status'], keadaan=p['keadaan'], folder=p['folder']) for p in M.PETA], galatRtf=galat, berkasPutusan=put, berkasBas=bas,
    katalog=dict(kode=kode, keluar=ket)), ensure_ascii=False))
`);
    ringkas = JSON.parse(keluar.trim().split("\n").pop() as string);
  }, 240_000);

  it("membangun 10 putusan dan 12 BAS tanpa temuan pemeriksa isi", () => {
    expect(ringkas.berkasPutusan).toHaveLength(10);
    expect(ringkas.berkasBas).toHaveLength(12);
    expect(ringkas.galatRtf).toEqual([]);
  });

  it("PETA menunjuk berkas yang ada, status/keadaan unik, kode keadaan khusus jenis terdaftar", () => {
    const ada = new Set(ringkas.berkasPutusan);
    for (const p of ringkas.peta) expect(ada.has(p.berkas), p.berkas).toBe(true);
    expect(ringkas.peta).toHaveLength(ringkas.berkasPutusan.length);
    const kunci = ringkas.peta.map((p) => `${p.status}|${p.keadaan}`);
    expect(new Set(kunci).size).toBe(kunci.length);
    const khusus = new Set(ringkas.peta.map((p) => p.keadaan).filter((k) => !["", "sema-1-2022"].includes(k)));
    expect([...khusus].sort()).toEqual(["belum-ada-penolakan", "bukan-perkawinan-campuran", "calon-tidak-beragama-islam", "pejabat-tidak-hadir"]);
  });

  it("variabel baru: jatah 3620-3639, nama <= 200 huruf, SELECT saja, tanpa kata aplikasi ini; ISIAN dan RAMAH lengkap", () => {
    expect(ringkas.var.length).toBeGreaterThanOrEqual(18);
    for (const v of ringkas.var) {
      expect(v.no).toBeGreaterThanOrEqual(3620);
      expect(v.no).toBeLessThanOrEqual(3639);
      expect(v.nama.length).toBeLessThanOrEqual(200);
      expect(`${v.nama}${v.sql ?? ""}`).not.toMatch(/aleta/i);
      if (v.tipe === "data_sql") expect(String(v.sql).trim()).toMatch(/^SELECT\b/i);
    }
    const teks = ringkas.var.filter((v) => v.tipe !== "data_sql").map((v) => String(v.no));
    for (const k of teks) expect(Object.keys(ringkas.isian).includes(k) || ringkas.ramah.includes(k), k).toBe(true);
    for (const k of teks) expect(ringkas.ramah, `RAMAH ${k}`).toContain(k);
    for (const [k, v] of Object.entries(ringkas.isian)) {
      expect(["manual", "opsional"]).toContain(v[0]);
      expect(teks, `ISIAN ${k} harus data_teks`).toContain(k);
    }
    // sebuah kode tidak boleh di kedua daftar (di sini satu kamus; pemeriksaan silang dilakukan portal)
    expect(new Set(Object.keys(ringkas.isian)).size).toBe(Object.keys(ringkas.isian).length);
  });

  it("katalog saksi lolos mesin pemeriksa katalog tanpa galat dan memuat banyak butir", () => {
    expect(ringkas.katalog.kode, ringkas.katalog.keluar).toBe(0);
    expect(ringkas.katalog.keluar).toMatch(/galat 0/);
    const kat = JSON.parse(fs.readFileSync(path.join(REPO, "ekstensi-sipp", "saksi-katalog", "perkawinan-campuran.json"), "utf-8"));
    expect(kat.syarat.jenisPerkaraId).toEqual(["359"]);
    expect(kat.tanpaLawan).toBe(true);
    expect(Mesin.ringkasKatalog(kat).pertanyaan).toBeGreaterThanOrEqual(20);
    expect(JSON.stringify(kat)).not.toMatch(/aleta/i);
    // pertanyaan larangan A-H aktif tepat sesuai huruf yang dipilih, dan jawabannya mengikuti hasil (ada / tidak ada larangan)
    const aktif = (huruf: string) => (kat.pertanyaan as Array<{ id: string; keadaan?: { alasan?: string } }>).filter((q) => q.keadaan?.alasan === huruf).map((q) => q.id);
    for (const h of "ABCDEF") expect(aktif(h), h).toHaveLength(1);
    const q = (kat.pertanyaan as Array<{ id: string; jawaban: { melihat: Array<{ keadaan?: { hasil?: string } }> } }>).find((x) => x.id === "q-syarat-c")!;
    expect(q.jawaban.melihat.map((j) => j.keadaan?.hasil).sort()).toEqual(["syarat-terpenuhi", "syarat-tidak-terpenuhi"]);
    // BAS yang disebut katalog ada di folder BAS jenis
    const bas = new Set(ringkas.berkasBas.map((f) => f.replace(/\.rtf$/, "")));
    for (const b of kat.blangkoBas) expect(bas.has(b.berkas), b.berkas).toBe(true);
    expect(kat.blangkoBas.length).toBeGreaterThanOrEqual(4);
  });

  it("susun saksi: dua saksi pada satu butir tidak berbunyi sama, butir larangan mengikuti huruf dan hasil, penanda terisi dari variabel", () => {
    const kat = JSON.parse(fs.readFileSync(path.join(REPO, "ekstensi-sipp", "saksi-katalog", "perkawinan-campuran.json"), "utf-8"));
    const nilaiVar: Record<string, string> = { "0046": "Pemohon", "3622": "Rina Marlina binti Ahmad", "3623": "Ahmad Faiz bin Hassan", "3625": "Malaysia", "3626": "Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan Banawa, Kabupaten Donggala", "3627": "surat keterangan dari kedutaan belum diserahkan", "0653": "20 April 2026" };
    const susun = (keadaan: Record<string, string>, jenis = "melihat") =>
      Mesin.susunSaksi(kat, { benih: "1/Pdt.P/2026/PA.Dgl", keadaan, saksi: [{ pihak: "P", jenis }, { pihak: "P", jenis }], variabel: (k: string) => nilaiVar[k] });
    const r = susun({ alasan: "C", hasil: "syarat-terpenuhi" });
    expect(r.saksi).toHaveLength(2);
    const [s1, s2] = r.saksi as Array<{ baris: Array<{ butir: string; jawab: string; tanya: string; kosong: string[] }> }>;
    expect(s1.baris.length).toBeGreaterThanOrEqual(14);
    for (const b of s1.baris) {
      const b2 = s2.baris.find((x) => x.butir === b.butir)!;
      if (b.butir !== "q-penutup") expect(b2.jawab, b.butir).not.toBe(b.jawab);
    }
    // hanya butir larangan huruf B yang ikut; jawaban memakai nama calon dari variabel
    const ids = s1.baris.map((b) => b.butir);
    expect(ids).toContain("q-syarat-c");
    for (const h of "ABDEF") expect(ids).not.toContain(`q-syarat-${h.toLowerCase()}`);
    const gabung = s1.baris.map((b) => `${b.tanya} ${b.jawab}`).join(" ");
    expect(gabung).toContain("Rina Marlina binti Ahmad");
    expect(gabung).toContain("Kecamatan Banawa, Kabupaten Donggala");
    expect(gabung).not.toMatch(/#\d{4}#/);
    // hasil 'ada larangan' menghasilkan jawaban lain pada butir yang sama
    const ada = susun({ alasan: "C", hasil: "syarat-tidak-terpenuhi" }).saksi[0].baris.find((b: { butir: string }) => b.butir === "q-syarat-c");
    const tidak = r.saksi[0].baris.find((b: { butir: string }) => b.butir === "q-syarat-c");
    expect(ada.jawab).not.toBe(tidak.jawab);
    expect(ada.jawab).toMatch(/masih (?:kurang|di bawah)|di bawah|kurang dari/);
    // saksi tahu dari cerita orang lain atau ragu juga tersedia untuk butir pokok
    for (const jenis of ["de-auditu", "ragu", "tidak-tahu", "sebagian", "mendengar"]) {
      const x = susun({ alasan: "C", hasil: "syarat-terpenuhi" }, jenis);
      expect(x.saksi[0].baris.some((b: { jenis: string }) => b.jenis === jenis), jenis).toBe(true);
    }
  });
});
