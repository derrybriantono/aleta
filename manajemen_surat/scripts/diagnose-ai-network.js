#!/usr/bin/env node
/**
 * Menunjuk LAPISAN MANA yang putus saat ALETA memanggil penyedia AI.
 *
 *   docker compose exec portal node scripts/diagnose-ai-network.js
 *   docker compose exec portal node scripts/diagnose-ai-network.js api.openai.com
 *
 * "fetch failed" di layar tidak memberi tahu apa pun soal penyebabnya. Skrip
 * ini menguji berurutan: variabel proxy -> DNS -> TCP -> TLS -> HTTPS. Yang
 * pertama gagal itulah yang harus dibereskan; sisanya tidak perlu ditebak.
 *
 * Tidak ada API key yang dipakai dan tidak ada data yang dikirim keluar selain
 * permintaan kosong ke halaman depan penyedia.
 */
const dns = require("node:dns").promises;
const net = require("node:net");
const tls = require("node:tls");
const http = require("node:http");
const https = require("node:https");

const HOST = process.argv[2] || "generativelanguage.googleapis.com";
const PORT = 443;
const BATAS_MS = Number(process.env.ALETA_DIAGNOSE_TIMEOUT_MS || 10000);

const hijau = (t) => `[32m${t}[0m`;
const merah = (t) => `[31m${t}[0m`;
const kuning = (t) => `[33m${t}[0m`;

let gagalPertama = null;

function lulus(label, catatan) {
  console.log(`  ${hijau("OK")}    ${label}${catatan ? ` - ${catatan}` : ""}`);
}

function gagal(label, sebab, saran) {
  console.log(`  ${merah("GAGAL")} ${label} - ${sebab}`);
  if (!gagalPertama) gagalPertama = { label, sebab, saran };
}

function bacaEnv(...keys) {
  for (const key of keys) {
    const nilai = String(process.env[key] || "").trim();
    if (nilai) return { key, nilai };
  }
  return null;
}

/** Menyembunyikan sandi di dalam URL proxy sebelum dicetak. */
function samarkanProxy(nilai) {
  return nilai.replace(/\/\/([^:@/]+):([^@/]+)@/, "//$1:****@");
}

function batasWaktu(janji, ms, pesan) {
  return Promise.race([
    janji,
    new Promise((_, tolak) => setTimeout(() => tolak(new Error(pesan)), ms)),
  ]);
}

function rantaiSebab(galat) {
  const bagian = [];
  let kini = galat;
  for (let i = 0; i < 6 && kini instanceof Error; i += 1) {
    const teks = kini.code && !kini.message.includes(kini.code) ? `${kini.message} (${kini.code})` : kini.message;
    if (teks && !bagian.includes(teks)) bagian.push(teks);
    kini = kini.cause;
  }
  return bagian.join(" -> ");
}

function sambungTcp(host, port) {
  return new Promise((selesai, tolak) => {
    const soket = net.connect({ host, port });
    soket.setTimeout(BATAS_MS);
    soket.once("connect", () => {
      soket.destroy();
      selesai();
    });
    soket.once("timeout", () => {
      soket.destroy();
      tolak(new Error(`tidak ada jawaban dalam ${BATAS_MS} ms (paket kemungkinan ditahan firewall)`));
    });
    soket.once("error", (galat) => tolak(galat));
  });
}

function jabatTangan(host, port) {
  return new Promise((selesai, tolak) => {
    const soket = tls.connect({ host, port, servername: host, timeout: BATAS_MS });
    soket.once("secureConnect", () => {
      const sertifikat = soket.getPeerCertificate();
      const penerbit = (sertifikat && sertifikat.issuer && (sertifikat.issuer.O || sertifikat.issuer.CN)) || "tidak diketahui";
      soket.destroy();
      selesai({ penerbit, terpercaya: soket.authorized, alasan: soket.authorizationError });
    });
    soket.once("timeout", () => {
      soket.destroy();
      tolak(new Error(`jabat tangan TLS tidak selesai dalam ${BATAS_MS} ms`));
    });
    soket.once("error", (galat) => tolak(galat));
  });
}

function permintaanHttps(host, proxy) {
  return new Promise((selesai, tolak) => {
    const kirim = (opsi) => {
      const permintaan = https.request(opsi, (respons) => {
        respons.resume();
        selesai(respons.statusCode);
      });
      permintaan.setTimeout(BATAS_MS, () => permintaan.destroy(new Error("tidak ada respons HTTPS")));
      permintaan.once("error", tolak);
      permintaan.end();
    };

    if (!proxy) {
      kirim({ host, port: PORT, path: "/", method: "HEAD", servername: host });
      return;
    }

    const alamat = new URL(proxy);
    const pengangkut = alamat.protocol === "https:" ? https : http;
    const header = {};
    if (alamat.username) {
      const kredensial = `${decodeURIComponent(alamat.username)}:${decodeURIComponent(alamat.password || "")}`;
      header["proxy-authorization"] = `Basic ${Buffer.from(kredensial).toString("base64")}`;
    }
    const terowongan = pengangkut.request({
      host: alamat.hostname,
      port: alamat.port || (alamat.protocol === "https:" ? 443 : 80),
      method: "CONNECT",
      path: `${host}:${PORT}`,
      headers: header,
      timeout: BATAS_MS,
    });
    terowongan.once("connect", (respons, soket) => {
      if (respons.statusCode !== 200) {
        soket.destroy();
        tolak(new Error(`proxy menolak CONNECT (HTTP ${respons.statusCode})`));
        return;
      }
      kirim({ socket: soket, agent: false, servername: host, host, path: "/", method: "HEAD" });
    });
    terowongan.once("timeout", () => terowongan.destroy(new Error("proxy tidak merespons")));
    terowongan.once("error", tolak);
    terowongan.end();
  });
}

