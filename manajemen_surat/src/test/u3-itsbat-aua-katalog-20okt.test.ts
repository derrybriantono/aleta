// @vitest-environment node
/**
 * ============================================================================
 * AGEN U3 (20 Okt 2026) - BANK TANYA JAWAB SAKSI ITSBAT NIKAH, ASAL USUL ANAK, KUMULASI ITSBAT
 * ============================================================================
 *
 * Perilaku yang dijaga (mesin katalog + pembungkus Blangko Derry dijalankan SUNGGUHAN, murni tanpa DOM):
 *   1. yang sudah ada tidak dihapus (butir, pokok, dasar hukum, keadaan) dan versi katalog naik;
 *   2. butir baru hanya muncul pada keadaan yang tepat (dasar itsbat Pasal 7 ayat (3), saksi istifadhah, satu pemohon yang
 *      pasangannya meninggal, perkawinan siri asal usul anak, anak lahir kurang enam bulan, pemohon ibu saja);
 *   3. kalimat saksi 1 dan saksi 2 berbeda untuk setiap butir baru pada semua tingkat pengetahuan;
 *   4. peran saksi (saksi nikah, wali nikah) mengubah jawaban menjadi kesaksian orang pertama;
 *   5. kumulasi cerai + itsbat hanya mengambil bagian itsbatnya;
 *   6. berkas data ekstensi memuat butir baru (sinkron dengan JSON).
 */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO = path.resolve(process.cwd(), "..");
const EK = path.join(REPO, "ekstensi-sipp");
const FOLDER = path.join(EK, "saksi-katalog");
const CAD = path.join(REPO, "abt-paket/u3-itsbat-aua/cadangan-katalog");
const req = createRequire(import.meta.url);
const muat = (dir: string, n: string) => JSON.parse(readFileSync(path.join(dir, n), "utf8"));

const semua = readdirSync(FOLDER).filter((n) => n.endsWith(".json")).map((n) => muat(FOLDER, n));
(globalThis as any).ALETA_SAKSI_KATALOG_DATA = semua;
const Mesin = req(path.join(EK, "saksi-katalog.js"));
const Bd = req(path.join(EK, "blangko-derry-katalog.js"));

const IN = semua.find((k: any) => k.kunci === "itsbat-nikah");
const AUA = semua.find((k: any) => k.kunci === "asal-usul-anak");
const KM = semua.find((k: any) => k.kunci === "cerai-kumulasi-itsbat");
const CG = semua.find((k: any) => k.kunci === "cerai-gugat");

type Opsi = { keadaan?: Record<string, any>; saksi?: any[]; variabel?: Record<string, string>; jarang?: boolean; sebutan?: { P: string; T: string } };
function susun(kat: any, o: Opsi = {}) {
  const hasil = Bd.susun({
    kat,
    sebutan: o.sebutan || { P: "Pemohon", T: "Termohon" },
    benih: "uji/Pdt.P/2026/PA.Dgl",
    keadaan: Bd.lengkapiBawaan(kat, o.keadaan || {}),
    saksi: o.saksi || [{ kunci: "saksi 1 p", pihak: "P" }, { kunci: "saksi 2 p", pihak: "P" }],
    variabel: (k: string) => (o.variabel || {})[k],
    jarang: o.jarang,
  });
  expect(hasil.ada).toBe(true);
  return hasil;
}
const idBaris = (h: any, ke = 0) => h.saksi[ke].baris.map((b: any) => b.butir) as string[];
const baris = (h: any, id: string, ke = 0) => h.saksi[ke].baris.find((b: any) => b.butir === id);

const VAR = { "1046": "Ayah Kandung Pemohon II", "1217": "Samsul", "8087": "Imam Desa Ahmad", "0650": "Asdar", "0651": "Indrawan", "5197": "02 Oktober 2022", "5105": "Desa Labuan", "5178": "Kantor Urusan Agama Kecamatan Labuan", "1001": "seperangkat alat salat", "7211": "21 tahun", "7212": "19 tahun", "1002": "Perjaka", "1003": "Perawan", "8171": "mengurus buku nikah", "0228": "belum lahir saat akad", "0101": "Desa Labuan", "1358": "tidak melaporkan pernikahannya ke Pegawai Pencatat Nikah", "8602": "Iki Rafael bin Amir", "9709": "di Tibo pada tanggal 18 Agustus 2019", "9710": "pernikahan belum dicatat saat anak lahir", "4311": "Hamid", "4310": "Nomor 12/Pdt.P/2025/PA.Dgl tanggal 3 Maret 2025", "8605": "pada tanggal 20 April 2026 di KUA Sindue", "1025": "Hasan bin Ali" };

