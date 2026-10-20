// @vitest-environment node
/**
 * ============================================================================
 * AGEN W2b-C / SUB-AGEN MAFQUD + PERMOHONAN UMUM (21 Okt 2026) - BANK TANYA JAWAB SAKSI
 * ============================================================================
 *
 * Perilaku yang dijaga (mesin katalog + pembungkus Blangko Derry dijalankan SUNGGUHAN, murni tanpa DOM):
 *   1. yang sudah ada tidak dihapus/diubah (butir, pokok, dasar hukum, keadaan) dan versi katalog naik satu;
 *   2. butir baru (>= 20 per jenis) hanya muncul pada keadaan yang tepat (status perkawinan, kedudukan pemohon, kepentingan,
 *      harta dan anak yang ditinggalkan; jenis permohonan, jumlah pemohon, kehadiran, pengumuman);
 *   3. kalimat saksi 1 dan saksi 2 berbeda untuk setiap butir baru pada semua tingkat pengetahuan;
 *   4. tingkat dari cerita, sebagian, tidak tahu, ragu, dan mendengar menghasilkan jawaban;
 *   5. tanpa kata "aleta", katalog lolos pemeriksa skema, variabel baru terdeklarasi;
 *   6. (terpisah) berkas data ekstensi memuat butir baru - lulus setelah agen induk membangun ulang saksi-katalog-data.js.
 */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO = path.resolve(process.cwd(), "..");
const EK = path.join(REPO, "ekstensi-sipp");
const FOLDER = path.join(EK, "saksi-katalog");
const PAKET = path.join(REPO, "abt-paket/w2b-keluarga-lain");
const CAD = path.join(PAKET, "cadangan-katalog");
const req = createRequire(import.meta.url);
const muat = (dir: string, n: string) => JSON.parse(readFileSync(path.join(dir, n), "utf8"));

const semua = readdirSync(FOLDER).filter((n) => n.endsWith(".json")).map((n) => muat(FOLDER, n));
(globalThis as any).ALETA_SAKSI_KATALOG_DATA = semua;
const Mesin = req(path.join(EK, "saksi-katalog.js"));
const Bd = req(path.join(EK, "blangko-derry-katalog.js"));

const MF = semua.find((k: any) => k.kunci === "mafqud");
const PU = semua.find((k: any) => k.kunci === "permohonan-umum");

type Opsi = { keadaan?: Record<string, any>; saksi?: any[]; variabel?: Record<string, string>; jarang?: boolean; sebutan?: { P: string; T: string } };
function susun(kat: any, o: Opsi = {}) {
  const hasil = Bd.susun({
    kat,
    sebutan: o.sebutan || { P: "Pemohon", T: "Termohon" },
    benih: "uji/Pdt.P/2026/PA.Dgl",
    keadaan: Bd.lengkapiBawaan(kat, o.keadaan || {}),
    saksi: o.saksi || [{ kunci: "saksi 1 p", pihak: "P" }, { kunci: "saksi 2 p", pihak: "P" }],
    variabel: (k: string) => (k === "7036" ? (o.sebutan || { P: "Pemohon" }).P : (o.variabel || {})[k]),
    jarang: o.jarang,
  });
  expect(hasil.ada).toBe(true);
  return hasil;
}
const idBaris = (h: any, ke = 0) => h.saksi[ke].baris.map((b: any) => b.butir) as string[];
const baris = (h: any, id: string, ke = 0) => h.saksi[ke].baris.find((b: any) => b.butir === id);

const VAR_MF = {
  "9860": "Fulan bin Hamid", "9861": "istri", "9862": "pada tanggal 5 Mei 2015 di Desa Labuan", "9863": "mencari ke rumah kerabat", "9864": "tujuh tahun lamanya",
  "9868": "papan pengumuman selama empat belas hari", "9869": "tidak ada orang yang memberi kabar", "9873": "surat keterangan kehilangan dari kepala desa",
  "4920": "berumur empat puluh tahun bekerja sebagai nelayan dan beralamat terakhir di Desa Labuan", "4921": "istrinya bernama Siti dan dua orang anak",
  "4922": "rumah dan kebun yang dikuasai istrinya", "4923": "merantau untuk bekerja di Kalimantan",
};
const VAR_PU = {
  "0099": "45 tahun", "0100": "petani", "0101": "Desa Labuan", "4930": "penetapan kematian Hamid bin Ali", "4931": "pada tanggal 3 Maret 2020 di Desa Labuan",
  "4932": "surat keterangan kematian dari kepala desa dan Kartu Keluarga", "4933": "mengurus akta kematian pada Dinas Kependudukan dan Pencatatan Sipil",
  "4934": "karena sakit dan dikebumikan di pemakaman umum Desa Labuan",
};

