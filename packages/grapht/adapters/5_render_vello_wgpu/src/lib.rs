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
