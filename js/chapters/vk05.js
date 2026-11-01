// Learn Vulkan — Chapter 5: Memory Management & Buffers
(function () {
  "use strict";
  const { fmt } = L3D.math;

  L3D.topic({
    id: "VK5.1",
    summary: "Vulkan exposes raw GPU memory through heaps and memory types, requiring explicit queries, allocation, and binding to buffer objects.",
    lesson: String.raw`
      <p><strong>In OpenGL, memory management was completely hidden.</strong> You called <code>glBufferData()</code>, and the driver decided where in physical RAM or VRAM to allocate memory, when to page it across the PCI-e bus, and how to manage fragmentation. While convenient, this driver black-box led to unpredictable memory spikes, paging stalls, and performance inconsistency.</p>
      <div class="key"><p>In Vulkan, creating a buffer (<code>VkBuffer</code>) does not allocate any memory. A buffer is merely a virtual handle specifying a size and usage intent. You must explicitly query memory requirements, find a compatible memory heap, allocate a <code>VkDeviceMemory</code> block, and bind them together.</p></div>

      <h2 data-sub="VK5.1.1">Memory heaps & types</h2>
      <p>A physical GPU exposes its memory architecture through a <code>VkPhysicalDeviceMemoryProperties</code> structure queried via <code>vkGetPhysicalDeviceMemoryProperties</code>:</p>
      <ul>
        <li><strong>Memory Heaps (<code>VkMemoryHeap</code>):</strong> Represent distinct physical hardware pools of memory. For example:
          <ul>
            <li>Heap 0: Dedicated on-board GPU VRAM (e.g. 8 GB GDDR6 or 16 GB HBM3).</li>
            <li>Heap 1: System RAM mapped over PCI-Express (e.g. 32 GB DDR5).</li>
          </ul>
        </li>
        <li><strong>Memory Types (<code>VkMemoryType</code>):</strong> Different ways of accessing those heaps, each with specific caching and coherence properties.</li>
      </ul>

      <h2 data-sub="VK5.1.2">Device local vs host visible</h2>
      <p>Memory types are characterized by bitwise property flags:</p>
      <table>
        <tr><th>Flag</th><th>Hardware Meaning</th><th>Primary Use Case</th></tr>
        <tr><td><code>VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT</code></td><td>High-bandwidth memory on the GPU (VRAM). Fastest access for GPU shaders.</td><td>Final vertex/index buffers, depth buffers, render targets.</td></tr>
        <tr><td><code>VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT</code></td><td>Memory that the CPU (Host) can map into its address space with <code>vkMapMemory</code>.</td><td>Staging buffers, uniform buffers updated frequently.</td></tr>
        <tr><td><code>VK_MEMORY_PROPERTY_HOST_COHERENT_BIT</code></td><td>Writes by the CPU are immediately visible to the GPU without calling <code>vkFlushMappedMemoryRanges</code>.</td><td>Frequent CPU updates without manual cache line flushes.</td></tr>
        <tr><td><code>VK_MEMORY_PROPERTY_HOST_CACHED_BIT</code></td><td>Cached on CPU. Reads by CPU are fast.</td><td>GPU-to-CPU readbacks (e.g. screenshots, AI inference).</td></tr>
      </table>

      <h2 data-sub="VK5.1.3">Memory requirements & allocation</h2>
      <p>Connecting a buffer to memory follows four mandatory steps:</p>
      <ol>
        <li><strong>Create Buffer Handle:</strong>
          <pre><code>VkBufferCreateInfo bufferInfo{};
bufferInfo.sType = VK_STRUCTURE_TYPE_BUFFER_CREATE_INFO;
bufferInfo.size = sizeof(vertices[0]) * vertices.size();
bufferInfo.usage = VK_BUFFER_USAGE_VERTEX_BUFFER_BIT;
bufferInfo.sharingMode = VK_SHARING_MODE_EXCLUSIVE;
vkCreateBuffer(device, &bufferInfo, nullptr, &vertexBuffer);</code></pre>
        </li>
        <li><strong>Query Requirements:</strong> Call <code>vkGetBufferMemoryRequirements(device, vertexBuffer, &memRequirements)</code>. This returns:
          <ul>
            <li><code>size</code>: Required allocation size in bytes (may be larger than buffer size due to hardware padding).</li>
            <li><code>alignment</code>: Required byte boundary alignment.</li>
            <li><code>memoryTypeBits</code>: A bitmask indicating which memory types support this buffer.</li>
          </ul>
        </li>
        <li><strong>Allocate Device Memory:</strong> Find a memory type index satisfying both <code>memoryTypeBits</code> and the required property flags, then call <code>vkAllocateMemory</code>.</li>
        <li><strong>Bind Memory:</strong> Call <code>vkBindBufferMemory(device, vertexBuffer, deviceMemory, 0)</code>.</li>
      </ol>
      <div class="warn">Vulkan drivers have a hard limit on the total number of simultaneous memory allocations (queried via <code>maxMemoryAllocationCount</code>, typically 4096). Production game engines never call <code>vkAllocateMemory</code> per buffer; they allocate large 128 MB blocks and sub-allocate small buffers using sub-allocator libraries like AMD VMA (Vulkan Memory Allocator).</div>
      <p><a class="btn goto-sim" href="#/VK5.1/sim">Try it: inspect Vulkan memory heaps and type properties →</a></p>
    `,
    keyFormulas: [
      ["Memory type filter predicate", String.raw`\text{match}(i) \iff (\text{typeBits} \ \& \ (1 \ll i)) \land ((\text{memProperties.types}[i].\text{flags} \ \& \ \text{flags}) == \text{flags})`],
      ["Binding to buffer", String.raw`\text{vkBindBufferMemory}(\text{device}, \text{buffer}, \text{memory}, \text{offset}) \quad (\text{offset} \equiv 0 \pmod{\text{alignment}})`],
    ],
    exercises: [
      { q: "Why doesn't vkCreateBuffer allocate GPU memory automatically?", a: "To give the developer explicit control over memory placement (VRAM vs host RAM), sub-allocation strategies, and aliasing between resources." },
      { q: "What is the difference between DEVICE_LOCAL and HOST_VISIBLE memory?", a: "DEVICE_LOCAL memory resides in ultra-fast VRAM optimized for GPU shader access, while HOST_VISIBLE memory can be mapped into the CPU's address space for direct writes." },
      { q: "Why is vkFlushMappedMemoryRanges needed if HOST_COHERENT_BIT is not set?", a: "Without host coherence, CPU cache lines must be manually flushed to system RAM to guarantee the GPU sees the newly written data." },
    ],
    cpp: [{
      title: "Finding Memory Type & Allocating Buffer in C++",
      formula: String.raw`\text{FindMemoryType} + \text{vkAllocateMemory} + \text{vkBindBufferMemory}`,
      note: "<p>Standard helper for creating a buffer and binding dedicated memory.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>
#include <stdexcept>

uint32_t FindMemoryType(VkPhysicalDevice physicalDevice, uint32_t typeFilter,
                       VkMemoryPropertyFlags properties)
{
    VkPhysicalDeviceMemoryProperties memProperties;
    vkGetPhysicalDeviceMemoryProperties(physicalDevice, &memProperties);

    for (uint32_t i = 0; i < memProperties.memoryTypeCount; i++) {
        if ((typeFilter & (1 << i)) &&
            (memProperties.memoryTypes[i].propertyFlags & properties) == properties) {
            return i;
        }
    }
    throw std::runtime_error("Failed to find suitable memory type!");
}

void CreateBuffer(VkDevice device, VkPhysicalDevice physicalDevice,
                  VkDeviceSize size, VkBufferUsageFlags usage,
                  VkMemoryPropertyFlags properties,
                  VkBuffer& outBuffer, VkDeviceMemory& outMemory)
{
    VkBufferCreateInfo bufferInfo{};
    bufferInfo.sType = VK_STRUCTURE_TYPE_BUFFER_CREATE_INFO;
    bufferInfo.size = size;
    bufferInfo.usage = usage;
    bufferInfo.sharingMode = VK_SHARING_MODE_EXCLUSIVE;

    if (vkCreateBuffer(device, &bufferInfo, nullptr, &outBuffer) != VK_SUCCESS) {
        throw std::runtime_error("Failed to create buffer!");
    }

    VkMemoryRequirements memRequirements;
    vkGetBufferMemoryRequirements(device, outBuffer, &memRequirements);

    VkMemoryAllocateInfo allocInfo{};
    allocInfo.sType = VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO;
    allocInfo.allocationSize = memRequirements.size;
    allocInfo.memoryTypeIndex = FindMemoryType(physicalDevice, memRequirements.memoryTypeBits, properties);

    if (vkAllocateMemory(device, &allocInfo, nullptr, &outMemory) != VK_SUCCESS) {
        throw std::runtime_error("Failed to allocate buffer memory!");
    }

    vkBindBufferMemory(device, outBuffer, outMemory, 0);
}
`,
    }],
    csharp: [{
      title: "Memory Allocation & Binding in C#",
      formula: String.raw`\text{vk.AllocateMemory} + \text{vk.BindBufferMemory}`,
      note: "<p>Silk.NET memory requirement query and binding.</p>",
      code: String.raw`
using Silk.NET.Vulkan;

public static unsafe void CreateBuffer(Vk vk, Device device, PhysicalDevice physDevice,
    ulong size, BufferUsageFlags usage, MemoryPropertyFlags properties,
    out Silk.NET.Vulkan.Buffer buffer, out DeviceMemory memory)
{
    var bufferInfo = new BufferCreateInfo
    {
        SType = StructureType.BufferCreateInfo,
        Size = size,
        Usage = usage,
        SharingMode = SharingMode.Exclusive,
    };

    vk.CreateBuffer(device, ref bufferInfo, null, out buffer);

    MemoryRequirements reqs;
    vk.GetBufferMemoryRequirements(device, buffer, out reqs);

    PhysicalDeviceMemoryProperties memProps;
    vk.GetPhysicalDeviceMemoryProperties(physDevice, out memProps);

    uint typeIndex = uint.MaxValue;
    for (uint i = 0; i < memProps.MemoryTypeCount; i++)
    {
        if ((reqs.MemoryTypeBits & (1 << (int)i)) != 0 &&
            (memProps.MemoryTypes[(int)i].PropertyFlags & properties) == properties)
        {
            typeIndex = i;
            break;
        }
    }

    var allocInfo = new MemoryAllocateInfo
    {
        SType = StructureType.MemoryAllocateInfo,
        AllocationSize = reqs.Size,
        MemoryTypeIndex = typeIndex,
    };

    vk.AllocateMemory(device, ref allocInfo, null, out memory);
    vk.BindBufferMemory(device, buffer, memory, 0);
}
`,
    }],
    sims: [{ title: "Vulkan memory heaps & type filter inspector", help: "<p>Select required buffer usage and memory property flags. Watch the bitmask filter evaluate across available physical GPU memory heaps.</p>", mount: simVulkanMemory }],
  });

  L3D.topic({
    id: "VK5.2",
    summary: "Staging buffers use host-visible memory to receive CPU data, which is then copied via GPU transfer commands into blazing-fast device-local VRAM.",
    lesson: String.raw`
      <p><strong>The fastest GPU memory is inaccessible to the CPU.</strong> On discrete graphics cards, dedicated VRAM (configured with <code>VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT</code>) provides hundreds of gigabytes per second of bandwidth to the GPU cores. However, the CPU cannot write to device-local memory directly over the motherboard bus.</p>
      <div class="key"><p><strong>The Staging Buffer Pattern:</strong> To get vertex or texture data into fast device-local memory, allocate a temporary CPU-writable staging buffer (<code>HOST_VISIBLE</code>), write to it with <code>memcpy</code>, and issue a GPU command (<code>vkCmdCopyBuffer</code>) to copy the bytes into device-local memory.</p></div>

      <h2 data-sub="VK5.2.1">Why staging buffers</h2>
      <p>Rendering geometry directly from <code>HOST_VISIBLE</code> memory forces the GPU to read vertex data across the PCI-Express bus on every single frame. This introduces massive memory stalls, severely capping frame rates.</p>
      <p>By using a staging buffer:</p>
      <ol>
        <li>The CPU writes to host RAM once during asset loading.</li>
        <li>The GPU's dedicated Direct Memory Access (DMA) transfer engine pulls the data across the PCI-e bus at peak bandwidth into device-local VRAM.</li>
        <li>During rendering, the GPU vertex shader reads from local VRAM at maximum speeds (e.g. 900 GB/s on GDDR6X).</li>
      </ol>

      <h2 data-sub="VK5.2.2">Single-time command buffers</h2>
      <p>Memory transfer commands are recorded into a command buffer and submitted to a queue. For one-off setup transfers, you use a <strong>single-time command buffer</strong>:</p>
      <ol>
        <li>Allocate a temporary command buffer from a pool configured with <code>VK_COMMAND_POOL_CREATE_TRANSIENT_BIT</code>.</li>
        <li>Begin recording with <code>VK_COMMAND_BUFFER_USAGE_ONE_TIME_SUBMIT_BIT</code>.</li>
        <li>Record the copy command with <code>vkCmdCopyBuffer</code>.</li>
        <li>End the buffer and submit it with <code>vkQueueSubmit</code>.</li>
        <li>Wait for the transfer to finish with <code>vkQueueWaitIdle(graphicsQueue)</code> or a fence, then free the temporary buffer with <code>vkFreeCommandBuffers</code>.</li>
      </ol>

      <h2 data-sub="VK5.2.3">vkCmdCopyBuffer</h2>
      <p>The copy operation itself is recorded using <code>vkCmdCopyBuffer</code>:</p>
      <pre><code>VkBufferCopy copyRegion{};
copyRegion.srcOffset = 0;
copyRegion.dstOffset = 0;
copyRegion.size = size;
vkCmdCopyBuffer(commandBuffer, stagingBuffer, deviceBuffer, 1, &copyRegion);</code></pre>
      <p>Once the copy finishes and the queue is idle, the staging buffer and its <code>VkDeviceMemory</code> are immediately destroyed with <code>vkDestroyBuffer</code> and <code>vkFreeMemory</code>, reclaiming system RAM.</p>
      <div class="game">Every modern 3D engine (including Unreal Engine 5 and Unity HDRP) uses staging rings to stream geometry and textures from NVMe drives into GPU VRAM in background worker threads without dropping rendering frames.</div>
      <p><a class="btn goto-sim" href="#/VK5.2/sim">Try it: trace a staging buffer transfer over the PCI-e bus →</a></p>
    `,
    keyFormulas: [
      ["Staging upload pipeline", String.raw`\text{RAM (CPU)} \xrightarrow{\text{vkMapMemory / memcpy}} \text{Staging Buffer} \xrightarrow[\text{DMA}]{\text{vkCmdCopyBuffer}} \text{VRAM (Device Local)}`],
      ["Buffer copy region", String.raw`\text{VkBufferCopy} = \langle \text{srcOffset}: 0, \text{dstOffset}: 0, \text{size}: N \text{ bytes} \rangle`],
    ],
    exercises: [
      { q: "Why shouldn't we render vertices directly from a HOST_VISIBLE buffer?", a: "Reading vertex data across the PCI-e bus on every frame creates severe memory bandwidth bottlenecks compared to reading from on-board device-local VRAM." },
      { q: "What is a single-time command buffer?", a: "A temporary command buffer recorded and submitted once (e.g. for buffer copies), then waited on and freed immediately." },
      { q: "When can the staging buffer be safely destroyed?", a: "Only after vkQueueSubmit has finished executing on the GPU (verified by waiting on a fence or vkQueueWaitIdle)." },
    ],
    cpp: [{
      title: "Staging Buffer Upload in C++",
      formula: String.raw`\text{memcpy} \to \text{vkCmdCopyBuffer} \to \text{Cleanup}`,
      note: "<p>Allocates staging buffer, copies host data, transfers to device local buffer, and cleans up.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>
#include <cstring>

void CopyBuffer(VkDevice device, VkCommandPool commandPool, VkQueue graphicsQueue,
                VkBuffer srcBuffer, VkBuffer dstBuffer, VkDeviceSize size)
{
    VkCommandBufferAllocateInfo allocInfo{};
    allocInfo.sType = VK_STRUCTURE_TYPE_COMMAND_BUFFER_ALLOCATE_INFO;
    allocInfo.level = VK_COMMAND_BUFFER_LEVEL_PRIMARY;
    allocInfo.commandPool = commandPool;
    allocInfo.commandBufferCount = 1;

    VkCommandBuffer commandBuffer;
    vkAllocateCommandBuffers(device, &allocInfo, &commandBuffer);

    VkCommandBufferBeginInfo beginInfo{};
    beginInfo.sType = VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO;
    beginInfo.flags = VK_COMMAND_BUFFER_USAGE_ONE_TIME_SUBMIT_BIT;

    vkBeginCommandBuffer(commandBuffer, &beginInfo);

    VkBufferCopy copyRegion{};
    copyRegion.srcOffset = 0;
    copyRegion.dstOffset = 0;
    copyRegion.size = size;
    vkCmdCopyBuffer(commandBuffer, srcBuffer, dstBuffer, 1, &copyRegion);

    vkEndCommandBuffer(commandBuffer);

    VkSubmitInfo submitInfo{};
    submitInfo.sType = VK_STRUCTURE_TYPE_SUBMIT_INFO;
    submitInfo.commandBufferCount = 1;
    submitInfo.pCommandBuffers = &commandBuffer;

    vkQueueSubmit(graphicsQueue, 1, &submitInfo, VK_NULL_HANDLE);
    vkQueueWaitIdle(graphicsQueue);

    vkFreeCommandBuffers(device, commandPool, 1, &commandBuffer);
}
`,
    }],
    csharp: [{
      title: "Buffer Copy in C#",
      formula: String.raw`\text{vk.CmdCopyBuffer}`,
      note: "<p>Single-time copy command execution in Silk.NET.</p>",
      code: String.raw`
using Silk.NET.Vulkan;

public static unsafe void CopyBuffer(Vk vk, Device device, CommandPool pool, Queue queue,
    Silk.NET.Vulkan.Buffer src, Silk.NET.Vulkan.Buffer dst, ulong size)
{
    var allocInfo = new CommandBufferAllocateInfo
    {
        SType = StructureType.CommandBufferAllocateInfo,
        Level = CommandBufferLevel.Primary,
        CommandPool = pool,
        CommandBufferCount = 1,
    };

    CommandBuffer cmd;
    vk.AllocateCommandBuffers(device, ref allocInfo, &cmd);

    var beginInfo = new CommandBufferBeginInfo
    {
        SType = StructureType.CommandBufferBeginInfo,
        Flags = CommandBufferUsageFlags.OneTimeSubmitBit,
    };

    vk.BeginCommandBuffer(cmd, ref beginInfo);

    var copyRegion = new BufferCopy { SrcOffset = 0, DstOffset = 0, Size = size };
    vk.CmdCopyBuffer(cmd, src, dst, 1, &copyRegion);

    vk.EndCommandBuffer(cmd);

    var submitInfo = new SubmitInfo
    {
        SType = StructureType.SubmitInfo,
        CommandBufferCount = 1,
        PCommandBuffers = &cmd,
    };

    vk.QueueSubmit(queue, 1, ref submitInfo, default);
    vk.QueueWaitIdle(queue);
    vk.FreeCommandBuffers(device, pool, 1, ref cmd);
}
`,
    }],
    sims: [{ title: "PCI-e staging buffer transfer pipeline", help: "<p>Step through the staging pattern. Trace data as it is copied from Host RAM into the staging buffer, and DMA-transferred across PCI-e into Device-Local VRAM.</p>", mount: simStagingBuffer }],
  });

  L3D.topic({
    id: "VK5.3",
    summary: "Vertex buffers store interleaved vertex attributes directly in GPU memory, and vkCmdBindVertexBuffers feeds them into graphics pipeline shaders.",
    lesson: String.raw`
      <p><strong>Hardcoded shader vertices are useless for real 3D scenes.</strong> While simple tutorial triangles can hardcode vertex positions inside GLSL arrays, complex models require streaming thousands of vertices with positions, surface normals, colors, and texture coordinates from GPU memory buffers.</p>
      <div class="key"><p>In Vulkan, vertex data is packed into a contiguous <code>VkBuffer</code> allocated with <code>VK_BUFFER_USAGE_VERTEX_BUFFER_BIT</code> and bound to the command buffer using <code>vkCmdBindVertexBuffers</code>.</p></div>

      <h2 data-sub="VK5.3.1">Vertex input bindings & attributes</h2>
      <p>To let the GPU understand your C++ vertex struct, you configure two descriptive structures during pipeline creation:</p>
      <ol>
        <li><strong>Binding Description (<code>VkVertexInputBindingDescription</code>):</strong>
          <ul>
            <li><code>binding = 0</code>: Binding slot index.</li>
            <li><code>stride = sizeof(Vertex)</code>: Byte distance between consecutive vertices.</li>
            <li><code>inputRate = VK_VERTEX_INPUT_RATE_VERTEX</code>: Advances per vertex (or per instance for instancing).</li>
          </ul>
        </li>
        <li><strong>Attribute Descriptions (<code>VkVertexInputAttributeDescription</code> array):</strong>
          <ul>
            <li>Position: <code>location = 0</code>, <code>binding = 0</code>, <code>format = VK_FORMAT_R32G32_SFLOAT</code> (2x 32-bit floats for <code>vec2</code>), <code>offset = offsetof(Vertex, pos)</code>.</li>
            <li>Color: <code>location = 1</code>, <code>binding = 0</code>, <code>format = VK_FORMAT_R32G32B32_SFLOAT</code> (3x 32-bit floats for <code>vec3</code>), <code>offset = offsetof(Vertex, color)</code>.</li>
          </ul>
        </li>
      </ol>

      <h2 data-sub="VK5.3.2">Allocating vertex buffers</h2>
      <p>The vertex buffer is created in device-local memory using the staging pattern:</p>
      <ol>
        <li>Create a staging buffer with <code>VK_BUFFER_USAGE_TRANSFER_SRC_BIT</code> and <code>HOST_VISIBLE | HOST_COHERENT</code>.</li>
        <li>Map memory: <code>vkMapMemory(device, stagingBufferMemory, 0, bufferSize, 0, &data)</code>.</li>
        <li>Copy vertices: <code>memcpy(data, vertices.data(), (size_t)bufferSize)</code>.</li>
        <li>Unmap: <code>vkUnmapMemory(device, stagingBufferMemory)</code>.</li>
        <li>Create final vertex buffer with <code>VK_BUFFER_USAGE_TRANSFER_DST_BIT | VK_BUFFER_USAGE_VERTEX_BUFFER_BIT</code> in <code>DEVICE_LOCAL</code> memory.</li>
        <li>Invoke <code>CopyBuffer</code> to transfer data via GPU DMA.</li>
        <li>Destroy the staging buffer.</li>
      </ol>

      <h2 data-sub="VK5.3.3">vkCmdBindVertexBuffers</h2>
      <p>During command buffer recording, bind the vertex buffer prior to issuing draw calls:</p>
      <pre><code>VkBuffer vertexBuffers[] = { vertexBuffer };
VkDeviceSize offsets[] = { 0 };
vkCmdBindVertexBuffers(commandBuffer, 0, 1, vertexBuffers, offsets);
vkCmdDraw(commandBuffer, static_cast<uint32_t>(vertices.size()), 1, 0, 0);</code></pre>
      <p>The GPU's vertex input unit automatically parses the interleaved stream and populates <code>layout(location = 0) in vec2 inPosition</code> and <code>layout(location = 1) in vec3 inColor</code> in the vertex shader.</p>
      <p><a class="btn goto-sim" href="#/VK5.3/sim">Try it: inspect interleaved vertex attributes and memory offsets →</a></p>
    `,
    keyFormulas: [
      ["Vertex byte stride", String.raw`\text{Stride} = \operatorname{sizeof}(\text{Vertex}) = \operatorname{sizeof}(\text{pos}) + \operatorname{sizeof}(\text{color}) = 8 + 12 = 20 \text{ bytes}`],
      ["Attribute offset mapping", String.raw`\text{pos: Offset } 0 \to \text{Loc } 0, \quad \text{color: Offset } 8 \to \text{Loc } 1`],
    ],
    exercises: [
      { q: "What does the stride parameter specify in VkVertexInputBindingDescription?", a: "The byte distance between the beginning of one vertex entry and the beginning of the next in the buffer." },
      { q: "What Vulkan format corresponds to GLSL vec3 in an attribute description?", a: "VK_FORMAT_R32G32B32_SFLOAT." },
      { q: "Can multiple vertex buffers be bound simultaneously with different bindings?", a: "Yes. vkCmdBindVertexBuffers accepts an array of buffers, allowing separate bindings for positions, normals, and UV coordinates." },
    ],
    cpp: [{
      title: "Interleaved Vertex Struct & Descriptions in C++",
      formula: String.raw`\text{BindingDescription} + \text{AttributeDescriptions}`,
      note: "<p>Defines vertex layout with glm::vec2 position and glm::vec3 color.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>
#include <glm/glm.hpp>
#include <vector>
#include <array>

struct Vertex {
    glm::vec2 pos;
    glm::vec3 color;

    static VkVertexInputBindingDescription getBindingDescription() {
        VkVertexInputBindingDescription bindingDescription{};
        bindingDescription.binding = 0;
        bindingDescription.stride = sizeof(Vertex);
        bindingDescription.inputRate = VK_VERTEX_INPUT_RATE_VERTEX;
        return bindingDescription;
    }

    static std::array<VkVertexInputAttributeDescription, 2> getAttributeDescriptions() {
        std::array<VkVertexInputAttributeDescription, 2> attributeDescriptions{};

        attributeDescriptions[0].binding = 0;
        attributeDescriptions[0].location = 0;
        attributeDescriptions[0].format = VK_FORMAT_R32G32_SFLOAT;
        attributeDescriptions[0].offset = offsetof(Vertex, pos);

        attributeDescriptions[1].binding = 0;
        attributeDescriptions[1].location = 1;
        attributeDescriptions[1].format = VK_FORMAT_R32G32B32_SFLOAT;
        attributeDescriptions[1].offset = offsetof(Vertex, color);

        return attributeDescriptions;
    }
};
`,
    }],
    csharp: [{
      title: "Vertex Layout in C#",
      formula: String.raw`\text{VertexInputAttributeDescription}`,
      note: "<p>Silk.NET vertex input setup.</p>",
      code: String.raw`
using Silk.NET.Vulkan;
using System.Runtime.InteropServices;

[StructLayout(LayoutKind.Sequential)]
public struct Vertex
{
    public float X, Y;
    public float R, G, B;

    public static VertexInputBindingDescription GetBindingDescription()
    {
        return new VertexInputBindingDescription
        {
            Binding = 0,
            Stride = (uint)Marshal.SizeOf<Vertex>(),
            InputRate = VertexInputRate.Vertex,
        };
    }
}
`,
    }],
    sims: [{ title: "Interleaved vertex memory inspector", help: "<p>Explore the byte layout of interleaved vertex structs. See how offsets and formats map raw memory to shader input locations.</p>", mount: simVertexBufferLayout }],
  });

  L3D.topic({
    id: "VK5.4",
    summary: "Index buffers eliminate vertex duplication across shared triangle edges, cutting memory consumption and activating the GPU post-transform vertex cache.",
    lesson: String.raw`
      <p><strong>A single triangle requires 3 vertices. But a simple square (quad) requires two triangles—totaling 6 vertices.</strong> In a naive vertex list, the two shared diagonal vertices must be duplicated, wasting memory and doubling vertex shader execution time.</p>
      <div class="key"><p><strong>Index Buffers:</strong> An index buffer stores an array of integer pointers pointing into the vertex buffer. A quad is represented by just <strong>4 unique vertices</strong> and an index array of <strong>6 integers</strong>: <code>{0, 1, 2, 2, 3, 0}</code>.</p></div>

      <h2 data-sub="VK5.4.1">Why index buffers</h2>
      <p>In real-world 3D models (such as game characters and terrain meshes), every vertex is typically shared by 4 to 8 adjacent triangles. Using an index buffer provides two immense advantages:</p>
      <ul>
        <li><strong>Memory Savings:</strong> A vertex struct is large (20 to 64 bytes for position, normal, tangent, UV). An index is only 2 bytes (<code>uint16_t</code>) or 4 bytes (<code>uint32_t</code>). Deduplication routinely cuts geometry memory usage by <strong>50% to 70%</strong>!</li>
        <li><strong>Post-Transform Cache:</strong> Modern GPUs feature a dedicated on-chip cache that stores the recent outputs of the vertex shader. When the rasterizer processes an index that was recently computed, it fetches the cached transformed vertex immediately, skipping vertex shader execution entirely!</li>
      </ul>

      <h2 data-sub="VK5.4.2">Creating device local index buffer</h2>
      <p>The index buffer is created using the exact same staging pattern as vertex buffers, substituting <code>VK_BUFFER_USAGE_INDEX_BUFFER_BIT</code>:</p>
      <pre><code>const std::vector<uint16_t> indices = { 0, 1, 2, 2, 3, 0 };
VkDeviceSize bufferSize = sizeof(indices[0]) * indices.size();

CreateBuffer(device, physicalDevice, bufferSize,
             VK_BUFFER_USAGE_TRANSFER_SRC_BIT,
             VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT,
             stagingBuffer, stagingBufferMemory);

// memcpy data...
CreateBuffer(device, physicalDevice, bufferSize,
             VK_BUFFER_USAGE_TRANSFER_DST_BIT | VK_BUFFER_USAGE_INDEX_BUFFER_BIT,
             VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT,
             indexBuffer, indexBufferMemory);

CopyBuffer(device, commandPool, graphicsQueue, stagingBuffer, indexBuffer, bufferSize);
// cleanup staging...</code></pre>

      <h2 data-sub="VK5.4.3">vkCmdDrawIndexed</h2>
      <p>During command buffer recording, bind the index buffer and issue an indexed draw call:</p>
      <pre><code>vkCmdBindVertexBuffers(commandBuffer, 0, 1, &vertexBuffer, offsets);
vkCmdBindIndexBuffer(commandBuffer, indexBuffer, 0, VK_INDEX_TYPE_UINT16);

// vkCmdDrawIndexed(cmd, indexCount, instanceCount, firstIndex, vertexOffset, firstInstance)
vkCmdDrawIndexed(commandBuffer, static_cast<uint32_t>(indices.size()), 1, 0, 0, 0);</code></pre>
      <p>The <code>vertexOffset</code> parameter is especially powerful: it adds a base offset to every index, allowing a single combined vertex buffer to store multiple sub-meshes without re-indexing!</p>
      <p><a class="btn goto-sim" href="#/VK5.4/sim">Try it: compare indexed vs non-indexed vertex memory and cache hits →</a></p>
    `,
    keyFormulas: [
      ["Memory savings comparison", String.raw`\text{Cost}_{\text{non-indexed}} = 6 \times \operatorname{sizeof}(\text{Vertex}), \quad \text{Cost}_{\text{indexed}} = 4 \times \operatorname{sizeof}(\text{Vertex}) + 6 \times \operatorname{sizeof}(\text{uint16})`],
      ["Indexed draw call", String.raw`\text{vkCmdDrawIndexed}(\text{cmd}, \text{indexCount}, \text{instanceCount}, \text{firstIndex}, \text{vertexOffset}, \text{firstInstance})`],
    ],
    exercises: [
      { q: "What are the two common Vulkan index types?", a: "VK_INDEX_TYPE_UINT16 (for meshes up to 65,535 vertices) and VK_INDEX_TYPE_UINT32 (for larger meshes)." },
      { q: "How does an index buffer improve GPU performance beyond saving VRAM?", a: "It enables the GPU's hardware post-transform cache, avoiding redundant vertex shader invocations on shared vertices." },
      { q: "What does the vertexOffset parameter in vkCmdDrawIndexed do?", a: "It adds a constant integer offset to every index value before fetching from the vertex buffer, enabling batching without re-indexing." },
    ],
    cpp: [{
      title: "Indexed Drawing in C++",
      formula: String.raw`\text{vkCmdBindIndexBuffer} \to \text{vkCmdDrawIndexed}`,
      note: "<p>Binds index buffer and renders geometry with shared corners.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>
#include <vector>

void DrawIndexedQuad(VkCommandBuffer cmd, VkBuffer vertexBuffer, VkBuffer indexBuffer,
                     uint32_t indexCount)
{
    VkBuffer vertexBuffers[] = { vertexBuffer };
    VkDeviceSize offsets[] = { 0 };
    vkCmdBindVertexBuffers(cmd, 0, 1, vertexBuffers, offsets);

    // Bind index buffer (16-bit unsigned indices)
    vkCmdBindIndexBuffer(cmd, indexBuffer, 0, VK_INDEX_TYPE_UINT16);

    // Render indexed triangles
    vkCmdDrawIndexed(cmd, indexCount, 1, 0, 0, 0);
}
`,
    }],
    csharp: [{
      title: "Indexed Drawing in C#",
      formula: String.raw`\text{vk.CmdDrawIndexed}`,
      note: "<p>Silk.NET indexed draw command execution.</p>",
      code: String.raw`
using Silk.NET.Vulkan;

public static unsafe void DrawIndexed(Vk vk, CommandBuffer cmd,
    Silk.NET.Vulkan.Buffer vBuffer, Silk.NET.Vulkan.Buffer iBuffer, uint indexCount)
{
    ulong offset = 0;
    vk.CmdBindVertexBuffers(cmd, 0, 1, ref vBuffer, ref offset);
    vk.CmdBindIndexBuffer(cmd, iBuffer, 0, IndexType.Uint16);
    vk.CmdDrawIndexed(cmd, indexCount, 1, 0, 0, 0);
}
`,
    }],
    sims: [{ title: "Index buffer geometry reuse & cache visualizer", help: "<p>Compare raw vertex duplication against index buffer corner sharing. Observe memory footprint reduction and vertex shader cache hits.</p>", mount: simIndexBufferReuse }],
  });

  // ------------------------------------------------------------ Simulations
  function simVulkanMemory(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const usage = sim.segmented(controls, { label: "Target Resource", options: [["vbo", "Vertex/Index Buffer"], ["staging", "Staging Buffer"], ["render_target", "Swapchain / Render Target"]], value: "vbo", onChange: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const u = usage.value;

      // Heap 0: VRAM
      view.rect([-4.5, 0.6], [4.5, 3.2], { color: "g", fill: "g", fillAlpha: 0.15 });
      view.text([-4.2, 2.9], "Memory Heap 0: Dedicated GPU VRAM (8192 MB, DEVICE_LOCAL)", { color: "g", size: 11, bold: true });

      // Heap 1: System RAM
      view.rect([-4.5, -2.6], [4.5, 0.0], { color: "a", fill: "a", fillAlpha: 0.15 });
      view.text([-4.2, -0.3], "Memory Heap 1: System RAM over PCI-e (16384 MB, HOST_VISIBLE)", { color: "a", size: 11, bold: true });

      let selHeap = 0;
      let reqFlags = "DEVICE_LOCAL";
      let memType = 0;

      if (u === "staging") {
        selHeap = 1;
        reqFlags = "HOST_VISIBLE | HOST_COHERENT";
        memType = 2;
      } else if (u === "render_target") {
        selHeap = 0;
        reqFlags = "DEVICE_LOCAL | LAZILY_ALLOCATED (Optional)";
        memType = 1;
      }

      // Memory Types inside Heap 0
      view.rect([-4.2, 1.0], [-0.5, 2.4], { color: selHeap === 0 && memType === 0 ? "g" : "muted", fill: selHeap === 0 && memType === 0 ? "g" : "panel", fillAlpha: 0.25 });
      view.text([-2.35, 1.9], "Type 0: DEVICE_LOCAL", { align: "center", color: "fg", size: 10, bold: true });
      view.text([-2.35, 1.4], "Bandwidth: ~600 GB/s (GDDR6)", { align: "center", color: "muted", size: 8 });

      view.rect([0.5, 1.0], [4.2, 2.4], { color: selHeap === 0 && memType === 1 ? "g" : "muted", fill: selHeap === 0 && memType === 1 ? "g" : "panel", fillAlpha: 0.25 });
      view.text([2.35, 1.9], "Type 1: DEVICE_LOCAL | LAZY", { align: "center", color: "fg", size: 10, bold: true });
      view.text([2.35, 1.4], "On-chip transient tile memory", { align: "center", color: "muted", size: 8 });

      // Memory Types inside Heap 1
      view.rect([-4.2, -2.2], [4.2, -0.9], { color: selHeap === 1 ? "a" : "muted", fill: selHeap === 1 ? "a" : "panel", fillAlpha: 0.25 });
      view.text([0, -1.3], "Type 2: HOST_VISIBLE | HOST_COHERENT (Heap 1)", { align: "center", color: "fg", size: 10, bold: true });
      view.text([0, -1.8], "PCI-e Bus Transfer: ~16 GB/s | CPU direct vkMapMemory writable", { align: "center", color: "a", size: 8 });

      out.set(sim.rows([
        ["Target Resource", u.toUpperCase()],
        ["Selected Memory Heap", `Heap ${selHeap} (${selHeap === 0 ? "Dedicated VRAM" : "System RAM"})`],
        ["Required Properties", reqFlags],
        ["Matched Type Index", `Memory Type #${memType}`],
        ["Direct CPU vkMapMemory?", selHeap === 1 ? "YES (Host Visible)" : "NO (Device Local Only)"],
      ]));
    });
  }

  function simStagingBuffer(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const phase = sim.slider(controls, { label: "Transfer Phase", min: 0, max: 3, step: 1, value: 1, onInput: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const p = phase.value;

      const phases = [
        { label: "1. CPU Vertex Data in Host RAM", desc: "std::vector<Vertex> in application RAM", state: "HOST_ONLY" },
        { label: "2. CPU memcpy to Staging Buffer", desc: "vkMapMemory() -> memcpy() -> vkUnmapMemory()", state: "STAGING_LOADED" },
        { label: "3. GPU DMA Transfer across PCI-e", desc: "vkCmdCopyBuffer(stagingBuffer, deviceBuffer)", state: "PCI_TRANSFER" },
        { label: "4. Device-Local VRAM Ready", desc: "Destroy staging buffer. Vertex shader reads at 600 GB/s", state: "COMPLETE" },
      ];

      const cur = phases[p];

      // Host Memory Box
      view.rect([-4.5, 1.2], [-1.5, 3.2], { color: "a", fill: "a", fillAlpha: 0.15 });
      view.text([-3.0, 2.8], "Host RAM (CPU)", { align: "center", color: "a", size: 12, bold: true });
      view.text([-3.0, 2.0], "vertices.data()\n[ x, y, r, g, b ]", { align: "center", color: "fg", size: 9 });

      // Staging Buffer Box
      view.rect([-0.8, 1.2], [1.8, 3.2], { color: p >= 1 ? "c" : "muted", fill: p >= 1 ? "c" : "panel", fillAlpha: 0.2 });
      view.text([0.5, 2.8], "Staging Buffer", { align: "center", color: "c", size: 12, bold: true });
      view.text([0.5, 2.0], p >= 1 ? "HOST_VISIBLE\nHOST_COHERENT" : "Not Allocated", { align: "center", color: "fg", size: 9 });

      // Device Local VRAM Box
      view.rect([2.5, 1.2], [4.5, 3.2], { color: p >= 3 ? "g" : "muted", fill: p >= 3 ? "g" : "panel", fillAlpha: 0.2 });
      view.text([3.5, 2.8], "Device-Local VRAM", { align: "center", color: "g", size: 12, bold: true });
      view.text([3.5, 2.0], p >= 3 ? "VERTEX_BUFFER\nDEVICE_LOCAL" : "Empty VRAM", { align: "center", color: "fg", size: 9 });

      // Arrows
      if (p >= 1) view.arrow([-1.5, 2.2], [-0.8, 2.2], { color: "a", label: "memcpy" });
      if (p >= 2) view.arrow([1.8, 2.2], [2.5, 2.2], { color: "g", label: "vkCmdCopyBuffer" });

      // Description banner
      view.rect([-4.5, -2.6], [4.5, 0.4], { color: "muted", fill: "panel", fillAlpha: 0.5 });
      view.text([0, -0.4], cur.label, { align: "center", color: "c", size: 12, bold: true });
      view.text([0, -1.1], cur.desc, { align: "center", color: "fg", size: 10 });
      view.text([0, -1.8], p === 3 ? "STAGING BUFFER SAFELY DESTROYED: ZERO VRAM OR HOST LEAKS" : "Awaiting GPU transfer completion...", { align: "center", color: p === 3 ? "g" : "muted", size: 9 });

      out.set(sim.rows([
        ["Current Phase", cur.label],
        ["PCI-e Bandwidth", "16 GB/s (Burst DMA Transfer)"],
        ["VRAM Bandwidth", "600 GB/s (Ultra-fast shader rendering)"],
        ["Staging Buffer Lifetime", p === 3 ? "Destroyed (vkFreeMemory)" : "Active"],
        ["Pipeline Status", cur.state],
      ]));
    });
  }

  function simVertexBufferLayout(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const vertexCount = sim.slider(controls, { label: "Vertex Count", min: 1, max: 4, step: 1, value: 3, onInput: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const count = vertexCount.value;

      // Stride & Offset Layout Header
      view.rect([-4.5, 2.0], [4.5, 3.2], { color: "muted", fill: "panel", fillAlpha: 0.6 });
      view.text([0, 2.8], "Interleaved Vertex: sizeof(Vertex) = 20 Bytes", { align: "center", color: "fg", size: 12, bold: true });
      view.text([0, 2.3], "Location 0: pos (vec2, 8B @ offset 0) | Location 1: color (vec3, 12B @ offset 8)", { align: "center", color: "a", size: 9 });

      // Interleaved Memory Blocks
      for (let i = 0; i < count; i++) {
        const y = 1.0 - i * 0.9;
        view.rect([-4.2, y - 0.3], [4.2, y + 0.3], { color: "b", fill: "b", fillAlpha: 0.1 });
        view.text([-3.9, y], `Vertex ${i}:`, { color: "fg", size: 10, bold: true });

        // Position field (8 bytes)
        view.rect([-2.5, y - 0.25], [-0.5, y + 0.25], { color: "a", fill: "a", fillAlpha: 0.3 });
        view.text([-1.5, y], "pos [X, Y] (8B)", { align: "center", color: "fg", size: 9, bold: true });

        // Color field (12 bytes)
        view.rect([-0.2, y - 0.25], [3.8, y + 0.25], { color: "g", fill: "g", fillAlpha: 0.3 });
        view.text([1.8, y], "color [R, G, B] (12B)", { align: "center", color: "fg", size: 9, bold: true });
      }

      out.set(sim.rows([
        ["Vertex Stride", "20 bytes"],
        ["Attribute 0 (Position)", "VK_FORMAT_R32G32_SFLOAT (Offset 0) -> Location 0"],
        ["Attribute 1 (Color)", "VK_FORMAT_R32G32B32_SFLOAT (Offset 8) -> Location 1"],
        ["Total Buffer Size", `${count * 20} bytes`],
        ["Input Rate", "VK_VERTEX_INPUT_RATE_VERTEX"],
      ]));
    });
  }

  function simIndexBufferReuse(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const mode = sim.segmented(controls, { label: "Geometry Mode", options: [["non_indexed", "Non-Indexed (6 Vertices)"], ["indexed", "Indexed (4 Vertices + 6 Indices)"]], value: "indexed", onChange: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const isIdx = mode.value === "indexed";

      // Render Quad in center
      const corners = [
        [-1.5, 0.5], // 0: Top-left
        [1.5, 0.5],  // 1: Top-right
        [1.5, -1.5], // 2: Bottom-right
        [-1.5, -1.5],// 3: Bottom-left
      ];

      view.rect([-1.5, -1.5], [1.5, 0.5], { color: "a", fill: "a", fillAlpha: 0.2 });
      view.line(corners[0], corners[2], { color: "warn", width: 2, dash: [4, 4] });

      // Draw vertices
      corners.forEach((pt, i) => {
        view.circle(pt, 0.15, { color: "g", fill: "g", fillAlpha: 0.8 });
        view.text([pt[0] + 0.25, pt[1] + 0.15], `V${i}`, { color: "fg", size: 10, bold: true });
      });

      // Stats boxes
      const vSize = 20; // 20 bytes per vertex
      const iSize = 2;  // 2 bytes per uint16 index
      const vCount = isIdx ? 4 : 6;
      const iCount = isIdx ? 6 : 0;
      const totalBytes = vCount * vSize + iCount * iSize;

      view.rect([-4.5, 1.4], [-2.0, 3.2], { color: "b", fill: "b", fillAlpha: 0.15 });
      view.text([-3.25, 2.7], isIdx ? "4 Unique Vertices" : "6 Vertices (2 Dups)", { align: "center", color: "fg", size: 10, bold: true });
      view.text([-3.25, 2.0], `${vCount * vSize} Bytes VRAM`, { align: "center", color: "b", size: 9 });

      view.rect([2.0, 1.4], [4.5, 3.2], { color: "c", fill: "c", fillAlpha: 0.15 });
      view.text([3.25, 2.7], isIdx ? "Index Buffer: 6 IDs" : "No Index Buffer", { align: "center", color: "fg", size: 10, bold: true });
      view.text([3.25, 2.0], isIdx ? "{0,1,2, 2,3,0} (12B)" : "0 Bytes", { align: "center", color: "c", size: 9 });

      view.rect([-4.5, -2.6], [4.5, -2.0], { color: isIdx ? "g" : "muted", fill: "panel", fillAlpha: 0.6 });
      view.text([0, -2.3], isIdx ? "POST-TRANSFORM CACHE ACTIVE: Shared diagonal vertices V0 & V2 calculated only ONCE!" : "NO CACHING: Diagonal vertices V0 & V2 shaded twice!", { align: "center", color: isIdx ? "g" : "warn", size: 9, bold: true });

      out.set(sim.rows([
        ["Mode", isIdx ? "Indexed (vkCmdDrawIndexed)" : "Non-Indexed (vkCmdDraw)"],
        ["Unique Vertices", vCount],
        ["Index Count", iCount],
        ["Memory Footprint", `${totalBytes} bytes (${isIdx ? "23% savings on simple quad, >60% on complex 3D meshes" : "Baseline"})`],
        ["Vertex Shader Invocations", isIdx ? "4 (With post-transform cache hit)" : "6 (Every vertex processed redundantly)"],
      ]));
    });
  }
})();
