// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

/**
 * Usulan isian blangko ABT, dan penyunting di tempat yang memakainya.
 *
 * ============================================================================
 * DUA JENIS PENJAGA DALAM SATU BERKAS
 * ============================================================================
 *
 * Penurunan dari keterangan saksi diuji SUNGGUHAN - layanannya murni untuk
 * bagian itu, tidak menyentuh basis data, jadi ia dapat dipanggil apa adanya
 * dengan teks contoh yang bentuknya persis seperti yang diketik petugas.
 *
 * Sisanya penjaga sumber, dengan alasan yang sama seperti berkas ekstensi
 * lain: abt.js hidup di dalam halaman aplikasi orang lain, dan memalsukan
 * seluruh lingkungan itu lebih mungkin salah daripada kodenya sendiri.
 */

type Usulan = {
  kode: string;
  nama: string;
  nilai: string;
  keyakinan: string;
  bentrok: string;
  sumber: { saksi: number; kalimat: string }[];
};

type HasilSaksi = {
  butir: { saksi1: number; saksi2: number };
  ciri: string[];
  /** Ciri yang hanya disebut SATU saksi - tidak masuk 5227, tetapi tetap disebut. */
  ciriSepihak: { nama: string; saksi: number }[];
  /** Terbukti kedua saksi, tetapi tidak didalilkan dalam gugatan. */
  ciriDiluarGugatan: string[];
  /** Didalilkan dalam gugatan, tetapi belum dikuatkan kedua saksi. */
  ciriBelumTerbukti: string[];
  gugatanTerbaca: boolean;
  selisih: { hal: string; saksi1: string; saksi2: string }[];
  huruf: { huruf: string; bunyi: string; pemicu: string[]; syarat: string }[];
  hurufBelumSiap: { huruf: string; sebab: string }[];
  usulan: (Usulan & { catatan?: string; dihitung?: boolean })[];
};

type Layanan = {
  alasanDariPosita: (posita: string) => string[];
  butirKeterangan: (teks: string) => string[];
  hitungLamaPisah: (a: string, b: string) => { teks: string; totalBulan: number } | null;
  dariKeteranganSaksi: (
    a: string,
    b: string,
    tanggalSidang?: string,
    pihak?: { pelaku?: string; lawan?: string },
    posita?: string
  ) => HasilSaksi;
};

const require_ = createRequire(import.meta.url);
const berkasLayanan = path.resolve(process.cwd(), "../aleta_bot/services/abtUsulanService.js");
const layanan = require_(berkasLayanan) as Layanan;

/* Kedua modul di bawah bentuknya bebas - yang dijaga isinya, bukan tipenya. */
type Aturan = {
  HURUF: {
    huruf: string;
    siap: boolean;
    dasar: {
      bunyi: string;
      catatanNaskah: string;
      sumber: { nama: string; tautan: string; pembanding?: string };
    }[];
  }[];
  usulkan: (teks: string) => {
    huruf: string;
    syarat: string;
    dasar: { bunyi: string; sumber: { nama: string } }[];
  }[];
  belumSiap: () => { huruf: string; sebab: string }[];
};
type Pustaka = {
  KALIMAT: {
    frasaCiri: Record<string, { urutan: number; frasa: string; akibat?: boolean }>;
    penyambungAlasan: { antara: string; terakhirBanyak: string; terakhirDua: string };
  };
  susunAlasan: (daftar: string[], pihak?: { pelaku?: string; lawan?: string } | null) => string;
  kalimatUpayaDamai: (gagal: boolean) => string;
};
const aturan = require_(
  path.resolve(process.cwd(), "../aleta_bot/services/abtAturanAlasan.js")
) as Aturan;
const pustaka = require_(
  path.resolve(process.cwd(), "../aleta_bot/services/abtKalimatBaku.js")
) as Pustaka;

const abtJs = () => readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/abt.js"), "utf8");
const dockerfileBot = () =>
  readFileSync(path.resolve(process.cwd(), "../aleta_bot/Dockerfile"), "utf8");
const popupJs = () => readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/popup.js"), "utf8");
const popupHtml = () => readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/popup.html"), "utf8");
const manifest = () =>
  JSON.parse(
    readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/manifest.json"), "utf8")
  ) as { content_scripts: { js?: string[]; css?: string[]; matches: string[] }[] };

/** Bentuknya persis seperti yang diketik petugas di variabel 2021 dan 2022. */
const SAKSI_1 = [
  "- Bahwa saksi kenal dengan Penggugat karena saksi adalah tetangga Penggugat;",
  "- Bahwa antara Penggugat dan Tergugat sering terjadi perselisihan dan pertengkaran sejak 2018;",
  "- Bahwa yang biasa menjadi penyebab perselisihan adalah karena Tergugat sering cemburu buta, Tergugat tidak memberikan nafkah dan masalah KDRT;",
  "- Bahwa Penggugat dan Tergugat sudah pisah tempat tinggal sejak bulan Mei 2026, kira-kira sampai sekarang sudah sekitar 4 bulan lamanya;",
  "- Bahwa yang meninggalkan tempat tinggal bersama adalah Tergugat;",
  "- Bahwa Penggugat dan Tergugat sudah pernah diupayakan untuk dirukunkan oleh keluarga, namun tidak berhasil;",
].join("\n");

const SAKSI_2 = [
  "- Bahwa saksi kenal dengan Penggugat karena saksi adalah adik kandung Penggugat;",
  "- Bahwa antara Penggugat dan Tergugat sering terjadi perselisihan dan pertengkaran sejak 2018;",
  "- Bahwa Penggugat dan Tergugat sudah pisah tempat tinggal sejak Mei 2026, kira-kira sampai sekarang sudah sekitar 4 bulan;",
  "- Bahwa yang meninggalkan tempat tinggal bersama adalah Tergugat;",
  "- Bahwa Penggugat dan Tergugat sudah pernah diupayakan untuk dirukunkan oleh pihak keluarga, namun tidak berhasil;",
].join("\n");

function ambil(hasil: HasilSaksi, kode: string) {
  const u = hasil.usulan.find((x) => x.kode === kode);
  expect(u, `usulan ${kode} tidak ada`).toBeTruthy();
  return u as Usulan;
}

describe("menurunkan kerangka fakta dari keterangan saksi", () => {
  it("memecah keterangan menjadi butir, bukan satu gumpalan", () => {
    // Satu fakta satu baris - bentuk itu yang membuat tiap usulan dapat
    // menunjuk KALIMAT asalnya, bukan sekadar "ada di keterangan saksi 1".
    const butir = layanan.butirKeterangan(SAKSI_1);
    expect(butir.length).toBe(6);
    expect(butir[0].startsWith("Bahwa saksi kenal")).toBe(true);
  });

  it("0222 awal konflik diambil tahunnya", () => {
    const u = ambil(layanan.dariKeteranganSaksi(SAKSI_1, SAKSI_2), "0222");
    expect(u.nilai).toBe("tahun 2018");
    expect(u.keyakinan).toBe("pasti");
  });

  it("0246 pisah rumah diambil bulan dan tahunnya", () => {
    const u = ambil(layanan.dariKeteranganSaksi(SAKSI_1, SAKSI_2), "0246");
    expect(u.nilai).toBe("bulan Mei 2026");
  });

  it("9944 lama pisah diambil angkanya", () => {
    expect(ambil(layanan.dariKeteranganSaksi(SAKSI_1, SAKSI_2), "9944").nilai).toBe("4 bulan");
  });

  it("7035 menjawab satu kata: siapa yang pergi", () => {
    const u = ambil(layanan.dariKeteranganSaksi(SAKSI_1, SAKSI_2), "7035");
    expect(u.nilai).toBe("Tergugat");
    expect(u.keyakinan).toBe("pasti");
  });

  it("1268 memakai kalimat baku, bukan menyalin kalimat saksi", () => {
    // Supaya rumusannya tidak berbeda antar majelis untuk fakta yang sama.
    const u = ambil(layanan.dariKeteranganSaksi(SAKSI_1, SAKSI_2), "1268");
    expect(u.nilai).toContain("namun tidak berhasil");
    expect(u.nilai).toContain("mendamaikan Penggugat dan Tergugat");
  });

  it("tiap usulan membawa kalimat asalnya beserta nomor saksinya", () => {
    // Tanpa ini, memeriksa satu usulan berarti membaca ulang dua blok
    // keterangan sepanjang layar.
    const u = ambil(layanan.dariKeteranganSaksi(SAKSI_1, SAKSI_2), "0246");
    expect(u.sumber.length).toBeGreaterThan(0);
    expect(u.sumber[0].kalimat).toContain("pisah tempat tinggal");
    expect([1, 2]).toContain(u.sumber[0].saksi);
  });

  it("saksi yang berselisih ditandai bentrok, bukan dipilih diam-diam", () => {
    // Selisih antar saksi adalah soal pembuktian. Memilih salah satunya
    // diam-diam menyembunyikan persoalan yang justru harus dibaca hakim.
    const lain = SAKSI_2.replace("sejak 2018", "sejak 2021");
    const u = ambil(layanan.dariKeteranganSaksi(SAKSI_1, lain), "0222");
    expect(u.keyakinan).toBe("bentrok");
    expect(u.bentrok).toBe("tahun 2021");
  });

  it("satu saksi saja berarti cukup, bukan pasti", () => {
    expect(ambil(layanan.dariKeteranganSaksi(SAKSI_1, ""), "7035").keyakinan).toBe("cukup");
  });

  it("keterangan kosong tidak menghasilkan nilai karangan", () => {
    const hasil = layanan.dariKeteranganSaksi("", "");
    for (const u of hasil.usulan) {
      expect(u.nilai).toBe("");
      expect(u.keyakinan).toBe("kosong");
    }
  });

  it("5227 hanya memuat alasan yang disebut KEDUA saksi", () => {
    // Keterangan seorang saksi tanpa penguat bukan alat bukti yang berdiri
    // sendiri. SAKSI_2 tidak menyebut cemburu, nafkah, maupun KDRT - hanya
    // SAKSI_1 - sehingga ketiganya TIDAK boleh masuk 5227.
    const hasil = layanan.dariKeteranganSaksi(SAKSI_1, SAKSI_2);
    const u = ambil(hasil, "5227");
    expect(u.nilai).not.toContain("Kekerasan Dalam Rumah Tangga");
    expect(u.nilai).not.toContain("kewajiban nafkah lahir");
    // Yang tersisa hanya perselisihan - dan kalimatnya berbentuk perselisihan
    // saja, bukan "Tergugat ..." dengan daftar perbuatan yang kosong.
    expect(u.nilai).toBe(
      "Antara Penggugat dan Tergugat terus-menerus terjadi perselisihan dan pertengkaran"
    );
  });

  it("yang hanya disebut satu saksi dikembalikan, bukan dibuang diam-diam", () => {
    // Alasan yang terbuang tanpa jejak adalah alasan yang akan disangka tidak
    // terbaca mesin. Panel menampilkannya beserta siapa yang menyebutnya.
    const hasil = layanan.dariKeteranganSaksi(SAKSI_1, SAKSI_2);
    const nama = hasil.ciriSepihak.map((x: { nama: string }) => x.nama);
    expect(nama).toContain("kekerasan dalam rumah tangga");
    expect(nama).toContain("tidak memberi nafkah");
    expect(nama).toContain("cemburu");
    // Seluruhnya dari saksi 1 - SAKSI_2 memang tidak menyebutkannya.
    expect(hasil.ciriSepihak.every((x: { saksi: number }) => x.saksi === 1)).toBe(true);
  });

  it("alasan yang bersesuaian tetap tersusun sebagai kalimat putusan", () => {
    // Kedua saksi menyebut hal yang sama - inilah keadaan yang seharusnya
    // menghasilkan kalimat lengkap, dan bunyinya harus persis.
    const sama = [
      "- Bahwa antara Penggugat dan Tergugat terjadi perselisihan dan pertengkaran sejak 2025;",
      "- Bahwa Tergugat tidak memberikan nafkah kepada Penggugat;",
      "- Bahwa Tergugat bersikap cemburu berlebihan;",
      "- Bahwa Tergugat melakukan kekerasan dalam rumah tangga terhadap Penggugat;",
    ].join("\n");
    const u = ambil(layanan.dariKeteranganSaksi(sama, sama), "5227");
    expect(u.nilai).toBe(
      "Tergugat melalaikan kewajiban nafkah lahir, bersikap cemburu berlebihan, serta " +
        "melakukan Kekerasan Dalam Rumah Tangga (KDRT) yang memicu perselisihan " +
        "terus-menerus dengan Penggugat"
    );
    // Kedua saksi mengatakannya - keyakinannya "pasti", bukan "cukup".
    expect(u.keyakinan).toBe("pasti");
  });
  it("huruf alasan perceraian TIDAK pernah dipilih sendiri", () => {
    // Satu huruf yang salah mengubah dasar hukum putusan. Petanya harus
    // diambil dari naskah resmi lebih dulu - lihat catatan usulkanHuruf().
    const hasil = layanan.dariKeteranganSaksi(SAKSI_1, SAKSI_2);
    expect(hasil.usulan.some((u) => u.kode === "8503")).toBe(false);
    expect(hasil.usulan.some((u) => u.kode === "4020")).toBe(false);
    expect(hasil.ciri.length).toBeGreaterThan(0);
  });

  it("tidak ada arti huruf yang ditulis dari ingatan di dalam kodenya", () => {
    const sumber = readFileSync(berkasLayanan, "utf8");
    expect(sumber).not.toContain("Pasal 19 huruf");
    expect(sumber).not.toContain("huruf f Peraturan Pemerintah");
  });
});