describe("katalog lama tidak dikurangi", () => {
  for (const [kunci, baru] of [["itsbat-nikah", IN], ["asal-usul-anak", AUA], ["cerai-kumulasi-itsbat", KM]] as const) {
    it(`${kunci}: butir, pokok, dasar hukum, dan keadaan lama utuh; versi naik satu`, () => {
      const lama = muat(CAD, `${kunci}.json`);
      const ids = new Set(baru.pertanyaan.map((q: any) => q.id));
      for (const q of lama.pertanyaan) expect(ids.has(q.id), `${kunci} kehilangan ${q.id}`).toBe(true);
      for (const p of lama.pokokPembuktian) expect(baru.pokokPembuktian.some((x: any) => x.id === p.id), p.id).toBe(true);
      for (const d of lama.dasarHukum) expect(baru.dasarHukum.some((x: any) => x.id === d.id), d.id).toBe(true);
      for (const k of Object.keys(lama.keadaan)) expect(baru.keadaan[k]).toBeTruthy();
      expect(baru.versi).toBe(lama.versi + 1);
      expect(baru.pertanyaan.length).toBeGreaterThan(lama.pertanyaan.length);
      // butir lama tidak berubah isinya
      for (const q of lama.pertanyaan) expect(JSON.stringify(baru.pertanyaan.find((x: any) => x.id === q.id))).toBe(JSON.stringify(q));
    });
  }
  it("jumlah butir per saksi pada itsbat dua pemohon naik dari 20 menjadi 28 (tingkat bawaan)", () => {
    const lama = muat(CAD, "itsbat-nikah.json");
    const hitung = (kat: any) => susun(kat, { keadaan: { bentuk: "permohonan-berdua" } }).saksi[0].baris.length;
    // 23 Okt (T2, keputusan pengguna): butir penutup tidak lagi disusun/ditampilkan - satu butir lebih sedikit pada
    // keduanya; tambahan 8 butir katalog baru tetap utuh.
    expect(hitung(lama)).toBe(19);
    expect(hitung(IN)).toBe(27);
    expect(susun(IN, { keadaan: { bentuk: "permohonan-berdua" } }).saksi[0].baris.some((b: any) => /penutup/.test(String(b.butir)))).toBe(false);
  });
});

