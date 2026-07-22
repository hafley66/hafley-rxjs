export interface ActivateRequest {
  operation: string
  request_id: string
}

export const encodeActivateRequest = (value: ActivateRequest): string => JSON.stringify(value)

export const decodeActivateRequest = (frame: string): ActivateRequest => JSON.parse(frame) as ActivateRequest

export interface ActivateResponse {
  request_id: string
  accepted: boolean
}

export const encodeActivateResponse = (value: ActivateResponse): string => JSON.stringify(value)

export const decodeActivateResponse = (frame: string): ActivateResponse => JSON.parse(frame) as ActivateResponse
