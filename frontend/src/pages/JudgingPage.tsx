import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { Project, PairResponse } from '../lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles, FileText, ArrowLeft, ArrowRight, Swords, Trash } from 'lucide-react';

// Criteria weights
const WEIGHTS = {
    impact: 0.4,
    technical: 0.3,
    creativity: 0.2,
    presentation: 0.1,
};

const CRITERIA_INFO = {
    impact: {
        label: "Impact",
        weight: "40%",
        description: "Does the application solve a real-world problem? Is the vision inspiring and does the solution have a tangible potential for positive change?"
    },
    technical: {
        label: "Technical Depth & Execution",
        weight: "30%",
        description: "Does the application work? How effectively does it utilize advanced AI capabilities (multimodality, reasoning, context)? Is the technology real, functional, well-engineered, and not just faked for the demo?"
    },
    creativity: {
        label: "Creativity",
        weight: "20%",
        description: "How original is the idea? Does it leverage AI in a way that wasn't previously possible? How many of the platform's capabilities are you using and how well do they work together? Did you use the tech in new ways?"
    },
    presentation: {
        label: "Presentation Quality",
        weight: "10%",
        description: "How exciting, engaging, and well-produced is the video? Does it tell a powerful story that captures the viewer's imagination? Does it clearly and effectively demonstrate the product in action, showcasing a great user experience? Does it have viral potential?"
    }
};

type Criteria = keyof typeof WEIGHTS;

