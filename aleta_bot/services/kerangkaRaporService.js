"use strict";

/**
 * ============================================================================
 * KERANGKA RAPOR - BENTUK PENILAIAN KETIGA
 * ============================================================================
 *
 * Bentuk pertama menjawab "berapa bagian yang memenuhi?" pada tingkat
 * pengadilan. Bentuk kedua menggambarkan sebaran. Bentuk ketiga menjawab
 * pertanyaan yang berbeda dari keduanya:
 *
 *     "Bagaimana keadaannya bila dipecah menurut ORANGnya?"
 *
 * Rapor bukan penilaian baru. Ia tidak membaca SIPP sendiri, tidak punya kueri
 * sendiri, dan tidak menghitung apa pun yang belum dihitung. Ia mengambil
 * penilaian yang SUDAH ada, memecah baris buktinya menurut nama petugas, lalu
 * menyusunnya kembali sebagai satu tabel orang lawan penilaian.
 *
 * ============================================================================
 * TIDAK ADA NILAI GABUNGAN - DAN ITU KEPUTUSAN, BUKAN KELALAIAN
 * ============================================================================
 *
 * Godaan terbesar pada rapor bernama orang adalah memberinya SATU angka.
 * "Rusdin 87" jauh lebih mudah dibaca daripada tabel enam kolom.
 *
 * Tetapi satu angka itu menuntut pembobotan: apakah ketaatan tenggang
 * pemanggilan sama pentingnya dengan ketepatan minutasi? Apakah petugas yang
 * menangani seratus perkara mudah lebih baik daripada yang menangani dua puluh
 * perkara sulit?
 *
 * Menjumlahkan baris begitu saja - tiga dari lima ditambah sepuluh dari dua
 * belas menjadi tiga belas dari tujuh belas - diam-diam memilih pembobotan
 * menurut VOLUME. Petugas yang kebanyakan mengerjakan tugas ringan akan tampak
 * lebih baik, dan tidak seorang pun tahu bahwa pilihan itu pernah diambil.
 *
 * Pembobotan adalah kewenangan pimpinan pengadilan, bukan kewenangan yang
 * menulis kodenya. Karena itu kerangka ini menyajikan tiap penilaian
 * BERDAMPINGAN, dan menolak menggabungkannya sampai dasarnya ditetapkan.
 *
 * ============================================================================
 * GERBANG ENAM SYARAT BERLAKU PENUH
 * ============================================================================
 *
 * Rapor bernama orang adalah keluaran paling berbahaya pada seluruh aplikasi
 * ini. Angka yang keliru pada tingkat pengadilan menghasilkan kesimpulan yang
 * salah; angka yang keliru pada tingkat orang menghasilkan seseorang dipanggil
 * menghadap.
 *
 * Seluruh hasil melewati gerbangnya, dan ketika ditahan yang hilang HANYA
 * nilainya - nama, pembilang, dan penyebutnya tetap ada.
 */

const kerangka = require("./kerangkaPenilaianService");
const raporBerjenjang = require("./raporBerjenjangService");
const gerbang = require("./gerbangRaporAparaturService");

const TERDAFTAR = Object.create(null);

function bersih(x) {
  return typeof x === "string" ? x.trim() : "";
}

/**
 * Cela pada definisi rapor.
 *
 * Tuntutan yang khas kerangka ini: rapor WAJIB menyebut dimensinya, WAJIB
 * menyebut penilaian mana saja yang disusunnya, dan TIDAK BOLEH membawa apa
 * pun yang menghasilkan nilai gabungan.
 */
