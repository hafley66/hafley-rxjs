namespace Examples.ProcessFrame;

model ActivateRequest {
  operation: string;
  request_id: string;
}

model ActivateResponse {
  request_id: string;
  accepted: boolean;
}
