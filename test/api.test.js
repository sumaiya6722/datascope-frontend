import assert from "node:assert/strict";
import { test } from "node:test";
import { dataScopeApi } from "../store/services/data-scope-api.js";
import { makeStore } from "../store/make-store.js";
import { hasPermission } from "../lib/permissions.js";

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

test("the Redux store registers each required global client-state slice", () => {
  const store = makeStore();
  assert.deepEqual(
    Object.keys(store.getState()).sort(),
    ["authentication", "dataScopeApi", "dataset", "savedViews", "searchConfiguration", "uiPreferences"].sort(),
  );
});

test("permission checks use the permissions supplied by the authenticated backend user", () => {
  assert.ok(hasPermission(["dataset:read", "dataset:records:read"], "dataset:read"));
  assert.ok(!hasPermission(["dataset:read"], "dataset:export"));
  assert.ok(!hasPermission("administrator", "user:manage"));
});
