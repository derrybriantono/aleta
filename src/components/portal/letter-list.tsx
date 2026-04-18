import Link from "next/link";
import { ArrowRight, FileStack, ShieldAlert, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, statusVariant } from "@/components/portal/shared";
import { WhatsAppStatusStack } from "@/components/portal/whatsapp-status";
import { formatDate } from "@/lib/format";
import { type LetterDetail } from "@/lib/types";

export function LetterList({
  letters,
  title,
  onDelete,
  deleteLabel,
  onRetryWhatsapp,
}: {
  letters: LetterDetail[];
  title: string;
  onDelete?: (letter: LetterDetail) => void;
  deleteLabel?: string;
  onRetryWhatsapp?: (letter: LetterDetail, deliveryId: string) => void;
}) {
  if (letters.length === 0) {
    return (
      <EmptyState
        title={`Belum ada ${title.toLowerCase()} yang sesuai filter`}
        description="Coba ubah kata kunci, status, atau gunakan akun demo lain untuk melihat data yang berbeda."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="hidden overflow-hidden rounded-[1.55rem] border border-border/95 bg-card shadow-panel lg:block">
        <table className="w-full table-fixed divide-y divide-border text-left text-sm">
          <thead className="bg-muted/58 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="w-[29%] px-5 py-3 font-semibold">Surat</th>
              <th className="w-[17%] px-5 py-3 font-semibold">Pengirim</th>
              <th className="w-[14%] px-5 py-3 font-semibold">Unit</th>
              <th className="w-[13%] px-5 py-3 font-semibold">Status</th>
              <th className="w-[17%] px-5 py-3 font-semibold">Status WhatsApp</th>
              <th className="w-[10%] px-5 py-3 font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {letters.map((letter) => (
              <tr key={letter.id} className="align-top transition hover:bg-muted/35">
                <td className="px-5 py-4">
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">{letter.perihal}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{letter.nomorSurat}</p>
                    {letter.nomorUrut ? (
                      <p className="text-xs text-muted-foreground">No. urut {letter.nomorUrut}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {letter.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[11px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <p className="font-medium text-foreground">{letter.pengirim}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(letter.tanggal)}</p>
                </td>
                <td className="px-5 py-4 text-foreground">{letter.assignedUnit}</td>
                <td className="px-5 py-4">
                  <div className="space-y-2">
                    <Badge variant={statusVariant(letter.status)}>{letter.status}</Badge>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {letter.confidentiality === "Rahasia" ? <ShieldAlert className="h-3.5 w-3.5" /> : <FileStack className="h-3.5 w-3.5" />}
                      {letter.confidentiality}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 align-top">
                  <WhatsAppStatusStack
                    deliveries={letter.whatsappDeliveries}
                    compact
                    onRetry={(deliveryId) => onRetryWhatsapp?.(letter, deliveryId)}
                  />
                </td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/surat/${letter.id}`}>
                        Detail
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    {onDelete ? (
                      <Button variant="destructive" size="sm" onClick={() => onDelete(letter)}>
                        <Trash2 className="h-4 w-4" />
                        {deleteLabel ?? "Hapus"}
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:hidden">
        {letters.map((letter) => (
          <Card key={letter.id} className="border-border/90 shadow-panel">
            <CardContent className="space-y-4 p-5">
              <div className="space-y-2">
                <p className="font-semibold text-foreground">{letter.perihal}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{letter.nomorSurat}</p>
                {letter.nomorUrut ? (
                  <p className="text-xs text-muted-foreground">No. urut {letter.nomorUrut}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={statusVariant(letter.status)}>{letter.status}</Badge>
                <Badge variant="outline">{letter.assignedUnit}</Badge>
                <Badge variant="outline">{letter.confidentiality}</Badge>
              </div>
              <div className="rounded-[1rem] border border-border/90 bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Status WhatsApp</p>
                <div className="mt-2">
                  <WhatsAppStatusStack
                    deliveries={letter.whatsappDeliveries}
                    onRetry={(deliveryId) => onRetryWhatsapp?.(letter, deliveryId)}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{letter.pengirim}</p>
              <div className="grid gap-3">
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/surat/${letter.id}`}>
                    Buka detail
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                {onDelete ? (
                  <Button variant="destructive" className="w-full" onClick={() => onDelete(letter)}>
                    <Trash2 className="h-4 w-4" />
                    {deleteLabel ?? "Hapus"}
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
