export function shouldFilterOut(text) {
  if (!text) return true;
  const cleaned = text.trim();

  // 1. Filter out empty lines, standalone punctuation, or single characters
  if (cleaned === '' || cleaned === '.' || cleaned.length <= 1) {
    return true;
  }

  // 2. Filter out common AI filler hallucinations or weird artifacts if they sneak through
  const lower = cleaned.toLowerCase();
  const blockedPhrases = [
    "thank you"
  ];
  
  if (blockedPhrases.some(phrase => lower.includes(phrase))) {
    return true;
  }

  // 3. Optional: Ensure text contains standard alphanumeric characters (catches stray foreign scripts if API bounds slip)
  // If it's pure symbols or weird non-latin blocks, drop it.
  const hasValidContent = /[a-zA-Z0-9]/.test(cleaned);
  if (!hasValidContent) {
    return true;
  }

  return false;
}