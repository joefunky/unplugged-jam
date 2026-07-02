import { supabase, isSupabaseConfigured } from './supabaseClient';

// Helper to clean titles and artists from common noise (remaster, live, features, extra punctuation)
function cleanSearchTerm(term) {
  if (!term) return '';
  return term
    .replace(/\([^)]*\)/g, '') // remove anything inside parentheses: (Live), (Remastered)
    .replace(/\[[^\]]*\]/g, '') // remove anything inside brackets
    .replace(/\s-\s.*/g, '') // remove trailing dash details: - Remastered 2011, - Live
    .replace(/feat\..*/gi, '') // remove features
    .replace(/ft\..*/gi, '')
    .replace(/[?.,\/#!$%\^&\*;:{}=\-_`~()]/g, '') // remove punctuation like ? in "Il coccodrillo come fa?"
    .replace(/\s+/g, ' ') // collapse multiple spaces
    .trim();
}

// Helper to fetch lyrics from LRCLIB (synced) or Lyrics.ovh (plain) and inject standard chords
async function fetchLyricsAndChords(title, artist) {
  const cleanTitle = cleanSearchTerm(title);
  const cleanArtist = cleanSearchTerm(artist);
  
  // Variation 1: LRCLIB (Synced lyrics) with corsproxy.io
  const queries = [
    `${cleanTitle} ${cleanArtist}`,
    cleanTitle
  ];

  for (const query of queries) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      // Using corsproxy.io (which is fast and doesn't require wrapper JSON parsing)
      const targetUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
      
      const res = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const match = data.find(item => item.syncedLyrics);
          if (match && match.syncedLyrics) {
            const lines = match.syncedLyrics.split('\n');
            const chords = ['[LA]', '[MI]', '[RE]', '[SOL]', '[DO]', '[LAm]', '[MIm]', '[SIm]'];
            let chordIdx = 0;

            const processed = lines.map((line) => {
              const m = line.match(/^\[(\d{2}):(\d{2})\.(\d{2})\](.*)/);
              if (!m) return line;
              const text = m[4].trim();
              if (!text || text.startsWith('(')) return line;

              const words = text.split(' ');
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
              return `[${m[1]}:${m[2]}.${m[3]}] ` + words.join(' ');
            });

            return processed.join('\n');
          }
        }
      }
    } catch (e) {
      console.warn(`LRCLIB search failed for query "${query}":`, e);
    }
  }

  // Variation 2: Fallback to Lyrics.ovh (Plain text lyrics)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    
    // Lyrics.ovh doesn't block CORS and has a huge collection of Italian songs
    const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.lyrics) {
        // We got plain text lyrics! Let's clean and auto-assign 6 seconds interval per line
        const rawLines = data.lyrics
          .replace(/Paroles de.*/g, '') // remove credit lines
          .split('\n')
          .map(l => l.trim())
          .filter(l => l.length > 0);

        const chords = ['[LA]', '[MI]', '[RE]', '[SOL]', '[DO]', '[LAm]', '[MIm]', '[SIm]'];
        let chordIdx = 0;
        let currentTime = 1.0; // start at 1s

        const processed = rawLines.map((line) => {
          // Format time: MM:SS.cc
          const m = Math.floor(currentTime / 60);
          const s = Math.floor(currentTime % 60);
          const timeStr = `[${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.00]`;
          
          // Increment for next line (e.g. 5.5 seconds per line)
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

        return processed.join('\n');
      }
    }
  } catch (e) {
    console.warn("Lyrics.ovh fallback search failed:", e);
  }

  // Basic fallback if all else fails
  return `[00:01.00] Testo non trovato online per questo brano.`;
}