async function main() {
  console.log(`\nDiagnosa jalur keluar ALETA -> ${HOST}:${PORT}\n`);

  // 1. Proxy
  const proxy = bacaEnv("HTTPS_PROXY", "https_proxy", "ALETA_HTTPS_PROXY", "HTTP_PROXY", "http_proxy");
  const noProxy = bacaEnv("NO_PROXY", "no_proxy");
  if (proxy) {
    lulus("Variabel proxy", `${proxy.key}=${samarkanProxy(proxy.nilai)}`);
  } else {
    console.log(`  ${kuning("INFO")}  Variabel proxy - tidak diatur, koneksi dicoba langsung`);
  }
  if (noProxy) console.log(`         ${noProxy.key}=${noProxy.nilai}`);
  if (process.env.NODE_EXTRA_CA_CERTS) {
    console.log(`         NODE_EXTRA_CA_CERTS=${process.env.NODE_EXTRA_CA_CERTS}`);
  }

  // 2. DNS
  let alamatIp = null;
  try {
    const hasil = await batasWaktu(dns.lookup(HOST), BATAS_MS, `DNS tidak menjawab dalam ${BATAS_MS} ms`);
    alamatIp = hasil.address;
    lulus("DNS", `${HOST} -> ${alamatIp}`);
  } catch (galat) {
    gagal(
      "DNS",
      rantaiSebab(galat) || String(galat),
      "Periksa DNS container portal (dns: di docker-compose.yml). Bila jaringan hanya boleh keluar lewat proxy, DNS memang wajar gagal - isi HTTPS_PROXY, lalu lewati langkah ini."
    );
  }

  // 3. TCP
  if (alamatIp && !proxy) {
    try {
      await sambungTcp(HOST, PORT);
      lulus("TCP 443", "koneksi terbuka");
    } catch (galat) {
      gagal(
        "TCP 443",
        rantaiSebab(galat) || String(galat),
        "Firewall memblokir keluar port 443. Minta admin jaringan membuka akses, atau arahkan lewat proxy kantor."
      );
    }
  }

  // 4. TLS - sekaligus mendeteksi penyadapan sertifikat oleh proxy kantor
  if (alamatIp && !proxy && !gagalPertama) {
    try {
      const hasil = await jabatTangan(HOST, PORT);
      if (hasil.terpercaya) {
        lulus("TLS", `sertifikat sah, penerbit ${hasil.penerbit}`);
      } else {
        gagal(
          "TLS",
          `sertifikat tidak dipercaya (${hasil.alasan}), penerbit ${hasil.penerbit}`,
          "Penerbit di atas bukan CA publik - TLS disadap perangkat kantor. Salin sertifikat CA kantor ke container lalu set NODE_EXTRA_CA_CERTS ke berkas itu."
        );
      }
    } catch (galat) {
      gagal("TLS", rantaiSebab(galat) || String(galat), "Periksa perangkat penyaring TLS di jaringan kantor.");
    }
  }

  // 5. HTTPS penuh
  if (!gagalPertama || proxy) {
    try {
      const status = await permintaanHttps(HOST, proxy ? proxy.nilai : null);
      lulus("HTTPS", `penyedia menjawab HTTP ${status}`);
    } catch (galat) {
      gagal(
        "HTTPS",
        rantaiSebab(galat) || String(galat),
        proxy
          ? `Proxy ${samarkanProxy(proxy.nilai)} tidak dapat dipakai. Pastikan alamat dan portnya benar, proxy hidup, dan bila perlu login tulis http://user:sandi@host:port.`
          : gagalPertama
            ? "Bereskan dulu kegagalan di lapisan sebelumnya."
            : "Penyedia tidak menjawab walau jalur bawah terbuka. Periksa perangkat penyaring HTTP di jaringan kantor."
      );
    }
  }

  console.log("");
  if (!gagalPertama) {
    console.log(hijau("JALUR KELUAR SEHAT."));
    console.log("Bila Uji Koneksi masih gagal, sebabnya bukan jaringan: periksa API key,");
    console.log("nama model, atau apakah Generative Language API sudah diaktifkan.");
    process.exit(0);
  }

  console.log(merah(`TITIK PUTUS: ${gagalPertama.label}`));
  console.log(`Sebab : ${gagalPertama.sebab}`);
  console.log(`Saran : ${gagalPertama.saran}`);
  console.log("");
  console.log("Bila kantor memakai proxy, isi di .env.production lalu jalankan ulang:");
  console.log("  HTTPS_PROXY=http://proxy-kantor:8080");
  console.log("  NO_PROXY=localhost,127.0.0.1,aleta_bot,postgres,192.168.10.10");
  process.exit(1);
}

main().catch((galat) => {
  console.error(merah("Diagnosa gagal dijalankan:"), rantaiSebab(galat) || galat);
  process.exit(2);
});
