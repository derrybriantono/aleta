// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PENJAGA DETEKSI KETERANGAN SAKSI -> VARIABEL ABT (25 September 2026)
 * ============================================================================
 *
 * Tiap penjaga di sini MENJALANKAN layanan bot (abtUsulanService.js,
 * abtKalimatBaku.js, abtAturanAlasan.js) atas keterangan saksi contoh. Tidak
 * ada yang menyisir teks sumber.
 *
 * Bentuk kalimat contoh diambil dari keterangan saksi sungguhan PA Donggala
 * (abt_keterangan_saksi) yang terukur lolos atau salah baca sebelum
 * perubahan ini; nama pihak diganti sebutan, tanpa NIK dan alamat, dan
 * paling banyak 40 kasus per aturan. Angka ukur atas 347 perkara ada di
 * folder kerja t1-deteksi-saksi-bot (ukur-t1.js), bukan di sini.
 *
 * PERHATIAN pada nama ruas pihak - sudah dua kali tertukar di repo ini:
 *   pihak.pelaku = variabel ABT 0047 = Tergugat / Termohon
 *   pihak.lawan  = variabel ABT 0046 = Penggugat / Pemohon
 */

type Sumber = { saksi: number; asal?: string; kalimat: string };
type Usulan = {
  kode: string;
  nilai: string;
  keyakinan: string;
  catatan: string;
  dihitung: boolean;
  sumber: Sumber[];
  pilihan?: { keadaan: string; nilai: string }[];
  pembanding?: { teks: string; totalBulan: number };
};
type Huruf = { huruf: string; syarat: string; pemicu: string[]; centangOtomatis: boolean };
type HasilSaksi = {
  ciri: string[];
  ciriTanpaFrasa: string[];
  tandaSepihak: { ciri: string; saksi: number; label: string; kalimat: string }[];
  huruf: Huruf[];
  hurufTidakDiusulkan: { huruf: string; ciri: string; sebab: string }[];
  usulan: Usulan[];
};
type Pihak = { pelaku?: string; lawan?: string };
type Layanan = {
  dariKeteranganSaksi: (
    a: string,
    b: string,
    tanggalSidang?: string,
    pihak?: Pihak,
    posita?: string
  ) => HasilSaksi;
};
type Pustaka = {
  kalimatUpayaDamai: (keadaan: string | boolean, pihak?: Pihak) => string;
  susunAlasanRinci: (daftar: string[], pihak?: Pihak) => { kalimat: string; tanpaFrasa: string[] };
};

const require_ = createRequire(import.meta.url);
const bot = (nama: string) => path.resolve(process.cwd(), "../aleta_bot/services", nama);
const layanan = require_(bot("abtUsulanService.js")) as Layanan;
const pustaka = require_(bot("abtKalimatBaku.js")) as Pustaka;

const GUGAT: Pihak = { pelaku: "Tergugat", lawan: "Penggugat" };
const TALAK: Pihak = { pelaku: "Termohon", lawan: "Pemohon" };

/** Keterangan berbentuk daftar "- Bahwa ...;" seperti diketik petugas. */
const bas = (...butir: string[]) => butir.map((b) => `- Bahwa ${b};`).join("\n");
const usulanDari = (hasil: HasilSaksi, kode: string) => {
  const u = hasil.usulan.find((x) => x.kode === kode);
  if (!u) throw new Error(`usulan ${kode} tidak ada`);
  return u;
};
const dua = (butir: string, pihak: Pihak = GUGAT, posita = "", sidang = "") =>
  layanan.dariKeteranganSaksi(bas(butir), bas(butir), sidang, pihak, posita);

describe("0222 - awal konflik: kata konflik diperluas + sejak/mulai", () => {
  // Dahulu hanya "perselisihan" + "sejak": 45 dari 64 yang terlewat berkata
  // "tidak rukun", "berselisih", atau "bertengkar" tanpa kata itu.
  it.each([
    ["sering terjadi perselisihan dan pertengkaran sejak bulan Maret 2021", "bulan Maret 2021"],
    ["sudah tidak rukun sejak tahun 2019", "tahun 2019"],
    ["mulai sering berselisih sejak bulan Juni 2020", "bulan Juni 2020"],
    ["sering bertengkar mulai tahun 2022", "tahun 2022"],
    ["rumah tangganya tidak harmonis lagi sejak awal tahun 2023", "awal tahun 2023"],
    ["sering cekcok semenjak bulan Januari 2024", "bulan Januari 2024"],
    ["sudah tidak lagi rukun sejak bulan Mei 2018", "bulan Mei 2018"],
  ])("%s", (kalimat, harapan) => {
    const u = usulanDari(dua(`keadaan rumah tangga Penggugat dan Tergugat awalnya rukun, namun ${kalimat}`), "0222");
    expect(u.nilai).toBe(harapan);
    expect(u.keyakinan).toBe("pasti");
  });

  it("tanggal PUNCAK bukan awal konflik", () => {
    const u = usulanDari(dua("puncak perselisihan dan pertengkaran terjadi pada bulan Mei 2024"), "0222");
    expect(u.nilai).toBe("");
  });

  it("saksi diam: diambil dari posita, berkeyakinan ragu, bersumber Posita", () => {
    const posita =
      "Bahwa sejak bulan April 2023 keadaan rumah tangga Penggugat dan Tergugat mulai tidak harmonis dan sering terjadi perselisihan dan pertengkaran yang disebabkan karena Tergugat tidak memberi nafkah;";
    const u = usulanDari(dua("saksi sering melihat Penggugat dan Tergugat bertengkar", GUGAT, posita), "0222");
    expect(u.nilai).toBe("bulan April 2023");
    expect(u.keyakinan).toBe("ragu");
    expect(u.sumber).toHaveLength(1);
    expect(u.sumber[0].asal).toBe("posita");
    expect(u.catatan).toMatch(/posita/);
  });

  it("saksi yang menyebut tahun tidak dikalahkan posita - posita hanya disebut", () => {
    const posita = "Bahwa sejak tahun 2006 keadaan rumah tangga Penggugat dan Tergugat mulai tidak harmonis;";
    const u = usulanDari(
      dua("antara Penggugat dan Tergugat sering terjadi perselisihan dan pertengkaran sejak bulan Juni 2010", GUGAT, posita),
      "0222"
    );
    expect(u.nilai).toBe("bulan Juni 2010");
    expect(u.sumber.every((s) => s.asal !== "posita")).toBe(true);
    expect(u.catatan).toContain("tahun 2006");
  });
});

