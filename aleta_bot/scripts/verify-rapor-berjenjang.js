"use strict";

/**
 * ============================================================================
 * MS02 - RAPOR BERJENJANG
 * ============================================================================
 *
 * Rapor aparatur bukan penilaian lain; ia penilaian yang SAMA dilihat per
 * orang. Karena itu yang dijaga di sini bukan angkanya, melainkan hubungan
 * antara angka per orang dengan angka pengadilan:
 *
 *   - jumlah penyebut seluruh orang selalu sama dengan penyebut pengadilan;
 *   - tidak ada baris yang terhitung dua kali;
 *   - baris yang pelakunya tidak tercatat tidak dibuang, melainkan masuk
 *     kelompok bernama - sebab pekerjaan yang tidak diketahui pengerjanya
 *     adalah temuan, bukan hal yang boleh hilang dari hitungan;
 *   - pembatas penyebut berlaku PER ORANG, dan justru di situ ia paling
 *     penting: nama orang tertulis di sebelah angkanya.
 *
 * Berjalan tanpa jaringan dan tanpa basis data.
 */

const K = require("../services/kerangkaPenilaianService");
const M = require("../services/raporBerjenjangService");

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
const JURUSITA = ["Rusdin", "Yusuf", "Anwar", "Halima"];

/** Seratus panggilan: Rusdin banyak dan buruk, Halima sedikit. */
function barisPanggilan(rentang) {
  const baris = [];
  for (let i = 0; i < 100; i += 1) {
    // Halima hanya kebagian tiga - sengaja, supaya pembatas penyebut teruji.
    const js = i < 3 ? "Halima" : JURUSITA[i % 3];
    baris.push({
      kunci: `${rentang.mulai}#${i}`,
      jurusita: js,
      memenuhi: !(js === "Rusdin" && i % 4 === 0),
    });
  }
  // Lima baris tanpa jurusita - pekerjaan yang tidak diketahui pengerjanya.
  for (let i = 0; i < 5; i += 1) {
    baris.push({ kunci: `${rentang.mulai}#x${i}`, memenuhi: false });
  }
  return baris;
}

