// @vitest-environment node
/**
 * ============================================================================
 * 30 OKT 2026 - DETEKSI LUAS: RINCIAN ALASAN CERAI (5227) & SEBAB BERHURUF (P1)
 * ============================================================================
 *
 * Kasus di bawah adalah kalimat posita SUNGGUHAN dari sipp_2810 (dump 28 Okt, PA Donggala) yang dulu
 * TERLEWAT atau SALAH TANGKAP (nomor perkara di judul uji, tanpa nama pihak). Ukuran atas 4.049 posita
 * cerai bertanda faktor akta cerai (kunci jawaban; skrip D:/aleta-dev/kerja/deteksi-luas-30okt/):
 *
 *   rincian 5227 (terlewat -> tertangkap):  mabuk 145->149/171, narkoba 82->83/87, judi 63->64/72,
 *     penjara 20->23/26, murtad 9->14/22, ekonomi 159->172/218, cacat 0->1/7, KDRT 280->286/328.
 *   Sebanyak 228 deteksi baru dibaca satu per satu; 22 salah tangkap lama (ancaman "mengancam untuk memukul"
 *   dibaca KDRT fisik, kekerasan kepada anak/orang tua berbunyi "terhadap Penggugat") dan 4 subjek terbalik
 *   ("menyebabkan Penggugat pergi" dibaca "Tergugat pergi") hilang.
 *   P1 huruf: mabuk 146->149/171, murtad 9->12/22 (+5 murtad nyata pada perkara berfaktor 9), cacat 0->1/7 (+1).
 *   Terhadap 5227 yang DIKETIK petugas di ABT (aps_badilag_2810, 344 perkara): sebab yang diketik dan
 *   tertangkap dari posita 685 -> 697 dari 776; 10 deteksi baru di luar isian manusia, dibaca: semuanya benar menurut posita.
 *   P4 hak asuh: 52 -> 54 dari 171 amar ber-hak asuh (sisanya memang tidak diminta di petitum SIPP).
 *
 * Pihak terbalik diuji DUA ARAH (memori pelaku-lawan-terbalik): pelaku = Tergugat/Termohon (0047).
 */
import { createRequire } from "node:module";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

type Bunyi = { keadaan: string; nilai: string };
type Butir = { jenis: string; penutup: boolean; sebab: string[]; bunyi: Bunyi[] };
type Rincian = { jenis: string; butir: Butir[] };
type Pihak = { pelaku: string; lawan: string };

const require_ = createRequire(import.meta.url);
const AKAR = path.resolve(process.cwd(), "../aleta_bot");
const mesin = require_(path.join(AKAR, "services/deteksi/alasanRincian.js")) as {
  deteksiRincian: (o: { gugatan: string[]; saksi?: unknown[]; saksiTidakDibaca?: boolean; jawab?: unknown[]; pihak?: Pihak }) => Rincian;
};
const kamus = require_(path.join(AKAR, "services/kamusDeteksi.js")) as { lupakan: () => void };
const p1 = require_(path.join(AKAR, "services/deteksiAlasanService.js")) as {
  sebabDariButir: (b: string[]) => { sebab: string; pelaku: string }[];
};

const CG: Pihak = { pelaku: "Tergugat", lawan: "Penggugat" };
const CT: Pihak = { pelaku: "Termohon", lawan: "Pemohon" };
const rinci = (pihak: Pihak, ...gugatan: string[]) => mesin.deteksiRincian({ gugatan, saksi: [], saksiTidakDibaca: true, jawab: [], pihak });
const kunci = (r: Rincian) => new Set(r.butir.flatMap((b) => b.sebab));
const bunyiKunci = (r: Rincian, k: string) => r.butir.find((b) => b.sebab.includes(k))?.bunyi[0]?.nilai ?? "";

afterEach(() => kamus.lupakan());

