// Learn Vulkan — Chapter 1: Vulkan Foundations & Architecture
(function () {
  "use strict";
  const { fmt } = L3D.math;

  L3D.topic({
    id: "VK1.1",
    summary: "Vulkan is an explicit, low-overhead cross-platform graphics and compute API that eliminates driver guesswork by placing GPU control directly in your code.",
    lesson: String.raw`
      <p><strong>Vulkan is an explicit graphics and compute API</strong> designed by the Khronos Group. Traditional APIs such as OpenGL and Direct3D 11 were created in an era of fixed-function graphics cards and single-threaded CPUs. Modern graphics processors (GPUs), however, are massively parallel computing engines with multiple asynchronous hardware queues, distinct memory architectures, and programmable compute units. Vulkan was engineered from scratch to match modern hardware.</p>
      <div class="key"><p>In OpenGL, the driver guesses what you want, manages memory behind your back, and tracks state constantly. In Vulkan, the driver does virtually no hand-holding: your code explicitly manages memory, records command buffers ahead of time, and controls GPU synchronization.</p></div>

      <h2 data-sub="VK1.1.1">Driver overhead and explicit control</h2>
      <p>Under OpenGL, every draw call causes the driver to validate the entire pipeline state: are vertex arrays bound? Are texture units active? Is depth testing enabled? This heavy runtime validation causes massive CPU overhead, frequently leaving the CPU as the bottleneck even when the GPU is idle.</p>
      <p>Vulkan eliminates this overhead through <strong>ahead-of-time preparation</strong> and <strong>explicit state objects</strong>:</p>
      <ul>
        <li><strong>Immutability:</strong> The graphics pipeline state is compiled and validated once upfront into an immutable <code>VkPipeline</code> object. The driver never validates pipeline state during rendering.</li>
        <li><strong>Pre-recorded command buffers:</strong> Draw commands, compute dispatches, and memory copies are recorded into command buffers on worker threads and submitted in batches to GPU queues.</li>
        <li><strong>No hidden memory allocations:</strong> The driver never allocates GPU memory automatically. You query memory requirements, allocate memory heaps directly, and bind buffers or images to memory addresses.</li>
      </ul>

      <h2 data-sub="VK1.1.2">CPU vs GPU split</h2>
      <p>Understanding Vulkan requires viewing the computer as two distinct entities connected by the PCI-Express bus:</p>
      <table>
        <tr><th>Role</th><th>Host (CPU)</th><th>Device (GPU)</th></tr>
        <tr><td>Execution</td><td>Sequential, low core count, high single-thread clock</td><td>Massively parallel, thousands of arithmetic cores</td></tr>
        <tr><td>Memory</td><td>System RAM (high capacity, moderate bandwidth)</td><td>Dedicated VRAM (ultra-high bandwidth, e.g. GDDR6 / HBM)</td></tr>
        <tr><td>Commands</td><td>Records commands into <code>VkCommandBuffer</code></td><td>Executes submitted command buffers from <code>VkQueue</code></td></tr>
        <tr><td>Coordination</td><td>Controls synchronization using <strong>fences</strong></td><td>Controls internal queue ordering using <strong>semaphores</strong></td></tr>
      </table>
      <p>When you call a Vulkan function like <code>vkCmdDraw</code>, the GPU does <em>not</em> draw immediately. Instead, your CPU simply writes a small instruction packet into a command buffer. Only when you call <code>vkQueueSubmit</code> does the work get handed to the GPU queue to execute asynchronously.</p>

      <h2 data-sub="VK1.1.3">Vulkan vs OpenGL</h2>
      <p>While OpenGL hides complexity behind global context states (e.g. <code>glBindBuffer</code>, <code>glEnable</code>), this abstraction breaks down on modern architectures:</p>
      <ul>
        <li><strong>Multi-threading:</strong> OpenGL contexts cannot be accessed concurrently from multiple threads without complex context switching and stalls. In Vulkan, multiple CPU threads can record separate command buffers concurrently with zero locks.</li>
        <li><strong>Shader Compilation:</strong> OpenGL compiles GLSL text strings on the user's machine using the GPU vendor's proprietary compiler, leading to subtle cross-vendor syntax incompatibilities. Vulkan uses <strong>SPIR-V</strong>, a standardized binary intermediate representation compiled offline.</li>
        <li><strong>Unified Graphics and Compute:</strong> Vulkan treats graphics rendering and general-purpose compute (GPGPU) as first-class citizens running through the same unified queue architecture.</li>
      </ul>
      <div class="warn">Because the Vulkan driver performs almost no validation in release mode, invalid parameters or missing synchronization will not produce error codes; they will result in GPU device lost crashes or undefined visual artifacts. Validation layers must be used during development!</div>
      <div class="game">Game engines like Unreal Engine 5, DOOM Eternal's id Tech 7, and Red Dead Redemption 2 use Vulkan and DirectX 12 to eliminate CPU render-thread bottlenecks and maximize GPU utilization.</div>
      <p><a class="btn goto-sim" href="#/VK1.1/sim">Try it: explore driver overhead and command flow →</a></p>
    `,
    keyFormulas: [
      ["Asynchronous submission", String.raw`\text{CPU Records } \xrightarrow{\text{record}} \text{VkCommandBuffer} \xrightarrow{\text{vkQueueSubmit}} \text{VkQueue (GPU)}`],
      ["Host vs Device boundary", String.raw`\text{Host (CPU RAM)} \xleftrightarrow[\text{PCI-e Bus}]{\text{vkCmdCopyBuffer}} \text{Device (VRAM)}`],
    ],
    exercises: [
      { q: "Why does an OpenGL driver spend so much CPU time during a draw call?", a: "OpenGL drivers must dynamically re-validate the entire mutable context state machine (shaders, bound buffers, blend modes, depth states) on every single draw call." },
      { q: "What does vkCmdDraw do when called by your C++ code?", a: "It does not render anything immediately. It records a draw instruction into a VkCommandBuffer in CPU memory for later submission." },
      { q: "How does Vulkan solve cross-vendor GLSL compiler inconsistencies?", a: "Shaders are pre-compiled offline into standardized SPIR-V bytecode, ensuring consistent semantics across all GPU vendors." },
    ],
    cpp: [{
      title: "Querying Vulkan instance version",
      formula: String.raw`\text{VK\_API\_VERSION\_1\_3} = (1 \ll 22) \mid (3 \ll 12)`,
      note: "<p>Checks the highest Vulkan API version supported by the driver loader.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>
#include <iostream>

void CheckVulkanVersion()
{
    uint32_t apiVersion = 0;
    if (vkEnumerateInstanceVersion(&apiVersion) == VK_SUCCESS)
    {
        uint32_t major = VK_API_VERSION_MAJOR(apiVersion);
        uint32_t minor = VK_API_VERSION_MINOR(apiVersion);
        uint32_t patch = VK_API_VERSION_PATCH(apiVersion);
        std::cout << "Vulkan API: " << major << "." << minor << "." << patch << "\n";
    }
}
`,
    }],
    csharp: [{
      title: "Querying Vulkan instance version in C#",
      formula: String.raw`\text{VK\_API\_VERSION\_1\_3} = (1 \ll 22) \mid (3 \ll 12)`,
      note: "<p>Using Silk.NET.Vulkan or Vortice.Vulkan bindings.</p>",
      code: String.raw`
using Silk.NET.Vulkan;
using System;

public static unsafe void CheckVulkanVersion(Vk vk)
{
    uint apiVersion = 0;
    if (vk.EnumerateInstanceVersion(ref apiVersion) == Result.Success)
    {
        uint major = Vk.VersionMajor(apiVersion);
        uint minor = Vk.VersionMinor(apiVersion);
        uint patch = Vk.VersionPatch(apiVersion);
        Console.WriteLine($"Vulkan API: {major}.{minor}.{patch}");
    }
}
`,
    }],
    sims: [{ title: "Driver overhead & command pipeline", help: "<p>Compare how OpenGL and Vulkan submit draw commands. Adjust CPU load and note how Vulkan pre-bakes states into immutable pipelines and command buffers.</p>", mount: simDriverOverhead }],
  });

  L3D.topic({
    id: "VK1.2",
    summary: "VkInstance initializes the Vulkan API and enables global layers and extensions, while validation layers detect API misuse at zero cost to release builds.",
    lesson: String.raw`
      <p>The very first step in any Vulkan program is initializing the Vulkan library by creating a <strong>VkInstance</strong>. The instance represents your application's connection to the Vulkan loader and driver. During instance creation, you tell the driver about your application name, version, and which global extensions and validation layers you want to activate.</p>
      <div class="key"><p>Vulkan functions adhere to a standard naming convention: function names begin with lowercase <code>vk</code>, types begin with <code>Vk</code>, and macros or enums begin with <code>VK_</code>.</p></div>

      <h2 data-sub="VK1.2.1">VkInstance creation</h2>
      <p>Almost all Vulkan object creation follows a consistent pattern using configuration structs. Instead of passing dozens of function arguments, parameters are bundled in a <code>CreateInfo</code> struct:</p>
      <pre class="cpp"><code>VkApplicationInfo appInfo{};
appInfo.sType = VK_STRUCTURE_TYPE_APPLICATION_INFO;
appInfo.pApplicationName = "Learn Vulkan";
appInfo.apiVersion = VK_API_VERSION_1_3;

VkInstanceCreateInfo createInfo{};
createInfo.sType = VK_STRUCTURE_TYPE_INSTANCE_CREATE_INFO;
createInfo.pApplicationInfo = &amp;appInfo;
// specify enabled extensions and layers...
vkCreateInstance(&amp;createInfo, nullptr, &amp;instance);</code></pre>
      <p>Notice the <code>sType</code> field: nearly every Vulkan structure begins with a structure type enum. This allows drivers and validation layers to know the exact struct type and safely traverse extension chains via the <code>pNext</code> pointer.</p>

      <h2 data-sub="VK1.2.2">Validation layers</h2>
      <p>Because the Vulkan driver avoids performance-costly error checks, passing invalid arguments or calling commands in the wrong order causes hard crashes without helpful error messages. To solve this, Vulkan uses <strong>Validation Layers</strong>.</p>
      <p>Validation layers are optional modules that sit between your application and the GPU driver. They:</p>
      <ul>
        <li>Validate all function parameters against the official Vulkan specification.</li>
        <li>Track object creation, destruction, and memory leaks.</li>
        <li>Check thread-safety by verifying that objects are not accessed simultaneously by multiple threads without synchronization.</li>
        <li>Ensure proper image layout transitions and memory barrier masks.</li>
      </ul>
      <p>All standard checks are bundled in the LunarG SDK under <code>VK_LAYER_KHRONOS_validation</code>. In debug builds you enable it; in release builds you disable it for 100% native hardware speed with zero overhead.</p>

      <h2 data-sub="VK1.2.3">Debug callback setup</h2>
      <p>To receive human-readable error messages from the validation layer, you attach a debug messenger using the <code>VK_EXT_debug_utils</code> extension. You write a callback function of type <code>PFN_vkDebugUtilsMessengerCallbackEXT</code> that receives severity flags (<code>VERBOSE</code>, <code>INFO</code>, <code>WARNING</code>, <code>ERROR</code>) and message strings.</p>
      <div class="warn">Extension functions such as <code>vkCreateDebugUtilsMessengerEXT</code> are not loaded automatically by the static Vulkan library. You must query their function pointer dynamically using <code>vkGetInstanceProcAddr</code>.</div>
      <div class="note">Validation layers can also be configured with a <code>vk_layer_settings.txt</code> file to enforce best practices, sync hazard tracking, and GPU-assisted validation.</div>
      <p><a class="btn goto-sim" href="#/VK1.2/sim">Try it: test the validation layer pipeline →</a></p>
    `,
    keyFormulas: [
      ["Vulkan object creation pattern", String.raw`\text{vkCreate*}(\&createInfo,\ pAllocator,\ \&handle) \rightarrow \text{VkResult}`],
      ["Debug messenger callback", String.raw`\text{Severity} \ge \text{VK\_DEBUG\_UTILS\_MESSAGE\_SEVERITY\_WARNING\_BIT\_EXT}`],
    ],
    exercises: [
      { q: "Why does almost every Vulkan struct have an sType member?", a: "sType explicitly identifies the structure type for the driver and validation layers, enabling safe inspection of pNext extension chains." },
      { q: "What is the performance overhead of validation layers in a published release build?", a: "Zero. Validation layers are completely omitted in release builds; API calls go directly to the driver." },
      { q: "How do you call vkCreateDebugUtilsMessengerEXT if it is not in the default header symbols?", a: "Load its function pointer at runtime using vkGetInstanceProcAddr(instance, 'vkCreateDebugUtilsMessengerEXT')." },
    ],
    cpp: [{
      title: "Creating a Vulkan Instance with Validation",
      formula: String.raw`\text{vkCreateInstance}(\&createInfo, \text{nullptr}, \&instance)`,
      note: "<p>Enables the standard validation layer in debug builds.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>
#include <vector>
#include <stdexcept>

VkInstance CreateInstance(bool enableValidation)
{
    VkApplicationInfo appInfo{};
    appInfo.sType = VK_STRUCTURE_TYPE_APPLICATION_INFO;
    appInfo.pApplicationName = "Vulkan App";
    appInfo.applicationVersion = VK_MAKE_VERSION(1, 0, 0);
    appInfo.pEngineName = "Custom Engine";
    appInfo.engineVersion = VK_MAKE_VERSION(1, 0, 0);
    appInfo.apiVersion = VK_API_VERSION_1_3;

    VkInstanceCreateInfo createInfo{};
    createInfo.sType = VK_STRUCTURE_TYPE_INSTANCE_CREATE_INFO;
    createInfo.pApplicationInfo = &appInfo;

    const char* validationLayer = "VK_LAYER_KHRONOS_validation";
    if (enableValidation)
    {
        createInfo.enabledLayerCount = 1;
        createInfo.ppEnabledLayerNames = &validationLayer;
    }

    VkInstance instance;
    if (vkCreateInstance(&createInfo, nullptr, &instance) != VK_SUCCESS)
    {
        throw std::runtime_error("Failed to create Vulkan instance!");
    }
    return instance;
}
`,
    }],
    csharp: [{
      title: "Creating a Vulkan Instance in C#",
      formula: String.raw`\text{vkCreateInstance}`,
      note: "<p>Setting up VkInstanceCreateInfo with native string pointers.</p>",
      code: String.raw`
using Silk.NET.Vulkan;
using Silk.NET.Core;

public static unsafe Instance CreateInstance(Vk vk, bool enableValidation)
{
    var appInfo = new ApplicationInfo
    {
        SType = StructureType.ApplicationInfo,
        ApiVersion = Vk.Version13,
    };

    var createInfo = new InstanceCreateInfo
    {
        SType = StructureType.InstanceCreateInfo,
        PApplicationInfo = &appInfo,
    };

    Instance instance;
    if (vk.CreateInstance(ref createInfo, null, out instance) != Result.Success)
    {
        throw new System.Exception("Failed to create Vulkan instance!");
    }
    return instance;
}
`,
    }],
    sims: [{ title: "Validation layer stack", help: "<p>Toggle validation layers to see how API calls are intercepted, inspected for memory leaks or illegal state transitions, and routed to the driver.</p>", mount: simValidationLayers }],
  });

  L3D.topic({
    id: "VK1.3",
    summary: "VkPhysicalDevice represents physical GPU hardware in the system, and queue families expose distinct queues for graphics, compute, and memory transfer.",
    lesson: String.raw`
      <p>After creating the instance, your application must discover the available graphics hardware and select an appropriate GPU. In Vulkan, a physical graphics card is represented by a <strong>VkPhysicalDevice</strong> handle. Physical devices are implicitly managed by the instance and do not need explicit destruction.</p>
      <div class="key"><p>Unlike OpenGL, which automatically binds to the primary display adapter, Vulkan enumerates all graphics adapters (discrete GPUs, integrated GPUs, software rasterizers), allowing your code to pick the most powerful GPU.</p></div>

      <h2 data-sub="VK1.3.1">Selecting a GPU</h2>
      <p>You query available GPUs using <code>vkEnumeratePhysicalDevices</code>. An application will typically rate each GPU according to its capabilities:</p>
      <ul>
        <li><code>VK_PHYSICAL_DEVICE_TYPE_DISCRETE_GPU</code>: Dedicated graphics card with high-speed VRAM.</li>
        <li><code>VK_PHYSICAL_DEVICE_TYPE_INTEGRATED_GPU</code>: Built into the CPU, sharing system memory.</li>
        <li><code>VK_PHYSICAL_DEVICE_TYPE_CPU</code>: Software emulation (such as SwiftShader).</li>
      </ul>
      <p>Applications score devices based on texture dimensions, dedicated VRAM capacity, and required features before selecting the best candidate.</p>

      <h2 data-sub="VK1.3.2">Device properties &amp; features</h2>
      <p>Vulkan separates device information into two queries:</p>
      <ol>
        <li><strong>VkPhysicalDeviceProperties:</strong> Fixed hardware limits such as maximum image dimensions (<code>maxImageDimension2D</code>), maximum uniform buffer range, and device name.</li>
        <li><strong>VkPhysicalDeviceFeatures:</strong> Optional GPU capabilities such as wide lines, geometry shaders, anisotropic filtering, 64-bit floats, and sample rate shading. If you intend to use a feature, you must explicitly enable it later when creating the logical device.</li>
      </ol>

      <h2 data-sub="VK1.3.3">Queue families</h2>
      <p>Modern GPUs execute workloads through independent hardware pipelines called <strong>Queue Families</strong>. Every operation in Vulkan—whether drawing triangles, dispatching compute shaders, or copying buffers—must be submitted to a <code>VkQueue</code> belonging to a specific queue family.</p>
      <p>Each queue family advertises the operations its queues can execute using bit flags:</p>
      <table>
        <tr><th>Flag</th><th>Capability</th><th>Description</th></tr>
        <tr><td><code>VK_QUEUE_GRAPHICS_BIT</code></td><td>Graphics</td><td>Supports render passes, vertex transformation, rasterization, and draw calls.</td></tr>
        <tr><td><code>VK_QUEUE_COMPUTE_BIT</code></td><td>Compute</td><td>Supports general-purpose compute shader dispatches.</td></tr>
        <tr><td><code>VK_QUEUE_TRANSFER_BIT</code></td><td>Memory transfer</td><td>Supports copying buffers and images between host RAM and device VRAM.</td></tr>
        <tr><td><code>VK_QUEUE_SPARSE_BINDING_BIT</code></td><td>Sparse memory</td><td>Supports binding virtual memory pages on demand.</td></tr>
      </table>
      <div class="note">Any queue family that supports graphics or compute operations implicitly supports memory transfer operations, even if the transfer bit is not explicitly set.</div>
      <div class="game">High-end desktop GPUs often feature dedicated asynchronous compute and transfer queues, allowing asset streaming (uploading textures over PCI-e) in the background without stealing cycles from the graphics rendering queue.</div>
      <p><a class="btn goto-sim" href="#/VK1.3/sim">Try it: inspect physical devices and queue families →</a></p>
    `,
    keyFormulas: [
      ["Queue family query", String.raw`\text{vkGetPhysicalDeviceQueueFamilyProperties}(\text{device}, \&\text{count}, \text{props})`],
      ["Device suitability", String.raw`\text{IsSuitable} = \text{HasGraphicsQueue} \land \text{HasSwapChainSupport} \land \text{FeaturesSupported}`],
    ],
    exercises: [
      { q: "Why doesn't Vulkan automatically pick the primary display GPU?", a: "Vulkan allows applications to query all GPUs and select the best device (e.g. discrete vs integrated) or even use multiple GPUs simultaneously." },
      { q: "Do you need to destroy a VkPhysicalDevice handle during cleanup?", a: "No. Physical devices are owned by the VkInstance and are cleaned up automatically when the instance is destroyed." },
      { q: "What does it mean if a queue family has VK_QUEUE_TRANSFER_BIT but not GRAPHICS_BIT?", a: "It is a dedicated DMA transfer engine capable of streaming memory across PCI-e asynchronously without interrupting graphics rendering." },
    ],
    cpp: [{
      title: "Finding Queue Family Indices",
      formula: String.raw`\text{flags} \ \& \ \text{VK\_QUEUE\_GRAPHICS\_BIT}`,
      note: "<p>Searches for a queue family that supports graphics commands.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>
#include <vector>
#include <optional>

struct QueueFamilyIndices {
    std::optional<uint32_t> graphicsFamily;

    bool isComplete() const {
        return graphicsFamily.has_value();
    }
};

QueueFamilyIndices FindQueueFamilies(VkPhysicalDevice device)
{
    QueueFamilyIndices indices;
    uint32_t count = 0;
    vkGetPhysicalDeviceQueueFamilyProperties(device, &count, nullptr);
    std::vector<VkQueueFamilyProperties> families(count);
    vkGetPhysicalDeviceQueueFamilyProperties(device, &count, families.data());

    for (uint32_t i = 0; i < count; ++i)
    {
        if (families[i].queueFlags & VK_QUEUE_GRAPHICS_BIT)
        {
            indices.graphicsFamily = i;
            break;
        }
    }
    return indices;
}
`,
    }],
    csharp: [{
      title: "Finding Queue Families in C#",
      formula: String.raw`\text{queueFlags} \ \& \ \text{QueueFlags.GraphicsBit}`,
      note: "<p>Iterates over physical device queue family properties.</p>",
      code: String.raw`
using Silk.NET.Vulkan;
using System.Collections.Generic;

public struct QueueFamilyIndices
{
    public uint? GraphicsFamily;
    public bool IsComplete => GraphicsFamily.HasValue;
}

public static unsafe QueueFamilyIndices FindQueueFamilies(Vk vk, PhysicalDevice device)
{
    var indices = new QueueFamilyIndices();
    uint count = 0;
    vk.GetPhysicalDeviceQueueFamilyProperties(device, ref count, null);
    var properties = new QueueFamilyProperties[count];
    fixed (QueueFamilyProperties* ptr = properties)
    {
        vk.GetPhysicalDeviceQueueFamilyProperties(device, ref count, ptr);
    }
    for (uint i = 0; i < count; i++)
    {
        if (properties[i].QueueFlags.HasFlag(QueueFlags.GraphicsBit))
        {
            indices.GraphicsFamily = i;
            break;
        }
    }
    return indices;
}
`,
    }],
    sims: [{ title: "GPU queue families inspector", help: "<p>Select an adapter type and see its internal queue families and capabilities (Graphics, Compute, Transfer).</p>", mount: simQueueFamilies }],
  });

  L3D.topic({
    id: "VK1.4",
    summary: "VkDevice is the logical interface to your physical GPU, creating the specific queues and enabling the hardware features needed by your application.",
    lesson: String.raw`
      <p>While <code>VkPhysicalDevice</code> represents the physical hardware sitting in your computer, a <strong>VkDevice</strong> (logical device) represents your application's private, initialized interface to that hardware. Through the logical device, you allocate memory, create buffers, build pipelines, and acquire queues.</p>
      <div class="key"><p>You can create multiple logical devices from a single physical device if you have distinct rendering engines or background worker threads requiring isolated state.</p></div>

      <h2 data-sub="VK1.4.1">VkDevice creation</h2>
      <p>To create a logical device with <code>vkCreateDevice</code>, you must specify:</p>
      <ol>
        <li><strong>Queue creation info (<code>VkDeviceQueueCreateInfo</code>):</strong> Which queue families to allocate from, and how many queues to instantiate.</li>
        <li><strong>Device features (<code>VkPhysicalDeviceFeatures</code>):</strong> Hardware capabilities you want to activate (e.g. <code>samplerAnisotropy</code>). Features not requested cannot be used later, even if supported by the physical device.</li>
        <li><strong>Device extensions:</strong> Extensions specific to hardware operations, such as <code>VK_KHR_swapchain</code> for presenting frames to windows.</li>
      </ol>

      <h2 data-sub="VK1.4.2">Queue priorities</h2>
      <p>When requesting queues, Vulkan requires you to assign a priority to each queue using floating-point numbers between \(0.0\) (lowest priority) and \(1.0\) (highest priority). This guides the hardware driver's work scheduler when arbitrating between competing queues:</p>
      <pre class="cpp"><code>float queuePriority = 1.0f;
VkDeviceQueueCreateInfo queueCreateInfo{};
queueCreateInfo.sType = VK_STRUCTURE_TYPE_DEVICE_QUEUE_CREATE_INFO;
queueCreateInfo.queueFamilyIndex = indices.graphicsFamily.value();
queueCreateInfo.queueCount = 1;
queueCreateInfo.pQueuePriorities = &amp;queuePriority;</code></pre>

      <h2 data-sub="VK1.4.3">Retrieving queue handles</h2>
      <p>Queues are created automatically along with the logical device. Once <code>vkCreateDevice</code> succeeds, you query the queue handles using <code>vkGetDeviceQueue</code>:</p>
      <pre class="cpp"><code>VkQueue graphicsQueue;
vkGetDeviceQueue(device, indices.graphicsFamily.value(), 0, &amp;graphicsQueue);</code></pre>
      <p>The queue handle <code>VkQueue</code> is an opaque pointer used to submit command buffers. Because queues are cleaned up implicitly when the logical device is destroyed, they have no corresponding <code>vkDestroyQueue</code> function.</p>
      <div class="warn">Always call <code>vkDeviceWaitIdle(device)</code> before destroying the logical device with <code>vkDestroyDevice</code>. Destroying a device while the GPU is still executing commands is an illegal operation that will trigger validation errors and driver crashes.</div>
      <p><a class="btn goto-sim" href="#/VK1.4/sim">Try it: configure logical device and queue priorities →</a></p>
    `,
    keyFormulas: [
      ["Device creation call", String.raw`\text{vkCreateDevice}(\text{physicalDevice}, \&\text{createInfo}, \text{nullptr}, \&\text{device})`],
      ["Retrieving queue handle", String.raw`\text{vkGetDeviceQueue}(\text{device}, \text{familyIndex}, \text{queueIndex}, \&\text{queue})`],
    ],
    exercises: [
      { q: "Why must you explicitly enable physical device features during VkDevice creation?", a: "Vulkan requires explicit declaration of features so the driver can optimize memory layouts and disable unnecessary hardware emulation." },
      { q: "Is there a vkDestroyQueue function in Vulkan?", a: "No. Queues are destroyed implicitly when the parent VkDevice is destroyed with vkDestroyDevice." },
      { q: "What is the purpose of queue priorities?", a: "Priorities (0.0 to 1.0) allow the OS and GPU scheduler to prioritize critical workloads like interactive rendering over background compute tasks." },
    ],
    cpp: [{
      title: "Creating a Logical Device",
      formula: String.raw`\text{vkCreateDevice}`,
      note: "<p>Creates logical device and queries graphics queue handle.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>
#include <stdexcept>

void CreateLogicalDevice(VkPhysicalDevice physicalDevice, uint32_t graphicsQueueFamily,
                         VkDevice& outDevice, VkQueue& outQueue)
{
    float queuePriority = 1.0f;
    VkDeviceQueueCreateInfo queueInfo{};
    queueInfo.sType = VK_STRUCTURE_TYPE_DEVICE_QUEUE_CREATE_INFO;
    queueInfo.queueFamilyIndex = graphicsQueueFamily;
    queueInfo.queueCount = 1;
    queueInfo.pQueuePriorities = &queuePriority;

    VkPhysicalDeviceFeatures deviceFeatures{};
    deviceFeatures.samplerAnisotropy = VK_TRUE;

    VkDeviceCreateInfo createInfo{};
    createInfo.sType = VK_STRUCTURE_TYPE_DEVICE_CREATE_INFO;
    createInfo.queueCreateInfoCount = 1;
    createInfo.pQueueCreateInfos = &queueInfo;
    createInfo.pEnabledFeatures = &deviceFeatures;

    if (vkCreateDevice(physicalDevice, &createInfo, nullptr, &outDevice) != VK_SUCCESS)
    {
        throw std::runtime_error("Failed to create logical device!");
    }
    vkGetDeviceQueue(outDevice, graphicsQueueFamily, 0, &outQueue);
}
`,
    }],
    csharp: [{
      title: "Creating Logical Device in C#",
      formula: String.raw`\text{vkCreateDevice}`,
      note: "<p>Instantiating VkDevice and retrieving device queue.</p>",
      code: String.raw`
using Silk.NET.Vulkan;

public static unsafe void CreateLogicalDevice(Vk vk, PhysicalDevice physicalDevice,
    uint queueFamily, out Device device, out Queue queue)
{
    float priority = 1.0f;
    var queueInfo = new DeviceQueueCreateInfo
    {
        SType = StructureType.DeviceQueueCreateInfo,
        QueueFamilyIndex = queueFamily,
        QueueCount = 1,
        PQueuePriorities = &priority,
    };

    var createInfo = new DeviceCreateInfo
    {
        SType = StructureType.DeviceCreateInfo,
        QueueCreateInfoCount = 1,
        PQueueCreateInfos = &queueInfo,
    };

    if (vk.CreateDevice(physicalDevice, ref createInfo, null, out device) != Result.Success)
    {
        throw new System.Exception("Failed to create logical device!");
    }
    vk.GetDeviceQueue(device, queueFamily, 0, out queue);
}
`,
    }],
    sims: [{ title: "Device & queue scheduling", help: "<p>Adjust queue priority and dispatch tasks. Notice how higher-priority graphics queues are scheduled before background compute queues.</p>", mount: simDeviceScheduling }],
  });

  // ------------------------------------------------------------ Simulations
  function simDriverOverhead(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const api = sim.segmented(controls, { label: "API", options: [["vk", "Vulkan (Explicit)"], ["gl", "OpenGL (Driver Managed)"]], value: "vk", onChange: () => v.redraw() });
    const draws = sim.slider(controls, { label: "Draw commands", min: 100, max: 2000, step: 100, value: 500, onInput: () => v.redraw() });
    const threads = sim.slider(controls, { label: "Recording threads", min: 1, max: 8, step: 1, value: 4, onInput: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      const isVk = api.value === "vk";
      const count = draws.value;
      const th = threads.value;
      view.grid({ step: 1 }); view.axes({ ticks: true });

      // CPU Stage
      view.rect([-4.5, 1.2], [4.5, 3.2], { color: "a", fill: "a", fillAlpha: 0.1 });
      view.text([-4.3, 2.9], "CPU: Host Application & Driver", { color: "fg", size: 13, bold: true });

      // In Vulkan, multi-threaded recording divides CPU time by threads
      // In OpenGL, single-threaded context mutex serialization
      const cpuTime = isVk ? (count * 0.003) / Math.sqrt(th) : count * 0.012;
      const driverOverhead = isVk ? count * 0.001 : count * 0.009;

      if (isVk) {
        for (let i = 0; i < th; i++) {
          const y = 2.4 - i * (1.8 / Math.max(th, 1));
          view.rect([-4.2, y - 0.15], [-0.5, y + 0.15], { color: "c", fill: "c", fillAlpha: 0.35 });
          view.text([-4.0, y], `Thread ${i + 1}: Record CmdBuffer`, { color: "fg", size: 10 });
        }
        view.rect([0.0, 1.4], [4.2, 2.6], { color: "a", fill: "a", fillAlpha: 0.25 });
        view.text([2.1, 2.0], "Batch vkQueueSubmit (No validation)", { align: "center", color: "fg", size: 11 });
      } else {
        view.rect([-4.2, 1.5], [4.2, 2.5], { color: "b", fill: "b", fillAlpha: 0.25 });
        view.text([0, 2.0], "Single Thread Context: State Tracking + Validation Loop", { align: "center", color: "fg", size: 12 });
      }

      // GPU Stage
      view.rect([-4.5, -2.8], [4.5, -0.6], { color: "g", fill: "g", fillAlpha: 0.12 });
      view.text([-4.3, -0.9], "GPU: Device Execution Queues", { color: "fg", size: 13, bold: true });
      view.arrow([0, 1.2], [0, -0.6], { color: "a", label: isVk ? "Direct Queue Submission" : "Driver Translation Stalls" });

      const gpuBusy = Math.min(100, Math.round((count / (count * (isVk ? 0.003 : 0.012) + 200)) * 250));
      view.rect([-4.2, -2.4], [-4.2 + (8.4 * gpuBusy) / 100, -1.4], { color: "g", fill: "g", fillAlpha: 0.6 });
      view.text([0, -1.9], `GPU Pipeline Utilization: ${gpuBusy}%`, { align: "center", color: "fg", size: 12 });

      out.set(sim.rows([
        ["API Model", isVk ? "Explicit (Vulkan)" : "Implicit State (OpenGL)"],
        ["Command Count", count],
        ["CPU Host Cost", fmt(cpuTime, 2) + " ms"],
        ["Driver Overhead", fmt(driverOverhead, 2) + " ms (" + (isVk ? "Minimal" : "High") + ")"],
        ["GPU Throughput", gpuBusy + "% utilization"],
        ["Threading", isVk ? `${th} threads recording in parallel` : "Serialized to 1 thread"],
      ]));
    });
  }

  function simValidationLayers(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const enabled = sim.checkbox(controls, { label: "Enable Validation Layers", value: true, onChange: () => v.redraw() });
    const testError = sim.select(controls, { label: "Trigger Error", options: [["none", "Valid Call"], ["null_ptr", "Pass Null Pointer"], ["invalid_enum", "Invalid Enum"], ["mem_leak", "Destroy Object Before Use"]], value: "none", onChange: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const valOn = enabled.value;
      const err = testError.value;

      // App Block
      view.rect([-4.2, 2.2], [-1.5, 3.4], { color: "a", fill: "a", fillAlpha: 0.25 });
      view.text([-2.85, 2.8], "Vulkan App", { align: "center", color: "fg", size: 13, bold: true });

      // Validation Layer Stack
      view.rect([-0.8, 1.2], [2.2, 3.4], { color: valOn ? "c" : "muted", fill: valOn ? "c" : "panel", fillAlpha: valOn ? 0.25 : 0.1 });
      view.text([0.7, 2.9], "Validation Layers", { align: "center", color: valOn ? "c" : "muted", size: 12, bold: true });
      view.text([0.7, 2.3], valOn ? "Checks spec, memory, threads" : "(Bypassed / Zero Cost)", { align: "center", color: "fg", size: 10 });

      // Driver Block
      view.rect([2.8, 2.2], [4.5, 3.4], { color: "g", fill: "g", fillAlpha: 0.25 });
      view.text([3.65, 2.8], "GPU Driver", { align: "center", color: "fg", size: 13, bold: true });

      view.arrow([-1.5, 2.8], [-0.8, 2.8], { color: "a" });
      view.arrow([2.2, 2.8], [2.8, 2.8], { color: "g" });

      // Diagnostic message terminal area
      view.rect([-4.2, -2.5], [4.5, 0.4], { color: "muted", fill: "panel", fillAlpha: 0.6 });
      view.text([-4.0, 0.1], "Terminal Callback Output:", { color: "fg", size: 12, bold: true });

      let msg = "No messages: all API parameters conform to Vulkan 1.3 spec.";
      let status = "OK";
      if (err !== "none") {
        if (valOn) {
          status = "ERROR DETECTED";
          if (err === "null_ptr") msg = "[VALIDATION ERROR: VUID-vkCreateInstance-pCreateInfo-parameter]\npCreateInfo cannot be null. Call aborted safely.";
          if (err === "invalid_enum") msg = "[VALIDATION ERROR: VUID-VkApplicationInfo-sType-sType]\nsType must be VK_STRUCTURE_TYPE_APPLICATION_INFO (value 0).";
          if (err === "mem_leak") msg = "[VALIDATION ERROR: VUID-vkDestroyInstance-instance-00629]\nVkDevice was not destroyed before vkDestroyInstance. Object leak detected!";
        } else {
          status = "CRASH / UNDEFINED BEHAVIOR";
          msg = "FATAL: Access violation at 0x00000000. Hardware driver crashed because validation was disabled.";
        }
      }

      view.text([-4.0, -0.6], msg, { color: status === "OK" ? "c" : "e", size: 11 });

      out.set(sim.rows([
        ["Layers Active", valOn ? "YES (VK_LAYER_KHRONOS_validation)" : "NO (Native Performance)"],
        ["Test State", testError.options.find(o => o[0] === err)[1]],
        ["Behavior", status],
        ["Recommendation", valOn ? "Keep enabled in Debug builds" : "Disable in Release for maximum FPS"],
      ]));
    });
  }

  function simQueueFamilies(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const gpuType = sim.select(controls, { label: "Selected GPU", options: [["discrete", "NVIDIA GeForce RTX (Discrete GPU)"], ["integrated", "Intel Iris Xe (Integrated GPU)"]], value: "discrete", onChange: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const isDisc = gpuType.value === "discrete";

      view.rect([-4.4, 2.0], [4.4, 3.4], { color: "a", fill: "a", fillAlpha: 0.18 });
      view.text([-4.2, 2.9], isDisc ? "Discrete GPU: NVIDIA RTX 4080 (16 GB VRAM)" : "Integrated GPU: Intel Iris Xe (Shared RAM)", { color: "fg", size: 13, bold: true });
      view.text([-4.2, 2.3], isDisc ? "Dedicated VRAM · Dedicated Async Transfer & Compute engines" : "Unified Memory · Shared Graphics & Compute Queues", { color: "muted", size: 11 });

      const families = isDisc ? [
        { name: "Family 0: Graphics + Compute + Transfer", count: 16, flags: "G + C + T + Present", color: "a", y: 0.8 },
        { name: "Family 1: Dedicated Compute (Async)", count: 8, flags: "Compute + Transfer", color: "b", y: -0.6 },
        { name: "Family 2: Dedicated Transfer (DMA)", count: 2, flags: "Transfer Only (PCI-e DMA)", color: "c", y: -2.0 },
      ] : [
        { name: "Family 0: Universal Graphics & Compute", count: 1, flags: "G + C + T + Present", color: "a", y: 0.2 },
      ];

      families.forEach((f) => {
        view.rect([-4.2, f.y - 0.55], [4.2, f.y + 0.55], { color: f.color, fill: f.color, fillAlpha: 0.2 });
        view.text([-4.0, f.y + 0.2], f.name, { color: "fg", size: 12, bold: true });
        view.text([-4.0, f.y - 0.25], `Queues: ${f.count}  |  Capabilities: ${f.flags}`, { color: f.color, size: 11 });
      });

      out.set(sim.rows([
        ["Device Type", isDisc ? "VK_PHYSICAL_DEVICE_TYPE_DISCRETE_GPU" : "VK_PHYSICAL_DEVICE_TYPE_INTEGRATED_GPU"],
        ["Queue Family Count", families.length],
        ["Async Compute", isDisc ? "Supported (Separate Queue Family)" : "Shared Queue Only"],
        ["Async Transfer", isDisc ? "Supported (Dedicated DMA)" : "Implicit in Graphics Queue"],
      ]));
    });
  }

  function simDeviceScheduling(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const priority = sim.slider(controls, { label: "Graphics Queue Priority", min: 0.0, max: 1.0, step: 0.1, value: 1.0, onInput: () => v.redraw() });
    const compPriority = sim.slider(controls, { label: "Compute Queue Priority", min: 0.0, max: 1.0, step: 0.1, value: 0.5, onInput: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const gp = priority.value;
      const cp = compPriority.value;

      view.text([-4.2, 3.0], "Hardware Scheduler Arbitration", { color: "fg", size: 14, bold: true });

      // Graphics Queue Bar
      view.rect([-4.2, 1.2], [4.2, 2.4], { color: "a", fill: "panel", fillAlpha: 0.3 });
      view.text([-4.0, 2.0], "VkQueue 0 (Graphics Queue)", { color: "fg", size: 12, bold: true });
      view.rect([-4.0, 1.4], [-4.0 + 8.0 * gp, 1.8], { color: "a", fill: "a", fillAlpha: 0.6 });
      view.text([3.2, 1.6], `pPriority: ${fmt(gp, 1)}`, { color: "fg", size: 11 });

      // Compute Queue Bar
      view.rect([-4.2, -0.6], [4.2, 0.6], { color: "b", fill: "panel", fillAlpha: 0.3 });
      view.text([-4.0, 0.2], "VkQueue 1 (Compute Queue)", { color: "fg", size: 12, bold: true });
      view.rect([-4.0, -0.4], [-4.0 + 8.0 * cp, 0.0], { color: "b", fill: "b", fillAlpha: 0.6 });
      view.text([3.2, -0.2], `pPriority: ${fmt(cp, 1)}`, { color: "fg", size: 11 });

      // GPU Execution Timeline result
      view.rect([-4.2, -2.6], [4.2, -1.2], { color: "g", fill: "g", fillAlpha: 0.15 });
      view.text([-4.0, -1.5], "GPU Core Scheduling Time Slice Ratio:", { color: "fg", size: 12, bold: true });
      const sum = Math.max(0.001, gp + cp);
      const gRatio = Math.round((gp / sum) * 100);
      const cRatio = 100 - gRatio;
      view.text([-4.0, -2.2], `Graphics Work: ${gRatio}%  vs  Compute Work: ${cRatio}%`, { color: "g", size: 12 });

      out.set(sim.rows([
        ["Graphics Priority", fmt(gp, 2)],
        ["Compute Priority", fmt(cp, 2)],
        ["Scheduler Share", `Graphics ${gRatio}% / Compute ${cRatio}%`],
        ["Rule", "pQueuePriorities (0.0 to 1.0) guide hardware time-slicing"],
      ]));
    });
  }
})();
