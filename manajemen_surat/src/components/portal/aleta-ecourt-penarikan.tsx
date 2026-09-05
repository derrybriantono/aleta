"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * Menarik berkas e-Court dan memantaunya, tanpa SSH.
 *
 * ============================================================================
 * PEMANTAUAN MENARIK LANJUTAN, BUKAN SELURUH BERKAS
 * ============================================================================
 *
 * Satu penarikan menyeluruh menghasilkan log puluhan megabita. Membacanya utuh
 * tiap beberapa detik akan mengirim ulang isi yang sama berkali-kali dan
 * membekukan peramban. Karena itu posisi baca terakhir disimpan, dan tiap
 * denyut hanya meminta bagian setelahnya - persis cara tail -f bekerja.
 *
 * ============================================================================
 * DENYUT BERHENTI SAAT LOGNYA BERHENTI
 * ============================================================================
 *
 * Selama log masih tumbuh, isinya diminta tiap tiga detik. Begitu berhenti
 * tumbuh, denyutnya melambat lalu berhenti sendiri. Terus meminta lanjutan dari
 * berkas yang sudah selesai hanya membebani server tanpa menghasilkan apa pun -
 * dan halaman yang tertinggal terbuka semalaman akan melakukannya ribuan kali.
 */

type RingkasanLog = {
  nama: string;
  ukuran: number;
  diubahPada: string;
  jenis: "unduh" | "tarik-ulang";
  masihTumbuh: boolean;
};

type Keadaan = {
  sedangJalan?: boolean;
  sumber?: string;
  berkasLog?: string;
  perkaraDiminta?: string;
  adaPenarikanLain?: boolean;
  terakhirCatatan?: string;
  terakhirSelesai?: string | null;
};

type Pantau = {
  pengaturan: { aktif: boolean; jedaMenit: number; jedaPeringatanJam: number };
  berlaku: boolean | null;
  terakhirDetak: string | null;
  terakhirHasil: string;
  jumlahDetak: number;
  jumlahDilewati: number;
  nomorAdminTerisi: boolean;
};

type HasilAudit = {
  diperiksa: number;
  utuh: number;
  bermasalah: number;
  dibuang: number;
  masalah: Array<{ nomorPerkara: string; format: string; alasan: string }>;
};

const DENYUT_AKTIF_MS = 3000;
const DENYUT_DIAM_MS = 15000;

