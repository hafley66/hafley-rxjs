use std::{env, fs, time::Instant};

use grapht_render_vello_wgpu::{build_scene, pick_node, scene_encoding_units, Camera, Geometry};
use serde::Deserialize;
use serde_json::json;

#[derive(Deserialize)]
struct CommonNode { id: String, x: f32, y: f32 }

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

fn fixture(path: &str) -> Result<(Geometry, usize), String> {
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    let parsed: CommonFixture = serde_json::from_slice(&bytes).map_err(|error| error.to_string())?;
    if parsed.protocol != "grapht-render-fixture/0" { return Err(format!("unexpected fixture protocol {}", parsed.protocol)); }
    if parsed.id != format!("grid-{}", parsed.node_count) || parsed.node_count != parsed.nodes.len() || parsed.edge_count != parsed.edges.len() { return Err("fixture manifest identity or count mismatch".into()); }
    let node_ids = parsed.nodes.iter().map(|node| node.id.clone()).collect();
    let positions = parsed.nodes.iter().map(|node| [node.x, node.y]).collect();
    Ok((Geometry { node_ids, positions, edges: parsed.edges }, bytes.len()))
}

fn main() {
    let fixture_path = env::args().nth(1).unwrap_or_else(|| "../../.cache/render-fixtures/grid-1000.json".into());
    let fixture_hash = env::args().nth(2).unwrap_or_default();
    let fixture_started = Instant::now();
    let (geometry, fixture_bytes) = match fixture(&fixture_path) {
        Ok(value) => value,
        Err(reason) => { println!("{}", json!({"implementation":"vello-wgpu","status":"hard-failure","setupValid":false,"statusReason":reason,"fixture":fixture_path})); return; }
    };
    let size = geometry.node_ids.len();
    let fixture_ms = fixture_started.elapsed().as_secs_f64() * 1_000.0;
    let source = json!({"path":fixture_path,"bytes":fixture_bytes,"sha256":fixture_hash});
    let instance = wgpu::Instance::default();
    let adapter = match pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions::default())) {
        Ok(adapter) => adapter,
        Err(error) => { println!("{}", json!({"implementation":"vello-wgpu","status":"capability-failure","nodeCount":size,"edgeCount":geometry.edges.len(),"fixtureMs":fixture_ms,"fixtureSource":source,"reason":format!("adapter request failed: {error}")})); return; }
    };
    let device_started = Instant::now();
    let (device, queue) = match pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor::default())) {
        Ok(value) => value,
        Err(error) => { println!("{}", json!({"implementation":"vello-wgpu","status":"capability-failure","nodeCount":size,"edgeCount":geometry.edges.len(),"fixtureMs":fixture_ms,"fixtureSource":source,"reason":format!("device request failed: {error}")})); return; }
    };
    let device_construction_ms = device_started.elapsed().as_secs_f64() * 1_000.0;
    let renderer_started = Instant::now();
    let mut renderer = match vello::Renderer::new(&device, vello::RendererOptions::default()) {
        Ok(renderer) => renderer,
        Err(error) => { println!("{}", json!({"implementation":"vello-wgpu","status":"renderer-error","nodeCount":size,"edgeCount":geometry.edges.len(),"fixtureMs":fixture_ms,"fixtureSource":source,"deviceConstructionMs":device_construction_ms,"reason":error.to_string()})); return; }
    };
    let renderer_construction_ms = renderer_started.elapsed().as_secs_f64() * 1_000.0;
    let texture = device.create_texture(&wgpu::TextureDescriptor {
        label: Some("grapht-breakpoint-target"), size: wgpu::Extent3d { width: 512, height: 512, depth_or_array_layers: 1 },
        mip_level_count: 1, sample_count: 1, dimension: wgpu::TextureDimension::D2,
        format: wgpu::TextureFormat::Rgba8Unorm, usage: wgpu::TextureUsages::STORAGE_BINDING | wgpu::TextureUsages::COPY_SRC, view_formats: &[],
    });
    let view = texture.create_view(&wgpu::TextureViewDescriptor::default());
    let render_scene = |renderer: &mut vello::Renderer, camera: Camera| -> Result<(), String> {
        let scene = build_scene(&geometry, camera);
        renderer.render_to_texture(&device, &queue, &scene, &view, &vello::RenderParams {
            base_color: vello::peniko::Color::from_rgb8(17, 24, 39), width: 512, height: 512,
            antialiasing_method: vello::AaConfig::Area,
        }).map_err(|error| error.to_string())?;
        device.poll(wgpu::PollType::wait_indefinitely()).map_err(|error| error.to_string())?;
        Ok(())
    };
    let first_started = Instant::now();
    if let Err(reason) = render_scene(&mut renderer, Camera::default()) {
        println!("{}", json!({"implementation":"vello-wgpu","status":"renderer-error","nodeCount":size,"edgeCount":geometry.edges.len(),"fixtureMs":fixture_ms,"fixtureSource":source,"deviceConstructionMs":device_construction_ms,"rendererConstructionMs":renderer_construction_ms,"reason":reason})); return;
    }
    let first_render_ms = first_started.elapsed().as_secs_f64() * 1_000.0;
    if let Err(reason) = render_scene(&mut renderer, Camera::default().pan(1.0, 1.0)) {
        println!("{}", json!({"implementation":"vello-wgpu","status":"renderer-error","setupValid":false,"statusReason":reason,"nodeCount":size,"edgeCount":geometry.edges.len(),"fixtureMs":fixture_ms,"fixtureSource":source,"deviceConstructionMs":device_construction_ms,"rendererConstructionMs":renderer_construction_ms,"firstRenderMs":first_render_ms})); return;
    }
    let mut interaction_ms = Vec::with_capacity(5);
    let mut camera = Camera::default();
    for index in 0..5 {
        let started = Instant::now();
        camera = camera.pan(1.0, 1.0).zoom(1.01);
        let _selected = pick_node(&geometry, [index as f32 * 10.0, index as f32 * 10.0], 3.0);
        if let Err(reason) = render_scene(&mut renderer, camera) {
            println!("{}", json!({"implementation":"vello-wgpu","status":"renderer-error","setupValid":false,"statusReason":reason,"nodeCount":size,"edgeCount":geometry.edges.len(),"fixtureMs":fixture_ms,"fixtureSource":source,"deviceConstructionMs":device_construction_ms,"rendererConstructionMs":renderer_construction_ms,"firstRenderMs":first_render_ms,"reason":reason})); return;
        }
        interaction_ms.push(started.elapsed().as_secs_f64() * 1_000.0);
    }
    interaction_ms.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let median = interaction_ms[interaction_ms.len() / 2];
    let p95 = interaction_ms[((interaction_ms.len() as f64 * 0.95).ceil() as usize).saturating_sub(1).min(interaction_ms.len() - 1)];
    let scene = build_scene(&geometry, Camera::default());
    let encoding_units = scene_encoding_units(&scene);
    let position_span_x = geometry.positions.iter().map(|position| position[0]).fold(0.0_f32, f32::max);
    let position_span_y = geometry.positions.iter().map(|position| position[1]).fold(0.0_f32, f32::max);
    println!("{}", json!({"implementation":"vello-wgpu","status":"healthy","setupValid":true,"statusReason":"Vello scene encoded, rendered to a headless wgpu texture, and waited for device completion","warmupInteractionCount":1,"nodeCount":size,"edgeCount":geometry.edges.len(),"fixtureMs":fixture_ms,"fixtureSource":source,"deviceConstructionMs":device_construction_ms,"rendererConstructionMs":renderer_construction_ms,"firstRenderMs":first_render_ms,"interactionMedianMs":median,"interactionP95Ms":p95,"surface":"headless-texture","actualRender":true,"completion":"device.poll(wait_indefinitely)","visualValidity":{"drawnNodeCount":size,"drawnEdgeCount":geometry.edges.len(),"positionSpanX":position_span_x,"positionSpanY":position_span_y,"sceneEncodingUnits":encoding_units,"valid":encoding_units > 0 && size > 0 && !geometry.edges.is_empty()}}));
}
