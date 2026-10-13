import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Deteksi per jenis agen Y (13 Okt 2026): perwalian, asal usul anak, pengangkatan anak, wali adhol,
 * hadhanah, Lain-Lain (369) - aleta_bot/services/deteksi/*.js + sambungan rute posita-lain.
 *
 * Posita/petitum di bawah disalin dari perkara NYATA PA Donggala (sipp_donggala), susunan kalimat
 * utuh; nama orang dan nomor dokumen diganti pengganti (Xxxa, Yyyb, ...) supaya bukan data pihak.
 * Asal kalimatnya disebut di tiap uji (nomor perkara).
 */

const akar = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(akar, "aleta_bot", "package.json"));
const dir = path.join(akar, "aleta_bot", "services", "deteksi");
const indeks = require_(path.join(dir, "index.js"));
const perwalian = require_(path.join(dir, "perwalian.js"));
const asalUsul = require_(path.join(dir, "asalUsul.js"));
const waliAdhol = require_(path.join(dir, "waliAdhol.js"));
const lainLain = require_(path.join(dir, "lainLain.js"));
const sambung = require_(path.join(dir, "sambungPositaLain.js"));

type Fakta = { nilai: string; yakin: string; kalimat: string; asal?: string };
type Peta = Record<string, Fakta>;
const nilai = (p: Peta, k: string) => (p[k] ? p[k].nilai : undefined);
const yakin = (p: Peta, k: string) => (p[k] ? p[k].yakin : undefined);

// 9/Pdt.P/2026 (templat perwalian 2024-2026).
const POSITA_PERWALIAN = `Bahwa pada tanggal 06 November 1992, Pemohon dan Suami Pemohon yang bernama Xxxa Yyyb bin Zzzc. K telah melangsungkan perkawinan di Kantor Urusan Agama Kecamatan Balik Papan Utara, Kota Balik Papan , Provinsi Kalimantan Timur sebagaimana tercatat dalam Kutipan Akta Nikah Nomor :743/49/XI/92, tanggal 19 November 1992; 2. Bahwa dari perkawinan tersebut Pemohon dan suami Pemohon di karunia 3 (Tiga) orang anak yang masing-masing bernama : a. Aaaa Bbbb binti Xxxa Yyyb, Usia 32 tahun ; b. Cccc Dddd bin Xxxa Yyyb, Usia 21 tahun g. Eeee Al-Ffff bin Xxxa Yyyb, Usia 15 tahun 3. Bahwa Alm. Xxxa Yyyb (Suami Pemohon) telah meninggal dunia pada tanggal 13 Juni 2021 (Kutipan Akta Kematian Nomor : 0000-KM-00000000-0001) dikeluarkan oleh kantor Dinas Kependudukan dan Pencatatan Sipil Kabupaten Sigi, tanggal 01 Juli 2021; 4. Bahwa dalam hal ini Pemohon ingin mengurus harta peninggalan (Pengurusan sertifikat Hak Guna Bangunan) suami Alm. Xxxa Yyyb maka Pemohon memerlukan untuk di tetapkan sebagai wali atas anak Pemohon (Gggg binti Hhhh) yang bernama Eeee Al-Ffff bin Xxxa Yyyb, Usia 15 tahun; 5. Bahwa oleh karena anak tersebut diatas belum cakap hukum, (belum berumur 21 tahun), maka diperlukan penetapan Perwalian dari Pengadilan yang berwenang.`;
const PETITUM_PERWALIAN = `PRIMER 1. Mengabulkan permohonan Pemohon ; 2. Menetapkan Pemohon (Gggg binti Hhhh) sebagai wali atas seorang anak yang bernama Eeee Al-Ffff bin Xxxa Yyyb, Usia 15 tahun; 3. Menetapkan Pemohon sebagai wali dari Eeee Al-Ffff bin Xxxa Yyyb untuk pemberian izin pengurusan sertifikat harta peninggalan Alm. Xxxa Yyyb; 4. Membebankan biaya perkara menurut hukum;`;

