"use strict";

/**
 * ============================================================================
 * MAC SATU IP DARI TABEL ARP SERVER - BACA SAJA (23 Okt 2026)
 * ============================================================================
 *
 * Dipakai jejak masuk portal (server/modules/perangkat/mac.ts). Bot berjalan
 * dengan network_mode: host, jadi /proc/net/arp di sini adalah tabel ARP
 * SERVER; portal (jaringan bridge Docker) hanya melihat jaringan Docker.
 *
 * Tabel ARP hanya jujur untuk klien SE-SUBNET dengan server. Klien di subnet
 * lain (mis. 192.168.9.x lewat router) tidak pernah ada di tabel ini - yang
 * ada hanya MAC routernya. Karena itu hasil DITOLAK bila:
 *   - IP di luar subnet antarmuka server mana pun;
 *   - MAC-nya sama dengan MAC gateway/router (dari /proc/net/route);
 *   - entri belum lengkap (flags 0x0) atau MAC kosong.
 * Penolakan dipulangkan sebagai { mac: "", sebab } - tidak pernah ditebak.
 *
 * Tidak menulis apa pun, tidak mengirim paket (tidak ada ping/arping).
 */

const fs = require("fs");
const os = require("os");

function ipKeAngka(ip) {
  const b = String(ip || "").split(".").map(Number);
  if (b.length !== 4 || b.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) return null;
  return ((b[0] << 24) >>> 0) + (b[1] << 16) + (b[2] << 8) + b[3];
}

function seSubnet(ip, alamat, netmask) {
  const a = ipKeAngka(ip);
  const s = ipKeAngka(alamat);
  const m = ipKeAngka(netmask);
  if (a === null || s === null || m === null || m === 0) return false;
  return ((a & m) >>> 0) === ((s & m) >>> 0);
}

/** Baris /proc/net/arp -> [{ ip, flags, mac, antarmuka }]. */
function bacaTabelArp(teks) {
  return String(teks || "")
    .split(/\r?\n/)
    .slice(1)
    .map((b) => b.trim().split(/\s+/))
    .filter((k) => k.length >= 6)
    .map((k) => ({ ip: k[0], flags: k[2], mac: String(k[3] || "").toUpperCase(), antarmuka: k[5] }));
}

/** IP gateway bawaan dari /proc/net/route (heksadesimal little-endian). */
function bacaGateway(teks) {
  const hasil = [];
  for (const b of String(teks || "").split(/\r?\n/).slice(1)) {
    const k = b.trim().split(/\s+/);
    if (k.length < 3 || k[1] !== "00000000") continue;
    const hex = k[2];
    if (!/^[0-9A-Fa-f]{8}$/.test(hex) || hex === "00000000") continue;
    const bytes = [hex.slice(6, 8), hex.slice(4, 6), hex.slice(2, 4), hex.slice(0, 2)].map((x) => parseInt(x, 16));
    hasil.push({ ip: bytes.join("."), antarmuka: k[0] });
  }
  return hasil;
}

/** Antarmuka IPv4 non-internal server: [{ nama, alamat, netmask, mac }]. */
function antarmukaServer(peta = os.networkInterfaces()) {
  const hasil = [];
  for (const [nama, daftar] of Object.entries(peta || {})) {
    for (const a of daftar || []) {
      if (!a || a.internal || (a.family !== "IPv4" && a.family !== 4)) continue;
      // Jembatan Docker bukan jaringan kantor.
      if (/^(docker|br-|veth|virbr)/.test(nama)) continue;
      hasil.push({ nama, alamat: a.address, netmask: a.netmask, mac: String(a.mac || "").toUpperCase() });
    }
  }
  return hasil;
}

const MAC_SAH = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;

/**
 * Keputusan murni (diuji tanpa /proc): { mac, sebab, antarmuka }.
 */
function putuskanArp({ ip, arpTeks, routeTeks, antarmuka }) {
  if (ipKeAngka(ip) === null) return { mac: "", sebab: "alamat bukan IPv4" };
  const subnet = (antarmuka || []).find((a) => seSubnet(ip, a.alamat, a.netmask));
  if (!subnet) return { mac: "", sebab: "di luar subnet server (lewat router; MAC perangkat tidak terlihat)" };
  if ((antarmuka || []).some((a) => a.alamat === ip)) return { mac: "", sebab: "alamat server sendiri" };
  const tabel = bacaTabelArp(arpTeks);
  const gateway = bacaGateway(routeTeks);
  const macGateway = new Set(
    gateway
      .map((g) => tabel.find((t) => t.ip === g.ip))
      .filter(Boolean)
      .map((t) => t.mac)
  );
  if (gateway.some((g) => g.ip === ip)) return { mac: "", sebab: "alamat router/gateway" };
  const entri = tabel.find((t) => t.ip === ip);
  if (!entri) return { mac: "", sebab: "tidak ada di tabel ARP server" };
  if (entri.flags === "0x0" || !MAC_SAH.test(entri.mac) || entri.mac === "00:00:00:00:00:00") {
    return { mac: "", sebab: "entri ARP belum lengkap" };
  }
  if (macGateway.has(entri.mac)) return { mac: "", sebab: "MAC sama dengan router/gateway" };
  return { mac: entri.mac, sebab: "", antarmuka: entri.antarmuka || subnet.nama };
}

function bacaArp(ip) {
  let arpTeks = "";
  let routeTeks = "";
  try {
    arpTeks = fs.readFileSync("/proc/net/arp", "utf8");
    routeTeks = fs.readFileSync("/proc/net/route", "utf8");
  } catch {
    return { mac: "", sebab: "tabel ARP server tidak terbaca" };
  }
  return putuskanArp({ ip, arpTeks, routeTeks, antarmuka: antarmukaServer() });
}

module.exports = { bacaArp, putuskanArp, bacaTabelArp, bacaGateway, antarmukaServer, seSubnet };
