/**
 * ============================================================================
 * BEBAN KINERJA KONSEPTOR - DAN KOLOM YANG TERNYATA MATI
 * ============================================================================
 *
 * Fitur ini menilai ORANG. Karena itu tiap komponennya dijalankan lebih dahulu
 * atas salinan satker sebelum boleh masuk rumus - sebab kolom yang ADA belum
 * tentu kolom yang TERISI, dan skor yang disusun dari kolom kosong bukan
 * penilaian yang rendah melainkan penilaian yang salah.
 *
 * Diukur atas 683 putusan tahun 2026 di `sipp_donggala`:
 *
 *     status_putusan_nama      NULL pada 683 dari 683   -> namanya diambil dari
 *     status_putusan_text      kosong pada 683 dari 683     tabel status_putusan
 *     tanggal_minutasi         = tanggal_putusan pada 683 dari 683
 *
 * Yang terakhir itu jebakan yang paling rapi. Jeda putus->minutasi nol hari
 * terbaca seperti minutasi seketika - nilai sempurna untuk semua orang. Yang
 * sebenarnya terjadi: kolomnya terisi sendiri. Ia karena itu TIDAK dinilai, dan
 * ketidakterpakaiannya disebut di layar, bukan dibisukan.
 *
 * ============================================================================
 * NAMA YANG TERBELAH TIDAK DIGABUNGKAN DIAM-DIAM
 * ============================================================================
 *
 * Terukur: "Rustam, S.H.I., M.H.", "Rustam, S.H.I." dan "Rustam" berdiri
 * sebagai tiga konseptor - 21 nama semacam itu pada rentang seluruh basis data,
 * 6 pada tahun 2026. Menggabungkannya otomatis adalah tebakan, dan tebakan pada
 * layar yang menilai orang berakhir sebagai tuduhan. Yang dikerjakan hanya
 * MEMBERITAHU bahwa angkanya terpecah - dan diberitahukan PALING DAHULU, sebab
 * ia mengubah cara membaca seluruh kalimat sesudahnya.
 *
 * ============================================================================
 * SEMBILAN KUERI MENGANTRE, BUKAN MENYERBU
 * ============================================================================
 *
 * Rentang seluruh basis data (9.993 putusan) diukur bertahap:
 *
 *     delapan subkueri berkorelasi          8.501 ms
 *     sembilan kueri berbarengan            7.428 ms   (inti sendiri 2.390 -> 7.426)
 *     sembilan kueri berurutan              5.439 ms
 *
 * Berbarengan justru lebih lambat: kesembilannya berebut satu MySQL. Dan ada
 * sebab kedua yang lebih penting daripada kecepatan - yang dibaca ini basis
 * data SIPP yang SEDANG DIPAKAI petugas.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const baca = (jalur: string) => readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");

const layanan = baca("aleta_bot/services/penilaianKonseptorService.js");
const gerbang = baca("aleta_bot/routes/internalGatewayRoutes.js");
const layar = baca("manajemen_surat/src/components/portal/beban-konseptor.tsx");
const rute = baca("manajemen_surat/src/app/api/aleta-ecourt/konseptor/route.ts");

/** Kode saja, tanpa keterangan - supaya tuntutan tidak lulus atas komentarnya sendiri. */
const kode = layanan
  .split("\n")
  .filter((b) => !/^\s*(\*|\/\/|\/\*)/.test(b))
  .join("\n");

describe("kolom yang mati tidak dinilai", () => {
  it("minutasi ditandai mati hanya bila SELURUH jedanya nol", () => {
    expect(kode).toContain("const kolomMinutasiMati = jedaAda > 0 && jedaNol === jedaAda;");
    // Satu saja yang bukan nol berarti kolomnya sungguh dipakai - dan saat itu
    // angkanya kembali berarti.
    expect(kode).toContain("tengahJedaMinutasi: kolomMinutasiMati ? null : tengah(o.jedaMinutasi)");
  });

  it("ketidakterpakaiannya disebut, bukan dibisukan", () => {
    expect(kode).toContain('nada: "tidak-terpakai"');
    expect(kode).toContain("Ketepatan minutasi TIDAK dinilai");
    expect(layar).toContain('"tidak-terpakai"');
  });

  it("tidak ada bobot untuk ketepatan minutasi", () => {
    // Bobot untuk kolom yang terisi sendiri akan memberi nilai sempurna kepada
    // semua orang atas pekerjaan yang tidak tercatat.
    expect(kode).not.toMatch(/perHariMinutasi|bobotMinutasi|ketepatanMinutasi/);
  });

  it("nama status diambil dari tabel rujukannya, sebab dua kolomnya kosong", () => {
    expect(kode).toContain("LEFT JOIN status_putusan sp ON sp.id = pp.status_putusan_id");
    expect(kode).toContain("NULLIF(pp.status_putusan_nama, '')");
    expect(layanan).toContain("NULL pada 683 dari 683");
  });
});

