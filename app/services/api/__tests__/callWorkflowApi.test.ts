// app/services/api/__tests__/callWorkflowApi.test.ts

import { callWorkflowApi } from "../callWorkflowApi"

describe("callWorkflowApi", () => {
  it("should have the correct reducer path", () => {
    expect(callWorkflowApi.reducerPath).toBe("callWorkflowApi")
  })

  it("should have all required endpoints", () => {
    const endpoints = Object.keys(callWorkflowApi.endpoints)
    expect(endpoints).toContain("initiateCall")
    expect(endpoints).toContain("getCallStatus")
    expect(endpoints).toContain("updateCallStatus")
    expect(endpoints).toContain("endCall")
    expect(endpoints).toContain("getActiveCalls")
    expect(endpoints).toContain("getConversationWithCallDetails")
  })

  it("should export RTK Query hooks", () => {
    // These should be available as named exports
    expect(callWorkflowApi).toBeDefined()
    expect(typeof callWorkflowApi.reducer).toBe("function")
    expect(typeof callWorkflowApi.middleware).toBe("function")
  })

  it("should have proper endpoint configurations", () => {
    const initiateCallEndpoint = callWorkflowApi.endpoints.initiateCall
    expect(initiateCallEndpoint).toBeDefined()
    
    const getCallStatusEndpoint = callWorkflowApi.endpoints.getCallStatus
    expect(getCallStatusEndpoint).toBeDefined()
  })
})
