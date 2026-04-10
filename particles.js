/**
 * TEDx TIET — Hero Particle Animation
 * Implements a canvas-based particle system that morphs between
 * an "X" and "TEDx" text based on hover interaction.
 */

'use strict';

(function initHeroAnimation() {
  const stage = document.getElementById('animationStage');
  if (!stage) return;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: false }); // alpha: false for better perf, we handle black bg
  stage.appendChild(canvas);

  let width = 0;
  let height = 0;
  let boundingBoxX = { width: 0, height: 0, minX: 0, minY: 0 };
  let boundingBoxTEDx = { width: 0, height: 0, minX: 0, minY: 0 };

  let particles = [];
  let pointsX = [];
  let pointsTEDx = [];
  const PARTICLE_COUNT = 2500; // Optimal targeted for high-end feel vs perf

  let isHovered = false;
  let mouse = { x: -1000, y: -1000, radius: 100 };

  // Theme Colors
  const COLOR_RED = '#E62B1E'; // TED red
  const COLOR_GLOW = 'rgba(230, 43, 30, 0.4)';

  function resize() {
    width = stage.clientWidth;
    height = stage.clientHeight;
    // Handle device pixel ratio for super crisp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    setupPoints();
  }

  window.addEventListener('resize', () => {
    // Basic debounce to avoid jitter
    clearTimeout(window.resizeTimer);
    window.resizeTimer = setTimeout(resize, 200);
  });

  /**
   * Sample text from an offscreen canvas to get coordinate maps
   */
  function getTextPoints(text, fontStr) {
    const offCanvas = document.createElement('canvas');
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
    offCanvas.width = width;
    offCanvas.height = height;

    // Draw text
    offCtx.fillStyle = '#000';
    offCtx.fillRect(0, 0, width, height);
    
    offCtx.fillStyle = '#FFF';
    offCtx.font = fontStr;
    offCtx.textAlign = 'center';
    offCtx.textBaseline = 'middle';
    offCtx.fillText(text, width / 2, height / 2);

    // Scan pixels
    const imgData = offCtx.getImageData(0, 0, width, height).data;
    const points = [];
    let minX = width, maxX = 0, minY = height, maxY = 0;

    // Sample step controls density of points generated from text
    const sampleStep = 3; 

    for (let y = 0; y < height; y += sampleStep) {
      for (let x = 0; x < width; x += sampleStep) {
        const idx = (y * width + x) * 4;
        const r = imgData[idx];
        if (r > 128) {
          points.push({ x, y });
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    return {
      points,
      bounds: {
        width: maxX - minX,
        height: maxY - minY,
        minX,
        minY,
        centerX: width / 2,
        centerY: height / 2,
      }
    };
  }

  function setupPoints() {
    // Generate text maps based on current screen size
    // Using Bebas Neue for TED styling or a generic heavy sans to ensure chunkiness
    
    const fontSizeX = Math.min(width * 0.5, 400); 
    const fontStrX = `bold ${fontSizeX}px "Bebas Neue", "Arial Black", sans-serif`;
    
    const fontSizeTEDx = Math.min(width * 0.25, 200);
    const fontStrTEDx = `bold ${fontSizeTEDx}px "Bebas Neue", "Arial Black", sans-serif`;

    const dataX = getTextPoints('X', fontStrX);
    const dataTEDx = getTextPoints('TEDx', fontStrTEDx);

    pointsX = dataX.points;
    boundingBoxX = dataX.bounds;
    
    pointsTEDx = dataTEDx.points;
    boundingBoxTEDx = dataTEDx.bounds;

    if (particles.length === 0) {
      createParticles();
    } else {
      // If resizing, just update targets
      updateParticleTargets();
    }
  }

  class Particle {
    constructor() {
      // Start randomly offscreen or around center
      this.x = width / 2 + (Math.random() - 0.5) * width;
      this.y = height / 2 + (Math.random() - 0.5) * height;
      this.vx = (Math.random() - 0.5) * 10;
      this.vy = (Math.random() - 0.5) * 10;
      
      this.baseRadius = Math.random() * 1.2 + 0.6;
      this.radius = this.baseRadius;
      
      this.friction = 0.82 + Math.random() * 0.08;
      this.ease = 0.03 + Math.random() * 0.05;
      
      // Random wander values for organic idle movement
      this.wanderAngle = Math.random() * Math.PI * 2;
      this.wanderSpeed = Math.random() * 0.5 + 0.1;
      
      this.opacity = Math.random() * 0.6 + 0.4;
      
      this.targetX = 0;
      this.targetY = 0;
      
      this.stateX_target = { x: 0, y: 0 };
      this.stateTEDx_target = { x: 0, y: 0 };
    }

    assignTargets(px, ptedx) {
      if (px) {
        this.stateX_target.x = px.x;
        this.stateX_target.y = px.y;
      }
      if (ptedx) {
        this.stateTEDx_target.x = ptedx.x;
        this.stateTEDx_target.y = ptedx.y;
      }
      this.updateCurrentTarget();
    }

    updateCurrentTarget() {
      const activeState = isHovered ? this.stateTEDx_target : this.stateX_target;
      this.targetX = activeState.x;
      this.targetY = activeState.y;
    }

    explode() {
      // When transitioning, add a burst of velocity
      const angle = Math.random() * Math.PI * 2;
      const force = Math.random() * 30 + 10;
      this.vx += Math.cos(angle) * force;
      this.vy += Math.sin(angle) * force;
    }

    update() {
      // 1. Spring physics (lerp towards target)
      let dx = this.targetX - this.x;
      let dy = this.targetY - this.y;
      
      this.vx += dx * this.ease;
      this.vy += dy * this.ease;

      // 2. Mouse interaction (repel)
      let mdx = this.x - mouse.x;
      let mdy = this.y - mouse.y;
      let mouseDist = Math.sqrt(mdx * mdx + mdy * mdy);
      
      if (mouseDist < mouse.radius) {
        const force = (mouse.radius - mouseDist) / mouse.radius;
        const angle = Math.atan2(mdy, mdx);
        this.vx += Math.cos(angle) * force * 5;
        this.vy += Math.sin(angle) * force * 5;
      }

      // 3. Organic wander (noise)
      this.wanderAngle += (Math.random() - 0.5) * 0.5;
      this.vx += Math.cos(this.wanderAngle) * this.wanderSpeed;
      this.vy += Math.sin(this.wanderAngle) * this.wanderSpeed;

      // 4. Apply friction and velocity
      this.vx *= this.friction;
      this.vy *= this.friction;
      this.x += this.vx;
      this.y += this.vy;
    }

    draw(ctx) {
      // Adding cinematic depth by varying opacity and radius based on speed
      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      const dynamicRadius = this.baseRadius + Math.min(speed * 0.1, 1.5);
      
      ctx.globalAlpha = this.opacity;
      
      // Give a subtle glow to faster particles
      if (speed > 5) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = COLOR_RED;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.arc(this.x, this.y, dynamicRadius, 0, Math.PI * 2);
      ctx.fillStyle = COLOR_RED;
      ctx.fill();
    }
  }

  function createParticles() {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(new Particle());
    }
    updateParticleTargets();
  }

  function updateParticleTargets() {
    // If we don't have points yet, skip
    if (pointsX.length === 0 || pointsTEDx.length === 0) return;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = particles[i];
      // Randomly select a target coordinate for X and TEDx states
      const targetX = pointsX[Math.floor(Math.random() * pointsX.length)];
      const targetTEDx = pointsTEDx[Math.floor(Math.random() * pointsTEDx.length)];
      p.assignTargets(targetX, targetTEDx);
    }
  }

  function animate() {
    requestAnimationFrame(animate);

    // Pure black background clears
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height); // Note: using canvas bounds, though context is scaled, scale applies to rect too

    // Use additive blending for cinematic glow
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles[i].update();
      particles[i].draw(ctx);
    }
  }

  // --- INTERACTION HANDLERS ---
  
  // Create an overlay to capture hover events easily over the whole stage
  const overlay = document.createElement('div');
  overlay.style.position = 'absolute';
  overlay.style.inset = '0';
  overlay.style.zIndex = '10'; // sit above canvas but below hero__overlay
  stage.appendChild(overlay);

  // You can also trigger this via the hero content block to allow broader hover
  const heroBlock = document.querySelector('.hero__content');
  const triggerArea = heroBlock || overlay;

  triggerArea.addEventListener('mouseenter', () => {
    isHovered = true;
    particles.forEach(p => {
      p.updateCurrentTarget();
      p.explode(); // Boom
    });
  });

  triggerArea.addEventListener('mouseleave', () => {
    isHovered = false;
    particles.forEach(p => {
      p.updateCurrentTarget();
      // Optional: smaller explosion returning back
      const force = Math.random() * 10;
      const angle = Math.random() * Math.PI * 2;
      p.vx += Math.cos(angle) * force;
      p.vy += Math.sin(angle) * force;
    });
    mouse.x = -1000;
    mouse.y = -1000;
  });

  // Track mouse for parallax/repulsion
  window.addEventListener('mousemove', (e) => {
    // get mouse pos relative to stage
    const rect = stage.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });

  // --- INITIALIZATION ---
  resize();
  animate();

  // Let the system know we're ready
  window.dispatchEvent(new CustomEvent('tedx:animationReady'));

})();