// Helper for default local mock data
const DEFAULT_SONGS = [
  {
    id: "p_sole",
    deezer_id: "sole",
    title: "La canzone del sole",
    artist: "Lucio Battisti",
    cover_url: "https://e-cdns-images.dzcdn.net/images/cover/ea8207908b8b0e8c05ed83610992383c/250x250-000000-80-0-0.jpg",
    preview_url: "",
    proposed_by: "u1",
    proposed_by_name: "Paolo Rossi",
    proposed_at: new Date().toISOString(),
    player_name: "Paolo Rossi",
    player_instrument: "Chitarra",
    under_review: false,
    review_count: 0,
    lyrics_sheet: `[00:01.00](Intro Strumentale - 8 secondi)
[00:08.00][LA] Le bionde [MI] trecce, gli [RE] occhi azzurri e [MI] poi
[00:13.50][LA] Le tue cal[MI]zette [RE] rosse [MI]
[00:18.00][LA] E l'inno[MI]cenza su[RE]lle labbra [MI] tue
[00:23.50][LA] Due aran[MI]ce ancor più [RE] rosse [MI]
[00:28.00][LA] Ma la can[MI]zone del [RE] sole [MI]
[00:33.50][LA] Cosa ne [MI] sa? [RE] [MI]
[00:38.00][LA] Ma cosa [MI] ne sa di [RE] noi? [MI]
[00:43.00][LA] E al cimitero [MI] dei [RE] fiori [MI]
[00:48.00][LA] Un altro [MI] sole [RE] nascerà [MI]`
  },
  {
    id: "p_wonderwall",
    deezer_id: "wonderwall",
    title: "Wonderwall",
    artist: "Oasis",
    cover_url: "https://e-cdns-images.dzcdn.net/images/cover/cc8207908b8b0e8c05ed83610992383d/250x250-000000-80-0-0.jpg",
    preview_url: "",
    proposed_by: "u2",
    proposed_by_name: "Giulia Bianchi",
    proposed_at: new Date().toISOString(),
    player_name: "Giulia Bianchi",
    player_instrument: "Voce",
    under_review: false,
    review_count: 0,
    lyrics_sheet: `[00:01.00](Intro - 6 secondi)
[00:06.00][MIm7] Today is [SOL] gonna be the day
[00:10.50]That they're [RE] gonna throw it back to [LA7sus4] you
[00:15.00][MIm7] By now you [SOL] should've somehow
[00:19.50]Real[RE]ized what you gotta [LA7sus4] do
[00:24.00][DO] I don't believe that [RE] anybody
[00:29.00][MIm7] Feels the way I [SOL] do about you [LA7sus4] now
[00:34.00][DO] And backbeat, the [RE] word was on the [MIm7] street
[00:38.50]That the [SOL] fire in your heart is [LA7sus4] out`
  },
  {
    id: "p_box",
    deezer_id: "box",
    title: "Man in the Box",
    artist: "Alice in Chains",
    cover_url: "https://e-cdns-images.dzcdn.net/images/cover/aa8207908b8b0e8c05ed83610992383f/250x250-000000-80-0-0.jpg",
    preview_url: "",
    proposed_by: "u3",
    proposed_by_name: "Organizzatore (Admin)",
    proposed_at: new Date().toISOString(),
    player_name: "Organizzatore",
    player_instrument: "Percussioni",
    under_review: false,
    review_count: 0,
    lyrics_sheet: `[00:01.00](Guitar Intro Riff - 12 secondi)
[00:12.00][MIm] I'm the man in the [SOL] box
[00:16.50][RE] Buried in my [LA] shit
[00:21.00][MIm] Won't you come and [SOL] save me?
[00:25.50][RE] Save [LA] me
[00:30.00][MIm] Feed my [SOL] eyes, can you [RE] sew them [LA] shut?
[00:35.00][MIm] Jesus [SOL] Christ, de[RE]ny your [LA] maker
[00:40.00][MIm] He who [SOL] tries, will [RE] be [LA] wasted
[00:45.00][MIm] Feed my [SOL] eyes, now you've [RE] sewn them [LA] shut`
  }
];
const MOCK_USERS = [
  { id: "u1", email: "p.rossi@gmail.com", display_name: "Paolo Rossi", avatar_url: "https://api.dicebear.com/7.x/bottts/svg?seed=Paolo", is_admin: false },
  { id: "u2", email: "giulia.bianchi@gmail.com", display_name: "Giulia Bianchi", avatar_url: "https://api.dicebear.com/7.x/bottts/svg?seed=Giulia", is_admin: false },
  { id: "u3", email: "admin.longobardi@gmail.com", display_name: "Organizzatore (Admin)", avatar_url: "https://api.dicebear.com/7.x/bottts/svg?seed=Admin", is_admin: true }
];