describe("penyunting di tempat pada halaman ABT", () => {
  it("menyimpan lewat rute ABT sendiri, bukan ke basis data", () => {
    // Apa pun yang masuk tetap melewati pemeriksaan ABT dan tercatat lewat
    // jalur yang sama dengan pengisian tangan.
    const isi = abtJs();
    expect(isi).toContain("/edit_data?no_var=");
    expect(isi).toContain('badan.set("aksi", "Simpan")');
  });

  it("tidak pernah menyentuh folder APS Badilag", () => {
    const isi = abtJs();
    expect(isi).not.toContain("_blangko_abt");
    expect(isi).not.toContain("file_penetapan");
  });

  it("tipe data dibaca dari ABT, tidak ditebak", () => {
    // Menebaknya berarti mengirim tanggal sebagai teks - dan ABT
    // menyimpannya tanpa mengeluh.
    const isi = abtJs();
    expect(isi).toContain('name="var_type"');
    expect(isi).toContain("function dapatDisimpan(tipe)");
  });

  it("jawaban 200 tanpa kalimat DATA DISIMPAN dianggap gagal", () => {
    // Mengaku berhasil karena statusnya 200 adalah cara paling halus
    // kehilangan satu isian.
    const isi = abtJs();
    expect(isi).toContain("DATA DISIMPAN");
    expect(isi).toContain("anggap belum tersimpan");
  });

  it("hanya baris yang ABT sendiri izinkan yang dapat disunting", () => {
    // Baris tanpa tombol edit isinya dihitung - data_sipp atau data_sql - dan
    // menyuntingnya hanya akan tertimpa pada pemuatan berikutnya.
    const isi = abtJs();
    expect(isi).toContain("item.selAksi.querySelector");
  });

  it("perkara_id dibaca dari tombol edit, bukan ditebak dari alamat", () => {
    // Alamat halaman ABT tersandi; yang menyimpan keduanya justru atribut
    // onclick pada tombol edit.
    const isi = abtJs();
    expect(isi).toContain("function jatiDiriPerkara()");
    expect(isi).toContain("load_form");
    expect(isi).toContain("perkTemp");
  });

  it("Esc membatalkan dan Ctrl+Enter menyimpan", () => {
    const isi = abtJs();
    expect(isi).toContain('peristiwa.key === "Escape"');
    expect(isi).toContain("peristiwa.ctrlKey || peristiwa.metaKey");
  });

  it("usulan yang bentrok tidak pernah tercentang sendiri", () => {
    const isi = abtJs();
    expect(isi).toContain('u.keyakinan !== "bentrok"');
  });

  it("variabel yang tidak ada di blangko yang dibuka dilewati", () => {
    const isi = abtJs();
    expect(isi).toContain("if (!item) continue;");
  });
});

describe("ekstensi terdaftar untuk halaman ABT", () => {
  it("abt.js dipasang pada halaman aps_badilag/abt", () => {
    const m = manifest();
    const abt = m.content_scripts.find((s) => (s.js || []).includes("abt.js"));
    expect(abt).toBeTruthy();
    // /aps_badilag/*, BUKAN /aps_badilag/abt/*. Alamat ABT yang sungguhan
    // memuat index.php di tengahnya - /aps_badilag/index.php/abt/... - dan
    // pola yang lebih sempit itu tidak pernah cocok satu halaman pun di
    // peladen. Di mesin setempat polanya memang sudah /aps_badilag/*, jadi
    // panelnya tampak biasa saja di sana; perbedaan itu yang membuatnya lama
    // tidak tertangkap.
    expect(abt?.matches).toContain("http://192.168.10.10/aps_badilag/*");
    expect(abt?.matches).not.toContain("http://192.168.10.10/aps_badilag/abt/*");
    expect(abt?.css).toContain("panel.css");
  });

  it("skrip SIPP TIDAK ikut berjalan di halaman ABT", () => {
    // Seluruh logikanya menganggap dirinya berada di SIPP; menjalankannya di
    // aplikasi lain hanya menghasilkan galat diam-diam. Dan bila keduanya
    // cocok pada satu alamat, panel-alat.js tersuntik DUA KALI ke halaman yang
    // sama - suntikan kedua melempar galat deklarasi ulang, dan panelnya mati
    // tanpa satu pesan pun.
    //
    // Diperiksa sebagai SIFAT, bukan sebagai daftar yang sama persis: sejak
    // 1.96.0 ada pola alamat setempat di samping pola peladen, dan daftar yang
    // dipatok akan menolak tiap pemasangan baru yang sah.
    const m = manifest();
    const sipp = m.content_scripts.find((s) => (s.js || []).includes("konten.js"));
    const abt = m.content_scripts.find((s) => (s.js || []).includes("abt.js"));
    expect(sipp?.matches?.length).toBeGreaterThan(0);

    for (const pola of sipp?.matches ?? []) {
      expect(pola, `pola SIPP ${pola} tidak boleh menjangkau halaman ABT`).not.toContain("aps_badilag");
    }

    // Dan sebaliknya: tidak satu pun pola ABT yang menjangkau jalur SIPP.
    for (const pola of abt?.matches ?? []) {
      expect(pola, `pola ABT ${pola} tidak boleh menjangkau halaman SIPP`).toContain("aps_badilag");
    }
  });

  it("abt.js ikut ditanam ke portal", () => {
    const daftar = readFileSync(path.resolve(process.cwd(), "scripts/susun-ekstensi.mjs"), "utf8");
    expect(daftar).toContain('"abt.js"');
  });
});

