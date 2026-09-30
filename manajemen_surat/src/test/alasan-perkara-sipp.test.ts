// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  susunTeksAlasan,
  teksDariHtml,
  usulkanAlasanPerkara,
} from "@/lib/alasan-perkara-sipp";
import { type MedanPilihan } from "@/lib/usulan-medan-putusan";

/**
 * ============================================================================
 * ISIAN ALASAN PADA LAYAR INFO PERKARA AGAMA (DATA UMUM)
 * ============================================================================
 *
 * Daftar pilihan di bawah ini disalin APA ADANYA dari tabel rujukan SIPP
 * sipp_donggala - ref_dispensasi_kawin, ref_isbat_nikah, ref_izin_poligami -
 * bukan dikarang untuk memudahkan uji. Angka yang dipilih di layar itu kelak
 * menjadi laporan statistik perkara agama, jadi yang diuji di sini harus
 * berhadapan dengan tulisan yang benar-benar dibaca petugas.
 */

const AKAR_EKSTENSI = path.resolve(process.cwd(), "..", "ekstensi-sipp");
const bacaEkstensi = (nama: string) => readFileSync(path.join(AKAR_EKSTENSI, nama), "utf8");

/** ref_dispensasi_kawin, apa adanya. */
const MEDAN_DISPENSASI: MedanPilihan = {
  kunci: 'select[name="alasan_dispen"]',
  label: "Alasan Pengajuan Dispensasi Kawin",
  pilihan: [
    { nilai: "0", label: "- Pilih -" },
    { nilai: "1", label: "Hamil" },
    { nilai: "2", label: "Pergaulan Bebas/Hubungan Intim" },
    { nilai: "3", label: "Ekonomi" },
    { nilai: "4", label: "Budaya/Adat/Perjodohan" },
    { nilai: "5", label: "Menghindari Zina/Hubungan Cinta" },
  ],
};

/** ref_isbat_nikah, apa adanya. */
const MEDAN_ISBAT: MedanPilihan = {
  kunci: 'select[name="alasan_isbat"]',
  label: "Alasan Pengajuan Isbat Nikah",
  pilihan: [
    { nilai: "0", label: "- Pilih -" },
    { nilai: "1", label: "Perceraian" },
    { nilai: "2", label: "Nikah dibawah tangan" },
    { nilai: "3", label: "Akta nikah hilang" },
    { nilai: "4", label: "Kelengkapan administrasi" },
  ],
};

/** ref_izin_poligami, apa adanya. */
const MEDAN_POLIGAMI: MedanPilihan = {
  kunci: 'select[name="alasan_poligami"]',
  label: "Alasan Pengajuan Poligami",
  pilihan: [
    { nilai: "0", label: "- Pilih -" },
    { nilai: "1", label: "Istri tidak dapat menjalankan kewajiban" },
    { nilai: "2", label: "Cacat badan atau penyakit yang tidak dapat disembuhkan" },
    { nilai: "3", label: "Istri tidak dapat melahirkan keturunan" },
  ],
};

describe("membaca posita dari isi CKEditor", () => {
  it("membuang tag dan memulangkan kalimatnya", () => {
    expect(teksDariHtml("<p>Bahwa Pemohon <strong>mengajukan</strong> permohonan.</p>")).toBe(
      "Bahwa Pemohon mengajukan permohonan."
    );
  });

  it("memisahkan alinea, sehingga akhir satu alinea tidak menempel pada awal alinea berikutnya", () => {
    // Tanpa pemisahan ini "hamil" dan "Bahwa" melebur menjadi "hamilBahwa",
    // dan kata yang dicari pencocok tidak pernah ditemukan.
    const hasil = teksDariHtml("<p>Anak Pemohon telah hamil</p><p>Bahwa oleh karena itu</p>");
    expect(hasil).toContain("hamil\nBahwa");
    expect(hasil).not.toContain("hamilBahwa");
  });

  it("<br> juga memisahkan, termasuk yang ditulis <br/>", () => {
    expect(teksDariHtml("satu<br>dua<br />tiga")).toBe("satu\ndua\ntiga");
  });

  it("menerjemahkan huruf ganti yang lazim dipakai CKEditor", () => {
    expect(teksDariHtml("PT&nbsp;Bank &amp; Asuransi")).toBe("PT Bank & Asuransi");
  });

  it("tag dibuang LEBIH DULU, baru huruf gantinya diterjemahkan", () => {
    // Petugas yang menulis "&lt;p&gt;" bermaksud menuliskan tanda itu, bukan
    // membuat tag. Menerjemahkannya lebih dulu akan melahirkan tag sungguhan,
    // lalu membuangnya - dan kalimat yang memuatnya hilang tanpa satu pun
    // tanda.
    expect(teksDariHtml("<p>ditulis &lt;p&gt; pada surat</p>")).toBe("ditulis <p> pada surat");
  });

  it("isi script dan style tidak ikut dinilai", () => {
    const hasil = teksDariHtml("<p>Posita</p><script>var hamil = 1;</script>");
    expect(hasil).toBe("Posita");
  });

  it("posita lebih dahulu, petitum sesudahnya", () => {
    const hasil = susunTeksAlasan({ posita: "<p>Duduk perkaranya</p>", petitum: "<p>Mohon putusan</p>" });
    expect(hasil.indexOf("Duduk perkaranya")).toBeLessThan(hasil.indexOf("Mohon putusan"));
  });

  it("petitum yang kosong tidak meninggalkan baris hampa", () => {
    expect(susunTeksAlasan({ posita: "<p>Duduk perkaranya</p>", petitum: "" })).toBe("Duduk perkaranya");
  });
});