describe("0246 - pisah rumah, termasuk bentuk puncak ... pergi meninggalkan", () => {
  it.each([
    [
      "puncak perselisihan dan pertengkaran antara Penggugat dan Tergugat terjadi pada bulan Januari 2021, Tergugat pergi meninggalkan tempat kediaman bersama",
      "bulan Januari 2021",
    ],
    ["Penggugat dan Tergugat sudah pisah tempat tinggal sejak bulan Agustus 2023", "bulan Agustus 2023"],
    ["Penggugat dan Tergugat tidak lagi tinggal bersama sejak tahun 2022", "tahun 2022"],
    ["Termohon pergi meninggalkan rumah kediaman bersama pada bulan Maret 2024", "bulan Maret 2024"],
  ])("%s", (kalimat, harapan) => {
    expect(usulanDari(dua(kalimat), "0246").nilai).toBe(harapan);
  });
});

describe("7035 - yang pergi dibaca dari SUBJEK kalimatnya", () => {
  // Dahulu: sebutan yang disebut PALING AKHIR - benar untuk "... adalah
  // Tergugat", salah untuk "Tergugat pergi meninggalkan Penggugat" (yang
  // terakhir disebut justru yang ditinggalkan).
  it.each([
    ["Tergugat pergi meninggalkan Penggugat dan anak-anaknya", GUGAT, "Tergugat"],
    ["yang meninggalkan tempat kediaman bersama adalah Penggugat", GUGAT, "Penggugat"],
    ["Penggugat yang pergi meninggalkan rumah kediaman bersama", GUGAT, "Penggugat"],
    ["Tergugat telah meninggalkan Penggugat tanpa pamit", GUGAT, "Tergugat"],
    ["Penggugat pulang ke rumah orang tuanya dan meninggalkan Tergugat", GUGAT, "Penggugat"],
    ["Termohon pergi meninggalkan Pemohon tanpa pamit", TALAK, "Termohon"],
    ["yang meninggalkan kediaman bersama adalah Termohon", TALAK, "Termohon"],
    ["Pemohon sudah meninggalkan Termohon sejak dua tahun lalu", TALAK, "Pemohon"],
  ])("%s", (kalimat, pihak, harapan) => {
    const u = usulanDari(dua(kalimat, pihak), "7035");
    expect(u.nilai).toBe(harapan);
  });

  it("nilainya sebutan dari variabel 0047/0046 perkara itu, bukan kata di kalimat", () => {
    // pelaku = 0047. Bila kedua ruas tertukar, Tergugat yang pergi terbaca
    // sebagai sebutan pihak LAWAN.
    const u = usulanDari(dua("Tergugat pergi meninggalkan Penggugat", { pelaku: "TERGUGAT", lawan: "PENGGUGAT" }), "7035");
    expect(u.nilai).toBe("TERGUGAT");
  });

  // Jawaban templat yang tidak diisi petugas ("adalah Penggugat/Tergugat")
  // dahulu terbaca sebagai Penggugat yang pergi - 441/Pdt.G/2025 dan
  // 77/Pdt.G/2026 berbalik dari benar menjadi salah.
  it("pilihan templat 'Penggugat/Tergugat' yang tidak diisi bukan keterangan", () => {
    const u = usulanDari(dua("yang meninggalkan tempat tinggal bersama adalah Penggugat/Tergugat"), "7035");
    expect(u.nilai).toBe("");
  });

  it("saksi yang mengisi dipakai; 'adalahTergugat' tanpa spasi tetap terbaca", () => {
    const hasil = layanan.dariKeteranganSaksi(
      bas("yang meninggalkan tempat tinggal bersama adalahTergugat"),
      bas("yang meninggalkan tempat tinggal bersama adalah Penggugat/Tergugat"),
      "",
      GUGAT
    );
    const u = usulanDari(hasil, "7035");
    expect(u.nilai).toBe("Tergugat");
    expect(u.keyakinan).toBe("cukup");
  });

  it("butir berpilihan templat dilewati, butir sesudahnya tetap dibaca", () => {
    const s = bas(
      "yang meninggalkan tempat tinggal bersama adalah Penggugat/Tergugat",
      "Tergugat pergi meninggalkan Penggugat sejak tahun 2020"
    );
    const u = usulanDari(layanan.dariKeteranganSaksi(s, s, "", GUGAT), "7035");
    expect(u.nilai).toBe("Tergugat");
    expect(u.keyakinan).toBe("pasti");
  });
});

