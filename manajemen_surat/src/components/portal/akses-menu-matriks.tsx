"use client";

/* === HAK-PERAN 12 Okt === */
/**
 * Kartu Akses Menu "Aplikasi menurut matriks peran" (12 Okt 2026).
 *
 * Bawaan tiap aplikasi per peran datang dari src/lib/matriks-peran.ts. Super
 * Admin dapat MENIMPANYA per peran: Buka (juga untuk aplikasi belum fix) atau
 * Tutup. Timpaan disimpan sebagai baris module_visibility_settings dengan
 * kunci buka:<id> / tutup:<id> lewat rute Akses Menu yang sudah ada (tercatat
 * di audit UPDATE_MODULE_VISIBILITY).
 */

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import {
  ATURAN_APLIKASI,
  LABEL_GOLONGAN,
  bawaanAplikasiGolongan,
  golonganDariPeran,
  kunciBukaAplikasi,
  kunciTutupAplikasi,
  timpaanAplikasi,
  type TimpaanAkses,
} from "@/lib/matriks-peran";
import type { ModuleVisibility, RoleId } from "@/lib/types";

export function AksesMenuMatriks({
  item,
  namaPeran,
  onToggle,
}: {
  item: ModuleVisibility;
  namaPeran: string;
  onToggle: (roleId: RoleId, moduleId: string, enabled: boolean) => void;
}) {
  const golongan = golonganDariPeran(item.roleId);
  const modul = item.modules as Partial<Record<string, boolean>>;

  const ubah = (appId: string, nilai: TimpaanAkses) => {
    // Dua baris: hanya satu yang menyala; "bawaan" mematikan keduanya.
    onToggle(item.roleId, kunciBukaAplikasi(appId), nilai === "buka");
    onToggle(item.roleId, kunciTutupAplikasi(appId), nilai === "tutup");
  };

  return (
    <Card className="border-border/80" data-akses-matriks={item.roleId}>
      <CardHeader>
        <CardTitle>Aplikasi menurut matriks peran - {namaPeran}</CardTitle>
        <CardDescription>
          Bawaan dihitung dari jabatan ({LABEL_GOLONGAN[golongan]}). Aplikasi BELUM FIX hanya tampil bagi Super Admin sampai
          dibuka di sini. Jabatan & peran tambahan tiap akun ikut menentukan (mis. Pelaksana + peran tambahan Kasir).
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 lg:grid-cols-2">
        {ATURAN_APLIKASI.map((aturan) => {
          const timpaan = timpaanAplikasi({ roleId: item.roleId, modules: modul }, aturan.id);
          const bawaan = bawaanAplikasiGolongan([golongan], aturan.id);
          const berlaku = timpaan === "buka" ? true : timpaan === "tutup" ? false : bawaan;
          return (
            <div
              key={aturan.id}
              data-akses-aplikasi={aturan.id}
              className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-muted/35 p-4"
            >
              <span className="min-w-0 space-y-1">
                <span className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                  {aturan.label}
                  {aturan.status === "belum-fix" ? (
                    <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300">
                      Belum fix
                    </Badge>
                  ) : null}
                  <Badge variant={berlaku ? "success" : "muted"}>{berlaku ? "Tampil" : "Tersembunyi"}</Badge>
                </span>
                <span className="block text-sm text-muted-foreground">{aturan.alasan}</span>
                <span className="block text-xs text-muted-foreground">Bawaan peran ini: {bawaan ? "tampil" : "tersembunyi"}</span>
              </span>
              <NativeSelect
                aria-label={`Timpaan ${aturan.label} untuk ${namaPeran}`}
                value={timpaan}
                onChange={(e) => ubah(aturan.id, e.target.value as TimpaanAkses)}
                className="w-36 shrink-0"
              >
                <option value="bawaan">Bawaan</option>
                <option value="buka">Buka</option>
                <option value="tutup">Tutup</option>
              </NativeSelect>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
/* === AKHIR HAK-PERAN === */