export function JudgingPage() {
    const [filterCategory, setFilterCategory] = useState<string>(() => {
        return localStorage.getItem('duel_filter') || 'All Categories';
    });
    // State to track pairs for EACH category to prevent reloading/swapping issues
    const [categoryPairs, setCategoryPairs] = useState<Record<string, PairResponse>>(() => {
        const saved = localStorage.getItem('duel_state');
        try {
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });

    const [pair, setPair] = useState<PairResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [mobileTab, setMobileTab] = useState<'left' | 'center' | 'right'>('center');

    // Relative scores: 0 (Left) to 100 (Right). 50 is Neutral.
    const [scores, setScores] = useState<Record<Criteria, number>>({
        impact: 50,
        technical: 50,
        creativity: 50,
        presentation: 50,
    });

    const categories = [
        'All Categories',
        'Science',
        'Education',
        'Accessibility',
        'Health',
        'Business',
        'Technology',
    ];

    // Helper to save state
    const updateCategoryPair = (cat: string, p: PairResponse | null) => {
        const newState = { ...categoryPairs };
        if (p) {
            newState[cat] = p;
        } else {
            delete newState[cat];
        }
        setCategoryPairs(newState);
        localStorage.setItem('duel_state', JSON.stringify(newState));

        // If we are updating the CURRENT category, update visible pair
        if (cat === filterCategory) {
            setPair(p);
        }
    };

    const fetchPair = async (forceRefetch = false) => {
        // If we already have a pair for this category and aren't forced to refresh, use it!
        if (!forceRefetch && categoryPairs[filterCategory]) {
            setPair(categoryPairs[filterCategory]);
            return;
        }

        setLoading(true);
        try {
            const category = filterCategory === 'All Categories' ? undefined : filterCategory;
            const data = await api.getNextPair(category);

            setPair(data);
            updateCategoryPair(filterCategory, data);

            // Reset scores on new pair
            setScores({
                impact: 50,
                technical: 50,
                creativity: 50,
                presentation: 50,
            });
        } catch (err) {
            console.error('Failed to fetch pair:', err);
        } finally {
            setLoading(false);
        }
    };

    // Effect: Handle Category Switch
    useEffect(() => {
        localStorage.setItem('duel_filter', filterCategory);

        // 1. Try to load from cache
        if (categoryPairs[filterCategory]) {
            setPair(categoryPairs[filterCategory]);
            return;
        }

        // 2. Else fetch new
        fetchPair(true);
    }, [filterCategory]);

    const handleCreateVote = async () => {
        if (!pair || submitting) return;

        // Calculate weighted average to determine winner
        // < 50 means Left wins, > 50 means Right wins.
        let weightedSum = 0;
        let totalWeight = 0;

        (Object.keys(WEIGHTS) as Criteria[]).forEach((criterion) => {
            weightedSum += scores[criterion] * WEIGHTS[criterion];
            totalWeight += WEIGHTS[criterion];
        });

        const finalScore = weightedSum / totalWeight;

        const rightWins = finalScore >= 50;

        setSubmitting(true);
        try {
            await api.vote(
                rightWins ? pair.project_b.id : pair.project_a.id, // winner_id
                rightWins ? pair.project_a.id : pair.project_b.id  // loser_id
            );
            // Force fetch next pair
            fetchPair(true);
        } catch (err) {
            console.error('Vote failed:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleSkip = () => {
        updateCategoryPair(filterCategory, null);
        fetchPair(true);
    };

    const handleIgnore = async (projectId: string) => {
        if (!confirm("Are you sure you want to archive this project? It will be removed from the active pool.")) return;
        setSubmitting(true);
        try {
            await api.ignoreProject(projectId);
            updateCategoryPair(filterCategory, null);
            fetchPair(true);
        } catch (err) {
            console.error('Failed to ignore project:', err);
        } finally {
            setSubmitting(false);
        }
    };



    if (loading) return <div className="flex h-screen items-center justify-center text-white bg-slate-950">Loading judges bench...</div>;
    if (!pair) return <div className="flex h-screen items-center justify-center text-white bg-slate-950">No projects found.</div>;

    const getWinnerName = () => {
        let weightedSum = 0;
        (Object.keys(WEIGHTS) as Criteria[]).forEach((c) => {
            weightedSum += scores[c] * WEIGHTS[c];
        });
        // Scale 0-100
        const finalScore = weightedSum;
        if (Math.abs(finalScore - 50) < 1) return 'Draw';
        return finalScore > 50 ? pair.project_b.title : pair.project_a.title;
    };

    const getWinnerSide = () => {
        let weightedSum = 0;
        (Object.keys(WEIGHTS) as Criteria[]).forEach((c) => {
            weightedSum += scores[c] * WEIGHTS[c];
        });
        if (Math.abs(weightedSum - 50) < 1) return 'neutral';
        return weightedSum > 50 ? 'right' : 'left';
    }

    const winnerSide = getWinnerSide();
    const winnerName = getWinnerName();

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-slate-950 text-slate-100 font-sans selection:bg-blue-500/30">
            {/* Filters */}
            <div className="flex-none px-6 py-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md z-30 flex justify-between items-center shadow-sm">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent tracking-tight">
                    Judgement Chamber
                </h1>
                <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Category</span>
                    <select
                        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all hover:bg-slate-700"
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                    >
                        {categories.map((c) => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Main Content Area - 3 Columns */}
            <div className="flex flex-1 overflow-hidden relative">

                {/* Left Project */}
                <div className={`flex-1 overflow-y-auto overflow-x-auto p-6 transition-all duration-500 ease-in-out relative custom-scrollbar ${winnerSide === 'left' ? 'bg-gradient-to-br from-blue-900/10 to-transparent' : ''} ${mobileTab === 'left' ? 'block' : 'hidden'} md:block`}>
                    {/* Winner Spotlight Effect */}
                    {winnerSide === 'left' && (
                        <div className="absolute inset-0 bg-blue-500/5 pointer-events-none z-0 mix-blend-overlay"></div>
                    )}
                    <div className="relative z-10 min-h-full">
                        <ProjectCard project={pair.project_a} side="left" isWinning={winnerSide === 'left'} onIgnore={() => handleIgnore(pair.project_a.id)} />
                    </div>
                </div>

                {/* Center Controls */}
                <div className={`w-full md:w-[380px] flex-none border-x border-slate-800 bg-slate-900/95 backdrop-blur-xl flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)] z-20 relative ${mobileTab === 'center' ? 'flex' : 'hidden'} md:flex`}>
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-900/0 via-slate-900/0 to-slate-900/50 pointer-events-none"></div>

                    <div className="flex-1 flex flex-col justify-center px-8 py-4 space-y-10 overflow-y-auto">

                        <div className="text-center">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Compare Criteria</div>
                            <div className="text-[10px] text-slate-400 flex justify-between px-2">
                                <span>&larr; Left Better</span>
                                <span>Right Better &rarr;</span>
                            </div>
                        </div>

                        {(Object.keys(WEIGHTS) as Criteria[]).map((criterion) => (
                            <div key={criterion} className="space-y-4 group">
                                <div className="flex justify-center items-end pb-1 relative">
                                    <span className="text-sm font-bold text-slate-200 cursor-help border-b border-dotted border-slate-600 hover:border-blue-400 transition-colors">
                                        {CRITERIA_INFO[criterion].label}
                                    </span>

                                    {/* Tooltip */}
                                    <div className="absolute bottom-full mb-3 w-64 p-3 bg-slate-900 border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none transform translate-y-2 group-hover:translate-y-0 left-1/2 -translate-x-1/2">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">{criterion}</span>
                                            <span className="text-xs font-bold text-slate-500">{CRITERIA_INFO[criterion].weight}</span>
                                        </div>
                                        <p className="text-xs text-slate-300 leading-relaxed text-center">
                                            {CRITERIA_INFO[criterion].description}
                                        </p>
                                        {/* Arrow */}
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-700"></div>
                                    </div>
                                </div>

                                <div className="relative h-10 flex items-center select-none">
                                    {/* Track Background */}
                                    <div className="absolute w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                        <div className="absolute left-1/2 w-0.5 h-full bg-slate-600"></div>
                                    </div>

                                    {/* Active Track Fill */}
                                    <div
                                        className={`absolute h-1.5 rounded-full pointer-events-none shadow-[0_0_10px_currentColor] ${scores[criterion] < 50 ? 'bg-blue-500 shadow-blue-500/50' : scores[criterion] > 50 ? 'bg-purple-500 shadow-purple-500/50' : 'bg-slate-500'}`}
                                        style={{
                                            left: scores[criterion] <= 50 ? `${scores[criterion]}%` : '50%',
                                            width: `${Math.abs(scores[criterion] - 50)}%`
                                        }}
                                    ></div>

                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={scores[criterion]}
                                        onChange={(e) => setScores({ ...scores, [criterion]: parseInt(e.target.value) })}
                                        className="absolute w-full h-full opacity-0 cursor-pointer z-10"
                                    />

                                    {/* Thumb */}
                                    <div
                                        className={`absolute top-1/2 -mt-2.5 w-5 h-5 rounded-full border-2 border-slate-900 shadow-lg pointer-events-none transform ${scores[criterion] < 50 ? 'bg-blue-500 scale-110' : scores[criterion] > 50 ? 'bg-purple-500 scale-110' : 'bg-slate-400'}`}
                                        style={{ left: `calc(${scores[criterion]}% - 10px)` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex-none p-6 pb-8 border-t border-slate-800 bg-slate-900/50 backdrop-blur-md">
                        <div className="text-center mb-6">
                            <div className="text-xs font-medium text-slate-500 uppercase tracking-widest mb-1">Projected Winner</div>
                            <div className={`text-xl font-black text-center leading-tight transition-all duration-300 ${winnerSide === 'left' ? 'text-blue-400 drop-shadow-[0_0_15px_rgba(96,165,250,0.5)]' : winnerSide === 'right' ? 'text-purple-400 drop-shadow-[0_0_15px_rgba(192,132,252,0.5)]' : 'text-slate-500'}`}>
                                {winnerSide === 'neutral' ? 'Draw' : winnerName}
                            </div>
                        </div>

                        <button
                            onClick={handleCreateVote}
                            disabled={submitting}
                            className={`group w-full py-4 rounded-xl font-bold text-lg shadow-xl transform transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 ${winnerSide === 'left'
                                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30 hover:shadow-blue-900/50'
                                : winnerSide === 'right'
                                    ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/30 hover:shadow-purple-900/50'
                                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                                }`}
                        >
                            {submitting ? (
                                <span className="animate-pulse">Submitting...</span>
                            ) : (
                                <>
                                    {winnerSide === 'left' && <span>Confirm {pair.project_a.title.length > 15 ? 'Left' : pair.project_a.title} Wins</span>}
                                    {winnerSide === 'right' && <span>Confirm {pair.project_b.title.length > 15 ? 'Right' : pair.project_b.title} Wins</span>}
                                    {winnerSide === 'neutral' && <span>Select a Winner</span>}
                                </>
                            )}
                        </button>

                        <button
                            onClick={handleSkip}
                            disabled={submitting}
                            className="w-full mt-3 py-3 rounded-xl font-medium text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                        >
                            Skip this pair
                        </button>
                    </div>
                </div>

                {/* Right Project */}
                <div className={`flex-1 overflow-y-auto overflow-x-auto p-6 transition-all duration-500 ease-in-out relative custom-scrollbar ${winnerSide === 'right' ? 'bg-gradient-to-bl from-purple-900/10 to-transparent' : ''} ${mobileTab === 'right' ? 'block' : 'hidden'} md:block`}>
                    {winnerSide === 'right' && (
                        <div className="absolute inset-0 bg-purple-500/5 pointer-events-none z-0 mix-blend-overlay"></div>
                    )}
                    <div className="relative z-10 min-h-full">
                        <ProjectCard project={pair.project_b} side="right" isWinning={winnerSide === 'right'} onIgnore={() => handleIgnore(pair.project_b.id)} />
                    </div>
                </div>

            </div>

            {/* Mobile Navigation */}
            <div className="md:hidden flex-none bg-slate-950 border-t border-slate-800 p-2 flex justify-around items-center z-40 pb-safe">
                <button
                    onClick={() => setMobileTab('left')}
                    className={`flex flex-col items-center p-2 rounded-lg transition-colors ${mobileTab === 'left' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <ArrowLeft className="w-5 h-5 mb-1" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Left Project</span>
                </button>
                <div className="h-8 w-px bg-slate-800"></div>
                <button
                    onClick={() => setMobileTab('center')}
                    className={`flex flex-col items-center p-2 rounded-lg transition-colors ${mobileTab === 'center' ? 'text-white bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <Swords className="w-5 h-5 mb-1" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Judge</span>
                </button>
                <div className="h-8 w-px bg-slate-800"></div>
                <button
                    onClick={() => setMobileTab('right')}
                    className={`flex flex-col items-center p-2 rounded-lg transition-colors ${mobileTab === 'right' ? 'text-purple-400 bg-purple-500/10' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <ArrowRight className="w-5 h-5 mb-1" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Right Project</span>
                </button>
            </div>
        </div >
    );
}

function ProjectCard({ project, side, isWinning, onIgnore }: { project: Project; side: 'left' | 'right', isWinning: boolean, onIgnore: () => void }) {
    const isVideo = project.video_url && (project.video_url.includes('youtube') || project.video_url.includes('youtu.be'));
    const getEmbedUrl = (url: string | undefined) => {
        if (!url) return '';
        if (url.includes('watch?v=')) return url.replace('watch?v=', 'embed/');
        if (url.includes('youtu.be/')) return url.replace('youtu.be/', 'www.youtube.com/embed/');
        if (url.includes('youtube.com/shorts/')) return url.replace('youtube.com/shorts/', 'www.youtube.com/embed/');
        return url;
    };

    return (
        <div className="min-h-full flex flex-col space-y-8 w-full mx-auto pb-20 text-left items-start group relative">

            {/* Header */}
            <div className="w-full relative">
                {/* Disqualify Button - Absolute Top Right of Header */}
                <div className="absolute top-0 right-0 z-50">
                    <button
                        onClick={onIgnore}
                        className="p-2 text-slate-600 hover:text-red-500 bg-slate-900/50 hover:bg-red-500/10 rounded-lg transition-all backdrop-blur-sm border border-slate-700/50"
                        title="Archive Project: Remove this project from the judging pool"
                    >
                        <Trash className="w-5 h-5" />
                    </button>
                </div>
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide mb-4 border ${side === 'right' ? 'bg-purple-500/10 border-purple-500/20 text-purple-300' : 'bg-blue-500/10 border-blue-500/20 text-blue-300'}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                    {project.category}
                </div>
                <h2 className={`text-4xl font-extrabold leading-tight tracking-tight transition-colors duration-300 break-words overflow-wrap-anywhere ${isWinning ? (side === 'right' ? 'text-transparent bg-clip-text bg-gradient-to-br from-purple-200 to-purple-400' : 'text-transparent bg-clip-text bg-gradient-to-br from-blue-200 to-blue-400') : 'text-slate-100'}`}>
                    {project.title}
                </h2>
                {project.subtitle && (
                    <p className="text-slate-400 text-lg mt-2 font-medium italic break-words">{project.subtitle}</p>
                )}
                <div className="text-slate-400 text-sm mt-3 font-medium flex items-center gap-2 justify-start w-full">
                    <span className="w-full text-left">by {project.team_name || 'Anonymous Team'}</span>
                </div>

                {/* Links - Moved to Header */}
                <div className="flex flex-wrap gap-3 pt-4 w-full justify-start">
                    {project.writeup_url && (
                        <a href={project.writeup_url} target="_blank" rel="noreferrer"
                            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-sm font-medium flex items-center gap-2 border border-slate-700/50 hover:border-slate-600">
                            <FileText className="w-4 h-4" />
                            Read Writeup
                        </a>
                    )}
                    {project.project_links && (
                        <a href={project.project_links} target="_blank" rel="noreferrer"
                            className="px-4 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-200 hover:text-blue-100 transition-all text-sm font-medium flex items-center gap-2 border border-blue-500/30 hover:border-blue-500/50">
                            <Sparkles className="w-4 h-4" />
                            AI Studio Link
                        </a>
                    )}
                </div>
            </div>

            {/* Disqualify Button - REMOVED DUPLICATE */}


            {/* Media */}
            <div className={`w-full flex-shrink-0 bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 aspect-video relative group transition-all duration-500 ${isWinning ? (side === 'right' ? 'shadow-purple-900/20 ring-1 ring-purple-500/30' : 'shadow-blue-900/20 ring-1 ring-blue-500/30') : ''}`}>
                {isVideo ? (
                    <iframe
                        src={getEmbedUrl(project.video_url)}
                        title={project.title}
                        className="w-full h-full"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-600">
                        <svg className="w-12 h-12 mb-2 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm font-medium opacity-50">No playback available</span>
                    </div>
                )}
            </div>

            {/* Description */}
            <div className="prose prose-invert prose-lg text-left max-w-none headings:font-bold headings:text-slate-100 p:text-slate-300 break-words">
                <div className="leading-relaxed font-light text-base">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mt-6 mb-4 text-white" {...props} />,
                            h2: ({ node, ...props }) => <h2 className="text-xl font-bold mt-5 mb-3 text-white" {...props} />,
                            h3: ({ node, ...props }) => <h3 className="text-lg font-bold mt-4 mb-2 text-slate-100" {...props} />,
                            p: ({ node, ...props }) => <p className="mb-4 leading-relaxed" {...props} />,
                            ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-4 space-y-1" {...props} />,
                            ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-4 space-y-1" {...props} />,
                        }}
                    >
                        {project.description.replace(/\\n/g, '\n')}
                    </ReactMarkdown>
                </div>
            </div>
        </div >
    );
}
