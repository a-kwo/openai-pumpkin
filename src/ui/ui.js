export function createUI({ onSpin }) {
  const form = document.getElementById('ask');
  const input = document.getElementById('question');
  const btn = document.getElementById('spin-btn');
  const answer = document.getElementById('answer');
  const answerText = document.getElementById('answer-text');
  const hint = document.getElementById('hint');
  const loader = document.getElementById('loader');
  const loaderText = document.getElementById('loader-text');

  form.addEventListener('submit', (e) => { e.preventDefault(); onSpin(input.value.trim()); input.blur(); });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && document.activeElement !== input) { e.preventDefault(); onSpin(input.value.trim()); }
  });

  return {
    setLoading(text) { loaderText.textContent = text; },
    ready() { loader.classList.add('hidden'); setTimeout(() => hint.classList.add('visible'), 1200); },
    hideHint() { hint.classList.remove('visible'); },
    setSpinning(spinning) { btn.disabled = spinning; },
    showAnswer({ text, tone }) {
      answerText.textContent = text;
      answer.className = `answer visible ${tone}`;
    },
    hideAnswer() { answer.classList.remove('visible'); },
    get question() { return input.value.trim(); },
  };
}
