// Learn Vulkan — Chapter 8: Depth, Geometry & Quality
(function () {
  "use strict";
  const { fmt } = L3D.math;

  L3D.topic({
    id: "VK8.1",
    summary: "Depth buffering tests fragment distance against a dedicated Z-buffer in VRAM, guaranteeing correct 3D occlusion independent of triangle drawing order.",
    lesson: String.raw`
      <p><strong>In 2D graphics, drawing later triangles simply overwrites earlier ones.</strong> In real 3D scenes, however, geometric triangles constantly overlap, pierce each other, and rotate around the camera. Sorting thousands of 3D triangles from back to front on the CPU (the Painter's Algorithm) is computationally prohibitive and fails completely for intersecting or cyclical geometry.</p>
      <div class="key"><p><strong>Depth Buffering (Z-buffering):</strong> A depth buffer is a dedicated 2D image storing the normalized depth (\(z \in [0.0, 1.0]\)) of the closest surface rendered at each pixel. When a fragment is rasterized, its depth is tested against the depth buffer: if closer, it overwrites the color buffer and updates the depth buffer; if farther, it is discarded.</p></div>

      <h2 data-sub="VK8.1.1">Depth testing necessity</h2>
      <p>Without depth testing, drawing a 3D cube or house model produces severe visual artifacts: back walls drawn last will draw directly on top of front walls, making the model look inside-out or scrambled as the camera rotates.</p>
      <p>Depth testing works per-pixel in hardware silicon at the rasterizer level, guaranteeing mathematically flawless occlusion regardless of the order triangles are submitted to the GPU.</p>

      <h2 data-sub="VK8.1.2">Finding supported depth formats</h2>
      <p>Not all GPUs support the same depth image formats. Before creating a depth buffer, your application queries the physical device for supported formats using <code>vkGetPhysicalDeviceFormatProperties</code>:</p>
      <ul>
        <li><code>VK_FORMAT_D32_SFLOAT</code>: 32-bit floating-point depth (highest depth precision, minimal Z-fighting).</li>
        <li><code>VK_FORMAT_D32_SFLOAT_S8_UINT</code>: 32-bit float depth + 8-bit stencil.</li>
        <li><code>VK_FORMAT_D24_UNORM_S8_UINT</code>: 24-bit fixed depth + 8-bit stencil (widely supported on mobile).</li>
      </ul>
      <p>You select the candidate format that supports the <code>VK_FORMAT_FEATURE_DEPTH_STENCIL_ATTACHMENT_BIT</code> in its <code>optimalTilingFeatures</code>.</p>

      <h2 data-sub="VK8.1.3">Depth image & view setup</h2>
      <p>The depth image is created with <code>VK_IMAGE_TILING_OPTIMAL</code> and <code>VK_IMAGE_USAGE_DEPTH_STENCIL_ATTACHMENT_BIT</code> in <code>DEVICE_LOCAL</code> memory.</p>
      <p>The corresponding <code>VkImageView</code> must designate <code>VK_IMAGE_ASPECT_DEPTH_BIT</code> (plus <code>VK_IMAGE_ASPECT_STENCIL_BIT</code> if the format contains a stencil channel). Because each swapchain frame shares the same resolution, a single depth buffer can be recycled across all frames in flight (or duplicated if multiple frames execute simultaneously).</p>
      <p><a class="btn goto-sim" href="#/VK8.1/sim">Try it: test 3D triangle occlusion with and without depth buffering →</a></p>
    `,
    keyFormulas: [
      ["Depth test condition", String.raw`\text{Pass} \iff z_{\text{new}} \lt z_{\text{depthBuffer}} \quad (z \in [0.0, 1.0])`],
      ["Depth format candidate predicate", String.raw`(\text{formatProps.optimalTilingFeatures} \ \& \ \text{DEPTH\_STENCIL\_ATTACHMENT\_BIT}) \ne 0`],
    ],
    exercises: [
      { q: "Why does the Painter's Algorithm fail for 3D meshes?", a: "It requires expensive CPU sorting and cannot handle intersecting triangles or cyclical occlusions where triangle A occludes B, B occludes C, and C occludes A." },
      { q: "What is the normalized depth range in Vulkan?", a: "0.0 (near clipping plane) to 1.0 (far clipping plane)." },
      { q: "Which aspect mask is used when creating a depth image view?", a: "VK_IMAGE_ASPECT_DEPTH_BIT (plus VK_IMAGE_ASPECT_STENCIL_BIT if a stencil component is present)." },
    ],
    cpp: [{
      title: "Finding Depth Format & Creating Depth Image in C++",
      formula: String.raw`\text{FindDepthFormat} + \text{CreateImage}`,
      note: "<p>Queries physical device for supported 32-bit or 24-bit depth format.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>
#include <vector>

VkFormat FindSupportedFormat(VkPhysicalDevice physicalDevice,
                             const std::vector<VkFormat>& candidates,
                             VkImageTiling tiling, VkFormatFeatureFlags features)
{
    for (VkFormat format : candidates) {
        VkFormatProperties props;
        vkGetPhysicalDeviceFormatProperties(physicalDevice, format, &props);
        if (tiling == VK_IMAGE_TILING_OPTIMAL && (props.optimalTilingFeatures & features) == features) {
            return format;
        }
    }
    throw std::runtime_error("Failed to find supported format!");
}

VkFormat FindDepthFormat(VkPhysicalDevice physicalDevice) {
    return FindSupportedFormat(physicalDevice,
        { VK_FORMAT_D32_SFLOAT, VK_FORMAT_D32_SFLOAT_S8_UINT, VK_FORMAT_D24_UNORM_S8_UINT },
        VK_IMAGE_TILING_OPTIMAL,
        VK_FORMAT_FEATURE_DEPTH_STENCIL_ATTACHMENT_BIT);
}
`,
    }],
    csharp: [{
      title: "Querying Depth Format in C#",
      formula: String.raw`\text{vk.GetPhysicalDeviceFormatProperties}`,
      note: "<p>Silk.NET depth format validation.</p>",
      code: String.raw`
using Silk.NET.Vulkan;

public static Format FindDepthFormat(Vk vk, PhysicalDevice physDevice)
{
    Format[] candidates = { Format.D32Sfloat, Format.D32SfloatS8Uint, Format.D24UnormS8Uint };
    foreach (var format in candidates)
    {
        FormatProperties props;
        vk.GetPhysicalDeviceFormatProperties(physDevice, format, out props);
        if ((props.OptimalTilingFeatures & FormatFeatureFlags.DepthStencilAttachmentBit) != 0)
            return format;
    }
    throw new System.Exception("Failed to find supported depth format!");
}
`,
    }],
    sims: [{ title: "Depth testing & 3D occlusion visualizer", help: "<p>Toggle depth testing on and off. Observe how overlapping 3D triangles resolve correctly with Z-buffering, eliminating draw-order artifacts.</p>", mount: simDepthTesting }],
  });

  L3D.topic({
    id: "VK8.2",
    summary: "Configuring depth attachments in render passes and pipelines activates early fragment testing, discarding occluded geometry before pixel shaders run.",
    lesson: String.raw`
      <p><strong>To use depth testing during rendering, both the Render Pass and the Pipeline State must be configured.</strong> The render pass clears and transitions the depth buffer memory, while the pipeline's fixed-function depth-stencil unit compares fragments and updates the depth buffer.</p>
      <div class="key"><p>Depth testing unlocks <strong>Early Fragment Testing</strong>: modern GPUs test fragment depth <em>before</em> running the fragment shader. If a pixel is hidden behind an opaque wall, the fragment shader is never executed, saving massive GPU shading power!</p></div>

      <h2 data-sub="VK8.2.1">Depth attachment in render pass</h2>
      <p>We add a second attachment to our <code>VkRenderPass</code>:</p>
      <pre><code>VkAttachmentDescription depthAttachment{};
depthAttachment.format = depthFormat;
depthAttachment.samples = VK_SAMPLE_COUNT_1_BIT;
depthAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR;
depthAttachment.storeOp = VK_ATTACHMENT_STORE_OP_DONT_CARE; // Discard at end of frame!
depthAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
depthAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
depthAttachment.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
depthAttachment.finalLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL;

VkAttachmentReference depthAttachmentRef{};
depthAttachmentRef.attachment = 1;
depthAttachmentRef.layout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL;

subpass.pDepthStencilAttachment = &depthAttachmentRef;</code></pre>

      <h2 data-sub="VK8.2.2">Depth stencil pipeline state</h2>
      <p>In <code>VkGraphicsPipelineCreateInfo</code>, populate <code>VkPipelineDepthStencilStateCreateInfo</code>:</p>
      <ul>
        <li><code>depthTestEnable = VK_TRUE</code>: Enables testing fragment depth against the depth buffer.</li>
        <li><code>depthWriteEnable = VK_TRUE</code>: Writes the depth of passing fragments to the depth buffer.</li>
        <li><code>depthCompareOp = VK_COMPARE_OP_LESS</code>: Closer fragments pass (lower depth values).</li>
        <li><code>depthBoundsTestEnable = VK_FALSE</code>: Optional bounds clamping.</li>
      </ul>

      <h2 data-sub="VK8.2.3">Clear values & depth tests</h2>
      <p>When starting the render pass with <code>vkCmdBeginRenderPass</code>, supply two clear values:</p>
      <pre><code>std::array<VkClearValue, 2> clearValues{};
clearValues[0].color = {{0.0f, 0.0f, 0.0f, 1.0f}};
clearValues[1].depthStencil = {1.0f, 0}; // 1.0f is farthest possible depth
renderPassInfo.clearValueCount = static_cast<uint32_t>(clearValues.size());
renderPassInfo.pClearValues = clearValues.data();</code></pre>
      <p>Clearing depth to <code>1.0f</code> guarantees that any visible geometry within the frustum (with \(z < 1.0\)) will pass the <code>LESS</code> depth test.</p>
      <p><a class="btn goto-sim" href="#/VK8.2/sim">Try it: explore early vs late depth testing performance →</a></p>
    `,
    keyFormulas: [
      ["Depth clear value", String.raw`\text{ClearDepth} = 1.0 \quad (\text{Far plane maximum})`],
      ["Early Z savings", String.raw`\text{Fillrate Savings} = \frac{\text{Occluded Fragments}}{\text{Total Rasterized Fragments}} \times 100\%`],
    ],
    exercises: [
      { q: "Why is storeOp set to VK_ATTACHMENT_STORE_OP_DONT_CARE for depth attachments in standard forward rendering?", a: "Because depth buffer contents are only needed during the render pass to resolve occlusions; they are not displayed on screen, so saving them to VRAM wastes bandwidth." },
      { q: "What does depthCompareOp = VK_COMPARE_OP_LESS mean?", a: "A new fragment will pass the depth test and be drawn only if its depth value is strictly less than (closer than) the existing depth in the buffer." },
      { q: "What is Early Z testing?", a: "A hardware optimization where depth testing occurs prior to fragment shading, immediately discarding occluded pixels and avoiding expensive shader computations." },
    ],
    cpp: [{
      title: "Configuring Depth Stencil Pipeline State in C++",
      formula: String.raw`\text{VkPipelineDepthStencilStateCreateInfo}`,
      note: "<p>Enables depth testing and writing with LESS comparison operator.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>

VkPipelineDepthStencilStateCreateInfo CreateDepthStencilState() {
    VkPipelineDepthStencilStateCreateInfo depthStencil{};
    depthStencil.sType = VK_STRUCTURE_TYPE_PIPELINE_DEPTH_STENCIL_STATE_CREATE_INFO;
    depthStencil.depthTestEnable = VK_TRUE;
    depthStencil.depthWriteEnable = VK_TRUE;
    depthStencil.depthCompareOp = VK_COMPARE_OP_LESS;
    depthStencil.depthBoundsTestEnable = VK_FALSE;
    depthStencil.stencilTestEnable = VK_FALSE;
    return depthStencil;
}
`,
    }],
    csharp: [{
      title: "Depth Stencil State in C#",
      formula: String.raw`\text{PipelineDepthStencilStateCreateInfo}`,
      note: "<p>Silk.NET depth-stencil state setup.</p>",
      code: String.raw`
using Silk.NET.Vulkan;

public static PipelineDepthStencilStateCreateInfo CreateDepthState()
{
    return new PipelineDepthStencilStateCreateInfo
    {
        SType = StructureType.PipelineDepthStencilStateCreateInfo,
        DepthTestEnable = true,
        DepthWriteEnable = true,
        DepthCompareOp = CompareOp.Less,
        DepthBoundsTestEnable = false,
        StencilTestEnable = false,
    };
}
`,
    }],
    sims: [{ title: "Early vs late depth testing simulator", help: "<p>Compare early fragment rejection against late testing. Observe how occluded fragments are killed before shading, saving GPU fill-rate.</p>", mount: simEarlyDepthTest }],
  });

  L3D.topic({
    id: "VK8.3",
    summary: "Complex 3D models from OBJ files are parsed and deduplicated using hash tables, maximizing GPU post-transform vertex cache locality.",
    lesson: String.raw`
      <p><strong>Real 3D games render complex meshes containing millions of polygons.</strong> Assets authored in modeling software like Blender, Maya, or 3ds Max are exported into file formats such as Wavefront OBJ or glTF.</p>
      <div class="key"><p>In a standard OBJ file, face definitions (<code>f v/vt/vn</code>) reference coordinates independently. A naive loader that creates a vertex for every triangle corner inflates memory usage by <strong>300% to 500%</strong>. To optimize performance, we deduplicate vertices using a hash map, producing a compact vertex buffer and an index buffer.</p></div>

      <h2 data-sub="VK8.3.1">Loading OBJ models</h2>
      <p>The standard C++ library for loading OBJ meshes is <strong>tinyobjloader</strong> (<code>tiny_obj_loader.h</code>). It parses vertex positions, texture coordinates, and surface normals into unified attribute lists.</p>
      <pre><code>tinyobj::attrib_t attrib;
std::vector<tinyobj::shape_t> shapes;
std::vector<tinyobj::material_t> materials;
std::string warn, err;

tinyobj::LoadObj(&attrib, &shapes, &materials, &warn, &err, MODEL_PATH.c_str());</code></pre>

      <h2 data-sub="VK8.3.2">Vertex deduplication with hash maps</h2>
      <p>To deduplicate vertices, we implement <code>operator==</code> and specialize <code>std::hash<Vertex></code>:</p>
      <pre><code>namespace std {
    template<> struct hash<Vertex> {
        size_t operator()(Vertex const& vertex) const {
            return ((hash<glm::vec3>()(vertex.pos) ^
                   (hash<glm::vec3>()(vertex.color) << 1)) >> 1) ^
                   (hash<glm::vec2>()(vertex.texCoord) << 1);
        }
    };
}</code></pre>
      <p>During the loading loop, we use an <code>std::unordered_map<Vertex, uint32_t> uniqueVertices</code>:</p>
      <ol>
        <li>If the vertex has not been seen before, add it to <code>vertices</code> vector and record its new index in the hash map.</li>
        <li>Append the vertex's index into the <code>indices</code> vector.</li>
      </ol>

      <h2 data-sub="VK8.3.3">Cache locality & large meshes</h2>
      <p>Deduplicating vertices shrinks the final vertex buffer in device-local memory dramatically. More importantly, it activates the GPU's hardware <strong>Post-Transform Cache (FIFO vertex cache)</strong>. When multiple triangles share a corner, the GPU computes the vertex shader once and reuses the transformed vertex coordinates for subsequent triangles!</p>
      <p><a class="btn goto-sim" href="#/VK8.3/sim">Try it: parse 3D OBJ geometry and inspect vertex deduplication savings →</a></p>
    `,
    keyFormulas: [
      ["Combined hash operator", String.raw`\operatorname{hash}(V) = \operatorname{hash}(\text{pos}) \oplus (\operatorname{hash}(\text{color}) \ll 1) \oplus (\operatorname{hash}(\text{texCoord}) \ll 2)`],
      ["Deduplication reduction", String.raw`\text{Reduction} = \left( 1 - \frac{|V_{\text{unique}}|}{|V_{\text{raw}}|} \right) \times 100\%`],
    ],
    exercises: [
      { q: "Why is a hash map used during model loading?", a: "To detect identical vertex attribute combinations (position, color, UV, normal) and reuse their existing index instead of creating duplicate vertices." },
      { q: "How does deduplication improve rendering speed on the GPU?", a: "It allows the GPU hardware post-transform cache to reuse previously shaded vertices, skipping vertex shader execution for shared triangle corners." },
      { q: "Which index type should be used if an OBJ model has 100,000 unique vertices?", a: "VK_INDEX_TYPE_UINT32, because uint16 can only address up to 65,535 vertices." },
    ],
    cpp: [{
      title: "Model Loading & Deduplication in C++",
      formula: String.raw`\text{tinyobj::LoadObj} + \text{std::unordered\_map}`,
      note: "<p>Deduplicates vertices using custom hash specialization.</p>",
      code: String.raw`
#define TINYOBJLOADER_IMPLEMENTATION
#include <tiny_obj_loader.h>
#include <unordered_map>
#include <vector>

void LoadModel(const std::string& path, std::vector<Vertex>& vertices,
               std::vector<uint32_t>& indices)
{
    tinyobj::attrib_t attrib;
    std::vector<tinyobj::shape_t> shapes;
    std::vector<tinyobj::material_t> materials;
    std::string warn, err;

    if (!tinyobj::LoadObj(&attrib, &shapes, &materials, &warn, &err, path.c_str())) {
        throw std::runtime_error(warn + err);
    }

    std::unordered_map<Vertex, uint32_t> uniqueVertices{};

    for (const auto& shape : shapes) {
        for (const auto& index : shape.mesh.indices) {
            Vertex vertex{};
            vertex.pos = {
                attrib.vertices[3 * index.vertex_index + 0],
                attrib.vertices[3 * index.vertex_index + 1],
                attrib.vertices[3 * index.vertex_index + 2]
            };
            vertex.texCoord = {
                attrib.texcoords[2 * index.texcoord_index + 0],
                1.0f - attrib.texcoords[2 * index.texcoord_index + 1]
            };
            vertex.color = {1.0f, 1.0f, 1.0f};

            if (uniqueVertices.count(vertex) == 0) {
                uniqueVertices[vertex] = static_cast<uint32_t>(vertices.size());
                vertices.push_back(vertex);
            }
            indices.push_back(uniqueVertices[vertex]);
        }
    }
}
`,
    }],
    csharp: [{
      title: "Vertex Deduplication in C#",
      formula: String.raw`\text{Dictionary<Vertex, uint>}`,
      note: "<p>C# hash map deduplication routine.</p>",
      code: String.raw`
using System.Collections.Generic;
using System.Numerics;

public static void DeduplicateVertices(List<Vertex> rawList, out List<Vertex> uniqueVertices, out List<uint> indices)
{
    uniqueVertices = new List<Vertex>();
    indices = new List<uint>();
    var map = new Dictionary<Vertex, uint>();

    foreach (var v in rawList)
    {
        if (!map.TryGetValue(v, out uint index))
        {
            index = (uint)uniqueVertices.Count;
            map[v] = index;
            uniqueVertices.Add(v);
        }
        indices.Add(index);
    }
}
`,
    }],
    sims: [{ title: "3D mesh vertex deduplication counter", help: "<p>Simulate importing a 3D model. Observe how hash map deduplication collapses redundant vertices into an index buffer, saving VRAM.</p>", mount: simVertexDeduplication }],
  });

  L3D.topic({
    id: "VK8.4",
    summary: "Mipmaps eliminate distant texture crawling via GPU blit downsampling, while Multisampling (MSAA) anti-aliases geometric edges using sub-pixel resolve attachments.",
    lesson: String.raw`
      <p><strong>High-fidelity rendering requires eliminating visual aliasing.</strong> Two primary forms of aliasing plague real-time 3D graphics: texture crawling on distant surfaces, and jagged staircase edges on geometric silhouettes.</p>
      <div class="key"><p>Vulkan tackles these with two hardware-accelerated techniques: <strong>Mipmapping</strong> (pre-downsampling textures on the GPU via <code>vkCmdBlitImage</code>) and <strong>Multisample Anti-Aliasing (MSAA)</strong> (sampling geometry at sub-pixel resolution and resolving into the swapchain).</p></div>

      <h2 data-sub="VK8.4.1">Mip level generation via vkCmdBlitImage</h2>
      <p>When a textured object moves far into the distance, multiple texels map to a single screen pixel. Sampling causes extreme scintillation and Moire patterns.</p>
      <p>We solve this by generating a full mipmap pyramid (\(1024 \to 512 \to 256 \dots \to 1\)). In Vulkan, we generate mip levels directly on the GPU using <code>vkCmdBlitImage</code>:</p>
      <ol>
        <li>Calculate total levels: <code>mipLevels = floor(log2(max(width, height))) + 1</code>.</li>
        <li>Iterate from level 1 up to <code>mipLevels - 1</code>.</li>
        <li>Transition level \(i-1\) to <code>VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL</code>.</li>
        <li>Execute <code>vkCmdBlitImage</code> to downsample level \(i-1\) into level \(i\) with linear filtering.</li>
        <li>Transition level \(i-1\) to <code>VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL</code>.</li>
      </ol>

      <h2 data-sub="VK8.4.2">MSAA sample counts</h2>
      <p>To eliminate jagged polygon edges, query the physical device for supported multisample counts:</p>
      <pre><code>VkSampleCountFlagBits GetMaxUsableSampleCount(VkPhysicalDevice physicalDevice) {
    VkPhysicalDeviceProperties props;
    vkGetPhysicalDeviceProperties(physicalDevice, &props);
    VkSampleCountFlags counts = props.limits.framebufferColorSampleCounts &
                                props.limits.framebufferDepthSampleCounts;
    if (counts & VK_SAMPLE_COUNT_8_BIT) return VK_SAMPLE_COUNT_8_BIT;
    if (counts & VK_SAMPLE_COUNT_4_BIT) return VK_SAMPLE_COUNT_4_BIT;
    return VK_SAMPLE_COUNT_2_BIT;
}</code></pre>

      <h2 data-sub="VK8.4.3">Multisample resolve attachment</h2>
      <p>With MSAA enabled, the pipeline renders into a multi-sampled color target and a multi-sampled depth target (e.g. 4 samples per pixel). Because standard presentation engines cannot display multi-sampled images directly, the render pass includes a <strong>Resolve Attachment</strong>:</p>
      <ul>
        <li>Subpass outputs to multi-sampled color attachment (4 samples).</li>
        <li><code>pResolveAttachments</code> references the 1-sample swapchain presentation image view.</li>
        <li>At the conclusion of the subpass, the GPU hardware automatically averages the 4 sub-pixel color samples into a single smooth pixel in the swapchain image!</li>
      </ul>
      <p><a class="btn goto-sim" href="#/VK8.4/sim">Try it: compare geometric aliasing with 4x MSAA and mipmaps →</a></p>
    `,
    keyFormulas: [
      ["Mip levels calculation", String.raw`N_{\text{mips}} = \lfloor \log_2(\max(W, H)) \rfloor + 1`],
      ["MSAA resolve filter", String.raw`C_{\text{pixel}} = \frac{1}{M} \sum_{k=1}^{M} C_{\text{subpixel } k}`],
    ],
    exercises: [
      { q: "Why is vkCmdBlitImage used instead of vkCmdCopyImage to generate mipmaps?", a: "vkCmdBlitImage performs linear filtering during downsampling, scaling texels smoothly between mip levels, whereas vkCmdCopyImage only performs raw 1:1 byte copies." },
      { q: "Why is a resolve attachment necessary when using MSAA in Vulkan?", a: "Display swapchains only support 1 sample per pixel. The resolve attachment averages the multisampled color buffer down into a single displayable pixel." },
      { q: "Does MSAA blur texture details?", a: "No. MSAA only supersamples geometric triangle edges and coverage masks. Texture details inside polygons are sampled once per pixel fragment." },
    ],
    cpp: [{
      title: "Generating Mipmaps with vkCmdBlitImage in C++",
      formula: String.raw`\text{vkCmdBlitImage}`,
      note: "<p>Downsamples each mip level from the previous level on the GPU.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>
#include <algorithm>

void GenerateMipmaps(VkDevice device, VkCommandPool commandPool, VkQueue graphicsQueue,
                     VkImage image, VkFormat imageFormat, int32_t texWidth, int32_t texHeight,
                     uint32_t mipLevels)
{
    VkCommandBuffer commandBuffer = BeginSingleTimeCommands(device, commandPool);

    VkImageMemoryBarrier barrier{};
    barrier.sType = VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER;
    barrier.image = image;
    barrier.srcQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
    barrier.dstQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
    barrier.subresourceRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
    barrier.subresourceRange.baseArrayLayer = 0;
    barrier.subresourceRange.layerCount = 1;
    barrier.subresourceRange.levelCount = 1;

    int32_t mipWidth = texWidth;
    int32_t mipHeight = texHeight;

    for (uint32_t i = 1; i < mipLevels; i++) {
        barrier.subresourceRange.baseMipLevel = i - 1;
        barrier.oldLayout = VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL;
        barrier.newLayout = VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL;
        barrier.srcAccessMask = VK_ACCESS_TRANSFER_WRITE_BIT;
        barrier.dstAccessMask = VK_ACCESS_TRANSFER_READ_BIT;

        vkCmdPipelineBarrier(commandBuffer,
            VK_PIPELINE_STAGE_TRANSFER_BIT, VK_PIPELINE_STAGE_TRANSFER_BIT, 0,
            0, nullptr, 0, nullptr, 1, &barrier);

        VkImageBlit blit{};
        blit.srcOffsets[0] = { 0, 0, 0 };
        blit.srcOffsets[1] = { mipWidth, mipHeight, 1 };
        blit.srcSubresource.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
        blit.srcSubresource.mipLevel = i - 1;
        blit.srcSubresource.layerCount = 1;
        blit.dstOffsets[0] = { 0, 0, 0 };
        blit.dstOffsets[1] = { mipWidth > 1 ? mipWidth / 2 : 1, mipHeight > 1 ? mipHeight / 2 : 1, 1 };
        blit.dstSubresource.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
        blit.dstSubresource.mipLevel = i;
        blit.dstSubresource.layerCount = 1;

        vkCmdBlitImage(commandBuffer,
            image, VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL,
            image, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL,
            1, &blit, VK_FILTER_LINEAR);

        barrier.oldLayout = VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL;
        barrier.newLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL;
        barrier.srcAccessMask = VK_ACCESS_TRANSFER_READ_BIT;
        barrier.dstAccessMask = VK_ACCESS_SHADER_READ_BIT;

        vkCmdPipelineBarrier(commandBuffer,
            VK_PIPELINE_STAGE_TRANSFER_BIT, VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT, 0,
            0, nullptr, 0, nullptr, 1, &barrier);

        if (mipWidth > 1) mipWidth /= 2;
        if (mipHeight > 1) mipHeight /= 2;
    }

    EndSingleTimeCommands(device, commandPool, graphicsQueue, commandBuffer);
}
`,
    }],
    csharp: [{
      title: "MSAA Configuration in C#",
      formula: String.raw`\text{SampleCountFlags.Count4Bit}`,
      note: "<p>Silk.NET multisampling pipeline state setup.</p>",
      code: String.raw`
using Silk.NET.Vulkan;

public static PipelineMultisampleStateCreateInfo CreateMsaaState(SampleCountFlags samples)
{
    return new PipelineMultisampleStateCreateInfo
    {
        SType = StructureType.PipelineMultisampleStateCreateInfo,
        RasterizationSamples = samples,
        SampleShadingEnable = false,
        MinSampleShading = 1.0f,
    };
}
`,
    }],
    sims: [{ title: "Mipmapping & MSAA quality visualizer", help: "<p>Toggle Mipmapping on and off to observe distant texture aliasing. Toggle 4x MSAA to inspect geometric silhouette edge smoothing.</p>", mount: simMsaaMipmaps }],
  });

  // ------------------------------------------------------------ Simulations
  function simDepthTesting(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const depthOn = sim.checkbox(controls, { label: "Enable Depth Testing", value: true, onChange: () => v.redraw() });
    const drawOrder = sim.segmented(controls, { label: "Submission Order", options: [["near_first", "Near First, Far Second"], ["far_first", "Far First, Near Second"]], value: "near_first", onChange: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const dt = depthOn.value;
      const nearFirst = drawOrder.value === "near_first";

      // Triangle 1: Near (Z = 0.2, Blue)
      // Triangle 2: Far (Z = 0.7, Red)
      const nearTri = { name: "Near Triangle (Z = 0.2)", color: "a", pts: [[-2.0, -1.0], [0.5, 2.5], [1.5, -1.0]] };
      const farTri = { name: "Far Triangle (Z = 0.7)", color: "err", pts: [[-0.5, -0.5], [2.0, 2.0], [3.5, -0.5]] };

      view.rect([-4.5, 1.8], [-2.5, 3.2], { color: "a", fill: "a", fillAlpha: 0.3 });
      view.text([-3.5, 2.7], "Near (Z = 0.2)", { align: "center", color: "fg", size: 10, bold: true });

      view.rect([-4.5, 0.2], [-2.5, 1.6], { color: "err", fill: "err", fillAlpha: 0.3 });
      view.text([-3.5, 1.1], "Far (Z = 0.7)", { align: "center", color: "fg", size: 10, bold: true });

      // Rendering order
      const sequence = nearFirst ? [nearTri, farTri] : [farTri, nearTri];

      if (dt) {
        // Correct Z-buffering: Near always wins overlap
        view.rect([-0.5, -0.5], [3.5, 2.0], { color: "err", fill: "err", fillAlpha: 0.4 });
        view.rect([-2.0, -1.0], [1.5, 2.5], { color: "a", fill: "a", fillAlpha: 0.6 });
        view.text([0.0, 0.5], "NEAR OCCLUDES FAR\n(Depth buffer: Z=0.2 wins)", { align: "center", color: "fg", size: 10, bold: true });
      } else {
        // Painter's algorithm artifact
        if (nearFirst) {
          view.rect([-2.0, -1.0], [1.5, 2.5], { color: "a", fill: "a", fillAlpha: 0.5 });
          view.rect([-0.5, -0.5], [3.5, 2.0], { color: "err", fill: "err", fillAlpha: 0.6 });
          view.text([1.0, 0.5], "ARTIFACT: Far triangle drawn LAST\nOverwrites closer triangle!", { align: "center", color: "err", size: 9, bold: true });
        } else {
          view.rect([-0.5, -0.5], [3.5, 2.0], { color: "err", fill: "err", fillAlpha: 0.4 });
          view.rect([-2.0, -1.0], [1.5, 2.5], { color: "a", fill: "a", fillAlpha: 0.6 });
          view.text([0.0, 0.5], "Lucky Order (Far drawn first)", { align: "center", color: "g", size: 10 });
        }
      }

      view.rect([-4.5, -2.6], [4.5, -1.5], { color: "muted", fill: "panel", fillAlpha: 0.6 });
      view.text([0, -1.8], dt ? "DEPTH TESTING ACTIVE: Depth compare op VK_COMPARE_OP_LESS evaluates each fragment" : "DEPTH TESTING DISABLED: Render order dictates visual result (Painter's Algorithm)", { align: "center", color: dt ? "g" : "err", size: 10, bold: true });
      view.text([0, -2.2], "Vulkan depth range: 0.0 (near) to 1.0 (far)", { align: "center", color: "a", size: 9 });

      out.set(sim.rows([
        ["Depth Testing", dt ? "ENABLED (VK_TRUE)" : "DISABLED (VK_FALSE)"],
        ["Depth Compare Op", "VK_COMPARE_OP_LESS"],
        ["Submission Order", nearFirst ? "Near first, then Far" : "Far first, then Near"],
        ["Visual Outcome", dt ? "Mathematically Correct (Z-Buffer)" : (nearFirst ? "GLITCH: Far draws over Near" : "Temporarily correct by luck")],
      ]));
    });
  }

  function simEarlyDepthTest(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const mode = sim.segmented(controls, { label: "Depth Test Timing", options: [["early", "Early Fragment Tests (Hardware Z)"], ["late", "Late Tests (Post-Shader)"]], value: "early", onChange: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const isEarly = mode.value === "early";

      // Rasterizer Box
      view.rect([-4.5, 1.2], [-2.3, 3.2], { color: "b", fill: "b", fillAlpha: 0.15 });
      view.text([-3.4, 2.8], "Rasterizer", { align: "center", color: "b", size: 11, bold: true });
      view.text([-3.4, 2.0], "Generates 100,000\nPixel Fragments", { align: "center", color: "fg", size: 9 });

      if (isEarly) {
        // Early Z Box
        view.rect([-1.5, 1.0], [0.8, 3.4], { color: "g", fill: "g", fillAlpha: 0.25 });
        view.text([-0.35, 2.9], "Early Z Test", { align: "center", color: "g", size: 11, bold: true });
        view.text([-0.35, 2.1], "KILLS 60% OCCLUDED\nFRAGMENTS HERE", { align: "center", color: "fg", size: 8, bold: true });
        view.text([-0.35, 1.4], "Depth rejected: 60,000", { align: "center", color: "a", size: 8 });

        view.arrow([-2.3, 2.2], [-1.5, 2.2], { color: "c" });
        view.arrow([0.8, 2.2], [1.8, 2.2], { color: "g", label: "Only 40,000 pass" });

        // Fragment Shader Box
        view.rect([1.8, 1.2], [4.5, 3.2], { color: "c", fill: "c", fillAlpha: 0.15 });
        view.text([3.15, 2.8], "Fragment Shader", { align: "center", color: "c", size: 11, bold: true });
        view.text([3.15, 2.0], "Executes on 40,000\nVisible Fragments Only!", { align: "center", color: "fg", size: 9 });
      } else {
        // Fragment Shader executes on all
        view.rect([-1.5, 1.2], [1.5, 3.2], { color: "warn", fill: "warn", fillAlpha: 0.2 });
        view.text([0.0, 2.8], "Fragment Shader", { align: "center", color: "warn", size: 11, bold: true });
        view.text([0.0, 2.0], "EXECUTES ON ALL\n100,000 FRAGMENTS!", { align: "center", color: "fg", size: 9, bold: true });

        view.arrow([-2.3, 2.2], [-1.5, 2.2], { color: "c" });
        view.arrow([1.5, 2.2], [2.5, 2.2], { color: "warn", label: "Shaded all 100k" });

        // Late Depth Test
        view.rect([2.5, 1.0], [4.5, 3.4], { color: "err", fill: "err", fillAlpha: 0.2 });
        view.text([3.5, 2.9], "Late Depth Test", { align: "center", color: "err", size: 11, bold: true });
        view.text([3.5, 2.0], "Discards 60,000\nwasted calculations!", { align: "center", color: "fg", size: 8 });
      }

      // Performance comparison banner
      view.rect([-4.5, -2.6], [4.5, 0.4], { color: isEarly ? "g" : "err", fill: "panel", fillAlpha: 0.6 });
      view.text([0, 0.0], isEarly ? "MAXIMUM GPU EFFICIENCY: Early Z prevents unnecessary lighting & texturing" : "FILL-RATE BOTTLENECK: 60% of shader calculations discarded after completion!", { align: "center", color: isEarly ? "g" : "err", size: 11, bold: true });
      view.text([0, -0.7], isEarly ? "GPU Execution Time: 1.2 ms" : "GPU Execution Time: 3.1 ms (2.5x slower)", { align: "center", color: "fg", size: 10 });
      view.text([0, -1.4], "Note: Writing to gl_FragDepth or discarding in shaders disables Early Z automatically.", { align: "center", color: "muted", size: 9 });

      out.set(sim.rows([
        ["Depth Test Mode", isEarly ? "Early Fragment Tests (layout(early_fragment_tests) in)" : "Late Depth Test (Post-Fragment Shader)"],
        ["Shader Invocations", isEarly ? "40,000 (Visible only)" : "100,000 (Redundant occluded shading)"],
        ["Compute Cycles Saved", isEarly ? "60,000 Invocations (60% saved)" : "0% (Wasted power)"],
        ["Frame Time Impact", isEarly ? "Fast (Smooth 144 FPS)" : "Heavy fill-rate stall"],
      ]));
    });
  }

  function simVertexDeduplication(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const faces = sim.slider(controls, { label: "Mesh Faces (Triangles)", min: 100, max: 2000, step: 100, value: 500, onInput: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const f = faces.value;

      // Raw non-deduplicated vertices: 3 per face
      const rawCount = f * 3;
      // In typical 3D meshes, vertex count ≈ faces / 2 + 2 (Euler characteristic)
      const dedupCount = Math.round(f * 0.55 + 10);
      const indexCount = f * 3;

      const vertexSize = 32; // pos + norm + uv = 32 bytes
      const indexSize = 2;   // uint16 = 2 bytes

      const rawBytes = rawCount * vertexSize;
      const dedupBytes = dedupCount * vertexSize + indexCount * indexSize;
      const savingsPct = Math.round((1 - dedupBytes / rawBytes) * 100);

      // Raw OBJ Stream Box
      view.rect([-4.5, 1.2], [-1.0, 3.2], { color: "err", fill: "err", fillAlpha: 0.15 });
      view.text([-2.75, 2.8], "Raw OBJ Face Corners", { align: "center", color: "err", size: 11, bold: true });
      view.text([-2.75, 2.2], `${rawCount.toLocaleString()} Vertices`, { align: "center", color: "fg", size: 10 });
      view.text([-2.75, 1.6], `${fmt(rawBytes / 1024, 1)} KB VRAM (3 per face)`, { align: "center", color: "muted", size: 9 });

      // Deduplicated Hash Map Box
      view.rect([1.0, 1.2], [4.5, 3.2], { color: "g", fill: "g", fillAlpha: 0.15 });
      view.text([2.75, 2.8], "Deduplicated Mesh", { align: "center", color: "g", size: 11, bold: true });
      view.text([2.75, 2.2], `${dedupCount.toLocaleString()} Unique Vertices + ${indexCount} Indices`, { align: "center", color: "fg", size: 9 });
      view.text([2.75, 1.6], `${fmt(dedupBytes / 1024, 1)} KB VRAM Total`, { align: "center", color: "a", size: 9 });

      view.arrow([-1.0, 2.2], [1.0, 2.2], { color: "c", label: "std::unordered_map" });

      // Savings meter
      view.rect([-4.5, -2.4], [4.5, 0.4], { color: "muted", fill: "panel", fillAlpha: 0.6 });
      view.text([0, 0.0], `MEMORY FOOTPRINT REDUCED BY ${savingsPct}%!`, { align: "center", color: "g", size: 14, bold: true });

      view.rect([-4.0, -0.9], [4.0, -0.4], { color: "muted", fill: "panel", fillAlpha: 0.5 });
      view.rect([-4.0, -0.9], [-4.0 + (8.0 * savingsPct) / 100, -0.4], { color: "g", fill: "g", fillAlpha: 0.6 });

      view.text([0, -1.5], "Post-Transform Cache: Average vertex reused ~5.4 times by GPU", { align: "center", color: "fg", size: 10 });
      view.text([0, -2.0], "Vertex shader execution skipped on all cache hits!", { align: "center", color: "a", size: 9 });

      out.set(sim.rows([
        ["Triangle Count", f.toLocaleString()],
        ["Raw Vertices", rawCount.toLocaleString()],
        ["Unique Deduplicated", dedupCount.toLocaleString()],
        ["Index Buffer Entries", indexCount.toLocaleString()],
        ["Memory Reduction", `${savingsPct}% savings (${fmt((rawBytes - dedupBytes) / 1024, 1)} KB saved)`],
      ]));
    });
  }

  function simMsaaMipmaps(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const mips = sim.checkbox(controls, { label: "Enable Mipmapping (vkCmdBlitImage)", value: true, onChange: () => v.redraw() });
    const msaa = sim.segmented(controls, { label: "MSAA Sample Count", options: [["1", "1x (No MSAA)"], ["4", "4x MSAA (Sub-pixel Resolve)"]], value: "4", onChange: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const hasMips = mips.value;
      const isMsaa = msaa.value === "4";

      // Diagonal edge illustration on left
      view.rect([-4.5, 0.2], [-0.5, 3.2], { color: "c", fill: "panel", fillAlpha: 0.4 });
      view.text([-2.5, 2.9], "Geometric Edge (Silhouette)", { align: "center", color: "fg", size: 10, bold: true });

      if (isMsaa) {
        // Smooth line
        view.line([-4.2, 0.5], [-0.8, 2.6], { color: "g", width: 4 });
        view.text([-2.5, 1.2], "4x MSAA: Sub-pixel samples\naveraged into smooth edge", { align: "center", color: "g", size: 9, bold: true });
      } else {
        // Jagged staircase line
        for (let s = 0; s < 6; s++) {
          const x0 = -4.2 + s * 0.55;
          const y0 = 0.5 + s * 0.35;
          view.line([x0, y0], [x0 + 0.55, y0], { color: "err", width: 3 });
          view.line([x0 + 0.55, y0], [x0 + 0.55, y0 + 0.35], { color: "err", width: 3 });
        }
        view.text([-2.5, 1.2], "1x MSAA: Visible staircase\njaggies on high-contrast edge", { align: "center", color: "err", size: 9, bold: true });
      }

      // Distant texture illustration on right
      view.rect([0.5, 0.2], [4.5, 3.2], { color: "b", fill: "panel", fillAlpha: 0.4 });
      view.text([2.5, 2.9], "Distant Texture Sampling", { align: "center", color: "fg", size: 10, bold: true });

      if (hasMips) {
        view.rect([1.2, 0.8], [3.8, 2.4], { color: "g", fill: "g", fillAlpha: 0.25 });
        view.text([2.5, 1.6], "MIPMAP ACTIVE\nSmooth downsampled levels\nZero texture crawling", { align: "center", color: "g", size: 9, bold: true });
      } else {
        view.rect([1.2, 0.8], [3.8, 2.4], { color: "warn", fill: "warn", fillAlpha: 0.25 });
        view.text([2.5, 1.6], "MIPMAP DISABLED\nExtreme Moire flickering\nHigh-frequency crawl", { align: "center", color: "err", size: 9, bold: true });
      }

      // Pipeline Architecture footer
      view.rect([-4.5, -2.6], [4.5, -0.2], { color: "muted", fill: "panel", fillAlpha: 0.5 });
      view.text([-4.2, -0.6], "Vulkan Render Quality Pipeline Configuration:", { color: "fg", size: 11, bold: true });
      view.text([-4.0, -1.2], isMsaa ? "RenderPass: 4x MSAA Color + Depth -> Resolve Attachment (1-sample Swapchain)" : "RenderPass: Direct 1-sample Color Attachment", { color: isMsaa ? "a" : "muted", size: 9 });
      view.text([-4.0, -1.8], hasMips ? "Texture: Generated via vkCmdBlitImage downsample pyramid" : "Texture: Base Level 0 Only", { color: hasMips ? "g" : "muted", size: 9 });

      out.set(sim.rows([
        ["MSAA Mode", isMsaa ? "VK_SAMPLE_COUNT_4_BIT (Resolved into 1-sample screen)" : "VK_SAMPLE_COUNT_1_BIT (Aliased edges)"],
        ["Mipmapping", hasMips ? "Enabled (GPU downsampled mip pyramid)" : "Disabled (Full resolution sampled in distance)"],
        ["Silhouette Quality", isMsaa ? "Anti-aliased (Clean edges)" : "Jagged staircase edges"],
        ["Texture Stability", hasMips ? "Tear-free, flicker-free" : "Severe Moire pattern aliasing"],
      ]));
    });
  }
})();
