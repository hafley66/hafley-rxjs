use serde_json::Value;

pub struct LogicEvent {
    pub source: String,
    pub value: Value,
}
