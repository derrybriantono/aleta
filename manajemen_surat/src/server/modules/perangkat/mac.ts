import { type AletaDatabase } from "@/server/db/client";
import { bacaSetelanJejak } from "@/server/modules/perangkat/jejak";
import { ipPribadi, rujukanSesi } from "@/server/modules/perangkat/jaringan";

/**
 * ============================================================================
 * MAC ADDRESS: DUA SUMBER, KEDUANYA TERCATAT BESERTA SUMBERNYA (23 Okt 2026)
 * ============================================================================
 *
 * Peramban TIDAK PERNAH memberikan MAC. Yang ada:
 *
 *   1. "ekstensi" - pembantu lokal ekstensi (native host id.aleta.pembaru,
 *      perintah `perangkat`, BACA SAJA) di PC Windows yang memasangnya: nama
 *      komputer, MAC adaptor aktif yang punya gateway, versi Windows rinci.
 *   2. "arp-server" - tabel ARP server lewat aleta_bot (jaringan host), HANYA
 *      untuk klien se-subnet dengan server. Bot menolak IP luar subnet dan MAC
 *      gateway - klien 192.168.9.x yang lewat router hanya terlihat sebagai
 *      MAC router, dan itu bukan MAC perangkatnya.
 *
 * Bila keduanya ada, "ekstensi" yang dipakai. Yang tidak terbaca dicatat
 * "tidak terbaca" BESERTA sebabnya - tidak pernah ditebak.
 *
 * KEDUANYA KLAIM: data ekstensi dikirim klien. MAC tidak pernah dipakai untuk
 * keputusan keamanan; batas perangkat memakai kuki perangkat.
 */

export const SUMBER_MAC_EKSTENSI = "ekstensi";
export const SUMBER_MAC_ARP = "arp-server";

export function normalisasiMac(nilai: unknown) {
  const t = String(nilai ?? "").trim().toUpperCase().replace(/-/g, ":");
  if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(t)) return "";
  if (t === "00:00:00:00:00:00" || t === "FF:FF:FF:FF:FF:FF") return "";
  return t;
}

type PembacaArp = (ip: string) => Promise<{ ok: boolean; mac: string; sebab: string }>;

async function pembacaArpBawaan(ip: string) {
  const { bacaArpGateway } = await import("@/server/modules/aleta-bot/whatsapp-gateway-client");
  const r = await bacaArpGateway(ip, 1500);
  if (!r.ok) return { ok: false, mac: "", sebab: "bot tidak menjawab" };
  return { ok: true, mac: normalisasiMac(r.data.mac), sebab: String(r.data.sebab ?? "") };
}

let pembacaArp: PembacaArp = pembacaArpBawaan;
export function __pasangPembacaArpUntukUji(f: PembacaArp | null) {
  pembacaArp = f ?? pembacaArpBawaan;
}

/** Membaca ARP di latar: tidak ditunggu, tidak pernah melempar, tidak memperlambat masuk. */
export function jadwalkanArp(db: AletaDatabase, m: { perangkatId: string; userId: string; ip: string }) {
  void tempelArp(db, m).catch(() => undefined);
}

export async function tempelArp(db: AletaDatabase, m: { perangkatId: string; userId: string; ip: string }) {
  const p = await db.queryOne<{ mac: string; mac_sumber: string; jenis: string }>(
    "SELECT mac, mac_sumber, jenis FROM aleta_perangkat WHERE perangkat_id = ? AND user_id = ?",
    [m.perangkatId, m.userId]
  );
  if (!p || p.mac_sumber === SUMBER_MAC_EKSTENSI) return { dibaca: false, sebab: "sudah dari ekstensi" };
  if (p.jenis === "hp" || p.jenis === "tablet") {
    await db.run("UPDATE aleta_perangkat SET mac_catatan = ? WHERE perangkat_id = ? AND user_id = ?", ["tidak terbaca (HP)", m.perangkatId, m.userId]);
    return { dibaca: false, sebab: "HP" };
  }
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(m.ip) || !ipPribadi(m.ip)) {
    await db.run("UPDATE aleta_perangkat SET mac_catatan = ? WHERE perangkat_id = ? AND user_id = ? AND mac = ''", [
      "tidak terbaca: alamat di luar jaringan kantor",
      m.perangkatId,
      m.userId,
    ]);
    return { dibaca: false, sebab: "luar jaringan" };
  }
  const r = await pembacaArp(m.ip).catch(() => ({ ok: false, mac: "", sebab: "bot tidak menjawab" }));
  const mac = normalisasiMac(r.mac);
  if (!mac) {
    await db.run("UPDATE aleta_perangkat SET mac_catatan = ? WHERE perangkat_id = ? AND user_id = ?", [
      `tidak terbaca: ${r.sebab || "tidak ada di tabel ARP server"}`.slice(0, 160),
      m.perangkatId,
      m.userId,
    ]);
    return { dibaca: false, sebab: r.sebab };
  }
  await db.run(
    "UPDATE aleta_perangkat SET mac = ?, mac_sumber = ?, mac_catatan = '' WHERE perangkat_id = ? AND user_id = ?",
    [mac, SUMBER_MAC_ARP, m.perangkatId, m.userId]
  );
  await db.run(
    "UPDATE aleta_jejak_masuk SET mac = ?, mac_sumber = ? WHERE perangkat_id = ? AND user_id = ? AND mac = '' AND waktu >= ?",
    [mac, SUMBER_MAC_ARP, m.perangkatId, m.userId, new Date(Date.now() - 10 * 60_000).toISOString()]
  );
  return { dibaca: true, mac };
}

