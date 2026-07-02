import React, { useEffect, useRef, useState } from 'react';

// Chords and lyrics database for interactive diagrams
const CHORD_DIAGRAMS = {
  "LA": { name: "La Maggiore (A)", frets: [{ s: 3, f: 2 }, { s: 4, f: 2 }, { s: 5, f: 2 }], muted: [1], open: [2, 6] },
  "MI": { name: "Mi Maggiore (E)", frets: [{ s: 2, f: 2 }, { s: 3, f: 2 }, { s: 4, f: 1 }], open: [1, 5, 6] },
  "RE": { name: "Re Maggiore (D)", frets: [{ s: 4, f: 2 }, { s: 5, f: 3 }, { s: 6, f: 2 }], muted: [1, 2], open: [3] },
  "MIM": { name: "Mi Minore (Em)", frets: [{ s: 2, f: 2 }, { s: 3, f: 2 }], open: [1, 4, 5, 6] },
  "SOL": { name: "Sol Maggiore (G)", frets: [{ s: 1, f: 3 }, { s: 2, f: 2 }, { s: 6, f: 3 }], open: [3, 4, 5] },
  "DO": { name: "Do Maggiore (C)", frets: [{ s: 2, f: 3 }, { s: 3, f: 2 }, { s: 5, f: 1 }], muted: [1], open: [4, 6] },
  "LAM": { name: "La Minore (Am)", frets: [{ s: 3, f: 2 }, { s: 4, f: 2 }, { s: 5, f: 1 }], muted: [1], open: [2, 6] },
  "FA": { name: "Fa Maggiore (F)", frets: [{ s: 1, f: 1 }, { s: 2, f: 3 }, { s: 3, f: 3 }, { s: 4, f: 2 }, { s: 5, f: 1 }, { s: 6, f: 1 }] },
  "MIM7": { name: "Mi Minore 7 (Em7)", frets: [{ s: 2, f: 2 }, { s: 5, f: 3 }, { s: 6, f: 3 }], open: [1, 3, 4] },
  "LA7SUS4": { name: "La 7 sus 4 (A7sus4)", frets: [{ s: 3, f: 2 }, { s: 5, f: 3 }], muted: [1], open: [2, 4, 6] }
};

// Chords and lyrics data
const LYRICS_DATA = {
  sole: [
    { time: 0, text: "[LA] Le bionde [MI] trecce, gli [RE] occhi azzurri e [MI] poi" },
    { time: 3, text: "[LA] Le tue cal[MI]zette [RE] rosse [MI]" },
    { time: 6, text: "[LA] E l'inno[MI]cenza su[RE]lle labbra [MI] tue" },
    { time: 9, text: "[LA] Due aran[MI]ce ancor più [RE] rosse [MI]" },
    { time: 12, text: "[LA] Ma la can[MI]zone del [RE] sole [MI]" },
    { time: 15, text: "[LA] Cosa ne [MI] sa? [RE] [MI]" },
    { time: 18, text: "[LA] Ma cosa [MI] ne sa di [RE] noi? [MI]" },
    { time: 21, text: "[LA] E al cimitero [MI] dei [RE] fiori [MI]" },
    { time: 24, text: "[LA] Un altro [MI] sole [RE] nascerà [MI]" }
  ],
  wonderwall: [
    { time: 0, text: "[MIm7] Today is [SOL] gonna be the day" },
    { time: 3, text: "That they're [RE] gonna throw it back to [LA7sus4] you" },
    { time: 6, text: "[MIm7] By now you [SOL] should've somehow" },
    { time: 9, text: "Real[RE]ized what you gotta [LA7sus4] do" },
    { time: 12, text: "[DO] I don't believe that [RE] anybody" },
    { time: 15, text: "[MIm7] Feels the way I [SOL] do about you [LA7sus4] now" },
    { time: 18, text: "[DO] And backbeat, the [RE] word was on the [MIm7] street" },
    { time: 21, text: "That the [SOL] fire in your heart is [LA7sus4] out" }
  ],
  box: [
    { time: 0, text: "[MIm] I'm the man in the [SOL] box" },
    { time: 3, text: "[RE] Buried in my [LA] shit" },
    { time: 6, text: "[MIm] Won't you come and [SOL] save me?" },
    { time: 9, text: "[RE] Save [LA] me" },
    { time: 12, text: "(Ritornello)" },
    { time: 14, text: "[MIm] Feed my [SOL] eyes, can you [RE] sew them [LA] shut?" },
    { time: 18, text: "[MIm] Jesus [SOL] Christ, de[RE]ny your [LA] maker" },
    { time: 22, text: "[MIm] He who [SOL] tries, will [RE] be [LA] wasted" },
    { time: 26, text: "[MIm] Feed my [SOL] eyes, now you've [RE] sewn them [LA] shut" }
  ],
  fallback: [
    { time: 0, text: "[DO] Lungo la strada [SOL] passeggiavamo insieme," },
    { time: 3, text: "[LAM] le onde del mare e [FA] l'accordo che sale." },
    { time: 6, text: "[DO] Sotto le stelle di [SOL] questa notte d'estate," },
    { time: 9, text: "[LAM] cantiamo forte le [FA] nostre canzoni preferite." },
    { time: 12, text: "(Ritornello)" },
    { time: 15, text: "[DO] E si suona, [SOL] e si balla sulla sabbia!" },
    { time: 18, text: "[LAM] Senza pensieri e [FA] senza più rabbia." },
    { time: 21, text: "[DO] Con una chitarra [SOL] e un cerchio di amici," },
    { time: 24, text: "[LAM] in questa notte ci [FA] sentiamo felici." }
  ]
};