describe("salah ketik & ejaan lokal yang dulu terlewat", () => {
  it("237/Pdt.G/2022, 496/Pdt.G/2024, 493/Pdt.G/2025: minum mnuman / meminum-minumah / minum keras", () => {
    for (const k of ["Tergugat sering minum mnuman keras dan menggunakan obat obatan terlarang", "Tergugat sering meminum-minumah keras", "Tergugat sering mengkonsumsi minum keras dan bersikap temperamental"]) {
      const r = rinci(CG, k);
      expect(kunci(r).has("mabuk")).toBe(true);
      expect(bunyiKunci(r, "mabuk")).toMatch(/^Tergugat /);
    }
    expect(kunci(rinci(CG, "Tergugat bekerja keras di kebun")).has("mabuk")).toBe(false);
  });

  it("366/Pdt.G/2025 'memeberikan', 427/Pdt.G/2025 'tidak mengirimkan nafkah'", () => {
    expect(bunyiKunci(rinci(CG, "Tergugat tidak memeberikan nafkah kepada Penggugat"), "nafkah")).toBe("Tergugat tidak memberikan nafkah kepada Penggugat");
    expect(kunci(rinci(CG, "Tergugat tidak mengirimkan nafkah kepada Penggugat hingga untuk memenuhi kebutuhan sehari-hari dibantu oleh orang tua")).has("nafkah")).toBe(true);
  });

  it("303/Pdt.G/2024 'di penjara', 398/Pdt.G/2023 'di tahan pihak kepolisian'", () => {
    expect(kunci(rinci(CG, "tergugat di penjara selama 11 Tahun")).has("penjara")).toBe(true);
    expect(kunci(rinci(CG, "Tergugat di tahan pihak kepolisian karena suatu kasus dan Tergugat di hukum 15 tahun penjara")).has("penjara")).toBe(true);
    expect(kunci(rinci(CG, "Membebankan biaya perkara menurut hukum")).has("penjara")).toBe(false);
  });

  it("403/Pdt.G/2022 & 519/Pdt.G/2024: malas untuk bekerja / tidak mau berusaha mencari pekerjaan", () => {
    expect(kunci(rinci(CG, "Tergugat malas dan tidak mau berusaha untuk mencari pekerjaan")).has("malas-kerja")).toBe(true);
    expect(kunci(rinci(CG, "Tergugat malas untuk bekerja dan untuk memenuhi kebutuhan sehari-hari hanya mengharap penghasilan Penggugat")).has("malas-kerja")).toBe(true);
  });
});

describe("subjek sesudah 'mengetahui/mendapati/menegur' dan sesudah 'mengakibatkan'", () => {
  it("479/Pdt.G/2022 (CT): Pemohon mengetahui Termohon kembali memeluk agama -> Termohon", () => {
    const r = rinci(CT, "pada bulan Juli 2022 Pemohon mengetahui Termohon telah kembali memeluk agama dan kepercayaan Termohon sebelumnya yaitu Kristen");
    expect(kunci(r).has("kembali-agama")).toBe(true);
    expect(bunyiKunci(r, "kembali-agama")).toMatch(/^Termohon /);
  });

  it("dua arah (CG): Penggugat mengetahui Tergugat ... -> Tergugat; tidak pernah 'Penggugat murtad'", () => {
    const r = rinci(CG, "pada bulan Agustus 2023 Penggugat mengetahui Tergugat telah kembali memeluk agama dan kepercayaan Tergugat sebelumnya yaitu Kristen Protestan");
    expect(bunyiKunci(r, "kembali-agama")).toMatch(/^Tergugat /);
    expect(r.butir.some((b) => /^Penggugat .*murtad/.test(b.bunyi[0]?.nilai ?? ""))).toBe(false);
  });

  it("267/Pdt.G/2025: Penggugat menegur Tergugat agar berhenti minum-minum alkohol -> Tergugat mabuk", () => {
    const r = rinci(CG, "sudah mulai timbul percekcokkan disebabkan Penggugat menegur Tergugat agar berhenti minum-minum alkohol dan mabuk-mabukan");
    expect(bunyiKunci(r, "mabuk")).toMatch(/^Tergugat /);
  });

  it("268/Pdt.G/2024: '... hingga mengakibatkan Tergugat melakukan tindak KDRT kepada Penggugat'", () => {
    const r = rinci(CG, "Tergugat sering pulang hingga larut malam dan ketika Penggugat menasehati Tergugat marah hingga mengakibatkan Tergugat melakukan tindak KDRT kepada Penggugat");
    expect(kunci(r).has("kdrt-fisik")).toBe(true);
  });

  it("41/Pdt.G/2023: 'menyebabkan Penggugat pergi meninggalkan rumah' tidak lagi berbunyi 'Tergugat meninggalkan'", () => {
    const r = rinci(CG, "Tergugat diketahui telah menikah lagi tanpa sepengetahuan Penggugat dan menyebabkan Penggugat pergi meninggalkan rumah kediaman");
    expect(kunci(r).has("menikah-lagi")).toBe(true);
    expect(r.butir.some((b) => /Tergugat (?:pergi )?meninggalkan/.test(b.bunyi[0]?.nilai ?? ""))).toBe(false);
  });
});

