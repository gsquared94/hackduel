import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Project, JudgeInteraction } from '../lib/api';
import { Swords, RefreshCw } from 'lucide-react';

const COLORS = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
    'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
    'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
    'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
    'bg-rose-500'
];

function getJudgeColorClass(email: string) {
    let hash = 0;
    for (let i = 0; i < email.length; i++) hash += email.charCodeAt(i);
    return COLORS[hash % COLORS.length];
}

function JudgeAvatar({ interaction }: { interaction: JudgeInteraction }) {
    const email = interaction.judge_email || "?";
    const initials = email.substring(0, 2).toUpperCase();
    const colorClass = getJudgeColorClass(email);
    // Green border for Win, Red-ish for Loss
    const borderClass = interaction.decision === 'win'
        ? 'ring-2 ring-green-400'
        : 'ring-1 ring-red-400/30 grayscale-[0.5]';

    return (
        <div
            className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white shadow-sm ${colorClass} ${borderClass} cursor-help transition-transform hover:scale-110 relative z-10`}
            title={`${email} voted ${interaction.decision.toUpperCase()}`}
        >
            {initials}
        </div>
    );
}

export default function LeaderboardPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [category, setCategory] = useState("All");
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [reloadTrigger, setReloadTrigger] = useState(0);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        if (debouncedQuery.trim().length >= 2) {
            // Search Mode
            api.searchProjects(debouncedQuery).then(setProjects);
        } else {
            // Standard Leaderboard Mode
            api.getLeaderboard(category).then(setProjects);
        }
    }, [debouncedQuery, category, reloadTrigger]);

    const handleUnarchive = async (id: string) => {
        if (!confirm("Restoring project to active pool. Continue?")) return;
        try {
            await api.unarchiveProject(id);
            setReloadTrigger(n => n + 1);
        } catch (e) {
            alert("Failed to restore");
        }
    };

    // Calculate Global Confidence based on Vote Saturation
    const TARGET_MATCHES = 10;
    const totalMatches = projects.reduce((acc, p) => acc + (p['matches_played'] || 0), 0);
    const avgMatches = projects.length > 0 ? totalMatches / projects.length : 0;
    const rawConfidence = (avgMatches / TARGET_MATCHES) * 100;
    const confidence = Math.min(100, rawConfidence);

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-white">Leaderboard</h1>

                <div className="flex gap-2 w-full md:w-auto">
                    {/* Search Bar */}
                    <div className="relative flex-1 md:w-64">
                        <input
                            type="text"
                            placeholder="Search projects..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg pl-3 pr-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        />
                    </div>

                    <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 disabled:opacity-50"
                        disabled={searchQuery.length > 0}
                    >
                        <option value="All">All Categories</option>
                        <option value="Science">Science</option>
                        <option value="Education">Education</option>
                        <option value="Accessibility">Accessibility</option>
                        <option value="Health">Health</option>
                        <option value="Business">Business</option>
                        <option value="Technology">Technology</option>
                    </select>
                </div>
            </div>

            {/* Confidence Metric Widget */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-slate-900/50 p-6 rounded-xl border border-white/10 backdrop-blur-sm md:col-span-2">
                    <div className="flex justify-between items-end mb-2">
                        <div>
                            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Ranking Confidence</h2>
                            <p className="text-xs text-slate-500">Based on vote saturation (Avg {avgMatches.toFixed(1)} matches/project)</p>
                        </div>
                        <div className="text-3xl font-black text-white">
                            {confidence.toFixed(1)}%
                        </div>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                        <div
                            className={`h-2.5 rounded-full transition-all duration-1000 ease-out ${confidence < 30 ? 'bg-red-500' :
                                confidence < 70 ? 'bg-yellow-500' :
                                    'bg-green-500'
                                }`}
                            style={{ width: `${confidence}%` }}
                        ></div>
                    </div>
                </div>

                <div className="bg-slate-900/50 p-6 rounded-xl border border-white/10 backdrop-blur-sm flex flex-col justify-center">
                    <div className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">System State</div>
                    <div className={`text-xl font-bold flex items-center gap-2 ${confidence > 80 ? 'text-green-400' : 'text-slate-200'}`}>
                        {confidence < 20 && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                        {confidence >= 20 && confidence < 80 && <span className="w-2 h-2 rounded-full bg-yellow-500" />}
                        {confidence >= 80 && <span className="w-2 h-2 rounded-full bg-green-500" />}
                        {confidence < 20 ? 'Early Voting' : confidence < 80 ? 'Active Judging' : 'Rankings Stabilized'}
                    </div>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-slate-900 rounded-xl border border-white/10 overflow-hidden shadow-2xl">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-950 border-b border-white/10 text-slate-400 text-sm uppercase tracking-wider">
                            <th className="p-4 w-16 text-center">Rank</th>
                            <th className="p-4">Project</th>
                            <th className="p-4 w-32 hidden md:table-cell">Category</th>
                            <th className="p-4 w-24 text-right">Rating</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {projects.map((p, i) => (
                            <tr key={p.id} className="hover:bg-white/5 transition-colors group">
                                <td className="p-4 text-slate-500 font-mono text-sm text-center group-hover:text-white transition-colors">
                                    #{p.rank || i + 1}
                                </td>
                                <td className="p-4">
                                    <a
                                        href={p.writeup_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group/link block"
                                    >
                                        <div className="font-semibold text-white text-lg group-hover/link:text-indigo-400 transition-colors uppercase">
                                            {p.title}
                                        </div>
                                        {p.subtitle && (
                                            <div className="text-sm text-slate-400 italic mt-0.5 group-hover/link:text-slate-300 transition-colors">
                                                {p.subtitle}
                                            </div>
                                        )}
                                    </a>

                                    <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                                        {/* Judges */}
                                        <div>
                                            <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-1.5 font-semibold">
                                                Judged By ({p.judged_by?.length || 0})
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {p.judged_by && p.judged_by.length > 0 ? (
                                                    p.judged_by.slice().reverse().map((interaction, j) => (
                                                        <JudgeAvatar key={j} interaction={interaction} />
                                                    ))
                                                ) : (
                                                    <span className="text-xs text-slate-700 italic">No rankings yet</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div>
                                            {p.active !== false ? (
                                                <Link
                                                    to={`/?projectId=${p.id}`}
                                                    className="inline-flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 px-3 py-1.5 rounded-lg border border-indigo-500/20 transition-all text-xs font-bold uppercase tracking-wide hover:shadow-[0_0_10px_rgba(99,102,241,0.2)]"
                                                >
                                                    <Swords className="w-3.5 h-3.5" />
                                                    Pair Now
                                                </Link>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-500/50 bg-red-500/10 px-2 py-1 rounded">Archived</span>
                                                    <button
                                                        onClick={() => handleUnarchive(p.id)}
                                                        className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 px-3 py-1.5 rounded-lg border border-slate-700 transition-all text-xs font-bold uppercase tracking-wide"
                                                    >
                                                        <RefreshCw className="w-3.5 h-3.5" />
                                                        Restore
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 hidden md:table-cell align-top pt-5">
                                    <span className="inline-block px-2 py-1 rounded-md bg-white/5 text-xs text-slate-300 border border-white/10 whitespace-nowrap">
                                        {p.category}
                                    </span>
                                </td>
                                <td className="p-4 text-right align-top pt-5">
                                    <span
                                        className="font-mono text-indigo-300 cursor-help text-lg"
                                        title={`${p.matches_played || 0} matches played`}
                                    >
                                        {p.mu.toFixed(2)}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {projects.length === 0 && (
                    <div className="p-12 text-center text-slate-500">
                        No projects found.
                    </div>
                )}
            </div>

            <IgnoredProjectsList />
        </div>
    );
}

function IgnoredProjectsList() {
    const [ignored, setIgnored] = useState<Project[]>([]);
    const [visible, setVisible] = useState(false);

    const refresh = () => {
        api.getIgnoredProjects().then(setIgnored);
    };

    useEffect(() => {
        if (visible) refresh();
    }, [visible]);

    const handleRestore = async (id: string) => {
        if (!confirm("Restoring project...")) return;
        await api.unarchiveProject(id);
        refresh();
    };

    if (!visible) {
        return (
            <div className="text-center py-8">
                <button
                    onClick={() => setVisible(true)}
                    className="text-slate-600 hover:text-slate-400 text-sm underline transition-colors"
                >
                    Show Archived Projects
                </button>
            </div>
        );
    }

    return (
        <div className="mt-12 border-t border-slate-800 pt-8 opacity-50 hover:opacity-100 transition-opacity">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-red-900/50 uppercase tracking-widest">Archived Projects</h2>
                <button
                    onClick={() => setVisible(false)}
                    className="text-slate-600 hover:text-slate-400 text-xs uppercase"
                >
                    Hide
                </button>
            </div>
            <div className="bg-slate-900/30 rounded-xl border border-red-900/10 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-black/20 text-slate-600 text-xs uppercase">
                        <tr>
                            <th className="p-3">Project</th>
                            <th className="p-3 text-right">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {ignored.map(p => (
                            <tr key={p.id}>
                                <td className="p-3 text-slate-500">
                                    <a href={p.writeup_url} target="_blank" rel="noreferrer" className="hover:text-red-400 hover:underline transition-colors">
                                        {p.title}
                                    </a>
                                </td>
                                <td className="p-3 text-right text-slate-600 text-xs italic">
                                    <button
                                        onClick={() => handleRestore(p.id)}
                                        className="inline-flex items-center gap-1.5 text-slate-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-wide"
                                    >
                                        <RefreshCw className="w-3 h-3" />
                                        Restore
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {ignored.length === 0 && (
                            <tr><td colSpan={2} className="p-4 text-center text-slate-600 text-xs">No ignored projects.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
