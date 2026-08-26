import type { UserPersona } from "@/lib/types";
import {
  hasEStatusPermission,
  resolveEStatusAccess,
  type EStatusPermission,
} from "@/lib/e-status-types";
import { getEffectiveRoleId } from "@/lib/permissions";
import { estatusForbidden } from "@/server/modules/e-status/estatus-service-errors";

export function getEStatusAccessForActor(actor: UserPersona) {
  return resolveEStatusAccess(actor, {
    effectiveRoleId: getEffectiveRoleId(actor),
  });
}

export function canActorUseEStatusPermission(actor: UserPersona, permission: EStatusPermission) {
  return hasEStatusPermission(getEStatusAccessForActor(actor), permission);
}

export function requireEStatusPermission(actor: UserPersona, permission: EStatusPermission) {
  const access = getEStatusAccessForActor(actor);

  if (!hasEStatusPermission(access, permission)) {
    estatusForbidden();
  }

  return access;
}

export function requireAnyEStatusPermission(actor: UserPersona, permissions: EStatusPermission[]) {
  const access = getEStatusAccessForActor(actor);

  if (!permissions.some((permission) => hasEStatusPermission(access, permission))) {
    estatusForbidden();
  }

  return access;
}
