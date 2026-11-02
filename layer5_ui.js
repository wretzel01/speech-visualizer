export class AudioVisualizerUI {
  constructor(containerElement) {
    this.container = containerElement;
    this.maxWords = 50; // Keeps DOM clean by trimming old words
  }

  renderWords(styledWords) {
    if (!this.container) return;

    styledWords.forEach(w => {
      const span = document.createElement('span');
      span.textContent = w.word + ' ';
      
      // Apply exact clean styles assigned by Layer 4
      span.style.fontSize = w.styles.fontSize;
      span.style.color = w.styles.color;
      span.style.opacity = w.styles.opacity;
      span.style.fontFamily = w.styles.fontFamily;
      span.style.fontWeight = w.styles.fontWeight;
      span.style.fontStyle = w.styles.fontStyle;
      span.style.transition = 'transform 0.15s ease, color 0.15s ease';

      // Subtle hover effect to inspect individual words
      span.addEventListener('mouseenter', () => {
        span.style.transform = 'scale(1.1)';
      });
      span.addEventListener('mouseleave', () => {
        span.style.transform = 'scale(1.0)';
      });

      this.container.appendChild(span);
    });

    // Trim old words if list gets too long
    while (this.container.children.length > this.maxWords) {
      this.container.removeChild(this.container.firstChild);
    }

    // Auto-scroll to latest words
    this.container.scrollTop = this.container.scrollHeight;
  }

  clear() {
    if (this.container) {
      this.container.innerHTML = '<span style="color: var(--muted); font-style: italic; font-size: 0.9rem;">Spoken words will render here reactively...</span>';
    }
  }
}