describe("1268 - tiga keadaan, dan belum-ada TIDAK diisi sendiri", () => {
  it.each([
    "Penggugat dan Tergugat sudah pernah diupayakan untuk dirukunkan oleh keluarga, namun tidak berhasil",
    "pihak keluarga sudah berusaha mendamaikan Penggugat dan Tergugat, namun tidak berhasil",
    "keluarga sudah sering menasihati Tergugat tapi tidak berhasil",
    "saksi sudah menasehati keduanya agar rukun kembali, namun tidak berhasil",
    "sudah ada upaya damai dari keluarga namun tidak berhasil",
    "keluarga sudah memusyawarahkan masalah itu tetapi tidak berhasil",
    "Penggugat dan Tergugat pernah berhasil dirukunkan oleh keluarga, namun kembali lagi cekcok",
    "Tergugat sudah pernah dinasihati oleh keluarga",
  ])("gagal: %s", (kalimat) => {
    const u = usulanDari(dua(kalimat), "1268");
    expect(u.nilai).toBe("pihak keluarga telah berusaha untuk mendamaikan Penggugat dan Tergugat, namun tidak berhasil");
  });

  it("berhasil HANYA bila saksi menyebut berhasil dirukunkan", () => {
    const u = usulanDari(dua("Penggugat dan Tergugat pernah berhasil dirukunkan oleh keluarga"), "1268");
    expect(u.nilai).toBe("pihak keluarga telah berusaha untuk mendamaikan Penggugat dan Tergugat");
  });

  const BELUM_ADA = [
    "belum pernah ada upaya untuk merukunkan Penggugat dan Tergugat",
    "tidak pernah ada upaya dari keluarga untuk mendamaikan Penggugat dan Tergugat",
    "keluarga belum pernah mendamaikan Penggugat dan Tergugat",
    "belum ada upaya perdamaian dari pihak keluarga",
    "Penggugat dan Tergugat tidak pernah didamaikan oleh keluarga",
    "keluarga belum pernah berusaha merukunkan Penggugat dan Tergugat",
    "Penggugat dan Tergugat belum pernah dirukunkan oleh pihak keluarga",
    "tidak ada upaya dari pihak keluarga untuk merukunkan Penggugat dan Tergugat",
  ];
  it.each(BELUM_ADA)("belum-ada: %s", (kalimat) => {
    const u = usulanDari(dua(kalimat), "1268");
    // Fakta yang terbalik tidak pernah terisi: tanpa kalimat, ragu, dua pilihan.
    expect(u.nilai).toBe("");
    expect(u.keyakinan).toBe("ragu");
    expect((u.pilihan ?? []).map((p) => p.keadaan)).toEqual(["gagal", "belum-ada"]);
    for (const p of u.pilihan ?? []) expect(p.nilai).not.toBe("");
    expect(u.pilihan?.[1].nilai).not.toMatch(/telah berusaha|berhasil/);
  });

  it("satu saksi berkata belum-ada sudah cukup untuk menahan kalimatnya", () => {
    const hasil = layanan.dariKeteranganSaksi(
      bas("Penggugat dan Tergugat sudah pernah diupayakan untuk dirukunkan oleh keluarga, namun tidak berhasil"),
      bas(BELUM_ADA[0]),
      "",
      GUGAT
    );
    const u = usulanDari(hasil, "1268");
    expect(u.nilai).toBe("");
    expect(u.keyakinan).toBe("ragu");
    expect(u.catatan).toContain("Saksi 2");
  });

  it("bunyi belum-ada tidak pernah menyebut upaya yang berhasil atau telah dilakukan", () => {
    for (const pihak of [GUGAT, TALAK]) {
      const bunyi = pustaka.kalimatUpayaDamai("belum-ada", pihak);
      expect(bunyi).not.toBe("");
      expect(bunyi).not.toMatch(/telah berusaha|berhasil/);
      expect(bunyi).toContain(pihak.lawan as string);
    }
  });
});

describe("9944 - lama pisah: ucapan saksi, 'N tahun' tanpa kata bulan", () => {
  it.each([
    ["Penggugat dan Tergugat sudah pisah tempat tinggal selama 2 (dua) tahun", "2 tahun"],
    ["Penggugat dan Tergugat sudah berpisah kurang lebih empat (4) tahun", "4 tahun"],
    ["Penggugat dan Tergugat telah pisah rumah selama 12 (dua belas) bulan", "12 bulan"],
    ["Penggugat dan Tergugat sudah pisah tempat tinggal sekira 1 (satu) tahun 3 bulan", "1 tahun 3 bulan"],
    ["Penggugat dan Tergugat sudah pisah rumah kurang lebih setahun", "1 tahun"],
    [
      "Penggugat dan Tergugat telah dikaruniai 1 orang anak umur 3 tahun, dan sudah pisah rumah selama 8 bulan",
      "8 bulan",
    ],
  ])("%s", (kalimat, harapan) => {
    const u = usulanDari(dua(kalimat), "9944");
    expect(u.nilai).toBe(harapan);
    expect(u.dihitung).toBe(false);
  });
});