describe("nomor 5 - lama pisah dihitung sampai tanggal sidang", () => {
  it("dihitung dari 0246, bukan disalin dari kalimat saksi", () => {
    // "kira-kira 4 bulan" benar pada hari saksi diperiksa, dan mulai keliru
    // pada sidang berikutnya.
    const hasil = layanan.hitungLamaPisah("bulan Mei 2026", "22 September 2026");
    expect(hasil?.teks).toBe("4 bulan");
    expect(hasil?.totalBulan).toBe(4);
  });

  it("melewati satu tahun ditulis tahun dan bulan", () => {
    expect(layanan.hitungLamaPisah("bulan Januari 2024", "22/09/2026")?.teks).toBe("2 tahun 8 bulan");
  });

  it("tanggal sidang yang tidak terbaca tidak menghasilkan angka karangan", () => {
    // Lebih baik tidak mengusulkan apa pun daripada mengusulkan angka yang
    // dihitung dari tanggal yang salah dibaca.
    expect(layanan.hitungLamaPisah("bulan Mei 2026", "besok")).toBeNull();
    expect(layanan.hitungLamaPisah("entah kapan", "22 September 2026")).toBeNull();
  });

  it("sidang yang lebih awal daripada pisah ditolak, bukan jadi angka minus", () => {
    expect(layanan.hitungLamaPisah("bulan Mei 2026", "01/01/2026")).toBeNull();
  });

  it("hasil hitungan mengalahkan yang diucapkan, dan selisihnya disebut", () => {
    const saksi =
      "- Bahwa Penggugat dan Tergugat sudah pisah tempat tinggal sejak bulan Mei 2026, sudah sekitar 2 bulan;";
    const hasil = layanan.dariKeteranganSaksi(saksi, "", "22 September 2026");
    const u = hasil.usulan.find((x) => x.kode === "9944");
    expect(u?.nilai).toBe("4 bulan");
    expect(u?.catatan).toContain("2 bulan");
    expect(u?.dihitung).toBe(true);
  });
});

describe("nomor 4 - pemeriksa silang dua saksi", () => {
  it("selisih di luar keenam variabel pun ikut ditemukan", () => {
    // Berapa kali saksi melihat pertengkaran tidak punya variabelnya sendiri,
    // tetapi selisihnya sama beratnya bagi pembuktian.
    const a = "- Bahwa saksi melihat mereka bertengkar sebanyak 1 kali;";
    const b = "- Bahwa saksi melihat mereka bertengkar sebanyak 3 kali;";
    const hasil = layanan.dariKeteranganSaksi(a, b);
    const item = hasil.selisih.find((x) => x.hal.toLowerCase().includes("berapa kali"));
    expect(item).toBeTruthy();
    expect(item?.saksi1).toBe("1 kali");
    expect(item?.saksi2).toBe("3 kali");
  });

  it("dua saksi yang sepakat tidak menghasilkan selisih palsu", () => {
    const hasil = layanan.dariKeteranganSaksi(SAKSI_1, SAKSI_1);
    expect(hasil.selisih).toEqual([]);
  });
});

describe("nomor 6 - huruf alasan diambil dari naskah resmi", () => {
  it("huruf F berdiri di atas DUA naskah, bukan satu", () => {
    // Isinya sama, bunyinya tidak - dan selisih kata itu ikut tercetak ke
    // dalam putusan. Menampilkan salah satunya saja sama dengan memilihkan
    // naskah mana yang dikutip.
    const f = aturan.HURUF.find((h) => h.huruf === "F");
    expect(f?.dasar).toHaveLength(2);

    const pp = f?.dasar.find((d) => d.sumber.tautan.includes("peraturan.go.id"));
    expect(pp?.bunyi).toBe(
      "Antara suami dan isteri terus-menerus terjadi perselisihan dan pertengkaran dan tidak ada harapan akan hidup rukun lagi dalam rumah tangga"
    );

    const khi = f?.dasar.find((d) => d.sumber.tautan.includes("simbi.kemenag.go.id"));
    expect(khi?.bunyi).toBe(
      "antara suami dan isteri terus menerus terjadi perselisihan dan pertengkaran dan tidak ada harapan akan hidup rukun lagi dalam rumah tangga"
    );
    // Selisihnya disebut, bukan didiamkan.
    expect(khi?.catatanNaskah).toContain("terus menerus");
  });

  it("selisih kata antar naskah tidak pernah dicampur jadi satu kalimat", () => {
    // "pemabok" milik PP, "pemabuk" milik KHI. Mencampurnya menghasilkan
    // kutipan yang tidak ada di naskah mana pun.
    const a = aturan.HURUF.find((h) => h.huruf === "A");
    const pp = a?.dasar.find((d) => d.sumber.tautan.includes("peraturan.go.id"));
    const khi = a?.dasar.find((d) => d.sumber.tautan.includes("simbi.kemenag.go.id"));
    expect(pp?.bunyi).toContain("pemabok");
    expect(pp?.bunyi).not.toContain("pemabuk");
    expect(khi?.bunyi).toContain("pemabuk");
    expect(khi?.bunyi).not.toContain("pemabok");
  });

  it("usulan membawa SELURUH dasar huruf itu", () => {
    const usul = aturan.usulkan("perselisihan dan pertengkaran terus menerus");
    const f = usul.find((u) => u.huruf === "F");
    expect(f?.dasar).toHaveLength(2);
  });

  it("huruf H hanya punya SATU dasar, dan itu KHI", () => {
    // Pasal 19 PP itu berhenti di huruf f. Huruf g dan h hanya ada di KHI.
    const h = aturan.HURUF.find((x) => x.huruf === "H");
    expect(h?.siap).toBe(true);
    expect(h?.dasar).toHaveLength(1);
    expect(h?.dasar[0].bunyi).toBe(
      "peralihan agama atau murtad yang menyebabkan terjadinya ketidak rukunan dalam rumah tangga"
    );
    expect(h?.dasar[0].sumber.nama).toContain("Pasal 116 Kompilasi Hukum Islam");
    expect(h?.dasar[0].sumber.tautan).toContain("simbi.kemenag.go.id");
  });

  it("bunyi KHI disepakati DUA salinan resmi, bukan satu", () => {
    // Lapisan teks kedua terbitan itu hasil pindaian dan memuat salah baca -
    // salinan pertama bahkan menulis penanda hurufnya "k." alih-alih "h.".
    // Satu salinan saja tidak cukup untuk menyalin naskah hukum.
    const h = aturan.HURUF.find((x) => x.huruf === "H");
    expect(h?.dasar[0].sumber.pembanding).toBeTruthy();
    expect(h?.dasar[0].sumber.pembanding).not.toBe(h?.dasar[0].sumber.tautan);
  });

  it("tidak ada lagi huruf yang bunyinya belum diambil", () => {
    expect(aturan.belumSiap()).toEqual([]);
  });

  it("huruf H membawa syarat AKIBAT, bukan sekadar kata murtad", () => {
    // Murtadnya saja tidak cukup - ia harus menyebabkan ketidakrukunan, dan
    // itu fakta yang dibuktikan di persidangan.
    const usul = aturan.usulkan("Tergugat murtad dan pindah agama");
    const h = usul.find((u) => u.huruf === "H");
    expect(h).toBeTruthy();
    expect(h?.syarat).toContain("menyebabkan ketidakrukunan");
  });

  it("huruf B selalu membawa syarat jangka waktunya", () => {
    // Syaratnya angka, dan angka itu tidak dapat disimpulkan dari kata
    // kerjanya - hampir tiap perkara memuat kata "meninggalkan".
    const usul = aturan.usulkan("Tergugat pergi meninggalkan tempat kediaman bersama");
    const b = usul.find((u) => u.huruf === "B");
    expect(b?.syarat).toContain("2 (dua) tahun");
  });

  it("tidak satu pun huruf ditandai terpilih", () => {
    const usul = aturan.usulkan("perselisihan dan pertengkaran terus menerus");
    for (const u of usul) expect("terpilih" in u).toBe(false);
  });
});

describe("nomor 9 - pustaka kalimat baku", () => {
  it("kalimat upaya damai datang dari pustaka, bukan disusun di pemakainya", () => {
    expect(pustaka.kalimatUpayaDamai(true)).toContain("namun tidak berhasil");
    expect(pustaka.kalimatUpayaDamai(false)).not.toContain("namun tidak berhasil");
  });

  it("5227 disusun sebagai fakta hukum, bukan deretan kalimat saksi", () => {
    // Bentuk yang diminta, apa adanya: satu pelaku di depan, daftar perbuatan
    // tanpa mengulang subjek, penyambung "serta", lalu perselisihan sebagai
    // AKIBAT di ujung - bukan sebagai salah satu butir yang sejajar.
    const ciri = [
      "perselisihan terus-menerus",
      "kekerasan dalam rumah tangga",
      "tidak memberi nafkah",
      "cemburu",
    ];
    expect(pustaka.susunAlasan(ciri, { pelaku: "Tergugat", lawan: "Penggugat" })).toBe(
      "Tergugat melalaikan kewajiban nafkah lahir, bersikap cemburu berlebihan, serta " +
        "melakukan Kekerasan Dalam Rumah Tangga (KDRT) yang memicu perselisihan terus-menerus " +
        "dengan Penggugat"
    );
  });

  it("urutan kalimatnya tidak bergantung pada urutan ciri ditemukan", () => {
    // Ciri ditemukan menurut cara saksi bertutur, dan itu berbeda tiap
    // perkara. Kalimat putusan tidak boleh ikut berubah karenanya.
    const pihak = { pelaku: "Tergugat", lawan: "Penggugat" };
    const a = ["cemburu", "tidak memberi nafkah", "kekerasan dalam rumah tangga"];
    const b = ["kekerasan dalam rumah tangga", "cemburu", "tidak memberi nafkah"];
    expect(pustaka.susunAlasan(a, pihak)).toBe(pustaka.susunAlasan(b, pihak));
  });

  it("pelakunya Termohon pada cerai talak, bukan dipatok Tergugat", () => {
    // Dibaca dari variabel 0047 di halaman ABT, bukan diturunkan dari
    // klasifikasi perkara.
    const kalimat = pustaka.susunAlasan(["tidak memberi nafkah", "perselisihan terus-menerus"], {
      pelaku: "Termohon",
      lawan: "Pemohon",
    });
    expect(kalimat.startsWith("Termohon ")).toBe(true);
    expect(kalimat.endsWith("dengan Pemohon")).toBe(true);
  });

  it("subjeknya disebut SEKALI, tidak diulang tiap butir", () => {
    const kalimat = pustaka.susunAlasan(
      ["tidak memberi nafkah", "cemburu", "kekerasan dalam rumah tangga"],
      { pelaku: "Tergugat", lawan: "Penggugat" }
    );
    expect(kalimat.split("Tergugat").length - 1).toBe(1);
  });

  it("dua butir disambung tanpa koma sebelum serta", () => {
    // "A, serta B" bukan bentuk yang lazim - komanya memisahkan dua hal yang
    // justru sudah tersambung.
    const kalimat = pustaka.susunAlasan(["tidak memberi nafkah", "cemburu"], {
      pelaku: "Tergugat",
      lawan: "Penggugat",
    });
    expect(kalimat).toContain(" serta ");
    expect(kalimat).not.toContain(", serta ");
  });

  it("perselisihan sendirian memakai rumusan bersama", () => {
    // Tidak ada perbuatan untuk digantungi akibat, jadi kalimat berpelaku
    // tunggal tidak dapat disusun.
    expect(pustaka.susunAlasan(["perselisihan terus-menerus"], {
      pelaku: "Tergugat",
      lawan: "Penggugat",
    })).toBe("Antara Penggugat dan Tergugat terus-menerus terjadi perselisihan dan pertengkaran");
  });

  it("tanpa ciri sama sekali tidak menghasilkan kalimat karangan", () => {
    expect(pustaka.susunAlasan([], { pelaku: "Tergugat", lawan: "Penggugat" })).toBe("");
  });

  it("pustaka kalimat TIDAK memuat bunyi pasal", () => {
    // Yang menyatakan hukum hanya boleh disalin dari naskah resmi, dan
    // tempatnya abtAturanAlasan.js.
    const isi = readFileSync(
      path.resolve(process.cwd(), "../aleta_bot/services/abtKalimatBaku.js"),
      "utf8"
    );
    // Yang diperiksa DATA-nya, bukan catatannya: menyebut nama pasal di
    // dalam komentar justru berguna - ia menerangkan kenapa satu frasa
    // ditulis begitu. Yang dilarang bunyi pasalnya menjadi isi pustaka.
    const tanpaCatatan = isi
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ 	]*\/\/.*$/gm, "");
    expect(tanpaCatatan).not.toContain("Pasal 19");
    expect(tanpaCatatan).not.toContain("Undang-Undang");
  });
});

