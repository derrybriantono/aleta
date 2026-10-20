"use strict";

/**
 * ============================================================================
 * HITUNGAN BAGIAN AHLI WARIS (KHI Pasal 176-182, 185, 192, 193) - USULAN UNTUK HAKIM
 * ============================================================================
 *
 * Murni (tanpa jaringan/basis data). Mengikuti PERSIS aturan variabel ABT 9768/9769/9770 (kueri di server, paket I26 18 Okt):
 * bagian dzawil furud dalam duapuluhempatan, ashabah menerima sisa (laki-laki dua berbanding satu perempuan), aul bila pembilang
 * melebihi penyebut, radd bila sisa tanpa ashabah dan tanpa pasangan/ayah. Keadaan yang tidak diatur tegas oleh KHI (kakek tanpa
 * ayah, nenek dari pihak ayah tanpa ibu tetapi ada ayah, saudara bersama anak perempuan, lebih dari satu anak pengganti) dikembalikan
 * sebagai `fb` (diputus hakim) - TIDAK ada angka yang dikarang.
 *
 * Keputusan tentang bagian TETAP milik hakim: hasil ini hanya diusulkan sebagai isian 4515 dengan keyakinan "ragu".
 * Uji: manajemen_surat/src/test/u5-faraid.test.ts membandingkan hasil ini dengan kueri 9769 (dijalankan pada MariaDB lokal).
 */

const gcd = (a, b) => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const pecah = (n, d) => {
  const g = gcd(n, d) || 1;
  return [n / g, d / g];
};
const teksPecahan = ([n, d]) => `${n}/${d}`;

const adalahPerempuan = (nama) => /\sbinti\s/i.test(` ${nama} `);
const hitungPerempuan = (daftar) => daftar.filter(adalahPerempuan).length;

/** @param {string[]|undefined} x */
const arr = (x) => (Array.isArray(x) ? x.map((s) => String(s || "").trim()).filter(Boolean) : []);

/**
 * @param {{
 *   pewarisPerempuan: boolean,
 *   pasangan?: string[], anak?: string[], penggantiInduk?: string, cucu?: string[],
 *   ayah?: string, ibu?: string, kakek?: string, nenekIbu?: string[], nenekAyah?: string[], saudara?: string[], seibu?: string[]
 * }} i
 * @returns {{
 *   kasus: "kosong"|"fb"|"exact"|"aul"|"radd"|"ashabah",
 *   alasanFb?: string,
 *   penyebut?: number,
 *   bagian: Array<{nama: string, peran: string, pecahan: string, pembilang: number, penyebut: number, pasal: string, catatan?: string}>,
 *   mahjub: Array<{nama: string, peran: string, alasan: string}>,
 *   rincian: string[]
 * }}
 */
