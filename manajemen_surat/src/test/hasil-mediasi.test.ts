// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { bacaRtf, bacaRtfDariBita } from "@/lib/baca-rtf";
import {
  bolehBuatHasilMediasi,
  butirTersedia,
  drafAwal,
  kekuranganDraf,
  kelompokPerkara,
  namaBerkasHasilMediasi,
  paduDraf,
  rupiahTerbilang,
  susunNaskah,
  susunPasal,
  teksNaskah,
  type BahanHasilMediasi,
  type DrafHasilMediasi,
  type IsianButir,
} from "@/lib/hasil-mediasi";
import { lariRtf, naskahKeRtf, rtfKeBita } from "@/lib/hasil-mediasi-rtf";
import { bacaTampilanMediasi, tampilMediasi, tampilanMediasiBawaan } from "@/lib/tampilan-jadwal-mediasi";

/**
 * ============================================================================
 * HASIL MEDIASI OTOMATIS (.rtf) - PILIHAN MEDIATOR MENJADI NASKAH
 * ============================================================================
 *
 * Contoh pengguna: "di klik mut'ah terus klik pihak tergugat dan masukkan
 * nominal 1.000.000". Seluruh uji di sini menjalankan fungsi yang SAMA dengan
 * pop-up dan unduhan - lalu membaca RTF-nya kembali dengan baca-rtf.ts
 * (pembaca yang sama yang memetik naskah putusan), sehingga yang diuji adalah
 * isi berkas yang dibuka Word, bukan teks sumber.
 *
 * Nama orang di sini karangan; struktur dibandingkan dengan contoh satker
 * 371_Pdt.G_2025_PA.Dgl - Laporan Mediasi Berhasil Sebagian.rtf.
 */

const CONTOH_371 = "D:/Download File/371_Pdt.G_2025_PA.Dgl - Laporan Mediasi Berhasil Sebagian.rtf";

function bahanCeraiGugat(lain: Partial<BahanHasilMediasi> = {}): BahanHasilMediasi {
  return {
    nomorPerkara: "371/Pdt.G/2025/PA.Dgl",
    perkaraId: "9371",
    mediasiId: "771",
    jenisPerkara: "Cerai Gugat",
    alurPerkaraId: 15,
    jenisPerkaraId: 347,
    mediator: "Drs. H. Ahmad Contoh, M.H.",
    penetapanMediator: "2025-06-24",
    pertemuan: [
      { tanggal: "2025-07-01", jam: "09:00", sampaiJam: "10:00", tempat: "Ruang Mediasi", ditunda: false, dihadiri: "2" },
    ],
    pihak: [
      {
        pihakKe: 1,
        nama: "Siti Contoh binti Rolla",
        kelamin: "Perempuan",
        umur: 46,
        agama: "Islam",
        pendidikan: "SD",
        pekerjaan: "Ibu Rumah Tangga",
        alamat: "Dusun I",
        wilayah: ["Tibo", "Sindue Tombusabora", "Kabupaten Donggala"],
      },
      {
        pihakKe: 2,
        nama: "Darwis Contoh bin Dahlan",
        kelamin: "Laki-laki",
        umur: 45,
        agama: "Islam",
        pekerjaan: "Petani",
        alamat: "Dusun II",
        wilayah: ["Tibo"],
      },
    ],
    anak: ["Aisyah Contoh", "Ahmad Contoh"],
    majelis: [],
    namaPengadilan: "Pengadilan Agama Donggala",
    ...lain,
  };
}

function aktifkan(draf: DrafHasilMediasi, kunci: string, isi: Partial<IsianButir>): DrafHasilMediasi {
  return { ...draf, butir: { ...draf.butir, [kunci]: { ...draf.butir[kunci], ...isi, aktif: true } } };
}

/** Naskah -> RTF -> dibaca kembali seperti Word membacanya. */
function bolakBalik(draf: DrafHasilMediasi, bahan: BahanHasilMediasi) {
  const rtf = naskahKeRtf(susunNaskah(draf, bahan));
  const bita = rtfKeBita(rtf);
  return { rtf, teks: bacaRtfDariBita(bita) };
}