// 743/Pdt.P/2018 dan lima perkara lain: petitum templat lama "Wali dari <orang tua>" - amarnya menyebut ANAK.
const POSITA_PERWALIAN_LAMA = `Dengan ini mengajukan Perwalian terhadap anak : Iiii bin Jjjj, Umur 20 Tahun ,Agama Islam, tempat kediaman di Jalan Intan Kecamatan Marawola Kabupaten Sigi; Adapun alasan/dalil-dalil permohonan Pemohon sebagai berikut: .Bahwa Iiii bin Jjjj Umur 20 Tahun adalah anak kandung dari perkawinan antara Jjjj bin Kkkk dan Llll binti Mmmm Bahwa Pemohon mempunyai hubungan keluarga sebagai Paman`;
const PETITUM_PERWALIAN_LAMA = `1. Mengabulkan permohonan Pemohon; 2. Menetapkan Pemohon Nnnn bin Oooo sebagai Wali dari Jjjj bin Kkkk dan Llll binti Mmmm ; 3. Membebankan biaya perkara menurut hukum;`;

// 233/Pdt.P/2025 (asal usul anak).
const POSITA_AUA = `1. Bahwa pada tanggal 18 Desember 2018 Pemohon I dan Pemohon II melangsungkan pernikahan menurut agama Islam di wilayah hukum Kantor Urusan Agama Kecamatan Sigi Biromaru Kabupaten Sigi Provinsi Sulawesi Tengah; 4. Bahwa setelah pernikahan Pemohon I dan Pemohon II hidup rukun sebagaimana layaknya suami istri dan telah dikaruniai 3 (Tiga) orang anak yang masing-masing Bernama: a. Aaaa Bbbb binti Cccc Dddd yang lahir di Desa Mpanau, pada hari Sabtu, tanggal 10 Oktober 2019, di Puskesmas Biromaru ; b. Eeee Ffff binti Cccc Dddd yang lahir di Desa Mpanau, pada hari Kamis, tanggal 17 September 2020, di Puskesmas Biromaru ; c. Gggg Hhhh binti Cccc Dddd yang lahir di Sigi, pada hari Jumat, tanggal 19 Agustus 2022 di Puskesmas Biromaru ; 6. Bahwa pada tanggal 10 Januari 2025, Pemohon I dan Pemohon II telah melangsungkan pernikahan yang dicatat oleh Pegawai Pencatat Nikah pada Kantor Urusan Agama (KUA) Kecamatan Sigi Biromaru, Kabupaten Sigi, Provinsi Sulawesi Tengah, sebagaimana sesuai dengan Kutipan Akta Nikah Nomor : 7210011012025012 tertanggal 10 Januari 2025; 7. Bahwa Pemohon I dan Pemohon II bersedia membayar biaya perkara.`;
const PETITUM_AUA = `PRIMER : 1. Mengabulkan permohonan Pemohon I dan Pemohon II; 2. Menetapkan Ketiga anak yang masing-masing benama : a. Aaaa Bbbb binti Cccc Dddd umur 6 tahun b. Eeee Ffff binti Cccc Dddd, umur 4 tahun c. Gggg Hhhh binti Cccc Dddd, umur 3 tahun Adalah anak dari Pemohon I dan Pemohon II; 3. Menetapkan biaya perkara menurut hukum yang berlaku;`;

// 152/Pdt.P/2025 (pengangkatan anak, didaftar Lain-Lain 369).
const POSITA_ANGKAT = `1. Bahwa Pemohon berstatus Duda dan telah bercerai dengan seorang wanita bernama Aaaa binti Bbbb sebagimana yang tercantum dalam Akta Cerai Nomor : 000/AC/2024/PA.Dgl tanggal 20 Agustus 2024. Dan selama pernikahan tersebut belum dikaruniai kuturunan; 2. Bahwa, Pemohon hendak mengangkat anak yang bernama Cccc Dddd bin Eeee yang merupakan anak kandung dari Bapak Eeee bin Ffff. L dan Ibu Gggg Hhhh binti Iiii 3. Bahwa anak tersebut lahir pada tanggal 21 Oktober 2013;`;
const PETITUM_ANGKAT = `Primer 1. Mengabulkan permohonan Pemohon; 2. Menyatakan sah pengangkatan anak bernama Cccc Dddd bin Eeee yang dilakukan Pemohon Jjjj, S.Hut bin Kkkk terhadap anak yang bernama Cccc Dddd bin Eeee umur 11 tahun; 3. Membebankan biaya perkara ini kepada Pemohon;`;

