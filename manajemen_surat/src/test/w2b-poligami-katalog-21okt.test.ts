// @vitest-environment node
/**
 * ============================================================================
 * AGEN W2b-A (21 Okt 2026) - BANK TANYA JAWAB SAKSI IZIN POLIGAMI, PENCEGAHAN DAN PEMBATALAN PERKAWINAN
 * ============================================================================
 *
 * Mesin katalog dan pembungkus Blangko Derry dijalankan SUNGGUHAN (murni tanpa DOM). Yang dijaga:
 *   1. yang sudah ada tidak dihapus dan tidak berubah (butir, pokok, dasar hukum, keadaan); versi naik satu; butir baru memenuhi target
 *      (izin poligami >= 40, pencegahan dan pembatalan >= 20);
 *   2. butir baru hanya muncul pada keadaan yang tepat (alasan huruf a/b/c, sikap istri, Termohon tidak hadir, status calon istri,
 *      harta bersama, izin atasan; alasan pencegahan/pembatalan, kedudukan pengaju, pencatatan);
 *   3. kalimat saksi 1 dan saksi 2 berbeda pada semua tingkat pengetahuan dan semua butir baru; tiap tingkat punya >= 4 kalimat;
 *   4. tingkat dari cerita, sebagian, tidak tahu, dan ragu menghasilkan jawaban berbeda antar saksi;
 *   5. peran saksi (keluarga calon istri, anak) mengubah jawaban menjadi kesaksian orang pertama;
 *   6. pemeriksa katalog resmi tanpa galat, tanpa kata aplikasi, rujukan perlu-verifikasi tidak tercetak, data ekstensi sinkron.
 */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO = path.resolve(process.cwd(), "..");
const EK = path.join(REPO, "ekstensi-sipp");
const FOLDER = path.join(EK, "saksi-katalog");
const CAD = path.join(REPO, "abt-paket/w2b-keluarga-lain/cadangan-katalog");
const req = createRequire(import.meta.url);
const muat = (dir: string, n: string) => JSON.parse(readFileSync(path.join(dir, n), "utf8"));

const semua = readdirSync(FOLDER).filter((n) => n.endsWith(".json")).map((n) => muat(FOLDER, n));
(globalThis as any).ALETA_SAKSI_KATALOG_DATA = semua;
const Mesin = req(path.join(EK, "saksi-katalog.js"));
const Bd = req(path.join(EK, "blangko-derry-katalog.js"));

const PG = semua.find((k: any) => k.kunci === "izin-poligami");
const PC = semua.find((k: any) => k.kunci === "pencegahan-perkawinan");
const BT = semua.find((k: any) => k.kunci === "pembatalan-perkawinan");

type Opsi = { keadaan?: Record<string, any>; saksi?: any[]; variabel?: Record<string, string>; sebutan?: { P: string; T: string } };
function susun(kat: any, o: Opsi = {}) {
  const hasil = Bd.susun({
    kat,
    sebutan: o.sebutan || { P: "Pemohon", T: "Termohon" },
    benih: "uji/Pdt.G/2026/PA.Dgl",
    keadaan: Bd.lengkapiBawaan(kat, o.keadaan || {}),
    saksi: o.saksi || [{ kunci: "saksi 1 p", pihak: "P" }, { kunci: "saksi 2 p", pihak: "P" }],
    variabel: (k: string) => (o.variabel || {})[k],
  });
  expect(hasil.ada).toBe(true);
  return hasil;
}
const idBaris = (h: any, ke = 0) => h.saksi[ke].baris.map((b: any) => b.butir) as string[];
const baris = (h: any, id: string, ke = 0) => h.saksi[ke].baris.find((b: any) => b.butir === id);
const PERKARA = "252/Pdt.G/2024/PA.Dgl";