describe("nomor 8 - penjaga sebelum CETAK", () => {
  it("menahan tautan pratinjau cetak ABT", () => {
    const isi = abtJs();
    expect(isi).toContain("abt/preview");
    expect(isi).toContain("function periksaKelengkapan()");
  });

  it("variabel OTOMATIS yang masih berbunyi pesan galat ikut ditahan", () => {
    // Ini yang paling berbahaya: bunyinya seperti pesan galat mesin, tetapi
    // ia tercetak sebagai bagian pertimbangan hukum.
    const isi = abtJs();
    expect(isi).toContain("8521");
    expect(isi).toContain("8530");
    expect(isi).toContain("TIDAK BENAR QUERY NYA");
  });

  it("menahan lalu bertanya, bukan melarang", () => {
    // Ada perkara yang memang tidak memerlukan sebagian variabel itu.
    const isi = abtJs();
    expect(isi).toContain("Tetap lanjutkan ke pratinjau cetak?");
    expect(isi).toContain("window.confirm");
  });
});

describe("nomor 10 - riwayat dan urungkan", () => {
  it("tiap penyimpanan dicatat, lewat sunting tangan maupun usulan", () => {
    const isi = abtJs();
    expect(isi.split("catatRiwayat(").length - 1).toBeGreaterThanOrEqual(4);
    expect(isi).toContain("sunting tangan");
  });

  it("pengembalian ikut dicatat, tidak menghapus jejaknya sendiri", () => {
    // Riwayat yang menghapus jejaknya saat diurungkan membuat urutan
    // kejadiannya mustahil dibaca ulang.
    const isi = abtJs();
    expect(isi).toContain("dikembalikan");
  });

  it("batasnya disebut kepada yang membacanya", () => {
    const isi = abtJs();
    expect(isi).toContain("tersimpan di peramban ini saja");
  });
});

/**
 * ============================================================================
 * DUA FUNGSI PERAPIAN DIUJI SUNGGUHAN, BUKAN LEWAT SUMBERNYA
 * ============================================================================
 *
 * Keduanya murni - masuk teks, keluar teks - jadi tidak ada alasan hanya
 * menjaga bentuk kodenya. Sumbernya dipotong dari abt.js lalu dijalankan di
 * dalam vm; kalau potongannya berubah bentuk, pengujian ini gagal lebih dulu
 * daripada penggunanya.
 */
function fungsiRapikan() {
  const isi = abtJs();
  // rapikanPosita sudah pindah ke layanan bot - yang tersisa di sini hanya
  // pembersih keterangan saksi, yang memang bekerja atas teks yang tergambar.
  const awal = isi.indexOf("const POLA_PENUTUP = [");
  const akhir = isi.indexOf("// ─── Keterangan saksi: disunting");
  expect(awal).toBeGreaterThan(0);
  expect(akhir).toBeGreaterThan(awal);
  const konteks: { bersihkanKeteranganSaksi?: (t: string) => string } = {};
  vm.createContext(konteks);
  vm.runInContext(isi.slice(awal, akhir), konteks);
  return konteks as { bersihkanKeteranganSaksi: (t: string) => string };
}

/** rapikanTeksPosita kini milik layanan bot - dijalankan langsung dari sana. */
const layananPosita = require_(
  path.resolve(process.cwd(), "../aleta_bot/services/sippPositaService.js")
) as {
  rapikanTeksPosita: (t: string) => string;
  tanpaRuang: (t: string) => string;
};

