#!/usr/bin/env node
/**
 * Menemukan DNS resolver mana yang bisa menerjemahkan nama penyedia AI dari
 * dalam container portal.
 *
 *   docker compose exec portal node scripts/diagnose-ai-dns.js
 *   docker compose exec portal node scripts/diagnose-ai-dns.js 192.168.10.1
 *
 * Latar: kegagalan "getaddrinfo EAI_AGAIN generativelanguage.googleapis.com"
 * berarti container tidak bisa MENERJEMAHKAN nama domain (DNS), bukan soal API
 * key. Skrip ini menguji beberapa resolver dan menunjukkan mana yang berhasil,
 * sehingga Anda tahu persis nilai apa yang harus dipakai.
 *
 * Argumen tambahan diperlakukan sebagai alamat DNS kantor yang ingin diuji.
 * Tidak ada API key dipakai; hanya kueri DNS.
 */
const dns = require("node:dns");
const dnsPromises = dns.promises;

const HOST = process.argv[2] && !/^\d+\.\d+\.\d+\.\d+$/.test(process.argv[2])
  ? process.argv[2]
  : "generativelanguage.googleapis.com";

// Resolver yang diuji: bawaan container + publik + apa pun yang diberikan lewat
// argumen (mis. DNS internal kantor).
const resolverTambahan = process.argv.slice(2).filter((arg) => /^\d+\.\d+\.\d+\.\d+$/.test(arg));
const KANDIDAT = [
  { label: "8.8.8.8 (Google)", servers: ["8.8.8.8"] },
  { label: "1.1.1.1 (Cloudflare)", servers: ["1.1.1.1"] },
  ...resolverTambahan.map((ip) => ({ label: `${ip} (DNS kantor)`, servers: [ip] })),
];

const BATAS_MS = Number(process.env.ALETA_DNS_TIMEOUT_MS || 5000);
const hijau = (t) => `[32m${t}[0m`;
const merah = (t) => `[31m${t}[0m`;
const kuning = (t) => `[33m${t}[0m`;

function batasWaktu(janji, ms, pesan) {
  return Promise.race([
    janji,
    new Promise((_, tolak) => setTimeout(() => tolak(new Error(pesan)), ms)),
  ]);
}

async function ujiResolver(servers) {
  const resolver = new dnsPromises.Resolver({ timeout: BATAS_MS, tries: 1 });
  resolver.setServers(servers);
  const alamat = await batasWaktu(resolver.resolve4(HOST), BATAS_MS + 500, `tidak ada jawaban dalam ${BATAS_MS} ms`);
  return alamat;
}

async function main() {
  console.log(`\nUji DNS dari dalam container portal -> ${HOST}\n`);

  // 1) Resolver bawaan container (jalur yang dipakai fetch dan yang gagal).
  console.log("Resolver bawaan container:");
  console.log(`  Server dikonfigurasi: ${dns.getServers().join(", ") || "(tidak ada)"}`);
  let bawaanBerhasil = false;
  try {
    const hasil = await batasWaktu(dnsPromises.lookup(HOST), BATAS_MS + 500, `EAI_AGAIN / tidak ada jawaban dalam ${BATAS_MS} ms`);
    console.log(`  ${hijau("OK")}    getaddrinfo -> ${hasil.address}`);
    bawaanBerhasil = true;
  } catch (galat) {
    const kode = galat && galat.code ? ` (${galat.code})` : "";
    console.log(`  ${merah("GAGAL")} ${galat && galat.message ? galat.message : galat}${kode}`);
  }

  // 2) Resolver kandidat.
  console.log("\nResolver alternatif:");
  const berhasil = [];
  for (const kandidat of KANDIDAT) {
    try {
      const alamat = await ujiResolver(kandidat.servers);
      console.log(`  ${hijau("OK")}    ${kandidat.label} -> ${alamat.slice(0, 3).join(", ")}`);
      berhasil.push(kandidat.servers[0]);
    } catch (galat) {
      console.log(`  ${merah("GAGAL")} ${kandidat.label} - ${galat && galat.message ? galat.message : galat}`);
    }
  }

  console.log("");
  if (bawaanBerhasil) {
    console.log(hijau("DNS container SEHAT."));
    console.log("Bila Uji Koneksi AI masih gagal, sebabnya bukan DNS: periksa firewall keluar");
    console.log("(port 443), sertifikat proxy, atau API key.");
    process.exit(0);
  }

  if (berhasil.length === 0) {
    console.log(merah("Tidak ada resolver yang berhasil."));
    console.log("Jaringan kemungkinan memblokir DNS keluar sepenuhnya. Pilihan:");
    console.log("  - minta admin jaringan membuka DNS/port 53, atau");
    console.log("  - arahkan ALETA keluar lewat proxy kantor: isi HTTPS_PROXY di .env.production");
    console.log("    (lihat panduan v1.6.2), lalu jalankan: docker compose up -d portal");
    process.exit(1);
  }

  const pilih = berhasil[0];
  console.log(hijau(`SOLUSI: resolver ${pilih} berhasil.`));
  console.log("Arahkan container portal ke sana, lalu jalankan ulang:");
  console.log("");
  console.log("  1. Buat/edit berkas .env di /var/www/html/aleta (di samping docker-compose.yml):");
  console.log(`       ALETA_DNS_PRIMARY=${pilih}`);
  if (berhasil[1]) console.log(`       ALETA_DNS_SECONDARY=${berhasil[1]}`);
  console.log("  2. Terapkan:");
  console.log("       cd /var/www/html/aleta && docker compose up -d portal");
  console.log("");
  console.log(kuning("Catatan: 8.8.8.8/1.1.1.1 sudah menjadi default. Bila keduanya berhasil,"));
  console.log(kuning("cukup bangun ulang container agar default itu terpakai — tidak perlu set apa pun."));
  process.exit(0);
}

main().catch((galat) => {
  console.error(merah("Diagnosa DNS gagal dijalankan:"), galat && galat.message ? galat.message : galat);
  process.exit(2);
});
