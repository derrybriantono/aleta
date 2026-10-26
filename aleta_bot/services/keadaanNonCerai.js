"use strict";

/**
 * ============================================================================
 * KEADAAN PERKARA NON-CERAI DARI POSITA / PETITUM (C5 = U9, 25 Okt 2026)
 * ============================================================================
 *
 * "Susun saksi menurut keadaan perkara" menanyakan keadaan perkara kepada petugas (jenis harta, ahli waris, bentuk wasiat, ...).
 * Sebagian besar keadaan itu sudah tertulis di posita atau petitum. Berkas ini MEMBACANYA dan mengusulkannya - hanya mengusulkan:
 *
 *   - hasilnya SARAN: ekstensi menampilkan "Saran keadaan dari posita" beserta kalimat sumbernya dan tombol Pakai. Tidak ada keadaan
 *     yang terisi sendiri (keputusan Derry: POSITA acuan utama; yang belum dikuatkan saksi hanya saran);
 *   - kata yang diawali penyangkalan ("tidak/belum/bukan/tanpa ...") tidak dihitung sebagai ada;
 *   - isian pilih-satu yang terbaca bertentangan (dua nilai berbeda) TIDAK diusulkan - petugas yang memutuskan;
 *   - isian bernilai "tidak-ada / ada" hanya diusulkan "ada" bila posita menyebutnya; "tidak-ada" hanya bila posita menyangkalnya
 *     secara eksplisit;
 *   - keyakinan selalu "ragu" sampai ketepatannya terukur di lapangan: berkas config/gerbang-keadaan.json (diisi dari data U3 oleh
 *     rantai D) dapat menaikkannya menjadi "cukup" per jenis perkara + isian; berkas kosong = semua "ragu";
 *   - keadaan perceraian (346/347) TIDAK diurus di sini (sudah ada fakta cerai dan variabel ABT).
 *
 * Murni (tanpa basis data, tanpa jaringan). Seluruh nama isian dan nilainya diuji terhadap saksi-katalog/*.json.
 */

const fs = require("fs");
const path = require("path");

const BERKAS_GERBANG = path.join(__dirname, "..", "config", "gerbang-keadaan.json");

const bersih = (t) =>
  String(t == null ? "" : t)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
const adaAleta = (t) => /aleta/i.test(String(t == null ? "" : t));

/** Penyangkalan tepat di depan kata (30 huruf ke belakang). */
const SANGKAL = /\b(?:tidak|belum|bukan|tanpa|tak)\s+(?:pernah\s+|sedang\s+|lagi\s+|ada\s+|memiliki\s+|mempunyai\s+|membuat\s+|mengadakan\s+|menandatangani\s+|punya\s+|sama\s+sekali\s+)*$/i;

/** Pecah teks menjadi kalimat/butir (titik koma dan titik, bukan titik di angka). */
function pecahKalimat(teks) {
  return bersih(teks)
    .split(/(?<![0-9])[.;](?=\s|$)|\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

/**
 * Cocok pola pada daftar kalimat. Mengembalikan kalimat pertama yang cocok tanpa penyangkalan (`ada`) dan kalimat pertama yang cocok
 * disangkal (`sangkal`).
 */
function cari(kalimat, pola) {
  const re = new RegExp(pola.source, pola.flags.includes("g") ? pola.flags : `${pola.flags}g`);
  let ada = null;
  let sangkal = null;
  for (const k of kalimat) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(k.teks))) {
      const depan = k.teks.slice(Math.max(0, m.index - 30), m.index);
      if (SANGKAL.test(depan)) sangkal = sangkal || k;
      else ada = ada || k;
      if (m[0].length === 0) re.lastIndex += 1;
      if (ada) break;
    }
    if (ada) break;
  }
  return { ada, sangkal };
}

// ──────────────────────────────────────────────────────────────────────────────
// Aturan. Bentuk: ATURAN[kunciKatalog][kunciKeadaan] = { jamak?, pilih?: [[nilai, pola], ...], ya?, tidak?, pola?, fn? }
//   pilih : daftar [nilai, pola]; jamak -> semua yang cocok; pilih-satu -> hanya bila tepat satu nilai berbeda yang cocok
//   ya/tidak/pola : isian dua nilai - `pola` cocok tanpa sangkal -> `ya`; cocok disangkal -> `tidak` (bila ada)
//   fn    : fungsi kustom (kalimat, konteks) -> { nilai, kalimat } | null
// ──────────────────────────────────────────────────────────────────────────────

const P = {
  tanah: /\b(?:tanah|rumah|bangunan|ruko|pekarangan|rumah\s+tinggal)\b/i,
  kebun: /\b(?:kebun|sawah|ladang|tambak|empang|kelapa|cengkih|kakao)\b/i,
  kendaraan: /\b(?:mobil|sepeda\s+motor|motor|kendaraan|truk|pick\s*up|perahu|kapal)\b/i,
  uang: /\b(?:tabungan|deposito|rekening|uang\s+tunai|uang\s+simpanan|simpanan)\b/i,
  usaha: /\b(?:usaha|toko|warung|kios|bengkel|rumah\s+makan)\b/i,
  perhiasan: /\b(?:perhiasan|emas|perabot|perabotan|barang\s+elektronik)\b/i,
  sitaJaminan: /\b(?:sita\s+jaminan|conservatoir(?:\s+beslag)?)\b/i,
  ibuKandung: /\b(?:Penggugat|Pemohon)\b[^.;]{0,80}\bibu\s+kandung\b/i,
  ayahKandung: /\b(?:Penggugat|Pemohon)\b[^.;]{0,80}\b(?:ayah|bapak)\s+kandung\b/i,
  kerabatPengaju: /\b(?:Penggugat|Pemohon)\b[^.;]{0,60}\b(?:nenek|kakek|paman|bibi|tante|kakak|saudara\s+kandung)\b/i,
  anakBanyak: /\b(?:dua|tiga|empat|lima|[2-5])\s+(?:\(\w+\)\s+)?(?:orang\s+)?anak\b|\bkedua\s+anak\b|\banak-anak\b|\bketiga\s+anak\b/i,
  anakSatu: /\b(?:seorang\s+anak|satu\s+(?:\(1\)\s+)?(?:orang\s+)?anak|1\s+(?:\(satu\)\s+)?(?:orang\s+)?anak)\b/i,
  berdua: /\bPemohon\s+I\s+dan\s+Pemohon\s+II\b/i,
  lisan: /\b(?:secara\s+)?lisan\b/i,
  pns: /\b(?:PNS|ASN|TNI|Polri|Pegawai\s+Negeri|Aparatur\s+Sipil|Anggota\s+Polisi)\b/,
};