describe("pihak terbalik: murtad oleh pihak yang mengajukan (huruf H berlaku bagi salah satu pihak)", () => {
  it("235/Pdt.G/2026 (CG): Penggugat keluar dari Islam -> bunyi menyebut Penggugat", () => {
    const r = rinci(CG, "sejak 2013 Penggugat telah keluar dari agama Islam dan sekarang beragama Kristen Protestan");
    expect(bunyiKunci(r, "murtad")).toBe("Penggugat telah keluar dari agama Islam (murtad)");
  });

  it("CT sejenis: Pemohon keluar dari Islam -> Pemohon; CG tidak memakai pola Pemohon", () => {
    expect(bunyiKunci(rinci(CT, "sejak 2020 Pemohon telah keluar dari agama Islam"), "murtad")).toBe("Pemohon telah keluar dari agama Islam (murtad)");
  });

  it("207/Pdt.G/2026 & 299/Pdt.G/2018: ajakan/keinginan berpindah agama bukan murtad", () => {
    expect(kunci(rinci(CG, "Tergugat mengajak Penggugat untuk mengikuti Tergugat namun Penggugat menolak keinginan Tergugat untuk berpindah agama")).has("murtad")).toBe(false);
    const r = rinci(CG, "Tergugat tidak sependapat (beda keyakinan) dan ingin kembali ke Agamanya");
    expect(kunci(r).has("kembali-agama")).toBe(false);
    expect(kunci(rinci(CG, "Penggugat tidak pernah keluar dari agama Islam")).has("murtad")).toBe(false);
  });
});

describe("negasi, ancaman & sasaran bukan pihak", () => {
  it("39/Pdt.G/2023 dst.: 'mengancam untuk memukul' = ancaman, bukan KDRT fisik", () => {
    const r = rinci(CG, "Tergugat sering mengancam untuk memukul Penggugat");
    expect(kunci(r).has("ancaman")).toBe(true);
    expect(kunci(r).has("kdrt-fisik")).toBe(false);
    expect(kunci(rinci(CG, "Tergugat tidak pernah memukul Penggugat")).has("kdrt-fisik")).toBe(false);
  });

  it("110/Pdt.G/2018: KDRT kepada orang tua Pemohon tidak berbunyi 'terhadap Pemohon'", () => {
    const r = rinci(CT, "Termohon pernah melakukan tindak KDRT kepada orang tua Pemohon");
    expect(kunci(r).has("kdrt-fisik")).toBe(false);
  });

  it("400/Pdt.G/2025: bersikap kasar kepada Penggugat terbaca; kepada orang tua tidak", () => {
    expect(bunyiKunci(rinci(CG, "Tergugat sering bersikap temperamental dan kasar kepada Penggugat"), "kasar-sikap")).toMatch(/^Tergugat .*kasar/);
    expect(kunci(rinci(CG, "Tergugat tidak menghormati orangtua Penggugat dan bersikap kasar kepada orangtua Penggugat")).has("kasar-sikap")).toBe(false);
  });

  it("664/Pdt.G/2025: 'keluar dari rumah dan tidak pulang sampai saat ini' bukan keluar malam", () => {
    const r = rinci(CG, "Penggugat dan Tergugat kembali bertengkar hebat, hingga akhirnya Tergugat keluar dari rumah bersama dan tidak pulang sampai saat ini");
    expect(kunci(r).has("keluar-malam")).toBe(false);
  });
});

