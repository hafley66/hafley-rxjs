use std::{fs, path::PathBuf, time::Instant};

use grapht_render_vello_wgpu::{build_scene, parse_geometry, pick_node, Camera};
use serde_json::json;

fn main() {
    let fixture = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("fixtures/geometry/grid-1k");
    let manifest = fs::read_to_string(fixture.join("manifest.json")).unwrap();
    let node_ids = fs::read_to_string(fixture.join("nodeIds.json")).unwrap();
    let edges = fs::read_to_string(fixture.join("edges.json")).unwrap();
    let positions = fs::read(fixture.join("positions.f32le.bin")).unwrap();
    let (_, geometry) = parse_geometry(&manifest, &node_ids, &edges, &positions).unwrap();
    let camera = Camera::default().pan(1.0, 2.0).zoom(1.25);
    let scene = build_scene(&geometry, camera);
    let picked = pick_node(&geometry, [0.0, 0.0], 3.0);
    let instance = wgpu::Instance::default();
    let Some(adapter) =
        pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions::default())).ok()
    else {
        println!(
            "{}",
            serde_json::to_string(&json!({
                "protocol": "grapht-vello-render-probe/0", "status": "capability-failure",
                "stage": "adapter", "sceneEncoding": scene.encoding().path_tags.len(),
                "camera": camera, "picked": picked, "surface": "headless-no-surface"
            }))
            .unwrap()
        );
        return;
    };
    let device_started = Instant::now();
    let Ok((device, queue)) =
        pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor::default()))
    else {
        println!("{}", serde_json::to_string(&json!({"protocol":"grapht-vello-render-probe/0","status":"capability-failure","stage":"device","surface":"headless-no-surface"})).unwrap());
        return;
    };
    let renderer_started = Instant::now();
    let Ok(mut renderer) = vello::Renderer::new(&device, vello::RendererOptions::default()) else {
        println!("{}", serde_json::to_string(&json!({"protocol":"grapht-vello-render-probe/0","status":"capability-failure","stage":"pipelineInitialization","deviceNs":device_started.elapsed().as_nanos()})).unwrap());
        return;
    };
    let texture = device.create_texture(&wgpu::TextureDescriptor {
        label: Some("grapht-vello-probe"),
        size: wgpu::Extent3d {
            width: 128,
            height: 128,
            depth_or_array_layers: 1,
        },
        mip_level_count: 1,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format: wgpu::TextureFormat::Rgba8Unorm,
        usage: wgpu::TextureUsages::STORAGE_BINDING | wgpu::TextureUsages::COPY_SRC,
        view_formats: &[],
    });
    let view = texture.create_view(&wgpu::TextureViewDescriptor::default());
    let render_started = Instant::now();
    let render = renderer.render_to_texture(
        &device,
        &queue,
        &scene,
        &view,
        &vello::RenderParams {
            base_color: vello::peniko::Color::from_rgb8(17, 24, 39),
            width: 128,
            height: 128,
            antialiasing_method: vello::AaConfig::Area,
        },
    );
    println!("{}", serde_json::to_string(&json!({
        "protocol": "grapht-vello-render-probe/0", "status": if render.is_ok() { "rendered" } else { "capability-failure" },
        "deviceNs": device_started.elapsed().as_nanos(), "pipelineNs": renderer_started.elapsed().as_nanos(),
        "renderNs": render_started.elapsed().as_nanos(), "camera": camera, "picked": picked,
        "surface": "headless-texture", "dispose": "drop(renderer, texture, device, queue)"
    })).unwrap());
}
