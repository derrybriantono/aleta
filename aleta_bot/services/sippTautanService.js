"use strict";

/**
 * ============================================================================
 * TAUTAN KE HALAMAN SATU PERKARA DI SIPP
 * ============================================================================
 *
 * Tombol "Buka SIPP" dan "Salin tautan" di Status Perkara seharusnya membawa
 * petugas ke halaman PERKARANYA, bukan ke beranda SIPP. SIPP tidak punya alamat
 * ber-id polos untuk itu. Satu-satunya pintu masuk adalah
 *
 *     perkara_detil_agama/<enc>     (routes.php -> manage_perkara::setParams)
 *
 * dengan <enc> = base64_encode($this->encrypt->encode($perkara_id)) - persis
 * yang dicetak perkara_list.php pada kolom [detil]. Halaman detil_perkara_agama
 * sendiri tidak dapat dibuka ulang: ia membaca perkara_id dari flash session
 * yang diisi pintu masuk itu, dan tanpa itu dialihkan ke beranda.
 *
 * Karena itu <enc> dibangkitkan di sini, dengan langkah yang SAMA PERSIS dengan
 * CodeIgniter 2.2.0 (system/libraries/Encrypt.php milik SIPP):
 *
 *   kunci  = md5(config encryption_key) - 32 karakter heksa yang DIPAKAI
 *            SEBAGAI 32 bait, bukan 16 bait md5 mentahnya
 *   sandi  = Rijndael BLOK 256 bit (MCRYPT_RIJNDAEL_256 - BUKAN AES, yang
 *            bloknya selalu 128 bit), mode CBC, IV acak 32 bait, data
 *            dipadatkan "\0" sampai kelipatan 32 bait
 *   derau  = tiap bait (IV . sandi) ditambah bait sha1-heksa(kunci), mod 256
 *   dalam  = base64(derau)                    - hasil encode() CI
 *   <enc>  = base64(dalam)                    - base64 kedua dari perkara_list.php
 *
 * Node crypto tidak punya Rijndael berblok 256 bit (hanya AES), jadi sandinya
 * ditulis di bawah dalam JS murni. Kebenarannya tidak diandaikan: diuji silang
 * dengan PHP 5.6 + mcrypt + Encrypt.php SIPP sendiri, dua arah, dan diuji-diri
 * sekali sebelum tautan pertama dibangkitkan.
 *
 * IV-nya acak, sama seperti SIPP: tiap pembangkitan menghasilkan <enc> yang
 * berbeda, dan semuanya sah.
 *
 * ============================================================================
 * KUNCINYA TIDAK PERNAH KELUAR DARI BERKAS INI
 * ============================================================================
 *
 * Kunci yang sama menyandikan cookie sesi SIPP (sess_encrypt_cookie TRUE).
 * Siapa pun yang memegangnya dapat memalsukan sesi SIPP. Karena itu:
 *
 *   - dibaca dari config SIPP yang SUDAH terpasang hanya-baca di container
 *     (/usr/src/app/SIPP), tidak disalin ke pengaturan ALETA;
 *   - disimpan di memori modul ini saja - tidak dikembalikan, tidak dicatat,
 *     dan tidak pernah ikut dalam pesan galat;
 *   - yang keluar hanya <enc>, dan <enc> itu setara dengan yang sudah dicetak
 *     SIPP sendiri untuk setiap petugas yang membuka daftar perkaranya.
 *
 * ============================================================================
 * SIPP HANYA DIBACA
 * ============================================================================
 *
 * Seluruh kueri berkas ini SELECT, nilai dari luar selalu masuk sebagai
 * parameter.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const db = require("../db_config");
const { cleanText, normalizeCaseNumber } = require("./ecourtTextService");
// Akar folder SIPP yang sudah dipakai bot untuk berkas perkara - satu sumber,
// supaya config.php dicari di tempat yang sama dengan dokumen SIPP lainnya.
const { SIPP_DOCUMENT_ROOTS } = require("./sippDocumentService");

// ============================================================================
// RIJNDAEL BLOK 256 BIT, KUNCI 256 BIT
// ============================================================================

const NB = 8; // kolom per blok: 256 bit
const NK = 8; // kolom per kunci: 256 bit (md5 heksa = 32 bait)
const NR = 14; // putaran: 6 + max(NB, NK)
const BLOK = 4 * NB; // 32 bait

/**
 * Pergeseran baris untuk NB = 8 menurut spesifikasi Rijndael: 0, 1, 3, 4.
 *
 * INILAH beda yang paling mudah terlewat dari AES. AES (NB = 4) menggeser
 * 0, 1, 2, 3; memakai angka AES di sini menghasilkan sandi yang tampak wajar
 * tetapi tidak dapat dibuka SIPP - dan satu-satunya gejalanya halaman perkara
 * yang kosong.
 */
const GESER = [0, 1, 3, 4];

