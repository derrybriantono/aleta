import { createSign } from "node:crypto";
import { open, stat } from "node:fs/promises";
import path from "node:path";

/**
 * Klien Google Drive v3 lewat REST + fetch - TANPA pustaka baru.
 *
 * ============================================================================
 * DUA CARA MASUK, DAN KENAPA YANG PERTAMA BAWAAN
 * ============================================================================
 *
 * 1. OAuth "perangkat" (device flow) dengan cakupan drive.file - BAWAAN.
 *    Server ALETA hanya beralamat intranet (http://192.168.10.10), dan Google
 *    tidak menerima alamat seperti itu sebagai alamat balik OAuth biasa.
 *    Device flow tidak butuh alamat balik: admin membuka google.com/device
 *    di perangkat mana pun, memasukkan kode, lalu menyetujui. Cakupan
 *    drive.file berarti ALETA HANYA dapat melihat berkas yang dibuatnya
 *    sendiri - bukan isi Drive akun itu yang lain. Bekerja dengan akun Gmail
 *    biasa, yang dimiliki hampir setiap satker.
 *
 * 2. Akun layanan (JSON kunci, JWT RS256 ditandatangani node:crypto).
 *    Akun layanan TIDAK punya kuota penyimpanan sendiri: unggahan ke folder
 *    My Drive biasa ditolak Google (storageQuotaExceeded). Cara ini hanya
 *    berjalan dengan Shared Drive (Google Workspace) yang menambahkan akun
 *    layanan itu sebagai anggota. Layar menyebutkannya terang-terangan.
 *
 * Tidak ada token, kunci, atau sandi yang masuk ke pesan error: Galat
 * dibentuk dari status HTTP dan pesan Google (yang tidak memuat token), lalu
 * disaring lagi oleh saringRahasia di riwayat.
 */

export const CAKUPAN_OAUTH = "https://www.googleapis.com/auth/drive.file";
export const CAKUPAN_AKUN_LAYANAN = "https://www.googleapis.com/auth/drive";
const ALAMAT_TOKEN = "https://oauth2.googleapis.com/token";
const ALAMAT_KODE_PERANGKAT = "https://oauth2.googleapis.com/device/code";
const API = "https://www.googleapis.com/drive/v3";
const API_UNGGAH = "https://www.googleapis.com/upload/drive/v3";
export const MIME_FOLDER = "application/vnd.google-apps.folder";

/** Batas unggah multipart satu kali tembak; di atasnya resumable. */
const BATAS_MULTIPART = 5 * 1024 * 1024;
/** Potongan resumable - kelipatan 256 KiB sebagaimana diminta Google. */
const POTONGAN_RESUMABLE = 8 * 1024 * 1024;

export class GalatDrive extends Error {
  constructor(
    pesan: string,
    readonly status: number,
    readonly alasan = ""
  ) {
    super(pesan);
  }
}

async function pesanGoogle(jawab: Response) {
  const isi = (await jawab.json().catch(() => null)) as
    | { error?: { message?: string; errors?: Array<{ reason?: string }> } | string; error_description?: string }
    | null;
  if (!isi) return { pesan: `HTTP ${jawab.status}`, alasan: "" };
  if (typeof isi.error === "string") return { pesan: `${isi.error}${isi.error_description ? `: ${isi.error_description}` : ""}`, alasan: isi.error };
  return {
    pesan: isi.error?.message || `HTTP ${jawab.status}`,
    alasan: isi.error?.errors?.[0]?.reason || "",
  };
}

// ─── Token ───────────────────────────────────────────────────────────────────

export type SumberToken = { ambil: (paksa?: boolean) => Promise<string> };

function base64url(b: Buffer | string) {
  return Buffer.from(b).toString("base64url");
}

async function mintaToken(fetchImpl: typeof fetch, badan: Record<string, string>) {
  const jawab = await fetchImpl(ALAMAT_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(badan).toString(),
    signal: AbortSignal.timeout(30_000),
  });
  if (!jawab.ok) {
    const { pesan, alasan } = await pesanGoogle(jawab);
    throw new GalatDrive(
      alasan === "invalid_grant"
        ? "Persetujuan Google Drive sudah tidak berlaku (dicabut atau kedaluwarsa). Sambungkan ulang di layar Sinkron & cadangan."
        : `Google menolak permintaan token: ${pesan}`,
      jawab.status,
      alasan
    );
  }
  const isi = (await jawab.json()) as { access_token?: string; expires_in?: number };
  if (!isi.access_token) throw new GalatDrive("Google tidak mengirim access token.", 500);
  return { token: isi.access_token, berlakuSampai: Date.now() + Math.max(60, Number(isi.expires_in || 3600) - 60) * 1000 };
}

