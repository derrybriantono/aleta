"use strict";

/**
 * ============================================================================
 * MUTU PUTUSAN DAN PERSIDANGAN - BAB 10 KATALOG
 * ============================================================================
 *
 * Empat belas dari enam belas butir. Dua sisanya sengaja tidak disambungkan,
 * dan sebabnya disebutkan di bawah supaya tidak ada yang menyambungkannya
 * dengan angka yang dikarang.
 *
 * ============================================================================
 * MP01 DAN MP05 TIDAK PUNYA SUMBER - DIPERIKSA, BUKAN DIDUGA
 * ============================================================================
 *
 * MP01 meminta "panjang uraian dan kepadatan rujukan peraturan" pada
 * PERTIMBANGAN HUKUM. SIPP tidak menyimpan pertimbangan hukum. Yang
 * disimpannya kolom amar_putusan, dan isinya diktum saja - diperiksa pada
 * 388 putusan satu tahun: TIDAK SATU PUN memuat kata Pasal, Undang-Undang,
 * KHI, atau Peraturan. Itu bukan cacat putusannya; memang begitulah bentuk
 * amar. Pertimbangannya ada di dalam berkas putusan yang tersimpan sebagai
 * dokumen (amar_putusan_dok), dan dokumen itu tidak dapat dibaca dari sini.
 *
 * Menyambungkan MP01 ke panjang amar akan menghasilkan angka yang naik turun
 * dengan meyakinkan dan menjawab pertanyaan yang sama sekali lain.
 *
 * MP05 meminta hasil eksaminasi putusan. Tidak ada satu pun tabel eksaminasi
 * pada SIPP satuan kerja ini - eksaminasi dikerjakan di luar aplikasi.
 *
 * ============================================================================
 * DUA BUTIR MEMBACA TEKS, DAN TEKS ITU RAPUH
 * ============================================================================
 *
 * MP04 (nafkah, iddah, mut'ah) dan MP10 (kesepakatan mediasi) dihitung dengan
 * mencari kata pada teks yang diketik manusia. Katalog sudah menyebut MP04
 * "rapuh", dan kalimat itu harus ikut sampai ke layar - putusan yang menyebut
 * "nafkah 'iddah" dengan ejaan lain akan luput, dan tidak ada yang tahu.
 *
 * Keduanya karena itu bernada BERTANYA, bukan menuduh. Yang tidak memenuhi
 * disebut "belum ditemukan pada teks amar", bukan "tidak diputus".
 *
 * ============================================================================
 * YANG DITEMUKAN SAAT MENGUKUR - DUA-DUANYA NYATA
 * ============================================================================
 *
 * Pertama: dari 53 cerai talak yang dikabulkan, hanya 19 amarnya menyebut
 * nafkah, iddah, atau mut'ah. Pasal 149 Kompilasi Hukum Islam meletakkan
 * kewajiban itu pada suami yang menjatuhkan talak, dan hakim
 * mempertimbangkannya secara ex officio. Tiga puluh empat putusan pantas
 * ditanyakan - bukan disalahkan, sebab teks amarnya bisa saja memakai kata
 * lain.
 *
 * Angkanya sempat terbaca 22 ketika diukur dengan pola pencarian yang lebih
 * longgar - pola itu memuat penggalan "mut" tanpa pembatas, sehingga kata
 * lain yang memuatnya ikut terhitung. Pola yang dipakai di bawah lebih ketat,
 * dan 19 itulah angka yang benar. Selisih tiga pada butir yang RAPUH persis
 * seperti ini adalah alasan mengapa hasil ukurnya harus dibaca, bukan
 * dipercaya.
 *
 * Kedua: dari 28 mediasi yang dicatat BERHASIL, empat isi kesepakatannya
 * ketikan asal - deretan huruf tanpa makna yang diketik supaya borang mau
 * disimpan. Kolom wajib yang diisi sembarang lebih buruk daripada kolom
 * kosong: kolom kosong terlihat, sedangkan "sudah terisi" tidak.
 */

const db = require("../db_config");
const kerangka = require("./kerangkaPenilaianService");
const sippSkemaService = require("./sippSkemaService");

const BATAS_BARIS = 5000;

/** Asas penyelesaian perkara pada peradilan tingkat pertama. */
const HARI_ASAS_PENYELESAIAN = 150;

/**
 * Berapa banyak persidangan dalam satu perkara yang sudah pantas ditanyakan.
 * Diukur pada SIPP sungguhan: dari 388 perkara yang diputus, yang terbanyak
 * memakai sembilan kali sidang.
 */
const AMBANG_JUMLAH_SIDANG = 12;

/**
 * Seberapa lazim sebuah amar harus muncul pada jenis perkaranya sebelum ia
 * berhenti dianggap luar biasa. Lima persen, dan hanya berlaku pada jenis
 * perkara yang punya cukup banyak putusan untuk dapat dibandingkan.
 */
const AMBANG_KELAZIMAN_AMAR = 0.05;
const MINIMAL_PUTUSAN_SEJENIS = 10;

/**
 * Kata terpanjang yang masih masuk akal pada kalimat Indonesia. Di atas ini
 * hampir pasti deretan huruf yang diketik asal - "pertanggungjawabannya"
 * saja hanya 21 huruf.
 */
const BATAS_KATA_TERPANJANG = 25;

/** Berapa simpangan baku dari rerata yang menandai bulan benar-benar meleset. */
const LEBAR_BATAS_KENDALI = 3;

/** Nilai kondisi penanganan perkara yang masih dianggap sehat. */
const AMBANG_NILAI_KONDISI = 70;

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, hasil) => {
      if (error) reject(error);
      else resolve(Array.isArray(hasil) ? hasil : []);
    });
  });
}

const teks = (n) => String(n == null ? "" : n).trim();
const angka = (n) => {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
};

function tanggalTerisi(nilai) {
  const t = teks(nilai);
  if (!t) return false;
  if (/^0000-00-00/.test(t)) return false;
  return true;
}

/** Selisih hari antara dua tanggal; null bila salah satunya tidak terisi. */
function selisihHari(awal, akhir) {
  if (!tanggalTerisi(awal) || !tanggalTerisi(akhir)) return null;
  const a = new Date(awal);
  const b = new Date(akhir);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b - a) / 86400000);
}

