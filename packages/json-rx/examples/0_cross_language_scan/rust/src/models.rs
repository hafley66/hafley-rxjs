use serde::Deserialize;

#[derive(Clone, Debug, Default, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UsageSnapshot {
    pub five_hour: f64,
    pub seven_day: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageUpdate {
    pub five_hour: Option<f64>,
    pub seven_day: Option<f64>,
}

pub enum UsageEvent {
    Snapshot { value: UsageSnapshot },
    Update { value: UsageUpdate },
}

impl UsageSnapshot {
    pub fn apply(&mut self, update: UsageUpdate) {
        if let Some(value) = update.five_hour { self.five_hour = value; }
        if let Some(value) = update.seven_day { self.seven_day = value; }
    }
}