function sumberBersinggah(ambilBaru: () => Promise<{ token: string; berlakuSampai: number }>): SumberToken {
  let singgah: { token: string; berlakuSampai: number } | null = null;
  return {
    async ambil(paksa = false) {
      if (!paksa && singgah && singgah.berlakuSampai > Date.now()) return singgah.token;
      singgah = await ambilBaru();
      return singgah.token;
    },
  };
}

export function sumberTokenOAuth(
  rahasia: { clientId: string; clientSecret: string; refreshToken: string },
  fetchImpl: typeof fetch = fetch
): SumberToken {
  if (!rahasia.clientId || !rahasia.clientSecret || !rahasia.refreshToken) {
    throw new GalatDrive("Google Drive belum tersambung: isi Client ID dan Client secret lalu setujui lewat kode perangkat.", 400);
  }
  return sumberBersinggah(() =>
    mintaToken(fetchImpl, {
      client_id: rahasia.clientId,
      client_secret: rahasia.clientSecret,
      refresh_token: rahasia.refreshToken,
      grant_type: "refresh_token",
    })
  );
}

/** JWT RS256 untuk akun layanan - node:crypto, tanpa pustaka. */
export function susunJwtAkunLayanan(kunci: { client_email: string; private_key: string }, kini = Date.now()) {
  const iat = Math.floor(kini / 1000);
  const kepala = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const klaim = base64url(
    JSON.stringify({ iss: kunci.client_email, scope: CAKUPAN_AKUN_LAYANAN, aud: ALAMAT_TOKEN, iat, exp: iat + 3600 })
  );
  const tanda = createSign("RSA-SHA256").update(`${kepala}.${klaim}`).sign(kunci.private_key);
  return `${kepala}.${klaim}.${base64url(tanda)}`;
}

export function sumberTokenAkunLayanan(jsonKunci: string, fetchImpl: typeof fetch = fetch): SumberToken {
  let kunci: { client_email: string; private_key: string };
  try {
    kunci = JSON.parse(jsonKunci);
  } catch {
    throw new GalatDrive("Kunci akun layanan belum diunggah atau tidak terbaca.", 400);
  }
  if (!kunci?.client_email || !kunci?.private_key) throw new GalatDrive("Kunci akun layanan tidak lengkap.", 400);
  return sumberBersinggah(() =>
    mintaToken(fetchImpl, {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: susunJwtAkunLayanan(kunci),
    })
  );
}

// ─── Persetujuan perangkat ───────────────────────────────────────────────────

export async function mulaiPersetujuanPerangkat(clientId: string, fetchImpl: typeof fetch = fetch) {
  if (!clientId) throw new GalatDrive("Client ID OAuth belum diisi.", 400);
  const jawab = await fetchImpl(ALAMAT_KODE_PERANGKAT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, scope: CAKUPAN_OAUTH }).toString(),
    signal: AbortSignal.timeout(30_000),
  });
  if (!jawab.ok) {
    const { pesan } = await pesanGoogle(jawab);
    throw new GalatDrive(
      `Google menolak meminta kode perangkat: ${pesan}. Pastikan jenis OAuth client "TVs and Limited Input devices".`,
      jawab.status
    );
  }
  const isi = (await jawab.json()) as {
    device_code: string;
    user_code: string;
    verification_url?: string;
    verification_uri?: string;
    expires_in: number;
    interval?: number;
  };
  return {
    deviceCode: isi.device_code,
    userCode: isi.user_code,
    alamatVerifikasi: isi.verification_url || isi.verification_uri || "https://www.google.com/device",
    kedaluwarsa: new Date(Date.now() + Number(isi.expires_in || 1800) * 1000).toISOString(),
    jedaDetik: Number(isi.interval || 5),
  };
}

export type HasilPeriksaPerangkat =
  | { keadaan: "menunggu" | "lambat" | "ditolak" | "kedaluwarsa" }
  | { keadaan: "berhasil"; refreshToken: string; accessToken: string };

