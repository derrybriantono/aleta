import { type AletaDatabase } from "@/server/db/client";
import { type KonteksVerifikasi, verifikasiLuarKantorTerdaftar } from "@/server/modules/keamanan/kait";
import { catatPeristiwaAman } from "@/server/modules/perangkat/jejak";
import { ipKlien } from "@/server/modules/perangkat/jaringan";
import { alamatIpPeramban } from "@/server/shared/request";

/**
 * ============================================================================
 * BATAS JARINGAN PER PERAN (25 Okt 2026, Bagian 6b)
 * ============================================================================
 *
 * Daftar jaringan kantor (CIDR, mis. 192.168.10.0/24) dan satu aturan per peran:
 *
 *   mana-pun               boleh masuk dan bekerja dari alamat mana pun (BAWAAN
 *                          semua peran; tanpa baris = mana-pun)
 *   kantor-saja            hanya dari jaringan kantor
 *   luar-kantor-verifikasi dari luar kantor harus terverifikasi (OTP/authenticator,
 *                          rantai E5) - dipasang lewat kait; TANPA pendaftar kait
 *                          aturan ini tidak dapat dipilih (ditolak saat simpan)
 *
 * Bawaan semua peran "mana pun", jadi perilaku sama dengan sebelum fitur ini.
 *
 * IP dibaca dari ENTRI TERAKHIR X-Forwarded-For (alamatIpPeramban; Apache
 * menambahkan alamat penyambung di ujung, entri pertama dapat dikarang
 * peramban). IPv6 ikut dikenali lewat ipKlien bila alamatIpPeramban kosong.
 *
 * Penegakan di tiga tempat: (1) saat sesi dibuat (kait Better Auth, penolakan
 * dicatat MASUK_DITOLAK_JARINGAN di Riwayat Masuk), (2) setiap permintaan API
 * (resolveActorUserId; sesi yang sudah ada dari luar kantor ditolak tanpa
 * dihapus), (3) tata letak portal.
 *
 * Gagal ke sisi LONGGAR hanya untuk kegagalan membaca basis data dan daftar
 * jaringan kosong (supaya satu gangguan atau salah isi tidak mengunci seluruh
 * satker). Darurat: ALETA_BATAS_JARINGAN=0 pada server mematikan penegakan.
 */

export const ATURAN_JARINGAN = ["mana-pun", "kantor-saja", "luar-kantor-verifikasi"] as const;
export type AturanJaringan = (typeof ATURAN_JARINGAN)[number];

export const LABEL_ATURAN_JARINGAN: Record<AturanJaringan, string> = {
  "mana-pun": "Dari mana pun",
  "kantor-saja": "Hanya dari jaringan kantor",
  "luar-kantor-verifikasi": "Dari luar kantor wajib verifikasi",
};

export const KODE_JARINGAN_DITOLAK = "JARINGAN_DITOLAK";
export const KODE_PERLU_VERIFIKASI = "PERLU_VERIFIKASI_LUAR_KANTOR";

// ─── CIDR ────────────────────────────────────────────────────────────────────

export type Cidr = { versi: 4 | 6; jaringan: bigint; panjang: number };

function ipv4KeBigInt(ip: string): bigint | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const bagian = m.slice(1).map(Number);
  if (bagian.some((x) => x > 255)) return null;
  return bagian.reduce((a, x) => (a << BigInt(8)) | BigInt(x), BigInt(0));
}

function ipv6KeBigInt(ip: string): bigint | null {
  let teks = ip.toLowerCase();
  if (!/^[0-9a-f:.]+$/.test(teks) || !teks.includes(":")) return null;
  // bagian IPv4 di ujung (::ffff:192.168.1.1)
  const v4 = teks.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4) {
    const n = ipv4KeBigInt(v4[1]);
    if (n === null) return null;
    teks = teks.slice(0, teks.length - v4[1].length) + `${((n >> BigInt(16)) & BigInt(0xffff)).toString(16)}:${(n & BigInt(0xffff)).toString(16)}`;
  }
  const kembar = teks.split("::");
  if (kembar.length > 2) return null;
  const kiri = kembar[0] ? kembar[0].split(":") : [];
  const kanan = kembar.length === 2 && kembar[1] ? kembar[1].split(":") : [];
  let kelompok: string[];
  if (kembar.length === 2) {
    const kurang = 8 - kiri.length - kanan.length;
    if (kurang < 1) return null;
    kelompok = [...kiri, ...Array(kurang).fill("0"), ...kanan];
  } else {
    kelompok = kiri;
  }
  if (kelompok.length !== 8) return null;
  let hasil = BigInt(0);
  for (const k of kelompok) {
    if (!/^[0-9a-f]{1,4}$/.test(k)) return null;
    hasil = (hasil << BigInt(16)) | BigInt(parseInt(k, 16));
  }
  return hasil;
}

