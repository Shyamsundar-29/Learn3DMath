// Learn Vulkan — Chapter 2: Window Surface & Swapchain
(function () {
  "use strict";
  const { fmt } = L3D.math;

  L3D.topic({
    id: "VK2.1",
    summary: "Window Surface and WSI bridge the platform-agnostic Vulkan core with the operating system's window manager and display compositor.",
    lesson: String.raw`
      <p><strong>Vulkan core is completely platform-agnostic.</strong> The base Vulkan specification does not contain a single function for creating a window, handling mouse clicks, or presenting rendered images to a physical monitor. This design allows Vulkan to run on embedded microcontrollers, headless compute clusters, and cloud game servers without carrying desktop windowing overhead.</p>
      <div class="key"><p>To draw to an actual desktop window, Vulkan uses <strong>WSI (Window System Integration)</strong> extensions. These extensions create a <code>VkSurfaceKHR</code> object representing an OS-native drawable surface and query GPU queue presentation support.</p></div>

      <h2 data-sub="VK2.1.1">Window system integration</h2>
      <p>Window System Integration is standardized across Khronos extensions under the <code>VK_KHR</code> prefix. Presenting graphics to a screen requires two complementary extension layers:</p>
      <ul>
        <li><strong>Instance Extensions:</strong>
          <ul>
            <li><code>VK_KHR_surface</code>: The platform-independent surface abstraction.</li>
            <li>Platform-specific surface extension: <code>VK_KHR_win32_surface</code> (Windows), <code>VK_KHR_xcb_surface</code> or <code>VK_KHR_wayland_surface</code> (Linux), or <code>VK_MVK_macos_surface</code> (macOS Metal bridge).</li>
          </ul>
        </li>
        <li><strong>Device Extension:</strong> <code>VK_KHR_swapchain</code>: Enables the logical device to allocate and present images to a <code>VkSurfaceKHR</code>.</li>
      </ul>
      <p>Libraries like <strong>GLFW</strong> or <strong>SDL</strong> abstract away platform-specific window handles (such as <code>HWND</code> and <code>HINSTANCE</code> on Windows or <code>Display*</code> and <code>Window</code> on Linux) with a single cross-platform helper: <code>glfwCreateWindowSurface(instance, window, nullptr, &surface)</code>.</p>

      <h2 data-sub="VK2.1.2">VkSurfaceKHR</h2>
      <p>A <code>VkSurfaceKHR</code> is an opaque handle representing the native window's drawable canvas. It is created from the <code>VkInstance</code> before selecting your logical device because physical device selection must verify that the chosen GPU can physically present images to that surface.</p>
      <p>Surface creation on Windows behind the scenes initializes a <code>VkWin32SurfaceCreateInfoKHR</code> struct:</p>
      <ul>
        <li><code>hinstance</code>: The Win32 application instance handle from <code>GetModuleHandle(nullptr)</code>.</li>
        <li><code>hwnd</code>: The native Win32 window handle.</li>
      </ul>
      <p>Because the surface is an instance-level object, it must be explicitly destroyed before the instance itself using <code>vkDestroySurfaceKHR(instance, surface, nullptr)</code>.</p>

      <h2 data-sub="VK2.1.3">Presentation queue support</h2>
      <p>Not every hardware queue family that supports graphics commands can present images to the operating system's display compositor. On desktop PCs with dedicated GPUs, the graphics queue family almost always supports presentation. However, on multi-GPU laptops (e.g. NVIDIA Optimus with an integrated Intel GPU connected directly to the display panel), graphics calculations might occur on one queue family while presentation passes through another.</p>
      <p>You query presentation compatibility for each queue family index using <code>vkGetPhysicalDeviceSurfaceSupportKHR</code>:</p>
      <pre><code>VkBool32 presentSupport = VK_FALSE;
vkGetPhysicalDeviceSurfaceSupportKHR(physicalDevice, i, surface, &presentSupport);</code></pre>
      <p>When the graphics queue family and present queue family differ, resources must be managed using one of two sharing modes:</p>
      <ul>
        <li><strong>VK_SHARING_MODE_EXCLUSIVE:</strong> An image is owned by one queue family at a time. Ownership must be explicitly transferred before another queue family can access it. Offers optimal performance.</li>
        <li><strong>VK_SHARING_MODE_CONCURRENT:</strong> Multiple queue families can access images simultaneously without explicit ownership transfers, requiring a list of family indices upfront.</li>
      </ul>
      <div class="warn">Never assume the graphics queue family supports presentation. Always explicitly check each queue family with <code>vkGetPhysicalDeviceSurfaceSupportKHR</code>, otherwise your application will crash on dual-GPU laptops and hybrid systems!</div>
      <div class="game">Modern borderless windowed mode in Windows 11 uses direct flip swapchains, bypassing desktop composition latency for esports titles running on Vulkan.</div>
      <p><a class="btn goto-sim" href="#/VK2.1/sim">Try it: explore WSI surface bridging and queue support →</a></p>
    `,
    keyFormulas: [
      ["Surface support query", String.raw`\text{vkGetPhysicalDeviceSurfaceSupportKHR}(\text{device}, i, \text{surface}, \&\text{presentSupport})`],
      ["Queue sharing mode", String.raw`\text{mode} = \begin{cases} \text{EXCLUSIVE} & \text{if } \text{graphicsFamily} = \text{presentFamily} \\ \text{CONCURRENT} & \text{if } \text{graphicsFamily} \ne \text{presentFamily} \end{cases}`],
    ],
    exercises: [
      { q: "Why is surface creation not part of the core Vulkan API?", a: "Vulkan core is platform-agnostic to run on embedded, automotive, and headless compute servers without windowing overhead. Windowing is handled via WSI extensions." },
      { q: "What happens if graphics queue family and present queue family are different?", a: "Images shared between them must either use VK_SHARING_MODE_CONCURRENT or explicitly transfer ownership between queue families using pipeline barriers." },
      { q: "Which library function encapsulates platform-specific surface creation for GLFW?", a: "glfwCreateWindowSurface(instance, window, nullptr, &surface)." },
    ],
    cpp: [{
      title: "Creating Window Surface & Finding Present Queue",
      formula: String.raw`\text{glfwCreateWindowSurface} + \text{vkGetPhysicalDeviceSurfaceSupportKHR}`,
      note: "<p>Initializes a VkSurfaceKHR and finds queue families for graphics and presentation.</p>",
      code: String.raw`
#define GLFW_INCLUDE_VULKAN
#include <GLFW/glfw3.h>
#include <vulkan/vulkan.h>
#include <vector>
#include <iostream>

struct QueueFamilyIndices {
    uint32_t graphicsFamily = UINT32_MAX;
    uint32_t presentFamily = UINT32_MAX;
    bool isComplete() const {
        return graphicsFamily != UINT32_MAX && presentFamily != UINT32_MAX;
    }
};

QueueFamilyIndices FindQueueFamilies(VkPhysicalDevice device, VkSurfaceKHR surface) {
    QueueFamilyIndices indices;
    uint32_t queueFamilyCount = 0;
    vkGetPhysicalDeviceQueueFamilyProperties(device, &queueFamilyCount, nullptr);
    std::vector<VkQueueFamilyProperties> queueFamilies(queueFamilyCount);
    vkGetPhysicalDeviceQueueFamilyProperties(device, &queueFamilyCount, queueFamilies.data());

    for (uint32_t i = 0; i < queueFamilyCount; i++) {
        if (queueFamilies[i].queueFlags & VK_QUEUE_GRAPHICS_BIT) {
            indices.graphicsFamily = i;
        }
        VkBool32 presentSupport = VK_FALSE;
        vkGetPhysicalDeviceSurfaceSupportKHR(device, i, surface, &presentSupport);
        if (presentSupport) {
            indices.presentFamily = i;
        }
        if (indices.isComplete()) break;
    }
    return indices;
}
`,
    }],
    csharp: [{
      title: "Querying Presentation Support in C#",
      formula: String.raw`\text{vk.GetPhysicalDeviceSurfaceSupport}`,
      note: "<p>Silk.NET Vulkan surface support query.</p>",
      code: String.raw`
using Silk.NET.Vulkan;
using Silk.NET.Windowing;

public static unsafe bool CheckPresentSupport(Vk vk, PhysicalDevice physicalDevice,
    SurfaceKHR surface, uint queueFamilyIndex)
{
    Bool32 presentSupport = false;
    vk.GetPhysicalDeviceSurfaceSupport(physicalDevice, queueFamilyIndex, surface, ref presentSupport);
    return presentSupport.Value != 0;
}
`,
    }],
    sims: [{ title: "WSI surface bridge & queue routing", help: "<p>Toggle between unified and dual GPU queue modes. Observe how images flow from rendering queues to the OS compositor surface.</p>", mount: simWindowSurface }],
  });

  L3D.topic({
    id: "VK2.2",
    summary: "The Swapchain is an infrastructure of image buffers managed by the GPU that synchronizes rendering with the physical screen refresh rate.",
    lesson: String.raw`
      <p><strong>Rendering directly to the screen produces visual artifacts</strong> like horizontal tearing when the display scans out half-rendered pixels. Vulkan prevents this through the <code>VK_KHR_swapchain</code> extension, which manages a queue of displayable image buffers.</p>
      <div class="key"><p>The swapchain is an abstraction for a collection of render targets owned by the display subsystem. Your application acquires an image, renders into it, and submits it back to the presentation engine to swap with the currently displayed frame.</p></div>

      <h2 data-sub="VK2.2.1">Surface capabilities & formats</h2>
      <p>Before configuring a swapchain, your application must query three critical properties of the physical device and surface:</p>
      <ol>
        <li><strong>Basic Surface Capabilities:</strong> Queried via <code>vkGetPhysicalDeviceSurfaceCapabilitiesKHR</code>. Provides min/max image counts, min/max image extent (width and height), and supported transformations (such as 90-degree screen rotation on mobile).</li>
        <li><strong>Surface Formats:</strong> Queried via <code>vkGetPhysicalDeviceSurfaceFormatsKHR</code>. Returns pairs of <code>VkFormat</code> (e.g. <code>VK_FORMAT_B8G8R8A8_SRGB</code>) and <code>VkColorSpaceKHR</code> (e.g. <code>VK_COLOR_SPACE_SRGB_NONLINEAR_KHR</code>). Standard practice is to select an 8-bit sRGB format for accurate gamma color rendering.</li>
        <li><strong>Supported Present Modes:</strong> Queried via <code>vkGetPhysicalDeviceSurfacePresentModesKHR</code>. Determines the synchronization contract between rendering and display refresh.</li>
      </ol>

      <h2 data-sub="VK2.2.2">Present modes (FIFO vs Mailbox)</h2>
      <p>The presentation mode determines how images enter the display engine and how screen tearing is prevented:</p>
      <table>
        <tr><th>Present Mode</th><th>V-Sync Behavior</th><th>Tearing</th><th>Latency</th><th>Description</th></tr>
        <tr><td><code>VK_PRESENT_MODE_IMMEDIATE_KHR</code></td><td>No</td><td>Yes</td><td>Lowest</td><td>Images are transferred to screen immediately. Highly visible tearing.</td></tr>
        <tr><td><code>VK_PRESENT_MODE_FIFO_KHR</code></td><td>Yes</td><td>No</td><td>Moderate</td><td><strong>Guaranteed to be supported by all Vulkan implementations</strong>. Internal queue waits for vertical blanking interval. If queue is full, rendering pauses.</td></tr>
        <tr><td><code>VK_PRESENT_MODE_FIFO_RELAXED_KHR</code></td><td>Adaptive</td><td>Only when late</td><td>Low</td><td>If rendering was delayed and missed the v-blank, it presents immediately without waiting another full refresh period.</td></tr>
        <tr><td><code>VK_PRESENT_MODE_MAILBOX_KHR</code></td><td>Yes</td><td>No</td><td>Lowest tear-free</td><td><strong>Triple-buffering mode</strong>. When queue is full, newer frames replace older pending frames. Optimal for responsive, tear-free gaming.</td></tr>
      </table>

      <h2 data-sub="VK2.2.3">Creating the swapchain</h2>
      <p>To create the swapchain, fill out a <code>VkSwapchainCreateInfoKHR</code> structure. Crucial parameters include:</p>
      <ul>
        <li><code>minImageCount</code>: To prevent stalling while waiting on the driver's internal operations, always request at least <code>capabilities.minImageCount + 1</code>. If <code>capabilities.maxImageCount > 0</code>, clamp to this upper limit.</li>
        <li><code>imageExtent</code>: Clamped to the window's resolution in pixels (often higher than screen coordinates on Retina/HiDPI displays).</li>
        <li><code>imageUsage</code>: Typically <code>VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT</code> for rendering directly. If implementing post-processing readbacks, <code>VK_IMAGE_USAGE_TRANSFER_DST_BIT</code> can be added.</li>
        <li><code>compositeAlpha</code>: Specifies alpha blending with other desktop windows (typically <code>VK_COMPOSITE_ALPHA_OPAQUE_BIT_KHR</code>).</li>
        <li><code>presentMode</code>: Selected preference (e.g. Mailbox fallback to FIFO).</li>
      </ul>
      <div class="note">Vulkan requires explicit triple-buffering logic. In OpenGL, calling <code>glfwSwapInterval(1)</code> magically negotiated buffers in the driver; in Vulkan, you allocate the exact image count you want.</div>
      <p><a class="btn goto-sim" href="#/VK2.2/sim">Try it: compare FIFO, Mailbox, and Immediate present modes →</a></p>
    `,
    keyFormulas: [
      ["Recommended image count", String.raw`N_{\text{images}} = \min(\text{cap.minImageCount} + 1, \; \text{cap.maxImageCount} \gt 0 \,?\, \text{cap.maxImageCount} : \infty)`],
      ["Clamping swap extent", String.raw`\text{extent} = \operatorname{clamp}(\text{windowSize}, \; \text{minImageExtent}, \; \text{maxImageExtent})`],
    ],
    exercises: [
      { q: "Which present mode is guaranteed to be supported by the Vulkan specification on every device?", a: "VK_PRESENT_MODE_FIFO_KHR." },
      { q: "Why do we typically request minImageCount + 1 images instead of just minImageCount?", a: "Requesting minImageCount may cause the application to wait for the display engine to complete internal operations before an image is available. Adding 1 enables double/triple buffering without stalls." },
      { q: "What is the key advantage of VK_PRESENT_MODE_MAILBOX_KHR over FIFO?", a: "Mailbox never causes tearing, but if the GPU renders faster than the monitor refresh rate, it replaces older queued images with the newest frame, drastically reducing input latency." },
    ],
    cpp: [{
      title: "Creating Swapchain in C++",
      formula: String.raw`\text{vkCreateSwapchainKHR}(\text{device}, \&\text{createInfo}, \text{nullptr}, \&\text{swapchain})`,
      note: "<p>Populating VkSwapchainCreateInfoKHR and allocating swapchain images.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>
#include <algorithm>

void CreateSwapChain(VkDevice device, VkSurfaceKHR surface,
                     const VkSurfaceCapabilitiesKHR& capabilities,
                     VkSurfaceFormatKHR surfaceFormat,
                     VkPresentModeKHR presentMode,
                     VkExtent2D extent,
                     uint32_t graphicsQueueFamily,
                     uint32_t presentQueueFamily,
                     VkSwapchainKHR& outSwapChain)
{
    uint32_t imageCount = capabilities.minImageCount + 1;
    if (capabilities.maxImageCount > 0 && imageCount > capabilities.maxImageCount) {
        imageCount = capabilities.maxImageCount;
    }

    VkSwapchainCreateInfoKHR createInfo{};
    createInfo.sType = VK_STRUCTURE_TYPE_SWAPCHAIN_CREATE_INFO_KHR;
    createInfo.surface = surface;
    createInfo.minImageCount = imageCount;
    createInfo.imageFormat = surfaceFormat.format;
    createInfo.imageColorSpace = surfaceFormat.colorSpace;
    createInfo.imageExtent = extent;
    createInfo.imageArrayLayers = 1;
    createInfo.imageUsage = VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT;

    uint32_t queueFamilyIndices[] = { graphicsQueueFamily, presentQueueFamily };
    if (graphicsQueueFamily != presentQueueFamily) {
        createInfo.imageSharingMode = VK_SHARING_MODE_CONCURRENT;
        createInfo.queueFamilyIndexCount = 2;
        createInfo.pQueueFamilyIndices = queueFamilyIndices;
    } else {
        createInfo.imageSharingMode = VK_SHARING_MODE_EXCLUSIVE;
    }

    createInfo.preTransform = capabilities.currentTransform;
    createInfo.compositeAlpha = VK_COMPOSITE_ALPHA_OPAQUE_BIT_KHR;
    createInfo.presentMode = presentMode;
    createInfo.clipped = VK_TRUE;
    createInfo.oldSwapchain = VK_NULL_HANDLE;

    if (vkCreateSwapchainKHR(device, &createInfo, nullptr, &outSwapChain) != VK_SUCCESS) {
        throw std::runtime_error("Failed to create swapchain!");
    }
}
`,
    }],
    csharp: [{
      title: "Creating Swapchain in C#",
      formula: String.raw`\text{vk.CreateSwapchain(device, ref createInfo, null, out swapchain)}`,
      note: "<p>Swapchain creation with Silk.NET.Vulkan.</p>",
      code: String.raw`
using Silk.NET.Vulkan;

public static unsafe SwapchainKHR CreateSwapchain(Vk vk, Device device, SurfaceKHR surface,
    SurfaceCapabilitiesKHR caps, SurfaceFormatKHR format, PresentModeKHR mode, Extent2D extent)
{
    uint imageCount = caps.MinImageCount + 1;
    if (caps.MaxImageCount > 0 && imageCount > caps.MaxImageCount)
        imageCount = caps.MaxImageCount;

    var createInfo = new SwapchainCreateInfoKHR
    {
        SType = StructureType.SwapchainCreateInfoKhr,
        Surface = surface,
        MinImageCount = imageCount,
        ImageFormat = format.Format,
        ImageColorSpace = format.ColorSpace,
        ImageExtent = extent,
        ImageArrayLayers = 1,
        ImageUsage = ImageUsageFlags.ColorAttachmentBit,
        ImageSharingMode = SharingMode.Exclusive,
        PreTransform = caps.CurrentTransform,
        CompositeAlpha = CompositeAlphaFlagsKHR.OpaqueBitKhr,
        PresentMode = mode,
        Clipped = true,
    };

    SwapchainKHR swapchain;
    if (vk.CreateSwapchain(device, ref createInfo, null, out swapchain) != Result.Success)
        throw new System.Exception("Failed to create swapchain!");

    return swapchain;
}
`,
    }],
    sims: [{ title: "Present modes comparison: FIFO vs Mailbox", help: "<p>Observe how different presentation modes synchronize with the monitor V-blank. Adjust frame rendering rate vs monitor refresh to see tearing and latency.</p>", mount: simPresentModes }],
  });

  L3D.topic({
    id: "VK2.3",
    summary: "VkImage holds raw texel memory in the swapchain, while VkImageView defines the lens through which rendering pipelines access and interpret those pixels.",
    lesson: String.raw`
      <p><strong>A <code>VkImage</code> by itself cannot be bound directly to a render pass or shader.</strong> In Vulkan, a <code>VkImage</code> simply represents a contiguous block of device memory containing formatted texels. To actually read, write, or bind that image, you must wrap it in a <code>VkImageView</code>.</p>
      <div class="key"><p>Think of <code>VkImage</code> as the physical film or memory backing, and <code>VkImageView</code> as the optical lens that specifies which color channels, mip levels, and array layers can be seen.</p></div>

      <h2 data-sub="VK2.3.1">Retrieving swapchain images</h2>
      <p>When the swapchain is created, the driver allocates the underlying image handles. You do not allocate device memory for swapchain images manually; you query them directly with <code>vkGetSwapchainImagesKHR</code>:</p>
      <pre><code>uint32_t imageCount = 0;
vkGetSwapchainImagesKHR(device, swapchain, &imageCount, nullptr);
std::vector<VkImage> swapChainImages(imageCount);
vkGetSwapchainImagesKHR(device, swapchain, &imageCount, swapChainImages.data());</code></pre>
      <p>The number of images returned may be greater than your requested minimum depending on driver alignment and platform constraints.</p>

      <h2 data-sub="VK2.3.2">VkImageView role</h2>
      <p>Every swapchain image needs a corresponding <code>VkImageView</code> before it can serve as a color attachment in a framebuffer. An image view specifies:</p>
      <ul>
        <li><code>viewType</code>: How image dimensions are treated: <code>VK_IMAGE_VIEW_TYPE_1D</code>, <code>2D</code>, <code>3D</code>, or <code>CUBE</code>. For swapchain windows, this is always <code>2D</code>.</li>
        <li><code>format</code>: Must match or be compatible with the swapchain image format (e.g. <code>VK_FORMAT_B8G8R8A8_SRGB</code>).</li>
        <li><code>components</code>: Swizzle mapping for color channels (R, G, B, A). Setting <code>VK_COMPONENT_SWIZZLE_IDENTITY</code> preserves the default channel ordering.</li>
      </ul>

      <h2 data-sub="VK2.3.3">Subresource ranges</h2>
      <p>The <code>VkImageSubresourceRange</code> parameter designates which portion of the image resource is accessible through this view:</p>
      <ul>
        <li><code>aspectMask</code>: Tells Vulkan which data planes are accessed:
          <ul>
            <li><code>VK_IMAGE_ASPECT_COLOR_BIT</code> for color images (like swapchain).</li>
            <li><code>VK_IMAGE_ASPECT_DEPTH_BIT</code> / <code>STENCIL_BIT</code> for depth-stencil attachments.</li>
          </ul>
        </li>
        <li><code>baseMipLevel</code> and <code>levelCount</code>: Set to 0 and 1 since swapchain presentation images do not use mipmaps.</li>
        <li><code>baseArrayLayer</code> and <code>layerCount</code>: Set to 0 and 1 for standard single-view displays (or 2 for stereo VR multiview).</li>
      </ul>
      <div class="warn">Swapchain images are owned by the swapchain and are destroyed automatically when the swapchain is destroyed. However, the <code>VkImageView</code> objects you create around them are your responsibility and must be explicitly destroyed via <code>vkDestroyImageView</code>!</div>
      <p><a class="btn goto-sim" href="#/VK2.3/sim">Try it: inspect subresource ranges and image view configurations →</a></p>
    `,
    keyFormulas: [
      ["ImageView structure", String.raw`\text{VkImageView} = \langle \text{image}, \text{viewType}, \text{format}, \text{components}, \text{subresourceRange} \rangle`],
      ["Subresource range", String.raw`\text{Range} = \{\text{aspectMask}: \text{COLOR}, \text{mipLevels}: [0, 1), \text{layers}: [0, 1)\}`],
    ],
    exercises: [
      { q: "Can a VkImage be directly attached to a framebuffer without a VkImageView?", a: "No. Framebuffers and pipeline descriptors can only reference images through a VkImageView." },
      { q: "Who is responsible for destroying swapchain VkImage handles?", a: "The Vulkan implementation automatically frees swapchain images when vkDestroySwapchainKHR is called. You only destroy the VkImageView objects you created." },
      { q: "What aspect mask is used for swapchain color buffers?", a: "VK_IMAGE_ASPECT_COLOR_BIT." },
    ],
    cpp: [{
      title: "Creating Image Views for Swapchain Images",
      formula: String.raw`\text{vkCreateImageView}(\text{device}, \&\text{viewInfo}, \text{nullptr}, \&\text{views}[i])`,
      note: "<p>Iterates over all swapchain images and builds a VkImageView for each.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>
#include <vector>

std::vector<VkImageView> CreateImageViews(VkDevice device,
                                         const std::vector<VkImage>& swapChainImages,
                                         VkFormat swapChainImageFormat)
{
    std::vector<VkImageView> swapChainImageViews(swapChainImages.size());

    for (size_t i = 0; i < swapChainImages.size(); i++) {
        VkImageViewCreateInfo createInfo{};
        createInfo.sType = VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO;
        createInfo.image = swapChainImages[i];
        createInfo.viewType = VK_IMAGE_VIEW_TYPE_2D;
        createInfo.format = swapChainImageFormat;

        createInfo.components.r = VK_COMPONENT_SWIZZLE_IDENTITY;
        createInfo.components.g = VK_COMPONENT_SWIZZLE_IDENTITY;
        createInfo.components.b = VK_COMPONENT_SWIZZLE_IDENTITY;
        createInfo.components.a = VK_COMPONENT_SWIZZLE_IDENTITY;

        createInfo.subresourceRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
        createInfo.subresourceRange.baseMipLevel = 0;
        createInfo.subresourceRange.levelCount = 1;
        createInfo.subresourceRange.baseArrayLayer = 0;
        createInfo.subresourceRange.layerCount = 1;

        if (vkCreateImageView(device, &createInfo, nullptr, &swapChainImageViews[i]) != VK_SUCCESS) {
            throw std::runtime_error("Failed to create image views!");
        }
    }
    return swapChainImageViews;
}
`,
    }],
    csharp: [{
      title: "Creating Image Views in C#",
      formula: String.raw`\text{vk.CreateImageView}`,
      note: "<p>Looping through swapchain images to create views in Silk.NET.</p>",
      code: String.raw`
using Silk.NET.Vulkan;

public static unsafe ImageView[] CreateImageViews(Vk vk, Device device,
    Image[] swapchainImages, Format format)
{
    var views = new ImageView[swapchainImages.Length];
    for (int i = 0; i < swapchainImages.Length; i++)
    {
        var createInfo = new ImageViewCreateInfo
        {
            SType = StructureType.ImageViewCreateInfo,
            Image = swapchainImages[i],
            ViewType = ImageViewType.Type2D,
            Format = format,
            Components = new ComponentMapping
            {
                R = ComponentSwizzle.Identity,
                G = ComponentSwizzle.Identity,
                B = ComponentSwizzle.Identity,
                A = ComponentSwizzle.Identity,
            },
            SubresourceRange = new ImageSubresourceRange
            {
                AspectMask = ImageAspectFlags.ColorBit,
                BaseMipLevel = 0,
                LevelCount = 1,
                BaseArrayLayer = 0,
                LayerCount = 1,
            }
        };

        if (vk.CreateImageView(device, ref createInfo, null, out views[i]) != Result.Success)
            throw new System.Exception("Failed to create image view!");
    }
    return views;
}
`,
    }],
    sims: [{ title: "Image view subresource slice visualizer", help: "<p>Inspect how a 2D image view filters color aspects, array layers, and mipmap levels from the raw image backing.</p>", mount: simImageViews }],
  });

  L3D.topic({
    id: "VK2.4",
    summary: "Window resizing, minimization, and display changes invalidate the swapchain, requiring graceful recreation without GPU synchronization deadlocks.",
    lesson: String.raw`
      <p><strong>A Vulkan swapchain is immutable once created.</strong> Its image dimensions, surface format, and buffer count cannot be changed on the fly. When a user drags a window corner to resize it or moves the window to another monitor with a different scaling factor, the existing swapchain becomes obsolete.</p>
      <div class="key"><p>Vulkan signals this through two specific return codes: <code>VK_ERROR_OUT_OF_DATE_KHR</code> (presentation cannot continue and the swapchain must be recreated immediately) and <code>VK_SUBOPTIMAL_KHR</code> (presentation still works, but properties no longer match perfectly).</p></div>

      <h2 data-sub="VK2.4.1">Window resizing and minimization</h2>
      <p>When a window is resized, your windowing system generates an event. In GLFW, you register a callback with <code>glfwSetFramebufferSizeCallback</code> to set a boolean flag (<code>framebufferResized = true</code>).</p>
      <p>A special edge case occurs when the user <strong>minimizes the window</strong>. The window's framebuffer width and height drop to exactly <code>0 x 0</code>. If you attempt to create a swapchain with zero dimensions, Vulkan drivers will crash or return an error. The solution is to pause execution until the window is restored:</p>
      <pre><code>int width = 0, height = 0;
glfwGetFramebufferSize(window, &width, &height);
while (width == 0 || height == 0) {
    glfwGetFramebufferSize(window, &width, &height);
    glfwWaitEvents();
}</code></pre>

      <h2 data-sub="VK2.4.2">Out of date and suboptimal swapchain</h2>
      <p>The recreation check happens in two places during the render loop:</p>
      <ol>
        <li><strong>During acquire:</strong> If <code>vkAcquireNextImageKHR</code> returns <code>VK_ERROR_OUT_OF_DATE_KHR</code>, you cannot render this frame. Immediately recreate the swapchain and return from the draw call.</li>
        <li><strong>During present:</strong> If <code>vkQueuePresentKHR</code> returns <code>VK_ERROR_OUT_OF_DATE_KHR</code> or <code>VK_SUBOPTIMAL_KHR</code> (or if your resize flag was set), trigger recreation.</li>
      </ol>

      <h2 data-sub="VK2.4.3">Deadlock avoidance with fences</h2>
      <p>Before destroying the old swapchain and its corresponding image views, framebuffers, and pipelines, you <strong>must guarantee the GPU has finished reading and writing them</strong>. Destroying an image while the GPU is still drawing into it results in undefined behavior and crashes.</p>
      <p>The simplest way to synchronize before recreation is calling <code>vkDeviceWaitIdle(device)</code>. This halts CPU execution until all GPU queues complete pending work. The recreation routine then executes:</p>
      <ol>
        <li>Wait for device idle: <code>vkDeviceWaitIdle(device)</code>.</li>
        <li>Destroy old framebuffers: <code>vkDestroyFramebuffer(...)</code>.</li>
        <li>Destroy old image views: <code>vkDestroyImageView(...)</code>.</li>
        <li>Pass the handle of the current swapchain into <code>oldSwapchain</code> of <code>VkSwapchainCreateInfoKHR</code> to reuse allocated memory surfaces.</li>
        <li>Call <code>vkCreateSwapchainKHR</code>, destroy the old swapchain, and query new images.</li>
        <li>Rebuild image views and framebuffers matching the new swapchain extent.</li>
      </ol>
      <div class="warn">Failing to handle the 0x0 minimized condition causes infinite recreate loops or fatal errors in Vulkan surface capability queries. Always loop with <code>glfwWaitEvents()</code> while extent is zero!</div>
      <p><a class="btn goto-sim" href="#/VK2.4/sim">Try it: simulate swapchain invalidation and recreation state machine →</a></p>
    `,
    keyFormulas: [
      ["Recreation condition", String.raw`\text{Recreate} \iff (\text{result} = \text{OUT\_OF\_DATE}) \lor (\text{result} = \text{SUBOPTIMAL}) \lor \text{resized}`],
      ["Safe teardown sync", String.raw`\text{vkDeviceWaitIdle}(\text{device}) \to \text{vkDestroyFramebuffer} \to \text{vkDestroyImageView} \to \text{vkCreateSwapchain}`],
    ],
    exercises: [
      { q: "What should your application do if the window is minimized and framebuffer extent becomes 0x0?", a: "Pause the render loop and wait for events using glfwWaitEvents() until width and height are greater than zero before creating a new swapchain." },
      { q: "Why must vkDeviceWaitIdle be called prior to destroying the old swapchain?", a: "The GPU may still be executing commands referencing the old swapchain images or framebuffers. Destroying them during active rendering causes GPU memory corruption." },
      { q: "What is the purpose of the oldSwapchain field in VkSwapchainCreateInfoKHR?", a: "It informs the driver that the new swapchain is replacing an existing one, allowing the driver to recycle internal surface resources and facilitate smooth transitions." },
    ],
    cpp: [{
      title: "Recreating Swapchain in C++",
      formula: String.raw`\text{vkDeviceWaitIdle} \to \text{Cleanup} \to \text{Create}`,
      note: "<p>Safely handles window resize events and swapchain recreation.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>
#include <GLFW/glfw3.h>

void RecreateSwapChain(GLFWwindow* window, VkDevice device, VkPhysicalDevice physicalDevice,
                       VkSurfaceKHR surface, VkSwapchainKHR& swapChain)
{
    int width = 0, height = 0;
    glfwGetFramebufferSize(window, &width, &height);
    while (width == 0 || height == 0) {
        glfwGetFramebufferSize(window, &width, &height);
        glfwWaitEvents();
    }

    vkDeviceWaitIdle(device);

    CleanupSwapChain();

    CreateSwapChain();
    CreateImageViews();
    CreateFramebuffers();
}
`,
    }],
    csharp: [{
      title: "Recreating Swapchain in C#",
      formula: String.raw`\text{DeviceWaitIdle} \to \text{Rebuild}`,
      note: "<p>Silk.NET swapchain recreation on resize.</p>",
      code: String.raw`
using Silk.NET.Vulkan;

public static unsafe void RecreateSwapchain(Vk vk, Device device, Action rebuildResources)
{
    // Wait until GPU is idle before destroying swapchain resources
    vk.DeviceWaitIdle(device);

    // Call teardown and recreate callbacks
    rebuildResources();
}
`,
    }],
    sims: [{ title: "Swapchain recreation state machine", help: "<p>Simulate window resize and minimize events. Follow the state transitions from normal render loop to out-of-date detection, device idle waiting, and swapchain recreation.</p>", mount: simSwapchainRecreation }],
  });

  // ------------------------------------------------------------ Simulations
  function simWindowSurface(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const mode = sim.segmented(controls, { label: "Queue Architecture", options: [["unified", "Unified Graphics + Present"], ["split", "Split Queue Families (Optimus/Hybrid)"]], value: "unified", onChange: () => v.redraw() });
    const sharing = sim.segmented(controls, { label: "Sharing Mode", options: [["exclusive", "VK_SHARING_MODE_EXCLUSIVE"], ["concurrent", "VK_SHARING_MODE_CONCURRENT"]], value: "exclusive", onChange: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const isUnified = mode.value === "unified";
      const isExcl = sharing.value === "exclusive";

      // Application & Window
      view.rect([-4.5, 1.8], [-1.8, 3.4], { color: "a", fill: "a", fillAlpha: 0.15 });
      view.text([-3.15, 3.0], "OS Window (GLFW)", { align: "center", color: "fg", size: 12, bold: true });
      view.text([-3.15, 2.3], "HWND / X11 Window", { align: "center", color: "muted", size: 10 });

      // VkSurfaceKHR
      view.rect([-0.8, 1.8], [1.8, 3.4], { color: "c", fill: "c", fillAlpha: 0.2 });
      view.text([0.5, 3.0], "VkSurfaceKHR", { align: "center", color: "c", size: 12, bold: true });
      view.text([0.5, 2.3], "WSI Native Bridge", { align: "center", color: "fg", size: 10 });

      // Display Compositor
      view.rect([2.8, 1.8], [4.5, 3.4], { color: "g", fill: "g", fillAlpha: 0.15 });
      view.text([3.65, 3.0], "Display Engine", { align: "center", color: "fg", size: 12, bold: true });
      view.text([3.65, 2.3], "Monitor Output", { align: "center", color: "muted", size: 10 });

      view.arrow([-1.8, 2.6], [-0.8, 2.6], { color: "a" });
      view.arrow([1.8, 2.6], [2.8, 2.6], { color: "g" });

      // Hardware Queues
      view.rect([-4.5, -2.8], [4.5, 0.4], { color: "muted", fill: "panel", fillAlpha: 0.5 });
      view.text([-4.2, 0.0], "Physical Device (GPU) Queue Families:", { color: "fg", size: 12, bold: true });

      if (isUnified) {
        view.rect([-4.0, -2.4], [4.0, -0.6], { color: "a", fill: "a", fillAlpha: 0.25 });
        view.text([0, -1.2], "Queue Family 0: GRAPHICS + PRESENT SUPPORT (Unified)", { align: "center", color: "fg", size: 12, bold: true });
        view.text([0, -1.8], "Sharing Mode: VK_SHARING_MODE_EXCLUSIVE (Zero overhead, single owner)", { align: "center", color: "a", size: 10 });
        view.arrow([0, -0.6], [0.5, 1.8], { color: "a", label: "Direct Present" });
      } else {
        view.rect([-4.0, -2.4], [-0.5, -0.6], { color: "b", fill: "b", fillAlpha: 0.25 });
        view.text([-2.25, -1.2], "Queue Family 0 (Graphics)", { align: "center", color: "fg", size: 11, bold: true });
        view.text([-2.25, -1.8], "vkQueueSubmit(Draw)", { align: "center", color: "muted", size: 10 });

        view.rect([0.5, -2.4], [4.0, -0.6], { color: "c", fill: "c", fillAlpha: 0.25 });
        view.text([2.25, -1.2], "Queue Family 1 (Present)", { align: "center", color: "fg", size: 11, bold: true });
        view.text([2.25, -1.8], "vkQueuePresentKHR", { align: "center", color: "muted", size: 10 });

        if (isExcl) {
          view.arrow([-0.5, -1.5], [0.5, -1.5], { color: "warn", label: "Explicit Barrier Transfer" });
        } else {
          view.arrow([-0.5, -1.5], [0.5, -1.5], { color: "g", label: "Shared Access (CONCURRENT)" });
        }
        view.arrow([2.25, -0.6], [0.8, 1.8], { color: "c", label: "Present" });
      }

      out.set(sim.rows([
        ["Queue Architecture", isUnified ? "Unified (Standard Desktop GPU)" : "Split (Hybrid / Dual GPU)"],
        ["Graphics Queue Index", "Family 0"],
        ["Present Queue Index", isUnified ? "Family 0 (Same)" : "Family 1 (Separate)"],
        ["Recommended Sharing", isUnified ? "VK_SHARING_MODE_EXCLUSIVE" : (isExcl ? "EXCLUSIVE (Requires queue ownership barriers)" : "CONCURRENT (No ownership transfer)")],
        ["Surface Type", "VkSurfaceKHR"],
      ]));
    });
  }

  function simPresentModes(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const mode = sim.segmented(controls, { label: "Present Mode", options: [["immediate", "IMMEDIATE"], ["fifo", "FIFO (V-Sync)"], ["mailbox", "MAILBOX (Triple Buffer)"]], value: "fifo", onChange: () => v.redraw() });
    const fps = sim.slider(controls, { label: "GPU Render Speed (FPS)", min: 30, max: 240, step: 10, value: 90, onInput: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const m = mode.value;
      const curFps = fps.value;
      const vblankHz = 60;

      // Monitor Screen Output Box
      view.rect([-4.2, 0.8], [4.2, 3.4], { color: "muted", fill: "panel", fillAlpha: 0.6 });
      view.text([-3.9, 3.0], "Monitor Display Scanout (60 Hz V-Blank Cycle):", { color: "fg", size: 12, bold: true });

      if (m === "immediate") {
        view.rect([-3.8, 1.2], [3.8, 2.6], { color: "warn", fill: "warn", fillAlpha: 0.2 });
        // Draw tear lines
        view.line([-3.8, 2.0], [3.8, 2.0], { color: "err", width: 3 });
        view.line([-3.8, 1.5], [3.8, 1.5], { color: "err", width: 3 });
        view.text([0, 2.2], "Frame N-1 (Top)", { align: "center", color: "fg", size: 10 });
        view.text([0, 1.75], "TEAR LINE: Mid-scanout image swap", { align: "center", color: "err", size: 11, bold: true });
        view.text([0, 1.3], "Frame N (Bottom)", { align: "center", color: "fg", size: 10 });
      } else if (m === "fifo") {
        view.rect([-3.8, 1.2], [3.8, 2.6], { color: "c", fill: "c", fillAlpha: 0.2 });
        view.text([0, 2.1], "Clean Tear-Free Frame (Waits for V-Blank)", { align: "center", color: "c", size: 12, bold: true });
        view.text([0, 1.5], curFps > 60 ? "GPU Idle: Backpressure stalls rendering to 60 FPS" : "GPU Under-speed: Stalls display, causing stutter", { align: "center", color: "fg", size: 10 });
      } else {
        view.rect([-3.8, 1.2], [3.8, 2.6], { color: "g", fill: "g", fillAlpha: 0.2 });
        view.text([0, 2.1], "Clean Tear-Free Frame (Triple Buffering)", { align: "center", color: "g", size: 12, bold: true });
        view.text([0, 1.5], "Newest completed frame swapped in at V-Blank (Lowest latency)", { align: "center", color: "fg", size: 10 });
      }

      // Buffer Queue representation
      view.rect([-4.2, -2.8], [4.2, 0.2], { color: "muted", fill: "panel", fillAlpha: 0.4 });
      view.text([-3.9, -0.1], "Swapchain Images State:", { color: "fg", size: 12, bold: true });

      const bufCount = m === "immediate" ? 1 : (m === "fifo" ? 2 : 3);
      for (let i = 0; i < 3; i++) {
        const x0 = -3.8 + i * 2.6;
        const x1 = x0 + 2.3;
        const active = i < bufCount;
        view.rect([x0, -2.4], [x1, -0.8], { color: active ? "a" : "muted", fill: active ? "a" : "panel", fillAlpha: active ? 0.25 : 0.05 });
        view.text([(x0 + x1) / 2, -1.3], `Image ${i}`, { align: "center", color: active ? "fg" : "muted", size: 11, bold: true });
        let status = "Not Allocated";
        if (active) {
          if (i === 0) status = "Displaying";
          else if (i === 1) status = m === "mailbox" ? "Queued" : "Rendering";
          else status = "Latest Frame (Mailbox)";
        }
        view.text([(x0 + x1) / 2, -1.9], status, { align: "center", color: active ? "a" : "muted", size: 9 });
      }

      const effectiveFps = m === "immediate" ? curFps : (m === "fifo" ? Math.min(curFps, 60) : curFps);
      const latency = m === "immediate" ? fmt(1000 / curFps, 1) : (m === "fifo" ? fmt(1000 / 60, 1) : fmt(1000 / curFps + 1000 / 120, 1));

      out.set(sim.rows([
        ["Selected Mode", m.toUpperCase()],
        ["Tearing Risk", m === "immediate" ? "SEVERE (No vertical sync)" : "NONE (V-Sync locked)"],
        ["Display Refresh", `${vblankHz} Hz`],
        ["Effective Display Rate", `${fmt(effectiveFps, 0)} FPS`],
        ["Input Latency", `${latency} ms`],
        ["Spec Guarantee", m === "fifo" ? "Mandatory (Every Vulkan device)" : "Optional extension"],
      ]));
    });
  }

  function simImageViews(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const aspect = sim.select(controls, { label: "Aspect Mask", options: [["color", "VK_IMAGE_ASPECT_COLOR_BIT"], ["depth", "VK_IMAGE_ASPECT_DEPTH_BIT"]], value: "color", onChange: () => v.redraw() });
    const swizzle = sim.segmented(controls, { label: "Component Swizzle", options: [["identity", "Identity (RGBA)"], ["bgr", "Swap RB (BGRA)"], ["mono", "Monochrome (RRRR)"]], value: "identity", onChange: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const isColor = aspect.value === "color";
      const swz = swizzle.value;

      // VkImage (Raw Memory Block)
      view.rect([-4.5, -2.4], [-1.0, 2.6], { color: "b", fill: "b", fillAlpha: 0.15 });
      view.text([-2.75, 2.2], "VkImage (Raw GPU Bytes)", { align: "center", color: "b", size: 12, bold: true });
      view.text([-2.75, 1.6], isColor ? "Format: B8G8R8A8_SRGB" : "Format: D32_SFLOAT", { align: "center", color: "fg", size: 10 });

      // Raw memory rows
      for (let r = 0; r < 4; r++) {
        const y = 0.8 - r * 0.7;
        view.rect([-4.2, y - 0.25], [-1.3, y + 0.25], { color: "muted", fill: "panel", fillAlpha: 0.4 });
        view.text([-2.75, y], `Texel Row ${r}: [ 0x${(r*16+10).toString(16)} ... ]`, { align: "center", color: "muted", size: 9 });
      }

      // VkImageView (Optical Lens / Descriptor)
      view.rect([1.0, -2.4], [4.5, 2.6], { color: "g", fill: "g", fillAlpha: 0.15 });
      view.text([2.75, 2.2], "VkImageView (Render Lens)", { align: "center", color: "g", size: 12, bold: true });
      view.text([2.75, 1.6], "ViewType: VK_IMAGE_VIEW_TYPE_2D", { align: "center", color: "fg", size: 10 });

      // Channels view
      const channels = swz === "identity" ? ["R", "G", "B", "A"] : (swz === "bgr" ? ["B", "G", "R", "A"] : ["R", "R", "R", "R"]);
      for (let c = 0; c < 4; c++) {
        const y = 0.8 - c * 0.7;
        view.rect([1.3, y - 0.25], [4.2, y + 0.25], { color: "a", fill: "a", fillAlpha: 0.25 });
        view.text([2.75, y], `Channel ${c} -> ${channels[c]} (Subresource Layer 0)`, { align: "center", color: "fg", size: 10, bold: true });
      }

      // Connecting arrow
      view.arrow([-1.0, 0.1], [1.0, 0.1], { color: "c", label: "Interprets" });

      out.set(sim.rows([
        ["Target Aspect", isColor ? "Color plane (Swapchain presentation)" : "Depth plane (Z-buffer test)"],
        ["Format Compatibility", isColor ? "VK_FORMAT_B8G8R8A8_SRGB" : "VK_FORMAT_D32_SFLOAT"],
        ["Swizzle R->", channels[0]],
        ["Swizzle G->", channels[1]],
        ["Swizzle B->", channels[2]],
        ["Swizzle A->", channels[3]],
        ["Mipmap Slice", "Level 0 (Count: 1)"],
      ]));
    });
  }

  function simSwapchainRecreation(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const action = sim.segmented(controls, { label: "Window Event", options: [["render", "Normal Render"], ["resize", "Drag Corner (Resize)"], ["minimize", "Minimize to Taskbar"], ["restore", "Restore Window"]], value: "render", onChange: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const act = action.value;

      let state = "STABLE";
      let extent = "800 x 600";
      let statusColor = "g";
      let flowText = "vkAcquireNextImageKHR -> vkQueueSubmit -> vkQueuePresentKHR";

      if (act === "resize") {
        state = "OUT_OF_DATE (Resize)";
        extent = "1280 x 720 (Size Mismatch)";
        statusColor = "warn";
        flowText = "vkQueuePresentKHR returns VK_ERROR_OUT_OF_DATE_KHR -> RecreateSwapChain()";
      } else if (act === "minimize") {
        state = "MINIMIZED (Extent 0x0)";
        extent = "0 x 0 (Paused)";
        statusColor = "err";
        flowText = "Looping inside glfwWaitEvents() -> Rendering halted to prevent crash";
      } else if (act === "restore") {
        state = "RECREATING";
        extent = "800 x 600";
        statusColor = "c";
        flowText = "vkDeviceWaitIdle() -> Cleanup old swapchain -> vkCreateSwapchainKHR -> Resume";
      }

      // Window Box
      view.rect([-4.5, 1.4], [-1.0, 3.2], { color: "a", fill: "a", fillAlpha: 0.15 });
      view.text([-2.75, 2.7], "OS Window", { align: "center", color: "fg", size: 12, bold: true });
      view.text([-2.75, 2.0], `Framebuffer: ${extent}`, { align: "center", color: "a", size: 10 });

      // State Node
      view.rect([0.5, 1.4], [4.5, 3.2], { color: statusColor, fill: statusColor, fillAlpha: 0.2 });
      view.text([2.5, 2.7], "Swapchain State", { align: "center", color: statusColor, size: 12, bold: true });
      view.text([2.5, 2.0], state, { align: "center", color: "fg", size: 11, bold: true });

      // Teardown and recreation sequence
      view.rect([-4.5, -2.6], [4.5, 0.4], { color: "muted", fill: "panel", fillAlpha: 0.5 });
      view.text([-4.2, 0.0], "Execution Sequence & Synchronization Steps:", { color: "fg", size: 12, bold: true });

      const steps = [
        "1. Check return of vkAcquireNextImage / vkQueuePresent",
        "2. If width == 0 || height == 0, wait with glfwWaitEvents()",
        "3. vkDeviceWaitIdle(device) ensures GPU is not drawing",
        "4. Destroy old VkFramebuffer and VkImageView objects",
        "5. Pass oldSwapchain into VkSwapchainCreateInfoKHR and create new swapchain",
        "6. Allocate new VkImageViews and VkFramebuffers",
      ];
      steps.forEach((st, idx) => {
        const y = -0.5 - idx * 0.35;
        const highlight = (act === "restore" && idx >= 2) || (act === "minimize" && idx === 1) || (act === "resize" && idx === 0);
        view.text([-4.0, y], st, { color: highlight ? "a" : "muted", size: 9, bold: highlight });
      });

      out.set(sim.rows([
        ["Current Event", act.toUpperCase()],
        ["Swapchain Status", state],
        ["Current Extent", extent],
        ["Action Taken", flowText],
        ["GPU Sync Required", "vkDeviceWaitIdle() must precede cleanup"],
      ]));
    });
  }
})();
