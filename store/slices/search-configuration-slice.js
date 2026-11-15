import { createSlice } from "@reduxjs/toolkit";

const searchConfigurationSlice = createSlice({
  name: "searchConfiguration",
  initialState: {
    draftQuery: "",
    filters: [],
    sort: { field: "", direction: "asc" },
  },
  reducers: {
    setDraftQuery(state, action) {
      state.draftQuery = action.payload;
    },
    setFilters(state, action) {
      state.filters = action.payload;
    },
    setSort(state, action) {
      state.sort = action.payload;
    },
    clearSearchConfiguration(state) {
      state.draftQuery = "";
      state.filters = [];
      state.sort = { field: "", direction: "asc" };
    },
  },
});

export const {
  setDraftQuery,
  setFilters,
  setSort,
  clearSearchConfiguration,
} = searchConfigurationSlice.actions;
export default searchConfigurationSlice.reducer;