describe("5227 disaring gugatan, bukan hanya kedua saksi", () => {
  // Data nyata perkara 510/Pdt.G/2026/PA.Dgl.
  const pihak = { pelaku: "Tergugat", lawan: "Penggugat" };
  const dasar =
    "- Bahwa antara Penggugat dan Tergugat sering terjadi perselisihan dan pertengkaran sejak 2025;";
  const nafkah = "- Bahwa Tergugat sudah tidak pernah memberikan nafkah kepada Penggugat;";
  const s1 = [
    dasar,
    "- Bahwa penyebab perselisihan adalah karena Tergugat suka berjudi online dan sering melakukan kekerasan fisik dengan memukul dan menampar Penggugat hingga memar disekitar bibir Penggugat;",
    nafkah,
  ].join("\n");
  const s2 = [
    dasar,
    "- Bahwa penyebab perselisihan adalah karena Tergugat suka berjudi online dan jika ditegur Tergugat marah dan memukul Penggugat hingga bengkak dileher Penggugat;",
    nafkah,
  ].join("\n");
  const GUGATAN = [
    "4. Bahwa sejak Oktober 2025 sering terjadi perselisihan dan pertengkaran secara terus menerus yang disebabkan karena",
    "a. Tergugat sering kali mabuk-mabukkan bersama teman-teman Tergugat dan jika dinasehati Penggugat, Tergugat selalu marah;",
    "b. Setiap kali terjadi pertengkaran Tergugat melakukan kekerasan fisik kepada Penggugat karena Tergugat tidak terima jika Penggugat menasehati Tergugat untuk berhenti bermain judi online;",
  ].join("\n");

  it("alasan yang terbukti tetapi TIDAK didalilkan dikeluarkan dari 5227", () => {
    // Kedua saksi menerangkan nafkah, tetapi gugatannya tidak pernah
    // mendalilkannya. Memasukkannya berarti memutus melebihi yang dituntut.
    const h = layanan.dariKeteranganSaksi(s1, s2, "", pihak, GUGATAN);
    expect(h.ciri).not.toContain("tidak memberi nafkah");
    expect(h.ciriDiluarGugatan).toContain("tidak memberi nafkah");
    expect(ambil(h, "5227").nilai).not.toContain("nafkah");
  });

  it("dalil yang belum dikuatkan kedua saksi disebut, bukan didiamkan", () => {
    // Gugatan mendalilkan mabuk; tidak satu saksi pun menerangkannya. Itu
    // dalil yang harus dibuktikan atau ditolak - bukan dilupakan.
    const h = layanan.dariKeteranganSaksi(s1, s2, "", pihak, GUGATAN);
    expect(h.ciriBelumTerbukti).toContain("mabuk");
    expect(ambil(h, "5227").nilai).not.toContain("pemabuk");
  });

  it("hasilnya persis alasan yang didalilkan DAN dibuktikan", () => {
    const h = layanan.dariKeteranganSaksi(s1, s2, "", pihak, GUGATAN);
    expect(ambil(h, "5227").nilai).toBe(
      "Tergugat melakukan Kekerasan Dalam Rumah Tangga (KDRT) serta menjadi penjudi " +
        "yang memicu perselisihan terus-menerus dengan Penggugat"
    );
  });

  it("judi tidak lagi menyeret mabuk dan obat terlarang", () => {
    // Satu frasa untuk tiga perbuatan membuat kalimatnya menuduh dua
    // perbuatan yang tidak diterangkan siapa pun.
    const h = layanan.dariKeteranganSaksi(s1, s2, "", pihak, GUGATAN);
    const nilai = ambil(h, "5227").nilai;
    expect(nilai).toContain("menjadi penjudi");
    expect(nilai).not.toContain("pemakai obat terlarang");
  });

  it("gugatan yang tidak terbaca TIDAK mengosongkan 5227", () => {
    // Gagal-terbuka di sini, dan sengaja: saringan yang mengosongkan hasil
    // karena gugatannya kebetulan tidak terbaca lebih merugikan daripada
    // saringan yang tidak berjalan - asalkan keadaannya disebut di layar.
    const h = layanan.dariKeteranganSaksi(s1, s2, "", pihak, "");
    expect(h.gugatanTerbaca).toBe(false);
    expect(h.ciri).toContain("tidak memberi nafkah");
    expect(ambil(h, "5227").nilai).toContain("nafkah");
  });
});
describe("nomor 6 - penomoran posita yang menempel", () => {
  // Disalin apa adanya dari layar ABT perkara 494/Pdt.G/2026/PA.Dgl.
  const POSITA =
    "1. Bahwa Penggugat MARIANA Binti MARENG adalah istri sah Tergugat FADIL Bin ALI YANGKA, " +
    "menikah tanggal 23 Oktober 2017 berdasarkan Buku Nikah nomor: 0129/011/X/2017 tanggal 23 Oktober 2017." +
    "2. Bahwa setelah menikah Penggugat dengan Tergugat bergaul sebagaimana layaknya suami dengan istri " +
    "di karuniai 2 (dua) orang anak, yakni:a. MUHAMMAD FATHIR Bin FADIL, umur 8 tahun, agama islam, " +
    "kelamin laki-laki,.b. FATHIYAH LASYIRA Binti FADIL, umur 6 tahun, agama islam, kelamin perempuan." +
    "3. Bahwa sejak awal pernikahan pada awal tahun 2018 Penggugat sudah mulai dianiaya.";

  const rapikan = (t: string) => layananPosita.rapikanTeksPosita(t);
  /**
   * Pemisah barisnya <p>...</p> sejak 1.123.0 - lihat paragrafkanButir di
   * layanannya. Tiap butir satu paragraf; yang dibaca di sini isinya.
   */
  const barisnya = (t: string) =>
    rapikan(t)
      .split("</p>")
      // Ruang di depan dipangkas lebih dulu: sejak pembatas kata kendali
      // ditambahkan, tiap potongan berawalan ganti baris sebelum <p>-nya.
      .map((x) => x.replace(/^\s*<p[^>]*>/, ""))
      .filter(Boolean);

  it("pemisahnya <p>, sebab <br> disapu SIPP tanpa bekas", () => {
    // TemplateHelper::cleanHtmlTagSpecial milik SIPP menerjemahkan </p>
    // menjadi \par dan TIDAK menerjemahkan <br> sama sekali - ia hanya disapu
    // filter_var. Ganti baris mentah pun bukan apa-apa bagi RTF. Yang
    // dimengerti SIPP dan ABT sekaligus hanya <p>.
    const hasil = rapikan(POSITA);
    expect(hasil).toContain("</p>");
    expect(hasil).not.toContain("<br>");
    // ======================================================================
    // GANTI BARIS SESUDAH </p> - PEMBATAS, BUKAN PEMISAH
    // ======================================================================
    //
    // cleanHtmlTagSpecial mengubah "</p>" menjadi "\\par" TANPA spasi, lalu
    // filter_var menyapu "<p>". Hasilnya "\\par2. Bahwa" - dan di RTF kata
    // kendali menyerap parameter angka yang menempel padanya, sehingga "2"
    // ditelan dan yang tercetak ". Bahwa". Paragraf berawalan huruf lebih
    // parah: "\\parKedua" dibaca sebagai kata kendali bernama "parKedua",
    // dan seluruh katanya hilang.
    //
    // Pemisahnya TETAP </p>. Yang ditambahkan satu ganti baris di belakangnya,
    // semata sebagai pembatas kata kendali - dan justru KARENA ganti baris
    // tidak berarti apa-apa bagi RTF, ia tidak menambah apa pun ke dokumen.
    //
    // Karena itu yang dilarang bukan ganti baris melainkan ganti baris yang
    // BERDIRI SENDIRI sebagai pemisah - yang memang tidak memisahkan apa pun.
    expect(hasil.split("</p>\n").join("</p>")).not.toContain("\n");
    // Butir pertama PERSIS "<p>1." - itu yang menyalakan \li630 di SIPP.
    expect(hasil.startsWith("<p>1.")).toBe(true);
  });

  it("tiap butir induk mendapat barisnya sendiri", () => {
    const baris = barisnya(POSITA);
    expect(baris[0].startsWith("1. Bahwa Penggugat MARIANA")).toBe(true);
    expect(baris.some((x) => x.startsWith("2. Bahwa setelah menikah"))).toBe(true);
    expect(baris.some((x) => x.startsWith("3. Bahwa sejak awal pernikahan"))).toBe(true);
  });

  it("anak butir diberi lekukan tiga spasi - itu yang jadi TAB di blangko", () => {
    // cleanHtmlTagSpecial menerjemahkan tiga spasi menjadi \tab. Itu pula
    // yang dimaksud petunjuk hijau di borang ABT.
    const baris = barisnya(POSITA);
    expect(baris.some((x) => x.startsWith("   a. MUHAMMAD FATHIR"))).toBe(true);
    expect(baris.some((x) => x.startsWith("   b. FATHIYAH LASYIRA"))).toBe(true);
  });

  it("TIDAK SATU HURUF PUN berubah - termasuk tanda bacanya", () => {
    // Yang boleh DITAMBAHKAN perapian hanya ruang kosong dan <br>; itu pula
    // yang dibuang pembandingnya. Bentuk lamanya membuang titik juga
    // (/[\\s.]+/), dan kelonggaran itulah yang menyembunyikan titik
    // yang hilang sampai pagar di layanan menolaknya.
    expect(layananPosita.tanpaRuang(rapikan(POSITA))).toBe(layananPosita.tanpaRuang(POSITA));
  });

  it("titik di antara dua anak butir TIDAK hilang", () => {
    const teks = "karena a. Tergugat sering mabuk bersama teman Tergugat.b. Setiap kali bertengkar.";
    const hasil = rapikan(teks);
    expect(hasil).toContain("teman Tergugat.");
    expect(layananPosita.tanpaRuang(hasil)).toBe(layananPosita.tanpaRuang(teks));
  });

  it("kata yang berakhir huruf lalu titik TIDAK dipecah jadi butir", () => {
    // "...Usia 5 tahun. Saat ini anak tersebut..." dulu terpecah menjadi
    // "tahu" lalu butir baru "n. Saat ini". Terlihat di dokumen Word yang
    // dilaporkan. Pagar isi tidak menangkapnya - dan tidak seharusnya: tidak
    // ada huruf yang hilang, hanya berpindah baris.
    const teks = "anak bernama Mikhayla, Usia 5 tahun. Saat ini anak tersebut ikut Penggugat;";
    const hasil = rapikan(teks);
    expect(hasil).toContain("Usia 5 tahun. Saat ini");
    expect(hasil).not.toContain("tahu<br>");
  });

  it("angka di dalam kalimat TIDAK dipecah jadi butir", () => {
    // Aturan yang sama pada butir induk: "berjumlah 15. Bahwa" jangan sampai
    // terpecah menjadi "1" dan butir baru "5.".
    const teks = "Bahwa anaknya berjumlah 15. Bahwa seluruhnya ikut Penggugat;";
    expect(rapikan(teks)).toContain("berjumlah 15. Bahwa");
  });

  it("posita yang SUDAH berupa HTML tidak ditambahi pemisah lagi", () => {
    // 6.269 dari 8.097 posita di PA Donggala memuat </p> - itulah yang
    // tercetak rapi selama ini. Menambahkan <br> di sela-selanya menghasilkan
    // baris kosong berganda di dokumen.
    const teks = "<p>1. Bahwa satu.</p>\n<p>2. Bahwa dua.</p>";
    expect(rapikan(teks)).not.toContain("</p><br>");
  });

  it("teks yang sudah berparagraf tidak disusun ulang", () => {
    // 6.269 dari 8.097 posita di PA Donggala sudah memakai <p> dan tercetak
    // rapi selama ini - menyusunnya ulang mempertaruhkan semuanya.
    const rapi = "<p>1. Bahwa satu.</p><p>2. Bahwa dua.</p>";
    // Tidak disusun ulang: butirnya tetap, urutannya tetap, isinya tetap.
    // Yang ditambahkan hanya pembatas kata kendali sesudah </p> - lihat
    // catatan pada penjaga pemisah di atas.
    expect(rapikan(rapi)).toBe("<p>1. Bahwa satu.</p>\n<p>2. Bahwa dua.</p>");
    expect(rapikan(rapi).split("\n").join("")).toBe(rapi);
  });

  it("teks yang dulu dirapikan dengan <br> naik ke <p> tanpa satu huruf berubah", () => {
    const lama = "1. Bahwa satu.<br>2. Bahwa dua.";
    const hasil = rapikan(lama);
    expect(hasil).toBe("<p>1. Bahwa satu.</p>\n<p>2. Bahwa dua.</p>");
    expect(layananPosita.tanpaRuang(hasil)).toBe(layananPosita.tanpaRuang(lama));
  });
});
describe("nomor 8 - kalimat penutup keterangan saksi", () => {
  const SAKSI = [
    "- Bahwa yang meninggalkan tempat tinggal bersama adalah Tergugat;",
    "- Bahwa Penggugat dan Tergugat sudah pernah diupayakan untuk dirukunkan oleh keluarga, namun tidak berhasil;",
    "- Bahwa sudah cukup;",
    "",
    "",
  ].join("\n");

  it("Bahwa sudah cukup dibuang", () => {
    const { bersihkanKeteranganSaksi } = fungsiRapikan();
    expect(bersihkanKeteranganSaksi(SAKSI)).not.toMatch(/sudah cukup/i);
  });

  it("Bahwa tidak sanggup lagi dibuang", () => {
    const { bersihkanKeteranganSaksi } = fungsiRapikan();
    const teks = "- Bahwa saksi kenal Penggugat;\n- Bahwa tidak sanggup lagi;";
    expect(bersihkanKeteranganSaksi(teks)).not.toMatch(/tidak sanggup/i);
  });

  it("baris kosong di bawahnya ikut hilang", () => {
    // Baris kosong di ujung variabel menjadi paragraf hampa di dokumen cetak,
    // dan paragraf hampa di tengah pertimbangan terlihat seperti ada yang
    // terhapus.
    const { bersihkanKeteranganSaksi } = fungsiRapikan();
    const hasil = bersihkanKeteranganSaksi(SAKSI);
    expect(hasil.endsWith("berhasil;")).toBe(true);
    expect(/\n\s*$/.test(hasil)).toBe(false);
  });

  it("butir yang berisi fakta TIDAK dibuang", () => {
    // Daftar penutupnya ditulis tegas, bukan ditebak dari panjang kalimat -
    // kalimat pendek di tengah keterangan bisa saja fakta yang menentukan.
    const { bersihkanKeteranganSaksi } = fungsiRapikan();
    const hasil = bersihkanKeteranganSaksi(SAKSI);
    expect(hasil).toContain("meninggalkan tempat tinggal bersama");
    expect(hasil.split("\n").filter((x) => x.trim()).length).toBe(2);
  });

  it("kalimat yang MEMUAT kata cukup di tengahnya tidak ikut terbuang", () => {
    const { bersihkanKeteranganSaksi } = fungsiRapikan();
    const teks = "- Bahwa nafkah yang diberikan Tergugat tidak pernah cukup untuk anak-anaknya;";
    expect(bersihkanKeteranganSaksi(teks)).toContain("tidak pernah cukup");
  });
});