/** Contoh pengguna: mut'ah, Tergugat, Rp1.000.000 - berhasil sebagian. */
function drafMutah() {
  const bahan = bahanCeraiGugat();
  let draf = drafAwal(bahan, "2025-07-02");
  draf = { ...draf, hasil: "berhasil-sebagian" };
  draf = aktifkan(draf, "mutah", { pihak: "dua", nominal: 1_000_000 });
  draf = aktifkan(draf, "tidak-disepakati", { teks: "tuntutan perceraian" });
  return { bahan, draf };
}

describe("contoh pengguna: mut'ah, pihak Tergugat, Rp1.000.000", () => {
  it("pasalnya menyebut Tergugat sebagai yang dibebani, nominal dan terbilangnya", () => {
    const { bahan, draf } = drafMutah();
    const pasal = susunPasal(draf, bahan);
    const mutah = pasal.find((p) => p.asal === "mutah");
    expect(mutah?.isi[0]).toBe(
      "Pihak II (Tergugat) sepakat untuk memberikan mut’ah kepada Pihak I (Penggugat) berupa uang sejumlah Rp1.000.000,00 (satu juta rupiah)."
    );
  });

  it("pihak bawaan mut'ah pada cerai gugat adalah Tergugat (suami, dari jenis kelamin SIPP)", () => {
    const draf = drafAwal(bahanCeraiGugat());
    expect(draf.butir.mutah.pihak).toBe("dua");
    expect(draf.butir.hadhanah.pihak).toBe("satu");
  });

  it("RTF terbaca utuh: mut’ah dan Rp tampil benar, berkasnya ASCII murni", () => {
    const { bahan, draf } = drafMutah();
    const { rtf, teks } = bolakBalik(draf, bahan);
    expect(teks).toContain("berupa uang sejumlah Rp1.000.000,00 (satu juta rupiah)");
    expect(teks).toContain("mut’ah");
    expect(rtf).toContain("mut\\u8217\\'92ah");
    expect(/^[\x00-\x7f]*$/.test(rtf)).toBe(true);
    expect(rtf.startsWith("{\\rtf1\\ansi\\ansicpg1252")).toBe(true);
    // Kurung kurawal seimbang - RTF yang timpang dibuka Word sebagai teks mentah.
    let tingkat = 0;
    for (let i = 0; i < rtf.length; i += 1) {
      if (rtf[i] === "\\") {
        i += 1;
        continue;
      }
      if (rtf[i] === "{") tingkat += 1;
      if (rtf[i] === "}") tingkat -= 1;
      expect(tingkat).toBeGreaterThanOrEqual(0);
    }
    expect(tingkat).toBe(0);
  });

  it("struktur sama dengan contoh 371: pengantar, laporan, pernyataan, kesepakatan, jadwal", () => {
    const { bahan, draf } = drafMutah();
    const { teks } = bolakBalik(draf, bahan);
    const urutan = [
      "Hal : Laporan Mediasi",
      "Yth. Majelis Hakim yang memeriksa perkara",
      "dinyatakan berhasil sebagian",
      "LAPORAN HASIL MEDIASI",
      "Perkara Nomor: 371/Pdt.G/2025/PA.Dgl",
      "sebagai Mediator dalam perkara Nomor 371/Pdt.G/2025/PA.Dgl",
      "melawan",
      "telah menghasilkan kesepakatan sebagian",
      "Pasal 31 ayat (2) PERMA Nomor 1 Tahun 2016",
      "Pasal 9 ayat (3) PERMA Nomor 1 Tahun 2016",
      "Perincian biaya :",
      "J u m l a h",
      "PERNYATAAN PARA PIHAK TENTANG HASIL MEDIASI",
      "berhasil sebagian mencapai perdamaian",
      "KESEPAKATAN PERDAMAIAN SEBAGIAN",
      "selanjutnya disebut Pihak I",
      "d a n",
      "Selanjutnya Pihak I dan Pihak II disebut sebagai Para Pihak.",
      "Pasal 1",
      "Para Pihak sepakat untuk mengakhiri sengketa terkait mut’ah dengan musyawarah mufakat.",
      "Pasal 2",
      "Pihak II (Tergugat) sepakat untuk memberikan mut’ah",
      "hanya dapat dilaksanakan apabila Pihak I dan Pihak II benar-benar telah bercerai",
      "tuntutan perceraian",
      "untuk memuat Kesepakatan Perdamaian ini ke dalam pertimbangan dan amar putusan",
      "JADWAL MEDIASI",
      "PENGADILAN AGAMA DONGGALA",
      "HARI/TANGGAL",
      "PARAF MEDIATOR",
      "WAKTU PERTEMUAN BERIKUTNYA",
      "Selasa, 01 Juli 2025",
    ];
    let dari = -1;
    for (const potong of urutan) {
      const i = teks.indexOf(potong, dari + 1);
      expect(i, `"${potong}" tidak ada atau tidak berurutan`).toBeGreaterThan(dari);
      dari = i;
    }
  });

  it.skipIf(!existsSync(CONTOH_371))("judul-judul contoh 371 seluruhnya ada di naskah ALETA, dengan urutan yang sama", () => {
    const contoh = bacaRtfDariBita(new Uint8Array(readFileSync(CONTOH_371)));
    const judul = [
      "Hal : Laporan Mediasi",
      "LAPORAN HASIL MEDIASI",
      "PERNYATAAN PARA PIHAK TENTANG HASIL MEDIASI",
      "KESEPAKATAN PERDAMAIAN",
      "JADWAL MEDIASI",
    ];
    const { bahan, draf } = drafMutah();
    const { teks } = bolakBalik(draf, bahan);
    let dariContoh = -1;
    let dariAleta = -1;
    for (const j of judul) {
      const a = contoh.indexOf(j, dariContoh + 1);
      const b = teks.indexOf(j, dariAleta + 1);
      expect(a, `contoh 371 tanpa ${j}`).toBeGreaterThan(dariContoh);
      expect(b, `naskah ALETA tanpa ${j}`).toBeGreaterThan(dariAleta);
      dariContoh = a;
      dariAleta = b;
    }
    // Kolom tabel jadwal contoh 371 ikut ada.
    for (const kolom of ["HARI/TANGGAL", "WAKTU", "TEMPAT", "PERTEMUAN KE", "PARAF MEDIATOR", "WAKTU PERTEMUAN BERIKUTNYA", "KETERANGAN"]) {
      expect(contoh).toContain(kolom);
      expect(teks).toContain(kolom);
    }
  });

  it("tata halaman contoh: A4 tegak, margin 3/2/2/2 cm, Arial 12 spasi 1,5, jadwal lanskap", () => {
    const { bahan, draf } = drafMutah();
    const { rtf } = bolakBalik(draf, bahan);
    expect(rtf).toContain("\\paperw11906\\paperh16838\\margl1701\\margr1134\\margt1134\\margb1134");
    expect(rtf).toContain("Arial;");
    expect(rtf).toContain("\\sl360\\slmult1");
    expect(rtf).toContain("\\lndscpsxn");
    // Pengantar, laporan, pernyataan, kesepakatan: tiga halaman baru sebelum seksi lanskap.
    expect(rtf.split("\\pagebb").length - 1).toBe(3);
  });

  it("nama berkas mengikuti pola contoh", () => {
    expect(namaBerkasHasilMediasi("371/Pdt.G/2025/PA.Dgl", "berhasil-sebagian")).toBe(
      "371_Pdt.G_2025_PA.Dgl - Laporan Mediasi Berhasil Sebagian.rtf"
    );
    expect(namaBerkasHasilMediasi("12/Pdt.G/2026/PA.Dgl", "tidak-dapat-dilaksanakan")).toBe(
      "12_Pdt.G_2026_PA.Dgl - Laporan Mediasi Tidak Dapat Dilaksanakan.rtf"
    );
  });
});

