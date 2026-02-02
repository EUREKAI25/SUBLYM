// Types pour l'application Valentine

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Character {
  id: string;
  name: string;
  photos: Photo[];
}

export interface Photo {
  id: string;
  url: string;
  filename: string;
  uploaded_at: string;
  type: 'character' | 'decor';
}

export interface Generation {
  id: string;
  dream: string;
  style?: string;
  status: 'queued' | 'running' | 'done' | 'error';
  progress: number;
  created_at: string;
  result?: GenerationResult;
  error?: string;
}

export interface GenerationResult {
  scenario?: string;
  keyframes?: string[];
  video_url?: string;
  images?: { url: string; scene: string }[];
}

export interface RunStatus {
  status: 'queued' | 'running' | 'done' | 'error';
  progress: number;
  result?: GenerationResult;
  error?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
}

export type StylePreset = 'cinematic_soft' | 'luxury_elegant' | 'daily_realistic';

export const STYLE_PRESETS: Record<StylePreset, { label: string; description: string }> = {
  cinematic_soft: {
    label: 'Cinématique doux',
    description: 'Lumière dorée, mouvements fluides',
  },
  luxury_elegant: {
    label: 'Luxe élégant',
    description: 'Raffiné, sophistiqué, intemporel',
  },
  daily_realistic: {
    label: 'Quotidien réaliste',
    description: 'Naturel, authentique, spontané',
  },
};