function ukuranTerbaca(byte: number) {
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${(byte / 1024).toFixed(1)} KB`;
  return `${(byte / (1024 * 1024)).toFixed(1)} MB`;
}

function waktuTerbaca(iso: string) {
  const waktu = new Date(iso);
  if (Number.isNaN(waktu.getTime())) return iso;
  return waktu.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "medium" });
}

export function AletaEcourtPenarikan() {
  const [log, setLog] = useState<RingkasanLog[]>([]);
  const [keadaan, setKeadaan] = useState<Keadaan | null>(null);
  const [pesanKeadaan, setPesanKeadaan] = useState("");
  const [bolehMenarikSemua, setBolehMenarikSemua] = useState(false);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [pantau, setPantau] = useState<Pantau | null>(null);
  const [audit, setAudit] = useState<HasilAudit | null>(null);

  const [dipantau, setDipantau] = useState("");
  const [isiLog, setIsiLog] = useState("");
  const [masihTumbuh, setMasihTumbuh] = useState(false);

  // Posisi baca terakhir - di ref, bukan state: mengubahnya tidak perlu
  // menggambar ulang, dan menaruhnya di state membuat denyut saling mengejar.
  const posisi = useRef(0);
  const kotakLog = useRef<HTMLPreElement | null>(null);
  const ikutiBawah = useRef(true);

  const muatDaftar = useCallback(async () => {
    try {
      const jawaban = await fetch(apiPath("/api/aleta-ecourt/penarikan"), { cache: "no-store" });
      const isi = await jawaban.json();
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal membaca keadaan penarikan."));

      const data = isi?.data ?? isi;
      setLog(Array.isArray(data?.log) ? data.log : []);
      setKeadaan(data?.keadaan ?? null);
      setPesanKeadaan(String(data?.pesanKeadaan || ""));
      setBolehMenarikSemua(Boolean(data?.bolehMenarikSemua));
      setPantau(data?.pantau ?? null);
      setGalat("");
      return data;
    } catch (kesalahan) {
      setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal membaca keadaan penarikan.");
      return null;
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void muatDaftar();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [muatDaftar]);

  /** Membuka satu log untuk dipantau, dari potongan terakhirnya. */
  const mulaiPantau = useCallback((nama: string) => {
    posisi.current = -1;
    ikutiBawah.current = true;
    setIsiLog("");
    setDipantau(nama);
  }, []);

  // Denyut pemantauan.
  useEffect(() => {
    if (!dipantau) return;

    let hidup = true;
    let timer = 0;

    async function denyut() {
      if (!hidup) return;

      try {
        const params = new URLSearchParams({ log: dipantau, mulai: String(posisi.current) });
        const jawaban = await fetch(apiPath(`/api/aleta-ecourt/penarikan?${params.toString()}`), {
          cache: "no-store",
        });
        const isi = await jawaban.json();
        const potongan = (isi?.data ?? isi)?.potongan;

        if (potongan) {
          if (potongan.isi) {
            setIsiLog((lama) => {
              const gabung = lama + potongan.isi;
              // Menahan paling banyak sekitar 400 ribu huruf di layar. Log
              // penuh tetap utuh di server; yang dibatasi hanya yang ditahan
              // peramban, supaya halaman tidak melambat setelah berjam-jam.
              return gabung.length > 400000 ? gabung.slice(-400000) : gabung;
            });
          }
          posisi.current = potongan.akhir;
          setMasihTumbuh(Boolean(potongan.masihTumbuh));
        }
      } catch {
        // Satu denyut gagal bukan alasan berhenti memantau - jaringan sekejap
        // terputus adalah hal biasa, dan denyut berikutnya akan menyusul.
      }

      if (!hidup) return;
      timer = window.setTimeout(denyut, masihTumbuh ? DENYUT_AKTIF_MS : DENYUT_DIAM_MS);
    }

    void denyut();
    return () => {
      hidup = false;
      window.clearTimeout(timer);
    };
  }, [dipantau, masihTumbuh]);

  // Menggulung ke bawah hanya bila pembaca memang sedang di bawah. Menariknya
  // paksa saat ia sedang membaca ke atas membuat log tidak dapat dibaca.
  useEffect(() => {
    const kotak = kotakLog.current;
    if (!kotak || !ikutiBawah.current) return;
    kotak.scrollTop = kotak.scrollHeight;
  }, [isiLog]);

  const kirim = useCallback(
    async (tindakan: string, muatan: Record<string, unknown> = {}) => {
      setSibuk(true);
      setGalat("");
      setPesan("");
      try {
        const jawaban = await fetch(apiPath("/api/aleta-ecourt/penarikan"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tindakan, ...muatan }),
        });
        const isi = await jawaban.json();
        if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal memulai penarikan."));

        const data = isi?.data ?? isi;
        if (!data?.ok) {
          const sebab: Record<string, string> = {
            penarikan_sedang_berjalan: "Penarikan lain sedang berjalan. Tunggu selesai atau hentikan dulu.",
            penarikan_lain_masih_berjalan:
              "Ada penarikan lain yang berjalan di luar portal (kemungkinan dari SSH). Tunggu sampai selesai.",
            tidak_ada_penarikan: "Tidak ada penarikan yang sedang berjalan.",
            nomor_perkara_kosong: "Nomor perkara kosong.",
          };
          setGalat(sebab[String(data?.alasan)] || String(data?.message || data?.alasan || "Tidak berhasil."));
        } else {
          if (tindakan === "audit-arsip") {
            setAudit(data as HasilAudit);
            setPesan(
              `Diperiksa ${data.diperiksa} berkas: ${data.utuh} utuh, ${data.bermasalah} bermasalah` +
                (data.dibuang > 0 ? `, ${data.dibuang} dibuang untuk ditarik ulang.` : ".")
            );
          } else if (tindakan === "pantau-detak") {
            setPesan(
              data.dilewati
                ? `Detak dilewati: ${String(data.alasan || "").replace(/_/g, " ")}.`
                : data.berlaku === true
                  ? "Sesi e-Court masih hidup."
                  : data.berlaku === false
                    ? "Sesi e-Court sudah habis. Peringatan dikirim ke admin."
                    : `Belum dapat dipastikan: ${String(data.alasan || "").replace(/_/g, " ")}.`
            );
          } else if (tindakan === "pantau-simpan") {
            setPesan("Pengaturan pemantau sesi disimpan.");
          } else {
            setPesan(
              tindakan === "hentikan"
                ? "Penarikan dihentikan."
                : "Penarikan dimulai di latar belakang. Kemajuannya muncul di bawah."
            );
          }
          if (data?.berkasLog) mulaiPantau(String(data.berkasLog));
        }

        await muatDaftar();
      } catch (kesalahan) {
        setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal memulai penarikan.");
      } finally {
        setSibuk(false);
      }
    },
    [muatDaftar, mulaiPantau]
  );

  const sedangJalan = Boolean(keadaan?.sedangJalan);
  const adaPenarikanLain = Boolean(keadaan?.adaPenarikanLain);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Penarikan berkas e-Court</CardTitle>
        <CardDescription>
          Menarik berkas yang belum tersimpan langsung dari sini, tanpa SSH. Perkara yang berkasnya
          sudah lengkap dilewati - tidak diminta ulang ke e-Court.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {galat ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {galat}
          </p>
        ) : null}

        {pesan ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {pesan}
          </p>
        ) : null}

        {pesanKeadaan ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {pesanKeadaan}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {bolehMenarikSemua ? (
            <Button
              size="sm"
              disabled={sibuk || sedangJalan || adaPenarikanLain}
              onClick={() => void kirim("menyeluruh")}
            >
              Unduh semua berkas belum lengkap
            </Button>
          ) : null}

          {bolehMenarikSemua && sedangJalan ? (
            <Button
              size="sm"
              variant="outline"
              disabled={sibuk}
              onClick={() => void kirim("hentikan")}
            >
              Hentikan penarikan
            </Button>
          ) : null}

          <Button size="sm" variant="outline" disabled={sibuk} onClick={() => void muatDaftar()}>
            Perbarui keadaan
          </Button>

          {sedangJalan ? (
            <Badge variant="warning">
              Sedang menarik
              {keadaan?.perkaraDiminta ? ` - ${keadaan.perkaraDiminta}` : ""}
            </Badge>
          ) : adaPenarikanLain ? (
            <Badge variant="warning">Penarikan lain berjalan di luar portal</Badge>
          ) : (
            <Badge variant="muted">Tidak ada penarikan berjalan</Badge>
          )}
        </div>

        {!sedangJalan && keadaan?.terakhirCatatan ? (
          <p className="text-xs text-muted-foreground">
            Terakhir: {keadaan.terakhirCatatan}
            {keadaan.terakhirSelesai ? ` (${waktuTerbaca(keadaan.terakhirSelesai)})` : ""}
          </p>
        ) : null}

        {/* --- Pemantau sesi e-Court --- */}
        {bolehMenarikSemua && pantau ? (
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">Pemantau sesi e-Court</h4>
              {pantau.berlaku === true ? (
                <Badge variant="success">sesi hidup</Badge>
              ) : pantau.berlaku === false ? (
                <Badge variant="danger">sesi habis</Badge>
              ) : (
                <Badge variant="muted">belum dipastikan</Badge>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Mengunjungi e-Court secara berkala agar sesinya tidak mati karena menganggur, dan
              mengirim WhatsApp ke admin begitu sesinya benar-benar habis.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={pantau.pengaturan.aktif ? "outline" : "default"}
                disabled={sibuk}
                onClick={() =>
                  void kirim("pantau-simpan", {
                    aktif: !pantau.pengaturan.aktif,
                    jedaMenit: pantau.pengaturan.jedaMenit,
                    jedaPeringatanJam: pantau.pengaturan.jedaPeringatanJam,
                  })
                }
              >
                {pantau.pengaturan.aktif ? "Matikan pemantau" : "Nyalakan pemantau"}
              </Button>

              <Button size="sm" variant="outline" disabled={sibuk} onClick={() => void kirim("pantau-detak")}>
                Periksa sesi sekarang
              </Button>

              <span className="text-xs text-muted-foreground">
                Tiap {pantau.pengaturan.jedaMenit} menit
                {pantau.terakhirDetak ? ` · terakhir ${waktuTerbaca(pantau.terakhirDetak)}` : ""}
                {pantau.jumlahDetak > 0 ? ` · ${pantau.jumlahDetak} detak` : ""}
              </span>
            </div>

            {/* Peringatan tanpa tujuan bukan peringatan. Bila nomor admin belum
                diisi, pemantau tetap bekerja tetapi tidak ada yang diberi tahu. */}
            {!pantau.nomorAdminTerisi ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Nomor WhatsApp admin belum diatur, sehingga peringatan sesi habis tidak akan
                terkirim ke siapa pun. Isi di pengaturan ALETA Bot.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* --- Pemeriksaan keutuhan arsip --- */}
        {bolehMenarikSemua ? (
          <div className="space-y-2 rounded-md border p-3">
            <h4 className="text-sm font-semibold">Pemeriksaan keutuhan arsip</h4>
            <p className="text-xs text-muted-foreground">
              Mencocokkan catatan berkas dengan berkas di disk: masih ada, ukurannya sama, sidik
              jarinya cocok, dan isinya benar-benar PDF atau Word. Berjalan bergilir - tiap kali
              memeriksa berkas yang paling lama tidak diperiksa.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" disabled={sibuk} onClick={() => void kirim("audit-arsip", { batas: 200 })}>
                Periksa 200 berkas
              </Button>

              <Button
                size="sm"
                variant="outline"
                disabled={sibuk}
                onClick={() => {
                  // Membuang berkas rusak MENGHAPUS berkas dan catatannya.
                  // Perkaranya lalu ditarik ulang - tetapi itu keputusan yang
                  // pantas dikonfirmasi, bukan efek samping satu klik.
                  if (
                    !window.confirm(
                      "Buang berkas yang rusak? Catatan dan berkasnya dihapus, lalu perkaranya akan ditarik ulang dari e-Court pada penarikan berikutnya."
                    )
                  ) {
                    return;
                  }
                  void kirim("audit-arsip", { batas: 200, perbaiki: true });
                }}
              >
                Periksa dan buang yang rusak
              </Button>
            </div>

            {audit ? (
              <div className="space-y-1 text-xs">
                <p>
                  Diperiksa {audit.diperiksa} · utuh {audit.utuh} · bermasalah{" "}
                  <strong>{audit.bermasalah}</strong>
                  {audit.dibuang > 0 ? ` · dibuang ${audit.dibuang}` : ""}
                </p>
                {audit.masalah.length > 0 ? (
                  <ul className="max-h-40 space-y-0.5 overflow-auto rounded bg-muted/40 p-2">
                    {audit.masalah.map((baris, urutan) => (
                      <li key={`${baris.nomorPerkara}-${urutan}`}>
                        <span className="font-medium">{baris.nomorPerkara || "(tanpa nomor)"}</span>{" "}
                        <span className="text-muted-foreground">
                          ({baris.format}) {baris.alasan.replace(/_/g, " ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* --- Daftar log --- */}
        <div>
          <h4 className="mb-2 text-sm font-semibold">Riwayat penarikan</h4>
          {log.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada log penarikan. Log dari SSH maupun dari portal akan muncul di sini.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3 font-medium">Berkas log</th>
                    <th className="px-3 py-2 font-medium">Terakhir ditulis</th>
                    <th className="px-3 py-2 font-medium">Ukuran</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {log.map((baris) => (
                    <tr key={baris.nama} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        <code className="text-xs">{baris.nama}</code>
                        {baris.jenis === "tarik-ulang" ? (
                          <Badge variant="muted" className="ml-2 align-middle">
                            tarik ulang
                          </Badge>
                        ) : null}
                        {baris.masihTumbuh ? (
                          <Badge variant="warning" className="ml-2 align-middle">
                            berjalan
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {waktuTerbaca(baris.diubahPada)}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {ukuranTerbaca(baris.ukuran)}
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          size="sm"
                          variant={dipantau === baris.nama ? "default" : "outline"}
                          onClick={() => mulaiPantau(baris.nama)}
                        >
                          {dipantau === baris.nama ? "Dipantau" : "Pantau"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* --- Isi log, padanan tail -f --- */}
        {dipantau ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">
                Memantau <code className="text-xs">{dipantau}</code>
              </h4>
              <div className="flex items-center gap-2">
                {masihTumbuh ? (
                  <Badge variant="warning">masih berjalan</Badge>
                ) : (
                  <Badge variant="muted">berhenti</Badge>
                )}
                <Button size="sm" variant="outline" onClick={() => setDipantau("")}>
                  Tutup
                </Button>
              </div>
            </div>

            <pre
              ref={kotakLog}
              onScroll={(peristiwa) => {
                const kotak = peristiwa.currentTarget;
                // Selisih 40 piksel: pembaca yang hampir di bawah tetap
                // dianggap mengikuti, supaya gulungan tidak terasa lengket.
                ikutiBawah.current =
                  kotak.scrollHeight - kotak.scrollTop - kotak.clientHeight < 40;
              }}
              className="max-h-96 overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-relaxed text-slate-100"
            >
              {isiLog || "Menunggu isi log..."}
            </pre>

            <p className="text-xs text-muted-foreground">
              Halaman ini boleh ditutup - penarikan tetap berjalan di server. Padanan perintah{" "}
              <code>tail -f /var/www/html/aleta-data/reports/{dipantau}</code>
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