const VAR = { "8723": "Yunita binti Yos", "8724": "janda, umur 35 tahun, pekerjaan mengurus rumah tangga", "8725": "Rp15.000.000,00", "1152": "istri tidak dapat melahirkan keturunan", "8722": "rumah satu unit", "1031": "pegawai swasta", "8726": "Nomor 12 tanggal 3 Maret 2025", "5197": "18 Juli 2022", "7777": "4 tahun", "8535": "telah dikaruniai satu orang anak", "4851": "takut nafkah anak berkurang", "4852": "menderita gangguan jiwa berat", "1029": "Ardi bin Lamo", "5105": "Desa Labuan" };

describe("katalog lama tidak dikurangi", () => {
  for (const [kunci, baru, minimum] of [["izin-poligami", PG, 40], ["pencegahan-perkawinan", PC, 20], ["pembatalan-perkawinan", BT, 20]] as const) {
    it(`${kunci}: butir, pokok, dasar hukum, dan keadaan lama utuh dan tidak berubah; versi naik satu; butir baru >= ${minimum}`, () => {
      const lama = muat(CAD, `${kunci}.json`);
      const ids = new Set(baru.pertanyaan.map((q: any) => q.id));
      for (const q of lama.pertanyaan) {
        expect(ids.has(q.id), `${kunci} kehilangan ${q.id}`).toBe(true);
        expect(JSON.stringify(baru.pertanyaan.find((x: any) => x.id === q.id))).toBe(JSON.stringify(q));
      }
      for (const p of lama.pokokPembuktian) expect(baru.pokokPembuktian.some((x: any) => x.id === p.id), p.id).toBe(true);
      for (const d of lama.dasarHukum) expect(JSON.stringify(baru.dasarHukum.find((x: any) => x.id === d.id)), d.id).toBe(JSON.stringify(d));
      for (const k of Object.keys(lama.keadaan)) expect(JSON.stringify(baru.keadaan[k]), k).toBe(JSON.stringify(lama.keadaan[k]));
      expect(baru.versi).toBe(lama.versi + 1);
      expect(baru.pertanyaan.length - lama.pertanyaan.length).toBeGreaterThanOrEqual(minimum);
    });
  }
  it("pemeriksa katalog resmi: tanpa galat pada ketiganya, tanpa kata aplikasi", () => {
    for (const k of [PG, PC, BT]) {
      const r = Mesin.periksaKatalog(k, { namaBerkas: `${k.kunci}.json`, variabelAda: null });
      expect(r.galat, k.kunci).toEqual([]);
      expect(JSON.stringify(k)).not.toMatch(/aleta/i);
    }
  });
  it("rujukan hukum yang perlu-verifikasi hanya metadata: tidak ada yang tercetak di tanya jawab", () => {
    for (const k of [PG, PC, BT]) {
      const rujukan = k.dasarHukum.filter((d: any) => d.status === "perlu-verifikasi").map((d: any) => d.rujukan);
      const teks = JSON.stringify(k.pertanyaan);
      for (const r of rujukan) expect(teks.includes(r), `${k.kunci}: ${r}`).toBe(false);
    }
    // dasar baru yang tidak disalin dari katalog terverifikasi wajib bersumber dan berstatus perlu-verifikasi
    for (const id of ["dh-pg-khi-56", "dh-pg-khi-59", "dh-pg-pp9-40-43", "dh-pg-uup-65", "dh-pg-khi-55-2"]) {
      const d = PG.dasarHukum.find((x: any) => x.id === id);
      expect(d?.status, id).toBe("perlu-verifikasi");
      expect(String(d?.sumber).length, id).toBeGreaterThan(20);
    }
  });
});

