import axios from 'axios';

const API_URL = import.meta.env.PROD ? '' : 'http://localhost:8000';

export interface Project {
    id: string;
    title: string;
    category: string;
    subtitle?: string;
    description: string;
    team_name?: string;
    writeup_url?: string;
    video_url?: string;
    project_links?: string;
    mu: number;
    sigma: number;
    matches_played: number;
    judged_by?: JudgeInteraction[];
    active?: boolean;
    rank?: number;
}

export interface JudgeInteraction {
    judge_email: string;
    decision: string;
    opponent_id: string;
    timestamp: number;
}

export interface PairResponse {
    project_a: Project;
    project_b: Project;
}

export const api = {
    getNextPair: async (category?: string) => {
        const params = category && category !== 'All' ? { category_filter: category } : {};
        const res = await axios.get<PairResponse>(`${API_URL}/projects/next-pair`, { params });
        return res.data;
    },
    vote: async (winnerId: string, loserId: string) => {
        const res = await axios.post(`${API_URL}/vote`, { winner_id: winnerId, loser_id: loserId });
        return res.data;
    },
    getLeaderboard: async (category?: string) => {
        const params = category && category !== 'All' ? { category } : {};
        const res = await axios.get<Project[]>(`${API_URL}/leaderboard`, { params });
        return res.data;
    },
    searchProjects: async (query: string) => {
        const res = await axios.get<Project[]>(`${API_URL}/projects/search`, { params: { query } });
        return res.data;
    },
    ignoreProject: async (projectId: string) => {
        const res = await axios.post(`${API_URL}/projects/${projectId}/ignore`);
        return res.data;
    },
    unarchiveProject: async (projectId: string) => {
        const res = await axios.post(`${API_URL}/projects/${projectId}/unarchive`);
        return res.data;
    },
    getPairWith: async (projectId: string, opponentId?: string) => {
        const params = opponentId ? { opponent_id: opponentId } : {};
        const res = await axios.get<PairResponse>(`${API_URL}/projects/${projectId}/pair`, { params });
        return res.data;
    },
    getIgnoredProjects: async () => {
        const res = await axios.get<Project[]>(`${API_URL}/ignored-projects`);
        return res.data;
    }
};
