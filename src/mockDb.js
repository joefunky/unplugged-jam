import { supabase, isSupabaseConfigured } from './supabaseClient';

// Helper for default local mock data
const DEFAULT_SONGS = [];
const MOCK_USERS = [
  { id: "u1", email: "p.rossi@gmail.com", display_name: "Paolo Rossi", avatar_url: "https://api.dicebear.com/7.x/bottts/svg?seed=Paolo", is_admin: false },
  { id: "u2", email: "giulia.bianchi@gmail.com", display_name: "Giulia Bianchi", avatar_url: "https://api.dicebear.com/7.x/bottts/svg?seed=Giulia", is_admin: false },
  { id: "u3", email: "admin.longobardi@gmail.com", display_name: "Organizzatore (Admin)", avatar_url: "https://api.dicebear.com/7.x/bottts/svg?seed=Admin", is_admin: true }
];

// Initialize mock storage if empty
if (!localStorage.getItem("jam_proposals_v3")) localStorage.setItem("jam_proposals_v3", JSON.stringify(DEFAULT_SONGS));
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
          player_instrument: songData.player_name ? songData.player_instrument : null
        })
        .select()
        .single();
        
      if (error) {
        // Postgres triggers check constraint or unique checks errors
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
