import React, { useState, useEffect, useRef, useCallback } from 'react';
import { mockDb } from './mockDb';
import { isSupabaseConfigured } from './supabaseClient';
import KaraokeLiveJam from './components/KaraokeLiveJam';

class KaraokeErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(err) { return { error: err }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '40px', background: '#1a0000', border: '2px solid red', color: 'red', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          <strong>ERRORE KARAOKE:</strong>{'\n\n'}{this.state.error.toString()}{'\n\n'}{this.state.error.stack}
          <br/><button onClick={() => this.setState({ error: null })} style={{ marginTop: '20px', padding: '8px 16px', cursor: 'pointer' }}>↩ Torna indietro</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Helper: Instrument icon badge
function InstrumentBadge({ instrument }) {
  if (!instrument) return null;
  const map = {
    'Chitarra': '🎸',
    'Voce': '🎤',
    'Percussioni': '🥁',
    'Tastiere': '🎹',
    'Altro': '🎶',
  };
  const emoji = map[instrument];
  if (!emoji) return null;
  return (
    <span
      title={instrument}
      style={{
        display: 'inline-block',
        marginLeft: '6px',
        fontSize: '0.95em',
        verticalAlign: 'middle',
        lineHeight: 1,
      }}
    >
      {emoji}
    </span>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [currentUser, setCurrentUser] = useState(null);
  
  // Data States
  const [proposals, setProposals] = useState([]);
  const [userVotes, setUserVotes] = useState([]);
  const [userReports, setUserReports] = useState([]);
  const [leaderboardSubTab, setLeaderboardSubTab] = useState('top20'); // 'top20' | 'new' | 'all'
  const [archiveSort, setArchiveSort] = useState('date'); // 'date' | 'alpha' | 'votes'
  const [filterInstrument, setFilterInstrument] = useState('all'); // 'all' | 'Chitarra' | 'Voce' | 'Percussioni' | 'Tastiere' | 'Altro' | 'none'
  
  // Search & Form States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [playerInstrument, setPlayerInstrument] = useState('Chitarra');
  const [willPlay, setWillPlay] = useState(false); // Checkbox: 'Suoni con noi?'
  
  // Audio Player State
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);

  const [selectedKaraokeSong, setSelectedKaraokeSong] = useState(null);

  // Authentication Dialog & Custom user registration
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customEmail, setCustomEmail] = useState('');

  // Feedbacks (Toast notification)
  const [toast, setToast] = useState(null);
  
  // Weekly limits & countdown states
  const [canProposeThisWeek, setCanProposeThisWeek] = useState(true);
  const [countdownToReset, setCountdownToReset] = useState('');

  // Refresh lists
  const refreshData = useCallback(async () => {
    const sorted = await mockDb.getSortedProposals();
    setProposals(sorted);
    if (currentUser) {
      const votes = await mockDb.getUserVotes(currentUser);
      const reports = await mockDb.getUserReports(currentUser);
      setUserVotes(votes);
      setUserReports(reports);
    }
  }, [currentUser]);

  // Sync Auth User on Mount
  useEffect(() => {
    const initAuth = async () => {
      const user = await mockDb.getCurrentUser();
      if (user) {
        setCurrentUser(user);
      }
      const sorted = await mockDb.getSortedProposals();
      setProposals(sorted);
    };
    initAuth();
  }, []);

  // Sync Votes/Reports when user changes
  useEffect(() => {
    refreshData();
  }, [currentUser, refreshData]);

