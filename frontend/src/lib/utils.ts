import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    queued: 'En attente...',
    running: 'Création en cours...',
    done: 'Terminé !',
    error: 'Erreur',
  };
  return labels[status] || status;
}

export function getProgressLabel(progress: number): string {
  if (progress < 20) return 'Analyse de votre rêve...';
  if (progress < 40) return 'Création du scénario...';
  if (progress < 60) return 'Génération des images...';
  if (progress < 80) return 'Assemblage de la vidéo...';
  if (progress < 100) return 'Finalisation...';
  return 'Terminé !';
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });
}

export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}
