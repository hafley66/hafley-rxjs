#[path = "0_types.rs"]
pub mod types;

#[path = "1_pipeline.rs"]
pub mod pipeline;

#[cfg(test)]
mod tests {
    use futures::{pin_mut, StreamExt};
    use serde::Deserialize;
    use serde_json::Value;
    use tokio::sync::mpsc;
    use tokio_stream::wrappers::ReceiverStream;

    use crate::pipeline::logic;
    use crate::types::LogicEvent;

    #[derive(Deserialize)]
    struct TimelineEvent {
        source: String,
        value: Value,
        output: Option<i64>,
    }

    #[derive(Deserialize)]
    struct Timeline {
        logic: Value,
        events: Vec<TimelineEvent>,
        outputs: Vec<i64>,
    }

    #[tokio::test]
    async fn matches_the_shared_latest_value_timeline() {
        let timeline: Timeline = serde_json::from_str(include_str!("../../0_timeline.json")).unwrap();
        let (sender, receiver) = mpsc::channel(4);
        let output = logic(ReceiverStream::new(receiver), timeline.logic);
        pin_mut!(output);
        let mut values = Vec::new();

        for event in timeline.events {
            sender.send(LogicEvent { source: event.source, value: event.value }).await.unwrap();
            if let Some(expected) = event.output {
                assert_eq!(output.next().await.unwrap().as_i64(), Some(expected));
                values.push(expected);
            }
        }

        assert_eq!(values, timeline.outputs);
    }
}
