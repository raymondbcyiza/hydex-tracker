import React, { useState, useEffect } from 'react';
import { Calendar, Target, TrendingUp, Book, Plus, Award, Clock, Zap, LogOut, User } from 'lucide-react';

// =============================================================================
// SUPABASE CONFIGURATION
// =============================================================================
// Replace these with your actual Supabase credentials after setup
const SUPABASE_URL = 'https://wkosnduawdjkaxcnozsn.supabase.co'; // e.g., 'https://xxxxx.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indrb3NuZHVhd2Rqa2F4Y25venNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MTkwODksImV4cCI6MjA4NTE5NTA4OX0.L8NMBY-i_WkwhJaXqhPqlKQP4_UlahEZO1exjdG1V8s';

// Simple Supabase client
class SupabaseClient {
  constructor(url, key) {
    this.url = url;
    this.key = key;
    this.token = localStorage.getItem('supabase_token');
  }

  async fetch(endpoint, options = {}) {
    const headers = {
      'apikey': this.key,
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.url}${endpoint}`, {
      ...options,
      headers
    });

    const data = await response.json();
    return { data, error: !response.ok ? data : null };
  }

  // Auth methods
  async signUp(email, password) {
    const { data, error } = await this.fetch('/auth/v1/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (data?.access_token) {
      this.token = data.access_token;
      localStorage.setItem('supabase_token', this.token);
      localStorage.setItem('supabase_user', JSON.stringify(data.user));
    }

    return { data, error };
  }

  async signIn(email, password) {
    const { data, error } = await this.fetch('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (data?.access_token) {
      this.token = data.access_token;
      localStorage.setItem('supabase_token', this.token);
      localStorage.setItem('supabase_user', JSON.stringify(data.user));
    }

    return { data, error };
  }

  async signOut() {
    await this.fetch('/auth/v1/logout', { method: 'POST' });
    this.token = null;
    localStorage.removeItem('supabase_token');
    localStorage.removeItem('supabase_user');
  }

  getUser() {
    const user = localStorage.getItem('supabase_user');
    return user ? JSON.parse(user) : null;
  }

  // Database methods
  async select(table, query = '') {
    return await this.fetch(`/rest/v1/${table}?${query}`, {
      method: 'GET'
    });
  }

  async insert(table, data) {
    return await this.fetch(`/rest/v1/${table}`, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Prefer': 'return=representation' }
    });
  }

  async update(table, id, data) {
    return await this.fetch(`/rest/v1/${table}?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      headers: { 'Prefer': 'return=representation' }
    });
  }

  async delete(table, id) {
    return await this.fetch(`/rest/v1/${table}?id=eq.${id}`, {
      method: 'DELETE'
    });
  }
}

const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =============================================================================
// MAIN APP COMPONENT
// =============================================================================