describe("empat hasil", () => {
  it("berhasil seluruhnya (cerai): rukun kembali, gugatan dicabut, Pasal 27 ayat (6)", () => {
    const bahan = bahanCeraiGugat();
    let draf: DrafHasilMediasi = { ...drafAwal(bahan), hasil: "berhasil-seluruhnya" };
    draf = aktifkan(draf, "rukun-kembali", { teks: "Tergugat tidak akan mengulangi perbuatannya" });
    const pasal = susunPasal(draf, bahan);
    expect(pasal[0].isi[0]).toContain("hidup rukun kembali sebagai suami istri");
    expect(pasal[0].isi[0]).toContain("Tergugat tidak akan mengulangi perbuatannya");
    expect(pasal.at(-1)?.isi[0]).toBe(
      "Pihak I (Penggugat) sepakat untuk mencabut gugatan perkara Nomor 371/Pdt.G/2025/PA.Dgl, dan Para Pihak menyatakan perkara tersebut telah selesai."
    );
    const { teks } = bolakBalik(draf, bahan);
    expect(teks).toContain("dinyatakan berhasil sesuai dengan Pasal 27 ayat (6)");
    expect(teks).toContain("KESEPAKATAN PERDAMAIAN");
    expect(teks).not.toContain("SEBAGIAN");
    expect(teks).not.toContain("mengakhiri sengketa terkait");
    expect(namaBerkasHasilMediasi(draf.dokumen.nomorPerkara, draf.hasil)).toContain("Berhasil Seluruhnya.rtf");
  });

  it("berhasil seluruhnya (harta bersama): bawaannya Akta Perdamaian, Pasal 27 ayat (4)", () => {
    const bahan = bahanCeraiGugat({ jenisPerkara: "Harta Bersama", jenisPerkaraId: 348, anak: [] });
    let draf: DrafHasilMediasi = { ...drafAwal(bahan), hasil: "berhasil-seluruhnya" };
    draf = aktifkan(draf, "harta-bersama", { objek: "Sebidang tanah SHM No. 12 di Desa Tibo\nSatu unit sepeda motor" });
    const pasal = susunPasal(draf, bahan);
    expect(pasal[0].isi).toEqual([
      "Para Pihak sepakat bahwa harta bersama berupa:",
      "1. Sebidang tanah SHM No. 12 di Desa Tibo;",
      "2. Satu unit sepeda motor;",
      "dibagi secara natura dengan ketentuan Pihak I memperoleh 1/2 bagian dan Pihak II memperoleh 1/2 bagian.",
    ]);
    expect(pasal.at(-1)?.isi[0]).toContain("untuk menguatkan Kesepakatan Perdamaian ini dalam Akta Perdamaian");
  });

  it("tidak berhasil: tanpa kesepakatan, Pasal 32 ayat (1), biaya Pasal 9 ayat (4)", () => {
    const bahan = bahanCeraiGugat();
    const draf: DrafHasilMediasi = { ...drafAwal(bahan), hasil: "tidak-berhasil", alasanTidakBerhasil: "batas-waktu" };
    expect(susunPasal(draf, bahan)).toEqual([]);
    const { teks } = bolakBalik(draf, bahan);
    expect(teks).toContain("dinyatakan tidak berhasil mencapai kesepakatan sesuai dengan Pasal 32 ayat (1) huruf a PERMA Nomor 1 Tahun 2016");
    expect(teks).toContain("Pasal 9 ayat (4)");
    expect(teks).toContain("tidak berhasil mencapai kesepakatan.");
    expect(teks).not.toContain("KESEPAKATAN PERDAMAIAN");
  });

  it("tidak berhasil karena iktikad (Pasal 7 ayat (2) huruf e) menyebut pihaknya", () => {
    const bahan = bahanCeraiGugat();
    const draf: DrafHasilMediasi = {
      ...drafAwal(bahan),
      hasil: "tidak-berhasil",
      alasanTidakBerhasil: "iktikad-e",
      pihakTidakBeriktikad: "dua",
    };
    const teks = teksNaskah(susunNaskah(draf, bahan));
    expect(teks).toContain(
      "namun Tergugat tidak menandatangani konsep Kesepakatan Perdamaian yang telah disepakati tanpa alasan sah, sehingga dinyatakan tidak beriktikad baik"
    );
    expect(teks).toContain("Pasal 32 ayat (1) huruf b jo. Pasal 7 ayat (2) huruf e");
  });

  it("tidak dapat dilaksanakan: Tergugat tidak hadir 2 kali berturut-turut", () => {
    const bahan = bahanCeraiGugat();
    const draf: DrafHasilMediasi = {
      ...drafAwal(bahan),
      hasil: "tidak-dapat-dilaksanakan",
      alasanTidakDapat: "tidak-hadir-a",
      pihakTidakBeriktikad: "dua",
    };
    const { teks } = bolakBalik(draf, bahan);
    expect(teks).toContain("namun Tergugat tidak hadir setelah dipanggil secara patut 2 (dua) kali berturut-turut tanpa alasan sah");
    expect(teks).toContain("dinyatakan tidak dapat dilaksanakan sesuai dengan Pasal 32 ayat (2) huruf c jo. Pasal 7 ayat (2) huruf a");
    expect(teks).not.toContain("KESEPAKATAN PERDAMAIAN");
  });
});

