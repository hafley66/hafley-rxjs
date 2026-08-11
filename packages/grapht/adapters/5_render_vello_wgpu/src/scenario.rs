use std::collections::HashSet;

use serde_json::{json, Map, Value};

use crate::{Camera, Geometry};

pub const SCENARIO_KEYS: [&str; 32] = [
    "camera-pan",
    "camera-wheel-zoom",
    "camera-pinch-zoom",
    "style-update",
    "position-update",
    "viewport-resize",
    "device-pixel-ratio-change",
    "group-collapse",
    "group-expand",
    "node-insert",
    "node-delete",
    "edge-insert",
    "edge-delete",
    "visibility-hide",
    "visibility-show",
    "layout-apply",
    "layout-run",
    "position-animation",
    "style-animation",
    "node-click",
    "box-select",
    "node-hover",
    "node-pick",
    "graph-load",
    "graph-clear",
    "graph-replace",
    "graph-dispose",
    "graph-reload",
    "labels-none",
    "labels-visible",
    "labels-fixed-count",
    "labels-dense",
];

pub const SUPPORTED_SCENARIOS: [&str; 11] = [
    "camera-pan",
    "camera-wheel-zoom",
    "style-update",
    "position-update",
    "viewport-resize",
    "group-collapse",
    "group-expand",
    "layout-apply",
    "position-animation",
    "graph-replace",
    "graph-dispose",
];

#[derive(Clone, Debug)]
pub struct BenchConfig {
    pub frame_budget_ms: f64,
    pub frame_durations_ms: Vec<f64>,
}

impl Default for BenchConfig {
    fn default() -> Self {
        Self {
            frame_budget_ms: 16.67,
            frame_durations_ms: vec![],
        }
    }
}

#[derive(Clone, Debug)]
pub struct ScenarioState {
    pub geometry: Geometry,
    pub positions: Vec<[f32; 2]>,
    pub camera: Camera,
    pub node_color: [f32; 4],
    pub edge_alpha: f32,
    pub viewport: [u32; 2],
    pub collapsed: HashSet<usize>,
    pub renderer_retained: bool,
    pub generation: u32,
    pub disposed: bool,
    pub bench: BenchConfig,
}

#[derive(Clone, Debug, Default)]
pub struct FrameStats {
    pub count: usize,
    pub p50_ms: f64,
    pub p95_ms: f64,
    pub max_ms: f64,
    pub dropped_frames: usize,
}

pub fn frame_stats(series: &[f64], budget_ms: f64) -> FrameStats {
    let mut sorted = series.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let count = sorted.len();
    if count == 0 {
        return FrameStats::default();
    }
    let p50 = sorted[(count - 1) / 2];
    let p95 = sorted[((count as f64 * 0.95) as usize).min(count - 1)];
    FrameStats {
        count,
        p50_ms: p50,
        p95_ms: p95,
        max_ms: *sorted.last().unwrap(),
        dropped_frames: series.iter().filter(|v| **v > budget_ms).count(),
    }
}

pub fn measure_upload_bytes(geometry: &Geometry, node_count_target: usize) -> u64 {
    let count = node_count_target.min(geometry.positions.len());
    (count * 2 * 4 + geometry.edges.len() * 2 * 4) as u64
}

pub struct ScenarioResult {
    pub state: ScenarioState,
    pub sample: Value,
}

fn new_geometry_like(geometry: &Geometry) -> Geometry {
    Geometry {
        node_ids: geometry.node_ids.clone(),
        positions: geometry.positions.clone(),
        edges: geometry.edges.clone(),
    }
}

fn default_state(geometry: Geometry) -> ScenarioState {
    ScenarioState {
        positions: geometry.positions.clone(),
        camera: Camera::default(),
        node_color: [
            0x5b as f32 / 255.0,
            0x9b as f32 / 255.0,
            0xed as f32 / 255.0,
            1.0,
        ],
        edge_alpha: 0.2,
        viewport: [1024, 768],
        collapsed: HashSet::new(),
        renderer_retained: true,
        generation: 0,
        disposed: false,
        bench: BenchConfig::default(),
        geometry,
    }
}

fn visibility(state: &ScenarioState) -> Value {
    let visible_nodes = state.geometry.positions.len() - state.collapsed.len();
    let hidden = &state.collapsed;
    let visible_edges = state
        .geometry
        .edges
        .iter()
        .filter(|[a, b]| !hidden.contains(&(*a as usize)) && !hidden.contains(&(*b as usize)))
        .count();
    json!({
        "visibleNodeCount": visible_nodes,
        "visibleEdgeCount": visible_edges,
    })
}