/** Membuang tanda HTML dan entitasnya, menyisakan kalimatnya saja. */
function polos(html) {
  return teks(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Berapa butir sebuah daftar HTML memuat.
 *
 * SIPP menyimpan amar dan petitum sebagai <ol><li>. Bila penandanya tidak ada,
 * dicoba baris yang diawali angka - sebagian petitum diketik sebagai teks
 * biasa bernomor.
 */
function jumlahButirDaftar(html) {
  const t = teks(html);
  if (!t) return 0;
  const li = t.match(/<li\b/gi);
  if (li) return li.length;
  const bernomor = t.split(/\r?\n|<br\s*\/?>/i).filter((x) => /^\s*\d+\s*[.)]/.test(x));
  if (bernomor.length) return bernomor.length;
  return polos(t) ? 1 : 0;
}

/**
 * Apakah sebuah isian tampak diketik asal.
 *
 * Ditemukan pada SIPP sungguhan - dua isi kesepakatan perdamaian berbunyi
 * "woiduhweigyuvuisdhrtdghf6723tyw8..." dan "Hsjxbcifbjdjzbdicbanixbskxjwbdon
 * xmalk fkkqkdixjsjsi". Keduanya lolos tiap pemeriksaan "sudah terisi".
 *
 * Dua tanda dipakai bersama, sebab masing-masing sendirian meleset: kalimat
 * pendek yang sah ada ("Kedua pihak sepakat berdamai"), dan kata panjang yang
 * sah juga ada. Yang tidak ada kalimat yang sekaligus terlalu pendek DAN
 * memuat kata sepanjang itu.
 */
function tampakKetikanAsal(html) {
  const isi = polos(html);
  if (!isi) return true;
  const kata = isi.split(" ").filter(Boolean);
  if (kata.length < 4) return true;
  const terpanjang = kata.reduce((a, k) => Math.max(a, k.length), 0);
  return terpanjang >= BATAS_KATA_TERPANJANG;
}

async function tabelSiap(daftar) {
  for (const t of daftar) {
    const ada = await sippSkemaService.tabelAda(t).catch(() => false);
    if (!ada) return false;
  }
  return true;
}

/**
 * Satu pemuat untuk seluruh butir yang bersandar pada putusan.
 *
 * Sembilan butir di berkas ini membutuhkan gabungan yang sama - perkara,
 * putusannya, status amarnya, jumlah sidangnya. Menulis gabungan itu sembilan
 * kali berarti sembilan tempat yang harus diperbaiki ketika satu saja
 * saringannya berubah, dan pada perbaikan pertama seseorang akan lupa yang
 * kedelapan.
 *
 * Nama status amar diambil dari tabel status_putusan lewat id. Kolom
 * status_putusan_nama pada perkara_putusan TIDAK dapat dipakai: diperiksa pada
 * SIPP satuan kerja ini, kolom itu kosong pada seluruh 388 putusan sementara
 * status_putusan_id-nya terisi lengkap.
 */
async function muatPutusan(rentang) {
  return runQuery(
    `SELECT p.perkara_id          AS perkaraId,
            p.nomor_perkara       AS nomorPerkara,
            p.jenis_perkara_nama  AS jenisPerkara,
            p.tanggal_pendaftaran AS tanggalDaftar,
            p.petitum             AS petitum,
            d.tanggal_putusan     AS tanggalPutusan,
            d.tanggal_minutasi    AS tanggalMinutasi,
            d.tanggal_bht         AS tanggalBht,
            d.amar_putusan        AS amar,
            d.status_putusan_id   AS statusId,
            s.nama                AS statusNama,
            (SELECT COUNT(*) FROM perkara_jadwal_sidang j
              WHERE j.perkara_id = p.perkara_id)               AS jumlahSidang,
            (SELECT COUNT(*) FROM perkara_jadwal_sidang j
              WHERE j.perkara_id = p.perkara_id AND j.ditunda = 'Y') AS jumlahTunda
       FROM perkara p
       JOIN perkara_putusan d ON d.perkara_id = p.perkara_id
       LEFT JOIN status_putusan s ON s.id = d.status_putusan_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
        AND d.tanggal_putusan IS NOT NULL
        AND d.tanggal_putusan <> '0000-00-00'
      ORDER BY d.tanggal_putusan
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );
}

/** Amar yang mengabulkan - hanya di sini amar wajib menjawab tiap petitum. */
function amarMengabulkan(statusNama) {
  return /kabul/i.test(teks(statusNama));
}

/**
 * ============================================================================
 * MP02 - KESESUAIAN PETITUM DENGAN AMAR
 * ============================================================================
 *
 * Hanya putusan yang MENGABULKAN yang dinilai. Pada putusan yang menolak,
 * menyatakan tidak dapat diterima, mencabut, atau menggugurkan, amar memang
 * tidak menjawab petitum satu per satu - dan menghitungnya gagal berarti
 * menuduh majelis lalai atas sesuatu yang justru benar.
 *
 * Yang dibandingkan JUMLAH butirnya, bukan maknanya. Amar dengan butir lebih
 * sedikit daripada petitum berarti ada tuntutan yang tidak terjawab, atau
 * beberapa tuntutan dijawab dalam satu butir - keduanya pantas dibuka
 * berkasnya. Yang membaca maknanya harus manusia.
 */
async function barisKesesuaianPetitumAmar(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan"]))) return [];
  const hasil = await muatPutusan(rentang);

  return hasil
    .filter((x) => amarMengabulkan(x.statusNama))
    .map((x) => {
      const butirPetitum = jumlahButirDaftar(x.petitum);
      const butirAmar = jumlahButirDaftar(x.amar);
      const cukup = butirAmar > 0 && butirAmar >= butirPetitum;

      return {
        kunci: `${teks(x.nomorPerkara)}#MP02`,
        nomorPerkara: teks(x.nomorPerkara),
        jenisPerkara: teks(x.jenisPerkara),
        butirPetitum,
        butirAmar,
        memenuhi: cukup,
        sebabTidakMemenuhi: cukup
          ? ""
          : `petitum ${butirPetitum} butir sedangkan amar ${butirAmar} butir - ada tuntutan yang belum menemukan padanannya, atau beberapa dijawab sekaligus dalam satu butir`,
      };
    });
}

/**
 * ============================================================================
 * MP03 - KEAJEKAN AMAR ANTAR MAJELIS
 * ============================================================================
 *
 * Katalog menyebutnya "untuk ditanyakan, bukan diseragamkan", dan itu harus
 * dipegang. Perkara yang tampak serupa pada kolom jenis_perkara_nama dapat
 * berbeda seluruhnya di dalam berkasnya, dan hakim yang memutus berbeda dari
 * kelaziman bukan hakim yang keliru - kadang justru sebaliknya.
 *
 * Yang ditandai karena itu amar yang LANGKA pada jenis perkaranya, dan hanya
 * pada jenis yang punya cukup putusan untuk dapat dibandingkan. Jenis dengan
 * kurang dari sepuluh putusan dikeluarkan dari populasi: pada lima perkara,
 * tiap amar tampak langka.
 */
async function barisKeajekanAmar(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan"]))) return [];
  const hasil = await muatPutusan(rentang);

  const perJenis = new Map();
  hasil.forEach((x) => {
    const j = teks(x.jenisPerkara) || "(tanpa jenis)";
    if (!perJenis.has(j)) perJenis.set(j, { total: 0, status: new Map() });
    const s = perJenis.get(j);
    s.total += 1;
    const st = teks(x.statusNama) || "(tanpa status)";
    s.status.set(st, (s.status.get(st) || 0) + 1);
  });

  return hasil
    .filter((x) => {
      const s = perJenis.get(teks(x.jenisPerkara) || "(tanpa jenis)");
      return s && s.total >= MINIMAL_PUTUSAN_SEJENIS;
    })
    .map((x) => {
      const jenis = teks(x.jenisPerkara) || "(tanpa jenis)";
      const s = perJenis.get(jenis);
      const st = teks(x.statusNama) || "(tanpa status)";
      const jumlah = s.status.get(st) || 0;
      const bagian = jumlah / s.total;
      const lazim = bagian >= AMBANG_KELAZIMAN_AMAR;

      return {
        kunci: `${teks(x.nomorPerkara)}#MP03`,
        nomorPerkara: teks(x.nomorPerkara),
        jenisPerkara: jenis,
        statusAmar: st,
        bagianJenis: Number((bagian * 100).toFixed(1)),
        memenuhi: lazim,
        sebabTidakMemenuhi: lazim
          ? ""
          : `amar "${st}" hanya muncul ${jumlah} kali dari ${s.total} putusan ${jenis} - untuk ditanyakan, bukan untuk diseragamkan`,
      };
    });
}

/**
 * ============================================================================
 * MP04 - AMAR NAFKAH, IDDAH, DAN MUT'AH
 * ============================================================================
 *
 * Pasal 149 Kompilasi Hukum Islam meletakkan nafkah iddah dan mut'ah pada
 * suami yang menjatuhkan talak, dan hakim mempertimbangkannya secara ex
 * officio meskipun istri tidak menuntutnya.
 *
 * Diukur pada SIPP sungguhan: dari 53 cerai talak yang dikabulkan, 19 amarnya
 * menyebut salah satu kata itu. Tiga puluh empat sisanya PANTAS DITANYAKAN -
 * bukan disalahkan. Butir ini membaca teks yang diketik manusia, dan ejaan
 * yang lain akan luput tanpa ada yang tahu.
 */
const KATA_NAFKAH = /(nafkah|iddah|'iddah|idah|mut'?ah|mutah|madliyah|madhiyah|kiswah|maskan)/i;

async function barisAmarNafkah(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan"]))) return [];
  const hasil = await muatPutusan(rentang);

  return hasil
    .filter((x) => /talak/i.test(teks(x.jenisPerkara)) && amarMengabulkan(x.statusNama))
    .map((x) => {
      const ada = KATA_NAFKAH.test(polos(x.amar));

      return {
        kunci: `${teks(x.nomorPerkara)}#MP04`,
        nomorPerkara: teks(x.nomorPerkara),
        jenisPerkara: teks(x.jenisPerkara),
        memenuhi: ada,
        sebabTidakMemenuhi: ada
          ? ""
          : "kata nafkah, iddah, atau mut'ah belum ditemukan pada teks amarnya - dihitung dari pencarian kata, jadi ejaan lain dapat luput; berkasnya perlu dibuka sebelum disimpulkan",
      };
    });
}

/**
 * ============================================================================
 * MP06 - POLA PENUNDAAN PERSIDANGAN
 * ============================================================================
 *
 * alasan_ditunda adalah ruas teks bebas, dan katalog mewajibkannya
 * dikelompokkan. Tanpa pengelompokan, "Panggil Tergugat", "panggil tergugat",
 * dan "Panggil Tergugat " menjadi tiga pola berbeda, dan papan pola penundaan
 * akan memuat ratusan baris yang tidak dapat dibaca siapa pun.
 *
 * Yang dinilai apakah alasannya jatuh ke salah satu golongan yang dikenali.
 * Alasan yang tidak dikenali bukan alasan yang salah - ia alasan yang belum
 * punya golongan, dan daftar golongannya memang harus bertambah.
 *
 * Diukur pada SIPP sungguhan: 427 sidang ditunda, dan alasan terbanyaknya
 * "Panggil Tergugat" (144), "Mediasi Para pihak" (60), "Panggil Termohon" (35).
 */
