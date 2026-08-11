use std::{
    fs,
    io::{self, Read},
    time::Instant,
};

use grapht_render_vello_wgpu::scenario::{handle_scenario, SCENARIO_KEYS, SUPPORTED_SCENARIOS};
use serde::Deserialize;
use serde_json::json;

#[derive(Deserialize)]
struct CommonNode {
    id: String,
    x: f32,
    y: f32,
}

#[derive(Deserialize)]
struct CommonFixture {
    protocol: String,
    id: String,
    #[serde(rename = "nodeCount")]
    node_count: usize,
    #[serde(rename = "edgeCount")]
    edge_count: usize,
    nodes: Vec<CommonNode>,
    edges: Vec<[u32; 2]>,
}

fn load_fixture(path: &str) -> Result<grapht_render_vello_wgpu::Geometry, String> {
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    let parsed: CommonFixture = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
    if parsed.protocol != "grapht-render-fixture/0" {
        return Err(format!("unexpected fixture protocol {}", parsed.protocol));
    }
    let _ = &parsed.id;
    if parsed.node_count != parsed.nodes.len() || parsed.edge_count != parsed.edges.len() {
        return Err("fixture manifest count mismatch".into());
    }
    Ok(grapht_render_vello_wgpu::Geometry {
        node_ids: parsed.nodes.iter().map(|node| node.id.clone()).collect(),
        positions: parsed.nodes.iter().map(|node| [node.x, node.y]).collect(),
        edges: parsed.edges,
    })
}

fn main() {
    let fixture_path = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "fixtures/render/grid-1000.json".into());
    let scenario = std::env::args().nth(2).unwrap_or_default();
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();

    let geometry = match load_fixture(&fixture_path) {
        Ok(value) => value,
        Err(reason) => {
            println!(
                "{}",
                json!({"protocol":"grapht-vello-scenario/0","type":"error","scenario":scenario,"message":reason})
            );
            return;
        }
    };

    if scenario == "list" {
        println!(
            "{}",
            json!({"protocol":"grapht-vello-scenario/0","scenarioKeys":SCENARIO_KEYS,"supported":SUPPORTED_SCENARIOS})
        );
        return;
    }

    let args: serde_json::Value = if input.trim().is_empty() {
        json!({})
    } else {
        serde_json::from_str(&input).unwrap_or_else(|_| json!({}))
    };

    let started = Instant::now();
    let result = handle_scenario(&scenario, &args, geometry);
    let latency_ms = started.elapsed().as_secs_f64() * 1_000.0;
    let mut sample = result.sample;
    sample["latencyMs"] = json!(latency_ms + sample["latencyMs"].as_f64().unwrap_or(0.0));

    println!(
        "{}",
        json!({
            "protocol": "grapht-vello-scenario/0",
            "type": "sample",
            "scenario": scenario,
            "sample": sample,
        })
    );
}