/** Mengurai alamat tunggal ("192.168.9.121", "::1") atau CIDR ("192.168.10.0/24"). null bila tidak sah. */
export function uraiCidr(teks: string): Cidr | null {
  const bersih = String(teks ?? "").trim().replace(/^::ffff:(?=\d)/i, "");
  if (!bersih) return null;
  const [alamat, awalan, ...sisa] = bersih.split("/");
  if (sisa.length) return null;
  const v4 = ipv4KeBigInt(alamat);
  if (v4 !== null) {
    const p = awalan === undefined ? 32 : /^\d{1,2}$/.test(awalan) ? Number(awalan) : -1;
    if (p < 0 || p > 32) return null;
    const sampul = p === 0 ? BigInt(0) : ((BigInt(1) << BigInt(32)) - BigInt(1)) ^ ((BigInt(1) << BigInt(32 - p)) - BigInt(1));
    return { versi: 4, jaringan: v4 & sampul, panjang: p };
  }
  const v6 = ipv6KeBigInt(alamat);
  if (v6 !== null) {
    const p = awalan === undefined ? 128 : /^\d{1,3}$/.test(awalan) ? Number(awalan) : -1;
    if (p < 0 || p > 128) return null;
    const sampul = p === 0 ? BigInt(0) : ((BigInt(1) << BigInt(128)) - BigInt(1)) ^ ((BigInt(1) << BigInt(128 - p)) - BigInt(1));
    return { versi: 6, jaringan: v6 & sampul, panjang: p };
  }
  return null;
}

export function ipDalamCidr(ip: string, cidr: Cidr): boolean {
  const alamat = uraiCidr(ip);
  if (!alamat || alamat.versi !== cidr.versi) return false;
  const total = cidr.versi === 4 ? 32 : 128;
  if (cidr.panjang === 0) return true;
  const geser = BigInt(total - cidr.panjang);
  return alamat.jaringan >> geser === cidr.jaringan >> geser;
}

export function cidrKeTeks(c: Cidr): string {
  if (c.versi === 4) {
    const b = [BigInt(24), BigInt(16), BigInt(8), BigInt(0)].map((g) => Number((c.jaringan >> g) & BigInt(255)));
    return `${b.join(".")}/${c.panjang}`;
  }
  const kel: string[] = [];
  for (let i = 7; i >= 0; i -= 1) kel.push(Number((c.jaringan >> BigInt(i * 16)) & BigInt(0xffff)).toString(16));
  return `${kel.join(":")}/${c.panjang}`;
}

/** Bentuk baku untuk disimpan; melempar Error berbahasa Indonesia bila tidak sah atau terlalu luas. */
export function normalkanCidr(teks: string): string {
  const c = uraiCidr(teks);
  if (!c) throw new Error(`"${String(teks).slice(0, 60)}" bukan alamat jaringan yang sah. Contoh: 192.168.10.0/24 atau 192.168.9.121.`);
  if ((c.versi === 4 && c.panjang < 8) || (c.versi === 6 && c.panjang < 16)) {
    throw new Error(`Jaringan ${cidrKeTeks(c)} terlalu luas untuk disebut jaringan kantor. Pakai awalan /8 atau lebih sempit (IPv6 /16).`);
  }
  return cidrKeTeks(c);
}

// ─── Konfigurasi ─────────────────────────────────────────────────────────────

export type SubnetKantor = { id: string; cidr: string; label: string; aktif: boolean; dibuatOleh: string; dibuatPada: string };
export type AturanPeran = { roleId: string; aturan: AturanJaringan; diubahOleh: string; diubahPada: string };
export type KonfigurasiJaringan = { subnet: SubnetKantor[]; aturan: AturanPeran[] };

const KOSONG: KonfigurasiJaringan = { subnet: [], aturan: [] };
const TTL_MS = 8000;
const G = globalThis as unknown as { __aletaJaringanCache?: { pada: number; data: KonfigurasiJaringan } };

export function bersihkanSinggahanJaringan() {
  G.__aletaJaringanCache = undefined;
}