const GOLONGAN_PENUNDAAN = [
  { nama: "pemanggilan pihak", pola: /panggil|relaas|ghaib|gaib/i },
  { nama: "mediasi", pola: /mediasi|damai|perdamaian/i },
  { nama: "jawaban dan replik duplik", pola: /jawab|replik|duplik|eksepsi/i },
  { nama: "pembuktian", pola: /bukti|saksi|sumpah|pemeriksaan setempat|descente/i },
  { nama: "kesimpulan", pola: /kesimpulan/i },
  { nama: "pembacaan putusan atau penetapan", pola: /putusan|penetapan|ikrar/i },
  { nama: "pihak tidak hadir", pola: /tidak hadir|belum hadir|absen/i },
  { nama: "keadaan majelis atau kantor", pola: /hakim|majelis|dinas|libur|cuti|sakit/i },
];

function golongkanPenundaan(alasan) {
  const t = polos(alasan);
  if (!t) return "";
  const cocok = GOLONGAN_PENUNDAAN.find((g) => g.pola.test(t));
  return cocok ? cocok.nama : "";
}

async function barisPolaPenundaan(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_jadwal_sidang"]))) return [];

  const hasil = await runQuery(
    `SELECT j.id                AS sidangId,
            p.nomor_perkara     AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            j.tanggal_sidang    AS tanggalSidang,
            j.alasan_ditunda    AS alasan
       FROM perkara p
       JOIN perkara_jadwal_sidang j ON j.perkara_id = p.perkara_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
        AND j.ditunda = 'Y'
      ORDER BY j.tanggal_sidang
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const golongan = golongkanPenundaan(x.alasan);
    const isi = polos(x.alasan);

    return {
      kunci: `tunda-${teks(x.sidangId)}`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      golongan,
      memenuhi: Boolean(golongan),
      sebabTidakMemenuhi: golongan
        ? ""
        : isi
        ? `alasan "${isi.slice(0, 60)}" belum punya golongan - daftar golongannya yang perlu bertambah, bukan alasannya yang salah`
        : "ditunda tanpa menyebut alasan",
    };
  });
}

/**
 * ============================================================================
 * MP07 - JUMLAH PERSIDANGAN PER PERKARA
 * ============================================================================
 *
 * Terlalu banyak sidang berarti perkara berlarut; NOL sidang pada perkara yang
 * sudah diputus berarti jadwalnya tidak pernah diinput - dan perkara semacam
 * itu membuat seluruh hitungan lama persidangan meleset ke bawah.
 *
 * Diukur pada SIPP sungguhan: 388 perkara diputus, sidang terbanyak sembilan
 * kali, dan tidak satu pun diputus tanpa sidang.
 */
async function barisJumlahPersidangan(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan", "perkara_jadwal_sidang"]))) return [];
  const hasil = await muatPutusan(rentang);

  return hasil.map((x) => {
    const n = angka(x.jumlahSidang);
    const sebab = [];
    if (n === 0) sebab.push("diputus tanpa satu pun jadwal sidang tercatat - jadwalnya tidak pernah diinput");
    else if (n > AMBANG_JUMLAH_SIDANG) {
      sebab.push(`${n} kali sidang, melampaui ambang ${AMBANG_JUMLAH_SIDANG}`);
    }

    return {
      kunci: `${teks(x.nomorPerkara)}#MP07`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      jumlahSidang: n,
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.join("; "),
    };
  });
}

/**
 * ============================================================================
 * MP08 - KEHADIRAN PARA PIHAK DI PERSIDANGAN
 * ============================================================================
 *
 * dihadiri_oleh menyimpan siapa yang hadir pada sidang itu. Kolom yang kosong
 * berarti kehadirannya tidak tercatat - dan verstek, yang seluruhnya bersandar
 * pada catatan ketidakhadiran tergugat, tidak dapat diperiksa pada sidang yang
 * kolomnya kosong.
 *
 * Diukur pada SIPP sungguhan: 907 sidang, 848 mencatat kehadiran, 59 kosong.
 */
async function barisKehadiranPihak(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_jadwal_sidang"]))) return [];

  const hasil = await runQuery(
    `SELECT j.id                 AS sidangId,
            p.nomor_perkara      AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara,
            j.tanggal_sidang     AS tanggalSidang,
            j.dihadiri_oleh      AS dihadiriOleh
       FROM perkara p
       JOIN perkara_jadwal_sidang j ON j.perkara_id = p.perkara_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
      ORDER BY j.tanggal_sidang
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const ada = x.dihadiriOleh !== null && x.dihadiriOleh !== undefined && teks(x.dihadiriOleh) !== "";

    return {
      kunci: `hadir-${teks(x.sidangId)}`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      memenuhi: ada,
      sebabTidakMemenuhi: ada
        ? ""
        : "kehadiran para pihak pada sidang ini tidak tercatat - verstek tidak dapat diperiksa dari sidang yang kolom kehadirannya kosong",
    };
  });
}

/**
 * ============================================================================
 * MP09 - PELAKSANAAN MEDIASI DAN HASILNYA
 * ============================================================================
 *
 * PERMA Nomor 1 Tahun 2016 mewajibkan mediator melaporkan hasil mediasi
 * kepada majelis. Baris mediasi yang berhenti pada penunjukan mediator - tanpa
 * tanggal keputusan, tanpa hasil, tanpa laporan - tidak dapat membuktikan
 * mediasinya pernah selesai.
 *
 * Diukur pada SIPP sungguhan: 68 mediasi, seluruhnya punya penetapan mediator
 * dan tanggal mulai, 65 punya keputusan beserta hasil dan laporannya.
 */
async function barisPelaksanaanMediasi(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_mediasi"]))) return [];

  const hasil = await runQuery(
    `SELECT m.mediasi_id                    AS mediasiId,
            p.nomor_perkara                 AS nomorPerkara,
            p.jenis_perkara_nama            AS jenisPerkara,
            m.penetapan_penunjukan_mediator AS penetapan,
            m.mediator_text                 AS mediator,
            m.dimulai_mediasi               AS dimulai,
            m.keputusan_mediasi             AS keputusan,
            m.hasil_mediasi                 AS hasil,
            m.tgl_laporan_mediator          AS laporan
       FROM perkara p
       JOIN perkara_mediasi m ON m.perkara_id = p.perkara_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
      ORDER BY m.penetapan_penunjukan_mediator
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const sebab = [];
    if (!tanggalTerisi(x.penetapan)) sebab.push("tanpa tanggal penetapan penunjukan mediator");
    if (!teks(x.mediator)) sebab.push("tanpa nama mediator");
    if (!tanggalTerisi(x.dimulai)) sebab.push("tanpa tanggal mulai mediasi");
    if (!tanggalTerisi(x.keputusan)) sebab.push("tanpa tanggal keputusan mediasi");
    if (!teks(x.hasil)) sebab.push("tanpa hasil mediasi");
    if (!tanggalTerisi(x.laporan)) sebab.push("tanpa tanggal laporan mediator");

    return {
      kunci: `mediasi-${teks(x.mediasiId)}`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      mediator: teks(x.mediator),
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.join("; "),
    };
  });
}

