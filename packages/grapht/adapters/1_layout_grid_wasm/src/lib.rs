//! Deterministic grid layout compiled to `wasm32-unknown-unknown`.
//!
//! The exported ABI accepts compact `u32` edge pairs and writes `f32` x/y
//! pairs. Nodes are ordered by descending undirected degree and then index.
//! The host owns all linear-memory buffers.

#![no_std]

extern crate alloc;

use alloc::alloc::{GlobalAlloc, Layout};
use alloc::vec::Vec;
use core::sync::atomic::{AtomicUsize, Ordering};

unsafe extern "C" {
    /// Symbol placed by wasm-ld at the boundary between static data and heap.
    static __heap_base: u8;
}

const PAGE_BYTES: usize = 65536;
static TOP: AtomicUsize = AtomicUsize::new(0);

fn heap_base() -> usize { unsafe { &__heap_base as *const u8 as usize } }
fn align_up(offset: usize, align: usize) -> usize { (offset + align - 1) & !(align - 1) }
fn memory_bytes() -> usize { core::arch::wasm32::memory_size::<0>() * PAGE_BYTES }
fn grow_to(end: usize) {
    let current = memory_bytes();
    if end > current {
        let pages = (end - current + PAGE_BYTES - 1) / PAGE_BYTES;
        let _ = core::arch::wasm32::memory_grow::<0>(pages);
    }
}

fn allocate_raw(size: usize, align: usize) -> *mut u8 {
    let top = TOP.load(Ordering::SeqCst);
    let start = align_up(if top == 0 { heap_base() } else { top }, align.max(8));
    let end = match start.checked_add(size) { Some(value) => value, None => return core::ptr::null_mut() };
    grow_to(end);
    TOP.store(end, Ordering::SeqCst);
    start as *mut u8
}

struct BumpAllocator;
unsafe impl GlobalAlloc for BumpAllocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 { allocate_raw(layout.size(), layout.align()) }
    unsafe fn dealloc(&self, _ptr: *mut u8, _layout: Layout) {}
}

#[global_allocator]
static ALLOCATOR: BumpAllocator = BumpAllocator;

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo<'_>) -> ! { core::arch::wasm32::unreachable() }

/// Allocate zeroed linear memory for host-owned typed arrays.
#[no_mangle]
pub extern "C" fn alloc(size: u32) -> u32 {
    let pointer = allocate_raw(size as usize, 8);
    if pointer.is_null() { return 0; }
    unsafe { core::ptr::write_bytes(pointer, 0, size as usize); }
    pointer as u32
}

/// Return the arena to its initial state between invocations.
#[no_mangle]
pub extern "C" fn reset_arena() { TOP.store(0, Ordering::SeqCst); }

/// Compute positions. `edges_ptr` contains `edge_count * 2` node indices.
#[no_mangle]
pub extern "C" fn layout(
    edges_ptr: *const u32,
    edge_count: u32,
    node_count: u32,
    pos_ptr: *mut f32,
    spacing: f32,
    margin: f32,
    requested_columns: u32,
) -> u32 {
    let edges = unsafe { core::slice::from_raw_parts(edges_ptr, (edge_count * 2) as usize) };
    let n = node_count as usize;
    let mut degree = alloc::vec![0u32; n];
    for pair in edges.chunks_exact(2) {
        let source = pair[0] as usize;
        let target = pair[1] as usize;
        if source < n { degree[source] = degree[source].saturating_add(1); }
        if target < n { degree[target] = degree[target].saturating_add(1); }
    }
    let mut order: Vec<usize> = (0..n).collect();
    order.sort_unstable_by(|a, b| degree[*b].cmp(&degree[*a]).then_with(|| a.cmp(b)));
    let columns = if requested_columns > 0 { requested_columns as usize } else { ceil_sqrt(n) }.max(1);
    let spacing = if spacing.is_finite() && spacing >= 0.0 { spacing } else { 100.0 };
    let margin = if margin.is_finite() && margin >= 0.0 { margin } else { 0.0 };
    let positions = unsafe { core::slice::from_raw_parts_mut(pos_ptr, n * 2) };
    for (rank, node) in order.into_iter().enumerate() {
        positions[node * 2] = margin + (rank % columns) as f32 * spacing;
        positions[node * 2 + 1] = margin + (rank / columns) as f32 * spacing;
    }
    node_count
}

#[no_mangle]
pub extern "C" fn positions_bytes(node_count: u32) -> u32 { node_count * 2 * core::mem::size_of::<f32>() as u32 }

fn ceil_sqrt(value: usize) -> usize {
    let mut result = 0usize;
    while result.saturating_mul(result) < value { result += 1; }
    result
}
