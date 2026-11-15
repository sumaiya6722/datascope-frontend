import { createSlice } from "@reduxjs/toolkit";

const uiPreferencesSlice = createSlice({
  name: "uiPreferences",
  initialState: {
    theme: "system",
    sidebarCollapsed: false,
    displayDensity: "comfortable",
  },
  reducers: {
    setTheme(state, action) {
      state.theme = action.payload;
    },
    setSidebarCollapsed(state, action) {
      state.sidebarCollapsed = action.payload;
    },
    setDisplayDensity(state, action) {
      state.displayDensity = action.payload;
    },
  },
});

export const {
  setTheme,
  setSidebarCollapsed,
  setDisplayDensity,
} = uiPreferencesSlice.actions;
export default uiPreferencesSlice.reducer;