describe("nomor 4 - huruf alasan dapat dicentang dan diterapkan", () => {
  it("centangannya menulis 8503 SAJA - 4020 dihitung ABT sendiri", () => {
    // Dibaca dari definisi variabelnya di basis data ABT: 4020 bertipe
    // data_sql, dan kuerinya satu CASE panjang atas #8503#. Ia tidak
    // menyimpan apa pun - ia MEMBACA 8503. Menulisinya mustahil (rute
    // edit_data hanya menerima data_teks dan data_tanggal) dan sekaligus
    // tidak perlu.
    const isi = abtJs();
    expect(isi).toContain('"Tuliskan huruf alasan"');
    expect(isi).not.toContain('["8503", isi8503], ["4020", isi4020]');
    expect(isi).not.toContain("const isi4020");
  });

  it("8503 ditulis rapat, tanpa koma dan tanpa spasi", () => {
    // Regexp tiap cabang kueri 4020 BERJANGKAR di kedua ujung, dan tidak satu
    // pun cabang menerima "A, F". Bentuk lama itu membuat 8503 tampak benar
    // di layar sementara 4020 diam-diam jatuh ke cabang ELSE.
    const isi = abtJs();
    expect(isi).toContain("function susun8503(");
    expect(isi).toContain('bersih.join("")');
    expect(isi).not.toContain('dipilih.join(", ")');
  });

  it("gabungan yang tidak dikenali kueri 4020 disebutkan saat menulis", () => {
    // Yang tidak dikenali membuat 4020 berbunyi "TIDAK BENAR QUERY NYA /
    // BELUM ISI ALASAN DI KOLOM ABT" - dan kalimat itu ikut tercetak ke dalam
    // putusan. Disalin apa adanya dari kuerinya: hanya A, B, F, H
    // sendiri-sendiri, AB, AF, BF, dan ABF yang punya cabang.
    const isi = abtJs();
    expect(isi).toContain('GABUNGAN_4020 = new Set(["A", "B", "F", "H", "AB", "AF", "BF", "ABF"])');
    expect(isi).toContain("function dikenali4020(");
    expect(isi).toContain("tidak mengenali gabungan ini");
  });

  it("4020 ikut diperiksa penjaga cetak, sebab ISI_KOSONG tidak menangkapnya", () => {
    // ISI_KOSONG berjangkar di kedua ujung, sehingga kalimat panjang
    // "TIDAK BENAR QUERY NYA / BELUM ISI ALASAN DI KOLOM ABT" tidak cocok
    // dengannya - 4020 yang rusak akan lolos tanpa satu pun peringatan.
    const isi = abtJs();
    const potong = isi.slice(isi.indexOf("const VAR_OTOMATIS"), isi.indexOf("ISI_KOSONG ="));
    expect(potong).toContain('"4020"');
  });

  it("huruf yang bersyarat tidak pernah tercentang sendiri", () => {
    // Huruf B menuntut dua tahun berturut-turut, huruf H menuntut akibat
    // ketidakrukunan - keduanya fakta yang dibuktikan, bukan kesimpulan dari
    // kata kunci.
    const isi = abtJs();
    expect(isi).toContain("centang.checked = !h.syarat;");
  });

  it("penerapannya ikut dicatat di riwayat", () => {
    const isi = abtJs();
    expect(isi).toContain('cara: "centangan huruf alasan"');
  });
});

describe("nomor 5 - lencana bulat yang memakan tempat dibuang", () => {
  it("nama naskah bukan lagi lencana", () => {
    const isi = abtJs();
    const potong = isi.slice(isi.indexOf("function gambarHuruf"), isi.indexOf("function gambarUsulan"));
    expect(potong).not.toContain('"aleta-abt-asal"');
    expect(potong).toContain('"aleta-abt-naskah"');
  });

  it("selisih antar saksi juga tidak memakai lencana", () => {
    const isi = abtJs();
    const potong = isi.slice(isi.indexOf("function gambarSelisih"), isi.indexOf("function gambarHuruf"));
    expect(potong).not.toContain('"aleta-abt-asal"');
  });
});

describe("nomor 7 - riwayat muncul saat diklik", () => {
  it("wadahnya di ATAS, bukan di kaki panel", () => {
    // Panel dibatasi tiga per lima layar dan isinya menggulung sendiri; wadah
    // di kaki panel berarti daftarnya digambar di luar pandangan, dan yang
    // menekannya menyimpulkan tombolnya rusak.
    const isi = abtJs();
    expect(isi.indexOf("const wadahRiwayat")).toBeLessThan(isi.indexOf("const wadahSelisih"));
  });

  it("digulung ke pandangan sesudah digambar, termasuk saat kosong", () => {
    const isi = abtJs();
    expect(isi.split("wadahRiwayat.scrollIntoView").length - 1).toBeGreaterThanOrEqual(3);
  });
});

describe("nomor 2 - tema dipasang sebelum halaman digambar", () => {
  const temaAwal = () =>
    readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/tema-awal.js"), "utf8");

  it("berjalan pada document_start, di SIPP maupun ABT", () => {
    const m = manifest() as unknown as {
      content_scripts: { js?: string[]; matches: string[]; run_at?: string }[];
    };
    const awal = m.content_scripts.find((x) => (x.js || []).includes("tema-awal.js"));
    expect(awal?.run_at).toBe("document_start");
    expect(awal?.matches).toContain("http://192.168.10.10/SIPP/*");
    // Temanya pun tidak pernah sampai ke ABT peladen selama polanya sempit.
    expect(awal?.matches).toContain("http://192.168.10.10/aps_badilag/*");
  });

  it("dibaca dari localStorage yang SINKRON, bukan chrome.storage", () => {
    // chrome.storage hanya asinkron; apa pun yang menunggunya selesai sesudah
    // gambar pertama, dan kelebat putihnya tidak dapat dihilangkan.
    // Catatannya memang MENYEBUT chrome.storage - justru untuk menerangkan
    // kenapa ia tidak dipakai di sini. Yang diperiksa kodenya, bukan
    // kalimatnya.
    const isi = temaAwal().replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(isi).toContain("window.localStorage.getItem");
    expect(isi).not.toContain("chrome.storage");
  });

  it("tiga keadaan dibedakan, supaya yang mematikannya tidak berkelebat gelap", () => {
    const isi = temaAwal();
    expect(isi).toContain('tersimpan === "mati"');
    expect(isi).toContain('if (tema === "gelap")');
  });

  it("salinannya ditulis ulang tiap kali tema berubah", () => {
    const isi = readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/konten.js"), "utf8");
    expect(isi).toContain("function simpanSalinanTema()");
    expect(isi).toContain('window.localStorage.setItem(KUNCI_SALINAN_TEMA, nilai)');
  });
});

describe("nomor 1 - tema jendela popup", () => {
  it("tiga keadaan, satu tombol", () => {
    const js = popupJs();
    expect(js).toContain('const URUTAN_TEMA = ["ikut", "terang", "gelap"];');
    expect(popupHtml()).toContain('id="tombolTema"');
  });

  it("pilihan terang menang atas peramban yang gelap", () => {
    // Tanpa penjagaan itu, peramban gelap mengalahkan pilihan orangnya.
    expect(popupHtml()).toContain(':root:not([data-tema="terang"])');
    expect(popupHtml()).toContain(':root[data-tema="gelap"]');
  });

  it("disimpan di penyimpanan ekstensi, bukan localStorage", () => {
    // Jendela ini hidup di origin chrome-extension:// dan tidak berbagi apa
    // pun dengan halaman SIPP.
    const js = popupJs();
    expect(js).toContain('penyimpanan.set({ [KUNCI_TEMA_POPUP]: temaPopup })');
  });
});