const SBOX = new Uint8Array(256);
const SBOX_BALIK = new Uint8Array(256);

(function susunSbox() {
  // Dibangkitkan, bukan disalin sebagai tabel 256 angka: satu angka yang salah
  // ketik di tabel tidak akan terlihat oleh mata, sedangkan rumus ini diuji
  // penuh oleh vektor mcrypt.
  const putarKiri = (x, n) => ((x << n) | (x >> (8 - n))) & 0xff;
  let p = 1;
  let q = 1;
  do {
    // p dikali 3 dan q dibagi 3 di GF(2^8), sehingga q selalu kebalikan p.
    p = (p ^ (p << 1) ^ (p & 0x80 ? 0x1b : 0)) & 0xff;
    q = (q ^ (q << 1)) & 0xff;
    q = (q ^ (q << 2)) & 0xff;
    q = (q ^ (q << 4)) & 0xff;
    if (q & 0x80) q ^= 0x09;
    SBOX[p] = q ^ putarKiri(q, 1) ^ putarKiri(q, 2) ^ putarKiri(q, 3) ^ putarKiri(q, 4) ^ 0x63;
  } while (p !== 1);
  SBOX[0] = 0x63;
  for (let i = 0; i < 256; i += 1) SBOX_BALIK[SBOX[i]] = i;
})();

function kali2(a) {
  return ((a << 1) ^ (a & 0x80 ? 0x1b : 0)) & 0xff;
}

/** Perkalian di GF(2^8). */
function kali(a, b) {
  let hasil = 0;
  let x = a;
  let y = b;
  while (y) {
    if (y & 1) hasil ^= x;
    x = kali2(x);
    y >>= 1;
  }
  return hasil;
}

/** Jadwal kunci: 480 bait, 32 bait per putaran, bersusun sama dengan keadaan. */
function jadwalKunci(kunci) {
  if (!kunci || kunci.length !== 4 * NK) {
    throw new Error(`Kunci Rijndael harus ${4 * NK} bait.`);
  }
  const jumlahKata = NB * (NR + 1);
  const w = new Uint8Array(4 * jumlahKata);
  w.set(kunci);
  let rcon = 1;
  for (let i = NK; i < jumlahKata; i += 1) {
    let t0 = w[4 * (i - 1)];
    let t1 = w[4 * (i - 1) + 1];
    let t2 = w[4 * (i - 1) + 2];
    let t3 = w[4 * (i - 1) + 3];
    if (i % NK === 0) {
      // RotWord, SubWord, lalu rcon pada bait pertama.
      const awal = t0;
      t0 = SBOX[t1] ^ rcon;
      t1 = SBOX[t2];
      t2 = SBOX[t3];
      t3 = SBOX[awal];
      rcon = kali2(rcon);
    } else if (NK > 6 && i % NK === 4) {
      t0 = SBOX[t0];
      t1 = SBOX[t1];
      t2 = SBOX[t2];
      t3 = SBOX[t3];
    }
    w[4 * i] = w[4 * (i - NK)] ^ t0;
    w[4 * i + 1] = w[4 * (i - NK) + 1] ^ t1;
    w[4 * i + 2] = w[4 * (i - NK) + 2] ^ t2;
    w[4 * i + 3] = w[4 * (i - NK) + 3] ^ t3;
  }
  return w;
}

function tambahKunciPutaran(s, rk, putaran) {
  const awal = putaran * BLOK;
  for (let j = 0; j < BLOK; j += 1) s[j] ^= rk[awal + j];
}

/** Menyandikan satu blok. Keadaan bersusun kolom: bait ke-(4c + r) = baris r, kolom c. */
function sandiBlok(rk, masuk) {
  const s = Uint8Array.from(masuk);
  const t = new Uint8Array(BLOK);
  tambahKunciPutaran(s, rk, 0);
  for (let putaran = 1; putaran <= NR; putaran += 1) {
    // SubBytes dan ShiftRows sekaligus.
    for (let c = 0; c < NB; c += 1) {
      for (let r = 0; r < 4; r += 1) t[4 * c + r] = SBOX[s[4 * ((c + GESER[r]) % NB) + r]];
    }
    if (putaran === NR) {
      s.set(t);
    } else {
      // MixColumns.
      for (let c = 0; c < NB; c += 1) {
        const a0 = t[4 * c];
        const a1 = t[4 * c + 1];
        const a2 = t[4 * c + 2];
        const a3 = t[4 * c + 3];
        s[4 * c] = kali2(a0) ^ kali2(a1) ^ a1 ^ a2 ^ a3;
        s[4 * c + 1] = a0 ^ kali2(a1) ^ kali2(a2) ^ a2 ^ a3;
        s[4 * c + 2] = a0 ^ a1 ^ kali2(a2) ^ kali2(a3) ^ a3;
        s[4 * c + 3] = kali2(a0) ^ a0 ^ a1 ^ a2 ^ kali2(a3);
      }
    }
    tambahKunciPutaran(s, rk, putaran);
  }
  return s;
}

