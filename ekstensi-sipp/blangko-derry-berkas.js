"use strict";

/**
 * ============================================================================
 * LAYAR KERJA SAMPUL BERKAS PERKARA DAN DAFTAR ISI BERKAS (26 Okt 2026)
 * ============================================================================
 *
 * Dua blangko milik derry_briantono di ABT ("Sampul Berkas Perkara" di 99 PTSP, "Daftar Isi Berkas" di 98b Berkas Perkara - BAS)
 * dibuka di panel Blangko ABT by Derry dengan layar kerja khusus, BILA saklar Fitur Satker "berkas-perkara-khusus" menyala
 * (bawaan MATI; mati = blangko dibuka seperti blangko biasa). Rancangan: docs/rancangan/sampul-daftar-isi-26okt/RANCANGAN.md.
 *
 *   Sampul     ciri perkara (otomatis dari data perkara, dapat dipaksa nyala/mati dengan tangan), isian khas jenis perkara,
 *              pratinjau naskah hasil susunan sungguhan (RTF yang sama dengan yang dicetak), ukuran kertas A4 / F4 / Legal.
 *   Daftar isi baris dokumen yang ADA pada perkara beserta halamannya (pasti dari berkas / perkiraan / manual), geser, sembunyikan,
 *              tambah baris, hitung ulang dari arsip. Halaman kumulatif per bundel; Bundel B mulai dari 1 atau melanjutkan A.
 *
 * Semua sunting petugas disimpan di ALETA (/sampul-berkas), tidak ada yang ditulis ke SIPP maupun ABT. Isi dokumen tidak pernah
 * dikirim, hanya jumlah halaman. Ukuran kertas diingat per pengguna di peramban.
 *
 * Bagian MURNI (uraiHalaman, hitungDaftarIsi, susunUrutan, rangkaiCiri, tanggalIndonesia, halamanPdf) adalah kembaran lib/berkas-perkara.ts
 * di portal; berkas-perkara-26okt.test.ts menjaga keduanya tetap sama.
 */