export async function periksaPersetujuanPerangkat(
  r: { clientId: string; clientSecret: string; deviceCode: string },
  fetchImpl: typeof fetch = fetch
): Promise<HasilPeriksaPerangkat> {
  const jawab = await fetchImpl(ALAMAT_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: r.clientId,
      client_secret: r.clientSecret,
      device_code: r.deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    }).toString(),
    signal: AbortSignal.timeout(30_000),
  });
  if (jawab.ok) {
    const isi = (await jawab.json()) as { refresh_token?: string; access_token?: string };
    if (!isi.refresh_token || !isi.access_token) throw new GalatDrive("Google tidak mengirim refresh token.", 500);
    return { keadaan: "berhasil", refreshToken: isi.refresh_token, accessToken: isi.access_token };
  }
  const { pesan, alasan } = await pesanGoogle(jawab);
  if (alasan === "authorization_pending") return { keadaan: "menunggu" };
  if (alasan === "slow_down") return { keadaan: "lambat" };
  if (alasan === "access_denied") return { keadaan: "ditolak" };
  if (alasan === "expired_token") return { keadaan: "kedaluwarsa" };
  throw new GalatDrive(`Google menolak: ${pesan}`, jawab.status, alasan);
}

// ─── Klien ───────────────────────────────────────────────────────────────────

export function mimeDari(nama: string) {
  const ext = path.extname(nama).toLowerCase().replace(".", "");
  const peta: Record<string, string> = {
    pdf: "application/pdf",
    rtf: "application/rtf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    odt: "application/vnd.oasis.opendocument.text",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    txt: "text/plain",
    csv: "text/csv",
    json: "application/json",
    gz: "application/gzip",
    zip: "application/zip",
    "7z": "application/x-7z-compressed",
    xz: "application/x-xz",
  };
  return peta[ext] || "application/octet-stream";
}

