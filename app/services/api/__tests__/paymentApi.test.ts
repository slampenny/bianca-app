// app/services/api/__tests__/paymentApiWithFixtures.test.ts
import { EnhancedStore } from "@reduxjs/toolkit"
import { paymentApi, orgApi, conversationApi } from "../"
import { store as appStore, RootState } from "../../../store/store"
import { registerNewOrgAndCaregiver, createPatientInOrg } from "../../../../test/helpers"
import { newCaregiver } from "../../../../test/fixtures/caregiver.fixture"
import { newConversation } from "../../../../test/fixtures/conversation.fixture"
import { newInvoice } from "../../../../test/fixtures/invoice.fixture"
import { Org, Invoice } from "../api.types"

describe("paymentApi", () => {
  let store: EnhancedStore<RootState>
  let org: Org
  let orgId: string
  let patient: any
  let patientId: string

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
    orgId = org.id as string
    console.log(`caregiver role: ${response.caregiver.role}`)
    const patientResponse = await createPatientInOrg(
      org,
      testCaregiver.email,
      testCaregiver.password,
    )
    if ("error" in patientResponse) {
      throw new Error(`Create patient failed with error: ${JSON.stringify(patientResponse.error)}`)
    } else {
      patient = patientResponse
      patientId = patient.id as string
    }

    // Create a conversation for the patient using the conversation fixture.
    const conversationPayload = newConversation(patientId)
    // Note: conversationApi expects an object with patientId and data properties.
    const convResult = await conversationApi.endpoints.createConversation.initiate({
      patientId,
      data: conversationPayload,
    })(store.dispatch, store.getState, {})
    if ("error" in convResult) {
      throw new Error(`Create conversation failed with error: ${JSON.stringify(convResult.error)}`)
    }
  })

  afterEach(async () => {
    await orgApi.endpoints.deleteOrg.initiate({ orgId })(store.dispatch, store.getState, {})
    jest.clearAllMocks()
  })

  it("should get all invoices for a patient", async () => {
    const invoicePayload = newInvoice("pending", 150, "Patient invoice test")
    await paymentApi.endpoints.createInvoiceFromConversations.initiate({
      patientId,
      payload: invoicePayload,
    })(store.dispatch, store.getState, {})

    const queryParams = { patientId, status: "pending" }
    const result = await paymentApi.endpoints.getInvoicesByPatient.initiate(queryParams)(
      store.dispatch,
      store.getState,
      {},
    )

    if ("error" in result) {
      throw new Error(`Get invoices by patient failed with error: ${JSON.stringify(result.error)}`)
    } else {
      const invoices = result.data as Invoice[] // Explicit cast to Invoice[]
      expect(invoices.some((invoice: Invoice) => invoice.status === "pending")).toBe(true)
    }
  })

  it("should get all invoices for an organization", async () => {
    const invoicePayload = newInvoice("pending", 200, "Org invoice test")
    await paymentApi.endpoints.createInvoiceFromConversations.initiate({
      patientId,
      payload: invoicePayload,
    })(store.dispatch, store.getState, {})

    const queryParams = { orgId, status: "pending" }
    const result = await paymentApi.endpoints.getInvoicesByOrg.initiate(queryParams)(
      store.dispatch,
      store.getState,
      {},
    )

    if ("error" in result) {
      throw new Error(`Get invoices by org failed with error: ${JSON.stringify(result.error)}`)
    } else {
      const invoices = result.data as Invoice[]
      expect(invoices.some((invoice: Invoice) => invoice.status === "pending")).toBe(true)
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })
})