/**
 * ============================================================================
 * MP10 - KESEPAKATAN MEDIASI TERCERMIN PADA AKHIR PERKARA
 * ============================================================================
 *
 * Kode hasil_mediasi TIDAK ditebak. Artinya dibaca dari borang SIPP sendiri -
 * application/views/perkara_tab/tab_mediasi_edit2.php, tempat kodenya
 * ditawarkan kepada petugas:
 *
 *   Y1  Berhasil Dengan Akta Perdamaian
 *   Y2  Berhasil Dengan Pencabutan
 *   S   Berhasil Sebagian
 *   T   Tidak Berhasil
 *   D   Tidak Dapat Dilaksanakan
 *
 * Populasinya karena itu ketiga kode BERHASIL, bukan "baris yang isi
 * kesepakatannya terisi". Pada SIPP yang diukur keduanya kebetulan sama
 * jumlahnya - 28 baris - tetapi keduanya bukan hal yang sama: mediasi yang
 * berhasil TANPA isi kesepakatan justru temuan, dan definisi yang bersandar
 * pada isian akan diam-diam mengeluarkannya dari populasi.
 *
 * Kode itu juga menentukan akhir yang selaras, dan tiap kode berbeda:
 *
 *   Y1  harus ada akta perdamaian - putusannya berstatus Perdamaian
 *   Y2  harus ada pencabutan - tanggal cabut atau status Dicabut
 *   S   akhir perkaranya TIDAK ditentukan - lihat catatan di bawah
 *
 * Menyamakan ketiganya - misalnya menuntut pencabutan pada Y1 - akan
 * menghasilkan temuan palsu atas perkara yang justru ditangani dengan benar.
 *
 * Isi kesepakatannya ikut diperiksa apakah tampak diketik asal. Diukur pada
 * SIPP sungguhan: 1 Y1, 18 Y2, 9 S, dan EMPAT di antaranya isi kesepakatannya
 * deretan huruf tanpa makna:
 *
 *   "Hsjxbcifbjdjzbdicbanixbskxjwbdonxmalk fkkqkdixjsjsi"
 *   "gfsghfdshagcvjhsdzgfvdjzgfjhsdzgvdzgsdfghdfhdfhdfhjnhnnnnnnnn..."
 *   "woiduhweigyuvuisdhrtdghf6723tyw8we78wef87wer8gh9rherhg8..."
 *   "sdqwedqwdqwdqwdqwdqwdqwdquiodf0oqejf0owjheoifhwer0ohgwo..."
 *
 * Sempat terbaca dua ketika hanya delapan baris pertamanya dilihat. Empat
 * itulah angka yang benar - dan selisihnya muncul justru karena hasil ukurnya
 * dibuka seluruhnya, bukan disampel.
 */

/** Kode hasil mediasi yang berarti berhasil, beserta akhir yang selaras. */
const HASIL_MEDIASI_BERHASIL = {
  Y1: {
    sebutan: "berhasil dengan akta perdamaian",
    selaras: (k) => /damai/i.test(k.status) || k.adaAkta,
    tuntutan: "putusan berstatus Perdamaian atau akta perdamaian bertanggal",
  },
  Y2: {
    sebutan: "berhasil dengan pencabutan",
    selaras: (k) => /cabut/i.test(k.status) || k.adaCabut,
    tuntutan: "perkaranya dicabut",
  },
  S: {
    sebutan: "berhasil sebagian",
    // Berhasil sebagian TIDAK menentukan akhir perkara: sisanya tetap
    // diperiksa, dan pada saat lembar audit dijalankan perkaranya boleh saja
    // masih berjalan. Sempat ditulis menuntut perkaranya sudah diputus, dan
    // itu menandai satu perkara yang justru berjalan sebagaimana mestinya -
    // temuan palsu yang akan membuat pengawas membuka berkas tanpa sebab.
    //
    // Yang tersisa untuk dinilai pada kode ini hanya isi kesepakatannya.
    selaras: () => true,
    tuntutan: "tidak ada akhir tertentu yang dituntut oleh kode ini",
  },
};
async function barisKesepakatanMediasiAmar(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_mediasi"]))) return [];

  const hasil = await runQuery(
    `SELECT m.mediasi_id                     AS mediasiId,
            p.nomor_perkara                  AS nomorPerkara,
            p.jenis_perkara_nama             AS jenisPerkara,
            m.isi_kesepakatan_perdamaian     AS isiKesepakatan,
            m.hasil_mediasi                  AS hasilMediasi,
            m.akta_perdamaian                AS aktaPerdamaian,
            d.tanggal_cabut                  AS tanggalCabut,
            s.nama                           AS statusNama
       FROM perkara p
       JOIN perkara_mediasi m ON m.perkara_id = p.perkara_id
       LEFT JOIN perkara_putusan d ON d.perkara_id = p.perkara_id
       LEFT JOIN status_putusan s ON s.id = d.status_putusan_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
        AND m.hasil_mediasi IN ('Y1', 'Y2', 'S')
      ORDER BY p.nomor_perkara
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  return hasil.map((x) => {
    const status = teks(x.statusNama);
    const kode = teks(x.hasilMediasi).toUpperCase();
    const aturan = HASIL_MEDIASI_BERHASIL[kode];
    const keadaan = {
      status,
      adaAkta: tanggalTerisi(x.aktaPerdamaian),
      adaCabut: tanggalTerisi(x.tanggalCabut),
    };
    const sebab = [];

    if (!teks(x.isiKesepakatan)) {
      sebab.push(
        `dicatat ${aturan ? aturan.sebutan : "berhasil"} tetapi isi kesepakatannya kosong - kesepakatan yang tidak tertulis tidak dapat dibandingkan dengan apa pun`
      );
    } else if (tampakKetikanAsal(x.isiKesepakatan)) {
      sebab.push(
        "isi kesepakatannya tidak terbaca sebagai kalimat - kolom wajib yang diisi sembarang lebih buruk daripada kolom kosong, sebab yang kosong terlihat"
      );
    }

    if (aturan && !aturan.selaras(keadaan)) {
      sebab.push(
        `dicatat ${aturan.sebutan} tetapi perkaranya berakhir "${
          status || "belum diputus"
        }" - semestinya ${aturan.tuntutan}`
      );
    }

    return {
      kunci: `sepakat-${teks(x.mediasiId)}`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      hasilMediasi: aturan ? aturan.sebutan : kode,
      statusAkhir: status,
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.join("; "),
    };
  });
}

/**
 * ============================================================================
 * MP11 - PRAKIRAAN WAKTU PENYELESAIAN
 * ============================================================================
 *
 * Prakiraan disusun dari sebaran perkara SEJENIS yang sudah diputus. Jenis
 * perkara yang hanya punya beberapa putusan tidak dapat menghasilkan prakiraan
 * yang berarti - satu perkara waris yang berlarut dua tahun akan menjadi
 * "prakiraan" bagi tiap perkara waris berikutnya.
 *
 * Diukur pada SIPP sungguhan: Cerai Gugat 280 perkara dan Cerai Talak 91
 * punya sebaran yang cukup; Kewarisan 1, P3HP 5, dan Harta Bersama 8 tidak.
 * Lama penyelesaiannya 6 sampai 139 hari, rerata 23.
 */
async function barisPrakiraanWaktu(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan"]))) return [];
  const hasil = await muatPutusan(rentang);

  const perJenis = new Map();
  hasil.forEach((x) => {
    const j = teks(x.jenisPerkara) || "(tanpa jenis)";
    perJenis.set(j, (perJenis.get(j) || 0) + 1);
  });

  return hasil.map((x) => {
    const jenis = teks(x.jenisPerkara) || "(tanpa jenis)";
    const sejenis = perJenis.get(jenis) || 0;
    const lama = selisihHari(x.tanggalDaftar, x.tanggalPutusan);
    const sebab = [];

    if (sejenis < MINIMAL_PUTUSAN_SEJENIS) {
      sebab.push(
        `hanya ${sejenis} putusan ${jenis} pada rentang ini - terlalu sedikit untuk menjadi sebaran prakiraan`
      );
    }
    if (lama === null) sebab.push("lama penyelesaiannya tidak dapat dihitung");
    else if (lama < 0) sebab.push(`tanggal putusan mendahului pendaftaran (${lama} hari)`);

    return {
      kunci: `${teks(x.nomorPerkara)}#MP11`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: jenis,
      lamaHari: lama,
      putusanSejenis: sejenis,
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.join("; "),
    };
  });
}

/**
 * ============================================================================
 * MP12 - PETA KENDALI MUTU PENYELESAIAN
 * ============================================================================
 *
 * Peta kendali menandai bulan yang benar-benar menyimpang, bukan tiap bulan
 * yang di atas rerata. Setengah dari bulan mana pun selalu berada di atas
 * reratanya sendiri; papan yang menandai semuanya akan berhenti dibaca pada
 * bulan ketiga.
 *
 * Batasnya rerata ditambah dan dikurangi tiga simpangan baku antar bulan.
 * Rentang yang hanya memuat satu atau dua bulan tidak menghasilkan simpangan
 * baku yang berarti, dan pada keadaan itu tidak ada baris yang dipulangkan -
 * bukan seluruh bulan dinyatakan terkendali.
 */
