export class TimelineView {
    constructor(container, options = {}) {
        this.container = container;
        this.options = Object.assign({
            pixelsPerSecond: 50,
            trackHeaderWidth: 140,
            onPlayheadMove: () => {},
            onClipSelect: () => {},
            onTrackSelect: () => {},
            onClipDrag: () => {},
            onAddTrack: () => {},
            onSplitClip: () => {},
            onDeleteSelected: () => {},
            onZoom: (val) => {},
            onRenderClip: (clip, element) => {},
            onClipContextMenu: (clip, event) => {},
            onClipDrag: (clipId, newTimeSec) => {},
            onClipDrop: (clipId) => {},
            onRenderTrackHeader: (track, element) => {},
            onTrackDrop: (track, offsetX, event) => {}
        }, options);

        this.pixelsPerSecond = this.options.pixelsPerSecond;
        this.tracks = [];
        this.selectedClips = new Set();
        this.selectedTracks = new Set();
        this.playheadTime = 0;
        
        this.initDOM();
    }

    initDOM() {
        this.container.innerHTML = `
            <div class="timeline-view-wrapper" style="display: flex; flex-direction: column; width: 100%; height: 100%; overflow: hidden; background: var(--ps-bg-surface, #1e1e1e);">
                <!-- Toolbar -->
                <div class="timeline-toolbar" style="display: flex; align-items: center; gap: 8px; padding: 8px; border-bottom: 1px solid var(--ps-border, #333);">
                    <button class="btn-ghost tl-btn-split" title="Split Clip">
                        <span class="material-symbols-outlined">content_cut</span>
                    </button>
                    <button class="btn-ghost tl-btn-magnet is-active" title="Magnetic Snapping" style="color: var(--ps-blue, #3b82f6);">
                        <span class="material-symbols-outlined">link</span>
                    </button>
                    <button class="btn-ghost tl-btn-delete" title="Delete Selected">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                    <div style="flex: 1;"></div>
                    <span class="material-symbols-outlined" style="font-size: 16px; color: #888;">zoom_out</span>
                    <input type="range" class="tl-zoom-slider" min="1" max="100" value="50" style="width: 100px;">
                    <span class="material-symbols-outlined" style="font-size: 16px; color: #888;">zoom_in</span>
                </div>
                
                <!-- Main Scrollable Area -->
                <div class="timeline-scroll-area" style="flex: 1; overflow: auto; position: relative; display: flex;">
                    
                    <!-- Track Headers -->
                    <div class="timeline-headers" style="width: ${this.options.trackHeaderWidth}px; flex-shrink: 0; position: sticky; left: 0; background: var(--ps-bg-surface, #1e1e1e); z-index: 10; border-right: 1px solid var(--ps-border, #333);">
                        <div class="timeline-corner" style="height: 30px; border-bottom: 1px solid var(--ps-border, #333);"></div>
                        <div class="timeline-header-list"></div>
                        <div style="padding: 16px; text-align: center;">
                            <button class="tl-btn-add-track" style="background: none; border: 1px dashed #666; color: #aaa; padding: 8px; width: 100%; cursor: pointer; border-radius: 4px;">+ Add Track</button>
                        </div>
                    </div>

                    <!-- Tracks Content -->
                    <div class="timeline-content" style="flex: 1; position: relative; min-width: 2000px; background: #16161a;">
                        <div class="timeline-ruler" style="height: 30px; border-bottom: 1px solid var(--ps-border, #333); background: #1c1c21; position: relative; cursor: text;">
                            <canvas class="timeline-ruler-canvas" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></canvas>
                        </div>
                        <div class="timeline-tracks-body" style="position: relative;"></div>
                        <div class="timeline-playhead" style="position: absolute; top: 0; bottom: 0; left: 0; width: 2px; background: #ef4444; z-index: 20; pointer-events: none;">
                            <div style="position: absolute; top: 0; left: -5px; width: 12px; height: 12px; background: #ef4444; clip-path: polygon(0 0, 100% 0, 50% 100%);"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.dom = {
            scrollArea: this.container.querySelector('.timeline-scroll-area'),
            headerList: this.container.querySelector('.timeline-header-list'),
            tracksBody: this.container.querySelector('.timeline-tracks-body'),
            rulerCanvas: this.container.querySelector('.timeline-ruler-canvas'),
            ruler: this.container.querySelector('.timeline-ruler'),
            playhead: this.container.querySelector('.timeline-playhead'),
            zoomSlider: this.container.querySelector('.tl-zoom-slider'),
            btnAddTrack: this.container.querySelector('.tl-btn-add-track'),
            btnSplit: this.container.querySelector('.tl-btn-split'),
            btnDelete: this.container.querySelector('.tl-btn-delete')
        };

        this.bindEvents();
    }

    bindEvents() {
        this.dom.btnAddTrack.addEventListener('click', () => this.options.onAddTrack());
        
        this.dom.ruler.addEventListener('mousedown', (e) => {
            const rect = this.dom.ruler.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            if (clickX >= 0) {
                this.setPlayhead(clickX / this.pixelsPerSecond);
            }
        });
        
        this.dom.btnSplit.addEventListener('click', () => this.options.onSplitClip());
        this.dom.btnDelete.addEventListener('click', () => this.options.onDeleteSelected());
        
        this.dom.zoomSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            this.pixelsPerSecond = Math.max(1, val);
            this.options.onZoom(this.pixelsPerSecond);
            this.render();
        });
    }

    setData(tracks) {
        this.tracks = tracks;
        this.render();
    }

    setPlayhead(time, triggerCallback = true) {
        this.playheadTime = Math.max(0, time);
        this.updatePlayheadDOM();
        if (triggerCallback) this.options.onPlayheadMove(this.playheadTime);
    }

    updatePlayheadDOM() {
        const left = (this.playheadTime * this.pixelsPerSecond);
        this.dom.playhead.style.transform = `translateX(${left}px)`;
    }

    render() {
        // Find max time
        let maxTime = 10;
        this.tracks.forEach(t => {
            (t.clips || []).forEach(c => {
                const end = c.timelineStart + c.duration;
                if (end > maxTime) maxTime = end;
            });
        });

        const totalWidth = (maxTime + 10) * this.pixelsPerSecond;
        this.dom.tracksBody.style.width = `${totalWidth}px`;
        this.dom.ruler.style.width = `${totalWidth}px`;

        // Draw Ruler
        const rHeight = 30;
        this.dom.rulerCanvas.width = totalWidth;
        this.dom.rulerCanvas.height = rHeight;
        const ctx = this.dom.rulerCanvas.getContext('2d');
        ctx.clearRect(0, 0, totalWidth, rHeight);
        ctx.fillStyle = '#666';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        
        const seconds = Math.ceil(totalWidth / this.pixelsPerSecond);
        for(let i=0; i<=seconds; i++){
            const x = i * this.pixelsPerSecond;
            ctx.fillRect(x, 15, 1, 15);
            ctx.fillText(i + 's', x, 12);
        }

        // Render Headers
        this.dom.headerList.innerHTML = '';
        this.dom.tracksBody.innerHTML = '';

        this.tracks.forEach(track => {
            // Header
            const hdr = document.createElement('div');
            hdr.style.height = '80px';
            hdr.style.borderBottom = '1px solid var(--ps-border, #333)';
            hdr.style.padding = '8px';
            hdr.style.display = 'flex';
            hdr.style.alignItems = 'center';
            hdr.style.background = this.selectedTracks.has(track.id) ? '#2e1025' : 'transparent';
            
            const nameDiv = document.createElement('div');
            nameDiv.style.flex = '1';
            nameDiv.style.overflow = 'hidden';
            nameDiv.style.textOverflow = 'ellipsis';
            nameDiv.style.whiteSpace = 'nowrap';
            nameDiv.textContent = track.name;
            hdr.appendChild(nameDiv);
            
            this.options.onRenderTrackHeader(track, hdr);
            this.dom.headerList.appendChild(hdr);

            // Track Body
            const body = document.createElement('div');
            body.style.height = '80px';
            body.style.borderBottom = '1px solid var(--ps-border, #333)';
            body.style.position = 'relative';

            // Allow dropping on track body
            body.addEventListener('dragover', e => {
                e.preventDefault();
                body.style.background = 'rgba(255, 255, 255, 0.05)';
            });
            body.addEventListener('dragleave', () => {
                body.style.background = 'transparent';
            });
            body.addEventListener('drop', e => {
                e.preventDefault();
                body.style.background = 'transparent';
                const rect = body.getBoundingClientRect();
                const scrollLeft = this.dom.tracksBody.parentElement.scrollLeft;
                const offsetX = e.clientX - rect.left + scrollLeft;
                this.options.onTrackDrop(track, offsetX, e);
            });

            (track.clips || []).forEach(clip => {
                const el = document.createElement('div');
                el.style.position = 'absolute';
                el.style.left = `${clip.timelineStart * this.pixelsPerSecond}px`;
                el.style.width = `${clip.duration * this.pixelsPerSecond}px`;
                el.style.height = '100%';
                el.style.border = `1px solid ${track.color || '#10b981'}`;
                el.style.background = 'rgba(16, 185, 129, 0.1)';
                el.style.cursor = 'pointer';
                
                const label = document.createElement('div');
                label.textContent = clip.name;
                label.style.padding = '4px';
                label.style.fontSize = '12px';
                label.style.pointerEvents = 'none';
                label.style.whiteSpace = 'nowrap';
                label.style.overflow = 'hidden';
                label.style.position = 'relative';
                label.style.zIndex = '2';
                el.appendChild(label);
                
                this.options.onRenderClip(clip, el, track);
                
                el.addEventListener('mousedown', (e) => {
                    if (e.button === 2) {
                        this.options.onClipContextMenu(clip, e);
                    } else {
                        this.options.onClipSelect(clip.id, track.id, e);
                        
                        // Setup dragging
                        let startX = e.clientX;
                        let startTimeline = clip.timelineStart;
                        
                        const onMouseMove = (moveEvt) => {
                            const deltaX = moveEvt.clientX - startX;
                            const deltaSec = deltaX / this.pixelsPerSecond;
                            const newTime = Math.max(0, startTimeline + deltaSec);
                            el.style.left = `${newTime * this.pixelsPerSecond}px`;
                            this.options.onClipDrag(clip.id, newTime);
                        };
                        
                        const onMouseUp = () => {
                            window.removeEventListener('mousemove', onMouseMove);
                            window.removeEventListener('mouseup', onMouseUp);
                            this.options.onClipDrop(clip.id);
                        };
                        
                        window.addEventListener('mousemove', onMouseMove);
                        window.addEventListener('mouseup', onMouseUp);
                    }
                });
                
                el.addEventListener('contextmenu', e => e.preventDefault());

                body.appendChild(el);
            });

            this.dom.tracksBody.appendChild(body);
        });

        this.dom.tracksBody.style.minHeight = '100%'; // Ensures scrolling
        this.updatePlayheadDOM();
    }
}