// 44/Pdt.P/2023 (wali adhol).
const POSITA_WA = `Bahwa Pemohon merupakan anak dari pernikahan : Aaaa bin Bbbb, umur 60 tahun. Bahwa Pemohon bermaksud akan melangsungkan pernikahan dengan seorang laki-laki pilihan yang bernama : Cccc bin Dddd Eeee , umur 21 tahun, agama Islam, pendidikan SLTA, tempat tinggal di Desa Rarampadende, Kecamatan Dolo Barat, Kabupaten Sigi. Bahwa antara Pemohon dengan calon suami sudah saling mencintai, sehingga Pemohon berniat untuk melangsungkan pernikahan ; Bahwa Pemohon dan calon suami telah menyampaikan maksud tersebut kepada ayah kandung Pemohon yang bernama Aaaa bin Bbbb yang beralamat di Desa Tahafo, Kecamatan Ibu, Kabupaten Halmahera Barat ; Bahwa niat Pemohon tidak mendapatkan restu dari pihak Ayah Kandung Pemohon karena pihak wali Pemohon mempunyai hubungan yang kurang baik dengan keluarga Ibu Pemohon ; Bahwa sehubungan Pemohon dengan calon suami Pemohon akan segera melangsungkan pernikahan di Desa Rarampadende, Kecamatan Dolo Barat, Kabupaten Sigi, dan atas penolakan wali Pemohon tidak didasarkan pada kepentingan Pemohon;`;

// 290/Pdt.G/2023 (hak asuh anak, didaftar Lain-Lain 369).
const POSITA_HADHANAH = `Bahwa pada tanggal 12 November 2017 , Penggugat dengan Tergugat melangsungkan pernikahan yang dicatat oleh Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan Sindue. Bahwa Penggugat dengan Tergugat telah hidup rukun sebagaimana layaknya suami istri dan telah dikaruniai seorang anak yang bernama Aaaa Bbbb binti Cccc Dddd, umur 4 tahun Bahwa pada tanggal 13 April 2023, telah terjadi perceraian antara Penggugat dengan Tergugat. Bahwa setelah perceraian, anak Penggugat dan Tergugat yang masih dibawah umur dan hidup bersama Tergugat, namun Tergugat tidak memberikan akses kepada Penggugat ; Bahwa Penggugat merasa khawatir tentang perkembangan jiwa anak yang masih dibawah umur dan masih mengharapkan kasih sayang, perhatian dan belaian seorang ibu, maka Penggugat memohon agar anak ditetapkan dalam pengasuhan Penggugat selaku Ibu kandungnya.`;
const PETITUM_HADHANAH = `PRIMER Mengabulkan gugatan Penggugat untuk seluruhnya; Menetapkan hak asuh anak yang bernama Aaaa Bbbb binti Cccc Dddd, berumur 4 tahun diberikan kepada Penggugat;`;

