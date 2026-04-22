import { describe, expect, it } from "vitest"
import type { ApiAlertRecord, Client } from "../../services/api/api.types"
import {
  apiRecordId,
  isAlertUnreadForCaregiver,
  mapApiAlertToFacilityAlert,
  mapClientToResident,
} from "../liveData"

function baseClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "507f1f77bcf86cd799439011",
    name: "Jane Q Public",
    email: "jane@example.com",
    phone: "+15551234567",
    org: "507f191e810c19729de860ea",
    caregivers: [],
    schedules: [{ frequency: "daily", intervals: [], time: "09:00", isActive: true }],
    ...overrides,
  }
}

describe("apiRecordId", () => {
  it("prefers id over _id", () => {
    expect(apiRecordId({ id: "a", _id: "b" })).toBe("a")
  })
  it("uses _id when id missing", () => {
    expect(apiRecordId({ _id: "xyz" })).toBe("xyz")
  })
})

describe("mapClientToResident", () => {
  it("maps name, room, move-in, and emergency contact from API fields", () => {
    const r = mapClientToResident(
      baseClient({
        firstName: "Jane",
        lastName: "Public",
        preferredName: "Jane",
        age: 82,
        room: "204A",
        moveInDate: "2024-01-15T00:00:00.000Z",
        emergencyContact: { name: "Bob", relationship: "Son", phone: "+15550001111" },
      }),
    )
    expect(r.firstName).toBe("Jane")
    expect(r.lastName).toBe("Public")
    expect(r.displayName).toBe("Jane Public")
    expect(r.room).toBe("204A")
    expect(r.moveInDate).toMatch(/Jan/)
    expect(r.emergencyContact).toEqual({
      name: "Bob",
      relationship: "Son",
      phone: "+15550001111",
    })
    expect(r.age).toBe(82)
  })

  it("uses dashes when optional fields are empty", () => {
    const r = mapClientToResident(baseClient({ room: "", emergencyContact: null }))
    expect(r.room).toBe("—")
    expect(r.emergencyContact.name).toBe("—")
  })

  it("marks at_risk when latestOverallRiskScore is high", () => {
    const r = mapClientToResident(baseClient({ latestOverallRiskScore: 70 }))
    expect(r.status).toBe("at_risk")
    expect(r.riskLevel).toBe("medium")
  })
})

describe("mapApiAlertToFacilityAlert", () => {
  const names = new Map([["client-1", "Pat Client"]])

  it("maps unread alert for caregiver", () => {
    const a: ApiAlertRecord = {
      id: "alert-1",
      message: "Test message",
      importance: "high",
      alertType: "client",
      relatedClient: "client-1",
      readBy: [],
      createdAt: "2026-03-27T10:00:00.000Z",
    }
    const u = mapApiAlertToFacilityAlert(a, names, "cg-1")
    expect(u.id).toBe("alert-1")
    expect(u.residentName).toBe("Pat Client")
    expect(u.status).toBe("new")
    expect(u.confidence).toBe(85)
    expect(u.summary).toBe("Test message")
  })

  it("maps acknowledged when caregiver id is in readBy", () => {
    const a: ApiAlertRecord = {
      message: "x",
      importance: "low",
      alertType: "system",
      readBy: ["cg-1"],
      createdAt: "2026-03-27T10:00:00.000Z",
    }
    const u = mapApiAlertToFacilityAlert(a, names, "cg-1")
    expect(u.status).toBe("acknowledged")
  })
})

describe("isAlertUnreadForCaregiver", () => {
  it("returns true when caregiverId is undefined", () => {
    expect(isAlertUnreadForCaregiver({ readBy: [] }, undefined)).toBe(true)
  })
  it("returns false when caregiver has read", () => {
    expect(isAlertUnreadForCaregiver({ readBy: ["a"] }, "a")).toBe(false)
  })
})
