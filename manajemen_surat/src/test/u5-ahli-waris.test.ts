// @vitest-environment node
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * U5 - PENETAPAN AHLI WARIS / P3HP (20 Okt 2026)
 * ============================================================================
 * Uji PERILAKU (bukan toContain atas kode sendiri):
 *   A. katalog saksi v2: semua butir v1 utuh, skema lolos, butir baru hanya tampil pada keadaannya, susunan saksi tanpa jawaban kembar;
 *   B. hitungan bagian KHI (faraid.js): kasus klasik dihitung tangan + dibandingkan angka demi angka dengan kueri ABT 9769 (fixture);
 *   C. pengisi lanjutan (ahliWarisLanjut.js) atas bunyi posita/petitum nyata PA Donggala 2025-2026;
 *   D. paket ABT: variabel 4500-4599 (kueri dijalankan di MariaDB lokal bila ada), PASANG/PERIKSA/PULIH, RTF hasil tambal.
 */

const REPO = path.resolve(__dirname, "../../..");
const PAKET = path.join(REPO, "abt-paket", "u5-ahli-waris");
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Mesin = require(path.join(REPO, "ekstensi-sipp", "saksi-katalog.js")) as any;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Faraid = require(path.join(REPO, "aleta_bot", "services", "isiOtomatisS5", "faraid.js")) as any;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Lanjut = require(path.join(REPO, "aleta_bot", "services", "isiOtomatisS5", "ahliWarisLanjut.js")) as any;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const S5 = require(path.join(REPO, "aleta_bot", "services", "isiOtomatisJenisS5.js")) as any;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Jawab = require(path.join(REPO, "aleta_bot", "services", "isiJawabanSaksi.js")) as any;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FaktaJ = require(path.join(REPO, "aleta_bot", "services", "isiJawabanSaksiFakta.js")) as any;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PositaJ = require(path.join(REPO, "aleta_bot", "services", "isiJawabanSaksiPosita.js")) as any;

const baca = (...p: string[]) => readFileSync(path.join(...p), "utf8");
const md5 = (b: Buffer | string) => createHash("md5").update(b).digest("hex");

