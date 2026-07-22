use serde::Deserialize;
use serde::Serialize;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivateResponse {
  pub request_id: String,
  pub accepted: bool,
}