async function barisPetaKendali(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan"]))) return [];
  const hasil = await muatPutusan(rentang);

  const perBulan = new Map();
  hasil.forEach((x) => {
    const lama = selisihHari(x.tanggalDaftar, x.tanggalPutusan);
    if (lama === null || lama < 0) return;
    // WAJIB lewat bulanDari(). Penggerak MySQL memulangkan DATE sebagai objek
    // Date, dan String(Date).slice(0, 7) menghasilkan "Wed Jan" - bulan yang
    // terpecah menurut HARI DALAM PEKAN. Tertangkap saat mengukur: peta kendali
    // memulangkan 38 "bulan" untuk rentang satu tahun.
    const b = bulanDari(x.tanggalPutusan);
    if (!perBulan.has(b)) perBulan.set(b, []);
    perBulan.get(b).push(lama);
  });

  const bulan = [...perBulan.entries()]
    .map(([nama, daftar]) => ({
      nama,
      jumlah: daftar.length,
      rerata: daftar.reduce((a, c) => a + c, 0) / daftar.length,
    }))
    .sort((a, b) => a.nama.localeCompare(b.nama));

  if (bulan.length < 3) return [];

  const semua = bulan.map((b) => b.rerata);
  const pusat = semua.reduce((a, c) => a + c, 0) / semua.length;
  const ragam = semua.reduce((a, c) => a + (c - pusat) ** 2, 0) / semua.length;
  const simpangan = Math.sqrt(ragam);
  const atas = pusat + LEBAR_BATAS_KENDALI * simpangan;
  const bawah = Math.max(0, pusat - LEBAR_BATAS_KENDALI * simpangan);

  return bulan.map((b) => {
    const lewat = b.rerata > atas || b.rerata < bawah;

    return {
      kunci: `kendali-${b.nama}`,
      bulan: b.nama,
      jumlahPutusan: b.jumlah,
      rerataHari: Number(b.rerata.toFixed(1)),
      batasAtas: Number(atas.toFixed(1)),
      batasBawah: Number(bawah.toFixed(1)),
      memenuhi: !lewat,
      sebabTidakMemenuhi: lewat
        ? `rerata ${b.rerata.toFixed(1)} hari berada di luar batas kendali ${bawah.toFixed(
            1
          )} sampai ${atas.toFixed(1)} - bulan ini benar-benar menyimpang, bukan sekadar di atas rerata`
        : "",
    };
  });
}

/** Nama bulan dari tanggal apa pun bentuknya, termasuk objek Date. */
function bulanDari(nilai) {
  if (nilai instanceof Date && !Number.isNaN(nilai.getTime())) {
    return `${nilai.getFullYear()}-${String(nilai.getMonth() + 1).padStart(2, "0")}`;
  }
  return teks(nilai).slice(0, 7);
}

/**
 * ============================================================================
 * MP13 - CORONG TAHAPAN PERKARA
 * ============================================================================
 *
 * Corong yang dinilai bukan "apakah tiap perkara sudah sampai ujungnya" -
 * perkara yang baru didaftarkan kemarin memang belum diputus, dan menghitungnya
 * gagal berarti menghukum pengadilan karena waktu belum berjalan.
 *
 * Yang dinilai apakah ada tahapan yang TERLEWATI: tahapan belakang sudah
 * bertanggal sementara tahapan di depannya kosong. Berkas yang sudah masuk
 * arsip tetapi tidak pernah punya tanggal putusan berarti salah satu catatannya
 * hilang, dan itu tidak akan ketahuan dari mana pun.
 *
 * Diukur pada SIPP sungguhan: 388 putusan, 388 berminutasi, 228 berkekuatan
 * hukum tetap, dan 259 tercatat masuk arsip - lewat tautan NOMOR perkara.
 * Lewat perkara_id hanya 3 yang terlihat, dan angka itu sempat ditulis di
 * sini sebagai kenyataan.
 */
const URUTAN_TAHAPAN = [
  { nama: "pendaftaran", ruas: "tanggalDaftar" },
  { nama: "penetapan majelis", ruas: "tanggalMajelis" },
  { nama: "sidang pertama", ruas: "tanggalSidangPertama" },
  { nama: "putusan", ruas: "tanggalPutusan" },
  { nama: "minutasi", ruas: "tanggalMinutasi" },
  { nama: "berkekuatan hukum tetap", ruas: "tanggalBht" },
  { nama: "masuk arsip", ruas: "tanggalArsip" },
];

async function muatTahapan(rentang) {
  return runQuery(
    `SELECT p.nomor_perkara       AS nomorPerkara,
            p.jenis_perkara_nama  AS jenisPerkara,
            p.tanggal_pendaftaran AS tanggalDaftar,
            (SELECT MIN(h.tanggal_penetapan) FROM perkara_hakim_pn h
              WHERE h.perkara_id = p.perkara_id)              AS tanggalMajelis,
            (SELECT MIN(j.tanggal_sidang) FROM perkara_jadwal_sidang j
              WHERE j.perkara_id = p.perkara_id)              AS tanggalSidangPertama,
            d.tanggal_putusan     AS tanggalPutusan,
            d.tanggal_minutasi    AS tanggalMinutasi,
            d.tanggal_bht         AS tanggalBht,
            -- Arsip ditautkan lewat NOMOR dengan titik di ujung dibuang: perkara_id
            -- pada tabel arsip nol pada 275 dari 279 baris. Lewat perkara_id,
            -- corong dan kronologi hanya melihat empat berkas yang diarsipkan.
            (SELECT MIN(a.tanggal_masuk_arsip) FROM arsip a
              WHERE p.nomor_perkara = TRIM(TRAILING '.' FROM TRIM(a.nomor_perkara))) AS tanggalArsip
       FROM perkara p
       LEFT JOIN perkara_putusan d ON d.perkara_id = p.perkara_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
      ORDER BY p.tanggal_pendaftaran
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );
}

async function barisCorongTahapan(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_hakim_pn", "perkara_jadwal_sidang"]))) return [];
  const hasil = await muatTahapan(rentang);

  return hasil.map((x) => {
    const terisi = URUTAN_TAHAPAN.map((t) => tanggalTerisi(x[t.ruas]));
    const terjauh = terisi.lastIndexOf(true);
    const terlewat = [];
    for (let i = 0; i <= terjauh; i += 1) {
      if (!terisi[i]) terlewat.push(URUTAN_TAHAPAN[i].nama);
    }

    return {
      kunci: `${teks(x.nomorPerkara)}#MP13`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      tahapanTerjauh: terjauh >= 0 ? URUTAN_TAHAPAN[terjauh].nama : "(belum satu pun)",
      memenuhi: terlewat.length === 0,
      sebabTidakMemenuhi: terlewat.length
        ? `sudah sampai tahap ${
            URUTAN_TAHAPAN[terjauh].nama
          } tetapi tahapan sebelumnya kosong: ${terlewat.join(", ")}`
        : "",
    };
  });
}

/**
 * ============================================================================
 * MP16 - KRONOLOGI LENGKAP PERKARA
 * ============================================================================
 *
 * Deret waktu perkara harus maju. Tanggal yang mundur berarti salah ketik
 * tahun atau bulan, dan salah ketik semacam itu tidak pernah menampakkan
 * dirinya sendiri - tanggalnya tetap tanggal yang sah, dan tiap laporan yang
 * memakainya tetap terbaca masuk akal.
 *
 * Berbeda dari MP13 yang memeriksa tahapan mana yang KOSONG, butir ini
 * memeriksa URUTAN tanggal yang sudah terisi.
 */
async function barisKronologiPerkara(rentang) {
  if (!(await tabelSiap(["perkara"]))) return [];
  const hasil = await muatTahapan(rentang);

  return hasil.map((x) => {
    const titik = URUTAN_TAHAPAN.filter((t) => tanggalTerisi(x[t.ruas])).map((t) => ({
      nama: t.nama,
      tanggal: x[t.ruas],
    }));
    const mundur = [];
    for (let i = 1; i < titik.length; i += 1) {
      const jarak = selisihHari(titik[i - 1].tanggal, titik[i].tanggal);
      if (jarak !== null && jarak < 0) {
        mundur.push(`${titik[i].nama} mendahului ${titik[i - 1].nama} sejauh ${Math.abs(jarak)} hari`);
      }
    }

    return {
      kunci: `${teks(x.nomorPerkara)}#MP16`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      jumlahPeristiwa: titik.length,
      memenuhi: mundur.length === 0,
      sebabTidakMemenuhi: mundur.join("; "),
    };
  });
}

/**
 * ============================================================================
 * MP14 - NILAI KONDISI PENANGANAN PERKARA
 * ============================================================================
 *
 * Satu angka gabungan dari lima hal yang masing-masing sudah dinilai butir
 * lain. Gunanya bukan menambah keterangan baru melainkan menyusun antrean:
 * perkara mana yang paling perlu dibuka lebih dulu ketika waktunya hanya cukup
 * untuk sepuluh berkas.
 *
 * Bobotnya ditulis terbuka di bawah, dan itu disengaja. Nilai gabungan yang
 * bobotnya tersembunyi di dalam kueri akan dipercaya orang tanpa pernah dapat
 * diperiksa - dan ketika ada yang keberatan atas nilainya, tidak ada yang
 * dapat menunjukkan dari mana angkanya datang.
 *
 * Ini nilai KONDISI PENANGANAN, bukan nilai hakimnya. Perkara yang berlarut
 * karena pihaknya ghaib bukan perkara yang salah ditangani.
 */