export async function bacaKonfigurasiJaringan(db: AletaDatabase, { singgah = false }: { singgah?: boolean } = {}): Promise<KonfigurasiJaringan> {
  if (singgah && G.__aletaJaringanCache && Date.now() - G.__aletaJaringanCache.pada < TTL_MS) return G.__aletaJaringanCache.data;
  let data: KonfigurasiJaringan;
  try {
    const subnet = await db.queryAll<{ id: string; cidr: string; label: string; aktif: number; dibuat_oleh: string; dibuat_pada: string }>(
      "SELECT id, cidr, label, aktif, dibuat_oleh, dibuat_pada FROM aleta_subnet_kantor ORDER BY dibuat_pada, id"
    );
    const aturan = await db.queryAll<{ role_id: string; aturan: string; diubah_oleh: string; diubah_pada: string }>(
      "SELECT role_id, aturan, diubah_oleh, diubah_pada FROM aleta_aturan_jaringan_peran ORDER BY role_id"
    );
    data = {
      subnet: subnet.map((s) => ({ id: s.id, cidr: s.cidr, label: s.label, aktif: Number(s.aktif) === 1, dibuatOleh: s.dibuat_oleh, dibuatPada: s.dibuat_pada })),
      aturan: aturan
        .filter((a) => (ATURAN_JARINGAN as readonly string[]).includes(a.aturan))
        .map((a) => ({ roleId: a.role_id, aturan: a.aturan as AturanJaringan, diubahOleh: a.diubah_oleh, diubahPada: a.diubah_pada })),
    };
  } catch {
    data = KOSONG; // tabel belum ada / basis data bermasalah: perilaku lama (mana pun)
  }
  if (singgah) G.__aletaJaringanCache = { pada: Date.now(), data };
  return data;
}

// ─── Putusan ─────────────────────────────────────────────────────────────────

export function dalamJaringanKantor(ip: string, subnet: SubnetKantor[]): boolean {
  if (!ip) return false;
  return subnet.some((s) => {
    if (!s.aktif) return false;
    const c = uraiCidr(s.cidr);
    return c ? ipDalamCidr(ip, c) : false;
  });
}

/**
 * Aturan yang berlaku bagi akun dengan beberapa peran: yang PALING LONGGAR menang
 * (mana-pun > luar-kantor-verifikasi > kantor-saja), seperti batas perangkat
 * yang memakai batas terbesar. Peran tanpa baris = mana-pun.
 */
export function aturanEfektif(peran: string[], aturan: AturanPeran[]): AturanJaringan {
  const peta = new Map(aturan.map((a) => [a.roleId, a.aturan]));
  const nilai = peran.map((r) => peta.get(r) ?? "mana-pun");
  if (nilai.length === 0 || nilai.includes("mana-pun")) return "mana-pun";
  if (nilai.includes("luar-kantor-verifikasi")) return "luar-kantor-verifikasi";
  return "kantor-saja";
}

export type PutusanJaringan =
  | { lolos: true; aturan: AturanJaringan; dinilai: boolean }
  | { lolos: false; aturan: AturanJaringan; kode: typeof KODE_JARINGAN_DITOLAK | typeof KODE_PERLU_VERIFIKASI; alasan: string; pesan: string };

const LOLOS_BEBAS: PutusanJaringan = { lolos: true, aturan: "mana-pun", dinilai: false };

export function penegakanJaringanMati() {
  return process.env.ALETA_BATAS_JARINGAN === "0";
}

/** Alamat klien menurut aturan batas jaringan: ujung X-Forwarded-For (IPv4), lalu ipKlien (termasuk IPv6). */
export function alamatKlienJaringan(headers: { get(nama: string): string | null } | null | undefined): string {
  if (!headers) return "";
  return alamatIpPeramban({ headers } as unknown as Request) || ipKlien(headers);
}

export async function peranAkun(db: AletaDatabase, userId: string): Promise<string[]> {
  try {
    const u = await db.queryOne<{ role_id: string | null; additional_role_ids_json: string | null }>(
      "SELECT role_id, additional_role_ids_json FROM users WHERE id = ?",
      [userId]
    );
    if (!u) return [];
    let tambahan: unknown = [];
    try {
      tambahan = JSON.parse(String(u.additional_role_ids_json ?? "[]"));
    } catch {
      tambahan = [];
    }
    return [String(u.role_id ?? ""), ...(Array.isArray(tambahan) ? tambahan.map(String) : [])].filter(Boolean);
  } catch {
    return [];
  }
}

