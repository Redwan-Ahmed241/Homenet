/* ============================================
   HOMENET — Main JavaScript
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  // --- Tab switching ---
  // Tab active state is handled by page-specific links (no preventDefault)
  // Active state is set via HTML class on each page

  // --- Filter toggle ---
  const filtersToggle = document.getElementById('filters-toggle');
  if (filtersToggle) {
    filtersToggle.addEventListener('click', () => {
      const isOpen = filtersToggle.getAttribute('aria-expanded') === 'true';
      filtersToggle.setAttribute('aria-expanded', !isOpen);
      filtersToggle.classList.toggle('is-open');
      filtersToggle.textContent = isOpen ? 'Show search filters' : 'Hide search filters';
      // Re-add the SVG icon
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');
      const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      polyline.setAttribute('points', '6 9 12 15 18 9');
      svg.appendChild(polyline);
      filtersToggle.appendChild(svg);
    });
  }

  // --- Smooth horizontal scrolling with mouse drag ---
  const scrollContainers = document.querySelectorAll('.top-lists__scroll');
  scrollContainers.forEach(container => {
    let isDown = false;
    let startX;
    let scrollLeft;

    container.addEventListener('mousedown', (e) => {
      isDown = true;
      container.style.cursor = 'grabbing';
      startX = e.pageX - container.offsetLeft;
      scrollLeft = container.scrollLeft;
    });

    container.addEventListener('mouseleave', () => {
      isDown = false;
      container.style.cursor = 'grab';
    });

    container.addEventListener('mouseup', () => {
      isDown = false;
      container.style.cursor = 'grab';
    });

    container.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - container.offsetLeft;
      const walk = (x - startX) * 1.5;
      container.scrollLeft = scrollLeft - walk;
    });
  });

  // --- Header scroll shadow ---
  const header = document.querySelector('.header');
  if (header) {
    window.addEventListener('scroll', () => {
      const currentScroll = window.pageYOffset;
      if (currentScroll > 10) {
        header.style.boxShadow = '0 2px 12px rgba(0,0,0,0.15)';
      } else {
        header.style.boxShadow = 'none';
      }
    }, { passive: true });
  }
});