  // Monitor user's weekly proposals and run countdown timer
  useEffect(() => {
    const updateCountdownAndProposalLimit = () => {
      // 1. Check weekly limit
      if (!currentUser) {
        setCanProposeThisWeek(false);
        setCountdownToReset("ACCEDI PER PROPORRE");
        return;
      }
      
      const now = new Date();
      // Get last Monday 00:00 UTC
      const day = now.getUTCDay();
      const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1);
      const lastMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), diff, 0, 0, 0, 0));

      const userProposals = proposals.filter(p => p.proposed_by === currentUser.id);
      const proposedThisWeek = userProposals.some(p => new Date(p.proposed_at) >= lastMonday);
      
      setCanProposeThisWeek(!proposedThisWeek);

      // 2. Calculate countdown to next Monday 00:00 UTC
      const nextMonday = new Date(lastMonday.getTime() + 7 * 24 * 60 * 60 * 1000);
      const timeLeft = nextMonday - now;

      if (timeLeft <= 0) {
        setCountdownToReset('0g 0o 0m');
      } else {
        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        setCountdownToReset(`${days}g ${hours}o ${minutes}m`);
      }
    };

    updateCountdownAndProposalLimit();
    const interval = setInterval(updateCountdownAndProposalLimit, 30000); // update every 30 seconds
    return () => clearInterval(interval);
  }, [currentUser, proposals]);

  // Toast Helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Debounced search trigger directly inside Synced Lyrics Database
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const results = await mockDb.searchSyncedLyrics(searchQuery);
        setSearchResults(results);
      } catch (err) {
        console.error("Search error: ", err);
      } finally {
        setIsSearching(false);
      }
    }, 450);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Auth: Login
  const handleLogin = async (userId) => {
    const user = await mockDb.login(userId);
    if (user) {
      setCurrentUser(user);
      setShowAuthModal(false);
      showToast(`UTENTE ${user.display_name.toUpperCase()} ACCEDUTO`, 'success');
    }
  };

  // Auth: Register Custom Guest
  const handleRegisterCustom = (e) => {
    e.preventDefault();
    if (!customName.trim() || !customEmail.trim()) {
      showToast("COMPILA TUTTI I CAMPI", "error");
      return;
    }
    try {
      const user = mockDb.registerCustomUser(customName, customEmail);
      setCurrentUser(user);
      setShowAuthModal(false);
      setCustomName('');
      setCustomEmail('');
      showToast(`PROFILO CREATO: ${user.display_name.toUpperCase()}`, 'success');
    } catch (err) {
      showToast(err.message.toUpperCase(), "error");
    }
  };

  // Auth: Logout
  const handleLogout = async () => {
    await mockDb.logout();
    setCurrentUser(null);
    setUserVotes([]);
    setUserReports([]);
    setPlayingId(null);
    if (audioRef.current) audioRef.current.pause();
    setActiveTab('home');
    showToast("DISCONNESSO", "success");
  };

  // Music: Toggle preview play/pause
  const togglePlay = (id, previewUrl) => {
    if (!previewUrl) {
      showToast("ANTEPRIMA AUDIO NON DISPONIBILE", "error");
      return;
    }

    if (playingId === id) {
      audioRef.current.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(previewUrl);
      audioRef.current.volume = 0.4;
      audioRef.current.play().catch(e => console.warn("Audio play blocked", e));
      setPlayingId(id);
      
      audioRef.current.onended = () => {
        setPlayingId(null);
      };
    }
  };

  // Action: Vote
  const handleVote = async (proposalId) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    try {
      const res = await mockDb.toggleVote(proposalId, currentUser);
      await refreshData();
      if (res.voted) {
        showToast("VOTO REGISTRATO");
      } else {
        showToast("VOTO RIMOSSO");
      }
    } catch (err) {
      showToast(err.message.toUpperCase(), "error");
    }
  };

  // Action: Report/Flag acoustic compatibility
  const handleReport = async (proposalId) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    if (window.confirm("CONFERMI LA SEGNALAZIONE COME NON ACUSTICO?")) {
      try {
        await mockDb.reportSong(proposalId, currentUser);
        await refreshData();
        showToast("SEGNALAZIONE INVIATA", "success");
      } catch (err) {
        showToast(err.message.toUpperCase(), "error");
      }
    }
  };

  // Action: Propose Song
  const handlePropose = async (e) => {
    e.preventDefault();
    if (!selectedTrack) return;
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    try {
      const songData = {
        ...selectedTrack,
        player_name: willPlay ? currentUser.display_name : "",
        player_instrument: willPlay ? playerInstrument : ""
      };

      await mockDb.proposeSong(songData, currentUser);
      await refreshData();
      setSelectedTrack(null);
      setSearchQuery('');
      setPlayerName('');
      setWillPlay(false);
      setActiveTab('home');
      showToast("PROPOSTA INVIATA CON SUCCESSO", "success");
    } catch (err) {
      showToast(err.message.toUpperCase(), "error");
    }
  };

  // Admin Action: Approve (Remove flags)
  const handleAdminApprove = async (proposalId) => {
    await mockDb.adminApproveSong(proposalId);
    await refreshData();
    showToast("BRANO APPROVATO E CONFERMATO", "success");
  };

  // Admin Action: Delete Song
  const handleAdminDelete = async (proposalId) => {
    if (window.confirm("ELIMINARE DEFINITIVAMENTE QUESTA CANZONE?")) {
      await mockDb.adminDeleteSong(proposalId);
      await refreshData();
      showToast("CANZONE RAGGIUNTA ED ELIMINATA", "success");
    }
  };

  // Debug Helper: Travel time to next week
  const handleDebugFastForward = () => {
    mockDb.debugFastForwardWeek();
    refreshData();
    showToast("SIMULAZIONE RESET COMPLETATA", "success");
  };

  return (
    <div className="app-container">
      {/* Toast Alert */}
      {toast && (
        <div className={`toast-bauhaus ${toast.type === 'error' ? 'error' : ''}`}>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main App Layout */}
      {activeTab === 'home' ? (
        /* 1. INTRO / HOMEPAGE GATE (ONLY exactly what is requested on first view) */
        <div>
          {/* Item 1: Auth/Login Status */}
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.2)', marginBottom: '30px'}}>
            {currentUser ? (
              <>
                <div>
                  <div style={{fontWeight: '700', textTransform: 'uppercase', fontSize: '0.9rem'}}>{currentUser.display_name}</div>
                  <div style={{fontSize: '0.75rem', opacity: 0.6}}>{currentUser.email}</div>
                </div>
                <button onClick={handleLogout} className="btn-bauhaus btn-red" style={{width: 'auto', padding: '8px 12px', fontSize: '0.8rem', boxShadow: 'none'}}>
                  ESCI
                </button>
              </>
            ) : (
              <>
                <span style={{fontWeight: '700', fontSize: '0.85rem'}}>ACCEDI PER VOTARE E PROPORRE BRANI</span>
                <button onClick={() => setShowAuthModal(true)} className="btn-bauhaus btn-blue" style={{width: 'auto', padding: '8px 16px', fontSize: '0.85rem', boxShadow: 'none'}}>
                  ACCEDI
                </button>
              </>
            )}
          </div>

          {/* Item 2: Title of the Event (No Longobardi) */}
          <header style={{marginBottom: '10px'}}>
            <h1>UNPLUGGED</h1>
          </header>

          {/* Item 3: Phase and Countdown */}
          <div style={{display: 'inline-block', border: '1px solid white', padding: '6px 12px', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.8rem', marginBottom: '20px'}}>
            Fase: Settimana 1 di 4 | Countdown: 28 giorni alla Jam
          </div>

          {/* Item 4: Asymmetric Bauhaus Space */}
          <div style={{marginBottom: '90px'}}></div>

          {/* Item 5: Regulation & CTA button to Leaderboard */}
          <div style={{borderTop: '1px solid var(--white)', paddingTop: '24px'}}>
            <h2 style={{marginBottom: '12px'}}>REGOLAMENTO</h2>
            <div style={{display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '30px'}}>
              <p style={{fontSize: '0.95rem'}}>
                <strong>1. PROPONI:</strong> Accedi per suggerire una canzone a settimana fino alla scadenza delle votazioni.
              </p>
              <p style={{fontSize: '0.95rem'}}>
                <strong>2. VOTA:</strong> Vota i brani che preferisci. Le 20 canzoni più votate diventeranno la scaletta ufficiale.
              </p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
              {currentUser ? (
                canProposeThisWeek ? (
                  <button
                    onClick={() => setActiveTab('propose')}
                    className="btn-bauhaus btn-yellow"
                    style={{ fontSize: '1rem', letterSpacing: '0.05em', width: '100%', fontWeight: '900' }}
                  >
                    PROPONI IL BRANO DELLA SETTIMANA
                  </button>
                ) : (
                  <button
                    disabled
                    className="btn-bauhaus"
                    style={{ fontSize: '0.95rem', letterSpacing: '0.05em', width: '100%', backgroundColor: '#2a2a2a', color: '#666', border: '1px solid #333', cursor: 'not-allowed', boxShadow: 'none' }}
                  >
                    PROSSIMA PROPOSTA TRA: {countdownToReset}
                  </button>
                )
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="btn-bauhaus"
                  style={{ fontSize: '0.95rem', letterSpacing: '0.05em', width: '100%', backgroundColor: '#2a2a2a', color: '#888', border: '1px solid #333', boxShadow: 'none' }}
                >
                  ACCEDI PER PROPORRE IL BRANO
                </button>
              )}

              <button 
                onClick={() => setActiveTab('leaderboard')} 
                className="btn-bauhaus btn-blue"
                style={{ fontSize: '1rem', letterSpacing: '0.05em', width: '100%' }}
              >
                VAI ALLA CLASSIFICA →
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* 2. INNER APPLICATION (Leaderboard, Propose, Admin panels) */
        <div>
          {/* Navigation Bar when inside */}
          <div className="tabs-bauhaus">
            <button 
              className="tab-btn-bauhaus" 
              onClick={() => setActiveTab('home')}
              style={{borderRight: '1px solid var(--white)', opacity: 0.6}}
            >
              ← HOME
            </button>
            <button 
              className={`tab-btn-bauhaus ${activeTab === 'leaderboard' ? 'active' : ''}`} 
              onClick={() => setActiveTab('leaderboard')}
            >
              Classifica
            </button>
            <button 
              className={`tab-btn-bauhaus ${activeTab === 'propose' ? 'active' : ''}`} 
              onClick={() => setActiveTab('propose')}
            >
              Proponi
            </button>
            {currentUser && currentUser.is_admin && (
              <button 
                className={`tab-btn-bauhaus ${activeTab === 'admin' ? 'active' : ''}`} 
                onClick={() => setActiveTab('admin')}
              >
                Moderazione
              </button>
            )}
          </div>

          <main>
            {/* TAB: LEADERBOARD */}
            {activeTab === 'leaderboard' && (
              <div>
                {/* Sub-Tabs Toggle (Three sections) */}
                <div style={{display: 'flex', borderBottom: '1px solid var(--white)', marginBottom: '20px'}}>
                  <button 
                    onClick={() => setLeaderboardSubTab('top20')} 
                    style={{
                      flex: 1, 
                      background: 'none', 
                      border: 'none', 
                      color: leaderboardSubTab === 'top20' ? 'var(--white)' : 'var(--charcoal)', 
                      padding: '10px', 
                      fontWeight: '700', 
                      fontSize: '0.8rem',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      borderBottom: leaderboardSubTab === 'top20' ? '3px solid var(--white)' : 'none',
                      marginBottom: '-1px'
                    }}
                  >
                    Scaletta
                  </button>
                  <button 
                    onClick={() => setLeaderboardSubTab('new')} 
                    style={{
                      flex: 1, 
                      background: 'none', 
                      border: 'none', 
                      color: leaderboardSubTab === 'new' ? 'var(--white)' : 'var(--charcoal)', 
                      padding: '10px', 
                      fontWeight: '700', 
                      fontSize: '0.8rem',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      borderBottom: leaderboardSubTab === 'new' ? '3px solid var(--white)' : 'none',
                      marginBottom: '-1px'
                    }}
                  >
                    New Entry
                  </button>
                  <button 
                    onClick={() => setLeaderboardSubTab('all')} 
                    style={{
                      flex: 1, 
                      background: 'none', 
                      border: 'none', 
                      color: leaderboardSubTab === 'all' ? 'var(--white)' : 'var(--charcoal)', 
                      padding: '10px', 
                      fontWeight: '700', 
                      fontSize: '0.8rem',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      borderBottom: leaderboardSubTab === 'all' ? '3px solid var(--white)' : 'none',
                      marginBottom: '-1px'
                    }}
                  >
                    Tutte le Proposte
                  </button>
                </div>

                {/* Sub-Tab 1: SCALETTA (TOP 20) */}
                {leaderboardSubTab === 'top20' && (
                  <div>
                    <h2 style={{marginBottom: '16px', fontSize: '1.3rem'}}>SCALETTA UFFICIALE (TOP 20)</h2>
                    <div>
                      {proposals.length === 0 ? (
                        <div style={{textAlign: 'center', padding: '40px 0'}}>
                          <p>NESSUN BRANO IN CLASSIFICA.</p>
                        </div>
                      ) : (
                        proposals.slice(0, 20).map((song, index) => {
                          const isVoted = userVotes.includes(song.id);
                          const isReported = userReports.includes(song.id);
                          const isPlaying = playingId === song.id;

                          let rankClass = "";
                          if (index === 0) rankClass = "row-top-1";
                          else if (index === 1) rankClass = "row-top-2";
                          else if (index === 2) rankClass = "row-top-3";

                          return (
                            <div
                              key={song.id}
                              className={`row-item ${rankClass}`}
                              style={{ opacity: song.under_review ? 0.6 : 1 }}
                            >
                              {/* Rank number */}
                              <div className="row-num">{index + 1}</div>

                              {/* Cover + Play/Stop button stacked */}
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                <img
                                  src={song.cover_url}
                                  alt={song.title}
                                  className="flat-cover"
                                  style={{ display: 'block' }}
                                />
                                {song.preview_url && (
                                  <button
                                    onClick={() => togglePlay(song.id, song.preview_url)}
                                    className="row-btn-action"
                                    style={{ fontSize: '0.65rem', padding: '2px 6px', width: '100%', textAlign: 'center' }}
                                  >
                                    {isPlaying ? '■ STOP' : '▶ PLAY'}
                                  </button>
                                )}
                              </div>

                              {/* Info block */}
                              <div className="row-info" style={{ flex: 1, minWidth: 0 }}>
                                <div className="row-title" style={{ whiteSpace: 'normal', overflow: 'visible' }}>
                                  {song.title}
                                </div>
                                <div className="row-subtitle">{song.artist}</div>
                                <div style={{ fontSize: '0.72rem', fontWeight: '700', marginTop: '3px', opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center' }}>
                                  PROP. DA {song.proposed_by_name.toUpperCase()}
                                  {song.player_instrument && <InstrumentBadge instrument={song.player_instrument} />}
                                </div>
                              </div>

                              {/* Compact actions: vote + report + pratica */}
                              <div className="row-actions" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                                <button onClick={() => handleVote(song.id)} className={`row-btn-vote ${isVoted ? 'voted' : ''}`}>
                                  {isVoted ? '♥' : 'VOTA'}
                                </button>
                                <span style={{ fontSize: '0.8rem', fontWeight: '900' }}>
                                  {song.votes_count}
                                </span>
                                
                                <button
                                  onClick={() => {
                                    setSelectedKaraokeSong(song);
                                    setActiveTab('karaoke');
                                  }}
                                  className="btn-bauhaus btn-blue"
                                  style={{ width: 'auto', padding: '3px 8px', fontSize: '0.65rem', fontWeight: 'bold', boxShadow: 'none', marginTop: '2px', textTransform: 'uppercase' }}
                                >
                                  🎤 Pratica
                                </button>

                                {!currentUser?.is_admin && (
                                  <button
                                    onClick={() => handleReport(song.id)}
                                    className="row-btn-action"
                                    style={{ color: isReported ? 'var(--bauhaus-red)' : 'inherit', fontSize: '0.7rem', padding: '2px 5px', marginTop: '1px' }}
                                    disabled={isReported}
                                    title="Segnala come non acustico"
                                  >
                                    [!]
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Sub-Tab 2: NEW ENTRY THIS WEEK */}
                {leaderboardSubTab === 'new' && (() => {
                  // Get last Monday 00:00 UTC
                  const d = new Date();
                  const day = d.getUTCDay();
                  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
                  const lastMonday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff, 0, 0, 0, 0));

                  const newEntries = proposals.filter(song => new Date(song.proposed_at) >= lastMonday);

                  return (
                    <div>
                      <h2 style={{marginBottom: '16px', fontSize: '1.3rem'}}>NEW ENTRY DI QUESTA SETTIMANA</h2>
                      <p style={{fontSize: '0.85rem', color: 'var(--charcoal)', marginBottom: '20px'}}>
                        Brani proposti a partire da Lunedì scorso. Votali per farli salire in classifica!
                      </p>
                      <div>
                        {newEntries.length === 0 ? (
                          <div style={{textAlign: 'center', padding: '40px 0'}}>
                            <p>NESSUN NUOVO BRANO PROPOSTO IN QUESTA SETTIMANA.</p>
                          </div>
                        ) : (
                          newEntries.map((song) => {
                            const isVoted = userVotes.includes(song.id);
                            const isReported = userReports.includes(song.id);
                            const isPlaying = playingId === song.id;

                            return (
                              <div
                                key={song.id}
                                className="row-item"
                                style={{ opacity: song.under_review ? 0.6 : 1 }}
                              >
                                {/* Cover + Play/Stop stacked */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                  <img
                                    src={song.cover_url}
                                    alt={song.title}
                                    className="flat-cover"
                                    style={{ display: 'block' }}
                                  />
                                  {song.preview_url && (
                                    <button
                                      onClick={() => togglePlay(song.id, song.preview_url)}
                                      className="row-btn-action"
                                      style={{ fontSize: '0.65rem', padding: '2px 6px', width: '100%', textAlign: 'center' }}
                                    >
                                      {isPlaying ? '■ STOP' : '▶ PLAY'}
                                    </button>
                                  )}
                                </div>

                                {/* Info block */}
                                <div className="row-info" style={{ flex: 1, minWidth: 0 }}>
                                  <div className="row-title" style={{ whiteSpace: 'normal', overflow: 'visible' }}>
                                    {song.title}
                                  </div>
                                  <div className="row-subtitle">{song.artist}</div>
                                  <div style={{ fontSize: '0.72rem', fontWeight: '700', marginTop: '3px', opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center' }}>
                                    PROP. DA {song.proposed_by_name.toUpperCase()}
                                    {song.player_instrument && <InstrumentBadge instrument={song.player_instrument} />}
                                  </div>
                                </div>

                                {/* Compact actions */}
                                <div className="row-actions" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                  <button onClick={() => handleVote(song.id)} className={`row-btn-vote ${isVoted ? 'voted' : ''}`}>
                                    {isVoted ? '♥' : 'VOTA'}
                                  </button>
                                  <span style={{ fontSize: '0.8rem', fontWeight: '900' }}>
                                    {song.votes_count}
                                  </span>
                                  {!currentUser?.is_admin && (
                                    <button
                                      onClick={() => handleReport(song.id)}
                                      className="row-btn-action"
                                      style={{ color: isReported ? 'var(--bauhaus-red)' : 'inherit', fontSize: '0.7rem', padding: '2px 5px', marginTop: '2px' }}
                                      disabled={isReported}
                                      title="Segnala come non acustico"
                                    >
                                      [!]
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Sub-Tab 3: TUTTE LE PROPOSTE (ARCHIVE + FILTERING) */}
                {leaderboardSubTab === 'all' && (
                  <div>
                    {/* Controls row: Sorting and Instrument Filter */}
                    <div style={{
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '12px', 
                      borderBottom: '1px solid rgba(255, 255, 255, 0.2)', 
                      paddingBottom: '16px', 
                      marginBottom: '20px'
                    }}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <h2 style={{fontSize: '1.3rem', margin: 0}}>TUTTE LE PROPOSTE</h2>
                        
                        {/* Sorting Selection */}
                        <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                          <span style={{fontSize: '0.7rem', fontWeight: '700', color: 'var(--charcoal)', textTransform: 'uppercase'}}>ORDINA:</span>
                          <select 
                            value={archiveSort} 
                            onChange={(e) => setArchiveSort(e.target.value)}
                            style={{
                              backgroundColor: 'transparent',
                              color: 'var(--white)',
                              border: '1px solid var(--white)',
                              padding: '4px 8px',
                              fontFamily: 'inherit',
                              fontSize: '0.8rem',
                              fontWeight: '700',
                              textTransform: 'uppercase',
                              outline: 'none'
                            }}
                          >
                            <option value="date" style={{backgroundColor: 'black'}}>INSERIMENTO</option>
                            <option value="alpha" style={{backgroundColor: 'black'}}>ALFABETICO A-Z</option>
                            <option value="votes" style={{backgroundColor: 'black'}}>VOTI</option>
                          </select>
                        </div>
                      </div>

                      {/* Instrument Filter Selection */}
                      <div style={{display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-start'}}>
                        <span style={{fontSize: '0.7rem', fontWeight: '700', color: 'var(--charcoal)', textTransform: 'uppercase'}}>STRUMENTO:</span>
                        <select 
                          value={filterInstrument} 
                          onChange={(e) => setFilterInstrument(e.target.value)}
                          style={{
                            backgroundColor: 'transparent',
                            color: 'var(--white)',
                            border: '1px solid var(--white)',
                            padding: '4px 8px',
                            fontFamily: 'inherit',
                            fontSize: '0.8rem',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            outline: 'none'
                          }}
                        >
                          <option value="all" style={{backgroundColor: 'black'}}>TUTTI</option>
                          <option value="Chitarra" style={{backgroundColor: 'black'}}>🎸 CHITARRA</option>
                          <option value="Voce" style={{backgroundColor: 'black'}}>🎤 SOLO VOCE</option>
                          <option value="Percussioni" style={{backgroundColor: 'black'}}>🥁 PERCUSSIONI</option>
                          <option value="Tastiere" style={{backgroundColor: 'black'}}>🎹 UKULELE/FIATI</option>
                          <option value="Altro" style={{backgroundColor: 'black'}}>🎶 ALTRO ACC.</option>
                          <option value="none" style={{backgroundColor: 'black'}}>❌ NESSUN ACCOMPAGNATORE</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      {(() => {
                        // Apply instrument filter
                        let filtered = proposals;
                        if (filterInstrument !== 'all') {
                          if (filterInstrument === 'none') {
                            filtered = proposals.filter(song => !song.player_name);
                          } else {
                            filtered = proposals.filter(song => song.player_instrument === filterInstrument);
                          }
                        }

                        // Apply sort
                        const sorted = [...filtered].sort((a, b) => {
                          if (archiveSort === 'alpha') {
                            return a.title.localeCompare(b.title);
                          } else if (archiveSort === 'date') {
                            return new Date(b.proposed_at) - new Date(a.proposed_at);
                          } else if (archiveSort === 'votes') {
                            return b.votes_count - a.votes_count;
                          }
                          return 0;
                        });

                        if (sorted.length === 0) {
                          return (
                            <div style={{textAlign: 'center', padding: '40px 0'}}>
                              <p>NESSUN RISULTATO CORRISPONDE AL FILTRO SELEZIONATO.</p>
                            </div>
                          );
                        }

                        return sorted.map((song) => {
                          const isVoted = userVotes.includes(song.id);
                          const isReported = userReports.includes(song.id);
                          const isPlaying = playingId === song.id;

                          return (
                            <div 
                              key={song.id} 
                              className="row-item"
                              style={{ opacity: song.under_review ? 0.6 : 1 }}
                            >
                              {/* Cover + Play/Stop stacked */}
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                <img
                                  src={song.cover_url}
                                  alt={song.title}
                                  className="flat-cover"
                                  style={{ display: 'block' }}
                                />
                                {song.preview_url && (
                                  <button
                                    onClick={() => togglePlay(song.id, song.preview_url)}
                                    className="row-btn-action"
                                    style={{ fontSize: '0.65rem', padding: '2px 6px', width: '100%', textAlign: 'center' }}
                                  >
                                    {isPlaying ? '■ STOP' : '▶ PLAY'}
                                  </button>
                                )}
                              </div>

                              {/* Info block */}
                              <div className="row-info" style={{ flex: 1, minWidth: 0 }}>
                                <div className="row-title" style={{ whiteSpace: 'normal', overflow: 'visible' }}>
                                  {song.title}
                                </div>
                                <div className="row-subtitle">{song.artist}</div>
                                <div style={{ fontSize: '0.72rem', fontWeight: '700', marginTop: '3px', opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center' }}>
                                  PROP. DA {song.proposed_by_name.toUpperCase()}
                                  {song.player_instrument && <InstrumentBadge instrument={song.player_instrument} />}
                                </div>
                              </div>

                              {/* Compact actions: vote + report + pratica */}
                              <div className="row-actions" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                                <button onClick={() => handleVote(song.id)} className={`row-btn-vote ${isVoted ? 'voted' : ''}`}>
                                  {isVoted ? '♥' : 'VOTA'}
                                </button>
                                <span style={{ fontSize: '0.8rem', fontWeight: '900' }}>
                                  {song.votes_count}
                                </span>
                                
                                <button
                                  onClick={() => {
                                    setSelectedKaraokeSong(song);
                                    setActiveTab('karaoke');
                                  }}
                                  className="btn-bauhaus btn-blue"
                                  style={{ width: 'auto', padding: '3px 8px', fontSize: '0.65rem', fontWeight: 'bold', boxShadow: 'none', marginTop: '2px', textTransform: 'uppercase' }}
                                >
                                  🎤 Pratica
                                </button>

                                {!currentUser?.is_admin && (
                                  <button
                                    onClick={() => handleReport(song.id)}
                                    className="row-btn-action"
                                    style={{ color: isReported ? 'var(--bauhaus-red)' : 'inherit', fontSize: '0.7rem', padding: '2px 5px', marginTop: '1px' }}
                                    disabled={isReported}
                                    title="Segnala come non acustico"
                                  >
                                    [!]
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}

        {/* TAB 2: PROPOSAL FORM */}
        {activeTab === 'propose' && (
          <div>
            <div style={{borderBottom: '1px solid var(--white)', paddingBottom: '16px', marginBottom: '24px'}}>
              <h2>PROPONI UN BRANO</h2>
              <p style={{marginTop: '6px', fontSize: '0.95rem'}}>
                Verifica che il pezzo sia facilmente eseguibile in spiaggia con chitarra, voce e percussioni. Evita pezzi sintetici.
              </p>
            </div>

            {selectedTrack ? (
              /* Submission details form */
              <div style={{paddingTop: '10px'}}>
                <h3 style={{marginBottom: '16px'}}>Dettagli Esecuzione</h3>
                    <div style={{display: 'flex', gap: '12px', borderBottom: '1px solid var(--white)', paddingBottom: '12px', marginBottom: '20px'}}>
                  <img src={selectedTrack.cover_url} alt={selectedTrack.title} className="flat-cover" style={{width: '60px', height: '60px'}} />
                  <div>
                    <div style={{fontWeight: '900', textTransform: 'uppercase'}}>{selectedTrack.title}</div>
                    <div style={{fontSize: '0.85rem', opacity: 0.8}}>{selectedTrack.artist}</div>
                  </div>
                </div>

                <form onSubmit={handlePropose}>
                  <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setWillPlay(!willPlay)}>
                    <input 
                      type="checkbox" 
                      id="willPlayCheck"
                      checked={willPlay}
                      onChange={(e) => setWillPlay(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label htmlFor="willPlayCheck" style={{ fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer', textTransform: 'uppercase' }}>
                      Suoni con noi?
                    </label>
                  </div>

                  {willPlay && (
                    <div style={{ marginBottom: '20px' }}>
                      <label className="bauhaus-label">Strumento musicale</label>
                      <select 
                        value={playerInstrument} 
                        onChange={(e) => setPlayerInstrument(e.target.value)}
                        className="bauhaus-input"
                      >
                        <option value="Chitarra">CHITARRA ACUSTICA</option>
                        <option value="Voce">VOCE / CORISTA</option>
                        <option value="Percussioni">PERCUSSIONI / RITMO</option>
                        <option value="Tastiere">FIATI / ARCHI / STRUM. LEGGERI</option>
                        <option value="Altro">ACCOMPAGNAMENTO GENERICO</option>
                      </select>
                    </div>
                  )}

                  <div style={{display: 'flex', gap: '12px'}}>
                    <button type="button" onClick={() => setSelectedTrack(null)} className="btn-bauhaus" style={{flex: 1}}>
                      CAMBIA
                    </button>
                    <button type="submit" className="btn-bauhaus btn-blue" style={{flex: 1}}>
                      CONFERMA
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* Search query */
              <div style={{paddingTop: '10px'}}>
                <div style={{marginBottom: '16px'}}>
                  <label className="bauhaus-label">Ricerca brano con testo sincronizzato</label>
                  <input 
                    type="text" 
                    placeholder="DIGITA TITOLO O ARTISTA..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bauhaus-input"
                  />
                </div>

                {isSearching && (
                  <div style={{padding: '12px', fontWeight: 'bold', textTransform: 'uppercase'}}>
                    Ricerca in database testi...
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div className="search-results-list">
                    {searchResults.map((track) => (
                      <div 
                        key={track.deezer_id} 
                        className="search-results-item"
                        onClick={async () => {
                          showToast("Caricamento metadati audio...");
                          const meta = await mockDb.resolveDeezerMetadata(track.title, track.artist);
                          if (meta) {
                            setSelectedTrack({
                              ...track,
                              cover_url: meta.cover_url,
                              preview_url: meta.preview_url
                            });
                          } else {
                            setSelectedTrack(track);
                          }
                        }}
                      >
                        <strong>{track.title.toUpperCase()}</strong> - {track.artist.toUpperCase()}
                      </div>
                    ))}
                  </div>
                )}

                {searchQuery && !isSearching && searchResults.length === 0 && (
                  <div style={{padding: '12px', opacity: 0.6, fontSize: '0.9rem'}}>
                    NESSUN RISULTATO TROVATO.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB: KARAOKE LIVE */}
        {activeTab === 'karaoke' && (
          selectedKaraokeSong ? (
            <KaraokeErrorBoundary>
              <KaraokeLiveJam 
                song={selectedKaraokeSong} 
                isHost={true} 
                onClose={() => {
                  setSelectedKaraokeSong(null);
                  setActiveTab('leaderboard');
                }}
              />
            </KaraokeErrorBoundary>
          ) : (
            <div>
              <div style={{borderBottom: '1px solid var(--white)', paddingBottom: '16px', marginBottom: '24px'}}>
                <h2>KARAOKE LIVE IN CLASSIFICA</h2>
                <p style={{marginTop: '6px', fontSize: '0.9rem'}}>
                  Seleziona uno dei brani votati nella classifica per caricarne automaticamente il file .kar e riprodurlo.
                </p>
              </div>
              <div>
                {proposals.length === 0 ? (
                  <div style={{textAlign: 'center', padding: '40px 0', border: '1px dashed var(--white)'}}>
                    <p style={{fontWeight: 'bold'}}>NESSUNA CANZONE DISPONIBILE NELLA SCALETTA.</p>
                  </div>
                ) : (
                  <div>
                    {proposals.map((song, index) => (
                      <div 
                        key={song.id} 
                        className="row-item"
                        style={{cursor: 'pointer'}}
                        onClick={() => setSelectedKaraokeSong(song)}
                      >
                        <div className="row-num">{index + 1}</div>
                        <img src={song.cover_url} alt={song.title} className="flat-cover" />
                        <div className="row-info">
                          <div className="row-title" style={{textTransform: 'uppercase'}}>{song.title}</div>
                          <div className="row-subtitle">{song.artist} | VOTI: {song.votes_count}</div>
                        </div>
                        <div className="row-actions">
                          <button 
                            className="btn-bauhaus btn-blue"
                            style={{width: 'auto', padding: '6px 12px', fontSize: '0.75rem', boxShadow: 'none'}}
                          >
                            AVVIA KARAOKE 🎤
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        )}


        {/* TAB 3: ADMIN/MODERATION */}
        {activeTab === 'admin' && currentUser?.is_admin && (
          <div>
            <div style={{borderBottom: '1px solid var(--white)', paddingBottom: '16px', marginBottom: '24px'}}>
              <h2>MODERAZIONE</h2>
              <p style={{marginTop: '6px'}}>Rassegna dei brani segnalati come non adatti.</p>
            </div>

            <div style={{ marginBottom: '24px', padding: '16px', border: '1px dashed var(--white)' }}>
              <h3 style={{ fontSize: '0.95rem', marginBottom: '8px', fontWeight: 'bold' }}>STRUMENTI DI DEBUG</h3>
              <button 
                onClick={handleDebugFastForward} 
                className="btn-bauhaus btn-yellow" 
                style={{ fontSize: '0.85rem', width: 'auto', padding: '8px 16px', boxShadow: 'none' }}
              >
                AVANZA TEMPO DI 1 SETTIMANA (SIMULAZIONE RESET)
              </button>
            </div>

            <div>
              {proposals.filter(p => p.under_review).length === 0 ? (
                <div style={{textAlign: 'center', padding: '40px 0'}}>
                  <p>NESSUN BRANO SOTTO REVISIONE.</p>
                </div>
              ) : (
                proposals.filter(p => p.under_review).map((song) => (
                  <div key={song.id} className="row-item" style={{borderLeft: '8px solid var(--bauhaus-red)'}}>
                    <div className="row-info">
                      <div className="row-title">{song.title}</div>
                      <div className="row-subtitle">
                        {song.artist} | SEGNALAZIONI: {song.review_count}
                      </div>
                    </div>

                    <div style={{display: 'flex', gap: '8px'}}>
                      <button 
                        onClick={() => handleAdminApprove(song.id)}
                        className="btn-bauhaus btn-blue"
                        style={{padding: '6px 12px', fontSize: '0.8rem', boxShadow: 'none'}}
                      >
                        CONVALIDA
                      </button>
                      <button 
                        onClick={() => handleAdminDelete(song.id)}
                        className="btn-bauhaus btn-red"
                        style={{padding: '6px 12px', fontSize: '0.8rem', boxShadow: 'none'}}
                      >
                        ELIMINA
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )}

      {/* LOGIN MODAL OVERLAY */}
      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="modal-bauhaus" onClick={(e) => e.stopPropagation()}>
            <h3 style={{marginBottom: '16px', borderBottom: '1px solid var(--white)', paddingBottom: '8px'}}>ACCEDI AL PROFILO</h3>
            
            {isSupabaseConfigured() ? (
              <div style={{marginBottom: '20px'}}>
                <p style={{fontSize: '0.9rem', marginBottom: '16px', color: 'var(--charcoal)', textTransform: 'uppercase'}}>
                  ACCEDI CON IL TUO ACCOUNT GOOGLE UFFICIALE:
                </p>
                <button onClick={() => handleLogin()} className="btn-bauhaus btn-blue">
                  ACCEDI CON GOOGLE
                </button>
              </div>
            ) : (
              <>
                <div style={{display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px'}}>
                  <p style={{fontSize: '0.8rem', marginBottom: '8px', fontWeight: 'bold'}}>UTILIZZA ACCOUNT DI TEST RAPIDO:</p>
                  <button onClick={() => handleLogin('u1')} className="btn-bauhaus" style={{textAlign: 'left', display: 'block'}}>
                    PAOLO ROSSI (UTENTE)
                  </button>
                  <button onClick={() => handleLogin('u2')} className="btn-bauhaus" style={{textAlign: 'left', display: 'block'}}>
                    GIULIA BIANCHI (UTENTE)
                  </button>
                  <button onClick={() => handleLogin('u3')} className="btn-bauhaus btn-blue" style={{textAlign: 'left', display: 'block'}}>
                    ORGANIZZATORE (ADMIN)
                  </button>
                </div>

                <div style={{borderTop: '1px solid var(--white)', paddingTop: '16px'}}>
                  <h4 style={{fontSize: '0.85rem', marginBottom: '12px', fontWeight: '900'}}>REGISTRA NUOVO OAUTH (MOCK):</h4>
                  <form onSubmit={handleRegisterCustom}>
                    <div style={{marginBottom: '10px'}}>
                      <input 
                        type="text" 
                        placeholder="NOME COMPLETO" 
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        className="bauhaus-input"
                        required
                      />
                    </div>
                    <div style={{marginBottom: '16px'}}>
                      <input 
                        type="email" 
                        placeholder="EMAIL" 
                        value={customEmail}
                        onChange={(e) => setCustomEmail(e.target.value)}
                        className="bauhaus-input"
                        required
                      />
                    </div>
                    <button type="submit" className="btn-bauhaus btn-blue">
                      ACCEDI CON GOOGLE
                    </button>
                  </form>
                </div>
              </>
            )}
            
            <button 
              onClick={() => setShowAuthModal(false)} 
              className="btn-bauhaus btn-red"
              style={{marginTop: '16px', boxShadow: 'none'}}
            >
              ANNULLA
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{textAlign: 'center', marginTop: '60px', padding: '20px 0', borderTop: '1px solid var(--white)', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase'}}>
        UNPLUGGED © 2026. LONGOBARDI. FORM FOLLOWS FUNCTION.
      </footer>
    </div>
  );
}

export default App;
