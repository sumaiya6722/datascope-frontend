const rolePermissions = {
  administrator: [
    "user:manage",
    "dataset:read",
    "dataset:manage",
    "dataset:permissions:manage",
    "dataset:records:read",
    "dataset:search:basic",
    "dataset:search:advanced",
    "dataset:filters:basic",
    "dataset:filters:multiple",
    "view:manage:personal",
    "view:access:shared",
    "dataset:export",
    "dataset:analyze",
    "analytics:admin",
    "system:manage",
  ],
  dataAnalyst: [
    "dataset:read",
    "dataset:records:read",
    "dataset:search:basic",
    "dataset:search:advanced",
    "dataset:filters:basic",
    "dataset:filters:multiple",
    "view:manage:personal",
    "view:access:shared",
    "dataset:export",
    "dataset:analyze",
  ],
  viewer: [
    "dataset:read",
    "dataset:records:read",
    "dataset:search:basic",
    "dataset:filters:basic",
    "view:access:shared",
  ],
};

export function getRolePermissions(role) {
  return rolePermissions[role] ?? [];
}

export function hasPermission(role, permission) {
  return rolePermissions[role]?.includes(permission) ?? false;
}
