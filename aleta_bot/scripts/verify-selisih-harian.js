"use strict";

/**
 * ============================================================================
 * PEMERIKSA SELISIH HARIAN - YANG DIJAGA
 * ============================================================================
 *
 * Tiga keputusan, dan ketiganya berakibat pada ponsel orang:
 *
 *   1. DIAM ketika tidak ada selisih. Pesan "tidak ada selisih" yang datang
 *      tiap malam mengajari orang mengabaikan pesannya, dan pada malam ia
 *      berbunyi sungguhan tidak ada yang membacanya.
 *   2. SEKALI SEMALAM walau bot dinyalakan ulang lima kali - kunci
 *      idempotensinya bertanggal, dan antrean mengenalinya.
 *   3. TIDAK ADA NAMA PIHAK dalam pesannya. Layar ponsel dapat terlihat orang
 *      lain, dan nama pihak berperkara bukan keterangan yang perlu dipajang.
 *
 * Berjalan tanpa jaringan, tanpa basis data, dan tanpa WhatsApp: layanan
 * rekonsiliasi dan antrean pesan diganti penadah.
 */

let lulus = 0;
let gagal = 0;

function periksa(nama, benar, tambahan = "") {
  if (benar) {
    lulus += 1;
    console.log(`  OK    ${nama}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}${tambahan ? ` - ${tambahan}` : ""}`);
  }
}

// ---------------------------------------------------------------- penadah
let laporanPalsu = { diperiksaPada: "", jumlahDokumen: 0, selisih: [] };
const diantre = [];

const jalurRekonsiliasi = require.resolve("../services/ecourtReconciliationService");
require("../services/ecourtReconciliationService");
require.cache[jalurRekonsiliasi].exports = {
  periksa: async () => laporanPalsu,
};

const jalurAntrean = require.resolve("../services/messageQueueService");
require("../services/messageQueueService");
require.cache[jalurAntrean].exports = {
  enqueueMessage: async (data) => {
    diantre.push(data);
    return { id: `palsu-${diantre.length}` };
  },
};

const jalurLog = require.resolve("../services/logService");
require("../services/logService");
require.cache[jalurLog].exports = { logSecurityEvent: async () => {} };

const layanan = require("../services/selisihHarianService");

const PENERIMA = { "Sri Susilowati": "628111@c.us", "Fikrianto": "628222@c.us" };

const contohSelisih = (n, kegentingan = "tinggi") => ({
  documentKey: `kunci-${n}`,
  nomorPerkara: `${560 + n}/Pdt.G/2026/PA.Dgl`,
  judulDokumen: `Jawaban Tergugat ${n}`,
  kegentingan,
  jenis: "bertentangan",
  penjelasan: "Keputusan ALETA berbeda dengan status di e-Court.",
});