const kondisiOrang = (subjek) => ({
  jamak: false,
  pilih: [
    ["sehat", new RegExp(`\\b(?:dalam\\s+keadaan\\s+sehat|sehat\\s+(?:jasmani|akal|walafiat)|sehat\\s+wal\\s*afiat)\\b`, "i")],
    ["sakit-menjelang-wafat", /\b(?:sakit\s+(?:keras|parah)|menjelang\s+(?:wafat|meninggal)|dalam\s+keadaan\s+sakit|terbaring\s+sakit)\b/i],
    ["akal-dipersoalkan", /\b(?:gila|tidak\s+waras|kurang\s+waras|pikun|tidak\s+cakap\s+hukum|gangguan\s+jiwa)\b/i],
  ],
  _subjek: subjek,
});

const ATURAN = {
  kewarisan: {
    statusPewaris: {
      pilih: [
        ["menikah", /\b(?:meninggalkan|ditinggalkan)\s+(?:seorang\s+)?(?:istri|isteri|suami)\b|\b(?:istri|isteri|suami)\s+(?:pewaris|almarhum|almarhumah)\b|\bjanda\b|\bduda\b/i],
        ["tidak-menikah", /\b(?:tidak|belum)\s+pernah\s+(?:menikah|kawin)\b|\bhidup\s+membujang\b|\bbelum\s+menikah\b/i],
      ],
    },
    ahliWaris: {
      jamak: true,
      pilih: [
        ["anak", /\banak(?:-anak)?\s+(?:kandung|pewaris)\b|\bmeninggalkan\b[^.;]{0,40}\banak\b/i],
        ["orang-tua", /\b(?:ayah|ibu|bapak|orang\s*tua)\s+(?:kandung\s+)?(?:pewaris|almarhum|almarhumah)\b/i],
        ["saudara", /\b(?:saudara|kakak|adik)\s+(?:kandung\s+)?(?:pewaris|almarhum|almarhumah)\b|\bsaudara\s+kandung\b/i],
        ["cucu-pengganti", /\bcucu\b/i],
      ],
    },
    jenisHarta: {
      jamak: true,
      pilih: [
        ["tanah-bangunan", P.tanah],
        ["kebun-sawah", P.kebun],
        ["kendaraan", P.kendaraan],
        ["uang-simpanan", P.uang],
        ["usaha", P.usaha],
        ["perhiasan-perabot", P.perhiasan],
      ],
    },
    asalHarta: {
      pilih: [
        ["bersama-pasangan", /\bharta\s+bersama\b|\bgono[- ]?gini\b/i],
        ["warisan-leluhur", /\bwarisan\s+(?:dari\s+)?(?:leluhur|orang\s+tua\s+pewaris|kakek|nenek)\b|\bharta\s+leluhur\b/i],
        ["pribadi", /\bharta\s+(?:pribadi|bawaan)\b|\bharta\s+milik\s+pribadi\b/i],
      ],
    },
    sita: { pola: P.sitaJaminan, ya: "ada" },
    statusPasangan: {
      pilih: [
        ["meninggal-lebih-dahulu", /\b(?:istri|isteri|suami)\b[^.;]{0,30}\bmeninggal(?:\s+dunia)?\s+(?:lebih|terlebih)\s+(?:dahulu|dulu)\b/i],
        ["bercerai", /\b(?:telah|sudah)\s+bercerai\b|\bcerai\s+(?:hidup|dengan)\b/i],
        ["masih-hidup", /\b(?:istri|isteri|suami)\b[^.;]{0,30}\bmasih\s+hidup\b/i],
      ],
    },
    jumlahPasangan: { pola: /\b(?:istri|isteri)\s+(?:kedua|ketiga|keempat)\b|\bpoligami\b|\bdua\s+orang\s+(?:istri|isteri)\b|\bbeberapa\s+(?:istri|isteri)\b/i, ya: "lebih-dari-satu" },
    anakLuarNikah: { pola: /\banak\s+(?:di\s+)?luar\s+(?:nikah|perkawinan)\b/i, ya: "ada" },
    anakAngkat: { pola: /\banak\s+angkat\b/i, ya: "ada" },
    ahliWarisBelumDewasa: { pola: /\b(?:belum\s+dewasa|di\s+bawah\s+umur)\b/i, ya: "ada" },
    bedaAgama: { pola: /\b(?:non[- ]?muslim|beda\s+agama|berbeda\s+agama|murtad)\b/i, ya: "ada" },
    hutang: { pola: /\b(?:hutang|utang)\s+(?:pewaris|almarhum|almarhumah)\b|\bmeninggalkan\s+(?:hutang|utang)\b/i, ya: "ada" },
    wasiat: { pola: /\bwasiat\b/i, ya: "ada" },
    hibahSemasaHidup: { pola: /\bhibah\b/i, ya: "ada" },
    suratWaris: { pola: /\bsurat\s+(?:keterangan\s+)?waris\b/i, ya: "ada" },
  },

  "harta-bersama": {
    jenisObjek: {
      jamak: true,
      pilih: [
        ["tanah-bangunan", P.tanah],
        ["kendaraan", P.kendaraan],
        ["usaha", P.usaha],
        ["rekening-uang", P.uang],
        ["perhiasan-perabot", P.perhiasan],
        ["utang", /\b(?:utang|hutang)\s+bersama\b|\bkredit\b/i],
        ["piutang", /\bpiutang\b/i],
        ["asuransi-pensiun", /\b(?:asuransi|dana\s+pensiun|tabungan\s+haji|taspen)\b/i],
        ["kebun-ternak", /\b(?:kebun|sawah|ternak|sapi|kambing|kerbau)\b/i],
        ["investasi", /\b(?:saham|investasi|penyertaan\s+modal|penitipan\s+modal)\b/i],
      ],
    },
    sita: { pola: P.sitaJaminan, ya: "ada" },
    statusTanah: {
      pilih: [
        ["belum-bersertifikat", /\b(?:girik|surat\s+keterangan\s+tanah|segel|belum\s+(?:bersertifikat|bersertipikat))\b/i],
        ["bersertifikat", /\b(?:sertifikat|sertipikat|SHM|SHGB)\b/],
      ],
    },
    poligami: { pola: /\b(?:poligami|istri\s+kedua|istri\s+muda)\b/i, ya: "ya" },
    pembagianDiminta: { pola: /\bseperdua\b|\bsetengah\s+bagian\b|\b1\/2\b|\b50\s*%/i, ya: "seperdua" },
    perjanjianKawin: { pola: /\bperjanjian\s+(?:kawin|perkawinan|pra\s*nikah)\b/i, ya: "ada", tidak: "tidak-ada" },
    agunan: { pola: /\b(?:agunan|dijaminkan|diagunkan)\b/i, ya: "ada" },
    hasilObjek: { pola: /\b(?:disewakan|hasil\s+sewa|hasil\s+kebun|penghasilan\s+dari\s+(?:objek|usaha))\b/i, ya: "ada" },
  },

  "hak-asuh": {
    kedudukanPengaju: {
      pilih: [
        ["ibu", P.ibuKandung],
        ["ayah", P.ayahKandung],
        ["kerabat", P.kerabatPengaju],
      ],
    },
    jumlahAnak: {
      pilih: [
        ["lebih", P.anakBanyak],
        ["satu", P.anakSatu],
      ],
    },
    anakMumayyiz: { fn: "umurAnak" },
    pengasuhAnak: {
      pilih: [
        ["pengaju", /\banak\b[^.;]{0,60}\b(?:tinggal|diasuh|dirawat|dipelihara|berada)\s+(?:bersama|oleh|pada)\s+(?:Penggugat|Pemohon)\b/i],
        ["lawan", /\banak\b[^.;]{0,60}\b(?:tinggal|diasuh|dirawat|dipelihara|berada)\s+(?:bersama|oleh|pada)\s+(?:Tergugat|Termohon)\b/i],
      ],
    },
    akses: { pola: /\b(?:tidak\s+(?:memperbolehkan|mengizinkan|membolehkan|memberi\s+(?:izin|kesempatan))|melarang|menghalangi)\b[^.;]{0,60}\b(?:bertemu|menemui|menjenguk|mengunjungi)\b/i, ya: "tidak" },
    keadaanPihakLain: {
      pilih: [
        ["menikah-lagi", /\b(?:menikah|kawin)\s+lagi\b/i],
        ["bekerja-jauh", /\bbekerja\s+(?:di\s+)?(?:luar\s+(?:kota|negeri|daerah|pulau)|jauh|merantau)\b/i],
        ["kebiasaan-buruk", /\b(?:mabuk|berjudi|judi|narkoba|narkotika|minuman\s+keras|miras)\b/i],
        ["kekerasan-penelantaran", /\b(?:kekerasan|memukul|menelantarkan|penelantaran|menganiaya)\b/i],
        ["jarang-menjenguk", /\b(?:jarang|tidak\s+pernah)\s+(?:menjenguk|menemui|mengunjungi)\b/i],
      ],
    },
  },

  "penguasaan-anak": {
    kedudukanPengaju: {
      pilih: [
        ["ibu", P.ibuKandung],
        ["ayah", P.ayahKandung],
        ["kerabat", P.kerabatPengaju],
      ],
    },
    jumlahAnak: {
      pilih: [
        ["lebih", P.anakBanyak],
        ["satu", P.anakSatu],
      ],
    },
    anakMumayyiz: { fn: "umurAnak" },
    caraPenguasaan: {
      pilih: [
        ["diambil-paksa", /\b(?:diambil\s+paksa|mengambil\s+paksa)\b/i],
        ["dibawa-pergi", /\b(?:dibawa|membawa)\s+(?:pergi|lari)\b/i],
        ["dititipkan-lalu-ditahan", /\bdititipkan\b/i],
        ["tidak-dikembalikan", /\btidak\s+(?:mau\s+)?(?:mengembalikan|dikembalikan|menyerahkan)\b/i],
      ],
    },
    lokasiAnak: { pola: /\b(?:keberadaan|lokasi|tempat\s+tinggal)\s+anak\b[^.;]{0,30}\btidak\s+(?:diketahui|jelas)\b|\btidak\s+mengetahui\s+(?:keberadaan|lokasi)\b/i, ya: "tidak-diketahui" },
  },

  "nafkah-anak": {
    kedudukanPenggugat: {
      pilih: [
        ["ibu", P.ibuKandung],
        ["pengasuh-lain", P.kerabatPengaju],
      ],
    },
    jumlahAnak: {
      pilih: [
        ["lebih", P.anakBanyak],
        ["satu", P.anakSatu],
      ],
    },
    nafkahLampauAnak: { pola: /\bnafkah\s+(?:anak\s+)?(?:yang\s+)?(?:telah\s+)?(?:lampau|lalu|terhutang|tertunggak)\b|\bnafkah\s+madliyah\s+anak\b/i, ya: "ya" },
    nafkahDiberikan: {
      pilih: [
        ["tidak", /\btidak\s+(?:pernah\s+)?memberi(?:kan)?\s+nafkah\b/i],
        ["sebagian", /\bhanya\s+memberi(?:kan)?\s+(?:sebagian|sedikit)\b|\bnafkah\s+(?:yang\s+diberikan\s+)?tidak\s+cukup\b/i],
      ],
    },
    jenisNafkah: {
      jamak: true,
      pilih: [
        ["ke-depan", /\bnafkah\s+(?:anak\s+)?[^.;]{0,40}\b(?:setiap|tiap|per)\s*bulan\b/i],
        ["pendidikan-kesehatan", /\bbiaya\s+(?:pendidikan|sekolah|kesehatan|pengobatan)\b/i],
        ["kenaikan", /\bkenaikan\s+(?:nafkah|\d+\s*%|10\s*%)/i],
        ["sita-jaminan", P.sitaJaminan],
        ["pemotongan-penghasilan", /\b(?:pemotongan\s+(?:gaji|penghasilan)|dipotong\s+dari\s+gaji)\b/i],
      ],
    },
    sumberPenghasilanAyah: {
      pilih: [
        ["pegawai-tetap", /\b(?:PNS|ASN|pegawai\s+negeri|TNI|Polri|pegawai\s+tetap|karyawan\s+tetap)\b/],
        ["usaha-sendiri", /\b(?:wiraswasta|berdagang|pedagang|usaha\s+sendiri)\b/i],
        ["buruh-harian", /\b(?:buruh\s+harian|buruh|kuli|serabutan|nelayan|petani)\b/i],
      ],
    },
    tahapAnak: {
      pilih: [
        ["belum-sekolah", /\b(?:balita|belum\s+(?:bersekolah|sekolah)|bayi)\b/i],
        ["sekolah", /\b(?:bersekolah|duduk\s+di\s+bangku|SD|SMP|SMA|SMK|sekolah\s+dasar)\b/],
      ],
    },
  },

  "hak-bekas-istri": {
    hakDituntut: {
      jamak: true,
      pilih: [
        ["nafkah-iddah", /\bnafkah\s+(?:'?iddah|idah)\b/i],
        ["maskan-kiswah", /\b(?:maskan|kiswah)\b/i],
        ["mutah", /\bmut['’]?ah\b/i],
        ["nafkah-madliyah", /\b(?:madliyah|madhiyah|nafkah\s+lampau)\b/i],
        ["mahar", /\b(?:mahar|mas\s+kawin)\b[^.;]{0,40}\b(?:terutang|terhutang|belum\s+dibayar|belum\s+dilunasi)\b/i],
        ["biaya-hadhanah", /\bbiaya\s+(?:hadhanah|hadanah|pemeliharaan|pengasuhan)\s+anak\b/i],
      ],
    },
    dukhul: {
      pilih: [
        ["qobla", /\bqobla\s+dukhul\b|\bbelum\s+(?:pernah\s+)?(?:berhubungan|bergaul|dukhul)\b/i],
        ["bada", /\bba['’]?da\s+dukhul\b|\b(?:telah|sudah)\s+(?:pernah\s+)?(?:berhubungan|bergaul)\b|\bdikaruniai\s+(?:\w+\s+)?(?:orang\s+)?anak\b/i],
      ],
    },
    caraPutus: {
      pilih: [
        ["cerai-talak", /\b(?:cerai\s+talak|ikrar\s+talak|menjatuhkan\s+talak)\b/i],
        ["cerai-gugat", /\bcerai\s+gugat\b/i],
      ],
    },
  },

  "kelalaian-kewajiban": {
    kedudukanPenggugat: {
      pilih: [
        ["istri", /\bPenggugat\s+(?:adalah\s+)?(?:istri|isteri)\b/i],
        ["suami", /\bPenggugat\s+(?:adalah\s+)?suami\b/i],
      ],
    },
    kelalaian: {
      jamak: true,
      pilih: [
        ["nafkah", /\btidak\s+(?:memberi(?:kan)?|memenuhi)\s+nafkah\b/i],
        ["tempat-kediaman", /\b(?:tempat\s+(?:kediaman|tinggal)|rumah\s+kediaman)\b/i],
        ["kiswah-biaya", /\b(?:kiswah|biaya\s+hidup|biaya\s+rumah\s+tangga)\b/i],
        ["meninggalkan", /\b(?:pergi\s+)?meninggalkan\s+(?:Penggugat|rumah|tempat)\b/i],
        ["berbakti", /\b(?:berbakti|tidak\s+patuh)\b/i],
      ],
    },
    tempatTinggal: {
      pilih: [
        ["berpisah-rumah", /\b(?:pisah\s+rumah|berpisah\s+tempat\s+tinggal|tidak\s+(?:lagi\s+)?serumah)\b/i],
        ["masih-serumah", /\b(?:masih\s+(?:tinggal\s+)?serumah|tinggal\s+serumah)\b/i],
      ],
    },
    nafkahLampau: { pola: /\bnafkah\s+(?:yang\s+)?(?:lampau|terhutang|tertunggak|selama\s+\d+)/i, ya: "ya" },
    dalilNusyuz: { pola: /\bnusyuz\b/i, ya: "ya" },
  },

  "itsbat-nikah": {
    bentuk: { fn: "bentukItsbat" },
    dasarItsbat: {
      pilih: [
        ["huruf-a", /\b(?:penyelesaian\s+perceraian|untuk\s+(?:mengajukan|keperluan)\s+(?:perceraian|cerai))\b/i],
        ["huruf-b", /\b(?:akta\s+nikah|buku\s+nikah)\b[^.;]{0,40}\b(?:hilang|rusak|musnah|terbakar)\b/i],
        ["huruf-c", /\bkeraguan\b/i],
        ["huruf-d", /\bsebelum\s+(?:berlakunya\s+)?(?:Undang-Undang|UU)\s+(?:Nomor\s+)?1\s+Tahun\s+1974\b|\bsebelum\s+tahun\s+1974\b/i],
        ["huruf-e", /\btidak\s+ada\s+halangan\s+(?:perkawinan|untuk\s+menikah)\b|\btidak\s+(?:mempunyai|memiliki)\s+halangan\b/i],
      ],
    },
  },

  "dispensasi-kawin": {
    jenisKelaminAnak: {
      pilih: [
        ["perempuan", /\banak\s+(?:Pemohon\s+)?perempuan\b|\banak\s+gadis\b|\bputri\s+Pemohon\b/i],
        ["laki-laki", /\banak\s+(?:Pemohon\s+)?laki-laki\b|\bputra\s+Pemohon\b/i],
      ],
    },
  },

  "wali-adhal": {
    statusPemohon: {
      pilih: [
        ["gadis", /\b(?:gadis|perawan|belum\s+pernah\s+menikah)\b/i],
        ["janda-cerai", /\bjanda\s+cerai\b|\bsudah\s+bercerai\b/i],
        ["janda-mati", /\bjanda\s+(?:ditinggal\s+)?mati\b|\bsuami\s+(?:Pemohon\s+)?(?:telah\s+)?meninggal\b/i],
      ],
    },
    hubunganWali: {
      pilih: [
        ["ayah-kandung", /\bwali\s+(?:nikah\s+)?(?:Pemohon\s+)?(?:adalah\s+)?(?:ayah|bapak)\s+kandung\b/i],
        ["kakek", /\bwali\s+(?:nikah\s+)?[^.;]{0,30}\bkakek\b/i],
        ["saudara-kandung", /\bwali\s+(?:nikah\s+)?[^.;]{0,30}\b(?:saudara|kakak|abang)\s+kandung\b/i],
        ["paman", /\bwali\s+(?:nikah\s+)?[^.;]{0,30}\bpaman\b/i],
      ],
    },
    penolakanKua: { pola: /\b(?:KUA|Kantor\s+Urusan\s+Agama)\b[^.;]{0,80}\b(?:menolak|penolakan|tidak\s+bersedia)\b/i, ya: "ada" },
  },

  "izin-poligami": {
    alasanPoligami: {
      jamak: true,
      pilih: [
        ["a", /\btidak\s+dapat\s+menjalankan\s+kewajiban(?:nya)?\s+sebagai\s+(?:istri|isteri)\b/i],
        ["b", /\b(?:cacat\s+badan|penyakit\s+(?:yang\s+)?tidak\s+dapat\s+disembuhkan|sakit\s+(?:parah|menahun))\b/i],
        ["c", /\btidak\s+dapat\s+(?:melahirkan|memberi(?:kan)?)\s+keturunan\b|\bmandul\b/i],
      ],
    },
    sikapIstri: {
      pilih: [
        ["setuju", /\b(?:istri|isteri)\b[^.;]{0,30}\b(?:menyetujui|setuju|bersedia|mengizinkan|merestui)\b/i],
        ["keberatan", /\bkeberatan\b|\btidak\s+(?:setuju|menyetujui|mengizinkan)\b/i],
      ],
    },
    pekerjaanSuami: { pola: P.pns, ya: "asn-tni-polri" },
    statusCalon: {
      pilih: [
        ["gadis", /\bcalon\s+(?:istri|isteri)\b[^.;]{0,60}\b(?:gadis|perawan|belum\s+pernah\s+menikah)\b/i],
        ["janda-cerai", /\bcalon\s+(?:istri|isteri)\b[^.;]{0,60}\bjanda\s+cerai\b/i],
        ["janda-meninggal", /\bcalon\s+(?:istri|isteri)\b[^.;]{0,60}\bjanda\s+(?:mati|meninggal|ditinggal)\b/i],
      ],
    },
  },

  "pengesahan-anak": {
    waktuLahir: {
      pilih: [
        ["sebelum-nikah", /\b(?:lahir|dilahirkan)\s+(?:sebelum|di\s+luar)\s+(?:pernikahan|perkawinan|nikah)\b/i],
        ["dalam-perkawinan", /\b(?:lahir|dilahirkan)\s+(?:dalam|selama|setelah)\s+(?:pernikahan|perkawinan|ikatan)\b/i],
      ],
    },
    pencatatanNikah: {
      pilih: [
        ["sudah-itsbat", /\bpenetapan\s+(?:itsbat|isbat)\s+nikah\b|\b(?:itsbat|isbat)\s+nikah\s+(?:telah|sudah)\b/i],
        ["belum-dicatat", /\bbelum\s+(?:tercatat|dicatat|dicatatkan)\b|\btidak\s+tercatat\b|\bnikah\s+sirri\b|\bperkawinan\s+sirri\b/i],
      ],
    },
  },

  "asal-usul-anak": {
    pemohon: {
      pilih: [
        ["suami-istri", P.berdua],
        ["ibu-saja", /\bPemohon\s+(?:adalah\s+)?ibu\s+kandung\b/i],
      ],
    },
  },

  "ekonomi-syariah": {
    jenisAkad: {
      pilih: [
        ["murabahah", /\bmurabahah\b/i],
        ["mudharabah", /\bmudharabah\b/i],
        ["musyarakah", /\bmusyarakah\b/i],
        ["ijarah", /\bijarah\b/i],
        ["rahn", /\brahn\b|\bgadai\b/i],
        ["qardh", /\bqardh\b|\bqard\b/i],
      ],
    },
    jaminan: { pola: /\b(?:jaminan|agunan|fidusia|hak\s+tanggungan)\b/i, ya: "ada", tidak: "tidak" },
    acara: { pola: /\bgugatan\s+sederhana\b/i, ya: "gugatan-sederhana" },
    pengaju: {
      pilih: [
        ["lembaga-keuangan", /\b(?:Bank|BPR|BPRS|Koperasi|Pegadaian|Lembaga\s+Keuangan|PT\.?)\b[^.;]{0,60}\b(?:Penggugat|Pemohon)\b|\b(?:Penggugat|Pemohon)\b[^.;]{0,60}\b(?:Bank|BPR|BPRS|Koperasi|Pegadaian)\b/],
      ],
    },
    bentukWanprestasi: {
      jamak: true,
      pilih: [
        ["tidak-melakukan", /\btidak\s+(?:membayar|melunasi|melakukan\s+pembayaran)\b/i],
        ["terlambat", /\b(?:terlambat|menunggak|tunggakan|telat)\b/i],
      ],
    },
    jenisJaminan: {
      jamak: true,
      pilih: [
        ["tanah-bangunan", /\b(?:sertifikat|sertipikat|hak\s+tanggungan|SHM|SHGB)\b/i],
        ["kendaraan-fidusia", /\b(?:fidusia|BPKB)\b/i],
        ["penjamin-pribadi", /\b(?:penjamin|penanggung|borgtocht|personal\s+guarantee)\b/i],
        ["barang-gadai", /\b(?:gadai|rahn)\b/i],
      ],
    },
    teguran: {
      jamak: true,
      pilih: [
        ["surat-peringatan", /\b(?:surat\s+peringatan|somasi|teguran\s+tertulis)\b/i],
        ["kunjungan-penagihan", /\b(?:kunjungan|penagihan)\b/i],
        ["restrukturisasi", /\b(?:restrukturisasi|reschedul)/i],
      ],
    },
    tuntutanTambahan: {
      jamak: true,
      pilih: [
        ["denda-ganti-rugi", /\b(?:denda|ganti\s+rugi)\b/i],
        ["sita-jaminan", P.sitaJaminan],
        ["lelang-agunan", /\blelang\b/i],
        ["pengosongan", /\bpengosongan\b/i],
        ["uang-paksa", /\b(?:uang\s+paksa|dwangsom)\b/i],
        ["serta-merta", /\bserta[\s-]merta\b|\buitvoerbaar\b/i],
      ],
    },
    klausulaArbitrase: { pola: /\b(?:arbitrase|BASYARNAS)\b/i, ya: "ada" },
  },

  wasiat: {
    bentukWasiat: {
      pilih: [
        ["akta-notaris", /\bwasiat\b[^.;]{0,60}\bnotaris\b|\bnotaris\b[^.;]{0,60}\bwasiat\b/i],
        ["tertulis", /\bwasiat\s+(?:secara\s+)?tertulis\b|\bsurat\s+wasiat\b/i],
        ["lisan", /\bwasiat\s+(?:secara\s+)?lisan\b|\bberwasiat\s+(?:secara\s+)?lisan\b/i],
      ],
    },
    kondisiPewasiat: kondisiOrang("pewasiat"),
    pencabutan: { pola: /\b(?:mencabut|dicabut|pencabutan)\s+wasiat\b|\bwasiat\s+(?:telah\s+)?dicabut\b/i, ya: "dicabut" },
    jenisObjek: {
      jamak: true,
      pilih: [
        ["tanah-bangunan", P.tanah],
        ["uang-tabungan", P.uang],
        ["benda-bergerak", P.kendaraan],
        ["manfaat-hasil", /\b(?:manfaat|hasil\s+(?:kebun|sewa|panen))\b/i],
      ],
    },
    tuntutanTambahan: {
      jamak: true,
      pilih: [
        ["ganti-rugi", /\bganti\s+rugi\b/i],
        ["sita-jaminan", P.sitaJaminan],
        ["uang-paksa", /\b(?:uang\s+paksa|dwangsom)\b/i],
      ],
    },
    dalilCacat: {
      jamak: true,
      pilih: [
        ["tanda-tangan-dipalsukan", /\b(?:dipalsukan|pemalsuan|palsu)\b/i],
        ["ada-tekanan", /\b(?:tekanan|paksaan|dipaksa|diancam)\b/i],
        ["penerima-berbuat-jahat", /\b(?:membunuh|menganiaya|memfitnah)\b/i],
        ["objek-musnah", /\b(?:musnah|hancur|terbakar)\b/i],
      ],
    },
  },

  hibah: {
    bentukHibah: {
      pilih: [
        ["akta-ppat", /\b(?:PPAT|akta\s+hibah)\b/],
        ["tertulis", /\bhibah\s+(?:secara\s+)?tertulis\b|\bsurat\s+hibah\b/i],
        ["lisan", /\bhibah\s+(?:secara\s+)?lisan\b/i],
      ],
    },
    statusPenghibah: {
      pilih: [
        ["sudah-meninggal", /\b(?:penghibah|pemberi\s+hibah)\b[^.;]{0,30}\b(?:telah\s+)?(?:meninggal|wafat)\b|\balmarhum\b/i],
        ["masih-hidup", /\bpenghibah\b[^.;]{0,30}\bmasih\s+hidup\b/i],
      ],
    },
    kondisiPenghibah: kondisiOrang("penghibah"),
    jenisObjek: {
      jamak: true,
      pilih: [
        ["tanah-bangunan", P.tanah],
        ["kendaraan", P.kendaraan],
        ["uang-tabungan", P.uang],
      ],
    },
    sebabTarik: {
      jamak: true,
      pilih: [
        ["menelantarkan-penghibah", /\b(?:menelantarkan|mengabaikan)\b/i],
        ["menjual-atau-menjaminkan-objek", /\b(?:menjual|dijual|menjaminkan|dijaminkan|diagunkan)\b/i],
      ],
    },
    tuntutanTambahan: {
      jamak: true,
      pilih: [
        ["ganti-rugi", /\bganti\s+rugi\b/i],
        ["sita-jaminan", P.sitaJaminan],
        ["pengosongan", /\bpengosongan\b/i],
        ["uang-paksa", /\b(?:uang\s+paksa|dwangsom)\b/i],
      ],
    },
    dalilCacat: {
      jamak: true,
      pilih: [
        ["ada-paksaan", /\b(?:paksaan|dipaksa|diancam|tekanan)\b/i],
        ["tanda-tangan-dipalsukan", /\b(?:dipalsukan|pemalsuan|palsu)\b/i],
        ["tanpa-saksi", /\btanpa\s+(?:saksi|disaksikan)\b/i],
        ["belum-diserahkan", /\bbelum\s+(?:pernah\s+)?(?:diserahkan|diserahterimakan)\b/i],
        ["hibah-pura-pura", /\b(?:pura-pura|rekayasa)\b/i],
      ],
    },
  },

  wakaf: {
    bentukIkrar: {
      pilih: [
        ["akta-ikrar-wakaf", /\b(?:AIW|akta\s+ikrar\s+wakaf)\b/],
        ["tertulis", /\bikrar\s+(?:wakaf\s+)?(?:secara\s+)?tertulis\b/i],
        ["lisan", /\bikrar\s+(?:wakaf\s+)?(?:secara\s+)?lisan\b/i],
      ],
    },
    statusWakif: {
      pilih: [
        ["sudah-meninggal", /\bwakif\b[^.;]{0,30}\b(?:telah\s+)?(?:meninggal|wafat)\b|\balmarhum\b/i],
        ["masih-hidup", /\bwakif\b[^.;]{0,30}\bmasih\s+hidup\b/i],
      ],
    },
    kondisiWakif: {
      pilih: [
        ["sehat", /\b(?:dalam\s+keadaan\s+sehat|sehat\s+(?:jasmani|akal|walafiat))\b/i],
        ["akal-dipersoalkan", /\b(?:gila|tidak\s+waras|kurang\s+waras|pikun|tidak\s+cakap\s+hukum)\b/i],
      ],
    },
    jenisHarta: {
      jamak: true,
      pilih: [
        ["tanah-bangunan", P.tanah],
        ["benda-bergerak", P.kendaraan],
        ["uang", /\buang\s+tunai\b|\bwakaf\s+uang\b/i],
      ],
    },
    keadaanNazhir: {
      jamak: true,
      pilih: [
        ["tidak-amanah", /\bnaz[hi]ir\b[^.;]{0,60}\b(?:tidak\s+amanah|menyalahgunakan|menjual)\b/i],
        ["sudah-meninggal", /\bnaz[hi]ir\b[^.;]{0,30}\b(?:telah\s+)?(?:meninggal|wafat)\b/i],
        ["belum-terdaftar", /\bnaz[hi]ir\b[^.;]{0,60}\bbelum\s+(?:terdaftar|didaftarkan)\b/i],
      ],
    },
    pendaftaranWakaf: {
      pilih: [
        ["belum-terdaftar", /\bbelum\s+(?:terdaftar|didaftarkan|bersertifikat)\b/i],
        ["terdaftar", /\bsertifikat\s+wakaf\b|\bterdaftar\s+(?:di|pada)\s+(?:BWI|KUA|BPN|Kantor)\b/i],
      ],
    },
    dalilBatal: {
      jamak: true,
      pilih: [
        ["ikrar-tanpa-akta", /\btanpa\s+(?:akta|AIW)\b/i],
        ["tanpa-saksi", /\btanpa\s+(?:saksi|disaksikan)\b/i],
        ["bukan-milik-wakif", /\bbukan\s+(?:milik|hak)\s+wakif\b/i],
        ["tanda-tangan-dipalsukan", /\b(?:dipalsukan|pemalsuan|palsu)\b/i],
      ],
    },
    bentukPengalihan: {
      jamak: true,
      pilih: [
        ["dijual-dihibahkan", /\b(?:dijual|dihibahkan|menjual|menghibahkan)\b/i],
        ["dijaminkan", /\b(?:dijaminkan|diagunkan|menjaminkan)\b/i],
        ["ganti-rugi-pemerintah", /\bganti\s+rugi\b[^.;]{0,50}\bpemerintah\b/i],
      ],
    },
    tuntutanTambahan: {
      jamak: true,
      pilih: [
        ["ganti-rugi", /\bganti\s+rugi\b/i],
        ["sita-jaminan", P.sitaJaminan],
        ["pengosongan", /\bpengosongan\b/i],
        ["uang-paksa", /\b(?:uang\s+paksa|dwangsom)\b/i],
      ],
    },
  },

  "pembatalan-perkawinan": {
    kedudukanPengaju: { pola: /\bPenggugat\s+(?:adalah\s+)?(?:suami|istri|isteri)\b/i, ya: "suami-istri" },
    pencatatan: { pola: /\bbelum\s+(?:tercatat|dicatat|dicatatkan)\b|\btidak\s+tercatat\b/i, ya: "tidak-tercatat" },
    jenisLarangan: {
      pilih: [
        ["sesusuan", /\b(?:sesusuan|persusuan|saudara\s+sesusu)\b/i],
        ["semenda", /\b(?:semenda|mertua|menantu|anak\s+tiri)\b/i],
        ["nasab", /\b(?:saudara\s+kandung|sedarah|hubungan\s+darah|nasab)\b/i],
      ],
    },
  },

  perwalian: {
    pemohonWali: {
      pilih: [
        ["orang-tua-kandung", /\bPemohon\s+(?:adalah\s+)?(?:ayah|ibu|bapak)\s+kandung\b/i],
        ["keluarga-lain", /\bPemohon\b[^.;]{0,40}\b(?:nenek|kakek|paman|bibi|kakak|saudara)\b/i],
      ],
    },
    hartaAnak: { pola: /\b(?:harta|warisan|tabungan)\b[^.;]{0,60}\banak\b|\banak\b[^.;]{0,60}\b(?:harta|warisan|tabungan)\b/i, ya: "ada" },
  },

  "penunjukan-wali": {
    sebabWali: {
      jamak: true,
      pilih: [
        ["orang-tua-meninggal", /\b(?:orang\s+tua|ayah\s+dan\s+ibu|kedua\s+orang\s+tua)\b[^.;]{0,40}\bmeninggal\b/i],
        ["orang-tua-tidak-diketahui", /\b(?:orang\s+tua|ayah|ibu)\b[^.;]{0,40}\btidak\s+diketahui\b/i],
        ["orang-tua-tidak-mampu", /\b(?:orang\s+tua|ayah|ibu)\b[^.;]{0,40}\btidak\s+(?:cakap|mampu)\b/i],
        ["wali-dicabut", /\b(?:dicabut|pencabutan)\s+(?:kekuasaan\s+)?wali\b/i],
      ],
    },
    statusCalonWali: {
      pilih: [["menikah", /\bcalon\s+wali\b[^.;]{0,40}\b(?:menikah|telah\s+berkeluarga|suami|istri)\b/i]],
    },
    hartaAnak: { pola: /\b(?:harta|warisan|tabungan)\b[^.;]{0,60}\banak\b|\banak\b[^.;]{0,60}\b(?:harta|warisan|tabungan)\b/i, ya: "ada" },
    rekomendasiDinas: { pola: /\brekomendasi\b[^.;]{0,40}\bDinas\b|\bDinas\b[^.;]{0,40}\brekomendasi\b/i, ya: "ada" },
  },

  "penetapan-ahli-waris": {
    susunanAhliWaris: {
      pilih: [
        ["tanpa-anak", /\b(?:tidak|belum)\s+(?:mempunyai|memiliki|meninggalkan)\s+(?:seorang\s+)?anak\b/i],
        ["ada-anak", /\banak\s+(?:kandung\s+)?pewaris\b|\bmeninggalkan\b[^.;]{0,40}\banak\b/i],
      ],
    },
    pasanganPewaris: { pola: /\b(?:istri|isteri|suami)\s+(?:yang\s+)?(?:sah|pewaris)\b/i, ya: "ada" },
    statusPasangan: {
      pilih: [
        ["meninggal-lebih-dahulu", /\b(?:istri|isteri|suami)\b[^.;]{0,30}\bmeninggal(?:\s+dunia)?\s+(?:lebih|terlebih)\s+(?:dahulu|dulu)\b/i],
        ["bercerai", /\b(?:telah|sudah)\s+bercerai\b/i],
        ["masih-hidup", /\b(?:istri|isteri|suami)\b[^.;]{0,30}\bmasih\s+hidup\b/i],
      ],
    },
    jumlahPasangan: { pola: /\b(?:istri|isteri)\s+(?:kedua|ketiga|keempat)\b|\bpoligami\b|\bdua\s+orang\s+(?:istri|isteri)\b/i, ya: "lebih-dari-satu" },
    anakAngkat: { pola: /\banak\s+angkat\b/i, ya: "ada" },
    anakLuarNikah: { pola: /\banak\s+(?:di\s+)?luar\s+(?:nikah|perkawinan)\b/i, ya: "ada" },
    ahliWarisBelumDewasa: { pola: /\b(?:belum\s+dewasa|di\s+bawah\s+umur)\b/i, ya: "ada" },
    bedaAgama: { pola: /\b(?:non[- ]?muslim|beda\s+agama|berbeda\s+agama|murtad)\b/i, ya: "ada" },
    hutang: { pola: /\b(?:hutang|utang)\s+(?:pewaris|almarhum|almarhumah)\b|\bmeninggalkan\s+(?:hutang|utang)\b/i, ya: "ada" },
    asalHarta: {
      pilih: [
        ["dana-hak-pewaris", /\b(?:gaji|pensiun|tunjangan|asuransi|BPJS|dana\s+pensiun|taspen|jasa\s+raharja|santunan)\b/i],
        ["selama-perkawinan", /\bharta\s+bersama\b|\bselama\s+(?:perkawinan|pernikahan)\b/i],
        ["bawaan", /\bharta\s+bawaan\b/i],
      ],
    },
    tujuanPermohonan: {
      pilih: [
        ["pencairan-dana", /\b(?:pencairan|mencairkan|pengambilan|klaim)\s+(?:dana|tabungan|asuransi|pensiun|gaji|santunan)\b|\btaspen\b/i],
        ["tanah-aset", /\b(?:balik\s+nama|peralihan\s+hak|pendaftaran\s+tanah|sertifikat)\b/i],
      ],
    },
  },

  mafqud: {
    kedudukanPemohon: {
      pilih: [
        ["pasangan", /\bPemohon\s+(?:adalah\s+)?(?:istri|isteri|suami)\b/i],
        ["anak", /\bPemohon\s+(?:adalah\s+)?anak\b/i],
        ["saudara", /\bPemohon\s+(?:adalah\s+)?(?:saudara|kakak|adik)\b/i],
      ],
    },
    kepentinganLain: { pola: /\b(?:menikah|kawin)\s+(?:lagi|kembali)\b/i, ya: "kawin-kembali" },
    anakDitinggal: { pola: /\b(?:meninggalkan|dikaruniai|mempunyai)\s+(?:\w+\s+){0,3}anak\b/i, ya: "ada" },
    hartaDitinggal: { pola: /\bmeninggalkan\b[^.;]{0,40}\b(?:harta|tanah|rumah)\b/i, ya: "ada" },
  },

  "pengangkatan-anak": {
    hubunganPemohon: {
      pilih: [
        ["bukan-keluarga", /\b(?:tidak\s+(?:ada|memiliki|mempunyai)\s+hubungan\s+(?:keluarga|darah)|bukan\s+(?:keluarga|saudara))\b/i],
        ["keluarga", /\banak\s+(?:dari\s+)?(?:saudara|adik|kakak|keponakan|sepupu|kemenakan)\b/i],
      ],
    },
    pemohonPerkawinan: {
      pilih: [["berdua", /\bPemohon\s+I\s+dan\s+Pemohon\s+II\b|\bsuami\s+istri\b/i]],
    },
    orangTuaKandung: {
      pilih: [
        ["kedua-meninggal", /\b(?:orang\s+tua\s+kandung|ayah\s+dan\s+ibu)\b[^.;]{0,40}\bmeninggal\b/i],
        ["tidak-diketahui", /\b(?:orang\s+tua\s+kandung)\b[^.;]{0,40}\btidak\s+diketahui\b|\bditemukan\b|\bdibuang\b/i],
      ],
    },
    anakKandungPemohon: {
      pilih: [
        ["belum-ada", /\b(?:belum|tidak)\s+(?:dikaruniai|memiliki|mempunyai)\s+(?:seorang\s+)?(?:anak|keturunan)\b/i],
        ["ada", /\bdikaruniai\s+\d|\bmempunyai\s+(?:\w+\s+)?orang\s+anak\b/i],
      ],
    },
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// Fungsi kustom
// ──────────────────────────────────────────────────────────────────────────────

/** Umur anak dari kalimat "anak ... berumur N tahun": semua >= 12 -> sudah; semua < 12 -> belum; campur -> tidak diusulkan. */
function umurAnak(kalimat) {
  const umur = [];
  let dari = null;
  for (const k of kalimat) {
    if (!/\banak\b/i.test(k.teks)) continue;
    const re = /\b(?:berumur|berusia|umur|usia)\s+(\d{1,2})\s+(?:\([a-z\s]+\)\s+)?tahun\b/gi;
    let m;
    while ((m = re.exec(k.teks))) {
      umur.push(Number(m[1]));
      dari = dari || k;
    }
  }
  if (!umur.length) return null;
  if (umur.every((u) => u >= 12)) return { nilai: "sudah", kalimat: dari };
  if (umur.every((u) => u < 12)) return { nilai: "belum", kalimat: dari };
  return null;
}

/** Bentuk itsbat: alur 15 = gugatan (pasangan meninggal bila posita menyebutnya), "Pemohon I dan Pemohon II" = berdua, alur 16 selain itu = sendiri. */
function bentukItsbat(kalimat, konteks) {
  const alur = String((konteks && konteks.alur) || "").trim();
  const berdua = cari(kalimat, P.berdua).ada;
  const meninggal = cari(kalimat, /\b(?:suami|istri|isteri|pasangan)\b[^.;]{0,30}\b(?:telah\s+)?(?:meninggal|wafat)\b/i).ada;
  if (alur === "15") return meninggal ? { nilai: "gugatan-pasangan-meninggal", kalimat: meninggal } : { nilai: "gugatan", kalimat: kalimat[0] || null };
  if (berdua) return { nilai: "permohonan-berdua", kalimat: berdua };
  if (alur === "16") return { nilai: "permohonan-sendiri", kalimat: kalimat[0] || null };
  return null;
}

const FUNGSI = Object.freeze({ umurAnak, bentukItsbat });

// ──────────────────────────────────────────────────────────────────────────────
// Gerbang keyakinan (diisi data U3 oleh rantai D; kosong = semua "ragu")
// ──────────────────────────────────────────────────────────────────────────────

let cacheGerbang = null;
function muatGerbang(luar) {
  if (luar) return luar;
  if (cacheGerbang) return cacheGerbang;
  try {
    cacheGerbang = JSON.parse(fs.readFileSync(BERKAS_GERBANG, "utf8"));
  } catch {
    cacheGerbang = { kode: {} };
  }
  return cacheGerbang;
}

/**
 * "cukup" hanya bila gerbang mencatat isian itu pada jenis perkara itu: n >= 30 dan presisi >= 0,95 dan status "otomatis".
 * Selain itu "ragu".
 */
function keyakinanGerbang(kunciKatalog, kunciKeadaan, jenisPerkaraId, gerbangLuar) {
  const G = muatGerbang(gerbangLuar);
  const e = (G.kode || {})[`${kunciKatalog}.${kunciKeadaan}`];
  const d = e && e.perJenis && jenisPerkaraId ? e.perJenis[String(jenisPerkaraId)] : e;
  if (d && d.status === "otomatis" && Number(d.n) >= 30 && Number(d.presisi) >= 0.95) return "cukup";
  return "ragu";
}

// ──────────────────────────────────────────────────────────────────────────────
// Penurunan
// ──────────────────────────────────────────────────────────────────────────────

const potong = (t) => String(t || "").slice(0, 260);

function hitungSatu(kalimat, def, konteks) {
  if (def.fn) {
    const f = FUNGSI[def.fn];
    const r = f ? f(kalimat, konteks) : null;
    return r && r.nilai ? { nilai: r.nilai, kalimat: r.kalimat } : null;
  }
  if (def.pola) {
    const c = cari(kalimat, def.pola);
    if (c.ada) return { nilai: def.ya, kalimat: c.ada };
    if (c.sangkal && def.tidak) return { nilai: def.tidak, kalimat: c.sangkal };
    return null;
  }
  const kena = [];
  for (const [nilai, pola] of def.pilih || []) {
    const c = cari(kalimat, pola);
    if (c.ada) kena.push({ nilai, kalimat: c.ada });
  }
  if (!kena.length) return null;
  if (def.jamak) return { nilai: kena.map((x) => x.nilai), kalimat: kena[0].kalimat, rincian: kena };
  if (new Set(kena.map((x) => x.nilai)).size > 1) return null;
  return kena[0];
}

/**
 * Saran keadaan untuk satu katalog.
 * @param {{kunciKatalog: string, posita?: string, petitum?: string, alur?: string, jenisPerkaraId?: string|number}} masukan
 * @param {{gerbang?: object, nilaiSah?: Record<string, string[]>}} [opsi]
 * @returns {{ok: boolean, kunciKatalog: string, saran: Array<{kunci: string, nilai: string|string[], jamak: boolean, yakin: "ragu"|"cukup", sumber: "posita"|"petitum", kalimat: string, catatan: string}>}}
 */
function turunkanKeadaan(masukan, opsi) {
  const m = masukan || {};
  const o = opsi || {};
  const kunciKatalog = String(m.kunciKatalog || "").trim();
  const aturan = ATURAN[kunciKatalog];
  const hasil = { ok: true, kunciKatalog, saran: [] };
  if (!aturan) return hasil;
  const dari = (teks, sumber) => pecahKalimat(teks).map((t) => ({ teks: t, sumber }));
  const kalimatPosita = dari(m.posita, "posita");
  const kalimatPetitum = dari(m.petitum, "petitum");
  const semua = kalimatPosita.concat(kalimatPetitum).filter((k) => !adaAleta(k.teks));
  const konteks = { alur: m.alur };
  for (const [kunci, def] of Object.entries(aturan)) {
    const r = hitungSatu(semua, def, konteks);
    if (!r) continue;
    const nilai = r.nilai;
    if (o.nilaiSah && o.nilaiSah[kunci]) {
      const sah = new Set(o.nilaiSah[kunci]);
      if (![].concat(nilai).every((v) => sah.has(v))) continue;
    }
    const sumber = r.kalimat && r.kalimat.sumber === "petitum" ? "petitum" : "posita";
    hasil.saran.push({
      kunci,
      nilai,
      jamak: Array.isArray(nilai),
      yakin: keyakinanGerbang(kunciKatalog, kunci, m.jenisPerkaraId, o.gerbang),
      sumber,
      kalimat: potong(r.kalimat && r.kalimat.teks),
      catatan: `Dibaca dari ${sumber === "petitum" ? "petitum" : "posita"}; belum dikuatkan saksi - periksa sebelum dipakai.`,
    });
  }
  return hasil;
}

module.exports = { turunkanKeadaan, keyakinanGerbang, pecahKalimat, cari, ATURAN, BERKAS_GERBANG };