/** Membuka satu blok - kebalikan sandiBlok, langkah demi langkah. */
function bukaBlok(rk, masuk) {
  const s = Uint8Array.from(masuk);
  const t = new Uint8Array(BLOK);
  tambahKunciPutaran(s, rk, NR);
  for (let putaran = NR - 1; putaran >= 0; putaran -= 1) {
    // InvShiftRows dan InvSubBytes sekaligus.
    for (let c = 0; c < NB; c += 1) {
      for (let r = 0; r < 4; r += 1) t[4 * ((c + GESER[r]) % NB) + r] = SBOX_BALIK[s[4 * c + r]];
    }
    s.set(t);
    tambahKunciPutaran(s, rk, putaran);
    if (putaran > 0) {
      // InvMixColumns.
      for (let c = 0; c < NB; c += 1) {
        const a0 = s[4 * c];
        const a1 = s[4 * c + 1];
        const a2 = s[4 * c + 2];
        const a3 = s[4 * c + 3];
        s[4 * c] = kali(a0, 14) ^ kali(a1, 11) ^ kali(a2, 13) ^ kali(a3, 9);
        s[4 * c + 1] = kali(a0, 9) ^ kali(a1, 14) ^ kali(a2, 11) ^ kali(a3, 13);
        s[4 * c + 2] = kali(a0, 13) ^ kali(a1, 9) ^ kali(a2, 14) ^ kali(a3, 11);
        s[4 * c + 3] = kali(a0, 11) ^ kali(a1, 13) ^ kali(a2, 9) ^ kali(a3, 14);
      }
    }
  }
  return s;
}

/**
 * Pemadatan "\0" sampai kelipatan blok, seperti mcrypt_encrypt/mcrypt_decrypt
 * PHP 5.6 (((panjang - 1) / blok) + 1) * blok - termasuk teks kosong yang
 * menjadi satu blok nol.
 */
function padatkan(bait) {
  const panjang = Math.max(1, Math.ceil(bait.length / BLOK)) * BLOK;
  const hasil = Buffer.alloc(panjang);
  Buffer.from(bait).copy(hasil);
  return hasil;
}

function sandiCbc(rk, iv, data) {
  const keluar = Buffer.alloc(data.length);
  let sebelum = iv;
  for (let i = 0; i < data.length; i += BLOK) {
    const blok = new Uint8Array(BLOK);
    for (let j = 0; j < BLOK; j += 1) blok[j] = data[i + j] ^ sebelum[j];
    const sandi = sandiBlok(rk, blok);
    keluar.set(sandi, i);
    sebelum = sandi;
  }
  return keluar;
}

function bukaCbc(rk, iv, data) {
  const keluar = Buffer.alloc(data.length);
  let sebelum = iv;
  for (let i = 0; i < data.length; i += BLOK) {
    const sandi = data.subarray(i, i + BLOK);
    const polos = bukaBlok(rk, sandi);
    for (let j = 0; j < BLOK; j += 1) keluar[i + j] = polos[j] ^ sebelum[j];
    sebelum = sandi;
  }
  return keluar;
}

// ============================================================================
// FORMAT CI_Encrypt
// ============================================================================

/**
 * Bahan sandi dari kunci config SIPP (bait mentah).
 *
 * Isinya sama rahasianya dengan kuncinya sendiri - 32 bait pertama jadwal kunci
 * ADALAH md5 heksa kunci config, dan itu yang sesungguhnya dipakai SIPP.
 */
function bahanDariKunci(baitKunci) {
  const md5Heksa = crypto.createHash("md5").update(baitKunci).digest("hex");
  const kunciSandi = Buffer.from(md5Heksa, "latin1");
  return {
    rk: jadwalKunci(kunciSandi),
    // _add_cipher_noise: $this->hash($key) atas kunci md5 heksa - sha1 heksa,
    // 40 karakter, dipakai bait-bait ASCII-nya.
    derau: Buffer.from(crypto.createHash("sha1").update(kunciSandi).digest("hex"), "latin1"),
  };
}

function tambahDerau(data, derau) {
  const hasil = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 1) hasil[i] = (data[i] + derau[i % derau.length]) & 0xff;
  return hasil;
}

function buangDerau(data, derau) {
  const hasil = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 1) hasil[i] = (data[i] - derau[i % derau.length] + 256) & 0xff;
  return hasil;
}

/** Setara $this->encrypt->encode($teks): base64(derau(IV . CBC(teks))). */
function encodeCi(teks, bahan, ivTegas) {
  const iv = ivTegas ? Buffer.from(ivTegas) : crypto.randomBytes(BLOK);
  if (iv.length !== BLOK) throw new Error(`IV harus ${BLOK} bait.`);
  const sandi = sandiCbc(bahan.rk, iv, padatkan(Buffer.from(teks, "latin1")));
  return tambahDerau(Buffer.concat([iv, sandi]), bahan.derau).toString("base64");
}

