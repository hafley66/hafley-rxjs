pub mod activate;
pub mod models;

use axum::Router;
use axum::routing::post;

pub fn router() -> Router {
  Router::new()
  .route("/activate", post(activate::activate))
}
