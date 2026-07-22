use async_stream::stream;
use futures::{Stream, StreamExt};

use crate::models::{NumberInput, Total};

pub fn running_total_handwritten<S0>(mut value: S0) -> impl Stream<Item = Total>
where
    S0: Stream<Item = NumberInput> + Unpin,
{
    stream! {
        let mut state = 0 as Total;
        while let Some(value) = value.next().await {
            let value = value * 2;
            if value < 4 { continue; }
            state += value;
            yield state;
        }
    }
}