// Initialize mock storage if empty or length is 0
if (!localStorage.getItem("jam_proposals_v3") || JSON.parse(localStorage.getItem("jam_proposals_v3")).length === 0) {
  localStorage.setItem("jam_proposals_v3", JSON.stringify(DEFAULT_SONGS));
} else {
  // If proposals exist, check if the default ones lack lyrics_sheet and update them
  try {
    const list = JSON.parse(localStorage.getItem("jam_proposals_v3"));
    
    // If no lyrics sheet exists in the entire local database, let's reset to defaults to clear any corrupted state
    const hasAnyLyrics = list.some(p => p.lyrics_sheet);
    if (!hasAnyLyrics) {
      localStorage.setItem("jam_proposals_v3", JSON.stringify(DEFAULT_SONGS));
    } else {
      let modified = false;
      const updatedList = list.map(item => {
        const titleLower = item.title.toLowerCase();
        let defaultMatch = null;
        if (titleLower.includes("canzone del sole")) {
          defaultMatch = DEFAULT_SONGS.find(d => d.deezer_id === 'sole');
        } else if (titleLower.includes("wonderwall")) {
          defaultMatch = DEFAULT_SONGS.find(d => d.deezer_id === 'wonderwall');
        } else if (titleLower.includes("man in the box") || titleLower.includes("man in a box")) {
          defaultMatch = DEFAULT_SONGS.find(d => d.deezer_id === 'box');
        }

        if (defaultMatch && !item.lyrics_sheet) {
          modified = true;
          return { ...item, lyrics_sheet: defaultMatch.lyrics_sheet };
        }
        return item;
      });
      if (modified) {
        localStorage.setItem("jam_proposals_v3", JSON.stringify(updatedList));
      }
    }
  } catch (e) {
    console.error("Failed to sync lyrics sheet to cached proposals", e);
  }
}
if (!localStorage.getItem("jam_votes_v3")) localStorage.setItem("jam_votes_v3", JSON.stringify([]));
if (!localStorage.getItem("jam_reports_v3")) localStorage.setItem("jam_reports_v3", JSON.stringify([]));
if (!localStorage.getItem("jam_users_v3")) localStorage.setItem("jam_users_v3", JSON.stringify(MOCK_USERS));

const getLocalProposals = () => JSON.parse(localStorage.getItem("jam_proposals_v3"));
const saveLocalProposals = (data) => localStorage.setItem("jam_proposals_v3", JSON.stringify(data));
const getLocalVotes = () => JSON.parse(localStorage.getItem("jam_votes_v3"));
const saveLocalVotes = (data) => localStorage.setItem("jam_votes_v3", JSON.stringify(data));
const getLocalReports = () => JSON.parse(localStorage.getItem("jam_reports_v3"));
const saveLocalReports = (data) => localStorage.setItem("jam_reports_v3", JSON.stringify(data));

const getLastMonday = () => {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff, 0, 0, 0, 0));
};

