import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Flower2, MousePointer2, Music2, VolumeX, Pause, Play, RotateCcw } from 'lucide-react';
import Galaxy from './Galaxy';
import { messages, musicUrl, phrases } from './content';

export default function App() {
  const [entryRequested, setEntryRequested] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [preloadScene, setPreloadScene] = useState(false);
  const started = entryRequested && sceneReady;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [paused, setPaused] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [sceneError, setSceneError] = useState('');
  const audio = useRef(null);
  const wantsMusic = useRef(true);
  const reducedMotion = useReducedMotion();
  const reportError = useCallback((message) => setSceneError(message), []);
  const reportReady = useCallback(() => setSceneReady(true), []);
  useEffect(() => {
    // Let the opaque welcome screen paint before preparing WebGL underneath it.
    let secondFrame;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setPreloadScene(true));
    });
    return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); };
  }, []);
  const playMusic = useCallback(() => {
    if (!audio.current || !wantsMusic.current) return;
    audio.current.play().then(() => setBlocked(false)).catch((error) => {
      if (error.name === 'NotAllowedError') setBlocked(true);
      else if (error.name !== 'AbortError') setAudioError(true);
    });
  }, []);
  useEffect(() => {
    audio.current.volume = .6;
  }, []);
  const startExperience = () => {
    if (entryRequested) return;
    wantsMusic.current = true;
    playMusic();
    setEntryRequested(true);
  };
  const toggleMusic = () => {
    if (playing) { wantsMusic.current = false; audio.current.pause(); setBlocked(false); }
    else { wantsMusic.current = true; setAudioError(false); playMusic(); }
  };
  const changeMessage = (direction) => setIndex((current) => (current + direction + messages.length) % messages.length);
  const motionProps = reducedMotion ? {} : { initial: { opacity: 0, y: -14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 1.2 } };
  return (
    <main className={`experience ${started ? 'is-started' : 'is-welcome'}`}>
      <audio ref={audio} src={musicUrl} loop preload="auto" onPlay={() => { setPlaying(true); setBlocked(false); }} onPause={() => setPlaying(false)} onError={() => { setAudioError(true); setPlaying(false); }} />
      <motion.div className="galaxy-layer" aria-hidden={!started} inert={!started} initial={{ opacity: 0 }} animate={{ opacity: started ? 1 : 0 }} transition={{ duration: reducedMotion ? 0 : 1.1, ease: 'easeInOut' }}>
        {preloadScene && <Galaxy active={started} paused={paused || !!reducedMotion} resetKey={resetKey} onError={reportError} onReady={reportReady} />}
      </motion.div>
      {started && <>
      <div className="scene-vignette" aria-hidden="true" />
      <motion.header className="topbar" {...motionProps}>
        <div className="brand"><Flower2 className="brand-flower" size={22} strokeWidth={1.7} aria-hidden="true" /><span>PARA TI <small>· UN UNIVERSO EN FLOR</small></span></div>
        <div className="toolbar">
          <button className="tool-button" onClick={() => setResetKey((v) => v + 1)} aria-label="Restablecer cámara" title="Restablecer cámara"><RotateCcw size={16} /></button>
          <button className="tool-button" onClick={() => setPaused((v) => !v)} aria-label={paused ? 'Reanudar animación' : 'Pausar animación'} aria-pressed={paused} disabled={!!reducedMotion} title={reducedMotion ? 'Movimiento reducido según tu dispositivo' : 'Pausar movimiento'}>{paused || reducedMotion ? <Play size={16} /> : <Pause size={16} />}</button>
          <button data-audio-control className={`sound-button ${playing ? 'playing' : ''}`} onClick={toggleMusic} aria-label={playing ? 'Pausar música' : 'Reproducir Yellow de Coldplay'} aria-pressed={playing}>
            {playing ? <Music2 size={17} /> : <VolumeX size={17} />}<span>{playing ? 'Yellow · Coldplay' : 'Activar música'}</span>
            {playing && <span className="equalizer" aria-hidden="true"><i /><i /><i /></span>}
          </button>
        </div>
      </motion.header>
      <motion.div className="title-group" {...motionProps}>
        <div className="eyebrow"><span className="eyebrow-line" />21 DE SEPTIEMBRE<span className="eyebrow-line" /></div>
        <h1>Feliz día de las <em>flores amarillas</em></h1>
      </motion.div>
      <aside className="side-note" aria-hidden="true">TODAS LAS ESTRELLAS ME LLEVAN A TI <span>✦</span></aside>
      <motion.section className="message-area" aria-label="Dedicatoria" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .7, duration: 1.5 }}>
        <span className="quote-mark" aria-hidden="true">“</span>
        <div className="message-window" aria-live="polite">
          <AnimatePresence mode="wait"><motion.p key={index} className="message" initial={{ opacity: 0, y: reducedMotion ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reducedMotion ? 0 : -8 }} transition={{ duration: .35 }}>{messages[index]}</motion.p></AnimatePresence>
        </div>
        <div className="message-controls"><button onClick={() => changeMessage(-1)} aria-label="Frase anterior"><ArrowLeft size={18} /></button><span className="counter">{String(index + 1).padStart(2, '0')} <i>/</i> {String(messages.length).padStart(2, '0')}</span><button onClick={() => changeMessage(1)} aria-label="Frase siguiente"><ArrowRight size={18} /></button></div>
      </motion.section>
      <div className="interaction-hint"><MousePointer2 size={15} /><span>Arrastra para explorar · Rueda o dos dedos para acercar</span></div>
      <AnimatePresence>{(blocked || audioError || sceneError) && <motion.div className="experience-notice" role="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{sceneError || (audioError ? 'No se pudo reproducir la música. Toca el botón para reintentar.' : 'Toca la galaxia para escuchar Yellow ♫')}</motion.div>}</AnimatePresence>
      <div className="sr-only"><h2>Palabras de esta galaxia</h2><ul>{phrases.map((phrase) => <li key={phrase}>{phrase}</li>)}</ul></div>
      </>}
      <AnimatePresence>
        {!started && <motion.div key="welcome" className="welcome-screen" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? .01 : 1.1, ease: 'easeInOut' }}>
          <div className="welcome-stars" aria-hidden="true" />
          <motion.div className="welcome-center" initial={reducedMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .9 }}>
            <motion.button className="sunflower-start" type="button" onClick={startExperience} disabled={entryRequested} aria-busy={entryRequested && !sceneReady} aria-label="Tocar el girasol para comenzar la experiencia" whileHover={reducedMotion ? undefined : { scale: 1.08 }} whileTap={reducedMotion ? undefined : { scale: .94 }}>
              <span className="sunflower-halo" aria-hidden="true" />
              <img src="/imagenes/girasoles(1).png" alt="" />
            </motion.button>
            <p className="welcome-invitation" role="status">{entryRequested ? 'La galaxia está despertando…' : 'Toca el girasol para comenzar'}</p>
            <span className="welcome-sparkle" aria-hidden="true">✦ &nbsp; ✧ &nbsp; ✦</span>
          </motion.div>
        </motion.div>}
      </AnimatePresence>
    </main>
  );
}