describe("itsbat nikah: butir baru menurut keadaan", () => {
  const dua = { bentuk: "permohonan-berdua" };
  it("dasar itsbat Pasal 7 ayat (3): huruf e bawaan tanpa butir khusus; huruf d menanyakan sebelum UU 1/1974", () => {
    const e = susun(IN, { keadaan: dua, variabel: VAR });
    expect(idBaris(e)).not.toContain("q-in-dasar-d-pb");
    const d = susun(IN, { keadaan: { ...dua, dasarItsbat: "huruf-d" }, variabel: VAR });
    expect(idBaris(d)).toContain("q-in-dasar-d-pb");
    expect(baris(d, "q-in-dasar-d-pb").jawab).toMatch(/1974/);
    for (const h of ["a", "b", "c"]) expect(idBaris(susun(IN, { keadaan: { ...dua, dasarItsbat: `huruf-${h}` }, variabel: VAR }))).toContain(`q-in-dasar-${h}-pb`);
  });
  it("saksi istifadhah: butir kabar yang tersiar luas hanya pada pilihan istifadhah, dengan alasan tidak hadir dari isian 0228", () => {
    expect(idBaris(susun(IN, { keadaan: dua, variabel: VAR }))).not.toContain("q-in-kabar-luas-pb");
    const h = susun(IN, { keadaan: { ...dua, bentukKesaksian: "istifadhah" }, variabel: VAR });
    expect(idBaris(h)).toEqual(expect.arrayContaining(["q-in-kenal-masyarakat-pb", "q-in-kabar-luas-pb", "q-in-sebab-tidak-hadir-akad-pb"]));
    expect(baris(h, "q-in-sebab-tidak-hadir-akad-pb").jawab).toContain("belum lahir saat akad");
  });
  it("syarat wali dan saksi nikah ada pada keadaan bawaan, jawabannya memuat fakta isian", () => {
    const h = susun(IN, { keadaan: dua, variabel: VAR });
    for (const id of ["q-in-wali-syarat-pb", "q-in-saksi-syarat-pb", "q-in-saksi-hadir-pb", "q-in-persetujuan-pb"]) expect(idBaris(h), id).toContain(id);
    expect(baris(h, "q-in-wali-syarat-pb").jawab).toContain("Samsul");
    expect(baris(h, "q-in-saksi-syarat-pb").jawab).toMatch(/Asdar/);
  });
  it("peran saksi nikah dan wali nikah menjadi kesaksian orang pertama", () => {
    const sn = susun(IN, { keadaan: dua, variabel: VAR, saksi: [{ kunci: "saksi 1 p", pihak: "P", keadaan: { kedudukanSaksi: "saksi-nikah" } }, { kunci: "saksi 2 p", pihak: "P" }] });
    expect(baris(sn, "q-in-saksi-hadir-pb").jawab).toMatch(/\bsaya\b.*saksi nikah|saksi nikah.*\bsaya\b/);
    const wn = susun(IN, { keadaan: dua, variabel: VAR, saksi: [{ kunci: "saksi 1 p", pihak: "P", keadaan: { kedudukanSaksi: "wali-nikah" } }, { kunci: "saksi 2 p", pihak: "P" }] });
    expect(baris(wn, "q-in-wali-syarat-pb").jawab).toMatch(/\bsaya\b/);
    expect(baris(wn, "q-in-wali-syarat-pb").jawab).not.toBe(baris(wn, "q-in-wali-syarat-pb", 1).jawab);
  });
  it("satu pemohon yang pasangannya meninggal: butir hak yang diurus dan kematian hanya pada bentuk itu", () => {
    const sendiri = susun(IN, { keadaan: { bentuk: "permohonan-sendiri" }, variabel: VAR });
    expect(idBaris(sendiri)).toEqual(expect.arrayContaining(["q-in-hak-pasangan-pm", "q-in-meninggal-pm", "q-in-wali-syarat-pm"]));
    expect(idBaris(susun(IN, { keadaan: dua, variabel: VAR }))).not.toContain("q-in-hak-pasangan-pm");
    expect(baris(sendiri, "q-in-hak-pasangan-pm").jawab).toContain("Hasan bin Ali");
  });
  it("gugatan (kontensius) memakai butir bentuk gugatan dan sebutan Penggugat dan Tergugat", () => {
    const h = susun(IN, { keadaan: { bentuk: "gugatan", kehadiran: "kontradiktoir" }, sebutan: { P: "Penggugat", T: "Tergugat" }, variabel: VAR });
    expect(idBaris(h)).toContain("q-in-wali-syarat-lw");
    expect(baris(h, "q-in-wali-syarat-lw").tanya).toMatch(/mempelai perempuan/);
  });
  it("kalimat saksi 1 dan saksi 2 berbeda untuk semua butir baru di semua tingkat pengetahuan", () => {
    const baru = IN.pertanyaan.filter((q: any) => /^q-in-(persetujuan|hadirin|wali-syarat|wali-urutan|saksi-syarat|saksi-hadir|saksi-adil|kabul-pribadi|mahar-serah|iddah|nikah-terdahulu|hidup-bersama|kenal-masyarakat|kabar-luas|sebab-tidak-hadir-akad|dasar-[a-d]|hak-pasangan|ket-kua|umur-dispensasi)-/.test(q.id));
    expect(baru.length).toBeGreaterThanOrEqual(60);
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
  it("tingkat pengetahuan 'dari cerita', 'sebagian', 'tidak tahu', dan 'ragu' menghasilkan jawaban pada butir baru", () => {
    for (const jenis of ["de-auditu", "sebagian", "tidak-tahu", "ragu"]) {
      const h = susun(IN, { keadaan: dua, variabel: VAR, saksi: [{ kunci: "saksi 1 p", pihak: "P", jenis, sumber: "tetangga" }, { kunci: "saksi 2 p", pihak: "P", jenis, sumber: "keluarga" }] });
      const b = baris(h, "q-in-wali-syarat-pb");
      expect(b.jawab.length, jenis).toBeGreaterThan(10);
      expect(b.jawab, jenis).not.toBe(baris(h, "q-in-wali-syarat-pb", 1).jawab);
    }
  });
});

describe("asal usul anak: butir baru menurut keadaan perkawinan, waktu lahir, dan pemohon", () => {
  const dasar = { pemohon: "suami-istri", perkawinan: "sirri-dicatat-kemudian", waktuLahir: "sesudah-enam-bulan" };
  it("siri dicatat kemudian: butir penetapan itsbat dan pencatatan; dicatat sebelum lahir: tidak", () => {
    const a = susun(AUA, { keadaan: dasar, variabel: VAR });
    expect(idBaris(a)).toEqual(expect.arrayContaining(["q-aua-itsbat-ortu-ua", "q-aua-dicatat-kemudian-ua", "q-aua-pengakuan-ua", "q-aua-bukti-lahir-ua", "q-aua-akta-belum-ua"]));
    expect(baris(a, "q-aua-itsbat-ortu-ua").jawab).toContain("12/Pdt.P/2025/PA.Dgl");
    expect(idBaris(susun(AUA, { keadaan: { ...dasar, perkawinan: "dicatat-sebelum-lahir" }, variabel: VAR }))).not.toContain("q-aua-itsbat-ortu-ua");
    expect(idBaris(susun(AUA, { keadaan: { ...dasar, perkawinan: "sirri-belum-dicatat" }, variabel: VAR }))).toContain("q-aua-belum-catat-ua");
  });
  it("anak lahir kurang dari enam bulan menambah butir jarak akad dan kehamilan", () => {
    expect(idBaris(susun(AUA, { keadaan: dasar, variabel: VAR }))).not.toContain("q-aua-enam-bulan-ua");
    const k = susun(AUA, { keadaan: { ...dasar, waktuLahir: "kurang-enam-bulan" }, variabel: VAR });
    expect(idBaris(k)).toEqual(expect.arrayContaining(["q-aua-enam-bulan-ua", "q-aua-hamil-akad-ua"]));
    expect(baris(k, "q-aua-enam-bulan-ua").jawab).toMatch(/kurang dari enam bulan/);
  });
  it("pemohon ibu saja: butir ayah biologis dan pengenalan anak, tanpa butir suami istri", () => {
    const i = susun(AUA, { keadaan: { ...dasar, pemohon: "ibu-saja" }, variabel: VAR, jarang: true });
    const id = idBaris(i);
    expect(id).toEqual(expect.arrayContaining(["q-aua-ayah-biologis-ui", "q-aua-dikenal-anak-ui"]));
    expect(id).not.toContain("q-aua-pengakuan-ua");
    expect(baris(i, "q-aua-ayah-biologis-ui").jawab).toContain("Hamid");
  });
  it("butir baru asal usul anak: kalimat dua saksi berbeda dan jawaban 'ragu' tersedia", () => {
    const h = susun(AUA, { keadaan: dasar, variabel: VAR, saksi: [{ kunci: "saksi 1 p", pihak: "P", jenis: "ragu" }, { kunci: "saksi 2 p", pihak: "P", jenis: "ragu" }] });
    for (const id of ["q-aua-pengakuan-ua", "q-aua-bukti-lahir-ua"]) {
      expect(baris(h, id).jawab.length).toBeGreaterThan(10);
      expect(baris(h, id).jawab).not.toBe(baris(h, id, 1).jawab);
    }
  });
});

describe("kumulasi cerai + itsbat nikah hanya mengambil bagian itsbatnya", () => {
  it("katalog tambahan digabung ke cerai gugat; butir itsbat baru tampil hanya pada kumulasi itsbat-nikah", () => {
    const gabung = Mesin.gabungKatalog(CG, semua);
    expect(gabung.pertanyaan.some((q: any) => q.id === "q-in-wali-syarat-km")).toBe(true);
    const tanpa = Mesin.pertanyaanAktif(gabung, { ...Mesin.keadaanBawaan(gabung, {}), kehadiran: "kontradiktoir" }, "P", { tingkat: ["inti", "pilihan", "tambahan"] });
    expect(tanpa.some((q: any) => q.id === "q-in-wali-syarat-km")).toBe(false);
    const dengan = Mesin.pertanyaanAktif(gabung, { ...Mesin.keadaanBawaan(gabung, {}), kehadiran: "kontradiktoir", kumulasi: ["itsbat-nikah"] }, "P", { tingkat: ["inti", "pilihan", "tambahan"] });
    expect(dengan.some((q: any) => q.id === "q-in-wali-syarat-km")).toBe(true);
    expect(dengan.some((q: any) => q.id === "q-in-saksi-hadir-km")).toBe(true);
  });
});

describe("data ekstensi sinkron dengan JSON", () => {
  it("saksi-katalog-data.js memuat butir baru dan variabel baru dideklarasikan", () => {
    const data = readFileSync(path.join(EK, "saksi-katalog-data.js"), "utf8");
    for (const id of ["q-in-wali-syarat-pb", "q-in-kenal-masyarakat-pm", "q-aua-itsbat-ortu-ua", "q-in-dasar-a-km"]) expect(data).toContain(`"${id}"`);
    expect(IN.variabelBaru).toEqual(expect.arrayContaining(["4301", "4302"]));
    expect(AUA.variabelBaru).toEqual(expect.arrayContaining(["4310", "4311"]));
    expect(JSON.stringify([IN, AUA, KM])).not.toMatch(/aleta/i);
  });
});