export const mockDb = {
  // Authentication
  getCurrentUser: async () => {
    if (isSupabaseConfigured()) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.user) return null;
      
      // Fetch custom profile info
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
        
      return profile || {
        id: session.user.id,
        email: session.user.email,
        display_name: session.user.user_metadata?.name || 'Utente',
        avatar_url: session.user.user_metadata?.avatar_url || '',
        is_admin: false
      };
    }
    const user = localStorage.getItem("jam_current_user");
    return user ? JSON.parse(user) : null;
  },

  login: async (userId) => {
    if (isSupabaseConfigured()) {
      // Trigger Google OAuth redirection
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
      return data;
    }
    const users = JSON.parse(localStorage.getItem("jam_users_v3"));
    const user = users.find(u => u.id === userId);
    if (user) {
      localStorage.setItem("jam_current_user", JSON.stringify(user));
      return user;
    }
    return null;
  },

  logout: async () => {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut();
      return;
    }
    localStorage.removeItem("jam_current_user");
  },

  registerCustomUser: (name, email) => {
    if (isSupabaseConfigured()) {
      throw new Error("La registrazione personalizzata è disattivata in produzione. Usa l'accesso Google.");
    }
    const users = JSON.parse(localStorage.getItem("jam_users_v3"));
    const id = "u_" + Math.random().toString(36).substr(2, 9);
    const avatar_url = `https://api.dicebear.com/7.x/bottts/svg?seed=${name}`;
    const newUser = { id, email, display_name: name, avatar_url, is_admin: false };
    users.push(newUser);
    localStorage.setItem("jam_users_v3", JSON.stringify(users));
    localStorage.setItem("jam_current_user", JSON.stringify(newUser));
    return newUser;
  },

  // Proposals
  getSortedProposals: async () => {
    if (isSupabaseConfigured()) {
      // Fetch proposals and join votes to count them
      const { data: proposals, error } = await supabase
        .from('proposals')
        .select(`
          *,
          votes (
            user_id
          )
        `);
      if (error) {
        console.error("Error loading proposals from Supabase:", error);
        return [];
      }
      
      return proposals.map(p => ({
        ...p,
        votes_count: p.votes ? p.votes.length : 0
      })).sort((a, b) => {
        if (b.votes_count !== a.votes_count) {
          return b.votes_count - a.votes_count;
        }
        return new Date(a.proposed_at) - new Date(b.proposed_at);
      });
    }

    const proposals = getLocalProposals();
    const votes = getLocalVotes();
    return proposals.map(p => {
      const pVotes = votes.filter(v => v.proposal_id === p.id).length;
      return { ...p, votes_count: pVotes };
    }).sort((a, b) => {
      if (b.votes_count !== a.votes_count) {
        return b.votes_count - a.votes_count;
      }
      return new Date(a.proposed_at) - new Date(b.proposed_at);
    });
  },

  proposeSong: async (songData, user) => {
    if (!user) throw new Error("Devi effettuare l'accesso per proporre.");

    // Fetch lyrics and chords in background/realtime
    const lyricsSheet = await fetchLyricsAndChords(songData.title, songData.artist);

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('proposals')
        .insert({
          deezer_id: songData.deezer_id,
          title: songData.title,
          artist: songData.artist,
          cover_url: songData.cover_url,
          preview_url: songData.preview_url,
          proposed_by: user.id,
          proposed_by_name: user.display_name,
          player_name: songData.player_name || null,
          player_instrument: songData.player_name ? songData.player_instrument : null,
          lyrics_sheet: lyricsSheet
        })
        .select()
        .single();
        
      if (error) {
        if (error.message.includes('unique')) {
          throw new Error("Questo brano è già stato proposto!");
        }
        throw new Error(error.message);
      }
      return data;
    }

    const proposals = getLocalProposals();
    const monday = getLastMonday();
    const userProposalsThisWeek = proposals.filter(p => p.proposed_by === user.id).filter(p => new Date(p.proposed_at) >= monday);

    if (userProposalsThisWeek.length >= 1) {
      throw new Error("Hai già proposto un brano per questa settimana! Il reset avviene Lunedì alle 00:00 UTC.");
    }

    const songExists = proposals.some(p => p.deezer_id === songData.deezer_id);
    if (songExists) throw new Error("Questo brano è già stato proposto da qualcun altro!");

    const newProposal = {
      id: Math.random().toString(36).substr(2, 9),
      deezer_id: songData.deezer_id,
      title: songData.title,
      artist: songData.artist,
      cover_url: songData.cover_url,
      preview_url: songData.preview_url,
      proposed_by: user.id,
      proposed_by_name: user.display_name,
      proposed_at: new Date().toISOString(),
      player_name: songData.player_name || "",
      player_instrument: songData.player_instrument || "",
      lyrics_sheet: lyricsSheet,
      under_review: false,
      review_count: 0
    };

    proposals.push(newProposal);
    saveLocalProposals(proposals);
    return newProposal;
  },

  // Votes
  toggleVote: async (proposalId, user) => {
    if (!user) throw new Error("Devi effettuare l'accesso per votare.");

    if (isSupabaseConfigured()) {
      // Check if vote already exists
      const { data: existing } = await supabase
        .from('votes')
        .select('*')
        .eq('proposal_id', proposalId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // Remove vote
        await supabase
          .from('votes')
          .delete()
          .eq('proposal_id', proposalId)
          .eq('user_id', user.id);
        return { voted: false };
      } else {
        // Add vote
        await supabase
          .from('votes')
          .insert({
            proposal_id: proposalId,
            user_id: user.id
          });
        return { voted: true };
      }
    }

    let votes = getLocalVotes();
    const existingIndex = votes.findIndex(v => v.proposal_id === proposalId && v.user_id === user.id);
    if (existingIndex > -1) {
      votes.splice(existingIndex, 1);
      saveLocalVotes(votes);
      return { voted: false };
    } else {
      votes.push({ proposal_id: proposalId, user_id: user.id });
      saveLocalVotes(votes);
      return { voted: true };
    }
  },

  getUserVotes: async (user) => {
    if (!user) return [];
    if (isSupabaseConfigured()) {
      const { data } = await supabase
        .from('votes')
        .select('proposal_id')
        .eq('user_id', user.id);
      return data ? data.map(v => v.proposal_id) : [];
    }
    const votes = getLocalVotes();
    return votes.filter(v => v.user_id === user.id).map(v => v.proposal_id);
  },

  // Reports
  reportSong: async (proposalId, user) => {
    if (!user) throw new Error("Devi effettuare l'accesso per segnalare.");

    if (isSupabaseConfigured()) {
      const { error } = await supabase
        .from('reports')
        .insert({
          proposal_id: proposalId,
          user_id: user.id
        });
      if (error) {
        if (error.message.includes('unique')) {
          throw new Error("Hai già segnalato questo brano.");
        }
        throw error;
      }
      return;
    }

    const reports = getLocalReports();
    const existing = reports.some(r => r.proposal_id === proposalId && r.user_id === user.id);
    if (existing) throw new Error("Hai già segnalato questo brano.");

    reports.push({ proposal_id: proposalId, user_id: user.id });
    saveLocalReports(reports);

    const proposals = getLocalProposals();
    const proposal = proposals.find(p => p.id === proposalId);
    if (proposal) {
      proposal.review_count = (proposal.review_count || 0) + 1;
      if (proposal.review_count >= 3) {
        proposal.under_review = true;
      }
      saveLocalProposals(proposals);
    }
  },

  getUserReports: async (user) => {
    if (!user) return [];
    if (isSupabaseConfigured()) {
      const { data } = await supabase
        .from('reports')
        .select('proposal_id')
        .eq('user_id', user.id);
      return data ? data.map(v => v.proposal_id) : [];
    }
    const reports = getLocalReports();
    return reports.filter(v => v.user_id === user.id).map(v => v.proposal_id);
  },

  // Admin Controls
  adminApproveSong: async (proposalId) => {
    if (isSupabaseConfigured()) {
      await supabase
        .from('proposals')
        .update({ under_review: false, review_count: 0 })
        .eq('id', proposalId);
        
      // Delete reports on DB side
      await supabase
        .from('reports')
        .delete()
        .eq('proposal_id', proposalId);
      return;
    }

    const proposals = getLocalProposals();
    const proposal = proposals.find(p => p.id === proposalId);
    if (proposal) {
      proposal.under_review = false;
      proposal.review_count = 0;
      saveLocalProposals(proposals);

      let reports = getLocalReports();
      reports = reports.filter(r => r.proposal_id !== proposalId);
      saveLocalReports(reports);
    }
  },

  adminDeleteSong: async (proposalId) => {
    if (isSupabaseConfigured()) {
      await supabase
        .from('proposals')
        .delete()
        .eq('id', proposalId);
      return;
    }

    let proposals = getLocalProposals();
    proposals = proposals.filter(p => p.id !== proposalId);
    saveLocalProposals(proposals);
  },

  debugFastForwardWeek: () => {
    if (isSupabaseConfigured()) {
      alert("Il debug temporale è disattivato in produzione.");
      return;
    }
    const proposals = getLocalProposals();
    const updated = proposals.map(p => ({
      ...p,
      proposed_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString()
    }));
    saveLocalProposals(updated);
  },

  // Search directly inside LRCLIB for synced lyrics songs
  searchSyncedLyrics: async (query) => {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    try {
      const targetUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(cleanQuery)}`;
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          // Keep only items that have synced lyrics
          const filtered = data.filter(item => item.syncedLyrics);
          
          // Map to standard track proposal structure
          const results = filtered.map(item => ({
            deezer_id: item.id.toString(),
            title: item.trackName,
            artist: item.artistName,
            lyrics_sheet: item.syncedLyrics,
            // Fallback default covers/previews
            cover_url: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=150",
            preview_url: ""
          }));

          // Limit to first 12 results
          return results.slice(0, 12);
        }
      }
    } catch (e) {
      console.error("Direct lyrics search failed:", e);
    }
    return [];
  },

  // Search Deezer to resolve cover and preview metadata in background, with iTunes fallback
  resolveDeezerMetadata: async (title, artist) => {
    // 1. Try Deezer first
    try {
      const query = encodeURIComponent(`${title} ${artist}`);
      const deezerMeta = await new Promise((resolve) => {
        const callbackName = `deezer_cb_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const script = document.createElement("script");
        
        const timer = setTimeout(() => {
          script.remove();
          delete window[callbackName];
          resolve(null);
        }, 2500);

        window[callbackName] = (data) => {
          clearTimeout(timer);
          script.remove();
          delete window[callbackName];
          if (data && data.data && data.data.length > 0) {
            const track = data.data[0];
            resolve({
              cover_url: track.album.cover_medium || track.album.cover || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=150",
              preview_url: track.preview || ""
            });
          } else {
            resolve(null);
          }
        };

        script.src = `https://api.deezer.com/search?q=${query}&limit=1&output=jsonp&callback=${callbackName}`;
        document.body.appendChild(script);
      });

      if (deezerMeta && (deezerMeta.preview_url || deezerMeta.cover_url)) {
        return deezerMeta;
      }
    } catch (e) {
      console.warn("Deezer metadata query failed, trying iTunes...", e);
    }

    // 2. Try iTunes Search API (CORS-free, fast fallback for covers and previews)
    try {
      const cleanTitle = cleanSearchTerm(title);
      const cleanArtist = cleanSearchTerm(artist);
      const query = encodeURIComponent(`${cleanTitle} ${cleanArtist}`);
      const res = await fetch(`https://itunes.apple.com/search?term=${query}&media=music&limit=1`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.results && data.results.length > 0) {
          const track = data.results[0];
          return {
            cover_url: track.artworkUrl100 ? track.artworkUrl100.replace("100x100bb.jpg", "300x300bb.jpg") : "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=150",
            preview_url: track.previewUrl || ""
          };
        }
      }
    } catch (e) {
      console.warn("iTunes metadata query failed:", e);
    }

    return null;
  },

  // Search Deezer via fast JSONP (no CORS proxy needed, executes instantly)
  searchDeezer: async (query) => {
    const cleanQuery = encodeURIComponent(query.trim());
    if (!cleanQuery) return [];

    return new Promise((resolve) => {
      const callbackName = `deezer_cb_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const script = document.createElement("script");
      
      const timeout = setTimeout(() => {
        cleanup();
        resolve(getFallbackResults(query));
      }, 3500);

      const cleanup = () => {
        clearTimeout(timeout);
        script.remove();
        delete window[callbackName];
      };

      window[callbackName] = (data) => {
        cleanup();
        if (data && data.data) {
          const results = data.data.map(track => ({
            deezer_id: track.id.toString(),
            title: track.title,
            artist: track.artist.name,
            cover_url: track.album.cover_medium || track.album.cover || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=150",
            preview_url: track.preview
          }));
          resolve(results);
        } else {
          resolve([]);
        }
      };

      script.src = `https://api.deezer.com/search?q=${cleanQuery}&limit=8&output=jsonp&callback=${callbackName}`;
      script.onerror = () => {
        cleanup();
        resolve(getFallbackResults(query));
      };
      
      document.body.appendChild(script);
    });
  },

  updateLyrics: async (songId, lyricsSheet) => {
    if (!songId || !lyricsSheet) return;
    if (isSupabaseConfigured()) {
      try {
        await supabase
          .from('proposals')
          .update({ lyrics_sheet: lyricsSheet })
          .eq('id', songId);
      } catch (e) {
        console.error("Error updating lyrics on Supabase:", e);
      }
      return;
    }

    const proposals = getLocalProposals();
    const idx = proposals.findIndex(p => p.id === songId);
    if (idx > -1) {
      proposals[idx].lyrics_sheet = lyricsSheet;
      saveLocalProposals(proposals);
    }
  }
};