const BOBOT_KONDISI = [
  { nama: "umur perkara", bobot: 30 },
  { nama: "penundaan sidang", bobot: 20 },
  { nama: "kelengkapan amar", bobot: 20 },
  { nama: "ketepatan minutasi", bobot: 20 },
  { nama: "jumlah persidangan", bobot: 10 },
];

/** Tenggang minutasi berkas perkara sesudah putusan diucapkan. */
const HARI_TENGGANG_MINUTASI = 14;

async function barisNilaiKondisi(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan"]))) return [];
  const hasil = await muatPutusan(rentang);

  return hasil.map((x) => {
    const lama = selisihHari(x.tanggalDaftar, x.tanggalPutusan);
    const jarakMinutasi = selisihHari(x.tanggalPutusan, x.tanggalMinutasi);
    const sidang = angka(x.jumlahSidang);
    const tunda = angka(x.jumlahTunda);

    let nilai = 0;
    const rinci = [];

    // Umur perkara terhadap asas lima bulan.
    const bagianUmur =
      lama === null ? 0 : Math.max(0, 1 - Math.max(0, lama) / HARI_ASAS_PENYELESAIAN);
    nilai += bagianUmur * 30;
    if (bagianUmur < 0.5) rinci.push(`umur ${lama} hari terhadap asas ${HARI_ASAS_PENYELESAIAN} hari`);

    // Penundaan terhadap jumlah sidangnya sendiri.
    const bagianTunda = sidang === 0 ? 0 : Math.max(0, 1 - tunda / Math.max(sidang, 1));
    nilai += bagianTunda * 20;
    if (bagianTunda < 0.5) rinci.push(`${tunda} dari ${sidang} sidang ditunda`);

    // Amar terisi.
    const adaAmar = Boolean(polos(x.amar));
    nilai += adaAmar ? 20 : 0;
    if (!adaAmar) rinci.push("amar putusannya kosong");

    // Minutasi tepat waktu.
    const minutasiTepat = jarakMinutasi !== null && jarakMinutasi >= 0 && jarakMinutasi <= HARI_TENGGANG_MINUTASI;
    nilai += minutasiTepat ? 20 : 0;
    if (!minutasiTepat) {
      rinci.push(
        jarakMinutasi === null
          ? "belum diminutasi"
          : `minutasi ${jarakMinutasi} hari sesudah putusan, tenggangnya ${HARI_TENGGANG_MINUTASI} hari`
      );
    }

    // Jumlah persidangan wajar.
    const sidangWajar = sidang > 0 && sidang <= AMBANG_JUMLAH_SIDANG;
    nilai += sidangWajar ? 10 : 0;
    if (!sidangWajar) rinci.push(`${sidang} kali sidang`);

    const bulat = Math.round(nilai);
    const sehat = bulat >= AMBANG_NILAI_KONDISI;

    return {
      kunci: `${teks(x.nomorPerkara)}#MP14`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      nilaiKondisi: bulat,
      memenuhi: sehat,
      sebabTidakMemenuhi: sehat
        ? ""
        : `nilai kondisi ${bulat} dari 100, di bawah ambang ${AMBANG_NILAI_KONDISI} - ${rinci.join(
            "; "
          )}. Ini nilai penanganan perkaranya, bukan nilai majelisnya.`,
    };
  });
}

/**
 * ============================================================================
 * MP15 - RISIKO MELAMPAUI LIMA BULAN
 * ============================================================================
 *
 * Dugaan, dan ditulis sebagai dugaan. Yang dihitung hanya dua hal yang benar-
 * benar diketahui: berapa lama perkara sudah berjalan, dan apakah ia masih
 * punya jadwal sidang. Perkara yang sudah melewati dua pertiga tenggangnya
 * berisiko; perkara tanpa jadwal sidang berisiko berapa pun umurnya, sebab
 * ia tidak akan bergerak sendiri.
 *
 * Tidak ada peluang yang dihitung dan tidak ada persentase yang disebutkan.
 * Angka peluang pada perkara yang belum selesai akan dikutip orang seolah-olah
 * ia hasil pengukuran.
 *
 * ============================================================================
 * UMURNYA DIHITUNG SAMPAI AKHIR RENTANG, DAN ITU PERLU DISADARI
 * ============================================================================
 *
 * Umur perkara diukur dari pendaftaran sampai AKHIR RENTANG penilaian, bukan
 * sampai hari ini. Itu memang yang benar - penilaian bulan Maret harus
 * menjawab keadaan bulan Maret, bukan keadaan hari ketika laporannya dibuka.
 *
 * Akibatnya butir ini hampir selalu penuh pada rentang bulanan (perkara yang
 * didaftarkan tanggal 1 belum berumur lima bulan pada tanggal 31), dan baru
 * berbicara pada rentang triwulan atau tahunan. Itu bukan cacat; itu memang
 * pertanyaannya - risiko melampaui lima bulan tidak dapat ditanyakan atas
 * perkara yang baru berumur tiga minggu.
 *
 * Diukur pada SIPP sungguhan dengan rentang satu tahun penuh: 43 perkara
 * belum diputus, seluruhnya masih berjadwal sidang, dan seluruhnya sudah
 * melampaui 150 hari terhitung sampai 31 Desember - sehingga butirnya
 * memulangkan 0 dari 43.
 *
 * Angka nol itu benar, dan sebabnya perlu ikut dibaca: salinan SIPP yang
 * dipakai mengukur berhenti pada 21 Agustus, sehingga tidak ada perkara yang
 * didaftarkan pada triwulan terakhir untuk mengimbanginya. Pada data satu
 * tahun yang utuh, perkara yang didaftarkan November dan Desember akan masuk
 * populasi ini dengan umur di bawah tenggang.
 */
const BAGIAN_TENGGANG_WASPADA = 2 / 3;

async function barisRisikoLimaBulan(rentang) {
  if (!(await tabelSiap(["perkara", "perkara_putusan", "perkara_jadwal_sidang"]))) return [];

  const hasil = await runQuery(
    `SELECT p.nomor_perkara       AS nomorPerkara,
            p.jenis_perkara_nama  AS jenisPerkara,
            p.tanggal_pendaftaran AS tanggalDaftar,
            MAX(j.tanggal_sidang) AS sidangTerakhir,
            COUNT(j.id)           AS jumlahSidang
       FROM perkara p
       LEFT JOIN perkara_putusan d
              ON d.perkara_id = p.perkara_id
             AND d.tanggal_putusan IS NOT NULL
             AND d.tanggal_putusan <> '0000-00-00'
       LEFT JOIN perkara_jadwal_sidang j ON j.perkara_id = p.perkara_id
      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
        AND d.perkara_id IS NULL
      GROUP BY p.perkara_id, p.nomor_perkara, p.jenis_perkara_nama, p.tanggal_pendaftaran
      ORDER BY p.tanggal_pendaftaran
      LIMIT ${BATAS_BARIS}`,
    [rentang.mulai, rentang.selesai]
  );

  const batas = rentang.selesai;
  const waspada = Math.round(HARI_ASAS_PENYELESAIAN * BAGIAN_TENGGANG_WASPADA);

  return hasil.map((x) => {
    const umur = selisihHari(x.tanggalDaftar, batas);
    const berjadwal = angka(x.jumlahSidang) > 0 && tanggalTerisi(x.sidangTerakhir);
    const sebab = [];

    if (umur !== null && umur >= HARI_ASAS_PENYELESAIAN) {
      sebab.push(`sudah ${umur} hari berjalan - asas ${HARI_ASAS_PENYELESAIAN} hari terlampaui`);
    } else if (umur !== null && umur >= waspada) {
      sebab.push(`sudah ${umur} hari berjalan, melewati dua pertiga tenggang ${HARI_ASAS_PENYELESAIAN} hari`);
    }
    if (!berjadwal) sebab.push("tidak punya jadwal sidang - perkara ini tidak akan bergerak sendiri");

    return {
      kunci: `${teks(x.nomorPerkara)}#MP15`,
      nomorPerkara: teks(x.nomorPerkara),
      jenisPerkara: teks(x.jenisPerkara),
      umurHari: umur,
      memenuhi: sebab.length === 0,
      sebabTidakMemenuhi: sebab.length ? `dugaan, bukan pengukuran - ${sebab.join("; ")}` : "",
    };
  });
}

