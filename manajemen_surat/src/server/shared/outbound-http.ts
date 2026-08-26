import { Buffer } from "node:buffer";
import http from "node:http";
import https from "node:https";
import type { Socket } from "node:net";

/**
 * Panggilan keluar ALETA ke penyedia AI.
 *
 * Dua hal yang tidak disediakan `fetch` bawaan Node dan justru dibutuhkan di
 * jaringan kantor tertutup:
 *
 *  1. PROXY. `fetch` Node (undici) TIDAK membaca HTTPS_PROXY/HTTP_PROXY sama
 *     sekali. Di server yang hanya boleh keluar lewat proxy, mengisi variabel
 *     itu tidak berpengaruh apa pun dan kegagalannya terlihat seperti "server
 *     tidak punya internet". Di sini proxy ditangani sendiri lewat CONNECT.
 *
 *  2. SEBAB YANG JELAS. `fetch` selalu melempar "fetch failed"; sebab
 *     sebenarnya (DNS, timeout, sertifikat disadap proxy, koneksi ditolak)
 *     tersimpan berlapis di properti `cause`.
 *
 * Bila tidak ada proxy yang diatur, jalur lama dipakai apa adanya - `fetch`
 * global, tanpa perubahan perilaku.
 */

const DEFAULT_TIMEOUT_MS = 30_000;

function bacaEnv(...keys: string[]) {
  for (const key of keys) {
    const value = String(process.env[key] ?? "").trim();
    if (value) return value;
  }
  return "";
}

function cocokNoProxy(hostname: string) {
  const daftar = bacaEnv("NO_PROXY", "no_proxy");
  if (!daftar) return false;

  const host = hostname.toLowerCase();
  return daftar
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .some((pola) => {
      if (pola === "*") return true;
      const bersih = pola.replace(/^\*?\./, "");
      return host === bersih || host.endsWith(`.${bersih}`);
    });
}

/** URL proxy yang berlaku untuk satu target, atau null bila langsung. */
export function resolveProxyForUrl(target: URL): URL | null {
  if (cocokNoProxy(target.hostname)) return null;

  const mentah =
    target.protocol === "https:"
      ? bacaEnv("HTTPS_PROXY", "https_proxy", "ALETA_HTTPS_PROXY") ||
        bacaEnv("HTTP_PROXY", "http_proxy", "ALETA_HTTP_PROXY")
      : bacaEnv("HTTP_PROXY", "http_proxy", "ALETA_HTTP_PROXY");

  if (!mentah) return null;

  try {
    return new URL(/^https?:\/\//i.test(mentah) ? mentah : `http://${mentah}`);
  } catch {
    // Proxy salah tulis tidak boleh menjatuhkan permintaan diam-diam.
    throw new Error(`Alamat proxy tidak valid: ${mentah}`);
  }
}

function portDari(url: URL) {
  if (url.port) return Number(url.port);
  return url.protocol === "https:" ? 443 : 80;
}

function headerProxy(proxy: URL) {
  if (!proxy.username) return {};
  const kredensial = `${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password || "")}`;
  return { "proxy-authorization": `Basic ${Buffer.from(kredensial).toString("base64")}` };
}

/** Membuka terowongan CONNECT ke target lewat proxy. */
function bukaTerowongan(proxy: URL, target: URL, timeoutMs: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const pengangkut = proxy.protocol === "https:" ? https : http;
    const permintaan = pengangkut.request({
      host: proxy.hostname,
      port: portDari(proxy),
      method: "CONNECT",
      path: `${target.hostname}:${portDari(target)}`,
      headers: { host: `${target.hostname}:${portDari(target)}`, ...headerProxy(proxy) },
      timeout: timeoutMs,
    });

    permintaan.on("connect", (respons, socket) => {
      if (respons.statusCode !== 200) {
        socket.destroy();
        reject(
          new Error(
            `Proxy ${proxy.host} menolak CONNECT ke ${target.hostname} (HTTP ${respons.statusCode ?? "?"}).`
          )
        );
        return;
      }
      resolve(socket);
    });
    permintaan.on("timeout", () => {
      permintaan.destroy(new Error(`Proxy ${proxy.host} tidak merespons dalam ${timeoutMs} ms.`));
    });
    // Galat sambungan ke proxy harus MENYEBUT proxy. Tanpa ini pesannya cuma
    // "connect ECONNREFUSED", dan admin akan mengira firewall ke penyedia AI
    // yang bermasalah padahal proxy-nya sendiri yang salah alamat atau mati.
    permintaan.on("error", (galat: Error) => {
      if (/tidak merespons dalam/.test(galat.message)) {
        reject(galat);
        return;
      }
      reject(new Error(`Tidak dapat menghubungi proxy ${proxy.host}: ${galat.message}`, { cause: galat }));
    });
    permintaan.end();
  });
}

