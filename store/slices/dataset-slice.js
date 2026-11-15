import { createSlice } from "@reduxjs/toolkit";

const datasetSlice = createSlice({
  name: "dataset",
  initialState: {
    selectedDatasetId: null,
    recordsPanelOpen: true,
  },
  reducers: {
    setSelectedDatasetId(state, action) {
      state.selectedDatasetId = action.payload;
    },
    clearSelectedDataset(state) {
      state.selectedDatasetId = null;
      state.recordsPanelOpen = false;
    },
    setRecordsPanelOpen(state, action) {
      state.recordsPanelOpen = action.payload;
    },
  },
});

export const {
  setSelectedDatasetId,
  clearSelectedDataset,
  setRecordsPanelOpen,
} = datasetSlice.actions;
export default datasetSlice.reducer;
