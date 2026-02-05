import { useState, useCallback } from 'react';
import { API_ENDPOINTS, API_BASE_URL, fetchWithAuth, fetchUpload } from '@/lib/config';

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
  photosUser?: File[];
  useExistingPhotos?: boolean;
  photosOther?: File[];
  photosDecor?: File[];
  style?: string;
  characterAName?: string;
  characterBName?: string;
  plan?: string;
  smileConsent?: string;
}

export function useGeneration() {
  const [status, setStatus] = useState<GenerationStatus | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadPhotos = useCallback(async (photos: File[], type: 'user' | 'other' | 'decor'): Promise<string[]> => {
    console.log(`[GEN] Uploading ${photos.length} photos (type: ${type})`);
    const formData = new FormData();
    for (const photo of photos) {
      formData.append('photos', photo);
    }
    formData.append('consent', 'true');

    const response = await fetchUpload(API_ENDPOINTS.uploadPhoto, formData);

    if (!response.ok) {
      const err = await response.json();
      console.error(`[GEN] Upload failed:`, err);
      throw new Error(err.error || 'Upload failed');
    }

    const data = await response.json();
    console.log(`[GEN] Upload OK: ${data.photos.length} photos, total: ${data.total}`);
    return data.photos.map((p: { id: number }) => p.id.toString());
  }, []);

  const startSmile = useCallback(async (): Promise<boolean> => {
    console.log('[GEN] Starting Smile offer...');
    const response = await fetchWithAuth(`${API_BASE_URL}/smile/start`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('[GEN] Smile start failed:', err);
      throw new Error(err.error || err.message || 'Failed to start Smile');
    }

    const data = await response.json();
    console.log('[GEN] Smile start OK:', data);
    return true;
  }, []);

  const createDream = useCallback(async (
    description: string,
    reject?: string[],
  ): Promise<string> => {
    console.log(`[GEN] Creating dream (${description.length} chars, reject: ${reject?.length || 0})`);
    const response = await fetchWithAuth(API_ENDPOINTS.dreams, {
      method: 'POST',
      body: JSON.stringify({
        description,
        ...(reject && reject.length > 0 && { reject }),
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      const msg = typeof err.error === 'string' ? err.error : err.message || JSON.stringify(err.error) || 'Failed to create dream';
      console.error(`[GEN] Dream creation failed:`, msg);
      throw new Error(msg);
    }

    const data = await response.json();
    console.log(`[GEN] Dream created: id=${data.dream.id}`);
    return data.dream.id.toString();
  }, []);

  const startGeneration = useCallback(async (dreamId: string): Promise<string> => {
    console.log(`[GEN] Starting generation for dream ${dreamId}`);
    const response = await fetchWithAuth(API_ENDPOINTS.generateDream(dreamId), {
      method: 'POST',
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error(`[GEN] Generation start failed:`, err);
      throw new Error(err.error || 'Failed to start generation');
    }

    const data = await response.json();
    console.log(`[GEN] Generation started: traceId=${data.run.traceId}, photosOnly=${data.run.isPhotosOnly}`);
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
    console.log('[GEN] === GENERATE START ===');
    console.log('[GEN] Input:', {
      dream: input.dream.substring(0, 50) + '...',
      photosCount: input.photosUser?.length || 0,
      useExisting: input.useExistingPhotos,
      plan: input.plan,
      smileConsent: input.smileConsent,
    });

    setIsSubmitting(true);
    setError(null);

    try {
      // 0. If Smile, activate the offer first (grants subscription)
      if (input.plan === 'smile') {
        await startSmile();
      }

      // 1. Upload photos (skip if using existing profile photos)
      if (!input.useExistingPhotos && input.photosUser && input.photosUser.length > 0) {
        try {
          await uploadPhotos(input.photosUser, 'user');
        } catch (uploadErr) {
          console.warn('[GEN] Photo upload failed (may already exist), continuing:', uploadErr);
        }
      } else {
        console.log('[GEN] Skipping photo upload (useExisting or no photos)');
      }

      // 2. Create dream
      const dreamId = await createDream(
        input.dream,
        input.reject,
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
            console.log(`[GEN] Final status: ${currentStatus.status}`);
            if (currentStatus.status === 'failed') {
              setError(currentStatus.error || 'La generation a echoue');
            }
          } else {
            setTimeout(poll, 3000);
          }
        } catch (err) {
          setIsPolling(false);
          setError(err instanceof Error ? err.message : 'Erreur de connexion');
        }
      };

      poll();

      console.log(`[GEN] === GENERATE OK === traceId=${traceId}`);
      return traceId;
    } catch (err) {
      console.error('[GEN] === GENERATE FAILED ===', err);
      setIsSubmitting(false);
      setIsPolling(false);
      const message = err instanceof Error ? err.message : 'Une erreur est survenue';
      setError(message);
      throw err;
    }
  }, [uploadPhotos, startSmile, createDream, startGeneration, pollStatus]);

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
