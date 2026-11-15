import { configureStore } from "@reduxjs/toolkit";
import authenticationReducer from "./slices/authentication-slice.js";
import uiPreferencesReducer from "./slices/ui-preferences-slice.js";
import { dataScopeApi } from "./services/data-scope-api.js";

export function makeStore() {
  return configureStore({
    reducer: {
      authentication: authenticationReducer,
      uiPreferences: uiPreferencesReducer,
      [dataScopeApi.reducerPath]: dataScopeApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(dataScopeApi.middleware),
  });
}
