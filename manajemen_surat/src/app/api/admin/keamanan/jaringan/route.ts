import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import {
  ATURAN_JARINGAN,
  LABEL_ATURAN_JARINGAN,
  aktorTerkunciOlehKonfigurasi,
  alamatKlienJaringan,
  aturSubnetAktif,
  bacaKonfigurasiJaringan,
  dalamJaringanKantor,
  hapusSubnetKantor,
  normalkanCidr,
  simpanAturanPeran,
  tambahSubnetKantor,
  type AturanJaringan,
  type KonfigurasiJaringan,
} from "@/server/modules/keamanan/jaringan";
import { verifikasiLuarKantorTerdaftar } from "@/server/modules/keamanan/kait";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Badan = { aksi?: string; cidr?: string; label?: string; id?: string; aktif?: boolean; roleId?: string; aturan?: string };

async function ringkasan(db: Awaited<ReturnType<typeof getDatabase>>, request: NextRequest, userId: string) {
  const konfigurasi = await bacaKonfigurasiJaringan(db);
  const ip = alamatKlienJaringan(request.headers);
  return {
    konfigurasi,
    aturanTersedia: ATURAN_JARINGAN.map((kode) => ({
      kode,
      label: LABEL_ATURAN_JARINGAN[kode],
      tersedia: kode !== "luar-kantor-verifikasi" || Boolean(verifikasiLuarKantorTerdaftar()),
    })),
    ipAnda: ip,
    andaDalamKantor: dalamJaringanKantor(ip, konfigurasi.subnet),
    userId,
  };
}

/** Konfigurasi andaikan perubahan diterapkan - dasar pengaman diri dan syarat "daftar tidak boleh kosong". */
function terapkan(k: KonfigurasiJaringan, b: Badan, cidrBaru?: string): KonfigurasiJaringan {
  const subnet = k.subnet.map((s) => ({ ...s }));
  let aturan = k.aturan.map((a) => ({ ...a }));
  if (b.aksi === "tambah-subnet" && cidrBaru) subnet.push({ id: "baru", cidr: cidrBaru, label: "", aktif: true, dibuatOleh: "", dibuatPada: "" });
  if (b.aksi === "hapus-subnet") return { subnet: subnet.filter((s) => s.id !== b.id), aturan };
  if (b.aksi === "aktif-subnet") for (const s of subnet) if (s.id === b.id) s.aktif = b.aktif !== false;
  if (b.aksi === "atur-peran") {
    aturan = aturan.filter((a) => a.roleId !== b.roleId);
    if (b.aturan && b.aturan !== "mana-pun") aturan.push({ roleId: String(b.roleId), aturan: b.aturan as AturanJaringan, diubahOleh: "", diubahPada: "" });
  }
  return { subnet, aturan };
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await pastikanAksi(db, await resolveActorUserId(request), "keamanan.lihat");
    return ok(await ringkasan(db, request, actor.id));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await pastikanAksi(db, await resolveActorUserId(request), "keamanan.atur");
    const body = await readJsonBody<Badan>(request).catch(() => ({}) as Badan);
    const sebelum = await bacaKonfigurasiJaringan(db);
    const ip = alamatKlienJaringan(request.headers);

    let cidrBaru: string | undefined;
    if (body.aksi === "tambah-subnet") {
      try {
        cidrBaru = normalkanCidr(String(body.cidr ?? ""));
      } catch (galat) {
        throw new ApiError(400, galat instanceof Error ? galat.message : "Alamat jaringan tidak sah.");
      }
    } else if (body.aksi === "atur-peran") {
      if (!(ATURAN_JARINGAN as readonly string[]).includes(String(body.aturan))) throw new ApiError(400, "Aturan jaringan tidak dikenal.");
      if (body.aturan === "luar-kantor-verifikasi" && !verifikasiLuarKantorTerdaftar()) {
        throw new ApiError(400, "Verifikasi luar kantor belum tersedia (butuh OTP/authenticator). Pilih \"Hanya dari jaringan kantor\" atau \"Dari mana pun\".");
      }
    } else if (body.aksi !== "hapus-subnet" && body.aksi !== "aktif-subnet") {
      throw new ApiError(400, "Aksi jaringan tidak dikenal.");
    }
    if ((body.aksi === "hapus-subnet" || body.aksi === "aktif-subnet") && !sebelum.subnet.some((s) => s.id === body.id)) {
      throw new ApiError(404, "Jaringan tidak ditemukan.");
    }

    // Pengaman: daftar tidak boleh kosong selama ada aturan yang membatasi, dan Anda tidak boleh mengunci diri sendiri.
    const sesudah = terapkan(sebelum, body, cidrBaru);
    const membatasi = sesudah.aturan.some((a) => a.aturan !== "mana-pun");
    if (membatasi && !sesudah.subnet.some((s) => s.aktif)) {
      throw new ApiError(400, "Isi dulu daftar jaringan kantor (minimal satu yang aktif) sebelum membatasi peran mana pun.");
    }
    if (membatasi) {
      const kunci = await aktorTerkunciOlehKonfigurasi(db, { userId: actor.id, ip, konfigurasi: sesudah });
      if (kunci.terkunci) {
        throw new ApiError(
          400,
          `Perubahan ini akan mengunci akun Anda sendiri: aturan untuk peran Anda membatasi ke jaringan kantor, sedangkan Anda sedang membuka ALETA dari ${ip || "alamat yang tidak terbaca"}. ` +
            "Tambahkan jaringan Anda ke daftar lebih dulu."
        );
      }
    }

    try {
      if (body.aksi === "tambah-subnet") await tambahSubnetKantor(db, { cidr: cidrBaru!, label: body.label }, actor.id);
      else if (body.aksi === "hapus-subnet") await hapusSubnetKantor(db, String(body.id));
      else if (body.aksi === "aktif-subnet") await aturSubnetAktif(db, String(body.id), body.aktif !== false);
      else await simpanAturanPeran(db, String(body.roleId ?? ""), body.aturan as AturanJaringan, actor.id);
    } catch (galat) {
      throw new ApiError(400, galat instanceof Error ? galat.message : "Pengaturan jaringan tidak tersimpan.");
    }

    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "SECURITY_NETWORK_RULE_UPDATE",
      entityType: "security_setting",
      entityId: "batas-jaringan",
      payload: { aksi: body.aksi, cidr: cidrBaru ?? null, subnetId: body.id ?? null, roleId: body.roleId ?? null, aturan: body.aturan ?? null, aktif: body.aktif ?? null },
    });
    return ok(await ringkasan(db, request, actor.id));
  } catch (error) {
    return handleRouteError(error);
  }
}
