// gothic's vello bridge: JS hands over { strokes: [{d, w, rgba}], background, width, height, zoom },
// this crate strokes them on GPU through vello into the canvas. One GPU context is cached for the page.
use std::cell::RefCell;

use serde::{Deserialize, Serialize};
use svgtypes::{PathParser, PathSegment};
use vello::kurbo::{Affine, BezPath, PathEl, Stroke};
use vello::peniko::Color;
use vello::wgpu::util::TextureBlitter;
use vello::wgpu::{
    Backends, CompositeAlphaMode, DeviceDescriptor, Extent3d, InstanceDescriptor,
    PowerPreference, PresentMode, RequestAdapterOptions, SurfaceConfiguration, SurfaceTarget,
    TextureDescriptor, TextureDimension, TextureFormat, TextureUsages, TextureViewDescriptor,
};
use vello::{AaConfig, AaSupport, RenderParams, Renderer, RendererOptions, Scene};
use wasm_bindgen::prelude::*;

#[derive(Deserialize)]
pub struct StrokeSpec {
    pub d: String,
    pub w: f64,
    pub rgba: [u8; 4],
}

#[derive(Deserialize)]
pub struct RenderSpec {
    pub strokes: Vec<StrokeSpec>,
    pub background: [u8; 4],
    pub width: u32,
    pub height: u32,
    pub zoom: f64,
}

#[derive(Serialize)]
struct Receipt {
    encode_ms: f64,
    render_ms: f64,
    strokes: usize,
    adapter: String,
}

struct Gpu {
    device: vello::wgpu::Device,
    queue: vello::wgpu::Queue,
    renderer: Renderer,
    blitter: TextureBlitter,
    surface: vello::wgpu::Surface<'static>,
    format: TextureFormat,
    adapter: String,
}

thread_local! {
    static GPU: RefCell<Option<Gpu>> = RefCell::new(None);
}

fn now_ms() -> f64 {
    web_sys::window()
        .and_then(|w| w.performance())
        .map_or(0.0, |p| p.now())
}

fn js_err(context: &str, error: impl std::fmt::Debug) -> JsValue {
    JsValue::from_str(&format!("{context}: {error:?}"))
}

// svg d-string -> BezPath; the caller lowers to M/L/C/Z first (svgpath unarc + quadratic elevation),
// so only the four absolute commands reach this parser
fn bez(d: &str) -> Result<BezPath, JsValue> {
    let mut path = BezPath::new();
    for segment in PathParser::from(d) {
        match segment.map_err(|e| js_err("svg path", e))? {
            PathSegment::MoveTo { x, y, .. } => path.push(PathEl::MoveTo((x, y).into())),
            PathSegment::LineTo { x, y, .. } => path.push(PathEl::LineTo((x, y).into())),
            PathSegment::CurveTo { x1, y1, x2, y2, x, y, .. } => {
                path.push(PathEl::CurveTo((x1, y1).into(), (x2, y2).into(), (x, y).into()))
            }
            PathSegment::ClosePath { .. } => path.push(PathEl::ClosePath),
            other => return Err(JsValue::from_str(&format!("segment must be lowered to M/L/C/Z, got {other:?}"))),
        }
    }
    Ok(path)
}

#[wasm_bindgen]
pub async fn render(canvas: web_sys::HtmlCanvasElement, spec: JsValue) -> Result<JsValue, JsValue> {
    let spec: RenderSpec = serde_wasm_bindgen::from_value(spec).map_err(|e| js_err("spec", e))?;
    let t0 = now_ms();
    let mut scene = Scene::new();
    for stroke in &spec.strokes {
        let path = bez(&stroke.d)?;
        let [r, g, b, a] = stroke.rgba;
        scene.stroke(
            &Stroke::new(stroke.w),
            Affine::scale(spec.zoom),
            Color::from_rgba8(r, g, b, a),
            None,
            &path,
        );
    }
    let encode_ms = now_ms() - t0;

    // the context is taken out of the thread-local so it can live across await points
    let t1 = now_ms();
    let taken = GPU.with(|gpu| gpu.borrow_mut().take());
    let mut gpu = match taken {
        Some(gpu) => gpu,
        None => init_gpu(canvas).await?,
    };
    let drawn = draw(&mut gpu, &scene, &spec).await;
    let adapter = gpu.adapter.clone();
    GPU.with(|slot| *slot.borrow_mut() = Some(gpu));
    drawn?;
    let receipt = Receipt {
        encode_ms,
        render_ms: now_ms() - t1,
        strokes: spec.strokes.len(),
        adapter,
    };
    serde_wasm_bindgen::to_value(&receipt).map_err(|e| js_err("receipt", e))
}