describe("izin poligami: butir baru menurut keadaan", () => {
  const dasar = { kehadiran: "kontradiktoir", sikapIstri: "setuju", pekerjaanSuami: "lainnya" };
  it("alasan huruf a, b, c menentukan pertanyaan alasan yang diajukan", () => {
    const a = susun(PG, { keadaan: { ...dasar, alasanPoligami: ["a"] }, variabel: VAR });
    expect(idBaris(a)).toContain("q-pg-alasan-a-kewajiban");
    expect(idBaris(a)).not.toContain("q-pg-alasan-b-penyakit");
    expect(idBaris(a)).not.toContain("q-pg-alasan-c-keturunan");
    const b = susun(PG, { keadaan: { ...dasar, alasanPoligami: ["b"] }, variabel: VAR });
    expect(idBaris(b)).toContain("q-pg-alasan-b-penyakit");
    expect(idBaris(b)).not.toContain("q-pg-alasan-a-kewajiban");
    const c = susun(PG, { keadaan: { ...dasar, alasanPoligami: ["c"] }, variabel: VAR });
    expect(idBaris(c)).toEqual(expect.arrayContaining(["q-pg-alasan-c-keturunan", "q-pg-alasan-c-periksa"]));
    expect(baris(c, "q-pg-alasan-c-keturunan").jawab).toContain("4 tahun");
    const ac = susun(PG, { keadaan: { ...dasar, alasanPoligami: ["a", "c"] }, variabel: VAR });
    expect(idBaris(ac)).toEqual(expect.arrayContaining(["q-pg-alasan-a-kewajiban", "q-pg-alasan-c-keturunan"]));
  });
  it("sikap istri: setuju, keberatan, tidak mungkin dimintai persetujuan memuat pokok yang berbeda", () => {
    const setuju = susun(PG, { keadaan: dasar, variabel: VAR });
    expect(idBaris(setuju)).toEqual(expect.arrayContaining(["q-pg-setuju-tertulis", "q-pg-setuju-sukarela"]));
    expect(idBaris(setuju)).not.toContain("q-pg-keberatan-alasan");
    const keberatan = susun(PG, { keadaan: { ...dasar, sikapIstri: "keberatan" }, variabel: VAR });
    expect(idBaris(keberatan)).toEqual(expect.arrayContaining(["q-pg-keberatan-alasan", "q-pg-keberatan-musyawarah"]));
    expect(idBaris(keberatan)).not.toContain("q-pg-setuju-tertulis");
    expect(baris(keberatan, "q-pg-keberatan-alasan").jawab).toContain("takut nafkah anak berkurang");
    const tm = susun(PG, { keadaan: { ...dasar, sikapIstri: "tidak-mungkin" }, variabel: VAR });
    expect(idBaris(tm)).toEqual(expect.arrayContaining(["q-pg-tidakmungkin-keadaan", "q-pg-tidakmungkin-lama"]));
    expect(baris(tm, "q-pg-tidakmungkin-keadaan").jawab).toContain("menderita gangguan jiwa berat");
  });
  it("Termohon tidak hadir: butir tempat tinggal dan pernyataan istri hanya untuk saksi Pemohon pada verstek", () => {
    const hadir = susun(PG, { keadaan: dasar, variabel: VAR });
    expect(idBaris(hadir)).not.toContain("q-pg-verstek-tinggal");
    for (const kehadiran of ["verstek", "t-tidak-hadir-setelah-mediasi"]) {
      const h = susun(PG, { keadaan: { ...dasar, kehadiran }, variabel: VAR });
      expect(idBaris(h), kehadiran).toEqual(expect.arrayContaining(["q-pg-verstek-tinggal", "q-pg-verstek-sikap-hadir", "q-pg-verstek-diberitahu-sidang"]));
    }
  });
  it("status calon istri: janda memunculkan iddah dengan jawaban menurut sebab; perawan tidak", () => {
    expect(idBaris(susun(PG, { keadaan: { ...dasar, statusCalon: "gadis" }, variabel: VAR }))).not.toContain("q-pg-calon-iddah");
    const cerai = susun(PG, { keadaan: { ...dasar, statusCalon: "janda-cerai" }, variabel: VAR });
    const mati = susun(PG, { keadaan: { ...dasar, statusCalon: "janda-meninggal" }, variabel: VAR });
    expect(idBaris(cerai)).toContain("q-pg-calon-iddah");
    expect(baris(cerai, "q-pg-calon-iddah").jawab).toMatch(/cerai|bercerai/);
    expect(baris(mati, "q-pg-calon-iddah").jawab).toMatch(/kematian|meninggal/);
    expect(baris(susun(PG, { keadaan: { ...dasar, statusCalon: "janda-cerai" }, variabel: VAR }), "q-pg-calon-status").jawab).toMatch(/akta cerai/);
  });
  it("harta bersama dan izin atasan hanya pada keadaannya", () => {
    expect(idBaris(susun(PG, { keadaan: dasar, variabel: VAR }))).not.toContain("q-pg-harta-rincian");
    const hb = susun(PG, { keadaan: { ...dasar, kumulasi: ["harta-bersama"] }, variabel: VAR });
    expect(idBaris(hb)).toEqual(expect.arrayContaining(["q-pg-harta-rincian", "q-pg-harta-asal", "q-pg-harta-istri-kedua"]));
    expect(baris(hb, "q-pg-harta-rincian").jawab).toContain("rumah satu unit");
    expect(idBaris(susun(PG, { keadaan: dasar, variabel: VAR }))).not.toContain("q-pg-atasan-surat");
    const asn = susun(PG, { keadaan: { ...dasar, pekerjaanSuami: "asn-tni-polri" }, variabel: VAR });
    expect(idBaris(asn)).toEqual(expect.arrayContaining(["q-pg-atasan-surat", "q-pg-atasan-status"]));
    expect(baris(asn, "q-pg-atasan-surat").jawab).toContain("Nomor 12 tanggal 3 Maret 2025");
  });
  it("syarat Pasal 5 UU 1/1974: kemampuan, tanggungan, dan keadilan terjawab dengan isian penghasilan", () => {
    const h = susun(PG, { keadaan: dasar, variabel: VAR });
    for (const id of ["q-pg-sumber-penghasilan", "q-pg-penghasilan-tetap", "q-pg-tanggungan", "q-pg-adil-giliran", "q-pg-adil-surat", "q-pg-calon-keluarga-setuju", "q-pg-tanpaizin-belum-menikah"]) expect(idBaris(h), id).toContain(id);
    expect(baris(h, "q-pg-penghasilan-tetap").jawab).toContain("Rp15.000.000,00");
  });
  it("peran saksi: keluarga calon istri dan anak menjadi kesaksian orang pertama", () => {
    const kc = susun(PG, { keadaan: dasar, variabel: VAR, saksi: [{ kunci: "saksi 1 p", pihak: "P", keadaan: { kedudukanSaksi: "keluarga-calon-istri" } }, { kunci: "saksi 2 p", pihak: "P" }] });
    expect(baris(kc, "q-pg-calon-keluarga-setuju").jawab).toMatch(/\bsaya\b.*(keluarga|kerabat)|(keluarga|kerabat).*\bsaya\b/);
    expect(baris(kc, "q-pg-calon-keluarga-setuju").jawab).not.toBe(baris(kc, "q-pg-calon-keluarga-setuju", 1).jawab);
    const anak = susun(PG, { keadaan: dasar, variabel: VAR, saksi: [{ kunci: "saksi 1 p", pihak: "P", keadaan: { kedudukanSaksi: "anak-pemohon" } }, { kunci: "saksi 2 p", pihak: "P" }] });
    expect(baris(anak, "q-pg-setuju-keluarga-sikap").jawab).toMatch(/\bsaya\b.*anak|anak.*\bsaya\b/);
  });
});