describe("perceraian - butir lain", () => {
  it("cerai talak: Pemohon/Termohon, nafkah iddah 3 bulan, dibayar sebelum ikrar merujuk pasalnya", () => {
    const bahan = bahanCeraiGugat({
      jenisPerkara: "Cerai Talak",
      jenisPerkaraId: 346,
      pihak: [
        { pihakKe: 1, nama: "Andi Contoh bin Ahmad", kelamin: "Laki-laki" },
        { pihakKe: 2, nama: "Rina Contoh binti Umar", kelamin: "Perempuan" },
      ],
    });
    let draf: DrafHasilMediasi = { ...drafAwal(bahan), hasil: "berhasil-sebagian" };
    expect(draf.dokumen.sebutanSatu).toBe("Pemohon");
    expect(draf.butir["nafkah-iddah"].pihak).toBe("satu");
    draf = aktifkan(draf, "nafkah-iddah", { nominal: 1_800_000 });
    draf = aktifkan(draf, "mutah", { nominal: 100_000 });
    draf = aktifkan(draf, "tenggat-pembayaran", {});
    const pasal = susunPasal(draf, bahan);
    expect(pasal[1].isi[0]).toBe(
      "Pihak I (Pemohon) sepakat untuk membayar nafkah iddah kepada Pihak II (Termohon) selama 3 (tiga) bulan sejumlah Rp1.800.000,00 (satu juta delapan ratus ribu rupiah)."
    );
    const tenggat = pasal.find((p) => p.asal === "tenggat-pembayaran");
    expect(tenggat?.isi[0]).toBe(
      "Kewajiban Pihak I (Pemohon) sebagaimana tersebut dalam Pasal 2 dan 3 dibayar secara tunai di depan sidang sesaat sebelum Pihak I (Pemohon) mengucapkan ikrar talak di depan sidang Pengadilan Agama Donggala."
    );
    // PERMA 1/2016 Pasal 31 ayat (2)-(4) - klausula keterkaitan, sebutan permohonan.
    expect(pasal.find((p) => p.asal === "keterkaitan-cerai")?.isi[0]).toContain("menolak permohonan");
  });

  it("hak asuh + nafkah anak: nama anak dari SIPP, kenaikan 10% per tahun, sampai 21 tahun", () => {
    const bahan = bahanCeraiGugat();
    let draf: DrafHasilMediasi = { ...drafAwal(bahan), hasil: "berhasil-sebagian" };
    draf = aktifkan(draf, "hadhanah", { teks: "setiap akhir pekan" });
    draf = aktifkan(draf, "nafkah-anak", { nominal: 750_000 });
    const pasal = susunPasal(draf, bahan);
    expect(pasal.find((p) => p.asal === "hadhanah")?.isi[0]).toBe(
      "Para Pihak sepakat bahwa anak-anak bernama Aisyah Contoh dan Ahmad Contoh berada di bawah pemeliharaan (hadhanah) Pihak I (Penggugat), dengan kewajiban Pihak I (Penggugat) memberi akses seluas-luasnya kepada Pihak II (Tergugat) untuk bertemu, mencurahkan kasih sayang, dan turut mengasuh anak-anak tersebut (setiap akhir pekan)."
    );
    expect(pasal.find((p) => p.asal === "nafkah-anak")?.isi[0]).toBe(
      "Pihak II (Tergugat) sepakat untuk memberikan nafkah anak-anak bernama Aisyah Contoh dan Ahmad Contoh sejumlah Rp750.000,00 (tujuh ratus lima puluh ribu rupiah) setiap bulan, di luar biaya pendidikan dan kesehatan, dengan kenaikan 10 (sepuluh) persen setiap tahun, sampai anak-anak tersebut berusia 21 (dua puluh satu) tahun atau telah dewasa dan mandiri, yang diserahkan melalui Pihak I (Penggugat)."
    );
  });

  it("nominal kosong tercetak titik-titik dan disebut di daftar kekurangan", () => {
    const bahan = bahanCeraiGugat();
    let draf: DrafHasilMediasi = { ...drafAwal(bahan), hasil: "berhasil-sebagian" };
    draf = aktifkan(draf, "nafkah-iddah", {});
    expect(susunPasal(draf, bahan).find((p) => p.asal === "nafkah-iddah")?.isi[0]).toContain("Rp.................. (");
    expect(kekuranganDraf(draf).some((k) => k.startsWith("Nafkah iddah: nominal belum diisi"))).toBe(true);
    expect(kekuranganDraf(draf)).toContain("Berhasil sebagian: tuntutan yang TIDAK disepakati belum disebut.");
  });

  it("katalog: perceraian paling lengkap, perkara lain mengikuti", () => {
    const cerai = butirTersedia("cerai", "berhasil-sebagian").map((b) => b.kunci);
    for (const k of [
      "nafkah-iddah",
      "mutah",
      "maskan-kiswah",
      "nafkah-madliyah",
      "mahar",
      "hadhanah",
      "nafkah-anak",
      "harta-bersama",
      "utang-piutang",
      "tenggat-pembayaran",
      "kesanggupan-lain",
      "tidak-disepakati",
      "biaya-perkara",
    ]) {
      expect(cerai).toContain(k);
    }
    expect(cerai).not.toContain("rukun-kembali");
    expect(butirTersedia("cerai", "berhasil-seluruhnya").map((b) => b.kunci)).toContain("rukun-kembali");
    expect(butirTersedia("waris", "berhasil-sebagian").map((b) => b.kunci)).toContain("waris");
    expect(butirTersedia("ekonomi-syariah", "berhasil-sebagian").map((b) => b.kunci)).toContain("angsuran-syariah");
    expect(butirTersedia("cerai", "tidak-berhasil")).toEqual([]);
    expect(kelompokPerkara({ jenisPerkara: "Kewarisan" })).toBe("waris");
    expect(kelompokPerkara({ jenisPerkaraId: 346, jenisPerkara: "" })).toBe("cerai");
  });
});

