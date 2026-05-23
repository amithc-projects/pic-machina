# Zumilabs Studio — Full Architecture Diagram

```mermaid
flowchart TB
    classDef source fill:#1e3a5f,stroke:#3b82f6,color:#e2e8f0
    classDef uxf fill:#1e3a2f,stroke:#22c55e,color:#e2e8f0
    classDef pm fill:#3a1e2f,stroke:#a855f7,color:#e2e8f0
    classDef ai fill:#3a2a1e,stroke:#f59e0b,color:#e2e8f0
    classDef cloud fill:#2a1e3a,stroke:#8b5cf6,color:#e2e8f0
    classDef disk fill:#1e2a3a,stroke:#64748b,color:#e2e8f0
    classDef out fill:#1e3a2a,stroke:#10b981,color:#e2e8f0

    %% ═══════════════════════════════════════════════════
    %% DATA SOURCES
    %% ═══════════════════════════════════════════════════
    subgraph SOURCES["📂  Data Sources"]
        direction TB
        LocalFolder[(Local Folder\nFile System Access API)]:::source
        CSVFile[CSV / Excel\nSpreadsheet]:::source
        ManualData[Manual Entry\nin Data Sheet]:::source
    end

    %% ═══════════════════════════════════════════════════
    %% DISK — shared between both apps
    %% ═══════════════════════════════════════════════════
    subgraph DISK["💾  On-Disk File Store  (shared)"]
        direction LR
        MainFiles[Image / Video files\n.jpg .png .mp4 …]:::disk
        SidecarFiles[".{name}.json\nSidecar metadata files\nasset · annotation · custom"]:::disk
        ThumbnailFiles[".{name}.thumbnail.jpg\nPersisted video thumbnails"]:::disk
    end

    %% ═══════════════════════════════════════════════════
    %% UX-FILE-MANAGER
    %% ═══════════════════════════════════════════════════
    subgraph UXF["🗂  ux-file-manager  (Sidekick Web Component)"]
        direction TB

        subgraph UXF_BROWSE["Browsing"]
            GridView[Grid View]:::uxf
            ListMode[List View]:::uxf
            FilmstripMode[Filmstrip View]:::uxf
        end

        subgraph UXF_DATA["Sidecar Authoring  ← NEW"]
            DataSheet[Data Sheet View\nspreadsheet — edit asset.* fields]:::uxf
            CSVImport[CSV Import Wizard\nmap columns → sidecar fields]:::uxf
            CSVExport[CSV Export\ndownload all sidecar data]:::uxf
        end

        subgraph UXF_INSPECT["Inspection"]
            Inspector[Inspector Panel\nread-only metadata view]:::uxf
            Collections[Collections\nvirtual selection sets]:::uxf
        end

        STC_UXF[Send to Cloud\nupload selected files]:::uxf
        Scanner[ScannerService\ndirectory scan · sidecar detect]:::uxf
        SidecarWriter[SidecarService\nwriteAsset — merge & persist]:::uxf
    end

    %% ═══════════════════════════════════════════════════
    %% ZUMILABS-STUDIO
    %% ═══════════════════════════════════════════════════
    subgraph PM["🎨  zumilabs-studio"]
        direction TB

        subgraph PM_NED["Node Editor  (NED)"]
            direction LR
            NodeGraph[Recipe Node Graph\nsequential transforms]:::pm
            DragOverlays[Drag Overlays\ncircle · rect · crop · clipping mask]:::pm
            DrawMask[Draw Mask UI\nfreehand brush → alpha mask]:::pm
            CurvesUI[Curves Editor\nper-channel RGB tone curve]:::pm
            LevelsUI[Levels Editor\nblack · gamma · white · output]:::pm
            HSL_UI[HSL / Colour Mixer\n8 colour range sliders]:::pm
        end

        subgraph PM_ENGINE["Recipe Engine"]
            VarInject["Variable Injection\n{{sidecar.asset.title}}\n{{sidecar.asset.price}}\n{{recipe.variable}}"]:::pm

            subgraph PM_TRANSFORMS["Transform Library"]
                direction TB
                GEO[Geometry\ncrop · resize · rotate · flip\nperspective · canvas]:::pm
                COLOR[Colour & Tone\ntuning · auto-levels · curves\nlevels · HSL · LUT · film grain\nchromatic aberration · vignette]:::pm
                OVERLAY[Overlays\nrich text · image overlay\ndraw mask · frame device]:::pm
                FLOW[Flow Control\nsave state · load state\n+ blend modes for layer stacking]:::pm
                META[Metadata\nsidecar read · EXIF\nvision metadata write-back]:::pm
                AUD[Audio\nspeed · pitch · trim]:::pm
                VID[Video\nspeed · trim · concat]:::pm
            end
        end

        subgraph PM_AI["🤖  Local AI  (runs in-browser, no server)"]
            RemoveBG[Remove Background\nMediaPipe / ONNX]:::ai
            ClipMask[Clipping Mask\nshape + x/y/scale\ncircle · rect · diamond]:::ai
            VisionMeta[Vision Metadata\nsubject detection\nface / person bounding box]:::ai
            MagicErase[Magic Erase\ninpainting]:::ai
            PhotonWASM[Photon WASM\ncontrast · saturation · vibrance\nbright filters · duotone]:::ai
        end

        subgraph PM_BATCH["Builder  (BLD) — Batch Runner"]
            BatchRun[Batch pipeline\nprocess whole folder]:::pm
            SidecarRead[Read sidecar per file\ninject into recipe vars]:::pm
            OutputWrite[Write output files\nto /output subfolder]:::pm
        end

        subgraph PM_TL["Timeline  (TME) — Video"]
            Timeline[Multi-track timeline\nvideo · audio · text]:::pm
            SpeechStudio[Speech Studio\nTTS · audio sync]:::pm
        end
    end

    %% ═══════════════════════════════════════════════════
    %% CLOUD
    %% ═══════════════════════════════════════════════════
    subgraph CLOUD["☁️  Cloud  (user-configured endpoint)"]
        CloudEndpoint[Send-to-Cloud\ncustom webhook URL]:::cloud
        CloudAI[Cloud AI Services\nmagic erase · upscale\ngenerative fill · background swap]:::cloud
        CloudStore[Cloud Storage\nresults returned to pipeline]:::cloud
    end

    %% ═══════════════════════════════════════════════════
    %% SPEECH SYNTHESIS
    %% ═══════════════════════════════════════════════════
    subgraph VOICE["🗣️  Speech Synthesizers"]
        direction TB
        LocalGateway[Local TTS Gateway\nFastAPI - VibeVoice 0.5B]:::ai
        ElevenLabsAPI[ElevenLabs API\nCloud voice synthesis]:::cloud
        KokoroWASM[Kokoro TTS\nLocal browser WASM]:::ai
    end

    %% ═══════════════════════════════════════════════════
    %% OUTPUTS
    %% ═══════════════════════════════════════════════════
    subgraph OUT["📤  Outputs"]
        PersonalisedExports[Personalised batch exports\ne.g. 200 athlete portraits\neach with name · number · position]:::out
        UpdatedSidecars[Updated sidecar files\nvision metadata written back to disk]:::out
        TimelineExport[Video / slideshow export\nMP4 · GIF · sequence]:::out
        RecipeBundle[Recipe JSON bundle\nshare / import recipes]:::out
    end

    %% ═══════════════════════════════════════════════════
    %% EDGES — Data flows
    %% ═══════════════════════════════════════════════════

    %% Sources → disk
    LocalFolder -->|File System API| MainFiles
    LocalFolder -->|File System API| SidecarFiles

    %% Sources → UXF authoring
    CSVFile --> CSVImport
    ManualData --> DataSheet

    %% UXF browse ← disk
    Scanner -->|reads| MainFiles
    Scanner -->|reads| SidecarFiles
    Scanner -->|reads| ThumbnailFiles
    GridView & ListMode & FilmstripMode --> Scanner

    %% UXF authoring → sidecar writer → disk
    DataSheet --> SidecarWriter
    CSVImport --> SidecarWriter
    SidecarWriter -->|writes .{name}.json| SidecarFiles

    %% UXF → cloud
    STC_UXF --> CloudEndpoint

    %% Disk → zumilabs-studio batch
    MainFiles -->|input files| BatchRun
    SidecarFiles -->|sidecar per file| SidecarRead
    SidecarRead --> VarInject
    VarInject --> OVERLAY

    %% NED → transforms
    NodeGraph --> GEO & COLOR & OVERLAY & FLOW & META & AUD & VID
    DragOverlays & DrawMask & CurvesUI & LevelsUI & HSL_UI --> NodeGraph

    %% Transforms ↔ local AI
    OVERLAY & COLOR --> PhotonWASM
    RemoveBG & ClipMask & VisionMeta & MagicErase --> PM_TRANSFORMS

    %% Flow control (layer stacking)
    FLOW <-->|save/restore canvas state| PM_TRANSFORMS

    %% Batch
    PM_ENGINE --> BatchRun
    BatchRun --> OutputWrite
    OutputWrite -->|processed images| PersonalisedExports
    VisionMeta -->|writes back| UpdatedSidecars

    %% Cloud mid-pipeline
    BatchRun -->|send image| CloudEndpoint
    CloudEndpoint --> CloudAI --> CloudStore -->|result image| BatchRun

    %% Timeline
    Timeline & SpeechStudio --> TimelineExport

    %% Speech Studio integrations
    SpeechStudio -->|sends script text| LocalGateway & ElevenLabsAPI & KokoroWASM
    LocalGateway & ElevenLabsAPI & KokoroWASM -->|returns audio| SpeechStudio
    
    %% Recipe sharing
    NodeGraph --> RecipeBundle
    RecipeBundle --> NodeGraph
```

---

## Key Integration Paths

| Flow | Enables |
|---|---|
| CSV → Data Sheet → Sidecar → `{{sidecar.asset.*}}` | 200 personalised exports, zero manual edits |
| Remove BG → Save State → Rich Text → Load State | Text-between-layers effect |
| Save State → Effects → Draw Mask → Load State (destination-over) | Selective adjustment (blur only background) |
| BatchRun → Send-to-Cloud → CloudAI → result back | Cloud AI mid-pipeline (upscale, generative fill) |
| Vision Metadata → Sidecar → written back to disk | Auto-tag subjects for later filtering |
| Curves + Levels + HSL → Photon WASM | Full professional colour grading, local, no server |
| SpeechStudio → LocalGateway & Kokoro WASM → Timeline | Voiceover generation and subtitle audio synchronization |
