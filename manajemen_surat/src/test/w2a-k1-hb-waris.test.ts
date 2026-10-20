// @vitest-environment node
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * W2a-K1 - KATALOG SAKSI HARTA BERSAMA (348) DAN KEWARISAN (364) VERSI 2, PENDETEKSI GUGATAN
 * ============================================================================
 * Uji PERILAKU (bukan toContain atas kode sendiri):
 *   A. katalog v2: semua butir/pokok/keadaan/dasar hukum v1 tetap, skema lolos (mesin + pemeriksa kerja), butir baru hanya tampil
 *      pada keadaannya, profil pengetahuan saksi bekerja, susunan 2-5 saksi tanpa jawaban kembar, saksi Tergugat memakai butir penggantinya
 *   B. pendeteksi gugatan (isiJawabanSaksiKebendaan.js + penyambung di isiJawabanSaksiPositaLain.js) atas bunyi gugatan PA Donggala/Bungku
 *      yang dinamai ulang: nilai bertingkat yakin hanya yang sudah diukur, selebihnya saran (ragu)
 *   C. catatan ukur atas perkara nyata tersimpan dan konsisten dengan yang dijanjikan
 */

const REPO = path.resolve(__dirname, "../../..");
const PAKET = path.join(REPO, "abt-paket", "w2a-kebendaan");
const FOLDER = path.join(REPO, "ekstensi-sipp", "saksi-katalog");
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Mesin = require(path.join(REPO, "ekstensi-sipp", "saksi-katalog.js")) as any;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const K = require(path.join(REPO, "aleta_bot", "services", "isiJawabanSaksiKebendaan.js")) as any;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Posita = require(path.join(REPO, "aleta_bot", "services", "isiJawabanSaksiPosita.js")) as any;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Variabel = require(path.join(REPO, "aleta_bot", "services", "isiJawabanSaksiVariabel.js")) as any;

const baca = (...p: string[]) => readFileSync(path.join(...p), "utf8");
const muat = (d: string, n: string) => JSON.parse(baca(d, `${n}.json`));

const KUNCI = ["harta-bersama", "harta-bersama-tergugat", "kewarisan", "kewarisan-tergugat"] as const;
const KAMUS = process.env.ALETA_ABT_VARIABEL || "D:/Aplikasi/aleta/tmp/abt-variabel.json";
const variabelAda: Set<string> | null = existsSync(KAMUS) ? new Set(Object.keys(JSON.parse(baca(KAMUS)))) : null;

const katalogSemua: any[] = require("node:fs")
  .readdirSync(FOLDER)
  .filter((n: string) => n.endsWith(".json"))
  .sort()
  .map((n: string) => JSON.parse(baca(FOLDER, n)))
  .filter((k: any) => !k.contoh);
const PAKET_HB = Mesin.kenaliPaket(katalogSemua, { jenisPerkaraId: "348", alurPerkaraId: "15" });
const PAKET_WR = Mesin.kenaliPaket(katalogSemua, { jenisPerkaraId: "364", alurPerkaraId: "15" });

const JENIS = ["melihat", "mendengar", "de-auditu", "sebagian", "tidak-tahu", "ragu"];