describe("perwalian (354)", () => {
  const p: Peta = perwalian.deteksi(POSITA_PERWALIAN, { petitum: PETITUM_PERWALIAN, namaPihak: ["Gggg binti Hhhh"] });

  it("anak yang dimohonkan dari petitum - bukan semua anak di posita", () => {
    expect(nilai(p, "5110")).toBe("Eeee Al-Ffff bin Xxxa Yyyb");
    expect(yakin(p, "5110")).toBe("cukup");
  });

  it("almarhum, tanggal wafat, dan peran orang tua (Pemohon istri yang ditinggal)", () => {
    expect(nilai(p, "1025")).toBe("Xxxa Yyyb bin Zzzc. K");
    expect(nilai(p, "1230")).toBe("13 Juni 2021");
    expect(nilai(p, "0709")).toBe("ibu kandung");
    expect(nilai(p, "0712")).toBe("bapak kandung");
    for (const k of ["1025", "1230", "0709", "0712"]) expect(yakin(p, k)).toBe("cukup");
  });

  it("perkawinan orang tua dan jumlah anak - ragu", () => {
    expect(nilai(p, "5197")).toBe("06 November 1992");
    expect(nilai(p, "5178")).toMatch(/^Kantor Urusan Agama Kecamatan Balik Papan Utara, Kota Balik Papan/);
    expect(nilai(p, "0007")).toBe("3 (tiga) orang anak");
    expect(yakin(p, "5197")).toBe("ragu");
    expect(nilai(p, "8171")).toMatch(/^pengurusan sertifikat harta peninggalan/);
  });

  it("petitum templat lama 'Wali dari <orang tua>' tidak dipakai - anak dari kepala posita, ragu", () => {
    const q: Peta = perwalian.deteksi(POSITA_PERWALIAN_LAMA, { petitum: PETITUM_PERWALIAN_LAMA });
    expect(nilai(q, "5110")).toBe("Iiii bin Jjjj");
    expect(yakin(q, "5110")).toBe("ragu");
  });

  it("'meninggalkan' bukan peristiwa wafat; dua orang wafat -> ragu", () => {
    const r: Peta = perwalian.deteksi(
      "Bahwa saudara kandung Pemohon Almarhum Aaaa Bin Bbbb bekerja sebagai PNS Guru dan meninggalkan gaji untuk anaknya;",
      {}
    );
    expect(r["1230"]).toBeUndefined();
    const s: Peta = perwalian.deteksi(
      "Bahwa pada tanggal 25 Desember 2020 almarhum Aaaa bin Bbbb meninggal dunia dan almarhumah Cccc binti Dddd meninggal dunia pada tanggal 10 April 2021.",
      {}
    );
    expect(nilai(s, "1025")).toBe("Aaaa bin Bbbb");
    expect(nilai(s, "1230")).toBe("25 Desember 2020");
    expect(yakin(s, "1025")).toBe("ragu");
  });
});

describe("asal usul anak (358)", () => {
  const p: Peta = asalUsul.deteksi(POSITA_AUA, { petitum: PETITUM_AUA });
  it("8603 anak yang dimohonkan - petitum sepakat dengan posita -> cukup", () => {
    expect(nilai(p, "8603")).toBe("Aaaa Bbbb binti Cccc Dddd, Eeee Ffff binti Cccc Dddd, Gggg Hhhh binti Cccc Dddd");
    expect(yakin(p, "8603")).toBe("cukup");
  });
  it("8605 pernikahan resmi yang tercatat kemudian", () => {
    expect(nilai(p, "8605")).toBe("pada tanggal 10 Januari 2025 di hadapan PPN KUA Kecamatan Sigi Biromaru, Kabupaten Sigi, Akta Nikah Nomor 7210011012025012");
  });
  it("asal usul yang petitumnya pengangkatan anak (0010/Pdt.P/2016) diserahkan ke modul pengangkatan", () => {
    const q: Peta = asalUsul.deteksi("Bahwa para Pemohon bermaksud menjadikan anak bernama : Aaaa, Umur 4 tahun; Sebagai calon anak angkat para Pemohon;", {
      petitum: "2.Menyatakan sah pengangkatan anak yang dilakukanoleh pemohon I dan Pemohon II terhadap anak yang bernama: -Aaaa -Bbbb. 3.Menetapkan biaya perkara menurut hukum.",
    });
    expect(nilai(q, "8603")).toBe("Aaaa, Bbbb");
  });
});

