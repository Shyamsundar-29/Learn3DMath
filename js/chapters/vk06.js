// Learn Vulkan — Chapter 6: Resource Descriptors & Uniforms
(function () {
  "use strict";
  const { fmt } = L3D.math;

  L3D.topic({
    id: "VK6.1",
    summary: "Resource descriptors allow shaders to access uniform buffers, storage buffers, and textures through explicitly bound descriptor set layouts.",
    lesson: String.raw`
      <p><strong>In OpenGL, passing parameters to shaders was done through mutable driver calls</strong> like <code>glUniformMatrix4fv()</code>. While simple, this required the driver to track every individual variable name or location and patch shader constant registers during draw calls.</p>
      <div class="key"><p>In Vulkan, shaders access buffers and images indirectly through <strong>Descriptors</strong>. A descriptor is a handle or pointer that binds a specific buffer or image to a shader binding point.</p></div>

      <h2 data-sub="VK6.1.1">What are descriptors</h2>
      <p>Descriptors are organized into groups called <strong>Descriptor Sets</strong>. For example, a modern 3D engine might divide descriptors by update frequency:</p>
      <ul>
        <li><strong>Set 0 (Per-Pass / Per-Frame):</strong> Camera View/Projection matrices, global lighting data, time.</li>
        <li><strong>Set 1 (Per-Material):</strong> Albedo, normal, and roughness texture samplers.</li>
        <li><strong>Set 2 (Per-Object):</strong> Object transform matrices and bone animation data.</li>
      </ul>
      <p>By organizing resources into sets, you can bind Set 0 once per frame, and only swap Set 1 and Set 2 between draw calls.</p>

      <h2 data-sub="VK6.1.2">VkDescriptorSetLayout</h2>
      <p>Before allocating descriptor sets, you must define their structure with a <code>VkDescriptorSetLayout</code>. This layout acts as an interface contract specifying the type of resources and shader stages that will access them:</p>
      <pre><code>VkDescriptorSetLayoutBinding uboLayoutBinding{};
uboLayoutBinding.binding = 0; // layout(binding = 0) in GLSL
uboLayoutBinding.descriptorType = VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER;
uboLayoutBinding.descriptorCount = 1;
uboLayoutBinding.stageFlags = VK_SHADER_STAGE_VERTEX_BIT;
uboLayoutBinding.pImmutableSamplers = nullptr;

VkDescriptorSetLayoutCreateInfo layoutInfo{};
layoutInfo.sType = VK_STRUCTURE_TYPE_DESCRIPTOR_SET_LAYOUT_CREATE_INFO;
layoutInfo.bindingCount = 1;
layoutInfo.pBindings = &uboLayoutBinding;
vkCreateDescriptorSetLayout(device, &layoutInfo, nullptr, &descriptorSetLayout);</code></pre>

      <h2 data-sub="VK6.1.3">Pipeline layout integration</h2>
      <p>The descriptor set layout must be provided when baking the <code>VkPipelineLayout</code>. The pipeline uses this layout to compile the shader stages with the correct memory access patterns:</p>
      <pre><code>VkPipelineLayoutCreateInfo pipelineLayoutInfo{};
pipelineLayoutInfo.sType = VK_STRUCTURE_TYPE_PIPELINE_LAYOUT_CREATE_INFO;
pipelineLayoutInfo.setLayoutCount = 1;
pipelineLayoutInfo.pSetLayouts = &descriptorSetLayout;
vkCreatePipelineLayout(device, &pipelineLayoutInfo, nullptr, &pipelineLayout);</code></pre>
      <p>The graphics pipeline is now configured to expect descriptor sets matching this layout during rendering.</p>
      <p><a class="btn goto-sim" href="#/VK6.1/sim">Try it: map GLSL shader bindings to descriptor set layouts →</a></p>
    `,
    keyFormulas: [
      ["GLSL binding contract", String.raw`\text{layout}(\text{binding} = B) \text{ uniform UBO } \{ \dots \} \iff \text{VkDescriptorSetLayoutBinding}.\text{binding} = B`],
      ["Pipeline layout set array", String.raw`\text{VkPipelineLayout} \leftarrow [\text{SetLayout}_0, \text{SetLayout}_1, \dots, \text{SetLayout}_N]`],
    ],
    exercises: [
      { q: "What is a descriptor in Vulkan?", a: "A descriptor is an opaque pointer or structure that enables shaders to access external GPU resources like buffers and textures." },
      { q: "Why are descriptors organized into sets based on update frequency?", a: "To minimize state changes. Global per-frame uniforms (Set 0) can be bound once, while only per-material or per-object sets are switched between draw calls." },
      { q: "Which shader stages can access a descriptor configured with VK_SHADER_STAGE_VERTEX_BIT?", a: "Only the vertex shader stage. Attempting to access it from a fragment shader will trigger a compilation error or validation layer warning." },
    ],
    cpp: [{
      title: "Creating Descriptor Set Layout in C++",
      formula: String.raw`\text{vkCreateDescriptorSetLayout} \to \text{vkCreatePipelineLayout}`,
      note: "<p>Defines a uniform buffer binding at slot 0 for the vertex stage.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>

void CreateDescriptorSetLayout(VkDevice device, VkDescriptorSetLayout& outLayout) {
    VkDescriptorSetLayoutBinding uboLayoutBinding{};
    uboLayoutBinding.binding = 0;
    uboLayoutBinding.descriptorType = VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER;
    uboLayoutBinding.descriptorCount = 1;
    uboLayoutBinding.stageFlags = VK_SHADER_STAGE_VERTEX_BIT;

    VkDescriptorSetLayoutCreateInfo layoutInfo{};
    layoutInfo.sType = VK_STRUCTURE_TYPE_DESCRIPTOR_SET_LAYOUT_CREATE_INFO;
    layoutInfo.bindingCount = 1;
    layoutInfo.pBindings = &uboLayoutBinding;

    if (vkCreateDescriptorSetLayout(device, &layoutInfo, nullptr, &outLayout) != VK_SUCCESS) {
        throw std::runtime_error("Failed to create descriptor set layout!");
    }
}
`,
    }],
    csharp: [{
      title: "Descriptor Set Layout in C#",
      formula: String.raw`\text{vk.CreateDescriptorSetLayout}`,
      note: "<p>Silk.NET descriptor set layout creation.</p>",
      code: String.raw`
using Silk.NET.Vulkan;

public static unsafe DescriptorSetLayout CreateLayout(Vk vk, Device device)
{
    var binding = new DescriptorSetLayoutBinding
    {
        Binding = 0,
        DescriptorType = DescriptorType.UniformBuffer,
        DescriptorCount = 1,
        StageFlags = ShaderStageFlags.VertexBit,
    };

    var createInfo = new DescriptorSetLayoutCreateInfo
    {
        SType = StructureType.DescriptorSetLayoutCreateInfo,
        BindingCount = 1,
        PBindings = &binding,
    };

    DescriptorSetLayout layout;
    if (vk.CreateDescriptorSetLayout(device, ref createInfo, null, out layout) != Result.Success)
        throw new System.Exception("Failed to create descriptor set layout!");

    return layout;
}
`,
    }],
    sims: [{ title: "Descriptor set layout binding inspector", help: "<p>Inspect how GLSL shader uniform blocks map to descriptor layout binding slots and pipeline layout configurations.</p>", mount: simDescriptorSetLayout }],
  });

  L3D.topic({
    id: "VK6.2",
    summary: "Uniform Buffer Objects store shared shader constants like camera matrices, updated each frame in flight using persistent host memory mapping.",
    lesson: String.raw`
      <p><strong>Transforming 3D geometry requires passing transformation matrices to shaders.</strong> While vertex buffers provide local mesh coordinates, Model, View, and Projection (MVP) matrices dictate object position, camera orientation, and field of view.</p>
      <div class="key"><p>A <strong>Uniform Buffer Object (UBO)</strong> is a buffer bound to a descriptor set containing data that remains constant across all vertices in a draw call. Because uniform matrices are updated every frame, each frame in flight must own its own independent UBO to prevent the CPU from overwriting memory the GPU is actively rendering.</p></div>

      <h2 data-sub="VK6.2.1">UBO creation per frame in flight</h2>
      <p>We define a C++ struct matching our GLSL uniform block:</p>
      <pre><code>struct UniformBufferObject {
    alignas(16) glm::mat4 model;
    alignas(16) glm::mat4 view;
    alignas(16) glm::mat4 proj;
};</code></pre>
      <p>Because we have <code>MAX_FRAMES_IN_FLIGHT = 2</code>, we allocate two buffers using <code>HOST_VISIBLE | HOST_COHERENT</code> memory so the CPU can update them quickly every frame without staging transfers.</p>

      <h2 data-sub="VK6.2.2">Persistent mapping with vkMapMemory</h2>
      <p>In early graphics tutorials, developers often called <code>vkMapMemory</code>, wrote data with <code>memcpy</code>, and immediately called <code>vkUnmapMemory</code> inside every frame's render loop. This creates severe CPU overhead because mapping memory involves OS kernel page table manipulation.</p>
      <p>Modern Vulkan uses <strong>Persistent Mapping</strong>: you call <code>vkMapMemory</code> once when creating the buffer, store the returned raw pointer in an array (<code>void* uniformBuffersMapped[MAX_FRAMES_IN_FLIGHT]</code>), and leave it mapped for the entire lifetime of the application!</p>

      <h2 data-sub="VK6.2.3">Updating uniforms every frame</h2>
      <p>Inside the frame render loop, updating the matrices is as simple as a local <code>memcpy</code>:</p>
      <pre><code>UniformBufferObject ubo{};
ubo.model = glm::rotate(glm::mat4(1.0f), time * glm::radians(90.0f), glm::vec3(0, 0, 1));
ubo.view = glm::lookAt(glm::vec3(2, 2, 2), glm::vec3(0, 0, 0), glm::vec3(0, 0, 1));
ubo.proj = glm::perspective(glm::radians(45.0f), width / (float)height, 0.1f, 10.0f);
ubo.proj[1][1] *= -1; // Invert Vulkan Y-axis

memcpy(uniformBuffersMapped[currentFrame], &ubo, sizeof(ubo));</code></pre>
      <div class="warn"><strong>The GLM Y-Axis Inversion:</strong> GLM was written for OpenGL, where NDC Y points up. Because Vulkan's NDC Y points down, you must negate the \([1][1]\) element of your perspective projection matrix (<code>ubo.proj[1][1] *= -1;</code>), otherwise your 3D scene will render upside-down!</div>
      <p><a class="btn goto-sim" href="#/VK6.2/sim">Try it: rotate 3D matrices and inspect persistent mapped UBO memory →</a></p>
    `,
    keyFormulas: [
      ["Vulkan perspective Y-flip", String.raw`P_{\text{Vulkan}} = \begin{bmatrix} P_{00} & 0 & 0 & 0 \\ 0 & -P_{11} & 0 & 0 \\ 0 & 0 & P_{22} & P_{23} \\ 0 & 0 & P_{32} & 0 \end{bmatrix}`],
      ["Persistent mapping write", String.raw`\text{memcpy}(\text{mappedPtr}[\text{currentFrame}], \&\text{ubo}, \text{sizeof}(\text{UBO}))`],
    ],
    exercises: [
      { q: "Why must uniform buffers be duplicated per frame in flight?", a: "To prevent race conditions where the CPU writes new matrix data for frame N+1 while the GPU is still rendering frame N from the same buffer." },
      { q: "What is persistent mapping?", a: "Mapping a host-visible buffer once at startup with vkMapMemory and keeping the pointer open, avoiding the CPU overhead of mapping and unmapping every frame." },
      { q: "Why do we negate proj[1][1] in the projection matrix for Vulkan?", a: "GLM uses OpenGL's coordinate system where Y points up. In Vulkan, the Y axis in normalized device coordinates points down." },
    ],
    cpp: [{
      title: "Persistent UBO Mapping & Updates in C++",
      formula: String.raw`\text{vkMapMemory} \to \text{memcpy}`,
      note: "<p>Persistent pointer initialization and per-frame MVP matrix update.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <cstring>
#include <vector>

const int MAX_FRAMES_IN_FLIGHT = 2;
std::vector<void*> uniformBuffersMapped;

void InitUniformBuffers(VkDevice device, const std::vector<VkDeviceMemory>& uboMemory,
                        VkDeviceSize bufferSize)
{
    uniformBuffersMapped.resize(MAX_FRAMES_IN_FLIGHT);
    for (size_t i = 0; i < MAX_FRAMES_IN_FLIGHT; i++) {
        vkMapMemory(device, uboMemory[i], 0, bufferSize, 0, &uniformBuffersMapped[i]);
    }
}

void UpdateUniformBuffer(uint32_t currentImage, float time, VkExtent2D extent) {
    UniformBufferObject ubo{};
    ubo.model = glm::rotate(glm::mat4(1.0f), time * glm::radians(45.0f), glm::vec3(0.0f, 0.0f, 1.0f));
    ubo.view = glm::lookAt(glm::vec3(2.0f, 2.0f, 2.0f), glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3(0.0f, 0.0f, 1.0f));
    ubo.proj = glm::perspective(glm::radians(45.0f), extent.width / (float)extent.height, 0.1f, 10.0f);
    ubo.proj[1][1] *= -1; // Vulkan Y-flip

    memcpy(uniformBuffersMapped[currentImage], &ubo, sizeof(ubo));
}
`,
    }],
    csharp: [{
      title: "Persistent UBO Mapping in C#",
      formula: String.raw`\text{vk.MapMemory}`,
      note: "<p>Silk.NET persistent mapping and structure copy.</p>",
      code: String.raw`
using Silk.NET.Vulkan;
using System.Numerics;
using System.Runtime.CompilerServices;

public static unsafe void UpdateUbo(Vk vk, void* mappedPtr, float angle, float aspect)
{
    var model = Matrix4x4.CreateRotationZ(angle);
    var view = Matrix4x4.CreateLookAt(new Vector3(2, 2, 2), Vector3.Zero, Vector3.UnitZ);
    var proj = Matrix4x4.CreatePerspectiveFieldOfView(MathF.PI / 4, aspect, 0.1f, 10f);
    proj.M22 = -proj.M22; // Invert Y

    var ubo = new UniformBufferObject { Model = model, View = view, Proj = proj };
    Unsafe.Copy(mappedPtr, ref ubo);
}
`,
    }],
    sims: [{ title: "Interactive UBO matrix & persistent memory inspector", help: "<p>Rotate the model and camera. Inspect the calculated 4x4 matrix floats and watch them update live inside persistently mapped memory.</p>", mount: simUniformBuffers }],
  });

  L3D.topic({
    id: "VK6.3",
    summary: "Descriptor pools allocate descriptor sets, which bind concrete uniform buffers to shader slots and are bound to command buffers via vkCmdBindDescriptorSets.",
    lesson: String.raw`
      <p><strong>Descriptor sets cannot be created in isolation.</strong> Just as command buffers require a command pool, descriptor sets must be allocated from a <strong>Descriptor Pool</strong> (<code>VkDescriptorPool</code>) that manages descriptor memory.</p>
      <div class="key"><p>The workflow is: define the <code>VkDescriptorSetLayout</code>, create a <code>VkDescriptorPool</code> with sufficient capacity, allocate the <code>VkDescriptorSet</code> objects, configure them with <code>vkUpdateDescriptorSets</code>, and bind them with <code>vkCmdBindDescriptorSets</code>.</p></div>

      <h2 data-sub="VK6.3.1">VkDescriptorPool</h2>
      <p>When creating a descriptor pool, you specify the maximum number of sets and an array of <code>VkDescriptorPoolSize</code> structs declaring how many descriptors of each type the pool will hold:</p>
      <pre><code>VkDescriptorPoolSize poolSize{};
poolSize.type = VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER;
poolSize.descriptorCount = static_cast<uint32_t>(MAX_FRAMES_IN_FLIGHT);

VkDescriptorPoolCreateInfo poolInfo{};
poolInfo.sType = VK_STRUCTURE_TYPE_DESCRIPTOR_POOL_CREATE_INFO;
poolInfo.poolSizeCount = 1;
poolInfo.pPoolSizes = &poolSize;
poolInfo.maxSets = static_cast<uint32_t>(MAX_FRAMES_IN_FLIGHT);
vkCreateDescriptorPool(device, &poolInfo, nullptr, &descriptorPool);</code></pre>

      <h2 data-sub="VK6.3.2">Allocating & updating descriptor sets</h2>
      <p>We allocate one descriptor set per frame in flight using <code>vkAllocateDescriptorSets</code>. Once allocated, the sets are empty handles. We link each descriptor set to its corresponding uniform buffer using <code>vkUpdateDescriptorSets</code>:</p>
      <pre><code>for (size_t i = 0; i < MAX_FRAMES_IN_FLIGHT; i++) {
    VkDescriptorBufferInfo bufferInfo{};
    bufferInfo.buffer = uniformBuffers[i];
    bufferInfo.offset = 0;
    bufferInfo.range = sizeof(UniformBufferObject);

    VkWriteDescriptorSet descriptorWrite{};
    descriptorWrite.sType = VK_STRUCTURE_TYPE_WRITE_DESCRIPTOR_SET;
    descriptorWrite.dstSet = descriptorSets[i];
    descriptorWrite.dstBinding = 0;
    descriptorWrite.dstArrayElement = 0;
    descriptorWrite.descriptorType = VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER;
    descriptorWrite.descriptorCount = 1;
    descriptorWrite.pBufferInfo = &bufferInfo;

    vkUpdateDescriptorSets(device, 1, &descriptorWrite, 0, nullptr);
}</code></pre>

      <h2 data-sub="VK6.3.3">vkCmdBindDescriptorSets</h2>
      <p>During command buffer recording, bind the descriptor set for the current frame before issuing draw calls:</p>
      <pre><code>vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS,
                        pipelineLayout, 0, 1, &descriptorSets[currentFrame], 0, nullptr);
vkCmdDrawIndexed(commandBuffer, indexCount, 1, 0, 0, 0);</code></pre>
      <p>The vertex shader now receives the exact MVP matrices from that frame's UBO!</p>
      <p><a class="btn goto-sim" href="#/VK6.3/sim">Try it: allocate and update descriptor sets from a pool →</a></p>
    `,
    keyFormulas: [
      ["Pool capacity validation", String.raw`\sum \text{allocated}(\text{type}_k) \le \text{poolSize}_k, \quad \text{count}(\text{sets}) \le \text{maxSets}`],
      ["Binding descriptor sets", String.raw`\text{vkCmdBindDescriptorSets}(\text{cmd}, \text{GRAPHICS}, \text{layout}, \text{firstSet}=0, 1, \&\text{sets}[\text{currentFrame}], 0, \text{null})`],
    ],
    exercises: [
      { q: "What happens if you attempt to allocate more descriptor sets than maxSets specified in VkDescriptorPoolCreateInfo?", a: "vkAllocateDescriptorSets will fail with VK_ERROR_OUT_OF_POOL_MEMORY." },
      { q: "Does vkUpdateDescriptorSets record a GPU command?", a: "No. It is a CPU-side configuration function executed immediately by the host to connect resources to descriptor sets." },
      { q: "Can descriptor sets be freed individually?", a: "Only if the pool was created with the VK_DESCRIPTOR_POOL_CREATE_FREE_DESCRIPTOR_SET_BIT flag. Otherwise, sets are freed in bulk when the pool is reset or destroyed." },
    ],
    cpp: [{
      title: "Descriptor Pool & Set Allocation in C++",
      formula: String.raw`\text{vkCreateDescriptorPool} + \text{vkAllocateDescriptorSets} + \text{vkUpdateDescriptorSets}`,
      note: "<p>Allocates and writes uniform buffer descriptors for frames in flight.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>
#include <vector>

void CreateDescriptorSets(VkDevice device, VkDescriptorPool descriptorPool,
                          VkDescriptorSetLayout descriptorSetLayout,
                          const std::vector<VkBuffer>& uniformBuffers,
                          VkDeviceSize uboSize,
                          std::vector<VkDescriptorSet>& outSets)
{
    std::vector<VkDescriptorSetLayout> layouts(uniformBuffers.size(), descriptorSetLayout);
    VkDescriptorSetAllocateInfo allocInfo{};
    allocInfo.sType = VK_STRUCTURE_TYPE_DESCRIPTOR_SET_ALLOCATE_INFO;
    allocInfo.descriptorPool = descriptorPool;
    allocInfo.descriptorSetCount = static_cast<uint32_t>(uniformBuffers.size());
    allocInfo.pSetLayouts = layouts.data();

    outSets.resize(uniformBuffers.size());
    if (vkAllocateDescriptorSets(device, &allocInfo, outSets.data()) != VK_SUCCESS) {
        throw std::runtime_error("Failed to allocate descriptor sets!");
    }

    for (size_t i = 0; i < uniformBuffers.size(); i++) {
        VkDescriptorBufferInfo bufferInfo{};
        bufferInfo.buffer = uniformBuffers[i];
        bufferInfo.offset = 0;
        bufferInfo.range = uboSize;

        VkWriteDescriptorSet write{};
        write.sType = VK_STRUCTURE_TYPE_WRITE_DESCRIPTOR_SET;
        write.dstSet = outSets[i];
        write.dstBinding = 0;
        write.dstArrayElement = 0;
        write.descriptorType = VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER;
        write.descriptorCount = 1;
        write.pBufferInfo = &bufferInfo;

        vkUpdateDescriptorSets(device, 1, &write, 0, nullptr);
    }
}
`,
    }],
    csharp: [{
      title: "Descriptor Sets in C#",
      formula: String.raw`\text{vk.UpdateDescriptorSets}`,
      note: "<p>Silk.NET descriptor pool and write update.</p>",
      code: String.raw`
using Silk.NET.Vulkan;

public static unsafe void UpdateSet(Vk vk, Device device, DescriptorSet set,
    Silk.NET.Vulkan.Buffer ubo, ulong size)
{
    var bufInfo = new DescriptorBufferInfo { Buffer = ubo, Offset = 0, Range = size };
    var write = new WriteDescriptorSet
    {
        SType = StructureType.WriteDescriptorSet,
        DstSet = set,
        DstBinding = 0,
        DescriptorCount = 1,
        DescriptorType = DescriptorType.UniformBuffer,
        PBufferInfo = &bufInfo,
    };

    vk.UpdateDescriptorSets(device, 1, ref write, 0, null);
}
`,
    }],
    sims: [{ title: "Descriptor pool allocation & write update", help: "<p>Inspect the allocation of descriptor sets from a pool. Observe how VkWriteDescriptorSet binds physical UBO buffers to shader slots.</p>", mount: simDescriptorPool }],
  });

  L3D.topic({
    id: "VK6.4",
    summary: "std140 alignment enforces strict 16-byte boundaries for vec4 and mat4 structs, while push constants deliver lightweight uniforms directly in command buffers.",
    lesson: String.raw`
      <p><strong>One of the most insidious bugs in Vulkan is memory misalignment.</strong> A C++ struct might compile cleanly and look identical to a GLSL uniform block, but when rendered, geometry vanishes or skews into bizarre, jagged shapes.</p>
      <div class="key"><p>This occurs because SPIR-V shaders enforce the <strong>std140 memory layout standard</strong>, where vector and matrix types have strict alignment requirements that differ from default C++ compiler packing.</p></div>

      <h2 data-sub="VK6.4.1">std140 alignment requirements</h2>
      <p>Under the <code>std140</code> specification:</p>
      <ul>
        <li>Scalars (<code>float</code>, <code>int</code>): aligned to <strong>4 bytes</strong>.</li>
        <li><code>vec2</code>: aligned to <strong>8 bytes</strong>.</li>
        <li><code>vec3</code> and <code>vec4</code>: aligned to <strong>16 bytes</strong>.</li>
        <li>Matrices (<code>mat4</code>): treated as an array of 4 column vectors of type <code>vec4</code>, meaning <strong>each column must start on a 16-byte boundary</strong> (64 bytes total).</li>
        <li>Nested structs: must have their base alignment rounded up to a multiple of 16 bytes.</li>
      </ul>

      <h2 data-sub="VK6.4.2">alignas and padding gotchas</h2>
      <p>Consider this problematic C++ struct:</p>
      <pre><code>// DANGEROUS: Causes memory corruption in shaders!
struct BadUBO {
    glm::vec2 foo; // 8 bytes (offsets 0..7)
    glm::mat4 bar; // Standard C++ puts bar at offset 8!
};</code></pre>
      <p>In GLSL <code>std140</code>, <code>mat4 bar</code> requires 16-byte alignment, so the shader reads <code>bar</code> starting at offset <strong>16</strong>. The 8 bytes of data between offsets 8 and 15 are interpreted as matrix numbers, corrupting the view matrix!</p>
      <p>The solution is explicit C++11 alignment or manual padding:</p>
      <pre><code>struct CorrectUBO {
    glm::vec2 foo;
    alignas(16) glm::mat4 bar; // Forces bar to offset 16, matching std140!
};</code></pre>

      <h2 data-sub="VK6.4.3">Push constants for small uniforms</h2>
      <p>When you have small, frequently changing values (such as an object's position offset, tint color, or single matrix), allocating a UBO, managing descriptor sets, and writing descriptor sets creates unnecessary overhead.</p>
      <p><strong>Push Constants:</strong> Vulkan provides a special high-speed channel called Push Constants. Push constants write data directly into GPU command registers during command buffer recording:</p>
      <ul>
        <li>Guaranteed capacity: At least <strong>128 bytes</strong> across all Vulkan devices.</li>
        <li>Zero memory allocation: No <code>VkBuffer</code> or <code>VkDeviceMemory</code> needed.</li>
        <li>Zero descriptor sets: No descriptor pool or descriptor sets needed.</li>
      </ul>
      <pre><code>// Recording push constants
struct PushConstants {
    glm::vec2 offset;
    glm::vec4 color;
};
PushConstants constants{ {0.5f, 0.0f}, {1.0f, 0.2f, 0.2f, 1.0f} };
vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(constants), &constants);</code></pre>
      <p><a class="btn goto-sim" href="#/VK6.4/sim">Try it: test struct alignment traps and push constant data flow →</a></p>
    `,
    keyFormulas: [
      ["std140 alignment rule", String.raw`\operatorname{align}(\text{vec4}) = 16, \quad \operatorname{align}(\text{mat4}) = 16, \quad \text{offset} \equiv 0 \pmod{16}`],
      ["Push constant command", String.raw`\text{vkCmdPushConstants}(\text{cmd}, \text{layout}, \text{stages}, \text{offset}=0, \text{size}, \&\text{data})`],
    ],
    exercises: [
      { q: "Why does placing a glm::vec2 immediately before a glm::mat4 cause a bug without alignas(16)?", a: "Standard C++ places the mat4 at offset 8, but GLSL std140 requires mat4 columns to align to 16 bytes (offset 16), misaligning all subsequent matrix floats." },
      { q: "What is the minimum push constant size guaranteed by the Vulkan specification?", a: "128 bytes." },
      { q: "What are the advantages of push constants over uniform buffer objects?", a: "They require no VkBuffer allocation, no device memory binding, and no descriptor sets, updating directly through command buffers with minimal overhead." },
    ],
    cpp: [{
      title: "std140 Aligned Struct & Push Constants in C++",
      formula: String.raw`\text{alignas}(16) + \text{vkCmdPushConstants}`,
      note: "<p>Explicit alignment and command buffer push constant execution.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>
#include <glm/glm.hpp>

// Explicit std140 alignment
struct UniformBufferObject {
    alignas(16) glm::mat4 model;
    alignas(16) glm::mat4 view;
    alignas(16) glm::mat4 proj;
};

struct MeshPushConstants {
    glm::vec4 tintColor; // 16 bytes
    glm::vec2 screenOffset; // 8 bytes
};

void RecordPushConstants(VkCommandBuffer cmd, VkPipelineLayout layout,
                         const glm::vec4& color, const glm::vec2& offset)
{
    MeshPushConstants constants{};
    constants.tintColor = color;
    constants.screenOffset = offset;

    vkCmdPushConstants(cmd, layout,
                       VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT,
                       0, sizeof(MeshPushConstants), &constants);
}
`,
    }],
    csharp: [{
      title: "Explicit Struct Layout & Push Constants in C#",
      formula: String.raw`\text{vk.CmdPushConstants}`,
      note: "<p>Silk.NET push constants and field offset layout.</p>",
      code: String.raw`
using Silk.NET.Vulkan;
using System.Runtime.InteropServices;
using System.Numerics;

[StructLayout(LayoutKind.Explicit, Size = 192)]
public struct AlignedUbo
{
    [FieldOffset(0)]   public Matrix4x4 Model;
    [FieldOffset(64)]  public Matrix4x4 View;
    [FieldOffset(128)] public Matrix4x4 Proj;
}

public static unsafe void PushConstants(Vk vk, CommandBuffer cmd, PipelineLayout layout,
    Vector4 color, Vector2 offset)
{
    var data = new float[] { color.X, color.Y, color.Z, color.W, offset.X, offset.Y };
    fixed (float* pData = data)
    {
        vk.CmdPushConstants(cmd, layout,
            ShaderStageFlags.VertexBit | ShaderStageFlags.FragmentBit,
            0, (uint)(data.Length * sizeof(float)), pData);
    }
}
`,
    }],
    sims: [{ title: "Memory alignment & push constants inspector", help: "<p>Compare byte packing between standard C++ and SPIR-V std140. See how alignas(16) fixes the offset mismatch and inspect push constant registers.</p>", mount: simAlignmentPushConstants }],
  });

  // ------------------------------------------------------------ Simulations
  function simDescriptorSetLayout(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const stageMask = sim.segmented(controls, { label: "Shader Stage Access", options: [["vert", "VERTEX_BIT"], ["frag", "FRAGMENT_BIT"], ["all", "ALL_GRAPHICS"]], value: "vert", onChange: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const sm = stageMask.value;

      // GLSL Shader Code Block
      view.rect([-4.5, 1.0], [-1.5, 3.2], { color: "b", fill: "b", fillAlpha: 0.15 });
      view.text([-3.0, 2.8], "GLSL Shader", { align: "center", color: "fg", size: 11, bold: true });
      view.text([-3.0, 2.0], "layout(binding = 0)\nuniform UBO {\n  mat4 mvp;\n};", { align: "center", color: "b", size: 9 });

      // VkDescriptorSetLayoutBinding
      view.rect([-0.8, 0.6], [2.2, 3.4], { color: "c", fill: "c", fillAlpha: 0.2 });
      view.text([0.7, 3.0], "VkDescriptorSetLayout", { align: "center", color: "c", size: 12, bold: true });
      view.text([0.7, 2.3], "Binding: 0\nType: UNIFORM_BUFFER\nCount: 1", { align: "center", color: "fg", size: 9 });
      view.text([0.7, 1.4], `Stage: ${sm.toUpperCase()}`, { align: "center", color: "a", size: 9, bold: true });

      // Connecting arrow
      view.arrow([-1.5, 2.1], [-0.8, 2.1], { color: "a", label: "Matches" });

      // Pipeline Layout
      view.rect([2.8, 1.0], [4.5, 3.2], { color: "g", fill: "g", fillAlpha: 0.15 });
      view.text([3.65, 2.8], "VkPipelineLayout", { align: "center", color: "g", size: 11, bold: true });
      view.text([3.65, 2.0], "pSetLayouts[0]\n(Slot 0)", { align: "center", color: "fg", size: 9 });

      view.arrow([2.2, 2.1], [2.8, 2.1], { color: "g" });

      // Detail summary
      view.rect([-4.5, -2.6], [4.5, 0.0], { color: "muted", fill: "panel", fillAlpha: 0.5 });
      view.text([-4.2, -0.4], "Descriptor Contract Summary:", { color: "fg", size: 11, bold: true });
      view.text([-4.0, -1.0], "1. Shader declares layout(binding = 0) uniform block", { color: "muted", size: 9 });
      view.text([-4.0, -1.5], `2. Set layout binds slot 0 with stageFlags = VK_SHADER_STAGE_${sm.toUpperCase()}`, { color: "a", size: 9 });
      view.text([-4.0, -2.0], "3. Graphics pipeline is baked with this layout signature", { color: "muted", size: 9 });

      out.set(sim.rows([
        ["Binding Slot", "Binding 0"],
        ["Descriptor Type", "VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER"],
        ["Stage Visibility", sm === "vert" ? "Vertex Shader Only" : (sm === "frag" ? "Fragment Shader Only" : "Vertex + Fragment Stages")],
        ["Array Count", "1 Descriptor"],
      ]));
    });
  }

  function simUniformBuffers(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const angle = sim.slider(controls, { label: "Model Rotation Angle", min: 0, max: 360, step: 15, value: 45, onInput: () => v.redraw() });
    const frameIdx = sim.segmented(controls, { label: "Active Frame in Flight", options: [["0", "Frame 0"], ["1", "Frame 1"]], value: "0", onChange: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const deg = angle.value;
      const rad = (deg * Math.PI) / 180;
      const f = frameIdx.value;

      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      // Rotating wireframe quad on left
      const pts = [
        [-3.0 + 1.2 * (cos - sin), 1.0 + 1.2 * (sin + cos)],
        [-3.0 + 1.2 * (-cos - sin), 1.0 + 1.2 * (-sin + cos)],
        [-3.0 + 1.2 * (-cos + sin), 1.0 + 1.2 * (-sin - cos)],
        [-3.0 + 1.2 * (cos + sin), 1.0 + 1.2 * (sin - cos)],
      ];

      view.line(pts[0], pts[1], { color: "a", width: 2 });
      view.line(pts[1], pts[2], { color: "a", width: 2 });
      view.line(pts[2], pts[3], { color: "a", width: 2 });
      view.line(pts[3], pts[0], { color: "a", width: 2 });
      view.text([-3.0, 1.0], `Rot: ${deg}°`, { align: "center", color: "fg", size: 10, bold: true });

      // Persistent Memory Inspector on Right
      view.rect([0.0, -0.6], [4.5, 3.2], { color: "c", fill: "c", fillAlpha: 0.15 });
      view.text([2.25, 2.9], `UBO Memory [Frame ${f}]`, { align: "center", color: "c", size: 11, bold: true });
      view.text([2.25, 2.3], "Persistent Pointer: uniformBuffersMapped[" + f + "]", { align: "center", color: "muted", size: 8 });

      // Matrix float rows
      view.rect([0.3, 0.8], [4.2, 1.9], { color: "panel", fill: "panel", fillAlpha: 0.8 });
      view.text([0.5, 1.6], `[0]: ${fmt(cos, 3)}  [4]: ${fmt(-sin, 3)}  [8]: 0.000  [12]: 0.000`, { color: "a", size: 8 });
      view.text([0.5, 1.3], `[1]: ${fmt(sin, 3)}  [5]: ${fmt(cos, 3)}   [9]: 0.000  [13]: 0.000`, { color: "a", size: 8 });
      view.text([0.5, 1.0], `[2]: 0.000  [6]: 0.000   [10]: 1.000  [14]: 0.000`, { color: "muted", size: 8 });

      view.text([2.25, 0.1], "Vulkan Y-flip: proj[1][1] = -1.0", { align: "center", color: "g", size: 9, bold: true });

      // Frame isolation banner
      view.rect([-4.5, -2.6], [4.5, -1.2], { color: "muted", fill: "panel", fillAlpha: 0.6 });
      view.text([0, -1.6], `Frame ${f} UBO is isolated: GPU renders Frame ${1 - f} without memory races`, { align: "center", color: "g", size: 10, bold: true });
      view.text([0, -2.1], "Persistent mapping keeps pointer open: ZERO vkMapMemory overhead per frame", { align: "center", color: "fg", size: 9 });

      out.set(sim.rows([
        ["Target Frame", `Frame in Flight #${f}`],
        ["Model Rotation", `${deg}°`],
        ["Model[0][0] (cos)", fmt(cos, 4)],
        ["Model[0][1] (sin)", fmt(sin, 4)],
        ["UBO Struct Size", "192 bytes (3 x 64B mat4)"],
        ["Mapping Mode", "Persistent (Mapped once at startup)"],
      ]));
    });
  }

  function simDescriptorPool(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const poolCapacity = sim.slider(controls, { label: "Pool maxSets Quota", min: 1, max: 4, step: 1, value: 2, onInput: () => v.redraw() });
    const allocCount = sim.slider(controls, { label: "Sets to Allocate", min: 1, max: 4, step: 1, value: 2, onInput: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const cap = poolCapacity.value;
      const req = allocCount.value;
      const overflows = req > cap;

      // Descriptor Pool Box
      view.rect([-4.5, 0.8], [4.5, 3.2], { color: overflows ? "err" : "g", fill: overflows ? "err" : "g", fillAlpha: 0.15 });
      view.text([-4.2, 2.9], `VkDescriptorPool (Capacity: ${cap} Sets)`, { color: overflows ? "err" : "g", size: 12, bold: true });
      view.text([-4.2, 2.3], `Descriptor Type: VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER (Count: ${cap})`, { color: "fg", size: 9 });

      // Slots inside pool
      for (let i = 0; i < cap; i++) {
        const x0 = -4.0 + i * 2.1;
        const x1 = x0 + 1.8;
        const isOccupied = i < req && !overflows;
        view.rect([x0, 1.0], [x1, 1.9], { color: isOccupied ? "c" : "muted", fill: isOccupied ? "c" : "panel", fillAlpha: isOccupied ? 0.35 : 0.1 });
        view.text([(x0 + x1) / 2, 1.55], `Set #${i}`, { align: "center", color: isOccupied ? "fg" : "muted", size: 9, bold: isOccupied });
        view.text([(x0 + x1) / 2, 1.25], isOccupied ? "ALLOCATED" : "Free Slot", { align: "center", color: isOccupied ? "c" : "muted", size: 7 });
      }

      // Allocation Status Box
      view.rect([-4.5, -2.6], [4.5, 0.2], { color: overflows ? "err" : "c", fill: "panel", fillAlpha: 0.6 });
      if (overflows) {
        view.text([0, -0.6], "ALLOCATION FAILED: VK_ERROR_OUT_OF_POOL_MEMORY", { align: "center", color: "err", size: 12, bold: true });
        view.text([0, -1.4], `Requested ${req} sets, but pool maxSets is only ${cap}. Increase pool capacity!`, { align: "center", color: "fg", size: 10 });
      } else {
        view.text([0, -0.4], `Successfully Allocated ${req} Descriptor Sets`, { align: "center", color: "g", size: 12, bold: true });
        view.text([0, -1.0], "vkUpdateDescriptorSets executed: Buffers bound to binding 0", { align: "center", color: "fg", size: 10 });
        view.text([0, -1.7], `Ready for vkCmdBindDescriptorSets on ${req} frames in flight`, { align: "center", color: "a", size: 9 });
      }

      out.set(sim.rows([
        ["Pool Quota", `${cap} maxSets`],
        ["Requested Allocations", `${req} sets`],
        ["Allocation Status", overflows ? "ERROR: VK_ERROR_OUT_OF_POOL_MEMORY" : "SUCCESS (VK_SUCCESS)"],
        ["Bound Uniform Buffers", overflows ? "0" : `${req} Buffers (One per set)`],
      ]));
    });
  }

  function simAlignmentPushConstants(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const alignFix = sim.checkbox(controls, { label: "Use alignas(16) in C++ struct", value: true, onChange: () => v.redraw() });
    const pushMode = sim.checkbox(controls, { label: "Show Push Constants Data Stream", value: true, onChange: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const hasAlign = alignFix.value;
      const showPush = pushMode.value;

      // C++ Struct Box
      view.rect([-4.5, 1.0], [-0.5, 3.2], { color: "b", fill: "b", fillAlpha: 0.15 });
      view.text([-2.5, 2.8], "C++ Struct Layout", { align: "center", color: "b", size: 11, bold: true });
      view.text([-2.5, 2.2], "vec2 foo; (Offsets 0..7)", { align: "center", color: "fg", size: 9 });
      view.text([-2.5, 1.5], hasAlign ? "alignas(16) mat4 bar; (Offsets 16..79)" : "mat4 bar; (Offsets 8..71: MISALIGNED!)", { align: "center", color: hasAlign ? "g" : "err", size: 8, bold: true });

      // GLSL std140 Expectation Box
      view.rect([0.5, 1.0], [4.5, 3.2], { color: "c", fill: "c", fillAlpha: 0.15 });
      view.text([2.5, 2.8], "SPIR-V std140 Layout", { align: "center", color: "c", size: 11, bold: true });
      view.text([2.5, 2.2], "vec2 foo; (Offsets 0..7)", { align: "center", color: "fg", size: 9 });
      view.text([2.5, 1.5], "mat4 bar; (MUST start at offset 16)", { align: "center", color: "c", size: 8, bold: true });

      // Status indicator
      view.rect([-4.5, -0.6], [4.5, 0.4], { color: hasAlign ? "g" : "err", fill: hasAlign ? "g" : "err", fillAlpha: 0.2 });
      view.text([0, 0.0], hasAlign ? "ALIGNED: C++ offsets match std140 shader offsets perfectly!" : "CORRUPTED: C++ offset 8 != Shader offset 16! Triangles distorted!", { align: "center", color: hasAlign ? "g" : "err", size: 10, bold: true });

      // Push Constants Stream
      view.rect([-4.5, -2.6], [4.5, -1.0], { color: "a", fill: "panel", fillAlpha: 0.6 });
      view.text([-4.2, -1.3], "Push Constants (128 Bytes Direct GPU Command Stream):", { color: "a", size: 10, bold: true });
      view.text([-4.0, -1.8], showPush ? "vkCmdPushConstants(cmd, layout, STAGES, offset=0, size=24, &data) -> Directly in registers!" : "Disabled", { color: "fg", size: 9 });
      view.text([-4.0, -2.3], showPush ? "Zero buffer allocations. Zero descriptor sets. Maximum performance for tiny uniforms." : "", { color: "muted", size: 8 });

      out.set(sim.rows([
        ["Alignment Fix", hasAlign ? "alignas(16) Active" : "Default C++ Packing (BROKEN)"],
        ["C++ bar offset", hasAlign ? "Byte 16" : "Byte 8"],
        ["GLSL bar offset", "Byte 16 (Mandatory std140 rule)"],
        ["Shader Data Integrity", hasAlign ? "VALID" : "CORRUPTED MEMORY"],
        ["Push Constants Capacity", "At least 128 bytes (Spec guaranteed)"],
      ]));
    });
  }
})();