describe("nomor 3 - panel ABT lengkap perkakasnya", () => {
  const alat = () =>
    readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/panel-alat.js"), "utf8");

  it("dimuat SEBELUM abt.js, supaya fungsinya sudah ada saat panel disusun", () => {
    // Dua berkas dalam satu entri content_scripts berbagi lingkup dan berjalan
    // menurut urutannya. Urutan yang tertukar berarti abt.js memanggil fungsi
    // yang belum ada.
    const m = manifest();
    const entri = m.content_scripts.find((x) => (x.js || []).includes("abt.js"));
    expect(entri?.js).toEqual(["panel-alat.js", "abt.js"]);
  });

  it("tujuh perkakas ada semuanya", () => {
    const isi = alat();
    for (const nama of [
      "alatPasangGeser",
      "alatPasangUbahUkuran",
      "alatKembalikanBawaan",
      "alatJepitTinggi",
      "alatTerapkanPosisi",
      "alatTombolKepala",
      "alatPasangPanel",
    ]) {
      expect(isi).toContain(`function ${nama}`);
    }
  });

  it("lima tombol kepala: tema, ciut, layar penuh, bawaan, tutup", () => {
    const isi = alat();
    for (const kelas of [
      "aleta-tema",
      "aleta-lipat",
      "aleta-penuh",
      "aleta-bawaan",
      "aleta-matikan",
    ]) {
      expect(isi).toContain(kelas);
    }
  });

  it("layar penuh dan keluar darinya memakai SATU tombol", () => {
    // Tombol keluar yang terpisah hanya berguna satu kali dan menganggur
    // selebihnya - sedangkan ruang di kepala panel selebar tiga ratus piksel.
    const isi = alat();
    expect(isi).toContain('penuh.title = sedang ? "Keluar dari layar penuh" : "Layar penuh";');
  });

  it("tingginya dijepit juga pada pemuatan PERTAMA", () => {
    // Cacat yang ditemukan pengujian di peramban: alatTerapkanPosisi keluar
    // lebih awal ketika belum ada posisi tersimpan, sehingga panel yang baru
    // muncul setinggi isinya - terukur 672 dari 800 piksel, bukan tiga per
    // lima yang dijanjikan.
    const isi = alat();
    const potong = isi.slice(isi.indexOf("async function alatPasangPanel"));
    // Bentuknya berubah sejak keadaan lencana ikut dipulihkan: posisinya
    // dibaca ke dalam peubah lebih dulu, sebab ia dipakai dua kali.
    expect(potong).toContain("const posisiTersimpan = await alatMuatPosisi(kunci);");
    expect(potong).toContain("alatTerapkanPosisi(panel, posisiTersimpan);");
    expect(potong.slice(potong.indexOf("alatTerapkanPosisi"))).toContain("alatJepitTinggi(panel);");
  });

  it("posisi panel ABT disimpan di kuncinya sendiri, temanya bersama", () => {
    // Berbagi kunci posisi berarti menggeser panel di satu aplikasi
    // memindahkan panel di aplikasi lain. Tema justru sebaliknya: yang memilih
    // gelap memilihnya untuk matanya, bukan untuk satu halaman.
    const isi = abtJs();
    expect(isi).toContain('const KUNCI_POSISI_ABT = "posisiPanelAbt";');
    expect(isi).toContain('const KUNCI_TEMA_PANEL = "temaPanel";');
  });

  it("tombol di dalam kepala tidak ikut menggeser panel", () => {
    // Yang menekan tombol tutup tidak sedang memindahkan panel. Sejak 1.128.0
    // baris pemilih warna ikut dikecualikan: ia melayang DI ATAS kepala, dan
    // menekan celah antar titiknya tidak boleh menyeret panelnya.
    const isi = alat();
    expect(isi).toContain('peristiwa.target.closest("button, a, input, select, textarea, .aleta-warna-pilih")');
  });

  it("memakai pointer event, bukan mouse event", () => {
    // Satu jalur untuk tetikus, sentuh, dan pena; dan setPointerCapture
    // menahan tarikan cepat yang keluar dari jendela.
    const isi = alat();
    expect(isi).toContain("setPointerCapture");
    expect(isi).not.toContain("mousedown");
  });

  it("DELAPAN pegangan ubah ukuran, sama seperti panel SIPP", () => {
    // Yang dilaporkan: panel ABT tidak dapat ditarik, panel SIPP bisa.
    // Sebabnya bukan pegangannya tidak ada - ia ada, satu, 12 x 12 piksel,
    // tembus pandang, di sudut KIRI-bawah. Yang ditarik orang sudut
    // kanan-bawah, tempat petunjuknya digambar dan tempat hampir setiap
    // jendela dapat diubah ukurannya.
    const isi = alat();
    expect(isi).toContain("const ALAT_ARAH_TARIK = [");
    expect(isi).toContain('"aleta-tarik aleta-tarik--" + arah.nama');
    for (const arah of ["u", "s", "b", "t", "ub", "ut", "sb", "st"]) {
      expect(isi, arah).toContain(`nama: "${arah}"`);
    }
    // Kelas pegangannya yang SUDAH ada di panel.css, bukan kelas baru.
    expect(isi).toContain('pegangan.classList.add("aleta-tarik--sudut")');
  });

  it("tarikan didengarkan document, bukan pegangan selebar 12 piksel", () => {
    // Tarikan cepat membuat penunjuk meninggalkan kotak itu dalam satu
    // gerakan, dan pegangan yang mendengarkan dirinya sendiri kehilangan
    // tarikannya di tengah jalan.
    const isi = alat();
    const potong = isi.slice(isi.indexOf("function alatPasangUbahUkuran"));
    expect(potong).toContain('document.addEventListener("pointermove", saatGerak)');
    expect(potong).toContain('document.addEventListener("pointerup", saatLepas)');
  });

  it("utang duplikasinya dicatat, bukan didiamkan", () => {
    // Fungsi yang sama masih ada di konten.js. Itu melanggar aturan yang
    // dipegang di tempat lain, jadi alasannya harus tertulis di berkasnya.
    const isi = alat();
    expect(isi).toContain("KENAPA BERKAS BARU, DAN BUKAN MEMAKAI YANG DI konten.js");

    // Yang dijaga ISI catatannya, bukan satu frasa di dalamnya. Frasa
    // "utangnya dicatat" yang dijaga sebelumnya hilang ketika catatan ini
    // ditulis ulang menjadi lebih lengkap - uji gagal atas catatan yang
    // justru membaik, dan cara ia gagal menuntun ke perbaikan yang salah:
    // mengembalikan kalimat lama demi lolosnya uji.
    //
    // Yang harus tetap ada tiga hal, sebab ketiganya yang membuat catatan ini
    // berguna bagi orang berikutnya: apa yang masih kembar, kenapa belum
    // dilunasi, dan aturan apa yang berlaku sementara itu.
    // Diperiksa dengan spasi DIRAPATKAN. Prosa di dalam komentar dipenggal
    // baris di tempat yang ditentukan penulisnya, dan penjaga yang menuntut
    // frasa utuh akan gagal setiap kali kalimatnya dipindah barisnya - gagal
    // atas catatan yang tidak berubah sepatah kata pun. Itu sudah terjadi
    // sekali di sini, dan cara ia gagal menuntun ke perbaikan yang salah.
    //
    // Tanda bintang awal barisnya DIBUANG lebih dulu. Merapatkan spasi saja
    // tidak cukup pada komentar blok: "fungsi BARU\n * ditulis" menjadi
    // "fungsi BARU * ditulis", dan frasanya tetap tidak ketemu - gagal yang
    // tampak seperti catatannya hilang padahal ia utuh.
    const rapat = isi
      .replace(/\n\s*\*\s?/g, " ")
      .replace(/\s+/g, " ");
    expect(rapat, "apa yang masih kembar").toContain("masih kembar");
    expect(rapat, "kenapa belum dilunasi").toContain("tidak dapat dibuka");
    expect(rapat, "aturan sementara").toContain("fungsi BARU ditulis di sini saja");
  });
});

describe("nomor 9 - satu tekanan CETAK, tiga berkas", () => {
  const cetak = () =>
    readFileSync(path.resolve(process.cwd(), "../aleta_bot/services/abtCetakService.js"), "utf8");
  const dockerfile = () =>
    readFileSync(path.resolve(process.cwd(), "../aleta_bot/Dockerfile"), "utf8");

  it("RTF diambil dari alamat tautan CETAK itu sendiri", () => {
    // Bukan alamat yang disusun ulang: tautannya sudah memuat enc_dir,
    // enc_file, perkara_id, dan perk_temp yang tersandi, dan menyusunnya ulang
    // berarti menyandikan ulang apa yang sudah benar.
    const isi = abtJs();
    expect(isi).toContain("terbitkanTigaBerkas(tautan.href, jatiDiri, lapor)");
  });

  it("RTF diunduh SEGERA, sebelum dua langkah berikutnya", () => {
    // Kalau PDF atau anonimnya gagal, yang paling dibutuhkan sudah di tangan.
    const isi = abtJs();
    const potong = isi.slice(isi.indexOf("async function terbitkanTigaBerkas"));
    expect(potong.indexOf('hasil.rtf = "tersimpan"')).toBeLessThan(potong.indexOf("ALETA_API_PDF"));
    expect(potong.indexOf('hasil.rtf = "tersimpan"')).toBeLessThan(potong.indexOf("main/anonim"));
  });

  it("PDF dibuat dari RTF yang BUKAN anonim", () => {
    // Yang ditandatangani putusannya, bukan versi anonimnya. Anonimnya untuk
    // diunggah ke direktori putusan, dan di sana bentuk yang diminta RTF.
    const isi = abtJs();
    // Dipotong sampai penanda bagian ketiga, bukan sampai kalimat kabarnya -
    // catatan pembuka bagian ketiga sudah menyebut "anonim", dan memasukkannya
    // ke dalam potongan membuat penjaga ini berbunyi atas catatannya sendiri.
    const potong = isi.slice(
      isi.indexOf("Mengubah menjadi PDF"),
      isi.indexOf("// ── 3. Anonim")
    );
    expect(potong).toContain("base64DariBuffer(isiRtf)");
    expect(potong).not.toContain("anonim");
  });

  it("anonimisasi dikerjakan ABT, bukan disalin ke ALETA", () => {
    // Aturan penyamarannya - nama, NIK, alamat, pekerjaan, nomor kutipan akta
    // nikah, surel - sudah ditetapkan di ABT. Menyalinnya berarti dua aturan
    // yang akan berselisih diam-diam.
    const isi = abtJs();
    expect(isi).toContain('borang.set("perkara_id"');
    expect(isi).toContain('borang.set("perkara_no"');
    expect(isi).toContain('"file_putusan"');
    expect(isi).toContain("/main/anonim");
  });

  it("jawaban 200 yang bukan RTF dianggap gagal", () => {
    // ABT menjawab 200 baik untuk RTF anonim maupun untuk halaman berisi
    // keterangan gagal. Halaman HTML yang tersimpan sebagai .rtf adalah
    // kegagalan yang paling sulit dikenali.
    const isi = abtJs();
    expect(isi).toContain("Proses Anonim Gagal");
    expect(isi).toContain("ABT tidak mengembalikan berkas RTF");
  });

  it("satu langkah gagal tidak menghentikan langkah lain", () => {
    const isi = abtJs();
    expect(isi).toContain("RTF ${hasil.rtf} · PDF ${hasil.pdf} · anonim ${hasil.anonim}");
  });

  it("nama berkas disusun ALETA, bukan diambil dari header ABT", () => {
    // Nama blangko memuat kurung siku dan garis miring - "[01] [Kabul
    // Verstek] Cerai (Format Lengkap)" - dan yang bergaris miring tidak dapat
    // menjadi nama berkas di mana pun.
    const isi = abtJs();
    expect(isi).toContain("function namaBerkas(");
    expect(isi).toContain('replace(/[\\\\/:*?"<>|]+/g, "_")');
  });

  it("saklarnya bawaannya MATI dan dibaca sebelum klik", () => {
    // chrome.storage hanya asinkron, dan pendengar klik harus memutuskan
    // SEKARANG apakah tautannya ditahan.
    const isi = abtJs();
    expect(isi).toContain("let cetakTigaMenyala = false;");
    expect(isi).toContain("if (!cetakTigaMenyala) return;");
    expect(popupJs()).toContain("simpan.cetakTigaBerkas === true");
  });

  it("perubahan saklar dari popup berlaku seketika", () => {
    // Yang baru menyalakannya lalu menekan CETAK tidak seharusnya mendapat
    // satu berkas karena halamannya belum disegarkan.
    const isi = abtJs();
    expect(isi).toContain("chrome.storage.onChanged.addListener");
  });

  it("penjaga kelengkapan berjalan LEBIH DULU", () => {
    // Menerbitkan putusan yang barusan diputuskan belum siap adalah kebalikan
    // dari apa yang diminta penjaga itu.
    const isi = abtJs();
    expect(isi).toContain("if (peristiwa.defaultPrevented) return;");
  });
});

