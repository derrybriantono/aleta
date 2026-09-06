"use client";

/**
 * Kendali berkas e-Court.
 *
 * ============================================================================
 * SATU BARIS PER PERKARA, RINCIAN DIBUKA SAAT DIPILIH
 * ============================================================================
 *
 * Arsip memuat ribuan dokumen. Menampilkan seluruhnya sekaligus menghasilkan
 * halaman yang tidak dapat dibaca dan tidak menjawab pertanyaan siapa pun.
 *
 * Pertanyaan yang sebenarnya dihadapi petugas adalah "perkara mana yang
 * berkasnya belum lengkap" - dan itu dijawab dengan hitungan per perkara.
 * Daftar dokumennya baru berguna setelah satu perkara dipilih.
 */

import { Fragment, useCallback, useEffect, useState } from "react";

import { AletaEcourtKendaliSipp } from "@/components/portal/aleta-ecourt-kendali-sipp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import { formatDateTime } from "@/lib/format";

type BarisPerkara = {
  nomorPerkara: string;
  nomorRegister: string;
  dokumen: number;
  adaPdf: number;
  adaWord: number;
  tanpaBerkas: number;
  menungguMajelis: number;
  sudahValid: number;
  berkasPendaftaran: number;
  dihapusRetensi: number;
  terakhirTerlihat: string | null;
};

type BarisDokumen = {
  documentKey: string;
  judulDokumen: string;
  jenisDokumen: string;
  peranPengunggah: string;
  statusVerifikasi: string;
  tanggalSidang: string | null;
  agenda: string;
  adaPdf: boolean;
  adaWord: boolean;
  /**
   * Berkas yang TERCATAT pernah diunduh tetapi tidak ada lagi di disk.
   *
   * Bedanya dengan "belum tersimpan" menentukan tindakan: yang belum pernah
   * diunduh menunggu penarikan biasa, sedangkan yang hilang menuntut unduh
   * ulang. Tanpa pembedaan ini keduanya tampak sama dan tidak ada yang tahu
   * arsipnya perlu diisi ulang.
   */
  berkasHilang?: number;
  ukuranByte: number;
  diberitahukanPada: string | null;
};

const STATUS_TERBACA: Record<string, { teks: string; nada: "default" | "muted" | "warning" | "danger" }> = {
  belum: { teks: "Menunggu majelis", nada: "warning" },
  valid: { teks: "Sudah diverifikasi", nada: "default" },
  tidak_valid: { teks: "Tidak valid", nada: "danger" },
  // Berkas pendaftaran tidak mengenal verifikasi di e-Court sama sekali.
  tidak_perlu: { teks: "Berkas pendaftaran", nada: "muted" },
};

function ukuranTerbaca(byte: number): string {
  if (!byte) return "—";
  if (byte < 1024 * 1024) return `${Math.round(byte / 1024)} KB`;
  return `${(byte / (1024 * 1024)).toFixed(1)} MB`;
}

