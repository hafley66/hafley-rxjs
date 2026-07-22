pub mod models;

#[path = "2_pipeline.auto.rs"]
pub mod pipeline;

#[cfg(test)]
mod tests {
    use futures::{pin_mut, StreamExt};
    use serde::Deserialize;
    use tokio::sync::mpsc;
    use tokio_stream::wrappers::ReceiverStream;

    use crate::models::{UsageSnapshot, UsageUpdate};
    use crate::pipeline::usage_state;

    #[derive(Deserialize)]
    #[serde(tag = "source", rename_all = "camelCase")]
    enum TimelineEvent {
        Snapshot { value: UsageSnapshot },
        Update { value: UsageUpdate },
    }

    #[derive(Deserialize)]
    struct Timeline {
        events: Vec<TimelineEvent>,
        states: Vec<UsageSnapshot>,
    }

    #[tokio::test]
    async fn matches_the_canonical_cross_language_event_timeline() {
        let timeline: Timeline = serde_json::from_str(include_str!("../../4_timeline.json")).unwrap();
        let (snapshot_tx, snapshot_rx) = mpsc::channel(4);
        let (update_tx, update_rx) = mpsc::channel(4);
        let output = usage_state(ReceiverStream::new(snapshot_rx), ReceiverStream::new(update_rx));
        pin_mut!(output);

        for (event, state) in timeline.events.into_iter().zip(timeline.states) {
            match event {
                TimelineEvent::Snapshot { value } => snapshot_tx.send(value).await.unwrap(),
                TimelineEvent::Update { value } => update_tx.send(value).await.unwrap(),
            }
            assert_eq!(output.next().await, Some(state));
        }
    }
}