function celaDefinisi(def) {
  const cela = [];
  if (!def || typeof def !== "object") return ["definisi bukan objek"];

  if (!bersih(def.kunci)) cela.push("kunci kosong");
  else if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(bersih(def.kunci))) {
    cela.push(`kunci "${def.kunci}" harus diawali huruf dan hanya memuat huruf, angka, atau garis bawah`);
  }

  if (!bersih(def.judul)) cela.push("judul kosong");
  if (!bersih(def.keterangan)) cela.push("keterangan kosong");
  if (!bersih(def.versiRumus)) cela.push("versiRumus kosong");

  if (!bersih(def.dimensi)) {
    cela.push("dimensi kosong - rapor wajib menyebut ruas mana pada baris bukti yang menjadi nama orangnya");
  }
  if (!bersih(def.sebutanDimensi)) {
    cela.push("sebutanDimensi kosong - rapor wajib menyebut peran apa yang sedang dinilai, dalam bahasa orang");
  }

  if (!Array.isArray(def.sumber) || def.sumber.length === 0) {
    cela.push("sumber kosong - rapor wajib menyebut penilaian mana saja yang disusunnya");
  }

  // Rapor tidak boleh punya jalan menuju nilai gabungan.
  ["bobot", "nilaiGabungan", "rumusGabungan", "peringkat"].forEach((k) => {
    if (Object.prototype.hasOwnProperty.call(def, k)) {
      cela.push(
        `rapor tidak boleh membawa "${k}" - menggabungkan beberapa penilaian menjadi satu angka menuntut pembobotan, dan pembobotan adalah kewenangan pimpinan`
      );
    }
  });

  return cela;
}

function daftarkan(def) {
  const cela = celaDefinisi(def);
  if (cela.length) {
    throw new Error(`Rapor "${def && def.kunci}" ditolak: ${cela.join("; ")}`);
  }
  TERDAFTAR[bersih(def.kunci)] = def;
}

function lupakanSemua() {
  Object.keys(TERDAFTAR).forEach((k) => {
    delete TERDAFTAR[k];
  });
}

function ambil(kunci) {
  const k = bersih(kunci);
  return Object.prototype.hasOwnProperty.call(TERDAFTAR, k) ? TERDAFTAR[k] : null;
}

function daftar() {
  return Object.keys(TERDAFTAR)
    .sort()
    .map((k) => {
      const d = TERDAFTAR[k];
      return {
        kunci: d.kunci,
        kode: d.kode || "",
        judul: d.judul,
        keterangan: d.keterangan,
        versiRumus: d.versiRumus,
        dimensi: d.dimensi,
        sebutanDimensi: d.sebutanDimensi,
        sumber: d.sumber.slice(),
        bentuk: "rapor",
      };
    });
}

/**
 * Menyusun satu rapor.
 *
 * Yang dipulangkan tabel: tiap baris satu orang, tiap kolom satu penilaian.
 * Sel yang kosong berarti penilaian itu tidak membawa nama peran ini pada
 * baris buktinya - dikatakan apa adanya, bukan diisi nol.
 */