export function AletaEcourtArsipBerkas({
  onBukaPerkara,
}: { onBukaPerkara?: (nomor: string) => void } = {}) {
  const [perkara, setPerkara] = useState<BarisPerkara[]>([]);
  const [total, setTotal] = useState(0);
  const [pesan, setPesan] = useState("");
  const [memuat, setMemuat] = useState(true);

  const [cari, setCari] = useState("");
  const [kataCari, setKataCari] = useState("");
  const [belumLengkap, setBelumLengkap] = useState(false);
  const [urutkan, setUrutkan] = useState("terbaru");

  const [dibuka, setDibuka] = useState("");
  const [rincian, setRincian] = useState<BarisDokumen[]>([]);
  const [memuatRincian, setMemuatRincian] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const params = new URLSearchParams({
        cari: kataCari,
        belumLengkap: belumLengkap ? "1" : "0",
        urutkan,
        batas: "100",
      });
      const respons = await fetch(apiPath(`/api/aleta-ecourt/arsip/perkara?${params.toString()}`), {
        cache: "no-store",
      });
      const hasil = await respons.json();
      const isi = hasil?.data ?? hasil;

      if (!isi?.available) {
        setPesan(isi?.message || "ALETA Bot belum dapat dihubungi.");
        setPerkara([]);
        setTotal(0);
      } else {
        setPesan("");
        setPerkara(isi.perkara ?? []);
        setTotal(isi.total ?? 0);
      }
    } catch (error) {
      setPesan(error instanceof Error ? error.message : "Gagal membaca arsip.");
      setPerkara([]);
    } finally {
      setMemuat(false);
    }
  }, [kataCari, belumLengkap, urutkan]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void muat();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [muat]);

  const bukaRincian = useCallback(
    async (nomorPerkara: string) => {
      // Menekan baris yang sama menutupnya kembali.
      if (dibuka === nomorPerkara) {
        setDibuka("");
        setRincian([]);
        return;
      }

      setDibuka(nomorPerkara);
      setRincian([]);
      setMemuatRincian(true);
      try {
        const params = new URLSearchParams({ nomor: nomorPerkara });
        const respons = await fetch(apiPath(`/api/aleta-ecourt/arsip/perkara?${params.toString()}`), {
          cache: "no-store",
        });
        const hasil = await respons.json();
        const isi = hasil?.data ?? hasil;
        setRincian(isi?.available ? (isi.dokumen ?? []) : []);
      } catch {
        setRincian([]);
      } finally {
        setMemuatRincian(false);
      }
    },
    [dibuka]
  );

  return (
    // Dua pertanyaan berbeda, dua panel berurutan: apa yang SEHARUSNYA ada
    // menurut SIPP di atas, apa yang SUDAH ada di arsip di bawah.
    <div className="space-y-4">
      <AletaEcourtKendaliSipp onBukaPerkara={onBukaPerkara} />

      <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Kendali Berkas e-Court</CardTitle>
          <CardDescription>
            Perkara mana yang berkasnya sudah lengkap, dan mana yang belum. Tekan satu baris untuk
            melihat dokumennya.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" disabled={memuat} onClick={() => void muat()}>
          {memuat ? "Memuat…" : "Perbarui Data"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {pesan ? <p className="rounded border border-border bg-muted/40 p-3 text-sm">{pesan}</p> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Input
            className="max-w-xs"
            placeholder="Cari nomor perkara atau register…"
            value={cari}
            onChange={(event) => setCari(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") setKataCari(cari.trim());
            }}
          />
          <Button variant="outline" size="sm" onClick={() => setKataCari(cari.trim())}>
            Cari
          </Button>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={belumLengkap}
              onChange={(event) => setBelumLengkap(event.target.checked)}
            />
            Hanya yang berkasnya belum lengkap
          </label>

          <label className="flex items-center gap-2 text-sm">
            Urutkan
            <select
              className="rounded border border-border bg-background px-2 py-1 text-sm"
              value={urutkan}
              onChange={(event) => setUrutkan(event.target.value)}
            >
              <option value="terbaru">Terakhir dibaca (terbaru)</option>
              <option value="terlama">Terakhir dibaca (terlama)</option>
              <option value="belumTerbanyak">Berkas belum ada (terbanyak)</option>
              <option value="menungguTerbanyak">Menunggu majelis (terbanyak)</option>
              <option value="dokumenTerbanyak">Jumlah dokumen (terbanyak)</option>
              <option value="perkara">Nomor perkara (A-Z)</option>
            </select>
          </label>
          <span className="ml-auto text-sm text-muted-foreground">
            {total} perkara{kataCari ? ` cocok "${kataCari}"` : ""}
          </span>
        </div>

        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Nomor Perkara</th>
                <th className="px-3 py-2 font-medium">Register e-Court</th>
                <th className="px-3 py-2 text-right font-medium">Dokumen</th>
                <th className="px-3 py-2 text-right font-medium">Berkas ada</th>
                <th className="px-3 py-2 text-right font-medium">Belum ada</th>
                <th className="px-3 py-2 font-medium">Keadaan</th>
                <th className="px-3 py-2 font-medium">Terakhir dibaca</th>
                <th className="px-3 py-2 font-medium">Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {perkara.length === 0 && !memuat ? (
                <tr>
                  <td className="px-3 py-6 text-center text-muted-foreground" colSpan={8}>
                    {kataCari || belumLengkap
                      ? "Tidak ada perkara yang cocok dengan penyaringan ini."
                      : "Arsip masih kosong. Jalankan penarikan e-Court lebih dulu."}
                  </td>
                </tr>
              ) : null}

              {perkara.map((baris) => (
                // Kunci ada di Fragment, bukan di baris di dalamnya. React
                // membaca kunci pada elemen terluar yang dihasilkan map, dan
                // meletakkannya di dalam membuat React kehilangan jejak baris
                // saat daftar disaring atau diurutkan ulang.
                <Fragment key={baris.nomorPerkara}>
                  <tr
                    className="cursor-pointer border-t border-border hover:bg-muted/40"
                    onClick={() => void bukaRincian(baris.nomorPerkara)}
                  >
                    <td className="px-3 py-2 font-medium">{baris.nomorPerkara}</td>
                    <td className="px-3 py-2 font-mono text-xs">{baris.nomorRegister || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{baris.dokumen}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {baris.adaPdf + baris.adaWord}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {baris.tanpaBerkas > 0 ? (
                        <span className="font-semibold text-amber-700 dark:text-amber-300">
                          {baris.tanpaBerkas}
                        </span>
                      ) : (
                        "0"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {baris.tanpaBerkas === 0 ? <Badge variant="default">Lengkap</Badge> : null}
                        {baris.menungguMajelis > 0 ? (
                          <Badge variant="warning">{baris.menungguMajelis} menunggu majelis</Badge>
                        ) : null}
                        {baris.berkasPendaftaran > 0 ? (
                          <Badge variant="muted">{baris.berkasPendaftaran} pendaftaran</Badge>
                        ) : null}
                        {/* Dipisahkan dari "belum ada": berkas ini sengaja
                            dihapus karena masa simpan, dan TIDAK perlu ditarik
                            ulang. Menyamakannya membuat petugas menariknya lagi
                            dari e-Court tanpa sebab. */}
                        {baris.dihapusRetensi > 0 ? (
                          <Badge
                            variant="muted"
                            title="Berkas dihapus karena melewati masa simpan arsip. Catatannya tetap tersimpan."
                          >
                            {baris.dihapusRetensi} dihapus (masa simpan)
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {baris.terakhirTerlihat ? formatDateTime(baris.terakhirTerlihat) : "—"}
                    </td>
                    {/* Tombol hanya muncul bila memang ada berkas yang belum
                        tersimpan. Menawarkan penarikan untuk perkara yang sudah
                        lengkap hanya mengundang permintaan yang pasti dilewati
                        jembatan - dan membuat tombolnya terasa tidak berguna. */}
                    <td className="px-3 py-2" onClick={(peristiwa) => peristiwa.stopPropagation()}>
                      <div className="flex flex-col gap-1">
                        {baris.tanpaBerkas > 0 ? (
                          <TombolTarikPerkara
                            nomorPerkara={baris.nomorPerkara}
                            onSelesai={() => void muat()}
                          />
                        ) : null}

                        {/* ZIP hanya ditawarkan bila memang ada berkas yang
                            tersimpan. Menawarkan unduhan untuk perkara yang
                            berkasnya belum ada hanya menghasilkan ZIP kosong. */}
                        {baris.adaPdf + baris.adaWord > 0 ? (
                          <TombolUnduhZip nomorPerkara={baris.nomorPerkara} />
                        ) : null}
                      </div>
                    </td>
                  </tr>

                  {dibuka === baris.nomorPerkara ? (
                    <tr className="border-t border-border bg-muted/20">
                      <td className="px-3 py-3" colSpan={8}>
                        {memuatRincian ? (
                          <p className="text-sm text-muted-foreground">Memuat dokumen…</p>
                        ) : rincian.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Tidak ada dokumen tercatat untuk perkara ini.
                          </p>
                        ) : (
                          <DaftarDokumen dokumen={rincian} />
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <p className="rounded bg-muted/50 p-2.5 text-xs text-muted-foreground">
          &quot;Belum ada&quot; berarti dokumennya tercatat di ALETA tetapi berkas PDF/Word-nya belum
          tersimpan di server. Jalankan penarikan lagi untuk melengkapinya &mdash; perkara yang sudah
          lengkap tidak akan diminta ulang ke e-Court.
        </p>
      </CardContent>
      </Card>
    </div>
  );
}

/** Tabel dokumen satu perkara, muncul saat barisnya dibuka. */
/**
 * Menarik berkas satu perkara sekarang juga.
 *
 * ==========================================================================
 * MENJAWAB SEKETIKA, BUKAN MENUNGGU SELESAI
 * ==========================================================================
 *
 * Penarikan satu perkara tetap memerlukan waktu - membuka peramban, masuk ke
 * e-Court, mengunduh tiap berkas. Menahan tombolnya sampai selesai membuat
 * halaman tampak menggantung, dan proksi akan memutus permintaannya lebih
 * dulu. Karena itu tombolnya melaporkan bahwa penarikan DIMULAI, dan
 * kemajuannya diikuti di panel Penarikan berkas e-Court.
 */
function TombolTarikPerkara({
  nomorPerkara,
  onSelesai,
}: {
  nomorPerkara: string;
  onSelesai: () => void;
}) {
  const [sibuk, setSibuk] = useState(false);
  const [catatan, setCatatan] = useState("");

  const tarik = async () => {
    setSibuk(true);
    setCatatan("");
    try {
      const jawaban = await fetch(apiPath("/api/aleta-ecourt/penarikan"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tindakan: "perkara", nomorPerkara }),
      });
      const isi = await jawaban.json();

      if (!jawaban.ok) {
        setCatatan(pesanGalatPortal(isi, `HTTP ${jawaban.status}`));
        return;
      }

      const data = isi?.data ?? isi;
      if (!data?.ok) {
        const sebab: Record<string, string> = {
          penarikan_sedang_berjalan: "Penarikan lain sedang berjalan.",
          penarikan_lain_masih_berjalan: "Ada penarikan lain di luar portal.",
          nomor_perkara_kosong: "Nomor perkara kosong.",
        };
        setCatatan(sebab[String(data?.alasan)] || String(data?.message || data?.alasan || "Tidak berhasil."));
        return;
      }

      setCatatan("Penarikan dimulai.");
      onSelesai();
    } catch (kesalahan) {
      setCatatan(kesalahan instanceof Error ? kesalahan.message : "Gagal menghubungi server.");
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div className="space-y-1">
      <Button size="sm" variant="outline" disabled={sibuk} onClick={() => void tarik()}>
        {sibuk ? "Memulai…" : "Tarik berkas"}
      </Button>
      {catatan ? (
        <p className="max-w-[14rem] text-xs text-muted-foreground">{catatan}</p>
      ) : null}
    </div>
  );
}

/**
 * Mengunduh SELURUH berkas satu perkara sebagai satu ZIP.
 *
 * Majelis yang menyiapkan sidang memerlukan seluruh berkas, bukan satu per
 * satu. ZIP disusun di server dari berkas yang SUDAH tersimpan - e-Court tidak
 * disentuh sama sekali oleh tombol ini.
 */
function TombolUnduhZip({ nomorPerkara }: { nomorPerkara: string }) {
  const [sibuk, setSibuk] = useState(false);
  const [catatan, setCatatan] = useState("");

  const unduh = async () => {
    setSibuk(true);
    setCatatan("");
    try {
      const params = new URLSearchParams({ nomor: nomorPerkara });
      const respons = await fetch(apiPath(`/api/aleta-ecourt/berkas-zip?${params.toString()}`), {
        cache: "no-store",
      });

      const tipe = respons.headers.get("content-type") || "";
      if (!respons.ok || tipe.includes("application/json")) {
        const isi = await respons.json().catch(() => null);
        setCatatan(pesanGalatPortal(isi, `HTTP ${respons.status}`).replace(/_/g, " "));
        return;
      }

      const blob = await respons.blob();
      if (blob.size === 0) {
        setCatatan("ZIP-nya kosong.");
        return;
      }

      const alamat = URL.createObjectURL(blob);
      const tautan = document.createElement("a");
      tautan.href = alamat;

      const disposisi = respons.headers.get("content-disposition") || "";
      const cocok = disposisi.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
      tautan.download = cocok
        ? decodeURIComponent(cocok[1])
        : `ecourt-${nomorPerkara.replace(/[^\w.-]+/g, "-")}.zip`;

      document.body.appendChild(tautan);
      tautan.click();
      tautan.remove();
      window.setTimeout(() => URL.revokeObjectURL(alamat), 60000);
    } catch (kesalahan) {
      setCatatan(kesalahan instanceof Error ? kesalahan.message : "Gagal mengunduh ZIP.");
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div className="space-y-1">
      <Button size="sm" variant="outline" disabled={sibuk} onClick={() => void unduh()}>
        {sibuk ? "Menyusun…" : "Unduh ZIP"}
      </Button>
      {catatan ? <p className="max-w-[14rem] text-xs text-muted-foreground">{catatan}</p> : null}
    </div>
  );
}

function DaftarDokumen({ dokumen }: { dokumen: BarisDokumen[] }) {
  return (
    <div className="overflow-x-auto rounded border border-border bg-background">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-muted/40 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">Judul Dokumen</th>
            <th className="px-3 py-2 font-medium">Jenis</th>
            <th className="px-3 py-2 font-medium">Diunggah oleh</th>
            <th className="px-3 py-2 font-medium">Sidang</th>
            <th className="px-3 py-2 font-medium">Keadaan</th>
            <th className="px-3 py-2 text-right font-medium">Ukuran</th>
            <th className="px-3 py-2 font-medium">Berkas</th>
          </tr>
        </thead>
        <tbody>
          {dokumen.map((d) => {
            const status = STATUS_TERBACA[d.statusVerifikasi] ?? {
              teks: d.statusVerifikasi,
              nada: "muted" as const,
            };
            return (
              <tr key={d.documentKey} className="border-t border-border">
                <td className="px-3 py-2">
                  <div className="font-medium">{d.judulDokumen || "(tanpa judul)"}</div>
                  {d.agenda ? <div className="text-xs text-muted-foreground">{d.agenda}</div> : null}
                </td>
                <td className="px-3 py-2">{d.jenisDokumen || "—"}</td>
                <td className="px-3 py-2">{d.peranPengunggah || "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {d.tanggalSidang ? formatDateTime(d.tanggalSidang) : "—"}
                </td>
                <td className="px-3 py-2">
                  <Badge variant={status.nada}>{status.teks}</Badge>
                  {d.diberitahukanPada ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Pihak diberi tahu {formatDateTime(d.diberitahukanPada)}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {ukuranTerbaca(d.ukuranByte)}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {d.adaPdf ? <TombolUnduh documentKey={d.documentKey} format="pdf" label="PDF" /> : null}
                    {d.adaWord ? (
                      <TombolUnduh documentKey={d.documentKey} format="word" label="Word" />
                    ) : null}
                    {!d.adaPdf && !d.adaWord ? (
                      (d.berkasHilang ?? 0) > 0 ? (
                        <span
                          className="text-xs text-amber-700 dark:text-amber-500"
                          title="Berkasnya tercatat pernah diunduh tetapi tidak ada lagi di disk. Jalankan penarikan ulang untuk mengisinya kembali."
                        >
                          berkas hilang - perlu unduh ulang
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">belum tersimpan</span>
                      )
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Tombol unduh satu berkas.
 *
 * ============================================================================
 * KENAPA TIDAK MEMAKAI TAUTAN UNDUH BIASA
 * ============================================================================
 *
 * Tautan <a download> menyimpan APA PUN yang dijawab server sebagai berkas -
 * termasuk jawaban galat berbentuk JSON. Yang terjadi di server: unduhan gagal,
 * dan yang tersimpan di folder Downloads petugas adalah "berkas.json" berisi
 * alasannya - yang tidak akan pernah dibuka siapa pun.
 *
 * Akibatnya sebab kegagalan tersembunyi sama sekali: petugas hanya melihat
 * berkas asing muncul, tanpa satu pun keterangan mengapa berkasnya tidak ada.
 *
 * Karena itu jawabannya diperiksa lebih dulu. Berkas sungguhan disimpan lewat
 * blob; jawaban galat ditampilkan sebagai kalimat.
 */
function TombolUnduh({
  documentKey,
  format,
  label,
}: {
  documentKey: string;
  format: "pdf" | "word";
  label: string;
}) {
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");

  const unduh = useCallback(async () => {
    setSibuk(true);
    setGalat("");
    try {
      const params = new URLSearchParams({ documentKey, format });
      const respons = await fetch(apiPath(`/api/aleta-ecourt/berkas?${params.toString()}`), {
        cache: "no-store",
      });

      const tipe = respons.headers.get("content-type") || "";
      if (!respons.ok || tipe.includes("application/json")) {
        const isi = await respons.json().catch(() => null);
        setGalat(
          pesanGalatPortal(isi, `HTTP ${respons.status}`).replace(/_/g, " ")
        );
        return;
      }

      const blob = await respons.blob();
      const alamat = URL.createObjectURL(blob);
      const tautan = document.createElement("a");
      tautan.href = alamat;

      // Nama berkas diambil dari jawaban server bila ada; kalau tidak, disusun
      // dari kunci dokumen supaya tetap dapat dibedakan di folder Downloads.
      const disposisi = respons.headers.get("content-disposition") || "";
      const cocok = disposisi.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
      tautan.download = cocok
        ? decodeURIComponent(cocok[1])
        : `${documentKey}.${format === "word" ? "docx" : "pdf"}`;

      document.body.appendChild(tautan);
      tautan.click();
      tautan.remove();

      // Alamat obyek TIDAK dilepas seketika. Peramban masih membaca blobnya
      // setelah klik selesai diproses, dan melepasnya di baris yang sama
      // membatalkan sebagian unduhan tanpa pesan apa pun.
      window.setTimeout(() => URL.revokeObjectURL(alamat), 60000);
    } catch (error) {
      setGalat(error instanceof Error ? error.message : "Gagal mengunduh.");
    } finally {
      setSibuk(false);
    }
  }, [documentKey, format]);

  return (
    <span className="inline-flex flex-col gap-1">
      <Button variant="outline" size="sm" disabled={sibuk} onClick={() => void unduh()}>
        {sibuk ? "…" : label}
      </Button>
      {galat ? <span className="text-xs text-rose-600 dark:text-rose-400">{galat}</span> : null}
    </span>
  );
}
