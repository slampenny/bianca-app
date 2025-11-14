// app/services/api/telemetryApi.ts
// RTK Query API for telemetry

import { createApi } from "@reduxjs/toolkit/query/react";
import baseQueryWithReauth from "./baseQueryWithAuth";

export const telemetryApi = createApi({
  reducerPath: "telemetryApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["Telemetry"],
  endpoints: (builder) => ({
    // Update telemetry opt-in status
    updateTelemetryOptIn: builder.mutation<
      { success: boolean; optIn: boolean },
      { optIn: boolean }
    >({
      query: ({ optIn }) => ({
        url: "/telemetry/opt-in",
        method: "POST",
        body: { optIn },
      }),
    }),
  }),
});

export const { useUpdateTelemetryOptInMutation } = telemetryApi;


