#[path = "0_models.rs"]
pub mod models;

#[path = "1_pipeline.auto.rs"]
pub mod pipeline;

#[cfg(test)]
mod tests {
    use std::sync::{atomic::{AtomicUsize, Ordering}, Arc};
    use std::time::Duration;

    use futures::{pin_mut, StreamExt};
    use serde::Deserialize;
    use tokio::{sync::mpsc, task::yield_now, time::advance};
    use tokio_stream::wrappers::ReceiverStream;

    use crate::models::{DelayedRequest, ResultId, ResultIdMetrics};
    use crate::pipeline::latest_result;

    #[derive(Deserialize)]
    struct TimelineEvent {
        at: u64,
        value: TimelineRequest,
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct TimelineRequest {
        id: ResultId,
        delay_ticks: i32,
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Timeline {
        events: Vec<TimelineEvent>,
        settle_at: u64,
        states: Vec<ResultId>,
        cancellations: usize,
        active: usize,
    }

    #[tokio::test(start_paused = true)]
    async fn replaces_a_with_b_and_releases_its_task() {
        let timeline: Timeline = serde_json::from_str(include_str!("../../3_timeline.json")).unwrap();
        let (request_tx, request_rx) = mpsc::channel(2);
        let metrics = Arc::new(ResultIdMetrics { active: AtomicUsize::new(0), cancellations: AtomicUsize::new(0) });
        let output = latest_result(ReceiverStream::new(request_rx), metrics.clone());
        pin_mut!(output);

        request_tx.send(DelayedRequest { id: timeline.events[0].value.id.clone(), delayTicks: timeline.events[0].value.delay_ticks }).await.unwrap();
        let next = output.next();
        pin_mut!(next);
        tokio::select! { _ = &mut next => panic!("A completed before replacement"), _ = yield_now() => {} }

        advance(Duration::from_millis(timeline.events[1].at - timeline.events[0].at)).await;
        request_tx.send(DelayedRequest { id: timeline.events[1].value.id.clone(), delayTicks: timeline.events[1].value.delay_ticks }).await.unwrap();
        tokio::select! { _ = &mut next => panic!("B completed before its delay"), _ = yield_now() => {} }

        advance(Duration::from_millis(timeline.settle_at - timeline.events[1].at)).await;
        assert_eq!(next.await, Some(timeline.states[0].clone()));
        assert_eq!(metrics.cancellations.load(Ordering::SeqCst), timeline.cancellations);
        assert_eq!(metrics.active.load(Ordering::SeqCst), timeline.active);
    }
}