describe("5227 - ciri alasan: kata baru, tanda sepihak, dan ciri tanpa frasa", () => {
  it("shabu terbaca sebagai obat terlarang (s-h-a-b-u tidak memuat 'sabu')", () => {
    const hasil = dua("yang menjadi penyebab perselisihan adalah karena Tergugat sering mengonsumsi shabu");
    expect(hasil.ciri).toContain("obat terlarang");
    expect(usulanDari(hasil, "5227").nilai).toContain("menjadi pemakai obat terlarang");
  });

  it("obat-obatan terlarang terbaca walau ada '-obatan' di tengahnya", () => {
    expect(dua("Tergugat sering memakai obat-obatan terlarang").ciri).toContain("obat terlarang");
  });

  it.each([
    ["Tergugat bersikap tempramental kepada Penggugat", "temperamental", "bersikap temperamental"],
    ["Tergugat sering berkata-kata kasar kepada Penggugat", "berkata kasar", "berkata kasar"],
    ["Tergugat malas bekerja sehingga kebutuhan rumah tangga tidak tercukupi", "malas bekerja", "malas bekerja"],
    ["Tergugat menjalin hubungan dengan wanita lain", "pihak lain (wanita/pria idaman lain)", "menjalin hubungan dengan pihak lain"],
  ])("%s", (kalimat, ciri, frasa) => {
    const hasil = dua(kalimat);
    expect(hasil.ciri).toContain(ciri);
    expect(usulanDari(hasil, "5227").nilai).toContain(frasa);
  });

  it("'kasar' telanjang tidak menerbitkan dua perbuatan", () => {
    const ciri = dua("Tergugat orangnya kasar").ciri;
    expect(ciri).not.toContain("berkata kasar");
    expect(ciri).not.toContain("bersikap kasar");
  });

  it("ciri satu saksi menjadi tanda 'hanya saksi N', tidak masuk kalimat", () => {
    const hasil = layanan.dariKeteranganSaksi(
      bas("Tergugat tidak memberi nafkah dan sering bermain judi online"),
      bas("Tergugat tidak memberi nafkah"),
      "",
      GUGAT
    );
    expect(hasil.ciri).not.toContain("judi");
    expect(hasil.tandaSepihak).toEqual([
      expect.objectContaining({ ciri: "judi", saksi: 1, label: "hanya saksi 1" }),
    ]);
    expect(hasil.tandaSepihak[0].kalimat).toContain("judi");
    expect(usulanDari(hasil, "5227").nilai).not.toContain("penjudi");
  });

  // Zina, penjara, cacat badan, dan taklik TIDAK punya frasa baku (tidak ada
  // bentuk yang muncul di 3 perkara isian 5227 manusia). Yang dijaga: ciri itu
  // tidak pernah hilang diam-diam.
  it.each([
    ["Tergugat telah berzina dengan perempuan lain", "zina"],
    ["Tergugat dipenjara karena kasus pencurian", "salah satu pihak menjalani pidana penjara"],
    ["Tergugat mengalami cacat badan sejak kecelakaan", "cacat badan atau penyakit"],
    ["Tergugat melanggar taklik talak yang diucapkannya", "pelanggaran taklik talak"],
  ])("tanpa frasa ditandai, tidak dibuang: %s", (kalimat, ciri) => {
    const hasil = dua(`${kalimat}, dan sering terjadi perselisihan`);
    expect(hasil.ciri).toContain(ciri);
    expect(hasil.ciriTanpaFrasa).toContain(ciri);
    const u = usulanDari(hasil, "5227");
    expect(u.keyakinan).toBe("ragu");
    expect(u.catatan).toContain(ciri);
  });

  it("susunAlasanRinci memulangkan keempatnya sebagai tanpaFrasa", () => {
    const empat = [
      "zina",
      "salah satu pihak menjalani pidana penjara",
      "cacat badan atau penyakit",
      "pelanggaran taklik talak",
    ];
    const r = pustaka.susunAlasanRinci(["tidak memberi nafkah", ...empat, "perselisihan terus-menerus"], GUGAT);
    expect(r.tanpaFrasa).toEqual(empat);
    expect(r.kalimat).toBe(
      "Tergugat melalaikan kewajiban nafkah lahir yang memicu perselisihan terus-menerus dengan Penggugat"
    );
  });
});

describe("8503 - huruf alasan blangko [01] menurut keputusan pengguna 11", () => {
  const hurufDari = (hasil: HasilSaksi) => hasil.huruf.map((h) => h.huruf).sort().join("");

  it("F bila ada perselisihan", () => {
    expect(hurufDari(dua("antara Penggugat dan Tergugat sering terjadi perselisihan dan pertengkaran"))).toBe("F");
  });

  it("B HANYA bila lama pisah >= 24 bulan - bukan karena kata 'meninggalkan'", () => {
    expect(hurufDari(dua("Tergugat pergi meninggalkan Penggugat, dan sudah pisah rumah selama 2 (dua) tahun"))).toContain("B");
    expect(hurufDari(dua("Tergugat pergi meninggalkan Penggugat, dan sudah pisah rumah selama 1 tahun 11 bulan"))).not.toContain("B");
  });

  it("A HANYA dari ciri yang dikuatkan kedua saksi", () => {
    expect(hurufDari(dua("Tergugat sering mabuk minuman keras"))).toContain("A");
    const sepihak = layanan.dariKeteranganSaksi(bas("Tergugat sering mabuk"), bas("Tergugat tidak memberi nafkah"), "", GUGAT);
    expect(hurufDari(sepihak)).not.toContain("A");
  });

  it.each([
    ["Tergugat sering memukul Penggugat", "D", "kekerasan dalam rumah tangga"],
    ["Tergugat dipenjara karena kasus pencurian", "C", "salah satu pihak menjalani pidana penjara"],
    ["Tergugat mengalami cacat badan sejak kecelakaan", "E", "cacat badan atau penyakit"],
  ])("C/D/E diusulkan untuk blangko [01] - tanpa centang - sejak paket ABT abt-alasan-cdeh: %s", (kalimat, huruf, ciri) => {
    // Keputusan 11 dahulu MENAHAN C/D/E karena kueri 4020/8521/8522/8528/8530
    // tidak punya cabangnya ("TIDAK BENAR QUERY NYA" tercetak). Paket ABT
    // abt-alasan-cdeh (6 Okt 2026) menambahkan cabang itu; jeda sebelum paket
    // terpasang di satker dijaga ekstensi lewat nama 8503 di halaman ABT.
    const hasil = dua(kalimat);
    const h = hasil.huruf.find((x) => x.huruf === huruf);
    expect(h, huruf).toBeTruthy();
    expect(h?.pemicu).toContain(ciri);
    expect(h?.centangOtomatis).toBe(false);
    expect(String(h?.syarat || "").trim()).not.toBe("");
    expect(hasil.hurufTidakDiusulkan).toEqual([]);
  });

  it("tidak satu huruf pun tercentang otomatis", () => {
    const hasil = dua(
      "Tergugat sering mabuk, sering terjadi perselisihan, dan sudah pisah rumah selama 3 (tiga) tahun"
    );
    expect(hurufDari(hasil)).toBe("ABF");
    for (const h of hasil.huruf) {
      // Ekstensi mencentang sendiri huruf yang syaratnya kosong (abt.js).
      expect(h.syarat.trim()).not.toBe("");
      expect(h.centangOtomatis).toBe(false);
    }
  });
});

