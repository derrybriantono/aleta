// @vitest-environment node
/**
 * ============================================================================
 * AGEN W2b-C (21 Okt 2026) - ISIAN OTOMATIS BERDASAR: pengangkatan anak, mafqud, penetapan kematian (permohonan umum)
 * ============================================================================
 * Pembaca aleta_bot/services/isiOtomatisW2b/lain.js dijalankan SUNGGUHAN atas posita/petitum nyata dari SIPP lokal
 * (abt-paket/w2b-keluarga-lain/data-uji/lain-posita.json, 19 perkara Lain-Lain, NIK disamarkan) dan fixture mafqud buatan
 * (tidak ada perkara mafqud nyata di PA Donggala):
 *   1. perkara pengangkatan anak nyata terbaca: sejak kapan diasuh, alasan penyerahan, riwayat perkawinan, izin instansi sosial,
 *      penghasilan, tujuan - SEMUA berkeyakinan "ragu" (saran), tersambung dengan satu baris di isiOtomatisJenisS6;
 *   2. perkara Lain-Lain yang bukan keluarga ini (hak asuh, perwalian, ahli waris) tidak menerima usulan;
 *   3. penetapan kematian terbaca (hal, tanggal, sebab dan makam, keperluan); isian penilaian hakim menjadi "diisi manual";
 *   4. mafqud buatan terbaca; teks tanpa tanda mafqud tidak dibaca sebagai mafqud;
 *   5. tanpa kata aleta; jenis perkara lain tidak tersentuh.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const req = createRequire(path.join(AKAR, "aleta_bot", "package.json"));
const L = req(path.join(AKAR, "aleta_bot", "services", "isiOtomatisW2b", "lain.js"));
const S6 = req(path.join(AKAR, "aleta_bot", "services", "isiOtomatisJenisS6.js"));
const data: { nomor: string; alur: string; posita: string; petitum: string }[] = JSON.parse(readFileSync(path.join(AKAR, "abt-paket", "w2b-keluarga-lain", "data-uji", "lain-posita.json"), "utf8"));
const gold: Record<string, Record<string, string[]>> = JSON.parse(readFileSync(path.join(AKAR, "abt-paket", "w2b-keluarga-lain", "data-uji", "lain-gold.json"), "utf8"));

const perkara = (nomor: string) => data.find((p) => p.nomor.startsWith(nomor + "/"))!;
const butir = S6.butir; // pembuat usulan asli isiOtomatisJenisS6 (jagaIsianLama, sumber, manual)
const usul = (p: { posita: string; petitum: string; alur: string }) => L.usulanLain({ jenisPerkaraId: 369, posita: p.posita, petitum: p.petitum, alur: p.alur }, butir) as any[];
const peta = (p: any) => Object.fromEntries(usul(p).filter((u) => u.keyakinan !== "tidak_ada_sumber").map((u) => [u.kode, u.nilai]));

const POSITA_MAFQUD =
  "<p>Bahwa Fulan bin Hamid, berumur 45 tahun, bekerja sebagai nelayan, beralamat terakhir di Desa Labuan, Kecamatan Sindue;</p>" +
  "<p>Bahwa pada tahun 2015 Fulan bin Hamid pergi merantau untuk bekerja di Kalimantan dan sejak itu tidak diketahui keberadaannya;</p>" +
  "<p>Bahwa Fulan bin Hamid meninggalkan seorang istri bernama Siti binti Ali dan 2 orang anak;</p>" +
  "<p>Bahwa Fulan bin Hamid meninggalkan rumah dan kebun yang dikuasai istrinya;</p>";
const PETITUM_MAFQUD = "<ol><li>Mengabulkan permohonan Pemohon;</li><li>Menetapkan Fulan bin Hamid sebagai orang yang hilang (mafqud) dan dinyatakan meninggal dunia secara hukum;</li></ol>";

describe("pengangkatan anak nyata (6 perkara Lain-Lain SIPP PA Donggala)", () => {
  const nomorAA = ["173/Pdt.P/2021", "5/Pdt.P/2022", "162/Pdt.P/2023", "8/Pdt.P/2024", "12/Pdt.P/2024", "152/Pdt.P/2025"];
  it("terklasifikasi sebagai pengangkatan anak dan nilai usulan memuat potongan yang dilabel manual", () => {
    for (const n of nomorAA) {
      const p = perkara(n);
      expect(L.subJenis(p.posita, p.petitum, p.alur), n).toBe("pengangkatan-anak");
      const hasil = peta(p);
      for (const [kode, potongan] of Object.entries(gold[p.nomor])) {
        expect(hasil[kode], `${n} ${kode}`).toBeTruthy();
        for (const s of potongan) expect(hasil[kode].toLowerCase(), `${n} ${kode}`).toContain(s.toLowerCase());
      }
    }
  });
  it("contoh nyata 5/Pdt.P/2022: sejak 2017, ibu meninggal, perkawinan 2004 dengan satu anak, izin Dinas Sosial, tujuan pendidikan", () => {
    const h = peta(perkara("5/Pdt.P/2022"));
    expect(h["4910"]).toBe("tahun 2017");
    expect(h["4911"]).toMatch(/ibu dari anak tersebut telah meninggal dunia/);
    expect(h["4912"]).toBe("dilangsungkan pada tanggal 12 Februari 2004 dan telah dikaruniai 1 (satu) orang anak");
    expect(h["4913"]).toMatch(/^izin pengasuhan dari Dinas Sosial Provinsi Sulawesi Tengah Nomor 188\.4\/176\/SK\/Yanlu\/XI\/2021/);
    expect(h["4914"]).toBe("Pemohon I sebesar Rp30.000.000,- per tahun dan Pemohon II sebesar Rp4.318.200,- per bulan");
    expect(h["4915"]).toMatch(/^kelanjutan pendidikan, kesehatan dan masa depan anak/);
  });
  it("pemohon duda (152/Pdt.P/2025): riwayat perkawinan memuat akta cerai, bukan tanggal nikah", () => {
    const h = peta(perkara("152/Pdt.P/2025"));
    expect(h["4912"]).toMatch(/perceraian \(Akta Cerai Nomor 281\/AC\/2024\/PA\.Dgl\)/);
    expect(h["4912"]).toMatch(/belum dikaruniai keturunan/);
    expect(h["4913"]).toMatch(/Dinas Sosial Kabupaten Sigi Nomor 400\.9\/612\/DINSOS\/2025 dan dari Dinas Sosial Provinsi/);
  });
  it("semua usulan berkeyakinan ragu (kode baru belum terukur), berkalimat sumber, tanpa kata aleta", () => {
    for (const n of nomorAA) {
      const p = perkara(n);
      for (const u of usul(p).filter((x) => x.keyakinan !== "tidak_ada_sumber")) {
        expect(u.keyakinan, `${n} ${u.kode}`).toBe("ragu");
        expect(u.jagaIsianLama, `${n} ${u.kode}`).toBe(true);
        expect(u.sumber.length, `${n} ${u.kode}`).toBe(1);
        expect(JSON.stringify(u)).not.toMatch(/aleta/i);
      }
    }
  });
});

describe("perkara Lain-Lain yang bukan milik keluarga ini", () => {
  it("hak asuh, perwalian, dan ahli waris tidak menerima usulan", () => {
    for (const n of ["343/Pdt.G", "358/Pdt.G", "542/Pdt.G", "57/Pdt.G", "177/Pdt.G", "88/Pdt.P", "89/Pdt.P", "336/Pdt.G", "350/Pdt.G", "160/Pdt.P", "290/Pdt.G", "7/Pdt.P"]) {
      const p = data.find((x) => x.nomor.startsWith(n))!;
      expect(L.subJenis(p.posita, p.petitum, p.alur), p.nomor).toBe("");
      expect(usul(p), p.nomor).toEqual([]);
    }
  });
  it("jenis perkara selain 369 tidak disentuh", () => {
    const p = perkara("5/Pdt.P/2022");
    expect(L.usulanLain({ jenisPerkaraId: 346, posita: p.posita, petitum: p.petitum, alur: "15" }, butir)).toEqual([]);
    expect(L.usulanLain(null, butir)).toEqual([]);
    expect(L.usulanLain({ jenisPerkaraId: 369, posita: p.posita }, null as any)).toEqual([]);
  });
});

describe("penetapan kematian (permohonan umum) 648/Pdt.P/2019", () => {
  const p = () => perkara("648/Pdt.P/2019");
  it("hal, tanggal, sebab dan makam, serta keperluan terbaca sebagai saran", () => {
    const h = peta(p());
    expect(h["4930"]).toBe("penetapan kematian Ali Hubaib bin Hubaib");
    expect(h["4931"]).toBe("pada tanggal 27 Januari 2000");
    expect(h["4934"]).toMatch(/^karena sakit dan dikebumikan di Desa Kalukubula/);
    expect(h["4933"]).toMatch(/akta kematian/);
  });
  it("isian penilaian hakim dan bukti surat menjadi diisi manual beserta alasan, tidak ditebak", () => {
    const manual = usul(p()).filter((u) => u.keyakinan === "tidak_ada_sumber");
    expect(manual.map((u) => u.kode).sort()).toEqual(["4932", "4935", "4936", "4937", "4938", "4939"]);
    for (const u of manual) {
      expect(u.manual).toBe(true);
      expect(u.nilai).toBe("");
      expect(u.catatan.length).toBeGreaterThan(20);
    }
  });
});

describe("mafqud (fixture buatan; tidak ada perkara mafqud nyata)", () => {
  it("terbaca sebagai mafqud dan keempat isian saran terisi dari posita", () => {
    expect(L.subJenis(POSITA_MAFQUD, PETITUM_MAFQUD, "16")).toBe("mafqud");
    const h = peta({ posita: POSITA_MAFQUD, petitum: PETITUM_MAFQUD, alur: "16" });
    expect(h["4920"]).toMatch(/berumur 45 tahun, bekerja sebagai nelayan, beralamat terakhir di Desa Labuan/);
    expect(h["4921"]).toMatch(/^seorang istri bernama Siti binti Ali/);
    expect(h["4922"]).toMatch(/^rumah dan kebun yang dikuasai istrinya/);
    expect(h["4923"]).toMatch(/merantau untuk bekerja di Kalimantan/);
  });
  it("permohonan tanpa tanda mafqud tidak dibaca sebagai mafqud", () => {
    expect(L.subJenis("Bahwa Pemohon ingin mengurus penetapan nama pada akta.", "Menetapkan nama.", "16")).toBe("permohonan-umum");
    expect(peta({ posita: "Bahwa Pemohon ingin mengurus penetapan nama pada akta.", petitum: "Menetapkan nama.", alur: "16" })).toEqual({});
  });
});

describe("sambungan di isiOtomatisJenisS6 (satu baris)", () => {
  it("usulanDariKonteks mengeluarkan usulan keluarga ini tanpa mengubah usulan jenis lain", () => {
    const p = perkara("5/Pdt.P/2022");
    const k = { jenisPerkaraId: 369, alur: "16", posita: p.posita, petitum: p.petitum, pihak1: [], pihak2: [], tanggalDaftar: "2022-01-20" };
    const u = S6.usulanDariKonteks(k) as any[];
    const kode = u.map((x) => x.kode);
    expect(kode).toEqual(expect.arrayContaining(["4910", "4911", "4912", "4913", "4914", "4915"]));
    expect(u.find((x) => x.kode === "4912").nama).toBe("Riwayat perkawinan dan anak kandung Pemohon");
    expect(u.find((x) => x.kode === "4912").jagaIsianLama).toBe(true);
    // jenis lain tetap tanpa kode W2b
    const lain = S6.usulanDariKonteks({ ...k, jenisPerkaraId: 366 }) as any[];
    expect(lain.some((x) => /^49[1-3]\d$/.test(x.kode))).toBe(false);
  });
});
