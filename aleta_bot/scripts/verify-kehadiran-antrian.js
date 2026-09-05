"use strict";

/**
 * Menguji pencatatan kehadiran dan pemberitahuan "tinggal satu lagi".
 *
 * ============================================================================
 * YANG DIJAGA PALING KERAS
 * ============================================================================
 *
 *   - Kedatangan KEDUA pada sisi yang sama tidak menyentuh waktu di tabel
 *     antrian. Menimpanya berarti perkara itu MUNDUR di antrian hanya karena
 *     ada orang kedua yang datang - dan nomor yang sudah diberitahukan kepada
 *     yang pertama berubah tanpa ada yang menjelaskan kenapa.
 *
 *   - Yang diberitahu hanya yang meninggalkan nomor kontak. Menebaknya dari
 *     data perkara berarti mengirim pesan kepada orang yang tidak pernah
 *     memintanya.
 *
 *   - Jarak giliran dihitung dari berapa yang MASIH MENUNGGU di depan, bukan
 *     dari selisih nomor. Nomor yang sudah dipanggil tidak menghalangi
 *     siapa pun.
 */

const pathx = require("path");

let lulus = 0;
let gagal = 0;

function periksa(nama, benar) {
  if (benar) {
    lulus += 1;
    console.log(`  OK    ${nama}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}`);
  }
}

// --- tiruan basis data ALETA ------------------------------------------------
const barisKehadiran = [];
const botDbPath = require.resolve("../services/botDbService");
const botDbAsli = require("../services/botDbService");
require.cache[botDbPath].exports = {
  ensureSchema: async () => true,
  addColumnIfMissing: async () => true,
  addIndexIfMissing: async () => true,
  toMysqlDate: (v) => new Date(v).toISOString().slice(0, 19).replace("T", " "),
  fromMysqlDate: botDbAsli.fromMysqlDate,
  query: async (sql, params = []) => {
    if (/^\s*CREATE TABLE/i.test(sql)) return [];
    if (/INSERT INTO aleta_bot_antrian_kehadiran/i.test(sql)) {
      barisKehadiran.push({
        id: params[0],
        perkara_id: params[1],
        nomor_perkara: params[2],
        tanggal: params[3],
        peran: params[4],
        urutan_pihak: params[5],
        sebagai_kuasa: params[6],
        nama: params[7],
        sisi: params[8],
        waktu_hadir: params[9],
        sumber: params[10],
        wa_chat_id: params[11],
        dicatat_oleh: params[12],
        diberitahu_pada: null,
      });
      return { affectedRows: 1 };
    }
    if (/SET diberitahu_pada/i.test(sql)) {
      let kena = 0;
      for (const b of barisKehadiran) {
        if (b.tanggal === params[1] && b.perkara_id === params[2] && b.wa_chat_id === params[3] && !b.diberitahu_pada) {
          b.diberitahu_pada = params[0];
          kena += 1;
        }
      }
      return { affectedRows: kena };
    }
    if (/wa_chat_id <> ''/i.test(sql)) {
      return barisKehadiran
        .filter((b) => b.tanggal === params[0] && b.wa_chat_id && !b.diberitahu_pada)
        .map((b) => ({
          id: b.id,
          perkaraId: b.perkara_id,
          peran: b.peran,
          urutanPihak: b.urutan_pihak,
          sebagaiKuasa: b.sebagai_kuasa,
          nama: b.nama,
          waChatId: b.wa_chat_id,
        }));
    }
    if (/FROM aleta_bot_antrian_kehadiran/i.test(sql)) {
      return barisKehadiran
        .filter((b) => b.tanggal === params[0])
        .sort((a, b) => String(a.waktu_hadir).localeCompare(String(b.waktu_hadir)))
        .map((b) => ({
          perkaraId: b.perkara_id,
          peran: b.peran,
          urutanPihak: b.urutan_pihak,
          sebagaiKuasa: b.sebagai_kuasa,
          nama: b.nama,
          sisi: b.sisi,
          waktuHadir: b.waktu_hadir,
          sumber: b.sumber,
          waChatId: b.wa_chat_id,
        }));
    }
    return [];
  },
};