const baruMf = MF.pertanyaan.filter((q: any) => q.id.startsWith("q-mf-"));
const baruPu = PU.pertanyaan.filter((q: any) => q.id.startsWith("q-pu-"));

describe("katalog lama tidak dikurangi", () => {
  for (const [kunci, baru, awalan] of [["mafqud", MF, "q-mf-"], ["permohonan-umum", PU, "q-pu-"]] as const) {
    it(`${kunci}: butir, pokok, dasar hukum, dan keadaan lama utuh; versi naik satu; butir baru >= 20`, () => {
      const lama = muat(CAD, `${kunci}.json`);
      for (const q of lama.pertanyaan) expect(JSON.stringify(baru.pertanyaan.find((x: any) => x.id === q.id)), q.id).toBe(JSON.stringify(q));
      for (const p of lama.pokokPembuktian) expect(JSON.stringify(baru.pokokPembuktian.find((x: any) => x.id === p.id)), p.id).toBe(JSON.stringify(p));
      for (const d of lama.dasarHukum) expect(JSON.stringify(baru.dasarHukum.find((x: any) => x.id === d.id)), d.id).toBe(JSON.stringify(d));
      for (const k of Object.keys(lama.keadaan)) expect(JSON.stringify(baru.keadaan[k]), k).toBe(JSON.stringify(lama.keadaan[k]));
      expect(baru.versi).toBe(lama.versi + 1);
      const tambah = baru.pertanyaan.filter((q: any) => q.id.startsWith(awalan));
      expect(tambah.length).toBeGreaterThanOrEqual(20);
      expect(baru.pertanyaan.length).toBe(lama.pertanyaan.length + tambah.length);
      // urutan unik dan tidak bentrok
      const urut = baru.pertanyaan.map((q: any) => q.urutan);
      expect(new Set(urut).size).toBe(urut.length);
      // catatan petugas lama tetap ada di depan
      expect(baru.catatanPetugas.slice(0, lama.catatanPetugas.length)).toEqual(lama.catatanPetugas);
    });
  }
  it("pokok butir baru mengacu pokok yang ada, dan tiap pokok baru dipakai butir", () => {
    for (const [kat, awalan] of [[MF, "pp-mf-"], [PU, "pp-pu-"]] as const) {
      const baruPokok = kat.pokokPembuktian.filter((p: any) => p.id.startsWith(awalan));
      expect(baruPokok.length).toBeGreaterThanOrEqual(15);
      for (const p of baruPokok) expect(kat.pertanyaan.some((q: any) => q.pokok === p.id), p.id).toBe(true);
    }
  });
  it("tingkat inti hanya untuk butir yang wajib; kehadiran (verstek dsb.) tidak dipakai pada permohonan voluntair", () => {
    expect(baruMf.filter((q: any) => q.tingkat === "inti").map((q: any) => q.id)).toEqual(["q-mf-tak-ada-pihak-tahu-mf"]);
    expect(baruPu.filter((q: any) => q.tingkat === "inti").map((q: any) => q.id).sort()).toEqual(["q-pu-mati-keperluan-pu", "q-pu-mati-tanggal-tempat-pu"]);
    for (const q of [...baruMf, ...baruPu]) expect(Object.keys(q.keadaan)).not.toContain("kehadiran");
  });
});