(function () {
  const API = "/aleta/api/aleta-ecourt/sampul-berkas";
  const API_NASKAH = `${API}/naskah`;
  const KODE_SAKLAR = "berkas-perkara-khusus";
  const K_KERTAS = "blangkoDerryKertas";
  const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  // ---------------------------------------------------------------------------
  // MURNI (kembaran lib/berkas-perkara.ts)
  // ---------------------------------------------------------------------------
  const LAMBANG = { a: "■", b: "●", c: "▲" };
  const CIRI = [
    { k: "prodeo", n: "PRODEO", g: "a", t: "perkara.prodeo" },
    { k: "ecourt", n: "e-COURT", g: "a", t: "terdaftar lewat e-Court" },
    { k: "kuasa", n: "KUASA HUKUM", g: "a", s: "P", t: "kuasa hukum aktif" },
    { k: "insidentil", n: "KUASA INSIDENTIL", g: "a", t: "kuasa insidentil" },
    { k: "ghaib", n: "GHAIB", g: "b", s: "T", p: 1, t: "penanda ghaib" },
    { k: "mafqud", n: "MAFQUD", g: "b", p: 1, t: "petitum atau posita menyebut mafqud" },
    { k: "pns", n: "PNS/ASN", g: "b", s: "T", t: "pekerjaan pihak" },
    { k: "pppk", n: "PPPK", g: "b", t: "pekerjaan pihak" },
    { k: "tni", n: "TNI", g: "b", t: "pekerjaan pihak" },
    { k: "polri", n: "POLRI", g: "b", t: "pekerjaan pihak" },
    { k: "bumn", n: "BUMN/BUMD", g: "b", t: "pekerjaan pihak" },
    { k: "disabilitas", n: "DISABILITAS", g: "b", s: "P", t: "pihak difabel" },
    { k: "penerjemah", n: "PENERJEMAH", g: "b", t: "isian tangan" },
    { k: "wna", n: "WNA", g: "b", t: "kewarganegaraan pihak" },
    { k: "verstek", n: "VERSTEK", g: "c", p: 1, t: "putusan verstek" },
    { k: "kumulasi", n: "KUMULASI", g: "c", s: "2", t: "gugatan kumulasi" },
    { k: "rekonvensi", n: "REKONVENSI", g: "c", t: "isian tangan" },
    { k: "mediasi", n: "MEDIASI", g: "c", t: "perkara menjalani mediasi" },
    { k: "sita", n: "SITA", g: "c", t: "isian tangan" },
    { k: "keliling", n: "SIDANG KELILING", g: "c", t: "ada sidang keliling" },
    { k: "tunggal", n: "HAKIM TUNGGAL", g: "c", t: "satu hakim aktif" },
    { k: "sederhana", n: "GUGATAN SEDERHANA", g: "c", t: "alur gugatan sederhana" },
    { k: "verzet", n: "VERZET", g: "c", t: "ada verzet" },
    { k: "dispensasi", n: "DISPENSASI KAWIN", g: "c", t: "jenis perkara dispensasi kawin" },
    { k: "ikrar", n: "IKRAR TALAK", g: "c", t: "ada ikrar talak" },
  ];

  const BAWAAN_HALAMAN = {
    gugatan: 3, permohonan: 4, penetapan: 1, phs: 2, relaas: 4, resi: 4, bas: 3, putusan: 13, pemberitahuan: 4, "akta-cerai": 1, ikrar: 3,
    jawaban: 3, replik: 1, duplik: 2, kesimpulan: 2, bukti: 2, kuasa: 2, skum: 1, slip: 1, sktm: 1, mediator: 1, "laporan-mediasi": 2,
    minutasi: 1, bht: 1, lain: 1,
  };

  function teksCiri(c, sisi) {
    const s = sisi != null && sisi !== "" ? sisi : c.s;
    return `[${LAMBANG[c.g]} ${c.n}${s ? ` ${s}` : ""}]`;
  }
  /** Isian #5801#: ciri yang berlaku, dua spasi di antaranya; tak satu pun = kalimat netral. */
  function rangkaiCiri(aktif, sisiDari) {
    const t = CIRI.filter((c) => aktif[c.k]).map((c) => teksCiri(c, sisiDari ? sisiDari[c.k] : undefined));
    return t.length ? t.join("  ") : "- tidak ada ciri khusus -";
  }

  // ---- sampul cetak awal (keputusan Derry 26 Okt, versi 4-6): kembaran lib/berkas-perkara.ts dan lib/lampiran-pihak.ts
  const CIRI_BUKAN_LENCANA_AWAL = ["verstek", "rekonvensi", "sita", "mediasi", "kumulasi"];
  const CIRI_BINGKAI_GANDA_AWAL = ["ghaib", "mafqud"];
  function ciriSampulAwal(aktif, sisiDari) {
    const teks = (c) => teksCiri(c, sisiDari ? sisiDari[c.k] : undefined);
    const biasa = CIRI.filter((c) => aktif[c.k] && !CIRI_BUKAN_LENCANA_AWAL.includes(c.k) && !CIRI_BINGKAI_GANDA_AWAL.includes(c.k)).map(teks);
    const satu = (k) => {
      const c = CIRI.find((x) => x.k === k);
      return c && aktif[k] ? teks(c) : "";
    };
    return { "5861": biasa.length ? biasa.join("  ") : "- tidak ada ciri khusus -", "5807": satu("ghaib"), "5808": satu("mafqud") };
  }
  const NAMA_SUSULAN = {
    mediasi: "MEDIASI", eksepsi: "EKSEPSI", rekonvensi: "REKONVENSI", sita: "PERMINTAAN SITA", setempat: "PEMERIKSAAN SETEMPAT", sela: "PUTUSAN SELA",
    ubah: "PERUBAHAN GUGATAN", panjar: "TAMBAHAN PANJAR", cabut: "PENCABUTAN", perbaikan: "PERBAIKAN PERMOHONAN", anak: "ANAK & CALON DIDENGAR", umum: "PENGUMUMAN 14 HARI",
  };
  const KUNCI_SUSULAN = ["mediasi", "eksepsi", "rekonvensi", "sita", "setempat", "sela", "ubah", "panjar", "cabut", "perbaikan", "anak", "umum"];
  function daftarSusulan(jenis, lawan) {
    const kunci = lawan
      ? ["mediasi", "eksepsi", "rekonvensi", "sita", "setempat", "sela", "ubah", "panjar", "cabut"]
      : ["perbaikan", "setempat", "panjar", "cabut"].concat(jenis === "dk" ? ["anak"] : jenis === "in" ? ["umum"] : []);
    return kunci.map((k) => ({ kunci: k, nama: NAMA_SUSULAN[k] }));
  }
  function rangkaiSusulan(daftar, centang, oto) {
    return daftar.map((d) => `${centang[d.kunci] ? "[X]" : "[ ]"} ${d.nama}${centang[d.kunci] && oto[d.kunci] ? " (oto)" : ""}`).join("   ");
  }
  // Alasan/tuntutan pokok (kembaran lib/lampiran-sampul.ts): lampiran memuat semua butir; yang terdeteksi atau dicentang ditandai
  const ALASAN_CERAI = {
    judul: "ALASAN PERCERAIAN",
    dasar: "Pasal 19 PP 9/1975 jo. Pasal 116 KHI",
    butir: [
      ["a", "salah satu pihak berbuat zina, atau menjadi pemabuk, pemadat, penjudi, dan lain sebagainya yang sukar disembuhkan"],
      ["b", "salah satu pihak meninggalkan pihak lain selama 2 (dua) tahun berturut-turut tanpa izin dan tanpa alasan yang sah"],
      ["c", "salah satu pihak mendapat hukuman penjara 5 (lima) tahun atau hukuman yang lebih berat"],
      ["d", "salah satu pihak melakukan kekejaman atau penganiayaan berat yang membahayakan pihak lain"],
      ["e", "salah satu pihak mendapat cacat badan atau penyakit sehingga tidak dapat menjalankan kewajibannya"],
      ["f", "antara suami dan isteri terus-menerus terjadi perselisihan dan pertengkaran dan tidak ada harapan akan hidup rukun lagi"],
      ["g", "suami melanggar taklik talak"],
      ["h", "peralihan agama atau murtad yang menyebabkan terjadinya ketidakrukunan dalam rumah tangga"],
    ],
  };
  const ALASAN_JENIS = {
    cg: ALASAN_CERAI,
    ct: ALASAN_CERAI,
    in: {
      judul: "ALASAN ITSBAT NIKAH",
      dasar: "Pasal 7 ayat (3) KHI",
      butir: [
        ["a", "adanya perkawinan dalam rangka penyelesaian perceraian"],
        ["b", "hilangnya akta nikah"],
        ["c", "adanya keraguan tentang sah atau tidaknya salah satu syarat perkawinan"],
        ["d", "adanya perkawinan yang terjadi sebelum berlakunya Undang-Undang Nomor 1 Tahun 1974"],
        ["e", "perkawinan yang dilakukan oleh mereka yang tidak mempunyai halangan perkawinan menurut Undang-Undang Nomor 1 Tahun 1974, tetapi tidak tercatat"],
      ],
    },
    dk: { judul: "ALASAN DISPENSASI KAWIN", dasar: "posita permohonan", butir: [["1", "anak telah hamil"], ["2", "khawatir terjadi perbuatan zina / hubungan yang sangat erat"], ["3", "sudah lama bertunangan"], ["4", "lainnya"]] },
    waris: { judul: "TUNTUTAN POKOK", dasar: "petitum gugatan", butir: [["1", "penetapan ahli waris"], ["2", "pembagian harta waris"], ["3", "sita harta waris"]] },
    hb: { judul: "TUNTUTAN POKOK", dasar: "petitum gugatan", butir: [["1", "penetapan harta bersama"], ["2", "pembagian 1/2 bagian"], ["3", "sita marital"]] },
    paw: { judul: "KEPERLUAN PENETAPAN", dasar: "posita permohonan", butir: [["1", "pembagian waris"], ["2", "pengurusan tabungan / aset peninggalan"], ["3", "balik nama"]] },
  };
  function definisiAlasan(jenis) {
    const d = ALASAN_JENIS[jenis];
    return d ? { judul: d.judul, dasar: d.dasar, butir: d.butir.map(([kunci, nama]) => ({ kunci, nama })) } : null;
  }
  const MUAT_PIHAK = { lawan: 8, permohonan: 12 };
  const TURUT_SEBARIS = 3;
  function pihakBanyak(j) {
    return j.p1 > 1 || j.p2 > 1 || j.p3 > 0 || j.p4 > 0;
  }
  function perluLampiran(j, lawan) {
    const muat = lawan ? MUAT_PIHAK.lawan : MUAT_PIHAK.permohonan;
    return j.p1 > muat || j.p2 > muat || j.p3 > 0 || j.p4 > TURUT_SEBARIS;
  }

  function uraiHalaman(teks) {
    const t = String(teks == null ? "" : teks).trim();
    if (!t) return { tipe: "oto" };
    let m = t.match(/^(\d{1,3})$/);
    if (m && Number(m[1]) >= 1) return { tipe: "jumlah", n: Number(m[1]) };
    m = t.match(/^(\d{1,3})\s*[-–]\s*(\d{1,3})$/);
    if (m && Number(m[1]) >= 1 && Number(m[2]) >= Number(m[1])) return { tipe: "rentang", a: Number(m[1]), b: Number(m[2]) };
    return { tipe: "salah" };
  }

  function susunUrutan(kunciDasar, urutanTersimpan, kunciTambahan) {
    const dikenal = kunciDasar
      .concat(kunciTambahan)
      .filter((k) => (urutanTersimpan[k] || 0) > 0)
      .sort((a, b) => (urutanTersimpan[a] || 0) - (urutanTersimpan[b] || 0));
    if (!dikenal.length) return kunciDasar.concat(kunciTambahan);
    const hasil = dikenal.slice();
    for (const k of kunciDasar) {
      if (hasil.includes(k)) continue;
      const idx = kunciDasar.indexOf(k);
      let sisip = hasil.length;
      for (let q = idx + 1; q < kunciDasar.length; q += 1) {
        const pos = hasil.indexOf(kunciDasar[q]);
        if (pos >= 0) {
          sisip = pos;
          break;
        }
      }
      hasil.splice(sisip, 0, k);
    }
    for (const k of kunciTambahan) if (!hasil.includes(k)) hasil.push(k);
    return hasil;
  }

  /** baris = BarisDasar menurut urutan akhir; sunting = kunci -> {tampil, halamanTeks, judulManual, tanggalManual, tambahan}. */
  function hitungDaftarIsi(baris, sunting, opsi) {
    const total = {
      A: { dokumen: 0, halaman: 0, pasti: 0, perkiraan: 0, manual: 0, akhir: 0 },
      B: { dokumen: 0, halaman: 0, pasti: 0, perkiraan: 0, manual: 0, akhir: 0 },
    };
    const hasil = [];
    for (const bundel of ["A", "B"]) {
      let kursor = bundel === "B" && opsi && opsi.bundelB === "lanjut" ? total.A.akhir + 1 : 1;
      for (const dasar of baris.filter((b) => b.bundel === bundel)) {
        const s = sunting[dasar.kunci] || {};
        const tambahan = Boolean(s.tambahan);
        const u = uraiHalaman(s.halamanTeks);
        let jumlah = dasar.halaman;
        let sumber = tambahan ? "manual" : dasar.sumber;
        let awalPin = null;
        if (u.tipe === "jumlah") {
          jumlah = u.n;
          sumber = "manual";
        } else if (u.tipe === "rentang") {
          jumlah = u.b - u.a + 1;
          sumber = "manual";
          awalPin = u.a;
        }
        const b = Object.assign({}, dasar, {
          nama: tambahan && s.judulManual ? String(s.judulManual) : dasar.nama,
          tanggal: tambahan && s.tanggalManual != null ? String(s.tanggalManual) : dasar.tanggal,
          tersembunyi: s.tampil === false,
          tambahan,
          halamanTeks: String(s.halamanTeks == null ? "" : s.halamanTeks),
          salah: u.tipe === "salah",
          jumlah,
          sumberAkhir: sumber,
          awal: null,
          akhir: null,
          peringatan: "",
        });
        if (!b.tersembunyi) {
          const awal = awalPin != null ? awalPin : kursor;
          if (awalPin != null && awalPin < kursor) b.peringatan = "tumpang tindih dengan baris sebelumnya";
          if (awalPin != null && awalPin > kursor) b.peringatan = `ada halaman terlewat (${kursor}-${awalPin - 1})`;
          b.awal = awal;
          b.akhir = awal + jumlah - 1;
          kursor = b.akhir + 1;
          const t = total[bundel];
          t.dokumen += 1;
          t.halaman += jumlah;
          t.akhir = b.akhir;
          if (sumber === "pasti") t.pasti += jumlah;
          else if (sumber === "perkiraan") t.perkiraan += jumlah;
          else t.manual += jumlah;
        }
        hasil.push(b);
      }
    }
    return { baris: hasil, total };
  }

  function teksRentang(b) {
    if (b.awal == null || b.akhir == null) return "";
    return b.awal === b.akhir ? String(b.awal) : `${b.awal}-${b.akhir}`;
  }
  function tanggalIndonesia(t) {
    const m = String(t || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return String(t || "");
    return `${Number(m[3])} ${BULAN[Number(m[2]) - 1]} ${m[1]}`;
  }

  /** Jumlah halaman dari struktur PDF (tanpa pustaka): /Count pada /Type /Pages dan jumlah objek /Type /Page; sepakat = pasti. */
  function halamanPdf(buf) {
    const u = new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    if (s.slice(0, 5) !== "%PDF-") return null;
    let count = 0;
    let m;
    const a = /\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)/g;
    while ((m = a.exec(s))) count = Math.max(count, Number(m[1]));
    const b = /\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages\b/g;
    while ((m = b.exec(s))) count = Math.max(count, Number(m[1]));
    const objek = (s.match(/\/Type\s*\/Page\b(?!s)/g) || []).length;
    if (count > 0 && objek > 0 && count === objek) return { halaman: count, ragu: false };
    if (!count && !objek) return null;
    return { halaman: count || objek, ragu: count > 0 && objek > 0 };
  }

  // ---------------------------------------------------------------------------
  // Khas jenis perkara (fokus, blok isian, dokumen khas yang dapat ditambahkan)
  // ---------------------------------------------------------------------------
  const JENIS = {
    cg: { nama: "Cerai Gugat", khas: [["aktanikah", "Kutipan Akta Nikah", 1]] },
    ct: { nama: "Cerai Talak", khas: [["aktanikah", "Kutipan Akta Nikah", 1], ["izin", "Surat Izin Atasan (bila PNS/TNI/Polri)", 1]] },
    in: {
      nama: "Itsbat Nikah",
      fokus: "PASANGAN YANG DIITSBATKAN",
      blok: [["b1", "Tanggal menikah"], ["b2", "Tempat menikah"], ["b3", "Alasan itsbat"], ["b4", "Wali nikah"]],
      khas: [["pengumuman", "Pengumuman Itsbat Nikah (14 hari)", 1], ["ketkua", "Surat Keterangan KUA Tidak Tercatat", 1]],
    },
    dk: {
      nama: "Dispensasi Kawin",
      fokus: "ANAK YANG DIMOHONKAN DISPENSASI",
      blok: [["b1", "Calon pasangan"], ["b2", "Tanggal lahir anak"], ["b3", "Alasan dispensasi"], ["b4", "Pemohon adalah"]],
      khas: [["tolakkua", "Surat Penolakan KUA (pencatatan nikah)", 1], ["konseling", "Rekomendasi / Hasil Konseling Anak dan Calon", 2], ["ketanak", "Keterangan Anak dan Calon Pasangan", 3]],
    },
    aua: {
      nama: "Asal Usul Anak",
      fokus: "ANAK YANG DIMOHONKAN ASAL USULNYA",
      blok: [["b1", "Tanggal lahir"], ["b2", "Tempat lahir"], ["b3", "Orang tua"], ["b4", "Jenis permohonan"]],
      khas: [["aktalahir", "Akta / Surat Keterangan Kelahiran Anak", 1], ["ketbidan", "Surat Keterangan Bidan / Rumah Sakit", 1]],
    },
    wali: {
      nama: "Perwalian",
      fokus: "ANAK YANG DIMOHONKAN PERWALIANNYA",
      blok: [["b1", "Tanggal lahir anak"], ["b2", "Sebab perwalian"], ["b3", "Calon wali"], ["b4", "Harta anak"]],
      khas: [["kematian", "Surat Kematian Orang Tua Anak", 1], ["kk", "Kartu Keluarga Anak dan Calon Wali", 1]],
    },
    asuh: {
      nama: "Hak Asuh Anak",
      fokus: "ANAK YANG DIPERSENGKETAKAN",
      blok: [["b1", "Jumlah anak"], ["b2", "Diasuh saat ini oleh"], ["b3", "Nafkah anak dituntut"]],
      khas: [["aktalahir", "Akta Kelahiran Anak", 2]],
    },
    adhol: {
      nama: "Wali Adhol",
      fokus: "CALON MEMPELAI",
      blok: [["b1", "Calon suami"], ["b2", "Wali yang adhal"], ["b3", "Alasan penolakan wali"]],
      khas: [["tolakkua", "Surat Penolakan KUA (wali enggan menikahkan)", 1], ["ketwali", "Keterangan Calon Mempelai dan Wali", 2]],
    },
    poligami: {
      nama: "Izin Poligami",
      fokus: "CALON ISTRI KEDUA",
      blok: [["b1", "Status calon istri"], ["b2", "Alasan poligami"], ["b3", "Persetujuan istri"], ["b4", "Penghasilan pemohon"]],
      khas: [["setuju", "Surat Persetujuan Istri", 1], ["gaji", "Keterangan Penghasilan Pemohon", 1], ["adil", "Surat Pernyataan Berlaku Adil", 1]],
    },
    waris: {
      nama: "Kewarisan",
      fokus: "PEWARIS",
      blok: [["b1", "Tanggal wafat"], ["b2", "Jumlah ahli waris"], ["b3", "Harta waris"]],
      khas: [["kematian", "Surat Kematian Pewaris", 1], ["silsilah", "Silsilah / Keterangan Ahli Waris", 2], ["milik", "Bukti Kepemilikan Harta Waris", 6]],
    },
    paw: {
      nama: "Penetapan Ahli Waris",
      fokus: "PEWARIS",
      blok: [["b1", "Tanggal wafat"], ["b2", "Jumlah ahli waris"], ["b3", "Keperluan penetapan"]],
      khas: [["kematian", "Surat Kematian Pewaris", 1], ["silsilah", "Silsilah / Keterangan Ahli Waris dari Desa", 2], ["kk", "Kartu Keluarga Para Pemohon", 1]],
    },
    hb: {
      nama: "Harta Bersama",
      fokus: "BEKAS SUAMI DAN ISTRI",
      blok: [["b1", "Putusan cerai"], ["b2", "Objek harta"], ["b3", "Nilai sengketa"]],
      khas: [["aktacerai", "Akta Cerai / Putusan Cerai", 1], ["milik", "Bukti Kepemilikan Objek Harta", 5]],
    },
    es: {
      nama: "Ekonomi Syariah",
      fokus: "OBJEK SENGKETA",
      blok: [["b1", "Akad"], ["b2", "Bidang"], ["b3", "Nilai sengketa"]],
      khas: [["akad", "Akad / Perjanjian Pembiayaan", 8], ["somasi", "Surat Peringatan (Somasi)", 1]],
    },
    batal: {
      nama: "Pembatalan Nikah",
      fokus: "PERNIKAHAN YANG DIBATALKAN",
      blok: [["b1", "Tanggal nikah"], ["b2", "KUA"], ["b3", "Alasan pembatalan"]],
      khas: [["aktanikah", "Kutipan Akta Nikah yang Dibatalkan", 1]],
    },
    lain: { nama: "Perkara lain", fokus: "FOKUS PERKARA", blok: [["b1", "Pokok perkara"]], khas: [] },
  };

  // Isian umum: kunci -> {l, kode ABT yang ditimpa, butuh ciri}
  const ISIAN_UMUM = [
    { k: "konseptor", l: "Konseptor", kode: "5839" },
    { k: "mediator", l: "Mediator", kode: "5836", butuh: "mediasi" },
    { k: "hasilmed", l: "Hasil mediasi", kode: "5837", butuh: "mediasi" },
    { k: "tglpbt", l: "Tanggal pemberitahuan putusan (PBT)", kode: "5840", tanggal: true },
  ];

  // ---------------------------------------------------------------------------
  // Keadaan layar
  // ---------------------------------------------------------------------------
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  let H = null; // host (kemampuan dari blangko-derry-isian.js)
  let W = null; // wadah
  let ST = null;
  let jamSimpan = null;
  let jamPratinjau = null;

  function barukan(tab) {
    return {
      tab,
      perkaraId: "",
      nomor: "",
      kertas: "a4",
      memuat: true,
      galat: "",
      fakta: null,
      bawaan: {},
      bentuk: "awal", // "awal" = sampul cetak awal (bawaan); "lengkap" = sampul lengkap
      tangan: {}, // ciri: kunci -> true/false (dipaksa tangan); ciri susulan memakai awalan "s_"
      isian: {}, // isian tangan
      edit: {}, // daftar isi: kunci -> {tampil, halamanTeks, judulManual, tanggalManual, tambahan}
      urut: { A: [], B: [] }, // urutan akhir (kunci)
      bundelB: "1",
      kertasTersimpan: false,
      simpan: "", // "", "menyimpan", "tersimpan", "gagal"
      prat: { memuat: false, html: "", galat: "", kunci: "", terbuka: true },
      sibuk: false,
      log: [],
      ringkasHitung: "",
    };
  }

  function bentukDari(berkas) {
    return /\(Lengkap\)/i.test(String(berkas || "")) ? "lengkap" : "awal";
  }
  function jenisLayar(berkas) {
    const n = String(berkas || "").trim();
    if (/^Sampul Berkas Perkara( \(Lengkap\))?\.rtf$/i.test(n)) return "sampul";
    if (/^Daftar Isi Berkas\.rtf$/i.test(n)) return "daftar-isi";
    return "";
  }

  const jenisKhas = () => JENIS[(ST.fakta && ST.fakta.perkara && ST.fakta.perkara.jenis) || "lain"] || JENIS.lain;

  function ciriOtomatis() {
    const o = {};
    const f = (ST.fakta && ST.fakta.ciri) || {};
    for (const c of CIRI) o[c.k] = Boolean(f[c.k] && f[c.k].nyala);
    return o;
  }
  function ciriEfektif() {
    const oto = ciriOtomatis();
    const hasil = {};
    for (const c of CIRI) hasil[c.k] = Object.prototype.hasOwnProperty.call(ST.tangan, c.k) ? Boolean(ST.tangan[c.k]) : Boolean(oto[c.k]);
    return hasil;
  }
  const lawanPerkara = () => Boolean(ST.fakta && ST.fakta.perkara && ST.fakta.perkara.berlawanan);
  const jumlahPihak = () => (ST.fakta && ST.fakta.jumlahPihak) || { p1: 0, p2: 0, p3: 0, p4: 0 };
  function susulanDaftar() {
    return daftarSusulan(ST.fakta && ST.fakta.perkara ? ST.fakta.perkara.jenis : "lain", lawanPerkara());
  }
  function susulanOto() {
    const o = {};
    const f = (ST.fakta && ST.fakta.susulan && ST.fakta.susulan.oto) || {};
    for (const k of KUNCI_SUSULAN) o[k] = Object.prototype.hasOwnProperty.call(f, k);
    return o;
  }
  /** Butir alasan yang berlaku: terdeteksi otomatis (kecuali dimatikan tangan) atau dicentang tangan (kunci "a_<butir>" di ST.tangan). */
  function alasanEfektif() {
    const d = definisiAlasan(ST.fakta && ST.fakta.perkara ? ST.fakta.perkara.jenis : "");
    if (!d) return null;
    const oto = (ST.fakta && ST.fakta.alasan && ST.fakta.alasan.oto) || {};
    const hasil = d.butir.map((b) => {
      const kunci = `a_${b.kunci}`;
      const ada = Object.prototype.hasOwnProperty.call(oto, b.kunci);
      const tangan = Object.prototype.hasOwnProperty.call(ST.tangan, kunci);
      const nyala = tangan ? Boolean(ST.tangan[kunci]) : ada;
      return { kunci: b.kunci, nama: b.nama, nyala, oto: ada, tangan, sumber: ada ? oto[b.kunci].sumber || "" : "" };
    });
    return { definisi: d, butir: hasil };
  }
  function susulanEfektif() {
    const oto = susulanOto();
    const h = {};
    for (const d of susulanDaftar()) h[d.kunci] = Object.prototype.hasOwnProperty.call(ST.tangan, `s_${d.kunci}`) ? Boolean(ST.tangan[`s_${d.kunci}`]) : Boolean(oto[d.kunci]);
    return h;
  }
  function sisiDariFakta() {
    const f = (ST.fakta && ST.fakta.ciri) || {};
    const h = {};
    for (const c of CIRI) if (f[c.k] && f[c.k].sisi) h[c.k] = f[c.k].sisi;
    return h;
  }

  // ---------------------------------------------------------------------------
  // Isian
  // ---------------------------------------------------------------------------
  function nilaiAutoIsian(k) {
    const i = (ST.fakta && ST.fakta.isian) || {};
    if (k === "tglpbt") return tanggalIndonesia(i.tglpbt);
    return String(i[k] == null ? "" : i[k]);
  }
  const nilaiIsian = (k) => (Object.prototype.hasOwnProperty.call(ST.isian, k) ? ST.isian[k] : nilaiAutoIsian(k));

  function daftarIsian() {
    const j = jenisKhas();
    const efektif = ciriEfektif();
    if (ST.bentuk === "awal") {
      // sampul cetak awal: konseptor putusan (nama), mediator (hanya perkara berlawanan), lalu isian khas jenis perkara
      const awal = [{ k: "konseptor", l: "Konseptor putusan (nama)", grup: "umum" }];
      if (lawanPerkara()) awal.push({ k: "mediator", l: "Mediator (nama)", grup: "umum" });
      if (j.fokus) awal.push({ k: "fokus", l: j.fokus, grup: "khas" });
      for (const [k, l] of j.blok || []) awal.push({ k, l, grup: "khas" });
      return awal;
    }
    const hasil = ISIAN_UMUM.filter((f) => !f.butuh || efektif[f.butuh]).map((f) => ({ k: f.k, l: f.l, grup: "umum" }));
    if (j.fokus) hasil.push({ k: "fokus", l: j.fokus, grup: "khas" });
    for (const [k, l] of j.blok || []) hasil.push({ k, l, grup: "khas" });
    return hasil;
  }

  /** Nilai timpa ABT untuk sampul: ciri selalu; isian hanya yang diubah tangan (selebihnya dibiarkan dihitung ABT). */
  function nilaiTimpaSampul() {
    if (ST.bentuk === "awal") return nilaiTimpaAwal();
    const n = {};
    n["5801"] = rangkaiCiri(ciriEfektif(), sisiDariFakta());
    for (const f of ISIAN_UMUM) if (Object.prototype.hasOwnProperty.call(ST.isian, f.k)) n[f.kode] = f.tanggal && /^\d{4}-/.test(ST.isian[f.k]) ? tanggalIndonesia(ST.isian[f.k]) : ST.isian[f.k];
    if (Object.prototype.hasOwnProperty.call(ST.isian, "fokus")) n["5842"] = ST.isian.fokus;
    const j = jenisKhas();
    if ((j.blok || []).some(([k]) => Object.prototype.hasOwnProperty.call(ST.isian, k))) {
      const garis = (j.blok || []).map(([k, l]) => (nilaiIsian(k) ? `${l}: ${nilaiIsian(k)}` : "")).filter(Boolean);
      n["5843"] = garis.join("\n");
    }
    return n;
  }

  /** Sampul cetak awal: ciri (5861, bingkai ganda 5807 ghaib dan 5808 mafqud), ciri susulan (5862), kumulasi, dan isian yang diubah tangan. */
  function nilaiTimpaAwal() {
    const n = ciriSampulAwal(ciriEfektif(), sisiDariFakta());
    n["5862"] = rangkaiSusulan(susulanDaftar(), susulanEfektif(), susulanOto());
    const kum = ST.fakta && ST.fakta.ciri && ST.fakta.ciri.kumulasi;
    const jenisNama = ST.fakta && ST.fakta.perkara ? ST.fakta.perkara.jenisNama : "";
    if (jenisNama && Object.prototype.hasOwnProperty.call(ciriEfektif(), "kumulasi")) {
      const ada = ciriEfektif().kumulasi && kum && Array.isArray(kum.nama) && kum.nama.length;
      if (ada) {
        n["5867"] = `${jenisNama} Kumulasi`;
        n["5868"] = `Kumulasi: ${kum.nama.join(" dan ")}`;
      } else if (!ciriEfektif().kumulasi) {
        n["5867"] = jenisNama;
        n["5868"] = "";
      }
    }
    if (Object.prototype.hasOwnProperty.call(ST.isian, "konseptor")) n["5865"] = ST.isian.konseptor;
    if (lawanPerkara() && Object.prototype.hasOwnProperty.call(ST.isian, "mediator")) n["5836"] = ST.isian.mediator;
    if (Object.prototype.hasOwnProperty.call(ST.isian, "fokus")) n["5842"] = ST.isian.fokus;
    const j = jenisKhas();
    if ((j.blok || []).some(([k]) => Object.prototype.hasOwnProperty.call(ST.isian, k))) {
      n["5843"] = (j.blok || []).map(([k, l]) => (nilaiIsian(k) ? `${l}: ${nilaiIsian(k)}` : "")).filter(Boolean).join("\n");
    }
    return n;
  }

  // ---------------------------------------------------------------------------
  // Daftar isi
  // ---------------------------------------------------------------------------
  function barisDasarDariFakta() {
    return ((ST.fakta && ST.fakta.dokumen) || []).map((d) => {
      const bawaanJenis = d.jenisBawaan || "lain";
      const halaman = d.halaman ? Number(d.halaman) : halamanBawaan(bawaanJenis);
      return {
        bundel: d.bundel === "B" ? "B" : "A",
        grup: String(d.grup || ""),
        kunci: String(d.kunci),
        nama: String(d.nama || ""),
        ket: String(d.ket || ""),
        tanggal: String(d.tanggal || ""),
        halaman,
        sumber: d.halaman && d.sumber === "pasti" ? "pasti" : "perkiraan",
        dasar: String(d.dasar || ""),
      };
    });
  }
  function halamanBawaan(jenis) {
    const t = ST && ST.bawaan;
    const n = t && Number.isFinite(t[jenis]) ? Number(t[jenis]) : BAWAAN_HALAMAN[jenis];
    return Number.isFinite(n) && n >= 1 ? Math.round(n) : 1;
  }

  function semuaBaris() {
    const dasar = barisDasarDariFakta();
    const tambahan = Object.keys(ST.edit)
      .filter((k) => ST.edit[k].tambahan)
      .map((k) => ({ bundel: ST.edit[k].bundel === "B" ? "B" : "A", grup: ST.edit[k].grup || (k.startsWith("khas_") ? `I-B. DOKUMEN KHAS ${jenisKhas().nama.toUpperCase()}` : "TAMBAHAN PETUGAS"), kunci: k, nama: ST.edit[k].judulManual || "Dokumen tambahan", ket: "", tanggal: ST.edit[k].tanggalManual || "", halaman: 1, sumber: "perkiraan", dasar: "ditambahkan petugas" }));
    return dasar.concat(tambahan);
  }

  function selaraskanUrutan() {
    const semua = semuaBaris();
    for (const b of ["A", "B"]) {
      const dasar = semua.filter((r) => r.bundel === b && !ST.edit[r.kunci]?.tambahan).map((r) => r.kunci);
      const tambah = semua.filter((r) => r.bundel === b && ST.edit[r.kunci]?.tambahan).map((r) => r.kunci);
      const tersimpan = {};
      (ST.urut[b] || []).forEach((k, i) => {
        tersimpan[k] = i + 1;
      });
      ST.urut[b] = susunUrutan(dasar, tersimpan, tambah);
    }
  }

  function barisUrut() {
    const semua = semuaBaris();
    const peta = new Map(semua.map((r) => [r.kunci, r]));
    const hasil = [];
    for (const b of ["A", "B"]) for (const k of ST.urut[b]) if (peta.has(k)) hasil.push(peta.get(k));
    return hasil;
  }
  function suntingUntukHitung() {
    const s = {};
    for (const [k, e] of Object.entries(ST.edit)) s[k] = { tampil: e.tampil !== false, halamanTeks: e.halamanTeks || "", judulManual: e.judulManual || "", tanggalManual: e.tanggalManual || "", tambahan: Boolean(e.tambahan) };
    return s;
  }
  const hitung = () => hitungDaftarIsi(barisUrut(), suntingUntukHitung(), { bundelB: ST.bundelB });

  // ---------------------------------------------------------------------------
  // Muat dan simpan
  // ---------------------------------------------------------------------------
  async function bacaKertas() {
    try {
      const s = await H.bacaPenyimpanan(K_KERTAS);
      const k = s && s[K_KERTAS];
      if (k === "f4" || k === "legal" || k === "a4") return k;
    } catch {
      /* diabaikan */
    }
    return "a4";
  }

  function terapkanSunting(sunting) {
    ST.tangan = {};
    for (const [k, v] of Object.entries((sunting && sunting.tag) || {})) ST.tangan[k] = Boolean(v);
    ST.isian = {};
    for (const [k, v] of Object.entries((sunting && sunting.isian) || {})) {
      if (k === "bundelB") ST.bundelB = v === "lanjut" ? "lanjut" : "1";
      else ST.isian[k] = String(v);
    }
    ST.edit = {};
    const urutanSimpan = { A: {}, B: {} };
    for (const r of Object.values((sunting && sunting.susunan) || {})) {
      ST.edit[r.kunci] = { bundel: r.bundel, tampil: r.tampil !== false, halamanTeks: r.halamanTeks || "", judulManual: r.judulManual || "", tanggalManual: r.tanggalManual || "", tambahan: Boolean(r.tambahan) };
      if (r.urutan > 0) urutanSimpan[r.bundel][r.kunci] = r.urutan;
    }
    for (const b of ["A", "B"]) ST.urut[b] = Object.keys(urutanSimpan[b]).sort((x, y) => urutanSimpan[b][x] - urutanSimpan[b][y]);
  }

  async function muat(ulang) {
    ST.memuat = true;
    ST.galat = "";
    gambar();
    try {
      const d = await H.ambilPortal(`${API}?perkaraId=${encodeURIComponent(ST.perkaraId)}`, { method: "GET", batasMs: 90000 }, "Membaca bahan sampul dan daftar isi");
      ST.fakta = d.fakta;
      ST.bawaan = d.bawaan || {};
      if (!ulang) terapkanSunting(d.sunting);
      selaraskanUrutan();
    } catch (e) {
      ST.galat = String((e && e.message) || e);
    }
    ST.memuat = false;
    gambar();
    if (!ST.galat) jadwalPratinjau(200);
  }

  async function simpanSekarang(st) {
    st = st || ST;
    if (!st || st.memuat || st.galat) return;
    clearTimeout(jamSimpan);
    st.menunggu = false;
    st.simpan = "menyimpan";
    tandaSimpan();
    try {
      const isian = Object.assign({}, st.isian, { bundelB: st.bundelB });
      const susunan = [];
      for (const b of ["A", "B"]) {
        st.urut[b].forEach((k, i) => {
          const e = st.edit[k] || {};
          susunan.push({ bundel: b, kunci: k, tampil: e.tampil !== false, urutan: i + 1, halamanTeks: e.halamanTeks || "", judulManual: e.judulManual || "", tanggalManual: e.tanggalManual || "", tambahan: Boolean(e.tambahan) });
        });
      }
      const d = await H.ambilPortal(
        API,
        { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ perkaraId: st.perkaraId, nomor: st.nomor, susunan, tag: st.tangan, isian }) },
        "Menyimpan sunting"
      );
      st.simpan = d && Array.isArray(d.ditolak) && d.ditolak.length ? "tersimpan sebagian" : "tersimpan";
      if (d && Array.isArray(d.ditolak) && d.ditolak.length) H.toast(`Sebagian tidak disimpan: ${d.ditolak.slice(0, 2).join("; ")}`);
    } catch (e) {
      st.simpan = "gagal";
      H.toast(`Sunting belum tersimpan: ${String((e && e.message) || e)}`);
    }
    tandaSimpan();
  }
  function jadwalSimpan() {
    clearTimeout(jamSimpan);
    ST.simpan = "";
    ST.menunggu = true;
    tandaSimpan();
    jamSimpan = setTimeout(() => void simpanSekarang(), 1400);
  }
  function tandaSimpan() {
    const e = W && W.querySelector("[data-bk-simpan]");
    if (e && ST) e.textContent = ST.simpan ? `(${ST.simpan})` : "";
  }

  // ---------------------------------------------------------------------------
  // Naskah (RTF dari portal) dan pratinjau
  // ---------------------------------------------------------------------------
  function badanNaskah(tab) {
    const dasar = { perkaraId: ST.perkaraId, jenis: tab, kertas: ST.kertas };
    const peran = H.sebagaiPeran ? H.sebagaiPeran() : "";
    if (peran) dasar.sebagaiPeran = peran;
    if (tab === "sampul") {
      const j = jumlahPihak();
      const badan = Object.assign(dasar, { nilai: nilaiTimpaSampul(), bentuk: ST.bentuk, lawan: lawanPerkara() });
      if (ST.bentuk === "awal") {
        // Lampiran hanya bila perlu (versi 7): pihak banyak, objek sengketa > 2, anak > 3, riwayat sidang melebihi baris sampul. Portal memutuskan dan
        // menyusunnya dari data ini (SIPP, baca saja); jawabannya memuat daftar lampiran yang ikut tercetak.
        const f = ST.fakta || {};
        const jk = jenisKhas();
        const barisPokok = (jk.blok || []).filter(([k]) => nilaiIsian(k)).length;
        Object.assign(badan, {
          nomor: ST.nomor,
          sebutanP: (f.perkara || {}).sebutanP,
          sebutanT: (f.perkara || {}).sebutanT,
          pihak: f.pihakSemua || [],
          anak: f.anak || [],
          objek: f.objek || [],
          riwayat: f.riwayatSemua || [],
          infoKhasBaris: (nilaiIsian("fokus") ? 1 : 0) + barisPokok,
          jenisPerkara: (f.perkara || {}).jenis || "",
          alasan: { oto: (f.alasan && f.alasan.oto) || {}, tangan: alasanTangan() },
          keterangan: keteranganOto(),
        });
        if (pihakBanyak(j)) badan.banyak = true;
      }
      return badan;
    }
    const baris = barisUrut().map((r) => ({ bundel: r.bundel, grup: r.grup, kunci: r.kunci, nama: r.nama, ket: r.ket, tanggal: r.tanggal, halaman: r.halaman, sumber: r.sumber, dasar: r.dasar }));
    return Object.assign(dasar, { baris, sunting: suntingUntukHitung(), bundelB: ST.bundelB });
  }
  async function ambilNaskah(tab) {
    const d = await H.ambilPortal(API_NASKAH, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(badanNaskah(tab)), batasMs: 120000 }, "Menyusun naskah");
    const rtf = atob(String((d && d.rtfBase64) || ""));
    if (rtf.length < 6 || rtf.slice(0, 5) !== "{\\rtf") throw new Error("Naskah yang diterima bukan RTF.");
    return { rtf, kosong: d.kosong || [], galatMesin: d.mesinGalat || "", lampiran: Array.isArray(d.lampiran) ? d.lampiran : [], muatPihak: d.muatPihak || 0 };
  }

  function jadwalPratinjau(tunggu) {
    clearTimeout(jamPratinjau);
    jamPratinjau = setTimeout(() => void muatPratinjau(), tunggu == null ? 1000 : tunggu);
  }
  async function muatPratinjau() {
    if (!ST || ST.memuat || ST.galat || !ST.prat.terbuka) return;
    const kunci = JSON.stringify(badanNaskah(ST.tab));
    if (kunci === ST.prat.kunci && ST.prat.html) return;
    ST.prat.memuat = true;
    ST.prat.galat = "";
    isiPratinjau();
    try {
      const n = await ambilNaskah(ST.tab);
      ST.prat.html = H.rtfKeHtml(n.rtf);
      ST.prat.kunci = kunci;
      ST.prat.kosong = n.kosong;
      ST.lampiran = n.lampiran;
      ST.muatPihak = n.muatPihak;
    } catch (e) {
      ST.prat.galat = String((e && e.message) || e);
    }
    ST.prat.memuat = false;
    isiPratinjau();
  }
  /** Keterangan lampiran sesuai keputusan portal pada pratinjau terakhir (hanya sampul cetak awal). */
  function htmlLampiran() {
    if (!ST || ST.tab !== "sampul" || ST.bentuk !== "awal") return "";
    if (!Array.isArray(ST.lampiran)) return `<p class="bk-catat">Lampiran ditentukan saat pratinjau dimuat.</p>`;
    if (!ST.lampiran.length) return `<p class="bk-catat">Sampul memuat semuanya dalam satu lembar: tanpa lampiran.</p>`;
    return `<p class="bk-catat bk-pihak"><b>${ST.lampiran.length} lampiran ikut tercetak</b> (halaman ${ST.lampiran.map((d) => d.nomor + 1).join(", ")}): ${ST.lampiran.map((d) => `${d.nomor}. ${esc(d.judul)} <small>(${esc(d.alasan)})</small>`).join("; ")}</p>`;
  }

  function isiPratinjau() {
    const k = W && W.querySelector("[data-bk-prat]");
    if (!k || !ST) return;
    const p = ST.prat;
    const lamp = W.querySelector("[data-bk-lamp]");
    if (lamp) lamp.innerHTML = htmlLampiran();
    k.innerHTML =
      (p.memuat ? `<p class="bk-catat" role="status">Menyusun pratinjau dari data perkara…</p>` : "") +
      (p.galat ? `<p class="bk-galat" role="alert">${esc(p.galat)} <button type="button" class="bd-btn kecil" data-bk="prat-ulang">Coba lagi</button></p>` : "") +
      (p.html ? `<div class="bd-kertas bk-kertas">${p.html}</div>` : "");
  }

  // ---------------------------------------------------------------------------
  // Cetak
  // ---------------------------------------------------------------------------
  async function cetak(fmt) {
    if (ST.sibuk) return;
    ST.sibuk = true;
    gambarCetak();
    try {
      await simpanSekarang();
      const n = await ambilNaskah(ST.tab);
      const dasarNama = ST.tab === "sampul" ? "Sampul Berkas Perkara.rtf" : "Daftar Isi Berkas.rtf";
      const hasil = [];
      if (fmt.rtf) {
        const u = await H.unduh(new Blob([Uint8Array.from(n.rtf, (c) => c.charCodeAt(0))], { type: "application/rtf" }), H.namaUnduhan(ST.nomor, dasarNama, "rtf"));
        hasil.push(u.ok ? "RTF diunduh" : `RTF gagal: ${u.pesan}`);
      }
      if (fmt.pdf) {
        try {
          const { blob } = await H.pdfDari(n.rtf, false);
          const u = await H.unduh(blob, H.namaUnduhan(ST.nomor, dasarNama, "pdf"));
          hasil.push(u.ok ? "PDF diunduh" : `PDF gagal: ${u.pesan}`);
        } catch (e) {
          hasil.push(`PDF gagal: ${String((e && e.message) || e)}`);
        }
      }
      ST.log = hasil;
      H.toast(hasil.join(" · ") || "Tidak ada hasil cetak yang dipilih.");
    } catch (e) {
      ST.log = [`gagal: ${String((e && e.message) || e)}`];
      H.toast(`Cetak gagal: ${String((e && e.message) || e)}`);
    }
    ST.sibuk = false;
    gambarCetak();
  }
  function gambarCetak() {
    const k = W && W.querySelector("[data-bk-cetak]");
    if (!k || !ST) return;
    k.innerHTML =
      `<label class="bk-pil"><input type="checkbox" data-bk-fmt="rtf" checked> RTF</label>` +
      `<label class="bk-pil"><input type="checkbox" data-bk-fmt="pdf" checked> PDF</label>` +
      `<button type="button" class="bd-btn utama" data-bk="cetak" ${ST.sibuk ? "disabled" : ""}>${ST.sibuk ? "Sedang mencetak…" : ST.tab === "sampul" ? "Cetak sampul" : "Cetak daftar isi"}</button>` +
      (ST.log.length ? `<ul class="bk-log">${ST.log.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "");
  }

  // ---------------------------------------------------------------------------
  // Gambar
  // ---------------------------------------------------------------------------
  function gambar() {
    if (!W || !ST) return;
    if (ST.memuat) {
      W.innerHTML = `<p class="bk-catat" role="status">Membaca dokumen dan halaman berkas perkara ${esc(ST.nomor)}… (bisa sampai satu menit bila berkasnya banyak)</p>`;
      return;
    }
    if (ST.galat) {
      W.innerHTML = `<p class="bk-galat" role="alert">${esc(ST.galat)} <button type="button" class="bd-btn kecil" data-bk="muat-ulang-semua">Coba lagi</button></p>`;
      return;
    }
    const f = ST.fakta;
    W.innerHTML =
      `<div class="bk">` +
      `<div class="bk-kepala"><div class="bk-tab" role="tablist" aria-label="Sampul atau daftar isi">` +
      `<button type="button" role="tab" aria-selected="${ST.tab === "sampul"}" data-bk="tab" data-bkv="sampul">Sampul</button>` +
      `<button type="button" role="tab" aria-selected="${ST.tab === "daftar-isi"}" data-bk="tab" data-bkv="daftar-isi">Daftar isi</button></div>` +
      `<label class="bk-kertasp">Kertas <select data-bk-kertas>${[["a4", "A4 (210 x 297 mm)"], ["f4", "F4 (215 x 330 mm)"], ["legal", "Legal (216 x 356 mm)"]].map(([k, n]) => `<option value="${k}" ${ST.kertas === k ? "selected" : ""}>${n}</option>`).join("")}</select></label>` +
      `<span class="bk-info">${esc(f.perkara.jenisNama || "")} · ${esc(ST.nomor)}</span><span class="bk-simpan" data-bk-simpan aria-live="polite"></span></div>` +
      (ST.tab === "sampul" ? htmlSampul() : htmlDaftarIsi()) +
      `<div class="bk-cetak bd-baris" data-bk-cetak></div>` +
      `<details class="bk-prat" ${ST.prat.terbuka ? "open" : ""}><summary data-bk="prat-toggle">Pratinjau naskah (susunan yang sama dengan yang dicetak)</summary><div data-bk-prat></div></details>` +
      `</div>`;
    gambarCetak();
    isiPratinjau();
    if (ST.tab === "daftar-isi") isiTabel();
  }

  function htmlBentuk() {
    const tombol = (v, teks) => `<button type="button" class="bk-bentukt" data-bk="bentuk" data-bkv="${v}" aria-pressed="${ST.bentuk === v}">${teks}</button>`;
    return `<div class="bk-bentuk" role="group" aria-label="Bentuk sampul"><span>Bentuk sampul</span>${tombol("awal", "Cetak awal (bawaan)")}${tombol("lengkap", "Lengkap")}</div>`;
  }

  function htmlKolomIsian(grup) {
    return daftarIsian()
      .filter((x) => x.grup === grup)
      .map((x) => {
        const tangan = Object.prototype.hasOwnProperty.call(ST.isian, x.k);
        const panjang = x.k === "b3" || (x.k === "b1" && jenisKhas() === JENIS.lain);
        return (
          `<div class="bk-f"><label for="bk-in-${x.k}">${esc(x.l)}</label>` +
          (panjang
            ? `<textarea id="bk-in-${x.k}" rows="2" data-bk-in="${x.k}">${esc(nilaiIsian(x.k))}</textarea>`
            : `<input id="bk-in-${x.k}" type="text" autocomplete="off" data-bk-in="${x.k}" value="${esc(nilaiIsian(x.k))}">`) +
          `<small>${tangan ? "diubah tangan" : nilaiAutoIsian(x.k) ? "dari data perkara" : "kosong: ditulis tangan di kertas"}${tangan ? ` <button type="button" class="bk-reset" data-bk="reset-isian" data-bkv="${x.k}">kembalikan</button>` : ""}</small></div>`
        );
      })
      .join("");
  }

  function alasanTangan() {
    const h = {};
    for (const [k, v] of Object.entries(ST.tangan)) if (/^a_[a-h1-4]$/.test(k)) h[k.slice(2)] = Boolean(v);
    return h;
  }
  /** KETERANGAN otomatis di CATATAN: hanya fakta yang pasti dari ciri perkara (ghaib, mafqud); selebihnya garis tulis tangan di blangko. */
  function keteranganOto() {
    const ef = ciriEfektif();
    const f = ST.fakta || {};
    const t = (f.perkara || {}).sebutanT || "Tergugat";
    const h = [];
    if (ef.ghaib) h.push(`${t} ghaib`);
    if (ef.mafqud) h.push("Mafqud (orang hilang)");
    return h;
  }

  /** Alasan / tuntutan pokok: tercentang otomatis dari posita/petitum (OTO); bila tidak ada yang berlaku, baris ALASAN dan lampirannya tidak dicetak. */
  function htmlKartuAlasan() {
    const a = alasanEfektif();
    if (!a) return "";
    const ada = a.butir.filter((b) => b.nyala).length;
    const gagal = ST.fakta && ST.fakta.alasan && ST.fakta.alasan.gagal;
    const tombol = a.butir
      .map((b) => {
        const kelas = b.nyala ? (b.tangan ? "tgn" : "oto") : b.tangan ? "mati-tgn" : "";
        const ket = b.tangan ? (b.nyala ? "dicentang tangan" : "dimatikan tangan") : b.nyala ? `OTO${b.sumber ? ` - ${b.sumber}` : ""}` : "";
        return `<button type="button" class="bk-ciri bk-alasan ${kelas}" data-bk="alasan" data-bkv="${esc(b.kunci)}" aria-pressed="${b.nyala}" title="${esc(ket || "klik untuk mencentang")}"><span class="g">${b.nyala ? "\u2611" : "\u2610"}</span> <b>${esc(b.kunci)}.</b> ${esc(b.nama.length > 64 ? `${b.nama.slice(0, 62)}...` : b.nama)}${b.nyala && !b.tangan ? " <small>OTO</small>" : ""}</button>`;
      })
      .join("");
    return (
      `<section class="bk-kartu" aria-label="${esc(a.definisi.judul)}"><h3>${esc(a.definisi.judul)} <small>${esc(a.definisi.dasar)}</small></h3><div class="bk-kel">${tombol}</div>` +
      `<p class="bk-catat">${ada ? `${ada} butir berlaku: baris ALASAN di CATATAN sampul dan LAMPIRAN ${esc(a.definisi.judul)} akan dicetak (daftar lengkap dengan kutipan sumber).` : "Belum ada yang terdeteksi atau dicentang: baris ALASAN dan lampirannya tidak dicetak."}${gagal ? " Deteksi alasan tidak terbaca; tidak ada yang dicentang otomatis." : ""}</p></section>`
    );
  }

  /** Sampul cetak awal: ciri berikon (hanya yang berlaku), ciri susulan (kotak centang otomatis/tangan), isian, keterangan pihak banyak. */
  function htmlSampulAwal() {
    const oto = ciriOtomatis();
    const efektif = ciriEfektif();
    const sisi = sisiDariFakta();
    const kel = { a: [], b: [], c: [] };
    for (const c of CIRI) {
      if (CIRI_BUKAN_LENCANA_AWAL.includes(c.k)) continue;
      const nyala = efektif[c.k];
      const tangan = Object.prototype.hasOwnProperty.call(ST.tangan, c.k);
      const kelas = nyala ? (tangan ? "tgn" : "oto") : tangan ? "mati-tgn" : "";
      const ket = tangan ? (nyala ? "dinyalakan tangan" : "dimatikan tangan") : oto[c.k] ? "otomatis" : "";
      const ganda = CIRI_BINGKAI_GANDA_AWAL.includes(c.k) ? " ganda" : "";
      kel[c.g].push(
        `<button type="button" class="bk-ciri ${kelas}${ganda}" data-bk="ciri" data-bkv="${c.k}" aria-pressed="${nyala}" title="${esc(c.t)}${ket ? ` · ${ket}` : ""}"><span class="g">${LAMBANG[c.g]}</span> ${esc(c.n)}${sisi[c.k] || c.s ? ` ${esc(sisi[c.k] || c.s)}` : ""}${ket ? `<small>${ket}</small>` : ""}</button>`
      );
    }
    const eSus = susulanEfektif();
    const oSus = susulanOto();
    const gagal = (ST.fakta && ST.fakta.susulan && ST.fakta.susulan.gagal) || [];
    const susulan = susulanDaftar()
      .map((d) => {
        const on = eSus[d.kunci];
        const tangan = Object.prototype.hasOwnProperty.call(ST.tangan, `s_${d.kunci}`);
        const kelas = on ? (tangan ? "tgn" : "oto") : tangan ? "mati-tgn" : "";
        const sumber = ST.fakta && ST.fakta.susulan && ST.fakta.susulan.oto ? ST.fakta.susulan.oto[d.kunci] : "";
        const ket = tangan ? (on ? "dicentang tangan" : "dimatikan tangan") : on ? `OTO${sumber ? ` · ${sumber}` : ""}` : "";
        return `<button type="button" class="bk-ciri ${kelas}" data-bk="susulan" data-bkv="${d.kunci}" aria-pressed="${on}" title="${esc(ket || "dicentang tangan di kertas")}"><span class="g">${on ? "\u2612" : "\u2610"}</span> ${esc(d.nama)}${on && oSus[d.kunci] && !tangan ? " <small>OTO</small>" : ket ? `<small>${esc(ket.split(" ")[0] === "OTO" ? "OTO" : ket)}</small>` : ""}</button>`;
      })
      .join("");
    const j = jumlahPihak();
    const total = j.p1 + j.p2 + j.p3 + j.p4;
    const f = ST.fakta || {};
    const infoPihak = pihakBanyak(j)
      ? `<p class="bk-catat bk-pihak">Pihak banyak: ${j.p1} pihak I${j.p2 ? `, ${j.p2} pihak II` : ""}${j.p3 ? `, ${j.p3} intervensi` : ""}${j.p4 ? `, ${j.p4} turut tergugat` : ""} (${total} nama): nama bernomor romawi dua kolom di sampul.</p>`
      : "";
    const infoAnakObjek =
      ((f.anak || []).length ? `<p class="bk-catat">Anak (tab Anak SIPP): ${(f.anak || []).length}${(f.anak || []).length > 3 ? " - lebih dari 3, rincian di lampiran" : " - sebaris di sampul"}.</p>` : "") +
      ((f.objek || []).length ? `<p class="bk-catat">Objek sengketa (SIPP): ${(f.objek || []).length}${(f.objek || []).length > 2 ? " - lebih dari 2, rincian di lampiran" : " - sebaris di sampul"}.</p>` : "");
    const banyakTangan = Object.keys(ST.tangan).length + Object.keys(ST.isian).length;
    return (
      `<div class="bk-dua"><section class="bk-kartu" aria-label="Ciri perkara"><h3>Ciri perkara <small>hanya yang berlaku dicetak · klik untuk menyalakan atau mematikan</small></h3>` +
      `<div class="bk-ciriwadah"><div class="bk-kel">${kel.a.join("")}</div><div class="bk-kel">${kel.b.join("")}</div><div class="bk-kel">${kel.c.join("")}</div></div>` +
      `<p class="bk-catat">${LAMBANG.a} pendaftaran · ${LAMBANG.b} pihak · ${LAMBANG.c} proses. Bingkai ganda = mengubah cara pemeriksaan (ghaib, mafqud). Verstek, mediasi, rekonvensi, dan sita ada di bagian lain sampul.${banyakTangan ? ` <button type="button" class="bd-btn kecil" data-bk="semua-oto">Kembalikan semua ke otomatis</button>` : ""}</p></section>` +
      `<section class="bk-kartu" aria-label="Ciri susulan"><h3>Ciri susulan <small>kotak tercentang otomatis bila datanya ada (OTO); sisanya dicentang tangan</small></h3><div class="bk-kel">${susulan}</div>` +
      (gagal.length ? `<p class="bk-catat">Sebagian data tidak terbaca (${esc(gagal.join(", "))}); yang bergantung padanya tidak dicentang.</p>` : "") +
      `${infoPihak}${infoAnakObjek}<div data-bk-lamp>${htmlLampiran()}</div></section>` +
      htmlKartuAlasan() +
      `<section class="bk-kartu" aria-label="Isian sampul"><h3>Isian sampul</h3>${htmlKolomIsian("umum")}</section>` +
      (daftarIsian().some((x) => x.grup === "khas") ? `<section class="bk-kartu" aria-label="Isian khas ${esc(jenisKhas().nama)}"><h3>Isian khas ${esc(jenisKhas().nama)}</h3>${htmlKolomIsian("khas")}</section>` : "") +
      `</div>`
    );
  }

  function htmlSampul() {
    return htmlBentuk() + (ST.bentuk === "awal" ? htmlSampulAwal() : htmlSampulLengkap());
  }

  function htmlSampulLengkap() {
    const oto = ciriOtomatis();
    const efektif = ciriEfektif();
    const sisi = sisiDariFakta();
    const kel = { a: [], b: [], c: [] };
    for (const c of CIRI) {
      const nyala = efektif[c.k];
      const tangan = Object.prototype.hasOwnProperty.call(ST.tangan, c.k);
      const kelas = nyala ? (tangan ? "tgn" : "oto") : tangan ? "mati-tgn" : "";
      const ket = tangan ? (nyala ? "dinyalakan tangan" : "dimatikan tangan") : oto[c.k] ? "otomatis" : "";
      kel[c.g].push(
        `<button type="button" class="bk-ciri ${kelas}" data-bk="ciri" data-bkv="${c.k}" aria-pressed="${nyala}" title="${esc(c.t)}${ket ? ` · ${ket}` : ""}"><span class="g">${LAMBANG[c.g]}</span> ${esc(c.n)}${sisi[c.k] || c.s ? ` ${esc(sisi[c.k] || c.s)}` : ""}${ket ? `<small>${ket}</small>` : ""}</button>`
      );
    }
    const isian = daftarIsian();
    const kolom = (grup) =>
      isian
        .filter((x) => x.grup === grup)
        .map((x) => {
          const tangan = Object.prototype.hasOwnProperty.call(ST.isian, x.k);
          const panjang = x.k === "b3" || (x.k === "b1" && jenisKhas() === JENIS.lain);
          return `<div class="bk-f"><label for="bk-in-${x.k}">${esc(x.l)}</label>` +
            (panjang ? `<textarea id="bk-in-${x.k}" rows="2" data-bk-in="${x.k}">${esc(nilaiIsian(x.k))}</textarea>` : `<input id="bk-in-${x.k}" type="text" autocomplete="off" data-bk-in="${x.k}" value="${esc(nilaiIsian(x.k))}">`) +
            `<small>${tangan ? "diubah tangan" : nilaiAutoIsian(x.k) ? "dari data perkara" : "kosong: isi bila perlu"}${tangan ? ` <button type="button" class="bk-reset" data-bk="reset-isian" data-bkv="${x.k}">kembalikan</button>` : ""}</small></div>`;
        })
        .join("");
    const banyakTangan = Object.keys(ST.tangan).length + Object.keys(ST.isian).length;
    return (
      `<div class="bk-dua"><section class="bk-kartu" aria-label="Ciri perkara"><h3>Ciri perkara <small>${Object.values(efektif).filter(Boolean).length} berlaku · klik untuk menyalakan atau mematikan</small></h3>` +
      `<div class="bk-ciriwadah"><div class="bk-kel">${kel.a.join("")}</div><div class="bk-kel">${kel.b.join("")}</div><div class="bk-kel">${kel.c.join("")}</div></div>` +
      `<p class="bk-catat">Bentuk ■ ciri biasa · ● pihak · ▲ proses. Hijau = dari data perkara; emas = diubah tangan.${banyakTangan ? ` <button type="button" class="bd-btn kecil" data-bk="semua-oto">Kembalikan semua ke otomatis</button>` : ""}</p></section>` +
      `<section class="bk-kartu" aria-label="Isian sampul"><h3>Isian sampul</h3>${kolom("umum")}</section>` +
      (isian.some((x) => x.grup === "khas") ? `<section class="bk-kartu" aria-label="Isian khas ${esc(jenisKhas().nama)}"><h3>Isian khas ${esc(jenisKhas().nama)}</h3>${kolom("khas")}</section>` : "") +
      `</div>`
    );
  }

  function htmlDaftarIsi() {
    const j = jenisKhas();
    const tambahKhas = (j.khas || []).filter(([k]) => !ST.edit[`khas_${k}`]);
    return (
      `<section class="bk-kartu" aria-label="Daftar isi berkas"><div class="bk-bar bd-baris">` +
      `<label>Halaman Bundel B <select data-bk-bundelb><option value="1" ${ST.bundelB === "1" ? "selected" : ""}>mulai dari 1</option><option value="lanjut" ${ST.bundelB === "lanjut" ? "selected" : ""}>melanjutkan Bundel A</option></select></label>` +
      `<button type="button" class="bd-btn kecil" data-bk="hitung-ulang">Hitung ulang dari arsip</button>` +
      `<button type="button" class="bd-btn kecil" data-bk="tambah" data-bkv="A">+ Baris Bundel A</button><button type="button" class="bd-btn kecil" data-bk="tambah" data-bkv="B">+ Baris Bundel B</button>` +
      (tambahKhas.length ? `<label>Dokumen khas ${esc(j.nama)} <select data-bk-khas><option value="">Tambah…</option>${tambahKhas.map(([k, n, h]) => `<option value="${k}">${esc(n)} (±${h} hlm)</option>`).join("")}</select></label>` : "") +
      `</div><div class="bk-ringkas" data-bk-ringkas></div>` +
      `<div class="bk-tabel-gulir"><table class="bk-tabel"><thead><tr><th class="geser" scope="col">Urut</th><th scope="col">Dokumen</th><th scope="col">Tanggal</th><th scope="col">Halaman</th><th scope="col">Aksi</th></tr></thead><tbody data-bk-isi></tbody></table></div>` +
      `<p class="bk-catat">Halaman: kosong = otomatis; ketik <b>3</b> untuk tiga halaman atau <b>5-9</b> bila mulai di halaman 5. ✓ pasti = dibaca dari berkas · ≈ perkiraan = nilai bawaan jenis dokumen · ✎ manual = ketikan Anda.</p></section>`
    );
  }

  function isiTabel() {
    const tb = W && W.querySelector("[data-bk-isi]");
    if (!tb) return;
    const h = hitung();
    const peta = new Map(h.baris.map((b) => [b.kunci, b]));
    let rows = "";
    for (const bundel of ["A", "B"]) {
      rows += `<tr class="bundel"><td colspan="5">BUNDEL ${bundel}</td></tr>`;
      let grupSebelum = null;
      const urut = ST.urut[bundel];
      urut.forEach((k, i) => {
        const b = peta.get(k);
        if (!b) return;
        if (b.grup !== grupSebelum) {
          grupSebelum = b.grup;
          rows += `<tr class="grup"><td colspan="5">${esc(b.grup)}</td></tr>`;
        }
        const e = ST.edit[k] || {};
        const tambahan = Boolean(e.tambahan);
        const nama = tambahan
          ? `<input type="text" class="bk-in" value="${esc(e.judulManual || "")}" aria-label="Jenis dokumen baris tambahan" data-bk-edit="judulManual" data-bkk="${esc(k)}">`
          : `${esc(b.nama)}${b.ket ? ` <small>${esc(b.ket)}</small>` : ""}`;
        const tgl = tambahan
          ? `<input type="text" class="bk-in" value="${esc(e.tanggalManual || "")}" placeholder="12 Maret 2026" aria-label="Tanggal baris tambahan" data-bk-edit="tanggalManual" data-bkk="${esc(k)}">`
          : esc(tanggalIndonesia(b.tanggal));
        const adaPdf = /putusan|penetapan/i.test(b.nama) && b.kunci === "putusan";
        rows +=
          `<tr class="${b.tersembunyi ? "tersembunyi" : ""}" data-key="${esc(k)}">` +
          `<td class="geser"><button type="button" class="ikon" data-bk="naik" data-bkb="${bundel}" data-bki="${i}" aria-label="Geser naik: ${esc(b.nama)}" ${i === 0 ? "disabled" : ""}>↑</button><button type="button" class="ikon" data-bk="turun" data-bkb="${bundel}" data-bki="${i}" aria-label="Geser turun: ${esc(b.nama)}" ${i === urut.length - 1 ? "disabled" : ""}>↓</button></td>` +
          `<td class="nm">${nama}</td><td class="tg">${tgl}</td>` +
          `<td class="hl"><div class="hlbox"><input type="text" inputmode="text" value="${esc(e.halamanTeks || "")}" placeholder="${b.halaman}" aria-label="Halaman: ${esc(b.nama)}" data-bk-edit="halamanTeks" data-bkk="${esc(k)}"><span class="rentang" data-rg="${esc(k)}"></span><span class="sbr" data-sb="${esc(k)}"></span></div><div class="peringatan" data-pr="${esc(k)}"></div>` +
          (adaPdf ? `<label class="bk-pdf">hitung dari PDF <input type="file" accept="application/pdf" data-bk-pdf="${esc(k)}"></label>` : "") + `</td>` +
          `<td class="aksi"><button type="button" class="ikon" data-bk="sembunyi" data-bkk="${esc(k)}" aria-pressed="${b.tersembunyi}" title="${b.tersembunyi ? "Tampilkan lagi" : "Sembunyikan dari daftar isi"}">${b.tersembunyi ? "◌" : "◉"}</button>` +
          (tambahan ? `<button type="button" class="ikon" data-bk="hapus" data-bkk="${esc(k)}" title="Hapus baris tambahan" aria-label="Hapus baris tambahan">✕</button>` : e.halamanTeks ? `<button type="button" class="ikon" data-bk="reset-hal" data-bkk="${esc(k)}" title="Kembali ke otomatis" aria-label="Kembalikan halaman ke otomatis">↺</button>` : "") +
          `</td></tr>`;
      });
    }
    tb.innerHTML = rows;
    segarAngka();
  }

  const SUMBER = { pasti: "✓ pasti", perkiraan: "≈ perkiraan", manual: "✎ manual" };
  function segarAngka() {
    if (!W || ST.tab !== "daftar-isi") return;
    const h = hitung();
    for (const b of h.baris) {
      const rg = W.querySelector(`[data-rg="${CSS.escape(b.kunci)}"]`);
      if (rg) rg.textContent = b.tersembunyi ? "—" : `hal. ${teksRentang(b).replace("-", "–")}`;
      const sb = W.querySelector(`[data-sb="${CSS.escape(b.kunci)}"]`);
      if (sb) {
        sb.className = `sbr ${b.sumberAkhir}`;
        sb.textContent = SUMBER[b.sumberAkhir] || "";
        sb.title = b.dasar || "";
      }
      const pr = W.querySelector(`[data-pr="${CSS.escape(b.kunci)}"]`);
      if (pr) pr.textContent = b.salah ? "Ketik 3 atau 5-9" : b.peringatan;
      const inp = W.querySelector(`[data-bk-edit="halamanTeks"][data-bkk="${CSS.escape(b.kunci)}"]`);
      if (inp) {
        if (b.salah) inp.setAttribute("aria-invalid", "true");
        else inp.removeAttribute("aria-invalid");
      }
    }
    const kotak = W.querySelector("[data-bk-ringkas]");
    if (kotak) {
      kotak.innerHTML = ["A", "B"]
        .map((b) => {
          const t = h.total[b];
          return `<div class="rk"><b>Bundel ${b}</b> ${t.halaman} halaman · ${t.dokumen} dokumen <small>(${t.pasti} pasti · ${t.perkiraan} perkiraan · ${t.manual} manual)</small></div>`;
        })
        .join("") + (ST.ringkasHitung ? `<div class="rk">${esc(ST.ringkasHitung)}</div>` : "");
    }
  }

  // ---------------------------------------------------------------------------
  // Peristiwa
  // ---------------------------------------------------------------------------
  function ubahEdit(k, medan, nilai) {
    ST.edit[k] = Object.assign({ bundel: (ST.edit[k] && ST.edit[k].bundel) || (barisDasarDariFakta().find((r) => r.kunci === k) || {}).bundel || "A" }, ST.edit[k] || {}, { [medan]: nilai });
    const e = ST.edit[k];
    if (!e.tambahan && e.tampil !== false && !e.halamanTeks && !e.judulManual && !e.tanggalManual) delete ST.edit[k];
  }

  function saatKlik(e) {
    const t = e.target.closest && e.target.closest("[data-bk]");
    if (!t || !ST) return;
    const aksi = t.getAttribute("data-bk");
    const v = t.getAttribute("data-bkv");
    const k = t.getAttribute("data-bkk");
    if (aksi === "tab") {
      ST.tab = v;
      ST.prat.html = "";
      ST.prat.kunci = "";
      ST.log = [];
      gambar();
      jadwalPratinjau(150);
    } else if (aksi === "ciri") {
      const oto = ciriOtomatis()[v];
      const baru = !ciriEfektif()[v];
      if (baru === oto) delete ST.tangan[v];
      else ST.tangan[v] = baru;
      gambar();
      jadwalSimpan();
      jadwalPratinjau();
    } else if (aksi === "susulan") {
      const kunci = `s_${v}`;
      const oto = susulanOto()[v];
      const baru = !susulanEfektif()[v];
      if (baru === oto) delete ST.tangan[kunci];
      else ST.tangan[kunci] = baru;
      gambar();
      jadwalSimpan();
      jadwalPratinjau();
    } else if (aksi === "alasan") {
      const a = alasanEfektif();
      const b = a && a.butir.find((x) => x.kunci === v);
      if (!b) return;
      const kunci = `a_${v}`;
      const baru = !b.nyala;
      if (baru === b.oto) delete ST.tangan[kunci];
      else ST.tangan[kunci] = baru;
      gambar();
      jadwalSimpan();
      jadwalPratinjau();
    } else if (aksi === "bentuk") {
      ST.bentuk = v === "lengkap" ? "lengkap" : "awal";
      ST.prat.html = "";
      ST.prat.kunci = "";
      gambar();
      jadwalPratinjau(150);
    } else if (aksi === "semua-oto") {
      ST.tangan = {};
      ST.isian = {};
      gambar();
      jadwalSimpan();
      jadwalPratinjau();
    } else if (aksi === "reset-isian") {
      delete ST.isian[v];
      gambar();
      jadwalSimpan();
      jadwalPratinjau();
    } else if (aksi === "cetak") {
      const fmt = { rtf: Boolean(W.querySelector('[data-bk-fmt="rtf"]:checked')), pdf: Boolean(W.querySelector('[data-bk-fmt="pdf"]:checked')) };
      if (!fmt.rtf && !fmt.pdf) return H.toast("Pilih RTF atau PDF.");
      void cetak(fmt);
    } else if (aksi === "prat-ulang") {
      ST.prat.kunci = "";
      void muatPratinjau();
    } else if (aksi === "prat-toggle") {
      ST.prat.terbuka = !ST.prat.terbuka;
      if (ST.prat.terbuka) jadwalPratinjau(100);
    } else if (aksi === "muat-ulang-semua") {
      void muat(false);
    } else if (aksi === "naik" || aksi === "turun") {
      const b = t.getAttribute("data-bkb");
      const i = Number(t.getAttribute("data-bki"));
      const j = aksi === "naik" ? i - 1 : i + 1;
      const u = ST.urut[b];
      if (j < 0 || j >= u.length) return;
      [u[i], u[j]] = [u[j], u[i]];
      isiTabel();
      const kunci = u[j];
      const btn = W.querySelector(`tr[data-key="${CSS.escape(kunci)}"] [data-bk="${aksi}"]`);
      if (btn) btn.focus();
      jadwalSimpan();
      jadwalPratinjau();
    } else if (aksi === "sembunyi") {
      const e0 = ST.edit[k] || {};
      ubahEdit(k, "tampil", e0.tampil === false);
      isiTabel();
      jadwalSimpan();
      jadwalPratinjau();
    } else if (aksi === "reset-hal") {
      ubahEdit(k, "halamanTeks", "");
      isiTabel();
      jadwalSimpan();
      jadwalPratinjau();
    } else if (aksi === "hapus") {
      delete ST.edit[k];
      for (const b of ["A", "B"]) ST.urut[b] = ST.urut[b].filter((x) => x !== k);
      isiTabel();
      jadwalSimpan();
      jadwalPratinjau();
    } else if (aksi === "tambah") {
      let n = 1;
      while (ST.edit[`x${n}`] || barisDasarDariFakta().some((r) => r.kunci === `x${n}`)) n += 1;
      const kunci = `x${n}`;
      ST.edit[kunci] = { bundel: v, tampil: true, halamanTeks: "1", judulManual: "Dokumen tambahan", tanggalManual: "", tambahan: true, grup: "TAMBAHAN PETUGAS" };
      ST.urut[v].push(kunci);
      isiTabel();
      const inp = W.querySelector(`[data-bk-edit="judulManual"][data-bkk="${CSS.escape(kunci)}"]`);
      if (inp) {
        inp.focus();
        inp.select();
      }
      jadwalSimpan();
      jadwalPratinjau();
    } else if (aksi === "hitung-ulang") {
      void hitungUlang();
    }
  }

  async function hitungUlang() {
    const sebelum = new Map(barisDasarDariFakta().map((r) => [r.kunci, `${r.halaman}|${r.sumber}`]));
    ST.ringkasHitung = "Membaca ulang berkas perkara…";
    segarAngka();
    try {
      const d = await H.ambilPortal(`${API}?perkaraId=${encodeURIComponent(ST.perkaraId)}`, { method: "GET", batasMs: 90000 }, "Membaca ulang bahan");
      ST.fakta = d.fakta;
      ST.bawaan = d.bawaan || ST.bawaan;
      const sesudah = barisDasarDariFakta();
      const baru = sesudah.filter((r) => !sebelum.has(r.kunci)).length;
      const ubah = sesudah.filter((r) => sebelum.has(r.kunci) && sebelum.get(r.kunci) !== `${r.halaman}|${r.sumber}`).length;
      ST.ringkasHitung = baru || ubah ? `Hitung ulang: ${baru} dokumen baru, ${ubah} halaman berubah. Ketikan Anda tidak diubah.` : "Hitung ulang: tidak ada yang berubah.";
      selaraskanUrutan();
    } catch (e) {
      ST.ringkasHitung = `Hitung ulang gagal: ${String((e && e.message) || e)}`;
    }
    isiTabel();
    jadwalPratinjau(300);
  }

  function saatMasuk(e) {
    const t = e.target;
    if (!ST || !t.getAttribute) return;
    const kin = t.getAttribute("data-bk-in");
    if (kin) {
      const nilai = t.value;
      if (nilai === nilaiAutoIsian(kin)) delete ST.isian[kin];
      else ST.isian[kin] = nilai;
      jadwalSimpan();
      jadwalPratinjau(1400);
      return;
    }
    const medan = t.getAttribute("data-bk-edit");
    if (medan) {
      ubahEdit(t.getAttribute("data-bkk"), medan, t.value);
      if (medan === "judulManual" || medan === "tanggalManual") ST.edit[t.getAttribute("data-bkk")].tambahan = true;
      segarAngka();
      jadwalSimpan();
      jadwalPratinjau(1400);
    }
  }
  function saatUbah(e) {
    const t = e.target;
    if (!ST || !t.getAttribute) return;
    if (t.hasAttribute("data-bk-kertas")) {
      ST.kertas = t.value;
      void H.tulisPenyimpanan({ [K_KERTAS]: ST.kertas });
      ST.prat.kunci = "";
      jadwalPratinjau(200);
    } else if (t.hasAttribute("data-bk-bundelb")) {
      ST.bundelB = t.value === "lanjut" ? "lanjut" : "1";
      segarAngka();
      jadwalSimpan();
      jadwalPratinjau(300);
    } else if (t.hasAttribute("data-bk-khas")) {
      const kode = t.value;
      const baris = (jenisKhas().khas || []).find(([k]) => k === kode);
      if (!baris) return;
      const kunci = `khas_${kode}`;
      ST.edit[kunci] = { bundel: "A", tampil: true, halamanTeks: String(baris[2]), judulManual: baris[1], tanggalManual: "", tambahan: true, grup: `I-B. DOKUMEN KHAS ${jenisKhas().nama.toUpperCase()}` };
      ST.urut.A.push(kunci);
      gambar();
      jadwalSimpan();
      jadwalPratinjau();
    } else if (t.hasAttribute("data-bk-pdf")) {
      const berkas = t.files && t.files[0];
      if (!berkas) return;
      const kunci = t.getAttribute("data-bk-pdf");
      berkas
        .arrayBuffer()
        .then((buf) => {
          const h = halamanPdf(buf);
          if (!h) return H.toast("Jumlah halaman PDF tidak terbaca.");
          ubahEdit(kunci, "halamanTeks", String(h.halaman));
          isiTabel();
          H.toast(`${h.halaman} halaman${h.ragu ? " (dua cara hitung berbeda; periksa)" : ""} dipakai sebagai halaman manual.`);
          jadwalSimpan();
          jadwalPratinjau(300);
        })
        .catch(() => H.toast("Berkas PDF tidak terbaca."));
    }
  }

  // ---------------------------------------------------------------------------
  // Antarmuka ke blangko-derry-isian.js
  // ---------------------------------------------------------------------------
  async function buka(wadah, host, info) {
    const sama = ST && W === wadah && ST.perkaraId === String(info.perkaraId) && ST.jenisBlangko === info.jenis;
    H = host;
    if (sama) {
      if (!W.querySelector(".bk, .bk-catat, .bk-galat")) gambar();
      return;
    }
    W = wadah;
    ST = barukan(info.jenis);
    ST.jenisBlangko = info.jenis;
    ST.bentuk = info.bentuk === "lengkap" ? "lengkap" : "awal";
    ST.perkaraId = String(info.perkaraId);
    ST.nomor = String(info.nomor || "");
    if (!W.__bkPasang) {
      W.addEventListener("click", saatKlik);
      W.addEventListener("input", saatMasuk);
      W.addEventListener("change", saatUbah);
      W.__bkPasang = true;
    }
    ST.kertas = await bacaKertas();
    await muat(false);
  }
  function tutup() {
    clearTimeout(jamSimpan);
    clearTimeout(jamPratinjau);
    if (ST && ST.menunggu) void simpanSekarang(ST);
    ST = null;
  }

  globalThis.AletaBerkasKhusus = Object.freeze({
    KODE_SAKLAR,
    jenisLayar,
    bentukDari,
    buka,
    tutup,
    // dipakai uji
    _murni: { definisiAlasan, ciriSampulAwal, daftarSusulan, rangkaiSusulan, pihakBanyak, perluLampiran, KUNCI_SUSULAN, uraiHalaman, hitungDaftarIsi, susunUrutan, rangkaiCiri, teksRentang, tanggalIndonesia, halamanPdf, BAWAAN_HALAMAN, CIRI },
  });
})();
