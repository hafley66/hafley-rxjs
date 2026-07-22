use axum::Json;

use crate::models::activate_response::ActivateResponse;

// alloy-handler-start
pub async fn activate() -> Json<ActivateResponse> {
  Json(activate_impl().await)
}
// alloy-handler-end

pub async fn activate_impl() -> ActivateResponse {
  todo!()
}
