// Pemetaan folder blangko Derry -> modul deteksi bot dan jenis/alur perkara SIPP (untuk frekuensi dan gerbang tombol).
/** Folder Derry -> modul deteksi yang melayaninya + kunci frekuensi (jenis/alur perkara SIPP). */
function petaFolder(folder) {
  const f = folder.replace(/ - BAS$/, "");
  const r = (modul, freq) => ({ modul, freq });
  if (/^ALUR 11 /.test(f)) return r(["itsbat-nikah"], ["360/16"]);
  if (/^ALUR 12 /.test(f)) return r(["dispensasi-kawin"], ["362/16"]);
  if (/^ALUR 13 /.test(f)) return r(["asal-usul"], ["358/16"]);
  if (/^ALUR \d\d /.test(f) || /CONTRA PERCERAIAN|VERSTEK PERCERAIAN|Kumulasi Cerai Gugat/.test(f)) return r(["cerai"], ["347/15", "346/15"]);
  if (/^1 Perceraian CG/.test(f)) return r(["cerai"], ["347/15"]);
  if (/^1a Perceraian CT/.test(f)) return r(["cerai"], ["346/15"]);
  if (/^1c /.test(f)) return r(["cerai", "itsbat-nikah"], ["360/15"]);
  if (/^1d /.test(f)) return r(["cerai", "hadhanah"], []);
  if (/ITSTBAT|Itsbat Nikah/i.test(f) && /^2a /.test(f)) return r(["itsbat-nikah"], ["360/15"]);
  if (/^2 Itsbat|ITSTBAT|Itsbat Nikah Gugur/i.test(f)) return r(["itsbat-nikah"], ["360/16"]);
  if (/^3 Dispensasi/.test(f)) return r(["dispensasi-kawin"], ["362/16"]);
  if (/^4a /.test(f)) return r(["harta-bersama"], ["348/15"]);
  if (/^4b /.test(f)) return r(["waris"], ["364/15"]);
  if (/^4c /.test(f)) return r(["waris"], ["365/15"]);
  if (/^5 Izin/.test(f)) return r(["izin-poligami"], ["341/15"]);
  if (/^5a /.test(f)) return r([], ["344/15"]);
  if (/^5b /.test(f)) return r([], ["342/16"]);
  if (/^6 Perwalian/.test(f)) return r(["perwalian"], ["354/16"]);
  if (/^6a /.test(f)) return r(["hadhanah"], ["369/15"]);
  if (/^6b /.test(f)) return r(["hadhanah"], ["349/15"]);
  if (/^7 Wali/.test(f)) return r(["wali-adhol"], ["363/16"]);
  if (/^8 Asal|ASAL USUL/.test(f)) return r(["asal-usul"], ["358/16"]);
  if (/^9 Penetapan Ahli Waris/.test(f)) return r(["waris"], ["371/16"]);
  if (/^9a /.test(f)) return r(["pengangkatan-anak", "lain-lain"], ["369/16"]);
  if (/^9b /.test(f)) return r(["lain-lain"], ["369/16"]);
  if (/^10a /.test(f)) return r([], ["370/15"]);
  if (/^10 /.test(f)) return r([], ["370/17"]);
  // Relaas, sita, PTSP dipakai lintas jenis perkara: bobot 1 per blangko, pengisi mana pun dari jenis apa pun dihitung.
  if (/^(98 Relaas|97 Sita|99 PTSP)/.test(f)) return { modul: [], freq: [], universal: true };
  return r([], []);
}

/** Id jenis perkara SIPP (angka) yang memakai folder ini; [] bila lintas jenis (relaas, sita, PTSP) atau tak terpetakan. */
function petaFolderJenis(folder) {
  const pf = petaFolder(folder);
  const ids = new Set(pf.freq.map((k) => Number(k.split("/")[0])));
  if (/^1d /.test(folder)) ids.add(347);
  return [...ids];
}

module.exports = { petaFolder, petaFolderJenis };
