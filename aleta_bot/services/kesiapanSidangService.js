"use strict";

/**
 * Skor kesiapan sidang.
 *
 * ============================================================================
 * SATU ANGKA UNTUK PERTANYAAN YANG DITANYA TIAP PAGI
 * ============================================================================
 *
 * Pertanyaannya selalu sama: sidang mana yang bermasalah hari ini. Selama ini
 * menjawabnya menuntut membuka tiap perkara satu per satu di tiga aplikasi.
 *
 * Skor ini menyatukan yang sudah dibaca ALETA menjadi satu angka per sidang,
 * beserta DAFTAR PENGHAMBATNYA. Angkanya untuk mengurutkan; daftarnya untuk
 * ditindaklanjuti - angka saja tidak memberi tahu apa yang harus dikerjakan.
 *
 * ============================================================================
 * YANG TIDAK DIKETAHUI BUKAN YANG LULUS
 * ============================================================================
 *
 * Keterangan yang belum terbaca - SIPP belum diisi, berkas belum ditarik -
 * TIDAK dihitung sebagai memenuhi syarat. Sidang yang datanya kosong akan
 * bernilai rendah, bukan sempurna.
 *
 * Kebalikannya jauh lebih berbahaya: sidang tanpa data apa pun tampak siap
 * seratus persen, dan majelis berangkat ke ruang sidang dengan keyakinan yang
 * dibangun dari ketiadaan.
 *
 * ============================================================================
 * SKOR BUKAN PUTUSAN
 * ============================================================================
 *
 * Angka ini alat bantu petugas, bukan penilaian sah tidaknya panggilan maupun
 * kesiapan perkara. Keputusan itu tetap milik majelis. Karena itu tiap
 * penghambat disebutkan apa adanya, dengan sumbernya, supaya dapat diperiksa
 * ulang - bukan disembunyikan di balik satu angka.
 */

const ecourtPanggilanService = require("./ecourtPanggilanService");
const ecourtStoreService = require("./ecourtStoreService");
const sippJadwalSidangService = require("./sippJadwalSidangService");
const sippKonteksService = require("./sippKonteksService");

/**
 * Bobot tiap segi, dijumlahkan menjadi seratus.
 *
 * Panggilan diberi bobot terbesar karena hanya ia yang dapat MEMBATALKAN
 * sidang: panggilan yang tidak patut menuntut penundaan, sedangkan berkas yang
 * belum lengkap masih dapat diselesaikan pada hari itu juga.
 */
const BOBOT = {
  panggilan: 40,
  majelis: 15,
  panitera: 10,
  berkas: 15,
  verifikasi: 10,
  nomorPihak: 10,
};

/** Tingkat penghambat, dari yang paling menghentikan. */
const TINGKAT = { berat: "berat", sedang: "sedang", ringan: "ringan" };

/**
 * Menilai satu sidang.
 *
 * @param {{
 *   agenda?: string,
 *   tanggalSidang?: any,
 *   majelis?: Array, panitera?: Array,
 *   persetujuan?: Array, panggilan?: Array, relaas?: Array,
 *   dokumen?: Array, nomorPihak?: Array, sisiWajib?: Array|null,
 *   saksi?: { ada: boolean, jumlahSaksi: number },
 * }} fakta
 */
