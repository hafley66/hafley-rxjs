use std::{env, fs, mem::size_of};

use serde::Deserialize;
use serde_json::json;

#[derive(Deserialize)]
struct Node { id: String, x: f32, y: f32 }

#[derive(Deserialize)]
struct Fixture {
    protocol: String,
    id: String,
    #[serde(rename = "nodeCount")]
    node_count: usize,
    #[serde(rename = "edgeCount")]
    edge_count: usize,
    nodes: Vec<Node>,
    edges: Vec<[u32; 2]>,
}

fn main() {
    let path = env::args().nth(1).expect("fixture path");
    let bytes = fs::read(&path).expect("read fixture");
    let fixture: Fixture = serde_json::from_slice(&bytes).expect("parse fixture");
    assert_eq!(fixture.protocol, "grapht-render-fixture/0");
    assert_eq!(fixture.node_count, fixture.nodes.len());
    assert_eq!(fixture.edge_count, fixture.edges.len());

    let string_bytes = fixture.protocol.capacity()
        + fixture.id.capacity()
        + fixture.nodes.iter().map(|node| node.id.capacity()).sum::<usize>();
    let rust_retained_payload_bytes = size_of::<Fixture>()
        + fixture.nodes.capacity() * size_of::<Node>()
        + fixture.edges.capacity() * size_of::<[u32; 2]>()
        + string_bytes;
    let packed_render_bytes = fixture.nodes.len() * (size_of::<[f32; 2]>() + size_of::<u32>())
        + fixture.edges.len() * size_of::<[u32; 2]>();
    let coordinate_checksum = fixture.nodes.iter().fold(0.0_f64, |sum, node| sum + node.x as f64 + node.y as f64);

    println!("{}", json!({
        "nodeCount": fixture.node_count,
        "edgeCount": fixture.edge_count,
        "jsonBytes": bytes.len(),
        "rustRetainedPayloadBytes": rust_retained_payload_bytes,
        "packedRenderBytes": packed_render_bytes,
        "coordinateChecksum": coordinate_checksum,
        "accounting": "struct sizes + Vec capacities + String capacities; excludes allocator metadata and runtime baseline"
    }));
}