describe("mafqud: butir baru menurut keadaan", () => {
  it("keadaan bawaan: pasangan, menikah, harta dan anak ada, kepentingan A", () => {
    const h = susun(MF, { variabel: VAR_MF });
    expect(idBaris(h)).toEqual(expect.arrayContaining(["q-mf-kedudukan-pasangan-mf", "q-mf-status-menikah-mf", "q-mf-anak-ditinggal-mf", "q-mf-harta-ditinggal-mf", "q-mf-identitas-mf", "q-mf-sebab-pergi-mf", "q-mf-tak-ada-pihak-tahu-mf"]));
    for (const id of ["q-mf-status-belum-menikah-mf", "q-mf-kedudukan-anak-mf", "q-mf-kedudukan-saudara-mf", "q-mf-ahli-waris-lain-mf", "q-mf-kawin-kembali-mf"]) expect(idBaris(h), id).not.toContain(id);
    expect(baris(h, "q-mf-identitas-mf").jawab).toContain("nelayan");
    expect(baris(h, "q-mf-status-menikah-mf").jawab).toContain("dua orang anak");
    expect(baris(h, "q-mf-sebab-pergi-mf").jawab).toContain("Kalimantan");
  });
  it("status perkawinan orang yang hilang memilih salah satu butir", () => {
    const h = susun(MF, { keadaan: { statusNikahHilang: "belum-menikah" }, variabel: VAR_MF });
    expect(idBaris(h)).toContain("q-mf-status-belum-menikah-mf");
    expect(idBaris(h)).not.toContain("q-mf-status-menikah-mf");
    expect(baris(h, "q-mf-status-belum-menikah-mf").jawab).toMatch(/belum/);
  });
  it("kedudukan pemohon: anak, saudara, dan ahli waris lain memilih butir kedudukan yang sesuai", () => {
    const anak = susun(MF, { keadaan: { kedudukanPemohon: "anak" }, variabel: VAR_MF });
    expect(idBaris(anak)).toContain("q-mf-kedudukan-anak-mf");
    expect(idBaris(anak)).not.toContain("q-mf-kedudukan-pasangan-mf");
    for (const n of ["saudara", "ahli-waris-lain"]) {
      const h = susun(MF, { keadaan: { kedudukanPemohon: n }, variabel: VAR_MF });
      expect(idBaris(h), n).toContain("q-mf-kedudukan-saudara-mf");
      expect(baris(h, "q-mf-kedudukan-saudara-mf").jawab).toContain("istri");
    }
  });
  it("kepentingan pewarisan menambah butir ahli waris lain; menikah kembali hanya pada kepentingan lain jenis itu", () => {
    const b = susun(MF, { keadaan: { kepentingan: ["B"] }, variabel: VAR_MF });
    expect(idBaris(b)).toContain("q-mf-ahli-waris-lain-mf");
    const c1 = susun(MF, { keadaan: { kepentingan: ["C"], kepentinganLain: "urusan-lain" }, variabel: VAR_MF });
    expect(idBaris(c1)).not.toContain("q-mf-kawin-kembali-mf");
    const c2 = susun(MF, { keadaan: { kepentingan: ["C"], kepentinganLain: "kawin-kembali" }, variabel: VAR_MF });
    expect(idBaris(c2)).toContain("q-mf-kawin-kembali-mf");
    expect(baris(c2, "q-mf-kawin-kembali-mf").jawab).toMatch(/menikah|perkawinan|kawin/);
  });
  it("tanpa harta atau tanpa anak yang ditinggalkan: butir harta dan anak tidak muncul", () => {
    const h = susun(MF, { keadaan: { hartaDitinggal: "tidak-ada", anakDitinggal: "tidak-ada" }, variabel: VAR_MF, jarang: true });
    for (const id of ["q-mf-harta-ditinggal-mf", "q-mf-harta-dialihkan-mf", "q-mf-anak-ditinggal-mf"]) expect(idBaris(h), id).not.toContain(id);
    const ada = susun(MF, { variabel: VAR_MF, jarang: true });
    expect(idBaris(ada)).toContain("q-mf-harta-dialihkan-mf");
  });
  it("pertanyaan yang jarang hanya muncul bila diminta", () => {
    const biasa = idBaris(susun(MF, { variabel: VAR_MF }));
    const jarang = idBaris(susun(MF, { variabel: VAR_MF, jarang: true }));
    for (const id of ["q-mf-pernah-pulang-mf", "q-mf-cari-luas-mf"]) {
      expect(biasa).not.toContain(id);
      expect(jarang).toContain(id);
    }
  });
});

