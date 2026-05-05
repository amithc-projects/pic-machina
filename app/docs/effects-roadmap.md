# Pic-Machina Effects & Filters Roadmap

## Phase 1: Quick Wins & Foundational Additions (Low Complexity)
*Status: Complete*

These features are highly feasible as they can be implemented using standard WebGL fragment shaders or simple Canvas 2D math. They require minimal changes to the core engine architecture.

**1. Gradient Ramp & Shape Generators (Circle, Checkerboard)**
- **Complexity:** Very Low
- **Feasibility:** High. Implemented as new WebGL fragment shaders inside `color.js` or `geometry.js` that output procedural pixels based on UV coordinates.
- **Why here:** Immediate ROI for users needing basic design assets and backgrounds without external files.

**2. Directional Blur & Radial Blur**
- **Complexity:** Low
- **Feasibility:** High. Directional/Radial blurs are just variations of the convolution matrix math applied across specific vectors or angles in WebGL.
- **Why here:** Highly requested for conveying motion and speed in video/image edits.

**3. Basic Distortion (Magnify, CC Lens)**
- **Complexity:** Low to Moderate
- **Feasibility:** High. These are purely spatial displacement shaders. We map the UV coordinates to a spherical or magnifying algorithm before sampling the texture.
- **Why here:** Adds "punch" to UI mockups and stylistic edits with very little engine overhead.

---

## Phase 2: Moderate Distortions & Behaviors (Medium Complexity)
*Status: In Progress*

These require more complex math (like noise functions) or minor updates to how the timeline handles parameter changes over time.

**4. Turbulent Displace**
- **Complexity:** Moderate
- **Feasibility:** High. Implemented via custom Simplex Noise displacement mapping.
- **Status:** ✅ Implemented in `geometry.js`.

**5. Programmatic Property "Behaviors" (e.g., Wiggle, Auto-Fade)**
- **Complexity:** Moderate
- **Feasibility:** Medium. Instead of a full JavaScript expression engine, we could add "Behavior Modifiers" directly into the Node Editor UI (e.g., attaching a "Wiggle" or "Sine Wave" modifier to an opacity or position property).
- **Status:** ⏳ Planned

**6. Advanced Distortions (Mesh Warp, Basic Liquify)**
- **Complexity:** Moderate to High
- **Feasibility:** Medium. Liquify (Pinch/Bloat/Swirl) is implemented. Mesh Warp requires passing a displacement grid or a set of control points to the shader.
- **Status:** ✅ Liquify Implemented in `geometry.js`. Mesh Warp planned.

---

## Phase 3: Advanced Architectures (High Complexity)
*Status: Planned*

These are major structural additions that require significant R&D, new engine subsystems, or heavy computational overhead.

**7. Full JavaScript Expressions Engine (After Effects style)**
- **Complexity:** High
- **Feasibility:** Medium. Implementing `wiggle(freq, amp)` or `valueAtTime(t)` means writing a safe JavaScript sandbox that evaluates strings per-property, per-frame. This could introduce severe performance bottlenecks in our render pipeline if not heavily optimized or compiled to WebAssembly.
- **Why here:** While incredibly powerful for power-users, the architectural shift is massive and could compromise our current high-speed rendering performance.

**8. Advanced Particle Systems (CC Particle World, Foam)**
- **Complexity:** Very High
- **Feasibility:** Low to Medium. True 2D/3D particle systems require maintaining state for thousands of individual particles (velocity, gravity, lifespan, collision) across frames. This means transitioning from simple stateless shaders to a stateful WebGL Compute Shader architecture or heavy CPU-side arrays.
- **Why here:** True emitters are entirely different beasts. The development cost is very high compared to the frequency of use in standard workflows.