/**
 * ============================================================================
 * SDG TIDAK IKUT BERUBAH OLEH BARIS DETEKSI 25 SEPTEMBER 2026
 * ============================================================================
 *
 * CIRI_ALASAN dipakai juga oleh keterangan saksi SDG ("sama dengan gugatan"):
 * alasan yang terbaca di POSITA dicetak sebagai ucapan saksi di draf BAS.
 * Baris yang ditambahkan untuk deteksi 5227 diukur atas isian 5227 manusia,
 * bukan atas BAS petugas. Diukur terhadap BAS petugas (973 perkara cerai,
 * ukur-sdg-bas.js di folder kerja t1-deteksi-saksi-bot), alasan SDG yang juga
 * diterangkan saksi turun dari 0,906 menjadi 0,851 bila baris itu ikut. Sampai
 * pekerjaan ragam BAS mengukur dan memberinya bunyi, SDG hanya memakai
 * BARIS_SDG di bawah - 63 baris yang berlaku sebelum 25 September.
 *
 * Menambah baris ke CIRI_ALASAN tanpa hanyaDeteksi, membuang tandanya, atau
 * menyambung SDG ke seluruh CIRI_ALASAN membuat penjaga ini merah: kalimat
 * berita acara hanya boleh berubah dengan sengaja dan terukur.
 *
 * 26 September 2026 (permintaan pengguna 1 dan 7): baris yang kalimat BAS
 * petugasnya dibaca satu per satu dan benar sedikitnya 9 dari 10 dibuka -
 * empat kunci perilaku, "wanita lain", "perempuan lain", "shabu",
 * "obat + terlarang", "pemukulan", "dipukul", "mengancam + tajam", bentuk
 * pasif kekerasan, dan tiga kunci baru (menikah lagi, tidak memiliki
 * pekerjaan tetap, masalah ekonomi). Atas 1.479 posita berketerangan saksi,
 * alasan SDG berubah pada 805 perkara; bagian alasan SDG yang juga
 * diterangkan saksi di BAS petugas 0,889 -> 0,828 (folder kerja
 * penguatan-putusan/alasan-cerai, ukur-posita.js).
 */
const BARIS_SDG: Record<string, string[]> = {
  "perselisihan terus-menerus": [
    "perselisihan", "pertengkaran", "percekcokan", "cekcok", "bertengkar",
    "berselisih", "tidak harmonis", "tidak rukun", "tidak ada kecocokan", "syiqaq",
  ],
  "kekerasan dalam rumah tangga": [
    "kdrt", "memukul", "kekerasan", "menganiaya", "penganiayaan", "menampar",
    "menendang", "mencekik", "kekejaman", "main tangan", "mengancam + bunuh", "ancaman + senjata",
    "pemukulan", "dipukul", "mengancam + tajam", "dicekik", "ditampar", "ditendang", "menjambak", "ringan tangan",
  ],
  "tidak memberi nafkah": [
    "nafkah", "menelantarkan", "terlantar", "tidak menafkahi", "tidak bertanggung jawab", "lalai + kewajiban",
  ],
  "pihak lain (wanita/pria idaman lain)": [
    "idaman lain", "selingkuh", "perselingkuhan", "pihak ketiga", "wanita lain", "perempuan lain",
  ],
  "menikah lagi": [
    "menikah lagi", "kawin lagi", "menikah dengan wanita", "menikah dengan perempuan",
    "menikah dengan laki", "menikah dengan pria", "menikah siri",
  ],
  cemburu: ["cemburu"],
  "obat terlarang": ["sabu", "shabu", "obat + terlarang", "narkoba", "narkotika", "pemadat", "madat", "ganja"],
  judi: ["judi", "togel", "sabung ayam", "slot"],
  mabuk: ["mabuk", "minuman keras", "miras", "pemabuk", "pemabok"],
  "malas bekerja": [
    "malas bekerja", "malas dalam bekerja", "malasbekerja", "malas mencari pekerjaan",
    "malas cari pekerjaan", "malas mencari kerja", "malas + kerja", "tidak mau bekerja",
  ],
  temperamental: [
    "temperam", "tempram", "teperamen", "temparamen", "sering marah", "marah-marah", "marah marah",
    // "emosional" dan "tersulut emosi" hanya dideteksi sejak pemeriksa 26
    // September 2026: di posita benar 3/6 dan 0/2 (lihat CIRI_ALASAN).
    "mudah marah", "pemarah", "suka marah", "cepat marah", "gampang marah", "mudah emosi",
  ],
  "berkata kasar": ["kata kasar", "kata-kata kasar", "bicara kasar", "ucapan kasar", "berucap kasar", "perkataan kasar"],
  "bersikap kasar": ["sikap kasar", "berlaku kasar", "perlakuan kasar", "berbuat kasar", "bertindak kasar"],
  "tidak memiliki pekerjaan tetap": [
    "tidak memiliki pekerjaan tetap", "tidak mempunyai pekerjaan tetap", "tidak punya pekerjaan tetap",
    "belum memiliki pekerjaan tetap", "belum mempunyai pekerjaan tetap", "tidak memiliki pekerjaan yang tetap",
    "tidak memiliki penghasilan tetap", "tidak mempunyai penghasilan tetap",
  ],
  "masalah ekonomi": ["masalah ekonomi", "faktor ekonomi", "persoalan ekonomi", "permasalahan ekonomi", "alasan ekonomi"],
  zina: ["zina", "berzina"],
  "salah satu pihak menjalani pidana penjara": [
    "dipenjara", "dihukum + penjara", "menjalani + pidana", "lembaga pemasyarakatan",
  ],
  "cacat badan atau penyakit": [
    "cacat badan", "cacat tetap", "penyakit + tidak dapat menjalankan", "impoten", "gangguan jiwa",
  ],
  "pelanggaran taklik talak": ["taklik talak", "taklik", "ta'lik"],
  "murtad/pindah agama": ["murtad", "pindah agama", "keluar dari agama islam"],
};

