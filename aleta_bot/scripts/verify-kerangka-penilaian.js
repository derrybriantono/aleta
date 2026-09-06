"use strict";

/**
 * ============================================================================
 * KERANGKA PENILAIAN - MS01, MS04, MS05
 * ============================================================================
 *
 * Yang paling dijaga: ANGKANYA DIHITUNG DARI BUKTINYA.
 *
 * Cara yang lazim menulis kueri agregat untuk angkanya dan kueri lain untuk
 * daftar perkaranya. Keduanya perlahan menyimpang, lalu pada suatu hari layar
 * menampilkan "312 relaas bertenggang kurang" di atas daftar berisi 287 baris -
 * dan tidak seorang pun menyadarinya, sebab yang membuka daftar tidak
 * menghitung barisnya dan yang membaca angka tidak membuka daftarnya.
 *
 * Di sini penilaian menyerahkan barisnya, dan kerangka yang menghitung. Selisih
 * karena itu tidak mungkin ada. Bila penilaian juga menyediakan kueri agregat,
 * keduanya dibandingkan dan selisihnya DILAPORKAN sebagai temuan.
 *
 * Berjalan tanpa jaringan dan tanpa basis data.
 */

const K = require("../services/kerangkaPenilaianService");

let lulus = 0;
let gagal = 0;

function periksa(nama, benar, keterangan) {
  if (benar) lulus += 1;
  else {
    gagal += 1;
    console.log(`  GAGAL ${nama}${keterangan ? ` - ${keterangan}` : ""}`);
  }
}

const ACUAN = "2026-09-06";

function definisiSah(ubah = {}) {
  return {
    kunci: "ujiKetaatan",
    judul: "Uji ketaatan",
    keterangan: "Penilaian buatan untuk menguji kerangkanya.",
    lantai: "harian",
    versiRumus: "v1",
    ambangDipakai: ["tenggangPanggilan"],
    baris: async () => [
      { kunci: "1/Pdt.G/2026", memenuhi: true },
      { kunci: "2/Pdt.G/2026", memenuhi: false },
      { kunci: "3/Pdt.G/2026", memenuhi: true },
    ],
    ...ubah,
  };
}

