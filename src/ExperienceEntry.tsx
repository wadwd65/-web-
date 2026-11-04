import {useEffect, useRef, useState} from 'react';
import type {CSSProperties} from 'react';
import RhineMark, {RHINE_SYMBOL_PATHS} from './RhineMark.tsx';
import {createEntrySequence} from './entry-sequence.ts';

type EntryProps = {
  ready: boolean;
  onComplete: () => void;
  onReveal: () => void;
  staticMode?: boolean;
  onMusicToggle: () => void;
  musicPlaying?: boolean;
};

const CHAPTERS = [
  ['01—02', '看清约定'],
  ['03—05', '理解工作'],
  ['06—08', '安顿生活'],
];

/** The welcome screen holds until the user starts the original staged opening. */
export default function ExperienceEntry({ready, onComplete, onReveal, staticMode = false, onMusicToggle, musicPlaying = false}: EntryProps) {
  const [sequence] = useState(() => createEntrySequence(staticMode || matchMedia('(prefers-reduced-motion: reduce)').matches));
  const [view, setView] = useState(sequence.state);
  const [started, setStarted] = useState(false);
  const callbacks = useRef({onComplete, onReveal, ready});
  const finished = useRef(false);
  const revealed = useRef(false);
  const startButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  callbacks.current = {onComplete, onReveal, ready};
  const playing = started && ready;

  function finish() {
    if (finished.current) return;
    finished.current = true;
    if (!revealed.current) {
      revealed.current = true;
      callbacks.current.onReveal();
    }
    callbacks.current.onComplete();
  }

  function start() {
    if (sequence.state().requested) return;
    setView(sequence.start());
    setStarted(true);
    panel.current?.focus();
  }

  function skip() {
    sequence.skip();
    finish();
  }

  useEffect(() => {
    startButton.current?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        skip();
        return;
      }
      if (event.key === 'Enter' && !event.repeat && event.target === panel.current) {
        event.preventDefault();
        start();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled):not([hidden])') ?? [])
        .filter(element => element.getClientRects().length > 0 && !element.closest('[inert]'));
      if (!controls.length) {
        event.preventDefault();
        return;
      }
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', key, {capture: true});
    return () => window.removeEventListener('keydown', key, {capture: true});
  }, []);

  useEffect(() => {
    if (!started) return;
    let timer = 0;
    let last = performance.now();
    function tick() {
      const now = performance.now();
      const next = sequence.advance(now - last, callbacks.current.ready, !document.hidden);
      last = now;
      setView(previous => previous.phase === next.phase && previous.reveal === next.reveal && previous.completed === next.completed ? previous : next);
      if (next.reveal && !revealed.current) {
        revealed.current = true;
        callbacks.current.onReveal();
      }
      if (next.completed) {
        finish();
        return;
      }
      timer = window.setTimeout(tick, 50);
    }
    function visibility() {
      clearTimeout(timer);
      last = performance.now();
      if (!document.hidden) timer = window.setTimeout(tick, 0);
    }
    if (!document.hidden) timer = window.setTimeout(tick, 0);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [started, sequence]);

  return <div
    ref={panel}
    className={`experience-entry ee-cinematic ee-phase-${view.phase} ${playing ? 'ee-running' : 'ee-waiting'}`}
    data-entry-state={started ? (ready ? 'playing' : 'preparing') : 'waiting'}
    role="dialog" aria-modal="true" aria-labelledby="experience-entry-title" tabIndex={-1}
  >
    <div className="ee-curtain ee-curtain-left" aria-hidden="true" />
    <div className="ee-curtain ee-curtain-right" aria-hidden="true" />
    <div className="entry-registration" aria-hidden="true"><i/><i/><i/><i/></div>
    <header className="entry-header"><span>莱茵生命 / RHINE LAB</span><span>FIRST STEP — LIFE IN PROGRESS</span></header>

    <section className="entry-welcome" aria-hidden={playing} inert={playing}>
      <div className="entry-welcome-mark" aria-hidden="true"><RhineMark/></div>
      <p className="entry-eyebrow">YOUR NEXT CHAPTER</p>
      <h1 id="experience-entry-title">初程<span>FIRST STEP</span></h1>
      <p className="entry-welcome-caption">下一程，由此开始。</p>
      <button ref={startButton} className="entry-start" disabled={started} onClick={start}>
        <span>{started ? '正在准备空间' : '点击进入'}</span><span aria-hidden="true">↗</span>
      </button>
      <small className="entry-key-hint">ENTER / 开始</small>
    </section>

    <div className="entry-film" aria-hidden="true">
      <div className="entry-film-copy">
        <small>EVERY JOURNEY BEGINS SOMEWHERE.</small>
        <h2>{Array.from('世界展开。').map((glyph, index) => <span key={index} style={{'--glyph': index} as CSSProperties}>{glyph}</span>)}</h2>
        <p>下一程，由此开始。</p>
        <div className="entry-film-signature"><span>FIRST STEP</span><i/><span>01 / 08</span></div>
      </div>
      <div className="entry-symbol-field">
        <div className="entry-symbol-label"><span>RHINE LAB</span><span>＋ − ＝ ∞</span></div>
        <svg className="entry-drawn-mark" viewBox="0 0 72 44" fill="none">
          {RHINE_SYMBOL_PATHS.map(path => <path key={path} d={path} pathLength={1}/>)}
        </svg>
        <div className="entry-symbol-caption"><span>CHOICE / AGREEMENT</span><span>EARNINGS / LIFE</span></div>
        <div className="entry-scan-line"/>
      </div>
    </div>

    <div className="entry-chapters" aria-hidden="true">
      {CHAPTERS.map(([number, label], index) => <div key={number} style={{'--chapter': index} as CSSProperties}><span>{number}</span><i/><strong>{label}</strong></div>)}
    </div>
    <footer inert={view.phase >= 3} aria-hidden={view.phase >= 3 || undefined}>
      <div className="entry-readiness"><span><i/>{ready ? '空间已就绪' : '正在准备三维空间'}</span><small>8 个模块 / 本地工具与办理导航</small></div>
      <div className="ee-entry-actions">
        <button onClick={onMusicToggle} aria-pressed={musicPlaying}>{musicPlaying ? '主题音乐已开启' : '开启主题音乐'}<span>♪</span></button>
        <button onClick={skip}>{playing ? '跳过动画' : '直接进入'}<span>ESC ↗</span></button>
      </div>
    </footer>
    <span className="visually-hidden" role="status">{started ? (ready ? '正在播放入场动画' : '正在准备空间，请稍候') : '点击进入或按Enter开始'}</span>
  </div>;
}