/**
 * Setara $this->encrypt->decode($teks), termasuk FALSE-nya (di sini null).
 * Dipakai uji dan uji diri; SIPP-lah yang mendekode tautannya.
 */
function decodeCi(teks, bahan) {
  if (/[^a-zA-Z0-9/+=]/.test(teks)) return null;
  const mentah = buangDerau(Buffer.from(teks, "base64"), bahan.derau);
  if (mentah.length < BLOK) return null;
  const polos = bukaCbc(bahan.rk, mentah.subarray(0, BLOK), padatkan(mentah.subarray(BLOK)));
  let akhir = polos.length;
  while (akhir > 0 && polos[akhir - 1] === 0) akhir -= 1;
  return polos.subarray(0, akhir).toString("latin1");
}

/**
 * Segmen yang aman di jalur URL SIPP.
 *
 * Syaratnya dua: tanpa "/" (memecah segment(2), dan setParams() menjawab 404
 * bila segmennya lebih dari tiga) dan hanya karakter yang lolos
 * permitted_uri_chars SIPP ('+=\a-z 0-9~%.:_-', tanpa beda huruf besar-kecil).
 *
 * Base64 atas teks base64 sesungguhnya TIDAK PERNAH menghasilkan "/" maupun
 * "+": bait masukannya hanya huruf, angka, "+", "/", dan "=" (0x2B-0x7A),
 * sehingga keempat kelompok enam bit tiap tiga bait paling tinggi bernilai 30,
 * 55, 61, dan 61 - tidak pernah 62 ("+") atau 63 ("/"). Pemeriksaan ini jaring
 * pengaman atas kekeliruan penulisan - base64 kedua yang terhapus, misalnya -
 * bukan atas peluang.
 */
const POLA_SEGMEN_AMAN = /^[A-Za-z0-9]+={0,2}$/;
const COBA_SEGMEN = 8;

function segmenUntuk(teks, bahan, ivTegas) {
  for (let coba = 0; coba < COBA_SEGMEN; coba += 1) {
    const segmen = Buffer.from(encodeCi(teks, bahan, ivTegas), "latin1").toString("base64");
    if (POLA_SEGMEN_AMAN.test(segmen)) return segmen;
    if (ivTegas) break;
  }
  throw new Error("Segmen tautan SIPP tidak aman di jalur URL walau sudah dibangkitkan ulang.");
}

// ============================================================================
// UJI DIRI - SEKALI, SEBELUM TAUTAN PERTAMA
// ============================================================================
//
// Vektor dari PHP 5.6 + mcrypt + Encrypt.php SIPP sendiri, dengan KUNCI UJI
// (bukan kunci SIPP). Sandi yang keliru tidak berbunyi di mana pun: SIPP
// mendekodenya menjadi sampah, dan petugas melihat halaman perkara kosong.
// Lebih baik tidak ada tautan sama sekali daripada tautan ke halaman yang salah.
const VEKTOR_UJI_DIRI = {
  ecb: {
    kunciHex: "221bdc7110642c8af930db9b0a48d52ce7f38144bbf9c66b2ca40daa62ba3c89",
    blokHex: "9f935bb240df3e309e704365e20c51d9b4facf953c06a921217443848a0e8747",
    sandiHex: "002d3e5b52d57a0b45539b7e374f0b0f1e758e4b55e307c09397ca3af903a12d",
  },
  // IV-nya dikeluarkan dari hasil encode() SIPP sendiri (_remove_cipher_noise),
  // jadi segmen JS dengan IV yang sama wajib sama persis sampai bait terakhir.
  ci: {
    kunci: "ujia1eta2026x",
    teks: "27772",
    ivHex: "87f4796225adf86bbfe9d86c7f7103ec0d8cdef49003530db01ec93b97a32a0a",
    enc: "NlZlc2xGa1BLODBqSVRtZXQ2bGxUMFhGUXl6MlpvcHlGVlVyYjh6YmpUcVRyWDQ5QkRtWXZIbGZDNHZJR2RLNXhYUjdjTzZqUE1nenRzcWxrR09Dd3c9PQ==",
  },
};

let hasilUjiDiri = null;

function ujiDiri() {
  if (hasilUjiDiri !== null) return hasilUjiDiri;
  try {
    const { ecb, ci } = VEKTOR_UJI_DIRI;
    const rk = jadwalKunci(Buffer.from(ecb.kunciHex, "hex"));
    const sandi = Buffer.from(sandiBlok(rk, Buffer.from(ecb.blokHex, "hex"))).toString("hex");
    const balik = Buffer.from(bukaBlok(rk, Buffer.from(ecb.sandiHex, "hex"))).toString("hex");
    const bahan = bahanDariKunci(Buffer.from(ci.kunci, "latin1"));
    const segmen = segmenUntuk(ci.teks, bahan, Buffer.from(ci.ivHex, "hex"));
    hasilUjiDiri = sandi === ecb.sandiHex && balik === ecb.blokHex && segmen === ci.enc;
  } catch (galat) {
    console.warn(`[sippTautan] uji diri sandi melempar: ${galat.message}`);
    hasilUjiDiri = false;
  }
  return hasilUjiDiri;
}