// --- tiruan aplikasi antrian -------------------------------------------------
const kueriAntrian = [];
let kolomTerisi = {}; // perkara_id -> { pihak_1, pihak_2, saksi }
const externalPath = require.resolve("../services/externalDbService");
require("../services/externalDbService");
require.cache[externalPath].exports = {
  sanitizeError: (e) => String((e && e.message) || e),
  query: async (kunci, sql, params = []) => {
    kueriAntrian.push({ sql, params });
    const cocok = /SET (\w+) = COALESCE/.exec(sql);
    if (cocok) {
      const kolom = cocok[1];
      const id = String(params[0]);
      kolomTerisi[id] = kolomTerisi[id] || {};
      // Menirukan WHERE kolom IS NULL: yang sudah terisi tidak tersentuh.
      if (kolomTerisi[id][kolom]) return { affectedRows: 0 };
      kolomTerisi[id][kolom] = "2026-09-05 08:00:00";
      return { affectedRows: 1 };
    }
    return [];
  },
};

const layanan = require("../services/kehadiranAntrianService");

function bersihkan() {
  barisKehadiran.length = 0;
  kueriAntrian.length = 0;
  kolomTerisi = {};
}

async function utama() {
  console.log("");
  console.log("Uji kehadiran antrian sidang");
  console.log("");

  // ==========================================================================
  console.log("== Sebutan pihak disusun sekali, dipakai di mana-mana ==");
  {
    periksa(
      "Penggugat II",
      layanan.sebutan({ peran: "penggugat", urutanPihak: "II" }) === "Penggugat II"
    );
    periksa(
      "Kuasa Tergugat I",
      layanan.sebutan({ peran: "tergugat", urutanPihak: "I", sebagaiKuasa: true }) === "Kuasa Tergugat I"
    );
    periksa("Turut Tergugat", layanan.sebutan({ peran: "turut-tergugat" }) === "Turut Tergugat");
    periksa("Saksi", layanan.sebutan({ peran: "saksi" }) === "Saksi");
    periksa("Intervenien", layanan.sebutan({ peran: "intervenien" }) === "Intervenien");
  }

  // ==========================================================================
  console.log("\n== Peran menentukan sisi antrian ==");
  {
    bersihkan();
    const a = await layanan.catatHadir({ perkaraId: "9971", peran: "penggugat", urutanPihak: "I", tanggal: "2026-09-05" });
    periksa("penggugat mengisi pihak_1", a.sisi === "pihak_1" && a.antrianDiisi === true);

    const b = await layanan.catatHadir({ perkaraId: "9971", peran: "turut-tergugat", tanggal: "2026-09-05" });
    periksa("turut tergugat mengisi pihak_2", b.sisi === "pihak_2" && b.antrianDiisi === true);

    const c = await layanan.catatHadir({ perkaraId: "9971", peran: "saksi", tanggal: "2026-09-05" });
    periksa("saksi mengisi kolom saksi", c.sisi === "saksi");

    // Intervenien bawaannya sisi penggugat, TETAPI petugas dapat menyebut lain.
    bersihkan();
    const d = await layanan.catatHadir({ perkaraId: "9990", peran: "intervenien", tanggal: "2026-09-05" });
    periksa("intervenien bawaannya sisi penggugat", d.sisi === "pihak_1");
    const e = await layanan.catatHadir({
      perkaraId: "9991",
      peran: "intervenien",
      sisi: "pihak_2",
      tanggal: "2026-09-05",
    });
    periksa("sisi yang disebutkan petugas dipakai", e.sisi === "pihak_2");

    const salah = await layanan.catatHadir({ perkaraId: "9992", peran: "penonton", tanggal: "2026-09-05" });
    periksa("peran yang tidak dikenali ditolak", salah.ok === false);
  }

  // ==========================================================================
  console.log("\n== Kedatangan kedua TIDAK memundurkan antrian ==");
  {
    bersihkan();
    await layanan.catatHadir({ perkaraId: "9971", peran: "penggugat", urutanPihak: "I", tanggal: "2026-09-05" });
    const kedua = await layanan.catatHadir({
      perkaraId: "9971",
      peran: "penggugat",
      urutanPihak: "II",
      tanggal: "2026-09-05",
    });

    periksa("kehadiran kedua tetap tercatat di ALETA", barisKehadiran.length === 2);
    periksa("tetapi tidak mengisi ulang waktu antrian", kedua.antrianDiisi === false);

    // Perintahnya sendiri harus memakai COALESCE dan penjaga IS NULL.
    const perintah = kueriAntrian.map((q) => q.sql).join(" ");
    periksa("memakai COALESCE", /COALESCE/.test(perintah));
    periksa("berpenjaga IS NULL", /IS NULL/.test(perintah));
  }

  // ==========================================================================
  console.log("\n== Siapa yang lebih dulu hadir ==");
  {
    bersihkan();
    await layanan.catatHadir({ perkaraId: "9971", peran: "tergugat", urutanPihak: "I", nama: "Budi", tanggal: "2026-09-05" });
    await layanan.catatHadir({ perkaraId: "9971", peran: "penggugat", urutanPihak: "I", nama: "Ani", tanggal: "2026-09-05" });

    // Waktunya disusun lewat toMysqlDate yang SAMA dengan yang dipakai
    // layanan - ALETA menyimpan UTC dan membacanya kembali sebagai UTC.
    // Menuliskan "2026-09-05 08:01:00" langsung berarti pukul 08:01 UTC, dan
    // pada zona WITA ia terbaca 16:01. Uji yang mengarang bentuk simpanan akan
    // gagal karena zona waktu mesinnya, bukan karena kodenya keliru.
    barisKehadiran[0].waktu_hadir = botDbAsli.toMysqlDate(new Date(2026, 8, 5, 8, 1, 0));
    barisKehadiran[1].waktu_hadir = botDbAsli.toMysqlDate(new Date(2026, 8, 5, 8, 20, 0));

    const peta = await layanan.daftarKehadiran(["9971"], "2026-09-05");
    periksa("dua orang tercatat hadir", peta["9971"].hadir.length === 2);
    periksa("yang pertama tergugat, bukan penggugat", peta["9971"].pertama.sebutan === "Tergugat I");
    periksa("namanya ikut terbawa", peta["9971"].pertama.nama === "Budi");
    periksa("jamnya terbaca", peta["9971"].pertama.jam === "08:01");
  }

  // ==========================================================================
  console.log("\n== Jarak giliran dihitung dari yang masih menunggu ==");
  {
    // Seluruhnya satu ruang: perilakunya satu deret.
    const peta = {
      "1": { nomor: 1, keadaan: "dipanggil", noRuang: 1 },
      "2": { nomor: 2, keadaan: "dipanggil", noRuang: 1 },
      "3": { nomor: 3, keadaan: "menunggu", noRuang: 1 },
      "4": { nomor: 4, keadaan: "menunggu", noRuang: 1 },
      "5": { nomor: 5, keadaan: "menunggu", noRuang: 1 },
      "6": { nomor: 6, keadaan: "menunggu", noRuang: 1 },
      "7": { nomor: null, keadaan: "belum-ambil", noRuang: 1 },
    };

    const hampir = layanan.hitungHampirGiliran(peta, { jarak: 2 });
    periksa("tiga teratas yang menunggu terpilih", hampir.length === 3);
    periksa("yang paling depan berjarak nol", hampir[0].didepan === 0 && hampir[0].nomor === 3);
    periksa("yang sudah dipanggil tidak ikut", hampir.every((x) => x.keadaan === "menunggu"));
    periksa("yang belum ambil tidak ikut", hampir.every((x) => x.nomor !== null));

    const dekat = layanan.hitungHampirGiliran(peta, { jarak: 1 });
    periksa("jarak satu memilih dua teratas", dekat.length === 2);
  }

  // ==========================================================================
  console.log("\n== Dihitung PER RUANG, sebab ruangan memanggil bersamaan ==");
  {
    // Ruang 1 sudah jauh; ruang 2 baru mulai. Nomor 8 adalah yang PERTAMA
    // menunggu di ruang 2 - ia berikutnya dipanggil di sana, walau secara
    // keseluruhan ada empat nomor lebih kecil yang masih menunggu.
    const peta = {
      "a": { nomor: 4, keadaan: "menunggu", noRuang: 1 },
      "b": { nomor: 5, keadaan: "menunggu", noRuang: 1 },
      "c": { nomor: 6, keadaan: "menunggu", noRuang: 1 },
      "d": { nomor: 7, keadaan: "menunggu", noRuang: 1 },
      "e": { nomor: 8, keadaan: "menunggu", noRuang: 2 },
      "f": { nomor: 9, keadaan: "menunggu", noRuang: 2 },
    };

    const hampir = layanan.hitungHampirGiliran(peta, { jarak: 0 });
    periksa("dua ruang menghasilkan dua yang berikutnya", hampir.length === 2);
    periksa("yang berikutnya di ruang 1 nomor 4", hampir.some((x) => x.nomor === 4 && x.didepan === 0));
    periksa(
      "yang berikutnya di ruang 2 nomor 8, bukan menunggu empat lagi",
      hampir.some((x) => x.nomor === 8 && x.didepan === 0)
    );

    // Tanpa keterangan ruang, seluruhnya kembali menjadi satu deret - tidak
    // ada dasar untuk memisahkannya.
    const tanpaRuang = layanan.hitungHampirGiliran(
      {
        "a": { nomor: 4, keadaan: "menunggu", noRuang: null },
        "b": { nomor: 5, keadaan: "menunggu", noRuang: null },
        "c": { nomor: 6, keadaan: "menunggu", noRuang: null },
      },
      { jarak: 0 }
    );
    periksa("tanpa ruang kembali satu deret", tanpaRuang.length === 1 && tanpaRuang[0].nomor === 4);
  }

  // ==========================================================================
  console.log("\n== Pesan hanya untuk yang meninggalkan nomor kontak ==");
  {
    const petaAntrian = {
      "9971": { nomor: 3, keadaan: "menunggu", noRuang: 2 },
      "9956": { nomor: 4, keadaan: "menunggu", noRuang: 1 },
    };
    const petaKehadiran = {
      "9971": {
        hadir: [
          { nama: "Ani", waChatId: "628123@c.us", sebutan: "Penggugat I" },
          // Kuasa yang sama dua kali - satu nomor, satu pesan.
          { nama: "Ani", waChatId: "628123@c.us", sebutan: "Kuasa Penggugat I" },
        ],
      },
      "9956": {
        // Mengambil di mesin: tidak meninggalkan nomor kontak.
        hadir: [{ nama: "Budi", waChatId: "", sebutan: "Tergugat I" }],
      },
    };

    const pesan = layanan.susunPesanHampirGiliran(petaAntrian, petaKehadiran, { jarak: 2 });
    periksa("satu pesan saja untuk nomor yang sama", pesan.length === 1);
    periksa("yang tanpa nomor kontak tidak dikirimi", pesan.every((p) => p.perkaraId !== "9956"));
    periksa("nomor antriannya disebut", /nomor \*3\*/.test(pesan[0].teks));
    periksa("giliran berikutnya disebut tegas", /BERIKUTNYA/.test(pesan[0].teks));
    periksa("ruangannya disebut", /Ruang Sidang 2/.test(pesan[0].teks));

    // Ketiganya di ruang yang SAMA - jaraknya dihitung per ruang, jadi
    // fixture yang mencampur ruang tidak menguji apa yang dimaksud.
    const jauh = layanan.susunPesanHampirGiliran(
      {
        "9971": { nomor: 3, keadaan: "menunggu", noRuang: 2 },
        "9956": { nomor: 1, keadaan: "menunggu", noRuang: 2 },
        "9957": { nomor: 2, keadaan: "menunggu", noRuang: 2 },
      },
      petaKehadiran,
      { jarak: 2 }
    );
    const pesan9971 = jauh.find((p) => p.perkaraId === "9971");
    periksa("yang berjarak dua disebut sisa antriannya", /tinggal 2 antrian lagi/.test(pesan9971.teks));

    // Yang sudah diberitahu tidak dikirimi lagi.
    const sudah = layanan.susunPesanHampirGiliran(
      petaAntrian,
      { "9971": { hadir: [{ nama: "Ani", waChatId: "628123@c.us", sudahDiberitahu: true }] } },
      { jarak: 2 }
    );
    periksa("yang sudah diberitahu dilewati", sudah.length === 0);
  }

  // ==========================================================================
  console.log("\n== Pihak dapat mengecek sendiri: 'cek antrian' ==");
  {
    const peta = {
      "9971": { nomor: 3, keadaan: "menunggu", noRuang: 2, jamPanggil: "" },
      "9956": { nomor: 1, keadaan: "dipanggil", noRuang: 2, jamPanggil: "09:10" },
      "9957": { nomor: 2, keadaan: "menunggu", noRuang: 2, jamPanggil: "" },
      "9958": { nomor: null, keadaan: "belum-ambil", noRuang: 2, jamPanggil: "" },
      // Ruang lain - tidak boleh ikut menghitung jarak.
      "9959": { nomor: 4, keadaan: "menunggu", noRuang: 1, jamPanggil: "" },
    };

    const menunggu = layanan.susunJawabanCekAntrian(peta, "9971");
    periksa("menyebut nomornya", /nomor antrian Anda \*3\*/i.test(menunggu));
    periksa("menyebut sisa antriannya", /1 antrian lagi/.test(menunggu));
    periksa("menyebut ruangnya", /Ruang Sidang 2/.test(menunggu));

    const berikutnya = layanan.susunJawabanCekAntrian(peta, "9957");
    periksa("yang paling depan disebut BERIKUTNYA", /BERIKUTNYA/.test(berikutnya));

    const sudah = layanan.susunJawabanCekAntrian(peta, "9956");
    periksa("yang sudah dipanggil disebutkan jamnya", /SUDAH DIPANGGIL pukul 09:10/.test(sudah));

    const belum = layanan.susunJawabanCekAntrian(peta, "9958");
    periksa("yang belum diambil diberi tahu caranya", /ambil antrian/.test(belum));

    const asing = layanan.susunJawabanCekAntrian(peta, "1234");
    periksa("perkara di luar daftar dijawab apa adanya", /belum terdaftar/.test(asing));

    // Perkara di ruang 1 hanya menghitung ruang 1 - di sana ia yang pertama.
    const ruangLain = layanan.susunJawabanCekAntrian(peta, "9959");
    periksa("jarak dihitung per ruang", /BERIKUTNYA/.test(ruangLain));
  }

  // ==========================================================================
  console.log("\n== Penandaan sudah diberitahu ==");
  {
    bersihkan();
    await layanan.catatHadir({
      perkaraId: "9971",
      peran: "penggugat",
      tanggal: "2026-09-05",
      waChatId: "628123@c.us",
    });
    const sebelum = await layanan.kehadiranBelumDiberitahu(["9971"], "2026-09-05");
    periksa("terbaca sebagai belum diberitahu", sebelum["9971"].hadir.length === 1);

    await layanan.tandaiDiberitahu("9971", "628123@c.us", "2026-09-05");
    const sesudah = await layanan.kehadiranBelumDiberitahu(["9971"], "2026-09-05");
    periksa("sesudah ditandai tidak muncul lagi", Object.keys(sesudah).length === 0);
  }

  // ==========================================================================
  console.log("\n== Jalur WhatsApp juga tidak menimpa waktu ambil ==");
  {
    const fs = require("fs");
    const sumber = fs.readFileSync(
      pathx.resolve(__dirname, "..", "services", "antrianOnlineService.js"),
      "utf8"
    );
    // Dulu SET a.${column} = NOW() tanpa penjaga: permintaan kedua memundurkan
    // pengirimnya ke belakang antrian.
    periksa("memakai COALESCE, bukan NOW() polos", /COALESCE\(a\.\$\{column\}, NOW\(\)\)/.test(sumber));
  }

  console.log("");
  console.log(`Lulus: ${lulus}, Gagal: ${gagal}`);
  if (gagal > 0) {
    console.log("ADA PERIKSAAN YANG GAGAL.");
    process.exit(1);
  }
  console.log("SEMUA PERIKSAAN LULUS.");
}

utama().catch((galat) => {
  console.error(galat);
  process.exit(1);
});
