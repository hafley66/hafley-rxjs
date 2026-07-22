use std::sync::atomic::AtomicUsize;

pub type ResultId = String;

#[allow(non_snake_case)]
pub struct DelayedRequest {
    pub id: ResultId,
    pub delayTicks: i32,
}

pub enum RequestEvents {
    Request { value: DelayedRequest },
}

pub struct ResultIdMetrics {
    pub active: AtomicUsize,
    pub cancellations: AtomicUsize,
}