describe("kuasa, draf tersimpan, penyandian", () => {
  it("pihak berkuasa: kuasa tertulis di identitas, tanda tangan, dan persetujuan Pasal 27 ayat (3)", () => {
    const { bahan, draf } = drafMutah();
    const berkuasa = { ...draf, dokumen: { ...draf.dokumen, kuasaDua: "Budi Contoh, S.H." } };
    const { teks } = bolakBalik(berkuasa, bahan);
    expect(teks).toContain("dalam hal ini diwakili oleh kuasanya, Budi Contoh, S.H.;");
    expect(teks).toContain("Kuasa Tergugat,");
    expect(teks).toContain("PERNYATAAN PARA PIHAK YANG DIWAKILI OLEH KUASA HUKUM");
  });

  it("paduDraf memakai yang tersimpan dan membuang yang asing", () => {
    const awal = drafAwal(bahanCeraiGugat());
    const padu = paduDraf(awal, {
      hasil: "tidak-berhasil",
      penutup: "ngawur",
      butir: { mutah: { aktif: true, nominal: 5 }, asing: { aktif: true } },
      dokumen: { kota: "Palu" },
    });
    expect(padu.hasil).toBe("tidak-berhasil");
    expect(padu.penutup).toBe(awal.penutup);
    expect(padu.butir.mutah).toMatchObject({ aktif: true, nominal: 5, pihak: "dua" });
    expect(padu.butir).not.toHaveProperty("asing");
    expect(padu.dokumen.kota).toBe("Palu");
    expect(paduDraf(awal, null)).toBe(awal);
  });

  it("identitas dari SIPP tersusun seperti contoh 371", () => {
    const draf = drafAwal(bahanCeraiGugat());
    expect(draf.dokumen.pihakSatu[0]).toEqual({
      nama: "Siti Contoh binti Rolla",
      keterangan:
        "umur 46 tahun, agama Islam, pendidikan SD, pekerjaan Ibu Rumah Tangga, bertempat tinggal di Dusun I, Tibo, Sindue Tombusabora, Kabupaten Donggala",
    });
    expect(draf.dokumen.kota).toBe("Donggala");
    expect(draf.dokumen.tempatMediasi).toBe("ruang mediasi Pengadilan Agama Donggala");
  });

  it("lariRtf: 1252 dengan cadangan, kurung dilarikan, emoji tidak merusak berkas", () => {
    expect(lariRtf("Rp 1.000")).toBe("Rp 1.000");
    expect(lariRtf("mut’ah")).toBe("mut\\u8217\\'92ah");
    expect(lariRtf("café")).toBe("caf\\'e9");
    expect(lariRtf("{a}\\b")).toBe("\\{a\\}\\\\b");
    expect(lariRtf("ث")).toBe("\\u1579?");
    expect(bacaRtf(`{\\rtf1\\ansi\\uc1 ${lariRtf("x 😀 ’ é {}")}}`)).toBe("x 😀 ’ é {}");
  });

  it("rupiahTerbilang", () => {
    expect(rupiahTerbilang(1_000_000)).toBe("Rp1.000.000,00 (satu juta rupiah)");
    expect(rupiahTerbilang(14_500)).toBe("Rp14.500,00 (empat belas ribu lima ratus rupiah)");
  });
});

