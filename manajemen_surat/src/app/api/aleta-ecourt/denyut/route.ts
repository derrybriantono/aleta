import { NextRequest } from "next/server";

import { GET as getKehadiranSaya } from "@/app/api/aleta-ecourt/antrian/kehadiran-saya/route";
import { GET as getChecklist } from "@/app/api/aleta-ecourt/checklist/route";
import { GET as getDisidang } from "@/app/api/aleta-ecourt/sidang/disidang/route";
import { GET as getSumberDaya } from "@/app/api/aleta-ecourt/sumber-daya/route";
import {
  bacaBagianDenyut,
  bacaJawabanBagian,
  JALUR_BAGIAN,
  type BagianDenyut,
  type JawabanBagian,
} from "@/server/modules/aleta-ecourt/denyut";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PENGENDALI: Record<BagianDenyut, (request: NextRequest) => Promise<Response>> = {
  sumberDaya: getSumberDaya,
  kehadiran: getKehadiranSaya,
  checklist: getChecklist,
  disidang: getDisidang,
};

/**
 * Denyut widget (performa muat 19 Okt 2026, K2) - lihat
 * @/server/modules/aleta-ecourt/denyut.
 *
 *   GET ?bagian=sumberDaya,kehadiran,checklist,disidang [&peran=<checklist>]
 *   -> { denyut: 1, bagian: { <nama>: { status, isi } } }
 *
 * `isi` = badan jawaban rute lamanya persis; `status` = status HTTP-nya.
 * Bagian yang tidak dikenal diabaikan. Bagian dijalankan bersamaan.
 */
export async function GET(request: NextRequest) {
  const bagian = bacaBagianDenyut(request.nextUrl.searchParams.get("bagian"));
  const peran = String(request.nextUrl.searchParams.get("peran") || "").trim();

  const hasil = await Promise.all(
    bagian.map(async (nama): Promise<[BagianDenyut, JawabanBagian]> => {
      const alamat = new URL(JALUR_BAGIAN[nama], request.nextUrl.origin);
      // basePath ikut agar rute lama melihat alamat yang sama dengan biasanya.
      alamat.pathname = `${request.nextUrl.basePath || ""}${JALUR_BAGIAN[nama]}`;
      if (nama === "checklist" && peran) alamat.searchParams.set("peran", peran);
      try {
        const jawaban = await PENGENDALI[nama](new NextRequest(alamat, { headers: request.headers }));
        return [nama, await bacaJawabanBagian(jawaban)];
      } catch {
        return [nama, { status: 500, isi: { ok: false, error: { message: "Bagian ini belum dapat dibaca." } } }];
      }
    })
  );

  return ok({ denyut: 1, bagian: Object.fromEntries(hasil) });
}