const HydexTracker = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('dashboard');
  
  // Data states
  const [entries, setEntries] = useState([]);
  const [skills, setSkills] = useState([]);
  const [goals, setGoals] = useState([]);
  const [projects, setProjects] = useState([]);
  
  // Modal states
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  
  // Form states
  const [entryForm, setEntryForm] = useState({
    date: new Date().toISOString().split('T')[0],
    title: '',
    description: '',
    category: 'CAD',
    timeSpent: 0,
    confidence: 3,
    tags: '',
    standard: '',
    measurement: '',
    tolerance: '',
    whatFailed: '',
    safetyNotes: ''
  });
  
  const [goalForm, setGoalForm] = useState({
    title: '',
    type: 'monthly',
    targetDate: '',
    description: ''
  });
  
  const [projectForm, setProjectForm] = useState({
    title: '',
    problem: '',
    role: '',
    tools: '',
    outcome: '',
    learned: ''
  });

  // Check if user is logged in and load data
  useEffect(() => {
    const currentUser = supabase.getUser();
    if (currentUser) {
      setUser(currentUser);
      loadAllData(currentUser.id);
    }
    setLoading(false);
  }, []);

  // Load all user data from Supabase
  const loadAllData = async (userId) => {
    try {
      // Load entries
      const { data: entriesData } = await supabase.select('entries', `user_id=eq.${userId}&order=date.desc`);
      if (entriesData) {
        setEntries(entriesData.map(e => ({
          ...e,
          tags: e.tags || []
        })));
      }

      // Load skills
      const { data: skillsData } = await supabase.select('skills', `user_id=eq.${userId}`);
      if (skillsData && skillsData.length > 0) {
        setSkills(skillsData);
      } else {
        // Initialize default skills for new user
        await initializeDefaultSkills(userId);
      }

      // Load goals
      const { data: goalsData } = await supabase.select('goals', `user_id=eq.${userId}`);
      if (goalsData) setGoals(goalsData);

      // Load projects
      const { data: projectsData } = await supabase.select('projects', `user_id=eq.${userId}`);
      if (projectsData) setProjects(projectsData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  // Initialize default skills for new users
  const initializeDefaultSkills = async (userId) => {
    const defaultSkills = [
      { user_id: userId, name: 'CAD (SolidWorks/Inventor)', level: 0, category: 'technical' },
      { user_id: userId, name: 'Technical Drawings & GD&T', level: 0, category: 'technical' },
      { user_id: userId, name: 'Materials/Manufacturing', level: 0, category: 'knowledge' },
      { user_id: userId, name: 'Hydraulics/Pneumatics', level: 0, category: 'systems' },
      { user_id: userId, name: 'Maintenance/Inspection', level: 0, category: 'practical' },
      { user_id: userId, name: 'Safety/Procedures', level: 0, category: 'safety' }
    ];

    for (const skill of defaultSkills) {
      await supabase.insert('skills', skill);
    }

    const { data } = await supabase.select('skills', `user_id=eq.${userId}`);
    if (data) setSkills(data);
  };

  // Add entry
  const addEntry = async () => {
    const newEntry = {
      user_id: user.id,
      date: entryForm.date,
      title: entryForm.title,
      description: entryForm.description,
      category: entryForm.category,
      time_spent: parseFloat(entryForm.timeSpent),
      confidence: entryForm.confidence,
      tags: entryForm.tags.split(',').map(t => t.trim()).filter(Boolean),
      standard: entryForm.standard,
      measurement: entryForm.measurement,
      tolerance: entryForm.tolerance,
      what_failed: entryForm.whatFailed,
      safety_notes: entryForm.safetyNotes
    };

    const { data, error } = await supabase.insert('entries', newEntry);
    
    if (!error && data) {
      setEntries([data[0], ...entries]);
      setEntryForm({
        date: new Date().toISOString().split('T')[0],
        title: '',
        description: '',
        category: 'CAD',
        timeSpent: 0,
        confidence: 3,
        tags: '',
        standard: '',
        measurement: '',
        tolerance: '',
        whatFailed: '',
        safetyNotes: ''
      });
      setShowEntryModal(false);
    }
  };

  // Add goal
  const addGoal = async () => {
    const newGoal = {
      user_id: user.id,
      title: goalForm.title,
      type: goalForm.type,
      target_date: goalForm.targetDate || null,
      description: goalForm.description,
      completed: false
    };

    const { data, error } = await supabase.insert('goals', newGoal);
    
    if (!error && data) {
      setGoals([...goals, data[0]]);
      setGoalForm({ title: '', type: 'monthly', targetDate: '', description: '' });
      setShowGoalModal(false);
    }
  };

  // Add project
  const addProject = async () => {
    const newProject = {
      user_id: user.id,
      title: projectForm.title,
      problem: projectForm.problem,
      role: projectForm.role,
      tools: projectForm.tools,
      outcome: projectForm.outcome,
      learned: projectForm.learned
    };

    const { data, error } = await supabase.insert('projects', newProject);
    
    if (!error && data) {
      setProjects([...projects, data[0]]);
      setProjectForm({ title: '', problem: '', role: '', tools: '', outcome: '', learned: '' });
      setShowProjectModal(false);
    }
  };

  // Update skill level
  const updateSkillLevel = async (skillId, newLevel) => {
    const { error } = await supabase.update('skills', skillId, { level: newLevel });
    
    if (!error) {
      setSkills(skills.map(s => s.id === skillId ? { ...s, level: newLevel } : s));
    }
  };

  // Toggle goal completion
  const toggleGoal = async (goalId) => {
    const goal = goals.find(g => g.id === goalId);
    const { error } = await supabase.update('goals', goalId, { completed: !goal.completed });
    
    if (!error) {
      setGoals(goals.map(g => g.id === goalId ? { ...g, completed: !g.completed } : g));
    }
  };

  // Handle logout
  const handleLogout = async () => {
    await supabase.signOut();
    setUser(null);
    setEntries([]);
    setSkills([]);
    setGoals([]);
    setProjects([]);
  };

  // Calculate stats
  const totalHours = entries.reduce((sum, e) => sum + (e.time_spent || 0), 0);
  const avgConfidence = entries.length > 0 
    ? (entries.reduce((sum, e) => sum + e.confidence, 0) / entries.length).toFixed(1)
    : 0;
  const currentStreak = (() => {
    const sortedDates = [...new Set(entries.map(e => e.date))].sort().reverse();
    let streak = 0;
    let currentDate = new Date().toISOString().split('T')[0];
    for (const date of sortedDates) {
      if (date === currentDate) {
        streak++;
        const d = new Date(currentDate);
        d.setDate(d.getDate() - 1);
        currentDate = d.toISOString().split('T')[0];
      } else {
        break;
      }
    }
    return streak;
  })();

  // Category breakdown
  const categoryHours = entries.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + (e.time_spent || 0);
    return acc;
  }, {});

  // Show auth screen if not logged in
  if (!user) {
    return <AuthScreen onAuthSuccess={(user) => {
      setUser(user);
      loadAllData(user.id);
    }} />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #2a1f3a 100%)',
      color: '#e8e8e8',
      fontFamily: '"JetBrains Mono", "Courier New", monospace',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background technical pattern */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: `
          repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, transparent 1px, transparent 40px, rgba(255,255,255,0.03) 41px),
          repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0px, transparent 1px, transparent 40px, rgba(255,255,255,0.03) 41px)
        `,
        pointerEvents: 'none',
        zIndex: 0
      }} />
      
      {/* Accent glow */}
      <div style={{
        position: 'fixed',
        top: '-50%',
        right: '-20%',
        width: '60%',
        height: '100%',
        background: 'radial-gradient(circle, rgba(255,107,0,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Header */}
      <header style={{
        position: 'relative',
        zIndex: 10,
        padding: '2rem 3rem',
        borderBottom: '2px solid rgba(255,107,0,0.3)',
        backdropFilter: 'blur(10px)',
        background: 'rgba(10,14,39,0.6)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '2.5rem',
              fontWeight: 900,
              background: 'linear-gradient(135deg, #ff6b00 0%, #ffa500 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em',
              textTransform: 'uppercase'
            }}>
              HYDEX.LOG
            </h1>
            <p style={{
              margin: '0.5rem 0 0',
              fontSize: '0.9rem',
              color: '#888',
              letterSpacing: '0.1em'
            }}>
              MECHANICAL ENGINEERING DEVELOPMENT TRACKER
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <StatBadge icon={<Zap size={16} />} label="STREAK" value={`${currentStreak}d`} />
            <StatBadge icon={<Clock size={16} />} label="HOURS" value={totalHours.toFixed(1)} />
            <StatBadge icon={<TrendingUp size={16} />} label="AVG CONF" value={avgConfidence} />
            <button onClick={handleLogout} style={{
              padding: '0.75rem 1.25rem',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '6px',
              color: '#e8e8e8',
              fontFamily: 'inherit',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.3s ease'
            }}>
              <LogOut size={16} />
              LOGOUT
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        gap: '0.5rem',
        padding: '1.5rem 3rem',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        {[
          { id: 'dashboard', label: 'DASHBOARD', icon: <TrendingUp size={18} /> },
          { id: 'log', label: 'LOG', icon: <Book size={18} /> },
          { id: 'skills', label: 'SKILLS', icon: <Award size={18} /> },
          { id: 'goals', label: 'GOALS', icon: <Target size={18} /> },
          { id: 'projects', label: 'PROJECTS', icon: <Calendar size={18} /> }
        ].map(nav => (
          <button
            key={nav.id}
            onClick={() => setActiveView(nav.id)}
            style={{
              padding: '0.75rem 1.5rem',
              background: activeView === nav.id 
                ? 'linear-gradient(135deg, #ff6b00 0%, #ff8c00 100%)'
                : 'rgba(255,255,255,0.05)',
              border: activeView === nav.id ? 'none' : '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              color: activeView === nav.id ? '#0a0e27' : '#e8e8e8',
              fontFamily: 'inherit',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.3s ease',
              letterSpacing: '0.05em'
            }}
          >
            {nav.icon}
            {nav.label}
          </button>
        ))}
      </nav>

      {/* Main content */}
      <main style={{
        position: 'relative',
        zIndex: 10,
        padding: '2rem 3rem',
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {activeView === 'dashboard' && (
          <DashboardView 
            entries={entries}
            skills={skills}
            goals={goals}
            projects={projects}
            categoryHours={categoryHours}
            totalHours={totalHours}
            currentStreak={currentStreak}
          />
        )}
        
        {activeView === 'log' && (
          <LogView 
            entries={entries}
            onAddEntry={() => setShowEntryModal(true)}
          />
        )}
        
        {activeView === 'skills' && (
          <SkillsView 
            skills={skills}
            onUpdateSkill={updateSkillLevel}
          />
        )}
        
        {activeView === 'goals' && (
          <GoalsView 
            goals={goals}
            onAddGoal={() => setShowGoalModal(true)}
            onToggleGoal={toggleGoal}
          />
        )}
        
        {activeView === 'projects' && (
          <ProjectsView 
            projects={projects}
            onAddProject={() => setShowProjectModal(true)}
          />
        )}
      </main>

      {/* Modals */}
      {showEntryModal && (
        <Modal onClose={() => setShowEntryModal(false)} title="NEW LOG ENTRY">
          <EntryForm form={entryForm} setForm={setEntryForm} onSubmit={addEntry} />
        </Modal>
      )}
      
      {showGoalModal && (
        <Modal onClose={() => setShowGoalModal(false)} title="NEW GOAL">
          <GoalForm form={goalForm} setForm={setGoalForm} onSubmit={addGoal} />
        </Modal>
      )}
      
      {showProjectModal && (
        <Modal onClose={() => setShowProjectModal(false)} title="NEW PROJECT">
          <ProjectForm form={projectForm} setForm={setProjectForm} onSubmit={addProject} />
        </Modal>
      )}
    </div>
  );
};

// =============================================================================
// AUTH SCREEN COMPONENT
// =============================================================================

const AuthScreen = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error } = isLogin 
        ? await supabase.signIn(email, password)
        : await supabase.signUp(email, password);

      if (error) {
        setError(error.message || 'Authentication failed');
      } else if (data?.user) {
        onAuthSuccess(data.user);
      }
    } catch (err) {
      setError('Connection error. Please check your Supabase configuration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #2a1f3a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '"JetBrains Mono", "Courier New", monospace',
      color: '#e8e8e8',
      padding: '2rem'
    }}>
      {/* Background pattern */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: `
          repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, transparent 1px, transparent 40px, rgba(255,255,255,0.03) 41px),
          repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0px, transparent 1px, transparent 40px, rgba(255,255,255,0.03) 41px)
        `,
        pointerEvents: 'none'
      }} />

      <div style={{
        position: 'relative',
        zIndex: 10,
        width: '100%',
        maxWidth: '450px',
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(20px)',
        border: '2px solid rgba(255,107,0,0.3)',
        borderRadius: '12px',
        padding: '3rem',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{
            margin: 0,
            fontSize: '3rem',
            fontWeight: 900,
            background: 'linear-gradient(135deg, #ff6b00 0%, #ffa500 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.02em',
            textTransform: 'uppercase'
          }}>
            HYDEX.LOG
          </h1>
          <p style={{
            margin: '1rem 0 0',
            fontSize: '0.9rem',
            color: '#888',
            letterSpacing: '0.1em'
          }}>
            MECHANICAL ENGINEERING TRACKER
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.5rem' }}>
          <div>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: '#888',
              letterSpacing: '0.05em'
            }}>
              EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.875rem',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                color: '#e8e8e8',
                fontFamily: 'inherit',
                fontSize: '0.95rem'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: '#888',
              letterSpacing: '0.05em'
            }}>
              PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={{
                width: '100%',
                padding: '0.875rem',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                color: '#e8e8e8',
                fontFamily: 'inherit',
                fontSize: '0.95rem'
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '0.875rem',
              background: 'rgba(255,0,0,0.1)',
              border: '1px solid rgba(255,0,0,0.3)',
              borderRadius: '6px',
              color: '#ff6b6b',
              fontSize: '0.85rem'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '1rem',
              background: loading 
                ? 'rgba(255,107,0,0.5)' 
                : 'linear-gradient(135deg, #ff6b00, #ff8c00)',
              border: 'none',
              borderRadius: '6px',
              color: '#0a0e27',
              fontFamily: 'inherit',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.05em',
              transition: 'all 0.3s ease'
            }}
          >
            {loading ? 'PROCESSING...' : (isLogin ? 'LOGIN' : 'SIGN UP')}
          </button>

          <div style={{ textAlign: 'center', fontSize: '0.9rem', color: '#888' }}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#ff6b00',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              {isLogin ? 'SIGN UP' : 'LOGIN'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =============================================================================