type BarisCiri = { kunci: string; kata: string[]; hanyaDeteksi?: boolean };
type JawabSdg = { no: string; tanya: string; jawab: string };
const sdg = layanan as unknown as {
  CIRI_ALASAN: BarisCiri[];
  alasanDariPosita: (posita: string) => string[];
  susunKeteranganSaksiSdg: (o: { templat: JawabSdg[]; posita?: string; alasan?: string[]; pelaku: string; lawan: string }) => {
    ok: boolean;
    saksi1: JawabSdg[];
    saksi2: JawabSdg[];
    alasan: string[];
    asalAlasan: string;
    alasanDitolak?: { kunci: string; sebab: string }[];
  };
};
const idBaris = (b: BarisCiri) => `${b.kunci}|${b.kata.join(" + ")}`;
const BERLAKU = new Set(
  Object.entries(BARIS_SDG).flatMap(([kunci, daftar]) => daftar.map((kata) => `${kunci}|${kata}`))
);
/** Kalimat yang memuat seluruh kata satu baris ciri, dan tidak ada kata lain yang berarti. */
const kalimatBaris = (b: BarisCiri) => `xxx ${b.kata.join(" xxx ")} xxx`;
/** Bunyi yang boleh mengucapkan tiap kunci di keterangan saksi SDG (frasa + setara bot). */
const BUNYI_SDG: Record<string, string[]> = {
  "obat terlarang": ["menjadi pemakai obat terlarang", "mengkonsumsi obat-obatan terlarang", "mengonsumsi obat-obatan terlarang", "mengonsumsi narkoba"],
  temperamental: ["bersikap temperamental", "suka marah", "mudah marah"],
  "berkata kasar": ["berkata kasar"],
  "bersikap kasar": ["bersikap kasar"],
  "malas bekerja": ["malas bekerja", "tidak mau bekerja"],
  "pihak lain (wanita/pria idaman lain)": ["menjalin hubungan dengan pihak lain", "berselingkuh", "selingkuh"],
  "kekerasan dalam rumah tangga": ["melakukan Kekerasan Dalam Rumah Tangga", "melakukan kekerasan dalam rumah tangga", "melakukan KDRT"],
  judi: ["menjadi penjudi", "bermain judi", "main judi"],
  mabuk: ["menjadi pemabuk", "suka mabuk"],
  "tidak memberi nafkah": ["melalaikan kewajiban nafkah lahir", "tidak memberikan nafkah", "tidak memberi nafkah", "tidak menafkahi"],
  "menikah lagi": ["telah menikah lagi", "sudah menikah lagi"],
  "tidak memiliki pekerjaan tetap": ["tidak memiliki pekerjaan tetap"],
  "masalah ekonomi": ["masalah ekonomi"],
};

describe("SDG - baris deteksi 25 September tidak mengubah keterangan saksi", () => {
  it("tiap baris CIRI_ALASAN menyala di SDG tepat bila ia ada di BARIS_SDG", () => {
    const salah = sdg.CIRI_ALASAN.flatMap((b) => {
      const menyala = sdg.alasanDariPosita(`Bahwa ${kalimatBaris(b)};`).includes(b.kunci);
      return menyala === BERLAKU.has(idBaris(b)) ? [] : [`${idBaris(b)}: SDG ${menyala ? "menyala" : "padam"}`];
    });
    expect(salah).toEqual([]);
    // Baris SDG yang berlaku tidak boleh lenyap dari CIRI_ALASAN diam-diam.
    const ada = new Set(sdg.CIRI_ALASAN.map(idBaris));
    expect([...BERLAKU].filter((id) => !ada.has(id))).toEqual([]);
  });

  it("deteksi TETAP membaca setiap baris yang tidak dipakai SDG", () => {
    const hanyaDeteksi = sdg.CIRI_ALASAN.filter((b) => !BERLAKU.has(idBaris(b)));
    expect(hanyaDeteksi.length).toBeGreaterThan(0);
    const padam = hanyaDeteksi.filter((b) => !dua(kalimatBaris(b)).ciri.includes(b.kunci)).map(idBaris);
    expect(padam).toEqual([]);
  });

  const TEMPLAT_SDG: JawabSdg[] = [
    { no: "1", tanya: "Apa penyebab pertengkaran Penggugat dan Tergugat?", jawab: "karena ..." },
    { no: "2", tanya: "Apakah saksi pernah melihat atau mendengar sendiri pertengkaran itu?", jawab: "..." },
  ];

  // Harapan sampai 25 September = keluaran kode HEAD (emas-sdg.js); sejak 26
  // September baris yang terukur dibuka, dan harapannya ditulis ulang dengan
  // sengaja. Bentuk kalimatnya dari posita sungguhan PA Donggala, pihak
  // memakai sebutan.
  it.each([
    [
      "Bahwa sejak tahun 2020 rumah tangga Penggugat dan Tergugat sering terjadi perselisihan dan pertengkaran disebabkan Tergugat sering mengkonsumsi obat-obatan terlarang jenis Shabu;",
      ["perselisihan terus-menerus", "obat terlarang"],
    ],
    ["Bahwa Tergugat memiliki sifat temperamental dan sering berkata kasar kepada Penggugat;", ["temperamental", "berkata kasar"]],
    ["Bahwa Tergugat malas bekerja sehingga kebutuhan rumah tangga tidak tercukupi;", ["malas bekerja"]],
    ["Bahwa Tergugat menjalin hubungan dengan wanita lain;", ["pihak lain (wanita/pria idaman lain)"]],
    [
      "Bahwa Tergugat pernah melakukan pemukulan terhadap Penggugat hingga Penggugat dipukul di bagian kepala;",
      ["kekerasan dalam rumah tangga"],
    ],
    ["Bahwa Tergugat sering marah-marah dan bersikap kasar kepada Penggugat;", ["temperamental", "bersikap kasar"]],
    ["Bahwa Tergugat suka berjudi dan mabuk-mabukan;", ["judi", "mabuk"]],
    [
      "Bahwa Tergugat tidak memberi nafkah;\nBahwa Tergugat bersifat tempramen dan malas mencari pekerjaan;",
      ["tidak memberi nafkah", "malas bekerja", "temperamental"],
    ],
    // Perkawinan baru BUKAN perselingkuhan: "wanita lain" di sini pasangan
    // nikahnya, bukan tanda pihak lain.
    ["Bahwa Tergugat telah menikah lagi dengan wanita lain tanpa sepengetahuan Penggugat;", ["menikah lagi"]],
    [
      "Bahwa Tergugat memiliki hubungan dengan wanita lain dan sudah menikah lagi;",
      ["pihak lain (wanita/pria idaman lain)", "menikah lagi"],
    ],
    [
      "Bahwa Tergugat tidak memiliki pekerjaan tetap karena masalah ekonomi keluarga;",
      ["tidak memiliki pekerjaan tetap", "masalah ekonomi"],
    ],
    // Ciri yang hanya dideteksi tidak diucapkan saksi SDG.
    ["Bahwa keluarga Tergugat sering ikut campur dan Tergugat sering keluar malam serta tidak menghargai Penggugat;", []],
  ])("alasan SDG: %s", (posita, harapan) => {
    expect(sdg.alasanDariPosita(posita)).toEqual(harapan);
    const h = sdg.susunKeteranganSaksiSdg({ templat: TEMPLAT_SDG, posita, pelaku: "Tergugat", lawan: "Penggugat" });
    expect(h.ok).toBe(true);
    expect(h.alasan).toEqual(harapan);
    // Label kunci tidak pernah tercetak mentah: tiap kunci yang dibuka
    // diucapkan dengan frasanya atau bunyi setaranya dari korpus (atau
    // kuncinya memang bunyinya - "masalah ekonomi"), dan tidak ada kurung
    // atau garis miring label ("pihak lain (wanita/pria idaman lain)").
    for (const s of [h.saksi1[0].jawab, h.saksi2[0].jawab]) {
      expect(s).not.toMatch(/[()/]/);
      for (const kunci of harapan) {
        if (kunci === "perselisihan terus-menerus") continue;
        const bunyi = BUNYI_SDG[kunci];
        expect(bunyi, `bunyi ${kunci}`).toBeDefined();
        expect(bunyi.some((b) => s.includes(b)), `${kunci} diucapkan dengan bunyinya: ${s}`).toBe(true);
      }
    }
  });
});