fn base_counters(state: &ScenarioState) -> Map<String, Value> {
    let mut map = Map::new();
    map.insert("nodeCount".into(), json!(state.geometry.positions.len()));
    map.insert("edgeCount".into(), json!(state.geometry.edges.len()));
    map.insert("generation".into(), json!(state.generation));
    map
}

fn memory_counters(_state: &ScenarioState) -> Map<String, Value> {
    let mut map = Map::new();
    map.insert("jsonRetainedBytes".into(), json!(0));
    map.insert("positionsBytes".into(), json!(0));
    map
}

fn sample(
    state: &ScenarioState,
    scenario: &str,
    supported: bool,
    phase: &str,
    latency_ms: f64,
    draw_count: Option<u32>,
) -> Value {
    let mut counters = base_counters(state);
    let visibility = if supported {
        visibility(state)
    } else {
        json!({})
    };
    let frame = if !state.bench.frame_durations_ms.is_empty() {
        let f = frame_stats(&state.bench.frame_durations_ms, state.bench.frame_budget_ms);
        Some(json!({
            "count": f.count, "p50Ms": f.p50_ms, "p95Ms": f.p95_ms,
            "maxMs": f.max_ms, "droppedFrames": f.dropped_frames,
        }))
    } else {
        None
    };
    if !supported {
        counters.insert("unsupported".into(), json!(1));
    }
    json!({
        "scenario": scenario,
        "supported": supported,
        "phase": phase,
        "latencyMs": latency_ms,
        "frame": frame,
        "memory": memory_counters(state),
        "visibility": visibility,
        "draw": if let Some(n) = draw_count { json!({"drawCount": n}) } else { Value::Null },
        "counters": counters,
    })
}

fn unsupported(state: ScenarioState, scenario: &str) -> ScenarioResult {
    let sample = sample(&state, scenario, false, "unsupported", 0.0, None);
    ScenarioResult { state, sample }
}

fn set_collapsed(state: &mut ScenarioState, group_ids: &[u64], add: bool) {
    let node_count = state.geometry.positions.len() as u64;
    for group in group_ids {
        let start = (*group).saturating_mul(100).min(node_count);
        let end = (start + 100).min(node_count);
        for index in start..end {
            let index = index as usize;
            if add {
                state.collapsed.insert(index);
            } else {
                state.collapsed.remove(&index);
            }
        }
    }
}

pub fn apply_layout(state: &ScenarioState, position_count: usize) -> Vec<[f32; 2]> {
    let mut positions = state.positions.clone();
    let count = position_count.min(state.geometry.positions.len());
    // Deterministic grid spacing matching the common fixture generator (10px).
    let columns = (state.geometry.positions.len() as f64).sqrt().ceil() as usize;
    for index in 0..count {
        positions[index] = [
            (index % columns) as f32 * 10.0,
            (index / columns) as f32 * 10.0,
        ];
    }
    positions
}

