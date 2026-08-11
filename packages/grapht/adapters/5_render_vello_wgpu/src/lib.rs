use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use vello::{
    kurbo::{Affine, Circle, Line, Stroke},
    peniko::{Color, Fill},
    Scene,
};

pub const GEOMETRY_PROTOCOL: &str = "grapht-geometry/0";

pub mod scenario;

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct GeometryManifest {
    pub protocol: String,
    #[serde(rename = "nodeIds")]
    pub node_ids: String,
    pub positions: String,
    pub edges: String,
    #[serde(rename = "nodeCount")]
    pub node_count: usize,
    #[serde(rename = "edgeCount")]
    pub edge_count: usize,
    pub scalar: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Geometry {
    pub node_ids: Vec<String>,
    pub positions: Vec<[f32; 2]>,
    pub edges: Vec<[u32; 2]>,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
pub struct Camera {
    pub x: f64,
    pub y: f64,
    pub zoom: f64,
}

impl Default for Camera {
    fn default() -> Self {
        Self {
            x: 0.0,
            y: 0.0,
            zoom: 1.0,
        }
    }
}

impl Camera {
    pub fn pan(self, dx: f64, dy: f64) -> Self {
        Self {
            x: self.x + dx,
            y: self.y + dy,
            ..self
        }
    }

    pub fn zoom(self, factor: f64) -> Self {
        Self {
            zoom: (self.zoom * factor).max(0.001),
            ..self
        }
    }
}

pub fn pick_node(geometry: &Geometry, point: [f32; 2], radius: f32) -> Option<&str> {
    let radius_squared = radius * radius;
    geometry
        .positions
        .iter()
        .enumerate()
        .find_map(|(index, position)| {
            let dx = position[0] - point[0];
            let dy = position[1] - point[1];
            (dx * dx + dy * dy <= radius_squared).then(|| geometry.node_ids[index].as_str())
        })
}

pub fn parse_geometry(
    manifest_json: &str,
    node_ids_json: &str,
    edges_json: &str,
    position_bytes: &[u8],
) -> Result<(GeometryManifest, Geometry), String> {
    let manifest: GeometryManifest =
        serde_json::from_str(manifest_json).map_err(|e| e.to_string())?;
    if manifest.protocol != GEOMETRY_PROTOCOL {
        return Err(format!(
            "expected {GEOMETRY_PROTOCOL}, got {}",
            manifest.protocol
        ));
    }
    if manifest.scalar != "f32-le" {
        return Err(format!("unsupported scalar {}", manifest.scalar));
    }
    if position_bytes.len() != manifest.node_count * 2 * 4 {
        return Err(format!(
            "position byte length {} does not match node count {}",
            position_bytes.len(),
            manifest.node_count
        ));
    }
    let node_ids: Vec<String> = serde_json::from_str(node_ids_json).map_err(|e| e.to_string())?;
    let edges: Vec<[u32; 2]> = serde_json::from_str(edges_json).map_err(|e| e.to_string())?;
    if node_ids.len() != manifest.node_count {
        return Err("node count does not match manifest".into());
    }
    if edges.len() != manifest.edge_count {
        return Err("edge count does not match manifest".into());
    }
    let positions = position_bytes
        .chunks_exact(4)
        .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
        .collect::<Vec<_>>()
        .chunks_exact(2)
        .map(|pair| [pair[0], pair[1]])
        .collect::<Vec<_>>();
    Ok((
        manifest,
        Geometry {
            node_ids,
            positions,
            edges,
        },
    ))
}

pub fn build_scene(geometry: &Geometry, camera: Camera) -> Scene {
    let mut scene = Scene::new();
    let transform = Affine::translate((camera.x, camera.y)) * Affine::scale(camera.zoom.max(0.001));
    let by_id = geometry
        .node_ids
        .iter()
        .enumerate()
        .map(|(index, id)| (id.as_str(), index))
        .collect::<HashMap<_, _>>();

    for [a, b] in &geometry.edges {
        let Some(start) = geometry.positions.get(*a as usize) else {
            continue;
        };
        let Some(end) = geometry.positions.get(*b as usize) else {
            continue;
        };
        scene.stroke(
            &Stroke::new(1.0),
            transform,
            Color::from_rgb8(80, 92, 120),
            None,
            &Line::new(
                (start[0] as f64, start[1] as f64),
                (end[0] as f64, end[1] as f64),
            ),
        );
    }
    for position in &geometry.positions {
        scene.fill(
            Fill::NonZero,
            transform,
            Color::from_rgb8(74, 127, 223),
            None,
            &Circle::new((position[0] as f64, position[1] as f64), 2.0),
        );
    }
    let _ = by_id;
    scene
}

pub fn scene_counts(geometry: &Geometry) -> (usize, usize) {
    (geometry.node_ids.len(), geometry.edges.len())
}

pub fn scene_encoding_units(scene: &Scene) -> usize {
    let encoding = scene.encoding();
    encoding.path_tags.len()
        + encoding.path_data.len()
        + encoding.draw_tags.len()
        + encoding.draw_data.len()
        + encoding.transforms.len()
        + encoding.styles.len()
}

#[derive(Clone, Debug, Deserialize)]
struct BrowserFixture {
    protocol: String,
    id: String,
    #[serde(rename = "nodeCount")]
    node_count: usize,
    #[serde(rename = "edgeCount")]
    edge_count: usize,
    nodes: Vec<BrowserFixtureNode>,
    edges: Vec<[u32; 2]>,
}

#[derive(Clone, Debug, Deserialize)]
struct BrowserFixtureNode {
    id: String,
    x: f32,
    y: f32,
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen]
pub struct VelloBrowserRenderer {
    instance: wgpu::Instance,
    surface: wgpu::Surface<'static>,
    device: wgpu::Device,
    queue: wgpu::Queue,
    renderer: vello::Renderer,
    blitter: wgpu::util::TextureBlitter,
    surface_config: wgpu::SurfaceConfiguration,
    target_texture: wgpu::Texture,
    target_view: wgpu::TextureView,
    geometry: Geometry,
    camera: Camera,
    color: u32,
    width: u32,
    height: u32,
    frame_count: u64,
    disposed: bool,
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen]
impl VelloBrowserRenderer {
    #[wasm_bindgen::prelude::wasm_bindgen(js_name = create)]
    pub async fn create(
        canvas: web_sys::HtmlCanvasElement,
        width: u32,
        height: u32,
    ) -> Result<VelloBrowserRenderer, wasm_bindgen::JsValue> {
        if width == 0 || height == 0 {
            return Err(js_error("canvas dimensions must be nonzero"));
        }
        let instance = wgpu::Instance::new(wgpu::InstanceDescriptor {
            backends: wgpu::Backends::BROWSER_WEBGPU,
            ..wgpu::InstanceDescriptor::new_without_display_handle()
        });
        let surface = instance
            .create_surface(wgpu::SurfaceTarget::Canvas(canvas))
            .map_err(|error| js_error(&format!("create WebGPU canvas surface: {error}")))?;
        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: Some(&surface),
                force_fallback_adapter: false,
            })
            .await
            .map_err(|error| js_error(&format!("request WebGPU adapter: {error}")))?;
        let (device, queue) = adapter
            .request_device(&wgpu::DeviceDescriptor {
                label: Some("grapht-vello-browser-device"),
                ..Default::default()
            })
            .await
            .map_err(|error| js_error(&format!("request WebGPU device: {error}")))?;

        let capabilities = surface.get_capabilities(&adapter);
        let format = capabilities
            .formats
            .iter()
            .copied()
            .find(|format| *format == wgpu::TextureFormat::Rgba8Unorm)
            .or_else(|| {
                capabilities
                    .formats
                    .iter()
                    .copied()
                    .find(|format| *format == wgpu::TextureFormat::Bgra8Unorm)
            })
            .ok_or_else(|| js_error("WebGPU canvas has no unorm surface format"))?;
        let surface_config = wgpu::SurfaceConfiguration {
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            format,
            width,
            height,
            present_mode: capabilities
                .present_modes
                .iter()
                .copied()
                .find(|mode| *mode == wgpu::PresentMode::Fifo)
                .unwrap_or(wgpu::PresentMode::AutoVsync),
            desired_maximum_frame_latency: 2,
            alpha_mode: capabilities
                .alpha_modes
                .first()
                .copied()
                .unwrap_or(wgpu::CompositeAlphaMode::Auto),
            view_formats: vec![],
        };
        surface.configure(&device, &surface_config);
        let (target_texture, target_view) = create_target(&device, width, height);
        let renderer = vello::Renderer::new(&device, vello::RendererOptions::default())
            .map_err(|error| js_error(&format!("create Vello renderer: {error}")))?;
        let blitter = wgpu::util::TextureBlitter::new(&device, format);

        Ok(Self {
            instance,
            surface,
            device,
            queue,
            renderer,
            blitter,
            surface_config,
            target_texture,
            target_view,
            geometry: Geometry {
                node_ids: vec![],
                positions: vec![],
                edges: vec![],
            },
            camera: Camera::default(),
            color: 0x4a7fdf,
            width,
            height,
            frame_count: 0,
            disposed: false,
        })
    }

    pub fn load_fixture_json(&mut self, fixture_json: &str) -> Result<(), wasm_bindgen::JsValue> {
        let fixture: BrowserFixture = serde_json::from_str(fixture_json)
            .map_err(|error| js_error(&format!("parse renderer fixture: {error}")))?;
        if fixture.protocol != "grapht-render-fixture/0" {
            return Err(js_error(&format!(
                "unsupported renderer fixture protocol {}",
                fixture.protocol
            )));
        }
        if fixture.id.is_empty()
            || fixture.node_count != fixture.nodes.len()
            || fixture.edge_count != fixture.edges.len()
        {
            return Err(js_error("renderer fixture identity or counts are invalid"));
        }
        if fixture.edges.iter().any(|[source, target]| {
            *source as usize >= fixture.node_count || *target as usize >= fixture.node_count
        }) {
            return Err(js_error("renderer fixture edge endpoint is outside nodes"));
        }
        self.geometry = Geometry {
            node_ids: fixture.nodes.iter().map(|node| node.id.clone()).collect(),
            positions: fixture.nodes.iter().map(|node| [node.x, node.y]).collect(),
            edges: fixture.edges,
        };
        self.disposed = false;
        Ok(())
    }

    pub fn set_camera_pan(&mut self, dx: f64, dy: f64) -> Result<(), wasm_bindgen::JsValue> {
        self.ensure_live()?;
        self.camera = self.camera.pan(dx, dy);
        Ok(())
    }

    pub fn set_camera_wheel_zoom(
        &mut self,
        delta_y: f64,
        anchor_x: f64,
        anchor_y: f64,
    ) -> Result<(), wasm_bindgen::JsValue> {
        self.ensure_live()?;
        let factor = (-delta_y / 600.0).exp();
        let previous_zoom = self.camera.zoom;
        let next_zoom = (previous_zoom * factor).max(0.001);
        self.camera.x = anchor_x - (anchor_x - self.camera.x) * next_zoom / previous_zoom;
        self.camera.y = anchor_y - (anchor_y - self.camera.y) * next_zoom / previous_zoom;
        self.camera.zoom = next_zoom;
        Ok(())
    }

    pub fn set_style(
        &mut self,
        _node_count: usize,
        color: u32,
    ) -> Result<(), wasm_bindgen::JsValue> {
        self.ensure_live()?;
        self.color = color & 0x00ff_ffff;
        Ok(())
    }

    pub fn update_positions(
        &mut self,
        node_count: usize,
        dx: f32,
        dy: f32,
    ) -> Result<(), wasm_bindgen::JsValue> {
        self.ensure_live()?;
        for position in self.geometry.positions.iter_mut().take(node_count) {
            position[0] += dx;
            position[1] += dy;
        }
        Ok(())
    }

    pub fn resize(&mut self, width: u32, height: u32) -> Result<(), wasm_bindgen::JsValue> {
        self.ensure_live()?;
        if width == 0 || height == 0 {
            return Err(js_error("canvas dimensions must be nonzero"));
        }
        self.width = width;
        self.height = height;
        self.surface_config.width = width;
        self.surface_config.height = height;
        self.surface.configure(&self.device, &self.surface_config);
        let (target_texture, target_view) = create_target(&self.device, width, height);
        self.target_texture = target_texture;
        self.target_view = target_view;
        Ok(())
    }

    pub fn render_frame(&mut self) -> Result<usize, wasm_bindgen::JsValue> {
        let _ = &self.instance;
        self.ensure_live()?;
        let scene = build_scene_with_color(&self.geometry, self.camera, self.color);
        self.renderer
            .render_to_texture(
                &self.device,
                &self.queue,
                &scene,
                &self.target_view,
                &vello::RenderParams {
                    base_color: Color::from_rgb8(18, 21, 27),
                    width: self.width,
                    height: self.height,
                    antialiasing_method: vello::AaConfig::Area,
                },
            )
            .map_err(|error| js_error(&format!("Vello render: {error}")))?;
        let output = match self.surface.get_current_texture() {
            wgpu::CurrentSurfaceTexture::Success(output)
            | wgpu::CurrentSurfaceTexture::Suboptimal(output) => output,
            wgpu::CurrentSurfaceTexture::Timeout => return Err(js_error("WebGPU surface timeout")),
            wgpu::CurrentSurfaceTexture::Occluded => {
                return Err(js_error("WebGPU surface occluded"))
            }
            wgpu::CurrentSurfaceTexture::Outdated => {
                return Err(js_error("WebGPU surface outdated"))
            }
            wgpu::CurrentSurfaceTexture::Lost => return Err(js_error("WebGPU surface lost")),
            wgpu::CurrentSurfaceTexture::Validation => {
                return Err(js_error("WebGPU surface validation failure"))
            }
        };
        let output_view = output
            .texture
            .create_view(&wgpu::TextureViewDescriptor::default());
        let mut encoder = self
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("grapht-vello-browser-present"),
            });
        self.blitter
            .copy(&self.device, &mut encoder, &self.target_view, &output_view);
        self.queue.submit(Some(encoder.finish()));
        output.present();
        self.frame_count += 1;
        Ok(scene_encoding_units(&scene))
    }

    pub fn node_count(&self) -> usize {
        if self.disposed {
            0
        } else {
            self.geometry.node_ids.len()
        }
    }

    pub fn edge_count(&self) -> usize {
        if self.disposed {
            0
        } else {
            self.geometry.edges.len()
        }
    }

    pub fn dispose(&mut self) {
        self.geometry = Geometry {
            node_ids: vec![],
            positions: vec![],
            edges: vec![],
        };
        self.disposed = true;
    }

    fn ensure_live(&self) -> Result<(), wasm_bindgen::JsValue> {
        if self.disposed {
            Err(js_error("Vello renderer has been disposed"))
        } else {
            Ok(())
        }
    }
}

