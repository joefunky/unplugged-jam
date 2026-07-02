import React, { useState, useEffect, useRef } from 'react';
import { mockDb } from '../mockDb';

// --- Guitar Chord Database (Italian chord names) ------------------------------
// Format: [E-low, A, D, G, B, e-high]  -1=muted  0=open  n=fret
const CHORD_DB = {
  'DO':   { fingers: [-1,3,2,0,1,0], label:'C' },
  'RE':   { fingers: [-1,-1,0,2,3,2], label:'D' },
  'MI':   { fingers: [0,2,2,1,0,0], label:'E' },
  'FA':   { fingers: [1,1,3,3,2,1], label:'F', barre:{fret:1,from:0,to:5} },
  'SOL':  { fingers: [3,2,0,0,0,3], label:'G' },
  'LA':   { fingers: [-1,0,2,2,2,0], label:'A' },
  'SI':   { fingers: [-1,2,4,4,4,2], label:'B', barre:{fret:2,from:1,to:5} },
  'DOm':  { fingers: [-1,3,5,5,4,3], label:'Cm', barre:{fret:3,from:1,to:5} },
  'REm':  { fingers: [-1,-1,0,2,3,1], label:'Dm' },
  'MIm':  { fingers: [0,2,2,0,0,0], label:'Em' },
  'FAm':  { fingers: [1,1,3,3,1,1], label:'Fm', barre:{fret:1,from:0,to:5} },
  'SOLm': { fingers: [3,5,5,3,3,3], label:'Gm', barre:{fret:3,from:0,to:5} },
  'LAm':  { fingers: [-1,0,2,2,1,0], label:'Am' },
  'SIm':  { fingers: [-1,2,4,4,3,2], label:'Bm', barre:{fret:2,from:1,to:5} },
  'DO7':  { fingers: [-1,3,2,3,1,0], label:'C7' },
  'RE7':  { fingers: [-1,-1,0,2,1,2], label:'D7' },
  'MI7':  { fingers: [0,2,0,1,0,0], label:'E7' },
  'FA7':  { fingers: [1,1,3,2,2,1], label:'F7', barre:{fret:1,from:0,to:5} },
  'SOL7': { fingers: [3,2,0,0,0,1], label:'G7' },
  'LA7':  { fingers: [-1,0,2,0,2,0], label:'A7' },
  'SI7':  { fingers: [-1,2,1,2,0,2], label:'B7' },
  'MIm7': { fingers: [0,2,0,0,0,0], label:'Em7' },
  'LAm7': { fingers: [-1,0,2,0,1,0], label:'Am7' },
  'REm7': { fingers: [-1,-1,0,2,1,1], label:'Dm7' },
  'SIm7': { fingers: [-1,2,4,2,3,2], label:'Bm7', barre:{fret:2,from:1,to:5} },
  'LA7sus4': { fingers: [-1,0,2,0,3,0], label:'A7sus4' },
  'REsus2':  { fingers: [-1,-1,0,2,3,0], label:'Dsus2' },
  'SOLsus2': { fingers: [3,0,0,0,3,3], label:'Gsus2' },
  'MIsus4':  { fingers: [0,2,2,2,0,0], label:'Esus4' },
  'LAM':  { fingers: [-1,0,2,2,1,0], label:'Am' },
  'MIM':  { fingers: [0,2,2,0,0,0], label:'Em' },
  'REM':  { fingers: [-1,-1,0,2,3,1], label:'Dm' },
};

