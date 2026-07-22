use std::collections::BTreeMap;

use async_stream::stream;
use futures::{Stream, StreamExt};
use serde_json::{Number, Value};

use crate::types::LogicEvent;

fn path(scope: &BTreeMap<String, Value>, reference: &str) -> Option<Value> {
    let mut parts = reference.split('.');
    let first = parts.next()?;
    let mut value = scope.get(first)?.clone();
    for part in parts {
        value = value.as_object()?.get(part)?.clone();
    }
    Some(value)
}

fn evaluate(logic: &Value, scope: &BTreeMap<String, Value>) -> Option<Value> {
    if !logic.is_object() {
        return Some(logic.clone());
    }
    let object = logic.as_object()?;
    if let Some(reference) = object.get("var") {
        return path(scope, reference.as_str()?);
    }
    if let Some(values) = object.get("*")?.as_array() {
        let mut product = 1_i64;
        for value in values {
            product *= evaluate(value, scope)?.as_i64()?;
        }
        return Some(Value::Number(Number::from(product)));
    }
    None
}

pub fn logic<S>(mut events: S, expression: Value) -> impl Stream<Item = Value>
where
    S: Stream<Item = LogicEvent> + Unpin,
{
    stream! {
        let mut scope = BTreeMap::new();
        while let Some(event) = events.next().await {
            scope.insert(event.source, event.value);
            if let Some(value) = evaluate(&expression, &scope) {
                yield value;
            }
        }
    }
}
