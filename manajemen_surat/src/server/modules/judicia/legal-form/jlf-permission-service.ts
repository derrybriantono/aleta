import type { UserPersona } from "@/lib/types";
import {
  hasJudiciaLegalFormPermission,
  resolveJudiciaLegalFormAccess,
  type JudiciaLegalFormPermission,
} from "@/lib/judicia-legal-form-types";
import { getEffectiveRoleId, getUserPositionLabel } from "@/lib/permissions";
import { jlfForbidden } from "@/server/modules/judicia/legal-form/jlf-service-errors";

export function getJlfAccessForActor(actor: UserPersona) {
  return resolveJudiciaLegalFormAccess(actor, {
    effectiveRoleId: getEffectiveRoleId(actor),
    positionLabel: getUserPositionLabel(actor),
  });
}

export function canActorUseJlfPermission(actor: UserPersona, permission: JudiciaLegalFormPermission) {
  return hasJudiciaLegalFormPermission(getJlfAccessForActor(actor), permission);
}

export function requireJlfPermission(actor: UserPersona, permission: JudiciaLegalFormPermission) {
  const access = getJlfAccessForActor(actor);

  if (!hasJudiciaLegalFormPermission(access, permission)) {
    jlfForbidden();
  }

  return access;
}

export function requireAnyJlfPermission(actor: UserPersona, permissions: JudiciaLegalFormPermission[]) {
  const access = getJlfAccessForActor(actor);

  if (!permissions.some((permission) => hasJudiciaLegalFormPermission(access, permission))) {
    jlfForbidden();
  }

  return access;
}