describe("pencegahan perkawinan: butir baru menurut keadaan", () => {
  const sebutan = { P: "Pemohon", T: "Termohon" };
  it("alasan pencegahan huruf A sampai H menentukan butir; kedudukan pemohon menentukan butir kedudukan", () => {
    const a = susun(PC, { sebutan, keadaan: { alasan: "A", terikatPada: "calon-suami" }, variabel: VAR });
    expect(idBaris(a)).toEqual(expect.arrayContaining(["q-pc-a-status", "q-pc-a-poligami-izin"]));
    expect(idBaris(a)).not.toContain("q-pc-b-umur");
    const b = susun(PC, { sebutan, keadaan: { alasan: "B" }, variabel: VAR });
    expect(idBaris(b)).toContain("q-pc-b-umur");
    expect(idBaris(b)).not.toContain("q-pc-a-poligami-izin");
    const c = susun(PC, { sebutan, keadaan: { alasan: "C", jenisLarangan: "semenda" }, variabel: VAR });
    expect(idBaris(c)).toContain("q-pc-c-semenda");
    expect(idBaris(c)).not.toContain("q-pc-c-nasab");
    const lurus = susun(PC, { sebutan, keadaan: { alasan: "G", kedudukanPemohon: "keluarga-lurus" }, variabel: VAR });
    expect(idBaris(lurus)).toEqual(expect.arrayContaining(["q-pc-kp-lurus", "q-pc-g-paksa"]));
    expect(idBaris(lurus)).not.toContain("q-pc-kp-saudara-wali");
  });
  it("calon mempelai hadir memunculkan butir pengetahuan perkara; keluarga calon menjadi kesaksian orang pertama", () => {
    expect(idBaris(susun(PC, { sebutan, keadaan: { alasan: "G", calonMempelai: "tidak-hadir" }, variabel: VAR }))).not.toContain("q-pc-ch-tahu-perkara");
    expect(idBaris(susun(PC, { sebutan, keadaan: { alasan: "G", calonMempelai: "hadir" }, variabel: VAR }))).toContain("q-pc-ch-tahu-perkara");
    const h = susun(PC, { sebutan, keadaan: { alasan: "G" }, variabel: VAR, saksi: [{ kunci: "saksi 1 p", pihak: "P", keadaan: { kedudukanSaksi: "keluarga-calon-mempelai" } }, { kunci: "saksi 2 p", pihak: "P" }] });
    expect(baris(h, "q-pc-lama-kenal").jawab).toMatch(/\bsaya\b/);
    expect(baris(h, "q-pc-lama-kenal").jawab).not.toBe(baris(h, "q-pc-lama-kenal", 1).jawab);
  });
});