(async () => {
  console.log("pemeriksa selisih harian");

  // ======================================================================
  // 1. Diam ketika tidak ada selisih
  // ======================================================================
  {
    laporanPalsu = { jumlahDokumen: 120, selisih: [] };
    diantre.length = 0;
    const hasil = await layanan.jalankanSatuPutaran({ penerima: PENERIMA });
    periksa("putaran berhasil walau tidak ada selisih", hasil.ok === true);
    periksa("tidak satu pun pesan diantre", diantre.length === 0, String(diantre.length));
    periksa("sebabnya disebut, bukan diam tanpa keterangan", hasil.alasan === "tidak_ada_selisih", hasil.alasan || "");

    // Diamnya tidak berarti tidak diperiksa - pertanyaan "apakah tadi malam
    // diperiksa?" harus tetap ada jawabannya.
    const keadaan = layanan.keadaan();
    periksa("putarannya tetap tercatat", keadaan.pernahJalan === true && Boolean(keadaan.terakhirPada));
  }

  // ======================================================================
  // 2. Mengirim ketika ada selisih
  // ======================================================================
  {
    laporanPalsu = {
      jumlahDokumen: 340,
      selisih: [contohSelisih(1), contohSelisih(2, "sedang"), contohSelisih(3, "rendah")],
    };
    diantre.length = 0;
    const hasil = await layanan.jalankanSatuPutaran({ penerima: PENERIMA });
    periksa("pesan diantre ke tiap penerima", diantre.length === 2, String(diantre.length));
    periksa("jumlah dan yang genting dihitung", hasil.jumlah === 3 && hasil.genting === 1, `${hasil.jumlah}/${hasil.genting}`);

    const satu = diantre[0] || {};
    periksa("kategorinya pegawai, bukan pihak berperkara", satu.category === "employee", satu.category || "");
    periksa("kunci notifikasinya disebut", satu.notificationKey === "selisih-ecourt-harian", satu.notificationKey || "");
    periksa(
      "kunci idempotensinya bertanggal dan per nomor",
      /^selisih-harian:\d{4}-\d{2}-\d{2}:/.test(String(satu.idempotencyKey || "")),
      satu.idempotencyKey || ""
    );
  }

  // ======================================================================
  // 3. Isi pesannya
  // ======================================================================
  {
    const pesan = layanan.susunPesan(laporanPalsu);
    periksa("menyebut jumlah dan yang genting", /3 selisih/.test(pesan) && /1 di antaranya GENTING/.test(pesan), "");
    periksa("menyebut nomor perkaranya", pesan.includes("561/Pdt.G/2026/PA.Dgl"));
    periksa("menyebut judul dokumennya", pesan.includes("Jawaban Tergugat 1"));
    periksa("menunjukkan tempat memeriksanya", /portal ALETA/i.test(pesan));

    // Nama pihak TIDAK pernah ikut - layanan ini hanya menerima ruas yang
    // memang tidak memuatnya, dan itu dijaga di sini supaya ruas baru yang
    // memuat nama tidak diam-diam masuk.
    const sumber = require("node:fs").readFileSync(
      require.resolve("../services/selisihHarianService"),
      "utf8"
    );
    const tanpaCatatan = sumber.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    periksa(
      "tidak menyentuh ruas nama pihak sama sekali",
      !/\b(namaPihak|pihak1|pihak2|penggugat|tergugat|pemohon|termohon)\b/i.test(tanpaCatatan)
    );
  }

  // ======================================================================
  // 4. Pesan yang terlalu panjang dipendekkan
  // ======================================================================
  {
    const banyak = { jumlahDokumen: 900, selisih: [] };
    for (let i = 1; i <= 40; i += 1) banyak.selisih.push(contohSelisih(i, "sedang"));
    const pesan = layanan.susunPesan(banyak);
    const disebut = (pesan.match(/^• \d+\/Pdt/gm) || []).length;
    periksa("yang disebut satu per satu dibatasi", disebut <= layanan.BAWAAN.maksDisebut, String(disebut));
    periksa("sisanya dihitung, bukan dibuang diam-diam", /dan \d+ selisih lain/.test(pesan));
  }

  // ======================================================================
  // 5. Uji kering tidak mengantre apa pun
  // ======================================================================
  {
    laporanPalsu = { jumlahDokumen: 10, selisih: [contohSelisih(9)] };
    diantre.length = 0;
    const hasil = await layanan.jalankanSatuPutaran({ kering: true, penerima: PENERIMA });
    periksa("uji kering memulangkan pesannya", hasil.ok === true && Boolean(hasil.pesan));
    periksa("uji kering tidak mengantre apa pun", diantre.length === 0, String(diantre.length));
    periksa("penerimanya disebutkan supaya dapat diperiksa", Array.isArray(hasil.penerima) && hasil.penerima.length === 2);
  }

  // ======================================================================
  // 6. Gagal memeriksa tidak melempar
  // ======================================================================
  {
    require.cache[jalurRekonsiliasi].exports = {
      periksa: async () => {
        throw new Error("ER_NO_SUCH_TABLE: tabel dokumen hilang");
      },
    };
    delete require.cache[require.resolve("../services/selisihHarianService")];
    const lagi = require("../services/selisihHarianService");
    const hasil = await lagi.jalankanSatuPutaran({ penerima: PENERIMA });
    periksa("kegagalan dipulangkan, bukan dilempar", hasil.ok === false && hasil.alasan === "gagal_memeriksa");
    periksa("sebabnya ikut supaya dapat dibaca di log", /ER_NO_SUCH_TABLE/.test(hasil.pesan || ""));
  }

  // ======================================================================
  // 7. Jadwalnya dari pengaturan, bukan ditulis tetap
  // ======================================================================
  {
    const atur = layanan.pengaturan();
    periksa("jadwal cron disusun dari pengaturannya", layanan.jadwalCron(atur) === `${atur.menit} ${atur.jam} * * *`);
    periksa("bawaannya sesudah jam kerja", atur.jam >= 17 || atur.jam <= 6, String(atur.jam));
  }

  console.log("");
  console.log(`lulus ${lulus}, gagal ${gagal}`);
  process.exit(gagal > 0 ? 1 : 0);
})().catch((galat) => {
  console.error("GALAT:", String(galat.stack || galat.message || galat).slice(0, 600));
  process.exit(1);
});