describe("permohonan umum: butir baru menurut keadaan", () => {
  it("keadaan bawaan: satu pemohon, jenis umum, hadir sendiri, tanpa pengumuman", () => {
    const h = susun(PU, { variabel: VAR_PU });
    expect(idBaris(h)).toEqual(expect.arrayContaining(["q-pu-identitas-pu", "q-pu-kepentingan-hukum-pu", "q-pu-waktu-tempat-pu", "q-pu-bukti-surat-pu", "q-pu-sengketa-pu", "q-pu-alasan-baru-pu", "q-pu-akibat-pu", "q-pu-tujuan-instansi-pu"]));
    for (const id of ["q-pu-dua-hubungan-pu", "q-pu-diwakili-kuasa-pu", "q-pu-pengumuman-pu", "q-pu-mati-tanggal-tempat-pu", "q-pu-status-dimohon-pu"]) expect(idBaris(h), id).not.toContain(id);
    expect(baris(h, "q-pu-identitas-pu").jawab).toContain("petani");
    expect(baris(h, "q-pu-waktu-tempat-pu").jawab).toContain("3 Maret 2020");
  });
  it("penetapan kematian: butir khusus kematian muncul dan butir umum yang sama pokoknya digantikan", () => {
    const h = susun(PU, { keadaan: { jenisPermohonan: "kematian" }, variabel: VAR_PU });
    const id = idBaris(h);
    expect(id).toEqual(expect.arrayContaining(["q-pu-mati-tanggal-tempat-pu", "q-pu-mati-sebab-makam-pu", "q-pu-mati-surat-pu", "q-pu-mati-saksi-hadir-pu", "q-pu-mati-alasan-baru-pu", "q-pu-mati-ahli-waris-pu", "q-pu-mati-keperluan-pu"]));
    for (const x of ["q-pu-waktu-tempat-pu", "q-pu-alasan-baru-pu", "q-pu-tujuan-instansi-pu", "q-pu-bukti-surat-pu"]) expect(id, x).not.toContain(x);
    expect(baris(h, "q-pu-mati-tanggal-tempat-pu").jawab).toContain("3 Maret 2020");
    expect(baris(h, "q-pu-mati-sebab-makam-pu").jawab).toContain("dikebumikan");
    expect(baris(h, "q-pu-mati-surat-pu").jawab).toContain("kepala desa");
    expect(baris(h, "q-pu-mati-keperluan-pu").jawab).toContain("akta kematian");
    for (const j of ["umum", "lain-lain"]) expect(idBaris(susun(PU, { keadaan: { jenisPermohonan: j }, variabel: VAR_PU })), j).not.toContain("q-pu-mati-sebab-makam-pu");
  });
  it("status hukum, dua pemohon, pemohon diwakili, dan pengumuman memilih butirnya masing-masing", () => {
    expect(idBaris(susun(PU, { keadaan: { jenisPermohonan: "status-hukum" }, variabel: VAR_PU }))).toEqual(expect.arrayContaining(["q-pu-status-dimohon-pu", "q-pu-status-dikenal-pu"]));
    const dua = susun(PU, { keadaan: { jumlahPemohon: "dua" }, variabel: VAR_PU, sebutan: { P: "Para Pemohon", T: "Termohon" } });
    expect(idBaris(dua)).toEqual(expect.arrayContaining(["q-pu-dua-hubungan-pu", "q-pu-dua-sepakat-pu"]));
    expect(idBaris(dua)).not.toContain("q-pu-identitas-pu");
    expect(baris(dua, "q-pu-dua-hubungan-pu").jawab).toContain("Para Pemohon");
    expect(idBaris(susun(PU, { keadaan: { kehadiranPemohon: "diwakili" }, variabel: VAR_PU, jarang: true }))).toContain("q-pu-diwakili-kuasa-pu");
    expect(idBaris(susun(PU, { keadaan: { pengumuman: "ada" }, variabel: VAR_PU, jarang: true }))).toContain("q-pu-pengumuman-pu");
  });
});

