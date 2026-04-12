# Pic-Machina Workflow & Capabilities Roadmap

This document outlines the planned automated workflow for assessing, ranking, and tagging photos entirely locally, prioritizing user privacy and taking advantage of on-device ML/AI technologies.

## 📌 Phase 1: Fast Heuristics & Triage
Our first pass filters out fundamentally unusable images and organizes the library into groups to save heavy processing time later.

*   **Blur Detection (Sharpness check):**
    *   **Tech:** OpenCV.js (Variance of the Laplacian)
    *   **Goal:** Quickly calculate the edge variance of a grayscale image. If it falls below a threshold, flag it as blurry/out-of-focus and reject or lower its rank.
*   **Burst & Duplicate Detection (Auto-stacking):**
    *   **Tech:** Perceptual Hashing (pHash) or lightweight MobileNet embeddings via WebGPU (`transformers.js`).
    *   **Goal:** Identify photos that look extremely similar to group them together. This ensures we only run heavy analysis (like composition or face recognition) on the single best shot from a burst.

## 📌 Phase 2: Subject & Face Analysis
Once we have sharp, unique photos, we analyze the subjects to ensure optimal timing and expressions.

*   **Blink Detection (Eyes Open/Closed):**
    *   **Tech:** Google MediaPipe (Face Landmarks).
    *   **Goal:** Track the eyelids to calculate the Eye Aspect Ratio (EAR). Within a stack of similar images, prefer the ones where all subjects have their eyes open.
*   **Face Recognition & Auto-Tagging (New Enhancement):**
    *   **Tech:** `face-api.js` or MediaPipe Face Recognition (Extracting 128D/512D face descriptors).
    *   **Goal:** Once a user manually tags a person once, we save the "face descriptor network" (a small vector representing the face) into local `IndexedDB`. For all subsequent photos, we compare detected faces against the local database using Euclidean distance to automatically tag known family members or friends.

## 📌 Phase 3: Semantic & Composition AI
The final stage applies "human-like" judgement to the best remaining photos to curate top-tier selections.

*   **Composition & Aesthetic Scoring:**
    *   **Tech:** Local Vision-Language Models (VLM) running via a local endpoint (e.g., Ollama running LLaVA, Moondream, or Gemma Vision).
    *   **Goal:** Send the finalized images to the local VLM to be scored (1-10) based on composition, lighting, and framing. 
*   **Rejecting Contextual Misses:**
    *   **Tech:** Local VLM.
    *   **Goal:** Prompt the VLM to flag photos that are technical misses despite being sharp—such as accidental shots of the floor, documents, or severe over/under-exposure.

## ⚙️ Proposed Architecture Flow
1. Load Directory -> **(Fast Pass)** -> Discard Blurry
2. Remaining -> **(Auto-Stacking)** -> Group Bursts
3. Burst Leaders -> **(Face Pass)** -> Ensure Eyes Open & Auto-Tag Names
4. Curated Pool -> **(VLM Pass)** -> Score Composition
5. **Output Display:** Top $N$ Photos Ranked Highest.
