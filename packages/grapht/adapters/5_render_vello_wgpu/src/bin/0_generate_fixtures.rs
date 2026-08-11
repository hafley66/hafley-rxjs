use std::{fs, path::PathBuf};

fn main() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("fixtures/geometry");
    for (name, side) in [("grid-1k", 32usize), ("grid-5k", 71), ("grid-10k", 100)] {
        let node_count = side * side;
        let mut ids = Vec::with_capacity(node_count);
        for row in 0..side {
            for col in 0..side {
                ids.push(format!("n{row}_{col}"));
            }
        }
        let mut edges = Vec::<[u32; 2]>::new();
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
        let mut positions = Vec::with_capacity(node_count * 2 * 4);
        for row in 0..side {
            for col in 0..side {
                positions.extend_from_slice(&(col as f32 * 10.0).to_le_bytes());
                positions.extend_from_slice(&(row as f32 * 10.0).to_le_bytes());
            }
        }
        let dir = root.join(name);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("nodeIds.json"), serde_json::to_vec(&ids).unwrap()).unwrap();
        fs::write(dir.join("edges.json"), serde_json::to_vec(&edges).unwrap()).unwrap();
        fs::write(dir.join("positions.f32le.bin"), positions).unwrap();
        fs::write(dir.join("manifest.json"), serde_json::to_vec_pretty(&serde_json::json!({
            "protocol": "grapht-geometry/0", "nodeIds": "nodeIds.json", "positions": "positions.f32le.bin",
            "edges": "edges.json", "nodeCount": node_count, "edgeCount": edges.len(), "scalar": "f32-le"
        })).unwrap()).unwrap();
        println!("{name}\t{node_count} nodes\t{} edges", edges.len());
    }
}