describe("sebab ekonomi & keadaan yang dulu tidak punya kunci", () => {
  it("608/Pdt.G/2026 (CT): Termohon selalu merasa kurang atas nafkah", () => {
    const r = rinci(CT, "Termohon kurang bersyukur dan selalu merasa kurang atas nafkah yang telah diberikan oleh Pemohon");
    expect(bunyiKunci(r, "tidak-bersyukur")).toBe("Termohon tidak bersyukur atas nafkah yang diberikan Pemohon");
  });

  it("336/Pdt.G/2021 bentuk pasif: 'Penggugat sudah tidak diberikan nafkah' -> Tergugat tidak memberi nafkah", () => {
    expect(bunyiKunci(rinci(CG, "Penggugat sudah tidak diberikan nafkah sejak tahun 2019"), "nafkah")).toBe("Tergugat tidak memberikan nafkah kepada Penggugat");
    expect(kunci(rinci(CG, "Penggugat tidak mendapatkan nafkah batin dari Tergugat")).has("nafkah")).toBe(false);
  });

  it("338/Pdt.G/2021 (CT): istri 'tidak bisa memenuhi kebutuhan hidup' bukan nafkah; CG tetap nafkah", () => {
    expect(kunci(rinci(CT, "Termohon malas memasak sehingga tidak bisa memenuhi kebutuhan hidup sehari-hari")).has("nafkah")).toBe(false);
    expect(kunci(rinci(CG, "disebabkan karena Tergugat tidak memenuhi kebutuhan rumah tangga Penggugat dan Tergugat")).has("nafkah")).toBe(true);
  });

  it("428/Pdt.G/2024 (CT): 'dikarenakan penyakit Termohon'; 'rumah sakit Tergugat' bukan penyakit", () => {
    expect(kunci(rinci(CT, "Termohon tidak memenuhi nafkah batin Pemohon dikarenakan penyakit Termohon sehingga Termohon tidak bisa melayani Pemohon")).has("penyakit")).toBe(true);
    expect(kunci(rinci(CG, "selama dirawat di rumah sakit Tergugat melarang Penggugat untuk mengaku sebagai istri")).has("penyakit")).toBe(false);
  });

  it("148/Pdt.G/2023 (CT): tidak dapat memberikan keturunan; 'belum dikaruniai keturunan' bukan sebab", () => {
    expect(bunyiKunci(rinci(CT, "Termohon belum bisa memberikan keturunan kepada Pemohon sehingga itu menjadi permasalahan"), "keturunan")).toMatch(/^Termohon /);
    expect(kunci(rinci(CG, "Penggugat dan Tergugat belum dikaruniai keturunan")).has("keturunan")).toBe(false);
  });

  it("445/Pdt.G/2025: kebutuhan dibantu orang tua TERGUGAT berbunyi orang tua Tergugat, bukan keluarga Penggugat", () => {
    const r = rinci(CG, "Tergugat tidak memiliki pekerjaan tetap hingga untuk memenuhi kebutuhan rumah tangga dibantu oleh orangtua Tergugat");
    const b = bunyiKunci(r, "kebutuhan-dibantu");
    expect(b).toMatch(/orang ?tua Tergugat/);
    expect(b).not.toMatch(/Penggugat/);
  });
});

describe("P1 sebab berhuruf (deteksiAlasanService)", () => {
  const sebab = (k: string) => p1.sebabDariButir([k]).filter((s) => s.pelaku !== "lawan").map((s) => s.sebab);
  it("459/Pdt.G/2022: 'Tergugat diketahui telah kembali memeluk agama ... Kristen' = murtad (H)", () => {
    expect(sebab("Tergugat diketahui telah kembali memeluk agama dan kepercayaan sebelumnya yaitu Kristen Khatolik")).toContain("murtad/pindah agama");
    expect(sebab("Tergugat ingin kembali memeluk agama semula")).not.toContain("murtad/pindah agama");
  });
  it("280/Pdt.G/2021: 'minum mnuman keras' = mabuk (A)", () => {
    expect(sebab("Tergugat sering minum mnuman keras")).toContain("mabuk");
    expect(sebab("Tergugat bekerja keras")).not.toContain("mabuk");
  });
});

