// Learn Vulkan — Chapter 9: Compute Shaders & GPU Workloads
(function () {
  "use strict";
  const { fmt } = L3D.math;

  L3D.topic({
    id: "VK9.1",
    summary: "Compute pipelines execute general mathematical workloads on GPU cores without the overhead of render passes, framebuffers, or rasterization hardware.",
    lesson: String.raw`
      <p><strong>Modern graphics cards are not merely triangle rasterizers; they are massively parallel supercomputers.</strong> A high-end GPU houses thousands of arithmetic logic units (ALUs) capable of performing tens of trillions of calculations per second. While traditional graphics pipelines channel this power through fixed rasterization stages, <strong>Compute Shaders</strong> allow executing arbitrary algorithms directly on the GPU.</p>
      <div class="key"><p>A <strong>Compute Pipeline</strong> in Vulkan operates completely independently of the graphics pipeline. It has NO render passes, NO framebuffers, NO vertex assembly, NO rasterizer, and NO blend states. It consists solely of a <code>VkPipelineLayout</code> and a single compute shader stage (<code>VK_SHADER_STAGE_COMPUTE_BIT</code>).</p></div>

      <h2 data-sub="VK9.1.1">General purpose computing on GPU</h2>
      <p>Compute shaders (often referred to as GPGPU: General-Purpose Computing on Graphics Processing Units) power critical real-time features in modern game engines and simulations:</p>
      <ul>
        <li><strong>Particle Systems:</strong> Simulating millions of physics particles with collisions, gravity, and vortex forces.</li>
        <li><strong>Geometry Culling:</strong> GPU frustum and occlusion culling before draw calls are generated (GPU-driven rendering).</li>
        <li><strong>Image Processing:</strong> Bloom, blur, depth of field, tone mapping, and temporal anti-aliasing (TAA).</li>
        <li><strong>Physics & AI:</strong> Cloth simulation, rigid body physics, ragdoll constraints, and neural network inference.</li>
      </ul>

      <h2 data-sub="VK9.1.2">Graphics vs Compute pipeline separation</h2>
      <p>Because compute has no fixed-function baggage, creating a compute pipeline with <code>vkCreateComputePipelines</code> requires filling out only a single concise struct: <code>VkComputePipelineCreateInfo</code>:</p>
      <pre><code>VkComputePipelineCreateInfo pipelineInfo{};
pipelineInfo.sType = VK_STRUCTURE_TYPE_COMPUTE_PIPELINE_CREATE_INFO;
pipelineInfo.layout = computePipelineLayout;
pipelineInfo.stage = computeShaderStageInfo;

vkCreateComputePipelines(device, VK_NULL_HANDLE, 1, &pipelineInfo, nullptr, &computePipeline);</code></pre>
      <p>Compare this to the 10+ extensive structures required to bake a graphics pipeline!</p>

      <h2 data-sub="VK9.1.3">Compute queue families</h2>
      <p>Many physical GPUs provide dedicated <strong>Asynchronous Compute Queues</strong> (queried by checking for <code>VK_QUEUE_COMPUTE_BIT</code> without <code>VK_QUEUE_GRAPHICS_BIT</code>):</p>
      <ul>
        <li><strong>Async Compute:</strong> Heavy compute workloads (such as particle physics or ambient occlusion) can execute in the background on an async compute queue concurrently while the graphics queue is busy rasterizing shadow maps or depth pre-passes!</li>
        <li><strong>Zero Bubble Stalls:</strong> Async compute fills idle GPU arithmetic units that would otherwise wait on memory latency during graphics passes, boosting overall GPU throughput by <strong>15% to 30%</strong> in AAA games.</li>
      </ul>
      <p><a class="btn goto-sim" href="#/VK9.1/sim">Try it: compare compute pipeline vs graphics pipeline architecture →</a></p>
    `,
    keyFormulas: [
      ["Compute pipeline creation", String.raw`\text{vkCreateComputePipelines}(\text{device}, \text{cache}, 1, \&\text{computePipelineInfo}, \text{nullptr}, \&\text{pipeline})`],
      ["Async compute concurrency", String.raw`\text{Queue}_{\text{Graphics}} \text{ (Shadows)} \;\parallel\; \text{Queue}_{\text{Compute}} \text{ (Particles/Physics)}`],
    ],
    exercises: [
      { q: "Does a Vulkan compute pipeline require a VkRenderPass or VkFramebuffer?", a: "No. Compute pipelines execute general mathematical workloads with direct memory read/write access, bypassing all rasterization, render pass, and framebuffer infrastructure." },
      { q: "What is the primary benefit of an asynchronous compute queue?", a: "It allows compute tasks (like physics or post-processing) to run concurrently on idle GPU execution units while the graphics queue is busy with rasterization passes." },
      { q: "Which shader stage flag is used when creating a compute pipeline?", a: "VK_SHADER_STAGE_COMPUTE_BIT." },
    ],
    cpp: [{
      title: "Creating a Compute Pipeline in C++",
      formula: String.raw`\text{vkCreateComputePipelines}`,
      note: "<p>Bakes an immutable compute pipeline with a compute shader module.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>

VkPipeline CreateComputePipeline(VkDevice device, VkPipelineLayout layout,
                                VkShaderModule computeShaderModule)
{
    VkPipelineShaderStageCreateInfo stageInfo{};
    stageInfo.sType = VK_STRUCTURE_TYPE_PIPELINE_SHADER_STAGE_CREATE_INFO;
    stageInfo.stage = VK_SHADER_STAGE_COMPUTE_BIT;
    stageInfo.module = computeShaderModule;
    stageInfo.pName = "main";

    VkComputePipelineCreateInfo pipelineInfo{};
    pipelineInfo.sType = VK_STRUCTURE_TYPE_COMPUTE_PIPELINE_CREATE_INFO;
    pipelineInfo.layout = layout;
    pipelineInfo.stage = stageInfo;

    VkPipeline computePipeline;
    if (vkCreateComputePipelines(device, VK_NULL_HANDLE, 1, &pipelineInfo, nullptr, &computePipeline) != VK_SUCCESS) {
        throw std::runtime_error("Failed to create compute pipeline!");
    }
    return computePipeline;
}
`,
    }],
    csharp: [{
      title: "Compute Pipeline in C#",
      formula: String.raw`\text{vk.CreateComputePipelines}`,
      note: "<p>Silk.NET compute pipeline instantiation.</p>",
      code: String.raw`
using Silk.NET.Vulkan;

public static unsafe Pipeline CreateComputePipeline(Vk vk, Device device,
    PipelineLayout layout, ShaderModule computeModule)
{
    var stageInfo = new PipelineShaderStageCreateInfo
    {
        SType = StructureType.PipelineShaderStageCreateInfo,
        Stage = ShaderStageFlags.ComputeBit,
        Module = computeModule,
        PName = (byte*)SilkMarshal.StringToPtr("main"),
    };

    var pipelineInfo = new ComputePipelineCreateInfo
    {
        SType = StructureType.ComputePipelineCreateInfo,
        Layout = layout,
        Stage = stageInfo,
    };

    Pipeline pipeline;
    if (vk.CreateComputePipelines(device, default, 1, ref pipelineInfo, null, out pipeline) != Result.Success)
        throw new System.Exception("Failed to create compute pipeline!");

    return pipeline;
}
`,
    }],
    sims: [{ title: "Compute pipeline vs graphics pipeline architecture", help: "<p>Compare the streamlined compute pipeline (1 shader stage, direct memory writes) with the multi-stage graphics rendering pipeline.</p>", mount: simComputeVsGraphics }],
  });

  L3D.topic({
    id: "VK9.2",
    summary: "Compute tasks are dispatched as a 3D grid of workgroups, each executing parallel local invocations mapped by gl_GlobalInvocationID.",
    lesson: String.raw`
      <p><strong>A compute shader is not invoked for individual vertices or pixels.</strong> Instead, compute workloads are dispatched over an abstract multi-dimensional grid of parallel threads called <strong>Invocations</strong>.</p>
      <div class="key"><p>Vulkan organizes compute execution into a two-level hierarchy: <strong>Workgroups</strong> (macro-blocks scheduled across GPU compute cores) and <strong>Invocations</strong> (individual threads within each workgroup that can share fast on-chip memory).</p></div>

      <h2 data-sub="VK9.2.1">Workgroup grid & local sizes</h2>
      <p>Inside the GLSL compute shader, you declare the dimensions of a single local workgroup:</p>
      <pre><code>layout(local_size_x = 256, local_size_y = 1, local_size_z = 1) in;</code></pre>
      <p>This tells the GPU hardware that each workgroup contains 256 parallel threads. For 2D image processing, local sizes are typically square (e.g. <code>local_size_x = 16, local_size_y = 16</code>, equaling 256 threads per workgroup).</p>
      <p>Threads inside the same workgroup can communicate through ultra-fast on-chip SRAM using the <code>shared</code> keyword and synchronize execution using the <code>barrier()</code> intrinsic.</p>

      <h2 data-sub="VK9.2.2">gl_GlobalInvocationID</h2>
      <p>Each invocation receives built-in variables from the hardware to identify its coordinate in the grid:</p>
      <ul>
        <li><code>gl_WorkGroupID</code>: The 3D index of this workgroup within the global dispatch grid.</li>
        <li><code>gl_LocalInvocationID</code>: The 3D index of this thread inside its local workgroup.</li>
        <li><code>gl_GlobalInvocationID</code>: The unique global coordinate across the entire dispatch:
          <pre><code>gl_GlobalInvocationID = gl_WorkGroupID * gl_WorkGroupSize + gl_LocalInvocationID;</code></pre>
        </li>
      </ul>
      <p>For a 1D particle array, <code>uint index = gl_GlobalInvocationID.x;</code> gives the exact array index of the particle this thread is responsible for updating.</p>

      <h2 data-sub="VK9.2.3">vkCmdDispatch</h2>
      <p>To launch compute execution, call <code>vkCmdDispatch</code> in your command buffer:</p>
      <pre><code>vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_COMPUTE, computePipeline);
vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_COMPUTE, computePipelineLayout,
                        0, 1, &computeDescriptorSet, 0, nullptr);

// Dispatch 4096 particles with local_size_x = 256: 4096 / 256 = 16 workgroups
vkCmdDispatch(commandBuffer, 16, 1, 1);</code></pre>
      <p>The total number of parallel threads launched is \(16 \times 256 = 4,096\). All 4,096 threads execute concurrently across the GPU's compute units!</p>
      <p><a class="btn goto-sim" href="#/VK9.2/sim">Try it: explore workgroup grid dispatching and thread IDs →</a></p>
    `,
    keyFormulas: [
      ["Global thread index", String.raw`\text{gl\_GlobalInvocationID} = \text{gl\_WorkGroupID} \times \text{gl\_WorkGroupSize} + \text{gl\_LocalInvocationID}`],
      ["Workgroup count calculation", String.raw`G_x = \left\lceil \frac{N_{\text{elements}}}{L_x} \right\rceil = \frac{N + L_x - 1}{L_x}`],
    ],
    exercises: [
      { q: "If you have 10,000 particles and local_size_x = 256, how many workgroups must you dispatch?", a: "ceil(10,000 / 256) = 40 workgroups. In the shader, add 'if (index >= 10000) return;' to guard against out-of-bounds threads." },
      { q: "What is shared memory in a compute shader?", a: "Fast, on-chip SRAM shared exclusively among invocations in the same workgroup, synchronized with barrier()." },
      { q: "What pipeline bind point is used when binding compute pipelines and descriptor sets?", a: "VK_PIPELINE_BIND_POINT_COMPUTE." },
    ],
    cpp: [{
      title: "Recording vkCmdDispatch in C++",
      formula: String.raw`\text{vkCmdDispatch}(\text{cmd}, G_x, G_y, G_z)`,
      note: "<p>Binds compute pipeline and dispatches a 1D grid of workgroups.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>

void RecordComputeCommands(VkCommandBuffer cmd, VkPipeline computePipeline,
                           VkPipelineLayout layout, VkDescriptorSet descriptorSet,
                           uint32_t particleCount)
{
    vkCmdBindPipeline(cmd, VK_PIPELINE_BIND_POINT_COMPUTE, computePipeline);
    vkCmdBindDescriptorSets(cmd, VK_PIPELINE_BIND_POINT_COMPUTE, layout, 0, 1, &descriptorSet, 0, nullptr);

    // Ceiling division for workgroup count with local_size_x = 256
    uint32_t groupCountX = (particleCount + 255) / 256;
    vkCmdDispatch(cmd, groupCountX, 1, 1);
}
`,
    }],
    csharp: [{
      title: "Compute Dispatch in C#",
      formula: String.raw`\text{vk.CmdDispatch}`,
      note: "<p>Silk.NET compute dispatch command recording.</p>",
      code: String.raw`
using Silk.NET.Vulkan;

public static unsafe void DispatchCompute(Vk vk, CommandBuffer cmd, Pipeline pipeline,
    PipelineLayout layout, DescriptorSet set, uint totalItems)
{
    vk.CmdBindPipeline(cmd, PipelineBindPoint.Compute, pipeline);
    vk.CmdBindDescriptorSets(cmd, PipelineBindPoint.Compute, layout, 0, 1, ref set, 0, null);

    uint groupsX = (totalItems + 255) / 256;
    vk.CmdDispatch(cmd, groupsX, 1, 1);
}
`,
    }],
    sims: [{ title: "Workgroup grid & invocation coordinate visualizer", help: "<p>Adjust workgroup count and local invocation sizes. Hover over grid cells to see how gl_WorkGroupID and gl_LocalInvocationID combine into gl_GlobalInvocationID.</p>", mount: simWorkgroupDispatch }],
  });

  L3D.topic({
    id: "VK9.3",
    summary: "Shader Storage Buffer Objects (SSBO) allow compute shaders to read and write arbitrary arrays of data, which can then be directly drawn by graphics pipelines.",
    lesson: String.raw`
      <p><strong>Uniform buffers are read-only and capped at tiny capacities (typically 64 KB).</strong> When running physics simulations, compute shaders must read current particle positions and write updated positions back to GPU memory.</p>
      <div class="key"><p><strong>Shader Storage Buffer Objects (SSBO):</strong> SSBOs enable shaders to both <strong>read and write</strong> unbounded arrays of structured data directly in device-local memory. Crucially, a single buffer can serve as an SSBO during compute and as a Vertex Buffer during graphics rendering!</p></div>

      <h2 data-sub="VK9.3.1">Arbitrary read/write GPU buffers</h2>
      <p>In GLSL, SSBOs are declared using the <code>buffer</code> keyword with the <code>std430</code> memory qualifier:</p>
      <pre><code>struct Particle {
    vec2 position;
    vec2 velocity;
    vec4 color;
};

layout(std430, binding = 0) readonly buffer ParticlesIn {
    Particle particlesIn[];
};

layout(std430, binding = 1) buffer ParticlesOut {
    Particle particlesOut[];
};</code></pre>
      <p>Notice the <code>std430</code> qualifier: unlike the rigid 16-byte rules of <code>std140</code> in uniform buffers, <code>std430</code> tightly packs arrays of scalars and <code>vec2</code>s without wasting padding space!</p>

      <h2 data-sub="VK9.3.2">Dual buffer usage flags</h2>
      <p>To simulate particles on the GPU and immediately draw them without copying bytes back to the CPU, we create the buffer with dual usage flags:</p>
      <pre><code>VkBufferCreateInfo bufferInfo{};
bufferInfo.sType = VK_STRUCTURE_TYPE_BUFFER_CREATE_INFO;
bufferInfo.size = sizeof(Particle) * PARTICLE_COUNT;
bufferInfo.usage = VK_BUFFER_USAGE_STORAGE_BUFFER_BIT |
                   VK_BUFFER_USAGE_VERTEX_BUFFER_BIT |
                   VK_BUFFER_USAGE_TRANSFER_DST_BIT;
bufferInfo.sharingMode = VK_SHARING_MODE_EXCLUSIVE;</code></pre>
      <p>This allows the compute shader to update particle positions via <code>STORAGE_BUFFER_BIT</code>, and the graphics pipeline to immediately pass the buffer into <code>vkCmdBindVertexBuffers</code> via <code>VERTEX_BUFFER_BIT</code>!</p>

      <h2 data-sub="VK9.3.3">GPU particle simulation</h2>
      <p>Inside the compute shader, each parallel thread updates one particle:</p>
      <pre><code>void main() {
    uint index = gl_GlobalInvocationID.x;
    if (index >= PARTICLE_COUNT) return;

    Particle p = particlesIn[index];
    p.position += p.velocity * deltaTime;

    // Bounce off window boundaries
    if (p.position.x < -1.0 || p.position.x > 1.0) p.velocity.x *= -1.0;
    if (p.position.y < -1.0 || p.position.y > 1.0) p.velocity.y *= -1.0;

    particlesOut[index] = p;
}</code></pre>
      <p>The entire physics simulation runs in parallel on the GPU at thousands of frames per second with zero CPU overhead!</p>
      <p><a class="btn goto-sim" href="#/VK9.3/sim">Try it: run an interactive GPU particle simulation →</a></p>
    `,
    keyFormulas: [
      ["Euler physics integration", String.raw`\mathbf{x}_{t+1} = \mathbf{x}_t + \mathbf{v}_t \cdot \Delta t, \quad \mathbf{v}_{t+1} = \mathbf{v}_t + \mathbf{a} \cdot \Delta t`],
      ["Dual buffer usage", String.raw`\text{usage} = \text{VK\_BUFFER\_USAGE\_STORAGE\_BUFFER\_BIT} \mid \text{VK\_BUFFER\_USAGE\_VERTEX\_BUFFER\_BIT}`],
    ],
    exercises: [
      { q: "What memory layout qualifier is typically used for SSBOs in GLSL?", a: "std430, which allows tighter packing of arrays and structures than std140." },
      { q: "Why are dual buffer usage flags useful in particle simulations?", a: "They allow the compute shader to write updated particle positions to the buffer, which the graphics pipeline can then bind directly as a vertex buffer without any CPU copy." },
      { q: "What is the maximum capacity of an SSBO compared to a UBO?", a: "UBOs are typically limited to 64 KB, while SSBOs can be gigabytes in size (up to the device's maxStorageBufferRange, often several GBs)." },
    ],
    cpp: [{
      title: "Creating Dual-Usage SSBO Buffers in C++",
      formula: String.raw`\text{CreateBuffer}(\text{STORAGE\_BIT} \mid \text{VERTEX\_BIT})`,
      note: "<p>Allocates device-local buffers suitable for both compute writing and vertex drawing.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>
#include <glm/glm.hpp>
#include <vector>

struct Particle {
    glm::vec2 position;
    glm::vec2 velocity;
    glm::vec4 color;
};

void CreateShaderStorageBuffers(VkDevice device, VkPhysicalDevice physicalDevice,
                               VkCommandPool commandPool, VkQueue graphicsQueue,
                               uint32_t particleCount,
                               std::vector<VkBuffer>& outBuffers,
                               std::vector<VkDeviceMemory>& outMemory)
{
    VkDeviceSize bufferSize = sizeof(Particle) * particleCount;

    // Initialize particles on CPU...
    std::vector<Particle> particles(particleCount);
    // populate positions, velocities, colors...

    // Create staging buffer to upload initial particle states...
    VkBuffer stagingBuffer;
    VkDeviceMemory stagingMemory;
    CreateBuffer(device, physicalDevice, bufferSize,
                 VK_BUFFER_USAGE_TRANSFER_SRC_BIT,
                 VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT,
                 stagingBuffer, stagingMemory);

    void* data;
    vkMapMemory(device, stagingMemory, 0, bufferSize, 0, &data);
    memcpy(data, particles.data(), (size_t)bufferSize);
    vkUnmapMemory(device, stagingMemory);

    outBuffers.resize(2);
    outMemory.resize(2);

    for (size_t i = 0; i < 2; i++) {
        CreateBuffer(device, physicalDevice, bufferSize,
                     VK_BUFFER_USAGE_STORAGE_BUFFER_BIT |
                     VK_BUFFER_USAGE_VERTEX_BUFFER_BIT |
                     VK_BUFFER_USAGE_TRANSFER_DST_BIT,
                     VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT,
                     outBuffers[i], outMemory[i]);

        CopyBuffer(device, commandPool, graphicsQueue, stagingBuffer, outBuffers[i], bufferSize);
    }

    vkDestroyBuffer(device, stagingBuffer, nullptr);
    vkFreeMemory(device, stagingMemory, nullptr);
}
`,
    }],
    csharp: [{
      title: "Dual Usage SSBO in C#",
      formula: String.raw`\text{BufferUsageFlags.StorageBufferBit} \mid \text{VertexBufferBit}`,
      note: "<p>Silk.NET particle SSBO setup.</p>",
      code: String.raw`
using Silk.NET.Vulkan;
using System.Runtime.InteropServices;
using System.Numerics;

[StructLayout(LayoutKind.Sequential)]
public struct Particle
{
    public Vector2 Position;
    public Vector2 Velocity;
    public Vector4 Color;
}

public static void CreateSsbo(Vk vk, Device device, PhysicalDevice physDevice,
    uint count, out Silk.NET.Vulkan.Buffer buffer, out DeviceMemory memory)
{
    ulong size = (ulong)(Marshal.SizeOf<Particle>() * count);
    var usage = BufferUsageFlags.StorageBufferBit |
                BufferUsageFlags.VertexBufferBit |
                BufferUsageFlags.TransferDstBit;

    CreateBuffer(vk, device, physDevice, size, usage, MemoryPropertyFlags.DeviceLocalBit,
                 out buffer, out memory);
}
`,
    }],
    sims: [{ title: "Interactive GPU particle compute simulation", help: "<p>Simulate thousands of particles executing Euler physics in real time. Adjust gravity, speed, and particle counts to see the GPU compute simulation at 60 FPS.</p>", mount: simGpuParticles }],
  });

  L3D.topic({
    id: "VK9.4",
    summary: "Semaphores and pipeline barriers synchronize compute writing with graphics rendering, using ping-pong buffers to prevent read-after-write hazards.",
    lesson: String.raw`
      <p><strong>When compute shaders write to memory that graphics pipelines read, race conditions are catastrophic.</strong> If the graphics rasterizer begins reading the vertex buffer while the compute shader is still calculating velocities, fragments will read half-written memory, causing flickering and crashes.</p>
      <div class="key"><p>This classic hazard is called a <strong>Read-After-Write (RAW) hazard</strong>. Vulkan resolves it using two coordinated synchronization mechanisms: <strong>Ping-Pong Double Buffering</strong> and <strong>Pipeline Barriers / Queue Semaphores</strong>.</p></div>

      <h2 data-sub="VK9.4.1">Read-after-write hazards</h2>
      <p>A single buffer cannot be safely read by graphics while being written by compute. The solution is <strong>Ping-Pong Buffering</strong>:</p>
      <ul>
        <li>Frame \(N\): Compute reads from Buffer A and writes updated particles into Buffer B. Simultaneously or sequentially, Graphics draws the particles from Buffer B.</li>
        <li>Frame \(N+1\): Compute reads from Buffer B and writes into Buffer A. Graphics draws from Buffer A.</li>
      </ul>
      <p>The input and output roles alternate on every frame, eliminating race conditions completely.</p>

      <h2 data-sub="VK9.4.2">Compute-graphics semaphore synchronization</h2>
      <p>If compute commands and graphics commands execute on different queues, we synchronize them using a <code>VkSemaphore</code>:</p>
      <ol>
        <li>Submit compute command buffer to the compute queue, signaling <code>computeFinishedSemaphore</code> upon completion.</li>
        <li>Submit graphics command buffer to the graphics queue, with <code>waitSemaphores</code> including <code>computeFinishedSemaphore</code> at <code>VK_PIPELINE_STAGE_VERTEX_INPUT_BIT</code>.</li>
      </ol>
      <p>The graphics queue will wait until compute writes are complete before fetching vertices.</p>

      <h2 data-sub="VK9.4.3">Pipelined particle drawing</h2>
      <p>If compute and graphics share the same queue, synchronization is handled within the command buffer via a <code>VkBufferMemoryBarrier</code>:</p>
      <pre><code>VkBufferMemoryBarrier barrier{};
barrier.sType = VK_STRUCTURE_TYPE_BUFFER_MEMORY_BARRIER;
barrier.srcAccessMask = VK_ACCESS_SHADER_WRITE_BIT;
barrier.dstAccessMask = VK_ACCESS_VERTEX_ATTRIBUTE_READ_BIT;
barrier.srcQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
barrier.dstQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
barrier.buffer = shaderStorageBuffers[currentFrame];
barrier.offset = 0;
barrier.size = VK_WHOLE_SIZE;

vkCmdPipelineBarrier(commandBuffer,
                     VK_PIPELINE_STAGE_COMPUTE_SHADER_BIT,
                     VK_PIPELINE_STAGE_VERTEX_INPUT_BIT,
                     0, 0, nullptr, 1, &barrier, 0, nullptr);</code></pre>
      <p>This single barrier tells the GPU to flush compute write caches and prepare the vertex input units to read the newly calculated particle positions.</p>
      <div class="game">This compute-to-graphics pipeline pattern powers modern GPU weather systems, ocean waves, snow accumulation, and dense grass blades in titles like Ghost of Tsushima and Horizon Forbidden West.</div>
      <p><a class="btn goto-sim" href="#/VK9.4/sim">Try it: trace compute-graphics queue synchronization and ping-pong buffers →</a></p>
    `,
    keyFormulas: [
      ["Compute-to-Vertex barrier", String.raw`\text{COMPUTE\_SHADER\_BIT} \xrightarrow[\text{SHADER\_WRITE} \to \text{VERTEX\_READ}]{\text{BufferMemoryBarrier}} \text{VERTEX\_INPUT\_BIT}`],
      ["Queue semaphore chain", String.raw`\text{Queue}_{\text{Compute}} \xrightarrow{\text{signal}} \text{Sem}_{\text{compute}} \xrightarrow{\text{wait at VERTEX\_INPUT}} \text{Queue}_{\text{Graphics}}`],
    ],
    exercises: [
      { q: "What is a Read-After-Write (RAW) hazard in Vulkan?", a: "A condition where a reading stage (e.g. vertex input) accesses memory before a writing stage (e.g. compute shader) finishes writing, producing corrupted or flickering data." },
      { q: "How do ping-pong buffers prevent race conditions?", a: "By alternating between two buffers: compute reads buffer A and writes buffer B, then swaps roles on the next frame, ensuring compute and graphics never touch the same buffer simultaneously." },
      { q: "At what pipeline stage does the graphics queue wait on computeFinishedSemaphore?", a: "VK_PIPELINE_STAGE_VERTEX_INPUT_BIT, ensuring vertex shaders only read data after compute has finished writing." },
    ],
    cpp: [{
      title: "Compute & Graphics Pipeline Synchronization in C++",
      formula: String.raw`\text{vkCmdPipelineBarrier}(\text{COMPUTE\_BIT} \to \text{VERTEX\_INPUT\_BIT})`,
      note: "<p>Inserts a buffer memory barrier synchronizing compute writes with vertex reads.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>

void RecordComputeGraphicsSync(VkCommandBuffer cmd, VkBuffer particleBuffer) {
    VkBufferMemoryBarrier barrier{};
    barrier.sType = VK_STRUCTURE_TYPE_BUFFER_MEMORY_BARRIER;
    barrier.srcAccessMask = VK_ACCESS_SHADER_WRITE_BIT;
    barrier.dstAccessMask = VK_ACCESS_VERTEX_ATTRIBUTE_READ_BIT;
    barrier.srcQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
    barrier.dstQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
    barrier.buffer = particleBuffer;
    barrier.offset = 0;
    barrier.size = VK_WHOLE_SIZE;

    vkCmdPipelineBarrier(
        cmd,
        VK_PIPELINE_STAGE_COMPUTE_SHADER_BIT,
        VK_PIPELINE_STAGE_VERTEX_INPUT_BIT,
        0,
        0, nullptr,
        1, &barrier,
        0, nullptr
    );
}
`,
    }],
    csharp: [{
      title: "Buffer Memory Barrier in C#",
      formula: String.raw`\text{vk.CmdPipelineBarrier}`,
      note: "<p>Silk.NET compute-to-vertex memory barrier execution.</p>",
      code: String.raw`
using Silk.NET.Vulkan;

public static unsafe void SyncComputeToGraphics(Vk vk, CommandBuffer cmd, Silk.NET.Vulkan.Buffer buffer)
{
    var barrier = new BufferMemoryBarrier
    {
        SType = StructureType.BufferMemoryBarrier,
        SrcAccessMask = AccessFlags.ShaderWriteBit,
        DstAccessMask = AccessFlags.VertexAttributeReadBit,
        SrcQueueFamilyIndex = Vk.QueueFamilyIgnored,
        DstQueueFamilyIndex = Vk.QueueFamilyIgnored,
        Buffer = buffer,
        Offset = 0,
        Size = Vk.WholeSize,
    };

    vk.CmdPipelineBarrier(cmd,
        PipelineStageFlags.ComputeShaderBit,
        PipelineStageFlags.VertexInputBit,
        0, 0, null, 1, ref barrier, 0, null);
}
`,
    }],
    sims: [{ title: "Compute-graphics queue sync & ping-pong timeline", help: "<p>Follow the execution flow from compute dispatch to semaphore signaling and vertex drawing. Observe how ping-pong buffers alternate roles each frame.</p>", mount: simComputeSync }],
  });

  // ------------------------------------------------------------ Simulations
  function simComputeVsGraphics(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const pipelineSel = sim.segmented(controls, { label: "Pipeline Architecture", options: [["compute", "Compute Pipeline (Lean)"], ["graphics", "Graphics Pipeline (Full)"]], value: "compute", onChange: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const isComp = pipelineSel.value === "compute";

      if (isComp) {
        // Lean Compute Pipeline
        view.rect([-4.5, 0.4], [4.5, 3.2], { color: "g", fill: "g", fillAlpha: 0.15 });
        view.text([0, 2.8], "VkComputePipeline (Single Shader Stage)", { align: "center", color: "g", size: 13, bold: true });

        view.rect([-4.0, 1.0], [-1.0, 2.2], { color: "c", fill: "c", fillAlpha: 0.3 });
        view.text([-2.5, 1.6], "VkPipelineLayout\n(SSBO Descriptors)", { align: "center", color: "fg", size: 10, bold: true });

        view.arrow([-1.0, 1.6], [1.0, 1.6], { color: "g" });

        view.rect([1.0, 1.0], [4.0, 2.2], { color: "g", fill: "g", fillAlpha: 0.3 });
        view.text([2.5, 1.6], "Compute Shader\n(VK_SHADER_STAGE_COMPUTE)", { align: "center", color: "fg", size: 10, bold: true });

        // Benefits box
        view.rect([-4.5, -2.6], [4.5, -0.2], { color: "muted", fill: "panel", fillAlpha: 0.5 });
        view.text([-4.2, -0.6], "Why Compute Pipelines are Fast and Lightweight:", { color: "fg", size: 11, bold: true });
        view.text([-4.0, -1.1], "• ZERO Render Passes: No attachments, clear values, or store ops", { color: "g", size: 9 });
        view.text([-4.0, -1.6], "• ZERO Rasterization: No viewports, scissors, culling, or MSAA resolve", { color: "g", size: 9 });
        view.text([-4.0, -2.1], "• Runs on dedicated Async Compute Queues in parallel with rendering", { color: "a", size: 9 });
      } else {
        // Multi-stage Graphics Pipeline
        view.rect([-4.5, 0.6], [4.5, 3.2], { color: "b", fill: "b", fillAlpha: 0.12 });
        view.text([0, 2.9], "VkGraphicsPipeline (8 Fixed & Programmable Stages)", { align: "center", color: "b", size: 12, bold: true });

        const stages = ["Vertex Input", "Vertex Shader", "Rasterizer", "Frag Shader", "Depth/Blend"];
        for (let i = 0; i < stages.length; i++) {
          const x0 = -4.2 + i * 1.7;
          const x1 = x0 + 1.5;
          view.rect([x0, 1.0], [x1, 2.2], { color: "c", fill: "c", fillAlpha: 0.25 });
          view.text([(x0 + x1) / 2, 1.6], stages[i], { align: "center", color: "fg", size: 8, bold: true });
        }

        view.rect([-4.5, -2.6], [4.5, 0.0], { color: "muted", fill: "panel", fillAlpha: 0.5 });
        view.text([-4.2, -0.4], "Graphics Pipeline Requirements:", { color: "fg", size: 11, bold: true });
        view.text([-4.0, -0.9], "• Requires compatible VkRenderPass and VkFramebuffer", { color: "muted", size: 9 });
        view.text([-4.0, -1.4], "• Fixed hardware configuration: Viewport, Scissor, Depth-Stencil, MSAA, Blend", { color: "muted", size: 9 });
        view.text([-4.0, -1.9], "• Outputs exclusively to image color and depth attachments", { color: "muted", size: 9 });
      }

      out.set(sim.rows([
        ["Selected Architecture", isComp ? "Compute Pipeline" : "Graphics Pipeline"],
        ["Pipeline Stages", isComp ? "1 Stage (Compute Shader)" : "5-8 Stages (Vertex, Tess, Geo, Frag, Raster)"],
        ["Render Pass Required?", isComp ? "NO (Direct buffer writes)" : "YES (VkRenderPass + Framebuffers)"],
        ["Asynchronous Execution", isComp ? "Supported on dedicated compute queue" : "Graphics queue bound"],
      ]));
    });
  }

  function simWorkgroupDispatch(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const groups = sim.slider(controls, { label: "Workgroups (Gx)", min: 1, max: 4, step: 1, value: 2, onInput: () => v.redraw() });
    const local = sim.slider(controls, { label: "Local Size (Lx)", min: 2, max: 8, step: 2, value: 4, onInput: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const gx = groups.value;
      const lx = local.value;
      const totalThreads = gx * lx;

      view.rect([-4.5, 2.0], [4.5, 3.2], { color: "muted", fill: "panel", fillAlpha: 0.6 });
      view.text([0, 2.8], `vkCmdDispatch(${gx}, 1, 1) with layout(local_size_x = ${lx}) in;`, { align: "center", color: "fg", size: 12, bold: true });
      view.text([0, 2.3], `Total Invocations = ${gx} Workgroups × ${lx} Local Threads = ${totalThreads} Parallel Threads`, { align: "center", color: "a", size: 10 });

      // Draw Workgroups
      for (let g = 0; g < gx; g++) {
        const x0 = -4.2 + g * (8.4 / gx);
        const x1 = x0 + (8.4 / gx) - 0.2;

        view.rect([x0, 0.2], [x1, 1.6], { color: "c", fill: "c", fillAlpha: 0.15 });
        view.text([(x0 + x1) / 2, 1.4], `WorkGroup [${g}]`, { align: "center", color: "c", size: 10, bold: true });

        // Draw Invocations within Workgroup
        for (let l = 0; l < lx; l++) {
          const ix0 = x0 + 0.1 + l * ((x1 - x0 - 0.2) / lx);
          const ix1 = ix0 + ((x1 - x0 - 0.2) / lx) - 0.05;
          const globalId = g * lx + l;

          view.rect([ix0, 0.35], [ix1, 1.1], { color: "g", fill: "g", fillAlpha: 0.35 });
          view.text([(ix0 + ix1) / 2, 0.7], `${globalId}`, { align: "center", color: "fg", size: 8, bold: true });
        }
      }

      // Equation Explanation
      view.rect([-4.5, -2.6], [4.5, -0.4], { color: "panel", fill: "panel", fillAlpha: 0.6 });
      view.text([0, -0.8], "Coordinate Mapping Equation:", { align: "center", color: "fg", size: 11, bold: true });
      view.text([0, -1.3], "gl_GlobalInvocationID.x = gl_WorkGroupID.x * gl_WorkGroupSize.x + gl_LocalInvocationID.x", { align: "center", color: "a", size: 10 });
      view.text([0, -1.9], "Example: Thread #5 in WorkGroup #1 -> (1 * 4) + 1 = Global ID 5", { align: "center", color: "muted", size: 9 });

      out.set(sim.rows([
        ["Workgroups (Gx)", gx],
        ["Local Invocations (Lx)", lx],
        ["Total Threads Launched", `${totalThreads} parallel invocations`],
        ["Shared Memory Scope", "Accessible exclusively within the same WorkGroup"],
      ]));
    });
  }

  function simGpuParticles(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const countSlider = sim.slider(controls, { label: "Particle Count", min: 50, max: 200, step: 25, value: 100, onInput: () => v.redraw() });
    const speedSlider = sim.slider(controls, { label: "Speed Multiplier", min: 1, max: 5, step: 1, value: 2, onInput: () => v.redraw() });
    const out = sim.readout(readout);

    // Initial pseudo particles
    const particles = [];
    for (let i = 0; i < 200; i++) {
      particles.push({
        x: (Math.random() - 0.5) * 8.0,
        y: (Math.random() - 0.5) * 5.0,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        r: Math.random() > 0.5 ? "a" : "g",
      });
    }

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const n = countSlider.value;
      const spd = speedSlider.value;

      // Draw bounding box
      view.rect([-4.2, -2.5], [4.2, 2.5], { color: "muted", fill: "panel", fillAlpha: 0.3 });
      view.text([0, 2.2], `GPU Particle SSBO: ${n} Particles Active`, { align: "center", color: "fg", size: 11, bold: true });

      // Update and draw particles
      for (let i = 0; i < n; i++) {
        const p = particles[i];
        p.x += p.vx * spd;
        p.y += p.vy * spd;

        if (p.x < -4.0 || p.x > 4.0) p.vx *= -1;
        if (p.y < -2.3 || p.y > 2.0) p.vy *= -1;

        view.circle([p.x, p.y], 0.08, { color: p.r, fill: p.r, fillAlpha: 0.8 });
      }

      out.set(sim.rows([
        ["Active Particles", n],
        ["Memory per Particle", "32 bytes (vec2 pos, vec2 vel, vec4 col)"],
        ["SSBO Buffer Size", `${n * 32} bytes`],
        ["Pipeline", "Compute updates positions -> Graphics binds as Vertex Buffer"],
        ["Frame Rate", "60 FPS (Zero CPU overhead)"],
      ]));
    });
  }

  function simComputeSync(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const frame = sim.segmented(controls, { label: "Frame Index", options: [["0", "Frame 0 (Ping)"], ["1", "Frame 1 (Pong)"]], value: "0", onChange: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const f = frame.value;
      const isPing = f === "0";

      // Compute Queue Lane
      view.rect([-4.5, 1.2], [4.5, 3.2], { color: "c", fill: "c", fillAlpha: 0.15 });
      view.text([-4.2, 2.8], "Compute Queue (Physics Simulation)", { color: "c", size: 12, bold: true });
      view.text([-4.2, 2.0], isPing ? "Reads: Buffer A (In)  ->  Writes: Buffer B (Out)" : "Reads: Buffer B (In)  ->  Writes: Buffer A (Out)", { color: "fg", size: 10, bold: true });

      // Semaphore Handshake
      view.arrow([0, 1.2], [0, -0.4], { color: "a", label: "computeFinishedSemaphore" });

      // Graphics Queue Lane
      view.rect([-4.5, -2.6], [4.5, -0.6], { color: "g", fill: "g", fillAlpha: 0.15 });
      view.text([-4.2, -1.0], "Graphics Queue (Particle Drawing)", { color: "g", size: 12, bold: true });
      view.text([-4.2, -1.8], isPing ? "Waits on Semaphore -> Draws directly from Buffer B!" : "Waits on Semaphore -> Draws directly from Buffer A!", { color: "fg", size: 10, bold: true });

      // Ping-pong buffer status box
      view.rect([-4.5, -0.4], [-0.5, 1.0], { color: isPing ? "muted" : "g", fill: "panel", fillAlpha: 0.4 });
      view.text([-2.5, 0.4], `Buffer A: ${isPing ? "READ ONLY (Compute Input)" : "ACTIVE DRAW (Graphics Target)"}`, { align: "center", color: isPing ? "muted" : "g", size: 8 });

      view.rect([0.5, -0.4], [4.5, 1.0], { color: isPing ? "g" : "muted", fill: "panel", fillAlpha: 0.4 });
      view.text([2.5, 0.4], `Buffer B: ${isPing ? "ACTIVE DRAW (Graphics Target)" : "READ ONLY (Compute Input)"}`, { align: "center", color: isPing ? "g" : "muted", size: 8 });

      out.set(sim.rows([
        ["Current Frame", isPing ? "Frame 0 (Ping)" : "Frame 1 (Pong)"],
        ["Compute Input", isPing ? "Buffer A" : "Buffer B"],
        ["Compute Output", isPing ? "Buffer B" : "Buffer A"],
        ["Graphics Vertex Source", isPing ? "Buffer B (Freshly computed)" : "Buffer A (Freshly computed)"],
        ["Race Conditions", "NONE (Isolated Ping-Pong buffers + Queue Semaphore)"],
      ]));
    });
  }
})();
