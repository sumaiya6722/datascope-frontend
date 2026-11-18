import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import authenticationReducer from "./slices/authentication-slice.js";
import datasetReducer from "./slices/dataset-slice.js";
import savedViewsReducer from "./slices/saved-views-slice.js";
import searchConfigurationReducer from "./slices/search-configuration-slice.js";
import uiPreferencesReducer from "./slices/ui-preferences-slice.js";
import { dataScopeApi } from "./services/data-scope-api.js";

export function makeStore() {
  const store = configureStore({
    reducer: {
      authentication: authenticationReducer,
      dataset: datasetReducer,
      searchConfiguration: searchConfigurationReducer,
      savedViews: savedViewsReducer,
      uiPreferences: uiPreferencesReducer,
      [dataScopeApi.reducerPath]: dataScopeApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(dataScopeApi.middleware),
  });
  setupListeners(store.dispatch);
  return store;
}