/** Empat belas butir Bab 10 yang punya sumber di SIPP. */
const BUTIR = [
  {
    kode: "MP02",
    kunci: "kesesuaianPetitumAmar",
    judul: "Kesesuaian Petitum dengan Amar Putusan",
    keterangan:
      "Jumlah butir amar dibandingkan jumlah butir petitum, hanya pada putusan yang mengabulkan. Pada putusan yang menolak, mencabut, atau menyatakan tidak dapat diterima, amar memang tidak menjawab petitum satu per satu - menghitungnya gagal berarti menuduh majelis lalai atas sesuatu yang justru benar. Yang dibandingkan jumlahnya, bukan maknanya; yang membaca maknanya harus manusia.",
    baris: barisKesesuaianPetitumAmar,
    pembilang: "Putusan yang butir amarnya tidak kurang dari butir petitumnya",
    penyebut: "Putusan yang mengabulkan atas perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_putusan dan status_putusan lewat status_putusan_id",
    ruas: "petitum, amar_putusan, status_putusan_id",
  },
  {
    kode: "MP03",
    kunci: "keajekanAmarAntarMajelis",
    judul: "Keajekan Amar Antar Majelis",
    keterangan:
      "Amar yang langka pada jenis perkaranya - untuk ditanyakan, bukan untuk diseragamkan. Perkara yang tampak serupa pada kolom jenis perkara dapat berbeda seluruhnya di dalam berkasnya, dan hakim yang memutus berbeda dari kelaziman bukan hakim yang keliru. Jenis perkara dengan kurang dari sepuluh putusan dikeluarkan: pada lima perkara, tiap amar tampak langka.",
    baris: barisKeajekanAmar,
    pembilang: `Putusan yang amarnya meliputi sekurangnya ${(AMBANG_KELAZIMAN_AMAR * 100).toFixed(
      0
    )}% putusan sejenis`,
    penyebut: `Putusan atas jenis perkara yang punya sekurangnya ${MINIMAL_PUTUSAN_SEJENIS} putusan pada rentang ini`,
    tabel: "perkara disambung perkara_putusan dan status_putusan, dikelompokkan menurut jenis perkara",
    ruas: "jenis_perkara_nama, status_putusan_id",
  },
  {
    kode: "MP04",
    kunci: "amarNafkahIddahMutah",
    judul: "Amar Nafkah, Iddah, dan Mut'ah",
    keterangan:
      "Cerai talak yang dikabulkan tetapi amarnya belum menyebut nafkah, iddah, atau mut'ah. Pasal 149 Kompilasi Hukum Islam meletakkan kewajiban itu pada suami yang menjatuhkan talak, dan hakim mempertimbangkannya secara ex officio. RAPUH - dihitung dari pencarian kata pada teks amar, sehingga ejaan lain akan luput. Yang tidak memenuhi berarti pantas ditanyakan, bukan terbukti keliru.",
    baris: barisAmarNafkah,
    pembilang: "Putusan cerai talak yang dikabulkan dan amarnya menyebut nafkah, iddah, atau mut'ah",
    penyebut: "Seluruh cerai talak yang dikabulkan atas perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_putusan dan status_putusan, disaring jenis perkara mengandung talak",
    ruas: "jenis_perkara_nama, amar_putusan, status_putusan_id",
  },
  {
    kode: "MP06",
    kunci: "polaPenundaanSidang",
    judul: "Pola Penundaan Persidangan",
    keterangan:
      "Alasan penundaan adalah ruas teks bebas, dan tanpa pengelompokan papan polanya akan memuat ratusan baris yang tidak dapat dibaca siapa pun. Yang dinilai apakah alasannya jatuh ke salah satu golongan yang dikenali. Alasan yang tidak dikenali bukan alasan yang salah - ia alasan yang belum punya golongan, dan daftar golongannya yang perlu bertambah.",
    baris: barisPolaPenundaan,
    pembilang: "Penundaan yang alasannya masuk salah satu golongan yang dikenali",
    penyebut: "Seluruh persidangan yang ditunda atas perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_jadwal_sidang lewat perkara_id, disaring ditunda = Y",
    ruas: "ditunda, alasan_ditunda",
  },
  {
    kode: "MP07",
    kunci: "jumlahPersidanganPerkara",
    judul: "Jumlah Persidangan per Perkara",
    keterangan: `Perkara yang butuh lebih dari ${AMBANG_JUMLAH_SIDANG} kali sidang, dan perkara yang diputus tanpa satu pun jadwal sidang tercatat. Yang kedua lebih berbahaya daripada yang pertama: perkara tanpa jadwal membuat seluruh hitungan lama persidangan meleset ke bawah, dan tidak ada yang menyadarinya.`,
    baris: barisJumlahPersidangan,
    pembilang: `Perkara diputus yang jumlah sidangnya antara satu dan ${AMBANG_JUMLAH_SIDANG}`,
    penyebut: "Seluruh perkara yang didaftarkan pada rentang ini dan sudah diputus",
    tabel: "perkara disambung perkara_putusan, dengan hitungan dari perkara_jadwal_sidang",
    ruas: "tanggal_putusan, tanggal_sidang",
  },
  {
    kode: "MP08",
    kunci: "kehadiranParaPihakSidang",
    judul: "Kehadiran Para Pihak di Persidangan",
    keterangan:
      "Persidangan yang tidak mencatat siapa yang hadir. Verstek seluruhnya bersandar pada catatan ketidakhadiran tergugat - dan pada sidang yang kolom kehadirannya kosong, verstek tidak dapat diperiksa oleh siapa pun.",
    baris: barisKehadiranPihak,
    pembilang: "Persidangan yang mencatat kehadiran para pihak",
    penyebut: "Seluruh persidangan atas perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_jadwal_sidang lewat perkara_id",
    ruas: "dihadiri_oleh, tanggal_sidang",
  },
  {
    kode: "MP09",
    kunci: "pelaksanaanMediasiHasil",
    judul: "Pelaksanaan Mediasi dan Hasilnya",
    keterangan:
      "PERMA Nomor 1 Tahun 2016 mewajibkan mediator melaporkan hasil mediasi kepada majelis. Baris mediasi yang berhenti pada penunjukan mediator - tanpa tanggal keputusan, tanpa hasil, tanpa laporan - tidak dapat membuktikan mediasinya pernah selesai.",
    baris: barisPelaksanaanMediasi,
    pembilang: "Mediasi yang lengkap dari penetapan mediator sampai laporan mediatornya",
    penyebut: "Seluruh baris mediasi atas perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_mediasi lewat perkara_id",
    ruas: "penetapan_penunjukan_mediator, mediator_text, dimulai_mediasi, keputusan_mediasi, hasil_mediasi, tgl_laporan_mediator",
  },
  {
    kode: "MP10",
    kunci: "kesepakatanMediasiSelarasAmar",
    judul: "Kesesuaian Kesepakatan Mediasi dengan Amar",
    keterangan:
      "Mediasi yang berhasil harus berujung salah satu dari dua hal: perkaranya dicabut, atau kesepakatannya dikuatkan menjadi akta perdamaian. Kesepakatan yang tercatat tetapi perkaranya tetap berjalan sampai putusan biasa berarti salah satu dari dua catatan itu keliru. Isi kesepakatannya ikut diperiksa apakah tampak diketik asal - kolom wajib yang diisi sembarang lebih buruk daripada kolom kosong, sebab yang kosong terlihat.",
    baris: barisKesepakatanMediasiAmar,
    pembilang: "Kesepakatan yang isinya terbaca sebagai kalimat dan perkaranya berakhir dicabut atau berdamai",
    penyebut: "Seluruh mediasi pada rentang ini yang isi kesepakatan perdamaiannya terisi",
    tabel: "perkara disambung perkara_mediasi, perkara_putusan, dan status_putusan",
    ruas: "isi_kesepakatan_perdamaian, akta_perdamaian, tanggal_cabut, status_putusan_id",
  },
  {
    kode: "MP11",
    kunci: "prakiraanWaktuPenyelesaian",
    judul: "Prakiraan Waktu Penyelesaian Perkara",
    keterangan: `Prakiraan disusun dari sebaran perkara sejenis yang sudah diputus. Jenis perkara dengan kurang dari ${MINIMAL_PUTUSAN_SEJENIS} putusan tidak dapat menghasilkan prakiraan yang berarti - satu perkara waris yang berlarut dua tahun akan menjadi prakiraan bagi tiap perkara waris berikutnya.`,
    baris: barisPrakiraanWaktu,
    pembilang: `Putusan yang lama penyelesaiannya terhitung wajar dan jenisnya punya sekurangnya ${MINIMAL_PUTUSAN_SEJENIS} putusan sebaran`,
    penyebut: "Seluruh perkara yang didaftarkan pada rentang ini dan sudah diputus",
    tabel: "perkara disambung perkara_putusan, dikelompokkan menurut jenis perkara",
    ruas: "tanggal_pendaftaran, tanggal_putusan, jenis_perkara_nama",
  },
  {
    kode: "MP12",
    kunci: "petaKendaliMutuPenyelesaian",
    judul: "Peta Kendali Mutu Penyelesaian",
    keterangan: `Bulan yang rerata lama penyelesaiannya keluar dari batas kendali - rerata seluruh bulan ditambah dan dikurangi ${LEBAR_BATAS_KENDALI} simpangan baku. Hanya bulan yang benar-benar menyimpang yang ditandai: setengah dari bulan mana pun selalu berada di atas reratanya sendiri, dan papan yang menandai semuanya berhenti dibaca pada bulan ketiga.`,
    baris: barisPetaKendali,
    pembilang: "Bulan yang rerata lama penyelesaiannya berada di dalam batas kendali",
    penyebut: "Seluruh bulan pada rentang ini yang memuat putusan, bila rentangnya sekurangnya tiga bulan",
    tabel: "perkara disambung perkara_putusan, dikelompokkan menurut bulan putusan",
    ruas: "tanggal_pendaftaran, tanggal_putusan",
  },
  {
    kode: "MP13",
    kunci: "corongTahapanPerkara",
    judul: "Corong Tahapan Perkara",
    keterangan:
      "Tahapan yang terlewati: tahapan belakang sudah bertanggal sementara tahapan di depannya kosong. Yang dinilai BUKAN apakah tiap perkara sudah sampai ujungnya - perkara yang baru didaftarkan kemarin memang belum diputus, dan menghitungnya gagal berarti menghukum pengadilan karena waktu belum berjalan.",
    baris: barisCorongTahapan,
    pembilang: "Perkara yang seluruh tahapan sebelum tahapan terjauhnya sudah bertanggal",
    penyebut: "Seluruh perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_hakim_pn, perkara_jadwal_sidang, perkara_putusan, dan arsip",
    ruas: "tanggal_pendaftaran, tanggal_penetapan, tanggal_sidang, tanggal_putusan, tanggal_minutasi, tanggal_bht, tanggal_masuk_arsip",
  },
  {
    kode: "MP14",
    kunci: "nilaiKondisiPenangananPerkara",
    judul: "Nilai Kondisi Penanganan Perkara",
    keterangan: `Satu angka gabungan dari lima hal: umur perkara (30), penundaan sidang (20), kelengkapan amar (20), ketepatan minutasi (20), dan jumlah persidangan (10). Gunanya menyusun antrean - perkara mana yang paling perlu dibuka lebih dulu ketika waktunya hanya cukup untuk sepuluh berkas. Ini nilai KONDISI PENANGANAN, bukan nilai hakimnya: perkara yang berlarut karena pihaknya ghaib bukan perkara yang salah ditangani.`,
    baris: barisNilaiKondisi,
    pembilang: `Perkara yang nilai kondisinya sekurangnya ${AMBANG_NILAI_KONDISI} dari 100`,
    penyebut: "Seluruh perkara yang didaftarkan pada rentang ini dan sudah diputus",
    tabel: "perkara disambung perkara_putusan, dengan hitungan sidang dan penundaan dari perkara_jadwal_sidang",
    ruas: "tanggal_pendaftaran, tanggal_putusan, tanggal_minutasi, amar_putusan, tanggal_sidang, ditunda",
  },
  {
    kode: "MP15",
    kunci: "risikoLampauiLimaBulan",
    judul: "Indeks Risiko Melampaui Lima Bulan",
    keterangan: `Dugaan, dan ditulis sebagai dugaan. Dihitung dari dua hal yang benar-benar diketahui: berapa lama perkara sudah berjalan terhadap asas ${HARI_ASAS_PENYELESAIAN} hari, dan apakah ia masih punya jadwal sidang. Tidak ada peluang yang dihitung dan tidak ada persentase yang disebutkan - angka peluang pada perkara yang belum selesai akan dikutip orang seolah-olah ia hasil pengukuran.`,
    baris: barisRisikoLimaBulan,
    pembilang: "Perkara sisa yang belum melewati dua pertiga tenggang dan masih punya jadwal sidang",
    penyebut: "Seluruh perkara yang didaftarkan pada rentang ini dan belum diputus",
    tabel: "perkara disambung perkara_putusan dan perkara_jadwal_sidang lewat perkara_id",
    ruas: "tanggal_pendaftaran, tanggal_putusan, tanggal_sidang",
  },
  {
    kode: "MP16",
    kunci: "kronologiPerkaraMaju",
    judul: "Kronologi Lengkap Perkara",
    keterangan:
      "Deret waktu perkara harus maju. Tanggal yang mundur berarti salah ketik tahun atau bulan - dan salah ketik semacam itu tidak pernah menampakkan dirinya sendiri, sebab tanggalnya tetap tanggal yang sah dan tiap laporan yang memakainya tetap terbaca masuk akal. Berbeda dari corong tahapan yang memeriksa tahapan mana yang kosong, butir ini memeriksa urutan tanggal yang sudah terisi.",
    baris: barisKronologiPerkara,
    pembilang: "Perkara yang seluruh peristiwa tercatatnya berurutan maju",
    penyebut: "Seluruh perkara yang didaftarkan pada rentang ini",
    tabel: "perkara disambung perkara_hakim_pn, perkara_jadwal_sidang, perkara_putusan, dan arsip",
    ruas: "tanggal_pendaftaran, tanggal_penetapan, tanggal_sidang, tanggal_putusan, tanggal_minutasi, tanggal_bht, tanggal_masuk_arsip",
  },
];