async function utama() {
  K.lupakanSemua();
  K.daftarkan({
    kunci: "ketaatanPanggilan",
    judul: "Ketaatan tenggang pemanggilan",
    keterangan: "Panggilan sah sekurangnya tiga hari kerja sebelum sidang.",
    lantai: "bulanan",
    versiRumus: "v1",
    ambangDipakai: ["tenggangPanggilan"],
    caraHitung: {
      pembilang: "Relaas yang tenggangnya tiga hari kerja atau lebih sebelum sidang",
      penyebut: "Seluruh relaas panggilan yang terkirim pada rentang ini",
      dikecualikan: "Relaas retur, panggilan ghaib, dan panggilan delegasi",
      tabelSumber: "perkara_pihak_panggilan, perkara_jadwal_sidang",
      ruasSumber: "tanggal_panggilan, tanggal_sidang, jenis_panggilan",
    },
    baris: async (r) => barisPanggilan(r),
  });

  const hasil = await K.jalankan("ketaatanPanggilan", "bulanan", ACUAN);

  console.log("");
  console.log("== Memecah satu satuan ==");
  {
    const p = M.pecahSatuan(hasil.satuan[0], "jurusita");
    periksa("kelompoknya terbentuk", p.kelompok.length === 5, `dapat ${p.kelompok.length}`);
    periksa(
      "jumlah penyebut seluruh kelompok sama dengan penyebut keseluruhan",
      p.kelompok.reduce((s, k) => s + k.penyebut, 0) === p.keseluruhan.penyebut
    );
    periksa(
      "jumlah terpenuhi seluruh kelompok sama dengan terpenuhi keseluruhan",
      p.kelompok.reduce((s, k) => s + k.terpenuhi, 0) === p.keseluruhan.terpenuhi
    );
    periksa("baris tanpa pelaku tidak hilang", p.adaYangTidakTercatat === true);
    periksa(
      "dan masuk kelompok bernama",
      p.kelompok.some((k) => k.pelaku === M.TIDAK_TERCATAT && k.penyebut === 5)
    );
    periksa(
      "terurut menurut nama, bukan menurut nilai",
      p.kelompok.map((k) => k.pelaku).join(",") ===
        [...p.kelompok.map((k) => k.pelaku)].sort((a, b) => a.localeCompare(b, "id")).join(",")
    );

    const halima = p.kelompok.find((k) => k.pelaku === "Halima");
    periksa("jurusita berpenyebut tiga tidak diberi nilai", halima.penyebut === 3 && halima.nilai === null);
    periksa("dan sebabnya menyebut penyebutnya", /penyebutnya 3/.test(halima.sebabTidakCukup), halima.sebabTidakCukup);

    const rusdin = p.kelompok.find((k) => k.pelaku === "Rusdin");
    periksa("jurusita berpenyebut cukup diberi nilai", rusdin.penyebut >= 20 && typeof rusdin.nilai === "number");
    periksa("dan buktinya ikut terbawa", rusdin.bukti.length === rusdin.penyebut);
    periksa(
      "seluruh bukti kelompok itu memang miliknya",
      rusdin.bukti.every((b) => b.jurusita === "Rusdin")
    );
  }

  console.log("== Baris yang hilang atau ganda ditolak ==");
  {
    // Satuan buatan yang angkanya sengaja tidak cocok dengan buktinya - persis
    // keadaan yang tidak boleh lolos diam-diam.
    const rusak = {
      unit: hasil.satuan[0].unit,
      terpenuhi: 999,
      penyebut: 999,
      bukti: [{ kunci: "1", jurusita: "Rusdin", memenuhi: true }],
    };
    let melempar = false;
    try {
      M.pecahSatuan(rusak, "jurusita");
    } catch (galat) {
      melempar = /kehilangan atau menggandakan/.test(galat.message);
    }
    periksa("satuan yang angkanya tidak cocok dengan buktinya ditolak", melempar);

    periksa(
      "dimensi kosong ditolak",
      (() => {
        try {
          M.pecahSatuan(hasil.satuan[0], "");
          return false;
        } catch (_) {
          return true;
        }
      })()
    );
    periksa(
      "satuan tanpa bukti ditolak",
      (() => {
        try {
          M.pecahSatuan({ unit: hasil.satuan[0].unit, terpenuhi: 0, penyebut: 0 }, "jurusita");
          return false;
        } catch (_) {
          return true;
        }
      })()
    );
  }

  console.log("== Rapor sepanjang periode ==");
  {
    const r = M.berjenjang(hasil, "jurusita");
    periksa("rapor terbentuk", Boolean(r) && r.dimensi === "jurusita");
    periksa("ada satu baris per satuan periode", r.perSatuan.length === hasil.satuan.length);
    periksa("ada ringkasan per pelaku", r.ringkasPelaku.length === 5, `dapat ${r.ringkasPelaku.length}`);

    const totalPengadilan = hasil.satuan.reduce((s, x) => s + x.penyebut, 0);
    periksa(
      "jumlah penyebut seluruh pelaku sama dengan penyebut pengadilan",
      r.ringkasPelaku.reduce((s, x) => s + x.penyebut, 0) === totalPengadilan,
      `${r.ringkasPelaku.reduce((s, x) => s + x.penyebut, 0)} lawan ${totalPengadilan}`
    );
    periksa("dan keseluruhannya sama pula", r.keseluruhan.penyebut === totalPengadilan);

    // Sepanjang dua belas bulan, Halima mengumpulkan 36 panggilan - cukup.
    const halima = r.ringkasPelaku.find((x) => x.pelaku === "Halima");
    periksa("pelaku yang sedikit per bulan dapat cukup sepanjang periode", halima.penyebut === 36 && halima.cukup === true, JSON.stringify(halima));

    const rusdin = r.ringkasPelaku.find((x) => x.pelaku === "Rusdin");
    const yusuf = r.ringkasPelaku.find((x) => x.pelaku === "Yusuf");
    periksa("nilai antar pelaku memang berbeda", rusdin.nilai !== yusuf.nilai, `${rusdin.nilai} lawan ${yusuf.nilai}`);
    periksa("dan yang buruk memang lebih rendah", rusdin.nilai < yusuf.nilai);
    periksa("catatannya menyebut hubungannya dengan angka pengadilan", /penilaian yang SAMA/.test(r.catatan));
  }

  console.log("== Dimensi yang tidak ada pada barisnya ==");
  {
    const r = M.berjenjang(hasil, "hakim");
    periksa("seluruhnya masuk kelompok tidak tercatat", r.ringkasPelaku.length === 1);
    periksa("dan namanya jelas", r.ringkasPelaku[0].pelaku === M.TIDAK_TERCATAT);
    periksa(
      "penyebutnya tetap utuh",
      r.ringkasPelaku[0].penyebut === hasil.satuan.reduce((s, x) => s + x.penyebut, 0)
    );
  }

  console.log("== Hitung dua kali ==");
  {
    const a = JSON.stringify(M.berjenjang(hasil, "jurusita").ringkasPelaku);
    const b = JSON.stringify(M.berjenjang(hasil, "jurusita").ringkasPelaku);
    periksa("ringkasan pelaku sama persis pada hitungan kedua", a === b);
  }

  console.log("");
  console.log("Rapor jurusita sepanjang dua belas bulan:");
  M.berjenjang(hasil, "jurusita").ringkasPelaku.forEach((x) => {
    const nilai = x.nilai === null ? "belum cukup" : String(x.nilai);
    console.log(`  ${x.pelaku.padEnd(18)} ${String(x.terpenuhi).padStart(5)}/${String(x.penyebut).padEnd(5)} ${nilai}`);
  });

  console.log("");
  console.log(`Hasil: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal > 0 ? 1 : 0);
}

utama().catch((galat) => {
  console.error(galat);
  process.exit(1);
});