// ---------------------------------------------------------------------------------------------------------------------
describe.each([
  ["harta bersama", "harta-bersama", 70, ["q-kenal-pihak", "q-pernikahan"]],
  ["kewarisan", "kewarisan", 70, ["q-kenal-pewaris", "q-pewaris-meninggal"]],
] as const)("A. katalog %s versi 2", (_nama, kunci, minimal) => {
  const v1 = muat(path.join(PAKET, "katalog-v1"), kunci);
  const v2 = muat(FOLDER, kunci);
  const id = (l: any[]) => l.map((x) => x.id);

  it("versi naik ke 2; semua pertanyaan, pokok, keadaan dan dasar hukum versi 1 tetap ada dan butir lama tidak berubah", () => {
    expect(v1.versi).toBe(1);
    expect(v2.versi).toBe(2);
    for (const x of id(v1.pokokPembuktian)) expect(id(v2.pokokPembuktian), x).toContain(x);
    for (const x of id(v1.dasarHukum)) expect(id(v2.dasarHukum), x).toContain(x);
    for (const k of Object.keys(v1.keadaan)) expect(Object.keys(v2.keadaan), k).toContain(k);
    for (const q of v1.pertanyaan) {
      const q2 = v2.pertanyaan.find((x: any) => x.id === q.id);
      expect(q2, q.id).toBeTruthy();
      expect(JSON.stringify(q2), `butir lama ${q.id} tidak boleh berubah`).toBe(JSON.stringify(q));
    }
    // nilai keadaan lama tetap; hanya bertambah
    for (const [k, d] of Object.entries(v1.keadaan) as [string, any][]) for (const n of d.nilai ?? []) expect(v2.keadaan[k].nilai, `${k}:${n}`).toContain(n);
    // dasar hukum pokok lama hanya bertambah
    for (const p of v1.pokokPembuktian) expect(v2.pokokPembuktian.find((x: any) => x.id === p.id).dasarHukum).toEqual(expect.arrayContaining(p.dasarHukum));
  });

  it(`jumlah pertanyaan naik dari ${v1.pertanyaan.length} ke sedikitnya ${minimal}; keadaan dan profil bertambah`, () => {
    expect(v2.pertanyaan.length).toBeGreaterThanOrEqual(minimal);
    expect(Object.keys(v2.keadaan).length).toBeGreaterThanOrEqual(Object.keys(v1.keadaan).length + 8);
    expect(Object.keys(v2.profilSaksi ?? {}).length).toBeGreaterThanOrEqual(8);
    expect(v2.pokokPembuktian.length).toBeGreaterThan(v1.pokokPembuktian.length);
  });

  it("lolos periksaKatalog tanpa galat maupun peringatan, dengan dan tanpa kamus variabel ABT", () => {
    for (const ada of [null, variabelAda]) {
      const r = Mesin.periksaKatalog(v2, { namaBerkas: `${kunci}.json`, variabelAda: ada });
      expect(r.galat, JSON.stringify(r.galat.slice(0, 3))).toEqual([]);
      expect(r.peringatan, JSON.stringify(r.peringatan.slice(0, 3))).toEqual([]);
    }
  });

  it("lolos pemeriksa kerja SAKSI-A (periksa.mjs) bila tersedia di mesin ini", () => {
    const periksa = "D:/aleta-dev/kerja/saksi/periksa.mjs";
    if (!existsSync(periksa)) return;
    const r = spawnSync("node", [periksa, path.join(FOLDER, `${kunci}.json`)], { encoding: "utf8" });
    expect(`${r.stdout}${r.stderr}`).toContain("LOLOS");
  });

  it("butir baru: >= 4 varian saksi 1 dan saksi 2, kalimat berbeda, ada jawaban 'berbeda', tanpa kata Aleta, tanpa 'ya, ' dan 'sayang'", () => {
    const baru = v2.pertanyaan.filter((q: any) => !v1.pertanyaan.some((x: any) => x.id === q.id));
    expect(baru.length).toBeGreaterThanOrEqual(minimal - v1.pertanyaan.length);
    for (const q of baru) {
      expect(q.jawaban.berbeda, q.id).toBeTruthy();
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
    const kalimat: string[] = [];
    // aturan 'ya, ' dan 'sayang' berlaku untuk JAWABAN (ABT mengubah keterangan saksi); pertanyaan butir lama tidak disentuh
    for (const q of v2.pertanyaan) {
      for (const o of Object.values(q.jawaban) as any[]) for (const x of Array.isArray(o) ? o : [o]) kalimat.push(...x.saksi1, ...x.saksi2);
    }
    expect(kalimat.join("\n")).not.toMatch(/ya, |sayang/i);
  });

  it("rujukan hukum berstatus perlu-verifikasi tidak tercetak di teks pertanyaan atau jawaban", () => {
    const belum = v2.dasarHukum.filter((d: any) => d.status === "perlu-verifikasi");
    expect(belum.length).toBeGreaterThan(0);
    const teks: string[] = [];
    for (const q of v2.pertanyaan) {
      teks.push(q.teks, ...(q.teksVarian ?? []));
      for (const o of Object.values(q.jawaban) as any[]) for (const x of Array.isArray(o) ? o : [o]) teks.push(...x.saksi1, ...x.saksi2);
    }
    const gabung = teks.join("\n").toLowerCase();
    for (const d of belum) expect(gabung.includes(String(d.rujukan).toLowerCase()), d.rujukan).toBe(false);
    expect(gabung).not.toMatch(/\bpasal\s+\d/);
  });

  it("tiap profil pengetahuan saksi menghasilkan jenis keterangan yang dijanjikan dan tidak pernah jawaban kosong", () => {
    const paket = kunci === "harta-bersama" ? PAKET_HB : PAKET_WR;
    for (const kp of Object.keys(v2.profilSaksi)) {
      const hasil = Mesin.susunSaksi(paket, { keadaan: Mesin.keadaanBawaan(paket, {}), benih: "9/Pdt.G/2026/PA.Dgl", saksi: [{ pihak: "P", jenis: `profil:${kp}`, sumber: "tetangga" }, { pihak: "P", jenis: `profil:${kp}`, sumber: "tetangga" }], variabel: (k: string) => `{{${k}}}`, slot: { hubungan: "tetangga", sumber: "tetangga" } });
      expect(hasil.saksi.length, kp).toBe(2);
      const jenisDipakai = new Set<string>();
      for (const s of hasil.saksi) for (const b of s.baris) {
        expect(b.jawab, `${kp} ${b.butir}`).toBeTruthy();
        jenisDipakai.add(b.jenis);
      }
      if (kp === "sama") expect([...jenisDipakai]).toEqual(["melihat"]);
      if (kp === "ragu") expect(jenisDipakai.has("ragu")).toBe(true);
      if (kp === "dari-cerita") expect(jenisDipakai.has("de-auditu")).toBe(true);
      if (kp === "mendengar-sendiri") expect(jenisDipakai.has("mendengar")).toBe(true);
      if (/tidak-tahu/.test(kp) || kp.startsWith("hanya-tahu") || kp.startsWith("kenal-") || kp.startsWith("tahu-ahli-waris-saja") || kp.startsWith("tahu-peran")) expect(jenisDipakai.has("tidak-tahu"), kp).toBe(true);
      if (kp === "tahu-sebagian" || kp === "tahu-sebagian-objek") expect(jenisDipakai.has("sebagian"), kp).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("A2. butir baru hanya tampil pada keadaannya", () => {
  const aktif = (paket: any, keadaan: Record<string, unknown>, pihak: string | null = "P", tingkat = ["inti", "pilihan", "tambahan", "jarang"]) =>
    Mesin.pertanyaanAktif(paket, Mesin.keadaanBawaan(paket, { kehadiran: "kontradiktoir", ...keadaan }), pihak, { tingkat }).map((q: any) => q.id) as string[];

  it("harta bersama: jenis objek, sumber dana, penguasa, poligami, sita, pembagian, perjanjian, agunan, hasil, kesepakatan, rekonvensi", () => {
    const dasar = aktif(PAKET_HB, {});
    expect(dasar).toContain("q-akta-cerai-bht");
    expect(dasar).not.toContain("q-kematian-pihak-waktu");
    expect(dasar).not.toContain("q-poligami-istri-lain");
    expect(dasar).not.toContain("q-piutang-bersama");
    expect(aktif(PAKET_HB, { jenisObjek: ["piutang"] })).toContain("q-piutang-bersama");
    expect(aktif(PAKET_HB, { jenisObjek: ["kebun-ternak"] })).toContain("q-kebun-ternak");
    expect(aktif(PAKET_HB, { jenisObjek: ["investasi"] })).toContain("q-investasi-titipan-modal");
    expect(aktif(PAKET_HB, { jenisObjek: ["asuransi-pensiun"] })).toContain("q-asuransi-pensiun");
    expect(aktif(PAKET_HB, { sumberDana: ["kredit-bank"] })).toContain("q-dana-kredit");
    expect(dasar).not.toContain("q-dana-kredit");
    expect(aktif(PAKET_HB, { pihakMeninggal: "lawan" })).toContain("q-kematian-pihak-waktu");
    expect(aktif(PAKET_HB, { pihakMeninggal: "lawan" })).not.toContain("q-akta-cerai-bht");
    expect(aktif(PAKET_HB, { poligami: "ya" })).toContain("q-poligami-istri-lain");
    expect(aktif(PAKET_HB, { perjanjianKawin: "ada" })).toContain("q-perjanjian-kawin-isi");
    expect(aktif(PAKET_HB, { agunan: "ada" })).toContain("q-dijaminkan-bank");
    expect(aktif(PAKET_HB, { hasilObjek: "ada" })).toContain("q-hasil-objek-dinikmati");
    expect(aktif(PAKET_HB, { kesepakatan: "ada" })).toContain("q-kesepakatan-pembagian");
    expect(aktif(PAKET_HB, { sita: "ada" })).toEqual(expect.arrayContaining(["q-sita-alasan", "q-sita-letak-keadaan", "q-sita-pihak-ketiga", "q-sita-nilai-seimbang"]));
    expect(dasar).not.toContain("q-sita-alasan");
    expect(aktif(PAKET_HB, { penguasa: "pengaju" })).toContain("q-penguasa-pengaju");
    expect(aktif(PAKET_HB, { penguasa: "pihak-ketiga" })).toContain("q-pihak-ketiga");
    expect(aktif(PAKET_HB, { pembagianDiminta: "tidak-sama" })).toContain("q-kontribusi-tak-seimbang");
    expect(dasar).not.toContain("q-kontribusi-tak-seimbang");
    expect(aktif(PAKET_HB, { kumulasi: ["rekonvensi"] })).toEqual(expect.arrayContaining(["q-rekon-objek-lain", "q-rekon-penguasa"]));
    expect(aktif(PAKET_HB, { statusTanah: "belum-bersertifikat", jenisObjek: ["tanah-bangunan"] })).toContain("q-tanah-belum-sertifikat");
    expect(aktif(PAKET_HB, { statusTanah: "belum-bersertifikat", jenisObjek: ["tanah-bangunan"] })).not.toContain("q-status-surat-tanah");
  });

  it("harta bersama: bantahan tambahan menampilkan butir sanggahan arah Penggugat dan tidak untuk verstek", () => {
    expect(aktif(PAKET_HB, { bantahan: ["sudah-dibagi"] })).toContain("q-sanggah-sudah-dibagi");
    expect(aktif(PAKET_HB, { bantahan: ["pisah-harta"] })).toContain("q-sanggah-pisah-harta");
    expect(aktif(PAKET_HB, { bantahan: ["utang-bersama"] })).toContain("q-sanggah-utang");
    expect(aktif(PAKET_HB, { bantahan: ["nilai-berbeda"] })).toContain("q-sanggah-nilai-bagian");
    expect(aktif(PAKET_HB, { bantahan: ["sebelum-menikah"] })).toContain("q-milik-sebelum-nikah");
    expect(aktif(PAKET_HB, { kehadiran: "verstek", bantahan: ["sudah-dibagi"] })).not.toContain("q-sanggah-sudah-dibagi");
  });

  it("kewarisan: pasangan, anak, orang tua, harta, penguasa, hutang, wasiat, hibah, sita, kesepakatan hanya pada pilihannya", () => {
    const dasar = aktif(PAKET_WR, {});
    expect(dasar).toContain("q-w-pasangan-hidup");
    expect(dasar).not.toContain("q-w-pasangan-bercerai");
    expect(aktif(PAKET_WR, { statusPasangan: "bercerai" })).toContain("q-w-pasangan-bercerai");
    expect(aktif(PAKET_WR, { statusPasangan: "bercerai" })).not.toContain("q-w-pasangan-hidup");
    expect(aktif(PAKET_WR, { statusPasangan: "meninggal-lebih-dahulu" })).toContain("q-w-pasangan-meninggal");
    expect(aktif(PAKET_WR, { statusPasangan: "berpisah" })).toContain("q-w-pasangan-berpisah");
    expect(aktif(PAKET_WR, { statusPewaris: "tidak-menikah" })).not.toContain("q-w-pasangan-hidup");
    expect(aktif(PAKET_WR, { jumlahPasangan: "lebih-dari-satu" })).toContain("q-w-poligami-pewaris");
    expect(aktif(PAKET_WR, { anakLuarNikah: "ada" })).toContain("q-w-anak-luar-nikah");
    expect(aktif(PAKET_WR, { anakAngkat: "ada" })).toContain("q-w-anak-angkat");
    expect(aktif(PAKET_WR, { bedaAgama: "ada" })).toContain("q-w-beda-agama");
    expect(aktif(PAKET_WR, { terhalang: "ada" })).toContain("q-w-terhalang-pembunuhan");
    expect(aktif(PAKET_WR, { ahliWarisBelumDewasa: "ada" })).toContain("q-w-anak-belum-dewasa");
    expect(aktif(PAKET_WR, { orangTua: "masih-hidup" })).toContain("q-w-orang-tua-hidup");
    expect(aktif(PAKET_WR, { orangTua: "masih-hidup" })).not.toContain("q-w-orang-tua-meninggal");
    expect(aktif(PAKET_WR, { ahliWaris: ["saudara"] })).toContain("q-w-saudara-rinci");
    expect(aktif(PAKET_WR, { ahliWaris: ["cucu-pengganti"] })).toContain("q-w-cucu-pengganti-rinci");
    expect(aktif(PAKET_WR, { asalHarta: "bersama-pasangan" })).toContain("q-w-harta-bersama-dipisah");
    expect(dasar).not.toContain("q-w-harta-bersama-dipisah");
    expect(aktif(PAKET_WR, { jenisHarta: ["kendaraan"] })).toContain("q-w-kendaraan-peninggalan");
    expect(aktif(PAKET_WR, { penguasa: "pihak-ketiga" })).toContain("q-w-penguasa-pihak-ketiga");
    expect(aktif(PAKET_WR, { hutang: "ada" })).toContain("q-w-hutang-rinci");
    expect(aktif(PAKET_WR, { wasiat: "ada" })).toEqual(expect.arrayContaining(["q-w-wasiat-isi", "q-w-wasiat-sepertiga"]));
    expect(aktif(PAKET_WR, { hibahSemasaHidup: "ada" })).toEqual(expect.arrayContaining(["q-w-hibah-semasa-hidup", "q-w-hibah-diperhitungkan"]));
    expect(aktif(PAKET_WR, { sita: "ada" })).toEqual(expect.arrayContaining(["q-w-sita-alasan", "q-w-sita-letak-keadaan"]));
    expect(aktif(PAKET_WR, { kesepakatan: "ada" })).toContain("q-w-kesepakatan-bagian");
    expect(aktif(PAKET_WR, { bantahan: ["ahli-waris-lain"] })).toContain("q-w-sanggah-ahli-waris-lain");
    // pokok wajib tetap punya pertanyaan pada keadaan bawaan
    const bawaan = aktif(PAKET_WR, {}, "P", ["inti", "pilihan", "tambahan"]);
    for (const p of PAKET_WR.pokokPembuktian.filter((x: any) => x.wajib)) {
      const ada = PAKET_WR.pertanyaan.some((q: any) => q.pokok === p.id && bawaan.includes(q.id));
      expect(ada, p.id).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("A3. susunan 2-5 saksi: tanpa jawaban kembar, tanpa kurawal lepas, semua keadaan baru", () => {
  const KEADAAN_HB: Record<string, unknown>[] = [
    {},
    { jenisObjek: ["tanah-bangunan", "kendaraan", "usaha", "rekening-uang", "perhiasan-perabot", "utang", "piutang", "asuransi-pensiun", "kebun-ternak", "investasi"], sumberDana: ["gaji-bersama", "usaha-bersama", "kredit-bank", "bantuan-keluarga", "jual-harta-lain"], statusTanah: "belum-bersertifikat" },
    { poligami: "ya", pihakMeninggal: "pengaju", perjanjianKawin: "ada", agunan: "ada", hasilObjek: "ada", taksiran: "ada", kesepakatan: "ada", sita: "ada", penguasa: "pihak-ketiga", pembagianDiminta: "tidak-sama", kumulasi: ["rekonvensi"] },
    { bantahan: ["bawaan-hibah-warisan", "sebelum-menikah", "sudah-dijual-dijaminkan", "milik-pihak-ketiga", "sudah-dibagi", "sudah-dihibahkan", "utang-bersama", "pisah-harta", "nilai-berbeda", "bagian-tidak-sama"], penguasa: "pengaju" },
    { kehadiran: "verstek", penguasa: "bersama" },
  ];
  const KEADAAN_WR: Record<string, unknown>[] = [
    {},
    { statusPasangan: "bercerai", jumlahPasangan: "lebih-dari-satu", anakLuarNikah: "ada", anakAngkat: "ada", bedaAgama: "ada", terhalang: "ada", ahliWarisBelumDewasa: "ada", ahliWarisBukanPihak: "ada" },
    { statusPasangan: "meninggal-lebih-dahulu", orangTua: "masih-hidup", ahliWaris: ["anak", "orang-tua", "saudara", "cucu-pengganti", "ahli-waris-gaib", "hubungan-khusus"], jenisHarta: ["tanah-bangunan", "kebun-sawah", "kendaraan", "uang-simpanan", "usaha", "perhiasan-perabot"], asalHarta: "bersama-pasangan" },
    { statusPasangan: "berpisah", asalHarta: "warisan-leluhur", penguasa: "lawan", hutang: "ada", wasiat: "ada", hibahSemasaHidup: "ada", kesepakatan: "ada", suratWaris: "ada", sita: "ada" },
    { asalHarta: "pribadi", penguasa: "pengaju", bantahan: ["bukan-harta-pewaris", "sudah-dibagi-atau-dihibahkan", "bukan-ahli-waris", "ahli-waris-lain", "utang-pewaris"] },
  ];

  it.each([
    ["harta bersama", () => PAKET_HB, KEADAAN_HB],
    ["kewarisan", () => PAKET_WR, KEADAAN_WR],
  ] as const)("%s", (_nama, ambil, daftarKeadaan) => {
    const paket = ambil();
    let baris = 0;
    for (const keadaan of daftarKeadaan) {
      for (const jumlah of [2, 3, 5]) {
        for (const jenis of [...JENIS, "berbeda", "profil:dari-cerita"]) {
          const saksi = Array.from({ length: jumlah }, (_, i) => ({ pihak: "P", sumber: "tetangga", jenis: i === 0 || jenis !== "berbeda" ? jenis : "melihat", berbeda: jenis === "berbeda" ? paket.pertanyaan.map((q: any) => q.id) : [] }));
          const r = Mesin.susunSaksi(paket, { keadaan: { kehadiran: "kontradiktoir", ...keadaan }, benih: "230/Pdt.G/2026/PA.Dgl", saksi, variabel: (k: string) => `{{${k}}}`, slot: { hubungan: "tetangga", sumber: "tetangga" } });
          const per = new Map<string, Set<string>>();
          for (const s of r.saksi) {
            for (const b of s.baris) {
              baris += 1;
              expect(b.jawab, `${JSON.stringify(keadaan)} ${b.butir}`).toBeTruthy();
              expect(/ya, |sayang/i.test(b.jawab), b.jawab).toBe(false);
              expect(/[{}]/.test(b.jawab.replace(/\{\{\d{4}\}\}/g, "")), b.jawab).toBe(false);
              if (b.butir.includes("penutup")) continue;
              const norm = b.jawab.toLowerCase().replace(/[^a-z0-9#{} ]/g, " ").replace(/\s+/g, " ").trim();
              const sudah = per.get(b.butir) ?? new Set<string>();
              if (b.jenis !== "melihat" || jenis === "melihat") expect(sudah.has(norm), `kembar ${b.butir}: ${b.jawab}`).toBe(false);
              sudah.add(norm);
              per.set(b.butir, sudah);
            }
          }
        }
      }
    }
    expect(baris).toBeGreaterThan(2500);
  }, 120000);
});

// ---------------------------------------------------------------------------------------------------------------------
describe("A4. saksi yang diajukan Tergugat memakai butir pengganti baru; saksi Penggugat tidak berubah", () => {
  const susun = (paket: any, saksi: any[], keadaan: Record<string, unknown>) =>
    Mesin.susunSaksi(paket, { keadaan: { kehadiran: "kontradiktoir", ...keadaan }, benih: "7/Pdt.G/2026/PA.Dgl", saksi, variabel: (k: string) => `{{${k}}}` });
  const ids = (h: any, i: number) => h.saksi[i].baris.map((b: any) => b.butir) as string[];
  const P = { pihak: "P" };
  const T = { pihak: "T" };

  it("harta bersama: tiap bantahan baru memunculkan butir Tergugat dan menggantikan butir arah Penggugat hanya untuk saksi Tergugat", () => {
    const pasangan: [string, string, string[]][] = [
      ["bawaan-hibah-warisan", "q-tg-hibah-warisan", ["q-hibah-warisan-diterima", "q-masih-ada-bawaan"]],
      ["sebelum-menikah", "q-tg-milik-sebelum-nikah", ["q-milik-sebelum-nikah"]],
      ["sudah-dihibahkan", "q-tg-sudah-dihibahkan", ["q-dihibahkan-pihak-ketiga"]],
      ["pisah-harta", "q-tg-pisah-harta-dicatat", ["q-perjanjian-kawin-dicatat"]],
      ["utang-bersama", "q-tg-utang-pelunasan", ["q-utang-pelunasan"]],
      ["bagian-tidak-sama", "q-tg-kontribusi-tergugat", ["q-urus-rumah-tangga"]],
      ["nilai-berbeda", "q-tg-nilai-lebih-rendah", ["q-nilai-total-harta"]],
      ["penguasaan-dibantah", "q-tg-penguasa-penggugat", ["q-penguasa-lawan-menolak"]],
      ["pernah-ditawari-bagian", "q-tg-pernah-ditawari-bagian", ["q-penguasaan-sejak-pisah"]],
    ];
    for (const [bantahan, butirT, digantikan] of pasangan) {
      const keadaan = { bantahan: [bantahan], jenisObjek: ["tanah-bangunan"], penguasa: "lawan", pembagianDiminta: "tidak-sama", perjanjianKawin: "ada" };
      const h = susun(PAKET_HB, [P, T], keadaan);
      expect(ids(h, 1), `${bantahan} saksi T`).toContain(butirT);
      expect(ids(h, 0), `${bantahan} saksi P`).not.toContain(butirT);
      for (const g of digantikan) {
        expect(ids(h, 1), `${bantahan}: ${g} tidak ditanyakan kepada saksi T`).not.toContain(g);
      }
      const tanpa = susun(PAKET_HB, [P, T], { ...keadaan, bantahan: [] });
      expect(ids(tanpa, 1), `${bantahan} tanpa bantahan`).not.toContain(butirT);
    }
  });

  it("kewarisan: tiap bantahan baru memunculkan butir Tergugat", () => {
    const pasangan: [string, string][] = [
      ["ada-wasiat", "q-tg-wasiat"],
      ["hibah-semasa-hidup", "q-tg-hibah-semasa-hidup"],
      ["harta-bersama-pasangan", "q-tg-harta-bersama-pasangan"],
      ["dijual-semasa-pewaris", "q-tg-dijual-semasa-hidup"],
      ["biaya-pengurusan", "q-tg-biaya-pengurusan"],
      ["penguasaan-sah", "q-tg-penguasaan-sah"],
      ["ahli-waris-terhalang", "q-tg-ahli-waris-terhalang"],
      ["pernah-ditawari-bagian", "q-tg-pernah-ditawari-bagian"],
      ["bukan-ahli-waris", "q-tg-nasab-anak"],
    ];
    for (const [bantahan, butirT] of pasangan) {
      const h = susun(PAKET_WR, [P, T], { bantahan: [bantahan], ahliWaris: ["anak"], penguasa: "lawan", asalHarta: "bersama-pasangan", wasiat: "ada", hibahSemasaHidup: "ada", terhalang: "ada", bedaAgama: "ada" });
      expect(ids(h, 1), bantahan).toContain(butirT);
      expect(ids(h, 0), bantahan).not.toContain(butirT);
    }
  });

  it("paket gabungan: id dan urutan tidak bentrok, butir yang digantikan ada, skema lolos", () => {
    for (const paket of [PAKET_HB, PAKET_WR]) {
      const idq = paket.pertanyaan.map((q: any) => q.id);
      expect(new Set(idq).size).toBe(idq.length);
      const ur = paket.pertanyaan.map((q: any) => q.urutan);
      expect(new Set(ur).size).toBe(ur.length);
      for (const q of paket.pertanyaan) for (const g of q.menggantikan ?? []) expect(idq, `${q.id} menggantikan ${g}`).toContain(g);
      const r = Mesin.periksaKatalog(paket, { namaBerkas: `${paket.kunci}.json`, variabelAda });
      expect(r.galat, JSON.stringify(r.galat.slice(0, 3))).toEqual([]);
    }
    expect(PAKET_HB.pertanyaan.length).toBeGreaterThanOrEqual(120);
    expect(PAKET_WR.pertanyaan.length).toBeGreaterThanOrEqual(105);
  });

  it("data ekstensi (saksi-katalog-data.js) memuat versi 2 keempat katalog", () => {
    const g: any = {};
    new Function("globalThis", baca(REPO, "ekstensi-sipp", "saksi-katalog-data.js"))(g);
    for (const kunci of KUNCI) {
      const kat = g.ALETA_SAKSI_KATALOG_DATA.find((k: any) => k.kunci === kunci);
      expect(kat.versi, kunci).toBe(2);
      expect(kat.pertanyaan.length, kunci).toBe(muat(FOLDER, kunci).pertanyaan.length);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("B. pendeteksi gugatan harta bersama atas bunyi nyata (nama dan nomor diganti)", () => {
  const POSITA_HB = [
    "Bahwa pada tanggal 14 bulan September tahun 2003 Penggugat dan Tergugat telah melangsungkan perkawinan yang sah di Kantor Urusan Agama Kecamatan Fulan sebagaimana termuat dalam kutipan akta nikah Nomor 173/9/IX/2003",
    "perkawinan antara Penggugat dan Tergugat telah putus karena perceraian berdasarkan putusan Pengadilan Agama Donggala No. 126 tanggal 28 April 2020 dengan amar putusan sebagai berikut:",
    "atas putusan tersebut Penggugat dan Tergugat tidak mengajukan upaya hukum dan telah dikeluarkan akta cerai Nomor: 126/AC/2020/PA.Dgl.",
    "Penggugat dan Tergugat selama perkawinan memperoleh harta bersama berupa:",
    "Sebidang tanah dan bangunan rumah yang ditinggali Penggugat bersama anak-anak dengan SHM No. 014 atas nama Tergugat, dikuasai oleh Tergugat",
    "Satu unit mobil Avanza tipe E warna Silver, dalam penguasaan Penggugat",
    "Satu unit sepeda motor Honda Beat tahun 2019 yang berada di tangan Tergugat",
    "nilai total keseluruhan harta bersama adalah Rp. 520.000.000,- (lima ratus dua puluh juta rupiah)",
    "oleh karena rumah tangga mereka telah bubar, Penggugat berhak atas seperdua dari harta bersama tersebut",
  ].join("\n");
  const PETITUM_HB = [
    "Menyatakan menurut hukum bahwa harta bersama Penggugat dan Tergugat berupa:",
    "a. Satu buah rumah tinggal yang terletak di BTN Fulan Blok P5 No.11, Kecamatan Marawola;",
    "b.Satu unit sepeda motor roda dua merk Yamaha Bison warna putih;",
    "adalah sah dan berharga sebagai harta bersama;",
    "Menetapkan seluruh harta bersama dibagi separuh/setengah bagian;",
    "Meletakkan sita jaminan terhadap objek sengketa;",
  ].join("\n");

  const butir = Posita.butirPosita(POSITA_HB);
  const kunci = (hasil: any[], k: string) => hasil.find((x: any) => x.kunci === k);

  it("tanggal nikah, putusan cerai dan akta cerai terbaca persis seperti yang tertulis (tingkat cukup: diperiksa atas 35 gugatan nyata)", () => {
    const f = K.hartaBersamaLanjut(butir, PETITUM_HB);
    expect(kunci(f, "tglNikah")).toMatchObject({ nilai: "14 September 2003", yakin: "cukup" });
    expect(kunci(f, "putusanCerai")).toMatchObject({ nilai: "Nomor 126 tanggal 28 April 2020", yakin: "cukup" });
    expect(kunci(f, "aktaCerai")).toMatchObject({ nilai: "Nomor 126/AC/2020/PA.Dgl", yakin: "cukup" });
  });

  it("tanggal nikah ditulis SEBELUM kata pernikahan, dan 'Ter' sisa kata Tertanggal dibuang dari nomor putusan", () => {
    const f = K.hartaBersamaLanjut(Posita.butirPosita("pada tanggal 15 desember 1990 penggugat dan tergugat melangsungkan pernikahan yang dicatat oleh pegawai pencatat nikah\nPenggugat dan Tergugat bercerai berdasarkan putusan Pengadilan Agama Donggala Nomor : 0221/AC/2016/PA/DglTertanggal 9 Juni 2016"), "");
    expect(kunci(f, "tglNikah")).toMatchObject({ nilai: "15 Desember 1990" });
    expect(kunci(f, "putusanCerai").nilai).toBe("Nomor 0221/AC/2016/PA/Dgl tanggal 9 Juni 2016");
  });

  it("tanggal perceraian tidak pernah dibaca sebagai tanggal nikah", () => {
    const f = K.hartaBersamaLanjut(Posita.butirPosita("perkawinan Penggugat dan Tergugat telah putus karena perceraian berdasarkan putusan Nomor 1 tanggal 28 April 2020 dan akta cerai terbit"), "");
    expect(kunci(f, "tglNikah")).toBeUndefined();
  });

  it("daftar objek dari petitum (lebih bersih) dengan jumlahnya; selalu 'ragu'", () => {
    const f = K.hartaBersamaLanjut(butir, PETITUM_HB);
    const h = kunci(f, "hartaPeninggalan");
    expect(h.yakin).toBe("ragu");
    expect(h.nilai).toContain("rumah tinggal");
    expect(h.nilai).toContain("sepeda motor");
    expect(kunci(f, "jumlahObjek").nilai).toBe("2");
    expect(kunci(f, "nilaiTotalHarta").nilai).toBe("Rp 520.000.000");
  });

  it("saran keadaan: jenis objek, penguasa campur, pembagian seperdua; sita hanya DIMINTA bukan 'ada'; semuanya ragu", () => {
    const s = K.saranKeadaan("hb", butir, PETITUM_HB);
    expect(kunci(s, "jenisObjek").nilai).toEqual(expect.arrayContaining(["tanah-bangunan", "kendaraan"]));
    expect(kunci(s, "penguasa").nilai).toBe("campur");
    expect(kunci(s, "pembagianDiminta").nilai).toBe("seperdua");
    expect(kunci(s, "sita")).toBeUndefined();
    expect(kunci(s, "sitaDiminta").nilai).toBe("ya");
    expect(kunci(s, "statusTanah").nilai).toBe("bersertifikat");
    for (const x of s) expect(x.yakin, x.kunci).toBe("ragu");
  });

  it("sita yang sudah diletakkan (penetapan sita) menjadi saran sita=ada, tetap ragu", () => {
    const s = K.saranKeadaan("hb", Posita.butirPosita("Pengadilan telah menjatuhkan penetapan sita jaminan atas objek perkara ini"), "");
    expect(kunci(s, "sita")).toMatchObject({ nilai: "ada", yakin: "ragu" });
    expect(kunci(s, "sitaDiminta")).toBeUndefined();
  });

  it("kata 'rumah tangga' bukan tanah dan bangunan; tanpa daftar objek di petitum jenis objek tidak ditebak dari kalimat lain", () => {
    const s = K.saranKeadaan("hb", Posita.butirPosita("Penggugat dan Tergugat membina rumah tangga yang bahagia selama beberapa tahun lalu berpisah"), "Menyatakan harta yang diperoleh selama perkawinan adalah harta bersama;");
    expect(kunci(s, "jenisObjek")).toBeUndefined();
  });

  it("agunan, hasil sewa, taksiran dan kredit dari kalimat gugatan; kalimat penyangkalan diabaikan", () => {
    const ada = K.saranKeadaan("hb", Posita.butirPosita("Sertifikat aslinya masih menjadi agunan kredit Bank Fulan\nRumah kos itu disewakan dengan uang sewa Rp 1.000.000 per bulan\nrumah itu saat ini memiliki nilai pasar sekitar Rp. 200.000.000,-"), "");
    expect(kunci(ada, "agunan")).toBeTruthy();
    expect(kunci(ada, "hasilObjek")).toBeTruthy();
    expect(kunci(ada, "taksiran")).toBeTruthy();
    expect(kunci(ada, "sumberDana").nilai).toEqual(["kredit-bank"]);
    const tidak = K.saranKeadaan("hb", Posita.butirPosita("Para pihak tidak pernah membuat perjanjian perkawinan apa pun selama menikah"), "");
    expect(kunci(tidak, "perjanjianKawin")).toBeUndefined();
  });

  it("jalur resmi positaTambahan menggabungkan pola lama dan baru tanpa kunci ganda; pola baru menggantikan putusanCerai dan hartaPeninggalan lama", () => {
    const t = Posita.positaTambahan(POSITA_HB, "hb", PETITUM_HB);
    const daftar = t.map((x: any) => x.kunci);
    expect(new Set(daftar).size).toBe(daftar.length);
    expect(kunci(t, "putusanCerai").nilai).toBe("Nomor 126 tanggal 28 April 2020");
    expect(kunci(t, "tglNikah").nilai).toBe("14 September 2003");
    // tanpa petitum tetap berjalan (pola lama + posita)
    const tanpa = Posita.positaTambahan(POSITA_HB, "hb");
    expect(kunci(tanpa, "tglNikah")).toBeTruthy();
  });
});

describe("B2. pendeteksi gugatan kewarisan atas bunyi nyata (nama diganti)", () => {
  const PETITUM_WR = [
    "Mengabulkan gugatan Penggugat seluruhnya;",
    "Menetapkan Ahli Waris Almarhum Fulan Bin Fulan adalah :",
    "Umar Radjamuda (Ahli waris dari Almh. Ema (Anak Pertama Pewaris)).",
    "Indra B. (Ahli waris dari Alm. Basri (Anak kedua Pewaris)).",
    "Harsono (Anak Keempat Pewaris).",
    "Menetapkan harta peninggalan Almarhum Fulan Bin Fulan adalah :",
    "Objek I (Satu) :",
    "Sebidang tanah kebun kelapa yang terletak di Desa Sidondo seluas 1800 M2 yang dikuasai sepihak oleh Tergugat I",
    "Objek II (Dua) :",
    "Satu unit mobil Toyota Avanza warna putih atas nama Tergugat",
    "Meletakkan sita jaminan atas harta peninggalan tersebut;",
    "Menetapkan bagian masing-masing ahli waris menurut hukum waris Islam;",
  ].join("\n");
  const POSITA_WR = [
    "Pada Tanggal 1 Agustus 1989 telah meninggal ayah kandung Penggugat yang bernama FULAN di Desa Baliase karena sakit dalam keadaan beragama islam",
    "semasa hidupnya almarhum FULAN menikah satu kali dengan istrinya dan dari perkawinan yang sah itu dikaruniai 4 orang anak",
    "harta peninggalan itu dikuasai sepihak oleh Tergugat I dan tidak mau dibagikan",
    "Almarhum juga meninggalkan hutang pewaris kepada pihak lain",
  ].join("\n");
  const kunci = (hasil: any[], k: string) => hasil.find((x: any) => x.kunci === k);

  it("daftar ahli waris dari petitum memuat nama dan hubungan; selalu ragu", () => {
    const f = K.warisLanjut(Posita.butirPosita(POSITA_WR), PETITUM_WR);
    const a = kunci(f, "ahliWaris");
    expect(a.yakin).toBe("ragu");
    expect(a.nilai).toContain("Umar Radjamuda");
    expect(a.nilai).toContain("Harsono");
    expect(a.nilai.split("; ")).toHaveLength(3);
    expect(a.nilai).toContain("Anak Keempat Pewaris");
  });

  it("tanggal wafat dari kalimat 'Pada tanggal ... telah meninggal ... bernama ...' (ragu: bisa ayah atau ibu pewaris)", () => {
    const f = K.warisLanjut(Posita.butirPosita(POSITA_WR), "");
    expect(kunci(f, "wafatTgl")).toMatchObject({ nilai: "1 Agustus 1989", yakin: "ragu" });
  });

  it("saran keadaan kewarisan: golongan ahli waris, penguasa, jenis harta, hutang; sita hanya diminta; semuanya ragu", () => {
    const s = K.saranKeadaan("waris", Posita.butirPosita(POSITA_WR), PETITUM_WR);
    expect(kunci(s, "ahliWaris").nilai).toEqual(expect.arrayContaining(["anak", "cucu-pengganti"]));
    expect(kunci(s, "penguasa").nilai).toBe("lawan");
    expect(kunci(s, "jenisHarta").nilai).toEqual(expect.arrayContaining(["tanah-bangunan", "kendaraan"]));
    expect(kunci(s, "hutang").nilai).toBe("ada");
    expect(kunci(s, "sita")).toBeUndefined();
    expect(kunci(s, "sitaDiminta")).toBeTruthy();
    for (const x of s) expect(x.yakin, x.kunci).toBe("ragu");
  });

  it("kutipan Pasal 49 (c. wasiat d. hibah) dan kalimat penyangkalan tidak dihitung sebagai wasiat atau hibah", () => {
    const s = K.saranKeadaan("waris", Posita.butirPosita("Pengadilan Agama berwenang atas perkara waris, b. waris c. wasiat d. hibah, wakaf\nPewaris tidak pernah membuat wasiat dan tidak meninggalkan hibah apa pun"), "");
    expect(kunci(s, "wasiat")).toBeUndefined();
    expect(kunci(s, "hibahSemasaHidup")).toBeUndefined();
  });

  it("variabel 8718 (harta peninggalan) kini menunjuk ke harta peninggalan, bukan ke ahli waris", () => {
    const dipanggil: string[] = [];
    const h = { nilai: (k: string) => (dipanggil.push(k), `nilai-${k}`), fakta: { ambil: () => null } };
    expect(Variabel.KODE[8718]({ h })).toBe("nilai-hartaPeninggalan");
    expect(Variabel.KODE[8717]({ h })).toBe("nilai-ahliWaris");
    expect(dipanggil).toEqual(["hartaPeninggalan", "ahliWaris"]);
  });

  it("jalur resmi positaTambahan kewarisan membawa petitum dan tidak merusak pola lama (jumlah anak tetap terbaca)", () => {
    const t = Posita.positaTambahan(POSITA_WR, "waris", PETITUM_WR);
    expect(kunci(t, "ahliWaris")).toBeTruthy();
    expect(kunci(t, "jumlahAnakPewaris")).toMatchObject({ nilai: "4" });
    const daftar = t.map((x: any) => x.kunci);
    expect(new Set(daftar).size).toBe(daftar.length);
  });

  it("jenis lain tidak terpengaruh: cerai dan penetapan ahli waris tetap memakai pola masing-masing", () => {
    expect(Posita.positaTambahan(POSITA_WR, "paw", PETITUM_WR).some((x: any) => x.kunci === "ahliWaris")).toBe(false);
    expect(K.saranKeadaan("cg", [], "")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("C. catatan ukur atas perkara nyata", () => {
  const berkas = path.join(PAKET, "ukur", "hasil-ukur.json");
  it("hasil ukur tersimpan: jumlah gugatan, tingkat yakin dan batas sampel dicatat jujur", () => {
    expect(existsSync(berkas)).toBe(true);
    const h = JSON.parse(readFileSync(berkas, "utf8"));
    expect(h.hb.jumlahGugatan).toBeGreaterThanOrEqual(30);
    expect(h.waris.jumlahGugatan).toBeGreaterThanOrEqual(25);
    expect(h.hb.kutipanPutusanCerai.dibaca).toBeGreaterThanOrEqual(8);
    expect(h.hb.kutipanPutusanCerai.ketemuDiSipp).toBeGreaterThanOrEqual(5);
    expect(String(h.batas)).toMatch(/sampel/i);
    // tidak ada keadaan yang diklaim 'cukup': pembanding amar putusan terlalu jarang memuat padanannya
    expect(h.keputusanYakin.keadaan).toBe("ragu");
    expect(h.keputusanYakin.tglNikah).toBe("cukup");
    expect(h.keputusanYakin.putusanCerai).toBe("cukup");
  });
});
