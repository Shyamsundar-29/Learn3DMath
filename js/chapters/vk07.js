// Learn Vulkan — Chapter 7: Images, Textures & Samplers
(function () {
  "use strict";
  const { fmt } = L3D.math;

  L3D.topic({
    id: "VK7.1",
    summary: "VkImage objects hold multi-dimensional texels, using optimal swizzled tiling in device-local memory to maximize 2D cache locality for GPU texture units.",
    lesson: String.raw`
      <p><strong>A texture is fundamentally different from a raw vertex buffer.</strong> While a vertex buffer is a linear array of geometric coordinates, a texture is a multi-dimensional array of texels with spatial neighborhood relationships in 2D or 3D space.</p>
      <div class="key"><p>In Vulkan, textures are represented by <code>VkImage</code> objects. Unlike linear buffers, images support hardware-optimized memory layouts called <strong>Tiling</strong>, enabling the GPU's texture sampling units to retrieve neighboring texels at maximum speed.</p></div>

      <h2 data-sub="VK7.1.1">VkImage vs VkBuffer</h2>
      <p>A <code>VkBuffer</code> is simply a contiguous sequence of unformatted bytes. A <code>VkImage</code>, by contrast, possesses rich hardware metadata:</p>
      <ul>
        <li><strong>Dimensionality:</strong> 1D (sound curves/gradients), 2D (textures, render targets), or 3D (volumetric fog, medical scans).</li>
        <li><strong>Format:</strong> Defines color channels and bit depths (e.g. <code>VK_FORMAT_R8G8B8A8_SRGB</code>, <code>VK_FORMAT_R16G16B16A16_SFLOAT</code>).</li>
        <li><strong>Mip Levels:</strong> Pre-downsampled resolutions for anti-aliasing in the distance.</li>
        <li><strong>Array Layers:</strong> Multiple layers (e.g. 6 faces for a cubemap, or 2 layers for VR stereo).</li>
      </ul>

      <h2 data-sub="VK7.1.2">Linear vs optimal tiling</h2>
      <p>When creating a <code>VkImage</code>, you must specify its memory tiling mode:</p>
      <ul>
        <li><code>VK_IMAGE_TILING_LINEAR</code>: Texels are stored row-by-row in row-major order, like a standard 2D C array. While the CPU can directly write to linear images, reading adjacent vertical pixels causes massive cache misses on the GPU.</li>
        <li><code>VK_IMAGE_TILING_OPTIMAL</code>: Texels are arranged in a proprietary, vendor-specific swizzled pattern (such as a <strong>Morton Z-order curve</strong> or micro-tile blocks). Texels that are close to each other in 2D space are guaranteed to reside in the exact same GPU cache line! Optimal tiling is mandatory for high-performance texture sampling.</li>
      </ul>

      <h2 data-sub="VK7.1.3">Image creation & memory allocation</h2>
      <p>Because the CPU cannot directly write into optimal tiling memory, textures are created in <code>DEVICE_LOCAL</code> memory using the staging pattern:</p>
      <pre><code>VkImageCreateInfo imageInfo{};
imageInfo.sType = VK_STRUCTURE_TYPE_IMAGE_CREATE_INFO;
imageInfo.imageType = VK_IMAGE_TYPE_2D;
imageInfo.extent.width = width;
imageInfo.extent.height = height;
imageInfo.extent.depth = 1;
imageInfo.mipLevels = 1;
imageInfo.arrayLayers = 1;
imageInfo.format = VK_FORMAT_R8G8B8A8_SRGB;
imageInfo.tiling = VK_IMAGE_TILING_OPTIMAL;
imageInfo.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
imageInfo.usage = VK_IMAGE_USAGE_TRANSFER_DST_BIT | VK_IMAGE_USAGE_SAMPLED_BIT;
imageInfo.sharingMode = VK_SHARING_MODE_EXCLUSIVE;
imageInfo.samples = VK_SAMPLE_COUNT_1_BIT;

vkCreateImage(device, &imageInfo, nullptr, &textureImage);

VkMemoryRequirements memRequirements;
vkGetImageMemoryRequirements(device, textureImage, &memRequirements);

VkMemoryAllocateInfo allocInfo{};
allocInfo.sType = VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO;
allocInfo.allocationSize = memRequirements.size;
allocInfo.memoryTypeIndex = FindMemoryType(physicalDevice, memRequirements.memoryTypeBits,
                                          VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT);

vkAllocateMemory(device, &allocInfo, nullptr, &textureImageMemory);
vkBindImageMemory(device, textureImage, textureImageMemory, 0);</code></pre>
      <p><a class="btn goto-sim" href="#/VK7.1/sim">Try it: compare linear row memory vs optimal swizzled tiling →</a></p>
    `,
    keyFormulas: [
      ["Morton Z-order curve", String.raw`\operatorname{Morton}(x, y) = \sum_{i=0}^{n-1} \left( x_i \cdot 2^{2i} + y_i \cdot 2^{2i+1} \right)`],
      ["Image allocation size", String.raw`\text{memReq.size} \ge \text{width} \times \text{height} \times \text{bpp} + \text{HardwarePadding}`],
    ],
    exercises: [
      { q: "Why shouldn't you use VK_IMAGE_TILING_LINEAR for textures sampled by shaders?", a: "Linear tiling has terrible 2D cache locality when sampling vertically adjacent pixels, leading to heavy cache misses and reduced GPU throughput." },
      { q: "Can the CPU directly write to a VK_IMAGE_TILING_OPTIMAL image using memcpy?", a: "No. Optimal tiling memory patterns are proprietary to the GPU hardware; data must be copied from a staging buffer via vkCmdCopyBufferToImage." },
      { q: "What usage flags are required for a texture loaded from a file and sampled in shaders?", a: "VK_IMAGE_USAGE_TRANSFER_DST_BIT (to receive staging data) and VK_IMAGE_USAGE_SAMPLED_BIT (to be read by shaders)." },
    ],
    cpp: [{
      title: "Creating Optimal Texture Image in C++",
      formula: String.raw`\text{vkCreateImage} + \text{vkAllocateMemory} + \text{vkBindImageMemory}`,
      note: "<p>Allocates an optimal 2D image in device-local memory.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>

void CreateImage(VkDevice device, VkPhysicalDevice physicalDevice,
                 uint32_t width, uint32_t height, VkFormat format,
                 VkImageTiling tiling, VkImageUsageFlags usage,
                 VkMemoryPropertyFlags properties,
                 VkImage& outImage, VkDeviceMemory& outMemory)
{
    VkImageCreateInfo imageInfo{};
    imageInfo.sType = VK_STRUCTURE_TYPE_IMAGE_CREATE_INFO;
    imageInfo.imageType = VK_IMAGE_TYPE_2D;
    imageInfo.extent.width = width;
    imageInfo.extent.height = height;
    imageInfo.extent.depth = 1;
    imageInfo.mipLevels = 1;
    imageInfo.arrayLayers = 1;
    imageInfo.format = format;
    imageInfo.tiling = tiling;
    imageInfo.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
    imageInfo.usage = usage;
    imageInfo.samples = VK_SAMPLE_COUNT_1_BIT;
    imageInfo.sharingMode = VK_SHARING_MODE_EXCLUSIVE;

    if (vkCreateImage(device, &imageInfo, nullptr, &outImage) != VK_SUCCESS) {
        throw std::runtime_error("Failed to create image!");
    }

    VkMemoryRequirements memRequirements;
    vkGetImageMemoryRequirements(device, outImage, &memRequirements);

    VkMemoryAllocateInfo allocInfo{};
    allocInfo.sType = VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO;
    allocInfo.allocationSize = memRequirements.size;
    allocInfo.memoryTypeIndex = FindMemoryType(physicalDevice, memRequirements.memoryTypeBits, properties);

    if (vkAllocateMemory(device, &allocInfo, nullptr, &outMemory) != VK_SUCCESS) {
        throw std::runtime_error("Failed to allocate image memory!");
    }

    vkBindImageMemory(device, outImage, outMemory, 0);
}
`,
    }],
    csharp: [{
      title: "Creating Texture Image in C#",
      formula: String.raw`\text{vk.CreateImage}`,
      note: "<p>Silk.NET optimal image creation and memory binding.</p>",
      code: String.raw`
using Silk.NET.Vulkan;

public static unsafe void CreateImage(Vk vk, Device device, PhysicalDevice physDevice,
    uint width, uint height, Format format, ImageUsageFlags usage,
    out Image image, out DeviceMemory memory)
{
    var imageInfo = new ImageCreateInfo
    {
        SType = StructureType.ImageCreateInfo,
        ImageType = ImageType.Type2D,
        Extent = new Extent3D(width, height, 1),
        MipLevels = 1,
        ArrayLayers = 1,
        Format = format,
        Tiling = ImageTiling.Optimal,
        InitialLayout = ImageLayout.Undefined,
        Usage = usage,
        Samples = SampleCountFlags.Count1Bit,
        SharingMode = SharingMode.Exclusive,
    };

    vk.CreateImage(device, ref imageInfo, null, out image);

    MemoryRequirements reqs;
    vk.GetImageMemoryRequirements(device, image, out reqs);

    var allocInfo = new MemoryAllocateInfo
    {
        SType = StructureType.MemoryAllocateInfo,
        AllocationSize = reqs.Size,
        MemoryTypeIndex = 0, // Match DEVICE_LOCAL type index
    };

    vk.AllocateMemory(device, ref allocInfo, null, out memory);
    vk.BindImageMemory(device, image, memory, 0);
}
`,
    }],
    sims: [{ title: "Linear vs optimal swizzled tiling memory visualizer", help: "<p>Compare 2D texture memory access. See how linear tiling causes cache line jumps across rows, while optimal Morton Z-order tiling keeps 2D neighborhoods in cache.</p>", mount: simOptimalTiling }],
  });

  L3D.topic({
    id: "VK7.2",
    summary: "Image layout transitions synchronize GPU caches and reconfigure hardware compression using pipeline barriers and access masks.",
    lesson: String.raw`
      <p><strong>GPU hardware optimizes image memory representation based on the task being performed.</strong> When writing to an image as a transfer target, the memory controller prepares for sequential writes; when reading in a fragment shader, hardware compression and read caches are activated.</p>
      <div class="key"><p>In Vulkan, you must explicitly inform the GPU when an image transitions between tasks using a <strong>Pipeline Barrier</strong> (<code>vkCmdPipelineBarrier</code>) containing a <code>VkImageMemoryBarrier</code>.</p></div>

      <h2 data-sub="VK7.2.1">Image layouts in Vulkan</h2>
      <p>Key image layouts include:</p>
      <ul>
        <li><code>VK_IMAGE_LAYOUT_UNDEFINED</code>: Initial state. The GPU does not preserve existing texels.</li>
        <li><code>VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL</code>: Target for copy commands like <code>vkCmdCopyBufferToImage</code>.</li>
        <li><code>VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL</code>: Read-only access by texture sampling units in fragment shaders.</li>
        <li><code>VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL</code>: Target for drawing during a render pass.</li>
        <li><code>VK_IMAGE_LAYOUT_PRESENT_SRC_KHR</code>: Read by the display engine to present to the monitor.</li>
      </ul>

      <h2 data-sub="VK7.2.2">VkImageMemoryBarrier</h2>
      <p>An image memory barrier dictates the transition parameters:</p>
      <pre><code>VkImageMemoryBarrier barrier{};
barrier.sType = VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER;
barrier.oldLayout = oldLayout;
barrier.newLayout = newLayout;
barrier.srcQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
barrier.dstQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
barrier.image = image;
barrier.subresourceRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
barrier.subresourceRange.baseMipLevel = 0;
barrier.subresourceRange.levelCount = 1;
barrier.subresourceRange.baseArrayLayer = 0;
barrier.subresourceRange.layerCount = 1;</code></pre>

      <h2 data-sub="VK7.2.3">Pipeline stages & access masks</h2>
      <p>The barrier must define the execution stages and memory access masks that govern the transition:</p>
      <table>
        <tr><th>Transition</th><th>srcAccessMask \(\to\) dstAccessMask</th><th>srcStageMask \(\to\) dstStageMask</th></tr>
        <tr><td>Undefined \(\to\) Transfer Dst</td><td><code>0</code> \(\to\) <code>VK_ACCESS_TRANSFER_WRITE_BIT</code></td><td><code>TOP_OF_PIPE_BIT</code> \(\to\) <code>TRANSFER_BIT</code></td></tr>
        <tr><td>Transfer Dst \(\to\) Shader Read</td><td><code>VK_ACCESS_TRANSFER_WRITE_BIT</code> \(\to\) <code>VK_ACCESS_SHADER_READ_BIT</code></td><td><code>TRANSFER_BIT</code> \(\to\) <code>FRAGMENT_SHADER_BIT</code></td></tr>
      </table>
      <p>This guarantees that the transfer write completes and flushes GPU write caches before the fragment shader begins reading.</p>
      <p><a class="btn goto-sim" href="#/VK7.2/sim">Try it: trace layout transitions and pipeline barriers →</a></p>
    `,
    keyFormulas: [
      ["Pipeline barrier invocation", String.raw`\text{vkCmdPipelineBarrier}(\text{cmd}, \text{srcStage}, \text{dstStage}, 0, 0, \text{null}, 0, \text{null}, 1, \&\text{barrier})`],
      ["Cache flush and invalidate", String.raw`\text{WriteCache (Transfer)} \xrightarrow{\text{Flush}} \text{VRAM} \xrightarrow{\text{Invalidate}} \text{ReadCache (Fragment Shader)}`],
    ],
    exercises: [
      { q: "Why can oldLayout be VK_IMAGE_LAYOUT_UNDEFINED when transitioning a newly created image?", a: "Because the image does not contain any valid pixels yet, allowing the driver to discard memory contents and execute the fastest possible transition." },
      { q: "What is the purpose of srcAccessMask and dstAccessMask?", a: "They specify memory cache operations, ensuring GPU write caches are flushed and read caches are invalidated so shaders see the newest texel values." },
      { q: "Which pipeline stage mask represents the start of the pipeline before any operations execute?", a: "VK_PIPELINE_STAGE_TOP_OF_PIPE_BIT." },
    ],
    cpp: [{
      title: "Image Layout Transition Helper in C++",
      formula: String.raw`\text{TransitionImageLayout}(\text{image}, \text{oldLayout}, \text{newLayout})`,
      note: "<p>Configures barrier access flags and records vkCmdPipelineBarrier.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>

void TransitionImageLayout(VkDevice device, VkCommandPool commandPool, VkQueue graphicsQueue,
                           VkImage image, VkFormat format,
                           VkImageLayout oldLayout, VkImageLayout newLayout)
{
    VkCommandBuffer commandBuffer = BeginSingleTimeCommands(device, commandPool);

    VkImageMemoryBarrier barrier{};
    barrier.sType = VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER;
    barrier.oldLayout = oldLayout;
    barrier.newLayout = newLayout;
    barrier.srcQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
    barrier.dstQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
    barrier.image = image;
    barrier.subresourceRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
    barrier.subresourceRange.baseMipLevel = 0;
    barrier.subresourceRange.levelCount = 1;
    barrier.subresourceRange.baseArrayLayer = 0;
    barrier.subresourceRange.layerCount = 1;

    VkPipelineStageFlags sourceStage;
    VkPipelineStageFlags destinationStage;

    if (oldLayout == VK_IMAGE_LAYOUT_UNDEFINED &&
        newLayout == VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL)
    {
        barrier.srcAccessMask = 0;
        barrier.dstAccessMask = VK_ACCESS_TRANSFER_WRITE_BIT;
        sourceStage = VK_PIPELINE_STAGE_TOP_OF_PIPE_BIT;
        destinationStage = VK_PIPELINE_STAGE_TRANSFER_BIT;
    }
    else if (oldLayout == VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL &&
             newLayout == VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL)
    {
        barrier.srcAccessMask = VK_ACCESS_TRANSFER_WRITE_BIT;
        barrier.dstAccessMask = VK_ACCESS_SHADER_READ_BIT;
        sourceStage = VK_PIPELINE_STAGE_TRANSFER_BIT;
        destinationStage = VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT;
    }

    vkCmdPipelineBarrier(commandBuffer, sourceStage, destinationStage, 0,
                         0, nullptr, 0, nullptr, 1, &barrier);

    EndSingleTimeCommands(device, commandPool, graphicsQueue, commandBuffer);
}
`,
    }],
    csharp: [{
      title: "Pipeline Barrier in C#",
      formula: String.raw`\text{vk.CmdPipelineBarrier}`,
      note: "<p>Silk.NET image memory barrier execution.</p>",
      code: String.raw`
using Silk.NET.Vulkan;

public static unsafe void TransitionLayout(Vk vk, CommandBuffer cmd, Image image,
    ImageLayout oldLayout, ImageLayout newLayout,
    AccessFlags srcAccess, AccessFlags dstAccess,
    PipelineStageFlags srcStage, PipelineStageFlags dstStage)
{
    var barrier = new ImageMemoryBarrier
    {
        SType = StructureType.ImageMemoryBarrier,
        OldLayout = oldLayout,
        NewLayout = newLayout,
        SrcQueueFamilyIndex = Vk.QueueFamilyIgnored,
        DstQueueFamilyIndex = Vk.QueueFamilyIgnored,
        Image = image,
        SubresourceRange = new ImageSubresourceRange
        {
            AspectMask = ImageAspectFlags.ColorBit,
            BaseMipLevel = 0,
            LevelCount = 1,
            BaseArrayLayer = 0,
            LayerCount = 1,
        },
        SrcAccessMask = srcAccess,
        DstAccessMask = dstAccess,
    };

    vk.CmdPipelineBarrier(cmd, srcStage, dstStage, 0, 0, null, 0, null, 1, ref barrier);
}
`,
    }],
    sims: [{ title: "Image layout transition state machine", help: "<p>Step through image transitions: UNDEFINED -> TRANSFER_DST -> SHADER_READ_ONLY. Observe pipeline barrier stages and GPU cache flush triggers.</p>", mount: simImageLayoutBarrier }],
  });

  L3D.topic({
    id: "VK7.3",
    summary: "Pixel bytes loaded from image files are staged in host memory and transferred into optimal GPU images using vkCmdCopyBufferToImage.",
    lesson: String.raw`
      <p><strong>Loading an image from disk involves transitioning from raw file bytes to optimal GPU texels.</strong> Real applications use image libraries like <code>stb_image.h</code> to decompress PNG or JPEG files into an array of RGBA pixel bytes in system memory.</p>
      <div class="key"><p>Because GPU textures use optimal swizzled tiling, you cannot copy CPU pixel bytes directly into texture VRAM. Instead, you load pixels into a CPU-writable <strong>Staging Buffer</strong> and execute <code>vkCmdCopyBufferToImage</code> on the GPU.</p></div>

      <h2 data-sub="VK7.3.1">Staging image data in host buffer</h2>
      <p>Loading an image with <code>stb_image.h</code>:</p>
      <pre><code>int texWidth, texHeight, texChannels;
stbi_uc* pixels = stbi_load("textures/texture.jpg", &texWidth, &texHeight, &texChannels, STBI_rgb_alpha);
VkDeviceSize imageSize = texWidth * texHeight * 4;

VkBuffer stagingBuffer;
VkDeviceMemory stagingBufferMemory;
CreateBuffer(device, physicalDevice, imageSize, VK_BUFFER_USAGE_TRANSFER_SRC_BIT,
             VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT,
             stagingBuffer, stagingBufferMemory);

void* data;
vkMapMemory(device, stagingBufferMemory, 0, imageSize, 0, &data);
memcpy(data, pixels, static_cast<size_t>(imageSize));
vkUnmapMemory(device, stagingBufferMemory);
stbi_image_free(pixels); // Free host RAM immediately</code></pre>

      <h2 data-sub="VK7.3.2">vkCmdCopyBufferToImage</h2>
      <p>Before issuing the copy command, the destination image must be transitioned to <code>VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL</code>. Then, configure a <code>VkBufferImageCopy</code> struct:</p>
      <pre><code>VkBufferImageCopy region{};
region.bufferOffset = 0;
region.bufferRowLength = 0; // Tightly packed
region.bufferImageHeight = 0;
region.imageSubresource.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
region.imageSubresource.mipLevel = 0;
region.imageSubresource.baseArrayLayer = 0;
region.imageSubresource.layerCount = 1;
region.imageOffset = {0, 0, 0};
region.imageExtent = { static_cast<uint32_t>(texWidth), static_cast<uint32_t>(texHeight), 1 };

vkCmdCopyBufferToImage(commandBuffer, stagingBuffer, textureImage,
                       VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL, 1, &region);</code></pre>

      <h2 data-sub="VK7.3.3">Shader read-only transition</h2>
      <p>Finally, transition the image layout from <code>VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL</code> to <code>VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL</code>. Once the transfer command buffer finishes execution, the staging buffer is safely destroyed with <code>vkDestroyBuffer</code> and <code>vkFreeMemory</code>.</p>
      <p><a class="btn goto-sim" href="#/VK7.3/sim">Try it: trace buffer-to-image staging copies →</a></p>
    `,
    keyFormulas: [
      ["Texture memory footprint", String.raw`\text{Size} = \text{width} \times \text{height} \times 4 \text{ bytes (RGBA8)}`],
      ["Buffer-to-image command", String.raw`\text{vkCmdCopyBufferToImage}(\text{cmd}, \text{stagingBuf}, \text{image}, \text{TRANSFER\_DST}, 1, \&\text{region})`],
    ],
    exercises: [
      { q: "What does setting bufferRowLength = 0 mean in VkBufferImageCopy?", a: "It indicates that texel rows are tightly packed in the buffer without extra padding bytes between rows." },
      { q: "In what layout must an image be before executing vkCmdCopyBufferToImage?", a: "VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL." },
      { q: "When is it safe to free the CPU pixel buffer returned by stbi_load?", a: "Immediately after copying the bytes into the host-visible staging buffer with memcpy." },
    ],
    cpp: [{
      title: "Buffer to Image Copy in C++",
      formula: String.raw`\text{vkCmdCopyBufferToImage}`,
      note: "<p>Executes DMA transfer from staging buffer into optimal image.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>

void CopyBufferToImage(VkDevice device, VkCommandPool commandPool, VkQueue graphicsQueue,
                       VkBuffer buffer, VkImage image, uint32_t width, uint32_t height)
{
    VkCommandBuffer commandBuffer = BeginSingleTimeCommands(device, commandPool);

    VkBufferImageCopy region{};
    region.bufferOffset = 0;
    region.bufferRowLength = 0;
    region.bufferImageHeight = 0;
    region.imageSubresource.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
    region.imageSubresource.mipLevel = 0;
    region.imageSubresource.baseArrayLayer = 0;
    region.imageSubresource.layerCount = 1;
    region.imageOffset = {0, 0, 0};
    region.imageExtent = { width, height, 1 };

    vkCmdCopyBufferToImage(commandBuffer, buffer, image,
                           VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL, 1, &region);

    EndSingleTimeCommands(device, commandPool, graphicsQueue, commandBuffer);
}
`,
    }],
    csharp: [{
      title: "Buffer to Image Copy in C#",
      formula: String.raw`\text{vk.CmdCopyBufferToImage}`,
      note: "<p>Silk.NET buffer-to-image copy command execution.</p>",
      code: String.raw`
using Silk.NET.Vulkan;

public static unsafe void CopyBufferToImage(Vk vk, CommandBuffer cmd,
    Silk.NET.Vulkan.Buffer buffer, Image image, uint width, uint height)
{
    var region = new BufferImageCopy
    {
        BufferOffset = 0,
        BufferRowLength = 0,
        BufferImageHeight = 0,
        ImageSubresource = new ImageSubresourceLayers
        {
            AspectMask = ImageAspectFlags.ColorBit,
            MipLevel = 0,
            BaseArrayLayer = 0,
            LayerCount = 1,
        },
        ImageOffset = new Offset3D(0, 0, 0),
        ImageExtent = new Extent3D(width, height, 1),
    };

    vk.CmdCopyBufferToImage(cmd, buffer, image, ImageLayout.TransferDstOptimal, 1, ref region);
}
`,
    }],
    sims: [{ title: "Pixel staging & buffer-to-image DMA copy", help: "<p>Watch pixels transfer from a linear host buffer into an optimal 2D GPU texture. Notice how the GPU arranges texels into swizzled memory tiles.</p>", mount: simBufferToImageCopy }],
  });

  L3D.topic({
    id: "VK7.4",
    summary: "Image views wrap textures, while VkSampler objects configure filtering, wrap modes, and anisotropic filtering for combined image samplers in shaders.",
    lesson: String.raw`
      <p><strong>A texture image cannot be sampled directly by a shader.</strong> In Vulkan, the shader accesses a texture through a pair of objects: a <code>VkImageView</code> (which specifies format and subresource access) and a <code>VkSampler</code> (which specifies how pixels are filtered and interpolated).</p>
      <div class="key"><p>The <strong>Sampler</strong> encapsulates hardware filtering logic: nearest vs bilinear interpolation, wrapping modes (repeat, clamp to edge), and 16x anisotropic filtering to prevent blur on surfaces viewed at sharp angles.</p></div>

      <h2 data-sub="VK7.4.1">VkImageView for textures</h2>
      <p>We create an image view around our texture image with <code>VK_IMAGE_ASPECT_COLOR_BIT</code>:</p>
      <pre><code>VkImageViewCreateInfo viewInfo{};
viewInfo.sType = VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO;
viewInfo.image = textureImage;
viewInfo.viewType = VK_IMAGE_VIEW_TYPE_2D;
viewInfo.format = VK_FORMAT_R8G8B8A8_SRGB;
viewInfo.subresourceRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
viewInfo.subresourceRange.baseMipLevel = 0;
viewInfo.subresourceRange.levelCount = 1;
viewInfo.subresourceRange.baseArrayLayer = 0;
viewInfo.subresourceRange.layerCount = 1;
vkCreateImageView(device, &viewInfo, nullptr, &textureImageView);</code></pre>

      <h2 data-sub="VK7.4.2">VkSampler & filtering modes</h2>
      <p>A <code>VkSampler</code> does not hold image memory; it is a stateless hardware configuration object:</p>
      <ul>
        <li><code>magFilter</code> & <code>minFilter</code>: <code>VK_FILTER_LINEAR</code> for smooth bilinear interpolation, or <code>VK_FILTER_NEAREST</code> for pixelated retro art.</li>
        <li><code>addressModeU, V, W</code>:
          <ul>
            <li><code>VK_SAMPLER_ADDRESS_MODE_REPEAT</code>: Repeats texture when UV coordinates exceed 1.0.</li>
            <li><code>VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE</code>: Clamps coordinates to border pixels.</li>
          </ul>
        </li>
        <li><strong>Anisotropic Filtering:</strong>
          <pre><code>samplerInfo.anisotropyEnable = VK_TRUE;
samplerInfo.maxAnisotropy = properties.limits.maxSamplerAnisotropy; // usually 16.0f</code></pre>
        </li>
      </ul>

      <h2 data-sub="VK7.4.3">Combined image samplers in shaders</h2>
      <p>In GLSL, a texture and sampler are combined into a single binding:</p>
      <pre><code>layout(binding = 1) uniform sampler2D texSampler;

void main() {
    outColor = texture(texSampler, fragTexCoord);
}</code></pre>
      <p>In C++, you write descriptor updates using <code>VkDescriptorImageInfo</code>:</p>
      <pre><code>VkDescriptorImageInfo imageInfo{};
imageInfo.imageLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL;
imageInfo.imageView = textureImageView;
imageInfo.sampler = textureSampler;

VkWriteDescriptorSet descriptorWrite{};
descriptorWrite.sType = VK_STRUCTURE_TYPE_WRITE_DESCRIPTOR_SET;
descriptorWrite.dstSet = descriptorSets[i];
descriptorWrite.dstBinding = 1;
descriptorWrite.descriptorType = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;
descriptorWrite.descriptorCount = 1;
descriptorWrite.pImageInfo = &imageInfo;
vkUpdateDescriptorSets(device, 1, &descriptorWrite, 0, nullptr);</code></pre>
      <p><a class="btn goto-sim" href="#/VK7.4/sim">Try it: test texture filtering, wrapping, and anisotropic sampling →</a></p>
    `,
    keyFormulas: [
      ["Bilinear texel interpolation", String.raw`C(u, v) = (1-s)(1-t)C_{00} + s(1-t)C_{10} + (1-s)tC_{01} + stC_{11}`],
      ["Combined sampler descriptor", String.raw`\text{Descriptor}_{\text{Image}} = \langle \text{Sampler}, \text{ImageView}, \text{SHADER\_READ\_ONLY\_OPTIMAL} \rangle`],
    ],
    exercises: [
      { q: "What is the difference between nearest and linear texture filtering?", a: "Nearest picks the single closest texel (producing blocky pixels), while linear performs bilinear interpolation between the four surrounding texels (producing smooth gradients)." },
      { q: "What does anisotropic filtering accomplish?", a: "It samples texels along the direction of perspective distortion, keeping textures sharp at grazing angles without blur." },
      { q: "Can a single VkSampler be reused across multiple textures?", a: "Yes. Samplers are independent hardware configuration objects and can sample any number of compatible image views." },
    ],
    cpp: [{
      title: "Creating Texture Sampler in C++",
      formula: String.raw`\text{vkCreateSampler}(\text{device}, \&\text{samplerInfo}, \text{nullptr}, \&\text{sampler})`,
      note: "<p>Configures bilinear filtering and 16x anisotropic filtering.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>

VkSampler CreateTextureSampler(VkDevice device, VkPhysicalDevice physicalDevice) {
    VkPhysicalDeviceProperties properties{};
    vkGetPhysicalDeviceProperties(physicalDevice, &properties);

    VkSamplerCreateInfo samplerInfo{};
    samplerInfo.sType = VK_STRUCTURE_TYPE_SAMPLER_CREATE_INFO;
    samplerInfo.magFilter = VK_FILTER_LINEAR;
    samplerInfo.minFilter = VK_FILTER_LINEAR;
    samplerInfo.addressModeU = VK_SAMPLER_ADDRESS_MODE_REPEAT;
    samplerInfo.addressModeV = VK_SAMPLER_ADDRESS_MODE_REPEAT;
    samplerInfo.addressModeW = VK_SAMPLER_ADDRESS_MODE_REPEAT;
    samplerInfo.anisotropyEnable = VK_TRUE;
    samplerInfo.maxAnisotropy = properties.limits.maxSamplerAnisotropy;
    samplerInfo.borderColor = VK_BORDER_COLOR_INT_OPAQUE_BLACK;
    samplerInfo.unnormalizedCoordinates = VK_FALSE;
    samplerInfo.compareEnable = VK_FALSE;
    samplerInfo.mipmapMode = VK_SAMPLER_MIPMAP_MODE_LINEAR;

    VkSampler textureSampler;
    if (vkCreateSampler(device, &samplerInfo, nullptr, &textureSampler) != VK_SUCCESS) {
        throw std::runtime_error("Failed to create texture sampler!");
    }
    return textureSampler;
}
`,
    }],
    csharp: [{
      title: "Creating Texture Sampler in C#",
      formula: String.raw`\text{vk.CreateSampler}`,
      note: "<p>Silk.NET sampler configuration.</p>",
      code: String.raw`
using Silk.NET.Vulkan;

public static unsafe Sampler CreateSampler(Vk vk, Device device)
{
    var samplerInfo = new SamplerCreateInfo
    {
        SType = StructureType.SamplerCreateInfo,
        MagFilter = Filter.Linear,
        MinFilter = Filter.Linear,
        AddressModeU = SamplerAddressMode.Repeat,
        AddressModeV = SamplerAddressMode.Repeat,
        AddressModeW = SamplerAddressMode.Repeat,
        AnisotropyEnable = true,
        MaxAnisotropy = 16.0f,
        BorderColor = BorderColor.IntOpaqueBlack,
        UnnormalizedCoordinates = false,
        MipmapMode = SamplerMipmapMode.Linear,
    };

    Sampler sampler;
    if (vk.CreateSampler(device, ref samplerInfo, null, out sampler) != Result.Success)
        throw new System.Exception("Failed to create sampler!");

    return sampler;
}
`,
    }],
    sims: [{ title: "Texture sampler filtering & addressing visualizer", help: "<p>Toggle between Nearest and Linear filtering, adjust addressing modes (Repeat vs Clamp to Edge), and toggle 16x Anisotropic filtering.</p>", mount: simTextureSampler }],
  });

  // ------------------------------------------------------------ Simulations
  function simOptimalTiling(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const mode = sim.segmented(controls, { label: "Memory Tiling", options: [["linear", "LINEAR (Row Major)"], ["optimal", "OPTIMAL (Morton Swizzled)"]], value: "optimal", onChange: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const isOpt = mode.value === "optimal";

      // 4x4 Pixel Grid on Left
      view.rect([-4.5, 0.4], [-0.5, 3.2], { color: "c", fill: "c", fillAlpha: 0.1 });
      view.text([-2.5, 2.9], "2D Texel Grid (4x4)", { align: "center", color: "fg", size: 11, bold: true });

      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          const px = -4.0 + x * 0.8;
          const py = 2.2 - y * 0.55;
          const isSampled = (x === 1 || x === 2) && (y === 1 || y === 2);
          view.rect([px, py - 0.22], [px + 0.7, py + 0.22], { color: isSampled ? "a" : "muted", fill: isSampled ? "a" : "panel", fillAlpha: isSampled ? 0.4 : 0.1 });
          const id = isOpt ? (x & 1 | (y & 1) << 1 | (x & 2) << 1 | (y & 2) << 2) : (y * 4 + x);
          view.text([px + 0.35, py], `${id}`, { align: "center", color: isSampled ? "fg" : "muted", size: 8 });
        }
      }

      // 1D Linear VRAM Address Layout on Right
      view.rect([0.5, -2.6], [4.5, 3.2], { color: "b", fill: "b", fillAlpha: 0.15 });
      view.text([2.5, 2.9], "VRAM Byte Address Stream", { align: "center", color: "b", size: 11, bold: true });

      for (let i = 0; i < 16; i++) {
        const y = 2.4 - i * 0.32;
        const sampledLinear = i === 5 || i === 6 || i === 9 || i === 10;
        const sampledOpt = i >= 4 && i <= 7;
        const highlighted = isOpt ? sampledOpt : sampledLinear;
        view.rect([0.8, y - 0.12], [4.2, y + 0.12], { color: highlighted ? "g" : "muted", fill: highlighted ? "g" : "panel", fillAlpha: highlighted ? 0.35 : 0.05 });
        view.text([1.2, y], `Addr 0x${(i * 16).toString(16).padStart(2, '0')}: Texel #${i}`, { color: highlighted ? "fg" : "muted", size: 8, bold: highlighted });
      }

      // Footer note
      view.rect([-4.5, -2.6], [-0.5, 0.0], { color: "muted", fill: "panel", fillAlpha: 0.5 });
      view.text([-2.5, -0.5], isOpt ? "OPTIMAL TILING CACHE HIT:" : "LINEAR TILING CACHE MISS:", { align: "center", color: isOpt ? "g" : "err", size: 10, bold: true });
      view.text([-2.5, -1.2], isOpt ? "2x2 texels {4,5,6,7} reside in a SINGLE contiguous cache block!" : "Sampling {5,6} and {9,10} requires jumps across distant memory rows!", { align: "center", color: "fg", size: 8 });
      view.text([-2.5, -1.8], isOpt ? "Bandwidth efficiency: 98%" : "Bandwidth efficiency: 42%", { align: "center", color: isOpt ? "g" : "warn", size: 9, bold: true });

      out.set(sim.rows([
        ["Tiling Mode", isOpt ? "VK_IMAGE_TILING_OPTIMAL (Vendor Swizzled)" : "VK_IMAGE_TILING_LINEAR (Row Major)"],
        ["2D Filter Footprint", "2x2 Texel Bilinear Filter"],
        ["Cache Lines Fetched", isOpt ? "1 Cache Line (Contiguous block)" : "2 Cache Lines (Distant rows)"],
        ["VRAM Locality", isOpt ? "Optimal 2D spatial locality" : "Poor vertical locality"],
      ]));
    });
  }

  function simImageLayoutBarrier(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const phase = sim.slider(controls, { label: "Pipeline Step", min: 0, max: 2, step: 1, value: 1, onInput: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const p = phase.value;

      const steps = [
        { name: "1. Fresh Image Created", layout: "VK_IMAGE_LAYOUT_UNDEFINED", src: "TOP_OF_PIPE", dst: "TRANSFER", accessSrc: "0", accessDst: "TRANSFER_WRITE", color: "muted" },
        { name: "2. Staging DMA Copy", layout: "VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL", src: "TRANSFER", dst: "FRAGMENT_SHADER", accessSrc: "TRANSFER_WRITE", accessDst: "SHADER_READ", color: "a" },
        { name: "3. Fragment Shader Sampling", layout: "VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL", src: "FRAGMENT_SHADER", dst: "COLOR_ATTACHMENT_OUTPUT", accessSrc: "SHADER_READ", accessDst: "COLOR_ATTACHMENT_WRITE", color: "g" },
      ];

      const cur = steps[p];

      // Current Layout State Node
      view.rect([-4.5, 1.2], [4.5, 3.2], { color: cur.color, fill: cur.color, fillAlpha: 0.2 });
      view.text([0, 2.7], `Active Image Layout: ${cur.layout}`, { align: "center", color: cur.color, size: 12, bold: true });
      view.text([0, 2.0], `Current Task: ${cur.name}`, { align: "center", color: "fg", size: 11 });

      // Barrier Synchronization Box
      view.rect([-4.5, -2.6], [4.5, 0.6], { color: "c", fill: "panel", fillAlpha: 0.6 });
      view.text([-4.2, 0.2], "VkImageMemoryBarrier & Pipeline Barrier Parameters:", { color: "c", size: 11, bold: true });
      view.text([-4.0, -0.4], `srcStageMask: VK_PIPELINE_STAGE_${cur.src}_BIT`, { color: "fg", size: 9 });
      view.text([-4.0, -0.8], `dstStageMask: VK_PIPELINE_STAGE_${cur.dst}_BIT`, { color: "fg", size: 9 });
      view.text([-4.0, -1.3], `srcAccessMask: ${cur.accessSrc}`, { color: "muted", size: 9 });
      view.text([-4.0, -1.7], `dstAccessMask: ${cur.accessDst}`, { color: "a", size: 9, bold: true });
      view.text([-4.0, -2.2], p === 1 ? "GPU DMA Transfer active: Writing pixels to VRAM" : (p === 2 ? "Write caches FLUSHED. Read caches INVALIDATED. Shaders reading!" : "Initial uninitialized state"), { color: "g", size: 9 });

      out.set(sim.rows([
        ["Current State", cur.name],
        ["Current Layout", cur.layout],
        ["Source Pipeline Stage", `VK_PIPELINE_STAGE_${cur.src}_BIT`],
        ["Destination Stage", `VK_PIPELINE_STAGE_${cur.dst}_BIT`],
        ["Memory Barrier Effect", p === 2 ? "Hardware decompresses & prepares read caches" : "Prepares optimal write channels"],
      ]));
    });
  }

  function simBufferToImageCopy(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const progress = sim.slider(controls, { label: "Transfer Progress (%)", min: 0, max: 100, step: 25, value: 75, onInput: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const pct = progress.value;

      // Staging Buffer Box
      view.rect([-4.5, 0.8], [-1.5, 3.2], { color: "a", fill: "a", fillAlpha: 0.15 });
      view.text([-3.0, 2.8], "Staging Buffer (RAM)", { align: "center", color: "a", size: 11, bold: true });
      view.text([-3.0, 2.0], "Linear Unpacked Pixels\n[R, G, B, A, R, G, B..]", { align: "center", color: "fg", size: 9 });

      // Optimal Image Box
      view.rect([1.5, 0.8], [4.5, 3.2], { color: "g", fill: "g", fillAlpha: 0.15 });
      view.text([3.0, 2.8], "VkImage (VRAM)", { align: "center", color: "g", size: 11, bold: true });
      view.text([3.0, 2.0], "Optimal Tiled Texels\n[Morton Swizzled]", { align: "center", color: "fg", size: 9 });

      // Transfer arrow
      view.arrow([-1.5, 2.0], [1.5, 2.0], { color: "c", label: "vkCmdCopyBufferToImage" });

      // Progress bar
      view.rect([-4.0, -0.6], [4.0, 0.2], { color: "muted", fill: "panel", fillAlpha: 0.5 });
      view.rect([-4.0, -0.6], [-4.0 + (8.0 * pct) / 100, 0.2], { color: "g", fill: "g", fillAlpha: 0.5 });
      view.text([0, -0.2], `DMA Transfer Progress: ${pct}%`, { align: "center", color: "fg", size: 10, bold: true });

      // Detailed text
      view.rect([-4.5, -2.6], [4.5, -1.0], { color: "muted", fill: "panel", fillAlpha: 0.5 });
      view.text([-4.2, -1.4], "DMA Copy Region Parameters:", { color: "fg", size: 10, bold: true });
      view.text([-4.0, -1.9], "bufferOffset: 0 | imageExtent: 512 x 512 x 1 | aspectMask: COLOR", { color: "muted", size: 9 });
      view.text([-4.0, -2.3], pct === 100 ? "COPY COMPLETE: Transitioning to SHADER_READ_ONLY_OPTIMAL" : "GPU Direct Memory Access transferring data across PCI-e...", { color: pct === 100 ? "g" : "a", size: 9 });

      out.set(sim.rows([
        ["Source Buffer", "VkBuffer (HOST_VISIBLE | HOST_COHERENT)"],
        ["Destination Image", "VkImage (OPTIMAL | DEVICE_LOCAL)"],
        ["Resolution", "512 x 512 (RGBA8)"],
        ["Payload Size", "1,048,576 bytes (1.0 MB)"],
        ["Status", pct === 100 ? "Transfer Complete (Staging buffer freeable)" : `Transferring (${pct}%)`],
      ]));
    });
  }

  function simTextureSampler(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const filter = sim.segmented(controls, { label: "Filter Mode", options: [["nearest", "NEAREST (Pixelated)"], ["linear", "LINEAR (Bilinear)"]], value: "linear", onChange: () => v.redraw() });
    const address = sim.segmented(controls, { label: "Address Mode (Wrap)", options: [["repeat", "REPEAT"], ["clamp", "CLAMP_TO_EDGE"]], value: "repeat", onChange: () => v.redraw() });
    const aniso = sim.checkbox(controls, { label: "Enable 16x Anisotropic Filtering", value: true, onChange: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const isLin = filter.value === "linear";
      const isRep = address.value === "repeat";
      const hasAniso = aniso.value;

      // Draw textured perspective plane
      const horizonY = 1.0;
      view.line([-4.5, horizonY], [4.5, horizonY], { color: "muted", width: 1, dash: [4, 4] });
      view.text([0, 1.3], "Horizon Line (Vanishing Point)", { align: "center", color: "muted", size: 9 });

      // Ground plane perspective quad
      const quad = [
        [-1.0, horizonY],
        [1.0, horizonY],
        [4.2, -2.4],
        [-4.2, -2.4],
      ];

      view.line(quad[0], quad[1], { color: "a", width: 2 });
      view.line(quad[1], quad[2], { color: "a", width: 2 });
      view.line(quad[2], quad[3], { color: "a", width: 2 });
      view.line(quad[3], quad[0], { color: "a", width: 2 });

      // Grid stripes on plane
      const numStripes = isRep ? 6 : 2;
      for (let s = 1; s < numStripes; s++) {
        const t = s / numStripes;
        const y = horizonY - t * (horizonY - (-2.4));
        const xl = -1.0 - t * 3.2;
        const xr = 1.0 + t * 3.2;
        view.line([xl, y], [xr, y], { color: isLin ? "g" : "warn", width: isLin ? 1 : 2, dash: isLin ? [] : [2, 2] });
      }

      // Banner text
      view.rect([-4.5, 2.0], [4.5, 3.2], { color: "muted", fill: "panel", fillAlpha: 0.6 });
      view.text([0, 2.8], `Filter: ${isLin ? "BILINEAR (VK_FILTER_LINEAR)" : "NEAREST (VK_FILTER_NEAREST)"} | Wrap: ${isRep ? "REPEAT" : "CLAMP_TO_EDGE"}`, { align: "center", color: "fg", size: 10, bold: true });
      view.text([0, 2.3], hasAniso ? "16x Anisotropic: Crisp texels preserved at grazing angles" : "Anisotropy OFF: Distant grazing texels blurred / aliased", { align: "center", color: hasAniso ? "g" : "err", size: 9 });

      out.set(sim.rows([
        ["magFilter / minFilter", isLin ? "VK_FILTER_LINEAR (Smooth interpolation)" : "VK_FILTER_NEAREST (Blocky pixels)"],
        ["addressModeU/V", isRep ? "VK_SAMPLER_ADDRESS_MODE_REPEAT" : "VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE"],
        ["Anisotropic Filtering", hasAniso ? "Enabled (16.0x maxSamplerAnisotropy)" : "Disabled"],
        ["Shader Binding", "layout(binding = 1) uniform sampler2D texSampler"],
      ]));
    });
  }
})();
