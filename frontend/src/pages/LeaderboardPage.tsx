import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Project } from '../lib/api';

export default function LeaderboardPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [category, setCategory] = useState("All");

    useEffect(() => {
        api.getLeaderboard(category).then(setProjects);
    }, [category]);

    // Calculate Global Confidence
    // Initial Sigma is 8.333. As matches happen, Sigma decreases.
    // Confidence % = (1 - (Avg Current Sigma / Initial Sigma)) * 100
    const INITIAL_SIGMA = 8.333;
    const avgSigma = projects.length > 0
        ? projects.reduce((acc, p) => acc + p.sigma, 0) / projects.length
        : INITIAL_SIGMA;

    // We cap confidence at 0% minimum (though sigma shouldn't go above initial basically)
    // and scale it. Truly converging to 0 sigma is infinite play, so let's say 
    // sigma < 3 is "Very High Confidence" (approx 70%+ raw match).
    // Let's map 8.333 -> 0% and 1.0 -> 100% for practically "done".
    const rawConfidence = Math.max(0, (INITIAL_SIGMA - avgSigma) / (INITIAL_SIGMA - 1.0)) * 100;
    const confidence = Math.min(100, rawConfidence);

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">Leaderboard</h1>
                <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2"
                >
                    <option value="All">All Categories</option>
                    <option value="Science">Science</option>
                    <option value="Education">Education</option>
                    <option value="Accessibility">Accessibility</option>
                    <option value="Health">Health</option>
                    <option value="Business">Business</option>
                    <option value="Technology">Technology</option>
                    <option value="Technology">Technology</option>
                </select>
            </div>

            {/* Confidence Metric Widget */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-slate-900/50 p-6 rounded-xl border border-white/10 backdrop-blur-sm md:col-span-2">
                    <div className="flex justify-between items-end mb-2">
                        <div>
                            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Leaderboard Confidence</h2>
                            <p className="text-xs text-slate-500">Based on statistical uncertainty reduction over {projects.length} projects</p>
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
                        {confidence < 20 ? 'Gathering Data' : confidence < 80 ? 'Converging' : 'Statistically Significant'}
                    </div>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-slate-900 rounded-xl border border-white/10 overflow-hidden shadow-2xl">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-950 border-b border-white/10 text-slate-400 text-sm uppercase tracking-wider">
                            <th className="p-4">Rank</th>
                            <th className="p-4">Project</th>
                            <th className="p-4">Category</th>
                            <th className="p-4 text-right">Rating (μ)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {projects.map((p, i) => (
                            <tr key={p.id} className="hover:bg-white/5 transition-colors group">
                                <td className="p-4 text-slate-500 font-mono text-sm group-hover:text-white transition-colors">#{i + 1}</td>
                                <td className="p-4">
                                    <a
                                        href={p.writeup_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group/link block"
                                    >
                                        <div className="font-semibold text-white group-hover/link:text-indigo-400 transition-colors uppercase">
                                            {p.title}
                                        </div>
                                        {p.subtitle && (
                                            <div className="text-xs text-slate-400 italic mt-0.5 group-hover/link:text-slate-300 transition-colors">
                                                {p.subtitle}
                                            </div>
                                        )}
                                    </a>
                                </td>
                                <td className="p-4">
                                    <span className="inline-block px-2 py-1 rounded-md bg-white/5 text-xs text-slate-300 border border-white/10">
                                        {p.category}
                                    </span>
                                </td>
                                <td className="p-4 text-right font-mono text-indigo-300">
                                    {p.mu.toFixed(2)}
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

    useEffect(() => {
        if (visible) {
            api.getIgnoredProjects().then(setIgnored);
        }
    }, [visible]);

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
                                    Archived
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