// --- SVG Chord Diagram (minimal) ---------------------------------------------
function ChordDiagram({ name }) {
  const chord = CHORD_DB[name.toUpperCase()] || CHORD_DB[name];
  const S = 6, F = 4;
  const cW = 22, cH = 20;
  const pL = 14, pT = 26, pR = 8, pB = 4;
  const W = pL + (S - 1) * cW + pR;
  const H = pT + F * cH + pB;

  if (!chord) return (
    <div style={{ padding: '10px 14px', textAlign: 'center' }}>
      <div style={{ color: '#FFD700', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '0.9rem' }}>{name}</div>
      <div style={{ color: '#444', fontSize: '0.7rem', marginTop: '4px' }}>non disponibile</div>
    </div>
  );

  const { fingers, barre, label } = chord;
  const minFret = Math.max(1, Math.min(...fingers.filter(f => f > 0)));
  const baseFret = minFret > 4 ? minFret - 1 : 1;

  const dots = [];
  fingers.forEach((f, s) => {
    if (f <= 0) return;
    const cy = pT + (f - baseFret + 0.5) * cH;
    dots.push({ cx: pL + s * cW, cy });
  });

  return (
    <div style={{ padding: '8px 10px', textAlign: 'center' }}>
      <div style={{ color: '#FFD700', fontWeight: '700', fontFamily: 'monospace', fontSize: '0.85rem', marginBottom: '5px', letterSpacing: '0.05em' }}>
        {name} <span style={{ color: '#555', fontSize: '0.65rem', fontWeight: 'normal' }}>{label}</span>
      </div>
      <svg width={W} height={H} style={{ display: 'block', margin: '0 auto', overflow: 'visible' }}>
        {baseFret === 1
          ? <rect x={pL} y={pT - 3} width={(S-1)*cW} height={3} rx={1} fill="#555" />
          : <text x={pL-3} y={pT+cH*0.55} textAnchor="end" fill="#444" fontSize="9">{baseFret}</text>
        }
        {Array.from({ length: S }, (_, s) => (
          <line key={s} x1={pL+s*cW} y1={pT} x2={pL+s*cW} y2={pT+F*cH} stroke="#252525" strokeWidth={1} />
        ))}
        {Array.from({ length: F+1 }, (_, f) => (
          <line key={f} x1={pL} y1={pT+f*cH} x2={pL+(S-1)*cW} y2={pT+f*cH} stroke="#252525" strokeWidth={0.7} />
        ))}
        {barre && (() => {
          const cy = pT + (barre.fret - baseFret + 0.5) * cH;
          return <rect x={pL+barre.from*cW} y={cy-6} width={(barre.to-barre.from)*cW} height={12} rx={6} fill="#2255bb" />;
        })()}
        {dots.map((d, i) => (
          <circle key={i} cx={d.cx} cy={d.cy} r={7} fill="#2255bb" />
        ))}
        {fingers.map((f, s) => {
          const x = pL + s * cW;
          if (f === 0) return <text key={s} x={x} y={pT-7} textAnchor="middle" fill="#3a6a3a" fontSize="9">o</text>;
          if (f === -1) return <text key={s} x={x} y={pT-7} textAnchor="middle" fill="#6a3a3a" fontSize="9">x</text>;
          return null;
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2px' }}>
        {['E','A','D','G','B','e'].map((n, s) => (
          <span key={s} style={{ width: cW+'px', textAlign: 'center', display: 'inline-block', fontSize: '8px', color: '#2a2a2a', fontFamily: 'monospace' }}>{n}</span>
        ))}
      </div>
    </div>
  );
}

// --- Lyrics templates built-in -----------------------------------------------
const TEMPLATES = {
  sole: `[00:01.00] (Intro Strumentale)
[00:08.00] [LA] Le bionde [MI] trecce, gli [RE] occhi azzurri e [MI] poi
[00:13.50] [LA] Le tue cal[MI]zette [RE] rosse [MI]
[00:18.00] [LA] E l'inno[MI]cenza su[RE]lle labbra [MI] tue
[00:23.50] [LA] Due aran[MI]ce ancor piu [RE] rosse [MI]
[00:28.00] [LA] Ma la can[MI]zone del [RE] sole [MI]
[00:33.50] [LA] Cosa ne [MI] sa? [RE]
[00:38.00] [LA] Ma cosa [MI] ne sa di [RE] noi?
[00:43.00] [LA] E al cimitero [MI] dei [RE] fiori [MI]
[00:48.00] [LA] Un altro [MI] sole [RE] nascera [MI]`,

  wonderwall: `[00:01.00] (Intro)
[00:06.00] [MIm7] Today is [SOL] gonna be the day
[00:10.50] That they're [RE] gonna throw it back to [LA] you
[00:15.00] [MIm7] By now you [SOL] should've somehow
[00:19.50] Real[RE]ized what you gotta [LA] do
[00:24.00] [DO] I don't believe that [RE] anybody
[00:29.00] [MIm7] Feels the way I [SOL] do about you [LA] now
[00:34.00] [DO] And backbeat, the [RE] word was on the [MIm7] street
[00:38.50] That the [SOL] fire in your heart is [LA] out`,

  box: `[00:01.00] (Guitar Intro Riff)
[00:12.00] [MIm] I'm the man in the [SOL] box
[00:16.50] [RE] Buried in my [LA] shit
[00:21.00] [MIm] Won't you come and [SOL] save me?
[00:25.50] [RE] Save [LA] me
[00:30.00] [MIm] Feed my [SOL] eyes, can you [RE] sew them [LA] shut?
[00:35.00] [MIm] Jesus [SOL] Christ, de[RE]ny your [LA] maker
[00:40.00] [MIm] He who [SOL] tries, will [RE] be [LA] wasted
[00:45.00] [MIm] Feed my [SOL] eyes, now you've [RE] sewn them [LA] shut`,
};

// --- LRC Parser -------------------------------------------------------------
function parseLrc(text) {
  if (!text) return [];
  const result = [];

  text.split('\n').forEach((raw, idx) => {
    const m = raw.match(/^\[(\d{2}):(\d{2})\.(\d{2})\]\s*(.*)/);
    if (!m) return;
    const time = parseInt(m[1]) * 60 + parseInt(m[2]) + parseInt(m[3]) / 100;
    const content = m[4].trim();

    // Split into chord+text segments: [CHORD] text
    const segments = [];
    const parts = content.split(/(\[[^\]]+\])/);
    let chord = '';
    parts.forEach(part => {
      if (/^\[[^\]]+\]$/.test(part)) {
        chord = part.slice(1, -1);
      } else {
        segments.push({ chord, text: part });
        chord = '';
      }
    });

    result.push({ id: idx, time, segments, raw: content });
  });

  // Assign end times
  for (let i = 0; i < result.length; i++) {
    result[i].end = i < result.length - 1 ? result[i + 1].time : result[i].time + 8;
  }
  return result;
}

// --- Component ---------------------------------------------------------------
export default function KaraokeLiveJam({ song, isHost, onClose }) {
  const [lines, setLines] = useState([]);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [activeId, setActiveId] = useState(-1);
  const [asHost, setAsHost] = useState(isHost !== false);
  const [selectedChord, setSelectedChord] = useState(null); // chord popup

  const containerRef = useRef(null);
  const activeRef = useRef(null);
  const timerRef = useRef(null);
  const startRef = useRef(0);
  const pauseRef = useRef(0);
  const bcRef = useRef(null);

  // --- Load lyrics -----------------------------------------------------------
  useEffect(() => {
    if (!song) return;
    
    async function loadLyrics() {
      let sheet = song.lyrics_sheet || '';

      if (!sheet) {
        const t = (song.title || '').toLowerCase();
        if (t.includes('sole')) sheet = TEMPLATES.sole;
        else if (t.includes('wonderwall')) sheet = TEMPLATES.wonderwall;
        else if (t.includes('man in the box') || t.includes('man in a box')) sheet = TEMPLATES.box;
      }

      // If still no lyrics, query the live API on the fly
      if (!sheet) {
        // Simple cleaning helper function inline
        const cleanStr = (s) => (s || '')
          .replace(/\([^)]*\)/g, '')
          .replace(/\[[^\]]*\]/g, '')
          .replace(/\s-\s.*/g, '')
          .replace(/feat\..*/gi, '')
          .replace(/ft\..*/gi, '')
          .replace(/[?.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        const cleanTitle = cleanStr(song.title);
        const cleanArtist = cleanStr(song.artist);

        const queries = [
          `${cleanTitle} ${cleanArtist}`,
          cleanTitle
        ];

        for (const query of queries) {
          try {
            const targetUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
            const res = await fetch(proxyUrl);
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data) && data.length > 0) {
                const match = data.find(item => item.syncedLyrics);
                if (match && match.syncedLyrics) {
                  // Standard chord injection
                  const linesLrc = match.syncedLyrics.split('\n');
                  const chords = ['[LA]', '[MI]', '[RE]', '[SOL]', '[DO]', '[LAm]', '[MIm]', '[SIm]'];
                  let chordIdx = 0;
                  const processed = linesLrc.map(line => {
                    const m = line.match(/^\[(\d{2}):(\d{2})\.(\d{2})\](.*)/);
                    if (!m) return line;
                    const text = m[4].trim();
                    if (!text || text.startsWith('(')) return line;
                    const words = text.split(' ');
                    if (words.length > 2) {
                      words[0] = chords[chordIdx % chords.length] + ' ' + words[0];
                      chordIdx++;
                      if (words.length > 3) {
                        words[Math.floor(words.length / 2)] = chords[chordIdx % chords.length] + ' ' + words[Math.floor(words.length / 2)];
                        chordIdx++;
                      }
                    } else {
                      words[0] = chords[chordIdx % chords.length] + ' ' + words[0];
                      chordIdx++;
                    }
                    return `[${m[1]}:${m[2]}.${m[3]}] ` + words.join(' ');
                  });
                  sheet = processed.join('\n');
                  // Save to Supabase permanently in background
                  mockDb.updateLyrics(song.id, sheet);
                  break; // exit queries loop on success!
                }
              }
            }
          } catch (e) {
            console.warn(`On-the-fly search failed for query "${query}":`, e);
          }
        }
      }

      // Variation 2: Fallback to Lyrics.ovh (Plain text lyrics) if LRCLIB failed
      if (!sheet) {
        try {
          const cleanTitle = cleanStr(song.title);
          const cleanArtist = cleanStr(song.artist);
          const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.lyrics) {
              const rawLines = data.lyrics
                .replace(/Paroles de.*/g, '')
                .split('\n')
                .map(l => l.trim())
                .filter(l => l.length > 0);

              const chords = ['[LA]', '[MI]', '[RE]', '[SOL]', '[DO]', '[LAm]', '[MIm]', '[SIm]'];
              let chordIdx = 0;
              let currentTime = 1.0;

              const processed = rawLines.map((line) => {
                const m = Math.floor(currentTime / 60);
                const s = Math.floor(currentTime % 60);
                const timeStr = `[${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.00]`;
                currentTime += 5.5;

                const words = line.split(' ');
                if (words.length > 2) {
                  const c1 = chords[chordIdx % chords.length]; chordIdx++;
                  const c2 = chords[chordIdx % chords.length]; chordIdx++;
                  words[0] = c1 + ' ' + words[0];
                  if (words.length > 3) {
                    words[Math.floor(words.length / 2)] = c2 + ' ' + words[Math.floor(words.length / 2)];
                  }
                } else {
                  const c = chords[chordIdx % chords.length]; chordIdx++;
                  words[0] = c + ' ' + words[0];
                }

                return `${timeStr} ${words.join(' ')}`;
              });

              sheet = processed.join('\n');
              mockDb.updateLyrics(song.id, sheet);
            }
          }
        } catch (e) {
          console.warn("On-the-fly Lyrics.ovh fallback search failed:", e);
        }
      }

      if (!sheet) {
        sheet = `[00:01.00] Testo non trovato online per questo brano.`;
      }

      setLines(parseLrc(sheet));
      stop();
    }

    loadLyrics();
  }, [song]);

  // ---------------- Broadcast channel (same-device sync) ----------------
  useEffect(() => {
    try {
      bcRef.current = new BroadcastChannel('karaoke_sync');
      bcRef.current.onmessage = ({ data }) => {
        if (!asHost) {
          setElapsed(data.t);
          setPlaying(data.p);
        }
      };
    } catch (e) { /* BroadcastChannel not supported */ }
    return () => { if (bcRef.current) bcRef.current.close(); };
  }, [asHost]);

  function broadcast(t, p) {
    try {
      if (bcRef.current) bcRef.current.postMessage({ t, p });
    } catch (e) { /* channel may be closed, ignore */ }
  }

  // ---------------- Timer ----------------
  function stop() {
    clearInterval(timerRef.current);
    setPlaying(false);
    setElapsed(0);
    pauseRef.current = 0;
    broadcast(0, false);
  }

  function togglePlay() {
    if (playing) {
      clearInterval(timerRef.current);
      setPlaying(false);
      pauseRef.current = elapsed;
      broadcast(elapsed, false);
    } else {
      setPlaying(true);
      startRef.current = performance.now() - elapsed * 1000;
      broadcast(elapsed, true);
      timerRef.current = setInterval(() => {
        const cur = (performance.now() - startRef.current) / 1000;
        setElapsed(cur);
        // periodic sync broadcast
        if (Math.random() < 0.1) {
          broadcast(cur, true);
        }
      }, 50);
    }
  }

  // --- Active line detection -------------------------------------------------
  useEffect(() => {
    let id = -1;
    for (const ln of lines) {
      if (elapsed >= ln.time && elapsed <= ln.end) {
        id = ln.id;
        break;
      }
    }
    setActiveId(id);
  }, [elapsed, lines]);

  // --- Auto-scroll -----------------------------------------------------------
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      const c = containerRef.current;
      const el = activeRef.current;
      const cRect = c.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const targetScroll = c.scrollTop + (elRect.top - cRect.top) - c.clientHeight / 2 + el.clientHeight / 2;
      c.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }
  }, [activeId]);

  const total = lines.length > 0 ? lines[lines.length - 1].end : 0;
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: '#000',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* TOP BAR */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 18px',
        background: 'rgba(0,0,0,0.92)',
        borderBottom: '1px solid #1a1a1a',
        flexShrink: 0,
        zIndex: 10,
        gap: '12px',
      }}>
        {/* Title + Artist stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
          <div style={{
            fontSize: '1rem', fontWeight: '900', textTransform: 'uppercase',
            color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {song?.title}
          </div>
          <div style={{
            fontSize: '0.8rem', color: '#888',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {song?.artist}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          <span style={{
            fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase',
            color: asHost ? '#3388ff' : '#ff4444',
            border: `1px solid ${asHost ? '#3388ff' : '#ff4444'}`,
            borderRadius: '3px', padding: '2px 6px',
          }}>
            {asHost ? 'HOST' : 'SINGER'}
          </span>
          <button
            onClick={() => { stop(); setAsHost(h => !h); }}
            style={{ background: 'none', border: '1px solid #2a2a2a', color: '#aaa', padding: '4px 10px', fontSize: '0.7rem', cursor: 'pointer', borderRadius: '3px' }}
          >
            Cambia Mode
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{ background: 'none', border: '1px solid #2a2a2a', color: '#aaa', padding: '4px 10px', fontSize: '0.7rem', cursor: 'pointer', borderRadius: '3px' }}
            >
              Chiudi X
            </button>
          )}
        </div>
      </div>

      {/* LYRICS */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 5vw',
          scrollBehavior: 'smooth',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
        }}
      >
        {lines.length === 0 ? (
          <div style={{ color: '#333', fontWeight: 'bold', fontSize: '1rem', textTransform: 'uppercase', textAlign: 'center', paddingTop: '40vh' }}>
            Nessun testo disponibile per questo brano.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingTop: '40vh', paddingBottom: '50vh' }}>
            {lines.map(ln => {
              const isActive = activeId === ln.id;
              const isPast = ln.end < elapsed;
              const hasChords = ln.segments.some(s => s.chord);

              return (
                <div
                  key={ln.id}
                  ref={isActive ? activeRef : null}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%',
                    transition: 'opacity 0.3s ease, transform 0.3s ease',
                    opacity: isActive ? 1 : isPast ? 0.15 : 0.35,
                    transform: isActive ? 'scale(1)' : 'scale(0.97)',
                  }}
                >
                  {/* Chords row */}
                  {hasChords && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px', marginBottom: '8px' }}>
                      {ln.segments.map((seg, i) =>
                        seg.chord ? (
                          <span
                            key={i}
                            onClick={() => setSelectedChord(seg.chord)}
                            style={{
                              fontFamily: 'monospace', fontWeight: 'bold', textTransform: 'uppercase',
                              fontSize: isActive ? '1.1rem' : '0.8rem',
                              color: isActive ? '#FFD700' : 'rgba(100,180,255,0.6)',
                              background: isActive ? 'rgba(255,215,0,0.1)' : 'transparent',
                              borderRadius: '4px', padding: '1px 7px',
                              border: isActive ? '1px solid rgba(255,215,0,0.3)' : '1px solid rgba(100,180,255,0.2)',
                              cursor: 'pointer', transition: 'all 0.2s ease',
                            }}
                          >{seg.chord}</span>
                        ) : null
                      )}
                    </div>
                  )}

                  {/* Lyrics text */}
                  <div style={{
                    fontSize: isActive ? 'clamp(1.8rem, 5vw, 3rem)' : 'clamp(1rem, 3vw, 1.6rem)',
                    fontWeight: isActive ? '900' : '300',
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                    textAlign: 'center', lineHeight: 1.3,
                    transition: 'font-size 0.3s ease, font-weight 0.3s ease',
                    letterSpacing: isActive ? '0.02em' : '0',
                  }}>
                    {ln.segments.map((seg, i) => <span key={i}>{seg.text}</span>)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* BOTTOM CONTROL BAR */}
      <div style={{
        flexShrink: 0,
        background: 'rgba(0,0,0,0.9)',
        borderTop: '1px solid #1a1a1a',
        padding: '10px 16px',
        display: 'flex', flexDirection: 'column', gap: '8px',
        backdropFilter: 'blur(10px)',
      }}>
        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#555', minWidth: '36px' }}>{fmt(elapsed)}</span>
          <input
            type="range" min="0" max={total || 100} step="0.1" value={elapsed}
            onChange={e => {
              const v = parseFloat(e.target.value);
              setElapsed(v); pauseRef.current = v;
              if (playing) startRef.current = performance.now() - v * 1000;
              broadcast(v, playing);
            }}
            disabled={!asHost}
            style={{ flex: 1, cursor: asHost ? 'pointer' : 'default', accentColor: '#3388ff' }}
          />
          <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#555', minWidth: '36px', textAlign: 'right' }}>{fmt(total)}</span>
        </div>

        {/* Buttons row */}
        {asHost ? (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center' }}>
            <button onClick={stop}
              style={{ background: 'none', border: '1px solid #333', color: '#555', padding: '6px 14px', fontSize: '0.8rem', cursor: 'pointer', borderRadius: '20px' }}>
              Reset
            </button>
            <button onClick={togglePlay}
              style={{
                background: playing ? '#fff' : '#3388ff', border: 'none',
                color: playing ? '#000' : '#fff',
                padding: '10px 32px', fontSize: '1rem', cursor: 'pointer', borderRadius: '30px',
                fontWeight: '700', minWidth: '100px',
              }}>
              {playing ? 'Pausa' : 'Avvia'}
            </button>
            <label htmlFor="lrc-upload-fs"
              style={{ background: 'none', border: '1px solid #333', color: '#555', padding: '6px 14px', fontSize: '0.75rem', cursor: 'pointer', borderRadius: '20px' }}>
              Carica file
            </label>
            <input type="file" accept=".txt,.lrc" id="lrc-upload-fs" style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files[0]; if (!f) return;
                const r = new FileReader();
                r.onload = ev => { const parsed = parseLrc(ev.target.result); if (parsed.length > 0) { setLines(parsed); stop(); } };
                r.readAsText(f);
              }}
            />
          </div>
        ) : (
          <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Sincronizzato con l'Host
          </div>
        )}
      </div>

      {/* CHORD DIAGRAM POPUP */}
      {selectedChord && (
        <div
          onClick={() => setSelectedChord(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: '#0e0e0e', border: '1px solid #222', borderRadius: '10px', boxShadow: '0 4px 24px rgba(0,0,0,0.7)', minWidth: '140px' }}>
            <ChordDiagram name={selectedChord} />
          </div>
        </div>
      )}
    </div>
  );
}
