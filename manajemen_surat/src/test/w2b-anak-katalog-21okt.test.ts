// @vitest-environment node
/**
 * ============================================================================
 * AGEN W2b-B (21 Okt 2026) - BANK TANYA JAWAB SAKSI KELUARGA ANAK: HAK ASUH, PENGUASAAN ANAK, NAFKAH ANAK
 * ============================================================================
 *
 * Perilaku yang dijaga (mesin katalog + pembungkus Blangko Derry dijalankan SUNGGUHAN, murni tanpa DOM):
 *   1. yang sudah ada tidak dihapus dan tidak diubah isinya (butir, pokok, dasar hukum, keadaan); versi naik satu;
 *   2. butir baru (>= 40 per jenis) hanya muncul pada keadaan yang tepat dan tidak muncul pada keadaan lain;
 *   3. kalimat saksi 1 dan saksi 2 berbeda untuk setiap butir baru pada semua tingkat pengetahuan;
 *   4. pihak pengasuh/penguasa/yang dipilih anak mengubah nama pihak di jawaban;
 *   5. tingkat de-auditu, sebagian, tidak tahu, dan ragu menghasilkan jawaban untuk butir baru;
 *   6. mesin pemeriksa katalog (periksaKatalog) tidak menemukan galat; tanpa kata aplikasi; nomor jenis perkara tercatat;
 *   7. berkas data ekstensi memuat butir baru (sinkron dengan JSON).
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

const HA = semua.find((k: any) => k.kunci === "hak-asuh");
const PA = semua.find((k: any) => k.kunci === "penguasaan-anak");
const NA = semua.find((k: any) => k.kunci === "nafkah-anak");
const JENIS = [
  ["hak-asuh", HA, "q-ha-"],
  ["penguasaan-anak", PA, "q-pa-"],
  ["nafkah-anak", NA, "q-na-"],
] as const;

type Opsi = { keadaan?: Record<string, any>; saksi?: any[]; variabel?: Record<string, string>; jarang?: boolean };
function susun(kat: any, o: Opsi = {}) {
  const hasil = Bd.susun({
    kat,
    sebutan: { P: "Penggugat", T: "Tergugat" },
    benih: "uji/Pdt.G/2026/PA.Dgl",
    keadaan: Bd.lengkapiBawaan(kat, o.keadaan || {}),
    saksi: o.saksi || [{ kunci: "saksi 1 p", pihak: "P" }, { kunci: "saksi 2 p", pihak: "P" }],
    variabel: (k: string) => (o.variabel || {})[k],
    jarang: o.jarang !== false,
  });
  expect(hasil.ada).toBe(true);
  return hasil;
}
const idBaris = (h: any, ke = 0) => h.saksi[ke].baris.map((b: any) => b.butir) as string[];
const baris = (h: any, id: string, ke = 0) => h.saksi[ke].baris.find((b: any) => b.butir === id);
const aktif = (kat: any, keadaan: Record<string, any>) =>
  Mesin.pertanyaanAktif(kat, { ...Mesin.keadaanBawaan(kat, {}), kehadiran: "kontradiktoir", ...keadaan }, "P", { tingkat: ["inti", "pilihan", "tambahan", "jarang"] }).map((q: any) => q.id) as string[];

const VAR = { "8602": "Aisyah binti Budi", "0100": "penjahit", "0104": "sopir" };

describe("katalog lama tidak dikurangi dan tidak diubah", () => {
  for (const [kunci, baru, awalan] of JENIS) {
    it(`${kunci}: butir, pokok, dasar hukum, keadaan lama utuh; versi naik satu; butir baru >= 40`, () => {
      const lama = muat(CAD, `${kunci}.json`);
      const ids = new Set(baru.pertanyaan.map((q: any) => q.id));
      for (const q of lama.pertanyaan) expect(ids.has(q.id), `${kunci} kehilangan ${q.id}`).toBe(true);
      for (const p of lama.pokokPembuktian) expect(baru.pokokPembuktian.some((x: any) => x.id === p.id), p.id).toBe(true);
      for (const d of lama.dasarHukum) expect(baru.dasarHukum.some((x: any) => x.id === d.id), d.id).toBe(true);
      for (const k of Object.keys(lama.keadaan)) expect(baru.keadaan[k]).toBeTruthy();
      expect(baru.versi).toBe(lama.versi + 1);
      for (const q of lama.pertanyaan) expect(JSON.stringify(baru.pertanyaan.find((x: any) => x.id === q.id))).toBe(JSON.stringify(q));
      const tambah = baru.pertanyaan.filter((q: any) => !lama.pertanyaan.some((l: any) => l.id === q.id));
      expect(tambah.length).toBeGreaterThanOrEqual(40);
      for (const q of tambah) expect(q.id.startsWith(awalan), q.id).toBe(true);
    });
    it(`${kunci}: mesin pemeriksa katalog tidak menemukan galat; tanpa kata aplikasi`, () => {
      const r = Mesin.periksaKatalog(baru, { namaBerkas: `${kunci}.json` });
      expect(r.galat).toEqual([]);
      expect(JSON.stringify(baru)).not.toMatch(/aleta/i);
    });
  }
  it("jenis perkara: hak asuh = 369 (Lain-Lain), penguasaan anak = 349, nafkah anak = 350 dan 743", () => {
    expect(HA.syarat.jenisPerkaraId).toEqual(["369"]);
    expect(PA.syarat.jenisPerkaraId).toEqual(["349"]);
    expect([...NA.syarat.jenisPerkaraId].sort()).toEqual(["350", "743"]);
  });
});

describe("hak asuh: butir baru menurut keadaan", () => {
  it("keadaan pihak yang dipersoalkan hanya memunculkan butirnya sendiri", () => {
    const dasar = aktif(HA, {});
    for (const id of ["q-ha-menikah-lagi", "q-ha-bekerja-jauh", "q-ha-kebiasaan-buruk-ada", "q-ha-kekerasan-penelantaran", "q-ha-jarang-menjenguk"]) expect(dasar, id).not.toContain(id);
    expect(aktif(HA, { keadaanPihakLain: "menikah-lagi" })).toContain("q-ha-menikah-lagi");
    expect(aktif(HA, { keadaanPihakLain: "menikah-lagi" })).not.toContain("q-ha-bekerja-jauh");
    expect(aktif(HA, { keadaanPihakLain: "kekerasan-penelantaran" })).toContain("q-ha-kekerasan-penelantaran");
    expect(aktif(HA, { keadaanPihakLain: "jarang-menjenguk" })).toContain("q-ha-jarang-menjenguk");
  });
  it("keselamatan anak (Pasal 156 huruf c) hanya bila pengalihan dimohonkan; akses ya atau tidak memilih butir berbeda", () => {
    expect(aktif(HA, {})).not.toContain("q-ha-bahaya-kekerasan");
    expect(aktif(HA, { pengalihan: "ya" })).toEqual(expect.arrayContaining(["q-ha-bahaya-kekerasan", "q-ha-bahaya-penelantaran", "q-ha-bahaya-pengaruh"]));
    expect(aktif(HA, { akses: "ya" })).toContain("q-ha-akses-berjalan");
    expect(aktif(HA, { akses: "ya" })).not.toContain("q-ha-akses-dihalangi");
    expect(aktif(HA, { akses: "tidak" })).toContain("q-ha-akses-dihalangi");
  });
  it("anak mumayyiz, banyak anak, kerabat sebagai pengaju, perubahan keadaan, dan tergugat tidak hadir", () => {
    expect(aktif(HA, { anakMumayyiz: "belum" })).not.toContain("q-ha-alasan-pilihan");
    expect(aktif(HA, { anakMumayyiz: "sudah" })).toEqual(expect.arrayContaining(["q-ha-alasan-pilihan", "q-ha-pilihan-tanpa-paksaan", "q-ha-pilihan-sejak"]));
    expect(aktif(HA, {})).not.toContain("q-ha-saudara-bersama");
    expect(aktif(HA, { jumlahAnak: "lebih" })).toEqual(expect.arrayContaining(["q-ha-saudara-bersama", "q-ha-saudara-dipisah"]));
    expect(aktif(HA, { kedudukanPengaju: "kerabat" })).toContain("q-ha-kerabat-hubungan");
    expect(aktif(HA, {})).not.toContain("q-ha-kerabat-hubungan");
    expect(aktif(HA, { perubahan: "ya" })).toEqual(expect.arrayContaining(["q-ha-pindah-tinggal", "q-ha-pindah-sekolah"]));
    expect(aktif(HA, { kehadiran: "verstek" })).toContain("q-ha-lawan-kepedulian");
    expect(aktif(HA, { kehadiran: "kontradiktoir" })).not.toContain("q-ha-lawan-kepedulian");
  });
  it("pihak pengasuh mengubah nama pihak di jawaban (Penggugat atau Tergugat)", () => {
    const a = susun(HA, { keadaan: { pengasuhAnak: "pengaju" }, variabel: VAR });
    const b = susun(HA, { keadaan: { pengasuhAnak: "lawan" }, variabel: VAR });
    expect(idBaris(a)).toContain("q-ha-ibadah-anak");
    expect(baris(a, "q-ha-ibadah-anak").jawab).toContain("Penggugat");
    expect(baris(b, "q-ha-ibadah-anak").jawab).toContain("Tergugat");
    expect(baris(a, "q-ha-ibadah-anak").jawab).toContain("Aisyah binti Budi");
  });
  it("pihak yang dipersoalkan dapat pengaju atau lawan", () => {
    const p = susun(HA, { keadaan: { keadaanPihakLain: "bekerja-jauh", pihakBermasalah: "lawan" }, variabel: VAR });
    const q = susun(HA, { keadaan: { keadaanPihakLain: "bekerja-jauh", pihakBermasalah: "pengaju" }, variabel: VAR });
    expect(baris(p, "q-ha-bekerja-jauh").jawab).toContain("Tergugat");
    expect(baris(q, "q-ha-bekerja-jauh").jawab).toContain("Penggugat");
  });
});

describe("penguasaan anak: butir baru menurut keadaan", () => {
  it("cara anak sampai dikuasai memilih butir yang sesuai", () => {
    const dasar = aktif(PA, { caraPenguasaan: "tidak-dikembalikan" });
    expect(dasar).toContain("q-pa-cara-tidak-kembali");
    expect(dasar).not.toContain("q-pa-cara-dibawa");
    expect(dasar).not.toContain("q-pa-cara-paksa");
    expect(aktif(PA, { caraPenguasaan: "dibawa-pergi" })).toContain("q-pa-cara-dibawa");
    expect(aktif(PA, { caraPenguasaan: "diambil-paksa" })).toContain("q-pa-cara-paksa");
    expect(aktif(PA, { caraPenguasaan: "dititipkan-lalu-ditahan" })).toEqual(expect.arrayContaining(["q-pa-cara-tidak-kembali", "q-pa-cara-dititipkan"]));
  });
  it("permintaan penyerahan hanya bila dituntut; penguasa kerabat; keberadaan anak tidak diketahui", () => {
    expect(aktif(PA, { penyerahan: "tidak" })).not.toContain("q-pa-permintaan-oleh");
    expect(aktif(PA, { penyerahan: "ya" })).toEqual(expect.arrayContaining(["q-pa-permintaan-oleh", "q-pa-alasan-menolak", "q-pa-teguran-perantara"]));
    expect(aktif(PA, { penguasaLain: "orang-tua" })).not.toContain("q-pa-kerabat-hubungan");
    expect(aktif(PA, { penguasaLain: "kerabat" })).toEqual(expect.arrayContaining(["q-pa-kerabat-hubungan", "q-pa-kerabat-izin"]));
    expect(aktif(PA, { lokasiAnak: "diketahui" })).not.toContain("q-pa-anak-tidak-diketahui");
    expect(aktif(PA, { lokasiAnak: "tidak-diketahui" })).toContain("q-pa-anak-tidak-diketahui");
  });
  it("anak belum mumayyiz memerlukan ibu; sudah mumayyiz memunculkan alasan pilihan", () => {
    expect(aktif(PA, { anakMumayyiz: "belum" })).toContain("q-pa-butuh-ibu");
    expect(aktif(PA, { anakMumayyiz: "sudah" })).not.toContain("q-pa-butuh-ibu");
    expect(aktif(PA, { anakMumayyiz: "sudah" })).toEqual(expect.arrayContaining(["q-pa-pilihan-alasan", "q-pa-pilihan-bebas"]));
  });
  it("penguasa nyata menentukan nama pihak yang dikuasai dan pihak penuntut", () => {
    const h = susun(PA, { keadaan: { pengasuhAnak: "lawan" }, variabel: VAR });
    expect(baris(h, "q-pa-penguasa-ekonomi").jawab).toContain("Tergugat");
    expect(baris(h, "q-pa-penuntut-rumah").jawab).toContain("Penggugat");
    const t = susun(PA, { keadaan: { pengasuhAnak: "pengaju" }, variabel: VAR });
    expect(baris(t, "q-pa-penguasa-ekonomi").jawab).toContain("Penggugat");
  });
});

describe("nafkah anak: butir baru menurut keadaan", () => {
  it("sumber penghasilan ayah memilih butir yang sesuai", () => {
    expect(aktif(NA, { sumberPenghasilanAyah: "pegawai-tetap" })).toEqual(expect.arrayContaining(["q-na-ayah-pegawai", "q-na-ayah-tunjangan"]));
    expect(aktif(NA, { sumberPenghasilanAyah: "pegawai-tetap" })).not.toContain("q-na-ayah-usaha");
    expect(aktif(NA, { sumberPenghasilanAyah: "usaha-sendiri" })).toEqual(expect.arrayContaining(["q-na-ayah-usaha", "q-na-ayah-usaha-aset"]));
    expect(aktif(NA, { sumberPenghasilanAyah: "buruh-harian" })).toContain("q-na-ayah-harian");
    expect(aktif(NA, { sumberPenghasilanAyah: "tidak-diketahui" })).toContain("q-na-ayah-tidak-diketahui");
  });
  it("kemampuan ayah mampu atau terbatas; tanggungan lain; penetapan sebelumnya", () => {
    expect(aktif(NA, { kemampuanAyah: "mampu" })).toContain("q-na-ayah-mampu");
    expect(aktif(NA, { kemampuanAyah: "mampu" })).not.toContain("q-na-ayah-terbatas");
    expect(aktif(NA, { kemampuanAyah: "terbatas" })).toContain("q-na-ayah-terbatas");
    expect(aktif(NA, { tanggunganLain: "tidak" })).not.toContain("q-na-tanggungan-lain");
    expect(aktif(NA, { tanggunganLain: "ada" })).toContain("q-na-tanggungan-lain");
    expect(aktif(NA, { penetapanSebelumnya: "tidak-ada" })).not.toContain("q-na-putusan-sebelumnya");
    expect(aktif(NA, { penetapanSebelumnya: "ada-putusan" })).toContain("q-na-putusan-sebelumnya");
    expect(aktif(NA, { penetapanSebelumnya: "ada-kesepakatan" })).toContain("q-na-kesepakatan-sebelumnya");
  });
  it("tahap anak dan jumlah yang dituntut menentukan butir kebutuhan dan perbandingan nominal", () => {
    expect(aktif(NA, { tahapAnak: "belum-sekolah" })).toContain("q-na-kebutuhan-balita");
    expect(aktif(NA, { tahapAnak: "belum-sekolah" })).not.toContain("q-na-sekolah-spp");
    expect(aktif(NA, { tahapAnak: "sekolah" })).toContain("q-na-sekolah-spp");
    expect(aktif(NA, { tahapAnak: "remaja" })).toContain("q-na-sekolah-lanjut");
    expect(aktif(NA, { tuntutanNominal: "ada" })).toEqual(expect.arrayContaining(["q-na-nominal-sesuai", "q-na-nominal-kemampuan"]));
    expect(aktif(NA, { tuntutanNominal: "ada" })).not.toContain("q-na-nominal-tanpa");
    expect(aktif(NA, { tuntutanNominal: "tanpa" })).toContain("q-na-nominal-tanpa");
  });
  it("nafkah lampau dan kenaikan menambah rincian; nafkah diberikan sebagian atau tidak sama sekali", () => {
    expect(aktif(NA, { nafkahLampauAnak: "tidak" })).not.toContain("q-na-lampau-rincian");
    expect(aktif(NA, { nafkahLampauAnak: "ya" })).toEqual(expect.arrayContaining(["q-na-lampau-rincian", "q-na-lampau-utang"]));
    expect(aktif(NA, { jenisNafkah: ["kenaikan"] })).toEqual(expect.arrayContaining(["q-na-kenaikan-bukti", "q-na-kenaikan-kemampuan"]));
    expect(aktif(NA, { nafkahDiberikan: "sebagian" })).toContain("q-na-nafkah-sebagian");
    expect(aktif(NA, { nafkahDiberikan: "tidak" })).toContain("q-na-nafkah-tidak-sama-sekali");
    expect(aktif(NA, { nafkahDiberikan: "tidak" })).not.toContain("q-na-nafkah-sebagian");
  });
  it("jawaban memakai sebutan Penggugat dan Tergugat dan nama anak dari isian", () => {
    const h = susun(NA, { keadaan: { nafkahDiberikan: "tidak" }, variabel: VAR });
    const j = baris(h, "q-na-nafkah-tidak-sama-sekali").jawab as string;
    expect(j).toContain("Tergugat");
    expect(j).toContain("Aisyah binti Budi");
  });
});

describe("kalimat saksi 1 dan saksi 2 pada semua tingkat pengetahuan", () => {
  for (const [kunci, kat, awalan] of JENIS) {
    it(`${kunci}: tiap butir baru punya >= 4 kalimat per saksi dan saksi 1 tidak sama dengan saksi 2`, () => {
      const lama = muat(CAD, `${kunci}.json`);
      const baru = kat.pertanyaan.filter((q: any) => q.id.startsWith(awalan) && !lama.pertanyaan.some((l: any) => l.id === q.id));
      expect(baru.length).toBeGreaterThanOrEqual(40);
      for (const q of baru) {
        const ada = Object.keys(q.jawaban);
        expect(ada, q.id).toEqual(expect.arrayContaining(["melihat", "de-auditu", "sebagian", "berbeda"]));
        for (const [jenis, v] of Object.entries(q.jawaban) as [string, any][]) {
          for (const x of Array.isArray(v) ? v : [v]) {
            expect(x.saksi1.length, `${q.id}/${jenis}`).toBeGreaterThanOrEqual(4);
            expect(x.saksi2.length, `${q.id}/${jenis}`).toBeGreaterThanOrEqual(4);
            if (jenis !== "berbeda") for (const a of x.saksi1) for (const b of x.saksi2) expect(a, `${q.id}/${jenis}`).not.toBe(b);
          }
        }
      }
    });
    it(`${kunci}: tingkat 'dari cerita', 'sebagian', 'tidak tahu' dan 'ragu' menghasilkan jawaban berbeda untuk dua saksi`, () => {
      const lama = muat(CAD, `${kunci}.json`);
      const baru = kat.pertanyaan.filter((q: any) => q.id.startsWith(awalan) && !lama.pertanyaan.some((l: any) => l.id === q.id));
      const kunciKeadaan: Record<string, any> = {};
      for (const jenis of ["de-auditu", "sebagian", "tidak-tahu", "ragu"]) {
        const h = susun(kat, { keadaan: kunciKeadaan, variabel: VAR, saksi: [{ kunci: "saksi 1 p", pihak: "P", jenis, sumber: "tetangga" }, { kunci: "saksi 2 p", pihak: "P", jenis, sumber: "keluarga" }] });
        const dibaca = idBaris(h).filter((id) => baru.some((q: any) => q.id === id));
        expect(dibaca.length, `${kunci}/${jenis}`).toBeGreaterThan(5);
        for (const id of dibaca) {
          const satu = baris(h, id, 0).jawab as string;
          const dua = baris(h, id, 1).jawab as string;
          expect(satu.length, `${id}/${jenis}`).toBeGreaterThan(10);
          expect(satu, `${id}/${jenis}`).not.toBe(dua);
          expect(satu, `${id}/${jenis}`).not.toMatch(/[{}]/);
        }
      }
    });
  }
});

describe("cakupan: setiap butir baru menjawab untuk semua jenis keterangan pada keadaan yang mengaktifkannya", () => {
  const JENIS_KET = ["melihat", "mendengar", "de-auditu", "sebagian", "tidak-tahu", "ragu", "berbeda"];
  for (const [kunci, kat, awalan] of JENIS) {
    it(`${kunci}: tiap butir baru menghasilkan kalimat untuk 7 jenis keterangan, tiap varian pihak, dan dua saksi`, () => {
      const lama = muat(CAD, `${kunci}.json`);
      const baru = kat.pertanyaan.filter((q: any) => q.id.startsWith(awalan) && !lama.pertanyaan.some((l: any) => l.id === q.id));
      for (const q of baru) {
        const dasar: Record<string, any> = { ...Mesin.keadaanBawaan(kat, {}), kehadiran: "kontradiktoir" };
        for (const [k, v] of Object.entries(q.keadaan || {})) dasar[k] = Array.isArray(v) ? v[0] : v;
        // semua nilai keadaan yang membedakan objek jawaban (mis. pengasuhAnak pengaju atau lawan)
        const pembeda: Record<string, Set<string>> = {};
        for (const v of Object.values(q.jawaban) as any[]) for (const x of Array.isArray(v) ? v : [v]) for (const [k, n] of Object.entries(x.keadaan || {})) (pembeda[k] = pembeda[k] || new Set()).add(String(n));
        const kombinasi: Record<string, any>[] = [dasar];
        for (const [k, nilai] of Object.entries(pembeda)) for (const n of nilai) kombinasi.push({ ...dasar, [k]: n });
        for (const keadaan of kombinasi) {
          for (const jenis of JENIS_KET) {
            for (const ke of [1, 2]) {
              const p = Mesin.pilihJawaban(kat, q, jenis, keadaan, ke, "uji/Pdt.G/2026/PA.Dgl", new Set());
              expect(p, `${q.id}/${jenis}/saksi${ke}/${JSON.stringify(keadaan)}`).toBeTruthy();
              expect(String(p.teks).length, `${q.id}/${jenis}`).toBeGreaterThan(10);
            }
          }
        }
      }
    });
  }
});

describe("data ekstensi sinkron dengan JSON", () => {
  it("saksi-katalog-data.js memuat butir baru ketiga jenis", () => {
    const data = readFileSync(path.join(EK, "saksi-katalog-data.js"), "utf8");
    for (const id of ["q-ha-ibadah-anak", "q-ha-bahaya-kekerasan", "q-pa-cara-dibawa", "q-pa-penuntut-rumah", "q-na-ayah-pegawai", "q-na-nominal-sesuai"]) expect(data).toContain(`"${id}"`);
  });
});
