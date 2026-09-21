import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, MousePointer2, Music2, VolumeX } from 'lucide-react';
import Galaxy from './Galaxy.jsx';

// Edita estas frases para personalizar la dedicatoria.
const messages = [
  'Hay personas que llegan y hacen que todo brille un poco más. Tú eres una de ellas.',
  'Como los girasoles buscan el sol, mis mejores recuerdos siempre vuelven a ti.',
  'Que hoy te encuentre la alegría en cada pequeño rincón de tu universo.',
  'Gracias por llenar de luz los días que parecían grises.',
  'Si pudiera regalarte un cielo, estaría lleno de flores amarillas.',
];

function Sunflower({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 120 120" role="img" aria-label="Girasol amarillo">
      <defs>
        <linearGradient id="petal" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#ffe892" /><stop offset=".6" stopColor="#f6b92f" /><stop offset="1" stopColor="#b8751b" />
        </linearGradient>
      </defs>
      {Array.from({ length: 14 }, (_, i) => (
        <ellipse key={i} cx="60" cy="27" rx="10.5" ry="25" fill="url(#petal)" transform={`rotate(${i * 360 / 14} 60 60)`} />
      ))}
      <circle cx="60" cy="60" r="24" fill="#5b2c19" stroke="#a66022" strokeWidth="3" />
      {Array.from({ length: 28 }, (_, i) => {
        const r = Math.sqrt(i / 28) * 20, a = i * 2.39996;
        return <circle key={i} cx={60 + Math.cos(a) * r} cy={60 + Math.sin(a) * r} r="1.3" fill="#bd793a" />;
      })}
    </svg>
  );
}

function useAmbientSound(enabled) {
  const sound = useRef(null);
  useEffect(() => {
    if (!enabled) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const master = context.createGain();
    master.gain.value = .11;
    master.connect(context.destination);
    const notes = [261.63, 329.63, 392, 523.25, 440, 392, 329.63, 293.66];
    let step = 0;
    const playNote = () => {
      if (context.state === 'suspended') context.resume();
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const now = context.currentTime;
      oscillator.type = 'sine'; oscillator.frequency.value = notes[step % notes.length];
      envelope.gain.setValueAtTime(.0001, now);
      envelope.gain.exponentialRampToValueAtTime(.34, now + .06);
      envelope.gain.exponentialRampToValueAtTime(.0001, now + 1.65);
      oscillator.connect(envelope); envelope.connect(master);
      oscillator.start(now); oscillator.stop(now + 1.7);
      step++;
    };
    playNote();
    const interval = window.setInterval(playNote, 520);
    sound.current = { context, interval };
    return () => { window.clearInterval(interval); context.close(); sound.current = null; };
  }, [enabled]);
}

export default function App() {
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useAmbientSound(soundOn);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const changeMessage = (direction) => setIndex((current) => (current + direction + messages.length) % messages.length);
  useEffect(() => {
    if (!started) return;
    const onKey = (event) => {
      if (event.key === 'ArrowRight') changeMessage(1);
      if (event.key === 'ArrowLeft') changeMessage(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [started]);

  return (
    <main className={`experience ${started ? 'is-started' : ''}`}>
      <div className="cosmic-haze" aria-hidden="true" />
      <Galaxy active={started} reducedMotion={reducedMotion} />

      <header className="topbar">
        <div className="brand"><span className="brand-symbol">✳</span><span>PARA TI <small>· UN UNIVERSO EN FLOR</small></span></div>
        <button className="sound-button" type="button" onClick={() => setSoundOn((value) => !value)} aria-label={soundOn ? 'Silenciar música' : 'Activar música'} aria-pressed={soundOn}>
          {soundOn ? <Music2 size={17} /> : <VolumeX size={17} />}
          <span>{soundOn ? 'Música activada' : 'Activar música'}</span>
        </button>
      </header>

      <div className="eyebrow"><span className="eyebrow-line" />21 DE SEPTIEMBRE<span className="eyebrow-line" /></div>
      <h1>Feliz día de las <em>flores amarillas</em></h1>

      <aside className="side-note" aria-hidden="true">UN PEQUEÑO UNIVERSO PARA TI <span>✦</span> 2026</aside>

      <section className="message-area" aria-label="Dedicatoria">
        <span className="quote-mark" aria-hidden="true">“</span>
        <p key={index} className="message" aria-live="polite">{messages[index]}</p>
        <div className="message-controls">
          <button type="button" onClick={() => changeMessage(-1)} aria-label="Frase anterior"><ArrowLeft size={18} /></button>
          <span className="counter">{String(index + 1).padStart(2, '0')} <i>/</i> {String(messages.length).padStart(2, '0')}</span>
          <button type="button" onClick={() => changeMessage(1)} aria-label="Frase siguiente"><ArrowRight size={18} /></button>
        </div>
      </section>

      <div className="interaction-hint"><MousePointer2 size={15} /><span>Arrastra para explorar · Desliza para acercar</span></div>
      <div className="corner-decoration" aria-hidden="true">✦ <span>✧</span> ✦</div>

      {!started && (
        <div className="welcome">
          <div className="welcome-content">
            <div className="welcome-halo"><Sunflower className="welcome-flower" /></div>
            <p className="welcome-overline">UNA DEDICATORIA PARA TI</p>
            <h2>Hay flores que se<br /><em>vuelven universo.</em></h2>
            <p className="welcome-copy">Una pequeña galaxia llena de luz, cariño y flores amarillas te espera.</p>
            <button className="enter-button" type="button" onClick={() => setStarted(true)}>
              Entrar a la galaxia <span>↗</span>
            </button>
            <p className="welcome-footnote">La música se puede activar dentro de la experiencia</p>
          </div>
        </div>
      )}
    </main>
  );
}