describe("Lain-Lain (369) dipilah menurut isinya", () => {
  it("pengangkatan anak", () => {
    const opsi = { petitum: PETITUM_ANGKAT, alur: "16" };
    expect(lainLain.pilahIsi(POSITA_ANGKAT, opsi)).toBe("pengangkatan-anak");
    const p: Peta = lainLain.deteksi(POSITA_ANGKAT, opsi);
    expect(nilai(p, "8603")).toBe("Cccc Dddd bin Eeee");
    expect(yakin(p, "8603")).toBe("cukup");
    expect(nilai(p, "8619")).toBe("Eeee bin Ffff. L dan Gggg Hhhh binti Iiii");
    expect(nilai(p, "8622")).toBe("seorang duda");
    // Tempat lahir tidak ditulis di posita -> 8618 tidak diisi (blangko "lahir di #8618#").
    expect(p["8618"]).toBeUndefined();
  });
  it("hak asuh anak (Pdt.G)", () => {
    const opsi = { petitum: PETITUM_HADHANAH, alur: "15" };
    expect(lainLain.pilahIsi(POSITA_HADHANAH, opsi)).toBe("hadhanah");
    const p: Peta = lainLain.deteksi(POSITA_HADHANAH, opsi);
    expect(nilai(p, "0709")).toBe("ibu kandung");
    expect(nilai(p, "0711")).toBe("bapak kandung");
    expect(nilai(p, "2004")).toBe("#0047#");
    expect(nilai(p, "8603")).toBe("Aaaa Bbbb binti Cccc Dddd");
    for (const k of Object.keys(p)) expect(yakin(p, k)).toBe("ragu");
  });
  it("petitum ahli waris menang atas kata 'perwalian' di posita (343/Pdt.G/2019)", () => {
    expect(lainLain.pilahIsi("Bahwa anak-anak masih di bawah perwalian ibunya;", { petitum: "Menetapkan ahli waris almarhumah Aaaa binti Bbbb adalah:", alur: "15" })).toBe("ahli-waris");
  });
});

describe("wali adhol (363)", () => {
  const p: Peta = waliAdhol.deteksi(POSITA_WA);
  it("calon suami, umur, wali, hubungan, KUA tempat menikah", () => {
    expect(nilai(p, "1029")).toBe("Cccc bin Dddd Eeee");
    expect(nilai(p, "1030")).toBe("21 tahun");
    expect(nilai(p, "1046")).toBe("ayah kandung");
    expect(nilai(p, "1217")).toBe("Aaaa bin Bbbb");
    expect(nilai(p, "3333")).toBe("Dolo Barat, Kabupaten Sigi");
    for (const k of ["1029", "1030", "1046", "1217", "3333"]) expect(yakin(p, k)).toBe("cukup");
  });
  it("alasan menolak dan eratnya hubungan - ragu", () => {
    expect(nilai(p, "6087")).toBe("karena pihak wali Pemohon mempunyai hubungan yang kurang baik dengan keluarga Ibu Pemohon");
    expect(yakin(p, "6087")).toBe("ragu");
    expect(nilai(p, "1014")).toBe("sudah saling mencintai");
  });
});