// ============================================================================
// KUNCI DARI CONFIG SIPP
// ============================================================================

const POLA_BARIS_KUNCI =
  /^[ \t]*\$config\s*\[\s*(['"])encryption_key\1\s*\]\s*=\s*('(?:[^'\\]|\\[\s\S])*'|"(?:[^"\\]|\\[\s\S])*")\s*;/gm;
const POLA_ADA_PENETAPAN = /^[ \t]*\$config\s*\[\s*(['"])encryption_key\1\s*\]\s*=/m;

/** Isi literal string PHP apa adanya, atau null bila memuat variabel. */
function isiLiteralPhp(literal) {
  const kutip = literal[0];
  const badan = literal.slice(1, -1);
  if (kutip === "'") return badan.replace(/\\([\\'])/g, "$1");

  // Kutip ganda: "$..." adalah penyisipan variabel dan tidak dapat dihitung di
  // luar PHP - lebih baik menolak daripada menebak kunci yang keliru.
  const ESKAPE = { n: "\n", t: "\t", r: "\r", v: "\v", e: "\x1b", f: "\f", "\\": "\\", $: "$", '"': '"' };
  let hasil = "";
  for (let i = 0; i < badan.length; i += 1) {
    const huruf = badan[i];
    if (huruf === "$") return null;
    if (huruf !== "\\" || i === badan.length - 1) {
      hasil += huruf;
      continue;
    }
    const berikut = badan[i + 1];
    const oktal = /^[0-7]{1,3}/.exec(badan.slice(i + 1));
    const heksa = /^x([0-9A-Fa-f]{1,2})/.exec(badan.slice(i + 1));
    if (Object.hasOwn(ESKAPE, berikut)) {
      hasil += ESKAPE[berikut];
      i += 1;
    } else if (oktal) {
      hasil += String.fromCharCode(parseInt(oktal[0], 8) & 0xff);
      i += oktal[0].length;
    } else if (heksa) {
      hasil += String.fromCharCode(parseInt(heksa[1], 16));
      i += heksa[0].length;
    } else {
      // Garis miring balik yang tidak dikenal tetap tertulis, seperti PHP.
      hasil += huruf;
    }
  }
  return hasil;
}

/**
 * encryption_key dari isi config.php (dibaca latin1 supaya tiap bait tetap
 * satu karakter - md5 PHP bekerja atas bait, bukan atas huruf).
 *
 * Baris yang dikomentari tidak dihitung, dan yang TERAKHIR yang berlaku -
 * sama dengan PHP menjalankan berkasnya dari atas ke bawah.
 */
function uraiKunciConfig(isi) {
  const tanpaBlokKomentar = String(isi).replace(/\/\*[\s\S]*?\*\//g, "");
  const cocok = [...tanpaBlokKomentar.matchAll(POLA_BARIS_KUNCI)];
  if (cocok.length === 0) {
    return POLA_ADA_PENETAPAN.test(tanpaBlokKomentar)
      ? { ok: false, sebab: "tidak_dapat_diurai" }
      : { ok: false, sebab: "tidak_ditemukan" };
  }
  const kunci = isiLiteralPhp(cocok[cocok.length - 1][2]);
  if (kunci === null) return { ok: false, sebab: "tidak_dapat_diurai" };
  // get_key(): `if ($key == FALSE) show_error(...)` - dan di PHP "0" == FALSE.
  if (kunci === "" || kunci === "0") return { ok: false, sebab: "kosong" };
  return { ok: true, kunci };
}

function jalurConfigCalon() {
  const tegas = String(process.env.ALETA_SIPP_CONFIG_PATH || "").trim();
  if (tegas) return [tegas];
  return SIPP_DOCUMENT_ROOTS.map((akar) => path.join(akar, "application", "config", "config.php"));
}

// ============================================================================
// PESAN GAGAL BERUPA SEBAB SAJA
// ============================================================================
//
// Portal mendahuluinya dengan "Alamat halaman perkara di SIPP belum dapat
// disusun." - untuk kegagalan dari sini maupun untuk bot yang tidak terjangkau,
// yang pesannya datang dari gatewayFetch dan tidak menyebut tautan sama sekali.
// Karena itu kalimat di sini tidak mengulang bagian itu.
const PESAN_BUKA_MANUAL = "Buka SIPP lalu cari perkaranya dari sana.";

// ============================================================================
// KUNCI TIDAK TERBACA: RINCIANNYA KE LOG, KE LAYAR SATU KALIMAT
// ============================================================================
//
// Pesan gagal di sini sampai ke layar SETIAP pengguna berkemampuan panel, bukan
// hanya pengelola. Jalur berkas di dalam container dan nama pengaturan tidak
// berguna bagi petugas dan tidak perlu terlihat olehnya. Rinciannya dicatat ke
// log aleta-bot - jalur dan sebabnya saja, tidak pernah isi berkas atau
// kuncinya - dan layar cukup tahu bahwa tautannya belum dapat dibuat serta
// siapa yang dapat membereskannya. Kalimatnya SAMA untuk tiap sebab: yang
// membedakan sebab adalah log, bukan layar.
const PESAN_KUNCI_TIDAK_TERBACA =
  "Pengaturan tautan SIPP di ALETA belum lengkap. Buka SIPP lalu cari perkaranya dari sana, " +
  "dan minta admin ALETA memeriksa pengaturan tautan SIPP (rinciannya tercatat di log aleta-bot).";

/**
 * Layar Status Perkara meminta tautan setiap kali satu perkara dibuka. Tanpa
 * penyaring ini, satu pengaturan yang keliru menulis satu baris log per perkara
 * yang dibuka, dan baris yang berguna tenggelam. Sebab yang sama dicatat ulang
 * paling cepat sepuluh menit kemudian; sebab yang berbeda langsung dicatat.
 */
const SELANG_CATAT_ULANG_MS = 10 * 60 * 1000;
let catatanKunciTerakhir = null;

function catatKegagalanKunci(rincian) {
  const kini = Date.now();
  if (catatanKunciTerakhir?.rincian === rincian && kini - catatanKunciTerakhir.pada < SELANG_CATAT_ULANG_MS) return;
  catatanKunciTerakhir = { rincian, pada: kini };
  console.warn(`[sippTautan] kunci SIPP tidak terbaca: ${rincian}`);
}

function gagalKunci(rincianPengelola) {
  catatKegagalanKunci(rincianPengelola);
  return { ok: false, alasan: "kunci_tidak_terbaca", message: PESAN_KUNCI_TIDAK_TERBACA };
}

/** Singgahan bahan sandi: { tanda, bahan }. Tidak pernah dikembalikan. */
let singgahKunci = null;

/**
 * Bahan sandi dari kunci SIPP, disinggahkan di memori.
 *
 * Urutan sumber:
 *   1. ALETA_SIPP_ENCRYPTION_KEY - timpaan, hanya untuk SIPP yang config-nya
 *      tidak dapat diurai (kuncinya berupa ekspresi). Setel HANYA pada layanan
 *      aleta-bot, jangan di berkas env bersama: portal tidak perlu tahu.
 *   2. ALETA_SIPP_CONFIG_PATH - jalur config.php yang ditegaskan.
 *   3. <akar SIPP>/application/config/config.php untuk tiap akar
 *      ALETA_BOT_SIPP_DOCUMENT_ROOTS (bawaan /var/www/html/SIPP dan
 *      /usr/src/app/SIPP - yang kedua itulah mount hanya-baca di peladen).
 *
 * Berkasnya diperiksa ulang (waktu ubah + ukuran) tiap kali dipakai, supaya
 * pembaruan SIPP yang mengganti kuncinya tidak membuat ALETA terus menyusun
 * tautan dengan kunci lama.
 */
function bahanKunci() {
  const dariEnv = String(process.env.ALETA_SIPP_ENCRYPTION_KEY || "");
  if (dariEnv) {
    // Tanda singgahan berupa sidik, bukan kuncinya sendiri.
    const tanda = `env:${crypto.createHash("sha256").update(dariEnv).digest("hex")}`;
    if (singgahKunci?.tanda !== tanda) singgahKunci = { tanda, bahan: bahanDariKunci(Buffer.from(dariEnv, "utf8")) };
    return { ok: true, bahan: singgahKunci.bahan };
  }

  const calon = jalurConfigCalon();
  for (const jalur of calon) {
    let keadaan;
    try {
      keadaan = fs.statSync(jalur);
    } catch {
      continue;
    }
    if (!keadaan.isFile()) continue;

    const tanda = `berkas:${jalur}:${keadaan.mtimeMs}:${keadaan.size}`;
    if (singgahKunci?.tanda === tanda) return { ok: true, bahan: singgahKunci.bahan };

    let isi;
    try {
      isi = fs.readFileSync(jalur, "latin1");
    } catch (galat) {
      return gagalKunci(`berkas ${jalur} ada tetapi tidak dapat dibaca (${galat.code || galat.message}).`);
    }
    const urai = uraiKunciConfig(isi);
    if (!urai.ok) {
      const sebab = {
        tidak_ditemukan: `encryption_key tidak ditemukan di ${jalur}.`,
        tidak_dapat_diurai: `encryption_key di ${jalur} bukan teks biasa (memuat variabel atau ekspresi); setel ALETA_SIPP_ENCRYPTION_KEY pada layanan aleta-bot.`,
        kosong: `encryption_key di ${jalur} kosong - SIPP sendiri tidak dapat menyandikan dengan kunci itu.`,
      }[urai.sebab];
      return gagalKunci(sebab);
    }
    singgahKunci = { tanda, bahan: bahanDariKunci(Buffer.from(urai.kunci, "latin1")) };
    return { ok: true, bahan: singgahKunci.bahan };
  }

  return gagalKunci(
    `config.php SIPP tidak ditemukan (dicari di ${calon.join(", ")}). Pasang folder SIPP hanya-baca ke container aleta-bot, atau setel ALETA_SIPP_CONFIG_PATH.`
  );
}

// ============================================================================
// PINTU MASUK DAN PERKARANYA
// ============================================================================

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

/**
 * Pintu masuk menurut jenis pengadilan - cabang yang sama dengan kolom [detil]
 * perkara_list.php. Jenisnya dibaca SIPP saat login dari sys_config id 83
 * (login.php), dan nilai kosong dibaca 1.
 *
 * Bila sys_config tidak terbaca, perkara_detil dipakai: pintu umum itu
 * mengalihkan sendiri menurut jenis pengadilan di sesi petugas, jadi tetap
 * sampai ke halaman yang benar bagi petugas yang sudah masuk SIPP.
 */
const PINTU_MENURUT_JENIS = {
  1: "perkara_detil",
  2: "perkara_detil_mil",
  3: "perkara_detil_tun",
  4: "perkara_detil_agama",
};
const PINTU_UMUM = "perkara_detil";
const UMUR_SINGGAH_PINTU_MS = 10 * 60 * 1000;
let singgahPintu = null;

async function pintuMasuk() {
  if (singgahPintu && singgahPintu.sampai > Date.now()) return singgahPintu.pintu;
  try {
    const baris = await runQuery("SELECT value AS nilai FROM sys_config WHERE id = 83 LIMIT 1");
    const teks = String(baris[0]?.nilai ?? "").trim();
    const pintu = PINTU_MENURUT_JENIS[teks === "" ? 1 : Number(teks)] || PINTU_UMUM;
    singgahPintu = { pintu, sampai: Date.now() + UMUR_SINGGAH_PINTU_MS };
    return pintu;
  } catch (galat) {
    // Tidak disinggahkan: kegagalan sesaat tidak boleh mengunci pilihan umum
    // selama sepuluh menit.
    console.warn(`[sippTautan] jenis pengadilan tidak terbaca, memakai ${PINTU_UMUM}: ${galat.message}`);
    return PINTU_UMUM;
  }
}

function gagal(alasan, message) {
  return { ok: false, alasan, message };
}

/** Nomor perkara untuk dibandingkan: spasi dirapikan, huruf besar-kecil diabaikan. */
function samakanNomor(nomor) {
  return normalizeCaseNumber(nomor).toUpperCase();
}

async function cariPerkara(perkaraId, nomor) {
  if (perkaraId) {
    const baris = await runQuery(
      `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara
         FROM perkara p
        WHERE p.perkara_id = ?
        LIMIT 1`,
      [perkaraId]
    );
    return baris[0] || null;
  }
  // Nomor kembar - tidak ada di data sekarang, tetapi tidak dilarang SIPP -
  // diwakili perkara_id terbesar, aturan yang sama dengan identitasPerkara di
  // sippStatusPerkaraService. Tautannya harus membuka perkara yang SAMA dengan
  // yang sedang ditampilkan Status Perkara.
  const baris = await runQuery(
    `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara
       FROM perkara p
      WHERE p.nomor_perkara = ?
      ORDER BY p.perkara_id DESC
      LIMIT 1`,
    [nomor]
  );
  return baris[0] || null;
}

/**
 * Jalur relatif halaman satu perkara: "perkara_detil_agama/<enc>".
 *
 * Menerima perkaraId, nomor, atau keduanya. Bila keduanya dikirim dan tidak
 * menunjuk perkara yang sama, TIDAK ada tautan yang disusun: membuka perkara
 * lain tanpa ada yang menyadarinya jauh lebih mahal daripada satu tombol yang
 * menolak.
 *
 * Yang dikembalikan hanya jalur relatifnya. Alamat SIPP menurut peramban
 * petugas hanya diketahui portal.
 */
async function tautanPerkara({ perkaraId, nomor } = {}) {
  const id = String(perkaraId ?? "").trim();
  const nomorBersih = normalizeCaseNumber(nomor ?? "");

  if (!id && !nomorBersih) {
    return gagal("masukan_kosong", "Perkara belum dipilih.");
  }
  if (id && !/^\d{1,10}$/.test(id)) {
    return gagal("perkara_id_tidak_sah", "Pengenal perkara tidak sah.");
  }

  // Kunci dan sandi diperiksa LEBIH DAHULU: tanpa keduanya SIPP tidak perlu
  // disentuh sama sekali.
  const kunci = bahanKunci();
  if (!kunci.ok) return kunci;
  if (!ujiDiri()) {
    return gagal(
      "sandi_tidak_lulus_uji",
      "Penyandi tautan SIPP di ALETA tidak lulus uji diri, dan tautan yang keliru dapat membuka perkara lain. " +
        `${PESAN_BUKA_MANUAL} Laporkan ke pengelola ALETA.`
    );
  }

  let perkara;
  let pintu;
  try {
    perkara = await cariPerkara(id, nomorBersih);
    pintu = perkara ? await pintuMasuk() : "";
  } catch (galat) {
    console.warn(`[sippTautan] SIPP tidak terbaca: ${galat.message}`);
    return gagal("sipp_tidak_terbaca", `SIPP tidak dapat dibaca saat ini. ${PESAN_BUKA_MANUAL}`);
  }

  if (!perkara) {
    return gagal(
      "perkara_tidak_ditemukan",
      id ? `Perkara dengan pengenal ${id} tidak ditemukan di SIPP.` : `Perkara ${nomorBersih} tidak ditemukan di SIPP.`
    );
  }

  const nomorSipp = cleanText(perkara.nomorPerkara);
  if (id && nomorBersih && samakanNomor(nomorSipp) !== samakanNomor(nomorBersih)) {
    return gagal(
      "nomor_tidak_cocok",
      `Nomor perkara yang diminta (${nomorBersih}) tidak sama dengan perkara yang dirujuk (${nomorSipp || "tanpa nomor"}). Muat ulang Status Perkara lalu coba lagi.`
    );
  }

  // Yang disandikan teks perkara_id DARI SIPP, bukan masukan: "007" dan "7"
  // menunjuk perkara yang sama, tetapi hanya "7" yang dikenali SIPP.
  const idSipp = String(perkara.perkaraId);
  return {
    ok: true,
    jalur: `${pintu}/${segmenUntuk(idSipp, kunci.bahan)}`,
    pintu,
    perkaraId: idSipp,
    nomorPerkara: nomorSipp,
  };
}

/**
 * Nilai <option> bersandi untuk select2 SIPP - base64_encode(
 * $this->encrypt->encode($teks)), bentuk yang dipulangkan addPihak/cariProp..
 * cariKel dan didekode pihak_list::validateInput sebelum disimpan (perbaikan
 * 2 Okt 2026 butir 16, sippWilayahService). Bentuknya SAMA PERSIS dengan
 * segmen tautan, jadi penyandi, kunci, dan uji dirinya dipakai bersama -
 * tidak ada salinan kedua sandi Rijndael di bot.
 *
 * Kuncinya tetap tidak pernah keluar: yang dipulangkan hanya nilai bersandi,
 * setara dengan yang dicetak SIPP sendiri ke tiap petugas yang membuka
 * blangko pihak.
 */
function nilaiPilihanSipp(teks) {
  const t = String(teks === null || teks === undefined ? "" : teks).trim();
  if (!t) return gagal("masukan_kosong", "Nilai yang hendak disandikan kosong.");
  const kunci = bahanKunci();
  if (!kunci.ok) {
    return {
      ok: false,
      alasan: kunci.alasan,
      message: "Pengaturan sandi SIPP di ALETA belum lengkap, jadi pilihan wilayah tidak dapat diisikan otomatis. Pilih wilayahnya sendiri di blangko SIPP.",
    };
  }
  if (!ujiDiri()) {
    return gagal(
      "sandi_tidak_lulus_uji",
      "Penyandi SIPP di ALETA tidak lulus uji diri. Pilih wilayahnya sendiri di blangko SIPP, lalu laporkan ke pengelola ALETA."
    );
  }
  return { ok: true, nilai: segmenUntuk(t, kunci.bahan) };
}

module.exports = {
  tautanPerkara,
  nilaiPilihanSipp,
  // Pola segmen dibuka supaya portal dan uji memeriksa bentuk yang sama.
  POLA_SEGMEN_AMAN,
  PINTU_MENURUT_JENIS,
  // Untuk uji: seluruhnya menerima KUNCI UJI secara tegas dan tidak menyentuh
  // kunci SIPP yang tersinggah.
  _uji: {
    SBOX,
    GESER,
    jadwalKunci,
    sandiBlok,
    bukaBlok,
    bahanDariKunci,
    encodeCi,
    decodeCi,
    segmenUntuk,
    uraiKunciConfig,
    jalurConfigCalon,
    ujiDiri,
    VEKTOR_UJI_DIRI,
    lupakan() {
      singgahKunci = null;
      singgahPintu = null;
      hasilUjiDiri = null;
      catatanKunciTerakhir = null;
    },
  },
};