// YouTube Video ID mappings for backing track
const YT_VIDEO_IDS = {
  sole: "g4mE58N967M",
  wonderwall: "6hzrDeoppFY",
  box: "Nco_kh8xJ0c",
  fallback: "6hzrDeoppFY"
};

export default function KaraokeLiveJam({ song, isScrolling, onToggleScroll, onTimeUpdate, karaokeTime, onClose }) {
  const containerRef = useRef(null);
  const activeLineRef = useRef(null);
  const playerRef = useRef(null);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [activeChord, setActiveChord] = useState(null);

  const titleLower = song.title.toLowerCase();
  const lyricsKey = titleLower.includes("sole") ? "sole" 
    : titleLower.includes("wonderwall") ? "wonderwall" 
    : titleLower.includes("box") ? "box" 
    : "fallback";
  
  const lines = LYRICS_DATA[lyricsKey] || LYRICS_DATA.fallback;

  // Find active line index
  let activeIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (karaokeTime >= lines[i].time) {
      activeIndex = i;
    } else {
      break;
    }
  }

  // Handle Autoscrolling with smooth sub-second pixel interpolation
  useEffect(() => {
    if (autoScrollEnabled && containerRef.current) {
      const activeEl = activeLineRef.current;
      if (activeEl) {
        const container = containerRef.current;
        
        // Find next element to interpolate if available
        const currentLine = lines[activeIndex];
        const nextLine = lines[activeIndex + 1];
        
        let extraOffset = 0;
        if (currentLine && nextLine && karaokeTime > currentLine.time) {
          const totalDuration = nextLine.time - currentLine.time;
          const elapsed = karaokeTime - currentLine.time;
          const progress = Math.min(1, Math.max(0, elapsed / totalDuration));
          
          // Interpolate with next element's offset to make scrolling perfectly continuous!
          const nextEl = activeEl.nextElementSibling;
          if (nextEl) {
            const currentTop = activeEl.offsetTop;
            const nextTop = nextEl.offsetTop;
            const distance = nextTop - currentTop;
            extraOffset = distance * progress;
          }
        }

        const targetScrollTop = (activeEl.offsetTop + extraOffset) - container.clientHeight / 2 + activeEl.clientHeight / 2;

        // Set scroll position instantly to prevent animation conflict locks
        container.scrollTop = targetScrollTop;
      }
    }
  }, [activeIndex, autoScrollEnabled, karaokeTime, lines]);

  // Load YouTube Player API and Initialize
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    let checkYTInterval = setInterval(() => {
      if (window.YT && window.YT.Player) {
        clearInterval(checkYTInterval);
        initYTPlayer();
      }
    }, 100);

    return () => {
      clearInterval(checkYTInterval);
      if (playerRef.current && playerRef.current.destroy) {
        playerRef.current.destroy();
      }
    };
  }, [song.id]);

  const initYTPlayer = () => {
    const videoId = YT_VIDEO_IDS[lyricsKey] || YT_VIDEO_IDS.fallback;
    
    // Check if element is in DOM
    if (!document.getElementById('yt-player')) return;

    playerRef.current = new window.YT.Player('yt-player', {
      height: '120',
      width: '100%',
      videoId: videoId,
      playerVars: {
        playsinline: 1,
        controls: onToggleScroll ? 1 : 0, // Show controls for Host/Studio only
        rel: 0,
        modestbranding: 1
      },
      events: {
        onReady: (event) => {
          if (!onToggleScroll && karaokeTime > 0) {
            event.target.seekTo(karaokeTime, true);
            event.target.playVideo();
          }
        },
        onStateChange: (event) => {
          if (onToggleScroll) {
            const isPlaying = event.data === window.YT.PlayerState.PLAYING;
            if (isPlaying !== isScrolling) {
              onToggleScroll(isPlaying);
            }
          }
        }
      }
    });
  };

  // Poll Host YouTube Player time and lift up to parent
  useEffect(() => {
    let pollInterval;
    if (onToggleScroll && isScrolling && playerRef.current && playerRef.current.getCurrentTime) {
      pollInterval = setInterval(() => {
        const t = playerRef.current.getCurrentTime();
        if (typeof t === 'number' && onTimeUpdate) {
          onTimeUpdate(t);
        }
      }, 150);
    }
    return () => clearInterval(pollInterval);
  }, [isScrolling, onToggleScroll, onTimeUpdate]);

  // Sync Singer YouTube Player state with parent state
  useEffect(() => {
    if (!onToggleScroll && playerRef.current && playerRef.current.getPlayerState) {
      try {
        const state = playerRef.current.getPlayerState();
        if (karaokeTime > 0) {
          const localTime = playerRef.current.getCurrentTime() || 0;
          if (Math.abs(localTime - karaokeTime) > 1.5) {
            playerRef.current.seekTo(karaokeTime, true);
          }
          if (state !== window.YT.PlayerState.PLAYING) {
            playerRef.current.playVideo();
          }
        } else {
          if (state === window.YT.PlayerState.PLAYING) {
            playerRef.current.pauseVideo();
          }
        }
      } catch (e) {
        console.warn("YouTube player sync failed", e);
      }
    }
  }, [karaokeTime, onToggleScroll]);

  // Map chord modifiers to base keys
  const getCleanChordKey = (chordName) => {
    let clean = chordName.toUpperCase().trim();
    if (CHORD_DIAGRAMS[clean]) return clean;
    if (clean === "MIM" || clean === "EM") return "MIM";
    if (clean === "MIM7" || clean === "EM7") return "MIM7";
    if (clean === "LA7SUS4" || clean === "A7SUS4") return "LA7SUS4";
    if (clean === "LAM" || clean === "AM") return "LAM";
    return clean;
  };

  // Clean chords above lyrics presentation helper with position layout
  const renderParsedChordsAndLyrics = (text, isActive) => {
    let cleanPos = 0;
    let i = 0;
    let chordsList = [];

    while (i < text.length) {
      if (text[i] === '[') {
        let closing = text.indexOf(']', i);
        if (closing !== -1) {
          let chordName = text.substring(i + 1, closing);
          chordsList.push({ pos: cleanPos, name: chordName });
          i = closing + 1;
          continue;
        }
      }
      cleanPos++;
      i++;
    }

    let cleanText = text.replace(/\[([^\]]+)\]/g, "");

    // If there are no chords in this line, just render the lyrics
    if (chordsList.length === 0) {
      return (
        <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', textTransform: 'uppercase' }}>
          {cleanText}
        </div>
      );
    }

    return (
      <div style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}>
        {/* Chords Line */}
        <div style={{ 
          position: 'relative',
          height: '1.4em',
          color: isActive ? '#A30000' : 'var(--bauhaus-red)', 
          fontWeight: '900', 
          fontSize: '0.95rem',
          letterSpacing: '0px'
        }}>
          {chordsList.map(({ pos, name }, cIdx) => (
            <span 
              key={cIdx}
              onClick={(e) => {
                e.stopPropagation();
                setActiveChord(name);
              }}
              style={{
                position: 'absolute',
                left: `${pos}ch`,
                cursor: 'pointer',
                borderBottom: '1px dashed var(--bauhaus-red)',
                paddingBottom: '1px'
              }}
              title="Clicca per diagramma accordo"
            >
              {name}
            </span>
          ))}
        </div>
        {/* Lyrics Line */}
        <div style={{ 
          lineHeight: '1.2',
          letterSpacing: '0px',
          fontWeight: isActive ? '900' : 'normal',
          whiteSpace: 'pre'
        }}>
          {cleanText}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      backgroundColor: '#000000',
      border: 'none',
      padding: '0px',
      marginTop: '10px',
      position: 'relative'
    }}>
      {onClose && (
        <button 
          onClick={onClose} 
          className="btn-bauhaus btn-red"
          style={{
            position: 'absolute',
            top: '0px',
            right: '0px',
            width: 'auto',
            padding: '8px 16px',
            fontSize: '0.8rem',
            boxShadow: 'none',
            zIndex: 10
          }}
        >
          CHIUDI
        </button>
      )}

      <div style={{
        marginBottom: '20px', 
        borderBottom: '1px solid rgba(255,255,255,0.2)', 
        paddingBottom: '16px', 
        marginRight: onClose ? '80px' : '0px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
      }}>
        <div>
          <h3 style={{fontSize: '1.4rem', textTransform: 'uppercase', margin: 0}}>{song.title}</h3>
          <p style={{fontSize: '0.9rem', color: 'var(--charcoal)', fontWeight: 'bold', margin: '4px 0 0 0'}}>{(song.artist || '')?.toUpperCase()}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {onToggleScroll && (
            <button 
              onClick={() => {
                if (playerRef.current) {
                  const state = playerRef.current.getPlayerState();
                  if (state === window.YT.PlayerState.PLAYING) {
                    playerRef.current.pauseVideo();
                    onToggleScroll(false);
                  } else {
                    playerRef.current.playVideo();
                    onToggleScroll(true);
                  }
                }
              }}
              className="btn-bauhaus btn-blue"
              style={{
                width: 'auto', 
                padding: '6px 12px', 
                fontSize: '0.75rem', 
                fontWeight: 'bold',
                boxShadow: 'none',
                textTransform: 'uppercase'
              }}
            >
              {isScrolling ? '⏸ PAUSA' : '▶ AVVIA'}
            </button>
          )}
          <button 
            onClick={() => setAutoScrollEnabled(!autoScrollEnabled)}
            className="btn-bauhaus"
            style={{
              width: 'auto', 
              padding: '6px 12px', 
              fontSize: '0.75rem', 
              fontWeight: 'bold',
              backgroundColor: autoScrollEnabled ? 'var(--bauhaus-yellow)' : 'transparent',
              color: autoScrollEnabled ? 'black' : 'var(--white)',
              border: '1px solid var(--white)',
              boxShadow: 'none',
              textTransform: 'uppercase'
            }}
          >
            {autoScrollEnabled ? 'AUTO-SCROLL ON' : 'AUTO-SCROLL OFF'}
          </button>
        </div>
      </div>

      {/* Embedded YouTube Backup Track Player */}
      <div style={{ marginBottom: '20px', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
        <div id="yt-player"></div>
        {/* If user is not Host/Admin, block touch interactions so they follow the host */}
        {!onToggleScroll && (
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 5,
            cursor: 'not-allowed'
          }}></div>
        )}
      </div>

      {/* Lyrics Body */}
      <div 
        ref={containerRef}
        style={{
          height: '45vh',
          maxHeight: '450px',
          overflowY: 'auto',
          padding: '0px',
          border: 'none',
          backgroundColor: 'transparent',
          color: 'var(--white)',
          scrollBehavior: 'smooth',
          position: 'relative'
        }}
      >
        {lines.map((line, idx) => {
          const isActive = idx === activeIndex;
          return (
            <div 
              key={idx}
              ref={isActive ? activeLineRef : null}
              style={{
                padding: '14px 12px',
                backgroundColor: isActive ? 'var(--bauhaus-yellow)' : 'transparent',
                color: isActive ? 'black' : 'var(--white)',
                transition: 'all 0.15s ease',
                borderLeft: isActive ? '6px solid var(--bauhaus-blue)' : 'none',
                marginBottom: '10px'
              }}
            >
              {renderParsedChordsAndLyrics(line.text, isActive)}
            </div>
          );
        })}
      </div>

      {/* Guitar Chord Info Floating Overlay Card (Compact and non-blocking) */}
      {activeChord && (() => {
        const cleanKey = getCleanChordKey(activeChord);
        const diag = CHORD_DIAGRAMS[cleanKey];
        return (
          <div style={{
            position: 'absolute',
            bottom: '10px',
            right: '10px',
            backgroundColor: '#000000',
            border: '2px solid var(--white)',
            padding: '14px',
            width: '160px',
            textAlign: 'center',
            zIndex: 99,
            boxShadow: '0px 4px 10px rgba(0,0,0,0.8)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--bauhaus-yellow)' }}>{activeChord.toUpperCase()}</span>
              <button 
                onClick={() => setActiveChord(null)} 
                style={{ background: 'none', border: 'none', color: 'var(--bauhaus-red)', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem' }}
              >
                ✕
              </button>
            </div>
            
            {diag ? (
              <svg viewBox="0 0 120 130" width="100" height="110" style={{ margin: '0 auto', display: 'block' }}>
                <line x1="20" y1="20" x2="100" y2="20" stroke="var(--white)" strokeWidth="3" />
                {[36, 52, 68, 84, 100, 116].map((y, fIdx) => (
                  <line key={fIdx} x1="20" y1={y} x2="100" y2={y} stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
                ))}
                {[1, 2, 3, 4, 5].map((f, fIdx) => (
                  <text key={fIdx} x="8" y={15 + fIdx * 16 + 13} fill="var(--charcoal)" fontSize="7" fontFamily="monospace">{f}</text>
                ))}
                {[20, 36, 52, 68, 84, 100].map((x, sIdx) => (
                  <line key={sIdx} x1={x} y1="20" x2={x} y2="116" stroke="var(--white)" strokeWidth={1} />
                ))}
                {[20, 36, 52, 68, 84, 100].map((x, sIdx) => {
                  const stringNum = sIdx + 1;
                  if (diag.muted?.includes(stringNum)) {
                    return <text key={sIdx} x={x - 2.5} y="12" fill="var(--bauhaus-red)" fontSize="8" fontWeight="bold">X</text>;
                  }
                  if (diag.open?.includes(stringNum)) {
                    return <circle key={sIdx} cx={x} cy="10" r="2" fill="none" stroke="var(--white)" strokeWidth="1" />;
                  }
                  return null;
                })}
                {diag.frets.map((f, dIdx) => {
                  const x = 20 + (f.s - 1) * 16;
                  const y = 20 + (f.f - 1) * 16 + 8;
                  return <circle key={dIdx} cx={x} cy={y} r="4.5" fill="var(--bauhaus-blue)" stroke="var(--white)" strokeWidth="1" />;
                })}
              </svg>
            ) : (
              <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>Non disponibile</span>
            )}
          </div>
        );
      })()}
    </div>
  );
}