describe("pembatalan perkawinan: butir baru menurut keadaan", () => {
  const sebutan = { P: "Penggugat", T: "Tergugat" };
  const dasar = { kehadiran: "kontradiktoir" };
  it("alasan A (poligami tanpa izin) dan G (larangan) menentukan butir; pencatatan menentukan butir akta", () => {
    const a = susun(BT, { sebutan, keadaan: { ...dasar, alasan: "A", pencatatan: "tidak-tercatat" }, variabel: VAR });
    expect(idBaris(a)).toEqual(expect.arrayContaining(["q-bt-a-istri-pertama-sikap", "q-bt-a-izin-pengadilan", "q-bt-nikah-tidak-dicatat"]));
    expect(idBaris(a)).not.toContain("q-bt-buku-nikah-pegang");
    const g = susun(BT, { sebutan, keadaan: { ...dasar, alasan: "G", jenisLarangan: "sesusuan", pencatatan: "tercatat" }, variabel: VAR });
    expect(idBaris(g)).toEqual(expect.arrayContaining(["q-bt-g-hubungan-jenis", "q-bt-buku-nikah-pegang"]));
    expect(idBaris(g)).not.toContain("q-bt-a-izin-pengadilan");
    expect(baris(g, "q-bt-g-hubungan-jenis").jawab).toMatch(/susu|sesusuan/);
  });
  it("tenggang enam bulan hanya untuk paksaan atau salah sangka; jawaban mengikuti sikap setelah tahu", () => {
    expect(idBaris(susun(BT, { sebutan, keadaan: { ...dasar, alasan: "A" }, variabel: VAR }))).not.toContain("q-bt-hidup-setelah-tahu");
    const berpisah = susun(BT, { sebutan, keadaan: { ...dasar, alasan: "E", sikapSetelahTahu: "berpisah-setelah-tahu" }, variabel: VAR });
    const bersama = susun(BT, { sebutan, keadaan: { ...dasar, alasan: "E", sikapSetelahTahu: "tetap-bersama-setelah-tahu" }, variabel: VAR });
    expect(idBaris(berpisah)).toContain("q-bt-hidup-setelah-tahu");
    expect(baris(berpisah, "q-bt-hidup-setelah-tahu").jawab).not.toBe(baris(bersama, "q-bt-hidup-setelah-tahu").jawab);
  });
});

