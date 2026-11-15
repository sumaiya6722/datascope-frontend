import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

export const dataScopeApi = createApi({
  reducerPath: "dataScopeApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${apiBaseUrl}/`,
    credentials: "include",
  }),
  tagTypes: [
    "Datasets",
    "DatasetRecords",
    "DatasetFields",
    "DatasetPermissions",
    "Analytics",
    "AdminAnalytics",
    "AdminUsers",
    "SavedViews",
    "SearchHistory",
    "CurrentUser",
  ],
  endpoints: (builder) => ({
    getDatasets: builder.query({
      query: () => "api/datasets",
      providesTags: (result) =>
        result
          ? [
              ...result.datasets.map(({ id }) => ({ type: "Datasets", id })),
              { type: "Datasets", id: "LIST" },
            ]
          : [{ type: "Datasets", id: "LIST" }],
    }),
    getDatasetRecords: builder.query({
      query: ({
        datasetId,
        page = 1,
        pageSize = 25,
        sort = [],
        fields = [],
        q = "",
        qMode = "partial",
        filters = [],
      }) => {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });
        for (const sortRule of sort) params.append("sort", sortRule);
        if (fields.length) params.set("fields", fields.join(","));
        if (q) {
          params.set("q", q);
          params.set("qMode", qMode);
        }
        if (filters.length) params.set("filters", JSON.stringify(filters));
        return `api/datasets/${encodeURIComponent(datasetId)}/records?${params}`;
      },
      providesTags: (_result, _error, { datasetId }) => [
        { type: "DatasetRecords", id: datasetId },
      ],
    }),
    getAnalytics: builder.query({
      query: () => "api/analytics",
      providesTags: ["Analytics"],
    }),
    exportDatasetCsv: builder.mutation({
      query: ({ datasetId, ...body }) => ({
        url: `api/datasets/${encodeURIComponent(datasetId)}/export/csv`,
        method: "POST",
        body,
        responseHandler: async (response) => {
          const contentType = response.headers.get("content-type") ?? "";
          return contentType.includes("application/json")
            ? response.json()
            : response.blob();
        },
      }),
    }),
    getDatasetRecord: builder.query({
      query: ({ datasetId, recordId }) =>
        `api/datasets/${encodeURIComponent(datasetId)}/records/${encodeURIComponent(recordId)}`,
      providesTags: (_result, _error, { datasetId, recordId }) => [
        { type: "DatasetRecords", id: `${datasetId}-${recordId}` },
      ],
    }),
    getSavedViews: builder.query({
      query: (datasetId) =>
        `api/saved-views${datasetId ? `?datasetId=${encodeURIComponent(datasetId)}` : ""}`,
      providesTags: (result, _error, datasetId) => [
        ...(result?.views ?? []).map(({ id }) => ({ type: "SavedViews", id })),
        { type: "SavedViews", id: `LIST-${datasetId ?? "ALL"}` },
      ],
    }),
    createSavedView: builder.mutation({
      query: (view) => ({
        url: "api/saved-views",
        method: "POST",
        body: view,
      }),
      invalidatesTags: [{ type: "SavedViews" }],
    }),
    updateSavedView: builder.mutation({
      query: ({ viewId, ...updates }) => ({
        url: `api/saved-views/${encodeURIComponent(viewId)}`,
        method: "PATCH",
        body: updates,
      }),
      invalidatesTags: [{ type: "SavedViews" }],
    }),
    deleteSavedView: builder.mutation({
      query: (viewId) => ({
        url: `api/saved-views/${encodeURIComponent(viewId)}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "SavedViews" }],
    }),
    getSearchHistory: builder.query({
      query: (datasetId) =>
        `api/search-history${datasetId ? `?datasetId=${encodeURIComponent(datasetId)}` : ""}`,
      providesTags: (result, _error, datasetId) => [
        ...(result?.history ?? []).map(({ id }) => ({ type: "SearchHistory", id })),
        { type: "SearchHistory", id: `LIST-${datasetId ?? "ALL"}` },
      ],
    }),
    createSearchHistory: builder.mutation({
      query: (search) => ({
        url: "api/search-history",
        method: "POST",
        body: search,
      }),
      invalidatesTags: [{ type: "SearchHistory" }],
    }),
    getDataset: builder.query({
      query: (datasetId) => `api/datasets/${encodeURIComponent(datasetId)}`,
      providesTags: (_result, _error, datasetId) => [
        { type: "Datasets", id: datasetId },
      ],
    }),
    createDataset: builder.mutation({
      query: (dataset) => ({
        url: "api/datasets",
        method: "POST",
        body: dataset,
      }),
      invalidatesTags: [{ type: "Datasets", id: "LIST" }],
    }),
    updateDataset: builder.mutation({
      query: ({ datasetId, ...updates }) => ({
        url: `api/datasets/${encodeURIComponent(datasetId)}`,
        method: "PATCH",
        body: updates,
      }),
      invalidatesTags: (_result, _error, { datasetId }) => [
        { type: "Datasets", id: datasetId },
        { type: "Datasets", id: "LIST" },
      ],
    }),
    deleteDataset: builder.mutation({
      query: (datasetId) => ({
        url: `api/datasets/${encodeURIComponent(datasetId)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, datasetId) => [
        { type: "Datasets", id: datasetId },
        { type: "Datasets", id: "LIST" },
        { type: "DatasetRecords", id: datasetId },
        { type: "DatasetFields", id: datasetId },
        { type: "DatasetPermissions", id: datasetId },
      ],
    }),
    getDatasetFields: builder.query({
      query: (datasetId) => `api/datasets/${encodeURIComponent(datasetId)}/fields`,
      providesTags: (result, _error, datasetId) => [
        ...(result?.fields ?? []).map(({ id }) => ({
          type: "DatasetFields",
          id,
        })),
        { type: "DatasetFields", id: `LIST-${datasetId}` },
      ],
    }),
    createDatasetField: builder.mutation({
      query: ({ datasetId, ...field }) => ({
        url: `api/datasets/${encodeURIComponent(datasetId)}/fields`,
        method: "POST",
        body: field,
      }),
      invalidatesTags: (_result, _error, { datasetId }) => [
        { type: "DatasetFields", id: `LIST-${datasetId}` },
        { type: "Datasets", id: datasetId },
      ],
    }),
    updateDatasetField: builder.mutation({
      query: ({ datasetId, fieldId, ...updates }) => ({
        url: `api/datasets/${encodeURIComponent(datasetId)}/fields/${encodeURIComponent(fieldId)}`,
        method: "PATCH",
        body: updates,
      }),
      invalidatesTags: (_result, _error, { datasetId, fieldId }) => [
        { type: "DatasetFields", id: fieldId },
        { type: "DatasetFields", id: `LIST-${datasetId}` },
        { type: "Datasets", id: datasetId },
      ],
    }),
    deleteDatasetField: builder.mutation({
      query: ({ datasetId, fieldId }) => ({
        url: `api/datasets/${encodeURIComponent(datasetId)}/fields/${encodeURIComponent(fieldId)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { datasetId, fieldId }) => [
        { type: "DatasetFields", id: fieldId },
        { type: "DatasetFields", id: `LIST-${datasetId}` },
        { type: "Datasets", id: datasetId },
      ],
    }),
    getDatasetPermissions: builder.query({
      query: (datasetId) => `api/admin/datasets/${encodeURIComponent(datasetId)}/permissions`,
      providesTags: (result, _error, datasetId) => [
        ...(result?.permissions ?? []).map(({ userId }) => ({
          type: "DatasetPermissions",
          id: userId,
        })),
        { type: "DatasetPermissions", id: `LIST-${datasetId}` },
      ],
    }),
    setDatasetPermission: builder.mutation({
      query: ({ datasetId, userId, permissions }) => ({
        url: `api/admin/datasets/${encodeURIComponent(datasetId)}/permissions/${encodeURIComponent(userId)}`,
        method: "PUT",
        body: { permissions },
      }),
      invalidatesTags: (_result, _error, { datasetId, userId }) => [
        { type: "DatasetPermissions", id: userId },
        { type: "DatasetPermissions", id: `LIST-${datasetId}` },
        { type: "Datasets", id: "LIST" },
      ],
    }),
    revokeDatasetPermission: builder.mutation({
      query: ({ datasetId, userId }) => ({
        url: `api/admin/datasets/${encodeURIComponent(datasetId)}/permissions/${encodeURIComponent(userId)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { datasetId, userId }) => [
        { type: "DatasetPermissions", id: userId },
        { type: "DatasetPermissions", id: `LIST-${datasetId}` },
        { type: "Datasets", id: "LIST" },
      ],
    }),
    getAdminAnalytics: builder.query({
      query: () => "api/admin/analytics",
      providesTags: ["AdminAnalytics"],
    }),
    getAdminUsers: builder.query({
      query: () => "api/admin/users",
      providesTags: (result) =>
        result
          ? [
              ...result.users.map(({ id }) => ({ type: "AdminUsers", id })),
              { type: "AdminUsers", id: "LIST" },
            ]
          : [{ type: "AdminUsers", id: "LIST" }],
    }),
    getCurrentUser: builder.query({
      query: () => "api/me",
      providesTags: ["CurrentUser"],
    }),
    updateUserRole: builder.mutation({
      query: ({ userId, role }) => ({
        url: `api/admin/users/${encodeURIComponent(userId)}/role`,
        method: "PATCH",
        body: { role },
      }),
      invalidatesTags: (_result, _error, { userId }) => [
        { type: "AdminUsers", id: userId },
        { type: "AdminUsers", id: "LIST" },
        "CurrentUser",
      ],
    }),
  }),
});

export const {
  useGetDatasetsQuery,
  useGetDatasetRecordsQuery,
  useGetAnalyticsQuery,
  useExportDatasetCsvMutation,
  useGetDatasetRecordQuery,
  useGetSavedViewsQuery,
  useCreateSavedViewMutation,
  useUpdateSavedViewMutation,
  useDeleteSavedViewMutation,
  useGetSearchHistoryQuery,
  useCreateSearchHistoryMutation,
  useGetDatasetQuery,
  useCreateDatasetMutation,
  useUpdateDatasetMutation,
  useDeleteDatasetMutation,
  useGetDatasetFieldsQuery,
  useCreateDatasetFieldMutation,
  useUpdateDatasetFieldMutation,
  useDeleteDatasetFieldMutation,
  useGetDatasetPermissionsQuery,
  useSetDatasetPermissionMutation,
  useRevokeDatasetPermissionMutation,
  useGetAdminAnalyticsQuery,
  useGetAdminUsersQuery,
  useUpdateUserRoleMutation,
  useGetCurrentUserQuery,
} = dataScopeApi;