function nilaiKesiapan(fakta = {}) {
  const penghambat = [];
  let nilai = 0;

  // ---------------------------------------------------------------- panggilan
  const keadaanPanggilan = ecourtPanggilanService.susunKeadaanPanggilan({
    persetujuan: fakta.persetujuan || [],
    panggilan: fakta.panggilan || [],
    relaas: fakta.relaas || [],
    tanggalSidang: fakta.tanggalSidang || null,
    lewatEcourt: fakta.lewatEcourt === true,
    // Kehadiran sidang sebelumnya menentukan siapa yang masih perlu
    // dipanggil. Tanpa ini seluruh sidang lanjutan menyalakan penghambat
    // berat "belum dipanggil" - padahal yang hadir memang tidak dipanggil
    // lagi, karena sudah diberitahu di ruang sidang.
    sisiWajib: Array.isArray(fakta.sisiWajib) ? fakta.sisiWajib : null,
  });

  const rp = keadaanPanggilan.ringkasan;

  if (rp.jumlahPihak === 0) {
    // Belum ada persetujuan tersimpan berarti perkaranya belum pernah ditarik
    // dari e-Court - bukan berarti tidak ada pihak.
    penghambat.push({
      tingkat: TINGKAT.sedang,
      kunci: "panggilan_belum_terbaca",
      pesan: "Persetujuan saluran para pihak belum terbaca dari e-Court.",
      sumber: "e-Court",
    });
  } else {
    // Penerimaan yang belum terbukti dihitung SETENGAH masalah: tenggangnya
    // sudah benar, yang kurang hanya buktinya. Menyamakannya dengan panggilan
    // yang terlambat membuat sidang tampak lebih genting daripada keadaannya.
    const bermasalah =
      rp.belumDipanggil + rp.salahSaluran + rp.tidakPatut + rp.penerimaanBelumTerbukti * 0.5;
    const bagian = Math.max(0, 1 - bermasalah / rp.jumlahPihak);
    nilai += BOBOT.panggilan * bagian;

    if (rp.belumDipanggil > 0) {
      penghambat.push({
        tingkat: TINGKAT.berat,
        kunci: "belum_dipanggil",
        pesan: `${rp.belumDipanggil} pihak belum tercatat dipanggil.`,
        sumber: "SIPP + e-Court",
      });
    }
    if (rp.salahSaluran > 0) {
      penghambat.push({
        tingkat: TINGKAT.berat,
        kunci: "salah_saluran",
        pesan: `${rp.salahSaluran} pihak dipanggil lewat saluran yang tidak sesuai persetujuannya.`,
        sumber: "e-Court",
      });
    }
    if (rp.tidakPatut > 0) {
      penghambat.push({
        tingkat: TINGKAT.berat,
        kunci: "tenggang_tidak_patut",
        pesan: `${rp.tidakPatut} panggilan berjarak kurang dari tenggang yang diatur.`,
        sumber: "SIPP + e-Court",
      });
    }
    if (rp.penerimaanBelumTerbukti > 0) {
      // SEDANG, bukan berat: suratnya sudah dikirim tepat waktu, yang belum
      // adalah bukti sampainya. Tindak lanjutnya menelusuri kiriman, bukan
      // memanggil ulang.
      penghambat.push({
        tingkat: TINGKAT.sedang,
        kunci: "penerimaan_belum_terbukti",
        pesan: `${rp.penerimaanBelumTerbukti} surat tercatat terkirim tepat waktu, tetapi penerimaannya belum terbukti.`,
        sumber: "SIPP",
      });
    }
  }

  // ------------------------------------------------------------------ majelis
  const majelis = Array.isArray(fakta.majelis) ? fakta.majelis : [];
  if (majelis.length > 0) {
    nilai += BOBOT.majelis;
  } else {
    penghambat.push({
      tingkat: TINGKAT.berat,
      kunci: "majelis_belum_ditetapkan",
      pesan: "Majelis hakim belum ditetapkan.",
      sumber: "SIPP",
    });
  }

  // ----------------------------------------------------------------- panitera
  const panitera = Array.isArray(fakta.panitera) ? fakta.panitera : [];
  if (panitera.length > 0) {
    nilai += BOBOT.panitera;
  } else {
    penghambat.push({
      tingkat: TINGKAT.sedang,
      kunci: "panitera_belum_ditunjuk",
      pesan: "Panitera sidang belum ditunjuk.",
      sumber: "SIPP",
    });
  }

  // ------------------------------------------------------------------- berkas
  const dokumen = Array.isArray(fakta.dokumen) ? fakta.dokumen : [];
  if (dokumen.length === 0) {
    penghambat.push({
      tingkat: TINGKAT.ringan,
      kunci: "belum_ada_dokumen_ecourt",
      pesan: "Belum ada dokumen e-Court tersimpan untuk perkara ini.",
      sumber: "e-Court",
    });
  } else {
    const tanpaBerkas = dokumen.filter((d) => !d.adaPdf && !d.adaWord).length;
    nilai += BOBOT.berkas * Math.max(0, 1 - tanpaBerkas / dokumen.length);

    if (tanpaBerkas > 0) {
      penghambat.push({
        tingkat: TINGKAT.sedang,
        kunci: "berkas_belum_tersimpan",
        pesan: `${tanpaBerkas} dokumen tercatat tetapi berkasnya belum tersimpan.`,
        sumber: "ALETA",
      });
    }

    // -------------------------------------------------------------- verifikasi
    //
    // Hanya dokumen yang MENGENAL verifikasi yang dihitung. Berkas pendaftaran
    // berstatus tidak_perlu tidak pernah menunggu siapa pun, dan menghitungnya
    // membuat setiap perkara tampak menunggu majelis.
    const perluVerifikasi = dokumen.filter((d) => d.statusVerifikasi !== "tidak_perlu");
    if (perluVerifikasi.length === 0) {
      nilai += BOBOT.verifikasi;
    } else {
      const menunggu = perluVerifikasi.filter((d) => d.statusVerifikasi === "belum").length;
      nilai += BOBOT.verifikasi * Math.max(0, 1 - menunggu / perluVerifikasi.length);

      if (menunggu > 0) {
        penghambat.push({
          tingkat: TINGKAT.sedang,
          kunci: "menunggu_verifikasi_majelis",
          pesan: `${menunggu} dokumen menunggu verifikasi majelis.`,
          sumber: "ALETA",
        });
      }
    }
  }

  // -------------------------------------------------------------- nomor pihak
  const nomorPihak = Array.isArray(fakta.nomorPihak) ? fakta.nomorPihak : [];
  if (nomorPihak.length === 0) {
    penghambat.push({
      tingkat: TINGKAT.ringan,
      kunci: "nomor_pihak_belum_terbaca",
      pesan: "Nomor kontak para pihak belum terbaca.",
      sumber: "SIPP",
    });
  } else {
    const bermasalah = nomorPihak.filter(
      (n) => !n.adaNomor || n.statusVerifikasi === "ditolak" || n.statusVerifikasi === "menunggu"
    ).length;
    nilai += BOBOT.nomorPihak * Math.max(0, 1 - bermasalah / nomorPihak.length);

    if (bermasalah > 0) {
      penghambat.push({
        tingkat: TINGKAT.ringan,
        kunci: "nomor_pihak_bermasalah",
        pesan: `${bermasalah} pihak tanpa nomor WhatsApp yang dapat dipakai.`,
        sumber: "ALETA",
      });
    }
  }

  // --------------------------------------------------------------------- saksi
  //
  // TIDAK ikut menentukan skor. Saksi hanya relevan pada agenda pembuktian, dan
  // menuntutnya pada sidang pertama akan membuat setiap sidang pertama tampak
  // belum siap - peringatan yang selalu menyala berhenti dibaca.
  const agenda = String(fakta.agenda || "").toLowerCase();
  const agendaPembuktian = /bukti|saksi/.test(agenda);
  if (agendaPembuktian && !(fakta.saksi && fakta.saksi.ada)) {
    penghambat.push({
      tingkat: TINGKAT.ringan,
      kunci: "saksi_belum_tercatat",
      pesan: "Agenda pembuktian, tetapi belum ada keterangan saksi tercatat di SIPP.",
      sumber: "SIPP",
    });
  }

  const skor = Math.round(Math.max(0, Math.min(100, nilai)));

  // Sidang dengan penghambat BERAT tidak pernah disebut siap, berapa pun
  // skornya. Berkas lengkap tidak menolong bila pihaknya belum dipanggil.
  const adaBerat = penghambat.some((x) => x.tingkat === TINGKAT.berat);
  const keadaan = adaBerat ? "bermasalah" : skor >= 85 ? "siap" : skor >= 60 ? "perhatian" : "bermasalah";

  return {
    skor,
    keadaan,
    penghambat,
    panggilan: keadaanPanggilan,
  };
}

