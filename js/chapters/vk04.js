// Learn Vulkan — Chapter 4: Command Recording & Synchronization
(function () {
  "use strict";
  const { fmt } = L3D.math;

  L3D.topic({
    id: "VK4.1",
    summary: "Command pools allocate command buffers where draw, copy, and compute operations are recorded before batch submission to GPU queues.",
    lesson: String.raw`
      <p><strong>In Vulkan, draw calls are never executed directly by calling immediate functions.</strong> In OpenGL, you called <code>glDrawElements()</code> and the driver sent instructions to the hardware right away. In Vulkan, all rendering, compute, and memory transfer operations are pre-recorded into <code>VkCommandBuffer</code> objects.</p>
      <div class="key"><p>Pre-recording commands separates the CPU overhead of generating rendering commands from GPU queue submission. Different CPU threads can record separate command buffers concurrently with zero driver locks, and submit them together in a single batch.</p></div>

      <h2 data-sub="VK4.1.1">VkCommandPool & queue families</h2>
      <p>Command buffers cannot be created directly; their underlying memory is managed by a <strong>Command Pool</strong> (<code>VkCommandPool</code>). Because memory management is closely coupled with hardware queue execution, every command pool is tied to a specific queue family index upon creation:</p>
      <pre><code>VkCommandPoolCreateInfo poolInfo{};
poolInfo.sType = VK_STRUCTURE_TYPE_COMMAND_POOL_CREATE_INFO;
poolInfo.flags = VK_COMMAND_POOL_CREATE_RESET_COMMAND_BUFFER_BIT;
poolInfo.queueFamilyIndex = indices.graphicsFamily;
vkCreateCommandPool(device, &poolInfo, nullptr, &commandPool);</code></pre>
      <p>A command buffer allocated from a graphics pool can only be submitted to queues from that specific graphics queue family.</p>

      <h2 data-sub="VK4.1.2">Primary vs secondary command buffers</h2>
      <p>Vulkan provides two tiers of command buffers:</p>
      <ul>
        <li><strong>Primary Command Buffers (<code>VK_COMMAND_BUFFER_LEVEL_PRIMARY</code>):</strong> Can be submitted directly to a <code>VkQueue</code>. They can also execute secondary command buffers, but cannot be called by any other command buffer.</li>
        <li><strong>Secondary Command Buffers (<code>VK_COMMAND_BUFFER_LEVEL_SECONDARY</code>):</strong> Cannot be submitted directly to a queue. Instead, worker threads record secondary command buffers in parallel (e.g., rendering different mesh chunks of a large scene), which are then called from a primary command buffer via <code>vkCmdExecuteCommands</code>.</li>
      </ul>

      <h2 data-sub="VK4.1.3">Buffer allocation & reset modes</h2>
      <p>Command pools offer two distinct memory recycling strategies configured via creation flags:</p>
      <ul>
        <li><code>VK_COMMAND_POOL_CREATE_RESET_COMMAND_BUFFER_BIT</code>: Allows resetting individual command buffers with <code>vkResetCommandBuffer</code> so their memory can be rerecorded each frame without reallocating.</li>
        <li><code>VK_COMMAND_POOL_CREATE_TRANSIENT_BIT</code>: Hints to the driver that command buffers allocated from this pool have a very short lifetime (e.g. single-time transfer buffers), allowing the driver to optimize memory allocator scratch blocks.</li>
      </ul>
      <p>Command buffers are allocated using <code>vkAllocateCommandBuffers</code> and destroyed either individually via <code>vkFreeCommandBuffers</code> or in bulk by destroying the pool with <code>vkDestroyCommandPool</code>.</p>
      <div class="note">Creating a separate command pool for each CPU worker thread allows lock-free parallel command generation across all available CPU cores.</div>
      <p><a class="btn goto-sim" href="#/VK4.1/sim">Try it: inspect command pool allocation and buffer tiers →</a></p>
    `,
    keyFormulas: [
      ["Pool allocation", String.raw`\text{vkAllocateCommandBuffers}(\text{device}, \&\text{allocInfo}, \text{commandBuffers.data()})`],
      ["Buffer hierarchy", String.raw`\text{Worker Threads } \xrightarrow{\text{record}} \text{Secondary Buffers } \xrightarrow{\text{vkCmdExecuteCommands}} \text{Primary Buffer } \xrightarrow{\text{vkQueueSubmit}} \text{Queue}`],
    ],
    exercises: [
      { q: "Can a secondary command buffer be submitted directly to a VkQueue with vkQueueSubmit?", a: "No. Secondary command buffers can only be executed by calling vkCmdExecuteCommands inside a primary command buffer." },
      { q: "Why is each VkCommandPool tied to a specific queue family index?", a: "GPU hardware architectures format command packets differently for graphics, compute, and transfer engines. The pool manages memory tailored to that specific queue family." },
      { q: "What does the VK_COMMAND_POOL_CREATE_RESET_COMMAND_BUFFER_BIT flag allow?", a: "It enables calling vkResetCommandBuffer on individual buffers allocated from that pool, allowing them to be rerecorded each frame without resetting the entire pool." },
    ],
    cpp: [{
      title: "Creating Command Pool & Allocating Command Buffers",
      formula: String.raw`\text{vkCreateCommandPool} + \text{vkAllocateCommandBuffers}`,
      note: "<p>Allocating primary command buffers for frames in flight.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>
#include <vector>

void CreateCommandBuffers(VkDevice device, uint32_t queueFamilyIndex,
                          uint32_t bufferCount, VkCommandPool& outPool,
                          std::vector<VkCommandBuffer>& outBuffers)
{
    VkCommandPoolCreateInfo poolInfo{};
    poolInfo.sType = VK_STRUCTURE_TYPE_COMMAND_POOL_CREATE_INFO;
    poolInfo.flags = VK_COMMAND_POOL_CREATE_RESET_COMMAND_BUFFER_BIT;
    poolInfo.queueFamilyIndex = queueFamilyIndex;

    if (vkCreateCommandPool(device, &poolInfo, nullptr, &outPool) != VK_SUCCESS) {
        throw std::runtime_error("Failed to create command pool!");
    }

    outBuffers.resize(bufferCount);
    VkCommandBufferAllocateInfo allocInfo{};
    allocInfo.sType = VK_STRUCTURE_TYPE_COMMAND_BUFFER_ALLOCATE_INFO;
    allocInfo.commandPool = outPool;
    allocInfo.level = VK_COMMAND_BUFFER_LEVEL_PRIMARY;
    allocInfo.commandBufferCount = bufferCount;

    if (vkAllocateCommandBuffers(device, &allocInfo, outBuffers.data()) != VK_SUCCESS) {
        throw std::runtime_error("Failed to allocate command buffers!");
    }
}
`,
    }],
    csharp: [{
      title: "Command Pool & Buffer Allocation in C#",
      formula: String.raw`\text{vk.AllocateCommandBuffers}`,
      note: "<p>Silk.NET command pool setup.</p>",
      code: String.raw`
using Silk.NET.Vulkan;

public static unsafe CommandBuffer[] AllocateCommandBuffers(Vk vk, Device device,
    uint queueFamilyIndex, uint count, out CommandPool pool)
{
    var poolInfo = new CommandPoolCreateInfo
    {
        SType = StructureType.CommandPoolCreateInfo,
        Flags = CommandPoolCreateFlags.ResetCommandBufferBit,
        QueueFamilyIndex = queueFamilyIndex,
    };

    if (vk.CreateCommandPool(device, ref poolInfo, null, out pool) != Result.Success)
        throw new System.Exception("Failed to create command pool!");

    var buffers = new CommandBuffer[count];
    var allocInfo = new CommandBufferAllocateInfo
    {
        SType = StructureType.CommandBufferAllocateInfo,
        CommandPool = pool,
        Level = CommandBufferLevel.Primary,
        CommandBufferCount = count,
    };

    fixed (CommandBuffer* pBuffers = buffers)
    {
        if (vk.AllocateCommandBuffers(device, ref allocInfo, pBuffers) != Result.Success)
            throw new System.Exception("Failed to allocate command buffers!");
    }

    return buffers;
}
`,
    }],
    sims: [{ title: "Command pool memory & buffer tiers", help: "<p>Allocate primary and secondary command buffers from a pool. Observe how worker threads populate secondary command buffers concurrently.</p>", mount: simCommandPool }],
  });

  L3D.topic({
    id: "VK4.2",
    summary: "Recording packages render passes, dynamic viewports, pipeline binds, and draw calls into a command buffer, transitioning it to the executable state.",
    lesson: String.raw`
      <p><strong>Recording is the process of writing GPU command packets into a <code>VkCommandBuffer</code>.</strong> During recording, no GPU hardware execution occurs; the CPU simply writes a sequence of compact descriptors into the allocated buffer memory.</p>
      <div class="key"><p>A command buffer begins in the <em>Initial</em> state, enters the <em>Recording</em> state on <code>vkBeginCommandBuffer</code>, and reaches the <em>Executable</em> state when sealed with <code>vkEndCommandBuffer</code>.</p></div>

      <h2 data-sub="VK4.2.1">vkBeginCommandBuffer</h2>
      <p>To start recording, initialize a <code>VkCommandBufferBeginInfo</code> structure and call <code>vkBeginCommandBuffer</code>:</p>
      <pre><code>VkCommandBufferBeginInfo beginInfo{};
beginInfo.sType = VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO;
beginInfo.flags = 0; // or VK_COMMAND_BUFFER_USAGE_ONE_TIME_SUBMIT_BIT
vkBeginCommandBuffer(commandBuffer, &beginInfo);</code></pre>
      <p>If the buffer was previously submitted, calling <code>vkResetCommandBuffer</code> resets it back to the initial state, ready for fresh recording.</p>

      <h2 data-sub="VK4.2.2">Render pass & draw commands</h2>
      <p>Once recording begins, drawing operations are wrapped inside a render pass instance:</p>
      <ol>
        <li><strong>Begin Render Pass:</strong> Call <code>vkCmdBeginRenderPass</code> with a <code>VkRenderPassBeginInfo</code> containing:
          <ul>
            <li><code>renderPass</code> and target <code>framebuffer</code>.</li>
            <li><code>renderArea</code> (e.g. offset \((0,0)\), extent \(800 \times 600\)).</li>
            <li><code>clearValueCount</code> and <code>pClearValues</code> (e.g. RGBA dark slate: <code>{{{0.05f, 0.05f, 0.08f, 1.0f}}}</code>).</li>
            <li>Subpass contents: <code>VK_SUBPASS_CONTENTS_INLINE</code> (all commands recorded in primary buffer) or <code>VK_SUBPASS_CONTENTS_SECONDARY_COMMAND_BUFFERS</code>.</li>
          </ul>
        </li>
        <li><strong>Bind Graphics Pipeline:</strong> Call <code>vkCmdBindPipeline(cmd, VK_PIPELINE_BIND_POINT_GRAPHICS, graphicsPipeline)</code>.</li>
        <li><strong>Set Dynamic States:</strong> Set viewport and scissor rectangles dynamically:
          <pre><code>vkCmdSetViewport(cmd, 0, 1, &viewport);
vkCmdSetScissor(cmd, 0, 1, &scissor);</code></pre>
        </li>
        <li><strong>Issue Draw Call:</strong> Call <code>vkCmdDraw(cmd, 3, 1, 0, 0)</code> to draw 3 vertices for a single instance.</li>
        <li><strong>End Render Pass:</strong> Call <code>vkCmdEndRenderPass(cmd)</code>.</li>
      </ol>

      <h2 data-sub="VK4.2.3">Ending command recording</h2>
      <p>Recording is finished by calling <code>vkEndCommandBuffer(commandBuffer)</code>. If this call returns <code>VK_SUCCESS</code>, the command buffer is locked and ready for immediate or repeated queue submission. Once in the executable state, attempting to record additional commands without resetting will trigger a validation layer error.</p>
      <p><a class="btn goto-sim" href="#/VK4.2/sim">Try it: step through the command recording pipeline →</a></p>
    `,
    keyFormulas: [
      ["Recording lifecycle", String.raw`\text{Initial} \xrightarrow{\text{vkBeginCommandBuffer}} \text{Recording} \xrightarrow{\text{vkEndCommandBuffer}} \text{Executable} \xrightarrow{\text{vkQueueSubmit}} \text{Pending}`],
      ["Draw command parameters", String.raw`\text{vkCmdDraw}(\text{cmd}, \text{vertexCount}, \text{instanceCount}, \text{firstVertex}, \text{firstInstance})`],
    ],
    exercises: [
      { q: "What does the VK_SUBPASS_CONTENTS_INLINE flag specify in vkCmdBeginRenderPass?", a: "It specifies that the render pass commands will be executed entirely from the primary command buffer itself, without secondary command buffers." },
      { q: "What happens if you call vkCmdDraw before binding a graphics pipeline?", a: "Vulkan validation layers will report a severe error because no pipeline state is active, and the GPU will crash or produce undefined behavior." },
      { q: "Does calling vkCmdDraw cause the GPU to render immediately?", a: "No. It only appends a draw instruction into the command buffer. Execution begins only after the buffer is submitted to a queue with vkQueueSubmit." },
    ],
    cpp: [{
      title: "Recording a Frame Command Buffer in C++",
      formula: String.raw`\text{RecordCommandBuffer}(\text{cmd}, \text{imageIndex})`,
      note: "<p>Encapsulates render pass begin, dynamic viewport, pipeline binding, and draw call.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>

void RecordCommandBuffer(VkCommandBuffer commandBuffer, VkRenderPass renderPass,
                         VkFramebuffer framebuffer, VkExtent2D extent,
                         VkPipeline graphicsPipeline)
{
    VkCommandBufferBeginInfo beginInfo{};
    beginInfo.sType = VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO;

    if (vkBeginCommandBuffer(commandBuffer, &beginInfo) != VK_SUCCESS) {
        throw std::runtime_error("Failed to begin recording command buffer!");
    }

    VkRenderPassBeginInfo renderPassInfo{};
    renderPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO;
    renderPassInfo.renderPass = renderPass;
    renderPassInfo.framebuffer = framebuffer;
    renderPassInfo.renderArea.offset = {0, 0};
    renderPassInfo.renderArea.extent = extent;

    VkClearValue clearColor = {{{0.05f, 0.05f, 0.08f, 1.0f}}};
    renderPassInfo.clearValueCount = 1;
    renderPassInfo.pClearValues = &clearColor;

    vkCmdBeginRenderPass(commandBuffer, &renderPassInfo, VK_SUBPASS_CONTENTS_INLINE);
    vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, graphicsPipeline);

    VkViewport viewport{};
    viewport.x = 0.0f;
    viewport.y = 0.0f;
    viewport.width = static_cast<float>(extent.width);
    viewport.height = static_cast<float>(extent.height);
    viewport.minDepth = 0.0f;
    viewport.maxDepth = 1.0f;
    vkCmdSetViewport(commandBuffer, 0, 1, &viewport);

    VkRect2D scissor{};
    scissor.offset = {0, 0};
    scissor.extent = extent;
    vkCmdSetScissor(commandBuffer, 0, 1, &scissor);

    // Draw 3 vertices for Hello Triangle
    vkCmdDraw(commandBuffer, 3, 1, 0, 0);

    vkCmdEndRenderPass(commandBuffer);

    if (vkEndCommandBuffer(commandBuffer) != VK_SUCCESS) {
        throw std::runtime_error("Failed to record command buffer!");
    }
}
`,
    }],
    csharp: [{
      title: "Recording Commands in C#",
      formula: String.raw`\text{vk.BeginCommandBuffer} \to \text{vk.CmdDraw} \to \text{vk.EndCommandBuffer}`,
      note: "<p>Silk.NET command buffer recording routine.</p>",
      code: String.raw`
using Silk.NET.Vulkan;

public static unsafe void RecordCommandBuffer(Vk vk, CommandBuffer cmd,
    RenderPass pass, Framebuffer fb, Extent2D extent, Pipeline pipeline)
{
    var beginInfo = new CommandBufferBeginInfo { SType = StructureType.CommandBufferBeginInfo };
    vk.BeginCommandBuffer(cmd, ref beginInfo);

    var clearValue = new ClearValue { Color = new ClearColorValue(0.05f, 0.05f, 0.08f, 1.0f) };
    var passInfo = new RenderPassBeginInfo
    {
        SType = StructureType.RenderPassBeginInfo,
        RenderPass = pass,
        Framebuffer = fb,
        RenderArea = new Rect2D { Offset = new Offset2D(0, 0), Extent = extent },
        ClearValueCount = 1,
        PClearValues = &clearValue,
    };

    vk.CmdBeginRenderPass(cmd, ref passInfo, SubpassContents.Inline);
    vk.CmdBindPipeline(cmd, PipelineBindPoint.Graphics, pipeline);

    var viewport = new Viewport(0, 0, extent.Width, extent.Height, 0.0f, 1.0f);
    vk.CmdSetViewport(cmd, 0, 1, ref viewport);

    var scissor = new Rect2D(new Offset2D(0, 0), extent);
    vk.CmdSetScissor(cmd, 0, 1, ref scissor);

    vk.CmdDraw(cmd, 3, 1, 0, 0);
    vk.CmdEndRenderPass(cmd);
    vk.EndCommandBuffer(cmd);
}
`,
    }],
    sims: [{ title: "Interactive command recording timeline", help: "<p>Step through recording instructions into a VkCommandBuffer. Watch the buffer state change from INITIAL to RECORDING and EXECUTABLE.</p>", mount: simCommandRecording }],
  });

  L3D.topic({
    id: "VK4.3",
    summary: "Vulkan coordinates CPU and GPU workloads using fences for host-device synchronization and semaphores for GPU-internal queue sequencing.",
    lesson: String.raw`
      <p><strong>Everything on the GPU executes asynchronously.</strong> When your CPU calls <code>vkQueueSubmit</code>, the function returns in microseconds—long before the GPU even starts drawing the first triangle. Without explicit synchronization, your CPU might write new vertex data over buffers the GPU is currently rendering, or present a half-cleared swapchain image to the monitor.</p>
      <div class="key"><p>Vulkan requires you to explicitly synchronize execution using two primary synchronization primitives: <strong>Fences</strong> (synchronizing the CPU with the GPU) and <strong>Semaphores</strong> (synchronizing GPU operations with each other).</p></div>

      <h2 data-sub="VK4.3.1">GPU-GPU sync with semaphores</h2>
      <p>A <code>VkSemaphore</code> is a GPU-side synchronization gate. The CPU creates a semaphore and passes it to Vulkan queue operations, but the CPU never blocks or waits on binary semaphores directly:</p>
      <ul>
        <li><strong>Signaling:</strong> A GPU operation signals the semaphore when it completes.</li>
        <li><strong>Waiting:</strong> A subsequent GPU operation waits for the semaphore to be signaled before executing designated pipeline stages.</li>
      </ul>
      <p>Standard rendering requires two binary semaphores per frame:</p>
      <ol>
        <li><code>imageAvailableSemaphore</code>: Signaled by <code>vkAcquireNextImageKHR</code> when the swapchain has given you an image ready for rendering.</li>
        <li><code>renderFinishedSemaphore</code>: Signaled by the graphics queue when drawing commands complete, ensuring presentation does not begin prematurely.</li>
      </ol>

      <h2 data-sub="VK4.3.2">CPU-GPU sync with fences</h2>
      <p>A <code>VkFence</code> is a Host-Device synchronization object. The CPU can explicitly pause its own execution until the GPU signals the fence:</p>
      <pre><code>// Block CPU until the GPU finishes previous frame's commands
vkWaitForFences(device, 1, &inFlightFence, VK_TRUE, UINT64_MAX);
// Must reset fence to unsignaled state before submitting new work!
vkResetFences(device, 1, &inFlightFence);</code></pre>
      <p>When creating a fence, initialize it with the <code>VK_FENCE_CREATE_SIGNALED_BIT</code> flag so the very first frame does not wait indefinitely on a fence that has never been submitted!</p>

      <h2 data-sub="VK4.3.3">Acquire, submit, and present flow</h2>
      <p>The core per-frame synchronization dance operates in three coordinated steps:</p>
      <ol>
        <li><strong>Acquire Next Image:</strong>
          <pre><code>vkAcquireNextImageKHR(device, swapChain, UINT64_MAX, imageAvailableSemaphore, VK_NULL_HANDLE, &imageIndex);</code></pre>
        </li>
        <li><strong>Submit Command Buffer:</strong>
          <pre><code>VkSubmitInfo submitInfo{};
submitInfo.waitSemaphoreCount = 1;
submitInfo.pWaitSemaphores = &imageAvailableSemaphore;
VkPipelineStageFlags waitStages[] = { VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT };
submitInfo.pWaitDstStageMask = waitStages;
submitInfo.commandBufferCount = 1;
submitInfo.pCommandBuffers = &commandBuffer;
submitInfo.signalSemaphoreCount = 1;
submitInfo.pSignalSemaphores = &renderFinishedSemaphore;
vkQueueSubmit(graphicsQueue, 1, &submitInfo, inFlightFence);</code></pre>
          <p>Notice that vertex shading can start immediately; only the color attachment output stage waits on <code>imageAvailableSemaphore</code>!</p>
        </li>
        <li><strong>Present Frame:</strong>
          <pre><code>VkPresentInfoKHR presentInfo{};
presentInfo.waitSemaphoreCount = 1;
presentInfo.pWaitSemaphores = &renderFinishedSemaphore;
presentInfo.swapchainCount = 1;
presentInfo.pSwapchains = &swapChain;
presentInfo.pImageIndices = &imageIndex;
vkQueuePresentKHR(presentQueue, &presentInfo);</code></pre>
        </li>
      </ol>
      <p><a class="btn goto-sim" href="#/VK4.3/sim">Try it: trace semaphores and fences across the render loop →</a></p>
    `,
    keyFormulas: [
      ["Fence synchronization (Host-Device)", String.raw`\text{vkWaitForFences}(\text{device}, 1, \&\text{fence}, \text{TRUE}, \infty) \to \text{vkResetFences}(\text{device}, 1, \&\text{fence})`],
      ["Semaphore synchronization (Device-Device)", String.raw`\text{Acquire} \xrightarrow{\text{signal}} \text{Sem}_{\text{avail}} \xrightarrow{\text{wait}} \text{Rasterize} \xrightarrow{\text{signal}} \text{Sem}_{\text{done}} \xrightarrow{\text{wait}} \text{Present}`],
    ],
    exercises: [
      { q: "What is the difference between a fence and a semaphore in Vulkan?", a: "A fence synchronizes the CPU with the GPU (CPU waits with vkWaitForFences), while a semaphore synchronizes operations between GPU queues without CPU intervention." },
      { q: "Why should a fence be created with VK_FENCE_CREATE_SIGNALED_BIT?", a: "Because the render loop waits on the fence before rendering, creating it in the signaled state prevents the very first frame from deadlocking." },
      { q: "Why do we wait on imageAvailableSemaphore specifically at VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT?", a: "This allows vertex processing to execute concurrently with image acquisition, delaying execution only when writing final colors to the image." },
    ],
    cpp: [{
      title: "Creating Semaphores & Fences in C++",
      formula: String.raw`\text{vkCreateSemaphore} + \text{vkCreateFence}`,
      note: "<p>Allocating sync objects with initial signaled fence state.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>

void CreateSyncObjects(VkDevice device,
                       VkSemaphore& imageAvailableSemaphore,
                       VkSemaphore& renderFinishedSemaphore,
                       VkFence& inFlightFence)
{
    VkSemaphoreCreateInfo semaphoreInfo{};
    semaphoreInfo.sType = VK_STRUCTURE_TYPE_SEMAPHORE_CREATE_INFO;

    VkFenceCreateInfo fenceInfo{};
    fenceInfo.sType = VK_STRUCTURE_TYPE_FENCE_CREATE_INFO;
    fenceInfo.flags = VK_FENCE_CREATE_SIGNALED_BIT; // Start signaled for frame 0!

    if (vkCreateSemaphore(device, &semaphoreInfo, nullptr, &imageAvailableSemaphore) != VK_SUCCESS ||
        vkCreateSemaphore(device, &semaphoreInfo, nullptr, &renderFinishedSemaphore) != VK_SUCCESS ||
        vkCreateFence(device, &fenceInfo, nullptr, &inFlightFence) != VK_SUCCESS)
    {
        throw std::runtime_error("Failed to create synchronization objects!");
    }
}
`,
    }],
    csharp: [{
      title: "Creating Sync Objects in C#",
      formula: String.raw`\text{vk.CreateSemaphore} + \text{vk.CreateFence}`,
      note: "<p>Silk.NET synchronization primitive setup.</p>",
      code: String.raw`
using Silk.NET.Vulkan;

public static unsafe void CreateSyncObjects(Vk vk, Device device,
    out Semaphore imgAvail, out Semaphore rndDone, out Fence inFlight)
{
    var semInfo = new SemaphoreCreateInfo { SType = StructureType.SemaphoreCreateInfo };
    var fenceInfo = new FenceCreateInfo
    {
        SType = StructureType.FenceCreateInfo,
        Flags = FenceCreateFlags.SignaledBit,
    };

    vk.CreateSemaphore(device, ref semInfo, null, out imgAvail);
    vk.CreateSemaphore(device, ref semInfo, null, out rndDone);
    vk.CreateFence(device, ref fenceInfo, null, out inFlight);
}
`,
    }],
    sims: [{ title: "Fences vs semaphores timeline sync", help: "<p>Step through a frame. Observe how fences unblock the CPU and semaphores coordinate GPU queue execution stages.</p>", mount: simSyncPrimitives }],
  });

  L3D.topic({
    id: "VK4.4",
    summary: "Frames in flight allow the CPU to record the next frame while the GPU renders the current frame, maximizing parallel throughput across host and device.",
    lesson: String.raw`
      <p><strong>If you use only one set of synchronization objects, your CPU and GPU spend half their time waiting.</strong> The CPU records a frame, submits it to the GPU, and immediately stalls on <code>vkWaitForFences</code> until the GPU finishes rendering. Only then does the CPU begin recording the next frame.</p>
      <div class="key"><p><strong>Frames in Flight (CPU–GPU Pipelining):</strong> By maintaining two or more sets of synchronization objects and command buffers (e.g. <code>MAX_FRAMES_IN_FLIGHT = 2</code>), the CPU can record Frame \(N+1\) while the GPU is executing Frame \(N\).</p></div>

      <h2 data-sub="VK4.4.1">Why frames in flight</h2>
      <p>Pipelining achieves near 100% hardware utilization. While the GPU's thousands of compute cores chew through geometry and fragment shading for the active frame, the CPU's high-clock cores process game physics, AI, and command recording for the upcoming frame.</p>
      <p>Increasing frames in flight beyond 2 or 3 is rarely done in games because each additional frame in flight adds 1 frame of input latency between user mouse input and screen photon delivery.</p>

      <h2 data-sub="VK4.4.2">Resource duplication per frame</h2>
      <p>To enable concurrent execution without race conditions, every resource touched by command recording must be duplicated per frame in flight:</p>
      <ul>
        <li><code>VkCommandBuffer commandBuffers[MAX_FRAMES_IN_FLIGHT]</code></li>
        <li><code>VkSemaphore imageAvailableSemaphores[MAX_FRAMES_IN_FLIGHT]</code></li>
        <li><code>VkSemaphore renderFinishedSemaphores[MAX_FRAMES_IN_FLIGHT]</code></li>
        <li><code>VkFence inFlightFences[MAX_FRAMES_IN_FLIGHT]</code></li>
        <li>Per-frame Uniform Buffers and Descriptor Sets (covered in Chapter 6).</li>
      </ul>

      <h2 data-sub="VK4.4.3">The complete render loop</h2>
      <p>In your main game loop, you track the active frame index using a ring counter:</p>
      <pre><code>uint32_t currentFrame = 0;
while (!glfwWindowShouldClose(window)) {
    glfwPollEvents();
    DrawFrame();
}
vkDeviceWaitIdle(device);</code></pre>
      <p>Inside <code>DrawFrame()</code>:</p>
      <ol>
        <li>Wait for the current frame's fence: <code>vkWaitForFences(device, 1, &inFlightFences[currentFrame], VK_TRUE, UINT64_MAX)</code>.</li>
        <li>Acquire next swapchain image index: <code>vkAcquireNextImageKHR(..., imageAvailableSemaphores[currentFrame], ..., &imageIndex)</code>.</li>
        <li>Reset the fence: <code>vkResetFences(device, 1, &inFlightFences[currentFrame])</code>.</li>
        <li>Reset and record the command buffer: <code>vkResetCommandBuffer(commandBuffers[currentFrame], 0)</code> and <code>RecordCommandBuffer(commandBuffers[currentFrame], imageIndex)</code>.</li>
        <li>Submit to graphics queue, passing <code>inFlightFences[currentFrame]</code>.</li>
        <li>Present image to present queue.</li>
        <li>Advance the ring buffer index: <code>currentFrame = (currentFrame + 1) % MAX_FRAMES_IN_FLIGHT</code>.</li>
      </ol>
      <p><a class="btn goto-sim" href="#/VK4.4/sim">Try it: simulate the frames-in-flight CPU–GPU pipeline →</a></p>
    `,
    keyFormulas: [
      ["Ring counter advancement", String.raw`\text{currentFrame} \leftarrow (\text{currentFrame} + 1) \pmod{\text{MAX\_FRAMES\_IN\_FLIGHT}}`],
      ["Pipelined overlap", String.raw`\text{Time } t: \quad \underbrace{\text{CPU records } [F_{N+1}]}_{\text{Thread 0}} \quad \parallel \quad \underbrace{\text{GPU renders } [F_N]}_{\text{VkQueue}}`],
    ],
    exercises: [
      { q: "Why should we not set MAX_FRAMES_IN_FLIGHT to a high number like 10?", a: "Each additional frame in flight increases input latency, making mouse and controller responses feel sluggish and unresponsive." },
      { q: "What is the distinction between currentFrame and imageIndex?", a: "currentFrame (0 or 1) selects the CPU resource slot for frames in flight, whereas imageIndex (0, 1, or 2) is the specific image acquired from the swapchain." },
      { q: "Why must vkResetFences be called after vkAcquireNextImageKHR?", a: "If vkAcquireNextImageKHR detects a window resize and triggers swapchain recreation, returning early before submission would leave the fence unsignaled, causing a deadlock on the next frame." },
    ],
    cpp: [{
      title: "Complete DrawFrame Function in C++",
      formula: String.raw`\text{DrawFrame}() \text{ with pipelined ring buffer}`,
      note: "<p>Manages fence waiting, command recording, queue submission, and presentation.</p>",
      code: String.raw`
#include <vulkan/vulkan.h>

const int MAX_FRAMES_IN_FLIGHT = 2;
uint32_t currentFrame = 0;

void DrawFrame(VkDevice device, VkSwapchainKHR swapChain, VkQueue graphicsQueue,
               VkQueue presentQueue, VkPipeline graphicsPipeline,
               VkRenderPass renderPass, const std::vector<VkFramebuffer>& framebuffers,
               VkExtent2D extent,
               const std::vector<VkCommandBuffer>& commandBuffers,
               const std::vector<VkSemaphore>& imageAvailableSemaphores,
               const std::vector<VkSemaphore>& renderFinishedSemaphores,
               const std::vector<VkFence>& inFlightFences)
{
    vkWaitForFences(device, 1, &inFlightFences[currentFrame], VK_TRUE, UINT64_MAX);

    uint32_t imageIndex;
    VkResult result = vkAcquireNextImageKHR(device, swapChain, UINT64_MAX,
                                           imageAvailableSemaphores[currentFrame],
                                           VK_NULL_HANDLE, &imageIndex);

    if (result == VK_ERROR_OUT_OF_DATE_KHR) {
        RecreateSwapChain();
        return;
    }

    vkResetFences(device, 1, &inFlightFences[currentFrame]);

    vkResetCommandBuffer(commandBuffers[currentFrame], 0);
    RecordCommandBuffer(commandBuffers[currentFrame], renderPass, framebuffers[imageIndex],
                        extent, graphicsPipeline);

    VkSubmitInfo submitInfo{};
    submitInfo.sType = VK_STRUCTURE_TYPE_SUBMIT_INFO;

    VkSemaphore waitSemaphores[] = { imageAvailableSemaphores[currentFrame] };
    VkPipelineStageFlags waitStages[] = { VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT };
    submitInfo.waitSemaphoreCount = 1;
    submitInfo.pWaitSemaphores = waitSemaphores;
    submitInfo.pWaitDstStageMask = waitStages;
    submitInfo.commandBufferCount = 1;
    submitInfo.pCommandBuffers = &commandBuffers[currentFrame];

    VkSemaphore signalSemaphores[] = { renderFinishedSemaphores[currentFrame] };
    submitInfo.signalSemaphoreCount = 1;
    submitInfo.pSignalSemaphores = signalSemaphores;

    if (vkQueueSubmit(graphicsQueue, 1, &submitInfo, inFlightFences[currentFrame]) != VK_SUCCESS) {
        throw std::runtime_error("Failed to submit draw command buffer!");
    }

    VkPresentInfoKHR presentInfo{};
    presentInfo.sType = VK_STRUCTURE_TYPE_PRESENT_INFO_KHR;
    presentInfo.waitSemaphoreCount = 1;
    presentInfo.pWaitSemaphores = signalSemaphores;
    presentInfo.swapchainCount = 1;
    presentInfo.pSwapchains = &swapChain;
    presentInfo.pImageIndices = &imageIndex;

    result = vkQueuePresentKHR(presentQueue, &presentInfo);
    if (result == VK_ERROR_OUT_OF_DATE_KHR || result == VK_SUBOPTIMAL_KHR) {
        RecreateSwapChain();
    }

    currentFrame = (currentFrame + 1) % MAX_FRAMES_IN_FLIGHT;
}
`,
    }],
    csharp: [{
      title: "DrawFrame Method in C#",
      formula: String.raw`\text{DrawFrame}() \text{ in Silk.NET}`,
      note: "<p>Vulkan frame loop with double-buffered frames in flight.</p>",
      code: String.raw`
using Silk.NET.Vulkan;

public static unsafe void DrawFrame(Vk vk, Device device, SwapchainKHR swapchain,
    Queue graphicsQueue, Queue presentQueue, CommandBuffer[] cmdBuffers,
    Semaphore[] imgAvailSems, Semaphore[] rndDoneSems, Fence[] fences,
    ref uint currentFrame, Action<uint> recordAction)
{
    vk.WaitForFences(device, 1, ref fences[currentFrame], true, ulong.MaxValue);

    uint imgIndex = 0;
    var result = vk.AcquireNextImage(device, swapchain, ulong.MaxValue,
                                     imgAvailSems[currentFrame], default, ref imgIndex);

    vk.ResetFences(device, 1, ref fences[currentFrame]);
    vk.ResetCommandBuffer(cmdBuffers[currentFrame], 0);

    recordAction(imgIndex);

    var waitSem = imgAvailSems[currentFrame];
    var waitStage = PipelineStageFlags.ColorAttachmentOutputBit;
    var signalSem = rndDoneSems[currentFrame];
    var cmd = cmdBuffers[currentFrame];

    var submitInfo = new SubmitInfo
    {
        SType = StructureType.SubmitInfo,
        WaitSemaphoreCount = 1,
        PWaitSemaphores = &waitSem,
        PWaitDstStageMask = &waitStage,
        CommandBufferCount = 1,
        PCommandBuffers = &cmd,
        SignalSemaphoreCount = 1,
        PSignalSemaphores = &signalSem,
    };

    vk.QueueSubmit(graphicsQueue, 1, ref submitInfo, fences[currentFrame]);

    var presentInfo = new PresentInfoKHR
    {
        SType = StructureType.PresentInfoKhr,
        WaitSemaphoreCount = 1,
        PWaitSemaphores = &signalSem,
        SwapchainCount = 1,
        PSwapchains = &swapchain,
        PImageIndices = &imgIndex,
    };

    vk.QueuePresent(presentQueue, ref presentInfo);
    currentFrame = (currentFrame + 1) % 2;
}
`,
    }],
    sims: [{ title: "Frames in flight CPU–GPU pipeline timeline", help: "<p>Watch CPU frame recording and GPU rendering run in parallel. Notice how 2 frames in flight eliminates idle GPU time.</p>", mount: simFramesInFlight }],
  });

  // ------------------------------------------------------------ Simulations
  function simCommandPool(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const poolType = sim.segmented(controls, { label: "Pool Reset Mode", options: [["individual", "Individual (RESET_CMD_BUF)"], ["bulk", "Bulk Pool Reset"]], value: "individual", onChange: () => v.redraw() });
    const numWorkers = sim.slider(controls, { label: "Worker Threads", min: 1, max: 4, step: 1, value: 2, onInput: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const isIndiv = poolType.value === "individual";
      const workers = numWorkers.value;

      // Command Pool Memory Block
      view.rect([-4.5, 1.2], [4.5, 3.2], { color: "c", fill: "c", fillAlpha: 0.15 });
      view.text([-4.2, 2.9], "VkCommandPool (Queue Family 0: Graphics)", { color: "c", size: 12, bold: true });
      view.text([-4.2, 2.3], isIndiv ? "Flags: VK_COMMAND_POOL_CREATE_RESET_COMMAND_BUFFER_BIT" : "Flags: 0 (Bulk vkResetCommandPool)", { color: "fg", size: 9 });

      // Primary Command Buffers inside Pool
      view.rect([-4.0, 1.4], [-0.5, 2.1], { color: "a", fill: "a", fillAlpha: 0.25 });
      view.text([-2.25, 1.75], "Primary Buffer 0 (Main Thread)", { align: "center", color: "fg", size: 9, bold: true });

      view.rect([0.0, 1.4], [4.0, 2.1], { color: "a", fill: "a", fillAlpha: 0.25 });
      view.text([2.0, 1.75], "Primary Buffer 1 (Frames in Flight)", { align: "center", color: "fg", size: 9, bold: true });

      // Worker Threads & Secondary Buffers
      view.rect([-4.5, -2.6], [4.5, 0.6], { color: "muted", fill: "panel", fillAlpha: 0.5 });
      view.text([-4.2, 0.2], `Multi-threaded Recording (${workers} Worker Threads):`, { color: "fg", size: 11, bold: true });

      for (let i = 0; i < workers; i++) {
        const y = -0.4 - i * 0.55;
        view.rect([-4.0, y - 0.2], [4.0, y + 0.2], { color: "b", fill: "b", fillAlpha: 0.2 });
        view.text([-3.8, y], `Thread ${i + 1}: Record Secondary Buffer #${i} (Mesh chunk ${i})`, { color: "fg", size: 9 });
        view.text([2.5, y], "vkCmdExecuteCommands", { color: "a", size: 9 });
      }

      out.set(sim.rows([
        ["Pool Flags", isIndiv ? "RESET_COMMAND_BUFFER_BIT (Granular)" : "Default (Bulk reset)"],
        ["Primary Buffers", "2 (Frames in flight)"],
        ["Secondary Buffers", `${workers} (Parallel worker thread recording)`],
        ["Memory Policy", isIndiv ? "Recycle per-buffer without destroying pool" : "Reset entire pool block simultaneously"],
      ]));
    });
  }

  function simCommandRecording(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const step = sim.slider(controls, { label: "Recording Step", min: 0, max: 5, step: 1, value: 3, onInput: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const s = step.value;

      const steps = [
        { name: "Initial State", call: "vkAllocateCommandBuffers", state: "INITIAL", color: "muted" },
        { name: "Begin Recording", call: "vkBeginCommandBuffer()", state: "RECORDING", color: "a" },
        { name: "Begin Render Pass", call: "vkCmdBeginRenderPass(..., INLINE)", state: "INSIDE_RENDER_PASS", color: "c" },
        { name: "Bind Pipeline & States", call: "vkCmdBindPipeline + vkCmdSetViewport", state: "PIPELINE_BOUND", color: "b" },
        { name: "Draw Triangles", call: "vkCmdDraw(vertexCount=3, instanceCount=1)", state: "DRAW_RECORDED", color: "g" },
        { name: "End Recording", call: "vkCmdEndRenderPass + vkEndCommandBuffer", state: "EXECUTABLE", color: "g" },
      ];

      const cur = steps[s];

      // Command Buffer State Box
      view.rect([-4.5, 1.4], [4.5, 3.2], { color: cur.color, fill: cur.color, fillAlpha: 0.2 });
      view.text([0, 2.7], `VkCommandBuffer State: ${cur.state}`, { align: "center", color: cur.color, size: 14, bold: true });
      view.text([0, 2.0], `Current Call: ${cur.call}`, { align: "center", color: "fg", size: 11 });

      // Recorded Stream List
      view.rect([-4.5, -2.6], [4.5, 0.8], { color: "muted", fill: "panel", fillAlpha: 0.5 });
      view.text([-4.2, 0.4], "Recorded Command Packet Stream:", { color: "fg", size: 11, bold: true });

      for (let i = 1; i <= s; i++) {
        const y = 0.0 - (i - 1) * 0.45;
        view.rect([-4.0, y - 0.18], [4.0, y + 0.18], { color: "a", fill: "a", fillAlpha: 0.15 });
        view.text([-3.8, y], `[Packet ${i}] ${steps[i].call}`, { color: "fg", size: 10 });
      }

      out.set(sim.rows([
        ["Step Index", `${s} / 5`],
        ["Operation", cur.name],
        ["Buffer Lifecycle State", cur.state],
        ["Ready for vkQueueSubmit?", s === 5 ? "YES (Executable)" : "NO (Must call vkEndCommandBuffer)"],
      ]));
    });
  }

  function simSyncPrimitives(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const phase = sim.slider(controls, { label: "Frame Phase", min: 0, max: 4, step: 1, value: 2, onInput: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const p = phase.value;

      const phases = [
        { label: "1. CPU Waits on Fence", desc: "vkWaitForFences unblocks when previous frame is done", fence: "SIGNALED -> RESET", sem1: "UNSIGNALED", sem2: "UNSIGNALED" },
        { label: "2. Acquire Next Image", desc: "vkAcquireNextImageKHR signals imageAvailableSemaphore", fence: "UNSIGNALED", sem1: "SIGNALED", sem2: "UNSIGNALED" },
        { label: "3. Queue Submit", desc: "GPU waits on imageAvailable at COLOR_ATTACHMENT_OUTPUT", fence: "PENDING (GPU)", sem1: "CONSUMED", sem2: "UNSIGNALED" },
        { label: "4. GPU Execution Done", desc: "Queue signals renderFinishedSemaphore and inFlightFence", fence: "SIGNALED", sem1: "IDLE", sem2: "SIGNALED" },
        { label: "5. Queue Present", desc: "vkQueuePresentKHR waits on renderFinishedSemaphore and presents", fence: "SIGNALED", sem1: "IDLE", sem2: "CONSUMED" },
      ];

      const cur = phases[p];

      // Host CPU Line
      view.rect([-4.5, 1.4], [4.5, 3.2], { color: "a", fill: "a", fillAlpha: 0.15 });
      view.text([-4.2, 2.8], "Host (CPU Application Thread)", { color: "a", size: 12, bold: true });
      view.text([-4.2, 2.0], `Fence State: ${cur.fence}`, { color: "fg", size: 11 });

      // Device GPU Line
      view.rect([-4.5, -2.6], [4.5, -0.6], { color: "g", fill: "g", fillAlpha: 0.15 });
      view.text([-4.2, -1.0], "Device (GPU Execution Queues)", { color: "g", size: 12, bold: true });
      view.text([-4.2, -1.8], `imageAvailableSemaphore: ${cur.sem1} | renderFinishedSemaphore: ${cur.sem2}`, { color: "fg", size: 10 });

      // Action Description Box
      view.rect([-4.5, -0.4], [4.5, 1.0], { color: "c", fill: "c", fillAlpha: 0.2 });
      view.text([0, 0.5], cur.label, { align: "center", color: "c", size: 12, bold: true });
      view.text([0, 0.0], cur.desc, { align: "center", color: "fg", size: 10 });

      out.set(sim.rows([
        ["Frame Phase", cur.label],
        ["inFlightFence", cur.fence],
        ["imageAvailableSemaphore", cur.sem1],
        ["renderFinishedSemaphore", cur.sem2],
        ["Sync Type", p === 0 ? "Host-Device (CPU blocks on Fence)" : (p === 3 ? "Device signals Fence to Host" : "Device-Device (GPU Queue Semaphores)")],
      ]));
    });
  }

  function simFramesInFlight(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const framesInFlight = sim.segmented(controls, { label: "Pipelining Mode", options: [["1", "1 Frame in Flight (Serial)"], ["2", "2 Frames in Flight (Pipelined)"]], value: "2", onChange: () => v.redraw() });
    const out = sim.readout(readout);

    v.onDraw((view) => {
      view.grid({ step: 1 }); view.axes({ ticks: true });
      const isPipelined = framesInFlight.value === "2";

      // CPU Recording Track
      view.rect([-4.5, 1.2], [4.5, 3.2], { color: "a", fill: "a", fillAlpha: 0.15 });
      view.text([-4.2, 2.8], "CPU Recording Track", { color: "a", size: 12, bold: true });

      // GPU Execution Track
      view.rect([-4.5, -2.4], [4.5, -0.4], { color: "g", fill: "g", fillAlpha: 0.15 });
      view.text([-4.2, -0.8], "GPU Rendering Track", { color: "g", size: 12, bold: true });

      if (isPipelined) {
        // Overlapped Execution
        // Frame 0 CPU
        view.rect([-4.0, 1.5], [-2.0, 2.4], { color: "a", fill: "a", fillAlpha: 0.4 });
        view.text([-3.0, 1.95], "CPU F0", { align: "center", color: "fg", size: 10, bold: true });

        // Frame 0 GPU
        view.rect([-2.0, -2.1], [0.0, -1.2], { color: "g", fill: "g", fillAlpha: 0.4 });
        view.text([-1.0, -1.65], "GPU F0", { align: "center", color: "fg", size: 10, bold: true });

        // Frame 1 CPU (Concurrent with GPU F0!)
        view.rect([-2.0, 1.5], [0.0, 2.4], { color: "b", fill: "b", fillAlpha: 0.4 });
        view.text([-1.0, 1.95], "CPU F1 (Overlap)", { align: "center", color: "fg", size: 10, bold: true });

        // Frame 1 GPU
        view.rect([0.0, -2.1], [2.0, -1.2], { color: "c", fill: "c", fillAlpha: 0.4 });
        view.text([1.0, -1.65], "GPU F1", { align: "center", color: "fg", size: 10, bold: true });

        // Frame 2 CPU
        view.rect([0.0, 1.5], [2.0, 2.4], { color: "a", fill: "a", fillAlpha: 0.4 });
        view.text([1.0, 1.95], "CPU F2", { align: "center", color: "fg", size: 10, bold: true });

        // Frame 2 GPU
        view.rect([2.0, -2.1], [4.0, -1.2], { color: "g", fill: "g", fillAlpha: 0.4 });
        view.text([3.0, -1.65], "GPU F2", { align: "center", color: "fg", size: 10, bold: true });

        view.text([0, 0.4], "CONTINUOUS GPU UTILIZATION: NO IDLE BUBBLES", { align: "center", color: "g", size: 11, bold: true });
      } else {
        // Serial Execution (Idle Bubbles)
        view.rect([-4.0, 1.5], [-2.0, 2.4], { color: "a", fill: "a", fillAlpha: 0.4 });
        view.text([-3.0, 1.95], "CPU F0", { align: "center", color: "fg", size: 10 });

        view.rect([-2.0, -2.1], [0.0, -1.2], { color: "g", fill: "g", fillAlpha: 0.4 });
        view.text([-1.0, -1.65], "GPU F0", { align: "center", color: "fg", size: 10 });

        // CPU Stalls during GPU F0
        view.rect([-2.0, 1.5], [0.0, 2.4], { color: "err", fill: "err", fillAlpha: 0.15 });
        view.text([-1.0, 1.95], "[CPU Stalled]", { align: "center", color: "err", size: 9 });

        view.rect([0.0, 1.5], [2.0, 2.4], { color: "a", fill: "a", fillAlpha: 0.4 });
        view.text([1.0, 1.95], "CPU F1", { align: "center", color: "fg", size: 10 });

        // GPU Stalls during CPU F1
        view.rect([0.0, -2.1], [2.0, -1.2], { color: "err", fill: "err", fillAlpha: 0.15 });
        view.text([1.0, -1.65], "[GPU Idle]", { align: "center", color: "err", size: 9 });

        view.text([0, 0.4], "SERIALIZED BOTTLENECK: 50% HARDWARE IDLE TIME", { align: "center", color: "err", size: 11, bold: true });
      }

      out.set(sim.rows([
        ["Pipelining Architecture", isPipelined ? "2 Frames in Flight (Dual-buffered)" : "1 Frame in Flight (Lockstep)"],
        ["CPU Utilization", isPipelined ? "95% (Continuous recording)" : "50% (Stalls on vkWaitForFences)"],
        ["GPU Utilization", isPipelined ? "98% (Continuous execution)" : "50% (Idle while CPU records)"],
        ["Throughput", isPipelined ? "Double the frame rate" : "Halved (CPU and GPU take turns)"],
      ]));
    });
  }
})();