async function utama() {
  console.log("");
  console.log("== Yang ditolak saat mendaftar ==");
  const DITOLAK = [
    ["kunci kosong", definisiSah({ kunci: "" })],
    ["kunci berisi tanda baca", definisiSah({ kunci: "uji-ketaatan" })],
    ["judul kosong", definisiSah({ judul: "" })],
    ["keterangan kosong", definisiSah({ keterangan: "" })],
    ["lantai tidak dikenali", definisiSah({ lantai: "dwimingguan" })],
    ["tanpa baris()", definisiSah({ baris: undefined })],
    ["baris() bukan fungsi", definisiSah({ baris: "daftar" })],
    ["ringkas() bukan fungsi", definisiSah({ ringkas: 5 })],
    ["versiRumus kosong", definisiSah({ versiRumus: "" })],
    ["ambang yang tidak ada pada daftar", definisiSah({ ambangDipakai: ["ambangKarangan"] })],
    ["ambangDipakai bukan larik", definisiSah({ ambangDipakai: "tenggangPanggilan" })],
  ];
  DITOLAK.forEach(([nama, def]) => {
    K.lupakanSemua();
    let ditolak = false;
    try {
      K.daftarkan(def);
    } catch (_) {
      ditolak = true;
    }
    periksa(`ditolak: ${nama}`, ditolak);
  });

  K.lupakanSemua();
  periksa(
    "diterima: definisi yang sah",
    (() => {
      try {
        K.daftarkan(definisiSah());
        return true;
      } catch (galat) {
        return galat.message;
      }
    })() === true
  );

  periksa(
    "kunci yang sama tidak boleh didaftarkan dua kali",
    (() => {
      try {
        K.daftarkan(definisiSah());
        return false;
      } catch (_) {
        return true;
      }
    })()
  );

  console.log("== Angkanya turunan dari buktinya ==");
  {
    K.lupakanSemua();
    K.daftarkan(definisiSah());
    const hasil = await K.jalankan("ujiKetaatan", "harian", ACUAN);
    periksa("penilaian dapat dijalankan", hasil.ok === true);
    periksa("tujuh hari", hasil.satuan.length === 7, `dapat ${hasil.satuan.length}`);

    const satu = hasil.satuan[0];
    periksa("penyebutnya sama dengan banyaknya bukti", satu.penyebut === satu.bukti.length);
    periksa("terpenuhinya sama dengan bukti yang memenuhi", satu.terpenuhi === satu.bukti.filter((b) => b.memenuhi).length);
    periksa("penyebut tiga di bawah pembatas, jadi nilainya null", satu.nilai === null && satu.cukup === false);
    periksa("dan sebabnya menyebut penyebutnya", /penyebutnya 3/.test(satu.sebabTidakCukup), satu.sebabTidakCukup);
  }

  console.log("== Penyebut cukup menghasilkan nilai ==");
  {
    K.lupakanSemua();
    K.daftarkan(
      definisiSah({
        baris: async () =>
          Array.from({ length: 40 }, (_, i) => ({ kunci: `${i + 1}/Pdt.G/2026`, memenuhi: i >= 4 })),
      })
    );
    const hasil = await K.jalankan("ujiKetaatan", "harian", ACUAN);
    const satu = hasil.satuan[0];
    periksa("penyebut empat puluh", satu.penyebut === 40);
    periksa("terpenuhi tiga puluh enam", satu.terpenuhi === 36);
    periksa("nilainya sembilan puluh", satu.nilai === 90, String(satu.nilai));
    periksa("dan dinyatakan cukup", satu.cukup === true);
  }

  console.log("== Bila agregat dan bukti tidak sepakat, selisihnya dilaporkan ==");
  {
    K.lupakanSemua();
    K.daftarkan(
      definisiSah({
        baris: async () => Array.from({ length: 40 }, (_, i) => ({ kunci: String(i), memenuhi: i >= 4 })),
        // Kueri agregat yang keliru - persis cacat yang ingin ditangkap.
        ringkas: async () => ({ terpenuhi: 38, penyebut: 42 }),
      })
    );
    const hasil = await K.jalankan("ujiKetaatan", "harian", ACUAN);
    const satu = hasil.satuan[0];
    periksa("selisihnya dilaporkan", Boolean(satu.selisihRingkas));
    periksa("angka yang dipakai berasal dari buktinya", satu.penyebut === 40 && satu.terpenuhi === 36);
    periksa(
      "laporannya memuat kedua angka",
      satu.selisihRingkas.dariBaris.penyebut === 40 && satu.selisihRingkas.dariRingkas.penyebut === 42
    );
    periksa("dan menyebutnya temuan", /temuan/i.test(satu.selisihRingkas.arti), satu.selisihRingkas.arti);
  }

  console.log("== Bila keduanya sepakat, tidak ada yang dilaporkan ==");
  {
    K.lupakanSemua();
    K.daftarkan(
      definisiSah({
        baris: async () => Array.from({ length: 40 }, (_, i) => ({ kunci: String(i), memenuhi: i >= 4 })),
        ringkas: async () => ({ terpenuhi: 36, penyebut: 40 }),
      })
    );
    const hasil = await K.jalankan("ujiKetaatan", "harian", ACUAN);
    periksa("tidak ada selisih yang dilaporkan", hasil.satuan.every((s) => s.selisihRingkas === null));
  }

  console.log("== Baris yang tidak berbentuk ditolak saat dijalankan ==");
  {
    for (const [nama, barisRusak] of [
      ["bukan larik", async () => ({ penyebut: 10 })],
      ["memuat yang bukan objek", async () => [1, 2, 3]],
      ["tanpa penanda memenuhi", async () => [{ kunci: "1" }]],
      ["penanda memenuhi bukan boolean", async () => [{ kunci: "1", memenuhi: "ya" }]],
    ]) {
      K.lupakanSemua();
      K.daftarkan(definisiSah({ baris: barisRusak }));
      let melempar = false;
      try {
        await K.jalankan("ujiKetaatan", "harian", ACUAN);
      } catch (_) {
        melempar = true;
      }
      periksa(`baris ${nama} ditolak`, melempar);
    }
  }

  console.log("== Lantai periode ==");
  {
    K.lupakanSemua();
    K.daftarkan(
      definisiSah({
        lantai: "bulanan",
        baris: async () => Array.from({ length: 40 }, (_, i) => ({ kunci: String(i), memenuhi: i >= 4 })),
      })
    );

    const mingguan = await K.jalankan("ujiKetaatan", "mingguan", ACUAN);
    periksa("mingguan berada di bawah lantai", mingguan.bawahLantai === true);
    periksa("dan nilainya dibuang", mingguan.satuan.every((s) => s.nilai === null));
    periksa("sebabnya menyebut lantainya", /berlantai bulanan/.test(mingguan.satuan[0].sebabTidakCukup), mingguan.satuan[0].sebabTidakCukup);
    // Yang justru berguna pada periode sependek itu adalah daftarnya.
    periksa("tetapi buktinya TIDAK dibuang", mingguan.satuan.every((s) => s.bukti.length === 40));
    periksa("dan yang belum memenuhi ikut dihitung", mingguan.satuan[0].belumMemenuhi === 4);

    const bulanan = await K.jalankan("ujiKetaatan", "bulanan", ACUAN);
    periksa("bulanan tidak di bawah lantai", bulanan.bawahLantai === false);
    periksa("dan nilainya ada", bulanan.satuan.every((s) => s.nilai === 90));
  }

  console.log("== Ambang yang dipakai ikut dipulangkan ==");
  {
    K.lupakanSemua();
    K.daftarkan(definisiSah({ ambangDipakai: ["tenggangPanggilan", "minutasiBerkas"] }));
    const hasil = await K.jalankan("ujiKetaatan", "bulanan", ACUAN);
    periksa("dua ambang ikut dipulangkan", hasil.ambangDipakai.length === 2);
    periksa("masing-masing menyebut nilai dan dasarnya", hasil.ambangDipakai.every((a) => a.nilai !== undefined && a.dasar));
    periksa(
      "tenggang panggilan tiga hari kerja menurut Pasal 122 HIR",
      hasil.ambangDipakai[0].nilai === 3 && /Pasal 122 HIR/.test(hasil.ambangDipakai[0].dasar)
    );
  }

  console.log("== Kunci yang tidak dikenali ==");
  {
    K.lupakanSemua();
    K.daftarkan(definisiSah());
    for (const nakal of ["", "tidakAda", "__proto__", "constructor", "toString", "hasOwnProperty"]) {
      const hasil = await K.jalankan(nakal, "bulanan", ACUAN);
      periksa(`kunci ${JSON.stringify(nakal)} ditolak`, hasil.ok === false && hasil.alasan === "penilaian_tidak_dikenali");
    }
  }

  console.log("== Hitung dua kali ==");
  {
    K.lupakanSemua();
    K.daftarkan(
      definisiSah({
        baris: async () => Array.from({ length: 40 }, (_, i) => ({ kunci: String(i), memenuhi: i >= 4 })),
      })
    );
    const a = JSON.stringify(await K.jalankan("ujiKetaatan", "bulanan", ACUAN));
    const b = JSON.stringify(await K.jalankan("ujiKetaatan", "bulanan", ACUAN));
    periksa("hasilnya sama persis pada hitungan kedua", a === b);
  }

  console.log("== Ketujuh jendela ==");
  {
    K.lupakanSemua();
    K.daftarkan(
      definisiSah({
        lantai: "harian",
        baris: async (r) => Array.from({ length: 40 }, (_, i) => ({ kunci: `${r.mulai}#${i}`, memenuhi: i >= 4 })),
      })
    );
    for (const j of ["harian", "mingguan", "bulanan", "triwulan", "semester", "tahunan", "keseluruhan"]) {
      const hasil = await K.jalankan("ujiKetaatan", j, ACUAN, { tahunAwal: 2024 });
      periksa(`${j}: berjalan`, hasil.ok === true);
      periksa(`${j}: tiap satuan punya nama bertanggal`, hasil.satuan.every((s) => /\d{4}/.test(s.unit.label)));
      periksa(`${j}: tiap satuan punya buktinya`, hasil.satuan.every((s) => s.bukti.length === 40));
      periksa(
        `${j}: bukti tiap satuan berbeda sesuai rentangnya`,
        new Set(hasil.satuan.map((s) => s.bukti[0].kunci)).size === hasil.satuan.length
      );
    }
  }

  console.log("");
  console.log(`Hasil: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal > 0 ? 1 : 0);
}

utama().catch((galat) => {
  console.error(galat);
  process.exit(1);
});