/** Membungkus pemanggilan supaya satu sumber yang gagal tidak menjatuhkan sisanya. */
async function aman(kerja, cadangan) {
  try {
    return await kerja();
  } catch {
    return cadangan;
  }
}

/**
 * Mengumpulkan seluruh fakta satu sidang, lalu menilainya.
 *
 * Lima sumber diminta BERSAMAAN. Berurutan akan mengalikan waktu tunggu
 * sebanyak sumbernya, dan layar jadwal menilai puluhan sidang sekaligus.
 */
async function nilaiKesiapanPerkara(
  nomorPerkara,
  {
    sidangId = 0,
    tanggalSidang = null,
    agenda = "",
    // Keadaan panggilan yang SUDAH dihitung untuk sekumpulan sidang. Layar
    // jadwal menilai puluhan sidang sekaligus; menghitungnya sendiri-sendiri
    // di sini akan menembakkan tiga kueri per sidang untuk jawaban yang satu
    // kueri berkelompok sudah dapat memberikan seluruhnya.
    keadaanPanggilanSiap = null,
  } = {}
) {
  const nomor = String(nomorPerkara || "").trim();
  if (!nomor) return null;

  const rincian = await aman(() => sippJadwalSidangService.rincianSidang(nomor, sidangId), null);
  if (!rincian || !rincian.ok) {
    // Perkara yang tidak terbaca di SIPP tetap dinilai - hasilnya rendah,
    // dengan penghambat yang menyebutkan sebabnya. Mengembalikan null akan
    // membuat sidangnya tampak tanpa masalah di layar.
    return nilaiKesiapan({ tanggalSidang, agenda });
  }

  const [panggilanEcourt, dokumen, konteks, keadaanPanggilanSipp] = await Promise.all([
    aman(() => ecourtStoreService.bacaPanggilanPerkara(nomor), { pihak: [], panggilan: [] }),
    aman(() => ecourtStoreService.rincianArsipPerkara(nomor), { dokumen: [] }),
    aman(() => sippKonteksService.getKonteks(nomor), null),
    // Siapa yang WAJIB dipanggil pada sidang ini - dibaca dari kehadiran
    // sidang sebelumnya dan dari pihak yang benar-benar ada pada perkaranya.
    // Gagal-TERTUTUP: bila tidak terbaca, hasilnya null dan seluruh pihak
    // tetap dianggap wajib dipanggil.
    keadaanPanggilanSiap
      ? keadaanPanggilanSiap
      : rincian.perkaraId && sidangId
        ? aman(
            () =>
              sippJadwalSidangService.keadaanPanggilanSidang([
                { sidangId, perkaraId: rincian.perkaraId },
              ]),
            null
          )
        : null,
  ]);

  const keadaanSidangIni =
    keadaanPanggilanSipp && keadaanPanggilanSipp[String(sidangId)]
      ? keadaanPanggilanSipp[String(sidangId)]
      : null;

  return nilaiKesiapan({
    agenda,
    tanggalSidang,
    majelis: rincian.majelis,
    panitera: rincian.panitera,
    relaas: rincian.relaas,
    saksi: rincian.saksi,
    lewatEcourt: rincian.lewatEcourt === true,
    persetujuan: panggilanEcourt.pihak,
    panggilan: panggilanEcourt.panggilan,
    dokumen: dokumen.dokumen || [],
    nomorPihak: konteks && konteks.ok ? konteks.nomorPihak : [],
    sisiWajib: keadaanSidangIni ? keadaanSidangIni.wajibDipanggil : null,
  });
}