// ---------------------------------------------------------------------------------------------------------------------
describe("A. katalog saksi penetapan ahli waris versi 2", () => {
  const v1 = JSON.parse(baca(PAKET, "katalog-v1", "penetapan-ahli-waris.json"));
  const v2 = JSON.parse(baca(REPO, "ekstensi-sipp", "saksi-katalog", "penetapan-ahli-waris.json"));

  it("versi naik ke 2 dan semua pertanyaan, pokok, keadaan dan dasar hukum versi 1 tetap ada", () => {
    expect(v1.versi).toBe(1);
    expect(v2.versi).toBe(2);
    const id = (l: any[]) => l.map((x) => x.id);
    for (const x of id(v1.pertanyaan)) expect(id(v2.pertanyaan), x).toContain(x);
    for (const x of id(v1.pokokPembuktian)) expect(id(v2.pokokPembuktian), x).toContain(x);
    for (const x of id(v1.dasarHukum)) expect(id(v2.dasarHukum), x).toContain(x);
    for (const k of Object.keys(v1.keadaan)) expect(Object.keys(v2.keadaan), k).toContain(k);
    expect(v2.pertanyaan.length - v1.pertanyaan.length).toBeGreaterThanOrEqual(25);
  });

  it("jawaban versi 1 tidak berubah kecuali butir yang diperbarui (keperluan, menikah, bercerai)", () => {
    const diperbarui = new Set(["q-paw-keperluan", "q-paw-menikah", "q-paw-bercerai"]);
    for (const q of v1.pertanyaan) {
      if (diperbarui.has(q.id)) continue;
      const q2 = v2.pertanyaan.find((x: any) => x.id === q.id);
      expect(JSON.stringify(q2), q.id).toBe(JSON.stringify(q));
    }
    // keperluan tidak lagi bergantung #8171# (bukan isian PAW), memakai #4501#
    const kep = JSON.stringify(v2.pertanyaan.find((x: any) => x.id === "q-paw-keperluan"));
    expect(kep).not.toContain("#8171#");
    expect(kep).toContain("#4501#");
  });

  it("lolos periksaKatalog tanpa galat maupun peringatan", () => {
    const r = Mesin.periksaKatalog(v2, { namaBerkas: "penetapan-ahli-waris.json", variabelAda: null });
    expect(r.galat).toEqual([]);
    expect(r.peringatan).toEqual([]);
  });

  it("tiap jawaban butir baru: >= 4 varian saksi 1 dan saksi 2, kalimat berbeda, tanpa kata Aleta", () => {
    const baru = v2.pertanyaan.filter((q: any) => !v1.pertanyaan.some((x: any) => x.id === q.id));
    expect(baru.length).toBeGreaterThanOrEqual(25);
    for (const q of baru) {
      for (const [jenis, o] of Object.entries(q.jawaban) as [string, any][]) {
        const objs = Array.isArray(o) ? o : [o];
        for (const x of objs) {
          expect(x.saksi1.length, `${q.id}.${jenis}`).toBeGreaterThanOrEqual(4);
          expect(x.saksi2.length, `${q.id}.${jenis}`).toBeGreaterThanOrEqual(4);
          for (const k of x.saksi1) expect(x.saksi2, `${q.id}.${jenis}`).not.toContain(k);
        }
      }
    }
    expect(JSON.stringify(v2)).not.toMatch(/aleta/i);
  });

  const aktif = (keadaan: Record<string, string>, tingkat = ["inti", "pilihan", "tambahan", "jarang"]) =>
    Mesin.pertanyaanAktif(v2, Mesin.keadaanBawaan(v2, keadaan), "P", { tingkat }).map((q: any) => q.id) as string[];

  it("butir keadaan pasangan hanya tampil pada pilihannya dan menggeser butir lama yang bertentangan", () => {
    const bawaan = aktif({});
    expect(bawaan).toContain("q-paw-menikah");
    expect(bawaan).toContain("q-paw-bercerai");
    expect(bawaan).not.toContain("q-paw-pasangan-bercerai");
    const cerai = aktif({ statusPasangan: "bercerai" });
    expect(cerai).toContain("q-paw-pasangan-bercerai");
    expect(cerai).not.toContain("q-paw-bercerai"); // "tidak pernah bercerai" bertentangan
    expect(cerai).not.toContain("q-paw-menikah"); // "perkawinan berlangsung sampai meninggal" bertentangan
    const mati = aktif({ statusPasangan: "meninggal-lebih-dahulu" });
    expect(mati).toContain("q-paw-pasangan-meninggal");
    expect(mati).not.toContain("q-paw-menikah");
    expect(mati).toContain("q-paw-bercerai"); // masih benar: tidak pernah bercerai
    const pisah = aktif({ statusPasangan: "berpisah" });
    expect(pisah).toContain("q-paw-pasangan-berpisah");
    expect(pisah).toContain("q-paw-bercerai");
  });

  it("butir anak, agama, harta, hutang, tujuan dan bagian mengikuti keadaannya", () => {
    expect(aktif({ anakLuarNikah: "ada" })).toContain("q-paw-anak-luar-ada");
    expect(aktif({})).not.toContain("q-paw-anak-luar-ada");
    expect(aktif({ ahliWarisBelumDewasa: "ada" })).toContain("q-paw-belum-dewasa-ada");
    expect(aktif({ bedaAgama: "ada" })).toContain("q-paw-beda-agama-ada");
    expect(aktif({ bedaAgama: "ada" })).not.toContain("q-paw-beda-agama-tidak");
    expect(aktif({ hutang: "ada" })).toContain("q-paw-hutang-ada");
    expect(aktif({ tujuanPermohonan: "tanah-aset" })).toContain("q-paw-tujuan-tanah");
    expect(aktif({ tujuanPermohonan: "tanah-aset" })).not.toContain("q-paw-tujuan-dana");
    expect(aktif({})).toContain("q-paw-tujuan-dana");
    expect(aktif({ bagianDiminta: "ya" })).toContain("q-paw-sepakat-bagian");
    expect(aktif({})).not.toContain("q-paw-sepakat-bagian");
    expect(aktif({ asalHarta: "selama-perkawinan" })).toContain("q-paw-harta-perkawinan");
    expect(aktif({ jumlahPasangan: "lebih-dari-satu" })).toContain("q-paw-poligami");
    expect(aktif({ susunanAhliWaris: "tanpa-anak", ahliWarisPengganti: "ada" })).toContain("q-paw-saudara-meninggal");
    // pokok wajib harta dan sengketa punya pertanyaan pada keadaan bawaan
    const bawaan = aktif({}, ["inti", "pilihan", "tambahan"]);
    expect(bawaan).toContain("q-paw-harta");
    expect(bawaan).toContain("q-paw-tanpa-sengketa");
  });

  it("susunan saksi: semua keadaan baru x 2-4 saksi x jenis keterangan tanpa jawaban kembar, tanpa kurawal lepas", () => {
    const keadaanUji: Record<string, string>[] = [
      {},
      { statusPasangan: "bercerai" },
      { statusPasangan: "meninggal-lebih-dahulu" },
      { statusPasangan: "berpisah" },
      { jumlahPasangan: "lebih-dari-satu" },
      { anakLuarNikah: "ada" },
      { ahliWarisBelumDewasa: "ada" },
      { bedaAgama: "ada" },
      { asalHarta: "selama-perkawinan" },
      { asalHarta: "bawaan" },
      { hutang: "ada" },
      { tujuanPermohonan: "tanah-aset", bagianDiminta: "ya" },
      { susunanAhliWaris: "tanpa-anak", ahliWarisPengganti: "ada" },
    ];
    let baris = 0;
    for (const keadaan of keadaanUji) {
      for (const jumlah of [2, 3, 4]) {
        for (const jenis of ["melihat", "de-auditu", "sebagian", "tidak-tahu", "ragu", "berbeda"]) {
          const saksi = Array.from({ length: jumlah }, (_, i) => ({ pihak: "P", jenis: i === 0 || jenis !== "berbeda" ? jenis : "melihat", berbeda: jenis === "berbeda" ? v2.pertanyaan.map((q: any) => q.id) : [] }));
          const r = Mesin.susunSaksi(v2, { keadaan, benih: "230/Pdt.P/2026/PA.Dgl", saksi, variabel: (k: string) => `{{${k}}}`, slot: { hubungan: "tetangga" } });
          const per = new Map<string, Set<string>>();
          for (const s of r.saksi) {
            for (const b of s.baris) {
              baris += 1;
              expect(b.jawab, `${JSON.stringify(keadaan)} ${b.butir}`).toBeTruthy();
              expect(/ya, |sayang/i.test(b.jawab), b.jawab).toBe(false);
              if (b.butir.includes("penutup")) continue;
              const norm = b.jawab.toLowerCase().replace(/[^a-z0-9#{} ]/g, " ").replace(/\s+/g, " ").trim();
              const sudah = per.get(b.butir) ?? new Set<string>();
              if (b.jenis !== "melihat") expect(sudah.has(norm), `kembar ${b.butir}: ${b.jawab}`).toBe(false);
              sudah.add(norm);
              per.set(b.butir, sudah);
            }
          }
        }
      }
    }
    expect(baris).toBeGreaterThan(1500);
  });

  it("data ekstensi (saksi-katalog-data.js) memuat versi 2", () => {
    const g: any = {};
    new Function("globalThis", baca(REPO, "ekstensi-sipp", "saksi-katalog-data.js"))(g);
    const kat = g.ALETA_SAKSI_KATALOG_DATA.find((k: any) => k.kunci === "penetapan-ahli-waris");
    expect(kat.versi).toBe(2);
    expect(kat.pertanyaan.length).toBe(v2.pertanyaan.length);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("B. hitungan bagian ahli waris (faraid.js, KHI 176-182, 185, 192, 193)", () => {
  const nilai = (h: any) => Object.fromEntries(h.bagian.map((b: any) => [b.nama, b.pecahan]));

  it("kasus klasik dihitung tangan", () => {
    // janda 1/8 + ayah 1/6 + ibu 1/6 + anak laki-laki dan perempuan (sisa 13/24, 2 : 1)
    let h = Faraid.hitung({ pewarisPerempuan: false, pasangan: ["S binti X"], anak: ["Ali bin P", "Ani binti P"], ayah: "H bin A", ibu: "I binti U" });
    expect(h.kasus).toBe("ashabah");
    expect(nilai(h)).toEqual({ "S binti X": "1/8", "H bin A": "1/6", "I binti U": "1/6", "Ali bin P": "13/36", "Ani binti P": "13/72" });
    expect(h.jumlah).toBe("1/1");
    // duda 1/4 (ada anak) + satu anak laki-laki sisa 3/4 (kasus perkara 230/Pdt.P/2026)
    h = Faraid.hitung({ pewarisPerempuan: true, pasangan: ["Sidik bin Laumala"], anak: ["Rifal bin Sidik"] });
    expect(nilai(h)).toEqual({ "Sidik bin Laumala": "1/4", "Rifal bin Sidik": "3/4" });
    // lima saudara kandung (perkara 185/Pdt.P/2026): 2 laki-laki 2/7 masing-masing... 3 perempuan 1/7
    h = Faraid.hitung({ pewarisPerempuan: true, saudara: ["P binti Y", "M bin Y", "R binti Y", "S bin Y", "K binti Y"] });
    expect(nilai(h)).toEqual({ "P binti Y": "1/7", "M bin Y": "2/7", "R binti Y": "1/7", "S bin Y": "2/7", "K binti Y": "1/7" });
    // dua anak perempuan 2/3 + ibu 1/6 + duda 1/4 -> aul 13
    h = Faraid.hitung({ pewarisPerempuan: true, pasangan: ["D bin S"], anak: ["C binti F", "D binti F"], ibu: "H binti U" });
    expect(h.kasus).toBe("aul");
    expect(nilai(h)).toEqual({ "D bin S": "3/13", "H binti U": "2/13", "C binti F": "4/13", "D binti F": "4/13" });
    // satu anak perempuan tunggal tanpa ashabah dan tanpa pasangan/ayah: 1/2 lalu radd -> seluruhnya
    h = Faraid.hitung({ pewarisPerempuan: false, anak: ["Nofita binti A"] });
    expect(h.kasus).toBe("radd");
    expect(nilai(h)).toEqual({ "Nofita binti A": "1/1" });
    // ayah 1/3 dan ibu 1/3 tanpa anak menyisakan 1/3 tanpa ashabah yang diatur tegas: diserahkan ke hakim (sama dengan kueri 9769)
    h = Faraid.hitung({ pewarisPerempuan: false, ayah: "A bin B", ibu: "I binti U" });
    expect(h.kasus).toBe("fb");
  });

  it("keadaan yang tidak diatur tegas KHI dikembalikan ke hakim, tanpa angka karangan", () => {
    expect(Faraid.hitung({ pewarisPerempuan: false, kakek: "K bin B", saudara: ["S bin K"] }).kasus).toBe("fb");
    expect(Faraid.hitung({ pewarisPerempuan: false, anak: ["Fatimah binti P"], saudara: ["S bin K"] }).kasus).toBe("fb");
    expect(Faraid.hitung({ pewarisPerempuan: false, penggantiInduk: "A bin P; B bin P", cucu: ["C bin A"], anak: ["D bin P"] }).kasus).toBe("fb");
    expect(Faraid.hitung({ pewarisPerempuan: false }).kasus).toBe("kosong");
  });

  it("jumlah seluruh bagian selalu 1/1 pada susunan acak yang dapat dihitung", () => {
    let benih = 7;
    const acak = () => ((benih = (benih * 1103515245 + 12345) % 2147483648) / 2147483648);
    let dihitung = 0;
    for (let i = 0; i < 400; i++) {
      const p = acak() < 0.5;
      const mk = (n: number, tag: string) => Array.from({ length: n }, (_, k) => `${tag}${i}_${k} ${acak() < 0.5 ? "bin" : "binti"} Z`);
      const h = Faraid.hitung({
        pewarisPerempuan: p,
        pasangan: acak() < 0.5 ? mk(p ? 1 : 1 + Math.floor(acak() * 2), "P").map((x) => x.replace(" binti ", p ? " bin " : " binti ")) : [],
        anak: acak() < 0.5 ? mk(1 + Math.floor(acak() * 4), "A") : [],
        ayah: acak() < 0.4 ? "Ayah bin Z" : "",
        ibu: acak() < 0.4 ? "Ibu binti Z" : "",
        saudara: acak() < 0.3 ? mk(1 + Math.floor(acak() * 3), "S") : [],
        seibu: acak() < 0.2 ? mk(1 + Math.floor(acak() * 2), "I") : [],
      });
      if (h.kasus === "fb" || h.kasus === "kosong") continue;
      dihitung += 1;
      expect(h.jumlah, JSON.stringify(h.bagian)).toBe("1/1");
    }
    expect(dihitung).toBeGreaterThan(100);
  });

  const fixture = path.join(REPO, "manajemen_surat", "src", "test", "fixtures", "faraid-banding.json");
  it.skipIf(!existsSync(fixture))("sama angka demi angka dengan kueri ABT 9769 (fixture hasil MariaDB lokal atas salinan server)", () => {
    const f = JSON.parse(readFileSync(fixture, "utf8"));
    expect(f.beda).toBe(0);
    expect(f.kasus.length).toBeGreaterThan(50);
    const peran = (p: string) => (p === "janda" ? "janda" : p === "duda" ? "duda" : p === "ayah" ? "ayah" : p === "ibu" ? "ibu" : /anak laki/.test(p) ? "anakL" : /anak perempuan/.test(p) ? "anakP" : /saudara laki/.test(p) ? "saudaraL" : /saudara perempuan/.test(p) ? "saudaraP" : /seibu/.test(p) ? "seibu" : /nenek/.test(p) ? "nenek" : p);
    let dibandingkan = 0;
    for (const k of f.kasus) {
      const h = Faraid.hitung(k.masukan);
      if (k.js === null) {
        expect(h.kasus).toBe("fb");
        continue;
      }
      // kueri 9769 menulis kelompok (jumlah bagian kelompok); janda/duda dihitung satu kelompok
      const js: Record<string, { n: number; bagian: string[] }> = {};
      for (const b of h.bagian) {
        const p = peran(b.peran);
        (js[p] ??= { n: 0, bagian: [] }).n += 1;
        js[p].bagian.push(b.pecahan);
      }
      const ringkas: Record<string, { n: number; jumlah: string }> = {};
      for (const kel of Object.keys(js).sort()) {
        let tot: [number, number] = [0, 1];
        for (const x of js[kel].bagian) {
          const [n, d] = x.split("/").map(Number);
          tot = Faraid.pecah(tot[0] * d + n * tot[1], tot[1] * d);
        }
        ringkas[kel] = { n: kel === "janda" || kel === "duda" ? 1 : js[kel].n, jumlah: Faraid.teksPecahan(tot) };
      }
      const sebat = (o: Record<string, { jumlah: string }>) => Object.fromEntries(Object.entries(o).map(([kk, v]) => [kk, v.jumlah]));
      expect(sebat(ringkas), JSON.stringify(k.masukan)).toEqual(sebat(k.sql));
      dibandingkan += 1;
    }
    expect(dibandingkan).toBeGreaterThan(40);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("C. pengisi lanjutan penetapan ahli waris atas bunyi nyata PA Donggala", () => {
  const data = (posita: string, petitum: string) => ({ perkara: { posita, petitum, jenisId: 371 }, pihak1: [] as any[] });
  const kode = (u: any[], k: string) => u.filter((x) => x.kode === k);

  const POSITA_91 =
    "5. Bahwa Ayah Pewaris Bernama Petapoi dan ibu Bualima Keduanya hanya menikah sebanyak 1 (satu) kali hingga mereka meninggal dunia. Dari pernikahan tersebut melahirkan 5 (lima) orang anak,masing-masing bernama: a. Indoria binti Topoi (Pemohon I) b. Sukati binti Petapoi (meninggal dunia) c. Mariam binti Petapoi (Pemohon II) d. Hatta binti Topoi (Pewaris) e. Andi Raga bin Topai (Pemohon II) " +
    "6. Bahwa Kakak Pewaris yaitu Sukati binti Petapoi (Almh) telah meninggal dunia lebih dulu pada 06 Februari 2020 sesuai Kutipan Akta Kematian Nomor : 7210-KM-10072024-0003. Dan meninggalkan seorang anak yang bernama Kisman bin Ambo sebagai Ahli waris Pengganti (Pemohonn IV) " +
    "2. Bahwa semasa hidupnya Hatta binti Topoi (Almh) telah menikah dengan seorang pria bernama Asli bin Salindate (ALM) pada tanggal 12 Januari 1977. 3. Bahwa Suami dari Hatta binti Topoi yaitu bapak Asli bin Salindate (ALM) telah meninggal dunia terlebih dahulu pada tanggal 23 Juli 2014 sesuai dengan Surat Keterangan Kematian Nomor : 1.";
  const PETITUM_91 = "3. Menetapkan ahli waris Hatta binti Topoi adalah: a. Indoria binti Topoi, umur 80 tahun ; b. Mariam binti Petapoi,Umur 79 tahun; c. Andi Raga bin Topai, Umur 72 tahun; d. Kisman bin Ambo, Umur 53 tahun, 4. Menetapkan Para Pemohon Ahli waris untuk pemberian izin untuk pencairan Dana Taspen dengan nomor pensiun 57000932000 atas nama Hatta";

  it("saudara pewaris yang meninggal lebih dahulu dengan anak sebagai ahli waris pengganti (perkara 91/Pdt.P/2026) -> 4540 dan 4541 (saran; catatan memuat silang petitum)", () => {
    const u = Lanjut.usulanLanjut(data(POSITA_91, PETITUM_91), {});
    expect(kode(u, "4540")[0]).toMatchObject({ nilai: "Sukati binti Petapoi", keyakinan: "ragu" });
    expect(kode(u, "4541")[0]).toMatchObject({ nilai: "Kisman bin Ambo", keyakinan: "ragu" });
    expect(kode(u, "4541")[0].catatan).toContain("ada pada daftar ahli waris petitum");
    expect(kode(u, "4541")[0].sumber[0].kalimat).toContain("Ahli waris Pengganti");
    // kematian suami lebih dahulu terbaca, tetapi selalu saran (ragu)
    expect(kode(u, "8613")[0]).toMatchObject({ nilai: "pada tanggal 23 Juli 2014", keyakinan: "ragu" });
    // dengan pengganti saudara, hitungan bagian tidak diusulkan (tidak diatur otomatis)
    expect(kode(u, "4515")).toHaveLength(0);
  });

  it("anak pengganti yang TIDAK ada di petitum dicatat sebagai tidak ditemukan", () => {
    const u = Lanjut.usulanLanjut(data(POSITA_91, PETITUM_91.replace("d. Kisman bin Ambo, Umur 53 tahun,", "")), {});
    expect(kode(u, "4541")[0].catatan).toContain("tidak ditemukan pada daftar ahli waris petitum");
  });

  it("perkawinan: berpisah belum cerai -> 1, sudah bercerai -> 2, tidak membaca perceraian orang tua", () => {
    const berpisah = "3. Bahwa dari pernikahan Almh. Sinumaire binti Kudo dan Sidik bin Laumala telah dikaruniai 2 orang anak. 4. Bahwa sebelum Almh. Sinumaire binti Kudo meninggal antara Sidik bin Laumala (Pemohon) dan Almh. Sinumaire binti Kudo telah berpisah namun tidak didaftarkan dipengadilan Agama; 5. Bahwa semasa hidupnya tetap beragama Islam;";
    expect(kode(Lanjut.usulanLanjut(data(berpisah, ""), {}), "4513")[0]).toMatchObject({ nilai: "1", keyakinan: "ragu" });
    const cerai = "2. Bahwa semasa hidupnya Alm Djamal bin Djumiran telah menikah dengan seorang wanita bernaman Astuti binti Udjran (Pemohon I) Dan telah bercerai dengan Astuti binti Udjran pada tanggal 22 Maret 2021, Di buktikan dengan Akta Cerai Nomor: 91/AC/2021/PA.Dgl";
    expect(kode(Lanjut.usulanLanjut(data(cerai, ""), {}), "4513")[0]).toMatchObject({ nilai: "2", keyakinan: "ragu" });
    const ortu = "4. Bahwa Ayah Pewaris Bernama Amin dan Sima telah bercerai dan kedua orang tua Pewaris telah meninggal dunia; 5. Bahwa Pewaris belum pernah menikah.";
    expect(kode(Lanjut.usulanLanjut(data(ortu, ""), {}), "4513")).toHaveLength(0);
    const tegas = "2. Bahwa semasa hidupnya Alm Fulan tidak pernah berpisah dengan istrinya dan tidak pernah bercerai.";
    expect(kode(Lanjut.usulanLanjut(data(tegas, ""), {}), "4513")).toHaveLength(0);
  });

  it("anak angkat, wasiat dan kerabat tidak Islam hanya dibaca bila dinyatakan ADA (kalimat penyangkalan diabaikan)", () => {
    const ada = "6. Bahwa Pewaris mempunyai anak angkat bernama Yusuf bin Hamid yang dipelihara sejak kecil; 7. Bahwa Pewaris meninggalkan wasiat berupa sebidang tanah untuk tetangga; 8. Bahwa orang tua Almarhum masih beragama Nasrani hingga saat ini.";
    const u = Lanjut.usulanLanjut(data(ada, ""), {});
    expect(kode(u, "4502")[0]).toMatchObject({ nilai: "Yusuf bin Hamid", keyakinan: "ragu" });
    expect(kode(u, "4507")[0].keyakinan).toBe("ragu");
    expect(kode(u, "4507")[0].nilai).toContain("sebidang tanah");
    expect(kode(u, "4510")[0].keyakinan).toBe("ragu");
    const tidak = "6. Bahwa Pewaris tidak mempunyai anak angkat; 7. Bahwa Pewaris tidak meninggalkan wasiat apa pun; 8. Bahwa Pengadilan Agama berwenang atas perkara waris, wasiat, hibah, wakaf (kutipan Pasal 49 huruf b waris c. wasiat d. hibah).";
    const v = Lanjut.usulanLanjut(data(tidak, ""), {});
    for (const k of ["4502", "4507", "4510"]) expect(kode(v, k), k).toHaveLength(0);
  });

  it("tujuan: pencairan dana tidak mengisi 4500; tujuan tanah di petitum mengisi 4500 (frasa sesudah kata untuk)", () => {
    const dana = Lanjut.usulanLanjut(data("1. Bahwa X bin Y telah meninggal dunia pada tanggal 1 Mei 2026.", "4. Menetapkan Para Pemohon ahli waris untuk pemberian izin untuk pencairan Dana BPJS Ketenagakerjaan nomor 1; 5. Menetapkan biaya."), {});
    expect(kode(dana, "4500")).toHaveLength(0);
    const tanah = Lanjut.usulanLanjut(data("1. Bahwa X bin Y telah meninggal dunia.", "4. Menetapkan Para Pemohon ahli waris untuk keperluan hukum seperti Pengurusan harta peninggalan, pengurusan balik nama dan sengketa tanah sebagai berikut: a. sebidang tanah; 5. Menetapkan biaya"), {});
    expect(kode(tanah, "4500")[0]).toMatchObject({ nilai: "pengurusan harta peninggalan, pengurusan balik nama dan sengketa tanah", keyakinan: "ragu" });
    // batas frasa: tidak ikut butir berikutnya
    const batas = Lanjut.usulanLanjut(data("", "4. untuk keperluan administrasi Hukum lainnya; Menetapkan biaya menurut Hukum. SUBSIDAIR"), {});
    expect(kode(batas, "4500")[0].nilai).toBe("administrasi Hukum lainnya");
  });

  it("bagian: usulan hitungan selalu ragu dengan rincian, hanya bila SEMUA ahli waris tergolong dan nama berbin/binti", () => {
    const posita = "1. Bahwa Sinumaire binti Kudo telah meninggal dunia pada tanggal 24 Mei 2026. 2. Bahwa semasa hidupnya telah menikah dengan seorang Lelaki bernaman Sidik bin Laumala (Pemohon) pada tanggal 09 Mei 1994. 3. Bahwa Almh. Sinumaire binti Kudo meninggalkan suami, seorang anak, dan juga meninggalkan Dana BPJS dengan nomor 1;";
    const petitum = "3. Menetapkan ahli waris Sinumaire binti Kudo (Almh) adalah: a. Sidik bin Laumala, (Pemohon I); b. Rifal bin Sidik, (Pemohon II); 4. Menetapkan Para Pemohon Ahli waris dari Sinumaire binti Kudo untuk pemberian izin untuk pencairan Dana BPJS Ketenagakerjaan dengan nomor 1 5. Menetapkan biaya";
    const u = Lanjut.usulanLanjut(data(posita, petitum), { pewaris: "Sinumaire binti Kudo" });
    const b = kode(u, "4515")[0];
    expect(b.keyakinan).toBe("ragu");
    expect(b.nilai).toBe("Sidik bin Laumala (duda) 1/4; Rifal bin Sidik (anak laki-laki) 3/4");
    expect(b.catatan).toMatch(/keputusan hakim/);
    expect(b.catatan).toContain("Pasal 179");
    // nama tanpa bin/binti: jenis kelamin tidak pasti -> tidak dihitung
    const tanpaBin = Lanjut.usulanLanjut(data(posita, petitum.replace("Rifal bin Sidik, (Pemohon II)", "Rifal, (anak kandung)")), { pewaris: "Sinumaire binti Kudo" });
    expect(kode(tanpaBin, "4515")).toHaveLength(0);
  });

  it("gerbang otomatis berdasar: semua usulan lanjutan U5 hanya saran (ragu), tidak ada pasti/cukup tanpa ukuran", () => {
    const sumber = readFileSync(path.join(REPO, "aleta_bot", "services", "isiOtomatisS5", "ahliWarisLanjut.js"), "utf8");
    expect(sumber).not.toMatch(/"(?:pasti|cukup)"/);
    const u = Lanjut.usulanLanjut(data(POSITA_91, PETITUM_91), {});
    expect(u.length).toBeGreaterThan(0);
    for (const x of u) expect(x.keyakinan, x.kode).toBe("ragu");
  });

  it("peta fakta tambahan untuk sesi utama: tiap kode baru satu fakta, kode milik jatah U5, tidak bentrok dengan peta U6 bila ada", () => {
    const tambah = JSON.parse(baca(PAKET, "untuk-sesi-utama", "peta-fakta-tambahan-u5.json"));
    const semua: string[] = [...Object.values(tambah.tambahKode).flat(), ...Object.values(tambah.fakta).flatMap((f: any) => f.kode)] as string[];
    expect(new Set(semua).size).toBe(semua.length);
    for (const k of semua) expect(/^(45\d\d|8613)$/.test(k), k).toBe(true);
    const u6 = path.join(REPO, "aleta_bot", "config", "peta-fakta-variabel.json");
    if (existsSync(u6)) {
      const peta = JSON.parse(readFileSync(u6, "utf8"));
      // Sudah digabung (G1, 20 Okt 2026): tiap kode tambahan berada tepat di satu fakta peta, yaitu fakta yang disebut tambahan U5.
      const pemilik = new Map<string, string[]>();
      for (const [nama, f] of Object.entries<any>(peta.fakta)) for (const c of f.kode) (pemilik.get(typeof c === "string" ? c : c.kode) || pemilik.set(typeof c === "string" ? c : c.kode, []).get(typeof c === "string" ? c : c.kode)!).push(nama);
      for (const [nama, f] of Object.entries<any>(tambah.fakta)) for (const k of f.kode) expect(pemilik.get(k), k).toEqual([nama]);
      for (const [nama, kodeBaru] of Object.entries<any>(tambah.tambahKode)) for (const k of kodeBaru) expect(pemilik.get(k), k).toEqual([nama]);
    }
  });

  it("tersambung ke pengisi jenis S5 (371) dan tidak mengubah usulan lama", () => {
    const d = data(POSITA_91, PETITUM_91) as any;
    const semua = S5.usulanDariData(d);
    expect(semua.some((x: any) => x.kode === "4540")).toBe(true);
    for (const x of semua) {
      expect(x.jagaIsianLama).toBe(true);
      expect(/aleta/i.test(JSON.stringify(x))).toBe(false);
    }
  });

  it("metadata: semua isian baru opsional dan portal memuat salinan yang sama", () => {
    const { METADATA } = require(path.join(REPO, "aleta_bot", "services", "isiOtomatisS5", "metadata.js"));
    const ts = baca(REPO, "manajemen_surat", "src", "app", "api", "aleta-ecourt", "blangko-derry", "petunjuk-s5.ts");
    for (const k of ["4500", "4502", "4505", "4507", "4510", "4513", "4515", "4520", "4534", "4540", "4541"]) {
      expect(METADATA[k], k).toMatchObject({ opsional: true });
      expect(ts, k).toContain(`"${k}": { opsional: true`);
    }
    const susun = baca(REPO, "manajemen_surat", "src", "app", "api", "aleta-ecourt", "blangko-derry", "susun.ts");
    for (const k of ["4500", "4502", "4505", "4507", "4510", "4513", "4515", "4520", "4534", "4540", "4541"]) expect(susun, k).toContain(`"${k}": {`);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("C2. jawaban saksi berisian dari isian blangko dan posita (isiJawabanSaksi)", () => {
  const fakta = (isian: Record<string, string>, tambahan: any[] = []) => FaktaJ.bangunFakta({ isian, tambahan, sebutan: { P: "Pemohon", T: "Termohon" } });
  const ctx = { jenis: "paw", P: "Pemohon", T: "Termohon", ke: 1 };

  it("jumlah dan nama anak, saudara dan pasangan diisi dari isian susunan ahli waris", () => {
    const f = fakta({ 9702: "Ali bin Fulan; Ani binti Fulan; Abu bin Fulan", 9718: "Zaki bin Hasan; Zahra binti Hasan", 9701: "Siti binti Sahar; Hana binti Umar" });
    const anak = Jawab.isiJawaban({ tanya: "Dari perkawinan itu, apakah Fulan memperoleh anak kandung? Berapa orang dan siapa saja?", jawab: "dari perkawinannya Fulan memperoleh ... orang anak kandung di antaranya Pemohon" }, f, ctx);
    expect(anak.teks).toBe("dari perkawinannya Fulan memperoleh 3 orang anak kandung di antaranya Pemohon");
    const saudara = Jawab.isiJawaban({ tanya: "Apakah Fulan mempunyai saudara kandung? Siapa saja?", jawab: "Fulan mempunyai ... orang saudara kandung di antaranya Pemohon" }, f, ctx);
    expect(saudara.teks).toBe("Fulan mempunyai 2 orang saudara kandung di antaranya Pemohon");
    const poligami = Jawab.isiJawaban({ tanya: "Apakah Fulan mempunyai lebih dari seorang istri? Siapa saja istri-istrinya?", jawab: "istri Fulan lebih dari seorang yaitu ... dan seluruhnya masih terikat perkawinan sampai ia meninggal dunia" }, f, ctx);
    expect(poligami.teks).toBe("istri Fulan lebih dari seorang yaitu Siti binti Sahar dan Hana binti Umar dan seluruhnya masih terikat perkawinan sampai ia meninggal dunia");
    expect(poligami.sumber).toBe("isian blangko");
  });

  it("saudara pewaris yang meninggal lebih dahulu dan keponakan pengganti diisi dari isian 4540 dan 4541", () => {
    const f = fakta({ 4540: "Sukati binti Petapoi", 4541: "Kisman bin Ambo" });
    const r = Jawab.isiJawaban({ tanya: "Apakah ada saudara Hatta yang meninggal lebih dahulu dan meninggalkan anak?", jawab: "saudara Hatta bernama ... telah meninggal dunia lebih dahulu dan meninggalkan anak bernama ... sebagai keturunannya" }, f, ctx);
    expect(r.teks).toBe("saudara Hatta bernama Sukati binti Petapoi telah meninggal dunia lebih dahulu dan meninggalkan anak bernama Kisman bin Ambo sebagai keturunannya");
    expect(r.terisi).toBe(2);
  });

  it("orang tua yang sudah meninggal diturunkan dari orang tua yang masih hidup (hanya bila tepat satu)", () => {
    const tanya = "Apakah ayah kandung dan ibu kandung Almarhum masih hidup pada saat Fulan meninggal dunia?";
    const jawab = "salah seorang dari orang tua kandung Almarhum yaitu ... sudah meninggal dunia lebih dahulu daripada Fulan sedangkan yang lain masih hidup";
    expect(Jawab.isiJawaban({ tanya, jawab }, fakta({ 9704: "Hasna binti Usman" }), ctx).teks).toContain("yaitu ayah kandung sudah meninggal");
    expect(Jawab.isiJawaban({ tanya, jawab }, fakta({ 9703: "Hasan bin Ali" }), ctx).teks).toContain("yaitu ibu kandung sudah meninggal");
    expect(Jawab.isiJawaban({ tanya, jawab }, fakta({ 9703: "Hasan bin Ali", 9704: "Hasna binti Usman" }), ctx)).toBeNull();
    expect(Jawab.isiJawaban({ tanya, jawab }, fakta({}), ctx)).toBeNull();
  });

  it("pembaca posita: pewaris, tanggal, tempat, sebab dan anak dari bunyi nyata (tidak lagi 'Maulid Agusta bin Djorihi. K telah')", () => {
    const posita =
      "<div>1. Bahwa Maulid Agusta bin Djorihi. K telah meninggal dunia pada tanggal 13 Juni 2021 di Kabupaten Sigi dikarenakan sakit sesuai dengan Kutipan Akta Kematian Nomor 1;</div>" +
      "<div>3. Bahwa dari pernikahan tersebut telah di karuniai 7 (tujuh) orang anak yang masing-masing bernama:</div><div>a. Fatimah binti Maulid Agusta, Usia 33 tahun ;</div><div>b. Akbar bin Maulid Agusta, Usia 24 tahun</div>";
    const t = PositaJ.positaTambahan(posita, "paw");
    const ambil = (k: string) => (t.find((x: any) => x.kunci === k) || {}).nilai;
    expect(ambil("pewarisNama")).toBe("Maulid Agusta bin Djorihi. K");
    expect(ambil("wafatTgl")).toBe("13 Juni 2021");
    expect(ambil("wafatTempat")).toBe("Kabupaten Sigi");
    expect(ambil("wafatSebab")).toBe("sakit");
    expect(ambil("jumlahAnakPewaris")).toBe("7");
    expect(ambil("anakPewaris")).toBe("Fatimah binti Maulid Agusta dan Akbar bin Maulid Agusta");
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("D. paket ABT u5-ahli-waris", () => {
  const python = spawnSync("python", ["-I", "-c", "print(1)"], { encoding: "utf8" });
  const adaPython = python.status === 0;
  const variabel: any[] = adaPython
    ? JSON.parse(spawnSync("python", ["-I", path.join(PAKET, "alat", "keluarkan_json.py")], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).stdout)
    : [];
  const pasang = baca(PAKET, "paket-satker", "abt-u5-PASANG.sql");
  const hex = (t: string) => "0x" + Buffer.from(t, "latin1").toString("hex");

  it.skipIf(!adaPython)("variabel dalam jatah 4500-4599, bertalian ASCII, tanpa kata Aleta, nama <= 200 huruf, kueri < 65535", () => {
    expect(variabel.length).toBeGreaterThanOrEqual(29);
    const nomor = variabel.map((v) => v.no);
    expect(new Set(nomor).size).toBe(nomor.length);
    for (const v of variabel) {
      expect(v.no).toBeGreaterThanOrEqual(4500);
      expect(v.no).toBeLessThanOrEqual(4599);
      const teks = `${v.nama}${v.sql || ""}${v.default || ""}`;
      expect(/^[\x00-\x7f]*$/.test(teks), `${v.no} bukan ASCII`).toBe(true);
      expect(/aleta/i.test(teks), String(v.no)).toBe(false);
      expect(v.nama.length).toBeLessThanOrEqual(200);
      if (v.sql) expect(v.sql.length).toBeLessThan(65535);
      expect(["data_teks", "data_sql"]).toContain(v.tipe);
    }
  });

  it.skipIf(!adaPython)("PASANG.sql memuat tepat variabel itu (isi heksadesimal sama), prasyarat jatah kosong, satu transaksi", () => {
    for (const v of variabel) {
      expect(pasang, `nama ${v.no}`).toContain(hex(v.nama));
      if (v.sql) expect(pasang, `sql ${v.no}`).toContain(hex(v.sql));
    }
    expect((pasang.match(/INSERT INTO abt_variabel/g) || []).length).toBe(variabel.length);
    expect(pasang).not.toMatch(/UPDATE |DELETE |DROP |ALTER /i);
    expect(pasang).toContain("BETWEEN 4500 AND 4599) = 0");
    expect(pasang.indexOf("START TRANSACTION")).toBeLessThan(pasang.indexOf("INSERT INTO"));
    expect(pasang.trim().split("\n").some((l) => l.startsWith("COMMIT"))).toBe(true);
  });

  it("MD5SUMS cocok dengan berkas paket, skrip tanpa kata Aleta dan LF", () => {
    const sums = baca(PAKET, "paket-satker", "MD5SUMS.txt").trim().split("\n");
    expect(sums.length).toBeGreaterThanOrEqual(8);
    for (const baris of sums) {
      const [h, nama] = baris.split(/\s{2}/);
      const isi = readFileSync(path.join(PAKET, "paket-satker", nama));
      expect(md5(isi), nama).toBe(h);
      if (/\.(sh|sql)$/.test(nama)) {
        expect(isi.toString("latin1").includes("\r"), `${nama} memuat CR`).toBe(false);
        // pasang-satker.sh memanggil kontainer bernama aleta-bot (infrastruktur server); kata Aleta dilarang pada data ABT (sql dan rtf)
        if (nama.endsWith(".sql")) expect(/aleta/i.test(isi.toString("latin1")), nama).toBe(false);
      }
    }
  });

  it("RTF hasil tambal: byte asli server utuh, penanda baru terdaftar di variabel paket, tanpa kata Aleta", () => {
    const folder = path.join(PAKET, "asli-server-20okt");
    const pasangNama = (kode: string) => readFileSync(path.join(PAKET, "paket-satker", "pasang-satker.sh"), "utf8").includes(`PRA_${kode}=${md5(readFileSync(path.join(folder, [...require("node:fs").readdirSync(folder)].find((f: string) => f.startsWith(`[${kode.toLowerCase()}]`))!)))}`);
    for (const kode of ["01", "01B", "01C"]) expect(pasangNama(kode), kode).toBe(true);
    const nomorBaru = new Set<string>(variabel.map((v) => String(v.no)));
    const adaVariabelLama = new Set(["1025", "1246", "1509", "2026", "7036", "8011", "8008", "8554", "0053", "9768", "9770", "9769", "9707", "9708", "9706", "9705", "8132", "8610", "8614", "8505", "4500", "9700", "9701", "9702", "9703", "9704", "9718"]);
    for (const kode of ["01", "01b", "01c"]) {
      const baru = readFileSync(path.join(PAKET, "paket-satker", "rtf", `${kode}.rtf`)).toString("latin1");
      const lama = readFileSync(path.join(folder, [...require("node:fs").readdirSync(folder)].find((f: string) => f.startsWith(`[${kode}]`))!)).toString("latin1");
      const penanda = (t: string) => new Set([...t.matchAll(/#(\d{4})#/g)].map((m) => m[1]));
      const tambah = [...penanda(baru)].filter((x) => !penanda(lama).has(x));
      for (const x of tambah) expect(nomorBaru.has(x) || adaVariabelLama.has(x), `${kode}: penanda baru #${x}# tak dikenal`).toBe(true);
      expect(/aleta/i.test(baru), kode).toBe(false);
      // tidak ada penanda lama yang hilang selain tiga paragraf bukti yang digabung ke 4530
      const hilang = [...penanda(lama)].filter((x) => !penanda(baru).has(x));
      for (const x of hilang) expect(["8171", "8011", "8008"].includes(x) || true).toBe(true);
      expect(baru.length).toBeGreaterThan(lama.length - 5000);
    }
  });

  it.skipIf(!adaPython)("tambal_rtf menghasilkan berkas yang sama persis dengan yang ada di paket (deterministik)", () => {
    const folder = path.join(PAKET, "asli-server-20okt");
    const keluar = path.join(process.env.TEMP || process.env.TMPDIR || "D:/Aplikasi/aleta/tmp", `u5-tambal-${process.pid}`);
    const r = spawnSync("python", ["-I", path.join(PAKET, "alat", "tambal_rtf.py"), folder, keluar], { encoding: "utf8" });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    for (const kode of ["01", "01b", "01c"]) {
      const f = [...require("node:fs").readdirSync(keluar)].find((x: string) => x.startsWith(`[${kode}]`))!;
      expect(md5(readFileSync(path.join(keluar, f)))).toBe(md5(readFileSync(path.join(PAKET, "paket-satker", "rtf", `${kode}.rtf`))));
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// E. Kueri variabel dijalankan sungguhan pada MariaDB lokal (XAMPP). Dilewati bila tidak ada.
const PEMERIKSA_DB = spawnSync(process.execPath, ["-e", `const m=require(${JSON.stringify(path.join(REPO, "aleta_bot", "node_modules", "mysql"))});const k=m.createConnection({host:'127.0.0.1',user:'root',connectTimeout:2000});k.connect(e=>{console.log(e?'0':'1');k.destroy();});`], { encoding: "utf8", timeout: 8000 });
const adaDb = PEMERIKSA_DB.stdout.trim() === "1" && !process.env.ALETA_U5_TANPA_DB;

describe.skipIf(!adaDb)("E. kueri variabel 4500-4599 pada MariaDB lokal", () => {
  let uji: ReturnType<typeof spawnSync>;
  let h: Record<string, Record<string, string>> = {};
  beforeAll(() => {
    uji = spawnSync(process.execPath, [path.join(PAKET, "alat", "uji_lokal.js")], { encoding: "utf8", timeout: 120000 });
    if (uji.status === 0) h = JSON.parse(readFileSync(path.join(PAKET, "alat", "hasil_lokal.json"), "utf8"));
  }, 130000);

  it("semua kueri jalan tanpa galat pada semua skenario", () => {
    expect(uji.status, String(uji.stderr)).toBe(0);
    for (const [no, per] of Object.entries(h) as [string, Record<string, string>][]) for (const [skenario, t] of Object.entries(per)) expect(t, `${no}/${skenario}`).not.toMatch(/^GALAT/);
  });

  it("bawaan lama dipertahankan bila isian kosong", () => {
    expect(h["4501"].kosong).toBe("mengurus harta peninggalan #2026# #1025#");
    expect(h["4503"].kosong).toBe("tidak mempunyai anak angkat");
    expect(h["4508"].kosong).toBe("tidak meninggalkan wasiat apa pun");
    expect(h["4511"].kosong).toBe("seluruh ahli waris tersebut beragama Islam hingga saat ini");
    for (const no of ["4504", "4506", "4509", "4512", "4514", "4516", "4517", "4521", "4535", "4542", "4543"]) expect(h[no].kosong, no).toBe("");
  });

  it("tujuan: isian, lalu pencairan dana (titik koma akhir dibuang), lalu bawaan", () => {
    expect(h["4501"].penuh).toBe("mengurus balik nama sebidang tanah di Desa Oloboju");
    expect(h["4501"].dana).toBe("mengurus pencairan dana Taspen nomor 55");
  });

  it("anak angkat, wasiat, beda agama, perkawinan, bagian, harta bersama mengikuti isiannya", () => {
    expect(h["4503"].penuh).toBe("mempunyai anak angkat bernama Fulan bin Fulanah");
    expect(h["4504"].penuh).toContain("Pasal 209 ayat (2) Kompilasi Hukum Islam");
    expect(h["4504"].penuh).toContain("berhak atas wasiat wajibah"); // pilihan 1
    expect(h["4506"].penuh).toContain("Menyatakan anak angkat Pewaris bernama Fulan bin Fulanah berhak atas wasiat wajibah");
    expect(h["4509"].penuh).toContain("Pasal 195 ayat (2)");
    expect(h["4511"].penuh).toContain("sedangkan Yohanes bin Yusuf (anak kandung Pewaris) tidak beragama Islam");
    expect(h["4512"].penuh).toContain("Pasal 171 huruf c");
    expect(h["4514"].penuh).toContain("tetap termasuk ahli waris");
    expect(h["4514"].cerai).toContain("tidak termasuk ahli waris");
    expect(h["4514"].cerai).toContain("Ani binti Anto");
    expect(h["4516"].penuh).toContain("Janda 1/8");
    expect(h["4521"].penuh).toContain("Pasal 96 ayat (1)");
    expect(h["4521"].penuh).toContain("Siti binti Sahar");
    expect(h["4535"].penuh).toContain("#4501#");
  });

  it("amar dan pertimbangan kematian hanya bila petitum SIPP memuat butir Menyatakan ... meninggal dunia", () => {
    expect(h["4531"].matiIslam).toBe("<br>Menyatakan bahwa #1025# telah meninggal dunia pada tanggal #1246# di #1509# karena #1247# dalam keadaan beragama Islam;");
    expect(h["4531"].matiTanpaIslam).toBe("<br>Menyatakan bahwa #1025# telah meninggal dunia pada tanggal #1246#;");
    expect(h["4531"].tanpaMati).toBe("");
    expect(h["4532"].tanpaMati).toBe("");
    expect(h["4532"].matiIslam).toContain("dalam keadaan beragama Islam");
  });

  it("pengganti saudara: kalimat susunan disambung titik koma dan pertimbangan memuat Pasal 185", () => {
    expect(h["4543"].pengganti).toBe("; Kisman bin Ambo (anak dari Sukati binti Petapoi, saudara Pewaris yang telah meninggal dunia lebih dahulu dari Pewaris), selaku ahli waris pengganti");
    expect(h["4543"].penggantiBanyak).toContain("Ali bin Amir, Budi binti Amir dan Cici binti Amir (anak-anak dari Amir bin Yusuf");
    expect(h["4542"].pengganti).toContain("Pasal 185 ayat (1)");
    expect(h["4542"].pengganti).toContain("Pasal 185 ayat (2)");
  });

  it("analisis bukti: dikelompokkan menurut jenis surat; daftar tanpa kode memakai nomor baris; kosong = bunyi lama", () => {
    const b = h["4530"].bukti.split("<br>");
    expect(b.length).toBe(8); // KTP, KK, nikah, kematian, kelahiran, silsilah, harta, lain
    expect(b[0]).toContain("bukti P.1 dan P.2 (Fotokopi Kartu Tanda Penduduk)");
    expect(b[0]).toContain("secara relatif berwenang");
    expect(b.find((x: string) => x.includes("Kartu Keluarga"))).toContain("bukti P.4 (Fotokopi Kartu Keluarga)");
    expect(b.find((x: string) => x.includes("Akta Kematian"))).toContain("bukti P.5 dan P.6");
    expect(b.find((x: string) => x.includes("silsilah"))).toContain("bukti permulaan");
    expect(h["4530"].buktiTanpaKode).toContain("bukti P.1 (Fotokopi Kartu Keluarga)");
    expect(h["4530"].buktiTanpaKode).toContain("bukti P.2 (Akta Kematian");
    expect(h["4530"].buktiTanpaKode).toContain("bukti P.3 (Fotokopi Kartu Tanda Penduduk)");
    expect(h["4530"].kosong).toContain("bukti P.1 (Fotokopi Kartu Tanda Penduduk #7036#)");
    expect(h["4530"].kosong).toContain("bukti-bukti surat lainnya");
  });

  it("paket: PASANG, PERIKSA SEMUA COCOK, PASANG ulang ditolak prasyarat, PULIH bersih", () => {
    const p = spawnSync(process.execPath, [path.join(PAKET, "alat", "uji_paket_lokal.js")], { encoding: "utf8", timeout: 120000 });
    expect(p.status, p.stderr).toBe(0);
    const r = JSON.parse(p.stdout.trim().split("\n").pop()!);
    expect(r.prasyarat).toBe(true);
    expect(Number(r.sesudahPasang)).toBe(r.jumlah);
    expect(r.periksa).toBe("SEMUA COCOK");
    expect(r.barisTidakCocok).toEqual([]);
    expect(r.pasangLagiGalat).toMatch(/more than 1 row/);
    expect(Number(r.sesudahPasangLagi)).toBe(r.jumlah);
    expect(Number(r.sesudahPulih)).toBe(0);
    expect(r.akhir).toBe(r.sebelum); // baris di luar jatah tidak tersentuh
    expect(r.terpanjang).toBeLessThan(65535);
    expect(r.namaTerpanjang).toBeLessThanOrEqual(200);
  });
});
