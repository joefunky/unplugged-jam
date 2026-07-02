import React, { useState, useEffect, useRef } from 'react';
import { mockDb } from './mockDb';
import { isSupabaseConfigured } from './supabaseClient';

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
  const [selectedKaraokeSong, setSelectedKaraokeSong] = useState(null);
  
  // Audio Player State
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);

  // Authentication Dialog & Custom user registration
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customEmail, setCustomEmail] = useState('');

  // Feedbacks (Toast notification)
  const [toast, setToast] = useState(null);

  // Refresh lists
  const refreshData = async () => {
    const sorted = await mockDb.getSortedProposals();
    setProposals(sorted);
    if (currentUser) {
      const votes = await mockDb.getUserVotes(currentUser);
      const reports = await mockDb.getUserReports(currentUser);
      setUserVotes(votes);
      setUserReports(reports);
    }
  };

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
  }, [currentUser]);

  // Toast Helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Debounced search trigger for Deezer JSONP
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const results = await mockDb.searchDeezer(searchQuery);
        setSearchResults(results);
      } catch (err) {
        console.error("Search error: ", err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Auth: Login
  const handleLogin = async (userId) => {
    const user = await mockDb.login(userId);
    if (user) {
      if (isSupabaseConfigured()) {
        // OAuth redirect in progress
        return;
      }
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
        player_name: playerName,
        player_instrument: playerName ? playerInstrument : ""
      };

      await mockDb.proposeSong(songData, currentUser);
      await refreshData();
      setSelectedTrack(null);
      setSearchQuery('');
      setPlayerName('');
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
            <div style={{fontSize: '1.2rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--white)', marginTop: '-8px', marginBottom: '24px'}}>
              jam in spiaggia
            </div>
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
            <div style={{display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '30px'}}>
              <p style={{fontSize: '0.82rem', lineHeight: '1.25', opacity: 0.9}}>
                <strong>1. PROPOSTA:</strong> Ciascun utente registrato può suggerire al massimo <strong>una canzone a settimana</strong>. Il reset avviene il lunedì alle 00:00.
              </p>
              <p style={{fontSize: '0.82rem', lineHeight: '1.25', opacity: 0.9}}>
                <strong>2. VOTO:</strong> Vota liberamente i brani che preferisci. Le <strong>20 canzoni più votate</strong> diventeranno la scaletta ufficiale. In caso di parità, vince la proposta inviata prima.
              </p>
            </div>
            <button 
              onClick={() => setActiveTab('leaderboard')} 
              className="btn-bauhaus btn-blue"
              style={{fontSize: '1rem', letterSpacing: '0.05em'}}
            >
              VAI ALLA CLASSIFICA →
            </button>
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
            <button 
              className={`tab-btn-bauhaus ${activeTab === 'karaoke' ? 'active' : ''}`} 
              onClick={() => setActiveTab('karaoke')}
            >
              🎤 Karaoke
            </button>
            <button 
              className={`tab-btn-bauhaus ${activeTab === 'info' ? 'active' : ''}`} 
              onClick={() => setActiveTab('info')}
            >
              Info
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
                {/* CTA Row to Propose a song */}
                <div style={{
                  backgroundColor: 'var(--bauhaus-blue)',
                  color: 'white',
                  padding: '12px 16px',
                  marginBottom: '20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  fontSize: '0.8rem'
                }}>
                  <span>proponi il tuo brano settimanale e vota i tuoi brani preferiti!</span>
                  <button 
                    onClick={() => setActiveTab('propose')} 
                    className="btn-bauhaus"
                    style={{
                      width: 'auto', 
                      backgroundColor: 'var(--bauhaus-yellow)', 
                      color: 'black', 
                      padding: '6px 12px', 
                      fontSize: '0.75rem',
                      boxShadow: 'none',
                      border: '1px solid black',
                      fontWeight: '900'
                    }}
                  >
                    PROPONI BRANO
                  </button>
                </div>

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
                              <div className="row-num">{index + 1}</div>
                              
                              <img 
                                src={song.cover_url} 
                                alt={song.title} 
                                className="flat-cover" 
                                style={{cursor: 'pointer'}}
                                onClick={() => togglePlay(song.id, song.preview_url)}
                              />

                              <div className="row-info">
                                <div className="row-title">{song.title}</div>
                                <div className="row-subtitle">
                                  {song.artist} | PROP. DA {song.proposed_by_name.toUpperCase()}
                                </div>
                                {song.player_name && (
                                  <div style={{fontSize: '0.75rem', fontWeight: 'bold', marginTop: '2px', textTransform: 'uppercase'}}>
                                    🎸 STRUMENTISTA: {song.player_name} ({song.player_instrument})
                                  </div>
                                )}
                              </div>

                              <div className="row-actions">
                                {song.preview_url && (
                                  <button onClick={() => togglePlay(song.id, song.preview_url)} className="row-btn-action">
                                    {isPlaying ? '[STOP]' : '[PLAY]'}
                                  </button>
                                )}
                                {!currentUser?.is_admin && (
                                  <button 
                                    onClick={() => handleReport(song.id)} 
                                    className="row-btn-action"
                                    style={{color: isReported ? 'var(--bauhaus-red)' : 'inherit'}}
                                    disabled={isReported}
                                  >
                                    [!]
                                  </button>
                                )}
                                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                                  <button onClick={() => handleVote(song.id)} className={`row-btn-vote ${isVoted ? 'voted' : ''}`}>
                                    {isVoted ? '♥' : 'VOTA'}
                                  </button>
                                  <span style={{fontSize: '0.8rem', fontWeight: '900', marginTop: '2px'}}>
                                    {song.votes_count}
                                  </span>
                                </div>
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
                                <img 
                                  src={song.cover_url} 
                                  alt={song.title} 
                                  className="flat-cover" 
                                  style={{cursor: 'pointer'}}
                                  onClick={() => togglePlay(song.id, song.preview_url)}
                                />

                                <div className="row-info" style={{paddingLeft: '4px'}}>
                                  <div className="row-title">{song.title}</div>
                                  <div className="row-subtitle">
                                    {song.artist} | PROP. DA {song.proposed_by_name.toUpperCase()}
                                  </div>
                                  <div style={{fontSize: '0.75rem', opacity: 0.6, marginTop: '2px'}}>
                                    INSERITA: {new Date(song.proposed_at).toLocaleDateString('it-IT')}
                                  </div>
                                </div>

                                <div className="row-actions">
                                  {song.preview_url && (
                                    <button onClick={() => togglePlay(song.id, song.preview_url)} className="row-btn-action">
                                      {isPlaying ? '[STOP]' : '[PLAY]'}
                                    </button>
                                  )}
                                  {!currentUser?.is_admin && (
                                    <button 
                                      onClick={() => handleReport(song.id)} 
                                      className="row-btn-action"
                                      style={{color: isReported ? 'var(--bauhaus-red)' : 'inherit'}}
                                      disabled={isReported}
                                    >
                                      [!]
                                    </button>
                                  )}
                                  <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                                    <button onClick={() => handleVote(song.id)} className={`row-btn-vote ${isVoted ? 'voted' : ''}`}>
                                      {isVoted ? '♥' : 'VOTA'}
                                    </button>
                                    <span style={{fontSize: '0.8rem', fontWeight: '900', marginTop: '2px'}}>
                                      {song.votes_count}
                                    </span>
                                  </div>
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
                              <img 
                                src={song.cover_url} 
                                alt={song.title} 
                                className="flat-cover" 
                                style={{cursor: 'pointer'}}
                                onClick={() => togglePlay(song.id, song.preview_url)}
                              />

                              <div className="row-info" style={{paddingLeft: '4px'}}>
                                <div className="row-title">{song.title}</div>
                                <div className="row-subtitle">
                                  {song.artist} | PROP: {song.proposed_by_name.toUpperCase()}
                                </div>
                                <div style={{fontSize: '0.75rem', opacity: 0.6, marginTop: '2px'}}>
                                  INSERITA: {new Date(song.proposed_at).toLocaleDateString('it-IT')}
                                  {song.player_name && ` | 🎸 ${song.player_name.toUpperCase()} (${song.player_instrument.toUpperCase()})`}
                                </div>
                              </div>

                              <div className="row-actions">
                                {song.preview_url && (
                                  <button onClick={() => togglePlay(song.id, song.preview_url)} className="row-btn-action">
                                    {isPlaying ? '[STOP]' : '[PLAY]'}
                                  </button>
                                )}
                                {!currentUser?.is_admin && (
                                  <button 
                                    onClick={() => handleReport(song.id)} 
                                    className="row-btn-action"
                                    style={{color: isReported ? 'var(--bauhaus-red)' : 'inherit'}}
                                    disabled={isReported}
                                  >
                                    [!]
                                  </button>
                                )}
                                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                                  <button onClick={() => handleVote(song.id)} className={`row-btn-vote ${isVoted ? 'voted' : ''}`}>
                                    {isVoted ? '♥' : 'VOTA'}
                                  </button>
                                  <span style={{fontSize: '0.8rem', fontWeight: '900', marginTop: '2px'}}>
                                    {song.votes_count}
                                  </span>
                                </div>
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
                  <div style={{marginBottom: '16px'}}>
                    <label className="bauhaus-label">Ti proponi per suonarlo tu? (Nome)</label>
                    <input 
                      type="text" 
                      placeholder="ES. MARCO R." 
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      className="bauhaus-input"
                    />
                  </div>

                  {playerName && (
                    <div style={{marginBottom: '20px'}}>
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
                  <label className="bauhaus-label">Ricerca brano dal catalogo Deezer</label>
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
                    Caricamento da Deezer...
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div className="search-results-list">
                    {searchResults.map((track) => (
                      <div 
                        key={track.deezer_id} 
                        className="search-results-item"
                        onClick={() => setSelectedTrack(track)}
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

        {/* TAB 3: ADMIN/MODERATION */}
        {activeTab === 'admin' && currentUser?.is_admin && (
          <div>
            <div style={{borderBottom: '1px solid var(--white)', paddingBottom: '16px', marginBottom: '24px'}}>
              <h2>MODERAZIONE</h2>
              <p style={{marginTop: '6px'}}>Rassegna dei brani segnalati come non adatti.</p>
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

        {/* TAB 4: KARAOKE LIVE */}
        {activeTab === 'karaoke' && (
          <div>
            <div style={{borderBottom: '1px solid var(--white)', paddingBottom: '16px', marginBottom: '24px'}}>
              <h2>KARAOKE ACUSTICO</h2>
              <p style={{marginTop: '6px', fontSize: '0.9rem'}}>
                Modalità Live per la sera dell'evento: leggi i testi e gli accordi per chitarra dei brani proposti in classifica.
              </p>
            </div>

            {selectedKaraokeSong ? (
              /* Karaoke Dynamic Player Overlay/Full-screen view */
              <div style={{
                backgroundColor: '#000000',
                border: '3px solid var(--white)',
                padding: '24px',
                marginTop: '10px',
                position: 'relative'
              }}>
                <button 
                  onClick={() => setSelectedKaraokeSong(null)} 
                  className="btn-bauhaus btn-red"
                  style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    width: 'auto',
                    padding: '8px 16px',
                    fontSize: '0.8rem',
                    boxShadow: 'none'
                  }}
                >
                  CHIUDI
                </button>

                <div style={{marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '16px', marginRight: '80px'}}>
                  <h3 style={{fontSize: '1.4rem', textTransform: 'uppercase'}}>{selectedKaraokeSong.title}</h3>
                  <p style={{fontSize: '0.9rem', color: 'var(--charcoal)', fontWeight: 'bold'}}>{selectedKaraokeSong.artist.toUpperCase()}</p>
                </div>

                {/* Chords Header Banner */}
                <div style={{
                  backgroundColor: 'var(--bauhaus-blue)',
                  color: 'white',
                  padding: '12px 16px',
                  marginBottom: '24px',
                  fontWeight: '900',
                  fontSize: '0.95rem',
                  letterSpacing: '0.05em'
                }}>
                  🎸 ACCORDI PRINCIPALI: {selectedKaraokeSong.title.toLowerCase().includes("sole") ? "LA - MI - RE - MI" : selectedKaraokeSong.title.toLowerCase().includes("wonderwall") ? "MIM7 - SOL - RE - LA7SUS4" : "DO - SOL - LAM - FA (GIRO CLASSICO)"}
                </div>

                {/* Lyrics Body */}
                <div style={{
                  maxHeight: '400px',
                  overflowY: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '1.1rem',
                  lineHeight: '2.2',
                  whiteSpace: 'pre-wrap',
                  padding: '16px',
                  border: '1px dashed rgba(255,255,255,0.3)',
                  backgroundColor: '#050505',
                  color: 'var(--white)'
                }}>
                  {/* Render lyrics with chords highlighted */}
                  {selectedKaraokeSong.title.toLowerCase().includes("sole") ? (
                    `[LA] Le bionde [MI] trecce, gli [RE] occhi azzurri e [MI] poi
[LA] Le tue cal[MI]zette [RE] rosse [Mi]
[LA] E l'inno[MI]cenza su[RE]lle labbra [Mi] tue
[LA] Due aran[MI]ce ancor più [RE] rosse [Mi]

[LA] Ma la can[MI]zone del [RE] sole [MI]
[LA] Cosa ne [MI] sa? [RE] [MI]
[LA] Ma cosa [MI] ne sa di [RE] noi? [MI]`
                  ) : selectedKaraokeSong.title.toLowerCase().includes("wonderwall") ? (
                    `[MIm7] Today is [SOL] gonna be the day
That they're [RE] gonna throw it back to [LA7sus4] you
[MIm7] By now you [SOL] should've somehow
Real[RE]ized what you gotta [LA7sus4] do

[DO] I don't believe that [RE] anybody
[MIm7] Feels the way I [SOL] do about you [LA7sus4] now`
                  ) : (
                    `[DO] Lungo la strada [SOL] passeggiavamo insieme,
[LAM] le onde del mare e [FA] l'accordo che sale.
[DO] Sotto le stelle di [SOL] questa notte d'estate,
[LAM] cantiamo forte le [FA] nostre canzoni preferite.

(Ritornello)
[DO] E si suona, [SOL] e si balla sulla sabbia!
[LAM] Senza pensieri e [FA] senza più rabbia.
[DO] Con una chitarra [SOL] e un cerchio di amici,
[LAM] in questa notte ci [FA] sentiamo felici.`
                  )}
                </div>

                <div style={{marginTop: '20px', display: 'flex', gap: '12px', alignItems: 'center'}}>
                  {selectedKaraokeSong.preview_url && (
                    <button 
                      onClick={() => togglePlay(selectedKaraokeSong.id, selectedKaraokeSong.preview_url)} 
                      className="btn-bauhaus btn-blue"
                      style={{width: 'auto', padding: '10px 20px', fontSize: '0.9rem', fontWeight: 'bold'}}
                    >
                      {playingId === selectedKaraokeSong.id ? '⏸ ARRESTA TRACCIA' : '▶ ASCOLTA RITMO (DEEZER)'}
                    </button>
                  )}
                  <span style={{fontSize: '0.75rem', opacity: 0.6}}>
                    L'audio riproduce 30 secondi di anteprima per prendere il tempo della jam.
                  </span>
                </div>
              </div>
            ) : (
              /* Song List to pick for Karaoke */
              <div>
                {proposals.length === 0 ? (
                  <div style={{textAlign: 'center', padding: '40px 0', border: '1px dashed var(--white)'}}>
                    <p style={{fontWeight: 'bold'}}>NESSUNA CANZONE DISPONIBILE NELLA SCALETTA.</p>
                    <p style={{fontSize: '0.85rem', color: 'var(--charcoal)', marginTop: '8px'}}>
                      Proponi e vota canzoni nella Classifica per farle comparire qui!
                    </p>
                  </div>
                ) : (
                  <div>
                    <p style={{fontSize: '0.85rem', color: 'var(--charcoal)', marginBottom: '16px'}}>
                      Seleziona uno dei brani proposti in scaletta per avviare lo spartito digitale con accordi e testo:
                    </p>
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
                            <div className="row-subtitle">{song.artist} | STRUMENTISTI DESIGNATI: {song.player_name ? `${song.player_name} (${song.player_instrument})` : 'NESSUNO'}</div>
                          </div>
                          <div className="row-actions">
                            <button 
                              className="btn-bauhaus btn-blue"
                              style={{width: 'auto', padding: '6px 12px', fontSize: '0.75rem', boxShadow: 'none'}}
                            >
                              CANTA / SUONA
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: INFO EVENTO */}
        {activeTab === 'info' && (
          <div>
            <div style={{borderBottom: '1px solid var(--white)', paddingBottom: '16px', marginBottom: '24px'}}>
              <h2>DETTAGLI JAM</h2>
              <p style={{marginTop: '6px', fontSize: '0.9rem'}}>
                Informazioni pratiche e logistica per la serata dell'evento.
              </p>
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
              <div style={{borderLeft: '4px solid var(--bauhaus-blue)', paddingLeft: '16px'}}>
                <span style={{fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--charcoal)', display: 'block', textTransform: 'uppercase', marginBottom: '4px'}}>LUOGO EVENTO</span>
                <strong style={{fontSize: '1.15rem', textTransform: 'uppercase'}}>metallica aru pontinu</strong>
              </div>

              <div style={{borderLeft: '4px solid var(--bauhaus-yellow)', paddingLeft: '16px'}}>
                <span style={{fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--charcoal)', display: 'block', textTransform: 'uppercase', marginBottom: '4px'}}>DATA & ORA</span>
                <strong style={{fontSize: '1.15rem', textTransform: 'uppercase'}}>tba (da definire)</strong>
              </div>

              <div style={{borderLeft: '4px solid var(--white)', paddingLeft: '16px'}}>
                <span style={{fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--charcoal)', display: 'block', textTransform: 'uppercase', marginBottom: '4px'}}>COSA PORTARE</span>
                <p style={{fontSize: '0.95rem', margin: '4px 0 0 0'}}>Chitarre acustiche, percussioni portatili (tamburelli, cajon), teli mare, e tante patatine!</p>
              </div>

              <div style={{borderLeft: '4px solid var(--white)', paddingLeft: '16px'}}>
                <span style={{fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--charcoal)', display: 'block', textTransform: 'uppercase', marginBottom: '4px'}}>BEVANDE & CIBO</span>
                <p style={{fontSize: '0.95rem', margin: '4px 0 0 0'}}>Bar in loco ma feel free to bring your own.</p>
              </div>
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
        unplugged © 2026. idrabognol. attento cowboy
      </footer>
    </div>
  );
}

export default App;
