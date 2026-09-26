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
  ])("C/D/E tidak pernah diusulkan untuk blangko [01]: %s", (kalimat, huruf, ciri) => {
    const hasil = dua(kalimat);
    expect(hasil.huruf.map((h) => h.huruf)).not.toContain(huruf);
    expect(hasil.hurufTidakDiusulkan).toContainEqual(expect.objectContaining({ huruf, ciri }));
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
 */
const BARIS_SDG: Record<string, string[]> = {
  "perselisihan terus-menerus": [
    "perselisihan", "pertengkaran", "percekcokan", "cekcok", "bertengkar",
    "berselisih", "tidak harmonis", "tidak rukun", "tidak ada kecocokan", "syiqaq",
  ],
  "kekerasan dalam rumah tangga": [
    "kdrt", "memukul", "kekerasan", "menganiaya", "penganiayaan", "menampar",
    "menendang", "mencekik", "kekejaman", "main tangan", "mengancam + bunuh", "ancaman + senjata",
  ],
  "tidak memberi nafkah": [
    "nafkah", "menelantarkan", "terlantar", "tidak menafkahi", "tidak bertanggung jawab", "lalai + kewajiban",
  ],
  "pihak lain (wanita/pria idaman lain)": ["idaman lain", "selingkuh", "perselingkuhan", "pihak ketiga"],
  cemburu: ["cemburu"],
  "obat terlarang": ["sabu", "narkoba", "narkotika", "pemadat", "madat", "ganja"],
  judi: ["judi", "togel"],
  mabuk: ["mabuk", "minuman keras", "miras", "pemabuk", "pemabok"],
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
  susunKeteranganSaksiSdg: (o: { templat: JawabSdg[]; posita: string; pelaku: string; lawan: string }) => {
    ok: boolean;
    saksi1: JawabSdg[];
    saksi2: JawabSdg[];
    alasan: string[];
    asalAlasan: string;
  };
};
const idBaris = (b: BarisCiri) => `${b.kunci}|${b.kata.join(" + ")}`;
const BERLAKU = new Set(
  Object.entries(BARIS_SDG).flatMap(([kunci, daftar]) => daftar.map((kata) => `${kunci}|${kata}`))
);
/** Kalimat yang memuat seluruh kata satu baris ciri, dan tidak ada kata lain yang berarti. */
const kalimatBaris = (b: BarisCiri) => `xxx ${b.kata.join(" xxx ")} xxx`;
const KUNCI_BARU = ["temperamental", "malas bekerja", "berkata kasar", "bersikap kasar"];

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

  // Harapan = keluaran kode sebelum 25 September atas posita yang sama
  // (dihitung dengan salinan HEAD di folder kerja, emas-sdg.js). Bentuk
  // kalimatnya dari posita sungguhan PA Donggala, pihak memakai sebutan.
  it.each([
    [
      "Bahwa sejak tahun 2020 rumah tangga Penggugat dan Tergugat sering terjadi perselisihan dan pertengkaran disebabkan Tergugat sering mengkonsumsi obat-obatan terlarang jenis Shabu;",
      ["perselisihan terus-menerus"],
    ],
    ["Bahwa Tergugat memiliki sifat temperamental dan sering berkata kasar kepada Penggugat;", []],
    ["Bahwa Tergugat malas bekerja sehingga kebutuhan rumah tangga tidak tercukupi;", []],
    ["Bahwa Tergugat menjalin hubungan dengan wanita lain;", []],
    [
      "Bahwa Tergugat pernah melakukan pemukulan terhadap Penggugat hingga Penggugat dipukul di bagian kepala;",
      [],
    ],
    ["Bahwa Tergugat sering marah-marah dan bersikap kasar kepada Penggugat;", []],
    ["Bahwa Tergugat suka berjudi dan mabuk-mabukan;", ["judi", "mabuk"]],
    [
      "Bahwa Tergugat tidak memberi nafkah;\nBahwa Tergugat bersifat tempramen dan malas mencari pekerjaan;",
      ["tidak memberi nafkah"],
    ],
  ])("alasan SDG sama dengan sebelumnya: %s", (posita, harapan) => {
    expect(sdg.alasanDariPosita(posita)).toEqual(harapan);
    const h = sdg.susunKeteranganSaksiSdg({ templat: TEMPLAT_SDG, posita, pelaku: "Tergugat", lawan: "Penggugat" });
    expect(h.ok).toBe(true);
    expect(h.alasan).toEqual(harapan);
    // Label kunci baru tidak pernah tercetak mentah di jawaban penyebab.
    const penyebab = [h.saksi1[0].jawab, h.saksi2[0].jawab].join(" ");
    for (const label of KUNCI_BARU) expect(penyebab).not.toContain(label);
  });
});
