# Zumilabs Studio — System Capability Map

```mermaid
mindmap
  root((Zumilabs Studio\nEcosystem))
    File Management
      Browse local folders
        Grid view
        List view
        Filmstrip view
      Data Sheet view
        Bulk sidecar editing
        CSV import with column mapping
        CSV export
      Inspector panel
        Read-only metadata
        EXIF display
      Collections
        Virtual selection sets
      Send to Cloud
        Configurable webhook
    Sidecar System
      Per-image metadata
        asset.title / price / name
        annotation fields
        custom fields
      Written as .{name}.json
      Read as recipe variables
        {{sidecar.asset.*}}
      Written back by AI
        Vision metadata
    Recipe Engine
      Node graph
        Sequential transforms
        Save / Load state
        Blend modes for layer stacking
      Variable injection
        Sidecar variables
        Recipe parameters
      Non-destructive preview
        Final Result in NED
        Mid-pipeline node preview
      Recipe bundles
        Import / Export JSON
        Share templates
    Transforms
      Geometry
        Crop interactive overlay
        Resize with anchors
        Rotate / Flip
        Perspective warp
        Canvas extend
      Colour & Tone
        Standard tuning
        Auto levels
        Curves - RGB per channel
        Levels - black/gamma/white
        HSL Colour Mixer - 8 ranges
        Photon WASM filters
          Contrast / Saturation
          Vibrance
          Film grain
          Duotone
          Chromatic aberration
          Vignette
          LUT
      Overlays
        Rich Text
          9-point anchor mode
          Free drag box mode
          Font / weight / shadow / bgbox
        Image overlay
        Frame / Device mockup
        Draw Mask - freehand alpha
      AI Transforms
        Remove Background
        Clipping Mask
          Circle / Rect / Diamond
          Draggable centre + scale
        Magic Erase - inpainting
        Vision Metadata
      Flow Control
        Save State - snapshot canvas
        Load State - restore + blend
          Replace
          Destination-over
          Source-over
          Multiply / Screen / Overlay
      Media
        Audio speed / pitch / trim
        Video speed / trim / concat
      Metadata
        Read sidecar
        Write sidecar
        EXIF extraction
    Node Editor - NED
      Interactive drag overlays
        Circle centre + radius
        Clipping mask centre + scale
        Rich Text bounding box
        Crop rectangle
      Draw Mask UI
        Freehand brush
        Erase mode
        Feather + Invert
        Stores as base64 PNG
      Curves editor
        Drag control points
        Per channel R G B All
        Reset per channel
      Levels editor
        Histogram preview
        Input black / gamma / white
        Output shadow / highlight
      HSL editor
        8 colour range tabs
        H S L sliders per range
      Param binding
        Recipe variable injection
        {{vars}} autocomplete
    Batch Processing
      Folder-wide batch run
      Per-image sidecar injection
      Output to /output subfolder
      Personalised exports at scale
        Sports photo days
        E-commerce product shots
        Event photography
        Real estate listings
    Timeline - TME
      Multi-track video editing
      Audio tracks
      Text / overlay tracks
      Speech Studio
        Text-to-speech
          Kokoro WASM Engine
          Local TTS Gateway
          ElevenLabs API
        Audio sync
      Export
        MP4
        GIF
        Frame sequence
    AI - Local - No Server
      MediaPipe - remove BG
      ONNX - subject detection
      Photon WASM - colour ops
      Magic erase - inpainting
      Runs entirely in browser
    AI - Cloud - User Configured
      Send-to-Cloud webhook
      Mid-pipeline cloud calls
      Results returned to recipe
      Use cases
        Generative fill
        AI upscale
        Background swap
        Style transfer
    Unique Differentiators
      Sidecar personalisation at scale
        Data layer plus recipe engine
        No Canva equivalent
      Text between layers
        BG plus text plus FG subject
        Fully local no plugins
      Selective adjustments via Draw Mask
        Paint where effect applies
        No layer panel needed
      Batch plus cloud AI mid-pipeline
        Cloud AI on 200 images
        One click
      Fully local - no subscription
        All AI runs in browser
        Privacy preserving
```
