// app/services/api/__tests__/scheduleApi.test.ts
import { EnhancedStore } from "@reduxjs/toolkit"
import { orgApi, clientApi, scheduleApi } from "../"
import { store as appStore, RootState } from "../../../store/store"
import { newSchedule } from "../../../../test/fixtures/schedule.fixture"
import { newCaregiver } from "../../../../test/fixtures/caregiver.fixture"
import { registerNewOrgAndCaregiver, createClientInOrg } from "../../../../test/helpers"
import { Org, Schedule, Client } from "../api.types"

describe("scheduleApi", () => {
  let store: EnhancedStore<RootState>
  let client: Client
  let schedule: Schedule
  let org: Org
  let orgId: string
  let clientId: string
  let scheduleId: string

  beforeEach(async () => {
    store = appStore
    const testCaregiver = newCaregiver()
    const response = await registerNewOrgAndCaregiver(
      testCaregiver.name,
      testCaregiver.email,
      testCaregiver.password,
      testCaregiver.phone,
    )
    org = response.org
    orgId = response.org.id as string

    const result = await createClientInOrg(
      org,
      testCaregiver.email,
      testCaregiver.password,
    )
    client = result
    clientId = client.id as string

    const resultSchedule = await scheduleApi.endpoints.createSchedule.initiate({
      clientId,
      data: newSchedule(),
    })(store.dispatch, store.getState, {})
    if ("data" in resultSchedule && resultSchedule.data) {
      schedule = resultSchedule.data
    } else {
      throw new Error(`Create schedule failed with error: ${JSON.stringify(resultSchedule)}`)
    }
    scheduleId = schedule.id as string
  })

  afterEach(async () => {
    try {
      await orgApi.endpoints.deleteOrg.initiate({ orgId })(store.dispatch, store.getState, {})
    } catch (error) {
      // Ignore cleanup errors - org might already be deleted
    }
    // Drop RTK Query subscriptions / pending work so nothing fires after the hook finishes.
    // Avoid jest.clearAllTimers() here — it interacts badly with react-native/jest timer mocks.
    store.dispatch(scheduleApi.util.resetApiState())
    store.dispatch(clientApi.util.resetApiState())
    jest.clearAllMocks()
  })

  it("should create a schedule", async () => {
    const newSchedulePayload: Partial<Schedule> = {
      frequency: "weekly",
      intervals: [{ day: 3, weeks: 1 }],
      time: "10:00",
    }

    const result = await scheduleApi.endpoints.createSchedule.initiate({
      clientId,
      data: newSchedulePayload,
    })(store.dispatch, store.getState, {})

    if ("data" in result && result.data) {
      expect(result.data).toMatchObject({
        id: expect.any(String),
        frequency: newSchedulePayload.frequency,
        intervals: expect.arrayContaining([
          expect.objectContaining({
            day: 3,
            weeks: 1,
          }),
        ]),
        time: newSchedulePayload.time,
      })

      // Poll until backend lists the new schedule on the client (avoids fixed sleeps + stray timers)
      const deadline = Date.now() + 8000
      let resultClient: Awaited<
        ReturnType<ReturnType<typeof clientApi.endpoints.getClient.initiate>>
      >
      let foundOnClient = false
      do {
        resultClient = await clientApi.endpoints.getClient.initiate({ id: clientId })(
          store.dispatch,
          store.getState,
          {},
        )
        const schedules =
          "data" in resultClient && resultClient.data?.schedules
            ? resultClient.data.schedules
            : undefined
        foundOnClient = Boolean(
          schedules?.some(
            (s: Schedule) =>
              s.frequency === newSchedulePayload.frequency && s.time === newSchedulePayload.time,
          ),
        )
        if (foundOnClient) break
        await new Promise((r) => setTimeout(r, 100))
      } while (Date.now() < deadline)

      if (!foundOnClient || !("data" in resultClient) || !resultClient.data) {
        throw new Error(
          `Client never showed new schedule after create: ${JSON.stringify(
            "error" in resultClient ? resultClient.error : resultClient,
          )}`,
        )
      }

      // Client GET response must include schedules (backend getClientById populates schedules)
      expect(resultClient.data.schedules).toBeDefined()
      expect(Array.isArray(resultClient.data.schedules)).toBe(true)
      const createdSchedule = resultClient.data.schedules.find(
        (s: Schedule) => s.frequency === newSchedulePayload.frequency && s.time === newSchedulePayload.time,
      )
      expect(createdSchedule).toBeDefined()
      if (createdSchedule) {
        expect(createdSchedule).toMatchObject({
          id: expect.any(String),
          frequency: newSchedulePayload.frequency,
          intervals: expect.arrayContaining([
            expect.objectContaining({
              day: 3,
              weeks: 1,
            }),
          ]),
          time: newSchedulePayload.time,
        })
      }
    } else {
      throw new Error(`Create schedule failed with error: ${JSON.stringify(result)}`)
    }
  })

  it("should get a schedule", async () => {
    const result = await scheduleApi.endpoints.getSchedule.initiate({ scheduleId })(
      store.dispatch,
      store.getState,
      {},
    )

    if ("data" in result && result.data) {
      expect(result.data).toMatchObject({
        id: scheduleId,
        frequency: schedule.frequency,
        intervals: schedule.intervals,
        time: schedule.time,
      })
    } else {
      throw new Error(`Get schedule failed with error: ${JSON.stringify(result)}`)
    }
  })

  it("should update a schedule", async () => {
    const updatedSchedule: Partial<Schedule> = {
      frequency: "monthly",
      intervals: [{ day: 15 }],
      time: "14:00",
    }

    const result = await scheduleApi.endpoints.updateSchedule.initiate({
      scheduleId,
      data: updatedSchedule,
    })(store.dispatch, store.getState, {})

    if ("data" in result && result.data) {
      expect(result.data).toMatchObject({
        id: scheduleId,
        frequency: "monthly",
        intervals: expect.arrayContaining([
          expect.objectContaining({
            day: 15,
          }),
        ]),
        time: "14:00",
      })
    } else {
      throw new Error(`Update schedule failed with error: ${JSON.stringify(result)}`)
    }
  })

  it("should delete a schedule", async () => {
    const result = await scheduleApi.endpoints.deleteSchedule.initiate({ scheduleId })(
      store.dispatch,
      store.getState,
      {},
    )
    if ("data" in result) {
      expect(result.data).toBeNull()
    } else {
      throw new Error(`Delete schedule failed with error: ${JSON.stringify(result)}`)
    }
  })
})