describe("nomor 9 - layanan konversi RTF ke PDF", () => {
  const cetak = () =>
    readFileSync(path.resolve(process.cwd(), "../aleta_bot/services/abtCetakService.js"), "utf8");
  const layananPdf = require_(
    path.resolve(process.cwd(), "../aleta_bot/services/abtCetakService.js")
  ) as {
    rtfKePdf: (b: Buffer) => Promise<{ ok: boolean; alasan?: string }>;
    periksaMesin: () => Promise<{ ada: boolean; sebab?: string; versi?: string }>;
    BATAS_BYTE: number;
  };

  it("berkas kosong ditolak", async () => {
    expect((await layananPdf.rtfKePdf(Buffer.alloc(0))).alasan).toContain("kosong");
  });

  it("yang bukan RTF ditolak dari ISINYA, bukan dari namanya", async () => {
    // Nama berkas dan tipe yang dikirim dapat ditulis siapa saja.
    const hasil = await layananPdf.rtfKePdf(Buffer.from("%PDF-1.4 berpura-pura rtf"));
    expect(hasil.ok).toBe(false);
    expect(hasil.alasan).toContain("bukan berkas RTF");
    expect(cetak()).toContain('subarray(0, 5).toString("latin1")');
  });

  it("berkas kebesaran ditolak sebelum soffice dijalankan", async () => {
    const hasil = await layananPdf.rtfKePdf(Buffer.alloc(layananPdf.BATAS_BYTE + 1, 0x41));
    expect(hasil.ok).toBe(false);
    expect(hasil.alasan).toContain("melewati batas");
  });

  it("mesin yang tidak ada disebutkan sebabnya, bukan 'gagal'", async () => {
    // Diuji di lingkungan pengembangan yang memang tidak punya soffice -
    // itulah keadaan yang harus terbaca jelas, sebab ia yang paling mungkin
    // terjadi sesudah pemasangan yang lupa memuat LibreOffice.
    const mesin = await layananPdf.periksaMesin();
    if (mesin.ada) {
      expect(mesin.versi).toContain("LibreOffice");
    } else {
      expect(mesin.sebab).toContain("LibreOffice");
    }
  });

  it("folder sekali pakai dibuang berhasil maupun gagal", async () => {
    // Folder yang tertinggal berisi putusan lengkap beserta nama pihaknya.
    const isi = cetak();
    expect(isi).toContain("await fs.mkdtemp(");
    const potong = isi.slice(isi.indexOf("} finally {"));
    expect(potong).toContain("fs.rm(folder, { recursive: true, force: true })");
  });

  it("nama berkas ditentukan di dalam, bukan diterima dari luar", async () => {
    // Nama dari luar dapat memuat "../" dan menulis ke tempat yang tidak
    // dimaksudkan.
    const isi = cetak();
    expect(isi).toContain('path.join(folder, "putusan.rtf")');
    expect(isi).toContain('path.join(folder, "putusan.pdf")');
  });

  it("soffice punya profil tersendiri per konversi", async () => {
    // Dua konversi bersamaan yang berbagi profil bertengkar, dan salah satunya
    // gagal tanpa keterangan - cara yang sama dipakai ABT.
    expect(cetak()).toContain("-env:UserInstallation=file://");
  });

  it("hasilnya diperiksa benar PDF, bukan sekadar ada", async () => {
    expect(cetak()).toContain('startsWith("%PDF-")');
  });

  it("LibreOffice terpasang di image bot", () => {
    // Mesin yang SAMA dengan yang dipakai ABT untuk mengubah docx ke rtf.
    const isi = dockerfileBot();
    expect(isi).toContain("libreoffice-writer");
    expect(isi).toContain("fonts-liberation");
  });

  it("batas badan dinaikkan HANYA untuk rute konversi", () => {
    // Menaikkan batas umum berarti membuka tiap rute lain untuk badan puluhan
    // megabita, tanpa satu pun yang membutuhkannya.
    const app = readFileSync(path.resolve(process.cwd(), "../aleta_bot/app.js"), "utf8");
    expect(app).toContain('app.use("/internal/aleta-bot/abt/pdf", express.json({ limit: "28mb" }))');
    expect(app).toContain('app.use(express.json({ limit: "1mb" }))');
    expect(app.indexOf('"/internal/aleta-bot/abt/pdf"')).toBeLessThan(
      app.indexOf('app.use(express.json({ limit: "1mb" }))')
    );
  });

  it("batas waktu konversi lebih longgar daripada batas gerbang biasa", () => {
    // Dengan batas bawaan 8 detik, konversi PERTAMA tiap hari selalu gagal
    // dengan sebab yang menyesatkan.
    const klien = readFileSync(
      path.resolve(process.cwd(), "src/server/modules/aleta-bot/whatsapp-gateway-client.ts"),
      "utf8"
    );
    expect(klien).toContain("TIMEOUT_KONVERSI_MS");
    expect(klien).toContain("timeoutMs: TIMEOUT_KONVERSI_MS");
  });
});

/**
 * ============================================================================
 * SATU CIRI, BANYAK BUNYI - POSITA TIDAK PERNAH SERAGAM
 * ============================================================================
 *
 * Daftar ciri dahulu menuntut bunyi baku "perselisihan DAN pertengkaran"
 * sekaligus dalam satu aturan. Posita yang menulis salah satunya saja - atau
 * menulis "tidak harmonis", "sering cekcok", "tidak ada kecocokan" - dinyatakan
 * tidak berciri apa-apa, padahal dalilnya jelas. Gugatan dan permohonan pun
 * berbeda bunyinya lagi.
 *
 * Yang dijaga di sini BUNYI-BUNYINYA, bukan jumlah barisnya: menambah sinonim
 * tidak boleh sampai memadamkan yang sudah ada.
 */
describe("ciri alasan dibaca dari bunyi posita yang berbeda-beda", () => {
  const ciri = (posita: string) => layanan.alasanDariPosita(posita);

  it("bunyi baku tetap terbaca", () => {
    expect(ciri("Bahwa sering terjadi perselisihan dan pertengkaran;")).toContain(
      "perselisihan terus-menerus"
    );
  });

  it("bunyi lain untuk alasan yang sama ikut terbaca", () => {
    for (const bunyi of [
      "Bahwa rumah tangga keduanya sudah tidak harmonis lagi;",
      "Bahwa Pemohon dan Termohon sering cekcok;",
      "Bahwa antara keduanya sudah tidak ada kecocokan lagi;",
      "Bahwa keduanya sering bertengkar sejak 2021;",
    ]) {
      expect(ciri(bunyi), bunyi).toContain("perselisihan terus-menerus");
    }
  });

  it("alasan yang dahulu tidak punya ciri sama sekali kini terbaca", () => {
    expect(ciri("Bahwa Tergugat dihukum pidana penjara selama 6 tahun;")).toContain(
      "salah satu pihak menjalani pidana penjara"
    );
    expect(ciri("Bahwa Tergugat telah melanggar taklik talak;")).toContain(
      "pelanggaran taklik talak"
    );
    expect(ciri("Bahwa Tergugat telah berbuat zina;")).toContain("zina");
    expect(ciri("Bahwa Termohon telah pindah agama;")).toContain("murtad/pindah agama");
  });

  /**
   * Kata yang terlalu pendek atau terlalu umum TIDAK boleh menyala.
   *
   * Pencocokannya potongan teks tanpa batas kata - imbuhan bahasa Indonesia
   * membuat batas kata mustahil dipakai, sebab "berjudi" harus tetap cocok
   * pada "judi". Akibatnya singkatan seperti WIL dan PIL akan menyala pada
   * "wilayah" dan "dipilih", dan "sakit" pada "sakit hati". Ciri yang salah
   * menyala membuat perkara tampak punya alasan yang tidak pernah didalilkan.
   */
  it("kata umum dan potongan kata tidak menyalakan ciri", () => {
    for (const jebakan of [
      "Bahwa keduanya tinggal di wilayah Kecamatan Banawa;",
      "Bahwa rumah itu dipilih bersama;",
      "Bahwa Penggugat sakit hati atas perbuatan Tergugat;",
    ]) {
      expect(ciri(jebakan), jebakan).toEqual([]);
    }
  });

  /**
   * Aturan berkata lebih dari satu harus terpenuhi dalam SATU kalimat.
   *
   * Bentuk lamanya menyambung seluruh butir menjadi satu naskah lebih dahulu,
   * sehingga "dihukum" di butir 2 dan "penjara" di butir 9 terbaca sebagai
   * pernyataan bahwa seseorang dihukum penjara - padahal keduanya kalimat yang
   * sama sekali berlainan.
   */
  it("dua kata yang berjauhan bukan satu pernyataan", () => {
    expect(
      ciri("Bahwa Tergugat dihukum oleh atasannya; Bahwa rumahnya dekat penjara;")
    ).not.toContain("salah satu pihak menjalani pidana penjara");
  });
});
