#[path = "0_models.rs"]
pub mod models;

#[path = "1_pipeline.auto.rs"]
pub mod pipeline;

#[path = "2_handwritten.rs"]
pub mod handwritten;

#[cfg(test)]
mod tests {
    use futures::{Stream, StreamExt, pin_mut};
    use serde::Deserialize;
    use tokio::sync::mpsc;
    use tokio_stream::wrappers::ReceiverStream;

    use crate::handwritten::running_total_handwritten;
    use crate::models::{NumberInput, Total};
    use crate::pipeline::running_total;

    #[derive(Deserialize)]
    struct TimelineEvent {
        value: NumberInput,
        state: Option<Total>,
    }

    #[derive(Deserialize)]
    struct Timeline {
        events: Vec<TimelineEvent>,
        states: Vec<Total>,
    }

    async fn states_for<P, S>(timeline: &Timeline, pipeline: P) -> Vec<Total>
    where
        P: FnOnce(ReceiverStream<NumberInput>) -> S,
        S: Stream<Item = Total>,
    {
        let (value_tx, value_rx) = mpsc::channel(4);
        let output = pipeline(ReceiverStream::new(value_rx));
        pin_mut!(output);
        let mut states = Vec::new();

        for event in &timeline.events {
            value_tx.send(event.value).await.unwrap();
            if let Some(state) = event.state {
                assert_eq!(output.next().await, Some(state));
                states.push(state);
            }
        }

        states
    }

    #[tokio::test]
    async fn generated_and_handwritten_pipelines_match_the_canonical_cross_language_event_timeline()
    {
        let timeline: Timeline =
            serde_json::from_str(include_str!("../../3_timeline.json")).unwrap();

        assert_eq!(states_for(&timeline, running_total).await, timeline.states);
        assert_eq!(
            states_for(&timeline, running_total_handwritten).await,
            timeline.states
        );
    }
}