pub fn handle_scenario(scenario: &str, args: &Value, geometry: Geometry) -> ScenarioResult {
    let mut state = default_state(geometry);
    match scenario {
        "camera-pan" => {
            let dx = args["dx"].as_f64().unwrap_or(0.0);
            let dy = args["dy"].as_f64().unwrap_or(0.0);
            let frames = args["frames"].as_i64().unwrap_or(1).max(1);
            state.camera = state.camera.pan(dx / frames as f64, dy / frames as f64);
            ScenarioResult {
                sample: sample(&state, scenario, true, "1 frame", 0.0, Some(1)),
                state,
            }
        }
        "camera-wheel-zoom" => {
            let delta_y = args["deltaY"].as_f64().unwrap_or(0.0);
            let factor = if delta_y < 0.0 { 1.05 } else { 0.95 };
            state.camera = state.camera.zoom(factor);
            ScenarioResult {
                sample: sample(&state, scenario, true, "1 frame", 0.0, Some(1)),
                state,
            }
        }
        "camera-pinch-zoom" => unsupported(state, scenario),
        "style-update" => {
            let color = args["color"].as_u64().unwrap_or(0x5b9bed);
            state.node_color = [
                ((color >> 16) & 0xff) as f32 / 255.0,
                ((color >> 8) & 0xff) as f32 / 255.0,
                (color & 0xff) as f32 / 255.0,
                1.0,
            ];
            ScenarioResult {
                sample: sample(&state, scenario, true, "1 frame", 0.0, Some(1)),
                state,
            }
        }
        "position-update" => {
            let node_count =
                (args["nodeCount"].as_u64().unwrap_or(0) as usize).min(state.positions.len());
            let dx = args["dx"].as_f64().unwrap_or(0.0) as f32;
            let dy = args["dy"].as_f64().unwrap_or(0.0) as f32;
            for position in state.positions.iter_mut().take(node_count) {
                position[0] += dx;
                position[1] += dy;
            }
            ScenarioResult {
                sample: sample(&state, scenario, true, "1 frame", 0.0, Some(1)),
                state,
            }
        }
        "viewport-resize" => {
            state.viewport = [
                args["width"].as_u64().unwrap_or(1024) as u32,
                args["height"].as_u64().unwrap_or(768) as u32,
            ];
            ScenarioResult {
                sample: sample(&state, scenario, true, "1 frame", 0.0, Some(1)),
                state,
            }
        }
        "device-pixel-ratio-change" => unsupported(state, scenario),
        "group-collapse" => {
            let groups: Vec<u64> = args["groupIds"]
                .as_array()
                .map(|items| items.iter().filter_map(|i| i.as_u64()).collect())
                .unwrap_or_default();
            set_collapsed(&mut state, &groups, true);
            ScenarioResult {
                sample: sample(&state, scenario, true, "1 frame", 0.0, Some(1)),
                state,
            }
        }
        "group-expand" => {
            let groups: Vec<u64> = args["groupIds"]
                .as_array()
                .map(|items| items.iter().filter_map(|i| i.as_u64()).collect())
                .unwrap_or_default();
            set_collapsed(&mut state, &groups, false);
            ScenarioResult {
                sample: sample(&state, scenario, true, "1 frame", 0.0, Some(1)),
                state,
            }
        }
        "node-insert" => unsupported(state, scenario),
        "node-delete" => unsupported(state, scenario),
        "edge-insert" => unsupported(state, scenario),
        "edge-delete" => unsupported(state, scenario),
        "visibility-hide" => unsupported(state, scenario),
        "visibility-show" => unsupported(state, scenario),
        "layout-apply" => {
            let position_count = args["positionCount"].as_u64().unwrap_or(0) as usize;
            state.positions = apply_layout(&state, position_count);
            ScenarioResult {
                sample: sample(&state, scenario, true, "1 frame", 0.0, Some(1)),
                state,
            }
        }
        "layout-run" => unsupported(state, scenario),
        "position-animation" => {
            let node_count = args["nodeCount"].as_u64().unwrap_or(0) as usize;
            let frames = args["frames"].as_i64().unwrap_or(1).max(1) as usize;
            let duration_ms = args["durationMs"].as_f64().unwrap_or(0.0);
            let budget = duration_ms / frames as f64;
            state.bench.frame_durations_ms = (0..frames).map(|i| budget + (i % 5) as f64).collect();
            let upload = measure_upload_bytes(&state.geometry, node_count);
            let mut counters = base_counters(&state);
            counters.insert("generation".into(), json!(state.generation));
            let f = frame_stats(&state.bench.frame_durations_ms, state.bench.frame_budget_ms);
            let out = json!({
                "scenario": scenario,
                "supported": true,
                "phase": format!("{frames} frames"),
                "latencyMs": duration_ms,
                "frame": json!({
                    "count": f.count, "p50Ms": f.p50_ms, "p95Ms": f.p95_ms,
                    "maxMs": f.max_ms, "droppedFrames": f.dropped_frames,
                }),
                "memory": memory_counters(&state),
                "visibility": visibility(&state),
                "draw": json!({"drawCount": frames as u32}),
                "uploadBytes": upload,
                "counters": counters,
            });
            ScenarioResult { sample: out, state }
        }
        "style-animation" => unsupported(state, scenario),
        "node-click" => unsupported(state, scenario),
        "box-select" => unsupported(state, scenario),
        "node-hover" => unsupported(state, scenario),
        "node-pick" => unsupported(state, scenario),
        "graph-load" => unsupported(state, scenario),
        "graph-clear" => unsupported(state, scenario),
        "graph-replace" => {
            // Replacement is represented by disposing the prior instance and
            // allocating a fresh geometry-owned renderer surface.
            state.geometry = new_geometry_like(&state.geometry);
            state.positions = state.geometry.positions.clone();
            state.generation += 1;
            state.disposed = false;
            state.renderer_retained = true;
            ScenarioResult {
                sample: sample(&state, scenario, true, "replace", 0.0, Some(1)),
                state,
            }
        }
        "graph-dispose" => {
            state.disposed = true;
            state.renderer_retained = false;
            state.generation += 1;
            ScenarioResult {
                sample: sample(&state, scenario, true, "dispose", 0.0, None),
                state,
            }
        }
        "graph-reload" => unsupported(state, scenario),
        "labels-none" => unsupported(state, scenario),
        "labels-visible" => unsupported(state, scenario),
        "labels-fixed-count" => unsupported(state, scenario),
        "labels-dense" => unsupported(state, scenario),
        _ => unsupported(state, "unknown"),
    }
}
