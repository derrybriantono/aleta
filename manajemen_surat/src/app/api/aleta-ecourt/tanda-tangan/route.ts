import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  getGatewayTandaTangan,
  kirimTandaTanganHapus,
  kirimTandaTanganNama,
  kirimTandaTanganSahkan,
  kirimTandaTanganTambah,
  kirimTandaTanganTautkanAkun,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { tautanSaatUnggah, tautkanTtdOtomatis } from "@/server/modules/aleta-ecourt/tautan-ttd";
import { appendAuditLog } from "@/server/shared/audit";
import { nextPrefixedId } from "@/server/shared/ids";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getPositionsFromDb, getUserByIdFromDb } from "@/server/modules/organization/service";
import { listUsersFromDb } from "@/server/modules/users/service";
import { getRoleLabel } from "@/lib/permissions";
import type { RoleId } from "@/lib/types";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * TANDA TANGAN PEJABAT - DAFTAR, PENAMAAN, DAN PENGESAHAN
 * ============================================================================
 *
 * Dipakai membubuhkan tanda tangan pada penetapan yang diterbitkan ALETA.
 * Gambarnya diimpor dari berkas .doc satuan kerja, dan pengukirannya kasar -
 * ia menyapu bita mencari tanda berkas PNG dan JPEG, tanpa tahu gambar mana
 * milik siapa.
 *
 * Karena itu tiap gambar harus DINAMAI dan DISAHKAN seorang manusia sebelum
 * dapat dipakai. Tanda tangan yang terpasang pada nama yang keliru adalah
 * tanda tangan palsu pada penetapan pengadilan, dan tidak ada satu galat pun
 * yang akan berbunyi.
 *
 * ============================================================================
 * KEWENANGANNYA "blangko-abt", BUKAN "penunjukan"
 * ============================================================================
 *
 * Yang boleh menuliskan penetapan belum tentu yang boleh menyatakan gambar ini
 * tanda tangan seorang hakim. Yang kedua menyangkut seluruh satuan kerja dan
 * berlaku untuk semua perkara sesudahnya - kewenangan yang sama dengan yang
 * menyunting blangko ABT.
 *
 * Nama pengesah diambil dari SESI, tidak pernah dari badan permintaan.
 */
async function pengesah(request: NextRequest) {
  const db = await getDatabase();
  const actorUserId = await resolveActorUserId(request);
  await pastikanKapabilitas(db, actorUserId, "blangko-abt");
  const aktor = actorUserId ? await getUserByIdFromDb(db, actorUserId) : null;
  const nama = String(aktor?.name || aktor?.email || actorUserId || "").trim();
  return { db, actorUserId, nama };
}

/**
 * Status HTTP jawaban ubah.
 *
 * Penolakan BOT (bot menjawab 4xx: gambar_sudah_ada, nama_pejabat_kosong, ...)
 * tetap 400. Bot yang TIDAK menjawab (tanpa status - koneksi ditolak, habis
 * waktu) atau menjawab 5xx menjadi 502: dulu semuanya 400, sehingga bot mati
 * terbaca seperti isian yang salah.
 */
/**
 * Pengguna yang dapat ditautkan ke tanda tangan - SEPERLUNYA saja: nama,
 * peran, jabatan, sub-peran (tanpa surel, WhatsApp, atau NIP).
 */
async function daftarPenggunaTaut(db: Awaited<ReturnType<typeof getDatabase>>, actorUserId: string | null) {
  const [daftar, jabatan] = await Promise.all([listUsersFromDb(db, actorUserId ?? ""), getPositionsFromDb(db)]);
  const namaJabatan = new Map(jabatan.map((j) => [String(j.id), String(j.name ?? "")]));
  return (daftar ?? [])
    .filter((u) => u.isActive !== false)
    .map((u) => ({
      id: String(u.id),
      nama: String(u.name ?? ""),
      peran: String(u.roleId ?? ""),
      peranLabel: getRoleLabel(u.roleId),
      jabatan: namaJabatan.get(String(u.positionId ?? "")) ?? "",
      subPeran: (u.additionalRoleIds ?? []).map((r) => getRoleLabel(r as RoleId)).join(", "),
    }))
    .sort((a, b) => a.nama.localeCompare(b.nama));
}