/**
 * ============================================================================
 * PEMERIKSA 26 SEPTEMBER 2026 - T3, T4, T9
 * ============================================================================
 *
 * T3: kalimat 5227 dan SDG selalu berbunyi "{pelaku} telah menikah lagi"
 * (pelaku = 0047 = Tergugat/Termohon). Kalimat BAS/posita sungguhan di bawah
 * (sebutan pihak dipertahankan) menyatakan perkawinan pihak LAWAN, NIAT/izin/
 * suruhan, atau perkawinan yang tidak jadi - tidak satu pun boleh menjadi
 * "menikah lagi". Diukur atas 896 kalimat berkata nikah: 31 ditolak (30
 * perkara), termasuk ke-16 perkara temuan pemeriksa.
 */
describe("T3 - menikah lagi hanya perkawinan pelaku yang sudah terjadi", () => {
  const TEMPLAT: JawabSdg[] = [
    { no: "1", tanya: "Apa penyebab pertengkaran Penggugat dan Tergugat?", jawab: "karena ..." },
  ];

  it.each([
    ["Bahwa Pemohon telah menikah lagi dengan perempuan lain;"],
    ["Bahwa awalnya Pemohon menikah lagi secara diam-diam;"],
    ["Bahwa Tergugat ingin menikah lagi namun tidak mendapat restu dari Penggugat;"],
    ["Bahwa Tergugat meminta izin kepada Penggugat untuk menikah lagi dengan wanita lain;"],
    ["Bahwa Tergugat menyuruh Penggugat untuk menikah lagi dengan laki-laki lain;"],
    ["Bahwa Tergugat hendak menikah lagi dengan perempuan lain;"],
    ["Bahwa Termohon pernah mengatakan kalau cerai hari ini Pemohon harus menikah lagi;"],
    ["Bahwa Termohon tidak jadi menikah dengan laki-laki tersebut;"],
  ])("bukan menikah lagi: %s", (posita) => {
    expect(sdg.alasanDariPosita(posita)).not.toContain("menikah lagi");
  });

  it.each([
    ["Bahwa Tergugat ingin menikah lagi dengan wanita lain dan sekarang Tergugat sudah menikah dengan wanita tersebut;"],
    ["Bahwa Tergugat pergi meninggalkan Penggugat dan menikah lagi dengan perempuan lain;"],
    ["Bahwa Termohon telah menikah lagi dengan laki-laki lain;"],
    ["Bahwa Tergugat sering memukul Penggugat dan Tergugat sudah menikah lagi;"],
  ])("tetap menikah lagi: %s", (posita) => {
    expect(sdg.alasanDariPosita(posita)).toContain("menikah lagi");
  });

  it("SDG cerai talak tidak menuduh Termohon atas perkawinan Pemohon", () => {
    const h = sdg.susunKeteranganSaksiSdg({
      templat: TEMPLAT,
      posita: "Bahwa Pemohon telah menikah lagi dengan perempuan lain;",
      pelaku: "Termohon",
      lawan: "Pemohon",
    });
    expect(h.alasan).not.toContain("menikah lagi");
    for (const s of [h.saksi1[0].jawab, h.saksi2[0].jawab]) expect(s).not.toMatch(/Termohon (?:telah|sudah) menikah lagi/);
  });

  it("5227 dari BAS: 'Ya, Pemohon telah menikah lagi' bukan ciri, kalimatnya tidak menuduh Termohon", () => {
    const hasil = dua("Ya, Pemohon telah menikah lagi", TALAK, "Bahwa Pemohon telah menikah lagi;");
    expect(hasil.ciri).not.toContain("menikah lagi");
    expect(usulanDari(hasil, "5227").nilai).not.toContain("telah menikah lagi");
  });

  it("kalimat pemicu yang ditampilkan adalah kalimat yang menyalakannya", () => {
    const hasil = layanan.dariKeteranganSaksi(
      bas("Tergugat ingin menikah lagi", "Tergugat sudah menikah lagi dengan wanita lain"),
      bas("Tergugat telah menikah lagi"),
      "",
      GUGAT
    );
    expect(hasil.ciri).toContain("menikah lagi");
    const kalimat = hasil.usulan.find((u) => u.kode === "5227")?.sumber?.find((x) => x.saksi === 1)?.kalimat ?? "";
    expect(kalimat).toContain("sudah menikah lagi");
  });
});

