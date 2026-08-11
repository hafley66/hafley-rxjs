use grapht_render_vello_wgpu::{
    build_scene, parse_geometry, pick_node, scene_counts, scene_encoding_units, Camera,
};

#[test]
fn parses_little_endian_geometry_and_encodes_scene() {
    let positions = [
        0f32.to_le_bytes(),
        10f32.to_le_bytes(),
        0f32.to_le_bytes(),
        0f32.to_le_bytes(),
    ]
    .concat();
    let (manifest, geometry) = parse_geometry(
        r#"{"protocol":"grapht-geometry/0","nodeIds":"nodeIds.json","positions":"positions.f32le.bin","edges":"edges.json","nodeCount":2,"edgeCount":1,"scalar":"f32-le"}"#,
        r#"["a","b"]"#,
        r#"[[0,1]]"#,
        &positions,
    ).unwrap();
    assert_eq!(manifest.node_count, 2);
    assert_eq!(scene_counts(&geometry), (2, 1));
    assert!(scene_encoding_units(&build_scene(&geometry, Camera::default())) > 0);
    assert_eq!(pick_node(&geometry, [0.0, 10.0], 1.0), Some("a"));
    assert_eq!(Camera::default().pan(1.0, 2.0).zoom(2.0).zoom, 2.0);
}