function statusUbah(respons: { ok: boolean; status?: number } | null | undefined): number {
  if (!respons || respons.ok !== false) return 200;
  const s = Number(respons.status ?? 0);
  return s >= 400 && s < 500 ? 400 : 502;
}

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    const sesi = await pengesah(request);
    db = sesi.db;
    actorUserId = sesi.actorUserId;

    const hanyaSah = request.nextUrl.searchParams.get("hanyaSah") === "1";
    const respons = await getGatewayTandaTangan(hanyaSah);

    // ========================================================================
    // DAFTAR PENGGUNA IKUT DIKIRIM DARI SINI
    // ========================================================================
    //
    // Bukan dibiarkan layar memanggil /api/users sendiri, dan sebabnya
    // kewenangan: layar ini menuntut "blangko-abt", sedangkan /api/users
    // menuntut aktor yang terdaftar pada modul pengguna. Petugas yang berhak
    // menamai tanda tangan belum tentu berhak membuka manajemen pengguna -
    // dan pemilih yang kosong akan terbaca sebagai "tidak ada pegawai",
    // bukan sebagai "Anda tidak berhak melihatnya".
    //
    // Yang dikirim SEPERLUNYA saja: nama, peran, jabatan, dan sub-peran. Tidak
    // ada surel, nomor WhatsApp, atau NIP - layar ini hanya perlu menautkan.
    let pengguna: Array<Record<string, string>> = [];
    let penggunaAlasan = "";
    try {
      pengguna = await daftarPenggunaTaut(sesi.db, sesi.actorUserId);
    } catch (galat) {
      // Gagalnya daftar pengguna TIDAK menjatuhkan layar tanda tangan -
      // menamai dengan mengetik tangan tetap jalan, dan itu memang yang
      // dikerjakan selama ini.
      penggunaAlasan = galat instanceof Error ? galat.message : "Daftar pengguna tidak terbaca.";
    }

    return Response.json(
      { ...(respons as Record<string, unknown>), pengguna, penggunaAlasan },
      { status: respons?.ok === false ? 502 : 200 }
    );
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "TANDA_TANGAN_BACA_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    const sesi = await pengesah(request);
    db = sesi.db;
    actorUserId = sesi.actorUserId;
    await pastikanAksi(db, actorUserId, "ttd.kelola"); // HAK-PERAN 12 Okt: matriks peran
    if (!sesi.nama) {
      return Response.json({ ok: false, alasan: "pengesah_tidak_dikenali" }, { status: 403 });
    }

    const badan = (await request.json()) as Record<string, unknown>;
    const tindakan = String(badan.tindakan ?? "");

    // Menambah tanda tangan baru BELUM punya id - diperiksa sebelum penjagaan
    // id di bawah, yang kalau tidak akan menolaknya dengan "id_tidak_sah",
    // alasan yang sama sekali tidak menerangkan apa yang salah.
    if (tindakan === "tambah") {
      const namaPejabat = String(badan.namaPejabat ?? "").slice(0, 150);
      let taut = {
        penggunaId: String(badan.penggunaId ?? "").slice(0, 64),
        peran: String(badan.peran ?? "").slice(0, 64),
        subPeran: String(badan.subPeran ?? "").slice(0, 255),
      };
      // 14 Okt 2026: berkas baru TANPA akun dipilih ditautkan otomatis bila
      // namanya sama persis dengan tepat satu akun aktif. Daftar pengguna yang
      // gagal dibaca tidak menggagalkan unggahan - ia hanya tidak ditautkan.
      let tautOtomatis: { penggunaId: string; namaAkun: string } | null = null;
      if (!taut.penggunaId && namaPejabat.trim()) {
        const otomatis = tautanSaatUnggah(
          { namaPejabat, penggunaId: "" },
          await daftarPenggunaTaut(sesi.db, sesi.actorUserId).catch(() => [])
        );
        if (otomatis) {
          taut = { penggunaId: otomatis.penggunaId, peran: otomatis.peran, subPeran: otomatis.subPeran };
          tautOtomatis = { penggunaId: otomatis.penggunaId, namaAkun: otomatis.namaAkun };
        }
      }
      const respons = await kirimTandaTanganTambah({
        isiBase64: String(badan.isiBase64 ?? ""),
        jenisBerkas: String(badan.jenisBerkas ?? ""),
        namaPejabat,
        jabatan: String(badan.jabatan ?? "").slice(0, 120),
        ...taut,
        asal: `unggahan layar oleh ${sesi.nama}`,
        oleh: sesi.nama,
      });
      return Response.json(
        respons && (respons as { ok?: boolean }).ok !== false && tautOtomatis
          ? { ...(respons as Record<string, unknown>), tautOtomatis }
          : respons,
        { status: statusUbah(respons) }
      );
    }

    // 14 Okt 2026: "TTD sudah ada namanya, langsung ditautkan saja dengan
    // akunnya". terapkan=false = PRATINJAU (tidak menulis apa pun); true =
    // hanya baris "pasti" (yang dipilih bila ids dikirim), dihitung ulang di sini.
    if (tindakan === "tautkan-otomatis") {
      const terapkan = badan.terapkan === true;
      const ids = Array.isArray(badan.ids) ? badan.ids.map(Number).filter((n) => Number.isFinite(n) && n > 0) : undefined;
      const hasil = await tautkanTtdOtomatis(
        {
          daftarBerkas: async () => {
            const r = (await getGatewayTandaTangan(false)) as {
              ok?: boolean;
              error?: string;
              data?: { baris?: Array<Record<string, unknown>> };
              baris?: Array<Record<string, unknown>>;
            };
            if (r?.ok === false) throw new Error(String(r.error ?? "Daftar tanda tangan tidak terbaca."));
            const baris = r?.data?.baris ?? r?.baris ?? [];
            return baris.map((b) => ({
              id: Number(b.id),
              namaPejabat: String(b.namaPejabat ?? ""),
              penggunaId: String(b.penggunaId ?? ""),
              disahkan: b.disahkan === true,
            }));
          },
          daftarAkun: () => daftarPenggunaTaut(sesi.db, sesi.actorUserId),
          tulisTautan: async (id, p) => {
            const r = (await kirimTandaTanganTautkanAkun(id, p)) as { ok?: boolean; error?: string; alasan?: string };
            return { ok: r?.ok !== false, alasan: String(r?.alasan ?? r?.error ?? "") };
          },
        },
        { terapkan, ids }
      );
      if (terapkan && hasil.diterapkan.length > 0) {
        await appendAuditLog(sesi.db, {
          id: await nextPrefixedId(sesi.db, "audit_logs", "adt"),
          actorUserId: sesi.actorUserId,
          action: "TTD_TAUTKAN_AKUN_OTOMATIS",
          entityType: "tanda_tangan",
          entityId: "massal",
          payload: {
            oleh: sesi.nama,
            berhasil: hasil.diterapkan.filter((d) => d.ok).map((d) => ({ id: d.id, penggunaId: d.penggunaId })),
            gagal: hasil.diterapkan.filter((d) => !d.ok).map((d) => ({ id: d.id, alasan: d.alasan })),
          },
        });
      }
      return Response.json({ ok: true, terapkan, ...hasil });
    }

    const id = Number(badan.id);
    if (!Number.isFinite(id) || id <= 0) {
      return Response.json({ ok: false, alasan: "id_tidak_sah" }, { status: 400 });
    }

    if (tindakan === "nama") {
      const respons = await kirimTandaTanganNama(id, {
        namaPejabat: String(badan.namaPejabat ?? "").slice(0, 150),
        jabatan: String(badan.jabatan ?? "").slice(0, 120),
        penggunaId: String(badan.penggunaId ?? "").slice(0, 64),
        peran: String(badan.peran ?? "").slice(0, 64),
        subPeran: String(badan.subPeran ?? "").slice(0, 255),
        oleh: sesi.nama,
      });
      return Response.json(respons, { status: statusUbah(respons) });
    }

    if (tindakan === "sahkan") {
      const respons = await kirimTandaTanganSahkan(id, sesi.nama);
      return Response.json(respons, { status: statusUbah(respons) });
    }

    if (tindakan === "hapus") {
      const respons = await kirimTandaTanganHapus(id);
      return Response.json(respons, { status: statusUbah(respons) });
    }

    return Response.json({ ok: false, alasan: "tindakan_tidak_dikenali" }, { status: 400 });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "TANDA_TANGAN_UBAH_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
