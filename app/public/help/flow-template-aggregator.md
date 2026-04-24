---
tags: [flow-control-export]
---
# Template Render

Maps batch images sequentially into defined template placeholder slots using OpenCV-detected bounds. If placeholders < images, it chunk-processes them into multiple numbered template composites. `isolateSubject=true` runs InSPyReNet on each slot's image (after fitMode scaling) and composites only the subject into the perspective cell — template background stays visible around the cut-out (requires #mdl; one inference per slot).