#[cfg(target_arch = "wasm32")]
fn js_error(message: &str) -> wasm_bindgen::JsValue {
    wasm_bindgen::JsValue::from_str(message)
}

#[cfg(target_arch = "wasm32")]
fn create_target(
    device: &wgpu::Device,
    width: u32,
    height: u32,
) -> (wgpu::Texture, wgpu::TextureView) {
    let texture = device.create_texture(&wgpu::TextureDescriptor {
        label: Some("grapht-vello-browser-target"),
        size: wgpu::Extent3d {
            width,
            height,
            depth_or_array_layers: 1,
        },
        mip_level_count: 1,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format: wgpu::TextureFormat::Rgba8Unorm,
        usage: wgpu::TextureUsages::STORAGE_BINDING | wgpu::TextureUsages::TEXTURE_BINDING,
        view_formats: &[],
    });
    let view = texture.create_view(&wgpu::TextureViewDescriptor::default());
    (texture, view)
}

fn build_scene_with_color(geometry: &Geometry, camera: Camera, color: u32) -> Scene {
    let mut scene = Scene::new();
    let transform = Affine::translate((camera.x, camera.y)) * Affine::scale(camera.zoom.max(0.001));
    for [a, b] in &geometry.edges {
        let Some(start) = geometry.positions.get(*a as usize) else {
            continue;
        };
        let Some(end) = geometry.positions.get(*b as usize) else {
            continue;
        };
        scene.stroke(
            &Stroke::new(1.0),
            transform,
            Color::from_rgb8(80, 92, 120),
            None,
            &Line::new(
                (start[0] as f64, start[1] as f64),
                (end[0] as f64, end[1] as f64),
            ),
        );
    }
    let red = ((color >> 16) & 0xff) as u8;
    let green = ((color >> 8) & 0xff) as u8;
    let blue = (color & 0xff) as u8;
    for position in &geometry.positions {
        scene.fill(
            Fill::NonZero,
            transform,
            Color::from_rgb8(red, green, blue),
            None,
            &Circle::new((position[0] as f64, position[1] as f64), 2.0),
        );
    }
    scene
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen]
pub async fn browser_webgpu_supported() -> bool {
    wgpu::util::is_browser_webgpu_supported().await
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn encode_geometry_scene(
    manifest_json: &str,
    node_ids_json: &str,
    edges_json: &str,
    position_bytes: &[u8],
) -> Result<usize, wasm_bindgen::JsValue> {
    let (_, geometry) = parse_geometry(manifest_json, node_ids_json, edges_json, position_bytes)
        .map_err(|message| wasm_bindgen::JsValue::from_str(&message))?;
    let scene = build_scene(&geometry, Camera::default());
    Ok(scene_encoding_units(&scene))
}