function normalkanHeader(init: RequestInit): Record<string, string> {
  const hasil: Record<string, string> = {};
  const sumber = init.headers;
  if (!sumber) return hasil;

  if (Array.isArray(sumber)) {
    for (const [nama, nilai] of sumber) hasil[String(nama).toLowerCase()] = String(nilai);
  } else if (sumber instanceof Headers) {
    sumber.forEach((nilai, nama) => {
      hasil[nama.toLowerCase()] = nilai;
    });
  } else {
    for (const [nama, nilai] of Object.entries(sumber as Record<string, string>)) {
      hasil[nama.toLowerCase()] = String(nilai);
    }
  }
  return hasil;
}

async function fetchLewatProxy(target: URL, init: RequestInit, proxy: URL, timeoutMs: number) {
  const badan = typeof init.body === "string" ? Buffer.from(init.body, "utf8") : null;
  const header = normalkanHeader(init);
  header.host = target.host;
  // Modul https tidak membuka kompresi sendiri, jadi jangan minta dikompresi.
  header["accept-encoding"] = "identity";
  header["content-length"] = String(badan ? badan.byteLength : 0);
  if (!badan) delete header["content-length"];

  // `socket` memang diterima http.request saat menumpang terowongan CONNECT,
  // tetapi belum tercantum di tipe bawaan Node.
  const opsi: https.RequestOptions & { socket?: Socket } = {
    method: init.method || "GET",
    path: `${target.pathname}${target.search}`,
    headers: header,
    timeout: timeoutMs,
  };

  if (target.protocol === "https:") {
    const socket = await bukaTerowongan(proxy, target, timeoutMs);
    opsi.socket = socket;
    opsi.agent = false;
    opsi.servername = target.hostname;
  } else {
    // Target polos tidak perlu terowongan: proxy diminta meneruskan langsung.
    opsi.host = proxy.hostname;
    opsi.port = portDari(proxy);
    opsi.path = target.href;
    opsi.headers = { ...header, ...headerProxy(proxy) };
  }

  const pengangkut = target.protocol === "https:" ? https : http;

  return new Promise<Response>((resolve, reject) => {
    const permintaan = pengangkut.request(opsi, (respons) => {
      const potongan: Buffer[] = [];
      respons.on("data", (bagian: Buffer) => potongan.push(bagian));
      respons.on("error", reject);
      respons.on("end", () => {
        const status = respons.statusCode ?? 502;
        const header: Record<string, string> = {};
        for (const [nama, nilai] of Object.entries(respons.headers)) {
          if (typeof nilai === "string") header[nama] = nilai;
          else if (Array.isArray(nilai)) header[nama] = nilai.join(", ");
        }
        // Status tanpa badan tidak boleh dibuatkan badan.
        const kosong = status === 204 || status === 304;
        resolve(
          new Response(kosong ? null : Buffer.concat(potongan), {
            status,
            statusText: respons.statusMessage || "",
            headers: header,
          })
        );
      });
    });

    permintaan.on("timeout", () => {
      permintaan.destroy(new Error(`Tidak ada respons dari ${target.hostname} dalam ${timeoutMs} ms.`));
    });
    permintaan.on("error", reject);
    if (badan) permintaan.write(badan);
    permintaan.end();
  });
}

/**
 * fetch untuk panggilan keluar ALETA: sadar proxy dan selalu punya batas waktu.
 */
export async function outboundFetch(url: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const target = new URL(url);
  const proxy = resolveProxyForUrl(target);

  if (proxy) {
    return fetchLewatProxy(target, init, proxy, timeoutMs);
  }

  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

/**
 * Merangkai pesan galat berikut seluruh rantai `cause`-nya.
 *
 * Tanpa ini yang sampai ke admin cuma "fetch failed" - tidak bisa dibedakan
 * antara DNS gagal, koneksi ditolak, waktu tunggu habis, atau sertifikat
 * diganti oleh proxy kantor. Padahal cara menanganinya berbeda semua.
 */
export function describeNetworkError(error: unknown): string {
  const bagian: string[] = [];
  let sekarang: unknown = error;

  for (let lapis = 0; lapis < 6 && sekarang instanceof Error; lapis += 1) {
    const kode = (sekarang as NodeJS.ErrnoException).code;
    const pesan = sekarang.message.trim();
    const teks = kode && !pesan.includes(kode) ? `${pesan} (${kode})` : pesan;
    if (teks && !bagian.includes(teks)) bagian.push(teks);
    sekarang = (sekarang as { cause?: unknown }).cause;
  }

  return bagian.join(" -> ");
}