/** Kutip nilai untuk kueri q Drive: garis miring terbalik dan petik tunggal di-escape. */
export function kutipKueri(nilai: string) {
  return `'${String(nilai).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

export type BerkasDrive = { id: string; name: string; mimeType?: string; trashed?: boolean; size?: string };

export class KlienDrive {
  constructor(
    private readonly token: SumberToken,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly tidur: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))
  ) {}

  /** Satu permintaan dengan token, dicoba ulang untuk 429/5xx dan sekali untuk 401. */
  async minta(url: string, init: RequestInit = {}, percobaan = 0, sudahSegar = false): Promise<Response> {
    const token = await this.token.ambil(sudahSegar);
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    let jawab: Response;
    try {
      jawab = await this.fetchImpl(url, { ...init, headers, signal: init.signal ?? AbortSignal.timeout(120_000) });
    } catch (galat) {
      if (percobaan < 4) {
        await this.tidur(1000 * 2 ** percobaan);
        return this.minta(url, init, percobaan + 1, sudahSegar);
      }
      throw new GalatDrive(`Google Drive tidak terjangkau: ${(galat as Error)?.message || galat}`, 0);
    }
    if (jawab.status === 401 && !sudahSegar) return this.minta(url, init, percobaan, true);
    if ((jawab.status === 429 || jawab.status >= 500 || (jawab.status === 403 && percobaan < 4 && (await apakahBatasLaju(jawab)))) && percobaan < 5) {
      await this.tidur(1000 * 2 ** percobaan);
      return this.minta(url, init, percobaan + 1, sudahSegar);
    }
    return jawab;
  }

  private async json<T>(url: string, init: RequestInit = {}): Promise<T> {
    const jawab = await this.minta(url, init);
    if (!jawab.ok) {
      const { pesan, alasan } = await pesanGoogle(jawab);
      throw new GalatDrive(
        alasan === "storageQuotaExceeded"
          ? "Kuota penyimpanan Google Drive habis (akun layanan tidak punya kuota - pakai Shared Drive atau cara OAuth)."
          : `Google Drive: ${pesan}`,
        jawab.status,
        alasan
      );
    }
    return (await jawab.json()) as T;
  }

  async tentang() {
    const isi = await this.json<{ user?: { emailAddress?: string; displayName?: string }; storageQuota?: { limit?: string; usage?: string } }>(
      `${API}/about?fields=user(emailAddress,displayName),storageQuota`
    );
    return {
      email: isi.user?.emailAddress || "",
      nama: isi.user?.displayName || "",
      kuotaByte: isi.storageQuota?.limit ? Number(isi.storageQuota.limit) : null,
      terpakaiByte: isi.storageQuota?.usage ? Number(isi.storageQuota.usage) : null,
    };
  }

  async ambil(id: string) {
    return this.json<BerkasDrive>(`${API}/files/${encodeURIComponent(id)}?fields=id,name,mimeType,trashed&supportsAllDrives=true`);
  }

  async cariAnak(indukId: string, nama: string, folder: boolean): Promise<BerkasDrive | null> {
    const q = [
      `${kutipKueri(indukId)} in parents`,
      `name = ${kutipKueri(nama)}`,
      "trashed = false",
      folder ? `mimeType = '${MIME_FOLDER}'` : `mimeType != '${MIME_FOLDER}'`,
    ].join(" and ");
    const isi = await this.json<{ files: BerkasDrive[] }>(
      `${API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType)&pageSize=10&supportsAllDrives=true&includeItemsFromAllDrives=true`
    );
    return isi.files?.[0] ?? null;
  }

  async daftarAnak(indukId: string, folder: boolean): Promise<BerkasDrive[]> {
    const hasil: BerkasDrive[] = [];
    let halaman = "";
    const q = [`${kutipKueri(indukId)} in parents`, "trashed = false", folder ? `mimeType = '${MIME_FOLDER}'` : `mimeType != '${MIME_FOLDER}'`].join(" and ");
    do {
      const isi = await this.json<{ files: BerkasDrive[]; nextPageToken?: string }>(
        `${API}/files?q=${encodeURIComponent(q)}&fields=nextPageToken,files(id,name,mimeType)&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true${halaman ? `&pageToken=${encodeURIComponent(halaman)}` : ""}`
      );
      hasil.push(...(isi.files ?? []));
      halaman = isi.nextPageToken || "";
    } while (halaman);
    return hasil;
  }

  async buatFolder(nama: string, indukId: string) {
    const isi = await this.json<BerkasDrive>(`${API}/files?fields=id,name&supportsAllDrives=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ name: nama, mimeType: MIME_FOLDER, parents: [indukId] }),
    });
    return isi.id;
  }

  /** Folder bernama `nama` di bawah induk - yang ada dipakai, tidak dibuat dua kali. */
  async pastikanFolder(nama: string, indukId: string) {
    const ada = await this.cariAnak(indukId, nama, true);
    return ada ? ada.id : this.buatFolder(nama, indukId);
  }

  /** Memindahkan ke Sampah (dapat dipulihkan 30 hari) - tidak menghapus permanen. */
  async buang(id: string) {
    await this.json<BerkasDrive>(`${API}/files/${encodeURIComponent(id)}?fields=id&supportsAllDrives=true`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ trashed: true }),
    });
  }

  /**
   * Mengunggah isi di memori. `idLama` = perbarui berkas yang sama (riwayat
   * versinya disimpan Drive), bukan membuat duplikat bernama sama.
   */
  async unggah(nama: string, indukId: string, isi: Buffer, idLama = ""): Promise<string> {
    if (isi.length > BATAS_MULTIPART) return this.unggahResumable(nama, indukId, isi.length, (mulai, akhir) => Promise.resolve(isi.subarray(mulai, akhir)), idLama);
    const batas = `aleta${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    const meta = idLama ? { name: nama } : { name: nama, parents: [indukId] };
    const badan = Buffer.concat([
      Buffer.from(`--${batas}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${batas}\r\nContent-Type: ${mimeDari(nama)}\r\n\r\n`),
      isi,
      Buffer.from(`\r\n--${batas}--`),
    ]);
    const url = idLama
      ? `${API_UNGGAH}/files/${encodeURIComponent(idLama)}?uploadType=multipart&fields=id&supportsAllDrives=true`
      : `${API_UNGGAH}/files?uploadType=multipart&fields=id&supportsAllDrives=true`;
    try {
      const hasil = await this.json<BerkasDrive>(url, {
        method: idLama ? "PATCH" : "POST",
        headers: { "Content-Type": `multipart/related; boundary=${batas}` },
        body: new Uint8Array(badan),
      });
      return hasil.id;
    } catch (galat) {
      // Berkas lamanya dihapus orang di Drive: unggah sebagai berkas baru.
      if (idLama && galat instanceof GalatDrive && galat.status === 404) return this.unggah(nama, indukId, isi, "");
      throw galat;
    }
  }

  /** Mengunggah berkas di disk (arsip basis data, dapat beberapa GB) tanpa memuatnya utuh. */
  async unggahBerkas(nama: string, indukId: string, jalur: string): Promise<string> {
    const { size } = await stat(jalur);
    const pegangan = await open(jalur, "r");
    try {
      return await this.unggahResumable(nama, indukId, size, async (mulai, akhir) => {
        const b = Buffer.alloc(akhir - mulai);
        await pegangan.read(b, 0, b.length, mulai);
        return b;
      });
    } finally {
      await pegangan.close();
    }
  }

  private async unggahResumable(
    nama: string,
    indukId: string,
    ukuran: number,
    baca: (mulai: number, akhir: number) => Promise<Buffer>,
    idLama = ""
  ): Promise<string> {
    const url = idLama
      ? `${API_UNGGAH}/files/${encodeURIComponent(idLama)}?uploadType=resumable&fields=id&supportsAllDrives=true`
      : `${API_UNGGAH}/files?uploadType=resumable&fields=id&supportsAllDrives=true`;
    const buka = await this.minta(url, {
      method: idLama ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": mimeDari(nama),
        "X-Upload-Content-Length": String(ukuran),
      },
      body: JSON.stringify(idLama ? { name: nama } : { name: nama, parents: [indukId] }),
    });
    if (!buka.ok) {
      const { pesan, alasan } = await pesanGoogle(buka);
      if (idLama && buka.status === 404) return this.unggahResumable(nama, indukId, ukuran, baca, "");
      throw new GalatDrive(`Google Drive menolak membuka unggahan: ${pesan}`, buka.status, alasan);
    }
    const sesi = buka.headers.get("location");
    if (!sesi) throw new GalatDrive("Google Drive tidak mengirim alamat sesi unggah.", 500);

    let posisi = 0;
    let gagalBerturut = 0;
    while (true) {
      const akhir = Math.min(ukuran, posisi + POTONGAN_RESUMABLE);
      const potong = ukuran === 0 ? Buffer.alloc(0) : await baca(posisi, akhir);
      let jawab: Response;
      try {
        jawab = await this.fetchImpl(sesi, {
          method: "PUT",
          headers: {
            "Content-Length": String(potong.length),
            "Content-Range": ukuran === 0 ? "bytes */0" : `bytes ${posisi}-${akhir - 1}/${ukuran}`,
          },
          body: new Uint8Array(potong),
          signal: AbortSignal.timeout(300_000),
        });
      } catch {
        jawab = new Response(null, { status: 503 });
      }
      if (jawab.status === 200 || jawab.status === 201) {
        const isi = (await jawab.json()) as { id: string };
        return isi.id;
      }
      if (jawab.status === 308) {
        const rentang = jawab.headers.get("range");
        posisi = rentang ? Number(rentang.split("-")[1]) + 1 : 0;
        gagalBerturut = 0;
        continue;
      }
      if ((jawab.status >= 500 || jawab.status === 429) && gagalBerturut < 6) {
        gagalBerturut += 1;
        await this.tidur(1000 * 2 ** gagalBerturut);
        // Tanyakan berapa yang sudah diterima, lalu lanjut dari sana.
        const status = await this.fetchImpl(sesi, { method: "PUT", headers: { "Content-Range": `bytes */${ukuran}` } }).catch(
          () => null
        );
        if (status && (status.status === 200 || status.status === 201)) return ((await status.json()) as { id: string }).id;
        if (status && status.status === 308) {
          const rentang = status.headers.get("range");
          posisi = rentang ? Number(rentang.split("-")[1]) + 1 : 0;
        }
        continue;
      }
      const { pesan, alasan } = await pesanGoogle(jawab);
      throw new GalatDrive(
        alasan === "storageQuotaExceeded"
          ? "Kuota penyimpanan Google Drive habis (akun layanan tidak punya kuota - pakai Shared Drive atau cara OAuth)."
          : `Google Drive menolak unggahan ${nama}: ${pesan}`,
        jawab.status,
        alasan
      );
    }
  }
}

async function apakahBatasLaju(jawab: Response) {
  const { alasan } = await pesanGoogle(jawab.clone());
  return alasan === "rateLimitExceeded" || alasan === "userRateLimitExceeded";
}
