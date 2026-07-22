import { describe, expect, test } from 'vitest'
import { decodeActivateRequest, decodeActivateResponse, encodeActivateRequest, encodeActivateResponse } from './2_frames.auto'
import fixture from './3_fixture.json'

describe('generated TypeSpec frame codecs', () => {
  test('round trip the canonical request and response frames', () => {
    const requestFrame = encodeActivateRequest(fixture.request)
    const responseFrame = encodeActivateResponse(fixture.response)

    expect({
      request: decodeActivateRequest(requestFrame),
      response: decodeActivateResponse(responseFrame),
    }).toMatchInlineSnapshot(`
      {
        "request": {
          "operation": "activate",
          "request_id": "req-42",
        },
        "response": {
          "accepted": true,
          "request_id": "req-42",
        },
      }
    `)
  })
})
