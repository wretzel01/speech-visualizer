export function assignStyles(wordDspResults) {
  return wordDspResults.map(w => {
    const { loudness, pitch, texture, isVoiced } = w.normalized;

    let color, opacity, fontSizePx, fontWeight, fontStyle;

    if (!isVoiced) {
      // UNVOICED / WHISPER STYLE: Soft, breathable, desaturated look
      color = '#94a3b8'; // Slate muted text
      opacity = 0.65;
      fontSizePx = 15;
      fontWeight = 400;
      fontStyle = 'italic';
    } else {
      // VOICED STYLE: Clean sentence-anchored styling
      opacity = 1.0;
      fontStyle = 'normal';

      // Loudness -> Size scaling (subtle baseline, expanding only for outliers)
      fontSizePx = Math.round(15 + (loudness * 8));

      // Pitch -> Hue mapping across a controlled blue/teal/indigo spectrum
      const hue = Math.round(195 + (pitch * 60));
      const lightness = Math.round(55 + (loudness * 15));
      color = `hsl(${hue}, 80%, ${lightness}%)`;

      // Texture -> Weight mapping (smooth vowels vs sharp consonant friction)
      fontWeight = texture > 0.6 ? 600 : 400;
    }

    return {
      word: w.word,
      start: w.start,
      end: w.end,
      metrics: w.normalized,
      styles: {
        fontSize: `${fontSizePx}px`,
        color: color,
        opacity: opacity,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontWeight: fontWeight,
        fontStyle: fontStyle,
        cssString: `font-size: ${fontSizePx}px; color: ${color}; opacity: ${opacity}; font-weight: ${fontWeight}; font-style: ${fontStyle};`
      }
    };
  });
}