let sudahDidaftar = false;

function daftarkanSemua() {
  if (sudahDidaftar) return BUTIR.map((b) => b.kunci);

  BUTIR.forEach((b) => {
    if (kerangka.ambil(b.kunci)) return;
    kerangka.daftarkan({
      kunci: b.kunci,
      judul: b.judul,
      keterangan: b.keterangan,
      lantai: "bulanan",
      versiRumus: "mutu-putusan-v1",
      ambangDipakai: [],
      caraHitung: {
        pembilang: b.pembilang,
        penyebut: b.penyebut,
        dikecualikan:
          "Putusan yang tidak mengabulkan dikeluarkan dari butir yang menuntut amar menjawab petitum - pada putusan yang menolak atau mencabut, amar memang tidak menjawabnya. Jenis perkara yang putusannya terlalu sedikit dikeluarkan dari butir keajekan dan prakiraan: pada lima perkara, tiap amar tampak langka dan tiap lama penyelesaian tampak khas. Butir yang tabelnya tidak ada pada SIPP satuan kerja ini tidak menghasilkan baris sama sekali - ia tidak dinilai nol.",
        tabelSumber: b.tabel,
        ruasSumber: b.ruas,
      },
      baris: b.baris,
    });
  });

  sudahDidaftar = true;
  return BUTIR.map((b) => b.kunci);
}

function lupakanSemua() {
  sudahDidaftar = false;
}

function sambungan() {
  const peta = {};
  BUTIR.forEach((b) => {
    peta[b.kode] = b.kunci;
  });
  return peta;
}

module.exports = {
  AMBANG_JUMLAH_SIDANG,
  HASIL_MEDIASI_BERHASIL,
  AMBANG_KELAZIMAN_AMAR,
  AMBANG_NILAI_KONDISI,
  BATAS_KATA_TERPANJANG,
  BOBOT_KONDISI,
  BUTIR,
  HARI_ASAS_PENYELESAIAN,
  HARI_TENGGANG_MINUTASI,
  LEBAR_BATAS_KENDALI,
  MINIMAL_PUTUSAN_SEJENIS,
  barisAmarNafkah,
  barisCorongTahapan,
  barisKeajekanAmar,
  barisKehadiranPihak,
  barisKesepakatanMediasiAmar,
  barisKesesuaianPetitumAmar,
  barisKronologiPerkara,
  barisNilaiKondisi,
  barisPelaksanaanMediasi,
  barisPetaKendali,
  barisPolaPenundaan,
  barisPrakiraanWaktu,
  barisRisikoLimaBulan,
  barisJumlahPersidangan,
  daftarkanSemua,
  golongkanPenundaan,
  jumlahButirDaftar,
  lupakanSemua,
  sambungan,
  tampakKetikanAsal,
};
