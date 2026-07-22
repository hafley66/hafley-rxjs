use serde::Deserialize;
use serde::Serialize;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivateRequest {
  pub operation: String,
  pub request_id: String,
}
