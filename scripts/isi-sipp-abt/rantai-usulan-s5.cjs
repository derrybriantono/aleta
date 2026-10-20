// Rantai usulan Blangko Derry untuk SATU perkara (baca saja) - meniru panel (blangko-derry-isian.js: isiDariSipp ->
// susunTambahan -> mesin.kumpulkan) dan rute bot /abt/usulan. Dipakai ukur-isi-s5-20okt.cjs dan skrip lihat-perkara.
//   1. sumber "sipp"        = abtUsulanService.dariSipp(nomor)
//   2. sumber "posita-lain" = dariPositaLain -> tambahUsulanJenis -> sambunganPwh -> lengkapiPositaLain -> lengkapiUsulanDk
//                             -> blangkoDerry.lengkapiJenis (posita dari SIPP; panel mengirim posita ABT 5125 yang sama)
// Mengembalikan daftar usulan per sumber: [[...sipp], [...posita-lain]].
const path = require("path");

module.exports = function (akar) {
  const svc = (...p) => require(path.join(akar, "aleta_bot", "services", ...p));
  const abtUsulan = svc("abtUsulanService.js");
  const lain = svc("abtUsulanLainService.js");
  const jenisSvc = svc("deteksiJenisPerkaraService.js");
  const pwh = svc("deteksi", "sambunganPwh.js");
  const sambungY = svc("deteksi", "sambungPositaLain.js");
  const dkSvc = svc("deteksiDispensasiKawinService.js");
  const derry = svc("deteksi", "blangkoDerry.js");

async function kumpulUsulan(b) {
  const sumber = [];
  const nomor = b.nomor_perkara;
  const posita = String(b.posita || "");
  // 1. sipp
  try {
    const r = await abtUsulan.dariSipp(nomor);
    sumber.push((r && r.usulan) || []);
  } catch {
    /* diabaikan */
  }
  // 2. posita-lain (panel mengirim hanya bila posita ada dan bukan perkara cerai/itsbat)
  if (posita.replace(/<[^>]*>/g, " ").trim()) {
    try {
      const opsi = { jenisPerkara: String(b.j), alur: String(b.a) };
      let pl = lain.dariPositaLain(posita, { ...opsi, sebutan: {}, tipeKeluaran: null });
      try {
        pl = jenisSvc.tambahUsulanJenis(pl, posita, opsi);
      } catch {
        /* diabaikan */
      }
      try {
        const sipp = await pwh.bacaSipp(nomor);
        if (pwh.idJenis(String(b.j)) || (sipp && pwh.JENIS_PWH.has(sipp.jenisPerkaraId))) pl = pwh.tambahUsulanPwh(pl, posita, { ...opsi, sipp });
      } catch {
        /* diabaikan */
      }
      try {
        pl = await sambungY.lengkapiPositaLain(pl, { posita, nomorPerkara: nomor, ...opsi });
      } catch {
        /* diabaikan */
      }
      try {
        pl = dkSvc.lengkapiUsulanDk(pl, posita, { jenisPerkara: String(b.j) });
      } catch {
        /* diabaikan */
      }
      try {
        pl = await derry.lengkapiJenis(pl, { jalur: "posita-lain", posita, jenisPerkara: String(b.j), nomorPerkara: nomor });
      } catch {
        /* diabaikan */
      }
      sumber.push((pl && Array.isArray(pl.usulan) ? pl.usulan : []).filter(Boolean));
    } catch {
      /* diabaikan */
    }
  }
  return sumber;
}


  return { kumpulUsulan };
};