/** Murni: putusan atas aturan, alamat, dan daftar jaringan yang diberikan (diuji tanpa basis data). */
export async function putuskanJaringan(
  m: { aturan: AturanJaringan; ip: string; subnet: SubnetKantor[]; verifikasi?: () => Promise<boolean> }
): Promise<PutusanJaringan> {
  if (m.aturan === "mana-pun") return { lolos: true, aturan: m.aturan, dinilai: true };
  const aktif = m.subnet.filter((s) => s.aktif);
  // Daftar kosong dengan aturan membatasi = salah isi: jangan mengunci satker, longgarkan.
  if (aktif.length === 0) return { lolos: true, aturan: m.aturan, dinilai: false };
  if (dalamJaringanKantor(m.ip, aktif)) return { lolos: true, aturan: m.aturan, dinilai: true };
  if (m.aturan === "kantor-saja") {
    return {
      lolos: false,
      aturan: m.aturan,
      kode: KODE_JARINGAN_DITOLAK,
      alasan: "kantor saja, alamat di luar jaringan kantor",
      pesan: "Akun Anda hanya dapat masuk dari jaringan kantor. Hubungi admin bila Anda memang perlu bekerja dari luar.",
    };
  }
  const sudah = m.verifikasi ? await m.verifikasi() : false;
  if (sudah) return { lolos: true, aturan: m.aturan, dinilai: true };
  return {
    lolos: false,
    aturan: m.aturan,
    kode: KODE_PERLU_VERIFIKASI,
    alasan: m.verifikasi ? "luar kantor, belum terverifikasi" : "luar kantor, verifikasi belum tersedia",
    pesan: "Dari luar jaringan kantor, akun Anda harus diverifikasi lebih dulu. Selesaikan verifikasi, atau masuk dari jaringan kantor.",
  };
}

export type MasukanPutusan = { userId: string; headers: { get(nama: string): string | null } | null | undefined; sessionId?: string | null; tahap: KonteksVerifikasi["tahap"] };

/**
 * Putusan jaringan untuk satu akun dan satu permintaan. Cepat bila tidak ada aturan
 * membatasi (dua pembacaan singgahan). Tidak pernah melempar: gangguan = lolos.
 */
export async function periksaJaringanAkun(db: AletaDatabase, m: MasukanPutusan): Promise<PutusanJaringan> {
  if (penegakanJaringanMati()) return LOLOS_BEBAS;
  try {
    const konfig = await bacaKonfigurasiJaringan(db, { singgah: true });
    if (konfig.aturan.every((a) => a.aturan === "mana-pun")) return LOLOS_BEBAS;
    const peran = await peranAkun(db, m.userId);
    const aturan = aturanEfektif(peran, konfig.aturan);
    if (aturan === "mana-pun") return { lolos: true, aturan, dinilai: true };
    const ip = alamatKlienJaringan(m.headers);
    const pemeriksa = verifikasiLuarKantorTerdaftar();
    return await putuskanJaringan({
      aturan,
      ip,
      subnet: konfig.subnet,
      verifikasi: pemeriksa ? () => pemeriksa.sudahTerverifikasi(db, { userId: m.userId, sessionId: m.sessionId ?? null, ip, tahap: m.tahap }) : undefined,
    });
  } catch (galat) {
    console.warn("[BATAS JARINGAN] tidak dapat diperiksa; diteruskan:", galat instanceof Error ? galat.message : "tidak diketahui");
    return LOLOS_BEBAS;
  }
}

const sudahDicatat = new Map<string, number>();
const JEDA_CATAT_MS = 30 * 60 * 1000;

/**
 * Pemeriksaan untuk SESI yang sudah ada (tiap permintaan API): sesi dari luar kantor
 * bagi peran "kantor saja" ditolak TANPA dihapus (pulih sendiri begitu akun kembali ke
 * jaringan kantor). Penolakan dicatat di Riwayat Masuk paling sering sekali per 30 menit
 * per sesi supaya tidak membanjiri.
 */
export async function periksaJaringanSesi(
  db: AletaDatabase,
  m: { userId: string; sessionId: string; headers: { get(nama: string): string | null } | null | undefined }
): Promise<PutusanJaringan> {
  const putusan = await periksaJaringanAkun(db, { userId: m.userId, sessionId: m.sessionId, headers: m.headers, tahap: "sesi" });
  if (putusan.lolos) return putusan;
  const kini = Date.now();
  const kunci = `${m.sessionId}:${putusan.kode}`;
  if (kini - (sudahDicatat.get(kunci) ?? 0) >= JEDA_CATAT_MS) {
    sudahDicatat.set(kunci, kini);
    if (sudahDicatat.size > 2000) for (const [k, t] of sudahDicatat) if (kini - t >= JEDA_CATAT_MS) sudahDicatat.delete(k);
    await catatPeristiwaAman(db, {
      peristiwa: "MASUK_DITOLAK_JARINGAN",
      alasan: putusan.alasan,
      jalur: "sesi",
      userId: m.userId,
      sessionId: m.sessionId,
      headers: m.headers,
      rincian: { aturan: putusan.aturan, tahap: "sesi" },
    });
  }
  return putusan;
}

