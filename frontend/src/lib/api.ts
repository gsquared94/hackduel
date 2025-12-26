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
    ignoreProject: async (projectId: string) => {
        const res = await axios.post(`${API_URL}/projects/${projectId}/ignore`);
        return res.data;
    },
    getIgnoredProjects: async () => {
        const res = await axios.get<Project[]>(`${API_URL}/ignored-projects`);
        return res.data;
    }
};