// VIEW COMPONENTS (Same as before, just using database field names)
// =============================================================================

const StatBadge = ({ icon, label, value }) => (
  <div style={{
    padding: '0.75rem 1.25rem',
    background: 'rgba(255,107,0,0.1)',
    border: '1px solid rgba(255,107,0,0.3)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem'
  }}>
    <div style={{ color: '#ff6b00' }}>{icon}</div>
    <div>
      <div style={{ fontSize: '0.7rem', color: '#888', letterSpacing: '0.1em' }}>{label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ff6b00' }}>{value}</div>
    </div>
  </div>
);

const DashboardView = ({ entries, skills, goals, projects, categoryHours, totalHours, currentStreak }) => {
  const recentEntries = entries.slice(0, 5);
  const completedGoals = goals.filter(g => g.completed).length;
  
  return (
    <div style={{ display: 'grid', gap: '2rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
        <DashCard title="TOTAL HOURS LOGGED" value={totalHours.toFixed(1)} subtitle="Across all categories" />
        <DashCard title="CURRENT STREAK" value={`${currentStreak} days`} subtitle="Keep it going!" />
        <DashCard title="SKILLS TRACKING" value={skills.length} subtitle={`Avg level: ${(skills.reduce((s, sk) => s + sk.level, 0) / skills.length).toFixed(1)}`} />
        <DashCard title="GOALS PROGRESS" value={`${completedGoals}/${goals.length}`} subtitle="Goals completed" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <Card title="HOURS BY CATEGORY">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            {Object.entries(categoryHours).map(([cat, hours]) => (
              <div key={cat}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                  <span style={{ color: '#ccc' }}>{cat}</span>
                  <span style={{ color: '#ff6b00', fontWeight: 700 }}>{hours.toFixed(1)}h</span>
                </div>
                <div style={{
                  height: '6px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${(hours / totalHours) * 100}%`,
                    background: 'linear-gradient(90deg, #ff6b00, #ffa500)',
                    transition: 'width 0.5s ease'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
        
        <Card title="SKILL LEVELS">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            {skills.slice(0, 6).map(skill => (
              <div key={skill.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                  <span style={{ color: '#ccc' }}>{skill.name}</span>
                  <span style={{ color: '#ff6b00', fontWeight: 700 }}>{skill.level}/5</span>
                </div>
                <div style={{
                  height: '6px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${(skill.level / 5) * 100}%`,
                    background: 'linear-gradient(90deg, #ff6b00, #ffa500)',
                    transition: 'width 0.5s ease'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="RECENT ENTRIES">
        {recentEntries.length === 0 ? (
          <p style={{ color: '#666', fontStyle: 'italic', marginTop: '1rem' }}>No entries yet. Start logging!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            {recentEntries.map(entry => (
              <div key={entry.id} style={{
                padding: '1rem',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                borderLeft: '3px solid #ff6b00'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', color: '#ff6b00' }}>{entry.title}</h4>
                  <span style={{ fontSize: '0.75rem', color: '#888' }}>{entry.date}</span>
                </div>
                <p style={{ margin: '0.5rem 0', fontSize: '0.9rem', color: '#ccc' }}>{entry.description}</p>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#888' }}>
                  <span>⏱ {entry.time_spent}h</span>
                  <span>📊 Confidence: {entry.confidence}/5</span>
                  <span>🏷 {entry.category}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

const LogView = ({ entries, onAddEntry }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
      <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: '#ff6b00' }}>LOG ENTRIES</h2>
      <button onClick={onAddEntry} style={{
        padding: '0.75rem 1.5rem',
        background: 'linear-gradient(135deg, #ff6b00, #ff8c00)',
        border: 'none',
        borderRadius: '6px',
        color: '#0a0e27',
        fontFamily: 'inherit',
        fontSize: '0.9rem',
        fontWeight: 700,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <Plus size={18} />
        NEW ENTRY
      </button>
    </div>
    
    {entries.length === 0 ? (
      <Card title="NO ENTRIES YET">
        <p style={{ color: '#888', marginTop: '1rem' }}>Click "NEW ENTRY" to start tracking your learning journey.</p>
      </Card>
    ) : (
      <div style={{ display: 'grid', gap: '1rem' }}>
        {entries.map(entry => (
          <Card key={entry.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#ff6b00' }}>{entry.title}</h3>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    background: 'rgba(255,107,0,0.2)',
                    border: '1px solid rgba(255,107,0,0.4)',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: 700
                  }}>
                    {entry.category}
                  </span>
                </div>
                <p style={{ margin: '0.5rem 0', color: '#ccc', lineHeight: 1.6 }}>{entry.description}</p>
                
                {entry.standard && (
                  <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', borderLeft: '2px solid #ff6b00' }}>
                    <strong style={{ color: '#ff6b00', fontSize: '0.85rem' }}>Standard/Spec:</strong>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: '#ccc' }}>{entry.standard}</p>
                  </div>
                )}
                
                {entry.tags && entry.tags.length > 0 && (
                  <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {entry.tags.map((tag, i) => (
                      <span key={i} style={{
                        padding: '0.25rem 0.75rem',
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '12px',
                        fontSize: '0.75rem'
                      }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              <div style={{ marginLeft: '2rem', textAlign: 'right' }}>
                <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>{entry.date}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ff6b00' }}>{entry.time_spent}h</div>
                <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.5rem' }}>
                  Confidence: {entry.confidence}/5
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    )}
  </div>
);

const SkillsView = ({ skills, onUpdateSkill }) => (
  <div>
    <h2 style={{ margin: '0 0 2rem', fontSize: '1.75rem', fontWeight: 700, color: '#ff6b00' }}>SKILL COMPETENCIES</h2>
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {skills.map(skill => (
        <Card key={skill.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#e8e8e8', marginBottom: '1rem' }}>{skill.name}</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[0, 1, 2, 3, 4, 5].map(level => (
                  <button
                    key={level}
                    onClick={() => onUpdateSkill(skill.id, level)}
                    style={{
                      width: '3rem',
                      height: '3rem',
                      background: skill.level >= level 
                        ? 'linear-gradient(135deg, #ff6b00, #ff8c00)'
                        : 'rgba(255,255,255,0.05)',
                      border: skill.level >= level ? 'none' : '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '6px',
                      color: skill.level >= level ? '#0a0e27' : '#666',
                      fontFamily: 'inherit',
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginLeft: '2rem', textAlign: 'right' }}>
              <div style={{ fontSize: '3rem', fontWeight: 900, color: '#ff6b00' }}>{skill.level}</div>
              <div style={{ fontSize: '0.75rem', color: '#888' }}>/ 5</div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  </div>
);

const GoalsView = ({ goals, onAddGoal, onToggleGoal }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
      <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: '#ff6b00' }}>GOALS & MILESTONES</h2>
      <button onClick={onAddGoal} style={{
        padding: '0.75rem 1.5rem',
        background: 'linear-gradient(135deg, #ff6b00, #ff8c00)',
        border: 'none',
        borderRadius: '6px',
        color: '#0a0e27',
        fontFamily: 'inherit',
        fontSize: '0.9rem',
        fontWeight: 700,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <Plus size={18} />
        NEW GOAL
      </button>
    </div>
    
    {goals.length === 0 ? (
      <Card title="NO GOALS SET">
        <p style={{ color: '#888', marginTop: '1rem' }}>Set your first goal to start tracking progress.</p>
      </Card>
    ) : (
      <div style={{ display: 'grid', gap: '1rem' }}>
        {goals.map(goal => (
          <Card key={goal.id}>
            <div style={{ display: 'flex', alignItems: 'start', gap: '1rem' }}>
              <button
                onClick={() => onToggleGoal(goal.id)}
                style={{
                  width: '2rem',
                  height: '2rem',
                  background: goal.completed ? 'linear-gradient(135deg, #ff6b00, #ff8c00)' : 'rgba(255,255,255,0.05)',
                  border: goal.completed ? 'none' : '2px solid rgba(255,255,255,0.3)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                {goal.completed && <span style={{ color: '#0a0e27', fontSize: '1.2rem' }}>✓</span>}
              </button>
              
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                  <h3 style={{
                    margin: 0,
                    fontSize: '1.1rem',
                    color: goal.completed ? '#888' : '#ff6b00',
                    textDecoration: goal.completed ? 'line-through' : 'none'
                  }}>
                    {goal.title}
                  </h3>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    background: 'rgba(255,107,0,0.2)',
                    border: '1px solid rgba(255,107,0,0.4)',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    textTransform: 'uppercase'
                  }}>
                    {goal.type}
                  </span>
                </div>
                
                <p style={{ margin: '0.5rem 0', color: '#ccc', fontSize: '0.9rem' }}>{goal.description}</p>
                
                {goal.target_date && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#888' }}>
                    Target: {goal.target_date}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    )}
  </div>
);

const ProjectsView = ({ projects, onAddProject }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
      <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: '#ff6b00' }}>PROJECT PORTFOLIO</h2>
      <button onClick={onAddProject} style={{
        padding: '0.75rem 1.5rem',
        background: 'linear-gradient(135deg, #ff6b00, #ff8c00)',
        border: 'none',
        borderRadius: '6px',
        color: '#0a0e27',
        fontFamily: 'inherit',
        fontSize: '0.9rem',
        fontWeight: 700,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <Plus size={18} />
        NEW PROJECT
      </button>
    </div>
    
    {projects.length === 0 ? (
      <Card title="NO PROJECTS YET">
        <p style={{ color: '#888', marginTop: '1rem' }}>Document your first project to build your portfolio.</p>
      </Card>
    ) : (
      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {projects.map(project => (
          <Card key={project.id}>
            <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.5rem', color: '#ff6b00' }}>{project.title}</h3>
            
            <div style={{ display: 'grid', gap: '1rem' }}>
              <ProjectSection title="PROBLEM" content={project.problem} />
              <ProjectSection title="YOUR ROLE" content={project.role} />
              <ProjectSection title="TOOLS USED" content={project.tools} />
              <ProjectSection title="OUTCOME" content={project.outcome} />
              <ProjectSection title="WHAT I LEARNED" content={project.learned} highlight />
            </div>
          </Card>
        ))}
      </div>
    )}
  </div>
);

const ProjectSection = ({ title, content, highlight }) => (
  <div style={{
    padding: '1rem',
    background: highlight ? 'rgba(255,107,0,0.1)' : 'rgba(255,255,255,0.03)',
    border: `1px solid ${highlight ? 'rgba(255,107,0,0.3)' : 'rgba(255,255,255,0.1)'}`,
    borderRadius: '6px',
    borderLeft: highlight ? '3px solid #ff6b00' : 'none'
  }}>
    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#888', marginBottom: '0.5rem', letterSpacing: '0.1em' }}>
      {title}
    </div>
    <div style={{ color: '#ccc', lineHeight: 1.6 }}>{content}</div>
  </div>
);

// =============================================================================
// FORM COMPONENTS
// =============================================================================

const Card = ({ title, children }) => (
  <div style={{
    padding: '1.5rem',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    backdropFilter: 'blur(10px)'
  }}>
    {title && <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700, color: '#888', letterSpacing: '0.1em' }}>{title}</h3>}
    {children}
  </div>
);

const DashCard = ({ title, value, subtitle }) => (
  <div style={{
    padding: '1.5rem',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    backdropFilter: 'blur(10px)'
  }}>
    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#888', marginBottom: '0.75rem', letterSpacing: '0.1em' }}>
      {title}
    </div>
    <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#ff6b00', marginBottom: '0.5rem' }}>
      {value}
    </div>
    <div style={{ fontSize: '0.85rem', color: '#666' }}>
      {subtitle}
    </div>
  </div>
);

const Modal = ({ onClose, title, children }) => (
  <div style={{
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.8)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '2rem'
  }} onClick={onClose}>
    <div style={{
      background: 'linear-gradient(135deg, #1a1f3a 0%, #2a1f3a 100%)',
      border: '2px solid rgba(255,107,0,0.3)',
      borderRadius: '12px',
      padding: '2rem',
      maxWidth: '600px',
      width: '100%',
      maxHeight: '90vh',
      overflow: 'auto',
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
    }} onClick={e => e.stopPropagation()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#ff6b00' }}>{title}</h2>
        <button onClick={onClose} style={{
          background: 'none',
          border: 'none',
          color: '#888',
          fontSize: '1.5rem',
          cursor: 'pointer',
          padding: '0.25rem'
        }}>×</button>
      </div>
      {children}
    </div>
  </div>
);

const EntryForm = ({ form, setForm, onSubmit }) => (
  <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} style={{ display: 'grid', gap: '1rem' }}>
    <Input label="Date" type="date" value={form.date} onChange={(e) => setForm({...form, date: e.target.value})} required />
    <Input label="Title" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} required />
    <TextArea label="Description" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} required />
    
    <Select label="Category" value={form.category} onChange={(e) => setForm({...form, category: e.target.value})}>
      <option>CAD</option>
      <option>Technical Drawings</option>
      <option>Materials</option>
      <option>Hydraulics</option>
      <option>Maintenance</option>
      <option>Safety</option>
      <option>Other</option>
    </Select>
    
    <Input label="Time Spent (hours)" type="number" step="0.5" value={form.timeSpent} onChange={(e) => setForm({...form, timeSpent: e.target.value})} required />
    <Input label="Confidence (1-5)" type="number" min="1" max="5" value={form.confidence} onChange={(e) => setForm({...form, confidence: parseInt(e.target.value)})} required />
    <Input label="Tags (comma-separated)" value={form.tags} onChange={(e) => setForm({...form, tags: e.target.value})} />
    
    <TextArea label="Standard/Spec Used (optional)" value={form.standard} onChange={(e) => setForm({...form, standard: e.target.value})} rows={2} />
    <TextArea label="Measurement/Inspection (optional)" value={form.measurement} onChange={(e) => setForm({...form, measurement: e.target.value})} rows={2} />
    <TextArea label="Tolerance/GD&T Concept (optional)" value={form.tolerance} onChange={(e) => setForm({...form, tolerance: e.target.value})} rows={2} />
    <TextArea label="What Failed / Improve Next Time (optional)" value={form.whatFailed} onChange={(e) => setForm({...form, whatFailed: e.target.value})} rows={2} />
    <TextArea label="Safety Notes (optional)" value={form.safetyNotes} onChange={(e) => setForm({...form, safetyNotes: e.target.value})} rows={2} />
    
    <button type="submit" style={{
      padding: '1rem',
      background: 'linear-gradient(135deg, #ff6b00, #ff8c00)',
      border: 'none',
      borderRadius: '6px',
      color: '#0a0e27',
      fontFamily: 'inherit',
      fontSize: '1rem',
      fontWeight: 700,
      cursor: 'pointer',
      marginTop: '1rem'
    }}>
      ADD ENTRY
    </button>
  </form>
);

const GoalForm = ({ form, setForm, onSubmit }) => (
  <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} style={{ display: 'grid', gap: '1rem' }}>
    <Input label="Goal Title" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} required />
    
    <Select label="Type" value={form.type} onChange={(e) => setForm({...form, type: e.target.value})}>
      <option value="monthly">Monthly</option>
      <option value="milestone">Milestone</option>
      <option value="project">Project</option>
    </Select>
    
    <Input label="Target Date" type="date" value={form.targetDate} onChange={(e) => setForm({...form, targetDate: e.target.value})} />
    <TextArea label="Description" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} required />
    
    <button type="submit" style={{
      padding: '1rem',
      background: 'linear-gradient(135deg, #ff6b00, #ff8c00)',
      border: 'none',
      borderRadius: '6px',
      color: '#0a0e27',
      fontFamily: 'inherit',
      fontSize: '1rem',
      fontWeight: 700,
      cursor: 'pointer',
      marginTop: '1rem'
    }}>
      ADD GOAL
    </button>
  </form>
);

const ProjectForm = ({ form, setForm, onSubmit }) => (
  <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} style={{ display: 'grid', gap: '1rem' }}>
    <Input label="Project Title" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} required />
    <TextArea label="Problem" value={form.problem} onChange={(e) => setForm({...form, problem: e.target.value})} required />
    <TextArea label="Your Role" value={form.role} onChange={(e) => setForm({...form, role: e.target.value})} required />
    <Input label="Tools Used" value={form.tools} onChange={(e) => setForm({...form, tools: e.target.value})} required />
    <TextArea label="Outcome" value={form.outcome} onChange={(e) => setForm({...form, outcome: e.target.value})} required />
    <TextArea label="What I Learned" value={form.learned} onChange={(e) => setForm({...form, learned: e.target.value})} required />
    
    <button type="submit" style={{
      padding: '1rem',
      background: 'linear-gradient(135deg, #ff6b00, #ff8c00)',
      border: 'none',
      borderRadius: '6px',
      color: '#0a0e27',
      fontFamily: 'inherit',
      fontSize: '1rem',
      fontWeight: 700,
      cursor: 'pointer',
      marginTop: '1rem'
    }}>
      ADD PROJECT
    </button>
  </form>
);

const Input = ({ label, ...props }) => (
  <div>
    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 700, color: '#888', letterSpacing: '0.05em' }}>
      {label}
    </label>
    <input {...props} style={{
      width: '100%',
      padding: '0.75rem',
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.2)',
      borderRadius: '6px',
      color: '#e8e8e8',
      fontFamily: 'inherit',
      fontSize: '0.95rem'
    }} />
  </div>
);

const TextArea = ({ label, rows = 4, ...props }) => (
  <div>
    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 700, color: '#888', letterSpacing: '0.05em' }}>
      {label}
    </label>
    <textarea {...props} rows={rows} style={{
      width: '100%',
      padding: '0.75rem',
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.2)',
      borderRadius: '6px',
      color: '#e8e8e8',
      fontFamily: 'inherit',
      fontSize: '0.95rem',
      resize: 'vertical'
    }} />
  </div>
);

const Select = ({ label, children, ...props }) => (
  <div>
    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 700, color: '#888', letterSpacing: '0.05em' }}>
      {label}
    </label>
    <select {...props} style={{
      width: '100%',
      padding: '0.75rem',
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.2)',
      borderRadius: '6px',
      color: '#e8e8e8',
      fontFamily: 'inherit',
      fontSize: '0.95rem'
    }}>
      {children}
    </select>
  </div>
);

export default HydexTracker;