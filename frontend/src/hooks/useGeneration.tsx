import { useState, useCallback } from 'react';
import { API_ENDPOINTS, fetchWithAuth, fetchUpload } from '@/lib/config';

export interface GenerationStatus {
  runId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  currentStep: string;
  videoUrl?: string;
  teaserUrl?: string;
  keyframesUrls?: string[];
  error?: string;
}

export interface GenerationInput {
  dream: string;
  reject?: string[];
  photosUser: File[];
  photosOther?: File[];
  photosDecor?: File[];
  style?: string;
  characterAName?: string;
  characterBName?: string;
}

export function useGeneration() {
  const [status, setStatus] = useState<GenerationStatus | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadPhotos = useCallback(async (photos: File[], type: 'user' | 'other' | 'decor'): Promise<string[]> => {
    const formData = new FormData();
    for (const photo of photos) {
      formData.append('photos', photo);
    }
    formData.append('consent', 'true');

    const response = await fetchUpload(API_ENDPOINTS.uploadPhoto, formData);

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Upload failed');
    }

    const data = await response.json();
    return data.photos.map((p: { id: number }) => p.id.toString());
  }, []);

  const createDream = useCallback(async (
    description: string,
    reject?: string[],
    style?: string,
    characterAName?: string,
    characterBName?: string
  ): Promise<string> => {
    const response = await fetchWithAuth(API_ENDPOINTS.dreams, {
      method: 'POST',
      body: JSON.stringify({
        description,
        ...(reject && reject.length > 0 && { reject }),
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to create dream');
    }

    const data = await response.json();
    return data.dream.id.toString();
  }, []);

  const startGeneration = useCallback(async (dreamId: string): Promise<string> => {
    const response = await fetchWithAuth(API_ENDPOINTS.generateDream(dreamId), {
      method: 'POST',
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to start generation');
    }

    const data = await response.json();
    return data.run.traceId;
  }, []);

  const pollStatus = useCallback(async (runId: string): Promise<GenerationStatus> => {
    const response = await fetchWithAuth(API_ENDPOINTS.runStatus(runId));

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to get status');
    }

    const data = await response.json();

    return {
      runId,
      status: data.status,
      progress: data.progress || 0,
      currentStep: data.currentStep || 'En attente...',
      videoUrl: data.videoUrl,
      teaserUrl: data.teaserUrl,
      keyframesUrls: data.keyframesUrls,
      error: data.error,
    };
  }, []);

  const generate = useCallback(async (input: GenerationInput) => {
    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Upload photos
      const userPhotoIds = await uploadPhotos(input.photosUser, 'user');

      let otherPhotoIds: string[] = [];
      if (input.photosOther && input.photosOther.length > 0) {
        otherPhotoIds = await uploadPhotos(input.photosOther, 'other');
      }

      let decorPhotoIds: string[] = [];
      if (input.photosDecor && input.photosDecor.length > 0) {
        decorPhotoIds = await uploadPhotos(input.photosDecor, 'decor');
      }

      // 2. Create dream
      const dreamId = await createDream(
        input.dream,
        input.reject,
        input.style,
        input.characterAName,
        input.characterBName
      );

      // 3. Start generation (returns traceId for polling)
      const traceId = await startGeneration(dreamId);

      setIsSubmitting(false);
      setIsPolling(true);

      // 4. Poll for status
      const poll = async () => {
        try {
          const currentStatus = await pollStatus(traceId);
          setStatus(currentStatus);

          if (currentStatus.status === 'completed' || currentStatus.status === 'failed' || currentStatus.status === 'cancelled') {
            setIsPolling(false);
            if (currentStatus.status === 'failed') {
              setError(currentStatus.error || 'La génération a échoué');
            }
          } else {
            // Continue polling every 3 seconds
            setTimeout(poll, 3000);
          }
        } catch (err) {
          setIsPolling(false);
          setError(err instanceof Error ? err.message : 'Erreur de connexion');
        }
      };

      // Start polling
      poll();

      return traceId;
    } catch (err) {
      setIsSubmitting(false);
      setIsPolling(false);
      const message = err instanceof Error ? err.message : 'Une erreur est survenue';
      setError(message);
      throw err;
    }
  }, [uploadPhotos, createDream, startGeneration, pollStatus]);

  const cancel = useCallback(async () => {
    if (!status?.runId) return;

    try {
      const response = await fetchWithAuth(API_ENDPOINTS.cancelRun(status.runId), {
        method: 'POST',
      });

      if (response.ok) {
        setStatus(prev => prev ? { ...prev, status: 'cancelled' } : null);
        setIsPolling(false);
      }
    } catch (err) {
      console.error('Cancel error:', err);
    }
  }, [status?.runId]);

  const reset = useCallback(() => {
    setStatus(null);
    setIsSubmitting(false);
    setIsPolling(false);
    setError(null);
  }, []);

  return {
    status,
    isSubmitting,
    isPolling,
    error,
    generate,
    cancel,
    reset,
  };
}
