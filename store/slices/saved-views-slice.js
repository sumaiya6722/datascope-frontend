import { createSlice } from "@reduxjs/toolkit";

const savedViewsSlice = createSlice({
  name: "savedViews",
  initialState: {
    selectedViewId: null,
    isSaveDialogOpen: false,
  },
  reducers: {
    setSelectedViewId(state, action) {
      state.selectedViewId = action.payload;
    },
    setSaveDialogOpen(state, action) {
      state.isSaveDialogOpen = action.payload;
    },
  },
});

export const { setSelectedViewId, setSaveDialogOpen } = savedViewsSlice.actions;
export default savedViewsSlice.reducer;