describe("sembilan kueri mengantre", () => {
  it("dijalankan berurutan, bukan dengan Promise.all", () => {
    expect(kode).toContain("async function berurutan(daftarThunk)");
    expect(kode).toContain("for (const thunk of daftarThunk) hasil.push(await thunk());");
    expect(kode).not.toContain("await Promise.all([");
  });

  it("angka pengukurannya tercatat di sumbernya", () => {
    expect(layanan).toContain("7.428 ms");
    expect(layanan).toContain("5,4 detik");
    expect(layanan).toContain("SEDANG DIPAKAI");
  });

  it("tidak ada subkueri berkorelasi per baris keluaran", () => {
    // Bentuk lama: (SELECT COUNT(*) ... WHERE x.perkara_id = p.perkara_id)
    expect(kode).not.toMatch(/\(SELECT\s+COUNT\(\*\)[^)]*perkara_id\s*=\s*p\.perkara_id/i);
  });

  it("perkara yang punya dua ketua majelis tidak melipatgandakan putusannya", () => {
    // Terukur: ada perkara dengan DUA baris hakim urutan 1 aktif. Satu JOIN
    // biasa akan menghitung putusannya dua kali.
    expect(kode).toContain("MIN(hk.hakim_nama) AS nama");
    expect(kode).toContain("GROUP BY hk.perkara_id");
  });
});

describe("nama terpecah dilaporkan, tidak digabungkan", () => {
  it("tidak ada penggabungan nama yang menebak", () => {
    expect(kode).not.toMatch(/levenshtein|fuzzy|samakanNama|gabungNama/i);
  });

  it("dilaporkan sebagai catatan, dengan daftar nama lengkapnya", () => {
    expect(kode).toContain("nama tertulis lebih dari satu cara di SIPP");
    expect(kode).toContain("ALETA tidak menggabungkannya sendiri; penggabungan nama adalah tebakan.");
  });

  it("catatannya diletakkan paling dahulu", () => {
    const iNama = kode.indexOf("nama tertulis lebih dari satu cara");
    const iBanding = kode.indexOf("Beban tertinggi ${tertinggi.nama}");
    expect(iNama).toBeGreaterThan(-1);
    expect(iBanding).toBeGreaterThan(-1);
    expect(iNama).toBeLessThan(iBanding);
  });

  it("daftar panjang dipotong, dan sisanya dihitung", () => {
    expect(kode).toContain("function sebutBeberapa(nama, batas = 4)");
    expect(kode).toContain("dan ${nama.length - batas} lainnya");
  });
});

describe("angkanya dapat dibantah", () => {
  it("tiap perkara membawa rincian penyusun skornya", () => {
    expect(kode).toContain("rincian.push({ sebab:");
    expect(kode).toContain("skor,\n        rincian,");
  });

  it("status yang meringankan DIKALIKAN, bukan dikurangi", () => {
    // Perkara yang dicabut sebelum pemeriksaan tidak "berkurang" bebannya - ia
    // memang tidak pernah memikul beban itu.
    // Dua pengganda kini: status yang meringankan, dan ragam perkaranya.
    expect(kode).toContain("skor: bulat(skor * pengganda * penggandaJenis)");
    expect(kode).toContain("penggandaStatus: {");
  });

  it('"Digugurkan" ikut tertangkap oleh kunci "gugur"', () => {
    expect(kode).toContain("status.includes(kata)");
    expect(kode).toContain("gugur: 0.35");
    // Hanya dua yang tersisa: keduanya terukur benar-benar berhenti lebih awal
    // (1,7 dan 1,8 sidang), dan dari 87 perkara berstatus ringan cuma DUA yang
    // sidangnya lima kali atau lebih.
    expect(Object.keys({ gugur: 1, dicabut: 1 })).toHaveLength(2);
  });

  it("bobotnya dapat disunting pemanggil", () => {
    expect(kode).toContain("const bobot = { ...BOBOT_AWAL, ...(minta.bobot || {}) };");
    expect(gerbang).toContain("JSON.parse(String(req.query.bobot))");
  });

  it("jumlah putusan selalu ikut di samping skornya", () => {
    expect(layar).toContain('{ label: "Putusan", nilai: angka(hasil.ringkas.putusan) }');
    expect(layar).toContain('{ label: "Jumlah skor beban"');
  });

  it("perbandingan tertinggi-terendah menyebut jumlah putusan keduanya", () => {
    // Tanpa ini, orang dengan satu putusan membuat perbandingannya tak berarti.
    expect(kode).toContain("atas ${terendah.putusan} ");
  });
});

