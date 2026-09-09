// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
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
  selisih: { hal: string; saksi1: string; saksi2: string }[];
  huruf: { huruf: string; bunyi: string; pemicu: string[]; syarat: string }[];
  hurufBelumSiap: { huruf: string; sebab: string }[];
  usulan: (Usulan & { catatan?: string; dihitung?: boolean })[];
};

type Layanan = {
  butirKeterangan: (teks: string) => string[];
  hitungLamaPisah: (a: string, b: string) => { teks: string; totalBulan: number } | null;
  dariKeteranganSaksi: (a: string, b: string, tanggalSidang?: string) => HasilSaksi;
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
  KALIMAT: { sebutanCiri: Record<string, string> };
  susunAlasan: (daftar: string[]) => string;
  kalimatUpayaDamai: (gagal: boolean) => string;
};
const aturan = require_(
  path.resolve(process.cwd(), "../aleta_bot/services/abtAturanAlasan.js")
) as Aturan;
const pustaka = require_(
  path.resolve(process.cwd(), "../aleta_bot/services/abtKalimatBaku.js")
) as Pustaka;

const abtJs = () => readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/abt.js"), "utf8");
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

  it("5227 disusun dari ciri yang benar-benar disebut saksi", () => {
    // Kalimatnya dari pustaka kalimat baku, bukan nama cirinya - yang masuk ke
    // putusan harus berbunyi seperti putusan.
    const u = ambil(layanan.dariKeteranganSaksi(SAKSI_1, SAKSI_2), "5227");
    expect(u.nilai).toContain("Kekerasan Dalam Rumah Tangga");
    expect(u.nilai).toContain("nafkah");
    // Blangkonya mengingatkan "JANGAN LUPA TAMBAH DAN SEBELUM ALASAN TERAKHIR".
    expect(u.nilai).toContain(" dan ");
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
    expect(abt?.matches).toContain("http://192.168.10.10/aps_badilag/abt/*");
    expect(abt?.css).toContain("panel.css");
  });

  it("skrip SIPP TIDAK ikut berjalan di halaman ABT", () => {
    // Seluruh logikanya menganggap dirinya berada di SIPP; menjalankannya di
    // aplikasi lain hanya menghasilkan galat diam-diam.
    const m = manifest();
    const sipp = m.content_scripts.find((s) => (s.js || []).includes("konten.js"));
    expect(sipp?.matches).toEqual(["http://192.168.10.10/SIPP/*"]);
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

  it("penyambung alasan memakai DAN sebelum yang terakhir", () => {
    // Blangkonya sendiri yang mengingatkan.
    // Diperiksa pada UJUNGNYA, bukan dengan menghitung kata "dan" - kalimat
    // bakunya sendiri memuat "Penggugat dan Tergugat", dan menghitung
    // seluruhnya hanya menguji isi kalimat, bukan penyambungnya.
    const daftar = ["perselisihan terus-menerus", "tidak memberi nafkah", "cemburu"];
    const kalimat = pustaka.susunAlasan(daftar);
    const terakhir = pustaka.KALIMAT.sebutanCiri["cemburu"];
    expect(kalimat.endsWith(` dan ${terakhir}`)).toBe(true);
    // Yang bukan terakhir disambung koma, bukan "dan".
    expect(kalimat).toContain(`${pustaka.KALIMAT.sebutanCiri["perselisihan terus-menerus"]}, `);
  });

  it("pustaka kalimat TIDAK memuat bunyi pasal", () => {
    // Yang menyatakan hukum hanya boleh disalin dari naskah resmi, dan
    // tempatnya abtAturanAlasan.js.
    const isi = readFileSync(
      path.resolve(process.cwd(), "../aleta_bot/services/abtKalimatBaku.js"),
      "utf8"
    );
    expect(isi).not.toContain("Pasal 19");
    expect(isi).not.toContain("Undang-Undang");
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