export function __setelUlangCatatanJaringanUntukUji() {
  sudahDicatat.clear();
}

// ─── Penyimpanan ─────────────────────────────────────────────────────────────

export async function tambahSubnetKantor(db: AletaDatabase, m: { cidr: string; label?: string }, olehId: string, kini = new Date()) {
  const cidr = normalkanCidr(m.cidr);
  const ada = await db.queryOne<{ id: string }>("SELECT id FROM aleta_subnet_kantor WHERE cidr = ?", [cidr]);
  if (ada) throw new Error(`Jaringan ${cidr} sudah ada di daftar.`);
  const id = `snk-${crypto.randomUUID()}`;
  await db
    .prepare("INSERT INTO aleta_subnet_kantor (id, cidr, label, aktif, dibuat_oleh, dibuat_pada) VALUES (?, ?, ?, 1, ?, ?)")
    .run(id, cidr, String(m.label ?? "").trim().slice(0, 80), olehId, kini.toISOString());
  bersihkanSinggahanJaringan();
  return id;
}

export async function hapusSubnetKantor(db: AletaDatabase, id: string) {
  const r = await db.run("DELETE FROM aleta_subnet_kantor WHERE id = ?", [id]);
  bersihkanSinggahanJaringan();
  return r.changes;
}

export async function aturSubnetAktif(db: AletaDatabase, id: string, aktif: boolean) {
  const r = await db.run("UPDATE aleta_subnet_kantor SET aktif = ? WHERE id = ?", [aktif ? 1 : 0, id]);
  bersihkanSinggahanJaringan();
  return r.changes;
}

/** Menyimpan aturan satu peran. "mana-pun" menghapus barisnya (kembali ke bawaan). */
export async function simpanAturanPeran(db: AletaDatabase, roleId: string, aturan: AturanJaringan, olehId: string, kini = new Date()) {
  if (!(ATURAN_JARINGAN as readonly string[]).includes(aturan)) throw new Error("Aturan jaringan tidak dikenal.");
  const peran = String(roleId ?? "").trim();
  if (!peran || peran.length > 80) throw new Error("Peran tidak sah.");
  if (aturan === "mana-pun") {
    await db.run("DELETE FROM aleta_aturan_jaringan_peran WHERE role_id = ?", [peran]);
  } else {
    await db
      .prepare(
        `INSERT INTO aleta_aturan_jaringan_peran (role_id, aturan, diubah_oleh, diubah_pada) VALUES (?, ?, ?, ?)
         ON CONFLICT(role_id) DO UPDATE SET aturan = excluded.aturan, diubah_oleh = excluded.diubah_oleh, diubah_pada = excluded.diubah_pada`
      )
      .run(peran, aturan, olehId, kini.toISOString());
  }
  bersihkanSinggahanJaringan();
}

/**
 * Pengaman diri: aturan + daftar jaringan (sesudah perubahan) tidak boleh mengunci
 * aktor yang sedang menyimpannya. Dipanggil rute SEBELUM menyimpan, dengan konfigurasi
 * hasil perubahan.
 */
export async function aktorTerkunciOlehKonfigurasi(
  db: AletaDatabase,
  m: { userId: string; ip: string; konfigurasi: KonfigurasiJaringan }
): Promise<{ terkunci: boolean; aturan: AturanJaringan; ip: string }> {
  const peran = await peranAkun(db, m.userId);
  const aturan = aturanEfektif(peran, m.konfigurasi.aturan);
  if (aturan === "mana-pun") return { terkunci: false, aturan, ip: m.ip };
  const aktif = m.konfigurasi.subnet.filter((s) => s.aktif);
  if (aktif.length === 0) return { terkunci: false, aturan, ip: m.ip }; // sama dengan penegakan: daftar kosong = longgar
  // luar-kantor-verifikasi: aktor di luar kantor masih bisa lolos lewat verifikasi, jadi tidak dianggap terkunci.
  if (aturan === "luar-kantor-verifikasi") return { terkunci: false, aturan, ip: m.ip };
  return { terkunci: !dalamJaringanKantor(m.ip, aktif), aturan, ip: m.ip };
}