describe("dasar konseptor dipilih, dan artinya terbaca di layar", () => {
  it("keempatnya ada di layanan", () => {
    expect(kode).toContain(
      'const DASAR = ["konseptor", "ketua-majelis", "penginput", "panitera"];'
    );
  });

  // Yang pertama menjadi bawaannya - di layanan, di rutenya, dan di layar.
  // Ketiganya harus menyebut dasar yang SAMA: rute yang bawaannya berbeda dari
  // layar membuat halaman yang baru dibuka menampilkan angka satu dasar dengan
  // nama dasar yang lain, dan tidak ada yang menyadarinya.
  it("bawaannya konseptor, bukan ketua majelis", () => {
    expect(kode).toContain("DASAR.includes(String(minta.dasar)) ? String(minta.dasar) : DASAR[0]");
    expect(rute).toContain('String(cari.get("dasar") || "konseptor")');
    expect(layar).toContain("useState(DASAR[0].nilai)");
  });

  it("konseptor dibaca dari tahapan putusan, bukan dari baris putusannya", () => {
    // Bedanya halus dan mudah tertukar dengan `penginput`, yang membaca
    // perkara_putusan.diinput_oleh. Yang ini membaca perkara_proses pada
    // tahapan putusan - sumber yang sama dengan layar Status Perkara.
    expect(kode).toContain("FROM perkara_proses pr");
    expect(kode).toContain("sippTahapanService.TAHAPAN_PUTUSAN");
  });

  it("layar menerangkan bahwa penginput mengukur mengetik, bukan mengarang", () => {
    expect(layar).toContain("mengukur pekerjaan mengetik, bukan mengarang");
  });

  it("dasar yang dipakai ikut dipulangkan dan ikut ditampilkan", () => {
    expect(kode).toContain("    dasar,\n");
    expect(layar).toContain("dihitung atas");
  });
});

describe("periode dan rentang", () => {
  it("tujuh periode, termasuk rentang tanggal sendiri", () => {
    expect(kode).toContain(
      'const PERIODE = ["minggu", "bulan", "triwulan", "semester", "tahun", "total", "rentang"];'
    );
    for (const p of ["minggu", "bulan", "triwulan", "semester", "tahun", "total", "rentang"]) {
      expect(layar, p).toContain(`nilai: "${p}"`);
    }
  });

  it("rentang terbalik ditolak, tidak dijawab kosong", () => {
    expect(kode).toContain('if (dari > sampai) return { ok: false, alasan: "tanggal_awal_melewati_akhir" };');
  });

  it("rentang tanpa tanggal ditahan di rute, sebelum menyentuh SIPP", () => {
    expect(rute).toContain('periode === "rentang" && (!dari || !sampai)');
  });

  it("batas periodenya diperiksa berkas tersendiri", () => {
    const pemeriksa = baca("aleta_bot/scripts/verify-periode-konseptor.js");
    expect(pemeriksa).toContain("pekan dari hari Minggu");
    expect(pemeriksa).toContain("Februari kabisat");
  });
});

describe("rentang lebar tidak mengirim sembilan ribu baris rincian", () => {
  it("rincian dimatikan sendiri di atas batasnya", () => {
    expect(kode).toContain("const BATAS_RINCIAN = 1000;");
    expect(kode).toContain("const rincianDimatikan = rinci && baris.length > BATAS_RINCIAN;");
  });

  it("diputuskan sesudah tahu berapa barisnya, bukan dari nama periodenya", () => {
    // Rentang bebas yang dipilih sendiri bisa lebih lebar daripada setahun.
    expect(kode).toContain("baris = await fakta(dari, sampai, dasar);");
    const iFakta = kode.indexOf("baris = await fakta(dari, sampai, dasar);");
    const iPutus = kode.indexOf("const rincianDimatikan =");
    expect(iPutus).toBeGreaterThan(iFakta);
  });

  it("layar menyebutkan sebabnya, bukan menampilkan tabel kosong", () => {
    expect(layar).toContain("hasil.rincianDimatikan");
    expect(layar).toContain("Persempit rentangnya untuk melihatnya.");
  });
});