function getFallbackResults(query) {
  const fallbackList = [
    { deezer_id: "f1", title: "Certe Notti", artist: "Ligabue", cover_url: "https://e-cdns-images.dzcdn.net/images/cover/ea8207908b8b0e8c05ed83610992383c/250x250-000000-80-0-0.jpg", preview_url: "" },
    { deezer_id: "f2", title: "Generale", artist: "Francesco De Gregori", cover_url: "https://e-cdns-images.dzcdn.net/images/cover/cc8207908b8b0e8c05ed83610992383d/250x250-000000-80-0-0.jpg", preview_url: "" },
    { deezer_id: "f3", title: "Il Gatto e la Volpe", artist: "Edoardo Bennato", cover_url: "https://e-cdns-images.dzcdn.net/images/cover/bb8207908b8b0e8c05ed83610992383e/250x250-000000-80-0-0.jpg", preview_url: "" },
    { deezer_id: "f4", title: "A mano a mano", artist: "Rino Gaetano", cover_url: "https://e-cdns-images.dzcdn.net/images/cover/aa8207908b8b0e8c05ed83610992383f/250x250-000000-80-0-0.jpg", preview_url: "" },
    { deezer_id: "f5", title: "Wish You Were Here", artist: "Pink Floyd", cover_url: "https://e-cdns-images.dzcdn.net/images/cover/998207908b8b0e8c05ed83610992383g/250x250-000000-80-0-0.jpg", preview_url: "" },
    { deezer_id: "f6", title: "Knockin' on Heaven's Door", artist: "Bob Dylan", cover_url: "https://e-cdns-images.dzcdn.net/images/cover/888207908b8b0e8c05ed83610992383h/250x250-000000-80-0-0.jpg", preview_url: "" },
    { deezer_id: "f7", title: "La Bamba", artist: "Ritchie Valens", cover_url: "https://e-cdns-images.dzcdn.net/images/cover/778207908b8b0e8c05ed83610992383i/250x250-000000-80-0-0.jpg", preview_url: "" }
  ];
  return fallbackList.filter(item => 
    item.title.toLowerCase().includes(query.toLowerCase()) || 
    item.artist.toLowerCase().includes(query.toLowerCase())
  );
}
