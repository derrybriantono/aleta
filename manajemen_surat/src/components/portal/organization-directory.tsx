"use client";

import { useMemo, useState } from "react";
import { Building2, ChevronRight, ShieldAlert } from "lucide-react";

import { buildOrganizationTree, getPositionById, type OrganizationTreeNode } from "@/core/organization/service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePortal } from "@/lib/app-state";
import { getUserRoleBadge } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export function OrganizationDirectory() {
  const { activeUsers: users } = usePortal();
  const tree = useMemo(() => buildOrganizationTree(users), [users]);
  const [selectedPositionId, setSelectedPositionId] = useState(tree[0]?.position.id ?? "");
  const selectedNode = useMemo(() => findNodeById(tree, selectedPositionId) ?? tree[0] ?? null, [selectedPositionId, tree]);

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Direktori Instansi
        </CardTitle>
        <CardDescription>
          Bagan organisasi interaktif ALETA. Klik jabatan untuk melihat pemegang definitif dan status PLH/PLT yang sedang aktif.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
        <div className="space-y-3 rounded-[1.5rem] border border-border bg-muted/30 p-4">
          {tree.map((node) => (
            <OrganizationBranch
              key={node.position.id}
              node={node}
              selectedPositionId={selectedNode?.position.id ?? ""}
              onSelect={setSelectedPositionId}
            />
          ))}
        </div>

        <div className="rounded-[1.5rem] border border-border bg-card/80 p-5">
          {!selectedNode ? (
            <div className="rounded-[1.2rem] border border-dashed border-border bg-muted/35 p-4 text-sm text-muted-foreground">
              Pilih salah satu jabatan pada bagan untuk melihat detailnya.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Level {selectedNode.position.levelHierarchy}</Badge>
                  {selectedNode.actingUsers.length > 0 ? <Badge variant="warning">PLH/PLT Aktif</Badge> : null}
                </div>
                <h3 className="font-serif text-2xl text-foreground">{selectedNode.position.name}</h3>
                <p className="text-sm leading-7 text-muted-foreground">{selectedNode.position.unitKerja}</p>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Pemegang Definitif</p>
                {selectedNode.definitiveUsers.length === 0 ? (
                  <EmptyDirectoryState text="Belum ada akun definitif pada posisi ini." />
                ) : (
                  selectedNode.definitiveUsers.map((user) => (
                    <div key={user.id} className="rounded-[1.2rem] border border-border bg-muted/35 p-4">
                      <p className="font-semibold text-foreground">{user.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{getUserRoleBadge(user)}</p>
                      {user.nip?.trim() ? <p className="mt-1 text-xs text-muted-foreground">NIP {user.nip}</p> : null}
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">PLH / PLT Aktif</p>
                {selectedNode.actingUsers.length === 0 ? (
                  <EmptyDirectoryState text="Belum ada penugasan PLH/PLT aktif pada jabatan ini." />
                ) : (
                  selectedNode.actingUsers.map((user) => (
                    <div key={user.id} className="rounded-[1.2rem] border border-amber-300/40 bg-amber-500/10 p-4">
                      <p className="font-semibold text-foreground">
                        {user.actingAssignment?.type} - {user.name}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Definitif: {getPositionById(user.positionId)?.name ?? user.positionId}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {user.actingAssignment?.type === "PLH"
                          ? `${user.actingAssignment.startDate?.slice(0, 10)} s.d. ${user.actingAssignment.endDate?.slice(0, 10)}`
                          : "Aktif sampai pejabat definitif tersedia"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function OrganizationBranch({
  node,
  selectedPositionId,
  onSelect,
  depth = 0,
}: {
  node: OrganizationTreeNode;
  selectedPositionId: string;
  onSelect: (positionId: string) => void;
  depth?: number;
}) {
  const isSelected = selectedPositionId === node.position.id;

  return (
    <div className={cn("space-y-3", depth > 0 && "border-l border-border/70 pl-4")}>
      <button
        type="button"
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-[1.2rem] border px-4 py-3 text-left transition",
          isSelected ? "border-primary/35 bg-primary/10" : "border-border bg-card hover:border-primary/25 hover:bg-primary/5"
        )}
        onClick={() => onSelect(node.position.id)}
      >
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{node.position.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{node.position.unitKerja}</p>
        </div>
        <div className="flex items-center gap-2">
          {node.actingUsers.length > 0 ? <Badge variant="warning">PLH/PLT</Badge> : null}
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </button>

      {node.children.length > 0 ? (
        <div className="space-y-3">
          {node.children.map((child) => (
            <OrganizationBranch
              key={child.position.id}
              node={child}
              selectedPositionId={selectedPositionId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function findNodeById(tree: OrganizationTreeNode[], positionId: string): OrganizationTreeNode | null {
  for (const node of tree) {
    if (node.position.id === positionId) return node;
    const child = findNodeById(node.children, positionId);
    if (child) return child;
  }

  return null;
}

function EmptyDirectoryState({ text }: { text: string }) {
  return (
    <div className="rounded-[1.2rem] border border-dashed border-border bg-muted/35 p-4 text-sm text-muted-foreground">
      <div className="flex items-center gap-2 text-primary">
        <ShieldAlert className="h-4 w-4" />
        <span>Belum ada data aktif</span>
      </div>
      <p className="mt-2">{text}</p>
    </div>
  );
}
