use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)] pub struct Value { pub label: String }
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)] pub struct Failure { pub message: String }