describe("siapa yang melihat tombolnya", () => {
  const mediator = "Drs. H. Ahmad Contoh, M.H.";
  it("hanya mediator perkara itu (dicocokkan tanpa gelar) dan Super Admin", () => {
    expect(bolehBuatHasilMediasi({ nama: "Ahmad Contoh", peran: "hakim" }, mediator)).toBe(true);
    expect(bolehBuatHasilMediasi({ nama: "Budi Lain", peran: "hakim" }, mediator)).toBe(false);
    expect(bolehBuatHasilMediasi({ nama: "Siapa Saja", peran: "super-admin" }, mediator)).toBe(true);
    // Admin biasa TIDAK - naskah ini ditandatangani mediator.
    expect(bolehBuatHasilMediasi({ nama: "Admin Satker", peran: "admin" }, mediator)).toBe(false);
    expect(bolehBuatHasilMediasi(null, mediator)).toBe(false);
    expect(bolehBuatHasilMediasi({ nama: "Ahmad Contoh", peran: "hakim" }, "")).toBe(false);
  });

  it("mediator kedua pada rangkaian <br/> SIPP juga mediator", () => {
    expect(bolehBuatHasilMediasi({ nama: "Mazidah Contoh", peran: "hakim" }, "Mohamad Contoh, S.Ag.,M.H.<br/>Mazidah Contoh, S.Ag., M.H.")).toBe(
      true
    );
  });
});

describe("saklar Tampilan Jadwal Mediasi", () => {
  it("tombol hasil mediasi menyala bawaannya, dapat dimatikan, simpanan asing dibuang", () => {
    expect(tampilanMediasiBawaan()["tombol-hasil-mediasi"]).toBe(true);
    expect(tampilMediasi(undefined, "tombol-hasil-mediasi")).toBe(true);
    const mati = bacaTampilanMediasi(JSON.stringify({ "tombol-hasil-mediasi": false, asing: true }));
    expect(tampilMediasi(mati, "tombol-hasil-mediasi")).toBe(false);
    expect(mati).not.toHaveProperty("asing");
    expect(bacaTampilanMediasi("{rusak")["tombol-hasil-mediasi"]).toBe(true);
  });
});
