use grapht_render_vello_wgpu::scenario::{
    frame_stats, handle_scenario, measure_upload_bytes, SCENARIO_KEYS, SUPPORTED_SCENARIOS,
};
use grapht_render_vello_wgpu::{Camera, Geometry};
use serde_json::json;

fn grid(side: usize) -> Geometry {
    let mut node_ids = Vec::with_capacity(side * side);
    let mut positions = Vec::with_capacity(side * side);
    let mut edges = Vec::new();
    for row in 0..side {
        for col in 0..side {
            node_ids.push(format!("n{row}_{col}"));
            positions.push([col as f32 * 10.0, row as f32 * 10.0]);
        }
    }
    for row in 0..side {
        for col in 0..side {
            let i = (row * side + col) as u32;
            if col + 1 < side {
                edges.push([i, i + 1]);
            }
            if row + 1 < side {
                edges.push([i, i + side as u32]);
            }
        }
    }
    Geometry {
        node_ids,
        positions,
        edges,
    }
}

fn supported(scenario: &str) -> bool {
    SUPPORTED_SCENARIOS.contains(&scenario)
}

#[test]
fn scenario_keys_are_exhaustive_and_typed() {
    assert_eq!(SCENARIO_KEYS.len(), 32);
    for scenario in SCENARIO_KEYS {
        let result = handle_scenario(scenario, &json!({}), grid(5));
        let supported_actual = result.sample["supported"].as_bool().unwrap();
        assert_eq!(
            supported_actual,
            supported(scenario),
            "scenario {scenario} support flag mismatch"
        );
        assert!(result.sample["counters"].is_object());
    }
}

#[test]
fn camera_pan_moves_the_camera_by_per_frame_delta() {
    let result = handle_scenario(
        "camera-pan",
        &json!({"dx": 12, "dy": -8, "frames": 4}),
        grid(5),
    );
    let cam = result.state.camera;
    assert!((cam.x - 3.0).abs() < 1e-9);
    assert!((cam.y - -2.0).abs() < 1e-9);
    assert!(result.sample["supported"].as_bool().unwrap());
}

#[test]
fn style_update_rewrites_node_color() {
    let result = handle_scenario(
        "style-update",
        &json!({"nodeCount": 100, "color": 0xff2244}),
        grid(5),
    );
    let c = result.state.node_color;
    assert!((c[0] - 1.0).abs() < 1e-6);
    assert!((c[1] - (0x22 as f32 / 255.0)).abs() < 1e-6);
}

#[test]
fn group_collapse_then_expand_toggles_visibility() {
    let first = handle_scenario("group-collapse", &json!({"groupIds": [0, 1]}), grid(20));
    assert_eq!(first.state.collapsed.len(), 200);
    assert_eq!(first.sample["visibility"]["visibleNodeCount"], 200);
    let second = handle_scenario("group-expand", &json!({"groupIds": [0]}), grid(20));
    // expand on a fresh (uncollapsed) state removes nothing and stays supported
    assert!(second.sample["supported"].as_bool().unwrap());
    assert_eq!(second.state.collapsed.len(), 0);
}

#[test]
fn layout_apply_is_deterministic_grid() {
    let result = handle_scenario("layout-apply", &json!({"positionCount": 24}), grid(8));
    assert_eq!(result.state.positions[0], [0.0, 0.0]);
    assert_eq!(result.state.positions[1], [10.0, 0.0]);
    assert_eq!(result.state.positions[8], [0.0, 10.0]);
    assert_eq!(result.sample["supported"].as_bool().unwrap(), true);
}

#[test]
fn position_animation_reports_frame_stats_and_upload_bytes() {
    let result = handle_scenario(
        "position-animation",
        &json!({"nodeCount": 25, "frames": 30, "durationMs": 500}),
        grid(5),
    );
    let frame = &result.sample["frame"];
    assert_eq!(frame["count"], 30);
    assert!(frame["p50Ms"].as_f64().unwrap() <= frame["p95Ms"].as_f64().unwrap());
    assert!(frame["p95Ms"].as_f64().unwrap() <= frame["maxMs"].as_f64().unwrap());
    let upload = measure_upload_bytes(&result.state.geometry, 25);
    assert_eq!(
        upload,
        (25 * 2 * 4 + result.state.geometry.edges.len() * 2 * 4) as u64
    );
}

#[test]
fn graph_replace_bumps_generation_graph_dispose_flags() {
    let replaced = handle_scenario("graph-replace", &json!({"fixture": "grid-5k"}), grid(5));
    assert_eq!(replaced.state.generation, 1);
    assert!(!replaced.state.disposed);
    let disposed = handle_scenario("graph-dispose", &json!({}), grid(5));
    assert!(disposed.state.disposed);
    assert_eq!(disposed.state.generation, 1);
}

#[test]
fn frame_stats_is_deterministic() {
    let f = frame_stats(&[10.0, 12.0, 18.0, 15.0, 40.0], 16.67);
    assert_eq!(f.count, 5);
    assert_eq!(f.max_ms, 40.0);
    assert_eq!(f.dropped_frames, 2);
    assert_eq!(frame_stats(&[], 16.67).count, 0);
}

#[test]
fn camera_zoom_magnifies() {
    let result = handle_scenario(
        "camera-wheel-zoom",
        &json!({"deltaY": -100, "anchorX": 512, "anchorY": 384, "frames": 4}),
        grid(5),
    );
    assert!(result.state.camera.zoom > 1.0);
    let _ = Camera::default();
}
