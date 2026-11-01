// Learn Vulkan — Chapter 3: Pipeline & Render Passes
(function () {
  "use strict";
  const { fmt } = L3D.math;

  L3D.topic({
    id: "VK3.1",
    summary: "Vulkan graphics pipelines are baked ahead of time into immutable objects using pre-compiled SPIR-V binary bytecode, eliminating runtime driver shader recompilation.",
    lesson: String.raw`
      <p><strong>In traditional APIs like OpenGL, the graphics pipeline was a mutable state machine.</strong> Shaders could be swapped, depth testing toggled, and blend modes changed on the fly right before any draw call. While flexible, this forced the GPU driver to constantly guess what hardware state was needed and recompile shader microcode mid-frame, causing infamous frame-rate hitches and stutter.</p>
      <div class="key"><p>Vulkan completely abandons dynamic pipeline state. A <code>VkPipeline</code> object bakes every single stage—programmable shaders, vertex layout, rasterizer switches, depth testing, and color blend equations—into an immutable, pre-compiled hardware state object.</p></div>

      <h2 data-sub="VK3.1.1">Pipeline state immutability</h2>
      <p>Because a Vulkan pipeline is immutable, switching rendering styles (e.g. from solid geometry to wireframe, or opaque to alpha-blended) requires creating multiple pipeline objects ahead of time and switching between them with <code>vkCmdBindPipeline</code>.</p>
      <p>This ahead-of-time baking gives the GPU driver enormous advantages:</p>
      <ul>
        <li><strong>Cross-stage optimization:</strong> The driver can optimize register allocation between the vertex shader output and fragment shader input simultaneously.</li>
        <li><strong>Zero runtime re-validation:</strong> At render time, binding a pipeline is essentially writing a pre-computed hardware register configuration block to the GPU.</li>
        <li><strong>Pipeline Caching:</strong> Using a <code>VkPipelineCache</code>, the compiled native GPU binaries can be saved to disk, eliminating shader compilation stutter on subsequent game launches.</li>
      </ul>

      <h2 data-sub="VK3.1.2">SPIR-V bytecode</h2>
      <p>OpenGL required passing high-level GLSL source code as text strings to the driver. Every GPU vendor (NVIDIA, AMD, Intel, Apple, Qualcomm) had to maintain a complete GLSL compiler inside their driver, leading to vendor-specific syntax bugs and unpredictable compiler bugs.</p>
      <p>Vulkan solves this with <strong>SPIR-V (Standard Portable Intermediate Representation)</strong>. SPIR-V is a standardized binary bytecode format. You compile your GLSL or HLSL shaders offline during your build step using tools such as:</p>
      <ul>
        <li><code>glslc</code> (from the Google Shaderc library included in the Vulkan SDK):<br>
          <code>glslc shader.vert -o vert.spv</code><br>
          <code>glslc shader.frag -o frag.spv</code>
        </li>
        <li><code>dxc</code> (DirectX Shader Compiler) or <code>slang</code> for modern cross-compilation.</li>
      </ul>

      <h2 data-sub="VK3.1.3">VkShaderModule & stage creation</h2>
      <p>Once you read the compiled <code>.spv</code> binary file into memory as a byte array, you wrap it in a <code>VkShaderModule</code> object:</p>
      <pre><code>VkShaderModuleCreateInfo createInfo{};
createInfo.sType = VK_STRUCTURE_TYPE_SHADER_MODULE_CREATE_INFO;
createInfo.codeSize = code.size(); // size in bytes
createInfo.pCode = reinterpret_cast<const uint32_t*>(code.data()); // must be 4-byte aligned!
vkCreateShaderModule(device, &createInfo, nullptr, &shaderModule);</code></pre>
      <p>To assign the shader module to a pipeline stage, you configure a <code>VkPipelineShaderStageCreateInfo</code> structure:</p>
      <ul>
        <li><code>stage</code>: <code>VK_SHADER_STAGE_VERTEX_BIT</code> or <code>VK_SHADER_STAGE_FRAGMENT_BIT</code>.</li>
        <li><code>module</code>: The <code>VkShaderModule</code> handle.</li>
        <li><code>pName</code>: Entry point function name (e.g. <code>"main"</code>). Multiple entry points can reside in a single SPIR-V file.</li>
        <li><code>pSpecializationInfo</code>: Allows injecting constants into shaders at pipeline creation time without recompiling the bytecode!</li>
      </ul>
      <div class="note">Once the pipeline object is built via <code>vkCreateGraphicsPipelines</code>, the <code>VkShaderModule</code> objects are no longer needed and can be safely destroyed with <code>vkDestroyShaderModule</code>.</div>
      <p><a class="btn goto-sim" href="#/VK3.1/sim">Try it: explore SPIR-V compilation and pipeline baking →</a></p>
    `,
    keyFormulas: [
      ["SPIR-V alignment", String.raw`\text{pCode} \in \mathbb{U}_{32}^N, \quad \text{codeSize} = 4 \times N \text{ bytes}`],
      ["Pipeline binding", String.raw`\text{vkCmdBindPipeline}(\text{cmdBuffer}, \text{VK\_PIPELINE\_BIND\_POINT\_GRAPHICS}, \text{pipeline})`],
    ],
    exercises: [
      { q: "Why is SPIR-V bytecode preferred over passing raw GLSL strings to the driver?", a: "SPIR-V is a standardized binary intermediate format compiled offline, eliminating vendor-specific syntax discrepancies and driver compiler overhead." },
      { q: "When can VkShaderModule handles be safely destroyed?", a: "Immediately after the graphics pipeline object has been created with vkCreateGraphicsPipelines." },
      { q: "What feature allows changing shader constants at pipeline creation time without recompilation?", a: "Specialization constants (VkSpecializationInfo)." },
    ],
    cpp: [{
      title: "Creating VkShaderModule and Stage Info",
      formula: String.raw`\text{vkCreateShaderModule} \to \text{VkPipelineShaderStageCreateInfo}`,
      note: "<p>Reads SPIR-V binary code and defines pipeline stage configurations.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>
#include <vector>

VkShaderModule CreateShaderModule(VkDevice device, const std::vector<char>& code) {
    VkShaderModuleCreateInfo createInfo{};
    createInfo.sType = VK_STRUCTURE_TYPE_SHADER_MODULE_CREATE_INFO;
    createInfo.codeSize = code.size();
    createInfo.pCode = reinterpret_cast<const uint32_t*>(code.data());

    VkShaderModule shaderModule;
    if (vkCreateShaderModule(device, &createInfo, nullptr, &shaderModule) != VK_SUCCESS) {
        throw std::runtime_error("Failed to create shader module!");
    }
    return shaderModule;
}

VkPipelineShaderStageCreateInfo CreateStageInfo(VkShaderModule module, VkShaderStageFlagBits stage) {
    VkPipelineShaderStageCreateInfo stageInfo{};
    stageInfo.sType = VK_STRUCTURE_TYPE_PIPELINE_SHADER_STAGE_CREATE_INFO;
    stageInfo.stage = stage;
    stageInfo.module = module;
    stageInfo.pName = "main";
    return stageInfo;
}
`,
    }],
    csharp: [{
      title: "Creating Shader Module in C#",
      formula: String.raw`\text{vk.CreateShaderModule}`,
      note: "<p>Loading SPIR-V bytecode with Silk.NET.Vulkan.</p>",
      code: String.raw`
using Silk.NET.Vulkan;
using System.IO;

public static unsafe ShaderModule CreateShaderModule(Vk vk, Device device, byte[] spirvBytes)
{
    fixed (byte* pBytes = spirvBytes)
    {
        var createInfo = new ShaderModuleCreateInfo
        {
            SType = StructureType.ShaderModuleCreateInfo,
            CodeSize = (nuint)spirvBytes.Length,
            PCode = (uint*)pBytes,
        };

        ShaderModule module;
        if (vk.CreateShaderModule(device, ref createInfo, null, out module) != Result.Success)
            throw new System.Exception("Failed to create shader module!");

        return module;
    }
}
`,
    }],
    sims: [{ title: "SPIR-V compilation & pipeline baking", help: "<p>Trace how high-level shader code transforms into SPIR-V intermediate bytecode instructions and bakes into a GPU pipeline.</p>", mount: simSpirvPipeline }],
  });

  L3D.topic({
    id: "VK3.2",
    summary: "Fixed-function pipeline stages control vertex streaming, viewport transforms, primitive rasterization, backface culling, and alpha color blending.",
    lesson: String.raw`
      <p><strong>Between programmable shader stages lie the hardware's fixed-function units.</strong> While shaders dictate vertex positions and fragment colors, fixed-function stages govern how geometry is assembled into triangles, clipped to the screen, rasterized into pixel fragments, and blended into existing color attachments.</p>
      <div class="key"><p>In Vulkan, every fixed-function stage is configured by a dedicated structure passed into <code>VkGraphicsPipelineCreateInfo</code>. Getting a single flag wrong will result in black screens or validation layer warnings.</p></div>

      <h2 data-sub="VK3.2.1">Vertex input & input assembly</h2>
      <p>The graphics pipeline begins by reading vertex data from memory buffers:</p>
      <ul>
        <li><strong>Vertex Input State (<code>VkPipelineVertexInputStateCreateInfo</code>):</strong> Describes the memory format of vertex buffers.
          <ul>
            <li><code>bindingDescriptions</code>: Defines the stride (byte size per vertex) and whether data advances per-vertex or per-instance (for instanced rendering).</li>
            <li><code>attributeDescriptions</code>: Maps fields (e.g. location 0 for <code>vec3 position</code>, location 1 for <code>vec3 color</code>) to byte offsets within the vertex struct.</li>
          </ul>
        </li>
        <li><strong>Input Assembly State (<code>VkPipelineInputAssemblyStateCreateInfo</code>):</strong> Defines the geometric primitive topology:
          <ul>
            <li><code>VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST</code>: Every 3 vertices form an independent triangle.</li>
            <li><code>VK_PRIMITIVE_TOPOLOGY_TRIANGLE_STRIP</code>: Triangles share adjacent vertices.</li>
            <li><code>primitiveRestartEnable</code>: Allows using a special index (like <code>0xFFFF</code>) to break strip topologies.</li>
          </ul>
        </li>
      </ul>

      <h2 data-sub="VK3.2.2">Dynamic viewport & scissor</h2>
      <p>The <strong>viewport</strong> dictates the transformation from Normalized Device Coordinates (NDC, where \(x \in [-1, 1]\), \(y \in [-1, 1]\), \(z \in [0, 1]\)) into physical framebuffer pixel coordinates:</p>
      <ul>
        <li><code>x, y</code>: Top-left corner of the target rectangle.</li>
        <li><code>width, height</code>: Dimensions in pixels.</li>
        <li><code>minDepth, maxDepth</code>: Depth range, usually <code>0.0f</code> and <code>1.0f</code>.</li>
      </ul>
      <p>The <strong>scissor rectangle</strong> defines a pixel clipping boundary. Any fragments outside the scissor rectangle are immediately discarded by the hardware rasterizer without executing the fragment shader.</p>
      <div class="warn"><strong>Vulkan Y-Axis Convention:</strong> In OpenGL, normalized device coordinate \(y = +1\) is at the top of the screen. In Vulkan, \(y = +1\) points downward toward the bottom of the screen! When using shaders written for OpenGL, triangles will be flipped upside-down unless you negate the viewport height or adapt the projection matrix.</div>
      <p>To avoid recreating the entire pipeline every time the window is resized, mark viewport and scissor as <strong>dynamic states</strong> (<code>VK_DYNAMIC_STATE_VIEWPORT</code>, <code>VK_DYNAMIC_STATE_SCISSOR</code>) and set them dynamically inside the command buffer using <code>vkCmdSetViewport</code> and <code>vkCmdSetScissor</code>.</p>

      <h2 data-sub="VK3.2.3">Rasterizer & color blending</h2>
      <p>The <strong>Rasterizer</strong> converts continuous geometric triangles into discrete fragments (potential pixels):</p>
      <ul>
        <li><code>polygonMode</code>: <code>VK_POLYGON_MODE_FILL</code> (solid), <code>LINE</code> (wireframe), or <code>POINT</code>.</li>
        <li><code>cullMode</code>: <code>VK_CULL_MODE_BACK_BIT</code> discards triangles pointing away from the camera, doubling performance for closed 3D meshes.</li>
        <li><code>frontFace</code>: Defines triangle winding order (<code>VK_FRONT_FACE_CLOCKWISE</code> or <code>COUNTER_CLOCKWISE</code>).</li>
      </ul>
      <p>The <strong>Color Blending Stage</strong> combines the color output of the fragment shader with the color already residing in the framebuffer attachment. Blending can either overwrite directly (opaque) or perform standard alpha blending:</p>
      <pre><code>finalColor.rgb = newAlpha * newColor + (1 - newAlpha) * oldColor;
finalColor.a = newAlpha;</code></pre>
      <p><a class="btn goto-sim" href="#/VK3.2/sim">Try it: test face culling, rasterizer modes, and alpha blending →</a></p>
    `,
    keyFormulas: [
      ["Standard alpha blend", String.raw`C_{\text{out}} = C_{\text{src}} \cdot \alpha_{\text{src}} + C_{\text{dst}} \cdot (1 - \alpha_{\text{src}})`],
      ["Vulkan NDC range", String.raw`x, y \in [-1, 1], \quad z \in [0, 1] \quad (\text{Y points down})`],
    ],
    exercises: [
      { q: "How does the Vulkan normalized device coordinate (NDC) system differ from OpenGL?", a: "In Vulkan, the Y axis points downwards (+Y is down), and the Z depth range is [0.0, 1.0], whereas in OpenGL Y points upwards and Z is [-1.0, 1.0]." },
      { q: "Why should viewport and scissor states be marked as dynamic states?", a: "Marking them as dynamic states allows changing viewport and scissor dimensions via vkCmdSetViewport/Scissor during window resizing without having to recreate the graphics pipeline." },
      { q: "What does backface culling do?", a: "It evaluates triangle vertex winding order in screen space and discards triangles facing away from the camera before fragment processing, saving GPU resources." },
    ],
    cpp: [{
      title: "Configuring Rasterizer and Color Blending",
      formula: String.raw`\text{VkPipelineRasterizationStateCreateInfo} + \text{VkPipelineColorBlendStateCreateInfo}`,
      note: "<p>Populating fixed-function state structures for solid rendering with alpha blending.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>

VkPipelineRasterizationStateCreateInfo CreateRasterizerInfo() {
    VkPipelineRasterizationStateCreateInfo rasterizer{};
    rasterizer.sType = VK_STRUCTURE_TYPE_PIPELINE_RASTERIZATION_STATE_CREATE_INFO;
    rasterizer.depthClampEnable = VK_FALSE;
    rasterizer.rasterizerDiscardEnable = VK_FALSE;
    rasterizer.polygonMode = VK_POLYGON_MODE_FILL;
    rasterizer.lineWidth = 1.0f;
    rasterizer.cullMode = VK_CULL_MODE_BACK_BIT;
    rasterizer.frontFace = VK_FRONT_FACE_CLOCKWISE;
    rasterizer.depthBiasEnable = VK_FALSE;
    return rasterizer;
}

VkPipelineColorBlendAttachmentState CreateAlphaBlendAttachment() {
    VkPipelineColorBlendAttachmentState colorBlendAttachment{};
    colorBlendAttachment.colorWriteMask = VK_COLOR_COMPONENT_R_BIT | VK_COLOR_COMPONENT_G_BIT |
                                          VK_COLOR_COMPONENT_B_BIT | VK_COLOR_COMPONENT_A_BIT;
    colorBlendAttachment.blendEnable = VK_TRUE;
    colorBlendAttachment.srcColorBlendFactor = VK_BLEND_FACTOR_SRC_ALPHA;
    colorBlendAttachment.dstColorBlendFactor = VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA;
    colorBlendAttachment.colorBlendOp = VK_BLEND_OP_ADD;
    colorBlendAttachment.srcAlphaBlendFactor = VK_BLEND_FACTOR_ONE;
    colorBlendAttachment.dstAlphaBlendFactor = VK_BLEND_FACTOR_ZERO;
    colorBlendAttachment.alphaBlendOp = VK_BLEND_OP_ADD;
    return colorBlendAttachment;
}
`,
    }],
    csharp: [{
      title: "Rasterizer & Color Blend Setup in C#",
      formula: String.raw`\text{PipelineRasterizationStateCreateInfo}`,
      note: "<p>Fixed function stage structs with Silk.NET.Vulkan.</p>",
      code: String.raw`
using Silk.NET.Vulkan;

public static PipelineRasterizationStateCreateInfo CreateRasterizer()
{
    return new PipelineRasterizationStateCreateInfo
    {
        SType = StructureType.PipelineRasterizationStateCreateInfo,
        DepthClampEnable = false,
        RasterizerDiscardEnable = false,
        PolygonMode = PolygonMode.Fill,
        LineWidth = 1.0f,
        CullMode = CullModeFlags.BackBit,
        FrontFace = FrontFace.Clockwise,
    };
}
`,
    }],
    sims: [{ title: "Fixed-function stages & rasterizer visualizer", help: "<p>Toggle wireframe vs fill mode, frontface culling, and alpha blending. Observe how the rasterizer processes geometry into pixels.</p>", mount: simFixedFunction }],
  });

  L3D.topic({
    id: "VK3.3",
    summary: "A Render Pass defines the framebuffer attachments, load and store operations, subpasses, and internal synchronization dependencies for a rendering sequence.",
    lesson: String.raw`
      <p><strong>Before baking a graphics pipeline, Vulkan requires defining the Render Pass.</strong> A <code>VkRenderPass</code> is not a draw command; it is an architectural contract that tells the GPU what render targets (color, depth, resolve) will be used during rendering, how their memory should be handled at the start and end of the pass, and how execution is staged.</p>
      <div class="key"><p>On modern mobile and unified memory architectures (TBDR: Tile-Based Deferred Rendering), render passes allow the GPU to process entire tiles entirely in ultra-fast on-chip SRAM cache, writing out to main memory only when the pass ends.</p></div>

      <h2 data-sub="VK3.3.1">Attachments & load/store ops</h2>
      <p>An attachment is an image description (e.g. swapchain color buffer or depth buffer). For each attachment, you specify:</p>
      <ul>
        <li><code>format</code>: Must match the image view format (e.g. <code>VK_FORMAT_B8G8R8A8_SRGB</code>).</li>
        <li><code>samples</code>: Multisampling count (<code>VK_SAMPLE_COUNT_1_BIT</code> for standard rendering).</li>
        <li><code>loadOp</code>: What the GPU should do with pixels at the beginning of the render pass:
          <ul>
            <li><code>VK_ATTACHMENT_LOAD_OP_CLEAR</code>: Clears values to a constant color/depth. Optimal for starting a new frame.</li>
            <li><code>VK_ATTACHMENT_LOAD_OP_LOAD</code>: Preserves existing pixels. Costly on mobile GPUs because it reads from VRAM into tile cache.</li>
            <li><code>VK_ATTACHMENT_LOAD_OP_DONT_CARE</code>: Existing data is undefined. Fastest if you are overwriting the entire screen anyway.</li>
          </ul>
        </li>
        <li><code>storeOp</code>: What the GPU should do with rendered pixels when the pass concludes:
          <ul>
            <li><code>VK_ATTACHMENT_STORE_OP_STORE</code>: Writes rendered pixels back to memory so they can be presented to the display or sampled by later passes.</li>
            <li><code>VK_ATTACHMENT_STORE_OP_DONT_CARE</code>: Discards pixels after the pass (ideal for transient depth buffers).</li>
          </ul>
        </li>
        <li><code>initialLayout</code> and <code>finalLayout</code>: Specifies the memory layout transition. For example, a color attachment starts as <code>VK_IMAGE_LAYOUT_UNDEFINED</code> and transitions automatically at the end of the pass to <code>VK_IMAGE_LAYOUT_PRESENT_SRC_KHR</code> ready for the presentation engine!</li>
      </ul>

      <h2 data-sub="VK3.3.2">Subpasses</h2>
      <p>A single render pass can consist of multiple sequential <strong>subpasses</strong>. Subpasses are rendering phases that depend on the contents of attachments produced in previous subpasses.</p>
      <p>For example, in a deferred shading pipeline:</p>
      <ul>
        <li><strong>Subpass 0 (G-Buffer):</strong> Outputs albedo, normals, and roughness attachments.</li>
        <li><strong>Subpass 1 (Lighting):</strong> Reads those attachments directly from on-chip tile memory (input attachments) and computes lighting, without ever writing the intermediate G-Buffer out to external VRAM!</li>
      </ul>
      <p>A standard forward rendering application uses a single subpass (index 0) with a color attachment reference.</p>

      <h2 data-sub="VK3.3.3">Subpass dependencies</h2>
      <p>Subpass dependencies specify execution and memory synchronization between subpasses, or between operations outside the render pass (<code>VK_SUBPASS_EXTERNAL</code>) and subpass 0.</p>
      <p>When presenting an image, the swapchain image acquisition operation is asynchronous. The render pass must not start writing colors into the image attachment until the image has actually been acquired from the presentation engine. This is resolved by adding an external subpass dependency:</p>
      <ul>
        <li><code>srcSubpass = VK_SUBPASS_EXTERNAL</code></li>
        <li><code>dstSubpass = 0</code></li>
        <li><code>srcStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT</code></li>
        <li><code>dstStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT</code></li>
        <li><code>dstAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT</code></li>
      </ul>
      <div class="game">TBR and TBDR architectures found on iPhones, Android phones, and Apple Silicon chips rely heavily on render passes and input attachments to run high-end graphics without overheating the battery.</div>
      <p><a class="btn goto-sim" href="#/VK3.3/sim">Try it: trace render pass attachment operations and subpass dependencies →</a></p>
    `,
    keyFormulas: [
      ["External subpass dependency", String.raw`\text{EXTERNAL} \xrightarrow[\text{COLOR\_ATTACHMENT\_OUTPUT}]{\text{srcStage } \to \text{ dstStage}} \text{Subpass 0}`],
      ["Attachment transition", String.raw`\text{initialLayout: UNDEFINED} \xrightarrow{\text{Subpass}} \text{finalLayout: PRESENT\_SRC}`],
    ],
    exercises: [
      { q: "Why is VK_ATTACHMENT_LOAD_OP_CLEAR preferred over LOAD when rendering a full frame?", a: "CLEAR avoids reading existing VRAM contents into the GPU cache at the start of a frame, saving significant memory bandwidth—especially on mobile tile-based GPUs." },
      { q: "What is an input attachment in a subpass?", a: "An image attachment written in one subpass that can be read by pixel shaders in a subsequent subpass directly from fast on-chip tile memory." },
      { q: "What does the initialLayout and finalLayout configuration accomplish?", a: "It tells the driver to automatically execute memory layout transitions on the attachment images at the beginning and end of the render pass without requiring explicit pipeline barrier commands." },
    ],
    cpp: [{
      title: "Creating a Render Pass in C++",
      formula: String.raw`\text{vkCreateRenderPass}(\text{device}, \&\text{renderPassInfo}, \text{nullptr}, \&\text{renderPass})`,
      note: "<p>Color attachment with clear/store operations and an external subpass dependency.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>

VkRenderPass CreateRenderPass(VkDevice device, VkFormat swapChainImageFormat) {
    VkAttachmentDescription colorAttachment{};
    colorAttachment.format = swapChainImageFormat;
    colorAttachment.samples = VK_SAMPLE_COUNT_1_BIT;
    colorAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR;
    colorAttachment.storeOp = VK_ATTACHMENT_STORE_OP_STORE;
    colorAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
    colorAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
    colorAttachment.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
    colorAttachment.finalLayout = VK_IMAGE_LAYOUT_PRESENT_SRC_KHR;

    VkAttachmentReference colorAttachmentRef{};
    colorAttachmentRef.attachment = 0;
    colorAttachmentRef.layout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;

    VkSubpassDescription subpass{};
    subpass.pipelineBindPoint = VK_PIPELINE_BIND_POINT_GRAPHICS;
    subpass.colorAttachmentCount = 1;
    subpass.pColorAttachments = &colorAttachmentRef;

    VkSubpassDependency dependency{};
    dependency.srcSubpass = VK_SUBPASS_EXTERNAL;
    dependency.dstSubpass = 0;
    dependency.srcStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
    dependency.srcAccessMask = 0;
    dependency.dstStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
    dependency.dstAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;

    VkRenderPassCreateInfo renderPassInfo{};
    renderPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_CREATE_INFO;
    renderPassInfo.attachmentCount = 1;
    renderPassInfo.pAttachments = &colorAttachment;
    renderPassInfo.subpassCount = 1;
    renderPassInfo.pSubpasses = &subpass;
    renderPassInfo.dependencyCount = 1;
    renderPassInfo.pDependencies = &dependency;

    VkRenderPass renderPass;
    if (vkCreateRenderPass(device, &renderPassInfo, nullptr, &renderPass) != VK_SUCCESS) {
        throw std::runtime_error("Failed to create render pass!");
    }
    return renderPass;
}
`,
    }],
    csharp: [{
      title: "Creating Render Pass in C#",
      formula: String.raw`\text{vk.CreateRenderPass}`,
      note: "<p>Defining attachments and subpass dependencies in Silk.NET.Vulkan.</p>",
      code: String.raw`
using Silk.NET.Vulkan;

public static unsafe RenderPass CreateRenderPass(Vk vk, Device device, Format format)
{
    var colorAttachment = new AttachmentDescription
    {
        Format = format,
        Samples = SampleCountFlags.Count1Bit,
        LoadOp = AttachmentLoadOp.Clear,
        StoreOp = AttachmentStoreOp.Store,
        InitialLayout = ImageLayout.Undefined,
        FinalLayout = ImageLayout.PresentSrcKhr,
    };

    var colorRef = new AttachmentReference
    {
        Attachment = 0,
        Layout = ImageLayout.ColorAttachmentOptimal,
    };

    var subpass = new SubpassDescription
    {
        PipelineBindPoint = PipelineBindPoint.Graphics,
        ColorAttachmentCount = 1,
        PColorAttachments = &colorRef,
    };

    var dependency = new SubpassDependency
    {
        SrcSubpass = Vk.SubpassExternal,
        DstSubpass = 0,
        SrcStageMask = PipelineStageFlags.ColorAttachmentOutputBit,
        DstStageMask = PipelineStageFlags.ColorAttachmentOutputBit,
        DstAccessMask = AccessFlags.ColorAttachmentWriteBit,
    };

    var createInfo = new RenderPassCreateInfo
    {
        SType = StructureType.RenderPassCreateInfo,
        AttachmentCount = 1,
        PAttachments = &colorAttachment,
        SubpassCount = 1,
        PSubpasses = &subpass,
        DependencyCount = 1,
        PDependencies = &dependency,
    };

    RenderPass renderPass;
    if (vk.CreateRenderPass(device, ref createInfo, null, out renderPass) != Result.Success)
        throw new System.Exception("Failed to create render pass!");

    return renderPass;
}
`,
    }],
    sims: [{ title: "Render pass attachment & dependency graph", help: "<p>Explore how attachment load/store operations execute across stages, and trace subpass dependency barriers between external presentation and fragment shading.</p>", mount: simRenderPassGraph }],
  });

  L3D.topic({
    id: "VK3.4",
    summary: "Pipeline layouts define the uniform interface, framebuffers bind physical image views to render pass attachment slots, and vkCreateGraphicsPipelines bakes the complete pipeline.",
    lesson: String.raw`
      <p><strong>With shaders, fixed-function stages, and render passes configured, the final assembly brings all pieces together.</strong> This requires two complementary objects: a <code>VkPipelineLayout</code> to specify uniform interfaces, and <code>VkFramebuffer</code> objects to link concrete image views to render pass slots.</p>
      <div class="key"><p>The render pass defines the abstract attachment signature (e.g. 1 color image of format B8G8R8A8). The framebuffer binds the actual <code>VkImageView</code> handles for that specific swapchain frame.</p></div>

      <h2 data-sub="VK3.4.1">VkPipelineLayout</h2>
      <p>Shaders frequently access external resources such as Uniform Buffer Objects (UBOs), combined texture samplers, and push constants. In Vulkan, the shader resource interface is declared in a <code>VkPipelineLayout</code>:</p>
      <ul>
        <li><code>pSetLayouts</code>: An array of <code>VkDescriptorSetLayout</code> objects describing bound descriptor sets.</li>
        <li><code>pPushConstantRanges</code>: Describes lightweight push constant blocks sent directly via command buffers without memory allocation.</li>
      </ul>
      <p>Even if your initial shaders do not use uniforms or push constants, Vulkan still requires an empty <code>VkPipelineLayout</code> to be created and passed to the pipeline!</p>

      <h2 data-sub="VK3.4.2">VkFramebuffer creation</h2>
      <p>A <code>VkFramebuffer</code> binds specific <code>VkImageView</code> handles to the attachment points referenced by a <code>VkRenderPass</code>. Because the swapchain contains multiple images (e.g. 3 images for triple-buffering), you must create one <code>VkFramebuffer</code> for each swapchain image view:</p>
      <ul>
        <li><code>renderPass</code>: The compatible render pass handle.</li>
        <li><code>attachmentCount</code> & <code>pAttachments</code>: Array of image views corresponding to attachment indices <code>0, 1, ...</code>.</li>
        <li><code>width, height, layers</code>: Must match the swapchain image extent.</li>
      </ul>

      <h2 data-sub="VK3.4.3">Baking the graphics pipeline</h2>
      <p>Finally, you assemble the complete <code>VkGraphicsPipelineCreateInfo</code> structure, referencing:</p>
      <ol>
        <li>Shader stage info array (vertex + fragment modules).</li>
        <li>Vertex input state & input assembly state.</li>
        <li>Viewport state (or dynamic state flags).</li>
        <li>Rasterization state & multisample state.</li>
        <li>Depth-stencil state (if using a depth buffer).</li>
        <li>Color blend state.</li>
        <li>Pipeline layout handle.</li>
        <li>Render pass handle and subpass index.</li>
      </ol>
      <p>You invoke <code>vkCreateGraphicsPipelines</code>. The GPU driver compiles everything into optimized microcode and returns an immutable <code>VkPipeline</code> handle. You can now delete the shader modules and start recording drawing commands!</p>
      <div class="game">Game engines often pre-warm pipeline caches on the title screen ("Compiling Shaders: 142/500") using <code>VkPipelineCache</code> to guarantee silky smooth 120 FPS gameplay without micro-stutter during gameplay.</div>
      <p><a class="btn goto-sim" href="#/VK3.4/sim">Try it: map image views to framebuffer attachment slots →</a></p>
    `,
    keyFormulas: [
      ["Framebuffer binding", String.raw`\text{Framebuffer}_i = \langle \text{RenderPass}, \text{ImageView}_i, \text{extent} \rangle`],
      ["Pipeline creation", String.raw`\text{vkCreateGraphicsPipelines}(\text{device}, \text{cache}, 1, \&\text{pipelineInfo}, \text{nullptr}, \&\text{pipeline})`],
    ],
    exercises: [
      { q: "Why must you create multiple framebuffers for a swapchain?", a: "Because each swapchain image has its own distinct VkImageView, a corresponding VkFramebuffer must be created for each image view to serve as the render target for that frame." },
      { q: "Can a graphics pipeline be created with an empty VkPipelineLayout?", a: "Yes. An empty pipeline layout is required if your shaders do not reference uniform buffers, texture descriptors, or push constants." },
      { q: "What does VkPipelineCache do?", a: "It stores compiled GPU pipeline binaries so they can be written to disk and reloaded on subsequent runs, drastically reducing game startup and shader compilation times." },
    ],
    cpp: [{
      title: "Creating Pipeline Layout and Framebuffers",
      formula: String.raw`\text{vkCreatePipelineLayout} + \text{vkCreateFramebuffer}`,
      note: "<p>Allocating pipeline layout and building framebuffers for each swapchain image view.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>
#include <vector>

VkPipelineLayout CreatePipelineLayout(VkDevice device) {
    VkPipelineLayoutCreateInfo pipelineLayoutInfo{};
    pipelineLayoutInfo.sType = VK_STRUCTURE_TYPE_PIPELINE_LAYOUT_CREATE_INFO;
    pipelineLayoutInfo.setLayoutCount = 0;
    pipelineLayoutInfo.pushConstantRangeCount = 0;

    VkPipelineLayout pipelineLayout;
    if (vkCreatePipelineLayout(device, &pipelineLayoutInfo, nullptr, &pipelineLayout) != VK_SUCCESS) {
        throw std::runtime_error("Failed to create pipeline layout!");
    }
    return pipelineLayout;
}

std::vector<VkFramebuffer> CreateFramebuffers(VkDevice device, VkRenderPass renderPass,
                                             const std::vector<VkImageView>& imageViews,
                                             VkExtent2D extent) {
    std::vector<VkFramebuffer> framebuffers(imageViews.size());
    for (size_t i = 0; i < imageViews.size(); i++) {
        VkImageView attachments[] = { imageViews[i] };

        VkFramebufferCreateInfo framebufferInfo{};
        framebufferInfo.sType = VK_STRUCTURE_TYPE_FRAMEBUFFER_CREATE_INFO;
        framebufferInfo.renderPass = renderPass;
        framebufferInfo.attachmentCount = 1;
        framebufferInfo.pAttachments = attachments;
        framebufferInfo.width = extent.width;
        framebufferInfo.height = extent.height;
        framebufferInfo.layers = 1;

        if (vkCreateFramebuffer(device, &framebufferInfo, nullptr, &framebuffers[i]) != VK_SUCCESS) {
            throw std::runtime_error("Failed to create framebuffer!");
        }
    }
    return framebuffers;
}
`,
    }],
    csharp: [{
      title: "Creating Framebuffers in C#",
      formula: String.raw`\text{vk.CreateFramebuffer}`,
      note: "<p>Silk.NET framebuffer creation loop.</p>",
      code: String.raw`
using Silk.NET.Vulkan;

public static unsafe Framebuffer[] CreateFramebuffers(Vk vk, Device device,
    RenderPass renderPass, ImageView[] views, Extent2D extent)
{
    var framebuffers = new Framebuffer[views.Length];
    for (int i = 0; i < views.Length; i++)
    {
        var attachment = views[i];
        var createInfo = new FramebufferCreateInfo
        {
            SType = StructureType.FramebufferCreateInfo,
            RenderPass = renderPass,
            AttachmentCount = 1,
            PAttachments = &attachment,
            Width = extent.Width,
            Height = extent.Height,
            Layers = 1,
        };

        if (vk.CreateFramebuffer(device, ref createInfo, null, out framebuffers[i]) != Result.Success)
            throw new System.Exception("Failed to create framebuffer!");
    }
    return framebuffers;
}
`,
    }],
    sims: [{ title: "Framebuffer attachment slot mapper", help: "<p>Connect swapchain image views into framebuffer attachment slots. Verify how render passes bind physical memory for rasterization.</p>", mount: simFramebufferMapper }],
  });

  // ------------------------------------------------------------ Simulations
  function simSpirvPipeline(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const stageSel = sim.segmented(controls, { label: "Shader Stage", options: [["vert", "Vertex Shader"], ["frag", "Fragment Shader"]], value: "vert", onChange: () => v.redraw() });
    const spec = sim.checkbox(controls, { label: "Enable Specialization Constant", value: true, onChange: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const isVert = stageSel.value === "vert";
      const hasSpec = spec.value;

      // GLSL Source Block
      view.rect([-4.5, 1.2], [-1.8, 3.2], { color: "b", fill: "b", fillAlpha: 0.15 });
      view.text([-3.15, 2.8], isVert ? "shader.vert (GLSL)" : "shader.frag (GLSL)", { align: "center", color: "fg", size: 11, bold: true });
      view.text([-3.15, 2.1], isVert ? "vec2 positions[3];\ngl_Position = vec4(..)" : "outColor = vec4(..);\nlayout(location=0)", { align: "center", color: "muted", size: 9 });

      // glslc Compiler
      view.arrow([-1.8, 2.2], [-0.8, 2.2], { color: "a", label: "glslc offline" });

      // SPIR-V Module Block
      view.rect([-0.8, 1.2], [1.8, 3.2], { color: "c", fill: "c", fillAlpha: 0.2 });
      view.text([0.5, 2.8], isVert ? "vert.spv" : "frag.spv", { align: "center", color: "c", size: 12, bold: true });
      view.text([0.5, 2.1], "SPIR-V Bytecode\n(OpTypePointer, OpStore..)", { align: "center", color: "fg", size: 9 });

      // Driver Bake Arrow
      view.arrow([1.8, 2.2], [2.8, 2.2], { color: "g", label: "vkCreatePipelines" });

      // Baked VkPipeline Block
      view.rect([2.8, 1.0], [4.5, 3.4], { color: "g", fill: "g", fillAlpha: 0.25 });
      view.text([3.65, 2.8], "VkPipeline", { align: "center", color: "g", size: 12, bold: true });
      view.text([3.65, 2.1], "Optimized Native\nGPU Microcode", { align: "center", color: "fg", size: 9 });
      view.text([3.65, 1.4], hasSpec ? "[SpecConst: Baked]" : "[Default Const]", { align: "center", color: "a", size: 9 });

      // Opcode stream box
      view.rect([-4.5, -2.6], [4.5, 0.4], { color: "muted", fill: "panel", fillAlpha: 0.5 });
      view.text([-4.2, 0.0], `SPIR-V Instruction Stream (${isVert ? "Vertex" : "Fragment"} Stage):`, { color: "fg", size: 11, bold: true });

      const opcodes = isVert ? [
        "0x07230203 ; SPIR-V Magic Number",
        "OpCapability Shader",
        "OpMemoryModel Logical GLSL450",
        "OpEntryPoint Vertex %main \"main\" %gl_Position",
        hasSpec ? "OpSpecConstant %uint 1 (Subdivision factor)" : "; No specialization constants",
        "OpTypeVoid %void",
        "OpTypeFunction %func %void",
        "OpStore %gl_Position %result",
      ] : [
        "0x07230203 ; SPIR-V Magic Number",
        "OpCapability Shader",
        "OpMemoryModel Logical GLSL450",
        "OpEntryPoint Fragment %main \"main\" %outColor",
        hasSpec ? "OpSpecConstant %float 1.0 (Exposure)" : "; No specialization constants",
        "OpDecorate %outColor Location 0",
        "OpTypeVector %v4float 4",
        "OpStore %outColor %fragColor",
      ];

      opcodes.forEach((op, idx) => {
        const y = -0.4 - idx * 0.26;
        view.text([-4.0, y], op, { color: op.startsWith("OpSpec") ? "a" : "muted", size: 9 });
      });

      out.set(sim.rows([
        ["Target Stage", isVert ? "VK_SHADER_STAGE_VERTEX_BIT" : "VK_SHADER_STAGE_FRAGMENT_BIT"],
        ["Offline Compiler", "glslc (Google Shaderc)"],
        ["Bytecode Standard", "Khronos SPIR-V 1.0-1.6"],
        ["Specialization Constant", hasSpec ? "Enabled (Constant folded into GPU machine code)" : "Disabled"],
        ["Pipeline Status", "Pre-compiled Immutable Object (VkPipeline)"],
      ]));
    });
  }

  function simFixedFunction(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const polyMode = sim.segmented(controls, { label: "Polygon Mode", options: [["fill", "FILL"], ["line", "LINE (Wireframe)"]], value: "fill", onChange: () => v.redraw() });
    const cull = sim.segmented(controls, { label: "Cull Mode", options: [["none", "NONE"], ["back", "BACK"], ["front", "FRONT"]], value: "back", onChange: () => v.redraw() });
    const blend = sim.checkbox(controls, { label: "Enable Alpha Blend", value: true, onChange: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const isWire = polyMode.value === "line";
      const c = cull.value;
      const blOn = blend.value;

      // Triangle 1 (Front Facing: Clockwise winding)
      const p1 = [[-3.5, -0.5], [-1.0, 2.5], [0.0, -0.5]];
      // Triangle 2 (Back Facing: Counter-Clockwise winding)
      const p2 = [[0.5, -0.5], [2.5, 2.5], [4.0, -0.5]];

      const showT1 = c !== "front";
      const showT2 = c !== "back";

      // Render Triangle 1
      if (showT1) {
        if (isWire) {
          view.line(p1[0], p1[1], { color: "a", width: 2 });
          view.line(p1[1], p1[2], { color: "a", width: 2 });
          view.line(p1[2], p1[0], { color: "a", width: 2 });
        } else {
          view.rect([-3.0, -0.5], [-0.5, 2.0], { color: "a", fill: "a", fillAlpha: blOn ? 0.45 : 1.0 });
        }
        view.text([-1.8, 0.7], "Triangle 1\n(Front Facing)", { align: "center", color: "fg", size: 10, bold: true });
      } else {
        view.rect([-3.2, -0.5], [-0.3, 2.0], { color: "err", fill: "err", fillAlpha: 0.1 });
        view.text([-1.75, 0.7], "[CULLED: Front]", { align: "center", color: "err", size: 11, bold: true });
      }

      // Render Triangle 2
      if (showT2) {
        if (isWire) {
          view.line(p2[0], p2[1], { color: "b", width: 2 });
          view.line(p2[1], p2[2], { color: "b", width: 2 });
          view.line(p2[2], p2[0], { color: "b", width: 2 });
        } else {
          view.rect([1.0, -0.5], [3.5, 2.0], { color: "b", fill: "b", fillAlpha: blOn ? 0.45 : 1.0 });
        }
        view.text([2.25, 0.7], "Triangle 2\n(Back Facing)", { align: "center", color: "fg", size: 10, bold: true });
      } else {
        view.rect([0.8, -0.5], [3.7, 2.0], { color: "muted", fill: "panel", fillAlpha: 0.2 });
        view.text([2.25, 0.7], "[CULLED: Backface]", { align: "center", color: "muted", size: 11, bold: true });
      }

      // Banner text
      view.rect([-4.5, -2.6], [4.5, -1.2], { color: "muted", fill: "panel", fillAlpha: 0.6 });
      view.text([0, -1.6], `Rasterizer State: ${isWire ? "WIREFRAME" : "SOLID FILL"} | Cull: ${c.toUpperCase()} | Blending: ${blOn ? "SRC_ALPHA + ONE_MINUS_SRC_ALPHA" : "OPAQUE OVERWRITE"}`, { align: "center", color: "fg", size: 10 });
      view.text([0, -2.1], "Vulkan Y-Axis: +Y points down. Clockwise triangles face forward by default.", { align: "center", color: "a", size: 9 });

      out.set(sim.rows([
        ["Polygon Mode", isWire ? "VK_POLYGON_MODE_LINE" : "VK_POLYGON_MODE_FILL"],
        ["Cull Mode", c === "none" ? "VK_CULL_MODE_NONE" : (c === "back" ? "VK_CULL_MODE_BACK_BIT" : "VK_CULL_MODE_FRONT_BIT")],
        ["Alpha Blend", blOn ? "Enabled (Translucent overlapping fragments)" : "Disabled (Direct overwrite)"],
        ["Visible Primitives", (showT1 ? 1 : 0) + (showT2 ? 1 : 0) + " / 2"],
      ]));
    });
  }

  function simRenderPassGraph(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const loadOp = sim.segmented(controls, { label: "loadOp", options: [["clear", "CLEAR"], ["load", "LOAD"], ["dont_care", "DONT_CARE"]], value: "clear", onChange: () => v.redraw() });
    const storeOp = sim.segmented(controls, { label: "storeOp", options: [["store", "STORE"], ["dont_care", "DONT_CARE"]], value: "store", onChange: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const ld = loadOp.value;
      const st = storeOp.value;

      // Start: Initial Layout
      view.rect([-4.5, 0.8], [-2.3, 2.6], { color: "muted", fill: "panel", fillAlpha: 0.4 });
      view.text([-3.4, 2.1], "Initial Layout", { align: "center", color: "fg", size: 11, bold: true });
      view.text([-3.4, 1.4], "VK_IMAGE_LAYOUT_\nUNDEFINED", { align: "center", color: "a", size: 9 });

      // Arrow 1: Load Op
      view.arrow([-2.3, 1.7], [-1.0, 1.7], { color: "a", label: `loadOp: ${ld.toUpperCase()}` });

      // Middle: Subpass 0
      view.rect([-1.0, 0.4], [1.8, 3.0], { color: "c", fill: "c", fillAlpha: 0.25 });
      view.text([0.4, 2.5], "Subpass 0", { align: "center", color: "c", size: 12, bold: true });
      view.text([0.4, 1.8], "Rasterization &\nFragment Shader\nDraw Calls", { align: "center", color: "fg", size: 9 });
      view.text([0.4, 0.9], "COLOR_ATTACHMENT_OPTIMAL", { align: "center", color: "muted", size: 8 });

      // Arrow 2: Store Op
      view.arrow([1.8, 1.7], [3.0, 1.7], { color: "g", label: `storeOp: ${st.toUpperCase()}` });

      // End: Final Layout
      view.rect([3.0, 0.8], [4.5, 2.6], { color: "g", fill: "g", fillAlpha: 0.2 });
      view.text([3.75, 2.1], "Final Layout", { align: "center", color: "fg", size: 11, bold: true });
      view.text([3.75, 1.4], st === "store" ? "PRESENT_SRC_KHR\n(Displayable)" : "UNDEFINED\n(Discarded)", { align: "center", color: "g", size: 9 });

      // External Dependency Barrier box
      view.rect([-4.5, -2.6], [4.5, -0.3], { color: "a", fill: "a", fillAlpha: 0.1 });
      view.text([-4.2, -0.6], "VkSubpassDependency (Synchronization Contract):", { color: "fg", size: 11, bold: true });
      view.text([-4.0, -1.2], "srcSubpass: VK_SUBPASS_EXTERNAL (Presentation engine image acquire)", { color: "muted", size: 9 });
      view.text([-4.0, -1.6], "dstSubpass: 0 (Color attachment output stage waits until image is ready)", { color: "a", size: 9 });
      view.text([-4.0, -2.0], "dstAccessMask: VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT", { color: "muted", size: 9 });

      out.set(sim.rows([
        ["Attachment Format", "VK_FORMAT_B8G8R8A8_SRGB"],
        ["Load Operation", ld.toUpperCase() + (ld === "clear" ? " (Wipes screen clean to clear color)" : "")],
        ["Store Operation", st.toUpperCase() + (st === "store" ? " (Writes final pixels to presentation engine)" : "")],
        ["Initial Layout", "VK_IMAGE_LAYOUT_UNDEFINED"],
        ["Final Layout", st === "store" ? "VK_IMAGE_LAYOUT_PRESENT_SRC_KHR" : "VK_IMAGE_LAYOUT_UNDEFINED"],
        ["Tile Cache Efficiency", ld === "clear" ? "Optimal (No bandwidth wasted reading old VRAM)" : "Moderate"],
      ]));
    });
  }

  function simFramebufferMapper(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const activeFrame = sim.slider(controls, { label: "Swapchain Image Index", min: 0, max: 2, step: 1, value: 0, onInput: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const idx = activeFrame.value;

      // Render Pass Slot (Blueprint)
      view.rect([-4.5, 1.4], [-1.5, 3.2], { color: "a", fill: "a", fillAlpha: 0.15 });
      view.text([-3.0, 2.7], "VkRenderPass (Blueprint)", { align: "center", color: "a", size: 11, bold: true });
      view.text([-3.0, 2.0], "Attachment 0: [Color Slot]\nFormat: B8G8R8A8_SRGB", { align: "center", color: "fg", size: 9 });

      // Framebuffer Object
      view.rect([1.5, 1.4], [4.5, 3.2], { color: "g", fill: "g", fillAlpha: 0.15 });
      view.text([3.0, 2.7], `VkFramebuffer [${idx}]`, { align: "center", color: "g", size: 11, bold: true });
      view.text([3.0, 2.0], `Binds: swapChainImageViews[${idx}]\nExtent: 800 x 600`, { align: "center", color: "fg", size: 9 });

      view.arrow([-1.5, 2.3], [1.5, 2.3], { color: "c", label: "Concrete Binding" });

      // Swapchain Image Array
      view.rect([-4.5, -2.6], [4.5, 0.4], { color: "muted", fill: "panel", fillAlpha: 0.5 });
      view.text([-4.2, 0.0], "Swapchain Image Views (Triple Buffering):", { color: "fg", size: 11, bold: true });

      for (let i = 0; i < 3; i++) {
        const x0 = -4.0 + i * 2.8;
        const x1 = x0 + 2.4;
        const isSelected = i === idx;
        view.rect([x0, -2.2], [x1, -0.6], { color: isSelected ? "g" : "muted", fill: isSelected ? "g" : "panel", fillAlpha: isSelected ? 0.3 : 0.05 });
        view.text([(x0 + x1) / 2, -1.1], `ImageView ${i}`, { align: "center", color: isSelected ? "fg" : "muted", size: 11, bold: true });
        view.text([(x0 + x1) / 2, -1.7], isSelected ? "CURRENT TARGET" : "Idle Buffer", { align: "center", color: isSelected ? "g" : "muted", size: 9 });
      }

      out.set(sim.rows([
        ["Active Swapchain Image", `Index ${idx}`],
        ["Active Framebuffer", `VkFramebuffer #${idx}`],
        ["Bound Color Attachment", `swapChainImageViews[${idx}]`],
        ["Resolution", "800 x 600 x 1 layer"],
        ["Compatibility", "Attachments match VkRenderPass format specification exactly"],
      ]));
    });
  }
})();
