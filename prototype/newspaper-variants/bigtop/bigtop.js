// Big Top: lettering set on an arc, and the sunburst behind the bill.
(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Sunburst rays, alternating ink and paper.
  function burst() {
    const svg = document.querySelector('.burst');
    const n = 36;
    for (let i = 0; i < n; i += 2) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', `M0 0L${Math.cos(a0) * 300} ${Math.sin(a0) * 300}L${Math.cos(a1) * 300} ${Math.sin(a1) * 300}Z`);
      svg.appendChild(p);
    }
  }

  // Each letter is its own span, turned about a centre `radius` px below the line.
  function arc(el) {
    const text = el.textContent;
    el.setAttribute('aria-label', text);
    el.innerHTML = [...text].map(ch => `<span aria-hidden="true">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');
    const spans = [...el.children];
    const layout = () => {
      el.classList.remove('bent');
      const widths = spans.map(s => s.getBoundingClientRect().width);
      const total = widths.reduce((a, b) => a + b, 0);
      // Smaller screens get a tighter curve so the line still fits.
      const radius = Math.max(+el.dataset.arc * Math.min(1, el.clientWidth / 900), total / 2.4);
      let x = -total / 2;
      spans.forEach((s, i) => {
        const a = (x + widths[i] / 2) / radius;
        x += widths[i];
        s.style.transform = `translateX(-50%) rotate(${a}rad)`;
        s.style.height = radius + 'px';
      });
      const sweep = total / 2 / radius;
      el.style.height = radius * (1 - Math.cos(sweep)) + spans[0].offsetHeight * 1.1 + 'px';
      el.classList.add('bent');
    };
    layout();
    let t;
    addEventListener('resize', () => { clearTimeout(t); t = setTimeout(layout, 120); });
  }

  document.addEventListener('DOMContentLoaded', () => {
    burst();
    (document.fonts?.ready || Promise.resolve()).then(() => document.querySelectorAll('[data-arc]').forEach(arc));
  });
})();