describe("mengusulkan alasan perkara dari posita", () => {
  it("dispensasi kawin: posita yang menyebut hamil memilih Hamil", () => {
    const usulan = usulkanAlasanPerkara(
      {
        posita:
          "<p>Bahwa anak Pemohon bernama ANI binti BUDI telah hamil 4 (empat) bulan, " +
          "sehingga pernikahannya perlu segera dilangsungkan.</p>",
      },
      [MEDAN_DISPENSASI]
    );

    expect(usulan).toHaveLength(1);
    expect(usulan[0].nilai).toBe("1");
    expect(usulan[0].nilaiLabel).toBe("Hamil");
    expect(usulan[0].kutipan).toContain("hamil");
  });

  it("isbat nikah: posita yang menyebut dua alasan sekaligus dilaporkan BENTROK, bukan dipilihkan diam-diam", () => {
    // Inilah keadaan yang paling berbahaya: dua alasan sama-sama disebut,
    // mesin memilih salah satunya dengan selisih tipis, dan angka yang
    // tersimpan menentukan satu baris laporan tahunan. Yang benar adalah
    // mengembalikannya kepada petugas.
    const usulan = usulkanAlasanPerkara(
      {
        posita:
          "<p>Bahwa pernikahan Pemohon dilaksanakan secara nikah dibawah tangan.</p>" +
          "<p>Bahwa akta nikah hilang ketika rumah Pemohon terbakar.</p>",
      },
      [MEDAN_ISBAT]
    );

    expect(usulan[0].keyakinan).toBe("bentrok");
    expect(usulan[0].alasan).toContain("lebih dari satu");
  });

  it("tidak menebak: posita yang tidak menyebut satu pun alasan memulangkan pilihan kosong", () => {
    const usulan = usulkanAlasanPerkara(
      { posita: "<p>Bahwa Pemohon adalah warga Kabupaten Donggala.</p>" },
      [MEDAN_POLIGAMI]
    );

    expect(usulan[0].nilai).toBe("");
    expect(usulan[0].keyakinan).toBe("kosong");
    expect(usulan[0].alasan).toContain("tidak menebak");
  });

  it('"- Pilih -" tidak pernah diusulkan', () => {
    const usulan = usulkanAlasanPerkara({ posita: "<p>Silakan pilih saja.</p>" }, [MEDAN_DISPENSASI]);
    expect(usulan[0].nilai).not.toBe("0");
    expect(usulan[0].nilaiLabel).not.toBe("- Pilih -");
  });

  it("posita kosong tidak menghasilkan usulan sama sekali", () => {
    // Bukan usulan bernilai kosong melainkan TIDAK ADA usulan: bedanya
    // menentukan pesan yang dilihat petugas - "isi positanya dulu", bukan
    // "tidak ditemukan".
    expect(usulkanAlasanPerkara({ posita: "<p>&nbsp;</p>" }, [MEDAN_DISPENSASI])).toEqual([]);
  });

  it("medan yang daftarnya hanya berisi - Pilih - dikatakan apa adanya", () => {
    // ref_pengesahan_anak tidak ada pada sebagian pemasangan SIPP, dan
    // selectnya lahir tanpa satu pun pilihan. Yang salah bukan positanya.
    const usulan = usulkanAlasanPerkara({ posita: "<p>Bahwa anak Pemohon telah lahir.</p>" }, [
      {
        kunci: 'select[name="alasan_sah_anak"]',
        label: "Alasan Pengajuan Pengesahan Anak",
        pilihan: [{ nilai: "0", label: "- Pilih -" }],
      },
    ]);
    expect(usulan[0].nilai).toBe("");
    expect(usulan[0].alasan).toContain("tidak menawarkan pilihan");
  });
});