function hitung(i) {
  const pas = arr(i.pasangan);
  const ank = arr(i.anak);
  const cuc = arr(i.cucu);
  const pgd = String(i.penggantiInduk || "").trim();
  const ni = arr(i.nenekIbu);
  const na = arr(i.nenekAyah);
  const sdr = arr(i.saudara);
  const sdi = arr(i.seibu);
  const ayh = String(i.ayah || "").trim();
  const ibu = String(i.ibu || "").trim();
  const kak = String(i.kakek || "").trim();
  const sex = i.pewarisPerempuan ? "P" : "L";

  const np = pas.length;
  const nalt = ank.length;
  const nap = hitungPerempuan(ank);
  const pgm = pgd.includes(";");
  const pgmis = Boolean(pgd) !== Boolean(cuc.length);
  const pg1 = pgd && cuc.length && !pgm ? 1 : 0;
  const pgp = pg1 && /binti/i.test(pgd) ? 1 : 0;
  const pgl = pg1 - pgp;
  const nal = nalt - nap;
  const al = nal + pgl;
  const ap = nap + pgp;
  const ac = al + ap;
  const nc = cuc.length;
  const ncp = hitungPerempuan(cuc);
  const ay = ayh ? 1 : 0;
  const ib = ibu ? 1 : 0;
  const kk = kak ? 1 : 0;
  const nni = ni.length;
  const nna = na.length;
  const ns = sdr.length;
  const nsp = hitungPerempuan(sdr);
  const nsl = ns - nsp;
  const nsi = sdi.length;
  const nsip = hitungPerempuan(sdi);
  const hc = ac > 0 ? 1 : 0;
  const nsa = ns + nsi;

  const ada = np + nalt + pg1 + (pgm ? 1 : 0) + ay + ib + kk + nni + nna + ns + nsi === 0 ? 0 : 1;
  if (!ada) return { kasus: "kosong", bagian: [], mahjub: [], rincian: [] };
  if (pgmis) return { kasus: "fb", alasanFb: "ahli waris pengganti harus diisi berpasangan (anak yang meninggal lebih dahulu dan cucunya)", bagian: [], mahjub: [], rincian: [] };

  const fbk = kk === 1 && ay === 0;
  const fbn = nna > 0 && ay === 1 && ib === 0;
  const fbs = ns > 0 && ap > 0 && al === 0 && ay === 0;
  const fbp = pgm;
  const sact = ns > 0 && ac === 0 && ay === 0 ? 1 : 0;
  const sash = sact === 1 && nsl > 0 ? 1 : 0;
  const siact = nsi > 0 && ac === 0 && ay === 0 ? 1 : 0;
  const neact = (nni > 0 && ib === 0) || (nna > 0 && ib === 0 && ay === 0) ? 1 : 0;

  const usp = np === 0 ? 0 : sex === "P" ? (hc ? 6 : 12) : hc ? 3 : 6;
  const uay = ay === 0 ? 0 : hc ? 4 : 8;
  const uib = ib === 0 ? 0 : hc || nsa >= 2 ? 4 : ay === 1 && np > 0 ? Math.floor((24 - usp) / 3) : 8;
  const une = neact ? 4 : 0;
  const uan = al === 0 && ap > 0 ? (ap === 1 ? 12 : 16) : 0;
  const usd = sact === 1 && nsl === 0 ? (nsp === 1 ? 12 : 16) : 0;
  const usi = siact === 1 ? (nsi === 1 ? 4 : 8) : 0;
  const us = [usp, uay, uib, une, uan, usd, usi];
  const ada_ = (set) => (us.some((u) => set.includes(u)) ? 1 : 0);
  const h8 = ada_([3]);
  const h4 = ada_([6]);
  const h6 = ada_([4]);
  const h3 = ada_([8, 16]);
  const h2 = ada_([12]);
  const base = h8 ? (h3 + h6 > 0 ? 24 : 8) : h4 ? (h3 + h6 > 0 ? 12 : 4) : h6 ? 6 : h3 ? (h2 ? 6 : 3) : h2 ? 2 : 1;
  const m = us.map((u) => Math.floor((u * base) / 24));
  const [msp, may, mib, mne, man, msd, msi] = m;
  const sb = m.reduce((a, b) => a + b, 0);
  const musy = sash === 1 && sb >= base ? 1 : 0;
  const fb = fbk || fbn || fbs || fbp || musy;
  const ash = al > 0 || sash === 1 ? 1 : 0;
  let kasus;
  if (fb) kasus = "fb";
  else if (sb > base) kasus = "aul";
  else if (sb === base) kasus = "exact";
  else if (ash) kasus = "ashabah";
  else if (np === 0 && ay === 0) kasus = "radd";
  else kasus = "fbsisa";

  if (kasus === "fb" || kasus === "fbsisa") {
    const alasan = fbk
      ? "ada kakek tanpa ayah: KHI tidak mengatur bagian kakek"
      : fbn
        ? "ada nenek dari pihak ayah bersama ayah tanpa ibu: KHI tidak mengatur bagiannya"
        : fbs
          ? "ada saudara bersama anak perempuan: KHI tidak mengatur kedudukannya"
          : fbp
            ? "lebih dari seorang anak pewaris yang meninggal lebih dahulu dengan keturunan"
            : musy
              ? "bagian dzawil furud sudah habis sedangkan ada saudara ashabah"
              : "ada sisa harta peninggalan tanpa ahli waris ashabah yang diatur tegas";
    return { kasus: "fb", alasanFb: alasan, bagian: [], mahjub: [], rincian: [] };
  }

  const dn = kasus === "aul" || kasus === "radd" ? sb : base;
  const sisa = kasus === "ashabah" ? base - sb : 0;
  const bagian = [];
  const mahjub = [];
  const rincian = [];
  const tambah = (nama, peran, [n, d], pasal, catatan) => {
    const p = pecah(n, d);
    bagian.push({ nama, peran, pecahan: teksPecahan(p), pembilang: p[0], penyebut: p[1], pasal, ...(catatan ? { catatan } : {}) });
  };
  const bagi = (total, jumlah) => pecah(total, dn * jumlah);

  // pasangan
  if (np) {
    const pasal = sex === "P" ? "Pasal 179" : "Pasal 180";
    const peran = sex === "P" ? "duda" : np > 1 ? "janda" : "janda";
    for (const n of pas) tambah(n, peran, bagi(msp, np), pasal, hc ? "ada anak" : "tanpa anak");
    rincian.push(`${peran} ${np > 1 ? `(${np} orang) bersama-sama ` : ""}${teksPecahan(pecah(msp, dn))} karena Pewaris ${hc ? "meninggalkan" : "tidak meninggalkan"} anak (${pasal})`);
  }
  if (ay) {
    tambah(ayh, "ayah", pecah(may, dn), "Pasal 177", hc ? "ada anak" : "tanpa anak");
    rincian.push(`ayah ${teksPecahan(pecah(may, dn))} karena Pewaris ${hc ? "meninggalkan" : "tidak meninggalkan"} anak (Pasal 177)`);
  }
  if (ib) {
    tambah(ibu, "ibu", pecah(mib, dn), "Pasal 178", hc ? "ada anak" : nsa >= 2 ? "ada dua saudara atau lebih" : ay && np ? "sepertiga sisa bersama ayah" : "tanpa anak dan saudara");
    rincian.push(`ibu ${teksPecahan(pecah(mib, dn))} (Pasal 178)`);
  }
  if (neact) {
    const aktif = [...ni.map((n) => [n, "nenek (dari pihak ibu)"]), ...(ay === 0 ? na.map((n) => [n, "nenek (dari pihak ayah)"]) : [])];
    for (const [n, peran] of aktif) tambah(n, peran, bagi(mne, aktif.length), "dasar penetapan hakim", "seperenam dibagi sama rata");
    rincian.push(`nenek ${teksPecahan(pecah(mne, dn))} dibagi sama rata (tidak diatur tegas dalam KHI; mengikuti hukum waris Islam)`);
  } else {
    for (const n of ni) mahjub.push({ nama: n, peran: "nenek (dari pihak ibu)", alasan: "ibu Pewaris masih hidup" });
    for (const n of na) mahjub.push({ nama: n, peran: "nenek (dari pihak ayah)", alasan: ay ? "ayah Pewaris masih hidup" : "ibu Pewaris masih hidup" });
  }
  if (kk && ay) mahjub.push({ nama: kak, peran: "kakek", alasan: "ayah Pewaris masih hidup" });

  // anak (perempuan saja: dzawil furud; ada laki-laki: ashabah)
  const slotAnak = [];
  for (const n of ank) slotAnak.push({ nama: n, p: adalahPerempuan(n), cucu: null });
  if (pg1) slotAnak.push({ nama: pgd, p: Boolean(pgp), cucu: cuc });
  if (al === 0 && ap > 0) {
    for (const s of slotAnak) {
      const bag = bagi(man, ap);
      if (s.cucu) {
        const campur = ncp > 0 && ncp < nc;
        if (campur) tambah(s.cucu.join(", "), "cucu (pengganti)", bagi(man, ap), "Pasal 185", `bagian bersama menggantikan ${s.nama}; pembagian di antara cucu laki-laki dan perempuan diputus hakim`);
        else for (const c of s.cucu) tambah(c, "cucu (pengganti)", pecah(man, dn * ap * nc), "Pasal 185", `menggantikan ${s.nama}`);
      } else tambah(s.nama, "anak perempuan", bag, "Pasal 176", ap === 1 ? "satu anak perempuan: 1/2" : "dua anak perempuan atau lebih: 2/3");
    }
    rincian.push(`anak perempuan ${ap === 1 ? "tunggal" : `(${ap} orang) bersama-sama`} ${teksPecahan(pecah(man, dn))} (Pasal 176)`);
  } else if (al > 0) {
    const satuan = 2 * al + ap;
    for (const s of slotAnak) {
      const unit = s.p ? 1 : 2;
      const bag = pecah(sisa * unit, dn * satuan);
      if (s.cucu) {
        const campur = ncp > 0 && ncp < nc;
        if (campur) tambah(s.cucu.join(", "), "cucu (pengganti)", bag, "Pasal 185", `bagian bersama menggantikan ${s.nama}; pembagian di antara cucu laki-laki dan perempuan diputus hakim`);
        else for (const c of s.cucu) tambah(c, "cucu (pengganti)", pecah(sisa * unit, dn * satuan * nc), "Pasal 185", `menggantikan ${s.nama}`);
      } else tambah(s.nama, s.p ? "anak perempuan" : "anak laki-laki", bag, "Pasal 176", "ashabah: laki-laki dua berbanding satu perempuan");
    }
    rincian.push(`anak ${ap ? "laki-laki dan perempuan" : "laki-laki"} menerima sisa ${teksPecahan(pecah(sisa, dn))} dengan perbandingan 2 : 1 (Pasal 176)`);
  }

  // saudara
  if (ns) {
    if (sact === 0) for (const n of sdr) mahjub.push({ nama: n, peran: "saudara kandung atau seayah", alasan: ac > 0 ? "Pewaris meninggalkan anak" : "ayah Pewaris masih hidup" });
    else if (sash === 0) {
      for (const n of sdr) tambah(n, "saudara perempuan kandung atau seayah", bagi(msd, nsp), "Pasal 182", nsp === 1 ? "satu saudara perempuan: 1/2" : "dua saudara perempuan atau lebih: 2/3");
      rincian.push(`saudara perempuan ${nsp === 1 ? "tunggal" : `(${nsp} orang) bersama-sama`} ${teksPecahan(pecah(msd, dn))} (Pasal 182)`);
    } else {
      const satuan = 2 * nsl + nsp;
      for (const n of sdr) tambah(n, adalahPerempuan(n) ? "saudara perempuan kandung atau seayah" : "saudara laki-laki kandung atau seayah", pecah(sisa * (adalahPerempuan(n) ? 1 : 2), dn * satuan), "Pasal 182", "ashabah: laki-laki dua berbanding satu perempuan");
      rincian.push(`saudara menerima sisa ${teksPecahan(pecah(sisa, dn))} dengan perbandingan laki-laki 2 : 1 perempuan (Pasal 182)`);
    }
  }
  if (nsi) {
    if (siact === 0) for (const n of sdi) mahjub.push({ nama: n, peran: "saudara seibu", alasan: ac > 0 ? "Pewaris meninggalkan anak" : "ayah Pewaris masih hidup" });
    else {
      for (const n of sdi) tambah(n, "saudara seibu", bagi(msi, nsi), "Pasal 181", nsi === 1 ? "seorang: 1/6" : "dua orang atau lebih: 1/3 dibagi sama rata");
      rincian.push(`saudara seibu ${nsi === 1 ? "tunggal" : `(${nsi} orang) bersama-sama`} ${teksPecahan(pecah(msi, dn))} (Pasal 181)`);
    }
  }
  if (kasus === "aul") rincian.push(`pembilang bagian ${sb} melebihi penyebut ${base}: aul, penyebut menjadi ${sb} (Pasal 192)`);
  if (kasus === "radd") rincian.push(`bagian ${sb}/${base} tanpa ashabah, pasangan dan ayah: radd, sisa dibagi berimbang (Pasal 193)`);
  if (kasus === "ashabah") rincian.push(`setelah bagian dzawil furud ${teksPecahan(pecah(sb, base))}, sisa ${teksPecahan(pecah(base - sb, base))} diterima ahli waris ashabah`);
  if (kasus === "exact" && ash === 0) rincian.push("bagian dzawil furud genap satu bagian utuh");
  // jumlah bagian harus 1 (periksa internal)
  let jml = [0, 1];
  for (const b of bagian) jml = pecah(jml[0] * b.penyebut + b.pembilang * jml[1], jml[1] * b.penyebut);
  return { kasus, penyebut: dn, bagian, mahjub, rincian, jumlah: teksPecahan(jml) };
}

/** Teks isian 4515: "Nama (peran) pecahan; ..." */
function teksBagian(h) {
  return h.bagian.map((b) => `${b.nama} (${b.peran}) ${b.pecahan}`).join("; ");
}

module.exports = { hitung, teksBagian, adalahPerempuan, pecah, teksPecahan };