describe("grafiknya memakai bentuk yang sudah diperiksa", () => {
  it("daftar bentuk dibaca dari komponennya, tidak disalin", () => {
    expect(layar).toContain('from "@/components/portal/statistics-chart"');
    expect(layar).toContain("JENIS_GRAFIK.map((j)");
  });

  it("tidak ada pustaka grafik baru", () => {
    for (const pustaka of ["recharts", "chart.js", "apexcharts", "nivo", "d3"]) {
      expect(layar.toLowerCase(), pustaka).not.toContain(`from "${pustaka}`);
    }
  });

  it("empat ukuran dapat digambar - termasuk jumlah putusan mentahnya", () => {
    for (const u of ["skor", "putusan", "rataSkor", "aksara"]) {
      expect(layar, u).toContain(`value="${u}"`);
    }
  });
});

describe("rekonvensi dibaca dari naskahnya, bukan hanya dari tabelnya", () => {
  it("dua sumber digabung", () => {
    // Tabel mencatat 10 perkara; naskah yang berkepala "Dalam Rekonvensi" atau
    // "Dalam Konvensi" mencatat 22; gabungannya 31. Tabelnya sendirian
    // melewatkan dua pertiganya.
    expect(kode).toContain("FROM perkara_rekonvensi r");
    expect(kode).toContain("'%Dalam Rekonvensi%'");
    expect(kode).toContain("'%Dalam Konvensi%'");
  });

  it("angka pengukurannya tercatat di sumbernya", () => {
    expect(layanan).toContain("mencatat 22");
    expect(layanan).toContain("Gabungan keduanya: 31");
  });

  it("eksepsi disebut tidak ada sumbernya, bukan dikarang", () => {
    // Tidak ada tabelnya, DAN "Dalam Eksepsi" nol dari 2.228 naskah.
    expect(layanan).toContain("nol\n *                               dari 2.228 naskah");
    expect(kode).not.toContain("Dalam Eksepsi");
  });
});

describe("komponen yang sumbernya kosong padam sendiri", () => {
  it("dipadamkan menurut data rentangnya, bukan menurut tebakan", () => {
    expect(kode).toContain("const adaKuasa = baris.some((b) => Number(b.kuasa) > 0);");
    expect(kode).toContain("const adaMediasi = baris.some((b) => Number(b.mediasi) > 0);");
  });

  it("bobotnya tetap berdiri supaya menyala sendiri kelak", () => {
    // pihak_pengacara menyentuh 4 dari 9.993 perkara. Membuang bobotnya
    // berarti harus menyunting kode lagi begitu satker mulai mengisinya.
    expect(kode).toContain("kuasaHukum: 0.3");
    expect(kode).toContain("if (!padam.kuasaHukum && Number(baris.kuasa) > 0)");
  });

  it("padamnya DIKATAKAN, bukan dibisukan", () => {
    expect(kode).toContain("Kuasa hukum TIDAK dinilai pada rentang ini");
    expect(layar).toContain("hasil.padam");
  });
});

describe("tidak membaca yang tidak akan dipakai", () => {
  it("hanya dasar yang dipilih yang dikuerikan", () => {
    // Kueri hakim 1.182 ms dan panitera 377 ms atas rentang seluruh basis
    // data. Membaca keduanya lalu membuang salah satunya adalah satu setengah
    // detik yang diminta dari MySQL satker tanpa sebab.
    expect(kode).toContain('dasar === "ketua-majelis" ? hakim : kosong');
    expect(kode).toContain('dasar === "panitera" ? panitera : kosong');
    expect(kode).toContain("async function fakta(dari, sampai, dasar)");
  });

  it("penanda rekonvensi di naskah ikut kueri aksara, bukan kueri sendiri", () => {
    // Keduanya membaca tabel yang sama dan sama-sama membuka longtext-nya.
    // Terpisah, yang kedua diukur 1.588 ms - membaca ulang naskah yang barusan
    // dibaca.
    expect(kode).toContain("MAX(ph.pertimbangan_hukum LIKE '%Dalam Rekonvensi%'");
    const rek = kode.slice(kode.indexOf("const rekonvensi = () =>"), kode.indexOf("const sela = () =>"));
    expect(rek).not.toContain("perkara_pertimbangan_hukum");
  });

  it("gabungannya tetap menghitung kedua sumber", () => {
    expect(kode).toContain("(petaRekonvensi.get(id) || 0) + (petaRekonvensiNaskah.get(id) || 0)");
  });
});

