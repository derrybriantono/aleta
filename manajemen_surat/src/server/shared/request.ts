import { NextRequest } from "next/server";

export function getSearchParam(request: NextRequest, key: string) {
  const value = request.nextUrl.searchParams.get(key);
  return value?.trim() ? value.trim() : undefined;
}

export function getSearchParamArray(request: NextRequest, key: string) {
  const values = request.nextUrl.searchParams.getAll(key);

  return values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

export function getBooleanSearchParam(request: NextRequest, key: string) {
  const value = getSearchParam(request, key);
  if (!value) return undefined;

  return value === "true" || value === "1";
}

export function getNumberSearchParam(request: NextRequest, key: string) {
  const value = getSearchParam(request, key);
  if (!value) return undefined;

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

export function getRequestAuditMetadata(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();

  return {
    method: request.method,
    path: request.nextUrl.pathname,
    ipAddress: forwardedFor || realIp || "unknown",
    userAgent: request.headers.get("user-agent")?.slice(0, 240) ?? "unknown",
  };
}

/**
 * ============================================================================
 * ALAMAT PERAMBAN OPERATOR - UNTUK BARIS AUDIT SIPP
 * ============================================================================
 *
 * sys_audittrail SIPP menyimpan alamat IP pada tiap barisnya, dan alamat itu
 * DIBACA: layar Audit Trail menampilkannya sebagai kolom tersendiri.
 *
 * Yang tercatat pada baris tulisan ALETA adalah alamat peti portalnya -
 * 172.18.0.3, alamat jaringan Docker. Dihitung atas seluruh sys_audittrail
 * satker sejak 2016: TIDAK ADA satu pun alamat di luar 192.168.x.x. Alamat
 * peti itu berdiri sendiri di sepuluh tahun riwayat, dan menyaring audit
 * menurut alamat memulangkan tepat pekerjaan ALETA.
 *
 * Yang benar alamat peramban petugas yang menekan tombolnya - itulah yang
 * dicatat SIPP untuk pekerjaan yang sama, dan itu pula yang sesungguhnya
 * terjadi: perintahnya memang datang dari sana.
 *
 * Hanya IPv4 yang dipulangkan, sebab kolomnya varchar(15): alamat IPv6 akan
 * terpotong di tengah dan menjadi alamat lain yang keliru. Bila tidak ada
 * yang sah, dipulangkan kosong - pemanggil jatuh ke perilaku lamanya, bukan
 * menuliskan alamat karangan.
 */
export function alamatIpPeramban(request: NextRequest | Request) {
  const ambil = (nama: string) => request.headers.get(nama) || "";
  const diteruskan = ambil("x-forwarded-for").split(",");
  const calon = [
    // ========================================================================
    // ENTRI TERAKHIR, BUKAN PERTAMA
    // ========================================================================
    //
    // Kebiasaan umum membaca entri PERTAMA X-Forwarded-For. Di sini itu salah,
    // dan salahnya berbahaya: mod_proxy_http Apache MENAMBAHKAN alamat pengirim
    // ke ujung daftar yang sudah ada. Peramban yang mengirim sendiri
    //
    //   X-Forwarded-For: 1.2.3.4
    //
    // menghasilkan "1.2.3.4, 192.168.9.121" di sisi portal - dan entri pertama
    // adalah karangan peramban.
    //
    // Yang ditulis Apache hanya entri terakhir: alamat yang benar-benar
    // menyambung ke peladen. Itu tidak dapat dipalsukan dari peramban.
    //
    // Alamat ini masuk ke sys_audittrail SIPP pada baris yang tercatat atas
    // nama PEJABAT. Alamat yang dapat dikarang peramban pada baris semacam itu
    // lebih buruk daripada alamat peti yang keliru tetapi jujur: yang pertama
    // terbaca sebagai bukti.
    diteruskan[diteruskan.length - 1],
    ambil("x-real-ip"),
  ];
  for (const satu of calon) {
    const bersih = String(satu || "").trim().replace(/^::ffff:/, "");
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(bersih) && bersih.length <= 15) {
      const bagian = bersih.split(".").map(Number);
      if (bagian.every((x) => x >= 0 && x <= 255)) return bersih;
    }
  }
  return "";
}

export async function readJsonBody<T>(request: Request) {
  return (await request.json()) as T;
}
