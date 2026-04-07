import { describe, expect, it } from "vitest"
import { filterClientsToCaregiverRoster, shouldScopeClientsToCaregiverRoster } from "../caregiverClientFilter"
import type { Client, Caregiver } from "../../services/api/api.types"

function client(partial: Partial<Client> & { id: string }): Client {
  return {
    name: "Test",
    email: "",
    phone: "",
    org: "o1",
    caregivers: [],
    schedules: [],
    ...partial,
  }
}

describe("caregiverClientFilter", () => {
  it("scopes staff, orgAdmin, admin, and unverified", () => {
    expect(shouldScopeClientsToCaregiverRoster("staff")).toBe(true)
    expect(shouldScopeClientsToCaregiverRoster("orgAdmin")).toBe(true)
    expect(shouldScopeClientsToCaregiverRoster("admin")).toBe(true)
    expect(shouldScopeClientsToCaregiverRoster("unverified")).toBe(true)
    expect(shouldScopeClientsToCaregiverRoster("superAdmin")).toBe(false)
    expect(shouldScopeClientsToCaregiverRoster(undefined)).toBe(false)
  })

  it("returns all clients for superAdmin", () => {
    const clients = [client({ id: "a" }), client({ id: "b" })]
    const user: Pick<Caregiver, "id" | "role" | "clients"> = {
      id: "cg1",
      role: "superAdmin",
      clients: [],
    }
    expect(filterClientsToCaregiverRoster(clients, user)).toEqual(clients)
  })

  it("keeps clients on roster", () => {
    const clients = [client({ id: "a" }), client({ id: "b" })]
    const user: Pick<Caregiver, "id" | "role" | "clients"> = {
      id: "cg1",
      role: "staff",
      clients: ["b"],
    }
    expect(filterClientsToCaregiverRoster(clients, user).map((c) => c.id)).toEqual(["b"])
  })

  it("keeps clients that list the user as caregiver", () => {
    const clients = [client({ id: "a", caregivers: ["cg1"] }), client({ id: "b" })]
    const user: Pick<Caregiver, "id" | "role" | "clients"> = {
      id: "cg1",
      role: "orgAdmin",
      clients: [],
    }
    expect(filterClientsToCaregiverRoster(clients, user).map((c) => c.id)).toEqual(["a"])
  })
})
