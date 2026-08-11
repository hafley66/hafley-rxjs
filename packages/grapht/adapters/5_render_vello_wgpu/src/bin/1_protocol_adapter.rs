use std::{
    fs,
    io::{self, Read},
    path::{Path, PathBuf},
    time::Instant,
};

use grapht_render_vello_wgpu::{
    build_scene, parse_geometry, scene_counts, scene_encoding_units, Camera,
};
use serde::Deserialize;
use serde_json::json;

#[derive(Deserialize)]
struct BenchInput {
    protocol: String,
    #[serde(rename = "runId")]
    run_id: String,
    fixture: String,
    operation: String,
    #[serde(rename = "outputDirectory")]
    output_directory: String,
}

fn fixture_root(fixture: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("fixtures/geometry")
        .join(fixture)
}

fn load_fixture(fixture: &str) -> Result<grapht_render_vello_wgpu::Geometry, String> {
    let root = fixture_root(fixture);
    let manifest = fs::read_to_string(root.join("manifest.json")).map_err(|e| e.to_string())?;
    let value: serde_json::Value = serde_json::from_str(&manifest).map_err(|e| e.to_string())?;
    let node_ids =
        fs::read_to_string(root.join(value["nodeIds"].as_str().unwrap_or("nodeIds.json")))
            .map_err(|e| e.to_string())?;
    let edges = fs::read_to_string(root.join(value["edges"].as_str().unwrap_or("edges.json")))
        .map_err(|e| e.to_string())?;
    let positions =
        fs::read(root.join(value["positions"].as_str().unwrap_or("positions.f32le.bin")))
            .map_err(|e| e.to_string())?;
    parse_geometry(&manifest, &node_ids, &edges, &positions).map(|(_, geometry)| geometry)
}

fn emit(value: serde_json::Value) {
    println!("{}", serde_json::to_string(&value).unwrap());
}

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let request: BenchInput = match serde_json::from_str(input.trim()) {
        Ok(value) => value,
        Err(error) => {
            emit(
                json!({"protocol":"grapht-bench/0","type":"error","runId":"unknown","message":error.to_string()}),
            );
            std::process::exit(1);
        }
    };
    if request.protocol != "grapht-bench/0" {
        emit(
            json!({"protocol":"grapht-bench/0","type":"error","runId":request.run_id,"message":"expected grapht-bench/0"}),
        );
        std::process::exit(1);
    }
    let load = Instant::now();
    let geometry = match load_fixture(&request.fixture) {
        Ok(value) => value,
        Err(error) => {
            emit(
                json!({"protocol":"grapht-bench/0","type":"error","runId":request.run_id,"message":error}),
            );
            std::process::exit(1);
        }
    };
    let (nodes, edges) = scene_counts(&geometry);
    emit(
        json!({"protocol":"grapht-bench/0","type":"sample","runId":request.run_id,"phase":"load","startedNs":0,"endedNs":load.elapsed().as_nanos(),"counters":{"nodes":nodes,"edges":edges}}),
    );
    let scene_start = Instant::now();
    let scene = build_scene(&geometry, Camera::default());
    let encoded_bytes = scene_encoding_units(&scene);
    emit(
        json!({"protocol":"grapht-bench/0","type":"sample","runId":request.run_id,"phase":"sceneEncoding","startedNs":0,"endedNs":scene_start.elapsed().as_nanos(),"counters":{"nodes":nodes,"edges":edges,"encodedBytes":encoded_bytes}}),
    );
    let output = Path::new(&request.output_directory);
    fs::create_dir_all(output).unwrap();
    let artifact = output.join(format!("vello-{}.receipt.json", request.fixture));
    fs::write(&artifact, serde_json::to_vec_pretty(&json!({"protocol":"grapht-vello-receipt/0","implementation":"vello-wgpu","fixture":request.fixture,"operation":request.operation,"nodes":nodes,"edges":edges,"sceneEncodingBytes":encoded_bytes,"gpuProbe":"cargo run --bin 2_gpu_probe"})).unwrap()).unwrap();
    emit(
        json!({"protocol":"grapht-bench/0","type":"result","runId":request.run_id,"implementation":"vello-wgpu","operation":request.operation,"artifact":artifact,"counters":{"nodes":nodes,"edges":edges,"sceneEncodingBytes":encoded_bytes}}),
    );
}
