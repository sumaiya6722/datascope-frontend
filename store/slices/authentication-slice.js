import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  user: null,
  status: "unknown",
};

const authenticationSlice = createSlice({
  name: "authentication",
  initialState,
  reducers: {
    setSafeUser(state, action) {
      state.user = action.payload;
      state.status = "authenticated";
    },
    clearSafeUser(state) {
      state.user = null;
      state.status = "unauthenticated";
    },
  },
});

export const { setSafeUser, clearSafeUser } = authenticationSlice.actions;
export default authenticationSlice.reducer;
