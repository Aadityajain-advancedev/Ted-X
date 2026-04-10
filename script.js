/**
 * TEDx TIET — script.js
 * Layout & interaction logic only.
 * No animation libraries. No canvas / particle code.
 * Animation system integration: see "ANIMATION HOOK" comments.
 */

'use strict';

/* ============================================================
   CONSTANTS & STATE
   ============================================================ */
const NAV_SCROLL_THRESHOLD = 40;   // px before nav gains scroll class
let activeSpeakerIndex = 0;        // tracks current speaker detail panel


/* ============================================================
   UTILITY HELPERS
   ============================================================ */

/**
 * Safely query a single DOM element.
 * @param {string} selector
 * @param {Element|Document} [ctx=document]
 * @returns {Element|null}
 */
function qs(selector, ctx = document) {
  return ctx.querySelector(selector);
}

/**
 * Safely query all matching DOM elements.
 * @param {string} selector
 * @param {Element|Document} [ctx=document]
 * @returns {NodeList}
 */
function qsa(selector, ctx = document) {
  return ctx.querySelectorAll(selector);
}

/**
 * Throttle a function to run at most once per `limit` ms.
 * Used for scroll / resize handlers.
 * @param {Function} fn
 * @param {number} limit
 * @returns {Function}
 */
function throttle(fn, limit = 100) {
  let lastRun = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastRun >= limit) {
      lastRun = now;
      fn.apply(this, args);
    }
  };
}


/* ============================================================
   1. NAV — Scroll shrink + mobile menu
   ============================================================ */
(function initNav() {
  const nav        = qs('#nav');
  const toggle     = qs('#navToggle');
  const menu       = qs('#navMenu');
  const navLinks   = qsa('.nav__link, .nav__cta', nav);

  if (!nav || !toggle || !menu) return;

  /* Scroll-triggered background */
  function onNavScroll() {
    const scrolled = window.scrollY > NAV_SCROLL_THRESHOLD;
    nav.classList.toggle('nav--scrolled', scrolled);
  }
  window.addEventListener('scroll', throttle(onNavScroll, 80), { passive: true });
  onNavScroll(); // run once on load

  /* Mobile toggle */
  function openMenu() {
    menu.classList.add('nav__menu--open');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden'; // prevent bg scroll
  }

  function closeMenu() {
    menu.classList.remove('nav__menu--open');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  toggle.addEventListener('click', () => {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    isOpen ? closeMenu() : openMenu();
  });

  /* Close on nav link click */
  navLinks.forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  /* Close on outside click */
  document.addEventListener('click', (e) => {
    if (
      menu.classList.contains('nav__menu--open') &&
      !menu.contains(e.target) &&
      !toggle.contains(e.target)
    ) {
      closeMenu();
    }
  });

  /* Close on Escape key */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('nav__menu--open')) {
      closeMenu();
      toggle.focus();
    }
  });

  /* Active link highlighting based on scroll position */
  const sections = qsa('section[id]');
  const allNavLinks = qsa('.nav__link');

  function updateActiveLink() {
    let current = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop - 120;
      if (window.scrollY >= sectionTop) {
        current = section.getAttribute('id');
      }
    });

    allNavLinks.forEach(link => {
      const href = link.getAttribute('href');
      link.classList.toggle('nav__link--active', href === `#${current}`);
    });
  }

  window.addEventListener('scroll', throttle(updateActiveLink, 150), { passive: true });
})();


/* ============================================================
   2. HERO — Scroll indicator animation (CSS-driven)
   No particle/canvas logic here.
   ============================================================ */
