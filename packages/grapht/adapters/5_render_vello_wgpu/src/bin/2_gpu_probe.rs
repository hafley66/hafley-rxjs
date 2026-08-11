use std::time::Instant;

fn main() {
    let instance = wgpu::Instance::default();
    let started = Instant::now();
    let adapter =
        pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions::default()));
    let Some(adapter) = adapter.ok() else {
        println!("{{\"protocol\":\"grapht-vello-gpu-probe/0\",\"status\":\"capability-failure\",\"reason\":\"no adapter returned\"}}");
        return;
    };
    let info = adapter.get_info();
    let device = pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor::default()));
    let device_status = match device {
        Ok((device, queue)) => {
            let _ = (&device, &queue);
            "ready"
        }
        Err(error) => {
            println!("{{\"protocol\":\"grapht-vello-gpu-probe/0\",\"status\":\"capability-failure\",\"stage\":\"device\",\"reason\":{:?}}}", error.to_string());
            return;
        }
    };
    println!("{{\"protocol\":\"grapht-vello-gpu-probe/0\",\"status\":\"{device_status}\",\"backend\":{:?},\"device\":{:?},\"name\":{:?},\"elapsedNs\":{}}}", info.backend, info.device, info.name, started.elapsed().as_nanos());
}