describe("bagian Isi alasan perkara pada ekstensi", () => {
  const konten = bacaEkstensi("konten.js");
  // Batas akhirnya fungsi yang BERIKUTNYA, bukan bagianIsiPutusan yang
  // berjarak delapan ratus baris. Potongan selebar itu ikut menelan fungsi
  // lain yang kebetulan berdiri di antaranya - dan sejak 1.124.0 salah
  // satunya memang menekan Simpan pada borang PUTUSAN, yang aturannya berbeda
  // dari layar ini. Penjagaan yang menuduh kode yang bukan miliknya bukan
  // penjagaan.
  const bagian = konten.slice(
    konten.indexOf("function bagianIsiAlasanPerkara("),
    konten.indexOf("function perkaraIdDariHalaman(")
  );

  it("bagiannya benar-benar ada", () => {
    expect(bagian.length).toBeGreaterThan(2000);
  });

  it("tidak pernah menekan tombol Simpan", () => {
    // Yang tersimpan dari layar ini menjadi statistik resmi perkara agama.
    // Satu-satunya tempat manusia masih membacanya adalah sebelum Simpan
    // ditekan.
    expect(bagian).not.toContain('jenis: "tekan"');
    expect(bagian).toContain("tekan Simpan sendiri");
  });

  it("hanya digambar di halaman yang memang memuat blangko Data Umum", () => {
    expect(konten).toContain('document.querySelector("#frm_data_umum")');
    expect(konten).toContain("bagianIsiAlasanPerkara(konteks.nomorPerkara)");
  });

  it("medannya ditunjuk lewat NAMA, bukan id", () => {
    // Alasan yang sama dengan borang putusan: pada borang SIPP ada select yang
    // memakai id milik select lain, dan querySelector("#...") memulangkan yang
    // mana pun yang lebih dulu di dokumen.
    const daftar = bagian.slice(bagian.indexOf("const CALON_ALASAN"), bagian.indexOf("tombol.addEventListener"));
    expect(daftar).not.toMatch(/penunjuk:\s*"#/);
    for (const nama of [
      "alasan_poligami",
      "batal_kawin",
      "alasan_kuasa_anak",
      "alasan_sah_anak",
      "alasan_asalusul",
      "alasan_isbat",
      "alasan_dispen",
    ]) {
      expect(daftar).toContain(`select[name="${nama}"]`);
    }
  });

  it("medan pilihan ganda TIDAK ditawarkan", () => {
    // objek_wakaf[] dan akad_syariah[] digambar alat pilihan ganda milik
    // halaman, yang menyimpan pilihannya terpisah dari select aslinya.
    // Menyetel nilainya membuat daftar di layar tidak ikut berubah - petugas
    // melihat satu hal dan yang tersimpan hal lain.
    expect(bagian).not.toContain("objek_wakaf");
    expect(bagian).not.toContain('akad_syariah[]');
  });

  it("medan yang disembunyikan SIPP tidak pernah ditawarkan", () => {
    expect(bagian).toContain('jenis: "pilihan"');
    expect(bagian).toContain("jawabPilihan.tampak");
  });

  it("posita dibaca dari CKEditor di layar, bukan dari basis data", () => {
    expect(bagian).toContain('jenis: "nilai"');
    expect(bagian).toContain('penunjuk: "#posita"');
    expect(bagian).toContain('penunjuk: "#petitum"');
    expect(bagian).toContain('jenisMedan: "kaya"');
  });

  it("usulan yang berselisih tidak dicentang sendiri", () => {
    expect(bagian).toContain('usul.keyakinan !== "bentrok"');
  });

  it("memakai rute portal yang memang ada", () => {
    expect(konten).toContain(
      'const ALETA_API_ALASAN_PERKARA = "/aleta/api/aleta-ecourt/alasan-perkara"'
    );
    const rute = path.resolve(process.cwd(), "src/app/api/aleta-ecourt/alasan-perkara/route.ts");
    expect(readFileSync(rute, "utf8")).toContain("export async function POST");
  });
});

describe("medan yang DIPETIK pada bagian yang sama", () => {
  const konten = bacaEkstensi("konten.js");
  // Batas akhirnya fungsi yang BERIKUTNYA, bukan bagianIsiPutusan yang
  // berjarak delapan ratus baris. Potongan selebar itu ikut menelan fungsi
  // lain yang kebetulan berdiri di antaranya - dan sejak 1.124.0 salah
  // satunya memang menekan Simpan pada borang PUTUSAN, yang aturannya berbeda
  // dari layar ini. Penjagaan yang menuduh kode yang bukan miliknya bukan
  // penjagaan.
  const bagian = konten.slice(
    konten.indexOf("function bagianIsiAlasanPerkara("),
    konten.indexOf("function perkaraIdDariHalaman(")
  );
  const daftar = bagian.slice(
    bagian.indexOf("const CALON_PETIKAN"),
    bagian.indexOf("tombol.addEventListener")
  );

  it("empat medan wajib perkara cerai dan dua medan itsbat ditawarkan", () => {
    expect(daftar.length).toBeGreaterThan(200);
    for (const nama of [
      "tgl_nikah",
      "tgl_kutipan_akta_nikah",
      "no_kutipan_akta_nikah",
      "tgl_menikah_isbat",
      "tempat_menikah_isbat",
    ]) {
      expect(daftar).toContain(`input[name="${nama}"]`);
    }
  });

  it("medan KUA TIDAK diisikan, hanya disebutkan", () => {
    // Daftarnya dicari SIPP ke peladen ketika petugas mengetik, dan pilihannya
    // belum ada di halaman sebelum itu. Mengisinya menuntut menebak kodenya,
    // dan kode KUA yang salah menautkan perceraian ke kantor yang lain.
    expect(daftar).not.toContain("ref_kua");
    expect(bagian).toContain("ALETA tidak dapat memilihkannya");
  });

  it("tanggal diisi lewat jenis medan tanggal, bukan sebagai teks biasa", () => {
    // Datepicker jQuery UI menyimpan tanggalnya terpisah dari value. Menyetel
    // value saja membuat kotaknya berubah sementara tanggal yang dipegang
    // datepicker tetap yang lama.
    expect(daftar).toContain('jenisMedan: "tanggal"');
  });

  it("yang diisikan adalah isi kotak saat Terapkan ditekan, bukan petikan semula", () => {
    // Tanpa ini, suntingan petugas - satu kata "Duplikat", satu nama desa yang
    // dibetulkan - hilang tanpa satu pun tanda.
    expect(bagian).toContain("nilai: () => kotakIsi.value.trim()");
    expect(bagian).toContain("nilai: satu.nilai()");
    expect(bagian).toContain("x.centang.checked && x.nilai()");
  });

  it("medan yang disembunyikan SIPP tidak ikut ditawarkan", () => {
    expect(bagian).toContain("jawabNilai.tampak");
  });

  it("bagiannya tetap digambar walau perkara itu tidak punya medan alasan sama sekali", () => {
    // Perkara cerai - sebagian besar perkara pengadilan agama - tidak punya
    // satu pun medan alasan pada layar ini, tetapi punya empat medan wajib
    // yang dapat dipetik. Berhenti karena daftar alasannya kosong berarti
    // fitur ini mati justru pada perkara yang paling banyak.
    expect(bagian).toContain("medanTampak.length === 0 && petikanTampak.length === 0");
  });

  it("rutenya memulangkan petikan nikah beserta usulan alasan", () => {
    const rute = readFileSync(
      path.resolve(process.cwd(), "src/app/api/aleta-ecourt/alasan-perkara/route.ts"),
      "utf8"
    );
    expect(rute).toContain("petikDataNikah");
    expect(rute).toContain("nikah:");
  });
});

describe("kotak Obyek Sengketa - kebiasaan satker, bukan pembacaan posita", () => {
  const konten = bacaEkstensi("konten.js");
  // Batas akhirnya fungsi yang BERIKUTNYA, bukan bagianIsiPutusan yang
  // berjarak delapan ratus baris. Potongan selebar itu ikut menelan fungsi
  // lain yang kebetulan berdiri di antaranya - dan sejak 1.124.0 salah
  // satunya memang menekan Simpan pada borang PUTUSAN, yang aturannya berbeda
  // dari layar ini. Penjagaan yang menuduh kode yang bukan miliknya bukan
  // penjagaan.
  const bagian = konten.slice(
    konten.indexOf("function bagianIsiAlasanPerkara("),
    konten.indexOf("function perkaraIdDariHalaman(")
  );

  it("kotaknya ditunjuk lewat nama, dan hanya bila tampak", () => {
    expect(bagian).toContain(`textarea[name="obyek_gugatan"]`);
    expect(bagian).toContain("bacaObyek.tampak");
  });

  it("kebiasaannya baru diminta bila kotaknya memang tampak", () => {
    // Menghitung kebiasaan berarti satu kueri ke SIPP lewat gerbang bot.
    // Layar yang tidak menampilkan kotaknya tidak perlu membayarnya.
    expect(bagian).toContain("mintaObyek: obyekTampak");
  });

  it("dicentang sendiri HANYA bila kebiasaannya bulat", () => {
    expect(bagian).toContain("dataObyek.yakin");
    expect(bagian).toContain("centang.checked = Boolean(teratas && teratas.nilai && dataObyek.yakin)");
  });

  it("kebiasaan lain disebut, supaya petugas tahu ada pilihan", () => {
    expect(bagian).toContain("Pernah ditulis juga untuk");
  });

  it("yang diisikan isi kotak saat Terapkan ditekan, lewat jalur yang sama dengan petikan", () => {
    expect(bagian).toContain("nilai: () => kotakObyek.value.trim()");
  });

  it("bagiannya tetap digambar walau hanya kotak obyek yang tampak", () => {
    expect(bagian).toContain("petikanTampak.length === 0 && !obyekTampak");
  });

  it("rutenya membaca kebiasaan lewat gerbang bot, dan gagal membacanya tidak menggagalkan yang lain", () => {
    const rute = readFileSync(
      path.resolve(process.cwd(), "src/app/api/aleta-ecourt/alasan-perkara/route.ts"),
      "utf8"
    );
    expect(rute).toContain("getGatewaySippObyekSengketa");
    expect(rute).toContain("badan?.mintaObyek && nomorPerkara");
    expect(rute).toContain('sebab: jawab.error || "SIPP tidak terbaca."');
  });

  it("bot mendaftarkan tabelnya di layanan skema - yang tidak terdaftar dijawab tidak ada tanpa error", () => {
    const skema = readFileSync(
      path.resolve(process.cwd(), "..", "aleta_bot", "services", "sippSkemaService.js"),
      "utf8"
    );
    expect(skema).toContain('"perkara_obyek_sengketa"');
    expect(skema).toContain('"jenis_perkara"');
  });
});

describe("jembatan dapat membaca nilai CKEditor", () => {
  const jembatan = bacaEkstensi("jembatan.js");

  it("permintaan nilai dikenali dan dijawab", () => {
    expect(jembatan).toContain("function bacaNilai(");
    expect(jembatan).toContain('pesan.jenis === "nilai"');
  });

  it("isi CKEditor diambil dari editornya, bukan dari textarea di baliknya", () => {
    // CKEditor baru menyalin isinya ke textarea ketika borang dikirim.
    // Membaca textarea sebelum itu memulangkan isi terakhir yang TERSIMPAN,
    // bukan yang sedang diketik - dan usulan yang lahir darinya akan mengaku
    // "tidak ditemukan" atas kalimat yang jelas terpampang di layar.
    const potongan = jembatan.slice(
      jembatan.indexOf("function bacaNilai("),
      jembatan.indexOf("function lepasPeristiwa(")
    );
    expect(potongan).toContain("editor.getData()");
    expect(potongan).toContain('sumber: "ckeditor"');
  });

  it("tidak merapikan apa pun - yang membersihkan HTML adalah portal, tempat yang dapat diuji", () => {
    const potongan = jembatan.slice(
      jembatan.indexOf("function bacaNilai("),
      jembatan.indexOf("function lepasPeristiwa(")
    );
    expect(potongan).not.toContain("replace(");
  });
});