describe("kualitas tanya jawab semua butir baru", () => {
  const baruSaja = (kat: any, lama: any) => {
    const ada = new Set(lama.pertanyaan.map((q: any) => q.id));
    return kat.pertanyaan.filter((q: any) => !ada.has(q.id));
  };
  for (const [kunci, kat] of [["izin-poligami", PG], ["pencegahan-perkawinan", PC], ["pembatalan-perkawinan", BT]] as const) {
    it(`${kunci}: saksi 1 dan saksi 2 berbeda di semua tingkat, tiap tingkat >= 4 kalimat per saksi`, () => {
      const baru = baruSaja(kat, muat(CAD, `${kunci}.json`));
      expect(baru.length).toBeGreaterThan(0);
      for (const q of baru) {
        for (const [jenis, v] of Object.entries(q.jawaban) as [string, any][]) {
          for (const x of Array.isArray(v) ? v : [v]) {
            expect(x.saksi1.length, `${q.id}/${jenis}`).toBeGreaterThanOrEqual(4);
            expect(x.saksi2.length, `${q.id}/${jenis}`).toBeGreaterThanOrEqual(4);
            if (jenis !== "berbeda") for (const a of x.saksi1) for (const b of x.saksi2) expect(a, `${q.id}/${jenis}`).not.toBe(b);
          }
        }
      }
    });
  }
  it("tingkat dari cerita, sebagian, tidak tahu, dan ragu menghasilkan jawaban berbeda antar saksi pada butir baru", () => {
    const uji: [any, string, Record<string, any>, Opsi["sebutan"]][] = [
      [PG, "q-pg-calon-status", { kehadiran: "kontradiktoir", sikapIstri: "setuju" }, undefined],
      [PC, "q-pc-b-umur", { alasan: "B" }, undefined],
      [BT, "q-bt-a-izin-pengadilan", { kehadiran: "kontradiktoir", alasan: "A" }, { P: "Penggugat", T: "Tergugat" }],
    ];
    for (const [kat, id, keadaan, sebutan] of uji) {
      for (const jenis of ["de-auditu", "sebagian", "tidak-tahu", "ragu"]) {
        const h = susun(kat, { keadaan, sebutan, variabel: VAR, saksi: [{ kunci: "saksi 1 p", pihak: "P", jenis, sumber: "tetangga" }, { kunci: "saksi 2 p", pihak: "P", jenis, sumber: "keluarga" }] });
        const b = baris(h, id);
        expect(b, `${id}/${jenis}`).toBeTruthy();
        expect(b.jawab.length, `${id}/${jenis}`).toBeGreaterThan(10);
        expect(b.jawab, `${id}/${jenis}`).not.toBe(baris(h, id, 1).jawab);
      }
    }
  });
  it("berkas data ekstensi memuat butir baru ketiga katalog (sinkron dengan JSON)", () => {
    const data = readFileSync(path.join(EK, "saksi-katalog-data.js"), "utf8");
    for (const k of [PG, PC, BT]) {
      const n = (data.match(new RegExp(`"id":"q-${k === PG ? "pg" : k === PC ? "pc" : "bt"}-`, "g")) || []).length;
      expect(n, k.kunci).toBeGreaterThan(0);
      expect(data.includes(`"kunci":"${k.kunci}","judul":"${k.judul}","versi":${k.versi}`), `${k.kunci} versi ${k.versi}`).toBe(true);
    }
    expect(PERKARA).toBeTruthy();
  });
});