describe("P4 tuntutan: ejaan hak asuh dari petitum SIPP", () => {
  const T = require_(path.join(AKAR, "services/tuntutanDeteksiService.js")) as {
    deteksiTuntutan: (t: string, o?: Record<string, unknown>) => { tuntutan: { jenis: string; diPetitum: boolean }[] };
  };
  const jenis = (t: string) => T.deteksiTuntutan(t, { peran: "gugatan" }).tuntutan.map((x) => x.jenis);
  it("238/Pdt.G/2016 'berhak atas hadlanah', 267/Pdt.G/2025 'Perwalian dan Pengasuhan anak'", () => {
    expect(jenis("PRIMAIR:\n3. Menetapkan bahwa Penggugat berhak atas hadlanah (Penguasaan dan pemeliharaan) atas 2 (dua) orang anak Penggugat;")).toContain("hadhanah");
    expect(jenis("PRIMAIR:\nMenyatakan Perwalian dan Pengasuhan anak atas nama A binti B diberikan kepada Penggugat sebagai ibu kandungnya;")).toContain("hadhanah");
  });
  it("kata 'pengasuhan anak' di posita tanpa permintaan bukan tuntutan", () => {
    expect(jenis("Bahwa selama ini pengasuhan anak dilakukan bersama oleh orang tua Penggugat.")).not.toContain("hadhanah");
  });
});

describe("P1 huruf E: penyakit yang membuat tidak dapat menjalankan kewajiban", () => {
  const sebab = (k: string) => p1.sebabDariButir([k]).filter((s) => s.pelaku !== "lawan").map((s) => s.sebab);
  it("428/Pdt.G/2024 & 569/Pdt.G/2026", () => {
    expect(sebab("Termohon tidak memenuhi nafkah batin Pemohon dikarenakan penyakit Termohon sehingga Termohon tidak bisa melayani Pemohon")).toContain("cacat badan atau penyakit");
    expect(sebab("c. Termohon mengidap penyakit sehingga tidak bisa memberikan keturunan")).toContain("cacat badan atau penyakit");
    expect(sebab("Termohon sakit sehingga tidak bisa hadir di persidangan")).not.toContain("cacat badan atau penyakit");
  });
});

describe("salah tangkap lama KDRT fisik: perusakan barang & tuduhan", () => {
  it("147/Pdt.G/2020: 'membanting barang-barang' = merusak barang, bukan kekerasan terhadap Penggugat", () => {
    const r = rinci(CG, "Tergugat sering membanting barang-barang yang ada di dalam rumah setiap kali bertengkar dengan Penggugat.");
    expect(kunci(r).has("kdrt-fisik")).toBe(false);
    expect(kunci(r).has("merusak-barang")).toBe(true);
    expect(kunci(rinci(CG, "Tergugat sering membanting Penggugat ke lantai")).has("kdrt-fisik")).toBe(true);
  });
  it("106/Pdt.G/2020 (CT): 'Termohon menuduh Pemohon melakukan KDRT' bukan KDRT oleh Termohon", () => {
    expect(kunci(rinci(CT, "Termohon menuduh pemohon melakukan KDRT padahal hanya tergores kuku pemohon")).has("kdrt-fisik")).toBe(false);
  });
});

describe("P1 huruf C: ditahan di rutan/polres", () => {
  const sebab = (k: string) => p1.sebabDariButir([k]).filter((s) => s.pelaku !== "lawan").map((s) => s.sebab);
  const C = "salah satu pihak menjalani pidana penjara";
  it("110/Pdt.G/2021, 169/Pdt.G/2021, 30/Pdt.G/2024, 616/Pdt.G/2025", () => {
    expect(sebab("tergugat sekarang ada ditahan dirutan maesa karena kasus penyalah gunaan jabatan")).toContain(C);
    expect(sebab("setelah Tergugat ditahan di Polres Sigi Penggugat dan anak-anaknya pindah")).toContain(C);
    expect(sebab("4.Bahwa tergugat sekarang menjalani masa tahanan di LP Maesa")).toContain(C);
    expect(sebab("d. Pada bulan April 2024 Tergugat ditahan oleh pihak kepolisisan atas kasus narkoba")).toContain(C);
    expect(sebab("Tergugat menahan diri untuk tidak marah")).not.toContain(C);
  });
});