async function jalankan(kunci, jenisPeriode, acuan, opsi = {}) {
  const def = ambil(kunci);
  if (!def) return { ok: false, alasan: "rapor_tidak_dikenali" };

  const kolom = [];
  const perOrang = new Map();

  for (const kunciPenilaian of def.sumber) {
    const hasil = await kerangka.jalankan(kunciPenilaian, jenisPeriode, acuan, opsi);

    if (!hasil.ok) {
      kolom.push({
        penilaian: kunciPenilaian,
        judul: kunciPenilaian,
        terpakai: false,
        sebab: `penilaian tidak dapat dijalankan: ${hasil.alasan || "tidak diketahui"}`,
      });
      continue;
    }

    // Penilaian yang baris buktinya tidak membawa ruas peran ini TIDAK dipakai.
    // Memakainya akan menghasilkan satu kelompok "(tidak tercatat)" berisi
    // segalanya - dan itu terbaca seperti temuan besar padahal hanya salah
    // pertanyaan.
    const contoh = hasil.satuan.flatMap((s) => s.bukti).slice(0, 100);
    const membawa = contoh.some((b) => Object.prototype.hasOwnProperty.call(b, def.dimensi));
    if (!membawa) {
      kolom.push({
        penilaian: kunciPenilaian,
        judul: hasil.judul,
        terpakai: false,
        sebab: `baris buktinya tidak membawa ruas "${def.dimensi}", sehingga tidak dapat dipecah menurut ${def.sebutanDimensi}`,
      });
      continue;
    }

    const pecah = raporBerjenjang.berjenjang(hasil, def.dimensi);
    kolom.push({
      penilaian: kunciPenilaian,
      judul: hasil.judul,
      terpakai: true,
      sebab: "",
      versiRumus: hasil.versiRumus,
      lantai: hasil.lantai,
    });

    pecah.ringkasPelaku.forEach((p) => {
      if (!perOrang.has(p.pelaku)) perOrang.set(p.pelaku, { pelaku: p.pelaku, sel: {} });
      perOrang.get(p.pelaku).sel[kunciPenilaian] = {
        terpenuhi: p.terpenuhi,
        penyebut: p.penyebut,
        nilai: p.nilai,
        cukup: p.cukup,
        sebabTidakCukup: p.sebabTidakCukup || "",
      };
    });
  }

  const terpakai = kolom.filter((k) => k.terpakai);

  const baris = [...perOrang.values()]
    .map((o) => {
      // Penyebut keseluruhan dipulangkan untuk menerangkan besarnya beban,
      // BUKAN untuk dijadikan nilai. Ia sengaja tidak disertai angka gabungan.
      const totalPenyebut = terpakai.reduce((s, k) => s + ((o.sel[k.penilaian] || {}).penyebut || 0), 0);
      return { ...o, totalPenyebut };
    })
    .sort((a, b) => a.pelaku.localeCompare(b.pelaku, "id"));

  // Gerbang menuntut bentuk ringkasPelaku. Yang diserahkan kepadanya adalah
  // penilaian pertama yang terpakai - bukan gabungan, sebab gabungan memang
  // tidak ada. Bila tidak satu pun terpakai, rapornya tidak sah.
  const dasarGerbang = terpakai.length
    ? {
        ok: true,
        kunci: terpakai[0].penilaian,
        ringkasPelaku: baris.map((o) => ({
          pelaku: o.pelaku,
          ...(o.sel[terpakai[0].penilaian] || { terpenuhi: 0, penyebut: 0, nilai: null, cukup: false }),
        })),
      }
    : { ok: false };

  const hasilGerbang = gerbang.terbitkan(dasarGerbang, {
    penilaian: terpakai.length ? terpakai[0].penilaian : "",
    tanggal: acuan,
  });

  // Bila gerbang menahan, seluruh sel kehilangan nilainya - bukan hanya kolom
  // yang diperiksa gerbang. Menahan sebagian akan membuat orang membaca kolom
  // yang tersisa seolah sudah layak dipakai.
  if (hasilGerbang.terbit === false) {
    baris.forEach((o) => {
      Object.keys(o.sel).forEach((k) => {
        o.sel[k].nilai = null;
        o.sel[k].nilaiDitahan = true;
      });
    });
  }

  return {
    ok: true,
    bentuk: "rapor",
    kunci: def.kunci,
    kode: def.kode || "",
    judul: def.judul,
    keterangan: def.keterangan,
    versiRumus: def.versiRumus,
    dimensi: def.dimensi,
    sebutanDimensi: def.sebutanDimensi,
    acuan,
    kolom,
    baris,
    jumlahOrang: baris.length,
    terbit: hasilGerbang.terbit,
    sebabDitahan: hasilGerbang.sebabDitahan || "",
    syarat: hasilGerbang.syarat || null,
    peringatan: hasilGerbang.peringatan || "",
    tanpaNilaiGabungan:
      "Rapor ini sengaja tidak menghasilkan satu angka gabungan. Menggabungkan beberapa penilaian menuntut pembobotan - apakah ketaatan pemanggilan sama pentingnya dengan ketepatan minutasi - dan pembobotan adalah kewenangan pimpinan pengadilan, bukan kewenangan yang menulis kodenya.",
  };
}

module.exports = { celaDefinisi, daftarkan, lupakanSemua, ambil, daftar, jalankan };