/**
 * Menilai sekumpulan sidang sekaligus - dipakai layar jadwal.
 *
 * Dibatasi supaya satu hari yang padat tidak berubah menjadi ratusan kueri.
 * Yang melewati batas TIDAK dinilai, dan itu disebutkan lewat medan dinilai
 * pada jawabannya - bukan dianggap siap.
 */
async function nilaiKesiapanBanyak(daftarSidang = [], { batas = 50 } = {}) {
  const hasil = {};
  const dipakai = daftarSidang.slice(0, Math.min(Math.max(Number(batas) || 50, 1), 200));

  // Keadaan panggilan seluruh sidang dihitung SEKALI di sini - tiga kueri
  // berkelompok untuk lima puluh sidang, bukan tiga kueri per sidang. Yang
  // memerlukan perkaraId sudah membawanya dari daftar jadwal.
  const berperkara = dipakai.filter((x) => x && x.sidangId && x.perkaraId);
  const keadaanPanggilanSiap =
    berperkara.length > 0
      ? await aman(
          () =>
            sippJadwalSidangService.keadaanPanggilanSidang(
              berperkara.map((x) => ({ sidangId: x.sidangId, perkaraId: x.perkaraId }))
            ),
          null
        )
      : null;

  for (const sidang of dipakai) {
    const kunci = `${sidang.nomorPerkara}|${sidang.sidangId}`;
    const nilai = await nilaiKesiapanPerkara(sidang.nomorPerkara, {
      sidangId: sidang.sidangId,
      tanggalSidang: sidang.tanggalSidang,
      agenda: sidang.agenda,
      keadaanPanggilanSiap,
    });
    if (nilai) {
      hasil[kunci] = { skor: nilai.skor, keadaan: nilai.keadaan, penghambat: nilai.penghambat };
    }
  }

  return { dinilai: dipakai.length, total: daftarSidang.length, kesiapan: hasil };
}

module.exports = {
  BOBOT,
  TINGKAT,
  nilaiKesiapan,
  nilaiKesiapanBanyak,
  nilaiKesiapanPerkara,
};