describe("kalimat saksi 1 dan saksi 2 berbeda di semua tingkat pengetahuan", () => {
  for (const [nama, daftar] of [["mafqud", baruMf], ["permohonan-umum", baruPu]] as const) {
    it(`${nama}: tiap butir baru punya >= 4 varian per saksi, tanpa kalimat sama, tanpa kata "aleta"`, () => {
      for (const q of daftar) {
        expect(Object.keys(q.jawaban)).toEqual(expect.arrayContaining(q.kelompok === "hubungan" ? ["melihat"] : ["melihat", "de-auditu", "sebagian", "berbeda"]));
        for (const [jenis, v] of Object.entries(q.jawaban) as [string, any][]) {
          for (const x of Array.isArray(v) ? v : [v]) {
            expect(x.saksi1.length, `${q.id}/${jenis}`).toBeGreaterThanOrEqual(4);
            expect(x.saksi2.length, `${q.id}/${jenis}`).toBeGreaterThanOrEqual(4);
            if (jenis !== "berbeda") for (const a of x.saksi1) for (const b of x.saksi2) expect(a, `${q.id}/${jenis}`).not.toBe(b);
            else for (const a of x.saksi1) for (const b of x.saksi2) expect(a, `${q.id}/berbeda`).not.toBe(b);
          }
        }
        expect(JSON.stringify(q)).not.toMatch(/aleta/i);
        expect(q.pihakSaksi).toEqual(["*"]);
      }
    });
  }
  it("mafqud: tingkat dari cerita, sebagian, tidak tahu, dan ragu menghasilkan jawaban yang berbeda antar saksi", () => {
    for (const jenis of ["de-auditu", "sebagian", "tidak-tahu", "ragu"]) {
      const h = susun(MF, { variabel: VAR_MF, saksi: [{ kunci: "saksi 1 p", pihak: "P", jenis, sumber: "tetangga" }, { kunci: "saksi 2 p", pihak: "P", jenis, sumber: "keluarga" }] });
      for (const id of ["q-mf-sebab-pergi-mf", "q-mf-tak-ada-pihak-tahu-mf", "q-mf-kontak-putus-mf", "q-mf-cari-keluarga-mf"]) {
        const b = baris(h, id);
        expect(b.jawab.length, `${jenis}/${id}`).toBeGreaterThan(10);
        expect(b.jawab, `${jenis}/${id}`).not.toBe(baris(h, id, 1).jawab);
      }
    }
  });
  it("permohonan umum: tingkat dari cerita, sebagian, tidak tahu, dan ragu menghasilkan jawaban yang berbeda antar saksi", () => {
    for (const jenis of ["de-auditu", "sebagian", "tidak-tahu", "ragu"]) {
      const h = susun(PU, { variabel: VAR_PU, saksi: [{ kunci: "saksi 1 p", pihak: "P", jenis, sumber: "tetangga" }, { kunci: "saksi 2 p", pihak: "P", jenis, sumber: "keluarga" }] });
      for (const id of ["q-pu-kepentingan-hukum-pu", "q-pu-sengketa-pu", "q-pu-pihak-lain-pu", "q-pu-akibat-pu"]) {
        const b = baris(h, id);
        expect(b.jawab.length, `${jenis}/${id}`).toBeGreaterThan(10);
        expect(b.jawab, `${jenis}/${id}`).not.toBe(baris(h, id, 1).jawab);
      }
    }
  });
  it("jawaban 'mendengar' tulis tangan tersedia pada butir ucapan dan tidak memakai 'para pihak'", () => {
    const mf = ["q-mf-sebab-pergi-mf", "q-mf-pamit-bekal-mf", "q-mf-keberatan-keluarga-mf", "q-mf-kesanggupan-mf"];
    const pu = ["q-pu-dua-sepakat-pu", "q-pu-persetujuan-pu"];
    for (const [kat, ids] of [[MF, mf], [PU, pu]] as const) {
      for (const id of ids) {
        const q = kat.pertanyaan.find((x: any) => x.id === id);
        expect(q.jawaban.mendengar, id).toBeTruthy();
        expect(JSON.stringify(q.jawaban.mendengar), id).not.toMatch(/para pihak/);
        expect(q.jawaban.mendengar.saksi1.length).toBe(4);
        expect(q.jawaban.mendengar.saksi2.length).toBe(4);
      }
    }
    const h = susun(MF, { variabel: VAR_MF, saksi: [{ kunci: "saksi 1 p", pihak: "P", jenis: "mendengar" }, { kunci: "saksi 2 p", pihak: "P", jenis: "mendengar" }] });
    expect(baris(h, "q-mf-pamit-bekal-mf").jawab).toMatch(/dengar|ucapan|perkataan|berkata|mengatakan/);
    expect(baris(h, "q-mf-pamit-bekal-mf").jawab).not.toBe(baris(h, "q-mf-pamit-bekal-mf", 1).jawab);
  });
});