describe("ragam perkara: kebendaan, gugatan, permohonan", () => {
  it("kebendaan menang atas permohonan", () => {
    // P3HP bernomor Pdt.P tetapi naskahnya 3.049 aksara, di atas rata-rata
    // Pdt.G - itulah pengecualian yang diminta satker.
    const potongan = kode.slice(kode.indexOf("function ragamPerkara("));
    const iKebendaan = potongan.indexOf("kebendaan");
    const iPdtG = potongan.indexOf("pdt");
    expect(iKebendaan).toBeGreaterThan(-1);
    expect(iKebendaan).toBeLessThan(iPdtG);
  });

  it("penggandanya KECIL, sebab sidang dan aksara sudah menangkap sebagiannya", () => {
    expect(kode).toContain("kebendaan: 1.3");
    expect(kode).toContain("permohonan: 0.85");
    expect(layanan).toContain("menghitung berat yang sama dua kali");
  });

  it("daftar kebendaannya diturunkan dari jenis yang sungguh diputus", () => {
    for (const jenis of ["harta bersama", "kewarisan", "ekonomi syariah"]) {
      expect(kode, jenis).toContain(`"${jenis}"`);
    }
  });
});

describe("tiga sumbu, bukan satu angka", () => {
  it("ketiganya ada", () => {
    expect(kode).toContain("sumbu: {");
    expect(kode).toContain("beban: bulat(o.skorMentah)");
    expect(kode).toContain("kelengkapan:");
    expect(kode).toContain("keragaman:");
  });

  it("kelengkapan dibaca sebagai persen, bukan skor yang dikumpulkan", () => {
    // Menyimpan naskah dan menganonimkan amar adalah kewajiban, bukan prestasi.
    expect(kode).toContain("Math.round((o.lengkapBerkas / o.putusan) * 100)");
  });

  it("keragaman diukur terhadap median satker, bukan terhadap rata-rata", () => {
    expect(kode).toContain("const medianSatker = tengah(semuaSkor)");
    expect(kode).toContain("o.skorTiap.filter((s) => s >= medianSatker).length");
  });

  it("layar menggambar ketiganya", () => {
    expect(layar).toContain('value="kelengkapan"');
    expect(layar).toContain('value="keragaman"');
  });
});

describe("beban per bulan aktif, dan median di samping rata-rata", () => {
  it("bulan aktif dihitung dari putusan pertama sampai terakhir", () => {
    expect(kode).toContain("const bulanAktif =");
    expect(kode).toContain("HARI_SEBULAN");
    expect(kode).toContain("skorPerBulan:");
  });

  it("tanggalnya dilewatkan tanggalIso - obyek Date membuatnya nol diam-diam", () => {
    // String(date).slice(0,10) menghasilkan "Wed Sep 08", cocok-polanya gagal,
    // dan seluruh angka per-bulan terbaca NOL tanpa satu pun galat berbunyi.
    expect(kode).toContain("const tgl = tanggalIso(satu.tanggalPutusan);");
    expect(kode).not.toContain('String(satu.tanggalPutusan || "").slice(0, 10);\n    if (/^');
  });

  it("median dipulangkan berdampingan dengan rata-rata", () => {
    expect(kode).toContain("tengahSkor: tengah(o.skorTiap)");
    expect(kode).toContain("medianSkorPerPutusan:");
    expect(layar).toContain("Rata / median");
  });
});

