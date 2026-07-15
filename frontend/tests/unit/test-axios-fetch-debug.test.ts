import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest"
import axios from "axios"
import { setupServer } from "msw/node"
import { http, HttpResponse } from "msw"

const server = setupServer(
  http.get("http://localhost:5117/api/test", () => HttpResponse.json({ ok: true }))
)

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }))
afterAll(() => server.close())
afterEach(() => server.resetHandlers())

describe("axios fetch adapter debug", () => {
  it("logs Request/fetch state", async () => {
    console.log("globalThis.Request name:", globalThis.Request?.name)
    console.log("globalThis.Request desc:", JSON.stringify(Object.getOwnPropertyDescriptor(globalThis, "Request")))
    console.log("globalThis.fetch name:", globalThis.fetch?.name)
    console.log("globalThis.fetch toString:", globalThis.fetch?.toString().slice(0, 100))
    const client = axios.create({ baseURL: "http://localhost:5117", adapter: "fetch" })
    try {
      const res = await client.get("/api/test")
      console.log("res:", res.status, res.data)
      expect(res.status).toBe(200)
    } catch (e) {
      const err = e as Error & { code?: string }
      console.log("err message:", err.message)
      console.log("err code:", err.code)
      throw e
    }
  })
})