describe("skema, dasar hukum, dan variabel baru", () => {
  it("kedua katalog lolos pemeriksa skema tanpa galat (rujukan perlu-verifikasi tidak tercetak, tanpa kata aleta)", () => {
    for (const kat of [MF, PU]) {
      const r = Mesin.periksaKatalog(kat, { namaBerkas: `${kat.kunci}.json`, variabelAda: null });
      expect(r.galat, kat.kunci).toEqual([]);
      expect(JSON.stringify(kat)).not.toMatch(/aleta/i);
    }
  });
  it("dasar hukum baru permohonan umum berstatus perlu-verifikasi; mafqud tidak menambah dasar hukum", () => {
    const lamaPu = muat(CAD, "permohonan-umum.json");
    const baruDh = PU.dasarHukum.filter((d: any) => !lamaPu.dasarHukum.some((x: any) => x.id === d.id));
    expect(baruDh.map((d: any) => d.id).sort()).toEqual(["dh-adminduk-kematian", "dh-akta-otentik"]);
    for (const d of baruDh) expect(d.status).toBe("perlu-verifikasi");
    expect(MF.dasarHukum.length).toBe(muat(CAD, "mafqud.json").dasarHukum.length);
  });
  it("variabel isian baru terdeklarasi di variabelBaru dan didefinisikan dalam jatah nomor", () => {
    expect(MF.variabelBaru).toEqual(expect.arrayContaining(["4920", "4921", "4922", "4923"]));
    expect(PU.variabelBaru).toEqual(expect.arrayContaining(["4930", "4931", "4932", "4933", "4934"]));
    const def = (berkas: string) => Array.from(readFileSync(path.join(PAKET, "sumber", berkas), "utf8").matchAll(/^v\((\d+),/gm)).map((m) => m[1]);
    expect(def("variabel_lain_mafqud.py")).toEqual(["4920", "4921", "4922", "4923"]);
    expect(def("variabel_lain_umum.py")).toEqual(["4930", "4931", "4932", "4933", "4934"]);
    // setiap penanda butir baru: variabel lama (kamus) atau variabelBaru; nomor baru yang dipakai selalu dalam jatah
    for (const [kat, daftar, jatah] of [[MF, baruMf, /^49(2[0-3])$/], [PU, baruPu, /^49(3[0-4])$/]] as const) {
      const dipakai = new Set<string>(daftar.flatMap((q: any) => q.variabelAbt));
      for (const k of dipakai) if (/^49/.test(k) || /^48/.test(k)) expect(k, `${kat.kunci} memakai ${k}`).toMatch(jatah);
      for (const k of kat.variabelBaru) expect(dipakai.has(k) || kat.pertanyaan.some((q: any) => q.variabelAbt.includes(k)), k).toBe(true);
    }
  });
});

describe("data ekstensi sinkron dengan JSON", () => {
  it("saksi-katalog-data.js memuat butir baru (lulus setelah agen induk membangun ulang data ekstensi)", () => {
    const data = readFileSync(path.join(EK, "saksi-katalog-data.js"), "utf8");
    for (const id of ["q-mf-identitas-mf", "q-mf-tak-ada-pihak-tahu-mf", "q-pu-kepentingan-hukum-pu", "q-pu-mati-tanggal-tempat-pu"]) expect(data).toContain(`"${id}"`);
  });
});