describe("pemuat & sambungan rute posita-lain", () => {
  it("modul agen Y terdaftar di deteksi/index.js", () => {
    const kunci = indeks.semuaModul().map((m: { kunci: string }) => m.kunci);
    for (const k of ["perwalian", "asal-usul", "pengangkatan-anak", "wali-adhol", "hadhanah", "lain-lain"]) expect(kunci).toContain(k);
    expect(indeks.modulUntuk(369).kunci).toBe("lain-lain");
  });

  it("369 yang tadinya 'tidak dilayani' kini dijawab; petitum & pihak dari SIPP (bacaSipp disuntik, tanpa basis data)", async () => {
    const hasil = await sambung.lengkapiPositaLain(
      { ok: false, jenis: "", usulan: [], belumSiap: [], bawaanAbt: [], alasan: "jenis_perkara_tidak_dilayani" },
      {
        posita: POSITA_ANGKAT,
        nomorPerkara: "152/Pdt.P/2025/PA.Dgl",
        jenisPerkara: "369",
        bacaSipp: async () => ({ posita: "", petitum: PETITUM_ANGKAT, jenisPerkara: "369", alur: "16", namaPihak: ["Jjjj, S.Hut bin Kkkk"] }),
      }
    );
    expect(hasil.ok).toBe(true);
    const u = hasil.usulan.find((x: { kode: string }) => x.kode === "8603");
    expect(u.nilai).toBe("Cccc Dddd bin Eeee");
    expect(u.keyakinan).toBe("cukup");
  });

  it("usulan lama 'cukup' tidak ditimpa bacaan 'ragu'; kode yang kini diusulkan keluar dari belumSiap", async () => {
    const lama = {
      ok: true,
      jenis: "perwalian",
      usulan: [
        { kode: "5197", nama: "Tgl nikah", nilai: "01 Januari 1990", keyakinan: "cukup", sumber: [] },
        { kode: "5110", nama: "Nama anak", nilai: "Salah", keyakinan: "ragu", sumber: [] },
      ],
      belumSiap: [{ kode: "1025", alasan: "n<10" }, { kode: "8888", alasan: "lain" }],
      bawaanAbt: [],
    };
    const hasil = await sambung.lengkapiPositaLain(lama, { posita: POSITA_PERWALIAN, petitum: PETITUM_PERWALIAN, jenisPerkara: "354", namaPihak: [] });
    const cari = (k: string) => hasil.usulan.find((x: { kode: string }) => x.kode === k);
    expect(cari("5197").nilai).toBe("01 Januari 1990");
    expect(cari("5110").nilai).toBe("Eeee Al-Ffff bin Xxxa Yyyb");
    expect(hasil.belumSiap.map((b: { kode: string }) => b.kode)).toEqual(["8888"]);
    expect(lama.usulan[1].nilai).toBe("Salah");
  });

  it("jenis milik agen lain (itsbat 360) tidak disentuh sambungan ini", async () => {
    const asli = { ok: true, usulan: [] };
    expect(await sambung.lengkapiPositaLain(asli, { posita: POSITA_AUA, jenisPerkara: "360" })).toBe(asli);
  });

  it("rute /abt/usulan sumber posita-lain memanggil sambungan", () => {
    const rute = readFileSync(path.join(akar, "aleta_bot", "routes", "internalGatewayRoutes.js"), "utf8");
    const blok = rute.slice(rute.indexOf('if (sumber === "posita-lain")'), rute.indexOf('if (sumber === "alasan-posita")'));
    expect(blok).toContain('require("../services/deteksi/sambungPositaLain").lengkapiPositaLain(jawaban.positaLain');
  });

  it("Y_VARIABEL_JENIS di abt.js = variabel modul (posita/petitum, terdeteksi)", () => {
    const teks = readFileSync(path.join(akar, "ekstensi-sipp", "abt.js"), "utf8");
    const blok = teks.match(/const Y_VARIABEL_JENIS = Object\.freeze\(\{([\s\S]*?)\n\}\);/);
    expect(blok).not.toBeNull();
    const cermin: Record<string, string[]> = {};
    for (const m of blok![1].matchAll(/(\d{3}): Object\.freeze\(\[([^\]]*)\]\)/g)) {
      cermin[m[1]] = [...m[2].matchAll(/"(\d{4,5})"/g)].map((x) => x[1]).sort();
    }
    const dariModul: Record<string, string[]> = {};
    for (const m of indeks.semuaModul()) {
      if (!sambung.KUNCI_Y.has(m.kunci)) continue;
      const kode = [
        ...new Set(
          (m.variabel as Array<{ kode: string; sumber: string; deteksi?: boolean }>)
            .filter((v) => /^(posita|petitum)$/.test(v.sumber) && v.deteksi !== false)
            .map((v) => v.kode)
        ),
      ].sort();
      for (const id of m.jenisPerkaraId) dariModul[String(id)] = kode;
    }
    expect(cermin).toEqual(dariModul);
  });
});