(function initHero() {
  const scrollThumb = qs('.hero__scroll-thumb');
  if (!scrollThumb) return;

  /*
   * Animate the scroll indicator thumb using CSS keyframes injected once.
   * Keeping this separate from styles.css so the animation system
   * can override or extend without merge conflicts.
   */
  if (!document.getElementById('heroScrollStyle')) {
    const style = document.createElement('style');
    style.id = 'heroScrollStyle';
    style.textContent = `
      @keyframes scrollThumbMove {
        0%   { transform: translateY(-100%); opacity: 0; }
        20%  { opacity: 1; }
        80%  { opacity: 1; }
        100% { transform: translateY(100%); opacity: 0; }
      }
      .hero__scroll-thumb {
        animation: scrollThumbMove 2.2s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);
  }

  /*
   * ANIMATION HOOK — Hero particle system
   * ─────────────────────────────────────
   * The external animation system should:
   *   1. Locate:   document.getElementById('animationStage')
   *   2. Append:   a <canvas> or custom element inside it
   *   3. Set:      canvas { width:100%; height:100%; display:block; }
   *   4. Dispatch: window.dispatchEvent(new CustomEvent('tedx:animationReady'))
   *      when the animation is loaded so other modules can react.
   *
   * Example handshake (animation system side):
   *   const stage = document.getElementById('animationStage');
   *   const canvas = document.createElement('canvas');
   *   stage.appendChild(canvas);
   *   window.dispatchEvent(new CustomEvent('tedx:animationReady'));
   *
   * This script listens for that event below:
   */
  window.addEventListener('tedx:animationReady', () => {
    // You can hide a static fallback bg, start a countdown, etc.
    const stage = qs('#animationStage');
    if (stage) stage.classList.add('animation-active');
    console.info('[TEDx] Particle animation system connected.');
  });
})();


/* ============================================================
   3. ABOUT — Horizontal scroll + drag scroll + dot nav
   ============================================================ */
(function initAbout() {
  const track   = qs('#aboutTrack');
  const wrapper = qs('.about__track-wrapper');
  const dots    = qsa('.about__dot');
  const panels  = qsa('.about__panel', track);

  if (!track || !wrapper || !dots.length) return;

  /* ─ Drag-to-scroll (mouse) ─ */
  let isDragging = false;
  let startX, startScrollLeft;

  wrapper.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.pageX - wrapper.offsetLeft;
    startScrollLeft = wrapper.scrollLeft;
    wrapper.style.cursor = 'grabbing';
    e.preventDefault();
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    wrapper.style.cursor = 'grab';
  });

  wrapper.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const x    = e.pageX - wrapper.offsetLeft;
    const walk = (x - startX) * 1.4;
    wrapper.scrollLeft = startScrollLeft - walk;
  });

  /* Prevent click-through after drag */
  wrapper.addEventListener('click', (e) => {
    if (Math.abs(wrapper.scrollLeft - startScrollLeft) > 5) {
      e.stopPropagation();
    }
  });

  /* ─ Update active dot on scroll ─ */
  function getActivePanelIndex() {
    const wrapRect = wrapper.getBoundingClientRect();
    let closestIdx = 0;
    let closestDist = Infinity;

    panels.forEach((panel, i) => {
      const rect = panel.getBoundingClientRect();
      const dist = Math.abs(rect.left - wrapRect.left);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    });

    return closestIdx;
  }

  function updateDots(activeIdx) {
    dots.forEach((dot, i) => {
      const isActive = i === activeIdx;
      dot.classList.toggle('about__dot--active', isActive);
      dot.setAttribute('aria-selected', String(isActive));
    });
  }

  wrapper.addEventListener('scroll', throttle(() => {
    updateDots(getActivePanelIndex());
  }, 100), { passive: true });

  /* ─ Dot click navigates to panel ─ */
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      const panel = panels[i];
      if (!panel) return;
      const panelLeft = panel.offsetLeft - parseInt(getComputedStyle(track).paddingLeft || '0', 10);
      wrapper.scrollTo({ left: panelLeft, behavior: 'smooth' });
    });
  });

  /* ─ Keyboard arrow scroll ─ */
  wrapper.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
      wrapper.scrollBy({ left: 40, behavior: 'smooth' });
    } else if (e.key === 'ArrowLeft') {
      wrapper.scrollBy({ left: -40, behavior: 'smooth' });
    }
  });
})();


/* ============================================================
   4. SPEAKERS — Interactive card / detail panel
   ============================================================ */
(function initSpeakers() {
  const cards       = qsa('.speaker-card');
  const detailPanes = qsa('.speaker-detail');

  if (!cards.length || !detailPanes.length) return;

  function showSpeaker(index) {
    if (index === activeSpeakerIndex) return;
    activeSpeakerIndex = index;

    /* Update cards */
    cards.forEach((card, i) => {
      const isActive = i === index;
      card.classList.toggle('speaker-card--active', isActive);
      card.setAttribute('aria-selected', String(isActive));
    });

    /* Update detail panels */
    detailPanes.forEach((pane, i) => {
      pane.classList.toggle('speaker-detail--hidden', i !== index);
    });
  }

  /* Click handler */
  cards.forEach((card, i) => {
    card.addEventListener('click', () => showSpeaker(i));
  });

  /* Keyboard accessibility: Enter / Space activates card */
  cards.forEach((card, i) => {
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showSpeaker(i);
      }
    });
  });

  /* Initialise first speaker as active */
  showSpeaker(0);
})();


/* ============================================================
   5. SMOOTH SCROLL — anchor links with offset for fixed nav
   ============================================================ */
(function initSmoothScroll() {
  const navHeight = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue('--nav-h') || '72',
    10
  );

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;

      const target = document.querySelector(targetId);
      if (!target) return;

      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - navHeight;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
})();


/* ============================================================
   6. INTERSECTION OBSERVER — "in-view" class for reveal hooks
   Animation system can target .is-in-view to trigger effects.
   ============================================================ */
(function initInView() {
  const targets = qsa(
    '.overview__grid, .overview__stat, .about__panel, .speaker-card, .speaker-detail, .footer__col'
  );

  if (!targets.length || !('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in-view');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -60px 0px',
  });

  targets.forEach(el => observer.observe(el));

  /*
   * ANIMATION HOOK — CSS-only reveal fallback
   * The animation system can use .is-in-view to trigger
   * its own reveal animations by listening for class mutations,
   * or by selecting [class*="is-in-view"] in its own stylesheet.
   *
   * A minimal CSS fallback (no transform, just opacity) is provided
   * so content is always readable even without the animation system:
   */
  if (!document.getElementById('inViewStyle')) {
    const style = document.createElement('style');
    style.id = 'inViewStyle';
    style.textContent = `
      /* Bare-minimum reveal — override freely in animation stylesheet */
      .overview__grid,
      .overview__stat,
      .about__panel,
      .speaker-card,
      .speaker-detail,
      .footer__col {
        opacity: 0;
        transition: opacity 0.6s ease;
      }
      .is-in-view {
        opacity: 1 !important;
      }
    `;
    document.head.appendChild(style);
  }
})();


/* ============================================================
   7. RESIZE HANDLER — update layout-dependent values
   ============================================================ */
(function initResize() {
  function onResize() {
    // Re-read --nav-h in case viewport changes breakpoint
    const navH = getComputedStyle(document.documentElement)
      .getPropertyValue('--nav-h').trim();
    document.documentElement.style.setProperty('--nav-h-actual', navH);
  }

  window.addEventListener('resize', throttle(onResize, 200));
  onResize();
})();


/* ============================================================
   8. GLOBAL EVENT BUS
   Exposes a simple pub/sub for the animation system to hook into
   without coupling directly to DOM queries.
   ============================================================ */
window.TEDxBus = (function () {
  const handlers = {};

  return {
    /**
     * Subscribe to a named event.
     * @param {string} event
     * @param {Function} fn
     */
    on(event, fn) {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(fn);
    },

    /**
     * Unsubscribe from a named event.
     * @param {string} event
     * @param {Function} fn
     */
    off(event, fn) {
      if (!handlers[event]) return;
      handlers[event] = handlers[event].filter(h => h !== fn);
    },

    /**
     * Publish a named event with optional data.
     * @param {string} event
     * @param {*} [data]
     */
    emit(event, data) {
      (handlers[event] || []).forEach(fn => fn(data));
    },
  };
})();

/*
 * ANIMATION SYSTEM INTEGRATION GUIDE
 * ════════════════════════════════════
 *
 * Mount point:
 *   const stage = document.getElementById('animationStage');
 *
 * Events you can emit via TEDxBus:
 *   TEDxBus.emit('hero:enter')        — hero section is in view
 *   TEDxBus.emit('speaker:change', i) — user switched speaker card
 *   TEDxBus.emit('section:inview', id)— any section entered viewport
 *
 * Events this script emits:
 *   window.CustomEvent 'tedx:animationReady' — fired when animation system
 *   calls window.dispatchEvent(new CustomEvent('tedx:animationReady'))
 *
 * CSS hooks exposed:
 *   .is-in-view   — added by IntersectionObserver to all observed elements
 *   .animation-active — added to #animationStage when animation system connects
 *   .nav--scrolled    — added to nav on scroll
 *   .speaker-card--active — current active speaker card
 */

console.info('[TEDx TIET] Layout system initialized. Awaiting animation system.');
