// Backend session data is authoritative for permissions. Keeping only this
// predicate on the client avoids a second role-to-permission policy table.
export function hasPermission(permissions, permission) {
  return Array.isArray(permissions) && permissions.includes(permission);
}