// ─── Data dari ekstensi ──────────────────────────────────────────────────────

export type DataEkstensi = {
  namaKomputer?: unknown;
  osRinci?: unknown;
  mac?: unknown;
  akunWindows?: unknown;
  petunjuk?: { platform?: unknown; platformVersion?: unknown; model?: unknown; fullVersionList?: unknown } | null;
};

/** Windows: platformVersion >= 13 = Windows 11 (aturan resmi client hints). */
function osDariPetunjuk(p: DataEkstensi["petunjuk"]) {
  if (!p) return "";
  const platform = String(p.platform ?? "").slice(0, 30);
  const versi = String(p.platformVersion ?? "").slice(0, 30);
  if (/windows/i.test(platform)) {
    const utama = Number(versi.split(".")[0]);
    if (Number.isFinite(utama) && utama > 0) return utama >= 13 ? "Windows 11" : "Windows 10";
    return "";
  }
  return [platform, versi].filter(Boolean).join(" ");
}

export async function terimaDataEkstensi(
  db: AletaDatabase,
  m: { userId: string; sessionId: string; perangkatId: string; data: DataEkstensi }
) {
  const setelan = await bacaSetelanJejak(db);
  const namaKomputer = /^[A-Za-z0-9._-]{1,63}$/.test(String(m.data.namaKomputer ?? "")) ? String(m.data.namaKomputer) : "";
  const daftarMac = (Array.isArray(m.data.mac) ? m.data.mac : [m.data.mac]).map(normalisasiMac).filter(Boolean);
  const mac = daftarMac[0] ?? "";
  const osRinci =
    String(m.data.osRinci ?? "").replace(/[^\w .()/-]/g, "").slice(0, 80) || osDariPetunjuk(m.data.petunjuk ?? null);
  const model = String(m.data.petunjuk?.model ?? "").replace(/[^\w .-]/g, "").slice(0, 60);
  const akunWindows = setelan.catatAkunWindows ? String(m.data.akunWindows ?? "").replace(/[^\w .\\@-]/g, "").slice(0, 64) : "";

  const ada = await db.queryOne<{ id: string }>("SELECT id FROM aleta_perangkat WHERE perangkat_id = ? AND user_id = ?", [m.perangkatId, m.userId]);
  if (!ada) return { diterima: false, sebab: "perangkat belum tercatat untuk akun ini" };
  await db.run(
    `UPDATE aleta_perangkat SET
       nama_komputer = CASE WHEN ? <> '' THEN ? ELSE nama_komputer END,
       os_rinci = CASE WHEN ? <> '' THEN ? ELSE os_rinci END,
       model = CASE WHEN ? <> '' THEN ? ELSE model END,
       akun_windows = ?,
       mac = CASE WHEN ? <> '' THEN ? ELSE mac END,
       mac_sumber = CASE WHEN ? <> '' THEN ? ELSE mac_sumber END,
       mac_catatan = CASE WHEN ? <> '' THEN '' ELSE mac_catatan END,
       data_ekstensi_pada = ?
     WHERE id = ?`,
    [namaKomputer, namaKomputer, osRinci, osRinci, model, model, akunWindows, mac, mac, mac, SUMBER_MAC_EKSTENSI, mac, new Date().toISOString(), ada.id]
  );
  // Peristiwa sesi ini yang sudah tercatat ikut mendapat nama komputer & MAC.
  await db.run(
    `UPDATE aleta_jejak_masuk SET
       nama_komputer = CASE WHEN ? <> '' THEN ? ELSE nama_komputer END,
       mac = CASE WHEN ? <> '' THEN ? ELSE mac END,
       mac_sumber = CASE WHEN ? <> '' THEN ? ELSE mac_sumber END
     WHERE sesi_ref = ? AND user_id = ?`,
    [namaKomputer, namaKomputer, mac, mac, mac, SUMBER_MAC_EKSTENSI, rujukanSesi(m.sessionId), m.userId]
  );
  return { diterima: true, namaKomputer, mac, osRinci, akunWindowsDicatat: Boolean(akunWindows) };
}
