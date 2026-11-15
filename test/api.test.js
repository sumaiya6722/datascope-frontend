import assert from "node:assert/strict";
import { test } from "node:test";
import { dataScopeApi } from "../store/services/data-scope-api.js";
import { getRolePermissions, hasPermission } from "../lib/permissions.js";

test("dataScopeApi registers all tagTypes used by endpoints including Analytics and CurrentUser", () => {
  assert.ok(dataScopeApi.endpoints.getAnalytics);
  assert.ok(dataScopeApi.endpoints.getAdminAnalytics);
  assert.ok(dataScopeApi.endpoints.getCurrentUser);
  assert.ok(dataScopeApi.endpoints.exportDatasetCsv);

  assert.equal(dataScopeApi.endpoints.getAnalytics.name, "getAnalytics");
  assert.equal(dataScopeApi.endpoints.getAdminAnalytics.name, "getAdminAnalytics");
  assert.equal(dataScopeApi.endpoints.getCurrentUser.name, "getCurrentUser");
  assert.equal(dataScopeApi.endpoints.exportDatasetCsv.name, "exportDatasetCsv");
});

test("permissions module returns non-empty permissions matching roles", () => {
  const viewerPerms = getRolePermissions("viewer");
  assert.ok(Array.isArray(viewerPerms) && viewerPerms.includes("dataset:read"));
  assert.ok(!viewerPerms.includes("dataset:export"));

  const analystPerms = getRolePermissions("dataAnalyst");
  assert.ok(analystPerms.includes("dataset:export"));
  assert.ok(!analystPerms.includes("user:manage"));

  const adminPerms = getRolePermissions("administrator");
  assert.ok(adminPerms.includes("user:manage"));
  assert.ok(hasPermission("administrator", "user:manage"));
  assert.ok(hasPermission("dataAnalyst", "dataset:export"));
  assert.ok(!hasPermission("viewer", "dataset:export"));
});