async fn init_gpu(canvas: web_sys::HtmlCanvasElement) -> Result<Gpu, JsValue> {
    let instance = vello::wgpu::Instance::new(InstanceDescriptor {
        backends: Backends::BROWSER_WEBGPU,
        ..InstanceDescriptor::new_without_display_handle()
    });
    let surface = instance
        .create_surface(SurfaceTarget::Canvas(canvas))
        .map_err(|e| js_err("surface", e))?;
    let adapter = instance
        .request_adapter(&RequestAdapterOptions {
            power_preference: PowerPreference::HighPerformance,
            compatible_surface: Some(&surface),
            force_fallback_adapter: false,
        })
        .await
        .map_err(|e| js_err("adapter", e))?;
    let (device, queue) = adapter
        .request_device(&DeviceDescriptor::default())
        .await
        .map_err(|e| js_err("device", e))?;
    let format = surface
        .get_capabilities(&adapter)
        .formats
        .first()
        .copied()
        .ok_or_else(|| JsValue::from_str("no surface format"))?;
    let renderer = Renderer::new(
        &device,
        RendererOptions {
            use_cpu: false,
            antialiasing_support: AaSupport::area_only(),
            ..Default::default()
        },
    )
    .map_err(|e| js_err("renderer", e))?;
    let blitter = TextureBlitter::new(&device, format);
    let info = adapter.get_info();
    let adapter = format!("{} · {}", info.device, info.backend);
    Ok(Gpu { device, queue, renderer, blitter, surface, format, adapter })
}

async fn draw(gpu: &mut Gpu, scene: &Scene, spec: &RenderSpec) -> Result<(), JsValue> {
    gpu.surface.configure(
        &gpu.device,
        &SurfaceConfiguration {
            usage: TextureUsages::RENDER_ATTACHMENT,
            format: gpu.format,
            width: spec.width,
            height: spec.height,
            present_mode: PresentMode::AutoVsync,
            alpha_mode: CompositeAlphaMode::Opaque,
            view_formats: vec![],
            desired_maximum_frame_latency: 2,
        },
    );
    // vello rasterizes into an Rgba8Unorm storage texture; the blitter carries it to the surface
    let texture = gpu.device.create_texture(&TextureDescriptor {
        label: Some("gothic vello target"),
        size: Extent3d { width: spec.width, height: spec.height, depth_or_array_layers: 1 },
        mip_level_count: 1,
        sample_count: 1,
        dimension: TextureDimension::D2,
        format: TextureFormat::Rgba8Unorm,
        usage: TextureUsages::STORAGE_BINDING | TextureUsages::TEXTURE_BINDING,
        view_formats: &[],
    });
    let view = texture.create_view(&TextureViewDescriptor::default());
    let [r, g, b, a] = spec.background;
    let params = RenderParams {
        base_color: Color::from_rgba8(r, g, b, a),
        width: spec.width,
        height: spec.height,
        antialiasing_method: AaConfig::Area,
    };
    gpu.renderer
        .render_to_texture(&gpu.device, &gpu.queue, scene, &view, &params)
        .map_err(|e| js_err("render_to_texture", e))?;
    let frame = match gpu.surface.get_current_texture() {
        vello::wgpu::CurrentSurfaceTexture::Success(frame) => frame,
        vello::wgpu::CurrentSurfaceTexture::Suboptimal(frame) => frame,
        missed => return Err(JsValue::from_str(&format!("surface texture: {missed:?}"))),
    };
    let mut encoder = gpu
        .device
        .create_command_encoder(&vello::wgpu::CommandEncoderDescriptor { label: None });
    gpu.blitter.copy(&gpu.device, &mut encoder, &view, &frame.texture.create_view(&TextureViewDescriptor::default()));
    gpu.queue.submit(Some(encoder.finish()));
    frame.present();
    Ok(())
}
