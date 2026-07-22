include!("../generated/lib.rs");

#[cfg(test)]
mod tests {
    use super::models::{activate_request::ActivateRequest, activate_response::ActivateResponse};

    #[test]
    fn generated_serde_types_round_trip_the_canonical_frame_fixture() {
        let fixture: serde_json::Value =
            serde_json::from_str(include_str!("../../3_fixture.json")).unwrap();
        let request: ActivateRequest = serde_json::from_value(fixture["request"].clone()).unwrap();
        let response: ActivateResponse =
            serde_json::from_value(fixture["response"].clone()).unwrap();

        assert_eq!(serde_json::to_value(request).unwrap(), fixture["request"]);
        assert_eq!(serde_json::to_value(response).unwrap(), fixture["response"]);
        let _ = super::router();
    }
}