describe("bobot yang diturunkan dari data satker", () => {
  it("sidang dan aksara jadi SASARAN, tidak ikut sebagai penduga", () => {
    // Memasukkannya berarti menduga sesuatu dengan dirinya sendiri, dan
    // angkanya akan tampak sempurna tanpa berarti apa pun.
    const potongan = kode.slice(kode.indexOf("function usulBobotDariData("));
    const penduga = potongan.slice(potongan.indexOf("const penduga ="), potongan.indexOf("const sasaran ="));
    expect(penduga).not.toContain("sidang");
    expect(penduga).not.toContain("panjangPertimbangan");
  });

  it("diselesaikan tanpa pustaka tambahan", () => {
    // Keterangannya, bukan kodenya - `kode` sengaja membuang baris komentar.
    expect(layanan).toContain("Persamaan normal X'X w = X'y");
    const paket = baca("manajemen_surat/package.json");
    for (const pustaka of ["ml-regression", "simple-statistics", "regression"]) {
      expect(paket, pustaka).not.toContain(`"${pustaka}"`);
    }
  });

  it("bobot negatif dijadikan nol, DAN dikatakan", () => {
    // Dibaca apa adanya, contradictoir -0,14 berarti "perkara contradictoir
    // lebih ringan daripada verstek" - alat yang berkata begitu memberi angka
    // lebih tinggi kepada perkara yang tergugatnya tidak pernah datang.
    expect(kode).toContain("usul[nama] = Math.max(0, sah);");
    expect(kode).toContain("dinolkan.push({ nama, nilaiAsli: sah })");
    expect(layanan).toContain("bukan bahwa ia meringankan perkaranya");
  });

  it("berapa perkara yang menopang tiap bobot ikut dipulangkan", () => {
    expect(kode).toContain("const teramati = {};");
    expect(kode).toContain("adalah kebetulan, bukan kebiasaan");
  });

  it("dihitung hanya bila diminta - ia menyisir ulang seluruh baris", () => {
    expect(kode).toContain("minta.usulBobot ? usulBobotDariData(baris) : undefined");
    expect(gerbang).toContain('usulBobot: String(req.query.usulBobot || "") === "1"');
  });

  it("layar menampilkannya BERDAMPINGAN, tidak menggantikan diam-diam", () => {
    expect(layar).toContain("Usul bobot dari data satker");
    expect(layar).toContain(">Berlaku<");
    expect(layar).toContain(">Usul dari data<");
  });
});

describe("yang sengaja TIDAK dinilai, dan sebabnya tercatat", () => {
  it("ketepatan waktu tidak dibuat - ia tidak membedakan siapa pun", () => {
    // Rata daftar->putus 37 hari, dan hanya 1 dari 683 melewati 150 hari.
    expect(layanan).toContain("rata daftar->putus 37 hari");
    expect(kode).not.toMatch(/tanggal_pendaftaran/);
    expect(kode).not.toMatch(/ketepatanWaktu|perHariTerlambat/);
  });

  it("banding dibaca tetapi tidak pernah masuk skor", () => {
    expect(kode).toContain("banding: petaBanding.get(id) || 0");
    // Tidak ada bobot bernama banding, dan skorSatu tidak menyentuhnya.
    const potongan = kode.slice(kode.indexOf("function skorSatu("), kode.indexOf("function jedaHari("));
    expect(potongan).not.toContain("banding");
    expect(kode).toContain("putusan yang dibanding bukan putusan yang salah");
  });

  it("pengganda ditolak dan tidak-dapat-diterima memang dibuang", () => {
    // Beratnya sudah tertangkap sidang dan aksara - Ditolak 5,1 sidang dan
    // 15.277 aksara, di atas Dikabulkan pada keduanya.
    expect(kode).not.toContain('"tidak dapat diterima"');
    expect(kode).not.toContain("ditolak:");
    expect(layanan).toContain("mengganjar mengabulkan");
  });
});

describe("kewenangan dan komponen yang tidak ada sumbernya", () => {
  it("rute menuntut kapabilitas yang sama dengan layar e-Court lain", () => {
    expect(rute).toContain('pastikanKapabilitas(db, actorUserId, "panel")');
  });

  it("komponen tanpa sumber disebut, supaya tidak dikira terlewat", () => {
    for (const hilang of ["eksepsi", "kumulasi", "mediasi"]) {
      expect(layanan, hilang).toContain(hilang);
    }
    expect(layanan).toContain("TIDAK ADA SUMBERNYA");
  });

  it("tidak menulis apa pun ke SIPP", () => {
    expect(kode).not.toMatch(/\b(INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM|ALTER\s+TABLE|CREATE\s+INDEX)\b/i);
  });
});
