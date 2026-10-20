// @vitest-environment node
/**
 * ============================================================================
 * AGEN W2b-A (21 Okt 2026) - PENGISI ISIAN OTOMATIS IZIN POLIGAMI (status calon istri, sikap istri, bukti status)
 * ============================================================================
 *
 * Pembaca posita dijalankan SUNGGUHAN atas kalimat nyata dari posita permohonan izin poligami PA Donggala (bentuk dan urutan kalimat
 * disalin dari perkara 2019-2025 di SIPP lokal; nama dan nomor diganti). Yang dijaga:
 *   1. status calon istri (perawan, janda cerai, janda ditinggal mati) dan bukti akta cerai terbaca dari blok calon istri;
 *   2. sikap istri: "Termohon menyatakan rela dan tidak keberatan" -> setuju; keberatan dengan alasan -> keberatan; gangguan jiwa -> tidak mungkin;
 *   3. semua usulan berkeyakinan "ragu" (kode baru belum terukur) dan tidak pernah mengarang nilai bila tidak tertulis;
 *   4. sambungan di deteksi/poligami.js membawa kode baru bersama kode lama (8723, 8724, 8725) tanpa mengubah nilainya;
 *   5. tanpa kata aplikasi; petunjuk keadaan tidak mengambil pekerjaan suami dari posita.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO = path.resolve(process.cwd(), "..");
const req = createRequire(import.meta.url);
const W = req(path.join(REPO, "aleta_bot", "services", "isiOtomatisW2b", "poligami.js"));
const D = req(path.join(REPO, "aleta_bot", "services", "deteksi", "poligami.js"));

const sekitar = (nama: string, status: string, tail = "") =>
  `Bahwa Pemohon hendak menikah lagi dengan seorang perempuan bernama :, ${nama}, umur 35 tahun, agama Islam, pendidikan terakhir SLTA, pekerjaan Mengurus Rumah Tangga, ${status}, tempat tinggal di Jalan Mawar, Kota Palu.\n\nSelanjutnya disebut sebagai Calon isteri kedua Pemohon.\n\nBahwa alasan Pemohon untuk menikah lagi adalah karena Termohon sudah tidak mampu lagi mengurus kebutuhan Pemohon.\n\nBahwa Pemohon memiliki penghasilan total Rp.15.000.000,- (lima belas juta rupiah) perbulan, dan Pemohon sanggup berlaku adil.\n\n${tail}`;

const CERAI = sekitar("Yunita binti Yos", "Status Janda dibuktikan dengan Nomor Akta Cerai : 00356/AC/2019/Pa.Pal", "Bahwa Termohon menyatakan rela dan tidak keberatan apabila Pemohon menikah lagi dengan calon isteri kedua Pemohon tersebut.");
const MATI = `Bahwa Pemohon hendak menikah lagi dengan seorang perempuan bernama : Nama : Asnizar binti Husni\n\nUmur : 50 tahun\n\nAgama : Islam\n\nPekerjaan : Ibu Rumah Tangga\n\nStatus perkawinan: Janda (meninggal)\n\nAlamat : Desa Lende\n\nSelanjutnya disebut sebagai Calon isteri kedua Pemohon.\n\nBahwa alasan Pemohon untuk menikah lagi adalah karena Termohon sudah tidak mampu lagi mengurus kebutuhan Pemohon.`;
const PERAWAN = sekitar("Nur Faiza binti Amaludin", "Status : Perawan");
const TANPA_STATUS = `Bahwa Pemohon hendak menikah lagi dengan seorang perempuan bernama : Nama : Nurfiah binti Saheratu\n\nUmur : 40 tahun\n\nAgama : Islam\n\nAlamat : Jalan Tanggul Mas Palu\n\nSelanjutnya disebut sebagai Calon isteri kedua Pemohon.\n\nBahwa alasan Pemohon untuk menikah lagi adalah karena Termohon sudah tidak mampu memenuhi kebutuhan seksual Pemohon.`;

describe("status calon istri dan buktinya", () => {
  it("perawan, janda cerai dengan akta cerai, janda ditinggal mati terbaca dari blok calon istri", () => {
    expect(W.statusCalon(CERAI).nilai).toBe("janda cerai");
    expect(W.statusCalon(CERAI).jenis).toBe("janda-cerai");
    expect(W.statusCalon(MATI).nilai).toBe("janda ditinggal mati suami");
    expect(W.statusCalon(MATI).jenis).toBe("janda-meninggal");
    expect(W.statusCalon(PERAWAN).nilai).toBe("perawan");
    expect(W.buktiStatus(CERAI).nilai).toBe("Akta Cerai Nomor 00356/AC/2019/Pa.Pal");
  });
  it("tidak mengarang: tanpa kalimat status tidak ada usulan status maupun bukti", () => {
    expect(W.statusCalon(TANPA_STATUS)).toBeNull();
    expect(W.buktiStatus(TANPA_STATUS)).toBeNull();
    const h = W.deteksi(TANPA_STATUS);
    expect(h["4854"]).toBeUndefined();
    expect(h["4855"]).toBeUndefined();
  });
  it("janda tanpa sebab tertulis diusulkan sebagai 'janda' dengan catatan melengkapi", () => {
    const t = sekitar("Rina binti Ali", "Status : Janda");
    const h = W.deteksi(t);
    expect(h["4854"].nilai).toBe("janda");
    expect(h["4854"].catatan).toMatch(/lengkapi/i);
  });
  it("nomor akta cerai yang diikuti tanggal membawa tanggal baku", () => {
    const t = sekitar("Rina binti Ali", "Status Janda dibuktikan dengan Akta Cerai Nomor 152/AC/2025/Pa.Dgl tanggal 3 Maret 2025");
    expect(W.buktiStatus(t).nilai).toBe("Akta Cerai Nomor 152/AC/2025/Pa.Dgl tanggal 03 Maret 2025");
  });
  it("surat kematian dibaca sebagai bukti janda ditinggal mati", () => {
    const t = sekitar("Rina binti Ali", "Status Janda ditinggal mati suami dengan Surat Keterangan Kematian Nomor 474.3/12/2021");
    expect(W.statusCalon(t).jenis).toBe("janda-meninggal");
    expect(W.buktiStatus(t).nilai).toBe("Surat Keterangan Kematian Nomor 474.3/12/2021");
  });
});

describe("sikap istri", () => {
  it("rela dan tidak keberatan -> petunjuk setuju; tidak ada usulan isian 4851/4852", () => {
    const h = W.deteksi(CERAI);
    expect(W.petunjukKeadaan(CERAI).sikapIstri).toBe("setuju");
    expect(h["4851"]).toBeUndefined();
    expect(h["4852"]).toBeUndefined();
  });
  it("keberatan dengan alasan terbaca sebagai alasan keberatan (4851) dan petunjuk keberatan", () => {
    const t = `${CERAI.replace(/Bahwa Termohon menyatakan rela[^.]*\./, "")}\n\nBahwa Termohon keberatan dimadu karena takut nafkah anak berkurang.`;
    expect(W.alasanKeberatan(t).nilai).toBe("takut nafkah anak berkurang");
    expect(W.deteksi(t)["4851"].nilai).toBe("takut nafkah anak berkurang");
    expect(W.petunjukKeadaan(t).sikapIstri).toBe("keberatan");
  });
  it("istri menderita gangguan jiwa atau tidak ada kabar -> tidak mungkin dimintai persetujuan (4852)", () => {
    expect(W.tidakMungkin("Bahwa Termohon menderita gangguan jiwa berat sejak 2022 dan dirawat keluarganya.").nilai).toMatch(/gangguan jiwa berat/);
    expect(W.tidakMungkin("Bahwa Termohon tidak ada kabar beritanya selama lebih dari 2 tahun.").nilai).toMatch(/tidak ada kabar/);
    expect(W.tidakMungkin("Bahwa Termohon sehat dan tinggal bersama Pemohon.")).toBeNull();
    expect(W.petunjukKeadaan("Bahwa Termohon menderita gangguan jiwa berat sejak 2022.").sikapIstri).toBe("tidak-mungkin");
  });
  it("surat persetujuan tertulis istri dan jumlah istri hanya dari kalimat yang ada", () => {
    const t = "Bahwa Termohon telah membuat surat pernyataan persetujuan Termohon tertanggal 12 Agustus 2026 yang dilampirkan. Bahwa Pemohon telah beristri dua orang istri.";
    expect(W.suratPersetujuan(t).nilai).toBe("tanggal 12 Agustus 2026");
    expect(W.jumlahIstri("Pemohon sudah beristri 2 (dua) orang istri").nilai).toBe("dua orang");
    expect(W.suratPersetujuan(CERAI)).toBeNull();
    expect(W.jumlahIstri(CERAI)).toBeNull();
  });
});

describe("sambungan di deteksi/poligami.js", () => {
  it("kode baru ikut bersama kode lama; nilai kode lama tidak berubah; semuanya ragu atau lama", () => {
    const h = D.deteksi(CERAI, { petitum: "Menetapkan, memberi izin kepada Pemohon (Fulan bin Fulan) untuk menikah lagi dengan calon isteri kedua Pemohon bernama (Yunita binti Yos)." });
    expect(h["4854"].nilai).toBe("janda cerai");
    expect(h["4855"].nilai).toMatch(/Akta Cerai Nomor 00356/);
    expect(h["8723"].nilai).toMatch(/Yunita/);
    expect(h["8725"].nilai).toMatch(/15\.000\.000/);
    for (const k of ["4854", "4855"]) {
      expect(h[k].yakin, k).toBe("ragu");
      expect(String(h[k].kalimat).length, k).toBeGreaterThan(5);
    }
  });
  it("semua usulan baru berkeyakinan ragu dan membawa sumber posita", () => {
    for (const t of [CERAI, MATI, PERAWAN]) for (const [k, v] of Object.entries<any>(W.deteksi(t))) {
      expect(v.yakin, k).toBe("ragu");
      expect(v.asal, k).toBe("posita");
      expect(v.kodePola, k).toMatch(/^w2b-poligami-/);
    }
  });
  it("petunjuk keadaan tidak mengambil pekerjaan suami dari posita (kata PNS sering milik Termohon)", () => {
    const t = `${CERAI}\n\nPekerjaan Termohon : PNS`;
    expect(W.petunjukKeadaan(t).pekerjaanSuami).toBeUndefined();
  });
  it("harta bersama pada posita menghasilkan petunjuk kumulasi harta bersama", () => {
    expect(W.petunjukKeadaan(CERAI, "Menetapkan harta bersama Pemohon dan Termohon").kumulasi).toEqual(["harta-bersama"]);
    expect(W.petunjukKeadaan(PERAWAN, "").kumulasi).toBeUndefined();
  });
  it("modul dan variabelnya tanpa kata aplikasi", () => {
    expect(JSON.stringify(W.variabel)).not.toMatch(/aleta/i);
    expect(W.variabel.map((v: any) => v.kode)).toEqual(["4850", "4851", "4852", "4854", "4855", "4856"]);
  });
});
