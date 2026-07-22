use divan::{AllocProfiler, Bencher};
use futures::{StreamExt, stream};
use json_rx_map_filter_scan_proof::{
    handwritten::running_total_handwritten, pipeline::running_total,
};

#[global_allocator]
static ALLOC: AllocProfiler = AllocProfiler::system();

fn main() {
    divan::main();
}

fn inputs(input_size: usize) -> Vec<i32> {
    (0..input_size as i32).collect()
}

#[divan::bench(args = [1_000, 10_000, 100_000])]
fn generated(bencher: Bencher, input_size: usize) {
    let inputs = inputs(input_size);
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();

    bencher.bench_local(|| {
        let output = runtime
            .block_on(running_total(stream::iter(inputs.iter().copied())).collect::<Vec<_>>());
        divan::black_box(output)
    });
}

#[divan::bench(args = [1_000, 10_000, 100_000])]
fn handwritten(bencher: Bencher, input_size: usize) {
    let inputs = inputs(input_size);
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();

    bencher.bench_local(|| {
        let output = runtime.block_on(
            running_total_handwritten(stream::iter(inputs.iter().copied())).collect::<Vec<_>>(),
        );
        divan::black_box(output)
    });
}
