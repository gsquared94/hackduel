import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { JudgingPage } from './pages/JudgingPage';
import LeaderboardPage from './pages/LeaderboardPage';
import { HelpDialog } from './components/HelpDialog';
import { Trophy, Swords, CircleHelp } from 'lucide-react';

function App() {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  return (
    <Router>
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30">
        <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-tr from-indigo-500 to-purple-500 p-2 rounded-lg">
                  <Swords className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                  HackDuel
                </span>
              </div>
              <div className="flex gap-6">
                <Link to="/" className="flex items-center gap-2 hover:text-indigo-400 transition-colors font-medium text-sm">
                  <Swords className="w-4 h-4" /> Judge
                </Link>
                <Link to="/leaderboard" className="flex items-center gap-2 hover:text-indigo-400 transition-colors font-medium text-sm">
                  <Trophy className="w-4 h-4" /> Leaderboard
                </Link>
                <div className="h-6 w-px bg-slate-800 mx-2" />
                <button
                  onClick={() => setIsHelpOpen(true)}
                  className="flex items-center gap-2 text-slate-400 hover:text-indigo-400 transition-colors font-medium text-sm"
                  title="How it Works"
                >
                  <CircleHelp className="w-4 h-4" /> Help
                </button>
              </div>
            </div>
          </div>
        </nav>

        <HelpDialog isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

        <main className="p-6">
          <Routes>
            <Route path="/" element={<JudgingPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
