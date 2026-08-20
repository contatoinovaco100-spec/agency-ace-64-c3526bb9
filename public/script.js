/* ============================================================
   INOVA COMPANY — LANDING PAGE v2
   Interactivity & Cinematic Animations
   ============================================================ */

(function () {
  'use strict';

  // ──────────────── Loading Screen ────────────────
  const loader = document.getElementById('loader');
  document.body.style.overflow = 'hidden';

  window.addEventListener('load', () => {
    setTimeout(() => {
      loader.classList.add('hidden');
      document.body.style.overflow = '';
      // Trigger hero animations after loader hides
      document.querySelectorAll('.hero .reveal').forEach(el => {
        el.classList.add('visible');
      });
    }, 2200);
  });

  // ──────────────── Custom Cursor ────────────────
  const dot = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorRing');
  let mouseX = 0, mouseY = 0;
  let dotX = 0, dotY = 0;
  let ringX = 0, ringY = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  function animateCursor() {
    dotX += (mouseX - dotX) * 0.2;
    dotY += (mouseY - dotY) * 0.2;
    dot.style.left = dotX + 'px';
    dot.style.top = dotY + 'px';

    ringX += (mouseX - ringX) * 0.1;
    ringY += (mouseY - ringY) * 0.1;
    ring.style.left = ringX + 'px';
    ring.style.top = ringY + 'px';

    requestAnimationFrame(animateCursor);
  }
  animateCursor();

  const hoverTargets = 'a, button, .service-card, .portfolio-item, .process-step, .testimonial-card';
  document.addEventListener('mouseover', (e) => {
    if (e.target.closest(hoverTargets)) {
      dot.classList.add('hover');
      ring.classList.add('hover');
    }
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest(hoverTargets)) {
      dot.classList.remove('hover');
      ring.classList.remove('hover');
    }
  });

  // ──────────────── Navigation ────────────────
  const nav = document.getElementById('nav');
  const navToggle = document.getElementById('navToggle');
  const navMobile = document.getElementById('navMobile');

  function handleNavScroll() {
    if (window.scrollY > 60) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }
  window.addEventListener('scroll', handleNavScroll, { passive: true });

  navToggle.addEventListener('click', () => {
    navToggle.classList.toggle('active');
    navMobile.classList.toggle('open');
    document.body.style.overflow = navMobile.classList.contains('open') ? 'hidden' : '';
  });

  navMobile.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      navToggle.classList.remove('active');
      navMobile.classList.remove('open');
      document.body.style.overflow = '';
    });
  });

  navToggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navToggle.click();
    }
  });

  // ──────────────── Hero Particles ────────────────
  const particlesContainer = document.getElementById('heroParticles');
  const particleCount = 24;
  for (let i = 0; i < particleCount; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDuration = (6 + Math.random() * 12) + 's';
    p.style.animationDelay = (Math.random() * 10) + 's';
    p.style.width = (1.5 + Math.random() * 3) + 'px';
    p.style.height = p.style.width;
    p.style.opacity = 0;
    particlesContainer.appendChild(p);
  }

  // ──────────────── Scroll Reveal (IntersectionObserver) ────────────────
  const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Respect custom delay from --delay CSS variable
          const delay = getComputedStyle(entry.target).getPropertyValue('--delay');
          if (delay) {
            entry.target.style.transitionDelay = delay;
          }
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -50px 0px' }
  );
  revealElements.forEach((el) => revealObserver.observe(el));

  // ──────────────── Animated Counters ────────────────
  const statNumbers = document.querySelectorAll('.stat-number[data-target]');
  const counterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );
  statNumbers.forEach((el) => counterObserver.observe(el));

  function animateCounter(el) {
    const target = parseInt(el.dataset.target, 10);
    const suffix = el.dataset.suffix || '';
    const duration = 2200;
    const startTime = performance.now();

    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = Math.round(eased * target);
      el.textContent = current.toLocaleString('pt-BR') + suffix;
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  // ──────────────── Testimonials Carousel ────────────────
  const track = document.getElementById('testimonialsTrack');
  const prevBtn = document.getElementById('prevTestimonial');
  const nextBtn = document.getElementById('nextTestimonial');
  let currentSlide = 0;
  let carouselInterval;

  function getCardWidth() {
    const card = track.querySelector('.testimonial-card');
    if (!card) return 424;
    return card.offsetWidth + 24;
  }

  function getMaxSlide() {
    const cards = track.querySelectorAll('.testimonial-card').length;
    const visibleWidth = track.parentElement.offsetWidth;
    const totalWidth = cards * getCardWidth();
    return Math.max(0, Math.ceil((totalWidth - visibleWidth) / getCardWidth()));
  }

  function updateCarousel() {
    const offset = -(currentSlide * getCardWidth());
    track.style.transform = `translateX(${offset}px)`;
  }

  prevBtn.addEventListener('click', () => {
    currentSlide = Math.max(0, currentSlide - 1);
    updateCarousel();
    resetCarouselInterval();
  });

  nextBtn.addEventListener('click', () => {
    currentSlide = Math.min(getMaxSlide(), currentSlide + 1);
    updateCarousel();
    resetCarouselInterval();
  });

  function startCarouselInterval() {
    carouselInterval = setInterval(() => {
      if (currentSlide >= getMaxSlide()) {
        currentSlide = 0;
      } else {
        currentSlide++;
      }
      updateCarousel();
    }, 5000);
  }

  function resetCarouselInterval() {
    clearInterval(carouselInterval);
    startCarouselInterval();
  }

  startCarouselInterval();

  track.addEventListener('mouseenter', () => clearInterval(carouselInterval));
  track.addEventListener('mouseleave', startCarouselInterval);

  // Touch swipe
  let touchStartX = 0;
  track.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });
  track.addEventListener('touchend', (e) => {
    const diff = touchStartX - e.changedTouches[0].screenX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        currentSlide = Math.min(getMaxSlide(), currentSlide + 1);
      } else {
        currentSlide = Math.max(0, currentSlide - 1);
      }
      updateCarousel();
      resetCarouselInterval();
    }
  }, { passive: true });

  // ──────────────── Smooth Anchor Scrolling ────────────────
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        const offsetTop = target.offsetTop - 80;
        window.scrollTo({ top: offsetTop, behavior: 'smooth' });
      }
    });
  });

  // ──────────────── Parallax on Hero ────────────────
  const heroBg = document.querySelector('.hero-bg');
  const heroLight = document.querySelector('.hero-light');
  const heroLight2 = document.querySelector('.hero-light--2');
  const heroGrid = document.querySelector('.hero-grid');
  let ticking = false;

  function handleParallax() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      const vh = window.innerHeight;
      if (y < vh * 1.5) {
        const shift = y * 0.25;
        heroBg.style.transform = `translateY(${shift}px)`;
        if (heroLight) heroLight.style.opacity = Math.max(0, 1 - y / (vh * 0.8));
        if (heroLight2) heroLight2.style.opacity = Math.max(0, 1 - y / (vh * 0.8));
        if (heroGrid) heroGrid.style.opacity = Math.max(0, 0.6 - y / (vh * 1.2));
      }
      ticking = false;
    });
  }
  window.addEventListener('scroll', handleParallax, { passive: true });

  // ──────────────── Active Nav Link Highlight ────────────────
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a:not(.nav-cta)');

  function highlightNav() {
    const scrollY = window.scrollY + 200;
    sections.forEach((section) => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      const id = section.getAttribute('id');
      if (scrollY >= top && scrollY < top + height) {
        navLinks.forEach((link) => {
          link.style.color = '';
          if (link.getAttribute('href') === '#' + id) {
            link.style.color = 'var(--accent)';
          }
        });
      }
    });
  }
  window.addEventListener('scroll', highlightNav, { passive: true });

  // ──────────────── Magnetic Hover on Service Cards ────────────────
  document.querySelectorAll('.service-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const glow = card.querySelector('.service-card__glow');
      if (glow) {
        glow.style.background = `radial-gradient(circle 200px at ${x}px ${y}px, rgba(255,106,0,0.12), transparent)`;
        glow.style.transform = 'scaleX(1)';
      }
    });
    card.addEventListener('mouseleave', () => {
      const glow = card.querySelector('.service-card__glow');
      if (glow) {
        glow.style.background = 'var(--accent)';
        glow.style.transform = 'scaleX(0)';
      }
    });
  });

  // ──────────────── Portfolio Parallax Tilt ────────────────
  document.querySelectorAll('.portfolio-item').forEach(item => {
    item.addEventListener('mousemove', (e) => {
      const rect = item.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      item.style.transform = `perspective(600px) rotateY(${x * 4}deg) rotateX(${-y * 4}deg)`;
    });
    item.addEventListener('mouseleave', () => {
      item.style.transform = 'perspective(600px) rotateY(0) rotateX(0)';
      item.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
    });
    item.addEventListener('mouseenter', () => {
      item.style.transition = 'none';
    });
  });

  // ──────────────── Resize handler ────────────────
  window.addEventListener('resize', () => {
    updateCarousel();
  });

})();
