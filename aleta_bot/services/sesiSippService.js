"use strict";

/**
 * ============================================================================
 * SESI SIPP YANG TERBUKTI - DASAR MASUK OTOMATIS DARI SIPP KE ALETA (11 Okt 2026)
 * ============================================================================
 *
 * Permintaan pengguna 11 Okt: petugas yang sudah masuk SIPP harus dikenali
 * ALETA tanpa mengetik apa pun lagi. Bot TIDAK membaca kepala halaman SIPP
 * (teks itu dapat ditulis siapa saja): ia membuka cookie sesi SIPP yang
 * dikirim peramban ke portal - portal dan SIPP satu asal (satu host), dan
 * cookie ci_session ber-path "/" sehingga ikut ke /aleta - dengan kunci SIPP
 * sendiri (sippTautanService.bukaCookieSesiSipp: HMAC + Rijndael CI2).
 *
 * Berkas ini memeriksa ISI sesi yang sudah terbuka, dengan aturan
 * Session.php::sess_read SIPP sendiri:
 *
 *   - serial PHP berbentuk array dengan session_id, ip_address, user_agent,
 *     last_activity;
 *   - last_activity + sess_expiration >= sekarang;
 *   - user_agent = 120 huruf pertama User-Agent peramban (sess_match_useragent
 *     TRUE di config SIPP) - cookie yang dicuri ke peramban lain ditolak;
 *   - is_logged_in benar dan userid berupa angka (controller SIPP memeriksa
 *     is_logged_in di tiap halaman).
 *
 * Yang dipulangkan ke portal hanya identitas (userid, username, nama) dan
 * keadaan akun - session_id dan isi cookie tidak pernah keluar dari bot.
 */

/**
 * Pengurai serial PHP secukupnya (s, i, d, b, N, a). Objek (O/C) tidak
 * didukung - sesi SIPP tidak memuatnya; bila ada, hasilnya null (ditolak).
 * Panjang string PHP dihitung dalam BAIT; teksnya diperlakukan latin1 supaya
 * satu karakter = satu bait, lalu nilai string diubah ke UTF-8 di akhir.
 */
function uraiSerialPhp(teks) {
  const s = String(teks || "");
  let i = 0;

  function bacaSampai(huruf) {
    const akhir = s.indexOf(huruf, i);
    if (akhir < 0) throw new Error("serial terpotong");
    const hasil = s.slice(i, akhir);
    i = akhir + 1;
    return hasil;
  }

  function nilai(dalam) {
    if (dalam > 8) throw new Error("serial terlalu dalam");
    const jenis = s[i];
    if (jenis === "N") {
      if (s[i + 1] !== ";") throw new Error("N rusak");
      i += 2;
      return null;
    }
    if (s[i + 1] !== ":") throw new Error("serial rusak");
    i += 2;
    if (jenis === "b") return bacaSampai(";") === "1";
    if (jenis === "i") {
      const n = bacaSampai(";");
      if (!/^-?\d+$/.test(n)) throw new Error("i rusak");
      return Number(n);
    }
    if (jenis === "d") return Number(bacaSampai(";"));
    if (jenis === "s") {
      const panjang = Number(bacaSampai(":"));
      if (!Number.isInteger(panjang) || panjang < 0 || s[i] !== '"') throw new Error("s rusak");
      const isi = s.slice(i + 1, i + 1 + panjang);
      if (isi.length !== panjang || s[i + 1 + panjang] !== '"' || s[i + 2 + panjang] !== ";") throw new Error("s rusak");
      i += panjang + 3;
      return Buffer.from(isi, "latin1").toString("utf8");
    }
    if (jenis === "a") {
      const jumlah = Number(bacaSampai(":"));
      if (!Number.isInteger(jumlah) || jumlah < 0 || jumlah > 5000 || s[i] !== "{") throw new Error("a rusak");
      i += 1;
      const hasil = {};
      for (let k = 0; k < jumlah; k += 1) {
        const kunci = nilai(dalam + 1);
        if (typeof kunci !== "string" && typeof kunci !== "number") throw new Error("kunci a rusak");
        hasil[String(kunci)] = nilai(dalam + 1);
      }
      if (s[i] !== "}") throw new Error("a tidak tertutup");
      i += 1;
      return hasil;
    }
    throw new Error(`jenis serial ${jenis} tidak didukung`);
  }

  try {
    const hasil = nilai(0);
    return i === s.length ? hasil : null;
  } catch {
    return null;
  }
}

/** Setara trim() PHP atas substr(user_agent, 0, 120). */
function potongAgen(ua) {
  return String(ua || "").slice(0, 120).trim();
}

/**
 * Memeriksa isi sesi SIPP yang sudah terbuka.
 * Pulang { terbukti: true, sippUserId, username, namaLengkap, loginTime }
 * atau { terbukti: false, sebab }.
 */
function periksaIsiSesi(serial, { userAgent, kini = Date.now(), kedaluwarsaDetik = 7200 } = {}) {
  const sesi = uraiSerialPhp(serial);
  if (!sesi || typeof sesi !== "object" || Array.isArray(sesi)) return { terbukti: false, sebab: "isi_sesi_rusak" };
  for (const ruas of ["session_id", "ip_address", "user_agent", "last_activity"]) {
    if (!(ruas in sesi)) return { terbukti: false, sebab: "isi_sesi_rusak" };
  }
  const terakhir = Number(sesi.last_activity);
  if (!Number.isFinite(terakhir) || terakhir + Number(kedaluwarsaDetik) < Math.floor(kini / 1000)) {
    return { terbukti: false, sebab: "sesi_kedaluwarsa" };
  }
  if (potongAgen(sesi.user_agent) !== potongAgen(userAgent)) {
    return { terbukti: false, sebab: "peramban_berbeda" };
  }
  const masuk = sesi.is_logged_in === true || sesi.is_logged_in === 1 || sesi.is_logged_in === "1";
  if (!masuk) return { terbukti: false, sebab: "belum_masuk_sipp" };
  const userid = String(sesi.userid === null || sesi.userid === undefined ? "" : sesi.userid).trim();
  if (!/^\d+$/.test(userid)) return { terbukti: false, sebab: "belum_masuk_sipp" };
  return {
    terbukti: true,
    sippUserId: userid,
    username: String(sesi.username || ""),
    namaLengkap: String(sesi.fullname || ""),
    loginTime: String(sesi.login_time || ""),
  };
}

/** Semua nilai ci_session dari kepala Cookie (bisa lebih dari satu path). */
function nilaiCookieSesi(kepalaCookie, nama = "ci_session") {
  const hasil = [];
  for (const potong of String(kepalaCookie || "").split(";")) {
    const sama = potong.indexOf("=");
    if (sama < 0) continue;
    if (potong.slice(0, sama).trim() !== nama) continue;
    const isi = potong.slice(sama + 1).trim();
    if (isi) hasil.push(isi);
  }
  return hasil.slice(0, 4);
}

module.exports = { uraiSerialPhp, periksaIsiSesi, nilaiCookieSesi, potongAgen };