describe("T4 - 'emosional' dan 'tersulut emosi' hanya dideteksi", () => {
  it.each([
    ["Bahwa sejak malam pertama tidak terbangun kedekatan emosional antara Penggugat dan Tergugat;"],
    ["Bahwa suasana batin keduanya telah jauh dan hubungan emosional pun memudar;"],
    ["Bahwa Penggugat tidak menjamin bisa tersulut emosi apabila Tergugat selalu ingin menyerang;"],
  ])("posita tidak menjadi temperamental: %s", (posita) => {
    expect(sdg.alasanDariPosita(posita)).not.toContain("temperamental");
  });

  it("BAS tetap membacanya untuk 5227", () => {
    expect(dua("Tergugat orangnya sangat emosional kepada Penggugat").ciri).toContain("temperamental");
    expect(dua("Tergugat mudah tersulut emosi").ciri).toContain("temperamental");
  });
});

describe("T9 - kunci hanya-deteksi kiriman eksplisit ditolak, tidak diucapkan tanpa subjek", () => {
  const TEMPLAT: JawabSdg[] = [
    { no: "1", tanya: "Apa penyebab pertengkaran Penggugat dan Tergugat?", jawab: "karena ..." },
  ];

  it("ditolak dengan sebabnya; yang terbuka tetap diucapkan", () => {
    const h = sdg.susunKeteranganSaksiSdg({
      templat: TEMPLAT,
      alasan: ["tidak menghargai", "keluar malam", "judi"],
      pelaku: "Tergugat",
      lawan: "Penggugat",
    });
    expect(h.alasan).toEqual(["judi"]);
    expect(h.alasanDitolak).toEqual([
      { kunci: "tidak menghargai", sebab: "hanya_deteksi" },
      { kunci: "keluar malam", sebab: "hanya_deteksi" },
    ]);
    for (const s of [h.saksi1[0].jawab, h.saksi2[0].jawab]) {
      expect(s).not.toContain("tidak menghargai");
      expect(s).not.toContain("keluar malam");
    }
  });

  it("pilihan yang seluruhnya ditolak tidak diam-diam menjadi 'sama dengan gugatan'", () => {
    const h = sdg.susunKeteranganSaksiSdg({
      templat: TEMPLAT,
      alasan: ["keluar malam"],
      posita: "Bahwa Tergugat suka berjudi;",
      pelaku: "Tergugat",
      lawan: "Penggugat",
    });
    expect(h.alasan).toEqual([]);
    expect(h.asalAlasan).toBe("");
    expect(h.alasanDitolak).toEqual([{ kunci: "keluar malam", sebab: "hanya_deteksi" }]);
  });
});

/**
 * T5 - dua saksi SDG memilih bunyinya dari [frasa, ...setara]. Ukuran "fakta
 * sama 67.030/67.030" pembangun sebenarnya KUNCI sama (kuncinya diturunkan
 * dari kosakata frasa yang sama, jadi pasti sama); yang menjamin fakta hukum
 * kedua saksi sama adalah derajat setiap bunyi setara. Kelas derajat di bawah
 * pasangan yang terbukti berbeda: lalai lawan tidak sama sekali, malas lawan
 * menolak, kebiasaan lawan perbuatan.
 */
describe("T5 - setara satu derajat dengan frasanya", () => {
  const DERAJAT: Array<[string, RegExp]> = [
    ["lalai", /\b(?:melalaikan|lalai|kurang|jarang)\b/i],
    ["tidak sama sekali", /\btidak\s+(?:pernah\s+)?(?:memberi|memberikan|menafkahi)\b/i],
    ["malas", /\bmalas\b/i],
    ["menolak", /\btidak\s+mau\b/i],
    ["kebiasaan judi", /\bmenjadi\s+penjudi\b|\bsuka\s+(?:bermain\s+|main\s+)?judi\b/i],
    ["perbuatan judi", /^(?:bermain|main)\s+judi$/i],
  ];
  const derajat = (bunyi: string) => DERAJAT.filter(([, pola]) => pola.test(bunyi.trim())).map(([nama]) => nama).join("+");
  const baku = pustaka as unknown as { KALIMAT: { frasaCiri: Record<string, { frasa: string; setara?: string[] }> } };

  it("tiap bunyi setara berderajat sama dengan frasanya", () => {
    const beda = Object.entries(baku.KALIMAT.frasaCiri).flatMap(([kunci, aturan]) =>
      (aturan.setara ?? [])
        .filter((s) => derajat(s) !== derajat(aturan.frasa))
        .map((s) => `${kunci}: "${aturan.frasa}" (${derajat(aturan.frasa) || "-"}) lawan "${s}" (${derajat(s) || "-"})`)
    );
    expect(beda).toEqual([]);
  });

  it("dua saksi SDG menyebut nafkah dengan derajat yang sama", () => {
    const h = sdg.susunKeteranganSaksiSdg({
      templat: [{ no: "1", tanya: "Apa penyebab pertengkaran Penggugat dan Tergugat?", jawab: "karena ..." }],
      alasan: ["tidak memberi nafkah", "malas bekerja", "judi"],
      pelaku: "Tergugat",
      lawan: "Penggugat",
    });
    const [s1, s2] = [h.saksi1[0].jawab, h.saksi2[0].jawab];
    for (const [nama, pola] of DERAJAT) expect(pola.test(s1), `${nama}: ${s1} || ${s2}`).toBe(pola.test(s2));
  });
});
